/*
 * Finding music, on the phone (src/lib/discover.js): more like the song playing, the artists fans also like, new
 * releases, gigs near home, the weather radio, and the log of what you've played that "Your listening" is drawn
 * from. Each is kept in IndexedDB for as long as it stays true, per person listening, so pages open with it at once.
 */
import { store } from '../lib/browser.js';
import { trackOf } from '../lib/music.js';
import { recordingFor, artistFor } from '../lib/musicdata.js';
import { similarRecordings, similarArtists, lastfmSimilar, blendSimilar, findWords, sameSong, fetchReleases, fetchGigs, fetchRadio, weatherMood, mergePlays } from '../lib/discover.js';
import { cacheGet, cacheSet } from './cache.js';
import { music, sp } from './music.svelte.js';

const H = 3600e3, DAY = 24 * H;
class Discover {
  like = $state.raw(null);          // { tracks, artists } like the song playing, or null while looking
  likeFor = $state('');
  releases = $state.raw(null);      // recentReleases
  gigs = $state.raw(null);          // gigsFor, or null with no Ticketmaster key
  gigsErr = $state('');
  mood = $state.raw(null);          // weatherMood
  radio = $state.raw(null);         // playlists for the mood
  log = $state.raw(null);           // what you've played, as this phone has seen it (mergePlays)
}
export const disc = new Discover();
const who = () => (music.acc ? music.acc.id : '');

