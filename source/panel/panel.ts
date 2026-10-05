// v1.1 — the side panel (browser-extension/src/panel.html). Bundled by
// scripts/pack-extension.mjs into panel.js; the decisions live in ./logic.ts.
// (Published with the extension's source: no names or internal notes in comments.)
//
// How it is meant to feel (Apple's interface guidelines, applied to a tool someone opens
// many times a day while writing an estimate):
//   · no waiting — the part list ships inside the extension, so the panel answers on the first
//     keystroke; the copy on maplev.ca is fetched afterwards and swapped in silently if newer
//   · no animation on what repeats (typing, arrow keys, opening the panel); feedback only where
//     it confirms something — a press, a copied number
//   · the keyboard works: "/" focuses the search, ↑ ↓ move, Enter opens, Esc clears
//   · one place for each thing: search on top, car and part type right under it, results below,
//     the credit line once at the bottom
//
// Runs in the extension's own page: no cookies sent anywhere, nothing stored, every string set
// through textContent, and only rows that pass acceptData() (plain maplev.ca paths) are linked.
import { dataUrl, imageUrl, lookupUrl, partUrl, siteUrl, uiLang } from "@ext/config";
import {
  OE_WIDGET_COPY,
  PANEL_COPY,
  acceptData,
  displayName,
  panelCarCount,
  panelChips,
  panelFind,
  panelKeys,
  panelShelves,
  splitFits,
  type PanelInput,
  type PanelView,
} from "./logic";
import type { OeWidgetData, OeWidgetRow } from "../../src/lib/oeWidget";

type Ext = {
  runtime?: {
    getURL?: (path: string) => string;
    sendMessage?: (msg: unknown, cb?: (res: unknown) => void) => Promise<unknown> | void;
    onMessage?: { addListener: (fn: (msg: unknown, sender: unknown, send: (res: unknown) => void) => boolean | void) => void };
    lastError?: unknown;
  };
};
const ext: Ext = ((globalThis as { browser?: Ext; chrome?: Ext }).browser ?? (globalThis as { chrome?: Ext }).chrome) || {};

const lang = uiLang() as "en" | "fr";
const copy = PANEL_COPY[lang];
const shared = OE_WIDGET_COPY[lang];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLInputElement>("q");
const clearBtn = $<HTMLButtonElement>("clear");
const carSel = $<HTMLSelectElement>("car");
const catSel = $<HTMLSelectElement>("cat");
const carPill = $("car-pill");
const catPill = $("cat-pill");
const carText = $("car-text");
const catText = $("cat-text");
const carX = $<HTMLButtonElement>("car-x");
const catX = $<HTMLButtonElement>("cat-x");
const status = $("status");
const view = $("view");
const content = $("content");
const toastEl = $("toast");
const openSite = $<HTMLAnchorElement>("open");

let data: OeWidgetData | null = null;
let keysByRow: string[][] = [];
const state: PanelInput = { query: "", car: "", cat: "" };
/** Rows on screen, in reading order — what ↑ ↓ walk through. */
let navRows: HTMLElement[] = [];
let active = -1;

