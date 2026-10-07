# 0013: A house queue the TV keeps, and parties guests join with a code

**Status:** accepted, October 2026, built on the `music` branch and merged into `main` on 06/10/2026 (stage 4 of [0012](0012-music-player.md)).

**Context.** Kyle picked three things for stage 4: a house queue everyone can reorder, take songs out of and vote on; a party queue guests join by scanning a code on the TV; and "who's listening", with each person's own Spotify. Spotify's Web API lets other apps add to its queue, but not reorder it, remove from it, or read who added what. There is no home server ([0004](0004-no-home-server.md)), and the site is locked with a PIN ([0003](0003-lock.md)) that guests don't have.

**Decision.**
- **The TV keeps the queue and feeds Spotify one song ahead.** It's the one device that's always on.
  - The house queue lives on the TV (`hse.houseQueue`), with each song's chooser and votes (`src/lib/queue.js`).
  - About 25 seconds before the song playing ends, the TV hands Spotify the top song ("fed"). Until then, every song can be moved, removed or voted for.
  - Skipping, on the TV's remote or a phone, hands the top song over first, so the house queue comes before whatever Spotify would play.
  - A vote lifts a song above every song with fewer votes; otherwise the order is as people set it.
  - With nothing playing at all during a party, the first song added starts the music. A paused song is never restarted.
- **Phones talk to it through the relay, as the remote does** ([0011](0011-wall-display.md)): `queue` (add, move, remove, vote), `party`, `listen` and `skip` on the paired screen's topic. The TV answers with the first eight songs in a short form (a cover travels as its 40-character id), because a relay message is at most 4 KB.
  - A phone paired with a TV that has Spotify sends + to the house queue instead of Spotify's, and shows it under Up next, to drag (or arrow keys), vote or trim.
- **A party has its own topic and its own page.**
  - Starting one makes a new eight-letter code; the TV shows it, with a QR code for `party.html#<code>`. The house's own code is never shown to guests.
  - On the party's topic, guests can say hello, search, add a song and vote. Nothing else is read, so a guest can't change the view, reload the TV or send it anything sealed.
  - Guests search through the TV, which searches with its own Spotify, so they need no app and no sign-in. A link pasted from Spotify's Share menu works too.
  - Each guest may have three songs waiting, and one search a second. The TV stops listening when the party ends, or after twelve hours.
  - While a party is on and the TV shows Music, the screensaver and the night clock don't take over, and the bedtime fade waits.
  - `party.html` is the one page left out of the PIN lock (`lock/publish.sh`). It holds nothing of the household: no account, settings or pairing code, only the party's own topic.
- **Who's listening: each person signs in with their own Spotify.**
  - A phone can hold several sign-ins ("Add someone" in Settings, Music); the Music tab shows faces to switch between, and the person listening hears, likes and sees their own music.
  - The TV can hold several too, each sent sealed from a phone. A phone picks who the TV plays as (`listen`), which is whose player the house queue feeds.
  - While Spotify's app for the household is in development mode, each person's Spotify email has to be added under User Management in Spotify's developer dashboard first.

**Consequences.**
- The queue only moves while the TV is on with the display open. With the TV off, + on a phone goes to Spotify's own queue, as before.
- Spotify's own queue still shows under the house queue, as "Then from…": what Spotify will play once the house queue runs out.
- The relay (ntfy.sh) is free and promises nothing; if it's down, the queue on the TV keeps playing but phones and guests can't change it.
- Tests: `tests/queue.test.mjs` (the queue's rules and what the relay lets through) and three browser tests in `tests/music.browser.mjs` (the TV feeding Spotify and running a party, the phone's house queue and the guests' page, and who's listening).

## Revisions

- **October 2026:**
  - **The relay's allowance.** ntfy.sh allows about 250 messages a day from one internet address, and the TV, the phones and guests on the house Wi-Fi share one. So the TV sends one message a moment after changes (not one per change), says nothing when a song is only handed to Spotify, and sends again later when the relay refuses one.
  - **Queue messages fit.** A queue message over 4 KB would arrive as a file, which nothing could read. Queue messages are made smaller to fit (`wireFit`: fewer voters, then fewer songs).
  - **Saying hello.** The relay keeps nothing for a page that wasn't listening, so phones and guests say hello once their stream is open, and again until the TV answers. A stream the relay closes is opened again.
  - **A song handed over that's then skipped past** (`over` in `queueFed`) is dropped from the queue, rather than blocking it for 20 minutes.
