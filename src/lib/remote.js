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
export const REMOTE_CMDS = ['mode', 'wake', 'hello', 'reload', 'account', 'wifi'];
/** A message from the relay's stream (its `data`), as a request for a screen or a screen's answer, or null. */
export function readRemote(data){
  let m, c;
  try { m = JSON.parse(data); if (m.event !== 'message') return null; c = JSON.parse(m.message); } catch(e){ return null; }
  if (!c || typeof c !== 'object') return null;
  if (c.from === 'phone' && REMOTE_CMDS.indexOf(c.cmd) >= 0){
    if (c.cmd === 'mode' && !MODES.some(x => x.id === c.mode)) return null;
    if (c.cmd === 'account' && !(c.box && typeof c.box.iv === 'string' && typeof c.box.data === 'string' && c.box.data.length < 2000)) return null;
    return { from: 'phone', cmd: c.cmd, mode: c.cmd === 'mode' ? c.mode : null, box: c.cmd === 'account' ? { iv: c.box.iv, data: c.box.data } : null };
  }
  if (c.from === 'screen' && c.state && MODES.some(x => x.id === c.state.shown)){
    return { from: 'screen', state: { mode: MODES.some(x => x.id === c.state.mode) ? c.state.mode : c.state.shown, shown: c.state.shown, at: +c.state.at || 0, account: !!c.state.account, note: String(c.state.note || '').slice(0, 80) } };
  }
  return null;
}
export function sendRemote(code, msg){
  try { return fetch(RELAY + '/' + remoteTopic(code), { method: 'POST', body: JSON.stringify(msg) }).then(r => r.ok, () => false); }
  catch(e){ return Promise.resolve(false); }
}
/** Listens on a code's topic; calls back with each request or answer. Returns a stop function. */
export function listenRemote(code, onMsg){
  if (typeof EventSource === 'undefined') return () => {};
  const es = new EventSource(RELAY + '/' + remoteTopic(code) + '/sse');
  es.onmessage = e => { const r = readRemote(e.data); if (r) onMsg(r); };
  return () => { try { es.close(); } catch(e){} };
}

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
 * wifi: { ssid, password, security, hidden }, dates: [{ name, date, kind }], ical }.
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
  return Object.keys(out).length ? out : null;
}
