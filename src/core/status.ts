import { type Confirmation, ConfirmState, type DomainResult, DomainStatus } from './types.js';

/** Statuses that mean "free to register": confirmed or likely. */
const FREE_STATUSES: ReadonlySet<DomainStatus> = new Set([
  DomainStatus.Available,
  DomainStatus.LikelyAvailable,
]);

/** Statuses worth asking a registrar about: free-looking, or not verifiable through the registry. */
const CONFIRMABLE_STATUSES: ReadonlySet<DomainStatus> = new Set([
  DomainStatus.LikelyAvailable,
  DomainStatus.Unknown,
]);

/** Registrar answers that settle the question, as opposed to "cannot tell". */
const DEFINITE_STATES: ReadonlySet<ConfirmState> = new Set([
  ConfirmState.Available,
  ConfirmState.Unavailable,
]);

/** Free to register: confirmed or likely. */
export function isFree(status: DomainStatus): boolean {
  return FREE_STATUSES.has(status);
}

/** Worth confirming with a registrar API. */
export function isConfirmable(result: DomainResult): boolean {
  return CONFIRMABLE_STATUSES.has(result.status);
}

/** The registrar said yes or no. */
export function isDefinite(confirmation: Confirmation): boolean {
  return DEFINITE_STATES.has(confirmation.state);
}
