# Harold Street Energy: project brief for Claude Code

Kyle's home dashboard for his Octopus Energy account on Harold Street, Stockport (Octopus region G, North West England). It started as a single HTML file and is growing into a household display site that runs on phones, a wall tablet and the smart TV.

Read `ROADMAP.md` for what's next, `docs/decisions/` for why things are the way they are, `docs/log.md` for what changed when, and `docs/` for the stack choices and API details.

## Workflow

Kyle has given standing permission to develop, test and push to `main` without checking in. There is no home server: everything must work from GitHub Pages in a browser ([decision 0004](docs/decisions/0004-no-home-server.md)).
- **Before every push:** `npm run ci` must be green.
- **After pushing:** a push to `main` publishes to GitHub Pages (https://kylelookingaround.github.io/home-display/). Check that the workflow run and its Pages deploy succeed and that the live site loads, then report what changed.
- **Records:** add a dated bullet to `docs/log.md` for anything that changes behaviour (newest first: **Creation**, **Update**, **Finding**, **Deprecation**). Add a decision record in `docs/decisions/` when choosing between approaches.
- **Looking:** after changing anything visual, look at the screenshots from `npm run shots` (`tests/screens/`), not just the test results.

## What exists now

- **The dashboard:** Astro pages with Svelte 5 islands, built into `dist/` by `npm run build` ([decision 0009](docs/decisions/0009-astro-dashboard.md)). `dist/` isn't committed; CI builds it.
- **`display.html`, the household display:** one self-contained built file, committed, that opens straight from disk. `python3 build.py` makes it. Never edit it directly.
- `npm run build` makes both: `build.py`, then `astro build`, then `scripts/relative.mjs` (relative asset paths, so the site works at any address).
- `src/`: the source.
  - `lib/`: ES modules shared by both, one per service. The dashboard imports them; `build.py` flattens the ones the display needs, dropping the one-line imports and `export` keywords. Keep imports on one line, from `./module.js`, and export only declarations; a test checks.
    - `format.js`: constants, dates, money and number formatting, `nz`, `niceScale`.
    - `browser.js`: `$`, `$$` and `store` (per-device `localStorage`, keys prefixed `hse.`).
    - `net.js`: `request`, `NET`, `detectProxy`, `errorText`.
    - `octopus.js`: Octopus REST and GraphQL (rates, consumption, products, the account, the Home Mini, rewards).
    - `carbon.js`, `weather.js`, `pvgis.js`, `epc.js`: the other services.
    - `analysis.js`: pure functions with no DOM. Example data, the period roll-up, spikes, weather regression, projections, tariff comparison, battery and solar simulators, and `cheapestWindow`.
  - `pages/`: the dashboard's five pages: `index` (Overview), `patterns`, `prices`, `compare`, `home`. Each is a list of islands.
  - `layouts/Dashboard.astro`: the head, starfield, bridge, tabs (links, `aria-current`) and footer around every page.
  - `components/`: one Svelte island per panel, plus:
    - `Bridge.svelte`: header, status, account settings, notices, and the negative price alert and notifications.
    - `BarChart.svelte`: the SVG bar chart; tap, point or arrow to read a bar, `bind:selected`.
    - `Example.svelte`: the Example tag.
  - `state/`:
    - `app.svelte.js`: the one state object every island shares. Account data is `$state.raw`, replaced whole; `model` and `reg` are derived.
    - `session.js`: `boot()` once per page; `refresh`, `loadPrices`, `connect`, `forget`.
    - `cache.js`: IndexedDB, keeping account data across pages for half an hour and prices for ten minutes.
  - `styles/dashboard.css`: the dashboard's design tokens on `:root` and its classes, global.
  - `display/head.html`, `display/body.html`: the display's CSS (ten-foot rules) and markup for its five modes, toolbar and settings sheet.
  - `display/cockpit.js`: the screensaver, a side window onto space. It decides when and where things appear. Everything has a depth, and slides past at the ship's speed divided by it (`speedAt`; `readableAt` caps it for text). Layers, back to front:
    - `cSpace` canvas: the backdrop (sky, far and middle stars and both nebulae, baked together into one picture two screens wide and slid along), near stars, sun, comets, moon, aurora (painted small, stretched), planets, traffic, the house, wildlife, the ISS.
    - `cAhead` canvas, sharp at any tier: the road ahead (`drawAhead`), the next twelve hours along the window, now on the left, and the train's rail and platform. The price landscape, weather fronts, calendar beacons and the fuel dock, with canvas labels that stack rather than overlap ([decision 0007](docs/decisions/0007-time-is-distance.md)).
    - `cBoards`: DOM billboards and the space train, in 3D. Your own train stops at a platform when it's time to leave.
    - `cNear` canvas: huge things sweeping past, dust, warp streaks, debris, rain outside.
    - `cShip`: the glass (rain, snow, frost, fog), the frame and the dashboard, with its dials.
    - `TIERS` set canvas resolution, frames a second and how often the road ahead redraws. TVs start lower, any screen steps down when it can't keep up, and Settings or `detail=low|high` can fix it ([decision 0008](docs/decisions/0008-drawing-for-tvs.md)). Lower tiers add `body.lite`, which drops blurred shadows and looping animations. Don't add full-screen layers drawn every frame: bake slow things into the backdrop. Check with `BENCH=1 node --test --test-name-pattern="frame budget" tests/display.browser.mjs` (CPU slowed six times).
    - It shows a still frame under reduced motion.
  - `display/scenery.js`: how each thing is drawn, with no timing: noise, planets and rings, the moon's phase, ships, the ISS, the house on its asteroid, whales, jellyfish, birds, comets.
  - `display/sources.js`: the display's household data, mostly pure.
    - The cockpit's logic: `skyFor`, `engineFor`, `buildBillboards`, `billboardRotation`, `boardCards` (what goes on billboards rather than the train), `worldFor` (aurora, comet, moon, ISS, the house) with `moonPhase` and `issPass`, `voyageFor` (the road ahead) with `shownAhead`, and `instrumentsFor` with `recordCost` and `usualCost` (the cabin's dials).
    - Huxley2 trains, and household settings merging.
    - Modes, night window and settings defaults.
    - Bins, weather, and the iCal parser and `RRULE` expansion.
    - Realtime Trains and TfGM parsing, leave-by countdowns, today's cost.
    - Nightly reload and staleness.
  - `display/display.js`: the display's data scheduler (`SRC`: each source has its own refresh period and backs off on failure), mode switching, remote control and spatial navigation, screensaver motion, night mode and the settings sheet.
  - `starfield.js`: the animated background, on both pages. It rests while the screensaver covers it.
