# 0004: Work without a home server

**Status:** accepted, October 2026

**Context.** The first version leaned on `server.py` for trains, trams and calendars. There isn't a home server.

**Decision.** Everything that can come straight from the browser does:
- Octopus, including authenticated calls; CORS was checked in October 2026.
- National Grid carbon.
- Open-Meteo.
- Live trains, through Huxley2, a free community front end to National Rail's Darwin data.

Anything that can't is left out rather than faked:
- Realtime Trains forbids its token in browser apps.
- TfGM refuses browser calls.
- Google's secret iCal address doesn't allow browser calls.

Tram times show only when a stop is set, with a line explaining what's needed. The calendar works with any iCal host that allows browser calls. `server.py` stays for anyone who later runs one.

**Consequences.**
- Huxley2 has no service guarantee. If it goes, trains fall back to Realtime Trains through a helper.
- A small backend (`ROADMAP.md` item 3: a Cloudflare Worker, or a scheduled GitHub Action that publishes data) is the way to bring back trams and Google Calendar.
