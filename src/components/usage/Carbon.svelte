<script>
  // The period's carbon footprint.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { kg } from '../../lib/format.js';
  onMount(boot);
  const m = $derived(app.model), n = $derived(m ? Math.max(m.tot.nE, m.tot.nG) : 0), c = $derived(m ? m.co2 : null);
</script>

<section class="card">
  <h2 class="label">Carbon</h2>
  {#if m && n}
    <div class="stats">
      <div class="stat"><span class="v">{kg(c.e + c.g)}</span><span class="k">CO₂ over {n} days</span></div>
      <div class="stat"><span class="v elec">{kg(c.e)}</span><span class="k">Electricity</span></div>
      <div class="stat"><span class="v gas">{kg(c.g)}</span><span class="k">Gas</span></div>
    </div>
    <p class="note">About {kg((c.e + c.g) / n * 365)} a year, like driving {Math.round((c.e + c.g) / n * 365 / 0.17).toLocaleString('en-GB')} km in a petrol car. Electricity uses {c.regional ? 'the grid\'s real half-hourly intensity for your region' : 'a UK average of 200 g/kWh'}; gas 183 g/kWh.{app.demo ? ' Example.' : ''}</p>
  {:else if m}<p class="note">Your footprint appears once readings arrive.</p>{/if}
</section>
