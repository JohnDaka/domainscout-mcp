import { describe, expect, it } from 'vitest';
import { EnvVar } from '../src/constants.js';
import { Network } from '../src/core/network.js';
import { type Price, type PriceList, RegistrarId } from '../src/core/types.js';
import {
  exactPrice,
  minYearsFor,
  minYearsForDomain,
  ownershipCost,
  toPriceList,
} from '../src/pricing/price.js';
import { PriceBook } from '../src/pricing/price-book.js';
import type { PriceSource } from '../src/pricing/price-source.js';
import { affiliateUrl } from '../src/registrars/affiliates.js';
import { buyLinks } from '../src/registrars/buy-links.js';
import { ALL_REGISTRARS } from '../src/registrars/registrars.js';
import { testConfig } from './fakes.js';
import { byPrefix, json, mockFetch } from './http-mock.js';

const price = (registration: number, renewal: number, extra: Partial<Price> = {}): Price => ({
  registration,
  renewal,
  currency: 'USD',
  minYears: 1,
  source: 'test',
  ...extra,
});

describe('toPriceList', () => {
  it('keeps sane prices, keys them by ASCII TLD and applies minimum terms', () => {
    const list = toPriceList(
      [
        { tld: 'COM', registration: 10.46, renewal: 10.46, updated: '2026-10-06' },
        { tld: 'ai', registration: 80, renewal: 80 },
        { tld: 'ëxample', registration: 5, renewal: 6 },
        { tld: 'broken', registration: Number.NaN, renewal: 10 },
        { tld: 'free', registration: 0, renewal: 10 },
      ],
      'test source',
    );
    expect(list.get('com')).toEqual({
      registration: 10.46,
      renewal: 10.46,
      currency: 'USD',
      minYears: 1,
      source: 'test source',
      updated: '2026-10-06',
    });
    expect(list.get('ai')?.minYears).toBe(2);
    expect(list.has('xn--xample-ova')).toBe(true);
    expect(list.has('broken')).toBe(false);
    expect(list.has('free')).toBe(false);
  });
});

describe('PriceBook', () => {
  const PORKBUN = 'https://api.porkbun.com/api/json/v3/pricing/get';
  const CLOUDFLARE = 'https://cfdomainpricing.com/prices.json';
  const network = () => new Network(testConfig({ [EnvVar.TimeoutMs]: '1000' }));
  const book = () => new PriceBook(network());

  /** Porkbun answers only for the TLDs asked for; Cloudflare's mirror lists everything it sells. */
  const sources = (
    porkbun: unknown = {
      status: 'SUCCESS',
      pricing: {
        com: { registration: '11.08', renewal: '11.08' },
        de: { registration: '2.90', renewal: '4.07' },
      },
    },
  ) =>
    mockFetch(
      byPrefix({
        [PORKBUN]: () => json(porkbun),
        [CLOUDFLARE]: () =>
          json({ com: { registration: 10.46, renewal: 10.46, updatedAt: '2026-10-06' } }),
      }),
    );

  it('loads both sources and asks Porkbun only for the TLDs in question', async () => {
    const calls = sources();
    const prices = book();
    await prices.load(['com', 'de']);
    const snapshot = prices.snapshot();
    expect(snapshot.get(RegistrarId.Cloudflare)?.get('com')).toMatchObject({
      registration: 10.46,
      updated: '2026-10-06',
    });
    expect(snapshot.get(RegistrarId.Porkbun)?.get('de')).toMatchObject({
      registration: 2.9,
      renewal: 4.07,
    });
    expect(snapshot.get(RegistrarId.Cloudflare)?.has('de')).toBe(false);
    expect(
      new URL(calls.find((call) => call.url.startsWith(PORKBUN))?.url ?? '').searchParams.get(
        'tlds',
      ),
    ).toBe('com,de');
  });

  it('remembers prices, and TLDs a registrar does not sell, for the day', async () => {
    const calls = sources();
    const prices = book();
    await prices.load(['com', 'de']);
    await prices.load(['com', 'de']);
    expect(calls).toHaveLength(2);
  });

  it('drops a source that answers with an error and keeps the other', async () => {
    sources({ status: 'ERROR', message: 'nope' });
    const prices = book();
    await prices.load(['com']);
    expect(prices.snapshot().get(RegistrarId.Porkbun)?.size ?? 0).toBe(0);
    expect(prices.snapshot().get(RegistrarId.Cloudflare)?.size).toBe(1);
  });

  it('returns nothing and does not throw when every source is unreachable', async () => {
    mockFetch(() => {
      throw new TypeError('offline');
    });
    const prices = book();
    await prices.load(['com']);
    expect([...prices.snapshot().values()].every((list) => list.size === 0)).toBe(true);
  }, 15_000);

  it('takes its sources from the caller, and tries a failed source again on the next call', async () => {
    let calls = 0;
    const flaky: PriceSource = {
      registrar: RegistrarId.Dynadot,
      fetch: async (): Promise<PriceList> => {
        calls++;
        if (calls === 1) throw new Error('down');
        return toPriceList([{ tld: 'com', registration: 9, renewal: 9 }], 'test');
      },
    };
    const prices = new PriceBook(network(), [flaky]);
    await prices.load(['com']);
    expect(prices.snapshot().get(RegistrarId.Dynadot)?.size ?? 0).toBe(0);
    await prices.load(['com']);
    expect(prices.snapshot().get(RegistrarId.Dynadot)?.get('com')?.registration).toBe(9);
  });
});

