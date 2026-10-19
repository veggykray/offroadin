import * as THREE from 'three';
import { FLOOR1_Y } from '../config/p2Slice';
import type { Actor } from '../sim/Actor';
import type { Game } from '../sim/Game';
import { roughen } from './geom';
import type { Materials } from './Materials';

/**
 * Procedurally modelled animals (original assets, built in code). Smooth-shaded, naturally
 * proportioned bodies with articulated two-segment legs solved by 2-bone IK. The gait phase is
 * driven by the actor's odometer so planted feet stay still on the ground.
 */

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();

interface LegCfg { x: number; y: number; z: number; upper: number; lower: number; r: number; bend: number; phase: number; paw: number }
interface QuadCfg {
  bodyY: number; bodyLen: number; bodyR: number; chestR: number; rumpR: number; shag: number;
  neck: { len: number; r: number; pitch: number }; head: { r: number; y: number; z: number };
  muzzle: { w: number; h: number; d: number }; ears: 'droop' | 'point'; earSize: number;
  legs: LegCfg[]; tail: { n: number; len: number; r: number; droop: number; shag: number };
  liftH: number; bob: number; stride: number;
}

export const DOG_CFG: QuadCfg = {
  bodyY: 0.70, bodyLen: 0.80, bodyR: 0.27, chestR: 0.32, rumpR: 0.27, shag: 0.05,
  neck: { len: 0.40, r: 0.17, pitch: 1.0 }, head: { r: 0.225, y: 0.09, z: 0.08 },
  muzzle: { w: 0.18, h: 0.15, d: 0.3 }, ears: 'droop', earSize: 0.25,
  legs: [
    { x: -0.2, y: 0.0, z: 0.34, upper: 0.38, lower: 0.36, r: 0.085, bend: 0.45, phase: 0.0, paw: 0.1 },
    { x: 0.2, y: 0.0, z: 0.34, upper: 0.38, lower: 0.36, r: 0.085, bend: 0.45, phase: 0.5, paw: 0.1 },
    { x: -0.18, y: -0.02, z: -0.34, upper: 0.40, lower: 0.36, r: 0.095, bend: -1.0, phase: 0.5, paw: 0.1 },
    { x: 0.18, y: -0.02, z: -0.34, upper: 0.40, lower: 0.36, r: 0.095, bend: -1.0, phase: 0.0, paw: 0.1 },
  ],
  tail: { n: 4, len: 0.66, r: 0.075, droop: 0.5, shag: 0.04 },
  liftH: 0.14, bob: 0.025, stride: 1.45,
};

export const CAT_CFG: QuadCfg = {
  bodyY: 0.205, bodyLen: 0.30, bodyR: 0.085, chestR: 0.09, rumpR: 0.085, shag: 0.004,
  neck: { len: 0.1, r: 0.055, pitch: 0.6 }, head: { r: 0.08, y: 0.03, z: 0.03 },
  muzzle: { w: 0.07, h: 0.05, d: 0.07 }, ears: 'point', earSize: 0.055,
  legs: [
    { x: -0.065, y: 0.0, z: 0.13, upper: 0.12, lower: 0.115, r: 0.026, bend: 0.35, phase: 0.0, paw: 0.032 },
    { x: 0.065, y: 0.0, z: 0.13, upper: 0.12, lower: 0.115, r: 0.026, bend: 0.35, phase: 0.5, paw: 0.032 },
    { x: -0.06, y: 0.0, z: -0.13, upper: 0.13, lower: 0.12, r: 0.028, bend: -1.0, phase: 0.5, paw: 0.032 },
    { x: 0.06, y: 0.0, z: -0.13, upper: 0.13, lower: 0.12, r: 0.028, bend: -1.0, phase: 0.0, paw: 0.032 },
  ],
  tail: { n: 5, len: 0.36, r: 0.02, droop: -0.3, shag: 0 },
  liftH: 0.05, bob: 0.008, stride: 0.62,
};

