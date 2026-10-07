import { describe, expect, it } from 'vitest';
import { errorMessage, HttpError, RetryableError } from '../src/core/errors.js';
import { ensureOk, parseRetryAfter } from '../src/core/http.js';
import { Network } from '../src/core/network.js';
import { withRetry } from '../src/core/retry.js';
import { testConfig } from './fakes.js';
import { headersOf, json, mockFetch } from './http-mock.js';

const URL_A = new URL('https://api.test/a');
const SECONDS_TO_MS = 1_000;

const network = () => new Network(testConfig());

describe('Network.request', () => {
  it('identifies itself with the package User-Agent', async () => {
    const calls = mockFetch(() => json({}));
    const config = testConfig();
    await new Network(config).request(URL_A, { headers: { accept: 'x' } });
    expect(headersOf(calls[0])).toMatchObject({ 'user-agent': config.userAgent, accept: 'x' });
  });

  it('turns a network failure into a retryable error that names the host', async () => {
    mockFetch(() => {
      throw new TypeError('fetch failed');
    });
    const failure = network().request(URL_A);
    await expect(failure).rejects.toBeInstanceOf(RetryableError);
    await expect(failure).rejects.toThrow(/api\.test/);
  });

  it('does not retry a request the caller cancelled', async () => {
    const controller = new AbortController();
    mockFetch(() => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    const failure = network().request(URL_A, {}, controller.signal);
    await expect(failure).rejects.not.toBeInstanceOf(RetryableError);
  });
});

describe('parseRetryAfter', () => {
  it.each([
    ['5', 5 * SECONDS_TO_MS],
    ['-3', 0],
    [null, undefined],
    ['soon', undefined],
  ])('%s -> %s', (header, expected) => {
    expect(parseRetryAfter(header)).toBe(expected);
  });

  it('reads an HTTP date', () => {
    const inTenSeconds = new Date(Date.now() + 10 * SECONDS_TO_MS).toUTCString();
    expect(parseRetryAfter(inTenSeconds)).toBeGreaterThan(0);
  });
});

describe('ensureOk', () => {
  it('accepts a 2xx response', async () => {
    await expect(ensureOk(json({}), URL_A)).resolves.toBeUndefined();
  });

  it("retries 429 with the server's delay, and 5xx", async () => {
    await expect(ensureOk(json({}, 429, { 'retry-after': '3' }), URL_A)).rejects.toMatchObject({
      retryAfterMs: 3 * SECONDS_TO_MS,
    });
    await expect(ensureOk(json({}, 503), URL_A)).rejects.toBeInstanceOf(RetryableError);
  });

  it('waits a default time after a 429 that does not say how long', async () => {
    await expect(ensureOk(json({}, 429), URL_A)).rejects.toMatchObject({
      message: 'api.test: rate limited',
      retryAfterMs: 5 * SECONDS_TO_MS,
    });
  });

  it('throws HttpError for other statuses and recognizes rejected credentials', async () => {
    const notFound = await ensureOk(json({}, 404), URL_A).catch((error: unknown) => error);
    const forbidden = await ensureOk(json({}, 403), URL_A).catch((error: unknown) => error);
    expect(notFound).toBeInstanceOf(HttpError);
    expect((notFound as HttpError).isAuthFailure).toBe(false);
    expect((forbidden as HttpError).isAuthFailure).toBe(true);
  });
});

describe('Network.viaQueues', () => {
  it('runs the task through the host and global queues', async () => {
    const net = network();
    expect(await net.viaQueues(net.rdapHosts, 'rdap.test', async () => 'done')).toBe('done');
  });
});

describe('errorMessage', () => {
  it('adds the cause and describes non-errors', () => {
    expect(errorMessage(new Error('fetch failed', { cause: new Error('ECONNRESET') }))).toBe(
      'fetch failed (ECONNRESET)',
    );
    expect(errorMessage('plain')).toBe('plain');
  });
});

describe('withRetry and cancellation', () => {
  it('does not retry once the caller has cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const failing = withRetry(
      async () => {
        calls++;
        throw new RetryableError('down');
      },
      { retries: 3, baseDelayMs: 1, maxDelayMs: 1, signal: controller.signal },
    );
    await expect(failing).rejects.toBeInstanceOf(RetryableError);
    expect(calls).toBe(1);
  });
});
