// WYRMCROWN — end-to-end checks of the core loop, driven through the real
// keyboard and mouse: menus → flight → staff bolts → breath → eating →
// capturing a site → holding court → victory and defeat, plus a short all-AI
// war for exceptions. Needs the repo served at http://127.0.0.1:8766
// (e.g. `npx http-server -p 8766` from the repo root).
// usage: node wyrmcrown/tools/test_game.mjs [filter]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = 'http://127.0.0.1:8766/wyrmcrown/index.html';
const filter = process.argv[2] || '';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0;
const results = [];

async function open(query, w = 1280, h = 800) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(BASE + (query || ''));
  if (query && query.includes('map=')) await page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(600);
  return page;
}
async function test(name, fn) {
  if (filter && !name.includes(filter)) return;
  const t0 = Date.now();
  let page = null;
  try {
    page = await fn((p) => (page = p));
    if (page && page.errors.length) throw new Error('page errors: ' + [...new Set(page.errors)].slice(0, 3).join(' | '));
    pass++; results.push('PASS ' + name + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  } catch (e) {
    fail++; results.push('FAIL ' + name + ': ' + e.message.split('\n')[0]);
  }
  if (page) await page.close().catch(() => {});
  console.log(results[results.length - 1]);
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
// wait for game time to pass (robust when the machine is busy and frames are slow)
const play = async (page, secs) => {
  const t0 = await page.evaluate(() => AS.game.time);
  await page.waitForFunction(([t0, secs]) => AS.game.time >= t0 + secs, [t0, secs], { timeout: secs * 1000 * 8 + 4000, polling: 50 });
};
const ev = (page, fn, arg) => page.evaluate(fn, arg);
// screen position (CSS px) of a world point (projected: z lifts it up the screen)
const screenOf = (page, x, y, z) => ev(page, ([x, y, z]) => { const R = AS.Renderer, s = R.worldToScreen(x, y - (z || 0), AS.game.camera); return { x: s.x / R.dpr, y: s.y / R.dpr }; }, [x, y, z || 0]);

await test('menus: title → realm → map → war', async (keep) => {
  const page = keep(await open(''));
  await page.waitForSelector('#menu.show', { timeout: 15000 });
  await page.getByText('Begin a War').click();
  await page.waitForSelector('#select.show');
  ok(await page.locator('.realm-card').count() === 4, 'four realm cards');
  await page.getByText('Choose a Map').click();
  await page.waitForSelector('#maps.show');
  await page.locator('.map-card').first().click();
  await page.getByText('Begin the War').click();
  await page.waitForFunction(() => AS.App.state === 'play' && AS.game, null, { timeout: 30000 });
  const k = await ev(page, () => [AS.game.playerKey, AS.game.factionList.length, AS.game.sites.length]);
  ok(k[0] === 'human' && k[1] === 4 && k[2] > 30, 'match set up: ' + k);
  return page;
});

await test('flight: thrust, bank, dive and climb, brake', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const s0 = await ev(page, () => { const p = AS.game.player; return { v: p.speed, a: p.angle }; });
  await page.keyboard.down('KeyW'); await play(page, 2.2);
  const fast = await ev(page, () => AS.game.player.speed);
  ok(fast > s0.v + 40 && fast > 200, 'W beats the wings faster (' + Math.round(s0.v) + ' → ' + Math.round(fast) + ')');
  await page.keyboard.down('KeyA'); await play(page, 1.2); await page.keyboard.up('KeyA');
  const a1 = await ev(page, () => AS.game.player.angle);
  ok(Math.abs(Math.atan2(Math.sin(a1 - s0.a), Math.cos(a1 - s0.a))) > 0.5, 'A banks the dragon round');
  await page.keyboard.up('KeyW');
  const z0 = await ev(page, () => AS.game.player.z);
  await page.keyboard.down('Space'); await play(page, 1.5);
  const zl = await ev(page, () => [AS.game.player.z, AS.game.player.speed]);
  await page.keyboard.up('Space');
  ok(zl[0] < z0 - 25 && zl[0] < 30, 'SPACE takes the dragon low (' + Math.round(z0) + ' → ' + Math.round(zl[0]) + ')');
  ok(zl[1] <= fast + 5, 'SPACE alone does not speed it up (' + Math.round(fast) + ' → ' + Math.round(zl[1]) + ')');
  await play(page, 2);
  ok(await ev(page, () => AS.game.player.z) > 45, 'releasing SPACE climbs back up');
  // W + SPACE: a fast power dive; S + SPACE: slow and low
  await page.keyboard.down('KeyW'); await page.keyboard.down('Space'); await play(page, 1.6);
  const pd = await ev(page, () => [AS.game.player.z, AS.game.player.speed]);
  await page.keyboard.up('KeyW');
  ok(pd[1] > 320 && pd[0] < 30, 'W + SPACE power-dives fast and low (' + pd.map(Math.round) + ')');
  await page.keyboard.down('KeyS'); await play(page, 2.2);
  const sl = await ev(page, () => [AS.game.player.z, AS.game.player.speed]);
  await page.keyboard.up('KeyS'); await page.keyboard.up('Space');
  ok(sl[1] < 120 && sl[0] < 30, 'S + SPACE glides slow and low (' + sl.map(Math.round) + ')');
  await play(page, 2);
  ok(await ev(page, () => AS.game.player.z) > 45, 'releasing SPACE climbs back up');
  await page.keyboard.down('KeyS'); await play(page, 2.5);
  const slow = await ev(page, () => AS.game.player.speed);
  await page.keyboard.up('KeyS');
  ok(slow < 110, 'S flares to a near-hover (' + Math.round(slow) + ')');
  return page;
});

await test('flight: flare low to land, rest, and take off again', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  await ev(page, () => { const p = AS.game.player; AS.Debug.tp(3200, 6400, 45); p.speed = 70; p.angle = 0; });
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => AS.game.player.landed, null, { timeout: 8000 }).catch(() => {});
  await page.keyboard.up('KeyS');
  const l = await ev(page, () => [AS.game.player.landed, Math.round(AS.game.player.z), Math.round(AS.game.player.speed)]);
  ok(l[0] && l[1] === 0 && l[2] === 0, 'holding S low over open ground lands the dragon (' + l + ')');
  await play(page, 0.4);
  await page.keyboard.down('KeyW'); await play(page, 1.2); await page.keyboard.up('KeyW');
  const t = await ev(page, () => [AS.game.player.landed, Math.round(AS.game.player.z), Math.round(AS.game.player.speed)]);
  ok(!t[0] && t[1] > 15 && t[2] > 80, 'W launches it back into the air (' + t + ')');
  return page;
});

