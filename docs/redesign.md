# A full redesign of everything: the plan

**Status:** proposed, October 2026. Nothing here is built. The questions at the end need Kyle's answers first.

"Everything" means:
- the dashboard;
- the household display: Energy, Home, Travel, the screensaver and Night;
- the lock screen and how screens get set up;
- the code that holds them together.

## Where things stand

It grew as two separate things.
- **The dashboard** is for a phone or laptop: five Astro pages of Svelte panels.
- **The display** is for the wall tablet and the TV: one hand-built file of plain JavaScript, kept simple for old TV browsers.

They share the data code and the colours, and little else.
- **Settings:** each has its own (the account on one, bins and trains on the other).
- **Navigation:** each has its own (tabs, and a mode switcher driven by the remote).
- **Loading data:** each has its own (a cache on the dashboard, a refresh scheduler on the display).
- **Charts:** each has its own (SVG bars, and canvas).

What isn't working:
- **The dashboard's pages follow the old file, not your questions.** "Prices" mixes the live draw, market prices and what a kettle costs. On a phone, the first screen is the header's four buttons and two tariff cards that change twice a year.
- **Every panel shouts at the same volume.** The same frame, eyebrow and capital heading everywhere, so nothing says where to look.
- **Household things live only on the TV.** Bins, the calendar and trains are on the display. On a phone, which is where you'd check a train, they're missing.
- **Answers are worded differently on each screen.** The best ideas from the screensaver ("time is distance", the fuel dock, your train at the platform, the dials) exist only in the screensaver. The display's Energy mode and the dashboard's Prices page answer the same questions in different words.
- **The what-ifs start with a form.** The battery and solar simulators ask for numbers before showing anything. Their answers aren't laid out alike, so they can't be compared.
- **Setting up a screen means two systems.** The account is typed into one, the screen's settings into another, and a setup link carries only half.

## What it should be

One product, the **Harold Street** household app, on three kinds of screen, answering the same questions in the same words and colours:

| Screen | How it's used | Its job |
|---|---|---|
| **Phone and laptop** | Picked up, looked at, put down; sometimes explored | Answers and decisions: is now a good time, how's the month, what would save money, when to leave |
| **Wall tablet** | Glanced at in passing, touched now and then | The household's day at a glance, by touch |
| **TV** | Seen from the sofa, steered with a remote | Ambient: the same day, readable across the room, then the screensaver |

Principles for every screen:
1. **One clear answer first**, then the evidence, then the detail. On the TV, only the answer and the evidence.
2. **Time runs left to right everywhere**, with now near the left, as in the screensaver. One picture of the next twelve hours appears on the phone's Now page, the display's Energy mode and in the screensaver: price, weather, events, trains.
3. **Colour means one thing:**
   - amber for electricity and cyan for gas;
   - violet below zero;
   - green, amber and red for cheap, normal and peak;
   - violet for your calendar too.
