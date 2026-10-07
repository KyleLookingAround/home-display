/* ===================== display: music on the TV (Spotify) ===================== */
// Plain script for TV browsers (Chromium 63): no ?. or ??. The TV is signed in to Spotify from a phone (sealed with
// the PIN, like the Octopus account) and then reads and controls Spotify itself: the Music view, a line on Today, the
// cover in the screensaver, favourites on the number keys, and the sleep timer and bedtime fade, which need a device
// that's always on.
const TM = { acc: null, lyrics: null, lyricsFor: '', queue: null, view: 'player', story: null, storyFor: '', notes: null, notesFor: '', notePage: 0,
  sleepAt: 0, sleepSong: '', fading: false, wasNight: null, radio: null, radioFor: '', radioAt: 0, lastTrack: '', shownLine: -2 };
const TM_VIEWS = ['player', 'lyrics', 'notes'];

function tmSp(){
  // In the phone's Screen page (embed), the picture borrows the phone's own sign-in while it's fresh, and never
  // refreshes it, so the two can't trip over each other's tokens.
  if (D.embed){ const a = activeAccount(); TM.acc = a && a.exp > Date.now() + 60e3 ? a : null; }
  else if (!TM.acc) TM.acc = activeAccount();
  return TM.acc ? spotify(TM.acc, TM.acc.client) : null;
}
const tmModel = () => SRC.music.data || null;
const tmTrack = () => tmModel() ? tmModel().track : null;

/** Read by the data scheduler: what's playing (playerModel), and the song's lyrics when it changes. */
async function pollSpotify(){
  const sp = tmSp();
  if (!sp) return null;
  tmWebStart();                             // this screen as a player of its own, once
  const acc = TM.acc, asked = Date.now();
  const m = playerModel(await sp.player(), Date.now());
  // an answer that left before a command, or for someone else (listening as another person since), is out of date
  if (TM.acc !== acc || asked < TM.cmdAt) return SRC.music.data;
  const id = m && m.track ? m.track.id : '';
  if (id !== TM.lastTrack){
    TM.lastTrack = id; TM.lyrics = null; TM.lyricsFor = ''; TM.story = null; TM.storyFor = ''; TM.notes = null; TM.notesFor = ''; TM.notePage = 0; TM.shownLine = -2;
    if (m && m.track){
      loadLyrics(m.track).then(l => { if (TM.lastTrack === m.track.id){ TM.lyrics = l; TM.lyricsFor = m.track.id; render(); } });
      sp.queue().then(q => { TM.queue = ((q && q.queue) || []).map(trackOf).filter(Boolean).slice(0, 3); render(); }, () => {});
      if (TM.view === 'notes') tmNotes();
    }
  }
  return m;
}
/** Ask Spotify again shortly, after a command. */
function tmSoon(ms){ const s = SRC.music; s.last = Date.now() - s.every() + (ms || 700); }
async function tmAct(fn, after){
  const sp = tmSp(); if (!sp) return;
  TM.cmdAt = Date.now();
  try { await fn(sp); SRC.music.err = null; }
  catch(e){ const t = spotifyErrorText(e); toast(t[0] + ' ' + t[1], 6000); tellRemote(t[0]); }
  tmSoon(after);
}
/**
 * Where commands go: the device that's on now, unless it's the TV's Spotify app sitting idle; then this screen's own
 * player. This screen's player gets a new id each time it starts, so it's always asked for by the id it has now.
 */
const tmDevice = () => {
  const m = tmModel();
  if (m && m.device && m.device.name === SCREEN_PLAYER && WEB.id) return WEB.id;
  return keepDevice(m) ? m.device.id : WEB.id || (m && m.device ? m.device.id : null);
};

