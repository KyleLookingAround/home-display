// The published lock: build a locked copy of the site with a test PIN, then unlock it the way a TV would.
// Needs Playwright and npx (for StatiCrypt): `node --test tests/lock.browser.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('the locked site opens with the PIN on the keypad and remembers the screen', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hse-site-'));
  execFileSync(join(ROOT, 'lock', 'publish.sh'), [dir], { env: { ...process.env, SITE_PASSWORD: '2468' }, stdio: 'pipe' });
  const page0 = readFileSync(join(dir, 'display.html'), 'utf8');
  assert.doesNotMatch(page0, /Agile price now/, 'the display is encrypted');
  assert.ok(existsSync(join(dir, '.nojekyll')));
  assert.ok(!existsSync(join(dir, 'server.py')), 'only the pages are published');

  const server = http.createServer((req, res) => {
    const file = normalize(join(dir, new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(dir) || !existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': extname(file) === '.html' ? 'text/html' : 'application/octet-stream' }); res.end(readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.route(/^https:\/\//, r => r.abort());
  try {
    await page.goto(base + '/display.html#home');
    await page.waitForSelector('#staticrypt-password', { state: 'visible' });
    assert.equal(await page.isChecked('#staticrypt-remember'), true, 'remember is ticked, so a TV asks once');
    // A wrong PIN first, typed on the keypad with the arrows and Enter.
    await page.keyboard.press('ArrowDown');                      // to the keypad: 2
    assert.equal(await page.evaluate(() => document.activeElement.dataset.k), '2');
    await page.keyboard.press('Enter');
    await page.click('.go');
    await page.waitForFunction(() => document.getElementById('err').textContent.length > 0);
    assert.equal(await page.inputValue('#staticrypt-password'), '');
    for (const k of ['2', '4', '6', '8']) await page.click(`[data-k="${k}"]`);
    await page.click('.go');
    await page.waitForSelector('section[data-mode="home"]:not([hidden])');
    assert.match(await page.evaluate(() => location.hash), /#home/);
    await page.goto(base + '/index.html');
    await page.waitForSelector('.tabs', { timeout: 10000 });     // no PIN asked again
  } finally {
    await browser.close(); server.close();
  }
});
