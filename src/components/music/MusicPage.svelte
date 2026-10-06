<script>
  /*
   * The Music tab. Not a list but a place to start: a greeting, shortcuts to what you play most, and rows to scroll
   * (jump back in, your playlists, your top artists, your albums, what you played lately). Search sits on top and
   * leads with its best match. Playlists, albums and artists open in the page (music.html#album/<id>), lit by their
   * own covers, and Back returns. Tap a song to play it where Spotify is playing; + adds it to Up next.
   */
  import { onMount, untrack } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { music, sp, watchMusic, play, setShuffle, colourOf, haptic, toggle } from '../../state/music.svelte.js';
  import { beginSignIn, spotifyErrorText } from '../../lib/spotify.js';
  import { trackOf, page, artUrl, fmtDur } from '../../lib/music.js';
  import { houseSettings } from '../../state/house.js';
  import Icon from './Icon.svelte';
  import TrackRow from './TrackRow.svelte';
  import Tile from './Tile.svelte';
  import Row from './Row.svelte';
  import Shelf from './Shelf.svelte';
  import { artistStory } from '../../lib/musicdata.js';
  import { cacheGet, cacheSet } from '../../state/cache.js';

  /* ---------- where we are: #playlist/<id>, #album/<id>, #artist/<id>, or a whole list (#liked, #recent, #playlists, #albums, #artists) ---------- */
  let route = $state({ kind: '', id: '' }), clientId = $state('');
  const readRoute = () => {
    const h = location.hash.slice(1), m = /^(playlist|album|artist)\/([A-Za-z0-9]+)$/.exec(h);
    route = m ? { kind: m[1], id: m[2] } : /^(liked|recent|playlists|albums|artists|shelf)$/.test(h) ? { kind: 'list', id: h } : { kind: '', id: '' };
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
  $effect(() => {
    const acc = music.acc, r = route;
    if (!acc) return;
    untrack(() => {
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
  $effect(() => { const r = route, acc = music.acc; untrack(() => { if (acc && r.kind && r.kind !== 'list') openDetail(r); else { detail = null; dTint = null; } }); });
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
  const LISTS = { liked: 'Liked songs', recent: 'Recently played', playlists: 'Your playlists', albums: 'Your albums', artists: 'Your top artists', shelf: 'Your record shelf' };
</script>

{#if !music.acc}
  <section class="welcome">
    <div class="orbit" aria-hidden="true"><span class="planet"><Icon name="music" size={38} /></span><i></i><i></i></div>
    <span class="label">Music</span>
    <h2>Your Spotify, in the house's own player.</h2>
    <p class="note">Play, pause and skip on the TV, the Google speakers or your phone from any page. Lyrics in time with the song, the colours of the cover, and every playlist and album you've saved. Playing from here needs Spotify Premium.</p>
    {#if clientId}<button class="btn primary big" type="button" onclick={connect}>Connect Spotify</button>
    {:else}<p class="note">First, add the household's Spotify Client ID <a href="./settings.html#music">in Settings</a>.</p>{/if}
  </section>

{:else if route.kind === 'list'}
  <section class="list-page">
    <a class="back" href="./music.html" onclick={back}><Icon name="back" size={18} />Music</a>
    <h2 class="ptitle">{LISTS[route.id]}</h2>
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
      {#if route.id === 'liked' && lib.liked.length}<div class="actions"><button class="playbig" type="button" aria-label="Play your liked songs" onclick={() => playList(lib.liked, 0)}><Icon name="play" size={26} /></button><span class="note">{lib.liked.length}{more.liked ? '+' : ''} songs</span></div>{/if}
      <ul class="list">
        {#each lib[route.id] as t, i (t.id + i)}
          {#if route.id === 'recent' && (i === 0 || ago(lib.recent[i - 1].added) !== ago(t.added))}<li class="when mono">{ago(t.added)}</li>{/if}
          <TrackRow {t} onplay={() => route.id === 'liked' ? playList(lib.liked, i) : play({ uris: [t.uri] })} />
        {/each}
      </ul>
    {/if}
    {#if route.id !== 'shelf' && lib[route.id] && !lib[route.id].length}<p class="note">{route.id === 'liked' ? 'No liked songs yet. Tap the heart in the player, or double-tap a cover.' : 'Nothing here yet.'}</p>{/if}
    {#if more[route.id]}<div class="actions"><button class="btn" type="button" disabled={loading === route.id} onclick={() => load(route.id, true)}>{loading === route.id ? 'Loading…' : 'Show more'}</button></div>{/if}
  </section>

{:else if route.kind}
  <section class="detail" style={dTint ? `--dt:${dTint.main};--dt-ink:${dTint.ink};--dt-deep:${dTint.deep}` : ''}>
    {#if detail}
      <div class="dsky" aria-hidden="true">{#if detail.images.length}<img src={artUrl(detail.images, 300)} alt="">{/if}</div>
      <a class="back" href="./music.html" onclick={back}><Icon name="back" size={18} />Music</a>
      <header class="dhead" class:round={detail.round}>
        {#if detail.images.length}<img class="dcover" src={artUrl(detail.images, 640)} alt="">{:else}<span class="dcover ph"><Icon name="music" size={48} /></span>{/if}
        <div class="dt">
          <span class="label">{detail.kind === 'playlist' ? 'Playlist' : detail.kind === 'album' ? 'Album' : 'Artist'}</span>
          <h2>{detail.title}</h2>
          <p class="dmeta">{#if detail.byId}<a href="#artist/{detail.byId}">{detail.by}</a>{:else if detail.by}{detail.by}{/if}{#if detail.year}{' · ' + detail.year}{/if}{#if detail.tracks.length && detail.kind !== 'artist'}{' · ' + detail.tracks.length + ' songs, ' + total(detail)}{/if}{#if detail.followers}{' · ' + detail.followers.toLocaleString('en-GB') + ' followers'}{/if}</p>
        </div>
      </header>
      {#if detail.tracks.length}
        <div class="actions">
          <button class="playbig" type="button" aria-label="{isPlayingFrom(detail) && music.player.playing ? 'Pause' : 'Play'} {detail.title}" onclick={() => { if (isPlayingFrom(detail)){ haptic(); toggle(); } else playIn(detail, null); }}><Icon name={isPlayingFrom(detail) && music.player.playing ? 'pause' : 'play'} size={28} /></button>
          <button class="ghost" type="button" aria-label="Shuffle {detail.title}" onclick={() => shuffleIn(detail)}><Icon name="shuffle" size={24} /></button>
        </div>
      {/if}
      {#if detail.about}<p class="note about">{detail.about}</p>{/if}
      {#if detail.kind === 'artist' && aStory && !aStory.none}
        <section class="bio">
          {#if aStory.badge}<div class="badge"><Icon name="pin" size={18} /><span>{aStory.badge.text}</span></div>{/if}
          {#if aStory.home && (aStory.home.from || aStory.home.formed)}{@const from = aStory.home.from && !aStory.badge ? 'From ' + aStory.home.from : ''}<p class="home">{from}{aStory.home.formed ? (from ? ' · ' : '') + (aStory.home.group ? 'Formed ' : 'Born ') + aStory.home.formed : ''}{aStory.home.ended ? ' · until ' + aStory.home.ended : ''}</p>{/if}
          {#if aStory.bio}<p class="btext" class:clamp={!bioMore}>{aStory.bio.text}</p>
            <div class="blinks">{#if !bioMore && aStory.bio.text.length > 300}<button type="button" class="link" onclick={() => { bioMore = true; }}>Read more</button>{/if}{#if aStory.bio.url}<a href={aStory.bio.url} target="_blank" rel="noopener">From Wikipedia</a>{/if}</div>{/if}
        </section>
      {/if}
      {#if detail.kind === 'artist'}<h3 class="sec">Popular</h3>{/if}
      <ul class="list">{#each detail.tracks as t, i (t.id + i)}<TrackRow {t} num={detail.numbered || detail.kind === 'artist' ? i + 1 : null} onplay={() => playIn(detail, t)} />{/each}</ul>
      {#if !detail.tracks.length}<p class="note">{detail.kind === 'playlist' ? 'Spotify didn\'t share this playlist\'s songs. It may be one Spotify makes, which other apps can\'t open: play it from the Spotify app and it\'ll show here.' : 'No songs.'}</p>{/if}
      {#if detail.albums && detail.albums.length}
        <Row title="Albums and singles">{#each detail.albums as a (a.id)}<Tile images={a.images} title={a.name} sub={String(a.release_date || '').slice(0, 4) + (a.album_type === 'single' ? ' · Single' : '')} href="#album/{a.id}" />{/each}</Row>
      {/if}
    {:else if dErr}<a class="back" href="./music.html" onclick={back}><Icon name="back" size={18} />Music</a><p class="note">{spotifyErrorText(dErr).join(' ')}</p>
    {:else}<div class="skel" style="height:300px"></div>{/if}
  </section>

{:else}
  <section class="hello">
    <h2>{greeting}{music.acc.name ? ', ' + music.acc.name.split(' ')[0] : ''}</h2>
    <label class="sbox"><Icon name="search" size={20} /><span class="sr">Search Spotify</span>
      <input type="search" placeholder="What do you want to hear?" bind:value={q} oninput={onSearch} autocomplete="off" enterkeyhint="search">
      {#if q}<button class="clear" type="button" aria-label="Clear the search" onclick={() => { q = ''; res = null; }}>×</button>{/if}</label>
  </section>

  {#if q.trim()}
    {#if res && res.err}<p class="note">{spotifyErrorText(res.err).join(' ')}</p>
    {:else if res}
      {#if res.top}
        <div class="topres">
          <h3 class="sec">Top result</h3>
          {#if res.top.kind === 'artist'}
            <a class="topcard" href="#artist/{res.top.item.id}"><img class="round" src={artUrl(res.top.item.images, 300)} alt=""><b>{res.top.item.name}</b><span class="chip">Artist</span></a>
          {:else}
            <div class="topcard"><img src={artUrl(res.top.item.images, 300)} alt=""><b>{res.top.item.name}</b><span class="tsub">{res.top.item.artist}<span class="chip">Song</span></span>
              <button class="playbig small" type="button" aria-label="Play {res.top.item.name}" onclick={() => { haptic(); play({ uris: [res.top.item.uri] }); }}><Icon name="play" size={22} /></button></div>
          {/if}
        </div>
      {/if}
      {#if res.tracks.length}<h3 class="sec">Songs</h3><ul class="list">{#each res.tracks.slice(0, 5) as t (t.id)}<TrackRow {t} onplay={() => play({ uris: [t.uri] })} />{/each}</ul>{/if}
      {#if res.artists.length}<Row title="Artists">{#each res.artists.slice(0, 10) as a (a.id)}<Tile images={a.images} title={a.name} round href="#artist/{a.id}" />{/each}</Row>{/if}
      {#if res.albums.length}<Row title="Albums">{#each res.albums.slice(0, 10) as a (a.id)}<Tile images={a.images} title={a.name} sub={(a.artists || []).map(x => x.name).join(', ')} href="#album/{a.id}" />{/each}</Row>{/if}
      {#if res.playlists.length}<Row title="Playlists">{#each res.playlists.slice(0, 10) as p (p.id)}<Tile images={p.images} title={p.name} sub={p.owner ? p.owner.display_name : ''} href="#playlist/{p.id}" />{/each}</Row>{/if}
      {#if !res.tracks.length && !res.artists.length && !res.albums.length && !res.playlists.length}<p class="note">Nothing found for "{q.trim()}".</p>{/if}
    {:else}<div class="skel" style="height:220px"></div>{/if}
  {:else}
    {#if recentQ.length}<div class="chips" aria-label="Recent searches">{#each recentQ as r}<button type="button" class="qchip" onclick={() => ask(r)}>{r}</button>{/each}</div>{/if}
    {#if libErr}<p class="note">{spotifyErrorText(libErr).join(' ')}</p>{/if}

    <div class="shortcuts">
      {#each shortcuts as s (s.href)}
        <a class="sc" href={s.href}>
          {#if s.liked}<span class="liked"><Icon name="heart" size={20} /></span>{:else if s.images && s.images.length}<img class:round={s.round} src={artUrl(s.images, 64)} alt="">{:else}<span class="liked"><Icon name="music" size={20} /></span>{/if}
          <b>{s.title}</b>
        </a>
      {/each}
    </div>

    {#if lib.jump && lib.jump.length}
      <Row title="Jump back in">{#each lib.jump as c (c.uri)}<Tile images={c.images} title={c.name} sub={c.sub} round={c.type === 'artist'} href="#{c.type}/{c.id}" />{/each}</Row>
    {/if}
    {#if lib.playlists}<Row title="Your playlists" all="#playlists">{#each lib.playlists.slice(0, 12) as p (p.id)}<Tile images={p.images} title={p.name} sub={(p.tracks || p.items) && (p.tracks || p.items).total != null ? (p.tracks || p.items).total + ' songs' : ''} href="#playlist/{p.id}" />{/each}</Row>
    {:else}<div class="skel" style="height:200px"></div>{/if}
    {#if lib.artists && lib.artists.length}<Row title="Your top artists" all="#artists">{#each lib.artists.slice(0, 12) as a (a.id)}<Tile images={a.images} title={a.name} round href="#artist/{a.id}" />{/each}</Row>{/if}
    {#if lib.albums && lib.albums.length}<Row title="Your albums" all="#albums" alt={{ href: '#shelf', label: 'Shelf' }}>{#each lib.albums.slice(0, 12) as a (a.id)}<Tile images={a.images} title={a.name} sub={(a.artists || []).map(x => x.name).join(', ')} href="#album/{a.id}" />{/each}</Row>{/if}
    {#if lib.recent && lib.recent.length}
      <section class="recent">
        <header><h3>Played lately</h3><a href="#recent">Show all</a></header>
        <ul class="list">{#each lib.recent.slice(0, 5) as t, i (t.id + i)}<TrackRow {t} onplay={() => play({ uris: [t.uri] })} />{/each}</ul>
      </section>
    {/if}
  {/if}
{/if}

<style>
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .note a{color:var(--gas)}
  /* not connected: a planet with two orbits */
  .welcome{display:grid;gap:14px;justify-items:start;padding:28px 4px 8px;position:relative}
  .welcome h2{font:800 30px/1.12 var(--f-body);letter-spacing:-.02em;margin:0;max-width:16ch;text-wrap:balance}
  .welcome .note{max-width:46ch;font-size:15px}
  .orbit{position:relative;width:120px;height:120px;margin-bottom:6px}
  .planet{position:absolute;left:30px;top:30px;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;color:#04101a;background:radial-gradient(circle at 35% 30%,#bdf3ff,var(--gas) 55%,#1b6c8a);box-shadow:0 0 40px rgba(79,214,255,.45)}
  .orbit i{position:absolute;left:0;top:0;right:0;bottom:0;border:1px solid rgba(79,214,255,.35);border-radius:50%;transform:rotateX(70deg) rotate(20deg);animation:spin 14s linear infinite}
  .orbit i:last-child{left:-16px;top:-16px;right:-16px;bottom:-16px;border-color:rgba(184,146,255,.3);animation-duration:22s;animation-direction:reverse}
  @keyframes spin{to{transform:rotateX(70deg) rotate(380deg)}}
  @media (prefers-reduced-motion:reduce){ .orbit i{animation:none} }
  .btn.big{min-height:52px;padding:0 26px;font-size:16px;border-radius:999px}

  /* the start page */
  .hello{display:grid;gap:14px;position:sticky;top:calc(env(safe-area-inset-top,0px) + 4px);z-index:5;padding:4px 0 6px;background:linear-gradient(var(--void) 70%,transparent)}
  .hello h2{font:800 26px/1.15 var(--f-body);letter-spacing:-.02em;margin:0}
  .sbox{display:flex;align-items:center;gap:10px;padding:0 8px 0 16px;min-height:52px;border-radius:999px;border:1px solid var(--line-hot);background:rgba(233,236,255,.07);color:var(--muted);transition:border-color .2s,background .2s}
  .sbox:focus-within{border-color:var(--tint,var(--gas));background:rgba(233,236,255,.1)}
  .sbox input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:500 16px var(--f-body);min-height:50px;outline:none}
  .sbox input::-webkit-search-cancel-button{display:none}
  .clear{appearance:none;border:0;background:rgba(255,255,255,.1);color:var(--ink);width:30px;height:30px;border-radius:50%;font:600 18px/1 var(--f-body);cursor:pointer}
  .chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
  .qchip{appearance:none;border:1px solid var(--line-hot);background:transparent;color:var(--muted);font:500 13px var(--f-body);border-radius:999px;padding:7px 12px;white-space:nowrap;cursor:pointer}
  .qchip:hover{color:var(--ink)}
  .shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  @media (min-width:700px){ .shortcuts{grid-template-columns:repeat(4,minmax(0,1fr))} }
  .sc{display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:10px;min-height:52px;border-radius:10px;overflow:hidden;text-decoration:none;color:var(--ink);
    background:rgba(233,236,255,.07);border:1px solid rgba(255,255,255,.05);transition:background .2s,transform .12s}
  .sc:hover{background:rgba(233,236,255,.12)}
  .sc:active{transform:scale(.98)}
  .sc img,.sc .liked{width:52px;height:52px;object-fit:cover;display:grid;place-items:center}
  .sc img.round{border-radius:50%;width:44px;height:44px;margin-left:4px}
  .sc .liked{background:linear-gradient(135deg,#5b3cc4,#b892ff 60%,#e7c6ff);color:#fff}
  .sc .liked :global(.ic){fill:currentColor}
  .sc b{font:700 13.5px/1.25 var(--f-body);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-right:8px}
  .recent{display:grid;gap:6px}
  .recent header{display:flex;justify-content:space-between;align-items:baseline}
  .recent h3,.sec{margin:6px 0 0;font:700 19px/1.2 var(--f-body);letter-spacing:-.01em}
  .recent a{font:600 13px var(--f-body);color:var(--muted);text-decoration:none}
  .list{list-style:none;margin:0;padding:0}
  .list :global(.tr:first-child){border-top:0}
  .when{font-size:11.5px;color:var(--faint);padding:12px 0 2px;list-style:none}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:18px 14px}

  /* search's best match */
  .topres{display:grid;gap:10px}
  .topcard{position:relative;display:grid;gap:10px;justify-items:start;padding:18px;border-radius:16px;background:rgba(233,236,255,.07);border:1px solid rgba(255,255,255,.06);text-decoration:none;color:var(--ink)}
  .topcard img{width:96px;height:96px;object-fit:cover;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .topcard img.round{border-radius:50%}
  .topcard b{font:800 26px/1.15 var(--f-body);letter-spacing:-.01em}
  .tsub{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:14px}
  .chip{font:600 11px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;padding:5px 8px;border-radius:999px;background:rgba(4,5,13,.6);color:var(--ink)}
  .topcard .playbig{position:absolute;right:16px;bottom:16px}

  /* a playlist, album or artist page */
  .detail,.list-page{display:grid;gap:16px;position:relative}
  .dsky{position:absolute;left:calc(-1 * var(--s4));right:calc(-1 * var(--s4));top:calc(-1 * var(--s5));height:420px;overflow:hidden;z-index:-1;pointer-events:none;
    mask-image:linear-gradient(#000 30%,transparent);-webkit-mask-image:linear-gradient(#000 30%,transparent)}
  .dsky img{width:100%;height:100%;object-fit:cover;filter:blur(50px) saturate(1.5) brightness(.6);transform:scale(1.4)}
  .back{display:inline-flex;align-items:center;gap:4px;color:var(--ink);opacity:.8;text-decoration:none;font-size:14px;justify-self:start;min-height:40px}
  .back:hover{opacity:1}
  .dhead{display:grid;justify-items:center;gap:16px;text-align:center}
  .dcover{width:min(62vw,240px);aspect-ratio:1;border-radius:12px;object-fit:cover;box-shadow:0 24px 60px rgba(0,0,0,.55);display:grid;place-items:center;background:var(--card);color:var(--muted)}
  .dhead.round .dcover{border-radius:50%}
  .dt{display:grid;gap:6px;justify-items:center;min-width:0}
  .dt h2,.ptitle{font:800 28px/1.12 var(--f-body);letter-spacing:-.02em;margin:0;overflow-wrap:anywhere;text-wrap:balance}
  .dmeta{margin:0;color:rgba(233,236,255,.75);font-size:14px}
  .dmeta a{color:var(--ink);font-weight:600;text-decoration:none}
  .dmeta a:hover{text-decoration:underline}
  @media (min-width:700px){
    .dhead{grid-template-columns:220px minmax(0,1fr);justify-items:start;text-align:left;align-items:end}
    .dcover{width:220px}
    .dt{justify-items:start}
    .dt h2{font-size:40px}
  }
  .about{margin:0}
  .bio{display:grid;gap:10px;padding:16px;border-radius:16px;background:rgba(233,236,255,.05);border:1px solid rgba(255,255,255,.06)}
  .badge{display:flex;align-items:center;gap:8px;font:700 14.5px var(--f-body);color:#fff;padding:10px 12px;border-radius:12px;
    background:linear-gradient(135deg,color-mix(in srgb,var(--dt,var(--gas)) 35%,transparent),color-mix(in srgb,var(--dt,var(--gas)) 10%,transparent));border:1px solid color-mix(in srgb,var(--dt,var(--gas)) 45%,transparent)}
  .badge :global(.ic){color:var(--dt,var(--gas))}
  .home{margin:0;font:600 14px var(--f-body);color:rgba(233,236,255,.8)}
  .btext{margin:0;font-size:15px;line-height:1.6;color:rgba(233,236,255,.85)}
  .btext.clamp{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
  .blinks{display:flex;gap:16px}
  .blinks a,.link{font:600 13.5px var(--f-body);color:rgba(233,236,255,.7);text-decoration:none;background:none;border:0;padding:4px 0;cursor:pointer}
  .link{color:var(--ink)}
  .actions{display:flex;align-items:center;gap:12px}
  .playbig{appearance:none;border:0;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--dt,var(--tint,var(--gas)));color:var(--dt-ink,var(--tint-ink,#04101a));
    box-shadow:0 10px 30px color-mix(in srgb,var(--dt,var(--tint,var(--gas))) 40%,transparent);transition:transform .12s,filter .2s}
  .playbig:hover{filter:brightness(1.08)} .playbig:active{transform:scale(.92)}
  .playbig.small{width:48px;height:48px}
  .ghost{appearance:none;border:0;background:transparent;color:rgba(233,236,255,.75);width:46px;height:46px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
  .ghost:hover{color:var(--ink);background:rgba(255,255,255,.07)}
</style>
