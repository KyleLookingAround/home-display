/* The music player's logic, with no DOM: Spotify's answers in one shape, durations, synced lyrics, and colours from a cover. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.

/** "3:24", or "1:02:05" for an hour or more. */
export function fmtDur(ms){
  const s = Math.max(0, Math.floor((ms || 0) / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0');
}
/** The image nearest a size in pixels, from Spotify's list of sizes (largest first). */
export function artUrl(images, size){
  if (!images || !images.length) return '';
  let best = images[0];
  images.forEach(im => { if (im.width && Math.abs(im.width - size) < Math.abs((best.width || 0) - size)) best = im; });
  return best.url || '';
}
const idOf = uri => String(uri || '').split(':').pop();
/** A track or podcast episode, in the one shape the player draws. */
export function trackOf(t){
  if (!t) return null;
  const ep = t.type === 'episode', album = ep ? (t.show || {}) : (t.album || {});
  const artists = ep ? [{ id: (t.show && t.show.id) || '', name: (t.show && t.show.name) || '' }] : (t.artists || []).map(a => ({ id: a.id, name: a.name, uri: a.uri }));
  return {
    id: t.id || idOf(t.uri), uri: t.uri, name: t.name || '', episode: ep,
    artists: artists, artist: artists.map(a => a.name).join(', '),
    album: { id: album.id || '', name: album.name || '', uri: album.uri || '', year: String(album.release_date || '').slice(0, 4) },
    images: (ep ? t.images : album.images) || [], isrc: (t.external_ids && t.external_ids.isrc) || '', dur: t.duration_ms || 0, explicit: !!t.explicit, playable: t.is_playable !== false
  };
}
/** Spotify's player state (null when nothing has played lately) as the player's model. `at` is when it was read. */
export function playerModel(j, at){
  if (!j) return null;
  const d = j.device || {};
  return {
    playing: !!j.is_playing, progress: j.progress_ms || 0, at: at || Date.now(),
    track: trackOf(j.item),
    device: d.id || d.name ? { id: d.id || null, name: d.name || 'Spotify', type: d.type || '', volume: d.volume_percent == null ? null : d.volume_percent, canVolume: d.supports_volume !== false } : null,
    shuffle: !!j.shuffle_state, repeat: j.repeat_state || 'off',
    context: j.context ? { type: j.context.type, uri: j.context.uri } : null,
    ad: j.currently_playing_type === 'ad'
  };
}
/** Where the song is now: the progress read, plus the time since, while it plays. */
export function progressAt(m, now){
  if (!m || !m.track) return 0;
  const p = m.progress + (m.playing ? Math.max(0, now - m.at) : 0);
  return Math.min(p, m.track.dur || p);
}
/** The next repeat setting, as Spotify's own button goes: off, all, one. */
export const nextRepeat = r => r === 'off' ? 'context' : r === 'context' ? 'track' : 'off';
/** A device's kind, for its icon: speaker, tv, phone, computer or other. */
export function deviceKind(type){
  const t = String(type || '').toLowerCase();
  if (/speaker|avr|stb|audiodongle|castaudio/.test(t)) return 'speaker';
  if (/tv|castvideo|gameconsole/.test(t)) return 'tv';
  if (/smartphone|tablet/.test(t)) return 'phone';
  if (/computer/.test(t)) return 'computer';
  return 'other';
}
/** The wall display's own Spotify player (the Web Playback SDK in display.html), first choice to play on. */
export const SCREEN_PLAYER = 'Harold Street TV';
/**
 * Where to play, best first: the wall display's own player, then speakers, computers and phones, and the TV's Spotify
 * app last, since starting it takes the screen over from the display.
 */
const KIND_RANK = { screen: 0, speaker: 1, computer: 2, phone: 3, other: 4, tv: 5 };
export const deviceRank = d => d.name === SCREEN_PLAYER ? 0 : KIND_RANK[d.kind] != null ? KIND_RANK[d.kind] : 4;
/** The devices to offer, the one playing first, then best first (deviceRank); those that can't be controlled left out. */
export function playOn(devices, current){
  return (devices || []).filter(d => !d.is_restricted).map(d => ({ id: d.id, name: d.name, type: d.type, kind: d.name === SCREEN_PLAYER ? 'screen' : deviceKind(d.type), active: !!d.is_active || (current && current.id === d.id), volume: d.volume_percent, canVolume: d.supports_volume !== false }))
    .sort((a, b) => ((b.active ? 1 : 0) - (a.active ? 1 : 0)) || (deviceRank(a) - deviceRank(b)));
}
/** Where to start music when nothing is playing: the best device that isn't the TV's Spotify app, or null to ask. */
export function bestDevice(devices){
  const ok = (devices || []).filter(d => d.kind !== 'tv').sort((a, b) => deviceRank(a) - deviceRank(b));
  return ok[0] || null;
}
/** Play on the device that's on now, unless it's the TV's Spotify app sitting idle: then somewhere better (bestDevice). */
export const keepDevice = (model) => !!(model && model.device && (model.playing || deviceKind(model.device.type) !== 'tv'));
/** A list from Spotify's paging object (or a plain list), with its rows' tracks unwrapped: { items, next, total }. */
export function page(j, key){
  const p = key && j ? j[key] : j;
  if (!p) return { items: [], next: false, total: 0 };
  // saved songs, playlist rows and recently played wrap each song (as track, or item in Spotify's newer answers)
  const items = (p.items || []).map(x => x && (x.track !== undefined || (x.item !== undefined && x.added_at !== undefined)) ? { added: x.added_at || x.played_at || null, track: x.track || x.item, context: x.context || null } : x).filter(Boolean);
  return { items: items, next: !!p.next, total: p.total || items.length, cursor: p.cursors ? p.cursors.after : null };
}
/** "Playing from" for the context: your liked songs, or the playlist's or album's name once it's known. */
export function contextLabel(ctx, name){
  if (!ctx) return '';
  if (/:collection(:|$)/.test(ctx.uri || '')) return 'Your liked songs';
  return name || '';
}

/* ---------- synced lyrics (LRC) ---------- */
/** "[01:02.34]words" lines as [{ t: ms, text }], in time order. Several stamps on a line each get it. Blank lines keep their beat. */
export function parseLrc(text){
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const stamps = [], re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
    let m, last = 0;
    while ((m = re.exec(line))){ stamps.push(Math.round((+m[1] * 60 + +m[2]) * 1000)); last = re.lastIndex; }
    if (!stamps.length) return;
    const words = line.slice(last).trim();
    stamps.forEach(t => out.push({ t: t, text: words }));
  });
  return out.sort((a, b) => a.t - b.t);
}
/** The line being sung at a moment: its index, or -1 before the first. */
export function lyricAt(lines, ms){
  let lo = 0, hi = (lines || []).length - 1, ans = -1;
  while (lo <= hi){ const mid = (lo + hi) >> 1; if (lines[mid].t <= ms){ ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
/** LRCLIB's answer as { synced: [{ t, text }] | null, plain: [text] | null, instrumental }. */
export function lyricsOf(j){
  if (!j) return null;
  const synced = j.syncedLyrics ? parseLrc(j.syncedLyrics) : null;
  const plain = j.plainLyrics ? String(j.plainLyrics).split(/\r?\n/) : null;
  return { synced: synced && synced.length ? synced : null, plain: plain, instrumental: !!j.instrumental };
}
/** Synced lyrics from LRCLIB, a free open library that browsers may call. Null when it has none. */
export async function loadLyrics(t){
  if (!t || t.episode) return null;
  const q = new URLSearchParams({ artist_name: (t.artists[0] || {}).name || '', track_name: t.name, album_name: t.album.name, duration: String(Math.round(t.dur / 1000)) });
  let res;
  try { res = await fetch('https://lrclib.net/api/get?' + q.toString()); } catch(e){ return null; }
  if (!res.ok) return null;
  try { return lyricsOf(await res.json()); } catch(e){ return null; }
}

/* ---------- colours from the cover ---------- */
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function hsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function rgb(h, s, l){
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
/**
 * The cover's colours, from its pixels (RGBA, as a canvas gives them): `main`, the most-used lively colour, made
 * bright enough to glow on the dark page; `deep`, a dark shade of it for backgrounds; `ink`, text that reads on main.
 * Null for an image that's all greys, so the page keeps its own colours.
 */
export function coverColours(px){
  if (!px || px.length < 4) return null;
  const bins = {};
  for (let i = 0; i < px.length; i += 4){
    if (px[i + 3] < 128) continue;
    const c = hsl(px[i], px[i + 1], px[i + 2]);
    if (c[1] < .22 || c[2] < .12 || c[2] > .92) continue;           // greys, near-black and near-white don't count
    const k = Math.floor(c[0] / 20);                                  // 18 hue buckets
    const b = bins[k] || (bins[k] = { n: 0, h: 0, s: 0, l: 0, w: 0 });
    const w = c[1];                                                    // livelier pixels count for more
    b.n++; b.w += w; b.h += c[0] * w; b.s += c[1] * w; b.l += c[2] * w;
  }
  const best = Object.keys(bins).map(k => bins[k]).sort((a, b) => b.w - a.w)[0];
  if (!best || best.n < px.length / 4 * 0.04) return null;
  const h = best.h / best.w, s = Math.min(1, Math.max(.55, best.s / best.w));
  const main = rgb(h, s, .64), deep = rgb(h, Math.min(s, .6), .16);
  const lum = (.2126 * main[0] + .7152 * main[1] + .0722 * main[2]) / 255;
  return { main: hex(main[0], main[1], main[2]), deep: hex(deep[0], deep[1], deep[2]), ink: lum > .5 ? '#06071a' : '#ffffff', hue: Math.round(h) };
}

/* ---------- the screensaver's billboards ---------- */
/**
 * Cards for the cockpit's billboards (the shape buildBillboards makes, with a cover as img): the song playing, often;
 * or, when nothing is, the album wall (six covers from your shelf, as wall) and one album from it, both changing each hour.
 */
export function musicCards(m, albums, now){
  const out = [];
  if (m && m.track && m.playing){
    const t = m.track;
    out.push({ id: 'music', kind: 'music', tone: 'cyan', head: 'Now playing', big: t.name, sub: t.artist + (m.device ? ' · ' + m.device.name : ''), img: artUrl(t.images, 300), weight: 2 });
    return out;
  }
  const list = (albums || []).filter(a => a && a.images && a.images.length);
  if (!list.length) return out;
  const start = Math.floor((now == null ? Date.now() : now) / 3600e3) % list.length;
  const at = i => list[(start + i) % list.length];
  if (list.length >= 6) out.push({ id: 'albums', kind: 'music', tone: 'violet', head: 'Your record shelf', big: '', sub: list.length + ' albums saved in Spotify', wall: [0, 1, 2, 3, 4, 5].map(i => artUrl(at(i).images, 300)), weight: 1 });
  const a = at(0);
  out.push({ id: 'album-' + a.id, kind: 'music', tone: 'violet', head: 'From your shelf', big: a.name, sub: (a.artists || []).map(x => x.name).join(', '), img: artUrl(a.images, 300), weight: 1 });
  return out;
}
