<script>
  /*
   * The full player. It slides up over any page from the strip; drag it down, tap the chevron, press Escape or the
   * phone's Back to put it away. The cover lights the room: blurred into a slow nebula behind everything, and
   * resting a little smaller while paused. Swipe the cover to skip, double-tap it to like the song.
   *
   * It has three views: the player itself, the lyrics (line by line, tap one to jump there) and Up next. The player
   * shows a glance of each; tapping one opens it, with a small player kept at the top.
   */
  import { tick } from 'svelte';
  import { music, toggle, next, previous, seek, setShuffle, setRepeat, like, loadDevices, transfer, volume, setView, closePlayer, haptic } from '../../state/music.svelte.js';
  import { artUrl, fmtDur, lyricAt, nextRepeat, deviceKind } from '../../lib/music.js';
  import Icon from './Icon.svelte';

  const t = $derived(music.track);
  const m = $derived(music.player);
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- position, and dragging the scrub bar ---------- */
  let dragging = $state(false), dragAt = $state(0);
  const pos = $derived(dragging ? dragAt : music.progress);
  const pct = $derived(t && t.dur ? Math.min(100, pos / t.dur * 100) : 0);

  /* ---------- opening and closing ---------- */
  let closeBtn = $state(null);
  $effect(() => {
    document.documentElement.classList.toggle('player-open', music.open);
    if (music.open) tick().then(() => closeBtn && closeBtn.focus());
  });
  const onKey = e => {
    if (!music.open) return;
    if (e.key === 'Escape'){ if (music.picker) music.picker = false; else if (music.view !== 'player') setView('player'); else closePlayer(); }
  };

  /* ---------- touch: drag the player down to close it; swipe the cover to skip; double-tap it to like ---------- */
  let dy = $state(0), dx = $state(0), axis = '', x0 = 0, y0 = 0, active = false, lastTap = 0, burst = $state(0), slide = $state('');
  function down(e){
    if (e.button > 0 || e.target.closest('button, input, a, .lyrics-full, .queue-full, .picker')) return;
    active = true; axis = ''; x0 = e.clientX; y0 = e.clientY;
  }
  function moveP(e){
    if (!active) return;
    const ax = e.clientX - x0, ay = e.clientY - y0;
    if (!axis && Math.hypot(ax, ay) > 10) axis = Math.abs(ay) > Math.abs(ax) ? 'y' : (e.target.closest('.stage') ? 'x' : 'none');
    if (axis === 'y') dy = Math.max(0, ay);
    if (axis === 'x') dx = ax;
  }
  function up(e){
    if (!active) return; active = false;
    if (axis === 'y' && dy > 110){ dy = 0; closePlayer(); return; }
    if (axis === 'x' && Math.abs(dx) > 70){ const fwd = dx < 0; slide = fwd ? 'out-left' : 'out-right'; dx = 0; haptic(); (fwd ? next : previous)(); setTimeout(() => { slide = ''; }, 260); return; }
    if (!axis && e.target.closest && e.target.closest('.stage')){
      const now = Date.now();
      if (now - lastTap < 320){ like(true); burst++; lastTap = 0; } else lastTap = now;
    }
    dy = 0; dx = 0;
  }

  /* ---------- Play on ---------- */
  let devTimer = 0;
  $effect(() => {
    if (music.picker){ loadDevices(); devTimer = setInterval(loadDevices, 8000); }
    return () => clearInterval(devTimer);
  });
  const vol = $derived(m && m.device && m.device.canVolume && m.device.volume != null ? m.device.volume : null);
  const kind = $derived(m && m.device ? deviceKind(m.device.type) : 'speaker');

  /* ---------- lyrics: the line being sung ---------- */
  const lines = $derived(music.lyrics && music.lyrics.synced ? music.lyrics.synced : null);
  const at = $derived(lines ? lyricAt(lines, pos + 250) : -1);
  const peek = $derived(lines ? [lines[Math.max(0, at)], lines[Math.max(0, at) + 1]].filter(Boolean) : null);
  let box = $state(null);
  $effect(() => {
    const i = at;
    if (!box || i < 0 || !music.open || music.view !== 'lyrics') return;
    const el = box.children[i];
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight * .38, behavior: still ? 'auto' : 'smooth' });
  });

  const nextUp = $derived(music.queue && music.queue.length ? music.queue[0] : null);
  const repeatLabel = r => r === 'off' ? 'Repeat is off' : r === 'context' ? 'Repeating all' : 'Repeating this song';
  const press = fn => () => { haptic(); fn(); };
  const ctxHref = $derived(m && m.context && /^(playlist|album|artist)$/.test(m.context.type) ? `./music.html#${m.context.type}/${m.context.uri.split(':').pop()}` : null);
