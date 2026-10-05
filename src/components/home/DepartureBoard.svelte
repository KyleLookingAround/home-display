<script>
  /*
   * The trains as the station shows them: orange dot-matrix on black. Tap for the next view:
   *   the platform sign (1st, 2nd, 3rd, where the first calls, and the clock),
   *   the departures board (time, destination, platform, expected), and
   *   when to leave (with your walk).
   * The platform sign starts at the first train you can still make; the departures board dims the ones you can't.
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { leaveBy, catchable } from '../../lib/household.js';
  import { hhmm, pad2 } from '../../lib/format.js';
  let { trains, walk = 0 } = $props();
  const VIEWS = [{ id: 'platform', label: 'Platform sign' }, { id: 'board', label: 'Departures' }, { id: 'leave', label: 'When to leave' }];
  let v = $state(0), clock = $state(Date.now()), still = $state(false);
  onMount(() => {
    const i = VIEWS.findIndex(x => x.id === store.get('boardView')); if (i >= 0) v = i;
    still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setInterval(() => { clock = Date.now(); }, 1000);
    return () => clearInterval(t);
  });
  const next = () => { v = (v + 1) % VIEWS.length; store.set('boardView', VIEWS[v].id); };
  const key = ev => { if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); next(); } };

  const live = $derived((trains && trains.list ? trains.list : []).filter(d => (d.exp || d.sched) > clock - 30e3));
  const caught = $derived(catchable(live, walk, clock));
  const first3 = $derived(caught.list.slice(0, 3));
  // the departures board: from just above the first you can make
  const board = $derived.by(() => { const i = live.indexOf(caught.list[0]); return live.slice(Math.max(0, (i < 0 ? live.length : i) - 1)).slice(0, 7); });
  const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  const status = d => d.cancelled ? 'Cancelled' : d.delayed ? 'Delayed' : d.exp && d.exp - d.sched >= 60e3 ? 'Exp ' + hhmm(d.exp) : 'On time';
  const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
  const going = d => { const l = leaveBy(d.exp || d.sched, walk, clock); return d.cancelled ? 'Cancelled' : l.mins > 1 ? `Go in ${l.mins} min` : l.text === 'Leave now' ? 'Go now' : l.text === 'Run for it' ? 'Run for it' : 'Too late'; };
  const scroller = $derived.by(() => {
    const d = first3[0]; if (!d) return '';
    const parts = [];
    if (d.platform) parts.push(`Platform ${d.platform}.`);
    if (d.calls && d.calls.length) parts.push(`Calling at: ${list(d.calls)}.`);
    if (d.coaches) parts.push(`This train has ${d.coaches} coaches.`);
    if (d.operator) parts.push(`A ${d.operator} service.`);
    if (d.reason) parts.push(d.reason.replace(/\.?$/, '.'));
    if (trains.messages && trains.messages.length) parts.push(trains.messages[0]);
    return parts.join('  ');
  });
  const time = $derived.by(() => { const d = new Date(clock); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; });
</script>

<div class="dmx {VIEWS[v].id}" role="button" tabindex="0" onclick={next} onkeydown={key}
     aria-label="Departures, shown as {VIEWS[v].label.toLowerCase()}. Tap for {VIEWS[(v + 1) % VIEWS.length].label.toLowerCase()}.">
  {#if VIEWS[v].id === 'platform'}
    {#if first3.length}
      {#each first3 as d, i}
        <div class="row" class:gap={i === 1}><span class="o">{ord(i + 1)}</span><span class="t">{hhmm(d.sched)}</span><span class="d">{d.dest}</span><span class="s">{status(d)}</span></div>
        {#if i === 0 && scroller}
          <div class="row calls" aria-label={scroller}>{#if still}<span class="wrap">{scroller}</span>{:else}<span class="run" style="animation-duration:{Math.max(8, scroller.length * 0.16)}s">{scroller}</span>{/if}</div>
        {/if}
      {/each}
    {:else}
      <div class="row centre">{caught.missed ? 'No more you can make' : 'No trains for now'}</div>
      <div class="row centre dim">Please check the timetable</div>
    {/if}
    <div class="clock"><span class="side">{@render pips()}</span><span>{time}</span><span class="side"></span></div>
  {:else if VIEWS[v].id === 'board'}
    <div class="row hdr"><span class="t">Time</span><span class="d">Destination</span><span class="p">Plat</span><span class="s">Expt</span></div>
    {#each board as d}
      <div class="row" class:dim={!d.cancelled && leaveBy(d.exp || d.sched, walk, clock).text === 'Too late'}><span class="t">{hhmm(d.sched)}</span><span class="d">{d.dest}</span><span class="p">{d.platform || '-'}</span><span class="s">{d.cancelled ? 'Cancelled' : d.delayed ? 'Delayed' : d.exp && d.exp - d.sched >= 60e3 ? hhmm(d.exp) : 'On time'}</span></div>
    {:else}<div class="row centre">No departures listed</div>{/each}
    <div class="foot"><span>{trains.station || ''}</span>{@render pips()}<span>{time}</span></div>
  {:else}
    <div class="row hdr"><span class="t">Time</span><span class="d">To</span><span class="s">With your walk</span></div>
    {#each caught.list.slice(0, 6) as d}
      {@const g = going(d)}
      <div class="row"><span class="t">{hhmm(d.exp || d.sched)}</span><span class="d">{d.dest}</span><span class="s" class:blink={g === 'Run for it' && !still}>{g}</span></div>
    {:else}<div class="row centre">{caught.missed ? 'No more you can make' : 'No trains for now'}</div>{/each}
    <div class="foot"><span>{walk} min walk</span>{@render pips()}<span>{time}</span></div>
  {/if}
</div>

{#snippet pips()}<span class="pips" aria-hidden="true">{#each VIEWS as x, i}<i class:on={i === v}></i>{/each}</span>{/snippet}

<style>
  .dmx{position:relative;display:block;width:100%;background:#050403;border:2px solid #1d1a16;border-radius:var(--radius-sm);padding:10px 12px 12px;cursor:pointer;
    font:800 15px/1.5 "Doto",var(--f-mono);color:#ffa31a;text-shadow:0 0 6px rgba(255,150,0,.55);box-shadow:inset 0 0 18px rgba(0,0,0,.9);overflow:hidden;
    -webkit-tap-highlight-color:transparent;user-select:none}
  /* the gaps between the LEDs */
  .dmx::after{content:"";position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;background-image:radial-gradient(rgba(0,0,0,0) 55%,rgba(0,0,0,.35) 56%);background-size:3px 3px}
  .dmx:focus-visible{outline:3px solid var(--gas);outline-offset:3px}
  /* Doto is monospaced, so columns in ch line up as on the real sign */
  .row{display:grid;column-gap:1ch;align-items:baseline;white-space:nowrap;min-width:0}
  .platform .row{grid-template-columns:3ch 5ch minmax(0,1fr) auto}
  .board .row{grid-template-columns:5ch minmax(0,1fr) 3ch 9ch}
  .leave .row{grid-template-columns:5ch minmax(0,1fr) auto}
  .row.gap{margin-top:2px}
  .d{min-width:0;overflow:hidden;text-overflow:ellipsis}
  .p{text-align:center}
  .s{text-align:right}
  .hdr{opacity:.75}
  .dim{opacity:.4}
  .dmx .row.centre{display:block;text-align:center}
  .dmx .row.calls{overflow:hidden;display:block}
  .calls .run{display:inline-block;padding-left:100%;animation:run linear infinite}
  .calls .wrap{white-space:normal;display:block}
  @keyframes run{to{transform:translateX(-100%)}}
  .clock{display:flex;align-items:center;justify-content:space-between;font-size:24px;line-height:1.3;margin-top:4px;letter-spacing:.06em}
  .clock .side{flex:1;display:flex}
  .foot{display:flex;align-items:center;justify-content:space-between;margin-top:4px;opacity:.85}
  .blink{animation:blink 1s steps(2,start) infinite}
  @keyframes blink{to{visibility:hidden}}
  .pips{display:inline-flex;gap:4px}
  .pips i{width:5px;height:5px;border-radius:50%;background:#ffa31a;opacity:.25}
  .pips i.on{opacity:1}
  @media (prefers-reduced-motion: reduce){ .calls .run,.blink{animation:none} }
</style>
