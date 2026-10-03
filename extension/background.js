// Service worker: one context-menu entry on selected text → the lookup page with the
// selected part number(s). Nothing is stored, nothing runs on web pages.
import { extractPartNumbers, lookupUrl, uiLang } from "./config.js";

const MENU_ID = "maplev-lookup-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: chrome.i18n.getMessage("menuLookup"),
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const selection = String(info.selectionText || "").trim().slice(0, 2000);
  const numbers = extractPartNumbers(selection);
  const query = numbers || selection.slice(0, 200);
  chrome.tabs.create({ url: lookupUrl(uiLang(), query) });
});
