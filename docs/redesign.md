# A full redesign of everything: the plan

**Status:** proposed, October 2026, and still being worked out. Nothing here is built.

"Everything" means:
- the dashboard;
- the household display: Energy, Home, Travel, the screensaver and Night;
- the lock screen and how screens get set up;
- the code that holds them together.

## Decided so far

| Question | Kyle's answer | What it means |
|---|---|---|
| Which screen comes first? | **Phone** | Every page is designed at 390px wide first, then widened for a laptop. The TV and wall tablet come after the phone pages. |
| How strong a theme? | **Calmer** | Same colours, fonts and starfield; more space, one card style, glow only on what's live or what matters now. |
| What are pages called? | **Plain** | Now, Money, Usage, Home, Settings. |
| Who uses the phone pages? | **Just Kyle** | Pages can lead with energy and money detail. They don't need simplifying for anyone else. |
| Now's twelve-hour strip | **Energy, plus markers** | The price curve and carbon, with small markers for rain, the next event and the next train. |
| Card corners | **Show both** | The mock-ups show sharp (3–4px) and rounded (14px) side by side; Kyle picks. |
| Appliances first in "Run it now or later?" | **No preference** | Default: washing machine, dishwasher, tumble dryer (the long, movable loads). Changeable in Settings › Appliances. |
| Anything to drop? | **The EPC search** | The rating is known: E. The certificate stays as a note; nothing else is dropped. |
| The TV | **Working; leave it for now** | The display stays as it is while the phone pages are redesigned. Rebuilding its modes waits until it's wanted. |

Nothing is open now.

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
- **The dashboard's pages follow the old file, not the questions you ask.** "Prices" mixes the live draw, market prices and what a kettle costs. On a phone, the first screen is the header's four buttons and two tariff cards that change twice a year.
- **Every panel shouts at the same volume.** The same frame, eyebrow and capital heading everywhere, so nothing says where to look.
- **Household things live only on the TV.** Bins, the calendar and trains are on the display; on a phone, where you'd check a train, they're missing.
- **Answers are worded differently on each screen.** The best ideas from the screensaver (time is distance, the fuel dock, your train at the platform, the dials) exist only in the screensaver. The display's Energy mode and the dashboard's Prices page answer the same questions in different words.
- **The what-ifs start with a form.** The battery and solar simulators ask for numbers before showing anything, and their answers can't be compared side by side.
- **Setting up a screen means two systems.** The account is typed into one, the screen's settings into another, and a setup link carries only half.

## What it should be

One product, the **Harold Street** household app, on three kinds of screen, answering the same questions in the same words and colours:

| Screen | How it's used | Its job |
|---|---|---|
| **Phone** (first) | Picked up, looked at, put down; sometimes explored | Answers and decisions: is now a good time, how's the month, what's unusual, what would save money |
| **Laptop** | Sat down with, now and then | The same pages, wider: room for longer charts and side-by-side comparisons |
| **TV and wall tablet** | Seen across the room; remote or touch | The day at a glance, readable at ten feet, then the screensaver |

Principles for every screen:
1. **One clear answer first**, then the evidence, then the detail. On the TV, only the answer and the evidence.
2. **Time runs left to right, now near the left**, as in the screensaver. One picture of the next twelve hours (price, weather, events, trains) appears on the phone's Now page, the display's Energy mode and in the screensaver.
3. **Colour means one thing:**
   - amber for electricity, cyan for gas;
   - violet below zero, and for your calendar;
   - green, amber and red for cheap, normal and peak.
4. **Calmer:** space and type do the work. Glow is kept for live things.
5. **Nothing lost:** every feature today has a home in the table below. Anything moved is noted in the log as it moves.

## Every feature's new home

### The dashboard today

