<script>
  // Your tariff against Agile looking back, and, once run, your real half hours priced on every Octopus import tariff.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { errorText } from '../../lib/net.js';
  import { COMPARE, findProduct, loadProductRates } from '../../lib/octopus.js';
  import { compareTariffs } from '../../lib/analysis.js';
  import { addDays, startOfDay, slotOf, gbp, gbp0 } from '../../lib/format.js';
  import Upgrade from './Upgrade.svelte';
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
  const best = $derived(c && mine ? c.rows[0] : null);
  const saving = $derived(best ? mine.year - best.year : a ? (a.yours - a.agile) * 365 / a.days : null);
  const line = $derived(best ? (best.id === 'current' ? 'Your tariff is already the cheapest for how you use power.' : `${best.label} is the cheapest for how you use power.`)
    : a ? (a.agile < a.yours ? `Agile would have cost less over the last ${a.days} days.` : `Agile would have cost more over the last ${a.days} days.`) : 'Your half hours priced on other tariffs.');
</script>

<Upgrade id="tariffs" title="Tariffs" {line} saving={saving == null ? null : Math.max(0, saving)} cost={0} example={app.demo} waiting={!app.raw}>
  {#if a}<p class="note">Over the last {a.days} days with readings you paid {gbp(a.yours)} for electricity. On Agile, the same use at the same times would have been {gbp(a.agile)}.</p>{/if}
  <div class="actions"><button class="btn primary small" type="button" disabled={busy || !app.raw || !app.raw.elec.length} onclick={run}>{c ? 'Run again' : 'Price every Octopus tariff'}</button>{#if busy}<span class="note">{progress || 'Working it out…'}</span>{/if}</div>
  {#if err}<p class="bad">{err}</p>
  {:else if c && mine}
    <div class="tbl"><table>
      <thead><tr><th>Tariff</th><th class="num">A year</th><th class="num">vs yours</th></tr></thead>
      <tbody>
        {#each c.rows as r, i}
          {@const d = r.year - mine.year}
          <tr class={r.id === 'current' ? 'mine' : i === 0 ? 'best' : ''}><td>{r.label}{#if r.note}<br><span class="small muted">{r.note}</span>{/if}</td><td class="num">{gbp0(r.year)}</td>
            <td class="num {d < 0 ? 'good' : d > 0 ? 'bad' : ''}">{r.id === 'current' ? '—' : (d < 0 ? '−' : '+') + gbp0(Math.abs(d))}</td></tr>
        {/each}
      </tbody>
    </table></div>
    <p class="note">{app.demo ? 'Example figures. ' : ''}From {c.days} days of your readings scaled to a year, with standing charges. Electricity only; who can switch is up to Octopus.</p>
  {:else if app.raw && !app.raw.elec.length}<p class="note">Needs electricity readings to compare tariffs.</p>{/if}
</Upgrade>
