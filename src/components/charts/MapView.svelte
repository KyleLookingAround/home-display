<script>
  /*
   * A map: Esri's dark grey tiles (no labels), darkened, with our own on top: a route as a glowing line, stations, home, you, and a
   * train that moves. It fits `fit` (or every place) into its box. Map © Esri, © OpenStreetMap contributors.
   */
  import { fitView, onView, viewTiles, mapTile, MAP_CREDIT } from '../../lib/geo.js';
  let { places = [], route = [], walks = [], fit = null, height = 240, label = 'Map', min = 9, max = 15 } = $props();
  let width = $state(0);
  const view = $derived(width ? fitView(fit && fit.length ? fit : places.concat(route), width, height, 34, min, max) : null);
  const tiles = $derived(view ? viewTiles(view) : []);
  const line = $derived(view ? route.map(p => onView(view, p)).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') : '');
  const paths = $derived(view ? walks.map(w => w.map(p => onView(view, p)).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')) : []);
  // labels go on the right unless that's the edge (or the place says left)
  const marks = $derived(view ? places.map(p => { const q = onView(view, p); return { ...p, ...q, right: p.right === false ? false : p.right === true || q.x < width * 0.6 }; }) : []);
</script>

<div class="map" style="height:{height}px" bind:clientWidth={width} role="img" aria-label={label}>
  {#if view}
    {#each tiles as t (t.x + ':' + t.y + ':' + t.z)}<img src={mapTile(t)} alt="" style="left:{t.left}px;top:{t.top}px" loading="lazy" decoding="async">{/each}
    <svg width={width} height={height} viewBox="0 0 {width} {height}" aria-hidden="true">
      {#each paths as w}<polyline class="walk" points={w} />{/each}
      {#if line}<polyline class="glow" points={line} /><polyline class="route" points={line} />{/if}
      {#each marks as m}
        {#if m.kind === 'station'}
          <circle class="stn" class:big={m.major} cx={m.x} cy={m.y} r={m.major ? 5 : 3.5} />
        {:else if m.kind === 'home'}
          <g class="home" transform="translate({m.x},{m.y})"><path d="M-7 1 0-6 7 1M-5 0v6h10V0" /></g>
        {:else if m.kind === 'office'}
          <rect class="office" x={m.x - 5} y={m.y - 5} width="10" height="10" rx="2" />
        {:else if m.kind === 'you'}
          <circle class="you-ring" cx={m.x} cy={m.y} r="12" /><circle class="you" cx={m.x} cy={m.y} r="6" />
        {:else if m.kind === 'train'}
          <circle class="train-ring" cx={m.x} cy={m.y} r="14" /><circle class="train" cx={m.x} cy={m.y} r="8" />
          <path class="train-i" transform="translate({m.x - 5},{m.y - 5}) scale(.42)" d="M6 3h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM3 11h18M8 22l2-4m6 4-2-4" />
        {/if}
      {/each}
      {#each marks.filter(m => m.label) as m}
        <text class="lbl" class:strong={m.kind !== 'station' || m.major} x={m.x + (m.right ? 10 : -10)} y={m.y + 4} text-anchor={m.right ? 'start' : 'end'}>{m.label}</text>
      {/each}
    </svg>
  {/if}
  <span class="credit">{MAP_CREDIT}</span>
</div>

<style>
  .map{position:relative;width:100%;overflow:hidden;border-radius:var(--radius-sm);border:1px solid var(--line);background:#0b0d16}
  img{position:absolute;width:256px;height:256px;max-width:none;filter:brightness(.6) contrast(1.15)}
  svg{position:absolute;left:0;top:0}
  .route{fill:none;stroke:var(--elec);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
  .glow{fill:none;stroke:rgba(255,181,71,.28);stroke-width:10;stroke-linecap:round;stroke-linejoin:round}
  .walk{fill:none;stroke:var(--gas);stroke-width:2.5;stroke-dasharray:2 6;stroke-linecap:round;opacity:.9}
  .stn{fill:#0b0d16;stroke:var(--elec);stroke-width:2}
  .stn.big{stroke-width:2.5;fill:#1a1408}
  .home path{fill:none;stroke:var(--gas);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px var(--gas))}
  .office{fill:none;stroke:var(--neg);stroke-width:2}
  .you{fill:var(--gas);stroke:#04050d;stroke-width:2}
  .you-ring{fill:rgba(79,214,255,.18);stroke:none;animation:pulse 2s ease-out infinite;transform-box:fill-box;transform-origin:center}
  .train{fill:var(--elec);stroke:#04050d;stroke-width:2}
  .train-ring{fill:rgba(255,181,71,.22);stroke:none;animation:pulse 1.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
  .train-i{fill:none;stroke:#04050d;stroke-width:3.4;stroke-linecap:round}
  .lbl{font:500 12px var(--f-body);fill:var(--muted);paint-order:stroke;stroke:#04050d;stroke-width:3px;stroke-linejoin:round}
  .lbl.strong{fill:var(--ink);font-weight:600}
  .credit{position:absolute;right:6px;bottom:4px;font:10px/1 var(--f-mono);color:var(--faint);text-shadow:0 0 3px #000}
  @keyframes pulse{from{transform:scale(.6);opacity:1}to{transform:scale(1.6);opacity:0}}
  @media (prefers-reduced-motion: reduce){ .you-ring,.train-ring{animation:none} }
</style>
