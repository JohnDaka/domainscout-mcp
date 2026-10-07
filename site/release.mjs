// Puts the landing page out: `npm --prefix site run release`.
//
// The version is site/package.json's, raised in a pull request like any change. Once it is in
// `main`, this checks `main` out, brings it up to date, tags it `landing-v<version>` and pushes the
// tag - the push starts .github/workflows/landing.yml. Then it goes back to the branch it found.
// Nothing is committed and nothing but the tag is pushed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** The branch releases are made from. */
const MAIN_BRANCH = 'main';
/** The remote the tag goes to. */
const REMOTE = 'origin';
/** Release tags look like landing-v1.0.0; the workflow runs on this prefix. */
const TAG_PREFIX = 'landing-v';
/** What `git rev-parse --abbrev-ref HEAD` prints when no branch is checked out. */
const DETACHED_HEAD = 'HEAD';
/** site/package.json, next to this script. */
const PACKAGE_URL = new URL('./package.json', import.meta.url);
/** How package.json is read. */
const FILE_ENCODING = 'utf8';
/** Exit code of a release that did not happen. */
const EXIT_FAILED = 1;

/** Git's output, as text. */
const git = (...args) => execFileSync('git', args, { encoding: FILE_ENCODING }).trim();
/** A git command whose output goes straight to the terminal. */
const run = (...args) => execFileSync('git', args, { stdio: 'inherit' });

/** Says why nothing was released, and makes the command fail. */
function fail(message) {
  console.error('');
  console.error(`✖ ${message}`);
  process.exitCode = EXIT_FAILED;
}

/** The version `main` has: read after the pull, not the one of the branch the release started on. */
function mainVersion() {
  return JSON.parse(readFileSync(PACKAGE_URL, FILE_ENCODING)).version;
}

/** Tags `main` and pushes the tag, unless that version was released already. */
function tagMain() {
  run('pull', '--ff-only', REMOTE, MAIN_BRANCH);
  const version = mainVersion();
  const tag = `${TAG_PREFIX}${version}`;
  run('fetch', '--tags', REMOTE);
  if (git('tag', '--list', tag) !== '') {
    fail(
      `${tag} is already released. Raise "version" in site/package.json in a pull request ` +
        '(a text fix: 1.0.0 -> 1.0.1, a new section: 1.1.0) and run this again after the merge.',
    );
    return;
  }
  run('tag', '-a', tag, '-m', `Landing ${version}`);
  run('push', REMOTE, tag);
  console.log('');
  console.log(`✔ ${tag} pushed: the landing page deploys in Actions -> landing.`);
}

/** Releases from `main`, then goes back to the branch it started on. */
function release() {
  const startedOn = git('rev-parse', '--abbrev-ref', DETACHED_HEAD);
  run('checkout', MAIN_BRANCH);
  try {
    tagMain();
  } finally {
    if (startedOn !== MAIN_BRANCH && startedOn !== DETACHED_HEAD) run('checkout', startedOn);
  }
}

// A change that is not committed would ride along to `main` and get in the way of the checkout.
if (git('status', '--porcelain') !== '') {
  fail('The working tree has uncommitted changes: commit or stash them first.');
} else {
  release();
}
