<script>
  /*
   * Your office days for the week ahead: your usual week (Settings, Household) until you change a day here. Tap a
   * day, then say whether you're in and your hours. A change is for that day only; it stays on this phone and goes
   * to the paired TV, sealed with the site's PIN, so the trains on both follow it.
   */
  import { app } from '../../state/app.svelte.js';
  import { savePlan, commuteToTv } from '../../state/house.js';
  import { tv, watchTv } from '../../state/tv.svelte.js';
  import { where } from '../../state/where.svelte.js';
  import { onMount } from 'svelte';
  import { officeDay, DAY_NAMES } from '../../lib/household.js';
  import { addDays, startOfDay } from '../../lib/format.js';
  const TIMES = Array.from({ length: 65 }, (_, i) => String(6 + Math.floor(i / 4)).padStart(2, '0') + ':' + String(i % 4 * 15).padStart(2, '0'));
  let pick = $state(0), note = $state('');
  onMount(() => { watchTv(); });
  const days = $derived(Array.from({ length: 7 }, (_, i) => {
    const t = +addDays(startOfDay(new Date(app.now)), i) + 12 * 3600e3;
    return { i, t, ...officeDay(app.house, t, app.holidays) };
  }));
  const day = $derived(days[pick]);
  const name = d => d.i === 0 ? 'Today' : d.i === 1 ? 'Tomorrow' : DAY_NAMES[new Date(d.t).getDay()];

  /** Keeps the day as given, or drops the change when it's your usual day after all. */
  function put(o){
    const s = app.house, plan = { ...(s.plan || {}) };
    const usual = o.in === day.usual && (!o.in || (o.start === s.workStart && o.end === s.workEnd));
    if (usual) delete plan[day.key]; else plan[day.key] = o.in ? { in: true, start: o.start, end: o.end } : { in: false };
    savePlan(plan); send();
  }
  const toggle = () => put({ in: !day.in, start: day.start, end: day.end });
  const usual = () => put({ in: day.usual, start: app.house.workStart, end: app.house.workEnd });

  /** To the paired TV, a moment after the last change (commuteToTv). */
  async function send(){ note = ''; note = await commuteToTv(); }
</script>

<div class="office">
  <h3 class="label">Office days</h3>
  <div class="week" role="group" aria-label="The next seven days">
    {#each days as d}
      <button type="button" class="d" class:in={d.in} class:sel={d.i === pick} class:changed={d.changed} aria-pressed={d.i === pick}
              aria-label="{name(d)}: {d.in ? 'in the office' : 'not in'}{d.changed ? ', changed' : ''}" onclick={() => { pick = d.i; }}>
        <span class="w">{d.i === 0 ? 'Today' : DAY_NAMES[new Date(d.t).getDay()].slice(0, 3)}</span><span class="s">{d.in ? 'In' : 'Off'}</span>
      </button>
    {/each}
  </div>
  <div class="day">
    <label class="sw"><input type="checkbox" checked={day.in} onchange={toggle}><span>{name(day)}: {day.in ? 'in the office' : 'not in'}</span></label>
    {#if day.in}
      <div class="hours">
        <label>Start <select value={day.start} onchange={e => put({ in: true, start: e.currentTarget.value, end: day.end })}>{#each TIMES as t}<option>{t}</option>{/each}</select></label>
        <label>Finish <select value={day.end} onchange={e => put({ in: true, start: day.start, end: e.currentTarget.value })}>{#each TIMES as t}<option>{t}</option>{/each}</select></label>
      </div>
    {/if}
    {#if day.changed}<button type="button" class="btn small" onclick={usual}>Back to your usual {DAY_NAMES[new Date(day.t).getDay()]}</button>{/if}
  </div>
  {#if where.note}<p class="note at-work" role="status">{where.note}</p>{/if}
  <p class="note" role="status">{note || (tv.code ? 'Changes stay on this phone and go to the TV.' : (app.house.workDays && app.house.workDays.length ? 'Changes stay on this phone. Your usual week is in Settings, Household.' : 'Tap a day you\'re in, or set your usual days in Settings, Household.'))}</p>
</div>

<style>
  .office{margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--line)}
  .office h3{margin:0 0 var(--s2)}
  .week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
  .d{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0;border:1px solid var(--line);border-radius:var(--radius-sm);background:transparent;color:var(--muted);cursor:pointer;min-width:0}
  .d .w{font:500 12px/1.2 var(--f-body)}
  .d .s{font:500 13px/1.2 var(--f-mono)}
  .d.in{color:var(--ink);background:rgba(255,181,71,.10)}
  .d.in .s{color:var(--elec)}
  .d.changed{border-style:dashed;border-color:var(--line-hot)}
  .d.sel{border:1px solid var(--elec);box-shadow:0 0 0 1px var(--elec) inset}
  .d:focus-visible{outline:2px solid var(--gas);outline-offset:2px}
  .day{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s3);margin-top:var(--s3)}
  .sw{display:flex;align-items:center;gap:8px;font-weight:500;cursor:pointer}
  .sw input{width:18px;height:18px;accent-color:var(--elec)}
  .hours{display:flex;gap:var(--s3)}
  .hours label{display:flex;align-items:center;gap:6px;font-size:14px;color:var(--muted)}
  .hours select{font:500 15px var(--f-mono);color:var(--ink);background:var(--card-2);border:1px solid var(--line-hot);border-radius:var(--radius-sm);padding:6px 8px}
  .note{margin-top:var(--s2)}
  .at-work{color:var(--neg)}
</style>
