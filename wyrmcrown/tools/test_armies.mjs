/* WYRMCROWN — INDEPENDENT GROUND ARMIES contract tests (no browser).
 * The army layer (wyrmcrown/armies/) on its own test ground, the Tunnel Test
 * scenario (armies/data/scenario_tunnel.js):
 *   data        troop profiles come from AS.Data.troops + Conquest types, and the
 *               missile numbers still match src/game/combat.js and troops.js
 *   ground      mountains, deep water and blocked passages are never walked;
 *               routes prefer the tunnel and fall back on the alternatives
 *   orders      follow, hold, move, attack, defend, retreat, enter — and the
 *               refusals (inaccessible ground, uncaptured places, blocked ways)
 *   the demo    the army goes through Deepdelve while the dragon waits outside,
 *               keeps marching far from it, storms Blackspire (auto-resolved: the
 *               dragon is beyond the mountain) and defends it
 *   battles     the cave fight is auto-resolved even with the dragon at the mouth
 *               (ground-only); a battle near the dragon is handed to the real-time
 *               game; auto-resolve respects numbers, terrain, defences, siege,
 *               casualties, morale and retreat, deterministically
 *   time        frame-by-frame, chunked and saved/restored runs agree exactly;
 *               hundreds of far armies simulate an hour in well under a second
 * usage: node wyrmcrown/tools/test_armies.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.resolve(root, '../alien-strike');

const AS = {};
const context = vm.createContext({ window: { AS }, console, Math, Map, Set, JSON, Date, Object, Array, Number, String, Error, Infinity, Float32Array, Uint8Array, Int8Array, Int16Array, Int32Array, Uint32Array });
const load = (file) => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
load(path.join(engine, 'src/core/util.js'));
AS.Data = AS.Data || {};
for (const f of ['data/palettes.js', 'data/factions.js', 'data/buildings.js', 'conquest/conquest.js', 'conquest/data/allegiances.js', 'conquest/data/troops.js']) load(path.join(root, f));
for (const f of ['armies/armies.js', 'armies/core/stats.js', 'armies/core/ground.js', 'armies/core/autoresolve.js', 'armies/core/orders.js', 'armies/core/sim.js', 'armies/data/scenario_tunnel.js']) load(path.join(root, f));
const A = AS.Armies, O = A.Orders, R = A.AutoResolve, SC = A.Scenarios.tunnel;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS ' + n + '. ' + name); };
const fresh = (o) => SC.create(o);
// (values made inside the vm context are compared by content)
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const run = (sim, secs, until) => { for (let t = 0; t < secs; t++) { sim.step(1); if (until && until()) return t + 1; } return secs; };
const evs = (sim, type) => sim.events.filter((e) => e.type === type);
// every point along a route stands on walkable ground (sampled every 4 units)
const routeIsWalkable = (gm, route) => {
  for (let s = 1; s < route.pts.length; s++) {
    const [x0, y0] = route.pts[s - 1], [x1, y1] = route.pts[s], d = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.ceil(d / 4));
    for (let q = 0; q <= k; q++) if (!gm.passable(x0 + (x1 - x0) * q / k, y0 + (y1 - y0) * q / k)) return false;
  }
  return true;
};

/* ---------------- data ---------------- */
ok('data: troop profiles are read from the existing troop data, never redefined', () => {
  for (const t of AS.Conquest.Data.troopList) {
    const p = A.Stats.profile(t.id), d = AS.Data.troops[t.base], m = t.mul || {};
    assert.equal(p.hp, d.hp * (m.hp || 1), t.id + ' hp');
    assert.equal(p.armor, d.armor || 0, t.id + ' armour');
    assert.equal(p.speed, d.speed * (m.speed || 1), t.id + ' speed');
    if (d.melee) assert.equal(p.melee.dmg, d.melee.dmg * (m.dmg || 1), t.id + ' melee');
    if (d.ranged) assert.equal(p.missiles[0].range, d.ranged.range * (m.range || 1), t.id + ' range');
  }
  // battle roles work too (wild guardians are listed by role)
  assert.equal(A.Stats.profile('troll').regen, AS.Data.troops.troll.regen);
  assert.equal(A.Stats.profile('u_skeleton').fearless, true, 'the risen do not break');
  assert.throws(() => A.Stats.profile('dragonslayer'), /unknown troop/);
});
ok('data: missile damage matches the real-time game (combat.js, troops.js)', () => {
  const src = fs.readFileSync(path.join(root, 'src/game/combat.js'), 'utf8');
  for (const k of ['arrow', 'spear', 'crossbow', 'ballista', 'magic']) {
    const m = src.match(new RegExp('\\b' + k + ': \\{ speed: \\d+, dmg: ([\\d.]+)'));
    assert.ok(m, k + ' found in combat.js'); assert.equal(+m[1], A.Stats.WEAPON[k].dmg, k + ' damage');
  }
  const lob = src.match(/dmg: \(kind === 'rock' \? (\d+) : (\d+)\) \* dmgMul, dtype: 'impact', radius: kind === 'rock' \? (\d+) : (\d+)/);
  assert.ok(lob, 'lobbed stones in combat.js');
  same([+lob[1], +lob[2], +lob[3], +lob[4]], [A.Stats.WEAPON.rock.dmg, A.Stats.WEAPON.stone.dmg, A.Stats.WEAPON.rock.radius, A.Stats.WEAPON.stone.radius]);
  assert.match(fs.readFileSync(path.join(root, 'src/game/troops.js'), 'utf8'), /dmgMul: T\.ranged\.kind === 'stone' \? 2 : 1/, 'stones doubled at ground targets');
  assert.equal(A.Stats.STONE_MUL, 2);
  assert.equal(A.Stats.afterArmor(7, 4), 3, 'armour: a blow loses its armour');
  assert.equal(A.Stats.afterArmor(4.5, 4), 4.5 * 0.4, 'armour: never below 40%');
});
ok('isolation: the armies are not loaded by the game, and nothing in the game refers to them', () => {
  assert.ok(!fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('armies/'), 'index.html does not load armies/');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
  for (const f of walk(path.join(root, 'src')).concat(walk(path.join(root, 'conquest')), walk(path.join(root, 'maps')))) assert.ok(!fs.readFileSync(f, 'utf8').includes('AS.Armies'), f + ' must not reference AS.Armies');
});

