import { DnsChecker } from '../checkers/dns.js';
import { RdapChecker } from '../checkers/rdap.js';
import { WhoisChecker } from '../checkers/whois.js';
import type { Config } from '../config/config.js';
import { Priority } from '../constants.js';
import { Note } from '../messages/index.js';
import { dnsEvidence, rdapEvidence, whoisEvidence } from './evidence.js';
import { Network } from './network.js';
import type { CheckerServices, DnsService, RdapService, WhoisService } from './services.js';
import {
  type CheckOptions,
  type CheckProgress,
  DnsState,
  type DomainResult,
  type Evidence,
  LookupState,
  type ProgressListener,
  SettledStatus,
  type Target,
  type Verdict,
  type WhoisLookup,
} from './types.js';
import {
  HAS_NAMESERVERS,
  NOT_IN_REGISTRY,
  noLookupService,
  RESERVED_BY_REGISTRY,
  registeredInRdap,
  taken,
  unverified,
} from './verdicts.js';

/** What the steps of one domain's check share. */
interface CheckContext {
  readonly target: Target;
  readonly signal?: AbortSignal;
  /** Every source asked so far, and what it said. */
  readonly evidence: Evidence[];
  /** Set by the DNS step: the name has no DNS at all, so if it is registered, it is not in use. */
  notInUse?: string;
  /** Set by the RDAP step: the TLD has no RDAP server. */
  noRdap?: boolean;
}

/** One step of the funnel: a verdict ends the check, undefined passes the domain to the next step. */
type CheckStep = (context: CheckContext) => Promise<Verdict | undefined>;

/** Turns a WHOIS answer into a verdict. */
type WhoisVerdictRule = (context: CheckContext) => Verdict;

/**
 * The checking funnel for one domain:
 *   1. DNS: delegated in the TLD zone -> taken. Cheap, and spares the registries' rate limits.
 *   2. RDAP at the registry (authoritative): found -> taken, 404 -> likely available.
 *   3. WHOIS, only when the TLD has no RDAP or RDAP failed.
 * DNS alone never proves availability: a bought but unused domain has no DNS either.
 */
export class DomainChecker {
  private readonly dns: DnsService;
  private readonly rdap: RdapService;
  private readonly whois: WhoisService;

  /** The funnel, cheapest and most conclusive source first. */
  private readonly steps: readonly CheckStep[] = [
    (context) => this.checkDns(context),
    (context) => this.checkRdap(context),
    (context) => this.checkWhois(context),
  ];

  /** The verdict for each WHOIS answer. */
  private readonly whoisVerdicts = new Map<LookupState, WhoisVerdictRule>()
    .set(LookupState.Registered, (context) => taken(context.notInUse))
    .set(LookupState.NotFound, () => NOT_IN_REGISTRY)
    .set(LookupState.Reserved, () => RESERVED_BY_REGISTRY)
    .set(LookupState.Unsupported, (context) => this.noWhoisVerdict(context))
    .set(LookupState.Error, (context) => unverified(context.signal));

  constructor(
    private readonly config: Config,
    services: Partial<CheckerServices> = {},
    private readonly network: Network = new Network(config),
  ) {
    this.dns = services.dns ?? new DnsChecker(config.dnsServers, config.timeoutMs);
    this.rdap = services.rdap ?? new RdapChecker(network);
    this.whois = services.whois ?? new WhoisChecker(network);
  }

  /**
   * Starts every domain at once on purpose. The limits sit on the network requests (globally
   * and per server), not on whole domains: a per-domain limit would let domains queued for one
   * busy registry block domains whose registry is idle. Each domain settles on its own, so one
   * failure can never cost the results of the others.
   */
  async checkAll(targets: readonly Target[], options: CheckOptions = {}): Promise<DomainResult[]> {
    let done = 0;
    const checks = targets.map(async (target) => {
      const result = await this.check(target, options.signal);
      done++;
      this.notify(options.onProgress, { done, total: targets.length, result });
      return result;
    });
    const settled = await Promise.allSettled(checks);
    return targets.map((target, index) => this.settledResult(target, settled[index], options));
  }

