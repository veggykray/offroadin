// usage: node tools/showcase.mjs <outdir> '<json list of scenes>'
// scene: { id, mission, at: [x,y] | struct key | landmark kind, units: [keys], dx, dy }
// Teleports near the target, spawns the listed units around the craft (passive),
// and screenshots the frame with the atmosphere forced on.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [,, out, scenesJson] = process.argv;
const scenes = JSON.parse(scenesJson);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto((process.env.BASE || 'http://127.0.0.1:8766/') + 'index.html?atm=1'); await p.waitForTimeout(1200);
for (const sc of scenes) {
  await p.evaluate((m) => { AS.App.endGame(); AS.App.startMission(m, { god: true }); }, sc.mission);
  await p.waitForTimeout(900);
  const where = await p.evaluate((sc) => {
    const g = AS.game; let x, y;
    if (sc.boss && g.bossList && g.bossList[0]) { const b = g.bossList[0]; if (b.bossAct) b.bossAct('activate'); x = b.x; y = b.y - 40; }
    else if (Array.isArray(sc.at)) [x, y] = sc.at;
    else if (sc.at) {
      const s = g.structures.find((q) => q.kind === sc.at || q.def === AS.Data.structures[sc.at]) || (g.landmarks || []).find((l) => l.kind === sc.at);
      if (s) { x = s.x; y = s.y; }
    }
    if (x === undefined) { x = g.mission.start.x; y = g.mission.start.y - 300; }
    x += sc.dx || 0; y += sc.dy || 0;
    AS.Debug.tp(x, y + (sc.near || 110));
    for (const u of g.units) if (Math.hypot(u.x - x, u.y - y) < 700) { u.alerted = false; u.target = null; }
    (sc.units || []).forEach((k, i) => {
      const a = (i / Math.max(1, sc.units.length)) * Math.PI * 2, r = 120 + (i % 2) * 40;
      const u = g.spawnUnit(k, x + Math.cos(a) * r, y + 110 + Math.sin(a) * r * 0.7, {});
      if (u) { u.alerted = false; u.passive = true; u.sight = 0; u.def = Object.assign({}, u.def, { sight: 0 }); }
    });
    g.msgs.length = 0; g.subtitle = null;
    return [x, y];
  }, sc);
  await p.waitForTimeout(sc.wait || 1500);
  await p.screenshot({ path: `${out}/${sc.id}.png` });
}
console.log(errs.slice(0, 10).join('\n') || 'no errors'); await b.close();
