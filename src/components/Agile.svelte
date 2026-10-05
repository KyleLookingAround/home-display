<script>
  // Agile's half-hourly prices for today and tomorrow, for any region, and notifications when they go below zero.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot, loadPrices } from '../state/session.js';
  import { store } from '../lib/browser.js';
  import { errorText } from '../lib/net.js';
  import { cheapestWindow } from '../lib/analysis.js';
  import { REGIONS, DOW, pad2, dayKey, hhmm, fmtDate, fmtTick, pence } from '../lib/format.js';
  import BarChart from './BarChart.svelte';

  let sel = $state(null), notifyOn = $state(false), notifyNote = $state(''), canNotify = $state(true);
  onMount(() => { boot(); readNotify(); });
  const priceClass = p => p < 0 ? 'p-neg' : p < 15 ? 'p-low' : p < 25 ? 'p-mid' : 'p-high';
  const now = $derived(app.now);
  const rates = $derived(app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to)) : []);
  const cur = $derived(rates.findIndex(r => r.from <= now && now < r.to));
  const items = $derived(rates.map(r => { const d = new Date(r.from); return { faded: r.to <= now, label: d.getMinutes() === 0 && d.getHours() % 6 === 0 ? (d.getHours() === 0 ? (dayKey(r.from) === dayKey(now) ? 'Today' : DOW[d.getDay()]) : pad2(d.getHours()) + ':00') : null, segs: [{ v: r.p, cls: priceClass(r.p) }] }; }));
  const fut = $derived(rates.filter(r => r.to > now));
  const best = $derived(rates.length ? cheapestWindow(rates, 4) : null);
  const max = $derived(fut.length ? fut.reduce((x, y) => y.p > x.p ? y : x) : null);
  const neg = $derived(fut.filter(r => r.p < 0));

  function changeRegion(ev){ app.region = ev.target.value; store.set('region', app.region); sel = null; loadPrices(); }
  function readNotify(){
    if (!('Notification' in window)){ canNotify = false; notifyNote = 'This browser can\'t show notifications from this page.'; return; }
    notifyOn = store.get('notify') === 'on' && Notification.permission === 'granted';
    notifyNote = notifyOn ? 'On while a dashboard page is open in a tab.' : Notification.permission === 'denied' ? 'Notifications are blocked for this page in your browser settings.' : '';
  }
  async function toggleNotify(){
    if (store.get('notify') === 'on'){ store.set('notify', 'off'); readNotify(); return; }
    try { const p = await Notification.requestPermission(); if (p === 'granted'){ store.set('notify', 'on'); new Notification('Notifications on', { body: 'You\'ll hear about negative Agile prices while a dashboard page is open.' }); } } catch {}
    readNotify();
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div><p class="panel-eyebrow">Market feed · half-hourly</p><h2>Agile prices</h2><p class="muted small">Region {app.region} · {REGIONS[app.region]}. Tomorrow's prices usually appear around 4pm.</p></div>
    <label class="check" for="region">Region <select id="region" class="inline" value={app.region} onchange={changeRegion}>{#each Object.entries(REGIONS) as [k, v]}<option value={k}>{k} · {v}</option>{/each}</select></label>
  </div>
  <div class="legend"><span><i style="background:var(--neg)"></i>Below 0p</span><span><i style="background:var(--good)"></i>Under 15p</span><span><i style="background:var(--warn)"></i>15–25p</span><span><i style="background:var(--bad)"></i>25p and over</span></div>
  <BarChart {items} aria="Agile half-hourly prices" labelEdge defaultSel={cur >= 0 ? cur : 0} yFmt={v => fmtTick(v) + 'p'} bind:selected={sel}
    nowAt={cur >= 0 ? cur + (now - rates[cur].from) / (rates[cur].to - rates[cur].from) : null}
    empty={app.agileErr ? errorText(app.agileErr).join(' ') : 'Tuning in to today\'s prices…'} />
  <p class="readline">{sel != null && rates[sel] ? `${DOW[new Date(rates[sel].from).getDay()]} ${hhmm(rates[sel].from)}–${hhmm(rates[sel].to)} — ${pence(rates[sel].p)}/kWh` : ''}</p>
  {#if rates.length}
    <div class="chips">
      {#if cur >= 0}<div class="chip"><span class="v">{pence(rates[cur].p)}</span><span class="k">Right now, per kWh</span></div>{/if}
      {#if best}<div class="chip"><span class="v">{hhmm(best.from)}–{hhmm(best.to)}</span><span class="k">Cheapest 2 hours to come · avg {pence(best.avg)}</span></div>{/if}
      {#if max}<div class="chip"><span class="v">{pence(max.p)}</span><span class="k">Highest to come, at {hhmm(max.from)}</span></div>{/if}
      {#if neg.length}<div class="chip"><span class="v">{neg.length} slot{neg.length > 1 ? 's' : ''}</span><span class="k">Below zero, first at {fmtDate(new Date(neg[0].from))} {hhmm(neg[0].from)}</span></div>{/if}
    </div>
  {/if}
  <div class="actions"><button class="btn small" type="button" disabled={!canNotify} onclick={toggleNotify}>{notifyOn ? 'Stop negative price notifications' : 'Notify me about negative prices'}</button><span class="muted small">{notifyNote}</span></div>
</section>
