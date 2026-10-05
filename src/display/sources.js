/* ===================== display sources: household data, pure parsing, example data ===================== */
// Written for older TV browsers too: no ?. or ?? here (see docs/STACK.md, "Smart TV notes").

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDay = d => `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
const minsBetween = (a, b) => Math.round((b - a) / 60e3);
function relDay(t, now){
  const d = Math.round((+startOfDay(new Date(t)) - +startOfDay(new Date(now))) / 864e5);
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 && d < 7 ? DAY_NAMES[new Date(t).getDay()] : shortDate(new Date(t));
}

/* ---------- display modes ---------- */
const MODES = [
  { id: 'energy', label: 'Energy', key: '1' },
  { id: 'home', label: 'Home', key: '2' },
  { id: 'travel', label: 'Travel', key: '3' },
  { id: 'screensaver', label: 'Screensaver', key: '4' },
  { id: 'night', label: 'Night', key: '5' }
];
const ROTATING = ['energy', 'home', 'travel'];
const modeFromHash = (hash, fallback) => { const id = String(hash || '').replace(/^#/, '').toLowerCase(); return MODES.some(m => m.id === id) ? id : fallback; };
function stepMode(id, dir){ const i = MODES.findIndex(m => m.id === id); return MODES[(Math.max(0, i) + dir + MODES.length) % MODES.length].id; }
/** Is the clock time inside a window like 23:00–06:30? Windows may cross midnight. */
function inWindow(now, from, to){
  const m = t => { const p = String(t || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
  const d = new Date(now), x = d.getHours()*60 + d.getMinutes(), a = m(from), b = m(to);
  if (a === b) return false;
  return a < b ? x >= a && x < b : x >= a || x < b;
}

const DISPLAY_DEFAULTS = {
  mode: 'energy', rotate: 0, saver: 15, night: true, nightFrom: '23:00', nightTo: '06:30', reloadAt: '03:30',
  bins: [], ical: '',
  trainFrom: 'SPT', trainTo: '', trainWalk: 15, tramStop: '', tramWalk: 15
};
function displaySettings(saved){
  const s = Object.assign({}, DISPLAY_DEFAULTS, saved || {});
  s.bins = Array.isArray(s.bins) ? s.bins.filter(b => b && b.name && /^\d{4}-\d\d-\d\d$/.test(b.date)) : [];
  return s;
}

/* ---------- bins ---------- */
const BIN_COLOURS = { black:'#2a2d3a', blue:'#2f7bff', brown:'#8a5a32', green:'#2fb36b', grey:'#8a90a8', purple:'#8f6bff', red:'#e5484d', yellow:'#ffd166' };
/** Next collection of each bin, from one known collection date and a repeat in weeks. Bank holiday changes aren't known. */
function nextCollections(bins, now = Date.now()){
  const today = +startOfDay(new Date(now));
  return bins.map(b => {
    const every = Math.max(1, Math.round(+b.every || 1)) * 7;
    let d = keyDate(b.date);
    const gap = Math.round((today - +d) / 864e5);
    if (gap > 0) d = addDays(d, Math.ceil(gap / every) * every);
    return { name: b.name, colour: b.colour || 'grey', date: d, days: Math.round((+d - today) / 864e5) };
  }).sort((a, b) => a.date - b.date || a.name.localeCompare(b.name));
}
function exampleBins(now = Date.now()){
  const t = startOfDay(new Date(now)), toThu = (4 - t.getDay() + 7) % 7;
  const thu = addDays(t, toThu);
  return [{ name: 'General waste', colour: 'black', date: dayKey(thu), every: 2 },
          { name: 'Paper and card', colour: 'blue', date: dayKey(addDays(thu, 7)), every: 2 },
          { name: 'Garden waste', colour: 'brown', date: dayKey(addDays(thu, 7)), every: 2 }];
}

/* ---------- weather (Open-Meteo, no key, allows browser calls) ---------- */
const WMO = [
  [[0], 'Clear', '☀'], [[1], 'Mostly clear', '☀'], [[2], 'Partly cloudy', '⛅'], [[3], 'Overcast', '☁'],
  [[45, 48], 'Fog', '▒'], [[51, 53, 55, 56, 57], 'Drizzle', '☂'], [[61, 63, 65, 66, 67], 'Rain', '☂'],
  [[71, 73, 75, 77], 'Snow', '❄'], [[80, 81, 82], 'Showers', '☂'], [[85, 86], 'Snow showers', '❄'], [[95, 96, 99], 'Thunder', '⚡']
];
function weatherText(code){ const w = WMO.find(x => x[0].indexOf(+code) >= 0); return w ? { text: w[1], icon: w[2] } : { text: '—', icon: '·' }; }
const METEO_Q = `latitude=${HOME.lat}&longitude=${HOME.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=Europe%2FLondon&wind_speed_unit=mph`;
function parseWeather(j, now = Date.now()){
  const c = j.current || {}, h = j.hourly || {}, d = j.daily || {};
  const hours = [];
  (h.time || []).forEach((k, i) => {
    const t = +new Date(k);
    if (t >= now - 3600e3 + 1 && hours.length < 12) hours.push({ t, temp: h.temperature_2m[i], rain: h.precipitation_probability ? h.precipitation_probability[i] : null, code: h.weather_code[i] });
  });
  const days = (d.time || []).map((k, i) => ({ k, rise: +new Date(d.sunrise[i]), set: +new Date(d.sunset[i]), max: d.temperature_2m_max[i], min: d.temperature_2m_min[i] }));
  return { now: { temp: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, wind: c.wind_speed_10m }, hours, days };
}
async function loadDisplayWeather(){
  try { return parseWeather(await request(`https://api.open-meteo.com/v1/forecast?${METEO_Q}`)); }
  catch(e){ if (e.code === 'NETWORK' && NET.proxy) return parseWeather(await request(`./proxy/meteo/v1/forecast?${METEO_Q}`)); throw e; }
}