| Today | Feature | New home |
|---|---|---|
| Bridge | Status, Refresh | A slim header on every page: page title, a status dot ("Updated 13:10"), Refresh |
| Bridge | Connect account, Forget | **Settings › Account** |
| Bridge | Wall display link | **Settings › Screens** |
| Bridge | Plunge pricing banner, notifications | **Now** (banner when coming up); notifications in **Settings** |
| Overview | Tariff cards | **Money › Your tariff** (rates and standing charges, collapsed to one line each) |
| Overview | Period totals | **Usage** (kWh) and **Money** (£), each with its own period |
| Overview | Daily chart with change-log marks | **Usage** |
| Overview | Bill tracker, Direct Debit check | **Money**, at the top |
| Overview | Price cap countdown | **Money › Your tariff** |
| Overview | Saving Sessions and Octopoints | **Money › Rewards**; an upcoming session also on **Now** |
| Overview | Weekly mission log | **Money › This week**, with Copy |
| Patterns | Use by half hour, insights | **Usage › Your day** (the clock face) |
| Patterns | Boiler schedule check | **Usage › Heating** |
| Patterns | Spike detective | **Usage › Unusual** |
| Patterns | Carbon footprint | **Usage › Carbon** |
| Patterns | Gas against the weather, forecast | **Usage › Heating** |
| Prices | Home Mini live draw | **Now**, near the top |
| Prices | Agile today and tomorrow, region | **Now** (the curve); region in **Settings** |
| Prices | Grid carbon forecast | **Now** (a band under the curve) |
| Prices | Best time to run | **Now › Run it now or later?** |
| Prices | What things cost (editable kWh) | **Now › Run it now or later?**, expanded; editing the kWh in **Settings › Appliances** |
| Compare | Tariff comparison, Agile looking back | **Home › Upgrades › Tariffs** |
| Compare | Battery simulator | **Home › Upgrades › Battery** |
| Compare | Solar simulator | **Home › Upgrades › Solar** |
| Home | Change log | **Home › Changes** (still marked on the Usage chart) |
| Home | Insulation and heating plan | **Home › Upgrades › Insulation** |
| Home | EPC ratings and notes | **Home › Upgrades › Certificate**: E now, with the potential rating and the recommendations |
| Home | EPC search | **Dropped.** Kyle knows the rating (E), and the search only worked through the home server helper. `src/lib/epc.js` and the helper's EPC route go too. |
| Home | CSV export, helper notes, install tips | **Settings › Data** |

### The display today

| Today | Feature | New home |
|---|---|---|
| Energy mode | Price now, next day, cheapest, carbon, live draw, today's cost | **Energy**, rebuilt on the twelve-hour strip and the dials |
| Home mode | Clock, weather, sunrise and sunset, bins, calendar | **Home** on the display; bins, calendar and weather also on the phone's **Home › Household** |
| Travel mode | Trains and trams with "leave in" | **Travel** on the display; also on the phone's **Home › Household** |
| Screensaver | The voyage | Stays; takes the shared colours, strip and wording |
| Night | Dim clock and price | Stays; adds the morning's verdict |
| Settings sheet | Modes, timings, detail, bins, calendar, station, walks | **Settings** in the shared model; the TV keeps its remote-friendly sheet |
| Setup link | Copies one screen's settings | **Settings › Screens › Add a screen**, carrying the account too if you choose |

## The phone pages, top to bottom

Each page opens on its answer; everything below it scrolls. Sections marked *(folded)* start closed.

### Now

1. **Header:** "Now", the status dot, Refresh.
2. **The verdict,** one line, coloured by price:
   - "Good time: 12.4p until 16:00";
   - "Wait: 31.2p now, 9.8p from 21:00";
   - "You're paid to use power: −2.1p until 03:30".
3. **The next twelve hours:** one strip, full width.
   - The Agile curve, filled below, coloured by band.
   - The cheapest two hours shaded and labelled.
   - Now marked at the left.
   - Grid carbon as a thin band beneath.
   - Rain, your next event and the next train as small markers on top.
   - Tap anywhere for that half hour's price.
4. **Right now:** three stats in a row:
   - live draw in watts, as a small dial;
   - today so far, £ and kWh;
   - grid carbon now.
5. **Coming up** (only when there is something):
   - plunge pricing;
   - a Saving Session you could join;
   - tomorrow's prices arriving ("Tomorrow's prices are in: cheapest 02:00").
