<script>
  // The boiler: when it runs, whether it runs overnight, and how gas rises as it gets colder.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { slotLabel, shortDate, keyDate, kwh, gbp, pence, sum } from '../../lib/format.js';
  import Scatter from '../charts/Scatter.svelte';
  onMount(boot);
  const h = $derived(app.model ? app.model.heating : null), reg = $derived(app.reg);
  const runs = $derived(h ? h.runs.map(([a, b]) => `${slotLabel(a)}–${slotLabel(b)}`) : []);
  const fc = $derived(app.raw && app.raw.weather && reg && reg.a != null ? [...app.raw.weather.entries()].filter(([, w]) => w.forecast).map(([k, w]) => ({ k, temp: w.t, g: reg.a + reg.b * Math.max(0, 15.5 - w.t) })) : []);
  const gr = $derived(app.gRateNow ?? 7);
</script>

<section class="card">
  <h2 class="label">Heating</h2>
  {#if h}
    {#if runs.length}<p>The boiler usually runs <b>{runs.join(', ')}</b>.</p>{/if}
    {#if h.totalNights}
      {#if h.nightDays.length}<p class="warn">Gas was used between midnight and 05:00 on {h.nightDays.length} of the last {h.totalNights} nights ({h.nightDays.slice(-4).map(k => shortDate(keyDate(k))).join(', ')}{h.nightDays.length > 4 ? '…' : ''}). Check the boiler timer and any frost setting if nobody needs heat then.</p>
      {:else}<p class="good">No gas overnight: the boiler rests when it should.</p>{/if}
    {/if}
  {/if}
  {#if reg && reg.pts.length}
    <Scatter points={reg.pts} forecast={fc} fit={reg.a != null ? reg : null} aria="Daily gas against the day's mean temperature" />
    {#if reg.a != null}
      <p>Each degree colder adds about <b>{reg.b.toFixed(1)} kWh</b> of gas a day ({pence(reg.b * gr)}); hot water and cooking use about <b>{reg.a.toFixed(1)} kWh</b>.{app.demo ? ' Example.' : ''}</p>
      {#if fc.length}<p class="note">The forecast week should use about {kwh(sum(fc.map(p => p.g)))} of gas, roughly {gbp(sum(fc.map(p => p.g)) * gr)} (hollow dots). Fit R² {reg.r2.toFixed(2)}{reg.r2 < .5 ? ', so treat it loosely' : ''}.</p>{/if}
    {:else}<p class="note">Needs about 10 days of gas readings to work out the pattern.</p>{/if}
  {:else if app.raw && !app.raw.weather}<p class="note">Loading Stockport's weather…</p>
  {:else if app.raw}<p class="note">Once there are gas readings, this shows how your gas use climbs as it gets colder.</p>{/if}
</section>
