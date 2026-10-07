/** A cached load and when it stops being reused. */
interface CacheEntry<V> {
  promise: Promise<V>;
  expiresAt: number;
}

/**
 * One promise per key: concurrent callers share a single load, a failed load is forgotten
 * so the next call tries again, and a value is reused until `ttlMs` has passed.
 */
export class PromiseCache<K, V> {
  /** The loads so far, by key. */
  private readonly entries = new Map<K, CacheEntry<V>>();

  constructor(private readonly ttlMs: number = Number.POSITIVE_INFINITY) {}

  /** The cached value of `key`, or the result of `load` when there is none (or it expired). */
  get(key: K, load: () => Promise<V>): Promise<V> {
    const entry = this.entries.get(key);
    if (entry && Date.now() < entry.expiresAt) return entry.promise;
    const promise = load();
    this.entries.set(key, { promise, expiresAt: Date.now() + this.ttlMs });
    promise.catch(() => this.forget(key, promise));
    return promise;
  }

  /** Drops a failed load, unless a newer one replaced it already. */
  private forget(key: K, promise: Promise<V>): void {
    if (this.entries.get(key)?.promise === promise) this.entries.delete(key);
  }
}
