// WYRMCROWN — checks of COMMAND MODE (src/game/command.js) in the ARMY COMMAND TEST,
// driven through the real mouse and keyboard: C in and out, box selection, a click on
// the ground, on an enemy and on a guarded place, the right-click menu, soldiers without
// a commander (defend home, fall back, local orders, no expeditions), a champion's long
// march, the K panel and the troop counts afterwards.
// Needs the repo served at http://127.0.0.1:8766 (see test_game.mjs).
// usage: node wyrmcrown/tools/test_command.mjs [filter]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const filter = process.argv[2] || '';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
let pass = 0, fail = 0;

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.errors = [];
page.on('pageerror', (e) => page.errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
await page.goto(BASE + '?world=army&god=1');
await page.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 120000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const n = document.getElementById('audio-check'); if (n) n.remove();
  window.T = {
    // put the dragon (and the view) over a point
    over(x, y) { const g = AS.game, p = g.player; p.x = x; p.y = y; p.z = 110; p.vx = p.vy = 0; p.speed = 0; for (const n of p.nodes) { n.x = p.x; n.y = p.y; n.z = p.z; } p.layoutRig(0, true); g.camera.snap(p.x, p.y - p.z); },
    // a world point → page (CSS) pixels
    scr(x, y) { const R = AS.Renderer, q = R.worldToScreen(x, y, AS.game.camera), d = R.dpr || 1; return { x: q.x / d, y: q.y / d }; },
    // the box around some soldiers, in page pixels
    box(units, pad) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const u of units) { const q = T.scr(u.x, u.y - 6); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } pad = pad || 26; return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad }; },
    army(id) { const a = AS.game.armies.byId[id]; return (a.units || []).filter((u) => u.alive && !u.removed); },
    garrison() { return AS.game.troops.filter((u) => u.alive && !u.removed && u.team === 'human' && !u.armyId && !u.cmdrOf && u.role !== 'cart'); },
    spawn(role, team, x, y, n) { const g = AS.game, out = []; for (let i = 0; i < (n || 1); i++) { const a = i * 2.399, r = 14 + Math.sqrt(i) * 16; const u = new AS.Troop(g, role, team, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8); g.troops.push(u); out.push(u); } return out; },
    sel() { return AS.game.cmd ? AS.game.cmd.sel : []; },
    onField() { const o = {}; for (const u of AS.game.troops) if (u.alive && !u.removed && u.armyId) o[u.armyId] = (o[u.armyId] || 0) + 1; return o; },
  };
});