  /** Checks one domain. Never throws: any failure becomes an "unknown" result. */
  async check(target: Target, signal?: AbortSignal): Promise<DomainResult> {
    const context: CheckContext = { target, signal, evidence: [] };
    const verdict = await this.runSteps(context).catch(() => unverified(signal));
    return this.result(target, verdict, context.evidence);
  }

  private async runSteps(context: CheckContext): Promise<Verdict> {
    for (const step of this.steps) {
      const verdict = await step(context);
      if (verdict) return verdict;
      context.signal?.throwIfAborted();
    }
    return unverified(context.signal);
  }

  /** Step 1: a delegation in the TLD zone proves registration, unless the TLD answers for any name. */
  private async checkDns(context: CheckContext): Promise<Verdict | undefined> {
    if (!this.config.useDns) return undefined;
    const lookup = await this.network.global.add(() => this.dns.lookupNs(context.target.domain), {
      priority: Priority.Dns,
      signal: context.signal,
    });
    context.evidence.push(dnsEvidence(lookup));
    if (lookup.state === DnsState.NxDomain) context.notInUse = Note.NotInUse;
    if (lookup.state !== DnsState.Delegated) return undefined;
    const wildcard = await this.dns.hasWildcard(context.target.tld);
    return wildcard ? undefined : HAS_NAMESERVERS;
  }

  /** Step 2: the registry's own answer. An error or a TLD without RDAP passes the domain on. */
  private async checkRdap(context: CheckContext): Promise<Verdict | undefined> {
    const { domain, tld } = context.target;
    const lookup = await this.rdap.lookup(domain, tld, context.signal);
    context.noRdap = lookup.state === LookupState.Unsupported;
    if (lookup.state === LookupState.Unsupported) return undefined;
    context.evidence.push(rdapEvidence(lookup));
    if (lookup.state === LookupState.Registered) return registeredInRdap(lookup, context.notInUse);
    if (lookup.state === LookupState.NotFound) return NOT_IN_REGISTRY;
    return undefined;
  }

  /** Step 3: WHOIS, the last resort. Always reaches a verdict. */
  private async checkWhois(context: CheckContext): Promise<Verdict> {
    const { domain, tld } = context.target;
    const lookup = await this.whois.lookup(domain, tld, context.signal);
    this.recordWhois(context, lookup);
    const rule = this.whoisVerdicts.get(lookup.state);
    return rule ? rule(context) : unverified(context.signal);
  }

  private recordWhois(context: CheckContext, lookup: WhoisLookup): void {
    if (lookup.state !== LookupState.Unsupported) context.evidence.push(whoisEvidence(lookup));
  }

  /** No WHOIS either: either the TLD has no lookup service at all, or RDAP failed. */
  private noWhoisVerdict(context: CheckContext): Verdict {
    return context.noRdap ? noLookupService(context.target.tld) : unverified(context.signal);
  }

  /** Progress is best effort: a listener that throws must not cost the domain its result. */
  private notify(listener: ProgressListener | undefined, progress: CheckProgress): void {
    try {
      listener?.(progress);
    } catch {
      // Ignored on purpose; the result is what matters.
    }
  }

  /** The result of a settled check; a check that somehow threw still yields an "unknown" result. */
  private settledResult(
    target: Target,
    outcome: PromiseSettledResult<DomainResult> | undefined,
    options: CheckOptions,
  ): DomainResult {
    if (outcome?.status === SettledStatus.Fulfilled) return outcome.value;
    return this.result(target, unverified(options.signal), []);
  }

  private result(target: Target, verdict: Verdict, evidence: Evidence[]): DomainResult {
    return {
      domain: target.domain,
      display: target.display,
      input: target.input,
      tld: target.tld,
      ...verdict,
      evidence,
    };
  }
}
