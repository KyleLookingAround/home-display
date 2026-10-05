# 0011: The wall display redesigned, and the phone as its remote

**Status:** accepted, October 2026, on the `redesign` branch with [0010](0010-redesign.md).

**Context.** The phone pages had a new look and new data, and the wall display still had the old one: five modes of equal weight (Energy, Home, Travel, the screensaver and Night), each laid out on its own. Kyle asked for a complete redesign so that "every part of this app should feel put together", and to see the wall display on his phone and change what the TV shows from it. There is no home server ([0004](0004-no-home-server.md)), and the TV's browser is as old as Chromium 63 ([0002](0002-tv-browsers.md)).

**Decision.**
- **Today is the main view.** One glanceable screen:
  - the clock, the date and sunset;
  - the price verdict, worded exactly as on the phone (`priceVerdict`);
  - the weather;
  - up to three heads-ups (`headsUp`);
  - the next twelve hours as a price strip with the cheapest hours, rain, events and your train;
  - three cards: trains, today and tomorrow (bins, then the calendar), and right now (live draw, today's cost, grid carbon and its mix, air and UV).

  Energy (today and tomorrow's prices, the greenest hours, run it now or later) and Travel (trains and trams) are the detail. Old `#home` links and settings open Today.
- **One look.** The display uses the dashboard's colours, cards, labels, price tones, icons and corners setting, at ten-foot sizes. Its price strip is drawn as a string (`board.js`), since the TV can't run the dashboard's Svelte. The cockpit stays as the screensaver, unchanged; Night is restyled and names the next thing to act on.
- **The phone's Screen page** shows each view live, in a frame scaled from 1920 by 1080 (`display.html#<view>&embed=1`). Settings moved to a gear in the header, so the phone keeps five tabs.
- **The phone as a remote, through ntfy.sh.** A browser on the TV can't be reached from the phone directly, and there's no server.
  - ntfy.sh is a free publish-and-subscribe relay. It needs no account, allows browser calls, and the TV's browser can listen with `EventSource`.
  - The screen makes an eight-letter code, shows it in its settings, and listens on a topic named from it. The phone pairs by typing the code.
  - Only small requests go through it: change view, wake, start afresh, "what are you showing?". The screen's answer goes back the same way. Anything else is ignored, and a request for a view that doesn't exist too.
  - No prices, readings or settings pass through it. Someone who guessed a code could only change the view.
  - The one exception is the Octopus account, so the TV never needs the key typed with a remote. The phone seals it (AES-GCM) with a key made from what the lock keeps on each device unlocked with "Remember this screen" (the PIN, hashed) and the screen's code. The relay sees only the sealed box; a screen unlocked with another PIN can't open it, and without the lock there's nothing to seal with, so it isn't offered.

**Consequences.**
- The relay has no service guarantee. If it goes, the remote stops and everything else carries on; a new relay is one constant in `remote.js`.
- The TV now also fetches rain every quarter hour, air quality, flood warnings, the grid mix and bank holidays, each on its own slow clock.
- A screen's code stays on that screen (`hse.remote`); the phone keeps the code it paired with (`hse.remoteTV`). Neither goes in `household.json` or a setup link.
