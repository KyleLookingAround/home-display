<script>
  /*
   * The Music tab. Not a list but a place to start: a greeting, shortcuts to what you play most, and rows to scroll
   * (jump back in, your playlists, your top artists, your albums, what you played lately). Search sits on top and
   * leads with its best match. Playlists, albums and artists open in the page (music.html#album/<id>), lit by their
   * own covers, and Back returns. Tap a song to play it where Spotify is playing; + adds it to Up next.
   */
  import { onMount, untrack } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { music, sp, watchMusic, play, setShuffle, colourOf, haptic, toggle, openPlayer } from '../../state/music.svelte.js';
  import { beginSignIn, spotifyErrorText } from '../../lib/spotify.js';
  import { trackOf, page, artUrl, fmtDur } from '../../lib/music.js';
  import { houseSettings } from '../../state/house.js';
  import Icon from './Icon.svelte';
  import TrackRow from './TrackRow.svelte';
  import Tile from './Tile.svelte';
  import Row from './Row.svelte';
  import Shelf from './Shelf.svelte';
  import People from './People.svelte';
  import Radio from './Radio.svelte';
  import NewReleases from './NewReleases.svelte';
  import Gigs from './Gigs.svelte';
  import Listening from './Listening.svelte';
  import FansAlso from './FansAlso.svelte';
  import { disc } from '../../state/discover.svelte.js';
  import { topArtists } from '../../lib/discover.js';
  import { artistStory } from '../../lib/musicdata.js';
  import { cacheGet, cacheSet } from '../../state/cache.js';

  /* ---------- where we are: #playlist/<id>, #album/<id>, #artist/<id>, or a whole list (#liked, #recent, #playlists, #albums, #artists) ---------- */
  let route = $state({ kind: '', id: '' }), clientId = $state('');
  const readRoute = () => {
    const h = location.hash.slice(1), m = /^(playlist|album|artist)\/([A-Za-z0-9]+)$/.exec(h);
    route = m ? { kind: m[1], id: m[2] } : /^(liked|recent|playlists|albums|artists|shelf)$/.test(h) ? { kind: 'list', id: h } : /^(listening|gigs)$/.test(h) ? { kind: h, id: '' } : { kind: '', id: '' };
    window.scrollTo(0, 0);
  };
  onMount(async () => {
    watchMusic(); readRoute();
    window.addEventListener('hashchange', readRoute);
    const h = await houseSettings();
    clientId = (h && h.spotifyClientId) || store.get('spotifyClient') || '';
    return () => window.removeEventListener('hashchange', readRoute);
  });
  const back = e => { if (history.length > 1 && /music\.html/.test(document.referrer || location.href)){ e.preventDefault(); history.back(); } };

  /* ---------- your music, for the start page and the lists ---------- */
  let lib = $state.raw({}), more = $state({}), libErr = $state.raw(null), loading = $state('');
  const CTX = 'musicCtx';
  async function load(which, again){
    if (!music.acc || (lib[which] && !again) || loading === which) return;
    loading = which;
    try {
      const off = again && lib[which] ? lib[which].length : 0;
      let rows = [], next = false;
      if (which === 'playlists'){ const p = page(await sp().playlists(off)); rows = p.items.filter(x => x && x.id); next = p.next; }
      else if (which === 'albums'){ const p = page(await sp().albums(off)); rows = p.items.map(x => x.album || x).filter(x => x && x.id); next = p.next; }
      else if (which === 'liked'){ const p = page(await sp().liked(off)); rows = p.items.map(x => trackOf(x.track)).filter(x => x && x.id); next = p.next; }
      else if (which === 'artists'){ const p = page(await sp().top('artists', 'medium_term', 30)); rows = p.items.filter(x => x && x.id); }
      else if (which === 'recent'){
        const p = page(await sp().recent());
        rows = p.items.map(x => Object.assign(trackOf(x.track), { added: x.added, context: x.context })).filter(x => x && x.id);
        contexts(rows);
      }
      lib = Object.assign({}, lib, { [which]: (off ? lib[which] : []).concat(rows) });
      more = Object.assign({}, more, { [which]: next });
      libErr = null;
    } catch (e){ libErr = e; }
    loading = '';
  }
  // Jump back in: the playlists, albums and artists you played from lately, named once and kept on the phone
  async function contexts(rows){
    const seen = [], known = store.getJ(CTX, {});
    rows.forEach(r => { const c = r.context; if (c && /^(playlist|album|artist)$/.test(c.type) && seen.indexOf(c.uri) < 0) seen.push(c.uri); });
    const out = [];
    for (const uri of seen.slice(0, 8)){
      const [, type, id] = uri.split(':');
      if (!known[uri]){
        try {
          const j = type === 'playlist' ? await sp().playlist(id) : type === 'album' ? await sp().album(id) : await sp().artist(id);
          known[uri] = { name: j.name, images: (j.images || []).slice(-2), sub: type === 'album' ? (j.artists || []).map(a => a.name).join(', ') : type === 'artist' ? 'Artist' : 'Playlist' };
        } catch (e){ continue; }
      }
      out.push(Object.assign({ uri, type, id }, known[uri]));
    }
    store.setJ(CTX, known);
    lib = Object.assign({}, lib, { jump: out });
  }
  let libFor = '';
  $effect(() => {
    const acc = music.acc, r = route;
    if (!acc) return;
    untrack(() => {
      if (libFor !== acc.id){ libFor = acc.id; lib = {}; more = {}; libErr = null; }     // someone else listening: their music
      if (r.kind === '') ['recent', 'playlists', 'artists', 'albums'].forEach(w => load(w));
      if (r.kind === 'list') load(r.id === 'shelf' ? 'albums' : r.id);
    });
  });
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const shortcuts = $derived.by(() => {
    const out = [{ href: '#liked', title: 'Liked songs', liked: true }];
    (lib.jump || []).forEach(c => out.push({ href: `#${c.type}/${c.id}`, title: c.name, images: c.images, round: c.type === 'artist' }));
    (lib.playlists || []).forEach(p => { if (!out.some(o => o.href === `#playlist/${p.id}`)) out.push({ href: `#playlist/${p.id}`, title: p.name, images: p.images }); });
    return out.slice(0, 8);
  });
  const ago = t => { const mins = Math.round((Date.now() - Date.parse(t)) / 60e3); return mins < 60 ? mins + ' min ago' : mins < 1440 ? Math.round(mins / 60) + ' h ago' : Math.round(mins / 1440) + ' d ago'; };

  /* ---------- search, leading with the best match ---------- */
  let q = $state(''), res = $state.raw(null), searching = $state(false), sTimer = 0;
  let recentQ = $state(store.getJ('musicSearches', []));
  function onSearch(){
    clearTimeout(sTimer);
    const text = q.trim();
    if (!text){ res = null; return; }
    sTimer = setTimeout(async () => {
      searching = true;
      try {
        const j = await sp().search(text);
        if (q.trim() !== text) return;
        const r = { tracks: page(j, 'tracks').items.filter(Boolean).map(trackOf), artists: page(j, 'artists').items.filter(Boolean), albums: page(j, 'albums').items.filter(Boolean), playlists: page(j, 'playlists').items.filter(Boolean) };
        const a = r.artists[0], low = text.toLowerCase();
        r.top = a && a.name.toLowerCase().indexOf(low) === 0 ? { kind: 'artist', item: a } : r.tracks[0] ? { kind: 'track', item: r.tracks[0] } : a ? { kind: 'artist', item: a } : null;
        res = r;
        recentQ = [text].concat(recentQ.filter(x => x.toLowerCase() !== low)).slice(0, 6); store.setJ('musicSearches', recentQ);
      } catch (e){ res = { err: e }; }
      searching = false;
    }, 320);
  }
  const ask = text => { q = text; onSearch(); };

  /* ---------- a playlist, album or artist, lit by its own cover ---------- */
  let detail = $state.raw(null), dErr = $state.raw(null), dTint = $state.raw(null), aStory = $state.raw(null), bioMore = $state(false);
  $effect(() => { const r = route, acc = music.acc; untrack(() => { if (acc && r.kind && !/^(list|listening|gigs)$/.test(r.kind)) openDetail(r); else { detail = null; dTint = null; } }); });
  async function openDetail(r){
    detail = null; dErr = null; dTint = null; aStory = null; bioMore = false;
    try {
      if (r.kind === 'playlist'){
        const p = await sp().playlist(r.id);
        const rows = page(await sp().playlistTracks(r.id)).items.map(x => x.track ? trackOf(x.track) : null).filter(x => x && x.id);
        detail = { kind: 'playlist', uri: p.uri, title: p.name, by: (p.owner && p.owner.display_name) || '', images: p.images || [], about: (p.description || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'), tracks: rows };
      } else if (r.kind === 'album'){
        const a = await sp().album(r.id);
        const rows = page(a.tracks).items.map(t => trackOf(Object.assign({}, t, { album: a }))).filter(Boolean);
        detail = { kind: 'album', uri: a.uri, title: a.name, by: (a.artists || []).map(x => x.name).join(', '), byId: a.artists && a.artists[0] ? a.artists[0].id : '', year: String(a.release_date || '').slice(0, 4), images: a.images || [], tracks: rows, numbered: true };
      } else {
        const [a, top, al] = await Promise.all([sp().artist(r.id), sp().artistTop(r.id), sp().artistAlbums(r.id)]);
        detail = { kind: 'artist', uri: a.uri, title: a.name, by: (a.genres || []).slice(0, 3).join(' · '), images: a.images || [], round: true, followers: a.followers ? a.followers.total : null,
          tracks: ((top && top.tracks) || []).map(trackOf).filter(Boolean).slice(0, 10), albums: page(al).items.filter(Boolean) };
      }
      colourOf(artUrl(detail.images, 300)).then(c => { dTint = c; });
      if (detail.kind === 'artist') loadArtistStory(r.id, detail.title);
    } catch (e){ dErr = e; }
  }
  async function loadArtistStory(id, name){
    const key = 'artist:' + id;
    let s = null;
    try { const c = await cacheGet(key, 30 * 24 * 3600e3); if (c) s = c.value; } catch (e){}
    if (!s){ s = (await artistStory(name)) || { none: true }; cacheSet(key, s); }
    if (route.kind === 'artist' && route.id === id) aStory = s;
  }
  const total = d => { const ms = d.tracks.reduce((s, t) => s + t.dur, 0), m = Math.round(ms / 60e3); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
  const playIn = (d, t) => { haptic(); return d.kind === 'artist' ? play({ uris: d.tracks.map(x => x.uri), offset: t ? d.tracks.indexOf(t) : 0 }) : play({ context: d.uri, offset: t ? t.uri : 0 }); };
  async function shuffleIn(d){ if (music.player && !music.player.shuffle) await setShuffle(); playIn(d, d.tracks[Math.floor(Math.random() * d.tracks.length)]); }
  const playList = (list, i) => { haptic(); return play({ uris: list.slice(i, i + 100).map(x => x.uri) }); };
  const isPlayingFrom = d => music.player && music.player.context && d && music.player.context.uri === d.uri;
  const connect = () => beginSignIn(clientId, location.href).catch(() => { location.href = './settings.html#music'; });
  const youLine = $derived.by(() => { const top = topArtists(disc.log || [], Date.now() - 30 * 864e5, 1)[0]; return top ? 'Mostly ' + top.name + ' this month' : 'Your top artists and songs'; });
  const LISTS = { liked: 'Liked songs', recent: 'Recently played', playlists: 'Your playlists', albums: 'Your albums', artists: 'Your top artists', shelf: 'Your record shelf' };
</script>

{#if !music.acc}
  <section class="card welcome">
    <div class="orbit" aria-hidden="true"><span class="planet"><Icon name="music" size={34} /></span><i></i><i></i></div>
    <h2 class="label">Music</h2>
    <p class="big">Your Spotify, in the house's own player</p>
    <p class="note">Play, pause and skip on the TV, the Google speakers or your phone from any page. Lyrics in time with the song, the stories behind it, and every playlist and album you've saved. Playing from here needs Spotify Premium.</p>
    {#if clientId}<div class="actions"><button class="btn primary" type="button" onclick={connect}>Connect Spotify</button></div>
    {:else}<p class="note">First, add the household's Spotify Client ID <a href="./settings.html#music">in Settings</a>.</p>{/if}
  </section>

{:else if route.kind === 'list'}
  <a class="back" href="./music.html" onclick={back}><Icon name="back" size={16} />Music</a>
  <section class="card">
    <div class="card-head"><h2 class="label">{LISTS[route.id]}{route.id === 'liked' && lib.liked ? ' · ' + lib.liked.length + (more.liked ? '+' : '') : ''}</h2>
      {#if route.id === 'liked' && lib.liked && lib.liked.length}<button class="link" type="button" onclick={() => playList(lib.liked, 0)}>Play all</button>{/if}</div>
    {#if libErr}<p class="note">{spotifyErrorText(libErr).join(' ')}</p>{/if}
    {#if route.id === 'shelf'}
      {#if lib.albums && lib.albums.length}<Shelf albums={lib.albums} />{:else if lib.albums}<p class="note">No saved albums yet. Save some in Spotify and they'll be here to flip through.</p>{:else}<div class="skel" style="height:300px"></div>{/if}
    {:else if !lib[route.id]}<div class="skel" style="height:260px"></div>
    {:else if route.id === 'playlists' || route.id === 'albums' || route.id === 'artists'}
      <div class="grid">
        {#each lib[route.id] as x (x.id)}
          <Tile images={x.images} title={x.name} round={route.id === 'artists'} sub={route.id === 'albums' ? (x.artists || []).map(a => a.name).join(', ') : route.id === 'playlists' ? ((x.tracks || x.items) && (x.tracks || x.items).total != null ? (x.tracks || x.items).total + ' songs' : '') : ''} href="#{route.id.slice(0, -1)}/{x.id}" />
        {/each}
      </div>
    {:else}
      <ul class="list">
        {#each lib[route.id] as t, i (t.id + i)}
          {#if route.id === 'recent' && (i === 0 || ago(lib.recent[i - 1].added) !== ago(t.added))}<li class="when label">{ago(t.added)}</li>{/if}
          <TrackRow {t} onplay={() => route.id === 'liked' ? playList(lib.liked, i) : play({ uris: [t.uri] })} />
        {/each}
      </ul>
    {/if}
    {#if route.id !== 'shelf' && lib[route.id] && !lib[route.id].length}<p class="note">{route.id === 'liked' ? 'No liked songs yet. Tap the heart in the player, or double-tap a cover.' : 'Nothing here yet.'}</p>{/if}
    {#if more[route.id]}<div class="actions"><button class="btn" type="button" disabled={loading === route.id} onclick={() => load(route.id, true)}>{loading === route.id ? 'Loading…' : 'Show more'}</button></div>{/if}
  </section>

{:else if route.kind === 'listening'}
  <a class="back" href="./music.html" onclick={back}><Icon name="back" size={16} />Music</a>
  <Listening />

{:else if route.kind === 'gigs'}
  <a class="back" href="./music.html" onclick={back}><Icon name="back" size={16} />Music</a>
  <Gigs all />

{:else if route.kind}
  <a class="back" href="./music.html" onclick={back}><Icon name="back" size={16} />Music</a>
  {#if detail}
    <section class="detail">
      <div class="dsky" aria-hidden="true">{#if detail.images.length}<img src={artUrl(detail.images, 300)} alt="">{/if}</div>
      <header class="dhead" class:round={detail.round}>
        {#if detail.images.length}<img class="dcover" src={artUrl(detail.images, 640)} alt="">{:else}<span class="dcover ph"><Icon name="music" size={48} /></span>{/if}
        <div class="dt answer">
          <span class="label">{detail.kind === 'playlist' ? 'Playlist' : detail.kind === 'album' ? 'Album' : 'Artist'}</span>
          <h2 class="big">{detail.title}</h2>
          {#if detail.by || detail.year}<p class="dmeta">{#if detail.byId}<a href="#artist/{detail.byId}">{detail.by}</a>{:else if detail.by}{detail.by}{/if}{#if detail.year}{(detail.by ? ' · ' : '') + detail.year}{/if}</p>{/if}
          {#if (detail.tracks.length && detail.kind !== 'artist') || detail.followers}<p class="dfig mono">{#if detail.kind !== 'artist'}{detail.tracks.length + ' songs · ' + total(detail)}{:else}{detail.followers.toLocaleString('en-GB') + ' followers'}{/if}</p>{/if}
          {#if detail.tracks.length}
            <div class="actions">
              <button class="playbig" type="button" aria-label="{isPlayingFrom(detail) && music.player.playing ? 'Pause' : 'Play'} {detail.title}" onclick={() => { if (isPlayingFrom(detail)){ haptic(); toggle(); } else playIn(detail, null); }}><Icon name={isPlayingFrom(detail) && music.player.playing ? 'pause' : 'play'} size={26} /></button>
              <button class="icon-btn" type="button" aria-label="Shuffle {detail.title}" onclick={() => shuffleIn(detail)}><Icon name="shuffle" size={20} /></button>
            </div>
          {/if}
        </div>
      </header>
    </section>
    {#if detail.kind === 'artist' && aStory && !aStory.none}
      <section class="card bio">
        <h2 class="label">About</h2>
        {#if aStory.badge}<div class="badge"><Icon name="pin" size={18} /><span>{aStory.badge.text}</span></div>{/if}
        {#if aStory.home && (aStory.home.from || aStory.home.formed)}{@const from = aStory.home.from && !aStory.badge ? 'From ' + aStory.home.from : ''}<p class="home">{from}{aStory.home.formed ? (from ? ' · ' : '') + (aStory.home.group ? 'Formed ' : 'Born ') + aStory.home.formed : ''}{aStory.home.ended ? ' · until ' + aStory.home.ended : ''}</p>{/if}
        {#if aStory.bio}<p class="btext" class:clamp={!bioMore}>{aStory.bio.text}</p>
          <div class="actions">{#if !bioMore && aStory.bio.text.length > 300}<button type="button" class="btn small" onclick={() => { bioMore = true; }}>Read more</button>{/if}{#if aStory.bio.url}<a class="btn small" href={aStory.bio.url} target="_blank" rel="noopener">From Wikipedia</a>{/if}</div>{/if}
      </section>
    {/if}
    {#if detail.about}<p class="note about">{detail.about}</p>{/if}
    <section class="card">
      <h2 class="label">{detail.kind === 'artist' ? 'Popular' : 'Songs'}</h2>
      <ul class="list">{#each detail.tracks as t, i (t.id + i)}<TrackRow {t} num={detail.numbered || detail.kind === 'artist' ? i + 1 : null} onplay={() => playIn(detail, t)} />{/each}</ul>
      {#if !detail.tracks.length}<p class="note">{detail.kind === 'playlist' ? 'Spotify didn\'t share this playlist\'s songs. It may be one Spotify makes, which other apps can\'t open: play it from the Spotify app and it\'ll show here.' : 'No songs.'}</p>{/if}
    </section>
    {#if detail.albums && detail.albums.length}
      <Row title="Albums and singles">{#each detail.albums as a (a.id)}<Tile images={a.images} title={a.name} sub={String(a.release_date || '').slice(0, 4) + (a.album_type === 'single' ? ' · Single' : '')} href="#album/{a.id}" />{/each}</Row>
    {/if}
    {#if detail.kind === 'artist'}<FansAlso name={detail ? detail.title : ''} />{/if}
  {:else if dErr}<p class="note">{spotifyErrorText(dErr).join(' ')}</p>
  {:else}<div class="skel" style="height:300px"></div>{/if}

{:else}
  <People />
  <button class="answer now-answer" type="button" onclick={() => music.track ? openPlayer() : null} aria-label={music.track ? 'Open the player' : 'Nothing playing'}>
    <span class="label">{greeting}{music.acc.name ? ', ' + music.acc.name.split(' ')[0] : ''}{music.player && music.player.device ? ' · ' + (music.player.playing ? 'Playing on ' : 'Paused on ') + music.player.device.name : ''}</span>
    {#if music.track}
      <span class="big glow">{music.track.name}</span>
      <span class="line">{music.track.artist}{music.track.album.name ? ' · ' + music.track.album.name : ''}</span>
    {:else}
      <span class="big">Nothing playing</span>
      <span class="line muted">Pick something below, or play on any Spotify device.</span>
    {/if}
  </button>

  <label class="sbox"><Icon name="search" size={20} /><span class="sr">Search Spotify</span>
    <input type="search" placeholder="Songs, artists, albums, playlists" bind:value={q} oninput={onSearch} autocomplete="off" enterkeyhint="search">
    {#if q}<button class="clear" type="button" aria-label="Clear the search" onclick={() => { q = ''; res = null; }}>×</button>{/if}</label>

  {#if q.trim()}
    {#if res && res.err}<p class="note">{spotifyErrorText(res.err).join(' ')}</p>
    {:else if res}
      {#if res.top}
        <section class="card topres">
          <h2 class="label">Top result</h2>
          {#if res.top.kind === 'artist'}
            <a class="topcard" href="#artist/{res.top.item.id}"><img class="round" src={artUrl(res.top.item.images, 300)} alt=""><span class="tt"><b>{res.top.item.name}</b><span class="tag">Artist</span></span></a>
          {:else}
            <div class="topcard"><img src={artUrl(res.top.item.images, 300)} alt=""><span class="tt"><b>{res.top.item.name}</b><span class="tsub">{res.top.item.artist}<span class="tag">Song</span></span></span>
              <button class="playbig small" type="button" aria-label="Play {res.top.item.name}" onclick={() => { haptic(); play({ uris: [res.top.item.uri] }); }}><Icon name="play" size={22} /></button></div>
          {/if}
        </section>
      {/if}
      {#if res.tracks.length}<section class="card"><h2 class="label">Songs</h2><ul class="list">{#each res.tracks.slice(0, 5) as t (t.id)}<TrackRow {t} onplay={() => play({ uris: [t.uri] })} />{/each}</ul></section>{/if}
      {#if res.artists.length}<Row title="Artists">{#each res.artists.slice(0, 10) as a (a.id)}<Tile images={a.images} title={a.name} round href="#artist/{a.id}" />{/each}</Row>{/if}
      {#if res.albums.length}<Row title="Albums">{#each res.albums.slice(0, 10) as a (a.id)}<Tile images={a.images} title={a.name} sub={(a.artists || []).map(x => x.name).join(', ')} href="#album/{a.id}" />{/each}</Row>{/if}
      {#if res.playlists.length}<Row title="Playlists">{#each res.playlists.slice(0, 10) as p (p.id)}<Tile images={p.images} title={p.name} sub={p.owner ? p.owner.display_name : ''} href="#playlist/{p.id}" />{/each}</Row>{/if}
      {#if !res.tracks.length && !res.artists.length && !res.albums.length && !res.playlists.length}<p class="note">Nothing found for "{q.trim()}".</p>{/if}
    {:else}<div class="skel" style="height:220px"></div>{/if}
  {:else}
    {#if recentQ.length}<div class="chips" aria-label="Recent searches">{#each recentQ as r}<button type="button" class="btn small" onclick={() => ask(r)}>{r}</button>{/each}</div>{/if}
    {#if libErr}<p class="note">{spotifyErrorText(libErr).join(' ')}</p>{/if}

    <section class="card">
      <h2 class="label">Quick play</h2>
      <div class="shortcuts">
        {#each shortcuts as s (s.href)}
          <a class="sc" href={s.href}>
            {#if s.liked}<span class="liked"><Icon name="heart" size={20} /></span>{:else if s.images && s.images.length}<img class:round={s.round} src={artUrl(s.images, 64)} alt="">{:else}<span class="liked"><Icon name="music" size={20} /></span>{/if}
            <b>{s.title}</b>
          </a>
        {/each}
      </div>
    </section>

    <Radio />
    {#if lib.jump && lib.jump.length}
      <Row title="Jump back in">{#each lib.jump as c (c.uri)}<Tile images={c.images} title={c.name} sub={c.sub} round={c.type === 'artist'} href="#{c.type}/{c.id}" />{/each}</Row>
    {/if}
    {#if lib.playlists}<Row title="Your playlists" all="#playlists">{#each lib.playlists.slice(0, 12) as p (p.id)}<Tile images={p.images} title={p.name} sub={(p.tracks || p.items) && (p.tracks || p.items).total != null ? (p.tracks || p.items).total + ' songs' : ''} href="#playlist/{p.id}" />{/each}</Row>
    {:else}<div class="skel" style="height:200px"></div>{/if}
    <NewReleases />
    {#if lib.artists && lib.artists.length}<Row title="Your top artists" all="#artists">{#each lib.artists.slice(0, 12) as a (a.id)}<Tile images={a.images} title={a.name} round href="#artist/{a.id}" />{/each}</Row>{/if}
    {#if lib.albums && lib.albums.length}<Row title="Your albums" all="#albums" alt={{ href: '#shelf', label: 'Shelf' }}>{#each lib.albums.slice(0, 12) as a (a.id)}<Tile images={a.images} title={a.name} sub={(a.artists || []).map(x => x.name).join(', ')} href="#album/{a.id}" />{/each}</Row>{/if}
    {#if lib.recent && lib.recent.length}
      <section class="card recent">
        <div class="card-head"><h2 class="label">Played lately</h2><a href="#recent">Show all</a></div>
        <ul class="list">{#each lib.recent.slice(0, 5) as t, i (t.id + i)}<TrackRow {t} onplay={() => play({ uris: [t.uri] })} />{/each}</ul>
      </section>
    {/if}
    <Gigs />
    <a class="card you" href="#listening">
      <span class="label">Your listening</span>
      <b>{youLine}</b>
      <span class="note">Top artists and songs, when you listen, and every day as a calendar</span>
      <Icon name="chevron" size={20} />
    </a>
  {/if}
{/if}

<style>
  /* the house style: cards, mono labels, Syncopate for the one big answer, cyan for anything you press */
  .welcome{overflow:hidden}
  .welcome .big{font:700 22px/1.25 var(--f-display);letter-spacing:.04em;text-transform:uppercase;max-width:18ch;text-wrap:balance}
  .orbit{position:absolute;right:10px;top:10px;width:96px;height:96px;opacity:.9}
  .planet{position:absolute;left:24px;top:24px;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#04101a;background:radial-gradient(circle at 35% 30%,#bdf3ff,var(--gas) 55%,#1b6c8a);box-shadow:0 0 30px rgba(79,214,255,.45)}
  .orbit i{position:absolute;left:0;top:0;right:0;bottom:0;border:1px solid rgba(79,214,255,.35);border-radius:50%;transform:rotateX(70deg) rotate(20deg);animation:spin 14s linear infinite}
  .orbit i:last-child{left:-14px;top:-14px;right:-14px;bottom:-14px;border-color:rgba(184,146,255,.3);animation-duration:22s;animation-direction:reverse}
  @keyframes spin{to{transform:rotateX(70deg) rotate(380deg)}}

  /* the answer: what's playing */
  .you{text-decoration:none;color:inherit;grid-template-columns:minmax(0,1fr) auto;align-items:center}
  .you > *:not(:global(.ic)){grid-column:1}
  .you :global(.ic){grid-column:2;grid-row:1 / span 3;color:var(--gas)}
  .you b{font-size:17px;font-weight:600}
  .you .note{margin:0}
  .you:hover{border-color:var(--line-hot)}
  .now-answer{appearance:none;border:0;background:none;color:inherit;text-align:left;cursor:pointer;width:100%;font:inherit}
  .now-answer .big{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
  .glow{color:var(--ink);text-shadow:0 0 22px color-mix(in srgb,var(--tint,var(--gas)) 55%,transparent)}

  .sbox{display:flex;align-items:center;gap:10px;padding:0 6px 0 var(--s3);min-height:48px;border-radius:var(--radius-sm);border:1px solid var(--line-hot);background:var(--card-2);color:var(--muted);
    position:sticky;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:5;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
  .sbox:focus-within{border-color:var(--gas)}
  .sbox input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:16px var(--f-body);min-height:46px;outline:none}
  .sbox input::-webkit-search-cancel-button{display:none}
  .clear{appearance:none;border:0;background:var(--sel);color:var(--ink);width:32px;height:32px;border-radius:50%;font:500 18px/1 var(--f-body);cursor:pointer}
  .chips{display:flex;gap:var(--s2);overflow-x:auto;scrollbar-width:none}
  .chips .btn{white-space:nowrap;flex:none}

  .shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s2)}
  @media (min-width:700px){ .shortcuts{grid-template-columns:repeat(4,minmax(0,1fr))} }
  .sc{display:grid;grid-template-columns:48px minmax(0,1fr);align-items:center;gap:10px;min-height:48px;border-radius:var(--radius-sm);overflow:hidden;text-decoration:none;color:var(--ink);
    background:var(--card-2);border:1px solid var(--line);transition:border-color .2s}
  .sc:hover{border-color:var(--line-hot)}
  .sc img,.sc .liked{width:48px;height:48px;object-fit:cover;display:grid;place-items:center}
  .sc img.round{border-radius:50%;width:40px;height:40px;margin-left:4px}
  .sc .liked{background:linear-gradient(135deg,#3b2a8a,var(--neg));color:#fff}
  .sc .liked :global(.ic){fill:currentColor}
  .sc b{font:600 13.5px/1.25 var(--f-body);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-right:8px}

  .list{list-style:none;margin:0;padding:0}
  .list :global(.tr:first-child){border-top:0}
  .when{padding:var(--s3) 0 0;list-style:none}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:var(--s4) var(--s3)}

  .topcard{position:relative;display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:var(--s3);align-items:center;text-decoration:none;color:var(--ink)}
  .topcard img{width:88px;height:88px;object-fit:cover;border-radius:var(--radius-sm)}
  .topcard img.round{border-radius:50%}
  .tt{display:grid;gap:6px;min-width:0}
  .tt b{font:700 18px/1.2 var(--f-display);letter-spacing:.03em;text-transform:uppercase;overflow-wrap:anywhere}
  .tsub{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:14px;flex-wrap:wrap}
  .tsub .tag,.tt > .tag{color:var(--gas);margin-left:0;justify-self:start}

  /* a playlist, album or artist: lit by its own cover */
  .back{display:inline-flex;align-items:center;gap:4px;color:var(--gas);text-decoration:none;font-size:14px;justify-self:start;min-height:32px}
  .detail{position:relative}
  .dsky{position:absolute;left:calc(-1 * var(--s4));right:calc(-1 * var(--s4));top:-90px;height:420px;overflow:hidden;z-index:-1;pointer-events:none;
    mask-image:linear-gradient(#000 30%,transparent);-webkit-mask-image:linear-gradient(#000 30%,transparent)}
  .dsky img{width:100%;height:100%;object-fit:cover;filter:blur(50px) saturate(1.4) brightness(.5);transform:scale(1.4)}
  .dhead{display:grid;justify-items:center;gap:var(--s4);text-align:center}
  .dcover{width:min(58vw,220px);aspect-ratio:1;border-radius:var(--radius);object-fit:cover;box-shadow:0 24px 60px rgba(0,0,0,.55);display:grid;place-items:center;background:var(--card);color:var(--muted)}
  .dhead.round .dcover{border-radius:50%}
  .dt{justify-items:center;padding:0}
  .dt .big{overflow-wrap:anywhere;text-wrap:balance;font-size:24px}
  .dmeta{color:var(--muted);font-size:14px}
  .dfig{font-size:13px;color:var(--muted)}
  .dmeta a{color:var(--ink);font-weight:600;text-decoration:none}
  .dmeta a:hover{text-decoration:underline}
  .dt .actions{justify-content:center;margin-top:var(--s2)}
  @media (min-width:700px){
    .dhead{grid-template-columns:200px minmax(0,1fr);justify-items:start;text-align:left;align-items:end}
    .dcover{width:200px}
    .dt{justify-items:start}
    .dt .actions{justify-content:flex-start}
    .dt .big{font-size:28px}
  }
  .about{margin:0}
  .playbig{appearance:none;border:0;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--gas);color:#04101a;
    box-shadow:0 0 24px rgba(79,214,255,.35);transition:transform .12s,filter .2s}
  .playbig:hover{filter:brightness(1.08)} .playbig:active{transform:scale(.92)}
  .playbig.small{width:46px;height:46px}
  .bio .badge{display:flex;align-items:center;gap:8px;font:600 14.5px var(--f-body);padding:var(--s3);border-radius:var(--radius-sm);background:rgba(79,214,255,.08);border:1px solid rgba(79,214,255,.35)}
  .bio .badge :global(.ic){color:var(--gas);flex:none}
  .home{font:500 14px var(--f-mono);color:var(--ink)}
  .btext{font-size:15px;line-height:1.6;color:rgba(233,236,255,.85)}
  .btext.clamp{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
</style>