describe('price helpers', () => {
  it('falls back to the registration price for renewal and rejects unusable numbers', () => {
    expect(exactPrice({ registration: 12, minYears: 1, source: 'api' })).toMatchObject({
      renewal: 12,
      confirmed: true,
    });
    expect(exactPrice({ registration: Number.NaN, minYears: 1, source: 'api' })).toBeUndefined();
  });

  it('knows the minimum term of a TLD and of a domain', () => {
    expect(minYearsFor('ai')).toBe(2);
    expect(minYearsFor('com')).toBe(1);
    expect(minYearsForDomain('acme.ai')).toBe(2);
    expect(minYearsForDomain('acme.co.uk')).toBe(1);
  });

  it('counts the first term plus one renewal year as the cost of owning a domain', () => {
    expect(ownershipCost(price(5, 20))).toBe(25);
    expect(ownershipCost(price(80, 80, { minYears: 2 }))).toBe(240);
  });
});

describe('buyLinks', () => {
  const base = {
    prices: new Map(),
    registrars: ALL_REGISTRARS,
    affiliate: true,
    templates: new Map(),
  };

  it('puts the cheapest first, judged by first year plus one renewal, and keeps unpriced ones after', () => {
    const prices = new Map([
      // A cheap promo first year that renews expensively must not win.
      [RegistrarId.Porkbun, new Map([['com', price(5, 20)]])],
      [RegistrarId.Cloudflare, new Map([['com', price(10.46, 10.46)]])],
    ]);
    const links = buyLinks('acme.com', 'com', { ...base, prices });
    expect(links.map((link) => link.registrar)).toEqual([
      'Cloudflare',
      'Porkbun',
      'Namecheap',
      'Spaceship',
      'GoDaddy',
      'Name.com',
      'Dynadot',
      'NameSilo',
      'Hover',
    ]);
    expect(links[0]?.price?.registration).toBe(10.46);
    expect(links[2]?.price).toBeUndefined();
  });

  it('builds search links that need no login, plain while no affiliate template is set', () => {
    const links = buyLinks('acme.ai', 'ai', base);
    expect(links.find((link) => link.registrar === 'Cloudflare')?.url).toBe(
      'https://www.cloudflare.com/domains/search/?q=acme.ai',
    );
    expect(links.find((link) => link.registrar === 'Name.com')?.url).toBe(
      'https://www.name.com/domain/search/acme.ai',
    );
    expect(links.every((link) => !link.affiliate)).toBe(true);
  });

  it('uses the project templates when the caller passes none', () => {
    const { templates: _templates, ...withoutTemplates } = base;
    const links = buyLinks('acme.com', 'com', withoutTemplates);
    expect(links).toHaveLength(ALL_REGISTRARS.length);
  });

  it('wraps links of registrars that have a template, unless affiliate links are off', () => {
    const templates = new Map([
      [RegistrarId.Namecheap, 'https://namecheap.pxf.io/c/1/2/3?u={url}'],
    ]);
    const tracked = buyLinks('acme.com', 'com', { ...base, templates });
    const namecheap = tracked.find((link) => link.registrar === 'Namecheap');
    expect(namecheap).toMatchObject({ affiliate: true });
    expect(namecheap?.url).toBe(
      'https://namecheap.pxf.io/c/1/2/3?u=https%3A%2F%2Fwww.namecheap.com%2Fdomains%2Fregistration%2Fresults%2F%3Fdomain%3Dacme.com',
    );
    const plain = buyLinks('acme.com', 'com', { ...base, templates, affiliate: false });
    expect(plain.some((link) => link.affiliate)).toBe(false);
  });

  it('shows only the configured registrars', () => {
    const links = buyLinks('acme.com', 'com', {
      ...base,
      registrars: [RegistrarId.Porkbun, RegistrarId.Dynadot],
    });
    expect(links.map((link) => link.registrar)).toEqual(['Porkbun', 'Dynadot']);
  });

  it("uses a registrar's exact price for this name instead of its list price", () => {
    const prices = new Map([[RegistrarId.Porkbun, new Map([['com', price(11.08, 11.08)]])]]);
    const confirmed = {
      registrar: RegistrarId.Porkbun,
      price: price(2_500, 11.08, { confirmed: true }),
    };
    const links = buyLinks('acme.com', 'com', { ...base, prices, confirmed });
    expect(links.find((link) => link.registrar === 'Porkbun')?.price).toMatchObject({
      registration: 2_500,
    });
  });
});

describe('affiliateUrl', () => {
  it.each([
    [
      'https://x.pxf.io/c/1/2/3?u={url}',
      'https://x.pxf.io/c/1/2/3?u=https%3A%2F%2Fr.test%2Fs%3Fq%3Da.com',
    ],
    [
      'https://www.anrdoezrs.net/links/9/type/dlg/{rawUrl}',
      'https://www.anrdoezrs.net/links/9/type/dlg/https://r.test/s?q=a.com',
    ],
    ['https://r.test/search?query={domain}&rid=abc', 'https://r.test/search?query=a.com&rid=abc'],
  ])('%s', (template, expected) => {
    expect(affiliateUrl(template, 'https://r.test/s?q=a.com', 'a.com')).toBe(expected);
  });

  it('does not treat $ sequences in the URL as replacement patterns', () => {
    expect(affiliateUrl('{rawUrl}', 'https://r.test/$&x', 'a.com')).toBe('https://r.test/$&x');
  });
});
