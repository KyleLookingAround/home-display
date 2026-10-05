# 0010: The redesign: five plain pages, phone first, each opening with its answer

**Status:** accepted, October 2026. The plan is [docs/redesign.md](../redesign.md). Built on the `redesign` branch and previewed at `/preview/` until Kyle is happy with it.

**Context.** The dashboard had grown panel by panel into five tabs (Overview, Patterns, Prices, Compare, Home) with space-flavoured names, and the household's own data (bins, trains, weather, the calendar) lived only on the wall display. It was used mostly on a phone, by one person, and each tab was a long list of panels of equal weight.

**Decision.**
- **Phone first.** Every page is laid out for a phone, with a bar of five icons at the bottom; from 900px wide the bar becomes a rail on the left and cards go in two columns.
- **Plain names:** Now, Money, Usage, Home and Settings. Each opens with the answer to its question in one line (should I use power now; what am I spending; how do I use it), then the detail in cards, with the rarely needed folded away.
- **Calmer.** The same deep-space palette and fonts, with less glow: one accent per card, cheap green, normal amber and peak red for prices, gas cyan, violet only for prices below zero. Corners are rounded or sharp, chosen in Settings.
- **The household on the phone.** The display's household code (`src/display/sources.js`) became two shared modules, `src/lib/household.js` and `src/lib/voyage.js`, so the phone's Home and Now pages show the same bins, trains, weather and calendar as the wall display, from the same settings.
- **Upgrades as one kind of card:** tariffs, battery, solar, insulation and the certificate, each with a year's saving, a rough cost and the payback, worked out from sensible defaults so there's an answer before any form is touched. The simulators open underneath.
- **Settings in one place,** including the household's settings: what you change on the phone stays on the phone, as on a screen, on top of `household.json`.
- **A small chart kit** (`src/components/charts/`): a price strip, bars with a ghost of the period before, a heat map of every day, a clock face of your day, a dial, a sparkline and a scatter plot. Each reads out with a tap, a pointer or the arrow keys.
- **The EPC search goes.** The rating is known (E); the certificate card keeps it, its potential and the recommendations noted.
- **The old pages' links still work,** sending you to their new homes. The wall display is unchanged.

**Consequences.**
- One more page (Settings) and a different shape to every page; the browser tests were rewritten for them, at phone, tablet and laptop widths.
- The phone fetches weather, trains, the calendar and the council's bin dates as the display does, each cached in the browser for its own time.
- Live trains on the phone come from Huxley2, like the display, so they fail quietly when it's down.
