/* ===================== display: modes, remote control, scheduling, rendering ===================== */
// Written for older TV browsers too: no ?. or ?? here (see docs/STACK.md, "Smart TV notes").

const D = {
  household: null, preview: {},
  set: mergeSettings(null, store.getJ('display', null)),
  mode: 'energy', override: null, resume: null,
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
  cal:     { label: 'Calendar', every: () => 15*MIN, need: () => !!D.set.ical, run: () => loadCalendar(D.set.ical) },
  // Huxley2 is a free community service: ask once a minute only while departures are on screen.
  trains:  { label: 'Trains',  every: () => shown() === 'travel' ? MIN : shown() === 'screensaver' ? 3*MIN : 10*MIN, need: () => !!D.set.trainFrom, run: () => loadTrainsLive(D.set.trainFrom, D.set.trainTo) },
  trams:   { label: 'Trams',   every: () => shown() === 'travel' ? MIN : 5*MIN, need: () => NET.proxy && !!D.set.tramStop, run: () => loadTrams(D.set.tramStop) }
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
}
/** Once a second: night window, idle screensaver, rotation, the nightly fresh start, and any data that's due. */
function tick(){
  const now = Date.now(), set = D.set;
  const clock = hhmm(now);
  $$('[data-clock]').forEach(el => { if (el.textContent !== clock) el.textContent = clock; });
  const idle = now - D.lastInput;
  const night = set.night && inWindow(now, set.nightFrom, set.nightTo);
  if (night && idle > 2*MIN && D.mode !== 'night' && !open()) setOverride('night');
  else if (!night && D.override === 'night') setOverride(null);
  else if (!D.override && set.saver > 0 && idle > set.saver*MIN && D.mode !== 'screensaver' && D.mode !== 'night' && !open()) setOverride('screensaver');
  if (set.rotate > 0 && !D.override && ROTATING.indexOf(D.mode) >= 0 && now >= D.rotateAt && now - D.lastPick > 2*MIN && !open()){
    const i = ROTATING.indexOf(D.mode); setMode(ROTATING[(i + 1) % ROTATING.length], { rotation: true });
  }
  if (now >= D.reloadAt){
    if (navigator.onLine !== false && !open()){ store.set('display.reloaded', String(now)); location.reload(); return; }
    D.reloadAt = now + 5*MIN;
  }
  if (D.chromeUntil && now > D.chromeUntil && !open() && (!$('#bar').contains(document.activeElement) || idle > 30e3)) hideChrome();
  Object.keys(SRC).forEach(k => { if (due(SRC[k], now)) runSource(k); });
  if (++D.ticks % 30 === 0) render();
}

/** Bins from the council when the morning feed has them, otherwise the ones set by hand. */
const binsNow = now => councilBins(SRC.council.data, now) || D.set.bins;

/* ---------- rendering ---------- */
function render(){
  const m = shown();
  if (m === 'energy') renderEnergy();
  else if (m === 'home') renderHome();
  else if (m === 'travel') renderTravel();
  else if (m === 'screensaver') renderSaver();
  else if (m === 'night') renderNight();
}
function priceColour(p){ return p < 0 ? 'var(--neg)' : p < 15 ? 'var(--good)' : p < 25 ? 'var(--warn)' : 'var(--bad)'; }
function priceCls(p){ return p < 0 ? 'p-neg' : p < 15 ? 'p-low' : p < 25 ? 'p-mid' : 'p-high'; }
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

