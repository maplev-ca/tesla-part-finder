# Tesla Part Finder — free Tesla Model 3 and Model Y part number lookup (browser extension, PWA, embed)

**Find Tesla Model 3 and Model Y collision parts** by car, part type or Tesla OE part
number: in a panel docked to the side of your browser (Chrome, Edge, Brave, Opera; the
sidebar in Firefox), from the right-click menu on any part number, as an app on your phone,
or in a box on your own website. Free, no account. Built by MapleV, a supplier of
aftermarket collision parts for Tesla vehicles in British Columbia, Canada; the data is the
open [Tesla OE cross-reference dataset](https://github.com/maplev-ca/tesla-oe-cross-reference),
which also lists Partslink numbers.

Keywords: Tesla part finder · Tesla OE part number lookup · Tesla Model 3 parts ·
Tesla Model Y parts · Partslink · collision parts · Chrome extension · Firefox add-on ·
PWA · Canada

![The part finder in the browser's side panel, next to a repair estimate](docs/screenshot.png)

## What it does

- Click the toolbar button (or press Alt+Shift+T): the finder opens in the browser's side
  panel. Pick the car and the part type, or type a Tesla OE number or a part name. Each
  result shows a photo, the model years it fits and its Tesla OE numbers. Click a number to
  copy it; click the part to open its page on maplev.ca.
- Select a part number on any web page (a collision estimate, a listing, a forum post),
  right-click and choose **Look up Tesla part number on MapleV**: the panel opens with the
  answer. Several numbers in one selection, a whole estimate, are listed one by one.
- Numbers work with or without dashes. The first seven digits list every version of a part.
- Keyboard: `/` to search, `↑` `↓` to move, `Enter` to open, `Esc` to clear.
- English and French, following the browser's language; light and dark, following the system.

## Install

- **Chrome, Edge, Brave, Opera:** install it from the Chrome Web Store —
  [MapleV Tesla Part Finder](https://chromewebstore.google.com/detail/maplev-tesla-part-finder/ikafmfglgogmlgmhpggamimpboclbnop).
  Edge and Brave install Chrome Web Store extensions too (Edge asks once to allow
  extensions from other stores); Opera needs its Install Chrome Extensions add-on first.
  To run this source instead: choose **Code → Download ZIP**,
  unzip it, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and
  pick the `extension` folder.
- **Firefox:** the store link will be added here once the listing is live.
- **iPhone and Android:** phones cannot install browser extensions, so the same finder
  installs as an app instead. Open
  [maplev.ca/embed/oe-lookup?src=pwa&install=1](https://maplev.ca/embed/oe-lookup?src=pwa&install=1):
  on Android, Chrome and Edge tap **Install**; on an iPhone, tap **Share**, then
  **Add to Home Screen**.

## Add the finder to your website

Paste this into any page that accepts HTML. It loads from maplev.ca, so new parts and
corrected numbers appear on your page with no work on your side.

```html
<iframe src="https://maplev.ca/embed/oe-lookup" title="Find a Tesla part" width="100%" height="540" loading="lazy" style="max-width:640px;border:1px solid #e5e5e5;border-radius:12px"></iframe>
<p style="margin:6px 0 0;font:13px/1.4 Arial,sans-serif;color:#555">Tesla part finder by <a href="https://maplev.ca/oe-lookup/">MapleV</a></p>
```

French:

```html
<iframe src="https://maplev.ca/embed/oe-lookup-fr" title="Trouver une pièce Tesla" width="100%" height="540" loading="lazy" style="max-width:640px;border:1px solid #e5e5e5;border-radius:12px"></iframe>
<p style="margin:6px 0 0;font:13px/1.4 Arial,sans-serif;color:#555">Recherche de pièces Tesla par <a href="https://maplev.ca/fr/oe-lookup/">MapleV</a></p>
```

More: [Free Tesla part finder](https://maplev.ca/guides/free-tesla-part-finder/).

## Privacy

- Two permissions, neither of which shows a warning: the right-click menu entry
  (`contextMenus`) and the side panel (`sidePanel`). No access to the pages you visit.
- The extension does not read or change the pages you visit, and it stores nothing.
- The text you select is only looked up in the panel, and only when you choose the menu entry.
- The panel downloads the public part list and the part photos from maplev.ca, without
  cookies, so new parts show up without an extension update.

Privacy policy: [maplev.ca/policies/privacy](https://maplev.ca/policies/privacy).

## What is in this repository

| Folder | Contents |
| --- | --- |
| `extension/` | The extension's files as packaged for the Chrome Web Store (also used for Edge and Opera). `panel.js` is built from `source/panel/` together with the search code of maplev.ca's own part finder; `data/` is a snapshot of the part list (the same rows as the open dataset); `fonts/` is Inter Tight under the SIL Open Font License (`fonts/OFL.txt`) |
| `firefox/manifest.json` | The manifest of the Firefox package (a sidebar instead of the side panel); every other file is the same as in `extension/` |
| `source/panel/` | The readable source of the side panel (`panel.ts`) and of its decisions (`logic.ts`) |
| `docs/` | Screenshot and store images |

The parts data the finder shows is also published as a dataset under CC BY 4.0, in the
`tesla-oe-cross-reference` repository.

## Not affiliated with Tesla

MapleV is an independent supplier of aftermarket replacement parts and is not
affiliated with, endorsed by, or authorized by Tesla, Inc. Tesla, Model 3 and Model Y
are trademarks of Tesla, Inc. OE numbers are shown for identification and
cross-reference only; a matching number is a search key, not proof of fit.

## Licence

© 2026 MapleV. All rights reserved; see [LICENSE](LICENSE). The font in `extension/fonts/`
is Inter Tight, under the SIL Open Font License 1.1 (`extension/fonts/OFL.txt`). Questions:
[maplev.ca/contact](https://maplev.ca/contact/).
