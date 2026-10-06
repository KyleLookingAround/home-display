<script>
  /*
   * Who's listening: everyone signed in to Spotify on this phone, as faces to tap. The one listening plays, likes and
   * sees their own music; tap someone else to switch. Only shown once there's more than one person.
   */
  import { music, switchAccount, people } from '../../state/music.svelte.js';
  let { always = false } = $props();
  const list = $derived(music.acc ? people() : []);
  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
</script>

{#if list.length > 1 || (always && list.length)}
  <div class="people" role="group" aria-label="Who's listening">
    <span class="label">Who's listening</span>
    <div class="faces">
      {#each list as p (p.id)}
        <button type="button" class="face" class:on={music.acc && music.acc.id === p.id} aria-pressed={music.acc && music.acc.id === p.id} onclick={() => switchAccount(p.id)}>
          <span class="av">{#if p.img}<img src={p.img} alt="" width="36" height="36">{:else}{initials(p.name)}{/if}</span>
          <span class="nm">{String(p.name || p.id).split(' ')[0]}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .people{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .faces{display:flex;gap:6px;flex-wrap:wrap}
  .face{appearance:none;border:1px solid var(--line);background:var(--card-2);color:var(--muted);display:inline-flex;align-items:center;gap:8px;padding:3px 12px 3px 3px;border-radius:24px;cursor:pointer;font:500 14px var(--f-body);min-height:44px}
  .face.on{border-color:var(--gas);color:var(--ink);box-shadow:0 0 16px -6px var(--gas)}
  .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:color-mix(in srgb,var(--neg) 35%,var(--card));color:var(--ink);font:600 13px var(--f-mono)}
  .on .av{background:var(--gas);color:#04101a}
  .av img{width:100%;height:100%;object-fit:cover}
</style>
