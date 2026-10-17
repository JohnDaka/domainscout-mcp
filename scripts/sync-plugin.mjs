// Runs as `npm run plugin` (publish.yml's last step), once the version in package.json is on npm:
// points the Claude plugin (plugin/) at it. The plugin's manifest takes the version, and .mcp.json
// runs the package at it. The plugin holds no package.json or lockfile of its own: with them the
// plugin directory installs the dependencies into the plugin, thousands of files past its limit.
// The package pins its dependencies itself, with the npm-shrinkwrap.json it is published with.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/** How the files are read and written. */
const ENCODING = 'utf8';
/** Indentation of the JSON files. */
const JSON_INDENT = 2;
/** The version's source. */
const PACKAGE_URL = new URL('../package.json', import.meta.url);
/** The Claude plugin's manifest. */
const PLUGIN_URL = new URL('../plugin/.claude-plugin/plugin.json', import.meta.url);
/** The Claude plugin's MCP servers: npx runs the package at an exact version. */
const PLUGIN_MCP_URL = new URL('../plugin/.mcp.json', import.meta.url);
/** The plugin's server entry in .mcp.json. */
const PLUGIN_SERVER = 'domainscout';
/** Where a pinned package name ends and its version starts, as in `@scope/name@1.2.3`. */
const VERSION_SEPARATOR = '@';

function readJson(url) {
  return JSON.parse(readFileSync(url, ENCODING));
}

function writeJson(url, data) {
  writeFileSync(url, `${JSON.stringify(data, null, JSON_INDENT)}\n`);
}

const { name, version } = readJson(PACKAGE_URL);
const pinned = `${name}${VERSION_SEPARATOR}${version}`;
// A plugin pointed at a version npm does not serve would fail to start for everyone.
try {
  execSync(`npm view ${pinned} version`, { encoding: ENCODING, stdio: 'pipe' });
} catch {
  console.error(`${pinned} is not on npm yet: publish it first, then run this.`);
  process.exit(1);
}

const plugin = readJson(PLUGIN_URL);
plugin.version = version;
writeJson(PLUGIN_URL, plugin);

const pluginMcp = readJson(PLUGIN_MCP_URL);
const pluginServer = pluginMcp.mcpServers[PLUGIN_SERVER];
pluginServer.args = pluginServer.args.map((arg) =>
  arg.startsWith(`${name}${VERSION_SEPARATOR}`) ? pinned : arg,
);
writeJson(PLUGIN_MCP_URL, pluginMcp);

console.log(`the plugin -> ${pinned}`);
