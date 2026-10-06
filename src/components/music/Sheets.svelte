<script>
  /*
   * Sheets over the player. "More" (the ⋯ at the top): vinyl mode, the song's story, liner notes, sharing, and going to
   * the album or the artist. "Share": a code for the song that a friend's phone camera opens in Spotify, the link to
   * copy, and the phone's own share menu where it has one.
   */
  import { music, setView, setVinyl, closePlayer, say } from '../../state/music.svelte.js';
  import { qrSvg } from '../../lib/qr.js';
  import { store } from '../../lib/browser.js';
  import { cleanCode, sendRemote } from '../../lib/remote.js';
  import Icon from './Icon.svelte';
  const t = $derived(music.track);
  const link = $derived(t ? (t.episode ? 'https://open.spotify.com/episode/' : 'https://open.spotify.com/track/') + t.id : '');
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  async function share(){ try { await navigator.share({ title: t.name, text: `${t.name} by ${t.artist}`, url: link }); } catch (e){} }
  async function copy(){ try { await navigator.clipboard.writeText(link); say('Link copied'); } catch (e){ say('Couldn\'t copy: ' + link); } }
  const close = () => { music.over = ''; };
  // The sleep timer runs on the paired TV, which is always on (display/tvmusic.js), so it works with this phone locked.
  const tvCode = $derived(music.over ? cleanCode(store.get('remoteTV')) : null);
  const SLEEP = [[15, 'In 15 minutes'], [30, 'In 30 minutes'], [45, 'In 45 minutes'], [60, 'In an hour'], ['song', 'At the end of this song'], [0, 'Turn it off']];
  async function sleep(v){
    const ok = await sendRemote(tvCode, { from: 'phone', cmd: 'sleep', mins: v === 'song' ? 0 : v, song: v === 'song' });
    say(!ok ? 'The relay didn\'t take that. Try again.' : v === 0 ? 'Sleep timer off' : v === 'song' ? 'Stopping after this song' : `Fading out in ${v} minutes`);
    if (ok) close();
  }
</script>

