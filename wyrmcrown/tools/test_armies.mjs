// WYRMCROWN — checks of independent armies and commanders in the ARMY COMMAND TEST
// (src/game/armies.js, routes.js, autoresolve.js, armytest.js, maps/armytest.js):
// the scenario, commander rules, route restrictions, the tunnel, auto-resolve,
// commander defeat, off-field movement, troop conservation, save and load.
// Needs the repo served at http://127.0.0.1:8766 (see test_game.mjs).
// usage: node wyrmcrown/tools/test_armies.mjs [filter]
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
  await page.evaluate(() => {
    // helpers: send the dragon (and the view) far away; run the army clock in fixed steps
    window.T = {
      g: () => AS.game,
      away(x, y) { const g = AS.game, p = g.player; p.x = x || 8800; p.y = y || 700; p.z = 110; for (const n of p.nodes) { n.x = p.x; n.y = p.y; n.z = p.z; } p.layoutRig(0, true); g.camera.snap(p.x, p.y - p.z); },
      ff(secs) { const g = AS.game; for (let t = 0; t < secs; t += AS.Armies.STEP) AS.Armies.update(g, AS.Armies.STEP); },
      a(id) { return AS.game.armies.byId[id]; },
      n(id) { return AS.Armies.count(AS.game.armies.byId[id]); },
      // every soldier of the player's armies in the realm right now, by army
      onField() { const o = {}; for (const u of AS.game.troops) if (u.alive && !u.removed && u.armyId) o[u.armyId] = (o[u.armyId] || 0) + 1; return o; },
      cmdrUnits() { const o = {}; for (const u of AS.game.troops) if (u.alive && !u.removed && u.cmdrOf) o[u.cmdrOf] = (o[u.cmdrOf] || 0) + 1; return o; },
    };
  });
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

await test('A. the scenario: two armies, two commanders, the wall, the pass, the tunnel, the fort', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, A = g.armies, T = g.terrain;
    const ridge = [[900, 3700], [2100, 3760], [3300, 3690], [6700, 3800], [7900, 3660]].map((q) => T.groundPassable(q[0], q[1]));
    const path = AS.Routes.walk(g, 2240, 6860, 5150, 2900);
    // where the walk crosses the line of the range
    let cross = null; for (let i = 1; i < path.length; i++) if ((path[i - 1][1] - 3720) * (path[i][1] - 3720) <= 0) { cross = path[i][0]; break; }
    return { armies: A.list.length, cmdrs: Object.keys(A.cmdrs).length, ridge, cross, guard: A.byId.guard.cmdr, red: A.byId.red.cmdr, sites: ['hollowford', 'gatewatch', 'blackthorn', 'delversdoor', 'hollowstair'].map((id) => !!g.byId.get(id)),
      hf: g.byId.get('hollowford').owner, gw: g.byId.get('gatewatch').guarded(), group: A.groups.gloomhost.stacks };
  });
  ok(r.armies === 3 && r.cmdrs === 2, 'three armies and two commanders (' + r.armies + ', ' + r.cmdrs + ')');
  ok(r.guard === 'k_osric' && r.red === null, 'King Osric leads the Hollowford Guard; Red Company has no commander');
  ok(r.ridge.every((v) => !v), 'the Greyspine cannot be walked (' + r.ridge + ')');
  ok(r.cross !== null && Math.abs(r.cross - 4950) < 600, 'the way north crosses the range at the pass (x ' + Math.round(r.cross) + ')');
  ok(r.sites.every(Boolean) && r.hf === 'human' && r.gw, 'the settlement, the guarded pass, the fort and the tunnel mouths exist');
  return 'walk north crosses at x ' + Math.round(r.cross) + '; Gloomvault: ' + JSON.stringify(r.group);
});

