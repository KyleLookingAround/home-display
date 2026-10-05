// Pure parts of the household display: modes, bins, calendar, departures, unattended-screen care.
// Usage: node --test tests/*.test.mjs
process.env.TZ = 'Europe/London';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const src = ['src/core.js', 'src/analysis.js', 'src/display/sources.js'].map(read).join('\n');
const ctx = vm.createContext({ console, btoa, Intl, fetch: () => Promise.reject(new Error('offline')), location: { protocol: 'file:' } });
const names = 'MODES stepMode modeFromHash hashOptions inWindow displaySettings mergeSettings deviceChanges nextCollections councilBins parseICal calendarWindow icalDate zonedTime calendarUrl parseTrains parseTrams parseHuxley boardTime leaveBy todayCost nextReload isStale parseWeather weatherText relDay skyFor engineFor buildBillboards billboardRotation NET';
vm.runInContext(src + `\n;globalThis.__api = { ${names.split(' ').join(', ')} };`, ctx);
const A = ctx.__api;
const at = s => +new Date(s);
const plain = v => JSON.parse(JSON.stringify(v));

test('modes come from the link and wrap round with left and right', () => {
  assert.equal(A.modeFromHash('#home', 'energy'), 'home');
  assert.equal(A.modeFromHash('#TRAVEL', 'energy'), 'travel');
  assert.equal(A.modeFromHash('#nonsense', 'energy'), 'energy');
  assert.equal(A.modeFromHash('', 'night'), 'night');
  assert.equal(A.stepMode('energy', -1), 'night');
  assert.equal(A.stepMode('night', 1), 'energy');
  assert.equal(A.stepMode('home', 1), 'travel');
});

test('night window works across midnight', () => {
  assert.equal(A.inWindow(at('2026-10-05T23:30:00'), '23:00', '06:30'), true);
  assert.equal(A.inWindow(at('2026-10-06T06:29:00'), '23:00', '06:30'), true);
  assert.equal(A.inWindow(at('2026-10-06T06:30:00'), '23:00', '06:30'), false);
  assert.equal(A.inWindow(at('2026-10-05T12:00:00'), '23:00', '06:30'), false);
  assert.equal(A.inWindow(at('2026-10-05T13:00:00'), '12:00', '14:00'), true);
  assert.equal(A.inWindow(at('2026-10-05T13:00:00'), '12:00', '12:00'), false);
});

test('settings keep defaults and drop half-filled bins', () => {
  const s = A.displaySettings({ rotate: 5, bins: [{ name: 'Black', date: '2026-10-08', every: 2 }, { name: '', date: '2026-10-08' }, { name: 'Blue', date: 'soon' }] });
  assert.equal(s.rotate, 5);
  assert.equal(s.mode, 'screensaver');                                 // new screens open on the cockpit
  assert.equal(s.bins.length, 1);
  assert.equal(A.displaySettings(null).trainFrom, 'SPT');
});

test('bins roll forward from a known collection date', () => {
  const now = at('2026-10-05T09:00:00'); // a Monday
  const b = plain(A.nextCollections([
    { name: 'Black', colour: 'black', date: '2026-09-03', every: 2 },  // Thursdays, fortnightly: 3 Sep, 17 Sep, 1 Oct, 15 Oct
    { name: 'Blue', colour: 'blue', date: '2026-09-10', every: 2 },    // 10 Sep, 24 Sep, 8 Oct
    { name: 'Glass', colour: 'green', date: '2026-10-05', every: 4 },  // today
    { name: 'Garden', colour: 'brown', date: '2026-11-02', every: 1 }  // first one still to come
  ], now));
  assert.deepEqual(b.map(x => [x.name, x.days]), [['Glass', 0], ['Blue', 3], ['Black', 10], ['Garden', 28]]);
});

const ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:a', 'DTSTART;TZID=Europe/London:20261006T101500', 'DTEND;TZID=Europe/London:20261006T110000', 'SUMMARY:Dentist\\, Stockport', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'DTSTART;VALUE=DATE:20261009', 'DTEND;VALUE=DATE:20261010', 'SUMMARY:Grandparents visit', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', 'DTSTART:20261007T160000Z', 'DURATION:PT1H30M', 'SUMMARY:Football', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:d', 'DTSTART;TZID=Europe/London:20260901T190000', 'DTEND;TZID=Europe/London:20260901T200000', 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH', 'EXDATE;TZID=Europe/London:20261008T190000', 'SUMMARY:Swimming', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:e', 'DTSTART;TZID=Europe/London:20260101T090000', 'DTEND;TZID=Europe/London:20260101T093000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU', 'SUMMARY:Book club', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:f', 'DTSTART:20260101T080000Z', 'DTEND:20260101T083000Z', 'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:Old daily', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:g', 'DTSTART;TZID=Europe/London:20261005T180000', 'DTEND;TZID=Europe/London:20261005T183000', 'RRULE:FREQ=DAILY;UNTIL=20261007T230000Z', 'SUMMARY:Tea', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:g', 'RECURRENCE-ID;TZID=Europe/London:20261006T180000', 'DTSTART;TZID=Europe/London:20261006T190000', 'DTEND;TZID=Europe/London:20261006T193000', 'SUMMARY:Tea (late)', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:h', 'DTSTART:20261006T120000Z', 'DTEND:20261006T130000Z', 'STATUS:CANCELLED', 'SUMMARY:Called off', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:i', 'DTSTART;TZID=America/New_York:20261006T090000', 'DTEND;TZID=America/New_York:20261006T100000', 'SUMMARY:Call with', ' New York', 'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

test('iCal: times, all-day events, folding and escapes', () => {
  const ev = A.parseICal(ICS);
  const by = t => ev.find(e => e.title === t);
  assert.equal(by('Dentist, Stockport').start, at('2026-10-06T10:15:00+01:00'));
  assert.equal(by('Grandparents visit').allDay, true);
  assert.equal(by('Football').dur, 90 * 60e3);
  assert.equal(by('Call withNew York').start, at('2026-10-06T13:00:00Z'));
  assert.ok(!ev.some(e => e.title === 'Called off'));
});

test('iCal: recurring events expand, skip exceptions and honour moves', () => {
  const from = at('2026-10-05T00:00:00'), to = at('2026-10-13T00:00:00');
  const w = plain(A.calendarWindow(A.parseICal(ICS), from, to));
  const starts = t => w.filter(e => e.title === t).map(e => new Date(e.start).toISOString());
  assert.deepEqual(starts('Swimming'), ['2026-10-06T18:00:00.000Z']);           // Thu 8th is excluded; Tue 13th is outside
  assert.deepEqual(starts('Book club'), []);                                    // 2nd Tuesday is the 13th
  assert.deepEqual(starts('Old daily'), []);                                    // ran out after 3
  assert.deepEqual(starts('Tea'), ['2026-10-05T17:00:00.000Z', '2026-10-07T17:00:00.000Z']);
  assert.deepEqual(starts('Tea (late)'), ['2026-10-06T18:00:00.000Z']);
  const nov = plain(A.calendarWindow(A.parseICal(ICS), at('2026-11-01T00:00:00'), at('2026-11-30T00:00:00')));
  assert.deepEqual(nov.filter(e => e.title === 'Book club').map(e => new Date(e.start).toISOString()), ['2026-11-10T09:00:00.000Z']);
  assert.ok(w.every((e, i) => !i || w[i - 1].start <= e.start));
});

test('iCal addresses for Google go through the helper only when it is there', () => {
  const g = 'webcal://calendar.google.com/calendar/ical/abc%40group/private-123/basic.ics';
  A.NET.proxy = false;
  assert.equal(A.calendarUrl(g), 'https://calendar.google.com/calendar/ical/abc%40group/private-123/basic.ics');
  A.NET.proxy = true;
  assert.equal(A.calendarUrl(g), './proxy/gcal/calendar/ical/abc%40group/private-123/basic.ics');
  assert.equal(A.calendarUrl('https://example.org/cal.ics'), 'https://example.org/cal.ics');
  A.NET.proxy = false;
});

