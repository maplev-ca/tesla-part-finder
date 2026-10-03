// Popup: the embeddable finder (maplev.ca/embed/oe-lookup) in a frame, plus a link to the
// full page for pasting a whole estimate. If the frame has not loaded after a few seconds
// (offline, blocked network) the popup says so instead of staying blank.
import { embedUrl, lookupUrl, uiLang } from "./config.js";

const lang = uiLang();
const msg = (key) => (chrome.i18n && chrome.i18n.getMessage(key)) || "";

const frame = document.getElementById("finder");
const offline = document.getElementById("offline");
const full = document.getElementById("full");
const na = document.getElementById("na");

full.href = lookupUrl(lang);
full.textContent = msg("openFull") || "Open the full lookup";
na.textContent = msg("notAffiliated") || "Not affiliated with Tesla, Inc.";

let loaded = false;
frame.addEventListener("load", () => {
  loaded = true;
  offline.hidden = true;
});
frame.src = embedUrl(lang);

setTimeout(() => {
  if (loaded) return;
  offline.hidden = false;
  offline.textContent = msg("offline") || "Can't reach maplev.ca right now.";
  const a = document.createElement("a");
  a.href = lookupUrl(lang);
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = " maplev.ca/oe-lookup";
  offline.append(a);
}, 6000);
