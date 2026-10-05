<script>
  /*
   * Time laid left to right, now at the left: the price as a filled curve coloured by band, the cheapest window
   * shaded, grid carbon as a thin band underneath, and markers on top (rain, events, trains). Tap, point or use the
   * arrow keys to read any half hour.
   */
  import { hhmm, pence, clamp, DOW, dayKey } from '../../lib/format.js';
  let {
    from, to, rates = [], carbon = [], cheap = null, fronts = [], markers = [], height = 150,
    aria = 'Prices for the hours ahead', now = from
  } = $props();

  let width = $state(340), sel = $state(null), px = $state(null);
  const W = $derived(Math.max(260, width || 340));
  const top = 26, bandH = 6, bottom = 22;
  const plotH = $derived(height - top - bottom - bandH - 6);
  const x = t => (t - from) / (to - from) * W;
  const slots = $derived(rates.filter(r => r.to > from && r.from < to));
  const lo = $derived(Math.min(0, ...slots.map(r => r.p)));
  const hi = $derived(Math.max(30, ...slots.map(r => r.p)));
  const y = p => top + plotH - (p - lo) / (hi - lo) * plotH;
  const tone = p => p < 0 ? 'var(--neg)' : p < 15 ? 'var(--cheap)' : p < 25 ? 'var(--normal)' : 'var(--peak)';
  const RGB = { neg: '#b892ff', cheap: '#46e6a1', normal: '#ffd166', peak: '#ff6b7d' };
  const toneHex = p => p < 0 ? RGB.neg : p < 15 ? RGB.cheap : p < 25 ? RGB.normal : RGB.peak;

  // a smooth line through each half hour's middle, held flat across the first and last
  const pts = $derived(slots.length ? [[x(Math.max(from, slots[0].from)), y(slots[0].p)], ...slots.map(r => [x((Math.max(r.from, from) + Math.min(r.to, to)) / 2), y(r.p)]), [x(Math.min(to, slots[slots.length - 1].to)), y(slots[slots.length - 1].p)]] : []);
  const line = $derived.by(() => {
    if (!pts.length) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++){
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      d += ` C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return d;
  });
  const area = $derived(pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${(top + plotH).toFixed(1)} L${pts[0][0].toFixed(1)},${(top + plotH).toFixed(1)} Z` : '');
  const stops = $derived(slots.map(r => ({ o: clamp(x((Math.max(r.from, from) + Math.min(r.to, to)) / 2) / W, 0, 1), c: toneHex(r.p) })));
  const gid = 'g' + Math.random().toString(36).slice(2, 8);
  const ticks = $derived.by(() => {
    const out = [], step = (to - from) > 30 * 3600e3 ? 6 * 3600e3 : 3 * 3600e3;
    for (let t = Math.ceil((from + 1) / step) * step; t < to - 0.5 * 3600e3; t += step){
      const d = new Date(t);
      out.push({ x: x(t), text: d.getHours() === 0 ? (dayKey(t) === dayKey(now) ? 'Today' : DOW[d.getDay()]) : hhmm(t) });
    }
    return out.filter(k => k.x > 30 && k.x < W - 24);
  });
  const ci = $derived(carbon.filter(r => r.to > from && r.from < to));
  const ciCol = idx => ({ 'very low': 'var(--neg)', low: 'var(--cheap)', moderate: 'var(--normal)', high: 'var(--peak)', 'very high': 'var(--peak)' })[idx] || 'var(--normal)';

  const at = i => slots[i];
  const tip = $derived.by(() => {
    if (sel == null || !at(sel)) return null;
    const r = at(sel), c = ci.find(k => k.from <= r.from && r.from < k.to), mk = markers.filter(m => m.t >= r.from && m.t < r.to);
    return { x: x((Math.max(r.from, from) + Math.min(r.to, to)) / 2), y: y(r.p),
             text: `${DOW[new Date(r.from).getDay()]} ${hhmm(r.from)} · ${pence(r.p)}${c ? ` · ${c.v} g` : ''}${mk.length ? ' · ' + mk.map(m => m.label).join(', ') : ''}` };
  });
  function pick(ev){
    const rect = ev.currentTarget.getBoundingClientRect(), t = from + (ev.clientX - rect.left) / rect.width * (to - from);
    const i = slots.findIndex(r => r.from <= t && t < r.to);
    if (i >= 0) sel = i;
  }
  function keys(ev){
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    ev.preventDefault(); sel = clamp((sel == null ? 0 : sel) + (ev.key === 'ArrowRight' ? 1 : -1), 0, slots.length - 1);
  }
  const summary = $derived(slots.length ? `${aria}: from ${pence(slots[0].p)} now${cheap ? `, cheapest ${hhmm(cheap.from)} to ${hhmm(cheap.to)}` : ''}, highest ${pence(Math.max(...slots.map(r => r.p)))}.` : `${aria}: not known yet.`);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="chart strip" bind:clientWidth={width} tabindex="0" role="group" aria-label={summary}
     onpointermove={ev => { if (ev.pointerType === 'mouse') pick(ev); }} onpointerdown={pick} onpointerleave={ev => { if (ev.pointerType === 'mouse') sel = null; }} onkeydown={keys} onblur={() => { sel = null; }}>
  <svg width={W} {height} viewBox="0 0 {W} {height}" aria-hidden="true">
    <defs>
      <linearGradient id="{gid}l" x1="0" x2="1" y1="0" y2="0">{#each stops as s}<stop offset={s.o} stop-color={s.c}/>{/each}</linearGradient>
      <linearGradient id="{gid}f" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="{gid}m"><rect x="0" y="0" width={W} {height} fill="url(#{gid}f)"/></mask>
    </defs>
    {#each fronts as f}
      <rect x={Math.max(0, x(f.from))} y="0" width={Math.max(2, x(f.to) - Math.max(0, x(f.from)))} height={top + plotH} fill="rgba(79,214,255,.07)"/>
      <text x={Math.max(2, x(f.from)) + 4} y="12" style="fill:var(--gas)">{f.kind === 'snow' ? 'Snow' : f.kind === 'thunder' ? 'Thunder' : 'Rain'}</text>
    {/each}
    {#if cheap && x(cheap.to) > 0}
      <rect x={Math.max(0, x(cheap.from))} y={top - 6} width={x(cheap.to) - Math.max(0, x(cheap.from))} height={plotH + 6} fill="rgba(70,230,161,.1)" rx="4"/>
      <text x={Math.max(0, x(cheap.from)) + 4} y={top + 6} style="fill:var(--cheap)">Cheapest</text>
    {/if}
    <line class="grid" x1="0" x2={W} y1={top + plotH} y2={top + plotH}/>
    {#if lo < 0}<line class="grid" x1="0" x2={W} y1={y(0)} y2={y(0)} stroke-dasharray="2 4"/>{/if}
    {#if area}
      <path d={area} fill="url(#{gid}l)" mask="url(#{gid}m)"/>
      <path d={line} fill="none" stroke="url(#{gid}l)" stroke-width="2.5" stroke-linecap="round"/>
    {/if}
    {#each ci as c}<rect x={Math.max(0, x(c.from))} y={top + plotH + 6} width={Math.max(1, Math.min(W, x(c.to)) - Math.max(0, x(c.from)) - 1)} height={bandH} rx="2" fill={ciCol(c.index)} opacity=".75"/>{/each}
    {#each markers.filter(m => m.t > from && m.t < to) as m}
      <g transform="translate({x(m.t)},{top - 14})">
        {#if m.kind === 'event'}<rect x="-4" y="-4" width="8" height="8" transform="rotate(45)" fill="var(--cal)"/>
        {:else}<circle r="4" fill="var(--gas)"/>{/if}
      </g>
      <line x1={x(m.t)} x2={x(m.t)} y1={top - 8} y2={top + plotH} stroke={m.kind === 'event' ? 'var(--cal)' : 'var(--gas)'} stroke-opacity=".35" stroke-dasharray="2 3"/>
    {/each}
    <line class="now" x1="1" x2="1" y1={top - 6} y2={top + plotH + 6 + bandH}/>
    <text x="5" y={height - 6}>Now</text>
    {#each ticks as k}<text x={k.x} y={height - 6} text-anchor="middle">{k.text}</text>{/each}
    {#if tip}<circle cx={tip.x} cy={tip.y} r="4.5" fill="var(--ink)" stroke="var(--void)" stroke-width="2"/>{/if}
  </svg>
  {#if tip}<div class="tip" style="left:{clamp(tip.x, 70, W - 70)}px;top:{tip.y}px">{tip.text}</div>{/if}
</div>
