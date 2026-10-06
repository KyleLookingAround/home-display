/* ===================== display: modes, remote control, scheduling, rendering ===================== */
// Written for older TV browsers too: no ?. or ?? here (see docs/STACK.md, "Smart TV notes").

const D = {
  household: null, preview: {},
  set: mergeSettings(null, store.getJ('display', null)),
  mode: 'today', override: null, resume: null, embed: false, remote: null, stopRemote: null, sentState: '',
  lastInput: Date.now(), lastPick: 0, chromeUntil: 0, rotateAt: 0, reloadAt: 0,
  deviceId: null, wake: null, ticks: 0
};
const shown = () => D.override || D.mode;
const region = () => { const r = store.get('region'); return REGIONS[r] ? r : 'G'; };

/* ---------- data sources: each refreshes on its own clock, backs off when it fails, and keeps its last good data ---------- */
const MIN = 60e3;
const SRC = {
  agile:   { label: 'Prices',  every: () => 15*MIN, need: () => true,
             run: () => { const t = startOfDay(new Date()); return loadAgile(region(), t, addDays(t, 2), 1).then(a => a.unit.filter(r => isFinite(r.to))); } },
  carbon:  { label: 'Grid',    every: () => 30*MIN, need: () => true, run: () => loadCarbonForecast(CI_REGION[region()]) },
  tariff:  { label: 'Tariff',  every: () => 6*60*MIN, need: () => !!NET.creds, run: () => loadTodayTariff(store.get('pay') || 'DIRECT_DEBIT') },
  // Octopus allows about 100 GraphQL calls an hour, shared with its app: at most ~37 an hour from here.
  live:    { label: 'Home Mini', every: () => SRC.live.data && SRC.live.data.none ? 6*60*MIN : shown() === 'night' ? 30*MIN : (shown() === 'energy' || shown() === 'screensaver') ? 2*MIN : 10*MIN, need: () => !!NET.creds, run: pollMini },
  weather: { label: 'Weather', every: () => 15*MIN, need: () => true, run: loadDisplayWeather },
  council: { label: 'Bins', every: () => 3*60*MIN, need: () => true, run: loadCouncilBins },
  // The real ISS: watched closely only while the window is showing, so it can be spotted when it's overhead.
  iss:     { label: 'ISS', every: () => shown() === 'screensaver' ? MIN : 10*MIN, need: () => true, run: loadISS },
  cal:     { label: 'Calendar', every: () => 15*MIN, need: () => !!D.set.ical, run: () => loadCalendar(D.set.ical) },
  // Huxley2 is a free community service: ask once a minute only while departures are on screen.
  // the commute turns round in the afternoon on a work day (commuteLeg): when it does, the trains are due at once
  trains:  { label: 'Trains',  every: () => legTurned() ? 0 : shown() === 'travel' ? MIN : shown() === 'screensaver' ? 3*MIN : 10*MIN, need: () => !!D.set.trainFrom, run: () => { const leg = legNow(); return loadTrainsLive(leg.from, leg.to).then(r => Object.assign(r, { leg: leg })); } },
  // your journey (src/lib/geo.js): the stations once a day, the train that matters every 45 seconds while it shows
  stations: { label: 'Stations', every: () => 24*60*MIN, need: () => !!D.set.trainFrom && /^https?:$/.test(location.protocol), run: loadStations },
  service: { label: 'Your train', every: () => journeyTurned() ? 0 : (shown() === 'travel' || (D.trip && shown() === 'today') ? 45e3 : 5*MIN), need: () => !!SRC.stations.data && !!journeyPick(Date.now()), run: loadJourney },
  town:    { label: 'Town weather', every: () => 30*MIN, need: () => !!townStation(), run: () => loadPlaceWeather(townStation()) },
  trams:   { label: 'Trams',   every: () => shown() === 'travel' ? MIN : 5*MIN, need: () => NET.proxy && !!D.set.tramStop, run: () => loadTrams(D.set.tramStop) },
  // The outdoors: rain every quarter hour, air and pollen, flood warnings, the grid's mix, and bank holidays for the bins.
  nowcast: { label: 'Rain',    every: () => shown() === 'night' ? 30*MIN : 10*MIN, need: () => true, run: loadNowcast },
  air:     { label: 'Air',     every: () => 60*MIN, need: () => true, run: loadAir },
  floods:  { label: 'Floods',  every: () => 15*MIN, need: () => true, run: loadFloods },
  grid:    { label: 'Grid mix', every: () => 30*MIN, need: () => true, run: () => loadGridMix(CI_REGION[region()]) },
  holidays: { label: 'Bank holidays', every: () => 24*60*MIN, need: () => true, run: loadBankHolidays },
  // Spotify (tvmusic.js): every few seconds while the Music view is up, less often while only a line or a cover shows it.
  music:   { label: 'Spotify', every: () => shown() === 'music' ? 3e3 : (shown() === 'today' || shown() === 'screensaver') ? 15e3 : (TM.sleepAt || TM.sleepSong) ? 15e3 : MIN, need: () => !!tmSp(), run: pollSpotify },
  shelf:   { label: 'Your albums', every: () => 6*60*MIN, need: () => !!tmSp(), run: tmShelf },
  // new releases from the artists the TV's listener follows and plays, for a heads-up on Today (src/lib/discover.js)
  releases: { label: 'New releases', every: () => 12*60*MIN, need: () => !!tmSp(), run: () => fetchReleases(tmSp(), Date.now(), 21) }
};
Object.keys(SRC).forEach(k => Object.assign(SRC[k], { data: null, at: 0, err: null, fails: 0, last: 0, busy: false }));

