import { withCause } from '../messages/index.js';
import { isAuthFailureStatus } from './http-status.js';

/** A failure worth trying again: timeout, network error, rate limit, server error. */
export class RetryableError extends Error {
  constructor(
    message: string,
    /** How long the server asked us to wait, if it said so. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** A non-2xx answer that is not worth retrying (400, 401, 403, 404…). */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }

  /** The server refused our credentials. */
  get isAuthFailure(): boolean {
    return isAuthFailureStatus(this.status);
  }
}

/** The registrar refused the user's credentials (or they lack a permission). */
export class CredentialsRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A readable message for anything thrown, with the cause when there is one: "fetch failed (ECONNRESET)". */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (!(error.cause instanceof Error)) return error.message;
  return withCause(error.message, error.cause.message);
}
