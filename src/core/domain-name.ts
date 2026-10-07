import { domainToASCII, domainToUnicode } from 'node:url';
import { parse as parseDomain } from 'tldts';
import { LABEL_SEPARATOR, MAX_LABEL_LENGTH, PUNYCODE_PREFIX } from '../constants.js';
import { InvalidReason } from '../messages/index.js';

/** Separators between several names in one entry: whitespace, commas and semicolons. */
const ENTRY_SEPARATOR = /[\s,;]+/;
/** A URL scheme such as "https://". */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//;
/** Where the host part of a URL ends: the path, the query or the fragment. */
const HOST_END = /[/?#]/;
/** "user:password@" in front of a host. */
const USER_INFO = /^[^@]*@/;
/** ":8080" after a host. */
const PORT = /:\d*$/;
/** Dots at either end: ".com." -> "com". */
const EDGE_DOTS = /^\.+|\.+$/g;
/** Letters, digits and hyphen: the only characters allowed in a label (after punycode). */
const LDH = /^[a-z0-9-]+$/;
/** "--" in the 3rd and 4th positions is reserved for encodings such as punycode (RFC 5891). */
const RESERVED_HYPHENS = /^..--/;
/** A label may neither start nor end with this. */
const HYPHEN = '-';
/** Put in front of a TLD to ask the Public Suffix List about it. */
const TLD_PROBE_LABEL = 'example';
/** Only ICANN suffixes count: private ones such as "github.io" are not TLDs one can register under. */
export const ICANN_ONLY = { allowPrivateDomains: false } as const;

/** TLDs that were understood, and the entries that were not. */
export interface TldList {
  tlds: string[];
  unknown: string[];
}

/** Splits raw user input ("a.com, b\nc") into individual entries. */
export function splitEntries(raw: readonly string[]): string[] {
  return raw
    .flatMap((entry) => entry.split(ENTRY_SEPARATOR))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Normalizes ".AI", "Co.Uk." or a Unicode TLD to ASCII; undefined if it is not a real (ICANN) public suffix. */
export function normalizeTld(raw: string): string | undefined {
  const cleaned = raw.trim().toLowerCase().replace(EDGE_DOTS, '');
  const ascii = cleaned ? domainToASCII(cleaned) : '';
  if (!ascii) return undefined;
  const info = parseDomain(joinLabels(TLD_PROBE_LABEL, ascii), ICANN_ONLY);
  return info.isIcann && info.publicSuffix === ascii ? ascii : undefined;
}

/** Normalizes a list of TLDs, without duplicates, and collects the entries that are not TLDs. */
export function normalizeTlds(entries: readonly string[]): TldList {
  const tlds = new Set<string>();
  const unknown: string[] = [];
  for (const entry of entries) {
    const tld = normalizeTld(entry);
    if (tld) tlds.add(tld);
    else unknown.push(entry);
  }
  return { tlds: [...tlds], unknown };
}

/** "https://User@www.Ëxample.com:8080/path?q" -> "www.xn--xample-ova.com"; empty when it is not a host name. */
export function toAsciiHost(input: string): string {
  const withoutScheme = input.trim().toLowerCase().replace(URL_SCHEME, '');
  const authority = withoutScheme.split(HOST_END, 1)[0] ?? '';
  const host = authority.replace(USER_INFO, '').replace(PORT, '').replace(EDGE_DOTS, '');
  return host ? domainToASCII(host) : '';
}

/** The Unicode form of an ASCII domain, for people. */
export function toUnicode(domain: string): string {
  return domainToUnicode(domain) || domain;
}

/** "acme" + "com" -> "acme.com" */
export function joinLabels(...labels: string[]): string {
  return labels.join(LABEL_SEPARATOR);
}

/** Why a registrable label (the part right before the TLD) is not valid; undefined when it is. */
export function nameProblem(label: string): string | undefined {
  if (!label) return InvalidReason.MissingName;
  if (label.length > MAX_LABEL_LENGTH) return InvalidReason.TooLong;
  if (!LDH.test(label)) return InvalidReason.BadCharacters;
  if (label.startsWith(HYPHEN) || label.endsWith(HYPHEN)) return InvalidReason.EdgeHyphen;
  if (hasReservedHyphens(label)) return InvalidReason.ReservedHyphens;
  return undefined;
}

/** "ab--cd" is reserved; punycode ("xn--…") is the one allowed use. */
function hasReservedHyphens(label: string): boolean {
  return RESERVED_HYPHENS.test(label) && !label.startsWith(PUNYCODE_PREFIX);
}
