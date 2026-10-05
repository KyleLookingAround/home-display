<script>
  // Your tariff against Agile looking back, and, once run, your real half hours priced on every Octopus import tariff.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { cacheGet, cacheSet } from '../../state/cache.js';
  import { errorText } from '../../lib/net.js';
  import { COMPARE, GAS_COMPARE, findProduct, loadProductRates, loadGasOffer, unitPriceAt, standingAt } from '../../lib/octopus.js';
  import { compareTariffs, compareGas } from '../../lib/analysis.js';
  import { kwh as fmtKwh, pence } from '../../lib/format.js';
  import { addDays, startOfDay, slotOf, gbp, gbp0, shortDate } from '../../lib/format.js';
  import Upgrade from './Upgrade.svelte';
  onMount(boot);
  let busy = $state(false), progress = $state(''), err = $state(''), checked = $state(0), tried = '';
  let gasOffers = $state.raw(null);
  const gc = $derived(app.reg && gasOffers && app.raw && app.raw.gas.length ? compareGas(app.reg, { unit: unitPriceAt(app.raw.gSets, Date.now()), sc: standingAt(app.raw.gSets, Date.now()) }, gasOffers) : null);
  const gasMine = $derived(gc ? gc.rows.find(r => r.id === 'current') : null);
  const WEEK = 7 * 864e5;
  const key = () => 'compare:' + (app.demo ? 'example' : app.account);
  // Once the readings are here: last week's comparison if there is one, otherwise run it now, quietly.
  $effect(() => {
    const raw = app.raw;
    if (!raw || !raw.elec.length || app.status === 'loading' || tried === key()) return;
    tried = key();
    (async () => {
      const c = await cacheGet(key(), WEEK);
      if (c && app.raw === raw){ app.compareOpts = c.value.opts; app.compare = c.value.result; gasOffers = c.value.gas || null; checked = c.at; }
      else run();
    })();
  });

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
      // gas: each tariff's rates today
      let gas = [];
      if (app.raw.gas.length){
        if (app.demo){
          const u = unitPriceAt(app.raw.gSets, Date.now()), s = standingAt(app.raw.gSets, Date.now());
          gas = [{ ...GAS_COMPARE[1], unit: u * 0.93, sc: s * 1.04 }, { ...GAS_COMPARE[2], unit: u * 0.96, sc: s }];
        } else for (const g of GAS_COMPARE){
          progress = `Fetching ${g.label} gas prices…`;
          try { const p = await findProduct(g.re); if (!p) continue; const o = await loadGasOffer(p.code, app.region, app.pay); if (o.unit != null) gas.push({ ...g, ...o }); }
          catch (e){ if (e.code === 'NETWORK') throw e; }
        }
      }
      gasOffers = gas;
      checked = Date.now();
      cacheSet(key(), { opts, result: app.compare, gas });
    } catch (e){ err = errorText(e).join(' '); }
    busy = false; progress = '';
  }
  const a = $derived(app.model && app.model.agileCmp);
  const c = $derived(app.compare), mine = $derived(c ? c.rows.find(r => r.id === 'current') : null);
  const best = $derived(c && mine ? c.rows[0] : null);
  const gasSaving = $derived(gc && gasMine ? Math.max(0, gasMine.year - gc.rows[0].year) : 0);
  const saving = $derived((best ? mine.year - best.year : a ? (a.yours - a.agile) * 365 / a.days : null) + (best ? gasSaving : 0));
  const gasLine = $derived(gc && gc.rows[0].id !== 'current' ? ` For gas, ${gc.rows[0].label}.` : gc ? ' Your gas tariff is already the cheapest.' : '');
  const line = $derived(best ? (best.id === 'current' ? 'Your electricity tariff is already the cheapest for how you use power.' : `${best.label} would be the cheapest for how you use electricity.`) + gasLine
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
    <p class="note">{app.demo ? 'Example figures. ' : ''}From {c.days} days of your readings scaled to a year, with standing charges{checked ? `, checked ${shortDate(new Date(checked))}` : ''}. It's checked again each week. Who can switch is up to Octopus.</p>
  {:else if app.raw && !app.raw.elec.length}<p class="note">Needs electricity readings to compare tariffs.</p>{/if}
  {#if gc && gasMine}
    <h3 class="sub-h">Gas</h3>
    <div class="tbl"><table>
      <thead><tr><th>Tariff</th><th class="num">A year</th><th class="num">vs yours</th></tr></thead>
      <tbody>
        {#each gc.rows as r, i}
          {@const d = r.year - gasMine.year}
          <tr class={r.id === 'current' ? 'mine' : i === 0 ? 'best' : ''}><td>{r.label}<br><span class="small muted">{pence(r.unit)}/kWh, {pence(r.sc || 0)} a day{r.note ? '. ' + r.note : ''}</span></td><td class="num">{gbp0(r.year)}</td>
            <td class="num {d < 0 ? 'good' : d > 0 ? 'bad' : ''}">{r.id === 'current' ? '—' : (d < 0 ? '−' : '+') + gbp0(Math.abs(d))}</td></tr>
        {/each}
      </tbody>
    </table></div>
    <p class="note">{app.demo ? 'Example figures. ' : ''}A usual year of your gas, about {fmtKwh(gc.kwh)} with winter included, at each tariff's rates today. Fixed rates stay put; the others will move.</p>
  {/if}
</Upgrade>

<style>.sub-h{font:600 14px/1.3 var(--f-body);margin-top:var(--s2)}</style>