- `server.py`: optional stdlib-only home server helper.
  - It serves the folder (never dotfiles, `.py` or `.md`) and proxies a fixed allowlist of hosts under `/proxy/<name>/…`.
  - It holds the train and tram keys from `.env` or the environment: `RTT_TOKEN` or `RTT_REFRESH_TOKEN`, and `TFGM_KEY`. `GET /proxy/status` says which are set.
  - Pages detect it with `GET ./proxy/ping`, and from then on all Octopus calls go through it.
  - It serves the built dashboard from `dist/` first, then the folder.
- `scripts/bins.mjs`: fetches the next bin collections from Stockport Council for the UPRN in the `STOCKPORT_UPRN` secret, and writes `bins.json`. The workflow runs it every Saturday morning (tests skipped) and publishes the result with the site. The bins' repeats live in `household.json`; `mergeBins` restarts each from the council's latest date while the feed is under ten days old ([decision 0006](docs/decisions/0006-council-bins.md)). The UPRN is the address: never commit it.
- `household.json`: settings every screen shares (bins, station, default mode), editable on GitHub and published with the site. Nothing private goes in it. Each screen stores only its own changes on top.
- `package.json`: `npm run ci` runs everything CI runs. The dependencies are all for development: Astro, Svelte, the Svelte integration and Playwright, pinned exactly.
- `lock/`: `template.html` is the StatiCrypt lock screen (PIN keypad, remote-friendly). `publish.sh` builds `_site/` for Pages (`dist/`, the display, `household.json`, icons) and locks every page when `SITE_PASSWORD` is set.
- `.github/workflows/pages.yml`: checks every push, and publishes `main` to GitHub Pages. It also runs every Saturday morning to check the bin dates.
- `tests/`:
  - `*.test.mjs`: unit tests with no dependencies. `analysis.test.mjs` covers the maths. `display.test.mjs` covers the display's logic, the TV syntax check and "built pages match the source".
  - `display.browser.mjs`: Playwright, on fixed fake data with the clock held, serving `dist/` then the repository. Phone and 1080p layouts, 24px text, the remote, the idle screensaver, the night clock, setup links; the dashboard's pages at both sizes, its controls and its cache.
  - `lock.browser.mjs`: builds a locked site with a test PIN, unlocks it, and checks the dashboard's islands start.

## Display modes

