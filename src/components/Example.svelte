<script>
  // Marks a figure worked out from example data, while no account is connected.
  import { app } from '../state/app.svelte.js';
</script>
{#if app.demo}<span class="tag warn">Example</span>{/if}