/* ---------- calendar (iCal) ---------- */
function icalLines(text){
  const out = [];
  for (const raw of String(text).split(/\r?\n/)){
    if (/^[ \t]/.test(raw) && out.length) out[out.length - 1] += raw.slice(1); else if (raw) out.push(raw);
  }
  return out.map(l => {
    const c = l.indexOf(':'); const head = c < 0 ? l : l.slice(0, c), value = c < 0 ? '' : l.slice(c + 1);
    const parts = head.split(';'), params = {};
    parts.slice(1).forEach(p => { const e = p.indexOf('='); if (e > 0) params[p.slice(0, e).toUpperCase()] = p.slice(e + 1).replace(/^"|"$/g, ''); });
    return { name: parts[0].toUpperCase(), params, value };
  });
}
const icalText = v => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
/** Wall-clock time in an IANA zone to epoch ms. Falls back to the device's own zone. */
function zonedTime(y, mo, d, h, mi, s, tz){
  const guess = Date.UTC(y, mo, d, h, mi, s);
  if (!tz) return +new Date(y, mo, d, h, mi, s);
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const off = t => { const p = {}; f.formatToParts(new Date(t)).forEach(x => { p[x.type] = +x.value; }); return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - t; };
    let t = guess - off(guess); t = guess - off(t);
    return t;
  } catch(e){ return +new Date(y, mo, d, h, mi, s); }
}
function icalDate(prop){
  if (!prop) return null;
  const v = prop.value.trim(), m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z)?)?$/.exec(v);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  if (!m[4]) return { t: +new Date(y, mo, d), allDay: true };
  if (m[7]) return { t: Date.UTC(y, mo, d, +m[4], +m[5], +m[6]), allDay: false };
  return { t: zonedTime(y, mo, d, +m[4], +m[5], +m[6], prop.params.TZID), allDay: false };
}
function icalDuration(v){
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (((+m[2] || 0)*7 + (+m[3] || 0))*864e5 + (+m[4] || 0)*3600e3 + (+m[5] || 0)*60e3 + (+m[6] || 0)*1e3);
}
function parseICal(text){
  const events = []; let ev = null;
  for (const l of icalLines(text)){
    if (l.name === 'BEGIN' && l.value === 'VEVENT'){ ev = { props: {}, exdates: [] }; continue; }
    if (l.name === 'END' && l.value === 'VEVENT'){ if (ev) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    if (l.name === 'EXDATE') l.value.split(',').forEach(v => { const x = icalDate({ value: v, params: l.params }); if (x) ev.exdates.push(x.t); });
    else if (!ev.props[l.name]) ev.props[l.name] = l;
  }
  return events.map(e => {
    const p = e.props, start = icalDate(p.DTSTART);
    if (!start || (p.STATUS && p.STATUS.value === 'CANCELLED')) return null;
    const end = icalDate(p.DTEND);
    const dur = end ? end.t - start.t : p.DURATION ? icalDuration(p.DURATION.value) : start.allDay ? 864e5 : 0;
    const rec = icalDate(p['RECURRENCE-ID']);
    return { uid: p.UID ? p.UID.value : '', title: p.SUMMARY ? icalText(p.SUMMARY.value) : 'Busy', where: p.LOCATION ? icalText(p.LOCATION.value) : '',
             start: start.t, allDay: start.allDay, dur, rrule: p.RRULE ? p.RRULE.value : null, exdates: e.exdates, recurrenceId: rec ? rec.t : null };
  }).filter(Boolean);
}
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/** Start times of a recurring event, in the device's local wall time. Covers the common RRULE forms. */
function expandRule(ev, from, to, cap = 20000){
  const r = {};
  ev.rrule.split(';').forEach(p => { const e = p.indexOf('='); if (e > 0) r[p.slice(0, e).toUpperCase()] = p.slice(e + 1); });
  const freq = r.FREQ, step = Math.max(1, +r.INTERVAL || 1), count = r.COUNT ? +r.COUNT : Infinity;
  const until = r.UNTIL ? icalDate({ value: r.UNTIL, params: {} }).t : Infinity;
  const s0 = new Date(ev.start), out = [], skip = new Set(ev.exdates);
  const byday = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : 0, wd: WD[m[2]] } : null; }).filter(Boolean) : [];
  const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [];
  const at = (y, mo, d) => new Date(y, mo, d, s0.getHours(), s0.getMinutes(), s0.getSeconds());
  let n = 0, guard = 0;
  const take = d => {
    const t = +d;
    if (t < ev.start || t > until || n >= count) return t <= until && n < count;
    n++;
    if (t + ev.dur > from && t < to && !skip.has(t)) out.push(t);
    return true;
  };
  const nthWeekday = (y, mo, wd, nth) => {
    const days = [];
    for (let d = 1; d <= new Date(y, mo + 1, 0).getDate(); d++) if (new Date(y, mo, d).getDay() === wd) days.push(d);
    return nth > 0 ? days[nth - 1] : days[days.length + nth];
  };
  for (let k = 0; guard++ < cap; k += step){
    let cands = [];
    if (freq === 'DAILY') cands = [at(s0.getFullYear(), s0.getMonth(), s0.getDate() + k)];
    else if (freq === 'WEEKLY'){
      const wk = at(s0.getFullYear(), s0.getMonth(), s0.getDate() - s0.getDay() + 7*k);
      cands = (byday.length ? byday.map(b => b.wd) : [s0.getDay()]).slice().sort((a, b) => a - b).map(wd => at(wk.getFullYear(), wk.getMonth(), wk.getDate() + wd));
    } else if (freq === 'MONTHLY'){
      const y = s0.getFullYear(), mo = s0.getMonth() + k;
      if (byday.length) cands = byday.map(b => { const d = nthWeekday(y, mo, b.wd, b.n || 1); return d ? at(y, mo, d) : null; });
      else cands = (bymd.length ? bymd : [s0.getDate()]).map(d => { const last = new Date(y, mo + 1, 0).getDate(), dd = d < 0 ? last + d + 1 : d; return dd >= 1 && dd <= last ? at(y, mo, dd) : null; });
      cands = cands.filter(Boolean).sort((a, b) => a - b);
    } else if (freq === 'YEARLY'){
      const d = at(s0.getFullYear() + k, s0.getMonth(), s0.getDate());
      cands = d.getDate() === s0.getDate() ? [d] : [];
    } else return [ev.start].filter(t => t + ev.dur > from && t < to);
    let more = true;
    for (const d of cands){ if (!take(d)){ more = false; break; } }
    if (!more || (cands.length && +cands[0] >= to)) break;
  }
  return out;
}
/** Events overlapping [from, to), recurring ones expanded, moved or cancelled instances applied. */
function calendarWindow(events, from, to){
  const moved = new Set(events.filter(e => e.recurrenceId != null).map(e => e.uid + '@' + e.recurrenceId));
  const out = [];
  for (const e of events){
    const starts = e.rrule && e.recurrenceId == null ? expandRule(e, from, to) : (e.start + e.dur > from && e.start < to ? [e.start] : []);
    for (const t of starts){
      if (e.rrule && e.recurrenceId == null && moved.has(e.uid + '@' + t)) continue;
      out.push({ title: e.title, where: e.where, start: t, end: t + e.dur, allDay: e.allDay });
    }
  }
  return out.sort((a, b) => a.start - b.start || (b.allDay - a.allDay));
}
/** Google's secret iCal address doesn't allow browser calls, so it goes through the home server helper when there is one. */
function calendarUrl(url){
  const u = String(url || '').trim().replace(/^webcal:/i, 'https:');
  const m = /^https:\/\/calendar\.google\.com(\/.*)$/i.exec(u);
  return NET.proxy && m ? './proxy/gcal' + m[1] : u;
}
async function loadCalendar(url, now = Date.now()){
  let res;
  try { res = await fetch(calendarUrl(url), { cache: 'no-store' }); }
  catch(e){ throw new ApiError(NET.proxy ? 'NETWORK' : 'NOPROXY'); }
  if (!res.ok) throw new ApiError(res.status === 404 || res.status === 403 ? 'CALFAIL' : 'HTTP', `The calendar returned an error (${res.status}).`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/.test(text)) throw new ApiError('CALFAIL');
  return calendarWindow(parseICal(text), +startOfDay(new Date(now)), +addDays(startOfDay(new Date(now)), 8));
}
function exampleCalendar(now = Date.now()){
  const t = startOfDay(new Date(now)), at = (d, h, m) => +addDays(t, d) + (h*60 + m)*60e3;
  return [
    { title: 'Bins out tonight', start: at(0, 19, 0), end: at(0, 19, 30), allDay: false },
    { title: 'Dentist', start: at(1, 10, 15), end: at(1, 11, 0), allDay: false },
    { title: 'Football practice', start: at(2, 17, 30), end: at(2, 19, 0), allDay: false },
    { title: 'Grandparents visiting', start: +addDays(t, 4), end: +addDays(t, 5), allDay: true }
  ].filter(e => e.end > now);
}

