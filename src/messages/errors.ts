import { EnvVar, MAX_LABEL_LENGTH } from '../constants.js';

/** Why an input entry was skipped. */
export const InvalidReason = {
  NotADomain: 'not a valid domain name',
  NoTlds: 'no TLD given and no TLDs to try',
  IpAddress: 'an IP address, not a domain',
  UnknownTld: 'unknown TLD',
  MissingName: 'missing name before the TLD',
  TooLong: `name is longer than ${MAX_LABEL_LENGTH} characters`,
  BadCharacters: 'only letters, digits and hyphens are allowed',
  EdgeHyphen: 'name cannot start or end with a hyphen',
  ReservedHyphens: 'hyphens in the 3rd and 4th positions are reserved',
} as const;

/** Error details recorded in the evidence. They never contain credentials. */
export const ErrorText = {
  RdapListUnavailable: 'RDAP server list unavailable',
  WhoisServerUnknown: 'cannot find the WHOIS server',
  WhoisUnreadable: 'could not interpret the WHOIS reply',
  UnexpectedReply: 'unexpected reply',
  RateLimited: 'rate limited',
  TimedOut: 'timed out',
  Cancelled: 'cancelled',
  RegistryTimeout: 'the registry did not answer in time',
  KeyRejected: 'API key rejected; check the key (and its permissions) in the MCP config',
} as const;

/** "HTTP 503" */
export const httpStatusText = (status: number): string => `HTTP ${status}`;

/** "rdap.verisign.com: HTTP 503" */
export const atHost = (host: string, message: string): string => `${host}: ${message}`;

/** "RDAP server list unavailable: <why>" */
export const becauseOf = (message: string, cause: string): string => `${message}: ${cause}`;

/** "fetch failed (ECONNRESET)" */
export const withCause = (message: string, cause: string): string => `${message} (${cause})`;

/** Why a whole call was rejected. */
export const RequestError = {
  NothingToCheck: 'Nothing to check: no valid domain names in the input.',
} as const;

/** The domain limit was exceeded after adding TLDs. */
export const tooManyDomainsText = (count: number, limit: number): string =>
  `Too many domains: ${count} after adding TLDs (limit ${limit}). ` +
  `Split the list into smaller batches, use fewer TLDs, or raise ${EnvVar.MaxDomains}.`;
