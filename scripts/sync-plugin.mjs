// Runs as `npm run plugin` (publish.yml's last step), once the version in package.json is on npm:
// points the Claude plugin (plugin/) at it. The plugin's manifest takes the version, .mcp.json runs
// the package at it, and plugin/package.json with its package-lock.json pins it with the
// registry's hashes, which the plugin directory asks for. Only a published version has hashes, so
// this comes after the release.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** How the files are read and written. */
const ENCODING = 'utf8';
/** Indentation of the JSON files. */
const JSON_INDENT = 2;
/** The version's source. */
const PACKAGE_URL = new URL('../package.json', import.meta.url);
/** The plugin's folder, where its package.json and package-lock.json live. */
const PLUGIN_DIR = fileURLToPath(new URL('../plugin/', import.meta.url));
/** The Claude plugin's manifest. */
const PLUGIN_URL = new URL('../plugin/.claude-plugin/plugin.json', import.meta.url);
/** The Claude plugin's MCP servers: npx runs the package at an exact version. */
const PLUGIN_MCP_URL = new URL('../plugin/.mcp.json', import.meta.url);
/** The plugin's own package.json: the server's package at an exact version, for the lockfile. */
const PLUGIN_PACKAGE_URL = new URL('../plugin/package.json', import.meta.url);
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

/** An npm command; its arguments are this script's own, never anything typed in. */
function npm(args, cwd) {
  return execSync(`npm ${args.join(' ')}`, { cwd, encoding: ENCODING, stdio: 'pipe' });
}

const { name, version } = readJson(PACKAGE_URL);
const pinned = `${name}${VERSION_SEPARATOR}${version}`;
try {
  npm(['view', pinned, 'version']);
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

const pluginPackage = readJson(PLUGIN_PACKAGE_URL);
pluginPackage.version = version;
pluginPackage.dependencies = { [name]: version };
writeJson(PLUGIN_PACKAGE_URL, pluginPackage);
npm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], PLUGIN_DIR);

console.log(`the plugin -> ${pinned}, with its package-lock.json`);