const localized = (row: OeWidgetRow) => (lang === "fr" ? row.name.toLowerCase() : "");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
/** Small line icons, drawn on a 20-unit grid, stroke = currentColor. */
const ICONS: Record<string, string> = {
  go: "M7 13 13 7M8 7h5v5",
  chevron: "m8 5 5 5-5 5",
  cursor: "M5 4l10 4.5-4.2 1.4L9.4 14z",
  paste: "M7 4h6v2H7zM6 5H5v11h10V5h-1M8 10h4M8 13h3",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17",
  none: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17M7 7l4 4M11 7l-4 4",
};
function icon(name: string, className = "ic"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

// ── data ────────────────────────────────────────────────────────────────────────────────

function setData(next: OeWidgetData): void {
  data = next;
  keysByRow = panelKeys(next);
  fillSelect(carSel, shared.allCars, next.cars, state.car);
  fillSelect(catSel, shared.allParts, next.cats, state.cat);
  state.car = carSel.value;
  state.cat = catSel.value;
}

function fillSelect(sel: HTMLSelectElement, all: string, options: { value: string; label: string }[], keep: string): void {
  sel.textContent = "";
  sel.append(new Option(all, ""));
  for (const o of options) sel.append(new Option(o.label, o.value));
  sel.value = options.some((o) => o.value === keep) ? keep : "";
}

async function loadBundled(): Promise<OeWidgetData | null> {
  const path = `data/oe-lookup-${lang}.json`;
  const url = ext.runtime?.getURL ? ext.runtime.getURL(path) : path;
  try {
    const res = await fetch(url);
    return acceptData(await res.json());
  } catch {
    return null;
  }
}

/** The copy on maplev.ca: newer parts and corrected numbers arrive without an extension update. */
async function refreshFromSite(): Promise<void> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(dataUrl(lang), { cache: "no-cache", credentials: "omit", signal: ctrl.signal });
    if (!res.ok) return;
    const fresh = acceptData(await res.json());
    if (!fresh || (data && JSON.stringify(fresh) === JSON.stringify(data))) return;
    setData(fresh);
    render();
  } catch {
    // offline or blocked — the bundled list keeps working
  } finally {
    window.clearTimeout(timer);
  }
}

// ── rendering ───────────────────────────────────────────────────────────────────────────

function syncControls(): void {
  clearBtn.hidden = !input.value;
  const carOn = Boolean(state.car);
  const catOn = Boolean(state.cat);
  carText.textContent = carOn ? state.car : shared.allCars;
  catText.textContent = catOn ? catSel.options[catSel.selectedIndex]?.text || shared.allParts : shared.allParts;
  carPill.classList.toggle("is-on", carOn);
  catPill.classList.toggle("is-on", catOn);
  carX.hidden = !carOn;
  catX.hidden = !catOn;
  openSite.href = lookupUrl(lang, state.query.trim());
}

function render(): void {
  syncControls();
  view.textContent = "";
  navRows = [];
  active = -1;
  if (!data) {
    // The bundled list could not be read (should not happen) — say so, and offer the website.
    status.textContent = "";
    view.append(button(lookupUrl(lang, state.query.trim()), copy.openSite, "btn"));
    return;
  }
  const v = panelFind(data, keysByRow, state, localized);
  if (v.mode === "idle") renderIdle();
  else if (v.mode === "multi") renderMulti(v);
  else if (!v.hits.length) renderEmpty(v);
  else renderList(v);
}

function renderIdle(): void {
  if (!data) return;
  status.textContent = state.car ? copy.carCount(panelCarCount(data, state.car), state.car) : copy.hint(data.oes, data.parts);
  const title = el("p", "eyebrow", copy.shelvesTitle);
  const list = el("ul", "shelves");
  for (const shelf of panelShelves(data, state.car)) {
    const item = el("li");
    const btn = el("button", "shelf");
    btn.type = "button";
    btn.dataset.cat = shelf.cat;
    const pic = el("span", "shelf-pic");
    if (shelf.img) pic.append(thumb(shelf.img, 40));
    btn.append(pic, el("span", "shelf-label", shelf.label), el("span", "shelf-count", String(shelf.count)), icon("chevron", "ic shelf-go"));
    item.append(btn);
    list.append(item);
  }
  const tips = el("div", "tips");
  for (const [name, text] of [
    ["cursor", copy.tipMenu],
    ["paste", copy.tipPaste],
  ] as const) {
    const tip = el("p", "tip");
    tip.append(icon(name, "ic tip-ic"), el("span", "", text));
    tips.append(tip);
  }
  view.append(title, list, tips);
}

