// Background (Chrome/Edge service worker; Firefox background script).
//
// v1.1: the finder opens docked to the browser's right edge instead of a small popup. The
// toolbar button (and Alt+Shift+T) opens panel.html as the Chrome/Edge side panel or the Firefox
// sidebar; a browser with neither gets the same page as a popup. The right-click entry opens
// the panel and hands it the selected part number(s).
// (This file ships as-is in the public store package: no names or internal notes in comments.)
//
// Nothing is stored and nothing runs on web pages. A right-clicked selection is held in memory
// for at most 30 seconds, only until the panel that is opening asks for it.
import { extractPartNumbers, lookupUrl, uiLang } from "./config.js";

// Feature tests, never "which browser": Chrome 151 also defines `browser` (the WebExtensions
// namespace) — testing for it sent Chrome to the popup fallback (caught 2026-10-04 in headless
// Chrome 151 before any release). `promised` = the promise-returning namespace when there is one.
const promised = typeof globalThis.browser !== "undefined" && globalThis.browser.runtime ? globalThis.browser : null;
const api = promised || globalThis.chrome;
const sidePanel = globalThis.chrome && globalThis.chrome.sidePanel && globalThis.chrome.sidePanel.open ? globalThis.chrome.sidePanel : null;
const sidebar = !sidePanel && promised && promised.sidebarAction ? promised.sidebarAction : null;

const MENU_ID = "maplev-lookup-selection";
const PENDING_MS = 30000;
let pending = null; // { q, at }

if (sidePanel) {
  sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
} else if (sidebar) {
  api.action.onClicked.addListener(() => {
    sidebar.toggle();
  });
} else {
  api.action.setPopup({ popup: "panel.html?popup=1" });
}

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({
    id: MENU_ID,
    title: api.i18n.getMessage("menuLookup"),
    contexts: ["selection"],
  });
});

/** runtime.sendMessage, promise-shaped (`browser` takes no callback; an older Chrome's `chrome` does). */
function send(msg) {
  if (promised) return Promise.resolve(promised.runtime.sendMessage(msg)).catch(() => null);
  return new Promise((resolve) => {
    try {
      api.runtime.sendMessage(msg, (res) => {
        void api.runtime.lastError; // no panel open yet — it will ask (maplev:pending)
        resolve(res || null);
      });
    } catch {
      resolve(null);
    }
  });
}

function openInTab(text) {
  api.tabs.create({ url: lookupUrl(uiLang(), text) });
}

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const selection = String(info.selectionText || "").trim().slice(0, 2000);
  const numbers = extractPartNumbers(selection);
  const query = numbers ? numbers.split(",").join(", ") : selection.slice(0, 200);

  // Open first and synchronously: browsers allow it only inside the click itself.
  if (sidePanel && tab && typeof tab.windowId === "number") {
    sidePanel.open({ windowId: tab.windowId }).catch(() => {
      pending = null;
      openInTab(numbers || selection.slice(0, 200));
    });
  } else if (sidebar) {
    sidebar.open();
  } else {
    openInTab(numbers || selection.slice(0, 200));
    return;
  }
  pending = { q: query, at: Date.now() };
  // A panel that is already open takes it now; one that is still starting asks for it.
  send({ type: "maplev:lookup", q: query }).then((res) => {
    if (res && res.ok) pending = null;
  });
});

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "maplev:pending") return undefined;
  const q = pending && Date.now() - pending.at < PENDING_MS ? pending.q : "";
  pending = null;
  sendResponse({ q });
  return undefined;
});

// Alt+Shift+T (Chrome/Edge). Firefox maps the same keys to _execute_sidebar_action instead.
if (sidePanel && api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener((command, tab) => {
    if (command !== "open-panel" || !tab || typeof tab.windowId !== "number") return;
    sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  });
}
