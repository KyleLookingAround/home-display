<script>
  // Octopoints and Saving Sessions.
  import { onMount } from 'svelte';
  import { app } from '../../state/app.svelte.js';
  import { boot } from '../../state/session.js';
  import { fmtDate, hhmm, sum } from '../../lib/format.js';
  onMount(boot);
  const r = $derived(app.rewards);
  const events = $derived(r && r.sessions ? (r.sessions.events || []).filter(e => +new Date(e.endAt) > app.now).sort((a, b) => new Date(a.startAt) - new Date(b.startAt)) : []);
  const joined = $derived(r && r.sessions && r.sessions.account ? r.sessions.account.joinedEvents || [] : []);
  const ids = $derived(new Set(joined.map(j => String(j.eventId))));
  const earned = $derived(sum(joined.map(j => +j.rewardGivenInOctoPoints || 0)));
</script>

<section class="card">
  <h2 class="label">Rewards</h2>
  {#if app.demo}<p class="note">Connect your account to see Saving Sessions and your Octopoints.</p>
  {:else if !r}<div class="skel" style="height:40px"></div>
  {:else if r.sessions == null && r.points == null}<p class="note">Couldn't read Saving Sessions or Octoplus. If you haven't joined Octoplus there's nothing to show.</p>
  {:else}
    <div class="stats two">
      {#if r.points != null}<div class="stat"><span class="v">{r.points.toLocaleString('en-GB')}</span><span class="k">Octopoints</span></div>{/if}
      {#if r.sessions}<div class="stat"><span class="v">{joined.length}</span><span class="k">Saving Sessions joined{earned ? `, ${earned.toLocaleString('en-GB')} points earned` : ''}</span></div>{/if}
    </div>
    {#if events.length}
      <ul class="rows">{#each events as e}<li><span class="main-t"><span>{fmtDate(new Date(e.startAt))} {hhmm(e.startAt)}–{hhmm(e.endAt)}{#if ids.has(String(e.id))}<span class="tag good">Joined</span>{/if}</span><span class="sub">{e.rewardPerKwhInOctoPoints ? e.rewardPerKwhInOctoPoints + ' points per kWh saved' : ''}</span></span></li>{/each}</ul>
    {:else if r.sessions}<p class="note">No Saving Sessions announced right now.</p>{/if}
  {/if}
</section>
