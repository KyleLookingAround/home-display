# 0008: Drawing the screensaver within a TV's means

**Status:** accepted, October 2026

**Context.** On the living-room TV's browser the screensaver was very laggy. A benchmark (`BENCH=1`, below) showed why. With the CPU slowed six times, roughly a TV's speed, it managed about 3 frames a second, and over 80% of the time went on the browser's own painting, not on our code.
- Each frame blended the sky, two layers of far stars and two nebulae over the whole screen. Those things are so distant they move a pixel or two a second, so the parallax between them was never visible.
- The aurora was about 480 overlapping strips blended every frame.
- The starfield behind the page kept drawing 800 stars a frame although the screensaver covered it.
- Every canvas was drawn at full resolution, even on screens that couldn't keep up.

The photo of the TV also showed clutter: far billboards overlapping near ones, and a steel truss sweeping across everything.

**Decision.**
- **One backdrop.** The sky's colour, the far and middle stars and both nebulae are baked together into one picture two screens wide. It's re-baked only when the palette changes or a nebula fades in, and slid along with one opaque copy a frame. Only the near stars are drawn one by one, to twinkle and streak.
- **The aurora** is painted at a quarter size a few times a second and stretched over the sky in one go. It's gentler too.
- **Tiers** (`TIERS` in `cockpit.js`): canvas resolution, frames a second, and how often the road ahead redraws. They are full, three-quarters at 30 frames, half at 30 frames, and 0.4 at 20 frames.
  - TV browsers, found from the user agent, start at half.
  - Any screen steps down a tier when it falls well short of its target over three seconds.
  - Settings has "Screensaver detail": automatic, full, or lighter. A link can say `detail=low` or `detail=high`.
- **Sharp text at any tier.** The road ahead, its labels and the station's sign are drawn on their own canvas (`cAhead`) at full resolution. It redraws every frame at full detail and a few times a second on the lower tiers.
- **Nothing drawn that can't be seen.**
  - The starfield rests and is hidden behind the screensaver.
  - The near layer is hidden when nothing is passing.
  - The glass only redraws while rain or snow moves on it.
- **Lite styling** on lower tiers (`body.lite`): no blurred drop shadows, glows or looping animations for the browser to keep repainting.
- **Less clutter:**
  - no far billboards;
  - billboards turn less as they pass;
  - no steel truss among the things that sweep past;
  - labels that can't fit above move below rather than vanish.

**Consequences.**
- Benchmark, CPU slowed six times, phase night (frames a second):

  | | Before | After |
  |---|---|---|
  | Full detail | 3.1 | 5.9 |
  | Lighter | n/a | 19.4 |

- Far stars no longer twinkle, and the far and middle layers no longer streak at warp. The near stars and the warp streaks still do.
- At the lower tiers the space picture is softer, as it's drawn at half resolution and enlarged. Text isn't affected.
- `BENCH=1 node --test --test-name-pattern="frame budget" tests/display.browser.mjs` reports frames a second and the busiest functions. `BENCH_CPU`, `BENCH_LOOK` and `BENCH_EVAL` change the slowdown, the scene, and what to switch off first.