6. **Run it now or later?:** the washing machine, dishwasher and tumble dryer by default (changeable in Settings), each with the cost now, the cheapest start and its cost. *(folded)* All appliances.
7. **Example data** banner at the very top when no account is connected, with **Connect your account**.

### Money

1. **This month:** "£84 so far · on track for £131", with a small bar against last month's total.
2. **Direct Debit:** "Your £120 a month looks about right", or how far off it is. The amount is editable in place.
3. **The year ahead:** projected total, the cost per month, and how gas is projected (weather or recent).
4. **Your tariff:** one line each for electricity and gas (unit rate, standing charge), and the price cap countdown. *(folded)* Meter numbers and tariff codes.
5. **Rewards:** Octopoints, Saving Sessions joined and coming up.
6. **This week:** the weekly log with Copy.

### Usage

1. **A period chooser:** 7, 30 or 90 days, and "compared with the period before".
2. **The headline:** "Electricity 301 kWh (−8%) · Gas 440 kWh (+12%)" for the period.
3. **Every day:** the daily chart, kWh or £, with the previous period ghosted behind and change-log marks.
4. **The year:** a calendar heat map of every day with readings; tap a day for its detail.
5. **Your day:** use by time of day drawn round a clock face, with the cheap overnight window and the evening peak marked. Under it, the insights: always-on watts, overnight share, peak share, evening kWh.
6. **Heating:**
   - the boiler's usual hours and the overnight check;
   - gas against the weather and the forecast week.
7. **Unusual:** half hours and days well above normal.
8. **Carbon:** the period's footprint.

### Home

