<script>
  // A home battery replayed against your readings: it charges in cheap half hours and covers your use later that day.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { simulateBattery } from '../../lib/analysis.js';
  import { unitPriceAt, lookup } from '../../lib/octopus.js';
  import { clamp, gbp } from '../../lib/format.js';
  import Upgrade from './Upgrade.svelte';
  onMount(boot);
  let cap = $state(5), pow = $state(3), eff = $state(90), cost = $state(4000), tariff = $state('agile');
  const opts = $derived.by(() => {
    const o = [{ v: 'current', l: 'Your tariff now' }];
    if (app.compareOpts) app.compareOpts.forEach(x => o.push({ v: x.id, l: x.label }));
    else if (app.raw && app.raw.agileHist) o.push({ v: 'agile', l: 'Agile' });
    return o;
  });
  const id = $derived(opts.some(o => o.v === tariff) ? tariff : (opts.find(o => o.v === 'agile') ? 'agile' : 'current'));
  const label = $derived((opts.find(o => o.v === id) || opts[0]).l);
  const r = $derived.by(() => {
    const raw = app.raw; if (!raw || !raw.elec.length) return null;
    const opt = app.compareOpts && app.compareOpts.find(o => o.id === id);
    const priceAt = id === 'current' ? t => unitPriceAt(raw.eSets, t) : opt ? t => lookup(opt.unit, t) : t => lookup(raw.agileHist && raw.agileHist.unit, t);
    return simulateBattery(raw, priceAt, +cap || 5, +pow || 3, clamp((+eff || 90) / 100, 0.5, 1));
  });
  const line = $derived(!r ? 'Needs electricity readings to try a battery.' : r.saved < 100 ? `On ${id === 'current' ? 'your tariff' : label} a battery saves almost nothing: the price is the same all day.`
    : `A ${+cap || 5} kWh battery on ${id === 'current' ? 'your tariff' : label}, charging when power is cheap.`);
</script>

<Upgrade id="battery" title="Home battery" {line} saving={r ? Math.max(0, r.year) : null} cost={(+cost || 0) * 100} example={app.demo} waiting={!app.raw}>
  <div class="inline-fields">
    <div class="field"><label for="bCap">Usable capacity (kWh)</label><input id="bCap" type="number" min="1" step="0.5" bind:value={cap}></div>
    <div class="field"><label for="bPow">Power (kW)</label><input id="bPow" type="number" min="0.5" step="0.5" bind:value={pow}></div>
    <div class="field"><label for="bEff">Round trip (%)</label><input id="bEff" type="number" min="50" max="100" step="1" bind:value={eff}></div>
    <div class="field"><label for="bCost">Installed cost (£)</label><input id="bCost" type="number" min="0" step="100" bind:value={cost}></div>
  </div>
  <div class="field"><label for="bTariff">Tariff</label><select id="bTariff" value={id} onchange={ev => { tariff = ev.target.value; }}>{#each opts as o}<option value={o.v}>{o.l}</option>{/each}</select>
    {#if !app.compareOpts}<span class="help">Price every tariff under Tariffs to try the battery on Go, Cosy and the rest.</span>{/if}</div>
  {#if r && r.saved >= 100}
    <p class="note">Shifts {r.cycledPerDay.toFixed(1)} kWh a day on average. From {r.days} days of your readings, saving {gbp(r.saved)} on {gbp(r.base)} of unit costs. One cycle a day; leaves out standing charges, battery wear and export. An estimate.</p>
  {:else if r}<p class="note">A battery pays off with a time-of-use tariff such as Agile, Go or Flux, or alongside solar panels.</p>{/if}
</Upgrade>
