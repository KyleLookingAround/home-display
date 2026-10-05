<script>
  // The Energy Performance Certificate: the rating (E), its potential, and the recommendations noted from it.
  import { app, keep } from '../../state/app.svelte.js';
  const COL = { A: '#11a14b', B: '#2fb34a', C: '#8cc63e', D: '#ffcc00', E: '#f7a41d', F: '#ef7d2d', G: '#e5232c' };
  const BANDS = 'ABCDEFG'.split('');
  const cur = $derived(app.epc.cur || 'E');
  const save = () => keep('epc');
</script>

<section class="card" id="certificate">
  <h2 class="label">Energy certificate</h2>
  <div class="ladder" role="img" aria-label="Rated {cur}{app.epc.pot ? ', could reach ' + app.epc.pot : ''}">
    {#each BANDS as b, i}
      <div class="band" style="width:{38 + i * 9}%;background:{COL[b]}"><span>{b}</span>
        {#if b === cur}<em>Now</em>{/if}{#if b === app.epc.pot && b !== cur}<em>Could be</em>{/if}</div>
    {/each}
  </div>
  <p class="note">Insulation, draught-proofing and heating controls are what usually take a house from {cur} up a band. Solar panels and a battery count too.</p>
  <details class="fold"><summary>Your certificate</summary>
    <div class="form">
      <div class="inline-fields">
        <div class="field"><label for="epcCur">Rating</label><select id="epcCur" value={cur} onchange={ev => { app.epc.cur = ev.target.value; save(); }}>{#each BANDS as b}<option>{b}</option>{/each}</select></div>
        <div class="field"><label for="epcPot">Potential</label><select id="epcPot" bind:value={app.epc.pot} onchange={save}><option value="">Not noted</option>{#each BANDS as b}<option>{b}</option>{/each}</select></div>
      </div>
      <div class="field"><label for="epcNotes">Its recommendations</label><textarea id="epcNotes" placeholder="Type or paste them from your certificate" bind:value={app.epc.notes} oninput={save}></textarea></div>
      <p class="note">Your certificate is on <a href="https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode" target="_blank" rel="noopener">find-energy-certificate.service.gov.uk</a>. What you note here stays on this device.</p>
    </div>
  </details>
</section>

<style>
  .ladder{display:grid;gap:3px}
  .band{display:flex;align-items:center;justify-content:space-between;height:22px;padding:0 8px;border-radius:3px;color:#111;font:700 13px/1 var(--f-body);opacity:.45}
  .band:has(em){opacity:1}
  .band em{font:500 11px/1 var(--f-mono);text-transform:uppercase;letter-spacing:.06em;font-style:normal}
</style>
