import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Vehicle } from './Vehicle';
import type { VehicleConfig } from './VehicleConfig';

/**
 * Visual representation of a vehicle — completely separate from the physics chassis.
 *
 *   root   : follows the (interpolated) physics transform
 *   └ body : adds cosmetic lean / pitch / landing squash on top of the real physics motion
 *     ├ placeholder (simple primitive stand-in, used until a GLB exists)
 *     └ model (GLB/GLTF from public/models/<id>.glb, auto-fitted, never distorted)
 *   wheels : spin and follow suspension travel; front wheels steer
 *
 * Replacing the placeholder with a real model never touches the vehicle controller.
 */
export class VehicleVisual {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private placeholder = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private modelWheels: Array<THREE.Object3D | null> = [null, null, null, null];
  private wheels: THREE.Object3D[] = [];
  private lean = new THREE.Vector2(); // x = pitch, y = roll (smoothed)
  private squash = 0;
  private ghostMats: THREE.Material[] = [];
  readonly marker: THREE.Object3D | null;

  constructor(readonly cfg: VehicleConfig, isPlayer: boolean) {
    this.root.name = `vehicle-${cfg.id}`;
    this.root.add(this.body);
    this.body.add(this.placeholder);
    buildPlaceholder(cfg, this.placeholder);
    this.placeholder.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        this.ghostMats.push((o as THREE.Mesh).material as THREE.Material);
      }
    });
    // Wheels (chunky stone/iron drums in the spirit of the reference sheets).
    const tyre = new THREE.MeshLambertMaterial({ color: 0x3b3632, flatShading: true });
    const rim = new THREE.MeshLambertMaterial({ color: 0xb07a3a, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Group();
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(cfg.wheelRadius, cfg.wheelRadius, 0.62, 10), tyre);
      drum.rotation.z = Math.PI / 2;
      drum.castShadow = true;
      w.add(drum);
      for (const side of [-1, 1]) {
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(cfg.wheelRadius * 0.55, cfg.wheelRadius * 0.55, 0.08, 8), rim);
        hub.rotation.z = Math.PI / 2;
        hub.position.x = side * 0.33;
        w.add(hub);
      }
      // A block on the tread so rotation is visible.
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.14, 0.3), rim);
      lug.position.y = cfg.wheelRadius;
      w.add(lug);
      this.wheels.push(w);
      this.root.add(w);
    }
    this.marker = isPlayer ? playerMarker() : null;
    if (this.marker) this.root.add(this.marker);
  }

  /** Try to load `cfg.model.url`; keep the placeholder if it doesn't exist. */
  async loadModel(): Promise<boolean> {
    const mc = this.cfg.model;
    if (!mc) return false;
    try {
      const res = await fetch(mc.url);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html')) return false; // dev server SPA fallback = missing
      const buf = await res.arrayBuffer();
      const gltf = await new GLTFLoader().parseAsync(buf, mc.url.replace(/[^/]*$/, ''));
      const model = gltf.scene;
      model.rotation.y = mc.rotationY ?? 0;
      model.updateMatrixWorld(true);
      // Uniform fit to chassis length (never non-uniform → never distorted).
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const targetLen = this.cfg.halfExtents.z * 2 + this.cfg.wheelRadius * 1.2;
      const scale = typeof mc.scale === 'number' ? mc.scale : targetLen / Math.max(size.z, 0.001);
      const wrapper = new THREE.Group();
      wrapper.add(model);
      wrapper.scale.setScalar(scale);
      const center = box.getCenter(new THREE.Vector3());
      // Sit the model's lowest point on the ground at rest height.
      const groundY = this.restGroundOffset();
      model.position.set(-center.x, -box.min.y, -center.z);
      wrapper.position.set(mc.offset?.x ?? 0, groundY + (mc.offset?.y ?? 0), mc.offset?.z ?? 0);
      wrapper.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      if (mc.wheelNodes) {
        const names = [mc.wheelNodes.frontLeft, mc.wheelNodes.frontRight, mc.wheelNodes.rearLeft, mc.wheelNodes.rearRight];
        this.modelWheels = names.map((n) => (n ? model.getObjectByName(n) ?? null : null));
      }
      this.model = wrapper;
      this.body.add(wrapper);
      this.placeholder.visible = false;
      // The model has its own wheels.
      for (const w of this.wheels) w.visible = false;
      return true;
    } catch (err) {
      console.warn(`[VehicleVisual] could not load ${mc.url}:`, err);
      return false;
    }
  }

  /** Where the ground is (chassis space) when the car rests on flat ground. */
  private restGroundOffset(): number {
    const c = this.cfg;
    const staticCompression = (c.mass * 20) / 4 / c.suspStiffness;
    return c.wheelMountY - (c.suspRest - staticCompression) - c.wheelRadius;
  }

  update(v: Vehicle, alpha: number, dt: number, time: number): void {
    const visible = v.respawnTimer <= 0;
    this.root.visible = visible;
    if (!visible) return;
    this.root.position.lerpVectors(v.prevPos, v.pos, alpha);
    this.root.quaternion.slerpQuaternions(v.prevQuat, v.quat, alpha);

    // Cosmetic weight transfer from acceleration in chassis space.
    const ax = (v.vel.x - v.prevVel.x) * 60, ay = (v.vel.y - v.prevVel.y) * 60, az = (v.vel.z - v.prevVel.z) * 60;
    const long = ax * v.fwd.x + ay * v.fwd.y + az * v.fwd.z;
    const lat = ax * v.right.x + ay * v.right.y + az * v.right.z;
    const k = 1 - Math.exp(-dt * 8);
    const grounded = v.grounded;
    this.lean.x += ((grounded ? clamp(-long * 0.006, -0.08, 0.08) : 0) - this.lean.x) * k;
    this.lean.y += ((grounded ? clamp(lat * 0.007, -0.1, 0.1) : 0) - this.lean.y) * k;
    this.body.rotation.set(this.lean.x, 0, this.lean.y);
    // Landing squash.
    if (v.lastLanding && v.lastLanding.time < dt * 1.5) this.squash = v.lastLanding.quality === 'hard' ? 0.22 : 0.12;
    this.squash *= Math.exp(-dt * 7);
    this.body.scale.set(1 + this.squash * 0.4, 1 - this.squash, 1 + this.squash * 0.2);

    // Wheels follow suspension and spin.
    v.wheels.forEach((w, i) => {
      const obj = this.wheels[i];
      obj.position.set(w.local.x, w.local.y - w.visualLength, w.local.z);
      obj.rotation.set(w.spin, w.front ? -v.steer * 0.45 : 0, 0, 'YXZ');
      const mw = this.modelWheels[i];
      if (mw) {
        mw.rotation.x = w.spin;
        if (w.front) mw.rotation.y = -v.steer * 0.45;
      }
    });

    // Ghost flicker after respawn.
    const ghost = v.ghostTime > 0;
    const on = !ghost || Math.floor(time * 12) % 2 === 0;
    this.body.visible = on;
    for (const w of this.wheels) w.visible = on && !this.model;
    if (this.marker) {
      this.marker.position.set(0, 3.4 + Math.sin(time * 4) * 0.25, 0);
      this.marker.quaternion.copy(this.root.quaternion).invert();
    }
  }
}

