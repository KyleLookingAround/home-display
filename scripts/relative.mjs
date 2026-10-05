// After astro build: make the dashboard's asset paths relative ("./_astro/…"), so the same build works at any
// address: GitHub Pages under /home-display/, and the home server helper at /. Every page sits at the top level
// (build.format 'file'), so one prefix fits all.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../dist/', import.meta.url);
let n = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith('.html'))){
  const before = readFileSync(new URL(f, dir), 'utf8'), after = before.replace(/(["'(])\/_astro\//g, '$1./_astro/');
  if (after !== before){ writeFileSync(new URL(f, dir), after); n++; }
  if (/["'(]\/(?!\/)[^"'()\s]*\.(js|css)/.test(after)) throw new Error(`${f}: an absolute asset path is left`);
}
console.log(`relative asset paths in ${n} page(s)`);
