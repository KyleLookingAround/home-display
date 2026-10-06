<script>
  // One song in a list: tap it to play, + to add it to Up next. The song playing now is marked.
  import { music, addToQueue } from '../../state/music.svelte.js';
  import { artUrl, fmtDur } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  let { t, onplay, num = null, showArt = true } = $props();
  const now = $derived(music.track && music.track.id === t.id);
</script>

<li class="tr" class:now>
  <button class="go" type="button" onclick={onplay} disabled={!t.playable} aria-label="Play {t.name} by {t.artist}">
    {#if num != null}<span class="num mono">{#if now}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{:else}{num}{/if}</span>
    {:else if showArt}{#if t.images.length}<img src={artUrl(t.images, 64)} alt="" width="44" height="44" loading="lazy">{:else}<span class="ph"></span>{/if}{/if}
    <span class="tx"><b>{t.name}</b><span>{#if t.explicit}<em class="e" title="Explicit">E</em>{/if}{t.artist}</span></span>
    <span class="mono dur">{fmtDur(t.dur)}</span>
  </button>
  <button class="add" type="button" aria-label="Add {t.name} to Up next" onclick={() => addToQueue(t)} disabled={!t.playable}><Icon name="plus" size={20} /></button>
</li>

<style>
  .tr{display:grid;grid-template-columns:minmax(0,1fr) 40px;align-items:center;gap:4px;border-top:1px solid var(--line)}
  .go{appearance:none;border:0;background:transparent;color:inherit;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;padding:8px 0;cursor:pointer;min-height:56px;font:inherit}
  .go:disabled{opacity:.45;cursor:default}
  img,.ph{width:44px;height:44px;border-radius:var(--radius-sm);object-fit:cover;background:var(--card-2);display:block}
  .num{width:44px;text-align:center;color:var(--muted);font-size:13px;display:grid;place-items:center}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tx span{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .e{font:600 9px/1 var(--f-mono);font-style:normal;background:var(--muted);color:var(--void);border-radius:2px;padding:2px 3px;margin-right:5px;vertical-align:1px}
  .dur{font-size:12.5px;color:var(--faint)}
  .now .tx b{color:var(--gas)}
  .add{appearance:none;border:0;background:transparent;color:var(--muted);width:40px;height:40px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
  .add:hover{color:var(--gas);background:var(--sel)}
  .eq{display:inline-flex;align-items:flex-end;gap:2px;height:14px}
  .eq i{width:3px;background:var(--gas);animation:eq 1s ease-in-out infinite;height:40%}
  .eq i:nth-child(2){animation-delay:-.4s} .eq i:nth-child(3){animation-delay:-.7s}
  @keyframes eq{50%{height:100%}}
  @media (prefers-reduced-motion:reduce){ .eq i{animation:none;height:70%} }
</style>