/* ---------------- ground ---------------- */
ok('ground: the scenario has its settlement, fortress, barrier, tunnel, cave and alternative routes', () => {
  const { ground: gm, points: P } = fresh();
  assert.equal(gm.W, 56); assert.equal(gm.H, 30);
  for (const id of ['oakhollow', 'blackspire', 'troll_cave', 'millbrook']) assert.ok(SC.locations.find((l) => l.id === id), id);
  assert.equal(gm.passable(P.peak.x, P.peak.y), false, 'mountains cannot be walked');
  assert.equal(gm.passable(P.sea.x, P.sea.y), false, 'deep water cannot be walked');
  assert.equal(gm.byId.deepdelve.cells.length, 6); assert.equal(gm.byId.deepdelve.groundOnly, true);
  assert.equal(gm.byId.trollcave.groundOnly, true); assert.equal(gm.byId.trollcave.location, 'troll_cave');
  assert.equal(gm.byId.oldmine.blocked, true); assert.equal(gm.byId.northbridge.groundOnly, false);
  assert.equal(gm.entrances('deepdelve').length, 2, 'the tunnel has two mouths');
  assert.equal(gm.entrances('trollcave').length, 1, 'the cave is a dead end');
  assert.ok(gm.reachable(P.muster.x, P.muster.y, P.eastBank.x, P.eastBank.y), 'east and west are joined');
  assert.ok(!gm.reachable(P.muster.x, P.muster.y, P.sea.x, P.sea.y));
});
ok('routes: the short way is through Deepdelve; never over mountains or deep water', () => {
  const { ground: gm, points: P } = fresh();
  const F = SC.locations.find((l) => l.id === 'blackspire');
  const r = gm.findPath(P.muster.x, P.muster.y, F.x, F.y);
  same(r.passages, ['deepdelve', 'fortbridge']);
  assert.ok(routeIsWalkable(gm, r), 'the whole route stands on walkable ground');
  assert.ok(r.length < 2700, 'about straight across: ' + Math.round(r.length));
});
ok('routes: blocked passages are never used; the alternatives take over', () => {
  const { ground: gm, points: P } = fresh();
  const F = SC.locations.find((l) => l.id === 'blackspire');
  const short = gm.findPath(P.muster.x, P.muster.y, F.x, F.y);
  gm.setBlocked('deepdelve', true);
  const north = gm.findPath(P.muster.x, P.muster.y, F.x, F.y);
  assert.ok(!north.passages.includes('deepdelve'), 'not through the closed tunnel');
  assert.ok(Math.min(...north.pts.map((p) => p[1])) < 6 * 64, 'round the north end of the range');
  assert.ok(north.length > short.length * 1.4 && routeIsWalkable(gm, north));
  gm.setBlocked('northbridge', true);
  const westBank = gm.findPath(P.muster.x, P.muster.y, F.x, F.y);
  same(westBank.passages, ['fortbridge'], 'down the west bank to the Fortress Bridge');
  gm.setBlocked('fortbridge', true);
  const ford = gm.findPath(P.muster.x, P.muster.y, F.x, F.y);
  assert.ok(ford && !ford.passages.length && routeIsWalkable(gm, ford), 'no bridge left: over the ford');
  assert.ok(ford.legs.some((l) => Math.abs(l.cost - A.Ground.KIND.shallow.cost) < 1e-5), 'the route wades the ford');
  assert.ok(ford.effort > westBank.effort);
  gm.setBlocked('deepdelve', false);
  const viaTunnelFord = gm.findPath(P.muster.x, P.muster.y, F.x, F.y);
  assert.ok(viaTunnelFord.passages.includes('deepdelve') && viaTunnelFord.effort < ford.effort, 'tunnel, then the ford');
  // the collapsed Old Mine: opening it gives a new way through
  const before = gm.findPath(P.southField.x, P.southField.y, P.behindMine.x, P.behindMine.y);
  assert.ok(!before.passages.includes('oldmine'));
  gm.setBlocked('oldmine', false);
  const after = gm.findPath(P.southField.x, P.southField.y, P.behindMine.x, P.behindMine.y);
  assert.ok(after.passages.includes('oldmine') && after.length < before.length);
});

