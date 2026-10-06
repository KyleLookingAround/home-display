/* Spotify: signing in from the browser (PKCE, no secret), keeping the token fresh, and the Web API calls the player uses. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
//
// Spotify allows browsers to call both its sign-in (accounts.spotify.com) and its Web API (api.spotify.com).
// The sign-in uses PKCE: the page makes a one-off secret (the verifier), sends only its hash, and proves it
// when trading the code for a token, so no client secret is ever needed or kept. Each account's tokens stay on
// the device that signed in (hse.spotify); the TV gets them sealed with the PIN, like the Octopus account.
import { store } from './browser.js';

export const SPOTIFY_AUTH = 'https://accounts.spotify.com';
export const SPOTIFY_API = 'https://api.spotify.com/v1';
export const SPOTIFY_SCOPES = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'user-read-recently-played',
  'user-top-read', 'user-library-read', 'user-library-modify', 'playlist-read-private', 'playlist-read-collaborative', 'user-follow-read', 'user-read-private'];

export class SpotifyError extends Error {
  constructor(code, msg, status){ super(msg || code); this.code = code; this.status = status || 0; }
}
/** What went wrong, in plain words: [title, what to do]. */
export function spotifyErrorText(e){
  switch (e && e.code){
    case 'PREMIUM': return ['Needs Spotify Premium.', 'Spotify only lets Premium accounts be played, paused and skipped from another app.'];
    case 'NO_DEVICE': return ['Nothing to play on.', 'Open Spotify on the TV, a speaker or your phone, then choose it under Play on.'];
    case 'AUTH': return ['Spotify signed you out.', 'Connect Spotify again in Settings.'];
    case 'LIMIT': return ['Spotify asked us to slow down.', 'Try again in a few seconds.'];
    case 'NETWORK': return ['No signal.', 'Spotify couldn\'t be reached.'];
    case 'NOCLIENT': return ['Spotify isn\'t set up yet.', 'Add the household\'s Spotify Client ID in Settings.'];
    default: return ['Spotify said no.', (e && e.message) || ''];
  }
}

