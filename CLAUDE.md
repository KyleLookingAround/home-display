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

- `index.html` (the dashboard) and `display.html` (the household display): built pages. Each is one self-contained file with no dependencies that opens straight from disk. Never edit them directly.
- `src/`: the source. `python3 build.py` concatenates it into both pages.
  - `head.html`, `body.html`: the dashboard's CSS (design tokens on `:root`) and markup for its five tabs.
  - `core.js`: shared by both pages. It holds:
    - constants and formatting helpers;
    - `$`, `$$` and `store` (per-device `localStorage`, keys prefixed `hse.`);
    - the network layer and the API loaders: Octopus REST and GraphQL, Carbon Intensity, Open-Meteo, PVGIS and EPC.
  - `analysis.js`: pure functions with no DOM, shared by both pages. Example data, the period roll-up, spikes, weather regression, projections, tariff comparison, battery and solar simulators, and `cheapestWindow`.
  - `dom.js`: the dashboard's state, rendering, the generic SVG `barChart` and event wiring.
  - `display/head.html`, `display/body.html`: the display's CSS (ten-foot rules) and markup for its five modes, toolbar and settings sheet.
  - `display/cockpit.js`: the screensaver, drawn on two canvases with DOM billboards between them.
    - Outside: sky, galaxies, planet, nebulae, stars, traffic, debris, dust, lightning.
    - The glass: rain, snow, frost, fog.
    - The frame, the dashboard and the 3D billboards.
    - It slows itself down on weak hardware.
  - `display/sources.js`: the display's household data, mostly pure.
    - The cockpit's logic: `skyFor`, `engineFor`, `buildBillboards`, `billboardRotation`.
    - Huxley2 trains, and household settings merging.
    - Modes, night window and settings defaults.
    - Bins, weather, and the iCal parser and `RRULE` expansion.
    - Realtime Trains and TfGM parsing, leave-by countdowns, today's cost.
    - Nightly reload and staleness.
  - `display/display.js`: the display's data scheduler (`SRC`: each source has its own refresh period and backs off on failure), mode switching, remote control and spatial navigation, screensaver motion, night mode and the settings sheet.
  - `starfield.js`: the animated background, on both pages.
- `server.py`: optional stdlib-only home server helper.
  - It serves the folder (never dotfiles, `.py` or `.md`) and proxies a fixed allowlist of hosts under `/proxy/<name>/…`.
  - It holds the train and tram keys from `.env` or the environment: `RTT_TOKEN` or `RTT_REFRESH_TOKEN`, and `TFGM_KEY`. `GET /proxy/status` says which are set.
  - Pages detect it with `GET ./proxy/ping`, and from then on all Octopus calls go through it.
- `household.json`: settings every screen shares (bins, station, default mode), editable on GitHub and published with the site. Nothing private goes in it. Each screen stores only its own changes on top.
- `package.json`: `npm run ci` runs everything CI runs. Playwright is the only dependency, and it's for development only.
- `lock/`: `template.html` is the StatiCrypt lock screen (PIN keypad, remote-friendly). `publish.sh` builds `_site/` for Pages and locks it when `SITE_PASSWORD` is set.
- `.github/workflows/pages.yml`: checks every push, and publishes `main` to GitHub Pages.
- `tests/`:
  - `*.test.mjs`: unit tests with no dependencies. `analysis.test.mjs` covers the maths. `display.test.mjs` covers the display's logic, the TV syntax check and "built pages match the source".
  - `display.browser.mjs`: Playwright, on fixed fake data with the clock held. Phone and 1080p layouts, 24px text, the remote, the idle screensaver, the night clock, setup links, and the dashboard at both sizes.
  - `lock.browser.mjs`: builds a locked site with a test PIN and unlocks it.

## Display modes

Energy, Home, Travel, Screensaver (the cockpit, which new screens open on), Night. The mode comes from the link (`display.html#home`) or the screen's own setting. Extras after the mode preview the cockpit: `#screensaver&wx=rain&phase=night&price=-3`. `wx` is clear, cloud, rain, drizzle, snow, fog, thunder, wind or cold; `phase` is dawn, day, dusk or night. The screensaver and night clock also take over automatically as overrides that don't change the link. Settings live in `localStorage` under `hse.display` on each device, and a setup link (`#setup=<base64 JSON>`) copies them between devices.

## Dashboard tabs

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
- **TV browsers:** code in `core.js`, `analysis.js` and `src/display/` must parse on Chromium 63. Don't use `?.`, `??`, `flatMap`, `.at()`, optional catch binding or `Object.fromEntries`; use `nz(value, fallback)` for nullish defaults. The display's CSS must avoid `inset`, flex `gap` and `:focus-visible`, and give `clamp()`/`min()` a fallback. `dom.js` only runs on the dashboard and may use newer syntax.
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

1. `npm install` (once). `python3 build.py` rebuilds both pages. Commit them with the source: CI fails if they differ.
2. `npm test` runs the maths and the display's logic, with no browser.
3. `npm run test:browser` checks:
   - phone (390×844) and TV (1920×1080) layouts and 24px text;
   - the remote control and the cockpit in every weather;
   - the Home Mini's rate budget;
   - the lock.
4. `npm run shots` also saves screenshots to `tests/screens/`. Look at them.
5. `npm run ci` runs all of it, as CI does.