test('trains: realtime times, cancellations and platforms from the RTT shape', () => {
  const svc = (sched, extra = {}, dest = 'Manchester Piccadilly') => ({
    temporalData: { departure: Object.assign({ scheduleAdvertised: sched }, extra.dep || {}), displayAs: extra.displayAs || 'CALL' },
    locationMetadata: { platform: { planned: '3', actual: extra.plat || null } },
    destination: [{ location: { description: dest } }],
    scheduleMetadata: { operator: { name: 'Northern' }, modeType: 'TRAIN' }
  });
  const list = plain(A.parseTrains({ services: [
    svc('2026-10-05T14:20:00+01:00', { dep: { realtimeForecast: '2026-10-05T14:24:00+01:00' } }, 'Buxton'),
    svc('2026-10-05T14:10:00+01:00', { plat: '4' }),
    svc('2026-10-05T14:15:00+01:00', { dep: { isCancelled: true } }, 'Hazel Grove'),
    { temporalData: {} }
  ] }));
  assert.deepEqual(list.map(d => d.dest), ['Manchester Piccadilly', 'Hazel Grove', 'Buxton']);
  assert.equal(list[0].platform, '4');
  assert.equal(list[1].cancelled, true);
  assert.equal(list[2].exp - list[2].sched, 4 * 60e3);
  assert.deepEqual(plain(A.parseTrains({})), []);
});

test('trams: one stop, both platforms, soonest first', () => {
  const now = at('2026-10-05T14:00:00');
  const j = { value: [
    { StationLocation: 'East Didsbury', Direction: 'Outgoing', Dest0: 'Rochdale Town Centre', Wait0: '7', Status0: 'Due', Dest1: 'Shaw and Crompton', Wait1: '15', MessageBoard: '<no message>' },
    { StationLocation: 'East Didsbury', Direction: 'Incoming', Dest0: 'Terminates Here', Wait0: '2', MessageBoard: 'Engineering works on Sunday' },
    { StationLocation: 'Didsbury Village', Dest0: 'Rochdale Town Centre', Wait0: '1' }
  ] };
  const r = plain(A.parseTrams(j, 'east didsbury', now));
  assert.deepEqual(r.trams.map(t => t.wait), [7, 15]);                    // 'Terminates Here' isn't a tram you can catch
  assert.deepEqual(r.messages, ['Engineering works on Sunday']);
  assert.equal(r.trams[0].at, now + 7 * 60e3);
});

test('leave-by countdowns', () => {
  const now = at('2026-10-05T14:00:00'), dep = m => now + m * 60e3;
  assert.equal(A.leaveBy(dep(25), 15, now).text, 'Leave in 10 min');
  assert.equal(A.leaveBy(dep(25), 15, now).cls, 'good');
  assert.equal(A.leaveBy(dep(16), 15, now).text, 'Leave now');
  assert.equal(A.leaveBy(dep(14), 15, now).text, 'Run for it');
  assert.equal(A.leaveBy(dep(5), 15, now).text, 'Too late');
});

test('today\'s cost prices each half hour and adds the standing charge', () => {
  const day = at('2026-10-05T00:00:00');
  const eSets = [{ twoRate: false, unit: [{ from: 0, to: day + 7 * 3600e3, p: 10 }, { from: day + 7 * 3600e3, to: Infinity, p: 30 }], sc: [{ from: 0, to: Infinity, p: 50 }], aFrom: 0, aTo: Infinity }];
  const rows = [{ t: day + 3600e3, v: 1 }, { t: day + 8 * 3600e3, v: 0.5 }];
  assert.equal(A.todayCost(rows, eSets, day + 9 * 3600e3), 10 + 15 + 50);
  assert.equal(A.todayCost([], eSets), null);
  assert.equal(A.todayCost(rows, null), null);
});

test('nightly fresh start lands on the next set time', () => {
  assert.equal(A.nextReload(at('2026-10-05T14:00:00'), '03:30', 0), at('2026-10-06T03:30:00'));
  assert.equal(A.nextReload(at('2026-10-05T02:00:00'), '03:30', 0), at('2026-10-05T03:30:00'));
  assert.equal(A.nextReload(at('2026-10-05T03:30:00'), '03:30', 4), at('2026-10-06T03:34:00'));
});

