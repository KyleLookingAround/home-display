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
  - The TV gets its own, sealed with the PIN, as it gets the Octopus account ([0011](0011-wall-display.md)). "Connect Spotify on the TV" on the phone's Screen page signs in at Spotify (which asks which account), then seals the result and sends it instead of keeping it, so the TV has its own refresh token and neither device uses up the other's.
- **The TV keeps the music's time.** It reads Spotify itself (every three seconds while its Music view shows, every fifteen while Today or the screensaver show what's on), so the sleep timer and the bedtime fade work with every phone locked.
  - The sleep timer (15 minutes to an hour, or the end of the song) is set from the phone's player or Screen page, and fades over the last minute in ten steps, pauses, then puts the volume back for next time.
  - The bedtime fade happens once, as the night clock's window starts, and never on a screen that wakes up or reloads inside it. Each screen can turn it off.
  - Favourites on the number keys are chosen on the phone (playlists and albums, up to nine), or else the first five playlists.
  - In the Music view the remote's arrows, OK and numbers belong to the music, and up still opens the toolbar. Media keys work everywhere.
  - The phone's Screen picture of the Music view borrows the phone's sign-in only while it's fresh and never refreshes it, so the two can't trip over each other.
- **The phone reads Spotify's player every few seconds while a page is open** (sooner while playing, and just after a song ends) and works out the position in between. Commands show at once and are checked a moment later. Nothing is polled while the page is hidden.
- **The design: the album is the room you're in, and the room is this app.** The player shouldn't look like a copy of Spotify's; Kyle asked that it match the look and feel of the rest of the app.
  - **The house style throughout:**
    - the app's cards, with their glass, hairline border and radius (following the corners setting);
    - mono uppercase labels;
    - Syncopate for the one big answer: what's playing opens the Music tab, as the price verdict opens Now, and the song's title heads the player;
    - JetBrains Mono for figures, and cyan for everything you press (play buttons, sliders, toggles, links, the views' segmented control).
  - **The cover sets the light, and only the light.** Its colours, read from its pixels, glow faintly behind every page and around the strip, and the full player's backdrop is the cover blurred into a slow-drifting nebula over a starfield. Controls never take the cover's colour, so the player always reads as part of the house.
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
- **How it's built:** in five stages. Each one ends with a design pass, the screenshots looked at and refined before it's pushed, and a full design pass over the whole player follows the last.

**Consequences.**
- Everything is tested against a pretend Spotify (`tests/music.browser.mjs`) that answers as the real one does, including Spotify's newer row shape (`item` for `track`) and the endpoints it has moved, which `apiFirst` tries in turn.
- Spotify's limits for development-mode apps apply: rate limits are generous for one household, but the player backs off on "slow down".
- A sixth tab, Music, sits between Home and Screen; the tab bar still fits a 390-pixel phone.
- A sixth view on the TV, Music (key 6), after Night, so the keys 1 to 5 stay as they were. The toolbar's buttons are a little narrower so ten fit on one row at 1080p.
