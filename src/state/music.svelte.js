/*
 * The music player on the phone: one object every island on a page shares (the strip, the full player, the Music
 * page, Now's controls). It reads Spotify's player every few seconds while the page is open, works out the song's
 * position in between, and sends play, pause, skip and the rest, showing the change at once and checking it after.
 * Spotify is signed in to on this device (src/lib/spotify.js); nothing goes anywhere else.
 */
import { store } from '../lib/browser.js';
import { spotify, spotifyStore, saveSpotifyStore, activeAccount, forgetAccount, spotifyErrorText } from '../lib/spotify.js';
import { playerModel, progressAt, playOn, keepDevice, loadLyrics, coverColours, artUrl, trackOf, contextLabel } from '../lib/music.js';
import { songStory, linerNotes } from '../lib/musicdata.js';
import { cacheGet, cacheSet } from './cache.js';
import { tv, tvQueue, tvSend } from './tv.svelte.js';
import { coverUrl } from '../lib/queue.js';

const SEC = 1000;

class Music {
  acc = $state.raw(null);           // the account playing (its tokens stay in hse.spotify)
  player = $state.raw(null);        // what's playing, where, and how (playerModel), or null
  checked = $state(false);          // the player has been read at least once
  devices = $state.raw([]);         // where it can play (playOn)
  queue = $state.raw(null);         // Up next: [track]
  liked = $state(false);            // whether the song playing is in your liked songs
  lyrics = $state.raw(null);        // { synced, plain, instrumental } for the song playing, or null
  lyricsFor = $state('');           // the song those lyrics are for ('' while looking)
  colours = $state.raw(null);       // { main, deep, ink } from the cover
  ctxName = $state('');             // the playlist or album it's playing from
  open = $state(false);             // the full player is showing
  picker = $state(false);           // "Play on" is showing
  pending = $state.raw(null);       // what to play once a device is chosen: { o } (play's options), or null
  view = $state('player');          // what the full player shows: player | lyrics | queue | about | notes
  over = $state('');                // a sheet over the player: '' | more | share
  vinyl = $state(store.get('musicVinyl') === '1');   // the cover as a record on a turntable
  story = $state.raw(null);         // the song's story and credits (songStory), or null while looking
  storyFor = $state('');            // the song that story is for
  notes = $state.raw(null);         // liner notes: [{ src, thumb, types }]
  notesFor = $state('');
  err = $state.raw(null);           // { title, body, code } from the last thing that went wrong
  toast = $state('');
  now = $state(Date.now());         // moves on while a song plays, for the progress bar

  get connected(){ return !!this.acc; }
  get track(){ return this.player ? this.player.track : null; }
  get progress(){ return progressAt(this.player, this.now); }
  get canControl(){ return !this.acc || this.acc.product !== 'free'; }
  /** What plays next: the top of the TV's house queue when that's in use (and the TV plays as you), or Spotify's own queue. */
  get nextUp(){
    if (houseMine() && tv.queue.length){ const x = tv.queue[0]; return { name: x.name, artist: x.artist, uri: x.uri, images: x.img ? [{ url: coverUrl(x.img), width: 300 }] : [], by: x.by.name, house: true }; }
    return this.queue && this.queue.length ? this.queue[0] : null;
  }
}
export const music = new Music();
/** The TV's house queue is what plays next for you: the TV is paired, has Spotify, and plays as the person listening here. */
export const houseMine = () => !!(tv.house && music.acc && tv.state.listening === music.acc.id);

/** The Web API, as the account playing. */
export const sp = () => spotify(music.acc, music.acc.client);

let started = false, pollTimer = 0, tickTimer = 0, toastTimer = 0, lastTrack = '', lastCtx = '';
// reads of Spotify's player that started before the last command, or before a newer read, are out of date; and just
// after a skip, a read still showing the song skipped from is Spotify not having moved on yet
let pollSeq = 0, cmdAt = 0, readAt = 0, skipAt = 0, skipFrom = '', skipUntil = 0;

/** Starts the player for this page, once: reads who's signed in, then Spotify's player while the page is visible. */
export function watchMusic(){
  if (started) return;
  started = true;
  music.acc = activeAccount();
  if (!music.acc) return;
  poll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  tickTimer = setInterval(() => { if (music.player && music.player.playing && !document.hidden) music.now = Date.now(); }, 500);
}
/** After signing in or out on this page. */
export function reloadAccount(){
  music.acc = activeAccount();
  if (!music.acc){ music.player = null; applyColours(null); return; }
  if (!started) watchMusic(); else poll();
}
/** Who's listening: plays, reads and likes as another of the people signed in on this phone. */
export function switchAccount(id){
  const s = spotifyStore();
  if (!s.accounts.some(a => a.id === id) || (music.acc && music.acc.id === id)) return;
  s.active = id; saveSpotifyStore(s);
  lastTrack = ''; lastCtx = ''; music.queue = null; music.devices = []; music.err = null;
  reloadAccount(); haptic();
  say('Listening as ' + music.acc.name);
}
export const people = () => spotifyStore().accounts;
export function signOut(){
  if (music.acc) forgetAccount(music.acc.id);
  music.acc = activeAccount(); music.player = null; music.open = false; applyColours(null);
  document.documentElement.classList.remove('has-mini');
}

