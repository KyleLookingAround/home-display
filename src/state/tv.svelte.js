/*
 * The phone's link to the paired TV, shared by every island on a page: what the TV last said it shows (its view,
 * Spotify, the house queue, a party, who's listening), and asking it things through the relay (src/lib/remote.js).
 * Pairing is per phone (hse.remoteTV); the phone's own id (hse.deviceId) is how its votes are counted.
 */
import { store } from '../lib/browser.js';
import { cleanCode, listenRemote, sendRemote } from '../lib/remote.js';
import { shortId } from '../lib/queue.js';
import { activeAccount } from '../lib/spotify.js';

class Tv {
  code = $state(null);              // the paired screen's code, or null
  state = $state.raw(null);         // the screen's last answer (readRemote): view, Spotify, queue, party, people
  heard = $state(0);                // when it last answered, on this page
  get spotify(){ return this.state ? this.state.spotify : ''; }
  get queue(){ return this.state ? this.state.queue : []; }
  get party(){ return this.state ? this.state.party : ''; }
  /** The house queue is in use when the TV, answering on this page, has Spotify. */
  get house(){ return !!(this.code && this.state && this.state.spotify && this.heard); }
}
export const tv = new Tv();

const hooks = new Set();
let stop = null;
const KEEP = 'hse-tv';

/** This phone as the TV knows it: a lasting id, and the name of whoever's Spotify is on it. */
export function me(){
  let id = store.get('deviceId');
  if (!/^[a-z0-9]{6,16}$/.test(id || '')){ id = shortId(null, 10); store.set('deviceId', id); }
  const a = activeAccount();
  return { id, name: (a && a.name) || 'Phone' };
}
/** Starts listening to the paired TV, once per page, and asks what it shows. */
export function watchTv(){
  if (typeof window === 'undefined') return;
  if (tv.code === null) tv.code = cleanCode(store.get('remoteTV'));
  if (stop || !tv.code) return;
  try { const s = JSON.parse(sessionStorage.getItem(KEEP) || 'null'); if (s && s.code === tv.code && !tv.state) tv.state = s.state; } catch (e){}
  stop = listenRemote(tv.code, r => {
    if (r.from !== 'screen') return;
    tv.state = r.state; tv.heard = Date.now();
    try { sessionStorage.setItem(KEEP, JSON.stringify({ code: tv.code, state: r.state })); } catch (e){}
    hooks.forEach(f => f(r.state));
  });
  // give the stream a moment to open, then ask
  setTimeout(() => tvSend('hello'), 800);
}
/** Calls back with each answer from the TV; returns a function that stops. */
export function onTv(f){ hooks.add(f); return () => hooks.delete(f); }
export function pairTv(code){
  unpairTv();
  tv.code = code; store.set('remoteTV', code);
  watchTv();
}
export function unpairTv(){
  if (stop){ stop(); stop = null; }
  store.del('remoteTV'); tv.code = null; tv.state = null; tv.heard = 0;
  try { sessionStorage.removeItem(KEEP); } catch (e){}
}
export function tvSend(cmd, extra){
  if (!tv.code) return Promise.resolve(false);
  return sendRemote(tv.code, Object.assign({ from: 'phone', cmd }, extra || {}));
}
/** The house queue: add (uri), move (id, to), remove (id) or vote (id). The TV answers with the new queue. */
export const tvQueue = (op, extra) => tvSend('queue', Object.assign({ op, who: me() }, extra || {}));
