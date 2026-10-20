// Drives the REAL built app in headless Chromium (WebGL via SwiftShader): screenshots at default
// gameplay zoom + combat interactions through real input and the window.__fm hook. Usage: node e2e/smoke.mjs
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/')('playwright')); }
catch { ({ chromium } = require('playwright')); }

const out = new URL('./out/', import.meta.url).pathname; mkdirSync(out, { recursive: true });
if (process.env.SKIP_BUILD !== '1') {
  console.log('building…');
  const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { stdio: 'inherit' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const server = await preview({ preview: { port: 4180, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const g = (fn, arg) => page.evaluate(fn, arg);
const settle = async () => { await page.evaluate(() => window.__fm.game.settle(60 * 30)); await page.waitForTimeout(150); };
const shot = async (name) => { await page.screenshot({ path: `${out}${name}.png` }); console.log('      saved', name + '.png'); };
const w2s = async (x, y) => page.evaluate(([x, y]) => window.__fm.view.worldToScreen(x, y), [x, y]);
const clickWorld = async (x, y) => { const p = await w2s(x, y); await page.mouse.move(p.x, p.y); await page.waitForTimeout(80); await page.mouse.move(p.x + 1, p.y); await page.waitForTimeout(80); await page.mouse.click(p.x, p.y); };

try {
  await page.goto(url + '?seed=1234');
  await page.waitForFunction(() => window.__fm && window.__fm.game.frame >= 0, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  check('prologue shown first', await g(() => window.__fm.intro.active && window.__fm.game.phase === 'intro'));
  await shot('01-prologue');
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check('prologue advances on Space', await g(() => window.__fm.intro.step === 1));
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  check('skip starts the battle', await g(() => window.__fm.game.phase === 'player'));
  const sizes = await g(() => { const { game, view } = window.__fm; return { human: game.hero('duelist').body.h * view.zoom / view.vh, giant: game.hero('giant').body.h * view.zoom / view.vh, fit: view.isFit, zoom: view.zoom, vw: view.vw, vh: view.vh }; });
  check('default camera fits the whole battlefield', sizes.fit, `zoom ${sizes.zoom.toFixed(2)} px/unit on ${sizes.vw}x${sizes.vh}`);
  check('ordinary hero ≈ 5–9% of viewport height', sizes.human >= 0.05 && sizes.human <= 0.09, `${(sizes.human * 100).toFixed(1)}%`);
  check('giant clearly larger (9–12%)', sizes.giant >= 0.09 && sizes.giant <= 0.12, `${(sizes.giant * 100).toFixed(1)}%`);
  await page.mouse.move(960, 200); await page.waitForTimeout(400);
  await shot('02-battlefield-default-zoom-1920x1080');
  let sel = [];
  for (let i = 1; i <= 5; i++) { await page.keyboard.press(`Digit${i}`); await page.waitForTimeout(40); sel.push(await g(() => window.__fm.game.selected.kind)); }
  check('all five heroes selectable with 1-5', JSON.stringify(sel) === JSON.stringify(['beast', 'giant', 'inventor', 'spear', 'duelist']), sel.join(','));
  const bc = await g(() => { const { game, view } = window.__fm; const u = game.hero('spear'); return view.worldToScreen(u.body.x, u.body.y + 1.5); });
  await page.mouse.click(bc.x, bc.y); await page.waitForTimeout(60);
  check('hero selectable by click', await g(() => window.__fm.game.selected.kind === 'spear'));
  // inventor walks; cannot jump
  await page.keyboard.press('Digit3');
  const x0 = await g(() => window.__fm.game.selected.body.x);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
  const xk = await g(() => window.__fm.game.selected.body.x);
  check('keyboard D moves the selected hero', xk > x0, `x ${x0.toFixed(1)}→${xk.toFixed(1)} (software GL runs few frames)`);
  // headless frames are slow under software GL, so also drive the simulation deterministically through the hook
  await g(() => { const gm = window.__fm.game; gm.input.moveDir = 1; gm.step(60); gm.input.moveDir = 0; });
  await page.keyboard.press('KeyW'); await page.waitForTimeout(100); await g(() => window.__fm.game.step(5));
  const inv = await g(() => { const u = window.__fm.game.selected; return { x: u.body.x, left: u.moveLeft, msg: window.__fm.game.messages.some((m) => /cannot jump/.test(m.text)), grounded: u.body.grounded }; });
  check('six-legged walker moves over the ground and spends movement', inv.x > x0 + 1 && inv.left < 8, `x ${x0.toFixed(1)}→${inv.x.toFixed(1)}`);
  check('walker refuses to jump with an explanation', inv.msg && inv.grounded);
  // cannon with real mouse aiming
  await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  await page.mouse.move(...Object.values(await w2s(32, 22))); await page.waitForTimeout(250);
  check('trajectory preview shown', await g(() => { const p = window.__fm.game.preview; return !!(p && p.points && p.points.length > 5 && p.impact); }));
  await shot('03-cannon-aim-preview');
  const before = await g(() => ({ removed: window.__fm.game.terrain.removedCells, ex: window.__fm.game.stats.explosions }));
  await clickWorld(32, 22); await g(() => window.__fm.game.step(40)); await page.waitForTimeout(300); await shot('04-shell-in-flight'); await settle();
  const after = await g(() => ({ removed: window.__fm.game.terrain.removedCells, ex: window.__fm.game.stats.explosions, acted: window.__fm.game.hero('inventor').acted }));
  check('cannon exploded, deformed terrain, spent the action', after.ex > before.ex && after.removed > before.removed && after.acted, `${after.removed - before.removed} cells removed`);
  await page.waitForTimeout(200); await shot('05-after-cannon-crater');
  // spear throw
  await page.keyboard.press('Digit4'); await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  await clickWorld(30, 20); await settle();
  const sp = await g(() => ({ st: window.__fm.game.spear.state, x: window.__fm.game.spear.body.x, gr: window.__fm.game.spear.body.grounded }));
  check('spear thrown and resting (must be retrieved on foot)', sp.st === 'resting' && sp.gr, `x=${sp.x.toFixed(1)}`);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  check('second throw refused while the spear is away (already acted this turn)', await g(() => { const gm = window.__fm.game; return gm.mode === 'none' && gm.messages.some((m) => /already acted|lying at/.test(m.text)); }));
  // giant: shield charge breaks the timber cover
  await page.keyboard.press('Digit2'); await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  const tb = await g(() => window.__fm.game.terrain.countMat(3));
  await clickWorld(30, 12); await g(() => window.__fm.game.step(25)); await page.waitForTimeout(300); await shot('06-shield-charge'); await settle();
  const ta = await g(() => window.__fm.game.terrain.countMat(3));
  check('shield charge smashed timber', ta < tb, `${tb - ta} timber cells`);
  // jackal attack validation (unreachable archer refused, no action spent)
  await page.keyboard.press('Digit1'); await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  await page.evaluate(() => { const gm = window.__fm.game; gm.aim.targetId = gm.enemies[2].id; });
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  check('jackal attack refuses an unreachable target without spending the action', await g(() => !window.__fm.game.hero('beast').acted && window.__fm.game.messages.some((m) => /can't reach/.test(m.text))));
  await page.keyboard.press('Escape');
  // end turn -> enemy phase
  await page.keyboard.press('KeyT'); await page.waitForTimeout(150);
  check('enemy phase started', await g(() => window.__fm.game.phase === 'enemy'));
  await g(() => window.__fm.game.step(70)); await page.waitForTimeout(400); await shot('07-enemy-phase');
  await g(() => { const gm = window.__fm.game; let n = 0; while (gm.phase === 'enemy' && n < 60 * 90) { gm.step(1); n++; } });
  await page.waitForTimeout(200);
  const t2 = await g(() => { const gm = window.__fm.game; return { turn: gm.turn, intents: gm.enemies.map((e) => e.intent), refreshed: gm.heroes.every((h) => !h.acted) }; });
  check('enemy phase resolved; heroes refreshed for turn 2', t2.turn === 2 && t2.refreshed && t2.intents.every((s) => s.length > 0), t2.intents.join(' | '));
  // show-off + jackal on a reachable raider (headless setup through legal commands: move a raider next to the duelist)
  await page.evaluate(() => { const gm = window.__fm.game; const d = gm.hero('duelist'); const r = gm.enemies[0]; r.body.x = d.body.x + 5; r.body.y = d.body.y; r.body.grounded = true; });
  await page.keyboard.press('Digit5'); await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  await page.evaluate(() => { const gm = window.__fm.game; gm.aim.targetId = gm.enemies[0].id; });
  const hp0 = await g(() => window.__fm.game.enemies[0].hp);
  await page.keyboard.press('Enter'); await g(() => window.__fm.game.step(12)); await page.waitForTimeout(300); await shot('08-show-off'); await settle();
  check('show-off: shot + lunge + stab resolved', await g(([hp0]) => window.__fm.game.enemies[0].hp === hp0 - 40, [hp0]));
  await page.keyboard.press('Digit1'); await page.keyboard.press('KeyE'); await page.waitForTimeout(60);
  await page.evaluate(() => { const gm = window.__fm.game; gm.aim.targetId = gm.enemies[0].id; });
  const hp1 = await g(() => window.__fm.game.enemies[0].hp);
  await page.keyboard.press('Enter'); await g(() => window.__fm.game.step(30)); await page.waitForTimeout(300); await shot('09-jackal-run'); await settle();
  check('jackal attack ran a real path and bit', await g(([hp1]) => { const e = window.__fm.game.enemies[0]; return (e.hp === Math.max(0, hp1 - 20)) && window.__fm.game.jackal.state === 'heel' && window.__fm.game.messages.some((m) => /jackal goes for/.test(m.text)); }, [hp1]));
  // zoomed view
  const sq = await w2s(16, 12); await page.mouse.move(sq.x, sq.y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -200);
  await page.waitForTimeout(700); await shot('10-zoomed-in');
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(500);
  check('overview restores the fit camera', await g(() => window.__fm.view.isFit));
  await page.keyboard.press('F3'); await page.keyboard.press('KeyH'); await page.waitForTimeout(150); await shot('11-debug-help'); await page.keyboard.press('KeyH'); await page.keyboard.press('F3');
  await page.keyboard.press('KeyR'); await page.waitForTimeout(100); await page.keyboard.press('KeyR'); await page.waitForTimeout(400);
  check('restart resets to squad turn 1 without the prologue', await g(() => { const gm = window.__fm.game; return gm.phase === 'player' && gm.turn === 1 && gm.terrain.removedCells === 0 && gm.livingEnemies().length === 3 && !window.__fm.intro.active; }));
  const fps = await g(() => window.__fm.state.fps);
  console.log('      headless fps (software GL):', fps.toFixed(0));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) { check('smoke run completed', false, String(e)); }
finally { await browser.close(); await server.close(); }
try { copyFileSync(`${out}02-battlefield-default-zoom-1920x1080.png`, new URL('../docs/screenshot-battlefield-1920x1080.png', import.meta.url).pathname); } catch {}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`);
process.exit(failed.length ? 1 : 0);
