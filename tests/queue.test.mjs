// The house queue and parties: adding, moving, voting, handing songs to Spotify in time, and what the relay lets through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const Q = await import('../src/lib/queue.js');
const R = await import('../src/lib/remote.js');

const HEX = n => n.toString(16).padStart(40, '0');
const song = (n, dur = 200000) => ({ uri: 'spotify:track:song' + n, name: 'Song ' + n, artist: 'Band ' + n, dur, images: [{ url: 'https://i.scdn.co/image/' + HEX(n), width: 300 }, { url: 'https://i.scdn.co/image/' + HEX(n + 100), width: 64 }] });
const KYLE = { id: 'kyle01', name: 'Kyle' }, SAM = { id: 'sam001', name: 'Sam' };
const build = (...items) => items.reduce((q, [n, by], i) => Q.queueAdd(q, Q.queueItem(song(n), by, 1000 + i, 'idx' + n), { guest: by === SAM }).q, []);
const names = q => q.map(x => x.name.replace('Song ', ''));
const playing = (uri, progress, dur = 200000, at = 0) => ({ playing: true, progress, at, track: { uri, dur } });

test('songs join the end, once each, and guests have a limit', () => {
  let q = build([1, KYLE], [2, SAM]);
  assert.deepEqual(names(q), ['1', '2']);
  assert.equal(q[0].img, HEX(1), 'the cover travels as its id');
  assert.equal(Q.coverUrl(q[0].img), 'https://i.scdn.co/image/' + HEX(1));
  assert.equal(Q.queueAdd(q, Q.queueItem(song(1), SAM), { guest: true }).err, 'DUP');
  q = Q.queueAdd(q, Q.queueItem(song(3), SAM), { guest: true }).q;
  q = Q.queueAdd(q, Q.queueItem(song(4), SAM), { guest: true }).q;
  assert.equal(Q.queueAdd(q, Q.queueItem(song(5), SAM), { guest: true }).err, 'LIMIT', `${Q.GUEST_MAX} each`);
  assert.equal(Q.queueAdd(q, Q.queueItem(song(5), KYLE)).err, null, 'the household has no limit');
});

test('moving, removing and voting, with a song already handed to Spotify kept at the top', () => {
  let q = build([1, KYLE], [2, KYLE], [3, SAM], [4, SAM]);
  q = Q.queueMove(q, 'idx4', 0);
  assert.deepEqual(names(q), ['4', '1', '2', '3']);
  q = Q.queueVote(q, 'idx3', 'g1');
  assert.deepEqual(names(q), ['3', '4', '1', '2'], 'one vote lifts it above songs with none');
  q = Q.queueVote(q, 'idx2', 'g1'); q = Q.queueVote(q, 'idx2', 'g2');
  assert.deepEqual(names(q), ['2', '3', '4', '1'], 'two votes above one');
  q = Q.queueVote(q, 'idx1', 'g3');
  assert.deepEqual(names(q), ['2', '3', '1', '4'], 'not past a song with as many votes');
  q = Q.queueVote(q, 'idx2', 'g2'); q = Q.queueVote(q, 'idx2', 'g1');
  assert.deepEqual(names(q), ['3', '1', '2', '4'], 'taking votes back lets it sink below songs with more');
  q = Q.queueFed(q, 'idx3', 5000);
  assert.deepEqual(names(Q.queueMove(q, 'idx4', 0)), ['3', '4', '1', '2'], 'nothing goes above the song handed over');
  assert.deepEqual(names(Q.queueMove(q, 'idx3', 3)), names(q), 'and it stays put');
  assert.deepEqual(names(Q.queueRemove(q, 'idx3')), names(q), 'it can\'t be taken back from Spotify');
  assert.deepEqual(names(Q.queueRemove(q, 'idx1')), ['3', '2', '4']);
});

test('the TV hands Spotify the next song just before this one ends, and drops it once it plays', () => {
  const T = 1e6, at = (uri, progress, playingNow = true) => ({ playing: playingNow, progress, at: T, track: { uri, dur: 200000 } });
  let q = build([1, KYLE], [2, SAM]);
  let r = Q.queueStep(q, at('spotify:track:other', 100000), T);
  assert.equal(r.feed, null, 'not yet: a minute and more to go');
  r = Q.queueStep(q, at('spotify:track:other', 180000), T);
  assert.equal(r.feed && r.feed.id, 'idx1', 'with 20 seconds left');
  q = r.q;
  assert.equal(Q.queueStep(q, at('spotify:track:other', 190000), T + 5000).feed, null, 'one at a time');
  r = Q.queueStep(q, at('spotify:track:song1', 1000), T + 30000);
  assert.equal(r.played && r.played.id, 'idx1');
  assert.deepEqual(names(r.q), ['2']);
  assert.equal(Q.queueStep(r.q, at('spotify:track:song1', 190000, false), T + 40000).feed, null, 'not while paused');
  const lost = Q.queueStep(Q.queueFed(r.q, 'idx2', T), at('spotify:track:x', 1000), T + Q.FED_FORGET + 1);
  assert.deepEqual(lost.q, [], 'a song handed over that never played is forgotten');
});

