// Records a slow scroll through a page (Nami roaming) and logs her pose per frame.
//   node scripts/qa/scrollrec.mjs <out.webm> [path] [WxH]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const [out, path = '/', size = '1440x900'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const dir = dirname(out) + '/_rec';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir, size: { width: w, height: h } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
const poses = new Map();
const total = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < total; y += 12) {
  await page.mouse.wheel(0, 12);
  await page.waitForTimeout(18);
  if (y % 240 === 0) {
    const p = await page.evaluate(() => {
      const el = document.querySelector('.fixed [data-pose]');
      const box = el?.closest('.fixed')?.getBoundingClientRect();
      return el ? `${el.dataset.pose}@${Math.round(box.x)},${Math.round(box.y)} op=${getComputedStyle(el.closest('.fixed')).opacity}` : 'none';
    });
    console.log(y, p);
  }
}
await page.waitForTimeout(2500);
await ctx.close();
await browser.close();
const v = readdirSync(dir).find((f) => f.endsWith('.webm'));
renameSync(`${dir}/${v}`, out);
rmSync(dir, { recursive: true });
