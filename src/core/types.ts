/** The values of a const object, for enum-like objects: `type Kind = ValueOf<typeof Kind>`. */
type ValueOf<T> = T[keyof T];

// ── Statuses ────────────────────────────────────────────────────────────────

/** The verdict about one domain. */
export const DomainStatus = {
  /** Free, confirmed by a registrar API. */
  Available: 'available',
  /** Not in the registry or DNS. Premium or reserved names are not ruled out. */
  LikelyAvailable: 'likely_available',
  /** Registered. */
  Taken: 'taken',
  /** Blocked or reserved by the registry. */
  Reserved: 'reserved',
  /** Could not be verified: rate limit, timeout, or no lookup service for the TLD. */
  Unknown: 'unknown',
} as const;
export type DomainStatus = ValueOf<typeof DomainStatus>;

/** Where a piece of evidence comes from. */
export const EvidenceSource = {
  Dns: 'dns',
  Rdap: 'rdap',
  Whois: 'whois',
  Registrar: 'registrar',
} as const;
export type EvidenceSource = ValueOf<typeof EvidenceSource>;

/** Registrars the scout links to, prices and (with the user's keys) confirms with. */
export const RegistrarId = {
  Cloudflare: 'cloudflare',
  Porkbun: 'porkbun',
  Namecheap: 'namecheap',
  GoDaddy: 'godaddy',
  Spaceship: 'spaceship',
  NameCom: 'namecom',
  Dynadot: 'dynadot',
  NameSilo: 'namesilo',
  Hover: 'hover',
} as const;
export type RegistrarId = ValueOf<typeof RegistrarId>;

/** What a registrar's own API says about a domain. */
export const ConfirmState = {
  Available: 'available',
  Unavailable: 'unavailable',
  /** This registrar cannot answer for the domain, e.g. it does not sell the TLD. */
  Unsupported: 'unsupported',
  Error: 'error',
} as const;
export type ConfirmState = ValueOf<typeof ConfirmState>;

/**
 * What DNS says about a name. Only `Delegated` is conclusive (registered):
 * `NxDomain` does NOT prove availability, a bought but unused domain has no DNS either.
 */
export const DnsState = {
  Delegated: 'delegated',
  NxDomain: 'nxdomain',
  NoData: 'nodata',
  Error: 'error',
} as const;
export type DnsState = ValueOf<typeof DnsState>;

/** Outcome of a registry lookup over RDAP or WHOIS. */
export const LookupState = {
  Registered: 'registered',
  NotFound: 'not_found',
  Reserved: 'reserved',
  /** The TLD has no service of this kind. */
  Unsupported: 'unsupported',
  Error: 'error',
} as const;
export type LookupState = ValueOf<typeof LookupState>;

/** How a promise passed to Promise.allSettled ended. */
export const SettledStatus = { Fulfilled: 'fulfilled', Rejected: 'rejected' } as const;

// ── Input ───────────────────────────────────────────────────────────────────

/** One domain to check, and the entry it came from. */
export interface Target {
  /** The entry the user typed. */
  input: string;
  /** Registrable domain in ASCII (punycode) form. */
  domain: string;
  /** The domain in Unicode form, for people. */
  display: string;
  /** Public suffix in ASCII form, e.g. "com" or "co.uk". */
  tld: string;
}

/** An entry that was skipped, and why. */
export interface InvalidEntry {
  input: string;
  reason: string;
}

/** Domains to check and the entries that were skipped. */
export interface ParseResult {
  targets: Target[];
  invalid: InvalidEntry[];
}

// ── Lookups ─────────────────────────────────────────────────────────────────

/** A DNS NS lookup. */
export interface DnsLookup {
  state: DnsState;
  /** The domain's nameservers, when it is delegated. */
  nameservers?: string[];
  /** Why the lookup failed. */
  error?: string;
  /** How long it took. */
  ms: number;
}

/** RDAP found the domain. */
export interface RegisteredRdapLookup {
  state: typeof LookupState.Registered;
  /** Host of the RDAP server. */
  server: string;
  /** RDAP statuses, e.g. "active" or "pending delete". */
  statuses: string[];
  /** Registration date, ISO 8601. */
  created?: string;
  /** Expiry date, ISO 8601. */
  expires?: string;
  ms: number;
}

/** A lookup that reached no service: the TLD has none of this kind. */
export interface UnsupportedLookup {
  state: typeof LookupState.Unsupported;
}

/** A lookup that failed. */
export interface FailedLookup {
  state: typeof LookupState.Error;
  /** The server, when the failure happened after finding it. */
  server?: string;
  error: string;
  ms: number;
}

/** A registry lookup over RDAP. */
export type RdapLookup =
  | RegisteredRdapLookup
  | { state: typeof LookupState.NotFound; server: string; ms: number }
  | UnsupportedLookup
  | FailedLookup;

/** The lookup states that answer the question. */
export type RegistryAnswer =
  | typeof LookupState.Registered
  | typeof LookupState.NotFound
  | typeof LookupState.Reserved;

/** A registry lookup over WHOIS. */
export type WhoisLookup =
  | { state: RegistryAnswer; server: string; ms: number }
  | UnsupportedLookup
  | FailedLookup;

