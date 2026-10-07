// Progressive enhancement only: without this script the tabs show every panel, the questions are
// plain <details> and the menu has no frame - nothing on the page is lost.

/** Visitors who asked for less motion get every change at once. */
const PREFERS_STILLNESS = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** DOM events the page listens to. */
const DomEvent = {
  Click: 'click',
  KeyDown: 'keydown',
  MouseEnter: 'mouseenter',
  MouseLeave: 'mouseleave',
  Resize: 'resize',
};

/** ARIA attributes the page keeps up to date. */
const Aria = { Selected: 'aria-selected', Controls: 'aria-controls', Current: 'aria-current' };
/** The value of an ARIA state that is on. */
const ARIA_TRUE = 'true';

// ── Tabs ─────────────────────────────────────────────────────────────────────

/** Blocks turned into tab lists. */
const TABS_SELECTOR = '[data-tabs]';
/** The tabs inside one block. */
const TAB_SELECTOR = '[role="tab"]';
/** Class that hides the unselected panels once the script has taken over. */
const TABS_READY_CLASS = 'tabs--ready';
/** How far each arrow key moves along the tab list. */
const ARROW_STEPS = new Map().set('ArrowRight', 1).set('ArrowLeft', -1);

/** A [data-tabs] block as an accessible tab list: click or the arrow keys switch panels. */
class Tabs {
  constructor(root) {
    this.root = root;
    this.tabs = [...root.querySelectorAll(TAB_SELECTOR)];
  }

  mount() {
    this.tabs.forEach((tab, index) => {
      tab.addEventListener(DomEvent.Click, () => this.select(tab));
      tab.addEventListener(DomEvent.KeyDown, (event) => this.move(index, event));
    });
    const initial = this.tabs.find((tab) => tab.getAttribute(Aria.Selected) === ARIA_TRUE);
    this.select(initial ?? this.tabs[0]);
    this.root.classList.add(TABS_READY_CLASS);
  }

  select(selected) {
    for (const tab of this.tabs) {
      const isSelected = tab === selected;
      tab.setAttribute(Aria.Selected, String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      document.getElementById(tab.getAttribute(Aria.Controls)).hidden = !isSelected;
    }
  }

  move(index, event) {
    const step = ARROW_STEPS.get(event.key);
    if (step === undefined) return;
    const next = this.tabs[(index + step + this.tabs.length) % this.tabs.length];
    next.focus();
    this.select(next);
  }
}

// ── Copy buttons ─────────────────────────────────────────────────────────────

/** Code blocks the reader is meant to paste. */
const COPY_SELECTOR = '[data-copy]';
/** The code inside such a block. */
const CODE_SELECTOR = 'code';
/** Class of the button added to each block. */
const COPY_BUTTON_CLASS = 'copy-button';
/** How long the button says "Copied". */
const COPIED_LABEL_MS = 1500;
/** The button's two labels. */
const CopyLabel = { Copy: 'Copy', Copied: 'Copied' };

/** A Copy button in the corner of a code block. */
class CopyButton {
  constructor(block) {
    this.block = block;
    this.button = document.createElement('button');
  }

  mount() {
    if (!navigator.clipboard) return;
    this.button.type = 'button';
    this.button.className = COPY_BUTTON_CLASS;
    this.button.textContent = CopyLabel.Copy;
    this.button.addEventListener(DomEvent.Click, () => this.copy());
    this.block.append(this.button);
  }

  async copy() {
    await navigator.clipboard.writeText(this.block.querySelector(CODE_SELECTOR).textContent);
    this.button.textContent = CopyLabel.Copied;
    setTimeout(() => {
      this.button.textContent = CopyLabel.Copy;
    }, COPIED_LABEL_MS);
  }
}

// ── Questions and answers ────────────────────────────────────────────────────

/** The question cards: the same accordion as the BelaDay landing page. */
const FAQ_SELECTOR = '.faq details';
/** The always-visible question of a card. */
const SUMMARY_SELECTOR = 'summary';
/** Marks a card on its way shut: the card and its cross go back at once, the height follows. */
const FAQ_CLOSING_CLASS = 'faq-closing';
/** How long a card takes to open or close. */
const FAQ_DURATION_MS = 350;
/** The same curve as the cross turning in styles.css. */
const FAQ_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** One question card that opens and closes smoothly instead of jumping. */
class FaqCard {
  constructor(details) {
    this.details = details;
    this.summary = details.querySelector(SUMMARY_SELECTOR);
    this.running = null;
  }