await test('B. commander rules: one army each, must meet, leadership, no expeditions without one', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, M = AS.Armies, out = {};
    out.marchNoCmdr = M.order(g, 'red', { type: 'march', x: 5000, y: 4400 });
    out.osricTwice = M.assign(g, 'k_osric', 'red');
    out.brannocFar = M.assign(g, 'c_brannoc', 'guard');
    out.brannocRed = M.assign(g, 'c_brannoc', 'red');
    out.brannocAgain = M.assign(g, 'c_brannoc', 'red');
    out.march = M.order(g, 'red', { type: 'march', x: 5000, y: 4400 });
    // leadership: a big army Brannoc cannot lead
    const big = M.create(g, { id: 'big', name: 'Big Host', stacks: { h_knight: 6 }, x: 2300, y: 6900 });
    out.leave = M.unassign(g, 'red'); // (at the castle: Brannoc waits there)
    out.lead = M.assign(g, 'c_brannoc', 'big');
    out.back = M.assign(g, 'c_brannoc', 'red');
    out.unassignField = M.unassign(g, 'guard'); // Hollowford is friendly: allowed
    out.osricFree = g.armies.cmdrs.k_osric.status;
    out.guardOrder = g.armies.byId.guard.order.type;
    out.reassign = M.assign(g, 'k_osric', 'guard');
    // the leading count
    const lead = {}; for (const a of g.armies.list) if (a.cmdr) lead[a.cmdr] = (lead[a.cmdr] || 0) + 1;
    out.lead1 = Object.values(lead).every((n) => n === 1);
    return out;
  });
  ok(!r.marchNoCmdr.ok, 'an army without a commander cannot march off (' + r.marchNoCmdr.reason + ')');
  ok(!r.osricTwice.ok, 'a commander cannot lead two armies (' + r.osricTwice.reason + ')');
  ok(!r.brannocFar.ok, 'a commander cannot take an army that already has one / is far (' + r.brannocFar.reason + ')');
  ok(r.brannocRed.ok && !r.brannocAgain.ok, 'Brannoc takes Red Company, once');
  ok(r.march.ok, 'with a commander, Red Company can march (' + (r.march.reason || '') + ')');
  ok(r.leave.ok && !r.lead.ok && /leadership/.test(r.lead.reason) && r.back.ok, 'leadership limits apply (' + r.lead.reason + ')');
  ok(r.unassignField.ok && r.osricFree === 'available' && r.guardOrder === 'defend', 'leaving the king at Hollowford keeps the Guard defending');
  ok(r.reassign.ok && r.lead1, 'the king takes the Guard back; every commander leads at most one army');
  return r.lead.reason;
});

await test('C. route restrictions: no sea without a ship, sealed roads stay sealed, no following underground', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, M = AS.Armies, out = {};
    M.assign(g, 'c_brannoc', 'red');
    out.sea = M.order(g, 'red', { type: 'march', x: 9050, y: 6950 });
    g.armies.byId.red.transport = ['ship'];
    out.seaShip = M.order(g, 'red', { type: 'march', x: 9050, y: 6950 });
    out.seaLegs = out.seaShip.ok ? g.armies.byId.red.plan.legs.map((L) => L.kind + (L.type ? ':' + L.type : '')) : null;
    g.armies.byId.red.transport = [];
    out.sealed = M.order(g, 'red', { type: 'enter', passage: 'kingsway' });
    out.under = M.order(g, 'red', { type: 'march', node: 'gloomvault' });
    out.underLegs = out.under.ok ? g.armies.byId.red.plan.legs.map((L) => L.kind + (L.type ? ':' + L.type : '')) : null;
    g.armies.flags.kingsroad_open = true;
    out.unsealed = M.order(g, 'red', { type: 'enter', passage: 'kingsway' });
    out.north = M.order(g, 'red', { type: 'march', x: 5150, y: 2900 });
    const L = g.armies.byId.red.plan.legs; out.northLegs = L.map((q) => q.kind);
    out.chokeNote = out.north.notes;
    return out;
  });
  ok(!r.sea.ok && /ship/.test(r.sea.reason), 'Gull Rock across the water needs a ship (' + r.sea.reason + ')');
  ok(r.seaShip.ok && r.seaLegs.includes('link:sea'), 'with a ship the sea crossing is a route (' + (r.seaLegs || r.seaShip.reason) + ')');
  ok(!r.sealed.ok && /sealed/.test(r.sealed.reason), 'the Old King\'s Road is sealed until its flag is set (' + r.sealed.reason + ')');
  ok(r.under.ok && r.underLegs.join() === 'walk,link:underground_entrance', 'the Gloomvault is reached on foot, then down the entrance (' + r.underLegs + ')');
  ok(r.unsealed.ok, 'unsealed, the far road can be taken');
  ok(r.northLegs.every((k) => k === 'walk') && r.chokeNote.some((n) => /Pass/.test(n)), 'north of the range by the guarded pass, with a warning (' + r.chokeNote.join(' ') + ')');
  return 'warning: ' + r.chokeNote[0];
});

