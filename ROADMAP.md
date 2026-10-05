# Roadmap

Kyle's ideas, in his own priority order, with build notes added.

## 1. Household display site (built, October 2026)

Put the wall display on its own website on GitHub Pages. It should show household things alongside energy and work on any device: phone, tablet and smart TV. The display comes first, but the site isn't limited to it.

### Built

- **`display.html`, with five modes, switchable** with left/right on the remote, number keys 1–5, the colour buttons, an on-screen picker, or a swipe on a phone. Each mode has its own link (`display.html#energy`, `#home`, `#travel`, `#screensaver`, `#night`), and a screen can be set to open on any of them. It can rotate between energy, home and travel every few minutes.
  - **Energy:** Agile now, the next day's prices as a strip, the cheapest two hours, grid carbon with the greenest window, Home Mini live draw, and today's cost on your own tariff.
  - **Home:** clock, date, weather now and the next 12 hours, sunrise and sunset, bins, and the next week of your calendar.
  - **Travel:** trains from your station (Realtime Trains) and trams from your Metrolink stop (TfGM), with "leave in" countdowns that allow for the walk.
  - **Screensaver:** four planets carrying the price, the temperature, when to leave for the next train and grid carbon, each wandering its own quarter of the screen; the odd comet; a clock orbiting the middle. It starts after a set number of idle minutes and any key only wakes it.
  - **Night:** a very dim clock with the price and temperature, drifting slowly, between set times.
- **Password lock:** StatiCrypt at publish time when the `SITE_PASSWORD` secret is set. The lock screen has an on-screen keypad you can drive with the arrows, and "Remember this screen" is ticked, so a TV asks once.
- **Ten-foot rules**, checked by `tests/display.browser.mjs` at 1920×1080:
  - Text is at least 24px.
  - Focus rings are 4px amber.
  - Everything works with arrows, Enter and Back, including the settings, through spatial navigation.
  - Nothing needs hover.
  - A 4.5% margin keeps clear of overscan.
  - Nothing scrolls sideways at phone or TV size.
- **Unattended screens:**
  - A fresh start once a night at a set time, with a few minutes' jitter.
  - A wake lock, renewed when the page comes back.
  - Retries with backoff, and an immediate retry when the network returns.
  - "Last updated" in amber when any source is stale.