/** An RDAP lookup that reached a server (or failed trying), as recorded in the evidence. */
export type AnsweredRdapLookup = Exclude<RdapLookup, UnsupportedLookup>;
/** A WHOIS lookup that reached a server (or failed trying), as recorded in the evidence. */
export type AnsweredWhoisLookup = Exclude<WhoisLookup, UnsupportedLookup>;

// ── Prices ──────────────────────────────────────────────────────────────────

/** Standard price of a TLD at one registrar. Premium names cost more; the registrar's page has the final price. */
export interface Price {
  /** First-year price per year (may be a promo). */
  registration: number;
  /** Renewal price per year. */
  renewal: number;
  currency: string;
  /** Shortest allowed term in years, e.g. 2 for .ai. */
  minYears: number;
  /** Where the numbers come from. */
  source: string;
  /** When the source last updated them (YYYY-MM-DD), if it says. */
  updated?: string;
  /** The exact price of one domain from a registrar API, not a list price for the TLD. */
  confirmed?: boolean;
}

/** Prices per ASCII TLD for one registrar. */
export type PriceList = ReadonlyMap<string, Price>;
/** Price lists per registrar. */
export type PriceBookSnapshot = ReadonlyMap<RegistrarId, PriceList>;

/** The exact price of one domain, and the registrar that quoted it. */
export interface ExactPrice {
  registrar: RegistrarId;
  price: Price;
}

// ── Registrar confirmation ──────────────────────────────────────────────────

/** What a registrar says about a domain. */
export interface RegistrarAnswer {
  state: ConfirmState;
  /** Known only when the API says so. */
  premium?: boolean;
  /** Exact price of this domain at this registrar. */
  price?: Price;
  /** Why there is no definite answer. Never contains credentials. */
  detail?: string;
}

/** One registrar's answer about one domain. */
export interface Confirmation extends RegistrarAnswer {
  /** ASCII, lower case. */
  domain: string;
}

/** One API's answer about one domain, with who answered and how long the request took. */
export interface Attempt extends Confirmation {
  registrar: RegistrarId;
  ms: number;
}

// ── Results ─────────────────────────────────────────────────────────────────

/** What a source said: a DNS, registry or registrar state. */
export type EvidenceResult = DnsState | LookupState | ConfirmState;

/** One piece of evidence behind a verdict: which source was asked and what it said. */
export interface Evidence {
  source: EvidenceSource;
  result: EvidenceResult;
  server?: string;
  detail?: string;
  ms?: number;
}

/** What the registry says about a registered domain. */
export interface Registration {
  created?: string;
  expires?: string;
  statuses?: string[];
  /** In the deletion cycle (redemption / pending delete): may become available soon. */
  dropping?: boolean;
}

/** The part of a result that the checks decide. */
export interface Verdict {
  status: DomainStatus;
  note?: string;
  /** Premium name, sold above the standard price; known only from a registrar API. */
  premium?: boolean;
  registration?: Registration;
}

/** Where to buy a free domain. */
export interface BuyLink {
  /** The registrar's name. */
  registrar: string;
  url: string;
  /** The link earns the project a commission. */
  affiliate: boolean;
  /** Standard price for the TLD, or the exact price for the name when a registrar API confirmed it. */
  price?: Price;
}

/** Everything known about one domain, except the evidence behind it. */
export interface DomainAnswer extends Verdict {
  /** ASCII (punycode) form, e.g. "xn--xample-ova.com". */
  domain: string;
  /** Unicode form for people, e.g. "ëxample.com". */
  display: string;
  /** The entry the user typed that produced this domain. */
  input: string;
  /** Public suffix in ASCII form, e.g. "com" or "co.uk". */
  tld: string;
  /** The registrar whose API confirmed the status (needs the user's API key). */
  confirmedBy?: string;
  /** Free domains only: where to buy, cheapest first. */
  buy?: BuyLink[];
}

/** Everything known about one domain. */
export interface DomainResult extends DomainAnswer {
  /** Which sources were asked, and what each said. */
  evidence: Evidence[];
}

// ── Checks ──────────────────────────────────────────────────────────────────

/** One finished domain, reported while the others are still being checked. */
export interface CheckProgress {
  done: number;
  total: number;
  result: DomainResult;
}

/** Called once per finished domain. */
export type ProgressListener = (progress: CheckProgress) => void;

/** How a check runs. */
export interface CheckOptions {
  /** Cancels the check. */
  signal?: AbortSignal;
  onProgress?: ProgressListener;
}

/** One call: the names to check and how. */
export interface CheckRequest {
  domains: string[];
  /** TLDs for names given without one; the configured defaults when empty. */
  tlds?: string[];
  /** Confirm free domains with registrar APIs when the user has set keys. On unless false. */
  confirm?: boolean;
}

/** The answer to one call. */
export interface Report {
  results: DomainResult[];
  invalid: InvalidEntry[];
  /** TLDs that were used for names without one. */
  tlds: string[];
  /** Things the user should know about this call as a whole, e.g. a rejected API key. */
  warnings: string[];
  elapsedMs: number;
}

/** A finished call, or why the call was rejected. */
export type CheckOutcome =
  | { ok: true; report: Report }
  | { ok: false; message: string; invalid: InvalidEntry[] };
