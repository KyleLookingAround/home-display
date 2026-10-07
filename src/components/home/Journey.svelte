<script>
  /*
   * Your journey: the train that matters, where it is now (in words, first), on a map, and as a line of stops with
   * their times. Going in, the one that gets you to work for your start; going home, the first once you finish; on
   * other days, the next you can make. Once it has left, it's followed until it gets you there. On Now (`compact`)
   * it only shows from an hour before.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchHouse } from '../../state/house.js';
  import { jr, watchJourney, shareHome } from '../../state/journey.svelte.js';
  import { tv, watchTv } from '../../state/tv.svelte.js';
  import { journeyView, journeySteps, trainText, weatherThen } from '../../lib/geo.js';
  import { HOME, hhmm } from '../../lib/format.js';
  import MapView from '../charts/MapView.svelte';
  import JourneySteps from './JourneySteps.svelte';
  let { compact = false } = $props();
  onMount(() => { const a = watchHouse({ trains: true }); const b = watchJourney(); watchTv(); return () => { if (a) a(); b(); }; });

  const leg = $derived(app.trains && app.trains.leg);
  const d = $derived(jr.train);
  const pos = $derived(jr.pos);
  const leaves = $derived(d ? d.exp || d.sched : 0);
  const show = $derived(!!(leg && d && jr.index && (!compact || leaves - app.now < 3600e3)));
  const j = $derived(journeyView(pos, leg, jr.index, HOME));
  const line = $derived(journeySteps(j, pos, leg, app.now));
  const town = $derived(leg && leg.end && (leg.work || app.now < leg.end) ? weatherThen(jr.town, leg.end, 'In town') : null);
  const here = $derived(app.here && app.now - app.here.at < 5 * 60e3 + 60e3 ? [{ lat: app.here.lat, lon: app.here.lon, kind: 'you' }] : []);
</script>

{#if show}
  <section class="card journey">
    <div class="card-head">
      <h2 class="label">{j ? j.title : 'Your journey'}</h2>
      <span class="pill" class:late={pos && pos.late >= 1}>{hhmm(d.sched)}{d.platform ? ' · plat ' + d.platform : ''}{pos ? (pos.late >= 1 ? ' · ' + pos.late + ' min late' : ' · on time') : ''}</span>
    </div>
    <p class="now" aria-live="polite">{#if pos}{trainText(pos, true)}{:else if jr.err}Its live position didn't load. Trying again.{:else}Finding where it is…{/if}</p>
    <p class="to">The {hhmm(d.sched)} to {d.dest}</p>
    <MapView places={j ? j.places.concat(here) : []} route={j ? j.route : []} fit={j ? j.fit.concat(here) : []} height={compact ? 190 : 240} label="Map of the journey: {d.dest} train{pos ? ', ' + trainText(pos) : ''}" />
    {#if line}<JourneySteps steps={line.steps} at={line.at} />{/if}
    {#if town}<p class="town" class:wet={town.rain >= 60}><span aria-hidden="true">{town.rain >= 60 ? '☂' : town.rain >= 30 ? '☁' : '☀'}</span> {town.text}</p>{/if}
    {#if leg.home && tv.code}
      <div class="share">
        {#if jr.sharing}<span class="small on"><i aria-hidden="true"></i>{jr.shareNote || 'Telling the TV…'}</span><button class="btn small" type="button" onclick={() => shareHome(false)}>Stop telling the TV</button>
        {:else}<button class="btn small primary" type="button" onclick={() => shareHome(true)}>Show the TV I'm on my way</button>{/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .pill{font:500 12px/1 var(--f-mono);padding:5px 8px;border-radius:999px;border:1px solid rgba(70,230,161,.35);color:var(--good);white-space:nowrap}
  .pill.late{border-color:rgba(255,209,102,.4);color:var(--warn)}
  .now{margin:var(--s2) 0 0;font:600 18px/1.3 var(--f-body);color:var(--elec)}
  .to{margin:2px 0 var(--s3);color:var(--muted);font-size:14px}
  .town{margin:var(--s3) 0 0;color:var(--muted);font-size:14px}
  .town.wet{color:var(--gas)}
  .share{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s3);margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--line)}
  .share .on{display:inline-flex;align-items:center;gap:8px;color:var(--good)}
  .share .on i{width:8px;height:8px;border-radius:50%;background:var(--good);box-shadow:0 0 8px var(--good);animation:blip 1.6s ease-in-out infinite}
  @keyframes blip{50%{opacity:.35}}
  @media (prefers-reduced-motion: reduce){ .share .on i{animation:none} }
</style>
