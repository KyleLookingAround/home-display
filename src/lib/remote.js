/* The phone as a remote for a screen, through ntfy.sh: a free relay that needs no account and allows browser calls. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
//
// A screen makes an eight-letter code and listens on a topic named from it. A phone that knows the code can ask
// the screen to change view, wake up or start afresh, and ask what it's showing. Only these small requests and the
// screen's answer pass through the relay: no prices, readings, settings or keys.
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
export const REMOTE_CMDS = ['mode', 'wake', 'hello', 'reload'];
/** A message from the relay's stream (its `data`), as a request for a screen or a screen's answer, or null. */
export function readRemote(data){
  let m, c;
  try { m = JSON.parse(data); if (m.event !== 'message') return null; c = JSON.parse(m.message); } catch(e){ return null; }
  if (!c || typeof c !== 'object') return null;
  if (c.from === 'phone' && REMOTE_CMDS.indexOf(c.cmd) >= 0){
    if (c.cmd === 'mode' && !MODES.some(x => x.id === c.mode)) return null;
    return { from: 'phone', cmd: c.cmd, mode: c.cmd === 'mode' ? c.mode : null };
  }
  if (c.from === 'screen' && c.state && MODES.some(x => x.id === c.state.shown)){
    return { from: 'screen', state: { mode: MODES.some(x => x.id === c.state.mode) ? c.state.mode : c.state.shown, shown: c.state.shown, at: +c.state.at || 0, name: String(c.state.name || '').slice(0, 40) } };
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
