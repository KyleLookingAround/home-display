<script>
  /*
   * The house queue, kept by the TV (src/display/tvqueue.js): the songs everyone has added, in the order they'll
   * play. Drag a song by its handle (or use the arrow keys on it) to move it, tap the heart to vote it up, and the
   * cross to take it out. The song at the top is handed to Spotify just before the one playing ends; from then on it's
   * Spotify's and stays put. A party lets guests add songs too, from a code they scan on the TV.
   */
  import { tv, tvQueue, tvSend, me } from '../../state/tv.svelte.js';
  import { coverUrl } from '../../lib/queue.js';
  import { qrSvg } from '../../lib/qr.js';
  import { haptic } from '../../state/music.svelte.js';
  import Icon from './Icon.svelte';

  let { compact = false } = $props();
  let shown = $state.raw(null);                       // a change shown at once, until the TV answers with the queue
  let answer = $state.raw(null);
  $effect(() => { if (tv.state !== answer){ answer = tv.state; shown = null; } });
  const items = $derived(shown || tv.queue);
  const more = $derived(tv.state ? tv.state.more : 0);
  const myId = typeof window === 'undefined' ? '' : me().id;
  const lo = $derived(items.findIndex(x => !x.fed) < 0 ? items.length : items.findIndex(x => !x.fed));

  /* ---------- moving: drag the handle, or arrow keys on it ---------- */
  let drag = $state(null);
  const target = $derived(drag ? Math.max(lo, Math.min(items.length - 1, drag.from + Math.round(drag.dy / drag.h))) : -1);
  const shift = i => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < target && i > drag.from && i <= target) return -drag.h;
    if (drag.from > target && i < drag.from && i >= target) return drag.h;
    return 0;
  };
  function grab(e, i){
    if (e.button > 0) return;
    e.preventDefault();
    const row = e.currentTarget.closest('li');
    drag = { from: i, id: items[i].id, y0: e.clientY, dy: 0, h: row.offsetHeight + 4 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err){}
    haptic();
  }
  function slide(e){ if (drag) drag = Object.assign({}, drag, { dy: e.clientY - drag.y0 }); }
  function drop(){
    if (!drag) return;
    const d = drag, to = target;
    drag = null;
    if (to !== d.from) move(d.id, d.from, to);
  }
  function move(id, from, to){
    to = Math.max(lo, Math.min(items.length - 1, to));
    if (to === from) return;
    const list = items.slice(), it = list.splice(from, 1)[0];
    list.splice(to, 0, it);
    shown = list; haptic();
    tvQueue('move', { id, to });
  }
  function key(e, i){
    if (e.key === 'ArrowUp'){ e.preventDefault(); move(items[i].id, i, i - 1); }
    if (e.key === 'ArrowDown'){ e.preventDefault(); move(items[i].id, i, i + 1); }
  }
  function vote(x){
    const had = x.votes.includes(myId);
    shown = items.map(y => y.id === x.id ? Object.assign({}, y, { votes: had ? y.votes.filter(v => v !== myId) : y.votes.concat([myId]) }) : y);
    haptic(); tvQueue('vote', { id: x.id });
  }
  function remove(x){ shown = items.filter(y => y.id !== x.id); haptic(); tvQueue('remove', { id: x.id }); }

  /* ---------- a party ---------- */
  const partyUrl = $derived(tv.party && typeof location !== 'undefined' ? new URL('party.html#' + tv.party, location.href).href : '');
  let asking = $state(false);
  async function party(on){ asking = true; haptic(); await tvSend('party', { on }); setTimeout(() => { asking = false; }, 2500); }
  $effect(() => { tv.party; asking = false; });
</script>

