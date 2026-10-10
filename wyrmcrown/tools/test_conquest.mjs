/* WYRMCROWN — CONQUEST contract tests (no browser): campaign state, versioned
 * saves, leadership / wages / recruitment rules, data integrity, the seeded
 * archipelago generator (and its guarantees over 1,000+ seeds), the campaign
 * map rules (movement, fog, the clock, income, wages, desertion, hiring, the
 * ship, captures, victory), battle configuration and battle results.
 * usage: node wyrmcrown/tools/test_conquest.mjs   (SEEDS=n to change the sweep) */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engine = path.resolve(root, '../alien-strike');

// an in-memory Storage for the save tests
class Mem { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
const AS = {};
const context = vm.createContext({ window: { AS }, console, Math, Map, Set, JSON, Date, Object, Array, Number, String, Float32Array, Uint8Array, Int8Array });
const load = (file) => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
load(path.join(engine, 'src/core/util.js'));
AS.Data = AS.Data || {};
for (const f of ['data/palettes.js', 'data/factions.js', 'data/buildings.js', 'data/sites.js']) load(path.join(root, f));
for (const f of ['conquest/conquest.js', 'conquest/data/allegiances.js', 'conquest/data/troops.js', 'conquest/data/sites.js', 'conquest/data/world.js', 'conquest/core/rules.js', 'conquest/core/worldgen.js', 'conquest/core/world.js', 'conquest/core/campaign.js', 'conquest/core/save.js', 'conquest/core/battle.js']) load(path.join(root, f));
const C = AS.Conquest, R = C.Rules, G = C.WorldGen, W = C.World, D = C.Data;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS ' + name); };

ok('data: every troop type is well formed and reuses battle-mode stats', () => {
  const src = fs.readdirSync(path.join(root, 'src/gfx')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(root, 'src/gfx', f), 'utf8')).join('\n') + fs.readFileSync(path.join(root, 'src/game/life.js'), 'utf8');
  for (const t of C.Data.troopList) {
    assert.ok(AS.Data.troops[t.base], t.id + ': base ' + t.base + ' is a battle-mode troop');
    assert.ok(C.Data.allegiances[t.allegiance], t.id + ': allegiance');
    assert.ok(t.leadership > 0 && t.cost > 0 && t.wage >= 0, t.id + ': leadership/cost/wage');
    assert.ok(t.sites.length && t.sites.every((s) => C.Data.recruitSites[s]), t.id + ': recruitment sites exist');
    if (t.allegiance === 'neutral') assert.ok(['beast', 'brute', 'giant', 'fey', 'dead'].includes(t.tag), t.id + ': neutral tag');
    if (t.gen) assert.ok(src.includes(t.gen), t.id + ': model ' + t.gen + ' exists');
  }
  assert.equal(C.Data.troops.n_wyvern.gen, null, 'wyvern art is pending (no model yet)');
  for (const k in C.Data.territories) { const tk = C.Data.territories[k]; if (tk.battleSite) assert.ok(AS.Data.sites[tk.battleSite], k + ': battle site ' + tk.battleSite); }
});

ok('campaign: a new campaign starts poor, with no army, one to three Dragon Lords', () => {
  const s = C.Campaign.create({ seed: 12345, allegiance: 'elf' });
  assert.equal(s.hero.allegiance, 'elf');
  assert.equal(s.army.stacks.length, 0);
  assert.equal(s.economy.gold, R.CFG.startGold);
  assert.ok(s.objectives.lords.length >= 1 && s.objectives.lords.length <= 3);
  assert.ok(s.objectives.lords.every((l) => l.allegiance !== 'elf' && C.Data.realmKeys.includes(l.allegiance)));
  assert.equal(C.Save.validate(s).join(', '), '');
  assert.equal(C.Campaign.isWon(s), false);
});

