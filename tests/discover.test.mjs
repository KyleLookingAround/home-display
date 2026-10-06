// Finding music: suggestions blended, releases and gigs picked out, the mood outside, and your listening in numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const X = await import('../src/lib/discover.js');
const H = await import('../src/lib/household.js');

test('more like this: a spread of songs, not one band\'s album, and never the song you\'re on', () => {
  const lb = [['A1', 'Oasis', 900], ['A2', 'Oasis', 800], ['A3', 'Oasis', 700], ['B1', 'Blur', 600], ['Live Forever', 'Oasis', 999]].map(([name, artist, score]) => ({ name, artist, score }));
  const fm = [{ name: 'C1', artist: 'Pulp', score: 950 }, { name: 'b1 (Remastered)', artist: 'The Blur', score: 940 }];
  const out = X.blendSimilar([lb, fm], { name: 'Live Forever', artist: 'Oasis' }, 2);
  assert.deepEqual(out.map(x => x.name), ['A1', 'A2', 'B1', 'C1'], 'two each at most, the same song once, the song playing left out');
  assert.equal(X.findWords({ name: 'Don\'t "Look" Back', artist: 'Oasis' }), 'track:"Don\'t Look Back" artist:"Oasis"');
  assert.ok(X.sameSong({ name: 'Wonderwall', artist: 'Oasis' }, { name: 'Wonderwall - Remastered', artists: [{ name: 'Oasis' }] }));
  assert.ok(!X.sameSong({ name: 'Wonderwall', artist: 'Oasis' }, { name: 'Wonderwall', artists: [{ name: 'Karaoke Kings' }] }), 'not a cover');
});

test('new releases from the last three weeks, newest first, worded as a day', () => {
  const now = Date.parse('2026-10-09T12:00:00');
  const al = (id, date, precision = 'day') => ({ id, name: 'Album ' + id, release_date: date, release_date_precision: precision });
  const got = X.recentReleases([
    { artist: { id: 'a', name: 'Viaduct' }, albums: [al('1', '2026-10-09'), al('2', '2026-09-01'), al('3', '2026', 'year')] },
    { artist: { id: 'b', name: 'Agile Hearts' }, albums: [al('4', '2026-10-03'), al('1', '2026-10-09'), al('5', '2026-10-30')] }
  ], now, 21);
  assert.deepEqual(got.map(r => r.album.id), ['1', '4'], 'not old, not undated, not future, not twice');
  assert.equal(X.releasedText('2026-10-09', now), 'Out today');
  assert.equal(X.releasedText('2026-10-08', now), 'Out yesterday');
  assert.equal(X.releasedText('2026-10-03', now), 'Out Saturday');
  assert.equal(X.releasedText('2026-09-20', now), 'Out 20 Sep');
});

test('gigs near home by the artists you play', () => {
  assert.match(X.gigsUrl('KEY', 1), /latlong=53\.41,-2\.16&radius=40&unit=miles&classificationName=music.*page=1/);
  const ev = (id, act, date, venue) => ({ id, name: act + ' live', url: 'https://www.ticketmaster.co.uk/e/' + id, dates: { start: { localDate: date, localTime: '19:30:00', dateTime: date + 'T18:30:00Z' }, status: { code: 'onsale' } },
    _embedded: { attractions: [{ name: act }], venues: [{ name: venue, city: { name: 'Manchester' } }] }, images: [{ ratio: '16_9', width: 640, url: 'https://s1.ticketm.net/x.jpg' }] });
  const gigs = X.gigsFor([ev('2', 'The Stockport Satellites', '2026-11-02', 'Band on the Wall'), ev('1', 'Viaduct', '2026-10-20', 'Albert Hall'), ev('3', 'Someone Else', '2026-10-21', 'O2 Ritz'), ev('1', 'Viaduct', '2026-10-20', 'Albert Hall')],
    ['Viaduct', 'Stockport Satellites']);
  assert.deepEqual(gigs.map(g => [g.artist, g.venue, g.time]), [['Viaduct', 'Albert Hall', '19:30'], ['Stockport Satellites', 'Band on the Wall', '19:30']], 'yours only, once, soonest first ("The" doesn\'t matter)');
  // heads-ups: a gig this week, and a release out in the last few days
  const now = Date.parse('2026-10-18T12:00:00');
  const heads = X.musicHeads([{ album: { name: 'Platform 4' }, artist: { name: 'Viaduct' }, date: '2026-10-16' }, { album: { name: 'Old' }, artist: { name: 'X' }, date: '2026-10-17' }], gigs, now);
  assert.deepEqual(heads.map(h => [h.kind, h.title, h.sub]), [['release', 'New from Viaduct and 1 more', 'Platform 4 · Out Friday'], ['gig', 'Viaduct at Albert Hall', 'Tuesday 19:30 · Manchester']]);
  const items = H.headsUp({ music: heads }, now);
  assert.ok(items.some(h => h.kind === 'gig'), 'they join the other heads-ups');
});

