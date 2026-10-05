# 0002: Code that parses on Chromium 63

**Status:** accepted, October 2026

**Context.** Built-in TV browsers lag behind: Samsung Tizen 5 (2019) is about Chromium 63, and LG webOS 6 (2021) is 79. Optional chaining and nullish coalescing need 80. One syntax error stops the whole page.

**Decision.**
- Code in `core.js`, `analysis.js` and `src/display/` avoids syntax and methods newer than Chromium 63: no `?.`, `??`, `flatMap`, `.at()`, optional catch binding or `Object.fromEntries`. Use `nz(value, fallback)` instead of `??`.
- The display's CSS avoids `inset`, flex `gap` and `:focus-visible`, and gives `clamp()`/`min()` a fallback.
- `tests/display.test.mjs` scans the built display for these.

**Consequences.** Slightly wordier code. `dom.js` only runs on the dashboard and is exempt.