test('stale data is flagged after two refresh periods', () => {
  const now = at('2026-10-05T14:00:00');
  assert.equal(A.isStale({ at: 0 }, 60e3, now), true);
  assert.equal(A.isStale({ at: now - 4 * 60e3 }, 60e3, now), false);   // five-minute floor
  assert.equal(A.isStale({ at: now - 6 * 60e3 }, 60e3, now), true);
  assert.equal(A.isStale({ at: now - 20 * 60e3 }, 15 * 60e3, now), false);
  assert.equal(A.isStale({ at: now - 31 * 60e3 }, 15 * 60e3, now), true);
});

test('weather: the next twelve hours from now', () => {
  const now = at('2026-10-05T14:20:00');
  const time = [], temperature_2m = [], precipitation_probability = [], weather_code = [];
  for (let h = 0; h < 48; h++){ const d = new Date(at('2026-10-05T00:00:00') + h * 3600e3); time.push(`${d.getFullYear()}-10-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`); temperature_2m.push(10 + h % 5); precipitation_probability.push(h); weather_code.push(61); }
  const w = plain(A.parseWeather({ current: { temperature_2m: 13.4, apparent_temperature: 11, weather_code: 3, wind_speed_10m: 9 }, hourly: { time, temperature_2m, precipitation_probability, weather_code },
    daily: { time: ['2026-10-05'], sunrise: ['2026-10-05T07:12'], sunset: ['2026-10-05T18:33'], temperature_2m_max: [15], temperature_2m_min: [8] } }, now));
  assert.equal(w.hours.length, 12);
  assert.equal(w.hours[0].t, at('2026-10-05T14:00:00'));
  assert.equal(w.days[0].rise, at('2026-10-05T07:12:00'));
  assert.equal(A.weatherText(61).text, 'Rain');
  assert.equal(A.weatherText(1234).text, '—');
});

test('bins from Stockport Council: the saved page parses, and old or missing feeds fall back', async () => {
  const { parseStockportBins } = await import('../scripts/bins.mjs');
  const bins = parseStockportBins(read('tests/fixtures/stockport-bins.html'));
  assert.deepEqual(bins.map(b => [b.name, b.colour, b.date]), [['Blue bin', 'blue', '2026-10-08'], ['Brown bin', 'brown', '2026-10-08'], ['Green bin', 'green', '2026-10-08'], ['Black bin', 'black', '2026-10-15']]);
  assert.equal(bins[0].what, 'Paper, cardboard and cartons');
  assert.deepEqual(parseStockportBins('<html>nothing here</html>'), []);
  const feed = { source: 'Stockport Council', fetched: '2026-10-05T04:17:00Z', bins };
  const now = at('2026-10-05T09:00:00');
  assert.equal(A.councilBins(feed, now).length, 4);
  assert.deepEqual(plain(A.nextCollections(A.councilBins(feed, now), now)).map(b => [b.name, b.days]), [['Blue bin', 3], ['Brown bin', 3], ['Green bin', 3], ['Black bin', 10]]);
  // A single date drops off once it has passed: Thursday's three go, leaving the black bin.
  assert.deepEqual(plain(A.nextCollections(A.councilBins(feed, at('2026-10-09T03:00:00')), at('2026-10-09T03:00:00'))).map(b => b.name), ['Black bin']);
  assert.equal(A.councilBins(feed, at('2026-10-12T09:00:00')), null, 'a feed more than four days old is ignored');
  assert.equal(A.councilBins(null, now), null);
});

test('links can carry cockpit previews after the mode', () => {
  assert.equal(A.modeFromHash('#screensaver&wx=rain&phase=night', 'energy'), 'screensaver');
  assert.deepEqual(plain(A.hashOptions('#screensaver&wx=rain&price=-2')), { wx: 'rain', price: '-2' });
  assert.deepEqual(plain(A.hashOptions('#home')), {});
});

