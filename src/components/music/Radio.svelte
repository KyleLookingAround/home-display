<script>
  /*
   * Weather radio: something for the weather and the time of the week (weatherMood in src/lib/discover.js), as
   * playlists Spotify finds for it. Tap one to play it.
   */
  import { onMount, untrack } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { watchHouse } from '../../state/house.js';
  import { music, play, haptic } from '../../state/music.svelte.js';
  import { disc, loadRadio } from '../../state/discover.svelte.js';
  import { artUrl } from '../../lib/music.js';
  import Icon from './Icon.svelte';
  onMount(() => { watchHouse({ bins: false, trains: false, events: false, rain: false, floods: false }); });
  $effect(() => { const w = app.weather, a = music.acc; untrack(() => { if (a) loadRadio(w); }); });
  const playing = $derived(music.player && music.player.context ? music.player.context.uri : '');
  const ICON = { storm: 'M13 2 6 14h5l-2 8 9-12h-5z', snow: 'M12 2v20M4 7l16 10M20 7 4 17', rain: 'M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6zM9 18l-1 3M13 18l-1 3M17 18l-1 3' };
</script>

{#if disc.mood}
  <section class="card radio mood-{disc.mood.id}">
    <div class="card-head"><h2 class="label">Weather radio</h2><span class="small mono">{disc.mood.line}</span></div>
    <p class="title">{disc.mood.title}</p>
    {#if disc.radio && disc.radio.length}
      <div class="strip">
        {#each disc.radio as p (p.id)}
          <button class="pl" class:on={playing === p.uri} type="button" onclick={() => { haptic(); play({ context: p.uri }); }} aria-label="Play {p.name}">
            {#if p.images && p.images.length}<img src={artUrl(p.images, 300)} alt="" loading="lazy">{:else}<span class="ph"><Icon name="music" size={28} /></span>{/if}
            <span class="go" aria-hidden="true"><Icon name={playing === p.uri ? 'pause' : 'play'} size={18} /></span>
            <b>{p.name}</b>
          </button>
        {/each}
      </div>
    {:else if disc.radio}<p class="note">Spotify didn't find playlists for this one. Try again later.</p>
    {:else}<div class="skel" style="height:150px"></div>{/if}
  </section>
{/if}

<style>
  .radio{overflow:hidden}
  .radio::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,var(--gas) 18%,transparent),transparent 60%)}
  .mood-rain::before,.mood-rain-night::before,.mood-storm::before{background:radial-gradient(120% 90% at 100% 0%,rgba(79,140,255,.28),transparent 60%)}
  .mood-sun::before,.mood-golden::before,.mood-morning::before{background:radial-gradient(120% 90% at 100% 0%,rgba(255,181,71,.25),transparent 60%)}
  .mood-weekend::before,.mood-late::before{background:radial-gradient(120% 90% at 100% 0%,rgba(184,146,255,.28),transparent 60%)}
  .small{font-size:12px;color:var(--muted)}
  .title{margin:0;font:700 22px/1.2 var(--f-display);letter-spacing:.04em;text-transform:uppercase;position:relative}
  .strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(128px,32%);gap:var(--s3);overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;position:relative;scrollbar-width:none}
  .strip::-webkit-scrollbar{display:none}
  .pl{appearance:none;border:0;background:transparent;color:inherit;display:grid;gap:6px;text-align:left;padding:0;cursor:pointer;position:relative;scroll-snap-align:start;font:inherit;min-width:0}
  .pl img,.ph{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--card-2);display:grid;place-items:center;color:var(--muted)}
  .pl.on img{border-color:var(--gas);box-shadow:0 0 18px -6px var(--gas)}
  .go{position:absolute;right:8px;top:calc(100% - 82px);width:36px;height:36px;border-radius:50%;background:var(--gas);color:#04101a;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.5)}
  .pl b{font-weight:600;font-size:13.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
</style>
