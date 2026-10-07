<script>
  /*
   * The commute's answer, before the board: what to do and when ("Leave by 07:38", "Leave in 4 min", "Run for it"),
   * why ("In for 09:00"), and how it goes: the train, where you get off, when you're there (commuteAnswer).
   */
  let { ans } = $props();
</script>

<div class="go {ans.tone}" role="status">
  <div class="top"><span class="big">{ans.title}</span> {#if ans.note}<span class="why">{ans.note}</span>{/if}</div>
  {' '}<div class="chain">
    {#each ans.steps as s, i}{#if i}{' '}<span class="sep" aria-hidden="true">›</span>{' '}{/if}<span class="st {s.k}" class:late={s.late}>{s.text}</span>{/each}
  </div>
</div>

<style>
  .go{margin:0 0 var(--s3);padding:var(--s3);border-radius:var(--radius-sm);border:1px solid var(--line);background:linear-gradient(135deg,rgba(255,181,71,.10),rgba(255,181,71,.02));border-left:3px solid var(--elec)}
  .go.warn{border-left-color:var(--warn);background:linear-gradient(135deg,rgba(255,209,102,.12),rgba(255,209,102,.02))}
  .go.bad{border-left-color:var(--bad);background:linear-gradient(135deg,rgba(255,107,125,.12),rgba(255,107,125,.02))}
  .top{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px var(--s3)}
  .big{font:700 22px/1.15 var(--f-display);letter-spacing:.03em;text-transform:uppercase;color:var(--elec);text-shadow:0 0 18px rgba(255,181,71,.35)}
  .go.warn .big{color:var(--warn)} .go.bad .big{color:var(--bad);text-shadow:0 0 18px rgba(255,107,125,.35)}
  .why{font:500 13px/1.2 var(--f-mono);color:var(--muted)}
  .chain{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:8px;font:500 14px/1.3 var(--f-mono);color:var(--ink)}
  .sep{color:var(--faint)}
  .st{white-space:nowrap}
  .st.work,.st.home{color:var(--gas)}
  .st.late{color:var(--bad)}
</style>