function renderEnergy(){
  const now = Date.now(), cur = agileNow(now), a = SRC.agile.data, el = $('#ePrice');
  if (cur){
    const col = priceColour(cur.p);
    el.textContent = pence(cur.p); el.style.color = col; el.style.textShadow = `0 0 40px ${col}`;
    $('#eLabel').textContent = cur.p < 0 ? 'Agile now · you\'re paid to use power' : cur.p < 15 ? 'Agile now · power is cheap' : 'Agile price now, per kWh';
    const best = cheapestWindow(a, 4, now);
    $('#eNext').textContent = best ? `Cheapest 2 hours ${dayKey(best.from) === dayKey(now) ? '' : DOW[new Date(best.from).getDay()] + ' '}${hhmm(best.from)}–${hhmm(best.to)} · ${pence(best.avg)}` : '';
  } else {
    el.textContent = '--'; el.style.color = ''; el.style.textShadow = '';
    $('#eLabel').textContent = SRC.agile.err ? 'No signal from Octopus' : 'Waiting for Agile prices';
    $('#eNext').textContent = SRC.agile.err ? 'Trying again shortly' : '';
  }
  $('#eStrip').innerHTML = a && a.length ? priceStrip(a, now) : '';
  const chips = [], L = SRC.live.data, T = SRC.tariff.data;
  if (!NET.creds) chips.push(`<div class="chip"><span class="v muted">—</span><span class="k">Live draw: connect your account on the dashboard on this device</span></div>`);
  else if (L && L.none) chips.push(`<div class="chip"><span class="v muted">—</span><span class="k">No Home Mini found for live draw</span></div>`);
  else chips.push(`<div class="chip"><span class="v" style="color:var(--elec)">${L && L.demand != null ? Math.round(L.demand).toLocaleString('en-GB') + ' W' : '—'}</span><span class="k">Drawing now${L && L.at ? ' · ' + hhmm(L.at) : ''}</span></div>`);
  if (L && L.today != null){
    const c = todayCost(L.rows, T && T.eSets, now);
    chips.push(`<div class="chip"><span class="v">${kwh(L.today)}</span><span class="k">Used today${c != null ? ' · ' + gbp(c) + ' with standing charge' : ''}</span></div>`);
  }
  const ci = SRC.carbon.data, cin = ci ? ci.filter(r => r.from <= now && now < r.to)[0] : null;
  if (cin){
    const g = cheapestWindow(ci.map(r => ({ from: r.from, to: r.to, p: r.v })), 6, now);
    chips.push(`<div class="chip"><span class="v">${cin.v} g</span><span class="k">Grid carbon · ${esc(cin.index)}${g ? ` · greenest ${hhmm(g.from)}–${hhmm(g.to)}` : ''}</span></div>`);
  }
  const er = T ? unitPriceAt(T.eSets, now) : null;
  if (er != null) chips.push(`<div class="chip"><span class="v">${pence(er)}</span><span class="k">Your tariff now, per kWh</span></div>`);
  else if (a){
    const fut = a.filter(r => r.to > now), max = fut.length ? fut.reduce((x, y) => y.p > x.p ? y : x) : null;
    if (max) chips.push(`<div class="chip"><span class="v">${pence(max.p)}</span><span class="k">Highest to come, at ${hhmm(max.from)}</span></div>`);
  }
  $('#eChips').innerHTML = chips.join('');
  $('#eFoot').innerHTML = `<span>Region ${region()} · ${REGIONS[region()]}</span>` + foot(['agile', 'carbon', 'live', 'tariff']);
}
/** Next 24 hours of Agile as a strip of bars, coloured by price, with a line at now. */
function priceStrip(rates, now){
  const start = Math.floor(now / 1800e3) * 1800e3 - 2*3600e3, list = rates.filter(r => r.from >= start).slice(0, 52);
  if (!list.length) return '';
  const n = list.length, W = 1000, H = 100, lo = Math.min(0, Math.min.apply(null, list.map(r => r.p))), hi = Math.max(10, Math.max.apply(null, list.map(r => r.p)));
  const y = v => H - (v - lo) / (hi - lo) * H, bw = W / n;
  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Agile prices for the next day">`;
  list.forEach((r, i) => {
    const top = Math.min(y(r.p), y(0)), h = Math.max(1, Math.abs(y(r.p) - y(0)));
    s += `<rect class="${priceCls(r.p)}${r.to <= now ? ' past' : ''}" x="${(i*bw + bw*0.12).toFixed(1)}" y="${top.toFixed(1)}" width="${(bw*0.76).toFixed(1)}" height="${h.toFixed(1)}"/>`;
  });
  const nx = ((now - list[0].from) / 1800e3) * bw;
  s += `<line class="nowl" x1="${nx.toFixed(1)}" x2="${nx.toFixed(1)}" y1="0" y2="${H}" vector-effect="non-scaling-stroke"/></svg><div class="ticks">`;
  list.forEach((r, i) => {
    const d = new Date(r.from);
    if (d.getMinutes() === 0 && d.getHours() % 6 === 0 && i > 1 && i < n - 3) s += `<span style="left:${(i / n * 100).toFixed(2)}%">${d.getHours() === 0 ? DOW[d.getDay()] : pad2(d.getHours()) + ':00'}</span>`;
  });
  return s + '</div>';
}

