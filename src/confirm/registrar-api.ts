import type { HostQueueOptions } from '../core/host-queues.js';
import type { Network } from '../core/network.js';
import type { Confirmation, RegistrarId } from '../core/types.js';

/**
 * A registrar's availability API, used with the user's own key. Throws for failures of a
 * whole request (network, auth, rate limit); problems with single domains come back as
 * Unsupported or Error confirmations.
 */
export interface RegistrarApi {
  readonly registrar: RegistrarId;
  /** Most domains in one request. */
  readonly batchSize: number;
  /** The API's documented rate limits. */
  readonly limits: HostQueueOptions;
  check(
    domains: readonly string[],
    network: Network,
    signal?: AbortSignal,
  ): Promise<Confirmation[]>;
}
