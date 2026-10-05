/*
 * Loading the dashboard's data, once per page however many islands ask. A connected account's data comes from the
 * cache straight away when there is some, and is fetched again when it's over half an hour old or on Refresh.
 * Prices and the grid forecast keep for ten minutes.
 */
import { app } from './app.svelte.js';
import { cacheGet, cacheSet, cacheClear } from './cache.js';
import { store } from '../lib/browser.js';
import { NET, detectProxy, errorText } from '../lib/net.js';
import { loadAccount, loadAgile, loadRewards } from '../lib/octopus.js';
import { loadCarbonForecast, loadCarbonHistory } from '../lib/carbon.js';
import { loadWeather } from '../lib/weather.js';
import { makeDemo } from '../lib/analysis.js';
import { CI_REGION, addDays, startOfDay } from '../lib/format.js';

const MIN = 60e3, ACCOUNT_AGE = 30 * MIN, PRICES_AGE = 10 * MIN;
let booted = null;

/** Starts the page's data, once. Every island calls it. */
export function boot(){ return booted || (booted = start()); }

async function start(){
  const k = store.get('key'), a = store.get('account');
  if (k && a) NET.creds = { account: a, key: k };
  app.account = NET.creds ? NET.creds.account : null;
  let fresh = false;
  if (NET.creds){
    const c = await cacheGet('account:' + NET.creds.account);
    if (c){ app.raw = c.value; app.checkedAt = c.at; app.status = 'live'; fresh = Date.now() - c.at < ACCOUNT_AGE; }
  } else { app.raw = makeDemo(); app.status = 'demo'; }
  app.proxy = await detectProxy();
  if (!fresh) refresh(); else loadRewardsOnce();
  loadPrices();
  setInterval(() => { if (!document.hidden) loadPrices(true); }, 30 * MIN);
  setInterval(() => { app.now = Date.now(); }, MIN);
}

/** Fetches the account again: on start when the cache is old, on Refresh, and after the settings change. */
export async function refresh(){
  app.rewards = null; app.notice = null;
  if (!NET.creds){ app.account = null; app.raw = makeDemo(); app.status = 'demo'; return; }
  app.account = NET.creds.account; app.status = 'loading';
  try {
    const raw = await loadAccount({ gasUnit: app.gasUnit, pay: app.pay, fallbackRegion: app.region });
    if (raw.region !== app.region){ app.region = raw.region; store.set('region', raw.region); loadPrices(true); }
    app.raw = raw; app.status = 'live'; app.checkedAt = Date.now();
    if (!raw.elec.length && !raw.gas.length) app.notice = { kind: 'warn', title: 'Connected. No smart meter readings yet.', body: 'Readings show up a day or two after your smart meter starts sending data. Tariffs, prices, the grid forecast and the cost tables work already.' };
    cacheSet('account:' + NET.creds.account, raw);
    loadExtras(raw);
  } catch (e){
    const [title, body] = errorText(e); app.status = 'err'; app.notice = { kind: 'err', title, body };
    if (!app.raw) app.raw = makeDemo();
  }
  loadRewardsOnce();
}

/** Weather, Agile history and carbon history: they fill in the patterns, comparisons and footprint once they arrive. */
async function loadExtras(raw){
  const end = startOfDay(new Date()), more = {};
  await Promise.all([
    loadWeather().then(w => { more.weather = w; }).catch(() => {}),
    raw.elec.length ? loadAgile(raw.region, new Date(raw.elec[0].t), end, 4).then(a => { more.agileHist = a; }).catch(() => {}) : null,
    raw.elec.length ? loadCarbonHistory(CI_REGION[raw.region], new Date(raw.elec[0].t), end).then(c => { more.carbonHist = c; }).catch(() => {}) : null
  ]);
  if (app.raw !== raw) return;
  app.raw = Object.assign({}, raw, more);
  cacheSet('account:' + NET.creds.account, app.raw);
}

async function loadRewardsOnce(){
  if (!NET.creds){ app.rewards = null; return; }
  const key = 'rewards:' + NET.creds.account, c = await cacheGet(key, ACCOUNT_AGE);
  if (c){ app.rewards = c.value; return; }
  try { app.rewards = await loadRewards(); cacheSet(key, app.rewards); } catch { app.rewards = { sessions: null, points: null }; }
}

/** Today's and tomorrow's Agile prices and the grid's carbon forecast for the region. */
export async function loadPrices(force){
  const region = app.region, key = 'prices:' + region;
  const c = force ? null : await cacheGet(key, PRICES_AGE);
  if (c){ ({ agile: app.agileToday, carbon: app.carbonFc } = c.value); app.agileErr = app.carbonErr = null; return; }
  const today = startOfDay(new Date());
  let agile = null, carbon = null;
  try { agile = await loadAgile(region, today, addDays(today, 2), 1); app.agileErr = null; } catch (e){ app.agileErr = e; }
  try { carbon = await loadCarbonForecast(CI_REGION[region]); app.carbonErr = null; } catch (e){ app.carbonErr = e; }
  if (region !== app.region) return;
  // no signal: the last prices kept here are better than none (the strips only show what's still ahead)
  if (!agile || !carbon){ const old = await cacheGet(key); if (old){ agile = agile || old.value.agile; carbon = carbon || old.value.carbon; } }
  app.agileToday = agile; app.carbonFc = carbon;
  if (agile && carbon && !app.agileErr && !app.carbonErr) cacheSet(key, { agile, carbon });
}

/** Connects an account, or forgets it. */
export function connect({ account, key, gasUnit, pay, remember }){
  NET.creds = { account, key }; NET.token = null;
  app.gasUnit = gasUnit; app.pay = pay;
  if (remember){ store.set('account', account); store.set('key', key); store.set('gasUnit', gasUnit); store.set('pay', pay); }
  else ['account', 'key'].forEach(k => store.del(k));
  return refresh();
}
export async function forget(){
  ['account', 'key', 'gasUnit', 'pay'].forEach(k => store.del(k));
  NET.creds = null; NET.token = null;
  await cacheClear();
  await refresh();
  app.notice = { kind: 'warn', title: 'Your details have been removed from this browser.', body: 'Showing example data again.' };
}
