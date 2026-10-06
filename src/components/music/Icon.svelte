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
    volume: { s: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>' },
    more: { f: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>' },
    share: { s: '<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>' },
    disc: { s: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="3"/><path d="M12 5.5a6.5 6.5 0 0 0-6.5 6.5"/>' },
    book: { s: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 10.5h6"/>' },
    info: { s: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6" fill="currentColor"/>' },
    album: { s: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>' },
    moon: { s: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>' },
    person: { s: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
    pin: { s: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>' },
    link: { s: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>' },
    shelf: { s: '<path d="M3 21h18"/><rect x="4" y="5" width="4" height="16" rx="1"/><rect x="9.5" y="3" width="4" height="18" rx="1"/><path d="m15.5 6.5 3.8-1.2 3 15.3-3.8.9z"/>' }
  };
  const p = $derived(P[name] || P.other);
</script>
<svg class="ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={p.f ? 'currentColor' : 'none'} stroke={p.f ? 'none' : 'currentColor'}
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{@html p.f || p.s}</svg>

<style>.ic{display:block;flex:none}</style>
