<script>
  /*
   * Vinyl mode: the cover as the label of a record on a turntable. It turns at 33⅓ while the song plays and stops
   * when it's paused, and the arm moves across the record as the song goes on, lifting off when paused. The light on
   * the vinyl stays put while the record turns, as it would. Still under "reduce motion".
   */
  let { src = '', playing = false, fraction = 0 } = $props();
  const arm = $derived(playing ? 15 + 22 * Math.min(1, Math.max(0, fraction)) : 0);
</script>

<div class="tt" class:playing>
  <div class="plinth"></div>
  <div class="platter">
    <div class="record">
      {#if src}<img class="label" {src} alt="" draggable="false">{:else}<span class="label blank"></span>{/if}
      <span class="hole"></span>
    </div>
    <span class="sheen" aria-hidden="true"></span>
  </div>
  <svg class="arm" viewBox="0 0 100 100" aria-hidden="true" style="transform:rotate({arm}deg)">
    <circle cx="86" cy="12" r="7" fill="#2a2d3a" stroke="rgba(255,255,255,.25)"/><circle cx="86" cy="12" r="2.6" fill="#9aa2c8"/>
    <path d="M86 12 L82 58 L64 78" fill="none" stroke="#c9cede" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="57" y="74" width="12" height="7" rx="1.5" transform="rotate(-48 63 77)" fill="#e9ecff"/>
  </svg>
</div>

<style>
  .tt{position:relative;width:min(100%,360px,40vh);aspect-ratio:1;user-select:none}
  .plinth{position:absolute;left:-4%;top:-4%;right:-4%;bottom:-4%;border-radius:18px;background:linear-gradient(145deg,#1b1e2c,#0c0e17);box-shadow:0 24px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06)}
  .platter{position:absolute;left:4%;top:4%;width:84%;aspect-ratio:1;border-radius:50%;background:#0b0b0f;box-shadow:0 8px 24px rgba(0,0,0,.7)}
  .record{position:absolute;left:2%;top:2%;right:2%;bottom:2%;border-radius:50%;display:grid;place-items:center;
    background:repeating-radial-gradient(circle at 50% 50%,#121217 0 1.2px,#1b1b22 1.2px 2.6px);animation:turn 1.8s linear infinite;animation-play-state:paused}
  .playing .record{animation-play-state:running}
  @keyframes turn{to{transform:rotate(360deg)}}
  .label{width:36%;aspect-ratio:1;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px #0e0e13}
  .label.blank{background:var(--tint,var(--gas))}
  .hole{position:absolute;width:3.2%;aspect-ratio:1;border-radius:50%;background:#05060c;box-shadow:0 0 0 1px rgba(255,255,255,.15)}
  .sheen{position:absolute;left:2%;top:2%;right:2%;bottom:2%;border-radius:50%;pointer-events:none;
    background:conic-gradient(from 210deg,transparent 0 8%,rgba(255,255,255,.10) 12%,transparent 18% 58%,rgba(255,255,255,.07) 62%,transparent 68%);mix-blend-mode:screen}
  .arm{position:absolute;right:-2%;top:-2%;width:56%;height:56%;transform-origin:86% 12%;transition:transform 1.2s cubic-bezier(.3,.9,.3,1);filter:drop-shadow(0 6px 8px rgba(0,0,0,.6))}
  @media (prefers-reduced-motion:reduce){ .record{animation:none} .arm{transition:none} }
</style>