await test('combat: staff bolts hit what the cursor points at', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  // a bandit on open ground ahead of the dragon
  const t = await ev(page, () => {
    const g = AS.game, p = g.player, x = 3200, y = 6400;
    AS.Debug.tp(x, y, 60); p.angle = 0; p.speed = 60;
    const u = new AS.Troop(g, 'bandit', 'wild', x + 220, y + 10, { state: 'guard' });
    u.home = { x: u.x, y: u.y, r: 40 }; g.troops.push(u); window.__t = u;
    return { hp: u.hp };
  });
  await page.keyboard.down('KeyS');
  const p0 = await ev(page, () => [__t.x, __t.y]);
  const sp = await screenOf(page, p0[0], p0[1] - 6);
  await page.mouse.move(sp.x, sp.y);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) { await play(page, 0.12); const q = await ev(page, () => [__t.x, __t.y]); const s = await screenOf(page, q[0], q[1] - 6); await page.mouse.move(s.x, s.y); }
  await page.mouse.up(); await page.keyboard.up('KeyS');
  const after = await ev(page, () => [__t.alive, __t.hp, AS.game.player.mana]);
  ok(!after[0] || after[1] < t.hp, 'the bandit was struck (hp ' + t.hp + ' → ' + Math.round(after[1]) + ')');
  ok(after[2] < 100, 'casting spends mana');
  return page;
});