/* ---------------- orders ---------------- */
ok('orders: inaccessible destinations and impossible orders are refused with a reason', () => {
  const { sim, points: P } = fresh();
  assert.match(sim.order('host', O.move(P.peak.x, P.peak.y)).reason, /mountains/);
  assert.match(sim.order('host', O.move(P.sea.x, P.sea.y)).reason, /deep water/);
  assert.match(sim.order('host', O.defend('blackspire')).reason, /captured before/);
  assert.match(sim.order('host', O.attack('oakhollow')).reason, /not held by an enemy/);
  assert.match(sim.order('host', O.enter('oldmine')).reason, /blocked/);
  assert.equal(evs(sim, 'rejected').length, 5);
  const near = sim.order('host', O.move(P.peak.x, P.peak.y, { nearest: true }));
  assert.ok(near.ok && sim.ground.passable(near.dest.x, near.dest.y), 'nearest: march to the foot of the mountain instead');
});
ok('order — hold: the army stays where it stands', () => {
  const { sim, host } = fresh();
  const x = host.x, y = host.y;
  sim.order('host', O.hold());
  sim.setDragon({ side: 'human', x: 3000, y: 300 }); // the dragon flies far away
  run(sim, 120);
  assert.equal(host.x, x); assert.equal(host.y, y); assert.equal(host.status, 'holding');
});
ok('order — move: the army marches to accessible ground by a walkable route', () => {
  const { sim, host, points: P } = fresh();
  const r = sim.order('host', O.move(P.northRoad.x, P.northRoad.y));
  assert.ok(r.ok && routeIsWalkable(sim.ground, r.route));
  const t = run(sim, 200, () => host.status === 'idle');
  assert.ok(Math.hypot(host.x - P.northRoad.x, host.y - P.northRoad.y) < 1);
  // time taken matches the slowest troops (the catapults, 30/s) over the route's effort
  assert.equal(t, Math.ceil(r.route.effort / A.Stats.stackSpeed(host.stacks)));
});
ok('order — follow: over the mountain the army takes the tunnel; over the sea it waits on the shore', () => {
  const { sim, host, points: P } = fresh();
  sim.order('host', O.follow());
  sim.setDragon({ side: 'human', x: P.eastBank.x - 300, y: P.eastBank.y }); // the dragon flies over the range
  run(sim, 180, () => host.status === 'following' && !host.plan && Math.hypot(host.x - (P.eastBank.x - 300), host.y - P.eastBank.y) < 400);
  assert.ok(host.x > 2100, 'the army crossed the range: x ' + Math.round(host.x));
  assert.ok(evs(sim, 'passage-in').some((e) => e.passage === 'deepdelve'), 'through the tunnel');
  // the dragon goes out to sea: the army walks to the shore and waits there, dry
  sim.setDragon({ side: 'human', x: 2600, y: 1800 });
  run(sim, 120);
  assert.ok(sim.ground.passable(host.x, host.y), 'never in the water');
  assert.ok(evs(sim, 'cannot-follow').length >= 1);
  assert.equal(host.status, 'waiting');
  // the dragon over the high peak: the army waits at the nearest ground it can walk to
  const g = sim.ground.nearestReachable(host.x, host.y, P.peak.x, P.peak.y);
  assert.ok(g && !g.exact && sim.ground.passable(g.x, g.y));
});
ok('order — attack, then defend: Blackspire falls to an army sent through the tunnel', () => {
  const { sim, host } = fresh();
  sim.order('host', O.attack('blackspire'));
  run(sim, 200, () => host.status === 'defending');
  const B = sim.battles[0];
  assert.equal(B.location, 'blackspire'); assert.equal(B.mode, 'auto'); assert.equal(B.result.winner, 'attacker');
  assert.equal(sim.location('blackspire').owner, 'human');
  assert.equal(host.order.kind, 'defend'); assert.equal(host.status, 'defending');
  assert.ok(evs(sim, 'captured').length === 1);
});
ok('order — defend: a defended place makes the attacker pay more than open ground', () => {
  const loss = (defend) => {
    const { sim, host } = fresh();
    sim.locations.find((l) => l.id === 'blackspire').garrison = [];
    sim.location('blackspire').owner = 'human';
    if (defend) { sim.order('host', O.defend('blackspire')); run(sim, 200, () => host.status === 'defending'); }
    else { sim.order('host', O.move(2700, 1100)); run(sim, 200, () => host.status === 'idle'); sim.order('host', O.hold()); }
    const foe = sim.addArmy({ id: 'horde', side: 'undead', name: 'Horde', x: 3328, y: 1500, stacks: [{ troop: 'u_skeleton', count: 60 }, { troop: 'u_ghoul', count: 8 }] });
    sim.order('horde', defend ? O.attack('blackspire') : O.attack({ army: 'host' }));
    run(sim, 200, () => sim.battles.some((b) => b.result && b.defender.armies.includes('host')));
    const B = sim.battles.find((b) => b.defender.armies.includes('host'));
    return { B, foe };
  };
  const a = loss(true), b = loss(false);
  assert.equal(a.B.ctx.defender.stance, 'defending'); assert.equal(a.B.ctx.defender.fort, 2);
  assert.equal(b.B.ctx.defender.fort, 1);
  assert.ok(a.B.result.defender.lost < b.B.result.defender.lost, 'defenders lose fewer behind walls: ' + a.B.result.defender.lost + ' vs ' + b.B.result.defender.lost);
});
ok('order — retreat: a beaten force falls back to the nearest safe place, skirting threats', () => {
  const { sim } = fresh();
  sim.order('host', O.hold());
  const raid = sim.addArmy({ id: 'raid', side: 'human', name: 'Raiders', x: 2112, y: 928, stacks: [{ troop: 'h_soldier', count: 10 }] });
  sim.order('raid', O.attack('blackspire'));
  run(sim, 120, () => raid.status === 'retreating' || !raid.alive);
  assert.equal(sim.battles[0].result.winner, 'defender');
  assert.ok(raid.alive, 'some survive the failed assault');
  assert.equal(raid.order.location, 'millbrook', 'Millbrook is the nearest safe place');
  run(sim, 200, () => raid.status === 'recovering');
  assert.ok(Math.hypot(raid.x - sim.location('millbrook').x, raid.y - sim.location('millbrook').y) < 1);
  assert.equal(sim.location('blackspire').owner, 'undead');
  // with enemies at Millbrook, the retreat goes home through the tunnel instead
  const s2 = fresh().sim;
  s2.addArmy({ id: 'watch', side: 'undead', name: 'Watch', x: 2304, y: 352, stacks: [{ troop: 'u_skeleton', count: 6 }] });
  s2.order('watch', O.hold());
  const r2 = s2.addArmy({ id: 'raid', side: 'human', name: 'Raiders', x: 2112, y: 928, stacks: [{ troop: 'h_soldier', count: 10 }] });
  const r = s2.order('raid', O.retreat());
  assert.equal(r.location, 'oakhollow'); assert.ok(r.route.passages.includes('deepdelve'));
  assert.equal(s2.order('raid', O.retreat('millbrook')).ok, false, 'an unsafe place is refused');
  assert.ok(r2.status === 'retreating' && s2.speed(r2) > A.Stats.stackSpeed(r2.stacks), 'retreating troops hurry');
});
ok('order — enter: through the tunnel to its far mouth, never round the mountain', () => {
  const { sim, host, points: P } = fresh();
  const r = sim.order('host', O.enter('deepdelve'));
  assert.ok(r.ok); same(r.route.passages, ['deepdelve']);
  run(sim, 120, () => host.status === 'idle');
  assert.ok(Math.hypot(host.x - P.tunnelEast.x, host.y - P.tunnelEast.y) < 1, 'out at the eastern mouth');
  assert.ok(evs(sim, 'through').length === 1);
  // even from the far side of the map, an enter order goes through the tunnel
  const s2 = fresh(); s2.sim.order('host', O.move(P.northRoad.x, P.northRoad.y)); run(s2.sim, 200, () => s2.host.status === 'idle');
  assert.ok(s2.sim.order('host', O.enter('deepdelve')).route.passages.includes('deepdelve'));
});