</script>

<svelte:window onkeydown={onKey} onpointermove={moveP} onpointerup={up} onpointercancel={() => { active = false; dy = 0; dx = 0; }} />

<div class="scrim" class:open={music.open} onclick={closePlayer} aria-hidden="true"></div>
<div class="sheet" class:open={music.open} class:picking={music.picker} class:dragging={dy > 0} role="dialog" aria-modal="true" aria-label="Player" aria-hidden={!music.open} inert={!music.open}
     style={dy ? `transform:translateY(${dy}px)` : ''} onpointerdown={down}>
  {#if t}
    <div class="sky" aria-hidden="true">
      {#if t.images.length}<img class="neb" class:still src={artUrl(t.images, 300)} alt="">{/if}
      <div class="veil"></div>
    </div>
  {/if}

  {#if music.view === 'player' || !t}
    <header class="top">
      <span class="grab" aria-hidden="true"></span>
      <button class="ib" type="button" bind:this={closeBtn} aria-label="Close the player" onclick={closePlayer}><Icon name="down" size={28} /></button>
      {#if ctxHref && music.ctxName}<a class="from" href={ctxHref} onclick={() => closePlayer()}><span class="label">Playing from</span><b>{music.ctxName}</b></a>
      {:else}<div class="from"><span class="label">{music.ctxName ? 'Playing from' : 'Now playing'}</span>{#if music.ctxName}<b>{music.ctxName}</b>{/if}</div>{/if}
      <span class="ib-space"></span>
    </header>

    {#if t}
      <div class="stage" style={dx ? `transform:translateX(${dx}px) rotate(${dx / 40}deg)` : ''} class:out-left={slide === 'out-left'} class:out-right={slide === 'out-right'}>
        {#key t.id}
          {#if t.images.length}<img class="cover" class:paused={!m.playing} src={artUrl(t.images, 640)} alt="Cover of {t.album.name || t.name}" draggable="false">
          {:else}<div class="cover blank" class:paused={!m.playing}><Icon name="music" size={64} /></div>{/if}
        {/key}
        {#key burst}{#if burst}<span class="burst" aria-hidden="true"><Icon name="heart" size={96} /></span>{/if}{/key}
      </div>

      <div class="meta">
        <div class="names">
          <b class="name" title={t.name}>{t.name}</b>
          <span class="artist">{#each t.artists as a, i}{#if i}{', '}{/if}{#if a.id && !t.episode}<a href="./music.html#artist/{a.id}" onclick={() => closePlayer()}>{a.name}</a>{:else}{a.name}{/if}{/each}</span>
        </div>
        {#if !t.episode}<button class="ib heart" class:on={music.liked} type="button" aria-pressed={music.liked} aria-label={music.liked ? 'Remove from liked songs' : 'Add to liked songs'} onclick={() => like()}><Icon name="heart" size={26} /></button>{/if}
      </div>

      <div class="scrub" class:active={dragging}>
        <input type="range" min="0" max={t.dur || 1} step="1000" value={pos} aria-label="Position in the song" aria-valuetext="{fmtDur(pos)} of {fmtDur(t.dur)}" style="--p:{pct}%"
          oninput={e => { dragging = true; dragAt = +e.currentTarget.value; }} onchange={e => { dragging = false; seek(+e.currentTarget.value); }}>
        {#if dragging}<span class="bubble mono" style="left:{pct}%">{fmtDur(pos)}</span>{/if}
        <div class="times mono"><span>{fmtDur(pos)}</span><span>-{fmtDur(Math.max(0, t.dur - pos))}</span></div>
      </div>

      <div class="ctl">
        <button class="ib tog" class:on={m.shuffle} type="button" aria-pressed={m.shuffle} aria-label={m.shuffle ? 'Shuffle is on' : 'Shuffle is off'} onclick={press(setShuffle)}><Icon name="shuffle" />{#if m.shuffle}<i class="pip"></i>{/if}</button>
        <button class="ib" type="button" aria-label="Previous" onclick={press(previous)}><Icon name="prev" size={32} /></button>
        <button class="ib big" type="button" aria-label={m.playing ? 'Pause' : 'Play'} onclick={press(toggle)}><Icon name={m.playing ? 'pause' : 'play'} size={32} /></button>
        <button class="ib" type="button" aria-label="Next" onclick={press(next)}><Icon name="next" size={32} /></button>
        <button class="ib tog" class:on={m.repeat !== 'off'} type="button" aria-label={repeatLabel(m.repeat)} onclick={press(() => setRepeat(nextRepeat(m.repeat)))}><Icon name={m.repeat === 'track' ? 'one' : 'repeat'} />{#if m.repeat !== 'off'}<i class="pip"></i>{/if}</button>
      </div>

      <div class="where">
        <button class="dev" type="button" aria-expanded={music.picker} onclick={() => { music.picker = !music.picker; }}>
          <Icon name={kind} size={18} /><span class="dn"><span class="label">Playing on</span><b>{m.device ? m.device.name : 'Choose where to play'}</b></span>
        </button>
        {#if vol != null}
          <label class="vol"><Icon name="volume" size={20} /><span class="sr">Volume on {m.device.name}</span>
            <input type="range" min="0" max="100" value={vol} style="--p:{vol}%" oninput={e => volume(+e.currentTarget.value)}></label>
        {/if}
      </div>

      <div class="glances">
        <button class="glance lyr" type="button" onclick={() => setView('lyrics')} aria-label="Lyrics">
          <span class="gh"><span class="label">Lyrics</span><Icon name="lyrics" size={16} /></span>
          {#if peek && peek.length}{#each peek as l, i}<span class="gl" class:now={i === 0 && at >= 0}>{l.text || '♪'}</span>{/each}
          {:else if music.lyrics && music.lyrics.instrumental}<span class="gl now">An instrumental</span>
          {:else if music.lyrics && music.lyrics.plain}<span class="gl now">Not timed to the song. Tap to read them.</span>
          {:else if music.lyricsFor !== t.id && !music.lyrics}<span class="gl">Looking for the lyrics…</span>
          {:else}<span class="gl">No lyrics for this one</span>{/if}
        </button>
        <button class="glance nx" type="button" onclick={() => setView('queue')} aria-label="Up next">
          <span class="gh"><span class="label">Up next</span><Icon name="queue" size={16} /></span>
          {#if nextUp}<span class="nxrow">{#if nextUp.images.length}<img src={artUrl(nextUp.images, 64)} alt="" width="36" height="36">{/if}<span class="nt"><b>{nextUp.name}</b><span>{nextUp.artist}</span></span></span>
          {:else}<span class="gl">{music.queue ? 'Nothing queued' : 'Reading…'}</span>{/if}
        </button>
      </div>
    {:else if music.checked}
      <div class="idle"><Icon name="music" size={44} /><p class="it">Nothing's playing</p><p class="note">Play something from the Music tab, or on any of your Spotify devices.</p>
        <a class="btn primary" href="./music.html" onclick={() => closePlayer()}>Open Music</a></div>
    {/if}
  {:else}
    <header class="mini-top">
      <button class="ib" type="button" bind:this={closeBtn} aria-label="Back to the player" onclick={() => setView('player')}><Icon name="down" size={26} /></button>
      {#if t.images.length}<img src={artUrl(t.images, 64)} alt="" width="44" height="44">{:else}<span></span>{/if}
      <span class="mt"><b>{t.name}</b><span>{t.artist}</span></span>
      <button class="ib small-play" type="button" aria-label={m.playing ? 'Pause' : 'Play'} onclick={press(toggle)}><Icon name={m.playing ? 'pause' : 'play'} size={22} /></button>
      <span class="mbar" aria-hidden="true"><i style="width:{pct}%"></i></span>
    </header>
    <div class="vtabs" role="tablist" aria-label="Player views">
      <button role="tab" type="button" aria-selected={music.view === 'lyrics'} onclick={() => setView('lyrics')}>Lyrics</button>
      <button role="tab" type="button" aria-selected={music.view === 'queue'} onclick={() => setView('queue')}>Up next</button>
    </div>
    {#if music.view === 'lyrics'}
      {#if lines}
        <div class="lyrics-full" bind:this={box}>
          {#each lines as l, i}<button type="button" class="line" class:now={i === at} class:done={i < at} onclick={() => seek(l.t)}>{l.text || '♪'}</button>{/each}
          <p class="credit">Lyrics from LRCLIB, the free lyrics library</p>
        </div>
      {:else if music.lyrics && music.lyrics.plain}<div class="lyrics-full plain">{#each music.lyrics.plain as l}<p>{l || ' '}</p>{/each}<p class="credit">These lyrics aren't timed to the song. From LRCLIB.</p></div>
      {:else}<div class="empty-view"><Icon name="lyrics" size={40} /><p>{music.lyrics && music.lyrics.instrumental ? 'An instrumental.' : music.lyricsFor !== t.id && !music.lyrics ? 'Looking for the lyrics…' : 'LRCLIB, the free lyrics library, doesn\'t have this one yet.'}</p></div>{/if}
    {:else}
      <div class="queue-full">
        <span class="label">Now playing</span>
        <div class="qrow now">{#if t.images.length}<img src={artUrl(t.images, 64)} alt="" width="44" height="44">{:else}<span class="ph"></span>{/if}<span class="qt"><b>{t.name}</b><span>{t.artist}</span></span><span class="eq" aria-hidden="true" class:paused={!m.playing}><i></i><i></i><i></i></span></div>
        {#if music.queue && music.queue.length}
          <span class="label">Next{music.ctxName ? ' from ' + music.ctxName : ''}</span>
          <ol>{#each music.queue as q, i (q.uri + i)}<li class="qrow">{#if q.images.length}<img src={artUrl(q.images, 64)} alt="" width="44" height="44" loading="lazy">{:else}<span class="ph"></span>{/if}<span class="qt"><b>{q.name}</b><span>{q.artist}</span></span><span class="mono dur">{fmtDur(q.dur)}</span></li>{/each}</ol>
          <p class="note">Add songs with + anywhere in Music. Spotify doesn't let other apps reorder or remove them.</p>
        {:else if music.queue}<div class="empty-view"><Icon name="queue" size={40} /><p>Nothing up next. Add songs with + anywhere in Music.</p></div>
        {:else}<p class="note">Reading what's up next…</p>{/if}
      </div>
    {/if}
  {/if}

  {#if music.picker}
    <div class="picker" role="dialog" aria-label="Play on">
      <div class="ph-head"><span class="label">Play on</span><button class="ib" type="button" aria-label="Close" onclick={() => { music.picker = false; }}><Icon name="down" /></button></div>
      {#each music.devices as d (d.id)}
        <button type="button" class="d" class:on={d.active} onclick={() => d.active ? (music.picker = false) : transfer(d)}>
          <span class="dicon"><Icon name={d.kind} size={22} /></span>
          <span class="dn"><b>{d.name}</b><span>{d.active ? 'Playing here' : d.kind === 'tv' ? 'TV' : d.kind === 'phone' ? 'Phone' : d.kind === 'speaker' ? 'Speaker' : d.kind === 'computer' ? 'Computer' : 'Spotify device'}</span></span>
          {#if d.active}<span class="eq" aria-hidden="true" class:paused={!m || !m.playing}><i></i><i></i><i></i></span>{/if}
        </button>
      {:else}<p class="note">Nothing's awake. Open Spotify on the TV, a speaker or your phone and it'll appear here.</p>{/each}
      <p class="note">Google speakers sometimes only appear after they've been played to once from the Spotify app.</p>
    </div>
  {/if}
  {#if music.err && music.open}<p class="err" role="alert"><b>{music.err.title}</b> {music.err.body}</p>{/if}
</div>

<style>
  .scrim{position:fixed;left:0;top:0;right:0;bottom:0;z-index:39;background:rgba(2,3,10,.62);opacity:0;pointer-events:none;transition:opacity .3s}
  .sheet{position:fixed;left:0;top:0;right:0;bottom:0;z-index:40;display:flex;flex-direction:column;gap:14px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;isolation:isolate;
    padding:calc(env(safe-area-inset-top,0px) + 6px) 22px calc(env(safe-area-inset-bottom,0px) + 22px);background:var(--void);
    transform:translateY(102%);transition:transform .42s cubic-bezier(.2,.85,.25,1);visibility:hidden;touch-action:pan-y}
  .sheet.open{transform:none;visibility:visible}
  .sheet.dragging{transition:none}
  @media (min-width:900px){
    .scrim.open{opacity:1;pointer-events:auto}
    .sheet{left:auto;width:480px;border-left:1px solid var(--line);transform:translateX(102%);box-shadow:-30px 0 80px rgba(0,0,0,.55)}
    .grab{display:none}
  }
  @media (prefers-reduced-motion:reduce){ .sheet,.scrim{transition:none} }

  /* the room: the cover blurred into a slow nebula, darkening towards the controls */
  .sky{position:absolute;left:0;top:0;right:0;height:100%;min-height:100vh;z-index:-1;overflow:hidden;pointer-events:none}
  .neb{position:absolute;left:-30%;top:-25%;width:160%;height:auto;aspect-ratio:1;object-fit:cover;filter:blur(60px) saturate(1.6) brightness(.85);opacity:.7;
    animation:drift 48s ease-in-out infinite alternate;will-change:transform}
  .neb.still{animation:none}
  @keyframes drift{0%{transform:translate3d(0,0,0) rotate(0) scale(1)}50%{transform:translate3d(-6%,4%,0) rotate(14deg) scale(1.12)}100%{transform:translate3d(5%,-3%,0) rotate(-10deg) scale(1.05)}}
  .veil{position:absolute;left:0;top:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(4,5,13,.15) 0%,rgba(4,5,13,.45) 45%,rgba(4,5,13,.92) 78%,var(--void) 100%)}

  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:46px;height:46px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0;position:relative;transition:transform .12s,background .2s;-webkit-tap-highlight-color:transparent}
  .ib:hover{background:rgba(255,255,255,.08)}
  .ib:active{transform:scale(.9)}
  .ib-space{width:46px}

  .top{display:grid;grid-template-columns:46px minmax(0,1fr) 46px;align-items:center;text-align:center;position:relative;padding-top:10px}
  .grab{position:absolute;left:50%;top:2px;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(255,255,255,.28)}
  .from{display:grid;gap:1px;min-width:0;color:var(--ink);text-decoration:none}
  .from b{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  a.from:hover b{text-decoration:underline}

  .stage{display:grid;place-items:center;padding:6px 0 2px;position:relative;transition:transform .25s;touch-action:pan-y;user-select:none;-webkit-user-select:none}
  .stage.out-left{transform:translateX(-120%) rotate(-8deg);opacity:0;transition:transform .25s,opacity .25s}
  .stage.out-right{transform:translateX(120%) rotate(8deg);opacity:0;transition:transform .25s,opacity .25s}
  .cover{width:min(100%,360px,40vh);aspect-ratio:1;border-radius:14px;object-fit:cover;display:block;
    box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06),0 0 80px color-mix(in srgb,var(--tint,var(--gas)) 28%,transparent);
    transition:transform .5s cubic-bezier(.3,1.4,.5,1),box-shadow .5s;animation:arrive .45s ease-out}
  .cover.paused{transform:scale(.86);box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05)}
  .cover.blank{display:grid;place-items:center;background:var(--card);color:var(--muted)}
  @keyframes arrive{from{opacity:0;transform:scale(.94)}}
  .burst{position:absolute;color:#ff6b7d;filter:drop-shadow(0 6px 20px rgba(255,107,125,.6));animation:burst .8s ease-out forwards;pointer-events:none}
  .burst :global(.ic){fill:currentColor}
  @keyframes burst{0%{transform:scale(.3);opacity:0}25%{transform:scale(1.15);opacity:1}60%{transform:scale(1)}100%{transform:scale(1.25);opacity:0}}
  @media (prefers-reduced-motion:reduce){ .cover,.stage{transition:none;animation:none} .burst{animation-duration:.01s} }

  .meta{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;margin-top:2px}
  .names{display:grid;gap:3px;min-width:0}
  .name{font:700 23px/1.15 var(--f-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .artist{color:rgba(233,236,255,.72);font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .artist a{color:inherit;text-decoration:none}
  .artist a:hover{color:var(--ink);text-decoration:underline}
  .heart{color:rgba(233,236,255,.8)}
  .heart.on{color:#ff6b7d}
  .heart.on :global(.ic){fill:currentColor;animation:pop .35s ease-out}
  @keyframes pop{50%{transform:scale(1.3)}}

  /* sliders, in the cover's colour */
  input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;margin:0;cursor:pointer;touch-action:none}
  input[type=range]::-webkit-slider-runnable-track{height:5px;border-radius:5px;background:linear-gradient(90deg,var(--tint,var(--ink)) var(--p),rgba(255,255,255,.16) var(--p))}
  input[type=range]::-moz-range-track{height:5px;border-radius:5px;background:linear-gradient(90deg,var(--tint,var(--ink)) var(--p),rgba(255,255,255,.16) var(--p))}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#fff;margin-top:-5px;border:0;box-shadow:0 0 0 4px color-mix(in srgb,var(--tint,var(--gas)) 25%,transparent);transition:transform .15s}
  input[type=range]::-moz-range-thumb{width:15px;height:15px;border-radius:50%;background:#fff;border:0}
  .scrub{position:relative}
  .scrub.active input[type=range]::-webkit-slider-thumb{transform:scale(1.5)}
  .bubble{position:absolute;top:-26px;transform:translateX(-50%);background:var(--ink);color:#06071a;font-size:12px;padding:3px 7px;border-radius:6px;pointer-events:none}
  .times{display:flex;justify-content:space-between;font-size:12px;color:rgba(233,236,255,.6);margin-top:-2px}

  .ctl{display:flex;justify-content:space-between;align-items:center;max-width:420px;width:100%;margin:0 auto}
  .ctl .big{width:74px;height:74px;background:var(--tint,var(--ink));color:var(--tint-ink,#06071a);box-shadow:0 10px 30px color-mix(in srgb,var(--tint,var(--ink)) 35%,transparent)}
  .ctl .big:hover{filter:brightness(1.08);background:var(--tint,var(--ink))}
  .tog{color:rgba(233,236,255,.6)} .tog.on{color:var(--tint,var(--good,#46e6a1))}
  .pip{position:absolute;bottom:6px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:currentColor}

  .where{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:center}
  .dev{appearance:none;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;min-width:0;border:0;background:transparent;color:var(--gas);text-align:left;padding:6px 0;cursor:pointer;min-height:46px}
  .dev .dn{display:grid;min-width:0}
  .dev .label{font-size:10px}
  .dev b{font:600 14px var(--f-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .vol{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:center;color:rgba(233,236,255,.7)}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

  /* a glance at the lyrics and what's next; each opens its own view */
  .glances{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:10px}
  .glance{appearance:none;display:grid;gap:4px;align-content:start;text-align:left;padding:12px 14px 14px;border-radius:16px;cursor:pointer;color:var(--ink);font:inherit;min-width:0;min-height:96px;
    border:1px solid rgba(255,255,255,.08);background:color-mix(in srgb,var(--tint,var(--gas)) 14%,rgba(255,255,255,.04));transition:background .2s,transform .12s}
  .glance:hover{background:color-mix(in srgb,var(--tint,var(--gas)) 20%,rgba(255,255,255,.06))}
  .glance:active{transform:scale(.98)}
  .gh{display:flex;justify-content:space-between;align-items:center;color:rgba(233,236,255,.7);margin-bottom:2px}
  .gl{font:600 14.5px/1.3 var(--f-body);color:rgba(233,236,255,.55);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .gl.now{color:var(--ink);font-weight:700}
  .nxrow{display:grid;grid-template-columns:36px minmax(0,1fr);gap:9px;align-items:center}
  .nxrow img{width:36px;height:36px;border-radius:6px;object-fit:cover}
  .nt{display:grid;min-width:0}
  .nt b{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nt span{font-size:12px;color:rgba(233,236,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* the lyrics and Up next views, with a small player at the top */
  .mini-top{display:grid;grid-template-columns:46px 44px minmax(0,1fr) 46px;gap:10px;align-items:center;padding-top:8px;position:relative;padding-bottom:10px}
  .mini-top img{width:44px;height:44px;border-radius:7px;object-fit:cover}
  .mt{display:grid;min-width:0}
  .mt b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mt span{font-size:13px;color:rgba(233,236,255,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .small-play{background:var(--tint,var(--ink));color:var(--tint-ink,#06071a);width:42px;height:42px}
  .small-play:hover{background:var(--tint,var(--ink));filter:brightness(1.08)}
  .mbar{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden}
  .mbar i{display:block;height:100%;background:var(--tint,var(--ink))}
  .vtabs{display:flex;gap:6px}
  .vtabs button{appearance:none;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:rgba(233,236,255,.7);font:600 13px var(--f-body);border-radius:999px;padding:8px 14px;cursor:pointer;min-height:36px}
  .vtabs button[aria-selected="true"]{background:var(--ink);color:#06071a;border-color:var(--ink)}
  .lyrics-full{flex:1;overflow-y:auto;display:grid;align-content:start;gap:10px;padding:10vh 4px 40vh;margin:0 -4px;
    mask-image:linear-gradient(transparent,#000 10%,#000 80%,transparent);-webkit-mask-image:linear-gradient(transparent,#000 10%,#000 80%,transparent)}
  .line{appearance:none;border:0;background:none;padding:2px 0;text-align:left;font:800 27px/1.28 var(--f-body);letter-spacing:-.01em;color:rgba(233,236,255,.28);cursor:pointer;transition:color .35s,transform .35s,text-shadow .35s;transform-origin:left center}
  .line:hover{color:rgba(233,236,255,.5)}
  .line.done{color:rgba(233,236,255,.5)}
  .line.now{color:#fff;text-shadow:0 0 28px color-mix(in srgb,var(--tint,var(--gas)) 70%,transparent);transform:scale(1.02)}
  .plain p{margin:0;font:600 19px/1.5 var(--f-body)}
  .credit{font-size:12px;color:rgba(233,236,255,.45);margin-top:24px}
  .queue-full{display:grid;gap:10px;align-content:start}
  .queue-full ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}
  .qrow{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:4px 0}
  .qrow img,.qrow .ph{width:44px;height:44px;border-radius:6px;object-fit:cover;background:rgba(255,255,255,.06)}
  .qrow.now .qt b{color:var(--tint,var(--gas))}
  .qt{display:grid;min-width:0}
  .qt b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .qt span{font-size:13px;color:rgba(233,236,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dur{font-size:12px;color:rgba(233,236,255,.45)}
  .empty-view{display:grid;justify-items:center;gap:10px;text-align:center;color:rgba(233,236,255,.6);padding:12vh 20px}
  .empty-view p{margin:0;max-width:30ch}
  .eq{display:inline-flex;align-items:flex-end;gap:2px;height:16px}
  .eq i{width:3px;background:var(--tint,var(--gas));animation:eq 1s ease-in-out infinite;height:40%;border-radius:1px}
  .eq i:nth-child(2){animation-delay:-.4s} .eq i:nth-child(3){animation-delay:-.7s}
  .eq.paused i{animation:none;height:30%}
  @keyframes eq{50%{height:100%}}
  @media (prefers-reduced-motion:reduce){ .eq i{animation:none;height:70%} .line{transition:none} }

  .idle{display:grid;justify-items:center;gap:10px;text-align:center;margin:auto;color:var(--muted)}
  .idle .it{font:700 20px var(--f-body);color:var(--ink);margin:0}

  .sheet.picking > :not(.picker){opacity:.2;pointer-events:none;transition:opacity .2s}
  .picker{position:sticky;bottom:0;margin-top:auto;z-index:2;background:#0b0e24;border:1px solid var(--line-hot);border-radius:22px;padding:10px 12px 14px;display:grid;gap:2px;
    box-shadow:0 -16px 50px rgba(0,0,0,.6);animation:rise .25s cubic-bezier(.2,.85,.25,1)}
  @keyframes rise{from{transform:translateY(30px);opacity:0}}
  @media (prefers-reduced-motion:reduce){ .picker{animation:none} }
  .ph-head{display:flex;justify-content:space-between;align-items:center;padding-left:8px}
  .d{appearance:none;border:0;background:transparent;color:var(--ink);display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;padding:8px;border-radius:14px;cursor:pointer;min-height:58px;font:inherit}
  .d:hover{background:rgba(255,255,255,.06)}
  .dicon{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.06)}
  .d.on{color:var(--gas)}
  .d.on .dicon{background:rgba(79,214,255,.14)}
  .dn{display:grid;min-width:0}
  .dn b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dn span{font-size:12.5px;color:var(--muted)}
  .err{margin:0;padding:10px 12px;border-radius:var(--radius-sm);background:rgba(255,107,125,.12);border:1px solid rgba(255,107,125,.35);font-size:14px}
</style>