function capsule(r: number, len: number, mat: THREE.Material, shag = 0, seed = 1): THREE.Mesh {
  let g: THREE.BufferGeometry = new THREE.CapsuleGeometry(r, len, 4, 10);
  if (shag > 0) g = roughen(g, shag, 2.5, seed);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function sphere(r: number, mat: THREE.Material, shag = 0, seed = 1, w = 12, h = 9): THREE.Mesh {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(r, w, h);
  if (shag > 0) g = roughen(g, shag, 2.5, seed);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
/** Orient a Y-up capsule from a to b. */
function placeSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  tmpV.copy(b).sub(a); const len = tmpV.length(); if (len > 1e-5) { tmpV.divideScalar(len); mesh.quaternion.setFromUnitVectors(UP, tmpV); }
}

class Leg {
  upper: THREE.Mesh; lower: THREE.Mesh; paw: THREE.Mesh; hip = new THREE.Vector3(); foot = new THREE.Vector3();
  wasSwing = false;
  constructor(public cfg: LegCfg, mat: THREE.Material, pawMat: THREE.Material, shag: number, parent: THREE.Object3D) {
    this.upper = capsule(cfg.r, cfg.upper, mat, shag * 0.5, 3); this.lower = capsule(cfg.r * 0.8, cfg.lower, mat, shag * 0.3, 4);
    this.paw = sphere(cfg.paw, pawMat, 0, 1, 8, 6); this.paw.scale.set(1, 0.6, 1.35);
    parent.add(this.upper, this.lower, this.paw);
  }
  solve(): void {
    const d = tmpV.copy(this.foot).sub(this.hip); const L = Math.max(0.05, Math.min(d.length(), (this.cfg.upper + this.cfg.lower) * 0.995));
    d.normalize();
    const cosA = Math.min(1, Math.max(-1, (this.cfg.upper * this.cfg.upper + L * L - this.cfg.lower * this.cfg.lower) / (2 * this.cfg.upper * L)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const perp = new THREE.Vector3(0, d.z, -d.y); // perpendicular in the sagittal plane, +z = forward
    const joint = new THREE.Vector3().copy(this.hip).addScaledVector(d, this.cfg.upper * cosA).addScaledVector(perp, this.cfg.upper * sinA * Math.sign(this.cfg.bend) * Math.min(1, Math.abs(this.cfg.bend)));
    placeSegment(this.upper, this.hip, joint); placeSegment(this.lower, joint, this.foot);
    this.paw.position.copy(this.foot); this.paw.position.z += this.cfg.paw * 0.6; this.paw.position.y += this.cfg.paw * 0.45;
  }
}

export class Quadruped {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly head = new THREE.Group();
  readonly legs: Leg[] = [];
  readonly tail: THREE.Mesh[] = [];
  private ears: THREE.Mesh[] = [];
  private eyes: THREE.Mesh[] = [];
  private moveBlend = 0; private t = 0; private sitBlend = 0; private lastPhase = 0;
  onStep: ((heavy: boolean) => void) | null = null;

  constructor(readonly cfg: QuadCfg, mat: THREE.Material, secondary: THREE.Material, eyeMat: THREE.Material, dark: THREE.Material, readonly isDog: boolean) {
    const c = cfg; const B = this.body; this.root.add(B);
    // torso: capsule lying along z, chest and rump spheres, shaggy coat shell
    const torso = capsule(c.bodyR, c.bodyLen, mat, c.shag, 11); torso.rotation.x = Math.PI / 2; torso.scale.set(1, 1.05, 1); B.add(torso);
    const chest = sphere(c.chestR, mat, c.shag, 12); chest.position.set(0, -c.bodyR * 0.08, c.bodyLen * 0.45); chest.scale.set(1, 1.05, 1.1); B.add(chest);
    const rump = sphere(c.rumpR, mat, c.shag, 13); rump.position.set(0, c.bodyR * 0.05, -c.bodyLen * 0.5); B.add(rump);
    if (isDog) { const coat = capsule(c.bodyR * 1.08, c.bodyLen * 0.9, mat, c.shag * 1.6, 14); coat.rotation.x = Math.PI / 2; coat.position.y = -c.bodyR * 0.22; coat.scale.set(1.05, 0.85, 1); B.add(coat); }
    else { const belly = sphere(c.bodyR * 0.95, secondary, 0, 1); belly.scale.set(0.9, 0.7, 1.9); belly.position.set(0, -c.bodyR * 0.35, 0.02); B.add(belly); }
    // neck + head
    const neckBase = new THREE.Vector3(0, c.bodyR * 0.55, c.bodyLen * 0.5 + c.chestR * 0.35);
    const neckTop = new THREE.Vector3(0, neckBase.y + Math.sin(c.neck.pitch) * c.neck.len, neckBase.z + Math.cos(c.neck.pitch) * c.neck.len);
    const neck = capsule(c.neck.r, c.neck.len * 0.9, mat, c.shag, 15); placeSegment(neck, neckBase, neckTop); B.add(neck);
    if (isDog) { const ruff = sphere(c.neck.r * 1.5, mat, c.shag * 2, 16); ruff.position.copy(neckBase).lerp(neckTop, 0.45); ruff.scale.set(1.15, 0.8, 0.9); B.add(ruff); }
    this.head.position.copy(neckTop); B.add(this.head);
    const H = this.head; const hr = c.head.r;
    const skull = sphere(hr, mat, c.shag * 0.5, 17); skull.position.set(0, c.head.y, c.head.z); skull.scale.set(1.05, 0.95, 1.05); H.add(skull);
    const muzzle = sphere(1, isDog ? mat : secondary, 0, 1, 10, 8); muzzle.scale.set(c.muzzle.w, c.muzzle.h, c.muzzle.d); muzzle.position.set(0, c.head.y - hr * 0.3, c.head.z + hr * 0.75); H.add(muzzle);
    if (isDog) { const jowl = sphere(c.muzzle.w * 0.95, mat, c.shag * 0.5, 18); jowl.scale.set(1.1, 0.7, 1); jowl.position.set(0, c.head.y - hr * 0.62, c.head.z + hr * 0.55); H.add(jowl); }
    const nose = sphere(c.muzzle.w * 0.38, dark, 0, 1, 8, 6); nose.position.set(0, c.head.y - hr * 0.18, c.head.z + hr * 0.75 + c.muzzle.d * 0.95); H.add(nose);
    for (const s of [-1, 1]) {
      const eye = sphere(hr * 0.17, eyeMat, 0, 1, 8, 6); eye.position.set(s * hr * 0.42, c.head.y + hr * 0.18, c.head.z + hr * 0.78); H.add(eye); this.eyes.push(eye);
      if (c.ears === 'droop') {
        const ear = sphere(1, mat, c.shag * 0.6, 19 + s); ear.scale.set(c.earSize * 0.42, c.earSize, c.earSize * 0.55); ear.position.set(s * hr * 0.95, c.head.y - c.earSize * 0.35, c.head.z - hr * 0.1); ear.rotation.z = -s * 0.25; H.add(ear); this.ears.push(ear);
      } else {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(c.earSize * 0.55, c.earSize * 1.3, 4), mat); ear.castShadow = true; ear.position.set(s * hr * 0.6, c.head.y + hr * 0.85, c.head.z - hr * 0.1); ear.rotation.z = -s * 0.3; ear.rotation.y = s * 0.3; H.add(ear); this.ears.push(ear);
        const inner = new THREE.Mesh(new THREE.ConeGeometry(c.earSize * 0.3, c.earSize * 0.8, 4), secondary); inner.position.set(0, -0.1 * c.earSize, c.earSize * 0.18); ear.add(inner);
      }
    }
    if (!isDog) { const bib = sphere(c.chestR * 0.8, secondary, 0, 1); bib.scale.set(0.9, 1.1, 0.6); bib.position.set(0, -c.bodyR * 0.1, c.bodyLen * 0.5 + c.chestR * 0.55); B.add(bib); }
    // legs
    for (const lc of c.legs) this.legs.push(new Leg(lc, mat, isDog ? mat : secondary, c.shag, B));
    // tail chain
    for (let i = 0; i < c.tail.n; i++) { const seg = capsule(c.tail.r * (1 - i * 0.12), c.tail.len / c.tail.n, mat, c.tail.shag, 30 + i); B.add(seg); this.tail.push(seg); }
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  /** Apply actor state + procedural animation. */
  update(a: Actor, dt: number, _game: Game): void {
    const c = this.cfg; this.t += dt;
    this.root.position.set(a.x, a.y + (a.floor === 1 ? FLOOR1_Y : 0), a.z);
    this.root.rotation.y = a.facing;
    const moving = a.speedNow > 0.05 || a.motion === 'turn';
    this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 9);
    const sitting = a.motion === 'sit' || (a.motion === 'inspect' && !this.isDog);
    this.sitBlend += ((sitting ? 1 : 0) - this.sitBlend) * Math.min(1, dt * 5);
    const phase = a.motion === 'turn' ? this.lastPhase + dt * 1.2 : a.odometer / c.stride;
    this.lastPhase = phase;
    const prog = a.motionProgress;
    const m = a.motion;
    // body bob/pitch
    const bob = Math.sin(phase * Math.PI * 4) * c.bob * this.moveBlend;
    const crouch = (m === 'ride' || m === 'board') ? -c.bodyY * 0.06 : 0;
    const sitDrop = this.sitBlend * c.bodyY * 0.33;
    this.body.position.set(0, c.bodyY + bob + crouch - sitDrop * 0.55, 0);
    this.body.rotation.set(Math.sin(phase * Math.PI * 4 + 1) * 0.015 * this.moveBlend - this.sitBlend * 0.42 + (m === 'sniff' || m === 'scrape' ? -0.08 * Math.min(1, prog * 3) : 0), 0, 0);
    this.body.scale.y = 1 + Math.sin(this.t * 1.6) * 0.012;
    // head
    let hx = 0, hy = 0;
    if (m === 'sniff') { hx = 0.95 * Math.sin(Math.min(1, prog * 2.5) * Math.PI / 2); hy = Math.sin(this.t * 9) * 0.25; }
    else if (m === 'scrape') { hx = 0.8; hy = Math.sin(this.t * 3) * 0.12; }
    else if (m === 'nudge') { hx = 0.45 * Math.abs(Math.sin(prog * Math.PI * 2)); }
    else if (m === 'inspect') { hx = this.isDog ? 0.3 : -0.25; hy = Math.sin(this.t * 1.5) * 0.3; }
    else if (m === 'greet') { hx = 0.25 * Math.abs(Math.sin(prog * Math.PI * 3)); hy = Math.sin(this.t * 2) * 0.15; }
    else if (m === 'sit') { hx = -0.1; hy = Math.sin(this.t * 0.7) * 0.25; }
    else if (!moving) { hy = Math.sin(this.t * 0.5) * 0.35 * (Math.sin(this.t * 0.13) > 0.3 ? 1 : 0); hx = Math.sin(this.t * 0.9) * 0.04; }
    else { hx = 0.08 + Math.sin(phase * Math.PI * 4) * 0.03; }
    const headPitch = hx + this.sitBlend * 0.35 - c.neck.pitch * 0.15;
    this.head.rotation.x += (headPitch - this.head.rotation.x) * Math.min(1, dt * 8);
    this.head.rotation.y += (hy - this.head.rotation.y) * Math.min(1, dt * 6);
    // ears flop with the gait
    for (let i = 0; i < this.ears.length; i++) { const s = i === 0 ? -1 : 1; if (c.ears === 'droop') this.ears[i].rotation.z = -s * (0.25 + Math.sin(phase * Math.PI * 4 + i) * 0.12 * this.moveBlend); else this.ears[i].rotation.x = Math.sin(this.t * 7 + i * 2) * 0.05 * (moving ? 1 : 0.3); }
    // legs: gait with duty factor 0.5, stance moves the foot backward at body speed
    const groundY = -c.bodyY - bob - crouch + sitDrop * 0.55;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i]; const lc = leg.cfg;
      const p = (phase + lc.phase) % 1; const stance = p < 0.5; const u = stance ? p / 0.5 : (p - 0.5) / 0.5;
      const gz = stance ? c.stride * 0.25 - c.stride * 0.5 * u : -c.stride * 0.25 + c.stride * 0.5 * (u * u * (3 - 2 * u));
      const gy = stance ? 0 : Math.sin(u * Math.PI) * c.liftH;
      if (this.onStep && !stance !== leg.wasSwing) { if (stance && this.moveBlend > 0.5) this.onStep(this.isDog); leg.wasSwing = !stance; }
      let fz = lc.z + gz * this.moveBlend, fy = groundY + gy * this.moveBlend, fx = lc.x;
      // sitting: hind feet forward and flat, body dropped; scrape: right-front paws the ground
      if (lc.z < 0) fz += this.sitBlend * 0.42 * (this.isDog ? 1 : 0.5);
      if (m === 'scrape' && i === 1) { fz += 0.22 + Math.sin(this.t * 13) * 0.2; fy += 0.08 + Math.max(0, Math.sin(this.t * 13)) * 0.1; }
      if (m === 'greet' && !this.isDog) fx += Math.sin(this.t * 3) * 0.02;
      leg.hip.set(lc.x, lc.y, lc.z); leg.foot.set(fx, fy, fz); leg.solve();
    }
    // tail: hangs with a curve, sways with gait, wags on greet/sit
    const wag = (m === 'greet' || (m === 'sit' && prog > 0.3)) ? Math.sin(this.t * 14) * 0.7 : Math.sin(phase * Math.PI * 2) * 0.25 * this.moveBlend + Math.sin(this.t * 1.1) * 0.08;
    const catUp = !this.isDog && (moving || m === 'greet') ? 1 : 0;
    let tp = new THREE.Vector3(0, c.rumpR * 0.5, -c.bodyLen * 0.5 - c.rumpR * 0.6);
    let dir = new THREE.Vector3(Math.sin(wag) * 0.6, -c.tail.droop + catUp * 1.2 - (m === 'balk' ? 0.4 : 0), -1).normalize();
    for (let i = 0; i < this.tail.length; i++) {
      const segLen = c.tail.len / c.tail.n;
      dir = dir.clone().add(new THREE.Vector3(Math.sin(wag + i * 0.6) * 0.35, this.isDog ? -0.12 : (0.35 * catUp - 0.08), 0)).normalize();
      const end = tp.clone().addScaledVector(dir, segLen);
      placeSegment(this.tail[i], tp, end); tp = end;
    }
  }
}