<section class="house" class:compact aria-label="The house queue">
  <div class="hhead">
    <span class="label">The house queue</span>
    <span class="where">on the TV{tv.spotify ? ' · as ' + tv.spotify : ''}</span>
  </div>
  {#if items.length}
    <ol class="hq" onpointermove={slide} onpointerup={drop} onpointercancel={() => { drag = null; }}>
      {#each items as x, i (x.id)}
        <li class:fed={x.fed} class:lifted={drag && drag.from === i} style={drag ? `transform:translateY(${drag.from === i ? drag.dy : shift(i)}px)` : ''}>
          {#if x.fed}<span class="handle off" title="Next: Spotify has it"><Icon name="next" size={16} /></span>
          {:else}<button class="handle" type="button" aria-label="Move {x.name}: drag, or use the arrow keys" onpointerdown={e => grab(e, i)} onkeydown={e => key(e, i)}><span aria-hidden="true"></span></button>{/if}
          {#if x.img}<img src={coverUrl(x.img)} alt="" width="40" height="40" loading="lazy">{:else}<span class="ph"></span>{/if}
          <span class="tx"><b>{x.name}</b><span>{x.artist}{#if x.by.name}<em class="by">{x.by.name}</em>{/if}</span></span>
          {#if x.fed}<span class="nextup mono">Next</span>
          {:else}
            <button class="vote" class:on={x.votes.includes(myId)} type="button" aria-pressed={x.votes.includes(myId)} aria-label="Vote for {x.name}{x.votes.length ? ', ' + x.votes.length + (x.votes.length === 1 ? ' vote' : ' votes') : ''}" onclick={() => vote(x)}>
              <Icon name="heart" size={18} />{#if x.votes.length}<span class="n mono">{x.votes.length}</span>{/if}</button>
            <button class="rm" type="button" aria-label="Take {x.name} out of the queue" onclick={() => remove(x)}><Icon name="close" size={16} /></button>
          {/if}
        </li>
      {/each}
    </ol>
    {#if more}<p class="note">And {more} more after these.</p>{/if}
  {:else}
    <p class="note">Songs you add with + go here, and the TV plays them next. Anyone in the house can move them, take them out or vote them up.</p>
  {/if}

  <div class="party" class:on={!!tv.party}>
    {#if tv.party}
      <div class="pqr">{@html qrSvg(partyUrl, { label: 'Code guests scan to add songs' })}</div>
      <div class="ptx">
        <span class="label">Party on</span>
        <b class="mono">{tv.party.slice(0, 4)}-{tv.party.slice(4)}</b>
        <span class="note">Guests scan this, or the code on the TV, to add up to three songs each and vote. No sign-in.</span>
        <div class="acts"><button class="btn small" type="button" onclick={() => tvSend('mode', { mode: 'music' })}>Show it on the TV</button>
          <button class="btn small" type="button" disabled={asking} onclick={() => party(false)}>End the party</button></div>
      </div>
    {:else}
      <div class="ptx">
        <span class="label">Having people round?</span>
        <span class="note">Start a party and the TV shows a code. Guests scan it to add songs and vote, with no app and no sign-in.</span>
        <div class="acts"><button class="btn primary small" type="button" disabled={asking || !tv.spotify} onclick={() => party(true)}><Icon name="party" size={16} />{asking ? 'Starting…' : 'Start a party'}</button></div>
      </div>
    {/if}
  </div>
</section>

<style>
  .house{display:grid;gap:10px}
  .hhead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .where{font:500 12px/1.2 var(--f-mono);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hq{list-style:none;margin:0;padding:0;display:grid;gap:4px;touch-action:none}
  .hq li{display:grid;grid-template-columns:32px 40px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:4px 4px 4px 0;border-radius:var(--radius-sm);
    background:transparent;transition:transform .18s cubic-bezier(.2,.8,.2,1),background .2s,box-shadow .2s;position:relative}
  .hq li.lifted{transition:none;z-index:2;background:var(--card);box-shadow:0 10px 28px rgba(0,0,0,.55),0 0 0 1px var(--line-hot)}
  .hq li.fed{background:color-mix(in srgb,var(--gas) 8%,transparent)}
  .handle{appearance:none;border:0;background:transparent;color:var(--faint);width:32px;height:44px;display:grid;place-items:center;cursor:grab;touch-action:none;border-radius:var(--radius-sm)}
  .handle span{width:12px;height:14px;background:radial-gradient(circle,currentColor 1.3px,transparent 1.6px) 0 0/6px 5px}
  .handle:hover,.handle:focus-visible{color:var(--gas)}
  .handle.off{cursor:default;color:var(--gas)}
  .hq img,.ph{width:40px;height:40px;border-radius:var(--radius-sm);object-fit:cover;background:var(--card-2);display:block}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tx span{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .by{font:500 10.5px/1 var(--f-mono);font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--neg);margin-left:8px}
  .nextup{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gas);padding-right:6px;grid-column:span 2}
  .vote,.rm{appearance:none;border:0;background:transparent;color:var(--muted);height:40px;min-width:40px;border-radius:20px;display:inline-flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;padding:0 6px}
  .vote:hover,.rm:hover{background:var(--sel);color:var(--ink)}
  .vote.on{color:var(--cal)}
  .vote.on :global(svg){fill:currentColor}
  .n{font-size:12px}
  .party{display:grid;grid-template-columns:auto;gap:14px;align-items:center;margin-top:6px;padding:14px;border-radius:var(--radius);border:1px dashed var(--line-hot)}
  .party.on{grid-template-columns:120px minmax(0,1fr);border:1px solid color-mix(in srgb,var(--neg) 55%,transparent);background:color-mix(in srgb,var(--neg) 9%,transparent);box-shadow:0 0 30px -10px var(--neg)}
  .pqr{width:120px;height:120px;border-radius:var(--radius-sm);overflow:hidden}
  .pqr :global(svg){display:block;width:100%;height:100%}
  .ptx{display:grid;gap:4px;min-width:0}
  .ptx b{font-size:20px;letter-spacing:.14em;color:var(--gas)}
  .ptx .note{margin:0}
  .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
  .acts .btn{gap:6px}
  .compact .party{margin-top:2px}
</style>
