<script>
  // How much of your gas goes on heating, and what the measures ticked could save. With none ticked, the cheap ones.
  import { onMount } from 'svelte';
  import { app, keep } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { MEASURES, insulationPlan } from '../../lib/analysis.js';
  import { kwh, gbp0, pct, nz } from '../../lib/format.js';
  import Upgrade from './Upgrade.svelte';
  onMount(boot);
  const START = ['loft', 'draught', 'flow'];
  const chosen = $derived(app.measures.length ? app.measures : START);
  const gr = $derived(nz(app.gRateNow, 7));
  const p = $derived(app.reg ? insulationPlan(app.reg, chosen, gr) : null);
  function tick(id, on){ app.measures = on ? [...new Set([...chosen, id])] : chosen.filter(x => x !== id); keep('measures'); }
  const line = $derived(!p ? 'Needs about ten days of gas readings in cool weather.' : `${app.measures.length ? 'What you ticked' : 'Loft top-up, draught-proofing and a lower boiler flow'} could cut your heating by about ${pct(p.cutShare)}.`);
</script>

<Upgrade id="insulation" title="Insulation and heating" {line} saving={p ? p.savedP : null} cost={p ? p.cost : null} example={app.demo} waiting={!app.raw}>
  {#if p}<p class="note">In a typical year heating uses about {kwh(p.year.heat)} of gas ({gbp0(p.year.heat * gr)}), and hot water and cooking another {kwh(p.year.base)}. The ticked measures save about {kwh(p.saved)} at today's gas price.</p>{/if}
  <div class="measures">
    {#each MEASURES as m}
      <label class="check" for="m-{m.id}"><input id="m-{m.id}" type="checkbox" checked={chosen.includes(m.id)} onchange={ev => tick(m.id, ev.target.checked)}>
        <span class="main-t"><span>{m.label}</span><span class="sub">About {Math.round(m.cut * 100)}% less heating · {m.cost ? 'roughly ' + gbp0(m.cost) : 'free'}</span></span></label>
    {/each}
  </div>
  <p class="note">Savings and costs are rules of thumb for a terraced house. Measures overlap, so they're combined rather than added. An estimate: get quotes.</p>
</Upgrade>

<style>
  .measures{display:grid}
  .measures .check{align-items:flex-start;padding:var(--s2) 0;border-top:1px solid var(--line)}
  .measures .check input{margin-top:2px;flex:none}
  .main-t{display:grid;gap:2px}
  .sub{font-size:13px;color:var(--muted)}
</style>
