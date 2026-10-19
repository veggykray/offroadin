import { BUILD_DATE, BUILD_ID, BUILD_NAME } from '../config/buildInfo';
import { INTERACTABLES } from '../config/p2Slice';
import type { Game, Selectable } from '../sim/Game';
import type { SceneView } from '../render/SceneView';
import { dist } from '../sim/vec';

const DOG_SVG = `<svg viewBox="0 0 64 64"><path fill="#1b1922" d="M14 30c0-10 7-16 18-16s18 6 18 16c0 4-1 7-3 10l2 10c0 3-3 5-6 4l-3-5c-3 2-5 2-8 2s-5 0-8-2l-3 5c-3 1-6-1-6-4l2-10c-2-3-3-6-3-10z"/><path fill="#2d2a36" d="M10 26c-4 2-6 9-4 16 1 3 4 4 6 2 2-5 2-12-2-18zm44 0c4 2 6 9 4 16-1 3-4 4-6 2-2-5-2-12 2-18z"/><circle cx="25" cy="31" r="2.4" fill="#d9c2a8"/><circle cx="39" cy="31" r="2.4" fill="#d9c2a8"/><ellipse cx="32" cy="41" rx="5" ry="3.2" fill="#0a0810"/></svg>`;
const CAT_SVG = `<svg viewBox="0 0 64 64"><path fill="#1b1922" d="M12 14l10 9c3-2 6-3 10-3s7 1 10 3l10-9v18c0 11-9 18-20 18S12 43 12 32z"/><path fill="#f2eee8" d="M32 36c6 0 11 4 11 8s-5 8-11 8-11-4-11-8 5-8 11-8z"/><circle cx="24" cy="31" r="2.8" fill="#9ee36b"/><circle cx="40" cy="31" r="2.8" fill="#9ee36b"/><ellipse cx="32" cy="38" rx="2.2" ry="1.5" fill="#d27a8a"/></svg>`;

const LABELS: Record<string, (g: Game) => string> = {
  seep: (g) => (g.cyan.seepOpen ? 'Seep (open)' : 'Scrape reeds'),
  'CV-01': (g) => `CV-01 · ${g.cyan.diverter === 'spill' ? 'send to receiver' : 'send to spill'}`,
  liftBase: (g) => (g.lift.dockedFloor === 0 ? 'Board lift' : 'Call lift'),
  liftTop: (g) => (g.lift.dockedFloor === 1 ? 'Board lift' : 'Call lift'),
  indicator: () => 'Inspect load indicator',
  'MR-01': (g) => (g.lift.strength === 'weak' ? 'MR-01 · raise pressure' : 'MR-01 (full)'),
};

/** Minimal DOM HUD: start/about, portraits, floor indicator, reset/mute/pause, hint, context labels.
 *  Context labels are purely visual (pointer-events: none) so they never overlap the world tap targets. */
export class Hud {
  readonly root: HTMLElement;
  private portraits: Record<Selectable, HTMLButtonElement>;
  private floorEl: HTMLElement; private hintEl: HTMLElement; private labelsEl: HTMLElement; private bannerEl: HTMLElement; private flagsEl: HTMLElement;
  private labels = new Map<string, HTMLButtonElement>();
  private hintShown = ''; private hintT = 0;
  onSelect: (id: Selectable) => void = () => {};
  onReset: () => void = () => {};
  onMute: (m: boolean) => void = () => {};
  onPause: (p: boolean) => void = () => {};
  onStart: () => void = () => {};
  onDev: () => void = () => {};
  onInteract: (id: string) => void = () => {};
  onActor: (id: 'white') => void = () => {};
  muted = false; paused = false;

