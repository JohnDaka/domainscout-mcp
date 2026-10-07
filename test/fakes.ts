import { type Config, loadConfig } from '../src/config/config.js';
import type { ScoutServices } from '../src/core/services.js';
import {
  type Attempt,
  type DnsLookup,
  DnsState,
  LookupState,
  type PriceBookSnapshot,
  type RdapLookup,
  type Target,
  type WhoisLookup,
} from '../src/core/types.js';

export const testConfig = (env: NodeJS.ProcessEnv = {}): Config => loadConfig(env);

export const target = (domain: string, tld = domain.split('.').slice(1).join('.')): Target => ({
  input: domain,
  domain,
  display: domain,
  tld,
});

export interface FakeLookups {
  dns?: DnsLookup | ((domain: string) => DnsLookup);
  wildcard?: boolean;
  rdap?: RdapLookup | ((domain: string) => RdapLookup);
  whois?: WhoisLookup | ((domain: string) => WhoisLookup);
  prices?: PriceBookSnapshot;
  /** Registrar API answers per domain; leaving it out means the user set no API keys. */
  confirm?: (domain: string) => Attempt[];
}

/** Fake services that answer instantly, never touch the network and count their calls. */
export function fakeServices(lookups: FakeLookups = {}) {
  const calls = { dns: 0, rdap: 0, whois: 0, confirmed: [] as string[] };
  const pick = <T>(
    value: T | ((domain: string) => T) | undefined,
    domain: string,
    fallback: T,
  ): T =>
    typeof value === 'function' ? (value as (domain: string) => T)(domain) : (value ?? fallback);

  const services: ScoutServices = {
    prices: { load: async () => {}, snapshot: () => lookups.prices ?? new Map() },
    confirmer: {
      enabled: lookups.confirm !== undefined,
      confirm: async (domains) => {
        calls.confirmed.push(...domains);
        return new Map(domains.map((domain) => [domain, lookups.confirm?.(domain) ?? []]));
      },
    },
    dns: {
      lookupNs: async (domain) => {
        calls.dns++;
        return pick(lookups.dns, domain, { state: DnsState.NxDomain, ms: 1 });
      },
      hasWildcard: async () => lookups.wildcard ?? false,
    },
    rdap: {
      lookup: async (domain) => {
        calls.rdap++;
        return pick(lookups.rdap, domain, {
          state: LookupState.NotFound,
          server: 'rdap.test',
          ms: 1,
        });
      },
    },
    whois: {
      lookup: async (domain) => {
        calls.whois++;
        return pick(lookups.whois, domain, {
          state: LookupState.NotFound,
          server: 'whois.test',
          ms: 1,
        });
      },
    },
  };
  return { services, calls };
}
