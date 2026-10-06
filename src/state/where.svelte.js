/*
 * Where the phone is, when you've turned it on (Settings, Location): asked for while a page is open, at most once a
 * minute, and kept only in memory. It makes the walk to the train the walk from where you are, and notices when
 * you're at work, so today counts as an office day. Work's place is kept on this phone only (hse.office).
 */
import { app } from './app.svelte.js';
import { store } from '../lib/browser.js';
import { dayKey } from '../lib/format.js';
import { officeDay } from '../lib/household.js';
import { loadStations, legFromHere, atPlace, distKm, walkMins } from '../lib/geo.js';

class Where {
  on = $state(false);               // this phone's location is in use
  office = $state.raw(null);        // work's place, { lat, lon }
  denied = $state(false);           // the browser said no
  note = $state('');                // "You're at work, so today's an office day."
}
export const where = new Where();
let index = null, timer = null, started = false, hooks = { saved: null };

function init(){
  if (started || typeof window === 'undefined') return;
  started = true;
  where.on = store.get('useLocation') === '1';
  where.office = store.getJ('office', null);
}
/** The trains as they are, with the walk to the train from where you are (legFromHere). */
export function liveTrains(v){
  init();
  if (!v || !v.leg || !where.on || !app.here) return v;
  const leg = legFromHere(v.leg, app.here, index, Date.now());
  return leg === v.leg ? v : Object.assign({}, v, { leg });
}
const reapply = () => { if (app.trainsBase) app.trains = liveTrains(app.trainsBase); };

function locate(){
  if (!where.on || document.hidden || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(p => {
    app.here = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() };
    where.denied = false;
    reapply(); atWork();
  }, e => { if (e && e.code === 1) where.denied = true; }, { maximumAge: 60e3, timeout: 20e3, enableHighAccuracy: false });
}
/** At work on a day that wasn't down as an office day: it is now (the plan, as if you'd ticked it). */
function atWork(tries = 0){
  if (where.office && !app.house){ if (tries < 20) setTimeout(() => atWork(tries + 1), 500); return; }   // the settings are still on their way
  const h = new Date().getHours();
  if (!where.office || !app.house || !app.house.trainTo || h < 6 || h >= 20 || !atPlace(app.here, where.office)) return;
  const day = officeDay(app.house, Date.now(), app.holidays);
  if (day.in) return;
  const plan = { ...(app.house.plan || {}) }; plan[dayKey(Date.now())] = { in: true };
  if (hooks.saved) hooks.saved(plan);
  where.note = 'You\'re at work, so today is an office day.';
}
/** Starts asking where the phone is, once a page, while it's visible; returns a function that stops. */
export function watchWhere(onPlan){
  init();
  if (onPlan) hooks.saved = onPlan;
  if (!where.on || timer) return () => {};
  if (!index) loadStations().then(i => { index = i; reapply(); }, () => {});
  if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(p => { where.denied = p.state === 'denied'; }, () => {});
  locate();
  timer = setInterval(locate, 60e3);
  const vis = () => { if (!document.hidden) locate(); };
  document.addEventListener('visibilitychange', vis);
  return () => { clearInterval(timer); timer = null; document.removeEventListener('visibilitychange', vis); };
}
/** Turns this phone's location on (asking the browser) or off. */
export function useLocation(on){
  init();
  where.on = !!on; store.set('useLocation', on ? '1' : '');
  if (on){ where.denied = false; watchWhere(); locate(); }
  else { if (timer){ clearInterval(timer); timer = null; } app.here = null; reapply(); }
}
/** Work is here: keeps the place on this phone, and works out the walk from the station you get off at. */
export async function rememberOffice(){
  if (!app.here || !app.house) return null;
  where.office = { lat: +app.here.lat.toFixed(4), lon: +app.here.lon.toFixed(4) };
  store.setJ('office', where.office);
  if (!index) index = await loadStations().catch(() => null);
  const st = index && app.house.trainTo ? index[app.house.trainTo] : null;
  return st ? { walk: walkMins(distKm(st, where.office)), station: st.name } : null;
}
export function forgetOffice(){ where.office = null; store.del('office'); where.note = ''; }
