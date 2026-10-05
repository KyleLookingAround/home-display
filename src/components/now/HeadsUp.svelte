<script>
  // Anything to act on soon, before the rest of the page: a train to leave for, bins to put out, rain on its way.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchHouse } from '../../state/house.js';
  import { headsUp, BIN_COLOURS } from '../../lib/household.js';
  onMount(() => watchHouse());
  const items = $derived(headsUp({ trains: app.trains, walk: app.house ? app.house.trainWalk : 0, bins: app.collections || [], weather: app.weather, nowcast: app.nowcast, floods: app.floods }, app.now));
  const ICON = {
    train: '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2M9 16v4M15 16v4"/>',
    bins: '<path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15"/>',
    flood: '<path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M3 21c2 0 2-1.5 4.5-1.5S9.5 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21M12 3v9M8.5 8.5 12 12l3.5-3.5"/>',
    rain: '<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>'
  };
</script>

{#if items.length}
  <ul class="heads" aria-label="Heads-ups">
    {#each items as it}
      <li class="chip {it.tone}">
        <svg viewBox="0 0 24 24" aria-hidden="true">{@html ICON[it.kind]}</svg>
        <span class="t"><b>{it.title}</b><span class="sub">{it.sub}</span></span>
        {#if it.colours}<span class="dots">{#each it.colours as c}<i style="background:{BIN_COLOURS[c] || BIN_COLOURS.grey}"></i>{/each}</span>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .heads{display:grid;gap:var(--s2);margin:0;padding:0;list-style:none}
  @media (min-width:700px){ .heads{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))} }
  .chip{display:flex;align-items:center;gap:var(--s3);padding:var(--s3) var(--s4);border-radius:var(--radius);background:var(--card);border:1px solid var(--line);border-left:3px solid currentColor;min-width:0}
  .chip svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  .t{display:grid;gap:2px;min-width:0;color:var(--ink)}
  .t b{font-weight:600;font-size:16px}
  .sub{font-size:13px;color:var(--muted)}
  .dots{display:flex;gap:4px;margin-left:auto;flex:none}
  .dots i{width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,.25)}
</style>
