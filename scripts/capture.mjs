// Captures real screenshots of project sites. Usage: node scripts/capture.mjs id=url [id=url...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const targets = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; });
const browser = await chromium.launch();
for (const [id, url] of targets) {
  const dir = `public/projects/${id}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (e) { console.log(id, 'load warn', e.message.split('\n')[0]); }
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${dir}/desktop.png` });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let i = 1; i <= 3 && i * 900 < h - 200; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${dir}/scroll-${i}.png` });
  }
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const mp = await m.newPage();
  try { await mp.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch {}
  await mp.waitForTimeout(4500);
  await mp.screenshot({ path: `${dir}/mobile.png` });
  await ctx.close(); await m.close();
  console.log('captured', id, 'height', h);
}
await browser.close();
