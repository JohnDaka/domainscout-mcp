import {
  PORKBUN_PRICING_URL,
  PORKBUN_STATUS_SUCCESS,
  PORKBUN_TLDS_PARAM,
  PORKBUN_TLDS_SEPARATOR,
} from '../constants.js';
import { ensureOk } from '../core/http.js';
import type { Network } from '../core/network.js';
import { type PriceList, RegistrarId } from '../core/types.js';
import { atHost, ErrorText, PriceSourceName } from '../messages/index.js';
import { type PriceRow, toPriceList } from './price.js';
import type { PriceSource } from './price-source.js';

/** One TLD in Porkbun's price list: decimal strings in USD. */
interface PorkbunTldPrice {
  registration?: string;
  renewal?: string;
}

/** Porkbun API v3 pricing reply. */
interface PorkbunPricing {
  status?: string;
  pricing?: Record<string, PorkbunTldPrice>;
}

/** Porkbun's public price list (API v3, no key needed). */
export class PorkbunPrices implements PriceSource {
  readonly registrar = RegistrarId.Porkbun;

  constructor(private readonly network: Network) {}

  /** Asks only for the needed TLDs: the full list (900+ TLDs) takes Porkbun several seconds. */
  async fetch(tlds: readonly string[]): Promise<PriceList> {
    const url = new URL(PORKBUN_PRICING_URL);
    url.searchParams.set(PORKBUN_TLDS_PARAM, tlds.join(PORKBUN_TLDS_SEPARATOR));
    const response = await this.network.request(url);
    await ensureOk(response, url);
    const data = (await response.json()) as PorkbunPricing;
    if (data.status !== PORKBUN_STATUS_SUCCESS || !data.pricing) {
      throw new Error(atHost(url.host, ErrorText.UnexpectedReply));
    }
    return toPriceList(this.toRows(data.pricing), PriceSourceName.Porkbun);
  }

  private toRows(pricing: Record<string, PorkbunTldPrice>): PriceRow[] {
    return Object.entries(pricing).map(([tld, price]) => ({
      tld,
      registration: Number(price.registration),
      renewal: Number(price.renewal),
    }));
  }
}
