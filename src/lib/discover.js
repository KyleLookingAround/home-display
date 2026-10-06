/* Finding music: more like this, new releases, gigs, weather radio, and your listening. No DOM. */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
//
// Spotify stopped giving new apps its recommendations and related artists in November 2024, so "more like this"
// comes from ListenBrainz (open, no key, browser calls allowed), with Last.fm as well when a key is set; each
// suggestion is then found on Spotify by name. Gigs come from Ticketmaster, with a key kept on the device.
import { HOME } from './format.js';

/* ---------- more like this: ListenBrainz, then Last.fm ---------- */
export const LB_LABS = 'https://labs.api.listenbrainz.org';
const LB_RECORDINGS = 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30';
const LB_ARTISTS = 'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';
function dGet(url){
  return fetch(url).then(r => r.ok ? r.json() : null, () => null).then(j => j, () => null);
}
/** Songs people play in the same sittings as this one (a MusicBrainz recording id): [{ name, artist, score }]. */
export function similarRecordings(mbid){
  if (!/^[0-9a-f-]{36}$/.test(String(mbid || ''))) return Promise.resolve([]);
  return dGet(LB_LABS + '/similar-recordings/json?recording_mbids=' + mbid + '&algorithm=' + LB_RECORDINGS).then(j =>
    (Array.isArray(j) ? j : []).filter(x => x && x.recording_name && x.artist_credit_name).map(x => ({ name: x.recording_name, artist: x.artist_credit_name, score: +x.score || 0 })));
}
/** Artists people play alongside this one (a MusicBrainz artist id): [{ name, mbid, score }]. */
export function similarArtists(mbid){
  if (!/^[0-9a-f-]{36}$/.test(String(mbid || ''))) return Promise.resolve([]);
  return dGet(LB_LABS + '/similar-artists/json?artist_mbids=' + mbid + '&algorithm=' + LB_ARTISTS).then(j =>
    (Array.isArray(j) ? j : []).filter(x => x && x.name).map(x => ({ name: x.name, mbid: x.artist_mbid, score: +x.score || 0 })));
}
/** Last.fm's similar songs, when there's a key on this device: [{ name, artist, score }]. */
export function lastfmSimilar(key, name, artist){
  if (!key || !name) return Promise.resolve([]);
  return dGet('https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&autocorrect=1&limit=30&format=json&api_key=' + encodeURIComponent(key) +
    '&track=' + encodeURIComponent(name) + '&artist=' + encodeURIComponent(artist)).then(j =>
    ((j && j.similartracks && j.similartracks.track) || []).filter(x => x && x.name && x.artist).map(x => ({ name: x.name, artist: x.artist.name, score: Math.round((+x.match || 0) * 1000) })));
}
const dNorm = s => String(s || '').toLowerCase().replace(/\s*[\(\[].*?[\)\]]/g, '').replace(/^the /, '').replace(/[^a-z0-9]+/g, ' ').trim();
/**
 * Puts suggestions together: best first, no song twice, and no more than `perArtist` from one artist, so it's a
 * spread rather than one band's album. `avoid` is the song you're on.
 */
export function blendSimilar(lists, avoid, perArtist){
  const seen = {}, per = {}, out = [], cap = perArtist || 2, skip = avoid ? dNorm(avoid.name) + '|' + dNorm(avoid.artist) : '';
  const all = [].concat.apply([], lists.map((l, i) => l.map(x => Object.assign({ rank: x.score / (1 + i) }, x)))).sort((a, b) => b.rank - a.rank);
  all.forEach(x => {
    const k = dNorm(x.name) + '|' + dNorm(x.artist), a = dNorm(x.artist);
    if (seen[k] || k === skip) return;
    if ((per[a] || 0) >= cap) return;
    seen[k] = 1; per[a] = (per[a] || 0) + 1;
    out.push({ name: x.name, artist: x.artist });
  });
  return out;
}
/** Spotify's search words for a song by name. */
export const findWords = x => 'track:"' + String(x.name).replace(/"/g, '') + '" artist:"' + String(x.artist).replace(/"/g, '') + '"';
/** Is Spotify's answer the song we asked for (not a cover or a karaoke version)? */
export function sameSong(want, t){
  if (!t) return false;
  const a = dNorm(want.artist), n = dNorm(want.name);
  return (t.artists || []).some(x => dNorm(x.name) === a || dNorm(x.name).indexOf(a) === 0) && (dNorm(t.name) === n || dNorm(t.name).indexOf(n) === 0);
}

