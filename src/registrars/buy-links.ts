import type { BuyLink, ExactPrice, Price, PriceBookSnapshot, RegistrarId } from '../core/types.js';
import { ownershipCost } from '../pricing/price.js';
import { AFFILIATE_TEMPLATES, type AffiliateTemplates, affiliateUrl } from './affiliates.js';
import { ALL_REGISTRARS, registrarName, searchUrl } from './registrars.js';

/** What buy links are built from. */
export interface BuyLinkOptions {
  prices: PriceBookSnapshot;
  /** Registrars to link to. */
  registrars: readonly RegistrarId[];
  /** Use affiliate links where the project has them. */
  affiliate: boolean;
  /** Exact price for this very domain from a registrar API; replaces that registrar's list price. */
  confirmed?: ExactPrice;
  /** Affiliate templates; the project's own unless a test passes others. */
  templates?: AffiliateTemplates;
}

/**
 * Buy links for a free domain, cheapest first. Registrars without a known price keep their
 * default order after the priced ones. Commission never affects the order.
 */
export function buyLinks(domain: string, tld: string, options: BuyLinkOptions): BuyLink[] {
  const shown = ALL_REGISTRARS.filter((id) => options.registrars.includes(id));
  const links = shown.map((id) => buyLink(id, domain, tld, options));
  return links.sort((a, b) => compareByCost(a.price, b.price));
}

/** One registrar's link, with its price when one is known. */
function buyLink(id: RegistrarId, domain: string, tld: string, options: BuyLinkOptions): BuyLink {
  const plainUrl = searchUrl(id, domain);
  const template = affiliateTemplate(id, options);
  const price = priceAt(id, tld, options);
  return {
    registrar: registrarName(id),
    url: template ? affiliateUrl(template, plainUrl, domain) : plainUrl,
    affiliate: template !== undefined,
    ...(price && { price }),
  };
}

/** The registrar's affiliate template, when affiliate links are on and the project has one. */
function affiliateTemplate(id: RegistrarId, options: BuyLinkOptions): string | undefined {
  if (!options.affiliate) return undefined;
  return (options.templates ?? AFFILIATE_TEMPLATES).get(id);
}

/** The exact price a registrar quoted for this name, or else its list price for the TLD. */
function priceAt(id: RegistrarId, tld: string, options: BuyLinkOptions): Price | undefined {
  if (options.confirmed?.registrar === id) return options.confirmed.price;
  return options.prices.get(id)?.get(tld);
}

/** Priced links first, cheapest to own first; unpriced ones keep their order. */
function compareByCost(a: Price | undefined, b: Price | undefined): number {
  if (a && b) return ownershipCost(a) - ownershipCost(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}
