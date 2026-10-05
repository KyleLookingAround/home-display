<script>
  // The period every roll-up covers: 7, 30 or 90 days, kept on this device.
  import { onMount } from 'svelte';
  import { app, keep } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { addDays, shortDate, longDate } from '../lib/format.js';
  onMount(boot);
  const set = d => { app.days = d; keep('days'); };
</script>

<div class="periodbar">
  <div class="seg" role="group" aria-label="Period">
    {#each [7, 30, 90] as d}<button type="button" aria-pressed={app.days === d} onclick={() => set(d)}>{d} days</button>{/each}
  </div>
  <p class="muted mono small">{app.model ? `${shortDate(app.model.start)} – ${longDate(addDays(app.model.end, -1))}` : ''}</p>
</div>