await test('combat: breath burns the ground forces in front', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const t = await ev(page, () => {
    const g = AS.game, p = g.player, x = 3200, y = 6400;
    AS.Debug.tp(x, y, 40); p.angle = 0; p.speed = 50;
    const u = new AS.Troop(g, 'ogre', 'wild', x + 150, y + 6, { state: 'guard' });
    u.home = { x: u.x, y: u.y, r: 30 }; u.root = 99; g.troops.push(u); window.__t = u;
    return u.hp;
  });
  // point the cursor at the ogre: the breath goes where you aim
  const q0 = await ev(page, () => [__t.x, __t.y]); const sp0 = await screenOf(page, q0[0], q0[1]);
  await page.mouse.move(sp0.x, sp0.y);
  await page.keyboard.down('KeyS'); await page.keyboard.down('KeyF');
  for (let i = 0; i < 16; i++) { await play(page, 0.1); const q = await ev(page, () => [__t.x, __t.y]); const sp = await screenOf(page, q[0], q[1]); await page.mouse.move(sp.x, sp.y); }
  await page.keyboard.up('KeyF'); await page.keyboard.up('KeyS');
  const r = await ev(page, () => [__t.hp, __t.alive, AS.game.player.fireCharge, AS.game.player.maxFire || 100]);
  ok(!r[1] || r[0] < t * 0.8, 'the ogre was burned (' + t + ' → ' + Math.round(r[0]) + ')');
  ok(r[2] < r[3], 'breath spends its charge');
  return page;
});

await test('food: tap E low and slow to eat, hold E to carry', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const pick = () => ev(page, () => {
    const g = AS.game, p = g.player;
    const o = g.life.animals.find((a) => !a.owner && a.alive && !a.carried && g.terrain.kindFast(a.x, a.y) === 0 && a !== window.__o);
    window.__o = o;
    // a little above and behind the animal, at an easy pace
    AS.Debug.tp(o.x - 45, o.y, 46); p.angle = 0; p.speed = 120; p.energy = 30;
    return p.energy;
  });
  const e0 = await pick();
  await page.keyboard.press('KeyE');
  await play(page, 1.2);
  const r = await ev(page, () => [AS.game.player.energy, !!AS.game.player.carry, AS.game.player.stats.eaten]);
  ok(r[0] > e0 + 10 && !r[1], 'a tap of E snatched and ate it (' + Math.round(e0) + ' → ' + Math.round(r[0]) + ')');
  await pick();
  await page.keyboard.down('KeyE'); await play(page, 0.6); await page.keyboard.up('KeyE');
  await play(page, 0.3);
  ok(await ev(page, () => AS.game.player.carry === __o), 'holding E keeps the animal in the claws');
  await page.keyboard.press('KeyE');
  await play(page, 1.0);
  ok(await ev(page, () => !AS.game.player.carry && AS.game.player.stats.eaten >= 2), 'E again eats what it carries');
  return page;
});

await test('combat: the staff still fires after eating', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  await ev(page, () => {
    const g = AS.game, p = g.player;
    const o = g.life.animals.find((a) => !a.owner && a.alive && !a.carried && g.terrain.kindFast(a.x, a.y) === 0);
    AS.Debug.tp(o.x - 45, o.y, 46); p.angle = 0; p.speed = 120; p.energy = 30;
  });
  await page.keyboard.press('KeyE');
  await play(page, 1.5);
  ok(await ev(page, () => AS.game.player.stats.eaten >= 1 && AS.game.player.eatT === 0), 'ate, and the meal finished cleanly');
  const m0 = await ev(page, () => { const p = AS.game.player; p.mana = p.maxMana; return p.mana; });
  await page.mouse.move(900, 300);
  await page.mouse.down(); await play(page, 0.5); await page.mouse.up();
  const m1 = await ev(page, () => AS.game.player.mana);
  ok(m1 < m0 - 3, 'bolts cast after the meal (magic ' + Math.round(m0) + ' → ' + Math.round(m1) + ')');
  return page;
});

