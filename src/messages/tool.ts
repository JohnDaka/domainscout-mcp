import { EnvVar, TOOL_CHECK_DOMAINS } from '../constants.js';

/** Fixed texts of the MCP tool and its schema. */
export const ToolText = {
  Title: 'Check domain availability',
  DomainsParam:
    'Names or domains, e.g. ["acme", "acme.io", "https://acme.dev"]. Pass every candidate in ONE call - ' +
    'hundreds of names are fine. An entry may also hold several names separated by spaces, commas or new lines.',
  ConfirmParam:
    'Confirm free-looking domains with registrar APIs, which also reveals premium names and exact prices. ' +
    'Works only when the user has set registrar API keys; on by default. Set false to skip it for large lists.',
  DetailsParam:
    'Include the evidence from each source (DNS, RDAP, WHOIS, registrar API) for every domain.',
  AsciiForm: 'ASCII (punycode) form',
  UnicodeForm: 'Unicode form',
  TldsUsed: 'TLDs used for names given without one',
  PriceInfo: 'Standard price per year for the TLD; premium names cost more',
  WarningsInfo:
    'Things that concern the whole call, e.g. a rejected API key or the confirmation limit',
} as const;

/** What the server tells a client about itself. */
export const toolInstructions = (defaultTlds: string): string =>
  "Checks whether domain names are free to register, from the user's own machine, and shows prices and " +
  `where to buy them. Built for bulk search: pass a whole brainstorm of names in one ${TOOL_CHECK_DOMAINS} ` +
  `call. Names without a TLD are tried in: ${defaultTlds}. When you present the results, give each free ` +
  "domain its price and its buy link from the tool's answer, so the user can register it in one click.";

/** The tool description the model reads before calling it. */
export const toolDescription = (defaultTlds: string): string => `\
Checks whether domain names are free to register. Built for bulk search: almost every good .com is taken, so \
brainstorm many candidates and pass them ALL in one call - hundreds of names are fine - instead of checking \
names one by one. Runs on the user's machine: DNS first, then the registry itself (RDAP, or WHOIS where there \
is no RDAP), in parallel within polite rate limits.

Input: names with or without a TLD. "acme" is tried in every TLD from \`tlds\` (default: ${defaultTlds}); \
"acme.io" is checked exactly as given. URLs work too. For a long list, pass only the TLDs the user wants \
(e.g. ["com"]): every name is checked in every TLD.

Statuses:
- available: a registrar API confirmed it can be registered (only when the user set registrar API keys); \`premium\` \
says whether it costs more than the standard price.
- likely_available: not in the registry or DNS. Premium or registry-reserved names look the same, so the final \
price is on the registrar's page.
- taken: registered. May note that it is in deletion and may become available soon.
- reserved: blocked by the registry, or not sellable according to the registrar.
- unknown: could not verify right now (rate limit or timeout); try again later.

Free domains come with buy links, cheapest first, with standard per-year prices where public price lists exist, \
or the exact price when a registrar confirmed the name. When many names are free, the text lists each on one \
line with its cheapest offer; check the user's favourites again to get every registrar's link.

How to present the answer: list the free domains with their price and their buy link from this result - a table \
with a link column works well - so the user can register a name in one click. Keep the links; do not replace \
them with links of your own. Mention the renewal price when it differs from the first year, and any minimum term. \
Pass on the NOTES and, when present, the affiliate disclosure line.`;

/** Describes the `tlds` parameter, including the configured defaults. */
export const tldsParamText = (defaultTlds: string): string =>
  `TLDs to try for names without one, e.g. ["com", "io", "co.uk"]. Omit to use the defaults (${defaultTlds}); ` +
  `the user can change the defaults with ${EnvVar.Tlds} in the MCP server config.`;

/** The message of one progress notification: "acme.com: taken". */
export const progressText = (name: string, status: string): string => `${name}: ${status}`;
