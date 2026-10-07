import PQueue from 'p-queue';
import { RetryableError } from './errors.js';

/** Limits for one host or API. */
export interface HostQueueOptions {
  /** Requests in flight at once. */
  concurrency: number;
  /** Requests started per window (sliding window)… */
  intervalCap: number;
  /** …of this many milliseconds. */
  intervalMs: number;
}

/**
 * One p-queue per host: limited concurrency, a limited start rate, and a pause when the
 * host says "too many requests", so no server ever gets flooded.
 */
export class HostQueues {
  /** The queue of each host, created on first use. */
  private readonly queues = new Map<string, PQueue>();
  /** When each paused host may get requests again. */
  private readonly resumeAt = new Map<string, number>();

  constructor(private readonly options: HostQueueOptions) {}

  /** Runs `task` within the host's limits. A failure that names a wait time pauses the host for that long. */
  async add<T>(host: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    try {
      return await this.queue(host).add(task, { signal });
    } catch (error) {
      this.honorRetryAfter(host, error);
      throw error;
    }
  }

  /** Stops starting new requests to `host` for `ms`; requests already running finish. */
  cooldown(host: string, ms: number): void {
    const until = Date.now() + ms;
    if (until <= (this.resumeAt.get(host) ?? 0)) return;
    this.resumeAt.set(host, until);
    this.queue(host).pause();
    setTimeout(() => this.resume(host, until), ms);
  }

  /** Restarts a host's queue, unless a longer cooldown began in the meantime. */
  private resume(host: string, until: number): void {
    if (this.resumeAt.get(host) === until) this.queue(host).start();
  }

  /** A server that said how long to wait (HTTP 429 Retry-After, a WHOIS limit) is left alone that long. */
  private honorRetryAfter(host: string, error: unknown): void {
    if (!(error instanceof RetryableError) || !error.retryAfterMs) return;
    this.cooldown(host, error.retryAfterMs);
  }

  private queue(host: string): PQueue {
    const existing = this.queues.get(host);
    if (existing) return existing;
    const queue = new PQueue({
      concurrency: this.options.concurrency,
      intervalCap: this.options.intervalCap,
      interval: this.options.intervalMs,
      strict: true,
    });
    this.queues.set(host, queue);
    return queue;
  }
}
