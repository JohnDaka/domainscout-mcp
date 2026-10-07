import { describe, expect, it } from 'vitest';
import { CloudflareApi } from '../src/confirm/apis/cloudflare-api.js';
import { NameComApi } from '../src/confirm/apis/namecom-api.js';
import { PorkbunApi } from '../src/confirm/apis/porkbun-api.js';
import { SpaceshipApi } from '../src/confirm/apis/spaceship-api.js';
import type { RegistrarApi } from '../src/confirm/registrar-api.js';
import { createRegistrarApis } from '../src/confirm/registrar-apis.js';
import { CredentialsRejectedError, RetryableError } from '../src/core/errors.js';
import { Network } from '../src/core/network.js';
import { ConfirmState, RegistrarId } from '../src/core/types.js';
import { testConfig } from './fakes.js';
import { bodyOf, headersOf, json, mockFetch } from './http-mock.js';

// Replies in this file are the examples from each registrar's API documentation.
const network = () => new Network(testConfig());
const byDomain = async (api: RegistrarApi, domains: string[]) =>
  Object.fromEntries(
    (await api.check(domains, network())).map((answer) => [answer.domain, answer]),
  );

describe('Porkbun', () => {
  const keys = { apiKey: 'pk1_secret_key', secretKey: 'sk1_secret_key' };

  it('reads a bulk reply: available, premium, taken and unresolved names', async () => {
    const calls = mockFetch(() =>
      json({
        status: 'SUCCESS',
        checked: 4,
        domains: {
          'free.com': {
            avail: 'yes',
            type: 'registration',
            price: '9.73',
            firstYearPromo: 'yes',
            regularPrice: '11.08',
            premium: 'no',
            minDuration: 1,
            additional: { renewal: { type: 'renewal', price: '11.08', regularPrice: '11.08' } },
          },
          'fancy.ai': { avail: 'yes', price: '2500.00', premium: 'yes', minDuration: 2 },
          'taken.com': { avail: 'no', premium: 'no' },
        },
        unresolved: ['slow.de'],
        invalid: [],
        limits: { countedIn: 'domains' },
      }),
    );
    const answers = await byDomain(new PorkbunApi(keys), [
      'free.com',
      'fancy.ai',
      'taken.com',
      'slow.de',
    ]);

    expect(calls[0]?.url).toBe('https://api.porkbun.com/api/json/v3/domain/checkDomain');
    expect(bodyOf(calls[0])).toEqual({
      apikey: keys.apiKey,
      secretapikey: keys.secretKey,
      domains: ['free.com', 'fancy.ai', 'taken.com', 'slow.de'],
    });
    expect(answers['free.com']).toMatchObject({
      state: ConfirmState.Available,
      premium: false,
      price: { registration: 9.73, renewal: 11.08, minYears: 1, confirmed: true },
    });
    expect(answers['fancy.ai']).toMatchObject({
      premium: true,
      price: { registration: 2500, minYears: 2 },
    });
    expect(answers['taken.com']?.state).toBe(ConfirmState.Unavailable);
    expect(answers['slow.de']?.state).toBe(ConfirmState.Error);
  });

  it('reports a rejected key without repeating it', async () => {
    mockFetch(() =>
      json(
        {
          status: 'ERROR',
          message: 'Invalid API key. (001)',
          code: 'INVALID_API_KEYS_001',
          requestId: 'r',
        },
        400,
      ),
    );
    const failure = new PorkbunApi(keys).check(['a.com'], network());
    await expect(failure).rejects.toBeInstanceOf(CredentialsRejectedError);
    await expect(failure).rejects.not.toThrow(keys.secretKey);
  });

  it('splits a batch the registry finds too slow', async () => {
    const calls = mockFetch((call) => {
      const { domains } = bodyOf(call) as { domains: string[] };
      if (domains.length > 1)
        return json({ status: 'ERROR', code: 'BULK_CHECK_TOO_SLOW', message: 'slow' }, 400);
      return json({ status: 'SUCCESS', domains: { [domains[0] ?? '']: { avail: 'no' } } });
    });
    const answers = await new PorkbunApi(keys).check(['a.de', 'b.de'], network());
    expect(answers.map((answer) => answer.state)).toEqual([
      ConfirmState.Unavailable,
      ConfirmState.Unavailable,
    ]);
    expect(calls).toHaveLength(3);
  });

  it("passes on the server's Retry-After for 429", async () => {
    mockFetch(() =>
      json({ status: 'ERROR', code: 'RATE_LIMIT_EXCEEDED' }, 429, { 'retry-after': '7' }),
    );
    const failure = new PorkbunApi(keys).check(['a.com'], network());
    await expect(failure).rejects.toBeInstanceOf(RetryableError);
    await expect(failure).rejects.toMatchObject({ retryAfterMs: 7_000 });
  });
});

