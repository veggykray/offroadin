/* WYRMCROWN — CONQUEST contract tests (no browser): campaign state, versioned
 * saves, leadership / wages / recruitment rules and data integrity.
 * usage: node wyrmcrown/tools/test_conquest.mjs */
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
for (const f of ['conquest/conquest.js', 'conquest/data/allegiances.js', 'conquest/data/troops.js', 'conquest/data/sites.js', 'conquest/core/rules.js', 'conquest/core/campaign.js', 'conquest/core/save.js']) load(path.join(root, f));
const C = AS.Conquest, R = C.Rules;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS ' + name); };

ok('data: every troop type is well formed and reuses battle-mode stats', () => {
  const src = fs.readdirSync(path.join(root, 'src/gfx')).map((f) => fs.readFileSync(path.join(root, 'src/gfx', f), 'utf8')).join('\n') + fs.readFileSync(path.join(root, 'src/game/life.js'), 'utf8');
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
  for (let i = 0; i < 2000; i++) counts[C.Campaign.create({ seed: i * 7919 + 1 }).objectives.lords.length]++;
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
  const s = C.Campaign.create({ seed: 2, allegiance: 'human' });
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

console.log('\n' + n + ' passed');