await test('food: double-click an animal and the dragon hunts it down', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const e0 = await ev(page, () => {
    const g = AS.game, p = g.player;
    const o = g.life.animals.find((a) => !a.owner && a.alive && !a.carried && g.terrain.kindFast(a.x, a.y) === 0);
    window.__o = o;
    // cruising past it at height, heading away
    AS.Debug.tp(o.x - 200, o.y + 30, 62); p.angle = p.velA = Math.PI; p.speed = 185; p.energy = 30;
    return p.stats.eaten;
  });
  await play(page, 0.3);
  const q = await ev(page, () => [__o.x, __o.y]); const sp = await screenOf(page, q[0], q[1] - 4);
  await page.mouse.move(sp.x, sp.y);
  await page.mouse.dblclick(sp.x, sp.y);
  await play(page, 0.2);
  ok(await ev(page, () => !!AS.game.player.pilot.quarry), 'the hunt began');
  await page.waitForFunction((e0) => AS.game.player.stats.eaten > e0, e0, { timeout: 60000, polling: 100 });
  ok(await ev(page, () => !AS.game.player.pilot.quarry && AS.game.player.energy > 45), 'snatched and ate it, then handed back control');
  return page;
});

await test('flight: double-tap SPACE loops the loop and dodges fire', async (keep) => {
  const page = keep(await open('?map=sundered'));
  await ev(page, () => { const p = AS.game.player; AS.Debug.tp(3200, 6400, 60); p.angle = p.velA = 0.3; p.speed = 220; p.energy = 80; window.__peak = 0; window.__dodged = null;
    const iv = setInterval(() => { if (!p.loop) return; __peak = Math.max(__peak, p.loopPose && p.loopPose.nodes[3] ? p.loopPose.nodes[3].z : p.z); if (p.evading && __dodged === null) { const hp = p.hp; __dodged = p.targetable === false && p.takeDamage(25, 'magic', AS.game.factions.elf.dragon) === 0 && p.hp === hp; } }, 30); });
  await play(page, 0.3);
  await page.keyboard.press('Space'); await page.waitForTimeout(90); await page.keyboard.press('Space');
  await play(page, 0.25);
  ok(await ev(page, () => !!AS.game.player.loop), 'a double-tap started a loop');
  await play(page, 1.6);
  const r = await ev(page, () => { const p = AS.game.player; return { loop: !!p.loop, peak: __peak, dodged: __dodged, a: p.angle, z: p.z, hit: p.takeDamage(5, 'magic', AS.game.factions.elf.dragon) }; });
  ok(!r.loop && r.peak > 140, 'climbed over the top and came back (drawn peak ' + Math.round(r.peak) + ')');
  ok(r.dodged === true, 'nothing touches the dragon over the top of the loop');
  ok(Math.abs(r.a - 0.3) < 0.05 && r.hit > 0, 'back on its heading, and hittable again');
  return page;
});

await test('combat: the head turns to aim the breath at the cursor', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const t = await ev(page, () => {
    const g = AS.game, p = g.player, x = 3200, y = 6400;
    AS.Debug.tp(x, y, 40); p.angle = 0; p.speed = 50;
    const a = 0.95, u = new AS.Troop(g, 'ogre', 'wild', x + Math.cos(a) * 130, y + Math.sin(a) * 130, { state: 'guard' });
    u.home = { x: u.x, y: u.y, r: 5 }; u.root = 99; g.troops.push(u); window.__t = u;
    return u.hp;
  });
  await page.keyboard.down('KeyS');
  for (let i = 0; i < 16; i++) {
    const q = await ev(page, () => [__t.x, __t.y]); const sp = await screenOf(page, q[0], q[1]);
    await page.mouse.move(sp.x, sp.y);
    if (i === 0) await page.keyboard.down('KeyF');
    await play(page, 0.1);
  }
  await page.keyboard.up('KeyF'); await page.keyboard.up('KeyS');
  const r = await ev(page, () => [__t.hp, Math.abs(AS.game.player.headYaw || 0)]);
  ok(r[0] < t - 30, 'breath reached a target well off the nose (' + t + ' → ' + Math.round(r[0]) + ')');
  return page;
});