function renderHome(){
  const now = Date.now(), W = SRC.weather.data;
  $('#hDate').textContent = longDay(new Date(now));
  if (W){
    const today = W.days.filter(d => d.k === dayKey(now))[0] || W.days[0], wn = weatherText(W.now.code);
    $('#hSun').textContent = today ? `Sunrise ${hhmm(today.rise)} · sunset ${hhmm(today.set)}` : '';
    $('#hNow').innerHTML = `<div><span class="i" aria-hidden="true">${wn.icon}</span><span class="t">${Math.round(W.now.temp)}°</span></div>
      <p class="d">${esc(wn.text)} · feels ${Math.round(W.now.feels)}° · wind ${Math.round(W.now.wind)} mph</p>
      ${today ? `<p class="d">High ${Math.round(today.max)}° · low ${Math.round(today.min)}°</p>` : ''}`;
    $('#hHours').innerHTML = W.hours.map(h => { const w = weatherText(h.code); return `<div><span class="h">${pad2(new Date(h.t).getHours())}:00</span><span class="i" title="${esc(w.text)}">${w.icon}</span>${Math.round(h.temp)}°<span class="r">${h.rain != null ? h.rain + '%' : ''}</span></div>`; }).join('');
  } else {
    $('#hSun').textContent = '';
    $('#hNow').innerHTML = `<p class="d">${SRC.weather.err ? 'No weather signal, trying again' : 'Checking the weather…'}</p>`;
    $('#hHours').innerHTML = '';
  }
  const council = !!councilBins(SRC.council.data, now), bins = nextCollections(binsNow(now), now), hour = new Date(now).getHours();
  $('#hBins').innerHTML = !bins.length ? '<p class="empty">Add the STOCKPORT_UPRN secret for the council\'s dates (see the README), or add your bins in settings.</p>' : `<ul class="list">${bins.map(b => {
    const when = b.days === 0 ? 'Today' : b.days === 1 ? (hour >= 12 ? 'Tomorrow · put it out tonight' : 'Tomorrow') : relDay(+b.date, now);
    return `<li><span class="what"><i class="bin" style="background:${BIN_COLOURS[b.colour] || BIN_COLOURS.grey}"></i>${esc(b.name)}</span><span class="when${b.days <= 1 ? ' soon' : ''}">${esc(when)}</span></li>`;
  }).join('')}</ul>`;
  const C = SRC.cal;
  let evs = null, note = '';
  if (!D.set.ical) note = 'Add a calendar\'s iCal address in settings to see what\'s coming up.';
  else if (C.data) evs = C.data.filter(e => e.end > now);
  else if (C.err) note = esc(C.err.code === 'NOPROXY' ? 'This calendar doesn\'t let a web page read it directly. Google calendars need a small server (see the README).' : C.err.code === 'CALFAIL' ? 'Couldn\'t read the calendar. Check the secret iCal address in settings.' : errorText(C.err).join(' '));
  else note = 'Reading the calendar…';
  $('#hCal').innerHTML = (evs ? (evs.length ? `<ul class="list">${evs.slice(0, 6).map(e => `<li><span class="what">${esc(e.title)}</span><span class="when">${relDay(e.start, now)}${e.allDay ? '' : ' ' + hhmm(e.start)}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing in the next week.</p>') : '') + (note ? `<p class="note">${note}</p>` : '');
  $('#hFoot').innerHTML = `<span>Weather from Open-Meteo${council ? ' · bins from Stockport Council' : ''}</span>` + foot(['weather', 'cal']);
}

function renderTravel(){
  const now = Date.now(), s = D.set, T = SRC.trains;
  let html = '', list = null;
  if (!s.trainFrom) html = '<p class="empty">Set a railway station in settings.</p>';
  else if (T.data) list = T.data.list;
  else if (T.err) html = `<p class="empty">No departures signal: ${esc(errorText(T.err)[0])} Trying again shortly.</p>`;
  else html = '<p class="empty">Checking departures…</p>';
  const stn = T.data && T.data.station ? T.data.station : s.trainFrom;
  $('#tTrainTitle').textContent = `Trains from ${stn}${s.trainTo ? ' calling at ' + s.trainTo : ''}`;
  if (list){
    const rows = list.filter(d => (d.exp || d.sched) > now - 30e3).slice(0, 7);
    html = rows.length ? `<table class="deps"><thead><tr><th>Due</th><th>To</th><th class="opt">Plat</th><th>Status</th><th class="lv">Go</th></tr></thead><tbody>${rows.map(d => {
      const late = d.exp && d.exp - d.sched >= 60e3, lv = leaveBy(d.exp || d.sched, s.trainWalk, now);
      const st = d.cancelled ? '<span class="bad">Cancelled</span>' : d.delayed ? '<span class="warn">Delayed</span>' : late ? `<span class="warn">Exp ${hhmm(d.exp)}</span>` : '<span class="good">On time</span>';
      return `<tr><td class="t">${hhmm(d.sched)}</td><td class="dest">${esc(d.dest)}</td><td class="t opt">${esc(d.platform || '—')}</td><td class="st">${st}</td><td class="lv ${d.cancelled ? 'muted' : lv.cls}">${d.cancelled ? '—' : lv.text}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="empty">No more departures in the next two hours.</p>';
    if (T.data.messages && T.data.messages.length) html += `<p class="note">${esc(T.data.messages[0])}</p>`;
  }
  $('#tTrains').innerHTML = html;
  // Trams only show once a stop is set: TfGM needs a server that holds the key.
  const M = SRC.trams, tramPanel = $('#tTrams').parentNode;
  tramPanel.hidden = !s.tramStop;
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
  $('#tFoot').innerHTML = '<span>Live trains from National Rail, via Huxley2</span>' + foot(['trains', 'trams']);
}

function renderNight(){
  const now = Date.now(), cur = agileNow(now), W = SRC.weather.data;
  $('#nSub').textContent = [cur ? `Agile ${pence(cur.p)}` : '', W ? `${Math.round(W.now.temp)}°` : ''].filter(Boolean).join(' · ');
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
  const sky = skyFor(W, now, D.preview), known = !!W || !!D.preview.wx;
  return {
    sky, engine: engineFor(cur ? cur.p : null, ci ? ci.index : null),
    cards: buildBillboards({ agile: ag, carbon: SRC.carbon.data, live: L, cost: L ? todayCost(L.rows, T && T.eSets, now) : null, weather: W, bins: binsNow(now),
      events: SRC.cal.data, trains: SRC.trains.data, walk: D.set.trainWalk, label: 'Harold Street · region ' + region() }, now),
    hud: { price: cur ? pence(cur.p) : '--', priceTone: cur ? toneOf(cur.p) : 'muted', temp: known ? Math.round(sky.temp) + '°' : '--', wx: known ? weatherText(sky.code).text : '', date: longDay(new Date(now)) }
  };
}
function renderSaver(){ Cockpit.update(cockpitInfo(Date.now())); }
function startSaver(){ renderSaver(); Cockpit.start(); }
function stopSaver(){ Cockpit.stop(); }

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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); setMode(stepMode(D.mode, e.key === 'ArrowRight' ? 1 : -1)); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter'){ e.preventDefault(); showChrome(true); return; }
  }
  const pick = MODES.filter(m => m.key === e.key)[0];
  const colour = COLOUR_KEYS[e.keyCode] || COLOUR_KEYS[e.key];
  if (pick || colour){ e.preventDefault(); setMode(pick ? pick.id : colour); return; }
  // preventDefault stops the letter also landing in the first settings box.
  if (e.key === 'f' || e.key === 'F'){ e.preventDefault(); toggleFullscreen(); }
  if (e.key === 's' || e.key === 'S'){ e.preventDefault(); openSheet(); }
}
function toggleFullscreen(){
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else { const d = document.documentElement, r = d.requestFullscreen || d.webkitRequestFullscreen; if (r){ const p = r.call(d); if (p && p.catch) p.catch(() => {}); } }
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
    <div class="field"><label for="bD${i}">A collection date</label><input id="bD${i}" type="date"></div>
    <div class="field"><label for="bE${i}">Comes every</label><select id="bE${i}"><option value="1">Week</option><option value="2">2 weeks</option><option value="3">3 weeks</option><option value="4">4 weeks</option></select></div></div>`).join('');
}
function fillSheet(){
  const s = D.set, setv = (id, v) => { const el = $('#' + id); if (el) el.value = String(v); };
  setv('fMode', s.mode); setv('fRotate', s.rotate); setv('fSaver', s.saver); setv('fNight', s.night ? 1 : 0);
  const near = t => { const p = String(t).split(':'); const m = Math.round(((+p[0] || 0)*60 + (+p[1] || 0)) / 30) * 30 % 1440; return `${pad2(Math.floor(m/60))}:${pad2(m % 60)}`; };
  setv('fNightFrom', near(s.nightFrom)); setv('fNightTo', near(s.nightTo)); setv('fReload', near(s.reloadAt)); setv('fRegion', region());
  [0, 1, 2, 3].forEach(i => { const b = s.bins[i] || { name: '', colour: ['black', 'blue', 'brown', 'green'][i], date: '', every: 2 }; setv('bN' + i, b.name); setv('bC' + i, b.colour); setv('bD' + i, b.date); setv('bE' + i, b.every || 2); });
  setv('fIcal', s.ical); setv('fTrainFrom', s.trainFrom); setv('fTrainTo', s.trainTo); setv('fTrainWalk', s.trainWalk); setv('fTramStop', s.tramStop); setv('fTramWalk', s.tramWalk);
  $('#acctHelp').textContent = NET.creds ? `Live draw and today's cost use the Octopus account ${NET.creds.account}, connected on the dashboard on this device.` : 'For live draw and today\'s cost, connect your Octopus account once on the dashboard on this device.';
  $('#travelHelp').textContent = !NET.proxy ? 'Live trains and trams come through the home server helper, which holds the API keys. Open the display from it to see them.'
    : `Home server helper found. Trains: ${NET.keys.rtt ? 'token set' : 'no Realtime Trains token yet'}. Trams: ${NET.keys.tfgm ? 'key set' : 'no TfGM key yet'}.`;
  $('#setupOut').textContent = '';
}
function readSheet(){
  const v = id => $('#' + id).value.trim();
  const bins = [0, 1, 2, 3].map(i => ({ name: v('bN' + i), colour: v('bC' + i), date: v('bD' + i), every: +v('bE' + i) || 2 })).filter(b => b.name && b.date);
  return displaySettings({ mode: v('fMode'), rotate: +v('fRotate'), saver: +v('fSaver'), night: v('fNight') === '1', nightFrom: v('fNightFrom'), nightTo: v('fNightTo'), reloadAt: v('fReload'),
    bins, ical: v('fIcal'), trainFrom: v('fTrainFrom').toUpperCase(), trainTo: v('fTrainTo').toUpperCase(), trainWalk: +v('fTrainWalk'), tramStop: v('fTramStop'), tramWalk: +v('fTramWalk') });
}
function openSheet(){ hideChrome(); fillSheet(); $('#sheet').hidden = false; $('#fMode').focus(); }
function closeSheet(){ $('#sheet').hidden = true; D.lastInput = Date.now(); $('#setBtn').blur(); }
function applySettings(s, regionCode){
  const old = D.set; D.set = s; store.setJ('display', deviceChanges(s, D.household));
  if (regionCode && regionCode !== region()){ store.set('region', regionCode); SRC.agile.last = 0; SRC.carbon.last = 0; SRC.agile.data = null; SRC.carbon.data = null; }
  if (old.ical !== s.ical){ SRC.cal.data = null; SRC.cal.err = null; SRC.cal.last = 0; }
  if (old.trainFrom !== s.trainFrom || old.trainTo !== s.trainTo){ SRC.trains.data = null; SRC.trains.err = null; SRC.trains.last = 0; }
  if (old.tramStop !== s.tramStop){ SRC.trams.data = null; SRC.trams.err = null; SRC.trams.last = 0; }
  D.rotateAt = Date.now() + s.rotate * MIN;
  D.reloadAt = nextReload(Date.now(), s.reloadAt, Math.random()*10);
  render();
}
/* Setup links carry settings from one device to another: display.html#setup=<base64 JSON>. */
const b64 = { enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
              dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) };
