<script>
  // The next twelve hours: price, the cheapest two hours, grid carbon, rain, your next event and train. Then all of
  // today and tomorrow, folded.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchHouse } from '../../state/house.js';
  import { voyageFor } from '../../lib/voyage.js';
  import { cheapestWindow } from '../../lib/analysis.js';
  import { hhmm, pence, startOfDay, addDays } from '../../lib/format.js';
  import Strip from '../charts/Strip.svelte';
  onMount(() => watchHouse({ bins: false }));
  const v = $derived(voyageFor({ agile: app.agileToday && app.agileToday.unit, carbon: app.carbonFc, weather: app.weather, events: app.events, trains: app.trains, walk: app.house ? app.house.trainWalk : 0 }, app.now));
  const markers = $derived([
    ...v.waypoints.map(w => ({ t: w.t, kind: 'event', label: w.title })),
    ...(v.train ? [{ t: v.train.sched, kind: 'train', label: `${hhmm(v.train.sched)} to ${v.train.dest}` }] : [])
  ]);
  const all = $derived(app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to)) : []);
  const dayFrom = $derived(+startOfDay(new Date(app.now))), dayTo = $derived(all.length ? Math.max(...all.map(r => r.to)) : +addDays(startOfDay(new Date(app.now)), 1));
  const best48 = $derived(all.length >= 4 ? cheapestWindow(all, 4, app.now) : null);
</script>

<section class="card">
  <div class="card-head"><h2 class="label">The next 12 hours</h2>{#if v.dock}<span class="small cheap">Cheapest {hhmm(v.dock.from)}–{hhmm(v.dock.to)} · {pence(v.dock.avg)}</span>{/if}</div>
  {#if v.range}
    <Strip from={v.from} to={v.to} rates={v.range} carbon={app.carbonFc || []} cheap={v.dock} fronts={v.fronts} {markers} now={app.now} />
    <div class="legend"><span><i style="background:var(--cheap)"></i>Under 15p</span><span><i style="background:var(--normal)"></i>15–25p</span><span><i style="background:var(--peak)"></i>25p and over</span><span><i style="background:var(--neg)"></i>Below zero</span><span>Band underneath: grid carbon</span></div>
    <details class="fold">
      <summary>Today and tomorrow</summary>
      <Strip from={dayFrom} to={dayTo} rates={all} carbon={app.carbonFc || []} cheap={best48} height={170} aria="Agile prices today and tomorrow" now={app.now} />
      <p class="note">Tomorrow's prices usually arrive around 4pm.</p>
    </details>
  {:else}
    <div class="skel" style="height:150px"></div>
  {/if}
</section>
