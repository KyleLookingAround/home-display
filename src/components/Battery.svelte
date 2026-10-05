<script>
  // A home battery replayed against your readings: it charges in cheap half hours and covers your use later that day.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { simulateBattery } from '../lib/analysis.js';
  import { unitPriceAt, lookup } from '../lib/octopus.js';
  import { clamp, gbp, gbp0 } from '../lib/format.js';
  onMount(boot);
  let cap = $state(5), pow = $state(3), eff = $state(90), cost = $state(4000), tariff = $state('agile');
  const opts = $derived.by(() => {
    const o = [{ v: 'current', l: 'Your tariff now' }];
    if (app.compareOpts) app.compareOpts.forEach(x => o.push({ v: x.id, l: x.label }));
    else if (app.raw && app.raw.agileHist) o.push({ v: 'agile', l: 'Agile' });
    return o;
  });
  const id = $derived(opts.some(o => o.v === tariff) ? tariff : (opts.find(o => o.v === 'agile') ? 'agile' : 'current'));
  const r = $derived.by(() => {
    const raw = app.raw; if (!raw) return null;
    const opt = app.compareOpts && app.compareOpts.find(o => o.id === id);
    const priceAt = id === 'current' ? t => unitPriceAt(raw.eSets, t) : opt ? t => lookup(opt.unit, t) : t => lookup(raw.agileHist && raw.agileHist.unit, t);
    return simulateBattery(raw, priceAt, +cap || 5, +pow || 3, clamp((+eff || 90) / 100, 0.5, 1));
  });
  const pay = $derived(r && r.year > 0 ? (+cost || 0) * 100 / r.year : null);
</script>

<section class="panel">
  <p class="panel-eyebrow">Power cell simulation</p><h2>Home battery</h2>
  <p class="muted small">Replays your readings: the battery charges in cheap half hours and covers your use later in the same day. One cycle a day, so treat it as an estimate.</p>
  <div class="inputs">
    <div class="field"><label for="bCap">Usable capacity (kWh)</label><input id="bCap" type="number" min="1" step="0.5" bind:value={cap}></div>
    <div class="field"><label for="bPow">Power (kW)</label><input id="bPow" type="number" min="0.5" step="0.5" bind:value={pow}></div>
    <div class="field"><label for="bEff">Round-trip efficiency (%)</label><input id="bEff" type="number" min="50" max="100" step="1" bind:value={eff}></div>
    <div class="field"><label for="bCost">Installed cost (£)</label><input id="bCost" type="number" min="0" step="100" bind:value={cost}></div>
    <div class="field"><label for="bTariff">Tariff</label><select id="bTariff" value={id} onchange={ev => { tariff = ev.target.value; }}>{#each opts as o}<option value={o.v}>{o.l}</option>{/each}</select></div>
  </div>
  {#if !app.raw}
  {:else if !r}<div class="empty">Needs electricity readings, and prices for the chosen tariff, to simulate a battery.</div>
  {:else if r.saved < 100}<p class="small">On this tariff a battery saves almost nothing, because the price is the same all day. A battery pays off with a time-of-use tariff such as Agile, Go or Flux, or alongside solar panels.</p>
  {:else}
    <div class="chips">
      <div class="chip"><span class="v good">{gbp0(r.year)}</span><span class="k">Saved a year, about{app.demo ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">{pay ? pay.toFixed(1) + ' years' : '—'}</span><span class="k">To pay back {gbp0((+cost || 0) * 100)}</span></div>
      <div class="chip"><span class="v">{r.cycledPerDay.toFixed(1)} kWh</span><span class="k">Shifted per day on average</span></div>
    </div>
    <p class="muted small">From {r.days} days of your readings, saving {gbp(r.saved)} against {gbp(r.base)} of unit costs. Excludes standing charges, battery wear and any export income.</p>
  {/if}
</section>
