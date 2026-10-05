<script>
  // The household at a glance: the weather, the bins, today's and tomorrow's events, and the next trains.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchHouse } from '../../state/house.js';
  import { BIN_COLOURS, relDay, weatherText, leaveBy } from '../../lib/household.js';
  import { rainSoon, aqiLabel, uvLabel, pollenLabel } from '../../lib/outdoors.js';
  import Radar from '../charts/Radar.svelte';
  import { qrSvg, wifiCode } from '../../lib/qr.js';
  import { cleanCode, sendRemote } from '../../lib/remote.js';
  import { store } from '../../lib/browser.js';
  let shown = $state('');
  const tvCode = () => cleanCode(store.get('remoteTV'));
  async function wifiOnTv(){ const c = tvCode(); if (!c) return; shown = (await sendRemote(c, { from: 'phone', cmd: 'wifi' })) ? 'On the TV for three minutes.' : 'The relay didn\'t take that. Try again.'; }
  import { hhmm, startOfDay, addDays } from '../../lib/format.js';
  import { errorText } from '../../lib/net.js';
  onMount(() => watchHouse({ air: true, radar: true }));

  const w = $derived(app.weather);
  const wNow = $derived(w && w.now ? weatherText(w.now.code) : null);
  const hours = $derived(w ? w.hours.filter((h, i) => i % 2 === 0).slice(0, 6) : []);

  // Bins on the same day go together, and the next day's list says whether it's tonight they go out.
  const bins = $derived(app.collections);
  const soon = $derived(app.nowcast ? rainSoon(app.nowcast, app.now) : null);
  const air = $derived(app.air);
  const cds = $derived(app.countdowns ? app.countdowns.slice(0, 6) : null);
  const wifi = $derived(app.house ? app.house.wifi : null);
  const pollen = $derived(air ? [['grass', 'Grass'], ['tree', 'Tree']].map(([k, n]) => ({ n, l: pollenLabel(air.pollen[k], k) })).filter(x => x.l && x.l !== 'None') : []);
  const binDays = $derived.by(() => {
    if (!bins) return [];
    const out = [];
    for (const b of bins){ const last = out[out.length - 1]; if (last && +last.date === +b.date) last.bins.push(b); else out.push({ date: b.date, days: b.days, bins: [b] }); }
    return out.slice(0, 3);
  });

  const today = $derived(+startOfDay(new Date(app.now)));
  const events = $derived(app.events ? app.events.filter(e => e.end > app.now && e.start < +addDays(new Date(today), 2)) : null);

  const walk = $derived(app.house ? +app.house.trainWalk || 0 : 0);
  const trains = $derived(app.trains && app.trains.list ? app.trains.list.filter(t => (t.exp || t.sched) > app.now - 60e3).slice(0, 4) : null);
</script>

