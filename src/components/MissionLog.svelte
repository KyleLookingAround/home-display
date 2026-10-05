<script>
  // The weekly log: this week against last, ready to copy.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { weekLog } from '../lib/analysis.js';
  import { shortDate, longDate, kwh, gbp, fmtDate, keyDate } from '../lib/format.js';
  onMount(boot);
  let copied = $state(''), pre = $state();
  const text = $derived.by(() => {
    if (!app.raw) return null;
    const w = weekLog(app.raw), c = w.cur, p = w.prev;
    if (!c.days) return null;
    const ch = (a, b) => b > 0 ? ` (${a >= b ? '+' : '−'}${Math.round(Math.abs(a - b) / b * 100)}%)` : '';
    const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
    return [
      `LOG · ${shortDate(c.from)} – ${longDate(c.to)}${app.demo ? ' · EXAMPLE' : ''}`, '',
      `${pad('Electricity', 13)}${kwh(c.e)}${ch(c.e, p.e)}`,
      `${pad('Gas', 13)}${kwh(c.g)}${ch(c.g, p.g)}`,
      `${pad('Cost', 13)}${gbp(c.cost)}${ch(c.cost, p.cost)}`,
      c.best ? `${pad('Quietest day', 13)}${fmtDate(keyDate(c.best[0]))}, ${kwh(c.best[1])}` : '',
      c.worst ? `${pad('Busiest day', 13)}${fmtDate(keyDate(c.worst[0]))}, ${kwh(c.worst[1])}` : '',
      p.days ? '\nChanges are against the week before.' : ''
    ].join('\n');
  });
  async function copy(){
    if (!text) return;
    try { await navigator.clipboard.writeText(text); copied = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copied = 'Selected'; }
    setTimeout(() => { copied = ''; }, 1800);
  }
</script>

<section class="panel">
  <div class="panel-head"><div><p class="panel-eyebrow">Captain's log · weekly</p><h2>Mission log</h2></div><button class="btn small" type="button" disabled={!text} onclick={copy}>{copied || 'Copy'}</button></div>
  {#if text}<div class="log" bind:this={pre}>{text}</div>
  {:else if app.raw}<div class="empty">Your first weekly log appears after a week of readings.</div>{/if}
</section>
