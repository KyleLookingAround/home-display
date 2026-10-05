<script>
  // Your average day round a clock: when you use it, and what that says.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { gbp0, pct, kwh } from '../../lib/format.js';
  import ClockFace from '../charts/ClockFace.svelte';
  onMount(boot);
  let fuel = $state('e'), sel = $state(null);
  const m = $derived(app.model), ins = $derived(m ? m.insights : null);
  const values = $derived(m ? (fuel === 'g' ? m.gasProfile : m.profile) : []);
  const has = $derived(m && (fuel === 'g' ? m.gasDays : m.profDays));
</script>

<section class="card">
  <div class="card-head">
    <h2 class="label">Your day</h2>
    <div class="seg" role="group" aria-label="Fuel"><button type="button" aria-pressed={fuel === 'e'} onclick={() => { fuel = 'e'; sel = null; }}>Electricity</button><button type="button" aria-pressed={fuel === 'g'} onclick={() => { fuel = 'g'; sel = null; }}>Gas</button></div>
  </div>
  {#if has}
    <ClockFace {values} bind:selected={sel} colour={fuel === 'g' ? 'var(--gas)' : 'var(--elec)'} fmt={v => v.toFixed(2) + ' kWh'}
      centre={kwh(values.reduce((a, b) => a + b, 0))} centreSub="an average day" aria="{fuel === 'g' ? 'Gas' : 'Electricity'} by time of day" />
    <div class="legend"><span><i style="background:var(--cheap)"></i>Cheap overnight, 00:30–05:30</span><span><i style="background:var(--peak)"></i>Peak, 16:00–19:00</span></div>
    {#if fuel === 'e' && ins}
      <div class="stats two">
        <div class="stat"><span class="v">{Math.round(ins.baseW)} W</span><span class="k">Always on: about {gbp0(ins.baseW / 1000 * 24 * 365 * (ins.rateNow ?? 25))} a year</span></div>
        <div class="stat"><span class="v">{ins.evening.toFixed(1)} kWh</span><span class="k">Evenings, 16:00 to midnight</span></div>
        <div class="stat"><span class="v cheap">{pct(ins.overnightShare)}</span><span class="k">Used in the cheap overnight window</span></div>
        <div class="stat"><span class="v peak">{pct(ins.peakShare)}</span><span class="k">Used at the evening peak</span></div>
      </div>
    {/if}
  {:else if m}<p class="note">Your day appears once {fuel === 'g' ? 'gas' : 'electricity'} readings arrive.</p>{/if}
</section>
