<script>
  // Half hours and days well above your normal.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { fmtDate, hhmm, kwh } from '../lib/format.js';
  import Example from './Example.svelte';
  onMount(boot);
  const m = $derived(app.model);
</script>

<section class="panel">
  <p class="panel-eyebrow">Anomaly scan</p><h2>Spike detective</h2>
  {#if m && (m.profDays || m.gasDays)}
    <div class="grid2">
      <div class="prose"><h3>Unusual half hours <Example /></h3><p class="muted small">Electricity at least three times your normal for that time of day: an oven, heater or appliance left on.</p>
        {#if m.spikes.length}<ul class="list">{#each m.spikes as s}<li><span>{fmtDate(new Date(s.t))} <span class="mono">{hhmm(s.t)}</span></span><span class="when">{s.v.toFixed(2)} kWh vs usual {s.base.toFixed(2)}</span></li>{/each}</ul>
        {:else}<p class="muted">Nothing unusual. Your half hours look like your normal pattern.</p>{/if}
      </div>
      <div class="prose"><h3>Unusual days</h3><p class="muted small">Days at least 40% above your typical electricity or 50% above your typical gas.</p>
        {#if m.oddDays.length}<ul class="list">{#each m.oddDays as d}<li><span>{fmtDate(d.date)} · {d.fuel}</span><span class="when">{kwh(d.v)}, {d.ratio.toFixed(1)}× your normal day</span></li>{/each}</ul>
        {:else}<p class="muted">No days well above your normal.</p>{/if}
      </div>
    </div>
  {:else if m}
    <div class="empty">Unusual half hours and days will be flagged here once readings arrive.</div>
  {/if}
</section>
