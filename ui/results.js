// DomainScout's results panel for hosts that support MCP Apps. The host renders ui/results.html
// in a sandboxed iframe under a check_domains call and passes the call's result in; the server
// inlines this script and results.css into that page, so nothing is loaded from elsewhere.

// ── The MCP Apps protocol: JSON-RPC 2.0 over postMessage with the host ─────────────────────────

/** The MCP Apps protocol version this panel speaks. */
const PROTOCOL_VERSION = '2026-01-26';
/** How this panel introduces itself to the host. */
const APP_INFO = { name: 'DomainScout results', version: '1.3.0' };
/** The JSON-RPC version of every message. */
const JSONRPC = '2.0';
/** Where messages go: the host is the frame that embeds this panel. */
const ANY_ORIGIN = '*';
/** How long a host gets to act on a request before the panel offers to copy instead. */
const HOST_TIMEOUT_MS = 3000;

/** The protocol's methods this panel sends or handles. */
const Method = {
  Initialize: 'ui/initialize',
  Initialized: 'ui/notifications/initialized',
  ToolInput: 'ui/notifications/tool-input',
  ToolResult: 'ui/notifications/tool-result',
  ToolCancelled: 'ui/notifications/tool-cancelled',
  HostContextChanged: 'ui/notifications/host-context-changed',
  SizeChanged: 'ui/notifications/size-changed',
  OpenLink: 'ui/open-link',
  Message: 'ui/message',
  UpdateModelContext: 'ui/update-model-context',
  DownloadFile: 'ui/download-file',
};

/** Requests sent to the host that wait for an answer, by id. */
const pending = new Map();
let nextRequestId = 1;

function post(message) {
  window.parent.postMessage({ jsonrpc: JSONRPC, ...message }, ANY_ORIGIN);
}

