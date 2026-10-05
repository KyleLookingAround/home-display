<script>
  /*
   * Gas against temperature: a dot a day, the fitted line, and hollow dots for the forecast week.
   * Tap, point or use the arrow keys to read a dot.
   */
  import { niceScale, fmtTick, clamp, shortDate, keyDate } from '../../lib/format.js';
  let { points = [], forecast = [], fit = null, aria = 'Gas against temperature' } = $props();   // points: [{ k, temp, g }]; fit: { a, b }
  let width = $state(340), sel = $state(null);
  const H = 220, P = { l: 34, r: 8, t: 10, b: 30 };
  const W = $derived(Math.max(260, width || 340));
  const all = $derived(points.concat(forecast));
  const xs = $derived(niceScale(Math.min(...all.map(p => p.temp)) - 1, Math.max(...all.map(p => p.temp)) + 1, 4));
  const ys = $derived(niceScale(0, Math.max(1, ...all.map(p => p.g)), 3));
  const x = t => P.l + (t - xs.lo) / (xs.hi - xs.lo) * (W - P.l - P.r);
  const y = v => P.t + (H - P.t - P.b) - (v - ys.lo) / (ys.hi - ys.lo) * (H - P.t - P.b);
  const yt = $derived.by(() => { const o = []; for (let v = ys.lo; v <= ys.hi + 1e-9; v += ys.step) o.push(v); return o; });
  const xt = $derived.by(() => { const o = []; for (let v = xs.lo; v <= xs.hi + 1e-9; v += xs.step) o.push(v); return o; });
  const line = $derived.by(() => { if (!fit) return ''; let d = ''; for (let t = xs.lo; t <= xs.hi; t += (xs.hi - xs.lo) / 60) d += `${d ? 'L' : 'M'}${x(t).toFixed(1)},${y(fit.a + fit.b * Math.max(0, 15.5 - t)).toFixed(1)}`; return d; });
  const keys = ev => { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; ev.preventDefault(); sel = clamp((sel == null ? 0 : sel) + (ev.key === 'ArrowRight' ? 1 : -1), 0, all.length - 1); };
  const tip = $derived(sel != null && all[sel] ? all[sel] : null);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chart" bind:clientWidth={width} tabindex="0" role="group" aria-label={aria} onkeydown={keys} onblur={() => { sel = null; }}>
  {#if all.length}
    <svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
      {#each yt as v}<line class="grid" x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)}/><text x={P.l - 6} y={y(v) + 4} text-anchor="end">{fmtTick(v)}</text>{/each}
      {#each xt as t}<text x={x(t)} y={H - 12} text-anchor="middle">{fmtTick(t)}°</text>{/each}
      <text x={W - P.r} y={H} text-anchor="end">daily mean temperature</text>
      {#if line}<path d={line} fill="none" stroke="var(--elec)" stroke-width="2"/>{/if}
      {#each all as p, i}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <circle cx={x(p.temp)} cy={y(p.g)} r={sel === i ? 6 : 4} fill={i >= points.length ? 'none' : 'var(--gas)'} stroke={i >= points.length ? 'var(--warn)' : 'none'} stroke-width="1.6" opacity=".9"
                onpointerenter={() => { sel = i; }} onclick={() => { sel = i; }}/>
      {/each}
    </svg>
    {#if tip}<div class="tip" style="left:{clamp(x(tip.temp), 80, W - 80)}px;top:{y(tip.g)}px">{shortDate(keyDate(tip.k))}{sel >= points.length ? ' forecast' : ''} · {tip.temp}° · {tip.g.toFixed(1)} kWh</div>{/if}
  {/if}
</div>
