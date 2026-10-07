import { createConnection, type Socket } from 'node:net';
import { WHOIS_ENCODING, WHOIS_LINE_END, WHOIS_MAX_REPLY_BYTES, WHOIS_PORT } from '../constants.js';
import { errorMessage, RetryableError } from '../core/errors.js';
import { withTimeout } from '../core/signals.js';
import { atHost, ErrorText } from '../messages/index.js';

/** Sends one WHOIS query and returns the whole reply. */
export type WhoisTransport = (
  server: string,
  query: string,
  timeoutMs: number,
  signal?: AbortSignal,
) => Promise<string>;

/**
 * Sends one query to a WHOIS server over TCP (RFC 3912) and returns the whole reply.
 * Timeouts and network errors become RetryableError; a cancel by the caller does not.
 */
export async function whoisQuery(
  server: string,
  query: string,
  timeoutMs: number,
  signal?: AbortSignal,
  port: number = WHOIS_PORT,
): Promise<string> {
  if (signal?.aborted) throw new Error(ErrorText.Cancelled);
  const deadline = withTimeout(timeoutMs, signal);
  const socket = createConnection({ host: server, port, signal: deadline });
  socket.write(`${query}${WHOIS_LINE_END}`);
  try {
    return await readReply(socket);
  } catch (error) {
    throw queryError(error, server, deadline, signal);
  } finally {
    socket.destroy();
  }
}

/** Reads until the server closes the connection, keeping at most WHOIS_MAX_REPLY_BYTES. */
async function readReply(socket: Socket): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of socket) {
    size += (chunk as Buffer).length;
    if (size > WHOIS_MAX_REPLY_BYTES) break;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString(WHOIS_ENCODING);
}

/** A cancel stays a plain error; a timeout or a network error is worth another try. */
function queryError(
  error: unknown,
  server: string,
  deadline: AbortSignal,
  signal?: AbortSignal,
): Error {
  if (signal?.aborted) return new Error(ErrorText.Cancelled);
  const reason = deadline.aborted ? ErrorText.TimedOut : errorMessage(error);
  return new RetryableError(atHost(server, reason));
}
