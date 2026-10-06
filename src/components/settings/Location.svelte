<script>
  /*
   * This phone's location: walk times from where you are, and noticing when you're at work. It's asked for only
   * while the app is open, kept in memory, and work's place stays on this phone.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { where, useLocation, rememberOffice, forgetOffice, watchWhere } from '../../state/where.svelte.js';
  import { houseSettings, saveHouse } from '../../state/house.js';
  import { distKm } from '../../lib/geo.js';
  import { store } from '../../lib/browser.js';
  let msg = $state(''), auto = $state(false);
  onMount(() => { houseSettings(); auto = store.get('autoShare') === '1'; return watchWhere(); });
  const setAuto = on => { auto = on; store.set('autoShare', on ? '1' : ''); };
  const fresh = $derived(!!(app.here && app.now - app.here.at < 5 * 60e3 + 60e3));
  async function here(){
    const r = await rememberOffice();
    if (!r){ msg = 'Remembered. Set the station you go to in Household for the walk from it.'; return; }
    await saveHouse({ workWalk: r.walk });
    msg = `Remembered: a ${r.walk} minute walk from ${r.station}. Today counts as an office day while you're here.`;
  }
  function forget(){ forgetOffice(); msg = 'Forgotten.'; }
</script>

<section class="card" id="location">
  <h2 class="label">Location</h2>
  <label class="sw"><input type="checkbox" checked={where.on} onchange={e => useLocation(e.currentTarget.checked)}><span>Use this phone's location</span></label>
  <p class="note">The walk to the train becomes the walk from where you are, and the phone notices when you're at work, so the day counts as an office day. It's only asked for while the app is open, and never leaves this phone, except sealed to your TV if you share your way home.</p>
  {#if where.denied}<p class="note warn">Your browser has blocked location for this site. Allow it in the browser's settings for the site, then turn this on again.</p>{/if}
  <label class="sw"><input type="checkbox" checked={auto} onchange={e => setAuto(e.currentTarget.checked)}><span>Tell the TV when I'm on my train home</span></label>
  <p class="note">Once your train home leaves, the paired TV shows you're on your way and when you'll be in, followed from the train's live times. With location on, it shows where you are too. Sealed with the site PIN. You can also tap "Show the TV I'm on my way" under your journey.</p>
  {#if where.on}
    <div class="work">
      {#if where.office}
        <p>Work is remembered{app.here && fresh ? `, ${distKm(app.here, where.office) < 1 ? Math.round(distKm(app.here, where.office) * 1000) + ' m' : distKm(app.here, where.office).toFixed(1) + ' km'} from here` : ''}.</p>
        <div class="actions"><button class="btn small" type="button" disabled={!fresh} onclick={here}>Move it to here</button><button class="btn small" type="button" onclick={forget}>Forget it</button></div>
      {:else}
        <p>When you're at work, remember the place, so the phone knows.</p>
        <div class="actions"><button class="btn small primary" type="button" disabled={!fresh} onclick={here}>I'm at work: remember this place</button></div>
        {#if !fresh}<p class="note">Finding where you are…</p>{/if}
      {/if}
      {#if msg}<p class="note" role="status">{msg}</p>{/if}
    </div>
  {/if}
</section>

<style>
  .sw{display:flex;align-items:center;gap:8px;font-weight:500;cursor:pointer;margin-bottom:var(--s2)}
  .sw input{width:18px;height:18px;accent-color:var(--elec)}
  .work{margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--line)}
  .work p{margin:0 0 var(--s2)}
  .actions{display:flex;flex-wrap:wrap;gap:var(--s2)}
  .warn{color:var(--warn)}
</style>
