import { describe, expect, it, vi } from 'vitest';
import { DomainChecker } from '../src/core/checker.js';
import {
  type DnsLookup,
  DnsState,
  DomainStatus,
  type FailedLookup,
  LookupState,
  type RegisteredRdapLookup,
} from '../src/core/types.js';
import { Note, noLookupServiceNote } from '../src/messages/index.js';
import { fakeServices, target, testConfig } from './fakes.js';

const DELEGATED: DnsLookup = { state: DnsState.Delegated, nameservers: ['ns1.test'], ms: 1 };
const REGISTERED: RegisteredRdapLookup = {
  state: LookupState.Registered,
  server: 'rdap.test',
  statuses: ['active'],
  ms: 1,
};
const RDAP_ERROR: FailedLookup = {
  state: LookupState.Error,
  server: 'rdap.test',
  error: 'HTTP 503',
  ms: 1,
};
const WHOIS_ERROR: FailedLookup = {
  state: LookupState.Error,
  server: 'whois.test',
  error: 'timed out',
  ms: 1,
};

const check = async (lookups: Parameters<typeof fakeServices>[0], domain = 'acme.com') => {
  const { services, calls } = fakeServices(lookups);
  const result = await new DomainChecker(testConfig(), services).check(target(domain));
  return { result, calls };
};

describe('DomainChecker funnel', () => {
  it('treats a DNS delegation as taken without asking the registry', async () => {
    const { result, calls } = await check({ dns: DELEGATED });
    expect(result.status).toBe(DomainStatus.Taken);
    expect(calls).toMatchObject({ dns: 1, rdap: 0, whois: 0 });
  });

  it('ignores DNS delegation on wildcard TLDs and asks the registry', async () => {
    const { result, calls } = await check({ dns: DELEGATED, wildcard: true });
    expect(result.status).toBe(DomainStatus.LikelyAvailable);
    expect(calls.rdap).toBe(1);
  });

  it("reports 'not in the registry' as likely available, never as confirmed", async () => {
    const { result } = await check({});
    expect(result.status).toBe(DomainStatus.LikelyAvailable);
    expect(result.note).toBe(Note.NotInRegistry);
  });

  it('notes a registered domain that has no DNS (bought but not set up)', async () => {
    const { result } = await check({ rdap: REGISTERED });
    expect(result.status).toBe(DomainStatus.Taken);
    expect(result.note).toBe(Note.NotInUse);
  });

  it('flags a domain in the deletion cycle', async () => {
    const { result } = await check({ rdap: { ...REGISTERED, statuses: ['pending delete'] } });
    expect(result.status).toBe(DomainStatus.Taken);
    expect(result.registration?.dropping).toBe(true);
    expect(result.note).toBe(Note.Dropping);
  });

  it('falls back to WHOIS when RDAP fails', async () => {
    const { result, calls } = await check({
      rdap: RDAP_ERROR,
      whois: { ...REGISTERED, state: LookupState.Registered },
    });
    expect(result.status).toBe(DomainStatus.Taken);
    expect(calls.whois).toBe(1);
  });

  it('falls back to WHOIS when the TLD has no RDAP', async () => {
    const { result } = await check({ rdap: { state: LookupState.Unsupported } }, 'acme.ru');
    expect(result.status).toBe(DomainStatus.LikelyAvailable);
  });

  it('maps a reserved WHOIS answer to reserved', async () => {
    const { result } = await check({
      rdap: { state: LookupState.Unsupported },
      whois: { state: LookupState.Reserved, server: 'whois.test', ms: 1 },
    });
    expect(result.status).toBe(DomainStatus.Reserved);
  });

  it('says unknown, not available, when both registry lookups fail', async () => {
    const { result } = await check({ rdap: RDAP_ERROR, whois: WHOIS_ERROR });
    expect(result.status).toBe(DomainStatus.Unknown);
    expect(result.evidence.map((item) => item.result)).toEqual([
      DnsState.NxDomain,
      LookupState.Error,
      LookupState.Error,
    ]);
  });

  it('explains when a TLD has no lookup service at all', async () => {
    const { result } = await check({
      rdap: { state: LookupState.Unsupported },
      whois: { state: LookupState.Unsupported },
    });
    expect(result.status).toBe(DomainStatus.Unknown);
    expect(result.note).toBe(noLookupServiceNote('com'));
  });

  it('never throws: a crashing lookup becomes unknown', async () => {
    const { result } = await check({
      rdap: () => {
        throw new Error('boom');
      },
    });
    expect(result.status).toBe(DomainStatus.Unknown);
  });

  it('skips DNS when it is turned off', async () => {
    const { services, calls } = fakeServices({ rdap: REGISTERED });
    const checker = new DomainChecker(testConfig({ DOMAINSCOUT_DNS: 'off' }), services);
    expect((await checker.check(target('acme.com'))).status).toBe(DomainStatus.Taken);
    expect(calls.dns).toBe(0);
  });

  it('keeps every result when a check fails unexpectedly or a progress listener throws', async () => {
    const { services } = fakeServices({});
    const checker = new DomainChecker(testConfig(), services);
    const failing = vi.spyOn(checker, 'check').mockRejectedValueOnce(new Error('bug'));
    const results = await checker.checkAll([target('a.com'), target('b.com')], {
      onProgress: () => {
        throw new Error('listener bug');
      },
    });
    expect(results.map((result) => [result.domain, result.status])).toEqual([
      ['a.com', DomainStatus.Unknown],
      ['b.com', DomainStatus.LikelyAvailable],
    ]);
    failing.mockRestore();
  });

  it('stops a check that the caller cancels between steps', async () => {
    const { services, calls } = fakeServices({ rdap: RDAP_ERROR });
    const controller = new AbortController();
    const checker = new DomainChecker(testConfig(), services);
    services.rdap.lookup = async () => {
      controller.abort();
      return RDAP_ERROR;
    };
    const result = await checker.check(target('acme.com'), controller.signal);
    expect(result).toMatchObject({ status: DomainStatus.Unknown, note: Note.Cancelled });
    expect(calls.whois).toBe(0);
  });

  it('reports progress once per domain', async () => {
    const { services } = fakeServices({});
    const seen: number[] = [];
    const targets = ['a.com', 'b.com', 'c.com'].map((domain) => target(domain));
    await new DomainChecker(testConfig(), services).checkAll(targets, {
      onProgress: ({ done }) => seen.push(done),
    });
    expect(seen).toEqual([1, 2, 3]);
  });
});