  mount() {
    this.summary.addEventListener(DomEvent.Click, (event) => this.toggle(event));
  }

  toggle(event) {
    if (PREFERS_STILLNESS) return;
    event.preventDefault();
    const from = this.details.offsetHeight;
    const closedHeight =
      this.summary.offsetHeight + this.details.offsetHeight - this.details.clientHeight;
    this.running?.cancel();

    const opening = !this.details.open || this.details.classList.contains(FAQ_CLOSING_CLASS);
    this.details.classList.remove(FAQ_CLOSING_CLASS);
    if (opening) this.details.open = true;
    const to = opening ? this.details.offsetHeight : closedHeight;
    if (!opening) this.details.classList.add(FAQ_CLOSING_CLASS);

    this.running = this.details.animate(
      { height: [`${from}px`, `${to}px`] },
      { duration: FAQ_DURATION_MS, easing: FAQ_EASING },
    );
    this.running.onfinish = () => this.finish(opening);
  }

  finish(opening) {
    this.running = null;
    if (opening) return;
    this.details.open = false;
    this.details.classList.remove(FAQ_CLOSING_CLASS);
  }
}

// ── Menu frame ───────────────────────────────────────────────────────────────

/** Menus that get dakaio.com's lit frame. */
const NAV_FRAME_SELECTOR = '[data-nav-frame]';
/** The menu's links, its outline drawing and the outline's shape. */
const NavPart = { Link: 'a', Drawing: 'svg', Outline: 'rect' };
/** The outline's normalised length (its pathLength attribute). */
const PATH_LENGTH = 100;
/** The outline at rest: two short dashes, one either side of the pill, ready to be picked up. */
const IDLE_DASH = '10 40 10 40';
/** Where the resting dashes start. */
const IDLE_OFFSET = 5;
/** How far inside an item's box the dashes stop, px. */
const FRAME_INSET_PX = 6;
/** The outline is drawn this far inside the pill, so its 2px stroke is never cut off. */
const STROKE_INSET_PX = 1;
/** Decimals kept in the dash pattern. */
const DASH_DECIMALS = 2;
/** Separates the numbers of a dash pattern. */
const DASH_SEPARATOR = ' ';
/** A section is the one being read while it crosses the middle band of the window. */
const READING_BAND = { rootMargin: '-45% 0px -45% 0px' };
/** In-page links start with this. */
const HASH = '#';

/**
 * dakaio.com's header menu: a lit outline runs along the pill's edge to frame one item from above
 * and below - the section being read at rest, the item under the cursor on hover - and slides
 * between them. The outline is one rect with pathLength=100; this class computes its dash pattern
 * from where the item sits, so it needs no per-item numbers.
 */
class NavFrame {
  constructor(nav) {
    this.nav = nav;
    this.items = [...nav.querySelectorAll(NavPart.Link)];
    this.drawing = nav.querySelector(NavPart.Drawing);
    this.outline = this.drawing.querySelector(NavPart.Outline);
    this.hovered = null;
    this.current = null;
  }

  mount() {
    this.items.forEach((item, index) => {
      item.addEventListener(DomEvent.MouseEnter, () => this.update({ hovered: index }));
    });
    this.nav.addEventListener(DomEvent.MouseLeave, () => this.update({ hovered: null }));
    window.addEventListener(DomEvent.Resize, () => this.draw());
    this.watchSections();
    this.draw();
  }

