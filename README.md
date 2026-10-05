# Harold Street Energy

A home energy dashboard for your Octopus account, and a household display for the wall tablet, phones and the TV.

- **Dashboard** (`index.html`): usage, costs, Agile prices, grid carbon, tariff comparison, battery and solar simulators, and planning tools for the house.
- **Display** (`display.html`): five full-screen modes made for a screen across the room. It runs entirely in the browser from GitHub Pages; no home server is needed.
  - **Screensaver: the voyage.** You're sitting in a ship's cabin, looking out of a side window as space goes by. It's what a screen shows when nobody's using it.
    - **Things going by:** everything slides past from right to left. Near things go faster than far ones, so the layers of stars, nebulae, planets and traffic give it depth.
    - **The Harold Street Express:** every few minutes a space train passes with one fact on each carriage: the price, the cheapest hours, grid carbon, the weather, sunset, what's coming up.
    - **Billboards:** holographic beacons for what you need to catch: bins, the next train, rain on the way, a price worth knowing about.
    - **Your house on an asteroid:** it drifts by now and then. The windows glow brighter the more power you're using, the chimney smokes when it's cold, the porch lantern shows the price, and the bins are out the evening before collection.
    - **Nature tells the story:**
      - the aurora when the grid is clean;
      - a comet with a tail in the colours of the bins going out, on bin night;
      - the moon in its real phase;
      - the real International Space Station when it's passing over Stockport.
    - **Wildlife and traffic:** whales, jellyfish and birds of light; satellites, freighters, stations and asteroids; now and then something huge sweeps right past the glass.
    - **Weather:**
      - Rain beads on the glass and is swept backwards as you move.
      - Snow sticks, and frost creeps in when it's cold.
      - Fog mists the window, thunder flashes, and wind rocks the cabin and sends debris tumbling past.
      - The sun, moon, dawn and dusk follow Stockport's sunrise and sunset.
    - **Power price:** it sets the ship's speed. Warp when you're paid to use power, and the stars streak; slow at peak price. High grid carbon hazes the view.
  - **Energy:** Agile price now, the next day's prices, the cheapest two hours, grid carbon, Home Mini live draw and today's cost.
  - **Home:** clock, date, weather now and for the next 12 hours, sunrise and sunset, bin day and your calendar.
  - **Travel:** live trains from your station, with "leave in 6 min" countdowns that allow for the walk.
  - **Night:** a very dim clock and price, from a set time.

## The display

Open https://kylelookingaround.github.io/home-display/display.html, or use the Wall display button on the dashboard. Each mode has its own link, so each screen can open its favourite: `display.html#energy`, `#home`, `#travel`, `#screensaver` or `#night`.

To see the cockpit in any weather, add it to the link. For example, `display.html#screensaver&wx=thunder&phase=night` or `#screensaver&price=-3`:
- `wx`: clear, cloud, rain, drizzle, snow, fog, thunder, wind or cold;
- `phase`: dawn, day, dusk or night;
- `price`: any Agile price in pence;
- `show`: bring things into view straight away, such as `show=train,house,aurora,comet`. Also `whales`, `jellies`, `birds`, `iss`, `moon`, `traffic` and `flyby`.

| On a TV remote or keyboard | What it does |
|---|---|
| Left and right | Previous or next mode |
| 1 to 5, or the red, green, yellow and blue buttons | Jump to a mode |
| Up, down or Enter | Show the toolbar: mode picker, settings, full screen |
| Back | Close settings or the toolbar |
| S, F | Settings, full screen |

On a phone or tablet, swipe left or right to change mode and tap to show the toolbar.

### Bins

Your bins are in [`household.json`](household.json), taken from the council's printed calendar. Collection day is Friday:
- **Green:** every week.
- **Black:** every other week.
- **Blue and brown:** together, every four weeks.

Every screen works these out with no API at all. If the council sends a new calendar (from December, blue goes to every two weeks), change the dates and the weeks between collections there.

**The weekly council check (optional).** Stockport Council has no API, but its bin page for your address lists each bin's next date. Every Saturday morning a GitHub Action reads it and publishes just the dates as `bins.json`. Each repeat then carries on from the council's latest date, so a bank holiday change shows up.

To turn it on, add your property reference as a repository secret:
1. Go to Settings → Secrets and variables → Actions → New repository secret.
2. Name it `STOCKPORT_UPRN` and paste the number from the end of your bin collections page address, before the address part.

Your address is never published: only the dates are. GitHub pauses scheduled jobs after 60 days without a commit; the repeats in `household.json` keep working regardless.

### Settings

**Settings every screen shares** live in [`household.json`](household.json): your bins, station, walk time and the mode screens open on.
- Edit it on GitHub (open the file, press the pencil, commit). Screens pick it up at their next fresh start.
- It's published with the site, so keep anything private out of it.

**Each screen** can also change things for itself in its settings, and only those changes are kept on that device. Set a screen up on your phone, then use **Copy setup link** and open the link on the TV to copy everything across. In the settings you can:
- choose the mode the screen opens on;
- rotate between energy, home and travel;
- set when the screensaver and night clock start;
- change the bins for that screen (one known collection date and how often each comes);
- add your calendar's secret iCal address;
- pick your station and tram stop, and how long the walk is.

Unattended screens look after themselves:
- They reload once a night (03:30 by default).
- They keep the screen awake where the browser allows it.
- They retry quietly when the wifi drops.
- They say "last updated 13:10" when something is out of date.

