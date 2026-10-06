<script>
  /*
   * Your listening: your top artists and songs as Spotify counts them (four weeks, six months, all time), and, from
   * the plays this phone has kept (Spotify only shares your last 50), when you listen round the clock and every day
   * as a calendar.
   */
  import { onMount, untrack } from 'svelte';
  import { music, sp, play, haptic } from '../../state/music.svelte.js';
  import { disc, recordPlays, peek } from '../../state/discover.svelte.js';
  import { trackOf } from '../../lib/music.js';
  import { listeningClock, listeningDays, topArtists } from '../../lib/discover.js';
  import { slotLabel } from '../../lib/format.js';
  import ClockFace from '../charts/ClockFace.svelte';
  import HeatMap from '../charts/HeatMap.svelte';
  import Tile from './Tile.svelte';
  import TrackRow from './TrackRow.svelte';

  const RANGES = [['short_term', '4 weeks'], ['medium_term', '6 months'], ['long_term', 'All time']];
  let range = $state('short_term'), top = $state.raw({}), err = $state('');
  async function load(r){
    if (top[r]) return;
    try {
      const [a, t] = await Promise.all([sp().top('artists', r, 12), sp().top('tracks', r, 20)]);
      top = Object.assign({}, top, { [r]: { artists: (a && a.items) || [], tracks: ((t && t.items) || []).map(trackOf).filter(Boolean) } });
    } catch (e){ err = 'Spotify didn\'t share your top artists just now.'; }
  }
  $effect(() => { const r = range, a = music.acc; untrack(() => { if (a) load(r); }); });
  onMount(() => { peek().then(() => recordPlays()); });

  const now = Date.now(), WEEK = 7 * 864e5;
  const log = $derived(disc.log || []);
  const clock = $derived(listeningClock(log, now - 90 * 864e5));
  const busiest = $derived(clock.indexOf(Math.max(...clock)));
  const days = $derived(listeningDays(log, now));
  const week = $derived(log.filter(p => p.t > now - WEEK).reduce((s, p) => s + (p.ms || 180000), 0) / 60e3);
  const weekTop = $derived(topArtists(log, now - WEEK, 1)[0]);
  const since = $derived(log.length ? new Date(log[0].t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  let sel = $state(null);
  const cur = $derived(top[range]);
  const mins = m => m >= 120 ? Math.round(m / 60) + ' hours' : Math.round(m) + ' minutes';
</script>

<section class="answer">
  <span class="label">Your listening{music.acc ? ' · ' + music.acc.name.split(' ')[0] : ''}</span>
  {#if log.length}
    <span class="big">{mins(week)} this week</span>
    <span class="line">{weekTop ? 'Mostly ' + weekTop.name + ', ' + weekTop.plays + (weekTop.plays === 1 ? ' play' : ' plays') : 'Nothing played this week yet'}</span>
  {:else}<span class="big">Your top artists and songs</span><span class="line muted">As Spotify counts them, and when you listen.</span>{/if}
</section>

<div class="seg" role="group" aria-label="Over">
  {#each RANGES as [id, l]}<button type="button" aria-pressed={range === id} onclick={() => { haptic(); range = id; }}>{l}</button>{/each}
</div>

{#if err}<p class="note">{err}</p>{/if}
{#if cur}
  {#if cur.artists.length}
    <section class="card">
      <h2 class="label">Top artists</h2>
      <ol class="grid">{#each cur.artists.slice(0, 6) as a, i (a.id)}<li><span class="rank mono">{i + 1}</span><Tile images={a.images} title={a.name} round href="#artist/{a.id}" /></li>{/each}</ol>
    </section>
  {/if}
  {#if cur.tracks.length}
    <section class="card">
      <div class="card-head"><h2 class="label">Top songs</h2><button class="link" type="button" onclick={() => { haptic(); play({ uris: cur.tracks.map(t => t.uri) }); }}>Play them</button></div>
      <ul class="list">{#each cur.tracks.slice(0, 10) as t, i (t.id)}<TrackRow {t} num={i + 1} onplay={() => play({ uris: cur.tracks.map(x => x.uri), offset: i })} />{/each}</ul>
    </section>
  {/if}
{:else if !err}<div class="skel" style="height:320px"></div>{/if}

<section class="card">
  <h2 class="label">When you listen</h2>
  {#if log.length >= 5}
    <ClockFace values={clock} bind:selected={sel} marks={false} colour="var(--gas)" fmt={v => v + ' min'} centre={slotLabel(busiest)} centreSub="busiest" aria="Minutes listened by time of day, the last 90 days" />
  {:else}<p class="note">This fills in as you listen. Spotify only shares your last 50 songs, so this phone keeps them each time the app opens.</p>{/if}
</section>
{#if days.length >= 7}
  <section class="card">
    <h2 class="label">Every day</h2>
    <HeatMap {days} colour="79,214,255" fmt={v => v + ' min'} aria="Minutes listened each day, as a calendar" />
  </section>
{/if}
{#if log.length}<p class="note">{log.length} plays kept on this phone since {since}. They stay here; nothing is sent anywhere.</p>{/if}

<style>
  .grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s3)}
  @media (min-width:700px){ .grid{grid-template-columns:repeat(6,minmax(0,1fr))} }
  .grid li{position:relative}
  .rank{position:absolute;left:-2px;top:-2px;z-index:1;width:24px;height:24px;border-radius:50%;background:var(--gas);color:#04101a;font-size:12px;display:grid;place-items:center;box-shadow:0 4px 10px rgba(0,0,0,.4)}
  .list{list-style:none;margin:0;padding:0}
  .link{appearance:none;border:0;background:none;color:var(--gas);font:inherit;font-size:14px;cursor:pointer;padding:6px 0}
  .seg{align-self:start}
</style>
