<script>
  // The header on every page: its title, how fresh the data is, and Refresh. Also sends the negative price
  // notification when it's switched on, from whichever page is open.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot, refresh, loadPrices } from '../state/session.js';
  import { store } from '../lib/browser.js';
  import { hhmm, dayKey, pence } from '../lib/format.js';
  import FullScreen from './FullScreen.svelte';
  let { title, page = '' } = $props();
  let online = $state(true), busy = $state(false);
  onMount(() => {
    boot();
    online = navigator.onLine;
    const on = () => { online = true; }, off = () => { online = false; };
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  });
  const kind = $derived(!online ? 'offline' : busy || app.status === 'loading' ? 'loading' : app.status);
  const text = $derived(
    kind === 'offline' ? (app.checkedAt ? `Offline · ${hhmm(app.checkedAt)}` : 'Offline')
    : kind === 'loading' ? 'Updating…'
    : kind === 'demo' ? 'Example data'
    : kind === 'err' ? 'No signal'
    : `Updated ${hhmm(app.checkedAt || app.now)}`);
  async function again(){
    if (busy) return;
    busy = true;
    try { await Promise.all([refresh(), loadPrices(true)]); } finally { busy = false; }
  }
  // negative prices coming up: a notification, once per run of them, if switched on in Settings
  $effect(() => {
    const neg = app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to) && r.to > app.now && r.p < 0) : [];
    if (!neg.length) return;
    try {
      if (store.get('notify') === 'on' && 'Notification' in window && Notification.permission === 'granted'){
        const first = neg[0], key = 'neg-' + first.from;
        if (store.get('lastNotified') !== key){
          new Notification('Agile prices go negative', { body: `From ${hhmm(first.from)} ${dayKey(first.from) === dayKey(Date.now()) ? 'today' : 'tomorrow'}, as low as ${pence(Math.min(...neg.map(r => r.p)))}.` });
          store.set('lastNotified', key);
        }
      }
    } catch {}
  });
  // a Saving Session announced: a notification, once each, if switched on in Settings
  $effect(() => {
    const s = app.rewards && app.rewards.sessions, list = s ? (s.events || []).filter(e => +new Date(e.startAt) > app.now) : [];
    if (!list.length) return;
    try {
      if (store.get('notifySessions') === 'on' && 'Notification' in window && Notification.permission === 'granted'){
        const e = list[0], key = 'session-' + e.startAt;
        if (store.get('lastSession') !== key){
          const at = new Date(e.startAt);
          new Notification('Saving Session announced', { body: `${dayKey(at) === dayKey(Date.now()) ? 'Today' : 'On ' + at.toLocaleDateString('en-GB', { weekday: 'long' })} from ${hhmm(at)} to ${hhmm(new Date(e.endAt))}. Join it in the Octopus app.` });
          store.set('lastSession', key);
        }
      }
    } catch {}
  });
</script>

<header class="head">
  <h1>{title}</h1>
  <span class="status {kind}" id="status" role="status"><i></i>{text}</span>
  <button class="icon-btn" class:spin={busy} type="button" aria-label="Refresh" onclick={again}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>
  </button>
  <FullScreen />
  {#if page !== 'settings'}<a class="icon-btn phone-only" href="./settings.html" aria-label="Settings">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>
  </a>{/if}
</header>
