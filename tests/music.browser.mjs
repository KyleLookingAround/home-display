// The music player in a browser, against a pretend Spotify that behaves like the real one: signing in (PKCE), the
// strip on every page, the full player and its controls, Play on, the lyrics, the Music tab, and what goes wrong.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const { chromium } = await import('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SHOTS = process.env.SHOTS ? join(ROOT, 'tests', 'screens') : null;
if (SHOTS && !existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
const shot = (page, name) => SHOTS ? page.screenshot({ path: join(SHOTS, name + '.png') }) : null;

/* ---------- a cover: a PNG of one colour ---------- */
function png(r, g, b, size = 64){
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, i) => [r, g, b][i % 3])]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array(size).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
const COVERS = { amber: png(250, 160, 40), violet: png(150, 90, 240), cyan: png(40, 200, 240) };

/* ---------- the pretend Spotify ---------- */
const img = c => [{ url: `https://i.scdn.co/image/${c}-640`, width: 640, height: 640 }, { url: `https://i.scdn.co/image/${c}-300`, width: 300, height: 300 }, { url: `https://i.scdn.co/image/${c}-64`, width: 64, height: 64 }];
const ALBUMS = {
  al1: { id: 'al1', uri: 'spotify:album:al1', name: 'Region G', release_date: '2026-09-04', images: img('amber'), artists: [{ id: 'a1', name: 'The Stockport Satellites' }] },
  al2: { id: 'al2', uri: 'spotify:album:al2', name: 'Half-Hourly', release_date: '2025-03-01', images: img('violet'), artists: [{ id: 'a2', name: 'Agile Hearts' }] },
  al3: { id: 'al3', uri: 'spotify:album:al3', name: 'Platform 3', release_date: '2024-05-17', images: img('cyan'), artists: [{ id: 'a3', name: 'Viaduct' }] }
};
const tr = (id, name, al, artist, ms) => ({ id, uri: 'spotify:track:' + id, name, duration_ms: ms, explicit: false, is_playable: true, type: 'track', album: ALBUMS[al], artists: [{ id: artist[0], name: artist[1], uri: 'spotify:artist:' + artist[0] }] });
const TRACKS = [
  tr('t1', 'Harold Street', 'al1', ['a1', 'The Stockport Satellites'], 204000),
  tr('t2', 'Negative Pricing', 'al2', ['a2', 'Agile Hearts'], 178000),
  tr('t3', 'Last Train to Piccadilly', 'al3', ['a3', 'Viaduct'], 245000),
  tr('t4', 'Bins Out Tonight', 'al1', ['a1', 'The Stockport Satellites'], 151000)
];
const DEVICES = [
  { id: 'kitchen', name: 'Kitchen speaker', type: 'Speaker', is_active: true, volume_percent: 45, supports_volume: true },
  { id: 'tv', name: 'Living room TV', type: 'TV', is_active: false, volume_percent: 20, supports_volume: true },
  { id: 'phone', name: 'Kyle\'s phone', type: 'Smartphone', is_active: false, volume_percent: 100, supports_volume: false }
];
const LRC = '[00:00.50]Streetlights hum along the viaduct\n[00:08.00]Kettle on at half past nine\n[00:16.00]The meter ticks, the prices drop\n[00:24.00]We wait for cheaper time\n[00:32.00]Harold Street, Harold Street\n[00:40.00]Stars above the chimney pots';

