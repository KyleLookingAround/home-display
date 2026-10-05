<script>
  // Gas against the temperature: how much each colder degree costs, and what the week's forecast means.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { niceScale, fmtTick, shortDate, keyDate, sum, kwh, gbp, pence } from '../lib/format.js';
  import Example from './Example.svelte';
  onMount(boot);
  let width = $state(500);
  const H = 230, P = { l: 44, r: 10, t: 24, b: 30 };
  const raw = $derived(app.raw), reg = $derived(app.reg);
  const W = $derived(Math.max(280, Math.floor(width || 500)));
  const fc = $derived(raw && raw.weather && reg ? [...raw.weather.entries()].filter(([, w]) => w.forecast).map(([k, w]) => ({ k, temp: w.t, g: reg.a != null ? reg.a + reg.b * Math.max(0, 15.5 - w.t) : null })).filter(x => x.g != null) : []);
  const plot = $derived.by(() => {
    if (!reg || !reg.pts.length) return null;
    const temps = reg.pts.map(p => p.temp).concat(fc.map(p => p.temp)), gs = reg.pts.map(p => p.g).concat(fc.map(p => p.g));
    const xs = niceScale(Math.min(...temps) - 1, Math.max(...temps) + 1, 5), ys = niceScale(0, Math.max(...gs, 1));
    const x = t => P.l + (t - xs.lo) / (xs.hi - xs.lo) * (W - P.l - P.r), y = v => P.t + (H - P.t - P.b) - (v - ys.lo) / (ys.hi - ys.lo) * (H - P.t - P.b);
    const yt = [], xt = [];
    for (let v = ys.lo; v <= ys.hi + 1e-9; v += ys.step) yt.push(v);
    for (let t = xs.lo; t <= xs.hi + 1e-9; t += xs.step) xt.push(t);
    let fit = '';
    if (reg.a != null) for (let t = xs.lo; t <= xs.hi; t += (xs.hi - xs.lo) / 60) fit += `${fit ? 'L' : 'M'}${x(t).toFixed(1)},${y(reg.a + reg.b * Math.max(0, 15.5 - t)).toFixed(1)}`;
    return { x, y, yt, xt, fit };
  });
  const gr = $derived(app.gRateNow ?? 7), fcKwh = $derived(sum(fc.map(p => p.g)));
</script>

<section class="panel">
  <p class="panel-eyebrow">Atmosphere · Stockport</p><h2>Gas and the weather</h2>
  <div class="chart" style="min-height:220px" bind:clientWidth={width}>
    {#if !raw}<div class="empty">Receiving…</div>
    {:else if !raw.weather}<div class="empty">Loading Stockport's weather…</div>
    {:else if !plot}<div class="empty">Once you have gas readings, this shows how your gas use climbs as the temperature drops.</div>
    {:else}
      <svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="Daily gas use against outdoor temperature">
        {#each plot.yt as v}<line class="gridl" x1={P.l} x2={W - P.r} y1={plot.y(v)} y2={plot.y(v)}/><text x={P.l - 6} y={plot.y(v) + 4} text-anchor="end">{fmtTick(v)}</text>{/each}
        {#each plot.xt as t}<text x={plot.x(t)} y={H - 12} text-anchor="middle">{fmtTick(t)}°</text>{/each}
        <text x={W - P.r} y={H - 1} text-anchor="end">daily mean temperature</text><text x={P.l - 6} y="12">kWh of gas a day</text>
        {#each reg.pts as p}<circle class="dot" cx={plot.x(p.temp)} cy={plot.y(p.g)} r="3.2"><title>{shortDate(keyDate(p.k))}: {p.temp}°C, {p.g.toFixed(1)} kWh</title></circle>{/each}
        {#each fc as p}<circle class="dot fc" cx={plot.x(p.temp)} cy={plot.y(p.g)} r="4"><title>Forecast {shortDate(keyDate(p.k))}: {p.temp}°C, about {p.g.toFixed(1)} kWh</title></circle>{/each}
        {#if plot.fit}<path class="fit" d={plot.fit}/>{/if}
      </svg>
    {/if}
  </div>
  {#if plot}
    <div class="prose">
      {#if reg.a == null}
        <p class="muted">Needs about 10 days of gas readings to work out the pattern.</p>
      {:else}
        <p>Each degree colder adds about <b>{reg.b.toFixed(1)} kWh</b> of gas a day ({pence(reg.b * gr)}). Hot water and cooking use about <b>{reg.a.toFixed(1)} kWh</b> a day.<Example /></p>
        {#if fc.length}<p>With the forecast, the next {fc.length} days should use about <b>{kwh(fcKwh)}</b> of gas, roughly {gbp(fcKwh * gr)} (hollow dots).</p>{/if}
        <p class="muted small">Above about 15.5°C most homes stop heating. Fit quality R² {reg.r2.toFixed(2)}{reg.r2 < 0.5 ? ', so treat this loosely' : ''}.</p>
      {/if}
    </div>
  {/if}
</section>