/* ---------- trains (Realtime Trains, through the home server helper, which holds the token) ---------- */
function parseTrains(j){
  const services = (j && j.services) || [];
  return services.map(s => {
    const td = s.temporalData || {}, dep = td.departure || {}, meta = s.scheduleMetadata || {}, loc = s.locationMetadata || {};
    const sched = dep.scheduleAdvertised || dep.scheduleInternal;
    if (!sched) return null;
    const exp = dep.realtimeActual || dep.realtimeForecast || dep.realtimeEstimate || null;
    const dest = (s.destination || []).map(x => x.location && x.location.description).filter(Boolean).join(' & ');
    const plat = loc.platform ? (loc.platform.actual || loc.platform.planned) : null;
    const cancelled = !!dep.isCancelled || td.displayAs === 'CANCELLED';
    return { sched: +new Date(sched), exp: exp ? +new Date(exp) : null, dest: dest || 'Unknown', platform: plat || null, cancelled,
             operator: meta.operator ? meta.operator.name : '', status: td.status || null, bus: meta.modeType && meta.modeType !== 'TRAIN' };
  }).filter(Boolean).sort((a, b) => (a.exp || a.sched) - (b.exp || b.sched));
}
const trainStation = j => (j && j.query && j.query.location && j.query.location.description) || null;
async function loadTrains(from, to){
  if (!NET.proxy) throw new ApiError('NOPROXY');
  if (NET.keys.rtt === false) throw new ApiError('NOKEY', 'Add a Realtime Trains token to the home server helper (see the README).');
  const q = `code=${encodeURIComponent(from)}${to ? '&filterTo=' + encodeURIComponent(to) : ''}&timeWindow=120`;
  const res = await fetch(`./proxy/rtt/gb-nr/location?${q}`, { headers: { Accept: 'application/json' } }).catch(() => { throw new ApiError('NETWORK'); });
  if (res.status === 204) return { station: null, list: [] };
  if (res.status === 503) throw new ApiError('NOKEY', 'Add a Realtime Trains token to the home server helper (see the README).');
  if (res.status === 401 || res.status === 403) throw new ApiError('AUTH', 'Realtime Trains refused the token on the home server helper.');
  if (!res.ok) throw new ApiError('HTTP', `Realtime Trains returned an error (${res.status}).`);
  const j = await res.json();
  return { station: trainStation(j), list: parseTrains(j) };
}

