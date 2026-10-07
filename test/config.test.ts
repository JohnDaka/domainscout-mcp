import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/config.js';
import { DEFAULT_TLDS, EnvVar, Setting } from '../src/constants.js';
import { RegistrarId } from '../src/core/types.js';
import { ALL_REGISTRARS } from '../src/registrars/registrars.js';

describe('loadConfig', () => {
  it('uses the defaults when nothing is set', () => {
    const config = loadConfig({});
    expect(config.defaultTlds).toEqual(DEFAULT_TLDS);
    expect(config.maxConcurrency).toBe(Setting.maxConcurrency.fallback);
    expect(config.useDns).toBe(true);
    expect(config.affiliate).toBe(true);
    expect(config.dnsServers).toEqual([]);
    expect(config.warnings).toEqual([]);
  });

  it('reads TLDs, normalizes them and reports unknown ones', () => {
    const config = loadConfig({ [EnvVar.Tlds]: '.IO, dev; io, not-a-tld' });
    expect(config.defaultTlds).toEqual(['io', 'dev']);
    expect(config.warnings).toHaveLength(1);
  });

  it('falls back to the default for out-of-range numbers', () => {
    const config = loadConfig({
      [EnvVar.MaxConcurrency]: '0',
      [EnvVar.TimeoutMs]: 'abc',
      [EnvVar.MaxDomains]: '50',
    });
    expect(config.maxConcurrency).toBe(Setting.maxConcurrency.fallback);
    expect(config.timeoutMs).toBe(Setting.timeoutMs.fallback);
    expect(config.maxDomains).toBe(50);
    expect(config.warnings).toHaveLength(2);
  });

  it('understands on/off flags', () => {
    const config = loadConfig({
      [EnvVar.Dns]: 'off',
      [EnvVar.Affiliate]: 'No',
      [EnvVar.Prices]: '1',
    });
    expect(config.useDns).toBe(false);
    expect(config.affiliate).toBe(false);
    expect(config.prices).toBe(true);
  });

  it('keeps the default for a flag it cannot read', () => {
    const config = loadConfig({ [EnvVar.Prices]: 'maybe' });
    expect(config.prices).toBe(true);
    expect(config.warnings).toEqual([`${EnvVar.Prices}: "maybe" must be on or off, using on`]);
  });

  it('ignores invalid DNS servers with a warning', () => {
    const config = loadConfig({ [EnvVar.DnsServers]: '1.1.1.1, not-an-ip' });
    expect(config.dnsServers).toEqual([]);
    expect(config.warnings).toHaveLength(1);
  });

  it('reads registrar API keys in pairs and ignores half a pair', () => {
    const config = loadConfig({
      [EnvVar.PorkbunApiKey]: ' pk1_abc ',
      [EnvVar.PorkbunSecretKey]: 'sk1_def',
      [EnvVar.SpaceshipApiKey]: 'only-half',
    });
    expect(config.apiKeys).toEqual({ porkbun: { apiKey: 'pk1_abc', secretKey: 'sk1_def' } });
    expect(config.warnings).toHaveLength(1);
    expect(config.warnings.join()).not.toContain('only-half');
  });

  it('limits buy links to the chosen registrars and reports unknown ones', () => {
    const config = loadConfig({ [EnvVar.Registrars]: 'Porkbun, dynadot, nope' });
    expect(config.registrars).toEqual([RegistrarId.Porkbun, RegistrarId.Dynadot]);
    expect(config.warnings).toHaveLength(1);
  });

  it('links to every registrar by default', () => {
    expect(loadConfig({}).registrars).toEqual(ALL_REGISTRARS);
  });
});
