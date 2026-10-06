#!/usr/bin/env python3
"""Assemble the household display from its parts. Run: python3 build.py   (--check: say whether display.html is up to date)

display.html  src/display/head.html + body.html, then one script: the shared modules in src/lib/ as plain code,
              then the display's own scripts; then the starfield. One file that opens straight from disk and
              parses on TV browsers back to Chromium 63.

The shared modules are ES modules for the dashboard (built by Astro: npm run build). Here their one-line imports
are dropped and their export keywords removed, and everything shares one scope, as it always did.
The dashboard is built by Astro into dist/ (npm run build), not here.
"""
import re
import sys
from pathlib import Path

here = Path(__file__).parent
src = here / 'src'

SHARED = ('format', 'browser', 'net', 'octopus', 'carbon', 'analysis', 'outdoors', 'household', 'remote', 'qr', 'spotify', 'music', 'musicdata', 'voyage')   # what the display needs from src/lib/
DISPLAY = ('scenery', 'cockpit', 'board', 'tvmusic', 'display')


def plain(name, text):
    """An ES module as a plain script: no imports, no exports."""
    text = re.sub(r"^import \{[^}\n]*\} from '\./[\w-]+\.js';\n", '', text, flags=re.M)
    text = re.sub(r'^export (?=(?:const|let|function|async function|class) )', '', text, flags=re.M)
    left = re.findall(r'^(?:import|export)\b.*', text, flags=re.M)
    if left:
        sys.exit(f'{name}: keep imports on one line, from ./module.js, and export only declarations: {left[0]}')
    return text


def display():
    js = ''.join(plain(f'lib/{m}.js', (src / 'lib' / f'{m}.js').read_text()) for m in SHARED)
    js += ''.join((src / 'display' / f'{m}.js').read_text() for m in DISPLAY)
    return (src / 'display' / 'head.html').read_text() + (src / 'display' / 'body.html').read_text() \
        + '<script>\n(() => {\n"use strict";\n' + js + '\n})();\n</script>\n<script>\n' \
        + (src / 'starfield.js').read_text() + '</script>\n</body>\n</html>\n'


if __name__ == '__main__':
    html = display()
    if '--check' in sys.argv:
        if (here / 'display.html').read_text() != html:
            sys.exit('display.html is out of date: run python3 build.py')
        print('display.html is up to date')
    else:
        (here / 'display.html').write_text(html)
        print(f'display.html written ({len(html)//1024} KB)')
