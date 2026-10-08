// DomainScout's results panel for hosts that support MCP Apps. The host renders ui/results.html
// in a sandboxed iframe under a check_domains call and passes the call's result in; the server
// inlines this script and results.css into that page, so nothing is loaded from elsewhere.

// ── The MCP Apps protocol: JSON-RPC 2.0 over postMessage with the host ─────────────────────────

/** The MCP Apps protocol version this panel speaks. */
const PROTOCOL_VERSION = '2026-01-26';
/** How this panel introduces itself to the host. */
const APP_INFO = { name: 'DomainScout results', version: '1.1.0' };
/** The JSON-RPC version of every message. */
const JSONRPC = '2.0';
/** Where messages go: the host is the frame that embeds this panel. */
const ANY_ORIGIN = '*';

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

/** Opens a buy link: the sandbox blocks navigation, so the host opens it. */
function openLink(url) {
  request(Method.OpenLink, { url }).catch(() => window.open(url, '_blank', 'noopener'));
}

// ── Preferences: list or cards, light or dark ─────────────────────────────────────────────────

/** How the free domains are laid out. */
const View = {
  List: 'list',
  Grid: 'grid',
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

const state = {
  view: readChoice(StorageKey.View, View) ?? View.List,
  /** The visitor's own theme; while unset, the host's theme applies. */
  chosenTheme: readChoice(StorageKey.Theme, Theme),
  hostTheme: window.matchMedia(LIGHT_SCHEME_QUERY).matches ? Theme.Light : Theme.Dark,
  /** The last tool result, drawn again when the view changes. */
  result: undefined,
};

function applyTheme() {
  document.documentElement.dataset.theme = state.chosenTheme ?? state.hostTheme;
  syncToolbar();
}

// ── The host's look: its theme and font ───────────────────────────────────────────────────────

function applyHostContext(context) {
  if (!context) return;
  if (Object.values(Theme).includes(context.theme)) state.hostTheme = context.theme;
  const font = context.styles?.variables?.['--font-sans'];
  if (font) document.documentElement.style.setProperty('--font-sans', font);
  const fonts = context.styles?.css?.fonts;
  if (fonts) {
    const style = document.createElement('style');
    style.textContent = fonts;
    document.head.append(style);
  }
  applyTheme();
}

// ── The panel's height follows its content ────────────────────────────────────────────────────

let reportedWidth = 0;
let reportedHeight = 0;

function reportSize() {
  const root = document.documentElement;
  const previous = root.style.height;
  root.style.height = 'max-content';
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

/** Icons as SVG path data: drawn with strokes, in the text's color. */
const ICON_PATHS = new Map()
  .set('list', ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'])
  .set('grid', ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'])
  .set('sun', [
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
  .set('moon', ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'])
  .set('external', ['M7 17L17 7', 'M8 7h9v9'])
  .set('chevron', ['M6 9l6 6 6-6']);

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', ICON_VIEW_BOX);
  svg.setAttribute('aria-hidden', 'true');
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

function money(amount, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

// ── The toolbar: two button groups, view and theme ────────────────────────────────────────────

/** The groups' options: the value each sets, its icon and its name for screen readers. */
const VIEW_OPTIONS = [
  { value: View.List, icon: 'list', label: 'Show as a list' },
  { value: View.Grid, icon: 'grid', label: 'Show as cards' },
];
const THEME_OPTIONS = [
  { value: Theme.Light, icon: 'sun', label: 'Light theme' },
  { value: Theme.Dark, icon: 'moon', label: 'Dark theme' },
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

function toolbar() {
  toolbarButtons.length = 0;
  const bar = element('div', 'toolbar');
  bar.append(
    segmented('Layout', VIEW_OPTIONS, () => state.view, chooseView),
    segmented('Theme', THEME_OPTIONS, () => document.documentElement.dataset.theme, chooseTheme),
  );
  return bar;
}

function syncToolbar() {
  for (const { button, isPressed } of toolbarButtons) {
    button.setAttribute('aria-pressed', String(isPressed()));
  }
}

function chooseView(view) {
  state.view = view;
  keepChoice(StorageKey.View, view);
  if (state.result) showResult(state.result);
}

function chooseTheme(theme) {
  state.chosenTheme = theme;
  keepChoice(StorageKey.Theme, theme);
  applyTheme();
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
/** Free domains shown before "…and N more free": about a screenful. */
const FREE_SHOWN = 12;
/** Characters of an ISO date that make the day: "2030-02-03". */
const DATE_LENGTH = 10;
/** Milliseconds in a second, for the elapsed time. */
const SECOND_MS = 1000;
/** A hyphen and a space that never break a line: "2-year minimum" stays whole. */
const NO_BREAK_HYPHEN = '\u2011';
const NO_BREAK_SPACE = '\u00a0';
/** Between the lowest and the highest price: an en dash, as in "$10.46-$11.08". */
const RANGE_DASH = '\u2013';
/** What the panel says it is, as on the landing page. */
const TOOL_WHO = 'DomainScout';
const TOOL_NAME = 'check_domains';

const app = document.getElementById('app');
let nextListId = 1;

/** The panel: the header with the toolbar, then the given parts. */
function showPanel(...parts) {
  const panel = element('section', 'panel');
  const header = element('div', 'header');
  const tool = element('p', 'tool');
  tool.append(element('span', 'tool__who', TOOL_WHO), TOOL_NAME);
  header.append(tool, toolbar());
  panel.append(header, ...parts);
  app.replaceChildren(panel);
  syncToolbar();
}

function showMessage(text) {
  showPanel(element('p', 'status', text));
}

function showChecking(input) {
  const count = Array.isArray(input?.domains) ? input.domains.length : 0;
  const text = count ? `Checking ${count} names…` : 'Checking domains…';
  showPanel(element('p', 'status', text), element('div', 'progress'));
}

function showResult(result) {
  state.result = result;
  const data = result?.structuredContent;
  if (result?.isError || !data?.results) {
    const text = result?.content?.find((block) => block.type === 'text')?.text;
    showMessage(text ?? 'The check did not return results.');
    return;
  }
  const byStatus = (statuses) => data.results.filter((item) => statuses.includes(item.status));
  const free = byStatus([Status.Available, Status.LikelyAvailable]);
  const taken = byStatus([Status.Taken]);
  const reserved = byStatus([Status.Reserved]);
  const unknown = byStatus([Status.Unknown]);

  const parts = [element('p', 'summary', summaryText(data, free, taken, reserved, unknown))];
  if (free.length) parts.push(...freeDomains(free));
  if (taken.length) parts.push(group('Taken', taken, takenChip));
  if (reserved.length) parts.push(group('Reserved', reserved, labelledChip('chip--reserved')));
  if (unknown.length) {
    parts.push(group('Not verified, try again later', unknown, labelledChip('chip--unknown')));
  }
  if (data.warnings?.length) parts.push(notes(data.warnings));
  const disclosure = data.disclosure ? ` ${data.disclosure}` : '';
  parts.push(
    element(
      'p',
      'footnote',
      `Registrars are listed cheapest first. Prices are standard yearly prices for the TLD; premium names cost more.${disclosure}`,
    ),
  );
  showPanel(...parts);
}

/** "48 names checked in 4.2s: 23 free, 25 taken", naming the TLD when there is only one. */
function summaryText(data, free, taken, reserved, unknown) {
  const seconds = (data.summary.elapsed_ms / SECOND_MS).toFixed(1);
  const tlds = new Set(data.results.map((item) => item.tld));
  const onlyTld = tlds.size === 1 ? ` .${[...tlds][0]}` : '';
  const counts = [`${free.length} free${onlyTld}`, `${taken.length} taken`];
  if (reserved.length) counts.push(`${reserved.length} reserved`);
  if (unknown.length) counts.push(`${unknown.length} not verified`);
  return `${data.summary.total} names checked in ${seconds}s: ${counts.join(', ')}`;
}

/** The free domains, the first FREE_SHOWN of them until "…and N more free". */
function freeDomains(free) {
  const listClass = state.view === View.Grid ? 'results results--grid' : 'results';
  const list = element('ul', listClass);
  list.setAttribute('aria-label', 'Free domains');
  list.append(...free.slice(0, FREE_SHOWN).map(freeDomain));
  if (free.length <= FREE_SHOWN) return [list];
  const more = element('button', 'more', `…and ${free.length - FREE_SHOWN} more free`);
  more.type = 'button';
  more.addEventListener('click', () => {
    list.append(...free.slice(FREE_SHOWN).map(freeDomain));
    more.remove();
  });
  return [list, more];
}

function freeDomain(item) {
  const domain = item.display || item.domain;
  const row = element('li', 'result');
  row.append(element('span', 'result__domain', domain));
  const pill = item.premium
    ? element('span', 'pill pill--premium', 'Premium')
    : element('span', 'pill', 'Available');
  if (item.confirmedBy) pill.title = `Confirmed by ${item.confirmedBy}`;
  row.append(pill);

  // The tool lists offers cheapest first, priced ones before the rest: the range reads from the
  // priced ones, and the accordion keeps the tool's order.
  const offers = item.buy ?? [];
  const line = element('div', 'result__line');
  line.append(element('span', 'result__price', priceRange(offers)));
  row.append(line);
  if (!offers.length) return row;
  const list = registrarList(offers, domain);
  line.append(accordionToggle(offers.length, list));
  row.append(list);
  return row;
}

/**
 * "$10.46–$11.08/yr", from the cheapest registrar to the dearest one with a known price, plus the
 * minimum term where there is one. One price when only one is known; none at all, then
 * "Price on the registrars' sites".
 */
function priceRange(offers) {
  const prices = offers.map((offer) => offer.price).filter(Boolean);
  if (!prices.length) return "Price on the registrars' sites";
  const amounts = prices.map((price) => price.registration);
  const { currency, minYears } = prices[0];
  const low = money(Math.min(...amounts), currency);
  const high = money(Math.max(...amounts), currency);
  const range = low === high ? low : `${low}${RANGE_DASH}${high}`;
  const term = minYears > 1 ? `, ${minYears}${NO_BREAK_HYPHEN}year${NO_BREAK_SPACE}minimum` : '';
  return `${range}/yr${term}`;
}

/** "All N registrars": opens and closes the list under the domain. */
function accordionToggle(count, list) {
  const toggle = element('button', 'toggle', `All ${count} registrars`);
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', list.id);
  toggle.append(icon('chevron'));
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
  });
  return toggle;
}

/**
 * Every registrar that sells the name, in the tool's order. Each row is one link, the whole row
 * clickable: the registrar, its price and the arrow in columns that line up from row to row.
 * The sandbox blocks navigation, so the host opens the link.
 */
function registrarList(offers, domain) {
  const list = element('ul', 'registrars');
  list.id = `registrars-${nextListId++}`;
  list.hidden = true;
  list.setAttribute('aria-label', `Registrars for ${domain}`);
  for (const offer of offers) {
    const link = element('a', 'registrar');
    link.href = offer.url;
    link.rel = 'noopener';
    const price = offer.price
      ? `${money(offer.price.registration, offer.price.currency)}/yr`
      : 'price on site';
    link.append(
      element('span', 'registrar__name', offer.registrar),
      element('span', 'registrar__price', price),
      icon('external'),
    );
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openLink(offer.url);
    });
    const item = element('li');
    item.append(link);
    list.append(item);
  }
  return list;
}

function group(label, items, chip) {
  const box = element('div', 'group');
  const chips = element('ul', 'chips');
  chips.setAttribute('aria-label', label);
  for (const item of items) chips.append(chip(item));
  box.append(element('p', 'group__label', `${label} · ${items.length}`), chips);
  return box;
}

function takenChip(item) {
  const dropping = item.registration?.dropping;
  const chip = element(
    'li',
    dropping ? 'chip chip--dropping' : 'chip',
    item.display || item.domain,
  );
  const expires = item.registration?.expires?.slice(0, DATE_LENGTH);
  if (dropping) chip.title = 'Being deleted: may become available soon';
  else if (expires) chip.title = `Registered until ${expires}`;
  return chip;
}

/** A chip in the given color, with the tool's note as its title. */
function labelledChip(modifier) {
  return (item) => {
    const chip = element('li', `chip ${modifier}`, item.display || item.domain);
    if (item.note) chip.title = item.note;
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
  .set(Method.ToolCancelled, () => showMessage('The check was cancelled.'))
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

async function start() {
  applyTheme();
  showChecking();
  const result = await request(Method.Initialize, {
    appInfo: APP_INFO,
    appCapabilities: {},
    protocolVersion: PROTOCOL_VERSION,
  });
  applyHostContext(result?.hostContext);
  notify(Method.Initialized);
  const observer = new ResizeObserver(() => requestAnimationFrame(reportSize));
  observer.observe(document.documentElement);
  observer.observe(document.body);
  reportSize();
}

start();