describe('Name.com', () => {
  const keys = { username: 'scout', token: 'secret-token' };

  it('reads results and turns minimum-term totals into per-year prices', async () => {
    const calls = mockFetch(() =>
      json({
        results: [
          {
            domainName: 'example.org',
            sld: 'example',
            tld: 'org',
            purchasable: true,
            purchasePrice: 12.99,
            purchaseType: 'registration',
            renewalPrice: 12.99,
          },
          {
            domainName: 'acme.ai',
            sld: 'acme',
            tld: 'ai',
            purchasable: true,
            purchasePrice: 199.98,
            renewalPrice: 199.98,
          },
          {
            domainName: 'gold.com',
            sld: 'gold',
            tld: 'com',
            purchasable: true,
            premium: true,
            purchasePrice: 9_999,
          },
          { domainName: 'google.com', sld: 'google', tld: 'com', purchasable: false },
          {
            domainName: 'busy.com',
            sld: 'busy',
            tld: 'com',
            purchasable: false,
            reason: 'Registry maintenance',
          },
        ],
      }),
    );
    const answers = await byDomain(new NameComApi(keys), [
      'example.org',
      'acme.ai',
      'gold.com',
      'google.com',
      'busy.com',
    ]);

    expect(calls[0]?.url).toBe('https://api.name.com/core/v1/domains:checkAvailability');
    expect(headersOf(calls[0]).authorization).toBe(
      `Basic ${Buffer.from('scout:secret-token').toString('base64')}`,
    );
    expect(bodyOf(calls[0])).toMatchObject({ purchaseType: 'registration' });
    expect(answers['example.org']).toMatchObject({
      state: ConfirmState.Available,
      price: { registration: 12.99 },
    });
    expect(answers['acme.ai']).toMatchObject({
      price: { registration: 99.99, renewal: 99.99, minYears: 2 },
    });
    expect(answers['gold.com']).toMatchObject({ state: ConfirmState.Available, premium: true });
    expect(answers['gold.com']?.price).toBeUndefined();
    expect(answers['google.com']?.state).toBe(ConfirmState.Unavailable);
    expect(answers['busy.com']).toMatchObject({
      state: ConfirmState.Error,
      detail: 'Registry maintenance',
    });
  });

  it("treats 422 as 'no supported TLD in this batch'", async () => {
    mockFetch(() => json({ message: 'Unprocessable Entity' }, 422));
    const answers = await new NameComApi(keys).check(['a.xyz'], network());
    expect(answers).toEqual([{ domain: 'a.xyz', state: ConfirmState.Unsupported }]);
  });

  it('reports a rejected token', async () => {
    mockFetch(() => json({ message: 'Unauthorized' }, 401));
    await expect(new NameComApi(keys).check(['a.com'], network())).rejects.toBeInstanceOf(
      CredentialsRejectedError,
    );
  });

  it('refuses a reply that is not JSON', async () => {
    mockFetch(
      () =>
        new Response('Disallowed Key Characters.', { headers: { 'content-type': 'text/html' } }),
    );
    await expect(new NameComApi(keys).check(['a.com'], network())).rejects.toThrow(
      /unexpected reply/,
    );
  });
});