/* ---------- this screen as a Spotify player of its own (Spotify's Web Playback SDK) ---------- */
// So music plays here, through the TV's speakers, and Spotify's own app never takes the screen over. It needs
// Premium, a sign-in with the "streaming" permission (TV sign-ins from October 2026 have it) and a browser that can
// play protected audio; without them the screen says why, and music plays on the best other device (bestDevice).
const WEB = { player: null, id: '', err: '', loading: false, woke: false };
function tmWebStart(){
  if (WEB.loading || D.embed || !TM.acc || !/^https:$/.test(location.protocol)) return;
  if (!navigator.requestMediaKeySystemAccess || typeof Promise === 'undefined'){ WEB.err = 'This TV\'s browser can\'t play Spotify itself'; return; }
  WEB.loading = true;
  const cant = msg => { WEB.err = msg; WEB.id = ''; render(); };
  window.onSpotifyWebPlaybackSDKReady = function(){
    try {
      const p = new window.Spotify.Player({ name: SCREEN_PLAYER, volume: 0.7,
        getOAuthToken: function(cb){ const a = TM.acc; if (!a) return cb(''); accessToken(a, a.client).then(cb, function(){ cb(''); }); } });
      p.addListener('ready', function(e){ WEB.id = e.device_id; WEB.err = ''; render(); });
      p.addListener('not_ready', function(){ WEB.id = ''; });
      p.addListener('initialization_error', function(){ cant('This TV\'s browser can\'t play Spotify itself'); });
      p.addListener('authentication_error', function(){ cant('Sign the TV in to Spotify again on your phone to play on this screen'); });
      p.addListener('account_error', function(){ cant('Playing on this screen needs Spotify Premium'); });
      // the browser won't let it make a sound until someone presses something on this screen
      p.addListener('autoplay_failed', function(){ WEB.woke = false; toast('Press OK on the remote to let the TV play sound.', 8000); tellRemote('Press OK on the TV remote to let it play sound'); });
      p.connect();
      WEB.player = p;
    } catch(e){ cant('This TV\'s browser can\'t play Spotify itself'); }
  };
  const s = document.createElement('script');
  s.src = 'https://sdk.scdn.co/spotify-player.js'; s.async = true;
  s.onerror = function(){ WEB.loading = false; cant('Spotify\'s player didn\'t load'); };
  document.head.appendChild(s);
}
/** Browsers only let a page make sound after someone presses something: the first key, tap or click does it. */
function tmWebWake(){ if (WEB.player && !WEB.woke && WEB.player.activateElement){ WEB.woke = true; try { WEB.player.activateElement(); } catch(e){} } }
/** Starts this screen's player again, as whoever's listening now (a new sign-in, or listening as someone else). */
function tmWebRestart(){
  if (!WEB.player) return;
  try { WEB.player.disconnect(); } catch(e){}
  WEB.player = null; WEB.id = ''; WEB.err = ''; WEB.woke = false;
  if (window.Spotify && window.onSpotifyWebPlaybackSDKReady) window.onSpotifyWebPlaybackSDKReady();
}
/** Where music plays, for the foot of the Music view. */
const tmWhere = () => WEB.id ? 'plays on this screen' : WEB.err ? WEB.err.charAt(0).toLowerCase() + WEB.err.slice(1) : '';
function tmToggle(){
  const m = tmModel();
  if (m){ SRC.music.data = Object.assign({}, m, { playing: !m.playing, progress: progressAt(m, Date.now()), at: Date.now() }); render(); }
  return tmAct(sp => m && m.playing ? sp.pause(tmDevice()) : sp.play({ device: tmDevice() }));
}
/** One skip at a time: a held key, or a second press before Spotify has moved on, doesn't skip again. */
function tmNext(){
  const now = Date.now();
  if (now - (TM.skipAt || 0) < 1500) return;
  TM.skipAt = now;
  return tmAct(sp => hqSkip(sp), 600);
}
/** Back to the start of the song, or (in its first seconds, or just after a skip) the song before. */
function tmPrev(){
  const now = Date.now();
  if (now - (TM.skipAt || 0) < 1500) return;
  const fresh = now - (TM.skipAt || 0) > 8000 || SRC.music.at > (TM.skipAt || 0);   // the song shown is the one playing
  TM.skipAt = now;
  return tmAct(sp => fresh && progressAt(tmModel(), now) > 4000 ? sp.seek(0, tmDevice()) : sp.previous(null), 600);
}
/** A favourite from the number keys: a playlist or album, from the top. */
function tmFavourite(i){
  const f = tmFavs()[i];
  if (!f){ toast('No favourite on ' + (i + 1) + '. Choose them on your phone: Screen, then Spotify on the TV.', 5000); return; }
  toast('Playing ' + f.name, 3000);
  tmPlayContext(f.uri);
}
/** Plays an album or playlist from the top: where Spotify last played, or the first device that's awake. */
function tmPlayContext(uri){
  tmAct(sp => sp.play({ device: tmDevice(), context: uri }).catch(e => {
    if (e.code !== 'NO_DEVICE') throw e;
    return sp.devices().then(ds => { const d = bestDevice(playOn(ds, null)); if (!d) throw e; return sp.play({ device: d.id, context: uri }); });
  }), 900);
}
/** Weather radio (0 on the remote): a playlist for the weather and the time of the week (src/lib/discover.js). */
async function tmRadio(){
  const sp = tmSp(); if (!sp) return;
  const mood = weatherMood(SRC.weather.data && SRC.weather.data.now, Date.now());
  let list = TM.radioFor === mood.id && Date.now() - TM.radioAt < 6 * 60 * MIN ? TM.radio : null;
  if (!list){
    toast('Weather radio: finding something for ' + mood.title.toLowerCase() + '…', 4000);
    list = await fetchRadio(sp, mood).catch(() => []);
    TM.radio = list; TM.radioFor = mood.id; TM.radioAt = Date.now();
  }
  if (!list.length){ toast('Spotify didn\'t find anything for ' + mood.title.toLowerCase() + '. Try again later.', 5000); return; }
  const p = list[Math.floor(Math.random() * Math.min(3, list.length))];
  toast('Weather radio · ' + mood.title + ': ' + p.name, 5000);
  tmPlayContext(p.uri);
}
/** Favourites: chosen on the phone, or else your first playlists. */
function tmFavs(){
  const mine = store.getJ('musicFavs', null);
  if (mine && mine.length) return mine.slice(0, 9);
  return (SRC.shelf.data && SRC.shelf.data.playlists || []).slice(0, 5).map(p => ({ uri: p.uri, name: p.name }));
}
/** Your saved albums and playlists, for the album wall and the default favourites: read a few times a day. */
async function tmShelf(){
  const sp = tmSp(); if (!sp) return null;
  const al = await sp.albums(0), pl = await sp.playlists(0);
  return { albums: page(al).items.map(x => x.album || x).filter(x => x && x.id).slice(0, 24), playlists: page(pl).items.filter(x => x && x.id) };
}
async function tmNotes(){
  const t = tmTrack(); if (!t || TM.notesFor === t.id) return;
  TM.notesFor = t.id; TM.notes = null; render();
  try {
    if (TM.storyFor !== t.id){ TM.story = await songStory(t); TM.storyFor = t.id; }
    TM.notes = TM.story && TM.story.credits ? await linerNotes(TM.story.credits.releases) : [];
  } catch(e){ TM.notes = []; }
  if (tmTrack() && tmTrack().id === t.id) render();
}

