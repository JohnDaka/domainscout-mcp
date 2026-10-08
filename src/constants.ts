/**
 * Fixed values and defaults, each with the reason for its value.
 * Users override the defaults through environment variables: see EnvVar and config/.
 */

// ── Units ───────────────────────────────────────────────────────────────────

/** One second in milliseconds. */
export const SECOND_MS = 1_000;
/** One minute in milliseconds. */
export const MINUTE_MS = 60 * SECOND_MS;
/** One hour in milliseconds. */
export const HOUR_MS = 60 * MINUTE_MS;
/** One day in milliseconds. */
export const DAY_MS = 24 * HOUR_MS;
/** One kibibyte in bytes. */
export const KIB = 1_024;

// ── Identity ────────────────────────────────────────────────────────────────

/**
 * The command the package installs (its bin; the npm package itself is @dakaio/domainscout-mcp).
 * Also the product name in the User-Agent header.
 */
export const COMMAND_NAME = 'domainscout-mcp';
/** Name the MCP server reports to clients. */
export const SERVER_NAME = 'domainscout';
/** Name people see for the server, where a client shows one (serverInfo.title). */
export const SERVER_TITLE = 'DomainScout';
/** The project's page, reported to clients as serverInfo.websiteUrl. */
export const WEBSITE_URL = 'https://domainscout.dakaio.com';

/** The server's icon in the package, relative to a module one folder below the package root. */
export const ICON_PATH = '../../assets/icon-128.png';
/** The same icon, larger, on the website: for clients that load icons by URL. */
export const ICON_URL = `${WEBSITE_URL}/icon-512.png`;
/** Image type of both icons. */
export const ICON_MIME_TYPE = 'image/png';
/** Size of the icon in the package. */
export const ICON_SIZE_PACKAGED = '128x128';
/** Size of the icon on the website. */
export const ICON_SIZE_WEBSITE = '512x512';
/** How the packaged icon is encoded into a data URI. */
export const ICON_ENCODING = 'base64';

// ── Results card (MCP Apps) ─────────────────────────────────────────────────

/** The results card's address, as hosts that support MCP Apps fetch it. */
export const RESULTS_UI_URI = 'ui://domainscout/results.html';
/** The resource's name in resources/list. */
export const RESULTS_UI_NAME = 'results-card';
/** The resource's title, where a host shows one. */
export const RESULTS_UI_TITLE = 'DomainScout results';
/** The type MCP Apps hosts look for: an HTML page that talks to the host. */
export const RESULTS_UI_MIME_TYPE = 'text/html;profile=mcp-app';
/** The card in the package, relative to a module one folder below the package root. */
export const RESULTS_UI_PATH = '../../ui/results.html';
/**
 * The key older MCP Apps hosts read for a tool's card. Current ones read `_meta.ui.resourceUri`;
 * the tool sends both.
 */
export const LEGACY_RESOURCE_URI_KEY = 'ui/resourceUri';

// ── Settings ────────────────────────────────────────────────────────────────

