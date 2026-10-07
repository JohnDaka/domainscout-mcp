import { readFileSync } from 'node:fs';
import type { Icon, Implementation } from '@modelcontextprotocol/sdk/types.js';
import { VERSION } from '../config/version.js';
import {
  ICON_ENCODING,
  ICON_MIME_TYPE,
  ICON_PATH,
  ICON_SIZE_PACKAGED,
  ICON_SIZE_WEBSITE,
  ICON_URL,
  SERVER_NAME,
  SERVER_TITLE,
  WEBSITE_URL,
} from '../constants.js';
import { SERVER_DESCRIPTION } from '../messages/index.js';

/** The packaged icon, found relative to this module both in src/ and in the built dist/. */
const ICON_FILE_URL = new URL(ICON_PATH, import.meta.url);

/** The icon on the website, for clients that load icons by URL. */
const WEBSITE_ICON: Icon = { src: ICON_URL, mimeType: ICON_MIME_TYPE, sizes: [ICON_SIZE_WEBSITE] };

/**
 * The packaged icon as a data URI, so a client shows it without going online. None when the file
 * is missing, as in a copy of dist/ without assets/: the website's icon is still there.
 */
function packagedIcons(): Icon[] {
  try {
    const data = readFileSync(ICON_FILE_URL).toString(ICON_ENCODING);
    const src = `data:${ICON_MIME_TYPE};${ICON_ENCODING},${data}`;
    return [{ src, mimeType: ICON_MIME_TYPE, sizes: [ICON_SIZE_PACKAGED] }];
  } catch {
    return [];
  }
}

/** What the server tells a client about itself when it connects: name, title, icons and website. */
export function serverInfo(): Implementation {
  return {
    name: SERVER_NAME,
    title: SERVER_TITLE,
    version: VERSION,
    description: SERVER_DESCRIPTION,
    websiteUrl: WEBSITE_URL,
    icons: [...packagedIcons(), WEBSITE_ICON],
  };
}