ok('campaign: the same seed gives the same Dragon Lords; the odds favour one lord', () => {
  const a = C.Campaign.create({ seed: 777 }), b = C.Campaign.create({ seed: 777 });
  assert.equal(JSON.stringify(a.objectives.lords), JSON.stringify(b.objectives.lords));
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 2000; i++) counts[C.Campaign.create({ seed: i * 7919 + 1, bare: true }).objectives.lords.length]++;
  assert.ok(counts[1] > counts[2] && counts[2] > counts[3] && counts[3] > 0, 'lord counts ' + JSON.stringify(counts));
});

ok('rules: own-realm and neutral troops can be recruited, opposing realms never', () => {
  assert.equal(R.recruitTerms('human', 'h_soldier').ok, true);
  assert.equal(R.recruitTerms('human', 'e_warden').ok, false);
  assert.equal(R.recruitTerms('human', 'n_wolf').cost, C.Data.troops.n_wolf.cost);
  assert.equal(R.recruitTerms('elf', 'n_shambler').cost, Math.round(C.Data.troops.n_shambler.cost * 0.85), 'elves pay less for fey');
  assert.equal(R.recruitTerms('human', 'n_corpsegiant').ok, false, 'the living refuse the dead');
  assert.equal(R.recruitTerms('undead', 'n_corpsegiant').ok, true);
});

ok('rules: leadership and gold both cap the army; site stock is respected', () => {
  const s = C.Campaign.create({ seed: 1, allegiance: 'human' });
  const site = { kind: 'village', stock: { h_soldier: 10 } };
  assert.equal(R.canRecruit(s, 'h_soldier', 4, site).ok, true);
  R.recruit(s, 'h_soldier', 4, site);
  assert.equal(R.leadershipUsed(s.army), 40);
  assert.equal(site.stock.h_soldier, 6);
  assert.equal(s.economy.gold, R.CFG.startGold - 120);
  assert.equal(R.canRecruit(s, 'h_soldier', 3, site).reason, 'Not enough leadership'); // 40 + 30 > 60
  s.hero.leadership = 1000;
  assert.equal(R.canRecruit(s, 'h_soldier', 6, site).reason, 'Not enough gold');    // 180 > 130
  assert.equal(R.canRecruit(s, 'h_soldier', 7, site).reason, 'Only 6 available');
  assert.equal(R.canRecruit(s, 'h_archer', 1, site).reason, 'Not recruited here');
});

ok('rules: a day pays income and wages; unpaid troops desert, costliest first', () => {
  const s = C.Campaign.create({ seed: 2, allegiance: 'human', bare: true });
  s.hero.leadership = 1000; s.economy.gold = 1000;
  R.recruit(s, 'h_knight', 2, null); R.recruit(s, 'h_soldier', 3, null);
  s.territories.f1 = { kind: 'farm', owner: 'player', island: 0 };
  const g0 = s.economy.gold, res = R.endOfDay(s);
  assert.equal(res.wages, 2 * 9 + 3 * 2);
  assert.equal(s.economy.gold, g0 + 6 - 24);
  assert.equal(s.economy.day, 2);
  s.economy.gold = 5;
  const r2 = R.endOfDay(s);
  assert.ok(r2.deserted.length && r2.deserted[0] === 'h_knight');
  assert.ok(s.economy.gold >= 0);
});

ok('save: round trip through storage, slot isolation, delete', () => {
  C.Save.storage = new Mem();
  const s = C.Campaign.create({ seed: 99, allegiance: 'ice' });
  assert.equal(C.Save.save(2, s).ok, true);
  const r = C.Save.load(2);
  assert.ok(r.state); assert.equal(r.state.seed, 99); assert.equal(r.state.hero.allegiance, 'ice');
  assert.equal(C.Save.load(1).error, 'empty');
  assert.ok(C.Save.storage.getItem('wyrmcrown.conquest.slot2'));
  assert.equal(C.Save.storage.getItem('wyrmcrown.profile.v1'), null, 'never touches the battle-mode profile');
  C.Save.remove(2); assert.equal(C.Save.load(2).error, 'empty');
});

