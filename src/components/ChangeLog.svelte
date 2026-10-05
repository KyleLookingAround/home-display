<script>
  // What you've changed at home, with average use for two weeks either side. Entries show on the daily chart too.
  import { onMount } from 'svelte';
  import { app, keep } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { addDays, dayKey, keyDate, longDate, startOfDay } from '../lib/format.js';
  onMount(() => { if (!date) date = dayKey(Date.now()); boot(); });   // a date typed before the page was ready stays
  let date = $state(''), text = $state('');
  function avgDaily(rows, from, to){
    const s = +from, e = +to, days = new Set(); let t = 0;
    for (const x of rows) if (x.t >= s && x.t < e){ t += x.v; days.add(dayKey(x.t)); }
    return days.size >= 5 ? { v: t / days.size } : null;
  }
  const entries = $derived.by(() => {
    const raw = app.raw, today = startOfDay(new Date(app.now));
    return app.changelog.slice().sort((a, b) => b.date.localeCompare(a.date)).map(c => {
      const d = keyDate(c.date), parts = [];
      if (raw) for (const [label, rows] of [['Electricity', raw.elec], ['Gas', raw.gas]]){
        const b = avgDaily(rows, addDays(d, -14), d), a = avgDaily(rows, d, Math.min(+addDays(d, 14), +today));
        if (b && a) parts.push({ label, b: b.v, a: a.v, down: a.v < b.v, pct: Math.round(Math.abs(a.v - b.v) / b.v * 100) });
      }
      return { ...c, d, parts };
    });
  });
  function add(ev){
    ev.preventDefault();
    const t = text.trim(); if (!date || !t) return;
    app.changelog.push({ id: String(Date.now()), date, text: t }); keep('changelog'); text = '';
  }
  function del(id){ app.changelog = app.changelog.filter(c => c.id !== id); keep('changelog'); }
</script>

<section class="panel">
  <p class="panel-eyebrow">Ship's log · changes</p><h2>Change log</h2>
  <p class="muted small">Note what you change at home. Each entry appears on the daily chart, with average use for two weeks before and after.</p>
  <form class="grid" onsubmit={add}>
    <div class="field"><label for="clDate">Date</label><input id="clDate" type="date" required bind:value={date}></div>
    <div class="field" style="grid-column:span 2"><label for="clText">What changed</label><input id="clText" placeholder="e.g. Boiler flow temperature down to 55°C" required bind:value={text}></div>
    <div class="form-actions"><button class="btn primary small" type="submit">Add to log</button></div>
  </form>
  {#if !entries.length}
    <p class="muted small">No entries yet. Try logging the date you switched to Octopus, or the next thing you change.</p>
  {:else}
    <ul class="list">
      {#each entries as c (c.id)}
        <li><span><span class="when">{longDate(c.d)}</span><br>{c.text}</span>
          <span class="small">
            {#if c.parts.length}{#each c.parts as p, i}{#if i}<br>{/if}{p.label} {p.b.toFixed(1)} → {p.a.toFixed(1)} kWh/day <span class={p.down ? 'good' : 'bad'}>({p.down ? '−' : '+'}{p.pct}%)</span>{/each}
            {:else}<span class="muted">Before and after appears once there are readings on both sides.</span>{/if}
            <button class="btn small" type="button" aria-label="Delete entry" onclick={() => del(c.id)}>Delete</button>
          </span></li>
      {/each}
    </ul>
    <p class="muted small">Gas comparisons don't account for the weather, so a colder fortnight will look worse.</p>
  {/if}
</section>
