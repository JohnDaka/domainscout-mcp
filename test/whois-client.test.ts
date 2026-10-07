import { type AddressInfo, createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhoisChecker } from '../src/checkers/whois.js';
import { type WhoisTransport, whoisQuery } from '../src/checkers/whois-client.js';
import { RetryableError } from '../src/core/errors.js';
import { Network } from '../src/core/network.js';
import { LookupState } from '../src/core/types.js';
import { testConfig } from './fakes.js';

const LOCALHOST = '127.0.0.1';
const SHORT_TIMEOUT_MS = 150;
const QUERY_TIMEOUT_MS = 2_000;

const servers: Server[] = [];
const sockets: Socket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

/** A local WHOIS server on a free port; `onQuery` decides what happens to the connection. */
async function whoisServer(onQuery: (query: string, socket: Socket) => void): Promise<number> {
  const server = createServer((socket) => {
    sockets.push(socket);
    // The client may hang up mid-reply - the size limit does exactly that - which is not a failure.
    socket.on('error', () => {});
    socket.once('data', (data) => onQuery(data.toString(), socket));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, LOCALHOST, resolve));
  return (server.address() as AddressInfo).port;
}

describe('whoisQuery', () => {
  it('sends the query with CR LF and returns the whole reply', async () => {
    let received = '';
    const port = await whoisServer((query, socket) => {
      received = query;
      socket.end('Domain not found.\r\n');
    });
    expect(await whoisQuery(LOCALHOST, 'acme.io', QUERY_TIMEOUT_MS, undefined, port)).toBe(
      'Domain not found.\r\n',
    );
    expect(received).toBe('acme.io\r\n');
  });

  it('times out on a server that never answers', async () => {
    const port = await whoisServer(() => {});
    const query = whoisQuery(LOCALHOST, 'acme.io', SHORT_TIMEOUT_MS, undefined, port);
    await expect(query).rejects.toBeInstanceOf(RetryableError);
    await expect(query).rejects.toThrow(/timed out/);
  });

  it('turns a refused connection into a retryable error', async () => {
    const port = await whoisServer(() => {});
    await new Promise((resolve) => servers.pop()?.close(resolve));
    await expect(
      whoisQuery(LOCALHOST, 'acme.io', QUERY_TIMEOUT_MS, undefined, port),
    ).rejects.toBeInstanceOf(RetryableError);
  });

  it('cuts off a reply that is far too long', async () => {
    const port = await whoisServer((_query, socket) => socket.end('x'.repeat(600 * 1_024)));
    const reply = await whoisQuery(LOCALHOST, 'acme.io', QUERY_TIMEOUT_MS, undefined, port);
    expect(reply.length).toBeLessThanOrEqual(256 * 1_024);
  });

  it('stops when the caller cancels, before or during the query', async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(whoisQuery(LOCALHOST, 'a.io', QUERY_TIMEOUT_MS, cancelled.signal)).rejects.toThrow(
      /cancelled/,
    );

    const port = await whoisServer(() => {});
    const controller = new AbortController();
    const query = whoisQuery(LOCALHOST, 'a.io', QUERY_TIMEOUT_MS, controller.signal, port);
    setTimeout(() => controller.abort(), 20);
    await expect(query).rejects.toThrow(/cancelled/);
  });
});

describe('WhoisChecker', () => {
  const IANA = 'whois.iana.org';

  /** A transport that answers IANA with a referral and the TLD's server with `reply`. */
  const transportFor = (reply: string | Error, referral = 'whois.nic.test'): WhoisTransport =>
    vi.fn(async (server: string) => {
      if (server === IANA) return `domain: TEST\nwhois: ${referral}\n`;
      if (reply instanceof Error) throw reply;
      return reply;
    });

  const lookup = (transport: WhoisTransport, domain = 'acme.test', tld = 'test') =>
    new WhoisChecker(new Network(testConfig()), transport).lookup(domain, tld);

  it.each([
    [
      'registered',
      'Domain Name: acme.test\nCreation Date: 2020-01-01T00:00:00Z\n',
      LookupState.Registered,
    ],
    ['not found', 'Domain not found.\n', LookupState.NotFound],
    ['reserved', 'Status: reserved\n', LookupState.Reserved],
  ])('reads a %s reply', async (_name, reply, state) => {
    expect(await lookup(transportFor(reply))).toMatchObject({ state, server: 'whois.nic.test' });
  });

  it('reports a reply it cannot read as an error, not as a verdict', async () => {
    expect(await lookup(transportFor('Welcome!\n'))).toMatchObject({ state: LookupState.Error });
  });

  it('says unsupported when IANA names no WHOIS server', async () => {
    const transport: WhoisTransport = async () => 'domain: TEST\nstatus: ACTIVE\n';
    expect(await lookup(transport)).toEqual({ state: LookupState.Unsupported });
  });

  it('reports a failing IANA lookup', async () => {
    const transport: WhoisTransport = async () => {
      throw new Error('no route');
    };
    const result = await lookup(transport);
    expect(result.state === LookupState.Error && result.error).toContain(
      'cannot find the WHOIS server',
    );
  });

  it("reports a failing query to the TLD's server", async () => {
    expect(await lookup(transportFor(new Error('connection reset')))).toMatchObject({
      state: LookupState.Error,
      error: 'connection reset',
    });
  });

  it('uses the exact-match syntax a server needs, asking IANA about the last label only', async () => {
    const transport = transportFor('No match for "ACME.CO.COM".\n', 'whois.verisign-grs.com');
    await lookup(transport, 'acme.co.com', 'co.com');
    expect(vi.mocked(transport).mock.calls.map(([server, query]) => [server, query])).toEqual([
      [IANA, 'com'],
      ['whois.verisign-grs.com', 'domain acme.co.com'],
    ]);
  });
});
