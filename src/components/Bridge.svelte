<script>
  // The bridge: who's connected and how fresh the data is, the account settings, notices, and the negative price alert.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot, refresh, connect, forget } from '../state/session.js';
  import { store } from '../lib/browser.js';
  import { NET } from '../lib/net.js';
  import { hhmm, dayKey, fmtDate, pence } from '../lib/format.js';

  let open = $state(false);
  let form = $state({ account: '', key: '', gasUnit: 'm3', pay: 'DIRECT_DEBIT', remember: true });
  let acctInput = $state();

  onMount(() => { boot(); });

  const pill = $derived(app.status === 'live' ? `Signal live · ${hhmm(app.checkedAt || Date.now())}` : app.status === 'demo' ? 'Example data' : app.status === 'err' ? 'No signal' : 'Receiving…');
  function toggle(){
    open = !open;
    if (open){
      form = { account: (NET.creds && NET.creds.account) || store.get('account') || '', key: (NET.creds && NET.creds.key) || '', gasUnit: app.gasUnit, pay: app.pay, remember: true };
      queueMicrotask(() => acctInput && acctInput.focus());
    }
  }
  function save(ev){
    ev.preventDefault();
    const account = form.account.trim().toUpperCase(), key = form.key.trim();
    if (!account || !key) return;
    open = false; connect({ account, key, gasUnit: form.gasUnit, pay: form.pay, remember: form.remember });
  }

  // Plunge pricing: Agile below zero ahead, on every page, and a notification when they're switched on.
  const neg = $derived(app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to) && r.to > app.now && r.p < 0) : []);
  const lowest = $derived(neg.length ? Math.min(...neg.map(r => r.p)) : 0);
  $effect(() => {
    if (!neg.length) return;
    try {
      if (store.get('notify') === 'on' && 'Notification' in window && Notification.permission === 'granted'){
        const first = neg[0], key = 'neg-' + first.from;
        if (store.get('lastNotified') !== key){
          new Notification('Agile prices go negative', { body: `From ${hhmm(first.from)} ${dayKey(first.from) === dayKey(Date.now()) ? 'today' : 'tomorrow'}, as low as ${pence(lowest)}.` });
          store.set('lastNotified', key);
        }
      }
    } catch {}
  });
</script>

<header class="top">
  <div>
    <p class="eyebrow">{app.account ? `Mission control · Octopus ${app.account}` : 'Mission control · not connected, showing example data'}</p>
    <h1>Harold Street Energy</h1>
  </div>
  <div class="actions">
    <span id="status" class="pill {app.status === 'live' ? 'live' : app.status === 'demo' ? 'demo' : app.status === 'err' ? 'err' : ''}">{pill}</span>
    <a class="btn" id="wallBtn" href="display.html#energy">Wall display</a>
    <button class="btn" type="button" onclick={() => refresh()}>Refresh</button>
    <button class="btn primary" type="button" onclick={toggle} aria-expanded={open}>{app.account ? 'Settings' : 'Connect account'}</button>
  </div>
</header>

{#if open}
  <section class="panel settings" aria-labelledby="settingsTitle">
    <h2 id="settingsTitle">Connect your Octopus account</h2>
    <form class="grid" autocomplete="off" onsubmit={save}>
      <div class="field"><label for="acct">Account number</label><input id="acct" class="mono" placeholder="A-1234ABCD" required bind:value={form.account} bind:this={acctInput}></div>
      <div class="field"><label for="apikey">API key</label><input id="apikey" class="mono" type="password" placeholder="sk_live_…" required bind:value={form.key}></div>
      <div class="field"><label for="gasunit">Gas meter reports in</label>
        <select id="gasunit" bind:value={form.gasUnit}><option value="m3">Cubic metres (newer SMETS2 smart meter)</option><option value="kwh">kWh (older SMETS1 smart meter)</option></select></div>
      <div class="field"><label for="paymethod">How you pay</label>
        <select id="paymethod" bind:value={form.pay}><option value="DIRECT_DEBIT">Direct Debit</option><option value="NON_DIRECT_DEBIT">Prepay / on receipt of bill</option></select></div>
      <label class="check" for="remember"><input id="remember" type="checkbox" bind:checked={form.remember}> Remember on this device</label>
      <div class="form-actions">
        <button class="btn primary" type="submit">Save and load</button>
        <button class="btn" type="button" onclick={() => { open = false; forget(); }}>Forget my details</button>
        <button class="btn" type="button" onclick={() => { open = false; }}>Close</button>
      </div>
      <p class="help">Find both in your Octopus online account under Personal details → API access (<a href="https://octopus.energy/dashboard/new/accounts/personal-details/api-access" target="_blank" rel="noopener">open it</a>). The key stays in this browser and only goes to Octopus, directly or through your own home server helper.</p>
    </form>
  </section>
{/if}

{#if app.notice}
  <div class="notice {app.notice.kind}"><strong>{app.notice.title}</strong>{#if app.notice.body}<span>{app.notice.body}</span>{/if}</div>
{/if}
{#if neg.length}
  <div class="notice alert">
    <strong>Plunge pricing ahead: Agile goes below zero {dayKey(neg[0].from) === dayKey(Date.now()) ? 'today' : 'on ' + fmtDate(new Date(neg[0].from))} from {hhmm(neg[0].from)}.</strong>
    <span>On Agile you'd be paid to use electricity then: {neg.length} half hour{neg.length > 1 ? 's' : ''}, as low as {pence(lowest)}.</span>
  </div>
{/if}
