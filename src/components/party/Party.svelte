<script>
  /*
   * A party, from a guest's phone: they scanned the code on the TV, which opened this page with the party's code
   * after the #. They give a name, then search for songs (the TV searches Spotify for them, so they need no app or
   * sign-in) or paste a link from Spotify's Share menu, add up to three at a time, and vote for what plays sooner.
   * Everything goes through the relay on the party's own topic, which can only add songs and vote
   * (src/lib/queue.js); it can't change anything else on the TV.
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { cleanCode, sendTopic, listenTopic } from '../../lib/remote.js';
  import { partyTopic, readParty, guestView, trackUri, coverUrl, shortId, GUEST_MAX } from '../../lib/queue.js';
  import { fmtDur } from '../../lib/music.js';
  import Icon from '../music/Icon.svelte';

  let code = $state(null), me = $state.raw(null), typed = $state('');
  let party = $state.raw(null), heard = $state(0), quiet = $state(false);
  let q = $state(''), results = $state.raw(null), searching = $state(false), rid = '';
  let added = $state.raw([]), pending = $state(''), toast = $state(''), toastOk = $state(true), votes = $state.raw({});
  let toastTimer = 0, sTimer = 0;

  const topic = () => partyTopic(code);
  const send = (cmd, extra) => sendTopic(topic(), Object.assign({ from: 'guest', cmd, who: me }, extra || {}));
  const say = (text, ok = true) => { toast = text; toastOk = ok; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast = ''; }, 4200); };

  onMount(() => {
    code = cleanCode(location.hash.slice(1));
    const g = store.getJ('guest', null);
    if (g && /^[a-z0-9]{6,16}$/.test(g.id) && g.name) me = g;
    if (!code) return;
    const stop = listenTopic(topic(), readParty, r => {
      if (r.from !== 'screen') return;
      if (r.party){ party = r.party; heard = Date.now(); quiet = false; votes = {}; }
      else if (r.results && me && r.to === me.id && r.rid === rid){ results = r.results; searching = false; }
      else if (r.reply && me && r.to === me.id){ say(r.reply, r.ok); pending = ''; }
    });
    setTimeout(() => { if (me) send('hello'); else sendTopic(topic(), { from: 'guest', cmd: 'hello', who: { id: 'look' + shortId(null, 6), name: 'A guest' } }); }, 700);
    const t = setTimeout(() => { if (!heard) quiet = true; }, 7000);
    return () => { stop(); clearTimeout(t); };
  });

  function join(e){
    e.preventDefault();
    const name = typed.trim().slice(0, 24);
    if (!name) return;
    me = { id: (me && me.id) || shortId(null, 10), name };
    store.setJ('guest', me);
    send('hello');
  }
  /* ---------- finding a song: the TV searches Spotify; a pasted link is used as it is ---------- */
  const pasted = $derived(trackUri(q));
  function onSearch(){
    clearTimeout(sTimer);
    const s = q.trim();
    if (!s || pasted){ results = null; searching = false; return; }
    searching = true;
    sTimer = setTimeout(() => { rid = shortId(null, 8); send('search', { q: s, rid }); setTimeout(() => { if (searching) searching = false; }, 8000); }, 450);
  }
  function add(uri){
    if (pending) return;
    pending = uri; added = added.concat([uri]);
    send('add', { uri }).then(ok => { if (!ok){ pending = ''; say('That didn\'t reach the TV. Try again.', false); } });
    setTimeout(() => { if (pending === uri) pending = ''; }, 8000);
  }
  function vote(x){
    votes = Object.assign({}, votes, { [x.id]: !(x.id in votes ? votes[x.id] : x.voted) });
    send('vote', { id: x.id });
  }
  const list = $derived(party ? guestView(party.queue, me && me.id).map(x => x.id in votes ? Object.assign({}, x, { voted: votes[x.id], votes: x.votes + (votes[x.id] === x.voted ? 0 : votes[x.id] ? 1 : -1) }) : x) : []);
  const mine = $derived(list.filter(x => x.mine && !x.fed).length);
  const now = $derived(party && party.now);
</script>

