/* The phone as a remote for a screen, through ntfy.sh: a free relay that needs no account and allows browser calls. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
//
// A screen makes an eight-letter code and listens on a topic named from it. A phone that knows the code can ask
// the screen to change view, wake up or start afresh, and ask what it's showing. Only these small requests and the
// screen's answer pass through the relay: no prices, readings or settings. The one exception is the Octopus account,
// and the household's private settings (guest Wi-Fi, family dates, the calendar address), which a phone can send sealed (AES-GCM) with a key made from the site's PIN, as the lock keeps it on each device that
// was unlocked with "Remember this screen". The relay, and anyone without the PIN, sees only the sealed box.
import { MODES } from './household.js';
import { readWire } from './queue.js';

export const RELAY = 'https://ntfy.sh';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I/L, for reading off a TV
export function newRemoteCode(rand){
  const r = rand || Math.random;
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(r() * CODE_CHARS.length)];
  return s;
}
/** "abcd-efgh", "ABCD EFGH" and "abcdefgh" are the same code. Null if it isn't one. */
export function cleanCode(code){
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 8 && c.split('').every(ch => CODE_CHARS.indexOf(ch) >= 0) ? c : null;
}
export const showCode = c => c ? c.slice(0, 4) + '-' + c.slice(4) : '';
export const remoteTopic = code => 'hse-screen-' + String(code).toLowerCase();

/** What a phone may ask. Anything else on the topic is ignored. */
export const REMOTE_CMDS = ['mode', 'wake', 'hello', 'reload', 'account', 'wifi', 'sleep', 'favs', 'queue', 'party', 'listen', 'skip'];
const QUEUE_OPS = ['add', 'move', 'remove', 'vote'];
/** A message from the relay's stream (its `data`), as a request for a screen or a screen's answer, or null. */
export function readRemote(data){
  let m, c;
  try { m = JSON.parse(data); if (m.event !== 'message') return null; c = JSON.parse(m.message); } catch(e){ return null; }
  if (!c || typeof c !== 'object') return null;
  if (c.from === 'phone' && REMOTE_CMDS.indexOf(c.cmd) >= 0){
    if (c.cmd === 'mode' && !MODES.some(x => x.id === c.mode)) return null;
    if (c.cmd === 'account' && !(c.box && typeof c.box.iv === 'string' && typeof c.box.data === 'string' && c.box.data.length < 3500)) return null;
    const out = { from: 'phone', cmd: c.cmd, mode: c.cmd === 'mode' ? c.mode : null, box: c.cmd === 'account' ? { iv: c.box.iv, data: c.box.data } : null };
    // the sleep timer: minutes (0 turns it off, up to four hours) or the end of the song
    if (c.cmd === 'sleep'){ const m = Math.round(+c.mins || 0); if (!(m >= 0 && m <= 240)) return null; out.mins = m; out.song = !!c.song; }
    // favourites for the TV remote's number keys: playlists, albums or artists, by name
    if (c.cmd === 'favs'){
      if (!Array.isArray(c.favs) || c.favs.length > 9) return null;
      out.favs = c.favs.filter(f => f && /^spotify:(playlist|album|artist):[A-Za-z0-9]{1,40}$/.test(f.uri) && typeof f.name === 'string').map(f => ({ uri: f.uri, name: f.name.slice(0, 80) }));
    }
    // the house queue (src/lib/queue.js): add a song, move, remove or vote for one; `who` is the phone that asked
    if (c.cmd === 'queue'){
      if (QUEUE_OPS.indexOf(c.op) < 0 || !c.who || !/^[a-z0-9]{6,16}$/.test(c.who.id)) return null;
      if (c.op === 'add' && !/^spotify:track:[A-Za-z0-9]{1,40}$/.test(c.uri)) return null;
      if (c.op !== 'add' && !/^[a-z0-9]{4,12}$/.test(c.id)) return null;
      out.op = c.op; out.who = { id: c.who.id, name: String(c.who.name || '').slice(0, 24) };
      if (c.op === 'add') out.uri = c.uri; else out.id = c.id;
      if (c.op === 'move'){ const to = Math.round(+c.to); if (!(to >= 0 && to <= 60)) return null; out.to = to; }
    }
    if (c.cmd === 'party') out.on = !!c.on;
    // who's listening on the TV: one of the Spotify accounts it has
    if (c.cmd === 'listen'){ if (!/^[\w.-]{1,64}$/.test(String(c.id))) return null; out.id = String(c.id); }
    return out;
  }
  if (c.from === 'screen' && c.state && MODES.some(x => x.id === c.state.shown)){
    return { from: 'screen', state: { mode: MODES.some(x => x.id === c.state.mode) ? c.state.mode : c.state.shown, shown: c.state.shown, at: +c.state.at || 0, account: !!c.state.account,
      spotify: String(c.state.spotify || '').slice(0, 64), sleepAt: +c.state.sleepAt || 0, sleepSong: !!c.state.sleepSong, note: String(c.state.note || '').slice(0, 80),
      queue: readWire(c.state.queue), more: Math.max(0, Math.min(99, +c.state.more || 0)), party: cleanCode(c.state.party) || '',
      people: (Array.isArray(c.state.people) ? c.state.people : []).slice(0, 8).filter(p => p && /^[\w.-]{1,64}$/.test(String(p.id))).map(p => ({ id: String(p.id), name: String(p.name || p.id).slice(0, 40) })),
      listening: /^[\w.-]{1,64}$/.test(String(c.state.listening || '')) ? String(c.state.listening) : '' } };
  }
  return null;
}
/** Sends a message on a relay topic. Resolves true if the relay took it. */
export function sendTopic(topic, msg){
  try { return fetch(RELAY + '/' + topic, { method: 'POST', body: JSON.stringify(msg) }).then(r => r.ok, () => false); }
  catch(e){ return Promise.resolve(false); }
}
/** Listens on a relay topic, reading each message with `read` (readRemote, readParty); returns a stop function. */
export function listenTopic(topic, read, onMsg){
  if (typeof EventSource === 'undefined') return () => {};
  const es = new EventSource(RELAY + '/' + topic + '/sse');
  es.onmessage = e => { const r = read(e.data); if (r) onMsg(r); };
  return () => { try { es.close(); } catch(e){} };
}
export const sendRemote = (code, msg) => sendTopic(remoteTopic(code), msg);
/** Listens on a code's topic; calls back with each request or answer. Returns a stop function. */
export const listenRemote = (code, onMsg) => listenTopic(remoteTopic(code), readRemote, onMsg);

