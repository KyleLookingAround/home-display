<script>
  // Anything worth knowing about soon: plunge pricing, a Saving Session, tomorrow's prices arriving.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { cheapestWindow } from '../../lib/analysis.js';
  import { hhmm, pence, fmtDate, dayKey, startOfDay, addDays } from '../../lib/format.js';
  onMount(boot);
  const items = $derived.by(() => {
    const out = [], now = app.now, all = app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to)) : [];
    const neg = all.filter(r => r.to > now && r.p < 0);
    if (neg.length) out.push({ tone: 'neg', title: `Paid to use power ${dayKey(neg[0].from) === dayKey(now) ? 'today' : fmtDate(new Date(neg[0].from))} from ${hhmm(neg[0].from)}`, sub: `${neg.length} half hour${neg.length > 1 ? 's' : ''} below zero, as low as ${pence(Math.min(...neg.map(r => r.p)))}` });
    const tomorrow = +addDays(startOfDay(new Date(now)), 1), tm = all.filter(r => r.from >= tomorrow);
    if (tm.length >= 40 && new Date(now).getHours() >= 16){ const b = cheapestWindow(tm, 4, tomorrow); if (b) out.push({ tone: 'cheap', title: 'Tomorrow\'s prices are in', sub: `Cheapest ${hhmm(b.from)}–${hhmm(b.to)}, ${pence(b.avg)} on average` }); }
    const ss = app.rewards && app.rewards.sessions ? (app.rewards.sessions.events || []).filter(e => +new Date(e.endAt) > now) : [];
    ss.slice(0, 2).forEach(e => out.push({ tone: 'gas', title: `Saving Session ${fmtDate(new Date(e.startAt))} ${hhmm(e.startAt)}–${hhmm(e.endAt)}`, sub: e.rewardPerKwhInOctoPoints ? `${e.rewardPerKwhInOctoPoints} Octopoints per kWh saved` : 'Use less than usual then, for Octopoints' }));
    return out;
  });
</script>

{#if items.length}
  <section class="card">
    <h2 class="label">Coming up</h2>
    <ul class="rows">
      {#each items as it}<li><span class="main-t"><span class={it.tone}>{it.title}</span><span class="sub">{it.sub}</span></span></li>{/each}
    </ul>
  </section>
{/if}