ok('save: older records migrate, newer and damaged ones are refused (and kept)', () => {
  C.Save.storage = new Mem();
  const v1 = C.Campaign.create({ seed: 5 });
  const v0 = JSON.parse(JSON.stringify(v1)); delete v0.version; v0.gold = 77; v0.day = 3; delete v0.economy;
  const m = C.Save.parse(JSON.stringify(v0));
  assert.ok(m.state, 'v0 migrates: ' + m.error); assert.equal(m.state.economy.gold, 77); assert.equal(m.state.version, C.Save.SCHEMA_VERSION);
  const future = Object.assign({}, v1, { version: C.Save.SCHEMA_VERSION + 1 });
  assert.match(C.Save.parse(JSON.stringify(future)).error, /newer/);
  C.Save.storage.setItem(C.Save.keyOf(1), '{not json');
  assert.equal(C.Save.load(1).error, 'unreadable');
  assert.equal(C.Save.storage.getItem(C.Save.keyOf(1) + '.damaged'), '{not json', 'damaged save kept');
  const bad = JSON.parse(JSON.stringify(v1)); bad.army.stacks.push({ troop: 'nonsense', count: 2 });
  assert.match(C.Save.parse(JSON.stringify(bad)).error, /army/);
  assert.equal(C.Save.save(3, bad).ok, false, 'an invalid campaign is never written');
});


/* ======================= Phase 2: the archipelago ======================= */
const lordsFor = (seed, alleg) => C.Campaign.create({ seed, allegiance: alleg, bare: true }).objectives.lords;
const worldFor = (seed, alleg) => G.generate(seed, { allegiance: alleg, lords: lordsFor(seed, alleg) });
const fresh = (seed, alleg) => { W.forget(); return C.Campaign.create({ seed, allegiance: alleg || 'human' }); };
const sig = (w) => JSON.stringify({ s: w.sites.map((q) => [q.id, q.kind, q.owner, q.x, q.y, q.garrison]), r: w.routes, i: w.islands });

ok('generation: the same seed gives the same world, every time', () => {
  for (const seed of [1, 202, 99999, 4294967295]) assert.equal(sig(worldFor(seed, 'elf')), sig(worldFor(seed, 'elf')), 'seed ' + seed);
});

ok('generation: different seeds give genuinely different worlds', () => {
  const styles = new Set(), sizes = new Set(), sigs = new Set();
  for (let i = 0; i < 60; i++) { const w = worldFor(i * 1013 + 7, 'human'); styles.add(w.style); sizes.add(w.sites.length); sigs.add(sig(w)); }
  assert.equal(sigs.size, 60, 'every seed distinct');
  assert.ok(styles.size >= 4, 'all four landmass styles occur: ' + [...styles]);
  assert.ok(sizes.size >= 8, 'site counts vary: ' + [...sizes]);
  // the harbour's direction from the start varies (the layout is turned)
  const dirs = new Set(); for (let i = 0; i < 40; i++) { const w = worldFor(i * 37 + 3, 'ice'), ix = G.index(w), a = Math.atan2(ix.byId[w.harbour].y - ix.byId[w.start].y, ix.byId[w.harbour].x - ix.byId[w.start].x); dirs.add(Math.round((a + Math.PI) / (Math.PI / 2)) % 4); }
  assert.equal(dirs.size, 4, 'harbours lie north, south, east and west of the start');
});

const SEEDS = +(process.env.SEEDS || 1000);
const sweep = { tested: 0, firstTryInvalid: 0, regenerated: 0, stillInvalid: 0, reasons: {} };
ok('generation: ' + SEEDS + ' seeds, every progression guarantee holds (zero broken campaigns)', () => {
  for (let i = 0; i < SEEDS; i++) {
    const seed = (Math.imul(i + 1, 2654435761)) >>> 0, alleg = D.realmKeys[i % 4];
    const w = worldFor(seed, alleg);
    sweep.tested++;
    if (w.attempts > 1) { sweep.firstTryInvalid++; sweep.regenerated++; }
    if (w.problems.length) { sweep.stillInvalid++; for (const p of w.problems) sweep.reasons[p] = (sweep.reasons[p] || 0) + 1; }
  }
  assert.equal(sweep.stillInvalid, 0, 'unrecoverable: ' + JSON.stringify(sweep.reasons));
  console.log('      sweep: ' + JSON.stringify(sweep));
});

