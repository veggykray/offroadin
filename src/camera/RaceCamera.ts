import * as THREE from 'three';
import type { Track } from '../track/Track';

/**
 * High three-quarter overview camera (Super Off Road readability, in 3D).
 *
 * - Fixed viewing direction (looking "north") at a steep pitch — the track never
 *   rotates under you, so you can plan ahead.
 * - DEFAULT 'overview': frames (almost) the whole track, drifting gently toward the
 *   player and a little ahead of their velocity. Heavily damped.
 * - 'near' (press C): a closer view (~120 m wide) that follows the player more.
 * - Subtle zoom with speed, FOV kick on nitro, small shake on big impacts.
 */
export class RaceCamera {
  readonly camera: THREE.PerspectiveCamera;
  mode: 'overview' | 'near' = 'overview';
  /** How far the view drifts toward the player (0 = fixed, 1 = centred on player). */
  overviewFollow = 0.35;
  /** Overview zoom: 1 = exactly the whole track, <1 = slightly closer. */
  overviewZoom = 0.9;
  nearFollow = 0.85;
  /** Visible width (m) at the focus in 'near' mode. */
  viewWidth = 120;
  pitch = THREE.MathUtils.degToRad(54);
  private focus = new THREE.Vector3();
  private focusVel = new THREE.Vector3();
  private distance = 120;
  private baseFov = 34;
  private fovKick = 0;
  private shake = 0;
  private trackCentre = new THREE.Vector3();
  private trackSize = new THREE.Vector2();
  private trackMin = new THREE.Vector3();
  private trackMax = new THREE.Vector3();
  private fitFocus = new THREE.Vector3();
  private fitDistance = 200;
  private initialised = false;

