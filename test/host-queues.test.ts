import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { RetryableError } from '../src/core/errors.js';
import { HostQueues } from '../src/core/host-queues.js';
import { withRetry } from '../src/core/retry.js';

/** Windows timers can fire up to ~15 ms early relative to Date.now(). */
const TIMER_SLACK_MS = 20;

const trackPeak = () => {
  let running = 0;
  let peak = 0;
  const task = async () => {
    running++;
    peak = Math.max(peak, running);
    await delay(20);
    running--;
  };
  return { task, peak: () => peak };
};

describe('HostQueues', () => {
  it('limits requests in flight per host', async () => {
    const queues = new HostQueues({ concurrency: 2, intervalCap: 100, intervalMs: 1_000 });
    const { task, peak } = trackPeak();
    await Promise.all(Array.from({ length: 6 }, () => queues.add('a.test', task)));
    expect(peak()).toBe(2);
  });

  it('runs different hosts in parallel', async () => {
    const queues = new HostQueues({ concurrency: 1, intervalCap: 100, intervalMs: 1_000 });
    const { task, peak } = trackPeak();
    await Promise.all(['a.test', 'b.test', 'c.test'].map((host) => queues.add(host, task)));
    expect(peak()).toBe(3);
  });

  it('limits how many requests start per second', async () => {
    const queues = new HostQueues({ concurrency: 10, intervalCap: 2, intervalMs: 1_000 });
    const started = Date.now();
    const offsets: number[] = [];
    await Promise.all(
      Array.from({ length: 3 }, () =>
        queues.add('a.test', async () => void offsets.push(Date.now() - started)),
      ),
    );
    expect(Math.max(...offsets)).toBeGreaterThanOrEqual(1_000 - TIMER_SLACK_MS);
  });

  it('holds back a host during a cooldown, and only that host', async () => {
    const queues = new HostQueues({ concurrency: 1, intervalCap: 100, intervalMs: 1_000 });
    queues.cooldown('slow.test', 150);
    const started = Date.now();
    await queues.add('fast.test', async () => {});
    expect(Date.now() - started).toBeLessThan(100);
    await queues.add('slow.test', async () => {});
    expect(Date.now() - started).toBeGreaterThanOrEqual(150 - TIMER_SLACK_MS);
  });

  it('keeps the longer of two cooldowns', async () => {
    const queues = new HostQueues({ concurrency: 1, intervalCap: 100, intervalMs: 1_000 });
    queues.cooldown('slow.test', 150);
    queues.cooldown('slow.test', 10);
    const started = Date.now();
    await queues.add('slow.test', async () => {});
    expect(Date.now() - started).toBeGreaterThanOrEqual(150 - TIMER_SLACK_MS);
  });

  it('drops queued work when the caller cancels', async () => {
    const queues = new HostQueues({ concurrency: 1, intervalCap: 100, intervalMs: 1_000 });
    const controller = new AbortController();
    const blocker = queues.add('a.test', () => delay(50));
    const queued = queues.add('a.test', async () => 'ran', controller.signal);
    controller.abort();
    await expect(queued).rejects.toThrow();
    await blocker;
  });
});

describe('withRetry', () => {
  const fast = { retries: 2, baseDelayMs: 1, maxDelayMs: 5 };

  it('retries retryable failures until one succeeds', async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new RetryableError('flaky');
      return 'ok';
    }, fast);
    expect(value).toBe('ok');
    expect(calls).toBe(3);
  });

  it('gives up after the retry budget', async () => {
    let calls = 0;
    const failing = withRetry(async () => {
      calls++;
      throw new RetryableError('down');
    }, fast);
    await expect(failing).rejects.toBeInstanceOf(RetryableError);
    expect(calls).toBe(fast.retries + 1);
  });

  it('does not retry other errors', async () => {
    let calls = 0;
    const failing = withRetry(async () => {
      calls++;
      throw new TypeError('bug');
    }, fast);
    await expect(failing).rejects.toBeInstanceOf(TypeError);
    expect(calls).toBe(1);
  });

  it('waits at least as long as the server asked (Retry-After)', async () => {
    let calls = 0;
    const started = Date.now();
    await withRetry(
      async () => {
        calls++;
        if (calls === 1) throw new RetryableError('slow down', 80);
      },
      { retries: 1, baseDelayMs: 1, maxDelayMs: 200 },
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(80 - TIMER_SLACK_MS);
  });
});
