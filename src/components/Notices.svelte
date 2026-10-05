<script>
  // Above every page's content: a failed fetch or a warning, and on Now, the example-data banner.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  let { example = false } = $props();
  onMount(boot);
</script>

{#if example && app.status === 'demo'}
  <div class="banner" role="note">
    <p><strong>You're looking at example data.</strong> <span class="muted">Every figure here is made up until your account is connected.</span></p>
    <a class="btn small primary" href="./settings.html#account">Connect your account</a>
  </div>
{/if}
{#if app.notice}
  <div class="banner {app.notice.kind === 'err' ? 'err' : ''}" role="status">
    <p><strong>{app.notice.title}</strong>{#if app.notice.body} <span class="muted">{app.notice.body}</span>{/if}</p>
  </div>
{/if}
