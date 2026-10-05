# 0005: The cockpit is the screen's resting state

**Status:** accepted, October 2026

**Context.** Kyle wanted the display to act like a screensaver: things moving across the screen, keeping the intergalactic theme, with the weather affecting it. The picture is space billboards, seen from inside a rocket ship looking out, with real depth.

**Decision.** The screensaver mode is a view from a cockpit, and new screens open on it.
- **Billboards:** holographic signs carrying one live fact each fly out of the vanishing point and turn to face you as they pass. Far ones are hazy and soft.
- **Traffic:** satellites, freighters, a ring station and asteroids pass at their own depths.
- **Weather:** rain beads and runs on the glass, snow sticks, cold frosts the edges, fog mists it, thunder flashes and wind rocks the ship. The sun, moon, dawn and dusk follow the real sunrise and sunset.
- **Power:** the price sets the engines. Negative means warp speed; peak means power saving. High grid carbon hazes the view.

The logic is pure, in `skyFor`, `engineFor`, `buildBillboards` and `billboardRotation` in `sources.js`, and tested. The drawing is in `cockpit.js`. Links such as `#screensaver&wx=rain&phase=night&price=-3` preview any combination.

**Consequences.**
- It's the heaviest part on old TVs. It halves its own detail when frames run slow, and draws a still frame every 20 seconds under reduced motion.
- The energy, home and travel modes stay for reading details.
