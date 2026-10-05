# Stack options

Suggestions for the Astro version, picked for a household project that one person maintains: free tiers, few moving parts, and no secrets in the browser.

## Front end

| Need | Suggestion | Why |
|---|---|---|
| Site framework | **Astro**, static output | Pages are plain HTML by default and fast on old TV browsers. Interactive bits are islands. |
| Interactive parts | **Svelte** islands (or Preact) | Small runtime; good for charts, forms and the display switcher. |
| Language | TypeScript | The data shapes (readings, rate lists, tariffs) benefit from types. |
| Charts | Keep the hand-made SVG `barChart`, or **uPlot** for heavy time series | Both are tiny. Avoid big chart libraries on TV browsers. |
| Styling | Plain CSS with the existing tokens | The intergalactic theme is already token-based. |
| Install to phone | `@vite-pwa/astro` | Manifest and offline shell, so it opens like an app. |
| Tests | **Vitest** for `lib/`, **Playwright** for screenshots at phone and 1920×1080 | The maths is already pure; the TV layout needs checking at TV size. |

## Hosting

- **GitHub Pages** (what you picked). Deploy with the official `withastro/action` workflow. The site is public, so add StatiCrypt for the password lock (see `ROADMAP.md`). A private repo needs a paid GitHub plan to publish to Pages.
- **Cloudflare Pages.** This is the alternative if you want real sign-in: it's free, sits next to Workers, and Cloudflare Access gives proper password or email login.

## Backend (when you need one)

- **Cloudflare Worker** on the free tier:
  - `/api/octopus/*` proxy, with the API key stored as a Worker secret and CORS limited to your site's address.
  - `/api/pvgis` proxy.
  - Cron triggers for negative-price alerts, Saving Session alerts and the weekly email.
  - **D1** (SQLite) or **KV** to keep readings history.
- **Push notifications:** ntfy.sh (free, a phone app, one HTTP call to send), Pushover, or a Telegram bot.
- **Home server alternative:** grow `server.py`, or rewrite it with FastAPI, and add SQLite and a cron job. This keeps everything at home, but the TV and phone only work on home wifi unless you add Tailscale.
- **Home Assistant:** if you run it, the community Octopus Energy integration already covers rates, Saving Sessions and the Home Mini. The display can read from HA's API instead of calling Octopus directly.

## Smart TV notes

- **Built-in browsers:** Samsung (Tizen) and LG (webOS) run older Chromium. Tizen 5 (2019) is about Chromium 63, and webOS 6 (2021) is 79.
  - The display's code, and the shared modules in `src/lib/`, avoid syntax those can't parse: no `?.`, `??`, `flatMap` or `.at()`. `tests/display.test.mjs` checks the built page.
  - Its CSS avoids `inset`, flex `gap` and `:focus-visible`, and gives `clamp()`/`min()` a fallback.
  - Test `backdrop-filter` and canvas performance on the real TV. The display honours reduced motion: the screensaver then moves once a minute instead of smoothly.
  - The display stays out of the Astro build for this reason: `build.py` flattens the shared modules into one plain script. If it ever moves into Astro, set the Vite build target to `chrome63` or similar. The dashboard, which phones and computers open, is built by Astro with its default modern target.
- **Plug-in sticks:** a Fire TV Stick or Chromecast with Google TV running a kiosk browser (for example Fully Kiosk Browser) is often smoother, and can auto-start the display and stop the screen sleeping.
- **Remote keys:** Back is keyCode 10009 on Samsung and 461 on LG. Some remotes have colour buttons (red, green, yellow, blue) that make good mode shortcuts.
