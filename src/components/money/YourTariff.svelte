<script>
  // Your tariff in a line for each fuel, and when the price cap next changes.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { currentRates, regionOf } from '../../lib/octopus.js';
  import { nextCapChange } from '../../lib/analysis.js';
  import { REGIONS, longDate, shortDate } from '../../lib/format.js';
  onMount(boot);
  const cap = nextCapChange();
  const fuels = $derived(app.raw ? [
    { cls: 'elec', name: 'Electricity', id: 'MPAN', pt: app.raw.elecPts[0], r: currentRates(app.raw.eSets) },
    { cls: 'gas', name: 'Gas', id: 'MPRN', pt: app.raw.gasPts[0], r: currentRates(app.raw.gSets) }
  ].filter(f => f.pt) : []);
  const follows = $derived(app.raw ? !/AGILE|SILVER|FIX/.test((app.raw.eSets[0] && app.raw.eSets[0].code) || '') : true);
  const rate = r => r ? (r.twoRate ? `${r.day != null ? r.day.toFixed(2) : '—'}p day, ${r.night != null ? r.night.toFixed(2) : '—'}p night` : `${r.unit != null ? r.unit.toFixed(2) : '—'}p/kWh`) : '—';
</script>

<section class="card">
  <h2 class="label">Your tariff</h2>
  <ul class="rows">
    {#each fuels as f}
      <li><span class="main-t"><span class={f.cls}>{f.name}</span><span class="sub">{(f.r && f.r.name) || '—'}</span></span>
        <span class="side">{rate(f.r)}<br><span class="muted small">{f.r && f.r.standing != null ? f.r.standing.toFixed(2) + 'p a day' : ''}</span></span></li>
    {/each}
    <li><span class="main-t"><span>Price cap changes {longDate(cap.next)}</span><span class="sub">{follows ? 'Your tariff moves with it' : 'Your tariff doesn\'t follow it directly'} · Ofgem announces around {shortDate(cap.announce)}</span></span><span class="side">{cap.days} days</span></li>
  </ul>
  {#if fuels.length}
    <details class="fold">
      <summary>Meters and tariff codes</summary>
      <ul class="rows">
        {#each fuels as f}
          {@const code = (f.r && f.r.code) || (f.pt.agreement && f.pt.agreement.tariff_code) || '—'}
          <li><span class="main-t"><span>{f.name}</span><span class="sub mono">{f.id} {f.pt.id} · meter {f.pt.serials.join(', ') || '—'}</span><span class="sub mono">{code}{f.cls === 'elec' && REGIONS[regionOf(code)] ? ` · region ${regionOf(code)}, ${REGIONS[regionOf(code)]}` : ''}</span></span></li>
        {/each}
      </ul>
    </details>
  {/if}
</section>