ok('generation: the guarantees, checked one by one on a world', () => {
  const w = worldFor(31337, 'undead'), ix = G.index(w);
  const start = ix.byId[w.start];
  assert.equal(start.owner, 'player');
  assert.ok(Object.keys(start.stock).every((k) => D.troops[k].allegiance === 'undead'), 'starter recruits are the player\'s own');
  assert.ok(ix.adj[start.id].some((e) => ix.byId[e.to].kind === 'farm'), 'a farm next to the start');
  // the first bridges are the only way into the early zone
  const fb = new Set(w.gates.firstBridges);
  assert.ok(fb.size >= 1);
  assert.ok(w.sites.filter((q) => q.zone === 1).every((q) => !G.reach(w, w.start, { without: fb }).has(q.id)));
  // the castle is the only way to the harbour; the harbour is reachable by land
  assert.ok(!G.reach(w, w.start, { without: new Set([w.castle]) }).has(w.harbour));
  assert.ok(G.reach(w, w.start).has(w.harbour));
  // the Lords lie beyond the sea
  for (const L of w.lords) { assert.ok(!G.reach(w, w.start).has(L.stronghold)); assert.ok(G.reach(w, w.start, { sea: true }).has(L.stronghold)); }
  // garrisons and stock name real troops; threat grows with the tiers
  for (const q of w.sites) for (const [id] of q.garrison) assert.ok(D.troops[id], id);
  const avg = (t) => { const L = w.sites.filter((q) => q.tier === t && q.garrison.length); return L.reduce((a, q) => a + G.strength(q.garrison), 0) / L.length; };
  assert.ok(avg(0) < avg(3) && avg(3) < avg(7), 'threat rises toward the final fortress');
  assert.ok(w.sites.length >= 20 && w.sites.length <= 48);
});

ok('Dragon Lords: one primary per campaign, whose fortress is the final objective; extra Lords hold their own islands', () => {
  let multi = 0;
  for (let i = 0; i < 300; i++) {
    const st = C.Campaign.create({ seed: i * 104729 + 5, allegiance: 'human', bare: true });
    const w = G.generate(st.seed, { allegiance: 'human', lords: st.objectives.lords });
    assert.equal(w.lords.filter((L) => L.primary).length, 1);
    assert.equal(w.lords.find((L) => L.primary).stronghold, w.final);
    assert.equal(new Set(w.lords.map((L) => L.island)).size, w.lords.length, 'each Lord on an island of its own');
    if (w.lords.length > 1) multi++;
  }
  assert.ok(multi > 30 && multi < 170, 'two or three Lords sometimes (' + multi + '/300), one Lord most often');
});

ok('campaign: a new campaign is placed in its world (start, fog, clock, Lords)', () => {
  const st = fresh(555, 'ice'), w = W.of(st);
  assert.equal(st.army.at, w.start);
  assert.equal(st.world.generated, true);
  assert.equal(st.economy.hour, D.world.dayStart);
  assert.ok(st.world.explored.includes(w.start));
  assert.ok(!st.world.explored.includes(w.final), 'the final fortress starts hidden');
  assert.ok(!st.world.explored.includes(w.harbour), 'the harbour starts hidden');
  assert.ok(st.objectives.lords.every((l) => l.stronghold && st.territories[l.stronghold]));
  assert.equal(C.Save.validate(st).join('; '), '');
  assert.ok(JSON.stringify(st).length < 20000, 'compact save (' + JSON.stringify(st).length + ' bytes)');
});

