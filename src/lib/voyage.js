/* The screensaver's logic, pure: the sky and the engines, the billboards, the world outside, the road ahead and the cabin's dials. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
import { clamp, dayKey, gbp, hhmm, HOME, kwh, median, nz, pence, startOfDay } from './format.js';
import { request } from './net.js';
import { cheapestWindow } from './analysis.js';
import { leaveBy, longDay, nextCollections, relDay, weatherText } from './household.js';

/* ---------- the cockpit: what the weather and the power price do to the view ---------- */
export const WX_PRESETS = {
  clear: { code: 0 }, cloud: { code: 3 }, rain: { code: 63 }, drizzle: { code: 53 }, snow: { code: 73, temp: -1 },
  fog: { code: 45 }, thunder: { code: 95 }, wind: { code: 2, wind: 38 }, cold: { code: 1, temp: -4 }
};
/** The sky outside the window, from Open-Meteo's current weather and the sun's times. Every value runs 0 to 1. */
export function skyFor(W, now = Date.now(), preview){
  const p = preview || {}, cur = Object.assign({ code: 0, temp: 12, wind: 6 }, W && W.now ? { code: W.now.code, temp: W.now.temp, wind: W.now.wind } : {}, WX_PRESETS[p.wx] || {});
  const day = W && W.days ? W.days.filter(d => d.k === dayKey(now))[0] || W.days[0] : null;
  const rise = day ? day.rise : +startOfDay(new Date(now)) + 7*3600e3, set = day ? day.set : +startOfDay(new Date(now)) + 19*3600e3;
  const phase = p.phase || (now < rise - 40*60e3 || now > set + 40*60e3 ? 'night' : now < rise + 60*60e3 ? 'dawn' : now > set - 60*60e3 ? 'dusk' : 'day');
  const c = +cur.code, pick = (table, d) => { for (const k in table) if (table[k].indexOf(c) >= 0) return +k; return d; };
  const rain = pick({ .35: [51, 53, 55, 56, 57], .5: [61, 80], .7: [63, 66, 67, 81], 1: [65, 82], .8: [95, 96, 99] }, 0);
  const snow = pick({ .4: [71, 77], .7: [73, 85], 1: [75, 86] }, 0);
  const cloud = pick({ .15: [1], .45: [2], .85: [3], .6: [45, 48], .75: [51, 53, 55, 61, 63, 65, 80, 81, 82, 71, 73, 75, 85, 86], 1: [95, 96, 99] }, 0);
  const fog = c === 45 || c === 48 ? 1 : 0, thunder = c >= 95 ? 1 : 0;
  const sun = phase === 'day' ? (c === 0 ? 1 : c === 1 ? .8 : c === 2 ? .45 : 0) : 0;
  const cold = cur.temp <= -2 ? 1 : cur.temp <= 1 ? .7 : cur.temp <= 4 ? .35 : 0;
  const wind = clamp((cur.wind - 12) / 26, 0, 1);
  // Is rain on its way in the next few hours, while it's dry now?
  let soon = null;
  if (!rain && !snow && W && W.hours) for (const h of W.hours) if (h.t > now && (h.rain >= 60 || (h.code >= 51 && h.code <= 82))){ soon = h.t; break; }
  return { phase, rain, snow, cloud, fog, thunder, sun, cold, wind, temp: cur.temp, code: c, rainSoon: soon };
}
/** The ship's engines follow the Agile price: paid to use power means warp speed, peak price means power saving. */
export function engineFor(price, carbonIndex){
  const dust = carbonIndex === 'very high' ? .8 : carbonIndex === 'high' ? .5 : 0;
  if (price == null) return { mode: 'cruise', label: 'Cruising', speed: 1, tone: 'muted', dust };
  if (price < 0) return { mode: 'warp', label: 'Warp speed: paid to use power', speed: 4, tone: 'neg', dust };
  if (price < 15) return { mode: 'fast', label: 'Full speed: power is cheap', speed: 1.8, tone: 'good', dust };
  if (price < 25) return { mode: 'cruise', label: 'Cruising', speed: 1, tone: 'warn', dust };
  return { mode: 'eco', label: 'Power saving: peak price', speed: .45, tone: 'bad', dust };
}
/**
 * The billboards that fly past the window: one fact each, built from whatever data has arrived.
 * weight 2 or 3 means it comes round more often (bins tonight, leave for the train soon, negative prices).
 */
