# 0009: The dashboard in Astro and Svelte; shared code as modules

**Status:** accepted, October 2026. Roadmap item 2.

**Context.** The dashboard was one HTML file with an 800-line `dom.js` that rebuilt each tab's HTML from strings. It was hard to grow. The roadmap's second item asked for Astro pages with small interactive islands, Svelte for the charts and forms, and the pure code kept and tested. The household display has to stay a single file that parses on TV browsers back to Chromium 63 ([0001](0001-single-file-pages.md), [0002](0002-tv-browsers.md)), and both use the same data code.

**Decision.**
- **Shared code is ES modules in `src/lib/`**, one per service:
  - `format` (constants, dates, money);
  - `browser` (lookups and per-device storage);
  - `net` (requests, the helper, errors);
  - `octopus`, `carbon`, `weather`, `pvgis`, `epc`;
  - `analysis`, moved across unchanged.

  The dashboard imports them. `build.py` still concatenates the ones the display needs into `display.html`, dropping the one-line imports and the `export` keywords, so the display is built as before. A test checks the modules keep to what can be flattened. The display's own scripts stay plain scripts.
- **The dashboard is five Astro pages:** `index` (Overview), `patterns`, `prices`, `compare` and `home`. They share a layout (`src/layouts/Dashboard.astro`) with the bridge, the tabs as links, and the footer. Each panel is a small Svelte 5 island (`src/components/`), and `BarChart.svelte` replaces the SVG string builder.
- **One state object** (`src/state/app.svelte.js`) holds what the islands share: the account data, prices, the period and the household's lists. Account data is held raw (not deeply reactive) and replaced whole when it changes, so rolling up thousands of readings stays quick.
- **A cache across pages** (`src/state/session.js`, `cache.js`). The account's data, with its weather and price history, goes in IndexedDB, which keeps Maps and `Infinity` intact.
  - Moving between pages reads it back instead of fetching again.
  - It's fetched again after half an hour, on Refresh, or when the account changes.
  - Prices and the grid forecast keep for ten minutes. Forgetting your details clears it.
- **Works at any address.** Pages are built as files at one level (`build.format: 'file'`). `scripts/relative.mjs` then makes the asset paths relative, so the same build works on GitHub Pages under `/home-display/` and from the home server helper at `/`.
- **Building and publishing:**
  - `npm run build` makes both: `python3 build.py`, then `astro build`.
  - `dist/` isn't committed; CI builds it. `display.html` is still committed, so it opens from disk.
  - `publish.sh` copies `dist/` and the display into the published folder, and StatiCrypt locks every page.
  - `server.py` serves `dist/` first, then the repository folder.

**Consequences.**
- The dashboard looks and works as before, page for page. Its panels are now components that can grow on their own.
- The dashboard no longer opens straight from disk: its scripts are modules, which browsers won't load from `file://`. It needs Octopus over the network anyway. The display still opens from disk.
- Dashboard components and state may use modern syntax. Code in `src/lib/` and `src/display/` must still parse on Chromium 63.
- New dependencies, for development only: Astro, Svelte and the Svelte integration, pinned exactly.
- Tests:
  - every page on a phone and a TV;
  - the controls;
  - the account fetched once across pages;
  - the locked site's islands starting after the PIN.
