<script>
  /*
   * About this song: a badge when it's from round here, the story behind it (its Wikipedia article), its credits
   * (who wrote it, who played what, who produced it, where it was recorded, when it first came out) and the artist.
   * Credits are MusicBrainz's, the open music encyclopedia; the story and the artist are Wikipedia's.
   */
  import { music, closePlayer } from '../../state/music.svelte.js';
  import { rolesText } from '../../lib/musicdata.js';
  import { longDate, keyDate } from '../../lib/format.js';
  import Icon from './Icon.svelte';
  const t = $derived(music.track);
  const s = $derived(music.story && music.storyFor === (t && t.id) ? music.story : null);
  const c = $derived(s ? s.credits : null);
  let more = $state(false);
  const released = d => /^\d{4}-\d\d-\d\d$/.test(d) ? longDate(keyDate(d)) : d ? d.slice(0, 4) : '';
  const writes = w => w.roles.indexOf('composer') >= 0 && w.roles.indexOf('lyricist') >= 0 ? 'Words and music' : w.roles.indexOf('lyricist') >= 0 ? 'Words' : w.roles.indexOf('composer') >= 0 ? 'Music' : 'Writer';
</script>

{#if t}
  <div class="about">
    {#if !s}
      <div class="loading"><span class="spin" aria-hidden="true"></span><p>Looking this song up in MusicBrainz…</p></div>
    {:else if !c}
      <div class="none"><Icon name="info" size={36} /><p>MusicBrainz, the open music encyclopedia, doesn't know this recording yet.</p></div>
    {:else}
      {#if s.badge}<div class="badge" class:studio={s.badge.kind === 'studio'}><Icon name="pin" size={20} /><span>{s.badge.text}</span></div>{/if}

      {#if s.story}
        <section class="story">
          <h3>The story</h3>
          <p class:clamp={!more}>{s.story.text}</p>
          <div class="row-links">
            {#if !more && s.story.text.length > 320}<button type="button" class="link" onclick={() => { more = true; }}>Read more</button>{/if}
            {#if s.story.url}<a href={s.story.url} target="_blank" rel="noopener">From Wikipedia<Icon name="link" size={14} /></a>{/if}
          </div>
        </section>
      {/if}

      <section class="credits">
        <h3>Credits</h3>
        <dl>
          {#each s.writers || [] as w}<div><dt>{writes(w)}</dt><dd>{w.name}</dd></div>{/each}
          {#each c.performers as p}<div><dt>{rolesText(p.roles)}</dt><dd>{p.name}</dd></div>{/each}
          {#if c.producers.length}<div><dt>Produced by</dt><dd>{c.producers.join(', ')}</dd></div>{/if}
          {#if c.engineers.length}<div><dt>Engineered by</dt><dd>{c.engineers.join(', ')}</dd></div>{/if}
          {#each s.places || [] as p}<div class:gm={p.gm}><dt>Recorded at</dt><dd>{p.name}{p.area ? ', ' + p.area : ''}</dd></div>{/each}
          {#if c.released}<div><dt>First released</dt><dd>{released(c.released)}</dd></div>{/if}
          {#if t.album.name}<div><dt>Album</dt><dd><a href="./music.html#album/{t.album.id}" onclick={() => closePlayer()}>{t.album.name}</a>{t.album.year ? ' · ' + t.album.year : ''}</dd></div>{/if}
        </dl>
        {#if !c.performers.length && !(s.writers || []).length && !c.producers.length}<p class="note">MusicBrainz has the song but not who played on it yet.</p>{/if}
      </section>

      {#if s.home || t.artists[0]}
        <section class="artist">
          <h3>The artist</h3>
          <a class="acard" href="./music.html#artist/{t.artists[0].id}" onclick={() => closePlayer()}>
            <span class="ai"><Icon name="person" size={22} /></span>
            <span class="at"><b>{t.artists[0].name}</b>
              <span>{#if s.home && s.home.from}From {s.home.from}{s.home.formed ? (s.home.group ? ', formed ' : ', born ') + s.home.formed : ''}{:else}Open their page{/if}</span></span>
            <Icon name="back" size={18} />
          </a>
        </section>
      {/if}
      <p class="credit">Credits from MusicBrainz, the open music encyclopedia{s.story ? '; the story from Wikipedia' : ''}.</p>
    {/if}
  </div>
{/if}

<style>
  .about{display:grid;gap:22px;align-content:start;padding-bottom:20px}
  h3{margin:0 0 8px;font:700 13px/1.2 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:rgba(233,236,255,.6)}
  .loading,.none{display:grid;justify-items:center;gap:12px;text-align:center;color:rgba(233,236,255,.65);padding:10vh 16px}
  .loading p,.none p{margin:0;max-width:30ch}
  .spin{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:var(--tint,var(--gas));animation:spin .9s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .badge{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:16px;font:700 15.5px/1.3 var(--f-body);
    background:linear-gradient(135deg,color-mix(in srgb,var(--tint,var(--gas)) 34%,transparent),color-mix(in srgb,var(--tint,var(--gas)) 10%,transparent));border:1px solid color-mix(in srgb,var(--tint,var(--gas)) 45%,transparent);color:#fff}
  .badge :global(.ic){color:var(--tint,var(--gas))}
  .story p{margin:0;font:400 16px/1.6 var(--f-body);color:rgba(233,236,255,.9)}
  .story p.clamp{display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
  .row-links{display:flex;gap:16px;align-items:center;margin-top:10px}
  .row-links a,.link{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font:600 13.5px var(--f-body);text-decoration:none;background:none;border:0;padding:6px 0;cursor:pointer}
  .row-links a{color:rgba(233,236,255,.65)}
  dl{margin:0;display:grid;gap:2px}
  dl div{display:grid;gap:1px;padding:9px 0;border-top:1px solid rgba(255,255,255,.07)}
  dl div:first-child{border-top:0}
  dt{font-size:12.5px;color:rgba(233,236,255,.55)}
  dd{margin:0;font:600 15.5px/1.35 var(--f-body)}
  dd a{color:inherit;text-decoration:none} dd a:hover{text-decoration:underline}
  .gm dd{color:var(--tint,var(--gas))}
  .acard{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.05);text-decoration:none;color:var(--ink)}
  .acard:hover{background:rgba(255,255,255,.08)}
  .acard > :global(.ic){transform:rotate(180deg);opacity:.6}
  .ai{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.08)}
  .at{display:grid;min-width:0}
  .at b{font-size:15.5px}
  .at span{font-size:13px;color:rgba(233,236,255,.6)}
  .credit{margin:0;font-size:12px;color:rgba(233,236,255,.45)}
  @media (prefers-reduced-motion:reduce){ .spin{animation:none} }
</style>