/** Reads the player now, then again in a few seconds: sooner while playing, and just after the song ends. */
export async function poll(){
  clearTimeout(pollTimer);
  if (!music.acc || document.hidden) return;
  const seq = ++pollSeq, asked = Date.now();
  try {
    const m = playerModel(await sp().player(), Date.now());
    if (seq !== pollSeq || asked < cmdAt) return;
    if (skipFrom && m && m.track && m.track.id === skipFrom && Date.now() < skipUntil){ pollTimer = setTimeout(poll, 700); return; }
    skipFrom = ''; readAt = Date.now();
    setPlayer(m);
    music.err = null;
  } catch (e){ if (seq !== pollSeq) return; fail(e, true); }
  music.checked = true;
  const m = music.player;
  let next = m && m.playing ? 5 * SEC : 15 * SEC;
  if (m && m.playing && m.track && m.track.dur){ const left = m.track.dur - progressAt(m, Date.now()); if (left > 0 && left < next) next = left + 600; }
  if (music.open) next = Math.min(next, 5 * SEC);
  pollTimer = setTimeout(poll, next);
}
const soon = ms => { clearTimeout(pollTimer); pollTimer = setTimeout(poll, ms || 600); };

function setPlayer(m){
  music.player = m; music.now = Date.now();
  document.documentElement.classList.toggle('has-mini', !!(m && m.track));
  const t = m && m.track, id = t ? t.id : '';
  if (id !== lastTrack){ lastTrack = id; trackChanged(t); }
  const c = m && m.context ? m.context.uri : '';
  if (c !== lastCtx){ lastCtx = c; contextChanged(m && m.context); }
}
async function trackChanged(t){
  music.lyrics = null; music.lyricsFor = ''; music.liked = false; music.story = null; music.storyFor = ''; music.notes = null; music.notesFor = '';
  clearTimeout(storyTimer);
  if (t && !t.episode) storyTimer = setTimeout(() => loadStory(), music.open ? 600 : 4000);   // a moment in, so skipping through costs nothing
  if (!t){ applyColours(null); return; }
  findColours(artUrl(t.images, 300));
  loadQueue();
  if (!t.episode) sp().isLiked([t.id]).then(r => { if (lastTrack === t.id) music.liked = !!(r && r[0]); }, () => {});
  const ly = await loadLyrics(t);
  if (lastTrack === t.id){ music.lyrics = ly; music.lyricsFor = t.id; }
}
async function contextChanged(ctx){
  music.ctxName = contextLabel(ctx, '');
  if (!ctx || !ctx.uri) return;
  const id = ctx.uri.split(':').pop();
  try {
    if (ctx.type === 'playlist'){ const p = await sp().playlist(id); music.ctxName = p.name; }
    else if (ctx.type === 'album'){ const a = await sp().album(id); music.ctxName = a.name; }
    else if (ctx.type === 'artist'){ const a = await sp().artist(id); music.ctxName = a.name; }
  } catch (e){}
}

/* ---------- colours from covers: the song playing lights the whole page; album and playlist pages use their own ---------- */
const colourCache = new Map();
/** A cover's colours ({ main, deep, ink }), read from its pixels once; null for a grey cover or one that won't load. */
export function colourOf(url){
  if (!url) return Promise.resolve(null);
  if (colourCache.has(url)) return colourCache.get(url);
  const p = new Promise(done => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, 32, 32);
        done(coverColours(x.getImageData(0, 0, 32, 32).data));
      } catch (e){ done(null); }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
  colourCache.set(url, p);
  return p;
}
function findColours(url){ colourOf(url).then(c => { if (music.track && artUrl(music.track.images, 300) === url) applyColours(c); else if (!url) applyColours(null); }); }
function applyColours(c){
  music.colours = c;
  const r = document.documentElement.style;
  if (c){ r.setProperty('--tint', c.main); r.setProperty('--tint-deep', c.deep); r.setProperty('--tint-ink', c.ink); document.documentElement.classList.add('tinted'); }
  else { ['--tint', '--tint-deep', '--tint-ink'].forEach(k => r.removeProperty(k)); document.documentElement.classList.remove('tinted'); }
}

