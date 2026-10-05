<script>
  // What the period used and cost.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { kwh, gbp } from '../lib/format.js';
  onMount(boot);
  const t = $derived(app.model ? app.model.tot : null);
  const per = (v, n, f) => n ? f(v / n) + ' a day' : 'No readings yet';
</script>

{#if t}
  <div class="totals">
    <div class="stat"><span class="k"><i style="background:var(--elec);color:var(--elec)"></i>Electricity used</span><span class="v">{t.nE ? kwh(t.e) : '—'}</span><span class="s">{per(t.e, t.nE, kwh)}</span></div>
    <div class="stat"><span class="k"><i style="background:var(--elec);color:var(--elec)"></i>Electricity cost</span><span class="v">{t.nE ? gbp(t.ec) : '—'}</span><span class="s">{per(t.ec, t.nE, gbp)}</span></div>
    <div class="stat"><span class="k"><i style="background:var(--gas);color:var(--gas)"></i>Gas used</span><span class="v">{t.nG ? kwh(t.g) : '—'}</span><span class="s">{per(t.g, t.nG, kwh)}</span></div>
    <div class="stat"><span class="k"><i style="background:var(--gas);color:var(--gas)"></i>Gas cost</span><span class="v">{t.nG ? gbp(t.gc) : '—'}</span><span class="s">{per(t.gc, t.nG, gbp)}</span></div>
    <div class="stat total"><span class="k">Total cost</span><span class="v">{t.nE || t.nG ? gbp(t.ec + t.gc) : '—'}</span><span class="s">{app.demo ? 'Example figures' : 'Inc. VAT and standing charges'}</span></div>
  </div>
{/if}