/** Environment variables a user can set in the MCP client config. */
export const EnvVar = {
  /** Comma-separated TLDs for names given without one. */
  Tlds: 'DOMAINSCOUT_TLDS',
  /** Network operations in flight at once. */
  MaxConcurrency: 'DOMAINSCOUT_MAX_CONCURRENCY',
  /** Requests in flight to one RDAP server. */
  PerHostConcurrency: 'DOMAINSCOUT_PER_HOST_CONCURRENCY',
  /** Timeout of one request, ms. */
  TimeoutMs: 'DOMAINSCOUT_TIMEOUT_MS',
  /** Domains per call, after adding TLDs. */
  MaxDomains: 'DOMAINSCOUT_MAX_DOMAINS',
  /** on/off: the DNS pre-check. */
  Dns: 'DOMAINSCOUT_DNS',
  /** Comma-separated DNS server addresses; the system resolver when empty. */
  DnsServers: 'DOMAINSCOUT_DNS_SERVERS',
  /** on/off: affiliate buy links. */
  Affiliate: 'DOMAINSCOUT_AFFILIATE',
  /** on/off: public price lists (the only requests that do not go to DNS or the registries). */
  Prices: 'DOMAINSCOUT_PRICES',
  /** Comma-separated registrar ids to show buy links for; all when empty. */
  Registrars: 'DOMAINSCOUT_REGISTRARS',
  /** Most free domains per call to confirm with registrar APIs. */
  ConfirmMax: 'DOMAINSCOUT_CONFIRM_MAX',
  /** Porkbun API key. The user's own keys only ever go to that registrar's API. */
  PorkbunApiKey: 'DOMAINSCOUT_PORKBUN_API_KEY',
  /** Porkbun secret API key. */
  PorkbunSecretKey: 'DOMAINSCOUT_PORKBUN_SECRET_KEY',
  /** Name.com account username. */
  NameComUsername: 'DOMAINSCOUT_NAMECOM_USERNAME',
  /** Name.com API token. */
  NameComToken: 'DOMAINSCOUT_NAMECOM_TOKEN',
  /** Spaceship API key. */
  SpaceshipApiKey: 'DOMAINSCOUT_SPACESHIP_API_KEY',
  /** Spaceship API secret. */
  SpaceshipApiSecret: 'DOMAINSCOUT_SPACESHIP_API_SECRET',
  /** Cloudflare account id. */
  CloudflareAccountId: 'DOMAINSCOUT_CLOUDFLARE_ACCOUNT_ID',
  /** Cloudflare API token with Registrar permission. */
  CloudflareApiToken: 'DOMAINSCOUT_CLOUDFLARE_API_TOKEN',
} as const;
export type EnvVar = (typeof EnvVar)[keyof typeof EnvVar];

/** TLDs tried for names given without one. */
export const DEFAULT_TLDS: readonly string[] = ['com', 'net', 'ai'];

/** A numeric setting: the value used when the variable is not set, and the accepted range. */
export interface NumericSetting {
  /** Used when the variable is not set or not valid. */
  readonly fallback: number;
  /** Smallest accepted value. */
  readonly min: number;
  /** Largest accepted value. */
  readonly max: number;
}

/** Numeric settings and their ranges. */
export const Setting = {
  /**
   * Network operations in flight at once, all hosts together. The work waits on the
   * network, not the CPU, so this mostly keeps the connection and remote servers comfortable.
   */
  maxConcurrency: { fallback: 10, min: 1, max: 100 },
  /** Requests in flight to one RDAP server. Registries rate-limit per client IP. */
  perHostConcurrency: { fallback: 2, min: 1, max: 10 },
  /** Timeout of one network request, ms. */
  timeoutMs: { fallback: 10_000, min: 1_000, max: 120_000 },
  /** Domains per call after adding TLDs: a whole AI brainstorm, without running for many minutes. */
  maxDomains: { fallback: 500, min: 1, max: 10_000 },
  /**
   * Free domains per call confirmed with registrar APIs. Protects the user's API quota:
   * Porkbun, for one, slows down accounts that check many names without registering any.
   */
  confirmMax: { fallback: 50, min: 1, max: 500 },
} as const satisfies Record<string, NumericSetting>;

/** How on/off settings may be written in environment variables, and what each spelling means. */
export const FLAG_VALUES: ReadonlyMap<string, boolean> = new Map<string, boolean>()
  .set('1', true)
  .set('true', true)
  .set('on', true)
  .set('yes', true)
  .set('0', false)
  .set('false', false)
  .set('off', false)
  .set('no', false);

/** The DNS pre-check is on unless turned off: it is free and spares registry rate limits. */
export const DNS_PRECHECK_DEFAULT = true;
/** Affiliate links are on unless turned off; they never change which registrars are shown or their order. */
export const AFFILIATE_LINKS_DEFAULT = true;
/** Prices are on unless turned off; turning them off leaves only DNS and registry traffic. */
export const PRICES_DEFAULT = true;

