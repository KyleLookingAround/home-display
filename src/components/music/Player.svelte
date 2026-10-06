<script>
  /*
   * The full player: slides up over any page from the strip, and down again with the chevron, Escape or the phone's
   * Back. The cover, the song, a scrub bar, the controls, where it's playing (tap for "Play on" and the volume), and
   * underneath, the lyrics in time with the song (tap a line to jump there) or what's up next.
   */
  import { tick } from 'svelte';
  import { music, toggle, next, previous, seek, setShuffle, setRepeat, like, loadDevices, transfer, volume, setPane, closePlayer, poll } from '../../state/music.svelte.js';
  import { artUrl, fmtDur, lyricAt, nextRepeat } from '../../lib/music.js';
  import Icon from './Icon.svelte';

  const t = $derived(music.track);
  const m = $derived(music.player);
  let dragging = $state(false), dragAt = $state(0);
  const pos = $derived(dragging ? dragAt : music.progress);

  let closeBtn = $state(null), sheet = $state(null);
  $effect(() => {
    document.documentElement.classList.toggle('player-open', music.open);
    if (music.open) tick().then(() => closeBtn && closeBtn.focus());
  });
  const onKey = e => { if (!music.open) return; if (e.key === 'Escape'){ if (music.picker) music.picker = false; else closePlayer(); } };

  // "Play on": the devices, read when it opens and every few seconds while it's open
  let devTimer = 0;
  $effect(() => {
    if (music.picker){ loadDevices(); devTimer = setInterval(loadDevices, 8000); }
    return () => clearInterval(devTimer);
  });
  const vol = $derived(m && m.device && m.device.volume != null ? m.device.volume : null);

  // lyrics: the line being sung, kept in the middle of the box
  const lines = $derived(music.lyrics && music.lyrics.synced ? music.lyrics.synced : null);
  const at = $derived(lines ? lyricAt(lines, pos + 250) : -1);
  let box = $state(null);
  $effect(() => {
    const i = at;
    if (!box || i < 0 || !music.open || music.pane !== 'lyrics') return;
    const el = box.children[i];
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  const repeatLabel = r => r === 'off' ? 'Repeat is off' : r === 'context' ? 'Repeating all' : 'Repeating this song';
</script>

<svelte:window onkeydown={onKey} />

<div class="scrim" class:open={music.open} onclick={closePlayer} aria-hidden="true"></div>
<div class="sheet" class:open={music.open} class:picking={music.picker} bind:this={sheet} role="dialog" aria-modal="true" aria-label="Player" aria-hidden={!music.open} inert={!music.open}>
  <header class="top">
    <button class="ib" type="button" bind:this={closeBtn} aria-label="Close the player" onclick={closePlayer}><Icon name="down" size={26} /></button>
    <div class="from">{#if music.ctxName}<span class="label">Playing from</span><b>{music.ctxName}</b>{:else}<span class="label">Now playing</span>{/if}</div>
    <span class="ib-space"></span>
  </header>

  {#if t}
    <div class="cover-wrap">{#if t.images.length}<img class="cover" src={artUrl(t.images, 640)} alt="Cover of {t.album.name || t.name}">{:else}<div class="cover blank"><Icon name="music" size={64} /></div>{/if}</div>
    <div class="meta">
      <div class="names"><b class="name">{t.name}</b><span class="artist">{t.artist}{#if t.album.name && !t.episode}<span class="album">{' · ' + t.album.name}</span>{/if}</span></div>
      {#if !t.episode}<button class="ib heart" class:on={music.liked} type="button" aria-pressed={music.liked} aria-label={music.liked ? 'Remove from liked songs' : 'Add to liked songs'} onclick={like}><Icon name="heart" size={24} /></button>{/if}
    </div>
    <div class="scrub">
      <input type="range" min="0" max={t.dur || 1} step="1000" value={pos} aria-label="Position in the song" aria-valuetext="{fmtDur(pos)} of {fmtDur(t.dur)}"
        style="--p:{t.dur ? pos / t.dur * 100 : 0}%"
        oninput={e => { dragging = true; dragAt = +e.currentTarget.value; }} onchange={e => { dragging = false; seek(+e.currentTarget.value); }}>
      <div class="times mono"><span>{fmtDur(pos)}</span><span>-{fmtDur(Math.max(0, t.dur - pos))}</span></div>
    </div>
    <div class="ctl">
      <button class="ib tog" class:on={m.shuffle} type="button" aria-pressed={m.shuffle} aria-label={m.shuffle ? 'Shuffle is on' : 'Shuffle is off'} onclick={setShuffle}><Icon name="shuffle" /></button>
      <button class="ib" type="button" aria-label="Previous" onclick={previous}><Icon name="prev" size={30} /></button>
      <button class="ib big" type="button" aria-label={m.playing ? 'Pause' : 'Play'} onclick={toggle}><Icon name={m.playing ? 'pause' : 'play'} size={30} /></button>
      <button class="ib" type="button" aria-label="Next" onclick={next}><Icon name="next" size={30} /></button>
      <button class="ib tog" class:on={m.repeat !== 'off'} type="button" aria-label={repeatLabel(m.repeat)} onclick={() => setRepeat(nextRepeat(m.repeat))}><Icon name={m.repeat === 'track' ? 'one' : 'repeat'} /></button>
    </div>
    <div class="row2">
      <button class="dev" type="button" aria-expanded={music.picker} onclick={() => { music.picker = !music.picker; }}>
        <Icon name="speaker" size={16} /><span>{m.device ? m.device.name : 'Choose where to play'}</span>
      </button>
      <div class="tabs" role="tablist" aria-label="Under the player">
        <button role="tab" type="button" aria-selected={music.pane === 'lyrics'} onclick={() => setPane('lyrics')}><Icon name="lyrics" size={16} />Lyrics</button>
        <button role="tab" type="button" aria-selected={music.pane === 'queue'} onclick={() => setPane('queue')}><Icon name="queue" size={16} />Up next</button>
      </div>
    </div>

    <section class="pane" aria-live="off">
      {#if music.pane === 'lyrics'}
        {#if lines}
          <div class="lyrics" bind:this={box}>
            {#each lines as l, i}<button type="button" class="line" class:now={i === at} class:done={i < at} onclick={() => seek(l.t)}>{l.text || '♪'}</button>{/each}
          </div>
        {:else if music.lyrics && music.lyrics.instrumental}<p class="note">An instrumental.</p>
        {:else if music.lyrics && music.lyrics.plain}<div class="plain">{#each music.lyrics.plain as l}<p>{l || ' '}</p>{/each}</div><p class="note">These lyrics aren't timed to the song.</p>
        {:else if music.lyricsFor !== t.id && !music.lyrics}<p class="note">Looking for the lyrics…</p>
        {:else}<p class="note">No lyrics for this one in LRCLIB, the free lyrics library.</p>{/if}
      {:else}
        {#if music.queue && music.queue.length}
          <ol class="queue">
            {#each music.queue as q, i (q.uri + i)}
              <li>{#if q.images.length}<img src={artUrl(q.images, 64)} alt="" width="40" height="40">{:else}<span class="ph"></span>{/if}
                <span class="qt"><b>{q.name}</b><span>{q.artist}</span></span><span class="mono dur">{fmtDur(q.dur)}</span></li>
            {/each}
          </ol>
          <p class="note">Add songs from the Music tab. Spotify doesn't let other apps reorder or remove them.</p>
        {:else if music.queue}<p class="note">Nothing up next. Add songs from the Music tab.</p>
        {:else}<p class="note">Reading what's up next…</p>{/if}
      {/if}
    </section>
  {:else if music.checked}
    <div class="idle"><Icon name="music" size={40} /><p>Nothing's playing.</p><p class="note">Play something from the Music tab, or on any of your Spotify devices.</p></div>
  {/if}

  {#if music.picker}
    <div class="picker" role="dialog" aria-label="Play on">
      <div class="ph-head"><span class="label">Play on</span><button class="ib" type="button" aria-label="Close" onclick={() => { music.picker = false; }}><Icon name="down" /></button></div>
      {#each music.devices as d (d.id)}
        <button type="button" class="d" class:on={d.active} onclick={() => d.active ? (music.picker = false) : transfer(d)}>
          <Icon name={d.kind} size={22} /><span class="dn"><b>{d.name}</b><span>{d.active ? 'Playing here' : d.kind === 'tv' ? 'TV' : d.kind === 'phone' ? 'Phone' : d.kind === 'speaker' ? 'Speaker' : d.kind === 'computer' ? 'Computer' : 'Spotify device'}</span></span>
        </button>
      {:else}<p class="note">No devices awake. Open Spotify on the TV, a speaker or your phone and it'll appear here.</p>{/each}
      {#if m && m.device && m.device.canVolume && vol != null}
        <label class="vol"><Icon name="volume" size={20} /><span class="sr">Volume on {m.device.name}</span>
          <input type="range" min="0" max="100" value={vol} style="--p:{vol}%" oninput={e => volume(+e.currentTarget.value)}><span class="mono">{vol}</span></label>
      {/if}
      <p class="note">Google speakers sometimes only appear after they've been played to once from the Spotify app.</p>
    </div>
  {/if}
  {#if music.err && music.open}<p class="err" role="alert"><b>{music.err.title}</b> {music.err.body}</p>{/if}
</div>

<style>
  .scrim{position:fixed;left:0;top:0;right:0;bottom:0;z-index:39;background:rgba(2,3,10,.6);opacity:0;pointer-events:none;transition:opacity .3s}
  .sheet{position:fixed;left:0;top:0;right:0;bottom:0;z-index:40;display:flex;flex-direction:column;gap:12px;overflow-y:auto;overscroll-behavior:contain;
    padding:calc(env(safe-area-inset-top,0px) + 10px) 20px calc(env(safe-area-inset-bottom,0px) + 20px);
    background:linear-gradient(180deg,var(--tint-deep,#0d1336) 0%,var(--void) 70%);transform:translateY(102%);transition:transform .38s cubic-bezier(.2,.8,.2,1),background .6s;visibility:hidden}
  .sheet.open{transform:none;visibility:visible}
  @media (min-width:900px){
    .scrim.open{opacity:1;pointer-events:auto}
    .sheet{left:auto;width:460px;border-left:1px solid var(--line);transform:translateX(102%);box-shadow:-20px 0 60px rgba(0,0,0,.5)}
  }
  @media (prefers-reduced-motion:reduce){ .sheet,.scrim{transition:none} }
  .top{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;text-align:center}
  .from{display:grid;gap:1px;min-width:0}
  .from b{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0}
  .ib:hover{background:rgba(255,255,255,.08)}
  .cover-wrap{display:grid;place-items:center;padding:6px 0}
  .cover{width:min(100%,340px,38vh);aspect-ratio:1;border-radius:12px;object-fit:cover;box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 60px color-mix(in srgb,var(--tint,var(--gas)) 30%,transparent)}
  .cover.blank{display:grid;place-items:center;background:var(--card);color:var(--muted)}
  .meta{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px}
  .names{display:grid;gap:2px;min-width:0}
  .name{font:700 21px/1.2 var(--f-body);overflow-wrap:anywhere}
  .artist{color:var(--muted);font-size:15px}
  .album{opacity:.8}
  .heart.on{color:#ff6b7d}
  .heart.on :global(.ic){fill:currentColor}
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:22px;background:transparent;margin:0;cursor:pointer}
  input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(90deg,var(--ink) var(--p),rgba(255,255,255,.18) var(--p))}
  input[type=range]::-moz-range-track{height:4px;border-radius:4px;background:linear-gradient(90deg,var(--ink) var(--p),rgba(255,255,255,.18) var(--p))}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--ink);margin-top:-5px;border:0}
  input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--ink);border:0}
  .times{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}
  .ctl{display:flex;justify-content:space-between;align-items:center;max-width:420px;width:100%;margin:0 auto}
  .ctl .big{width:66px;height:66px;background:var(--ink);color:#06071a}
  .ctl .big:hover{background:#fff}
  .tog{color:var(--muted)} .tog.on{color:var(--good, #46e6a1)}
  .row2{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
  .dev{appearance:none;display:inline-flex;align-items:center;gap:7px;max-width:100%;border:1px solid color-mix(in srgb,var(--gas) 45%,transparent);background:rgba(79,214,255,.08);color:var(--gas);
    font:500 13px/1 var(--f-body);border-radius:999px;padding:9px 13px;cursor:pointer;min-height:38px}
  .dev span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tabs{display:inline-flex;gap:4px;border:1px solid var(--line-hot);border-radius:999px;padding:3px}
  .tabs button{appearance:none;display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--muted);font:500 13px/1 var(--f-body);border-radius:999px;padding:7px 11px;cursor:pointer;min-height:32px}
  .tabs button[aria-selected="true"]{background:var(--ink);color:#06071a}
  .pane{min-height:120px}
  .lyrics{display:grid;gap:4px;max-height:44vh;overflow-y:auto;scroll-behavior:auto;padding:30% 0;mask-image:linear-gradient(transparent,#000 18%,#000 82%,transparent);-webkit-mask-image:linear-gradient(transparent,#000 18%,#000 82%,transparent)}
  .line{appearance:none;border:0;background:none;padding:2px 0;text-align:left;font:700 21px/1.32 var(--f-body);color:rgba(233,236,255,.32);cursor:pointer;transition:color .3s}
  .line.done{color:rgba(233,236,255,.55)}
  .line.now{color:var(--ink);text-shadow:0 0 22px color-mix(in srgb,var(--tint,var(--gas)) 50%,transparent)}
  .plain p{margin:0;font-size:16px;line-height:1.5}
  .queue{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .queue li{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center}
  .queue img,.queue .ph{width:40px;height:40px;border-radius:6px;object-fit:cover;background:var(--card)}
  .qt{display:grid;min-width:0}
  .qt b{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .qt span{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dur{font-size:12px;color:var(--faint)}
  .idle{display:grid;justify-items:center;gap:8px;text-align:center;margin:auto;color:var(--muted)}
  .idle p:first-of-type{font:600 18px var(--f-body);color:var(--ink)}
  .sheet.picking > :not(.picker){opacity:.22;pointer-events:none;transition:opacity .2s}
  .picker{position:sticky;bottom:0;margin-top:auto;z-index:2;background:#0a0d20;border:1px solid var(--line-hot);border-radius:18px;padding:10px 12px 14px;display:grid;gap:4px;box-shadow:0 -12px 40px rgba(0,0,0,.55)}
  .ph-head{display:flex;justify-content:space-between;align-items:center;padding-left:6px}
  .d{appearance:none;border:0;background:transparent;color:var(--ink);display:grid;grid-template-columns:28px minmax(0,1fr);gap:12px;align-items:center;text-align:left;padding:10px 8px;border-radius:12px;cursor:pointer;min-height:52px}
  .d:hover{background:rgba(255,255,255,.06)}
  .d.on{color:var(--gas)}
  .dn{display:grid;min-width:0}
  .dn b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dn span{font-size:12.5px;color:var(--muted)}
  .vol{display:grid;grid-template-columns:24px minmax(0,1fr) 30px;gap:10px;align-items:center;padding:8px;color:var(--muted)}
  .vol input{--p:50%}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .err{margin:0;padding:10px 12px;border-radius:var(--radius-sm);background:rgba(255,107,125,.1);border:1px solid rgba(255,107,125,.35);font-size:14px}
  .ib-space{width:44px}
</style>
