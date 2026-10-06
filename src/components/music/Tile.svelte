<script>
  // An album, playlist or artist as a square (round for an artist) to tap.
  import { artUrl } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  let { images = [], title, sub = '', round = false, href = null, onclick = null } = $props();
</script>

{#if href}
  <a class="tile" {href} {onclick}>{@render body()}</a>
{:else}
  <button class="tile" type="button" {onclick}>{@render body()}</button>
{/if}
{#snippet body()}
  {#if images && images.length}<img class:round src={artUrl(images, 300)} alt="" loading="lazy">{:else}<span class="ph" class:round><Icon name="music" size={32} /></span>{/if}
  <b>{title}</b>{#if sub}<span>{sub}</span>{/if}
{/snippet}

<style>
  .tile{appearance:none;border:0;background:transparent;color:inherit;text-decoration:none;display:grid;gap:6px;align-content:start;text-align:left;padding:0;cursor:pointer;font:inherit;min-width:0}
  img,.ph{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);background:var(--card-2);border:1px solid var(--line);display:grid;place-items:center;color:var(--muted)}
  .round{border-radius:50%}
  b{font-weight:600;font-size:14px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  span{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tile:hover b{color:var(--gas)}
  .tile:hover img{border-color:var(--line-hot)}
</style>
