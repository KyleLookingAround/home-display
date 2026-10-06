/* ===================== display: the house queue, parties and who's listening (src/lib/queue.js) ===================== */
// Plain script for TV browsers (Chromium 63): no ?. or ??. The TV keeps the house's queue, because it's always on:
// phones add, move, remove and vote through the relay, guests at a party add and vote from a page of their own, and
// the TV hands Spotify the next song just before the one playing ends, so everything stays movable until then.
const HQ = { q: hqLoad(), party: cleanCode(store.get('party')) || '', partyAt: +store.get('partyAt') || 0, stopParty: null, guests: {},
  sendTimer: 0, partySent: '', nowSent: '' };
const HQ_WHY = { DUP: 'That song is already in the queue.', FULL: 'The queue is full for now.', LIMIT: 'You have ' + GUEST_MAX + ' songs waiting. Once one plays, add another.',
  LOOKUP: 'Spotify couldn\'t find that song.', NOSPOTIFY: 'Spotify isn\'t on the TV yet.', CLOSED: 'The party is over.' };

function hqLoad(){
  const q = store.getJ('houseQueue', []);
  return Array.isArray(q) ? q.filter(x => x && x.id && x.uri && x.by && Array.isArray(x.votes)) : [];
}
/** Keeps the queue, redraws, and tells the phones and the party. */
function hqSet(q, note){
  HQ.q = q; store.setJ('houseQueue', q);
  render(); D.sentState = ''; tellRemote(note); hqPartyTell();
}
/** Adds a song by its uri, looked up with the TV's own Spotify so its name and cover are Spotify's. */
async function hqAdd(uri, by, guest){
  const sp = tmSp();
  if (!sp) return { err: 'NOSPOTIFY' };
  if (HQ.q.some(x => x.uri === uri)) return { err: 'DUP' };
  let t = null;
  try { t = trackOf(await sp.track(uri.split(':')[2])); } catch(e){}
  if (!t) return { err: 'LOOKUP' };
  const r = queueAdd(HQ.q, queueItem(t, by, Date.now()), { guest: guest });
  if (r.err) return r;
  hqSet(r.q, (by.name || 'Someone') + ' added ' + t.name);
  toast('♪ ' + (by.name || 'Someone') + ' added ' + t.name + ' · ' + t.artist, 4000);
  return { item: r.q[r.q.length - 1] };
}
/** From a paired phone: add, move, remove or vote. */
function hqCommand(r){
  if (r.op === 'add') hqAdd(r.uri, r.who, false).then(x => { if (x.err) tellRemote(HQ_WHY[x.err]); });
  else if (r.op === 'move') hqSet(queueMove(HQ.q, r.id, r.to));
  else if (r.op === 'remove') hqSet(queueRemove(HQ.q, r.id));
  else if (r.op === 'vote') hqSet(queueVote(HQ.q, r.id, r.who.id));
}
/** Every second: hand Spotify the next song as this one ends, and drop songs that have started. */
function hqTick(now){
  if (HQ.party && now - HQ.partyAt > 12 * 3600e3) hqParty(false);
  const m = tmModel();
  const id = m && m.track ? m.track.id + (m.playing ? '>' : '|') : '';
  if (id !== HQ.nowSent){ HQ.nowSent = id; hqPartyTell(); }
  // at a party, a song added while nothing at all is playing starts the music (never a paused song, though)
  if (HQ.party && SRC.music.at && !(m && m.track) && HQ.q.some(x => !x.fed) && now - (HQ.started || 0) > 30e3){ HQ.started = now; hqStart(); return; }
  if (!HQ.q.length || !m) return;
  const r = queueStep(HQ.q, m, now);
  if (!r.feed && !r.played && r.q.length === HQ.q.length) return;
  hqSet(r.q);
  const sp = tmSp();
  if (r.feed && sp) sp.addToQueue(r.feed.uri, tmDevice()).catch(() => hqSet(queueFed(HQ.q, r.feed.id, 0)));
}
/** Plays the house queue from the top, when nothing is playing: on the device last used, or the first awake. */
function hqStart(){
  const top = HQ.q.filter(x => !x.fed)[0];
  if (!top) return;
  hqSet(queueFed(HQ.q, top.id, Date.now()));
  tmAct(sp => sp.play({ device: tmDevice(), uris: [top.uri] }).catch(e => {
    if (e.code !== 'NO_DEVICE') throw e;
    return sp.devices().then(ds => { const d = playOn(ds, null)[0]; if (!d) throw e; return sp.play({ device: d.id, uris: [top.uri] }); });
  }).catch(e => { hqSet(queueFed(HQ.q, top.id, 0)); throw e; }), 900);
}
/** Skipping with songs waiting in the house queue plays the next of them, not what Spotify would have played. */
function hqSkip(sp, dev){
  const top = HQ.q.length && !HQ.q[0].fed ? HQ.q[0] : null;
  if (!top) return sp.next(dev);
  hqSet(queueFed(HQ.q, top.id, Date.now()));
  return sp.addToQueue(top.uri, dev).then(() => sp.next(dev), e => { hqSet(queueFed(HQ.q, top.id, 0)); throw e; });
}

