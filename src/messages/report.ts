import { EnvVar, TextSeparator } from '../constants.js';

/** Section headings of the text report. */
export const ReportHeading = {
  Available: 'AVAILABLE (where to buy, cheapest first):',
  AvailableCompact: 'AVAILABLE (cheapest known offer for each):',
  Taken: 'TAKEN:',
  Reserved: 'RESERVED:',
  Unknown: 'COULD NOT VERIFY (try again later):',
  Skipped: 'SKIPPED:',
  Notes: 'NOTES:',
} as const;

/** Labels of the counts in the summary line. */
export const CountLabel = {
  Free: 'available',
  Taken: 'taken',
  Reserved: 'reserved',
  Unknown: 'unknown',
} as const;

/** Fixed sentences of the text report. */
export const ReportText = {
  /** Under the free domains: what "available" means without a registrar's confirmation. */
  AvailableFootnote:
    "Not confirmed by a registrar means: not found in the registry or DNS. Prices are standard list prices; premium or reserved names look the same, so the registrar's page shows the final price.",
  /** Under a compact list: how to get every registrar's link. */
  CompactFootnote:
    'Each line shows the cheapest known offer. Check a few chosen names again to see every registrar, including links for registrars without public prices.',
  /** A failure without a description. */
  UnknownError: 'unknown error',
} as const;

/** Tells the user that some buy links earn the project a commission. */
export const AFFILIATE_DISCLOSURE =
  'Some buy links are affiliate links: if you buy through them, the domainscout project may earn ' +
  `a commission at no extra cost to you. Set ${EnvVar.Affiliate}=off to get plain links.`;

/** Builders of the text report's lines. */
export const ReportLine = {
  /** "Checked 9 domain(s) in 1.5s: 5 available, 4 taken." */
  summary: (total: number, seconds: string, counts: readonly string[]): string =>
    `Checked ${total} domain(s) in ${seconds}s: ${counts.join(TextSeparator.List)}.`,

  /** "5 available" */
  count: (count: number, label: string): string => `${count} ${label}`,

  /** "TAKEN: a.com, b.com" */
  inline: (heading: string, items: readonly string[]): string =>
    `${heading} ${items.join(TextSeparator.List)}`,

  /** "- acme.ai (confirmed by Porkbun)" */
  available: (name: string, confirmedBy?: string, premium?: boolean): string => {
    if (!confirmedBy) return `- ${name}`;
    if (premium) return `- ${name} (PREMIUM name, confirmed by ${confirmedBy})`;
    return `- ${name} (confirmed by ${confirmedBy})`;
  },

  /** "  Sold for at least 2 years at a time." */
  minTerm: (years: number): string => `  Sold for at least ${years} years at a time.`,

  /** "  Cloudflare: $10.46/yr, renews at $10.46/yr: https://…" */
  pricedLink: (registrar: string, price: string, renewal: string, url: string, exact: boolean) =>
    `  ${registrar}: ${price}/yr, renews at ${renewal}/yr${exact ? ' (exact price for this name)' : ''}: ${url}`,

  /** "  Namecheap: https://…" */
  plainLink: (registrar: string, url: string): string => `  ${registrar}: ${url}`,

  /** "- acme.com: $10.46/yr at Cloudflare https://…": one free domain of a long list. */
  compact: (entry: string, offer: string, url: string): string => `${entry}: ${offer} ${url}`,

  /** "$10.46/yr at Cloudflare", or with details: "$5.98/yr at Porkbun (renews at $11.08/yr)" */
  offer: (price: string, registrar: string, details: readonly string[]): string =>
    details.length > 0
      ? `${price}/yr at ${registrar} (${details.join(TextSeparator.List)})`
      : `${price}/yr at ${registrar}`,

  /** "renews at $11.08/yr" */
  renewsAt: (price: string): string => `renews at ${price}/yr`,

  /** "2-year minimum" */
  minimumYears: (years: number): string => `${years}-year minimum`,

  /** "acme.com (in deletion, may become available soon)" */
  dropping: (name: string): string => `${name} (in deletion, may become available soon)`,

  /** "acme.com (until 2027-03-01)" */
  until: (name: string, date: string): string => `${name} (until ${date})`,

  /** "- acme.io: RDAP: HTTP 503" */
  failure: (name: string, reason: string): string => `- ${name}: ${reason}`,

  /** "RDAP: HTTP 503" */
  sourceError: (source: string, detail: string): string => `${source.toUpperCase()}: ${detail}`,

  /** '- "foo_bar": only letters, digits and hyphens are allowed' */
  invalid: (input: string, reason: string): string => `- "${input}": ${reason}`,

  /** "- <note>" */
  note: (text: string): string => `- ${text}`,

  /** The confirmation limit cut the list short. */
  confirmLimited: (confirmed: number, total: number): string =>
    `Confirmed the first ${confirmed} of ${total} free domains with registrar APIs (limit: ${EnvVar.ConfirmMax}).`,

  /** "Porkbun API: API key rejected; …" */
  apiFailed: (registrar: string, detail: string): string => `${registrar} API: ${detail}`,
} as const;