describe('Spaceship', () => {
  const keys = { apiKey: 'key', apiSecret: 'secret' };

  it('reads results; premium names come with their premium price', async () => {
    const calls = mockFetch(() =>
      json({
        domains: [
          { domain: 'free.dev', result: 'available', premiumPricing: [] },
          {
            domain: 'gold.dev',
            result: 'available',
            premiumPricing: [
              { operation: 'register', price: 1_200, currency: 'USD' },
              { operation: 'renew', price: 50, currency: 'USD' },
            ],
          },
          { domain: 'taken.dev', result: 'taken', premiumPricing: [] },
          { domain: 'x.zz', result: 'tldNotSupported', premiumPricing: [] },
          { domain: 'odd.dev', result: 'unexpectedError', premiumPricing: [] },
        ],
      }),
    );
    const answers = await byDomain(new SpaceshipApi(keys), [
      'free.dev',
      'gold.dev',
      'taken.dev',
      'x.zz',
      'odd.dev',
    ]);

    expect(calls[0]?.url).toBe('https://spaceship.dev/api/v1/domains/available');
    expect(headersOf(calls[0])).toMatchObject({ 'x-api-key': 'key', 'x-api-secret': 'secret' });
    expect(answers['free.dev']).toMatchObject({ state: ConfirmState.Available, premium: false });
    expect(answers['free.dev']?.price).toBeUndefined();
    expect(answers['gold.dev']).toMatchObject({
      premium: true,
      price: { registration: 1_200, renewal: 50 },
    });
    expect(answers['taken.dev']?.state).toBe(ConfirmState.Unavailable);
    expect(answers['x.zz']?.state).toBe(ConfirmState.Unsupported);
    expect(answers['odd.dev']?.state).toBe(ConfirmState.Error);
  });

  it('reports a rejected key', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ detail: 'Api key or secret not provided.' }), {
          status: 401,
          headers: { 'content-type': 'application/problem+json' },
        }),
    );
    await expect(new SpaceshipApi(keys).check(['a.dev'], network())).rejects.toBeInstanceOf(
      CredentialsRejectedError,
    );
  });
});

describe('Cloudflare', () => {
  const keys = { accountId: '0123456789abcdef0123456789abcdef', apiToken: 'cf-token' };

  it('reads the documented examples', async () => {
    const calls = mockFetch(() =>
      json({
        errors: [],
        messages: [],
        success: true,
        result: {
          domains: [
            {
              name: 'acmecorp.dev',
              registrable: true,
              tier: 'standard',
              pricing: { currency: 'USD', registration_cost: '10.11', renewal_cost: '10.11' },
            },
            { name: 'example.com', reason: 'domain_unavailable', registrable: false },
            { name: 'coffee.xyz', reason: 'domain_premium', registrable: false, tier: 'premium' },
            { name: 'mybrand.uk', reason: 'extension_not_supported_via_api', registrable: false },
            { name: 'example.horse', reason: 'extension_not_supported', registrable: false },
          ],
        },
      }),
    );
    const answers = await byDomain(new CloudflareApi(keys), [
      'acmecorp.dev',
      'example.com',
      'coffee.xyz',
      'mybrand.uk',
      'example.horse',
    ]);

    expect(calls[0]?.url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/registrar/domain-check',
    );
    expect(headersOf(calls[0]).authorization).toBe('Bearer cf-token');
    expect(answers['acmecorp.dev']).toMatchObject({
      state: ConfirmState.Available,
      premium: false,
      price: { registration: 10.11, renewal: 10.11 },
    });
    expect(answers['example.com']?.state).toBe(ConfirmState.Unavailable);
    expect(answers['coffee.xyz']).toMatchObject({ state: ConfirmState.Available, premium: true });
    expect(answers['mybrand.uk']?.state).toBe(ConfirmState.Unsupported);
    expect(answers['example.horse']?.state).toBe(ConfirmState.Unsupported);
  });

  it('recognizes a rejected token even though Cloudflare answers 400', async () => {
    mockFetch(() =>
      json(
        {
          success: false,
          errors: [
            { code: 9106, message: 'Missing X-Auth-Key, X-Auth-Email or Authorization headers' },
          ],
          messages: [],
          result: null,
        },
        400,
      ),
    );
    await expect(new CloudflareApi(keys).check(['a.com'], network())).rejects.toBeInstanceOf(
      CredentialsRejectedError,
    );
  });

  it("treats 'no supported domains' as unsupported", async () => {
    mockFetch(() =>
      json(
        {
          success: false,
          errors: [{ code: 1008, message: 'no valid domains' }],
          messages: [],
          result: null,
        },
        400,
      ),
    );
    expect(await new CloudflareApi(keys).check(['a.horse'], network())).toEqual([
      { domain: 'a.horse', state: ConfirmState.Unsupported },
    ]);
  });
});

