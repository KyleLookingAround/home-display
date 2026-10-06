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
- **Time is distance** ([decision 0007](docs/decisions/0007-time-is-distance.md)):
  - the road ahead: the price landscape, weather fronts and calendar beacons for the next twelve hours;
  - the fuel dock at the cheapest two hours;
  - your train stopping at the platform when it's time to leave;
  - dials in the cabin for live draw, today's cost and grid carbon.
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

## 2. Move the dashboard to Astro (built, October 2026)

The five tabs are Astro pages made of small Svelte islands ([decision 0009](docs/decisions/0009-astro-dashboard.md)).
- `analysis.js` moved across as-is into `src/lib/`. `core.js` split into one module per service there.
- The display's build flattens those modules, so the display is still one file for TV browsers.
- The design tokens are a global stylesheet, now `src/styles/app.css`.
- The islands share one state object. The account's data is cached in the browser, so moving between pages doesn't fetch it again.

Still to do here:
- ~~A full redesign of everything~~: built and live since 06/10/2026, the phone pages ([decision 0010](docs/decisions/0010-redesign.md), plan in [docs/redesign.md](docs/redesign.md)) and the wall display ([decision 0011](docs/decisions/0011-wall-display.md)).
- ~~A comparison that remembers its last run~~: built; the tariffs card compares itself weekly.

## 3. A small backend

A Cloudflare Worker on the free tier, or `server.py` grown up on the home server:

- Proxies the APIs that don't allow browser calls, and holds the Octopus key as a secret so displays don't need it.
- Runs scheduled jobs:
  - A push alert when Agile goes negative or a Saving Session is announced.
  - A Monday "mission log" email.
  - A nightly copy of readings into a database, so history outlives Octopus's retention.
- Would also unlock these, which block browsers (checked October 2026):
  - **Flights overhead.** Live positions from adsb.lol or adsb.fi for the area around Stockport (both answer, but send no CORS header; OpenSky allows only its own site), with routes and aircraft from adsbdb, which browsers can already read. Stockport sits under Manchester's westerly approach, so planes pass low every few minutes. Shown as an "Overhead now" card, a TV heads-up for something notable, and real traffic in the cockpit.
  - **Met Office weather warnings** for the North West (the regional RSS has no CORS header).
  - **Trams (TfGM) and Google Calendar**, as above.
  - **A shared shopping list and chores** every phone and the TV can edit (Worker storage).
  - **setlist.fm** for the music player (key required, no CORS).

## 4. A music player (proposed, October 2026)

Kyle listens on the TV's app, Google speakers and Bluetooth from his phone. Qobuz has no API a site can use (its embed widget plays 30-second previews only; its keys aren't issued any more), and neither the TV's apps nor Google's speakers can be controlled by another app. Spotify can: its Web API signs in from the browser with no secret (PKCE, CORS allowed for the site, checked) and controls any Spotify device, including the TV app and Google speakers. Kyle chose Spotify. The proposal, with a working mock-up, was shared as a private page on 06/10/2026.

- **The player:** a now-playing strip above the tabs on every page, tinted to the cover; tap it for the full player (cover, scrub, shuffle and repeat, like); "Play on…" with each device's volume; a Music tab (search, playlists, liked songs, albums, recently played); "Up next" (Spotify's queue is add-only for other apps).
- **Extras:** synced lyrics from LRCLIB (free, CORS checked); the app taking the cover's colours (Spotify's cover images allow it); artist pages (Wikipedia); listening stats with a clock and heat map; a code to share the song; playlists suggested by the weather.
- **The house:** a Music view on the TV and the cover in the cockpit; a party queue guests join by scanning a code (through the ntfy relay, no login); a sleep timer and bedtime fade with the night window; wake-up music that skips bank holidays; music fading when it's time to leave for your train; favourite playlists on the remote's number keys.
- **Discovery, stories and play** (sources checked from the site; Spotify's own recommendations are closed to new apps):
  - "More like this" radio from Last.fm and ListenBrainz similar artists (CORS; Last.fm needs a free key), played from their Spotify top tracks.
  - New releases from your artists on release Friday (ListenBrainz fresh releases, Spotify artist albums).
  - Gigs by your artists in Manchester (Ticketmaster, free key).
  - Song story and credits: MusicBrainz (writers, producers, studio, year; CORS) and Genius (free key, CORS), with a badge for Greater Manchester artists or Strawberry Studios, Stockport.
  - Liner notes: full covers and booklet scans from the Cover Art Archive (CORS) on the TV.
  - This time last year, from a nightly log the TV keeps of what played (Spotify only returns the last 50).
  - Radio in the same player, from the Radio Browser directory (CORS); played by the phone or the TV itself, not sent to the Google speakers.
  - A house queue the TV holds and feeds to Spotify one song ahead, so songs can be reordered, removed and voted on.
  - Neighbour mode (volume capped in the night window); a free electricity party when Agile goes negative.
  - Rain or brown noise made on the device to match the weather, for sleep.
  - Name that tune on the TV from your most-played songs, with Deezer's 30-second clips (no CORS, but JSONP and audio playback work) and phones as buzzers.
  - Vinyl mode and a record shelf; who's listening (each person's own Spotify); an album wall in the screensaver.
  - Not usable: song.link's public API is closed; setlist.fm needs the Worker; Deezer's tempo field is often 0, so it can't drive beat-matched visuals.