/* ---------- trams (TfGM Metrolink, through the home server helper, which holds the key) ---------- */
function parseTrams(j, stop, now = Date.now()){
  const want = String(stop || '').trim().toLowerCase(), out = [], msgs = new Set();
  for (const r of (j && j.value) || []){
    if (String(r.StationLocation || '').toLowerCase() !== want) continue;
    if (r.MessageBoard && !/^<no message>$/i.test(r.MessageBoard)) msgs.add(String(r.MessageBoard).trim());
    for (let i = 0; i < 4; i++){
      const dest = r['Dest' + i]; if (!dest || /^(terminates here|see tram front|not in service)$/i.test(dest)) continue;
      const wait = parseInt(r['Wait' + i], 10);
      if (!(wait >= 0)) continue;
      out.push({ dest, wait, at: now + wait*60e3, status: r['Status' + i] || '', carriages: r['Carriages' + i] || '', platform: r.Direction || '' });
    }
  }
  const seen = new Set();
  return { trams: out.sort((a, b) => a.wait - b.wait).filter(t => { const k = t.dest + t.wait + t.platform; if (seen.has(k)) return false; seen.add(k); return true; }), messages: [...msgs] };
}
async function loadTrams(stop){
  if (!NET.proxy) throw new ApiError('NOPROXY');
  if (NET.keys.tfgm === false) throw new ApiError('NOKEY', 'Add a TfGM API key to the home server helper (see the README).');
  const res = await fetch('./proxy/tfgm/odata/Metrolinks', { headers: { Accept: 'application/json' } }).catch(() => { throw new ApiError('NETWORK'); });
  if (res.status === 503) throw new ApiError('NOKEY', 'Add a TfGM API key to the home server helper (see the README).');
  if (res.status === 401 || res.status === 403) throw new ApiError('AUTH', 'TfGM refused the key on the home server helper.');
  if (!res.ok) throw new ApiError('HTTP', `TfGM returned an error (${res.status}).`);
  return parseTrams(await res.json(), stop);
}

