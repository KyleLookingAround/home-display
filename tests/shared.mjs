// The shared modules in src/lib/ as one plain script, the way build.py puts them in the display (imports and
// exports removed), so the tests can run them in a vm context alongside the display's own scripts.
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
export const plain = text => text.replace(/^import \{[^}\n]*\} from '\.\/[\w-]+\.js';\n/gm, '').replace(/^export (?=(?:const|let|function|async function|class) )/gm, '');
export const shared = (...mods) => mods.map(m => plain(read(`lib/${m}.js`))).join('\n');
