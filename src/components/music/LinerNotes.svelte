<script>
  /*
   * Liner notes: the release's front and back covers and booklet pages from the Cover Art Archive, to leaf through
   * (swipe, or the arrows), each labelled; tap one to open it full size.
   */
  import { music } from '../../state/music.svelte.js';
  import { artUrl } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  const t = $derived(music.track);
  const n = $derived(music.notes && music.notesFor === (t && t.id) ? music.notes : null);
  let strip = $state(null), at = $state(0);
  const onScroll = () => { if (strip) at = Math.round(strip.scrollLeft / strip.clientWidth); };
  const go = d => strip && strip.scrollTo({ left: (at + d) * strip.clientWidth, behavior: 'smooth' });
  const kind = types => types && types.length ? types.join(', ').replace('Front', 'Front cover').replace('Back', 'Back cover') : 'Artwork';
</script>

{#if t}
  {#if !n}
    <div class="loading"><span class="spin" aria-hidden="true"></span><p>Finding the sleeve and booklet…</p></div>
  {:else if n.length}
    <div class="notes">
      <div class="strip" bind:this={strip} onscroll={onScroll}>
        {#each n as im, i}
          <figure><a href={im.src} target="_blank" rel="noopener"><img src={im.thumb} alt="{kind(im.types)}, {i + 1} of {n.length}" loading={i < 2 ? 'eager' : 'lazy'}></a><figcaption>{kind(im.types)}</figcaption></figure>
        {/each}
      </div>
      <div class="pager">
        <button class="ib" type="button" aria-label="Previous page" disabled={at <= 0} onclick={() => go(-1)}><Icon name="back" /></button>
        <span class="mono count">{at + 1} of {n.length}</span>
        <button class="ib fwd" type="button" aria-label="Next page" disabled={at >= n.length - 1} onclick={() => go(1)}><Icon name="back" /></button>
      </div>
      <p class="credit">From the Cover Art Archive. Tap a page to see it full size.</p>
    </div>
  {:else}
    <div class="none">
      {#if t.images.length}<img src={artUrl(t.images, 300)} alt="">{/if}
      <p>No scans of this release's sleeve or booklet in the Cover Art Archive yet.</p>
    </div>
  {/if}
{/if}

<style>
  .notes{display:grid;gap:10px}
  .strip{display:grid;grid-auto-flow:column;grid-auto-columns:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:12px}
  .strip::-webkit-scrollbar{display:none}
  figure{margin:0;scroll-snap-align:center;display:grid;gap:8px;justify-items:center}
  figure a{display:block;width:100%}
  figure img{width:100%;height:auto;max-height:56vh;object-fit:contain;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.55);display:block}
  figcaption{font:600 13px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:rgba(233,236,255,.65)}
  .pager{display:flex;justify-content:center;align-items:center;gap:14px}
  .ib{appearance:none;border:0;background:rgba(255,255,255,.07);color:var(--ink);width:42px;height:42px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
  .ib:disabled{opacity:.3;cursor:default}
  .fwd :global(.ic){transform:rotate(180deg)}
  .count{font-size:13px;color:rgba(233,236,255,.7)}
  .credit{margin:0;font-size:12px;color:rgba(233,236,255,.45);text-align:center}
  .loading,.none{display:grid;justify-items:center;gap:12px;text-align:center;color:rgba(233,236,255,.65);padding:8vh 16px}
  .none img{width:160px;border-radius:8px;opacity:.85}
  .loading p,.none p{margin:0;max-width:30ch}
  .spin{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:var(--tint,var(--gas));animation:spin .9s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){ .spin{animation:none} }
</style>
