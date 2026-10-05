# Log

Newest first. **Creation**, **Update**, **Finding** or **Deprecation**.

## 2026-10-05

- **Creation:** the cockpit screensaver. Billboards in 3D, traffic at different depths, and weather on the glass and in the sky; the power price sets the engines. New screens open on it ([0005](decisions/0005-cockpit.md)).
- **Creation:** `household.json`, settings every screen shares, editable on GitHub. Screens store only their own changes.
- **Update:** live trains come from Huxley2 in the browser; no home server is needed ([0004](decisions/0004-no-home-server.md)). Example data is gone from the display: anything not set up says how to set it up.
- **Update:** `npm run ci` runs everything CI runs; Playwright is a development dependency.
- **Finding:** Realtime Trains' old API shut down on 30 September 2026. The new one forbids tokens in browser apps.
- **Finding:** Octopus allows browser calls, including authenticated ones. TfGM and Google Calendar don't.
- **Finding:** polling the Home Mini every minute with two GraphQL calls would use up Octopus's roughly 100 calls an hour, shared with its app. The display now uses about 37.
- **Creation:** the household display, published on GitHub Pages. It has five modes, remote control, ten-foot sizing, unattended-screen care and an optional PIN lock.
- **Creation:** imported Harold Street Energy as delivered.
