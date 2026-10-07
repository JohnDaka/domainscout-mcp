// Puts the landing page out: `npm --prefix site run release`. The tag landing-v<version> starts
// .github/workflows/landing.yml; scripts/release.mjs does the tagging, for the package too.
import { releaseFromMain } from '../scripts/release.mjs';

releaseFromMain({
  packageUrl: new URL('./package.json', import.meta.url),
  packageFile: 'site/package.json',
  tagPrefix: 'landing-v',
  workflow: 'landing',
});
