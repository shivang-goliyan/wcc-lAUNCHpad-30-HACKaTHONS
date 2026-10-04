// Screenshots of the local dev server for visual review (Playwright from the global npm root, system Chrome).
//   node scripts/qa/shot.mjs <outdir> <path>[@WxH][#scrollY] ...      WAIT=ms to wait after load
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');

const [out, ...targets] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
for (const t of targets) {
  const [, path, w = 1440, h = 900, sy = 0] = t.match(/^([^@#]+)(?:@(\d+)x(\d+))?(?:#(\d+))?$/);
  await page.setViewportSize({ width: +w, height: +h });
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 });
  // walk down the page first so scroll-revealed sections are shown in full-page shots
  if (process.env.FULL === '1') {
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  if (+sy) await page.evaluate((y) => window.scrollTo(0, y), +sy);
  await page.waitForTimeout(+(process.env.WAIT ?? 1500));
  const name = `${out}/${path.replace(/[^a-z0-9]+/gi, '_') || 'root'}_${w}x${h}_${sy}.png`;
  await page.screenshot({ path: name, fullPage: process.env.FULL === '1' });
  console.log('shot', name);
}
await browser.close();