test('weather radio: the weather first, then the time of the week', () => {
  const at = s => Date.parse('2026-10-' + s);
  assert.equal(X.weatherMood({ code: 63, temp: 9 }, at('06T21:00:00')).id, 'rain-night');
  assert.equal(X.weatherMood({ code: 63, temp: 9 }, at('06T11:00:00')).title, 'Rainy day');
  assert.equal(X.weatherMood({ code: 95, temp: 15 }, at('09T20:00:00')).id, 'storm', 'a storm beats Friday night');
  assert.equal(X.weatherMood({ code: 2, temp: 12 }, at('09T20:00:00')).title, 'Friday night');
  assert.equal(X.weatherMood({ code: 3, temp: 11 }, at('11T09:30:00')).id, 'sunday');
  assert.equal(X.weatherMood({ code: 0, temp: 22 }, at('07T14:00:00')).id, 'sun');
  assert.equal(X.weatherMood({ code: 3, temp: 1 }, at('07T14:00:00')).id, 'cold');
  assert.equal(X.weatherMood({ code: 3, temp: 10 }, at('07T01:30:00')).id, 'late');
  assert.equal(X.weatherMood(null, at('07T15:00:00')).id, 'grey', 'no weather: still a mood');
  assert.match(X.weatherMood({ code: 61, temp: 8 }, at('06T11:00:00')).line, /^8° and raining$/);
  assert.equal(X.weatherMood(null, at('07T09:00:00')).line, 'This morning', 'with no weather, the time of day');
  const pl = (id, total) => ({ id, name: id, tracks: { total } });
  assert.deepEqual(X.radioPlaylists([{ playlists: { items: [null, pl('a', 10), pl('b', 0)] } }, { playlists: { items: [pl('a', 10), pl('c', 3)] } }, null]).map(p => p.id), ['a', 'c']);
});

test('your listening: plays kept, a clock, every day, and who you played most', () => {
  const tr = (id, artist, ms = 180000) => ({ id, name: 'Song ' + id, duration_ms: ms, artists: [{ id: 'id-' + artist, name: artist }] });
  const now = Date.parse('2026-10-06T23:00:00');
  let log = X.mergePlays([], [{ played_at: '2026-10-06T21:10:00', track: tr('1', 'Oasis') }, { played_at: '2026-10-06T21:40:00', track: tr('2', 'Blur', 240000) }, { played_at: '2026-10-04T08:05:00', track: tr('3', 'Oasis') }], now);
  log = X.mergePlays(log, [{ played_at: '2026-10-06T21:10:00', track: tr('1', 'Oasis') }], now);
  assert.equal(log.length, 3, 'the same play once'); assert.equal(log[0].id, '3', 'oldest first');
  const clock = X.listeningClock(log, 0);
  assert.equal(clock.length, 48); assert.equal(clock[42], 3, '21:00–21:30'); assert.equal(clock[43], 4); assert.equal(clock[16], 3);
  const days = X.listeningDays(log, now);
  assert.deepEqual(days.map(d => d.v), [3, 0, 7], 'a day with nothing is a 0');
  assert.deepEqual(X.topArtists(log, 0).map(a => [a.name, a.plays, a.mins]), [['Oasis', 2, 6], ['Blur', 1, 4]]);
  assert.deepEqual(X.mergePlays(log, [], now + 500 * 864e5), [], 'a year and more is let go');
});
