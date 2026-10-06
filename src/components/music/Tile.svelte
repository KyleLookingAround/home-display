<script>
  // An album, playlist or artist as a square (round for an artist) to tap.
  import { artUrl } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  let { images = [], title, sub = '', round = false, href = null, onclick = null } = $props();
</script>

{#if href}
  <a class="tile" {href}>{@render body()}</a>
{:else}
  <button class="tile" type="button" {onclick}>{@render body()}</button>
{/if}
{#snippet body()}
  {#if images && images.length}<img class:round src={artUrl(images, 300)} alt="" loading="lazy">{:else}<span class="ph" class:round><Icon name="music" size={32} /></span>{/if}
  <b>{title}</b>{#if sub}<span>{sub}</span>{/if}
{/snippet}

<style>
  .tile{appearance:none;border:0;background:transparent;color:inherit;text-decoration:none;display:grid;gap:6px;align-content:start;text-align:left;padding:0;cursor:pointer;font:inherit;min-width:0}
  img,.ph{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:rgba(255,255,255,.06);display:grid;place-items:center;color:var(--muted);box-shadow:0 6px 20px rgba(0,0,0,.35)}
  .round{border-radius:50%}
  b{font-weight:600;font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  span{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tile:hover b{color:var(--gas)}
</style>