/* ---------- new releases from the artists you follow and play ---------- */
/** Releases from the last `days` days, newest first: [{ album, artist, date }] (date is yyyy-mm-dd). */
export function recentReleases(albumsByArtist, now, days){
  const since = new Date((now || Date.now()) - (days || 14) * 864e5).toISOString().slice(0, 10), today = new Date(now || Date.now()).toISOString().slice(0, 10), seen = {}, out = [];
  albumsByArtist.forEach(x => (x.albums || []).forEach(al => {
    if (!al || al.release_date_precision !== 'day' || al.release_date < since || al.release_date > today || seen[al.id]) return;
    seen[al.id] = 1;
    out.push({ album: al, artist: x.artist, date: al.release_date });
  }));
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
/** "Out today", "Out yesterday", "Out Friday", or "Out 3 Oct". */
export function releasedText(date, now){
  const d = new Date(date + 'T12:00:00'), t = new Date(now || Date.now());
  const days = Math.round((new Date(t.toISOString().slice(0, 10) + 'T12:00:00') - d) / 864e5);
  if (days <= 0) return 'Out today';
  if (days === 1) return 'Out yesterday';
  if (days < 7) return 'Out ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  return 'Out ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
}

/* ---------- gigs near home, from Ticketmaster ---------- */
export const TM_API = 'https://app.ticketmaster.com/discovery/v2';
export const GIG_MILES = 40;
/** The page of music events near home, soonest first. */
export function gigsUrl(key, page){
  return TM_API + '/events.json?apikey=' + encodeURIComponent(key) + '&latlong=' + HOME.lat + ',' + HOME.lon + '&radius=' + GIG_MILES + '&unit=miles&classificationName=music&sort=date,asc&size=200&page=' + (page || 0);
}
/** Ticketmaster's events, as gigs by the artists you listen to: [{ artist, title, at, date, time, venue, city, url, img }]. */
export function gigsFor(events, artists){
  const want = {};
  (artists || []).forEach(a => { const k = dNorm(a); if (k) want[k] = a; });
  const out = [], seen = {};
  (events || []).forEach(e => {
    const acts = ((e._embedded && e._embedded.attractions) || []).map(a => a.name);
    const hit = acts.filter(n => want[dNorm(n)])[0];
    if (!hit || seen[e.id]) return;
    seen[e.id] = 1;
    const v = (e._embedded && e._embedded.venues && e._embedded.venues[0]) || {}, d = (e.dates && e.dates.start) || {};
    const img = (e.images || []).filter(i => i.ratio === '16_9' && i.width >= 500).sort((a, b) => a.width - b.width)[0];
    out.push({ artist: want[dNorm(hit)], title: e.name, date: d.localDate || '', time: d.localTime ? d.localTime.slice(0, 5) : '', at: Date.parse(d.dateTime || (d.localDate + 'T19:00:00')) || 0,
      venue: v.name || '', city: (v.city && v.city.name) || '', url: /^https:\/\//.test(e.url || '') ? e.url : '', img: img ? img.url : '', status: (e.dates && e.dates.status && e.dates.status.code) || '' });
  });
  return out.sort((a, b) => a.at - b.at);
}

/* ---------- weather radio: something for the weather and the time ---------- */
const DISC_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/**
 * The mood outside: the weather first (storms, snow and rain win), then the time of the week. `wx` is the weather
 * now ({ code, temp }, from weather.js). Returns { id, title, line, words: [search words] }.
 */
export function weatherMood(wx, now){
  const d = new Date(now || Date.now()), h = d.getHours(), day = d.getDay(), c = wx ? +wx.code : -1, t = wx && wx.temp != null ? Math.round(wx.temp) : null;
  const evening = h >= 18 || h < 1, night = h >= 23 || h < 5, morning = h >= 5 && h < 12;
  const when = night ? 'Late tonight' : evening ? 'This evening' : morning ? 'This morning' : 'This afternoon';
  const line = desc => t == null ? when : t + '° and ' + desc;       // with no weather to go on, just the time of day
  if (c >= 95) return { id: 'storm', title: 'Thunder outside', line: 'A storm over Stockport', words: ['thunderstorm', 'stormy night'] };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { id: 'snow', title: 'Snow falling', line: line('snowing'), words: ['snow day', 'cosy winter'] };
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return evening || night
    ? { id: 'rain-night', title: 'Rain on the windows', line: line('raining'), words: ['rainy night', 'rainy night jazz'] }
    : { id: 'rain', title: 'A rainy day', line: line('raining'), words: ['rainy day', 'rainy day acoustic'] };
  if (c === 45 || c === 48) return { id: 'fog', title: 'Foggy out', line: line('foggy'), words: ['ambient', 'misty morning'] };
  if (night) return { id: 'late', title: 'Late night', line: line('quiet'), words: ['late night', 'chill night'] };
  if ((day === 5 || day === 6) && evening) return { id: 'weekend', title: DISC_DAYS[day] + ' night', line: line(c >= 0 && c <= 1 ? 'clear' : 'dry'), words: [DISC_DAYS[day].toLowerCase() + ' night', 'party'] };
  if (day === 0 && morning) return { id: 'sunday', title: 'Sunday morning', line: line(c >= 0 && c <= 1 ? 'bright' : 'grey'), words: ['sunday morning', 'lazy sunday'] };
  if (c >= 0 && c <= 1 && t != null && t >= 18 && !evening) return { id: 'sun', title: 'Sunshine', line: line('sunny'), words: ['summer', 'sunny day'] };
  if (c >= 0 && c <= 1 && evening) return { id: 'golden', title: 'A clear evening', line: line('clear'), words: ['golden hour', 'evening chill'] };
  if (t != null && t < 3) return { id: 'cold', title: 'Cold out there', line: t + '° outside', words: ['cosy', 'warm acoustic'] };
  if (morning) return { id: 'morning', title: 'Good morning', line: line(c >= 0 && c <= 1 ? 'bright' : 'cloudy'), words: ['morning coffee', 'good morning'] };
  if (evening) return { id: 'evening', title: 'An evening in', line: line('cloudy'), words: ['evening chill', 'dinner'] };
  return { id: 'grey', title: 'A grey day', line: line('cloudy'), words: ['indie chill', 'cloudy day'] };
}
/** Playlists from Spotify's search answers for a mood's words: no repeats, no empty ones. */
export function radioPlaylists(answers, max){
  const seen = {}, out = [];
  answers.forEach(j => ((j && j.playlists && j.playlists.items) || []).forEach(p => {
    if (!p || !p.id || seen[p.id] || (p.tracks && p.tracks.total === 0) || (p.items && p.items.total === 0)) return;
    seen[p.id] = 1; out.push(p);
  }));
  return out.slice(0, max || 8);
}

/* ---------- your listening, from what this phone has seen you play ---------- */
export const KEEP_DAYS = 400;
/** Adds Spotify's recently played (each with played_at) to the log: [{ t, id, name, artist, artistId, ms }], oldest first. */
export function mergePlays(log, items, now){
  const have = {}, out = (log || []).slice(), cut = (now || Date.now()) - KEEP_DAYS * 864e5;
  out.forEach(p => { have[p.t + p.id] = 1; });
  (items || []).forEach(x => {
    const tr = x && (x.track || x.item), t = x && Date.parse(x.played_at);
    if (!tr || !tr.id || !t || have[t + tr.id]) return;
    have[t + tr.id] = 1;
    const a = (tr.artists || [])[0] || {};
    out.push({ t: t, id: tr.id, name: String(tr.name || '').slice(0, 80), artist: String(a.name || '').slice(0, 60), artistId: a.id || '', ms: +tr.duration_ms || 0 });
  });
  return out.filter(p => p.t >= cut).sort((a, b) => a.t - b.t);
}
/** Minutes listened in each half hour of the day (48), from plays since `from`. A play counts from when it started. */
export function listeningClock(log, from){
  const out = []; for (let i = 0; i < 48; i++) out.push(0);
  (log || []).forEach(p => { if (p.t < (from || 0)) return; const d = new Date(p.t), i = d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0); out[i] += (p.ms || 180000) / 60e3; });
  return out.map(v => Math.round(v));
}
const dDay = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
/** Minutes a day, from the first day in the log to today, with days you didn't listen as 0: [{ k, v }]. */
export function listeningDays(log, now){
  if (!log || !log.length) return [];
  const per = {};
  log.forEach(p => { const k = dDay(p.t); per[k] = (per[k] || 0) + (p.ms || 180000) / 60e3; });
  const out = [], end = dDay(now || Date.now());
  for (let d = new Date(log[0].t); ; d.setDate(d.getDate() + 1)){
    const k = dDay(+d);
    out.push({ k: k, v: Math.round(per[k] || 0) });
    if (k >= end || out.length > KEEP_DAYS + 2) break;
  }
  return out;
}
/** The artists you played most since `from`: [{ name, id, plays, mins }]. */
export function topArtists(log, from, n){
  const by = {};
  (log || []).forEach(p => { if (p.t < (from || 0) || !p.artist) return; const k = p.artistId || p.artist; const x = by[k] || (by[k] = { name: p.artist, id: p.artistId, plays: 0, mins: 0 }); x.plays++; x.mins += (p.ms || 180000) / 60e3; });
  return Object.keys(by).map(k => by[k]).sort((a, b) => b.mins - a.mins).slice(0, n || 5).map(x => Object.assign(x, { mins: Math.round(x.mins) }));
}

/* ---------- fetching, for the phone and the TV alike (`sp` is spotify(acc, clientId)) ---------- */
/** New releases from the artists you follow and play most lately, a few at a time. */
export async function fetchReleases(sp, now, days){
  const f = await sp.following().catch(() => null), top = await sp.top('artists', 'short_term', 20).catch(() => null);
  const seen = {}, artists = [];
  ((top && top.items) || []).concat((f && f.artists && f.artists.items) || []).forEach(a => { if (a && a.id && !seen[a.id] && artists.length < 30){ seen[a.id] = 1; artists.push(a); } });
  const got = [];
  for (let i = 0; i < artists.length; i += 3){
    const batch = await Promise.all(artists.slice(i, i + 3).map(a => sp.artistAlbums(a.id).then(j => ({ artist: { id: a.id, name: a.name }, albums: (j && j.items) || [] }), () => ({ artist: a, albums: [] }))));
    batch.forEach(b => got.push(b));
  }
  return recentReleases(got, now, days || 21);
}
/** Gigs near home by the artists you play (names), up to three pages of Ticketmaster's listings. */
export async function fetchGigs(key, artists){
  let events = [], page = 0, pages = 1;
  while (page < pages && page < 3){
    const r = await fetch(gigsUrl(key, page)).catch(() => null);
    if (!r) throw new Error('NETWORK');
    if (r.status === 401) throw new Error('KEY');
    if (!r.ok) throw new Error('TM' + r.status);
    const j = await r.json();
    events = events.concat((j._embedded && j._embedded.events) || []);
    pages = (j.page && j.page.totalPages) || 1; page++;
  }
  return gigsFor(events, artists);
}
/** Playlists for the mood outside, from Spotify's search. */
export async function fetchRadio(sp, mood){
  const answers = [];
  for (let i = 0; i < mood.words.length; i++) answers.push(await sp.search(mood.words[i], ['playlist'], 6).catch(() => null));
  return radioPlaylists(answers, 8);
}
/** Heads-ups (headsUp's shape) for a release out in the last few days and a gig in the next week. */
export function musicHeads(releases, gigs, now){
  const out = [], t = now || Date.now();
  const fresh = (releases || []).filter(r => (t - Date.parse(r.date + 'T00:00:00')) < 3 * 864e5);
  if (fresh.length){
    const r = fresh[0], more = fresh.length - 1;
    out.push({ kind: 'release', tone: 'gas', title: 'New from ' + r.artist.name + (more ? ' and ' + more + ' more' : ''), sub: r.album.name + ' · ' + releasedText(r.date, t) });
  }
  const g = (gigs || []).filter(x => x.at > t - 3 * 3600e3 && x.at < t + 7 * 864e5 && x.status !== 'cancelled')[0];
  if (g){
    const d = g.date ? new Date(g.date + 'T12:00:00') : new Date(g.at), days = Math.round((new Date(d.toDateString()) - new Date(new Date(t).toDateString())) / 864e5);   // the venue's own date
    const when = days <= 0 ? 'Tonight' : days === 1 ? 'Tomorrow' : DISC_DAYS[d.getDay()];
    out.push({ kind: 'gig', tone: 'neg', title: g.artist + ' at ' + g.venue, sub: when + (g.time ? ' ' + g.time : '') + (g.city ? ' · ' + g.city : '') });
  }
  return out;
}
