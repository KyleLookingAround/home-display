<script>
  /*
   * A day of use round a 24-hour clock: one spoke per half hour, longer for more, midnight at the top. The cheap
   * overnight window and the evening peak are marked on the rim. Tap, point or use the arrow keys to read a half hour.
   */
  import { slotLabel, clamp } from '../../lib/format.js';
  let { values = [], colour = 'var(--elec)', centre = '', centreSub = '', fmt = v => v.toFixed(2), aria = 'Use by time of day', selected = $bindable(null) } = $props();
  const S = 300, C = S / 2, r0 = 58, r1 = 132;
  const max = $derived(Math.max(0.001, ...values));
  const ang = i => (i / 48) * Math.PI * 2 - Math.PI / 2;
  const pt = (i, r) => [C + Math.cos(ang(i)) * r, C + Math.sin(ang(i)) * r];
  const arc = (a, b, r) => { const [x0, y0] = pt(a, r), [x1, y1] = pt(b, r); return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${(b - a) > 24 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  const spokes = $derived(values.map((v, i) => { const mid = i + .5, len = r0 + (r1 - r0) * (v / max), [x0, y0] = pt(mid, r0), [x1, y1] = pt(mid, Math.max(r0 + 2, len)); return { x0, y0, x1, y1 }; }));
  function pick(ev){
    const r = ev.currentTarget.getBoundingClientRect(), k = S / r.width, dx = (ev.clientX - r.left) * k - C, dy = (ev.clientY - r.top) * k - C;
    if (Math.hypot(dx, dy) < r0 - 20) return;
    let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
    selected = Math.floor(a / (Math.PI * 2) * 48) % 48;
  }
  const keys = ev => { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; ev.preventDefault(); selected = ((selected == null ? 0 : selected) + (ev.key === 'ArrowRight' ? 1 : 47)) % 48; };
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chart clock" tabindex="0" role="group" aria-label={aria} onpointerdown={pick} onpointermove={ev => { if (ev.pointerType === 'mouse') pick(ev); }} onkeydown={keys}>
  <svg viewBox="0 0 {S} {S}" aria-hidden="true">
    <circle cx={C} cy={C} r={r1 + 6} fill="none" stroke="var(--line)"/>
    <path d={arc(1, 11, r1 + 6)} fill="none" stroke="var(--cheap)" stroke-width="4" stroke-linecap="round"/>
    <path d={arc(32, 38, r1 + 6)} fill="none" stroke="var(--peak)" stroke-width="4" stroke-linecap="round"/>
    <circle cx={C} cy={C} r={r0 - 4} fill="rgba(4,5,13,.6)" stroke="var(--line)"/>
    {#each spokes as s, i}<line x1={s.x0} y1={s.y0} x2={s.x1} y2={s.y1} stroke={colour} stroke-width="4" stroke-linecap="round" opacity={selected == null || selected === i ? 1 : .45}/>{/each}
    {#each [[0, '00'], [12, '06'], [24, '12'], [36, '18']] as [i, t]}{@const p = pt(i, r1 + 20)}<text x={p[0]} y={p[1] + 4} text-anchor="middle">{t}</text>{/each}
    {#if selected != null && values[selected] != null}
      <text x={C} y={C - 4} text-anchor="middle" class="c-big">{fmt(values[selected])}</text>
      <text x={C} y={C + 16} text-anchor="middle">{slotLabel(selected)}–{slotLabel(selected + 1)}</text>
    {:else}
      <text x={C} y={C - 4} text-anchor="middle" class="c-big">{centre}</text>
      <text x={C} y={C + 16} text-anchor="middle">{centreSub}</text>
    {/if}
  </svg>
</div>

<style>
  .clock{max-width:320px;margin:0 auto}
  .clock svg{width:100%;height:auto}
  .clock :global(.c-big){font:500 20px var(--f-mono);fill:var(--ink)}
</style>
