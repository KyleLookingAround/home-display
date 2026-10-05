<script>
  // Every day there are readings for, as a calendar, to spot the odd ones.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { dayKey, kwh, gbp, addDays, keyDate } from '../../lib/format.js';
  import { unitPriceAt } from '../../lib/octopus.js';
  import HeatMap from '../charts/HeatMap.svelte';
  onMount(boot);
  let fuel = $state('e');
  const days = $derived.by(() => {
    const raw = app.raw; if (!raw) return [];
    const rows = fuel === 'g' ? raw.gas : raw.elec; if (!rows.length) return [];
    const by = new Map();
    for (const x of rows){ const k = dayKey(x.t); by.set(k, (by.get(k) || 0) + x.v); }
    const keys = [...by.keys()].sort(), out = [];
    for (let d = keyDate(keys[0]), last = keyDate(keys[keys.length - 1]); d <= last; d = addDays(d, 1)){ const k = dayKey(d); out.push({ k, v: by.has(k) ? by.get(k) : null }); }
    return out;
  });
</script>

<section class="card">
  <div class="card-head">
    <h2 class="label">Every day we have</h2>
    <div class="seg" role="group" aria-label="Fuel"><button type="button" aria-pressed={fuel === 'e'} onclick={() => { fuel = 'e'; }}>Electricity</button><button type="button" aria-pressed={fuel === 'g'} onclick={() => { fuel = 'g'; }}>Gas</button></div>
  </div>
  {#if days.length}
    <HeatMap {days} colour={fuel === 'g' ? '79,214,255' : '255,181,71'} fmt={kwh} aria="{fuel === 'g' ? 'Gas' : 'Electricity'} each day, as a calendar" />
    <p class="note">Brighter is more. Tap a day to read it.</p>
  {:else if app.raw}<p class="note">No {fuel === 'g' ? 'gas' : 'electricity'} readings yet.</p>{/if}
</section>
