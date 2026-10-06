<script>
  /*
   * The full screen button in the header, on every page. Where the browser can (Android, laptops), it hides the
   * browser's bars for the whole site, every tab included (src/state/fullscreen.js). On an iPhone, which can't, it
   * explains Add to Home Screen instead; opened from there, the app has no bars and the button isn't shown.
   */
  import { onMount } from 'svelte';
  import { canFull, isFull, isApp, isIos, toggleFull, keepFull, inShell } from '../state/fullscreen.js';
  let full = $state(false), shown = $state(false), help = $state(false), able = $state(false);
  onMount(() => {
    able = canFull();
    shown = !isApp() && (able || isIos() || inShell());
    full = isFull();
    keepFull(f => { full = f; });
  });
  async function press(){
    if (!able){ help = !help; return; }
    full = await toggleFull();
  }
</script>

{#if shown}
  <button class="icon-btn fs" type="button" aria-label={full ? 'Leave full screen' : 'Full screen'} aria-pressed={full} aria-expanded={able ? undefined : help} onclick={press}>
    {#if full}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>
    {:else}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>{/if}
  </button>
  {#if help}
    <div class="fs-dim" onclick={() => { help = false; }} aria-hidden="true"></div>
    <div class="fs-help card" role="dialog" aria-label="Full screen on iPhone">
      <span class="label">Full screen on iPhone</span>
      <p>Safari can't hide its bars for a website, but your Home Screen can. Tap <b>Share</b> <svg class="share" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>, then <b>Add to Home Screen</b>. Opened from there, the app fills the screen, and the PIN is remembered.</p>
      <button class="btn small" type="button" onclick={() => { help = false; }}>Got it</button>
    </div>
  {/if}
{/if}

<style>
  .fs-help{position:fixed;z-index:60;background:#0a0d20;left:var(--s4);right:var(--s4);top:calc(env(safe-area-inset-top,0px) + 70px);max-width:420px;margin-left:auto;box-shadow:0 18px 50px rgba(0,0,0,.6);border-color:var(--line-hot)}
  .fs-dim{position:fixed;left:0;top:0;right:0;bottom:0;z-index:59;background:rgba(2,3,10,.55)}
  .fs-help p{margin:0;font-size:15px;line-height:1.5}
  .fs-help .btn{justify-self:start}
  .share{width:16px;height:16px;vertical-align:-3px;fill:none;stroke:var(--gas);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
</style>