/* ---------------- the demonstration ---------------- */
ok('DEMO: the army goes through Deepdelve while the dragon stays outside, and takes Blackspire', () => {
  const { sim, host, points: P } = fresh();
  const dragon = { side: 'human', x: P.tunnelWest.x - 160, y: P.tunnelWest.y - 120 };
  sim.setDragon(dragon); // the dragon waits by the western mouth the whole time
  const log = [];
  sim.on((e) => { if (e.type !== 'lod' || e.army === 'host') log.push(e); });
  assert.ok(sim.order('host', O.enter('deepdelve')).ok);
  let inside = 0, farTicks = 0;
  run(sim, 120, () => { if (host.passage === 'deepdelve') inside++; if (host.lod === 'far') farTicks++; return host.status === 'idle'; });
  assert.ok(inside >= 5, 'the army was inside the tunnel for ' + inside + ' s');
  same([sim.dragon.x, sim.dragon.y], [dragon.x, dragon.y], 'the dragon never moved');
  assert.ok(log.some((e) => e.type === 'passage-in' && e.groundOnly), 'a ground-only passage');
  // on the far side, it storms the fortress: the dragon is beyond the mountain, so the battle is auto-resolved
  sim.onTactical = () => { throw new Error('the dragon cannot reach this fight'); };
  assert.ok(sim.order('host', O.attack('blackspire')).ok);
  run(sim, 120, () => { if (host.lod === 'far') farTicks++; return host.status === 'defending'; });
  assert.ok(log.some((e) => e.type === 'lod' && e.lod === 'far'), 'the army left the dragon\'s sight and kept marching');
  assert.ok(farTicks > 5, 'marched out of sight for ' + farTicks + ' s');
  const B = sim.battles[0];
  assert.equal(B.dragon, false); assert.equal(B.dragonWhy, 'too far'); assert.equal(B.mode, 'auto');
  assert.equal(sim.location('blackspire').owner, 'human');
  console.log('      ' + log.filter((e) => e.type !== 'lod').map((e) => e.t + 's ' + e.type + (e.passage ? ' ' + e.passage : '') + (e.winner ? ' ' + e.winner : '') + (e.location ? ' ' + e.location : '')).join(' · '));
});
ok('cave: the dragon at the mouth cannot join; the fight inside is auto-resolved to the end', () => {
  const { sim, host, points: P } = fresh();
  let handed = 0;
  sim.onTactical = () => { handed++; };
  sim.setDragon({ side: 'human', x: P.caveMouth.x - 40, y: P.caveMouth.y }); // hovering at the entrance, well within reach
  const r = sim.order('host', O.enter('trollcave'));
  assert.ok(r.ok); assert.equal(r.location, 'troll_cave');
  run(sim, 200, () => sim.battles.length && sim.battles[0].result);
  const B = sim.battles[0];
  assert.equal(B.location, 'troll_cave'); assert.equal(B.groundOnly, true);
  assert.equal(B.dragon, false); assert.equal(B.dragonWhy, 'ground-only'); assert.equal(B.mode, 'auto'); assert.equal(handed, 0);
  assert.equal(B.terrain, 'cave'); assert.equal(B.ctx.defender.noRetreat, true);
  assert.equal(B.result.winner, 'attacker'); assert.equal(B.result.reason, 'wiped', 'cornered defenders fight to the last');
  assert.equal(sim.location('troll_cave').garrison.length, 0);
  assert.equal(host.status, 'in-passage');
  assert.ok(B.result.attacker.lost > 0, 'a troll in a cave costs lives');
});
ok('tactical hand-off: a battle within the dragon\'s reach waits for the real-time game', () => {
  const { sim, host } = fresh();
  const handed = [];
  sim.onTactical = (B) => handed.push(B);
  const foe = sim.addArmy({ id: 'band', side: 'undead', name: 'Band', x: 1200, y: 928, stacks: [{ troop: 'u_skeleton', count: 8 }] });
  sim.order('band', O.hold());
  sim.order('host', O.attack({ army: 'band' }));
  sim.setDragon({ side: 'human', x: 1000, y: 800 });
  run(sim, 60, () => handed.length);
  assert.equal(handed.length, 1); assert.equal(handed[0].mode, 'tactical'); assert.equal(handed[0].dragon, true);
  const x = host.x; run(sim, 20);
  assert.equal(host.status, 'fighting'); assert.equal(host.x, x, 'frozen while the battle is fought');
  assert.equal(sim.order('host', O.hold()).ok, false);
  // the real-time game reports back in the same shape as the auto-resolver
  const res = R.resolve(handed[0].ctx);
  assert.ok(sim.settle(handed[0].id, res));
  assert.equal(host.battle, null); assert.ok(!foe.alive || foe.status === 'retreating');
});