{#if music.over && t}
  <div class="dim" onclick={close} aria-hidden="true"></div>
  {#if music.over === 'more'}
    <div class="sheet-panel" role="dialog" aria-label="More">
      <div class="shead"><span class="label">{t.name}</span><button class="ib" type="button" aria-label="Close" onclick={close}><Icon name="down" /></button></div>
      <button type="button" class="opt" role="switch" aria-checked={music.vinyl} onclick={() => setVinyl(!music.vinyl)}>
        <Icon name="disc" /><span>Vinyl mode<small>The cover as a record on a turntable</small></span><i class="sw" class:on={music.vinyl}></i></button>
      {#if !t.episode}<button type="button" class="opt" onclick={() => setView('about')}><Icon name="info" /><span>About this song<small>The story, the credits, the artist</small></span></button>
      <button type="button" class="opt" onclick={() => setView('notes')}><Icon name="book" /><span>Liner notes<small>The sleeve and booklet</small></span></button>{/if}
      <button type="button" class="opt" onclick={() => { music.over = 'sleep'; }}><Icon name="moon" /><span>Sleep timer<small>{tvCode ? 'The TV fades it out' : 'Needs your TV paired, on Screen'}</small></span></button>
      <button type="button" class="opt" onclick={() => { music.over = 'share'; }}><Icon name="share" /><span>Share this song<small>A code to scan, or the link</small></span></button>
      {#if t.album.id && !t.episode}<a class="opt" href="./music.html#album/{t.album.id}" onclick={() => closePlayer()}><Icon name="album" /><span>Go to the album<small>{t.album.name}</small></span></a>{/if}
      {#if t.artists[0] && t.artists[0].id && !t.episode}<a class="opt" href="./music.html#artist/{t.artists[0].id}" onclick={() => closePlayer()}><Icon name="person" /><span>Go to the artist<small>{t.artists[0].name}</small></span></a>{/if}
    </div>
  {:else if music.over === 'sleep'}
    <div class="sheet-panel" role="dialog" aria-label="Sleep timer">
      <div class="shead"><span class="label">Sleep timer</span><button class="ib" type="button" aria-label="Close" onclick={close}><Icon name="down" /></button></div>
      {#if tvCode}
        {#each SLEEP as [v, l]}<button type="button" class="opt" onclick={() => sleep(v)}><Icon name={v === 0 ? 'other' : 'moon'} /><span>{l}{#if v !== 0}<small>{v === 'song' ? 'Then it pauses' : 'Fading out over the last minute'}</small>{/if}</span></button>{/each}
        <p class="note foot">The TV keeps the time, so it works with this phone locked. It needs Spotify on the TV too.</p>
      {:else}
        <p class="note foot">The sleep timer runs on the TV, which is always on. Pair your TV first, then sign it in to Spotify: <a href="./screen.html#spotify" onclick={() => closePlayer()}>Screen</a>.</p>
      {/if}
    </div>
  {:else if music.over === 'share'}
    <div class="sheet-panel share" role="dialog" aria-label="Share this song">
      <div class="shead"><span class="label">Share this song</span><button class="ib" type="button" aria-label="Close" onclick={close}><Icon name="down" /></button></div>
      <div class="qr">{@html qrSvg(link, { label: `Code for ${t.name} on Spotify` })}</div>
      <p class="what"><b>{t.name}</b><span>{t.artist}</span></p>
      <p class="note">Point a phone's camera at the code to open it in Spotify.</p>
      <div class="acts">
        {#if canShare}<button type="button" class="btn primary" onclick={share}><Icon name="share" size={18} />Share…</button>{/if}
        <button type="button" class="btn" onclick={copy}><Icon name="link" size={18} />Copy link</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .dim{position:fixed;left:0;top:0;right:0;bottom:0;z-index:44;background:rgba(2,3,10,.55)}
  .sheet-panel{position:fixed;z-index:45;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);max-height:80vh;overflow-y:auto;background:#0a0d20;border:1px solid var(--line-hot);border-radius:var(--radius);
    padding:10px 10px 14px;display:grid;gap:2px;box-shadow:0 -16px 50px rgba(0,0,0,.6);animation:rise .25s cubic-bezier(.2,.85,.25,1)}
  @media (min-width:900px){ .sheet-panel{left:auto;right:20px;width:440px} }
  @keyframes rise{from{transform:translateY(30px);opacity:0}}
  @media (prefers-reduced-motion:reduce){ .sheet-panel{animation:none} }
  .shead{display:flex;justify-content:space-between;align-items:center;padding:0 4px 4px 10px;gap:10px}
  .shead .label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ib{appearance:none;border:0;background:transparent;color:var(--ink);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex:none}
  .opt{appearance:none;border:0;background:transparent;color:var(--ink);display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:14px;align-items:center;text-align:left;padding:10px;border-radius:var(--radius-sm);cursor:pointer;
    min-height:58px;font:600 15px var(--f-body);text-decoration:none}
  .opt:hover{background:var(--sel)}
  .opt > :global(.ic){color:var(--gas)}
  .opt span{display:grid;gap:1px;min-width:0}
  .opt small{font:400 12.5px var(--f-body);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sw{width:40px;height:24px;border-radius:12px;background:var(--line-hot);position:relative;transition:background .2s}
  .sw::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}
  .sw.on{background:var(--gas)}
  .sw.on::after{transform:translateX(16px)}
  .share{justify-items:center;text-align:center;gap:10px;padding-bottom:18px}
  .share .shead{justify-self:stretch}
  .qr{width:min(64vw,230px);aspect-ratio:1;background:#fff;border-radius:var(--radius-sm);padding:6px}
  .qr :global(svg){display:block;width:100%;height:100%}
  .foot{margin:6px 10px 0}
  .what{margin:0;display:grid;gap:2px}
  .what b{font-size:17px}
  .what span{color:var(--muted);font-size:14px}
  .acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .acts .btn{gap:8px}
</style>
