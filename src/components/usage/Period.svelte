<script>
  // The period every figure on this page covers, and whether to set it against the period before.
  import { onMount } from 'svelte';
  import { app, keep } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { compareOn } from '../../state/usage.svelte.js';
  import { addDays, shortDate, longDate } from '../../lib/format.js';
  onMount(boot);
  const set = d => { app.days = d; keep('days'); };
</script>

<div class="period">
  <div class="seg" role="group" aria-label="Period">{#each [7, 30, 90] as d}<button type="button" aria-pressed={app.days === d} onclick={() => set(d)}>{d} days</button>{/each}</div>
  <label class="check small"><input type="checkbox" bind:checked={compareOn.on} onchange={() => compareOn.save()}> Compare with the period before</label>
  <p class="muted small mono">{app.model ? `${shortDate(app.model.start)} – ${longDate(addDays(app.model.end, -1))}` : ''}</p>
</div>

<style>.period{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s4)} .period p{margin-left:auto}</style>
