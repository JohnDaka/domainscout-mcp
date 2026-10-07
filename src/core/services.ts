import type { Attempt, DnsLookup, PriceBookSnapshot, RdapLookup, WhoisLookup } from './types.js';

/** DNS lookups. */
export interface DnsService {
  /** The domain's NS records: only a registered domain can be delegated in the TLD zone. */
  lookupNs(domain: string): Promise<DnsLookup>;
  /** Whether the TLD answers for any name, which makes a DNS answer worthless. */
  hasWildcard(tld: string): Promise<boolean>;
}

/** Registry lookups over RDAP. */
export interface RdapService {
  lookup(domain: string, tld: string, signal?: AbortSignal): Promise<RdapLookup>;
}

/** Registry lookups over WHOIS. */
export interface WhoisService {
  lookup(domain: string, tld: string, signal?: AbortSignal): Promise<WhoisLookup>;
}

/** Public price lists. */
export interface PriceService {
  /** Fetches what is missing or stale for these TLDs. Never throws. */
  load(tlds: readonly string[]): Promise<void>;
  /** Prices known right now. */
  snapshot(): PriceBookSnapshot;
}

/** Confirmation through registrar APIs, with the user's own keys. */
export interface ConfirmService {
  /** The user has set at least one registrar API key. */
  readonly enabled: boolean;
  /** Every API's answers per domain. Never throws: failures become Error attempts. */
  confirm(domains: readonly string[], signal?: AbortSignal): Promise<Map<string, Attempt[]>>;
}

/** The lookups of the checking funnel; tests pass fakes, everything else gets the real ones. */
export interface CheckerServices {
  dns: DnsService;
  rdap: RdapService;
  whois: WhoisService;
}

/** Everything a scout talks to. */
export interface ScoutServices extends CheckerServices {
  prices: PriceService;
  confirmer: ConfirmService;
}
