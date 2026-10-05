<script>
  // The next Ofgem price cap change, and whether your tariff follows it.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { nextCapChange } from '../lib/analysis.js';
  import { longDate, shortDate, pence } from '../lib/format.js';
  onMount(boot);
  const c = nextCapChange();
  const follows = $derived(app.raw ? !/AGILE|SILVER|FIX/.test((app.raw.eSets[0] && app.raw.eSets[0].code) || '') : true);
  const er = $derived(app.eRateNow), gr = $derived(app.gRateNow);
</script>

<section class="panel">
  <p class="panel-eyebrow">Countdown · Ofgem price cap</p><h2>Next price change</h2>
  <div class="chips">
    <div class="chip"><span class="v">{c.days} days</span><span class="k">Until {longDate(c.next)}</span></div>
    <div class="chip"><span class="v">{c.announceDays > 0 ? c.announceDays + ' days' : 'Announced'}</span><span class="k">Ofgem usually announces around {shortDate(c.announce)}</span></div>
  </div>
  {#if app.raw}
    <p class="small">{follows
      ? `Your current rates${er != null ? ` (electricity ${pence(er)}, gas ${gr != null ? pence(gr) : '—'} per kWh)` : ''} are on a flexible tariff, which normally moves with the cap on that date.`
      : 'Your tariff doesn\'t follow the cap directly: its price is fixed or set by wholesale prices.'}</p>
  {/if}
</section>