/* ---------- the account, sealed with the site's PIN ---------- */
/** What the lock keeps on a device unlocked with "Remember this screen": the PIN, hashed. Null when there's no lock. */
export const LOCK_KEY = 'staticrypt_passphrase';
export function lockSecret(){ try { return localStorage.getItem(LOCK_KEY) || null; } catch(e){ return null; } }
export const canSeal = () => !!(typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined');
const toB64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const fromB64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
function boxKey(code, secret){
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'PBKDF2' }, false, ['deriveKey'])
    .then(base => crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('hse-account:' + code), iterations: 100000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
}
/**
 * Seals what the phone sends a screen, for the screen with this code: any of { account: { account, key, gasUnit, pay },
 * wifi: { ssid, password, security, hidden }, dates: [{ name, date, kind }], ical, spotify: { id, name, product, client, refresh, access, exp } }.
 */
export async function sealDetails(code, secret, details){
  const iv = crypto.getRandomValues(new Uint8Array(12)), k = await boxKey(code, secret);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(details)));
  return { iv: toB64(iv), data: toB64(data) };
}
/** Opens sealed details and keeps only what's well formed; null if it wasn't sealed with this PIN and code, or holds nothing. */
export async function openDetails(code, secret, box){
  let d;
  try {
    const k = await boxKey(code, secret);
    d = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, k, fromB64(box.data))));
  } catch(e){ return null; }
  if (!d || typeof d !== 'object') return null;
  const out = {}, a = d.account;
  if (a && /^A-[0-9A-Z]{6,10}$/i.test(String(a.account)) && /^sk_\w{6,}$/.test(String(a.key)))
    out.account = { account: String(a.account).toUpperCase(), key: String(a.key), gasUnit: a.gasUnit === 'kwh' ? 'kwh' : 'm3', pay: a.pay === 'NON_DIRECT_DEBIT' ? 'NON_DIRECT_DEBIT' : 'DIRECT_DEBIT' };
  if (d.wifi && d.wifi.ssid) out.wifi = { ssid: String(d.wifi.ssid).slice(0, 64), password: String(d.wifi.password || '').slice(0, 64), security: d.wifi.security === 'WEP' || d.wifi.security === 'nopass' ? d.wifi.security : 'WPA', hidden: !!d.wifi.hidden };
  if (Array.isArray(d.dates)) out.dates = d.dates.filter(x => x && x.name && /^\d{4}-\d\d-\d\d$/.test(x.date)).slice(0, 60).map(x => ({ name: String(x.name).slice(0, 60), date: x.date, kind: ['birthday', 'anniversary', 'once'].indexOf(x.kind) >= 0 ? x.kind : 'birthday' }));
  if (typeof d.ical === 'string' && /^(https|webcal):\/\//i.test(d.ical)) out.ical = d.ical.slice(0, 500);
  // the TV's own Spotify sign-in (signed in on the phone for the TV, so neither uses up the other's refresh token)
  const sp = d.spotify;
  if (sp && /^[\w.-]{1,64}$/.test(String(sp.id)) && /^[0-9a-f]{32}$/.test(String(sp.client)) && typeof sp.refresh === 'string' && sp.refresh.length >= 4 && sp.refresh.length < 600)
    out.spotify = { id: String(sp.id), name: String(sp.name || sp.id).slice(0, 64), product: String(sp.product || '').slice(0, 20), client: sp.client, refresh: sp.refresh,
      access: typeof sp.access === 'string' && sp.access.length < 600 ? sp.access : '', exp: +sp.exp || 0, scope: '',
      img: /^https:\/\/[\w.-]+\/[^\s"'<>]{1,280}$/.test(String(sp.img || '')) ? sp.img : '' };
  return Object.keys(out).length ? out : null;
}
