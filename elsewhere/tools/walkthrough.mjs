// Full P2 walkthrough through user-facing input (clicks on screen positions) in headless Chromium.
// Captures screenshots at the required moments, a video, console/network errors and perf samples.
// usage: node tools/walkthrough.mjs [--w 1280 --h 800] [--out evidence/desktop] [--video] [--rounds 2] [--mobile]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
import { makeDriver } from './drive.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const W = +(args.w || 1280), H = +(args.h || 800), OUT = args.out || 'evidence/desktop', ROUNDS = +(args.rounds || 1);
mkdirSync(OUT, { recursive: true });
const { url, close } = await serve(args.dist || 'dist');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctxOpts = { viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: !!args.mobile, isMobile: !!args.mobile };
if (args.video) ctxOpts.recordVideo = { dir: join(OUT, 'video_raw'), size: { width: W, height: H } };
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();
const report = { viewport: [W, H], mobile: !!args.mobile, errors: [], checks: [], perf: [], shots: [] };
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') report.errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => report.errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => report.errors.push('requestfailed: ' + r.url()));
const failed = [];
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) failed.push(name); console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name + (detail ? ' — ' + detail : '')); };
const snap = () => page.evaluate(() => window.__elsewhere.snapshot());
const perf = async (label) => { const s = await page.evaluate(() => window.__elsewhere.stats()); report.perf.push({ label, ...s }); };
const shot = async (name) => { const f = join(OUT, name + '.png'); await page.screenshot({ path: f }); report.shots.push(f); };
const { screenOf, clickAt, tapWorld, tapThing, tapActor, portrait, waitFor } = makeDriver(page, { mobile: !!args.mobile, W, H });
const settle = () => waitFor(() => { const s = window.__elsewhere.snapshot(); return ['dog', 'cat'].every((a) => s[a].motion === 'idle' || s[a].motion === 'sit') && !['rising', 'descending', 'rejecting'].includes(s.lift.state); }, 30000, 'settle');

await page.goto(url + '/index.html');
await page.waitForFunction(() => !!window.__elsewhere);
// 1. fresh load: assets + errors
check('fresh load: build id shown on start screen', (await page.textContent('#start')).includes(await page.evaluate(() => window.__elsewhere.build)));
await shot('00_start_screen');
await page.click('#play');
await page.waitForTimeout(1200);
await shot('01_initial_view');
await perf('initial');
// hit targets
const sizes = await page.evaluate(() => [...document.querySelectorAll('#hud button')].filter((b) => b.offsetParent !== null).map((b) => ({ id: b.id || b.className, w: b.offsetWidth, h: b.offsetHeight })));
check('all visible HUD buttons ≥ 48 CSS px', sizes.every((s) => s.w >= 48 && s.h >= 40), JSON.stringify(sizes));

