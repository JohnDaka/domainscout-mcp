// Runs from `npm version` (the "version" script): copies package.json's new version into
// manifest.json (the Claude Desktop extension), server.json (the MCP Registry) and the Claude
// plugin (its version and the package version its server runs), so the files never disagree.
// publish.yml refuses to release when they do.
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
/** The Claude plugin's manifest. */
const PLUGIN_URL = new URL('../plugin/.claude-plugin/plugin.json', import.meta.url);
/** The Claude plugin's MCP servers: npx runs the package at an exact version. */
const PLUGIN_MCP_URL = new URL('../plugin/.mcp.json', import.meta.url);
/** The plugin's server entry in .mcp.json. */
const PLUGIN_SERVER = 'domainscout';
/** Where a pinned package name ends and its version starts, as in `@scope/name@1.2.3`. */
const VERSION_SEPARATOR = '@';

/** A JSON file's content. */
function readJson(url) {
  return JSON.parse(readFileSync(url, ENCODING));
}

function writeJson(url, data) {
  writeFileSync(url, `${JSON.stringify(data, null, JSON_INDENT)}\n`);
}

const { name, version } = readJson(PACKAGE_URL);
const manifest = readJson(MANIFEST_URL);
const server = readJson(SERVER_URL);
const plugin = readJson(PLUGIN_URL);
const pluginMcp = readJson(PLUGIN_MCP_URL);
manifest.version = version;
server.version = version;
for (const entry of server.packages) entry.version = version;
plugin.version = version;
const pluginServer = pluginMcp.mcpServers[PLUGIN_SERVER];
pluginServer.args = pluginServer.args.map((arg) =>
  arg.startsWith(`${name}${VERSION_SEPARATOR}`) ? `${name}${VERSION_SEPARATOR}${version}` : arg,
);
writeJson(MANIFEST_URL, manifest);
writeJson(SERVER_URL, server);
writeJson(PLUGIN_URL, plugin);
writeJson(PLUGIN_MCP_URL, pluginMcp);
console.log(`manifest.json, server.json and the plugin -> ${version}`);
