<script>
  // On Now: what's playing and where, with play/pause and skip, so the first page answers that too. Hidden when nothing's on.
  import { onMount } from 'svelte';
  import { music, watchMusic, toggle, next, openPlayer } from '../../state/music.svelte.js';
  import { artUrl } from '../../lib/music.js';
  import Icon from '../music/Icon.svelte';
  onMount(() => { watchMusic(); });
  const t = $derived(music.track), m = $derived(music.player);
</script>

{#if music.connected && t}
  <section class="card np" aria-label="Music">
    <button class="open" type="button" onclick={openPlayer} aria-label="Open the player">
      {#if t.images.length}<img src={artUrl(t.images, 64)} alt="" width="48" height="48">{/if}
      <span class="tx"><span class="label">{m.playing ? 'Playing' : 'Paused'}{m.device ? ' on ' + m.device.name : ''}</span><b>{t.name}</b><span class="sub">{t.artist}</span></span>
    </button>
    <button class="ib" type="button" aria-label={m.playing ? 'Pause' : 'Play'} onclick={toggle}><Icon name={m.playing ? 'pause' : 'play'} size={24} /></button>
    <button class="ib" type="button" aria-label="Next song" onclick={next}><Icon name="next" size={24} /></button>
  </section>
{/if}

<style>
  .np{grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px;padding:10px 10px 10px 12px;
    border-color:color-mix(in srgb,var(--tint,var(--gas)) 40%,var(--line));background:color-mix(in srgb,var(--tint,var(--gas)) 10%,var(--card))}
  .open{appearance:none;border:0;background:transparent;color:inherit;display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px;align-items:center;text-align:left;padding:0;cursor:pointer;font:inherit;min-width:0}
  img{width:48px;height:48px;border-radius:8px;object-fit:cover;display:block}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
  .ib:hover{background:rgba(255,255,255,.08)}
</style>