  constructor(track: Track, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 5, 1200);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of track.paths.values()) {
      for (const s of p.samples) {
        minX = Math.min(minX, s.x - s.halfWidth);
        maxX = Math.max(maxX, s.x + s.halfWidth);
        minZ = Math.min(minZ, s.z - s.halfWidth);
        maxZ = Math.max(maxZ, s.z + s.halfWidth);
      }
    }
    let minY = Infinity, maxY = -Infinity;
    for (const p of track.paths.values()) for (const s of p.samples) {
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }
    this.trackCentre.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.trackSize.set(maxX - minX, maxZ - minZ);
    this.trackMin.set(minX, minY, minZ);
    this.trackMax.set(maxX, maxY + 3, maxZ);
    this.fit();
  }

  get overview(): boolean {
    return this.mode === 'overview';
  }

  toggleMode(): void {
    this.mode = this.mode === 'overview' ? 'near' : 'overview';
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.fit();
  }

  /** Find the focus + distance that frames the whole track bounding box on screen. */
  private fit(): void {
    const cam = this.camera.clone();
    cam.fov = this.baseFov;
    cam.updateProjectionMatrix();
    const corners: THREE.Vector3[] = [];
    for (const x of [this.trackMin.x, this.trackMax.x]) for (const y of [this.trackMin.y, this.trackMax.y]) for (const z of [this.trackMin.z, this.trackMax.z]) corners.push(new THREE.Vector3(x, y, z));
    const focus = this.trackCentre.clone();
    const extents = (d: number) => {
      this.place(cam, focus, d);
      cam.updateMatrixWorld(true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        const p = c.clone().project(cam);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      return { x0, x1, y0, y1 };
    };
    let dist = 200;
    for (let iter = 0; iter < 4; iter++) {
      let lo = 30, hi = 1500;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const e = extents(mid);
        if (e.x0 > -0.97 && e.x1 < 0.97 && e.y0 > -0.95 && e.y1 < 0.86) hi = mid; // top: leave room for HUD
        else lo = mid;
      }
      dist = hi;
      const e = extents(dist);
      const vfov = THREE.MathUtils.degToRad(cam.fov);
      const halfH = dist * Math.tan(vfov / 2);
      const halfW = halfH * cam.aspect;
      focus.x += ((e.x0 + e.x1) / 2) * halfW;
      focus.z -= (((e.y0 + e.y1) / 2 - (-0.95 + 0.86) / 2) * halfH) / Math.sin(this.pitch);
    }
    this.fitFocus.copy(focus);
    this.fitDistance = dist;
  }

  private place(cam: THREE.PerspectiveCamera, focus: THREE.Vector3, distance: number): void {
    cam.position.set(focus.x, focus.y + Math.sin(this.pitch) * distance, focus.z + Math.cos(this.pitch) * distance);
    cam.lookAt(focus);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  /** Distance needed so a given ground width/depth is visible. */
  private distanceFor(width: number, depth: number): number {
    const vfov = THREE.MathUtils.degToRad(this.baseFov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dW = width / 2 / Math.tan(hfov / 2);
    // Ground depth seen at a pitch is foreshortened by sin(pitch).
    const dD = (depth * Math.sin(this.pitch)) / 2 / Math.tan(vfov / 2);
    return Math.max(dW, dD);
  }

  update(dt: number, target: THREE.Vector3 | null, velocity: THREE.Vector3 | null, speedFrac: number, nitro: boolean): void {
    // ---- Where to look ----
    const goal = new THREE.Vector3();
    let wantDist: number;
    const lead = velocity ? velocity.clone().setY(0).multiplyScalar(0.9) : new THREE.Vector3();
    if (lead.length() > 22) lead.setLength(22);
    if (this.mode === 'overview' || !target) {
      goal.copy(this.fitFocus);
      wantDist = this.fitDistance * this.overviewZoom * (1 + speedFrac * 0.03);
      if (target) {
        // Drift toward the player (and where they're heading), but only a little.
        const toward = target.clone().add(lead).sub(this.fitFocus).setY(0);
        goal.addScaledVector(toward, this.overviewFollow);
      }
    } else {
      goal.copy(target).add(lead).lerp(this.trackCentre, 1 - this.nearFollow);
      // Keep the view inside the track area.
      const hx = Math.max(0, this.trackSize.x / 2 - this.viewWidth * 0.35);
      const hz = Math.max(0, this.trackSize.y / 2 - this.viewWidth * 0.2);
      goal.x = THREE.MathUtils.clamp(goal.x, this.trackCentre.x - hx, this.trackCentre.x + hx);
      goal.z = THREE.MathUtils.clamp(goal.z, this.trackCentre.z - hz, this.trackCentre.z + hz);
      wantDist = this.distanceFor(this.viewWidth * (1 + speedFrac * 0.08), 0);
    }
    goal.y = target ? target.y * 0.4 : 0;
    if (!this.initialised) {
      this.focus.copy(goal);
      this.distance = wantDist;
      this.initialised = true;
    }
    // Critically damped spring (SmoothDamp) → smooth, no jitter.
    const smoothTime = this.overview ? 1.4 : 0.9;
    const omega = 2 / smoothTime;
    const xw = omega * dt;
    const exp = 1 / (1 + xw + 0.48 * xw * xw + 0.235 * xw * xw * xw);
    const change = this.focus.clone().sub(goal);
    const temp = this.focusVel.clone().addScaledVector(change, omega).multiplyScalar(dt);
    this.focusVel.addScaledVector(temp, -omega).multiplyScalar(exp);
    this.focus.copy(goal).add(change.add(temp).multiplyScalar(exp));
    this.distance += (wantDist - this.distance) * (1 - Math.exp(-dt * 1.5));

    // ---- FOV kick on nitro ----
    this.fovKick += ((nitro ? 6 : 0) - this.fovKick) * (1 - Math.exp(-dt * (nitro ? 6 : 2.5)));
    this.camera.fov = this.baseFov + this.fovKick;
    this.camera.updateProjectionMatrix();

    // ---- Place camera: fixed yaw (looking north / -Z) ----
    const off = new THREE.Vector3(0, Math.sin(this.pitch), Math.cos(this.pitch)).multiplyScalar(this.distance);
    this.camera.position.copy(this.focus).add(off);
    this.shake *= Math.exp(-dt * 6);
    if (this.shake > 0.01) {
      const s = this.shake * 0.9;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.focus);
  }

  get focusPoint(): THREE.Vector3 {
    return this.focus;
  }

  snap(): void {
    this.initialised = false;
  }
}