function clamp(x: number, a: number, b: number) {
  return x < a ? a : x > b ? b : x;
}

function playerMarker(): THREE.Object3D {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0x3cf0ff }));
  cone.rotation.x = Math.PI;
  g.add(cone);
  return g;
}

/**
 * Deliberately simple stand-ins that hint at each reference vehicle's silhouette
 * (crest / fangs / shell / tusks) so racers are distinguishable in greybox.
 * They are NOT the final art — drop a GLB in public/models/ to replace them.
 */
function buildPlaceholder(cfg: VehicleConfig, g: THREE.Group): void {
  const he = cfg.halfExtents;
  const main = new THREE.MeshLambertMaterial({ color: cfg.color, flatShading: true });
  const accent = new THREE.MeshLambertMaterial({ color: cfg.accent, flatShading: true });
  const bronze = new THREE.MeshLambertMaterial({ color: 0xa8743a, flatShading: true });
  const bone = new THREE.MeshLambertMaterial({ color: 0xeee3c8, flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff7a22 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  // Common frame.
  add(new THREE.BoxGeometry(he.x * 1.6, he.y * 1.2, he.z * 2), bronze, 0, -0.05, 0);

  switch (cfg.id) {
    case 'cindercrest': {
      add(new THREE.BoxGeometry(he.x * 1.3, he.y * 1.6, he.z * 1.5), main, 0, 0.35, -0.2);
      // Swept crest (the design's signature).
      const crest = add(new THREE.TorusGeometry(1.6, 0.28, 5, 12, Math.PI * 0.75), main, 0, 0.9, 0.6, 0, Math.PI / 2, 0.35);
      crest.scale.set(1, 1, 0.8);
      add(new THREE.BoxGeometry(0.1, 0.12, 2.0), glow, 0, 1.55, 0.55, 0.35, 0, 0);
      // Twin rear turbines.
      for (const s of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.42, 0.5, 1.4, 10), main, s * 0.62, 0.55, -1.7, Math.PI / 2, 0, 0);
        add(new THREE.CircleGeometry(0.36, 10), glow, s * 0.62, 0.55, -2.41, 0, Math.PI, 0);
      }
      break;
    }
    case 'saberspring': {
      add(new THREE.BoxGeometry(he.x * 1.4, he.y * 1.5, he.z * 1.6), main, 0, 0.35, -0.1);
      // Cat head + sabre fangs at the front.
      add(new THREE.BoxGeometry(1.5, 0.9, 1.0), main, 0, 0.55, 2.0);
      for (const s of [-1, 1]) {
        add(new THREE.ConeGeometry(0.16, 1.3, 6), bone, s * 0.45, -0.05, 2.35, Math.PI, 0, 0);
        add(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 6), bronze, s * 0.5, 1.25, -1.2);
      }
      add(new THREE.BoxGeometry(1.8, 0.1, 0.4), accent, 0, 0.95, 0.4);
      break;
    }
    case 'shellfort': {
      const shell = add(new THREE.SphereGeometry(1.45, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), main, 0, 0.2, -0.2);
      shell.scale.set(1, 0.85, 1.35);
      add(new THREE.BoxGeometry(1.0, 0.5, 1.0), accent, 0, 0.95, -0.3);
      // Turtle head on a neck.
      add(new THREE.CylinderGeometry(0.35, 0.42, 1.1, 8), bone, 0, 0.45, 1.9, Math.PI / 2 - 0.35, 0, 0);
      add(new THREE.SphereGeometry(0.5, 8, 6), bone, 0, 0.7, 2.45);
      add(new THREE.CylinderGeometry(0.13, 0.13, 1.2, 6), bronze, -0.5, 1.5, -1.3);
      break;
    }
    case 'tuskroller': {
      const hump = add(new THREE.BoxGeometry(he.x * 1.6, he.y * 2.6, he.z * 1.5), main, 0, 0.8, 0.1);
      hump.scale.set(1, 1, 1);
      add(new THREE.BoxGeometry(1.6, 1.2, 0.9), main, 0, 1.05, 1.75);
      add(new THREE.BoxGeometry(0.2, 0.5, 1.3), accent, 0, 1.55, 1.2);
      for (const s of [-1, 1]) {
        add(new THREE.TorusGeometry(0.75, 0.13, 5, 10, Math.PI * 0.9), bone, s * 0.55, 0.25, 2.3, 0, Math.PI / 2, Math.PI * 1.05);
        add(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 6), bronze, s * 0.45, 1.8, -1.4);
      }
      break;
    }
    default:
      add(new THREE.BoxGeometry(he.x * 1.4, he.y * 1.6, he.z * 1.6), main, 0, 0.35, 0);
  }
}
