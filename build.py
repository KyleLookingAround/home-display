#!/usr/bin/env python3
"""Assemble the pages from the source parts in src/. Run: python3 build.py

index.html    the dashboard: src/head.html + src/body.html + core, analysis, dom, starfield
display.html  the household display: src/display/ + core, analysis, display sources and logic, starfield
"""
from pathlib import Path
here = Path(__file__).parent
src = here / 'src'


def page(head, body, scripts):
    js = ''.join((src / f).read_text() for f in scripts)
    return (src / head).read_text() + (src / body).read_text() \
        + '<script>\n(() => {\n"use strict";\n' + js + '\n})();\n</script>\n<script>\n' \
        + (src / 'starfield.js').read_text() + '</script>\n</body>\n</html>\n'


PAGES = {
    'index.html': page('head.html', 'body.html', ('core.js', 'analysis.js', 'dom.js')),
    'display.html': page('display/head.html', 'display/body.html',
                         ('core.js', 'analysis.js', 'display/sources.js', 'display/cockpit.js', 'display/display.js')),
}

if __name__ == '__main__':
    for name, html in PAGES.items():
        (here / name).write_text(html)
        print(f'{name} written ({len(html)//1024} KB)')
