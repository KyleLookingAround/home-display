# 0007: In the window, time is distance

**Status:** accepted, October 2026

**Context.** With the screensaver redrawn ([0005](0005-cockpit.md)), most facts still arrived as words on a billboard or a train carriage. Kyle asked for better ways to convey each piece of information, ways that make sense. Offered four, he chose all of them.

**Decision.** In a side window, things come in from the right and leave on the left. So position across the window means time: now is near the left edge, and twelve hours from now is at the right. Things that are true right now go on the cabin's instruments instead.
- **The road ahead** (`voyageFor` in `sources.js`, drawn by `drawAhead` in `cockpit.js`):
  - Along the bottom runs a landscape. Its height is the Agile price for each half hour: peaks are dear and valleys cheap, and the ridge is violet below zero, green when cheap, amber, then red at peak. Times are marked every three hours. Past the last published price it flattens into a plain marked "Prices due at 4pm".
  - Rain, snow or thunder from the hourly forecast stands as a cloud bank over the hours it's due, so the cloud reaches the window when the rain does.
  - Calendar events in the next twelve hours stand on the landscape as beacons.
- **The fuel dock:** a refuelling depot hangs over the cheapest two hours, with a countdown. When those hours come it has arrived, and it says "Cheap power now: run the dishwasher".
- **Your train:** when it's 20 minutes or less until you need to leave, the Harold Street Express becomes your actual train. It comes round every minute or so, pulls in and stops at a platform with the station's name for 25 seconds, then pulls out. Its carriages say when to leave, the platform, and whether it's on time.
- **The cabin's instruments** (`instrumentsFor`):
  - a needle for the Home Mini's live draw (green, amber and red bands, on a square-root scale so small loads still move it);
  - a fuel gauge for today's cost, with a mark for a usual day;
  - a lamp for grid carbon.
  - A usual day is the median of whole days this screen has seen (`recordCost`, `usualCost`: a day counts once the screen saw it after 10pm). It needs three, so until then the gauge shows just the figure. The history stays on the device.

Facts shown this way don't also ride the train or a billboard (`shownAhead`). The window has bands so nothing collides: billboards in the sky, what's coming up in the middle, the landscape and the train at the bottom. Labels on the canvas are at least 0.9rem, and stack rather than overlap.

**Consequences.**
- The time scale is real: the landscape creeps left by about two pixels a minute on a TV. Speed and motion still come from everything else going by.
- On a phone the train is wider than the window, so it stops with the carriage that says when to leave in the middle. The dials are left out there.
- `show=front`, `show=dock` and `show=mytrain` preview these with real data.
