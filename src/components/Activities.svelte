<script>
  // What everyday things cost on your tariff and on Agile. The kWh can be changed, and are kept on this device.
  import { onMount } from 'svelte';
  import { app, keep } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { ACTIVITIES } from '../lib/analysis.js';
  import { gbp } from '../lib/format.js';
  onMount(boot);
  const now = $derived(app.now);
  const ag = $derived(app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to)) : []);
  const cur = $derived(ag.find(r => r.from <= now && now < r.to));
  const min = $derived(ag.length ? Math.min(...ag.filter(r => r.to > now).map(r => r.p)) : null);
  const cell = (k, r) => r == null || !isFinite(r) ? '—' : gbp(k * r);
  const kwhOf = a => +(app.acts[a.id] ?? a.kwh);
  function change(a, ev){ const v = parseFloat(ev.target.value); if (!(v >= 0)) return; app.acts[a.id] = v; keep('acts'); }
</script>

<section class="panel">
  <p class="panel-eyebrow">Unit costs</p><h2>What things cost</h2>
  <p class="muted small">Edit the kWh to match your appliances. Your changes are remembered on this device.</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Activity</th><th class="num">kWh</th><th class="num">Your tariff</th><th class="num">Agile now</th><th class="num">Agile cheapest</th></tr></thead>
    <tbody>
      {#each ACTIVITIES as a}
        {@const k = kwhOf(a)}
        {@const gas = a.fuel === 'g'}
        <tr><td>{a.label}{#if gas} <span class="tag" style="color:var(--gas)">Gas</span>{/if}</td>
          <td class="num"><input class="kwh" type="number" min="0" step="0.01" value={k} aria-label="kWh for {a.label}" onchange={ev => change(a, ev)}></td>
          <td class="num">{cell(k, gas ? app.gRateNow : app.eRateNow)}</td><td class="num">{gas ? '—' : cell(k, cur ? cur.p : null)}</td><td class="num">{gas ? '—' : cell(k, min)}</td></tr>
      {/each}
    </tbody>
  </table></div>
</section>
