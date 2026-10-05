# Harold Street Energy: project brief for Claude Code

Kyle's home dashboard for his Octopus Energy account on Harold Street, Stockport (Octopus region G, North West England). It started as a single HTML file and is growing into a household display site that runs on phones, a wall tablet and the smart TV.

Read `ROADMAP.md` for what's next and `docs/` for the stack choices and API details.

## What exists now

- `index.html`: the built app. One self-contained file, no dependencies, opens straight from disk.
- `src/`: the source it's built from. `python3 build.py` concatenates these into `index.html`.
  - `head.html`: meta tags and all CSS. Design tokens live on `:root`.
  - `body.html`: markup for the five tabs and the wall display overlay.
  - `core.js`: constants, formatting helpers, the network layer and all API loaders (Octopus REST and GraphQL, Carbon Intensity, Open-Meteo, PVGIS, EPC).
  - `analysis.js`: pure functions with no DOM. Example data, the period roll-up, spikes, weather regression, projections, tariff comparison, battery and solar simulators.
  - `dom.js`: state, rendering, the generic SVG `barChart`, event wiring and the wall display.
  - `starfield.js`: the animated background.
- `server.py`: optional stdlib-only home server helper. It serves the folder and proxies a fixed allowlist of hosts under `/proxy/<name>/…`. The page detects it with `GET ./proxy/ping`, and from then on all Octopus calls go through it.
- `tests/analysis.test.mjs`: runs the analysis functions on example data with `node --test tests/analysis.test.mjs`.

## Tabs

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
- **Example data:** with no account connected the app runs on `makeDemo()`, and every figure derived from it is labelled as an example.
- **Secrets:** never commit secrets. The Octopus API key is entered per device and kept in `localStorage`. Any hosted version should hold it in a server-side secret (see `docs/STACK.md`).
- **Copy:** plain British English, written from the user's side. Estimates are labelled as estimates, not advice.

## Known gaps

- Octopus has no documented CORS support, so direct browser calls to `api.octopus.energy` are unconfirmed. They go through `server.py` when it's present. Test direct calls first, and plan a proxy (a Cloudflare Worker) for the hosted site.
- Several GraphQL fields come from community code rather than official docs: Home Mini telemetry, `savingSessions`, `loyaltyPointLedgers`. Each one fails quietly.
- The EPC register moved to a new government service in 2026. The search endpoint and its parameters in `searchEPC()` are a best guess.
- The tariff comparison covers electricity only.

## Checking changes

1. `python3 build.py`, then open `index.html`.
2. `python3 server.py`, then open http://localhost:8787 to exercise the proxy path.
3. `node --test tests/analysis.test.mjs` for the maths.
4. Screenshot at 390×844 (phone) and 1920×1080 (TV), and confirm nothing scrolls sideways.
