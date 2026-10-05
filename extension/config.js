// Where the finder's data and pages live. scripts/pack-extension.mjs rewrites ORIGIN for the
// local test build (a static server on 127.0.0.1); the published build always points at maplev.ca.
// SOURCE is the utm_source every link out of the extension carries, so the website's traffic
// report tells the extension apart from the website widget (src/lib/oeWidget.ts,
// OE_WIDGET_SOURCE_TOKENS lists the same token).
export const ORIGIN = "https://maplev.ca";
export const SOURCE = "chrome-extension";

const UTM = `utm_source=${SOURCE}&utm_medium=extension&utm_campaign=oe-lookup-extension`;

/** Language of the panel, the data and the links: French UI → French, everything else English. */
export function uiLang() {
  const lang = (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || (typeof navigator !== "undefined" && navigator.language) || "en";
  return /^fr\b/i.test(lang) ? "fr" : "en";
}

/** A page on maplev.ca in `lang`, tagged as the extension. `path` is site-relative ("/parts/x/"). */
export function siteUrl(lang, path, hash = "") {
  const prefix = lang === "fr" && !path.startsWith("/fr/") ? "/fr" : "";
  return `${ORIGIN}${prefix}${path}?${UTM}${hash}`;
}

/** A part's page: /parts/<slug>/ (French: /fr/parts/<slug>/). */
export function partUrl(lang, slug) {
  return siteUrl(lang, `/parts/${slug}/`);
}

/** The full lookup page (batch-capable: several numbers separated by commas). */
export function lookupUrl(lang, query) {
  const base = `${ORIGIN}${lang === "fr" ? "/fr" : ""}/oe-lookup/?${UTM}`;
  return query ? `${base}#q=${encodeURIComponent(query)}` : base;
}

/** The part list the panel refreshes from — the rows /embed/oe-lookup carries, as JSON. */
export function dataUrl(lang) {
  return `${ORIGIN}/embed/data/oe-lookup-${lang === "fr" ? "fr" : "en"}.json`;
}

/** A photo from the list: rows carry site-relative paths ("/parts/thumbs/…jpg"). */
export function imageUrl(path) {
  return path ? `${ORIGIN}${path}` : "";
}

/**
 * Tesla part numbers in a run of selected text: 7 digits, optionally the revision -XX-X —
 * written with dashes or nothing between (any case: 1514952-00-e, 151495200E), or with
 * single spaces only in capitals (1514952 00 E). Spaces are not allowed in lower case
 * because then ordinary words after a bare number were read as a revision: "1947151 and"
 * came out as 1947151-AN-D (caught 2026-10-02). Returns the numbers joined with commas,
 * which the lookup page's batch mode understands; an empty string when the selection holds
 * no number — the lookup then just runs on the raw selection.
 */
export function extractPartNumbers(text) {
  const out = [];
  const re = /\b(\d{7})(?:-?([0-9A-Za-z]{2})-?([A-Za-z])|\s([0-9A-Z]{2})\s([A-Z]))?\b/g;
  let m;
  while ((m = re.exec(String(text || ""))) !== null) {
    const mid = m[2] || m[4];
    const rev = m[3] || m[5];
    const full = mid && rev ? `${m[1]}-${mid.toUpperCase()}-${rev.toUpperCase()}` : m[1];
    if (!out.includes(full)) out.push(full);
    if (out.length >= 50) break;
  }
  return out.join(",");
}
