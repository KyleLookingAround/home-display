<script>
  /*
   * A bar chart in SVG. Bars can stack (segments), go below zero, fade (past), and carry bands, marks and a "now" line.
   * Tap or point at a bar, or use the arrow keys, to read it: the chosen bar is `selected`, bound by the parent.
   */
  import { niceScale, fmtTick, sum, clamp } from '../lib/format.js';

  let {
    items = [], height = 220, bands = [], marks = [], nowAt = null, labelEdge = false, endLabel = '',
    yFmt = fmtTick, minMax = 0.01, empty = 'No data yet.', aria = 'Chart', defaultSel = null,
    selected = $bindable(null)
  } = $props();

  let width = $state(600);
  const P = { l: 46, r: 8, t: 14, b: 24 };
  const W = $derived(Math.max(280, Math.floor(width || 600)));
  const n = $derived(items.length);
  const sc = $derived.by(() => {
    const tops = items.map(it => sum(it.segs.map(s => Math.max(0, s.v))));
    const bots = items.map(it => Math.min(0, ...it.segs.map(s => s.v)));
    return niceScale(Math.min(0, ...bots), Math.max(minMax, ...tops));
  });
  const iw = $derived(W - P.l - P.r), ih = $derived(height - P.t - P.b), bw = $derived(n ? iw / n : 0), gap = $derived(Math.min(3, bw * 0.22));
  const y = v => P.t + ih - (v - sc.lo) / (sc.hi - sc.lo) * ih;
  const ticks = $derived.by(() => { const out = []; for (let v = sc.lo; v <= sc.hi + 1e-9; v += sc.step) out.push(Math.round(v * 1e6) / 1e6); return out; });
  const bars = $derived.by(() => {
    const out = [];
    items.forEach((it, i) => {
      const x = P.l + i * bw + gap / 2, w = Math.max(1, bw - gap);
      let acc = 0;
      for (const seg of it.segs){
        const cls = seg.cls + (it.faded ? ' past' : '');
        if (seg.v > 0){ out.push({ cls, x, w, y: y(acc + seg.v), h: Math.max(0.5, y(acc) - y(acc + seg.v)) }); acc += seg.v; }
        else if (seg.v < 0) out.push({ cls, x, w, y: y(0), h: Math.max(0.5, y(seg.v) - y(0)) });
      }
    });
    return out;
  });
  const labels = $derived.by(() => {
    const out = []; let last = -1e9;
    items.forEach((it, i) => {
      if (!it.label) return;
      const lx = labelEdge ? P.l + i * bw : P.l + i * bw + bw / 2;
      if (lx - last >= 54){ out.push({ x: lx, text: it.label, anchor: labelEdge && i === 0 ? 'start' : 'middle' }); last = lx; }
    });
    return out;
  });

  // a new set of bars (another period, another tariff) starts at the default bar
  $effect(() => { if (n && (selected == null || selected >= n)) selected = defaultSel != null && defaultSel < n ? defaultSel : n - 1; });
  const pick = i => { selected = clamp(i, 0, n - 1); };
  function keys(ev){
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    ev.preventDefault(); pick((selected || 0) + (ev.key === 'ArrowRight' ? 1 : -1));
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chart" tabindex="0" bind:clientWidth={width} onkeydown={keys} role="group" aria-label={aria}>
  {#if !n}
    <div class="empty">{empty}</div>
  {:else}
    <svg width={W} {height} viewBox="0 0 {W} {height}" role="img" aria-label={aria}>
      {#each bands as b}<rect class={b.cls} x={P.l + b.from * bw} y={P.t} width={(b.to - b.from) * bw} height={ih}/>{/each}
      {#each ticks as v}
        <line class={Math.abs(v) < 1e-9 && sc.lo < 0 ? 'zero' : 'gridl'} x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)}/>
        <text x={P.l - 6} y={y(v) + 4} text-anchor="end">{yFmt(v)}</text>
      {/each}
      {#each bars as b}<rect class={b.cls} x={b.x} y={b.y} width={b.w} height={b.h}/>{/each}
      {#each labels as l}<text x={l.x} y={height - 6} text-anchor={l.anchor}>{l.text}</text>{/each}
      {#if endLabel}<text x={W - P.r} y={height - 6} text-anchor="end">{endLabel}</text>{/if}
      {#each marks as m}
        <line class="mark" x1={P.l + m.i * bw + bw / 2} x2={P.l + m.i * bw + bw / 2} y1={P.t} y2={P.t + ih}/>
        <text class="mark-t" x={Math.min(P.l + m.i * bw + bw / 2 + 3, W - 12)} y={P.t + 9}>◆</text>
      {/each}
      {#if nowAt != null}
        <line class="now" x1={P.l + nowAt * bw} x2={P.l + nowAt * bw} y1={P.t} y2={P.t + ih}/>
        <text x={Math.min(P.l + nowAt * bw + 4, W - 28)} y={P.t + 9} style="fill:var(--gas)">now</text>
      {/if}
      {#each items as _, i}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <rect class="hit" class:sel={i === selected} x={P.l + i * bw} y={P.t} width={bw} height={ih}
              onclick={() => pick(i)} onpointermove={ev => { if (ev.pointerType === 'mouse') pick(i); }}/>
      {/each}
    </svg>
  {/if}
</div>
