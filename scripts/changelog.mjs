// Writes CHANGELOG.md from the pull requests merged into main, grouped by kind.
//
//   node scripts/changelog.mjs             the version in package.json, on top of the file:
//                                          everything merged since the last v<version> tag
//   node scripts/changelog.mjs --history   the whole file again, one entry per v<version> tag
//
// publish.yml runs the first on every release, before it commits the version. A pull request's
// title is its line, as `.github/workflows/pr-title.yml` asks for it: `feat: …`, `fix(ui): …`.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** How files and git's output are read. */
const ENCODING = 'utf8';
/** The changelog, at the repository's root. */
const CHANGELOG_URL = new URL('../CHANGELOG.md', import.meta.url);
/** The version's source. */
const PACKAGE_URL = new URL('../package.json', import.meta.url);
/** Where a pull request's number links to. */
const PULL_URL = 'https://github.com/JohnDaka/domainscout-mcp/pull/';
/** Release tags: v1.2.3. */
const TAG_PREFIX = 'v';
/** The file's first lines, above the newest entry. */
const HEADER =
  '# Changelog\n\nEvery release of `@dakaio/domainscout-mcp`, newest first. Each line is a merged pull request.\n';
/** Between the fields and between the commits of git's log. */
const FIELD = '\x1f';
const RECORD = '\x1e';
/** A merge commit's subject, with its pull request's number. */
const MERGE_SUBJECT = /^Merge pull request #(\d+) /;
/** A squashed pull request's subject, with its number at the end. */
const SQUASH_SUBJECT = /^(.*) \(#(\d+)\)$/;
/** Commits that are not changes: the release's own, and the pull requests that only raised versions. */
const SKIPPED = [
  /\[skip ci\]/,
  /^build: domainscout-(mcp|site|plugin)\b/,
  /^build: domainscout plugin\b/,
];
/** A title's kind: `feat`, `fix(ui)`, `feat!`. */
const KIND = /^([a-z]+)(\([^)]*\))?!?:\s*/;

/** The groups of an entry, in the order they are shown, and the kinds each takes. */
const GROUPS = new Map()
  .set('Features', ['feat'])
  .set('Fixes', ['fix', 'perf'])
  .set('Other', undefined);

function git(...args) {
  return execFileSync('git', args, { encoding: ENCODING }).trim();
}

/** The version tags reachable from HEAD, oldest first. */
function versionTags() {
  return git('tag', '--merged', 'HEAD', '--list', `${TAG_PREFIX}*`, '--sort=version:refname')
    .split('\n')
    .filter(Boolean);
}

/** The pull requests (or plain commits) on main between two points, as { title, number }. */
function changes(from, to) {
  const range = from ? `${from}..${to}` : to;
  // The raw message, not %s: git joins a first paragraph without a blank line into one subject.
  const log = git('log', range, '--first-parent', `--format=%B${FIELD}${RECORD}`);
  const found = [];
  for (const record of log.split(RECORD)) {
    const [message = ''] = record.trim().split(FIELD);
    const [subject = '', ...rest] = message.trim().split('\n');
    const body = rest.join('\n').trim();
    if (!subject) continue;
    const merge = subject.match(MERGE_SUBJECT);
    const squash = subject.match(SQUASH_SUBJECT);
    let title = subject;
    let number;
    if (merge) {
      title = body.trim().split('\n')[0] || subject;
      number = merge[1];
    } else if (squash) {
      title = squash[1];
      number = squash[2];
    }
    if (SKIPPED.some((pattern) => pattern.test(title) || pattern.test(subject))) continue;
    found.push({ title: title.trim(), number });
  }
  return found;
}

/** A change as a line: its title without the kind, then a link to its pull request. */
function line({ title, number }) {
  const text = title.replace(KIND, '');
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return number ? `- ${sentence} ([#${number}](${PULL_URL}${number}))` : `- ${sentence}`;
}

/** One version's entry: its heading and its changes by group. */
function entry(version, date, found) {
  const lines = [`## ${version} - ${date}`, ''];
  const claimed = new Set();
  for (const [group, kinds] of GROUPS) {
    const members = found.filter((change) => {
      const kind = change.title.match(KIND)?.[1];
      return kinds ? kinds.includes(kind) : !claimed.has(change);
    });
    for (const member of members) claimed.add(member);
    if (!members.length) continue;
    lines.push(`### ${group}`, '', ...members.map(line), '');
  }
  if (!found.length) lines.push('No changes besides the release itself.', '');
  return lines.join('\n');
}

/** The day a tag was made, as 2026-10-09. */
function tagDate(tag) {
  return git('log', '-1', '--format=%cs', tag);
}

const today = new Date().toISOString().slice(0, 10);

if (process.argv.includes('--history')) {
  const tags = versionTags();
  const entries = tags.map((tag, index) =>
    entry(tag.slice(TAG_PREFIX.length), tagDate(tag), changes(tags[index - 1], tag)),
  );
  writeFileSync(CHANGELOG_URL, `${HEADER}\n${entries.reverse().join('\n')}`);
  console.log(`CHANGELOG.md -> ${tags.length} releases`);
} else {
  const { version } = JSON.parse(readFileSync(PACKAGE_URL, ENCODING));
  const previous = versionTags()
    .filter((tag) => tag !== `${TAG_PREFIX}${version}`)
    .at(-1);
  const current = existsSync(CHANGELOG_URL) ? readFileSync(CHANGELOG_URL, ENCODING) : HEADER;
  const rest = current.startsWith(HEADER) ? current.slice(HEADER.length) : current;
  writeFileSync(
    CHANGELOG_URL,
    `${HEADER}\n${entry(version, today, changes(previous, 'HEAD'))}${rest}`,
  );
  console.log(`CHANGELOG.md -> ${version}, since ${previous ?? 'the first commit'}`);
}
