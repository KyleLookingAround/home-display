/*
 * The household's sources for the phone pages: settings, weather, bins, the calendar and trains, and the Home Mini.
 * Each is cached in IndexedDB with its own age, and refreshed while a page that shows it is open.
 */
import { app } from './app.svelte.js';
import { cacheGet, cacheSet } from './cache.js';
import { boot } from './session.js';
import { store } from '../lib/browser.js';
import { NET } from '../lib/net.js';
import { findHomeMini, liveReading } from '../lib/octopus.js';
import { mergeSettings, loadDisplayWeather, loadCouncilBins, loadCalendar, loadTrainsLive } from '../lib/household.js';

const MIN = 60e3;
let started = null;

/** Household settings: household.json (published with the site), then this device's own changes. */
export function houseSettings(){ return started || (started = loadSettings()); }
async function loadSettings(){
  let shared = null;
  try { const r = await fetch('household.json', { cache: 'no-cache' }); if (r.ok) shared = await r.json(); } catch {}
  app.house = mergeSettings(shared, store.getJ('display', null));
  return app.house;
}
/** Saves this device's household changes (the same store the display uses on this device) and applies them. */
export async function saveHouse(changes){
  const mine = Object.assign({}, store.getJ('display', null) || {}, changes);
  store.setJ('display', mine);
  started = null; await houseSettings();
  loadTrains(true); loadEvents(true);
}

async function cached(key, age, run, set, setErr, force){
  const c = force ? null : await cacheGet(key, age);
  if (c){ set(c.value); setErr(null); return c.value; }
  try { const v = await run(); set(v); setErr(null); cacheSet(key, v); return v; }
  catch (e){ setErr(e); const old = await cacheGet(key); if (old) set(old.value); return null; }
}
export const loadWeather = force => cached('weather', 15 * MIN, loadDisplayWeather, v => { app.weather = v; }, e => { app.weatherErr = e; }, force);
export const loadCouncil = force => cached('council', 3 * 60 * MIN, loadCouncilBins, v => { app.council = v; }, () => {}, force);
export async function loadTrains(force){
  const s = await houseSettings();
  if (!s.trainFrom){ app.trains = null; return null; }
  return cached('trains:' + s.trainFrom + ':' + (s.trainTo || ''), 2 * MIN, () => loadTrainsLive(s.trainFrom, s.trainTo), v => { app.trains = v; }, e => { app.trainsErr = e; }, force);
}
export async function loadEvents(force){
  const s = await houseSettings();
  if (!s.ical){ app.events = null; app.eventsErr = null; return null; }
  return cached('events', 15 * MIN, () => loadCalendar(s.ical), v => { app.events = v; }, e => { app.eventsErr = e; }, force);
}

/** Starts the household sources a page shows, and keeps them fresh while it's open. Returns a stop function. */
export function watchHouse({ weather = true, bins = true, trains = true, events = true } = {}){
  boot(); houseSettings();
  const run = force => { if (document.hidden) return; if (weather) loadWeather(force); if (bins) loadCouncil(force); if (trains) loadTrains(force); if (events) loadEvents(force); };
  run(false);
  const t1 = setInterval(() => { if (!document.hidden && trains) loadTrains(true); }, 2 * MIN);
  const t2 = setInterval(() => run(false), 15 * MIN);
  const back = () => { if (!document.hidden) run(false); };
  document.addEventListener('visibilitychange', back);
  return () => { clearInterval(t1); clearInterval(t2); document.removeEventListener('visibilitychange', back); };
}

/**
 * The Home Mini, while a page that shows it is open: the draw every minute, and today's half hours every ten,
 * which keeps well inside Octopus's limit of about 100 calls an hour.
 */
export function watchLive(){
  let timer = null, rowsAt = 0, stopped = false, device = null;
  const poll = async () => {
    if (document.hidden || stopped || !device) return;
    const withToday = Date.now() - rowsAt > 10 * MIN;
    try {
      const d = await liveReading(device, withToday);
      if (withToday) rowsAt = Date.now();
      else if (app.live){ d.today = app.live.today; d.rows = app.live.rows; }
      app.live = d; app.liveErr = null;
    } catch (e){ app.liveErr = e; }
  };
  (async () => {
    await boot();
    if (app.demo || !NET.creds){ app.liveState = ''; return; }
    app.liveState = 'looking';
    try { device = store.get('mini.' + NET.creds.account) || await findHomeMini(); if (device) store.set('mini.' + NET.creds.account, device); }
    catch (e){ app.liveErr = e; }
    app.liveState = device ? 'on' : 'none';
    if (device && !stopped){ poll(); timer = setInterval(poll, MIN); }
  })();
  const back = () => { if (!document.hidden) poll(); };
  document.addEventListener('visibilitychange', back);
  return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', back); };
}
