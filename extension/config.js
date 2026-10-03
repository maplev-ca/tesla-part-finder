// Where the finder lives. scripts/pack-extension.mjs rewrites ORIGIN for the local
// test build (wrangler on 127.0.0.1); the published build always points at maplev.ca.
// SOURCE is the ?src= token the embed page accepts (src/lib/oeWidget.ts,
// OE_WIDGET_SOURCE_TOKENS) so the website's traffic report tells the extension apart
// from the website widget.
export const ORIGIN = "https://maplev.ca";
export const SOURCE = "chrome-extension";

/** Language of the frame and links: French UI → the French pages, everything else English. */
export function uiLang() {
  const lang = (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language || "en";
  return /^fr\b/i.test(lang) ? "fr" : "en";
}

export function embedUrl(lang) {
  return `${ORIGIN}/embed/oe-lookup${lang === "fr" ? "-fr" : ""}?src=${SOURCE}`;
}

export function lookupUrl(lang, query) {
  const base = `${ORIGIN}${lang === "fr" ? "/fr" : ""}/oe-lookup/?utm_source=${SOURCE}&utm_medium=extension&utm_campaign=oe-lookup-extension`;
  return query ? `${base}#q=${encodeURIComponent(query)}` : base;
}

/**
 * Tesla part numbers in a run of selected text: 7 digits, optionally the revision -XX-X —
 * written with dashes or nothing between (any case: 1514952-00-e, 151495200E), or with
 * single spaces only in capitals (1514952 00 E). Spaces are not allowed in lower case
 * because then ordinary words after a bare number were read as a revision: "1947151 and"
 * came out as 1947151-AN-D (caught 2026-10-02). Returns the numbers joined with commas,
 * which the lookup page's batch mode understands; an empty string when the selection holds
 * no number — the lookup page then just opens with the raw selection as the query.
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
