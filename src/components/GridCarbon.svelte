<script>
  // The grid's carbon intensity for the next two days, and its greenest three hours.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { errorText } from '../lib/net.js';
  import { cheapestWindow } from '../lib/analysis.js';
  import { DOW, pad2, hhmm, fmtDate } from '../lib/format.js';
  import BarChart from './BarChart.svelte';
  onMount(boot);
  let sel = $state(null);
  const ciClass = idx => ({ 'very low': 'ci-vl', low: 'ci-l', moderate: 'ci-m', high: 'ci-h', 'very high': 'ci-vh' })[idx] || 'ci-m';
  const now = $derived(app.now);
  const c = $derived(app.carbonFc || []);
  const cur = $derived(c.findIndex(r => r.from <= now && now < r.to));
  const items = $derived(c.map(r => { const d = new Date(r.from); return { label: d.getMinutes() === 0 && d.getHours() % 6 === 0 ? (d.getHours() === 0 ? DOW[d.getDay()] : pad2(d.getHours()) + ':00') : null, segs: [{ v: r.v, cls: ciClass(r.index) }] }; }));
  const green = $derived(c.length ? cheapestWindow(c.map(r => ({ from: r.from, to: r.to, p: r.v })), 6) : null);
  const dirty = $derived(c.length ? c.filter(r => r.to > now).reduce((x, y) => y.v > x.v ? y : x, c[0]) : null);
</script>

<section class="panel">
  <p class="panel-eyebrow">Grid scan · next 48 hours</p><h2>How green is the grid</h2>
  <p class="muted small">Forecast carbon intensity for your region in grams of CO₂ per kWh, from National Grid.</p>
  <div class="legend"><span><i style="background:var(--neg)"></i>Very low</span><span><i style="background:var(--good)"></i>Low</span><span><i style="background:var(--warn)"></i>Moderate</span><span><i style="background:var(--bad)"></i>High</span></div>
  <BarChart {items} aria="Carbon intensity forecast" labelEdge height={200} defaultSel={Math.max(0, cur)} bind:selected={sel}
    nowAt={cur >= 0 ? cur + (now - c[cur].from) / (c[cur].to - c[cur].from) : null}
    empty={app.carbonErr ? errorText(app.carbonErr).join(' ') : 'Scanning the grid…'} />
  <p class="readline">{sel != null && c[sel] ? `${DOW[new Date(c[sel].from).getDay()]} ${hhmm(c[sel].from)}–${hhmm(c[sel].to)} — ${c[sel].v} g/kWh, ${c[sel].index}` : ''}</p>
  {#if c.length}
    <div class="chips">
      {#if cur >= 0}<div class="chip"><span class="v">{c[cur].v} g</span><span class="k">Now · {c[cur].index}</span></div>{/if}
      {#if green}<div class="chip"><span class="v">{fmtDate(new Date(green.from)).slice(0, 3)} {hhmm(green.from)}–{hhmm(green.to)}</span><span class="k">Greenest 3 hours · avg {Math.round(green.avg)} g/kWh</span></div>{/if}
      {#if dirty}<div class="chip"><span class="v">{dirty.v} g</span><span class="k">Dirtiest, {DOW[new Date(dirty.from).getDay()]} {hhmm(dirty.from)}</span></div>{/if}
    </div>
  {/if}
</section>