function request(method, params) {
  const id = nextRequestId++;
  post({ id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function notify(method, params) {
  post({ method, params });
}

function settle(response) {
  const waiting = pending.get(response.id);
  if (!waiting) return;
  pending.delete(response.id);
  if (response.error) waiting.reject(response.error);
  else waiting.resolve(response.result);
}

/** A request the host must answer in time and without an error; otherwise `fallback` runs. */
function requestOrFallback(method, params, fallback) {
  const timeout = new Promise((_, reject) => window.setTimeout(reject, HOST_TIMEOUT_MS));
  Promise.race([request(method, params), timeout])
    .then((result) => {
      if (result?.isError) fallback();
    })
    .catch(fallback);
}

/**
 * Opens a registrar's page. The sandbox blocks navigation and pop-ups, so only the host can open
 * it; when the host can't, refuses, or doesn't answer, the panel shows the link to copy.
 */
function openLink(url) {
  if (!state.can.openLinks) {
    showCopyFallback(Copy.LinkBlocked, url);
    return;
  }
  requestOrFallback(Method.OpenLink, { url }, () => showCopyFallback(Copy.LinkBlocked, url));
}

/** The type of the text content blocks this panel sends and reads. */
const TEXT_BLOCK = 'text';

/** Sends a message to the chat as the user would; when the host can't, offers it to copy. */
function sendToChat(text) {
  const params = { role: 'user', content: [{ type: TEXT_BLOCK, text }] };
  requestOrFallback(Method.Message, params, () => showCopyFallback(Copy.MessageBlocked, text));
}

// ── Words on the panel ────────────────────────────────────────────────────────────────────────

/** Every fixed text the panel shows or reads out. */
const Copy = {
  ToolWho: 'DomainScout',
  ToolName: 'check_domains',
  Checking: 'Checking domains…',
  Cancelled: 'The check was cancelled.',
  NoResults: 'The check did not return results.',
  NothingToCheck: 'No names to check.',
  NoneFree: 'None of these are free.',
  FreeDomains: 'Free domains',
  Taken: 'Taken',
  Reserved: 'Reserved',
  Unknown: 'Not verified, try again later',
  Available: 'Available',
  Premium: 'Premium',
  PremiumPrice: 'Premium price, set by the registry',
  NoPrices: "Prices on the registrars' sites",
  PriceOnSite: 'price on site',
  Dropping: 'may free up soon',
  DroppingNote: 'Being deleted: may become available soon',
  Layout: 'Layout',
  Theme: 'Theme',
  TableCaption: 'Yearly price of each free domain at each registrar',
  DomainHeading: 'Domain',
  OthersHeading: 'Others',
  SiteCell: 'site',
  NotSold: 'not sold here',
  AllTlds: 'All',
  TldFilter: 'Show TLD',
  Similar: 'Similar',
  SimilarLabel: 'Ask the chat for names like this one',
  Saved: 'Saved',
  Save: 'Save',
  SaveLabel: 'Save',
  Unsave: 'Remove from saved',
  CompareSaved: 'Compare in chat',
  Regenerate: 'Regenerate',
  RegenerateLabel: 'New names, none of those checked so far; the saved ones stay',
  RegenerateHint: 'Regenerate for a new batch.',
  OtherTlds: 'Try other TLDs',
  DownloadCsv: 'Download CSV',
  LinkBlocked: "Your chat app didn't open the link. Copy it:",
  MessageBlocked: "Your chat app didn't take the message. Copy it into the chat:",
  DownloadBlocked: "Your chat app didn't save the file. Copy the CSV:",
  Close: 'Close',
  Footnote:
    'Registrars are listed cheapest first. Prices are standard yearly prices where a registrar publishes them; premium names cost more.',
};

/** What a table cell shows for a registrar that does not sell the name. */
const NOT_SOLD_MARK = '—';
/** A hyphen and a space that never break a line: "2-year minimum" stays whole. */
const NO_BREAK_HYPHEN = '\u2011';
const NO_BREAK_SPACE = '\u00a0';
/** Between the lowest and the highest price: an en dash, as in "$10.46-$11.08". */
const RANGE_DASH = '\u2013';

// ── What the panel asks the chat ──────────────────────────────────────────────────────────────

/** New names asked for, per request. */
const SIMILAR_COUNT = 30;
/** A new batch is as big as the last one, within these bounds. */
const REGENERATE_MIN = 20;
const REGENERATE_MAX = 200;
/** Taken names passed on when asking for other TLDs: enough to go on, short enough to read. */
const TAKEN_SAMPLE = 30;
/** Free names given as examples of a style that works. */
const STYLE_SAMPLE = 5;
/** TLDs suggested for names taken in theirs. */
const OTHER_TLDS = ['io', 'app', 'dev', 'co'];
/** Fewer free names than this, and the panel offers to brainstorm more at the top. */
const FEW_FREE = 5;

/** The part of a domain before its TLD: "kettlecrate" for "kettlecrate.com". */
function label(item) {
  const domain = item.display || item.domain;
  return item.tld ? domain.slice(0, -(item.tld.length + 1)) : domain;
}

function tldList(tlds) {
  return tlds.map((tld) => `.${tld}`).join(', ');
}

const Ask = {
  similar: (item, tlds) =>
    `Find ${SIMILAR_COUNT} more domain names like "${label(item)}" (a similar style and length) and check them all with DomainScout in ${tldList(tlds)}.`,
  otherTlds: (names) =>
    `These names are taken: ${names.slice(0, TAKEN_SAMPLE).join(', ')}. Check the same names in other TLDs (${tldList(OTHER_TLDS)}) with DomainScout.`,
  /**
   * A new batch: as many names as last time, in the same style, none of them checked before. The
   * names to leave out go in the model's context when the host takes it, so the chat stays short;
   * otherwise they are spelled out. The saved domains go along in "saved", so they stay.
   */
  regenerate: ({ names, saved, tlds, free }) => {
    const count = Math.min(Math.max(names.length, REGENERATE_MIN), REGENERATE_MAX);
    const examples = free.slice(0, STYLE_SAMPLE).map(label);
    const style = examples.length ? ` (names like ${examples.join(', ')} were free)` : '';
    const avoid = state.can.updateModelContext
      ? `Leave out all ${names.length} names checked so far; they are in the panel's context.`
      : `Leave out every name checked so far: ${names.join(', ')}.`;
    const keep = saved.length
      ? ` Pass my saved domains in the saved parameter so they stay: ${saved.join(', ')}.`
      : '';
    return `Regenerate: brainstorm ${count} new domain names in the same style${style}. ${avoid} Check them all with DomainScout in ${tldList(tlds)}.${keep}`;
  },
  compare: (items) =>
    `Compare these saved domains and recommend one: ${items.map(describeForChat).join('; ')}.`,
};

/** "kettlecrate.com ($10.46/yr at Cloudflare, renews at $10.46)", for messages and context. */
function describeForChat(item) {
  const lead = (item.buy ?? []).find((offer) => offer.price);
  if (!lead) return item.display || item.domain;
  const { price } = lead;
  const renewal = money(price.renewal, price.currency);
  const cost = `${money(price.registration, price.currency)}/yr at ${lead.registrar}, renews at ${renewal}`;
  return `${item.display || item.domain} (${cost})`;
}

// ── Preferences: list, cards or table; light or dark ──────────────────────────────────────────

/** How the free domains are laid out. */
const View = {
  List: 'list',
  Grid: 'grid',
  Table: 'table',
};

/** The panel's color theme. */
const Theme = {
  Light: 'light',
  Dark: 'dark',
};

/** Where a visitor's choice is kept, when the sandbox allows storage at all. */
const StorageKey = {
  View: 'domainscout.view',
  Theme: 'domainscout.theme',
};

/** The system's theme, until the host says otherwise. */
const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';

/** A stored choice; none when the sandbox blocks storage or nothing was chosen. */
function readChoice(key, allowed) {
  try {
    const value = window.localStorage.getItem(key);
    return Object.values(allowed).includes(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function keepChoice(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A sandbox without storage: the choice lasts until the panel closes.
  }
}

/** What a first-time visitor sees: the price table, dark like the landing page. */
const DEFAULT_VIEW = View.Table;
const DEFAULT_THEME = Theme.Dark;

/** Which way a table column is sorted. */
const SortDirection = {
  Ascending: 'ascending',
  Descending: 'descending',
};
/** The table's column that sorts by name rather than by a registrar's price. */
const DOMAIN_COLUMN = 'domain';

const state = {
  view: readChoice(StorageKey.View, View) ?? DEFAULT_VIEW,
  /** The panel's own theme: dark unless the visitor picked light. */
  theme: readChoice(StorageKey.Theme, Theme) ?? DEFAULT_THEME,
  /** The host's theme: only the page's color scheme follows it. */
  hostTheme: window.matchMedia(LIGHT_SCHEME_QUERY).matches ? Theme.Light : Theme.Dark,
  /** Whether the host said which theme it uses: only then does the canvas follow it. */
  hostThemeKnown: false,
  /** What the host offers to do for the panel; links are assumed until it says otherwise. */
  can: { openLinks: true, message: false, updateModelContext: false, downloadFile: false },
  /** The host's locale, for prices. */
  locale: undefined,
  /** The last result's TLDs, total and taken names, for what the panel asks the chat. */
  check: { tlds: [], total: 0, taken: [], names: [] },
  /** The last result's free domains, so a change of view, filter or sort keeps them. */
  free: [],
  /** The TLD the free domains are filtered to; all of them while unset. */
  tld: undefined,
  /** The table's sort: a registrar's prices or the names, and which way; the tool's order while unset. */
  sort: { column: undefined, direction: SortDirection.Ascending },
  /** The domains the visitor saved, in the order they were saved. */
  saved: new Map(),
};

function currentTheme() {
  return state.theme;
}

/**
 * The panel's colors follow its own theme; the page's color scheme follows the host's, so the
 * browser keeps the iframe's canvas transparent instead of painting it white or black.
 */
function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = state.theme;
  if (state.hostThemeKnown) root.style.colorScheme = state.hostTheme;
  syncToolbar();
}

// ── The host's look: its theme, font, locale and height cap ───────────────────────────────────

/** The class that lets the page scroll, when the host caps the frame's height. */
const CAPPED_CLASS = 'is-capped';

/** The one style element that holds the host's font faces. */
const hostFonts = document.createElement('style');
document.head.append(hostFonts);

function applyHostContext(context) {
  if (!context) return;
  if (Object.values(Theme).includes(context.theme)) {
    state.hostTheme = context.theme;
    state.hostThemeKnown = true;
  }
  if (context.locale) state.locale = context.locale;
  const capped = Boolean(context.containerDimensions?.maxHeight);
  document.documentElement.classList.toggle(CAPPED_CLASS, capped);
  const font = context.styles?.variables?.['--font-sans'];
  if (font) document.documentElement.style.setProperty('--font-sans', font);
  const fonts = context.styles?.css?.fonts;
  if (fonts) hostFonts.textContent = fonts;
  applyTheme();
}

// ── The panel's height follows its content ────────────────────────────────────────────────────

/** How the page is measured at its natural height. */
const MEASURE_HEIGHT = 'max-content';

let reportedWidth = 0;
let reportedHeight = 0;

function reportSize() {
  const root = document.documentElement;
  const previous = root.style.height;
  root.style.height = MEASURE_HEIGHT;
  const height = Math.ceil(root.getBoundingClientRect().height);
  root.style.height = previous;
  const width = Math.ceil(window.innerWidth);
  if (width === reportedWidth && height === reportedHeight) return;
  reportedWidth = width;
  reportedHeight = height;
  notify(Method.SizeChanged, { width, height });
}

// ── Building blocks ───────────────────────────────────────────────────────────────────────────

/** The SVG namespace, for the icons. */
const SVG_NS = 'http://www.w3.org/2000/svg';
/** The icons' drawing area. */
const ICON_VIEW_BOX = '0 0 24 24';

/** The panel's icons. */
const Icon = {
  List: 'list',
  Grid: 'grid',
  Table: 'table',
  Sun: 'sun',
  Moon: 'moon',
  External: 'external',
  Chevron: 'chevron',
  Star: 'star',
  Sparkles: 'sparkles',
  Download: 'download',
  Close: 'close',
  Sort: 'sort',
  Refresh: 'refresh',
};

/** Icons as SVG path data: drawn with strokes, in the text's color. */
const ICON_PATHS = new Map()
  .set(Icon.List, ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'])
  .set(Icon.Grid, ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'])
  .set(Icon.Table, ['M4 5h16v14H4z', 'M4 10h16', 'M4 15h16', 'M10 5v14'])
  .set(Icon.Sun, [
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ])
  .set(Icon.Moon, ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'])
  .set(Icon.External, ['M7 17L17 7', 'M8 7h9v9'])
  .set(Icon.Chevron, ['M6 9l6 6 6-6'])
  .set(Icon.Star, ['M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z'])
  .set(Icon.Sparkles, [
    'M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4z',
    'M19 15v4',
    'M17 17h4',
  ])
  .set(Icon.Download, ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'])
  .set(Icon.Close, ['M6 6l12 12', 'M18 6L6 18'])
  .set(Icon.Sort, ['M8 9l4-4 4 4', 'M8 15l4 4 4-4'])
  .set(Icon.Refresh, ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7']);

/** Attribute values used as switches. */
const TRUE = 'true';
const FALSE = 'false';
/** How an inlined image's address starts. */
const DATA_URI_PREFIX = 'data:';
/** The icon's size beside the name, in CSS pixels; the image is drawn sharper than that. */
const LOGO_SIZE = 18;

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', ICON_VIEW_BOX);
  svg.setAttribute('aria-hidden', TRUE);
  for (const data of ICON_PATHS.get(name)) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', data);
    svg.append(path);
  }
  return svg;
}

/** An element with a class and, optionally, text: data always goes in as text, never as HTML. */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/** Text only screen readers hear, such as which domain a button belongs to. */
function hiddenText(text) {
  return element('span', 'visually-hidden', text);
}

function money(amount, currency) {
  return new Intl.NumberFormat(state.locale, { style: 'currency', currency }).format(amount);
}

/** A button that opens and closes the given element, which starts closed. */
function disclosure(className, text, target, hiddenLabel) {
  const toggle = button(className, text, () => {
    const open = toggle.getAttribute('aria-expanded') !== TRUE;
    toggle.setAttribute('aria-expanded', String(open));
    target.hidden = !open;
  });
  toggle.setAttribute('aria-expanded', FALSE);
  toggle.setAttribute('aria-controls', target.id);
  if (hiddenLabel) toggle.append(hiddenText(hiddenLabel));
  toggle.append(icon(Icon.Chevron));
  return toggle;
}

let nextId = 1;

function uniqueId(prefix) {
  return `${prefix}-${nextId++}`;
}

/**
 * DomainScout's icon before its name, as on the landing page. The server puts the image into the
 * page as a data URI, so nothing is fetched; without one (a page opened on its own) it is left out.
 */
function logo() {
  const source = document.documentElement.dataset.logo;
  if (!source?.startsWith(DATA_URI_PREFIX)) return '';
  const image = element('img', 'tool__logo');
  image.src = source;
  image.alt = '';
  image.width = LOGO_SIZE;
  image.height = LOGO_SIZE;
  return image;
}

// ── The panel's frame: built once, so the toolbar keeps focus while the content changes ──────

/** The groups' options: the value each sets, its icon and its name for screen readers. */
const VIEW_OPTIONS = [
  { value: View.List, icon: Icon.List, label: 'Show as a list' },
  { value: View.Grid, icon: Icon.Grid, label: 'Show as cards' },
  { value: View.Table, icon: Icon.Table, label: 'Show as a price table' },
];
const THEME_OPTIONS = [
  { value: Theme.Light, icon: Icon.Sun, label: 'Light theme' },
  { value: Theme.Dark, icon: Icon.Moon, label: 'Dark theme' },
];

/** The toolbar's buttons, so a change of state can update their pressed look. */
const toolbarButtons = [];

function segmented(groupLabel, options, current, choose) {
  const group = element('div', 'segmented');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', groupLabel);
  for (const option of options) {
    const node = button('segmented__option', undefined, () => choose(option.value));
    node.title = option.label;
    node.setAttribute('aria-label', option.label);
    node.append(icon(option.icon));
    toolbarButtons.push({ button: node, isPressed: () => current() === option.value });
    group.append(node);
  }
  return group;
}

function syncToolbar() {
  for (const { button: node, isPressed } of toolbarButtons) {
    node.setAttribute('aria-pressed', String(isPressed()));
  }
}

const panel = element('section', 'panel');
const header = element('div', 'header');
const tool = element('p', 'tool');
tool.append(logo(), element('span', 'tool__who', Copy.ToolWho), Copy.ToolName);
const layoutGroup = segmented(Copy.Layout, VIEW_OPTIONS, () => state.view, chooseView);
const themeGroup = segmented(Copy.Theme, THEME_OPTIONS, currentTheme, chooseTheme);
const toolbar = element('div', 'toolbar');
toolbar.append(layoutGroup, themeGroup);
header.append(tool, toolbar);
/** The one line screen readers are told about: the progress, the summary or an error. */
const status = element('p', 'summary');
status.setAttribute('role', 'status');
/** The summary on the left, the TLD filter on the right, on one line. */
/**
 * The summary and "Regenerate" on the left, the TLD filter on the right, on one line. The button
 * sits beside the status line, not in it: a status line is read out whole on every change.
 */
const summaryRow = element('div', 'summary-row');
const summaryMain = element('div', 'summary-row__main');
const regenerateSlot = element('span', 'summary-row__action');
const filterSlot = element('div', 'summary-row__filter');
summaryMain.append(status, regenerateSlot);
summaryRow.append(summaryMain, filterSlot);
const fallbackBox = element('div', 'fallback');
fallbackBox.hidden = true;
const content = element('div', 'content');
panel.append(header, summaryRow, fallbackBox, content);
document.getElementById('app').append(panel);

function chooseView(view) {
  const wasTable = state.view === View.Table;
  state.view = view;
  keepChoice(StorageKey.View, view);
  syncToolbar();
  const list = content.querySelector('.results');
  // List and cards are one list with a different class: open rows stay open.
  if (list && !wasTable && view !== View.Table) {
    list.classList.toggle('results--grid', view === View.Grid);
    return;
  }
  if (state.free.length) renderFree();
}

function chooseTheme(theme) {
  state.theme = theme;
  keepChoice(StorageKey.Theme, theme);
  applyTheme();
}

/** How the status line looks. */
const StatusKind = {
  Progress: 'progress',
  Result: 'result',
  Error: 'error',
};

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind ? `summary summary--${kind}` : 'summary';
  status.setAttribute('role', kind === StatusKind.Error ? 'alert' : 'status');
}

/** Something the host would not do, offered to copy instead: a link, a message or a CSV. */
function showCopyFallback(note, text) {
  const multiline = text.includes('\n');
  const field = element(multiline ? 'textarea' : 'input', 'fallback__text-field');
  if (!multiline) field.type = 'text';
  field.readOnly = true;
  field.value = text;
  field.setAttribute('aria-label', note);
  const close = button('fallback__close', Copy.Close, () => {
    fallbackBox.hidden = true;
  });
  fallbackBox.replaceChildren(element('p', 'fallback__note', note), field, close);
  fallbackBox.hidden = false;
  field.focus();
  field.select();
}

// ── Rendering a check_domains result ─────────────────────────────────────────────────────────

/** The tool's domain statuses. */
const Status = {
  Available: 'available',
  LikelyAvailable: 'likely_available',
  Taken: 'taken',
  Reserved: 'reserved',
  Unknown: 'unknown',
};
/** Names shown at a time, in each list and each "show more" step: about a screenful. */
const PAGE_SIZE = 24;
/** Characters of an ISO date that make the day: "2030-02-03". */
const DATE_LENGTH = 10;
/** Milliseconds in a second, for the elapsed time. */
const SECOND_MS = 1000;
/** Rows a "show more" button has revealed get focus, so the keyboard carries on from there. */
const FOCUSABLE_FROM_SCRIPT = -1;

function showChecking(input) {
  state.free = [];
  const count = Array.isArray(input?.domains) ? input.domains.length : 0;
  const tlds = Array.isArray(input?.tlds) && input.tlds.length ? input.tlds : undefined;
  const where = tlds ? ` in ${tldList(tlds)}` : '';
  setStatus(count ? `Checking ${count} names${where}…` : Copy.Checking, StatusKind.Progress);
  content.replaceChildren(element('div', 'progress'));
  filterSlot.replaceChildren();
  regenerateSlot.replaceChildren();
  layoutGroup.hidden = false;
}

function showMessage(text, kind) {
  state.free = [];
  setStatus(text, kind);
  content.replaceChildren();
  filterSlot.replaceChildren();
  regenerateSlot.replaceChildren();
  layoutGroup.hidden = true;
}

function showResult(result) {
  try {
    renderResult(result);
  } catch {
    // A result shaped unlike this panel expects: the tool's own text report still says it all.
    showMessage(reportText(result) ?? Copy.NoResults, StatusKind.Error);
  }
}

function reportText(result) {
  return result?.content?.find((block) => block.type === TEXT_BLOCK)?.text;
}

function renderResult(result) {
  const data = result?.structuredContent;
  if (result?.isError || !Array.isArray(data?.results)) {
    showMessage(reportText(result) ?? Copy.NoResults, StatusKind.Error);
    return;
  }
  if (!data.results.length) {
    showMessage(Copy.NothingToCheck);
    return;
  }
  const byStatus = (statuses) => data.results.filter((item) => statuses.includes(item.status));
  const free = byStatus([Status.Available, Status.LikelyAvailable]);
  const taken = byStatus([Status.Taken]);
  const reserved = byStatus([Status.Reserved]);
  const unknown = byStatus([Status.Unknown]);
  const tlds = [...new Set(data.results.map((item) => item.tld).filter(Boolean))];
  const total = data.summary?.total ?? data.results.length;
  const names = [...new Set(data.results.map(label))];
  state.free = free;
  state.check = { tlds, total, taken, names };
  state.tld = undefined;
  state.sort = { column: undefined, direction: SortDirection.Ascending };
  // Domains saved on an earlier panel come back marked: they start saved here too.
  state.saved = new Map(free.filter((item) => item.saved).map((item) => [domainKey(item), item]));
  showSummary(data, { free, taken, reserved, unknown });
  layoutGroup.hidden = !free.length;
  regenerateSlot.replaceChildren(...(state.can.message ? [regenerateButton()] : []));
  shareContext();

  const top = [];
  if (free.length < FEW_FREE) top.push(fewFreeNote(free, total));
  const rest = [];
  if (taken.length) rest.push(group(Copy.Taken, taken, takenChip, takenActions(taken)));
  if (reserved.length) rest.push(group(Copy.Reserved, reserved, notedChip('chip--reserved')));
  if (unknown.length) rest.push(group(Copy.Unknown, unknown, notedChip('chip--unknown')));
  if (data.warnings?.length) rest.push(notes(data.warnings));
  if (free.length) {
    rest.push(bottomActions());
    const disclosureText = data.disclosure ? ` ${data.disclosure}` : '';
    rest.push(element('p', 'footnote', `${Copy.Footnote}${disclosureText}`));
  }
  const savedBox = element('div', 'shortlist');
  const freeBox = element('div', 'free');
  // The saved domains sit under the free ones: when they appear, nothing above moves under the pointer.
  content.replaceChildren(...top, freeBox, savedBox, ...rest);
  renderSaved();
  renderFilters();
  renderFree();
}

/** The counts in the summary, in order: each with its word and its color. */
const SUMMARY_COUNTS = [
  { key: 'free', word: 'free', modifier: 'stat--free' },
  { key: 'taken', word: 'taken', modifier: 'stat--taken' },
  { key: 'reserved', word: 'reserved', modifier: 'stat--reserved' },
  { key: 'unknown', word: 'not verified', modifier: 'stat--unknown' },
];
/** Free and taken always show in the summary; reserved and unverified only when there are any. */
const ALWAYS_COUNTED = 2;

/**
 * "48 domains checked in 4.2s", then each count with a colored dot: "● 23 free .com", "● 25 taken".
 * The TLD is named when there is only one. Screen readers hear one plain sentence.
 */
function showSummary(data, groups) {
  const total = data.summary?.total ?? data.results.length;
  const elapsed = data.summary?.elapsed_ms;
  const time = Number.isFinite(elapsed) ? ` in ${(elapsed / SECOND_MS).toFixed(1)}s` : '';
  const tlds = new Set(data.results.map((item) => item.tld));
  const onlyTld = tlds.size === 1 ? ` .${[...tlds][0]}` : '';
  const lead = element('span', 'summary__lead', `${total} domains checked${time}`);
  const stats = SUMMARY_COUNTS.filter(
    ({ key }, index) => index < ALWAYS_COUNTED || groups[key].length > 0,
  ).map(({ key, word, modifier }) => {
    const text = key === 'free' ? `${word}${onlyTld}` : word;
    const stat = element('span', `stat ${modifier}`);
    stat.append(
      element('span', 'stat__dot'),
      element('span', 'stat__value', String(groups[key].length)),
      ` ${text}`,
    );
    return stat;
  });
  setStatus('', StatusKind.Result);
  status.append(lead, ...stats);
}

/** Few or no free names: says so, and offers a new batch right away. */
function fewFreeNote(free, total) {
  const note = element('div', 'few-free');
  const text = free.length ? `Only ${free.length} of ${total} are free.` : Copy.NoneFree;
  const hint = state.can.message ? ` ${Copy.RegenerateHint}` : '';
  note.append(element('p', 'few-free__text', `${text}${hint}`));
  return note;
}

/**
 * "Regenerate": asks the chat for a new batch of names, none of those checked so far, with the
 * saved domains kept. This panel stays as it is; the new check comes as a new one under it.
 */
function regenerateButton() {
  const node = button('chip-button regenerate', Copy.Regenerate, () => {
    const saved = [...state.saved.values()].map((item) => item.domain);
    sendToChat(Ask.regenerate({ ...state.check, saved, free: state.free }));
  });
  node.prepend(icon(Icon.Refresh));
  node.title = Copy.RegenerateLabel;
  return node;
}

/** Under the domains: the domains as a file. */
function bottomActions() {
  const bar = element('div', 'actions');
  if (state.can.downloadFile) {
    const download = button('action', Copy.DownloadCsv, downloadCsv);
    download.prepend(icon(Icon.Download));
    bar.append(download);
  }
  return bar;
}

/** The free domains the filter lets through, in the table's sort when there is one. */
function shownFree() {
  const filtered = state.tld ? state.free.filter((item) => item.tld === state.tld) : state.free;
  return state.view === View.Table ? sorted(filtered) : filtered;
}

/** The free domains in the chosen view, into the box made for them. */
function renderFree() {
  const box = content.querySelector('.free');
  if (!box) return;
  saveButtons.clear();
  const items = shownFree();
  const parts = state.view === View.Table ? priceTable(items) : freeList(items);
  box.replaceChildren(...parts);
}

/**
 * The first page of items, then a button that adds a page at a time and moves focus to the first
 * new item, so a keyboard user carries on where the button was.
 */
function paged(items, container, build, moreLabel) {
  let shown = Math.min(PAGE_SIZE, items.length);
  container.append(...items.slice(0, shown).flatMap(build));
  if (shown >= items.length) return [];
  const more = button('more', moreLabel(items.length - shown), () => {
    const page = items.slice(shown, shown + PAGE_SIZE).flatMap(build);
    container.append(...page);
    shown += PAGE_SIZE;
    page[0].tabIndex = FOCUSABLE_FROM_SCRIPT;
    page[0].focus();
    if (shown >= items.length) more.remove();
    else more.textContent = moreLabel(items.length - shown);
  });
  return [more];
}

// ── Filter: one TLD or all ────────────────────────────────────────────────────────────────────

/** "All · .com · .ai" over the free domains, when they are in more than one TLD. */
function renderFilters() {
  const box = filterSlot;
  const tlds = [...new Set(state.free.map((item) => item.tld))];
  if (tlds.length < 2) {
    box.replaceChildren();
    return;
  }
  const group = element('div', 'filter');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', Copy.TldFilter);
  const options = [
    { value: undefined, text: Copy.AllTlds },
    ...tlds.map((tld) => ({ value: tld, text: `.${tld}` })),
  ];
  for (const option of options) {
    const count = option.value
      ? state.free.filter((item) => item.tld === option.value).length
      : state.free.length;
    const node = button('filter__option', option.text, () => {
      state.tld = option.value;
      renderFilters();
      renderFree();
    });
    node.append(element('span', 'filter__count', String(count)));
    node.setAttribute('aria-pressed', String(state.tld === option.value));
    group.append(node);
  }
  box.replaceChildren(group);
}

// ── Saved: the domains the visitor keeps, shared with the chat ───────────────────────────────

/** The save buttons of each domain, so saving one updates every view of it. */
const saveButtons = new Map();

function domainKey(item) {
  return item.domain;
}

/** "☆ Save" / "★ Saved": keeps the domain, or lets it go. */
function saveButton(item) {
  const key = domainKey(item);
  const node = button('chip-button save', undefined, () => toggleSaved(item));
  // Both words sit in one cell, one of them hidden: the button is as wide as "Saved" either way,
  // so pressing it moves nothing.
  const words = element('span', 'chip-button__label swap');
  words.append(element('span', 'swap__off', Copy.Save), element('span', 'swap__on', Copy.Saved));
  node.append(icon(Icon.Star), words);
  const buttons = saveButtons.get(key) ?? new Set();
  buttons.add(node);
  saveButtons.set(key, buttons);
  syncSave(node, state.saved.has(key), item);
  return node;
}

function syncSave(node, saved, item) {
  const domain = item.display || item.domain;
  node.setAttribute('aria-pressed', String(saved));
  node.setAttribute('aria-label', `${saved ? Copy.Unsave : Copy.SaveLabel}: ${domain}`);
  node.title = saved ? Copy.Unsave : Copy.SaveLabel;
}

function toggleSaved(item) {
  const key = domainKey(item);
  if (state.saved.has(key)) state.saved.delete(key);
  else state.saved.set(key, item);
  const saved = state.saved.has(key);
  for (const node of saveButtons.get(key) ?? []) {
    if (node.isConnected) syncSave(node, saved, item);
  }
  renderSaved();
  shareContext();
}

/** The saved domains under the free ones: each with a way to let it go, and "Compare in chat". */
function renderSaved() {
  const box = content.querySelector('.shortlist');
  if (!box) return;
  const items = [...state.saved.values()];
  if (!items.length) {
    box.replaceChildren();
    return;
  }
  const title = element('h2', 'shortlist__title', `${Copy.Saved} · ${items.length}`);
  const chips = element('ul', 'shortlist__items');
  for (const item of items) {
    const chip = element('li', 'shortlist__item', item.display || item.domain);
    const remove = button('shortlist__remove', undefined, () => toggleSaved(item));
    remove.setAttribute('aria-label', `${Copy.Unsave}: ${item.display || item.domain}`);
    remove.append(icon(Icon.Close));
    chip.append(remove);
    chips.append(chip);
  }
  // The title and the button share a line; the saved names go below, so the button stays put.
  const header = element('div', 'shortlist__header');
  header.append(title);
  if (state.can.message && items.length > 1) {
    const compare = button('action', Copy.CompareSaved, () => sendToChat(Ask.compare(items)));
    compare.prepend(icon(Icon.Sparkles));
    header.append(compare);
  }
  box.replaceChildren(header, chips);
}

/**
 * Tells the model what the visitor saved and which names were checked, so the chat can talk
 * about the picks and never suggests a checked name again. One update carries both, as a newer
 * update replaces the older one.
 */
function shareContext() {
  if (!state.can.updateModelContext) return;
  const items = [...state.saved.values()];
  const savedText = items.length
    ? `The user saved these domains in the DomainScout panel: ${items.map(describeForChat).join('; ')}.`
    : 'The user has saved no domains in the DomainScout panel.';
  const checkedText = `Names already checked, not to suggest again: ${state.check.names.join(', ')}.`;
  const saved = items.map((item) => ({ domain: item.domain, ...cheapest(item) }));
  request(Method.UpdateModelContext, {
    content: [{ type: TEXT_BLOCK, text: `${savedText} ${checkedText}` }],
    structuredContent: { saved, checked: state.check.names },
  }).catch(() => {
    // The chat simply won't know; saving still works on the panel.
  });
}

/** The cheapest priced offer's facts, for the shortlist and the CSV. */
function cheapest(item) {
  const lead = (item.buy ?? []).find((offer) => offer.price) ?? item.buy?.[0];
  return {
    registrar: lead?.registrar,
    registration: lead?.price?.registration,
    renewal: lead?.price?.renewal,
    currency: lead?.price?.currency,
    url: lead?.url,
  };
}

// ── CSV: the free domains to take elsewhere ───────────────────────────────────────────────────

/** The file the free domains download as. */
const CSV_FILE_URI = 'file:///domainscout-free-domains.csv';
const CSV_MIME_TYPE = 'text/csv';
/** A resource block holding the file's text, as ui/download-file takes it. */
const RESOURCE_BLOCK = 'resource';
const CSV_COLUMNS = [
  'domain',
  'tld',
  'premium',
  'min_years',
  'registrar',
  'registration',
  'renewal',
  'currency',
  'buy_url',
  'saved',
];
/** A CSV field with a comma, a quote or a line break goes in quotes, its quotes doubled. */
const CSV_NEEDS_QUOTES = /[",\n]/;

function csvField(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return CSV_NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvText() {
  const rows = shownFree().map((item) => {
    const offer = cheapest(item);
    const minYears = (item.buy ?? []).find((each) => each.price)?.price.minYears ?? 1;
    return [
      item.domain,
      item.tld,
      Boolean(item.premium),
      minYears,
      offer.registrar,
      offer.registration,
      offer.renewal,
      offer.currency,
      offer.url,
      state.saved.has(domainKey(item)),
    ];
  });
  return [CSV_COLUMNS, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
}

function downloadCsv() {
  const text = csvText();
  const contents = [
    { type: RESOURCE_BLOCK, resource: { uri: CSV_FILE_URI, mimeType: CSV_MIME_TYPE, text } },
  ];
  requestOrFallback(Method.DownloadFile, { contents }, () =>
    showCopyFallback(Copy.DownloadBlocked, text),
  );
}

// ── The list and the cards ────────────────────────────────────────────────────────────────────

/** The free domains as a list or as cards: the same list, a class apart. */
function freeList(free) {
  const listClass = state.view === View.Grid ? 'results results--grid' : 'results';
  const list = element('ul', listClass);
  list.setAttribute('aria-label', Copy.FreeDomains);
  const more = paged(
    free,
    list,
    (item) => [freeDomain(item)],
    (left) => `…and ${left} more free`,
  );
  return [list, ...more];
}

function freeDomain(item) {
  const domain = item.display || item.domain;
  const row = element('li', 'result');
  const name = element('span', 'result__domain');
  name.append(element('span', 'result__name', domain), saveButton(item));
  row.append(name);
  if (item.display && item.display !== item.domain) {
    // An internationalized name: show what is actually registered, too.
    name.append(element('span', 'result__ascii', item.domain));
  }
  const pill = item.premium
    ? element('span', 'pill pill--premium', Copy.Premium)
    : element('span', 'pill', Copy.Available);
  if (item.confirmedBy) pill.append(hiddenText(`, confirmed by ${item.confirmedBy}`));
  row.append(pill);

  // The tool lists offers cheapest first, priced ones before the rest: the range reads from the
  // priced ones, and the accordion keeps the tool's order.
  const offers = item.buy ?? [];
  const line = element('div', 'result__line');
  line.append(element('span', 'result__price', priceSummary(item, offers)));
  const actions = element('span', 'result__actions');
  if (state.can.message) actions.append(similarButton(item));
  row.append(line);
  line.append(actions);
  if (!offers.length) return row;
  const list = registrarList(offers, domain);
  actions.append(disclosure('toggle', `All ${offers.length} registrars`, list, ` for ${domain}`));
  row.append(list);
  return row;
}

/** "✦ Similar": asks the chat for more names like this one, checked in the same TLDs. */
function similarButton(item) {
  const node = button('chip-button similar', undefined, () =>
    sendToChat(Ask.similar(item, state.check.tlds)),
  );
  node.append(icon(Icon.Sparkles), element('span', 'chip-button__label', Copy.Similar));
  node.title = Copy.SimilarLabel;
  node.append(hiddenText(` to ${item.display || item.domain}`));
  return node;
}

/**
 * "$10.46–$11.08/yr" from the cheapest registrar to the dearest one that publishes a price, in
 * the cheapest one's currency, then what renewing costs when it differs from the first year,
 * and the minimum term with what it costs upfront. A premium name has its own price, so it says
 * so instead of showing the standard one.
 */
function priceSummary(item, offers) {
  const tld = item.tld ? `.${item.tld}` : '';
  if (!offers.length) return `No registrar in our list sells ${tld}`;
  if (item.premium) return Copy.PremiumPrice;
  const lead = offers.find((offer) => offer.price)?.price;
  if (!lead) return Copy.NoPrices;
  const prices = offers
    .map((offer) => offer.price)
    .filter((price) => price?.currency === lead.currency);
  const parts = [
    `${range(
      prices.map((price) => price.registration),
      lead.currency,
    )}/yr`,
  ];
  if (prices.some((price) => price.renewal !== price.registration)) {
    parts.push(
      `renews at ${range(
        prices.map((price) => price.renewal),
        lead.currency,
      )}`,
    );
  }
  if (lead.minYears > 1) {
    const upfront = money(lead.registration * lead.minYears, lead.currency);
    parts.push(`${minimumTerm(lead.minYears)} (${upfront} upfront)`);
  }
  return parts.join(', ');
}

/** "$10.46" or "$10.46–$11.08". */
function range(amounts, currency) {
  const low = money(Math.min(...amounts), currency);
  const high = money(Math.max(...amounts), currency);
  return low === high ? low : `${low}${RANGE_DASH}${high}`;
}

function minimumTerm(years) {
  return `${years}${NO_BREAK_HYPHEN}year${NO_BREAK_SPACE}minimum`;
}

/** "$28.12/yr, renews at $51.80" or "$10.46/yr": a registrar's own price. */
function offerPrice(price) {
  const first = `${money(price.registration, price.currency)}/yr`;
  if (price.renewal === price.registration) return first;
  return `${first}, renews at ${money(price.renewal, price.currency)}`;
}

/** A link to a registrar's page for the name; the host opens it, as the sandbox blocks navigation. */
function registrarLink(offer, className) {
  const link = element('a', className);
  link.href = offer.url;
  link.rel = 'noopener';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openLink(offer.url);
  });
  return link;
}

/**
 * Every registrar that sells the name, in the tool's order. Each row is one link, the whole row
 * clickable: the registrar, its price and the arrow in columns that line up from row to row.
 */
function registrarList(offers, domain) {
  const list = element('ul', 'registrars');
  list.id = uniqueId('registrars');
  list.hidden = true;
  list.setAttribute('aria-label', `Registrars for ${domain}`);
  for (const offer of offers) {
    const link = registrarLink(offer, 'registrar');
    const price = offer.price ? offerPrice(offer.price) : Copy.PriceOnSite;
    link.append(
      element('span', 'registrar__name', offer.registrar),
      element('span', 'registrar__price', price),
      icon(Icon.External),
    );
    const item = element('li');
    item.append(link);
    list.append(item);
  }
  return list;
}

// ── The price table: domains down the side, registrars across the top ───────────────────────

/**
 * The registrars across the top: only those with a public price for at least one of the names,
 * in one order for every row - by the place each one takes in the tool's price-sorted lists on
 * average, so the usually cheapest come first. The rest go to the "Others" column.
 */
function pricedColumns(free) {
  const places = new Map();
  for (const item of free) {
    (item.buy ?? []).forEach((offer, place) => {
      if (!offer.price) return;
      const seen = places.get(offer.registrar) ?? [];
      places.set(offer.registrar, [...seen, place]);
    });
  }
  const average = (list) => list.reduce((sum, place) => sum + place, 0) / list.length;
  return [...places.entries()]
    .sort(([, a], [, b]) => average(a) - average(b))
    .map(([registrar]) => registrar);
}

/** A name's registrars that have no column of their own, in the tool's order. */
function otherOffers(item, columns) {
  return (item.buy ?? []).filter((offer) => !columns.includes(offer.registrar));
}

/** A name's first-year price at a registrar, for sorting; none when it has no public price. */
function priceAt(item, registrar) {
  return (item.buy ?? []).find((offer) => offer.registrar === registrar)?.price?.registration;
}

/** The free domains in the table's sort; names without a price at the sorted registrar go last. */
function sorted(items) {
  const { column, direction } = state.sort;
  if (!column) return items;
  const sign = direction === SortDirection.Ascending ? 1 : -1;
  const byName = (a, b) => (a.display || a.domain).localeCompare(b.display || b.domain);
  if (column === DOMAIN_COLUMN) return [...items].sort((a, b) => sign * byName(a, b));
  return [...items].sort((a, b) => {
    const priceA = priceAt(a, column);
    const priceB = priceAt(b, column);
    if (priceA === undefined || priceB === undefined) {
      return (priceA === undefined) - (priceB === undefined) || byName(a, b);
    }
    return sign * (priceA - priceB) || byName(a, b);
  });
}

/** A click on a column's heading sorts by it; a second click turns the order around. */
function sortBy(column) {
  const same = state.sort.column === column;
  const ascending = !same || state.sort.direction === SortDirection.Descending;
  state.sort = {
    column,
    direction: ascending ? SortDirection.Ascending : SortDirection.Descending,
  };
  renderFree();
  content.querySelector(`[data-column="${CSS.escape(column)}"] button`)?.focus();
}

/** A heading that sorts its column, with aria-sort saying how the table is sorted now. */
function sortableHeading(text, column) {
  const cell = element('th');
  cell.scope = 'col';
  cell.dataset.column = column;
  const sortedNow = state.sort.column === column;
  if (sortedNow) cell.setAttribute('aria-sort', state.sort.direction);
  const node = button('sort', text, () => sortBy(column));
  node.append(icon(Icon.Sort));
  if (sortedNow) node.classList.add(`sort--${state.sort.direction}`);
  cell.append(node);
  return cell;
}

/** The free domains as a table of prices: every price a link to that registrar. */
function priceTable(free) {
  const columns = pricedColumns(free);
  const hasOthers = free.some((item) => otherOffers(item, columns).length > 0);
  const table = element('table', 'matrix');
  const caption = element('caption', 'visually-hidden', Copy.TableCaption);
  const headRow = element('tr');
  headRow.append(sortableHeading(Copy.DomainHeading, DOMAIN_COLUMN));
  // The buttons' columns: no visible heading, a spoken one.
  for (const text of actionHeadings()) {
    const cell = element('th', 'matrix__action');
    cell.scope = 'col';
    cell.append(hiddenText(text));
    headRow.append(cell);
  }
  for (const registrar of columns) headRow.append(sortableHeading(registrar, registrar));
  if (hasOthers) {
    const others = element('th', '', Copy.OthersHeading);
    others.scope = 'col';
    headRow.append(others);
  }
  const head = element('thead');
  head.append(headRow);
  const body = element('tbody');
  table.append(caption, head, body);
  const wrap = element('div', 'matrix-wrap');
  wrap.append(table);
  const more = paged(
    free,
    body,
    (item) => tableRows(item, columns, hasOthers),
    (left) => `…and ${left} more free`,
  );
  watchOverflow(wrap);
  return [wrap, ...more];
}

/** Marks the table's frame while it can scroll sideways, so a fade shows there is more. */
function watchOverflow(wrap) {
  const update = () => {
    const more = wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft > 1;
    wrap.classList.toggle('matrix-wrap--more', more);
  };
  wrap.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(wrap);
}

/** A name's row and, when it has other registrars, the row that opens under it with their links. */
function tableRows(item, columns, hasOthers) {
  const domain = item.display || item.domain;
  const row = element('tr');
  row.append(domainCell(item), actionCell(saveButton(item)));
  if (state.can.message) row.append(actionCell(similarButton(item)));
  const offers = new Map((item.buy ?? []).map((offer) => [offer.registrar, offer]));
  for (const registrar of columns) row.append(priceCell(offers.get(registrar), domain));
  if (!hasOthers) return [row];
  const others = otherOffers(item, columns);
  if (!others.length) {
    row.append(noneCell());
    return [row];
  }
  const span = 1 + actionHeadings().length + columns.length + 1;
  const extra = otherLinksRow(others, span, domain);
  const cell = element('td');
  cell.append(
    disclosure('toggle matrix__toggle', `${others.length} more`, extra, ` for ${domain}`),
  );
  row.append(cell);
  return [row, extra];
}

/** The headings of the buttons' columns: Save, and Similar when the host takes messages. */
function actionHeadings() {
  return state.can.message ? [Copy.Save, Copy.Similar] : [Copy.Save];
}

/** A column of its own for one button, so the buttons line up row after row. */
function actionCell(node) {
  const cell = element('td', 'matrix__action');
  cell.append(node);
  return cell;
}

function domainCell(item) {
  const cell = element('th', 'matrix__domain');
  cell.scope = 'row';
  cell.append(element('span', 'result__domain', item.display || item.domain));
  if (item.premium)
    cell.append(element('span', 'matrix__note matrix__note--premium', Copy.Premium));
  const minYears = (item.buy ?? []).find((offer) => offer.price)?.price.minYears ?? 1;
  if (minYears > 1) cell.append(element('span', 'matrix__note', minimumTerm(minYears)));
  return cell;
}

/**
 * A price that links to the registrar, with what renewing costs under it when that differs;
 * "site" where the registrar publishes no price, a dash where it does not sell the name.
 */
function priceCell(offer, domain) {
  if (!offer) return noneCell();
  const cell = element('td');
  const className = offer.price ? 'matrix__link' : 'matrix__link matrix__link--site';
  const link = registrarLink(offer, className);
  if (offer.price) {
    const { price } = offer;
    link.append(money(price.registration, price.currency));
    if (price.renewal !== price.registration) {
      link.append(
        element('span', 'matrix__renewal', `renews ${money(price.renewal, price.currency)}`),
      );
    }
  } else {
    link.append(Copy.SiteCell);
  }
  link.append(hiddenText(` at ${offer.registrar} for ${domain}`));
  cell.append(link);
  return cell;
}

function noneCell() {
  const cell = element('td');
  const mark = element('span', 'matrix__none', NOT_SOLD_MARK);
  mark.setAttribute('aria-hidden', TRUE);
  cell.append(mark, hiddenText(Copy.NotSold));
  return cell;
}

/** The row under a name: its other registrars as links, prices on their own sites. */
function otherLinksRow(offers, span, domain) {
  const row = element('tr', 'matrix__extra');
  row.id = uniqueId('others');
  row.hidden = true;
  const cell = element('td');
  cell.colSpan = span;
  const caption = element('span', 'matrix__extra-label', `Prices on their sites for ${domain}:`);
  const links = element('span', 'matrix__extra-links');
  for (const offer of offers) {
    const link = registrarLink(offer, 'matrix__chip');
    link.append(offer.registrar, icon(Icon.External));
    links.append(link);
  }
  cell.append(caption, links);
  row.append(cell);
  return row;
}

// ── Taken, reserved and unverified names ─────────────────────────────────────────────────────

function group(title, items, chip, actions) {
  const box = element('section', 'group');
  const heading = element('div', 'group__header');
  heading.append(element('h2', 'group__label', `${title} · ${items.length}`));
  if (actions) heading.append(actions);
  const chips = element('ul', 'chips');
  chips.setAttribute('aria-label', title);
  const more = paged(
    items,
    chips,
    (item) => [chip(item)],
    (left) => `Show ${left} more`,
  );
  box.append(heading, chips, ...more);
  return box;
}

/**
 * "Try other TLDs": asks the chat to check the taken names in other TLDs - those not already
 * free in one of the checked ones.
 */
function takenActions(taken) {
  if (!state.can.message) return undefined;
  const freeNames = new Set(state.free.map(label));
  const names = [...new Set(taken.map(label))].filter((name) => !freeNames.has(name));
  if (!names.length) return undefined;
  const ask = button('toggle', Copy.OtherTlds, () => sendToChat(Ask.otherTlds(names)));
  ask.prepend(icon(Icon.Sparkles));
  return ask;
}

/** A taken name; one being deleted says so, visibly, as it may be free soon. */
function takenChip(item) {
  const dropping = item.registration?.dropping;
  const chip = element(
    'li',
    dropping ? 'chip chip--dropping' : 'chip',
    item.display || item.domain,
  );
  if (dropping) {
    chip.append(element('span', 'chip__note', Copy.Dropping));
    chip.title = Copy.DroppingNote;
  }
  const expires = item.registration?.expires?.slice(0, DATE_LENGTH);
  if (!dropping && expires) {
    chip.title = `Registered until ${expires}`;
    chip.append(hiddenText(`, registered until ${expires}`));
  }
  return chip;
}

/** A chip in the given color, with the tool's note for screen readers and as a tooltip. */
function notedChip(modifier) {
  return (item) => {
    const chip = element('li', `chip ${modifier}`, item.display || item.domain);
    if (item.note) {
      chip.title = item.note;
      chip.append(hiddenText(`: ${item.note}`));
    }
    return chip;
  };
}

function notes(warnings) {
  const list = element('ul', 'notes');
  for (const warning of warnings) list.append(element('li', '', warning));
  return list;
}

// ── Messages from the host ────────────────────────────────────────────────────────────────────

/** Handlers of the host's notifications. */
const notificationHandlers = new Map()
  .set(Method.ToolInput, (params) => showChecking(params?.arguments))
  .set(Method.ToolResult, (params) => showResult(params))
  .set(Method.ToolCancelled, () => showMessage(Copy.Cancelled))
  .set(Method.HostContextChanged, (params) => applyHostContext(params));

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (message?.jsonrpc !== JSONRPC) return;
  if (message.method === undefined) {
    settle(message);
  } else if (message.id !== undefined) {
    // A request from the host (a teardown, a ping): nothing to clean up, so agree at once.
    post({ id: message.id, result: {} });
  } else {
    notificationHandlers.get(message.method)?.(message.params);
  }
});

// ── Start: introduce the panel, take the host's look, then follow the content's size ──────────

/** The class that shows the panel, once it has the host's theme (or after a short wait). */
const READY_CLASS = 'is-ready';
/** How long the panel waits for the host's theme before showing itself anyway. */
const SHOW_ANYWAY_MS = 150;

function showPanel() {
  document.documentElement.classList.add(READY_CLASS);
}

/** What the host said it can do, in the shape the panel checks. */
function readCapabilities(capabilities) {
  return {
    openLinks: Boolean(capabilities?.openLinks),
    message: Boolean(capabilities?.message),
    updateModelContext: Boolean(capabilities?.updateModelContext),
    downloadFile: Boolean(capabilities?.downloadFile),
  };
}

async function start() {
  applyTheme();
  showChecking();
  window.setTimeout(showPanel, SHOW_ANYWAY_MS);
  const observer = new ResizeObserver(() => window.requestAnimationFrame(reportSize));
  observer.observe(document.documentElement);
  observer.observe(document.body);
  const result = await request(Method.Initialize, {
    appInfo: APP_INFO,
    appCapabilities: {},
    protocolVersion: PROTOCOL_VERSION,
  });
  state.can = readCapabilities(result?.hostCapabilities);
  applyHostContext(result?.hostContext);
  showPanel();
  notify(Method.Initialized);
  reportSize();
}

start();
