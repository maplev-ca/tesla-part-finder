// v1.1 — the side panel's decisions, kept apart from the DOM so the tests can drive them.
// (Published with the extension's source: no names or internal notes in comments.)
//
// The panel is docked to the right edge of the browser, looks like MapleV (logo, type) and
// follows Apple's interface guidelines for feedback and motion. The search itself is NOT
// re-implemented here: it is the website finder's own matcher (src/lib/oeWidget.ts →
// widgetFind), bundled in by scripts/pack-extension.mjs, so the panel, /embed/oe-lookup and
// /oe-lookup/ answer alike.
//
// What a row may show is what the website widget may show: name, cars and years, Tesla OE
// numbers, category, first photo. Never a price, stock or a supplier.
import {
  OE_WIDGET_COPY,
  widgetFind,
  widgetFitsCar,
  widgetKey,
  widgetMainPartsFirst,
  widgetRowKeys,
  type OeWidgetData,
  type OeWidgetLang,
  type OeWidgetRow,
} from "../../src/lib/oeWidget";

export interface PanelInput {
  query: string;
  car: string;
  cat: string;
}

export interface PanelGroup {
  /** A part number found in what was pasted, as written ("1514952-00-E"). */
  token: string;
  /** Rows that answer to it, best first. */
  hits: number[];
}

/**
 * What the panel shows:
 *   idle   — nothing typed and no part type picked: the shelves (part types) with counts,
 *            for the picked car if there is one — browsing, not a wall of 120 rows
 *   filter — a part type picked, nothing typed: that shelf
 *   number — one part number: the /oe-lookup/ rule
 *   text   — words: the shop's matcher
 *   multi  — several part numbers pasted (an estimate): one group per number, in order
 */
export interface PanelView {
  mode: "idle" | "filter" | "number" | "text" | "multi";
  hits: number[];
  /** Normalized number query (number mode), for highlighting the matching OE chip. */
  nq: string;
  groups: PanelGroup[];
}

export const panelKeys = (data: Pick<OeWidgetData, "rows">): string[][] =>
  data.rows.map((row) => widgetRowKeys(row.oes, row.keys));

export function panelFind(
  data: Pick<OeWidgetData, "rows">,
  keysByRow: readonly (readonly string[])[],
  input: PanelInput,
  localized: (row: OeWidgetRow) => string = () => "",
): PanelView {
  const result = widgetFind(data, keysByRow, input, localized);
  if (result.mode === "multi") {
    const groups = result.tokens.map((token) => ({
      token,
      hits: widgetFind(data, keysByRow, { query: token, car: input.car, cat: input.cat }, localized).hits,
    }));
    return { mode: "multi", hits: [], nq: "", groups };
  }
  if (result.mode === "idle" || (result.mode === "filter" && !input.cat)) {
    return { mode: "idle", hits: [], nq: "", groups: [] };
  }
  return { mode: result.mode, hits: result.hits, nq: result.nq, groups: [] };
}

export interface PanelShelf {
  cat: string;
  label: string;
  count: number;
  /** Cover photo: the first main part (not a bracket or clip) on the shelf that has one. */
  img: string;
}

/** The part types, in the catalogue's front-to-back order, with how many parts fit `car`. */
export function panelShelves(data: Pick<OeWidgetData, "rows" | "cats">, car: string): PanelShelf[] {
  const shelves: PanelShelf[] = [];
  for (const option of data.cats) {
    const on: number[] = [];
    data.rows.forEach((row, i) => {
      if (row.cat === option.value && widgetFitsCar(row, car)) on.push(i);
    });
    if (!on.length) continue;
    const cover = widgetMainPartsFirst(data.rows, on).find((i) => data.rows[i].img);
    shelves.push({ cat: option.value, label: option.label, count: on.length, img: cover === undefined ? "" : data.rows[cover].img });
  }
  return shelves;
}

export interface PanelChip {
  oe: string;
  /** The searched number points at this OE (filled red). */
  hit: boolean;
  /** Folded behind "+N" until the row is expanded. */
  extra: boolean;
}

/**
 * A row's OE numbers as chips. A number search puts the matching numbers first and shows
 * up to three; browsing shows two — the buyer is reading names and photos there.
 */
