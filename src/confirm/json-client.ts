import { Header, type HttpMethod, JSON_CONTENT_TYPE, JSON_MEDIA_TYPE } from '../constants.js';
import { CredentialsRejectedError } from '../core/errors.js';
import { discardBody, retryableError } from '../core/http.js';
import { isAuthFailureStatus, isRetryableStatus } from '../core/http-status.js';
import type { Network, RequestOptions } from '../core/network.js';
import { atHost, ErrorText, httpStatusText } from '../messages/index.js';

/** A JSON reply with any status that is neither a rate limit, a server error nor a rejected key. */
export interface JsonReply<T> {
  ok: boolean;
  status: number;
  data: T;
}

/** A request to a registrar API. */
export interface JsonRequest {
  method: HttpMethod;
  /** Extra headers, e.g. credentials. */
  headers?: Record<string, string>;
  /** Serialized as JSON. */
  body?: unknown;
}

/**
 * Sends a JSON request to a registrar API. Throws RetryableError for 429 and 5xx,
 * CredentialsRejectedError for 401/403, and Error for a reply that is not JSON. Error messages
 * never contain the request, so credentials cannot leak through them.
 */
export async function sendJson<T>(
  network: Network,
  url: URL,
  request: JsonRequest,
  signal?: AbortSignal,
): Promise<JsonReply<T>> {
  const response = await network.request(url, requestOptions(request), signal);
  const failure = replyFailure(response, url);
  if (failure) {
    await discardBody(response);
    throw failure;
  }
  return { ok: response.ok, status: response.status, data: (await response.json()) as T };
}

/** Method, JSON headers and the serialized body. */
function requestOptions(request: JsonRequest): RequestOptions {
  const hasBody = request.body !== undefined;
  return {
    method: request.method,
    headers: {
      [Header.Accept]: JSON_CONTENT_TYPE,
      ...(hasBody && { [Header.ContentType]: JSON_CONTENT_TYPE }),
      ...request.headers,
    },
    ...(hasBody && { body: JSON.stringify(request.body) }),
  };
}

/** Why a reply cannot be used, if it cannot. */
function replyFailure(response: Response, url: URL): Error | undefined {
  if (isRetryableStatus(response.status)) return retryableError(response, url);
  if (isAuthFailureStatus(response.status)) {
    return new CredentialsRejectedError(atHost(url.host, httpStatusText(response.status)));
  }
  if (!JSON_MEDIA_TYPE.test(response.headers.get(Header.ContentType) ?? '')) {
    return new Error(atHost(url.host, ErrorText.UnexpectedReply));
  }
  return undefined;
}
