<script>
  /*
   * The wall display and the TV: links to each mode, and a setup link that copies the household's settings, the
   * mode a screen opens on and its screensaver detail to another screen. The account isn't in it: a screen asks
   * for that itself, so the key never travels in a link.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { houseSettings } from '../../state/house.js';
  import { MODES } from '../../lib/household.js';
  let mode = $state('screensaver'), detail = $state('auto'), out = $state(''), copied = $state(false);
  onMount(async () => { const s = await houseSettings(); mode = s.mode || 'screensaver'; detail = s.detail || 'auto'; });
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const KEYS = ['bins', 'trainFrom', 'trainTo', 'trainWalk', 'tramStop', 'tramWalk', 'ical'];
  async function copy(){
    const s = await houseSettings(), o = { mode, detail, region: app.region };
    KEYS.forEach(k => { o[k] = s[k]; });
    out = new URL('display.html', location.href).href + '#setup=' + b64(JSON.stringify(o));
    copied = false;
    try { await navigator.clipboard.writeText(out); copied = true; } catch {}
  }
</script>

<section class="card" id="screens">
  <h2 class="label">Screens</h2>
  <p class="note">The wall display is made for a tablet or the TV, with big text and the remote. To see it here, or change what your TV shows from this phone, go to <a href="./screen.html">Screen</a>. Open a view:</p>
  <div class="actions">{#each MODES as m}<a class="btn small" href="display.html#{m.id}">{m.label}</a>{/each}</div>
  <h3 class="sub-h">Set up another screen</h3>
  <div class="inline-fields">
    <div class="field"><label for="sMode">Opens on</label><select id="sMode" bind:value={mode}>{#each MODES as m}<option value={m.id}>{m.label}</option>{/each}</select></div>
    <div class="field"><label for="sDetail">Screensaver detail</label><select id="sDetail" bind:value={detail}><option value="auto">Automatic</option><option value="low">Low, for older TVs</option><option value="high">High</option></select></div>
  </div>
  <div class="actions"><button class="btn primary small" type="button" onclick={copy}>Copy a setup link</button></div>
  {#if out}
    <p class="note" role="status">{copied ? 'Copied. ' : ''}Open it on the other screen to save these settings there{app.house && app.house.ical ? '. It includes your secret calendar address, so only send it to yourself' : ''}. The Octopus account isn't included.</p>
    <input class="input link" readonly value={out} onfocus={ev => ev.target.select()} aria-label="Setup link">
  {/if}
</section>

<style>
  .sub-h{font:600 14px/1.3 var(--f-body);margin-top:var(--s2)}
  .link{font:12px var(--f-mono)}
</style>