export function buildBillboards(x, now = Date.now()){
  const out = [], add = (id, kind, tone, head, big, sub, weight) => out.push({ id, kind, tone, head, big, sub: sub || '', weight: weight || 1 });
  const ag = x.agile || [], cur = ag.filter(r => r.from <= now && now < r.to)[0];
  if (cur){
    const tone = cur.p < 0 ? 'neg' : cur.p < 15 ? 'good' : cur.p < 25 ? 'warn' : 'bad';
    add('price', 'energy', tone, 'Agile power now', pence(cur.p), cur.p < 0 ? 'You\'re paid to use power' : cur.p < 15 ? 'Cheap: a good time to run things' : cur.p >= 25 ? 'Peak price: save it for later' : 'Per kWh, until ' + hhmm(cur.to), cur.p < 0 ? 3 : 1);
    const best = cheapestWindow(ag, 4, now);
    if (best) add('cheap', 'energy', 'good', 'Cheapest two hours', `${hhmm(best.from)}–${hhmm(best.to)}`, `${relDay(best.from, now)} · average ${pence(best.avg)}`);
    const neg = ag.filter(r => r.to > now && r.p < 0);
    if (neg.length && !(cur.p < 0)) add('plunge', 'energy', 'neg', 'Plunge pricing ahead', `${relDay(neg[0].from, now)} ${hhmm(neg[0].from)}`, `Agile goes below zero, as low as ${pence(Math.min.apply(null, neg.map(r => r.p)))}`, 3);
  }
  if (x.live && x.live.demand != null) add('draw', 'energy', 'warn', 'Home drawing now', Math.round(x.live.demand).toLocaleString('en-GB') + ' W', x.live.today != null ? `${kwh(x.live.today)} used today${x.cost != null ? ' · ' + gbp(x.cost) : ''}` : '');
  const ci = x.carbon ? x.carbon.filter(r => r.from <= now && now < r.to)[0] : null;
  if (ci){
    const g = cheapestWindow(x.carbon.map(r => ({ from: r.from, to: r.to, p: r.v })), 6, now);
    add('grid', 'energy', /low/.test(ci.index) ? 'good' : /high/.test(ci.index) ? 'bad' : 'warn', 'Grid carbon', `${ci.v} g/kWh`, `${ci.index}${g ? ' · greenest from ' + hhmm(g.from) : ''}`);
  }
  const W = x.weather;
  if (W){
    const w = weatherText(W.now.code), today = W.days.filter(d => d.k === dayKey(now))[0];
    add('wx', 'weather', 'cyan', 'Outside', `${Math.round(W.now.temp)}° ${w.text.toLowerCase()}`, today ? `High ${Math.round(today.max)}°, low ${Math.round(today.min)}° · wind ${Math.round(W.now.wind)} mph` : '');
    const sky = skyFor(W, now);
    if (sky.rainSoon) add('rainsoon', 'weather', 'cyan', 'Rain on the way', `From ${hhmm(sky.rainSoon)}`, 'Bring the washing in', 2);
    if (today && now < today.set && today.set - now < 3*3600e3) add('sunset', 'weather', 'warn', 'Sunset', hhmm(today.set), `In ${Math.round((today.set - now) / 60e3)} minutes`);
    else if (today && now < today.rise) add('sunrise', 'weather', 'warn', 'Sunrise', hhmm(today.rise), '');
  }
  const bins = x.bins && x.bins.length ? nextCollections(x.bins, now) : [];
  if (bins.length){
    const first = bins[0], same = bins.filter(b => b.days === first.days).map(b => b.name).join(' and ');
    const hour = new Date(now).getHours();
    if (first.days <= 1) add('bins', 'home', 'warn', first.days === 0 ? 'Bin day today' : 'Bins tomorrow', same, first.days === 1 && hour >= 12 ? 'Put them out tonight' : '', first.days === 1 && hour >= 16 ? 3 : 2);
    else add('bins', 'home', 'muted', 'Next bins', relDay(+first.date, now), same);
  }
  (x.events || []).filter(e => e.end > now && e.start < now + 2*864e5).slice(0, 3).forEach((e, i) => add('event' + i, 'home', 'violet', relDay(e.start, now) + (e.allDay ? '' : ' ' + hhmm(e.start)), e.title, e.where || ''));
  const t = x.trains ? x.trains.list.filter(d => !d.cancelled && (d.exp || d.sched) - x.walk*60e3 > now - 60e3)[0] : null;
  if (t){
    const lv = leaveBy(t.exp || t.sched, x.walk, now);
    add('train', 'travel', lv.cls === 'good' ? 'cyan' : lv.cls, `${hhmm(t.sched)} to ${t.dest}`, lv.text, `${t.platform ? 'Platform ' + t.platform + ' · ' : ''}${t.delayed ? 'Delayed' : t.exp && t.exp - t.sched >= 60e3 ? 'Expected ' + hhmm(t.exp) : 'On time'}`, lv.mins <= 10 ? 3 : 1);
  }
  if (x.iss && x.iss.near) add('iss', 'space', 'cyan', 'The real ISS is over you', `${x.iss.alt} km up`, `${x.iss.km.toLocaleString('en-GB')} km away · ${x.iss.speed.toLocaleString('en-GB')} km/h`, 3);
  const moon = moonPhase(now);
  if (W){ const today = W.days.filter(d => d.k === dayKey(now))[0]; if (today && (now > today.set - 3600e3 || now < today.rise)) add('moon', 'space', 'violet', 'The moon tonight', moon.name, `${Math.round(moon.illum * 100)}% lit`); }
  add('date', 'home', 'muted', 'Stardate', longDay(new Date(now)), x.label || '');
  return out;
}
/** The order billboards come round in: heavier ones repeat, never the same one twice in a row. */
export function billboardRotation(cards){
  const out = [], rounds = Math.max.apply(null, cards.map(c => c.weight).concat([1]));
  for (let r = 0; r < rounds; r++) cards.forEach(c => { if (c.weight > r) out.push(c); });
  for (let i = 1; i < out.length; i++) if (out[i].id === out[i - 1].id){ const j = out.findIndex((c, k) => k > i && c.id !== out[i].id); if (j > 0){ const tmp = out[i]; out[i] = out[j]; out[j] = tmp; } }
  return out;
}

