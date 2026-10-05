<script>
  // How much of your gas goes on heating, and what the measures you tick could save.
  import { onMount } from 'svelte';
  import { app, keep } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { MEASURES, insulationPlan } from '../lib/analysis.js';
  import { kwh, gbp0, pct } from '../lib/format.js';
  import Example from './Example.svelte';
  onMount(boot);
  const gr = $derived(app.gRateNow ?? 7);
  const p = $derived(app.reg ? insulationPlan(app.reg, app.measures, gr) : null);
  function tick(id, on){ app.measures = on ? [...new Set([...app.measures, id])] : app.measures.filter(x => x !== id); keep('measures'); }
</script>

<section class="panel">
  <p class="panel-eyebrow">Hull integrity</p><h2>Insulation and heating plan</h2>
  <p class="muted small">Based on how your gas use rises as it gets colder. The savings per measure are rough rules of thumb, so check them against your EPC.</p>
  <div class="measures">
    {#each MEASURES as m}
      <label class="check" for="m-{m.id}"><span><input id="m-{m.id}" type="checkbox" checked={app.measures.includes(m.id)} onchange={ev => tick(m.id, ev.target.checked)}> {m.label}</span><span>−{Math.round(m.cut * 100)}% heating</span></label>
    {/each}
  </div>
  <div class="prose">
    {#if !p}
      {#if app.raw}<div class="empty">Needs about 10 days of gas readings to estimate how much of your gas goes on heating.</div>{/if}
    {:else}
      <p>In a typical year your heating uses about <b>{kwh(p.year.heat)}</b> of gas ({gbp0(p.year.heat * gr)}), plus <b>{kwh(p.year.base)}</b> for hot water and cooking.<Example /></p>
      {#if app.measures.length}<p>The ticked measures could cut heating by about <b>{pct(p.cutShare)}</b>: roughly <b>{kwh(p.saved)}</b> and <b>{gbp0(p.savedP)}</b> a year at today's gas price.</p>
      {:else}<p class="muted">Tick the measures you're considering to see the combined saving.</p>{/if}
    {/if}
  </div>
</section>