function renderList(v: PanelView): void {
  if (!data) return;
  status.textContent = shared.found(v.hits.length);
  const list = el("div", "rows");
  for (const i of v.hits) list.append(row(data.rows[i], v.mode === "number" ? v.nq : ""));
  view.append(list);
  const more = moreUrl(v);
  if (more) view.append(siteLink(more, copy.viewOnSite));
  if (v.mode === "number") view.append(el("p", "caveat", shared.caveat));
}

function renderMulti(v: PanelView): void {
  if (!data) return;
  const found = v.groups.filter((g) => g.hits.length).length;
  status.textContent = copy.multiSummary(v.groups.length, found);
  for (const group of v.groups) {
    const section = el("section", group.hits.length ? "group" : "group is-miss");
    const head = el("div", "group-head");
    head.append(el("span", "token", group.token), el("span", "group-count", group.hits.length ? copy.inCatalogue(group.hits.length) : copy.notInCatalogue));
    section.append(head);
    const nq = group.token.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    for (const i of group.hits) section.append(row(data.rows[i], nq));
    view.append(section);
  }
  const all = v.groups.map((g) => g.token).join(",");
  view.append(button(lookupUrl(lang, all), copy.multiGo, "btn"));
  view.append(el("p", "caveat", shared.caveat));
}

function renderEmpty(v: PanelView): void {
  status.textContent = "";
  const box = el("div", "empty");
  const badge = el("div", "empty-badge");
  badge.append(icon("none", "ic"));
  box.append(badge, el("p", "empty-title", shared.noMatch.replace(/\.$/, "")));
  const raw = state.query.trim();
  const ask = v.mode === "number" || !raw ? lookupUrl(lang, raw) : shopUrl(raw);
  box.append(button(ask, shared.ask.replace(/\s*→\s*$/, ""), "btn"));
  if (state.car || state.cat) {
    const wide = el("button", "btn-quiet", copy.searchEverything);
    wide.type = "button";
    wide.dataset.action = "clear-filters";
    box.append(wide);
  }
  view.append(box);
}

function thumb(path: string, size: number): HTMLImageElement {
  const img = el("img", "thumb");
  img.src = imageUrl(path);
  img.alt = "";
  img.width = size;
  img.height = size;
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  img.addEventListener("error", () => img.classList.add("is-broken"), { once: true });
  return img;
}

function row(r: OeWidgetRow, nq: string): HTMLElement {
  const card = el("article", "row");
  const link = el("a", "row-link");
  link.href = partUrl(lang, r.slug);
  link.target = "_blank";
  link.rel = "noopener";
  link.setAttribute("aria-label", copy.openPart(r.name));
  card.append(link);
  const pic = el("div", "row-pic");
  if (r.img) pic.append(thumb(r.img, 56));
  card.append(pic);

  const body = el("div", "row-body");
  body.append(el("p", "row-name", displayName(r.name)));
  const fits = el("p", "row-fits");
  for (const f of splitFits(r.fits)) {
    const seg = el("span", "fit");
    seg.append(document.createTextNode(f.car));
    if (f.years) seg.append(document.createTextNode(" "), el("span", "years", f.years));
    fits.append(seg);
  }
  body.append(fits);

  const chips = el("div", "chips");
  const list = panelChips(r, nq);
  for (const c of list) {
    const chip = el("button", `chip${c.hit ? " is-hit" : ""}${c.extra ? " is-extra" : ""}`, c.oe);
    chip.type = "button";
    chip.dataset.oe = c.oe;
    chip.title = copy.copy;
    chips.append(chip);
  }
  const extra = list.filter((c) => c.extra).length;
  if (extra) {
    const more = el("button", "chip chip-more", copy.more(extra));
    more.type = "button";
    more.dataset.action = "expand";
    chips.append(more);
  }
  body.append(chips);
  card.append(body, icon("go", "ic row-go"));
  navRows.push(card);
  return card;
}

