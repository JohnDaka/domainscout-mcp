/*
 * What is actually running, printed to the browser console on load, as dakaio.com and beladay.com
 * do. version.json is written next to the page when it is deployed
 * (.github/workflows/landing.yml), named after the time and the commit; locally there is none. The stamp also
 * stays on `window.domainscout` for a look in the console later.
 */
(() => {
  /** The release stamp, next to this script. */
  const VERSION_URL = new URL('version.json', document.currentScript.src).href;
  /** A version is never worth making the page wait: no answer in a couple of seconds, no version. */
  const WAIT_MS = 2500;
  /** Characters of the commit hash shown. */
  const SHORT_COMMIT_LENGTH = 7;
  /** Characters of an ISO time kept: "2026-10-07T12:00". */
  const MINUTES_LENGTH = 16;
  /** What is shown for a missing value, or for a missing stamp. */
  const Missing = { Value: 'unknown', Stamp: 'unavailable' };
  /** Between the parts of the line. */
  const SEPARATOR = ' · ';
  /** Console styles: the name, then the details. */
  const NAME_STYLE = 'color:#3cc8ff;font-weight:700';
  const DETAILS_STYLE = 'color:#8f93c4;font-weight:400';

  /** The stamp, or null when there is none or it does not come in time. */
  const readStamp = async () => {
    try {
      const response = await fetch(VERSION_URL, {
        cache: 'no-store',
        signal: AbortSignal.timeout(WAIT_MS),
      });
      if (!response.ok) return null;
      const body = await response.json();
      return { version: body.version ?? '', commit: body.commit ?? '', built: body.built ?? '' };
    } catch {
      return null;
    }
  };

  /** "2026-10-07 12:00 UTC" out of an ISO time. */
  const when = (iso) => {
    if (!iso) return Missing.Value;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return iso;
    return `${at.toISOString().slice(0, MINUTES_LENGTH).replace('T', ' ')} UTC`;
  };

  /** "1.0.0 · 86c48a2 · 2026-10-07 12:00 UTC" */
  const describe = (stamp) => {
    if (!stamp) return Missing.Stamp;
    const parts = [
      stamp.version || Missing.Value,
      stamp.commit.slice(0, SHORT_COMMIT_LENGTH),
      when(stamp.built),
    ];
    return parts.filter(Boolean).join(SEPARATOR);
  };

  const print = async () => {
    const landing = await readStamp();
    window.domainscout = { landing };
    console.info(`%cdomainscout%c\n  landing  ${describe(landing)}`, NAME_STYLE, DETAILS_STYLE);
  };

  print();
})();
