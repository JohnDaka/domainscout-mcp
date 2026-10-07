import { Retry } from '../constants.js';
import { chunk } from '../core/arrays.js';
import { CredentialsRejectedError, errorMessage, HttpError } from '../core/errors.js';
import { HostQueues } from '../core/host-queues.js';
import type { Network } from '../core/network.js';
import { withRetry } from '../core/retry.js';
import type { ConfirmService } from '../core/services.js';
import { isDefinite } from '../core/status.js';
import { type Attempt, type Confirmation, ConfirmState, type RegistrarId } from '../core/types.js';
import { ErrorText } from '../messages/index.js';
import type { RegistrarApi } from './registrar-api.js';

/**
 * Confirms free-looking domains with registrar APIs, using the user's own keys. APIs are asked
 * in order; a domain moves on to the next API only when the previous one could not answer
 * (TLD not sold, error). Each API gets its own queue with its own limits.
 */
export class Confirmer implements ConfirmService {
  /** Each API's limits, by registrar. */
  private readonly queues = new Map<RegistrarId, HostQueues>();

  constructor(
    private readonly apis: readonly RegistrarApi[],
    private readonly network: Network,
  ) {}

  get enabled(): boolean {
    return this.apis.length > 0;
  }

  /** Every API's answers per domain. Never throws: failures become Error attempts. */
  async confirm(domains: readonly string[], signal?: AbortSignal): Promise<Map<string, Attempt[]>> {
    const attempts = new Map<string, Attempt[]>(domains.map((domain) => [domain, []]));
    let remaining = [...domains];
    for (const api of this.apis) {
      if (remaining.length === 0 || signal?.aborted) break;
      for (const answer of await this.askApi(api, remaining, signal)) {
        attempts.get(answer.domain)?.push(answer);
      }
      remaining = remaining.filter((domain) => !attempts.get(domain)?.some(isDefinite));
    }
    return attempts;
  }

  /** All batches at once; the API's queue keeps them within its limits. */
  private async askApi(
    api: RegistrarApi,
    domains: readonly string[],
    signal?: AbortSignal,
  ): Promise<Attempt[]> {
    const batches = chunk(domains, api.batchSize);
    const answers = await Promise.all(batches.map((batch) => this.checkBatch(api, batch, signal)));
    return answers.flat();
  }

  /** One batch, retried on rate limits and server errors. Never throws. */
  private async checkBatch(
    api: RegistrarApi,
    batch: readonly string[],
    signal?: AbortSignal,
  ): Promise<Attempt[]> {
    const started = Date.now();
    try {
      const answers = await withRetry(() => this.send(api, batch, signal), {
        ...Retry.confirm,
        signal,
      });
      return this.toAttempts(api, batch, answers, Date.now() - started);
    } catch (error) {
      return this.failedAttempts(api, batch, this.describeFailure(error), Date.now() - started);
    }
  }

  /** One request through the API's own limits, then the global one. */
  private send(
    api: RegistrarApi,
    batch: readonly string[],
    signal?: AbortSignal,
  ): Promise<Confirmation[]> {
    const check = () => api.check(batch, this.network, signal);
    return this.network.viaQueues(this.queuesOf(api), api.registrar, check, signal);
  }

  /** One attempt per domain of the batch; a domain the API did not mention is one it cannot answer for. */
  private toAttempts(
    api: RegistrarApi,
    batch: readonly string[],
    answers: readonly Confirmation[],
    ms: number,
  ): Attempt[] {
    const byDomain = new Map(answers.map((answer) => [answer.domain, answer]));
    return batch.map((domain) => ({
      ...(byDomain.get(domain) ?? { domain, state: ConfirmState.Unsupported }),
      registrar: api.registrar,
      ms,
    }));
  }

  /** The whole batch failed: one Error attempt per domain, with the reason. */
  private failedAttempts(
    api: RegistrarApi,
    batch: readonly string[],
    detail: string,
    ms: number,
  ): Attempt[] {
    return batch.map((domain) => ({
      domain,
      state: ConfirmState.Error,
      detail,
      registrar: api.registrar,
      ms,
    }));
  }

  /** A rejected key gets a message that says what to do; anything else is described as is. */
  private describeFailure(error: unknown): string {
    if (error instanceof CredentialsRejectedError) return ErrorText.KeyRejected;
    if (error instanceof HttpError && error.isAuthFailure) return ErrorText.KeyRejected;
    return errorMessage(error);
  }

  private queuesOf(api: RegistrarApi): HostQueues {
    const existing = this.queues.get(api.registrar);
    if (existing) return existing;
    const queues = new HostQueues(api.limits);
    this.queues.set(api.registrar, queues);
    return queues;
  }
}