Live draw and today's cost come from your Octopus Home Mini. They use the account you connected on the dashboard in the same browser.

## Where the data comes from

Everything below works from the published site, in the browser, with no server:
- **Octopus:** prices, your account, the Home Mini.
- **National Grid:** the carbon forecast.
- **Open-Meteo:** the weather.
- **National Rail:** live trains, through [Huxley2](https://huxley2.azurewebsites.net), a free community service.
- **Where the ISS is:** [wheretheiss.at](https://wheretheiss.at).

A few things can't be fetched by a web page:
- **Metrolink times:** TfGM refuses browser calls.
- **Google Calendar:** its secret iCal address refuses browser calls. Calendars from hosts that allow them work.
- **PVGIS solar data and the EPC search** on the dashboard.

These need a small server: the backend in `ROADMAP.md` item 3, or `server.py` on a home server if you ever have one. Until then, the display leaves them out and says what's needed.

## Running the helper on a home server (optional)

1. Copy this whole folder to the server.
2. Run `python3 server.py` (Python 3.8+, nothing to install).
3. Open the address it prints, such as `http://192.168.1.20:8787`, or `http://192.168.1.20:8787/display.html` for the display, on any device at home.
4. On your phone, use Add to Home Screen to install either one like an app.

The helper only forwards requests to a fixed list of services:
- Octopus
- PVGIS
- the EPC register
- National Grid's carbon API
- Open-Meteo
- Google Calendar's iCal feeds
- Realtime Trains
- TfGM

It never serves dotfiles, its own code or notes. Keep it on your home network and don't forward its port on your router.

### Train and tram keys

These are only needed with a home server. Trains already work without one. The keys stay on the server and never reach a browser: Realtime Trains doesn't allow its token in a web page. Create a file called `.env` next to `server.py`:

```
RTT_TOKEN=your Realtime Trains access token
TFGM_KEY=your TfGM subscription key
```

- **Realtime Trains:** sign up at https://api-portal.rtt.io. If you're given a refresh token instead of an access token, use `RTT_REFRESH_TOKEN=` and the helper swaps it for access tokens as needed.
- **TfGM (Metrolink):** register at https://developer.tfgm.com and subscribe to the Open Data product.

`.env` is ignored by git. Restart the helper after changing it; it prints whether each key is set.

To keep the helper running after you log out, add it as a service. For example, with systemd, create `/etc/systemd/system/harold-energy.service`:

```
[Unit]
Description=Harold Street Energy
After=network-online.target

[Service]
WorkingDirectory=/path/to/home-display
ExecStart=/usr/bin/python3 server.py
Restart=on-failure
User=youruser

[Install]
WantedBy=multi-user.target
```

Then run `sudo systemctl enable --now harold-energy`.

## Publishing

Every push to `main` is checked (`npm run ci`) and published to GitHub Pages by `.github/workflows/pages.yml`. Only the two pages, `household.json`, the manifests and the icons are published, not the source or the helper.

**The lock.** Add a repository secret called `SITE_PASSWORD` (Settings → Secrets and variables → Actions). It can be a numeric PIN. From the next push, the published pages are encrypted with StatiCrypt. They open with an on-screen keypad you can drive with the TV remote's arrows, and "Remember this screen" means each device asks only once. Without the secret the site is published unlocked, and the workflow says so.

What the lock does and doesn't do:
- It keeps visitors out of the published site.
- It can't hide the code, because the repository is public.
- A short PIN could be guessed offline by someone determined. Nothing private is in the pages anyway: your API key, calendar address and settings stay in each device's browser.

## Your data

Your API key, Direct Debit amount, change log, appliance figures, EPC notes and display settings are stored in the browser you use, not on the server. Each device needs connecting once. Download readings to CSV from the Home tab if you want a permanent record.

## What may need adjusting

These parts use features that aren't fully documented, so they're the most likely to need a tweak:

- Live readings from an Octopus Home Mini
- Saving Sessions and Octoplus points
- The EPC search (the government moved to a new data service in 2026)
- Metrolink departures (TfGM's field names come from community code)

If one of these shows an error, the rest keeps working.

## What's in the folder

| Path | What it is |
|---|---|
| `index.html`, `display.html` | The dashboard and the display. Built from `src/`; don't edit them directly. |
| `src/` | Dashboard source: styles, markup, data code, analysis, interface, starfield. |
| `src/display/` | Display source: styles, markup, household data sources, the cockpit, modes and remote control. |
| `build.py` | `python3 build.py` rebuilds both pages from `src/`. |
| `server.py` | Home server helper. |
| `lock/` | The lock screen template and `publish.sh`, which builds the folder Pages publishes. |
| `household.json` | Settings every screen shares. |
| `package.json` | `npm test`, `npm run test:browser`, `npm run shots` (screenshots in `tests/screens/`) and `npm run ci` (everything CI runs). |
| `tests/` | `*.test.mjs` check the maths and the display's logic. `*.browser.mjs` check phone and TV layouts, the remote, the cockpit and the lock. |
| `.github/workflows/` | Checks every push; publishes `main` to GitHub Pages. |
| `CLAUDE.md` | Brief for a Claude Code session. |
| `ROADMAP.md` | What's built and what's next. |
| `docs/` | Stack options, API notes, decision records (`docs/decisions/`) and a dated log (`docs/log.md`). |
| `manifest.webmanifest`, `display.webmanifest`, `icon-*.png` | For installing on a phone. |
