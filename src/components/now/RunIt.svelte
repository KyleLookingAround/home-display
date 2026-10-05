<script>
  // Run it now or later? The washing machine, dishwasher and tumble dryer by default (Settings changes them): what
  // a run costs now on Agile, and the cheapest start in the next day. Everything else folded underneath.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { store } from '../../lib/browser.js';
  import { ACTIVITIES, cheapestWindow } from '../../lib/analysis.js';
  import { gbp, hhmm, DOW, dayKey, sum } from '../../lib/format.js';
  let lead = $state(['wash', 'dish', 'dryer']);
  onMount(() => { lead = store.getJ('leadActs', ['wash', 'dish', 'dryer']); boot(); });
  const ag = $derived(app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to) && r.to > app.now) : []);
  const when = t => (dayKey(t) === dayKey(app.now) ? '' : DOW[new Date(t).getDay()] + ' ') + hhmm(t);
  const kOf = a => +(app.acts[a.id] ?? a.kwh);
  const plan = a => {
    const slots = Math.max(1, Math.round((a.hours || 0.5) * 2)), k = kOf(a);
    if (!ag.length || a.fuel === 'g') return { k, now: a.fuel === 'g' ? (app.gRateNow != null ? k * app.gRateNow : null) : (app.eRateNow != null ? k * app.eRateNow : null), best: null };
    const nowAvg = ag.length >= slots ? sum(ag.slice(0, slots).map(r => r.p)) / slots : null, best = cheapestWindow(ag, slots, app.now);
    return { k, now: nowAvg != null ? k * nowAvg : null, best: best ? { at: best.from, cost: k * best.avg } : null };
  };
  const rows = $derived(lead.map(id => ACTIVITIES.find(a => a.id === id)).filter(Boolean).map(a => ({ a, p: plan(a) })));
  const rest = $derived(ACTIVITIES.filter(a => lead.indexOf(a.id) < 0).map(a => ({ a, p: plan(a) })));
</script>

<section class="card">
  <div class="card-head"><h2 class="label">Run it now or later?</h2><a href="./settings.html#appliances">Change</a></div>
  <ul class="rows">
    {#each rows as { a, p }}
      <li><span class="main-t"><span>{a.label}</span><span class="sub">{p.now != null ? `${gbp(p.now)} if you start now` : 'Waiting for prices'}</span></span>
        <span class="side">{#if p.best}<span class="cheap">{when(p.best.at)}</span><br><span class="muted small">{gbp(p.best.cost)}</span>{:else}—{/if}</span></li>
    {/each}
  </ul>
  <details class="fold">
    <summary>Everything else</summary>
    <ul class="rows">
      {#each rest as { a, p }}
        <li><span class="main-t"><span>{a.label}{#if a.fuel === 'g'}<span class="tag gas">Gas</span>{/if}</span><span class="sub">{p.k} kWh</span></span>
          <span class="side">{p.now != null ? gbp(p.now) : '—'}{#if p.best}<br><span class="muted small">{gbp(p.best.cost)} at {when(p.best.at)}</span>{/if}</span></li>
      {/each}
    </ul>
  </details>
</section>
