# Roadmap

Kyle's ideas, in his own priority order, with build notes added.

## 1. Household display site (first)

Put the wall display on its own website on GitHub Pages. It should show household things alongside energy and work on any device: phone, tablet and smart TV. The display comes first, but the site isn't limited to it.

### Already in this version

- A full screen button on the wall display.
- TV remote control: arrow keys move focus, Enter presses, and Back closes. Back covers Backspace, GoBack, BrowserBack, Samsung's keyCode 10009 and LG's keyCode 461.
- A screensaver drift: the main readout wanders slowly across a moving starfield, so the screen never holds one image in place.

### To build

- **Several display modes, switchable.** Change mode with left/right on the remote, number keys or an on-screen picker. Make each mode linkable (`/display#energy`, `#home`, `#travel`) so each device can open its favourite. Optionally auto-rotate every few minutes.
  - **Energy:** the current wall view, with Agile now, the cheapest window, grid carbon, Home Mini live draw and today's cost.
  - **Home:** clock, date, weather now and next 12 hours, sunrise and sunset, bin day, calendar.
  - **Travel:** next trains and trams from the nearest stations, with "leave by" countdowns.
  - **Screensaver:** things moving across the screen.
    - Drifting planets that carry live numbers (price, temperature, next train).
    - The odd comet.
    - A slowly orbiting clock.
    - It kicks in after a few idle minutes and wakes on any key.
  - **Night:** a very dim clock and price, from a set time.
- **A password lock on the front page.** See "Password lock" below for the options and their trade-offs.
- **Ten-foot UI rules for the TV.**
  - Text at least 24px at 1080p.
  - Obvious focus rings.
  - Every action reachable with arrows and Enter.
  - Nothing that needs a mouse hover.
  - Keep a safe margin around the edge for TVs that overscan.
- **Unattended screens should look after themselves.**
  - Reload once a night.
  - Hold a wake lock where allowed.
  - Recover quietly after the wifi drops.
  - Show "last updated" when data is stale.

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

## 2. Move the dashboard to Astro

Rebuild the five tabs as Astro pages with small interactive islands. Svelte suits the charts and forms.

- `src/analysis.js` is already pure and can move across as-is into `src/lib/`, with tests.
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