ok('movement: only along routes from where the army is; hostile = battle; friendly = march', () => {
  const st = fresh(202), w = W.of(st), ix = G.index(w);
  const far = w.final;
  assert.equal(W.canMove(st, far).ok, false);
  const nb = ix.adj[st.army.at].map((e) => e.to);
  const hostile = nb.find((id) => W.hostile(st, id));
  assert.ok(hostile, 'a defended neighbour');
  const r = W.move(st, hostile);
  assert.equal(r.battle, true); assert.equal(st.army.at, w.start, 'an attack does not move the army by itself');
  // clear it and walk in: claimed, time passes, the army moves, the land beyond is seen
  st.sites[hostile].garrison = [];
  const h0 = st.economy.hour, g0 = st.economy.gold;
  const m = W.move(st, hostile);
  assert.ok(m.moved); assert.equal(st.army.at, hostile); assert.equal(st.territories[hostile].owner, 'player');
  assert.ok(st.economy.hour !== h0 || st.economy.day > 1);
  assert.ok(st.economy.gold > g0, 'claim reward paid');
  for (const e of ix.adj[hostile]) assert.ok(st.world.explored.includes(e.to), 'neighbours revealed');
});

ok('fog: discovery spreads with the army and is never forgotten', () => {
  const st = fresh(8080), w = W.of(st);
  const before = st.world.explored.length;
  const nb = W.neighbours(st, st.army.at).map((e) => e.to);
  const tgt = nb.find((id) => !W.hostile(st, id)) || nb[0];
  st.sites[tgt].garrison = [];
  W.move(st, tgt);
  assert.ok(st.world.explored.length >= before);
  const kept = st.world.explored.slice();
  W.move(st, w.start);
  for (const id of kept) assert.ok(st.world.explored.includes(id));
  assert.equal(W.canMove(st, w.final).reason, 'No route from here');
});

ok('hiring: only where the army stands, at its own or a free village, from finite stock', () => {
  const st = fresh(77, 'human'), w = W.of(st);
  const stock0 = st.sites[w.start].stock.h_soldier;
  assert.ok(stock0 > 0);
  const r = W.recruit(st, 'h_soldier', 2);
  assert.equal(r.ok, true);
  assert.equal(st.sites[w.start].stock.h_soldier, stock0 - 2);
  assert.equal(R.recruit(st, 'h_soldier', 1, { kind: 'village', stock: {} }).ok, false, 'no stock, no recruit');
  assert.equal(W.recruit(st, 'h_soldier', 999).ok, false, 'cannot exceed stock');
  assert.equal(W.recruit(st, 'e_warden', 1).ok, false, 'rival realm troops never');
  // a hostile site does not hire
  const hostile = W.neighbours(st, st.army.at).map((e) => e.to).find((id) => W.hostile(st, id));
  st.army.at = hostile;
  assert.equal(W.recruitSite(st), null);
});

ok('the clock: hours pass, days end with income in, wages out, stock refilled', () => {
  const st = fresh(4242, 'human'), w = W.of(st);
  W.recruit(st, 'h_soldier', 3);
  const left = st.sites[w.start].stock.h_soldier;
  const inc = R.incomePerDay(st), wag = R.wagesPerDay(st.army);
  assert.ok(inc > 0 && wag > 0);
  const g0 = st.economy.gold, d0 = st.economy.day;
  const reps = W.advance(st, 24);
  assert.equal(reps.length, 1); assert.equal(st.economy.day, d0 + 1);
  assert.equal(st.economy.gold, g0 + inc - wag);
  assert.equal(reps[0].net, inc - wag);
  for (let i = 0; i < 6; i++) W.advance(st, 24);
  assert.ok(st.sites[w.start].stock.h_soldier > left, 'stock refilled on schedule');
  assert.ok(st.log.some((l) => /income \+/.test(l.t)), 'each day is reported');
});

ok('wages: an army that cannot be paid deserts (reported, costliest first)', () => {
  const st = fresh(1234, 'human');
  st.hero.leadership = 1000;
  st.army.stacks = [{ troop: 'h_knight', count: 3 }, { troop: 'h_soldier', count: 4 }];
  st.economy.gold = 0;
  for (const id in st.territories) if (st.territories[id].owner === 'player') st.territories[id].owner = 'neutral'; // no income
  const [rep] = W.advance(st, 24);
  assert.ok(rep.deserted.length > 0 && rep.deserted[0] === 'h_knight');
  assert.ok(st.economy.gold >= 0);
  assert.ok(/deserted/.test(st.log[st.log.length - 1].t));
});

