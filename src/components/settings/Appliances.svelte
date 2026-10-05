<script>
  // What each appliance uses, and which three lead "Run it now or later?" on Now.
  import { onMount } from 'svelte';
  import { app, keep } from '../../state/app.svelte.js';
  import { store } from '../../lib/browser.js';
  import { ACTIVITIES } from '../../lib/analysis.js';
  let lead = $state(['wash', 'dish', 'dryer']);
  onMount(() => { lead = store.getJ('leadActs', ['wash', 'dish', 'dryer']); });
  function toggle(id, on){
    lead = on ? [...lead.filter(x => x !== id), id].slice(-3) : lead.filter(x => x !== id);
    store.setJ('leadActs', lead);
  }
  function setK(id, v){
    const a = ACTIVITIES.find(x => x.id === id), n = parseFloat(v);
    const acts = { ...app.acts };
    if (!(n >= 0) || n === a.kwh) delete acts[id]; else acts[id] = n;
    app.acts = acts; keep('acts');
  }
</script>

<section class="card" id="appliances">
  <h2 class="label">Appliances</h2>
  <p class="note">Tick up to three to lead "Run it now or later?" on Now. Change the kWh if yours uses more or less.</p>
  <ul class="rows">
    {#each ACTIVITIES as a}
      <li>
        <label class="check" for="lead-{a.id}"><input id="lead-{a.id}" type="checkbox" checked={lead.includes(a.id)} onchange={ev => toggle(a.id, ev.target.checked)}> {a.label}</label>
        <span class="kwh"><input id="kwh-{a.id}" type="number" min="0" step="0.01" inputmode="decimal" aria-label="{a.label}, kWh" value={app.acts[a.id] ?? a.kwh} onchange={ev => setK(a.id, ev.target.value)}><span>kWh</span></span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .rows li{padding:var(--s1) 0}
  .check{min-width:0;flex:1}
  .kwh{display:flex;align-items:center;gap:6px;font:500 12px/1 var(--f-mono);color:var(--muted)}
  .kwh input{width:76px;min-height:40px;padding:0 8px;border-radius:var(--radius-sm);border:1px solid var(--line-hot);background:var(--card-2);font:500 15px/1 var(--f-mono);text-align:right}
</style>
