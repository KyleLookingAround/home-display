<script>
  /*
   * Your journey: the train that matters on a map, moving from its live times. Going in, the one that gets you to
   * work for your start; going home, the first once you finish; on other days, the next you can make. Once it has
   * left, it's followed until it gets you there. On Now (`compact`) it only shows from an hour before.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchHouse } from '../../state/house.js';
  import { jr, watchJourney } from '../../state/journey.svelte.js';
  import { journeyView, journeyLines, trainText, weatherThen } from '../../lib/geo.js';
  import { HOME, hhmm } from '../../lib/format.js';
  import MapView from '../charts/MapView.svelte';
  let { compact = false } = $props();
  onMount(() => { const a = watchHouse({ trains: true }); const b = watchJourney(); return () => { if (a) a(); b(); }; });

  const leg = $derived(app.trains && app.trains.leg);
  const d = $derived(jr.train);
  const idx = $derived(jr.index);
  const pos = $derived(jr.pos);
  const leaves = $derived(d ? d.exp || d.sched : 0);
  const show = $derived(!!(leg && d && idx && (!compact || leaves - app.now < 3600e3)));
  const j = $derived(journeyView(pos, leg, idx, HOME));
  const lines = $derived(journeyLines(j, pos));
  const town = $derived(leg && leg.end && (leg.work || app.now < leg.end) ? weatherThen(jr.town, leg.end, 'In town') : null);
</script>

{#if show}
  <section class="card journey">
    <div class="card-head"><h2 class="label">{j ? j.title : 'Your journey'}</h2>{#if pos && pos.late >= 1}<span class="small warn">{pos.late} min late</span>{:else if pos}<span class="small cheap">On time</span>{/if}</div>
    <MapView places={j ? j.places : []} route={j ? j.route : []} walks={j ? j.walks : []} fit={j ? j.fit : []} height={compact ? 200 : 260} label="Map of the journey: {d.dest} train{pos ? ', ' + trainText(pos) : ''}" />
    <p class="lead"><b class="mono">{hhmm(d.sched)}</b> to {d.dest}{d.platform ? ', platform ' + d.platform : ''}</p>
    {#if pos}<p class="now">{trainText(pos)}</p>
    {:else if jr.err}<p class="note">Its live position didn't load. Trying again.</p>
    {:else}<p class="note">Finding where it is…</p>{/if}
    {#each lines as l}<p class="sub">{l}</p>{/each}
    {#if town}<p class="sub" class:wet={town.rain >= 60}>{town.text}</p>{/if}
  </section>
{/if}

<style>
  .journey .lead{margin:var(--s3) 0 0;font-size:16px}
  .journey .now{margin:4px 0 0;font-weight:600;color:var(--elec)}
  .journey .sub{margin:4px 0 0;color:var(--muted)}
  .journey .wet{color:var(--gas)}
  .warn{color:var(--warn)}
</style>
