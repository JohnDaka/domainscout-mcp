import { describe, expect, it } from 'vitest';
import { chunk } from '../src/core/arrays.js';
import { PromiseCache } from '../src/core/promise-cache.js';

describe('PromiseCache', () => {
  it('shares one load between concurrent callers', async () => {
    const cache = new PromiseCache<string, number>();
    let loads = 0;
    const load = async () => ++loads;
    const [first, second] = await Promise.all([cache.get('a', load), cache.get('a', load)]);
    expect([first, second, loads]).toEqual([1, 1, 1]);
  });

  it('forgets a failed load, so the next call tries again', async () => {
    const cache = new PromiseCache<string, string>();
    await expect(cache.get('a', () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.get('a', async () => 'up')).toBe('up');
  });

  it('loads again once the value has expired', async () => {
    const cache = new PromiseCache<string, number>(0);
    let loads = 0;
    await cache.get('a', async () => ++loads);
    expect(await cache.get('a', async () => ++loads)).toBe(2);
  });
});

describe('chunk', () => {
  it('splits a list into parts of at most the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
