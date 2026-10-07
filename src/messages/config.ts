import { EnvVar, type NumericSetting, TextSeparator } from '../constants.js';

/** How on/off settings are written in warnings. */
export const FlagWord = { On: 'on', Off: 'off' } as const;

/** Problems in environment variables; reported on startup, never fatal. */
export const ConfigWarning = {
  /** A TLD in DOMAINSCOUT_TLDS that does not exist. */
  unknownTld: (raw: string): string => `${EnvVar.Tlds}: "${raw}" is not a known TLD, ignored`,

  /** A number outside its range. */
  badNumber: (name: string, raw: string, setting: NumericSetting): string =>
    `${name}: "${raw}" must be a whole number from ${setting.min} to ${setting.max}, using ${setting.fallback}`,

  /** A flag that is neither on nor off. */
  badFlag: (name: string, raw: string, fallback: boolean): string =>
    `${name}: "${raw}" must be ${FlagWord.On} or ${FlagWord.Off}, using ${fallback ? FlagWord.On : FlagWord.Off}`,

  /** DNS server addresses that do not parse. */
  badDnsServers: (error: string): string => `${EnvVar.DnsServers}: ${error}; using the system DNS`,

  /** Half of a key pair. */
  incompleteKey: (first: string, second: string): string =>
    `${first} and ${second} work only together; both are ignored`,

  /** A registrar id that does not exist. */
  unknownRegistrar: (raw: string, known: readonly string[]): string =>
    `${EnvVar.Registrars}: "${raw}" is not one of ${known.join(TextSeparator.List)}, ignored`,
} as const;
