<script>
  /*
   * The now-playing strip, on every page, just above the tabs (at the foot of the page on a laptop). Tinted to the
   * cover, with a line along its foot for how far through the song is. Tap it for the full player; swipe it left for
   * the next song and right for the one before (what's coming shows behind it as you swipe). It also holds the full
   * player, so that opens over any page.
   */
  import { onMount } from 'svelte';
  import { music, watchMusic, toggle, next, previous, like, openPlayer, haptic } from '../../state/music.svelte.js';
  import { artUrl, deviceKind } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  import Player from './Player.svelte';
  onMount(() => { watchMusic(); });

  const t = $derived(music.track);
  const m = $derived(music.player);
  const pct = $derived(t && t.dur ? Math.min(100, music.progress / t.dur * 100) : 0);
  const where = $derived(m && m.device ? m.device.name : '');
  const upNext = $derived(music.queue && music.queue.length ? music.queue[0] : null);

  // a swipe skips; a tap opens
  let x0 = 0, y0 = 0, dx = $state(0), down = false, gone = $state('');
  function start(e){ if (e.target.closest('button')) return; down = true; x0 = e.clientX; y0 = e.clientY; dx = 0; }
  function move(e){ if (!down) return; const ax = e.clientX - x0; if (Math.abs(e.clientY - y0) > Math.abs(ax) + 10){ down = false; dx = 0; return; } dx = Math.max(-120, Math.min(120, ax)); }
  function end(e){
    if (!down) return; down = false;
    const d = e.clientX - x0;
    if (d < -60 || d > 60){ haptic(); gone = d < 0 ? 'left' : 'right'; (d < 0 ? next : previous)(); setTimeout(() => { gone = ''; }, 280); }
    else if (Math.abs(d) < 8 && Math.abs(e.clientY - y0) < 8) openPlayer();
    dx = 0;
  }
  const key = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openPlayer(); } };
</script>

