import { describe, expect, it } from 'vitest';
import { normalizeTld, normalizeTlds, splitEntries } from '../src/core/domain-name.js';
import { TargetParser } from '../src/core/target-parser.js';
import { InvalidReason } from '../src/messages/index.js';

const parseTargets = (entries: string[], tlds: string[]) => new TargetParser(tlds).parse(entries);
const domains = (entries: string[], tlds: string[] = ['com', 'net', 'ai']) =>
  parseTargets(entries, tlds).targets.map((target) => target.domain);

describe('splitEntries', () => {
  it('splits on spaces, commas, semicolons and new lines', () => {
    expect(splitEntries(['a.com, b\nc;d  e'])).toEqual(['a.com', 'b', 'c', 'd', 'e']);
  });
});

describe('normalizeTld', () => {
  it.each([
    ['.AI', 'ai'],
    ['com', 'com'],
    ['Co.Uk.', 'co.uk'],
    ['xn--p1ai', 'xn--p1ai'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeTld(raw)).toBe(expected);
  });

  it('rejects things that are not public suffixes', () => {
    expect(normalizeTld('notatld')).toBeUndefined();
    expect(normalizeTld('')).toBeUndefined();
  });
});

describe('normalizeTlds', () => {
  it('normalizes a list, drops duplicates and collects what is not a TLD', () => {
    expect(normalizeTlds(['.COM', 'com', 'Io', 'nope'])).toEqual({
      tlds: ['com', 'io'],
      unknown: ['nope'],
    });
  });
});

describe('TargetParser', () => {
  it('expands a bare name with every TLD', () => {
    expect(domains(['acme'])).toEqual(['acme.com', 'acme.net', 'acme.ai']);
  });

  it('checks a name that has a TLD exactly as given', () => {
    expect(domains(['acme.io'])).toEqual(['acme.io']);
  });

  it('reduces URLs and subdomains to the registrable domain', () => {
    expect(domains(['https://User@WWW.Acme.dev:8080/path?q=1#x', 'blog.acme.co.uk'])).toEqual([
      'acme.dev',
      'acme.co.uk',
    ]);
  });

  it('converts internationalized names to punycode and keeps the Unicode form for display', () => {
    const [target] = parseTargets(['ËXAMPLE.com'], []).targets;
    expect(target?.domain).toBe('xn--xample-ova.com');
    expect(target?.display).toBe('ëxample.com');
    expect(target?.tld).toBe('com');
  });

  it('removes duplicates', () => {
    expect(domains(['acme.com', 'ACME.com', 'acme'], ['com'])).toEqual(['acme.com']);
  });

  it('reports an invalid name once, not once per TLD', () => {
    const { targets, invalid } = parseTargets(['foo_bar'], ['com', 'net', 'ai']);
    expect(targets).toEqual([]);
    expect(invalid).toEqual([{ input: 'foo_bar', reason: InvalidReason.BadCharacters }]);
  });

  it.each([
    ['bad.notatld', InvalidReason.UnknownTld],
    ['1.2.3.4', InvalidReason.IpAddress],
    ['-acme', InvalidReason.EdgeHyphen],
    ['ab--cd', InvalidReason.ReservedHyphens],
    ['a'.repeat(64), InvalidReason.TooLong],
  ])('rejects %s', (input, reason) => {
    expect(parseTargets([input], ['com']).invalid).toEqual([{ input, reason }]);
  });

  it('accepts punycode labels despite the hyphens in positions 3-4', () => {
    expect(domains(['xn--e1afmkfd.com'])).toEqual(['xn--e1afmkfd.com']);
  });

  it('asks for a TLD when a bare name has none to try', () => {
    expect(parseTargets(['acme'], []).invalid).toEqual([
      { input: 'acme', reason: InvalidReason.NoTlds },
    ]);
  });
});
