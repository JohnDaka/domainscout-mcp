import { describe, expect, it } from 'vitest';
import {
  ConfirmState,
  DnsState,
  type DomainResult,
  DomainStatus,
  EvidenceSource,
  LookupState,
  type Price,
  type Report,
} from '../src/core/types.js';
import { AFFILIATE_DISCLOSURE, ReportHeading, ReportText } from '../src/messages/index.js';
import { rejectionText, summarize } from '../src/report/summary.js';
import { TextReport } from '../src/report/text-report.js';

const price = (registration: number, renewal: number, extra: Partial<Price> = {}): Price => ({
  registration,
  renewal,
  currency: 'USD',
  minYears: 1,
  source: 'test',
  ...extra,
});

const result = (
  domain: string,
  status: DomainStatus,
  extra: Partial<DomainResult> = {},
): DomainResult => ({
  domain,
  display: domain,
  input: domain,
  tld: domain.split('.').slice(1).join('.'),
  status,
  evidence: [],
  ...extra,
});

const render = (report: Report): string => new TextReport(report).render();

/** Lines and sections of the text report. */
const LINE_BREAK = '\n';
const SECTION_BREAK = '\n\n';

/** The report with every wrapped line joined back to the one before it. */
const unwrap = (text: string): string => text.replace(/\n *(?=\S)/g, ' ');

/** Lines wider than the report's width; only a line holding a URL may be. */
const tooWide = (text: string): string[] =>
  text.split(LINE_BREAK).filter((line) => line.length > 100 && !line.includes('https://'));

const REPORT: Report = {
  tlds: ['com', 'ai'],
  elapsedMs: 1_234,
  warnings: ['Porkbun API: API key rejected'],
  invalid: [{ input: 'foo_bar', reason: 'only letters, digits and hyphens are allowed' }],
  results: [
    result('gold.ai', DomainStatus.Available, {
      confirmedBy: 'Porkbun',
      premium: true,
      buy: [
        {
          registrar: 'Porkbun',
          url: 'https://porkbun.test/gold.ai',
          affiliate: false,
          price: price(2_500, 160, { minYears: 2, confirmed: true }),
        },
        { registrar: 'Namecheap', url: 'https://partner.test/gold.ai', affiliate: true },
      ],
    }),
    result('plain.com', DomainStatus.LikelyAvailable, {
      buy: [
        {
          registrar: 'Cloudflare',
          url: 'https://cf.test/plain.com',
          affiliate: false,
          price: price(10.46, 10.46),
        },
      ],
    }),
    result('dropping.com', DomainStatus.Taken, { registration: { dropping: true } }),
    result('dated.com', DomainStatus.Taken, { registration: { expires: '2030-02-03T04:05:06Z' } }),
    result('taken.com', DomainStatus.Taken),
    result('blocked.com', DomainStatus.Reserved),
    result('flaky.com', DomainStatus.Unknown, {
      evidence: [
        { source: EvidenceSource.Dns, result: DnsState.Error, detail: 'ESERVFAIL' },
        { source: EvidenceSource.Rdap, result: LookupState.Error, detail: 'HTTP 503' },
        { source: EvidenceSource.Registrar, result: ConfirmState.Error, detail: 'timed out' },
      ],
    }),
    result('quiet.com', DomainStatus.Unknown, {
      note: 'Could not verify right now, try again later.',
    }),
  ],
};

describe('TextReport', () => {
  const text = render(REPORT);

  it('starts with the counts and the elapsed time', () => {
    expect(text.split('\n')[0]).toBe(
      'Checked 8 domain(s) in 1.2s: 2 available, 3 taken, 1 reserved, 2 unknown.',
    );
  });

  it('lists free domains first, with confirmation, premium, minimum term and prices', () => {
    expect(text).toContain(ReportHeading.Available);
    expect(text).toContain('- gold.ai (PREMIUM name, confirmed by Porkbun)');
    expect(text).toContain('Sold for at least 2 years at a time.');
    expect(text).toContain(
      'Porkbun: $2,500.00/yr, renews at $160.00/yr (exact price for this name)',
    );
    expect(text).toContain('Namecheap: https://partner.test/gold.ai');
    expect(text).toContain('Cloudflare: $10.46/yr, renews at $10.46/yr: https://cf.test/plain.com');
    expect(unwrap(text)).not.toContain(ReportText.CompactFootnote);
  });

  it('describes taken, reserved and unverifiable domains', () => {
    expect(text).toContain(
      'TAKEN: dropping.com (in deletion, may become available soon), dated.com (until 2030-02-03),\n  taken.com',
    );
    expect(text).toContain('RESERVED: blocked.com');
    expect(text).toContain('- flaky.com: RDAP: HTTP 503; REGISTRAR: timed out');
    expect(text).not.toContain('ESERVFAIL');
    expect(text).toContain('- quiet.com: Could not verify right now, try again later.');
  });

  it('ends with skipped input, notes and the affiliate disclosure', () => {
    expect(text).toContain('- "foo_bar": only letters, digits and hyphens are allowed');
    expect(text).toContain('NOTES:\n- Porkbun API: API key rejected');
    expect(unwrap(text).endsWith(AFFILIATE_DISCLOSURE)).toBe(true);
  });

  it('keeps footnotes, notes and the disclosure within 100 characters a line', () => {
    expect(tooWide(text)).toEqual([]);
    expect(unwrap(text)).toContain(ReportText.AvailableFootnote);
  });

  it('leaves out the disclosure and empty sections', () => {
    const plain: Report = {
      ...REPORT,
      warnings: [],
      invalid: [],
      results: REPORT.results.slice(1, 2),
    };
    const plainText = render(plain);
    expect(plainText).not.toContain(AFFILIATE_DISCLOSURE);
    expect(plainText).not.toContain('TAKEN');
    expect(plainText).not.toContain('NOTES');
  });

  it('says what went wrong when an unknown result has neither errors nor a note', () => {
    const report: Report = { ...REPORT, results: [result('odd.com', DomainStatus.Unknown)] };
    expect(render(report)).toContain(`- odd.com: ${ReportText.UnknownError}`);
  });
});

