/* The house queue and parties: the logic the TV, the phones and guests' phones share. No DOM, no network. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
//
// Spotify lets other apps add to its queue but not reorder or remove, so the TV keeps the house's own queue and
// hands Spotify one song at a time, just before the song playing ends ("fed"). Until then a song can be moved,
// removed or voted up. A vote lifts a song above every song with fewer votes; the order is otherwise as people set it.
import { progressAt } from './music.js';

export const QUEUE_MAX = 40;          // songs waiting
export const GUEST_MAX = 3;           // songs one guest may have waiting at once
export const FEED_AHEAD = 25e3;       // hand the next song to Spotify this long before the song playing ends
export const FED_FORGET = 20 * 60e3;  // a song handed over that never played (something else was played) is dropped
export const WIRE_MAX = 10;           // songs sent through the relay at once (a message is at most 4 KB)

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
export function shortId(rand, n){
  const r = rand || Math.random;
  let s = '';
  for (let i = 0; i < (n || 6); i++) s += ID_CHARS[Math.floor(r() * ID_CHARS.length)];
  return s;
}
/** A Spotify cover's address as its 40-character id, which is all that travels; and back. */
export function coverId(url){ const m = /^https:\/\/i\.scdn\.co\/image\/([0-9a-f]{40})$/.exec(String(url || '')); return m ? m[1] : ''; }
export const coverUrl = id => /^[0-9a-f]{40}$/.test(String(id || '')) ? 'https://i.scdn.co/image/' + id : '';
/** A song's Spotify address from what a guest pastes: a share link, or the uri. */
export function trackUri(text){
  const s = String(text || '');
  let m = /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{10,40})/.exec(s);
  if (m) return 'spotify:track:' + m[1];
  m = /spotify:track:([A-Za-z0-9]{10,40})/.exec(s);
  return m ? 'spotify:track:' + m[1] : null;
}

/** A song for the queue, from a song as the player knows it (trackOf). `by` is { id, name }. */
export function queueItem(t, by, now, id){
  const img = (t.images || []).slice().sort((a, b) => (a.width || 0) - (b.width || 0)).filter(x => (x.width || 300) >= 200)[0] || (t.images || [])[0];
  return { id: id || shortId(), uri: t.uri, name: String(t.name || '').slice(0, 80), artist: String(t.artist || '').slice(0, 60), img: coverId(img && img.url), dur: +t.dur || 0,
    by: { id: String(by && by.id || ''), name: String(by && by.name || '').slice(0, 24) }, at: now || Date.now(), votes: [], fed: 0 };
}
const qWaiting = q => q.filter(x => !x.fed);
/** Adds a song at the end. Says why not: DUP (already waiting), FULL, or LIMIT (that guest has enough waiting). */
export function queueAdd(q, item, opts){
  opts = opts || {};
  if (q.some(x => x.uri === item.uri)) return { q: q, err: 'DUP' };
  if (q.length >= QUEUE_MAX) return { q: q, err: 'FULL' };
  if (opts.guest && qWaiting(q).filter(x => x.by.id === item.by.id).length >= GUEST_MAX) return { q: q, err: 'LIMIT' };
  return { q: q.concat([item]), err: null };
}
/** The first place a song can move to: below a song already handed to Spotify. */
const qFirstFree = q => { let i = 0; while (i < q.length && q[i].fed) i++; return i; };
export function queueMove(q, id, to){
  const i = q.map(x => x.id).indexOf(id);
  if (i < 0 || q[i].fed) return q;
  const out = q.slice(), it = out.splice(i, 1)[0], lo = qFirstFree(out);
  out.splice(Math.max(lo, Math.min(out.length, Math.round(+to) || 0)), 0, it);
  return out;
}
export function queueRemove(q, id){ return q.filter(x => x.id !== id || x.fed); }
/** Votes for a song, or takes the vote back; the song rises above songs with fewer votes, or sinks below songs with more. */
export function queueVote(q, id, who){
  const i = q.map(x => x.id).indexOf(id);
  if (i < 0 || !who) return q;
  const out = q.slice(), it = Object.assign({}, out[i]);
  const had = it.votes.indexOf(who) >= 0;
  it.votes = had ? it.votes.filter(v => v !== who) : it.votes.concat([who]).slice(-50);
  out[i] = it;
  let j = i;
  if (!it.fed){
    const lo = qFirstFree(out);
    if (!had) while (j > lo && out[j - 1].votes.length < it.votes.length){ out[j] = out[j - 1]; out[j - 1] = it; j--; }
    else while (j < out.length - 1 && out[j + 1].votes.length > it.votes.length){ out[j] = out[j + 1]; out[j + 1] = it; j++; }
  }
  return out;
}
/**
 * Once a second on the TV, with what's playing (playerModel): drops songs that have started playing, and says which
 * song to hand to Spotify now (`feed`), if the song playing is nearly over. Returns { q, feed, played }.
 */