/** Finds songs on Spotify by name, a few at a time, keeping only real matches. */
async function onSpotify(list, n){
  const out = [];
  for (let i = 0; i < list.length && out.length < n; i += 3){
    const found = await Promise.all(list.slice(i, i + 3).map(x => sp().search(findWords(x), ['track'], 3).then(j => ((j && j.tracks && j.tracks.items) || []).filter(t => sameSong(x, t))[0] || null, () => null)));
    found.forEach(t => { const tt = t && trackOf(t); if (tt && tt.playable !== false && !out.some(o => o.id === tt.id)) out.push(tt); });
  }
  return out.slice(0, n);
}
/** Artists by name, as Spotify has them. */
async function artistsOnSpotify(names, n){
  const out = [];
  for (let i = 0; i < names.length && out.length < n; i += 3){
    const found = await Promise.all(names.slice(i, i + 3).map(name => sp().search('artist:"' + name.replace(/"/g, '') + '"', ['artist'], 3)
      .then(j => ((j && j.artists && j.artists.items) || []).filter(a => a && a.name.toLowerCase() === name.toLowerCase())[0] || null, () => null)));
    found.forEach(a => { if (a && !out.some(o => o.id === a.id)) out.push(a); });
  }
  return out.slice(0, n);
}
/** Artists fans of this one also play (ListenBrainz), found on Spotify. Kept for a week. */
export async function fansAlsoLike(name){
  const key = 'fans:' + name.toLowerCase();
  const c = await cacheGet(key, 7 * DAY); if (c) return c.value;
  const a = await artistFor(name).catch(() => null);
  const sim = a ? await similarArtists(a.id) : [];
  const list = await artistsOnSpotify(sim.slice(0, 16).map(x => x.name), 10);
  cacheSet(key, list);
  return list;
}
/** More like the song playing: songs played in the same sittings (ListenBrainz, and Last.fm with a key), and artists. */
export async function loadLike(){
  const t = music.track;
  if (!t || t.episode || disc.likeFor === t.id) return;
  disc.likeFor = t.id; disc.like = null;
  const key = 'like:' + t.id;
  let v = null;
  const c = await cacheGet(key, 7 * DAY); if (c) v = c.value;
  if (!v){
    const rec = await recordingFor(t).catch(() => null);
    const [lb, fm] = await Promise.all([rec ? similarRecordings(rec.id) : [], lastfmSimilar(store.get('lastfmKey'), t.name, t.artist)]);
    const blend = blendSimilar([lb, fm], { name: t.name, artist: t.artist }, 2);
    const tracks = await onSpotify(blend.slice(0, 24), 12);
    const artists = await fansAlsoLike(t.artists[0] ? t.artists[0].name : t.artist).catch(() => []);
    v = { tracks, artists, from: [lb.length && 'ListenBrainz', fm.length && 'Last.fm'].filter(Boolean) };
    if (tracks.length || artists.length) cacheSet(key, v);
  }
  if (music.track && music.track.id === t.id) disc.like = v;
}

/* ---------- new releases, gigs and the weather radio: kept for hours, refreshed in the background ---------- */
export async function loadReleases(force){
  const id = who(); if (!id) return;
  const key = 'releases:' + id, c = await cacheGet(key, 12 * H);
  if (c){ disc.releases = c.value; if (!force) return; }
  try { const r = await fetchReleases(sp(), Date.now(), 21); disc.releases = r; cacheSet(key, r); } catch (e){}
}
export async function loadGigs(force){
  const id = who(), tm = store.get('tmKey');
  if (!id || !tm){ disc.gigs = null; return; }
  const key = 'gigs:' + id, c = await cacheGet(key, 12 * H);
  if (c){ disc.gigs = c.value; if (!force) return; }
  try {
    const names = {};
    for (const range of ['short_term', 'medium_term', 'long_term']){
      const j = await sp().top('artists', range, 50).catch(() => null);
      ((j && j.items) || []).forEach(a => { names[a.name] = 1; });
    }
    const g = await fetchGigs(tm, Object.keys(names));
    disc.gigs = g; disc.gigsErr = ''; cacheSet(key, g);
  } catch (e){ disc.gigsErr = e.message === 'KEY' ? 'Ticketmaster didn\'t accept the key. Check it in Settings, Music.' : 'Ticketmaster didn\'t answer. Trying again later.'; }
}
export async function loadRadio(weather){
  const id = who(); if (!id) return;
  const mood = weatherMood(weather && weather.now, Date.now());
  disc.mood = mood;
  const key = 'radio:' + id + ':' + mood.id, c = await cacheGet(key, 6 * H);
  if (c){ disc.radio = c.value; return; }
  disc.radio = null;
  try { const r = await fetchRadio(sp(), mood); disc.radio = r; if (r.length) cacheSet(key, r); } catch (e){ disc.radio = []; }
}

/* ---------- your listening: Spotify keeps your last 50 plays; this phone keeps them all ---------- */
let lastRecord = 0, recording = null;
/** Adds Spotify's last 50 plays to this phone's log, at most every ten minutes; a second ask while one runs waits for it. */
export function recordPlays(){
  if (recording) return recording;
  const id = who(); if (!id || Date.now() - lastRecord < 10 * 60e3) return Promise.resolve(disc.log);
  lastRecord = Date.now();
  recording = readPlays(id).finally(() => { recording = null; });
  return recording;
}
async function readPlays(id){
  const key = 'plays:' + id, c = await cacheGet(key);
  let log = c ? c.value : [];
  try {
    const j = await sp().recent();
    log = mergePlays(log, (j && j.items) || [], Date.now());
    cacheSet(key, log);
  } catch (e){}
  if (who() === id) disc.log = log;
  return log;
}
/** What's kept, without asking Spotify (for Now's heads-ups and the first moments of a page). */
export async function peek(){
  const id = who(); if (!id) return;
  const [r, g, p] = await Promise.all([cacheGet('releases:' + id), store.get('tmKey') ? cacheGet('gigs:' + id) : null, cacheGet('plays:' + id)]);
  if (r && !disc.releases) disc.releases = r.value;
  if (g && !disc.gigs) disc.gigs = g.value;
  if (p && !disc.log) disc.log = p.value;
}
/** In the background on any page, a little after it opens: plays, then releases and gigs if they're due. */
export function freshen(){
  setTimeout(async () => { if (!music.acc || document.hidden) return; await recordPlays(); await loadReleases(); await loadGigs(); }, 4000);
}
/** Someone else listening: their music, not the last person's. */
export function forget(){ disc.like = null; disc.likeFor = ''; disc.releases = null; disc.gigs = null; disc.radio = null; disc.log = null; lastRecord = 0; }
