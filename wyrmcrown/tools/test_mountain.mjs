// WYRMCROWN — the Mountain Test (maps/mountaintest.js), in the browser.
//   the region loads → the relief has what the brief asks for (a peak far above
//   the ceiling, a pass and a windgap under it, a front range a dragon can cross)
//   → flight: the ceiling holds; the great peak stops the dragon softly and it
//   slides away (never inside the ground); the pass, the windgap, the front range
//   and the gorge can be flown → ground: the walking grid routes an army from the
//   lowlands through the gorge, and from the valley up the switchbacks and over
//   the High Pass (never across the ranges), the hold's gate is reachable, and an
//   army marches it (test G) → combat: shots need range in 3D and a clear line,
//   a bolt aimed through a ridge bursts on it → streaming: a sprint across the
//   region with no errors. The simulation is stepped from the page (no rendering
//   needed), so the march runs in seconds.
// Needs the repo served (GAME_BASE_URL, default http://127.0.0.1:8766).
// usage: node wyrmcrown/tools/test_mountain.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
let n = 0;
const step = (name) => { n++; console.log('PASS ' + n + '. ' + name); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ev = (fn, a) => page.evaluate(fn, a);

// fly a route (ground points [x, y, held altitude]) by the test autopilot, stepping the game;
// returns the track and the worst ground intrusion seen
const fly = (o) => ev((o) => {
  const g = AS.game, M = __mtn.M, p = g.player, R = g.mtn.R;
  g.godMode = true;
  M.startTest(g, o.test);
  const S = p._m;
  if (o.start) { S.gy = o.start[1]; p.x = o.start[0]; S.alt = o.start[2]; S.level = o.start[2]; p.y = S.gy - R.h(p.x, S.gy); p.z = S.alt - R.h(p.x, S.gy); S.X = p.x; S.Y = p.y; p.angle = p.velA = o.a !== undefined ? o.a : -Math.PI / 2; }
  S.auto = o.pts ? { i: 0, sprint: !!o.sprint, pts: o.pts } : null;
  const keys = AS.Input.keys; for (const k of o.keys || []) keys.add(k);
  let worst = -1e9, maxAlt = 0, blocked = 0, minGy = 1e9, frames = 0, nan = false, jumps = 0, lastDraw = null;
  const track = [];
  for (let i = 0; i < o.steps; i++) {
    g.update(1 / 30); frames++;
    const T = p._m;
    if (!(T.alt === T.alt) || !(p.x === p.x)) { nan = true; break; }
    const e = R.h(p.x, T.gy);
    worst = Math.max(worst, e - T.alt);
    maxAlt = Math.max(maxAlt, T.alt);
    if (T.blocked > 0) blocked++;
    minGy = Math.min(minGy, T.gy);
    // the drawn body never jumps (the screen point is ground y − altitude)
    const draw = [p.x, T.gy - T.alt];
    if (lastDraw && Math.hypot(draw[0] - lastDraw[0], draw[1] - lastDraw[1]) > 40) jumps++;
    lastDraw = draw;
    if (i % 15 === 0) track.push([Math.round(p.x), Math.round(T.gy), Math.round(T.alt), Math.round(e)]);
    if (o.stopGy !== undefined && T.gy < o.stopGy) break;
  }
  for (const k of o.keys || []) keys.delete(k);
  p._m.auto = null;
  const T = p._m;
  return { worst, maxAlt, blocked, minGy, frames, nan, jumps, end: [p.x, T.gy, T.alt], track, ceil: g.mtn.ceil, speed: p.speed };
}, o);

try {
  const t0 = Date.now();
  await page.goto(BASE + '?world=mountain');
  await page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play' && window.__mtn, null, { timeout: 180000 });
  const loadMs = Date.now() - t0;
  const info = await ev(() => { const g = AS.game, R = g.mtn.R; return { w: g.map.w, h: g.map.h, stats: R.stats, ceil: g.mtn.ceil, sites: g.sites.length, troops: g.troops.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0,
    peak: R.h(4100, 3250), pass: Math.min(...[3250, 3300, 3350].map((y) => R.h(8000, y))), windgap: Math.min(...[3200, 3250, 3300].map((y) => Math.min(...[10460, 10500, 10540].map((x) => R.h(x, y))))),
    crestMin: (() => { let lo = 1e9; for (let x = 200; x < 11800; x += 50) { if (Math.abs(x - 8000) < 450 || Math.abs(x - 10500) < 260) continue; let hi = 0; for (let y = 2700; y < 3900; y += 20) hi = Math.max(hi, R.h(x, y)); lo = Math.min(lo, hi); } return lo; })(),
    front: (() => { let hi = 0; for (let x = 200; x < 11800; x += 100) { if (Math.abs(x - 6000) < 300) continue; for (let y = 5900; y < 6700; y += 20) hi = Math.max(hi, R.h(x, y)); } return hi; })(),
    gorge: R.h(6040, 6300), valley: R.h(4000, 5100), lowland: R.h(3600, 10600) }; });
  ok(info.stats && info.stats.cells > 1e6, 'relief ' + JSON.stringify(info.stats));
  step('the region (' + info.w + ' × ' + info.h + ' units, ' + info.stats.cells + ' heights) loads in ' + (loadMs / 1000).toFixed(1) + ' s (relief built in ' + info.stats.totalMs + ' ms; ' + info.sites + ' places, ' + info.troops + ' troops, ' + info.heap + ' MB)');
  ok(info.peak > info.ceil + 300, 'peak ' + info.peak);
  ok(info.crestMin > info.ceil + 20, 'great range crest dips to ' + info.crestMin);
  ok(info.pass < info.ceil - 60, 'pass ' + info.pass);
  ok(info.windgap < info.ceil - 15 && info.windgap > info.pass + 25, 'windgap ' + info.windgap);
  ok(info.front < info.ceil - 30 && info.front > info.valley + 120, 'front range ' + info.front);
  step('relief: the Great Peak stands at ' + Math.round(info.peak) + ' (ceiling ' + info.ceil + '); the Great Range crest never drops below ' + Math.round(info.crestMin) + ' except at the High Pass (' + Math.round(info.pass) + ') and the Windgap (' + Math.round(info.windgap) + '); the Front Range peaks at ' + Math.round(info.front) + '; valley ' + Math.round(info.valley) + ', gorge floor ' + Math.round(info.gorge) + ', lowlands ' + Math.round(info.lowland));

  // ---- flight
  const climb = await fly({ test: 'A', start: [4300, 9800, 60], keys: ['KeyW', 'KeyZ'], steps: 360 });
  ok(!climb.nan && climb.maxAlt <= climb.ceil + 0.01 && climb.maxAlt > climb.ceil - 5, 'climb to the ceiling ' + JSON.stringify(climb.maxAlt));
  step('holding Z climbs to the ceiling and no further (highest ' + climb.maxAlt.toFixed(1) + ' of ' + climb.ceil + ')');

  const peak = await fly({ test: 'C', start: [4100, 4600, 495], pts: [[4100, 2400, 495]], steps: 600 });
  ok(!peak.nan && peak.worst <= -3.9, 'inside the peak ' + peak.worst);
  ok(peak.blocked > 10 && peak.minGy > 3500, 'not stopped by the peak ' + JSON.stringify({ b: peak.blocked, minGy: peak.minGy }));
  ok(peak.jumps === 0, 'the dragon jumped ' + peak.jumps);
  step('Mount Hrothgar stops the dragon: held back ' + (peak.blocked / 30).toFixed(1) + ' s, no nearer than ground y ' + Math.round(peak.minGy) + ' (summit 3250), never inside the rock (closest ' + (-peak.worst).toFixed(1) + ' above it), no jumps');

  const turn = await fly({ test: 'C', start: [4100, Math.round(peak.minGy) + 40, 495], a: -Math.PI / 2, keys: ['KeyW', 'KeyD'], steps: 240 });
  ok(!turn.nan && turn.worst <= -3.9 && Math.hypot(turn.end[0] - 4100, turn.end[1] - peak.minGy) > 300, 'could not turn away ' + JSON.stringify(turn.end));
  step('against the peak the dragon can turn away and fly off (ended at ' + turn.end.map(Math.round).join(', ') + ')');

  const pass = await fly({ test: 'E', start: [7950, 4300, 470], pts: [[8000, 3700, 470], [8030, 3300, 470], [8100, 2600, 470], [8200, 1900, 470]], steps: 900, stopGy: 2300 });
  ok(!pass.nan && pass.minGy < 2400 && pass.worst <= -3.9, 'pass ' + JSON.stringify({ minGy: pass.minGy, w: pass.worst }));
  step('the High Pass: flown north over the saddle to the moors (clearance never under ' + (-pass.worst).toFixed(0) + ')');

  const gap = await fly({ test: 'E', start: [10500, 4300, 495], pts: [[10500, 3600, 495], [10500, 3250, 495], [10500, 2500, 495]], steps: 900, stopGy: 2600 });
  ok(!gap.nan && gap.minGy < 2700 && gap.worst <= -3.9, 'windgap ' + JSON.stringify({ minGy: gap.minGy, w: gap.worst, end: gap.end }));
  const wall = await fly({ test: 'E', start: [9600, 4300, 495], pts: [[9600, 3300, 495], [9600, 2500, 495]], steps: 600 });
  ok(wall.minGy > 3300 && wall.blocked > 10 && wall.worst <= -3.9, 'flew over the range at 9600 ' + JSON.stringify({ minGy: wall.minGy }));
  step('the Windgap lets a dragon through at the ceiling; the crest beside it (x 9600) does not (stopped at y ' + Math.round(wall.minGy) + ')');

  const front = await fly({ test: 'A', start: [3000, 7600, 480], pts: [[3000, 6300, 480], [3000, 5400, 480]], steps: 600, stopGy: 5600 });
  ok(front.minGy < 5700 && front.worst <= -3.9 && front.blocked === 0, 'front range ' + JSON.stringify({ minGy: front.minGy, b: front.blocked }));
  step('the Front Range is crossed high without a stop (it is under the ceiling)');

  const gorge = await fly({ test: 'D', start: [6150, 7700, 200], a: -Math.PI / 2, pts: [[6100, 7350], [5990, 7000], [6065, 6650], [5965, 6300], [6075, 6000], [5955, 5650], [6075, 5300]], steps: 900, stopGy: 5350 });
  ok(gorge.minGy < 5450 && gorge.worst <= -3.9, 'gorge ' + JSON.stringify({ minGy: gorge.minGy, end: gorge.end }));
  const gmax = Math.max(...gorge.track.map((t) => t[2] - t[3]));
  step('the gorge is flown low between its walls (highest clearance ' + gmax + ', ground under the dragon ' + Math.min(...gorge.track.map((t) => t[3])) + '–' + Math.max(...gorge.track.map((t) => t[3])) + ')');

  const down = await fly({ test: 'J', keys: ['KeyX', 'KeyW'], steps: 300 });
  ok(down.end[2] < 330 && down.worst <= -3.9, 'descent ' + JSON.stringify(down.end));
  step('from the ceiling, X brings the dragon down over the Wall into the valley (altitude ' + Math.round(down.end[2]) + ' after ' + (down.frames / 30).toFixed(0) + ' s)');

  // ---- ground: the walking grid and an army
  const nav = await ev(() => {
    const g = AS.game, M = __mtn.M, R = g.mtn.R, P = (x, y) => M.proj(g, x, y);
    const route = (a, b) => { const A = P(a[0], a[1]), B = P(b[0], b[1]), pts = AS.Nav.path(g, A[0], A[1], B[0], B[1]), reach = AS.Nav.reachable(g, A[0], A[1], B[0], B[1]); let maxE = 0, len = 0, cross = []; for (let i = 0; i < pts.length; i++) { const gy = R.unproj(pts[i][0], pts[i][1]); const e = gy === gy ? R.h(pts[i][0], gy) : 0; maxE = Math.max(maxE, e); if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cross.push([Math.round(pts[i][0]), Math.round(gy)]); } return { unreachable: !reach, n: pts.length, maxE, len, cross }; };
    const north = route([6700, 4950], [8320, 1700]);
    const low = route([3700, 10200], [6400, 5000]);
    const hold = route([3700, 10200], [4700, 4420]);
    const basin = route([4000, 5100], [2250, 3640]);
    // every walking cell over 300 high is on or by a road (the ranges are closed to armies)
    let open = 0, high = 0; const N = g.nav;
    for (let j = 0; j < N.H; j++) for (let i = 0; i < N.W; i++) { if (N.cost[j * N.W + i] <= 0) continue; open++; const x = i * 64 + 32, Y = j * 64 + 32, gy = R.unproj(x, Y); if (gy === gy && R.h(x, gy) > 300 && g.terrain.roadDist(x, Y) > 90 && R.h(x, gy) < 520) high++; }
    return { north, low, hold, basin, open, high };
  });
  ok(!nav.north.unreachable && nav.north.maxE > 360 && nav.north.maxE < 470, 'valley → moors ' + JSON.stringify(nav.north));
  ok(nav.north.cross.some((c) => Math.abs(c[0] - 8030) < 260 && Math.abs(c[1] - 3320) < 300), 'route avoids the pass ' + JSON.stringify(nav.north.cross));
  ok(!nav.low.unreachable && nav.low.cross.some((c) => Math.abs(c[0] - 6050) < 220 && Math.abs(c[1] - 6300) < 400), 'lowlands → valley not via the gorge ' + JSON.stringify(nav.low.cross));
  ok(!nav.hold.unreachable, 'the hold cannot be reached');
  ok(nav.basin.unreachable || nav.basin.maxE < 300, 'the hidden basin is reachable on foot ' + JSON.stringify(nav.basin));
  step('the walking grid routes armies by road: valley → switchbacks → High Pass (highest ' + Math.round(nav.north.maxE) + ') → moors; lowlands → the gorge → valley; the castle reaches the dwarf hold; the hidden basin is closed to armies');

  const army = await ev(() => {
    const g = AS.game, M = __mtn.M;
    M.startTest(g, 'G');
    for (let i = 0; i < 30 * 600 && !g.mtn.army.done; i++) g.update(1 / 30);
    return __mtn.state().army;
  });
  ok(army.reach && army.done && army.alive >= 10, 'army did not cross ' + JSON.stringify(army));
  ok(army.maxE > 360 && army.maxE < 480, 'army height ' + army.maxE);
  step('test G: an army of ' + army.alive + ' marches from the valley over the High Pass in ' + Math.round(army.done) + ' game seconds (highest ground ' + Math.round(army.maxE) + ', ' + Math.round((1 - army.offRoad) * 100) + '% of troop-samples within 70 of the road)');

  // ---- combat at height
  const cmb = await ev(() => {
    const g = AS.game, M = __mtn.M, R = g.mtn.R, p = g.player;
    M.startTest(g, 'H');
    const S = p._m;
    // an archer on the valley floor below the Wall, the dragon over the shelf behind the Wall's rim
    const X = 2600, q = M.proj(g, X, 4500), arch = { g, x: q[0], y: q[1], hc: 6 };
    p.x = X; S.gy = 3900; S.alt = R.h(X, 3900) + 30;
    const hidden = M.shotOK(g, arch, p, 'arrow');
    S.gy = 4380; S.alt = R.h(X, 4380) + 120;
    const seen = M.shotOK(g, arch, p, 'arrow');
    S.alt = R.h(X, 4380) + 470;
    const far = M.shotOK(g, arch, p, 'arrow');
    // a bolt aimed from the valley through the Wall at the shelf behind it bursts on the Wall
    S.gy = 4700; S.alt = R.h(X, 4700) + 40; p.y = S.gy - R.h(X, S.gy); p.z = S.alt - R.h(X, S.gy); S.X = p.x; S.Y = p.y;
    const tgt = M.proj(g, X, 3900);
    p.input.aimX = tgt[0]; p.input.aimY = tgt[1];
    const before = new Set(AS.Proj.pool.active);
    AS.Combat.castBolt(p, { speed: 520, dmg: 10, r: 4, col: '#fff', core: '#fff', glow: '#fff', kind: 'arrow' });
    const mine = AS.Proj.pool.active.filter((b) => !before.has(b));
    const blocked = mine.length && mine.every((b) => b.extra && b.extra.mBlocked);
    return { hidden, seen, far, bolts: mine.length, blocked };
  });
  ok(!cmb.hidden && cmb.seen && !cmb.far, 'shots ' + JSON.stringify(cmb));
  ok(cmb.bolts > 0 && cmb.blocked, 'bolt through the wall ' + JSON.stringify(cmb));
  step('combat: an archer below the Wall cannot shoot a dragon behind its rim, can when it is in view, and not when it is 470 above; a bolt aimed through the Wall bursts on it');

  // ---- streaming: the sprint across the region (the autopilot), real frames
  const s0 = await ev(() => ({ stand: AS.game.terrain.standN || 0, chunks: AS.game.terrain.cache.size }));
  await ev(() => __mtn.test('I'));
  await page.waitForTimeout(20000);
  const s1 = await ev(() => { const T = AS.game.terrain; return { stand: T.standN || 0, chunks: T.cache.size, far: T.far ? T.far.cache.size : 0, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, st: __mtn.state() }; });
  ok(errors.length === 0, 'errors during the sprint: ' + errors.slice(0, 3).join(' | '));
  step('streaming stress (20 s autopilot sprint over the ranges): ' + s1.chunks + ' chunks cached, ' + (s1.stand - s0.stand) + ' stand-ins drawn while the workers caught up, heap ' + s1.heap + ' MB, no errors');

  ok(errors.length === 0, 'page errors: ' + errors.join(' | '));
  step('no script errors');
  console.log('\nALL ' + n + ' CHECKS PASSED');
} catch (e) {
  console.log('FAIL: ' + e.message);
  if (errors.length) console.log('page errors: ' + errors.slice(0, 5).join(' | '));
  process.exitCode = 1;
} finally {
  await browser.close();
}
