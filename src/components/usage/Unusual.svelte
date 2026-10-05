<script>
  // Half hours and days well above your normal.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { fmtDate, hhmm, kwh } from '../../lib/format.js';
  onMount(boot);
  const m = $derived(app.model);
  // Biggest first: odd days, then half hours, the top four shown and the rest folded.
  const all = $derived(m ? [
    ...m.oddDays.map(d => ({ main: `${fmtDate(d.date)}, ${d.fuel}`, sub: `${d.ratio.toFixed(1)}× a normal day`, side: kwh(d.v) })),
    ...m.spikes.slice().sort((a, b) => b.v / b.base - a.v / a.base).map(s => ({ main: `${fmtDate(new Date(s.t))} at ${hhmm(s.t)}`, sub: `Electricity, usually ${s.base.toFixed(2)} kWh then`, side: `${s.v.toFixed(2)} kWh` })),
  ] : []);
</script>

{#snippet row(r)}<li><span class="main-t"><span>{r.main}</span><span class="sub">{r.sub}</span></span><span class="side">{r.side}</span></li>{/snippet}

<section class="card">
  <h2 class="label">Unusual</h2>
  {#if m && (m.spikes.length || m.oddDays.length)}
    <ul class="rows">{#each all.slice(0, 4) as r}{@render row(r)}{/each}</ul>
    {#if all.length > 4}<details class="fold"><summary>{all.length - 4} more</summary><ul class="rows">{#each all.slice(4) as r}{@render row(r)}{/each}</ul></details>{/if}
    <p class="note">Days 40% above your usual electricity or 50% above your usual gas, and half hours at least three times your usual for that time.{app.demo ? ' Example.' : ''}</p>
  {:else if m}<p class="note">Nothing unusual in this period.</p>{/if}
</section>
