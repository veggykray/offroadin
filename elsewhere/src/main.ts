import './style.css';
import { Audio } from './audio/Audio';
import { BUILD_ID } from './config/buildInfo';
import { INTERACTABLES } from './config/p2Slice';
import { Pointer } from './input/Pointer';
import { SceneView } from './render/SceneView';
import { Game } from './sim/Game';
import { Hud } from './ui/Hud';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const game = new Game();
const view = new SceneView(canvas, game, params.get('fx') === 'low'); // ?fx=low: low-end graphics option
const audio = new Audio();
const hud = new Hud(document.getElementById('ui')!, params.has('dev'));
view.viewHeight = window.innerHeight < 520 ? 12.5 : 15.5;
view.resize();

// ---------------------------------------------------------------- HUD wiring
hud.onSelect = (id): void => { game.select(id); view.resetPan(); };
hud.onReset = (): void => { game.reset(); view.resetPan(); view.setFocusFloor(0); view.startIntro(); };
hud.onMute = (m): void => audio.setMuted(m);
hud.onPause = (p): void => { paused = p; audio.setPaused(p); };
hud.onStart = (): void => { audio.start(); started = true; view.startIntro(); };
hud.onDev = (): void => { view.setPlain(!view.isPlain); hud.setDevActive(view.isPlain); };
hud.onInteract = (id): void => { game.tapInteractable(id); };
hud.onActor = (id): void => game.tapActor(id);
window.addEventListener('keydown', (e) => { if (e.key === 'g' || e.key === 'G') { hud.showDev(true); hud.onDev(); } });
let paused = false, started = false, bannerTimer = 0;

// ---------------------------------------------------------------- input: tap vs drag vs pinch
new Pointer(canvas, {
  tap: (x, y) => {
    if (!started || paused) return;
    const rect = canvas.getBoundingClientRect(); const p = view.pick(x - rect.left, y - rect.top);
    if (!p) return;
    if (p.kind === 'interactable') game.tapInteractable(p.id);
    else if (p.kind === 'actor') game.tapActor(p.id);
    else game.tapGround(p.floor, p.point);
  },
  drag: (dx, dy) => view.panBy(dx, dy),
  pinch: (f) => view.zoomBy(f),
  wheel: (d) => view.zoomBy(d > 0 ? 0.9 : 1.1),
});
window.addEventListener('resize', () => view.resize());

// ---------------------------------------------------------------- audio hooks
view.chars.dog.onStep = (): void => audio.step(true);
view.chars.cat.onStep = (): void => audio.step(false);
function handleEvents(): void {
  for (const e of game.events) {
    if (e === 'valve') audio.valve();
    else if (e === 'scrape') audio.scrape();
    else if (e === 'cyan:bridgeSolid') audio.bridgeForm();
    else if (e === 'lift:reject') audio.reject();
    else if (e === 'flag:P2_ASCENDED') { audio.chime(true); bannerTimer = window.setTimeout(() => hud.showBanner(), 3200); } // let the relief moment play first
    else if (e === 'reset') { if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = 0; } }
    else if (e.startsWith('flag:')) audio.chime(false);
    else if (e === 'reassured') audio.chime(false);
    else if (e === 'whiteBalk') view.shake = 0.3;
  }
}

// ---------------------------------------------------------------- loop: fixed-step sim, rAF render
const DT = 1 / 60; let acc = 0, last = performance.now(); let frames = 0, fps = 0, fpsT = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  let dt = Math.min(0.5, (now - last) / 1000); last = now; frames++;
  if (now - fpsT > 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; }
  if (paused) dt = 0;
  acc += dt;
  let steps = 0;
  while (acc >= DT && steps < 32) { game.update(DT); handleEvents(); acc -= DT; steps++; }
  if (acc > DT) acc = 0; // never let a stall (tab hidden, slow GPU) bank sim time
  const c = game.cyan; const flow = Math.max(c.feed, c.spill, c.branch, c.conduit) * (c.seepOpen ? 1 : 0);
  audio.update(flow, game.lift.intensity, game.lift.busy, dt);
  view.update(dt);
  hud.update(game, view, dt);
  view.render();
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- test/debug handle (reads state and screen positions; never awards progress)
declare global { interface Window { __elsewhere: unknown } }
window.__elsewhere = {
  build: BUILD_ID,
  game, view, hud, interactables: INTERACTABLES,
  snapshot: () => game.snapshot(),
  stats: () => ({ ...view.stats(), fps: +fps.toFixed(1), lowFx: view.lowFx, viewHeight: view.viewHeight, pixelRatio: view.pixelRatio, canvas: [canvas.width, canvas.height] }),
  screenOf: (kind: 'actor' | 'interactable' | 'world', id: string | [number, number, number]) => {
    const r = canvas.getBoundingClientRect();
    const p = kind === 'actor' ? view.actorScreen(id as 'dog') : kind === 'interactable' ? view.interactableScreen(id as string) : view.project(...(id as [number, number, number]));
    return { x: p.x + r.left, y: p.y + r.top };
  },
  setPlain: (on: boolean) => view.setPlain(on),
};
console.info(`[elsewhere] ${BUILD_ID} ready`);
