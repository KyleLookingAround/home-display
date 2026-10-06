<script>
  /*
   * Get me home, from wherever you are: the nearest stations with trains that call at yours, the walk to each, the
   * first you can make, and when you'd be home. Asks where the phone is just this once if location isn't on.
   */
  import { app } from '../../state/app.svelte.js';
  import { loadTrainsLive } from '../../lib/household.js';
  import { loadStations, waysHome } from '../../lib/geo.js';
  import { hhmm } from '../../lib/format.js';
  import MapView from '../charts/MapView.svelte';
  let busy = $state(false), res = $state.raw(null), msg = $state(''), here = $state.raw(null), index = $state.raw(null);

  function position(){
    if (app.here && Date.now() - app.here.at < 2 * 60e3) return Promise.resolve(app.here);
    return new Promise((ok, no) => {
      if (!navigator.geolocation) return no(new Error('none'));
      navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }), no, { maximumAge: 60e3, timeout: 20e3 });
    });
  }
  async function go(){
    const s = app.house;
    if (!s || !s.trainFrom){ msg = 'Choose your station in Settings, Household first.'; return; }
    busy = true; msg = ''; res = null;
    try {
      here = await position();
      index = await loadStations();
      res = await waysHome(here, index, s.trainFrom, +s.trainWalk || 0, Date.now(), loadTrainsLive);
      if (!res.near && !res.ways.length) msg = 'No stations within 15 km of here.';
      else if (!res.near && !res.ways[0].train) msg = 'No trains to ' + index[s.trainFrom].name + ' from the stations near here in the next hour or so.';
    } catch (e){
      msg = e && e.code === 1 ? 'Your browser didn\'t share where you are. Allow location for this site and try again.' : 'That didn\'t work: ' + (e && e.message ? e.message : 'no signal') + '. Try again.';
    }
    busy = false;
  }
  const home = $derived(index && app.house ? index[app.house.trainFrom] : null);
  const best = $derived(res && !res.near ? res.ways.filter(w => w.train)[0] : null);
  const others = $derived(res && !res.near ? res.ways.filter(w => w.train && w !== best).slice(0, 3) : []);
  const places = $derived(here && home ? [{ lat: here.lat, lon: here.lon, kind: 'you' }, { ...home, kind: 'station', major: true, label: home.name }]
    .concat(best ? [{ ...best.station, kind: 'station', major: true, label: best.station.name }] : []) : []);
</script>

<section class="card" id="gethome">
  <h2 class="label">Get me home</h2>
  {#if res && res.near}
    <p class="big">You're a {res.walk} minute walk from {res.station.name}.</p>
    <p class="sub">Then your usual {app.house.trainWalk} minutes home.</p>
  {:else if best}
    <p class="big">Home about <b class="mono">{hhmm(best.home)}</b></p>
    <p class="sub">Walk {best.walk} min to {best.station.name}, then the <b class="mono">{hhmm(best.train.sched)}</b>{best.train.platform ? ' from platform ' + best.train.platform : ''} ({best.train.dest}), at {home ? home.name : 'your station'} {hhmm(best.train.arr)}, then your {app.house.trainWalk} minute walk.</p>
    {#if places.length}<MapView {places} route={home ? [best.station, home] : []} walks={[[here, best.station]]} height={180} label="Map: you, {best.station.name} and {home ? home.name : 'home'}" max={14} />{/if}
    {#if others.length}
      <ul class="rows">
        {#each others as w}<li><span class="main-t"><span>{w.station.name}</span><span class="sub">{w.walk} min walk · the {hhmm(w.train.sched)}</span></span><span class="side">Home {hhmm(w.home)}</span></li>{/each}
      </ul>
    {/if}
  {:else}
    <p class="note">From wherever you are: the nearest stations with trains to your station, the walk to each, the first you can make, and when you'd be home.</p>
  {/if}
  {#if msg}<p class="note" role="status">{msg}</p>{/if}
  <div class="actions"><button class="btn {res ? '' : 'primary'}" type="button" disabled={busy} onclick={go}>{busy ? 'Finding the way…' : res ? 'Again from here' : 'Get me home'}</button></div>
</section>

<style>
  .big{font-size:20px;margin:0 0 4px}
  .sub{color:var(--muted);margin:0 0 var(--s3)}
  .actions{margin-top:var(--s3)}
  .rows{margin-top:var(--s3)}
</style>
