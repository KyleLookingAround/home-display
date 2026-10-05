#!/usr/bin/env python3
"""Assemble index.html from the source parts in src/. Run: python3 build.py"""
from pathlib import Path
here = Path(__file__).parent
src = here / 'src'
js = ''.join((src / f).read_text() for f in ('core.js', 'analysis.js', 'dom.js'))
html = (src / 'head.html').read_text() + (src / 'body.html').read_text() \
    + '<script>\n(() => {\n"use strict";\n' + js + '\n})();\n</script>\n<script>\n' \
    + (src / 'starfield.js').read_text() + '</script>\n</body>\n</html>\n'
(here / 'index.html').write_text(html)
print(f'index.html written ({len(html)//1024} KB)')
