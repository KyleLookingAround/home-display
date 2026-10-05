<script>
  // Every day of the period, in £ or kWh, with the period before behind it and your changes marked.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { compareOn } from '../../state/usage.svelte.js';
  import { shortDate, fmtDate, fmtTick, kwh, gbp } from '../../lib/format.js';
  import Bars from '../charts/Bars.svelte';
  onMount(boot);
  let sel = $state(null);
  const m = $derived(app.model), money = $derived(app.unit === 'gbp');
  const val = d => money ? (d.ec + d.gc) / 100 : d.e + d.g;
  const items = $derived(m ? m.days.map(d => ({ label: shortDate(d.date), segs: [{ v: money ? d.ec / 100 : d.e, cls: 'bar-e' }, { v: money ? d.gc / 100 : d.g, cls: 'bar-g' }] })) : []);
  const ghost = $derived(compareOn.on && compareOn.before ? compareOn.before.days.map(val) : null);
  const marks = $derived.by(() => { if (!m) return []; const idx = new Map(m.days.map((d, i) => [d.k, i])); return app.changelog.filter(c => idx.has(c.date)).map(c => ({ i: idx.get(c.date) })); });
  const def = $derived.by(() => { if (!m) return 0; let i = m.days.length - 1; while (i > 0 && !m.days[i].eHas && !m.days[i].gHas) i--; return i; });
  $effect(() => { app.days; sel = null; });
  const tipText = i => { const d = m.days[i]; return `${fmtDate(d.date)} · ${money ? gbp(d.ec + d.gc) : kwh(d.e + d.g)}`; };
  const read = $derived.by(() => {
    if (!m || sel == null || !m.days[sel]) return '';
    const d = m.days[sel], notes = app.changelog.filter(c => c.date === d.k).map(c => ` · ◆ ${c.text}`).join('');
    const before = ghost && ghost[sel] ? ` · period before ${money ? gbp(ghost[sel] * 100) : kwh(ghost[sel])}` : '';
    return `${fmtDate(d.date)}: electricity ${d.eHas ? kwh(d.e) + ' ' + gbp(d.ec) : 'no readings'}, gas ${d.gHas ? kwh(d.g) + ' ' + gbp(d.gc) : 'no readings'}${before}${notes}`;
  });
</script>

<section class="card">
  <div class="card-head">
    <h2 class="label">Every day</h2>
    <div class="seg" role="group" aria-label="Show"><button type="button" aria-pressed={money} onclick={() => { app.unit = 'gbp'; }}>£</button><button type="button" aria-pressed={!money} onclick={() => { app.unit = 'kwh'; }}>kWh</button></div>
  </div>
  {#if m && !m.tot.nE && !m.tot.nG}
    <p class="note">Daily use appears once your smart meter readings come through.</p>
  {:else}
    <Bars {items} {ghost} {marks} {tipText} defaultSel={def} bind:selected={sel} yFmt={v => (money ? '£' : '') + fmtTick(v)} aria="Daily {money ? 'cost' : 'use'}, electricity and gas" empty="Receiving…" />
    <p class="readout">{read}</p>
    <div class="legend"><span><i style="background:var(--elec)"></i>Electricity</span><span><i style="background:var(--gas)"></i>Gas</span>{#if ghost}<span><i style="border:1px dashed var(--muted)"></i>Period before</span>{/if}{#if marks.length}<span><i style="background:var(--cal);border-radius:50%"></i>Your changes</span>{/if}</div>
  {/if}
</section>