ok('ship: needs a harbour you hold and its price; sea routes stay shut without it', () => {
  const st = fresh(2024, 'elf'), w = W.of(st);
  assert.equal(W.shipTerms(st).ok, false);
  st.army.at = w.harbour; st.territories[w.harbour].owner = 'neutral';
  assert.equal(W.shipTerms(st).reason, 'Take the harbour first');
  st.territories[w.harbour].owner = 'player'; st.economy.gold = D.world.ship.cost - 1;
  assert.match(W.shipTerms(st).reason, /Needs/);
  W.look(st, w.harbour);
  const sea = W.neighbours(st, w.harbour).find((e) => e.type === 'sea');
  assert.equal(W.canMove(st, sea.to).reason, 'Needs a ship');
  st.economy.gold = D.world.ship.cost + 5;
  assert.equal(W.buyShip(st).ok, true);
  assert.equal(st.economy.gold, 5);
  assert.equal(W.canMove(st, sea.to).ok, true, 'sea route open after the ship');
  assert.equal(W.shipTerms(st).owned, true);
});

ok('battles: a victory captures and pays; a defeat keeps the defenders who lived; losses persist', () => {
  const st = fresh(606, 'human'), w = W.of(st);
  st.hero.leadership = 500;
  st.army.stacks = [{ troop: 'h_soldier', count: 6 }, { troop: 'h_archer', count: 2 }];
  const tgt = W.neighbours(st, st.army.at).map((e) => e.to).find((id) => W.hostile(st, id));
  const garrison = st.sites[tgt].garrison.map((g) => g.slice());
  // defeat: four soldiers lost, one defender of the first stack lost
  const enemy = {}; for (const [id, c] of garrison) enemy[id] = c; enemy[garrison[0][0]] = Math.max(0, enemy[garrison[0][0]] - 1);
  const d0 = st.economy.day, h0 = st.economy.hour;
  W.applyBattle(st, tgt, { won: false, survivors: { h_soldier: 2, h_archer: 2 }, enemy, hours: 12 });
  assert.equal(st.army.at, w.start, 'the army stays where it marched from');
  assert.equal(st.army.stacks.find((q) => q.troop === 'h_soldier').count, 2, 'casualties persist');
  assert.equal(st.territories[tgt].owner !== 'player', true);
  assert.equal(G.units(st.sites[tgt].garrison), G.units(garrison) - (garrison[0][1] > 0 ? 1 : 0), 'the defenders\' losses persist too');
  assert.ok(st.economy.day > d0 || st.economy.hour === h0 + 12);
  // victory
  const g0 = st.economy.gold, l0 = st.hero.leadership, rw = W.site(st, tgt).reward;
  W.applyBattle(st, tgt, { won: true, survivors: { h_soldier: 1, h_archer: 2 }, enemy: {}, hours: 12 });
  assert.equal(st.territories[tgt].owner, 'player');
  assert.equal(st.army.at, tgt);
  assert.equal(st.sites[tgt].garrison.length, 0);
  assert.ok(st.economy.gold >= g0 + rw.gold - 50, 'spoils paid');
  assert.equal(st.hero.leadership, l0 + rw.leadership);
  assert.equal(st.stats.battles, 2); assert.equal(st.stats.won, 1);
  // a site's reward is paid once only
  st.territories[tgt].owner = 'neutral'; st.sites[tgt].garrison = [['n_wolf', 1]];
  const g1 = st.economy.gold;
  W.applyBattle(st, tgt, { won: true, survivors: { h_soldier: 1 }, enemy: {}, hours: 0 });
  assert.equal(st.economy.gold, g1 + 0, 'no second reward for retaking');
});

