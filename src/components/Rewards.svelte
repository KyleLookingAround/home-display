<script>
  // Saving Sessions you can join or have joined, and your Octoplus points.
  import { onMount } from 'svelte';
  import { app } from '../state/app.svelte.js';
  import { boot } from '../state/session.js';
  import { fmtDate, hhmm, sum } from '../lib/format.js';
  onMount(boot);
  const r = $derived(app.rewards);
  const now = $derived(app.now);
  const events = $derived(r && r.sessions ? (r.sessions.events || []).filter(e => +new Date(e.endAt) > now).sort((a, b) => new Date(a.startAt) - new Date(b.startAt)) : []);
  const joined = $derived(r && r.sessions && r.sessions.account ? r.sessions.account.joinedEvents || [] : []);
  const joinedIds = $derived(new Set(joined.map(j => String(j.eventId))));
  const earned = $derived(sum(joined.map(j => +j.rewardGivenInOctoPoints || 0)));
</script>

<section class="panel">
  <p class="panel-eyebrow">Rewards · Octoplus</p><h2>Saving Sessions and points</h2>
  {#if app.demo}
    <p class="muted">Connect your account to see upcoming Saving Sessions, the ones you've joined and your Octoplus points.</p>
  {:else if !r}
    <p class="muted">Checking your rewards…</p>
  {:else if r.sessions == null && r.points == null}
    <p class="muted">Couldn't read Saving Sessions or Octoplus from your account. If you haven't joined Octoplus, there's nothing to show yet; otherwise Octopus may have changed this part of their system.</p>
  {:else}
    <div class="chips">
      {#if r.points != null}<div class="chip"><span class="v">{r.points.toLocaleString('en-GB')}</span><span class="k">Octopoints balance</span></div>{/if}
      {#if r.sessions}<div class="chip"><span class="v">{joined.length}</span><span class="k">Saving Sessions joined{earned ? ` · ${earned.toLocaleString('en-GB')} points earned` : ''}</span></div>{/if}
    </div>
    {#if r.sessions}
      {#if events.length}
        <ul class="list">
          {#each events as e}
            <li><span>{fmtDate(new Date(e.startAt))} {hhmm(e.startAt)}–{hhmm(e.endAt)}{#if joinedIds.has(String(e.id))}<span class="tag good">Joined</span>{/if}</span><span class="when">{e.rewardPerKwhInOctoPoints ? e.rewardPerKwhInOctoPoints + ' points per kWh saved' : ''}</span></li>
          {/each}
        </ul>
      {:else}<p class="muted small">No Saving Sessions announced right now.</p>{/if}
    {/if}
  {/if}
</section>
