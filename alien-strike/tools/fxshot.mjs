// usage: node tools/fxshot.mjs <outdir> [mission] [x] [y]
// Live combat capture: spawns hostiles near the craft, holds fire, and shoots a
// sequence of frames (muzzle flashes, projectiles, explosions, smoke).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, out, mission = 'w1m1', X = '3000', Y = '4600'] = process.argv;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:8766/index.html'); await p.waitForTimeout(1200);
await p.evaluate(([m, x, y]) => { AS.App.startMission(m, { god: true }); }, [mission, +X, +Y]);
await p.waitForTimeout(1200);
await p.evaluate(([x, y]) => {
  const g = AS.App.game; AS.Debug.tp(x, y);
  for (const k of ['skitter', 'skitter', 'shardback', 'sentry']) { const u = g.spawnUnit(k, x + 120 + Math.random() * 160, y - 160 - Math.random() * 120, {}); u.alerted = true; u.target = g.player; }
}, [+X, +Y]);
await p.waitForTimeout(900);
await p.mouse.move(900, 230);
await p.mouse.down();
for (let i = 0; i < 4; i++) { await p.waitForTimeout(260); await p.screenshot({ path: `${out}/fire_${i}.png` }); }
await p.mouse.up();
await p.evaluate(([x, y]) => { AS.FX.explosion(x - 120, y - 40, 4, 22); AS.FX.explosion(x + 140, y + 40, 4, 12); }, [+X, +Y]);
for (const t of [60, 180, 500, 1100]) { await p.waitForTimeout(t === 60 ? 60 : t - 60); await p.screenshot({ path: `${out}/boom_${t}.png` }); }
console.log(errs.join('\n') || 'no errors');
await b.close();
