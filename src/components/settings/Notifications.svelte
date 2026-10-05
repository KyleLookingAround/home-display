<script>
  // Notifications on this device: Agile going below zero, and Saving Sessions announced. Sent while a page is open.
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  let neg = $state(false), sessions = $state(false), perm = $state('default'), supported = $state(true);
  onMount(() => {
    supported = 'Notification' in window;
    perm = supported ? Notification.permission : 'denied';
    neg = store.get('notify') === 'on'; sessions = store.get('notifySessions') === 'on';
  });
  async function set(key, on){
    if (on && supported && Notification.permission === 'default'){ try { perm = await Notification.requestPermission(); } catch {} }
    const ok = on && perm === 'granted';
    store.set(key, ok ? 'on' : 'off');
    if (key === 'notify') neg = ok; else sessions = ok;
  }
</script>

<section class="card" id="notifications">
  <h2 class="label">Notifications</h2>
  <label class="check" for="nNeg"><input id="nNeg" type="checkbox" checked={neg} disabled={!supported} onchange={ev => set('notify', ev.target.checked)}> When Agile prices go below zero</label>
  <label class="check" for="nSess"><input id="nSess" type="checkbox" checked={sessions} disabled={!supported} onchange={ev => set('notifySessions', ev.target.checked)}> When a Saving Session is announced</label>
  <p class="note">{!supported ? 'This browser can\'t show notifications. On iPhone, add the site to your home screen first.' : perm === 'denied' ? 'Notifications are blocked for this site in the browser\'s settings.' : 'They come while one of these pages is open, or added to your home screen.'}</p>
</section>
