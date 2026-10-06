<script>
  /*
   * The household's settings: bins, the station and walk, the tram stop and the calendar. They start from
   * household.json, which every screen shares; what you change here stays on this device, as on a screen.
   */
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { houseSettings, saveHouse } from '../../state/house.js';
  import { BIN_COLOURS } from '../../lib/household.js';
  import DateField from '../DateField.svelte';
  let f = $state(null), saved = $state('');
  const KEYS = ['bins', 'trainFrom', 'trainTo', 'trainWalk', 'workDays', 'workWalk', 'homeFrom', 'tramStop', 'tramWalk', 'ical', 'wifi', 'dates'];
  const WEEK = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
  const HOME_TIMES = Array.from({ length: 21 }, (_, i) => String(10 + Math.floor(i / 2)).padStart(2, '0') + (i % 2 ? ':30' : ':00'));
  const toggleDay = d => { f.workDays = f.workDays.includes(d) ? f.workDays.filter(x => x !== d) : [...f.workDays, d].sort(); };
  const fill = s => {
    const o = {};
    KEYS.forEach(k => { o[k] = k === 'bins' ? s.bins.map(b => ({ name: b.name, what: b.what || '', colour: b.colour || 'grey', date: b.date, every: +b.every || 1 })) : s[k]; });
    o.wifi = s.wifi ? { ...s.wifi } : { ssid: '', password: '', security: 'WPA', hidden: false };
    o.dates = (s.dates || []).map(d => ({ ...d }));
    o.workDays = [...(s.workDays || [])];
    return o;
  };
  onMount(async () => { f = fill(await houseSettings()); });
  async function save(ev){
    ev.preventDefault();
    const form = $state.snapshot(f);
    form.trainFrom = String(form.trainFrom || '').trim().toUpperCase(); form.trainTo = String(form.trainTo || '').trim().toUpperCase();
    form.trainWalk = +form.trainWalk || 0; form.workWalk = Math.max(0, +form.workWalk || 0); form.tramWalk = +form.tramWalk || 0; form.ical = String(form.ical || '').trim();
    form.bins = form.bins.filter(b => b.name && b.date).map(b => ({ ...b, every: Math.max(1, Math.round(+b.every || 1)) }));
    form.wifi = form.wifi && String(form.wifi.ssid || '').trim() ? { ssid: form.wifi.ssid.trim(), password: form.wifi.password || '', security: form.wifi.security || 'WPA', hidden: !!form.wifi.hidden } : null;
    form.dates = form.dates.filter(d => String(d.name || '').trim() && d.date).map(d => ({ name: d.name.trim(), date: d.date, kind: d.kind || 'birthday' }));
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
              <div class="field"><label for="bd{i}">A collection date</label><DateField id="bd{i}" bind:value={b.date} /></div>
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
        <div class="field"><span class="lbl" id="hDaysL">Days you go in to work</span>
          <div class="days" role="group" aria-labelledby="hDaysL">
            {#each WEEK as [d, n]}<label class="day"><input type="checkbox" checked={f.workDays.includes(d)} onchange={() => toggleDay(d)}><span>{n}</span></label>{/each}
          </div>
        </div>
        <div class="inline-fields">
          <div class="field"><label for="hWorkWalk">Walk to work from there (minutes)</label><input id="hWorkWalk" type="number" min="0" max="60" bind:value={f.workWalk}></div>
          <div class="field"><label for="hHome">Head home from</label><select id="hHome" bind:value={f.homeFrom}>{#each HOME_TIMES as t}<option>{t}</option>{/each}</select></div>
        </div>
        <p class="note">On those days the trains go to work until then, with when you'll be in, and then turn round for the way home. On other days, and bank holidays, you see every train from your station.</p>
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
      <fieldset>
        <legend>Guest Wi-Fi</legend>
        <div class="inline-fields">
          <div class="field"><label for="wSsid">Network name</label><input id="wSsid" autocomplete="off" bind:value={f.wifi.ssid} placeholder="Your guest network"></div>
          <div class="field"><label for="wPass">Password</label><input id="wPass" autocomplete="off" spellcheck="false" bind:value={f.wifi.password}></div>
          <div class="field"><label for="wSec">Security</label><select id="wSec" bind:value={f.wifi.security}><option value="WPA">WPA2 or WPA3</option><option value="WEP">WEP</option><option value="nopass">None</option></select></div>
        </div>
        <label class="check" for="wHidden"><input id="wHidden" type="checkbox" bind:checked={f.wifi.hidden}> The network is hidden</label>
      </fieldset>
      <fieldset>
        <legend>Birthdays and dates</legend>
        {#each f.dates as d, i}
          <div class="inline-fields date-row">
            <div class="field"><label for="dn{i}">Who or what</label><input id="dn{i}" bind:value={d.name} placeholder="Sam"></div>
            <div class="field"><label for="dd{i}">Date</label><DateField id="dd{i}" bind:value={d.date} /></div>
            <div class="field"><label for="dk{i}">Kind</label><select id="dk{i}" bind:value={d.kind}><option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="once">Just once</option></select></div>
            <button class="btn small" type="button" aria-label="Remove {d.name || 'this date'}" onclick={() => f.dates.splice(i, 1)}>Remove</button>
          </div>
        {/each}
        <button class="btn small add" type="button" onclick={() => f.dates.push({ name: '', date: '', kind: 'birthday' })}>Add a date</button>
        <p class="note">With the year of birth, a birthday says how old. Christmas and the next bank holiday count down by themselves.</p>
      </fieldset>
      <p class="note">Guest Wi-Fi, dates and the calendar stay on this phone. To put them on the TV, use Send to the TV on <a href="./screen.html">Screen</a>.</p>
      <div class="actions"><button class="btn primary" type="submit">Save</button>{#if saved}<span class="note" role="status">{saved}</span>{/if}</div>
      <p class="note">These start from <code>household.json</code>, which every screen shares. Changes here stay on this device.</p>
    </form>
  {:else}<div class="skel" style="height:160px"></div>{/if}
</section>

<style>
  fieldset{border:0;margin:0;padding:0;display:grid;gap:var(--s3)}
  legend{font:600 14px/1.3 var(--f-body);color:var(--ink);margin-bottom:var(--s2);padding:0}
  .days{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
  .day{position:relative;display:inline-flex}
  .day input{position:absolute;opacity:0;width:1px;height:1px}
  .day span{min-width:48px;text-align:center;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius-sm);font:500 14px/1 var(--f-body);color:var(--muted);cursor:pointer}
  .day input:checked + span{background:rgba(255,179,71,.14);border-color:var(--elec);color:var(--ink)}
  .day input:focus-visible + span{outline:2px solid var(--gas);outline-offset:2px}
  .bin{display:grid;gap:var(--s2);padding:var(--s2) var(--s3);border:1px solid var(--line);border-radius:var(--radius-sm)}
  .bin[open]{padding-bottom:var(--s3)}
  .bin > :global(* + *){margin-top:var(--s2)}
  .bin summary{display:flex;align-items:center;gap:var(--s2);min-height:36px;cursor:pointer;list-style:none}
  .bin summary::-webkit-details-marker{display:none}
  .bin summary i{width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.25);flex:none}
  .bin summary .muted{margin-left:auto;font-size:13px}
  .bin .btn{justify-self:start}
  .date-row{align-items:end;grid-template-columns:minmax(0,1fr) minmax(150px,1.2fr) minmax(0,1fr)}
  .date-row .btn{grid-column:1/-1;justify-self:start}
  @media (max-width:420px){ .date-row{grid-template-columns:minmax(0,1fr) minmax(150px,1.3fr)} }
  .add{justify-self:start}
  .mono{font-family:var(--f-mono);text-transform:uppercase}
  code{font-family:var(--f-mono);font-size:.9em}
</style>