ok('victory: the primary Lord\'s fortress ends the campaign; another Lord\'s does not', () => {
  let tested = 0;
  for (let i = 0; i < 200 && tested < 3; i++) {
    const st = fresh(i * 7 + 11, 'human');
    if (st.objectives.lords.length < 2) continue;
    tested++;
    const other = st.objectives.lords.find((l) => !l.primary), main = st.objectives.lords.find((l) => l.primary);
    W.capture(st, other.stronghold, 'won');
    assert.equal(other.defeated, true); assert.equal(W.isWon(st), false); assert.equal(C.Campaign.isWon(st), false);
    W.capture(st, main.stronghold, 'won');
    assert.equal(W.isWon(st), true); assert.ok(st.flags.won);
  }
  assert.ok(tested >= 1);
});

ok('playthrough: on 40 seeds a legal march from the start reaches and takes the main fortress (no dead ends)', () => {
  // every attack is won (the oracle stands in for the battles); the ship is paid for with gold earned by resting
  const stuck = [];
  for (let i = 0; i < 40; i++) {
    const st = fresh(i * 7907 + 17, D.realmKeys[i % 4]), w = W.of(st), ix = G.index(w);
    let steps = 0;
    while (!W.isWon(st) && steps++ < 600) {
      if (W.shipTerms(st).ok) W.buyShip(st);
      if (!st.army.ship.owned && st.army.at === w.harbour && st.territories[w.harbour].owner === 'player') { W.rest(st); continue; }
      // nearest not-yet-held known site, by a path through held or free sites
      const q = [[st.army.at]], seen = new Set([st.army.at]); let path = null;
      while (q.length && !path) {
        const p = q.shift(), c = p[p.length - 1];
        for (const e of ix.adj[c]) {
          if (seen.has(e.to) || !st.world.explored.includes(e.to) || (e.type === 'sea' && !st.army.ship.owned)) continue;
          seen.add(e.to); const np = p.concat(e.to);
          const o = st.territories[e.to].owner;
          // a place still to take, or one whose surroundings are still unexplored
          if ((o !== 'player' && o !== 'free') || ix.adj[e.to].some((f) => !st.world.explored.includes(f.to) && (f.type !== 'sea' || st.army.ship.owned))) { path = np; break; }
          q.push(np);
        }
      }
      if (!path) {
        // nothing to take in reach: head for the harbour (the ship) if it is ours
        if (st.territories[w.harbour].owner === 'player' && st.army.at !== w.harbour) { st.army.at = w.harbour; continue; }
        stuck.push(st.seed); break;
      }
      const next = path[1];
      const m = W.move(st, next);
      if (m.battle) { const s = {}; for (const x of st.army.stacks) s[x.troop] = x.count; W.applyBattle(st, next, { won: true, survivors: s, enemy: {}, hours: 6 }); }
      else if (!m.ok) { stuck.push(st.seed + ':' + m.reason); break; }
    }
    if (!W.isWon(st)) stuck.push(st.seed + ' not won');
    assert.equal(C.Save.validate(st).join('; '), '');
  }
  assert.deepEqual(stuck, []);
});

ok('battle config: an opt-in description the battle engine can run (island, sea, camp, objective, defenders)', () => {
  const st = fresh(4242, 'elf'), w = W.of(st);
  const kinds = {};
  for (const s of w.sites) if (s.owner !== 'player' && s.owner !== 'free' && !kinds[s.kind]) kinds[s.kind] = s.id;
  for (const kind in kinds) {
    const cfg = C.Battle.config(st, kinds[kind]), m = cfg.map;
    assert.ok(m.factions.elf && m.factions.elf.town, kind + ': the player\'s camp');
    assert.ok(m.lakes.length && m.islands.length, kind + ': sea all round, land rising out of it');
    const inLand = (p) => m.islands.some((b) => Math.hypot(p.x - b.x, p.y - b.y) < b.r * 0.85);
    assert.ok(inLand(m.camp) && inLand(m.obj), kind + ': camp and objective on the island');
    if (kind === 'lordhold') { assert.ok(m.factions[cfg.lord], 'the Lord\'s realm is in the battle'); assert.equal(m.sites.length, 0); }
    else { assert.equal(m.sites.length, 1); assert.ok(AS.Data.sites[m.sites[0].k], kind + ': battle site ' + m.sites[0].k + ' exists'); }
    if (kind === 'bridge') { assert.equal(m.bridges.length, 1); assert.equal(m.rivers.length, 1); }
    assert.deepEqual(cfg.garrison, st.sites[kinds[kind]].garrison);
    assert.ok(cfg.garrison.every(([id]) => AS.Data.troops[D.troops[id].base]), kind + ': defenders map to battle troops');
    assert.equal(JSON.stringify(C.Battle.config(st, kinds[kind]).map), JSON.stringify(m), 'the same battlefield every time');
  }
});

