import {
  AFFILIATE_LINKS_DEFAULT,
  COMMAND_NAME,
  DNS_PRECHECK_DEFAULT,
  EnvVar,
  PRICES_DEFAULT,
  Setting,
} from '../constants.js';
import type { RegistrarId } from '../core/types.js';
import { ConfigReader } from './config-reader.js';
import { VERSION } from './version.js';

/** Porkbun API credentials. */
export interface PorkbunKeys {
  apiKey: string;
  secretKey: string;
}

/** Name.com API credentials. */
export interface NameComKeys {
  username: string;
  token: string;
}

/** Spaceship API credentials. */
export interface SpaceshipKeys {
  apiKey: string;
  apiSecret: string;
}

/** Cloudflare API credentials. */
export interface CloudflareKeys {
  accountId: string;
  apiToken: string;
}

/** The user's own registrar API credentials. Read from the environment; never logged, shown or sent elsewhere. */
export interface ApiKeys {
  porkbun?: PorkbunKeys;
  nameCom?: NameComKeys;
  spaceship?: SpaceshipKeys;
  cloudflare?: CloudflareKeys;
}

/** Everything that can be configured, with the defaults filled in. */
export interface Config {
  /** TLDs for names given without one. */
  defaultTlds: string[];
  /** Network operations in flight at once, all hosts together. */
  maxConcurrency: number;
  /** Requests in flight to one RDAP server. */
  perHostConcurrency: number;
  /** Timeout of one request. */
  timeoutMs: number;
  /** Domains per call, after adding TLDs. */
  maxDomains: number;
  /** The DNS pre-check. */
  useDns: boolean;
  /** DNS servers; the system resolver when empty. */
  dnsServers: string[];
  /** Affiliate buy links. */
  affiliate: boolean;
  /** Public price lists. */
  prices: boolean;
  /** Registrars to show buy links for. */
  registrars: RegistrarId[];
  /** Most free domains per call to confirm with registrar APIs. */
  confirmMax: number;
  apiKeys: ApiKeys;
  /** Sent with every HTTP request. */
  userAgent: string;
  /** Problems found in the environment. Reported on startup, never fatal. */
  warnings: string[];
}

/** The configuration from environment variables; unusable values fall back to defaults with a warning. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const reader = new ConfigReader(env);
  return {
    defaultTlds: reader.tlds(EnvVar.Tlds),
    maxConcurrency: reader.number(EnvVar.MaxConcurrency, Setting.maxConcurrency),
    perHostConcurrency: reader.number(EnvVar.PerHostConcurrency, Setting.perHostConcurrency),
    timeoutMs: reader.number(EnvVar.TimeoutMs, Setting.timeoutMs),
    maxDomains: reader.number(EnvVar.MaxDomains, Setting.maxDomains),
    useDns: reader.flag(EnvVar.Dns, DNS_PRECHECK_DEFAULT),
    dnsServers: reader.dnsServers(EnvVar.DnsServers),
    affiliate: reader.flag(EnvVar.Affiliate, AFFILIATE_LINKS_DEFAULT),
    prices: reader.flag(EnvVar.Prices, PRICES_DEFAULT),
    registrars: reader.registrars(EnvVar.Registrars),
    confirmMax: reader.number(EnvVar.ConfirmMax, Setting.confirmMax),
    apiKeys: reader.apiKeys(),
    userAgent: `${COMMAND_NAME}/${VERSION}`,
    warnings: reader.warnings,
  };
}
