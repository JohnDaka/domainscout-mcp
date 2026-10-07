import { Resolver } from 'node:dns/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DnsChecker } from '../src/checkers/dns.js';
import { DnsState } from '../src/core/types.js';

const TIMEOUT_MS = 1_000;

/** The shape of errors thrown by node:dns: an Error with a `code`. */
const dnsError = (code: string) => Object.assign(new Error(code), { code });

afterEach(() => vi.restoreAllMocks());

describe('DnsChecker', () => {
  it.each([
    ['nameservers', () => Promise.resolve(['ns1.test', 'ns2.test']), DnsState.Delegated],
    ['no nameservers', () => Promise.resolve([]), DnsState.NoData],
    ['NXDOMAIN', () => Promise.reject(dnsError('ENOTFOUND')), DnsState.NxDomain],
    ['NODATA', () => Promise.reject(dnsError('ENODATA')), DnsState.NoData],
    ['SERVFAIL', () => Promise.reject(dnsError('ESERVFAIL')), DnsState.Error],
  ])('maps %s', async (_name, answer, state) => {
    vi.spyOn(Resolver.prototype, 'resolveNs').mockImplementation(answer as () => Promise<string[]>);
    expect((await new DnsChecker([], TIMEOUT_MS).lookupNs('acme.com')).state).toBe(state);
  });

  it('keeps the nameservers and the error code as evidence', async () => {
    const resolve = vi.spyOn(Resolver.prototype, 'resolveNs').mockResolvedValueOnce(['ns1.test']);
    resolve.mockRejectedValueOnce(dnsError('ETIMEOUT'));
    const dns = new DnsChecker([], TIMEOUT_MS);
    expect(await dns.lookupNs('a.com')).toMatchObject({ nameservers: ['ns1.test'] });
    expect(await dns.lookupNs('b.com')).toMatchObject({ state: DnsState.Error, error: 'ETIMEOUT' });
  });

  it('describes errors that carry no code', async () => {
    vi.spyOn(Resolver.prototype, 'resolveNs').mockRejectedValue('boom');
    expect(await new DnsChecker([], TIMEOUT_MS).lookupNs('a.com')).toMatchObject({ error: 'boom' });
  });

  it('uses the configured DNS servers', () => {
    const setServers = vi.spyOn(Resolver.prototype, 'setServers').mockImplementation(() => {});
    new DnsChecker(['1.1.1.1'], TIMEOUT_MS);
    expect(setServers).toHaveBeenCalledWith(['1.1.1.1']);
  });

  it('detects a wildcard TLD once and remembers it', async () => {
    const resolve = vi
      .spyOn(Resolver.prototype, 'resolveNs')
      .mockResolvedValue(['ns.wildcard.test']);
    const dns = new DnsChecker([], TIMEOUT_MS);
    expect(await dns.hasWildcard('test')).toBe(true);
    expect(await dns.hasWildcard('test')).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve.mock.calls[0]?.[0]).toMatch(/^[0-9a-f]{24}\.test$/);
  });
});