export function panelChips(row: Pick<OeWidgetRow, "oes">, nq: string): PanelChip[] {
  const isHit = (oe: string) => {
    if (nq.length < 3) return false;
    const key = widgetKey(oe);
    return key.includes(nq) || (nq.includes(key) && key.length >= 7);
  };
  const ordered = nq ? [...row.oes].sort((a, b) => Number(isHit(b)) - Number(isHit(a))) : [...row.oes];
  let visible = nq ? 3 : 2;
  // A "+1" chip takes the same room as the number it hides — just show it.
  if (ordered.length - visible === 1) visible = ordered.length;
  return ordered.map((oe, i) => ({ oe, hit: isHit(oe), extra: i >= visible }));
}

/** How many parts fit `car` (all parts when no car is picked). */
export function panelCarCount(data: Pick<OeWidgetData, "rows">, car: string): number {
  return data.rows.filter((row) => widgetFitsCar(row, car)).length;
}

/**
 * A part name for display: a hyphen between two characters ("3-Pin") becomes a non-breaking
 * hyphen, so a line never ends in "(3-" with "Pin)" below. " - Left" keeps its spaces and wraps.
 */
export const displayName = (name: string): string => String(name).replace(/(\S)-(?=\S)/g, "$1‑");

export interface PanelFit {
  car: string;
  /** "2017–2023", "2024+" — years only; the part page carries the months. */
  years: string;
}

/** "Jun 2017 – Dec 2023" → "2017–2023"; "Jan 2024–" → "2024+"; anything else → "". */
export function compactYears(period: string): string {
  const [first = "", second = ""] = String(period).match(/\d{4}/g) || [];
  if (!first) return "";
  if (/[–-]\s*$/.test(period.trim())) return `${first}+`;
  if (second && second !== first) return `${first}–${second}`;
  return first;
}

/**
 * "Tesla Model 3, Tesla Model Y · Jun 2017 – Dec 2023 · Jan 2020 – Dec 2024" →
 * [{ car: "Model 3", years: "2017–2023" }, { car: "Model Y", years: "2020–2024" }].
 * When the counts do not pair up, every car is listed with the years left blank.
 */
export function splitFits(fits: string): PanelFit[] {
  const [head = "", ...periods] = String(fits || "").split(" · ");
  const cars = head
    .split(", ")
    .map((s) => s.replace(/^Tesla\s+/, "").trim())
    .filter(Boolean);
  if (cars.length === periods.length) return cars.map((car, i) => ({ car, years: compactYears(periods[i]) }));
  return cars.map((car) => ({ car, years: "" }));
}

const SLUG = /^[a-z0-9-]{1,200}$/;
const IMG = /^\/[A-Za-z0-9_./-]{1,300}$/;
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isOptions = (v: unknown) => Array.isArray(v) && v.every((o) => o && isStr(o.value) && isStr(o.label));

/**
 * The data the panel accepts from maplev.ca — the same shape /embed/oe-lookup carries. A row
 * whose slug or photo path is not a plain site path is refused, so nothing but our own pages
 * and photos can ever be linked from the panel. Anything malformed → null (keep what we have).
 */
export function acceptData(value: unknown): OeWidgetData | null {
  const d = value as OeWidgetData;
  if (!d || typeof d !== "object" || !Array.isArray(d.rows) || !d.rows.length) return null;
  if (typeof d.oes !== "number" || typeof d.parts !== "number" || !isOptions(d.cars) || !isOptions(d.cats)) return null;
  if (!d.landings || typeof d.landings !== "object") return null;
  for (const row of d.rows) {
    if (!row || !isStr(row.name) || !isStr(row.fits) || !isStr(row.slug) || !SLUG.test(row.slug)) return null;
    if (!isStrList(row.oes) || !isStrList(row.keys) || !isStrList(row.models) || !isStr(row.cat)) return null;
    if (!isStr(row.img) || (row.img && (!IMG.test(row.img) || row.img.includes("..")))) return null;
    if (!row.find || !isStr(row.find.nameEn) || !isStr(row.find.id)) return null;
  }
  for (const path of Object.values(d.landings)) {
    if (!isStr(path) || !/^\/[a-z0-9/-]{1,200}$/.test(path)) return null;
  }
  return d;
}

