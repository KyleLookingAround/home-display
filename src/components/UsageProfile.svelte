<script>
  // Your average day, half hour by half hour, and what it says: always-on use, overnight and peak shares, evenings.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { slotLabel, gbp0, pct } from '../lib/format.js';
  import BarChart from './BarChart.svelte';
  onMount(boot);
  let sel = $state(null);
  const m = $derived(app.model);
  const items = $derived(m && m.profDays ? m.profile.map((v, i) => ({ label: i % 12 === 0 ? slotLabel(i) : null, segs: [{ v, cls: 'bar-e' }] })) : []);
  const ins = $derived(m ? m.insights : null);
  $effect(() => { app.days; sel = null; });
</script>

<section class="panel">
  <p class="panel-eyebrow">Orbit · electricity, 24 hours</p><h2>When you use electricity</h2>
  <p class="muted small">Average kWh in each half hour across the selected period.</p>
  <div class="legend"><span><i style="background:var(--band-cheap);outline:1px solid var(--good)"></i>Typical cheap overnight window 00:30–05:30</span><span><i style="background:var(--band-peak);outline:1px solid var(--bad)"></i>Peak 16:00–19:00</span></div>
  <BarChart {items} aria="Average electricity use by half hour" labelEdge endLabel="24:00" height={210}
    bands={[{ from: 1, to: 11, cls: 'band-cheap' }, { from: 32, to: 38, cls: 'band-peak' }]}
    defaultSel={m ? m.profile.indexOf(Math.max(...m.profile)) : null} bind:selected={sel}
    empty={m ? 'Your average day, half hour by half hour, will show here once electricity readings arrive.' : 'Receiving…'} />
  <p class="readline">{m && sel != null && items.length ? `${slotLabel(sel)}–${slotLabel(sel + 1)} — average ${m.profile[sel].toFixed(3)} kWh (about ${Math.round(m.profile[sel] * 2000)} W)` : ''}</p>
  {#if ins}
    <div class="chips">
      <div class="chip"><span class="v">{Math.round(ins.baseW)} W</span><span class="k">Always-on use</span><p>Fridge, router and standby. About {gbp0(ins.baseW / 1000 * 24 * 365 * (ins.rateNow ?? 25))} a year.</p></div>
      <div class="chip"><span class="v">{pct(ins.overnightShare)}</span><span class="k">Used 00:30–05:30</span><p>The window most overnight tariffs make cheap.</p></div>
      <div class="chip"><span class="v">{pct(ins.peakShare)}</span><span class="k">Used 16:00–19:00</span><p>The priciest window on time-of-use tariffs.</p></div>
      <div class="chip"><span class="v">{ins.evening.toFixed(1)} kWh</span><span class="k">Average use 16:00–midnight</span><p>Roughly the usable battery size that would cover a typical evening.</p></div>
    </div>
  {/if}
</section>
