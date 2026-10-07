<script>
  /*
   * The journey as a line of stops: where you set off, get on, get off and end up, each with its time, the part
   * you've done lit, and a marker for where you are now (journeySteps in geo.js).
   */
  import { hhmm } from '../../lib/format.js';
  let { steps, at = 0 } = $props();
  const n = $derived(steps.length);
  const pos = $derived(n > 1 ? Math.max(0, Math.min(n - 1, at)) / (n - 1) : 0);
</script>

<ol class="steps" style="--n:{n};--p:{pos}" aria-label="The journey: {steps.map(s => s.label + ' ' + hhmm(s.t)).join(', ')}">
  <li class="track" aria-hidden="true"><i class="fill"></i><i class="here"></i></li>
  {#each steps as s, i}
    {' '}<li class="stop" class:done={i <= at} class:end={i === n - 1}><span class="dot"></span><span class="nm">{s.label}</span> <span class="tm">{hhmm(s.t)}</span></li>
  {/each}
</ol>

<style>
  .steps{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));margin:var(--s3) 0 0;padding:0;list-style:none}
  /* the line runs from the first stop's dot to the last's */
  .track{position:absolute;top:6px;left:calc(50% / var(--n));right:calc(50% / var(--n));height:3px;border-radius:2px;background:var(--line-hot)}
  .fill{position:absolute;left:0;top:0;bottom:0;width:calc(var(--p) * 100%);border-radius:2px;background:var(--elec);box-shadow:0 0 8px rgba(255,181,71,.6)}
  .here{position:absolute;top:50%;left:calc(var(--p) * 100%);width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;background:var(--elec);border:3px solid #04050d;box-shadow:0 0 0 3px rgba(255,181,71,.35),0 0 14px var(--elec)}
  .stop{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;padding-top:0}
  .dot{width:15px;height:15px;border-radius:50%;background:#0b0d16;border:2px solid var(--line-hot);z-index:1}
  .stop.done .dot{border-color:var(--elec);background:#1a1408}
  .stop.end .dot{border-color:var(--gas)}
  .nm{margin-top:6px;font:500 13px/1.2 var(--f-body);color:var(--ink);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tm{font:500 13px/1.3 var(--f-mono);color:var(--muted)}
  .stop.done .tm{color:var(--elec)}
</style>
