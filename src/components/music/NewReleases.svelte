<script>
  // New from your artists: releases in the last three weeks from the artists you follow and play most.
  import { onMount } from 'svelte';
  import { disc, loadReleases } from '../../state/discover.svelte.js';
  import { releasedText } from '../../lib/discover.js';
  import Row from './Row.svelte';
  import Tile from './Tile.svelte';
  onMount(() => { loadReleases(); });
</script>

{#if disc.releases && disc.releases.length}
  <Row title="New from your artists">
    {#each disc.releases.slice(0, 12) as r (r.album.id)}<Tile images={r.album.images} title={r.album.name} sub="{r.artist.name} · {releasedText(r.date).replace('Out ', '')}" href="#album/{r.album.id}" />{/each}
  </Row>
{/if}
