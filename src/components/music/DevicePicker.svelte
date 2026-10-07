<script>
  /*
   * "Play on": where Spotify plays. It opens over any page: from the full player's "Playing on", and by itself when
   * you pick something to play and nothing is playing anywhere and you haven't chosen yet (play in music.svelte.js).
   * The choice is remembered on this phone, so it only asks again when that device isn't awake.
   */
  import { music, loadDevices, chooseDevice, closePicker, chosenDevice, playOnThisPhone, choseThisPhone } from '../../state/music.svelte.js';
  import { tv } from '../../state/tv.svelte.js';
  import { SCREEN_PLAYER } from '../../lib/music.js';
  import Icon from './Icon.svelte';

  let timer = 0;
  $effect(() => {
    if (!music.picker) return;
    loadDevices(); timer = setInterval(loadDevices, 5000);
    return () => clearInterval(timer);
  });
  const usual = $derived(chosenDevice(music.devices));
  const playing = $derived(!!(music.player && music.player.playing));
  const noScreen = $derived(!!tv.code && !music.devices.some(d => d.name === SCREEN_PLAYER));
  // this phone, when its Spotify app isn't awake (when it is, it's in the list by its own name)
  const phoneRow = $derived(!music.devices.some(d => d.kind === 'phone'));
  const what = d => d.active ? (playing ? 'Playing here' : 'Ready here')
    : d.kind === 'screen' ? 'The wall display' : d.kind === 'tv' ? 'The TV\'s Spotify app: it takes over the screen'
    : d.kind === 'phone' ? 'Phone' : d.kind === 'speaker' ? 'Speaker' : d.kind === 'computer' ? 'Computer' : 'Spotify device';
  const key = e => { if (e.key === 'Escape' && music.picker){ e.stopPropagation(); closePicker(); } };
</script>

<svelte:window onkeydown={key} />
{#if music.picker}
  <button class="scrim" type="button" aria-label="Close" onclick={closePicker}></button>
  <div class="picker" role="dialog" aria-modal="true" aria-label="Play on">
    <div class="head">
      <div><p class="label">{music.pending ? 'Where to play?' : 'Play on'}</p>
        {#if music.pending}<p class="sub">Choose once; it plays there from now on while it's awake.</p>{/if}</div>
      <button class="ib" type="button" aria-label="Close" onclick={closePicker}><Icon name="down" /></button>
    </div>
    {#each music.devices as d (d.id)}
      <button type="button" class="d" class:on={d.active} class:warn={d.kind === 'tv'} onclick={() => d.active && !music.pending ? closePicker() : chooseDevice(d)}>
        <span class="dicon"><Icon name={d.kind === 'screen' ? 'tv' : d.kind} size={22} /></span>
        <span class="dn"><b>{d.name}</b><span>{what(d)}</span></span>
        {#if d.active}<span class="eq" aria-hidden="true" class:paused={!playing}><i></i><i></i><i></i></span>
        {:else if usual && usual.id === d.id}<span class="tick" aria-label="Chosen before"><Icon name="check" size={18} /></span>{/if}
      </button>
    {:else}<p class="note">{music.devicesAt ? 'No speakers are awake just now. Open Spotify on a speaker or the TV and it\'ll appear here.' : 'Looking for speakers…'}</p>{/each}
    {#if phoneRow}
      <button type="button" class="d" onclick={playOnThisPhone}>
        <span class="dicon"><Icon name="phone" size={22} /></span>
        <span class="dn"><b>This phone</b><span>Opens Spotify on this phone, then plays there</span></span>
        {#if choseThisPhone()}<span class="tick" aria-label="Chosen before"><Icon name="check" size={18} /></span>{/if}
      </button>
    {/if}
    {#if noScreen}<p class="note">The wall display isn't here yet. Wake it with any button on the TV remote, or sign it in again on <a href="screen.html#spotify">Screen</a>.</p>{/if}
    <p class="note">Google speakers sometimes only appear after they've been played to once from the Spotify app.</p>
  </div>
{/if}

<style>
  .scrim{position:fixed;left:0;top:0;right:0;bottom:0;z-index:44;border:0;padding:0;background:rgba(2,3,10,.62);cursor:default;animation:fade .2s}
  .picker{position:fixed;left:0;right:0;bottom:0;z-index:45;max-height:80vh;overflow-y:auto;overscroll-behavior:contain;margin:0 auto;max-width:520px;
    background:#0a0d20;border:1px solid var(--line-hot);border-bottom:0;border-radius:var(--radius) var(--radius) 0 0;
    padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 16px);display:grid;gap:2px;box-shadow:0 -16px 50px rgba(0,0,0,.6);animation:rise .25s cubic-bezier(.2,.85,.25,1)}
  @keyframes rise{from{transform:translateY(40px);opacity:0}}
  @keyframes fade{from{opacity:0}}
  @media (prefers-reduced-motion:reduce){ .picker,.scrim{animation:none} }
  .head{display:flex;justify-content:space-between;align-items:flex-start;padding:2px 0 6px 8px}
  .head .label{margin:4px 0 0}
  .head .sub{margin:4px 0 0;font-size:13px;color:var(--muted)}
  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:44px;height:44px;display:grid;place-items:center;border-radius:50%;cursor:pointer}
  .d{appearance:none;border:0;background:transparent;color:var(--ink);display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;text-align:left;padding:8px;border-radius:var(--radius-sm);cursor:pointer;min-height:58px;font:inherit}
  .d:hover,.d:focus-visible{background:var(--sel)}
  .d.on{color:var(--gas)}
  .d.warn .dn span{color:var(--warn)}
  .dicon{width:40px;height:40px;border-radius:var(--radius-sm);display:grid;place-items:center;background:var(--card-2);border:1px solid var(--line)}
  .d.on .dicon{background:rgba(79,214,255,.14)}
  .dn{display:grid;min-width:0}
  .dn b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dn span{font-size:12.5px;color:var(--muted)}
  .tick{color:var(--cheap);display:grid}
  .eq{display:flex;align-items:flex-end;gap:2px;height:16px}
  .eq i{width:3px;height:40%;background:var(--gas);border-radius:1px;animation:eq .9s ease-in-out infinite}
  .eq i:nth-child(2){animation-delay:-.4s} .eq i:nth-child(3){animation-delay:-.7s}
  .eq.paused i{animation:none;height:30%}
  @keyframes eq{50%{height:100%}}
  @media (prefers-reduced-motion:reduce){ .eq i{animation:none;height:70%} }
  .note{font-size:13px;color:var(--muted);margin:6px 8px 0}
  .note a{color:var(--gas)}
</style>
