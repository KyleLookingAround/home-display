<script>
  // Your gas by half hour: when the boiler runs, and whether it runs overnight.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { slotLabel, shortDate, keyDate } from '../lib/format.js';
  import BarChart from './BarChart.svelte';
  import Example from './Example.svelte';
  onMount(boot);
  let sel = $state(null);
  const m = $derived(app.model), h = $derived(m ? m.heating : null);
  const items = $derived(m && m.gasDays ? m.gasProfile.map((v, i) => ({ label: i % 12 === 0 ? slotLabel(i) : null, segs: [{ v, cls: 'bar-g' }] })) : []);
  const runs = $derived(h ? h.runs.map(([a, b]) => `${slotLabel(a)}–${slotLabel(b)}`) : []);
  $effect(() => { app.days; sel = null; });
</script>

<section class="panel">
  <p class="panel-eyebrow">Orbit · gas, 24 hours</p><h2>Boiler schedule check</h2>
  <p class="muted small">Average gas in each half hour. Heating and hot water show up as blocks.</p>
  <BarChart {items} aria="Average gas use by half hour" labelEdge endLabel="24:00" height={200}
    defaultSel={m ? m.gasProfile.indexOf(Math.max(...m.gasProfile)) : null} bind:selected={sel}
    empty={m ? 'Your gas pattern will show here once gas readings arrive.' : 'Receiving…'} />
  <p class="readline">{m && sel != null && items.length ? `${slotLabel(sel)}–${slotLabel(sel + 1)} — average ${m.gasProfile[sel].toFixed(2)} kWh of gas` : ''}</p>
  {#if h}
    <div class="prose">
      {#if runs.length}<p>Your boiler usually runs <b>{runs.join(', ')}</b><Example />.</p>{/if}
      {#if h.totalNights}
        {#if h.nightDays.length}
          <p class="warn">Gas was used between midnight and 05:00 on {h.nightDays.length} of the last {h.totalNights} nights ({h.nightDays.slice(-5).map(k => shortDate(keyDate(k))).join(', ')}{h.nightDays.length > 5 ? ' and more' : ''}). If nobody needs heat or hot water then, check the boiler timer and any frost or pre-heat setting.</p>
        {:else}<p class="good">No gas used overnight. The boiler is resting when it should be.</p>{/if}
      {/if}
    </div>
  {/if}
</section>
