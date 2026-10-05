<script>
  // Downloading your readings, and how the dashboard is set up.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { toCSV } from '../lib/analysis.js';
  import { dayKey } from '../lib/format.js';
  onMount(boot);
  function download(){
    if (!app.raw) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCSV(app.raw)], { type: 'text/csv' }));
    a.download = `harold-street-energy-${dayKey(Date.now())}${app.demo ? '-example' : ''}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
</script>

<section class="panel">
  <p class="panel-eyebrow">Systems</p><h2>Data and setup</h2>
  <div class="prose">
    {#if app.proxy}<p class="good">Running through your home server helper. Octopus, PVGIS and EPC requests go through it.</p>
    {:else}<p><b>Home server helper.</b> Some services, PVGIS solar data and the EPC register, don't let a browser page call them directly. Copy the site and <span class="mono">server.py</span> to your home server, run <span class="mono">python3 server.py</span>, then open <span class="mono">http://&lt;server address&gt;:8787</span> on any device at home. It also lets you add the app to your phone's home screen.</p>{/if}
  </div>
  <div class="actions"><button class="btn small" type="button" disabled={!app.raw} onclick={download}>Download readings (CSV)</button></div>
  <div class="prose small muted">
    <p><b>Put it on your phone.</b> Use Share → Add to Home Screen on iPhone, or the menu → Install app / Add to home screen in Chrome on Android.</p>
    <p><b>Wall display.</b> The Wall display button opens the household display: energy, home, travel, a screensaver and a night clock, made for a wall tablet or the TV. Each mode has its own link, such as <span class="mono">display.html#home</span>, so each screen can open its favourite.</p>
  </div>
</section>