await test('D. the tunnel: in at Delver\'s Door, a fight in the Gloomvault, out at the Hollow Stair — the same army, exact survivors', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, M = AS.Armies, out = {};
    M.assign(g, 'c_brannoc', 'red');
    T.away();
    out.order = M.order(g, 'red', { type: 'enter', passage: 'delverway' });
    const a = g.armies.byId.red;
    out.before = Object.assign({}, M.stacksOf(a));
    let t = 0; while (t < 400 && a.layer !== 'under') { T.ff(1); t++; }
    out.wentDown = a.layer === 'under'; out.tDown = t;
    while (t < 500 && !a.enc) { T.ff(1); t++; }
    const e = g.armies.encounters.find((q) => q.id === a.enc);
    out.pending = e && e.status; out.terrain = e && e.terrain;
    out.groupBefore = Object.assign({}, g.armies.groups.gloomhost.stacks);
    const done = M.resolve(g, e.id, 'auto');
    const res = done.result; out.res = { winner: res.winner, rounds: res.rounds, A: res.A, B: res.B, cmdr: res.cmdr };
    out.afterFight = Object.assign({}, M.stacksOf(a));
    out.groupAfter = Object.assign({}, g.armies.groups.gloomhost.stacks);
    while (t < 700 && a.layer === 'under') { T.ff(1); t++; }
    out.up = a.layer === 'surface'; out.at = [Math.round(a.x), Math.round(a.y)]; out.status = a.status; out.order = a.order.type;
    out.final = Object.assign({}, M.stacksOf(a));
    out.sameRecord = g.armies.byId.red === a && g.armies.list.filter((q) => q.name === 'Red Company').length === 1;
    out.cmdr = a.cmdr;
    return out;
  });
  ok(r.wentDown, 'Red Company went underground (after ' + r.tDown + ' s of marching)');
  ok(r.pending === 'pending' && r.terrain === 'tunnel', 'the Gloomvault Horde waits in the tunnel: a pending encounter');
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  ok(sum(r.res.A.before) === sum(r.before), 'the auto-resolve fought with the army as it was');
  for (const k in r.before) ok((r.res.A.after[k] || 0) + r.res.A.lost[k] === r.before[k], 'conservation for ' + k);
  ok(JSON.stringify(r.afterFight) === JSON.stringify(r.res.A.after), 'the army holds exactly the survivors (' + JSON.stringify(r.afterFight) + ')');
  for (const k in r.groupBefore) ok((r.groupAfter[k] || 0) === (r.res.B.after[k] || 0), 'the horde holds exactly its survivors (' + k + ')');
  if (r.res.winner === 'A') {
    ok(r.up && Math.hypot(r.at[0] - 2050, r.at[1] - 2950) < 200, 'the army came up at the Hollow Stair (' + r.at + ')');
    ok(JSON.stringify(r.final) === JSON.stringify(r.afterFight), 'and emerged with the same survivors');
  } else ok(r.up && Math.hypot(r.at[0] - 2350, r.at[1] - 4450) < 200, 'beaten, the army came back out at Delver\'s Door (' + r.at + ')');
  ok(r.sameRecord, 'one Red Company throughout');
  return (r.res.winner === 'A' ? 'won' : 'lost') + ' in ' + r.res.rounds + ' rounds; lost ' + JSON.stringify(r.res.A.lost) + ', killed ' + JSON.stringify(r.res.B.lost) + '; out at ' + r.at;
});

