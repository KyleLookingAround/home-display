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
// Spotify's covers have 40-character ids; these say which colour and size they are.
const ID2C = {};
const cid = (c, w) => { const id = { amber: 'a', violet: 'b', cyan: 'c' }[c] + w.toString(16).padStart(4, '0') + '0'.repeat(35); ID2C[id] = c; return 'https://i.scdn.co/image/' + id; };
const img = c => [640, 300, 64].map(w => ({ url: cid(c, w), width: w, height: w }));
const ALBUMS = {
  al1: { id: 'al1', uri: 'spotify:album:al1', name: 'Region G', release_date: '2026-09-04', images: img('amber'), artists: [{ id: 'a1', name: 'The Stockport Satellites' }] },
  al2: { id: 'al2', uri: 'spotify:album:al2', name: 'Half-Hourly', release_date: '2025-03-01', images: img('violet'), artists: [{ id: 'a2', name: 'Agile Hearts' }] },
  al3: { id: 'al3', uri: 'spotify:album:al3', name: 'Platform 3', release_date: '2024-05-17', images: img('cyan'), artists: [{ id: 'a3', name: 'Viaduct' }] }
};
const tr = (id, name, al, artist, ms) => ({ id, uri: 'spotify:track:' + id, name, duration_ms: ms, explicit: false, is_playable: true, type: 'track', album: ALBUMS[al], external_ids: { isrc: 'GBTEST26000' + id.slice(1) }, artists: [{ id: artist[0], name: artist[1], uri: 'spotify:artist:' + artist[0] }] });
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
/* ---------- the pretend open music libraries: MusicBrainz, Wikidata, Wikipedia, the Cover Art Archive ---------- */
const MBX = {
  '/isrc/GBTEST260001': { recordings: [{ id: 'r1', title: 'Harold Street', 'first-release-date': '2026-09-04', 'artist-credit': [{ name: 'The Stockport Satellites', artist: { id: 'mba1', name: 'The Stockport Satellites' } }] }] },
  '/recording/r1': { id: 'r1', title: 'Harold Street', 'first-release-date': '2026-09-04', 'artist-credit': [{ name: 'The Stockport Satellites', artist: { id: 'mba1', name: 'The Stockport Satellites' } }],
    releases: [{ id: 'rel1', title: 'Region G', date: '2026-09-04', status: 'Official' }],
    relations: [{ type: 'vocal', attributes: ['lead vocals'], artist: { id: 'p1', name: 'Sam Rivers' } }, { type: 'instrument', attributes: ['electric guitar'], artist: { id: 'p2', name: 'Jo Platt' } },
      { type: 'producer', attributes: [], artist: { id: 'p4', name: 'Martin Hannett' } }, { type: 'recorded at', place: { id: 'pl1', name: 'Strawberry Studios' } }, { type: 'performance', work: { id: 'w1', title: 'Harold Street' } }] },
  '/work/w1': { id: 'w1', relations: [{ type: 'composer', artist: { id: 'p1', name: 'Sam Rivers' } }, { type: 'lyricist', artist: { id: 'p1', name: 'Sam Rivers' } }, { type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q100' } }] },
  '/place/pl1': { id: 'pl1', name: 'Strawberry Studios', area: { name: 'Stockport' } },
  '/artist/mba1': { id: 'mba1', name: 'The Stockport Satellites', type: 'Group', 'begin-area': { name: 'Stockport' }, 'life-span': { begin: '2019' }, relations: [{ type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q200' } }] },
  '/artist': { artists: [{ id: 'mba1', name: 'The Stockport Satellites', score: 100 }] }
};
const WIKI = { Q100: 'Harold Street (song)', Q200: 'The Stockport Satellites' };
const SUMMARY = { 'Harold_Street_(song)': '"Harold Street" is a song by the Stockport Satellites, written about the street where the band rehearsed. It was recorded at Strawberry Studios in Stockport in a single night.',
  The_Stockport_Satellites: 'The Stockport Satellites are a band from Stockport, formed in 2019. Their songs are about trains, bins and the price of electricity.' };
const CORS = { 'Access-Control-Allow-Origin': '*' };
async function openLibraries(page){
  await page.route(/^https:\/\/musicbrainz\.org\/ws\/2\//, r => { const u = new URL(r.request().url()), k = u.pathname.replace('/ws/2', ''); return MBX[k] ? r.fulfill({ json: MBX[k], headers: CORS }) : r.fulfill({ status: 404, json: { error: 'Not Found' }, headers: CORS }); });
  await page.route(/^https:\/\/www\.wikidata\.org\/w\/api\.php/, r => { const id = new URL(r.request().url()).searchParams.get('ids'); return r.fulfill({ json: { entities: { [id]: { sitelinks: WIKI[id] ? { enwiki: { title: WIKI[id] } } : {} } } }, headers: CORS }); });
  await page.route(/^https:\/\/en\.wikipedia\.org\/api\/rest_v1\/page\/summary\//, r => { const t = decodeURIComponent(r.request().url().split('/summary/')[1]); return SUMMARY[t] ? r.fulfill({ json: { type: 'standard', title: t.replace(/_/g, ' '), extract: SUMMARY[t], content_urls: { mobile: { page: 'https://en.m.wikipedia.org/wiki/' + t } } }, headers: CORS }) : r.fulfill({ status: 404, json: {}, headers: CORS }); });
  await page.route(/^https:\/\/coverartarchive\.org\/release\/rel1$/, r => r.fulfill({ json: { images: [['Back', 'violet'], ['Front', 'amber'], ['Booklet', 'cyan']].map(([t, c]) => ({ types: [t], front: t === 'Front', image: cid(c, 640), thumbnails: { 500: cid(c, 300) } })) }, headers: CORS }));
}
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
    if (p === '/me/player/queue' && method === 'POST'){ S.queue.unshift(find(q.get('uri'))); return { status: 204 }; }
    if (/^\/tracks\/\w+$/.test(p)){ const t = TRACKS.find(x => x.id === p.split('/')[2]); return t ? { json: t } : err(404, 'Non existing id'); }
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

const ACCOUNT = (o = {}) => ({ accounts: [Object.assign({ id: 'kyle', name: 'Kyle', product: 'premium', client: 'feedc0ffee0123456789abcdef012345', refresh: 'ref1', access: 'acc1', exp: Date.now() + 3600e3, scope: '' }, o)], active: 'kyle' });

async function open(path, { width = 390, height = 844, sp = spotify(), signedIn = true, account = {}, settings = { spotifyClientId: 'feedc0ffee0123456789abcdef012345' }, keep = {} } = {}){
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/London', locale: 'en-GB', serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // nothing leaves the test but what's pretended here
  await page.route(u => !u.href.startsWith(base), r => r.abort());
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/^https:\/\/i\.scdn\.co\/image\/[0-9a-f]{40}$/, r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: COVERS[ID2C[r.request().url().split('/').pop()]] }));
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
    const ok = f.grant_type === 'authorization_code' ? f.code === 'good-code' && f.client_id === 'feedc0ffee0123456789abcdef012345' && f.code_verifier : f.grant_type === 'refresh_token' && f.refresh_token === 'ref1';
    return r.fulfill({ status: ok ? 200 : 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ok ? { access_token: f.grant_type === 'refresh_token' ? 'acc2' : 'acc1', token_type: 'Bearer', expires_in: 3600, refresh_token: 'ref1', scope: 'user-read-playback-state' } : { error: 'invalid_grant' }) });
  });
  await openLibraries(page);
  await page.addInitScript(([s, a, k]) => { try { localStorage.setItem('hse.display', s); if (a) localStorage.setItem('hse.spotify', a); for (const x in k) localStorage.setItem(x, k[x]); } catch (e) {} }, [JSON.stringify(settings), signedIn ? JSON.stringify(ACCOUNT(account)) : null, keep]);
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
  assert.equal(a.code_challenge_method, 'S256'); assert.equal(a.client_id, 'feedc0ffee0123456789abcdef012345');
  assert.match(a.redirect_uri, /\/settings\.html$/);
  assert.equal(createHash('sha256').update(f.code_verifier).digest('base64url'), a.code_challenge, 'the verifier matches the challenge sent earlier');
  assert.ok(a.scope.split(' ').includes('user-modify-playback-state'));
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('hse.spotify')));
  assert.equal(kept.accounts[0].name, 'Kyle'); assert.equal(kept.accounts[0].refresh, 'ref1'); assert.equal(kept.accounts[0].client, 'feedc0ffee0123456789abcdef012345');
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
  assert.match(await page.textContent('.now-answer .label'), /^(Good (morning|afternoon|evening)|Up late), Kyle · Playing on Kitchen speaker$/);
  assert.match(await page.textContent('.now-answer .big'), /Harold Street/, 'the page opens with what\'s playing');
  assert.match(await page.locator('.row', { hasText: 'Your top artists' }).textContent(), /Viaduct/);
  await page.waitForTimeout(300);
  await shot(page, 'music-library');
  await page.click('.sc:has-text("Liked songs")');
  await until(() => page.locator('.tr', { hasText: 'Last Train to Piccadilly' }).count().then(n => n === 1), 'liked songs');
  await page.goto(base + '/music.html#recent');
  await until(() => page.locator('.when', { hasText: 'min ago' }).count().then(n => n >= 1), 'recently played, with when');
  await page.goto(base + '/music.html'); await page.locator('.sbox').waitFor();
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
  assert.match(await page.textContent('main'), /Popular.*Harold Street.*Albums and singles.*Region G/s);
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
  assert.match(await page.textContent('main'), /Friday night.*Kyle\s*3 songs · 10 min.*For the end of the week/s);
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
  assert.ok(sp.token.some(f => f.grant_type === 'refresh_token' && f.refresh_token === 'ref1' && f.client_id === 'feedc0ffee0123456789abcdef012345'));
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

test('music: about this song, liner notes, vinyl mode and sharing', async () => {
  const { page, ctx, errors } = await open('/index.html', { sp: spotify() });
  await page.locator('.mini').click({ position: { x: 120, y: 20 } });
  const sheet = page.locator('.sheet.open');
  await sheet.waitFor();
  // the glance fills in once MusicBrainz has answered (a request a second)
  await until(() => sheet.locator('.glance.ab').textContent().then(t => /Recorded at Strawberry Studios, Stockport/.test(t)), 'the local badge', 12000);
  await sheet.locator('.glance.ab').click();
  const about = sheet.locator('.about');
  assert.match(await about.textContent(), /The story.*recorded at Strawberry Studios in Stockport in a single night/s);
  assert.match(await about.textContent(), /Words and music\s*Sam Rivers.*Lead vocals\s*Sam Rivers.*Electric guitar\s*Jo Platt.*Produced by\s*Martin Hannett.*Recorded at\s*Strawberry Studios, Stockport.*First released\s*4 Sep 2026.*Album\s*Region G/s);
  assert.match(await about.locator('.acard').textContent(), /From Stockport, formed 2019/);
  await page.waitForTimeout(300);
  await shot(page, 'music-about');
  // liner notes: the front cover first
  await sheet.locator('.vtabs button', { hasText: 'Liner notes' }).click();
  await until(() => sheet.locator('.notes figure').count().then(n => n === 3), 'three pages');
  assert.match(await sheet.locator('.notes figcaption').first().textContent(), /Front cover/);
  assert.match(await sheet.locator('.notes .count').textContent(), /1 of 3/);
  await page.waitForTimeout(400);
  await shot(page, 'music-liner-notes');
  // vinyl mode, from More
  await sheet.locator('button[aria-label="Back to the player"]').click();
  await sheet.locator('button[aria-label="More"]').click();
  await page.locator('.sheet-panel .opt', { hasText: 'Vinyl mode' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('hse.musicVinyl')), '1', 'remembered');
  await page.keyboard.press('Escape');
  await sheet.locator('.tt.playing').waitFor();
  assert.equal(await sheet.locator('.tt .record').evaluate(e => getComputedStyle(e).animationPlayState), 'running', 'the record turns while it plays');
  await page.waitForTimeout(1300);
  await shot(page, 'music-vinyl');
  // sharing: a code that scans back to the song's link
  await sheet.locator('button[aria-label="More"]').click();
  await page.locator('.sheet-panel .opt', { hasText: 'Share this song' }).click();
  await page.locator('.share .qr svg').waitFor();
  const { data, w, h } = await page.evaluate(async () => {
    const svg = document.querySelector('.share .qr svg'), xml = new XMLSerializer().serializeToString(svg);
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 400); x.drawImage(img, 0, 0, 400, 400);
    return { data: Array.from(x.getImageData(0, 0, 400, 400).data), w: 400, h: 400 };
  });
  const jsQR = (await import('jsqr')).default;
  const read = jsQR(new Uint8ClampedArray(data), w, h);
  assert.equal(read && read.data, 'https://open.spotify.com/track/t1', 'the code opens the song in Spotify');
  await shot(page, 'music-share');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('music: an artist\'s story, and the record shelf', async () => {
  const sp = spotify();
  const { page, ctx, errors } = await open('/music.html#artist/a1', { sp });
  await until(() => page.locator('.bio').textContent().then(t => /Made in Greater Manchester · from Stockport.*Formed 2019.*trains, bins and the price of electricity/s.test(t)).catch(() => false), 'the artist\'s story', 12000);
  await page.waitForTimeout(300);
  await shot(page, 'music-artist');
  await page.goto(base + '/music.html#shelf');
  await until(() => page.locator('.sleeve').count().then(n => n === 3), 'the albums on the shelf');
  assert.match(await page.locator('.shelf .ct').textContent(), /Region G/);
  await page.locator('button[aria-label="Next album"]').click();
  await until(() => page.locator('.shelf .ct').textContent().then(t => /Half-Hourly/.test(t)), 'flipped to the next');
  await page.waitForTimeout(500);
  await shot(page, 'music-shelf');
  await page.locator('.shelf .playbig').click();
  await until(() => calls(sp, 'PUT', '/me/player/play').some(c => c.body && c.body.context_uri === 'spotify:album:al2'), 'played from the shelf');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('music: looks like the rest of the app, sharp corners and all', async () => {
  const sp = spotify();
  const { page, ctx, errors } = await open('/music.html', { sp });
  await page.locator('.mini').waitFor();
  const look = () => page.evaluate(() => {
    const cs = s => getComputedStyle(document.querySelector(s));
    return { strip: cs('.mini').borderTopLeftRadius, card: cs('main .card').borderTopLeftRadius, label: cs('main .card .label').fontFamily, answer: cs('.now-answer .big').fontFamily, play: cs('.mini .ib.play').borderTopColor };
  });
  const round = await look();
  assert.equal(round.strip, '14px'); assert.equal(round.card, '14px');
  assert.match(round.label, /JetBrains Mono/, 'card labels in the app\'s mono');
  assert.match(round.answer, /Syncopate/, 'the answer in the app\'s display face');
  await page.evaluate(() => { localStorage.setItem('hse.corners', 'sharp'); });
  await page.reload(); await page.locator('.mini').waitFor();
  const sharp = await look();
  assert.equal(sharp.strip, '4px', 'the strip follows the corners setting'); assert.equal(sharp.card, '4px');
  await page.locator('.mini').click({ position: { x: 120, y: 20 } });
  await page.locator('.sheet.open').waitFor();
  const play = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet .ctl .big')).backgroundColor);
  assert.equal(play, 'rgb(79, 214, 255)', 'the play button is the app\'s cyan');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sheet .glance')).borderTopLeftRadius), '4px');
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- the TV ---------- */
// ntfy.sh, faked: each stream delivers the given messages, and what's sent is kept.
async function relay(page, deliver, retry = 60000){
  const sent = [];
  await page.route(/^https:\/\/ntfy\.sh\//, async r => {
    const req = r.request();
    if (req.method() === 'POST'){ sent.push({ topic: new URL(req.url()).pathname.slice(1), msg: JSON.parse(req.postData() || '{}') }); return r.fulfill({ json: { event: 'message' }, headers: CORS }); }
    const body = deliver(new URL(req.url()).pathname.split('/')[1]).map(m => 'data: ' + JSON.stringify({ event: 'message', message: JSON.stringify(m) }) + '\n\n').join('');
    return r.fulfill({ status: 200, contentType: 'text/event-stream', headers: CORS, body: `retry: ${retry}\n\n` + body });
  });
  return sent;
}
/** Every bit of text showing on the TV is at least 24px, the ten-foot rule. */
const smallText = page => page.evaluate(() => [...document.querySelectorAll('section[data-mode="music"] *')].filter(e => e.offsetWidth && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
  .filter(e => parseFloat(getComputedStyle(e).fontSize) < 23.9).map(e => e.tagName + '.' + e.className + ': ' + e.textContent.slice(0, 30)));

test('music on the TV: signed in from the phone, sealed, then the Music view with the remote', async () => {
  const LOCK = 'a1b2c3-hashed-pin', CODE = 'ABCDEFGH';
  // the phone: paired with the TV, signed in to Spotify itself, and unlocked with the site PIN
  const phone = await open('/screen.html', { keep: { staticrypt_passphrase: LOCK, 'hse.remoteTV': CODE } });
  const fromTv = { from: 'screen', state: { mode: 'today', shown: 'today', at: Date.now(), spotify: 'Kyle', sleepAt: 0 } };
  const phoneSent = await relay(phone.page, () => [fromTv]);
  await phone.page.reload();
  const card = phone.page.locator('#spotify');
  await until(() => card.textContent().then(t => /The TV plays as\s*Kyle/.test(t)).catch(() => false), 'the TV says who it plays as', 8000);
  await card.locator('.actions button', { hasText: 'Add someone to the TV' }).click();
  await phone.page.waitForURL(/screen\.html#spotify/, { timeout: 8000 });
  assert.equal(phone.sp.authorize.show_dialog, 'true', 'Spotify asks which account, for the TV');
  await until(() => phoneSent.some(s => s.msg.cmd === 'account' && s.msg.box), 'the sign-in sealed and sent', 8000);
  const sealed = phoneSent.find(s => s.msg.cmd === 'account').msg;
  assert.doesNotMatch(JSON.stringify(sealed), /ref1|acc1|kyle/i, 'the relay sees only the sealed box');
  const mine = await phone.page.evaluate(() => JSON.parse(localStorage.getItem('hse.spotify')));
  assert.equal(mine.accounts.length, 1, 'the phone keeps only its own sign-in');
  // the sleep timer and favourites, from the phone
  await card.locator('.seg button', { hasText: '30 min' }).click();
  await until(() => phoneSent.some(s => s.msg.cmd === 'sleep' && s.msg.mins === 30), 'sleep in 30 minutes sent');
  await card.locator('button', { hasText: 'Choose favourites' }).click();
  await card.locator('.pick button', { hasText: 'Cheap hours' }).click();
  await card.locator('.pick button', { hasText: 'Region G' }).click();
  assert.match(await card.locator('.pick button', { hasText: 'Region G' }).textContent(), /2$/, 'numbered in the order chosen');
  await phone.page.waitForTimeout(300);
  await shot(phone.page, 'music-screen-tv');
  await card.locator('button', { hasText: 'Send to the TV' }).click();
  await until(() => phoneSent.some(s => s.msg.cmd === 'favs'), 'favourites sent');
  const favs = phoneSent.find(s => s.msg.cmd === 'favs').msg.favs;
  assert.deepEqual(favs.map(f => f.uri), ['spotify:playlist:p2', 'spotify:album:al1']);
  // and from the player, wherever you are: More, then Sleep timer
  await phone.page.evaluate(() => scrollTo(0, 0));
  await phone.page.locator('.mini').click({ position: { x: 120, y: 20 } });
  await phone.page.locator('.sheet.open button[aria-label="More"]').click();
  await phone.page.locator('.sheet-panel .opt', { hasText: 'Sleep timer' }).click();
  await phone.page.locator('.sheet-panel[aria-label="Sleep timer"]').waitFor();
  await phone.page.waitForTimeout(400);
  await shot(phone.page, 'music-sleep');
  await phone.page.locator('.sheet-panel .opt', { hasText: 'At the end of this song' }).click();
  await until(() => phoneSent.some(s => s.msg.cmd === 'sleep' && s.msg.song === true), 'stop at the end of the song, sent');
  assert.deepEqual(phone.errors, []);
  await phone.ctx.close();

  // the TV: no Spotify of its own until the sealed box arrives
  const tv = await open('/display.html#music', { width: 1920, height: 1080, signedIn: false, settings: {}, keep: { staticrypt_passphrase: LOCK, 'hse.remote': CODE } });
  const tvSent = await relay(tv.page, () => [sealed, { from: 'phone', cmd: 'favs', favs }, { from: 'phone', cmd: 'sleep', mins: 30 }]);
  await tv.page.reload();
  await until(() => tv.page.evaluate(() => !!localStorage.getItem('hse.spotify')), 'the TV opened the box', 8000);
  const kept = await tv.page.evaluate(() => JSON.parse(localStorage.getItem('hse.spotify')).accounts[0]);
  assert.equal(kept.refresh, 'ref1'); assert.equal(kept.client, 'feedc0ffee0123456789abcdef012345');
  await until(() => tv.page.textContent('#mTitle').then(t => t === 'Harold Street'), 'the song on the TV', 8000);
  assert.match(await tv.page.textContent('#mWhere'), /Playing on Kitchen speaker · sleep at \d\d:\d\d/);
  assert.match(await tv.page.textContent('#mArtist'), /The Stockport Satellites · Region G/);
  await until(() => tv.page.locator('#mLyrics p.now').count().then(n => n === 1), 'the line being sung');
  await until(() => tv.page.textContent('#mNext').then(t => /Up next\s*Negative Pricing/.test(t)), 'up next');
  await until(() => tvSent.some(s => s.msg.state && s.msg.state.spotify === 'Kyle' && s.msg.state.sleepAt > Date.now()), 'the TV tells the phone');
  assert.deepEqual(await smallText(tv.page), [], 'nothing under 24px');
  await tv.page.waitForTimeout(1300);
  await shot(tv.page, 'tv-music');
  // the remote: OK pauses, right skips, 2 plays the second favourite
  await tv.page.keyboard.press('Enter');
  await until(() => calls(tv.sp, 'PUT', '/me/player/pause').length === 1, 'paused');
  assert.equal(await tv.page.getAttribute('#mState', 'class'), 'mstate off', 'shown at once');
  await tv.page.keyboard.press('ArrowRight');
  await until(() => calls(tv.sp, 'POST', '/me/player/next').length === 1, 'skipped');
  await until(() => tv.page.textContent('#mTitle').then(t => t === 'Negative Pricing'), 'the next song', 8000);
  await tv.page.keyboard.press('2');
  await until(() => calls(tv.sp, 'PUT', '/me/player/play').some(c => c.body && c.body.context_uri === 'spotify:album:al1'), 'favourite 2 played');
  assert.equal(await tv.page.evaluate(() => location.hash), '#music', 'the number keys stay in Music');
  await until(() => tv.page.textContent('#mTitle').then(t => t === 'Harold Street'), 'the album playing', 8000);
  // down: the words, then the liner notes, turned with right
  await tv.page.keyboard.press('ArrowDown');
  assert.match(await tv.page.getAttribute('section[data-mode="music"]', 'class'), /view-lyrics/);
  assert.equal(await tv.page.getAttribute('#picker [data-mode="music"]', 'class'), 'btn', 'the toolbar\'s button keeps its look');
  await tv.page.keyboard.press('ArrowDown');
  await until(() => tv.page.locator('.note-page img').count().then(n => n === 1), 'the liner notes', 20000);
  assert.match(await tv.page.textContent('.note-page'), /1 of 3/);
  await tv.page.keyboard.press('ArrowRight');
  assert.match(await tv.page.textContent('.note-page'), /2 of 3/);
  assert.deepEqual(await smallText(tv.page), []);
  await tv.page.waitForTimeout(700);
  await shot(tv.page, 'tv-music-notes');
  // up still opens the toolbar
  await tv.page.keyboard.press('ArrowUp');
  assert.ok(await tv.page.evaluate(() => document.body.classList.contains('chrome-on')));
  assert.deepEqual(tv.errors, []);
  await tv.ctx.close();
});

test('music on the TV: on Today, in the screensaver, and fading out at bedtime', async () => {
  const sp = spotify();
  const { page, ctx, errors } = await open('/display.html#today', { width: 1920, height: 1080, sp, settings: {} });
  let queue = [];
  await relay(page, () => { const q = queue; queue = []; return q; }, 300);
  await page.reload();
  await until(() => page.textContent('#dMusic').then(t => /Harold Street · The Stockport Satellites · Kitchen speaker/.test(t)), 'a line on Today');
  await shot(page, 'tv-today-music');
  // the screensaver: the cover beside the song, on a billboard
  await page.keyboard.press('4');
  await until(() => page.locator('.board.has-img').count().then(n => n > 0), 'the song on a billboard', 30000);
  assert.match(await page.locator('.board.has-img').first().textContent(), /Now playing\s*Harold Street\s*The Stockport Satellites · Kitchen speaker/);
  assert.match(await page.locator('.board.has-img img').first().getAttribute('src'), /i\.scdn\.co/);
  await until(() => page.locator('.board.has-img').first().boundingBox().then(b => b && b.x < 1300), 'the billboard in view', 30000);
  await shot(page, 'tv-screensaver-music');
  // media keys work on any view
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaPlayPause', bubbles: true })));
  await until(() => calls(sp, 'PUT', '/me/player/pause').length === 1, 'paused from a media key');
  // the Music view with nothing playing lists the favourites: your first playlists until you choose
  sp.state = null;
  await page.keyboard.press('6');
  await until(() => page.textContent('#mEmpty').then(t => /Nothing playing.*1\s*Friday night\s*2\s*Cheap hours/s.test(t)), 'nothing playing, and the favourites', 8000);
  assert.equal(await page.locator('.mwall img').count(), 3, 'the album wall: your saved albums');
  assert.deepEqual(await smallText(page), []);
  await shot(page, 'tv-music-idle');
  // the sleep timer, at the end of the song: down in ten steps, a pause, then the volume put back for next time
  sp.state = { is_playing: true, progress_ms: 196000, timestamp: Date.now(), item: TRACKS[0], shuffle_state: false, repeat_state: 'off', device: DEVICES[0], currently_playing_type: 'track', context: null };
  await until(() => page.isVisible('#mMain'), 'playing again', 8000);
  queue = [{ from: 'phone', cmd: 'sleep', song: true }];
  await until(() => page.textContent('#mWhere').then(t => /stopping after this song/.test(t)), 'the sleep timer set');
  await until(() => calls(sp, 'PUT', '/me/player/pause').length === 2, 'faded and paused', 15000);
  await page.waitForTimeout(1800);
  const vols = calls(sp, 'PUT', '/me/player/volume').map(c => +c.query.volume_percent);
  assert.deepEqual(vols, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => Math.round(45 * (1 - i / 10))).concat([45]), 'down in steps from 45, then back to 45');
  // as the night clock's window starts, it fades by itself (here, set to start a moment ago)
  sp.state.is_playing = true; sp.state.progress_ms = 0;
  await until(() => page.getAttribute('#mState', 'class').then(c => c === 'mstate on'), 'playing again', 8000);
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number);
  const slot = n => String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'), from = h * 60 + (m < 30 ? 0 : 30);
  await page.keyboard.press('s');                                   // the night clock off first, whatever the time of day
  await page.selectOption('#fNight', '0'); await page.click('#setForm button[type=submit]');
  await page.waitForTimeout(1500);
  await page.keyboard.press('s');
  await page.selectOption('#fNight', '1'); await page.selectOption('#fNightFrom', slot(from)); await page.selectOption('#fNightTo', slot(from + 180));
  assert.equal(await page.inputValue('#fMusicNight'), '1', 'on unless you turn it off');
  await page.click('#setForm button[type=submit]');
  await until(() => calls(sp, 'PUT', '/me/player/volume').length > vols.length, 'starts fading at night', 8000);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- stage 4: the house queue, parties, and who's listening ---------- */
const KYLE = { id: 'phone00001', name: 'Kyle' };
const say = (topic, m) => ({ topic, m });
/** A relay whose streams reconnect every 300ms, delivering whatever's waiting for each topic once. */
function postbox(){
  const waiting = [];
  return { put: (topic, m) => waiting.push(say(topic, m)), take: topic => { const out = []; for (let i = waiting.length - 1; i >= 0; i--) if (waiting[i].topic === topic) out.unshift(waiting.splice(i, 1)[0].m); return out; } };
}

test('music on the TV: the house queue, handed to Spotify a song at a time, and a party', async () => {
  const CODE = 'ABCDEFGH', HOUSE = 'hse-screen-abcdefgh';
  const sp = spotify();
  const tv = await open('/display.html#music', { width: 1920, height: 1080, sp, settings: {}, keep: { 'hse.remote': CODE } });
  const box = postbox(), sent = await relay(tv.page, topic => box.take(topic), 300);
  await tv.page.reload();
  await until(() => tv.page.textContent('#mTitle').then(t => t === 'Harold Street'), 'playing', 8000);
  const stateOf = () => { const s = sent.filter(x => x.topic === HOUSE && x.msg.state).pop(); return s && s.msg.state; };
  // a phone adds two songs; the TV looks them up and shows who chose them
  box.put(HOUSE, { from: 'phone', cmd: 'queue', op: 'add', uri: 'spotify:track:t3', who: KYLE });
  box.put(HOUSE, { from: 'phone', cmd: 'queue', op: 'add', uri: 'spotify:track:t4', who: KYLE });
  await until(() => tv.page.locator('.hq li').count().then(n => n === 2), 'two songs in the house queue', 8000);
  assert.match(await tv.page.textContent('#mNext'), /Up next in the house queue\s*Last Train to Piccadilly · Viaduct\s*Kyle\s*Bins Out Tonight/);
  await until(() => (stateOf() || { queue: [] }).queue.length === 2, 'the phones are told');
  const [first, second] = stateOf().queue;
  assert.equal(first.n, 'Last Train to Piccadilly'); assert.equal(first.b, 'Kyle');
  // a vote lifts the second above the first
  box.put(HOUSE, { from: 'phone', cmd: 'queue', op: 'vote', id: second.i, who: { id: 'phone00002', name: 'Sam' } });
  await until(() => tv.page.locator('.hq li').first().textContent().then(t => /Bins Out Tonight.*♥ 1/.test(t)), 'voted up');
  assert.equal(calls(sp, 'POST', '/me/player/queue').length, 0, 'nothing handed to Spotify yet: it can still move');
  // near the end of the song, the top one goes to Spotify; when it starts, it leaves the house queue
  sp.state.progress_ms = 190000; sp.state.timestamp = Date.now();
  await until(() => calls(sp, 'POST', '/me/player/queue').some(c => c.query.uri === 'spotify:track:t4'), 'handed to Spotify ahead of time', 8000);
  sp.state.item = TRACKS[3]; sp.state.progress_ms = 1000;
  await until(() => tv.page.locator('.hq li').count().then(n => n === 1), 'gone once it plays', 8000);
  // skipping plays the house queue's next, not whatever Spotify had
  await tv.page.keyboard.press('ArrowRight');
  await until(() => calls(sp, 'POST', '/me/player/next').length === 1, 'skipped');
  assert.ok(calls(sp, 'POST', '/me/player/queue').some(c => c.query.uri === 'spotify:track:t3'), 'the house\'s next was handed over first');
  await until(() => tv.page.textContent('#mTitle').then(t => t === 'Last Train to Piccadilly'), 'and it plays', 8000);

  // a party: guests on their own topic can search, add and vote, and nothing else
  box.put(HOUSE, { from: 'phone', cmd: 'party', on: true, who: KYLE });
  await until(() => tv.page.isVisible('#mParty svg'), 'the party code on the TV', 8000);
  const party = await tv.page.evaluate(() => localStorage.getItem('hse.party'));
  assert.match(party, /^[A-Z2-9]{8}$/);
  assert.match(await tv.page.textContent('#mParty'), new RegExp(party.slice(0, 4) + '-' + party.slice(4)));
  await until(() => (stateOf() || {}).party === party, 'the phones know the party\'s code');
  const PARTY = 'hse-party-' + party.toLowerCase(), guest = id => ({ id, name: 'Guest ' + id.slice(-1) });
  const said = (to, re) => sent.some(x => x.topic === PARTY && x.msg.to === to && re.test(x.msg.reply || ''));
  box.put(PARTY, { from: 'guest', cmd: 'search', who: guest('guest0001'), q: 'harold', rid: 'r1' });
  await until(() => sent.some(x => x.topic === PARTY && x.msg.rid === 'r1' && x.msg.results.length === 2), 'search results for the guest', 8000);
  for (const [i, t] of [[1, 't1'], [2, 't2'], [3, 't4'], [4, 't3']].entries()) { box.put(PARTY, { from: 'guest', cmd: 'add', who: guest('guest0001'), uri: 'spotify:track:' + t[1] }); await tv.page.waitForTimeout(1300); }
  await until(() => said('guest0001', /^Added Harold Street/), 'told it was added', 8000);
  await until(() => said('guest0001', /3 songs waiting/), 'three each', 8000);
  box.put(PARTY, { from: 'guest', cmd: 'mode', who: guest('guest0002'), mode: 'night' });
  box.put(PARTY, { from: 'guest', cmd: 'vote', who: guest('guest0002'), id: stateOf().queue[2].i });
  await until(() => sent.some(x => x.topic === PARTY && x.msg.party && x.msg.party.open && x.msg.party.q.length === 3), 'the party sees the queue', 8000);
  assert.equal(await tv.page.evaluate(() => location.hash), '#music', 'a guest can\'t change the view');
  await tv.page.waitForTimeout(800);
  await shot(tv.page, 'tv-music-party');
  assert.deepEqual(await smallText(tv.page), []);
  box.put(HOUSE, { from: 'phone', cmd: 'party', on: false, who: KYLE });
  await until(() => sent.some(x => x.topic === PARTY && x.msg.party && !x.msg.party.open), 'the guests are told it\'s over', 8000);
  assert.equal(await tv.page.isVisible('#mParty'), false);
  assert.deepEqual(tv.errors, []);
  await tv.ctx.close();
});

test('music: the house queue on the phone, a party, and the guests\' page', async () => {
  const CODE = 'ABCDEFGH', HOUSE = 'hse-screen-abcdefgh', PARTY = 'hse-party-wxyz2345';
  const wire = [['qid1', 't3', 'Sam', ['g1']], ['qid2', 't2', 'Kyle', []], ['qid3', 't4', 'Jo', []]].map(([i, t, b, v]) => { const x = TRACKS.find(y => y.id === t); return { i, u: x.uri, n: x.name, a: x.artists[0].name, m: x.album.images[1].url.split('/').pop(), d: x.duration_ms, b, g: 'x' + i + '00000', v, f: 0 }; });
  const state = extra => ({ from: 'screen', state: Object.assign({ mode: 'music', shown: 'music', at: Date.now(), spotify: 'Kyle', queue: wire, more: 0, party: '', people: [{ id: 'kyle', name: 'Kyle' }], listening: 'kyle' }, extra) });
  const phone = await open('/music.html', { keep: { 'hse.remoteTV': CODE } });
  const box = postbox(), sent = await relay(phone.page, topic => box.take(topic), 300);
  box.put(HOUSE, state());
  await phone.page.reload();
  await phone.page.locator('.mini').waitFor();
  const asked = (op, f) => sent.some(x => x.topic === HOUSE && x.msg.cmd === 'queue' && x.msg.op === op && (!f || f(x.msg)));
  // + on a song adds it to the house queue, not Spotify's
  await until(() => phone.page.evaluate(() => !!sessionStorage.getItem('hse-tv')), 'the TV answered', 8000);
  box.put(HOUSE, state());
  await phone.page.locator('.sbox input').fill('harold');
  await phone.page.locator('.tr .add').first().click();
  await until(() => asked('add', m => m.uri === 'spotify:track:t1'), 'added to the house queue');
  assert.equal(calls(phone.sp, 'POST', '/me/player/queue').length, 0, 'not to Spotify\'s own queue');
  // the player's Up next: the house queue to drag, vote and trim
  await phone.page.locator('.mini').click({ position: { x: 120, y: 20 } });
  const sheet = phone.page.locator('.sheet.open');
  await until(() => sheet.locator('.glance.nx').textContent().then(t => /Up next · the house.*Last Train to Piccadilly.*Sam/s.test(t)), 'the house\'s next song', 8000);
  await sheet.locator('.glance.nx').click();
  const rows = sheet.locator('.house .hq li');
  await until(() => rows.count().then(n => n === 3), 'three songs');
  const handle = await rows.nth(2).locator('.handle').boundingBox(), top = await rows.nth(0).boundingBox();
  await phone.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await phone.page.mouse.down();
  for (let k = 1; k <= 8; k++) await phone.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - (handle.y - top.y) * k / 8);
  await phone.page.mouse.up();
  await until(() => asked('move', m => m.id === 'qid3' && m.to === 0), 'dragged to the top');
  assert.match(await rows.nth(0).textContent(), /Bins Out Tonight/, 'shown at once');
  await rows.nth(1).locator('.vote').click();
  await until(() => asked('vote', m => m.id === 'qid1'), 'voted');
  await rows.nth(2).locator('.handle').focus(); await phone.page.keyboard.press('ArrowUp');
  await until(() => asked('move', m => m.id === 'qid2' && m.to === 1), 'moved with the keyboard');
  await sheet.locator('.house .rm').last().click();
  await until(() => asked('remove'), 'taken out');
  await phone.page.waitForTimeout(400);
  await shot(phone.page, 'music-house-queue');
  // a party
  await sheet.locator('.party button', { hasText: 'Start a party' }).click();
  await until(() => sent.some(x => x.topic === HOUSE && x.msg.cmd === 'party' && x.msg.on), 'asked the TV for a party');
  box.put(HOUSE, state({ party: 'WXYZ2345' }));
  await until(() => sheet.locator('.party.on svg').count().then(n => n === 1), 'the party\'s code on the phone', 8000);
  assert.match(await sheet.locator('.party.on').textContent(), /WXYZ-2345/);
  await phone.page.waitForTimeout(300);
  await shot(phone.page, 'music-house-party');
  assert.deepEqual(phone.errors, []);
  await phone.ctx.close();

  // a guest scans the code: no PIN, no Spotify, just a name
  const g = await open('/party.html#WXYZ2345', { signedIn: false, settings: {} });
  const gbox = postbox(), gsent = await relay(g.page, topic => gbox.take(topic), 300);
  const now = { n: 'Harold Street', a: 'The Stockport Satellites', m: TRACKS[0].album.images[1].url.split('/').pop(), p: 1 };
  gbox.put(PARTY, { from: 'screen', party: { open: true, at: Date.now(), now, q: wire, more: 0 } });
  await g.page.reload();
  await until(() => g.page.textContent('.answer').then(t => /Playing now\s*Harold Street\s*The Stockport Satellites/.test(t)), 'what\'s playing', 8000);
  assert.equal(await g.page.locator('.nav').count(), 0, 'none of the household\'s pages');
  await g.page.fill('input[aria-label="Your name"]', 'Alex'); await g.page.click('button:has-text("Join")');
  const me = await g.page.evaluate(() => JSON.parse(localStorage.getItem('hse.guest')));
  assert.equal(me.name, 'Alex');
  await g.page.fill('.sbox input', 'oasis');
  await until(() => gsent.some(x => x.topic === PARTY && x.msg.cmd === 'search' && x.msg.q === 'oasis'), 'asked the TV to search', 8000);
  const rid = gsent.find(x => x.msg.cmd === 'search').msg.rid;
  gbox.put(PARTY, { from: 'screen', rid, to: me.id, results: [TRACKS[1], TRACKS[2]].map(t => ({ u: t.uri, n: t.name, a: t.artists[0].name, m: t.album.images[1].url.split('/').pop(), d: t.duration_ms })) });
  await until(() => g.page.locator('.res li').count().then(n => n === 2), 'results', 8000);
  await g.page.locator('.res li').first().locator('.add').click();
  await until(() => gsent.some(x => x.msg.cmd === 'add' && x.msg.uri === 'spotify:track:t2' && x.msg.who.name === 'Alex'), 'added');
  gbox.put(PARTY, { from: 'screen', to: me.id, reply: 'Added Negative Pricing. It\'s number 4 in the queue.', ok: true });
  await until(() => g.page.textContent('.toast').then(t => /number 4/.test(t)).catch(() => false), 'told where it is', 8000);
  await g.page.locator('.ql li').nth(1).locator('.vote').click();
  await until(() => gsent.some(x => x.msg.cmd === 'vote' && x.msg.id === 'qid2'), 'voted');
  await g.page.fill('.sbox input', 'https://open.spotify.com/track/abcdefghij1234567890?si=x');
  await g.page.click('button:has-text("Add the song from that link")');
  await until(() => gsent.some(x => x.msg.cmd === 'add' && x.msg.uri === 'spotify:track:abcdefghij1234567890'), 'a pasted link');
  await g.page.waitForTimeout(500);
  await shot(g.page, 'party-guest');
  gbox.put(PARTY, { from: 'screen', party: { open: false, at: Date.now() } });
  await until(() => g.page.textContent('.answer').then(t => /The party's over/.test(t)), 'the end', 8000);
  assert.deepEqual(g.errors, []);
  await g.ctx.close();
});

test('music: who\'s listening, on the phone and on the TV', async () => {
  const two = { accounts: [{ id: 'kyle', name: 'Kyle', product: 'premium', client: 'feedc0ffee0123456789abcdef012345', refresh: 'ref1', access: 'acc1', exp: Date.now() + 3600e3, scope: '' },
    { id: 'sam', name: 'Sam Rivers', product: 'premium', client: 'feedc0ffee0123456789abcdef012345', refresh: 'ref1', access: 'acc2', exp: Date.now() + 3600e3, scope: '' }], active: 'kyle' };
  const { page, ctx, errors } = await open('/music.html', { signedIn: false, keep: { 'hse.spotify': JSON.stringify(two) } });
  await page.locator('.people').waitFor();
  assert.match(await page.textContent('.people'), /Who's listening\s*K\s*Kyle\s*SR\s*Sam/);
  assert.match(await page.textContent('.now-answer .label'), /, Kyle/);
  await page.locator('.face', { hasText: 'Sam' }).click();
  await until(() => page.textContent('.now-answer .label').then(t => /, Sam/.test(t)), 'Sam is listening');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hse.spotify')).active), 'sam', 'remembered');
  assert.equal(await page.getAttribute('.face.on', 'aria-pressed'), 'true');
  await page.waitForTimeout(300);
  await shot(page, 'music-people');
  assert.deepEqual(errors, []);
  await ctx.close();
  // the TV holds both, and a phone picks who it plays as
  const tv = await open('/display.html#music', { width: 1920, height: 1080, signedIn: false, settings: {}, keep: { 'hse.spotify': JSON.stringify(two), 'hse.remote': 'ABCDEFGH' } });
  const box = postbox(), sent = await relay(tv.page, topic => box.take(topic), 300);
  await tv.page.reload();
  await until(() => tv.page.textContent('#mFoot').then(t => /Spotify · Kyle/.test(t)), 'the TV as Kyle', 8000);
  box.put('hse-screen-abcdefgh', { from: 'phone', cmd: 'listen', id: 'sam' });
  await until(() => tv.page.textContent('#mFoot').then(t => /Spotify · Sam Rivers/.test(t)), 'the TV as Sam', 8000);
  await until(() => sent.some(x => x.msg.state && x.msg.state.listening === 'sam' && x.msg.state.people.length === 2), 'the phones are told');
  assert.deepEqual(tv.errors, []);
  await tv.ctx.close();
});