/* ---------------- auto-resolve ---------------- */
const host = SC.army.stacks;
const fortG = SC.locations.find((l) => l.id === 'blackspire').garrison;
const caveG = SC.locations.find((l) => l.id === 'troll_cave').garrison;
ok('auto-resolve: deterministic, and every soldier is accounted for', () => {
  const c = { attacker: { side: 'human', stacks: host }, defender: { side: 'undead', stacks: fortG, stance: 'garrison', fort: 2, breach: 6 }, terrain: 'fort', seed: 99 };
  assert.equal(JSON.stringify(R.resolve(c)), JSON.stringify(R.resolve(c)));
  for (let seed = 1; seed < 40; seed++) {
    const r = R.resolve(Object.assign({}, c, { seed }));
    for (const [side, start] of [['attacker', host], ['defender', fortG]]) {
      const before = R.toCounts(start), after = R.toCounts(r[side].survivors);
      for (const id in before) assert.equal((after[id] || 0) + (r[side].casualties[id] || 0), before[id], side + ' ' + id + ' seed ' + seed);
    }
  }
});
ok('auto-resolve: numbers, troop quality and missiles all count', () => {
  const soldiers = (k) => [{ troop: 'h_soldier', count: k }];
  const win = (a, d, t, extra) => R.estimate(Object.assign({ attacker: { stacks: a }, defender: { stacks: d, stance: 'moving' }, terrain: t || 'plain', seed: 5 }, extra), 24).win;
  assert.ok(win(soldiers(30), soldiers(15)) > 0.9, 'twice the men win');
  assert.ok(win(soldiers(15), soldiers(30)) < 0.1);
  assert.ok(win([{ troop: 'h_knight', count: 10 }], soldiers(20)) > 0.9, 'knights (140 hp, armour 4) beat twice as many footmen');
  assert.ok(win([{ troop: 'u_skeleton', count: 20 }], soldiers(20)) < 0.2, 'risen (28 hp) lose to footmen (46 hp)');
});
ok('auto-resolve: terrain — a tunnel blunts numbers; fords and hills favour the defender', () => {
  const lossRatio = (t) => { const r = R.resolve({ attacker: { stacks: [{ troop: 'h_soldier', count: 40 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 14 }], stance: 'holding' }, terrain: t, seed: 3 }); return r.attacker.lost / Math.max(1, r.defender.lost); };
  assert.ok(lossRatio('tunnel') > lossRatio('plain') * 2, 'in the tunnel the many pay more per kill: ' + lossRatio('tunnel').toFixed(2) + ' vs ' + lossRatio('plain').toFixed(2));
  const even = (t) => R.estimate({ attacker: { stacks: [{ troop: 'h_soldier', count: 20 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 20 }], stance: 'holding' }, terrain: t, seed: 9 }, 24).win;
  assert.ok(even('shallow') < even('plain') && even('hill') < even('plain'), 'ford/hill attacks are harder');
  const archers = (t) => R.resolve({ attacker: { stacks: [{ troop: 'h_archer', count: 20 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 20 }], stance: 'moving' }, terrain: t, seed: 1 }).defender.lost;
  assert.ok(archers('forest') < archers('plain') && archers('tunnel') <= archers('forest'), 'missiles lose effect in forest and tunnels');
  const giant = (t) => R.resolve({ attacker: { stacks: [{ troop: 'n_hillgiant', count: 1 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 20 }], stance: 'moving' }, terrain: t, seed: 1 });
  assert.ok(giant('tunnel').defender.lost / giant('tunnel').rounds < giant('plain').defender.lost / giant('plain').rounds, 'a giant has no room to swing in a tunnel');
});
ok('auto-resolve: defender advantage, walls and siege engines', () => {
  const base = { attacker: { stacks: host }, defender: { stacks: fortG, stance: 'garrison', fort: 2, breach: 6 }, terrain: 'fort', seed: 11 };
  const open = R.estimate(Object.assign({}, base, { defender: { stacks: fortG, stance: 'moving' }, terrain: 'plain' }), 16).win;
  const walls = R.estimate(base, 16).win;
  const noSiege = R.estimate(Object.assign({}, base, { attacker: { stacks: host.filter((s) => s.troop !== 'h_siege') } }), 16).win;
  assert.ok(open >= walls, 'walls never help the attacker');
  assert.ok(walls > noSiege, 'catapults breach the walls: ' + walls + ' vs ' + noSiege);
  assert.equal(noSiege, 0, 'without siege engines the host cannot storm Blackspire');
  assert.ok(R.resolve(base).attacker.lost > R.resolve(Object.assign({}, base, { defender: { stacks: fortG, stance: 'moving' }, terrain: 'plain' })).attacker.lost, 'storming costs more than a field battle');
});
ok('auto-resolve: morale, retreat and pursuit; the dead and the cornered do not run', () => {
  const r = R.resolve({ attacker: { stacks: [{ troop: 'h_soldier', count: 30 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 20 }], stance: 'moving' }, terrain: 'plain', seed: 2 });
  assert.equal(r.reason, 'broke'); assert.equal(r.defender.retreated, true); assert.ok(r.defender.survivors.length > 0, 'the beaten side gets away');
  assert.ok(r.defender.morale < 1 && r.attacker.morale === 1);
  const lowMorale = R.resolve({ attacker: { stacks: [{ troop: 'h_soldier', count: 30 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 20 }], stance: 'moving', morale: 0.2 }, terrain: 'plain', seed: 2 });
  assert.ok(lowMorale.rounds <= r.rounds && lowMorale.defender.lost <= r.defender.lost, 'shaken troops break sooner');
  const dead = R.resolve({ attacker: { stacks: [{ troop: 'h_soldier', count: 30 }] }, defender: { stacks: [{ troop: 'u_skeleton', count: 30 }], stance: 'moving' }, terrain: 'plain', seed: 2 });
  assert.ok(dead.winner === 'defender' || dead.defender.lost >= 26, 'the risen fight on to the last few');
  // the share of the broken side cut down as it flees grows with the pursuers' speed
  const chase = (sp) => { const r = R.resolve({ attacker: { stacks: [{ troop: sp, count: 26 }] }, defender: { stacks: [{ troop: 'h_soldier', count: 20 }], stance: 'moving' }, terrain: 'plain', seed: 4 }); assert.equal(r.reason, 'broke', sp); return r.pursued / (r.pursued + R.toCounts(r.defender.survivors).h_soldier); };
  assert.ok(chase('n_wolf') > chase('h_soldier'), 'wolves (90/s) run the fleeing down harder than footmen (46/s): ' + chase('n_wolf').toFixed(2) + ' vs ' + chase('h_soldier').toFixed(2));
  const cave = R.resolve({ attacker: { stacks: host }, defender: { stacks: caveG, stance: 'garrison', noRetreat: true }, terrain: 'cave', seed: 7 });
  assert.equal(cave.reason, 'wiped');
});