test('trains from Huxley2: board times, delays, cancellations, just after midnight', () => {
  const now = at('2026-10-05T23:50:00');
  assert.equal(A.boardTime('00:10', now), at('2026-10-06T00:10:00'));
  assert.equal(A.boardTime('23:40', now), at('2026-10-05T23:40:00'));
  assert.equal(A.boardTime('23:58', at('2026-10-06T00:05:00')), at('2026-10-05T23:58:00'));
  const svc = (std, etd, dest, extra = {}) => Object.assign({ std, etd, platform: '2', operator: 'Northern', isCancelled: false, destination: [{ locationName: dest, via: null }] }, extra);
  const r = plain(A.parseHuxley({ locationName: 'Stockport', nrccMessages: [{ value: '<p>Disruption at <a href="x">Crewe</a></p>' }], trainServices: [
    svc('23:55', 'On time', 'Manchester Piccadilly'), svc('00:15', '00:21', 'Crewe'), svc('23:58', 'Delayed', 'Buxton'), svc('00:05', 'Cancelled', 'Hazel Grove', { isCancelled: true, cancelReason: 'a fault' }) ] }, now));
  assert.equal(r.station, 'Stockport');
  assert.deepEqual(r.messages, ['Disruption at Crewe']);
  assert.deepEqual(r.list.map(d => d.dest), ['Manchester Piccadilly', 'Buxton', 'Hazel Grove', 'Crewe']);
  assert.equal(r.list[0].exp, r.list[0].sched);
  assert.equal(r.list[1].delayed, true);
  assert.equal(r.list[2].cancelled, true);
  assert.equal(r.list[3].exp - r.list[3].sched, 6 * 60e3);
  assert.deepEqual(plain(A.parseHuxley({})).list, []);
});

test('household settings reach every screen, and a screen keeps only its own changes', () => {
  const house = { bins: [{ name: 'Black', date: '2026-10-08', every: 2 }], trainFrom: 'SPT', trainWalk: 12, ical: 'https://secret' };
  const s = A.mergeSettings(house, null);
  assert.equal(s.trainWalk, 12);
  assert.equal(s.bins.length, 1);
  assert.equal(s.ical, '', 'a calendar address never comes from the public file');
  const mine = A.mergeSettings(house, { trainWalk: 5 });
  assert.equal(mine.trainWalk, 5);
  assert.equal(mine.bins.length, 1);
  assert.deepEqual(plain(A.deviceChanges(Object.assign({}, s, { rotate: 5 }), house)), { rotate: 5 });
});

test('the sky outside follows the weather and the sun', () => {
  const day = at('2026-10-05T00:00:00');
  const W = (code, temp, wind, extra) => Object.assign({ now: { code, temp, wind }, days: [{ k: '2026-10-05', rise: day + 7.25 * 3600e3, set: day + 18.67 * 3600e3, max: 15, min: 8 }], hours: [] }, extra || {});
  const noon = day + 13 * 3600e3;
  assert.equal(A.skyFor(W(0, 14, 5), noon).phase, 'day');
  assert.equal(A.skyFor(W(0, 14, 5), noon).sun, 1);
  assert.equal(A.skyFor(W(0, 14, 5), day + 7.5 * 3600e3).phase, 'dawn');
  assert.equal(A.skyFor(W(0, 14, 5), day + 18.5 * 3600e3).phase, 'dusk');
  assert.equal(A.skyFor(W(0, 14, 5), day + 23 * 3600e3).phase, 'night');
  assert.equal(A.skyFor(W(0, 14, 5), day + 23 * 3600e3).sun, 0);
  assert.equal(A.skyFor(W(65, 9, 10), noon).rain, 1);
  assert.equal(A.skyFor(W(75, -3, 10), noon).snow, 1);
  assert.equal(A.skyFor(W(75, -3, 10), noon).cold, 1);
  assert.equal(A.skyFor(W(45, 6, 3), noon).fog, 1);
  assert.equal(A.skyFor(W(95, 16, 20), noon).thunder, 1);
  assert.ok(A.skyFor(W(2, 12, 40), noon).wind > .9);
  const soon = A.skyFor(W(2, 12, 5, { hours: [{ t: noon + 3600e3, rain: 20, code: 3 }, { t: noon + 2 * 3600e3, rain: 80, code: 61 }] }), noon);
  assert.equal(soon.rainSoon, noon + 2 * 3600e3);
  assert.equal(A.skyFor(null, noon, { wx: 'thunder', phase: 'night' }).thunder, 1);
  assert.equal(A.skyFor(null, noon, { wx: 'thunder', phase: 'night' }).phase, 'night');
});

