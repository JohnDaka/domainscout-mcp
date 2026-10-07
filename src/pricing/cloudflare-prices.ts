import { CLOUDFLARE_PRICES_URL } from '../constants.js';
import { ensureOk } from '../core/http.js';
import type { Network } from '../core/network.js';
import { type PriceList, RegistrarId } from '../core/types.js';
import { PriceSourceName } from '../messages/index.js';
import { type PriceRow, toPriceList } from './price.js';
import type { PriceSource } from './price-source.js';

/** One TLD in the mirror: per-year USD prices. */
interface CloudflareTldPrice {
  registration?: number;
  renewal?: number;
  updatedAt?: string;
}

/** cfdomainpricing.com reply: every TLD Cloudflare sells. */
type CloudflarePricing = Record<string, CloudflareTldPrice>;

/**
 * Cloudflare sells at cost but has no public price API; cfdomainpricing.com mirrors the prices
 * on Cloudflare's own search page. The file is small, so it is always fetched whole.
 */
export class CloudflarePrices implements PriceSource {
  readonly registrar = RegistrarId.Cloudflare;

  constructor(private readonly network: Network) {}

  async fetch(): Promise<PriceList> {
    const url = new URL(CLOUDFLARE_PRICES_URL);
    const response = await this.network.request(url);
    await ensureOk(response, url);
    const data = (await response.json()) as CloudflarePricing;
    return toPriceList(this.toRows(data), PriceSourceName.Cloudflare);
  }

  private toRows(pricing: CloudflarePricing): PriceRow[] {
    return Object.entries(pricing).map(([tld, price]) => ({
      tld,
      registration: price.registration,
      renewal: price.renewal,
      updated: price.updatedAt,
    }));
  }
}
