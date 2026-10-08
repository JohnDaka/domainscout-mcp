// DomainScout's results panel for hosts that support MCP Apps. The host renders ui/results.html
// in a sandboxed iframe under a check_domains call and passes the call's result in; the server
// inlines this script and results.css into that page, so nothing is loaded from elsewhere.

// ── The MCP Apps protocol: JSON-RPC 2.0 over postMessage with the host ─────────────────────────

/** The MCP Apps protocol version this panel speaks. */
const PROTOCOL_VERSION = '2026-01-26';
/** How this panel introduces itself to the host. */
const APP_INFO = { name: 'DomainScout results', version: '1.2.0' };
/** The JSON-RPC version of every message. */
const JSONRPC = '2.0';
/** Where messages go: the host is the frame that embeds this panel. */
const ANY_ORIGIN = '*';
/** How long a host gets to open a link before the panel offers the link to copy instead. */
const OPEN_LINK_TIMEOUT_MS = 3000;

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

/** A promise that gives up after the given time. */
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) => window.setTimeout(reject, ms));
  return Promise.race([promise, timeout]);
}

/**
 * Opens a registrar's page. The sandbox blocks navigation and pop-ups, so only the host can open
 * it; when the host can't, refuses, or doesn't answer, the panel shows the link to copy.
 */
function openLink(url) {
  if (!state.hostOpensLinks) {
    showLinkFallback(url);
    return;
  }
  withTimeout(request(Method.OpenLink, { url }), OPEN_LINK_TIMEOUT_MS)
    .then((result) => {
      if (result?.isError) showLinkFallback(url);
    })
    .catch(() => showLinkFallback(url));
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
  NoneFree: 'None of these are free. Ask for variations of the names or other TLDs.',
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
  LinkBlocked: "Your chat app didn't open the link. Copy it:",
  Close: 'Close',
  Footnote:
    'Registrars are listed cheapest first. Prices are standard yearly prices where a registrar publishes them; premium names cost more.',
};

/** What a table cell shows for a registrar that does not sell the name. */
const NOT_SOLD_MARK = '—';
/** A hyphen and a space that never break a line: "2-year minimum" stays whole. */
const NO_BREAK_HYPHEN = '‑';
const NO_BREAK_SPACE = ' ';
/** Between the lowest and the highest price: an en dash, as in "$10.46-$11.08". */
const RANGE_DASH = '–';

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

/** The system's theme, until the host or the visitor says otherwise. */
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

const state = {
  view: readChoice(StorageKey.View, View) ?? DEFAULT_VIEW,
  /** The panel's own theme: dark unless the visitor picked light. */
  theme: readChoice(StorageKey.Theme, Theme) ?? DEFAULT_THEME,
  /** The host's theme: only the page's color scheme follows it. */
  hostTheme: window.matchMedia(LIGHT_SCHEME_QUERY).matches ? Theme.Light : Theme.Dark,
  /** Whether the host said which theme it uses: only then does the canvas follow it. */
  hostThemeKnown: false,
  /** Whether the host offers to open links; assumed until it says otherwise. */
  hostOpensLinks: true,
  /** The host's locale, for prices. */
  locale: undefined,
  /** The last tool result's free domains, so a change of view keeps them. */
  free: [],
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

// ── The host's look: its theme, font and locale ───────────────────────────────────────────────

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
  .set(Icon.Chevron, ['M6 9l6 6 6-6']);

/** How an inlined image's address starts. */
const DATA_URI_PREFIX = 'data:';
/** The icon's size beside the name, in CSS pixels; the image is drawn sharper than that. */
const LOGO_SIZE = 18;

/** Attribute values used as switches. */
const TRUE = 'true';
const FALSE = 'false';

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

/** Text only screen readers hear, such as which domain a button belongs to. */
function hiddenText(text) {
  return element('span', 'visually-hidden', text);
}

function money(amount, currency) {
  return new Intl.NumberFormat(state.locale, { style: 'currency', currency }).format(amount);
}

/** A button that opens and closes the given element, which starts closed. */
function disclosure(className, label, target, hiddenLabel) {
  const toggle = element('button', className, label);
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', FALSE);
  toggle.setAttribute('aria-controls', target.id);
  if (hiddenLabel) toggle.append(hiddenText(hiddenLabel));
  toggle.append(icon(Icon.Chevron));
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== TRUE;
    toggle.setAttribute('aria-expanded', String(open));
    target.hidden = !open;
  });
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
    const button = element('button', 'segmented__option');
    button.type = 'button';
    button.title = option.label;
    button.setAttribute('aria-label', option.label);
    button.append(icon(option.icon));
    button.addEventListener('click', () => choose(option.value));
    toolbarButtons.push({ button, isPressed: () => current() === option.value });
    group.append(button);
  }
  return group;
}