  constructor(parent: HTMLElement, devVisible: boolean) {
    this.root = document.createElement('div'); this.root.id = 'hud'; parent.appendChild(this.root);
    this.root.innerHTML = `
      <div id="start" class="overlay">
        <div class="panel">
          <h1>${BUILD_NAME}</h1>
          <p class="sub">Chapter One · P2 “The First Rise” · isolated test scene</p>
          <p class="about">Refuge Sluice (0B) → Root Elevator (0D) → Reed Quay arrival terrace (1A).<br>
          Tap the ground to walk. Tap things to use them. Portraits switch between the dog and the cat. Drag to pan, pinch or wheel to zoom.</p>
          <p class="about small">Test-only start: after P1’s rescue, White already trusts the dog. Other floors are not built.</p>
          <button id="play" class="big">Play</button>
          <p class="build">Build ${BUILD_ID} · ${BUILD_DATE}</p>
        </div>
      </div>
      <div id="portrait-warn" class="overlay hidden"><div class="panel"><p>Rotate to landscape to play.<br>Your progress is kept.</p></div></div>
      <div id="top-left"><div id="floor" class="pill">F0</div></div>
      <div id="top-right">
        <button id="reset" class="icon" title="Reset scene" aria-label="Reset">↺</button>
        <button id="mute" class="icon" title="Mute" aria-label="Mute">🔊</button>
        <button id="pause" class="icon" title="Pause" aria-label="Pause">❚❚</button>
        <button id="dev" class="icon ${devVisible ? '' : 'hidden'}" title="Plain geometry (dev)" aria-label="Plain geometry">▦</button>
      </div>
      <div id="portraits">
        <button id="p-dog" class="portrait" aria-label="Select the dog">${DOG_SVG}<span>Dog</span></button>
        <button id="p-cat" class="portrait" aria-label="Select the cat">${CAT_SVG}<span>Cat</span></button>
      </div>
      <div id="labels"></div>
      <div id="hint" class="hidden"></div>
      <div id="flags"></div>
      <div id="banner" class="hidden"><div class="panel"><h2>The First Rise</h2><p>All three together on Reed Quay. <b>P2_ASCENDED</b></p><p class="small">Keep exploring the terrace, or replay from the start.</p><button id="replay" class="big">Replay</button><button id="continue" class="plainbtn">Keep exploring</button></div></div>`;
    const q = <T extends HTMLElement>(s: string): T => this.root.querySelector(s) as T;
    this.portraits = { dog: q('#p-dog'), cat: q('#p-cat') };
    this.floorEl = q('#floor'); this.hintEl = q('#hint'); this.labelsEl = q('#labels'); this.bannerEl = q('#banner'); this.flagsEl = q('#flags');
    this.portraits.dog.onclick = (): void => this.onSelect('dog'); this.portraits.cat.onclick = (): void => this.onSelect('cat');
    q('#reset').onclick = (): void => { this.bannerEl.classList.add('hidden'); this.onReset(); };
    q('#replay').onclick = (): void => { this.bannerEl.classList.add('hidden'); this.onReset(); };
    q('#continue').onclick = (): void => this.bannerEl.classList.add('hidden');
    q('#mute').onclick = (): void => { this.muted = !this.muted; q('#mute').textContent = this.muted ? '🔇' : '🔊'; this.onMute(this.muted); };
    q('#pause').onclick = (): void => { this.paused = !this.paused; q('#pause').textContent = this.paused ? '▶' : '❚❚'; this.onPause(this.paused); };
    q('#dev').onclick = (): void => this.onDev();
    q('#play').onclick = (): void => { q('#start').classList.add('hidden'); this.onStart(); };
    for (const id of Object.keys(INTERACTABLES)) { const b = document.createElement('button'); b.className = 'label hidden'; b.dataset.id = id; b.onclick = (): void => this.onInteract(id); this.labelsEl.appendChild(b); this.labels.set(id, b); }
    const wb = document.createElement('button'); wb.className = 'label white hidden'; wb.dataset.id = 'white'; wb.onclick = (): void => this.onActor('white'); this.labelsEl.appendChild(wb); this.labels.set('white', wb);
    this.checkOrientation(); window.addEventListener('resize', () => this.checkOrientation());
  }
  private checkOrientation(): void { const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700; this.root.querySelector('#portrait-warn')!.classList.toggle('hidden', !portrait); }
  showDev(v: boolean): void { this.root.querySelector('#dev')!.classList.toggle('hidden', !v); }
  setDevActive(on: boolean): void { this.root.querySelector('#dev')!.classList.toggle('active', on); }
  showBanner(): void { this.bannerEl.classList.remove('hidden'); }

  update(game: Game, view: SceneView, dt: number): void {
    for (const id of ['dog', 'cat'] as const) this.portraits[id].classList.toggle('active', game.selected === id);
    const f = view.focusFloor; this.floorEl.textContent = f === 0 ? 'F0 · Refuge Sluice / Root Elevator' : 'F1 · Reed Quay';
    this.floorEl.dataset.floor = String(f);
    // hint
    const h = game.hint; if (h && h.text !== this.hintShown) { this.hintShown = h.text; this.hintT = 0; this.hintEl.textContent = h.text; this.hintEl.classList.remove('hidden'); }
    if (h) { this.hintT += dt; if (this.hintT > 4.5) this.hintEl.classList.add('hidden'); }
    // contextual labels near the selected animal (only on the focused floor)
    const a = game.current; const near = 5.5;
    for (const [id, btn] of this.labels) {
      if (id === 'white') {
        const w = game.white; const show = game.selected === 'dog' && w.floor === a.floor && w.floor === f && game.whiteBalked && !game.whiteReassured && dist(w.pos, a.pos) < 7 && w.motion !== 'ride';
        btn.classList.toggle('hidden', !show); if (show) { const s = view.actorScreen('white'); btn.style.left = s.x + 'px'; btn.style.top = (s.y - 34) + 'px'; btn.textContent = 'Sit with White'; }
        continue;
      }
      const def = INTERACTABLES[id]; const usable = def.floor === f && def.floor === a.floor && def.actors.includes(game.selected) && dist(def.pos, a.pos) < near && a.motion !== 'ride';
      btn.classList.toggle('hidden', !usable);
      if (usable) { const s = view.interactableScreen(id); btn.style.left = s.x + 'px'; btn.style.top = (s.y - 30) + 'px'; btn.textContent = LABELS[id](game); }
    }
    this.flagsEl.textContent = ['P2_BRIDGE_READY', 'P2_BRIDGE_SAFE', 'P2_LIFT_STRONG', 'P2_ASCENDED'].filter((x) => game.has(x)).join(' · ');
  }
}
