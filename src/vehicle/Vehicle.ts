import * as THREE from 'three';
import { RAPIER, PhysicsWorld, VEHICLE_GROUPS, GHOST_GROUPS, FIXED_DT } from '../physics/PhysicsWorld';
import type { VehicleConfig } from './VehicleConfig';
import type { SurfaceId } from '../track/SurfaceManager';

/** Resolves which surface a wheel is touching from the contact point and collider. */
export type SurfaceResolver = (x: number, y: number, z: number, collider: RAPIER.Collider) => SurfaceId;

export interface WheelState {
  /** Mount point in chassis space. */
  local: THREE.Vector3;
  front: boolean;
  left: boolean;
  hit: boolean;
  /** Suspension compression in metres (0 = fully extended). */
  compression: number;
  prevCompression: number;
  /** Ground contact point and normal (world). */
  point: THREE.Vector3;
  normal: THREE.Vector3;
  surface: SurfaceId;
  /** Visual-only: current wheel spin angle and suspension length for animation. */
  spin: number;
  visualLength: number;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * One racer's physical body: an invisible chassis box with four raycast wheels.
 * This class knows nothing about rendering — the visual (placeholder or GLB) reads
 * its transform and wheel state each frame.
 */
export class Vehicle {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly wheels: WheelState[] = [];
  /** Principal inertia (chassis space), needed by the controller for torque maths. */
  readonly inertia: { x: number; y: number; z: number };
  /** Deterministic per-vehicle random stream (keeps headless sims reproducible). */
  private seed: number;

  // ---- Per-step derived state (world space) ----
  readonly pos = new THREE.Vector3();
  readonly quat = new THREE.Quaternion();
  readonly vel = new THREE.Vector3();
  readonly angVel = new THREE.Vector3();
  readonly fwd = new THREE.Vector3(0, 0, 1);
  readonly up = new THREE.Vector3(0, 1, 0);
  readonly right = new THREE.Vector3(-1, 0, 0);
  readonly groundNormal = new THREE.Vector3(0, 1, 0);
  /** Previous-step transform, for render interpolation. */
  readonly prevPos = new THREE.Vector3();
  readonly prevQuat = new THREE.Quaternion();
  readonly prevVel = new THREE.Vector3();

  groundedWheels = 0;
  surface: SurfaceId = 'dirt';
  /** Signed speed along the chassis forward direction (m/s). */
  forwardSpeed = 0;
  /** Sideways slip speed (m/s) — used for slide FX. */
  slipSpeed = 0;
  airTime = 0;

  // ---- Gameplay state ----
  steer = 0; // smoothed steering (-1 left .. +1 right)
  nitroCharges = 0;
  nitroTime = 0;
  /** Seconds of reduced grip after a hard hit / bad landing (causes slides and spins). */
  staggerTime = 0;
  /** Seconds of ghosting after a respawn (no car-to-car collisions). */
  ghostTime = 0;
  /** Catch-up multiplier on engine force (1 = none). */
  catchUp = 1;
  /** Frozen during countdown / after finishing. */
  frozen = false;
  /** Last landing classification, for HUD/FX. */
  lastLanding: { quality: 'clean' | 'rough' | 'hard'; time: number } | null = null;
  /** Respawn sequence timer (>0 = hidden and waiting to reappear). */
  respawnTimer = 0;

  constructor(
    readonly index: number,
    readonly cfg: VehicleConfig,
    private physics: PhysicsWorld,
    position: THREE.Vector3,
    heading: THREE.Quaternion,
  ) {
    const he = cfg.halfExtents;
    this.seed = 1234567 + index * 7919;
    this.inertia = boxInertia(cfg.mass, he.x, he.y + 0.25, he.z, cfg.inertiaScale);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: heading.x, y: heading.y, z: heading.z, w: heading.w })
      .setLinearDamping(0.05)
      .setAngularDamping(0.6)
      .setCcdEnabled(true)
      .setCanSleep(false)
      // Explicit mass properties: low centre of mass, box inertia scaled for "weight".
      .setAdditionalMassProperties(
        cfg.mass,
        { x: 0, y: cfg.comY, z: 0 },
        this.inertia,
        { x: 0, y: 0, z: 0, w: 1 },
      );
    this.body = physics.world.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.roundCuboid(he.x - 0.15, he.y - 0.15, he.z - 0.15, 0.15)
      .setDensity(0)
      .setFriction(0.25)
      .setRestitution(0.25)
      .setCollisionGroups(VEHICLE_GROUPS)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(cfg.mass * 12);
    this.collider = physics.world.createCollider(colDesc, this.body);
    physics.tag(this.collider, { kind: 'vehicle', index });

