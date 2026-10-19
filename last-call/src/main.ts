import { Game } from './game/game';
import { LEVEL_W, LEVEL_H } from './world/level';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { Hud, type HudAction } from './render/hud';
import { Intro } from './render/intro';
import { Audio } from './render/audio';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1234) || 1234;
const skipIntro = params.get('intro') === '0' || params.get('skipIntro') === '1';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const game = new Game({ seed, skipIntro });
const cam = new Camera(LEVEL_W, LEVEL_H);
const renderer = new Renderer(canvas);
const hud = new Hud();
const intro = new Intro();
const audio = new Audio();

const state = {
  debug: params.get('debug') === '1', help: false,
  shake: localStorage.getItem('lc.shake') !== '0', muted: localStorage.getItem('lc.muted') === '1',
  fps: 60, mouse: { x: 0, y: 0 }, mouseWorld: null as { x: number; y: number } | null,
  panning: false, panLast: { x: 0, y: 0 }, manualCamUntil: 0, restartArmedUntil: 0,
  lastShots: 0, lastExplosions: 0, lastDamage: 0,
};
game.settings.shake = state.shake; audio.muted = state.muted;

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr); canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
  cam.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize); resize();
cam.fitAll(); cam.x = cam.targetX; cam.y = cam.targetY; cam.zoom = cam.targetZoom;

// ---- intro ---------------------------------------------------------------------------------
intro.onDone = () => { game.startBattle(); cam.fitAll(); document.body.classList.remove('intro'); };
if (game.phase === 'intro') { intro.start(); document.body.classList.add('intro'); }

// ---- HUD actions ---------------------------------------------------------------------------
function doAction(a: HudAction, arg?: number): void {
  switch (a) {
    case 'select': if (arg !== undefined) game.selectHero(arg); break;
    case 'basic': game.setMode(game.mode === 'basic' ? 'none' : 'basic'); break;
    case 'signature': game.setMode(game.mode === 'signature' ? 'none' : 'signature'); break;
    case 'cancel': game.cancel(); break;
    case 'endTurn': if (!game.endSquadTurn()) game.log('Wait for everything to settle before ending the turn.', 'warn'); break;
    case 'restart': restart(); break;
    case 'help': state.help = !state.help; break;
    case 'debug': state.debug = !state.debug; break;
    case 'shake': state.shake = !state.shake; game.settings.shake = state.shake; localStorage.setItem('lc.shake', state.shake ? '1' : '0'); break;
    case 'mute': state.muted = !state.muted; audio.muted = state.muted; localStorage.setItem('lc.muted', state.muted ? '1' : '0'); break;
    case 'overview': cam.fitAll(); state.manualCamUntil = performance.now() + 1e9; break;
    case 'center': { const u = game.selected; if (u) { cam.focusOn(u.body.x, u.body.y + 6, cam.fitZoom * 2); state.manualCamUntil = 0; } break; }
  }
}
hud.onAction = doAction;
function restart(): void {
  if (game.phase === 'victory' || game.phase === 'defeat' || performance.now() < state.restartArmedUntil) {
    if (intro.active) intro.skip();
    game.restart(); state.restartArmedUntil = 0; cam.fitAll();
  } else { state.restartArmedUntil = performance.now() + 2000; game.log('Press R (or Restart) again within 2 seconds to restart the mission.', 'warn'); }
}