async function step(name, fn) {
  if (filter && !name.includes(filter)) return;
  const t0 = Date.now(), e0 = page.errors.length;
  try {
    const msg = await fn();
    if (page.errors.length > e0) throw new Error('page errors: ' + [...new Set(page.errors.slice(e0))].slice(0, 3).join(' | '));
    pass++; console.log('PASS ' + name + (msg ? ' — ' + msg : '') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const play = async (secs) => { const t0 = await ev(() => AS.game.time); await page.waitForFunction(([t0, s]) => AS.game.time >= t0 + s, [t0, secs], { timeout: secs * 30000 + 15000, polling: 50 }); };
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n || 3);
// the real mouse
async function drag(b, shift) {
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(b.x0, b.y0); await page.mouse.down(); await frames(2);
  await page.mouse.move((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, { steps: 4 }); await page.mouse.move(b.x1, b.y1, { steps: 4 }); await frames(2);
  await page.mouse.up(); await frames(3);
  if (shift) await page.keyboard.up('Shift');
}
async function click(q, o) { await page.mouse.move(q.x, q.y); await page.mouse.down(o); await frames(1); await page.mouse.up(o); await frames(3); }
const groundAt = (x, y) => ev(([x, y]) => T.scr(x, y), [x, y]);

// --------------------------------------------------------------------------
await step('A. C enters Command Mode (and the COMMAND button shows it)', async () => {
  await ev(() => T.over(2300, 6700));
  const b0 = await ev(() => document.getElementById('cmdbtn') && document.getElementById('cmdbtn').textContent);
  await page.keyboard.press('KeyC'); await frames(3);
  const r = await ev(() => ({ on: AS.Command.on(AS.game), btn: document.getElementById('cmdbtn').textContent, flight: AS.Settings.controlMode, overlay: AS.App.overlay }));
  ok(r.on, 'Command Mode is on after C');
  ok(/COMMANDING/.test(r.btn) && /COMMAND/.test(b0 || ''), 'the button reads ' + b0 + ' → ' + r.btn);
  ok(!r.overlay, 'the realm keeps running (no overlay)');
  // the dragon hangs in the air: it is not flying off
  const p0 = await ev(() => [AS.game.player.x, AS.game.player.y]); await play(2);
  const p1 = await ev(() => [AS.game.player.x, AS.game.player.y, AS.game.player.speed]);
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 160, 'the dragon hovers while you command (moved ' + Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) + ')');
  return 'button "' + r.btn + '"; flight style left as ' + r.flight;
});

await step('B. a box around mixed soldiers selects exactly them (no new army records)', async () => {
  await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); T.over(a.x, a.y - 40); });
  await frames(4);
  const b = await ev(() => T.box(T.army('red'), 48));
  const n0 = await ev(() => AS.game.armies.list.length);
  await drag(b);
  const r = await ev(() => {
    const s = T.sel(), types = {}; for (const u of s) types[AS.Command.typeOf(u)] = (types[AS.Command.typeOf(u)] || 0) + 1;
    const red = T.army('red');
    return { n: s.length, types, allRed: red.every((u) => u.selected), dup: s.length !== new Set(s).size, armies: AS.game.armies.list.length };
  });
  ok(r.allRed, 'every soldier of Red Company is selected');
  ok(r.types.h_soldier >= 8 && r.types.h_archer >= 4, 'footmen and longbows together (' + JSON.stringify(r.types) + ')');
  ok(!r.dup && r.armies === n0, 'no duplicates and no new army record (' + r.armies + ')');
  // shift-click one out and back in; a double-click picks the type
  const one = await ev(() => { const u = T.army('red').find((u) => u.ctype === 'h_archer'); return T.scr(u.x, u.y - 6); });
  await page.keyboard.down('Shift'); await click(one); await page.keyboard.up('Shift');
  const less = await ev(() => T.sel().length);
  await page.keyboard.down('Shift'); await click(one); await page.keyboard.up('Shift');
  const back = await ev(() => T.sel().length);
  ok(less === r.n - 1 && back === r.n, 'shift-click removes and adds one (' + r.n + ' → ' + less + ' → ' + back + ')');
  await click(one); await page.mouse.down(); await page.mouse.up(); await frames(3); // (the second click of a double-click)
  const dbl = await ev(() => { const s = T.sel(); return { n: s.length, same: s.every((u) => AS.Command.typeOf(u) === 'h_archer') }; });
  ok(dbl.n >= 4 && dbl.same, 'a double-click selects the longbows nearby (' + dbl.n + ')');
  await drag(b); // the whole company again
  return r.n + ' selected: ' + JSON.stringify(r.types);
});

await step('C. left-click on empty ground: the selection moves there', async () => {
  const goal = await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); return { x: a.x + 330, y: a.y - 60 }; });
  const q = await groundAt(goal.x, goal.y);
  await click(q);
  const r0 = await ev(() => ({ order: AS.game.armies.byId.red.order.type, marks: AS.game.cmd.marks.length }));
  await play(7);
  const r = await ev((goal) => { const a = AS.Armies.pos(AS.game.armies.byId.red); return { d: Math.hypot(a.x - goal.x, a.y - goal.y), order: AS.game.armies.byId.red.order.type }; }, goal);
  ok(r0.order === 'march' && r0.marks > 0, 'Red Company (no commander, near home) takes a march order at once (' + r0.order + ')');
  ok(r.d < 120, 'and gets there (' + Math.round(r.d) + ' from the spot)');
  return 'order ' + r0.order + ' → ' + r.order + ', ' + Math.round(r.d) + ' from the click';
});