/* ---------- the sleep timer, and fading out as the night window starts ---------- */
/** From the phone: sleep in so many minutes (0 turns it off), or at the end of this song. */
function tmSleep(mins, song){
  TM.sleepAt = 0; TM.sleepSong = '';
  if (song && tmTrack()){ TM.sleepSong = tmTrack().id; toast('The music stops at the end of this song.', 4000); }
  else if (mins > 0){ TM.sleepAt = Date.now() + mins * MIN; toast('The music fades out in ' + mins + ' minutes.', 4000); }
  else toast('Sleep timer off.', 3000);
  render(); tellRemote('Sleep timer ' + (TM.sleepSong ? 'at the end of the song' : TM.sleepAt ? hhmm(TM.sleepAt) : 'off'));
}
/** Turns it down over a minute (or a few seconds), pauses, then puts the volume back for next time. */
async function tmFade(secs){
  const m = tmModel(), sp = tmSp();
  if (TM.fading || !m || !m.playing || !sp) return;
  TM.fading = true;
  const id = tmDevice(), v0 = m.device && m.device.canVolume && m.device.volume != null ? m.device.volume : null, steps = 10;
  try {
    if (v0 != null) for (let i = 1; i < steps; i++){ await sp.volume(Math.round(v0 * (1 - i / steps)), id); await new Promise(r => setTimeout(r, secs * 1000 / steps)); }
    await sp.pause(id);
    if (v0 != null){ await new Promise(r => setTimeout(r, 1500)); await sp.volume(v0, id); }
  } catch(e){}
  TM.fading = false; TM.sleepAt = 0; TM.sleepSong = '';
  tmSoon(500); render(); tellRemote('Music faded out');
}
/** Every second: the sleep timer's moment, and the start of the night window. */
function tmTick(now){
  if (!TM.acc) return;
  if (D.embed){ if (shown() === 'music') tmTickView(now); return; }
  const m = tmModel();
  if (TM.sleepAt && now >= TM.sleepAt - 60e3 && !TM.fading){
    // nothing playing when the time comes: the timer is done, rather than waiting to stop the next song someone plays
    if (!(m && m.playing)){ if (now >= TM.sleepAt){ TM.sleepAt = 0; render(); tellRemote('Sleep timer off'); } }
    else tmFade(60);
  }
  if (TM.sleepSong && m && m.track){
    if (m.track.id !== TM.sleepSong){ TM.sleepSong = ''; tmAct(sp => sp.pause(tmDevice())); }
    else if (m.track.dur - progressAt(m, now) < 9000 && !TM.fading) tmFade(8);
  }
  const night = D.set.night && inWindow(now, D.set.nightFrom, D.set.nightTo);
  // only as the window starts: a screen that wakes up or reloads in the night (the fresh start is at 03:30) leaves it be
  if (night && TM.wasNight === false && D.set.musicNight !== false && !HQ.party && m && m.playing) tmFade(60);
  TM.wasNight = night;
  hqTick(now);
  if (shown() === 'music') tmTickView(now);
}

