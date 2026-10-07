import {
  IANA_WHOIS_HOST,
  LABEL_SEPARATOR,
  Retry,
  WHOIS_RATE_LIMIT_COOLDOWN_MS,
} from '../constants.js';
import { errorMessage, RetryableError } from '../core/errors.js';
import type { Network } from '../core/network.js';
import { PromiseCache } from '../core/promise-cache.js';
import { withRetry } from '../core/retry.js';
import type { WhoisService } from '../core/services.js';
import { LookupState, type RegistryAnswer, type WhoisLookup } from '../core/types.js';
import { atHost, becauseOf, ErrorText } from '../messages/index.js';
import { type WhoisTransport, whoisQuery } from './whois-client.js';
import { interpretWhois, WhoisVerdict } from './whois-reply.js';

/** Where the domain goes in a query format. */
const DOMAIN_PLACEHOLDER = '{domain}';

/** Servers that need a special query to return one exact-match answer; others get the plain domain. */
const QUERY_FORMATS: ReadonlyMap<string, string> = new Map<string, string>()
  // Verisign (.com, .net): without "domain", the reply also lists name servers that match the name.
  .set('whois.verisign-grs.com', `domain ${DOMAIN_PLACEHOLDER}`)
  // DENIC (.de): asks for the domain record, with names in ASCII (ACE) form.
  .set('whois.denic.de', `-T dn,ace ${DOMAIN_PLACEHOLDER}`)
  // JPRS (.jp): "/e" asks for the reply in English.
  .set('whois.jprs.jp', `${DOMAIN_PLACEHOLDER}/e`);

/** In IANA's reply about a TLD, the line that names its WHOIS server: "whois: whois.nic.example". */
const IANA_REFERRAL = /^whois:\s*(\S+)/im;

/** The lookup state each WHOIS answer stands for; the other verdicts are not answers. */
const ANSWER_STATES: ReadonlyMap<WhoisVerdict, RegistryAnswer> = new Map<
  WhoisVerdict,
  RegistryAnswer
>()
  .set(WhoisVerdict.Registered, LookupState.Registered)
  .set(WhoisVerdict.NotFound, LookupState.NotFound)
  .set(WhoisVerdict.Reserved, LookupState.Reserved);

/** The registry's answer over WHOIS, for TLDs without RDAP or when RDAP fails. */
export class WhoisChecker implements WhoisService {
  /** Each TLD's WHOIS server, as IANA names it; asked once per TLD. */
  private readonly servers = new PromiseCache<string, string | undefined>();

  constructor(
    private readonly network: Network,
    /** TCP port 43 in real use; tests pass a fake. */
    private readonly transport: WhoisTransport = whoisQuery,
  ) {}

  async lookup(domain: string, tld: string, signal?: AbortSignal): Promise<WhoisLookup> {
    let server: string | undefined;
    try {
      server = await this.serverFor(tld);
    } catch (error) {
      const message = becauseOf(ErrorText.WhoisServerUnknown, errorMessage(error));
      return { state: LookupState.Error, error: message, ms: 0 };
    }
    if (!server) return { state: LookupState.Unsupported };
    return this.ask(server, domain, signal);
  }

  /** Asks the TLD's server and reads the reply. Network failures and rate limits share one retry budget. */
  private async ask(server: string, domain: string, signal?: AbortSignal): Promise<WhoisLookup> {
    const started = Date.now();
    const query = this.queryFor(server, domain);
    try {
      const reply = await withRetry(() => this.query(server, query, signal), {
        ...Retry.whois,
        signal,
      });
      return this.toLookup(interpretWhois(reply), server, Date.now() - started);
    } catch (error) {
      const ms = Date.now() - started;
      return { state: LookupState.Error, server, error: errorMessage(error), ms };
    }
  }

  private toLookup(verdict: WhoisVerdict, server: string, ms: number): WhoisLookup {
    const state = ANSWER_STATES.get(verdict);
    if (!state) return { state: LookupState.Error, server, error: ErrorText.WhoisUnreadable, ms };
    return { state, server, ms };
  }

  private queryFor(server: string, domain: string): string {
    const format = QUERY_FORMATS.get(server) ?? DOMAIN_PLACEHOLDER;
    return format.replace(DOMAIN_PLACEHOLDER, () => domain);
  }

  /** One query within the server's limits and the global one. */
  private query(server: string, query: string, signal?: AbortSignal): Promise<string> {
    const send = () => this.send(server, query, signal);
    return this.network.viaQueues(this.network.whoisHosts, server, send, signal);
  }

  /** A reply that only says "too many queries" is a failure: the server is left alone for a while, then asked again. */
  private async send(server: string, query: string, signal?: AbortSignal): Promise<string> {
    const reply = await this.transport(server, query, this.network.timeoutMs, signal);
    if (interpretWhois(reply) !== WhoisVerdict.RateLimited) return reply;
    throw new RetryableError(atHost(server, ErrorText.RateLimited), WHOIS_RATE_LIMIT_COOLDOWN_MS);
  }

  /** IANA knows the WHOIS server of every TLD; it is asked about the last label ("co.uk" -> "uk"). */
  private serverFor(tld: string): Promise<string | undefined> {
    const root = tld.split(LABEL_SEPARATOR).at(-1) ?? tld;
    return this.servers.get(root, () => this.askIana(root));
  }

  /** Shared by all lookups of the TLD, so it never uses a caller's cancel signal. */
  private async askIana(root: string): Promise<string | undefined> {
    const reply = await withRetry(() => this.query(IANA_WHOIS_HOST, root), Retry.whois);
    return IANA_REFERRAL.exec(reply)?.[1]?.toLowerCase();
  }
}
