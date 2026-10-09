import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The panel's TLD box in the settings (ui/results.js) takes a TLD typed by the visitor. The panel
 * is a browser script with no exports, so these tests read its two patterns from the source and
 * run them. Before the fix, the dots were unescaped: "com.ua" lost its first letter, "co.gb" was
 * rejected, and any text with one character in place of the dot was accepted.
 */
const SOURCE = readFileSync(new URL('../ui/results.js', import.meta.url), 'utf8');

/** A regular expression assigned to a constant in the panel's source, as a RegExp. */
function patternOf(name: string): RegExp {
  const line = SOURCE.split('\n').find((text) => text.startsWith(`const ${name} = `));
  if (!line) throw new Error(`${name} is not in ui/results.js`);
  const literal = line.slice(`const ${name} = `.length).replace(/;\s*$/, '');
  return new Function(`return ${literal};`)() as RegExp;
}

const TLD_PATTERN = patternOf('TLD_PATTERN');
const LEADING_DOT = patternOf('LEADING_DOT');

/** What the panel does with a typed TLD before it checks it: trim, lowercase, drop a leading dot. */
const normalize = (typed: string) => typed.trim().toLowerCase().replace(LEADING_DOT, '');

describe('the settings TLD box', () => {
  it.each(['com', 'ai', 'studio', 'co.gb', 'com.ua', 'co.uk', 'org.uk', 'net.au'])(
    'accepts %s as typed',
    (tld) => {
      expect(TLD_PATTERN.test(normalize(tld))).toBe(true);
    },
  );

  it('keeps every letter of a second-level TLD: com.ua is not om.ua', () => {
    expect(normalize('com.ua')).toBe('com.ua');
    expect(normalize('co.gb')).toBe('co.gb');
  });

  it('drops one leading dot, as in ".com.ua", and nothing else', () => {
    expect(normalize('.com.ua')).toBe('com.ua');
    expect(normalize('  .CO.UK  ')).toBe('co.uk');
    expect(normalize('ai')).toBe('ai');
  });

  it.each(['anything here', 'a', 'x y', 'foo.bar.baz', 'co.', '.', '', 'com/ua', 'com_ua'])(
    'rejects %j',
    (typed) => {
      expect(TLD_PATTERN.test(normalize(typed))).toBe(false);
    },
  );

  it('does not treat a dot as a wildcard: a character in its place is not a second level', () => {
    expect(TLD_PATTERN.test('comxua')).toBe(true); // one label: a valid single-level TLD
    expect(TLD_PATTERN.test('co gb')).toBe(false);
    expect(TLD_PATTERN.test('co-gb')).toBe(true); // a hyphen is part of a label, not a second level
    expect(TLD_PATTERN.test('co_gb')).toBe(false);
  });

  it('allows labels of two to 24 characters only', () => {
    expect(TLD_PATTERN.test('a'.repeat(2))).toBe(true);
    expect(TLD_PATTERN.test('a'.repeat(24))).toBe(true);
    expect(TLD_PATTERN.test('a'.repeat(1))).toBe(false);
    expect(TLD_PATTERN.test('a'.repeat(25))).toBe(false);
    expect(TLD_PATTERN.test(`co.${'a'.repeat(25)}`)).toBe(false);
  });
});
