/*
 * Your journey on the phone: the train that matters (the one that gets you in, or home, or the next you can make),
 * followed once you're on it until it gets you there, with where it is now from its live times (src/lib/geo.js).
 * Its details are asked for every 45 seconds while a page shows it; its place moves every few seconds in between.
 */
import { app } from './app.svelte.js';
import { store } from '../lib/browser.js';
import { sealToTv } from './house.js';
import { where } from './where.svelte.js';
import { tv, me } from './tv.svelte.js';
import { cacheGet, cacheSet } from './cache.js';
import { loadStations, loadService, parseService, trainAt, loadPlaceWeather, pickTrain, dueAt, tripHome } from '../lib/geo.js';

class Journey {
  train = $state.raw(null);         // the departure followed (a row from the departure board)
  stops = $state.raw(null);         // its stops (parseService)
  pos = $state.raw(null);           // where it is now (trainAt)
  index = $state.raw(null);         // the stations (stationIndex)
  town = $state.raw(null);          // the weather where you get off, by the hour (loadPlaceWeather)
  err = $state(null);
  sharing = $state(false);          // telling the paired TV you're on your way home
  shareNote = $state('');
}
export const jr = new Journey();
let asked = 0, townAt = 0, timer = null, users = 0;

async function tick(){
  if (document.hidden) return;
  const now = Date.now();
  if (!jr.index) jr.index = await loadStations().catch(() => null);
  const d = pickTrain(app.trains, jr.train, now);
  if (!d){ jr.train = null; jr.stops = null; jr.pos = null; return; }
  const same = jr.train && (jr.train.sid || jr.train.rid) === (d.sid || d.rid) && jr.train.sched === d.sched;
  if (!same){ jr.train = d; jr.stops = null; jr.pos = null; asked = 0; }
  if (now - asked > 45e3 && (d.sid || d.rid)){
    asked = now;
    try { jr.stops = parseService(await loadService(d), now); jr.err = null; }
    catch (e){ jr.err = e; }
  }
  jr.pos = jr.stops && jr.index ? trainAt(jr.stops, now, jr.index) : null;
  homeward(now);
}

/* ---------- telling the TV you're on your way home (sealed; readTrip in geo.js) ---------- */
let sentKey = '', sentAt = 0;
function tripOf(now){
  const d = jr.train, leg = app.trains && app.trains.leg;
  if (!d || !leg || !leg.home || !(d.sid || d.rid)) return null;
  const off = jr.pos ? dueAt(jr.pos, leg.to) : null, who = me().name;
  const t = { name: who === 'Phone' ? '' : who, sid: d.sid || null, rid: d.rid || null, sched: d.sched, dest: d.dest, from: leg.from, to: leg.to, walk: leg.after || 0, arr: off ? off.t : d.arr || 0, at: now };
  if (where.on && app.here && now - app.here.at < 5 * 60e3) t.here = { lat: +app.here.lat.toFixed(4), lon: +app.here.lon.toFixed(4), at: app.here.at };
  return t;
}
/** While sharing: the train, again when it changes and each minute; ends once you'd be home. Starts by itself once your train home leaves, if you said so. */
function homeward(now){
  if (!tv.code) return;
  const t = tripOf(now);
  if (!jr.sharing && t && store.get('autoShare') === '1' && (jr.train.exp || jr.train.sched) <= now && store.get('sharedTrain') !== t.sid + t.rid + t.sched){
    store.set('sharedTrain', t.sid + t.rid + t.sched); shareHome(true); return;
  }
  if (!jr.sharing || !t) return;
  const home = tripHome(t, jr.pos);
  if (home && now > home + 10 * 60e3){ shareHome(false); return; }
  const key = [t.sid, t.rid, t.sched, t.here ? t.here.lat + ',' + t.here.lon : ''].join('|');
  if (key === sentKey && now - sentAt < 60e3) return;
  sentKey = key; sentAt = now;
  sealToTv({ trip: t }).then(n => { jr.shareNote = n === 'Sent to the TV.' ? 'The TV shows you\'re on your way.' : n; });
}
/** Starts or stops telling the TV. */
export function shareHome(on){
  jr.sharing = !!on; store.set('shareHome', on ? String(Date.now()) : '');
  sentKey = ''; sentAt = 0;
  if (on) homeward(Date.now());
  else { jr.shareNote = ''; sealToTv({ trip: false }); }
}
/** The weather where you get off, kept for half an hour. */
async function townWeather(){
  const leg = app.trains && app.trains.leg, crs = leg ? (leg.home ? leg.from : leg.work ? leg.to : '') : '', s = crs && jr.index ? jr.index[crs] : null;
  if (!s || (jr.town && Date.now() - townAt < 30 * 60e3)) return;
  townAt = Date.now();
  const key = 'town:' + s.crs, c = await cacheGet(key, 30 * 60e3);
  if (c){ jr.town = c.value; return; }
  try { jr.town = await loadPlaceWeather(s); cacheSet(key, jr.town); } catch (e){}
}
/** Starts following, for as long as a card shows the journey; returns a function that stops. */
export function watchJourney(){
  users++;
  if (!jr.sharing && Date.now() - (+store.get('shareHome') || 0) < 3 * 3600e3) jr.sharing = true;   // still sharing from another page
  if (!timer){
    const run = () => { tick().then(townWeather); };
    run(); timer = setInterval(run, 5000);
  }
  return () => { if (--users <= 0){ clearInterval(timer); timer = null; users = 0; } };
}
