// Browser checks for the display and the dashboard, on fixed example data with the clock held at a known time.
//   - nothing scrolls sideways at 390x844 (phone) or 1920x1080 (TV), and the TV view fits without scrolling
//   - ten-foot rule: no visible text under 24px at 1080p
//   - the remote works: arrows, numbers, Enter, Back; idle screensaver; night clock; setup links
// Needs Playwright: `npm i --no-save playwright` then `node --test tests/display.browser.mjs`.
// SHOTS=1 also saves screenshots to tests/screens/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = process.env.SHOTS ? join(ROOT, 'tests', 'screens') : null;
if (SHOTS && !existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });

const NOW = new Date('2026-10-05T14:10:00+01:00');          // a Monday afternoon
const LATE = new Date('2026-10-05T23:10:00+01:00');
const iso = t => new Date(t).toISOString().replace('.000Z', 'Z');
const day0 = +new Date('2026-10-05T00:00:00+01:00');

/* ---------- fixtures ---------- */
function agileRates(){
  const out = [];
  for (let t = day0 - 864e5; t < day0 + 2 * 864e5; t += 1800e3){
    const h = new Date(t).getUTCHours() + 1 + new Date(t).getUTCMinutes() / 60;
    let p = 16 + 6 * Math.sin((h - 4) / 24 * 2 * Math.PI);
    if (h >= 16 && h < 19) p += 14;
    if (h >= 25 && h < 28) p = -1.5;
    out.push({ value_exc_vat: p / 1.05, value_inc_vat: +p.toFixed(2), valid_from: iso(t), valid_to: iso(t + 1800e3), payment_method: null });
  }
  return out.reverse();
}
function carbon(){
  const data = [];
  for (let t = Math.floor(+NOW / 1800e3) * 1800e3; t < +NOW + 48 * 3600e3; t += 1800e3){
    const v = Math.round(120 + 60 * Math.sin(t / 864e5 * 2 * Math.PI));
    data.push({ from: iso(t), to: iso(t + 1800e3), intensity: { forecast: v, index: v < 100 ? 'low' : v < 160 ? 'moderate' : 'high' } });
  }
  return { data: { regionid: 3, shortname: 'North West England', data } };
}
function weather(){
  const time = [], temperature_2m = [], precipitation_probability = [], weather_code = [];
  for (let h = 0; h < 48; h++){
    const d = new Date(day0 + h * 3600e3), loc = new Date(d.getTime() + 3600e3);
    time.push(loc.toISOString().slice(0, 13) + ':00');
    temperature_2m.push(+(11 + 4 * Math.sin((h - 9) / 24 * 2 * Math.PI)).toFixed(1));
    precipitation_probability.push((h * 7) % 60);
    weather_code.push([2, 3, 61, 80, 1][h % 5]);
  }
  return { current: { temperature_2m: 13.4, apparent_temperature: 11.2, weather_code: 3, wind_speed_10m: 9.1 },
           hourly: { time, temperature_2m, precipitation_probability, weather_code },
           daily: { time: ['2026-10-05', '2026-10-06'], sunrise: ['2026-10-05T07:15', '2026-10-06T07:17'], sunset: ['2026-10-05T18:40', '2026-10-06T18:38'], temperature_2m_max: [15.2, 14.1], temperature_2m_min: [8.3, 7.9] } };
}
function trains(){
  const svc = (min, dest, plat, extra = {}) => {
    const sched = +NOW + min * 60e3;
    return { temporalData: { departure: Object.assign({ scheduleAdvertised: iso(sched) }, extra.late ? { realtimeForecast: iso(sched + extra.late * 60e3) } : {}, extra.cancel ? { isCancelled: true } : {}), displayAs: extra.cancel ? 'CANCELLED' : 'CALL' },
             locationMetadata: { platform: { planned: plat } }, destination: [{ location: { description: dest } }], scheduleMetadata: { operator: { name: 'Northern' }, modeType: 'TRAIN' } };
  };
  return { query: { location: { description: 'Stockport', shortCodes: ['SPT'] } }, services: [
    svc(9, 'Manchester Piccadilly', '1'), svc(17, 'London Euston', '3', { late: 6 }), svc(24, 'Buxton', '4'),
    svc(31, 'Hazel Grove', '2', { cancel: true }), svc(38, 'Sheffield', '3'), svc(46, 'Manchester Airport', '1'), svc(55, 'Crewe', '4') ] };
}
// The outdoors: bank holidays, rain every quarter hour (dry, then rain from 15:00), the radar, air and floods, the grid mix.
const holidays = { 'england-and-wales': { division: 'england-and-wales', events: [{ title: 'Christmas Day', date: '2026-12-25' }, { title: 'Boxing Day', date: '2026-12-28' }] } };
function nowcast(){
  const t0 = Math.floor(+NOW / 900e3) * 900e3, time = [], precipitation = [];
  for (let i = -1; i < 12; i++){ time.push(new Date(t0 + i * 900e3).toLocaleString('sv-SE', { timeZone: 'Europe/London' }).slice(0, 16).replace(' ', 'T')); precipitation.push(i >= 4 ? 0.8 : 0); }
  return { minutely_15: { time, precipitation, precipitation_probability: precipitation.map(v => v ? 70 : 10) } };
}
const radar = { version: '2.0', host: 'https://tilecache.rainviewer.com', radar: { past: [0, 1, 2].map(i => ({ time: Math.floor(+NOW / 1000) - (2 - i) * 600, path: '/v2/radar/test' + i })), nowcast: [] } };
const air = { current: { european_aqi: 18, uv_index: 1.2, grass_pollen: 0, birch_pollen: 0, alder_pollen: 0 }, hourly: { uv_index: [0, 1, 2.6, 1] } };
const floods = { items: [{ severityLevel: 3, description: 'River Goyt at Marple Bridge', message: 'River levels are rising.', timeRaised: '2026-10-05T09:00:00' }] };
const gridMix = { data: [{ regionid: 3, shortname: 'North West England', data: [{ from: '2026-10-05T13:00Z', to: '2026-10-05T13:30Z', generationmix: [{ fuel: 'wind', perc: 55.4 }, { fuel: 'nuclear', perc: 27.6 }, { fuel: 'imports', perc: 8.3 }, { fuel: 'gas', perc: 6.5 }, { fuel: 'solar', perc: 2.2 }] }] }] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

function huxley(){
  const hm = m => { const d = new Date(+NOW + m * 60e3); return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }); };
  const svc = (m, dest, plat, etd, extra) => Object.assign({ std: hm(m), etd: etd || 'On time', platform: plat, operator: 'Northern', isCancelled: false, destination: [{ locationName: dest, via: null }] }, extra || {});
  return { locationName: 'Stockport', crs: 'SPT', nrccMessages: null, trainServices: [
    svc(9, 'Manchester Piccadilly', '1'), svc(17, 'London Euston', '3', hm(23)), svc(24, 'Buxton', '4'),
    svc(31, 'Hazel Grove', '2', 'Cancelled', { isCancelled: true }), svc(38, 'Sheffield', '3', 'Delayed'), svc(46, 'Manchester Airport', '1'), svc(55, 'Crewe', '4') ] };
}
const trams = { value: [
  { Id: 1, StationLocation: 'East Didsbury', Direction: 'Outgoing', Dest0: 'Rochdale Town Centre', Carriages0: 'Double', Status0: 'Due', Wait0: '4', Dest1: 'Shaw and Crompton', Carriages1: 'Single', Wait1: '12', Dest2: 'Rochdale Town Centre', Wait2: '19', MessageBoard: 'Welcome to Metrolink. Engineering works this Sunday: see tfgm.com.' },
  { Id: 2, StationLocation: 'East Didsbury', Direction: 'Incoming', Dest0: 'Terminates Here', Wait0: '2', MessageBoard: '<no message>' } ] };
