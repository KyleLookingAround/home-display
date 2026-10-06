# 0014: Finding music without Spotify's recommendations

**Status:** accepted, October 2026, built on the `music` branch and merged into `main` on 06/10/2026 (stage 5 of [0012](0012-music-player.md)).

**Context.** Kyle picked five things for the last stage: more like this (Last.fm, ListenBrainz), a heads-up for new releases, gigs (Ticketmaster), a weather radio, and his listening (top artists and songs, a listening clock and a heat map). Spotify stopped giving new apps its recommendations, related artists and audio features in November 2024, and only ever shares your last 50 plays. There is no home server ([0004](0004-no-home-server.md)), and the repository is public.

**Decision.**
- **More like this from ListenBrainz, found on Spotify by name.** ListenBrainz's open "similar recordings" and "similar artists" (built from what people play in the same sittings) need no key and allow browser calls (checked). The song's MusicBrainz id comes from the lookup the song's story already makes. Last.fm adds its similar songs when a key is set on the phone; it's optional, since ListenBrainz covers the need without one. Each suggestion is searched on Spotify by title and artist, and kept only if Spotify's answer really is that song (not a cover); no artist more than twice, so it's a spread.
- **New releases from your own artists.** The artists you follow and your top artists of the last month (up to 30), each asked for their latest releases, three at a time, twice a day. Anything out in the last three weeks shows on the Music tab; the last three days, as a heads-up on Now and on the TV's Today.
- **Gigs from Ticketmaster, with the key on the device.** The Discovery API needs a key. It isn't a password, but it is Kyle's quota, so it's kept on the phone (Settings, Music) rather than in the public `household.json`. One search covers 40 miles round Stockport (up to 600 music events), matched against your top artists over three time spans, rather than a search per artist.
- **The weather radio is a mood, then Spotify's search.** `weatherMood` reads the weather first (storms, snow and rain win), then the time of the week (Friday and Saturday nights, Sunday mornings, late nights), and its words are searched as playlists. Spotify's own playlists can't be opened by new apps but can be played, which is all this needs. On the TV it's 0 on the remote.
- **Your listening is kept on the phone.** Spotify's top artists and songs (four weeks, six months, all time) come straight from Spotify. The clock and the calendar need history, so each time the app opens (at most every ten minutes) the phone adds Spotify's last 50 plays to a log in IndexedDB, per person, kept for 400 days. It's never sent anywhere.

**Consequences.**
- Suggestions are only as good as ListenBrainz's listeners: little-known songs may have none, and the player says so.
- The listening clock fills in over time, and misses plays when the app isn't opened for long stretches (more than 50 songs between visits).
- Gigs show only once Kyle adds a free Ticketmaster key, and only on that phone.
- Tests: `tests/discover.test.mjs` (blending, releases, gigs, moods, the log) and two browser tests against pretend ListenBrainz, Ticketmaster and Spotify.
