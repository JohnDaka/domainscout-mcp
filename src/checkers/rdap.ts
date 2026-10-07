import {
  Header,
  HttpStatus,
  RDAP_ACCEPT,
  RDAP_DOMAIN_PATH,
  RdapEvent,
  Retry,
} from '../constants.js';
import { errorMessage } from '../core/errors.js';
import { discardBody, retryableError } from '../core/http.js';
import { isRetryableStatus } from '../core/http-status.js';
import type { Network } from '../core/network.js';
import { withRetry } from '../core/retry.js';
import type { RdapService } from '../core/services.js';
import { LookupState, type RdapLookup } from '../core/types.js';
import { becauseOf, ErrorText, httpStatusText } from '../messages/index.js';
import { RdapBootstrap } from './rdap-bootstrap.js';

/** The parts of an RDAP domain object (RFC 9083) we use. */
interface RdapDomain {
  status?: string[];
  events?: Array<{ eventAction?: string; eventDate?: string }>;
}

/** Headers of every RDAP request. */
const RDAP_HEADERS = { [Header.Accept]: RDAP_ACCEPT };

/** The registry's own answer about a domain, over RDAP (RFC 9082/9083). */
export class RdapChecker implements RdapService {
  constructor(
    private readonly network: Network,
    private readonly bootstrap: RdapBootstrap = new RdapBootstrap(network),
  ) {}

  async lookup(domain: string, tld: string, signal?: AbortSignal): Promise<RdapLookup> {
    let base: string | undefined;
    try {
      base = await this.bootstrap.serverFor(tld);
    } catch (error) {
      const message = becauseOf(ErrorText.RdapListUnavailable, errorMessage(error));
      return { state: LookupState.Error, error: message, ms: 0 };
    }
    if (!base) return { state: LookupState.Unsupported };
    return this.ask(new URL(`${RDAP_DOMAIN_PATH}${domain}`, base), signal);
  }

  /** Asks the server within its limits; rate limits, server errors and timeouts are retried. */
  private async ask(url: URL, signal?: AbortSignal): Promise<RdapLookup> {
    const started = Date.now();
    const send = () => this.fetchOnce(url, started, signal);
    try {
      const queued = () => this.network.viaQueues(this.network.rdapHosts, url.host, send, signal);
      return await withRetry(queued, { ...Retry.rdap, signal });
    } catch (error) {
      const ms = Date.now() - started;
      return { state: LookupState.Error, server: url.host, error: errorMessage(error), ms };
    }
  }

  /** 404 means not registered, 200 registered; 429 and 5xx throw to be retried. */
  private async fetchOnce(url: URL, started: number, signal?: AbortSignal): Promise<RdapLookup> {
    const response = await this.network.request(url, { headers: RDAP_HEADERS }, signal);
    const server = url.host;
    const ms = Date.now() - started;
    if (!response.ok) await discardBody(response);
    if (response.status === HttpStatus.NotFound) return { state: LookupState.NotFound, server, ms };
    if (isRetryableStatus(response.status)) throw retryableError(response, url);
    if (!response.ok) {
      return { state: LookupState.Error, server, error: httpStatusText(response.status), ms };
    }
    return this.registered((await response.json()) as RdapDomain, server, ms);
  }

  private registered(data: RdapDomain, server: string, ms: number): RdapLookup {
    return {
      state: LookupState.Registered,
      server,
      statuses: data.status ?? [],
      created: this.eventDate(data, RdapEvent.Registration),
      expires: this.eventDate(data, RdapEvent.Expiration),
      ms,
    };
  }

  private eventDate(data: RdapDomain, action: string): string | undefined {
    return data.events?.find((event) => event.eventAction === action)?.eventDate;
  }
}