/* ---------- PKCE ---------- */
const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
/** A random string of URL-safe characters (the verifier is 43 to 128 of them). */
export function randomText(n, rand){
  const out = [];
  if (!rand && typeof crypto !== 'undefined' && crypto.getRandomValues){
    const b = crypto.getRandomValues(new Uint8Array(n));
    for (let i = 0; i < n; i++) out.push(URL_SAFE[b[i] % URL_SAFE.length]);
  } else for (let i = 0; i < n; i++) out.push(URL_SAFE[Math.floor((rand || Math.random)() * URL_SAFE.length)]);
  return out.join('');
}
export function base64url(buf){
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** The challenge Spotify is sent: the verifier's SHA-256, base64url. */
export function pkceChallenge(verifier){
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(base64url);
}
/** Where Spotify sends you back: the Settings page next to this one, as registered in the Spotify app. */
export function redirectUri(href){
  const u = new URL('settings.html', href || location.href);
  u.search = ''; u.hash = '';
  return u.href;
}

/* ---------- accounts on this device ---------- */
// hse.spotify: { accounts: [{ id, name, product, refresh, access, exp, scope }], active: id }
export function spotifyStore(){
  const s = store.getJ('spotify', null);
  return s && Array.isArray(s.accounts) ? s : { accounts: [], active: null };
}
export function saveSpotifyStore(s){ store.setJ('spotify', s); }
export function activeAccount(s){
  s = s || spotifyStore();
  return s.accounts.filter(a => a.id === s.active)[0] || s.accounts[0] || null;
}
/** Adds or replaces an account, makes it the one playing, and keeps it. */
export function rememberAccount(acc){
  const s = spotifyStore();
  s.accounts = s.accounts.filter(a => a.id !== acc.id).concat([acc]);
  s.active = acc.id; saveSpotifyStore(s);
  return s;
}
export function forgetAccount(id){
  const s = spotifyStore();
  s.accounts = s.accounts.filter(a => a.id !== id);
  if (s.active === id) s.active = s.accounts.length ? s.accounts[0].id : null;
  saveSpotifyStore(s);
  return s;
}

/* ---------- signing in ---------- */
/** Sends you to Spotify to sign in. `back` is where to land afterwards. */
export async function beginSignIn(clientId, back){
  if (!clientId) throw new SpotifyError('NOCLIENT');
  const verifier = randomText(64), state = randomText(16);
  store.setJ('spotifyAuth', { verifier: verifier, state: state, back: back || location.href, at: Date.now() });
  const q = new URLSearchParams({ response_type: 'code', client_id: clientId, scope: SPOTIFY_SCOPES.join(' '), redirect_uri: redirectUri(),
    state: state, code_challenge_method: 'S256', code_challenge: await pkceChallenge(verifier) });
  location.assign(SPOTIFY_AUTH + '/authorize?' + q.toString());
}
/** True when this page is Spotify sending you back (?code= or ?error=, with our state). */
export function isSignInReturn(search){
  const q = new URLSearchParams(search == null ? location.search : search);
  return (q.has('code') || q.has('error')) && q.has('state');
}
/** Finishes signing in: trades the code for tokens, finds out who you are, and keeps the account. Returns { account, back }. */
export async function finishSignIn(clientId, search){
  const q = new URLSearchParams(search == null ? location.search : search), pending = store.getJ('spotifyAuth', null);
  store.del('spotifyAuth');
  if (q.get('error')) throw new SpotifyError(q.get('error') === 'access_denied' ? 'DENIED' : 'AUTH', q.get('error') === 'access_denied' ? 'You didn\'t allow it.' : q.get('error'));
  if (!pending || pending.state !== q.get('state')) throw new SpotifyError('AUTH', 'That sign-in didn\'t start here. Try again.');
  const t = await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), client_id: clientId, code_verifier: pending.verifier });
  const acc = { id: '', name: '', product: '', client: clientId, refresh: t.refresh_token, access: t.access_token, exp: Date.now() + (t.expires_in || 3600) * 1000, scope: t.scope || '' };
  const me = await api(acc, clientId, 'GET', '/me');
  acc.id = me.id; acc.name = me.display_name || me.id; acc.product = me.product || '';
  rememberAccount(acc);
  return { account: acc, back: pending.back };
}
async function tokenRequest(fields){
  let res;
  try { res = await fetch(SPOTIFY_AUTH + '/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }); }
  catch(e){ throw new SpotifyError('NETWORK'); }
  let j = null; try { j = await res.json(); } catch(e){}
  if (!res.ok) throw new SpotifyError('AUTH', (j && (j.error_description || j.error)) || 'Spotify refused the sign-in.', res.status);
  return j;
}

/* ---------- calling the Web API ---------- */
const refreshing = {};
/** A fresh access token for the account, refreshing it (and keeping any new refresh token) when it's nearly out. */
export function accessToken(acc, clientId){
  if (acc.access && acc.exp > Date.now() + 60e3) return Promise.resolve(acc.access);
  if (!acc.refresh) return Promise.reject(new SpotifyError('AUTH'));
  if (refreshing[acc.id]) return refreshing[acc.id];
  const p = tokenRequest({ grant_type: 'refresh_token', refresh_token: acc.refresh, client_id: clientId }).then(t => {
    acc.access = t.access_token; acc.exp = Date.now() + (t.expires_in || 3600) * 1000;
    if (t.refresh_token) acc.refresh = t.refresh_token;
    const s = spotifyStore(), i = s.accounts.map(a => a.id).indexOf(acc.id);
    if (i >= 0){ s.accounts[i] = Object.assign({}, s.accounts[i], { access: acc.access, exp: acc.exp, refresh: acc.refresh }); saveSpotifyStore(s); }
    return acc.access;
  }, e => { if (e.status === 400) acc.refresh = ''; throw e.status === 400 ? new SpotifyError('AUTH') : e; });
  refreshing[acc.id] = p;
  const done = () => { delete refreshing[acc.id]; };
  p.then(done, done);
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
/** One Web API call. Retries once after a refreshed token or a "slow down"; 204 answers null. */
export async function api(acc, clientId, method, path, body, tries){
  tries = tries || 0;
  const token = await accessToken(acc, clientId);
  let res;
  try {
    res = await fetch(SPOTIFY_API + path, { method: method, headers: Object.assign({ Authorization: 'Bearer ' + token }, body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch(e){ throw new SpotifyError('NETWORK'); }
  if (res.status === 401 && tries < 1){ acc.exp = 0; return api(acc, clientId, method, path, body, tries + 1); }
  if (res.status === 429 && tries < 1){ await wait(Math.min(10, +res.headers.get('Retry-After') || 2) * 1000); return api(acc, clientId, method, path, body, tries + 1); }
  if (res.status === 204 || res.status === 202) return null;
  let j = null; const text = await res.text();
  try { j = text ? JSON.parse(text) : null; } catch(e){ j = null; }
  if (res.ok) return j;
  const err = j && j.error ? j.error : {}, reason = err.reason || '', msg = err.message || ('Spotify returned ' + res.status);
  if (res.status === 401) throw new SpotifyError('AUTH', msg, 401);
  if (res.status === 429) throw new SpotifyError('LIMIT', msg, 429);
  if (reason === 'PREMIUM_REQUIRED' || (res.status === 403 && /premium/i.test(msg))) throw new SpotifyError('PREMIUM', msg, 403);
  if (reason === 'NO_ACTIVE_DEVICE' || (res.status === 404 && /device/i.test(msg))) throw new SpotifyError('NO_DEVICE', msg, 404);
  throw new SpotifyError('HTTP', msg, res.status);
}
/** Tries each path in turn, for endpoints Spotify has moved: the first that isn't gone answers. */
export async function apiFirst(acc, clientId, method, paths, body){
  let last = null;
  for (let i = 0; i < paths.length; i++){
    try { return await api(acc, clientId, method, paths[i], body); }
    catch(e){ last = e; if (!(e.code === 'HTTP' && (e.status === 404 || e.status === 410 || e.status === 403))) throw e; }
  }
  throw last;
}

/* ---------- what the player uses ---------- */
const qs = o => { const p = []; Object.keys(o).forEach(k => { if (o[k] != null && o[k] !== '') p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); }); return p.length ? '?' + p.join('&') : ''; };
/** Bound to one account: `const sp = spotify(acc, clientId); await sp.player()`. */
export function spotify(acc, clientId){
  const call = (m, p, b) => api(acc, clientId, m, p, b), dev = d => qs({ device_id: d || null });
  return {
    account: acc,
    me: () => call('GET', '/me'),
    player: () => call('GET', '/me/player?additional_types=episode'),
    devices: () => call('GET', '/me/player/devices').then(j => (j && j.devices) || []),
    queue: () => call('GET', '/me/player/queue'),
    /** o: { device, context (a uri), uris, offset (a uri or a position), position (ms) } */
    play: o => {
      o = o || {}; const b = {};
      if (o.context) b.context_uri = o.context;
      if (o.uris) b.uris = o.uris;
      if (o.offset != null) b.offset = typeof o.offset === 'number' ? { position: o.offset } : { uri: o.offset };
      if (o.position) b.position_ms = Math.round(o.position);
      return call('PUT', '/me/player/play' + dev(o.device), Object.keys(b).length ? b : undefined);
    },
    pause: d => call('PUT', '/me/player/pause' + dev(d)),
    next: d => call('POST', '/me/player/next' + dev(d)),
    previous: d => call('POST', '/me/player/previous' + dev(d)),
    seek: (ms, d) => call('PUT', '/me/player/seek' + qs({ position_ms: Math.max(0, Math.round(ms)), device_id: d || null })),
    volume: (pct, d) => call('PUT', '/me/player/volume' + qs({ volume_percent: Math.max(0, Math.min(100, Math.round(pct))), device_id: d || null })),
    shuffle: (on, d) => call('PUT', '/me/player/shuffle' + qs({ state: on ? 'true' : 'false', device_id: d || null })),
    repeat: (mode, d) => call('PUT', '/me/player/repeat' + qs({ state: mode, device_id: d || null })),
    transfer: (d, play) => call('PUT', '/me/player', { device_ids: [d], play: !!play }),
    addToQueue: (uri, d) => call('POST', '/me/player/queue' + qs({ uri: uri, device_id: d || null })),
    search: (q, types, limit) => call('GET', '/search' + qs({ q: q, type: (types || ['track', 'artist', 'album', 'playlist']).join(','), limit: limit || 8, market: 'from_token' })),
    playlists: off => call('GET', '/me/playlists' + qs({ limit: 50, offset: off || 0 })),
    liked: off => call('GET', '/me/tracks' + qs({ limit: 50, offset: off || 0, market: 'from_token' })),
    albums: off => call('GET', '/me/albums' + qs({ limit: 50, offset: off || 0, market: 'from_token' })),
    recent: () => call('GET', '/me/player/recently-played?limit=50'),
    top: (type, range, limit) => call('GET', '/me/top/' + type + qs({ time_range: range || 'medium_term', limit: limit || 20 })),
    playlist: id => call('GET', '/playlists/' + encodeURIComponent(id) + qs({ market: 'from_token' })),
    playlistTracks: (id, off) => apiFirst(acc, clientId, 'GET', ['/playlists/' + encodeURIComponent(id) + '/items' + qs({ limit: 50, offset: off || 0, market: 'from_token' }),
      '/playlists/' + encodeURIComponent(id) + '/tracks' + qs({ limit: 50, offset: off || 0, market: 'from_token' })]),
    album: id => call('GET', '/albums/' + encodeURIComponent(id) + qs({ market: 'from_token' })),
    artist: id => call('GET', '/artists/' + encodeURIComponent(id)),
    artistTop: id => call('GET', '/artists/' + encodeURIComponent(id) + '/top-tracks' + qs({ market: 'from_token' })),
    artistAlbums: (id, off) => call('GET', '/artists/' + encodeURIComponent(id) + '/albums' + qs({ include_groups: 'album,single', limit: 20, offset: off || 0, market: 'from_token' })),
    following: after => call('GET', '/me/following' + qs({ type: 'artist', limit: 50, after: after || null })),
    isLiked: ids => apiFirst(acc, clientId, 'GET', ['/me/tracks/contains' + qs({ ids: ids.join(',') }), '/me/library/contains' + qs({ uris: ids.map(i => 'spotify:track:' + i).join(',') })]),
    like: (ids, on) => apiFirst(acc, clientId, on ? 'PUT' : 'DELETE', ['/me/tracks' + qs({ ids: ids.join(',') }), '/me/library' + qs({ uris: ids.map(i => 'spotify:track:' + i).join(',') })])
  };
}
