<script>
  // What you've changed at home, with average use for two weeks either side. Entries mark the Usage chart too.
  import { onMount } from 'svelte';
  import { app, keep } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { addDays, dayKey, keyDate, longDate, startOfDay } from '../../lib/format.js';
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
      if (raw) for (const [label, cls, rows] of [['Electricity', 'elec', raw.elec], ['Gas', 'gas', raw.gas]]){
        const b = avgDaily(rows, addDays(d, -14), d), a = avgDaily(rows, d, Math.min(+addDays(d, 14), +today));
        if (b && a) parts.push({ label, cls, b: b.v, a: a.v, down: a.v < b.v, pct: Math.round(Math.abs(a.v - b.v) / b.v * 100) });
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

<section class="card" id="changes">
  <h2 class="label">Changes</h2>
  <p class="note">Note what you change at home. Each one shows on the Usage chart, with your average use for two weeks before and after.</p>
  {#if entries.length}
    <ul class="rows">
      {#each entries as c (c.id)}
        <li><span class="main-t"><span>{c.text}</span><span class="sub">{longDate(c.d)}</span>
          {#each c.parts as p}<span class="sub"><span class={p.cls}>{p.label}</span> {p.b.toFixed(1)} → {p.a.toFixed(1)} kWh a day <span class={p.down ? 'good' : 'bad'}>{p.down ? '−' : '+'}{p.pct}%</span></span>{/each}
          {#if !c.parts.length}<span class="sub">Before and after shows once there are readings either side.</span>{/if}</span>
          <button class="btn small" type="button" aria-label="Delete “{c.text}”" onclick={() => del(c.id)}>Delete</button></li>
      {/each}
    </ul>
    <p class="note">Gas doesn't allow for the weather, so a colder fortnight looks worse.</p>
  {/if}
  <form class="form" onsubmit={add}>
    <div class="inline-fields">
      <div class="field"><label for="clDate">Date</label><input id="clDate" type="date" required bind:value={date}></div>
      <div class="field wide"><label for="clText">What changed</label><input id="clText" placeholder="e.g. Boiler flow down to 55°C" required bind:value={text}></div>
    </div>
    <div class="actions"><button class="btn primary small" type="submit">Add</button></div>
  </form>
</section>

<style>
  .wide{grid-column:span 2}
  @media (max-width:520px){ .wide{grid-column:auto} }
</style>