    const mounts: Array<[number, number, boolean, boolean]> = [
      [cfg.wheelX, cfg.wheelZFront, true, true],
      [-cfg.wheelX, cfg.wheelZFront, true, false],
      [cfg.wheelX, cfg.wheelZRear, false, true],
      [-cfg.wheelX, cfg.wheelZRear, false, false],
    ];
    for (const [x, z, front, left] of mounts) {
      this.wheels.push({
        local: new THREE.Vector3(x, cfg.wheelMountY, z),
        front,
        left,
        hit: false,
        compression: 0,
        prevCompression: 0,
        point: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 1, 0),
        surface: 'dirt',
        spin: 0,
        visualLength: cfg.suspRest,
      });
    }
    this.nitroCharges = cfg.nitroStartCharges;
    this.readState();
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
  }

  /** Deterministic random number in [0, 1). */
  random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get grounded(): boolean {
    return this.groundedWheels > 0;
  }

  get speed(): number {
    return this.vel.length();
  }

  get nitroActive(): boolean {
    return this.nitroTime > 0;
  }

  /** Copy the rigid body state into cached THREE vectors. */
  readState(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    const lv = this.body.linvel();
    const av = this.body.angvel();
    this.pos.set(t.x, t.y, t.z);
    this.quat.set(r.x, r.y, r.z, r.w);
    this.vel.set(lv.x, lv.y, lv.z);
    this.angVel.set(av.x, av.y, av.z);
    this.fwd.set(0, 0, 1).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    this.right.crossVectors(this.fwd, this.up).normalize();
    this.forwardSpeed = this.vel.dot(this.fwd);
    this.slipSpeed = this.vel.dot(this.right);
  }

  /** Remember the transform before a physics step (render interpolation). */
  storePrevious(): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.prevVel.copy(this.vel);
  }

  /** Cast the four suspension rays and record contacts. */
  senseGround(resolveSurface: SurfaceResolver): void {
    const cfg = this.cfg;
    const maxLen = cfg.suspRest + cfg.wheelRadius;
    let count = 0;
    const n = this.groundNormal.set(0, 0, 0);
    const dx = -this.up.x, dy = -this.up.y, dz = -this.up.z;
    for (const w of this.wheels) {
      _v.copy(w.local).applyQuaternion(this.quat).add(this.pos);
      w.prevCompression = w.compression;
      const hit = this.physics.castTerrainRay(_v.x, _v.y, _v.z, dx, dy, dz, maxLen);
      if (hit) {
        w.hit = true;
        w.compression = Math.max(0, maxLen - hit.distance);
        w.point.set(_v.x + dx * hit.distance, _v.y + dy * hit.distance, _v.z + dz * hit.distance);
        w.normal.set(hit.nx, hit.ny, hit.nz);
        w.surface = resolveSurface(w.point.x, w.point.y, w.point.z, hit.collider);
        w.visualLength = hit.distance - cfg.wheelRadius;
        n.add(w.normal);
        count++;
      } else {
        w.hit = false;
        w.compression = 0;
        w.visualLength = cfg.suspRest;
      }
    }
    this.groundedWheels = count;
    if (count > 0) n.normalize();
    else n.copy(this.up);
    this.surface = this.dominantSurface();
  }

  private dominantSurface(): SurfaceId {
    // The "worst" contact wins ties so one wheel in the mud already matters.
    const counts = new Map<SurfaceId, number>();
    let best: SurfaceId = this.surface;
    let bestCount = 0;
    for (const w of this.wheels) {
      if (!w.hit) continue;
      const c = (counts.get(w.surface) ?? 0) + 1;
      counts.set(w.surface, c);
      if (c > bestCount) {
        bestCount = c;
        best = w.surface;
      }
    }
    return best;
  }

  /** World-space position of a chassis-local point. */
  localToWorld(local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(local).applyQuaternion(this.quat).add(this.pos);
  }

  /** Instantly place the vehicle (used by grid setup and recovery). */
  teleport(position: THREE.Vector3, rotation: THREE.Quaternion, forwardSpeed = 0): void {
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.body.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, true);
    _v.set(0, 0, forwardSpeed).applyQuaternion(rotation);
    this.body.setLinvel({ x: _v.x, y: _v.y, z: _v.z }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true);
    this.body.resetTorques(true);
    for (const w of this.wheels) {
      w.compression = 0;
      w.prevCompression = 0;
    }
    this.steer = 0;
    this.staggerTime = 0;
    this.airTime = 0;
    this.readState();
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.prevVel.copy(this.vel);
  }

  setGhost(seconds: number): void {
    this.ghostTime = seconds;
    this.collider.setCollisionGroups(GHOST_GROUPS);
  }

  /** Per-step timers that are not part of the drive model. */
  tickTimers(dt: number = FIXED_DT): void {
    if (this.ghostTime > 0) {
      this.ghostTime -= dt;
      if (this.ghostTime <= 0) {
        this.ghostTime = 0;
        this.collider.setCollisionGroups(VEHICLE_GROUPS);
      }
    }
    if (this.staggerTime > 0) this.staggerTime = Math.max(0, this.staggerTime - dt);
    if (this.nitroTime > 0) this.nitroTime = Math.max(0, this.nitroTime - dt);
  }

  /** Heading-only rotation (yaw) of the chassis — handy for AI and resets. */
  yawQuaternion(out: THREE.Quaternion = _q): THREE.Quaternion {
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    return out.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  }
}

function boxInertia(m: number, hx: number, hy: number, hz: number, scale: number) {
  const x = 2 * hx, y = 2 * hy, z = 2 * hz;
  return {
    x: (m / 12) * (y * y + z * z) * scale,
    y: (m / 12) * (x * x + z * z) * scale,
    z: (m / 12) * (x * x + y * y) * scale,
  };
}
