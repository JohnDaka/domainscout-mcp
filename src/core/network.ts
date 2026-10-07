import PQueue from 'p-queue';
import {
  Header,
  Priority,
  RDAP_REQUESTS_PER_SECOND,
  SECOND_MS,
  WHOIS_PER_HOST_CONCURRENCY,
  WHOIS_REQUESTS_PER_SECOND,
} from '../constants.js';
import { atHost } from '../messages/index.js';
import { errorMessage, RetryableError } from './errors.js';
import { HostQueues } from './host-queues.js';
import { withTimeout } from './signals.js';

/** The settings the network layer needs; the config has them all. */
export interface NetworkSettings {
  /** Network operations in flight at once, all hosts together. */
  maxConcurrency: number;
  /** Requests in flight to one RDAP server. */
  perHostConcurrency: number;
  /** Timeout of one request. */
  timeoutMs: number;
  /** Sent with every HTTP request. */
  userAgent: string;
}

/** fetch() options with plain-object headers, so ours can be merged in. */
export type RequestOptions = RequestInit & { headers?: Record<string, string> };

/** Shared limits for everything that goes over the network, and the one way to make HTTP requests. */
export class Network {
  /** Every network operation, all hosts together: the user-facing concurrency limit. */
  readonly global: PQueue;
  /** Per-server limits of RDAP servers. */
  readonly rdapHosts: HostQueues;
  /** Per-server limits of WHOIS servers, which block aggressive clients quickly. */
  readonly whoisHosts: HostQueues;
  /** Timeout of one request. */
  readonly timeoutMs: number;

  constructor(private readonly settings: NetworkSettings) {
    this.global = new PQueue({ concurrency: settings.maxConcurrency });
    this.rdapHosts = new HostQueues({
      concurrency: settings.perHostConcurrency,
      intervalCap: RDAP_REQUESTS_PER_SECOND,
      intervalMs: SECOND_MS,
    });
    this.whoisHosts = new HostQueues({
      concurrency: WHOIS_PER_HOST_CONCURRENCY,
      intervalCap: WHOIS_REQUESTS_PER_SECOND,
      intervalMs: SECOND_MS,
    });
    this.timeoutMs = settings.timeoutMs;
  }

  /**
   * Runs a request to a rate-limited host through the host's queue first, then the global one.
   * The order matters: waiting for a busy host must not hold a global slot that requests to
   * other hosts could use.
   */
  viaQueues<T>(
    hosts: HostQueues,
    host: string,
    task: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    return hosts.add(host, () => this.run(task, signal), signal);
  }

  /** Runs a request through the global limit only, for hosts without limits of their own. */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return this.global.add(task, { priority: Priority.Registry, signal });
  }

  /**
   * fetch() with the request timeout, our User-Agent and the caller's cancel signal.
   * Network failures and timeouts become RetryableError; a cancel by the caller does not.
   */
  async request(url: URL, options: RequestOptions = {}, signal?: AbortSignal): Promise<Response> {
    try {
      return await fetch(url, {
        ...options,
        headers: { [Header.UserAgent]: this.settings.userAgent, ...options.headers },
        signal: withTimeout(this.timeoutMs, signal),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new RetryableError(atHost(url.host, errorMessage(error)));
    }
  }
}