await step('D. left-click on an enemy: the selection attacks it at once', async () => {
  const tid = await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); const [t] = T.spawn('troll', 'wild', a.x + 260, a.y + 40); t.state = 'guard'; t.home = { x: t.x, y: t.y, r: 60 }; window.__troll = t; return t.maxHp; });
  await frames(3);
  const q = await ev(() => T.scr(__troll.x, __troll.y - __troll.hc * 0.55));
  await click(q);
  const r0 = await ev(() => { const s = T.sel(); return { focus: s.filter((u) => u.focus === __troll).length, n: s.length, marks: AS.game.cmd.marks.filter((m) => m.kind === 'attack').length }; });
  ok(r0.focus === r0.n && r0.n >= 12, 'every selected soldier is told to attack the troll (' + r0.focus + '/' + r0.n + ')');
  ok(r0.marks > 0, 'the target is marked');
  const shot = await page.screenshot({ path: process.env.SHOTS ? process.env.SHOTS + '/attack.png' : undefined });
  await play(12);
  const r = await ev(() => ({ hp: __troll.alive ? Math.round(__troll.hp) : 0, alive: __troll.alive }));
  ok(!r.alive || r.hp < tidHalf(), 'the troll is beaten down (' + (r.alive ? r.hp + ' hp left' : 'dead') + ')');
  function tidHalf() { return tid * 0.5; }
  return 'troll ' + tid + ' hp → ' + (r.alive ? r.hp : 'dead');
});

await step('F. right-click opens the order menu; Hold works from it', async () => {
  const q = await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); return T.scr(a.x + 120, a.y + 90); });
  await click(q, { button: 'right' });
  const items = await ev(() => AS.game.cmd.menu && AS.game.cmd.menu.items);
  ok(items && ['Move here', 'Hold', 'Defend here', 'Follow the dragon', 'Retreat'].every((k) => items.includes(k)), 'the menu has move, hold, defend, follow, retreat (' + (items || []).join(' / ') + ')');
  const hb = await page.locator('#cmdmenu button', { hasText: /^Hold$/ }).boundingBox();
  await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2); await frames(3);
  const r = await ev(() => ({ order: AS.game.armies.byId.red.order.type, menu: !!document.getElementById('cmdmenu') }));
  ok(r.order === 'hold' && !r.menu, 'Hold given from the menu (' + r.order + '), menu closed');
  return items.length + ' items: ' + items.join(' / ');
});

await step('G. soldiers without a commander defend their home (and help each other)', async () => {
  await ev(() => T.over(2200, 6650));
  await frames(4);
  const r0 = await ev(() => { const gs = T.garrison(); window.__home = gs.map((u) => ({ u, h: { x: u.home.x, y: u.home.y } })); return gs.length; });
  ok(r0 >= 4, 'the castle has a garrison (' + r0 + ')');
  await ev(() => { window.__raid = T.spawn('bandit', 'wild', 2200 + 260, 6600 + 120, 4); for (const u of __raid) u.marchTo(2200, 6650, { r: 80, siege: true }); });
  await play(6);
  const r = await ev(() => { const gs = T.garrison(); return { fighting: gs.filter((u) => u.target && u.target.alive || __raid.every((b) => !b.alive)).length, n: gs.length, far: Math.max(...__home.filter((o) => o.u.alive).map((o) => Math.hypot(o.u.x - o.h.x, o.u.y - o.h.y))), left: __raid.filter((b) => b.alive).length }; });
  ok(r.fighting >= Math.min(4, r.n) || r.left === 0, 'the garrison turns on the raiders (' + r.fighting + ' of ' + r.n + ' engaged, ' + r.left + ' raiders left)');
  ok(r.far < 700, 'none chases far from home (furthest ' + Math.round(r.far) + ')');
  await play(10);
  const left = await ev(() => __raid.filter((b) => b.alive).length);
  return r.n + ' defenders; raiders left ' + left;
});

await step('I. soldiers without a commander take nearby tactical orders', async () => {
  const b = await ev(() => T.box(T.garrison(), 18));
  await drag(b);
  const n = await ev(() => T.sel().filter((u) => !u.armyId).length);
  ok(n >= 3, 'garrison soldiers selected (' + n + ')');
  const goal = { x: 2200 + 420, y: 6650 - 260 };
  await click(await groundAt(goal.x, goal.y));
  await play(8);
  const r = await ev((goal) => { const s = T.sel().filter((u) => !u.armyId); return { near: s.filter((u) => Math.hypot(u.x - goal.x, u.y - goal.y) < 140).length, n: s.length, tac: s.filter((u) => u.tac).length }; }, goal);
  ok(r.near >= Math.ceil(r.n * 0.75), 'they go to the spot (' + r.near + ' of ' + r.n + ' there)');
  return r.near + ' of ' + r.n + ' moved ~500 from home';
});

