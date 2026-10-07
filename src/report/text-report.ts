import {
  CONTINUATION_INDENT,
  DEFAULT_MIN_YEARS,
  ELAPSED_SECONDS_DECIMALS,
  FULL_LINKS_MAX_DOMAINS,
  ISO_DATE_LENGTH,
  LIST_ITEM_END,
  REPORT_LINE_WIDTH,
  SECOND_MS,
  TAKEN_DATES_MAX_DOMAINS,
  TextSeparator,
} from '../constants.js';
import { isFree } from '../core/status.js';
import {
  type BuyLink,
  ConfirmState,
  type DomainResult,
  DomainStatus,
  type Evidence,
  type EvidenceResult,
  EvidenceSource,
  LookupState,
  type Price,
  type Report,
} from '../core/types.js';
import {
  AFFILIATE_DISCLOSURE,
  CountLabel,
  ReportHeading,
  ReportLine,
  ReportText,
} from '../messages/index.js';
import { formatMoney } from './money.js';
import { hasAffiliateLinks } from './summary.js';

/** Evidence results that mean a source failed. */
const ERROR_RESULTS: ReadonlySet<EvidenceResult> = new Set([LookupState.Error, ConfirmState.Error]);

/** Lines of one section; an empty section is left out. */
type Section = string[];

/**
 * The plain-text report for the model and the CLI. Free domains come first: that is what
 * people look for. A few free domains get every registrar's link; many get one line each with
 * the cheapest offer, so a brainstorm of hundreds of names stays readable.
 */
export class TextReport {
  private readonly free: DomainResult[];
  private readonly taken: DomainResult[];
  private readonly reserved: DomainResult[];
  private readonly unknown: DomainResult[];

  constructor(private readonly report: Report) {
    this.free = report.results.filter((result) => isFree(result.status));
    this.taken = this.withStatus(DomainStatus.Taken);
    this.reserved = this.withStatus(DomainStatus.Reserved);
    this.unknown = this.withStatus(DomainStatus.Unknown);
  }

  /** The whole report. */
  render(): string {
    const sections: Section[] = [
      this.summarySection(),
      this.availableSection(),
      this.takenSection(),
      this.reservedSection(),
      this.unknownSection(),
      this.skippedSection(),
      this.notesSection(),
      this.disclosureSection(),
    ];
    return sections
      .filter((section) => section.length > 0)
      .map((section) => section.join(TextSeparator.Line))
      .join(TextSeparator.Section);
  }

  /** "Checked 9 domain(s) in 1.5s: 5 available, 4 taken." */
  private summarySection(): Section {
    const counts = [
      ReportLine.count(this.free.length, CountLabel.Free),
      ReportLine.count(this.taken.length, CountLabel.Taken),
      ...this.countIfAny(this.reserved, CountLabel.Reserved),
      ...this.countIfAny(this.unknown, CountLabel.Unknown),
    ];
    const seconds = (this.report.elapsedMs / SECOND_MS).toFixed(ELAPSED_SECONDS_DECIMALS);
    return [ReportLine.summary(this.report.results.length, seconds, counts)];
  }

  /** Free domains and where to buy them. */
  private availableSection(): Section {
    if (this.free.length === 0) return [];
    if (this.free.length > FULL_LINKS_MAX_DOMAINS) return this.compactAvailableSection();
    return [
      ReportHeading.Available,
      ...this.free.flatMap((result) => this.fullEntry(result)),
      ReportText.AvailableFootnote,
    ];
  }

  /** One line per free domain, with its cheapest offer. */
  private compactAvailableSection(): Section {
    return [
      ReportHeading.AvailableCompact,
      ...this.free.map((result) => this.compactEntry(result)),
      ReportText.AvailableFootnote,
      ReportText.CompactFootnote,
    ];
  }

  /** Every registrar's link, cheapest first, and the minimum term when there is one. */
  private fullEntry(result: DomainResult): string[] {
    const links = result.buy ?? [];
    const minYears = Math.max(
      DEFAULT_MIN_YEARS,
      ...links.map((link) => link.price?.minYears ?? DEFAULT_MIN_YEARS),
    );
    const minTerm = minYears > DEFAULT_MIN_YEARS ? [ReportLine.minTerm(minYears)] : [];
    return [this.entryName(result), ...minTerm, ...links.map((link) => this.linkLine(link))];
  }

  /** "- acme.com: $10.46/yr at Cloudflare https://…" */
  private compactEntry(result: DomainResult): string {
    const cheapest = result.buy?.[0];
    if (!cheapest) return this.entryName(result);
    return ReportLine.compact(this.entryName(result), this.offer(cheapest), cheapest.url);
  }

  /** "- acme.ai (confirmed by Porkbun)" */
  private entryName(result: DomainResult): string {
    return ReportLine.available(result.display, result.confirmedBy, result.premium);
  }

