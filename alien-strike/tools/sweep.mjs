// Quick regression sweep: load every mission, fly + fire for a moment, report errors.
// usage: node tools/sweep.mjs [baseUrl] [ms-per-mission] [onlyIds,comma]   (SHOTS=dir for screenshots)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8766/';
const MS = +(process.argv[3] || 2500);
const ONLY = (process.argv[4] || '').split(',').filter(Boolean);
const SHOTS = process.env.SHOTS || '';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
let errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
p.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
await p.goto(BASE + 'index.html'); await p.waitForTimeout(1500);
const ids = ONLY.length ? ONLY : await p.evaluate(() => AS.Levels.ordered().map((m) => m.id));
let bad = 0;
for (const id of ids) {
  errs = [];
  await p.evaluate((id) => { AS.App.endGame(); AS.App.startMission(id, { god: true }); }, id);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) { if (await p.evaluate(() => AS.App.state === 'play' && !!AS.game)) break; await p.waitForTimeout(200); }
  const load = Date.now() - t0;
  await p.mouse.move(900, 300);
  await p.keyboard.down('KeyW'); await p.mouse.down();
  await p.waitForTimeout(MS);
  await p.keyboard.up('KeyW'); await p.mouse.up();
  const st = await p.evaluate(() => ({ t: +AS.game.time.toFixed(1), fps: AS.App.fps | 0, ms: +AS.App.frameMs.toFixed(1), units: AS.game.units.length }));
  if (SHOTS) await p.screenshot({ path: SHOTS + '_' + id + '.png' });
  const ok = !errs.length;
  if (!ok) bad++;
  console.log((ok ? 'OK  ' : 'ERR ') + id + ' load ' + load + 'ms ' + JSON.stringify(st) + (ok ? '' : '\n   ' + errs.slice(0, 4).join('\n   ')));
}
console.log(bad ? bad + ' mission(s) with errors' : 'all missions clean');
await b.close();
process.exit(bad ? 1 : 0);