await test('E. auto-resolve: frontage, terrain, commanders and morale matter — not just numbers', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const R = AS.AutoResolve, C = AS.Data.commanders, out = {};
    const side = (stacks, cmdr) => ({ name: 'S', stacks, morale: 80, cmdr: cmdr ? C[cmdr] : null });
    const run = (a, b, ctx) => R.resolve(a, b, Object.assign({ seed: 7 }, ctx));
    // the same fight in the open and in a tunnel: archers suffer underground
    const archers = side({ h_archer: 14, h_soldier: 4 }), host = { name: 'H', stacks: { skeleton: 12 }, morale: 80 };
    out.open = run(archers, host, { terrain: 'open' }); out.tunnel = run(archers, host, { terrain: 'tunnel' });
    // numbers count for less in a tunnel: only six can fight abreast
    out.trollOpen = run(side({ h_soldier: 24 }), { name: 'R', stacks: { skeleton: 10 }, morale: 80 }, { terrain: 'open' });
    out.trollTunnel = run(side({ h_soldier: 24 }), { name: 'R', stacks: { skeleton: 10 }, morale: 80 }, { terrain: 'tunnel' });
    // Brannoc underground versus no commander
    out.noCmdr = run(side({ h_soldier: 8, h_archer: 4 }), { name: 'G', stacks: { skeleton: 14, gravehound: 3 }, morale: 75 }, { terrain: 'tunnel' });
    out.brannoc = run(side({ h_soldier: 8, h_archer: 4 }, 'c_brannoc'), { name: 'G', stacks: { skeleton: 14, gravehound: 3 }, morale: 75 }, { terrain: 'tunnel' });
    // the same seed, the same fight
    out.det = JSON.stringify(run(archers, host, { terrain: 'cavern', seed: 99 })) === JSON.stringify(run(archers, host, { terrain: 'cavern', seed: 99 }));
    // a retreat before the fight: one round of pursuit only
    out.retreat = run(side({ h_soldier: 8 }), host, { terrain: 'tunnel', retreat: 'A' });
    // morale: a small band facing a host breaks before it is wiped out
    out.rout = run(side({ h_soldier: 10 }), { name: 'B', stacks: { bandit: 24 }, morale: 80 }, { terrain: 'open' });
    const lostOf = (x) => R.count(x.A.lost);
    out.sum = { open: lostOf(out.open), tunnel: lostOf(out.tunnel), trollOpen: [out.trollOpen.winner, lostOf(out.trollOpen)], trollTunnel: [out.trollTunnel.winner, lostOf(out.trollTunnel)], noCmdr: [out.noCmdr.winner, lostOf(out.noCmdr), R.count(out.noCmdr.B.lost)], brannoc: [out.brannoc.winner, lostOf(out.brannoc), R.count(out.brannoc.B.lost)], retreat: [out.retreat.rounds, lostOf(out.retreat)], rout: [out.rout.retreat, R.count(out.rout.A.after)] };
    // conservation in every result
    out.cons = [out.open, out.tunnel, out.trollOpen, out.trollTunnel, out.noCmdr, out.brannoc, out.retreat, out.rout].every((x) => ['A', 'B'].every((s) => Object.keys(x[s].before).every((k) => (x[s].after[k] || 0) + x[s].lost[k] === x[s].before[k])));
    return out.sum && Object.assign(out.sum, { det: out.det, cons: out.cons });
  });
  ok(r.cons, 'every result: before = survivors + lost');
  ok(r.det, 'the same seed gives the same result');
  ok(r.tunnel > r.open, 'archers lose more in a tunnel than in the open (' + r.open + ' → ' + r.tunnel + ')');
  ok(r.trollTunnel[1] > r.trollOpen[1], '24 footmen against 10 Risen lose more in a tunnel than in the open (' + r.trollOpen + ' / ' + r.trollTunnel + ')');
  ok(r.brannoc[1] < r.noCmdr[1] || r.brannoc[2] > r.noCmdr[2], 'Brannoc underground does better than no commander (' + r.noCmdr + ' / ' + r.brannoc + ')');
  ok(r.retreat[0] === 1, 'a retreat costs one round of pursuit (' + r.retreat + ')');
  ok(r.rout[0] === 'A' && r.rout[1] > 0, 'outmatched troops break and flee with survivors (' + r.rout + ')');
  return JSON.stringify(r);
});

