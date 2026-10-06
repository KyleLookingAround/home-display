// Pure parts of the household display: modes, bins, calendar, departures, unattended-screen care.
// Usage: node --test tests/*.test.mjs
process.env.TZ = 'Europe/London';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { shared } from './shared.mjs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const src = shared('format', 'browser', 'net', 'octopus', 'carbon', 'analysis', 'outdoors', 'household', 'remote', 'qr', 'voyage');
const ctx = vm.createContext({ console, btoa, Intl, fetch: () => Promise.reject(new Error('offline')), location: { protocol: 'file:' } });
const names = 'MODES ukDate parseUkDate countdowns countdownText wifiCode qrEncode newRemoteCode cleanCode showCode remoteTopic readRemote priceVerdict priceTone stepMode modeFromHash hashOptions inWindow displaySettings mergeSettings deviceChanges nextCollections councilBins parseBankHolidays parseNowcast rainSoon tileOf parseAir aqiLabel uvLabel pollenLabel parseFloods parseGridMix mergeBins parseICal calendarWindow icalDate zonedTime calendarUrl parseTrains parseTrams parseHuxley boardTime leaveBy catchable workDay officeDay cleanPlan commuteLeg commuteTrain arriveBy commuteLine trainsTitle trainWalkOf ordinal signStatus signExpected signGo signLine signTrains headsUp todayCost nextReload isStale parseWeather weatherText relDay skyFor engineFor buildBillboards billboardRotation moonPhase issPass kmBetween worldFor boardCards voyageFor shownAhead recordCost usualCost instrumentsFor wetKind NET';
vm.runInContext(src + `\n;globalThis.__api = { ${names.split(' ').join(', ')} };`, ctx);
const A = ctx.__api;
const at = s => +new Date(s);
const plain = v => JSON.parse(JSON.stringify(v));

test('modes come from the link and wrap round with left and right', () => {
  assert.equal(A.modeFromHash('#today', 'energy'), 'today');
  assert.equal(A.modeFromHash('#home', 'energy'), 'today', 'older links to Home open Today');
  assert.equal(A.modeFromHash('#TRAVEL', 'energy'), 'travel');
  assert.equal(A.modeFromHash('#nonsense', 'energy'), 'energy');
  assert.equal(A.modeFromHash('', 'night'), 'night');
  assert.equal(A.stepMode('today', -1), 'music');
  assert.equal(A.stepMode('night', 1), 'music');
  assert.equal(A.stepMode('music', 1), 'today');
  assert.equal(A.modeFromHash('#music', 'today'), 'music');
  assert.equal(A.stepMode('energy', 1), 'travel');
  assert.equal(A.displaySettings({ mode: 'home' }).mode, 'today');
});

test('the price verdict says the same thing on the phone and the TV', () => {
  const now = at('2026-10-05T17:10:00'), t0 = at('2026-10-05T17:00:00');
  const rates = ps => ps.map((p, i) => ({ from: t0 + i * 1800e3, to: t0 + (i + 1) * 1800e3, p }));
  assert.equal(A.priceVerdict(rates([30, 31, 32, 30, 12, 11, 10, 12, 28]), now).big, 'Wait if you can');
  assert.match(A.priceVerdict(rates([30, 31, 32, 30, 12, 11, 10, 12, 28]), now).line, /^30\.0p now, 11\.3p from 19:00$/);
  assert.equal(A.priceVerdict(rates([-2, -1, 5, 20]), now).big, 'Paid to use power');
  assert.equal(A.priceVerdict(rates([9, 10, 30, 30]), now).line, '9.00p now, cheap until 18:00');
  assert.equal(A.priceVerdict(rates([26, 26, 26, 26, 26]), now).big, 'Peak price');
  assert.equal(A.priceVerdict([], now), null);
  assert.deepEqual(plain([-1, 5, 20, 30, null].map(A.priceTone)), ['neg', 'cheap', 'normal', 'peak', 'muted']);
});

test('details go to the TV sealed with the PIN: the wrong PIN or code opens nothing', async () => {
  const R = await import('../src/lib/remote.js');
  const details = { account: { account: 'A-1234ABCD', key: 'sk_test_abcdef123456', gasUnit: 'm3', pay: 'DIRECT_DEBIT' }, wifi: { ssid: 'Guests', password: 'hunter22', security: 'WPA', hidden: false }, dates: [{ name: 'Sam', date: '2019-10-09', kind: 'birthday' }, { name: 'nope' }], ical: 'https://calendar.google.com/x/basic.ics' };
  const box = await R.sealDetails('ABCDEFGH', 'hashed-pin', details);
  assert.doesNotMatch(JSON.stringify(box), /1234ABCD|sk_test|hunter22|Sam|calendar/, 'nothing readable in the box');
  const got = await R.openDetails('ABCDEFGH', 'hashed-pin', box);
  assert.deepEqual(got.account, details.account);
  assert.deepEqual(got.wifi, details.wifi);
  assert.deepEqual(got.dates, [{ name: 'Sam', date: '2019-10-09', kind: 'birthday' }], 'half-filled dates are dropped');
  assert.equal(got.ical, details.ical);
  assert.equal(await R.openDetails('ABCDEFGH', 'another-pin', box), null);
  assert.equal(await R.openDetails('ABCDEFGJ', 'hashed-pin', box), null);
  const junk = await R.sealDetails('ABCDEFGH', 'hashed-pin', { account: { account: 'nope', key: 'x' }, ical: 'javascript:alert(1)' });
  assert.equal(await R.openDetails('ABCDEFGH', 'hashed-pin', junk), null, 'only well-formed details are taken');
  const msg = m => JSON.stringify({ event: 'message', message: JSON.stringify(m) });
  assert.deepEqual(R.readRemote(msg({ from: 'phone', cmd: 'account', box })).box, box);
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'account' })), null, 'a send needs its box');
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'wifi' })).cmd, 'wifi');
  assert.equal(R.readRemote(msg({ from: 'phone', cmd: 'shell', mode: 'x' })), null);
  assert.equal(R.cleanCode('abcd-efgh'), 'ABCDEFGH'); assert.equal(R.cleanCode('abcd-efg0'), null);
});

