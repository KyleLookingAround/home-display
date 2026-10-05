<script>
  // The cheapest and greenest time to start an appliance.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { ACTIVITIES, cheapestWindow } from '../lib/analysis.js';
  import { currentRates } from '../lib/octopus.js';
  import { DOW, dayKey, hhmm, gbp, sum } from '../lib/format.js';
  onMount(boot);
  const timed = ACTIVITIES.filter(a => a.hours);
  let choice = $state(timed[0].id);
  const a = $derived(timed.find(x => x.id === choice) || timed[0]);
  const slots = $derived(Math.max(1, Math.round(a.hours * 2)));
  const k = $derived(+(app.acts[a.id] ?? a.kwh));
  const now = $derived(app.now), when = t => (dayKey(t) === dayKey(app.now) ? '' : DOW[new Date(t).getDay()] + ' ') + hhmm(t);
  const ag = $derived(app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to)) : []);
  const cheap = $derived.by(() => {
    if (!ag.length) return null;
    const best = cheapestWindow(ag, slots), i = ag.findIndex(r => r.from <= now && now < r.to);
    const nowAvg = i >= 0 && i + slots <= ag.length ? sum(ag.slice(i, i + slots).map(r => r.p)) / slots : null;
    return best ? { best, nowAvg } : null;
  });
  const green = $derived(app.carbonFc && app.carbonFc.length ? cheapestWindow(app.carbonFc.map(r => ({ from: r.from, to: r.to, p: r.v })), slots) : null);
  const er = $derived(app.eRateNow), rates = $derived(app.raw ? currentRates(app.raw.eSets) : null);
</script>

<section class="panel">
  <p class="panel-eyebrow">Launch window</p><h2>Best time to run</h2>
  <div class="inputs"><div class="field"><label for="bestSel">Appliance</label><select id="bestSel" bind:value={choice}>{#each timed as t}<option value={t.id}>{t.label}</option>{/each}</select></div></div>
  <div class="chips">
    {#if cheap}<div class="chip"><span class="v">{when(cheap.best.from)}</span><span class="k">Cheapest start on Agile · {gbp(k * cheap.best.avg)}{cheap.nowAvg != null ? ` vs ${gbp(k * cheap.nowAvg)} if you start now` : ''}</span></div>{/if}
    {#if green}<div class="chip"><span class="v">{when(green.from)}</span><span class="k">Greenest start · about {Math.round(k * green.avg)} g of CO₂</span></div>{/if}
    {#if er != null}<div class="chip"><span class="v">{gbp(k * er)}</span><span class="k">{rates && rates.twoRate ? 'On your day rate. Night rate is cheaper after 00:30.' : 'On your tariff now. Any time costs the same.'}</span></div>{/if}
    {#if !cheap && !green && er == null}<div class="empty">Waiting for prices.</div>{/if}
  </div>
</section>