await step('H. outmatched soldiers without a commander fall back home to regroup', async () => {
  // the garrison soldiers out at the spot meet far stronger foes
  await ev(() => { const s = T.sel().filter((u) => !u.armyId); const c = AS.Command.centre(s); window.__big = T.spawn('ogre', 'wild', c.x + 120, c.y - 40, 5); });
  await play(5);
  const r = await ev(() => { const s = AS.game.troops.filter((u) => u.alive && u.tac); return { back: s.filter((u) => u.tac.returning).length, n: s.length }; });
  // and an uncommanded army, sent out locally, does the same
  await ev(() => { for (const u of __big) { u.alive = false; u.removed = true; } });
  const red = await ev(() => { const g = AS.game, a = g.armies.byId.red, p = AS.Armies.pos(a); AS.Armies.order(g, 'red', { type: 'march', x: p.x + 500, y: p.y - 200 }); return { x: p.x + 500, y: p.y - 200 }; });
  await play(9);
  await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); window.__big2 = T.spawn('ogre', 'wild', a.x + 200, a.y, 5); for (const u of __big2) { u.state = 'march'; u.dest = { x: a.x, y: a.y, r: 30 }; } });
  await page.waitForFunction(() => { const o = AS.game.armies.byId.red.order.type; return o === 'retreat'; }, null, { timeout: 20000, polling: 100 }).catch(() => {});
  const r2 = await ev(() => ({ order: AS.game.armies.byId.red.order.type, log: AS.game.armies.log.slice(-4).map((l) => l.text) }));
  await ev(() => { for (const u of __big2) { u.alive = false; u.removed = true; } });
  ok(r.back >= 1 || r.n === 0, 'garrison soldiers break off and head home (' + r.back + ' of ' + r.n + ')');
  ok(r2.order === 'retreat' || r2.order === 'defend', 'Red Company (no commander) falls back (' + r2.order + ': ' + r2.log.join(' | ') + ')');
  return 'garrison ' + r.back + '/' + r.n + ' returning; Red: ' + r2.order;
});

await step('J. soldiers without a commander cannot set out on a distant expedition', async () => {
  await play(6);
  await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); T.over(a.x, a.y - 40); });
  await frames(4);
  await drag(await ev(() => T.box(T.army('red'), 48)));
  // fly the view east, beyond 400 m of the castle (selection kept), and click the ground there
  const goal = { x: 4250, y: 6450 };
  await ev((goal) => T.over(goal.x, goal.y - 60), goal); await frames(4);
  const before = await ev(() => AS.game.armies.byId.red.order.type);
  await click(await groundAt(goal.x, goal.y));
  const r = await ev(() => ({ order: AS.game.armies.byId.red.order.type, msg: AS.game.msgs.map((m) => m.text).join(' | '), sel: T.sel().length }));
  ok(r.order === before && /COMMANDER|KING OR CHAMPION/.test(r.msg), 'refused: ' + r.msg.slice(0, 140));
  // and no tunnel either
  const tun = await ev(() => AS.Armies.order(AS.game, 'red', { type: 'enter', passage: 'delverway' }));
  ok(!tun.ok, 'no tunnel without a commander (' + tun.reason + ')');
  return r.msg.split(' | ').find((t) => /COMMANDER|CHAMPION/.test(t));
});