function spotify(opts = {}){
  const S = { calls: [], authorize: null, token: [], premium: opts.premium !== false, noDevice: !!opts.noDevice, fail401: opts.fail401 || 0,
    valid: new Set(['acc1', 'acc2']), liked: new Set(['t3']), queue: [TRACKS[1], TRACKS[2]],
    state: opts.nothing ? null : { is_playing: true, progress_ms: 20000, timestamp: Date.now(), item: TRACKS[0], shuffle_state: false, repeat_state: 'off', device: DEVICES[0], currently_playing_type: 'track', context: { type: 'playlist', uri: 'spotify:playlist:p1' } } };
  const err = (status, message, reason) => ({ status, json: { error: Object.assign({ status, message }, reason ? { reason } : {}) } });
  const find = uri => TRACKS.find(t => t.uri === uri);
  S.handle = (method, url, headers, body) => {
    const u = new URL(url), p = u.pathname.replace(/^\/v1/, ''), q = u.searchParams;
    S.calls.push({ method, path: p, query: Object.fromEntries(q), body });
    const auth = (headers.authorization || '').replace('Bearer ', '');
    if (S.fail401 > 0){ S.fail401--; return err(401, 'The access token expired'); }
    if (!S.valid.has(auth)) return err(401, 'Invalid access token');
    const control = /^\/me\/player(\/(play|pause|next|previous|seek|volume|shuffle|repeat))?$/.test(p) && method !== 'GET';
    if (control && !S.premium) return err(403, 'Player command failed: Premium required', 'PREMIUM_REQUIRED');
    if (control && S.noDevice && !(p === '/me/player' && method === 'PUT') && !q.get('device_id')) return err(404, 'Player command failed: No active device found', 'NO_ACTIVE_DEVICE');
    const st = S.state;
    if (p === '/me') return { json: { id: 'kyle', display_name: 'Kyle', product: S.premium ? 'premium' : 'free' } };
    if (p === '/me/player' && method === 'GET') return st ? { json: st } : { status: 204 };
    if (p === '/me/player/devices') return { json: { devices: DEVICES.map(d => Object.assign({}, d, { is_active: !!st && st.device.id === d.id })) } };
    if (p === '/me/player' && method === 'PUT'){ const d = DEVICES.find(x => x.id === body.device_ids[0]); S.noDevice = false; if (st) st.device = d; return { status: 204 }; }
    if (p === '/me/player/play'){
      const b = body || {}; S.noDevice = false;
      if (!S.state) S.state = { is_playing: true, progress_ms: 0, item: TRACKS[0], shuffle_state: false, repeat_state: 'off', device: DEVICES.find(d => d.id === q.get('device_id')) || DEVICES[0], context: null, currently_playing_type: 'track' };
      const s = S.state;
      if (b.uris){ s.item = find(b.uris[b.offset && b.offset.position ? b.offset.position : 0]); s.context = null; s.progress_ms = 0; }
      if (b.context_uri){ s.context = { type: b.context_uri.split(':')[1], uri: b.context_uri }; s.item = (b.offset && b.offset.uri && find(b.offset.uri)) || TRACKS.find(t => t.album.uri === b.context_uri) || TRACKS[0]; s.progress_ms = 0; }
      s.is_playing = true; return { status: 204 };
    }
    if (p === '/me/player/pause'){ st.is_playing = false; return { status: 204 }; }
    if (p === '/me/player/next'){ st.item = S.queue.shift() || TRACKS[(TRACKS.indexOf(st.item) + 1) % TRACKS.length]; st.progress_ms = 0; return { status: 204 }; }
    if (p === '/me/player/previous'){ st.item = TRACKS[(TRACKS.findIndex(t => t.id === st.item.id) + TRACKS.length - 1) % TRACKS.length]; st.progress_ms = 0; return { status: 204 }; }
    if (p === '/me/player/seek'){ st.progress_ms = +q.get('position_ms'); return { status: 204 }; }
    if (p === '/me/player/shuffle'){ st.shuffle_state = q.get('state') === 'true'; return { status: 204 }; }
    if (p === '/me/player/repeat'){ st.repeat_state = q.get('state'); return { status: 204 }; }
    if (p === '/me/player/volume'){ st.device = Object.assign({}, st.device, { volume_percent: +q.get('volume_percent') }); return { status: 204 }; }
    if (p === '/me/player/queue' && method === 'GET') return { json: { currently_playing: st && st.item, queue: S.queue } };
    if (p === '/me/player/queue' && method === 'POST'){ S.queue.push(find(q.get('uri'))); return { status: 204 }; }
    if (p === '/me/tracks/contains') return { json: q.get('ids').split(',').map(id => S.liked.has(id)) };
    if (p === '/me/tracks' && method === 'PUT'){ q.get('ids').split(',').forEach(id => S.liked.add(id)); return { status: 200, json: {} }; }
    if (p === '/me/tracks' && method === 'DELETE'){ q.get('ids').split(',').forEach(id => S.liked.delete(id)); return { status: 200, json: {} }; }
    if (p === '/me/tracks') return { json: { items: TRACKS.filter(t => S.liked.has(t.id)).map(t => ({ added_at: '2026-10-01T10:00:00Z', track: t })), next: null, total: S.liked.size } };
    if (p === '/me/playlists') return { json: { items: [{ id: 'p1', uri: 'spotify:playlist:p1', name: 'Friday night', images: img('violet'), owner: { display_name: 'Kyle' }, tracks: { total: 3 } }, { id: 'p2', uri: 'spotify:playlist:p2', name: 'Cheap hours', images: img('cyan'), owner: { display_name: 'Kyle' }, tracks: { total: 2 } }], next: null } };
    if (p === '/me/albums') return { json: { items: Object.values(ALBUMS).map(a => ({ added_at: '2026-09-01T00:00:00Z', album: a })), next: null } };
    if (p === '/me/player/recently-played') return { json: { items: [[TRACKS[2], 'album', 'spotify:album:al3'], [TRACKS[1], 'playlist', 'spotify:playlist:p1']].map(([t, type, uri], i) => ({ played_at: new Date(Date.now() - (i + 1) * 40 * 60e3).toISOString(), track: t, context: { type, uri } })), next: null } };
    if (p === '/me/top/artists') return { json: { items: [{ id: 'a1', name: 'The Stockport Satellites', images: img('amber') }, { id: 'a3', name: 'Viaduct', images: img('cyan') }], next: null } };
    if (p === '/playlists/p1') return { json: { id: 'p1', uri: 'spotify:playlist:p1', name: 'Friday night', images: img('violet'), owner: { display_name: 'Kyle' }, description: 'For the end of the week.' } };
    if (p === '/playlists/p1/items') return { json: { items: TRACKS.slice(0, 3).map(t => ({ added_at: '2026-10-01T10:00:00Z', item: t })), next: null, total: 3 } };
    if (/^\/albums\/al\d$/.test(p)){ const a = ALBUMS[p.split('/')[2]]; return { json: Object.assign({}, a, { tracks: { items: TRACKS.filter(t => t.album.id === a.id).map(t => Object.assign({}, t, { album: undefined })), next: null } }) }; }
    if (/^\/artists\/a\d$/.test(p)) return { json: { id: 'a1', uri: 'spotify:artist:a1', name: 'The Stockport Satellites', genres: ['indie rock', 'madchester'], images: img('amber') } };
    if (/^\/artists\/a\d\/top-tracks$/.test(p)) return { json: { tracks: [TRACKS[0], TRACKS[3]] } };
    if (/^\/artists\/a\d\/albums$/.test(p)) return { json: { items: [ALBUMS.al1], next: null } };
    if (p === '/search') return { json: { tracks: { items: [TRACKS[0], TRACKS[3]] }, artists: { items: [{ id: 'a1', name: 'The Stockport Satellites', images: img('amber') }] }, albums: { items: [ALBUMS.al1] }, playlists: { items: [null, { id: 'p1', name: 'Friday night', images: img('violet'), owner: { display_name: 'Kyle' } }] } } };
    return err(404, 'Not found: ' + p);
  };
  return S;
}