/** The panel's own words (the shared ones come from OE_WIDGET_COPY, the website widget's). */
export interface PanelCopy {
  product: string;
  placeholder: string;
  openSite: string;
  clear: string;
  clearCar: string;
  clearPart: string;
  shelvesTitle: string;
  hint: (oes: number, parts: number) => string;
  carCount: (n: number, car: string) => string;
  tipMenu: string;
  tipPaste: string;
  multiSummary: (numbers: number, found: number) => string;
  inCatalogue: (n: number) => string;
  notInCatalogue: string;
  multiGo: string;
  copy: string;
  copied: (oe: string) => string;
  copyFailed: string;
  more: (n: number) => string;
  viewOnSite: string;
  searchEverything: string;
  openPart: (name: string) => string;
  credit: string;
}

export const PANEL_COPY: Record<OeWidgetLang, PanelCopy> = {
  en: {
    product: "Tesla Part Finder",
    placeholder: "Part number or name",
    openSite: "Open the full lookup on maplev.ca",
    clear: "Clear search",
    clearCar: "Show all cars",
    clearPart: "Show all parts",
    shelvesTitle: "Browse by part",
    hint: (oes, parts) => `${oes} Tesla OE numbers across ${parts} parts`,
    carCount: (n, car) => `${n} part${n === 1 ? "" : "s"} for the ${car}`,
    tipMenu: "Select a part number on any page, right-click, and choose “Look up Tesla part number on MapleV”.",
    tipPaste: "Paste a whole estimate — every Tesla part number in it is looked up at once.",
    multiSummary: (numbers, found) => `${numbers} part numbers · ${found} in our catalogue`,
    inCatalogue: (n) => `${n} part${n === 1 ? "" : "s"}`,
    notInCatalogue: "Not in our catalogue",
    multiGo: "Look them all up on maplev.ca",
    copy: "Copy",
    copied: (oe) => `Copied ${oe}`,
    copyFailed: "Couldn’t copy — select the number instead",
    more: (n) => `+${n}`,
    viewOnSite: "View on maplev.ca",
    searchEverything: "Search all cars and parts",
    openPart: (name) => `${name} — open on maplev.ca`,
    credit: "Data: MapleV · Not affiliated with Tesla, Inc.",
  },
  fr: {
    product: "Recherche de pièces Tesla",
    placeholder: "Numéro ou nom de pièce",
    openSite: "Ouvrir la recherche complète sur maplev.ca",
    clear: "Effacer la recherche",
    clearCar: "Tous les véhicules",
    clearPart: "Toutes les pièces",
    shelvesTitle: "Parcourir par pièce",
    hint: (oes, parts) => `${oes} numéros OE Tesla pour ${parts} pièces`,
    carCount: (n, car) => `${n} pièce${n > 1 ? "s" : ""} pour la ${car}`,
    tipMenu: "Sélectionnez un numéro de pièce sur n’importe quelle page, clic droit, puis « Chercher ce numéro de pièce Tesla sur MapleV ».",
    tipPaste: "Collez une estimation entière : tous les numéros de pièce Tesla qu’elle contient sont cherchés d’un coup.",
    multiSummary: (numbers, found) => `${numbers} numéros de pièce · ${found} dans notre catalogue`,
    inCatalogue: (n) => `${n} pièce${n > 1 ? "s" : ""}`,
    notInCatalogue: "Pas dans notre catalogue",
    multiGo: "Tous les chercher sur maplev.ca",
    copy: "Copier",
    copied: (oe) => `${oe} copié`,
    copyFailed: "Copie impossible — sélectionnez le numéro",
    more: (n) => `+${n}`,
    viewOnSite: "Voir sur maplev.ca",
    searchEverything: "Chercher dans tous les véhicules et pièces",
    openPart: (name) => `${name} — ouvrir sur maplev.ca`,
    credit: "Données : MapleV · Non affiliée à Tesla, Inc.",
  },
};

export { OE_WIDGET_COPY };