  /** "  Cloudflare: $10.46/yr, renews at $10.46/yr: https://…" */
  private linkLine(link: BuyLink): string {
    if (!link.price) return ReportLine.plainLink(link.registrar, link.url);
    const { registration, renewal, currency, confirmed = false } = link.price;
    const first = formatMoney(registration, currency);
    const next = formatMoney(renewal, currency);
    return ReportLine.pricedLink(link.registrar, first, next, link.url, confirmed);
  }

  /** "$5.98/yr at Porkbun (renews at $11.08/yr)", or just the registrar when no price is known. */
  private offer(link: BuyLink): string {
    if (!link.price) return link.registrar;
    const price = formatMoney(link.price.registration, link.price.currency);
    return ReportLine.offer(price, link.registrar, this.priceDetails(link.price));
  }

  /** What the first-year price alone does not say: a different renewal price, a minimum term. */
  private priceDetails(price: Price): string[] {
    const details: string[] = [];
    if (price.renewal !== price.registration) {
      details.push(ReportLine.renewsAt(formatMoney(price.renewal, price.currency)));
    }
    if (price.minYears > DEFAULT_MIN_YEARS) details.push(ReportLine.minimumYears(price.minYears));
    return details;
  }

  /** "TAKEN: a.com (until 2027-03-01), b.com (in deletion, may become available soon)" */
  private takenSection(): Section {
    if (this.taken.length === 0) return [];
    const withDates = this.taken.length <= TAKEN_DATES_MAX_DOMAINS;
    const names = this.taken.map((result) => this.takenName(result, withDates));
    return this.wrappedList(ReportHeading.Taken, names);
  }

  /** The name, marked when it is being deleted, and with its expiry date when dates are shown. */
  private takenName(result: DomainResult, withDate: boolean): string {
    if (result.registration?.dropping) return ReportLine.dropping(result.display);
    const expires = result.registration?.expires?.slice(0, ISO_DATE_LENGTH);
    return withDate && expires ? ReportLine.until(result.display, expires) : result.display;
  }

  private reservedSection(): Section {
    if (this.reserved.length === 0) return [];
    const names = this.reserved.map((result) => result.display);
    return this.wrappedList(ReportHeading.Reserved, names);
  }

  /**
   * "TAKEN: a.com, b.com," and then indented lines, none wider than REPORT_LINE_WIDTH (an item
   * longer than that still gets a line of its own).
   */
  private wrappedList(heading: string, items: readonly string[]): string[] {
    const lines: string[] = [];
    let line = heading;
    for (const [index, item] of items.entries()) {
      const piece = index < items.length - 1 ? `${item}${LIST_ITEM_END}` : item;
      const fits = line.length + 1 + piece.length <= REPORT_LINE_WIDTH;
      if (fits || line === heading) {
        line = `${line} ${piece}`;
        continue;
      }
      lines.push(line);
      line = `${CONTINUATION_INDENT}${piece}`;
    }
    lines.push(line);
    return lines;
  }

  /** Each unverified domain, with what went wrong. */
  private unknownSection(): Section {
    if (this.unknown.length === 0) return [];
    const lines = this.unknown.map((result) =>
      ReportLine.failure(result.display, this.failureReason(result)),
    );
    return [ReportHeading.Unknown, ...lines];
  }

  /** Registry and registrar errors behind an "unknown" verdict; DNS errors alone never decide it. */
  private failureReason(result: DomainResult): string {
    const errors = result.evidence
      .filter((item) => this.isLookupError(item))
      .map((item) => ReportLine.sourceError(item.source, item.detail ?? ReportText.UnknownError));
    if (errors.length > 0) return errors.join(TextSeparator.Error);
    return result.note ?? ReportText.UnknownError;
  }

  private isLookupError(item: Evidence): boolean {
    return item.source !== EvidenceSource.Dns && ERROR_RESULTS.has(item.result);
  }

  private skippedSection(): Section {
    if (this.report.invalid.length === 0) return [];
    const lines = this.report.invalid.map((entry) => ReportLine.invalid(entry.input, entry.reason));
    return [ReportHeading.Skipped, ...lines];
  }

  private notesSection(): Section {
    if (this.report.warnings.length === 0) return [];
    return [
      ReportHeading.Notes,
      ...this.report.warnings.map((warning) => ReportLine.note(warning)),
    ];
  }

  private disclosureSection(): Section {
    return hasAffiliateLinks(this.report) ? [AFFILIATE_DISCLOSURE] : [];
  }

  /** "2 reserved", only when there are any. */
  private countIfAny(results: readonly DomainResult[], label: string): string[] {
    return results.length > 0 ? [ReportLine.count(results.length, label)] : [];
  }

  private withStatus(status: DomainStatus): DomainResult[] {
    return this.report.results.filter((result) => result.status === status);
  }
}
