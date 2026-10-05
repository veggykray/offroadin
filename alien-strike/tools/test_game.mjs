// ALIEN STRIKE — end-to-end browser test suite (Playwright + Chromium).
// Usage: node tools/test_game.mjs [baseUrl]   (default: http://127.0.0.1:8765/)
// Covers: new campaign, movement, shooting, enemy AI, objectives, pickups, fuel
// depletion, ammo depletion, damage, rescue, extraction, success, failure, hangar,
// buying + applying upgrades, save/load, moving between missions, every mission
// loading, and console/network errors throughout.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = process.env.SHOTS || '';
const results = []; const errors = [];
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: SHOTS + '_' + n + '.png' }); };
const waitFor = async (fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(100); } return false; };
const clickText = async (txt) => { await page.locator('#ui .screen.show button', { hasText: txt }).first().click(); };

// ---------------------------------------------------------------- boot
await page.goto(BASE);
await ev(() => localStorage.clear());
await page.goto(BASE);
await wait(1500);
ok('main menu visible', await ev(() => document.querySelector('#menu.show') !== null));
ok('continue disabled without save', await ev(() => document.querySelectorAll('#menu .btn')[1].disabled));
await shot('menu');

// ---------------------------------------------------------------- options & controls screens
await clickText('Options'); await wait(200);
ok('options screen', await ev(() => !!document.querySelector('#options.show')));
await page.locator('#options .seg button', { hasText: 'MEDIUM' }).first().click(); await wait(100);
ok('graphics quality saved', await ev(() => JSON.parse(localStorage.getItem('alienstrike.settings.v1')).quality === 'medium'));
await page.locator('#options .seg button', { hasText: 'HIGH' }).first().click(); await wait(100);
await clickText('Key bindings'); await wait(200);
ok('controls screen', await ev(() => !!document.querySelector('#controls.show')));
await page.locator('#controls .bind-row button').first().click(); await page.keyboard.press('KeyT'); await wait(150);
ok('key rebinding', await ev(() => AS.Input.bindings.forward[0] === 'KeyT'));
await clickText('Reset defaults'); await wait(100);
ok('bindings reset', await ev(() => AS.Input.bindings.forward[0] === 'KeyW'));
await clickText('Back'); await wait(100); await clickText('Back'); await wait(200);
ok('back to menu', await ev(() => !!document.querySelector('#menu.show')));

// ---------------------------------------------------------------- new campaign → briefing → launch
await clickText('Start Campaign'); await wait(300);
ok('intro shown', await ev(() => !!document.querySelector('#briefing.show')));
await clickText('Proceed to briefing'); await wait(600);
ok('briefing for w1m1', await ev(() => document.querySelector('#briefing .mname').textContent.includes('BROKEN COMPASS')));
await shot('briefing');
await clickText('Launch');
ok('mission loaded', await waitFor(() => AS.App.state === 'play' && !!AS.game, 15000));
await wait(1500);
await shot('ingame');
ok('profile created', await ev(() => !!localStorage.getItem('alienstrike.profile.v1')));

// ---------------------------------------------------------------- movement & fuel burn
let s0 = await ev(() => AS.Debug.state());
await ev(() => AS.Debug.god(true));
await page.keyboard.down('KeyW'); await wait(1200); await page.keyboard.up('KeyW');
let s1 = await ev(() => AS.Debug.state());
ok('player moves forward', Math.hypot(s1.x - s0.x, s1.y - s0.y) > 100, { from: [s0.x, s0.y], to: [s1.x, s1.y] });
ok('fuel burns while flying', s1.fuel < s0.fuel, { before: s0.fuel, after: s1.fuel });
await page.keyboard.down('KeyD'); await wait(500); await page.keyboard.up('KeyD');
ok('player rotates', await ev(() => Math.abs(AS.game.player.angle + Math.PI / 2) > 0.3));
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await wait(900);
const boostSp = await ev(() => AS.game.player.speed);
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
ok('boost exceeds base speed', boostSp > (await ev(() => AS.game.player.s.maxSpeed)), { boostSp });

