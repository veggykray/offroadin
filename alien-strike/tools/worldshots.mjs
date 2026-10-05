// usage: node tools/worldshots.mjs <outdir> [ids,comma] [dx] [dy]
// One screenshot per mission (atmosphere forced on), a little way from the start.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, out, only = 'w1m1,w2m1,w3m1,w4m1,w5m1,w6m1,w7m1,w8m1,w9m1,w10m1', DX = '0', DY = '-500'] = process.argv;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8766/index.html?atm=1'); await p.waitForTimeout(1200);
for (const id of only.split(',')) {
  await p.evaluate(([id, dx, dy]) => { AS.App.endGame(); AS.App.startMission(id, { god: true }); }, [id, +DX, +DY]);
  await p.waitForTimeout(900);
  await p.evaluate(([dx, dy]) => { const g = AS.game, s = g.mission.start; AS.Debug.tp(s.x + dx, s.y + dy); g.msgs.length = 0; }, [+DX, +DY]);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}/${id}.png` });
}
console.log(errs.join('\n') || 'no errors'); await b.close();
