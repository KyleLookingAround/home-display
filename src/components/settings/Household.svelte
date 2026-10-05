<script>
  /*
   * The household's settings: bins, the station and walk, the tram stop and the calendar. They start from
   * household.json, which every screen shares; what you change here stays on this device, as on a screen.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { houseSettings, saveHouse } from '../../state/house.js';
  import { BIN_COLOURS } from '../../lib/household.js';
  let f = $state(null), saved = $state('');
  const KEYS = ['bins', 'trainFrom', 'trainTo', 'trainWalk', 'tramStop', 'tramWalk', 'ical'];
  const fill = s => { const o = {}; KEYS.forEach(k => { o[k] = k === 'bins' ? s.bins.map(b => ({ name: b.name, what: b.what || '', colour: b.colour || 'grey', date: b.date, every: +b.every || 1 })) : s[k]; }); return o; };
  onMount(async () => { f = fill(await houseSettings()); });
  async function save(ev){
    ev.preventDefault();
    const form = $state.snapshot(f);
    form.trainFrom = String(form.trainFrom || '').trim().toUpperCase(); form.trainTo = String(form.trainTo || '').trim().toUpperCase();
    form.trainWalk = +form.trainWalk || 0; form.tramWalk = +form.tramWalk || 0; form.ical = String(form.ical || '').trim();
    form.bins = form.bins.filter(b => b.name && b.date).map(b => ({ ...b, every: Math.max(1, Math.round(+b.every || 1)) }));
    await saveHouse(form);
    f = fill(app.house); saved = 'Saved on this device.';
  }
  const addBin = () => { f.bins.push({ name: '', what: '', colour: 'grey', date: '', every: 2 }); };
</script>

<section class="card" id="household">
  <h2 class="label">Household</h2>
  {#if f}
    <form class="form" onsubmit={save}>
      <fieldset>
        <legend>Bins</legend>
        {#each f.bins as b, i}
          <details class="bin" open={!b.name}>
            <summary><i style="background:{BIN_COLOURS[b.colour] || BIN_COLOURS.grey}"></i>{b.name || 'New bin'}<span class="muted">every {+b.every === 1 ? 'week' : (+b.every || 1) + ' weeks'}</span></summary>
            <div class="inline-fields">
              <div class="field"><label for="bn{i}">Bin</label><input id="bn{i}" bind:value={b.name} placeholder="Green bin"></div>
              <div class="field"><label for="bc{i}">Colour</label><select id="bc{i}" bind:value={b.colour}>{#each Object.keys(BIN_COLOURS) as c}<option>{c}</option>{/each}</select></div>
            </div>
            <div class="inline-fields">
              <div class="field"><label for="bd{i}">A collection date</label><input id="bd{i}" type="date" bind:value={b.date}></div>
              <div class="field"><label for="be{i}">Every (weeks)</label><input id="be{i}" type="number" min="1" max="8" bind:value={b.every}></div>
            </div>
            <div class="field"><label for="bw{i}">What goes in it</label><input id="bw{i}" bind:value={b.what} placeholder="Garden and food waste"></div>
            <button class="btn small" type="button" onclick={() => f.bins.splice(i, 1)}>Remove {b.name || 'this bin'}</button>
          </details>
        {/each}
        <button class="btn small" type="button" onclick={addBin}>Add a bin</button>
      </fieldset>
      <fieldset>
        <legend>Travel</legend>
        <div class="inline-fields">
          <div class="field"><label for="hFrom">Station code</label><input id="hFrom" class="mono" maxlength="3" bind:value={f.trainFrom} placeholder="SPT"></div>
          <div class="field"><label for="hTo">Going to (optional)</label><input id="hTo" class="mono" maxlength="3" bind:value={f.trainTo} placeholder="MAN"></div>
          <div class="field"><label for="hWalk">Walk (minutes)</label><input id="hWalk" type="number" min="0" max="60" bind:value={f.trainWalk}></div>
        </div>
        <p class="note">Three-letter station codes: Stockport is SPT, Manchester Piccadilly MAN.</p>
        <div class="inline-fields">
          <div class="field"><label for="hTram">Tram stop</label><input id="hTram" bind:value={f.tramStop} placeholder="Needs the home server"></div>
          <div class="field"><label for="hTramWalk">Walk (minutes)</label><input id="hTramWalk" type="number" min="0" max="60" bind:value={f.tramWalk}></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Calendar</legend>
        <div class="field"><label for="hIcal">Secret iCal address</label><input id="hIcal" type="url" inputmode="url" spellcheck="false" bind:value={f.ical} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">
          <span class="help">In Google Calendar: Settings → your calendar → Secret address in iCal format. It stays on this device. Google's address needs the home server.</span></div>
      </fieldset>
      <div class="actions"><button class="btn primary" type="submit">Save</button>{#if saved}<span class="note" role="status">{saved}</span>{/if}</div>
      <p class="note">These start from <code>household.json</code>, which every screen shares. Changes here stay on this device.</p>
    </form>
  {:else}<div class="skel" style="height:160px"></div>{/if}
</section>

<style>
  fieldset{border:0;margin:0;padding:0;display:grid;gap:var(--s3)}
  legend{font:600 14px/1.3 var(--f-body);color:var(--ink);margin-bottom:var(--s2);padding:0}
  .bin{display:grid;gap:var(--s2);padding:var(--s2) var(--s3);border:1px solid var(--line);border-radius:var(--radius-sm)}
  .bin[open]{padding-bottom:var(--s3)}
  .bin > :global(* + *){margin-top:var(--s2)}
  .bin summary{display:flex;align-items:center;gap:var(--s2);min-height:36px;cursor:pointer;list-style:none}
  .bin summary::-webkit-details-marker{display:none}
  .bin summary i{width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.25);flex:none}
  .bin summary .muted{margin-left:auto;font-size:13px}
  .bin .btn{justify-self:start}
  .mono{font-family:var(--f-mono);text-transform:uppercase}
  code{font-family:var(--f-mono);font-size:.9em}
</style>
