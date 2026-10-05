<script>
  // This month so far, where it's heading, and last month for comparison.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { monthProjection, buildModelRange } from '../../lib/analysis.js';
  import { gbp0, gbp, MON } from '../../lib/format.js';
  onMount(boot);
  const p = $derived(app.raw ? monthProjection(app.raw) : null);
  const last = $derived.by(() => {
    if (!app.raw) return null;
    const d = new Date(app.now), from = new Date(d.getFullYear(), d.getMonth() - 1, 1), to = new Date(d.getFullYear(), d.getMonth(), 1);
    const m = buildModelRange(app.raw, from, to);
    return m.nE || m.nG ? { total: m.ec + m.gc, month: MON[from.getMonth()], full: m.nE >= 27 || m.nG >= 27 } : null;
  });
  const max = $derived(Math.max(1, p ? p.projected : 0, last ? last.total : 0));
</script>

<section class="answer">
  {#if p && p.daysSoFar && p.soFar > 0}
    <p class="label">{p.month} so far{app.demo ? ' · example' : ''}</p>
    <p class="figure">{gbp0(p.soFar)}</p>
    <p class="line">On track for <b class="elec">{gbp0(p.projected)}</b>{#if last}{' · '}{last.month} was {gbp0(last.total)}{last.full ? '' : ' (part)'}{/if}</p>
    <div class="bars" aria-hidden="true">
      <span class="k">{p.month}</span><div><span style="width:{p.soFar / max * 100}%" class="now"></span><span style="width:{(p.projected - p.soFar) / max * 100}%" class="ahead"></span></div>
      {#if last}<span class="k">{last.month}</span><div><span style="width:{last.total / max * 100}%" class="last"></span></div>{/if}
    </div>
    <p class="note">Based on your average of {gbp(p.avgDay)} a day over the last two weeks, including standing charges.</p>
  {:else if p}
    <p class="label">This month</p>
    <p class="line muted">Once this month has a day of readings, you'll see what you've spent and where it's heading.</p>
  {:else}
    <div class="skel" style="height:46px;width:50%"></div><div class="skel" style="height:20px;width:80%"></div>
  {/if}
</section>

<style>
  .bars{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:6px 10px;margin-top:4px}
  .k{font:500 12px/1 var(--f-mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
  .bars div{display:flex;height:10px;border-radius:5px;background:rgba(134,152,255,.08);overflow:hidden}
  .now{background:var(--elec)} .ahead{background:repeating-linear-gradient(90deg,rgba(255,181,71,.45) 0 4px,transparent 4px 7px)} .last{background:var(--muted);opacity:.6}
</style>
