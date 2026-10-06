<script>
  /*
   * The rain radar around home: RainViewer's last two hours of frames over a dark map, playing on a loop, with home
   * marked. Tap to pause on a frame. Map © Esri, © OpenStreetMap contributors; radar © RainViewer.
   */
  import { onMount } from 'svelte';
  import { HOME, hhmm } from '../../lib/format.js';
  import { tileOf, RADAR_ZOOM, baseTile, radarTile, BASE_CREDIT } from '../../lib/outdoors.js';
  let { radar = null, size = 300 } = $props();
  const z = RADAR_ZOOM, home = tileOf(HOME.lat, HOME.lon, z);
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: home.x + dx, y: home.y + dy, left: (dx + 1) * 256, top: (dy + 1) * 256 });
  // the 768px square of tiles, moved so home sits in the middle of what shows
  let width = $state(300);
  const shift = $derived({ x: width / 2 - (256 + home.fx * 256), y: size / 2 - (256 + home.fy * 256) });
  const frames = $derived(radar && radar.frames ? radar.frames.slice(-9) : []);
  // plays on a loop; tap to stop on a frame. Under reduced motion it shows the latest frame, still.
  let i = $state(0), held = $state(null), still = $state(false);
  const playing = $derived(held == null && !still);
  onMount(() => {
    still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setInterval(() => { if (playing && frames.length) i = (i + 1) % frames.length; }, 700);
    return () => clearInterval(id);
  });
  const shown = $derived(!frames.length ? -1 : held != null ? Math.min(held, frames.length - 1) : still ? frames.length - 1 : i % frames.length);
  const toggle = () => { if (still) return; held = held == null ? shown : null; };
</script>

<button class="radar" type="button" style="height:{size}px" bind:clientWidth={width} aria-label="Rain radar, {playing ? 'playing; tap to pause' : 'paused; tap to play'}" onclick={toggle}>
  <div class="tiles" style="transform:translate({shift.x}px,{shift.y}px)">
    {#each tiles as t}<img class="base" src={baseTile(z, t.x, t.y)} alt="" style="left:{t.left}px;top:{t.top}px" loading="lazy" decoding="async">{/each}
    {#each frames as f, k}
      {#each tiles as t}<img class="rain" class:on={k === shown} src={radarTile(radar.host, f.path, z, t.x, t.y)} alt="" style="left:{t.left}px;top:{t.top}px" loading="lazy" decoding="async">{/each}
    {/each}
  </div>
  <i class="home" aria-hidden="true"></i>
  {#if shown >= 0}<span class="when">{hhmm(frames[shown].t)}{frames[shown].ahead ? ' forecast' : ''}</span>{/if}
  <span class="credit">{BASE_CREDIT} · RainViewer</span>
</button>

<style>
  .radar{position:relative;display:block;width:100%;overflow:hidden;border-radius:var(--radius-sm);border:1px solid var(--line);background:#0b0d16;padding:0;cursor:pointer}
  .tiles{position:absolute;left:0;top:0;width:768px;height:768px}
  .tiles img{position:absolute;width:256px;height:256px;max-width:none}
  .tiles .base{filter:brightness(.6) contrast(1.15)}
  .tiles .rain{opacity:0;transition:opacity .25s}
  .tiles .rain.on{opacity:.85}
  .home{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--elec);box-shadow:0 0 0 3px rgba(255,181,71,.3),0 0 12px var(--elec)}
  .when{position:absolute;left:8px;top:8px;font:500 12px/1 var(--f-mono);background:rgba(4,6,18,.75);padding:5px 7px;border-radius:6px;color:var(--ink)}
  .credit{position:absolute;right:6px;bottom:4px;font:10px/1 var(--f-mono);color:var(--faint)}
  @media (prefers-reduced-motion: reduce){ .tiles .rain{transition:none} }
</style>