/** Encoding of text files we read (package.json). */
export const FILE_ENCODING = 'utf8';
/** package.json, relative to a module one folder below the package root (src/x or dist/x). */
export const PACKAGE_JSON_PATH = '../../package.json';

// ── Network limits ──────────────────────────────────────────────────────────

/** Most RDAP requests started per second against one server (sliding window). */
export const RDAP_REQUESTS_PER_SECOND = 5;
/** WHOIS servers block aggressive clients quickly: one query at a time per server… */
export const WHOIS_PER_HOST_CONCURRENCY = 1;
/** …and at most one query per second. */
export const WHOIS_REQUESTS_PER_SECOND = 1;
/** How long a WHOIS server is left alone after it says its limit was hit. */
export const WHOIS_RATE_LIMIT_COOLDOWN_MS = 10_000;
/** Pause after HTTP 429 when the server sends no Retry-After header. */
export const DEFAULT_RETRY_AFTER_MS = 5_000;

/**
 * Queue priorities (higher runs first). A domain that has passed DNS goes ahead of
 * new DNS lookups, so results arrive steadily instead of all at the end.
 */
export const Priority = { Dns: 0, Registry: 1 } as const;

/** Retries after the first attempt, and the bounds of the exponential backoff between them (ms). */
export interface RetryPolicy {
  /** Attempts after the first one. */
  readonly retries: number;
  /** Delay before the first retry. */
  readonly baseDelayMs: number;
  /** Longest delay between two attempts. */
  readonly maxDelayMs: number;
}

/** Retry policies by kind of request. */
export const Retry = {
  /** Domain lookups over RDAP. */
  rdap: { retries: 2, baseDelayMs: 1_000, maxDelayMs: 10_000 },
  /** The IANA list of RDAP servers. */
  bootstrap: { retries: 2, baseDelayMs: 1_000, maxDelayMs: 5_000 },
  /** WHOIS queries: slower backoff, WHOIS limits are stricter. */
  whois: { retries: 2, baseDelayMs: 2_000, maxDelayMs: 15_000 },
  /** Public price lists: optional, so one quick retry is enough. */
  prices: { retries: 1, baseDelayMs: 1_000, maxDelayMs: 3_000 },
  /** Registrar APIs: their quotas are the user's, so retry once and patiently. */
  confirm: { retries: 1, baseDelayMs: 2_000, maxDelayMs: 30_000 },
} as const satisfies Record<string, RetryPolicy>;

/** Each retry waits this many times longer than the previous one. */
export const BACKOFF_FACTOR = 2;
/** Share of each backoff delay that is random, so parallel retries do not hit a server at once. */
export const BACKOFF_JITTER = 0.5;

// ── HTTP ────────────────────────────────────────────────────────────────────

/** HTTP status codes this package reacts to. */
export const HttpStatus = {
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  FirstServerError: 500,
} as const;

/** HTTP header names. */
export const Header = {
  Accept: 'accept',
  Authorization: 'authorization',
  ContentType: 'content-type',
  UserAgent: 'user-agent',
  RetryAfter: 'retry-after',
} as const;

/** HTTP methods used by the package. */
export const HttpMethod = { Get: 'GET', Post: 'POST' } as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/** The JSON media type, sent as Accept and Content-Type. */
export const JSON_CONTENT_TYPE = 'application/json';
/** JSON and its "+json" variants such as application/problem+json. */
export const JSON_MEDIA_TYPE = /^application\/([\w.-]+\+)?json\b/i;
/** The URL protocol RDAP servers are preferred with. */
export const HTTPS_PROTOCOL = 'https:';

// ── DNS ─────────────────────────────────────────────────────────────────────

