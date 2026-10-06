<script>
  /*
   * Your commute in numbers, this year: the office days you've been in (logged on this phone), the miles by train,
   * the walking, the steps, and the CO₂ next to driving it. Estimates.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { store } from '../../lib/browser.js';
  import { loadStations, commuteStats } from '../../lib/geo.js';
  import { ukDate } from '../../lib/format.js';
  let index = $state.raw(null), log = $state.raw([]);
  onMount(() => { loadStations().then(i => { index = i; }, () => {}); });
  $effect(() => { if (app.house) log = store.getJ('officeLog', []); });   // read again once the settings are in, after today has been logged
  const year = $derived(new Date(app.now).getFullYear() + '-01-01');
  const st = $derived(app.house && app.house.trainTo && index ? commuteStats(log, app.house, index, year) : null);
  const n = x => Math.round(x).toLocaleString('en-GB');
</script>

{#if st && st.days}
  <section class="card">
    <h2 class="label">Your commute this year</h2>
    <div class="stats">
      <div class="stat"><span class="v">{st.days}</span><span class="k">Office {st.days === 1 ? 'day' : 'days'}</span></div>
      <div class="stat"><span class="v">{n(st.railMiles)}</span><span class="k">Miles by train</span></div>
      <div class="stat"><span class="v">{st.walkMins >= 120 ? (st.walkMins / 60).toFixed(1) + ' h' : st.walkMins + ' min'}</span><span class="k">Walking</span></div>
      <div class="stat"><span class="v">{n(st.steps)}</span><span class="k">Steps, about</span></div>
      <div class="stat"><span class="v">{st.co2Kg >= 10 ? n(st.co2Kg) : st.co2Kg.toFixed(1)} kg</span><span class="k">CO₂ less than driving</span></div>
    </div>
    <p class="note">Estimates, from the office days this phone has seen since {ukDate(st.first)}, there and back: the line's length, both walks, and an average car on the roads instead.</p>
  </section>
{/if}
