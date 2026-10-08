import { readFileSync } from 'node:fs';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  FILE_ENCODING,
  LEGACY_RESOURCE_URI_KEY,
  RESULTS_UI_MIME_TYPE,
  RESULTS_UI_NAME,
  RESULTS_UI_PATH,
  RESULTS_UI_TITLE,
  RESULTS_UI_URI,
} from '../constants.js';

/** The card in the package, found relative to this module both in src/ and in the built dist/. */
const RESULTS_UI_FILE_URL = new URL(RESULTS_UI_PATH, import.meta.url);

/** What the results card is, for resources/list. */
const RESULTS_UI_DESCRIPTION =
  'Interactive card for check_domains results: the free domains with prices and buy buttons.';

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

/** Offers the results card as a resource; it is read from the package when a host asks for it. */
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
          text: readFileSync(RESULTS_UI_FILE_URL, FILE_ENCODING),
          _meta: RESULTS_UI_CONTENT_META,
        },
      ],
    }),
  );
}