/* ---------- parties: guests scan a code and add songs, on a topic of their own ---------- */
function hqParty(on){
  if (HQ.stopParty){ HQ.stopParty(); HQ.stopParty = null; }
  if (on){
    if (!tmSp()){ toast('Spotify isn\'t on this screen yet: on your phone, Screen, then Connect Spotify on the TV.', 6000); return; }
    if (!HQ.party){ HQ.party = newRemoteCode(); HQ.partyAt = Date.now(); store.set('party', HQ.party); store.set('partyAt', String(HQ.partyAt)); toast('The party\'s on. Guests scan the code to add songs.', 5000); }
    HQ.stopParty = listenTopic(partyTopic(HQ.party), readParty, hqGuest);
    if (D.mode !== 'music') setMode('music');
  } else if (HQ.party){
    sendTopic(partyTopic(HQ.party), { from: 'screen', party: { open: false, at: Date.now() } });
    HQ.party = ''; HQ.guests = {}; HQ.partySent = ''; store.del('party'); store.del('partyAt');
    toast('The party\'s over. The house queue stays.', 4000);
  }
  D.sentState = ''; tellRemote(on ? 'Party on' : 'Party over'); render();
  if (on) hqPartyTell(true);
}
/** A guest's request. Each guest gets a search a second, a few hundred requests a party, and songs only up to the limit (queueAdd). */
function hqGuest(r){
  if (r.from !== 'guest' || !HQ.party) return;
  const now = Date.now(), g = HQ.guests[r.who.id] || (HQ.guests[r.who.id] = { t: 0, n: 0 });
  if (g.n > 400 || (r.cmd === 'search' && now - g.t < 1000)) return;
  g.n++; if (r.cmd === 'search') g.t = now;
  if (r.cmd === 'hello') hqPartyTell(true);
  else if (r.cmd === 'search') hqSearch(r);
  else if (r.cmd === 'add') hqAdd(r.uri, r.who, true).then(x => hqReply(r.who.id, x.err ? HQ_WHY[x.err] : 'Added ' + x.item.name + '. It\'s number ' + (HQ.q.map(y => y.id).indexOf(x.item.id) + 1) + ' in the queue.', !x.err));
  else if (r.cmd === 'vote') hqSet(queueVote(HQ.q, r.id, r.who.id));
}
function hqReply(to, text, ok){ sendTopic(partyTopic(HQ.party), { from: 'screen', to: to, reply: text, ok: !!ok }); }
function hqSearch(r){
  const sp = tmSp(); if (!sp) return;
  sp.search(r.q, ['track'], 8).then(j => {
    const list = ((j && j.tracks && j.tracks.items) || []).filter(Boolean).map(trackOf).filter(t => t && t.playable !== false);
    sendTopic(partyTopic(HQ.party), { from: 'screen', rid: r.rid, to: r.who.id, results: list.map(t => ({ u: t.uri, n: t.name.slice(0, 80), a: t.artist.slice(0, 60), m: coverId(artUrl(t.images, 300)), d: t.dur })) });
  }, () => hqReply(r.who.id, 'Spotify didn\'t answer. Try again in a moment.', false));
}
/** Tells the party what's playing and what's next, a moment after anything changes. */
function hqPartyTell(force){
  if (!HQ.party) return;
  clearTimeout(HQ.sendTimer);
  HQ.sendTimer = setTimeout(() => {
    const t = tmTrack(), m = tmModel();
    const msg = { from: 'screen', party: { open: true, at: Date.now(), now: t ? { n: t.name.slice(0, 80), a: t.artist.slice(0, 60), m: coverId(artUrl(t.images, 300)), p: !!(m && m.playing) } : null,
      q: queueWire(HQ.q), more: Math.max(0, HQ.q.length - WIRE_MAX) } };
    const key = JSON.stringify([msg.party.now, msg.party.q, msg.party.more]);
    if (key === HQ.partySent && !force) return;
    HQ.partySent = key;
    sendTopic(partyTopic(HQ.party), msg);
  }, force ? 50 : 700);
}
function hqPartyUrl(){
  if (!HQ.party || !/^https?:$/.test(location.protocol)) return '';
  return location.href.split('#')[0].replace(/[^\/]*$/, '') + 'party.html#' + HQ.party;
}
/** After a reload, a party that was on carries on. */
function hqResume(){ if (HQ.party && !D.embed) hqParty(true); }

