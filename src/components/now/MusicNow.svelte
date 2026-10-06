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
    <h2 class="label">{m.playing ? 'Playing' : 'Paused'}{m.device ? ' on ' + m.device.name : ''}</h2>
    <div class="row">
      <button class="open" type="button" onclick={() => openPlayer()} aria-label="Open the player">
        {#if t.images.length}<img src={artUrl(t.images, 64)} alt="" width="48" height="48">{/if}
        <span class="tx"><b>{t.name}</b><span class="sub">{t.artist}</span></span>
      </button>
      <button class="icon-btn" type="button" aria-label={m.playing ? 'Pause' : 'Play'} onclick={toggle}><Icon name={m.playing ? 'pause' : 'play'} size={20} /></button>
      <button class="icon-btn" type="button" aria-label="Next song" onclick={next}><Icon name="next" size={20} /></button>
    </div>
  </section>
{/if}

<style>
  .row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:var(--s2)}
  .open{appearance:none;border:0;background:transparent;color:inherit;display:grid;grid-template-columns:48px minmax(0,1fr);gap:var(--s3);align-items:center;text-align:left;padding:0;cursor:pointer;font:inherit;min-width:0}
  img{width:48px;height:48px;border-radius:var(--radius-sm);object-fit:cover;display:block}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
