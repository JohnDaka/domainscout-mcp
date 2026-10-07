import { DEFAULT_RETRY_AFTER_MS, Header, HttpStatus, SECOND_MS } from '../constants.js';
import { atHost, ErrorText, httpStatusText } from '../messages/index.js';
import { HttpError, RetryableError } from './errors.js';
import { isRetryableStatus } from './http-status.js';

/**
 * The error for a reply worth another try. It carries how long to wait: the server's
 * Retry-After, or DEFAULT_RETRY_AFTER_MS for a rate limit that does not say.
 */
export function retryableError(response: Response, url: URL): RetryableError {
  const rateLimited = response.status === HttpStatus.TooManyRequests;
  const reason = rateLimited ? ErrorText.RateLimited : httpStatusText(response.status);
  const retryAfterMs = parseRetryAfter(response.headers.get(Header.RetryAfter));
  const fallbackMs = rateLimited ? DEFAULT_RETRY_AFTER_MS : undefined;
  return new RetryableError(atHost(url.host, reason), retryAfterMs ?? fallbackMs);
}

/**
 * Throws for a non-2xx response: RetryableError for 429 and 5xx, HttpError otherwise.
 * The body is discarded: it may echo request details.
 */
export async function ensureOk(response: Response, url: URL): Promise<void> {
  if (response.ok) return;
  await discardBody(response);
  if (isRetryableStatus(response.status)) throw retryableError(response, url);
  throw new HttpError(atHost(url.host, httpStatusText(response.status)), response.status);
}

/** Frees the connection of a reply whose body is not needed. */
export async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel();
}

/** Retry-After is either a number of seconds or an HTTP date. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * SECOND_MS);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
