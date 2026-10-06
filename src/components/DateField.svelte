<script>
  /*
   * A date, written the UK way: day, month, year (05/10/2026), whatever language the phone or browser is set to.
   * Type it, or pick it from the calendar. `value` is the 'YYYY-MM-DD' the rest of the app keeps.
   */
  import { untrack } from 'svelte';
  import { ukDate, parseUkDate } from '../lib/format.js';
  let { id, value = $bindable(''), required = false, placeholder = 'dd/mm/yyyy' } = $props();
  let text = $state(value ? ukDate(value) : ''), bad = $state(false), picker;
  // when the date changes from outside (a reset, a filled form), show it
  $effect(() => { const v = value; untrack(() => { if (v && parseUkDate(text) !== v) text = ukDate(v); if (!v && parseUkDate(text)) text = ''; }); });
  function typed(ev){
    text = ev.target.value;   // what was typed, whichever handler runs first
    const v = parseUkDate(text);
    bad = !!text.trim() && !v;
    value = v || '';
  }
  function tidy(){ if (value) text = ukDate(value); }
  function pick(){ try { picker.showPicker(); } catch { picker.focus(); picker.click(); } }
</script>

<span class="date-field">
  <input {id} type="text" inputmode="numeric" autocomplete="off" {placeholder} {required} aria-invalid={bad} aria-describedby={bad ? id + '-bad' : undefined}
         value={text} oninput={typed} onblur={tidy}>
  <button class="cal" type="button" aria-label="Pick from a calendar" tabindex="-1" onclick={pick}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
  </button>
  <input class="native" type="date" tabindex="-1" aria-hidden="true" bind:this={picker} value={value} onchange={ev => { value = ev.target.value; text = ukDate(value); bad = false; }}>
</span>
{#if bad}<span class="help bad" id="{id}-bad">Day, month, year: like 05/10/2026.</span>{/if}

<style>
  .date-field{position:relative;display:block}
  .date-field input[type="text"]{padding-right:40px;font-variant-numeric:tabular-nums}
  .date-field input[aria-invalid="true"]{border-color:var(--bad)}
  .cal{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:grid;place-items:center;border:0;background:none;color:var(--muted);cursor:pointer}
  .cal svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .native{position:absolute;right:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0}
</style>
