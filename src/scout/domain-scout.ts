import { setTimeout as delay } from 'node:timers/promises';
import type { Config } from '../config/config.js';
import { Confirmer } from '../confirm/confirmer.js';
import { apiFailures, applyConfirmation } from '../confirm/outcome.js';
import { createRegistrarApis } from '../confirm/registrar-apis.js';
import { PRICE_GRACE_MS } from '../constants.js';
import { DomainChecker } from '../core/checker.js';
import { normalizeTlds, splitEntries, type TldList } from '../core/domain-name.js';
import { Network } from '../core/network.js';
import type { ConfirmService, PriceService, ScoutServices } from '../core/services.js';
import { isConfirmable, isFree } from '../core/status.js';
import { TargetParser } from '../core/target-parser.js';
import type {
  Attempt,
  CheckOptions,
  CheckOutcome,
  CheckRequest,
  DomainResult,
  ExactPrice,
  InvalidEntry,
  PriceBookSnapshot,
  Target,
} from '../core/types.js';
import { InvalidReason, ReportLine, RequestError, tooManyDomainsText } from '../messages/index.js';
import { PriceBook } from '../pricing/price-book.js';
import { buyLinks } from '../registrars/buy-links.js';

/** What a call will check: the TLDs used, the domains, and the entries that were skipped. */
interface CheckPlan {
  tlds: string[];
  targets: Target[];
  invalid: InvalidEntry[];
}

/** What confirmation with registrar APIs adds to a report. */
interface ConfirmationOutcome {
  /** Exact prices quoted by the registrars, by domain. */
  exactPrices: ReadonlyMap<string, ExactPrice>;
  warnings: string[];
}

/** No prices: price lists are turned off. */
const NO_PRICES: PriceBookSnapshot = new Map();

/**
 * Everything the MCP tool and the CLI need: input parsing, the checks, confirmation with
 * registrar APIs, prices and buy links.
 */
export class DomainScout {
  private readonly checker: DomainChecker;
  private readonly prices: PriceService;
  private readonly confirmer: ConfirmService;

  constructor(
    private readonly config: Config,
    services: Partial<ScoutServices> = {},
  ) {
    const network = new Network(config);
    this.checker = new DomainChecker(config, services, network);
    this.prices = services.prices ?? new PriceBook(network);
    this.confirmer =
      services.confirmer ?? new Confirmer(createRegistrarApis(config.apiKeys), network);
  }

  /** Checks a list of names. Prices load during the checks, so they rarely add any wait. */
  async check(request: CheckRequest, options: CheckOptions = {}): Promise<CheckOutcome> {
    const started = Date.now();
    const plan = this.plan(request);
    const rejection = this.rejection(plan.targets);
    if (rejection) return { ok: false, message: rejection, invalid: plan.invalid };

    const pricesLoading = this.loadPrices(plan.targets);
    const results = await this.checker.checkAll(plan.targets, options);
    const confirmation = await this.confirmIfWanted(request, results, options.signal);
    await this.waitForPrices(pricesLoading);
    this.attachBuyLinks(results, confirmation.exactPrices);

    const { tlds, invalid } = plan;
    const elapsedMs = Date.now() - started;
    return {
      ok: true,
      report: { results, invalid, tlds, warnings: confirmation.warnings, elapsedMs },
    };
  }

  /** The TLDs to use and the domains to check. */
  private plan(request: CheckRequest): CheckPlan {
    const { tlds, unknown } = this.tldsFor(request.tlds);
    const parsed = new TargetParser(tlds).parse(request.domains);
    const unknownTlds = unknown.map((input) => ({ input, reason: InvalidReason.UnknownTld }));
    return { tlds, targets: parsed.targets, invalid: [...unknownTlds, ...parsed.invalid] };
  }

  /** The caller's TLDs when given, otherwise the configured defaults. */
  private tldsFor(requested: readonly string[] = []): TldList {
    const entries = splitEntries(requested);
    if (entries.length === 0) return { tlds: this.config.defaultTlds, unknown: [] };
    return normalizeTlds(entries);
  }

  /** Why the call cannot go ahead, if it cannot. */
  private rejection(targets: readonly Target[]): string | undefined {
    if (targets.length === 0) return RequestError.NothingToCheck;
    if (targets.length > this.config.maxDomains) {
      return tooManyDomainsText(targets.length, this.config.maxDomains);
    }
    return undefined;
  }

  /** Starts loading prices for the TLDs being checked. Never fails the call. */
  private loadPrices(targets: readonly Target[]): Promise<void> {
    if (!this.config.prices) return Promise.resolve();
    return this.prices.load([...new Set(targets.map((target) => target.tld))]);
  }

  /** Waits a moment for prices still loading; whatever arrives later is cached for the next call. */
  private async waitForPrices(loading: Promise<void>): Promise<void> {
    await Promise.race([loading, delay(PRICE_GRACE_MS, undefined, { ref: false })]);
  }

  /** Confirmation, unless the caller turned it off. */
  private confirmIfWanted(
    request: CheckRequest,
    results: DomainResult[],
    signal?: AbortSignal,
  ): Promise<ConfirmationOutcome> {
    if (request.confirm === false) return Promise.resolve(this.nothingConfirmed());
    return this.confirmFree(results, signal);
  }

  /** Asks registrar APIs (user's keys) about free-looking and unverifiable domains, up to the configured limit. */
  private async confirmFree(
    results: DomainResult[],
    signal?: AbortSignal,
  ): Promise<ConfirmationOutcome> {
    const candidates = results.filter(isConfirmable);
    if (!this.confirmer.enabled || candidates.length === 0) return this.nothingConfirmed();
    const chosen = candidates.slice(0, this.config.confirmMax);
    const attempts = await this.confirmer.confirm(
      chosen.map((result) => result.domain),
      signal,
    );
    return {
      exactPrices: this.applyAnswers(chosen, attempts),
      warnings: [...this.limitWarnings(chosen, candidates), ...apiFailures(attempts)],
    };
  }

  /** Applies each domain's answers; returns the exact prices the registrars quoted. */
  private applyAnswers(
    chosen: readonly DomainResult[],
    attempts: ReadonlyMap<string, readonly Attempt[]>,
  ): Map<string, ExactPrice> {
    const exactPrices = new Map<string, ExactPrice>();
    for (const result of chosen) {
      const answer = applyConfirmation(result, attempts.get(result.domain) ?? []);
      if (answer?.price) {
        exactPrices.set(result.domain, { registrar: answer.registrar, price: answer.price });
      }
    }
    return exactPrices;
  }

  /** A note when the confirmation limit left some domains out. */
  private limitWarnings(
    chosen: readonly DomainResult[],
    candidates: readonly DomainResult[],
  ): string[] {
    if (chosen.length === candidates.length) return [];
    return [ReportLine.confirmLimited(chosen.length, candidates.length)];
  }

  private nothingConfirmed(): ConfirmationOutcome {
    return { exactPrices: new Map(), warnings: [] };
  }

  /** Buy links for every free domain, cheapest first. */
  private attachBuyLinks(
    results: readonly DomainResult[],
    exactPrices: ReadonlyMap<string, ExactPrice>,
  ): void {
    const prices = this.config.prices ? this.prices.snapshot() : NO_PRICES;
    for (const result of results.filter((candidate) => isFree(candidate.status))) {
      result.buy = buyLinks(result.domain, result.tld, {
        prices,
        registrars: this.config.registrars,
        affiliate: this.config.affiliate,
        confirmed: exactPrices.get(result.domain),
      });
    }
  }
}