async function pollMini(){
  if (!D.deviceId){
    D.deviceId = store.get('mini.' + NET.creds.account) || await findHomeMini();
    if (!D.deviceId) return { none: true };
    store.set('mini.' + NET.creds.account, D.deviceId);
  }
  const prev = SRC.live.data, fresh = !prev || prev.none || !prev.todayAt || Date.now() - prev.todayAt > 10*MIN || dayKey(prev.todayAt) !== dayKey(Date.now());
  const r = await liveReading(D.deviceId, fresh);
  if (fresh) r.todayAt = Date.now(); else { r.today = prev.today; r.rows = prev.rows; r.todayAt = prev.todayAt; }
  return r;
}
// your office days as planned on your phone (sent sealed; cleanPlan), on top of your usual week
D.plan = cleanPlan(store.getJ('plan', {}), Date.now());
const legNow = () => commuteLeg(Object.assign({}, D.set, { plan: D.plan }), Date.now(), SRC.holidays.data);
function legTurned(){ const d = SRC.trains.data, l = legNow(); return !!d && !!d.leg && JSON.stringify(d.leg) !== JSON.stringify(l); }
/* ---------- your journey: the train that matters, followed once it has left, until it gets you there ---------- */
// someone on their way home, as their phone told this screen (sealed; readTrip): their train is followed instead
D.trip = readTrip(store.getJ('trip', null), Date.now());
function tripNow(now){ if (D.trip && !readTrip(D.trip, now)){ D.trip = null; store.del('trip'); } return D.trip; }
function journeyPick(now){
  const t = tripNow(now);
  D.jPick = t ? { sid: t.sid, rid: t.rid, sched: t.sched, dest: t.dest, leg: 'trip' } : pickTrain(SRC.trains.data, D.jPick && D.jPick.leg !== 'trip' ? D.jPick : null, now);
  return D.jPick;
}
function journeyTurned(){ const d = SRC.service.data, p = D.jPick; return !!p && (!d || (d.d.sid || d.d.rid) !== (p.sid || p.rid) || d.d.sched !== p.sched); }
function loadJourney(){ const d = journeyPick(Date.now()); return loadService(d).then(j => ({ d: d, stops: parseService(j, Date.now()) })); }
function townStation(){ const T = SRC.trains.data, leg = T && T.leg, idx = SRC.stations.data; const c = leg ? (leg.home ? leg.from : leg.work ? leg.to : '') : ''; return c && idx ? idx[c] : null; }
/** Beside the station sign when there are no trams: the map, where the train is, and when you're there. */
function renderJourney(now){
  const card = $('#tJourneyCard'), T = SRC.trains.data, S = SRC.service.data, idx = SRC.stations.data, trip = tripNow(now);
  const d = S && D.jPick && (S.d.sid || S.d.rid) === (D.jPick.sid || D.jPick.rid) ? S.d : null;
  const leg = trip ? { from: trip.from, to: trip.to, walk: 0, after: trip.walk, home: true } : T && T.leg;
  const on = !D.set.tramStop && !!(leg && idx && d);
  card.hidden = !on; $('#tTrains').parentNode.classList.toggle('solo', !D.set.tramStop && !on);
  if (!on) return;
  const pos = trainAt(S.stops, now, idx), j = journeyView(pos, leg, idx, HOME), box = $('#tJourney');
  const w = Math.max(400, Math.round(box.clientWidth || 800)), town = !trip && leg.end && (leg.work || now < leg.end) ? weatherThen(SRC.town.data, leg.end, 'In town') : null;
  if (trip){
    j.title = trip.name ? trip.name + '\u2019s way home' : 'On the way home';
    const home = tripHome(trip, pos); j.there = home ? 'home about ' + hhmm(home) : '';
    if (trip.here && now - trip.here.at < 10*MIN){ j.places.push({ lat: trip.here.lat, lon: trip.here.lon, kind: 'you' }); j.fit.push(trip.here); }
  }
  $('#tJourneyTitle').textContent = j.title + ' · ' + hhmm(d.sched) + ' to ' + d.dest;
  // the map is redrawn only when the train has moved a pixel or two, so the pulse runs on
  const key = [w, pos ? pos.lat.toFixed(4) + pos.lon.toFixed(4) : '', j.route.length, j.places.length].join('|');
  if (!box.querySelector('.jm')){ box.innerHTML = '<div class="jm"></div><p class="jnow"></p><div class="jl"></div>'; box.__key = ''; }
  if (box.__key !== key){ box.__key = key; box.querySelector('.jm').innerHTML = mapHtml(j, w, 470); }
  box.querySelector('.jnow').textContent = pos ? trainText(pos) : 'Finding where it is…';
  const lines = trip ? [(j.off ? j.off.text : 'On the ' + hhmm(trip.sched)) + (j.there ? ' · ' + j.there : '')] : journeyLines(j, pos);
  setHtml(box.querySelector('.jl'), lines.concat(town ? [town.text] : []).map(l => `<p class="jline">${esc(l)}</p>`).join(''));
}
function due(s, now){
  if (!s.need() || s.busy) return false;
  const wait = s.err ? Math.min(s.every(), 30e3 * Math.pow(2, Math.min(5, s.fails - 1))) : s.every();
  return now - s.last >= wait;
}
function runSource(key){
  const s = SRC[key];
  s.busy = true; s.last = Date.now();
  Promise.resolve().then(s.run).then(d => { s.data = d; s.at = Date.now(); s.err = null; s.fails = 0; },
    e => { s.err = e; s.fails++; if (e && e.code === 'AUTH' && key === 'live') D.deviceId = null; })
    .then(() => { s.busy = false; render(); });
}
function retryAll(){ Object.keys(SRC).forEach(k => { const s = SRC[k]; if (s.err || isStale(s, s.every())){ s.last = 0; s.fails = 0; } }); }

/* ---------- modes ---------- */
function setMode(id, opts){
  opts = opts || {};
  D.mode = id; D.override = null;
  if (!opts.keepHash){ D.preview = {}; try { history.replaceState(null, '', '#' + id); } catch(e){} }
  if (!opts.rotation) D.lastPick = Date.now();
  D.rotateAt = Date.now() + D.set.rotate * MIN;
  applyMode();
}
function setOverride(id){ if (D.override === id) return; D.override = id; applyMode(); }
function applyMode(){
  const m = shown();
  $$('.mode').forEach(s => { s.hidden = s.getAttribute('data-mode') !== m; });
  $$('#picker .btn').forEach(b => b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === D.mode)));
  document.body.classList.toggle('night', m === 'night');
  document.title = `${MODES.find(x => x.id === m).label} · Harold Street Display`;
  Object.keys(SRC).forEach(k => { const s = SRC[k]; if (s.at && !s.err && Date.now() - s.at > s.every()) s.last = 0; });
  if (m === 'screensaver') startSaver(); else stopSaver();
  render();
  tellRemote();
}
/** Once a second: night window, idle screensaver, rotation, the nightly fresh start, and any data that's due. */
function tick(){
  const now = Date.now(), set = D.set;
  const clock = hhmm(now);
  $$('[data-clock]').forEach(el => { if (el.textContent !== clock) el.textContent = clock; });
  tickSign(now);
  tmTick(now);
  const idle = D.embed ? 0 : now - D.lastInput;
  const night = !D.embed && set.night && inWindow(now, set.nightFrom, set.nightTo);
  if (night && idle > 2*MIN && D.mode !== 'night' && !open() && !(HQ.party && D.mode === 'music')) setOverride('night');
  else if (!night && D.override === 'night') setOverride(null);
  else if (!D.override && set.saver > 0 && idle > set.saver*MIN && D.mode !== 'screensaver' && D.mode !== 'night' && !open() && !(HQ.party && D.mode === 'music')) setOverride('screensaver');
  if (set.rotate > 0 && !D.override && ROTATING.indexOf(D.mode) >= 0 && now >= D.rotateAt && now - D.lastPick > 2*MIN && !open()){
    const i = ROTATING.indexOf(D.mode); setMode(ROTATING[(i + 1) % ROTATING.length], { rotation: true });
  }
  if (now >= D.reloadAt && !D.embed){
    if (navigator.onLine !== false && !open()){ store.set('display.reloaded', String(now)); location.reload(); return; }
    D.reloadAt = now + 5*MIN;
  }
  if (D.chromeUntil && now > D.chromeUntil && !open() && (!$('#bar').contains(document.activeElement) || idle > 30e3)) hideChrome();
  Object.keys(SRC).forEach(k => { if (due(SRC[k], now)) runSource(k); });
  if (++D.ticks % 30 === 0) render();
  else if (D.ticks % 5 === 0 && shown() === 'travel') renderJourney(now);   // the train moves between its live times
}

/** The station sign's clock, with seconds. */
function tickSign(now){
  const el = $('[data-clock-s]'); if (!el) return;
  const d = new Date(now), t = hhmm(now) + ':' + pad2(d.getSeconds());
  if (el.textContent !== t) el.textContent = t;
}
/** Only redraws when it changes, so animations inside run on. */
function setHtml(el, html){ if (el && el.__html !== html){ el.innerHTML = html; el.__html = html; } }

/** Bins set by hand (or in household.json), moved on by the council's latest dates when the weekly feed has them. */
const binsNow = now => mergeBins(D.set.bins, councilBins(SRC.council.data, now));
const collections = now => nextCollections(binsNow(now), now, SRC.holidays.data);

