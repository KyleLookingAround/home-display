<script>
  /*
   * The record shelf: your saved albums to flip through like a crate. The one in front faces you; the ones either
   * side turn away. Swipe or use the arrows; tap the one in front to open it, or play it from underneath.
   */
  import { artUrl } from '../../lib/music.js';
  import { play, haptic } from '../../state/music.svelte.js';
  import Icon from './Icon.svelte';
  let { albums = [] } = $props();
  let strip = $state(null), at = $state(0), w = $state(1);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onScroll(){
    if (!strip) return;
    const item = strip.firstElementChild ? strip.firstElementChild.offsetWidth : 1;
    w = item; at = strip.scrollLeft / item;
  }
  const go = d => { if (!strip) return; const i = Math.max(0, Math.min(albums.length - 1, Math.round(at) + d)); strip.scrollTo({ left: i * w, behavior: still ? 'auto' : 'smooth' }); haptic(); };
  const style = i => { const d = i - at, a = Math.max(-1, Math.min(1, d)); return `transform:perspective(900px) translateZ(${-Math.min(2, Math.abs(d)) * 70}px) rotateY(${-a * 55}deg);z-index:${100 - Math.round(Math.abs(d) * 10)};opacity:${Math.max(.25, 1 - Math.abs(d) * .25)}`; };
  const front = $derived(albums[Math.max(0, Math.min(albums.length - 1, Math.round(at)))]);
  $effect(() => { albums; onScroll(); });

  const key = e => { if (e.key === 'ArrowRight'){ e.preventDefault(); go(1); } if (e.key === 'ArrowLeft'){ e.preventDefault(); go(-1); } };
</script>

<div class="shelf" tabindex="0" role="group" aria-label="Your albums, as a record shelf" onkeydown={key}>
  <div class="strip" bind:this={strip} onscroll={onScroll}>
    {#each albums as a, i (a.id)}
      <a class="sleeve" href="#album/{a.id}" style={style(i)} aria-label="{a.name} by {(a.artists || []).map(x => x.name).join(', ')}" tabindex={Math.round(at) === i ? 0 : -1}>
        <img src={artUrl(a.images, 300)} alt="" draggable="false" loading={Math.abs(i - at) < 4 ? 'eager' : 'lazy'}>
        <span class="refl" aria-hidden="true" style="background-image:url({artUrl(a.images, 300)})"></span>
      </a>
    {/each}
  </div>
  {#if front}
    <div class="caption">
      <button class="ib" type="button" aria-label="Previous album" onclick={() => go(-1)}><Icon name="back" /></button>
      <div class="ct"><b>{front.name}</b><span>{(front.artists || []).map(x => x.name).join(', ')}{front.release_date ? ' · ' + String(front.release_date).slice(0, 4) : ''}</span></div>
      <button class="ib fwd" type="button" aria-label="Next album" onclick={() => go(1)}><Icon name="back" /></button>
    </div>
    <div class="acts"><button class="playbig" type="button" aria-label="Play {front.name}" onclick={() => { haptic(); play({ context: front.uri }); }}><Icon name="play" size={26} /></button></div>
  {/if}
</div>

<style>
  .shelf{display:grid;gap:14px;outline:none}
  .strip{display:grid;grid-auto-flow:column;grid-auto-columns:min(56vw,240px);overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
    padding:24px calc(50% - min(28vw,120px)) 56px;margin:0 calc(-1 * var(--s4))}
  .strip::-webkit-scrollbar{display:none}
  .sleeve{position:relative;scroll-snap-align:center;display:block;transition:transform .08s linear;transform-style:preserve-3d;-webkit-tap-highlight-color:transparent}
  .sleeve img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);display:block;box-shadow:0 20px 40px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06)}
  .refl{position:absolute;left:0;right:0;top:100%;height:40%;background-size:100% 250%;background-position:bottom;transform:scaleY(-1);opacity:.18;
    mask-image:linear-gradient(transparent 20%,#000);-webkit-mask-image:linear-gradient(transparent 20%,#000);border-radius:4px;pointer-events:none}
  .caption{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;text-align:center}
  .ct{display:grid;gap:2px;min-width:0}
  .ct b{font:700 16px/1.3 var(--f-display);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ct span{color:var(--muted);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ib{appearance:none;border:1px solid var(--line);background:var(--card);color:var(--ink);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
  .fwd :global(.ic){transform:rotate(180deg)}
  .acts{display:flex;justify-content:center}
  .playbig{appearance:none;border:0;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--gas);color:#04101a;box-shadow:0 0 24px rgba(79,214,255,.35)}

  @media (prefers-reduced-motion:reduce){ .sleeve{transition:none} }
</style>
