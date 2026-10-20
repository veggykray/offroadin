import * as THREE from 'three';
import type { Game, LiveProjectile } from '../game/game';
import { LEVEL_W, LEVEL_H } from '../world/level';
import { TerrainPainter } from './TerrainPainter';
import { Backdrop } from './Backdrop';
import { Props } from './Props';
import { Particles } from './Particles';
import { Overlays } from './Overlays';
import { Rig, disposeRigTextures, type RigState } from './Rig';
import { RIGS } from '../art/characters';
import { makeCanvas, ctx2d, rr } from '../art/paint';
import { clamp, lerp } from '../core/math';

const PX = 40;

function spriteTex(paint: (c: CanvasRenderingContext2D, W: number, H: number) => void, w: number, h: number): THREE.CanvasTexture {
  const c = makeCanvas(w * PX, h * PX); paint(ctx2d(c), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Three.js side-view renderer: orthographic camera over a flat gameplay plane with layered parallax. */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly world = new THREE.Group();
  // camera state (world units; zoom = px per unit)
  x = LEVEL_W / 2; y = LEVEL_H / 2; zoom = 10; targetX = this.x; targetY = this.y; targetZoom = 10; fitZoom = 10;
  vw = 1280; vh = 720; shakeX = 0; shakeY = 0;
  readonly levelW = LEVEL_W; readonly levelH = LEVEL_H;

  terrain: TerrainPainter; backdrop: Backdrop; props: Props; particles: Particles; overlays: Overlays;
  private rigs = new Map<number, Rig>();
  private jackal: Rig;
  private projMeshes: THREE.Mesh[] = [];
  private projTex: Record<string, THREE.CanvasTexture> = {};
  private spearMesh: THREE.Mesh;
  private smokeT = 0;

  constructor(readonly canvas: HTMLCanvasElement, game: Game) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x3f78c8, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    this.camera.position.z = 100;
    this.scene.add(this.world);
    this.terrain = new TerrainPainter(game.terrain); this.world.add(this.terrain.mesh);
    this.backdrop = new Backdrop(LEVEL_W, LEVEL_H); this.world.add(this.backdrop.group);
    this.props = new Props(game.level); this.world.add(this.props.group);
    this.particles = new Particles(); this.world.add(this.particles.group);
    this.overlays = new Overlays(); this.world.add(this.overlays.group);
    this.jackal = new Rig(RIGS.jackal); this.world.add(this.jackal.group);
    this.spearMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: spriteTex(paintSpearFlat, 2.6, 0.5), transparent: true, depthWrite: false }));
    this.spearMesh.renderOrder = 40; this.world.add(this.spearMesh);
    this.projTex = {
      shell: spriteTex(paintShell, 0.8, 0.8), stone: spriteTex(paintStone, 0.5, 0.5), bullet: spriteTex(paintBullet, 1.2, 0.2),
      hatchet: spriteTex(paintHatchetFlat, 1.0, 0.8), arrow: spriteTex(paintArrow, 1.4, 0.3), gadget: spriteTex(paintBolt, 0.9, 0.9),
    };
  }

  /** (Re)bind to a game instance after restart: terrain texture and rigs are rebuilt. */
  rebind(game: Game): void {
    this.world.remove(this.terrain.mesh); this.terrain.dispose();
    this.terrain = new TerrainPainter(game.terrain); this.world.add(this.terrain.mesh);
    for (const r of this.rigs.values()) { this.world.remove(r.group); r.dispose(); }
    this.rigs.clear();
    this.world.remove(this.props.group); this.props.dispose(); this.props = new Props(game.level); this.world.add(this.props.group);
  }

  // ---- camera ----------------------------------------------------------------------------
  resize(vw: number, vh: number): void {
    const wasFit = this.isFit;
    this.vw = vw; this.vh = vh;
    this.renderer.setSize(vw, vh, false);
    this.fitZoom = Math.min(vw / this.levelW, vh / this.levelH);
    if (wasFit) { this.targetZoom = this.fitZoom; this.zoom = this.fitZoom; }
    this.clampTarget();
  }
  get isFit(): boolean { return Math.abs(this.targetZoom - this.fitZoom) < 1e-6; }
  get maxZoom(): number { return this.fitZoom * 4; }
  fitAll(): void { this.targetZoom = this.fitZoom; this.targetX = this.levelW / 2; this.targetY = this.levelH / 2; }
  focusOn(wx: number, wy: number, zoom?: number): void { if (zoom !== undefined) this.targetZoom = clamp(zoom, this.fitZoom, this.maxZoom); this.targetX = wx; this.targetY = wy; this.clampTarget(); }
  pan(dxScreen: number, dyScreen: number): void { this.targetX -= dxScreen / this.targetZoom; this.targetY += dyScreen / this.targetZoom; this.clampTarget(); this.x = this.targetX; this.y = this.targetY; }
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.targetZoom = clamp(this.targetZoom * factor, this.fitZoom, this.maxZoom); this.zoom = this.targetZoom;
    const after = this.screenToWorld(sx, sy);
    this.targetX += before.x - after.x; this.targetY += before.y - after.y; this.clampTarget(); this.x = this.targetX; this.y = this.targetY;
  }
  private clampTarget(): void {
    const hw = this.vw / (2 * this.targetZoom), hh = this.vh / (2 * this.targetZoom);
    this.targetX = hw * 2 >= this.levelW ? this.levelW / 2 : clamp(this.targetX, hw, this.levelW - hw);
    this.targetY = hh * 2 >= this.levelH ? this.levelH / 2 : clamp(this.targetY, hh, this.levelH - hh);
  }
  worldToScreen(wx: number, wy: number): { x: number; y: number } { return { x: (wx - this.x - this.shakeX) * this.zoom + this.vw / 2, y: this.vh / 2 - (wy - this.y - this.shakeY) * this.zoom }; }
  screenToWorld(sx: number, sy: number): { x: number; y: number } { return { x: (sx - this.vw / 2) / this.zoom + this.x + this.shakeX, y: (this.vh / 2 - sy) / this.zoom + this.y + this.shakeY }; }

  updateCamera(dt: number, shake: number, shakeEnabled: boolean, t: number): void {
    const k = 1 - Math.exp(-7 * dt);
    this.x = lerp(this.x, this.targetX, k); this.y = lerp(this.y, this.targetY, k); this.zoom = lerp(this.zoom, this.targetZoom, k);
    const amp = shakeEnabled ? shake * 0.35 : 0;
    this.shakeX = Math.sin(t * 61) * amp; this.shakeY = Math.cos(t * 47) * amp;
    const hw = this.vw / (2 * this.zoom), hh = this.vh / (2 * this.zoom);
    this.camera.left = -hw; this.camera.right = hw; this.camera.top = hh; this.camera.bottom = -hh;
    this.camera.position.x = this.x + this.shakeX; this.camera.position.y = this.y + this.shakeY;
    this.camera.updateProjectionMatrix();
  }

  // ---- per frame ------------------------------------------------------------------------
  render(g: Game, dt: number, time: number): void {
    this.terrain.sync();
    this.backdrop.update(this.x, this.y);
    this.props.update(time, g.barrels);
    const groundAt = (wx: number) => g.terrain.surfaceBelow(wx, (g.hero('inventor')?.body.y ?? 0) + 1.6, 3.5) ?? (g.hero('inventor')?.body.y ?? 0);
    for (const u of g.units) {
      let rig = this.rigs.get(u.id);
      if (!rig) { rig = new Rig(RIGS[u.kind]); this.world.add(rig.group); this.rigs.set(u.id, rig); }
      const aiming = g.selectedId === u.id && g.mode !== 'none' && g.phase === 'player' && g.ability(u, g.mode)?.mode === 'aim';
      const abId = aiming ? (g.mode === 'basic' ? u.def.basic : u.def.signature) : '';
      const st: RigState = {
        kind: u.kind, facing: u.facing, walkPhase: u.anim.walkPhase, moving: Math.abs(u.body.x - (rig as unknown as { lastX?: number }).lastX!) > 1e-4 || Math.abs(u.body.vx) > 0.1,
        grounded: u.body.grounded, swing: u.anim.swing, swingDur: 0.4, aimAngle: aiming ? g.aim.angle : null,
        aimArm: abId === 'pistol' || abId === 'sling' ? 'back' : 'front', hitFlash: u.anim.hitFlash, alive: u.alive, time,
        groundAt, x: u.body.x, y: u.body.y, spearHeld: g.spear.state === 'held',
      };
      (rig as unknown as { lastX: number }).lastX = u.body.x;
      rig.group.position.z = u.team === 'enemy' ? 0.9 : 1.0 + (g.selectedId === u.id ? 0.3 : 0);
      rig.update(st, dt);
    }
    // jackal
    const j = g.jackal;
    const jlast = (this.jackal as unknown as { lastX?: number }).lastX ?? j.body.x;
    this.jackal.update({ kind: 'jackal', facing: j.facing, walkPhase: j.body.x * 4, moving: Math.abs(j.body.x - jlast) > 1e-4, grounded: j.body.grounded, swing: 0, swingDur: 0, aimAngle: null, aimArm: 'front', hitFlash: 0, alive: true, time, x: j.body.x, y: j.body.y, running: j.state === 'running' }, dt);
    (this.jackal as unknown as { lastX: number }).lastX = j.body.x;
    this.jackal.group.position.z = 0.8;
    // spear in the world
    const sp = g.spear;
    this.spearMesh.visible = sp.state !== 'held';
    if (sp.state !== 'held') { this.spearMesh.position.set(sp.body.x, sp.body.y + 0.3, 1.2); this.spearMesh.rotation.z = sp.state === 'flying' ? sp.angle : -1.15; }
    // projectiles
    this.syncProjectiles(g.projectiles);
    // inventor's machine puffs steam
    const inv = g.hero('inventor');
    if (inv && inv.alive) { this.smokeT += dt; if (this.smokeT > 0.5) { this.smokeT = 0; g.addFx({ kind: 'smoke', x: inv.body.x - inv.facing * 0.85, y: inv.body.y + 2.3, vx: -inv.facing * 0.4, vy: 1.4, life: 1.6, max: 1.6, color: '#d8d4cc', size: 0.5 }); } }
    this.particles.sync(g.fx, time);
    this.overlays.sync(g, time, this.zoom);
    this.renderer.render(this.scene, this.camera);
  }

  private syncProjectiles(list: LiveProjectile[]): void {
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      let m = this.projMeshes[i];
      if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); m.renderOrder = 45; this.world.add(m); this.projMeshes.push(m); }
      const kind = p.spec.kind === 'spear' ? 'spear' : p.spec.kind;
      const mat = m.material as THREE.MeshBasicMaterial;
      if (kind === 'spear') { m.visible = false; continue; }
      const tex = this.projTex[kind]; mat.map = tex; mat.needsUpdate = true;
      const size: Record<string, [number, number]> = { shell: [0.8, 0.8], stone: [0.5, 0.5], bullet: [1.2, 0.2], hatchet: [1.0, 0.8], arrow: [1.4, 0.3], gadget: [0.9, 0.9] };
      const [w, h] = size[kind] ?? [0.6, 0.6];
      m.scale.set(w, h, 1); m.position.set(p.x, p.y, 2.0); m.rotation.z = kind === 'hatchet' ? p.t * 18 : p.angle; m.visible = true;
    }
    for (let i = list.length; i < this.projMeshes.length; i++) this.projMeshes[i].visible = false;
  }

  dispose(): void {
    this.terrain.dispose(); this.backdrop.dispose(); this.props.dispose(); this.particles.dispose(); this.overlays.dispose();
    for (const r of this.rigs.values()) r.dispose(); this.jackal.dispose(); disposeRigTextures();
    for (const m of this.projMeshes) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    for (const t of Object.values(this.projTex)) t.dispose();
    this.renderer.dispose();
  }
}