<div class="party-page">
  {#if now && now.img}<div class="sky" aria-hidden="true"><img src={coverUrl(now.img)} alt=""></div>{/if}
  <header class="top"><span class="brand">Harold Street</span><span class="pill"><Icon name="party" size={14} />Party</span></header>

  {#if !code}
    <section class="answer"><span class="label">Party</span><span class="big">Scan the code on the TV</span><span class="line muted">This page opens from the code the TV shows when there's a party on.</span></section>
  {:else if party && !party.open}
    <section class="answer"><span class="label">Party</span><span class="big">The party's over</span><span class="line muted">Thanks for the music.</span></section>
  {:else}
    <section class="answer now">
      <span class="label">{now ? (now.playing ? 'Playing now' : 'Paused') : 'Party'}</span>
      {#if now}
        <span class="np">{#if now.img}<img src={coverUrl(now.img)} alt="" width="72" height="72">{/if}<span><span class="big">{now.name}</span><span class="line">{now.artist}</span></span></span>
      {:else if party}<span class="big">The music's about to start</span><span class="line muted">Add a song and it'll be first.</span>
      {:else}<span class="big">Joining the party…</span><span class="line muted">{quiet ? 'The TV isn\'t answering yet. Is the party still on? Try scanning the code again.' : 'Asking the TV what\'s playing.'}</span>{/if}
    </section>

    {#if !me}
      <form class="card" onsubmit={join}>
        <h2 class="label">What's your name?</h2>
        <p class="note">It shows on the TV next to the songs you add.</p>
        <div class="row"><input class="in" bind:value={typed} maxlength="24" autocomplete="given-name" placeholder="Your name" aria-label="Your name"><button class="btn primary" type="submit" disabled={!typed.trim()}>Join</button></div>
      </form>
    {:else}
      <section class="card">
        <div class="chead"><h2 class="label">Add a song</h2><span class="small mono">{mine} of {GUEST_MAX} waiting</span></div>
        <label class="sbox"><Icon name="search" size={20} /><span class="sr">Search for a song</span>
          <input type="search" placeholder="Search, or paste a Spotify link" bind:value={q} oninput={onSearch} autocomplete="off" enterkeyhint="search">
          {#if q}<button class="clear" type="button" aria-label="Clear" onclick={() => { q = ''; results = null; searching = false; }}>×</button>{/if}</label>
        {#if pasted}
          <button class="btn primary" type="button" disabled={mine >= GUEST_MAX || added.includes(pasted)} onclick={() => { add(pasted); q = ''; }}><Icon name="plus" size={18} />Add the song from that link</button>
        {:else if results && results.length}
          <ul class="res">{#each results as r (r.uri)}
            <li>{#if r.img}<img src={coverUrl(r.img)} alt="" width="44" height="44" loading="lazy">{:else}<span class="ph"></span>{/if}
              <span class="tx"><b>{r.name}</b><span>{r.artist} · {fmtDur(r.dur)}</span></span>
              <button class="add" type="button" class:done={added.includes(r.uri)} disabled={added.includes(r.uri) || mine >= GUEST_MAX} aria-label="Add {r.name}" onclick={() => add(r.uri)}>
                <Icon name={added.includes(r.uri) ? 'check' : 'plus'} size={20} /></button></li>{/each}</ul>
        {:else if results}<p class="note">Nothing found for that. Try the song and the artist.</p>
        {:else if searching}<p class="note">Searching…</p>
        {:else}<p class="note">Or in Spotify: Share, then Copy link, and paste it here.</p>{/if}
        {#if mine >= GUEST_MAX}<p class="note">You've three waiting. Once one plays, add another.</p>{/if}
      </section>
    {/if}

    {#if party}
      <section class="card">
        <div class="chead"><h2 class="label">Up next</h2>{#if me}<span class="small mono">vote to hear it sooner</span>{/if}</div>
        {#if list.length}
          <ol class="ql">{#each list as x (x.id)}
            <li class:mine={x.mine}><span class="pos mono">{x.fed ? '▶' : x.pos}</span>
              {#if x.img}<img src={x.img} alt="" width="40" height="40" loading="lazy">{:else}<span class="ph"></span>{/if}
              <span class="tx"><b>{x.name}</b><span>{x.artist}{#if x.by}<em class="by">{x.mine ? 'You' : x.by}</em>{/if}</span></span>
              {#if me && !x.fed}<button class="vote" class:on={x.voted} type="button" aria-pressed={x.voted} aria-label="Vote for {x.name}" onclick={() => vote(x)}><Icon name="heart" size={18} />{#if x.votes}<span class="mono">{x.votes}</span>{/if}</button>
              {:else if x.fed}<span class="next mono">Next</span>{/if}
            </li>{/each}</ol>
          {#if party.more}<p class="note">And {party.more} more.</p>{/if}
        {:else}<p class="note">Nothing queued yet. Be first.</p>{/if}
      </section>
    {/if}
  {/if}
  {#if toast}<p class="toast" class:bad={!toastOk} role="status">{toast}</p>{/if}
</div>

<style>
  .party-page{max-width:560px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 16px) 16px calc(env(safe-area-inset-bottom,0px) + 90px);display:grid;gap:16px;position:relative}
  .sky{position:fixed;left:0;top:0;right:0;height:75vh;z-index:-1;overflow:hidden;pointer-events:none;opacity:.45;
    -webkit-mask-image:linear-gradient(#000 30%,transparent);mask-image:linear-gradient(#000 30%,transparent)}
  .sky img{width:120%;height:120%;margin:-10%;object-fit:cover;filter:blur(50px) saturate(1.4)}
  .top{display:flex;justify-content:space-between;align-items:center}
  .brand{font:700 13px/1 var(--f-display);letter-spacing:.14em;text-transform:uppercase}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid color-mix(in srgb,var(--neg) 60%,transparent);color:var(--neg);font:500 12px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;box-shadow:0 0 18px -6px var(--neg)}
  .np{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center}
  .np img{width:72px;height:72px;border-radius:var(--radius-sm);object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  .np > span{display:grid;gap:4px;min-width:0}
  .now .big{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:22px}
  .chead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .chead h2{margin:0}
  .small{font-size:12px;color:var(--muted)}
  .row{display:flex;gap:8px}
  .in{flex:1;min-width:0;min-height:44px;border-radius:var(--radius-sm);border:1px solid var(--line-hot);background:var(--card-2);color:var(--ink);font:16px var(--f-body);padding:0 12px}
  .sbox{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 6px 0 14px;border-radius:var(--radius-sm);border:1px solid var(--line-hot);background:var(--card-2);color:var(--muted)}
  .sbox:focus-within{border-color:var(--gas)}
  .sbox input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:16px var(--f-body);outline:none;min-height:44px}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .clear{appearance:none;border:0;background:transparent;color:var(--muted);font-size:22px;width:40px;height:40px;cursor:pointer}
  .res,.ql{list-style:none;margin:0;padding:0;display:grid;gap:2px}
  .res li,.ql li{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}
  .res li:first-child,.ql li:first-child{border-top:0}
  .ql li{grid-template-columns:22px 40px minmax(0,1fr) auto}
  .res img,.ql img,.ph{width:44px;height:44px;border-radius:var(--radius-sm);object-fit:cover;background:var(--card-2);display:block}
  .ql img,.ql .ph{width:40px;height:40px}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tx span{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .by{font:500 10.5px/1 var(--f-mono);font-style:normal;letter-spacing:.08em;text-transform:uppercase;color:var(--neg);margin-left:8px}
  .mine .by{color:var(--gas)}
  .pos{font-size:12px;color:var(--gas);text-align:center}
  .add,.vote{appearance:none;border:1px solid var(--line-hot);background:transparent;color:var(--ink);min-width:44px;height:44px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;padding:0 10px}
  .add:hover:not(:disabled){border-color:var(--gas);color:var(--gas)}
  .add.done{border-color:var(--gas);color:var(--gas)}
  .add:disabled{opacity:.6;cursor:default}
  .vote{border-color:transparent;color:var(--muted);font-size:12px}
  .vote.on{color:var(--cal)}
  .vote.on :global(svg){fill:currentColor}
  .next{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gas)}
  .toast{position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);margin:0 auto;max-width:520px;padding:12px 16px;border-radius:var(--radius);background:var(--card);border:1px solid var(--gas);box-shadow:0 10px 30px rgba(0,0,0,.5);font-size:14.5px;z-index:5;
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .toast.bad{border-color:var(--warn)}
</style>
