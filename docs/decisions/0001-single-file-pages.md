# 0001: Single-file pages, no bundler

**Status:** accepted, October 2026

**Context.** The dashboard began as one HTML file that opens straight from disk. The household display has to run on old TV browsers, a wall tablet and phones, published on GitHub Pages and optionally served by `server.py`.

**Decision.** Keep each page as one self-contained HTML file, built by concatenating `src/` with `python3 build.py`. No bundler and no runtime dependencies. Playwright is the only development dependency, and it is only used for tests. The built pages are committed, and CI checks they match the source.

**Consequences.** Any page can be opened by double-clicking it, and published by copying it. Code must be written in a syntax old browsers understand, without a transpiler (see 0002). The Astro move in `ROADMAP.md` item 2 would revisit this.
