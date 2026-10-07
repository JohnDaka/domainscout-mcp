// Releases from `main` by pushing a tag; the tag starts the workflow that puts the release out.
//
//   npm run release                 the package: tag v<version>, .github/workflows/publish.yml
//   npm --prefix site run release   the landing page: tag landing-v<version>, .github/workflows/landing.yml
//
// The version is the package.json's, raised in a pull request like any change. Once it is in
// `main`, this checks `main` out, brings it up to date, tags it and pushes the tag. Then it goes
// back to the branch it found. Nothing is committed and nothing but the tag is pushed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The branch releases are made from. */
const MAIN_BRANCH = 'main';
/** The remote the tag goes to. */
const REMOTE = 'origin';
/** What `git rev-parse --abbrev-ref HEAD` prints when no branch is checked out. */
const DETACHED_HEAD = 'HEAD';
/** How files and git's output are read. */
const ENCODING = 'utf8';
/** Exit code of a release that did not happen. */
const EXIT_FAILED = 1;

/** The package's own release. */
const PACKAGE_RELEASE = {
  packageUrl: new URL('../package.json', import.meta.url),
  packageFile: 'package.json',
  tagPrefix: 'v',
  workflow: 'publish',
};

/** Git's output, as text. */
const git = (...args) => execFileSync('git', args, { encoding: ENCODING }).trim();
/** A git command whose output goes straight to the terminal. */
const run = (...args) => execFileSync('git', args, { stdio: 'inherit' });

/** Says why nothing was released, and makes the command fail. */
function fail(message) {
  console.error('');
  console.error(`✖ ${message}`);
  process.exitCode = EXIT_FAILED;
}

/** The name and version `main` has: read after the pull, not those of the branch it started on. */
function readPackage(packageUrl) {
  return JSON.parse(readFileSync(packageUrl, ENCODING));
}

/** Tags `main` and pushes the tag, unless that version was released already. */
function tagMain(release) {
  run('pull', '--ff-only', REMOTE, MAIN_BRANCH);
  const { name, version } = readPackage(release.packageUrl);
  const tag = `${release.tagPrefix}${version}`;
  run('fetch', '--tags', REMOTE);
  if (git('tag', '--list', tag) !== '') {
    fail(
      `${tag} is already released. Raise "version" in ${release.packageFile} in a pull request ` +
        '(a fix: 1.0.0 -> 1.0.1, something new: 1.1.0) and run this again after the merge.',
    );
    return;
  }
  run('tag', '-a', tag, '-m', `${name} ${version}`);
  run('push', REMOTE, tag);
  console.log('');
  console.log(`✔ ${tag} pushed: the release runs in Actions -> ${release.workflow}.`);
}

/**
 * Releases from `main`, then goes back to the branch it started on. A change that is not
 * committed would ride along to `main` and get in the way of the checkout, so it stops instead.
 */
export function releaseFromMain(release) {
  if (git('status', '--porcelain') !== '') {
    fail('The working tree has uncommitted changes: commit or stash them first.');
    return;
  }
  const startedOn = git('rev-parse', '--abbrev-ref', DETACHED_HEAD);
  run('checkout', MAIN_BRANCH);
  try {
    tagMain(release);
  } finally {
    if (startedOn !== MAIN_BRANCH && startedOn !== DETACHED_HEAD) run('checkout', startedOn);
  }
}

// Run directly (`npm run release`): the package.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  releaseFromMain(PACKAGE_RELEASE);
}
