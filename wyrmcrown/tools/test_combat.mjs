// HOLLOW CROWNS — the four partnerships' wizard spells and dragon breaths, in the browser.
// For each pair (Aldric & Pyrrhax, Ilythiel & Verdanthe, Ymra & Skaldfrost, Malkhar & Vorthrax):
//   the spell's fire rate, speed, damage per hit and damage per second (at full rate and when
//   mana runs short) on an unarmoured and an armoured target → the breath's reach and damage
//   per full charge → poison: ticks over time, caps, expires, stops on death and credits the kill
//   → the attacks leave the staff tip and the jaws. Screenshots of each pair's attacks are
//   saved to $SHOTS (if set).
// Needs the repo served (GAME_BASE_URL, default http://127.0.0.1:8766).
// usage: node wyrmcrown/tools/test_combat.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const SHOTS = process.env.SHOTS || '';
const browser = await chromium.launch({ args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
let n = 0;
const step = (name) => { n++; console.log('PASS ' + n + '. ' + name); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ev = (fn, a) => page.evaluate(fn, a);
const PAIRS = { human: 'Aldric & Pyrrhax', elf: 'Ilythiel & Verdanthe', ice: 'Ymra & Skaldfrost', undead: 'Malkhar & Vorthrax' };

// start a war as a realm, and set up a test range: the dragon hovers, a dummy stands ahead
async function range(fk) {
  await ev((fk) => { AS.Settings.testMode = true; AS.App.startMatch(AS.Maps.list[0].id, { faction: fk, difficulty: 'normal' }); }, fk);
  await page.waitForFunction(() => AS.App.state === 'play' && AS.game && AS.game.player, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await ev(() => {
    const g = AS.game, d = g.player;
    // a quiet field: no rival dragons or troops nearby to interfere
    for (const e of g.dragons) if (e !== d) { e.down = 9999; e.x = -99999; }
    // (out in the open, well away from any castle's towers)
    const t = g.playerFaction.townPos, cx = g.map.w / 2, cy = g.map.h / 2, L = Math.hypot(cx - t.x, cy - t.y) || 1;
    d.x = t.x + (cx - t.x) / L * 1700; d.y = t.y + (cy - t.y) / L * 1700;
    for (const b of g.buildings) if (b.alive && Math.hypot(b.x - d.x, b.y - d.y) < 900 && b.shoots) b.shoots = null;
    window.__T = { fire: false, breath: false, ax: d.x + 300, ay: d.y, hx: d.x, hy: d.y, hz: 50 };
    d.pilot = { read(dd, inp) { const T = window.__T; inp.throttle = -1; inp.turn = 0; inp.dive = false; inp.fire = T.fire; inp.breath = T.breath; inp.aimX = T.ax; inp.aimY = T.ay; inp.breathTarget = T.tgt || null; dd.x = T.hx; dd.y = T.hy; dd.z = T.hz; dd.speed = 40; dd.angle = 0; dd.energy = dd.maxEnergy; } };
    for (const u of g.troops) if (Math.hypot(u.x - d.x, u.y - d.y) < 1500) { u.alive = false; u.removed = true; }
    g.godMode = true;
  });
  await page.waitForTimeout(600);
}
// a dummy foe: still, very tough (or as asked), of a rival realm
const dummy = (o) => ev((o) => {
  const g = AS.game, d = g.player, foe = AS.Data.factionOrder.find((k) => k !== g.playerKey && g.factions[k]);
  const u = new AS.Troop(g, 'soldier', foe, d.x + o.dx, d.y + (o.dy || 0), { gen: g.factions[foe].def.troops.soldier.gen });
  u.maxHp = u.hp = o.hp || 1e6; u.armor = o.armor || 0; u.update = function () {}; // (stands still and does nothing)
  g.troops.push(u); g.factions[foe].troops.push(u);
  window.__D = window.__D || []; window.__D.push(u);
  return window.__D.length - 1;
}, o);

try {
  await page.goto(BASE);
  await page.waitForSelector('#menu.show', { timeout: 60000 });
  const R = {};
  for (const fk of ['human', 'elf', 'ice', 'undead']) {
    await range(fk);
    const r = R[fk] = {};
    // ---- the spell: rate, speed, damage
    const id = await dummy({ dx: 240 });
    await ev((id) => { const u = window.__D[id], T = window.__T; T.ax = u.x; T.ay = u.y - 6; window.__casts = 0; window.__speed = 0;
      const cb = AS.Combat.castBolt; AS.Combat.castBolt = function (d, bk) { if (d.isPlayer) window.__casts++; return cb.call(this, d, bk); }; window.__cb = cb;
      const ms = AS.Proj.missile; AS.Proj.missile = function (o) { if (o.owner && o.owner.isPlayer) window.__speed = o.speed; return ms.call(this, o); }; window.__ms = ms; }, id);
    // at full rate (mana kept topped up)
    await ev((id) => { window.__hp0 = window.__D[id].hp; window.__T.fire = true; window.__fill = setInterval(() => { AS.game.player.mana = AS.game.player.maxMana; }, 16); window.__t0 = AS.game.time; }, id);
    await page.waitForTimeout(5000);
    // (damage is read once any poison has run its course, and divided by the time spent firing)
    Object.assign(r, await ev((id) => { const g = AS.game; window.__T.fire = false; clearInterval(window.__fill); window.__tf = g.time - window.__t0;
      return { rate: +(window.__casts / window.__tf).toFixed(2), speed: window.__speed, casts: window.__casts }; }, id));
    await page.waitForTimeout(4300);
    Object.assign(r, await ev((id) => ({ burstDps: +((window.__hp0 - window.__D[id].hp) / window.__tf).toFixed(1) }), id));
    // single hit damage (direct only) and, with mana left to run down, sustained damage per second
    Object.assign(r, await ev((id) => { const g = AS.game, d = g.player, u = window.__D[id], bk = AS.Combat.BOLT[d.fdef.rider.bolt];
      return { kind: bk.kind, hit: +(bk.dmg * d.boltDmg).toFixed(1), mana: bk.mana, poison: !!bk.poison }; }, id));
    await ev((id) => { const g = AS.game; g.player.mana = 0; window.__hp0 = window.__D[id].hp; window.__T.fire = true; window.__t0 = g.time; }, id);
    await page.waitForTimeout(12000);
    await ev(() => { window.__T.fire = false; window.__tf = AS.game.time - window.__t0; });
    await page.waitForTimeout(4300);
    Object.assign(r, await ev((id) => ({ sustDps: +((window.__hp0 - window.__D[id].hp) / window.__tf).toFixed(1) }), id));
    // armoured target (armour 3): how much of a full-rate burst survives
    const ida = await dummy({ dx: 240, dy: 60, armor: 3 });
    await ev((id) => { const u = window.__D[id], T = window.__T; T.ax = u.x; T.ay = u.y - 6; window.__hp0 = u.hp; T.fire = true; window.__fill = setInterval(() => { AS.game.player.mana = AS.game.player.maxMana; }, 16); window.__t0 = AS.game.time; }, ida);
    await page.waitForTimeout(4000);
    await ev(() => { window.__T.fire = false; clearInterval(window.__fill); window.__tf = AS.game.time - window.__t0; });
    await page.waitForTimeout(4300);
    Object.assign(r, await ev((id) => ({ armDps: +((window.__hp0 - window.__D[id].hp) / window.__tf).toFixed(1) }), ida));
    // the spell leaves the staff tip (the bolt's first point is where the staff was last drawn)
    r.origin = await ev(() => { const d = AS.game.player, st = d.drawState; return { staff: st.staffX !== undefined, dx: Math.round(st.staffX - d.x), dy: Math.round(st.staffY - (d.y - d.z)) }; });
    // screenshot: spells in flight
    if (SHOTS) {
      await ev(() => { AS.game.camera.baseZoom = 1.8; window.__T.fire = true; window.__fill = setInterval(() => { AS.game.player.mana = AS.game.player.maxMana; }, 16); });
      await page.waitForTimeout(700);
      await page.screenshot({ path: SHOTS + '/spell_' + fk + '.png' });
      await ev(() => { window.__T.fire = false; clearInterval(window.__fill); });
    }
    await ev(() => { AS.Combat.castBolt = window.__cb; AS.Proj.missile = window.__ms; });
    await page.waitForTimeout(4500);

    // ---- the breath: reach and damage per full charge
    Object.assign(r, await ev(() => { const d = AS.game.player, B = AS.Data.breaths[d.fdef.dragon.breath]; d.breathTarget = null; const bi = AS.Combat.breathInfo(d); return { breath: B.name, L: Math.round(bi.L), drain: B.drain }; }));
    // a target just beyond Pyrrhax's reach (1.2× the baseline) is burnt only by a longer breath
    const far = await ev(() => { const d = AS.game.player, hd = d.nodes[0]; const L0 = 150 * d.scale * (1 + 0) ; return Math.round(hd.x - d.x + 14 * d.scale + 150 * d.scale * 1.2); });
    const idf = await dummy({ dx: far });
    const idn = await dummy({ dx: 90, dy: 4 });
    await ev(([a, b]) => { const g = AS.game, d = g.player, T = window.__T; T.ax = window.__D[a].x; T.ay = window.__D[a].y; d.fireCharge = d.maxFire; d.breathT = 0; window.__f0 = window.__D[a].hp; window.__n0 = window.__D[b].hp; T.breath = true; window.__t0 = g.time; }, [idf, idn]);
    await page.waitForFunction(() => !AS.game.player.breathing && AS.game.time - window.__t0 > 0.5, null, { timeout: 15000 });
    await ev(() => { window.__T.breath = false; window.__tb = AS.game.time - window.__t0; });
    await page.waitForTimeout(3300); // (the plague breath's poison runs out)
    Object.assign(r, await ev(([a, b]) => ({ breathSecs: +window.__tb.toFixed(2), farHit: Math.round(window.__f0 - window.__D[a].hp), nearCharge: Math.round(window.__n0 - window.__D[b].hp) }), [idf, idn]));
    // screenshot: the breath
    if (SHOTS) {
      await page.waitForTimeout(4500);
      await ev(() => { const d = AS.game.player; d.fireCharge = d.maxFire; AS.game.camera.baseZoom = 1.6; window.__T.ax = d.x + 160; window.__T.ay = d.y + 40; window.__T.breath = true; });
      await page.waitForTimeout(650);
      await page.screenshot({ path: SHOTS + '/breath_' + fk + '.png' });
      await ev(() => { window.__T.breath = false; });
    }
    // the breath leaves the jaws: its first point is the head, a little ahead of it
    r.mouth = await ev(() => { const d = AS.game.player, hd = d.nodes[0], bi = AS.Combat.breathInfo(d); return Math.round(Math.hypot(bi.mx - hd.x, bi.my - hd.y)); });
    await ev(() => { window.__D = []; });
  }
  for (const fk in R) console.log(fk.padEnd(7), JSON.stringify(R[fk]));

  // ---- spells
  const H = R.human, E = R.elf, I = R.ice, X = R.undead;
  ok(H.kind === 'sphere' && E.kind === 'arrow' && I.kind === 'shard' && X.kind === 'orb', 'kinds');
  step('each rider has its own spell: ' + Object.keys(R).map((k) => PAIRS[k].split(' ')[0] + ' ' + R[k].kind).join(', '));
  ok(E.speed > H.speed && H.speed > I.speed && I.speed > X.speed, 'speeds ' + [H.speed, E.speed, I.speed, X.speed]);
  step('speeds differ: arrows ' + E.speed + ' > spheres ' + H.speed + ' > shards ' + I.speed + ' > orbs ' + X.speed);
  ok(E.rate > H.rate && H.rate > X.rate && X.rate > I.rate, 'rates ' + [H.rate, E.rate, I.rate, X.rate]);
  step('fire rates differ: arrows ' + E.rate + '/s, spheres ' + H.rate + '/s, orbs ' + X.rate + '/s, shards ' + I.rate + '/s');
  ok(I.hit > H.hit && H.hit > X.hit && X.hit > E.hit, 'hits');
  step('ice shards hit hardest (' + I.hit + '), then spheres (' + H.hit + '), orbs (' + X.hit + ' + poison), arrows (' + E.hit + ')');
  const within = (vals, tol) => Math.max(...vals) / Math.min(...vals) <= 1 + tol;
  const burst = [H, E, I, X].map((q) => q.burstDps), sust = [H, E, I, X].map((q) => q.sustDps), arm = [H, E, I, X].map((q) => q.armDps);
  ok(within(burst, 0.25), 'burst dps ' + burst);
  step('damage per second at full rate is balanced: ' + burst.join(' / '));
  ok(within(sust, 0.25), 'sustained dps ' + sust);
  step('damage per second when mana runs short is balanced: ' + sust.join(' / '));
  ok(within(arm, 0.3), 'armoured dps ' + arm);
  step('against armour (3) too: ' + arm.join(' / '));
  ok([H, E, I, X].every((q) => q.origin.staff && Math.abs(q.origin.dx) < 60 && q.origin.dy < 10 && q.origin.dy > -90), 'origins ' + JSON.stringify([H, E, I, X].map((q) => q.origin)));
  step('every spell leaves the staff tip (offsets from the dragon ' + [H, E, I, X].map((q) => q.origin.dx + ',' + q.origin.dy).join('; ') + ')');

  // ---- breath
  ok(E.L > H.L * 1.3 && I.L < H.L && E.farHit > 0 && H.farHit === 0 && I.farHit === 0, 'reach ' + JSON.stringify([H.L, E.L, I.L, X.L, H.farHit, E.farHit, I.farHit]));
  step('Verdanthe\'s emerald flame truly reaches further (' + E.L + ' vs Pyrrhax ' + H.L + ', Skaldfrost ' + I.L + '): only it burns a target ' + Math.round(H.L * 1.2) + ' away');
  ok(I.nearCharge / I.breathSecs > H.nearCharge / H.breathSecs && E.nearCharge / E.breathSecs < H.nearCharge / H.breathSecs, 'breath dps');
  step('direct breath damage per second: Skaldfrost ' + Math.round(I.nearCharge / I.breathSecs) + ' > Pyrrhax ' + Math.round(H.nearCharge / H.breathSecs) + ' > Verdanthe ' + Math.round(E.nearCharge / E.breathSecs));
  const charge = [H, E, I, X].map((q) => q.nearCharge);
  ok(within(charge, 0.3), 'per charge ' + charge);
  step('damage per full breath charge is balanced (with Vorthrax\'s poison counted): ' + charge.join(' / '));
  ok([H, E, I, X].every((q) => q.mouth > 0 && q.mouth < 30), 'mouth');
  step('every breath leaves the jaws (' + [H, E, I, X].map((q) => q.mouth).join(', ') + ' units ahead of the head)');

  // ---- poison
  await range('undead');
  const pid = await dummy({ dx: 200, hp: 1000 });
  const p1 = await ev((id) => { const g = AS.game, u = window.__D[id], d = g.player; AS.Poison.orb(g, u, d); return { hp: u.hp, t: g.time }; }, pid);
  await page.waitForTimeout(2000);
  const p2 = await ev((id) => { const u = window.__D[id]; return { hp: u.hp, active: AS.Poison.active(u) }; }, pid);
  await page.waitForTimeout(2600);
  const p3 = await ev((id) => { const u = window.__D[id]; return { hp: u.hp, active: AS.Poison.active(u) }; }, pid);
  await page.waitForTimeout(1200);
  const p4 = await ev((id) => { const u = window.__D[id]; return { hp: u.hp }; }, pid);
  ok(p2.hp < p1.hp && p2.active && !p3.active && Math.abs((p1.hp - p3.hp) - 9.6) < 1.3 && p4.hp === p3.hp, 'poison ' + JSON.stringify([p1, p2, p3, p4]));
  step('a poison orb deals its damage over time (' + (p1.hp - p2.hp).toFixed(1) + ' after 2 s, ' + (p1.hp - p3.hp).toFixed(1) + ' in all) and then stops');
  const cap = await ev((id) => { const g = AS.game, u = window.__D[id]; for (let i = 0; i < 20; i++) AS.Poison.orb(g, u, g.player); return AS.Poison.map.get(u).orb.length; }, pid);
  ok(cap === 12, 'cap ' + cap);
  step('stacking is capped: 20 hits in a row leave ' + cap + ' stacks (a hit at the cap refreshes the oldest)');
  const kill = await ev((id) => { const g = AS.game, u = window.__D[id]; u.hp = 3; return id; }, pid);
  await page.waitForTimeout(1200);
  const k1 = await ev((id) => { const g = AS.game, u = window.__D[id]; return { alive: u.alive, by: u.lastHitBy === g.player, tracked: AS.Poison.map.has(u) }; }, kill);
  ok(!k1.alive && k1.by && !k1.tracked, 'kill ' + JSON.stringify(k1));
  step('poison kills are credited to the dragon that poisoned, and a dead target stops receiving damage');
  const br = await ev(() => { const g = AS.game, d = g.player, u = new AS.Troop(g, 'soldier', 'human', d.x + 120, d.y, {}); u.maxHp = u.hp = 1000; u.update = function () {}; g.troops.push(u); window.__B = u; AS.Combat.applyEffect(u, 'wither', d, 16); AS.Combat.applyEffect(u, 'wither', d, 16); AS.Combat.applyEffect(u, 'wither', d, 8); return AS.Poison.map.get(u).brDps; });
  await page.waitForTimeout(3600);
  const br2 = await ev(() => ({ hp: window.__B.hp, active: AS.Poison.active(window.__B) }));
  ok(br === 16 && !br2.active && Math.abs((1000 - br2.hp) - 48) < 5, 'breath poison ' + br + ' ' + JSON.stringify(br2));
  step('plague breath poison refreshes without stacking (16/s, ' + Math.round(1000 - br2.hp) + ' over 3 s) and ends');

  ok(!errors.length, 'page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + n + ' steps passed, no page errors');
} catch (e) {
  console.log('FAIL after ' + n + ' steps: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: (process.env.TMPDIR || '/tmp') + '/combat_fail.png' }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