export function queueStep(q, m, now){
  const uri = m && m.track ? m.track.uri : '';
  let played = null;
  const out = q.filter(x => {
    if (uri && x.uri === uri && (x.fed || x === q[qFirstFree(q)])){ played = x; return false; }
    return !(x.fed && now - x.fed > FED_FORGET);
  });
  let feed = null;
  const i = qFirstFree(out);
  if (m && m.playing && m.track && m.track.dur && i === 0 && out.length){
    const left = m.track.dur - progressAt(m, now);
    if (left < FEED_AHEAD){ out[0] = Object.assign({}, out[0], { fed: now }); feed = out[0]; }
  }
  return { q: out, feed: feed, played: played };
}
/** Marks a song as handed over now (for a skip), or not (when Spotify refused it). */
export function queueFed(q, id, now){ return q.map(x => x.id === id ? Object.assign({}, x, { fed: now || 0 }) : x); }

/* ---------- through the relay: short keys, and only what's needed ---------- */
export function queueWire(q, max){
  return q.slice(0, max || WIRE_MAX).map(x => ({ i: x.id, u: x.uri, n: x.name, a: x.artist, m: x.img, d: x.dur, b: x.by.name, g: x.by.id, v: x.votes.slice(-20), f: x.fed ? 1 : 0 }));
}
const qStr = (v, n) => String(v == null ? '' : v).slice(0, n);
export function readWire(arr){
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, WIRE_MAX).filter(x => x && /^[a-z0-9]{4,12}$/.test(x.i) && /^spotify:track:[A-Za-z0-9]{1,40}$/.test(x.u)).map(x => ({
    id: x.i, uri: x.u, name: qStr(x.n, 80), artist: qStr(x.a, 60), img: coverUrl(x.m) ? x.m : '', dur: +x.d || 0,
    by: { id: qStr(x.g, 16), name: qStr(x.b, 24) }, votes: Array.isArray(x.v) ? x.v.filter(v => typeof v === 'string').map(v => v.slice(0, 16)).slice(0, 20) : [], fed: x.f ? 1 : 0 }));
}

/* ---------- parties: guests scan a code on the TV and add songs, on a topic of their own ---------- */
export const partyTopic = code => 'hse-party-' + String(code).toLowerCase();
export const PARTY_CMDS = ['hello', 'add', 'vote', 'search'];
const qGuest = w => w && /^[a-z0-9]{6,16}$/.test(w.id) ? { id: w.id, name: qStr(w.name, 24).replace(/[\u0000-\u001f]/g, '').trim() || 'A guest' } : null;
/** A message on a party's topic (the relay's `data`): a guest's request, or the TV's answer. Null for anything else. */
export function readParty(data){
  let m, c;
  try { m = JSON.parse(data); if (m.event !== 'message') return null; c = JSON.parse(m.message); } catch(e){ return null; }
  if (!c || typeof c !== 'object') return null;
  if (c.from === 'guest' && PARTY_CMDS.indexOf(c.cmd) >= 0){
    const who = qGuest(c.who);
    if (!who) return null;
    const out = { from: 'guest', cmd: c.cmd, who: who };
    if (c.cmd === 'add'){ if (!/^spotify:track:[A-Za-z0-9]{1,40}$/.test(c.uri)) return null; out.uri = c.uri; }
    if (c.cmd === 'vote'){ if (!/^[a-z0-9]{4,12}$/.test(c.id)) return null; out.id = c.id; }
    if (c.cmd === 'search'){ const s = qStr(c.q, 80).trim(); if (!s || !/^[a-z0-9]{1,12}$/.test(c.rid)) return null; out.q = s; out.rid = c.rid; }
    return out;
  }
  if (c.from === 'screen'){
    if (c.results && /^[a-z0-9]{1,12}$/.test(c.rid)){
      return { from: 'screen', rid: c.rid, to: qStr(c.to, 16), results: (Array.isArray(c.results) ? c.results : []).slice(0, 10).filter(x => x && /^spotify:track:[A-Za-z0-9]{1,40}$/.test(x.u))
        .map(x => ({ uri: x.u, name: qStr(x.n, 80), artist: qStr(x.a, 60), img: coverUrl(x.m) ? x.m : '', dur: +x.d || 0 })) };
    }
    if (c.reply){ return { from: 'screen', to: qStr(c.to, 16), reply: qStr(c.reply, 120), ok: !!c.ok }; }
    if (c.party){
      const p = c.party, now = p.now && typeof p.now === 'object' ? { name: qStr(p.now.n, 80), artist: qStr(p.now.a, 60), img: coverUrl(p.now.m) ? p.now.m : '', playing: !!p.now.p } : null;
      return { from: 'screen', party: { open: !!p.open, at: +p.at || 0, now: now, queue: readWire(p.q), more: Math.max(0, +p.more || 0), max: GUEST_MAX } };
    }
  }
  return null;
}
/** What a guest's phone shows of a song: its cover (small), and whether it's theirs or they've voted for it. */
export function guestView(q, me){
  return q.map((x, i) => ({ id: x.id, name: x.name, artist: x.artist, img: coverUrl(x.img), by: x.by.name, mine: !!me && x.by.id === me, voted: !!me && x.votes.indexOf(me) >= 0, votes: x.votes.length, fed: !!x.fed, pos: i + 1 }));
}