/** Upper bound for one DNS attempt. DNS answers in well under a second; the HTTP timeout would be far too long. */
export const DNS_MAX_TIMEOUT_MS = 5_000;
/** Attempts per DNS query. */
export const DNS_TRIES = 2;
/** Random bytes in the probe name that detects wildcard TLDs: 24 hex characters, well under the label limit. */
export const WILDCARD_PROBE_BYTES = 12;
/** How the probe's random bytes are written. */
export const WILDCARD_PROBE_ENCODING = 'hex';
/** Nameservers kept in the evidence of a "taken" verdict. */
export const EVIDENCE_MAX_NAMESERVERS = 3;

// ── RDAP ────────────────────────────────────────────────────────────────────

/** IANA's list of RDAP servers per TLD (RFC 9224). */
export const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
/** How long the RDAP server list is reused; IANA changes it rarely. */
export const RDAP_BOOTSTRAP_TTL_MS = DAY_MS;
/** Accept header for RDAP requests (RFC 7480). */
export const RDAP_ACCEPT = 'application/rdap+json, application/json;q=0.9';
/** Domain lookup path, relative to a server's base URL (RFC 9082). */
export const RDAP_DOMAIN_PATH = 'domain/';
/** RDAP event actions (RFC 9083). */
export const RdapEvent = { Registration: 'registration', Expiration: 'expiration' } as const;
/** RDAP statuses of a domain on its way to deletion (EPP statuses as mapped by RFC 8056). */
export const RDAP_DROPPING_STATUSES: ReadonlySet<string> = new Set([
  'redemption period',
  'pending delete',
  'pending restore',
]);

// ── WHOIS ───────────────────────────────────────────────────────────────────

/** The WHOIS port (RFC 3912). */
export const WHOIS_PORT = 43;
/** Every WHOIS query ends with CR LF (RFC 3912). */
export const WHOIS_LINE_END = '\r\n';
/** How WHOIS replies are decoded. */
export const WHOIS_ENCODING = 'utf8';
/** IANA's WHOIS server, which names the WHOIS server of every TLD. */
export const IANA_WHOIS_HOST = 'whois.iana.org';
/** WHOIS replies are a few KiB; anything longer than this many KiB is cut off. */
const WHOIS_MAX_REPLY_KIB = 256;
/** The same limit in bytes. */
export const WHOIS_MAX_REPLY_BYTES = WHOIS_MAX_REPLY_KIB * KIB;

// ── Domain name syntax (RFC 1035, RFC 5891) ─────────────────────────────────

/** Longest allowed label, e.g. "example" in example.com. */
export const MAX_LABEL_LENGTH = 63;
/** Prefix of punycode (internationalized) labels. */
export const PUNYCODE_PREFIX = 'xn--';
/** Separates the labels of a domain name. */
export const LABEL_SEPARATOR = '.';

// ── Prices ──────────────────────────────────────────────────────────────────

/** Porkbun's public price list: every TLD, no API key (Porkbun API v3). */
export const PORKBUN_PRICING_URL = 'https://api.porkbun.com/api/json/v3/pricing/get';
/** `status` of a successful Porkbun API reply. */
export const PORKBUN_STATUS_SUCCESS = 'SUCCESS';
/** Query parameter that limits Porkbun's price list to some TLDs… */
export const PORKBUN_TLDS_PARAM = 'tlds';
/** …given as a comma-separated list. */
export const PORKBUN_TLDS_SEPARATOR = ',';
/**
 * Cloudflare sells at cost but has no public price API. cfdomainpricing.com is an
 * MIT-licensed community mirror of the prices on Cloudflare's own search page.
 */