/** White: a small pale porcelain inhabitant with a dark face opening and luminous eyes. */
export class WhiteRig {
  readonly root = new THREE.Group(); private body = new THREE.Group(); private eyes: THREE.Mesh[] = []; private feet: THREE.Mesh[] = []; private arms: THREE.Mesh[] = [];
  private fear = 0.6; private t = 0; private moveBlend = 0;
  constructor(mats: Materials) {
    const B = this.body; this.root.add(B);
    const prof = [new THREE.Vector2(0.02, 0.82), new THREE.Vector2(0.16, 0.78), new THREE.Vector2(0.24, 0.6), new THREE.Vector2(0.27, 0.35), new THREE.Vector2(0.3, 0.1), new THREE.Vector2(0.26, 0.0)];
    const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), mats.whiteBody); shell.castShadow = true; shell.receiveShadow = true; B.add(shell);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mats.dark); face.scale.set(1, 1.15, 0.5); face.position.set(0, 0.56, 0.17); B.add(face);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), new THREE.MeshBasicMaterial({ color: '#e8fdff' })); e.position.set(s * 0.055, 0.58, 0.27); B.add(e); this.eyes.push(e); }
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 3, 8), mats.whiteBody); arm.castShadow = true; arm.position.set(s * 0.23, 0.34, 0.1); arm.rotation.set(0.9, 0, -s * 0.5); B.add(arm); this.arms.push(arm); }
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mats.whiteBody); f.scale.set(1, 0.55, 1.4); f.position.set(s * 0.11, 0.04, 0.1); f.castShadow = true; this.root.add(f); this.feet.push(f); }
  }
  update(a: Actor, dt: number, game: Game): void {
    this.t += dt;
    this.root.position.set(a.x, a.y + (a.floor === 1 ? FLOOR1_Y : 0), a.z); this.root.rotation.y = a.facing;
    const moving = a.speedNow > 0.05; this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 8);
    const m = a.motion;
    const targetFear = m === 'balk' ? 1 : (game.whiteBalked && !game.whiteReassured) ? 0.85 : game.completed ? 0.05 : game.whiteMode === 'wait' ? 0.55 : game.whiteReassured ? 0.2 : 0.4;
    this.fear += (targetFear - this.fear) * Math.min(1, dt * (m === 'relax' ? 1.2 : 2.5));
    const shiver = (m === 'balk' ? 1 : this.fear > 0.7 ? 0.5 : 0) * Math.sin(this.t * 38) * 0.012;
    const phase = a.odometer / 0.55;
    const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.02 * this.moveBlend;
    this.body.position.set(shiver, bob + (m === 'greet' ? Math.abs(Math.sin(this.t * 6)) * 0.04 : 0), 0);
    this.body.rotation.x = 0.1 + 0.3 * this.fear + Math.sin(phase * Math.PI * 2) * 0.03 * this.moveBlend;
    this.body.rotation.z = Math.sin(phase * Math.PI * 2) * 0.05 * this.moveBlend + (!moving ? Math.sin(this.t * 0.8) * 0.02 : 0);
    const squash = 1 - this.fear * 0.12; this.body.scale.set(1 + this.fear * 0.05, squash, 1 + this.fear * 0.05);
    for (const e of this.eyes) { e.scale.set(1, 1 - this.fear * 0.55, 1); (e.material as THREE.MeshBasicMaterial).color.setHSL(0.5, 1, 0.78 + (1 - this.fear) * 0.2); }
    for (let i = 0; i < 2; i++) { const s = i === 0 ? -1 : 1; this.arms[i].rotation.set(0.9 + this.fear * 0.5, 0, -s * (0.5 - this.fear * 0.3)); this.arms[i].position.x = s * (0.23 - this.fear * 0.04); }
    for (let i = 0; i < 2; i++) { const s = i === 0 ? -1 : 1; const p = (phase + (i === 0 ? 0 : 0.5)) % 1; const sw = p < 0.5 ? 0 : Math.sin((p - 0.5) * 2 * Math.PI); const z = p < 0.5 ? 0.14 - 0.28 * (p / 0.5) : -0.14 + 0.28 * ((p - 0.5) / 0.5); this.feet[i].position.set(s * 0.11, 0.04 + sw * 0.05 * this.moveBlend, 0.1 + z * this.moveBlend); }
  }
}