test('the engines follow the power price', () => {
  assert.equal(A.engineFor(-2).mode, 'warp');
  assert.equal(A.engineFor(9).mode, 'fast');
  assert.equal(A.engineFor(20).mode, 'cruise');
  assert.equal(A.engineFor(31).mode, 'eco');
  assert.ok(A.engineFor(31).speed < A.engineFor(20).speed && A.engineFor(20).speed < A.engineFor(-2).speed);
  assert.equal(A.engineFor(null).mode, 'cruise');
  assert.equal(A.engineFor(20, 'very high').dust, .8);
});

test('billboards carry real data only, and urgent ones come round more often', () => {
  const now = at('2026-10-05T17:10:00'), s0 = at('2026-10-05T17:00:00');
  const agile = []; for (let i = -4; i < 20; i++) agile.push({ from: s0 + i * 1800e3, to: s0 + (i + 1) * 1800e3, p: i === 10 ? -3 : 20 + (i % 3) });
  const cards = A.buildBillboards({ agile, bins: [{ name: 'General waste', colour: 'black', date: '2026-10-06', every: 2 }], walk: 10,
    trains: { list: [{ sched: now + 18 * 60e3, exp: now + 18 * 60e3, dest: 'Manchester Piccadilly', platform: '1', cancelled: false }] } }, now);
  const ids = cards.map(c => c.id);
  assert.ok(ids.includes('price') && ids.includes('cheap') && ids.includes('plunge') && ids.includes('bins') && ids.includes('train') && ids.includes('date'));
  assert.ok(!ids.includes('wx') && !ids.includes('event0'), 'no weather or calendar billboards without data');
  const bins = cards.find(c => c.id === 'bins');
  assert.equal(bins.head, 'Bins tomorrow');
  assert.equal(bins.sub, 'Put them out tonight');
  assert.equal(bins.weight, 3);
  assert.equal(cards.find(c => c.id === 'train').big, 'Leave in 8 min');
  const rot = plain(A.billboardRotation(cards));
  assert.equal(rot.filter(c => c.id === 'bins').length, 3);
  assert.ok(rot.every((c, i) => !i || c.id !== rot[i - 1].id), 'never the same billboard twice running');
  assert.deepEqual(plain(A.buildBillboards({}, now)).map(c => c.id), ['date']);
});

// TV browsers from 2019-2021 run Chromium 63-79, which can't parse optional chaining or nullish coalescing.
test('the display\'s script runs on older TV browsers', () => {
  const html = read('display.html');
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``').replace(/'(?:\\.|[^'\\\n])*'/g, "''").replace(/"(?:\\.|[^"\\\n])*"/g, '""').replace(/\/\/[^\n]*/g, '');
  for (const [name, re] of [['optional chaining', /\?\.(?!\d)/], ['nullish coalescing', /\?\?/], ['flatMap', /\.flatMap\(/], ['Array.at', /\.at\(-?\d/], ['optional catch binding', /catch\s*\{/], ['Object.fromEntries', /fromEntries/], ['replaceAll', /\.replaceAll\(/]])
    assert.doesNotMatch(js, re, name);
});

test('built pages match the source', () => {
  const page = (head, body, scripts) => read(`src/${head}`) + read(`src/${body}`) + '<script>\n(() => {\n"use strict";\n' + scripts.map(f => read(`src/${f}`)).join('') + '\n})();\n</script>\n<script>\n' + read('src/starfield.js') + '</script>\n</body>\n</html>\n';
  assert.equal(read('index.html'), page('head.html', 'body.html', ['core.js', 'analysis.js', 'dom.js']), 'run python3 build.py');
  assert.equal(read('display.html'), page('display/head.html', 'display/body.html', ['core.js', 'analysis.js', 'display/sources.js', 'display/cockpit.js', 'display/display.js']), 'run python3 build.py');
});