// ---------------------------------------------------------------- shooting & enemy AI
await ev(() => { const e = AS.Debug.nearest((u) => u.kind === 'skitter'); AS.Debug.tp(e.x, e.y + 220); });
await wait(400);
const target = await ev(() => { const e = AS.Debug.nearest(); window.__t = e; return { hp: e.hp, kind: e.kind }; });
const aim = await ev(() => AS.Debug.screenOf(window.__t));
await page.mouse.move(aim.x, aim.y);
const ammo0 = await ev(() => AS.game.player.ammo.primary);
await page.mouse.down();
for (let i = 0; i < 12; i++) { await wait(100); const a = await ev(() => window.__t.alive ? AS.Debug.screenOf(window.__t) : null); if (a) await page.mouse.move(a.x, a.y); }
await page.mouse.up();
await shot('combat');
const after = await ev(() => ({ hp: window.__t.hp, alive: window.__t.alive, ammo: AS.game.player.ammo.primary, alerted: AS.game.units.filter((u) => u.alerted).length }));
ok('primary fire consumes ammo', after.ammo < ammo0, { ammo0, ammo: after.ammo });
ok('shots damage/kill enemy', after.hp < target.hp || !after.alive, { target, after });
ok('enemies become alerted', after.alerted > 0, after);
// missiles (dumb-fire tap)
const m0 = await ev(() => AS.game.player.ammo.secondary);
await page.mouse.down({ button: 'right' }); await wait(80); await page.mouse.up({ button: 'right' }); await wait(300);
ok('secondary fires missile', (await ev(() => AS.game.player.ammo.secondary)) === m0 - 1);
// special
const sp0 = await ev(() => AS.game.player.ammo.special);
await page.keyboard.press('Space'); await wait(1200);
ok('special weapon fires', (await ev(() => AS.game.player.ammo.special)) === sp0 - 1);

// ---------------------------------------------------------------- damage model
await ev(() => { AS.Debug.killAll(); AS.Proj.clear(); const lz = AS.game.lz; AS.Debug.tp(lz.x + 200, lz.y - 300); AS.Debug.god(false); });
await wait(300);
const d0 = await ev(() => ({ h: AS.game.player.hull, s: AS.game.player.shield }));
await ev(() => { AS.game.player.shield = 30; AS.Debug.hurt(20, 'kinetic'); });
const d1 = await ev(() => ({ h: AS.game.player.hull, s: AS.game.player.shield }));
ok('shields absorb kinetic damage first', d1.s < 30 && Math.abs(d1.h - d0.h) < 0.01, { d0, d1 });
await ev(() => { AS.game.player.shield = 0; AS.Debug.hurt(10, 'kinetic'); });
ok('hull takes damage when shields are down', (await ev(() => AS.game.player.hull)) < d1.h);
await ev(() => { AS.game.player.shield = 50; AS.Debug.hurt(20, 'bio'); });
ok('bio damage partially bypasses shields', (await ev(() => AS.game.player.hull)) < d1.h - 5);
await wait(4200);
ok('shields regenerate after delay', (await ev(() => AS.game.player.shield)) > 30);
const hullBefore = await ev(() => AS.game.player.hull);
await wait(1500);
ok('hull does not regenerate', Math.abs((await ev(() => AS.game.player.hull)) - hullBefore) < 0.01);
await ev(() => { AS.game.player.kits = 1; });
await page.keyboard.press('KeyR'); await wait(1800);
ok('repair kit restores hull', (await ev(() => AS.game.player.hull)) > hullBefore + 10);
await ev(() => AS.Debug.god(true));