/* ---------- the Music view ---------- */
function tmTickView(now){
  const m = tmModel(), t = tmTrack();
  if (!m || !t) return;
  const pos = progressAt(m, now);
  const bar = $('#mBar'); if (bar) bar.style.width = (t.dur ? Math.min(100, pos / t.dur * 100) : 0).toFixed(2) + '%';
  const p = $('#mPos'); if (p) p.textContent = fmtDur(pos);
  const r = $('#mLeft'); if (r) r.textContent = '-' + fmtDur(Math.max(0, t.dur - pos));
  const lines = TM.lyrics && TM.lyrics.synced && TM.lyricsFor === t.id ? TM.lyrics.synced : null;
  if (lines && TM.view !== 'notes'){ const i = lyricAt(lines, pos + 250); if (i !== TM.shownLine){ TM.shownLine = i; tmLyricsHtml(lines, i); } }
}
function tmLyricsHtml(lines, i){
  const el = $('#mLyrics'); if (!el) return;
  const full = TM.view === 'lyrics', from = full ? Math.max(0, i - 2) : Math.max(0, i), n = full ? 7 : 3;
  el.innerHTML = lines.slice(from, from + n).map((l, k) => `<p class="${from + k === i ? 'now' : from + k < i ? 'done' : ''}">${esc(l.text || '♪')}</p>`).join('');
}
function renderMusic(){
  const sec = $('section[data-mode="music"]');
  const m = tmModel(), t = tmTrack();
  sec.className = 'mode music-mode view-' + TM.view + (HQ.party ? ' party-on' : '');
  $('#mParty').hidden = !HQ.party || !(TM.acc && t);
  if (HQ.party) setHtml($('#mParty'), hqPartyHtml());
  $('#mEmpty').hidden = !!(TM.acc && t);
  $('#mMain').hidden = !(TM.acc && t);
  if (!TM.acc){
    $('#mEmpty').innerHTML = '<p class="label">Music</p><p class="big">Spotify isn\'t on this screen yet</p><p class="note">On your phone: Screen, then <b>Connect Spotify on the TV</b>. It\'s sealed with the PIN, like the Octopus account.</p>';
    $('#mFoot').innerHTML = '<span>Spotify</span>'; return;
  }
  if (!t){
    const e = SRC.music.err;
    const waiting = HQ.q.filter(x => !x.fed).length;
    setHtml($('#mEmpty'), '<div class="m-idle"><p class="label">Music</p><p class="big">Nothing playing</p><p class="note">' + (e ? esc(spotifyErrorText(e).join(' ')) + ' ' : '') + (waiting ? 'Press OK to play the house queue' + (tmFavs().length ? ', or a number for a favourite.' : '.')
      : (tmFavs().length ? 'Press ' + (tmFavs().length > 1 ? '1 to ' + tmFavs().length : '1') + ' for a favourite, ' : 'Play on any Spotify device, or press ') + '0 for weather radio: ' + esc(weatherMood(SRC.weather.data && SRC.weather.data.now, Date.now()).title.toLowerCase()) + '.') + '</p>'
      + (waiting ? '<div class="m-next">' + hqNextHtml() + '</div>' : tmFavsHtml() + tmWallHtml()) + '</div>' + (HQ.party ? '<aside class="m-party">' + hqPartyHtml() + '</aside>' : ''));
    $('#mEmpty').className = 'm-empty' + (HQ.party ? ' with-party' : '');
    $('#mFoot').innerHTML = '<span>' + (TM.acc.name ? 'Spotify · ' + esc(TM.acc.name) : 'Spotify') + (tmWhere() ? ' · ' + esc(tmWhere()) : '') + '</span>'; return;
  }
  const art = artUrl(t.images, 640);
  if ($('#mCover').getAttribute('src') !== art){ $('#mCover').setAttribute('src', art); $('#mNeb').setAttribute('src', artUrl(t.images, 300)); }
  $('#mWhere').textContent = (m.playing ? 'Playing on ' : 'Paused on ') + (m.device ? m.device.name : 'Spotify') + (TM.sleepAt ? ' · sleep at ' + hhmm(TM.sleepAt) : TM.sleepSong ? ' · stopping after this song' : '');
  $('#mTitle').textContent = t.name;
  $('#mArtist').textContent = t.artist + (t.album.name && !t.episode ? ' · ' + t.album.name : '');
  $('#mState').className = 'mstate ' + (m.playing ? 'on' : 'off');
  if (!$('#mState').firstChild) $('#mState').innerHTML = '<i></i><i></i><i></i>';
  const q = TM.queue && TM.queue.length ? TM.queue[0] : null;
  $('#mNext').innerHTML = HQ.q.length ? hqNextHtml() : q ? '<span class="label">Up next</span> ' + esc(q.name) + ' <span class="muted">· ' + esc(q.artist) + '</span>' : '';
  const lines = TM.lyrics && TM.lyrics.synced && TM.lyricsFor === t.id ? TM.lyrics.synced : null;
  if (TM.view === 'notes') tmNotesHtml();
  else if (lines){ TM.shownLine = -2; tmTickView(Date.now()); }
  else $('#mLyrics').innerHTML = TM.lyricsFor === t.id || TM.lyrics ? '<p class="note">' + (TM.lyrics && TM.lyrics.instrumental ? 'An instrumental.' : 'No timed lyrics for this one.') + '</p>' : '';
  tmTickView(Date.now());
  $('#mFoot').innerHTML = '<span>OK play or pause · ◀ ▶ skip · ▼ ' + (TM.view === 'player' ? 'lyrics' : TM.view === 'lyrics' ? 'liner notes' : 'back to the player') + ' · 1–' + Math.max(1, tmFavs().length) + ' favourites · 0 weather radio</span>' + (TM.acc.name ? '<span>Spotify · ' + esc(TM.acc.name) + '</span>' : '');
}
/** The album wall: covers from your shelf, a different few each hour. */
function tmWallHtml(){
  const al = (SRC.shelf.data && SRC.shelf.data.albums || []).filter(a => a.images && a.images.length);
  if (!al.length) return '';
  const start = Math.floor(Date.now() / 3600e3) % al.length, n = Math.min(7, al.length), out = [];
  for (let i = 0; i < n; i++) out.push(`<img src="${esc(artUrl(al[(start + i) % al.length].images, 300))}" alt="">`);
  return '<div class="mwall" aria-hidden="true">' + out.join('') + '</div>';
}
function tmFavsHtml(){
  const f = tmFavs();
  return f.length ? '<ol class="favs">' + f.map((x, i) => `<li><b class="mono">${i + 1}</b>${esc(x.name)}</li>`).join('') + '</ol>' : '';
}
function tmNotesHtml(){
  const el = $('#mLyrics'), n = TM.notes;
  if (!n){ el.innerHTML = '<p class="note">Finding the sleeve and booklet…</p>'; return; }
  if (!n.length){ el.innerHTML = '<p class="note">No scans of this release in the Cover Art Archive yet.</p>'; return; }
  const i = Math.max(0, Math.min(n.length - 1, TM.notePage)), im = n[i];
  el.innerHTML = `<figure class="note-page"><img src="${esc(im.thumb)}" alt=""><figcaption class="label">${esc((im.types || []).join(', ') || 'Artwork')} · ${i + 1} of ${n.length} · ◀ ▶ to turn</figcaption></figure>`;
}
/**
 * The remote in the Music view: OK plays or pauses, left and right skip (or turn the liner notes), down changes view,
 * numbers play favourites. With nothing playing, the arrows and OK do what they do everywhere else.
 */
