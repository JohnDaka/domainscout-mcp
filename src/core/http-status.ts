import { HttpStatus } from '../constants.js';

/** Statuses that mean the server refused our credentials. */
const AUTH_FAILURE_STATUSES: ReadonlySet<number> = new Set([
  HttpStatus.Unauthorized,
  HttpStatus.Forbidden,
]);

/** Worth another try: a rate limit or a server error. */
export function isRetryableStatus(status: number): boolean {
  return status === HttpStatus.TooManyRequests || status >= HttpStatus.FirstServerError;
}

/** The server refused our credentials, or they lack a permission. */
export function isAuthFailureStatus(status: number): boolean {
  return AUTH_FAILURE_STATUSES.has(status);
}
