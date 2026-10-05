<script>
  // Your readings as a CSV, clearing what this device has cached, and whether the home server helper is there.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot, refresh, loadPrices } from '../../state/session.js';
  import { cacheClear } from '../../state/cache.js';
  import { toCSV } from '../../lib/analysis.js';
  import { NET } from '../../lib/net.js';
  import { dayKey } from '../../lib/format.js';
  let cleared = $state(false), keys = $state({});
  onMount(async () => { await boot(); keys = NET.keys || {}; });
  function download(){
    if (!app.raw) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCSV(app.raw)], { type: 'text/csv' }));
    a.download = `harold-street-energy-${dayKey(Date.now())}${app.demo ? '-example' : ''}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function clear(){ await cacheClear(); cleared = true; refresh(); loadPrices(true); }
</script>

<section class="card" id="data">
  <h2 class="label">Data</h2>
  <div class="actions">
    <button class="btn small" type="button" disabled={!app.raw} onclick={download}>Download readings (CSV)</button>
    <button class="btn small" type="button" onclick={clear}>Clear what's cached</button>
    {#if cleared}<span class="note" role="status">Cleared. Fetching again.</span>{/if}
  </div>
  <p class="note">Your account's data is kept on this device for half an hour and prices for ten minutes, so moving between pages is quick.</p>
  <p class="note">{#if app.proxy}Running through your home server helper{keys.rtt || keys.tfgm ? `, which holds the ${[keys.rtt && 'train', keys.tfgm && 'tram'].filter(Boolean).join(' and ')} key${keys.rtt && keys.tfgm ? 's' : ''}` : ''}.
    {:else}No home server helper. Everything here works without one; trams and a Google calendar need it.{/if}</p>
</section>
