<script>
  /*
   * The now-playing strip, on every page, just above the tabs (at the foot of the page on a laptop). Tinted to the
   * cover; a line along its foot shows how far through the song is. Tap it for the full player; swipe it left for the
   * next song and right for the one before. It also holds the full player, so that opens over any page.
   */
  import { onMount } from 'svelte';
  import { music, watchMusic, toggle, next, previous, like, openPlayer } from '../../state/music.svelte.js';
  import { artUrl } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  import Player from './Player.svelte';
  onMount(() => { watchMusic(); });

  const t = $derived(music.track);
  const pct = $derived(t && t.dur ? Math.min(100, music.progress / t.dur * 100) : 0);
  const where = $derived(music.player && music.player.device ? music.player.device.name : '');

  // a swipe skips; a tap opens
  let x0 = 0, y0 = 0, dx = $state(0), down = false;
  function start(e){ if (e.target.closest('button')) return; down = true; x0 = e.clientX; y0 = e.clientY; dx = 0; }
  function move(e){ if (!down) return; const ax = e.clientX - x0; if (Math.abs(e.clientY - y0) > Math.abs(ax) + 10){ down = false; dx = 0; return; } dx = Math.max(-90, Math.min(90, ax)); }
  function end(e){
    if (!down) return; down = false;
    const d = e.clientX - x0;
    if (d < -60) next(); else if (d > 60) previous(); else if (Math.abs(d) < 8 && Math.abs(e.clientY - y0) < 8) openPlayer();
    dx = 0;
  }
  const key = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openPlayer(); } };
</script>

{#if music.connected && t}
  <div class="mini" role="button" tabindex="0" aria-label="Now playing: {t.name} by {t.artist}{where ? ', on ' + where : ''}. Open the player."
       style="transform:translateX({dx}px)" onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={() => { down = false; dx = 0; }} onkeydown={key}>
    {#if t.images.length}<img class="art" src={artUrl(t.images, 64)} alt="" width="44" height="44">{:else}<span class="art"></span>{/if}
    <span class="t"><b>{t.name}</b><span class="sub">{#if where}<Icon name="speaker" size={12} /><span class="dev">{where}</span><span class="dot">·</span>{/if}<span class="by">{t.artist}</span></span></span>
    {#if !t.episode}<button class="ib" class:on={music.liked} type="button" aria-label={music.liked ? 'Remove from liked songs' : 'Add to liked songs'} aria-pressed={music.liked} onclick={like}><Icon name="heart" /></button>{/if}
    <button class="ib play" type="button" aria-label={music.player.playing ? 'Pause' : 'Play'} onclick={toggle}><Icon name={music.player.playing ? 'pause' : 'play'} /></button>
    <span class="bar" aria-hidden="true"><i style="width:{pct}%"></i></span>
  </div>
{/if}
{#if music.toast}<div class="toast" role="status">{music.toast}</div>{/if}
{#if music.connected}<Player />{/if}

<style>
  .mini{position:fixed;z-index:19;left:8px;right:8px;bottom:calc(var(--nav-h) + env(safe-area-inset-bottom,0px) + 8px);
    display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:7px 6px 9px 7px;border-radius:var(--radius);cursor:pointer;
    background:color-mix(in srgb,var(--tint,var(--gas)) 24%,rgba(10,13,32,.94));border:1px solid color-mix(in srgb,var(--tint,var(--gas)) 40%,transparent);
    box-shadow:0 8px 30px rgba(0,0,0,.45);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);touch-action:pan-y;user-select:none;-webkit-tap-highlight-color:transparent;
    transition:background .5s,border-color .5s}
  .art{width:44px;height:44px;border-radius:7px;object-fit:cover;background:rgba(255,255,255,.08);display:block}
  .t{min-width:0;display:grid;gap:1px}
  .t b{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{display:flex;align-items:center;gap:4px;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;min-width:0}
  .sub :global(.ic){color:var(--gas)}
  .dev{color:var(--gas);overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0}
  .by{overflow:hidden;text-overflow:ellipsis;min-width:0}
  .dot{opacity:.6}
  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:40px;height:40px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0}
  .ib:hover{background:rgba(255,255,255,.08)}
  .ib.on{color:#ff6b7d}
  .ib.on :global(.ic){fill:currentColor}
  .bar{position:absolute;left:12px;right:12px;bottom:3px;height:2px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden}
  .bar i{display:block;height:100%;background:var(--ink)}
  .toast{position:fixed;z-index:60;left:50%;transform:translateX(-50%);bottom:calc(var(--nav-h) + env(safe-area-inset-bottom,0px) + 76px);max-width:calc(100vw - 32px);
    background:rgba(233,236,255,.95);color:#06071a;font:600 13.5px/1.3 var(--f-body);padding:9px 14px;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.4);text-align:center}
  :global(html.player-open) .toast{bottom:auto;top:calc(env(safe-area-inset-top,0px) + 64px)}
  @media (min-width:900px){
    .mini{left:calc(220px + 24px);right:24px;bottom:16px;max-width:1100px}
    .toast{bottom:90px;left:calc(50% + 110px)}
  }
  @media (prefers-reduced-motion:reduce){ .mini{transition:none} }
</style>
