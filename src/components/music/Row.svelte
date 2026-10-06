<script>
  // A row of covers to scroll sideways, with its title and "Show all". Snaps to each cover; arrows on a laptop.
  let { title, all = null, alt = null, children } = $props();
  let strip = $state(null);
  const by = d => strip && strip.scrollBy({ left: d * strip.clientWidth * .8, behavior: 'smooth' });
</script>

<section class="row">
  <header><h3>{title}</h3>
    <span class="act">
      <button class="arr" type="button" aria-label="Scroll {title} back" onclick={() => by(-1)}>‹</button><button class="arr" type="button" aria-label="Scroll {title} on" onclick={() => by(1)}>›</button>
      {#if alt}<a href={alt.href}>{alt.label}</a>{/if}{#if all}<a href={all}>Show all</a>{/if}
    </span>
  </header>
  <div class="strip" bind:this={strip}>{@render children()}</div>
</section>

<style>
  .row{display:grid;gap:10px;min-width:0}
  header{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  h3{margin:0;font:700 19px/1.2 var(--f-body);letter-spacing:-.01em}
  .act{display:flex;align-items:center;gap:6px}
  a{font:600 13px var(--f-body);color:var(--muted);text-decoration:none;padding:6px 0 6px 6px}
  a:hover{color:var(--ink)}
  .arr{display:none;appearance:none;width:32px;height:32px;border-radius:50%;border:1px solid var(--line-hot);background:var(--card-2);color:var(--ink);font:600 18px/1 var(--f-body);cursor:pointer}
  @media (hover:hover) and (min-width:700px){ .arr{display:inline-grid;place-items:center} }
  .strip{display:grid;grid-auto-flow:column;grid-auto-columns:min(42%,160px);gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
    margin:0 calc(-1 * var(--s4));padding:2px var(--s4) 6px;scroll-padding:0 var(--s4)}
  .strip::-webkit-scrollbar{display:none}
  .strip > :global(*){scroll-snap-align:start}
  @media (min-width:900px){ .strip{margin:0;padding:2px 0 6px;scroll-padding:0} }
</style>
