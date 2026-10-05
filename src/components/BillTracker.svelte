<script>
  // This month so far and where it's heading, and whether the Direct Debit covers the year.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { store } from '../lib/browser.js';
  import { monthProjection, annualProjection } from '../lib/analysis.js';
  import { gbp, gbp0 } from '../lib/format.js';
  onMount(() => { dd = store.get('dd') || ''; boot(); });
  let dd = $state('');
  const p = $derived(app.raw ? monthProjection(app.raw) : null);
  const a = $derived(app.raw ? annualProjection(app.raw, app.reg) : null);
  const amount = $derived(parseFloat(dd));
  const diff = $derived(a && amount > 0 ? amount * 1200 - a.total : null);
</script>

<section class="panel">
  <p class="panel-eyebrow">Navigation · this month</p><h2>Bill tracker</h2>
  {#if p && p.daysSoFar && p.soFar > 0}
    <div class="chips">
      <div class="chip"><span class="v">{gbp(p.soFar)}</span><span class="k">{p.month} so far, {p.daysSoFar} day{p.daysSoFar > 1 ? 's' : ''}{app.demo ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">{gbp(p.projected)}</span><span class="k">On track for, by the end of {p.month}</span></div>
    </div>
    <p class="muted small">Based on your average of {gbp(p.avgDay)} a day over the last two weeks.</p>
  {:else if p}
    <div class="empty">Once this month has a day of readings, you'll see what you've spent so far and where it's heading.</div>
  {/if}
  <div class="inputs">
    <div class="field"><label for="ddAmount">Your monthly Direct Debit (£)</label><input id="ddAmount" type="number" min="0" step="1" inputmode="decimal" placeholder="e.g. 120" bind:value={dd} oninput={() => store.set('dd', dd)}></div>
  </div>
  <div class="prose">
    {#if !a}
      <p class="muted">Needs a few weeks of readings to project your year.</p>
    {:else}
      <p>Projected year: about <b>{gbp0(a.total)}</b> (electricity {gbp0(a.elecP)}, gas {gbp0(a.gasP)}), which is <b>{gbp0(a.total / 12)}</b> a month on average.</p>
      {#if diff != null}
        {#if Math.abs(diff) < 6000}<p class="good">Your {gbp0(amount * 100)} a month looks about right.</p>
        {:else if diff > 0}<p class="warn">At {gbp0(amount * 100)} a month you'd pay about {gbp0(diff)} more than you use over a year, building up credit.</p>
        {:else}<p class="bad">At {gbp0(amount * 100)} a month you'd fall about {gbp0(-diff)} short over a year.</p>{/if}
      {/if}
      <p class="muted small">{a.gasMethod === 'weather' ? 'Gas is projected using how your use responds to temperature and Stockport\'s typical weather, so winter is included.' : a.gasMethod === 'recent' ? 'Gas is projected from the last 30 days, so it will read low until winter shows up in your data.' : ''} Prices are today's, so a price cap change will move this.</p>
    {/if}
  </div>
</section>
