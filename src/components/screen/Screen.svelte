<script>
  /*
   * The wall display, from the phone: a live picture of each view, and, once paired with a screen's code, buttons
   * that change what that screen shows (through ntfy.sh; see src/lib/remote.js).
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { MODES } from '../../lib/household.js';
  import { cleanCode, showCode, sendRemote, listenRemote } from '../../lib/remote.js';
  import { hhmm } from '../../lib/format.js';

  let code = $state(null), typed = $state(''), bad = $state(false);
  let view = $state('today'), tv = $state(null), asked = $state(0), quiet = $state(false), sent = $state('');
  let width = $state(360);
  let stop = () => {};
  const scale = $derived(width / 1920);

  function listen(){
    stop();
    if (!code) return;
    stop = listenRemote(code, r => { if (r.from === 'screen'){ tv = r.state; view = r.state.shown; quiet = false; } });
    // give the stream a moment to open, then ask the screen what it's showing
    setTimeout(() => ask('hello'), 800);
  }
  async function ask(cmd, mode){
    if (!code) return;
    asked = Date.now(); quiet = false;
    const ok = await sendRemote(code, { from: 'phone', cmd, mode });
    sent = ok ? '' : 'The relay didn\'t take that. Check your connection and try again.';
    setTimeout(() => { if (asked && (!tv || tv.at < asked - 1000)) quiet = true; }, 10000);
  }
  function pick(id){ view = id; if (code) ask('mode', id); }
  function pair(ev){
    ev.preventDefault();
    const c = cleanCode(typed);
    bad = !c; if (!c) return;
    code = c; store.set('remoteTV', c); typed = ''; tv = null; listen();
  }
  function unpair(){ stop(); store.del('remoteTV'); code = null; tv = null; quiet = false; }
  onMount(() => {
    code = cleanCode(store.get('remoteTV'));
    listen();
    return () => stop();
  });
</script>

<section class="card">
  <div class="card-head"><h2 class="label">{code ? 'Your TV' : 'The wall display'}</h2>{#if tv}<span class="small cheap">Showing {MODES.find(m => m.id === tv.shown).label} · {hhmm(tv.at)}</span>{/if}</div>
  <div class="tv" bind:clientWidth={width} style="height:{Math.round(1080 * scale)}px">
    <iframe src="display.html#{view}&embed=1" title="What the wall display shows: {MODES.find(m => m.id === view).label}" tabindex="-1" style="transform:scale({scale})"></iframe>
  </div>
  <div class="modes" role="group" aria-label="{code ? 'Show on the TV' : 'Preview'}">
    {#each MODES as m}<button type="button" class="btn small" aria-pressed={view === m.id} onclick={() => pick(m.id)}>{m.label}</button>{/each}
  </div>
  {#if code}
    <p class="note" role="status">{sent || (quiet ? 'No answer from the TV yet. Is it on, with the display open?' : tv ? 'Tap a view to show it on the TV.' : 'Asking the TV what it\'s showing…')}</p>
    <div class="actions">
      <button class="btn small" type="button" onclick={() => ask('wake')}>Wake the screen</button>
      <button class="btn small" type="button" onclick={() => ask('reload')}>Fresh start</button>
      <a class="btn small" href="display.html#{view}">Open it on this phone</a>
    </div>
  {:else}
    <p class="note">These are the wall display's views, with your data. Pair with your TV to change what it shows from here.</p>
  {/if}
</section>

<section class="card" id="pair">
  <h2 class="label">Pairing</h2>
  {#if code}
    <p class="line">Paired with the screen showing code <b class="mono">{showCode(code)}</b>.</p>
    <div class="actions"><button class="btn small" type="button" onclick={unpair}>Unpair</button></div>
  {:else}
    <form class="form" onsubmit={pair}>
      <div class="field"><label for="pairCode">The code on your TV</label>
        <input id="pairCode" class="mono" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH" bind:value={typed}>
        <span class="help">On the TV, press Enter or move the mouse, choose Settings, and look under "Your phone as a remote".</span></div>
      {#if bad}<p class="note bad">That isn't a code. It's eight letters and numbers, like ABCD-EFGH.</p>{/if}
      <div class="actions"><button class="btn primary small" type="submit">Pair</button></div>
    </form>
  {/if}
  <p class="note">Only requests to change the view, wake the screen or start afresh, and the screen's answer, go through ntfy.sh, a free relay. Your prices, readings and settings don't.</p>
</section>

<section class="card">
  <h2 class="label">Set up a screen</h2>
  <p class="note">Bins, your station and the calendar reach a new screen with a setup link from <a href="./settings.html#screens">Settings</a>. Each screen connects its own Octopus account.</p>
</section>

<style>
  .tv{position:relative;width:100%;overflow:hidden;border-radius:var(--radius-sm);border:1px solid var(--line-hot);background:#000;margin-top:var(--s2)}
  .tv iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;transform-origin:0 0;pointer-events:none}
  .modes{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s3)}
  .modes .btn[aria-pressed="true"]{background:var(--gas);border-color:var(--gas);color:#04101a;font-weight:600}
  .mono{font-family:var(--f-mono);letter-spacing:.08em}
  .line{font-size:16px}
</style>
