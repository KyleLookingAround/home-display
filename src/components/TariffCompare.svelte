<script>
  // Your real half-hourly electricity priced on each Octopus import tariff for your region.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { errorText } from '../lib/net.js';
  import { COMPARE, findProduct, loadProductRates } from '../lib/octopus.js';
  import { compareTariffs } from '../lib/analysis.js';
  import { addDays, startOfDay, slotOf, gbp, gbp0 } from '../lib/format.js';
  onMount(boot);
  let busy = $state(false), progress = $state(''), err = $state('');

  async function run(){
    if (busy || !app.raw) return;
    busy = true; err = '';
    try {
      let opts;
      if (app.demo){
        // Example prices shaped like Go and Cosy, so the example comparison has something to show
        const go = [], cosy = [], sc = [{ from: 0, to: Infinity, p: 50 }];
        for (let t = +addDays(startOfDay(new Date()), -90); t < Date.now(); t += 1800e3){
          const s = slotOf(t);
          go.push({ from: t, to: t + 1800e3, p: s >= 1 && s < 11 ? 8.5 : 27.5 });
          cosy.push({ from: t, to: t + 1800e3, p: (s >= 8 && s < 14) || (s >= 26 && s < 32) || s >= 44 ? 13.5 : s >= 32 && s < 38 ? 38 : 26 });
        }
        opts = [{ ...COMPARE[0], unit: app.raw.agileHist.unit, sc: app.raw.agileHist.sc }, { ...COMPARE[1], unit: go, sc }, { ...COMPARE[4], unit: cosy, sc }];
      } else {
        const end = startOfDay(new Date()), from = addDays(end, -90); opts = [];
        for (const c of COMPARE){
          progress = `Fetching ${c.label} prices…`;
          try { const p = await findProduct(c.re); if (!p) continue; const r = await loadProductRates(p.code, app.region, from, end, 4, app.pay); if (r.unit && r.unit.length) opts.push({ ...c, product: p.code, unit: r.unit, sc: r.sc }); }
          catch (e){ if (e.code === 'NETWORK') throw e; }
        }
      }
      app.compareOpts = opts;
      app.compare = compareTariffs(app.raw, opts);
    } catch (e){ err = errorText(e).join(' '); }
    busy = false; progress = '';
  }
  const a = $derived(app.model && app.model.agileCmp);
  const c = $derived(app.compare), mine = $derived(c ? c.rows.find(r => r.id === 'current') : null);
</script>

<section class="panel">
  <div class="panel-head">
    <div><p class="panel-eyebrow">Trajectory analysis</p><h2>Tariff comparison</h2><p class="muted small">Your real half-hourly electricity, priced on each Octopus tariff for your region. Gas isn't included.</p></div>
    <button class="btn primary small" type="button" disabled={busy || !app.raw} onclick={run}>{c ? 'Run again' : 'Run comparison'}</button>
  </div>
  {#if a}
    <div class="prose"><p>{app.demo ? 'Example: ' : ''}Over the last {a.days} days with readings you paid <b>{gbp(a.yours)}</b> for electricity. On Agile, same use at the same times, it would have been <b>{gbp(a.agile)}</b> ({a.yours - a.agile >= 0 ? gbp(a.yours - a.agile) + ' less' : gbp(a.agile - a.yours) + ' more'}).</p></div>
  {/if}
  {#if err}<p class="bad">{err}</p>
  {:else if busy}<p class="muted">{progress || 'Working it out…'}</p>
  {:else if c && mine}
    <div class="tbl-wrap"><table>
      <thead><tr><th>Tariff</th><th class="num">A year, about</th><th class="num">vs yours</th><th>Who it's for</th></tr></thead>
      <tbody>
        {#each c.rows as r, i}
          {@const d = r.year - mine.year}
          <tr class={r.id === 'current' ? 'mine' : i === 0 ? 'best' : ''}><td>{r.label}{#if i === 0}<span class="tag good">Cheapest</span>{/if}</td><td class="num">{gbp0(r.year)}</td>
            <td class="num {d < 0 ? 'good' : d > 0 ? 'bad' : ''}">{r.id === 'current' ? '—' : (d < 0 ? '−' : '+') + gbp0(Math.abs(d))}</td><td class="muted small">{r.note || ''}</td></tr>
        {/each}
      </tbody>
    </table></div>
    <p class="muted small">{app.demo ? 'Example figures. ' : ''}Based on {c.days} days of your readings scaled to a year, including standing charges. Your autumn use may not match the rest of the year, and eligibility rules come from Octopus.</p>
  {:else if app.raw}
    {#if app.raw.elec.length}<p class="muted small">Run the comparison to price your use on every Octopus import tariff.</p>
    {:else}<div class="empty">Needs electricity readings to compare tariffs.</div>{/if}
  {/if}
</section>
