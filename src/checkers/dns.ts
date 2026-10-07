import { randomBytes } from 'node:crypto';
import { NODATA, NOTFOUND } from 'node:dns';
import { Resolver } from 'node:dns/promises';
import {
  DNS_MAX_TIMEOUT_MS,
  DNS_TRIES,
  WILDCARD_PROBE_BYTES,
  WILDCARD_PROBE_ENCODING,
} from '../constants.js';
import { joinLabels } from '../core/domain-name.js';
import { PromiseCache } from '../core/promise-cache.js';
import type { DnsService } from '../core/services.js';
import { type DnsLookup, DnsState } from '../core/types.js';

/** DNS error codes that are answers, not failures. */
const ANSWER_CODES: ReadonlyMap<string, DnsState> = new Map<string, DnsState>()
  // The name does not exist in the zone.
  .set(NOTFOUND, DnsState.NxDomain)
  // The name exists but has no NS records.
  .set(NODATA, DnsState.NoData);

/** NS lookups through the system resolver, or the DNS servers the user configured. */
export class DnsChecker implements DnsService {
  private readonly resolver: Resolver;
  /** Whether each TLD is a wildcard TLD; asked once per TLD. */
  private readonly wildcards = new PromiseCache<string, boolean>();

  constructor(servers: readonly string[], timeoutMs: number) {
    this.resolver = new Resolver({
      timeout: Math.min(timeoutMs, DNS_MAX_TIMEOUT_MS),
      tries: DNS_TRIES,
    });
    if (servers.length > 0) this.resolver.setServers(servers);
  }

  /** Asks for the domain's nameservers: only a registered domain can be delegated in the TLD zone. */
  async lookupNs(domain: string): Promise<DnsLookup> {
    const started = Date.now();
    try {
      const nameservers = await this.resolver.resolveNs(domain);
      const state = nameservers.length > 0 ? DnsState.Delegated : DnsState.NoData;
      return { state, nameservers, ms: Date.now() - started };
    } catch (error) {
      return this.failedLookup(error, Date.now() - started);
    }
  }

  /** A few TLDs answer for any name (wildcard); for them a DNS answer proves nothing. */
  hasWildcard(tld: string): Promise<boolean> {
    return this.wildcards.get(tld, () => this.probeWildcard(tld));
  }

  /** Looks up a random name that nobody has registered: a delegation means the TLD answers for anything. */
  private async probeWildcard(tld: string): Promise<boolean> {
    const probe = randomBytes(WILDCARD_PROBE_BYTES).toString(WILDCARD_PROBE_ENCODING);
    const lookup = await this.lookupNs(joinLabels(probe, tld));
    return lookup.state === DnsState.Delegated;
  }

  /** "Does not exist" and "no NS records" are answers; anything else is a failure. */
  private failedLookup(error: unknown, ms: number): DnsLookup {
    const code = (error as NodeJS.ErrnoException).code;
    const state = code === undefined ? undefined : ANSWER_CODES.get(code);
    if (state) return { state, ms };
    return { state: DnsState.Error, error: code ?? String(error), ms };
  }
}
