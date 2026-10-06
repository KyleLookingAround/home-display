# 0012: A music player of our own, on Spotify

**Status:** accepted, October 2026, built on the `music` branch (previewed at `/preview/`).

**Context.** Kyle listens on the TV's own app, Google speakers and Bluetooth from his phone, and wanted a music player in the dashboard: a now-playing strip on every page that opens a full player, "like what Spotify has", with 25 features he picked from a proposal (in [ROADMAP.md](../../ROADMAP.md), section 4). He asked for the UI and UX to be incredible, given how much it will hold. There is no home server ([0004](0004-no-home-server.md)).

- Qobuz, his service, has no API a site can use: its embed plays 30-second previews, and its API keys aren't issued any more.
- The TV's apps, Google's speakers and Bluetooth can't be controlled by another app or a website.
- Spotify can. Its Web API allows browser calls from the site's address (checked), its sign-in works with no secret (PKCE), and it controls any Spotify device, including the TV app and Google speakers. Kyle chose Spotify.

**Decision.**
- **Spotify, signed in on each device.**
  - The household's Spotify app (development mode, up to 25 named users) has a Client ID, which isn't a secret and lives in `household.json`.
  - Signing in goes to Spotify and back to Settings, which trades the code for tokens with the PKCE verifier. The tokens stay on that device (`hse.spotify`); each page refreshes them when they run out.
  - The TV will get them sealed with the PIN, as it gets the Octopus account ([0011](0011-wall-display.md)).
- **The phone reads Spotify's player every few seconds while a page is open** (sooner while playing, and just after a song ends) and works out the position in between. Commands show at once and are checked a moment later. Nothing is polled while the page is hidden.
- **The design: the album is the room you're in.** The player shouldn't look like a copy of Spotify's; it should feel like this app.
  - **The cover sets the light.** Its colours, read from its pixels, tint the strip, the player and a glow behind every page. The full player's backdrop is the cover itself, blurred into a slow-drifting nebula over the starfield.
  - **Touch first, and forgiving.**
    - Swipe the strip or the cover to skip.
    - Drag the player down to put it away.
    - Double-tap the cover to like a song.
    - Tap a lyric to jump there.
    - Back always closes what's on top.
    - Every control is at least 44 pixels.
  - **Calm by default, alive while playing.** The cover rests a little smaller while paused and breathes while playing. Lyrics glow line by line. Nothing moves under "reduce motion".
  - **One screen per thing.** The player itself stays clean: the song, the controls, where it's playing and its volume. Under it, a glance at the lyric being sung and what's up next, each opening its own full view with a small player at the top. Later features (the artist, the song's story, credits, vinyl mode, the party queue) join as further views, not as more on the main screen.
  - **The Music tab is a place to start, not a list.** A greeting, shortcuts to what you play most, rows to scroll (jump back in, your playlists, your top artists, your albums), search with a top result, and album, playlist and artist pages lit by their own covers.
- **Honest limits stay visible:**
  - Spotify's queue can only be added to by other apps.
  - Spotify-made playlists can't be opened (they still play and show).
  - Control needs Premium.

**Consequences.**
- Everything is tested against a pretend Spotify (`tests/music.browser.mjs`) that answers as the real one does, including Spotify's newer row shape (`item` for `track`) and the endpoints it has moved, which `apiFirst` tries in turn.
- Spotify's limits for development-mode apps apply: rate limits are generous for one household, but the player backs off on "slow down".
- A sixth tab, Music, sits between Home and Screen; the tab bar still fits a 390-pixel phone.