- **Setup links** carry one device's settings to another, so the TV doesn't need typing.
- **The cockpit** (Kyle's idea: space billboards, seen from inside a rocket ship). It's the screensaver, and the view new screens open on.
  - Billboards in 3D, and traffic at different depths.
  - Weather on the glass and in the sky; the power price sets the engines. See [decision 0005](docs/decisions/0005-cockpit.md).
- **No home server needed:** live trains come straight from the browser through Huxley2 ([decision 0004](docs/decisions/0004-no-home-server.md)).
- **`household.json`:** settings every screen shares, editable on GitHub.
- **Bin days:** the repeats from the council's calendar are in `household.json`, and a weekly GitHub Action checks them against Stockport Council's page for your address, which is held as a secret ([decision 0006](docs/decisions/0006-council-bins.md)).
- **The side window:** the screensaver became a view out of a side window, where everything slides past ([decision 0005](docs/decisions/0005-cockpit.md), revised).
- **The voyage** (the screensaver redrawn, [decision 0005](docs/decisions/0005-cockpit.md), second revision):
  - painted nebulae and lit planets, some with rings;
  - the Harold Street Express, a space train with one fact on each carriage;
  - the house on its own asteroid, lit by your live power use;
  - nature telling the story: the aurora when the grid is clean, a comet in your bins' colours on bin night, the real moon phase, and the real ISS when it's overhead;
  - whales, jellyfish and birds of light.
- **Older TV browsers:** the display's code avoids syntax newer than Chromium 63, and a test checks it.
- **On GitHub Pages**, a workflow publishes `main`, checking the build, unit tests, layouts and the lock first.

### Still to do here

- **Trams and Google Calendar on the published site.** These need a server: TfGM and Google don't allow browser calls. Two ways that need no hardware:
  - **A Cloudflare Worker** (item 3) holding the TfGM key and the iCal address as secrets. It's live, and free.
  - **A scheduled GitHub Action** fetching every few minutes and publishing to a data branch. It needs only GitHub secrets, but runs late at busy times, and anything private would need encrypting with the site PIN.
- **Buses.** The Bus Open Data Service gives vehicle positions rather than stop departures, so it needs more work.
- **More for the cockpit:** a billboard and a carriage for Saving Sessions, and a birthday or holiday visitor from the calendar.

### Password lock

GitHub Pages sites are public, so a password check written in JavaScript alone only hides the page from casual visitors; anyone can read the code. Options, strongest first:

1. **Cloudflare Access in front of the site.** This is real sign-in (email code or Google), free for a household. It needs the site on a custom domain run through Cloudflare, or hosted on Cloudflare Pages instead of GitHub Pages.
2. **StatiCrypt.** It encrypts the built pages with your password at deploy time, so the content can't be read without it. It works on GitHub Pages and has a "remember me" option, so the TV only asks once. This is the best fit if you stay on GitHub Pages.
3. **A simple JavaScript gate.** Fine for keeping visitors out of view, not for anything private.

Whichever you choose, the Octopus API key must never be in the repo. It stays per device, or lives as a secret in a small backend (see `docs/STACK.md`).

On a TV, typing a password with a remote is painful. Options:
- A numeric PIN with an on-screen keypad you can drive with arrows.
- "Remember this device", so it only asks once.
- Pairing by scanning a QR code with your phone.

**Chosen:** StatiCrypt, with a numeric PIN on an on-screen keypad and "Remember this screen" (see `lock/`). The repository is public, so the lock hides the published site, not the code. A short PIN keeps visitors out but could be guessed offline by someone determined, which is acceptable because no secrets are in the pages. QR pairing isn't built. Cloudflare Access remains the upgrade if the site ever shows anything private.

## 2. Move the dashboard to Astro

Rebuild the five tabs as Astro pages with small interactive islands. Svelte suits the charts and forms.

- `src/analysis.js` is already pure and can move across as-is into `src/lib/`, with tests.
- `src/display/sources.js` is pure in the same way, apart from its loaders, and has its own tests.
- `src/core.js` splits into one module per service.
- The design tokens in `head.html` become a global stylesheet.

## 3. A small backend

A Cloudflare Worker on the free tier, or `server.py` grown up on the home server:

- Proxies the APIs that don't allow browser calls, and holds the Octopus key as a secret so displays don't need it.
- Runs scheduled jobs:
  - A push alert when Agile goes negative or a Saving Session is announced.
  - A Monday "mission log" email.
  - A nightly copy of readings into a database, so history outlives Octopus's retention.

## More ideas already in the app

The current single file already includes these, so carry them across:

- Tariff comparison, battery and solar simulators.
- Spike detective and boiler schedule check.
- Weather-adjusted gas, and the insulation plan.
- Change log with before-and-after.
- Direct Debit check and price cap countdown.
- Activity costs and best time to run.
- Carbon footprint and grid forecast.
- CSV export and install-to-phone.

## Household display ideas for later

- **Bin collection day:** Stockport Council has no public API. The community project UKBinCollectionData covers many councils.
- **Weather:** Open-Meteo with no key, or Met Office DataHub.
- **Calendar:** a shared Google Calendar's private iCal link, or the Calendar API through the backend.
- **Trains:** Realtime Trains API (free account) or National Rail data via the Rail Data Marketplace.
- **Metrolink trams and buses:** TfGM open data (free key) and the Bus Open Data Service.
- **Other screens:**
  - A shopping or to-do list anyone in the house can add to from their phone.
  - A photo frame mode between displays.
  - A "house" panel tracking home improvement jobs and their energy effect, fed from the change log.
  - A smart bulb or LED strip that glows green when power is cheap, driven by the backend.