/* ---------- the world outside the window: what the data does to the scenery ---------- */
/** The moon's real phase. f runs 0 (new) to 0.5 (full) to 1; illum is the lit fraction of the disc. */
export function moonPhase(now = Date.now()){
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);   // a known new moon
  const age = (((now - ref) / 864e5) % syn + syn) % syn, f = age / syn;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { age, f, illum: (1 - Math.cos(f * 2 * Math.PI)) / 2, waxing: f < .5, name: names[Math.round(f * 8) % 8] };
}
export function kmBetween(lat1, lon1, lat2, lon2){
  const r = Math.PI / 180, a = Math.pow(Math.sin((lat2 - lat1) * r / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin((lon2 - lon1) * r / 2), 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/** Where the real International Space Station is, from wheretheiss.at; near means high enough in our sky to wave at. */
export function issPass(iss, home){
  if (!iss || iss.latitude == null || iss.longitude == null) return null;
  const km = kmBetween(home.lat, home.lon, +iss.latitude, +iss.longitude);
  return { km: Math.round(km), near: km < 1500, alt: Math.round(+iss.altitude || 420), speed: Math.round(+iss.velocity || 27600), lit: iss.visibility || '' };
}
export async function loadISS(){ return request('https://api.wheretheiss.at/v1/satellites/25544', { headers: { Accept: 'application/json' } }); }
/**
 * What the scenery shows:
 * - aurora: 0 to 1, when the grid is clean or you're paid to use power;
 * - comet: bin colours on bin night (the evening before, and the morning of);
 * - moon: its real phase;
 * - house: your house on its asteroid. Its windows glow with your live draw, its chimney smokes when it's cold,
 *   its bins are out when they're due, and its lantern shows the power price;
 * - iss: whether the real ISS is overhead.
 */
export function worldFor(x, now = Date.now()){
  const at = list => list ? list.filter(r => r.from <= now && now < r.to)[0] : null;
  const ci = at(x.carbon), ag = at(x.agile), hour = new Date(now).getHours();
  let aurora = ci ? ({ 'very low': 1, low: .6 })[ci.index] || 0 : 0;
  if (ag && ag.p < 0) aurora = Math.max(aurora, .9);
  const bins = x.bins && x.bins.length ? nextCollections(x.bins, now) : [];
  const uniq = a => a.filter((c, i) => a.indexOf(c) === i);
  const comet = uniq(bins.filter(b => (b.days === 1 && hour >= 16) || (b.days === 0 && hour < 10)).map(b => b.colour));
  const out = uniq(bins.filter(b => b.days === 0 || (b.days === 1 && hour >= 16)).map(b => b.colour));
  const W = x.weather, temp = W ? W.now.temp : 12, sky = x.sky || skyFor(W, now), dark = sky.phase !== 'day';
  const demand = x.live && x.live.demand != null ? x.live.demand : null;
  return {
    aurora, comet, moon: moonPhase(now), iss: issPass(x.iss, HOME),
    house: { glow: demand != null ? clamp(.12 + demand / 3000 * .88, .12, 1) : dark ? .6 : .18, demand, dark,
             smoke: temp < 12 ? clamp((14 - temp) / 16, .2, 1) : 0, bins: out,
             lantern: ag ? (ag.p < 0 ? 'neg' : ag.p < 15 ? 'good' : ag.p < 25 ? 'warn' : 'bad') : 'warn' }
  };
}
/** Billboards are for what you need to catch; everything else rides on the space train. */
export const URGENT = ['price', 'plunge', 'bins', 'train', 'rainsoon', 'iss'];
export function boardCards(cards){ return cards.filter(c => c.weight >= 2 || URGENT.indexOf(c.id) >= 0); }

/* ---------- the road ahead: time laid along the window, now at the left and later to the right ---------- */
export const AHEAD = 12 * 3600e3;
/** What kind of weather a forecast hour brings, if it's wet: thunder, snow or rain. */
export function wetKind(h){
  const c = +h.code;
  if (c >= 95) return 'thunder';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || h.rain >= 60) return 'rain';
  return null;
}
/**
 * The next twelve hours, for the landscape along the bottom of the window:
 * - range: the Agile price each half hour (peaks are dear, valleys cheap);
 * - dock: the cheapest two hours in it, where the fuel dock waits;
 * - fronts: spells of rain, snow or thunder from the hourly forecast;
 * - waypoints: calendar events starting in it;
 * - train: the next train, and whether it's time to think about leaving (mine).
 */
export function voyageFor(x, now = Date.now()){
  const end = now + AHEAD, ag = (x.agile || []).filter(r => r.to > now && r.from < end);
  const range = ag.length ? ag.map(r => ({ from: r.from, to: r.to, p: r.p })) : null;
  let dock = null;
  const best = ag.length >= 4 ? cheapestWindow(ag, 4, now) : null;
  if (best) dock = { from: best.from, to: best.to, avg: best.avg, now: best.from <= now, mins: Math.max(0, Math.round((best.from - now) / 60e3)) };
  const fronts = [];
  ((x.weather && x.weather.hours) || []).forEach(h => {
    const kind = wetKind(h), last = fronts[fronts.length - 1];
    if (!kind || h.t + 3600e3 <= now || h.t >= end) return;
    if (last && last.to === h.t){ last.to = h.t + 3600e3; if (kind === 'thunder' || (kind === 'snow' && last.kind === 'rain')) last.kind = kind; }
    else fronts.push({ from: h.t, to: h.t + 3600e3, kind });
  });
  const waypoints = (x.events || []).filter(e => !e.allDay && e.start > now && e.start < end).slice(0, 4).map(e => ({ t: e.start, title: e.title }));
  let train = null;
  const t = x.trains ? x.trains.list.filter(d => !d.cancelled && (d.exp || d.sched) - nz(x.walk, 0) * 60e3 > now - 60e3)[0] : null;
  if (t){
    const leave = leaveBy(t.exp || t.sched, nz(x.walk, 0), now);
    train = { dest: t.dest, sched: t.sched, exp: t.exp, platform: t.platform, delayed: t.delayed, station: x.trains.station || '', walk: nz(x.walk, 0), leave,
              mine: leave.mins <= 20 && leave.mins >= -2 };
  }
  return { from: now, to: end, range, dock, fronts, waypoints, train };
}
/** Cards the road ahead already shows, so they needn't ride the train or a billboard as well. */
export function shownAhead(v){
  const ids = [];
  if (v.dock) ids.push('cheap');
  if (v.train && v.train.mine) ids.push('train');
  return ids;
}

/* ---------- the cabin's instruments: what's true right now ---------- */
/** Keeps each day's cost, so today can be set against a usual day. A day counts once the screen saw it after 10pm. */
export function recordCost(history, now, pence){
  const h = Object.assign({}, history || {}), k = dayKey(now);
  if (pence != null) h[k] = { p: Math.round(pence), late: new Date(now).getHours() >= 22 };
  Object.keys(h).sort().slice(0, -15).forEach(d => { delete h[d]; });
  return h;
}
/** The usual day's cost: the median of whole days seen, once there are three. */
export function usualCost(history, now){
  const k = dayKey(now), v = Object.keys(history || {}).filter(d => d !== k && history[d].late).map(d => history[d].p).sort((a, b) => a - b);
  if (v.length < 3) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}
/** The dials: live draw as a needle, today's cost as a fuel gauge, grid carbon as a lamp. Null where there's no data. */
export function instrumentsFor(x, now, usual){
  const ci = x.carbon ? x.carbon.filter(r => r.from <= now && now < r.to)[0] : null;
  const w = x.live && x.live.demand != null ? Math.max(0, x.live.demand) : null;
  return {
    draw: w == null ? null : { w, frac: clamp(Math.sqrt(w / 6000), 0, 1), tone: w < 400 ? 'good' : w < 2500 ? 'warn' : 'bad' },
    cost: x.cost == null ? null : { p: x.cost, usual, frac: usual ? clamp(x.cost / usual / 1.25, 0, 1) : null, mark: usual ? .8 : null,
                                    tone: usual && x.cost > usual ? 'bad' : 'good' },
    carbon: ci ? { v: ci.v, index: ci.index, tone: /low/.test(ci.index) ? 'good' : /high/.test(ci.index) ? 'bad' : 'warn' } : null
  };
}
