<script>
  /*
   * Spotify on the TV, from the Screen page. The TV signs in to Spotify itself, but on this phone: "Connect Spotify on
   * the TV" goes to Spotify (asking which account), comes back here, and the sign-in is sealed with the site PIN and
   * sent, so the TV keeps its own refresh token and nothing is typed with a remote. Then: the favourites on the TV
   * remote's number keys, and the sleep timer, which runs on the TV because it's always on.
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { sendRemote, lockSecret, canSeal, sealDetails } from '../../lib/remote.js';
  import { beginSignIn, spotifyErrorText } from '../../lib/spotify.js';
  import { page, artUrl } from '../../lib/music.js';
  import { hhmm } from '../../lib/format.js';
  import { music, sp, watchMusic } from '../../state/music.svelte.js';
  import { houseSettings } from '../../state/house.js';
  import Icon from '../music/Icon.svelte';

  let { code, tv } = $props();
  let clientId = $state(''), note = $state(''), busy = $state(false);
  let choosing = $state(false), lists = $state.raw([]), favs = $state(store.getJ('musicFavs', [])), favNote = $state('');
  const SLEEP = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], ['song', 'End of song'], [0, 'Off']];

  onMount(async () => {
    watchMusic();
    const h = await houseSettings();
    clientId = store.get('spotifyClient') || (h && h.spotifyClientId) || '';
    // back from Spotify with a sign-in for the TV (settings/Music.svelte left it here): seal it and send it
    let waiting = null;
    try { waiting = JSON.parse(sessionStorage.getItem('hse-tvSpotify') || 'null'); sessionStorage.removeItem('hse-tvSpotify'); } catch (e){}
    if (waiting) send(waiting);
  });
  async function connect(){
    note = ''; busy = true;
    try { await beginSignIn(clientId, location.href.replace(/#.*$/, '') + '#spotify', true); }
    catch (e){ note = spotifyErrorText(e).join(' '); busy = false; }
  }
  async function send(acc){
    const secret = lockSecret();
    if (!secret || !canSeal()){ note = `Signed in as ${acc.name} for the TV, but sending it needs the site's PIN on both: unlock this phone and the TV with the PIN, with "Remember this screen" ticked, then connect again.`; return; }
    note = 'Sealing and sending…';
    try {
      const box = await sealDetails(code, secret, { spotify: acc });
      const ok = await sendRemote(code, { from: 'phone', cmd: 'account', box });
      note = ok ? `Sent ${acc.name}'s Spotify to the TV, sealed. Waiting for it…` : 'The relay didn\'t take it. Try again.';
    } catch (e){ note = 'This browser couldn\'t seal it.'; }
  }
  $effect(() => { if (tv && tv.spotify && /^Sent|^Sealing/.test(note) && /Spotify/.test(tv.note || '')) note = ''; });

  async function choose(){
    choosing = !choosing; favNote = '';
    if (!choosing || lists.length) return;
    if (!music.acc){ favNote = 'Connect Spotify on this phone first (Settings, then Music) to choose from your playlists.'; return; }
    try {
      const [pl, al] = await Promise.all([sp().playlists(0), sp().albums(0)]);
      lists = page(pl).items.filter(x => x && x.id).map(x => ({ uri: x.uri, name: x.name, img: artUrl(x.images, 64), kind: 'Playlist' }))
        .concat(page(al).items.map(x => x.album || x).filter(x => x && x.id).map(x => ({ uri: x.uri, name: x.name, img: artUrl(x.images, 64), kind: 'Album' })));
    } catch (e){ favNote = spotifyErrorText(e).join(' '); }
  }
  function flip(l){
    const i = favs.findIndex(f => f.uri === l.uri);
    if (i >= 0) favs = favs.filter((_, k) => k !== i);
    else if (favs.length < 9) favs = [...favs, { uri: l.uri, name: l.name }];
    else favNote = 'Nine at most, one for each number key.';
  }
  async function sendFavs(){
    store.setJ('musicFavs', favs);
    const ok = await sendRemote(code, { from: 'phone', cmd: 'favs', favs });
    favNote = ok ? (favs.length ? `Sent. On the TV, 1 to ${favs.length} play them in the Music view.` : 'Cleared. The TV uses your first playlists.') : 'The relay didn\'t take it. Try again.';
    if (ok) choosing = false;
  }
  async function sleep(v){
    const ok = await sendRemote(code, { from: 'phone', cmd: 'sleep', mins: v === 'song' ? 0 : v, song: v === 'song' });
    note = ok ? '' : 'The relay didn\'t take that. Try again.';
  }
  const sleeping = $derived(tv && tv.sleepSong ? 'Stops at the end of this song' : tv && tv.sleepAt > Date.now() ? `Fades out at ${hhmm(tv.sleepAt)}` : '');
</script>

<section class="card" id="spotify">
  <div class="card-head"><h2 class="label">Spotify on the TV</h2>{#if tv && tv.spotify}<span class="small cheap">{tv.spotify}</span>{/if}</div>
  {#if tv && tv.spotify}
    <p class="line">The TV plays as <b>{tv.spotify}</b>. Its Music view shows the song, the words and the liner notes, and Today and the screensaver show what's on.</p>
  {:else}
    <p class="note">Sign the TV in to Spotify from here. It's sealed with your site PIN on the way, like the Octopus account, and the TV keeps its own sign-in, separate from this phone's.</p>
  {/if}
  <div class="actions">
    <button class="btn {tv && tv.spotify ? '' : 'primary'} small" type="button" onclick={connect} disabled={!clientId || busy}>{busy ? 'Going to Spotify…' : tv && tv.spotify ? 'Change account' : 'Connect Spotify on the TV'}</button>
  </div>
  {#if !clientId}<p class="note">The household's Spotify app isn't set up yet: <a href="./settings.html#music">Settings, then Music</a>.</p>{/if}
  {#if note}<p class="note" role="status">{note}</p>{/if}

  {#if tv && tv.spotify}
    <h3 class="label sub">Sleep timer</h3>
    <div class="seg" role="group" aria-label="Sleep timer">
      {#each SLEEP as [v, l]}<button type="button" aria-pressed={v === 0 ? !sleeping : v === 'song' ? !!(tv && tv.sleepSong) : false} onclick={() => sleep(v)}>{l}</button>{/each}
    </div>
    <p class="note"><Icon name="moon" size={15} /> {sleeping || 'The TV fades the music out over a minute and pauses. It also fades out as the night clock starts, unless you turn that off in its settings.'}</p>

    <h3 class="label sub">Favourites on the remote</h3>
    {#if favs.length}<ol class="favs">{#each favs as f, i}<li><b class="mono">{i + 1}</b>{f.name}</li>{/each}</ol>
    {:else}<p class="note">The number keys play your first five playlists until you choose.</p>{/if}
    <div class="actions"><button class="btn small" type="button" aria-expanded={choosing} onclick={choose}>{choosing ? 'Done choosing' : 'Choose favourites'}</button>
      {#if choosing}<button class="btn primary small" type="button" onclick={sendFavs}>Send to the TV</button>{/if}</div>
    {#if choosing && lists.length}
      <ul class="pick">{#each lists as l (l.uri)}{@const n = favs.findIndex(f => f.uri === l.uri)}
        <li><button type="button" aria-pressed={n >= 0} onclick={() => flip(l)}>
          {#if l.img}<img src={l.img} alt="" width="40" height="40" loading="lazy">{:else}<span class="ph"></span>{/if}
          <span class="tx"><b>{l.name}</b><small>{l.kind}</small></span><span class="num mono">{n >= 0 ? n + 1 : ''}</span></button></li>{/each}</ul>
    {/if}
    {#if favNote}<p class="note" role="status">{favNote}</p>{/if}
  {/if}
</section>

<style>
  .line{font-size:16px}
  .sub{margin-top:var(--s4);margin-bottom:var(--s2)}
  .seg{display:flex;flex-wrap:wrap}
  .note :global(.ic){display:inline-block;vertical-align:-2px;color:var(--gas)}
  .favs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}
  .favs li{display:flex;align-items:center;gap:10px;min-width:0;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .favs b,.num{flex:none;width:24px;height:24px;display:grid;place-items:center;border-radius:var(--radius-sm);border:1px solid var(--gas);color:var(--gas);font-size:12.5px}
  .num:empty{border-color:var(--line-hot)}
  .pick{list-style:none;margin:var(--s3) 0 0;padding:0;display:grid;gap:2px;max-height:360px;overflow-y:auto;border-top:1px solid var(--line)}
  .pick button{appearance:none;border:0;background:transparent;color:var(--ink);width:100%;display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;padding:6px 4px;border-radius:var(--radius-sm);cursor:pointer;font:inherit;min-height:52px}
  .pick button:hover{background:var(--sel)}
  .pick img,.ph{width:40px;height:40px;border-radius:var(--radius-sm);object-fit:cover;display:block;background:var(--card-2)}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tx small{font-size:12.5px;color:var(--muted)}
</style>
