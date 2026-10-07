import { domainToASCII } from 'node:url';
import { getPublicSuffix } from 'tldts';
import { DEFAULT_MIN_YEARS, MIN_REGISTRATION_YEARS, PRICE_CURRENCY } from '../constants.js';
import { ICANN_ONLY } from '../core/domain-name.js';
import type { Price, PriceList } from '../core/types.js';

/** One TLD's numbers as a price source gives them, before they are checked. */
export interface PriceRow {
  tld: string;
  registration: number | undefined;
  renewal: number | undefined;
  /** When the source last updated them. */
  updated?: string;
}

/** A registrar API's numbers for one domain, before they are checked. */
export interface ExactPriceInput {
  /** First-year price per year. */
  registration: number | undefined;
  /** Renewal per year; the registration price when the API does not say. */
  renewal?: number;
  currency?: string;
  minYears: number;
  source: string;
}

/** A usable price: a finite number above zero. */
export function isPrice(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/** Shortest registration term of a TLD in years. */
export function minYearsFor(tld: string): number {
  return MIN_REGISTRATION_YEARS.get(tld) ?? DEFAULT_MIN_YEARS;
}

/** Shortest registration term of a domain's TLD in years: "acme.ai" -> 2. */
export function minYearsForDomain(domain: string): number {
  return minYearsFor(getPublicSuffix(domain, ICANN_ONLY) ?? '');
}

/** What owning the domain costs: the first term plus one renewal year. A promo first year alone would mislead. */
export function ownershipCost(price: Price): number {
  return price.registration * price.minYears + price.renewal;
}

/** Keeps only rows with sane numbers and keys them by ASCII TLD. */
export function toPriceList(rows: readonly PriceRow[], source: string): PriceList {
  const list = new Map<string, Price>();
  for (const row of rows) {
    const tld = domainToASCII(row.tld.toLowerCase());
    if (!tld || !isPrice(row.registration) || !isPrice(row.renewal)) continue;
    list.set(tld, listPrice(tld, row.registration, row.renewal, source, row.updated));
  }
  return list;
}

/** The price of one specific domain from a registrar API, or undefined when its numbers are not usable. */
export function exactPrice(input: ExactPriceInput): Price | undefined {
  const renewal = isPrice(input.renewal) ? input.renewal : input.registration;
  if (!isPrice(input.registration) || !isPrice(renewal)) return undefined;
  return {
    registration: input.registration,
    renewal,
    currency: input.currency ?? PRICE_CURRENCY,
    minYears: input.minYears,
    source: input.source,
    confirmed: true,
  };
}

function listPrice(
  tld: string,
  registration: number,
  renewal: number,
  source: string,
  updated?: string,
): Price {
  return {
    registration,
    renewal,
    currency: PRICE_CURRENCY,
    minYears: minYearsFor(tld),
    source,
    ...(updated && { updated }),
  };
}