1. **Household:**
   - bins due (next collection and which bins);
   - today's and tomorrow's events;
   - the next trains (and trams, once there's a server) with "leave in";
   - the weather now and later.
2. **Upgrades:** one card per idea, all the same shape, each opening to its full simulator:
   - tariffs (the cheapest for your use, and Agile looking back);
   - battery;
   - solar;
   - insulation;
   - certificate (EPC): the rating, E, with its potential and the recommendations noted, and which upgrades would move it up.

   Each card shows three numbers: a year's saving, the cost, the payback. The cards are worked out from sensible defaults, so they show an answer before any form is touched.
3. **Changes:** the change log, with each entry's before and after.

### Settings

- **Account:** connect or forget, gas meter units, how you pay, region.
- **Notifications:** negative prices, Saving Sessions.
- **Household:** bins, station and walk time, tram stop, calendar address. Shared settings come from `household.json`; changes made here stay on this device.
- **Appliances:** the kWh for each.
- **Screens:**
  - **Add a screen:** a link that sets up the TV or tablet. It carries the account if you choose, encrypted with the site PIN.
  - The wall display link.
  - Screensaver detail.
- **Data:** download readings (CSV), clear what's cached, the home server helper's status.
- **About:** the estimates note and the gas conversion, as in today's footer.

## Navigation and the frame

- **Phone:** a bottom bar with five items (icon and label): Now, Money, Usage, Home, Settings.
  - Fixed, above the safe area.
  - The current one is lit in cyan.
  - Pages are links, so the browser's back button works.
- **Laptop (900px and wider):** the bar becomes a rail down the left. Pages use two columns where it helps: Now puts the strip beside the stats, Usage puts the chart beside the heat map.
- **Header:** slim on every page: the page's title in Syncopate, the status dot, Refresh. No buttons beyond Refresh. The starfield sits behind, slower and dimmer than now.
- **Install:** the app can be added to the phone's home screen as now. In standalone mode the bottom bar sits above the home indicator.

## Loading, empty and error states

| State | What you see |
|---|---|
| **First visit, no account** | Example figures with the banner at the top of Now: "You're looking at example data", and **Connect your account**. Figures quoted elsewhere say "example". |
| **Opening again** | The cached figures straight away, with "Updated 13:10" in the header; the dot pulses while it fetches. |
| **Loading, nothing cached** | Grey placeholder shapes where the figures will go, never a blank page. |
| **A source fails** | That card says what's missing in a line ("Couldn't reach National Grid: trying again in 5 minutes"); everything else carries on. |
| **Offline** | The cached figures, the header says "Offline · last updated 13:10". |
| **Not set up** (no Home Mini, no station) | The card says how to set it up and links to Settings. |

## How it looks

A first set of tokens, to be tried in the mock-ups:

| Token | Value | Notes |
|---|---|---|
| Ground | `#04050d` | As now |
| Card | `rgba(14,18,40,.72)`, 1px border `rgba(134,152,255,.14)`, radius 14px | One style; no corner brackets |
| Text | `#e9ecff`; muted `#9aa2c8` | Muted lifted for contrast (at least 4.5:1 on the card) |
| Electricity | `#ffb547` | As now |
| Gas | `#4fd6ff` | As now; also the accent for what's selected |
| Below zero, calendar | `#b892ff` | As now |
| Cheap, normal, peak | `#46e6a1`, `#ffd166`, `#ff6b7d` | As now; shared with the TV |
| Type (phone) | 13, 15, 17, 20, 28 and 40px | 40px only for the page's main figure |
| Spacing | 4, 8, 12, 16, 24 and 32px | Cards 16px inside, 12px apart |
| Fonts | Syncopate (titles, the main figure), Exo 2 (reading), JetBrains Mono (figures) | As now |

The same tokens drive the TV at ten-foot sizes: text from 0.9rem (24px at 1080p), the same colours, larger spacing.

**The chart kit** (Svelte, one style):

| Part | Used for |
|---|---|
| **Strip** | The next twelve hours: curve, bands, markers |
| **Curve** | Prices and carbon over a day or two |
| **Bars** | Daily use, with a ghosted comparison |
| **Heat map** | Days of the year |
| **Clock face** | Use by time of day |
| **Dial** | Live draw |
| **Sparkline** | Inside stat cards |
| **Scatter** | Gas against temperature |

Every chart reads the same way:
- tap or point for a label beside your finger;
- arrows on a keyboard;
- units always shown;
- a one-line text version of its main point for screen readers.

**Motion:** numbers count up once when they arrive; only live things pulse; nothing moves under reduced motion.

## Under the hood

- **The phone pages come first, on the Astro build we have now.** The display keeps its own file until the phone is done.
- **One data service:** the dashboard's session and the display's scheduler merge. Each source has its own refresh period, a cache, backing off on failure, and "last updated". Every page loads from the cache first.
- **One settings model:**
  - household (in `household.json`, published);
  - account (per device, never published);
  - screen (per device).
- **The TV is left as it is for now.** It works, so it waits until the phone is done and the redesign is wanted there. When that comes, a small Svelte page built for the TV's browser is tried first. That decides whether its modes become Astro pages too, or keep their own file with the shared look.
- **Tests and screenshots:**
  - Every page at 390px (phone), 768px (tablet) and 1280px (laptop), connected and with example data, plus the TV at 1080p.
  - No sideways scroll, no errors, contrast checked.
  - The screensaver's frame-rate budget is kept.

## How it gets built

Each step ships on its own, and the old page stays until its replacement is live. `npm run ci` is green at every push and the screenshots are looked at.

The phone first:

| Step | What | Size |
|---|---|---|
| 1 | **Mock-ups** of Now, Money and Usage at phone size, clickable between them, with real example figures, sharp and rounded corners side by side. Your yes, or changes. | One session |
| 2 | **The kit:** tokens, card and stat styles, the chart parts, and a hidden page showing every piece | One or two sessions |
| 3 | **The shell:** bottom bar and rail, slim header, Settings (account moves there), the example banner, loading and error states | One session |
| 4 | **Now**, which becomes the first page | One session |
| 5 | **Money** | One session |
| 6 | **Usage** | One session |
| 7 | **Home:** household and upgrades | One or two sessions |
| 8 | **Tidy-up:** retire the old pages, update the brief, the log and a decision record | Short |

Later, when wanted:
- **One data service and settings model** shared with the display, and "Add a screen".
- **The display's modes** (Energy, Home, Travel, Night) on the same parts, after a test on the TV.
- **The screensaver and the lock screen:** the shared colours, strip and wording; the keypad restyled.

## Questions still open

None. The plan is ready for step 1, the mock-ups, when Kyle says so.
