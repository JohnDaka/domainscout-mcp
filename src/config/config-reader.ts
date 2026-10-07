import { Resolver } from 'node:dns/promises';
import { DEFAULT_TLDS, EnvVar, FLAG_VALUES, type NumericSetting } from '../constants.js';
import { normalizeTlds, splitEntries } from '../core/domain-name.js';
import { errorMessage } from '../core/errors.js';
import type { RegistrarId } from '../core/types.js';
import { ConfigWarning } from '../messages/index.js';
import { ALL_REGISTRARS } from '../registrars/registrars.js';
import type { ApiKeys } from './config.js';

/** Two values that only work together, such as a key and its secret. */
interface Pair {
  first: string;
  second: string;
}

/** Reads settings from environment variables, collecting a warning for every value it cannot use. */
export class ConfigReader {
  /** Problems found so far. Reported on startup, never fatal. */
  readonly warnings: string[] = [];

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  /** A whole number within the setting's range; the setting's fallback otherwise. */
  number(name: EnvVar, setting: NumericSetting): number {
    const raw = this.raw(name);
    if (!raw) return setting.fallback;
    const value = Number(raw);
    if (Number.isInteger(value) && value >= setting.min && value <= setting.max) return value;
    this.warnings.push(ConfigWarning.badNumber(name, raw, setting));
    return setting.fallback;
  }

  /** On or off; `fallback` when not set or not readable. */
  flag(name: EnvVar, fallback: boolean): boolean {
    const raw = this.raw(name)?.toLowerCase();
    if (!raw) return fallback;
    const value = FLAG_VALUES.get(raw);
    if (value !== undefined) return value;
    this.warnings.push(ConfigWarning.badFlag(name, raw, fallback));
    return fallback;
  }

  /** TLDs for names given without one; the defaults when none is usable. */
  tlds(name: EnvVar): string[] {
    const { tlds, unknown } = normalizeTlds(this.list(name));
    for (const entry of unknown) this.warnings.push(ConfigWarning.unknownTld(entry));
    return tlds.length > 0 ? tlds : [...DEFAULT_TLDS];
  }

  /** DNS server addresses; the system DNS when empty or not valid. */
  dnsServers(name: EnvVar): string[] {
    const servers = this.list(name);
    if (servers.length === 0) return servers;
    try {
      new Resolver().setServers(servers); // throws on an invalid address
      return servers;
    } catch (error) {
      this.warnings.push(ConfigWarning.badDnsServers(errorMessage(error)));
      return [];
    }
  }

  /** Registrars to show buy links for; all of them when none is usable. */
  registrars(name: EnvVar): RegistrarId[] {
    const ids = new Set<RegistrarId>();
    for (const entry of this.list(name)) {
      const id = ALL_REGISTRARS.find((candidate) => candidate === entry.toLowerCase());
      if (id) ids.add(id);
      else this.warnings.push(ConfigWarning.unknownRegistrar(entry, ALL_REGISTRARS));
    }
    return ids.size > 0 ? [...ids] : [...ALL_REGISTRARS];
  }

  /** The registrar API keys the user has set, complete pairs only. */
  apiKeys(): ApiKeys {
    const porkbun = this.pair(EnvVar.PorkbunApiKey, EnvVar.PorkbunSecretKey);
    const nameCom = this.pair(EnvVar.NameComUsername, EnvVar.NameComToken);
    const spaceship = this.pair(EnvVar.SpaceshipApiKey, EnvVar.SpaceshipApiSecret);
    const cloudflare = this.pair(EnvVar.CloudflareAccountId, EnvVar.CloudflareApiToken);
    return {
      ...(porkbun && { porkbun: { apiKey: porkbun.first, secretKey: porkbun.second } }),
      ...(nameCom && { nameCom: { username: nameCom.first, token: nameCom.second } }),
      ...(spaceship && { spaceship: { apiKey: spaceship.first, apiSecret: spaceship.second } }),
      ...(cloudflare && {
        cloudflare: { accountId: cloudflare.first, apiToken: cloudflare.second },
      }),
    };
  }

  /** Credentials come in pairs; half a pair is reported and ignored. */
  private pair(first: EnvVar, second: EnvVar): Pair | undefined {
    const firstValue = this.raw(first);
    const secondValue = this.raw(second);
    if (firstValue && secondValue) return { first: firstValue, second: secondValue };
    if (firstValue || secondValue) this.warnings.push(ConfigWarning.incompleteKey(first, second));
    return undefined;
  }

  /** A comma- or space-separated list. */
  private list(name: EnvVar): string[] {
    return splitEntries([this.raw(name) ?? '']);
  }

  /** The variable's value without surrounding spaces. */
  private raw(name: EnvVar): string | undefined {
    return this.env[name]?.trim();
  }
}