function button(href: string, text: string, className: string): HTMLAnchorElement {
  const a = el("a", className, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

function siteLink(href: string, text: string): HTMLAnchorElement {
  const a = button(href, "", "site-link");
  a.append(document.createTextNode(text), icon("go", "ic"));
  return a;
}

/** The shop's search, which reads #parts-hub?q=&model=&category= (src/components/PartsHub.tsx). */
function shopUrl(q: string): string {
  const params = [q && `q=${encodeURIComponent(q)}`, state.car && `model=${encodeURIComponent(state.car)}`, state.cat && `category=${encodeURIComponent(state.cat)}`]
    .filter(Boolean)
    .join("&");
  return siteUrl(lang, "/shop/", `#parts-hub${params ? `?${params}` : ""}`);
}

/** Where "View on maplev.ca" goes: the shelf's own page when it has one, else the shop or the lookup. */
function moreUrl(v: PanelView): string {
  if (!data) return "";
  const raw = state.query.trim();
  if (v.mode === "number") return lookupUrl(lang, raw);
  if (v.mode === "filter" && state.car) {
    const shelf = data.landings[`${state.car}|${state.cat}`];
    if (shelf) return siteUrl(lang, shelf);
  }
  return shopUrl(raw);
}

// ── keyboard and pointer ────────────────────────────────────────────────────────────────

function setActive(next: number, scroll: boolean): void {
  if (active >= 0 && navRows[active]) navRows[active].classList.remove("is-active");
  active = next;
  const node = navRows[active];
  if (!node) return;
  node.classList.add("is-active");
  if (scroll) node.scrollIntoView({ block: "nearest" });
}

function openActive(): void {
  const node = navRows[active >= 0 ? active : 0];
  const link = node?.querySelector<HTMLAnchorElement>("a.row-link");
  if (link) link.click();
}

input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" && navRows.length) {
    e.preventDefault();
    setActive(Math.min(active + 1, navRows.length - 1), true);
  } else if (e.key === "ArrowUp" && navRows.length) {
    e.preventDefault();
    setActive(Math.max(active - 1, 0), true);
  } else if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    openActive();
  } else if (e.key === "Escape" && input.value) {
    e.preventDefault();
    setQuery("", false);
  }
});

input.addEventListener("input", () => {
  state.query = input.value;
  render();
  content.scrollTop = 0;
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  e.preventDefault();
  input.focus();
  input.select();
});

// Hover and keyboard share ONE highlight, so the panel never shows two "current" rows.
view.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  const card = (e.target as HTMLElement).closest<HTMLElement>(".row");
  if (!card) return;
  const i = navRows.indexOf(card);
  if (i >= 0 && i !== active) setActive(i, false);
});

view.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const chip = target.closest<HTMLButtonElement>("button.chip[data-oe]");
  if (chip) {
    void copyNumber(chip);
    return;
  }
  const action = target.closest<HTMLElement>("[data-action]");
  if (action?.dataset.action === "expand") {
    action.closest(".chips")?.classList.add("is-open");
    action.remove();
    return;
  }
  if (action?.dataset.action === "clear-filters") {
    state.car = carSel.value = "";
    state.cat = catSel.value = "";
    render();
    input.focus();
    return;
  }
  const shelf = target.closest<HTMLButtonElement>("button.shelf");
  if (shelf?.dataset.cat) {
    catSel.value = shelf.dataset.cat;
    state.cat = catSel.value;
    render();
    content.scrollTop = 0;
  }
});

async function copyNumber(chip: HTMLButtonElement): Promise<void> {
  const oe = chip.dataset.oe || "";
  let ok = false;
  try {
    await navigator.clipboard.writeText(oe);
    ok = true;
  } catch {
    try {
      const ta = el("textarea");
      ta.value = oe;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (ok) {
    chip.classList.remove("is-copied");
    void chip.offsetWidth; // restart the confirmation even on a second quick click
    chip.classList.add("is-copied");
  }
  toast(ok ? copy.copied(oe) : copy.copyFailed);
}

let toastTimer = 0;
function toast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.add("is-on");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("is-on"), 1800);
}