const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:1', 'DTSTART;TZID=Europe/London:20261005T183000', 'DTEND;TZID=Europe/London:20261005T193000', 'SUMMARY:Parents\' evening', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:2', 'DTSTART;TZID=Europe/London:20260901T190000', 'DTEND;TZID=Europe/London:20260901T200000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'SUMMARY:Swimming lessons', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:3', 'DTSTART;VALUE=DATE:20261009', 'DTEND;VALUE=DATE:20261010', 'SUMMARY:Boiler service', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');

function graphql(body){
  const q = JSON.parse(body || '{}').query || '';
  if (/obtainKrakenToken/.test(q)) return { data: { obtainKrakenToken: { token: 'test-jwt' } } };
  if (/electricityAgreements/.test(q)) return { data: { account: { electricityAgreements: [{ meterPoint: { meters: [{ serialNumber: 'X', smartImportElectricityMeter: { deviceId: 'mini-1' } }] } }] } } };
  if (/smartMeterTelemetry/.test(q) && /TEN_SECONDS/.test(body)) return { data: { smartMeterTelemetry: [{ readAt: iso(+NOW - 20e3), consumptionDelta: 5, demand: 412 }] } };
  if (/smartMeterTelemetry/.test(q)) {
    const rows = []; for (let t = day0; t < +NOW - 1800e3; t += 1800e3) rows.push({ readAt: iso(t), consumptionDelta: 250, demand: null });
    return { data: { smartMeterTelemetry: rows } };
  }
  return { errors: [{ message: 'unknown query' }] };
}
function octopus(u){
  if (/\/v1\/accounts\/A-TEST1234\//.test(u)) return { number: 'A-TEST1234', properties: [{ moved_out_at: null, electricity_meter_points: [{ mpan: '1', is_export: false, meters: [{ serial_number: 'X' }], agreements: [{ tariff_code: 'E-1R-AGILE-24-10-01-G', valid_from: '2026-01-01T00:00:00Z', valid_to: null }] }], gas_meter_points: [] }] };
  if (/\/v1\/products\/\?/.test(u)) return { count: 1, next: null, results: [{ code: 'AGILE-24-10-01', display_name: 'Agile Octopus', available_from: '2024-10-01T00:00:00Z' }] };
  if (/standard-unit-rates/.test(u)) return { count: 144, next: null, results: agileRates() };
  if (/standing-charges/.test(u)) return { count: 1, next: null, results: [{ value_inc_vat: 48, valid_from: '2026-10-01T00:00:00Z', valid_to: null, payment_method: 'DIRECT_DEBIT' }] };
  return null;
}

/* ---------- a tiny server: the repo's files plus a pretend home server helper ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const DIST = join(ROOT, 'dist');            // the dashboard, built by Astro (npm run build); everything else from the repo
let helper = true, graphqlCalls = 0, accountCalls = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/json' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
  if (url.pathname.startsWith('/proxy/')){
    if (!helper) return send(404, 'not here', 'text/plain');
    if (url.pathname === '/proxy/ping') return send(200, 'ok', 'text/plain');
    if (url.pathname === '/proxy/status') return send(200, { ok: true, keys: { rtt: true, tfgm: true } });
    if (url.pathname.startsWith('/proxy/rtt/gb-nr/location')) return send(200, trains());
    if (url.pathname === '/proxy/tfgm/odata/Metrolinks') return send(200, trams);
    if (url.pathname.startsWith('/proxy/gcal/calendar/ical/')) return send(200, ics, 'text/calendar');
    if (url.pathname.startsWith('/proxy/octopus/v1/graphql')){ let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { graphqlCalls++; send(200, graphql(b)); }); return; }
    if (url.pathname.startsWith('/proxy/octopus/')){ if (url.pathname.includes('/v1/accounts/')) accountCalls++; const j = octopus(req.url); return j ? send(200, j) : send(404, {}); }
    if (url.pathname.startsWith('/proxy/meteo/')) return send(200, weather());
    if (url.pathname.startsWith('/proxy/carbon/')) return send(200, carbon());
    return send(404, { error: 'unknown service' });
  }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
  let file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST) || !existsSync(file)) file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file)) return send(404, 'missing', 'text/plain');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
let base, browser;
before(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); server.close(); });

const SETTINGS = { trainFrom: 'SPT', trainWalk: 12, tramStop: 'East Didsbury', tramWalk: 8, ical: 'https://calendar.google.com/calendar/ical/x%40group.calendar.google.com/private-0/basic.ics',
  bins: [{ name: 'General waste', colour: 'black', date: '2026-10-06', every: 2 }, { name: 'Paper and card', colour: 'blue', date: '2026-10-13', every: 2 }, { name: 'Garden waste', colour: 'brown', date: '2026-10-08', every: 2 }] };

async function open(path, { width = 1920, height = 1080, at = NOW, settings = SETTINGS, withHelper = true, account = false, clock = true } = {}){
  helper = withHelper;
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/London', locale: 'en-GB', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/^https:\/\/api\.octopus\.energy\//, r => { const j = octopus(r.request().url()); return j ? r.fulfill({ json: j }) : r.fulfill({ status: 404, json: {} }); });
  await page.route(/^https:\/\/api\.carbonintensity\.org\.uk\//, r => r.fulfill({ json: /\/regional\/regionid\//.test(r.request().url()) ? gridMix : carbon() }));
  await page.route(/^https:\/\/api\.open-meteo\.com\//, r => r.fulfill({ json: /minutely_15/.test(r.request().url()) ? nowcast() : weather() }));
  await page.route(/^https:\/\/air-quality-api\.open-meteo\.com\//, r => r.fulfill({ json: air }));
  await page.route(/^https:\/\/www\.gov\.uk\/bank-holidays\.json/, r => r.fulfill({ json: holidays }));
  await page.route(/^https:\/\/environment\.data\.gov\.uk\//, r => r.fulfill({ json: floods }));
  await page.route(/^https:\/\/api\.rainviewer\.com\//, r => r.fulfill({ json: radar }));
  await page.route(/^https:\/\/(tilecache\.rainviewer\.com|[a-d]\.basemaps\.cartocdn\.com)\//, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/^https:\/\/(national-rail-api\.davwheat\.dev|ntfy\.sh)\//, r => r.fulfill({ status: 500, body: '' }));
  await page.route(/^https:\/\/calendar\.google\.com\//, r => r.abort());
  await page.route(/^https:\/\/huxley2\.azurewebsites\.net\//, r => r.fulfill({ json: huxley() }));
  if (clock) await page.clock.install({ time: at });
  if (settings) await page.addInitScript(s => { try { localStorage.setItem('hse.display', s); } catch (e) {} }, JSON.stringify(settings));
  if (account) await page.addInitScript(() => { try { localStorage.setItem('hse.account', 'A-TEST1234'); localStorage.setItem('hse.key', 'sk_test'); } catch (e) {} });
  await page.goto(base + path);
  await page.waitForTimeout(800);
  return { page, ctx, errors };
}
const visibleMode = page => page.evaluate(() => { const s = [...document.querySelectorAll('.mode')].find(x => !x.hidden); return s && s.dataset.mode; });
async function layout(page){
  return page.evaluate(() => {
    const small = [];
    const walk = el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (own && el.getClientRects().length && parseFloat(cs.fontSize) < 23.5) small.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 30)}" ${cs.fontSize}`);
      [...el.children].forEach(walk);
    };
    walk(document.body);
    const wide = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
      .slice(0, 3).map(e => `${e.tagName.toLowerCase()}#${e.id}.${e.className}`).join(', ');
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight, small, wide };
  });
}
async function shot(page, name){ if (SHOTS) await page.screenshot({ path: join(SHOTS, name + '.png') }); }

const MODES = ['today', 'energy', 'travel', 'screensaver', 'night'];

test('display: every mode fits a 1080p TV, with 24px text and no sideways scroll', async () => {
  for (const withHelper of [true, false]) {
    const { page, ctx, errors } = await open('/display.html#energy', { withHelper, settings: withHelper ? SETTINGS : null });
    for (const m of MODES) {
      await page.evaluate(id => { location.hash = id; }, m);
      await page.waitForTimeout(500);
      await page.evaluate(() => document.body.classList.remove('chrome-on'));
      assert.equal(await visibleMode(page), m);
      await shot(page, `tv-${m}${withHelper ? '' : '-pages'}`);
      const l = await layout(page);
      assert.ok(l.sw <= l.iw, `${m}: scrolls sideways (${l.sw} > ${l.iw}): ${l.wide}`);
      assert.ok(l.sh <= l.ih, `${m}: taller than the screen (${l.sh} > ${l.ih})`);
      assert.deepEqual(l.small, [], `${m}: text under 24px at 1080p`);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const bar = await layout(page);
    assert.deepEqual(bar.small, [], 'toolbar text under 24px');
    await shot(page, `tv-toolbar${withHelper ? '' : '-pages'}`);
    await page.keyboard.press('s');
    await page.waitForTimeout(300);
    const sheet = await layout(page);
    assert.deepEqual(sheet.small, [], 'settings text under 24px');
    assert.ok(sheet.sw <= sheet.iw, 'settings scroll sideways');
    await shot(page, `tv-settings${withHelper ? '' : '-pages'}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('display: content on the TV is real data, labelled examples only where nothing is set up', async () => {
  const { page, ctx } = await open('/display.html#today');
  await page.waitForTimeout(800);
  assert.match(await page.textContent('#dVerdict'), /Wait if you can|Good time|price|Paid/, 'the same answer as the phone');
  assert.match(await page.textContent('#dHeads'), /Leave in \d+ min/);
  assert.match(await page.textContent('#dHeads'), /Flood alert/);
  assert.match(await page.textContent('#dTrains'), /Manchester Piccadilly|London Euston/);
  assert.match(await page.textContent('#dDay'), /Parents' evening/);
  assert.match(await page.textContent('#dDay'), /General waste\s*Out tonight/);
  assert.match(await page.textContent('#dNow'), /Grid carbon/);
  assert.equal(await page.$$eval('#dStrip svg', s => s.length), 1, 'the next twelve hours are drawn');
  await page.keyboard.press('2');
  await page.waitForTimeout(300);
  assert.match(await page.textContent('#ePrice'), /^\d+\.\dp$/, 'Agile price now');
  assert.match(await page.textContent('#eRun'), /Washing machine/);
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  const trains = await page.textContent('#tTrains');
  assert.match(trains, /Manchester Piccadilly/);
  assert.match(trains, /Leave in \d+ min/);
  assert.match(trains, /Cancelled/);
  assert.match(await page.textContent('#tTramTitle'), /East Didsbury/);
  assert.doesNotMatch(await page.textContent('#screen'), /Example/);
  await ctx.close();
  // GitHub Pages, no home server: trains still come straight from the public boards; trams say what they need.
  const pages = await open('/display.html#travel', { withHelper: false, settings: { tramStop: 'East Didsbury' } });
  await pages.page.waitForTimeout(500);
  assert.match(await pages.page.textContent('#tTrains'), /Manchester Piccadilly/);
  assert.match(await pages.page.textContent('#tTrains'), /Delayed/);
  assert.match(await pages.page.textContent('#tTrams'), /TfGM key/);
  assert.doesNotMatch(await pages.page.textContent('#screen'), /Example/);
  await pages.ctx.close();
  const bare = await open('/display.html#travel', { withHelper: false, settings: null });
  assert.equal(await bare.page.isVisible('#tTrams'), false, 'no tram stop, no tram panel');
  await bare.ctx.close();
});

test('display: trains still come when a departure board is down', async () => {
  // Huxley2's public board fails; the second service answers. Then both fail, and Huxley2's staff board answers.
  const staff = () => { const j = huxley(); j.trainServices = j.trainServices.map(s => Object.assign({}, s, { std: '2026-10-05T' + s.std + ':00', etd: /^\d/.test(s.etd) ? '2026-10-05T' + s.etd + ':30' : s.etd === 'On time' ? '2026-10-05T' + s.std + ':00' : null })); return j; };
  for (const down of [['departures'], ['departures', 'davwheat']]) {
    const { page, ctx } = await open('/display.html#travel', { withHelper: false, settings: { trainFrom: 'SPT' } });
    await page.route(/^https:\/\/huxley2\.azurewebsites\.net\/departures\//, r => r.fulfill({ status: 500, body: '' }));
    await page.route(/^https:\/\/huxley2\.azurewebsites\.net\/staffdepartures\//, r => r.fulfill({ json: staff() }));
    await page.route(/^https:\/\/national-rail-api\.davwheat\.dev\//, r => down.includes('davwheat') ? r.fulfill({ status: 500, body: '' }) : r.fulfill({ json: huxley() }));
    await page.reload(); await page.waitForTimeout(1200);
    const trains = await page.textContent('#tTrains');
    assert.match(trains, /Manchester Piccadilly/, `trains with ${down.join(' and ')} down`);
    assert.match(trains, /Leave in \d+ min/);
    await ctx.close();
  }
});

test('display: Home Mini live draw and today\'s cost, without using up Octopus\'s rate limit', async () => {
  graphqlCalls = 0;
  const { page, ctx, errors } = await open('/display.html#energy', { account: true });
  await page.waitForFunction(() => /412 W/.test(document.getElementById('eChips').textContent));
  const chips = await page.textContent('#eChips');
  assert.match(chips, /Drawing now/);
  // 28 half hours of 0.25 kWh at the Agile fixture's prices, plus a 48p standing charge.
  assert.match(chips, /Today so far\s*7\.0 kWh · £\d+\.\d\d/);
  const first = graphqlCalls;
  for (let i = 0; i < 60; i++) { await page.clock.fastForward('01:00'); await page.waitForTimeout(20); }
  await page.waitForTimeout(500);
  const hour = graphqlCalls - first;
  assert.ok(hour >= 25 && hour <= 40, `${hour} GraphQL calls in an hour: it should keep polling, but Octopus allows about 100, shared with its app`);
  assert.deepEqual(errors, []);
  await shot(page, 'tv-energy-account');
  await ctx.close();
});

test('display: every mode works on a phone without sideways scroll', async () => {
  const { page, ctx, errors } = await open('/display.html#energy', { width: 390, height: 844 });
  for (const m of MODES) {
    await page.evaluate(id => { location.hash = id; }, m);
    await page.waitForTimeout(400);
    await page.evaluate(() => document.body.classList.remove('chrome-on'));
    const l = await layout(page);
    assert.ok(l.sw <= l.iw, `${m}: scrolls sideways on a phone (${l.sw} > ${l.iw}): ${l.wide}`);
    await shot(page, `phone-${m}`);
  }
  await page.evaluate(() => document.body.classList.add('chrome-on'));
  await page.waitForTimeout(400);
  const bar = await page.evaluate(() => document.getElementById('bar').getBoundingClientRect().height);
  assert.ok(bar < 844 * 0.25, `toolbar takes ${bar}px of a phone screen`);
  await shot(page, 'phone-toolbar');
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  assert.equal(await page.inputValue('#fMode'), 'screensaver', 'the s key opens settings without typing into them');
  const l = await layout(page);
  assert.ok(l.sw <= l.iw, 'settings scroll sideways on a phone');
  await shot(page, 'phone-settings');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('display: the remote control drives everything', async () => {
  const { page, ctx } = await open('/display.html#today');
  await page.keyboard.press('ArrowRight');
  assert.equal(await visibleMode(page), 'energy');
  assert.equal(await page.evaluate(() => location.hash), '#energy');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await visibleMode(page), 'night');
  await page.keyboard.press('3');
  assert.equal(await visibleMode(page), 'travel');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.body.classList.contains('chrome-on')), true);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mode), 'travel');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
  assert.ok(parseFloat(ring) >= 3, 'focus ring is obvious');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mode), 'screensaver');
  await page.keyboard.press('Enter');
  assert.equal(await visibleMode(page), 'screensaver');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'setBtn');
  await page.keyboard.press('Enter');
  assert.equal(await page.isVisible('#sheet'), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fMode');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fRotate');
  await page.keyboard.press('ArrowDown');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'fRotate');
  await page.keyboard.press('Backspace');                // Back, not in a text box
  assert.equal(await page.isVisible('#sheet'), false);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.body.classList.contains('chrome-on')), false);
  await ctx.close();
});

test('display: screensaver after idle minutes, woken by any key', async () => {
  const { page, ctx } = await open('/display.html#travel');
  await page.clock.fastForward('16:00');
  await page.waitForTimeout(300);
  assert.equal(await visibleMode(page), 'screensaver');
  assert.equal(await page.evaluate(() => location.hash), '#travel', 'the link still names the chosen mode');
  await page.waitForTimeout(1500);
  assert.match(await page.textContent('#hPrice'), /p$/, 'the dashboard shows the price');
  assert.ok(await page.$$eval('#cBoards .board', els => els.length) >= 1, 'billboards are flying past');
  await shot(page, 'tv-screensaver-idle');
  await page.keyboard.press('ArrowDown');
  assert.equal(await visibleMode(page), 'travel', 'the key only wakes it');
  await ctx.close();
});

test('display: night clock takes over in the evening and dims', async () => {
  const { page, ctx } = await open('/display.html#home', { at: LATE });
  await page.clock.fastForward('03:00');
  await page.waitForTimeout(300);
  assert.equal(await visibleMode(page), 'night');
  assert.equal(await page.evaluate(() => document.body.classList.contains('night')), true);
  assert.match(await page.textContent('.night-clock'), /^23:1\d$/);
  await shot(page, 'tv-night-auto');
  await page.keyboard.press('Enter');
  assert.equal(await visibleMode(page), 'today', 'an old #home link opens Today');
  await ctx.close();
});

test('display: a setup link copies settings to this device', async () => {
  const s = { trainFrom: 'MAN', tramStop: 'Piccadilly', rotate: 5, region: 'C' };
  const code = Buffer.from(JSON.stringify(s)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const { page, ctx } = await open('/display.html#setup=' + code, { settings: null });
  const saved = await page.evaluate(() => [JSON.parse(localStorage.getItem('hse.display')), localStorage.getItem('hse.region'), location.hash]);
  assert.equal(saved[0].trainFrom, 'MAN');
  assert.equal(saved[0].rotate, 5);
  assert.equal(saved[1], 'C');
  assert.equal(saved[2], '#screensaver', 'opens on the household default, the cockpit');
  assert.match(await page.textContent('#toast'), /Settings saved/);
  await ctx.close();
});

const PAGES = [['index', 'Now'], ['money', 'Money'], ['usage', 'Usage'], ['home', 'Home'], ['screen', 'Screen'], ['settings', 'Settings']];
test('dashboard: every page works on a phone, a tablet and a laptop, with example data labelled', async () => {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('build the dashboard first: npm run build');
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 900]]) {
    const { page, ctx, errors } = await open('/index.html', { width, height, settings: null, withHelper: false });
    for (const [id, label] of PAGES) {
      if (id !== 'index') await page.goto(`${base}/${id}.html`);
      await page.waitForFunction(() => /Example data/.test((document.getElementById('status') || {}).textContent || ''));
      await page.waitForTimeout(300);
      assert.equal((await page.textContent('.nav [aria-current="page"]')).trim(), label);
      const l = await layout(page);
      assert.ok(l.sw <= l.iw, `${id} at ${width}: scrolls sideways (${l.wide})`);
      if (id === 'index') assert.ok(await page.locator('.banner', { hasText: 'example data' }).count() > 0, 'example figures are labelled');
      await shot(page, `dashboard-${width}-${id}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('dashboard: the old pages send you to their new homes', async () => {
  const { page, ctx } = await open('/patterns.html', { settings: null, withHelper: false });
  for (const [old, now] of [['patterns', 'usage'], ['prices', 'index'], ['compare', 'home']]) {
    await page.goto(`${base}/${old}.html`);
    await page.waitForURL(new RegExp(`/${now}\\.html$`));
  }
  await ctx.close();
});

// Astro islands start once their scripts load: wait for every one before touching its controls.
const ready = page => page.waitForFunction(() => document.querySelectorAll('astro-island').length > 0 && !document.querySelector('astro-island[ssr]'));

test('dashboard: the controls work', async () => {
  const { page, ctx, errors } = await open('/usage.html', { settings: null, withHelper: false });
  await page.waitForFunction(() => /Example data/.test(document.getElementById('status').textContent)); await ready(page);
  // Usage: the period and the units, and reading a day with the arrow keys
  await page.click('[aria-label="Period"] >> text=7 days');
  await page.waitForFunction(() => document.querySelector('.chart svg') && document.querySelector('.chart svg').querySelectorAll('rect.bar-e').length === 7);
  await page.click('[aria-label="Show"] >> text=kWh');
  const before = await page.textContent('.readout');
  assert.match(before, /kWh/);
  await page.locator('.chart').first().focus(); await page.keyboard.press('ArrowLeft');
  assert.notEqual(await page.textContent('.readout'), before, 'arrow keys read another day');
  // the period is kept for the next visit
  await page.goto(`${base}/usage.html`); await ready(page);
  await page.waitForFunction(() => document.querySelector('[aria-label="Period"] [aria-pressed="true"]'));
  assert.equal(await page.textContent('[aria-label="Period"] [aria-pressed="true"]'), '7 days');
  // Home: a change, marked on the Usage chart
  await page.goto(`${base}/home.html`); await ready(page);
  await page.fill('#clDate', '2026-10-01'); await page.fill('#clText', 'Loft insulation topped up'); await page.click('#changes button[type=submit]');
  await page.waitForSelector('text=Loft insulation topped up');
  await page.goto(`${base}/usage.html`);
  await page.waitForFunction(() => document.querySelector('.chart .mark'));
  // Home: upgrades show an answer before anything is touched, and the comparison feeds the battery's tariffs
  await page.goto(`${base}/home.html`); await ready(page);
  assert.ok(await page.locator('#battery .stat .v', { hasText: '£' }).count() >= 2, 'the battery card shows a saving and a cost');
  await page.click('#tariffs summary');
  await page.waitForSelector('#tariffs tr.best');   // the comparison runs by itself, once a week
  assert.match(await page.textContent('#tariffs .line'), /would be the cheapest|already the cheapest/);
  await page.click('#battery summary');
  assert.ok(await page.locator('#bTariff option').count() >= 3, 'the battery offers the compared tariffs');
  await page.fill('#bCap', '10'); await page.fill('#bCost', '2000');
  await page.waitForFunction(() => /£2,000/.test(document.querySelector('#battery .stats').textContent));
  await page.click('#insulation summary'); await page.uncheck('#m-loft');
  await page.waitForSelector('#insulation >> text=What you ticked');
  // Settings: an appliance's kWh and the three that lead Now, the region, the corners
  await page.goto(`${base}/settings.html`); await ready(page);
  await page.fill('#kwh-kettle', '3'); await page.locator('#kwh-kettle').dispatchEvent('change');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hse.acts') || '{}').kettle), 3);
  await page.check('#lead-kettle');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hse.leadActs'))), ['dish', 'dryer', 'kettle'], 'three lead, the newest replacing the oldest');
  await page.waitForSelector('#region');
  await page.click('#look >> text=Sharp');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.corners), 'sharp');
  await page.goto(`${base}/index.html`); await ready(page);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.corners), 'sharp', 'the corners stay on the next page');
  assert.ok(await page.locator('text=Kettle, full boil').count() > 0, 'Now leads with the chosen appliances');
  // Settings: the household's bins and station stay on this device, and only what changed is kept
  await page.goto(`${base}/settings.html`); await ready(page);
  await page.waitForSelector('#hWalk');
  await page.fill('#hWalk', '9'); await page.click('#household >> text=Save');
  await page.waitForSelector('#household >> text=Saved on this device');
  const mine = await page.evaluate(() => JSON.parse(localStorage.getItem('hse.display')));
  assert.equal(mine.trainWalk, 9);
  assert.equal(mine.bins, undefined, 'the bins stay as household.json has them');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('dashboard: Now leads with what to act on soon', async () => {
  const { page, ctx, errors } = await open('/index.html', { settings: SETTINGS, withHelper: false });
  await page.waitForSelector('.heads');
  assert.match(await page.textContent('.heads'), /Leave in 1[01] min/, 'the 14:27 to London Euston, expected 14:33, with a 12 minute walk');
  assert.match(await page.textContent('.heads'), /London Euston, expected 14:33/);
  assert.match(await page.textContent('.heads'), /Flood alert\s*River Goyt at Marple Bridge/);
  assert.match(await page.textContent('.heads'), /Rain from 15:00/);
  assert.match(await page.locator('.card', { hasText: 'Right now' }).textContent(), /55% wind/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ntfy.sh, faked: each stream delivers the given messages, and what's sent is kept.
async function relay(page, deliver){
  const sent = [];
  await page.route(/^https:\/\/ntfy\.sh\//, async r => {
    const req = r.request();
    if (req.method() === 'POST'){ sent.push({ topic: new URL(req.url()).pathname.slice(1), msg: JSON.parse(req.postData() || '{}') }); return r.fulfill({ json: { event: 'message' } }); }
    const body = deliver().map(m => 'data: ' + JSON.stringify({ event: 'message', message: JSON.stringify(m) }) + '\n\n').join('');
    return r.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'retry: 60000\n\n' + body });
  });
  return sent;
}

test('display: the phone can change what the TV shows', async () => {
  const { page, ctx, errors } = await open('/display.html#today', { clock: false });
  const sent = await relay(page, () => [{ from: 'phone', cmd: 'mode', mode: 'travel' }, { from: 'phone', cmd: 'mode', mode: 'nonsense' }, { from: 'someone', cmd: 'mode', mode: 'night' }]);
  await page.reload();
  await page.waitForFunction(() => { const s = [...document.querySelectorAll('.mode')].find(x => !x.hidden); return s && s.dataset.mode === 'travel'; }, null, { timeout: 8000 });
  assert.match(await page.textContent('#toast'), /from your phone/);
  const code = await page.evaluate(() => localStorage.getItem('hse.remote'));
  assert.match(code, /^[A-Z2-9]{8}$/);
  await page.waitForTimeout(500);
  const state = sent.filter(s => s.msg.from === 'screen').pop();
  assert.equal(state.topic, 'hse-screen-' + code.toLowerCase());
  assert.equal(state.msg.state.shown, 'travel', 'the screen tells the phone what it shows');
  await page.keyboard.press('s');
  assert.equal((await page.textContent('#pairCode')).replace('-', ''), code, 'settings show the code to type on the phone');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('dashboard: the Screen page shows the wall display and drives the paired TV', async () => {
  const { page, ctx, errors } = await open('/screen.html', { settings: SETTINGS, withHelper: false, clock: false });
  const sent = await relay(page, () => [{ from: 'screen', state: { mode: 'today', shown: 'energy', at: Date.now() } }]);
  await page.reload(); await ready(page);
  await page.waitForSelector('.tv iframe');
  assert.match(await page.getAttribute('.tv iframe', 'src'), /display\.html#today&embed=1/);
  await page.fill('#pairCode', 'abcd efg'); await page.click('#pair button[type=submit]');
  await page.waitForSelector('text=That isn\'t a code');
  await page.fill('#pairCode', 'abcd-efgh'); await page.click('#pair button[type=submit]');
  await page.waitForSelector('text=Showing Energy');
  assert.equal(await page.evaluate(() => localStorage.getItem('hse.remoteTV')), 'ABCDEFGH');
  for (let i = 0; i < 30 && !sent.some(s => s.msg.cmd === 'hello'); i++) await page.waitForTimeout(100);
  assert.ok(sent.some(s => s.topic === 'hse-screen-abcdefgh' && s.msg.cmd === 'hello'), 'asks the TV what it shows');
  await page.click('.modes >> text=Travel');
  await page.waitForFunction(() => /#travel&embed=1/.test(document.querySelector('.tv iframe').src));
  for (let i = 0; i < 30 && !sent.some(s => s.msg.cmd === 'mode'); i++) await page.waitForTimeout(100);
  assert.ok(sent.some(s => s.msg.cmd === 'mode' && s.msg.mode === 'travel'), 'tells the TV to show Travel');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('dashboard: the account is fetched once, then each page reads it from the cache', async () => {
  const { page, ctx, errors } = await open('/index.html', { account: true });
  await page.waitForFunction(() => /Updated/.test(document.getElementById('status').textContent));
  await page.waitForTimeout(500);
  const first = accountCalls;
  assert.ok(first > 0, 'the account was fetched');
  for (const id of ['money', 'usage', 'home', 'settings', 'index']) {
    await page.goto(`${base}/${id}.html`);
    await page.waitForFunction(() => /Updated/.test(document.getElementById('status').textContent));
  }
  assert.equal(accountCalls, first, 'no page fetched the account again');
  await page.goto(`${base}/settings.html`);
  await page.waitForSelector('#account >> text=A-TEST1234');
  await page.click('[aria-label="Refresh"]');
  await page.waitForFunction(() => /Updated/.test(document.getElementById('status').textContent));
  await page.waitForTimeout(300);
  assert.ok(accountCalls > first, 'Refresh fetches it afresh');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('cockpit: every kind of weather and power price draws without errors', async () => {
  const all = ['', '&wx=clear&phase=day', '&wx=rain&phase=night', '&wx=snow', '&wx=fog', '&wx=thunder&phase=night', '&wx=wind&phase=dusk', '&wx=cold&phase=dawn', '&price=-3', '&price=34&wx=cloud'];
  // LOOKS=rain,price=-3 picks a few, for quick screenshots.
  const looks = process.env.LOOKS ? all.filter(l => process.env.LOOKS.split(',').some(k => l.includes(k))) : all;
  for (const [width, height] of [[1920, 1080], [390, 844]]) {
    const { page, ctx, errors } = await open('/display.html#screensaver', { width, height });
    for (const look of looks) {
      await page.evaluate(h => { location.hash = h; }, 'screensaver' + look);
      await page.waitForTimeout(200);
      for (let i = 0; i < (process.env.SHOTS ? 40 : 12); i++) { await page.clock.runFor(1000); }
      await page.waitForTimeout(300);
      assert.equal(await visibleMode(page), 'screensaver');
      const l = await layout(page);
      assert.ok(l.sw <= l.iw, `${look}: scrolls sideways at ${width}`);
      await shot(page, `cockpit-${width}${look.replace(/[&=]/g, '-') || '-now'}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// The road ahead and the cabin's instruments, with an account connected: your train stops, the dials read.
test('cockpit shows your train and the instruments', async () => {
  const { page, ctx, errors } = await open('/display.html#screensaver&show=mytrain', { account: true });
  await page.clock.runFor(1500);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({
    mine: (document.querySelector('.strain.mine') || {}).textContent || '',
    draw: document.getElementById('iDraw').hasAttribute('data-off'), drawV: document.getElementById('iDrawV').textContent,
    cost: document.getElementById('iCost').textContent, air: document.getElementById('iAirV').textContent
  }));
  assert.match(r.mine, /Your train/);
  assert.match(r.mine, /Leave in \d+ min|Leave now|Run for it/);
  assert.match(r.mine, /Platform/);
  assert.equal(r.draw, false);
  assert.match(r.drawV, /^\d[\d,]* W$/);
  assert.match(r.cost, /£\d+\.\d\d/);
  assert.ok(r.air.length > 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// BENCH=1: frames a second and where the time goes, with the CPU slowed down like a TV's (BENCH_CPU, default 6).
test('cockpit frame budget', { skip: !process.env.BENCH }, async () => {
  const rate = +(process.env.BENCH_CPU || 6), look = process.env.BENCH_LOOK || 'phase=night';
  const { page, ctx } = await open('/display.html#screensaver&' + look, { account: true, clock: false });
  const cdp = await ctx.newCDPSession(page);
  await page.waitForTimeout(3000);                                  // let the nebulae finish growing
  if (process.env.BENCH_EVAL) await page.evaluate(process.env.BENCH_EVAL);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  const fps = await page.evaluate(() => new Promise(done => {
    let n = 0, worst = 0, last = performance.now(); const t0 = last;
    const tick = t => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(tick); else done({ fps: n / ((t - t0) / 1000), worst: Math.round(worst) }); };
    requestAnimationFrame(tick);
  }));
  const { profile } = await cdp.send('Profiler.stop');

  const self = {}, dt = (profile.endTime - profile.startTime) / 1000 / Math.max(1, profile.samples.length);
  profile.nodes.forEach(n => { const k = (n.callFrame.functionName || '(anon)') + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (n.hitCount || 0) * dt; });
  const total = Object.values(self).reduce((a, b) => a + b, 0);
  console.log(`cpu x${rate} ${look}: ${fps.fps.toFixed(1)} fps, worst frame ${fps.worst} ms`);
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`${(v / total * 100).toFixed(1).padStart(5)}%  ${k}`));
  await ctx.close();
});

// PAGES=index,money,usage,home,settings (with SHOTS=1): each page of the app, whole, on a phone and a laptop, connected (ACCOUNT=1) or not.
test('page shots', { skip: !process.env.PAGES }, async () => {
  for (const [width, height] of [[390, 844], [1280, 900]]) {
    const { page, ctx, errors } = await open('/index.html', { width, height, settings: null, account: !!process.env.ACCOUNT });
    for (const id of process.env.PAGES.split(',')) {
      await page.goto(`${base}/${id}.html`);
      await page.waitForTimeout(1200);
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `page-${id}-${width}${process.env.ACCOUNT ? '-account' : ''}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// GALLERY=1 SHOTS=1: one screenshot per scene, for looking at the window by eye (skipped otherwise).
test('cockpit gallery', { skip: !process.env.GALLERY }, async () => {
  const looks = (process.env.GALLERY_LOOKS || [
    'phase=night&show=train', 'wx=clear&phase=day&show=house', 'phase=dusk&show=whales', 'wx=rain&phase=night&show=jellies',
    'wx=snow&show=birds', 'price=-3&phase=night&show=aurora,comet', 'wx=thunder&phase=night&show=iss,moon', 'wx=fog&show=flyby', 'phase=dawn&wx=cold&show=house'
  ].join('|')).split('|');
  const sizes = process.env.GALLERY_SIZES ? process.env.GALLERY_SIZES.split(',').map(s => s.split('x').map(Number)) : [[1920, 1080], [390, 844]];
  for (const [width, height] of sizes) {
    if (width < 500 && !process.env.GALLERY_PHONE) continue;
    for (const look of looks) {
      const { page, ctx, errors } = await open('/display.html#screensaver&' + look, { width, height, account: true });
      // a few whole days already seen, so the fuel gauge has a usual day to measure against
      await page.addInitScript(() => { try { localStorage.setItem('hse.costs', JSON.stringify({ '2026-10-01': { p: 310, late: true }, '2026-10-02': { p: 280, late: true }, '2026-10-03': { p: 345, late: true }, '2026-10-04': { p: 300, late: true } })); } catch (e) {} });
      await page.reload();
      await page.clock.runFor(1500);
      await page.evaluate(() => document.body.classList.remove('chrome-on'));
      await page.waitForTimeout(400);
      await shot(page, `gallery-${width}-${look.replace(/[&=,]/g, '-')}`);
      assert.deepEqual(errors, [], look);
      await ctx.close();
    }
  }
});
