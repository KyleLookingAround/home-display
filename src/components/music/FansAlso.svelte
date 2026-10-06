<script>
  // On an artist's page: the artists their fans also play (ListenBrainz), found on Spotify.
  import { untrack } from 'svelte';
  import { fansAlsoLike } from '../../state/discover.svelte.js';
  import Row from './Row.svelte';
  import Tile from './Tile.svelte';
  let { name } = $props();
  let list = $state.raw(null);
  $effect(() => { const n = name; untrack(() => { list = null; if (!n) return; fansAlsoLike(n).then(l => { if (name === n) list = l; }, () => { list = []; }); }); });
</script>

{#if list && list.length}
  <Row title="Fans also like">{#each list as a (a.id)}<Tile images={a.images} title={a.name} round href="#artist/{a.id}" />{/each}</Row>
{/if}
