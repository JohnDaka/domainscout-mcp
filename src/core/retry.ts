import { setTimeout as delay } from 'node:timers/promises';
import { BACKOFF_FACTOR, BACKOFF_JITTER, type RetryPolicy } from '../constants.js';
import { RetryableError } from './errors.js';

/** A retry policy, and the caller's cancel signal that ends the retries. */
export interface RetryOptions extends RetryPolicy {
  signal?: AbortSignal;
}

/** Runs `task`, retrying RetryableErrors with exponential backoff and jitter; honors the server's Retry-After. */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!shouldRetry(error, attempt, options)) throw error;
      await delay(retryDelay(error, attempt, options), undefined, { signal: options.signal });
    }
  }
}

/** Only retryable failures, within the budget, and only while the caller still waits. */
function shouldRetry(
  error: unknown,
  attempt: number,
  options: RetryOptions,
): error is RetryableError {
  return error instanceof RetryableError && attempt < options.retries && !options.signal?.aborted;
}

/** Exponential backoff with jitter, but at least what the server asked for and at most `maxDelayMs`. */
function retryDelay(error: RetryableError, attempt: number, options: RetryOptions): number {
  const backoff = Math.min(options.maxDelayMs, options.baseDelayMs * BACKOFF_FACTOR ** attempt);
  const jittered = backoff * (1 - BACKOFF_JITTER + Math.random() * BACKOFF_JITTER);
  return Math.min(Math.max(jittered, error.retryAfterMs ?? 0), options.maxDelayMs);
}
