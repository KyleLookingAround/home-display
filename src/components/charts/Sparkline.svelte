<script>
  // A small line, no axes: how something went over the last while.
  let { values = [], colour = 'var(--gas)', height = 28 } = $props();
  const d = $derived.by(() => {
    const v = values.filter(x => x != null); if (v.length < 2) return '';
    const lo = Math.min(...v), hi = Math.max(...v), k = hi - lo || 1;
    return values.map((x, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1) * 100).toFixed(1)},${(height - 2 - (x - lo) / k * (height - 4)).toFixed(1)}`).join('');
  });
</script>
<svg class="spark" viewBox="0 0 100 {height}" preserveAspectRatio="none" aria-hidden="true" style="height:{height}px"><path d={d} fill="none" stroke={colour} stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
<style>.spark{display:block;width:100%}</style>