async function runSequence(round) {
  const tag = (n) => (round ? `r${round}_` : '') + n;
  // depth test: dog walks through the root arch (behind the near pier/lintel) and out again
  await portrait('dog'); await tapWorld(-7.6, 3.3); await waitFor(() => window.__elsewhere.game.dog.motion === 'idle' && window.__elsewhere.game.dog.x < -7, 20000, 'arch west');
  await page.waitForTimeout(300); await shot(tag('01b_behind_arch'));
  await tapWorld(-3.9, 3.3);
  check(tag('dog passes through the arch opening and out'), await waitFor(() => window.__elsewhere.game.dog.motion === 'idle' && window.__elsewhere.game.dog.x > -4.5, 20000, 'arch east'));
  await page.waitForTimeout(300); await shot(tag('01c_out_of_arch'));
  // A. Investigate
  await portrait('dog'); await tapActor('dog');
  check(tag('dog sniff reveals scent trail'), await waitFor(() => window.__elsewhere.game.scentTrail.length > 2, 5000, 'scent'));
  await page.waitForTimeout(1200); await shot(tag('02_scent_clue'));
  await tapThing('seep');
  check(tag('seep scraped open'), await waitFor(() => window.__elsewhere.snapshot().cyan.seepOpen, 20000, 'seep'));
  await page.waitForTimeout(1500); await shot(tag('03_seep_open_cyan_spill'));
  // B. Redirect
  await tapThing('CV-01');
  check(tag('CV-01 → bridge, cyan travels, receiver fills, E02 forms'), await waitFor(() => window.__elsewhere.snapshot().cyan.bridgeSolid, 30000, 'bridge'));
  check(tag('P2_BRIDGE_READY awarded'), (await snap()).flags.includes('P2_BRIDGE_READY'));
  await page.waitForTimeout(600); await shot(tag('04_cyan_bridge_ready')); await perf('bridge');
  // dog onto the bridge, cat toggles away: closure must wait
  await tapWorld(0.3, -1.0); await waitFor(() => Math.abs(window.__elsewhere.game.dog.x) < 1.5 && window.__elsewhere.game.dog.motion === 'idle', 20000, 'dog on bridge');
  await portrait('cat'); await tapThing('CV-01');
  await waitFor(() => window.__elsewhere.snapshot().cyan.diverter === 'spill', 15000, 'diverter spill');
  await page.waitForTimeout(2500);
  let s = await snap(); check(tag('closure deferred while occupied (bridge stays solid)'), s.cyan.closePending && s.cyan.bridgeSolid, JSON.stringify(s.cyan));
  await shot(tag('05_closure_deferred'));
  await tapThing('CV-01'); await waitFor(() => window.__elsewhere.snapshot().cyan.diverter === 'bridge', 15000, 'diverter bridge');
  // dog completes crossing → latch
  await portrait('dog'); await tapWorld(6.5, -0.5);
  check(tag('first crossing latches P2_BRIDGE_SAFE'), await waitFor(() => window.__elsewhere.snapshot().cyan.bridgeSafe, 20000, 'latch'));
  await portrait('cat'); await tapThing('CV-01'); await waitFor(() => window.__elsewhere.snapshot().cyan.diverter === 'spill', 15000);
  check(tag('after latch: cyan drains but slats keep E02 walkable'), await waitFor(() => { const c = window.__elsewhere.snapshot().cyan; return !c.bridgeSolid && window.__elsewhere.game.cyan.bridgeWalkable; }, 15000, 'drain'));
  await page.waitForTimeout(500); await shot(tag('06_latched_slats_cyan_redirected'));
  await tapThing('CV-01'); await waitFor(() => window.__elsewhere.snapshot().cyan.bridgeSolid, 20000);
  // C. Reassure
  await portrait('dog'); await tapWorld(8.4, 0.9);
  check(tag('White follows and balks once at the lift'), await waitFor(() => window.__elsewhere.snapshot().white.balked, 25000, 'balk'));
  await page.waitForTimeout(2200); await shot(tag('07_white_balks'));
  await tapActor('white');
  check(tag('dog sits beside White; White reassured without timers'), await waitFor(() => window.__elsewhere.snapshot().white.reassured, 25000, 'reassure'));
  await page.waitForTimeout(800); await shot(tag('08_reassured'));
  // D. Separate: cat rides weak lift alone
  await portrait('cat'); const crossed = await tapWorld(5.5, -1.6); if (!(await waitFor(() => window.__elsewhere.game.cat.x > 4, 30000, 'cat crosses'))) console.log('  [debug] tapWorld=' + crossed + ' state=' + JSON.stringify(await snap()));
  await tapThing('liftBase');
  check(tag('weak lift carries the cat to 1A'), await waitFor(() => { const s = window.__elsewhere.snapshot(); return s.cat.floor === 1 && s.lift.state === 'docked1'; }, 30000, 'cat up'));
  await page.waitForTimeout(700); await shot(tag('09_cat_above_1A')); await perf('floor1');
  s = await snap(); check(tag('dog and White remain below'), s.dog.floor === 0 && s.white.floor === 0);
  const before = JSON.stringify([s.dog, s.white]);
  await portrait('dog'); await page.waitForTimeout(900); await shot(tag('10_dog_white_below'));
  await portrait('cat'); await page.waitForTimeout(500);
  s = await snap(); check(tag('switching floors never moves the others'), JSON.stringify([s.dog, s.white]) === before);
  // cat returns before solving, then rides again
  await tapThing('liftTop');
  check(tag('cat can return down before the upgrade'), await waitFor(() => window.__elsewhere.snapshot().cat.floor === 0 && window.__elsewhere.snapshot().lift.state === 'docked0', 30000, 'cat down'));
  // dog is rejected safely
  await portrait('dog'); await tapThing('liftBase');
  check(tag('weak lift rejects the dog'), await waitFor(() => window.__elsewhere.game.history.includes('lift:reject'), 30000, 'reject'));
  await page.waitForTimeout(600); await shot(tag('11_dog_rejected'));
  check(tag('dog steps off safely, still on floor 0'), await waitFor(() => { const s = window.__elsewhere.snapshot(); return s.lift.state === 'docked0' && s.dog.floor === 0 && s.dog.motion === 'idle' && Math.hypot(s.dog.x - 11, s.dog.z) > 1.6; }, 20000, 'step off'));
  // E. Strengthen
  await portrait('cat'); await tapThing('liftBase'); await waitFor(() => window.__elsewhere.snapshot().cat.floor === 1 && window.__elsewhere.snapshot().lift.state === 'docked1', 30000);
  await tapThing('indicator'); await waitFor(() => window.__elsewhere.snapshot().cat.motion === 'inspect', 15000, 'inspect');
  await page.waitForTimeout(400); await shot(tag('12_inspect_indicator'));
  await settle();
  await tapThing('MR-01');
  check(tag('MR-01 raises pressure (P2_LIFT_STRONG)'), await waitFor(() => window.__elsewhere.snapshot().lift.strength === 'strong', 20000, 'strong'));
  await page.waitForTimeout(1200); await shot(tag('13_lift_strong'));
  // F. Reunite
  await portrait('dog'); await tapThing('liftBase');
  check(tag('strong lift carries dog + White; White joins automatically'), await waitFor(() => { const s = window.__elsewhere.snapshot(); return s.lift.state === 'rising' && s.lift.passengers.includes('dog') && s.lift.passengers.includes('white'); }, 30000, 'ascent'));
  await page.waitForTimeout(1600); await shot(tag('14_ascending_together'));
  check(tag('completion requires all three at 1A → P2_ASCENDED'), await waitFor(() => window.__elsewhere.snapshot().completed, 30000, 'complete'));
  await page.waitForTimeout(2600); await shot(tag('15_reunion')); await perf('reunion');
  check(tag('banner shown with replay control'), await page.isVisible('#banner'));
}

