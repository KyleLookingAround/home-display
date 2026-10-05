<script>
  // The answer to "is now a good time to use power?", in one line, on Agile's half-hourly price.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { errorText } from '../../lib/net.js';
  import { priceVerdict } from '../../lib/analysis.js';
  onMount(boot);
  const v = $derived(priceVerdict(app.agileToday && app.agileToday.unit, app.now));
</script>

<section class="answer" aria-live="polite">
  {#if v}
    <p class="big glow-{v.tone}">{v.big}</p>
    <p class="line">{v.line}</p>
    <p class="note">Agile, region {app.region}</p>
  {:else if app.agileErr}
    <p class="big">No prices</p>
    <p class="line muted">{errorText(app.agileErr).join(' ')}</p>
  {:else}
    <div class="skel" style="height:34px;width:60%"></div>
    <div class="skel" style="height:20px;width:80%"></div>
  {/if}
</section>
