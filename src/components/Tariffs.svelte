<script>
  // Your tariffs: rates, standing charges, meter points and region, for electricity and gas.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { currentRates, regionOf } from '../lib/octopus.js';
  import { REGIONS, longDate } from '../lib/format.js';
  import Example from './Example.svelte';
  onMount(boot);

  const cards = $derived(app.raw ? [
    { fuel: 'electricity', cls: 'elec', label: 'Electricity', id: 'MPAN', pt: app.raw.elecPts[0], sets: app.raw.eSets },
    { fuel: 'gas', cls: 'gas', label: 'Gas', id: 'MPRN', pt: app.raw.gasPts[0], sets: app.raw.gSets }
  ].map(c => {
    if (!c.pt) return c;
    const r = currentRates(c.sets), code = (r && r.code) || (c.pt.agreement && c.pt.agreement.tariff_code) || '—', rg = regionOf(code);
    return { ...c, r, code, rg, since: c.pt.agreement && c.pt.agreement.valid_from ? new Date(c.pt.agreement.valid_from) : null,
             rates: r ? (r.twoRate ? [['Day rate', r.day], ['Night rate', r.night]] : [['Unit rate', r.unit]]) : null };
  }) : []);
</script>

<div class="grid2">
  {#each cards as c}
    <div class="panel">
      <p class="fuel {c.cls}">{c.label}{#if c.pt}<Example />{/if}</p>
      {#if !c.pt}
        <p class="muted">No {c.label.toLowerCase()} supply is listed on this account.</p>
      {:else}
        <div style="display:grid;gap:2px"><p class="tname">{(c.r && c.r.name) || '—'}</p><p class="muted mono" style="font-size:12px">{c.code}</p></div>
        {#if c.rates}
          <div class="rates">
            {#each c.rates as [k, v]}<div class="rate"><span class="v">{v == null ? '—' : v.toFixed(2)}<small>p/kWh</small></span><span class="k">{k}</span></div>{/each}
            <div class="rate"><span class="v">{c.r.standing == null ? '—' : c.r.standing.toFixed(2)}<small>p/day</small></span><span class="k">Standing charge</span></div>
          </div>
        {:else}<p class="muted">No current tariff found.</p>{/if}
        <dl class="meta">
          <dt>{c.id}</dt><dd>{c.pt.id}</dd><dt>Meter</dt><dd>{c.pt.serials.join(', ') || '—'}</dd>
          {#if c.since}<dt>On tariff since</dt><dd>{longDate(c.since)}</dd>{/if}
          {#if c.fuel === 'electricity' && REGIONS[c.rg]}<dt>Region</dt><dd>{c.rg} · {REGIONS[c.rg]}</dd>{/if}
        </dl>
        {#if c.fuel === 'gas' && !app.demo && app.gasUnit === 'm3'}<p class="muted small">Readings converted from m³ to kWh.</p>{/if}
      {/if}
    </div>
  {/each}
</div>
