<script>
  /*
   * The Music tab: search, then your library (playlists, liked songs, albums, what you played lately). A playlist,
   * album or artist opens in the page (music.html#album/<id>), so Back returns to the list. Tap a song to play it
   * where Spotify is playing; + adds it to Up next.
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { music, sp, watchMusic, play } from '../../state/music.svelte.js';
  import { beginSignIn, spotifyErrorText } from '../../lib/spotify.js';
  import { trackOf, page, artUrl, fmtDur } from '../../lib/music.js';
  import { houseSettings } from '../../state/house.js';
  import { relDay } from '../../lib/household.js';
  import { hhmm } from '../../lib/format.js';
  import Icon from './Icon.svelte';
  import TrackRow from './TrackRow.svelte';
  import Tile from './Tile.svelte';

  let route = $state({ kind: '', id: '' }), clientId = $state('');
  const readRoute = () => { const m = /^#(playlist|album|artist)\/([A-Za-z0-9]+)$/.exec(location.hash); route = m ? { kind: m[1], id: m[2] } : { kind: '', id: '' }; window.scrollTo(0, 0); };
  onMount(async () => {
    watchMusic(); readRoute();
    window.addEventListener('hashchange', readRoute);
    const h = await houseSettings();
    clientId = (h && h.spotifyClientId) || store.get('spotifyClient') || '';
    return () => window.removeEventListener('hashchange', readRoute);
  });

  /* ---------- your library ---------- */
  const TABS = [['playlists', 'Playlists'], ['liked', 'Liked songs'], ['albums', 'Albums'], ['recent', 'Recent']];
  let tab = $state(store.get('musicLib') || 'playlists');
  let lib = $state.raw({}), libErr = $state.raw(null), more = $state({}), loading = $state('');
  async function loadLib(which, again){
    if (!music.acc || (lib[which] && !again)) return;
    loading = which;
    try {
      const off = again && lib[which] ? lib[which].length : 0;
      let p;
      if (which === 'playlists') p = page(await sp().playlists(off));
      else if (which === 'liked') p = page(await sp().liked(off));
      else if (which === 'albums') p = page(await sp().albums(off));
      else p = page(await sp().recent());
      let rows;
      if (which === 'playlists') rows = p.items.filter(x => x && x.id);
      else if (which === 'albums') rows = p.items.map(x => x.album || x).filter(x => x && x.id);
      else rows = p.items.map(x => Object.assign(trackOf(x.track), { added: x.added })).filter(x => x && x.id);
      lib = Object.assign({}, lib, { [which]: (off ? lib[which] : []).concat(rows) });
      more = Object.assign({}, more, { [which]: which !== 'recent' && p.next });
      libErr = null;
    } catch (e){ libErr = e; }
    loading = '';
  }
  $effect(() => { if (music.acc && !route.kind && !q) loadLib(tab); });
  const pick = id => { tab = id; store.set('musicLib', id); };
  const ago = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60e3); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : relDay(Date.parse(t), Date.now()) + ' ' + hhmm(Date.parse(t)); };

  /* ---------- search ---------- */
  let q = $state(''), res = $state.raw(null), searching = $state(false), sTimer = 0;
  function onSearch(){
    clearTimeout(sTimer);
    const text = q.trim();
    if (!text){ res = null; return; }
    sTimer = setTimeout(async () => {
      searching = true;
      try {
        const j = await sp().search(text);
        if (q.trim() !== text) return;
        res = { tracks: page(j, 'tracks').items.filter(Boolean).map(trackOf), artists: page(j, 'artists').items.filter(Boolean), albums: page(j, 'albums').items.filter(Boolean), playlists: page(j, 'playlists').items.filter(Boolean) };
      } catch (e){ res = { err: e }; }
      searching = false;
    }, 350);
  }

  /* ---------- a playlist, album or artist ---------- */
  let detail = $state.raw(null), dErr = $state.raw(null);
  $effect(() => { const r = route; if (music.acc && r.kind) openDetail(r); else detail = null; });
  async function openDetail(r){
    detail = null; dErr = null;
    try {
      if (r.kind === 'playlist'){
        const p = await sp().playlist(r.id);
        const rows = page(await sp().playlistTracks(r.id)).items.map(x => x.track ? trackOf(x.track) : null).filter(x => x && x.id);
        detail = { kind: 'playlist', uri: p.uri, title: p.name, sub: [(p.owner && p.owner.display_name) || '', rows.length ? rows.length + ' songs' : ''].filter(Boolean).join(' · '), images: p.images || [], about: (p.description || '').replace(/<[^>]+>/g, ''), tracks: rows };
      } else if (r.kind === 'album'){
        const a = await sp().album(r.id);
        const rows = page(a.tracks).items.map(t => trackOf(Object.assign({}, t, { album: a }))).filter(Boolean);
        detail = { kind: 'album', uri: a.uri, title: a.name, sub: [(a.artists || []).map(x => x.name).join(', '), String(a.release_date || '').slice(0, 4), rows.length + ' songs'].filter(Boolean).join(' · '), images: a.images || [], tracks: rows, numbered: true };
      } else {
        const [a, top, al] = await Promise.all([sp().artist(r.id), sp().artistTop(r.id), sp().artistAlbums(r.id)]);
        detail = { kind: 'artist', uri: a.uri, title: a.name, sub: (a.genres || []).slice(0, 3).join(', '), images: a.images || [], round: true,
          tracks: ((top && top.tracks) || []).map(trackOf).filter(Boolean).slice(0, 10), albums: page(al).items.filter(Boolean) };
      }
    } catch (e){ dErr = e; }
  }
  const playIn = (d, t) => d.kind === 'artist' ? play({ uris: d.tracks.map(x => x.uri), offset: d.tracks.indexOf(t) }) : play({ context: d.uri, offset: t ? t.uri : 0 });
  const playList = (list, i) => play({ uris: list.slice(i, i + 100).map(x => x.uri) });
  const connect = () => beginSignIn(clientId, location.href).catch(() => { location.href = './settings.html#music'; });
