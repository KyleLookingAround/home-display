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
import { loadBankHolidays, loadNowcast, loadRadar, loadAir, loadFloods } from '../lib/outdoors.js';
import { loadGridMix } from '../lib/carbon.js';
import { CI_REGION } from '../lib/format.js';
import { tv, tvSend } from './tv.svelte.js';
import { liveTrains, watchWhere } from './where.svelte.js';
import { lockSecret, canSeal, sealDetails } from '../lib/remote.js';
import { mergeSettings, deviceChanges, loadDisplayWeather, loadCouncilBins, loadCalendar, loadTrainsLive, commuteLeg, cleanPlan, officeDay } from '../lib/household.js';
import { logDay } from '../lib/geo.js';

const MIN = 60e3;
let started = null, shared = null;

/** Household settings: household.json (published with the site), then this device's own changes. */
export function houseSettings(){ return started || (started = loadSettings()); }
async function loadSettings(){
  shared = null;
  try { const r = await fetch('household.json', { cache: 'no-cache' }); if (r.ok) shared = await r.json(); } catch {}
  app.house = Object.assign(mergeSettings(shared, store.getJ('display', null)), { plan: cleanPlan(store.getJ('plan', {}), Date.now()) });
  logOffice();
  return app.house;
}
/** The office days you've been in, for your commute in numbers: today joins the log once it's an office day and your day has started. */
export function logOffice(){
  if (!app.house || !app.house.trainTo) return;
  const now = Date.now(), old = store.getJ('officeLog', []), log = logDay(old, officeDay(app.house, now, app.holidays), now);
  if (log.length !== old.length) store.setJ('officeLog', log);
}
/** Your office days as planned on this phone: { 'YYYY-MM-DD': { in, start?, end? } }, only the days that differ from your usual week. */
export function savePlan(plan){
  const p = cleanPlan(plan, Date.now());
  store.setJ('plan', p);
  if (app.house){ app.house = Object.assign({}, app.house, { plan: p }); logOffice(); }
  loadTrains(true);
  return p;
}
/**
 * Saves the household form on this device: only what differs from household.json is kept (in the same store the
 * display uses), so later edits to the shared file still arrive. Other keys this device holds are left alone.
 */
export async function saveHouse(form){
  await houseSettings();
  const mine = Object.assign({}, store.getJ('display', null) || {});
  Object.keys(form).forEach(k => { delete mine[k]; });
  store.setJ('display', Object.assign(mine, deviceChanges(form, shared)));
  started = null; await houseSettings();
  loadTrains(true); loadEvents(true);
  if ('workDays' in form || 'workStart' in form || 'workEnd' in form || 'workWalk' in form) commuteToTv(0);
}
/**
 * Sends the paired TV your office days, sealed with the site's PIN: your usual week and the days that differ. They
 * never go in household.json, which is public: they say when the house is empty. Resolves to what to tell you.
 */
let tvTimer = 0;
export function commuteToTv(wait = 1200){
  clearTimeout(tvTimer);
  if (!tv.code || !app.house) return Promise.resolve('');
  const secret = lockSecret();
  if (!secret || !canSeal()) return Promise.resolve('To change the TV too, unlock the site on both with the same PIN, with Remember ticked.');
  const s = app.house;
  return new Promise(done => { tvTimer = setTimeout(() => sealToTv({ plan: s.plan || {}, week: { days: s.workDays || [], start: s.workStart, end: s.workEnd, walk: s.workWalk } }).then(done), wait); });
}
/** Seals details with the site's PIN and sends them to the paired TV. Resolves to what to tell you. */
export async function sealToTv(details){
  const secret = lockSecret();
  if (!tv.code) return '';
  if (!secret || !canSeal()) return 'To tell the TV, unlock the site on both with the same PIN, with Remember ticked.';
  try { return await tvSend('account', { box: await sealDetails(tv.code, secret, details) }) ? 'Sent to the TV.' : 'The TV didn\'t get it. Try again.'; }
  catch (e){ return 'This browser couldn\'t seal it for the TV.'; }
}