/* ---------------- time ---------------- */
// the full demonstration as a script, stepped in a chosen way
function demo(stepper, view) {
  const { sim, host, points: P } = fresh();
  if (view) sim.setView(view);
  sim.setDragon({ side: 'human', x: P.tunnelWest.x - 160, y: P.tunnelWest.y - 120 });
  sim.order('host', O.enter('deepdelve'));
  const foe = sim.addArmy({ id: 'patrol', side: 'undead', name: 'Patrol', x: 3200, y: 1400, stacks: [{ troop: 'u_skeleton', count: 8 }] });
  sim.order('patrol', O.move(2300, 1200));
  stepper(sim, 90);
  if (host.status === 'idle') sim.order('host', O.attack('blackspire'));
  stepper(sim, 150);
  return sim;
}
const strip = (sim) => { const s = sim.snapshot(); return JSON.stringify(s); };
ok('time: frame-by-frame, chunked, and near/far runs give exactly the same war', () => {
  const frames = demo((sim, secs) => { for (let i = 0; i < secs * 60; i++) { sim.step(1 / 60); sim.frame(); } });
  const chunks = demo((sim, secs) => { let left = secs; while (left > 0) { const d = Math.min(left, 37); sim.step(d); left -= d; } });
  const blind = demo((sim, secs) => sim.step(secs), { x: -99999, y: -99999, r: 1 });
  assert.equal(strip(frames), strip(chunks));
  assert.equal(strip(frames), strip(blind));
  assert.ok(frames.battles.length >= 1);
  assert.ok(frames.stats.frameNear > 0 && frames.stats.frameSkipped > 0, 'far armies are skipped between ticks');
});
ok('time: saving mid-march and restoring continues exactly', () => {
  const a = fresh(); a.sim.order('host', O.enter('deepdelve')); run(a.sim, 25);
  assert.equal(a.host.passage, 'deepdelve', 'saved inside the tunnel');
  const snap = JSON.parse(JSON.stringify(a.sim.snapshot()));
  const b = fresh(); b.sim.restore(snap);
  run(a.sim, 200); run(b.sim, 200);
  assert.equal(strip(a.sim), strip(b.sim));
});
ok('time: a tunnel collapsing ahead of a march re-routes it round the north', () => {
  const { sim, host } = fresh();
  sim.order('host', O.attack('blackspire'));
  run(sim, 5);
  sim.ground.setBlocked('deepdelve', true);
  run(sim, 2);
  const re = evs(sim, 'replan');
  assert.ok(re.length === 1 && re[0].via.includes('northbridge') && !re[0].via.includes('deepdelve'));
  run(sim, 400, () => sim.battles.length);
  assert.ok(!evs(sim, 'passage-in').some((e) => e.passage === 'deepdelve'));
  assert.ok(host.alive);
});
ok('offscreen: 400 armies march for an hour of game time cheaply, never off the ground', () => {
  const { sim, ground: gm } = fresh();
  sim.armies.clear();
  const rng = new AS.U.RNG(77), spots = [];
  for (let j = 0; j < gm.H; j++) for (let i = 0; i < gm.W; i++) { const x = (i + 0.5) * 64, y = (j + 0.5) * 64; if (gm.passable(x, y) && !gm.passageAt(x, y)) spots.push([x, y]); }
  const pick = () => spots[Math.floor(rng.next() * spots.length)];
  for (let k = 0; k < 400; k++) { const [x, y] = pick(); sim.addArmy({ side: 'human', name: 'Column ' + k, x, y, stacks: [{ troop: 'h_soldier', count: 10 }] }); }
  sim.locations.length = 0; // nobody to fight: this measures marching
  sim.setView({ x: 400, y: 900, r: 600 });
  let orders = 0, bad = 0, planMs = 0, simMs = 0;
  for (let minute = 0; minute < 60; minute++) {
    let t0 = performance.now();
    for (const a of sim.armies.values()) if (!a.plan) { const [x, y] = pick(); if (sim.order(a.id, O.move(x, y)).ok) orders++; }
    planMs += performance.now() - t0; t0 = performance.now();
    const searches = gm.stats.searches;
    sim.step(60);
    simMs += performance.now() - t0;
    assert.equal(gm.stats.searches, searches, 'marching needs no route searches: a march is a lookup along its route');
    for (const a of sim.armies.values()) if (!gm.passable(a.x, a.y)) bad++;
  }
  const armyTicks = sim.stats.farTicks + sim.stats.nearTicks;
  console.log('      400 armies × 3600 s: marching ' + Math.round(simMs) + ' ms (' + (simMs * 1000 / armyTicks).toFixed(2) + ' µs per army-second), planning ' + orders + ' orders ' + Math.round(planMs) + ' ms; ' + sim.stats.farTicks + ' far / ' + sim.stats.nearTicks + ' near army-seconds');
  assert.equal(bad, 0, 'no army ever stood on impassable ground');
  assert.ok(sim.stats.farTicks > sim.stats.nearTicks * 3, 'most armies were far');
  assert.ok(simMs < 3000, 'an hour of 400 marching armies is cheap: ' + Math.round(simMs) + ' ms');
});

console.log('\n' + n + ' checks passed');
