import { describe, expect, it } from 'vitest';
import { Confirmer } from '../src/confirm/confirmer.js';
import type { RegistrarApi } from '../src/confirm/registrar-api.js';
import { EnvVar } from '../src/constants.js';
import { CredentialsRejectedError, HttpError } from '../src/core/errors.js';
import { Network } from '../src/core/network.js';
import {
  type Attempt,
  type Confirmation,
  ConfirmState,
  DomainStatus,
  EvidenceSource,
  type Price,
  RegistrarId,
} from '../src/core/types.js';
import { Note } from '../src/messages/index.js';
import { DomainScout } from '../src/scout/domain-scout.js';
import { fakeServices, testConfig } from './fakes.js';

const FAST = { concurrency: 5, intervalCap: 100, intervalMs: 1_000 };

/** A registrar API that answers from a table and records the batches it got. */
function fakeApi(
  registrar: RegistrarId,
  answer: (domain: string) => Confirmation | undefined,
  batchSize = 10,
): RegistrarApi & { batches: string[][] } {
  const batches: string[][] = [];
  return {
    registrar,
    batchSize,
    limits: FAST,
    batches,
    check: async (domains) => {
      batches.push([...domains]);
      return domains
        .map((domain) => answer(domain))
        .filter((item): item is Confirmation => item !== undefined);
    },
  };
}

const confirmer = (...apis: RegistrarApi[]) => new Confirmer(apis, new Network(testConfig()));

describe('Confirmer', () => {
  it('asks the next API only about domains the previous one could not answer', async () => {
    const first = fakeApi(RegistrarId.NameCom, (domain) =>
      domain.endsWith('.com')
        ? { domain, state: ConfirmState.Available }
        : { domain, state: ConfirmState.Unsupported },
    );
    const second = fakeApi(RegistrarId.Porkbun, (domain) => ({
      domain,
      state: ConfirmState.Unavailable,
    }));
    const attempts = await confirmer(first, second).confirm(['a.com', 'a.ai']);

    expect(second.batches).toEqual([['a.ai']]);
    expect(attempts.get('a.com')?.map((attempt) => attempt.state)).toEqual([
      ConfirmState.Available,
    ]);
    expect(attempts.get('a.ai')?.map((attempt) => [attempt.registrar, attempt.state])).toEqual([
      [RegistrarId.NameCom, ConfirmState.Unsupported],
      [RegistrarId.Porkbun, ConfirmState.Unavailable],
    ]);
  });

  it("splits domains into batches of the API's size", async () => {
    const api = fakeApi(
      RegistrarId.Porkbun,
      (domain) => ({ domain, state: ConfirmState.Available }),
      2,
    );
    await confirmer(api).confirm(['a.com', 'b.com', 'c.com']);
    expect(api.batches.map((batch) => batch.length).sort()).toEqual([1, 2]);
  });

  it('turns a rejected key into an error for the batch and moves on', async () => {
    const broken: RegistrarApi = {
      registrar: RegistrarId.Spaceship,
      batchSize: 10,
      limits: FAST,
      check: async () => {
        throw new HttpError('api.test: HTTP 401', 401);
      },
    };
    const backup = fakeApi(RegistrarId.Porkbun, (domain) => ({
      domain,
      state: ConfirmState.Available,
    }));
    const attempts = await confirmer(broken, backup).confirm(['a.com']);
    const [failed, answered] = attempts.get('a.com') ?? [];
    expect(failed).toMatchObject({ state: ConfirmState.Error, registrar: RegistrarId.Spaceship });
    expect(failed?.detail).toContain('API key rejected');
    expect(answered?.state).toBe(ConfirmState.Available);
  });

  it('says what to do about a key the registrar refused, and passes on other failures', async () => {
    const failing = (error: Error): RegistrarApi => ({
      registrar: RegistrarId.Porkbun,
      batchSize: 10,
      limits: FAST,
      check: async () => {
        throw error;
      },
    });
    const rejected = await confirmer(failing(new CredentialsRejectedError('x'))).confirm(['a.com']);
    expect(rejected.get('a.com')?.[0]?.detail).toContain('API key rejected');
    const broken = await confirmer(failing(new Error('bad gateway'))).confirm(['a.com']);
    expect(broken.get('a.com')?.[0]?.detail).toBe('bad gateway');
  });

  it('marks domains the API did not mention as unsupported', async () => {
    const api = fakeApi(RegistrarId.Porkbun, () => undefined);
    const attempts = await confirmer(api).confirm(['a.com']);
    expect(attempts.get('a.com')?.[0]?.state).toBe(ConfirmState.Unsupported);
  });
});

