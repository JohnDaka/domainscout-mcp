import { readFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  FILE_ENCODING,
  ICON_ENCODING,
  ICON_MIME_TYPE,
  LEGACY_RESOURCE_URI_KEY,
  RESULTS_UI_DIR,
  RESULTS_UI_MIME_TYPE,
  RESULTS_UI_NAME,
  RESULTS_UI_TITLE,
  RESULTS_UI_URI,
  ResultsUiFile,
} from '../constants.js';

/** The card's folder, found relative to this module both in src/ and in the built dist/. */
const RESULTS_UI_DIR_URL = new URL(RESULTS_UI_DIR, import.meta.url);

/** The tags in results.html that the stylesheet and the script take the place of. */
const STYLESHEET_TAG = `<link rel="stylesheet" href="${ResultsUiFile.Styles}" />`;
const SCRIPT_TAG = `<script src="${ResultsUiFile.Script}"></script>`;
/** The attribute in results.html that the logo, as a data URI, takes the place of. */
const LOGO_ATTRIBUTE = `data-logo="${ResultsUiFile.Logo}"`;

/** What the results card is, for resources/list. */
const RESULTS_UI_DESCRIPTION =
  'Interactive panel for check_domains results: the free domains with prices and buy buttons.';

/**
 * What the tool says about its card: hosts that support MCP Apps render it under each call,
 * the others ignore it and show the text report.
 */
export const RESULTS_UI_TOOL_META = {
  ui: { resourceUri: RESULTS_UI_URI },
  [LEGACY_RESOURCE_URI_KEY]: RESULTS_UI_URI,
};

/**
 * What the card asks of the host: no border of the host's around it, as the card draws its own.
 * It loads nothing from elsewhere, so the host's default content security policy suits it.
 */
const RESULTS_UI_CONTENT_META = { ui: { prefersBorder: false } };

function readUiFile(name: string): string {
  return readFileSync(new URL(name, RESULTS_UI_DIR_URL), FILE_ENCODING);
}

/** The logo as a data URI, so the page shows it without fetching anything. */
function logoDataUri(): string {
  const data = readFileSync(new URL(ResultsUiFile.Logo, RESULTS_UI_DIR_URL)).toString(
    ICON_ENCODING,
  );
  return `data:${ICON_MIME_TYPE};${ICON_ENCODING},${data}`;
}

/**
 * The card as one self-contained page: results.html with results.css and results.js inlined in
 * place of their tags, and the logo as a data URI. The sources stay separate files, so Biome
 * lints them like the site's. Replacer functions keep "$" in the sources from being read as
 * replacement patterns. A tag that was reworded would leave the page without its styles, script
 * or logo, so that fails loudly.
 */
export function resultsPage(): string {
  const page = readUiFile(ResultsUiFile.Page);
  for (const tag of [STYLESHEET_TAG, SCRIPT_TAG, LOGO_ATTRIBUTE]) {
    if (!page.includes(tag)) throw new Error(`${ResultsUiFile.Page} lacks ${tag}`);
  }
  const styles = readUiFile(ResultsUiFile.Styles);
  const script = readUiFile(ResultsUiFile.Script);
  const logo = logoDataUri();
  return page
    .replace(LOGO_ATTRIBUTE, () => `data-logo="${logo}"`)
    .replace(STYLESHEET_TAG, () => `<style>\n${styles}</style>`)
    .replace(SCRIPT_TAG, () => `<script>\n${script}</script>`);
}

/** Offers the results card as a resource; it is put together when a host asks for it. */
export function registerResultsUi(server: McpServer): void {
  server.registerResource(
    RESULTS_UI_NAME,
    RESULTS_UI_URI,
    {
      title: RESULTS_UI_TITLE,
      description: RESULTS_UI_DESCRIPTION,
      mimeType: RESULTS_UI_MIME_TYPE,
    },
    () => ({
      contents: [
        {
          uri: RESULTS_UI_URI,
          mimeType: RESULTS_UI_MIME_TYPE,
          text: resultsPage(),
          _meta: RESULTS_UI_CONTENT_META,
        },
      ],
    }),
  );
}
