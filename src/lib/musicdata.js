/* The stories behind the music: credits, studios and where artists are from (MusicBrainz), the story of a song and an artist (Wikipedia, found through Wikidata), and liner notes (the Cover Art Archive). */
// Shared ES module. The display's build (build.py) also concatenates it for TV browsers, removing the
// import lines and export keywords, so keep imports on one line each and the syntax Chromium 63 can parse.
//
// None of these needs a key, and all allow browsers to call them (checked October 2026). MusicBrainz asks for no
// more than one request a second, so its calls queue. A Spotify song carries its ISRC, the recording's code, which
// MusicBrainz looks up exactly; without one, it's searched by title and artist.

export const MB = 'https://musicbrainz.org/ws/2';
const wait = ms => new Promise(r => setTimeout(r, ms));
let mbNext = 0;
/** One MusicBrainz request, a second after the last; null when it has nothing (or is too busy twice). */
export async function mbGet(path, tries){
  const now = Date.now(), at = Math.max(now, mbNext);
  mbNext = at + 1100;
  if (at > now) await wait(at - now);
  let res;
  try { res = await fetch(MB + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'fmt=json'); } catch(e){ return null; }
  if (res.status === 503 && !tries){ await wait(1500); return mbGet(path, 1); }
  if (!res.ok) return null;
  try { return await res.json(); } catch(e){ return null; }
}
const q = s => '"' + String(s || '').replace(/["\\]/g, ' ') + '"';
const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/* ---------- Greater Manchester ---------- */
// the ten boroughs and the towns and places in them that MusicBrainz names as areas
export const GREATER_MANCHESTER = ['greater manchester', 'manchester', 'salford', 'stockport', 'bolton', 'bury', 'oldham', 'rochdale', 'tameside', 'trafford', 'wigan',
  'ashton under lyne', 'altrincham', 'sale', 'stretford', 'urmston', 'hyde', 'stalybridge', 'denton', 'dukinfield', 'mossley', 'droylsden', 'audenshaw',
  'prestwich', 'radcliffe', 'whitefield', 'ramsbottom', 'heywood', 'middleton', 'leigh', 'atherton', 'tyldesley', 'hindley', 'ince in makerfield',
  'eccles', 'swinton', 'walkden', 'irlam', 'worsley', 'farnworth', 'horwich', 'westhoughton', 'chadderton', 'royton', 'shaw', 'failsworth', 'saddleworth', 'littleborough',
  'didsbury', 'chorlton', 'chorlton cum hardy', 'levenshulme', 'withington', 'wythenshawe', 'fallowfield', 'rusholme', 'moss side', 'hulme', 'ancoats', 'longsight', 'gorton',
  'burnage', 'ardwick', 'cheetham hill', 'crumpsall', 'blackley', 'moston', 'harpurhey', 'newton heath', 'clayton', 'openshaw', 'northern quarter',
  'cheadle', 'cheadle hulme', 'bramhall', 'hazel grove', 'marple', 'romiley', 'reddish', 'heaton moor', 'heaton chapel', 'edgeley', 'bredbury', 'davenport', 'offerton', 'woodford', 'poynton'];
export function isGreaterManchester(name){
  const n = norm(name);
  return !!n && GREATER_MANCHESTER.indexOf(n) >= 0;
}

/* ---------- reading MusicBrainz ---------- */
/** The Wikidata item (Q123) among a MusicBrainz entity's links, or ''. */
export function wikidataOf(e){
  const r = ((e && e.relations) || []).filter(x => x.type === 'wikidata' && x.url)[0];
  const m = r ? /\/(Q\d+)$/.exec(r.url.resource) : null;
  return m ? m[1] : '';
}
const ROLE_ORDER = ['vocal', 'instrument', 'performer', 'programming'];
/**
 * A recording's credits: who played and sang what, who produced and engineered it, where it was recorded,
 * when it first came out, and the song (work) it is a performance of.
 */
export function creditsOf(rec){
  if (!rec) return null;
  const people = {}, producers = [], engineers = [], places = [];
  let work = null;
  (rec.relations || []).forEach(r => {
    const a = r.artist, attrs = (r.attributes || []).filter(x => x !== 'additional' && x !== 'guest');
    if (a && ROLE_ORDER.indexOf(r.type) >= 0){
      const p = people[a.id] || (people[a.id] = { id: a.id, name: a.name, roles: [] });
      (attrs.length ? attrs : [r.type === 'vocal' ? 'vocals' : r.type]).forEach(x => { if (p.roles.indexOf(x) < 0) p.roles.push(x); });
    }
    if (a && r.type === 'producer' && producers.indexOf(a.name) < 0) producers.push(a.name);
    if (a && /^(engineer|recording|mix|mastering|audio)$/.test(r.type) && engineers.indexOf(a.name) < 0) engineers.push(a.name);
    if (r.place && r.type === 'recorded at' && !places.some(p => p.id === r.place.id)) places.push({ id: r.place.id, name: r.place.name });
    if (r.work && r.type === 'performance' && !work) work = { id: r.work.id, title: r.work.title };
  });
  const releases = (rec.releases || []).filter(x => x.status === 'Official' || !x.status).map(x => ({ id: x.id, title: x.title, date: x.date || '' }));
  return {
    id: rec.id, title: rec.title, released: rec['first-release-date'] || '',
    artists: (rec['artist-credit'] || []).map(c => c.artist ? { id: c.artist.id, name: c.artist.name } : null).filter(Boolean),
    performers: Object.keys(people).map(k => people[k]), producers: producers, engineers: engineers, places: places, work: work, releases: releases
  };
}
/** The songwriters from a work: composers, lyricists and writers, each once, with what they wrote. */
export function writersOf(work){
  const by = {};
  ((work && work.relations) || []).forEach(r => {
    if (!r.artist || !/^(composer|lyricist|writer|librettist)$/.test(r.type)) return;
    const w = by[r.artist.id] || (by[r.artist.id] = { id: r.artist.id, name: r.artist.name, roles: [] });
    if (w.roles.indexOf(r.type) < 0) w.roles.push(r.type);
  });
  return Object.keys(by).map(k => by[k]);
}
/** Where an artist comes from: { from, country, gm, formed, ended, group }. */
export function homeOf(a){
  if (!a) return null;
  const from = (a['begin-area'] && a['begin-area'].name) || (a.area && a.area.name) || '';
  const span = a['life-span'] || {}, group = /group|orchestra|choir/i.test(a.type || '');
  return { from: from, country: a.country || '', gm: isGreaterManchester(from) || isGreaterManchester(a.area && a.area.name),
    formed: String(span.begin || '').slice(0, 4), ended: span.ended ? String(span.end || '').slice(0, 4) : '', group: group };
}
/** The badge for a song from round here: made by Greater Manchester artists, or recorded at a studio here. */
export function localBadge(home, places){
  const studio = (places || []).filter(p => p.gm)[0];
  if (studio) return { kind: 'studio', text: 'Recorded at ' + studio.name + (studio.area ? ', ' + studio.area : '') };
  if (home && home.gm) return { kind: 'home', text: 'Made in Greater Manchester' + (home.from && norm(home.from) !== 'greater manchester' ? ' · from ' + home.from : '') };
  return null;
}
/** "lead vocals, acoustic guitar" → "Lead vocals, acoustic guitar". */
export const rolesText = roles => { const s = (roles || []).join(', ').replace(/ \(drum set\)/g, ''); return s.charAt(0).toUpperCase() + s.slice(1); };

/* ---------- finding things ---------- */
/** The MusicBrainz recording for a Spotify song: by its ISRC, or by title and artist. */
export async function recordingFor(t){
  if (!t) return null;
  const artist = norm((t.artists[0] || {}).name);
  let id = '';
  if (t.isrc){
    const j = await mbGet('/isrc/' + encodeURIComponent(t.isrc) + '?inc=artist-credits');
    const recs = (j && j.recordings) || [];
    const best = recs.filter(r => (r['artist-credit'] || []).some(c => norm(c.name) === artist))
      .sort((a, b) => String(a['first-release-date'] || '9').localeCompare(String(b['first-release-date'] || '9')))[0] || recs[0];
    if (best) id = best.id;
  }
  if (!id){
    const j = await mbGet('/recording?limit=5&query=' + encodeURIComponent('recording:' + q(t.name.replace(/ - .*$/, '')) + ' AND artist:' + q((t.artists[0] || {}).name)));
    const r = ((j && j.recordings) || []).filter(x => (x.score || 0) >= 80)[0];
    if (r) id = r.id;
  }
  if (!id) return null;
  return mbGet('/recording/' + id + '?inc=artist-credits+artist-rels+work-rels+place-rels+releases+url-rels');
}
/** The MusicBrainz artist for a name (the best exact match), with its links. */
export async function artistFor(name, mbid){
  let id = mbid || '';
  if (!id){
    const j = await mbGet('/artist?limit=5&query=' + encodeURIComponent('artist:' + q(name)));
    const want = norm(name), list = (j && j.artists) || [];
    const a = list.filter(x => norm(x.name) === want).sort((x, y) => (y.score || 0) - (x.score || 0))[0] || list.filter(x => (x.score || 0) >= 95)[0];
    if (a) id = a.id;
  }
  return id ? mbGet('/artist/' + id + '?inc=url-rels') : null;
}

/* ---------- Wikipedia, through Wikidata ---------- */
/** The English Wikipedia article for a Wikidata item, or ''. */
export async function wikiTitle(qid){
  if (!qid) return '';
  try {
    const res = await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&sitefilter=enwiki&format=json&origin=*&ids=' + qid);
    if (!res.ok) return '';
    const j = await res.json(), e = j.entities && j.entities[qid];
    return e && e.sitelinks && e.sitelinks.enwiki ? e.sitelinks.enwiki.title : '';
  } catch(e){ return ''; }
}
/** An article's opening, its picture and its address: { title, text, image, url }, or null. */
export async function wikiSummary(title){
  if (!title) return null;
  try {
    const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
    if (!res.ok) return null;
    const j = await res.json();
    if (j.type === 'disambiguation' || !j.extract) return null;
    return { title: j.title, text: j.extract, image: (j.thumbnail && j.thumbnail.source) || '', url: (j.content_urls && j.content_urls.mobile && j.content_urls.mobile.page) || '' };
  } catch(e){ return null; }
}

/* ---------- liner notes ---------- */
/** The release with the most scans in the Cover Art Archive: [{ src, thumb, types }], front first, or []. */
export async function linerNotes(releases){
  let best = [];
  for (let i = 0; i < Math.min(4, (releases || []).length); i++){
    let j = null;
    try { const res = await fetch('https://coverartarchive.org/release/' + releases[i].id); if (res.ok) j = await res.json(); } catch(e){}
    const imgs = ((j && j.images) || []).map(x => ({ src: x.image, thumb: (x.thumbnails && (x.thumbnails['500'] || x.thumbnails.large || x.thumbnails['250'])) || x.image, types: x.types || [], front: !!x.front }))
      .sort((a, b) => (b.front ? 1 : 0) - (a.front ? 1 : 0));
    if (imgs.length > best.length) best = imgs;
    if (best.length >= 4) break;
  }
  return best;
}

/* ---------- all of it, for a song and for an artist ---------- */
/**
 * The story of the song playing: its credits, songwriters, studios (and whether they're round here), the artist's
 * home, and the song's own Wikipedia article. Each part is null when it isn't known.
 */
export async function songStory(t){
  const rec = await recordingFor(t);
  const c = creditsOf(rec);
  if (!c) return { credits: null };
  const work = c.work ? await mbGet('/work/' + c.work.id + '?inc=artist-rels+url-rels') : null;
  const places = [];
  for (let i = 0; i < c.places.length && i < 2; i++){
    const p = await mbGet('/place/' + c.places[i].id);
    const area = p && p.area ? p.area.name : '';
    places.push({ id: c.places[i].id, name: c.places[i].name, area: area, gm: isGreaterManchester(area) });
  }
  const mbArtist = c.artists[0] ? await artistFor(c.artists[0].name, c.artists[0].id) : null;
  const home = homeOf(mbArtist);
  const story = await wikiSummary(await wikiTitle(wikidataOf(work) || wikidataOf(rec)));
  return { credits: c, writers: writersOf(work), places: places, home: home, badge: localBadge(home, places), story: story, artistWiki: wikidataOf(mbArtist) };
}
/** An artist's story: where they're from, and their Wikipedia article. */
export async function artistStory(name){
  const a = await artistFor(name);
  if (!a) return null;
  const home = homeOf(a);
  return { home: home, badge: localBadge(home, []), bio: await wikiSummary(await wikiTitle(wikidataOf(a))) };
}