function syncToolbar() {
  for (const { button, isPressed } of toolbarButtons) {
    button.setAttribute('aria-pressed', String(isPressed()));
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
const linkFallback = element('div', 'fallback');
linkFallback.hidden = true;
const content = element('div', 'content');
panel.append(header, status, linkFallback, content);
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

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind ? `summary summary--${kind}` : 'summary';
  status.setAttribute('role', kind === StatusKind.Error ? 'alert' : 'status');
}

/** How the status line looks. */
const StatusKind = {
  Progress: 'progress',
  Error: 'error',
};

/** "Your chat app didn't open the link. Copy it:" with the link, selected, and a close button. */
function showLinkFallback(url) {
  const field = element('input', 'fallback__url');
  field.type = 'text';
  field.readOnly = true;
  field.value = url;
  field.setAttribute('aria-label', Copy.LinkBlocked);
  const close = element('button', 'fallback__close', Copy.Close);
  close.type = 'button';
  close.addEventListener('click', () => {
    linkFallback.hidden = true;
  });
  linkFallback.replaceChildren(element('p', 'fallback__text', Copy.LinkBlocked), field, close);
  linkFallback.hidden = false;
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
/** The content type of the tool's text report. */
const TEXT_BLOCK = 'text';
/** Names shown at a time, in each list and each "show more" step: about a screenful. */
const PAGE_SIZE = 24;
/** Characters of an ISO date that make the day: "2030-02-03". */
const DATE_LENGTH = 10;
/** Milliseconds in a second, for the elapsed time. */
const SECOND_MS = 1000;
/** Rows a "show more" button has revealed get focus, so the keyboard carries on from there. */
const FOCUSABLE_FROM_SCRIPT = '-1';

function showChecking(input) {
  state.free = [];
  const count = Array.isArray(input?.domains) ? input.domains.length : 0;
  const tlds = Array.isArray(input?.tlds) && input.tlds.length ? input.tlds : undefined;
  const where = tlds ? ` in ${tlds.map((tld) => `.${tld}`).join(', ')}` : '';
  setStatus(count ? `Checking ${count} names${where}…` : Copy.Checking, StatusKind.Progress);
  content.replaceChildren(element('div', 'progress'));
  layoutGroup.hidden = false;
}

function showMessage(text, kind) {
  state.free = [];
  setStatus(text, kind);
  content.replaceChildren();
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
  state.free = free;
  setStatus(summaryText(data, free, taken, reserved, unknown));
  layoutGroup.hidden = !free.length;

  const rest = [];
  if (!free.length) rest.push(element('p', 'empty', Copy.NoneFree));
  if (taken.length) rest.push(group(Copy.Taken, taken, takenChip));
  if (reserved.length) rest.push(group(Copy.Reserved, reserved, notedChip('chip--reserved')));
  if (unknown.length) rest.push(group(Copy.Unknown, unknown, notedChip('chip--unknown')));
  if (data.warnings?.length) rest.push(notes(data.warnings));
  if (free.length) {
    const disclosureText = data.disclosure ? ` ${data.disclosure}` : '';
    rest.push(element('p', 'footnote', `${Copy.Footnote}${disclosureText}`));
  }
  const freeBox = element('div', 'free');
  content.replaceChildren(freeBox, ...rest);
  renderFree();
}

/** "48 domains checked in 4.2s: 23 free, 25 taken", naming the TLD when there is only one. */
function summaryText(data, free, taken, reserved, unknown) {
  const total = data.summary?.total ?? data.results.length;
  const elapsed = data.summary?.elapsed_ms;
  const time = Number.isFinite(elapsed) ? ` in ${(elapsed / SECOND_MS).toFixed(1)}s` : '';
  const tlds = new Set(data.results.map((item) => item.tld));
  const onlyTld = tlds.size === 1 ? ` .${[...tlds][0]}` : '';
  const counts = [`${free.length} free${onlyTld}`, `${taken.length} taken`];
  if (reserved.length) counts.push(`${reserved.length} reserved`);
  if (unknown.length) counts.push(`${unknown.length} not verified`);
  return `${total} domains checked${time}: ${counts.join(', ')}`;
}

/** The free domains in the chosen view, into the box at the top of the content. */
function renderFree() {
  const box = content.querySelector('.free');
  if (!box) return;
  const parts = state.view === View.Table ? priceTable(state.free) : freeList(state.free);
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
  const more = element('button', 'more');
  more.type = 'button';
  const label = () => moreLabel(items.length - shown);
  more.textContent = label();
  more.addEventListener('click', () => {
    const page = items.slice(shown, shown + PAGE_SIZE).flatMap(build);
    container.append(...page);
    shown += PAGE_SIZE;
    page[0].tabIndex = Number(FOCUSABLE_FROM_SCRIPT);
    page[0].focus();
    if (shown >= items.length) more.remove();
    else more.textContent = label();
  });
  return [more];
}

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
  const name = element('span', 'result__domain', domain);
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
  row.append(line);
  if (!offers.length) return row;
  const list = registrarList(offers, domain);
  line.append(disclosure('toggle', `All ${offers.length} registrars`, list, ` for ${domain}`));
  row.append(list);
  return row;
}

/**
 * "$10.46–$11.08/yr" from the cheapest registrar to the dearest one that publishes a price, in
 * the cheapest one's currency, with the minimum term and what it costs upfront. A premium name
 * has its own price, so it says so instead of showing the standard one.
 */
function priceSummary(item, offers) {
  const tld = item.tld ? `.${item.tld}` : '';
  if (!offers.length) return `No registrar in our list sells ${tld}`;
  if (item.premium) return Copy.PremiumPrice;
  const lead = offers.find((offer) => offer.price)?.price;
  if (!lead) return Copy.NoPrices;
  const amounts = offers
    .map((offer) => offer.price)
    .filter((price) => price?.currency === lead.currency)
    .map((price) => price.registration);
  const low = money(Math.min(...amounts), lead.currency);
  const high = money(Math.max(...amounts), lead.currency);
  const range = low === high ? low : `${low}${RANGE_DASH}${high}`;
  if (lead.minYears <= 1) return `${range}/yr`;
  const upfront = money(lead.registration * lead.minYears, lead.currency);
  return `${range}/yr, ${minimumTerm(lead.minYears)} (${upfront} upfront)`;
}

function minimumTerm(years) {
  return `${years}${NO_BREAK_HYPHEN}year${NO_BREAK_SPACE}minimum`;
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
    const price = offer.price
      ? `${money(offer.price.registration, offer.price.currency)}/yr`
      : Copy.PriceOnSite;
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

/** The free domains as a table of prices: every price a link to that registrar. */
function priceTable(free) {
  const columns = pricedColumns(free);
  const hasOthers = free.some((item) => otherOffers(item, columns).length > 0);
  const table = element('table', 'matrix');
  const caption = element('caption', 'visually-hidden', Copy.TableCaption);
  const headRow = element('tr');
  const headings = [Copy.DomainHeading, ...columns, ...(hasOthers ? [Copy.OthersHeading] : [])];
  for (const text of headings) {
    const cell = element('th', '', text);
    cell.scope = 'col';
    headRow.append(cell);
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
  row.append(domainCell(item));
  const offers = new Map((item.buy ?? []).map((offer) => [offer.registrar, offer]));
  for (const registrar of columns) row.append(priceCell(offers.get(registrar), domain));
  if (!hasOthers) return [row];
  const others = otherOffers(item, columns);
  if (!others.length) {
    row.append(noneCell());
    return [row];
  }
  const extra = otherLinksRow(others, columns.length + 2, domain);
  const cell = element('td');
  cell.append(
    disclosure('toggle matrix__toggle', `${others.length} more`, extra, ` for ${domain}`),
  );
  row.append(cell);
  return [row, extra];
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

/** A price that links to the registrar, "site" where it has none, a dash where it does not sell. */
function priceCell(offer, domain) {
  if (!offer) return noneCell();
  const cell = element('td');
  const className = offer.price ? 'matrix__link' : 'matrix__link matrix__link--site';
  const link = registrarLink(offer, className);
  link.textContent = offer.price
    ? money(offer.price.registration, offer.price.currency)
    : Copy.SiteCell;
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
  const label = element('span', 'matrix__extra-label', `Prices on their sites for ${domain}:`);
  const links = element('span', 'matrix__extra-links');
  for (const offer of offers) {
    const link = registrarLink(offer, 'matrix__chip');
    link.append(offer.registrar, icon(Icon.External));
    links.append(link);
  }
  cell.append(label, links);
  row.append(cell);
  return row;
}

// ── Taken, reserved and unverified names ─────────────────────────────────────────────────────

function group(label, items, chip) {
  const box = element('section', 'group');
  const title = element('h2', 'group__label', `${label} · ${items.length}`);
  const chips = element('ul', 'chips');
  chips.setAttribute('aria-label', label);
  const more = paged(
    items,
    chips,
    (item) => [chip(item)],
    (left) => `Show ${left} more`,
  );
  box.append(title, chips, ...more);
  return box;
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
  state.hostOpensLinks = Boolean(result?.hostCapabilities?.openLinks);
  applyHostContext(result?.hostContext);
  showPanel();
  notify(Method.Initialized);
  reportSize();
}

start();