/* ---------- rendering ---------- */
function render(){
  const m = shown();
  if (m === 'today') renderToday();
  else if (m === 'energy') renderEnergy();
  else if (m === 'travel') renderTravel();
  else if (m === 'screensaver') renderSaver();
  else if (m === 'night') renderNight();
  else if (m === 'music') renderMusic();
}
function agileNow(now){ const a = SRC.agile.data; return a ? a.filter(r => r.from <= now && now < r.to)[0] || null : null; }
function foot(keys){
  const now = Date.now(), parts = [], offline = navigator.onLine === false;
  let latest = 0;
  keys.forEach(k => {
    const s = SRC[k]; if (!s.need()) return;
    if (s.at) latest = Math.max(latest, s.at);
    if (s.data && (s.err || isStale(s, s.every(), now))) parts.push(`<span class="warn">${s.label} last updated ${relDay(s.at, now) === 'Today' ? '' : relDay(s.at, now) + ' '}${hhmm(s.at)}</span>`);
    else if (!s.data && s.err) parts.push(`<span class="warn">${s.label}: ${esc(errorText(s.err)[0])}</span>`);
  });
  if (offline) parts.unshift('<span class="warn">Offline, will retry</span>');
  return parts.join('') + (latest ? `<span>Updated ${hhmm(latest)}</span>` : '');
}
/** The same answer the phone's Now page gives. */
function verdictHtml(now, big){
  const v = priceVerdict(SRC.agile.data, now);
  if (!v) return `<p class="big muted">${SRC.agile.err ? 'No prices' : 'Prices…'}</p><p class="line muted">${SRC.agile.err ? 'No signal from Octopus, trying again' : 'Waiting for Agile prices'}</p>`;
  return `<p class="big glow-${v.tone}">${esc(v.big)}</p><p class="line">${esc(v.line)}</p>${big ? '' : `<p class="note">Agile, region ${region()}</p>`}`;
}
function weatherHtml(now){
  const W = SRC.weather.data;
  if (!W) return `<p class="d">${SRC.weather.err ? 'No weather signal' : 'Checking the weather…'}</p>`;
  const wn = weatherText(W.now.code), today = W.days.filter(d => d.k === dayKey(now))[0] || W.days[0];
  return `<span class="i" aria-hidden="true">${wn.icon}</span><span class="t">${Math.round(W.now.temp)}°</span><p class="d">${esc(wn.text)}<br>${today ? `High ${Math.round(today.max)}° · low ${Math.round(today.min)}°` : `Feels ${Math.round(W.now.feels)}°`}</p>`;
}
/** What's live now: the Home Mini, today's cost, grid carbon and its mix, and the air. */
function nowStats(now){
  const L = SRC.live.data, T = SRC.tariff.data, out = [];
  if (!NET.creds) out.push(['Live draw', '<span class="muted small">Connect your account</span>']);
  else if (L && L.none) out.push(['Live draw', '<span class="muted small">No Home Mini</span>']);
  else out.push(['Drawing now', L && L.demand != null ? `<span class="elec">${Math.round(Math.max(0, L.demand)).toLocaleString('en-GB')} W</span>` : '—']);
  if (L && L.today != null){ const c = todayCost(L.rows, T && T.eSets, now); out.push(['Today so far', `${kwh(L.today)}${c != null ? ' · ' + gbp(c) : ''}`]); }
  const ci = SRC.carbon.data, cin = ci ? ci.filter(r => r.from <= now && now < r.to)[0] : null;
  if (cin) out.push([`Grid carbon, ${esc(cin.index)}`, `<span class="${/low/.test(cin.index) ? 'cheap' : /high/.test(cin.index) ? 'peak' : 'normal'}">${cin.v} g</span>`]);
  const A = SRC.air.data;
  if (A && A.aqi != null) out.push(['Air · UV today', `<span class="small">${aqiLabel(A.aqi)} · ${uvLabel(A.uvMax) || '—'}</span>`]);
  return out.map(r => `<div class="stat"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('') + mixHtml(SRC.grid.data);
}
function stripFor(el, o){ el.innerHTML = stripSvg(Object.assign({ width: el.clientWidth || 800, height: el.clientHeight || 200 }, o)); }
/** Rain bands for the strip: the quarter-hour forecast near now, the hourly chance after that. */
function rainBands(now, end){
  const out = [], add = (a, b) => { const l = out[out.length - 1]; if (l && a <= l.to + 1) l.to = Math.max(l.to, b); else out.push({ from: a, to: b }); };
  const nc = SRC.nowcast.data || [], ncEnd = nc.length ? nc[nc.length - 1].t + 15*MIN : now;
  nc.forEach(s => { if (s.mm >= 0.1 && s.t + 15*MIN > now) add(Math.max(now, s.t), s.t + 15*MIN); });
  const W = SRC.weather.data;
  (W ? W.hours : []).forEach(h => { if (h.t >= ncEnd && h.t < end && wetKind(h)) add(h.t, h.t + 60*MIN); });
  return out;
}

function renderToday(){
  const now = Date.now(), W = SRC.weather.data, s = D.set;
  const today = W ? W.days.filter(d => d.k === dayKey(now))[0] : null;
  const cds = countdowns({ dates: s.dates, holidays: SRC.holidays.data, events: SRC.cal.data }, now);
  $('#dDate').textContent = longDay(new Date(now)) + (cds.length ? ' · ' + countdownText(cds[0]) : today ? ` · sunset ${hhmm(today.set)}` : '');
  setHtml($('#dMusic'), tmTodayHtml());
  $('#dVerdict').innerHTML = verdictHtml(now);
  $('#dWx').innerHTML = weatherHtml(now);
  const bins = collections(now);
  const walk = trainWalkOf(SRC.trains.data, s);
  const trip = tripNow(now), tripPos = trip && SRC.service.data && SRC.stations.data && (SRC.service.data.d.sid || SRC.service.data.d.rid) === (trip.sid || trip.rid) ? trainAt(SRC.service.data.stops, now, SRC.stations.data) : null;
  $('#dHeads').innerHTML = headsHtml((trip ? [tripHead(trip, tripPos)] : []).concat(headsUp({ trains: SRC.trains.data, walk: walk, bins, weather: W, nowcast: SRC.nowcast.data, floods: SRC.floods.data, countdowns: cds, music: musicHeads(SRC.releases.data, null, now) }, now)).slice(0, 3));
  // the next twelve hours, as on the phone's Now page
  const v = voyageFor({ agile: SRC.agile.data, weather: W, events: SRC.cal.data, trains: SRC.trains.data, walk: walk }, now);
  const markers = v.waypoints.map(w => ({ t: w.t, kind: 'event', label: w.title })).concat(v.train ? [{ t: v.train.sched, kind: 'train', label: v.train.dest }] : []);
  $('#dCheap').textContent = v.dock ? `Cheapest ${hhmm(v.dock.from)}–${hhmm(v.dock.to)} · ${pence(v.dock.avg)}` : '';
  if (v.range) stripFor($('#dStrip'), { from: now - 30*MIN, to: v.to, rates: SRC.agile.data, cheap: v.dock, rain: rainBands(now, v.to), markers, now, aria: 'Agile prices for the next 12 hours' });
  else $('#dStrip').innerHTML = `<p class="empty">${SRC.agile.err ? 'No prices from Octopus yet, trying again' : 'Waiting for Agile prices'}</p>`;
  // trains
  const T = SRC.trains.data;
  $('#dTrainsH').textContent = trainsTitle(T, s);
  let tr = '';
  if (!s.trainFrom) tr = '<p class="empty">Choose a station on your phone: Settings, then Household.</p>';
  else if (T){
    const caught = catchable(T.list, walk, now), rows = caught.list.slice(0, 3);
    tr = rows.length ? `<ul class="rows">${rows.map(d => { const lv = leaveBy(d.exp || d.sched, walk, now), late = d.exp && d.exp - d.sched >= 60e3, a = arriveBy(d, T.leg);
      return `<li><span class="main"><b class="mono">${hhmm(d.sched)}</b> ${esc(d.dest)}<span class="sub">${d.cancelled ? 'Cancelled' : d.delayed ? 'Delayed' : late ? 'Expected ' + hhmm(d.exp) : 'On time'}${d.platform ? ' · platform ' + esc(d.platform) : ''}</span></span><span class="side ${d.cancelled ? 'muted' : lv.cls}">${d.cancelled ? '—' : lv.text}${a && (T.leg.work || T.leg.home) ? `<span class="sub${a.late ? ' late' : ''}">${esc(a.text)}</span>` : ''}</span></li>`; }).join('')}</ul>` : `<p class="empty">${caught.missed ? `None you can make with a ${walk} minute walk in the next hour or so.` : 'No trains in the next couple of hours.'}</p>`;
  } else tr = `<p class="empty">${SRC.trains.err ? 'No departures signal, trying again' : 'Checking departures…'}</p>`;
  $('#dTrains').innerHTML = tr;
  // today and tomorrow: bins, then the calendar
  const rows = [], hour = new Date(now).getHours();
  const days = []; bins.forEach(b => { const l = days[days.length - 1]; if (l && +l.date === +b.date) l.bins.push(b); else days.push({ date: b.date, days: b.days, bins: [b] }); });
  days.slice(0, 2).forEach(d => rows.push(`<li><span class="main"><span class="dots lead">${d.bins.map(b => `<i style="background:${BIN_COLOURS[b.colour] || BIN_COLOURS.grey}"></i>`).join('')}</span>${esc(d.bins.map(b => b.name).join(', '))}</span><span class="side ${d.days <= 1 ? 'warn' : ''}">${d.days === 0 ? 'Today' : d.days === 1 ? (hour >= 12 ? 'Out tonight' : 'Tomorrow') : relDay(+d.date, now)}${d.bins[0].moved ? '*' : ''}</span></li>`));
  const evs = SRC.cal.data ? SRC.cal.data.filter(e => e.end > now && e.start < +addDays(startOfDay(new Date(now)), 2)) : [];
  evs.slice(0, 5 - rows.length).forEach(e => rows.push(`<li><span class="main">${esc(e.title)}${e.where ? `<span class="sub">${esc(e.where)}</span>` : ''}</span><span class="side">${relDay(e.start, now) === 'Today' ? '' : 'Tmrw '}${e.allDay ? 'All day' : hhmm(Math.max(e.start, now))}</span></li>`));
  const moved = days.slice(0, 2).filter(d => d.bins[0].moved)[0];
  $('#dDay').innerHTML = rows.length ? `<ul class="rows">${rows.join('')}</ul>` + (moved ? `<p class="note">* A day later for ${esc(moved.bins[0].moved)}, probably.</p>` : !s.ical ? '<p class="note">Add your calendar on your phone to see what\'s on.</p>' : '') : '<p class="empty">Nothing on today or tomorrow.</p>';
  $('#dNow').innerHTML = nowStats(now);
  $('#dFoot').innerHTML = `<span>Harold Street · region ${region()}</span>` + foot(['agile', 'weather', 'trains', 'cal']);
}

function renderEnergy(){
  const now = Date.now(), cur = agileNow(now), a = SRC.agile.data;
  $('#eVerdict').innerHTML = verdictHtml(now, true);
  const el = $('#ePrice');
  if (cur){ el.textContent = pence(cur.p); el.className = 'price ' + priceTone(cur.p); }
  else { el.textContent = '--'; el.className = 'price muted'; }
  const best = a ? cheapestWindow(a, 4, now) : null, ci = SRC.carbon.data;
  const green = ci ? cheapestWindow(ci.map(r => ({ from: r.from, to: r.to, p: r.v })), 4, now) : null;
  const when = t => (dayKey(t) === dayKey(now) ? '' : DOW[new Date(t).getDay()] + ' ') + hhmm(t);
  $('#eNext').textContent = best ? `Cheapest two hours ${when(best.from)}–${hhmm(best.to)}, ${pence(best.avg)}` : '';
  const end = a && a.length ? Math.max.apply(null, a.map(r => r.to)) : +addDays(startOfDay(new Date(now)), 1);
  $('#eWhen').textContent = green ? `Greenest ${when(green.from)}–${hhmm(green.to)}` : '';
  if (a && a.length) stripFor($('#eStrip'), { from: +startOfDay(new Date(now)), to: end, rates: a, cheap: best, now, aria: 'Agile prices today and tomorrow' });
  else $('#eStrip').innerHTML = '<p class="empty">Waiting for Agile prices.</p>';
  // the washing machine, dishwasher and tumble dryer: now, or the cheapest start
  const lead = store.getJ('leadActs', ['wash', 'dish', 'dryer']), acts = store.getJ('acts', {}), fut = a ? a.filter(r => r.to > now) : [];
  $('#eRun').innerHTML = `<ul class="rows">${lead.map(id => ACTIVITIES.filter(x => x.id === id)[0]).filter(Boolean).map(x => {
    const k = +nz(acts[x.id], x.kwh), slots = Math.max(1, Math.round(nz(x.hours, .5) * 2));
    const nowC = fut.length >= slots ? k * fut.slice(0, slots).reduce((s2, r) => s2 + r.p, 0) / slots : null, b = fut.length ? cheapestWindow(fut, slots, now) : null;
    return `<li><span class="main">${esc(x.label)}<span class="sub">${nowC != null ? gbp(nowC) + ' if you start now' : 'Waiting for prices'}</span></span><span class="side">${b ? `<span class="cheap">${when(b.from)}</span> · ${gbp(k * b.avg)}` : '—'}</span></li>`;
  }).join('')}</ul>`;
  $('#eChips').innerHTML = nowStats(now);
  $('#eFoot').innerHTML = `<span>Region ${region()} · ${REGIONS[region()]}</span>` + foot(['agile', 'carbon', 'live', 'tariff']);
}

function renderTravel(){
  const now = Date.now(), s = D.set, T = SRC.trains;
  let html = '', list = null;
  if (!s.trainFrom) html = '<p class="empty">Choose a station on your phone: Settings, then Household.</p>';
  else if (T.data) list = T.data.list;
  else if (T.err) html = `<p class="empty">No departures signal: ${esc(errorText(T.err)[0])} Trying again shortly.</p>`;
  else html = '<p class="empty">Checking departures…</p>';
  $('#tTrainTitle').textContent = trainsTitle(T.data, s);
  const box = $('#tTrains');
  if (list){
    // the station's sign: the board, dimmed where it's too late to make it, and the platform sign for the next you can
    if (!$('#tBoard')) box.innerHTML = '<div class="dmx deps-sign" id="tBoard"></div><div class="dmx plat-sign" id="tPlat"></div><p class="note" id="tCommute"></p>';
    const sign = signHtml(T.data, trainWalkOf(T.data, s), now);
    setHtml($('#tBoard'), sign.board); setHtml($('#tPlat'), sign.platform);
    $('#tCommute').textContent = commuteLine(T.data, now);
    tickSign(now);
  } else box.innerHTML = html;
  // Trams only show once a stop is set: TfGM needs a server that holds the key.
  const M = SRC.trams, tramPanel = $('#tTrams').parentNode;
  tramPanel.hidden = !s.tramStop;
  box.parentNode.classList.toggle('solo', !s.tramStop);   // with no trams, the sign takes the width, unless the journey's there
  renderJourney(now);
  if (s.tramStop){
    let tr = null; html = '';
    if (!NET.proxy) html = '<p class="empty">Metrolink times need a small server that holds a TfGM key (see the README).</p>';
    else if (M.data) tr = M.data;
    else if (M.err) html = `<p class="empty">${esc(M.err.code === 'NOKEY' ? M.err.message : errorText(M.err).join(' '))}</p>`;
    else html = '<p class="empty">Checking trams…</p>';
    $('#tTramTitle').textContent = `Trams from ${s.tramStop}`;
    if (tr){
      const age = M.at ? Math.max(0, Math.floor((now - M.at) / MIN)) : 0;
      const rows = tr.trams.map(t => ({ dest: t.dest, wait: t.wait - age, carriages: t.carriages })).filter(t => t.wait >= 0).slice(0, 6);
      html = rows.length ? `<table class="deps"><thead><tr><th>Due</th><th>To</th><th class="opt">Tram</th><th class="lv">Go</th></tr></thead><tbody>${rows.map(t => {
        const lv = leaveBy(now + t.wait*MIN, s.tramWalk, now);
        return `<tr><td class="t">${t.wait === 0 ? 'Due' : t.wait + ' min'}</td><td class="dest">${esc(t.dest)}</td><td class="t opt">${esc(t.carriages || '')}</td><td class="lv ${lv.cls}">${lv.text}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="empty">No trams listed right now.</p>';
      if (tr.messages && tr.messages.length) html += `<p class="note">${esc(tr.messages[0])}</p>`;
    }
    $('#tTrams').innerHTML = html;
  }
  $('#tFoot').innerHTML = '<span>Live trains from National Rail</span>' + foot(['trains', 'trams']);
}

function renderNight(){
  const now = Date.now(), cur = agileNow(now), W = SRC.weather.data;
  const hu = headsUp({ bins: collections(now), nowcast: SRC.nowcast.data, floods: SRC.floods.data, countdowns: countdowns({ dates: D.set.dates, holidays: SRC.holidays.data }, now) }, now).filter(h => h.kind !== 'rain')[0];
  $('#nSub').textContent = [cur ? `Agile ${pence(cur.p)}` : '', W ? `${Math.round(W.now.temp)}°` : '', hu ? hu.title : ''].filter(Boolean).join(' · ');
}

/* ---------- screensaver: the view from the cockpit (cockpit.js draws it) ---------- */
const toneOf = p => p < 0 ? 'neg' : p < 15 ? 'good' : p < 25 ? 'warn' : 'bad';
function cockpitInfo(now){
  let ag = SRC.agile.data;
  const pp = parseFloat(D.preview.price);
  if (!isNaN(pp)){ const s0 = Math.floor(now / 1800e3) * 1800e3; ag = (ag || []).filter(r => r.to <= s0 || r.from > s0).concat([{ from: s0, to: s0 + 1800e3, p: pp }]).sort((x, y) => x.from - y.from); }
  const cur = ag ? ag.filter(r => r.from <= now && now < r.to)[0] : null;
  const ci = SRC.carbon.data ? SRC.carbon.data.filter(r => r.from <= now && now < r.to)[0] : null;
  const L = SRC.live.data && !SRC.live.data.none ? SRC.live.data : null, T = SRC.tariff.data, W = SRC.weather.data;
  const sky = skyFor(W, now, D.preview), known = !!W || !!D.preview.wx, bins = binsNow(now);
  // A preview can put the real ISS overhead: #screensaver&show=iss
  const issRaw = /iss/.test(String(D.preview.show || '')) ? { latitude: HOME.lat + 2, longitude: HOME.lon, altitude: 421, velocity: 27580 } : SRC.iss.data;
  const iss = issPass(issRaw, HOME);
  const x = { agile: ag, carbon: SRC.carbon.data, live: L, cost: L ? todayCost(L.rows, T && T.eSets, now) : null, weather: W, bins,
              events: SRC.cal.data, trains: SRC.trains.data, walk: trainWalkOf(SRC.trains.data, D.set), iss, sky, label: 'Harold Street · region ' + region() };
  const voyage = voyageFor(x, now), show = String(D.preview.show || ''), wet = D.preview.wx;
  // Previews: wet weather is a front we're in; show=front, mytrain and dock bring the rest into view, with real data only
  if (/^(rain|drizzle|snow|thunder)$/.test(wet || '')) voyage.fronts = [{ from: now - 3600e3, to: now + 2.5*3600e3, kind: wet === 'drizzle' ? 'rain' : wet }];
  if (/front/.test(show)) voyage.fronts.push({ from: now + 4*3600e3, to: now + 6.5*3600e3, kind: 'rain' });
  if (/mytrain/.test(show) && voyage.train) voyage.train.mine = true;
  if (/dock/.test(show) && voyage.dock) voyage.dock = { from: now - 15*60e3, to: now + 105*60e3, avg: voyage.dock.avg, now: true, mins: 0 };
  let usual = null;
  if (x.cost != null){ const h = recordCost(store.getJ('costs', {}), now, x.cost); store.setJ('costs', h); usual = usualCost(h, now); }
  const ahead = shownAhead(voyage);
  return {
    sky, engine: engineFor(cur ? cur.p : null, ci ? ci.index : null), world: Object.assign(worldFor(x, now), { iss }), preview: D.preview,
    voyage, instruments: instrumentsFor(x, now, usual), detail: D.preview.detail || D.set.detail,
    cards: buildBillboards(x, now).filter(c => ahead.indexOf(c.id) < 0).concat(musicCards(tmModel(), SRC.shelf.data && SRC.shelf.data.albums, now)),
    hud: { price: cur ? pence(cur.p) : '--', priceTone: cur ? toneOf(cur.p) : 'muted', temp: known ? Math.round(sky.temp) + '°' : '--', wx: known ? weatherText(sky.code).text : '', date: longDay(new Date(now)) }
  };
}
function renderSaver(){ Cockpit.update(cockpitInfo(Date.now())); }
function startSaver(){ renderSaver(); Cockpit.start(); }
function stopSaver(){ Cockpit.stop(); }

/* ---------- the phone as a remote (src/lib/remote.js) ---------- */
function startRemote(){
  if (D.embed || D.stopRemote) return;
  D.remote = cleanCode(store.get('remote')) || newRemoteCode();
  store.set('remote', D.remote);
  D.stopRemote = listenRemote(D.remote, r => {
    if (r.from !== 'phone') return;
    D.lastInput = Date.now();
    if (r.cmd === 'mode'){ setMode(r.mode); toast(`Showing ${MODES.filter(m => m.id === r.mode)[0].label}, from your phone`, 3000); }
    else if (r.cmd === 'wake'){ if (D.override){ D.override = null; applyMode(); } }
    else if (r.cmd === 'reload'){ location.reload(); return; }
    else if (r.cmd === 'account'){ takeDetails(r.box); return; }
    else if (r.cmd === 'wifi'){ if (D.override){ D.override = null; applyMode(); } showWifi(); }
    else if (r.cmd === 'sleep'){ tmSleep(r.mins, r.song); return; }
    else if (r.cmd === 'queue'){ hqCommand(r); return; }
    else if (r.cmd === 'party'){ hqParty(r.on); return; }
    else if (r.cmd === 'listen'){ tmListen(r.id); return; }
    else if (r.cmd === 'skip'){ tmNext(); return; }
    else if (r.cmd === 'favs'){ store.setJ('musicFavs', r.favs); toast(r.favs.length ? 'Favourites for the number keys, from your phone: ' + r.favs.map((f, i) => (i + 1) + ' ' + f.name).join(', ') : 'Favourites cleared: the number keys play your first playlists.', 6000); render(); D.sentState = ''; tellRemote('Favourites saved'); return; }
    D.sentState = ''; tellRemote();
  });
  D.sentState = ''; tellRemote();
}
/** Tells a listening phone what's on screen, when that changes, and whether an account is connected here. */
function tellRemote(note){
  if (!D.remote || D.embed) return;
  const sp = TM.acc ? (TM.acc.name || TM.acc.id) : '';
  const key = D.mode + '/' + shown() + '/' + !!NET.creds + '/' + sp + '/' + TM.sleepAt + '/' + TM.sleepSong + '/' + HQ.party;
  if (key === D.sentState && !note) return;
  D.sentState = key;
  // with the house queue (the first few), the party's code, and whose Spotify the TV has (src/display/tvqueue.js)
  sendRemote(D.remote, { from: 'screen', state: { mode: D.mode, shown: shown(), at: Date.now(), account: !!NET.creds, spotify: sp, sleepAt: TM.sleepAt, sleepSong: !!TM.sleepSong, note: note || '',
    queue: queueWire(HQ.q, 8), more: Math.max(0, HQ.q.length - 8), party: HQ.party, people: tmPeople().slice(0, 8), listening: TM.acc ? TM.acc.id : '' } });
}
/** What the phone sends, sealed with the site's PIN: the account, guest Wi-Fi, dates, the calendar (src/lib/remote.js). */
async function takeDetails(box){
  const secret = lockSecret();
  const d = secret && canSeal() ? await openDetails(D.remote, secret, box) : null;
  if (!d){ toast('Your phone sent something this screen couldn\'t open. Unlock both with the same PIN, with Remember ticked.', 8000); tellRemote('Couldn\'t open it: unlock both with the same PIN'); return; }
  const got = [], changes = {};
  if ('trip' in d){
    const was = D.trip; D.trip = d.trip || null;
    if (D.trip) store.setJ('trip', D.trip); else store.del('trip');
    SRC.service.last = 0; render();
    if (D.trip && (!was || was.sched !== D.trip.sched)) toast((D.trip.name ? D.trip.name + ' is on the way' : 'On the way') + ' home, on the ' + hhmm(D.trip.sched) + '.', 6000);
    tellRemote(D.trip ? 'Showing the way home' : 'Home');
    if (Object.keys(d).length === 1) return;
  }
  if (d.account){
    const a = d.account;
    store.set('account', a.account); store.set('key', a.key); store.set('gasUnit', a.gasUnit); store.set('pay', a.pay);
    NET.creds = { account: a.account, key: a.key }; NET.token = null; D.deviceId = null;
    ['live', 'tariff'].forEach(k => { SRC[k].data = null; SRC[k].err = null; SRC[k].last = 0; SRC[k].fails = 0; });
    got.push('your Octopus account');
  }
  if (d.wifi){ changes.wifi = d.wifi; got.push('guest Wi-Fi'); }
  if (d.dates){ changes.dates = d.dates; got.push(d.dates.length + (d.dates.length === 1 ? ' date' : ' dates')); }
  if (d.ical){ changes.ical = d.ical; got.push('your calendar'); }
  if (d.spotify){ tmTake(d.spotify); got.push('Spotify (' + d.spotify.name + ')'); }
  if (d.week){ changes.workDays = d.week.days; changes.workStart = d.week.start; changes.workEnd = d.week.end; if (d.week.walk) changes.workWalk = d.week.walk; }
  if (d.plan || d.week){ if (d.plan){ D.plan = d.plan; store.setJ('plan', d.plan); } SRC.trains.last = 0; got.push('your office days'); }
  if (Object.keys(changes).length) applySettings(displaySettings(Object.assign({}, D.set, changes)));
  const list = got.length > 1 ? got.slice(0, -1).join(', ') + ' and ' + got[got.length - 1] : got[0];
  toast(`From your phone: ${list}.`, 6000);
  render(); tellRemote('Received ' + list);
}

/* ---------- guest Wi-Fi: a code a visitor's phone camera can read ---------- */
function showWifi(ms){
  const w = D.set.wifi, code = wifiCode(w);
  if (!code){ toast('No guest Wi-Fi yet: add it on your phone (Settings, then Household) and send it from Screen.', 6000); return; }
  $('#wifiQr').innerHTML = qrSvg(code, { label: 'Guest Wi-Fi code' });
  $('#wifiNet').textContent = w.ssid;
  $('#wifiPw').textContent = w.security === 'nopass' || !w.password ? 'No password' : w.password;
  $('#wifiCard').hidden = false; hideChrome();
  clearTimeout(showWifi.timer); showWifi.timer = setTimeout(hideWifi, ms || 3 * MIN);
}
function hideWifi(){ $('#wifiCard').hidden = true; clearTimeout(showWifi.timer); }
const wifiOpen = () => !$('#wifiCard').hidden;

function newPairing(){
  if (D.stopRemote){ D.stopRemote(); D.stopRemote = null; }
  store.set('remote', newRemoteCode()); startRemote();
  $('#pairCode').textContent = showCode(D.remote);
}

/* ---------- toolbar, settings and remote control ---------- */
const open = () => !$('#sheet').hidden;
function showChrome(focus){
  document.body.classList.add('chrome-on'); D.chromeUntil = Date.now() + 8000;
  if (focus){ const b = $(`#picker [data-mode="${D.mode}"]`) || $('#picker .btn'); if (b) b.focus(); }
}
function hideChrome(){ document.body.classList.remove('chrome-on'); D.chromeUntil = 0; if ($('#bar').contains(document.activeElement)) document.activeElement.blur(); }
function toast(msg, ms){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, ms || 4000);
}
function focusables(root){
  return [].slice.call(root.querySelectorAll('button, a[href], input, select, textarea')).filter(el => !el.disabled && (el.offsetWidth || el.offsetHeight));
}
/** Spatial navigation for remotes: move focus to the nearest control in the arrow's direction. */
function moveFocus(root, key){
  const list = focusables(root), cur = document.activeElement;
  if (list.indexOf(cur) < 0){ if (list[0]) list[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
  let best = null, score = Infinity;
  list.forEach(el => {
    if (el === cur) return;
    const b = el.getBoundingClientRect(), dx = b.left + b.width/2 - cx, dy = b.top + b.height/2 - cy;
    const along = key === 'ArrowRight' ? dx : key === 'ArrowLeft' ? -dx : key === 'ArrowDown' ? dy : -dy;
    const across = key === 'ArrowRight' || key === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
    if (along < 2) return;
    const sc = along + across * 2.5;
    if (sc < score){ score = sc; best = el; }
  });
  if (best){ best.focus(); if (best.scrollIntoView) best.scrollIntoView({ block: 'nearest' }); }
}
const isBack = e => ['Escape', 'GoBack', 'BrowserBack', 'XF86Back'].indexOf(e.key) >= 0 || e.keyCode === 10009 || e.keyCode === 461 || (e.key === 'Backspace' && !editable(e.target));
const editable = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['checkbox', 'radio', 'button', 'submit'].indexOf(el.type) < 0));
const COLOUR_KEYS = { 403: 'energy', 404: 'home', 405: 'travel', 406: 'screensaver', ColorF0Red: 'energy', ColorF1Green: 'home', ColorF2Yellow: 'travel', ColorF3Blue: 'screensaver' };
function onKey(e){
  const woke = !!D.override && D.override !== D.mode;
  D.lastInput = Date.now();
  if (wifiOpen()){ e.preventDefault(); hideWifi(); return; }
  if (!open() && tmMediaKey(e)){ e.preventDefault(); return; }
  if (woke){ D.override = null; applyMode(); e.preventDefault(); return; }
  if (open()){
    if (isBack(e)){ e.preventDefault(); closeSheet(); return; }
    if (/^Arrow/.test(e.key)){
      const t = e.target, txt = editable(t) && t.type !== 'date';
      const atEdge = txt && t.selectionStart != null ? (e.key === 'ArrowLeft' ? t.selectionStart === 0 : e.key === 'ArrowRight' ? t.selectionEnd === t.value.length : true) : !(t && t.type === 'date');
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || atEdge){ e.preventDefault(); moveFocus($('#sheet'), e.key); }
      return;
    }
    if (e.key === 'Enter' && e.target && e.target.type === 'checkbox'){ e.preventDefault(); e.target.click(); }
    return;
  }
  if (isBack(e)){ if (document.body.classList.contains('chrome-on')){ e.preventDefault(); hideChrome(); } return; }
  const inBar = $('#bar').contains(document.activeElement);
  if (inBar){
    D.chromeUntil = Date.now() + 8000;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); moveFocus($('#bar'), e.key); return; }
    if (e.key === 'ArrowDown'){ e.preventDefault(); hideChrome(); return; }
    if (e.key === 'ArrowUp'){ e.preventDefault(); return; }
  } else {
    // the Music view keeps the arrows, OK and the numbers for the music; up still opens the toolbar
    if (shown() === 'music' && e.key !== 'ArrowUp' && tmKey(e)){ e.preventDefault(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); setMode(stepMode(D.mode, e.key === 'ArrowRight' ? 1 : -1)); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter'){ e.preventDefault(); showChrome(true); return; }
  }
  const pick = MODES.filter(m => m.key === e.key)[0];
  const colour = COLOUR_KEYS[e.keyCode] || COLOUR_KEYS[e.key];
  if (pick || colour){ e.preventDefault(); setMode(pick ? pick.id : colour); return; }
  // preventDefault stops the letter also landing in the first settings box.
  if (e.key === 'f' || e.key === 'F'){ e.preventDefault(); toggleFullscreen(); }
  if (e.key === 's' || e.key === 'S'){ e.preventDefault(); openSheet(); }
  if (e.key === 'w' || e.key === 'W'){ e.preventDefault(); showWifi(); }
}
function toggleFullscreen(){
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const d = document.documentElement, r = d.requestFullscreen || d.webkitRequestFullscreen; if (r){ const p = r.call(d); if (p && p.catch) p.catch(() => {}); }
      else toast('This browser can\'t go full screen. On an iPhone: Share, then Add to Home Screen, and open it from there.', 7000); }
  } catch(e){}
}
function syncFs(){ $('#fsBtn').textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? 'Exit full screen' : 'Full screen'; }
async function keepAwake(){
  try { if ('wakeLock' in navigator && !document.hidden && (!D.wake || D.wake.released)) D.wake = await navigator.wakeLock.request('screen'); } catch(e){}
}

