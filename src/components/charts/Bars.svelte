<script>
  /*
   * Bars over days (or months): stacked segments, an optional ghost behind each bar for the period before, and marks
   * for changes from your log. Tap, point or use the arrow keys to read a bar; `selected` is bound by the parent.
   */
  import { niceScale, fmtTick, sum, clamp } from '../../lib/format.js';
  let {
    items = [], height = 190, ghost = null, marks = [], yFmt = fmtTick, tipText = null, aria = 'Chart',
    empty = 'Nothing to show yet.', defaultSel = null, selected = $bindable(null)
  } = $props();

  let width = $state(340), hover = $state(false);
  const P = { l: 34, r: 4, t: 12, b: 22 };
  const W = $derived(Math.max(260, width || 340));
  const n = $derived(items.length);
  const sc = $derived(niceScale(0, Math.max(0.01, ...items.map(it => sum(it.segs.map(s => Math.max(0, s.v)))), ...(ghost || []).map(v => v || 0)), 3));
  const iw = $derived(W - P.l - P.r), ih = $derived(height - P.t - P.b), bw = $derived(n ? iw / n : 0), gap = $derived(Math.min(4, bw * 0.28));
  const y = v => P.t + ih - (v - sc.lo) / (sc.hi - sc.lo) * ih;
  const ticks = $derived.by(() => { const o = []; for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) o.push(Math.round(v * 1e6) / 1e6); return o; });
  const bars = $derived.by(() => {
    const out = [];
    items.forEach((it, i) => {
      const bx = P.l + i * bw + gap / 2, w = Math.max(1.5, bw - gap); let acc = 0;
      it.segs.forEach((s, k) => { if (s.v > 0){ out.push({ cls: s.cls, x: bx, w, y: y(acc + s.v), h: Math.max(.5, y(acc) - y(acc + s.v)), top: k === it.segs.length - 1 || !it.segs.slice(k + 1).some(z => z.v > 0) }); acc += s.v; } });
    });
    return out;
  });
  const labels = $derived.by(() => { const o = []; let last = -1e9; items.forEach((it, i) => { const lx = P.l + i * bw + bw / 2; if (it.label && lx - last >= 48){ o.push({ x: lx, text: it.label }); last = lx; } }); return o; });
  $effect(() => { if (n && (selected == null || selected >= n)) selected = defaultSel != null && defaultSel < n ? defaultSel : n - 1; });
  const pick = ev => { const r = ev.currentTarget.getBoundingClientRect(), i = Math.floor((ev.clientX - r.left - P.l) / bw); if (i >= 0 && i < n) selected = i; };
  const keys = ev => { if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return; ev.preventDefault(); selected = clamp((selected || 0) + (ev.key === 'ArrowRight' ? 1 : -1), 0, n - 1); };
  const tip = $derived(selected != null && items[selected] && tipText && hover ? { x: P.l + selected * bw + bw / 2, y: y(sum(items[selected].segs.map(s => Math.max(0, s.v)))), text: tipText(selected) } : null);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chart" bind:clientWidth={width} tabindex="0" role="group" aria-label={aria}
     onpointermove={ev => { if (ev.pointerType === 'mouse'){ hover = true; pick(ev); } }} onpointerdown={ev => { hover = true; pick(ev); }}
     onpointerleave={ev => { if (ev.pointerType === 'mouse') hover = false; }} onkeydown={ev => { hover = true; keys(ev); }} onblur={() => { hover = false; }}>
  {#if !n}
    <p class="empty-chart">{empty}</p>
  {:else}
    <svg width={W} {height} viewBox="0 0 {W} {height}" aria-hidden="true">
      {#each ticks as v}<line class="grid" x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)}/><text x={P.l - 6} y={y(v) + 4} text-anchor="end">{yFmt(v)}</text>{/each}
      {#if ghost}{#each ghost as g, i}{#if g > 0}<rect x={P.l + i * bw + gap / 2} y={y(g)} width={Math.max(1.5, bw - gap)} height={Math.max(.5, y(0) - y(g))} rx="3" fill="none" stroke="var(--muted)" stroke-opacity=".45" stroke-dasharray="2 2"/>{/if}{/each}{/if}
      {#if selected != null}<rect x={P.l + selected * bw} y={P.t} width={bw} height={ih} fill="var(--sel)" rx="4"/>{/if}
      {#each bars as b}<rect class={b.cls} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.top ? Math.min(3, b.w / 2) : 0}/>{/each}
      {#each marks as m}<line x1={P.l + m.i * bw + bw / 2} x2={P.l + m.i * bw + bw / 2} y1={P.t} y2={P.t + ih} stroke="var(--cal)" stroke-width="1.5"/><circle cx={P.l + m.i * bw + bw / 2} cy={P.t} r="3.5" fill="var(--cal)"/>{/each}
      {#each labels as l}<text x={l.x} y={height - 6} text-anchor="middle">{l.text}</text>{/each}
    </svg>
    {#if tip}<div class="tip" style="left:{clamp(tip.x, 80, W - 80)}px;top:{tip.y}px">{tip.text}</div>{/if}
  {/if}
</div>

<style>
  .chart :global(.bar-e){fill:var(--elec)} .chart :global(.bar-g){fill:var(--gas)} .chart :global(.bar-n){fill:var(--neg)}
  .empty-chart{min-height:120px;display:grid;place-items:center;text-align:center;color:var(--muted);font-size:14px;border:1px dashed var(--line-hot);border-radius:var(--radius-sm);padding:var(--s4)}
</style>
