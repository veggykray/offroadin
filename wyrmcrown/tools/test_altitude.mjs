// WYRMCROWN — checks of the held altitude in every world (src/game/altitude.js):
// Z climbs and holds, the ceiling, X and SPACE bring the dragon down, the camera
// and the shadow follow the height, archers cannot reach a high dragon but a
// ballista can, the breath burns out from high up, an AI dragon climbs to a
// high foe, and the same keys work in the Large and Huge Worlds.
// Needs the repo served at http://127.0.0.1:8766 (see test_game.mjs).
// usage: node wyrmcrown/tools/test_altitude.mjs [filter]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const filter = process.argv[2] || '';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
let pass = 0, fail = 0;

async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 120000 });
  await page.waitForTimeout(800);
  return page;
}
async function test(name, fn) {
  if (filter && !name.includes(filter)) return;
  const t0 = Date.now();
  let page = null;
  try {
    const msg = await fn((p) => (page = p));
    if (page && page.errors.length) throw new Error('page errors: ' + [...new Set(page.errors)].slice(0, 3).join(' | '));
    pass++; console.log('PASS ' + name + (msg ? ' — ' + msg : '') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  } catch (e) {
    fail++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]);
  }
  if (page) await page.close().catch(() => {});
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const play = async (page, secs) => {
  const t0 = await page.evaluate(() => AS.game.time);
  await page.waitForFunction(([t0, secs]) => AS.game.time >= t0 + secs, [t0, secs], { timeout: secs * 1000 * 30 + 15000, polling: 50 });
};
const P = (page) => ev(page, () => { const p = AS.game.player; return { z: p.z, hold: p.altHold == null ? null : p.altHold, v: p.speed }; });
const r = Math.round;

await test('Z climbs and holds the height; the ceiling stops it; X and SPACE bring it down', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const z0 = (await P(page)).z;
  await page.keyboard.down('KeyZ'); await play(page, 2.5); await page.keyboard.up('KeyZ');
  const a = await P(page);
  ok(a.z > 200 && a.hold !== null, 'Z climbs (' + r(z0) + ' → ' + r(a.z) + ')');
  await play(page, 2.5);
  const b = await P(page);
  ok(Math.abs(b.z - a.hold) < 25 && b.v > 100, 'the height is held after Z is let go (held ' + r(a.hold) + ', at ' + r(b.z) + ', speed ' + r(b.v) + ')');
  await page.keyboard.down('KeyZ'); await play(page, 5); await page.keyboard.up('KeyZ');
  await play(page, 1);
  const c = await P(page);
  ok(c.z <= 500.5 && c.z > 470, 'the ceiling stops the climb at 500 (' + r(c.z) + ')');
  await page.keyboard.down('KeyX'); await play(page, 1.5); await page.keyboard.up('KeyX');
  const d = await P(page);
  ok(d.z < c.z - 120, 'X descends (' + r(c.z) + ' → ' + r(d.z) + ')');
  await page.keyboard.down('Space'); await play(page, 2.5); await page.keyboard.up('Space');
  await play(page, 2.5);
  const e = await P(page);
  ok(e.hold === null && e.z < 90, 'SPACE drops it back into the usual flying band and the automatic height takes over (' + r(e.z) + ')');
  return 'up to ' + r(a.z) + ' in 2.5 s, ceiling ' + r(c.z) + ', back to ' + r(e.z);
});

await test('the camera and the shadow follow the height', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const low = await ev(page, () => { const g = AS.game, p = g.player; return { lift: g.camLift || 0, zoom: g.camZoom || 1, sh: AS.Altitude.shadowLook(p, p.z) }; });
  await page.keyboard.down('KeyZ'); await play(page, 5); await page.keyboard.up('KeyZ'); await play(page, 2.5);
  const hi = await ev(page, () => {
    const g = AS.game, p = g.player, R = AS.Renderer, s = R.worldToScreen(p.x, p.y, g.camera);
    return { z: p.z, lift: g.camLift, zoom: g.camZoom, sh: AS.Altitude.shadowLook(p, p.z), gy: s.y / R.dpr, H: R.canvas.height / R.dpr, show: g.alt.show };
  });
  ok(hi.lift > 120 && hi.zoom < 0.92, 'the view slides down and widens (lift ' + r(hi.lift) + ', zoom ' + hi.zoom.toFixed(2) + ')');
  ok(hi.gy > 0 && hi.gy < hi.H, 'the ground under the dragon is on screen (' + r(hi.gy) + ' of ' + r(hi.H) + ')');
  ok(hi.sh.scale > low.sh.scale + 0.5 && hi.sh.alpha < low.sh.alpha * 0.5 && hi.sh.soft > 5, 'the shadow is larger, fainter and softer high up');
  ok(hi.show > 0.9, 'the altitude gauge shows');
  return 'at ' + r(hi.z) + ': shadow ×' + hi.sh.scale.toFixed(2) + ' darkness ' + hi.sh.alpha.toFixed(2) + ' blur ' + hi.sh.soft.toFixed(1) + ' (low ×' + low.sh.scale.toFixed(2) + ' darkness ' + low.sh.alpha.toFixed(2) + ')';
});