// ---- projectile sprites -----------------------------------------------------------------------
type C = CanvasRenderingContext2D;
const OUT = '#1c1410';
function paintShell(c: C, W: number, H: number): void { const g = c.createRadialGradient(W * 0.4, H * 0.4, 2, W / 2, H / 2, W / 2); g.addColorStop(0, '#6a6e76'); g.addColorStop(1, '#15161a'); c.fillStyle = g; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 3, 0, Math.PI * 2); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#ff9a3c'; c.beginPath(); c.arc(W * 0.2, H / 2, 4, 0, Math.PI * 2); c.fill(); }
function paintStone(c: C, W: number, H: number): void { c.fillStyle = '#8a8f96'; c.beginPath(); c.moveTo(W * 0.2, H * 0.3); c.lineTo(W * 0.7, H * 0.15); c.lineTo(W * 0.9, H * 0.6); c.lineTo(W * 0.5, H * 0.9); c.lineTo(W * 0.15, H * 0.7); c.closePath(); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); }
function paintBullet(c: C, W: number, H: number): void { const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.7, 'rgba(255,240,180,0.8)'); g.addColorStop(1, '#fff'); c.fillStyle = g; rr(c, 0, H * 0.2, W, H * 0.6, H * 0.3); c.fill(); }
function paintHatchetFlat(c: C, W: number, H: number): void { c.fillStyle = '#6b4a2a'; rr(c, 0, H * 0.42, W * 0.7, H * 0.16, 4); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#c9ccd2'; c.beginPath(); c.moveTo(W * 0.6, H * 0.1); c.lineTo(W, H * 0.2); c.lineTo(W, H * 0.8); c.lineTo(W * 0.6, H * 0.9); c.closePath(); c.fill(); c.stroke(); }
function paintArrow(c: C, W: number, H: number): void { c.fillStyle = '#7a5a34'; rr(c, 0, H * 0.38, W * 0.8, H * 0.24, 3); c.fill(); c.fillStyle = '#c8ccd2'; c.beginPath(); c.moveTo(W * 0.78, H * 0.1); c.lineTo(W, H / 2); c.lineTo(W * 0.78, H * 0.9); c.closePath(); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#e6dcc4'; c.beginPath(); c.moveTo(0, H * 0.1); c.lineTo(W * 0.2, H / 2); c.lineTo(0, H * 0.9); c.closePath(); c.fill(); }
function paintBolt(c: C, W: number, H: number): void { const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#c9a7ff'); g.addColorStop(1, 'rgba(120,80,200,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
function paintSpearFlat(c: C, W: number, H: number): void { c.fillStyle = '#7a5a34'; rr(c, 0, H * 0.35, W * 0.82, H * 0.3, 4); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#c8ccd2'; c.beginPath(); c.moveTo(W * 0.8, H * 0.05); c.lineTo(W, H / 2); c.lineTo(W * 0.8, H * 0.95); c.lineTo(W * 0.72, H / 2); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#b8503a'; c.fillRect(W * 0.68, H * 0.2, W * 0.04, H * 0.6); }
