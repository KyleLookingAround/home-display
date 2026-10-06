<script>
  /*
   * More like this: songs people play in the same sittings as the one playing (ListenBrainz, and Last.fm when it
   * has a key), found on Spotify, and the artists fans also like. Play them all, or one at a time.
   */
  import { untrack } from 'svelte';
  import { music, play, haptic, closePlayer } from '../../state/music.svelte.js';
  import { disc, loadLike } from '../../state/discover.svelte.js';
  import TrackRow from './TrackRow.svelte';
  import Tile from './Tile.svelte';
  import Icon from './Icon.svelte';
  const t = $derived(music.track);
  $effect(() => { t && t.id; untrack(() => loadLike()); });
  const like = $derived(t && disc.likeFor === t.id ? disc.like : null);
  const uris = $derived(like ? like.tracks.map(x => x.uri) : []);
</script>

<div class="like">
  <div class="lhead">
    <span class="label">More like {t ? t.name : 'this'}</span>
    {#if like && like.tracks.length}<button class="btn primary small" type="button" onclick={() => { haptic(); play({ uris }); }}><Icon name="play" size={16} />Play them</button>{/if}
  </div>
  {#if !like}
    <div class="looking"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><p class="note">Asking ListenBrainz what people play alongside this. The first time takes a few seconds.</p></div>
  {:else}
    {#if like.tracks.length}<ul class="list">{#each like.tracks as x, i (x.id)}<TrackRow t={x} onplay={() => play({ uris, offset: i })} />{/each}</ul>
    {:else}<div class="empty-view"><Icon name="music" size={36} /><p>Not enough people have played this alongside other songs yet.</p></div>{/if}
    {#if like.artists.length}
      <span class="label">Fans also like</span>
      <div class="strip">{#each like.artists as a (a.id)}<Tile images={a.images} title={a.name} round href="./music.html#artist/{a.id}" onclick={() => closePlayer()} />{/each}</div>
    {/if}
    <p class="credit">From {like.from && like.from.length ? like.from.join(' and ') : 'ListenBrainz'}: what people play in the same sittings, found on Spotify.</p>
  {/if}
</div>

<style>
  .like{display:grid;gap:12px;align-content:start}
  .lhead{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .lhead .label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .list{list-style:none;margin:0;padding:0}
  .strip{display:grid;grid-auto-flow:column;grid-auto-columns:96px;gap:12px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}
  .strip::-webkit-scrollbar{display:none}
  .credit{font:12px/1.5 var(--f-mono);color:var(--faint);margin:6px 0 0}
  .looking{display:grid;justify-items:center;gap:10px;padding:40px 10px;text-align:center}
  .dots{display:flex;gap:6px}
  .dots i{width:8px;height:8px;border-radius:50%;background:var(--gas);animation:b 1.2s ease-in-out infinite}
  .dots i:nth-child(2){animation-delay:.2s} .dots i:nth-child(3){animation-delay:.4s}
  @keyframes b{50%{opacity:.25;transform:translateY(-4px)}}
  @media (prefers-reduced-motion:reduce){ .dots i{animation:none} }
  .empty-view{display:grid;justify-items:center;gap:8px;padding:30px 10px;color:var(--muted);text-align:center}
  .empty-view p{margin:0}
</style>
