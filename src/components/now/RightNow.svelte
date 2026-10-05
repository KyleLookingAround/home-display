<script>
  // What the house is drawing, today so far, and how green the grid is, from the Home Mini and National Grid.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchLive, watchHouse } from '../../state/house.js';
  import { todayCost } from '../../lib/household.js';
  import { errorText } from '../../lib/net.js';
  import { kwh, gbp, hhmm } from '../../lib/format.js';
  import Dial from '../charts/Dial.svelte';
  onMount(() => { watchHouse({ grid: true }); return watchLive(); });
  const L = $derived(app.live);
  const w = $derived(L && L.demand != null ? Math.max(0, L.demand) : null);
  const cost = $derived(L && L.rows && app.raw ? todayCost(L.rows, app.raw.eSets, app.now) : null);
  const ci = $derived(app.carbonFc ? app.carbonFc.find(r => r.from <= app.now && app.now < r.to) : null);
  const ciTone = $derived(ci ? (/low/.test(ci.index) ? 'cheap' : /high/.test(ci.index) ? 'peak' : 'normal') : '');
</script>

<section class="card">
  <h2 class="label">Right now</h2>
  <div class="stats">
    <div class="stat">
      {#if w != null}<Dial frac={Math.min(1, Math.sqrt(w / 6000))} value="{Math.round(w).toLocaleString('en-GB')} W" label="Drawing now" />
        <span class="v">{Math.round(w).toLocaleString('en-GB')} W</span><span class="k">Drawing now{L.at ? ' · ' + hhmm(L.at) : ''}</span>
      {:else}<span class="v">—</span><span class="k">{app.demo ? 'Live draw needs your account' : app.liveState === 'looking' ? 'Looking for a Home Mini…' : app.liveState === 'none' ? 'No Home Mini on your account' : app.liveErr ? errorText(app.liveErr)[0] : 'Drawing now'}</span>{/if}
    </div>
    <div class="stat">
      <span class="v">{L && L.today != null ? kwh(L.today) : '—'}</span>
      <span class="k">Today so far{cost != null ? ' · ' + gbp(cost) : ''}</span>
    </div>
    <div class="stat">
      <span class="v {ciTone}">{ci ? ci.v + ' g' : '—'}</span>
      <span class="k">{ci ? `Grid carbon, ${ci.index}` : 'Grid carbon'}{app.gridMix ? ` · ${app.gridMix.mix[0].perc.toFixed(0)}% ${app.gridMix.mix[0].name.toLowerCase()}` : ''}</span>
    </div>
  </div>
  {#if app.gridMix}
    <div class="mix" role="img" aria-label="North West power now: {app.gridMix.mix.map(f => `${f.name} ${Math.round(f.perc)}%`).join(', ')}">
      {#each app.gridMix.mix as f}<i class={f.fuel} style="flex:{f.perc}" title="{f.name} {Math.round(f.perc)}%"></i>{/each}
    </div>
    <p class="legend">{#each app.gridMix.mix.slice(0, 4) as f}<span><i class={f.fuel}></i>{f.name} {Math.round(f.perc)}%</span>{/each}</p>
    <p class="note">The North West's power now: {app.gridMix.renewable}% from wind, sun and water, {app.gridMix.lowCarbon}% low carbon counting nuclear.</p>
  {/if}
</section>

<style>
  .mix{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px;margin-top:var(--s3)}
  .mix i{min-width:2px}
  .wind{background:#4fd6ff} .solar{background:#ffd166} .hydro{background:#2f7bff} .nuclear{background:#b892ff} .biomass{background:#46e6a1}
  .gas{background:#ff8a5c} .coal{background:#6c7399} .imports{background:#9aa2c8} .other{background:#6c7399}
</style>