describe('API error replies', () => {
  it('Porkbun: passes on an error message and flags an answer it cannot read', async () => {
    const keys = { apiKey: 'pk', secretKey: 'sk' };
    mockFetch(() =>
      json({ status: 'ERROR', code: 'DOMAIN_IS_NOT_OPTED_IN', message: 'Not allowed.' }, 400),
    );
    await expect(new PorkbunApi(keys).check(['a.com'], network())).rejects.toThrow('Not allowed.');

    mockFetch(() => json({ status: 'SUCCESS', domains: { 'odd.com': { avail: 'maybe' } } }));
    expect((await new PorkbunApi(keys).check(['odd.com'], network()))[0]?.state).toBe(
      ConfirmState.Error,
    );
  });

  it('Name.com: passes on an error message and skips results without a name', async () => {
    const keys = { username: 'u', token: 't' };
    mockFetch(() => json({ message: 'Bad Request', details: 'domainNames is required' }, 400));
    await expect(new NameComApi(keys).check(['a.com'], network())).rejects.toThrow('Bad Request');

    mockFetch(() => json({ results: [{ purchasable: true }] }));
    expect(await new NameComApi(keys).check(['a.com'], network())).toEqual([]);
  });

  it('Spaceship: passes on an error detail; a premium without a renewal price renews at its price', async () => {
    const keys = { apiKey: 'k', apiSecret: 's' };
    mockFetch(() => json({ detail: 'Validation failed', data: [] }, 422));
    await expect(new SpaceshipApi(keys).check(['a.dev'], network())).rejects.toThrow(
      'Validation failed',
    );

    mockFetch(() =>
      json({
        domains: [
          { result: 'available' },
          {
            domain: 'gold.dev',
            result: 'available',
            premiumPricing: [{ operation: 'register', price: 300 }],
          },
        ],
      }),
    );
    const [gold] = await new SpaceshipApi(keys).check(['gold.dev'], network());
    expect(gold?.price).toMatchObject({ registration: 300, renewal: 300, currency: 'USD' });
  });

  it('Cloudflare: passes on an error message and flags an unknown reason', async () => {
    const keys = { accountId: 'acc', apiToken: 'tok' };
    mockFetch(() =>
      json(
        { success: false, errors: [{ code: 1007, message: 'too many domains' }], result: null },
        400,
      ),
    );
    await expect(new CloudflareApi(keys).check(['a.com'], network())).rejects.toThrow(
      'too many domains',
    );

    mockFetch(() =>
      json({
        success: true,
        result: {
          domains: [
            { name: 'x.com', registrable: false, reason: 'something_new' },
            { registrable: true },
          ],
        },
      }),
    );
    expect(await new CloudflareApi(keys).check(['x.com'], network())).toEqual([
      { domain: 'x.com', state: ConfirmState.Error, detail: 'something_new' },
    ]);
  });
});

describe('createRegistrarApis', () => {
  it('uses only APIs with keys, the most generous limits first', () => {
    const apis = createRegistrarApis({
      porkbun: { apiKey: 'a', secretKey: 'b' },
      nameCom: { username: 'c', token: 'd' },
      cloudflare: { accountId: 'e', apiToken: 'f' },
      spaceship: { apiKey: 'g', apiSecret: 'h' },
    });
    expect(apis.map((api) => api.registrar)).toEqual([
      RegistrarId.NameCom,
      RegistrarId.Cloudflare,
      RegistrarId.Spaceship,
      RegistrarId.Porkbun,
    ]);
    expect(createRegistrarApis({})).toEqual([]);
  });
});