await test('taunts: one voice at a time, rivals fade with distance', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const r = await ev(page, async () => {
    const g = AS.game, p = g.player, V = AS.Voices;
    const e = g.factions.elf.dragon;
    let ex = 260;
    e.pilot = { read(ee, inp) { inp.throttle = 0; ee.x = p.x + ex; ee.y = p.y; ee.z = 60; ee.speed = 40; } };
    V.quietUntil = 1e9; V.pairNext = {}; // no random encounters during the test
    let overlap = false, spoken = [], last = null;
    const watch = setInterval(() => { if (V.speaking && V.speaking.q !== last) { last = V.speaking.q; spoken.push((last.own ? 'own ' : 'foe ') + last.role + ': ' + last.text); } }, 30);
    // a line, a reply and an interruption must queue up, never talk over each other
    await new Promise((r) => setTimeout(r, 300));
    V.spkNext = {}; V.calmUntil = 0;
    const q1 = V.say(p, 'dragon', 'elf'); V.say(e, 'wizard', 'human', 0, q1); V.say(e, 'dragon', 'human');
    const t0 = performance.now();
    while (performance.now() - t0 < 9000) { await new Promise((r) => setTimeout(r, 50)); if (V.speaking && V.queue.includes(V.speaking.q)) overlap = true; }
    // far away: only a snippet, quietly
    ex = 800; V.spkNext = {}; await new Promise((r) => setTimeout(r, 200));
    V.queue = []; V.speaking = null; V.gapUntil = 0; V.calmUntil = 0;
    const far = V.say(e, 'wizard', 'human');
    await new Promise((r) => setTimeout(r, 400));
    const bub = V.bubbles.find((b) => b.d === e);
    clearInterval(watch);
    return { spoken, overlap, far: !!far, farText: bub ? bub.text : null, farAlpha: bub ? bub.alpha : null };
  });
  ok(r.spoken.length >= 2, 'lines were spoken in turn: ' + r.spoken.join(' | '));
  ok(new Set(r.spoken).size === r.spoken.length, 'no line repeated');
  ok(!r.overlap, 'never two voices at once');
  ok(r.far && r.farText && r.farText.startsWith('…') && r.farAlpha < 0.8, 'a distant rival is only half heard (' + r.farText + ')');
  return page;
});

await test('objectives: clear the guards, circle low, claim the site', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const id = await ev(page, () => {
    const g = AS.game, H = g.playerFaction;
    const s = g.sites.filter((q) => !q.owner && q.kind === 'village').sort((a, b) => Math.hypot(a.x - H.townPos.x, a.y - H.townPos.y) - Math.hypot(b.x - H.townPos.x, b.y - H.townPos.y))[0];
    for (const u of s.guards) u.takeDamage(1e6, 'fire', g.player);
    AS.Debug.tp(s.x, s.y, 40); g.player.speed = 40;
    return s.id;
  });
  await page.keyboard.down('KeyS');
  await page.waitForFunction((id) => AS.game.byId.get(id).owner === 'human', id, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('KeyS');
  const r = await ev(page, (id) => { const s = AS.game.byId.get(id); return [s.owner, AS.game.playerFaction.sitesOwned]; }, id);
  ok(r[0] === 'human' && r[1] >= 1, 'the village is ours (' + r + ')');
  return page;
});

await test('town: hold court at home and buy a farmstead', async (keep) => {
  const page = keep(await open('?map=sundered&god=1&gold=1000'));
  await ev(page, () => { AS.Debug.see('human'); });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyT');
  await page.waitForSelector('#court.show', { timeout: 5000 });
  ok(await ev(page, () => AS.App.overlay === 'court'), 'court opened and pauses the realm');
  const before = await ev(page, () => [AS.game.playerFaction.gold, AS.game.playerFaction.alive('farm')]);
  await page.locator('#court .tab', { hasText: /Farm|Economy|Town/ }).first().click().catch(() => {});
  const card = page.locator('#court .item', { hasText: 'Farmstead' }).first();
  if (await card.count() === 0) { for (const tab of await page.locator('#court .tab').all()) { await tab.click(); if (await page.locator('#court .item', { hasText: 'Farmstead' }).count()) break; } }
  await page.locator('#court .item', { hasText: 'Farmstead' }).first().locator('button').click();
  const after = await ev(page, () => [AS.game.playerFaction.gold, AS.game.playerFaction.alive('farm')]);
  ok(after[1] === before[1] + 1 && after[0] < before[0], 'farm ordered (' + before + ' → ' + after + ')');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok(await ev(page, () => AS.App.overlay === null), 'ESC closes the court');
  return page;
});

