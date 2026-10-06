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
    - `format.js`: constants, dates (`ukDate`, `parseUkDate`: always day first), money and number formatting, `nz`, `niceScale`.
    - `browser.js`: `$`, `$$` and `store` (per-device `localStorage`, keys prefixed `hse.`).
    - `net.js`: `request`, `NET`, `detectProxy`, `errorText`.
    - `octopus.js`: Octopus REST and GraphQL (rates, consumption, products, the account, the Home Mini, rewards; `COMPARE` and `GAS_COMPARE` with `loadGasOffer`).
    - `carbon.js` (the forecast, history and `loadGridMix`: what the region's power is made of now), `weather.js`, `pvgis.js`: the other services.
    - `outdoors.js`: bank holidays (GOV.UK), rain every quarter hour (`loadNowcast`, `rainSoon`), the rain radar (RainViewer over CARTO's map; `tileOf`), air quality, UV and pollen (Open-Meteo's air quality service; `aqiLabel`, `uvLabel`, `pollenLabel`) and Environment Agency flood warnings within 15 km.
    - `qr.js`: QR codes made here (`qrEncode`, `qrSvg`; byte mode, medium error correction), and `wifiCode` for a guest network.
    - `spotify.js`: Spotify ([decision 0012](docs/decisions/0012-music-player.md)):
      - signing in from the browser with PKCE and no secret (`beginSignIn`, `finishSignIn`, `redirectUri`: Settings next to the page);
      - accounts kept on the device (`hse.spotify`: each with its tokens and the Client ID it signed in with);
      - tokens refreshed when they run out (`accessToken`);
      - `api` (retries once after a refreshed token or a "slow down", and names `PREMIUM`, `NO_DEVICE`, `AUTH`), with `apiFirst` for endpoints Spotify has moved;
      - `spotify(acc, clientId)`: every call the player makes.
    - `music.js`: the player's logic, no DOM: `trackOf`, `playerModel`, `progressAt`, `playOn` and `deviceKind`, `page` (Spotify's lists; newer answers say `item` for `track`), `fmtDur`, `artUrl`, synced lyrics (`parseLrc`, `lyricAt`, `loadLyrics` from LRCLIB) and `coverColours` (a cover's colours from its pixels).
    - `remote.js`: the phone as a remote for a screen, through ntfy.sh. A screen makes an eight-letter code (`newRemoteCode`) and listens on `hse-screen-<code>`; a paired phone asks it to change view, wake or start afresh, and asks what it shows. `readRemote` lets through only those requests and the screen's answer. The account, guest Wi-Fi, dates and calendar address can go too, sealed (`sealDetails`, `openDetails`: AES-GCM, key from PBKDF2 over the lock's remembered PIN hash, `staticrypt_passphrase`, salted with the code).
    - `analysis.js`: pure functions with no DOM. `compareGas` (a usual year of gas on each tariff at today's rates), `priceVerdict` and `priceTone` (the answer to "use power now?", worded the same on the phone and the TV), example data, the period roll-up (`buildModel(raw, days, endDay)`, so the period before can be rolled up too), spikes, weather regression, projections, tariff comparison, battery and solar simulators, `MEASURES` with rough costs, and `cheapestWindow`.
    - `household.js`: the household's data for both: settings defaults and merging (`mergeSettings`, `deviceChanges`), modes (`MODES`; `MODE_ALIASES` sends old `#home` links to Today) and the night window, bins (`nextCollections(bins, now, holidays)` moves a repeat a day later in a bank holiday week, marked `moved`, and marks Christmas `check`; `councilBins`, `mergeBins`), weather, the iCal parser and `RRULE` expansion, `countdowns` and `countdownText` (birthdays with ages, anniversaries, one-off dates, Christmas, the next bank holiday), public Darwin boards for trains (`TRAIN_BOARDS`: Huxley2, its mirror, Huxley2's staff board, tried in turn), Realtime Trains and TfGM parsing (each train with its calling points, `calls`, and `coaches`), `leaveBy`, `catchable` (the trains you can still make with your walk), the station sign's words for the phone and the TV (`signTrains`, `signStatus`, `signExpected`, `signGo`, `signLine`, `ordinal`), `headsUp`, `todayCost`, nightly reload and staleness.
    - `voyage.js`: the cockpit's logic, also used by the phone's Now page: `skyFor`, `engineFor`, `buildBillboards`, `billboardRotation`, `boardCards`, `worldFor` with `moonPhase` and `issPass`, `voyageFor` (the next twelve hours) with `shownAhead`, and `instrumentsFor` with `recordCost` and `usualCost`.
  - `pages/`: the dashboard's pages, phone first ([decision 0010](docs/decisions/0010-redesign.md)): `index` (Now), `money`, `usage`, `home`, `music`, `screen` (the wall display from the phone), and `settings` (a gear in the header on a phone, the foot of the rail on a laptop). Each is a list of islands. `patterns`, `prices` and `compare` only send old links to their new homes.
  - `layouts/App.astro`: the head, starfield, the nav (six tabs in a bottom bar on phones, a rail from 900px with Settings at its foot; links with `aria-current`), the header, the now-playing strip and the footer around every page. It sets `data-corners` from `hse.corners` before the page draws.
  - `components/`: one Svelte island per card, in a folder per page (`now/`, `money/`, `usage/`, `home/`, `settings/`), plus:
    - `Header.svelte`: the title, the status (`#status`: "Updated hh:mm", "Example data", "Updating…", "No signal", "Offline"), Refresh, and the negative price and Saving Session notifications.
    - `Notices.svelte`: the example-data banner (on Now) and errors.
    - `DateField.svelte`: every date box: typed and shown day first (05/10/2026), with a calendar to pick from. Don't use `<input type="date">` on its own: it follows the browser's language, which can be American.
    - `now/HeadsUp.svelte`: leave for your train, bins out tonight, flood warnings, rain soon (`headsUp` in `household.js`), as on the TV.
    - `music/`: the player ([decision 0012](docs/decisions/0012-music-player.md)):
      - `MiniPlayer` is the now-playing strip on every page (in `App.astro`). Swipe it to skip; tap it for `Player`.
      - `Player` is the full player: the cover as a blurred nebula, drag down to close, swipe the cover to skip, double-tap to like, and the views player, lyrics and Up next.
      - `MusicPage` is the Music tab: a greeting, shortcuts, `Row`s to scroll, search with a top result, and playlist, album and artist pages at `#album/<id>` and the like.
      - `TrackRow`, `Tile`, `Icon`.
      - `now/MusicNow.svelte` shows what's playing on Now; `settings/Music.svelte` connects Spotify (`#music`).
    - `screen/Screen.svelte`: a live picture of the wall display (`display.html#<view>&embed=1` in a scaled frame), pairing with a screen's code, and buttons that change what it shows.
    - `home/Upgrade.svelte`: the shape every upgrade shares: a year's saving, a rough cost, the payback, and the simulator folded under "Work it out".
    - `charts/`: `Strip` (prices over time, cheapest hours, carbon band, markers), `Radar` (the rain radar, looping), `Bars` (ghost of the period before, change marks), `HeatMap`, `ClockFace`, `Dial`, `Sparkline`, `Scatter`. Tap, point or arrow keys to read them.
  - `state/`:
    - `app.svelte.js`: the one state object every island shares. Account data is `$state.raw`, replaced whole; `model` and `reg` are derived.
    - `session.js`: `boot()` once per page; `refresh`, `loadPrices`, `connect`, `forget`.
    - `cache.js`: IndexedDB, keeping account data across pages for half an hour and prices for ten minutes.
    - `house.js`: the household on the phone: `houseSettings()` (household.json, then this device's changes), `saveHouse(form)` (keeps only what differs, in `hse.display`, as a screen does), weather, council bins and bank holidays, trains, the calendar, rain, the radar, air, floods and the grid mix, each cached for its own time (`watchHouse(ask)`: any card can ask, and the page runs one set of timers), and the Home Mini (`watchLive`: the draw each minute, today's rows each ten).
    - `usage.svelte.js`: the Usage page's comparison with the period before.
    - `music.svelte.js`: the player every island shares: Spotify's player read every few seconds while a page is visible (sooner while playing, just after a song ends), the position worked out in between, commands shown at once and checked after, the cover's colours (`colourOf`; `--tint`, `--tint-deep`, `--tint-ink` on the page), lyrics, Up next and the full player's views (`openPlayer`, `setView`).
  - `styles/app.css`: the design tokens on `:root` (`--radius` changes with `data-corners="sharp"`) and the shared classes: cards, answers, stats, rows, folds, banners, forms, charts.
  - `display/head.html`, `display/body.html`: the display's CSS and markup, in the dashboard's look at ten-foot sizes (the same colours, cards, labels and price tones, and its corners setting): Today, Energy, Travel, the cockpit, Night, the toolbar and the settings sheet (with the remote's pairing code). `body.embed` (from `&embed=1`) is the picture on the phone's Screen page: no toolbar, no idle takeovers, no reloads, no remote.
  - `display/board.js`: drawing helpers for Today, Energy and Travel, as strings: `stripSvg` (the price strip, sized in real pixels so its text stays sharp), heads-up chips (`headsHtml`), the grid mix (`mixHtml`), Travel's station sign (`signHtml`: the departures board and the platform sign in dot-matrix; `tickSign` in display.js runs its seconds clock) and the line icons.
  - `display/cockpit.js`: the screensaver, a side window onto space. It decides when and where things appear. Everything has a depth, and slides past at the ship's speed divided by it (`speedAt`; `readableAt` caps it for text). Layers, back to front:
    - `cSpace` canvas: the backdrop (sky, far and middle stars and both nebulae, baked together into one picture two screens wide and slid along), near stars, sun, comets, moon, aurora (painted small, stretched), planets, traffic, the house, wildlife, the ISS.
    - `cAhead` canvas, sharp at any tier: the road ahead (`drawAhead`), the next twelve hours along the window, now on the left, and the train's rail and platform. The price landscape, weather fronts, calendar beacons and the fuel dock, with canvas labels that stack rather than overlap ([decision 0007](docs/decisions/0007-time-is-distance.md)).
    - `cBoards`: DOM billboards and the space train, in 3D. Your own train stops at a platform when it's time to leave.
    - `cNear` canvas: huge things sweeping past, dust, warp streaks, debris, rain outside.
    - `cShip`: the glass (rain, snow, frost, fog), the frame and the dashboard, with its dials.
    - `TIERS` set canvas resolution, frames a second and how often the road ahead redraws. TVs start lower, any screen steps down when it can't keep up, and Settings or `detail=low|high` can fix it ([decision 0008](docs/decisions/0008-drawing-for-tvs.md)). Lower tiers add `body.lite`, which drops blurred shadows and looping animations. Don't add full-screen layers drawn every frame: bake slow things into the backdrop. Check with `BENCH=1 node --test --test-name-pattern="frame budget" tests/display.browser.mjs` (CPU slowed six times).
    - It shows a still frame under reduced motion.
  - `display/scenery.js`: how each thing is drawn, with no timing: noise, planets and rings, the moon's phase, ships, the ISS, the house on its asteroid, whales, jellyfish, birds, comets.
  - `display/display.js`: the display's data scheduler (`SRC`: each source has its own refresh period and backs off on failure; the outdoors and the grid mix too), the views (`renderToday`, `renderEnergy`, `renderTravel`, `renderNight`), mode switching, the TV remote and spatial navigation, the phone as a remote (`startRemote`, `tellRemote`), screensaver motion, night mode and the settings sheet.
  - `starfield.js`: the animated background, on both pages. It rests while the screensaver covers it.
- `public/sw.js`: the service worker for the phone pages (registered by `App.astro` in a built site): pages and `household.json` network-first with a four-second fallback to the kept copy, hashed assets and fonts from the copy first. Data stays in IndexedDB.
- `server.py`: optional stdlib-only home server helper.
  - It serves the folder (never dotfiles, `.py` or `.md`) and proxies a fixed allowlist of hosts under `/proxy/<name>/…`.
  - It holds the train and tram keys from `.env` or the environment: `RTT_TOKEN` or `RTT_REFRESH_TOKEN`, and `TFGM_KEY`. `GET /proxy/status` says which are set.
  - Pages detect it with `GET ./proxy/ping`, and from then on all Octopus calls go through it.
  - It serves the built dashboard from `dist/` first, then the folder.
- `scripts/bins.mjs`: fetches the next bin collections from Stockport Council for the UPRN in the `STOCKPORT_UPRN` secret, and writes `bins.json`. The workflow runs it every Saturday morning (tests skipped) and publishes the result with the site. The bins' repeats live in `household.json`; `mergeBins` restarts each from the council's latest date while the feed is under ten days old ([decision 0006](docs/decisions/0006-council-bins.md)). The UPRN is the address: never commit it.
- `household.json`: settings every screen shares (bins, station, default mode, the household's Spotify Client ID, which isn't a secret), editable on GitHub and published with the site. Nothing private goes in it: `mergeSettings` ignores `ical`, `wifi` and `dates` there; they live on each device and travel sealed. Each screen stores only its own changes on top.
- `package.json`: `npm run ci` runs everything CI runs. The dependencies are all for development: Astro, Svelte, the Svelte integration, Playwright and jsQR (the tests read back every QR code), pinned exactly.
- `lock/`: `template.html` is the StatiCrypt lock screen (PIN keypad, remote-friendly). `publish.sh` builds `_site/` for Pages (`dist/`, the display, `household.json`, icons) and locks every page when `SITE_PASSWORD` is set.
- `.github/workflows/pages.yml`: checks every push, and publishes `main` to GitHub Pages. It also runs every Saturday morning to check the bin dates.
- `tests/`:
  - `*.test.mjs`: unit tests with no dependencies. `analysis.test.mjs` covers the maths. `display.test.mjs` covers the display's logic, the TV syntax check and "built pages match the source".
  - `display.browser.mjs`: Playwright, on fixed fake data with the clock held, serving `dist/` then the repository. Phone and 1080p layouts, 24px text, the remote, the idle screensaver, the night clock, setup links; the dashboard's pages at both sizes, its controls and its cache.
  - `music.browser.mjs`: the music player against a pretend Spotify that answers as the real one does: signing in, the strip on every page, the full player, Play on, lyrics, the Music tab, refreshed tokens and what goes wrong.
  - `lock.browser.mjs`: builds a locked site with a test PIN, unlocks it, and checks the dashboard's islands start.

## Display modes

Today, Energy, Travel, Screensaver (the cockpit, which new screens open on), Night ([decision 0011](docs/decisions/0011-wall-display.md)). Today is the household at a glance: clock, the price verdict, weather, heads-ups, the next twelve hours, trains, bins and the calendar, and what's live. Energy and Travel are the detail; Travel's trains are the station's departures board and platform sign, in orange dot-matrix (the Doto font). The mode comes from the link (`display.html#today`; `#home` still works) or the screen's own setting, or a paired phone. Extras after the mode preview the cockpit: `#screensaver&wx=rain&phase=night&price=-3&show=train,house`. `wx` is clear, cloud, rain, drizzle, snow, fog, thunder, wind or cold; `phase` is dawn, day, dusk or night. The screensaver and night clock also take over automatically as overrides that don't change the link. Settings live in `localStorage` under `hse.display` on each device, and a setup link (`#setup=<base64 JSON>`) copies them between devices.

## Dashboard pages

Phone first, each opening with its answer ([docs/redesign.md](docs/redesign.md)).
- **Now**: the verdict on the price now, heads-ups (leave for your train, bins out tonight, rain soon), the next twelve hours (price strip with cheapest hours, carbon, rain, your next event and train; today and tomorrow folded), right now (live draw, today so far, grid carbon), coming up (negative prices, tomorrow's prices, Saving Sessions), and run it now or later (three appliances, chosen in Settings).
- **Money**: this month so far and on track for, the year ahead and the Direct Debit check, your tariff and the price cap, this week (with the log as text), rewards.
- **Usage**: the period (7, 30, 90 days, against the period before), every day, your day as a clock face, every day as a heat map, heating against the weather, unusual days and half hours, carbon.
- **Home**: weather (with rain soon, air, UV, pollen and the radar), bins, today and tomorrow, trains (`home/DepartureBoard.svelte`: a dot-matrix station sign in the Doto font; tap for the platform sign, the departures board and when to leave), coming up (birthdays and countdowns), guest Wi-Fi (a code to scan); upgrades (tariffs, insulation and heating, the certificate, battery, solar); changes.
- **Music**: Spotify, played from here on the TV, the Google speakers or your phone ([decision 0012](docs/decisions/0012-music-player.md)). A greeting and shortcuts, rows to scroll (jump back in, your playlists, your top artists, your albums), search with a top result, playlist, album and artist pages, liked songs and what you played lately. The now-playing strip sits above the tabs on every page, and the full player opens over any of them.
- **Screen**: the wall display's views in a live picture, pairing with a screen's code (`hse.remoteTV`), buttons that change what the TV shows, and sending your account to it sealed with the site PIN.
- **Settings**: account (`#account`), music (`#music`: connect Spotify), notifications, household (`#household`), appliances (`#appliances`), screens (mode links and a setup link), data (CSV, clear the cache, the helper), look (corners), about.

## Conventions

- **Theme:** the look is deliberately "intergalactic": deep-space dark, starfield, glowing amber for electricity, cyan for gas, violet for negative prices. Fonts are Syncopate for display, Exo 2 for body and JetBrains Mono for data. Keep it.
- **Units:** money is held in pence internally and formatted with `gbp()` or `gbp0()`. Rates are p/kWh including VAT.
- **Readings:** half-hourly records are `{ t: epochMs, v: kWh }`. Rate lists are `{ from, to, p }`, sorted, and looked up with `lookup()` (a binary search).
- **Gas units:** gas from SMETS2 meters arrives in m³ and is converted with `GAS_M3_TO_KWH`.
- **Example data:** with no account connected the dashboard runs on `makeDemo()`, and every figure derived from it is labelled as an example. The display never shows example data: anything not set up says how to set it up, and billboards carry real data only.
- **TV browsers:** code in `src/lib/` and `src/display/` must parse on Chromium 63. Don't use `?.`, `??`, `flatMap`, `.at()`, optional catch binding or `Object.fromEntries`; use `nz(value, fallback)` for nullish defaults. The display's CSS must avoid `inset`, flex `gap` and `:focus-visible`, and give `clamp()`/`min()` a fallback. The dashboard's components and state only run on the dashboard and may use newer syntax.
- **Ten-foot rules (display):** size text in `rem`, nothing under `0.9rem` (24px at 1080p); keep the 4.5% overscan margin; every control must be reachable with arrows, Enter and Back.
- **Secrets:** never commit secrets. The Octopus API key is entered per device and kept in `localStorage`. Train and tram keys live only in the helper's `.env`, because Realtime Trains forbids tokens in browser apps. Any hosted version should hold keys in a server-side secret (see `docs/STACK.md`). The repository is public: don't commit the house number or other personal details either.
- **Copy:** plain British English, written from the user's side. Dates day first (05/10/2026, or 5 Oct), times on the 24-hour clock. Estimates are labelled as estimates, not advice.

## Known gaps

- The phone-to-TV remote goes through ntfy.sh, a free relay with no guarantee; without it the TV still works, and only the remote stops.
- Octopus allows browser calls, including authenticated ones (checked October 2026). Trains come from free community Darwin boards (Huxley2 and a mirror) with no guarantee; three are tried in turn. Trams (TfGM) and Google Calendar can't be fetched by a browser and need the backend in `ROADMAP.md` item 3.
- Several GraphQL fields come from community code rather than official docs: Home Mini telemetry, `savingSessions`, `loyaltyPointLedgers`. Each one fails quietly.
- Realtime Trains' new API and TfGM's Metrolink fields are coded from the spec and community code, and haven't been tried with live keys yet.
- Bin days are entered by hand (and checked with the council weekly once its secret is set). Bank holiday weeks move a collection a day later, which is the usual pattern but not the council's word.

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
