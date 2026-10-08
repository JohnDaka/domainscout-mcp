import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EnvVar,
  ICON_URL,
  SERVER_TITLE,
  TOOL_CHECK_DOMAINS,
  WEBSITE_URL,
} from '../src/constants.js';
import { DnsState, DomainStatus, RegistrarId } from '../src/core/types.js';
import { SERVER_DESCRIPTION, ToolText } from '../src/messages/index.js';
import { toPriceList } from '../src/pricing/price.js';
import { createServer, startServer } from '../src/server/server.js';
import { fakeServices, testConfig } from './fakes.js';

/** A real MCP client talking to the server in memory: checks schemas, results and progress end to end. */
async function connect(lookups: Parameters<typeof fakeServices>[0] = {}) {
  const { services } = fakeServices(lookups);
  const server = createServer(testConfig(), services);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('MCP server', () => {
  it('introduces itself with a title, a description, its website and icons', async () => {
    const client = await connect();
    const info = client.getServerVersion();
    expect(info?.title).toBe(SERVER_TITLE);
    expect(info?.description).toBe(SERVER_DESCRIPTION);
    expect(info?.websiteUrl).toBe(WEBSITE_URL);
    const [packaged, website] = info?.icons ?? [];
    expect(packaged?.src).toMatch(/^data:image\/png;base64,iVBOR/);
    expect(website?.src).toBe(ICON_URL);
  });

  it('lists the check_domains tool with input and output schemas', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === TOOL_CHECK_DOMAINS);
    expect(tool?.inputSchema.properties).toHaveProperty('domains');
    expect(tool?.outputSchema?.properties).toHaveProperty('results');
    // No dialect: clients that follow MCP's 2020-12 default refuse a schema marked draft-07.
    expect(tool?.inputSchema).not.toHaveProperty('$schema');
    expect(tool?.outputSchema).not.toHaveProperty('$schema');
    expect(tool?.title).toBe(ToolText.Title);
    expect(tool?.annotations).toMatchObject({
      title: ToolText.Title,
      readOnlyHint: true,
      destructiveHint: false,
    });
  });

  it('checks names and returns text plus structured results that match the schema', async () => {
    const client = await connect({
      dns: (domain) =>
        domain === 'acme.com'
          ? { state: DnsState.Delegated, nameservers: ['ns.test'], ms: 1 }
          : { state: DnsState.NxDomain, ms: 1 },
    });
    const progress: number[] = [];
    const result = await client.callTool(
      { name: TOOL_CHECK_DOMAINS, arguments: { domains: ['acme'], tlds: ['com', 'ai'] } },
      undefined,
      { onprogress: ({ progress: done }) => progress.push(done) },
    );

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as {
      summary: Record<string, number>;
      results: Array<{ domain: string; status: string; buy?: unknown[]; evidence?: unknown }>;
    };
    expect(structured.summary.total).toBe(2);
    const byDomain = Object.fromEntries(structured.results.map((item) => [item.domain, item]));
    expect(byDomain['acme.com']?.status).toBe(DomainStatus.Taken);
    expect(byDomain['acme.ai']?.status).toBe(DomainStatus.LikelyAvailable);
    expect(byDomain['acme.ai']?.buy?.length).toBeGreaterThan(0);
    expect(byDomain['acme.ai']?.evidence).toBeUndefined();
    expect(progress).toEqual([1, 2]);
  });

  it('attaches standard prices to buy links and states the minimum term in the text', async () => {
    const prices = new Map([
      [RegistrarId.Cloudflare, toPriceList([{ tld: 'ai', registration: 80, renewal: 80 }], 'test')],
    ]);
    const client = await connect({ prices });
    const result = await client.callTool({
      name: TOOL_CHECK_DOMAINS,
      arguments: { domains: ['acme.ai'] },
    });
    const [first] = (
      result.structuredContent as {
        results: Array<{ buy: Array<{ registrar: string; price?: unknown }> }>;
      }
    ).results;
    expect(first?.buy[0]).toMatchObject({
      registrar: 'Cloudflare',
      price: { registration: 80, minYears: 2 },
    });
    const [text] = result.content as Array<{ text: string }>;
    expect(text?.text).toContain('$80.00/yr');
    expect(text?.text).toContain('at least 2 years');
  });

  it('returns evidence only when asked for details', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: TOOL_CHECK_DOMAINS,
      arguments: { domains: ['acme.ai'], details: true },
    });
    const [first] = (result.structuredContent as { results: Array<{ evidence?: unknown[] }> })
      .results;
    expect(first?.evidence?.length).toBeGreaterThan(0);
  });

  it('answers with an error when nothing in the input is a domain', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: TOOL_CHECK_DOMAINS,
      arguments: { domains: ['foo_bar'] },
    });
    expect(result.isError).toBe(true);
  });
});

describe('startServer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs configuration warnings and readiness to stderr, then serves the tool', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((text: string) => void logs.push(text));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await startServer(testConfig({ [EnvVar.MaxDomains]: 'lots' }), serverTransport);

    expect(logs[0]).toContain(`[domainscout] ${EnvVar.MaxDomains}`);
    expect(logs.at(-1)).toContain('ready, default TLDs: com, net, ai');
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([TOOL_CHECK_DOMAINS]);
  });
});