await test('army: G musters the warband and marches it on a site', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const target = await ev(page, () => {
    const g = AS.game, F = g.playerFaction;
    F.recruit('soldier', 6, true);
    const s = g.sites.filter((q) => !q.owner && q.kind !== 'bridge' && AS.Nav.reachable(g, F.townPos.x, F.townPos.y, q.x, q.y)).sort((a, b) => Math.hypot(a.x - F.townPos.x, a.y - F.townPos.y) - Math.hypot(b.x - F.townPos.x, b.y - F.townPos.y))[0];
    g.revealArea ? g.revealArea(s.x, s.y, 400) : null;
    return { id: s.id, x: s.x, y: s.y };
  });
  await page.keyboard.press('KeyG');
  await page.waitForTimeout(300);
  ok(await ev(page, () => AS.App.overlay === 'map' && AS.WarMap.orders), 'G opened the muster map');
  const at = await ev(page, ([x, y]) => { const L = AS.WarMap.lay; return { x: (L.x0 + x * L.k) / L.dpr, y: (L.y0 + y * L.k) / L.dpr }; }, [target.x, target.y]);
  await page.mouse.move(at.x, at.y); await page.waitForTimeout(150);
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
  await page.waitForTimeout(300);
  const r = await ev(page, () => [AS.App.overlay, AS.game.playerFaction.troops.filter((t) => t.alive && t.state === 'march').length]);
  ok(r[0] === null && r[1] >= 3, 'the warband marches (' + r + ')');
  return page;
});

await test('war: break every rival → victory screen', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  await ev(page, () => {
    const g = AS.game, p = g.player;
    for (const F of g.factionList) {
      if (F === g.playerFaction) continue;
      for (const b of F.buildings) if (b.kind === 'wardstone') b.takeDamage(1e6, 'fire', p);
      F.dragon.takeDamage(1e6, 'fire', p);
      F.keep.takeDamage(1e7, 'fire', p);
    }
  });
  await page.waitForSelector('#results.show', { timeout: 15000 });
  ok(await page.locator('#results .verdict.won').count() === 1, 'VICTORY verdict shown');
  return page;
});

await test('war: lose the stronghold → defeat screen', async (keep) => {
  const page = keep(await open('?map=sundered'));
  await ev(page, () => {
    const g = AS.game, H = g.playerFaction, foe = g.factions.undead.dragon;
    for (const b of H.buildings) if (b.kind === 'wardstone') b.takeDamage(1e6, 'fire', foe);
    H.keep.takeDamage(1e8, 'fire', foe);
  });
  await page.waitForSelector('#results.show', { timeout: 15000 });
  ok(await page.locator('#results .verdict.lost').count() === 1, 'DEFEAT verdict shown');
  return page;
});

await test('rivals: three minutes of war without errors', async (keep) => {
  const page = keep(await open('?map=sundered&demo=1'));
  const r = await ev(page, async () => {
    const g = AS.game; AS.App.state = 'sim';
    while (g.time < 180) { for (let i = 0; i < 300; i++) g.update(1 / 30); await new Promise((r) => setTimeout(r, 0)); }
    return { sites: g.factionList.map((F) => F.sitesOwned), carts: g.troops.filter((t) => t.role === 'cart' && t.alive).length, gold: g.factionList.map((F) => Math.round(F.income)) };
  });
  ok(r.sites.reduce((a, b) => a + b, 0) >= 4, 'the AI realms claimed land (' + r.sites + ')');
  ok(r.carts < 30, 'gold carts are delivering, not piling up (' + r.carts + ')');
  return page;
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
process.exit(fail ? 1 : 0);