/* ---------- what you can do ---------- */
function fail(e, quiet){
  if (e && e.code === 'RELAY'){ say('The TV didn\'t get that. Try again.'); return; }
  const [title, body] = spotifyErrorText(e);
  if (e && e.code === 'AUTH'){ music.err = { title, body, code: e.code }; return; }
  if (e && e.code === 'NO_DEVICE'){ music.picker = true; loadDevices(); return; }
  if (!quiet){ music.err = { title, body, code: e && e.code }; say(title); }
}
export function say(text){ music.toast = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { music.toast = ''; }, 3200); }
const device = () => music.player && music.player.device ? music.player.device.id : null;
async function act(fn, after){
  cmdAt = Date.now();
  try { await fn(); music.err = null; soon(after); }
  catch (e){ skipFrom = ''; fail(e); soon(800); }
}
/** Play or pause, shown at once. */
export function toggle(){
  const m = music.player;
  if (!m){ return act(() => sp().play({})); }
  const playing = !m.playing;
  music.player = Object.assign({}, m, { playing, progress: progressAt(m, Date.now()), at: Date.now() });
  return act(() => playing ? sp().play({ device: device() }) : sp().pause(device()));
}
/**
 * Skips, once per press: the next song shows at once, and the player is read again until Spotify has moved on. With
 * the TV's house queue in use for you, the TV skips to the next of its songs (src/display/tvqueue.js).
 */
export function next(){
  const now = Date.now(), m = music.player, up = music.nextUp;
  if (now - skipAt < 1500) return;
  skipAt = now;
  if (m && m.track){
    skipFrom = m.track.id; skipUntil = now + 4000;
    // shown, not taken as the song playing: its lyrics, colours and the rest load once Spotify says it is
    if (up){ const id = up.id || String(up.uri || '').split(':').pop(); music.player = Object.assign({}, m, { track: Object.assign({ artists: [{ name: up.artist || '' }], album: { name: '' }, images: [], dur: 0 }, up, { id }), progress: 0, at: now, playing: true }); music.now = now; }
  }
  if (houseMine() && tv.queue.length) return act(async () => {
    if (!(await tvSend('skip'))){ const e = new Error('The relay didn\'t take that'); e.code = 'RELAY'; throw e; }
  }, 1200);
  return act(() => sp().next(null), 500);
}
/** Back to the start of the song; or, in its first seconds or just after a skip, the song before. */
export function previous(){
  const now = Date.now(), m = music.player;
  if (now - skipAt < 1500) return;
  const settled = !skipFrom && (now - skipAt > 8000 || readAt > skipAt);
  skipAt = now;
  if (settled && m && progressAt(m, now) > 4000) return seek(0);
  return act(() => sp().previous(null), 500);
}
export function seek(ms){
  const m = music.player;
  if (m) music.player = Object.assign({}, m, { progress: ms, at: Date.now() });
  music.now = Date.now();
  return act(() => sp().seek(ms, device()), 900);
}
export function setShuffle(){
  const m = music.player; if (!m) return;
  music.player = Object.assign({}, m, { shuffle: !m.shuffle });
  return act(() => sp().shuffle(!m.shuffle, device()), 900);
}
export function setRepeat(mode){
  const m = music.player; if (!m) return;
  music.player = Object.assign({}, m, { repeat: mode });
  return act(() => sp().repeat(mode, device()), 900);
}
/** A light tap felt on phones that can, for the buttons that matter. */
export function haptic(){ try { if (navigator.vibrate) navigator.vibrate(8); } catch (e){} }
export async function like(force){
  const t = music.track; if (!t || t.episode) return;
  const on = force === true ? true : !music.liked;
  if (on === music.liked) return;
  music.liked = on; haptic();
  try { await sp().like([t.id], on); if (!music.open) say(on ? 'Added to your liked songs' : 'Removed from your liked songs'); }
  catch (e){ music.liked = !on; fail(e); }
}
let volTimer = 0;
export function volume(pct, deviceId){
  const m = music.player, id = deviceId || device();
  if (m && m.device && (!deviceId || m.device.id === deviceId)) music.player = Object.assign({}, m, { device: Object.assign({}, m.device, { volume: pct }) });
  music.devices = music.devices.map(d => d.id === id ? Object.assign({}, d, { volume: pct }) : d);
  clearTimeout(volTimer);
  volTimer = setTimeout(() => act(() => sp().volume(pct, id), 1500), 250);
}
export async function loadDevices(){
  try { music.devices = playOn(await sp().devices(), music.player && music.player.device); }
  catch (e){ fail(e, true); }
}
/* ---------- where to play: chosen once, then remembered on this phone (hse.musicDevice) ---------- */
const CHOSEN = 'musicDevice';
/** The device chosen before, if it's awake: by its id, or its name (the wall display's player gets a new id each start). */
export function chosenDevice(ds){
  const c = store.getJ(CHOSEN, null);
  return c ? (ds || []).find(d => d.id === c.id) || (ds || []).find(d => d.name === c.name) || null : null;
}
const remember = d => store.setJ(CHOSEN, { id: d.id, name: d.name });
function showOn(d){
  const m = music.player;
  if (m) music.player = Object.assign({}, m, { device: { id: d.id, name: d.name, type: d.type, volume: d.volume, canVolume: d.canVolume } });
}
/** Asks where to play, then plays what was picked there (chooseDevice). */
function ask(o, ds){
  music.pending = o ? { o } : null;
  if (ds) music.devices = ds;
  music.picker = true;
  loadDevices();
}
export function closePicker(){ music.picker = false; music.pending = null; }
/** From "Play on": plays what's waiting there, or moves what's playing there; and remembers it. */
export function chooseDevice(d){
  remember(d);
  const p = music.pending;
  music.pending = null; music.picker = false;
  if (!p) return transfer(d);
  showOn(d); say('Playing on ' + d.name);
  return act(() => sp().play(Object.assign({}, p.o, { device: d.id })), 900);
}
export function transfer(d){
  music.picker = false;
  remember(d); showOn(d);
  say('Playing on ' + d.name);
  return act(() => sp().transfer(d.id, true), 1200);
}
/**
 * Plays a list of songs (uris), from one of them; or an album or playlist (context), from a song in it. On the
 * device that's on now (but not the TV's own Spotify app sitting idle, since starting it takes the screen over from
 * the wall display); otherwise on the device chosen before, if it's awake; otherwise it asks first.
 */
