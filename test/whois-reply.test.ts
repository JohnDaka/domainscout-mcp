import { describe, expect, it } from 'vitest';
import { interpretWhois, WhoisVerdict } from '../src/checkers/whois-reply.js';

const VERISIGN_NO_MATCH = `No match for "QWZX-FREE-77341.COM".
>>> Last update of whois database: 2026-10-07T10:00:00Z <<<

NOTICE: The expiration date displayed in this record is the date the
registrar's sponsorship of the domain name registration in the registry is
currently set to expire.`;

const REGISTERED = `Domain Name: GOOGLE.COM
Registry Domain ID: 2138514_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.markmonitor.com
Creation Date: 1997-09-15T04:00:00Z
Registry Expiry Date: 2028-09-14T04:00:00Z
Registrar: MarkMonitor Inc.`;

describe('interpretWhois', () => {
  it.each([
    ["Verisign 'No match'", VERISIGN_NO_MATCH, WhoisVerdict.NotFound],
    ['a gTLD record', REGISTERED, WhoisVerdict.Registered],
    ['DENIC free', 'Domain: qwzx-free-77341.de\nStatus: free\n', WhoisVerdict.NotFound],
    [
      'DENIC registered',
      'Domain: google.de\nNserver: ns1.google.com\nStatus: connect\n',
      WhoisVerdict.Registered,
    ],
    ['tcinet not found', 'No entries found for the selected source(s).\n', WhoisVerdict.NotFound],
    ['reserved name', 'This domain is reserved by the registry.\n', WhoisVerdict.Reserved],
    [
      'Verisign limit',
      'Your connection limit exceeded. Please slow down and try again later.',
      WhoisVerdict.RateLimited,
    ],
    ['tcinet limit', 'You have exceeded allowed connection rate.', WhoisVerdict.RateLimited],
    ['queries exceeded', 'Number of allowed queries exceeded.', WhoisVerdict.RateLimited],
    ['empty reply', '  \r\n', WhoisVerdict.Unknown],
    ['unrelated text', 'Welcome to the WHOIS service.', WhoisVerdict.Unknown],
  ])('%s', (_name, reply, verdict) => {
    expect(interpretWhois(reply)).toBe(verdict);
  });

  it('does not mistake terms about rate limits for a hit limit', () => {
    const reply = `${VERISIGN_NO_MATCH}\nAccess is subject to query rate limits.`;
    expect(interpretWhois(reply)).toBe(WhoisVerdict.NotFound);
  });

  it("reads Identity Digital's 'not found' despite throttling talk in its terms (.io, .ai)", () => {
    // Shortened real reply from whois.nic.io, 2026-10-07.
    const reply = [
      'Domain not found.',
      '>>> Last update of WHOIS database: 2026-10-07T07:11:36Z <<<',
      '',
      'Terms of Use: Access to WHOIS information is provided to assist persons in determining the contents of a ' +
        'domain name registration record. Queries to the Whois services are throttled. If too many queries are ' +
        'received from a single IP address within a specified time, the service will begin to reject further queries.',
    ].join('\n');
    expect(interpretWhois(reply)).toBe(WhoisVerdict.NotFound);
  });

  it("does not take 'not found' inside the terms text as an answer", () => {
    const reply = 'Welcome.\nTerms: if the requested record is not found, contact the registrar.';
    expect(interpretWhois(reply)).toBe(WhoisVerdict.Unknown);
  });

  it("trusts a creation date over a stray 'not found'", () => {
    const reply = `${REGISTERED}\nReseller: not found`;
    expect(interpretWhois(reply)).toBe(WhoisVerdict.Registered);
  });

  it("never reads a rate-limit message as 'not found'", () => {
    const reply = 'Query limit exceeded. Object not found in cache, try again later.';
    expect(interpretWhois(reply)).toBe(WhoisVerdict.RateLimited);
  });
});
