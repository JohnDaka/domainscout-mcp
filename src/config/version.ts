import { readFileSync } from 'node:fs';
import { FILE_ENCODING, PACKAGE_JSON_PATH } from '../constants.js';

/** The fields of package.json we read. */
interface PackageJson {
  version: string;
}

/** package.json, found relative to this module both in src/ and in the built dist/. */
const PACKAGE_JSON_URL = new URL(PACKAGE_JSON_PATH, import.meta.url);

/** The package version, e.g. "0.1.0". */
export const VERSION: string = (
  JSON.parse(readFileSync(PACKAGE_JSON_URL, FILE_ENCODING)) as PackageJson
).version;
