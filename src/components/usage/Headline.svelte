<script>
  // The period in one line: electricity, gas and cost, each against the period before.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { compareOn } from '../../state/usage.svelte.js';
  import { kwh, gbp0 } from '../../lib/format.js';
  onMount(boot);
  const t = $derived(app.model ? app.model.tot : null), b = $derived(compareOn.before ? compareOn.before.tot : null);
  const ch = (a, x, n, m) => !b || !n || !m || !(x > 0) ? null : (a / n * n - x / m * n) / (x / m * n);   // per-day change, fair when days differ
  const fmt = c => c == null ? '' : `${c >= 0 ? '+' : '−'}${Math.round(Math.abs(c) * 100)}%`;
  const rows = $derived(t ? [
    { k: 'Electricity', cls: 'elec', v: t.nE ? kwh(t.e) : '—', c: b ? ch(t.e, b.e, t.nE, b.nE) : null },
    { k: 'Gas', cls: 'gas', v: t.nG ? kwh(t.g) : '—', c: b ? ch(t.g, b.g, t.nG, b.nG) : null },
    { k: 'Cost', cls: '', v: t.nE || t.nG ? gbp0(t.ec + t.gc) : '—', c: b ? ch(t.ec + t.gc, b.ec + b.gc, Math.max(t.nE, t.nG), Math.max(b.nE, b.nG)) : null }
  ] : []);
</script>

<section class="card">
  <div class="stats">
    {#each rows as r}
      <div class="stat"><span class="v {r.cls}">{r.v}</span><span class="k">{r.k}{app.demo ? ' · example' : ''}</span>{#if compareOn.on && r.c != null}<span class="d {r.c > 0.02 ? 'bad' : r.c < -0.02 ? 'good' : 'muted'}">{fmt(r.c)} a day</span>{/if}</div>
    {/each}
  </div>
</section>