await test('F. commander defeat: captured with the army, wounded out of a fight and back later', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, M = AS.Armies, A = g.armies, out = {};
    T.away();
    // a doomed band led by Brannoc into the Gloomvault
    const doomed = M.create(g, { id: 'doomed', name: 'Doomed Few', stacks: { h_archer: 2 }, x: 2350, y: 4500 });
    M.assign(g, 'c_brannoc', 'doomed', { anywhere: true });
    M.order(g, 'doomed', { type: 'enter', passage: 'delverway' });
    let t = 0; while (t < 200 && !doomed.enc) { T.ff(1); t++; }
    const e = M.resolve(g, doomed.enc, 'auto');
    out.status = doomed.status; out.fate = A.cmdrs.c_brannoc.fate; out.cstatus = A.cmdrs.c_brannoc.status; out.armyId = A.cmdrs.c_brannoc.armyId;
    // the king's unit falls on the field: wounded, carried home, recovers
    T.away(6500, 6300);
    for (let i = 0; i < 4; i++) T.ff(0.25);
    const guard = A.byId.guard; out.field = !!guard.units; out.unit = !!guard.cmdrUnit;
    if (guard.cmdrUnit) guard.cmdrUnit.takeDamage(1e6, 'melee', null);
    out.king = { status: A.cmdrs.k_osric.status, fate: A.cmdrs.k_osric.fate, guardCmdr: guard.cmdr, guardOrder: guard.order.type };
    out.cannotMarch = M.order(g, 'guard', { type: 'march', x: 5000, y: 4400 });
    T.away();
    T.ff(125);
    out.kingBack = A.cmdrs.k_osric.status;
    return out;
  });
  ok(r.status === 'destroyed' && r.cstatus === 'captured' && r.fate && r.fate.kind === 'captured' && r.armyId === null, 'wiped out underground: army destroyed, Brannoc captured (' + JSON.stringify(r.fate) + ')');
  ok('ransom' in r.fate && 'rescue' in r.fate && r.fate.where === 'gloomvault', 'the fate record leaves room for ransom and rescue');
  ok(r.field && r.unit, 'the king takes the field with the Guard');
  ok(r.king.status === 'incapacitated' && r.king.guardCmdr === null && r.king.guardOrder === 'defend', 'his fall leaves him wounded and the Guard defending (' + JSON.stringify(r.king) + ')');
  ok(!r.cannotMarch.ok, 'without him the Guard cannot set out');
  ok(r.kingBack === 'available', 'after ' + 120 + ' s he has recovered (' + r.kingBack + ')');
  return 'Brannoc: ' + r.fate.kind + ' by ' + r.fate.by + ' at ' + r.fate.where;
});

