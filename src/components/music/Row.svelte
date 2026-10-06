<script>
  // A card holding a row of covers to scroll sideways, with its label and "Show all". Snaps to each cover; arrows on a laptop.
  let { title, all = null, alt = null, children } = $props();
  let strip = $state(null);
  const by = d => strip && strip.scrollBy({ left: d * strip.clientWidth * .8, behavior: 'smooth' });
</script>

<section class="card row">
  <div class="card-head"><h2 class="label">{title}</h2>
    <span class="act">
      <button class="arr icon-btn" type="button" aria-label="Scroll {title} back" onclick={() => by(-1)}>‹</button><button class="arr icon-btn" type="button" aria-label="Scroll {title} on" onclick={() => by(1)}>›</button>
      {#if alt}<a href={alt.href}>{alt.label}</a>{/if}{#if all}<a href={all}>Show all</a>{/if}
    </span>
  </div>
  <div class="strip" bind:this={strip}>{@render children()}</div>
</section>

<style>
  .act{display:flex;align-items:center;gap:var(--s3)}
  .arr{display:none;width:32px;height:32px;font:500 18px/1 var(--f-body)}
  @media (hover:hover) and (min-width:700px){ .arr{display:inline-grid} }
  .strip{display:grid;grid-auto-flow:column;grid-auto-columns:min(40%,150px);gap:var(--s3);overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
    margin:0 calc(-1 * var(--s4));padding:2px var(--s4) 4px;scroll-padding:0 var(--s4)}
  .strip::-webkit-scrollbar{display:none}
  .strip > :global(*){scroll-snap-align:start}
</style>