/* ---------- settings sheet ---------- */
function timeOptions(){ const o = []; for (let m = 0; m < 1440; m += 30) o.push(`${pad2(Math.floor(m/60))}:${pad2(m % 60)}`); return o; }
function buildSheet(){
  $('#fMode').innerHTML = MODES.map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  $$('[data-times]').forEach(s => { s.innerHTML = timeOptions().map(t => `<option>${t}</option>`).join(''); });
  $$('[data-walk]').forEach(s => { s.innerHTML = [0, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 40].map(m => `<option value="${m}">${m} minutes</option>`).join(''); });
  $('#fRegion').innerHTML = Object.keys(REGIONS).map(k => `<option value="${k}">${k} · ${REGIONS[k]}</option>`).join('');
  const colours = Object.keys(BIN_COLOURS).map(c => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('');
  $('#binRows').innerHTML = [0, 1, 2, 3].map(i => `<div class="fields" data-bin="${i}">
    <div class="field"><label for="bN${i}">Bin ${i + 1}</label><input id="bN${i}" placeholder="${['General waste', 'Paper and card', 'Garden waste', 'Glass and cans'][i]}"></div>
    <div class="field"><label for="bC${i}">Colour</label><select id="bC${i}">${colours}</select></div>
    <div class="field"><label for="bD${i}">A collection date</label><input id="bD${i}" inputmode="numeric" placeholder="dd/mm/yyyy"></div>
    <div class="field"><label for="bE${i}">Comes every</label><select id="bE${i}"><option value="1">Week</option><option value="2">2 weeks</option><option value="3">3 weeks</option><option value="4">4 weeks</option></select></div></div>`).join('');
}
function fillSheet(){
  const s = D.set, setv = (id, v) => { const el = $('#' + id); if (el) el.value = String(v); };
  setv('fMode', s.mode); setv('fRotate', s.rotate); setv('fSaver', s.saver); setv('fDetail', s.detail); setv('fNight', s.night ? 1 : 0); setv('fMusicNight', s.musicNight === false ? 0 : 1);
  const near = t => { const p = String(t).split(':'); const m = Math.round(((+p[0] || 0)*60 + (+p[1] || 0)) / 30) * 30 % 1440; return `${pad2(Math.floor(m/60))}:${pad2(m % 60)}`; };
  setv('fNightFrom', near(s.nightFrom)); setv('fNightTo', near(s.nightTo)); setv('fReload', near(s.reloadAt)); setv('fRegion', region());
  [0, 1, 2, 3].forEach(i => { const b = s.bins[i] || { name: '', colour: ['black', 'blue', 'brown', 'green'][i], date: '', every: 2 }; setv('bN' + i, b.name); setv('bC' + i, b.colour); setv('bD' + i, b.date ? ukDate(b.date) : ''); setv('bE' + i, b.every || 2); });
  setv('fIcal', s.ical); setv('fTrainFrom', s.trainFrom); setv('fTrainTo', s.trainTo); setv('fTrainWalk', s.trainWalk); setv('fTramStop', s.tramStop); setv('fTramWalk', s.tramWalk);
  $('#acctHelp').textContent = NET.creds ? `Live draw and today's cost use the Octopus account ${NET.creds.account}, connected on this screen.` : 'For live draw and today\'s cost, open the phone pages on this screen once (Settings, then Account) and connect your Octopus account.';
  $('#travelHelp').textContent = !NET.proxy ? 'Live trains and trams come through the home server helper, which holds the API keys. Open the display from it to see them.'
    : `Home server helper found. Trains: ${NET.keys.rtt ? 'token set' : 'no Realtime Trains token yet'}. Trams: ${NET.keys.tfgm ? 'key set' : 'no TfGM key yet'}.`;
  const people = tmPeople();
  $('#fListen').innerHTML = people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (TM.acc) setv('fListen', TM.acc.id);
  $('#listenRow').hidden = people.length < 2;
  $('#partyBtn').textContent = HQ.party ? 'End the party' : 'Start a party';
  $('#partyBtn').disabled = !TM.acc;
  $('#musicHelp').textContent = !TM.acc ? 'Spotify isn\'t on this screen yet. On your phone: Screen, then Connect Spotify on the TV.'
    : (HQ.party ? 'The party is on: guests scan the code on the Music view to add songs. ' : 'A party shows a code on the Music view that guests scan to add songs and vote, with no sign-in. ') + 'Add another person\'s Spotify from their phone (Screen, then Spotify on the TV).';
  $('#setupOut').textContent = '';
  $('#pairCode').textContent = D.remote ? showCode(D.remote) : 'Starting…';
}
function readSheet(){
  const v = id => $('#' + id).value.trim();
  const bins = [0, 1, 2, 3].map(i => ({ name: v('bN' + i), colour: v('bC' + i), date: parseUkDate(v('bD' + i)), every: +v('bE' + i) || 2 })).filter(b => b.name && b.date);
  // on top of what this screen already holds, so what the sheet doesn't show (the commute, guest Wi-Fi, dates) stays
  return displaySettings(Object.assign({}, D.set, { mode: v('fMode'), rotate: +v('fRotate'), saver: +v('fSaver'), detail: v('fDetail'), night: v('fNight') === '1', musicNight: v('fMusicNight') !== '0', nightFrom: v('fNightFrom'), nightTo: v('fNightTo'), reloadAt: v('fReload'),
    bins, ical: v('fIcal'), trainFrom: v('fTrainFrom').toUpperCase(), trainTo: v('fTrainTo').toUpperCase(), trainWalk: +v('fTrainWalk'), tramStop: v('fTramStop'), tramWalk: +v('fTramWalk') }));
}
function openSheet(){ hideChrome(); fillSheet(); $('#sheet').hidden = false; $('#fMode').focus(); }
function closeSheet(){ $('#sheet').hidden = true; D.lastInput = Date.now(); $('#setBtn').blur(); }
function applySettings(s, regionCode){
  const old = D.set; D.set = s; store.setJ('display', deviceChanges(s, D.household));
  if (regionCode && regionCode !== region()){ store.set('region', regionCode); SRC.agile.last = 0; SRC.carbon.last = 0; SRC.agile.data = null; SRC.carbon.data = null; }
  if (old.ical !== s.ical){ SRC.cal.data = null; SRC.cal.err = null; SRC.cal.last = 0; }
  if (old.trainFrom !== s.trainFrom || old.trainTo !== s.trainTo || old.trainWalk !== s.trainWalk || old.workWalk !== s.workWalk || old.workStart !== s.workStart || old.workEnd !== s.workEnd || String(old.workDays) !== String(s.workDays)){ SRC.trains.data = null; SRC.trains.err = null; SRC.trains.last = 0; }
  if (old.tramStop !== s.tramStop){ SRC.trams.data = null; SRC.trams.err = null; SRC.trams.last = 0; }
  D.rotateAt = Date.now() + s.rotate * MIN;
  D.reloadAt = nextReload(Date.now(), s.reloadAt, Math.random()*10);
  render();
}
/* Setup links carry settings from one device to another: display.html#setup=<base64 JSON>. */
const b64 = { enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
              dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) };
