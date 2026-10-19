// Quick look: launch dist/ in headless Chromium, run optional actions, save screenshots.
// usage: node tools/shot.mjs [--w 1280 --h 800] [--out tools/out/x.png] [--plain] [--wait 1500] [--eval "js"]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const W = +(args.w || 1280), H = +(args.h || 800);
mkdirSync('tools/out', { recursive: true });
const { url, close } = await serve('dist');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto(url + '/index.html' + (args.dev ? '?dev=1' : ''));
await page.waitForFunction(() => !!window.__elsewhere);
await page.click('#play');
if (args.plain) await page.evaluate(() => window.__elsewhere.setPlain(true));
if (args.eval) await page.evaluate(args.eval);
await page.waitForTimeout(+(args.wait || 1500));
await page.screenshot({ path: args.out || 'tools/out/shot.png' });
const stats = await page.evaluate(() => window.__elsewhere.stats());
console.log(JSON.stringify({ stats, errors }, null, 1));
await browser.close(); close();
