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

**Revision, 5 October 2026: the voyage.** Kyle asked for a full redesign to make it gorgeous to watch, and asked whether something other than billboards would be better. He chose all four ideas offered, keeping billboards but using them less:
- **The view:** nebulae are painted from noise (warped fractal noise, gradient-mapped to the time of day and the mood) and grown a few rows a frame. Planets are lit spheres with an atmosphere, some with rings, one passing every few minutes. The frame's rim takes the colour of the light outside.
- **Billboards are for what you need to catch:** the price when it matters, bins, the next train, rain on the way and the ISS (`boardCards`). Everything else rides the train.
- **The space train:** the Harold Street Express passes every few minutes on a guide rail, with one fact on each carriage, slowly enough to read. A card is never on a billboard and the train at once.
- **Your house on an asteroid:** a red-brick terrace drifts by every few minutes. Its windows glow with the Home Mini's live draw, the chimney smokes when it's cold, the porch lantern takes the price's colour, and the bins are out the evening before collection.
- **Nature tells the story** (`worldFor`): the aurora when grid carbon is low or power is free; a comet with a tail in the colours of tomorrow's bins on bin night; the moon in its real phase (`moonPhase`); and the real International Space Station passing when it's within 1,500 km of Stockport (`issPass`, from wheretheiss.at).
- **Space wildlife:** whales, jellyfish and birds of light pass now and then, for no reason at all.
- **Previews:** `show=` adds any of `train`, `house`, `whales`, `jellies`, `birds`, `iss`, `comet`, `aurora`, `moon`, `traffic`, `flyby`, `rock`, `truss` or `cruiser` mid-screen, such as `#screensaver&phase=night&show=train,aurora`.

The drawing of each thing lives in `scenery.js`; `cockpit.js` decides when and where.

**Consequences.**
- It's the heaviest part on old TVs. It halves its own detail when frames run slow, and draws a still frame every 20 seconds under reduced motion.
- The energy, home and travel modes stay for reading details.
