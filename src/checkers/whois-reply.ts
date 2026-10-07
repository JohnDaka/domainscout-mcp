/** What a free-form WHOIS reply says. */
export const WhoisVerdict = {
  Registered: 'registered',
  NotFound: 'not_found',
  Reserved: 'reserved',
  /** The server only says its query limit was hit. */
  RateLimited: 'rate_limited',
  /** No line in the reply gives an answer. */
  Unknown: 'unknown',
} as const;
export type WhoisVerdict = (typeof WhoisVerdict)[keyof typeof WhoisVerdict];

/** Lines that mean one verdict. */
interface WhoisRule {
  verdict: WhoisVerdict;
  patterns: readonly RegExp[];
}

/** Line flags: `^` matches at every line start, and case does not matter. */
const LINE_FLAGS = 'im';

/**
 * A registry states its answer at the start of a line ("Domain not found.", "Status: free"),
 * optionally after a comment marker ("%", "#", ">"). Matching only there keeps the long
 * terms-of-use paragraphs, which talk about throttling and missing data, from deciding anything.
 */
function atLineStart(body: string): RegExp {
  return new RegExp(String.raw`^[\s%#>*]*(?:${body})`, LINE_FLAGS);
}

/** The registry holds the name back. */
const RESERVED: readonly RegExp[] = [
  // "Status: reserved", "Domain status: blocked"
  atLineStart(String.raw`(domain )?status\s*:\s*(reserved|blocked|restricted|prohibited)\b`),
  // "This domain name is reserved", "Name is blocked"
  atLineStart(String.raw`(this )?(domain|name)( name)? (is )?(reserved|blocked|restricted)\b`),
  // "... reserved by the registry", anywhere in a line
  /\breserved (by|for) the registry\b/i,
  // "... is not available for registration", anywhere in a line
  /\bnot available for registration\b/i,
];

/** A creation date: the clearest sign of a registration, so it is checked before "not found" lines. */
const CREATED: readonly RegExp[] = [
  // "Creation Date: 2001-02-03", "created: …", "Registered on: …", "Registration Time: …"
  atLineStart(
    String.raw`(creation date|created( on)?|registered( on)?|registration (date|time)|domain registered|registered date)\s*:\s*\S`,
  ),
];

/** The registry does not know the name. */
const NOT_FOUND: readonly RegExp[] = [
  // Verisign "No match for", JPRS "No match!!"
  atLineStart(String.raw`no match\b`),
  // "NOT FOUND", Identity Digital "Domain not found."
  atLineStart(String.raw`(domain )?not found\b`),
  // "No data found", "No entries found", "No matching record"
  atLineStart(String.raw`no (data|entries|object|matching records?)( found)?\b`),
  // "No such domain"
  atLineStart(String.raw`no such domain\b`),
  // "The queried object does not exist"
  atLineStart(String.raw`(the queried )?(object|domain) does not exist\b`),
  // DENIC, EURid, .it: "Status: free", "Status: AVAILABLE"
  atLineStart(String.raw`(domain )?status\s*:\s*(free|available)\b`),
  // SIDN: "example.nl is free"
  atLineStart(String.raw`\S+ is free\b`),
  // Nominet: "This domain name has not been registered."
  atLineStart(String.raw`this domain( name)? has not been registered\b`),
  // SWITCH: "We do not have an entry in our database matching your query."
  atLineStart(String.raw`we do not have an entry in our database\b`),
  // "No information available about domain name … in the Registry"
  atLineStart(String.raw`no information available about domain name\b`),
  // "Domain name not known"
  atLineStart(String.raw`domain name not known\b`),
];

/** Other signs of a registration. */
const REGISTERED: readonly RegExp[] = [
  // "Registrar: Example Inc."
  atLineStart(String.raw`(registrar|sponsoring registrar|registrar name)\s*:\s*\S`),
  // "Name Server: ns1.example.com", "nserver: …"
  atLineStart(String.raw`(name ?servers?|nserver)\s*:\s*\S`),
  // "Status: active", "Domain Status: clientTransferProhibited", DENIC "Status: connect"
  atLineStart(String.raw`(domain )?status\s*:\s*(active|ok|registered|connect|client|server)`),
  // "Registry Expiry Date: …", "Expires on: …", "paid-till: …"
  atLineStart(
    String.raw`(registry expiry date|expir(y|ation) date|expires( on)?|paid-till)\s*:\s*\S`,
  ),
];

/** Phrases saying a limit was actually hit. Only consulted when the reply holds no answer at all. */
const RATE_LIMITED: readonly RegExp[] = [
  // "Query limit exceeded", "quota has been reached"
  /\b(limit|quota) (has been |was )?(exceeded|reached)\b/i,
  // "You have exceeded the maximum allowable number of queries"
  /\bexceeded (the |your )?(maximum|allowed|allowable|query|rate)\b/i,
  // "Too many queries"
  /\btoo many (queries|requests|connections)\b/i,
  // "Queries exceeded"
  /\b(queries|requests|lookups) (have been |were )?exceeded\b/i,
  // "Please try again later", "try again in 60 seconds"
  /\btry again (later|in \d)/i,
  // "Temporarily blocked", "temporarily denied"
  /\btemporarily (blocked|denied|unavailable)\b/i,
];

/**
 * The rules in the order they are tried; the first match decides. A definite answer line wins;
 * rate-limit wording counts only when there is none, because terms of use often describe
 * throttling. A rate-limit message can never turn into "not found": it carries no answer line,
 * and a wrong "available" is the worst possible result. (A list, not a Map: "registered" comes
 * twice, once before and once after "not found".)
 */
const RULES: readonly WhoisRule[] = [
  { verdict: WhoisVerdict.Reserved, patterns: RESERVED },
  { verdict: WhoisVerdict.Registered, patterns: CREATED },
  { verdict: WhoisVerdict.NotFound, patterns: NOT_FOUND },
  { verdict: WhoisVerdict.Registered, patterns: REGISTERED },
  { verdict: WhoisVerdict.RateLimited, patterns: RATE_LIMITED },
];

/** Reads a free-form WHOIS reply. */
export function interpretWhois(reply: string): WhoisVerdict {
  if (!reply.trim()) return WhoisVerdict.Unknown;
  const rule = RULES.find(({ patterns }) => patterns.some((pattern) => pattern.test(reply)));
  return rule?.verdict ?? WhoisVerdict.Unknown;
}