await test('G. off the field: armies keep moving when the dragon leaves; deterministic; troops conserved through switches', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, M = AS.Armies, A = g.armies, out = {};
    M.assign(g, 'c_brannoc', 'red');
    const total0 = M.count(A.byId.red) + M.count(A.byId.guard);
    // follow → march → hold → follow with the soldiers on the field: no copies
    for (const o of [{ type: 'follow' }, { type: 'march', x: 3000, y: 6200 }, { type: 'hold' }, { type: 'follow' }, { type: 'defend' }]) M.order(g, 'red', o);
    out.field1 = T.onField().red; out.cmdr1 = T.cmdrUnits().red;
    // the dragon flies away: the army is packed into its record and marches on
    M.order(g, 'red', { type: 'march', x: 4950, y: 4400 });
    T.away();
    T.ff(1);
    out.packed = !A.byId.red.units && !T.onField().red && !T.cmdrUnits().red;
    const snap = JSON.parse(JSON.stringify(M.serialize(g)));
    const t0 = performance.now(); T.ff(30); out.ms = performance.now() - t0;
    const p1 = [A.byId.red.x, A.byId.red.y];
    // the same 30 seconds again from the same state: the same place
    M.restore(g, snap); T.ff(30);
    const B = g.armies; // (the restored state)
    const p2 = [B.byId.red.x, B.byId.red.y];
    out.det = B !== A && Math.abs(p1[0] - p2[0]) < 1e-6 && Math.abs(p1[1] - p2[1]) < 1e-6;
    out.moved = Math.hypot(p1[0] - snap.armies[0].x, p1[1] - snap.armies[0].y);
    out.speed = M.speedOf(g, B.byId.red);
    // and back: the dragon returns, the soldiers take the field again, the count is unchanged
    T.away(B.byId.red.x, B.byId.red.y + 200); T.ff(0.5);
    out.back = !!B.byId.red.units && T.onField().red === M.count(B.byId.red) && T.cmdrUnits().red === 1;
    out.dbgBack = [!!B.byId.red.units, T.onField().red, M.count(B.byId.red), T.cmdrUnits().red];
    out.total = M.count(B.byId.red) + M.count(B.byId.guard); out.total0 = total0;
    return out;
  });
  ok(r.field1 === 12 && r.cmdr1 === 1, 'after five order changes: 12 soldiers and one commander on the field (' + r.field1 + ', ' + r.cmdr1 + ')');
  ok(r.packed, 'far from the dragon, the army is a record: no soldiers left on the field');
  ok(r.moved > r.speed * 30 * 0.8 && r.moved < r.speed * 30 * 1.3, 'it marched ' + Math.round(r.moved) + ' units in 30 s (speed ' + r.speed.toFixed(1) + ')');
  ok(r.det, 'the same steps from the same state give the same position');
  ok(r.back && r.total === r.total0, 'back on the field with every soldier (' + r.total + ' of ' + r.total0 + ' ' + r.dbgBack + ')');
  ok(r.ms < 50, '30 s of off-field marching cost ' + r.ms.toFixed(1) + ' ms');
  return Math.round(r.moved) + ' units in 30 s, ' + r.ms.toFixed(2) + ' ms';
});

