// The dashboard: Astro pages with Svelte islands (decision 0009). The household display isn't built here: build.py
// makes display.html, a single file for TV browsers. npm run build runs both, then makes the asset paths relative.
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  integrations: [svelte()],
  build: { format: 'file' },          // patterns.html, prices.html…: every page at one level, so relative links work anywhere
  publicDir: 'public',
  outDir: 'dist',
  devToolbar: { enabled: false }
});