/** Builds and updates all character rigs. */
export class Characters {
  readonly dog: Quadruped; readonly cat: Quadruped; readonly white: WhiteRig;
  readonly group = new THREE.Group();
  constructor(mats: Materials) {
    this.dog = new Quadruped(DOG_CFG, mats.dogFur, mats.dogFur, new THREE.MeshBasicMaterial({ color: '#4a2a1c' }), mats.dark, true);
    this.cat = new Quadruped(CAT_CFG, mats.catBlack, mats.catWhite, new THREE.MeshBasicMaterial({ color: '#9ee36b' }), mats.dark, false);
    this.white = new WhiteRig(mats);
    this.dog.root.name = 'dog'; this.cat.root.name = 'cat'; this.white.root.name = 'white';
    this.group.add(this.dog.root, this.cat.root, this.white.root);
  }
  update(game: Game, dt: number): void {
    this.dog.update(game.dog, dt, game); this.cat.update(game.cat, dt, game); this.white.update(game.white, dt, game);
  }
}

/** Little tool-and-slate work loop for the non-interactive attendant. */
export function animateAttendant(arm: THREE.Group, body: THREE.Group, t: number): void {
  const cycle = t % 7;
  const writing = cycle < 4;
  arm.rotation.z = writing ? Math.sin(t * 9) * 0.25 : -0.3 + Math.sin(t * 1.5) * 0.08;
  arm.rotation.x = writing ? 0.2 : 0.9 + Math.sin(t * 2) * 0.15;
  body.rotation.y = (Math.PI) + (writing ? 0.15 : -0.35) + Math.sin(t * 0.7) * 0.05;
  body.position.y = FLOOR1_Y + Math.abs(Math.sin(t * 2.2)) * 0.006;
}

