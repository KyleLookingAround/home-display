<script>
  /*
   * Every day with readings, as a calendar: one square a day, a week a column, brighter the more was used.
   * Tap, point or use the arrow keys to read a day.
   */
  import { clamp, DOW, fmtDate, keyDate, MON } from '../../lib/format.js';
  let { days = [], colour = '255,181,71', fmt = v => String(v), aria = 'Every day' } = $props();   // days: [{ k, v }], oldest first

  let width = $state(340), sel = $state(null);
  const gap = 3;
  const cells = $derived.by(() => {
    if (!days.length) return { list: [], weeks: 0 };
    const first = keyDate(days[0].k), lead = (first.getDay() + 6) % 7;             // Monday at the top
    return { list: days.map((d, i) => ({ ...d, col: Math.floor((i + lead) / 7), row: (i + lead) % 7 })), weeks: Math.floor((days.length - 1 + lead) / 7) + 1 };
  });
  const size = $derived(Math.max(8, Math.min(22, Math.floor((Math.max(260, width) - 26 - gap * cells.weeks) / Math.max(1, cells.weeks)))));
  const max = $derived(Math.max(0.001, ...days.map(d => d.v || 0)));
  const fill = v => v == null ? 'rgba(134,152,255,.06)' : `rgba(${colour},${(0.12 + 0.88 * Math.pow(v / max, 0.8)).toFixed(3)})`;
  const W = $derived(26 + cells.weeks * (size + gap)), H = $derived(7 * (size + gap) + 18);
  const months = $derived.by(() => { const o = []; let last = -1; cells.list.forEach(c => { const d = keyDate(c.k); if (d.getDate() <= 7 && c.row === 0 && d.getMonth() !== last){ o.push({ x: 26 + c.col * (size + gap), text: MON[d.getMonth()] }); last = d.getMonth(); } }); return o; });
  const tip = $derived(sel != null && cells.list[sel] ? { c: cells.list[sel] } : null);
  const keys = ev => {
    const step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[ev.key]; if (!step) return;
    ev.preventDefault(); sel = clamp((sel == null ? days.length - 1 : sel) + step, 0, days.length - 1);
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chart" bind:clientWidth={width} tabindex="0" role="group" aria-label={aria} onkeydown={keys} onblur={() => { sel = null; }}>
  <svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
    {#each ['M', '', 'W', '', 'F', '', 'S'] as d, r}{#if d}<text x="0" y={16 + r * (size + gap) + size * .75}>{d}</text>{/if}{/each}
    {#each months as m}<text x={m.x} y="10">{m.text}</text>{/each}
    {#each cells.list as c, i}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <rect x={26 + c.col * (size + gap)} y={16 + c.row * (size + gap)} width={size} height={size} rx={Math.min(4, size / 4)} fill={fill(c.v)}
            stroke={sel === i ? 'var(--ink)' : 'none'} stroke-width="1.5" onpointerenter={() => { sel = i; }} onclick={() => { sel = i; }}/>
    {/each}
  </svg>
  {#if tip}<div class="tip" style="left:{clamp(26 + tip.c.col * (size + gap) + size / 2, 80, width - 80)}px;top:{16 + tip.c.row * (size + gap)}px">{fmtDate(keyDate(tip.c.k))} · {tip.c.v == null ? 'no readings' : fmt(tip.c.v)}</div>{/if}
</div>
