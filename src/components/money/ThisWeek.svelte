<script>
  // The week in a few lines against the week before, ready to copy.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { weekLog } from '../../lib/analysis.js';
  import { shortDate, longDate, kwh, gbp, fmtDate, keyDate } from '../../lib/format.js';
  onMount(boot);
  let copied = $state(''), pre = $state();
  const w = $derived(app.raw ? weekLog(app.raw) : null);
  const ch = (a, b) => b > 0 ? `${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b) / b * 100)}%` : '';
  const text = $derived.by(() => {
    if (!w || !w.cur.days) return null;
    const c = w.cur, p = w.prev, pad = (s, n) => (s + ' '.repeat(n)).slice(0, n), d = (a, b) => ch(a, b) ? ` (${ch(a, b)})` : '';
    return [`LOG · ${shortDate(c.from)} – ${longDate(c.to)}${app.demo ? ' · EXAMPLE' : ''}`, '',
      `${pad('Electricity', 13)}${kwh(c.e)}${d(c.e, p.e)}`, `${pad('Gas', 13)}${kwh(c.g)}${d(c.g, p.g)}`, `${pad('Cost', 13)}${gbp(c.cost)}${d(c.cost, p.cost)}`,
      c.best ? `${pad('Quietest day', 13)}${fmtDate(keyDate(c.best[0]))}, ${kwh(c.best[1])}` : '', c.worst ? `${pad('Busiest day', 13)}${fmtDate(keyDate(c.worst[0]))}, ${kwh(c.worst[1])}` : '',
      p.days ? '\nChanges are against the week before.' : ''].join('\n');
  });
  async function copy(){
    try { await navigator.clipboard.writeText(text); copied = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copied = 'Selected'; }
    setTimeout(() => { copied = ''; }, 1800);
  }
</script>

<section class="card">
  <div class="card-head"><h2 class="label">This week</h2>{#if text}<button class="link" type="button" onclick={copy}>{copied || 'Copy'}</button>{/if}</div>
  {#if w && w.cur.days}
    <div class="stats">
      <div class="stat"><span class="v">{gbp(w.cur.cost)}</span><span class="k">Cost {#if ch(w.cur.cost, w.prev.cost)}<span class={w.cur.cost > w.prev.cost ? 'bad' : 'good'}>{ch(w.cur.cost, w.prev.cost)}</span>{/if}</span></div>
      <div class="stat"><span class="v elec">{kwh(w.cur.e)}</span><span class="k">Electricity {#if ch(w.cur.e, w.prev.e)}<span class={w.cur.e > w.prev.e ? 'bad' : 'good'}>{ch(w.cur.e, w.prev.e)}</span>{/if}</span></div>
      <div class="stat"><span class="v gas">{kwh(w.cur.g)}</span><span class="k">Gas {#if ch(w.cur.g, w.prev.g)}<span class={w.cur.g > w.prev.g ? 'bad' : 'good'}>{ch(w.cur.g, w.prev.g)}</span>{/if}</span></div>
    </div>
    <details class="fold"><summary>The log, as text</summary><pre class="log" bind:this={pre}>{text}</pre></details>
  {:else if app.raw}<p class="note">Your first weekly log appears after a week of readings.</p>{/if}
</section>

<style>.log{font:13px/1.6 var(--f-mono);white-space:pre-wrap;margin:0;background:var(--card-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:var(--s3);overflow-x:auto}</style>
