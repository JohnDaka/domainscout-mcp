import { parse as parseDomain } from 'tldts';
import { LABEL_SEPARATOR } from '../constants.js';
import { InvalidReason } from '../messages/index.js';
import {
  ICANN_ONLY,
  joinLabels,
  nameProblem,
  splitEntries,
  toAsciiHost,
  toUnicode,
} from './domain-name.js';
import type { InvalidEntry, ParseResult, Target } from './types.js';

/**
 * Turns user entries into domains to check. A bare name ("coolapp") is tried in every TLD;
 * an entry that already has a TLD ("coolapp.io", "https://www.coolapp.io/about") is checked
 * exactly as given. Duplicates are dropped, and every skipped entry is reported once.
 */
export class TargetParser {
  private readonly targets: Target[] = [];
  private readonly invalid: InvalidEntry[] = [];
  /** Domains already added. */
  private readonly seenDomains = new Set<string>();
  /** Entries already reported as invalid. */
  private readonly seenInvalid = new Set<string>();

  /** `tlds`: the TLDs for names given without one. */
  constructor(private readonly tlds: readonly string[]) {}

  /** Parses every entry (an entry may hold several names). */
  parse(entries: readonly string[]): ParseResult {
    for (const input of splitEntries(entries)) this.parseEntry(input);
    return { targets: this.targets, invalid: this.invalid };
  }

  private parseEntry(input: string): void {
    const problem = this.addEntry(input);
    if (problem) this.skip(input, problem);
  }

  /** Adds the entry's domains; returns why it was skipped instead, if it was. */
  private addEntry(input: string): string | undefined {
    const host = toAsciiHost(input);
    if (!host) return InvalidReason.NotADomain;
    if (host.includes(LABEL_SEPARATOR)) return this.addDomain(input, host);
    return this.addName(input, host);
  }

  /** A bare name: one domain per TLD. Validated once, so a bad name is reported once. */
  private addName(input: string, name: string): string | undefined {
    const problem = nameProblem(name);
    if (problem) return problem;
    if (this.tlds.length === 0) return InvalidReason.NoTlds;
    for (const tld of this.tlds) this.add(input, joinLabels(name, tld), tld);
    return undefined;
  }

  /** A host with a TLD: its registrable domain, so "www.acme.co.uk" becomes "acme.co.uk". */
  private addDomain(input: string, host: string): string | undefined {
    const info = parseDomain(host, ICANN_ONLY);
    if (info.isIp) return InvalidReason.IpAddress;
    if (!info.isIcann || !info.domain || !info.publicSuffix) return InvalidReason.UnknownTld;
    const problem = nameProblem(info.domainWithoutSuffix ?? '');
    if (problem) return problem;
    this.add(input, info.domain, info.publicSuffix);
    return undefined;
  }

  private add(input: string, domain: string, tld: string): void {
    if (this.seenDomains.has(domain)) return;
    this.seenDomains.add(domain);
    this.targets.push({ input, domain, display: toUnicode(domain), tld });
  }

  private skip(input: string, reason: string): void {
    if (this.seenInvalid.has(input)) return;
    this.seenInvalid.add(input);
    this.invalid.push({ input, reason });
  }
}
