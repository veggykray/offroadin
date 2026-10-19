import * as THREE from 'three';
import { FLOOR1_Y, INTERACTABLES, PLATFORMS, type FloorId } from '../config/p2Slice';
import type { Game } from '../sim/Game';
import type { ActorId } from '../sim/Actor';
import { animateAttendant, Characters } from './Characters';
import { buildEnvironment, type Built } from './Environment';
import { Liquids } from './Liquids';
import { Materials, PALETTE } from './Materials';
import { CAM_DIR, CAM_DIST } from './cameraConst';

export type Pick =
  | { kind: 'interactable'; id: string }
  | { kind: 'actor'; id: ActorId }
  | { kind: 'ground'; floor: FloorId; point: { x: number; z: number } }
  | null;

const MIN_TAP_PX = 48;

/**
 * Fixed orthographic isometric view with modest pan/zoom, floor focus, screen-space picking
 * with ≥48 CSS px targets, and the developer plain-geometry toggle (same gameplay state).
 */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly mats = new Materials();
  readonly built: Built;
  readonly liquids: Liquids;
  readonly chars: Characters;
  focusFloor: FloorId = 0;
  viewHeight = 14;
  pan = new THREE.Vector2();
  private target = new THREE.Vector3();
  private sun: THREE.DirectionalLight;
  private plain = false;
  private navDebug: THREE.Object3D[] = [];
  private time = 0;
  frameMs = 0; frameMax = 0; private frameAcc = 0; private frameN = 0; private frameT = 0;
  readonly pixelRatio: number;
  shake = 0;
  /** seconds left of the opening camera glide from the magenta rise back to the party */
  intro = 0;

  constructor(readonly canvas: HTMLCanvasElement, readonly game: Game, readonly lowFx = false) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowFx, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.pixelRatio = lowFx ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene.fog = new THREE.Fog(PALETTE.fog, 72, 130);
    this.scene.background = null; // screen-space CSS sky gradient behind the transparent canvas
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    // lights: warm coral key with shadows, violet-blue hemisphere fill for the shadow colour
    this.sun = new THREE.DirectionalLight('#ffc9a6', 2.4);
    this.sun.position.set(-7, 40, 27); this.sun.target.position.set(0, 2, 0); this.scene.add(this.sun, this.sun.target);
    this.sun.castShadow = true; const sc = this.sun.shadow.camera; sc.left = -32; sc.right = 32; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 110;
    this.sun.shadow.mapSize.set(lowFx ? 1024 : 2048, lowFx ? 1024 : 2048); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    const hemi = new THREE.HemisphereLight('#ffb6cc', '#4e3ca6', 1.7); this.scene.add(hemi);
    const rim = new THREE.DirectionalLight('#9fb4ff', 0.9); rim.position.set(26, 12, -18);
    const fillE = new THREE.DirectionalLight('#ffd2c0', 1.15); fillE.position.set(30, 18, 8); this.scene.add(fillE); this.scene.add(rim);
    this.built = buildEnvironment(this.mats);
    this.scene.add(this.built.floor0, this.built.floor1, this.built.shaft, this.built.distant);
    this.liquids = new Liquids(this.mats, this.built); this.scene.add(this.liquids.group);
    this.chars = new Characters(this.mats); this.scene.add(this.chars.group);
    this.buildNavDebug();
    if (lowFx) { for (const l of this.built.props.lanternLights) l.intensity = 0; for (const d of this.liquids.decor) if ((d as THREE.Points).isPoints) d.visible = false; }
    const a = game.current; this.target.set(a.x, 0.5, a.z);
    this.setFocusFloor(0);
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.updateFrustum();
  }
  private updateFrustum(): void {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const vh = this.viewHeight, vw = vh * (w / h);
    this.camera.left = -vw / 2; this.camera.right = vw / 2; this.camera.top = vh / 2; this.camera.bottom = -vh / 2; this.camera.updateProjectionMatrix();
  }
  zoomBy(factor: number): void { this.viewHeight = Math.min(26, Math.max(7, this.viewHeight / factor)); this.updateFrustum(); }
  /** Pan by a screen delta (CSS px) → world units along the screen axes. */
  panBy(dxPx: number, dyPx: number): void {
    const h = this.canvas.clientHeight || window.innerHeight; const unitsPerPx = this.viewHeight / h;
    const right = new THREE.Vector3(), up = new THREE.Vector3(); this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    // Project screen axes onto the ground plane so panning stays on the floor.
    const gx = new THREE.Vector2(right.x, right.z).normalize(); const gy = new THREE.Vector2(up.x, up.z).normalize();
    const d = new THREE.Vector2().addScaledVector(gx, -dxPx * unitsPerPx).addScaledVector(gy, dyPx * unitsPerPx / Math.max(0.3, Math.hypot(up.x, up.z)));
    this.pan.add(d); const lim = 16; this.pan.x = Math.max(-lim, Math.min(lim, this.pan.x)); this.pan.y = Math.max(-lim, Math.min(lim, this.pan.y));
  }
  resetPan(): void { this.pan.set(0, 0); }
  startIntro(): void { this.intro = 3.2; this.target.set(11, 0.6, 0); }

  setFocusFloor(f: FloorId): void { this.focusFloor = f; this.built.floor1.visible = f === 1; }

  update(dt: number): void {
    this.time += dt;
    const g = this.game; const a = g.current;
    // floor focus follows the selected animal (during a ride, switch at the midpoint)
    // keep the riders visible for the whole ascent: floor 1 appears only as the float docks
    const f: FloorId = a.motion === 'ride' ? (g.lift.level > 0.94 ? 1 : 0) : a.floor;
    if (f !== this.focusFloor) this.setFocusFloor(f);
    // camera follow with smoothing + pan offset
    const ty = a.y + (a.floor === 1 ? FLOOR1_Y : 0) + 0.6;
    const want = new THREE.Vector3(a.x + this.pan.x, ty, a.z + this.pan.y);
    if (this.intro > 0) { this.intro -= dt; const k = Math.max(0, Math.min(1, 1 - this.intro / 3.2)); const e = k * k * (3 - 2 * k); want.set(11 + (a.x - 11) * e, 0.6, 0 + (a.z - 0) * e); this.target.lerp(want, Math.min(1, dt * 10)); }
    else this.target.lerp(want, Math.min(1, dt * 6));
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const s = this.shake * 0.08; this.target.x += (Math.random() - 0.5) * s; this.target.z += (Math.random() - 0.5) * s; }
    this.camera.position.copy(this.target).addScaledVector(CAM_DIR, CAM_DIST);
    this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
    // props driven by sim state
    const P = this.built.props; const c = g.cyan; const L = g.lift;
    const vaneTarget = c.diverter === 'bridge' ? Math.PI / 2 : Math.PI; // vane points down the live branch (south = spill, east = bridge)
    P.cvVane.rotation.y += (vaneTarget - P.cvVane.rotation.y) * Math.min(1, dt * 5);
    P.reedPlug.visible = !c.seepOpen || P.reedPlug.position.y > -1.5;
    if (c.seepOpen) { P.reedPlug.position.y = Math.max(-1.6, P.reedPlug.position.y - dt * 1.4); P.reedPlug.rotation.z += dt * 0.8; P.reedPlug.position.z += dt * 0.5; }
    else { P.reedPlug.position.set(-8, 0, -5.1); P.reedPlug.rotation.z = 0; }
    for (const d of P.droplets) (d.material as THREE.MeshBasicMaterial).opacity = c.seepOpen ? 0.2 : 0.5 + 0.3 * Math.sin(this.time * 3 + d.position.x);
    const lit = L.strength === 'weak' ? 1 : 3; const pulse = 0.75 + 0.25 * Math.sin(this.time * (L.busy ? 9 : 3));
    for (const bands of [P.bands0, P.bands1]) bands.forEach((b, i) => { const on = i < lit; (b.material as THREE.MeshBasicMaterial).color.set(on ? PALETTE.magenta : '#5a3458').multiplyScalar(on ? pulse : 1); });
    P.mrWheel.rotation.y += ((L.strength === 'strong' ? Math.PI * 0.75 : 0) - P.mrWheel.rotation.y) * Math.min(1, dt * 4);
    P.float.position.y = L.level * FLOOR1_Y + (L.busy ? Math.sin(this.time * 22) * 0.012 * (L.strength === 'weak' ? 1.6 : 1) : 0);
    P.slats.visible = c.bridgeSafe; if (c.bridgeSafe) P.slats.position.y += (-0.03 - P.slats.position.y) * Math.min(1, dt * 3); else P.slats.position.y = -1.2;
    animateAttendant(P.attendantArm, P.attendant, this.time);
    if (L.busy) this.shake = Math.max(this.shake, 0.05);
    this.liquids.update(g, dt);
    this.chars.update(g, dt);
  }

  render(): void {
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    const ms = performance.now() - t0;
    this.frameAcc += ms; this.frameN++; this.frameMax = Math.max(this.frameMax, ms);
    if (performance.now() - this.frameT > 1000) { this.frameMs = this.frameAcc / Math.max(1, this.frameN); this.frameAcc = 0; this.frameN = 0; this.frameT = performance.now(); }
  }
  stats(): { drawCalls: number; triangles: number; frameMs: number; frameMax: number; textures: number; geometries: number } {
    const r = this.renderer.info; const out = { drawCalls: r.render.calls, triangles: r.render.triangles, frameMs: +this.frameMs.toFixed(2), frameMax: +this.frameMax.toFixed(2), textures: r.memory.textures, geometries: r.memory.geometries };
    this.frameMax = 0; return out;
  }

  /** World → CSS pixel position on the canvas. */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
  }
  actorScreen(id: ActorId): { x: number; y: number } { const a = this.game.actor(id); return this.project(a.x, a.y + (a.floor === 1 ? FLOOR1_Y : 0) + 0.5, a.z); }
  interactableScreen(id: string): { x: number; y: number } { const d = INTERACTABLES[id]; return this.project(d.pos.x, (d.floor === 1 ? FLOOR1_Y : 0) + 0.8, d.pos.z); }

  /** Screen-space first (≥48 px targets, nearest wins), then ground on visible floors. */
  pick(px: number, py: number): Pick {
    const h = this.canvas.clientHeight; const pxPerUnit = h / this.viewHeight;
    const floorVisible = (f: FloorId): boolean => f === 0 || this.built.floor1.visible;
    let best: { d: number; pick: Pick } | null = null;
    const consider = (sx: number, sy: number, radiusWorld: number, pick: Pick): void => {
      const d = Math.hypot(sx - px, sy - py); const thr = Math.max(MIN_TAP_PX, radiusWorld * pxPerUnit);
      if (d <= thr && (!best || d < best.d)) best = { d, pick };
    };
    for (const def of Object.values(INTERACTABLES)) {
      if (!floorVisible(def.floor)) continue;
      if (def.floor !== this.focusFloor && def.floor === 0 && this.built.floor1.visible) { /* lower floor under the upper: still pickable if not covered */ }
      const s = this.interactableScreen(def.id); consider(s.x, s.y, def.pickRadius, { kind: 'interactable', id: def.id });
    }
    for (const id of ['dog', 'cat', 'white'] as const) { const a = this.game.actor(id); if (!floorVisible(a.floor)) continue; const s = this.actorScreen(id); consider(s.x, s.y, id === 'dog' ? 1.0 : 0.55, { kind: 'actor', id }); }
    if (best) return (best as { d: number; pick: Pick }).pick;
    // ground: nearest floor plane hit that lies on a platform of that floor
    const ndc = new THREE.Vector2((px / this.canvas.clientWidth) * 2 - 1, -(py / h) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const floors: FloorId[] = this.built.floor1.visible ? [1, 0] : [0];
    for (const f of floors) {
      const hit = ray.intersectObject(this.built.ground[f], false)[0]; if (!hit) continue;
      const p = { x: hit.point.x, z: hit.point.z };
      if (PLATFORMS.some((pl) => pl.floor === f && p.x >= pl.rect.x0 - 0.3 && p.x <= pl.rect.x1 + 0.3 && p.z >= pl.rect.z0 - 0.3 && p.z <= pl.rect.z1 + 0.3)) return { kind: 'ground', floor: f, point: p };
      if (f === 0) return { kind: 'ground', floor: 0, point: p };
    }
    return null;
  }

  // ---------------------------------------------------------------- developer plain-geometry view
  private buildNavDebug(): void {
    for (const f of [0, 1] as FloorId[]) {
      const cells = this.game.nav[f].debugCells(); const pos = new Float32Array(cells.length * 3); const col = new Float32Array(cells.length * 3);
      cells.forEach((c, i) => { pos[i * 3] = c.p.x; pos[i * 3 + 1] = (f ? FLOOR1_Y : 0) + 0.06; pos[i * 3 + 2] = c.p.z; const k = Math.min(1, c.clearance / 0.8); col[i * 3] = 1 - k; col[i * 3 + 1] = k; col[i * 3 + 2] = 0.2; });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true })); pts.visible = false; pts.name = 'navdebug' + f;
      (f ? this.built.floor1 : this.built.floor0).add(pts); this.navDebug.push(pts);
    }
    for (const p of this.built.pickers) { const w = new THREE.Mesh(p.mesh.geometry, new THREE.MeshBasicMaterial({ color: '#ff4040', wireframe: true })); w.position.copy(p.mesh.position); w.visible = false; w.userData.noSwap = true; p.mesh.parent!.add(w); this.navDebug.push(w); }
  }
  get isPlain(): boolean { return this.plain; }
  setPlain(on: boolean): void {
    this.plain = on;
    const swap = (root: THREE.Object3D): void => root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || m.userData.noSwap) return;
      const mat = m.material as THREE.Material;
      if (on) { if (mat.visible !== false && (mat instanceof THREE.MeshToonMaterial || mat instanceof THREE.MeshBasicMaterial)) { m.userData.origMat = mat; const isFloor = (mat as THREE.MeshToonMaterial).map === this.mats.paving.map; m.material = isFloor ? this.mats.plainFloor : this.mats.plain; } }
      else if (m.userData.origMat) { m.material = m.userData.origMat; delete m.userData.origMat; }
    });
    for (const r of [this.built.floor0, this.built.floor1, this.built.shaft, this.chars.group]) swap(r);
    for (const d of [...this.built.decor, ...this.liquids.decor]) d.visible = !on;
    for (const d of this.navDebug) d.visible = on;
    this.built.distant.visible = !on; document.body.classList.toggle('plain', on);
    this.scene.background = on ? new THREE.Color('#2c2c38') : null;
    this.scene.fog = on ? null : new THREE.Fog(PALETTE.fog, 72, 130);
    for (const p of this.built.pickers) (p.mesh.material as THREE.MeshBasicMaterial).visible = false;
  }
}