export function play(o){
  return act(async () => {
    let id = keepDevice(music.player) ? device() : null;
    if (!id){
      const ds = playOn(await sp().devices(), music.player && music.player.device), c = chosenDevice(ds);
      if (!c){ ask(o, ds); return; }
      id = c.id;
    }
    try { await sp().play(Object.assign({}, o, { device: id })); }
    catch (e){ if (e && e.code === 'NO_DEVICE'){ ask(o); return; } throw e; }
  }, 700);
}
export async function addToQueue(t){
  // With the TV's house queue in use, songs go there, so anyone can move them, take them out or vote them up.
  if (tv.house){
    haptic();
    const ok = await tvQueue('add', { uri: t.uri });
    say(ok ? 'Added to the house queue: ' + t.name : 'The relay didn\'t take that. Try again.');
    return;
  }
  try { await sp().addToQueue(t.uri, device()); haptic(); say('Added to Up next: ' + t.name); if (music.open) loadQueue(); }
  catch (e){ fail(e); }
}
export async function loadQueue(){
  try { const q = await sp().queue(); music.queue = ((q && q.queue) || []).map(trackOf).filter(Boolean).slice(0, 30); }
  catch (e){ fail(e, true); }
}
/** The player's own views: the player, the lyrics, Up next, the song's story, or its liner notes. */
export function setView(v){
  music.view = v; music.over = '';
  if (v === 'queue') loadQueue();
  if (v === 'about') loadStory();
  if (v === 'notes') loadNotes();
}
export function setVinyl(on){ music.vinyl = on; store.set('musicVinyl', on ? '1' : '0'); haptic(); }

/* ---------- the story behind the song, kept on the phone for a month ---------- */
let storyTimer = 0;
const MONTH = 30 * 24 * 3600e3;
export async function loadStory(){
  const t = music.track;
  if (!t || t.episode || music.storyFor === t.id) return music.story;
  music.storyFor = t.id;
  const key = 'story:' + (t.isrc || t.id);
  let s = null;
  try { const c = await cacheGet(key, MONTH); if (c) s = c.value; } catch (e){}
  if (!s){ try { s = await songStory(t); if (s) cacheSet(key, s); } catch (e){ s = { credits: null }; } }
  if (music.track && music.track.id === t.id) music.story = s;
  return s;
}
export async function loadNotes(){
  const t = music.track;
  if (!t || music.notesFor === t.id) return;
  music.notesFor = t.id;
  const s = await loadStory();
  const key = 'notes:' + (t.isrc || t.id);
  let n = null;
  try { const c = await cacheGet(key, MONTH); if (c) n = c.value; } catch (e){}
  if (!n){ n = s && s.credits ? await linerNotes(s.credits.releases) : []; cacheSet(key, n); }
  if (music.track && music.track.id === t.id) music.notes = n;
}

/* ---------- the full player opens over any page; the phone's Back closes it ---------- */
export function openPlayer(view){
  music.view = view || 'player'; music.over = '';
  if (music.open) return;
  music.open = true; music.picker = false;
  try { history.pushState({ player: 1 }, ''); } catch (e){}
  loadQueue();
  setTimeout(loadStory, 400);
  soon(50);
}
export function closePlayer(){
  if (!music.open) return;
  if (history.state && history.state.player) history.back(); else music.open = false;
}
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { if (music.open) music.open = false; });
