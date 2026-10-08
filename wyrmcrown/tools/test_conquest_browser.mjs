// WYRMCROWN — CONQUEST end to end in the browser: the whole campaign loop
// through the real screens and the real battle engine.
//   title → Conquest → found a campaign → see the generated map → select and
//   march to an early site → hire troops → attack → the real-time battle (the
//   defenders are struck down, then the dragon circles low and the site is
//   claimed by the battle mode's own capture rule) → back on the campaign map →
//   the site is ours, the army's survivors and the clock have moved on → saved
//   → reload the browser → continue → the same world, the same progress.
// Then a second battle is abandoned through the pause menu (Retreat), which
// must count as a defeat with the defenders still holding the site.
// Needs the repo served (GAME_BASE_URL, default http://127.0.0.1:8766).
// usage: node wyrmcrown/tools/test_conquest_browser.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = (process.env.GAME_BASE_URL || 'http://127.0.0.1:8766') + '/wyrmcrown/index.html';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
let n = 0;
const step = (name) => { n++; console.log('PASS ' + n + '. ' + name); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ev = (fn, a) => page.evaluate(fn, a);
const sig = () => ev(() => { const st = AS.Conquest.UI.state, w = AS.Conquest.World.of(st); return JSON.stringify({ s: w.sites.map((q) => [q.id, q.kind, q.x, q.y]), r: w.routes }); });
const snap = () => ev(() => { const st = AS.Conquest.UI.state; return { at: st.army.at, day: st.economy.day, hour: st.economy.hour, gold: st.economy.gold, army: JSON.stringify(st.army.stacks), owners: JSON.stringify(st.territories), explored: st.world.explored.length }; });

try {
  // 1. start the game
  await page.goto(BASE);
  await page.waitForSelector('#menu.show', { timeout: 60000 });
  await ev(() => { for (let i = 1; i <= 3; i++) localStorage.removeItem('wyrmcrown.conquest.slot' + i); });
  step('Dragon Wars starts (title menu)');
  // 2. open Conquest
  await page.getByRole('button', { name: /^Conquest/ }).click();
  await page.waitForSelector('#conquest.show');
  step('Conquest opens from the title menu');
  // 3. found a campaign
  await page.selectOption('#cq-alleg-1', 'human');
  await page.fill('#cq-seed-1', '202');
  await page.locator('#conquest .map-card').first().getByRole('button', { name: 'New campaign' }).click();
  await page.waitForSelector('#conquest canvas.cq-map');
  step('a seeded campaign is founded (seed 202)');
  // 4. the generated map is drawn, under fog
  await page.waitForTimeout(500);
  const m = await ev(() => { const st = AS.Conquest.UI.state, w = AS.Conquest.World.of(st); return { sites: w.sites.length, known: st.world.explored.length, problems: w.problems.length }; });
  ok(m.sites >= 20 && m.known < m.sites / 2 && m.problems === 0, 'map ' + JSON.stringify(m));
  ok(await page.locator('#conquest .cq-side h3').first().isVisible(), 'side panel');
  step('the archipelago is generated and drawn; most of it is hidden (' + m.known + ' of ' + m.sites + ' places known)');
  // 5. select a reachable early site by clicking it on the map
  const t = await ev(() => { const st = AS.Conquest.UI.state, W = AS.Conquest.World, nb = W.neighbours(st, st.army.at).map((e) => e.to); const hostile = nb.find((id) => W.hostile(st, id)); const s = W.site(st, hostile), [x, y] = AS.Conquest.MapView.toScreen(s.x, s.y), r = AS.Conquest.MapView.cv.getBoundingClientRect(), d = AS.Conquest.MapView.dpr; return { id: hostile, name: s.name, x: r.left + x / d, y: r.top + y / d }; });
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(200);
  ok((await page.locator('#conquest .cq-side h3').first().textContent()).includes(t.name), 'selected ' + t.name);
  step('an early site is selected on the map (' + t.name + ')');
  // 6. hire troops at home (7)
  const before = await snap();
  await page.locator('#conquest .cq-hire button', { hasText: '+5' }).first().click();
  await page.waitForTimeout(200);
  const hired = await snap();
  ok(hired.army.includes('"count":5') && hired.gold < before.gold, 'hired: ' + hired.army);
  step('troops are hired at the home village (' + hired.army + ', gold ' + before.gold + ' → ' + hired.gold + ')');
  // 7. explore: march to a friendly or claimable neighbour and back, if one exists
  const walk = await ev(() => { const st = AS.Conquest.UI.state, W = AS.Conquest.World; return W.neighbours(st, st.army.at).map((e) => e.to).find((id) => W.canMove(st, id).ok && !W.hostile(st, id)) || null; });
  if (walk) {
    const k0 = (await snap()).explored;
    await ev((id) => AS.Conquest.UI.act(id), walk);
    await page.waitForTimeout(200);
    const k1 = await snap();
    ok(k1.at === walk, 'marched');
    await ev((id) => AS.Conquest.UI.act(id), before.at);
    step('the army marches and explores (' + k0 + ' → ' + k1.explored + ' places known), then returns');
  } else step('no unguarded neighbour on this seed (movement is covered by the attack below)');
  // 8. attack: the briefing, then the real battle
  await ev((id) => { AS.Conquest.UI.sel = id; AS.Conquest.UI.renderSide(); }, t.id);
  await page.locator('#conquest .cq-side button', { hasText: 'Attack' }).click();
  await page.waitForSelector('#conquest .cq-modal');
  ok((await page.locator('#conquest .cq-modal').textContent()).includes('Defenders'), 'briefing shows the defenders');
  const pre = await snap();
  await page.getByRole('button', { name: 'Fight!' }).click();
  await page.waitForFunction(() => AS.App.state === 'play' && AS.game && AS.game.cq, null, { timeout: 120000 });
  const bt = await ev(() => ({ army: AS.game.cq.army.length, enemy: AS.game.cq.enemy.length, site: AS.game.cq.site.kind }));
  ok(bt.army === 5 && bt.enemy > 0, 'battle forces ' + JSON.stringify(bt));
  step('the briefing leads into a real-time battle (' + bt.army + ' troops and the dragon against ' + bt.enemy + ' defenders at a ' + bt.site + ')');
  // 9. resolve it: strike the defenders down, then circle low over the site until the game's own rule claims it
  // one of our soldiers falls in the fight (a real casualty, counted by the battle)
  await ev(() => { const g = AS.game; g.cq.army[0].takeDamage(1e6, 'melee', g.cq.enemy[0]); for (const u of g.cq.enemy) if (u.alive) u.takeDamage(1e6, 'fire', g.player); });
  await ev(() => { const s = AS.game.cq.site; AS.Debug.tp(s.x, s.y, 20); AS.Debug.hold && AS.Debug.hold(true); });
  await page.waitForFunction(() => AS.App.state === 'menu' && AS.Conquest.UI.root.classList.contains('show'), null, { timeout: 120000 });
  step('the defenders fall and the dragon claims the site by circling low (the battle mode\'s capture rule)');
  // 10. back on the campaign map
  await page.waitForSelector('#conquest .cq-modal');
  ok((await page.locator('#conquest .cq-modal h2').textContent()).includes('Victory'), 'victory report');
  step('the campaign map returns with a victory report');
  await page.locator('#conquest .cq-modal button', { hasText: 'Continue' }).click();
  // 11–13. the site changed hands, the army persisted, time passed
  const post = await snap();
  const owners = JSON.parse(post.owners);
  ok(owners[t.id].owner === 'player', 'site owner ' + owners[t.id].owner);
  ok(post.at === t.id, 'army moved in');
  step('the site is now held by the player');
  ok(JSON.parse(post.army)[0].count === JSON.parse(pre.army)[0].count - 1, 'one casualty: ' + pre.army + ' → ' + post.army);
  step('the army\'s losses persisted (' + pre.army + ' → ' + post.army + ')');
  ok(post.day > pre.day || post.hour > pre.hour, 'time');
  step('campaign time advanced (day ' + pre.day + ' ' + pre.hour + ':00 → day ' + post.day + ' ' + post.hour + ':00)');
  // 14. saved
  const saved = await ev(() => JSON.parse(localStorage.getItem('wyrmcrown.conquest.slot1')));
  ok(saved && saved.army.at === t.id && saved.version === 2, 'saved record');
  step('the campaign was saved automatically (' + JSON.stringify(saved).length + ' bytes)');
  // 15–17. reload the browser, continue, the same world and progress
  const world0 = await sig();
  await page.reload();
  await page.waitForSelector('#menu.show', { timeout: 60000 });
  step('the browser is reloaded');
  await page.getByRole('button', { name: /^Conquest/ }).click();
  await page.waitForSelector('#conquest.show');
  await page.locator('#conquest .map-card').first().getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('#conquest canvas.cq-map');
  step('the campaign is continued from its slot');
  const again = await snap();
  ok(await sig() === world0, 'identical world');
  ok(again.at === post.at && again.day === post.day && again.hour === post.hour && again.gold === post.gold && again.army === post.army && again.owners === post.owners && again.explored === post.explored, 'identical progress');
  step('the world is identical (regenerated from the seed) and all progress remains');

  // a retreat from the pause menu counts as a defeat; the defenders still hold the site
  const t2 = await ev(() => { const st = AS.Conquest.UI.state, W = AS.Conquest.World; return W.neighbours(st, st.army.at).map((e) => e.to).find((id) => W.hostile(st, id) && W.canMove(st, id).ok) || null; });
  if (t2) {
    const pre2 = await snap();
    await ev((id) => AS.Conquest.Battle.launch(1, id), t2);
    await page.waitForFunction(() => AS.App.state === 'play' && AS.game && AS.game.cq, null, { timeout: 120000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#pause.show');
    await page.getByText('Retreat to the Campaign Map').click();
    await page.locator('.btn', { hasText: /^(Yes|Confirm|OK)/i }).first().click().catch(() => {});
    await page.waitForFunction(() => AS.App.state === 'menu' && AS.Conquest.UI.root.classList.contains('show'), null, { timeout: 60000 });
    const p2 = await snap(), own2 = JSON.parse(p2.owners);
    ok(own2[t2].owner !== 'player' && p2.at === pre2.at, 'retreat kept the army home and the site hostile');
    ok((await page.locator('#conquest .cq-modal h2').textContent()).includes('Defeat'), 'defeat report');
    step('a retreat through the pause menu is a defeat: the army stays where it was, the defenders keep the site');
  }
  ok(!errors.length, 'page errors: ' + errors.slice(0, 3).join(' | '));
  console.log('\n' + n + ' steps passed, no page errors');
} catch (e) {
  console.log('FAIL after ' + n + ' steps: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: (process.env.TMPDIR || '/tmp') + '/conquest_fail.png' }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
