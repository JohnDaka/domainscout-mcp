import { PRICE_LIST_TTL_MS, Retry } from '../constants.js';
import type { Network } from '../core/network.js';
import { withRetry } from '../core/retry.js';
import type { PriceService } from '../core/services.js';
import type { Price, PriceBookSnapshot, PriceList, RegistrarId } from '../core/types.js';
import { CloudflarePrices } from './cloudflare-prices.js';
import { PorkbunPrices } from './porkbun-prices.js';
import type { PriceSource } from './price-source.js';

/** One TLD's price at one registrar, and when it was loaded. */
interface CachedPrice {
  /** Undefined: the registrar does not sell this TLD. */
  price?: Price;
  loadedAt: number;
}

/** Cached prices of one registrar, by TLD. */
type RegistrarCache = Map<string, CachedPrice>;

/**
 * Public, key-free price lists, cached per TLD for a day. Prices are optional: a source that
 * fails shows no prices, and the next call tries it again.
 */
export class PriceBook implements PriceService {
  /** Prices per registrar, by TLD. */
  private readonly cache = new Map<RegistrarId, RegistrarCache>();

  constructor(
    private readonly network: Network,
    private readonly sources: readonly PriceSource[] = [
      new CloudflarePrices(network),
      new PorkbunPrices(network),
    ],
  ) {}

  /** Fetches what is missing or stale for these TLDs. Never throws: each source settles on its own. */
  async load(tlds: readonly string[]): Promise<void> {
    await Promise.allSettled(this.sources.map((source) => this.refresh(source, tlds)));
  }

  /** Prices known right now. */
  snapshot(): PriceBookSnapshot {
    const snapshot = new Map<RegistrarId, PriceList>();
    for (const [registrar, cache] of this.cache) snapshot.set(registrar, this.freshPrices(cache));
    return snapshot;
  }

  private async refresh(source: PriceSource, tlds: readonly string[]): Promise<void> {
    const cache = this.cacheOf(source.registrar);
    const missing = tlds.filter((tld) => !this.isFresh(cache.get(tld)));
    if (missing.length === 0) return;
    const list = await this.fetch(source, missing);
    this.store(cache, missing, list);
  }

  private fetch(source: PriceSource, tlds: readonly string[]): Promise<PriceList> {
    return withRetry(() => this.network.run(() => source.fetch(tlds)), Retry.prices);
  }

  /** A TLD the source does not list is remembered too: no need to ask again today. */
  private store(cache: RegistrarCache, requested: readonly string[], list: PriceList): void {
    const loadedAt = Date.now();
    for (const tld of requested) cache.set(tld, { loadedAt });
    for (const [tld, price] of list) cache.set(tld, { price, loadedAt });
  }

  private freshPrices(cache: RegistrarCache): PriceList {
    const prices = new Map<string, Price>();
    for (const [tld, entry] of cache) {
      if (entry.price && this.isFresh(entry)) prices.set(tld, entry.price);
    }
    return prices;
  }

  private isFresh(entry: CachedPrice | undefined): boolean {
    return entry !== undefined && Date.now() - entry.loadedAt < PRICE_LIST_TTL_MS;
  }

  private cacheOf(registrar: RegistrarId): RegistrarCache {
    const existing = this.cache.get(registrar);
    if (existing) return existing;
    const cache: RegistrarCache = new Map();
    this.cache.set(registrar, cache);
    return cache;
  }
}