carSel.addEventListener("change", () => {
  state.car = carSel.value;
  render();
});
catSel.addEventListener("change", () => {
  state.cat = catSel.value;
  render();
  content.scrollTop = 0;
});
carX.addEventListener("click", () => {
  state.car = carSel.value = "";
  render();
});
catX.addEventListener("click", () => {
  state.cat = catSel.value = "";
  render();
});
clearBtn.addEventListener("click", () => {
  setQuery("", false);
  input.focus();
});

/** A lookup from the right-click menu replaces the search and drops the filters: it is explicit. */
function setQuery(q: string, fromMenu: boolean): void {
  input.value = q;
  state.query = q;
  if (fromMenu) {
    state.car = carSel.value = "";
    state.cat = catSel.value = "";
  }
  render();
  content.scrollTop = 0;
  if (fromMenu) {
    // Show the start of what was looked up (the first number), not the end of a long selection.
    input.focus();
    input.setSelectionRange(0, 0);
    input.scrollLeft = 0;
  }
}

// Content scrolling under the controls gets a soft edge instead of a hard divider.
content.addEventListener(
  "scroll",
  () => {
    document.documentElement.classList.toggle("is-scrolled", content.scrollTop > 2);
  },
  { passive: true },
);

// ── messages from the right-click menu (background.js) ─────────────────────────────────

/** runtime.sendMessage, promise-shaped: Firefox's `browser` takes no callback, Chrome's does. */
function ask(msg: unknown): Promise<unknown> {
  const g = globalThis as { browser?: Ext; chrome?: Ext };
  const firefox = g.browser?.runtime?.sendMessage;
  if (firefox) return Promise.resolve(firefox.call(g.browser!.runtime, msg)).catch(() => null);
  const runtime = g.chrome?.runtime;
  if (!runtime?.sendMessage) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      runtime.sendMessage!(msg, (res: unknown) => {
        void runtime.lastError; // "no receiver" is fine: nothing was pending
        resolve(res ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

ext.runtime?.onMessage?.addListener((msg, _sender, send) => {
  const m = msg as { type?: string; q?: unknown };
  if (m && m.type === "maplev:lookup" && typeof m.q === "string") {
    setQuery(m.q.slice(0, 2000), true);
    send({ ok: true });
  }
});

// ── boot ────────────────────────────────────────────────────────────────────────────────

function staticText(): void {
  document.documentElement.lang = lang;
  document.title = `${copy.product} · MapleV`;
  input.placeholder = copy.placeholder;
  input.setAttribute("aria-label", shared.inputLabel);
  clearBtn.setAttribute("aria-label", copy.clear);
  carSel.setAttribute("aria-label", shared.carLabel);
  catSel.setAttribute("aria-label", shared.partLabel);
  carX.setAttribute("aria-label", copy.clearCar);
  catX.setAttribute("aria-label", copy.clearPart);
  openSite.setAttribute("aria-label", copy.openSite);
  openSite.title = copy.openSite;
  $<HTMLAnchorElement>("brand").href = siteUrl(lang, "/");
  const credit = $("credit");
  credit.textContent = copy.credit;
  if (new URLSearchParams(location.search).get("popup") === "1") document.documentElement.classList.add("is-popup");
}

async function boot(): Promise<void> {
  staticText();
  const bundled = await loadBundled();
  if (bundled) setData(bundled);
  render();
  input.focus();
  const pending = (await ask({ type: "maplev:pending" })) as { q?: unknown } | null;
  if (pending && typeof pending.q === "string" && pending.q) setQuery(pending.q.slice(0, 2000), true);
  void refreshFromSite();
}

window.addEventListener("focus", () => {
  if (document.activeElement === document.body) input.focus();
});

void boot();
