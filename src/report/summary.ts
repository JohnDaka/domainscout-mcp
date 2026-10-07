import { TextSeparator } from '../constants.js';
import { DomainStatus, type InvalidEntry, type Report } from '../core/types.js';
import { ReportLine } from '../messages/index.js';

/** How many domains got each status, how many were checked and how long it took. */
export type Summary = Record<DomainStatus, number> & { total: number; elapsed_ms: number };

/** Counts per status. */
export function summarize(report: Report): Summary {
  const counts = new Map<DomainStatus, number>(
    Object.values(DomainStatus).map((status) => [status, 0]),
  );
  for (const { status } of report.results) counts.set(status, (counts.get(status) ?? 0) + 1);
  return {
    ...(Object.fromEntries(counts) as Record<DomainStatus, number>),
    total: report.results.length,
    elapsed_ms: report.elapsedMs,
  };
}

/** Some buy link in the report earns the project a commission. */
export function hasAffiliateLinks(report: Report): boolean {
  return report.results.some((result) => result.buy?.some((link) => link.affiliate));
}

/** Why a call was rejected, followed by the skipped entries. */
export function rejectionText(message: string, invalid: readonly InvalidEntry[]): string {
  const skipped = invalid.map((entry) => ReportLine.invalid(entry.input, entry.reason));
  return [message, ...skipped].join(TextSeparator.Line);
}