async function cached(key, age, run, set, setErr, force){
  const c = force ? null : await cacheGet(key, age);
  if (c){ set(c.value); setErr(null); return c.value; }
  try { const v = await run(); set(v); setErr(null); cacheSet(key, v); return v; }
  catch (e){ setErr(e); const old = await cacheGet(key); if (old) set(old.value); return null; }
}
export const loadWeather = force => cached('weather', 15 * MIN, loadDisplayWeather, v => { app.weather = v; }, e => { app.weatherErr = e; }, force);
export const loadHolidays = force => cached('holidays', 7 * 24 * 60 * MIN, loadBankHolidays, v => { app.holidays = v; }, () => {}, force);
export const loadRain = force => cached('nowcast', 10 * MIN, loadNowcast, v => { app.nowcast = v; }, () => {}, force);
export const loadRadarFrames = force => cached('radar', 5 * MIN, loadRadar, v => { app.radar = v; }, () => {}, force);
export const loadAirNow = force => cached('air', 60 * MIN, loadAir, v => { app.air = v; }, () => {}, force);
export const loadFloodWarnings = force => cached('floods', 15 * MIN, loadFloods, v => { app.floods = v; }, () => {}, force);
export const loadGrid = force => cached('gridmix:' + app.region, 30 * MIN, () => loadGridMix(CI_REGION[app.region]), v => { app.gridMix = v; }, () => {}, force);
export const loadCouncil = force => cached('council', 3 * 60 * MIN, loadCouncilBins, v => { app.council = v; }, () => {}, force);
export async function loadTrains(force){
  await houseSettings();
  const s = app.house;                 // as it is now, with any office day just changed (savePlan)
  if (!s.trainFrom){ app.trains = null; return null; }
  // the commute turns round in the afternoon on a work day: the way home, from where you work
  const leg = commuteLeg(s, Date.now(), app.holidays);
  return cached('trains:' + [leg.from, leg.to, leg.walk, leg.after, leg.start || 0, leg.end || 0].join(':'), 2 * MIN, () => loadTrainsLive(leg.from, leg.to).then(r => Object.assign(r, { leg })),
    v => { app.trainsBase = v; app.trains = liveTrains(v); }, e => { app.trainsErr = e; }, force);
}
export async function loadEvents(force){
  const s = await houseSettings();
  if (!s.ical){ app.events = null; app.eventsErr = null; return null; }
  return cached('events', 15 * MIN, () => loadCalendar(s.ical), v => { app.events = v; }, e => { app.eventsErr = e; }, force);
}

/**
 * Starts the household sources a page shows, and keeps them fresh while it's open. Several cards can ask: the
 * page runs one set of timers for everything any of them wants. Returns a stop function.
 */
const LOADERS = {
  weather: loadWeather, bins: f => { loadCouncil(f); loadHolidays(f); }, trains: loadTrains, events: loadEvents,
  rain: loadRain, radar: loadRadarFrames, air: loadAirNow, floods: loadFloodWarnings, grid: loadGrid
};
const wanted = {};
let timers = null;
export function watchHouse(ask = {}){
  boot(); houseSettings();
  watchWhere(plan => { savePlan(plan); commuteToTv(); });   // where the phone is, when location is on
  const want = Object.assign({ weather: true, bins: true, trains: true, events: true, rain: true, floods: true }, ask);
  const fresh = Object.keys(want).filter(k => want[k] && !wanted[k] && LOADERS[k]);
  fresh.forEach(k => { wanted[k] = true; });
  const run = (force, keys) => { if (!document.hidden) keys.forEach(k => LOADERS[k](force)); };
  run(false, fresh);
  if (!timers){
    const all = () => Object.keys(wanted);
    const back = () => { if (!document.hidden) run(false, all()); };
    document.addEventListener('visibilitychange', back);
    timers = [setInterval(() => { if (!document.hidden && wanted.trains) loadTrains(true); }, 2 * MIN), setInterval(() => run(false, all()), 5 * MIN), back];
  }
  return () => {};   // the page's timers stop when the page goes
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