function tmKey(e){
  if (!TM.acc) return false;
  if (e.repeat && tmTrack() && /^(Arrow|Enter)/.test(e.key)) return true;
  if (/^[1-9]$/.test(e.key)){ tmFavourite(+e.key - 1); return true; }
  if (e.key === '0'){ tmRadio(); return true; }
  if (hqIdle(tmModel(), Date.now()) && e.key === 'Enter' && HQ.q.some(x => !x.fed)){ hqStart(); return true; }
  if (!tmTrack()) return false;
  if (e.key === 'Enter'){ tmToggle(); return true; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    const fwd = e.key === 'ArrowRight';
    if (TM.view === 'notes' && TM.notes && TM.notes.length){ TM.notePage = Math.max(0, Math.min(TM.notes.length - 1, TM.notePage + (fwd ? 1 : -1))); tmNotesHtml(); }
    else (fwd ? tmNext : tmPrev)();
    return true;
  }
  if (e.key === 'ArrowDown'){ TM.view = TM_VIEWS[(TM_VIEWS.indexOf(TM.view) + 1) % TM_VIEWS.length]; if (TM.view === 'notes') tmNotes(); TM.shownLine = -2; renderMusic(); return true; }
  return false;
}
/** Media keys, on any view: play and pause, next and previous. */
const MEDIA_KEYS = { MediaPlayPause: 'toggle', MediaPlay: 'toggle', MediaPause: 'toggle', MediaTrackNext: 'next', MediaTrackPrevious: 'prev', 179: 'toggle', 415: 'toggle', 19: 'toggle', 176: 'next', 417: 'next', 177: 'prev', 412: 'prev' };
function tmMediaKey(e){
  const a = MEDIA_KEYS[e.key] || MEDIA_KEYS[e.keyCode];
  if (!a || !TM.acc) return false;
  if (e.repeat) return true;
  if (a === 'toggle') tmToggle(); else if (a === 'next') tmNext(); else tmPrev();
  return true;
}

/* ---------- elsewhere: a line on Today, and cards for the screensaver ---------- */
function tmTodayHtml(){
  const m = tmModel(), t = tmTrack();
  if (!t || !m.playing) return '';
  return `<span class="np-ic">♪</span><b>${esc(t.name)}</b> <span class="muted">· ${esc(t.artist)}${m.device ? ' · ' + esc(m.device.name) : ''}</span>`;
}
/** From the phone, sealed: this screen's own Spotify sign-in. */
function tmTake(acc){
  rememberAccount(acc);                     // alongside anyone already here, and listening as them
  TM.acc = acc; TM.lastTrack = '';
  // a new sign-in may bring the permission to play here: start this screen's player again with it
  tmWebRestart();
  ['music', 'shelf'].forEach(k => { SRC[k].data = null; SRC[k].err = null; SRC[k].last = 0; SRC[k].fails = 0; });
}
