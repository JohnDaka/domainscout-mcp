import { afterEach, vi } from 'vitest';

export interface Call {
  url: string;
  init: RequestInit;
}

afterEach(() => vi.unstubAllGlobals());

/** Replaces the global fetch for one test; every call is recorded. */
export function mockFetch(reply: (call: Call) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: URL | string, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return reply(call);
  });
  return calls;
}

/** A JSON response, the shape every registry and registrar API here answers with. */
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/** Routes requests by URL prefix; anything unrouted fails loudly with HTTP 599. */
export const byPrefix =
  (routes: Record<string, (call: Call) => Response>) =>
  (call: Call): Response => {
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => call.url.startsWith(prefix));
    return match
      ? (routes[match]?.(call) ?? new Response(null, { status: 599 }))
      : new Response(null, { status: 599 });
  };

export const bodyOf = (call: Call | undefined): unknown => JSON.parse(String(call?.init.body));
export const headersOf = (call: Call | undefined): Record<string, string> =>
  (call?.init.headers ?? {}) as Record<string, string>;