/* ---------- on the Music view: what's next in the house queue, and the party's code ---------- */
function hqNextHtml(){
  const list = HQ.q.slice(0, 3);
  if (!list.length) return '';
  const rest = HQ.q.length - list.length;
  return '<p class="label">Up next in the house queue' + (rest > 0 ? ' · ' + rest + ' more' : '') + '</p><ol class="hq">' + list.map(x =>
    `<li><span class="t"><b>${esc(x.name)}</b> <span class="muted">· ${esc(x.artist)}</span></span>${x.votes.length ? `<span class="votes">♥ ${x.votes.length}</span>` : ''}${x.by.name ? `<span class="by">${esc(x.by.name)}</span>` : ''}</li>`).join('') + '</ol>';
}
function hqPartyHtml(){
  const url = hqPartyUrl();
  if (!url) return '<p class="label">Party</p><p class="note">Open the display from the website to show guests a code.</p>';
  return `<p class="label">Party · add a song</p><div class="pqr">${qrSvg(url, { label: 'Code to add songs to the party' })}</div><p class="pcode mono">${showCode(HQ.party)}</p><p class="note">Scan with your phone's camera. Up to ${GUEST_MAX} songs each; vote for the ones you want sooner.</p>`;
}

/* ---------- who's listening: the TV can hold several people's Spotify, and plays as one of them ---------- */
function tmPeople(){ return spotifyStore().accounts.map(a => ({ id: a.id, name: a.name || a.id })); }
function tmListen(id){
  const s = spotifyStore(), a = s.accounts.filter(x => x.id === id)[0];
  if (!a){ toast('That Spotify isn\'t on this screen.', 4000); return; }
  s.active = a.id; saveSpotifyStore(s);
  TM.acc = a; TM.lastTrack = '';
  ['music', 'shelf'].forEach(k => { SRC[k].data = null; SRC[k].err = null; SRC[k].last = 0; SRC[k].fails = 0; });
  toast('Listening as ' + (a.name || a.id), 3000);
  D.sentState = ''; tellRemote('Listening as ' + (a.name || a.id)); render();
}
