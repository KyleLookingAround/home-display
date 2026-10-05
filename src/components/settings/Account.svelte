<script>
  // The Octopus account: connect it or forget it, the gas meter's units, how you pay, and the region for prices.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot, connect, forget, loadPrices } from '../../state/session.js';
  import { store } from '../../lib/browser.js';
  import { NET } from '../../lib/net.js';
  import { REGIONS } from '../../lib/format.js';
  let form = $state({ account: '', key: '', gasUnit: 'm3', pay: 'DIRECT_DEBIT', remember: true });
  let saved = $state('');
  onMount(async () => {
    await boot();
    form = { account: (NET.creds && NET.creds.account) || store.get('account') || '', key: (NET.creds && NET.creds.key) || '', gasUnit: app.gasUnit, pay: app.pay, remember: true };
  });
  async function save(ev){
    ev.preventDefault();
    const account = form.account.trim().toUpperCase(), key = form.key.trim();
    if (!account || !key) return;
    saved = 'Connecting…';
    await connect({ account, key, gasUnit: form.gasUnit, pay: form.pay, remember: form.remember });
    saved = app.status === 'live' ? 'Connected.' : '';
  }
  async function drop(){ form.account = form.key = ''; saved = ''; await forget(); }
  function region(ev){ app.region = ev.target.value; store.set('region', app.region); loadPrices(true); }
</script>

<section class="card" id="account">
  <h2 class="label">Account</h2>
  <p class="line">{app.account ? `Connected to Octopus account ${app.account}.` : 'Not connected: the pages show example data.'}</p>
  <form class="form" autocomplete="off" onsubmit={save}>
    <div class="inline-fields">
      <div class="field"><label for="acct">Account number</label><input id="acct" class="mono" placeholder="A-1234ABCD" required bind:value={form.account}></div>
      <div class="field"><label for="apikey">API key</label><input id="apikey" class="mono" type="password" placeholder="sk_live_…" required bind:value={form.key}></div>
    </div>
    <div class="inline-fields">
      <div class="field"><label for="gasunit">Gas meter reports in</label>
        <select id="gasunit" bind:value={form.gasUnit}><option value="m3">Cubic metres (SMETS2)</option><option value="kwh">kWh (SMETS1)</option></select></div>
      <div class="field"><label for="paymethod">How you pay</label>
        <select id="paymethod" bind:value={form.pay}><option value="DIRECT_DEBIT">Direct Debit</option><option value="NON_DIRECT_DEBIT">Prepay or on receipt of bill</option></select></div>
    </div>
    <label class="check" for="remember"><input id="remember" type="checkbox" bind:checked={form.remember}> Remember on this device</label>
    <div class="actions">
      <button class="btn primary" type="submit">{app.account ? 'Save and reload' : 'Connect'}</button>
      {#if app.account}<button class="btn" type="button" onclick={drop}>Forget my details</button>{/if}
      {#if saved}<span class="note" role="status">{saved}</span>{/if}
    </div>
    <p class="note">Both are in your Octopus account under Personal details → API access (<a href="https://octopus.energy/dashboard/new/accounts/personal-details/api-access" target="_blank" rel="noopener">open it</a>). The key stays in this browser and only goes to Octopus.</p>
  </form>
  <div class="field"><label for="region">Region for prices</label>
    <select id="region" value={app.region} onchange={region}>{#each Object.entries(REGIONS) as [k, v]}<option value={k}>{k} · {v}</option>{/each}</select>
    <span class="help">Set from your account when it's connected.</span></div>
</section>

<style>.line{font-size:16px} .mono{font-family:var(--f-mono)}</style>
