<script>
  /*
   * Music: connecting Spotify. The household's Client ID comes from household.json (or is typed here, for this
   * device); signing in happens at Spotify, which sends you back to this page, where the code is traded for tokens
   * that stay on this device. Then back to where you started.
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { beginSignIn, finishSignIn, isSignInReturn, redirectUri, spotifyErrorText, activeAccount } from '../../lib/spotify.js';
  import { music, reloadAccount, signOut } from '../../state/music.svelte.js';
  import { houseSettings } from '../../state/house.js';
  import People from '../music/People.svelte';

  let fromFile = $state(''), mine = $state(store.get('spotifyClient') || ''), msg = $state(''), err = $state(''), busy = $state(false);
  const clientId = $derived(mine.trim() || fromFile);
  const acc = $derived(music.acc);
  let redirect = $state('');

  onMount(async () => {
    redirect = redirectUri();
    const h = await houseSettings();
    fromFile = (h && h.spotifyClientId) || '';
    if (isSignInReturn()){
      busy = true;
      try {
        const { account, back, forTv } = await finishSignIn(clientId);
        history.replaceState(null, '', location.pathname + '#music');
        // signed in for the TV: hand it to the Screen page, which seals it and sends it
        if (forTv){ sessionStorage.setItem('hse-tvSpotify', JSON.stringify(account)); location.assign(back || './screen.html#spotify'); return; }
        reloadAccount();
        msg = `Connected as ${account.name}.` + (account.product && account.product !== 'premium' ? ' This account isn\'t Premium, so the player can show what\'s on but not play, pause or skip.' : '');
        if (back && !/settings\.html/.test(back)) setTimeout(() => location.assign(back), 900);
      } catch (e){ err = spotifyErrorText(e).join(' '); history.replaceState(null, '', location.pathname + '#music'); }
      busy = false;
    }
  });
  function saveClient(ev){ ev.preventDefault(); store.set('spotifyClient', mine.trim()); msg = mine.trim() ? 'Client ID saved on this device.' : 'Using the household\'s Client ID.'; }
  async function connect(another){
    err = ''; busy = true;
    try { await beginSignIn(clientId, location.href.replace(/#.*$/, '') + '#music', false, another === true); }
    catch (e){ err = spotifyErrorText(e).join(' '); busy = false; }
  }
  function disconnect(){ signOut(); msg = 'Spotify is disconnected on this device.'; }
</script>

<section class="card" id="music">
  <h2 class="label">Music</h2>
  {#if acc}
    <div class="who"><span class="dot"></span><div><b>{acc.name}</b><span class="note">Spotify{acc.product === 'premium' ? ' Premium' : acc.product ? ', ' + acc.product : ''} · connected on this device</span></div></div>
    {#if acc.product && acc.product !== 'premium'}<p class="note warn">Spotify only lets Premium accounts be played, paused and skipped from another app, so the player will show what's on but not control it.</p>{/if}
    <People />
    <div class="actions"><a class="btn" href="./music.html">Open Music</a><button class="btn" type="button" onclick={() => connect(true)} disabled={!clientId || busy}>Add someone</button><button class="btn" type="button" onclick={disconnect}>Disconnect {acc.name.split(' ')[0]}</button></div>
    <p class="note">Everyone can listen as themselves: "Add someone" signs in another Spotify on this phone, and the Music tab then shows who's listening. While the household's Spotify app is in development mode, add each person's Spotify email under User Management in Spotify's developer dashboard first.</p>
  {:else}
    <p class="note">Connect Spotify to play, pause and skip from any page, on the TV, the Google speakers or your phone. You sign in at Spotify; this site never sees your password, and the sign-in stays on this device.</p>
    <div class="actions"><button class="btn primary" type="button" onclick={connect} disabled={!clientId || busy}>{busy ? 'Connecting…' : 'Connect Spotify'}</button></div>
  {/if}
  {#if msg}<p class="note" role="status">{msg}</p>{/if}
  {#if err}<p class="note err" role="alert">{err}</p>{/if}
  <details class="fold" open={!clientId}>
    <summary>The household's Spotify app</summary>
    <form class="form" onsubmit={saveClient}>
      <div class="field"><label for="spClient">Client ID</label><input id="spClient" class="mono" autocomplete="off" spellcheck="false" bind:value={mine} placeholder={fromFile || 'From developer.spotify.com'}>
        <span class="help">{fromFile ? 'The household\'s is set in household.json. Type one here only to use another on this device.' : 'Make a free app at developer.spotify.com, then copy its Client ID here. It isn\'t a secret.'}</span></div>
      <p class="note">Its redirect URI must include this page exactly: <code class="mono">{redirect}</code></p>
      <div class="actions"><button class="btn" type="submit">Save</button></div>
    </form>
  </details>
</section>

<style>
  .who{display:flex;gap:12px;align-items:center}
  .who div{display:grid}
  .who b{font-size:16px}
  .dot{width:12px;height:12px;border-radius:50%;background:#1ed760;box-shadow:0 0 12px rgba(30,215,96,.6);flex:none}
  .warn{color:#ffd166}
  .err{color:#ff6b7d}
  code{font-size:12.5px;overflow-wrap:anywhere}
</style>