describe('TextReport with many free domains', () => {
  const free = Array.from({ length: 7 }, (_, index) =>
    result(`name${index}.com`, DomainStatus.LikelyAvailable, {
      buy: [
        {
          registrar: 'Porkbun',
          url: `https://porkbun.test/name${index}.com`,
          affiliate: false,
          price: price(5.98, 11.08),
        },
        { registrar: 'Hover', url: `https://hover.test/name${index}.com`, affiliate: false },
      ],
    }),
  );
  const ai = result('name.ai', DomainStatus.Available, {
    confirmedBy: 'Cloudflare',
    buy: [
      {
        registrar: 'Cloudflare',
        url: 'https://cf.test/name.ai',
        affiliate: false,
        price: price(80, 80, { minYears: 2, confirmed: true }),
      },
    ],
  });
  const unpriced = result('bare.net', DomainStatus.LikelyAvailable, {
    buy: [{ registrar: 'Namecheap', url: 'https://nc.test/bare.net', affiliate: false }],
  });
  const linkless = result('nolinks.org', DomainStatus.LikelyAvailable);
  const taken = Array.from({ length: 21 }, (_, index) =>
    result(`taken${index}.com`, DomainStatus.Taken, {
      registration: { expires: '2030-02-03T04:05:06Z', dropping: index === 0 },
    }),
  );
  const text = render({
    tlds: ['com'],
    elapsedMs: 10_000,
    warnings: [],
    invalid: [],
    results: [...free, ai, unpriced, linkless, ...taken],
  });

  it('gives each free domain one line with its cheapest offer', () => {
    expect(text).toContain(ReportHeading.AvailableCompact);
    expect(text).toContain(
      '- name0.com: $5.98/yr at Porkbun (renews at $11.08/yr) https://porkbun.test/name0.com',
    );
    expect(text).not.toContain('hover.test');
    expect(unwrap(text)).toContain(ReportText.CompactFootnote);
  });

  it('keeps the confirmation, the minimum term and unpriced offers on that line', () => {
    expect(text).toContain(
      '- name.ai (confirmed by Cloudflare): $80.00/yr at Cloudflare (2-year minimum) https://cf.test/name.ai',
    );
    expect(text).toContain('- bare.net: Namecheap https://nc.test/bare.net');
    expect(text).toContain('- nolinks.org\n');
  });

  it('wraps a long list onto indented lines that never get wider than 100 characters', () => {
    const takenSection = text.slice(text.indexOf('TAKEN:')).split(SECTION_BREAK)[0] ?? '';
    const takenLines = takenSection.split(LINE_BREAK);
    expect(takenLines.length).toBeGreaterThan(1);
    expect(takenLines.every((line) => line.length <= 100)).toBe(true);
    expect(takenLines.slice(1).every((line) => line.startsWith('  '))).toBe(true);
    expect(takenLines.at(-1)?.endsWith('taken20.com')).toBe(true);
  });

  it('lists many taken domains by name only, still marking the ones being deleted', () => {
    expect(text).toContain(
      'TAKEN: taken0.com (in deletion, may become available soon), taken1.com,',
    );
    expect(text).not.toContain('until 2030');
  });
});

describe('summarize', () => {
  it('counts every status', () => {
    expect(summarize(REPORT)).toEqual({
      available: 1,
      likely_available: 1,
      taken: 3,
      reserved: 1,
      unknown: 2,
      total: 8,
      elapsed_ms: 1_234,
    });
  });
});

describe('rejectionText', () => {
  it('puts the reason first, then every skipped entry', () => {
    expect(rejectionText('Nothing to check.', REPORT.invalid)).toBe(
      'Nothing to check.\n- "foo_bar": only letters, digits and hyphens are allowed',
    );
  });
});
