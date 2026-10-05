<script>
  // Solar panels on your roof against your average day: what they'd make, what you'd use, what you'd export.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { simulateSolar } from '../../lib/analysis.js';
  import { loadExportRates } from '../../lib/octopus.js';
  import { loadPVGIS } from '../../lib/pvgis.js';
  import { SOLAR_SOUTH, SOLAR_NORTH, MON, kwh, pct, pence, nz } from '../../lib/format.js';
  import Upgrade from './Upgrade.svelte';
  import Bars from '../charts/Bars.svelte';

  let south = $state(4), north = $state(4), watt = $state(430), angle = $state(35), batt = $state(0), cost = $state(6000);
  let exportRates = $state.raw(null), exportId = $state(''), pv = $state.raw(null), sel = $state(null);
  onMount(async () => {
    await boot();
    if (app.demo) exportRates = [{ id: 'outFix', label: 'Outgoing Fixed (example)', rate: 15 }, { id: 'agileOut', label: 'Agile Outgoing (example average)', rate: 12 }];
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
  const kwp = $derived(((+south || 0) + (+north || 0)) * (+watt || 430) / 1000);
  const r = $derived.by(() => {
    if (!m || !m.profDays) return null;
    const sy = usePv ? pv.south : SOLAR_SOUTH, ny = usePv ? pv.north : SOLAR_NORTH;
    const monthly = sy.map((v, i) => v * (+south || 0) * (+watt || 430) / 1000 + ny[i] * (+north || 0) * (+watt || 430) / 1000);
    return simulateSolar({ profile: m.profile, monthlyKwh: monthly, importP: nz(app.eRateNow, 25), exportP: exp.rate, batteryKwh: +batt || 0 });
  });
  const items = $derived(r ? r.months.map(x => ({ label: MON[x.m], segs: [{ v: x.used, cls: 'bar-e' }, { v: x.exported, cls: 'bar-n' }] })) : []);
  const tip = i => r && r.months[i] ? `${MON[r.months[i].m]}: ${kwh(r.months[i].gen)} made, ${kwh(r.months[i].used)} used, ${kwh(r.months[i].exported)} sold` : '';
  const line = $derived(r ? `${kwp.toFixed(1)} kWp on the roof would make about ${Math.round(r.gen).toLocaleString('en-GB')} kWh a year, and you'd use ${pct(r.useShare)} of it.` : 'Needs electricity readings to match panels to when you use power.');
</script>

<Upgrade id="solar" title="Solar panels" {line} saving={r ? r.savedP : null} cost={(+cost || 0) * 100} example={app.demo} waiting={!app.raw}>
  <div class="inline-fields">
    <div class="field"><label for="sSouth">South-facing panels</label><input id="sSouth" type="number" min="0" step="1" bind:value={south}></div>
    <div class="field"><label for="sNorth">North-facing panels</label><input id="sNorth" type="number" min="0" step="1" bind:value={north}></div>
    <div class="field"><label for="sWatt">Watts a panel</label><input id="sWatt" type="number" min="100" step="5" bind:value={watt}></div>
    <div class="field"><label for="sAngle">Roof pitch (°)</label><input id="sAngle" type="number" min="0" max="70" step="1" bind:value={angle} onchange={loadPV}></div>
    <div class="field"><label for="sBatt">Battery (kWh)</label><input id="sBatt" type="number" min="0" step="0.5" bind:value={batt}></div>
    <div class="field"><label for="sCost">Installed cost (£)</label><input id="sCost" type="number" min="0" step="100" bind:value={cost}></div>
  </div>
  <div class="field"><label for="sExport">Selling to the grid</label><select id="sExport" value={exp.id} onchange={ev => { exportId = ev.target.value; }}>{#each ex as e}<option value={e.id}>{e.label} · {pence(e.rate)}{e.variable ? ' average' : ''}</option>{/each}</select></div>
  {#if r}
    <Bars {items} height={170} aria="Solar each month: used at home and sold" defaultSel={5} tipText={tip} bind:selected={sel} />
    <p class="readout">{tip(sel)}</p>
    <div class="legend"><span><i style="background:var(--elec)"></i>Used at home</span><span><i style="background:var(--neg)"></i>Sold to the grid</span></div>
    <p class="note">Your average day all year ({m.insights ? m.insights.perDay.toFixed(1) : '—'} kWh), power at {pence(nz(app.eRateNow, 25))} and selling at {pence(exp.rate)}. {usePv ? 'Sunshine from PVGIS for your roof pitch.' : 'Typical Stockport sunshine.'} North-facing panels make about half as much. An estimate: get a survey and quotes.</p>
  {/if}
</Upgrade>