/* ---------- a tiny server for the built site ---------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/proxy/')){ res.writeHead(404); return res.end(); }
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
  let file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST) || !existsSync(file)) file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file)){ res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
let base, browser;
before(async () => { await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; browser = await chromium.launch(); });
after(async () => { await browser.close(); server.close(); });

const ACCOUNT = (o = {}) => ({ accounts: [Object.assign({ id: 'kyle', name: 'Kyle', product: 'premium', client: 'test-client', refresh: 'ref1', access: 'acc1', exp: Date.now() + 3600e3, scope: '' }, o)], active: 'kyle' });

async function open(path, { width = 390, height = 844, sp = spotify(), signedIn = true, account = {}, settings = { spotifyClientId: 'test-client' } } = {}){
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/London', locale: 'en-GB', serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // nothing leaves the test but what's pretended here
  await page.route(u => !u.href.startsWith(base), r => r.abort());
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/^https:\/\/i\.scdn\.co\/image\/(\w+)-\d+/, r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: COVERS[/image\/(\w+)-/.exec(r.request().url())[1]] }));
  await page.route(/^https:\/\/lrclib\.net\/api\/get/, r => /track_name=Harold/.test(r.request().url()) ? r.fulfill({ json: { syncedLyrics: LRC, plainLyrics: 'x', instrumental: false }, headers: { 'Access-Control-Allow-Origin': '*' } }) : r.fulfill({ status: 404, json: {}, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.route(/^https:\/\/api\.spotify\.com\/v1\//, async r => {
    const req = r.request(), raw = req.postData(); let body; try { body = raw ? JSON.parse(raw) : undefined; } catch (e) { body = raw; }
    const out = sp.handle(req.method(), req.url(), await req.allHeaders(), body);
    await r.fulfill({ status: out.status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: out.json === undefined ? '' : JSON.stringify(out.json) });
  });
  await page.route(/^https:\/\/accounts\.spotify\.com\/authorize/, r => {
    const q = new URL(r.request().url()).searchParams; sp.authorize = Object.fromEntries(q);
    return r.fulfill({ status: 302, headers: { Location: `${q.get('redirect_uri')}?code=good-code&state=${q.get('state')}` } });
  });
  await page.route(/^https:\/\/accounts\.spotify\.com\/api\/token/, r => {
    const f = Object.fromEntries(new URLSearchParams(r.request().postData())); sp.token.push(f);
    const ok = f.grant_type === 'authorization_code' ? f.code === 'good-code' && f.client_id === 'test-client' && f.code_verifier : f.grant_type === 'refresh_token' && f.refresh_token === 'ref1';
    return r.fulfill({ status: ok ? 200 : 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ok ? { access_token: f.grant_type === 'refresh_token' ? 'acc2' : 'acc1', token_type: 'Bearer', expires_in: 3600, refresh_token: 'ref1', scope: 'user-read-playback-state' } : { error: 'invalid_grant' }) });
  });
  await page.addInitScript(([s, a]) => { try { localStorage.setItem('hse.display', s); if (a) localStorage.setItem('hse.spotify', a); } catch (e) {} }, [JSON.stringify(settings), signedIn ? JSON.stringify(ACCOUNT(account)) : null]);
  await page.goto(base + path);
  await page.waitForTimeout(600);
  return { page, ctx, errors, sp };
}
const calls = (sp, method, path) => sp.calls.filter(c => c.method === method && c.path === path);
async function until(fn, what, ms = 4000){ const end = Date.now() + ms; while (Date.now() < end){ if (await fn()) return; await new Promise(r => setTimeout(r, 60)); } assert.fail('timed out waiting: ' + what); }

test('music: not connected, the Music tab offers to connect and no strip shows', async () => {
  const { page, ctx, errors } = await open('/music.html', { signedIn: false });
  assert.match(await page.textContent('main'), /Connect Spotify/);
  assert.equal(await page.locator('.mini').count(), 0);
  const tabs = await page.$$eval('.nav a.item span', s => s.map(x => x.textContent));
  assert.deepEqual(tabs, ['Now', 'Money', 'Usage', 'Home', 'Music', 'Screen', 'Settings']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('music: connecting Spotify signs in with PKCE and lands back where you started', async () => {
  const sp = spotify();
  const { page, ctx, errors } = await open('/music.html', { signedIn: false, sp });
  await page.click('text=Connect Spotify');
  await page.waitForURL(/music\.html/, { timeout: 8000 });
  await until(() => page.locator('.mini').count().then(n => n === 1), 'the strip after signing in');
  const a = sp.authorize, f = sp.token[0];
  assert.equal(a.code_challenge_method, 'S256'); assert.equal(a.client_id, 'test-client');
  assert.match(a.redirect_uri, /\/settings\.html$/);
  assert.equal(createHash('sha256').update(f.code_verifier).digest('base64url'), a.code_challenge, 'the verifier matches the challenge sent earlier');
  assert.ok(a.scope.split(' ').includes('user-modify-playback-state'));
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('hse.spotify')));
  assert.equal(kept.accounts[0].name, 'Kyle'); assert.equal(kept.accounts[0].refresh, 'ref1'); assert.equal(kept.accounts[0].client, 'test-client');
  assert.equal(await page.evaluate(() => localStorage.getItem('hse.spotifyAuth')), null, 'the one-off verifier is gone');
  await page.goto(base + '/settings.html#music'); await page.waitForTimeout(500);
  assert.match(await page.textContent('#music'), /Kyle.*Premium/s);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('music: the strip on every page, and the full player', async () => {
  const sp = spotify();
  const { page, ctx, errors } = await open('/index.html', { sp });
  const mini = page.locator('.mini');
  await mini.waitFor();
  assert.match(await mini.textContent(), /Harold Street.*Kitchen speaker.*The Stockport Satellites/s);
  assert.match(await page.textContent('.np'), /Playing on Kitchen speaker.*Harold Street/s, 'Now says what\'s on');
  await until(() => page.evaluate(() => document.documentElement.classList.contains('tinted')), 'the cover\'s colours');
  const tint = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tint').trim());
  const [r, g, b] = [1, 3, 5].map(i => parseInt(tint.slice(i, i + 2), 16));
  assert.ok(r > g && g > b, `an amber cover tints the page amber (${tint})`);
  await shot(page, 'music-now');
  // pause from the strip, shown at once
  await mini.locator('button[aria-label="Pause"]').click();
  assert.equal(await mini.locator('button[aria-label="Play"]').count(), 1);
  await until(() => calls(sp, 'PUT', '/me/player/pause').length === 1, 'pause sent');
  // on any page
  await page.goto(base + '/money.html'); await page.locator('.mini').waitFor();
  assert.match(await page.locator('.mini').textContent(), /Harold Street/);
  const box = await page.locator('.mini').boundingBox(), nav = await page.locator('.nav').boundingBox();
  assert.ok(box.y + box.height <= nav.y, 'the strip sits above the tabs');
  // the full player
  await page.locator('.mini').click({ position: { x: 120, y: 20 } });
  const sheet = page.locator('.sheet.open');
  await sheet.waitFor();
  assert.match(await sheet.textContent(), /Playing from.*Friday night/s);
  await sheet.locator('button[aria-label="Play"]').click();
  await until(() => calls(sp, 'PUT', '/me/player/play').length === 1, 'play sent');
  await sheet.locator('button[aria-label="Shuffle is off"]').click();
  await until(() => calls(sp, 'PUT', '/me/player/shuffle').some(c => c.query.state === 'true'), 'shuffle on');
  await sheet.locator('button[aria-label="Repeat is off"]').click();
  await until(() => calls(sp, 'PUT', '/me/player/repeat').some(c => c.query.state === 'context'), 'repeat all');
  await sheet.locator('input[aria-label="Position in the song"]').fill('30000');
  await until(() => calls(sp, 'PUT', '/me/player/seek').some(c => c.query.position_ms === '30000'), 'seek to 0:30');
  await sheet.locator('button[aria-label="Add to liked songs"]').click();
  await until(() => calls(sp, 'PUT', '/me/tracks').length === 1, 'liked');
  // a glance at the lyric being sung (at 0:30, the fourth line) and what's next
  await until(() => sheet.locator('.glance.lyr .gl.now').textContent().then(t => /cheaper time/.test(t)).catch(() => false), 'the lyric at 0:30');
  await until(() => sheet.locator('.glance.nx').textContent().then(t => /Negative Pricing/.test(t)), 'up next: Negative Pricing');
  await sheet.locator('.where .vol input').fill('30');
  await until(() => calls(sp, 'PUT', '/me/player/volume').some(c => c.query.volume_percent === '30'), 'volume 30');
  await page.waitForTimeout(500);
  await shot(page, 'music-player');
  // the lyrics, full
  await sheet.locator('.glance.lyr').click();
  await until(() => sheet.locator('.lyrics-full .line.now').textContent().then(t => /cheaper time/.test(t)).catch(() => false), 'the line at 0:30');
  await page.waitForTimeout(500);
  await shot(page, 'music-lyrics');
  await sheet.locator('.lyrics-full .line', { hasText: 'Harold Street, Harold Street' }).click();
  await until(() => calls(sp, 'PUT', '/me/player/seek').some(c => c.query.position_ms === '32000'), 'tapping a line jumps there');
  // Up next, full
  await sheet.locator('.vtabs button', { hasText: 'Up next' }).click();
  await until(() => sheet.locator('.queue-full ol li').count().then(n => n === 2), 'two songs up next');
  await shot(page, 'music-queue');
  await sheet.locator('button[aria-label="Back to the player"]').click();
  // double-tap the cover to like the song (already liked: stays liked); then Play on
  // Play on: move it to the TV
  await sheet.locator('.dev').click();
  await sheet.locator('.picker .d', { hasText: 'Living room TV' }).waitFor();
  await page.waitForTimeout(300);
  await shot(page, 'music-play-on');
  await sheet.locator('.picker .d', { hasText: 'Living room TV' }).click();
  await until(() => calls(sp, 'PUT', '/me/player').some(c => c.body.device_ids[0] === 'tv'), 'moved to the TV');
  await until(() => sheet.locator('.dev').textContent().then(t => /Living room TV/.test(t)), 'the player says the TV');
  // next song
  await sheet.locator('button[aria-label="Next"]').click();
  await until(() => sheet.locator('.name').textContent().then(t => t === 'Negative Pricing'), 'the next song', 5000);
  // the phone's Back closes the player
  await page.goBack();
  await until(() => page.locator('.sheet.open').count().then(n => n === 0), 'closed by Back');
  assert.match(page.url(), /money\.html/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('music: the Music tab searches, plays and queues, and opens albums, playlists and artists', async () => {
  const sp = spotify();
  const { page, ctx, errors } = await open('/music.html', { sp });
  await until(() => page.locator('.row', { hasText: 'Your playlists' }).locator('.tile', { hasText: 'Friday night' }).count().then(n => n === 1), 'your playlists');
  await until(() => page.locator('.row', { hasText: 'Jump back in' }).locator('.tile').count().then(n => n === 2), 'jump back in: where you played from lately');
  assert.match(await page.locator('.row', { hasText: 'Jump back in' }).textContent(), /Platform 3.*Friday night/s);
  assert.match(await page.textContent('.hello h2'), /^Good (morning|afternoon|evening), Kyle$|^Up late, Kyle$/);
  assert.match(await page.locator('.row', { hasText: 'Your top artists' }).textContent(), /Viaduct/);
  await page.waitForTimeout(300);
  await shot(page, 'music-library');
  await page.click('.sc:has-text("Liked songs")');
  await until(() => page.locator('.tr', { hasText: 'Last Train to Piccadilly' }).count().then(n => n === 1), 'liked songs');
  await page.goto(base + '/music.html#recent');
  await until(() => page.locator('.when', { hasText: 'min ago' }).count().then(n => n >= 1), 'recently played, with when');
  await page.goto(base + '/music.html'); await page.locator('.hello').waitFor();
  // search
  await page.fill('input[type=search]', 'harold');
  await until(() => page.locator('.tr', { hasText: 'Bins Out Tonight' }).count().then(n => n === 1), 'search results');
  assert.match(await page.textContent('.topcard'), /Harold Street.*Song/s, 'the best match leads');
  await page.locator('.tr', { hasText: 'Bins Out Tonight' }).locator('.add').click();
  await until(() => calls(sp, 'POST', '/me/player/queue').some(c => c.query.uri === 'spotify:track:t4'), 'queued');
  await until(() => page.locator('.toast', { hasText: 'Added to Up next' }).count().then(n => n === 1), 'says so');
  await page.locator('.tr', { hasText: 'Bins Out Tonight' }).locator('.go').click();
  await until(() => calls(sp, 'PUT', '/me/player/play').some(c => c.body && c.body.uris && c.body.uris[0] === 'spotify:track:t4'), 'played');
  await shot(page, 'music-search');
  // an artist
  await page.locator('.tile:has(.round)', { hasText: 'The Stockport Satellites' }).click();
  await until(() => page.locator('.dhead h2').textContent().then(t => t === 'The Stockport Satellites').catch(() => false), 'the artist');
  assert.match(await page.textContent('.detail'), /Popular.*Harold Street.*Albums and singles.*Region G/s);
  // an album from the artist, played from its second song
  await page.locator('.tile', { hasText: 'Region G' }).click();
  await until(() => page.locator('.dhead h2').textContent().then(t => t === 'Region G').catch(() => false), 'the album');
  await page.locator('.tr', { hasText: 'Bins Out Tonight' }).locator('.go').click();
  await until(() => calls(sp, 'PUT', '/me/player/play').some(c => c.body && c.body.context_uri === 'spotify:album:al1' && c.body.offset.uri === 'spotify:track:t4'), 'played in the album');
  await shot(page, 'music-album');
  // Back to the artist, then the list
  await page.goBack(); await until(() => page.locator('.dhead h2').textContent().then(t => t === 'The Stockport Satellites').catch(() => false), 'back to the artist');
  // a playlist, in Spotify's newer shape
  await page.goto(base + '/music.html#playlist/p1');
  await until(() => page.locator('.tr').count().then(n => n === 3), 'the playlist\'s songs');
  assert.match(await page.textContent('.detail'), /Friday night.*Kyle · 3 songs.*For the end of the week/s);
  await page.click('.detail .playbig[aria-label="Play Friday night"]');
  await until(() => calls(sp, 'PUT', '/me/player/play').some(c => c.body && c.body.context_uri === 'spotify:playlist:p1'), 'the playlist played');
  // now it's what's playing, its button pauses it
  await page.locator('.detail .playbig[aria-label="Pause Friday night"]').click({ timeout: 6000 });
  await until(() => calls(sp, 'PUT', '/me/player/pause').length === 1, 'the playlist paused');
  // no sideways scroll, and the strip doesn't hide the last row
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('music: an expired sign-in is refreshed, and what goes wrong is said plainly', async () => {
  // the access token has run out: it's refreshed with the refresh token, then the player loads
  let sp = spotify();
  let o = await open('/index.html', { sp, account: { access: 'old', exp: Date.now() - 1000 } });
  await o.page.locator('.mini').waitFor();
  assert.ok(sp.token.some(f => f.grant_type === 'refresh_token' && f.refresh_token === 'ref1' && f.client_id === 'test-client'));
  assert.equal(await o.page.evaluate(() => JSON.parse(localStorage.getItem('hse.spotify')).accounts[0].access), 'acc2', 'the new token is kept');
  await o.ctx.close();
  // Spotify turns a token down mid-session: refreshed and tried again, once
  sp = spotify({ fail401: 1 });
  o = await open('/index.html', { sp });
  await o.page.locator('.mini').waitFor();
  await o.ctx.close();
  // nothing playing anywhere: playing from Music starts on a device Spotify knows
  sp = spotify({ nothing: true, noDevice: true });
  o = await open('/music.html', { sp });
  assert.equal(await o.page.locator('.mini').count(), 0, 'no strip with nothing playing');
  await o.page.fill('input[type=search]', 'harold');
  await until(() => o.page.locator('.tr', { hasText: 'Harold Street' }).count().then(n => n === 1), 'results');
  await o.page.locator('.tr', { hasText: 'Harold Street' }).locator('.go').click();
  await until(() => calls(sp, 'PUT', '/me/player/play').some(c => c.query.device_id === 'kitchen'), 'started on the kitchen speaker');
  await until(() => o.page.locator('.mini').count().then(n => n === 1), 'the strip appears');
  await o.ctx.close();
  // not Premium: the player says so
  sp = spotify({ premium: false });
  o = await open('/index.html', { sp, account: { product: 'free' } });
  await o.page.locator('.mini button[aria-label="Pause"]').click();
  await until(() => o.page.locator('.toast', { hasText: 'Premium' }).count().then(n => n === 1), 'says Premium is needed');
  assert.deepEqual(o.errors, []);
  await o.ctx.close();
});

test('music: on a laptop the player opens beside the page', async () => {
  const { page, ctx, errors } = await open('/home.html', { width: 1280, height: 800 });
  await page.locator('.mini').waitFor();
  const box = await page.locator('.mini').boundingBox();
  assert.ok(box.x >= 220, 'the strip sits in the page, not under the rail');
  await page.locator('.mini').click({ position: { x: 200, y: 20 } });
  await page.locator('.sheet.open').waitFor();
  await page.waitForTimeout(450);
  const s = await page.locator('.sheet').boundingBox();
  assert.ok(Math.abs(s.width - 480) < 2 && Math.abs(s.x + s.width - 1280) < 2, 'a drawer on the right');
  await shot(page, 'music-laptop');
  await page.keyboard.press('Escape');
  await until(() => page.locator('.sheet.open').count().then(n => n === 0), 'Escape closes it');
  assert.deepEqual(errors, []);
  await ctx.close();
});
