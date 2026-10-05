# 0005: The view from the ship is the screen's resting state

**Status:** accepted, October 2026

**Context.** Kyle wanted the display to act like a screensaver: things moving across the screen, keeping the intergalactic theme, with the weather affecting it. The picture is space billboards, seen from inside a rocket ship looking out, with real depth.

**Decision.** The screensaver mode is a view from a cockpit, and new screens open on it.
- **Billboards:** holographic signs carrying one live fact each fly out of the vanishing point and turn to face you as they pass. Far ones are hazy and soft.
- **Traffic:** satellites, freighters, a ring station and asteroids pass at their own depths.
- **Weather:** rain beads and runs on the glass, snow sticks, cold frosts the edges, fog mists it, thunder flashes and wind rocks the ship. The sun, moon, dawn and dusk follow the real sunrise and sunset.
- **Power:** the price sets the engines. Negative means warp speed; peak means power saving. High grid carbon hazes the view.

The logic is pure, in `skyFor`, `engineFor`, `buildBillboards` and `billboardRotation` in `sources.js`, and tested. The drawing is in `cockpit.js`. Links such as `#screensaver&wx=rain&phase=night&price=-3` preview any combination.

**Revision, 5 October 2026: a side window.** Kyle wanted to look out of a side window and watch it all go by, rather than out of the front. The view is now a cabin wall with a rounded window, and everything outside slides past from right to left with parallax:
- Each thing has a depth, and its speed across the window is the ship's speed divided by that depth. Dust right by the glass (depth about 0.4) streaks past; the furthest stars (about 70) creep.
- Billboards drift by in lanes at depth 1 (readable, about 16 seconds to cross) and depth 2.3 to 2.6 (small and hazy, for distance). Their speed is capped so warp doesn't make them unreadable.
- Rain on the glass is swept backwards by the ship's motion.
- The planet and moon drift by over many minutes.

**Consequences.**
- It's the heaviest part on old TVs. It halves its own detail when frames run slow, and draws a still frame every 20 seconds under reduced motion.
- The energy, home and travel modes stay for reading details.