test('the TV gets its own Spotify sign-in sealed, and takes only a sleep timer and favourites besides', async () => {
  const R = await import('../src/lib/remote.js');
  const spotify = { id: 'kyle', name: 'Kyle', product: 'premium', client: '4ee18df2817b461d9e6fb53740703f89', refresh: 'AQD-refresh-token-for-the-tv', access: 'BQ-access', exp: 123 };
  const box = await R.sealDetails('ABCDEFGH', 'hashed-pin', { spotify });
  assert.doesNotMatch(JSON.stringify(box), /refresh-token|BQ-access/, 'nothing readable in the box');
  const got = await R.openDetails('ABCDEFGH', 'hashed-pin', box);
  assert.deepEqual(got.spotify, Object.assign({}, spotify, { scope: '', img: '' }));
  const bad = await R.sealDetails('ABCDEFGH', 'hashed-pin', { spotify: Object.assign({}, spotify, { client: 'not-a-client-id' }) });
  assert.equal(await R.openDetails('ABCDEFGH', 'hashed-pin', bad), null, 'a malformed sign-in is dropped');
  const msg = m => R.readRemote(JSON.stringify({ event: 'message', message: JSON.stringify(m) }));
  assert.deepEqual([msg({ from: 'phone', cmd: 'sleep', mins: 30 }).mins, msg({ from: 'phone', cmd: 'sleep', song: true }).song], [30, true]);
  assert.equal(msg({ from: 'phone', cmd: 'sleep', mins: 9999 }), null, 'four hours at most');
  const favs = msg({ from: 'phone', cmd: 'favs', favs: [{ uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', name: 'Today\'s Top Hits' }, { uri: 'https://evil.example', name: 'x' }, { uri: 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy', name: 'y'.repeat(200) }] }).favs;
  assert.deepEqual(favs.map(f => f.uri), ['spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy'], 'only Spotify links');
  assert.equal(favs[1].name.length, 80);
  assert.equal(msg({ from: 'phone', cmd: 'favs', favs: new Array(10).fill({ uri: 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy', name: 'x' }) }), null, 'nine at most');
  const st = msg({ from: 'screen', state: { mode: 'music', shown: 'music', spotify: 'Kyle', sleepAt: 5, sleepSong: 1 } }).state;
  assert.deepEqual([st.spotify, st.sleepAt, st.sleepSong], ['Kyle', 5, true]);
});

test('QR codes scan back to what went in, Wi-Fi codes included', async () => {
  const jsQR = (await import('jsqr')).default;
  const read = text => {
    const q = A.qrEncode(text), s = 3, n = (q.size + 8) * s, px = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){ const d = q.dark(Math.floor(x / s) - 4, Math.floor(y / s) - 4), i = (y * n + x) * 4; px[i] = px[i + 1] = px[i + 2] = d ? 0 : 255; px[i + 3] = 255; }
    const r = jsQR(px, n, n); return r && r.data;
  };
  const wifi = A.wifiCode({ ssid: 'Harold; Guest', password: 'pa:ss"\\word', security: 'WPA' });
  assert.equal(wifi, 'WIFI:T:WPA;S:Harold\\; Guest;P:pa\\:ss\\"\\\\word;;', 'special characters escaped as phones expect');
  for (const t of [wifi, 'Café ☕', 'x'.repeat(150), 'y'.repeat(400)]) assert.equal(read(t), t);
  assert.equal(A.wifiCode({ ssid: 'Open', password: '' }), 'WIFI:T:nopass;S:Open;;');
  assert.equal(A.wifiCode(null), null);
});

test('birthdays and countdowns: every year, with ages, Christmas and the next bank holiday', () => {
  const now = at('2026-10-05T12:00:00');
  const c = plain(A.countdowns({ dates: [{ name: 'Sam', date: '2019-10-06', kind: 'birthday' }, { name: 'Wedding anniversary', date: '2015-11-20', kind: 'anniversary' }, { name: 'Holiday to Wales', date: '2026-10-24', kind: 'once' }, { name: 'Gone', date: '2026-10-01', kind: 'once' }],
    holidays: [{ date: '2026-12-25', title: 'Christmas Day' }, { date: '2026-12-28', title: 'Boxing Day' }], events: [{ title: 'Grandad\u2019s birthday', start: at('2026-10-12T00:00:00'), allDay: true }] }, now));
  assert.deepEqual(c.map(x => [x.title, x.days]), [['Sam\u2019s birthday', 1], ['Grandad\u2019s birthday', 7], ['Holiday to Wales', 19], ['Wedding anniversary', 46], ['Christmas', 81], ['Boxing Day', 84]]);
  assert.equal(c[0].age, 7); assert.equal(c[0].when, 'Tomorrow'); assert.equal(c[3].years, 11);
  assert.equal(A.countdownText(c[0]), 'Sam\u2019s birthday tomorrow');
  assert.equal(A.countdownText(c[4]), 'Christmas in 81 days');
  const hu = plain(A.headsUp({ countdowns: c }, now));
  assert.deepEqual(hu.map(h => [h.title, h.sub]), [['Sam\u2019s birthday tomorrow', 'Turning 7']]);
  assert.equal(A.mergeSettings({ wifi: { ssid: 'x' }, dates: [{ name: 'a', date: '2020-01-01' }] }, null).wifi, null, 'never from the public file');
});

test('dates are written and read day first, the UK way', () => {
  assert.equal(A.ukDate('2026-10-05'), '05/10/2026');
  assert.equal(A.ukDate(new Date(2026, 11, 25)), '25/12/2026');
  assert.equal(A.parseUkDate('5/10/2026'), '2026-10-05', 'the fifth of October, not the tenth of May');
  assert.equal(A.parseUkDate('05-10-26'), '2026-10-05');
  assert.equal(A.parseUkDate(' 25.12.2026 '), '2026-12-25');
  assert.equal(A.parseUkDate('29/02/2027'), null, 'not a real date');
  assert.equal(A.parseUkDate('13/13/2026'), null);
  assert.equal(A.parseUkDate('2026-10-05'), null);
  assert.equal(A.parseUkDate(''), null);
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
  assert.equal(A.councilBins(feed, at('2026-10-16T09:00:00')), null, 'a feed more than ten days old is ignored');
  // A weekly check: the hand-set repeat carries on from the council's latest date for each bin.
  const hand = [{ name: 'Green bin', colour: 'green', date: '2026-10-09', every: 1 }, { name: 'Black bin', colour: 'black', date: '2026-10-02', every: 2 },
                { name: 'Blue bin', colour: 'blue', date: '2026-10-23', every: 4 }];
  const moved = { fetched: '2026-10-10T04:17:00Z', bins: [{ name: 'Green bin', colour: 'green', date: '2026-10-17' }, { name: 'Black bin', colour: 'black', date: '2026-10-17' }, { name: 'Food caddy', colour: 'grey', date: '2026-10-16' }] };
  const later = at('2026-10-18T09:00:00');
  const merged = plain(A.nextCollections(A.mergeBins(hand, A.councilBins(moved, later)), later));
  assert.deepEqual(merged.map(b => [b.name, b.days]), [['Blue bin', 5], ['Green bin', 6], ['Black bin', 13]]);
  assert.deepEqual(plain(A.mergeBins(hand, null)), hand);
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

test('trains: where each one calls, from either board, and how long it is', () => {
  const now = at('2026-10-05T20:30:00');
  const r = plain(A.parseHuxley({ trainServices: [
    { std: '20:36', etd: 'On time', length: 4, destination: [{ locationName: 'Manchester Piccadilly' }], subsequentCallingPoints: [{ callingPoint: [{ locationName: 'Heaton Chapel' }, { locationName: 'Levenshulme' }, { locationName: 'Manchester Piccadilly' }] }] },
    { std: '2026-10-05T20:40:00', etd: null, destination: [{ locationName: 'Manchester Piccadilly' }], subsequentLocations: [{ locationName: 'HTNOJN', crs: null, isPass: true }, { locationName: 'Heaton Chapel', crs: 'HTC', isPass: true }, { locationName: 'Manchester Piccadilly', crs: 'MAN', isPass: false, isOperational: false }] } ] }, now));
  assert.deepEqual(r.list[0].calls, ['Heaton Chapel', 'Levenshulme', 'Manchester Piccadilly']);
  assert.equal(r.list[0].coaches, 4);
  assert.deepEqual(r.list[1].calls, ['Manchester Piccadilly'], 'junctions and stations it runs through are left out');
  assert.equal(r.list[1].coaches, null);
});

test('trains from the staff board: full date-times, and seconds on the estimate', () => {
  const now = at('2026-10-05T23:50:00');
  assert.equal(A.boardTime('2026-10-06T00:10:00', now), at('2026-10-06T00:10:00'));
  assert.equal(A.boardTime('23:46:25', at('2026-10-05T23:40:00')), at('2026-10-05T23:46:00'));
  const r = plain(A.parseHuxley({ locationName: 'Stockport', trainServices: [
    { std: '2026-10-05T23:55:00', etd: '2026-10-06T00:01:12.5', platform: '3', isCancelled: false, destination: [{ locationName: 'Crewe' }] },
    { std: '2026-10-05T23:58:00', etd: null, platform: '1', isCancelled: false, destination: [{ locationName: 'Buxton' }] } ] }, now));
  assert.deepEqual(r.list.map(d => d.dest), ['Buxton', 'Crewe']);
  assert.equal(r.list[1].exp - r.list[1].sched, 6 * 60e3);
  assert.equal(r.list[0].delayed, true, 'no estimate on the staff board reads as delayed');
});

test('trains you can still make with your walk come first; the rest are only counted', () => {
  const now = at('2026-10-05T20:31:00'), d = (h, m, extra = {}) => Object.assign({ sched: at(`2026-10-05T${h}:${m}:00`), exp: at(`2026-10-05T${h}:${m}:00`), dest: 'Manchester Piccadilly' }, extra);
  // a 25 minute walk at 20:31: the 20:33, 20:40 and 20:47 are gone; 20:53 is a run; 21:05 is fine
  const list = [d('20', '33'), d('20', '19', { exp: at('2026-10-05T20:47:00') }), d('20', '40'), d('20', '53'), d('21', '05'), d('21', '12', { cancelled: true }), d('20', '10')];
  const c = A.catchable(list, 25, now);
  assert.deepEqual(Array.from(c.list, x => new Date(x.sched).getHours() * 100 + new Date(x.sched).getMinutes()), [2053, 2105, 2112]);
  assert.equal(c.missed, 3, 'the one that has already left isn\'t counted');
  assert.equal(A.leaveBy(c.list[0].sched, 25, now).text, 'Run for it');
  assert.equal(A.catchable(null, 10, now).list.length, 0);
});

test('the commute: your usual days and hours, a plan for the days that differ, every train on days off', () => {
  const s = A.displaySettings({ trainFrom: 'SPT', trainTo: 'MAN', trainWalk: 15, workDays: [2, 5], workWalk: 25, workStart: '09:00', workEnd: '17:30' });
  const day = (d, h) => at('2026-10-' + d + 'T' + h + ':00');
  const tue = h => day('06', h), start = day('06', '09:00'), end = day('06', '17:30');
  assert.deepEqual(plain(A.commuteLeg(s, tue('07:40'))), { from: 'SPT', to: 'MAN', walk: 15, after: 25, work: true, home: false, start, end });
  assert.deepEqual(plain(A.commuteLeg(s, tue('13:15'))), { from: 'MAN', to: 'SPT', walk: 25, after: 15, work: false, home: true, start, end }, 'turned round halfway through the day');
  assert.equal(A.commuteLeg(s, tue('13:14')).work, true);
  assert.deepEqual(plain(A.commuteLeg(s, day('05', '07:40'))), { from: 'SPT', to: '', walk: 15, after: 0, work: false, home: false }, 'Monday: not in, so every train from Stockport');
  assert.equal(A.commuteLeg(s, day('09', '08:00')).work, true);
  assert.equal(A.commuteLeg(s, day('09', '08:00'), [{ date: '2026-10-09', title: 'A bank holiday' }]).work, false, 'a bank holiday is a day off');
  // the plan: in on Monday from 10:00 to 16:00 (home from 13:00), off on Tuesday
  const p = Object.assign({}, s, { plan: { '2026-10-05': { in: true, start: '10:00', end: '16:00' }, '2026-10-06': { in: false } } });
  assert.deepEqual(plain(A.officeDay(p, day('05', '07:00'))), { key: '2026-10-05', in: true, usual: false, start: '10:00', end: '16:00', changed: true });
  assert.equal(A.commuteLeg(p, day('05', '09:50')).start, day('05', '10:00'));
  assert.equal(A.commuteLeg(p, day('05', '13:00')).home, true);
  assert.equal(A.commuteLeg(p, tue('08:00')).to, '', 'off on Tuesday after all');
  assert.deepEqual(plain(A.officeDay(s, day('09', '07:00'))), { key: '2026-10-09', in: true, usual: true, start: '09:00', end: '17:30', changed: false });
  assert.deepEqual(plain(A.cleanPlan({ '2026-10-05': { in: true }, '2026-10-06': { in: false, start: '09:00' }, '2026-10-07': { in: true, start: '9am', end: '16:00' }, '2026-11-30': { in: true }, 'soon': { in: true }, '2026-10-08': { in: 'yes' } }, tue('07:00'))),
    { '2026-10-06': { in: false }, '2026-10-07': { in: true, end: '16:00' } }, 'from today, two weeks at most, well formed');
  assert.equal(A.commuteLeg(A.displaySettings({ trainFrom: 'SPT', trainTo: 'MAN' }), tue('17:00')).to, 'MAN', 'with no work days, the station only picks the trains');
  assert.equal(A.trainWalkOf({ leg: { walk: 25 } }, s), 25);
  assert.equal(A.trainWalkOf(null, s), 15);
  assert.deepEqual(plain(A.displaySettings({ workDays: ['1', 9, 5], workWalk: -3 })).workDays, [1, 5]);
  assert.deepEqual(plain(A.mergeSettings({ trainTo: 'MAN', workDays: [1, 3], workStart: '08:00' }, null)).workDays, [], 'when you\'re out never comes from the public household file');
  assert.equal(A.mergeSettings({ workStart: '08:00' }, { workDays: [1, 3] }).workStart, '09:00');
  const odd = A.displaySettings({ workStart: 'soon', homeFrom: '15:00', plan: {} });
  assert.equal(odd.workStart, '09:00'); assert.equal(odd.homeFrom, undefined); assert.equal(odd.plan, undefined, 'the plan is kept apart, per device');
});

test('the commute: the train that gets you in for your start, or home once you finish, and when you\'re there', () => {
  const t = h => at('2026-10-06T' + h + ':00'), now = t('07:45');
  const pub = (std, etd, arr, et) => ({ std, etd, destination: [{ locationName: 'Manchester Piccadilly' }], subsequentCallingPoints: [{ callingPoint: [{ locationName: 'Heaton Chapel', crs: 'HTC', st: std, et: 'On time' }, { locationName: 'Manchester Piccadilly', crs: 'MAN', st: arr, et }] }] });
  const r = A.parseHuxley({ locationName: 'Stockport', filterLocationName: 'Manchester Piccadilly', trainServices: [
    pub('08:03', 'On time', '08:14', '08:17'), pub('08:09', 'Delayed', '08:20', 'Delayed'),
    { std: '2026-10-06T08:12:00', etd: '2026-10-06T08:12:00', destination: [{ locationName: 'Manchester Piccadilly' }], subsequentLocations: [{ locationName: 'Levenshulme', crs: 'LVM', isPass: true, sta: '0001-01-01T00:00:00' }, { locationName: 'Manchester Piccadilly', crs: 'MAN', isPass: false, sta: '2026-10-06T08:22:00', eta: '2026-10-06T08:23:30.5', ata: '0001-01-01T00:00:00' }] },
    pub('08:30', 'On time', '08:41', 'On time') ] }, now, 'MAN');
  assert.equal(r.toName, 'Manchester Piccadilly');
  assert.deepEqual(r.list.map(d => d.arr && new Date(d.arr).toTimeString().slice(0, 5)), ['08:17', null, '08:23', '08:41'], 'expected times, and a delay is not a time');
  assert.equal(r.list[0].arrSched, t('08:14'));
  const leg = { from: 'SPT', to: 'MAN', walk: 15, after: 25, work: true, home: false, start: t('09:00'), end: t('17:30') };
  assert.deepEqual(plain(A.arriveBy(r.list[0], leg)), { t: t('08:42'), late: false, text: 'At work by 08:42' });
  assert.equal(A.arriveBy(r.list[3], leg).late, true, '09:06 is after 09:00');
  assert.equal(A.arriveBy(r.list[0], { from: 'SPT', to: 'MAN', walk: 15, after: 0 }).text, 'Arrives 08:17');
  assert.equal(A.arriveBy(r.list[1], leg), null);
  const trains = Object.assign(r, { leg });
  assert.equal(A.commuteLine(trains, now), 'For 09:00, the 08:12: Manchester Piccadilly 08:23, at work by 08:48. Leave home by 07:57.', 'the last that gets you in');
  assert.equal(A.commuteLine(trains, t('08:05')), 'Nothing gets you in by 09:00 now. The next is the 08:30: Manchester Piccadilly 08:41, at work by 09:06.');
  assert.equal(A.commuteLine(Object.assign({}, trains, { list: trains.list.slice(0, 3) }), now), 'The 08:03: Manchester Piccadilly 08:17, at work by 08:42.', 'too early to say which: every train listed is in time');
  assert.equal(A.trainsTitle(trains, {}), 'Trains to work');
  assert.equal(A.trainsTitle({ station: 'Stockport', toName: 'Manchester Piccadilly', list: [] }, { trainFrom: 'SPT' }), 'Trains from Stockport to Manchester Piccadilly');
  assert.equal(A.trainsTitle({ station: 'Stockport', list: [] }, { trainFrom: 'SPT' }), 'Trains from Stockport');
  assert.equal(A.trainsTitle(null, { trainFrom: '' }), 'Trains');
  // the heads-up is for the train that gets you in, not the first one going
  const heads = A.headsUp({ trains }, now);
  assert.deepEqual([heads[0].title, heads[0].sub], ['Leave in 12 min', '08:12 to Manchester Piccadilly. At work by 08:48']);
  // home: the first you can make once you finish at 17:30, with the 25 minute walk to Piccadilly
  const back = A.parseHuxley({ locationName: 'Manchester Piccadilly', filterLocationName: 'Stockport', trainServices: [
    ['17:20', '17:29'], ['17:50', '17:58'], ['18:10', '18:19']].map(([std, arr]) => ({ std, etd: 'On time', destination: [{ locationName: 'Buxton' }], subsequentCallingPoints: [{ callingPoint: [{ locationName: 'Stockport', crs: 'SPT', st: arr, et: 'On time' }] }] })) }, t('16:00'), 'SPT');
  back.leg = { from: 'MAN', to: 'SPT', walk: 25, after: 15, work: false, home: true, start: t('09:00'), end: t('17:30') };
  assert.equal(A.commuteTrain(back, t('16:00')).kind, 'after');
  assert.equal(A.commuteLine(back, t('16:00')), 'Finishing at 17:30, the 18:10: Stockport 18:19, home by 18:34. Leave work by 17:45.');
  assert.equal(A.commuteLine(back, t('17:40')), 'The 18:10: Stockport 18:19, home by 18:34.');
  assert.equal(A.trainsTitle(back, {}), 'Trains home');
});

test('the station sign words a train the same on the phone and the TV', () => {
  const now = at('2026-10-05T20:31:00'), d = (h, m, extra = {}) => Object.assign({ sched: at(`2026-10-05T${h}:${m}:00`), exp: at(`2026-10-05T${h}:${m}:00`), dest: 'Crewe', platform: '3' }, extra);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(A.ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
  const late = d('20', '40', { exp: at('2026-10-05T20:44:00') });
  assert.equal(A.signStatus(late), 'Exp 20:44'); assert.equal(A.signExpected(late), '20:44');
  assert.equal(A.signStatus(d('20', '40', { exp: at('2026-10-05T20:40:30') })), 'On time', 'under a minute late is on time, as the boards have it');
  assert.equal(A.signExpected(d('20', '40', { cancelled: true })), 'Cancelled');
  assert.equal(A.signStatus(d('20', '40', { exp: null, delayed: true })), 'Delayed');
  // with a 10 minute walk at 20:31
  assert.deepEqual({ ...A.signGo(d('21', '00'), 10, now) }, { text: 'Go in 19 min', run: false, late: false });
  assert.equal(A.signGo(d('21', '00'), 10, now, true).text, '19 min');
  assert.deepEqual({ ...A.signGo(d('20', '40'), 10, now, true) }, { text: 'Run', run: true, late: false });
  assert.deepEqual({ ...A.signGo(d('20', '33'), 10, now) }, { text: 'Too late', run: false, late: true });
  assert.deepEqual({ ...A.signGo(d('20', '33', { cancelled: true }), 10, now, true) }, { text: '-', run: false, late: false });
  assert.equal(A.signLine(Object.assign(d('20', '40'), { calls: ['Stockport', 'Macclesfield', 'Crewe'], coaches: 4, operator: 'Avanti West Coast', reason: 'Delayed by a signalling fault' }), ['Lifts out of order']),
    'Platform 3.  Calling at: Stockport, Macclesfield and Crewe.  This train has 4 coaches.  An Avanti West Coast service.  Delayed by a signalling fault.  Lifts out of order');
  assert.equal(A.signLine(null), '');
  // the board starts just above the first you can make; the platform sign at it
  const s = A.signTrains([d('20', '20'), d('20', '33'), d('20', '45'), d('20', '50'), d('21', '00')], 10, now, 3);
  assert.deepEqual(Array.from(s.board, x => new Date(x.sched).getMinutes()), [33, 45, 50], 'the one that has gone is left off; one too soon to make stays, dimmed');
  assert.deepEqual(Array.from(s.first3, x => new Date(x.sched).getMinutes()), [45, 50, 0]);
  assert.equal(s.missed, 1);
});

test('heads-ups: a train to leave for, bins tonight, rain on its way', () => {
  const now = at('2026-10-05T17:30:00');
  const train = (m, extra = {}) => Object.assign({ sched: now + m * 60e3, exp: now + m * 60e3, dest: 'London Euston', platform: '3', cancelled: false }, extra);
  const bins = A.nextCollections([{ name: 'Green bin', colour: 'green', date: '2026-10-06', every: 1 }, { name: 'Black bin', colour: 'black', date: '2026-10-06', every: 2 }, { name: 'Blue bin', colour: 'blue', date: '2026-10-13', every: 4 }], now);
  const hour = (h, rain) => ({ t: at(`2026-10-05T${h}:00:00`), rain });
  const r = plain(A.headsUp({ trains: { list: [train(10, { cancelled: true }), train(20, { exp: now + 23 * 60e3 })] }, walk: 15, bins, weather: { hours: [hour(17, 10), hour(18, 30), hour(19, 70)] } }, now));
  assert.deepEqual(r.map(x => x.kind), ['train', 'bins', 'rain']);
  assert.equal(r[0].title, 'Leave in 8 min', 'the cancelled one is skipped, and the expected time counts');
  assert.match(r[0].sub, /17:50 to London Euston, expected 17:53, platform 3/);
  assert.equal(r[1].sub, 'Black bin and Green bin');
  assert.equal(r[2].title, 'Rain likely from 19:00');
  // nothing to say: the train is an hour off, bins are next week, it's raining already
  assert.deepEqual(plain(A.headsUp({ trains: { list: [train(60)] }, walk: 15, bins: A.nextCollections([{ name: 'Blue', date: '2026-10-13', every: 4 }], now), weather: { hours: [hour(17, 80), hour(18, 90)] } }, now)), []);
  // bins the evening before only from three o'clock, and that morning until ten
  assert.equal(A.headsUp({ bins }, at('2026-10-05T12:00:00')).length, 0);
  // the quarter-hour rain wins over the hourly chance; flood warnings come before it
  const q = (m, mm) => ({ t: now + m * 60e3, mm });
  const wet = plain(A.headsUp({ nowcast: [q(0, 0), q(15, 0), q(30, 0.6)], floods: [{ level: 2, title: 'Flood warning', area: 'River Mersey at Stockport' }], weather: { hours: [hour(17, 10), hour(18, 90)] } }, now));
  assert.deepEqual(wet.map(x => x.title), ['Flood warning', 'Rain from 18:00']);
  const morning = at('2026-10-06T07:00:00');
  assert.equal(A.headsUp({ bins: A.nextCollections([{ name: 'Green bin', date: '2026-10-06', every: 1 }], morning) }, morning)[0].title, 'Bins go this morning');
});

test('bins move a day after a weekday bank holiday in their week, and Christmas says to check', () => {
  const hols = A.parseBankHolidays({ 'england-and-wales': { events: [{ title: 'Spring bank holiday', date: '2027-05-31' }, { title: 'Christmas Day', date: '2026-12-25' }, { title: 'Boxing Day', date: '2026-12-28' }] } });
  assert.deepEqual(plain(hols.map(h => h.date)), ['2026-12-25', '2026-12-28', '2027-05-31']);
  const bins = [{ name: 'Green', date: '2027-05-20', every: 1 }];   // Thursdays
  const wk = A.nextCollections(bins, at('2027-05-30T12:00:00'), hols)[0];
  assert.equal(wk.date.getDay(), 5, 'the Thursday after a Monday bank holiday moves to Friday');
  assert.equal(wk.moved, 'Spring bank holiday');
  const fri = A.nextCollections(bins, at('2027-06-04T08:00:00'), hols)[0];
  assert.equal(fri.days, 0, 'on the Friday, the moved collection is today, not next week');
  assert.equal(A.nextCollections(bins, at('2027-06-05T08:00:00'), hols)[0].moved, undefined, 'the week after is back to normal');
  assert.equal(A.nextCollections(bins, at('2027-05-30T12:00:00'))[0].date.getDay(), 4, 'without the holiday list nothing moves');
  assert.equal(A.nextCollections([{ name: 'Black', date: '2026-12-17', every: 1 }], at('2026-12-21T12:00:00'), hols)[0].check, true, 'Christmas week: check the council');
  assert.equal(A.nextCollections([{ name: 'Council', date: '2027-06-03', every: 0 }], at('2027-05-30T12:00:00'), hols)[0].moved, undefined, 'the council\'s own dates stay put');
});

test('rain in the next hours, air, pollen, floods and the grid mix', () => {
  const now = at('2026-10-05T17:40:00');
  const q = (h, m, mm) => ({ t: at(`2026-10-05T${h}:${m}:00`), mm });
  assert.deepEqual(plain(A.rainSoon([q(17, 30, 0), q(17, 45, 0), q(18, '00', 0), q(18, 15, 0.4), q(18, 30, 1.2)], now)), { raining: false, starts: at('2026-10-05T18:15:00'), mins: 35, text: 'Rain from 18:15', heavy: true });
  assert.equal(A.rainSoon([q(17, 30, 0.5), q(17, 45, 0.3), q(18, '00', 0)], now).text, 'Rain stops around 18:00');
  assert.equal(A.rainSoon([q(17, 30, 0), q(17, 45, 0)], now), null);
  assert.equal(A.parseNowcast({ minutely_15: { time: ['2026-10-05T17:45'], precipitation: [null], precipitation_probability: [20] } })[0].mm, 0);
  const tile = A.tileOf(53.41, -2.16, 7);
  assert.deepEqual([tile.x, tile.y], [63, 41]);
  const air = A.parseAir({ current: { european_aqi: 24, uv_index: 2.4, grass_pollen: 35, birch_pollen: 0, alder_pollen: 3 }, hourly: { uv_index: [0, 1.5, 3.2, null] } });
  assert.deepEqual(plain(air), { aqi: 24, uv: 2.4, uvMax: 3.2, pollen: { grass: 35, tree: 3 } });
  assert.equal(A.aqiLabel(24), 'Fair'); assert.equal(A.uvLabel(3.2), 'Moderate'); assert.equal(A.pollenLabel(35, 'grass'), 'Moderate'); assert.equal(A.pollenLabel(0, 'tree'), 'None'); assert.equal(A.aqiLabel(null), null);
  const floods = A.parseFloods({ items: [{ severityLevel: 4, description: 'Old' }, { severityLevel: 3, description: 'River Goyt at Marple', message: ' Levels rising. ', timeRaised: '2026-10-05T09:00:00' }, { severityLevel: 2, description: 'River Mersey at Stockport' }] });
  assert.deepEqual(plain(floods.map(f => [f.title, f.area])), [['Flood warning', 'River Mersey at Stockport'], ['Flood alert', 'River Goyt at Marple']]);
  assert.equal(floods[1].message, 'Levels rising.');
  const mix = A.parseGridMix({ data: [{ data: [{ from: '2026-10-05T16:00Z', generationmix: [{ fuel: 'gas', perc: 6.5 }, { fuel: 'wind', perc: 55.4 }, { fuel: 'nuclear', perc: 27.6 }, { fuel: 'solar', perc: 2.3 }, { fuel: 'coal', perc: 0 }, { fuel: 'imports', perc: 8.2 }] }] }] });
  assert.equal(mix.mix[0].name, 'Wind'); assert.equal(mix.renewable, 58); assert.equal(mix.lowCarbon, 85);
  assert.equal(mix.mix.some(f => f.fuel === 'coal'), false);
  assert.equal(A.parseGridMix({}), null);
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

test('the display\'s scripts parse, with no name declared twice in the flattened modules', async () => {
  const vm = await import('node:vm');
  const html = read('display.html');
  [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => { assert.doesNotThrow(() => new vm.Script(m[1], { filename: 'display.html script ' + (i + 1) }), 'script ' + (i + 1)); });
});

test('the built display matches the source', () => {
  execFileSync('python3', [new URL('../build.py', import.meta.url).pathname, '--check'], { stdio: 'pipe' });   // fails with "run python3 build.py"
});

test('the shared modules keep to what the display build can flatten', () => {
  for (const m of ['format', 'browser', 'net', 'octopus', 'carbon', 'weather', 'pvgis', 'analysis', 'household', 'outdoors', 'remote', 'qr', 'voyage', 'spotify', 'music', 'musicdata', 'queue', 'discover']) {
    const text = read(`src/lib/${m}.js`);
    const left = text.split('\n').filter(l => /^(import|export)\b/.test(l) && !/^import \{[^}]*\} from '\.\/[\w-]+\.js';$/.test(l) && !/^export (const|let|function|async function|class) /.test(l));
    assert.deepEqual(left, [], `${m}.js: one-line imports from ./module.js, and export only declarations`);
  }
});

test('the moon is in its real phase', () => {
  const near = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b)) < .02;
  assert.ok(near(A.moonPhase(Date.UTC(2024, 0, 11, 11, 57)).f, 0), 'new moon 11 Jan 2024');
  assert.ok(near(A.moonPhase(Date.UTC(2024, 0, 25, 17, 54)).f, .5), 'full moon 25 Jan 2024');
  assert.equal(A.moonPhase(Date.UTC(2024, 0, 25, 17, 54)).name, 'Full moon');
  assert.ok(A.moonPhase(Date.UTC(2024, 0, 25, 17, 54)).illum > .99);
  assert.equal(A.moonPhase(Date.UTC(2024, 0, 18, 3, 52)).name, 'First quarter');
});

test('the real ISS counts as overhead within 1,500 km of home', () => {
  assert.ok(Math.abs(A.kmBetween(53.41, -2.16, 51.5, -.12) - 249) < 10, 'Stockport to London');
  assert.equal(A.issPass({ latitude: 54.5, longitude: 0, altitude: 421, velocity: 27560 }, { lat: 53.41, lon: -2.16 }).near, true);
  assert.equal(A.issPass({ latitude: -10, longitude: 7, altitude: 421 }, { lat: 53.41, lon: -2.16 }).near, false);
  assert.equal(A.issPass(null, { lat: 53, lon: -2 }), null);
});

test('the world outside follows the grid, the bins, the weather and your power draw', () => {
  const now = at('2026-10-08T19:00:00'), slot = { from: now - 600e3, to: now + 1200e3 };
  const w = A.worldFor({ carbon: [Object.assign({ v: 40, index: 'very low' }, slot)], agile: [Object.assign({ p: 12 }, slot)],
    bins: [{ name: 'Green bin', colour: 'green', date: '2026-10-09', every: 1 }, { name: 'Black bin', colour: 'black', date: '2026-10-16', every: 2 }],
    weather: { now: { temp: 4, code: 0, wind: 5 }, days: [], hours: [] }, live: { demand: 1500 } }, now);
  assert.equal(w.aurora, 1);
  assert.deepEqual(plain(w.comet), ['green'], 'a comet on bin night, in the colour of the bin');
  assert.deepEqual(plain(w.house.bins), ['green']);
  assert.ok(Math.abs(w.house.glow - (.12 + .44)) < 1e-9, 'windows glow with the live draw');
  assert.ok(w.house.smoke > .5, 'the chimney smokes when it\'s cold');
  assert.equal(w.house.lantern, 'good');
  const noon = at('2026-10-05T12:00:00'), day = A.worldFor({ agile: [{ from: noon - 600e3, to: noon + 1200e3, p: -2 }] }, noon);
  assert.equal(day.aurora, .9, 'paid to use power lights the aurora');
  assert.deepEqual(plain(day.comet), []);
  assert.equal(day.house.smoke, 0);
});

test('billboards keep to what you need to catch; the rest rides the train', () => {
  const cards = [{ id: 'price', weight: 1 }, { id: 'wx', weight: 1 }, { id: 'bins', weight: 3 }, { id: 'date', weight: 1 }, { id: 'event0', weight: 1 }];
  assert.deepEqual(plain(A.boardCards(cards)).map(c => c.id), ['price', 'bins']);
});


test('the road ahead lays the next twelve hours along the window', () => {
  const now = at('2026-10-05T14:10:00'), s0 = at('2026-10-05T14:00:00');
  const agile = [];
  for (let i = -2; i < 40; i++) agile.push({ from: s0 + i * 1800e3, to: s0 + (i + 1) * 1800e3, p: i >= 20 && i < 24 ? 4 : 20 + (i % 3) });
  const hours = [0, 1, 2, 3, 4, 5].map(i => ({ t: s0 + i * 3600e3, temp: 12, rain: i === 2 || i === 3 ? 80 : 10, code: i === 3 ? 95 : i === 2 ? 61 : 2 }));
  const events = [{ title: 'Dentist', start: at('2026-10-05T16:30:00'), end: at('2026-10-05T17:00:00') },
                  { title: 'Bank holiday', start: at('2026-10-06T00:00:00'), end: at('2026-10-07T00:00:00'), allDay: true },
                  { title: 'Holiday', start: at('2026-10-07T09:00:00'), end: at('2026-10-07T10:00:00') }];
  const trains = { station: 'Stockport', list: [{ sched: at('2026-10-05T14:40:00'), exp: at('2026-10-05T14:40:00'), dest: 'Manchester Piccadilly', platform: '2' }] };
  const v = A.voyageFor({ agile, weather: { hours }, events, trains, walk: 15 }, now);
  assert.equal(v.to - v.from, 12 * 3600e3);
  assert.equal(v.range[0].from, s0);                                            // the half hour we're in
  assert.ok(v.range.every(r => r.from < v.to));
  assert.equal(v.dock.from, s0 + 20 * 1800e3);                                  // the cheap two hours, 00:00 to 02:00
  assert.equal(v.dock.now, false);
  assert.equal(v.dock.mins, 590);
  assert.deepEqual(plain(v.fronts), [{ from: s0 + 2 * 3600e3, to: s0 + 4 * 3600e3, kind: 'thunder' }]);   // rain, then thunder: one front
  assert.deepEqual(plain(v.waypoints).map(w => w.title), ['Dentist']);          // not all-day, not beyond twelve hours
  assert.equal(v.train.mine, true);                                             // leave in 15 minutes
  assert.equal(v.train.leave.mins, 15);
  assert.equal(v.train.station, 'Stockport');
  assert.deepEqual(plain(A.shownAhead(v)), ['cheap', 'train']);
  const later = A.voyageFor({ agile, trains, walk: 15 }, at('2026-10-06T00:30:00'));
  assert.equal(later.dock.now, true);
  assert.equal(later.dock.mins, 0);
  const far = A.voyageFor({ trains, walk: 15 }, at('2026-10-05T13:30:00'));
  assert.equal(far.train.mine, false);                                          // 55 minutes to leave
  assert.equal(far.range, null);
  assert.equal(far.dock, null);
  assert.equal(A.wetKind({ code: 73, rain: 0 }), 'snow');
  assert.equal(A.wetKind({ code: 3, rain: 70 }), 'rain');
  assert.equal(A.wetKind({ code: 3, rain: 20 }), null);
});

test('the cabin instruments set today against a usual day', () => {
  let h = {};
  ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].forEach((d, i) => { h = A.recordCost(h, at(d + 'T18:00:00'), 100); h = A.recordCost(h, at(d + 'T22:30:00'), 300 + i * 100); });
  const now = at('2026-10-05T14:10:00');
  h = A.recordCost(h, now, 250);
  assert.equal(A.usualCost(h, now), 450);                                      // median of 300, 400, 500, 600; today left out
  assert.equal(A.usualCost({}, now), null);
  const half = A.recordCost({}, at('2026-10-01T15:00:00'), 200);
  assert.equal(half['2026-10-01'].late, false);                                 // a day seen only in the afternoon doesn't count
  for (let i = 0; i < 30; i++) h = A.recordCost(h, at('2026-09-01T23:00:00') + i * 864e5, 100);
  assert.ok(Object.keys(h).length <= 15);
  const slot = { from: now - 600e3, to: now + 1200e3 };
  const ins = A.instrumentsFor({ live: { demand: 1500 }, cost: 500, carbon: [Object.assign({ v: 210, index: 'high' }, slot)] }, now, 450);
  assert.equal(ins.draw.w, 1500);
  assert.equal(ins.draw.frac, .5);
  assert.equal(ins.cost.tone, 'bad');                                           // more than a usual day already
  assert.equal(ins.carbon.tone, 'bad');
  const none = A.instrumentsFor({}, now, null);
  assert.equal(none.draw, null); assert.equal(none.cost, null); assert.equal(none.carbon, null);
  assert.equal(A.instrumentsFor({ cost: 120 }, now, null).cost.frac, null);    // no usual day yet: just the figure
});
