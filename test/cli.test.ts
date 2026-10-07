import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli/cli.js';
import { EnvVar, ExitCode } from '../src/constants.js';
import {
  type Attempt,
  ConfirmState,
  type DnsLookup,
  DnsState,
  RegistrarId,
} from '../src/core/types.js';
import { fakeServices, testConfig } from './fakes.js';

afterEach(() => vi.restoreAllMocks());

/** Runs the CLI with fake lookups and captures what it prints. */
async function cli(
  args: string[],
  env: NodeJS.ProcessEnv = {},
  lookups: Parameters<typeof fakeServices>[0] = {},
) {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((text: string) => void out.push(text));
  vi.spyOn(console, 'error').mockImplementation((text: string) => void err.push(text));
  const { services, calls } = fakeServices(lookups);
  const code = await runCli(args, testConfig(env), services);
  return { code, out: out.join('\n'), err: err.join('\n'), calls };
}

describe('runCli', () => {
  it('prints usage for --help', async () => {
    const { code, out } = await cli(['--help']);
    expect(code).toBe(ExitCode.Ok);
    expect(out).toContain('Usage:');
  });

  it('exits with a usage error when no names are given', async () => {
    expect((await cli([])).code).toBe(ExitCode.Usage);
  });

  it('rejects unknown options', async () => {
    const { code, err } = await cli(['acme', '--bogus']);
    expect(code).toBe(ExitCode.Usage);
    expect(err).toContain('Unknown option: --bogus');
  });

  it('checks names in the requested TLDs and prints the report', async () => {
    const taken: DnsLookup = { state: DnsState.Delegated, nameservers: ['ns.test'], ms: 1 };
    const free: DnsLookup = { state: DnsState.NxDomain, ms: 1 };
    const { code, out } = await cli(
      ['acme', '--tlds', 'com,ai'],
      {},
      {
        dns: (domain) => (domain === 'acme.com' ? taken : free),
      },
    );
    expect(code).toBe(ExitCode.Ok);
    expect(out).toContain('Checked 2 domain(s)');
    expect(out).toContain('TAKEN: acme.com');
    expect(out).toContain('- acme.ai');
  });

  it('prints JSON with --json and accepts --tlds=…', async () => {
    const { out } = await cli(['acme', '--tlds=com,net', '--json']);
    const parsed = JSON.parse(out) as { summary: { total: number }; tlds: string[] };
    expect(parsed.summary.total).toBe(2);
    expect(parsed.tlds).toEqual(['com', 'net']);
  });

  it('skips registrar confirmation with --no-confirm', async () => {
    const confirm = (domain: string): Attempt[] => [
      { domain, state: ConfirmState.Available, registrar: RegistrarId.Porkbun, ms: 1 },
    ];
    const { calls } = await cli(['acme.com', '-t', 'com', '--no-confirm'], {}, { confirm });
    expect(calls.confirmed).toEqual([]);
  });

  it('fails with a message when nothing in the input is a domain', async () => {
    const { code, err } = await cli(['foo_bar']);
    expect(code).toBe(ExitCode.Failed);
    expect(err).toContain('Nothing to check');
    expect(err).toContain('"foo_bar"');
  });

  it('prints configuration warnings', async () => {
    const { err } = await cli(['acme.com'], { [EnvVar.MaxConcurrency]: 'zero' });
    expect(err).toContain(`warning: ${EnvVar.MaxConcurrency}`);
  });

  it('shows progress on an interactive terminal', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const tty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');
    Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
    try {
      await cli(['acme.com']);
    } finally {
      if (tty) Object.defineProperty(process.stderr, 'isTTY', tty);
      else Reflect.deleteProperty(process.stderr, 'isTTY');
    }
    expect(write.mock.calls.some(([text]) => String(text).includes('[1/1] acme.com'))).toBe(true);
  });
});