await test('weapons at height: bows fall short, a ballista reaches, the breath burns out', async (keep) => {
  const page = keep(await open('?map=sundered'));
  const res = await ev(page, () => {
    const g = AS.game, p = g.player, C = AS.Combat, act = AS.Proj.pool.active;
    AS.Debug.hold(true);
    const foe = g.troops.find((t) => t.alive && g.hostile(g.playerKey, t.team)) || { g, team: g.factionList.find((F) => F.key !== g.playerKey).key };
    const src = { g, x: p.x + 60, y: p.y + 40, team: foe.team, hc: 10 };
    const fire = (z, kind) => { p.z = z; const n = act.length; C.shoot(src, p, kind); return act.length - n; };
    const out = { arrowLow: fire(62, 'arrow'), arrowHigh: fire(450, 'arrow'), ballistaHigh: fire(450, 'ballista') };
    p.z = 62; const bl = C.breathInfo(p); p.z = 450; for (const n of p.nodes) n.z = 450; const bh = C.breathInfo(p);
    const ahead = (bi) => C.inCone(bi, bi.mx + Math.cos(bi.a) * bi.L * 0.7, bi.my + Math.sin(bi.a) * bi.L * 0.7, 0, 8);
    out.breathLow = ahead(bl); out.breathHigh = ahead(bh); out.high = bh.high;
    return out;
  });
  ok(res.arrowLow === 1, 'an archer shoots at a low dragon');
  ok(res.arrowHigh === 0, 'an archer does not shoot at a dragon 450 up');
  ok(res.ballistaHigh === 1, 'a ballista still shoots at it');
  ok(res.breathLow && !res.breathHigh && res.high, 'the breath reaches the ground low down, not from 450 up');
  // and a ballista bolt actually strikes the high dragon (it is hit where it is drawn, far above its ground spot)
  const hit = await ev(page, async () => {
    const g = AS.game, p = g.player;
    AS.Debug.tp(3200, 6400, 450); // (open ground: nothing between the ballista and the dragon)
    const hp0 = p.hp;
    const src = { g, x: p.x + 40, y: p.y + 60, team: g.factionList.find((F) => F.key !== g.playerKey).key, hc: 10 };
    p.z = 450; for (const n of p.nodes) n.z = 450;
    AS.Debug.hold(false); const hx = p.x, hy = p.y;
    p.pilot = { read(d, inp) { inp.throttle = -1; inp.turn = 0; d.x = hx; d.y = hy; d.z = 450; d.altHold = 450; d.speed = 40; } };
    AS.Combat.shoot(src, p, 'ballista');
    const t0 = g.time; await new Promise((res) => { const f = () => (g.time > t0 + 1.2 ? res() : setTimeout(f, 30)); f(); });
    return [hp0, p.hp];
  });
  ok(hit[1] < hit[0], 'a ballista bolt hits the dragon 450 up (' + hit.map(r) + ')');
  return 'ballista hit for ' + r(hit[0] - hit[1]);
});

await test('an AI dragon climbs to meet a high foe', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const z = await ev(page, async () => {
    const g = AS.game, rv = g.dragons.find((d) => !d.isPlayer && d.pilot);
    const read = rv.pilot.read.bind(rv.pilot);
    rv.pilot.read = (d, inp, dt) => { read(d, inp, dt); inp.holdZ = 380; };
    const t0 = g.time; await new Promise((res) => { const f = () => (g.time > t0 + 6 ? res() : setTimeout(f, 30)); f(); });
    const zUp = rv.z;
    rv.pilot.read = read;
    const t1 = g.time; await new Promise((res) => { const f = () => (g.time > t1 + 5 ? res() : setTimeout(f, 30)); f(); });
    return [zUp, rv.z, rv.altHold == null];
  });
  ok(z[0] > 300, 'it climbs to the foe\'s height (' + r(z[0]) + ')');
  ok(z[1] < 120 && z[2], 'and comes back down when the fight is over (' + r(z[1]) + ')');
  return 'up to ' + r(z[0]) + ', back to ' + r(z[1]);
});

for (const [name, q] of [['Large World', '?world=large&god=1'], ['Huge World', '?world=huge&god=1']]) {
  await test('the same keys in the ' + name, async (keep) => {
    const page = keep(await open(q));
    await page.keyboard.down('KeyZ'); await play(page, 3); await page.keyboard.up('KeyZ');
    const a = await P(page);
    ok(a.z > 250 && a.hold !== null, 'Z climbs (' + r(a.z) + ')');
    await page.keyboard.down('KeyX'); await page.keyboard.down('Space'); await play(page, 3); await page.keyboard.up('KeyX'); await page.keyboard.up('Space');
    await play(page, 2);
    const b = await P(page);
    ok(b.z < 90, 'and comes down again (' + r(b.z) + ')');
    return 'up to ' + r(a.z) + ', down to ' + r(b.z);
  });
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