<div class="cols">
  <section class="card">
    <h2 class="label">Weather</h2>
    {#if w && wNow}
      <div class="wx-now"><span class="wx-i" aria-hidden="true">{wNow.icon}</span><span class="figure">{Math.round(w.now.temp)}°</span>
        <span class="main-t"><span>{wNow.text}</span><span class="sub">Feels {Math.round(w.now.feels)}° · wind {Math.round(w.now.wind)} mph</span></span></div>
      {#if soon}<p class="soon">{soon.text}{soon.heavy ? ', heavy at times' : ''}</p>{:else if app.nowcast}<p class="soon dry">Dry for the next few hours</p>{/if}
      <ol class="hours">
        {#each hours as h}<li><span class="t">{hhmm(h.t)}</span><span aria-hidden="true">{weatherText(h.code).icon}</span><span class="v">{Math.round(h.temp)}°</span><span class="r" class:wet={h.rain >= 40}>{h.rain == null ? '' : h.rain + '%'}</span></li>{/each}
      </ol>
      {#if air}
        <div class="stats air">
          <div class="stat"><span class="v">{aqiLabel(air.aqi) || '—'}</span><span class="k">Air quality{air.aqi != null ? ' · ' + Math.round(air.aqi) : ''}</span></div>
          <div class="stat"><span class="v">{uvLabel(air.uvMax) || '—'}</span><span class="k">UV today{air.uvMax ? ', up to ' + Math.round(air.uvMax) : ''}</span></div>
          <div class="stat"><span class="v">{pollen.length ? pollen.map(x => x.l).join(', ') : 'Low'}</span><span class="k">{pollen.length ? pollen.map(x => x.n).join(' and ') + ' pollen' : 'Pollen'}</span></div>
        </div>
      {/if}
      <details class="fold"><summary>Rain radar</summary><Radar radar={app.radar} size={280} /></details>
    {:else if app.weatherErr}<p class="note">The forecast didn't load: {errorText(app.weatherErr)[0]}</p>
    {:else}<div class="skel" style="height:96px"></div>{/if}
  </section>

  <section class="card">
    <h2 class="label">Bins</h2>
    {#if binDays.length}
      <ul class="rows">
        {#each binDays as d, i}
          <li><span class="main-t"><span>{relDay(d.date, app.now)}{#if i === 0 && d.days === 1}<span class="tag warn">Out tonight</span>{/if}</span>
            <span class="sub">{d.bins.map(b => b.what || b.name).join(' · ')}</span>
            {#if d.bins[0].moved}<span class="sub warn">A day later for {d.bins[0].moved}, probably</span>{:else if d.bins[0].check}<span class="sub warn">Christmas: check the council's dates</span>{/if}</span>
            <span class="dots">{#each d.bins as b}<i title={b.name} style="background:{BIN_COLOURS[b.colour] || BIN_COLOURS.grey}"></i>{/each}</span></li>
        {/each}
      </ul>
      <p class="note">{app.council && app.bins.some(b => +b.every === 0) ? 'Dates from Stockport Council, checked each Saturday.' : 'Dates repeat from the last known collection, a day later in a bank holiday week. Check the council at Christmas.'}</p>
    {:else if bins}<p class="note">No bins set up. <a href="./settings.html#household">Add them in Settings</a>.</p>
    {:else}<div class="skel" style="height:96px"></div>{/if}
  </section>

  <section class="card">
    <h2 class="label">Today and tomorrow</h2>
    {#if events && events.length}
      <ul class="rows">
        {#each events.slice(0, 6) as e}
          <li><span class="main-t"><span>{e.title}</span>{#if e.where}<span class="sub">{e.where}</span>{/if}</span>
            <span class="side">{relDay(e.start, app.now) === 'Today' ? '' : 'Tmrw '}{e.allDay ? 'All day' : hhmm(Math.max(e.start, today))}</span></li>
        {/each}
      </ul>
    {:else if events}<p class="note">Nothing in the calendar for today or tomorrow.</p>
    {:else if app.eventsErr}<p class="note">The calendar didn't load: {errorText(app.eventsErr)[0]}</p>
    {:else if app.house && !app.house.ical}<p class="note">Add your calendar's secret iCal address <a href="./settings.html#household">in Settings</a> to see what's on.</p>
    {:else}<div class="skel" style="height:96px"></div>{/if}
  </section>

  <section class="card">
    <h2 class="label">Trains{app.trains && app.trains.station ? ' from ' + app.trains.station : ''}</h2>
    {#if trains && trains.length}
      <ul class="rows">
        {#each trains as t}
          {@const l = leaveBy(t.exp || t.sched, walk, app.now)}
          <li><span class="main-t"><span><b class="mono">{hhmm(t.sched)}</b> {t.dest}</span>
            <span class="sub">{t.cancelled ? 'Cancelled' : t.exp && t.exp !== t.sched ? 'Expected ' + hhmm(t.exp) : t.delayed ? 'Delayed' : 'On time'}{t.platform ? ' · platform ' + t.platform : ''}</span></span>
            <span class="side {t.cancelled ? 'bad' : l.cls}">{t.cancelled ? '—' : l.text}</span></li>
        {/each}
      </ul>
      <p class="note">With a {walk} minute walk to the station.</p>
    {:else if trains}<p class="note">No trains in the next couple of hours.</p>
    {:else if app.trainsErr}<p class="note">Departures didn't load: {errorText(app.trainsErr)[0]}</p>
    {:else if app.house && !app.house.trainFrom}<p class="note">Choose your station <a href="./settings.html#household">in Settings</a>.</p>
    {:else}<div class="skel" style="height:96px"></div>{/if}
  </section>
  <section class="card">
    <h2 class="label">Coming up</h2>
    {#if cds && cds.length}
      <ul class="rows">
        {#each cds as c}<li><span class="main-t"><span>{c.title}</span>{#if c.age || c.years}<span class="sub">{c.age ? (c.days === 0 ? 'Turns ' : 'Turning ') + c.age : c.years + ' years'}</span>{/if}</span><span class="side {c.days <= 1 ? 'neg' : ''}">{c.when}</span></li>{/each}
      </ul>
    {:else if cds}<p class="note">Nothing in the next few months.</p>{/if}
    <p class="note">Add birthdays and dates <a href="./settings.html#household">in Settings</a>. They stay on this phone.</p>
  </section>

  <section class="card">
    <h2 class="label">Guest Wi-Fi</h2>
    {#if wifi}
      <div class="wifi"><div class="qr">{@html qrSvg(wifiCode(wifi), { label: 'Guest Wi-Fi code' })}</div>
        <div class="main-t"><span class="net">{wifi.ssid}</span><span class="sub mono">{wifi.security === 'nopass' || !wifi.password ? 'No password' : wifi.password}</span><span class="sub">A visitor points their phone's camera at the code.</span></div></div>
      {#if tvCode()}<div class="actions"><button class="btn small" type="button" onclick={wifiOnTv}>Show it on the TV</button>{#if shown}<span class="note" role="status">{shown}</span>{/if}</div>{/if}
    {:else}<p class="note">Add your guest network <a href="./settings.html#household">in Settings</a> for a code visitors can scan. It stays on this phone.</p>{/if}
  </section>
</div>

<style>
  .wx-now{display:flex;align-items:center;gap:var(--s3)}
  .wx-i{font-size:34px;line-height:1}
  .wx-now .figure{font:500 40px/1 var(--f-mono)}
  .wx-now .main-t{display:grid;gap:2px}
  .wx-now .sub{font-size:13px;color:var(--muted)}
  .hours{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin:var(--s3) 0 0;padding:0;list-style:none;text-align:center}
  .hours li{display:grid;gap:4px;font-size:16px}
  .hours .t,.hours .r{font:500 11px/1 var(--f-mono);color:var(--muted)}
  .hours .v{font:500 14px/1 var(--f-mono)}
  .hours .wet{color:var(--gas)}
  .soon{margin-top:var(--s2);font-size:15px;color:var(--gas)} .soon.dry{color:var(--muted)}
  .air{margin-top:var(--s3);padding-top:var(--s3);border-top:1px solid var(--line)}
  .air :global(.v){font-size:15px;font-family:var(--f-body);font-weight:600}
  .dots{display:flex;gap:4px;flex:none}
  .dots i{width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.25)}
  .mono{font-family:var(--f-mono);font-weight:500}
  .wifi{display:flex;align-items:center;gap:var(--s4)}
  .wifi .qr{width:132px;height:132px;flex:none}
  .wifi .qr :global(svg){display:block;width:100%;height:100%;border-radius:6px}
  .wifi .net{font-size:17px;font-weight:600}
  .wifi .main-t{display:grid;gap:4px;min-width:0}
  .wifi .sub{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
  .wifi .sub.mono{color:var(--gas);font-size:15px}
</style>
