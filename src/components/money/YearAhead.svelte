<script>
  // The year ahead at today's prices, and whether the Direct Debit covers it.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { store } from '../../lib/browser.js';
  import { annualProjection } from '../../lib/analysis.js';
  import { gbp0 } from '../../lib/format.js';
  let dd = $state('');
  onMount(() => { dd = store.get('dd') || ''; boot(); });
  const a = $derived(app.raw ? annualProjection(app.raw, app.reg) : null);
  const amount = $derived(parseFloat(dd));
  const diff = $derived(a && amount > 0 ? amount * 1200 - a.total : null);
</script>

<section class="card">
  <h2 class="label">Direct Debit</h2>
  {#if diff != null}
    {#if Math.abs(diff) < 6000}<p class="line good">Your {gbp0(amount * 100)} a month looks about right.</p>
    {:else if diff > 0}<p class="line warn">At {gbp0(amount * 100)} a month you'd build up about {gbp0(diff)} of credit over a year.</p>
    {:else}<p class="line bad">At {gbp0(amount * 100)} a month you'd fall about {gbp0(-diff)} short over a year.</p>{/if}
  {:else if a}<p class="line muted">Add your monthly Direct Debit to check it against the year ahead.</p>{/if}
  <div class="field"><label for="dd">Monthly Direct Debit (£)</label><input id="dd" type="number" min="0" step="1" inputmode="decimal" placeholder="e.g. 120" bind:value={dd} oninput={() => store.set('dd', dd)}></div>
  <h2 class="label">The year ahead</h2>
  {#if a}
    <div class="stats two">
      <div class="stat"><span class="v">{gbp0(a.total)}</span><span class="k">A year, roughly{app.demo ? ' (example)' : ''}</span></div>
      <div class="stat"><span class="v">{gbp0(a.total / 12)}</span><span class="k">A month, on average</span></div>
      <div class="stat"><span class="v elec">{gbp0(a.elecP)}</span><span class="k">Electricity</span></div>
      <div class="stat"><span class="v gas">{gbp0(a.gasP)}</span><span class="k">Gas</span></div>
    </div>
    <p class="note">{a.gasMethod === 'weather' ? 'Gas follows how your use rises in the cold and Stockport\'s usual weather, so winter is included.' : a.gasMethod === 'recent' ? 'Gas is from the last 30 days, so it reads low until winter shows in your data.' : ''} At today's prices: a price cap change will move it.</p>
  {:else if app.raw}<p class="note">Needs a few weeks of readings.</p>{/if}
</section>

<style>.line{font-size:17px}</style>