test('the relay carries the queue in short form, and parties only what guests may ask', () => {
  const q = Q.queueVote(build([1, KYLE], [2, SAM]), 'idx2', 'g1');
  const wire = Q.queueWire(q);
  assert.ok(JSON.stringify(wire).length < 600, 'small');
  assert.deepEqual(Q.readWire(wire).map(x => [x.id, x.name, x.by.name, x.votes.length]), [['idx2', 'Song 2', 'Sam', 1], ['idx1', 'Song 1', 'Kyle', 0]]);
  assert.deepEqual(Q.readWire([{ i: 'idx1', u: 'javascript:alert(1)' }, { i: 'x', u: 'spotify:track:abc' }]), [], 'only songs, with proper ids');
  const msg = m => JSON.stringify({ event: 'message', message: JSON.stringify(m) });
  const who = { id: 'guest0001', name: 'Sam' };
  assert.equal(Q.readParty(msg({ from: 'guest', cmd: 'add', who, uri: 'spotify:track:abc123' })).uri, 'spotify:track:abc123');
  assert.equal(Q.readParty(msg({ from: 'guest', cmd: 'add', who, uri: 'spotify:playlist:abc123' })), null, 'songs only');
  assert.equal(Q.readParty(msg({ from: 'guest', cmd: 'mode', who, mode: 'night' })), null, 'guests can\'t change the TV');
  assert.equal(Q.readParty(msg({ from: 'guest', cmd: 'search', who: { id: 'x', name: 'y' }, q: 'oasis', rid: 'r1' })), null, 'a proper guest id');
  assert.equal(Q.readParty(msg({ from: 'guest', cmd: 'search', who, q: 'o'.repeat(500), rid: 'r1' })).q.length, 80);
  assert.equal(Q.readParty(msg({ from: 'guest', cmd: 'hello', who: { id: 'guest0001', name: '\u0007' } })).who.name, 'A guest');
  const party = Q.readParty(msg({ from: 'screen', party: { open: true, at: 5, now: { n: 'Song 1', a: 'Band', m: HEX(1), p: 1 }, q: wire, more: 2 } })).party;
  assert.equal(party.now.name, 'Song 1'); assert.equal(party.queue.length, 2); assert.equal(party.more, 2);
  const res = Q.readParty(msg({ from: 'screen', rid: 'r1', to: 'guest0001', results: [{ u: 'spotify:track:abc', n: 'A', a: 'B', m: 'not-a-cover' }] }));
  assert.deepEqual([res.results[0].name, res.results[0].img], ['A', ''], 'covers only from Spotify');
  // and on the house's own topic: the queue, a party, and who's listening on the TV
  assert.deepEqual(R.readRemote(msg({ from: 'phone', cmd: 'queue', op: 'move', id: 'idx1', to: 3, who: KYLE })), { from: 'phone', cmd: 'queue', mode: null, box: null, op: 'move', who: KYLE, id: 'idx1', to: 3 });
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'queue', op: 'shuffle', who: KYLE })), null);
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'queue', op: 'add', uri: 'spotify:album:x', who: KYLE })), null);
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'party', on: 1 })).on, true);
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'listen', id: 'kyle' })).id, 'kyle');
  const st = R.readRemote(msg({ from: 'screen', state: { mode: 'music', shown: 'music', queue: wire, more: 3, party: 'abcd-efgh', people: [{ id: 'kyle', name: 'Kyle' }, { id: '<b>' }], listening: 'kyle' } })).state;
  assert.deepEqual([st.queue.length, st.more, st.party, st.people.length, st.listening], [2, 3, 'ABCDEFGH', 1, 'kyle']);
});

test('a song pasted from Spotify\'s share menu', () => {
  assert.equal(Q.trackUri('https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6?si=1234'), 'spotify:track:6rqhFgbbKwnb9MLmUQDhG6');
  assert.equal(Q.trackUri('Listen: https://open.spotify.com/intl-de/track/6rqhFgbbKwnb9MLmUQDhG6'), 'spotify:track:6rqhFgbbKwnb9MLmUQDhG6');
  assert.equal(Q.trackUri('spotify:track:6rqhFgbbKwnb9MLmUQDhG6'), 'spotify:track:6rqhFgbbKwnb9MLmUQDhG6');
  assert.equal(Q.trackUri('https://open.spotify.com/album/6rqhFgbbKwnb9MLmUQDhG6'), null);
});
