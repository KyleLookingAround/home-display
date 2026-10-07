# 0016: Playing music on the wall display itself

**Status:** accepted, October 2026.

**Context.** Playing anything from the phone's Music tab often started it on the TV's own Spotify app (a Spotify Connect device), which takes the whole screen over from the wall display, so the display disappears whenever music starts. Kyle wants the music on the TV's speakers and soundbar with the display still showing. There is no home server ([0004](0004-no-home-server.md)).

**Decision.**
- **The display is a Spotify player of its own.** `display.html` loads Spotify's Web Playback SDK and appears in every Spotify app as "Harold Street TV" (`SCREEN_PLAYER`). Music played to it comes out of the TV through the browser, and the display stays on screen. It needs Spotify Premium, the `streaming` and `user-read-email` permissions (added to every sign-in; the TV needs signing in again from the phone once), and a browser that can play protected audio. Browsers only let a page make sound after someone presses something, so the first key on the remote unlocks it.
- **Where to play, in order** (`playOn`, `bestDevice` in `music.js`): whatever is playing now; then the display's own player; then speakers, computers and phones; the TV's Spotify app last. Music is never *started* on the TV's app by itself: if it's the only device, the phone asks where to play instead (`keepDevice`: an idle TV app is passed over; one already playing carries on).
- **When the TV's browser can't.** If the SDK can't start (no protected audio, an older sign-in, no Premium), the Music view's foot says why, and music goes to the next best device.

**Consequences.**
- Whether the TV's own browser supports the SDK can only be known on the TV: it is a Chromium-based browser of unknown age. If it doesn't, the Google speakers or the phone are the fallback.
- The TV's Spotify sign-in must be renewed once from the phone (Screen, Spotify on the TV) to bring the new permission.
- Tests: the ranking in `tests/music.test.mjs`; the SDK itself only runs over https and isn't loaded in tests.

## Revisions

- **October 2026:** the phone no longer picks a device by itself. With nothing playing anywhere, picking a song asks "Where to play?" first, and remembers the answer on that phone (`hse.musicDevice`, matched by id or by name, since the wall display's player gets a new id each time it starts). It only asks again when that device isn't awake. `bestDevice` is still how the TV itself chooses, for its favourites and the house queue.
- **October 2026:** "This phone" is always offered while the phone's Spotify app isn't in the list: a phone's browser can't play Spotify (the Web Playback SDK doesn't run on phones), so it opens the Spotify app with what was picked and, back on the page, plays it there through Spotify.