Energy, Home, Travel, Screensaver (the cockpit, which new screens open on), Night. The mode comes from the link (`display.html#home`) or the screen's own setting. Extras after the mode preview the cockpit: `#screensaver&wx=rain&phase=night&price=-3&show=train,house`. `wx` is clear, cloud, rain, drizzle, snow, fog, thunder, wind or cold; `phase` is dawn, day, dusk or night. The screensaver and night clock also take over automatically as overrides that don't change the link. Settings live in `localStorage` under `hse.display` on each device, and a setup link (`#setup=<base64 JSON>`) copies them between devices.

## Dashboard pages

- **Overview**: tariffs, period totals, daily chart with change-log markers, bill tracker and Direct Debit check, price cap countdown, Saving Sessions and Octoplus, weekly log.
- **Patterns**: electricity and gas by time of day, boiler schedule check, spike detective, carbon footprint, gas against temperature.
- **Prices**: Home Mini live readings, Agile today and tomorrow with negative-price alerts, grid carbon forecast, best time to run, appliance costs.
- **Compare**: the user's half-hourly use priced on each Octopus tariff, battery simulator, solar simulator.
- **Home**: change log, insulation plan, EPC, CSV export and setup notes.

## Conventions

- **Theme:** the look is deliberately "intergalactic": deep-space dark, starfield, glowing amber for electricity, cyan for gas, violet for negative prices. Fonts are Syncopate for display, Exo 2 for body and JetBrains Mono for data. Keep it.
- **Units:** money is held in pence internally and formatted with `gbp()` or `gbp0()`. Rates are p/kWh including VAT.
- **Readings:** half-hourly records are `{ t: epochMs, v: kWh }`. Rate lists are `{ from, to, p }`, sorted, and looked up with `lookup()` (a binary search).
- **Gas units:** gas from SMETS2 meters arrives in m³ and is converted with `GAS_M3_TO_KWH`.
- **Example data:** with no account connected the dashboard runs on `makeDemo()`, and every figure derived from it is labelled as an example. The display never shows example data: anything not set up says how to set it up, and billboards carry real data only.
- **TV browsers:** code in `src/lib/` and `src/display/` must parse on Chromium 63. Don't use `?.`, `??`, `flatMap`, `.at()`, optional catch binding or `Object.fromEntries`; use `nz(value, fallback)` for nullish defaults. The display's CSS must avoid `inset`, flex `gap` and `:focus-visible`, and give `clamp()`/`min()` a fallback. The dashboard's components and state only run on the dashboard and may use newer syntax.
- **Ten-foot rules (display):** size text in `rem`, nothing under `0.9rem` (24px at 1080p); keep the 4.5% overscan margin; every control must be reachable with arrows, Enter and Back.
- **Secrets:** never commit secrets. The Octopus API key is entered per device and kept in `localStorage`. Train and tram keys live only in the helper's `.env`, because Realtime Trains forbids tokens in browser apps. Any hosted version should hold keys in a server-side secret (see `docs/STACK.md`). The repository is public: don't commit the house number or other personal details either.
- **Copy:** plain British English, written from the user's side. Estimates are labelled as estimates, not advice.

## Known gaps

- Octopus allows browser calls, including authenticated ones (checked October 2026). Trains come from Huxley2, a free community service with no guarantee. Trams (TfGM) and Google Calendar can't be fetched by a browser and need the backend in `ROADMAP.md` item 3.
- Several GraphQL fields come from community code rather than official docs: Home Mini telemetry, `savingSessions`, `loyaltyPointLedgers`. Each one fails quietly.
- The EPC register moved to a new government service in 2026. The search endpoint and its parameters in `searchEPC()` are a best guess.
- The tariff comparison covers electricity only.
- Realtime Trains' new API and TfGM's Metrolink fields are coded from the spec and community code, and haven't been tried with live keys yet.
- Bin days are entered by hand. Bank holiday changes aren't known.

## Checking changes

1. `npm install` (once). `npm run build` builds the display and the dashboard. Commit `display.html` with the source: CI fails if it differs. `npm run dev` serves the dashboard with live reload.
2. `npm test` runs the maths and the display's logic, with no browser.
3. `npm run test:browser` (after `npm run build`) checks:
   - phone (390×844) and TV (1920×1080) layouts and 24px text;
   - every dashboard page, its controls, and that the account is fetched once across pages;
   - the remote control and the cockpit in every weather;
   - the Home Mini's rate budget;
   - the lock.
4. `npm run shots` also saves screenshots to `tests/screens/`. Look at them. For the screensaver, `GALLERY=1 SHOTS=1 node --test --test-name-pattern=gallery tests/display.browser.mjs` saves one per scene (`GALLERY_LOOKS='phase=night&show=train|wx=snow'` to choose, `GALLERY_PHONE=1` for the phone too).
5. `npm run ci` runs all of it, as CI does.