function setupLink(s, withRegion){ return location.href.split('#')[0] + '#setup=' + b64.enc(JSON.stringify(Object.assign({}, s, { region: withRegion }))); }
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
  $('#closeSheet').addEventListener('click', closeSheet);
  $('#setForm').addEventListener('submit', e => { e.preventDefault(); applySettings(readSheet(), $('#fRegion').value); closeSheet(); toast('Settings saved on this device.'); });
  $('#copySetup').addEventListener('click', () => {
    const link = setupLink(readSheet(), $('#fRegion').value), out = $('#setupOut');
    const done = ok => { out.textContent = (ok ? 'Copied. ' : '') + 'Open this link on the other screen to copy these settings there' + (readSheet().ical ? ' (it includes your secret calendar address, so only send it to yourself)' : '') + ': ' + link; };
    try { navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); } catch(e){ done(false); }
  });
  document.addEventListener('keydown', onKey);
  const wake = () => { D.lastInput = Date.now(); if (D.override && D.override !== D.mode){ D.override = null; applyMode(); return true; } return false; };
  let lastMove = 0;
  document.addEventListener('mousemove', () => { const n = Date.now(); if (n - lastMove < 300) return; lastMove = n; if (!wake() && !open()) showChrome(); });
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
  const imported = importSetup(location.hash);
  D.mode = modeFromHash(imported ? '' : location.hash, D.set.mode);
  D.preview = imported ? {} : hashOptions(location.hash);
  if (imported || !location.hash) try { history.replaceState(null, '', '#' + D.mode); } catch(e){}
  D.rotateAt = Date.now() + D.set.rotate * MIN;
  D.reloadAt = nextReload(Date.now(), D.set.reloadAt, Math.random()*10);
  applyMode();
  if (store.get('display.reloaded')){ store.del('display.reloaded'); } else { showChrome(); }
  keepAwake();
  await detectProxy();
  tick(); setInterval(tick, 1000);
})();