export const CLOUDFLARE_PRICES_URL = 'https://cfdomainpricing.com/prices.json';
/** Price lists change rarely: reused for a day. */
export const PRICE_LIST_TTL_MS = DAY_MS;
/** After the checks finish, how long to wait for prices still loading. Late prices are cached for the next call. */
export const PRICE_GRACE_MS = 2_000;
/** Both price sources quote US dollars. */
export const PRICE_CURRENCY = 'USD';
/** Locale prices are written in. */
export const PRICE_LOCALE = 'en-US';
/** Term assumed when a TLD has no special minimum. */
export const DEFAULT_MIN_YEARS = 1;
/** Minimum registration term in years where a registry requires more than one. */
export const MIN_REGISTRATION_YEARS: ReadonlyMap<string, number> = new Map<string, number>()
  // .ai: registration and renewal are sold in 2-year minimums (Cloudflare, Dynadot, Name.com).
  .set('ai', 2);

// ── MCP ─────────────────────────────────────────────────────────────────────

/** Name of the one tool the server offers. */
export const TOOL_CHECK_DOMAINS = 'check_domains';
/** MCP notification that reports progress. */
export const MCP_PROGRESS_METHOD = 'notifications/progress';
/** Content block types of a tool result. */
export const McpContentType = { Text: 'text' } as const;
/** Entries accepted in one call before TLDs are added; the domain limit applies after. */
export const MAX_INPUT_ENTRIES = 1_000;

// ── Output ──────────────────────────────────────────────────────────────────

/** Separators of the text output. */
export const TextSeparator = {
  /** Between items of a list on one line. */
  List: ', ',
  /** Between lines. */
  Line: '\n',
  /** Between error descriptions. */
  Error: '; ',
  /** Between sections: an empty line. */
  Section: '\n\n',
} as const;
/** Decimals of the elapsed time in the report summary. */
export const ELAPSED_SECONDS_DECIMALS = 1;
/** Length of an ISO date, which is how expiry dates are shown. */
export const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;
/** Indentation of printed JSON. */
export const JSON_INDENT = 2;
/**
 * With more free domains than this, the text report gives each one line with its cheapest offer
 * instead of every registrar's link. A brainstorm of 500 names can leave a hundred free ones, and
 * ten links each would bury the answer; every link is still in the structured result.
 */
export const FULL_LINKS_MAX_DOMAINS = 5;
/**
 * With more taken domains than this, the TAKEN line lists the names only (still marking the
 * ones being deleted): expiry dates for hundreds of names would only cost the model tokens.
 */
export const TAKEN_DATES_MAX_DOMAINS = 20;
/**
 * Lists of names (TAKEN, RESERVED) wrap onto more lines at this width, so a long list reads well
 * in a terminal, in a chat and on a web page instead of running off to the side.
 */
export const REPORT_LINE_WIDTH = 100;
/** Indentation of a list's continuation lines. */
export const CONTINUATION_INDENT = '  ';
/** Ends every item of a wrapped list but the last. */
export const LIST_ITEM_END = ',';

// ── CLI ─────────────────────────────────────────────────────────────────────

/** process.argv[0] is node and [1] is this script: user arguments start here. */
export const ARGV_FIRST_USER_ARG = 2;
/** CLI commands. Without one, the package runs as an MCP server. */
export const CliCommand = {
  /** Run as an MCP server over stdio. */
  Serve: 'serve',
  /** Check names from the command line. */
  Check: 'check',
} as const;
/** CLI options. */
export const CliFlag = {
  Json: '--json',
  NoConfirm: '--no-confirm',
  Tlds: '--tlds',
  TldsShort: '-t',
  Help: '--help',
  HelpShort: '-h',
  Version: '--version',
  VersionShort: '-v',
} as const;
/** Prefix shared by every CLI option. */
export const CLI_OPTION_PREFIX = '-';
/** Separates a long option from its value: --tlds=com,net */
export const CLI_VALUE_SEPARATOR = '=';
/** Moves the cursor to the line start and clears the line, for the progress indicator. */
export const ANSI_CLEAR_LINE = '\r\x1b[K';
/** Process exit codes. */
export const ExitCode = { Ok: 0, Failed: 1, Usage: 2 } as const;