// ---------------------------------------------------------------- pickups
const pk = await ev(() => { const g = AS.game; const q = g.pickups.find((p) => p.kind === 'fuel' && p.alive); g.player.fuel = 30; AS.Debug.tp(q.x, q.y + 4); return { n: g.pickups.length }; });
await wait(600);
const pk2 = await ev(() => ({ n: AS.game.pickups.length, fuel: AS.game.player.fuel }));
ok('fuel pickup collected', pk2.n < pk.n && pk2.fuel > 50, pk2);
await ev(() => { const g = AS.game; const q = g.pickups.find((p) => p.kind === 'salvage' && p.alive); if (q) AS.Debug.tp(q.x, q.y); });
await wait(500);
ok('salvage pickup counted', (await ev(() => AS.game.stats.salvage)) > 0);

// ---------------------------------------------------------------- ammo depletion
await ev(() => { AS.game.player.ammo.primary = 2; AS.game.player.heat = 0; });
await page.mouse.down(); await wait(800); await page.mouse.up();
ok('primary ammo depletes to zero and stops', (await ev(() => AS.game.player.ammo.primary)) === 0);
await ev(() => { const p = AS.game.player; p.ammo.primary = p.s.primary.ammoMax; });

// ---------------------------------------------------------------- rescue → drop-off
const g0 = await ev(() => { const gr = AS.game.groupById('crewA'); AS.Debug.tp(gr.x, gr.y - 30); return gr.remaining; });
await wait(400);
await page.keyboard.press('KeyE');
ok('survivors respond to rescue call', await waitFor(() => AS.game.player.passengers.length > 0, 8000));
await waitFor(() => AS.game.groupById('crewA').remaining === 0, 8000);
const pas = await ev(() => AS.game.player.passengers.length);
ok('survivors board the craft', pas === g0, { pas, g0 });
await ev(() => { const lz = AS.game.lz; AS.Debug.tp(lz.x, lz.y); });
ok('survivors delivered at LZ', await waitFor(() => AS.game.player.passengers.length === 0 && AS.game.script.count.deliveredTotal >= 3, 6000));
ok('rescue objective progresses', await ev(() => AS.game.script.obj('rescue').progress >= 3));
// cargo
await ev(() => { const c = AS.game.byId.get('bb'); AS.Debug.tp(c.x, c.y - 10); });
await wait(300);
await page.keyboard.down('KeyE'); await wait(1600); await page.keyboard.up('KeyE');
ok('cargo picked up with tractor beam', await ev(() => AS.game.player.cargo.length === 1));
await ev(() => { const lz = AS.game.lz; AS.Debug.tp(lz.x, lz.y); });
ok('cargo delivered → secondary objective complete', await waitFor(() => AS.game.script.obj('bb').state === 'done', 5000));
// console interaction (forward pad)
await ev(() => { const c = AS.game.byId.get('fob_console'); AS.Debug.tp(c.x, c.y + 20); });
await wait(300);
await page.keyboard.down('KeyE'); await wait(2900); await page.keyboard.up('KeyE');
ok('console interaction activates pad', await ev(() => AS.game.script.obj('fob').state === 'done' && AS.game.byId.get('fob').def.repair === true));
// trigger chain: engineer reveals bunker
await ev(() => { const g = AS.game; const gr = g.groupById('crewB'); AS.Debug.killAll(); AS.Debug.tp(gr.x, gr.y - 20); });
await wait(300); await page.keyboard.press('KeyE');
ok('engineer rescue triggers bunker unlock', await waitFor(() => AS.game.byId.get('bunker_door').locked === false, 9000));
// tactical map + objectives overlay
await page.keyboard.press('KeyM'); await wait(300);
ok('tactical map opens and pauses', await ev(() => AS.App.overlay === 'map'));
await shot('tacmap');
const tPaused = await ev(() => AS.game.time); await wait(300);
ok('game paused under map', (await ev(() => AS.game.time)) === tPaused);
await page.keyboard.press('KeyM'); await page.keyboard.press('Tab'); await wait(200);
ok('objectives overlay opens', await ev(() => AS.App.overlay === 'obj'));
await shot('objectives');
await page.keyboard.press('Tab');
// pause menu
await page.keyboard.press('Escape'); await wait(200);
ok('pause menu', await ev(() => AS.App.state === 'paused' && !!document.querySelector('#pause.show')));
await clickText('Resume'); await wait(200);
ok('resume', await ev(() => AS.App.state === 'play'));

