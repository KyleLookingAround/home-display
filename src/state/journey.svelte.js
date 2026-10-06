/*
 * Your journey on the phone: the train that matters (the one that gets you in, or home, or the next you can make),
 * followed once you're on it until it gets you there, with where it is now from its live times (src/lib/geo.js).
 * Its details are asked for every 45 seconds while a page shows it; its place moves every few seconds in between.
 */
import { app } from './app.svelte.js';
import { cacheGet, cacheSet } from './cache.js';
import { loadStations, loadService, parseService, trainAt, loadPlaceWeather, pickTrain } from '../lib/geo.js';

class Journey {
  train = $state.raw(null);         // the departure followed (a row from the departure board)
  stops = $state.raw(null);         // its stops (parseService)
  pos = $state.raw(null);           // where it is now (trainAt)
  index = $state.raw(null);         // the stations (stationIndex)
  town = $state.raw(null);          // the weather where you get off, by the hour (loadPlaceWeather)
  err = $state(null);
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
  if (!timer){
    const run = () => { tick().then(townWeather); };
    run(); timer = setInterval(run, 5000);
  }
  return () => { if (--users <= 0){ clearInterval(timer); timer = null; users = 0; } };
}
