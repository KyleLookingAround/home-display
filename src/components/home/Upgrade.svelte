<script>
  /*
   * One upgrade, the same shape as every other: what it is, a year's saving, what it costs and how long it takes to
   * pay back, worked out from sensible defaults. The full simulator opens underneath.
   */
  import { gbp0 } from '../../lib/format.js';
  let { id, title, line = '', saving = null, cost = null, example = false, waiting = false, children } = $props();
  const payback = $derived(saving == null || cost == null ? null : cost <= 0 ? (saving > 0 ? 'Straight away' : '—') : saving > 0 ? `${(cost / saving).toFixed(cost / saving < 10 ? 1 : 0)} years` : 'Never');
</script>

<section class="card upgrade" {id}>
  <h2 class="label">{title}</h2>
  {#if line}<p class="line">{line}</p>{/if}
  {#if waiting}<div class="skel" style="height:48px"></div>
  {:else}
    <div class="stats">
      <div class="stat"><span class="v {saving > 0 ? 'good' : ''}">{saving == null ? '—' : gbp0(saving)}</span><span class="k">Saved a year{example ? ' (example)' : ''}</span></div>
      <div class="stat"><span class="v">{cost == null ? '—' : cost <= 0 ? 'Free' : gbp0(cost)}</span><span class="k">To do, roughly</span></div>
      <div class="stat"><span class="v">{payback || '—'}</span><span class="k">To pay back</span></div>
    </div>
  {/if}
  <details class="fold"><summary>Work it out</summary><div class="form">{@render children()}</div></details>
</section>

<style>
  .line{font-size:16px}
  .upgrade :global(.stat .v){font-size:18px}
</style>
