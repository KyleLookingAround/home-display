<script>
  /*
   * Gigs near home by the artists you play, from Ticketmaster (40 miles round Stockport). Needs a free Ticketmaster
   * key, kept on this phone (Settings, Music); without one, the card says so once.
   */
  import { onMount } from 'svelte';
  import { store } from '../../lib/browser.js';
  import { disc, loadGigs } from '../../state/discover.svelte.js';
  import Icon from './Icon.svelte';
  let { all = false } = $props();
  let key = $state(false);
  onMount(() => { key = !!store.get('tmKey'); loadGigs(); });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = g => { const d = new Date(g.date + 'T12:00:00'); return { d: d.getDate(), m: MON[d.getMonth()], w: DOW[d.getDay()] }; };
  const list = $derived(disc.gigs ? (all ? disc.gigs : disc.gigs.slice(0, 4)) : []);
</script>

{#if key}
  <section class="card gigs">
    <div class="card-head"><h2 class="label">Gigs near you</h2>{#if !all && disc.gigs && disc.gigs.length > 4}<a href="#gigs">All {disc.gigs.length}</a>{/if}</div>
    {#if list.length}
      <ul>
        {#each list as g (g.url + g.date)}
          {@const d = day(g)}
          <li>
            <span class="date"><b class="mono">{d.d}</b><span>{d.m}</span></span>
            <span class="tx"><b>{g.artist}</b><span>{g.venue}{g.city ? ', ' + g.city : ''} · {d.w}{g.time ? ' ' + g.time : ''}{g.status === 'cancelled' ? ' · cancelled' : g.status === 'rescheduled' ? ' · moved' : ''}</span></span>
            {#if g.url}<a class="btn small" href={g.url} target="_blank" rel="noopener">Tickets <Icon name="link" size={14} /></a>{/if}
          </li>
        {/each}
      </ul>
      <p class="note">From Ticketmaster, within 40 miles. Prices and tickets on their site.</p>
    {:else if disc.gigsErr}<p class="note">{disc.gigsErr}</p>
    {:else if disc.gigs}<p class="note">None of your artists are playing within 40 miles yet. Checked twice a day.</p>
    {:else}<div class="skel" style="height:120px"></div>{/if}
  </section>
{:else if all}
  <section class="card"><h2 class="label">Gigs near you</h2><p class="note">Add a free Ticketmaster key in <a href="./settings.html#music">Settings, Music</a> to see who's playing near Stockport.</p></section>
{/if}

<style>
  ul{list-style:none;margin:0;padding:0;display:grid}
  li{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:var(--s3);align-items:center;padding:10px 0;border-top:1px solid var(--line)}
  li:first-child{border-top:0;padding-top:0}
  .date{display:grid;justify-items:center;padding:6px 0;border-radius:var(--radius-sm);border:1px solid color-mix(in srgb,var(--neg) 50%,transparent);background:color-mix(in srgb,var(--neg) 10%,transparent)}
  .date b{font-size:18px;line-height:1.1;color:var(--ink)}
  .date span{font:500 10.5px/1.2 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--neg)}
  .tx{display:grid;min-width:0}
  .tx b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tx span{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .btn :global(.ic){display:inline-block}
</style>
