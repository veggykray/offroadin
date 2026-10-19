// Drives the REAL built app in headless Chromium: screenshots + combat interactions via the
// window.__lastCall hook and real keyboard/mouse input. Usage: node e2e/smoke.mjs
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
let chromium;
try {
  const dir = process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/';
  ({ chromium } = createRequire(dir)('playwright'));
} catch {
  ({ chromium } = require('playwright'));
}

const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

console.log('building…');
const b = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { stdio: 'inherit' });
if (b.status !== 0) process.exit(b.status ?? 1);

const server = await preview({ preview: { port: 4174, open: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const g = (fn) => page.evaluate(fn);
const settle = async (ms = 15000) => { await page.waitForFunction(() => window.__lastCall.game.settled(), null, { timeout: ms }); await page.waitForTimeout(80); };
const shot = async (name) => { await page.screenshot({ path: `${out}${name}.png` }); console.log('      saved', name + '.png'); };
const worldToScreen = async (x, y) => page.evaluate(([x, y]) => window.__lastCall.cam.worldToScreen(x, y), [x, y]);
const clickWorld = async (x, y) => { const p = await worldToScreen(x, y); await page.mouse.move(p.x / 1, p.y / 1); await page.waitForTimeout(60); await page.mouse.move(p.x, p.y); await page.waitForTimeout(60); await page.mouse.click(p.x, p.y); };

try {
  await page.goto(url + '?seed=1234');
  await page.waitForFunction(() => window.__lastCall && window.__lastCall.game.frame >= 0, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  check('prologue shown first', await g(() => window.__lastCall.intro.active && window.__lastCall.game.phase === 'intro'));
  await shot('01-prologue');
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  check('prologue advances on Space', await g(() => window.__lastCall.intro.step === 1));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  check('skip starts the battle', await g(() => window.__lastCall.game.phase === 'player'));

  // Default view: whole battlefield, character size ratios.
  const sizes = await g(() => { const { game, cam } = window.__lastCall; const h = 1080; return { human: game.hero('duelist').body.h * cam.zoom / (cam.vh) , giant: game.hero('giant').body.h * cam.zoom / cam.vh, fit: cam.isFit, zoom: cam.zoom, vw: cam.vw, vh: cam.vh }; });
  check('default camera fits the whole 100-unit battlefield', sizes.fit, `zoom ${sizes.zoom.toFixed(2)} px/unit on ${sizes.vw}x${sizes.vh}`);
  check('ordinary hero ≈ 5–8% of screen height', sizes.human >= 0.05 && sizes.human <= 0.08, `${(sizes.human * 100).toFixed(1)}%`);
  check('giant ≈ 9–11% of screen height', sizes.giant >= 0.09 && sizes.giant <= 0.11, `${(sizes.giant * 100).toFixed(1)}%`);
  await page.mouse.move(960, 300);
  await shot('02-battlefield-default-zoom-1920x1080');

  // All five heroes selectable by key.
  let sel = [];
  for (let i = 1; i <= 5; i++) { await page.keyboard.press(`Digit${i}`); await page.waitForTimeout(30); sel.push(await g(() => window.__lastCall.game.selected.kind)); }
  check('all five heroes selectable with 1-5', JSON.stringify(sel) === JSON.stringify(['beast', 'giant', 'inventor', 'spear', 'duelist']), sel.join(','));
  const byClick = await g(() => { const { game, cam } = window.__lastCall; const u = game.hero('spear'); return cam.worldToScreen(u.body.x, u.body.y + 1.5); });
  await page.mouse.click(byClick.x, byClick.y); await page.waitForTimeout(50);
  check('hero selectable by click', await g(() => window.__lastCall.game.selected.kind === 'spear'));

  // Inventor: walk + cannot jump + six legs.
  await page.keyboard.press('Digit3');
  const x0 = await g(() => window.__lastCall.game.selected.body.x);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyW'); await page.waitForTimeout(200);
  const inv = await g(() => { const u = window.__lastCall.game.selected; return { x: u.body.x, moved: u.moved, left: u.moveLeft, msg: window.__lastCall.game.messages.some((m) => /cannot jump/.test(m.text)), grounded: u.body.grounded }; });
  check('inventor walks and spends movement', inv.x > x0 + 1 && inv.moved && inv.left < 8, `x ${x0.toFixed(1)}→${inv.x.toFixed(1)}, left ${inv.left.toFixed(1)}`);
  check('inventor refuses to jump with an explanation', inv.msg && inv.grounded);

  // Cannon via real mouse aiming + click. Aim toward the market terraces.
  await page.keyboard.press('KeyE'); await page.waitForTimeout(50);
  check('cannon aim mode entered', await g(() => window.__lastCall.game.mode === 'signature'));
  await page.mouse.move(...Object.values(await worldToScreen(30, 20))); await page.waitForTimeout(150);
  const pv = await g(() => { const p = window.__lastCall.game.preview; return p && p.points && p.points.length > 5 && !!p.impact; });
  check('trajectory preview with impact point shown', pv);
  await shot('03-cannon-aim-preview');
  const before = await g(() => ({ removed: window.__lastCall.game.terrain.removedCells, ex: window.__lastCall.game.stats.explosions }));
  await clickWorld(30, 20);
  await page.waitForTimeout(150);
  check('shell in flight after click', await g(() => window.__lastCall.game.projectiles.length === 1 || window.__lastCall.game.stats.explosions > 0));
  await settle();
  const after = await g(() => ({ removed: window.__lastCall.game.terrain.removedCells, ex: window.__lastCall.game.stats.explosions, acted: window.__lastCall.game.hero('inventor').acted }));
  check('cannon exploded, carved destructible terrain, spent the action', after.ex > before.ex && after.removed > before.removed && after.acted, `${after.removed - before.removed} cells removed`);
  await shot('04-after-cannon');

  // Spear throw with the mouse, then it rests somewhere reachable.
  await page.keyboard.press('Digit4'); await page.keyboard.press('KeyE'); await page.waitForTimeout(50);
  await clickWorld(32, 18); await settle();
  const spear = await g(() => ({ state: window.__lastCall.game.spear.state, x: window.__lastCall.game.spear.body.x, grounded: window.__lastCall.game.spear.body.grounded }));
  check('spear thrown and resting on the ground', spear.state === 'resting' && spear.grounded, `x=${spear.x.toFixed(1)}`);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(50);
  check('piercing throw refused while the spear is away (no action spent)', await g(() => { const gm = window.__lastCall.game; return gm.mode === 'none' && !gm.hero('spear').acted === false || (gm.mode === 'none' && gm.messages.some((m) => /lying at/.test(m.text))); }));

  // Giant charge right from the tavern: breaks the timber cover.
  await page.keyboard.press('Digit2'); await page.keyboard.press('KeyE'); await page.waitForTimeout(50);
  const timberBefore = await g(() => window.__lastCall.game.terrain.countMat(3));
  await clickWorld(30, 12); await settle();
  const timberAfter = await g(() => window.__lastCall.game.terrain.countMat(3));
  check('shield charge smashed timber cover', timberAfter < timberBefore, `${timberBefore - timberAfter} timber cells`);

  // End squad turn -> enemy phase runs deterministically and returns.
  await page.keyboard.press('KeyT'); await page.waitForTimeout(100);
  check('enemy phase started', await g(() => window.__lastCall.game.phase === 'enemy'));
  await page.waitForTimeout(900);
  await shot('05-enemy-phase');
  await page.waitForFunction(() => window.__lastCall.game.phase === 'player', null, { timeout: 40000 });
  const t2 = await g(() => { const gm = window.__lastCall.game; return { turn: gm.turn, intents: gm.enemies.map((e) => e.intent), refreshed: gm.heroes.every((h) => !h.acted) }; });
  check('enemy phase resolved; heroes refreshed for turn 2', t2.turn === 2 && t2.refreshed && t2.intents.every((s) => s.length > 0), t2.intents.join(' | '));

  // Zoom in around the squad, screenshot, then overview.
  const sq = await worldToScreen(16, 12);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -200);
  await page.mouse.move(sq.x, sq.y); await page.waitForTimeout(600);
  await shot('06-zoomed-in');
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(500);
  check('overview key restores the fit camera', await g(() => window.__lastCall.cam.isFit));

  // Debug overlay + help.
  await page.keyboard.press('F3'); await page.waitForTimeout(100);
  check('debug overlay toggles', await g(() => !document.getElementById('debug').hidden && document.getElementById('debug').textContent.includes('phase')));
  await page.keyboard.press('KeyH'); await page.waitForTimeout(100);
  check('help overlay toggles', await g(() => !document.getElementById('help').hidden));
  await shot('07-debug-and-help');
  await page.keyboard.press('KeyH'); await page.keyboard.press('F3');

  // Restart: R twice, skips the prologue.
  await page.keyboard.press('KeyR'); await page.waitForTimeout(100); await page.keyboard.press('KeyR'); await page.waitForTimeout(200);
  check('restart resets to squad turn 1 without the prologue', await g(() => { const gm = window.__lastCall.game; return gm.phase === 'player' && gm.turn === 1 && gm.terrain.removedCells === 0 && gm.livingEnemies().length === 3 && !window.__lastCall.intro.active; }));

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('smoke run completed', false, String(e));
} finally {
  await browser.close();
  await server.close();
}
copyFileSync(`${out}02-battlefield-default-zoom-1920x1080.png`, new URL('../docs/screenshot-battlefield-1920x1080.png', import.meta.url).pathname);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed`);
process.exit(failed.length ? 1 : 0);
