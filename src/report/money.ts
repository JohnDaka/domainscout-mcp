import { PRICE_LOCALE } from '../constants.js';

/** Intl formats amounts as money in this style. */
const CURRENCY_STYLE = 'currency';

/** One formatter per currency: creating them is slow, and a report formats hundreds of prices. */
const formatters = new Map<string, Intl.NumberFormat>();

/** "$10.46" */
export function formatMoney(amount: number, currency: string): string {
  return formatterFor(currency).format(amount);
}

function formatterFor(currency: string): Intl.NumberFormat {
  const existing = formatters.get(currency);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat(PRICE_LOCALE, { style: CURRENCY_STYLE, currency });
  formatters.set(currency, formatter);
  return formatter;
}
