<script>
  // A half-round gauge: the needle at `frac` (0 to 1), green, amber and red bands, and the value written under it.
  let { frac = 0, value = '', label = '', bands = [.26, .65] } = $props();
  const pt = f => { const a = Math.PI * (1 - f); return [50 + Math.cos(a) * 40, 50 - Math.sin(a) * 40]; };
  const arc = (a, b) => { const [x0, y0] = pt(a), [x1, y1] = pt(b); return `M${x0.toFixed(2)},${y0.toFixed(2)} A40,40 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };
</script>

<div class="dial" role="img" aria-label="{label}: {value}">
  <svg viewBox="0 0 100 56" aria-hidden="true">
    <path d={arc(0, 1)} fill="none" stroke="rgba(134,152,255,.16)" stroke-width="8"/>
    <path d={arc(0, bands[0])} fill="none" stroke="var(--cheap)" stroke-width="3"/>
    <path d={arc(bands[0], bands[1])} fill="none" stroke="var(--normal)" stroke-width="3"/>
    <path d={arc(bands[1], 1)} fill="none" stroke="var(--peak)" stroke-width="3"/>
    <g style="transform:rotate({((frac || 0) - .5) * 180}deg);transform-origin:50px 50px;transition:transform 1s cubic-bezier(.3,1.4,.5,1)"><path d="M48.6 50 50 14 51.4 50z" fill="var(--ink)"/></g>
    <circle cx="50" cy="50" r="4" fill="#20264a" stroke="var(--line-hot)"/>
  </svg>
</div>

<style>.dial{width:100%;max-width:120px}.dial svg{display:block;width:100%;height:auto}</style>
