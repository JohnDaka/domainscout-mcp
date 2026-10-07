import type { NameComKeys } from '../../config/config.js';
import { Header, HttpMethod, HttpStatus, SECOND_MS } from '../../constants.js';
import type { HostQueueOptions } from '../../core/host-queues.js';
import type { Network } from '../../core/network.js';
import { type Confirmation, ConfirmState, type Price, RegistrarId } from '../../core/types.js';
import { apiPriceSource, atHost, httpStatusText } from '../../messages/index.js';
import { exactPrice, minYearsForDomain } from '../../pricing/price.js';
import { RegistrarName } from '../../registrars/registrars.js';
import { sendJson } from '../json-client.js';
import type { RegistrarApi } from '../registrar-api.js';

/** Availability check, Name.com Core API (https://docs.name.com/api/v1/reference/domains/check-availability). */
const CHECK_URL = 'https://api.name.com/core/v1/domains:checkAvailability';
/** Most names in one request. */
const BATCH_SIZE = 50;
/** Name.com allows 20 requests per second; half leaves room for the user's other tools. */
const REQUESTS_PER_SECOND = 10;
/** Requests in flight at once. */
const CONCURRENCY = 2;
/** Only names that can be registered right now, not aftermarket or backorder offers. */
const PURCHASE_TYPE = 'registration';
/** HTTP Basic authentication with the username and the API token. */
const BASIC_SCHEME = 'Basic';
/** Between the username and the token in Basic credentials. */
const CREDENTIALS_SEPARATOR = ':';
/** Basic credentials are base64-encoded. */
const BASE64 = 'base64';

/** One name in the reply. */
interface NameComResult {
  domainName?: string;
  purchasable?: boolean;
  premium?: boolean;
  /** Total for the minimum term (2 years for .ai), not per year. */
  purchasePrice?: number;
  renewalPrice?: number;
  /** Extra context, e.g. registry maintenance. */
  reason?: string;
}

/** The availability reply. */
interface NameComReply {
  results?: NameComResult[];
  message?: string;
}

/** Name.com's availability check, with the user's username and API token. */
export class NameComApi implements RegistrarApi {
  readonly registrar = RegistrarId.NameCom;
  readonly batchSize = BATCH_SIZE;
  readonly limits: HostQueueOptions = {
    concurrency: CONCURRENCY,
    intervalCap: REQUESTS_PER_SECOND,
    intervalMs: SECOND_MS,
  };
  /** The Authorization header value. */
  private readonly authorization: string;

  constructor(keys: NameComKeys) {
    const credentials = `${keys.username}${CREDENTIALS_SEPARATOR}${keys.token}`;
    this.authorization = `${BASIC_SCHEME} ${Buffer.from(credentials).toString(BASE64)}`;
  }

  async check(
    domains: readonly string[],
    network: Network,
    signal?: AbortSignal,
  ): Promise<Confirmation[]> {
    const url = new URL(CHECK_URL);
    const reply = await sendJson<NameComReply>(
      network,
      url,
      {
        method: HttpMethod.Post,
        headers: { [Header.Authorization]: this.authorization },
        body: { domainNames: domains, purchaseType: PURCHASE_TYPE },
      },
      signal,
    );
    // 422: none of the names has a TLD Name.com sells.
    if (reply.status === HttpStatus.UnprocessableEntity) return this.unsupported(domains);
    if (!reply.ok) {
      throw new Error(atHost(url.host, reply.data.message ?? httpStatusText(reply.status)));
    }
    return (reply.data.results ?? []).flatMap((result) =>
      result.domainName ? [this.toConfirmation(result.domainName, result)] : [],
    );
  }

  private toConfirmation(name: string, result: NameComResult): Confirmation {
    const domain = name.toLowerCase();
    if (result.purchasable) return this.available(domain, result);
    // A reason (e.g. registry maintenance) means "cannot tell right now", not "taken".
    if (result.reason) return { domain, state: ConfirmState.Error, detail: result.reason };
    return { domain, state: ConfirmState.Unavailable };
  }

  private available(domain: string, result: NameComResult): Confirmation {
    const premium = result.premium === true;
    // A premium's real price needs a separate pricing call, so it is left to the registrar's page.
    const price = premium ? undefined : this.price(domain, result);
    return { domain, state: ConfirmState.Available, premium, ...(price && { price }) };
  }

  /** Name.com quotes totals for the minimum term; prices here are per year. */
  private price(domain: string, result: NameComResult): Price | undefined {
    const years = minYearsForDomain(domain);
    return exactPrice({
      registration: (result.purchasePrice ?? Number.NaN) / years,
      renewal: (result.renewalPrice ?? Number.NaN) / years,
      minYears: years,
      source: apiPriceSource(RegistrarName.NameCom),
    });
  }

  private unsupported(domains: readonly string[]): Confirmation[] {
    return domains.map((domain) => ({ domain, state: ConfirmState.Unsupported }));
  }
}