// ---------------------------------------------------------------- extraction → success
await ev(() => { AS.Debug.deliverAll(); AS.game.script.evaluate(); });
ok('primaries complete → extraction available', await waitFor(() => AS.game.extraction.active, 3000));
await ev(() => AS.Debug.toExtraction());
ok('physical extraction succeeds', await waitFor(() => AS.App.state === 'results', 9000));
await wait(500);
await shot('success');
ok('results show success', await ev(() => document.querySelector('#results .big').textContent.includes('SUCCESS')));
const prof = await ev(() => JSON.parse(localStorage.getItem('alienstrike.profile.v1')));
ok('mission saved as completed', prof.missions.w1m1 && prof.missions.w1m1.completed);
ok('next mission unlocked', prof.unlockedMissions.includes('w1m2'));
ok('salvage awarded', prof.salvage > 250, prof.salvage);

// ---------------------------------------------------------------- hangar: buy + apply upgrade
await clickText('Continue to hangar'); await wait(600);
ok('hangar visible', await ev(() => !!document.querySelector('#hangar.show')));
await ev(() => { AS.Save.profile.salvage += 5000; AS.Save.profile.tech += 10; AS.Save.saveProfile(); AS.Hangar.render(); });
await shot('hangar');
const hull0 = await ev(() => AS.Stats.compute(AS.Save.profile).hullMax);
await page.locator('#hangar .upg', { hasText: 'ABLATIVE ARMOUR' }).locator('button').click(); await wait(200);
const prof2 = await ev(() => JSON.parse(localStorage.getItem('alienstrike.profile.v1')));
ok('upgrade purchased and saved', prof2.upgrades.armor === 1, prof2.upgrades);
ok('upgrade raises craft stats', (await ev(() => AS.Stats.compute(AS.Save.profile).hullMax)) === hull0 + 20);
await clickText('WEAPONS'); await wait(150);
await ev(() => { if (!AS.Save.profile.unlockedWeapons.includes('apc')) AS.Save.profile.unlockedWeapons.push('apc'); AS.Hangar.render(); });
await page.locator('#hangar .weapon-card', { hasText: 'BREACHER' }).locator('button').click(); await wait(150);
await page.locator('#hangar .weapon-card', { hasText: 'BREACHER' }).locator('button').click(); await wait(150);
ok('weapon fabricated and equipped', await ev(() => AS.Save.profile.loadout.primary === 'apc'));
await clickText('SUPPLIES'); await wait(150);
const kits0 = await ev(() => AS.Save.profile.repairKits);
await clickText('Buy repair kit'); await wait(150);
ok('repair kit purchase', (await ev(() => AS.Save.profile.repairKits)) === kits0 + 1 || kits0 >= 2);

// ---------------------------------------------------------------- move to next mission; upgrades applied
await clickText('Briefing'); await wait(500);
ok('next briefing is w1m2', await ev(() => document.querySelector('#briefing .mname').textContent.includes('SEEDFALL')));
await clickText('Launch');
ok('w1m2 loaded', await waitFor(() => AS.App.state === 'play' && AS.game && AS.game.mission.id === 'w1m2', 15000));
ok('upgrade applied in flight', await ev(() => AS.game.player.s.hullMax === 120 && AS.game.player.s.primary.id === 'apc'));
await wait(800);
await shot('w1m2');