// ---- keyboard ------------------------------------------------------------------------------
const held = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (e.repeat && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
  if (intro.active) {
    if (e.code === 'Escape') intro.skip();
    else if (e.code === 'Space' || e.code === 'Enter') intro.advance();
    else if (e.code === 'KeyR') restart();
    e.preventDefault(); return;
  }
  held.add(e.code);
  const aiming = game.mode !== 'none';
  switch (e.code) {
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': game.selectByIndex(Number(e.code.slice(-1)) - 1); break;
    case 'KeyW': case 'Space': game.input.jump = true; break;
    case 'KeyQ': doAction('basic'); break;
    case 'KeyE': doAction('signature'); break;
    case 'Escape': if (state.help) state.help = false; else game.cancel(); break;
    case 'Enter': if (aiming) commit(); break;
    case 'Tab': if (aiming) game.cycleTarget(); e.preventDefault(); break;
    case 'KeyT': doAction('endTurn'); break;
    case 'KeyR': restart(); break;
    case 'KeyH': doAction('help'); break;
    case 'F3': case 'Backquote': doAction('debug'); e.preventDefault(); break;
    case 'KeyK': doAction('shake'); break;
    case 'KeyM': doAction('mute'); break;
    case 'KeyZ': doAction('overview'); break;
    case 'KeyC': doAction('center'); break;
    case 'ArrowUp': if (aiming) game.nudgeAim(game.aim.dir * 0.02, 0); break;
    case 'ArrowDown': if (aiming) game.nudgeAim(-game.aim.dir * 0.02, 0); break;
    case 'ArrowRight': if (aiming) game.nudgeAim(0, 0.02); break;
    case 'ArrowLeft': if (aiming) game.nudgeAim(0, -0.02); break;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

function commit(): void {
  const r = game.confirm();
  if (!r.ok && r.reason) game.log(r.reason, 'warn');
}

// ---- mouse ---------------------------------------------------------------------------------
const dpr = () => canvas.width / window.innerWidth;
canvas.addEventListener('mousemove', (e) => {
  state.mouse = { x: e.clientX * dpr(), y: e.clientY * dpr() };
  if (state.panning) { cam.pan((e.clientX - state.panLast.x) * dpr(), (e.clientY - state.panLast.y) * dpr()); state.panLast = { x: e.clientX, y: e.clientY }; state.manualCamUntil = performance.now() + 4000; }
});
canvas.addEventListener('mousedown', (e) => {
  if (intro.active) { if (e.button === 0) intro.advance(); return; }
  if (e.button === 1 || e.button === 2) { state.panning = true; state.panLast = { x: e.clientX, y: e.clientY }; if (e.button === 2) game.cancel(); e.preventDefault(); return; }
  if (e.button !== 0) return;
  const w = cam.screenToWorld(e.clientX * dpr(), e.clientY * dpr());
  if (game.mode !== 'none') { game.aimAt(w.x, w.y); commit(); return; }
  const u = game.unitAt(w.x, w.y);
  if (u && u.team === 'hero') game.selectHero(u.id);
});
window.addEventListener('mouseup', () => { state.panning = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  cam.zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX * dpr(), e.clientY * dpr());
  state.manualCamUntil = performance.now() + 4000;
  e.preventDefault();
}, { passive: false });
document.getElementById('help')!.addEventListener('click', (e) => { if (e.target === e.currentTarget) state.help = false; });

// ---- loop ----------------------------------------------------------------------------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc >= 0.5) { state.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

  if (intro.active) {
    intro.update(dt);
    intro.render(ctx, cam, game);
    hud.update(game, state);
    requestAnimationFrame(frame); return;
  }
  // movement input (held keys)
  game.input.moveDir = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  // mouse aim
  const mw = cam.screenToWorld(state.mouse.x, state.mouse.y); state.mouseWorld = mw;
  if (game.mode !== 'none') game.aimAt(mw.x, mw.y);
  // camera pan with arrows when not aiming
  if (game.mode === 'none') {
    const px = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0), py = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);
    if (px || py) { cam.pan(-px * 700 * dt, py * 700 * dt); state.manualCamUntil = performance.now() + 4000; }
  }

  game.update(dt);

  // sounds from state deltas
  if (game.stats.shots > state.lastShots) audio.shot();
  if (game.stats.explosions > state.lastExplosions) audio.boom(1);
  if (game.stats.damageDealt > state.lastDamage) audio.hit();
  state.lastShots = game.stats.shots; state.lastExplosions = game.stats.explosions; state.lastDamage = game.stats.damageDealt;

  // camera: at fit zoom everything is visible; when zoomed in, follow focus / selected unit unless the user panned
  if (!cam.isFit && performance.now() > state.manualCamUntil) {
    const f = game.focus ?? (game.selected ? { x: game.selected.body.x, y: game.selected.body.y + 5 } : null);
    if (f) cam.focusOn(f.x, f.y);
  }
  cam.update(dt, game.shake, state.shake, now / 1000);

  renderer.render(game, cam, { debug: state.debug, mouseWorld: state.mouseWorld, time: now / 1000 });
  hud.update(game, state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook (Playwright smoke tests drive the real app through this).
(window as unknown as { __lastCall: unknown }).__lastCall = {
  game, cam, intro, renderer,
  skipIntro: () => intro.skip(),
  commit,
  state,
};
