// Runs from `npm version` (the "version" script): copies package.json's new version into
// manifest.json (the Claude Desktop extension) and server.json (the MCP Registry), so the files
// never disagree. publish.yml refuses to release when they do.
import { readFileSync, writeFileSync } from 'node:fs';

/** How the files are read and written. */
const ENCODING = 'utf8';
/** Indentation of the JSON files; Biome formats them afterwards. */
const JSON_INDENT = 2;
/** The version's source. */
const PACKAGE_URL = new URL('../package.json', import.meta.url);
/** The Claude Desktop extension's manifest. */
const MANIFEST_URL = new URL('../manifest.json', import.meta.url);
/** The MCP Registry entry: its own version and its npm package's. */
const SERVER_URL = new URL('../server.json', import.meta.url);

/** A JSON file's content. */
function readJson(url) {
  return JSON.parse(readFileSync(url, ENCODING));
}

function writeJson(url, data) {
  writeFileSync(url, `${JSON.stringify(data, null, JSON_INDENT)}\n`);
}

const { version } = readJson(PACKAGE_URL);
const manifest = readJson(MANIFEST_URL);
const server = readJson(SERVER_URL);
manifest.version = version;
server.version = version;
for (const entry of server.packages) entry.version = version;
writeJson(MANIFEST_URL, manifest);
writeJson(SERVER_URL, server);
console.log(`manifest.json and server.json -> ${version}`);
