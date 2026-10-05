<script>
  // Rounded or sharp corners, on this device.
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  let corners = $state('rounded');
  onMount(() => { corners = store.get('corners') === 'sharp' ? 'sharp' : 'rounded'; });
  function set(v){
    corners = v; store.set('corners', v);
    if (v === 'sharp') document.documentElement.dataset.corners = 'sharp'; else delete document.documentElement.dataset.corners;
  }
</script>

<section class="card" id="look">
  <h2 class="label">Look</h2>
  <div class="card-head"><span>Corners</span>
    <div class="seg" role="group" aria-label="Corners">
      <button type="button" aria-pressed={corners === 'rounded'} onclick={() => set('rounded')}>Rounded</button>
      <button type="button" aria-pressed={corners === 'sharp'} onclick={() => set('sharp')}>Sharp</button>
    </div>
  </div>
</section>
