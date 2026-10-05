<script>
  // Solar panels on your roof against your average day: what they'd make, what you'd use, what you'd export.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { simulateSolar } from '../lib/analysis.js';
  import { loadExportRates } from '../lib/octopus.js';
  import { loadPVGIS } from '../lib/pvgis.js';
  import { SOLAR_SOUTH, SOLAR_NORTH, MON, kwh, pct, gbp0, pence } from '../lib/format.js';
  import BarChart from './BarChart.svelte';

  let south = $state(4), north = $state(4), watt = $state(430), angle = $state(35), batt = $state(0), cost = $state(6000);
  let exportRates = $state.raw(null), exportId = $state(''), pv = $state.raw(null), sel = $state(null);
  onMount(async () => {
    await boot();
    if (app.demo) exportRates = [{ id: 'outFix', label: 'Outgoing Fixed (example)', rate: 15 }, { id: 'agileOut', label: 'Agile Outgoing (example avg)', rate: 12 }];
    else { try { exportRates = await loadExportRates(app.region); } catch { exportRates = []; } if (!exportRates.length) exportRates = [{ id: 'guess', label: 'Assumed 15p export', rate: 15 }]; }
    loadPV();
  });
  async function loadPV(){
    if (!app.proxy) return;
    const a = +angle || 35;
    try { pv = { south: await loadPVGIS(1, 0, a), north: await loadPVGIS(1, 180, a), angle: a }; } catch { pv = null; }
  }
  const ex = $derived(exportRates || [{ id: 'guess', label: 'Assumed 15p export', rate: 15 }]);
  const exp = $derived(ex.find(e => e.id === exportId) || ex[0]);
  const usePv = $derived(pv && pv.angle === (+angle || 35));
  const m = $derived(app.model);
  const r = $derived.by(() => {
    if (!m || !m.profDays) return null;
    const sy = usePv ? pv.south : SOLAR_SOUTH, ny = usePv ? pv.north : SOLAR_NORTH;
    const monthly = sy.map((v, i) => v * (+south || 0) * (+watt || 430) / 1000 + ny[i] * (+north || 0) * (+watt || 430) / 1000);
    return simulateSolar({ profile: m.profile, monthlyKwh: monthly, importP: app.eRateNow ?? 25, exportP: exp.rate, batteryKwh: +batt || 0 });
  });
  const items = $derived(r ? r.months.map(x => ({ label: MON[x.m], segs: [{ v: x.used, cls: 'bar-e' }, { v: x.exported, cls: 'bar-n' }] })) : []);
  const pay = $derived(r && r.savedP > 0 ? (+cost || 0) * 100 / r.savedP : null);
</script>

<section class="panel">
  <p class="panel-eyebrow">Solar array simulation</p><h2>Solar panels</h2>
  <p class="muted small">{usePv ? 'Uses your average day of electricity use and PVGIS sunshine data for Stockport.' : 'Uses your average day of electricity use and typical sunshine for Stockport. Run the page from your home server helper for PVGIS figures for your exact roof pitch.'}</p>
  <div class="inputs">
    <div class="field"><label for="sSouth">South-facing panels</label><input id="sSouth" type="number" min="0" step="1" bind:value={south}></div>
    <div class="field"><label for="sNorth">North-facing panels</label><input id="sNorth" type="number" min="0" step="1" bind:value={north}></div>
    <div class="field"><label for="sWatt">Watts per panel</label><input id="sWatt" type="number" min="100" step="5" bind:value={watt}></div>
    <div class="field"><label for="sAngle">Roof pitch (°)</label><input id="sAngle" type="number" min="0" max="70" step="1" bind:value={angle} onchange={loadPV}></div>
    <div class="field"><label for="sBatt">Battery (kWh, 0 for none)</label><input id="sBatt" type="number" min="0" step="0.5" bind:value={batt}></div>
    <div class="field"><label for="sCost">Installed cost (£)</label><input id="sCost" type="number" min="0" step="100" bind:value={cost}></div>
    <div class="field"><label for="sExport">Export rate</label><select id="sExport" value={exp.id} onchange={ev => { exportId = ev.target.value; }}>{#each ex as e}<option value={e.id}>{e.label} · {pence(e.rate)}{e.variable ? ' avg' : ''}</option>{/each}</select></div>
  </div>
  {#if m && !m.profDays}
    <div class="empty">Needs electricity readings to match panel output to when you use power.</div>
  {:else if r}
    <BarChart {items} aria="Monthly solar generation, used at home and exported" height={190} defaultSel={5} bind:selected={sel} />
    <p class="readline">{sel != null && r.months[sel] ? `${MON[r.months[sel].m]} — ${kwh(r.months[sel].gen)} generated · ${kwh(r.months[sel].used)} used at home · ${kwh(r.months[sel].exported)} exported` : ''}</p>
    <div class="legend"><span><i style="background:var(--elec)"></i>Used at home</span><span><i style="background:var(--nebula)"></i>Exported</span></div>
    <div class="chips">
      <div class="chip"><span class="v">{kwh(r.gen)}</span><span class="k">Generated a year from {(((+south || 0) + (+north || 0)) * (+watt || 430) / 1000).toFixed(2)} kWp</span></div>
      <div class="chip"><span class="v">{pct(r.useShare)}</span><span class="k">Used at home{+batt ? ', with the battery' : ''}</span></div>
      <div class="chip"><span class="v good">{gbp0(r.savedP)}</span><span class="k">Saved and earned a year{app.demo ? ' · example' : ''}</span></div>
      <div class="chip"><span class="v">{pay ? pay.toFixed(1) + ' years' : '—'}</span><span class="k">To pay back {gbp0((+cost || 0) * 100)}</span></div>
    </div>
    <p class="muted small">Assumes your current average day all year ({m.insights ? m.insights.perDay.toFixed(1) : '—'} kWh), electricity at {pence(app.eRateNow ?? 25)} and export at {pence(exp.rate)}. North-facing panels produce roughly half as much as south-facing ones. Get a quote and a roof survey before deciding.</p>
  {/if}
</section>