4. **Keep the theme** (deep space, the starfield, glow for what's live), but calmer: space and type do the work, glow is kept for now.
5. **Nothing lost.** Every feature today has a place below. Anything moved is noted in the log as it moves.

## What's where

### Phone and laptop

Five places, named for what you go there for. A bottom bar on a phone, a side rail on a laptop.

| Place | The question | What's on it |
|---|---|---|
| **Now** (first page) | Is now a good time? What's next? | See below. |
| **Money** | How are we doing this month? | This month against last and where it's heading; the Direct Debit check; your tariff and the price cap countdown; Saving Sessions and Octopoints; the weekly log to copy. |
| **Usage** | When do we use it? Anything odd? | See below. |
| **Home** | What's on, what's due, what would save us money? | See below. |
| **Settings** | | See below. |

The places in more detail:
- **Now:**
  - a verdict in one line ("Good time: 12.4p until 16:00");
  - the next twelve hours as one strip: the price curve with the cheapest window, rain, your events, the next train and when to leave;
  - the live draw and today's cost;
  - grid carbon;
  - bins due;
  - plunge pricing or Saving Sessions coming up.
- **Usage:**
  - a calendar heat map of every day with readings;
  - the daily chart, against a period you choose;
  - use by time of day drawn round a clock face;
  - the boiler check, the spike detective, gas against the weather, and the carbon footprint;
  - the change log's before and after.
- **Home:**
  - **Household:** bins, calendar, trains and trams, as on the display.
  - **Upgrades:** each idea as a scenario showing a year's saving, the cost and the payback. Tariffs, battery, solar, insulation, boiler settings and the EPC.
- **Settings:**
  - the account;
  - the household's shared settings (bins, station);
  - this device;
  - notifications, CSV export, the home server helper;
  - **Add a screen:** a code or link that sets up the TV or tablet with everything, the account included if you choose.

### The display (wall tablet and TV)

The same modes, rebuilt from the same parts, readable at ten feet, driven by remote or touch:
- **Energy:** the next twelve hours strip, big; the verdict; the dials (live draw, today's cost, grid carbon).
- **Home:** clock and date, weather now and through the day, bins, the calendar.
- **Travel:** the next trains and trams, with "leave in" countdowns, and your train highlighted as in the screensaver.
- **Screensaver:** keeps its recent redesign. It takes the shared colours and the same twelve-hour strip, and its billboards use the shared wording.
- **Night:** a dim clock with the verdict for the morning ("Cheapest from 02:00").
- **The toolbar and settings** move to the same Settings model as the phone, with the remote-friendly layout.

### The lock screen

The PIN keypad restyled to match, with the same remote-friendly behaviour. "Remember this screen" stays on.

## How it looks

- **Calmer cards:** one card style without corner brackets. The page's main answer gets the only large type and the only glow.
- **Two densities from one set of tokens:**
  - near (phone and laptop), with text from 15px;
  - ten-foot (TV), from 0.9rem, which is 24px at 1080p.

  Same colours, same shapes.
- **A shared kit of parts:**
  - verdict, stat and dial;
  - the twelve-hour strip;
  - price and carbon curves;
  - bars;
  - a heat map;
  - the clock face of use;
  - a sparkline;
  - departures;
  - bins.

  Each reads the same way: tap or point for a label by your finger, arrows on a remote or keyboard, units always shown.
- **Type:** Syncopate for titles and the one big figure; Exo 2 for reading; JetBrains Mono for figures that line up.
- **Example data:** one clear banner on the phone instead of a tag on every figure. The display still never shows examples.
- **Motion:** the starfield slower; numbers count up once when they arrive; only "live" things pulse. TVs get the lighter detail they already have.

## Under the hood

Recommendation, pending a test on the real TV:
- **One app, one build.** The display's modes become Astro pages too, built from the same Svelte parts.
- **TV compatibility:** the display's build is compiled down for the TV's browser (Vite targeting Chromium 63 or whatever the TV turns out to run). Its pages stay free of anything an old browser can't do.
- **Fallback:** if the TV can't run them, the display keeps its own hand-built file but takes the shared tokens and wording. That's a smaller win, but safe.
- **One data service** for both. Each source has its own refresh period, a cache, backing off on failure, and "last updated".
  - It merges the dashboard's session and the display's scheduler.
  - A screen loads from the cache first, so it's never blank.
- **One settings model:**
  - household settings (in `household.json`, as now);
  - account settings (per device, never published);
  - screen settings (per device).

  The setup link carries all three, encrypted with the site PIN if it includes the account.
- **One test harness:** every page and mode on a phone, a tablet, a laptop and a 1080p TV. Screenshots for each, and the frame-rate budget on a slowed CPU for the TV.

## How it gets built

Each step ships on its own, and the old page or mode stays until its replacement is live. `npm run ci` is green at every push and the screenshots are looked at.

| Step | What | Size |
|---|---|---|
| 1 | **Mock-ups** of Now, Money and Usage on a phone, and Energy and Home on the TV, as a page you can open and click through. Your yes, or changes. | One session |
| 2 | **The TV test:** a small Svelte page built for the TV's browser, opened on your TV. It decides between one app and the fallback above. | Short |
| 3 | **The kit:** shared tokens in both densities, the cards and the chart parts, and a hidden page showing every piece. | One or two sessions |
| 4 | **The data service and settings model**, under both the dashboard and the display, with nothing on screen changing yet. | One session |
| 5 | **The phone's shell:** the bottom bar and side rail, Settings, "Add a screen", the example banner. | One session |
| 6 | **Now** | One session |
| 7 | **Money** | One session |
| 8 | **Usage** | One session |
| 9 | **Home:** household and upgrades | One or two sessions |
| 10 | **The display's modes:** Energy, Home, Travel, Night, on the kit, with the remote and the ten-foot rules | Two sessions |
| 11 | **The screensaver and the lock screen:** the shared colours, strip and wording; the keypad restyled | One session |
| 12 | **Tidy-up:** retire the old pages and the old display file, update the brief, the log and a decision record | Short |

## Checks along the way

- **No sideways scroll:** on any screen size, and no errors.
- **Ten-foot rules on the TV:** text at least 24px at 1080p, the overscan margin, everything reachable with arrows, Enter and Back.
- **Accessibility:** contrast checked on the dark background, every chart readable by keyboard with a text version of its main point, and reduced motion respected.
- **Speed:** each page useful within a second from the cache. The TV holds its frame budget at the lighter detail.
- **Example data:** never shown on the display, and always labelled on the phone.

## Questions for Kyle

1. **Which screens matter most?** Phone, laptop, wall tablet or TV, in order. That decides which gets designed first.
2. **The theme:** keep it as intense as now, calmer as above, or bolder, like the screensaver throughout?
3. **Names:** plain (Now, Money, Usage, Home, Settings) or in character (Bridge, Ledger, Telemetry, Quarters, Systems)?
4. **One app for the TV too?** It's worth trying if the TV's browser can run it (step 2 finds out). Is it all right to keep the TV on its own file if not?
5. **Who uses it?** If others in the house use the phone pages too, Now should lead with what they need (bins, "good time to run the washing").
6. **Anything to drop?** For example the EPC search or the simulators, if nobody uses them. Less to redesign means a sharper result.
