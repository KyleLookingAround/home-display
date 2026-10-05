<script>
  // The Home Mini's live draw, every minute while this page is open.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { store } from '../lib/browser.js';
  import { NET, errorText } from '../lib/net.js';
  import { findHomeMini, liveReading } from '../lib/octopus.js';
  import { hhmm, kwh, gbp } from '../lib/format.js';

  let checked = $state(false), deviceId = $state(null), data = $state.raw(null), err = $state.raw(null);
  let timer = null;
  async function poll(){
    if (document.hidden) return;
    try { data = await liveReading(deviceId); err = null; } catch (e){ err = e; }
  }
  async function start(){
    await boot();
    if (app.demo || !NET.creds) return;
    try { deviceId = store.get('mini.' + NET.creds.account) || await findHomeMini(); if (deviceId) store.set('mini.' + NET.creds.account, deviceId); }
    catch (e){ err = e; }
    checked = true;
    if (deviceId){ poll(); timer = setInterval(poll, 60e3); }
  }
  onMount(() => {
    start();
    const back = () => { if (!document.hidden && deviceId) poll(); };
    document.addEventListener('visibilitychange', back);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', back); };
  });
  const er = $derived(app.eRateNow);
</script>

<section class="panel">
  <p class="panel-eyebrow">Live feed · Octopus Home Mini</p><h2>Right now</h2>
  {#if app.demo || !app.account}
    <p class="muted">With an Octopus Home Mini plugged in, this shows what your home is drawing right now, updated every minute, instead of yesterday's readings. Connect your account to check for one.</p>
  {:else if !checked}
    <p class="muted">Looking for a Home Mini…</p>
  {:else if !deviceId}
    <p class="muted">{err ? 'Couldn\'t check for a Home Mini: ' + errorText(err)[0] : 'No Home Mini found on your account.'} It's a small plug-in device Octopus sends to smart meter customers who ask for it, usually free. Once it's paired, live readings appear here.</p>
  {:else if !data}
    <p class="muted">{err ? errorText(err).join(' ') : 'Connecting to your Home Mini…'}</p>
  {:else}
    <div class="chips">
      <div class="chip"><span class="big elec">{data.demand != null ? Math.round(data.demand).toLocaleString('en-GB') + ' W' : '—'}</span><span class="k">Drawing now{data.at ? ' · ' + hhmm(data.at) : ''}</span></div>
      <div class="chip"><span class="v">{data.today != null ? kwh(data.today) : '—'}</span><span class="k">Electricity used today</span></div>
      <div class="chip"><span class="v">{data.today != null && er != null ? gbp(data.today * er) : '—'}</span><span class="k">Today so far, before standing charge</span></div>
    </div>
    <p class="muted small">Updates every minute while this page is open.</p>
  {/if}
</section>
