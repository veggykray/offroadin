import * as THREE from 'three';
import { type PartSpec, type RigSpec, PPU } from '../art/characters';
import { makeCanvas, ctx2d } from '../art/paint';

export interface RigState {
  kind: string;
  facing: 1 | -1;
  walkPhase: number;
  moving: boolean;
  grounded: boolean;
  /** Attack swing timer (seconds remaining) and its duration. */
  swing: number; swingDur: number;
  /** World aim angle while aiming (radians), or null. */
  aimAngle: number | null;
  /** Which arm aims: front or back. */
  aimArm: 'front' | 'back';
  hitFlash: number;
  alive: boolean;
  time: number;
  /** Ground height sampler in world space (for the walker's feet). */
  groundAt?: (wx: number) => number;
  x: number; y: number;
  /** Spearman: spear in hand. */
  spearHeld?: boolean;
  /** Jackal/bird: running flag. */
  running?: boolean;
}

interface Part { spec: PartSpec; pivot: THREE.Group; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }

const texCache = new Map<string, THREE.CanvasTexture>();
export function disposeRigTextures(): void { for (const t of texCache.values()) t.dispose(); texCache.clear(); }

function partTexture(kind: string, p: PartSpec): THREE.CanvasTexture {
  const key = `${kind}/${p.id}`;
  let t = texCache.get(key);
  if (t) return t;
  const pad = 8;
  const W = Math.round(p.w * PPU), H = Math.round(p.h * PPU);
  const c = makeCanvas(W + pad * 2, H + pad * 2); const x = ctx2d(c);
  x.translate(pad, pad); p.paint(x, W, H);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Weapon orientation relative to the hanging arm: [rest, aiming] (radians). */
const WEAPON_ROT: Record<string, [number, number]> = {
  'beast/weaponF': [0.3, Math.PI], 'duelist/weaponF': [Math.PI * 0.9, Math.PI], 'duelist/weaponB': [-Math.PI / 2, -Math.PI / 2],
  'spear/weaponF': [0, Math.PI], 'spear/weaponB': [0.2, Math.PI], 'raider/weaponF': [0.4, Math.PI], 'archer/weaponF': [-Math.PI / 2 + 0.3, -Math.PI / 2],
  'giant/weaponF': [0, 0], 'giant/weaponB': [0, 0], 'raider/weaponB': [0, 0],
};

/** Articulated 2D cut-out rig built from painted parts. Root is at the feet, facing +x. */
export class Rig {
  readonly group = new THREE.Group();
  readonly parts = new Map<string, Part>();
  private aimBlend = 0;
  private moveBlend = 0;
  private downT = 0;

  constructor(readonly spec: RigSpec) {
    const pad = 8 / PPU;
    for (const p of spec.parts) {
      const pivot = new THREE.Group();
      const geo = new THREE.PlaneGeometry(p.w + pad * 2, p.h + pad * 2);
      const mat = new THREE.MeshBasicMaterial({ map: partTexture(spec.kind, p), transparent: true, depthWrite: false, alphaTest: 0.02 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.w * (0.5 - p.pivot[0]), p.h * (0.5 - p.pivot[1]), 0);
      mesh.renderOrder = 10 + p.z;
      pivot.add(mesh);
      pivot.position.set(p.pos[0], p.pos[1], p.z * 0.004);
      const parent = p.parent ? this.parts.get(p.parent)?.pivot : undefined;
      (parent ?? this.group).add(pivot);
      this.parts.set(p.id, { spec: p, pivot, mesh, mat });
    }
  }

  private rot(id: string, r: number): void { const p = this.parts.get(id); if (p) p.pivot.rotation.z = r; }
  private pos(id: string, x: number, y: number): void { const p = this.parts.get(id); if (p) { p.pivot.position.x = x; p.pivot.position.y = y; } }

  update(s: RigState, dt: number): void {
    this.group.position.set(s.x, s.y, 0);
    this.group.scale.x = s.facing;
    // hit flash / downed tint
    const flash = Math.min(1, s.hitFlash * 3);
    this.downT = s.alive ? 0 : Math.min(1, this.downT + dt * 2);
    for (const p of this.parts.values()) {
      const g = 1 - this.downT * 0.6;
      p.mat.color.setRGB(g + flash * 2, g + flash * 2, g + flash * 2);
      p.mat.opacity = 1 - this.downT * 0.35;
    }
    this.group.rotation.z = -this.downT * Math.PI * 0.5;
    this.group.position.y += this.downT * 0.3;
    if (!s.alive) return;

    this.moveBlend += ((s.moving ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 10);
    this.aimBlend += ((s.aimAngle !== null ? 1 : 0) - this.aimBlend) * Math.min(1, dt * 12);
    const kind = this.spec.kind;
    if (kind === 'inventor') this.updateWalker(s);
    else if (kind === 'jackal') this.updateJackal(s);
    else this.updateBiped(s);
  }

  private updateBiped(s: RigState): void {
    const ph = s.walkPhase, mb = this.moveBlend;
    const swing = Math.sin(ph) * 0.55 * mb;
    const air = s.grounded ? 0 : 1;
    this.rot('legF', swing + air * 0.5); this.rot('legB', -swing + air * -0.3);
    const idle = Math.sin(s.time * 2.1) * 0.02;
    const torso = this.parts.get('torso');
    if (torso) { torso.pivot.position.y = torso.spec.pos[1] + Math.abs(Math.sin(ph)) * 0.08 * mb + idle; torso.pivot.rotation.z = -mb * 0.08 + Math.sin(s.time * 2.1) * 0.01; }
    const head = this.parts.get('head');
    // local aim angle (rig faces +x)
    const aimLocal = s.aimAngle === null ? null : (s.facing > 0 ? s.aimAngle : Math.PI - s.aimAngle);
    const armAim = aimLocal === null ? 0 : Math.atan2(Math.cos(aimLocal), -Math.sin(aimLocal));
    // Rest poses: the beast master holds his back arm up as a perch for the bird.
    const kindPose = this.spec.kind === 'beast' ? { f: 0.35, b: -2.35 } : this.spec.kind === 'giant' ? { f: 0.2, b: -0.15 } : { f: 0.25, b: -0.25 };
    const restF = -swing * 0.7 + kindPose.f, restB = swing * 0.45 + kindPose.b;
    const aimingFront = s.aimArm === 'front', aimingBack = !aimingFront;
    const ab = this.aimBlend;
    let armF = restF * (1 - ab * (aimingFront ? 1 : 0)) + armAim * (ab * (aimingFront ? 1 : 0));
    const armB = restB * (1 - ab * (aimingBack ? 1 : 0)) + armAim * (ab * (aimingBack ? 1 : 0));
    // attack swing on the front arm
    if (s.swing > 0 && s.swingDur > 0) { const k = 1 - s.swing / s.swingDur; armF += Math.sin(k * Math.PI) * 1.6 + (k < 0.3 ? -k : 0); }
    this.rot('armF', armF); this.rot('armB', armB);
    for (const [id, aiming] of [['weaponF', aimingFront], ['weaponB', aimingBack]] as [string, boolean][]) {
      const w = this.parts.get(id); if (!w) continue;
      const [rest, aim] = WEAPON_ROT[`${this.spec.kind}/${id}`] ?? [0, 0];
      const k = aiming ? ab : 0;
      w.pivot.rotation.z = rest * (1 - k) + aim * k;
      if (this.spec.kind === 'spear' && id === 'weaponF') w.pivot.visible = s.spearHeld !== false;
      if (this.spec.kind === 'spear' && id === 'weaponB') w.pivot.visible = s.spearHeld === false;
    }
    if (head) {
      const tilt = this.spec.kind === 'beast' ? -0.18 + Math.sin(s.time * 1.3) * 0.08 : 0;
      head.pivot.rotation.z = tilt + (aimLocal !== null ? Math.max(-0.35, Math.min(0.35, aimLocal * 0.3)) * ab : 0) + Math.sin(ph) * 0.03 * mb;
    }
    const bird = this.parts.get('bird');
    if (bird) { const flap = Math.max(0, Math.sin(s.time * 7)) * (0.5 + 0.5 * Math.sin(s.time * 0.7)); bird.pivot.rotation.z = -armB + flap * 0.12; bird.pivot.scale.y = 1 + flap * 0.08; }
    const glow = this.parts.get('glow');
    if (glow) { const k = 0.85 + 0.15 * Math.sin(s.time * 5); glow.pivot.scale.set(k, k, 1); }
  }

  private updateJackal(s: RigState): void {
    const ph = s.walkPhase * 1.4, mb = Math.max(this.moveBlend, s.running ? 1 : 0);
    const a = 0.7 * mb;
    this.rot('legFF', Math.sin(ph) * a); this.rot('legBB', Math.sin(ph) * a); this.rot('legFB', -Math.sin(ph) * a); this.rot('legBF', -Math.sin(ph) * a);
    const body = this.parts.get('body');
    if (body) { body.pivot.position.y = body.spec.pos[1] + Math.abs(Math.sin(ph)) * 0.08 * mb + Math.sin(s.time * 3) * 0.015; body.pivot.rotation.z = Math.sin(ph) * 0.06 * mb; }
    this.rot('head', Math.sin(s.time * 2.3) * 0.08 + (s.running ? 0.25 : 0) - Math.sin(ph) * 0.05 * mb);
  }

  /** Six-legged walker: each leg solves 2-bone IK from its hip to a foot target on the real ground. */
  private updateWalker(s: RigState): void {
    const L1 = 0.8, L2 = 0.9;
    const stride = 0.45, ph = s.walkPhase * 1.1;
    const mb = this.moveBlend;
    const chassis = this.parts.get('chassis');
    const bob = Math.sin(ph * 3) * 0.03 * mb + Math.sin(s.time * 1.7) * 0.015;
    if (chassis) chassis.pivot.position.y = chassis.spec.pos[1] + bob;
    for (const id of ['pilot', 'head', 'cannon']) { const p = this.parts.get(id); if (p) p.pivot.position.y = p.spec.pos[1] + bob; }
    const head = this.parts.get('head'); if (head) head.pivot.rotation.z = Math.sin(s.time * 1.1) * 0.05;
    const rows: ['b' | 'f', number][] = [['b', Math.PI], ['f', 0]];
    for (const [row, off] of rows) {
      for (let i = 0; i < 3; i++) {
        const hipX = -0.72 + i * 0.72, hipY = 0.95 + bob;
        const phase = ph + i * 2.094 + off;
        const footX = hipX + (row === 'f' ? 0.35 : -0.35) + stride * Math.sin(phase) * (0.35 + 0.65 * mb);
        const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * 0.32 * mb;
        const wx = s.x + s.facing * footX;
        const groundY = s.groundAt ? s.groundAt(wx) - s.y : 0;
        const footY = Math.max(-0.4, Math.min(1.0, groundY)) + lift;
        // IK
        let dx = footX - hipX, dy = footY - hipY; let d = Math.hypot(dx, dy);
        const maxD = L1 + L2 - 0.02; if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
        const minD = Math.abs(L1 - L2) + 0.02; if (d < minD) { dy = -minD; dx = 0; d = minD; }
        const a1 = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
        const base = Math.atan2(dy, dx);
        // knee outward (away from body centre) and up
        const side = footX >= 0 ? 1 : -1;
        const kneeAng = base + side * a1 * (dy < 0 ? 1 : 1) * (side > 0 ? 1 : 1);
        const kneeA = base + a1, kneeB = base - a1;
        const kA = { x: hipX + Math.cos(kneeA) * L1, y: hipY + Math.sin(kneeA) * L1 }, kB = { x: hipX + Math.cos(kneeB) * L1, y: hipY + Math.sin(kneeB) * L1 };
        const knee = kA.y > kB.y ? kA : kB; void kneeAng;
        const fx = hipX + dx, fy = hipY + dy;
        this.pos(`legU_${row}${i}`, hipX, hipY); this.rot(`legU_${row}${i}`, Math.atan2(knee.x - hipX, -(knee.y - hipY)));
        this.pos(`legL_${row}${i}`, knee.x, knee.y); this.rot(`legL_${row}${i}`, Math.atan2(fx - knee.x, -(fy - knee.y)));
        this.pos(`foot_${row}${i}`, fx, fy - 0.05);
      }
    }
    const cannon = this.parts.get('cannon');
    if (cannon) {
      const aimLocal = s.aimAngle === null ? 0.25 : (s.facing > 0 ? s.aimAngle : Math.PI - s.aimAngle);
      cannon.pivot.rotation.z += (aimLocal - cannon.pivot.rotation.z) * 0.3;
      if (s.swing > 0) cannon.pivot.position.x = cannon.spec.pos[0] - 0.25 * (s.swing / Math.max(0.01, s.swingDur)); else cannon.pivot.position.x = cannon.spec.pos[0];
    }
  }

  dispose(): void { for (const p of this.parts.values()) { p.mesh.geometry.dispose(); p.mat.dispose(); } }
}
