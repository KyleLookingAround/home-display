<script>
  // The music player's line icons, in the app's stroke style. Filled where a player's buttons usually are (play, skip).
  let { name, size = 22 } = $props();
  const P = {
    play: { f: '<path d="M7 4.5v15l13-7.5z"/>' },
    pause: { f: '<path d="M6.5 4h3.8v16H6.5zM13.7 4h3.8v16h-3.8z"/>' },
    next: { f: '<path d="M16.5 5h2.2v14h-2.2zM4.5 5v14l11-7z"/>' },
    prev: { f: '<path d="M5.3 5h2.2v14H5.3zM19.5 5v14l-11-7z"/>' },
    shuffle: { s: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>' },
    repeat: { s: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>' },
    one: { s: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1.5v5"/>' },
    heart: { s: '<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.8 6.4 4.8c2 0 3.3 1.1 4 2.2.6-1.1 2-2.2 4-2.2 3.4 0 5.2 3.4 3.6 6.6C19 15.6 12 20 12 20z"/>' },
    down: { s: '<path d="M6 9l6 6 6-6"/>' },
    back: { s: '<path d="M15 6l-6 6 6 6"/>' },
    plus: { s: '<path d="M12 5v14M5 12h14"/>' },
    queue: { s: '<path d="M4 6h12M4 12h12M4 18h7"/><path d="M17 15v6l4-3z"/>' },
    lyrics: { s: '<path d="M4 6h16M4 11h11M4 16h13M4 21h8"/>' },
    search: { s: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>' },
    speaker: { s: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><circle cx="12" cy="14.5" r="3.5"/><circle cx="12" cy="6.8" r="1"/>' },
    tv: { s: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>' },
    phone: { s: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>' },
    computer: { s: '<rect x="3.5" y="4" width="17" height="12" rx="1.5"/><path d="M2 19.5h20"/>' },
    other: { s: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/>' },
    music: { s: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
    volume: { s: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>' }
  };
  const p = $derived(P[name] || P.other);
</script>
<svg class="ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={p.f ? 'currentColor' : 'none'} stroke={p.f ? 'none' : 'currentColor'}
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{@html p.f || p.s}</svg>

<style>.ic{display:block;flex:none}</style>