await test('H. defend and the guarded pass: fights off the field use the real enemy soldiers', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const r = await ev(page, () => {
    const g = AS.game, M = AS.Armies, A = g.armies, out = {};
    T.away();
    T.ff(1);
    // raiders reach the Guard while the dragon is away (moved there, as if they had walked)
    AS.ArmyTest.sendRaid(g);
    const raid = g.at.raid.slice(); out.raid0 = raid.length;
    const guard = A.byId.guard;
    for (const u of raid) { u.x = guard.x + 120 + Math.random() * 60; u.y = guard.y - 60 + Math.random() * 60; }
    g.rebuildGrid(); T.ff(0.5);
    const e = A.encounters.find((q) => q.a === 'guard');
    out.enc = e && { kind: e.kind, status: e.status, attacker: e.attacker, terrain: e.terrain };
    out.res = e && { winner: e.result.winner, A: e.result.A, B: e.result.B };
    out.raidLeft = raid.filter((u) => u.alive && !u.removed).length;
    out.guardNow = M.stacksOf(guard);
    // the pass: the Guard (with the king) attacks the Gatewatch from afar
    const gw = g.byId.get('gatewatch'); out.gw0 = gw.guards.filter((u) => u.alive).length;
    guard.x = 4950; guard.y = 4500; // (set at the foot of the pass for the check)
    out.attack = M.order(g, 'guard', { type: 'attack', siteId: 'gatewatch' });
    let t = 0; while (t < 120 && !A.encounters.some((q) => q.a === 'guard' && q.kind === 'chokepoint')) { g.rebuildGrid(); T.ff(1); t++; }
    const c = A.encounters.find((q) => q.a === 'guard' && q.kind === 'chokepoint');
    out.choke = c && { terrain: c.terrain, winner: c.result.winner, lostB: c.result.B.lost };
    out.dbg = { attack: out.attack, st: guard.status, order: guard.order.type, xy: [Math.round(guard.x), Math.round(guard.y)], n: M.count(guard), encs: A.encounters.map((q) => q.a + ':' + q.kind) };
    out.gw1 = gw.guards.filter((u) => u.alive && !u.removed).length;
    out.gwOwner = gw.owner;
    return out;
  });
  ok(r.enc && r.enc.kind === 'field' && r.enc.attacker === 'B', 'the raiders ran into the defending Guard: a field encounter (' + JSON.stringify(r.enc) + ')');
  ok(r.raidLeft === (Object.values(r.res.B.after).reduce((a, b) => a + b, 0)), 'the raiders on the field are exactly the survivors (' + r.raidLeft + ')');
  ok(JSON.stringify(r.guardNow) === JSON.stringify(r.res.A.after), 'the Guard holds exactly its survivors');
  ok(r.choke && r.choke.terrain === 'pass', 'the Gatewatch is fought as a pass (' + JSON.stringify(r.choke || r.dbg) + ')');
  const lostB = Object.values(r.choke.lostB).reduce((a, b) => a + b, 0);
  ok(r.gw1 === r.gw0 - lostB, 'the Gatewatch lost exactly the guards the fight killed (' + r.gw0 + ' → ' + r.gw1 + ')');
  return 'raid ' + r.res.winner + ', pass ' + r.choke.winner + (r.gwOwner ? ', the Gatewatch is now ' + r.gwOwner + '\'s' : '');
});

await test('I. save and load: armies, commanders, the underground, pending fights, places', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  const before = await ev(page, () => {
    const g = AS.game, M = AS.Armies, A = g.armies;
    M.assign(g, 'c_brannoc', 'red');
    T.away();
    M.order(g, 'red', { type: 'enter', passage: 'delverway' });
    let t = 0; while (t < 300 && !A.byId.red.enc) { T.ff(1); t++; }
    g.armies.flags.kingsroad_open = true;
    AS.ArmyTest.save(g);
    return { red: AS.Armies.summary(g, A.byId.red), guard: AS.Armies.summary(g, A.byId.guard), cmdrs: JSON.stringify(A.cmdrs), enc: A.byId.red.enc, flags: A.flags, clock: A.clock };
  });
  await page.evaluate(() => AS.ArmyTest.start(AS.ArmyTest.load()));
  await page.waitForFunction(() => AS.game && AS.App.state === 'play' && AS.game.armies && AS.game.time > 0.5, null, { timeout: 120000 });
  const after = await ev(page, () => { const g = AS.game, A = g.armies; return { red: AS.Armies.summary(g, A.byId.red), guard: AS.Armies.summary(g, A.byId.guard), cmdrs: JSON.stringify(A.cmdrs), enc: A.byId.red.enc, pending: A.encounters.filter((e) => e.status === 'pending').length, flags: A.flags, clock: A.clock }; });
  ok(after.red.troops === before.red.troops && after.guard.troops === before.guard.troops, 'troops kept (' + after.red.troops + ' | ' + after.guard.troops + ')');
  ok(after.red.layer === 'under' && after.red.where === before.red.where, 'Red Company is still underground at ' + after.red.where);
  ok(after.enc === before.enc && after.pending === 1, 'the pending encounter is still pending');
  ok(after.cmdrs === before.cmdrs, 'commanders kept');
  ok(after.flags.kingsroad_open === true && Math.abs(after.clock - before.clock) < 2, 'flags and the army clock kept');
  // resolving it after the load still works on the same army
  const r = await ev(page, () => { const g = AS.game, A = g.armies, e = AS.Armies.resolve(g, A.byId.red.enc, 'auto'); return { ok: !!e, after: AS.Armies.stacksOf(A.byId.red), res: e.result.A.after }; });
  ok(r.ok && JSON.stringify(r.after) === JSON.stringify(r.res), 'and resolves on the loaded army');
  return 'Red Company ' + after.red.troops + ' in ' + after.red.where;
});

