// The music player's logic: Spotify's answers in one shape, synced lyrics, colours from a cover, and signing in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const M = await import('../src/lib/music.js');
const S = await import('../src/lib/spotify.js');

const TRACK = { id: 't1', uri: 'spotify:track:t1', name: 'Harold Street', duration_ms: 204000, explicit: false,
  artists: [{ id: 'a1', name: 'The Stockport Satellites', uri: 'spotify:artist:a1' }, { id: 'a2', name: 'Agile Hearts' }],
  album: { id: 'al1', name: 'Region G', uri: 'spotify:album:al1', release_date: '2026-09-04', images: [{ url: 'big', width: 640 }, { url: 'mid', width: 300 }, { url: 'small', width: 64 }] } };

test('a song, in the shape the player draws', () => {
  const t = M.trackOf(TRACK);
  assert.equal(t.artist, 'The Stockport Satellites, Agile Hearts');
  assert.equal(t.album.year, '2026');
  assert.equal(t.dur, 204000);
  assert.equal(M.artUrl(t.images, 64), 'small');
  assert.equal(M.artUrl(t.images, 280), 'mid');
  assert.equal(M.artUrl([], 64), '');
  const ep = M.trackOf({ type: 'episode', id: 'e1', uri: 'spotify:episode:e1', name: 'Episode 4', duration_ms: 1800000, show: { id: 's1', name: 'A podcast' }, images: [{ url: 'ep', width: 300 }] });
  assert.equal(ep.episode, true); assert.equal(ep.artist, 'A podcast'); assert.equal(M.artUrl(ep.images, 300), 'ep');
  assert.equal(M.trackOf(null), null);
});

test('the player state, and where the song has got to', () => {
  const m = M.playerModel({ is_playing: true, progress_ms: 60000, item: TRACK, shuffle_state: true, repeat_state: 'context',
    device: { id: 'd1', name: 'Kitchen speaker', type: 'Speaker', volume_percent: 45 }, context: { type: 'playlist', uri: 'spotify:playlist:p1' } }, 1000);
  assert.equal(m.device.name, 'Kitchen speaker'); assert.equal(m.device.volume, 45); assert.equal(m.shuffle, true); assert.equal(m.repeat, 'context');
  assert.equal(M.progressAt(m, 11000), 70000, 'ten seconds on');
  assert.equal(M.progressAt(m, 1000 + 10 * 60e3), 204000, 'never past the end');
  assert.equal(M.progressAt(Object.assign({}, m, { playing: false }), 11000), 60000, 'paused stays put');
  assert.equal(M.playerModel(null), null);
  assert.deepEqual(['off', 'context', 'track'].map(M.nextRepeat), ['context', 'track', 'off']);
});

test('durations, devices and lists', () => {
  assert.equal(M.fmtDur(204000), '3:24'); assert.equal(M.fmtDur(3725000), '1:02:05'); assert.equal(M.fmtDur(0), '0:00');
  assert.deepEqual(['Speaker', 'TV', 'Smartphone', 'Computer', 'CastAudio', 'Automobile'].map(M.deviceKind), ['speaker', 'tv', 'phone', 'computer', 'speaker', 'other']);
  const ds = M.playOn([{ id: 'p', name: 'Phone', type: 'Smartphone' }, { id: 'k', name: 'Kitchen', type: 'Speaker', is_active: true }, { id: 'x', name: 'Locked', type: 'Speaker', is_restricted: true }]);
  assert.deepEqual(ds.map(d => d.id), ['k', 'p'], 'the one playing first, restricted ones left out');
  const pg = M.page({ items: [{ added_at: '2026-10-01T10:00:00Z', track: TRACK }, { added_at: '2026-10-02T10:00:00Z', item: TRACK }], next: 'more', total: 120 });
  assert.equal(pg.items.length, 2); assert.equal(pg.items[1].track.id, 't1', 'newer answers call it item'); assert.equal(pg.next, true); assert.equal(pg.total, 120);
  assert.equal(M.page({ tracks: { items: [TRACK] } }, 'tracks').items[0].id, 't1');
  assert.equal(M.contextLabel({ type: 'collection', uri: 'spotify:user:kyle:collection' }), 'Your liked songs');
  assert.equal(M.contextLabel({ type: 'playlist', uri: 'spotify:playlist:p1' }, 'Friday night'), 'Friday night');
});

test('synced lyrics are read and followed', () => {
  const lines = M.parseLrc('[ar:Someone]\n[00:09.20]Streetlights hum along the viaduct\n[00:17.00]Kettle on at half past nine\n[00:25.50][01:30.00]Harold Street\n[00:40.00]\n');
  assert.deepEqual(lines.map(l => l.t), [9200, 17000, 25500, 40000, 90000]);
  assert.equal(lines[4].text, 'Harold Street', 'a line sung twice is in both places');
  assert.equal(lines[3].text, '', 'a gap keeps its beat');
  assert.equal(M.lyricAt(lines, 5000), -1); assert.equal(M.lyricAt(lines, 9200), 0); assert.equal(M.lyricAt(lines, 26000), 2); assert.equal(M.lyricAt(lines, 99999), 4);
  const l = M.lyricsOf({ syncedLyrics: '[00:01.00]One', plainLyrics: 'One\nTwo', instrumental: false });
  assert.equal(l.synced.length, 1); assert.deepEqual(l.plain, ['One', 'Two']);
  assert.equal(M.lyricsOf({ syncedLyrics: null, plainLyrics: null, instrumental: true }).instrumental, true);
});

test('the cover gives the page its colours', () => {
  const px = (cols) => { const a = []; cols.forEach(([n, r, g, b]) => { for (let i = 0; i < n; i++) a.push(r, g, b, 255); }); return a; };
  const amber = M.coverColours(px([[700, 250, 160, 40], [200, 20, 20, 30], [124, 240, 240, 240]]));
  assert.ok(amber && amber.hue >= 25 && amber.hue <= 45, `amber cover reads amber (hue ${amber && amber.hue})`);
  assert.match(amber.main, /^#[0-9a-f]{6}$/); assert.equal(amber.ink, '#06071a', 'dark text on a bright colour');
  const blue = M.coverColours(px([[500, 30, 60, 200], [524, 10, 10, 10]]));
  assert.ok(blue.hue > 200 && blue.hue < 250, 'deep blue reads blue');
  assert.equal(M.coverColours(px([[1024, 128, 128, 128]])), null, 'a grey cover keeps the page\'s own colours');
});

test('signing in proves the verifier without ever sending it early', async () => {
  const v = S.randomText(64);
  assert.equal(v.length, 64); assert.match(v, /^[A-Za-z0-9\-._~]+$/);
  const want = createHash('sha256').update(v).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(await S.pkceChallenge(v), want);
  assert.equal(S.redirectUri('https://kylelookingaround.github.io/home-display/preview/music.html?x=1#album/abc'), 'https://kylelookingaround.github.io/home-display/preview/settings.html');
  assert.equal(S.isSignInReturn('?code=abc&state=xyz'), true); assert.equal(S.isSignInReturn('?error=access_denied&state=xyz'), true); assert.equal(S.isSignInReturn('?code=abc'), false);
  assert.match(S.spotifyErrorText({ code: 'PREMIUM' })[0], /Premium/);
  assert.equal(S.SPOTIFY_SCOPES.includes('user-modify-playback-state'), true);
});