{#if music.connected && t}
  <div class="wrap">
    <div class="hint" aria-hidden="true" class:show={Math.abs(dx) > 16}>
      {#if dx < 0}<span class="h r">{upNext ? upNext.name : 'Next'}<Icon name="next" size={16} /></span>{:else}<span class="h"><Icon name="prev" size={16} />Previous</span>{/if}
    </div>
    <div class="mini" class:gone-left={gone === 'left'} class:gone-right={gone === 'right'} role="button" tabindex="0"
         aria-label="Now playing: {t.name} by {t.artist}{where ? ', on ' + where : ''}. Open the player."
         style={dx ? `transform:translateX(${dx}px)` : ''} onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={() => { down = false; dx = 0; }} onkeydown={key}>
      <span class="thumb">
        {#if t.images.length}<img src={artUrl(t.images, 64)} alt="" width="46" height="46">{:else}<span class="ph"><Icon name="music" size={20} /></span>{/if}
        {#if m.playing}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{/if}
      </span>
      <span class="t"><b>{t.name}</b><span class="sub">{#if where}<span class="dev" title="Playing on {where}"><Icon name={deviceKind(m.device.type)} size={13} /><span class="dname">{where}</span></span>{/if}<span class="by">{t.artist}</span></span></span>
      {#if !t.episode}<button class="ib" class:on={music.liked} type="button" aria-label={music.liked ? 'Remove from liked songs' : 'Add to liked songs'} aria-pressed={music.liked} onclick={() => like()}><Icon name="heart" /></button>{/if}
      <button class="ib play" type="button" aria-label={m.playing ? 'Pause' : 'Play'} onclick={() => { haptic(); toggle(); }}><Icon name={m.playing ? 'pause' : 'play'} size={24} /></button>
      <span class="bar" aria-hidden="true"><i style="width:{pct}%"></i></span>
    </div>
  </div>
{/if}
{#if music.toast}<div class="toast" role="status">{music.toast}</div>{/if}
{#if music.connected}<Player />{/if}

<style>
  .wrap{position:fixed;z-index:19;left:8px;right:8px;bottom:calc(var(--nav-h) + env(safe-area-inset-bottom,0px) + 8px)}
  .hint{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:var(--radius);display:flex;align-items:center;padding:0 16px;opacity:0;transition:opacity .15s;
    background:color-mix(in srgb,var(--tint,var(--gas)) 12%,rgba(6,8,20,.9));color:var(--ink);font:600 13px var(--f-body)}
  .hint.show{opacity:1}
  .h{display:flex;align-items:center;gap:6px;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .h.r{margin-left:auto}
  .mini{position:relative;display:grid;grid-template-columns:46px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:7px 6px 10px 7px;border-radius:var(--radius);cursor:pointer;
    background:linear-gradient(90deg,color-mix(in srgb,var(--tint,var(--gas)) 30%,rgba(10,13,32,.95)),color-mix(in srgb,var(--tint,var(--gas)) 14%,rgba(10,13,32,.95)));
    border:1px solid color-mix(in srgb,var(--tint,var(--gas)) 40%,transparent);
    box-shadow:0 10px 34px rgba(0,0,0,.5),0 0 30px color-mix(in srgb,var(--tint,var(--gas)) 14%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    touch-action:pan-y;user-select:none;-webkit-tap-highlight-color:transparent;transition:background .6s,border-color .6s,transform .2s}
  .mini:active{transform:scale(.99)}
  .mini.gone-left{transform:translateX(-30px);opacity:.4;transition:transform .2s,opacity .2s}
  .mini.gone-right{transform:translateX(30px);opacity:.4;transition:transform .2s,opacity .2s}
  .thumb{position:relative;width:46px;height:46px}
  .thumb img,.thumb .ph{width:46px;height:46px;border-radius:8px;object-fit:cover;display:grid;place-items:center;background:rgba(255,255,255,.08);box-shadow:0 4px 12px rgba(0,0,0,.4)}
  .eq{position:absolute;right:3px;bottom:3px;display:flex;align-items:flex-end;gap:1.5px;height:12px;padding:2px 3px;border-radius:4px;background:rgba(4,5,13,.7)}
  .eq i{width:2.5px;height:40%;background:var(--tint,var(--gas));border-radius:1px;animation:eq 1s ease-in-out infinite}
  .eq i:nth-child(2){animation-delay:-.4s} .eq i:nth-child(3){animation-delay:-.7s}
  @keyframes eq{50%{height:100%}}
  .t{min-width:0;display:grid;gap:2px}
  .t b{font-weight:700;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{display:flex;align-items:center;gap:8px;font-size:12.5px;color:rgba(233,236,255,.7);white-space:nowrap;overflow:hidden;min-width:0}
  .dev{display:inline-flex;align-items:center;gap:4px;color:var(--gas);flex:none;min-width:0}
  .dname{display:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
  @media (min-width:520px){ .dname{display:inline} }
  .by{overflow:hidden;text-overflow:ellipsis;min-width:0}
  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:42px;height:42px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0;transition:transform .12s}
  .ib:hover{background:rgba(255,255,255,.08)}
  .ib:active{transform:scale(.88)}
  .ib.on{color:#ff6b7d}
  .ib.on :global(.ic){fill:currentColor}
  .bar{position:absolute;left:10px;right:10px;bottom:3px;height:2.5px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden}
  .bar i{display:block;height:100%;background:var(--tint,var(--ink));box-shadow:0 0 8px var(--tint,transparent)}
  .toast{position:fixed;z-index:60;left:50%;transform:translateX(-50%);bottom:calc(var(--nav-h) + env(safe-area-inset-bottom,0px) + 80px);max-width:calc(100vw - 32px);
    background:rgba(233,236,255,.96);color:#06071a;font:600 13.5px/1.3 var(--f-body);padding:10px 16px;border-radius:999px;box-shadow:0 8px 28px rgba(0,0,0,.45);text-align:center;animation:toast .25s ease-out}
  @keyframes toast{from{opacity:0;transform:translate(-50%,8px)}}
  :global(html.player-open) .toast{bottom:calc(env(safe-area-inset-bottom,0px) + 24px)}
  @media (min-width:900px){
    .wrap{left:calc(220px + 24px);right:24px;bottom:16px}
    .toast{bottom:92px;left:calc(50% + 110px)}
  }
  @media (prefers-reduced-motion:reduce){ .mini,.hint{transition:none} .eq i{animation:none;height:70%} .toast{animation:none} }
</style>