- **Limits:** control needs Premium; no beat-matched visuals (Spotify stopped giving new apps audio features and analysis in November 2024); Spotify-made playlists can't be opened by new apps; phones can be a remote but not the speaker inside the site (the Web Playback SDK is desktop only).
- **Setup:** a free Spotify developer app (development mode is fine for one household), a sign-in on the phone, and the token sent to the TV sealed with the PIN.
- **Kyle's picks (06/10/2026), built in five stages on the `music` branch:**
  1. the player: the strip, the full player, Play on, the Music tab, Up next, Now's controls, cover colours, synced lyrics (built);
  2. the artist page, the song's story and credits with a Made in Greater Manchester badge, a code to share the song, liner notes, vinyl mode and a record shelf (built);
  3. the TV: the sign-in sent sealed, a Music view, Today's strip, the cover and an album wall in the cockpit, favourites on the number keys, a sleep timer and bedtime fade (built);
  4. the house queue (reorder, remove, vote), the party queue, and who's listening (built; [decision 0013](docs/decisions/0013-house-queue.md));
  5. More like this, new releases, gigs, weather radio, and your listening (top artists and tracks, a listening clock and heat map) (built; [decision 0014](docs/decisions/0014-finding-music.md)).
- **Design, at Kyle's request:** the UI and UX must be exceptional. Each stage ends with its own design pass (screenshots looked at and refined before it's pushed), and a full design pass over the whole player follows the last stage (next) ([decision 0012](docs/decisions/0012-music-player.md) has the principles).
- Music is a sixth tab, between Home and Screen.

## 5. More data (ideas, checked October 2026)

Each was tried from the site's address; "browser" means it answers with a CORS header, so it needs no server.

| Idea | Source | Works from | Where it would show |
| --- | --- | --- | --- |
| The grid's live frequency, national demand, wind | Elexon BMRS (`/system/frequency`, about 30 s behind) | browser, no key | a twitching 50 Hz needle on the cockpit's dashboard |
| Aurora alerts | AuroraWatch UK (Lancaster University), NOAA SWPC Kp | browser, no key | a heads-up when it's likely and clear; the cockpit's aurora only when real |
| The ISS's real orbit and visible passes | CelesTrak | browser, no key | a heads-up ("crosses SW to NE at 21:14"); the cockpit's ISS on its true path |
| Rocket launches | Launch Library 2 (The Space Devs; 15 calls an hour free) | browser, no key | a cockpit billboard with a link to watch |
| Stargazing tonight | Open-Meteo cloud cover with the moon and planets worked out here | browser | Night and the cockpit |
| Stockport County | TheSportsDB (County is team 134258, League One; live scores need its paid key) | browser, test key | fixtures, kick-off countdown and results on Today; a matchday heads-up |
| The Mersey at Stockport | Environment Agency flood monitoring readings | browser, no key | a river-level graph beside the flood warnings |
| Friday takeaway picker | Food Standards Agency ratings | browser, no key | a "spin the wheel" of 4 and 5-star places nearby |
| Quiz night | Open Trivia DB, with phones as buzzers through the ntfy relay | browser, no key | the TV |
| Is it the Wi-Fi or Virgin? | Cloudflare's speed test | browser, no key | the TV tests hourly and graphs the evenings |
| On this day | Wikimedia's feed | browser, no key | the night clock or a billboard |
| Gigs by artists you play | Ticketmaster Discovery (free key), with Spotify's top artists | needs a key | Music and Home |
| Power cuts on your street | Electricity North West's `live_incidents` dataset | refused without an account key; not yet confirmed free | a heads-up |
| Met Office warnings, flights overhead | see the backend, above | needs the Worker | heads-ups |

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
