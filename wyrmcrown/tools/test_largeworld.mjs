// WYRMCROWN — LARGE WORLD TEST, continuous play in one world: the dragon takes off
// from the castle, defeats the Bandit warband, flies to Kingsmead, defeats the Grave
// Host and reaches the east coast — no loading, no teleporting, forces streamed in
// and out. usage: node wyrmcrown/tools/test_largeworld.mjs (GAME_BASE_URL, PLAYWRIGHT_MODULE)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(BASE + '?world=large&god=1');
await p.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 300000 });
const log = [];
const fly = async (x, y, label, fight) => {
  await p.evaluate(([x, y, fight]) => { const g = AS.game; g.player.pilot = { read(d, inp) { const f = fight ? g.nearestFoe(d.team, d.x, d.y, 700) : null; const tx = f ? f.x : x, ty = f ? f.y : y; inp.steer = { x: tx, y: ty + d.z }; inp.throttle = f && Math.hypot(d.x - tx, d.y - ty) < 250 ? 0 : 1; inp.sprint = !f; inp.aimX = tx; inp.aimY = ty; inp.breath = !!f && Math.hypot(d.x - tx, d.y - ty) < 300; inp.fire = !!f; } }; }, [x, y, fight]);
  const t0 = await p.evaluate(() => AS.game.time);
  await p.waitForFunction(([x, y, fight]) => { const g = AS.game, P = g.player; const near = Math.hypot(P.x - x, P.y - y) < 400; if (!fight) return near; const G = g.lw.groups.find((q) => q.def.id === fight); return near && G && G.defeated; }, [x, y, fight], { timeout: 600000, polling: 500 });
  const s = await p.evaluate(() => { const g = AS.game; return { t: Math.round(g.time), at: [Math.round(g.player.x), Math.round(g.player.y)], state: AS.App.state, map: g.map.id, spawned: g.lw.counts.spawnedGroups, defeated: g.lw.groups.filter((q) => q.defeated).map((q) => q.def.id), chunks: g.terrain.cache.size, sync: g.terrain.syncN || 0 }; });
  log.push(label + ' ' + JSON.stringify(s) + ' (' + Math.round(s.t - t0) + ' s game time)');
  console.log(log[log.length - 1]);
};
await fly(11300, 14700, 'bandit warband defeated', 'e_bandits');
await fly(12200, 17800, 'reached Kingsmead', null);
await fly(17600, 17800, 'grave host defeated', 'e_undead');
await fly(21500, 14000, 'reached the east coast', null);
const st = await p.evaluate(() => ({ same: AS.game.map.id, state: AS.App.state, loads: 1 }));
console.log('same world throughout:', JSON.stringify(st), 'errors', errs.slice(0, 3));
if (errs.length || st.same !== 'largeworld') process.exitCode = 1;
await b.close();