describe('DomainScout with registrar APIs', () => {
  const exact: Price = {
    registration: 2_500,
    renewal: 12,
    currency: 'USD',
    minYears: 1,
    source: 'test',
    confirmed: true,
  };
  const attempt = (state: Attempt['state'], extra: Partial<Attempt> = {}): Attempt[] => [
    { domain: '', state, registrar: RegistrarId.Porkbun, ms: 1, ...extra },
  ];

  const run = async (
    confirm: (domain: string) => Attempt[],
    env: NodeJS.ProcessEnv = {},
    names = ['acme.com'],
  ) => {
    const { services, calls } = fakeServices({ confirm });
    const outcome = await new DomainScout(testConfig(env), services).check({ domains: names });
    if (!outcome.ok) throw new Error(outcome.message);
    return { report: outcome.report, calls };
  };

  it('upgrades a confirmed free domain to available, flags premium and shows the exact price', async () => {
    const { report } = await run(() =>
      attempt(ConfirmState.Available, { premium: true, price: exact }),
    );
    const [result] = report.results;
    expect(result).toMatchObject({
      status: DomainStatus.Available,
      premium: true,
      confirmedBy: 'Porkbun',
    });
    expect(result?.note).toBe(Note.Premium);
    expect(result?.buy?.find((link) => link.registrar === 'Porkbun')?.price?.registration).toBe(
      2_500,
    );
    expect(result?.evidence.at(-1)).toMatchObject({
      source: EvidenceSource.Registrar,
      result: ConfirmState.Available,
    });
  });

  it('marks a name that is not in the registry but cannot be sold as reserved', async () => {
    const { report } = await run(() => attempt(ConfirmState.Unavailable));
    expect(report.results[0]).toMatchObject({
      status: DomainStatus.Reserved,
      note: Note.NotSellable,
    });
    expect(report.results[0]?.buy).toBeUndefined();
  });

  it('keeps likely_available when no registrar could answer', async () => {
    const { report } = await run(() => attempt(ConfirmState.Unsupported));
    expect(report.results[0]?.status).toBe(DomainStatus.LikelyAvailable);
  });

  it('confirms at most the configured number of domains and says so', async () => {
    const { report, calls } = await run(
      () => attempt(ConfirmState.Available),
      { [EnvVar.ConfirmMax]: '1' },
      ['a.com', 'b.com'],
    );
    expect(calls.confirmed).toEqual(['a.com']);
    expect(report.warnings).toHaveLength(1);
  });

  it('skips confirmation when the caller asks', async () => {
    const { services, calls } = fakeServices({ confirm: () => attempt(ConfirmState.Available) });
    await new DomainScout(testConfig(), services).check({ domains: ['acme.com'], confirm: false });
    expect(calls.confirmed).toEqual([]);
  });

  it('reports a rejected key once, as a warning', async () => {
    const { report } = await run(
      () => attempt(ConfirmState.Error, { detail: 'API key rejected (HTTP 401)' }),
      {},
      ['a.com', 'b.com'],
    );
    expect(report.warnings).toEqual(['Porkbun API: API key rejected (HTTP 401)']);
  });
});