await test('J. play: the field army follows the flying dragon and the panel opens and closes (K)', async (keep) => {
  const page = keep(await open('?world=army&god=1'));
  // the dragon circles on (god mode keeps it flying): the army walks after it
  const p0 = await ev(page, () => { const g = AS.game; AS.Armies.order(g, 'red', { type: 'follow' }); const p = g.player; p.x = 3300; p.y = 6100; for (const n of p.nodes) { n.x = p.x; n.y = p.y; } p.layoutRig(0, true); const q = AS.Armies.pos(g.armies.byId.red); return { x: q.x, y: q.y, px: p.x, py: p.y }; });
  await play(page, 12);
  const p1 = await ev(page, () => { const g = AS.game, q = AS.Armies.pos(g.armies.byId.red); return { x: q.x, y: q.y, n: AS.Armies.count(g.armies.byId.red), st: g.armies.byId.red.status }; });
  const moved = Math.hypot(p1.x - p0.x, p1.y - p0.y), toward = ((p1.x - p0.x) * (p0.px - p0.x) + (p1.y - p0.y) * (p0.py - p0.y)) / Math.max(1, moved) / Math.hypot(p0.px - p0.x, p0.py - p0.y);
  ok(moved > 200 && toward > 0.5 && p1.n === 12, 'Red Company walks after the dragon (' + Math.round(moved) + ' units, heading ' + toward.toFixed(2) + ', ' + p1.st + ')');
  const d0 = Math.round(Math.hypot(p0.px - p0.x, p0.py - p0.y)), d1 = Math.round(moved);
  await page.keyboard.press('KeyK'); await page.waitForTimeout(400);
  const shown = await ev(page, () => AS.App.overlay === 'armycmd' && !!document.querySelector('#armycmd.show .ac-army'));
  ok(shown, 'K opens the command panel');
  await page.click('#armycmd [data-army="red"] .ac-row .btn'); // "Follow dragon"
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(await ev(page, () => AS.App.overlay === null), 'Escape closes it');
  return Math.round(d0) + ' → ' + Math.round(d1);
});

await test('K. compatibility: a battle map, the Mountain Test and the Wide Realm campaign still start without armies', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  await play(page, 3);
  const a = await ev(page, () => ({ armies: !!AS.game.armies, state: AS.App.state }));
  ok(!a.armies && a.state === 'play', 'battle map unaffected');
  await page.evaluate(() => AS.App.startMatch('mountaintest', { faction: 'human' }));
  await page.waitForFunction(() => AS.game && AS.game.map.id === 'mountaintest' && AS.App.state === 'play', null, { timeout: 120000 });
  await play(page, 2);
  await page.evaluate(() => AS.BigCampaign.begin(3, AS.BigCampaign.fresh('human', 12345)));
  await page.waitForFunction(() => AS.game && AS.game.bc && AS.App.state === 'play', null, { timeout: 180000 });
  await play(page, 3);
  const c = await ev(page, () => ({ bc: !!AS.game.bc, armies: !!AS.game.armies }));
  ok(c.bc && !c.armies, 'the campaign starts as before');
  return 'ok';
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
process.exit(fail ? 1 : 0);