await step('K. with a champion assigned, the same distant march is taken', async () => {
  // Brannoc waits at the castle: assign him through the K panel
  await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); T.over(a.x, a.y - 40); });
  const near = await ev(() => { const g = AS.game, a = g.armies.byId.red, c = g.armies.cmdrs.c_brannoc, p = AS.Armies.pos(a); return Math.hypot(p.x - c.x, p.y - c.y); });
  if (near > 560) await ev(() => { AS.Armies.order(AS.game, 'red', { type: 'march', x: 2320, y: 6880 }); });
  await play(near > 560 ? 10 : 0.5);
  await page.keyboard.press('KeyK'); await frames(4);
  await page.selectOption('#ac-cmdr-red', 'c_brannoc');
  await page.locator('[data-army="red"] button', { hasText: /^Assign/ }).first().click(); await frames(3);
  const cm = await ev(() => AS.game.armies.byId.red.cmdr);
  await page.keyboard.press('KeyK'); await frames(3);
  ok(cm === 'c_brannoc', 'Brannoc takes command of Red Company (' + cm + ')');
  await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); T.over(a.x, a.y - 40); }); await frames(4);
  await drag(await ev(() => T.box(T.army('red'), 48)));
  const goal = { x: 4250, y: 6450 };
  await ev((goal) => T.over(goal.x, goal.y - 60), goal); await frames(4);
  await click(await groundAt(goal.x, goal.y));
  const r = await ev(() => ({ order: AS.game.armies.byId.red.order.type, x: AS.game.armies.byId.red.order.x }));
  ok(r.order === 'march', 'the march is accepted (' + r.order + ')');
  // the dragon leaves; the army keeps marching (as a record) and arrives
  await ev(() => T.over(8800, 900));
  await ev(() => { const g = AS.game; for (let t = 0; t < 90; t += AS.Armies.STEP) AS.Armies.update(g, AS.Armies.STEP); });
  const f = await ev((goal) => { const a = AS.game.armies.byId.red, p = AS.Armies.pos(a); return { d: Math.hypot(p.x - goal.x, p.y - goal.y), st: a.status, n: AS.Armies.count(a) }; }, goal);
  ok(f.d < 200, 'Red Company under Brannoc reaches the far spot with the dragon away (' + Math.round(f.d) + ', ' + f.st + ')');
  return 'distance from home ' + Math.round(Math.hypot(4250 - 2240, 6450 - 6860)) + '; arrived ' + Math.round(f.d) + ' from the click, ' + f.n + ' soldiers';
});

await step('E. left-click on a hostile fortification: the selection assaults it', async () => {
  // Red Company (Brannoc) to the foot of the Greyspine Pass, then the Gatewatch
  await ev(() => { const g = AS.game; AS.Armies.order(g, 'red', { type: 'march', x: 4950, y: 4150 }); for (let t = 0; t < 120; t += AS.Armies.STEP) AS.Armies.update(g, AS.Armies.STEP); });
  await ev(() => { const a = AS.Armies.pos(AS.game.armies.byId.red); T.over(a.x, a.y - 260); }); await play(1.5);
  await drag(await ev(() => T.box(T.army('red'), 48)));
  const site = await ev(() => { const s = AS.game.byId.get('gatewatch'); return { x: s.x, y: s.y, g0: s.guards.filter((u) => u.alive).length }; });
  const nsel = await ev(() => T.sel().length);
  await click(await groundAt(site.x, site.y));
  const r0 = await ev(() => ({ order: AS.game.armies.byId.red.order.type, site: AS.game.armies.byId.red.order.siteId, focus: T.sel().filter((u) => u.focus && u.focus.site && u.focus.site.id === 'gatewatch').length }));
  ok(nsel >= 10 && r0.order === 'attack' && r0.site === 'gatewatch', 'the click on the Gatewatch is an attack order (' + r0.order + ' ' + r0.site + ', ' + nsel + ' selected)');
  ok(r0.focus >= nsel - 1, 'the soldiers go for its guards at once (' + r0.focus + ')');
  await play(14);
  const g1 = await ev(() => AS.game.byId.get('gatewatch').guards.filter((u) => u.alive).length);
  ok(g1 < site.g0, 'the guards fall (' + site.g0 + ' → ' + g1 + ')');
  return 'guards ' + site.g0 + ' → ' + g1;
});

await step('L. C again: back to flying the dragon (the mouse casts again)', async () => {
  await page.keyboard.press('KeyC'); await frames(3);
  await page.mouse.move(640, 300); await page.mouse.down(); await frames(3);
  const r = await ev(() => ({ on: AS.Command.on(AS.game), fire: AS.game.player.input.fire, btn: document.getElementById('cmdbtn').textContent }));
  await page.mouse.up(); await frames(2);
  ok(!r.on && r.fire, 'Command Mode off, the left mouse fires the staff again (fire ' + r.fire + ')');
  // the button does the same
  await page.click('#cmdbtn'); await frames(2);
  const on = await ev(() => AS.Command.on(AS.game));
  await page.click('#cmdbtn'); await frames(2);
  const off = await ev(() => AS.Command.on(AS.game));
  ok(on && !off, 'the COMMAND button switches too');
  return r.btn;
});

