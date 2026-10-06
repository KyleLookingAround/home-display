/* Outdoors: bank holidays, rain in the next hours, the rain radar, air quality, UV and pollen, and flood warnings. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { HOME, hhmm, nz } from './format.js';
import { request } from './net.js';

/* ---------- bank holidays (GOV.UK, England and Wales) ---------- */
export async function loadBankHolidays(){ return parseBankHolidays(await request('https://www.gov.uk/bank-holidays.json')); }
export function parseBankHolidays(j){
  const ev = j && j['england-and-wales'] && j['england-and-wales'].events;
  return (ev || []).map(e => ({ date: e.date, title: e.title })).filter(e => /^\d{4}-\d\d-\d\d$/.test(e.date)).sort((a, b) => a.date < b.date ? -1 : 1);
}

/* ---------- rain in the next hours (Open-Meteo, every 15 minutes) ---------- */
export async function loadNowcast(){
  const j = await request(`https://api.open-meteo.com/v1/forecast?latitude=${HOME.lat}&longitude=${HOME.lon}&minutely_15=precipitation,precipitation_probability&forecast_minutely_15=12&past_minutely_15=1&timezone=Europe%2FLondon`);
  return parseNowcast(j);
}
export function parseNowcast(j){
  const m = (j && j.minutely_15) || {};
  return (m.time || []).map((k, i) => ({ t: +new Date(k), mm: nz(m.precipitation[i], 0), chance: m.precipitation_probability ? m.precipitation_probability[i] : null }));
}
/** Is it raining, and when does that change in the next three hours? Rain counts from 0.1 mm in a quarter hour. */
export function rainSoon(slots, now){
  const wet = s => s.mm >= 0.1;
  const live = (slots || []).filter(s => s.t + 15 * 60e3 > now);
  if (!live.length) return null;
  const nowWet = wet(live[0]);
  for (let i = 1; i < live.length; i++){
    if (wet(live[i]) !== nowWet){
      const t = live[i].t, mins = Math.max(0, Math.round((t - now) / 60e3));
      return nowWet ? { raining: true, stops: t, text: 'Rain stops around ' + hhmm(t) } : { raining: false, starts: t, mins, text: mins <= 15 ? 'Rain starting soon' : 'Rain from ' + hhmm(t), heavy: Math.max.apply(null, live.slice(i).map(s => s.mm)) >= 1 };
    }
  }
  return nowWet ? { raining: true, stops: null, text: 'Raining for the next few hours' } : null;
}

/* ---------- the rain radar (RainViewer frames over Esri's dark grey map) ---------- */
export async function loadRadar(){
  const j = await request('https://api.rainviewer.com/public/weather-maps.json');
  const past = (j && j.radar && j.radar.past) || [], ahead = (j && j.radar && j.radar.nowcast) || [];
  return { host: j.host, frames: past.concat(ahead).map(f => ({ t: f.time * 1000, path: f.path, ahead: ahead.indexOf(f) >= 0 })) };
}
/** The map tile holding a place, and where in it the place sits (0 to 1). */
export function tileOf(lat, lon, z){
  const n = Math.pow(2, z), x = (lon + 180) / 360 * n, r = lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return { x: Math.floor(x), y: Math.floor(y), fx: x - Math.floor(x), fy: y - Math.floor(y) };
}
export const RADAR_ZOOM = 7;
/**
 * Esri's World Dark Gray base map, no labels (Esri, HERE, Garmin, © OpenStreetMap contributors). No key, and browsers
 * may load it; drawn darker on the page to sit in the night sky. CARTO's tiles began asking for a key in October 2026.
 */
export const baseTile = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
export const BASE_CREDIT = '© Esri · OpenStreetMap';
export const radarTile = (host, path, z, x, y) => `${host}${path}/256/${z}/${x}/${y}/2/1_1.png`;

/* ---------- air quality, UV and pollen (Open-Meteo's air quality service, from CAMS) ---------- */
export async function loadAir(){
  const j = await request(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${HOME.lat}&longitude=${HOME.lon}&current=european_aqi,uv_index,grass_pollen,birch_pollen,alder_pollen&hourly=uv_index&forecast_days=1&timezone=Europe%2FLondon`);
  return parseAir(j);
}
export function parseAir(j){
  const c = (j && j.current) || {}, h = (j && j.hourly) || {};
  const uvMax = (h.uv_index || []).reduce((m, v) => v != null && v > m ? v : m, 0);
  return { aqi: nz(c.european_aqi, null), uv: nz(c.uv_index, null), uvMax, pollen: { grass: nz(c.grass_pollen, null), tree: Math.max(nz(c.birch_pollen, 0), nz(c.alder_pollen, 0)) } };
}
const band = (v, cuts, names) => { if (v == null) return null; let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return names[i]; };
/** European Air Quality Index bands. */
export const aqiLabel = v => band(v, [20, 40, 60, 80, 100], ['Good', 'Fair', 'Moderate', 'Poor', 'Very poor', 'Extremely poor']);
/** UV index bands, as the Met Office gives them. */
export const uvLabel = v => band(v, [3, 6, 8, 11], ['Low', 'Moderate', 'High', 'Very high', 'Extreme']);
/** Pollen in grains per cubic metre, on the Met Office's bands: grass 30, 50, 150; trees (birch) 40, 80, 200. */
export const pollenLabel = (v, kind) => band(v, kind === 'grass' ? [1, 30, 50, 150] : [1, 40, 80, 200], ['None', 'Low', 'Moderate', 'High', 'Very high']);

/* ---------- flood warnings (Environment Agency, within 15 km) ---------- */
export async function loadFloods(){ return parseFloods(await request(`https://environment.data.gov.uk/flood-monitoring/id/floods?lat=${HOME.lat}&long=${HOME.lon}&dist=15`)); }
export const FLOOD_LEVELS = { 1: 'Severe flood warning', 2: 'Flood warning', 3: 'Flood alert' };
export function parseFloods(j){
  return ((j && j.items) || []).filter(f => f.severityLevel >= 1 && f.severityLevel <= 3)
    .map(f => ({ level: f.severityLevel, title: FLOOD_LEVELS[f.severityLevel], area: f.description || (f.floodArea && f.floodArea.label) || '', message: String(f.message || '').trim(), raised: +new Date(f.timeRaised) || null }))
    .sort((a, b) => a.level - b.level);
}
