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
  await page.keyboard.down('KeyW'); await page.waitForTimeout(2200);
  const fast = await ev(page, () => AS.game.player.speed);
  ok(fast > s0.v + 40 && fast > 200, 'W beats the wings faster (' + Math.round(s0.v) + ' → ' + Math.round(fast) + ')');
  await page.keyboard.down('KeyA'); await page.waitForTimeout(1200); await page.keyboard.up('KeyA');
  const a1 = await ev(page, () => AS.game.player.angle);
  ok(Math.abs(Math.atan2(Math.sin(a1 - s0.a), Math.cos(a1 - s0.a))) > 0.5, 'A banks the dragon round');
  await page.keyboard.up('KeyW');
  const z0 = await ev(page, () => AS.game.player.z);
  await page.keyboard.down('Space'); await page.waitForTimeout(1500);
  const zl = await ev(page, () => [AS.game.player.z, AS.game.player.speed]);
  await page.keyboard.up('Space');
  ok(zl[0] < z0 - 25 && zl[0] < 30, 'SPACE dives low (' + Math.round(z0) + ' → ' + Math.round(zl[0]) + ')');
  ok(zl[1] > 200, 'the dive keeps its speed');
  await page.waitForTimeout(2000);
  ok(await ev(page, () => AS.game.player.z) > 45, 'releasing SPACE climbs back up');
  await page.keyboard.down('KeyS'); await page.waitForTimeout(2500);
  const slow = await ev(page, () => AS.game.player.speed);
  await page.keyboard.up('KeyS');
  ok(slow < 110, 'S flares to a near-hover (' + Math.round(slow) + ')');
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
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(120); const q = await ev(page, () => [__t.x, __t.y]); const s = await screenOf(page, q[0], q[1] - 6); await page.mouse.move(s.x, s.y); }
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
  await page.keyboard.down('KeyS'); await page.keyboard.down('KeyF');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyF'); await page.keyboard.up('KeyS');
  const r = await ev(page, () => [__t.hp, __t.alive, AS.game.player.fireCharge, AS.game.player.maxFire || 100]);
  ok(!r[1] || r[0] < t * 0.8, 'the ogre was burned (' + t + ' → ' + Math.round(r[0]) + ')');
  ok(r[2] < r[3], 'breath spends its charge');
  return page;
});

await test('food: snatch an animal from the ground and eat it', async (keep) => {
  const page = keep(await open('?map=sundered&god=1'));
  const e0 = await ev(page, () => {
    const g = AS.game, p = g.player;
    const o = g.life.animals.find((a) => !a.owner && a.alive && !a.carried && g.terrain.kindFast(a.x, a.y) === 0);
    window.__o = o;
    AS.Debug.tp(o.x, o.y, 22); p.speed = 40; p.energy = 30;
    return p.energy;
  });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);
  const carrying = await ev(page, () => AS.game.player.carry === __o || __o.carried);
  ok(carrying, 'E snatched the animal below');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1600);
  const e1 = await ev(page, () => AS.game.player.energy);
  ok(e1 > e0 + 10, 'eating restores energy (' + Math.round(e0) + ' → ' + Math.round(e1) + ')');
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