</script>

{#if !music.acc}
  <section class="card hero">
    <div class="disc" aria-hidden="true"><Icon name="music" size={34} /></div>
    <h2 class="label">Music</h2>
    <p class="big">Your Spotify, in the house's own player.</p>
    <p class="note">Play, pause and skip on the TV, the Google speakers or your phone, with the lyrics in time and the colours of the cover. Playing from here needs Spotify Premium.</p>
    {#if clientId}<div class="actions"><button class="btn primary" type="button" onclick={connect}>Connect Spotify</button></div>
    {:else}<p class="note">First, add the household's Spotify Client ID <a href="./settings.html#music">in Settings</a>.</p>{/if}
  </section>
{:else if route.kind}
  <section class="detail">
    <a class="back" href="./music.html" onclick={e => { if (history.length > 1 && document.referrer.indexOf('music.html') >= 0){ e.preventDefault(); history.back(); } }}><Icon name="back" size={18} />Music</a>
    {#if detail}
      <header class="dhead" class:round={detail.round}>
        {#if detail.images.length}<img src={artUrl(detail.images, 300)} alt="">{:else}<span class="ph"><Icon name="music" size={40} /></span>{/if}
        <div class="dt"><span class="label">{detail.kind === 'playlist' ? 'Playlist' : detail.kind === 'album' ? 'Album' : 'Artist'}</span><h2>{detail.title}</h2><p class="note">{detail.sub}</p>
          {#if detail.tracks.length}<div class="actions"><button class="btn primary" type="button" onclick={() => playIn(detail, null)}><Icon name="play" size={18} />Play</button></div>{/if}</div>
      </header>
      {#if detail.about}<p class="note">{detail.about}</p>{/if}
      {#if detail.kind === 'artist'}<h3 class="label sec">Popular</h3>{/if}
      <ul class="list">{#each detail.tracks as t, i (t.id + i)}<TrackRow {t} num={detail.numbered ? i + 1 : null} onplay={() => playIn(detail, t)} />{/each}</ul>
      {#if !detail.tracks.length}<p class="note">{detail.kind === 'playlist' ? 'Spotify didn\'t share this playlist\'s songs. It may be one Spotify makes, which other apps can\'t open: play it from the Spotify app and it\'ll show here.' : 'No songs.'}</p>{/if}
      {#if detail.albums && detail.albums.length}
        <h3 class="label sec">Albums and singles</h3>
        <div class="grid">{#each detail.albums as a (a.id)}<Tile images={a.images} title={a.name} sub={String(a.release_date || '').slice(0, 4) + (a.album_type === 'single' ? ' · Single' : '')} href="#album/{a.id}" />{/each}</div>
      {/if}
    {:else if dErr}<p class="note">{spotifyErrorText(dErr).join(' ')}</p>
    {:else}<div class="skel" style="height:240px"></div>{/if}
  </section>
{:else}
  <section class="search">
    <label class="sbox"><Icon name="search" size={20} /><span class="sr">Search Spotify</span>
      <input type="search" placeholder="Songs, artists, albums, playlists" bind:value={q} oninput={onSearch} autocomplete="off" enterkeyhint="search"></label>
  </section>

  {#if q.trim() && res}
    {#if res.err}<p class="note">{spotifyErrorText(res.err).join(' ')}</p>
    {:else}
      {#if res.tracks.length}<h3 class="label sec">Songs</h3><ul class="list">{#each res.tracks.slice(0, 8) as t (t.id)}<TrackRow {t} onplay={() => play({ uris: [t.uri] })} />{/each}</ul>{/if}
      {#if res.artists.length}<h3 class="label sec">Artists</h3><div class="grid">{#each res.artists.slice(0, 6) as a (a.id)}<Tile images={a.images} title={a.name} round href="#artist/{a.id}" />{/each}</div>{/if}
      {#if res.albums.length}<h3 class="label sec">Albums</h3><div class="grid">{#each res.albums.slice(0, 6) as a (a.id)}<Tile images={a.images} title={a.name} sub={(a.artists || []).map(x => x.name).join(', ')} href="#album/{a.id}" />{/each}</div>{/if}
      {#if res.playlists.length}<h3 class="label sec">Playlists</h3><div class="grid">{#each res.playlists.slice(0, 6) as p (p.id)}<Tile images={p.images} title={p.name} sub={p.owner ? p.owner.display_name : ''} href="#playlist/{p.id}" />{/each}</div>{/if}
      {#if !res.tracks.length && !res.artists.length && !res.albums.length && !res.playlists.length}<p class="note">Nothing found for "{q.trim()}".</p>{/if}
    {/if}
  {:else if q.trim() && searching}<div class="skel" style="height:160px"></div>
  {:else}
    <div class="seg libtabs" role="tablist" aria-label="Your library">
      {#each TABS as [id, label]}<button type="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onclick={() => pick(id)}>{label}</button>{/each}
    </div>
    {#if libErr}<p class="note">{spotifyErrorText(libErr).join(' ')}</p>{/if}
    {#if tab === 'playlists' || tab === 'albums'}
      {#if lib[tab]}
        <div class="grid">
          {#if tab === 'playlists'}{#each lib.playlists as p (p.id)}<Tile images={p.images} title={p.name} sub={(p.tracks || p.items) && (p.tracks || p.items).total != null ? (p.tracks || p.items).total + ' songs' : (p.owner ? p.owner.display_name : '')} href="#playlist/{p.id}" />{/each}
          {:else}{#each lib.albums as a (a.id)}<Tile images={a.images} title={a.name} sub={(a.artists || []).map(x => x.name).join(', ')} href="#album/{a.id}" />{/each}{/if}
        </div>
        {#if !lib[tab].length}<p class="note">{tab === 'playlists' ? 'No playlists yet.' : 'No saved albums yet.'}</p>{/if}
      {:else}<div class="skel" style="height:220px"></div>{/if}
    {:else if lib[tab]}
      <ul class="list">
        {#each lib[tab] as t, i (t.id + i)}
          {#if tab === 'recent'}<li class="when mono">{i === 0 || ago(lib.recent[i - 1].added) !== ago(t.added) ? ago(t.added) : ''}</li>{/if}
          <TrackRow {t} onplay={() => tab === 'liked' ? playList(lib.liked, i) : play({ uris: [t.uri] })} />
        {/each}
      </ul>
      {#if !lib[tab].length}<p class="note">{tab === 'liked' ? 'No liked songs yet. Tap the heart in the player to add one.' : 'Nothing played lately.'}</p>{/if}
    {:else}<div class="skel" style="height:220px"></div>{/if}
    {#if more[tab]}<div class="actions"><button class="btn" type="button" disabled={loading === tab} onclick={() => loadLib(tab, true)}>{loading === tab ? 'Loading…' : 'Show more'}</button></div>{/if}
  {/if}
{/if}

<style>
  .hero{text-align:left;overflow:hidden}
  .hero .big{font:700 22px/1.25 var(--f-body);margin:0;max-width:24ch}
  .disc{position:absolute;right:-30px;top:-30px;width:150px;height:150px;border-radius:50%;display:grid;place-items:center;color:var(--gas);
    background:radial-gradient(circle,rgba(79,214,255,.18) 0 22%,rgba(255,255,255,.04) 23% 100%);border:1px solid var(--line)}
  .search{position:sticky;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:5}
  .sbox{display:flex;align-items:center;gap:10px;padding:0 14px;min-height:48px;border-radius:999px;border:1px solid var(--line-hot);background:rgba(10,13,32,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:var(--muted)}
  .sbox input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:16px var(--f-body);min-height:46px;outline:none}
  .sbox:focus-within{border-color:var(--gas)}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .sec{margin:6px 0 -4px}
  .list{list-style:none;margin:0;padding:0}
  .list :global(.tr:first-child){border-top:0}
  .when{font-size:11.5px;color:var(--faint);padding:10px 0 0;list-style:none}
  .when:empty{display:none}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:16px 14px}
  .libtabs{display:flex;overflow-x:auto;scrollbar-width:none;max-width:100%}
  .libtabs button{white-space:nowrap;font-family:var(--f-body)}
  .detail{display:grid;gap:14px}
  .back{display:inline-flex;align-items:center;gap:4px;color:var(--gas);text-decoration:none;font-size:14px;justify-self:start;min-height:36px}
  .dhead{display:grid;grid-template-columns:132px minmax(0,1fr);gap:16px;align-items:end}
  .dhead img,.dhead .ph{width:132px;height:132px;border-radius:10px;object-fit:cover;background:var(--card);display:grid;place-items:center;color:var(--muted);box-shadow:0 12px 36px rgba(0,0,0,.45)}
  .dhead.round img{border-radius:50%}
  .dt{display:grid;gap:4px;min-width:0}
  .dt h2{font:700 22px/1.2 var(--f-body);margin:0;overflow-wrap:anywhere}
  .actions{display:flex;gap:8px;flex-wrap:wrap}
  .actions :global(.ic){margin-right:2px}
</style>
