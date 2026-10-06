/*
 * Maps and distance: where stations are (public/stations.json), where a train is between them from its live times,
 * how long a walk is, and a map drawn from Esri's dark grey tiles (the rain radar's) with our own lines and labels on top.
 * Plain enough for TV browsers (Chromium 63): no optional chaining or nullish defaults.
 */
import { HOME, hhmm } from './format.js';
import { ApiError, request } from './net.js';
import { baseTile, BASE_CREDIT } from './outdoors.js';
import { HUXLEY, atClock, boardTime, catchable, commuteTrain } from './household.js';

/* ---------- distance ---------- */
/** Great-circle distance in kilometres between two { lat, lon }. */
export function distKm(a, b){
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
/** Minutes to walk a straight-line distance: streets add about a third, at 4.8 km/h. At least a minute. */
export const walkMins = km => Math.max(1, Math.round(km * 1.3 / 4.8 * 60));
export const MILES = 0.621371;

/* ---------- stations (davwheat/uk-railway-stations, from Trainline EU's; Open Database License) ---------- */
/** The stations file, { s: [[crs, name, lat, lon], …] }, as a lookup by code. */
export function stationIndex(j){
  const out = {};
  ((j && j.s) || []).forEach(r => { if (r && /^[A-Z]{3}$/.test(r[0]) && isFinite(r[2]) && isFinite(r[3])) out[r[0]] = { crs: r[0], name: String(r[1]), lat: +r[2], lon: +r[3] }; });
  return out;
}
let stationsP = null;
/** Loads the stations once a page (about 100 kB, kept by the service worker on the phone). */
export function loadStations(){
  if (!stationsP) stationsP = request('stations.json').then(stationIndex, e => { stationsP = null; throw e; });
  return stationsP;
}
/** The nearest stations to a point, nearest first, each with `km`: at most `n`, within `maxKm`. */
export function nearestStations(index, at, n, maxKm){
  const out = [];
  Object.keys(index || {}).forEach(k => { const s = index[k], km = distKm(at, s); if (km <= maxKm) out.push({ crs: s.crs, name: s.name, lat: s.lat, lon: s.lon, km: km }); });
  return out.sort((a, b) => a.km - b.km).slice(0, n);
}

/* ---------- a train between stations, from its live times ---------- */
const realTime = t => !!t && !/^0001-/.test(String(t));
/**
 * Where a service calls, in order, each { crs, name, sched, t, done, cancelled }: `t` is when it left (or reached)
 * there if it has, else when it's expected, else when it's booked; `done` once it has. From either board's service
 * details: the public board's calling points (before and after the station asked about), or the staff board's
 * locations (stations it runs through and junctions left out).
 */
export function parseService(j, now){
  const stops = [];
  if (!j) return stops;
  if (Array.isArray(j.locations)){
    j.locations.forEach(l => {
      if (!l || !l.crs || l.isPass || l.isOperational) return;
      const booked = realTime(l.std) ? l.std : realTime(l.sta) ? l.sta : null;
      if (!booked) return;
      const sched = boardTime(booked, now);
      const act = realTime(l.atd) ? l.atd : realTime(l.ata) ? l.ata : null, exp = realTime(l.etd) ? l.etd : realTime(l.eta) ? l.eta : null;
      stops.push({ crs: l.crs, name: l.locationName, sched: sched, t: boardTime(act || exp || booked, now, sched), done: !!act, cancelled: !!l.isCancelled });
    });
    return stops;
  }
  const add = (crs, name, st, at, et, cancelled) => {
    const sched = boardTime(st, now); if (!crs || sched == null) return;
    const a = String(at || '').trim(), e = String(et || '').trim();
    const done = a === 'On time' || /^\d\d:\d\d/.test(a);
    const t = done ? (a === 'On time' ? sched : boardTime(a, now, sched)) : /^\d\d:\d\d/.test(e) ? boardTime(e, now, sched) : sched;
    stops.push({ crs: crs, name: name, sched: sched, t: t, done: done, cancelled: !!cancelled || /cancel/i.test(a + e) });
  };
  const points = side => (side && side[0] && side[0].callingPoint) || [];
  points(j.previousCallingPoints).forEach(c => add(c.crs, c.locationName, c.st, c.at, c.et, c.isCancelled));
  add(j.crs, j.locationName, j.std || j.sta, j.atd || j.ata, j.etd || j.eta, j.isCancelled);
  points(j.subsequentCallingPoints).forEach(c => add(c.crs, c.locationName, c.st, c.at, c.et, c.isCancelled));
  return stops;
}
/** A service's details, by the id its departure board gave (`sid`, or the staff board's `rid`). */
export async function loadService(d){
  if (!d || !(d.sid || d.rid)) throw new ApiError('NOSERVICE');
  const urls = d.rid ? [HUXLEY + '/service/' + d.rid] : [HUXLEY + '/service/' + d.sid, 'https://national-rail-api.davwheat.dev/service/' + d.sid];
  let err = null;
  for (let i = 0; i < urls.length; i++){
    try { return await Promise.race([request(urls[i], { headers: { Accept: 'application/json' } }), new Promise((_, no) => setTimeout(() => no(new ApiError('NETWORK')), 10000))]); }
    catch(e){ err = e; }
  }
  throw err;
}
/**
 * Where the train is now, from its stops and the stations' places: at a station (`at`), or between two (`from`, `to`,
 * `frac` of the way by time), not yet left its first stop (`before`) or at its last (`end`). `late` in whole minutes
 * at the next stop (or the last, once there). Null without two stops on the map.
 */
export function trainAt(stops, now, index){
  const s = (stops || []).filter(x => !x.cancelled && index[x.crs]);
  if (s.length < 2) return null;
  let i = -1;
  for (let k = 0; k < s.length; k++) if (s[k].done) i = k;
  // a stop that doesn't report: the train is past it once a later one has, or once it's well past its time
  while (i + 1 < s.length - 1 && !s[i + 1].done && s[i + 1].t + 60e3 < now && s[i + 2] && s[i + 2].t > now) i++;
  const place = x => ({ lat: index[x.crs].lat, lon: index[x.crs].lon });
  const lateAt = x => Math.max(0, Math.round((x.t - x.sched) / 60e3));
  if (i < 0) return Object.assign(place(s[0]), { at: s[0], before: true, late: lateAt(s[0]), stops: s });
  if (i >= s.length - 1) return Object.assign(place(s[s.length - 1]), { at: s[s.length - 1], end: true, late: lateAt(s[s.length - 1]), stops: s });
  const a = s[i], b = s[i + 1], pa = place(a), pb = place(b);
  if (now - a.t < 30e3 && now >= a.t) return Object.assign(pa, { at: a, late: lateAt(b), stops: s });
  const span = Math.max(60e3, b.t - a.t), f = Math.max(0, Math.min(0.95, (now - a.t) / span));
  return { lat: pa.lat + (pb.lat - pa.lat) * f, lon: pa.lon + (pb.lon - pa.lon) * f, from: a, to: b, frac: f, late: lateAt(b), stops: s };
}
/** In words: "Between Heaton Chapel and Levenshulme, 2 min late", "At Stockport", "Not left Hazel Grove yet". */
export function trainText(p){
  if (!p) return '';
  const late = p.late >= 1 ? ', ' + p.late + ' min late' : ', on time';
  if (p.end) return 'Arrived at ' + p.at.name + (p.late >= 1 ? ', ' + p.late + ' min late' : '');
  if (p.before) return 'Not left ' + p.at.name + ' yet' + (p.late >= 1 ? ', expected ' + p.late + ' min late' : '');
  if (p.at) return 'At ' + p.at.name + late;
  return (p.frac < 0.25 ? 'Just left ' + p.from.name : p.frac > 0.75 ? 'Nearly at ' + p.to.name : 'Between ' + p.from.name + ' and ' + p.to.name) + late;
}
/** When the train is due at a station on its way ("Due at Stockport 18:01"), from its stops. */
export function dueAt(p, crs){
  const x = p && p.stops ? p.stops.filter(s => s.crs === crs)[0] : null;
  return x ? { t: x.t, done: x.done, text: (x.done ? 'At ' : 'Due at ') + x.name + ' ' + hhmm(x.t) } : null;
}

/** The train to show: once one has left with you on it, that one until it arrives; else the commute's, else the next. */
export function pickTrain(trains, followed, now){
  if (!trains || !trains.list || !trains.leg) return null;
  const f = followed, gone = f && (f.exp || f.sched) <= now;
  if (gone && f.leg === trains.leg.from + '>' + trains.leg.to && now < (f.arr || (f.exp || f.sched) + 3600e3) + 5 * 60e3) return f;
  const c = commuteTrain(trains, now);
  const d = c ? c.d : catchable(trains.list.filter(x => !x.cancelled), trains.leg.walk, now).list[0];
  return d ? Object.assign({}, d, { leg: trains.leg.from + '>' + trains.leg.to }) : null;
}


/* ---------- a map from tiles ---------- */
export const TILE = 256;
/** A point in world pixels at zoom z (Web Mercator, 256-pixel tiles). */
export function worldPx(lat, lon, z){
  const n = TILE * Math.pow(2, z), r = lat * Math.PI / 180;
  return { x: (lon + 180) / 360 * n, y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n };
}
/** The view that fits these points in a w×h box with a margin: the closest zoom from `min` to `max`, centred on them. */
export function fitView(points, w, h, pad, min, max){
  const pts = (points || []).filter(p => p && isFinite(p.lat) && isFinite(p.lon));
  if (!pts.length) pts.push(HOME);
  let z = max || 15, box = null;
  for (; z >= (min || 3); z--){
    const ps = pts.map(p => worldPx(p.lat, p.lon, z));
    box = { x0: Math.min.apply(null, ps.map(p => p.x)), x1: Math.max.apply(null, ps.map(p => p.x)), y0: Math.min.apply(null, ps.map(p => p.y)), y1: Math.max.apply(null, ps.map(p => p.y)) };
    if (box.x1 - box.x0 <= w - 2 * pad && box.y1 - box.y0 <= h - 2 * pad) break;
  }
  z = Math.max(z, min || 3);
  return { z: z, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, w: w, h: h };
}
/** Where a place falls in the view's box, in pixels. */
export function onView(v, p){ const q = worldPx(p.lat, p.lon, v.z); return { x: q.x - v.cx + v.w / 2, y: q.y - v.cy + v.h / 2 }; }
/** The tiles covering the view, each { z, x, y, left, top } in the box's pixels. */
export function viewTiles(v){
  const out = [], left = v.cx - v.w / 2, top = v.cy - v.h / 2;
  for (let ty = Math.floor(top / TILE); ty * TILE < top + v.h; ty++)
    for (let tx = Math.floor(left / TILE); tx * TILE < left + v.w; tx++) out.push({ z: v.z, x: tx, y: ty, left: Math.round(tx * TILE - left), top: Math.round(ty * TILE - top) });
  return out;
}
/** The dark map without labels (baseTile in outdoors.js); our labels go on top. */
export const mapTile = t => baseTile(t.z, t.x, t.y);
export const MAP_CREDIT = BASE_CREDIT;

/* ---------- the journey: what goes on the map ---------- */
/**
 * The map's places for a train: the stops from where the train is (or the station you board at, if it's further
 * back) to where you get off, with home at the end you live at. `on` is where you board, `off` where you get off.
 */
export function journeyMap(p, on, off, home){
  if (!p || !p.stops) return null;
  const s = p.stops, iOn = s.map(x => x.crs).indexOf(on), iOff = s.map(x => x.crs).indexOf(off);
  if (iOff < 0) return null;
  let iNow = p.from ? s.indexOf(p.from) : s.indexOf(p.at);
  if (iNow < 0) iNow = 0;
  const first = Math.min(iOn >= 0 ? iOn : iNow, iNow), stops = s.slice(first, iOff + 1);
  return { stops: stops, on: iOn >= 0 ? s[iOn] : null, off: s[iOff], home: home || null };
}

/* ---------- the weather where you'll be ---------- */
/** Open-Meteo's hourly temperature and chance of rain at a place, for today and tomorrow: [{ t, temp, rain }]. */
export async function loadPlaceWeather(p){
  const j = await request('https://api.open-meteo.com/v1/forecast?latitude=' + p.lat.toFixed(3) + '&longitude=' + p.lon.toFixed(3) + '&hourly=temperature_2m,precipitation_probability&forecast_days=2&timezone=Europe%2FLondon');
  const h = (j && j.hourly) || {}, t = h.time || [];
  return t.map((x, i) => ({ t: +new Date(x), temp: h.temperature_2m ? h.temperature_2m[i] : null, rain: h.precipitation_probability ? h.precipitation_probability[i] : null })).filter(x => isFinite(x.t));
}
/** The weather at a time, in words: "In town at 17:30: 12°, rain likely (70%)". Null without an hour for it. */
export function weatherThen(hours, t, where){
  const h = (hours || []).filter(x => x.t <= t && t < x.t + 3600e3)[0];
  if (!h || h.temp == null) return null;
  const r = h.rain == null ? '' : h.rain >= 60 ? ', rain likely (' + h.rain + '%)' : h.rain >= 30 ? ', might rain (' + h.rain + '%)' : ', dry';
  return { rain: h.rain || 0, text: (where ? where + ' at ' : 'At ') + hhmm(t) + ': ' + Math.round(h.temp) + '°' + r };
}

/**
 * Everything the journey map and its words need, the same on the phone and the TV: the stations from where the
 * train is to where you get off (`route`), home and the walk to or from its station (`walks`), what to fit in view,
 * where you get on (`board`) and off (`off`, with `there`: "at work by 08:51" or "home by 18:24").
 */
export function journeyView(pos, leg, index, home){
  if (!leg || !index) return null;
  const at = c => index[c] ? { lat: index[c].lat, lon: index[c].lon } : null;
  const map = pos ? journeyMap(pos, leg.from, leg.to || (pos.stops[pos.stops.length - 1] || {}).crs, home) : null;
  const onCrs = leg.from, offCrs = leg.to || (map ? map.off.crs : '');
  const stops = map ? map.stops : index[onCrs] && index[offCrs] ? [index[onCrs], index[offCrs]] : [];
  const homeEnd = leg.home ? offCrs : onCrs;
  const places = [];
  stops.forEach(s => {
    const p = at(s.crs); if (!p) return;
    const ends = s.crs === onCrs || s.crs === offCrs, next = pos && pos.to && pos.to.crs === s.crs && stops.length > 2;
    places.push({ lat: p.lat, lon: p.lon, kind: 'station', major: ends, label: ends || next ? (index[s.crs] || s).name : '', right: s.crs === homeEnd ? true : undefined });   // home's label is on the left
  });
  if (home) places.push({ lat: home.lat, lon: home.lon, kind: 'home', label: 'Home', right: false });   // labelled to the left: home is a walk from the station
  if (pos && !pos.end) places.push({ lat: pos.lat, lon: pos.lon, kind: 'train' });
  const off = pos && offCrs ? dueAt(pos, offCrs) : null, board = pos ? pos.stops.filter(s => s.crs === onCrs)[0] || null : null;
  return { places: places, route: stops.map(s => at(s.crs)).filter(Boolean), walks: home && at(homeEnd) ? [[home, at(homeEnd)]] : [],
    fit: [at(onCrs), at(offCrs), home, pos && !pos.end ? pos : null].filter(Boolean), board: board, off: off,
    there: off && (leg.work || leg.home) ? (leg.home ? 'home by ' : 'at work by ') + hhmm(off.t + (leg.after || 0) * 60e3) : '',
    title: leg.work ? 'Your way in' : leg.home ? 'Your way home' : 'Your next train' };
}
/** The lines under the map: where you get on and off, and when you're there. */
export function journeyLines(j, pos){
  if (!j) return [];
  const out = [];
  if (j.board && !j.board.done) out.push('Leaves ' + j.board.name + ' ' + hhmm(j.board.t) + (j.off ? ' · ' + j.off.text.replace(/^Due at /, '') : '') + (j.there ? ' · ' + j.there : ''));
  else if (j.off) out.push(j.off.text + (j.there ? ' · ' + j.there : ''));
  return out;
}

/* ---------- where the phone is ---------- */
/** Is a position at a place: within 250 m, or the position's accuracy up to 500 m? */
export const atPlace = (here, place) => !!(here && place && distKm(here, place) * 1000 <= Math.max(250, Math.min(500, +here.acc || 0)));
/**
 * The commute's walk to the train from where the phone is, when it's fresh (five minutes) and within 3 km of the
 * station you board at: further than that, you're not walking. `walkHere` marks it.
 */
export function legFromHere(leg, here, index, now){
  if (!leg || !here || !index || !index[leg.from] || now - here.at > 5 * 60e3) return leg;
  const km = distKm(here, index[leg.from]);
  return km > 3 ? leg : Object.assign({}, leg, { walk: walkMins(km), walkHere: true });
}

/* ---------- the way home, told to the TV ---------- */
const ID_RE = /^[\w=-]{4,40}$/, CRS_RE = /^[A-Z]{3}$/;
/**
 * A trip home as the phone tells the TV (sealed): who, the train they're on (its id, time and destination), where
 * they get on and off, the walk after, when it gets in, and where the phone is if it knows. Null if it's not well
 * formed, or over: three hours on, or a quarter of an hour after they'd be home.
 */
export function readTrip(t, now){
  if (!t || typeof t !== 'object' || !CRS_RE.test(t.from) || !CRS_RE.test(t.to) || !(+t.sched > 0) || !(+t.at > 0)) return null;
  if (!(t.sid && ID_RE.test(t.sid)) && !(t.rid && /^\d{6,20}$/.test(t.rid))) return null;
  const out = { name: String(t.name || '').slice(0, 40), sid: t.sid && ID_RE.test(t.sid) ? t.sid : null, rid: t.rid && /^\d{6,20}$/.test(t.rid) ? t.rid : null,
    sched: +t.sched, dest: String(t.dest || '').slice(0, 80), from: t.from, to: t.to, walk: Math.max(0, Math.min(90, Math.round(+t.walk || 0))), arr: +t.arr || 0, at: +t.at };
  const h = t.here;
  if (h && isFinite(h.lat) && isFinite(h.lon) && Math.abs(h.lat) <= 90 && Math.abs(h.lon) <= 180) out.here = { lat: +h.lat, lon: +h.lon, at: +h.at || out.at };
  const home = out.arr ? out.arr + out.walk * 60e3 : 0;
  if (now - out.at > 3 * 3600e3 || (home && now > home + 15 * 60e3)) return null;
  return out;
}
/** When they'll be home: the train's arrival where they get off (live, or as the phone last said), then the walk. */
export function tripHome(trip, pos){
  const off = pos ? dueAt(pos, trip.to) : null, t = off ? off.t : trip.arr;
  return t ? t + trip.walk * 60e3 : 0;
}
/** The heads-up: "Kyle's on the way home", "On the 17:50 · between Levenshulme and Heaton Chapel · home about 18:05". */
export function tripHead(trip, pos){
  const home = tripHome(trip, pos), where = pos ? trainText(pos).replace(/^./, c => c.toLowerCase()) : '';
  return { kind: 'train', tone: 'good', title: trip.name ? trip.name + '\u2019s on the way home' : 'On the way home',
    sub: 'On the ' + hhmm(trip.sched) + (where ? ' · ' + where : '') + (home ? ' · home about ' + hhmm(home) : '') };
}

/* ---------- getting home from anywhere ---------- */
/**
 * The ways home from where you are: the nearest stations within 15 km (up to four), each with the walk there, the
 * first train you can make from it that calls at your station, and when you'd be home with your walk at that end.
 * `load(from, to)` gives a departure board (loadTrainsLive). Best first. Near your own station, just the walk.
 */
export async function waysHome(here, index, homeCrs, homeWalk, now, load){
  const near = nearestStations(index, here, 4, 15), home = index[homeCrs];
  if (home && distKm(here, home) <= 2) return { near: true, walk: walkMins(distKm(here, home)), station: home, ways: [] };
  const ways = await Promise.all(near.filter(s => s.crs !== homeCrs).map(s => load(s.crs, homeCrs).then(b => {
    const walk = walkMins(s.km), d = catchable(((b && b.list) || []).filter(x => !x.cancelled && x.arr), walk, now).list[0];
    return d ? { station: s, walk: walk, train: d, home: d.arr + (homeWalk || 0) * 60e3 } : { station: s, walk: walk, train: null, home: 0 };
  }, () => ({ station: s, walk: walkMins(s.km), train: null, home: 0, err: true }))));
  return { near: false, ways: ways.filter(w => w.train).sort((a, b) => a.home - b.home).concat(ways.filter(w => !w.train)) };
}

/* ---------- the commute in numbers ---------- */
/** The log of office days ('YYYY-MM-DD', kept on the phone), with today added once it's an office day (officeDay) and your day has started. */
export function logDay(log, day, now){
  const l = (log || []).filter(k => /^\d{4}-\d\d-\d\d$/.test(k));
  return day && day.in && now >= atClock(now, day.start) && l.indexOf(day.key) < 0 ? l.concat([day.key]).sort() : l;
}
/**
 * Your commute in numbers, for the days in the log since `since` (estimates): by train there and back (the line's
 * length, about a tenth longer than as the crow flies), walking (both walks, both ways), steps (about 110 a minute),
 * and the CO₂ next to driving it (a road about a third longer; an average car 170 g/km, rail 35 g/km per passenger).
 */
export function commuteStats(log, s, index, since){
  const days = (log || []).filter(k => k >= since), a = index && index[s.trainFrom], b = index && index[s.trainTo];
  if (!a || !b) return null;
  const crow = distKm(a, b), rail = crow * 1.1 * 2 * days.length, road = crow * 1.3 * 2 * days.length;
  const walk = ((+s.trainWalk || 0) + (+s.workWalk || 0)) * 2 * days.length;
  return { days: days.length, first: days[0] || '', railKm: rail, railMiles: rail * MILES, walkMins: walk, steps: Math.round(walk * 110 / 100) * 100,
    co2Kg: Math.max(0, road * 0.17 - rail * 0.035) };
}
