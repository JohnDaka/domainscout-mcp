import { describe, expect, it } from 'vitest';
import { RdapChecker } from '../src/checkers/rdap.js';
import { Network } from '../src/core/network.js';
import { LookupState } from '../src/core/types.js';
import { testConfig } from './fakes.js';
import { byPrefix, json, mockFetch } from './http-mock.js';

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

/** A trimmed IANA bootstrap file (RFC 9224): [TLDs, base URLs] pairs. */
const BOOTSTRAP = {
  services: [
    [['com', 'net'], ['https://rdap.test/v1/']],
    [['uk'], ['http://plain.test/', 'https://rdap-uk.test/rdap']],
    [['co.uk'], ['https://rdap-couk.test/']],
  ],
};

const REGISTERED = {
  objectClassName: 'domain',
  ldhName: 'ACME.COM',
  status: ['active', 'client transfer prohibited'],
  events: [
    { eventAction: 'registration', eventDate: '2001-02-03T04:05:06Z' },
    { eventAction: 'expiration', eventDate: '2030-02-03T04:05:06Z' },
  ],
};

const checker = () => new RdapChecker(new Network(testConfig()));

describe('RdapChecker', () => {
  it('reads a registered domain: statuses, creation and expiry', async () => {
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/v1/domain/acme.com': () => json(REGISTERED),
      }),
    );
    expect(await checker().lookup('acme.com', 'com')).toMatchObject({
      state: LookupState.Registered,
      server: 'rdap.test',
      statuses: REGISTERED.status,
      created: '2001-02-03T04:05:06Z',
      expires: '2030-02-03T04:05:06Z',
    });
  });

  it('treats 404 as not found', async () => {
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/': () => json({ errorCode: 404 }, 404),
      }),
    );
    expect((await checker().lookup('free.net', 'net')).state).toBe(LookupState.NotFound);
  });

  it('says unsupported for a TLD without RDAP', async () => {
    mockFetch(byPrefix({ [BOOTSTRAP_URL]: () => json(BOOTSTRAP) }));
    expect(await checker().lookup('acme.io', 'io')).toEqual({ state: LookupState.Unsupported });
  });

  it('uses the longest matching TLD, prefers https and fixes a missing trailing slash', async () => {
    const calls = mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap-couk.test/': () => json(REGISTERED),
        'https://rdap-uk.test/': () => json(REGISTERED),
      }),
    );
    const rdap = checker();
    await rdap.lookup('acme.co.uk', 'co.uk');
    await rdap.lookup('acme.uk', 'uk');
    expect(calls.map((call) => call.url)).toEqual([
      BOOTSTRAP_URL,
      'https://rdap-couk.test/domain/acme.co.uk',
      'https://rdap-uk.test/rdap/domain/acme.uk',
    ]);
  });

  it('loads the server list once and reuses it', async () => {
    const calls = mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/': () => json({}, 404),
      }),
    );
    const rdap = checker();
    await rdap.lookup('a.com', 'com');
    await rdap.lookup('b.com', 'com');
    expect(calls.filter((call) => call.url === BOOTSTRAP_URL)).toHaveLength(1);
  });

  it('reports a broken server list, then tries to load it again', async () => {
    let bootstrapUp = false;
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => (bootstrapUp ? json(BOOTSTRAP) : json({}, 404)),
        'https://rdap.test/': () => json({}, 404),
      }),
    );
    const rdap = checker();
    const failed = await rdap.lookup('a.com', 'com');
    expect(failed.state).toBe(LookupState.Error);
    expect(failed.state === LookupState.Error && failed.error).toContain(
      'RDAP server list unavailable',
    );
    bootstrapUp = true;
    expect((await rdap.lookup('a.com', 'com')).state).toBe(LookupState.NotFound);
  });

  it('returns an error for a non-retryable HTTP status', async () => {
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/': () => json({}, 400),
      }),
    );
    expect(await checker().lookup('a.com', 'com')).toMatchObject({
      state: LookupState.Error,
      error: 'HTTP 400',
    });
  });

  it('waits out a 429 and retries', async () => {
    let calls = 0;
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/': () => {
          calls++;
          return calls === 1 ? json({}, 429, { 'retry-after': '0' }) : json(REGISTERED);
        },
      }),
    );
    expect((await checker().lookup('acme.com', 'com')).state).toBe(LookupState.Registered);
    expect(calls).toBe(2);
  });

  it('gives up after repeated server errors', async () => {
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/': () => json({}, 503),
      }),
    );
    const result = await checker().lookup('a.com', 'com');
    expect(result).toMatchObject({ state: LookupState.Error, server: 'rdap.test' });
  }, 30_000);

  it('stops when the caller cancels', async () => {
    mockFetch(
      byPrefix({
        [BOOTSTRAP_URL]: () => json(BOOTSTRAP),
        'https://rdap.test/': () => json(REGISTERED),
      }),
    );
    const controller = new AbortController();
    controller.abort();
    expect((await checker().lookup('a.com', 'com', controller.signal)).state).toBe(
      LookupState.Error,
    );
  });
});