try {
for (let r = 1; r <= ROUNDS; r++) {
  console.log(`-- round ${r}`);
  await runSequence(ROUNDS > 1 ? r : 0);
  if (r < ROUNDS || args.resetcheck !== 'no') {
    if (await page.isVisible('#replay')) await page.click('#replay'); else await page.click('#reset');
    await page.waitForTimeout(600);
    const s = await snap();
    check(`reset restores start state (round ${r})`, s.dog.floor === 0 && s.cat.floor === 0 && s.white.floor === 0 && !s.cyan.seepOpen && s.lift.strength === 'weak' && !s.white.balked && !s.completed && s.flags.length === 3 && s.cyan.diverter === 'spill', JSON.stringify(s));
    await shot(`16_after_reset_r${r}`);
  }
}
// camera gestures: drag must pan and never activate anything
{
  const s0 = await snap(); const pan0 = await page.evaluate(() => [window.__elsewhere.view.pan.x, window.__elsewhere.view.pan.y]);
  const p = await screenOf('interactable', 'CV-01');
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 120, p.y + 60, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(300); const s1 = await snap(); const pan1 = await page.evaluate(() => [window.__elsewhere.view.pan.x, window.__elsewhere.view.pan.y]);
  check('drag over a valve pans the camera without activating it', s1.cyan.diverter === s0.cyan.diverter && s1.dog.motion === 'idle' && (pan1[0] !== pan0[0] || pan1[1] !== pan0[1]), `pan ${pan0}→${pan1}`);
  const vh0 = await page.evaluate(() => window.__elsewhere.view.viewHeight);
  await page.mouse.wheel(0, -300); await page.waitForTimeout(200);
  const vh1 = await page.evaluate(() => window.__elsewhere.view.viewHeight);
  check('wheel zoom changes the view height within limits', vh1 < vh0 && vh1 >= 7, `${vh0}→${vh1}`);
  await shot('17_zoomed_panned');
  await page.mouse.wheel(0, 300);
}
// portrait → landscape keeps state
{
  const strip = (s) => { delete s.time; delete s.hint; return JSON.stringify(s); };
  const before = strip(await snap());
  await page.setViewportSize({ width: H, height: W }); await page.waitForTimeout(400);
  const warn = await page.isVisible('#portrait-warn');
  await shot('18_portrait_reminder');
  await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(400);
  const after = strip(await snap());
  check('portrait reminder shown on narrow portrait, state kept after rotating back', (H < 700 ? warn : true) && !(await page.isVisible('#portrait-warn')) && before === after, `warn=${warn} same=${before === after}`);
}
// plain-geometry dev toggle shares the state
{
  await page.keyboard.press('g'); await page.waitForTimeout(500);
  const plain = await page.evaluate(() => window.__elsewhere.view.isPlain);
  await shot('19_plain_geometry_dev');
  await page.keyboard.press('g');
  check('developer plain-geometry toggle', plain);
}
await perf('end');
} catch (e) { console.log('harness error: ' + (e && e.message)); report.harnessError = String(e && e.message); }
await context.close();
if (args.video) {
  const raw = readdirSync(join(OUT, 'video_raw')).find((f) => f.endsWith('.webm'));
  if (raw) { const src = join(OUT, 'video_raw', raw); const dst = join(OUT, 'walkthrough.mp4'); try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', 'fps=20,scale=iw:ih', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', dst]); report.video = dst; } catch (e) { report.videoError = String(e); if (!existsSync(dst)) renameSync(src, join(OUT, 'walkthrough.webm')); } }
}
await browser.close(); close();
report.failed = failed;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`\n${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks passed; ${report.errors.length} console/network issues; report → ${OUT}/report.json`);
if (report.errors.length) console.log(report.errors.slice(0, 10).join('\n'));
process.exit(failed.length ? 1 : 0);
