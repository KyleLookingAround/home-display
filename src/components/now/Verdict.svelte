<script>
  // The answer to "is now a good time to use power?", in one line, on Agile's half-hourly price.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { errorText } from '../../lib/net.js';
  import { cheapestWindow } from '../../lib/analysis.js';
  import { hhmm, pence, DOW, dayKey } from '../../lib/format.js';
  onMount(boot);
  const when = t => (dayKey(t) === dayKey(app.now) ? '' : DOW[new Date(t).getDay()] + ' ') + hhmm(t);
  const v = $derived.by(() => {
    const all = app.agileToday && app.agileToday.unit ? app.agileToday.unit.filter(r => isFinite(r.to)) : [];
    const now = app.now, i = all.findIndex(r => r.from <= now && now < r.to);
    if (i < 0) return null;
    const cur = all[i], ahead = all.slice(i).filter(r => r.from < now + 12 * 3600e3);
    const best = ahead.length >= 4 ? cheapestWindow(ahead, 4, now) : null;
    const runUntil = test => { let j = i; while (j + 1 < all.length && test(all[j + 1].p)) j++; return all[j].to; };
    if (cur.p < 0) return { tone: 'neg', big: 'Paid to use power', line: `${pence(cur.p)} now, below zero until ${when(runUntil(p => p < 0))}` };
    const cheapNow = cur.p < 15 || (best && cur.p <= best.avg * 1.1);
    if (cheapNow) return { tone: 'cheap', big: 'Good time', line: `${pence(cur.p)} now, cheap until ${when(runUntil(p => p < Math.max(15, cur.p * 1.1)))}` };
    if (best && best.from > now && best.avg < cur.p * 0.8) return { tone: cur.p >= 25 ? 'peak' : 'normal', big: 'Wait if you can', line: `${pence(cur.p)} now, ${pence(best.avg)} from ${when(best.from)}` };
    return { tone: cur.p >= 25 ? 'peak' : 'normal', big: cur.p >= 25 ? 'Peak price' : 'Normal price', line: `${pence(cur.p)} now, no cheaper spell in the next 12 hours` };
  });
</script>

<section class="answer" aria-live="polite">
  {#if v}
    <p class="big glow-{v.tone}">{v.big}</p>
    <p class="line">{v.line}</p>
    <p class="note">Agile, region {app.region}</p>
  {:else if app.agileErr}
    <p class="big">No prices</p>
    <p class="line muted">{errorText(app.agileErr).join(' ')}</p>
  {:else}
    <div class="skel" style="height:34px;width:60%"></div>
    <div class="skel" style="height:20px;width:80%"></div>
  {/if}
</section>