ok('save: the world is regenerated from the seed on load; only changes are stored', () => {
  C.Save.storage = new Mem();
  const st = fresh(13579, 'undead');
  W.recruit(st, 'u_skeleton', 3);
  const tgt = W.neighbours(st, st.army.at).map((e) => e.to).find((id) => W.hostile(st, id));
  W.applyBattle(st, tgt, { won: true, survivors: { u_skeleton: 2 }, enemy: {}, hours: 6 });
  const before = sig(W.of(st));
  assert.equal(C.Save.save(1, st).ok, true);
  const raw = C.Save.storage.getItem(C.Save.keyOf(1));
  assert.ok(!raw.includes('"routes"') && !raw.includes('"blobs"'), 'no static world data in the save');
  W.forget();
  const r = C.Save.load(1);
  assert.ok(r.state, r.error);
  assert.equal(sig(W.of(r.state)), before, 'identical world after reload');
  assert.equal(r.state.army.at, tgt); assert.equal(r.state.territories[tgt].owner, 'player');
  assert.equal(JSON.stringify(r.state.army.stacks), JSON.stringify(st.army.stacks));
  assert.equal(r.state.economy.day, st.economy.day); assert.equal(r.state.economy.hour, st.economy.hour);
  assert.equal(JSON.stringify(r.state.world.explored), JSON.stringify(st.world.explored));
});

ok('save: a Phase 1 (v1) campaign migrates into its seed\'s world, keeping its gold, army and hero', () => {
  C.Save.storage = new Mem();
  const v1 = C.Campaign.create({ seed: 24680, allegiance: 'ice', bare: true });
  v1.version = 1; v1.economy = { gold: 333, day: 4 }; v1.army = { stacks: [{ troop: 'i_berserker', count: 2 }], ship: { owned: false, at: null } };
  v1.world = { generated: false, w: 0, h: 0, islands: [], explored: null, progress: 0 };
  for (const l of v1.objectives.lords) delete l.primary;
  delete v1.log;
  C.Save.storage.setItem(C.Save.keyOf(2), JSON.stringify(v1));
  const r = C.Save.load(2);
  assert.ok(r.state, r.error);
  assert.equal(r.state.version, 2);
  assert.equal(r.state.seed, 24680); assert.equal(r.state.economy.gold, 333); assert.equal(r.state.economy.day, 4);
  assert.equal(r.state.army.stacks[0].count, 2);
  assert.equal(r.state.world.generated, true);
  assert.equal(r.state.objectives.lords.filter((l) => l.primary).length, 1);
  assert.equal(sig(W.of(r.state)), sig(worldFor(24680, 'ice')), 'the same world a new campaign with that seed would get');
});

ok('isolation: battle mode never refers to Conquest except through opt-in hooks', () => {
  const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  for (const f of ['src/game/realm.js', 'src/main.js', 'UI/screens.js', 'UI/hud.js']) {
    for (const line of src(f).split('\n')) if (/Conquest/.test(line) && !/^\s*(\/\/|\*)/.test(line)) assert.ok(/opts\.conquest|res\.conquest|AS\.Conquest &&|AS\.Conquest\.UI|conquest &&|const CQ|demoHold|mode=conquest|cqdebug|Conquest battle|Conquest:|Conquest map|A Conquest|CQ\.|Battle\.retreat\(\)/.test(line), f + ': ' + line.trim());
  }
});

console.log('\n' + n + ' passed');