  /** The item whose section crosses the middle of the window is the current one. */
  watchSections() {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) this.onSection(entry);
    }, READING_BAND);
    for (const item of this.items) {
      const section = item.hash ? document.getElementById(item.hash.slice(HASH.length)) : null;
      if (section) observer.observe(section);
    }
  }

  onSection(entry) {
    const index = this.items.findIndex((item) => item.hash === `${HASH}${entry.target.id}`);
    if (entry.isIntersecting) this.update({ current: index });
    else if (this.current === index) this.update({ current: null });
  }

  update(change) {
    Object.assign(this, change);
    this.items.forEach((item, index) => {
      if (index === this.current) item.setAttribute(Aria.Current, ARIA_TRUE);
      else item.removeAttribute(Aria.Current);
    });
    this.draw();
  }

  /** Sizes the outline to the pill, then dashes it around the framed item. */
  draw() {
    // A pill that scrolls sideways (a narrow phone) has no fixed edge to draw along.
    this.drawing.hidden = this.nav.scrollWidth > this.nav.clientWidth;
    const width = this.nav.clientWidth - STROKE_INSET_PX * 2;
    const height = this.nav.clientHeight - STROKE_INSET_PX * 2;
    this.drawing.setAttribute('width', String(this.nav.clientWidth));
    this.drawing.setAttribute('height', String(this.nav.clientHeight));
    this.outline.setAttribute('x', String(STROKE_INSET_PX));
    this.outline.setAttribute('y', String(STROKE_INSET_PX));
    this.outline.setAttribute('width', String(width));
    this.outline.setAttribute('height', String(height));
    this.outline.setAttribute('rx', String(height / 2));

    const framed = this.hovered ?? this.current;
    const dash = framed === null || framed < 0 ? null : this.dashFor(framed, width, height);
    this.outline.style.strokeDasharray = dash?.array ?? IDLE_DASH;
    this.outline.style.strokeDashoffset = String(dash?.offset ?? IDLE_OFFSET);
  }

  /**
   * The dash pattern that frames item `index`. The outline starts at the top edge's left end and
   * runs clockwise: top edge, arc, right edge, arc, bottom edge (right to left), arc, left edge.
   * A point at `x` on the top edge is `x - r` along it; the same `x` on the bottom edge is a top
   * edge, a right arc and the rest of the bottom edge further on. A negative offset moves the
   * pattern forward, so the first dash starts in place without a zero-length dash before it.
   */
  dashFor(index, width, height) {
    const origin = this.outline.getBoundingClientRect().left;
    const box = this.items[index].getBoundingClientRect();
    const radius = height / 2;
    const x1 = Math.max(radius, box.left - origin + FRAME_INSET_PX);
    const x2 = Math.min(width - radius, box.right - origin - FRAME_INSET_PX);
    const straight = width - radius * 2;
    const perimeter = straight * 2 + Math.PI * radius * 2;
    const toPath = (length) => (length / perimeter) * PATH_LENGTH;

    const topStart = toPath(x1 - radius);
    const dash = toPath(x2 - x1);
    const bottomStart = toPath(straight + Math.PI * radius + (width - radius - x2));
    const between = bottomStart - (topStart + dash);
    const rest = PATH_LENGTH - (topStart + dash + between + dash);
    const parts = [dash, between, dash, rest + topStart].map((part) => part.toFixed(DASH_DECIMALS));
    return { array: parts.join(DASH_SEPARATOR), offset: -topStart };
  }
}

// ── Start ────────────────────────────────────────────────────────────────────

/** Every enhancement, by the elements it takes over. */
const ENHANCEMENTS = new Map()
  .set(TABS_SELECTOR, Tabs)
  .set(COPY_SELECTOR, CopyButton)
  .set(FAQ_SELECTOR, FaqCard)
  .set(NAV_FRAME_SELECTOR, NavFrame);

for (const [selector, Enhancement] of ENHANCEMENTS) {
  for (const element of document.querySelectorAll(selector)) new Enhancement(element).mount();
}
