<script>
  // Your Energy Performance Certificate: the ratings and recommendations you note down, and a search through the helper.
  import { onMount } from 'svelte';
  import { app, keep } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { errorText } from '../lib/net.js';
  import { searchEPC } from '../lib/epc.js';
  onMount(boot);
  const COL = { A: '#11a14b', B: '#2fb34a', C: '#8cc63e', D: '#ffcc00', E: '#f7a41d', F: '#ef7d2d', G: '#e5232c' };
  let postcode = $state(''), token = $state(''), result = $state.raw(null);
  const save = () => keep('epc');
  async function search(ev){
    ev.preventDefault();
    if (!postcode.trim() || !token.trim()){ result = { msg: 'Enter a postcode and your EPC data service token.' }; return; }
    result = { msg: 'Searching…' };
    try {
      const j = await searchEPC(postcode.trim(), token.trim());
      const rows = Array.isArray(j) ? j : j.data || j.results || j.rows || j.certificates || [];
      if (!rows.length){ result = { msg: 'No certificates found for that postcode.' }; return; }
      const keys = Object.keys(rows[0]).filter(k => /address|postcode|rating|band|current|potential|date|lodg|certificate.?(number|id)|rrn/i.test(k)).slice(0, 6);
      result = { keys, rows: rows.slice(0, 25) };
    } catch (e){ result = { err: errorText(e).join(' ') }; }
  }
  const cell = v => typeof v === 'object' ? JSON.stringify(v) : v;
</script>

<section class="panel">
  <p class="panel-eyebrow">Certification</p><h2>Energy Performance Certificate</h2>
  <div class="inputs">
    <div class="field"><label for="epcCur">Current rating</label><select id="epcCur" bind:value={app.epc.cur} onchange={save}><option value="">Not set</option>{#each 'ABCDEFG'.split('') as b}<option>{b}</option>{/each}</select></div>
    <div class="field"><label for="epcPot">Potential rating</label><select id="epcPot" bind:value={app.epc.pot} onchange={save}><option value="">Not set</option>{#each 'ABCDEFG'.split('') as b}<option>{b}</option>{/each}</select></div>
  </div>
  <div class="field"><label for="epcNotes">Recommended improvements from your certificate</label><textarea id="epcNotes" placeholder="Paste or type the recommendations here" bind:value={app.epc.notes} oninput={save}></textarea></div>
  {#if app.epc.cur}
    <div class="epc"><span style="background:{COL[app.epc.cur]}">{app.epc.cur}</span><span style="color:var(--muted);background:none">now</span>
      {#if app.epc.pot}<span style="color:var(--muted);background:none">→</span><span style="background:{COL[app.epc.pot]}">{app.epc.pot}</span><span style="color:var(--muted);background:none">potential</span>{/if}</div>
  {/if}
  <p class="muted small">Look up your certificate on <a href="https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode" target="_blank" rel="noopener">find-energy-certificate.service.gov.uk</a>. With the home server helper running, you can also search the government's data service here.</p>
  <form class="grid" onsubmit={search}>
    <div class="field"><label for="epcPostcode">Postcode</label><input id="epcPostcode" class="mono" placeholder="SK1 …" bind:value={postcode}></div>
    <div class="field"><label for="epcToken">EPC data service token</label><input id="epcToken" class="mono" type="password" placeholder="From your EPC data account" bind:value={token}></div>
    <div class="form-actions"><button class="btn small" type="submit">Search certificates</button></div>
  </form>
  {#if result}
    {#if result.msg}<p class="muted">{result.msg}</p>
    {:else if result.err}<p class="bad">{result.err}</p>
    {:else}
      <div class="tbl-wrap"><table><thead><tr>{#each result.keys as k}<th>{k.replace(/[_-]/g, ' ')}</th>{/each}</tr></thead>
        <tbody>{#each result.rows as r}<tr>{#each result.keys as k}<td>{cell(r[k])}</td>{/each}</tr>{/each}</tbody></table></div>
      <p class="muted small">Showing what the data service returned. Copy your rating and recommendations into the fields above.</p>
    {/if}
  {/if}
</section>