// ---------------------------------------------------------------- failure: fuel exhaustion
await ev(() => { AS.Debug.god(false); AS.game.player.fuel = 0.05; });
await page.keyboard.down('KeyW'); await wait(700); await page.keyboard.up('KeyW');
ok('emergency reserve engages at zero fuel', await waitFor(() => AS.game.player.emergency > 0, 3000));
ok('propulsion weakens without fuel', await ev(() => AS.game.player.speed < AS.game.player.s.maxSpeed * 0.5));
await ev(() => { AS.game.player.emergency = 0.2; });
ok('emergency exhaustion → crash → failure screen', await waitFor(() => AS.App.state === 'results', 9000));
await wait(400);
await shot('failure');
ok('results show failure', await ev(() => document.querySelector('#results .big').textContent.includes('FAILED')));
await clickText('Retry');
ok('retry reloads the mission', await waitFor(() => AS.App.state === 'play' && AS.game && AS.game.time < 2, 15000));
// death by hull
await ev(() => { AS.game.player.shield = 0; AS.Debug.hurt(9999, 'kinetic'); });
ok('hull destroyed → failure', await waitFor(() => AS.App.state === 'results', 8000));
await clickText('Return to hangar'); await wait(400);

// ---------------------------------------------------------------- save / load across reload
await page.goto(BASE); await wait(1500);
ok('continue enabled after reload', await ev(() => !document.querySelectorAll('#menu .btn')[1].disabled));
ok('profile persisted', await ev(() => AS.Save.profile && AS.Save.profile.upgrades.armor === 1 && AS.Save.profile.missions.w1m1.completed));
await clickText('Continue'); await wait(400);
ok('continue → hangar', await ev(() => !!document.querySelector('#hangar.show')));
await clickText('Mission select'); await wait(400);
ok('mission select shows worlds', await ev(() => document.querySelectorAll('.world-card').length === 10));
await shot('select');

// ---------------------------------------------------------------- every mission loads and runs
const ids = await ev(() => AS.Levels.ordered().map((m) => m.id));
for (const id of ids) {
  await ev((m) => { AS.App.endGame(); AS.App.startMission(m, { god: true }); }, id);
  const loaded = await waitFor((m) => AS.App.state === 'play' && AS.game && AS.game.mission.id === m, 20000, id);
  if (!loaded) { ok('mission ' + id + ' loads', false); continue; }
  // fly around a bit and fire
  await page.keyboard.down('KeyW'); await page.mouse.move(900, 300); await page.mouse.down(); await wait(1600); await page.mouse.up(); await page.keyboard.up('KeyW');
  const st = await ev(() => AS.Debug.state());
  // force completion, run the boss logic, then extract
  await ev(() => { const g = AS.game; for (const b of (g.bossList || [])) { b.bossAct('activate'); } });
  await wait(600);
  await ev(() => { const g = AS.game; for (const b of (g.bossList || [])) { b.shieldedBy = []; b.vulnT = 5; b.takeDamage(1e7, 'ap', g.player); } AS.Debug.completeAll(); });
  const extr = await waitFor(() => AS.game.extraction.active, 4000);
  await ev(() => AS.Debug.toExtraction());
  const done = await waitFor(() => AS.App.state === 'results', 12000);
  ok('mission ' + id + ' loads, plays and extracts', loaded && extr && done, { units: st.units, t: st.t });
  if (SHOTS && ['w2m1', 'w3m1', 'w4m1', 'w5m1', 'w6m1', 'w7m1', 'w8m1', 'w9m1', 'w10m1'].includes(id)) { await ev(() => AS.App.restart()); await waitFor(() => AS.App.state === 'play', 15000); await wait(1800); await shot(id); }
}

// ---------------------------------------------------------------- summary
const fails = results.filter((r) => !r.pass);
const uniqErr = [...new Set(errors)];
console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed');
if (uniqErr.length) { console.log('ERRORS (' + uniqErr.length + '):'); uniqErr.slice(0, 40).forEach((e) => console.log('  ' + e)); } else console.log('No console or network errors.');
await browser.close();
process.exit(fails.length || uniqErr.length ? 1 : 0);
