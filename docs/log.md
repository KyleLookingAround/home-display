# Log

Newest first. **Creation**, **Update**, **Finding** or **Deprecation**.

## 2026-10-05

- **Creation:** the road ahead. The next twelve hours are laid along the window: a landscape whose height is the Agile price, cloud banks over the hours rain is due, calendar events as beacons, and a fuel dock over the cheapest two hours. When it's nearly time to leave, the Express becomes your train and stops at the platform. The cabin has dials for live draw, today's cost against a usual day, and grid carbon ([0007](decisions/0007-time-is-distance.md)).
- **Update:** the screensaver redrawn as a voyage: painted nebulae, lit planets with rings, the Harold Street Express (a space train with one fact on each carriage), the house on an asteroid lit by live power use, the aurora when the grid is clean, a comet in the bins' colours on bin night, the real moon phase and the real ISS overhead, and space wildlife. Billboards now carry only what you need to catch ([0005](decisions/0005-cockpit.md), second revision).
- **Creation:** the ISS's position from wheretheiss.at, once a minute while the screensaver shows and every ten minutes otherwise.
- **Creation:** bin days. The repeats from the council's printed calendar are in `household.json`. A weekly GitHub Action (Saturdays) reads the council's page for the address in the `STOCKPORT_UPRN` secret, publishes `bins.json`, and the display restarts each repeat from the council's latest date ([0006](decisions/0006-council-bins.md)).
- **Update:** the screensaver looks out of a side window. Everything slides past with parallax, near things faster than far ones; billboards drift by at readable and distant depths; rain is swept backwards on the glass ([0005](decisions/0005-cockpit.md), revised).
- **Finding:** Stockport Council's bin page only allows browser calls from stockport.gov.uk, and turns away requests that don't look like a browser.
- **Creation:** the cockpit screensaver. Billboards in 3D, traffic at different depths, and weather on the glass and in the sky; the power price sets the engines. New screens open on it ([0005](decisions/0005-cockpit.md)).
- **Creation:** `household.json`, settings every screen shares, editable on GitHub. Screens store only their own changes.
- **Update:** live trains come from Huxley2 in the browser; no home server is needed ([0004](decisions/0004-no-home-server.md)). Example data is gone from the display: anything not set up says how to set it up.
- **Update:** `npm run ci` runs everything CI runs; Playwright is a development dependency.
- **Finding:** Realtime Trains' old API shut down on 30 September 2026. The new one forbids tokens in browser apps.
- **Finding:** Octopus allows browser calls, including authenticated ones. TfGM and Google Calendar don't.
- **Finding:** polling the Home Mini every minute with two GraphQL calls would use up Octopus's roughly 100 calls an hour, shared with its app. The display now uses about 37.
- **Creation:** the household display, published on GitHub Pages. It has five modes, remote control, ten-foot sizing, unattended-screen care and an optional PIN lock.
- **Creation:** imported Harold Street Energy as delivered.