function setupLink(s, withRegion){
  const o = Object.assign({}, s, { region: withRegion }); delete o.wifi; delete o.dates;   // the guest password and family dates travel sealed, not in a link
  return location.href.split('#')[0] + '#setup=' + b64.enc(JSON.stringify(o));
}
function importSetup(hash){
  const m = /^#setup=([A-Za-z0-9_-]+)$/.exec(hash || '');
  if (!m) return false;
  try { const j = JSON.parse(b64.dec(m[1])); delete j.region; applySettings(mergeSettings(D.household, j), REGIONS[JSON.parse(b64.dec(m[1])).region] ? JSON.parse(b64.dec(m[1])).region : null); toast('Settings saved on this device.'); }
  catch(e){ toast('That setup link didn\'t work. Copy it again from the settings.'); }
  return true;
}

/* ---------- events ---------- */
function wire(){
  $('#picker').innerHTML = MODES.map(m => `<button class="btn" type="button" role="tab" data-mode="${m.id}" aria-selected="false"><span class="k">${m.key}</span>${m.label}</button>`).join('');
  $('#picker').addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-mode]'); if (b){ setMode(b.getAttribute('data-mode')); showChrome(); } });
  $('#setBtn').addEventListener('click', openSheet);
  $('#fsBtn').addEventListener('click', toggleFullscreen);
  $('#wifiBtn').addEventListener('click', () => showWifi());
  $('#wifiCard').addEventListener('click', hideWifi);
  $('#closeSheet').addEventListener('click', closeSheet);
  $('#newCode').addEventListener('click', () => { newPairing(); toast('New code. Enter it on your phone again.'); });
  $('#setForm').addEventListener('submit', e => { e.preventDefault(); const lv = $('#fListen').value; applySettings(readSheet(), $('#fRegion').value); closeSheet(); toast('Settings saved on this device.'); if (lv && TM.acc && lv !== TM.acc.id) tmListen(lv); });
  $('#partyBtn').addEventListener('click', () => { closeSheet(); hqParty(!HQ.party); });
  $('#copySetup').addEventListener('click', () => {
    const link = setupLink(readSheet(), $('#fRegion').value), out = $('#setupOut');
    const done = ok => { out.textContent = (ok ? 'Copied. ' : '') + 'Open this link on the other screen to copy these settings there' + (readSheet().ical ? ' (it includes your secret calendar address, so only send it to yourself)' : '') + ': ' + link; };
    try { navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); } catch(e){ done(false); }
  });
  document.addEventListener('keydown', onKey);
  const wake = () => { D.lastInput = Date.now(); if (D.override && D.override !== D.mode){ D.override = null; applyMode(); return true; } return false; };
  let lastMove = 0;
  document.addEventListener('mousemove', () => { if (D.embed) return; const n = Date.now(); if (n - lastMove < 300) return; lastMove = n; if (!wake() && !open()) showChrome(); });
  let tx = null, ty = null;
  document.addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (wake() || open() || tx == null) return;
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; tx = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && !$('#bar').contains(e.target)) setMode(stepMode(D.mode, dx < 0 ? 1 : -1));
    else showChrome();
  }, { passive: true });
  window.addEventListener('hashchange', () => { if (importSetup(location.hash)){ try { history.replaceState(null, '', '#' + D.mode); } catch(e){} return; } D.preview = hashOptions(location.hash); const m = modeFromHash(location.hash, null); if (m && m !== D.mode) setMode(m, { keepHash: true }); else render(); });
  window.addEventListener('online', () => { retryAll(); render(); });
  window.addEventListener('offline', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden){ keepAwake(); retryAll(); } });
  document.addEventListener('fullscreenchange', syncFs); document.addEventListener('webkitfullscreenchange', syncFs);
  document.addEventListener('click', () => keepAwake(), true);
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { Cockpit.resize(); render(); }, 200); });
}

