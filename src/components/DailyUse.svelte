<script>
  // Daily electricity and gas, in £ or kWh, with the changes from your log marked.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { fmtTick, shortDate, fmtDate, kwh, gbp } from '../lib/format.js';
  import BarChart from './BarChart.svelte';
  onMount(boot);
  let sel = $state(null);
  const m = $derived(app.model), money = $derived(app.unit === 'gbp');
  const has = $derived(m && (m.tot.nE || m.tot.nG));
  const marks = $derived.by(() => {
    if (!m) return [];
    const idx = new Map(m.days.map((d, i) => [d.k, i]));
    return app.changelog.filter(c => idx.has(c.date)).map(c => ({ i: idx.get(c.date), text: c.text }));
  });
  const def = $derived.by(() => { if (!m) return 0; let d = m.days.length - 1; while (d > 0 && !m.days[d].eHas && !m.days[d].gHas) d--; return d; });
  const items = $derived(m ? m.days.map(d => ({ label: shortDate(d.date), segs: [{ v: money ? d.ec / 100 : d.e, cls: 'bar-e' }, { v: money ? d.gc / 100 : d.g, cls: 'bar-g' }] })) : []);
  $effect(() => { app.days; sel = null; });
  const read = $derived.by(() => {
    if (!m || sel == null || !m.days[sel]) return '';
    const d = m.days[sel];
    const e = d.eHas ? `Electricity ${kwh(d.e)} · ${gbp(d.ec)}` : 'Electricity: no readings';
    const g = d.gHas ? `Gas ${kwh(d.g)} · ${gbp(d.gc)}` : 'Gas: no readings';
    return `${fmtDate(d.date)} — ${e} — ${g}${app.changelog.filter(c => c.date === d.k).map(c => ` · ◆ ${c.text}`).join('')}`;
  });
</script>

<section class="panel">
  <div class="panel-head">
    <div><p class="panel-eyebrow">Telemetry · per day</p><h2>Daily use</h2><p class="muted small">Tap a day for the breakdown. Purple lines are changes from your log on the Home page.</p></div>
    <div class="seg" role="group" aria-label="Show">
      <button type="button" aria-pressed={app.unit === 'gbp'} onclick={() => { app.unit = 'gbp'; }}>£</button><button type="button" aria-pressed={app.unit === 'kwh'} onclick={() => { app.unit = 'kwh'; }}>kWh</button>
    </div>
  </div>
  <div class="legend"><span><i style="background:var(--elec)"></i>Electricity</span><span><i style="background:var(--gas)"></i>Gas</span></div>
  {#if m && !has}
    <div class="chart"><div class="empty">Daily electricity and gas will appear once your smart meter readings come through.</div></div>
  {:else}
    <BarChart items={items} aria={`Daily ${money ? 'cost' : 'energy use'}`} defaultSel={def} {marks} yFmt={v => (money ? '£' : '') + fmtTick(v)} bind:selected={sel} empty="Receiving…" />
  {/if}
  <p class="readline">{read}</p>
</section>
