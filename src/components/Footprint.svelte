<script>
  // The period's carbon footprint, from the grid's real intensity where it's known.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { kg } from '../lib/format.js';
  onMount(boot);
  const m = $derived(app.model), c = $derived(m ? m.co2 : null), n = $derived(m ? Math.max(m.tot.nE, m.tot.nG) : 0);
  const tot = $derived(c ? c.e + c.g : 0);
</script>

<section class="panel">
  <p class="panel-eyebrow">Emissions · selected period</p><h2>Carbon footprint</h2>
  {#if m && !n}
    <div class="empty">Your carbon footprint appears once readings arrive.</div>
  {:else if m}
    <div class="chips">
      <div class="chip"><span class="v">{kg(tot)}</span><span class="k">CO₂ over {n} days{app.demo ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">{kg(c.e)}</span><span class="k">From electricity</span></div>
      <div class="chip"><span class="v">{kg(c.g)}</span><span class="k">From gas</span></div>
      <div class="chip"><span class="v">{kg(tot / n * 365)}</span><span class="k">A year at this rate</span></div>
    </div>
    <p class="muted small">About the same as driving {Math.round(tot / 0.17).toLocaleString('en-GB')} km in an average petrol car. Electricity uses {c.regional ? 'National Grid\'s half-hourly intensity for your region' : 'a UK average of 200 g/kWh'}; gas uses 183 g/kWh.</p>
  {/if}
</section>