/* ---------- start ---------- */
(async () => {
  const k = store.get('key'), a = store.get('account');
  if (k && a) NET.creds = { account: a, key: k };
  buildSheet(); wire();
  // Settings every screen shares, from household.json next to this page. Missing or unreadable is fine.
  try {
    const r = await Promise.race([fetch('household.json', { cache: 'no-cache' }), new Promise((_, no) => setTimeout(no, 4000))]);
    if (r.ok){ D.household = await r.json(); D.set = mergeSettings(D.household, store.getJ('display', null)); }
  } catch(e){}
  D.embed = hashOptions(location.hash).embed === '1';
  document.body.classList.toggle('embed', D.embed);
  try { if (store.get('corners') === 'sharp') document.documentElement.setAttribute('data-corners', 'sharp'); } catch(e){}
  const imported = importSetup(location.hash);
  D.mode = modeFromHash(imported ? '' : location.hash, D.set.mode);
  D.preview = imported ? {} : hashOptions(location.hash);
  if (imported || !location.hash) try { history.replaceState(null, '', '#' + D.mode); } catch(e){}
  D.rotateAt = Date.now() + D.set.rotate * MIN;
  D.reloadAt = nextReload(Date.now(), D.set.reloadAt, Math.random()*10);
  applyMode();
  if (store.get('display.reloaded') || D.embed){ store.del('display.reloaded'); } else { showChrome(); }
  if (!D.embed) keepAwake();
  await detectProxy();
  startRemote();
  hqResume();
  tick(); setInterval(tick, 1000);
})();
