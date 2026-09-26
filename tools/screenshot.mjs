// Drives the real browser build with Playwright and saves screenshots to tools/out/.
// Usage: node tools/screenshot.mjs [url] [scenario]
import { createRequire } from 'node:module';
// Uses a globally installed Playwright (not a project dependency).
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://localhost:5173/';
const scenario = process.argv[3] ?? 'basic';
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.game && window.game.stats.frames > 5, null, { timeout: 60000 });
const shot = async (name) => { await page.screenshot({ path: `tools/out/${name}.png` }); console.log('saved', name); };
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
if (scenario === 'basic') {
  await shot('01-grid');
  await page.waitForTimeout(3500);
  await hold(['KeyW'], 2500);
  await shot('02-start');
  await hold(['KeyW', 'KeyA'], 900);
  await hold(['KeyW'], 1500);
  await shot('03-corner1');
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(1500);
  await shot('04-overview');
} else if (scenario === 'bridge') {
  // Teleport the player just before the bridge and take a close look.
  await page.waitForTimeout(3600);
  await page.evaluate(() => {
    const g = window.game, sim = g.sim, sc = sim.track.shortcut;
    const s = sc.node('bridgeApproach') - 14; const p = sc.sampleAt(s);
    const v = sim.vehicles[sim.playerIndex];
    const q = v.quat.clone().setFromAxisAngle({ x: 0, y: 1, z: 0, isVector3: true }, Math.atan2(p.tx, p.tz));
    v.teleport({ x: p.x, y: p.y + 1.2, z: p.z, isVector3: true }, q, 14);
    sim.race.racers[sim.playerIndex].tracker.snap(p.x, p.z);
    g.raceCam.mode = 'near';
  });
  await hold(['KeyW'], 1200);
  await shot('bridge-1');
  await hold(['KeyW'], 1000);
  await shot('bridge-2');
} else if (scenario === 'overview') {
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(8000);
  await shot('overview');
} else if (scenario === 'demo') {
  await page.waitForTimeout(12000);
  await shot('demo-1');
  await page.waitForTimeout(8000);
  await shot('demo-2');
  await page.keyboard.press('Backquote');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(6000);
  await shot('demo-3-debug');
}
const stats = await page.evaluate(() => ({ ...window.game.stats, t: window.game.sim.time }));
console.log('stats', JSON.stringify(stats));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