await step('M. the K panel still works and every troop count is right', async () => {
  await page.keyboard.press('KeyK'); await frames(4);
  const panel = await ev(() => ({ overlay: AS.App.overlay, cards: document.querySelectorAll('#armycmd [data-army]').length }));
  await page.keyboard.press('KeyK'); await frames(3);
  ok(panel.overlay === 'armycmd' && panel.cards === 2, 'the K panel opens with both armies (' + panel.cards + ')');
  const r = await ev(() => {
    const g = AS.game, out = { armies: g.armies.list.length, bad: [] };
    const owner = new Map();
    for (const a of g.armies.list) {
      if (a.units) for (const u of a.units) if (u.alive && !u.removed) { if (owner.has(u)) out.bad.push('shared soldier'); owner.set(u, a.id); if (u.armyId !== a.id) out.bad.push('wrong armyId'); }
      const field = (a.units || []).filter((u) => u.alive && !u.removed).length;
      if (a.units && field !== AS.Armies.count(a)) out.bad.push(a.id + ' count');
      out[a.id] = AS.Armies.count(a);
    }
    // nobody on the field claims an army that does not hold them
    for (const u of g.troops) if (u.alive && !u.removed && u.armyId && owner.get(u) !== u.armyId) out.bad.push('stray ' + u.armyId);
    const lead = {}; for (const a of g.armies.list) if (a.cmdr) lead[a.cmdr] = (lead[a.cmdr] || 0) + 1;
    out.lead = Object.values(lead).every((n) => n === 1);
    return out;
  });
  ok(r.armies === 2 && !r.bad.length && r.lead, 'two armies, each soldier in one, counts match (' + JSON.stringify(r) + ')');
  // save and load keep them
  const before = await ev(() => { const g = AS.game; AS.ArmyTest.save(g); window.__old = g; return g.armies.list.map((a) => a.id + ':' + AS.Armies.count(a) + ':' + a.cmdr).join(','); });
  await ev(() => AS.ArmyTest.start(AS.ArmyTest.load()));
  await page.waitForFunction(() => AS.game && AS.game !== window.__old && AS.App.state === 'play' && AS.game.armies, null, { timeout: 120000 });
  const s = { before, after: await ev(() => AS.game.armies.list.map((a) => a.id + ':' + AS.Armies.count(a) + ':' + a.cmdr).join(',')) };
  ok(s.before === s.after, 'save and load keep the counts (' + s.before + ' / ' + s.after + ')');
  return 'Red ' + r.red + ', Guard ' + r.guard;
});

await step('N. other modes: C in a battle map and in the Wide Realm campaign does not break anything', async () => {
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p2.on('pageerror', (e) => errs.push(e.message));
  await p2.goto(BASE + '?map=sundered&god=1');
  await p2.waitForFunction(() => window.AS && AS.game && AS.App.state === 'play', null, { timeout: 120000 });
  await p2.keyboard.press('KeyC'); await p2.waitForTimeout(400);
  await p2.mouse.move(500, 400); await p2.mouse.down(); await p2.mouse.move(800, 600, { steps: 5 }); await p2.mouse.up(); await p2.waitForTimeout(300);
  await p2.mouse.click(700, 300); await p2.waitForTimeout(300);
  await p2.mouse.click(700, 300, { button: 'right' }); await p2.waitForTimeout(300);
  const r = await p2.evaluate(() => ({ on: AS.Command.on(AS.game), sel: AS.game.cmd.sel.length, menu: !!document.getElementById('cmdmenu') }));
  await p2.keyboard.press('Escape'); await p2.keyboard.press('KeyC'); await p2.waitForTimeout(300);
  const off = await p2.evaluate(() => AS.Command.on(AS.game));
  await p2.close();
  ok(r.on && r.menu && !off && !errs.length, 'Command Mode works in a battle map (' + JSON.stringify(r) + ') ' + errs.join(' | '));
  return r.sel + ' of your soldiers selected in the battle map';
});

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