/** "Leave by" for a departure: how many minutes until you need to set off, given the walk. */
function leaveBy(depart, walkMin, now = Date.now()){
  const m = Math.floor((depart - walkMin*60e3 - now) / 60e3);
  return { mins: m, text: m > 1 ? `Leave in ${m} min` : m >= 0 ? 'Leave now' : m >= -Math.max(2, walkMin/3) ? 'Run for it' : 'Too late', cls: m > 4 ? 'good' : m >= 0 ? 'warn' : 'bad' };
}
function exampleTrains(now = Date.now()){
  const base = Math.ceil(now / 300e3) * 300e3, rnd = mulberry32(Math.floor(now / 3600e3));
  const dests = ['Manchester Piccadilly', 'London Euston', 'Buxton', 'Hazel Grove', 'Sheffield', 'Manchester Airport'];
  return dests.map((dest, i) => {
    const sched = base + (6 + i*9) * 60e3, late = rnd() < 0.3 ? Math.round(rnd()*6) * 60e3 : 0;
    return { sched, exp: sched + late, dest, platform: String(1 + (i % 4)), cancelled: i === 4 && rnd() < 0.5, operator: '' };
  });
}
function exampleTrams(now = Date.now()){
  return { trams: [['Rochdale Town Centre', 3], ['Shaw and Crompton', 9], ['Rochdale Town Centre', 15], ['Shaw and Crompton', 21]].map(([dest, wait]) => ({ dest, wait, at: now + wait*60e3, status: wait < 4 ? 'Due' : '', carriages: 'Double', platform: 'Outgoing' })), messages: [] };
}

/* ---------- prices for the display ---------- */
/** Cost of the Home Mini's half hours today on your tariff, with the standing charge. */
function todayCost(rows, eSets, now = Date.now()){
  if (!rows || !rows.length || !eSets || !eSets.length) return null;
  let p = 0, ok = 0;
  for (const r of rows){ const rate = unitPriceAt(eSets, r.t); if (rate != null){ p += r.v * rate; ok++; } }
  if (!ok) return null;
  return p + nz(standingAt(eSets, now), 0);
}

/* ---------- unattended screens ---------- */
/** Next reload time: the set clock time tomorrow (or later today), plus a few minutes' jitter so screens don't all reload together. */
function nextReload(now, at, jitterMin){
  const p = String(at || '03:30').split(':'), d = new Date(now);
  d.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
  if (+d <= now + 60e3) d.setDate(d.getDate() + 1);
  return +d + Math.round(jitterMin || 0)*60e3;
}
/** Is a source's data too old to trust? Twice its refresh period, with a floor. */
const isStale = (src, every, now = Date.now()) => !src.at || now - src.at > Math.max(2*every, 5*60e3);
