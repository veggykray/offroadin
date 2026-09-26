import * as THREE from 'three';
import { initPhysics, PhysicsWorld, FIXED_DT, RAPIER } from '../physics/PhysicsWorld';
import { buildTrack, type BuiltTrack } from '../track/TrackBuilder';
import { TRACK1, type TrackDef } from '../track/TrackData';
import type { Track } from '../track/Track';
import { reverseTrackDef } from '../track/reverseTrack';
import type { SurfaceId } from '../track/SurfaceManager';
import { Vehicle } from '../vehicle/Vehicle';
import { VEHICLES, type VehicleConfig } from '../vehicle/VehicleConfig';
import { stepVehicle, NO_INPUT, type DriveInput, type VehicleEvent } from '../vehicle/VehicleController';
import { AIController, PERSONALITIES, RacingLine, type AIPersonality } from '../vehicle/AIController';
import { RaceManager, type RaceEvent } from './RaceManager';
import { PickupManager, type PickupEvent } from '../pickups/PickupManager';

export type ResetReason = 'flipped' | 'fell' | 'stuck' | 'offmap' | 'lost' | 'manual';

export type SimEvent =
  | { type: 'vehicle'; racer: number; event: VehicleEvent }
  | { type: 'race'; event: RaceEvent }
  | { type: 'pickup'; event: PickupEvent }
  | { type: 'collision'; a: number; b: number; strength: number; x: number; y: number; z: number }
  | { type: 'respawnStart'; racer: number; reason: ResetReason; x: number; y: number; z: number }
  | { type: 'respawnEnd'; racer: number; x: number; y: number; z: number };

/** One entry in the starting line-up (grid slot order: 0 = inside of corner 1). */
export interface RosterEntry {
  vehicle: string;
  personality: AIPersonality['name'];
}

export const DEFAULT_ROSTER: RosterEntry[] = [
  { vehicle: 'saberspring', personality: 'aggressive' },
  { vehicle: 'cindercrest', personality: 'balanced' },
  { vehicle: 'tuskroller', personality: 'balanced' },
  { vehicle: 'shellfort', personality: 'cautious' },
];

export interface SimOptions {
  track?: TrackDef;
  /** Grid slot the human drives, or null for an all-AI race (demo / headless tests). */
  playerIndex: number | null;
  roster?: RosterEntry[];
  reverse?: boolean;
  /** Subtle catch-up (slightly more engine force when well behind). */
  catchUp?: boolean;
  laps?: number;
}

/**
 * The whole game world WITHOUT rendering: physics, track, racers, AI, race rules,
 * pickups and recovery. The browser `Game` wraps this; `tools/headlessRace.ts` runs
 * it in Node to test that AI can complete races.
 */
export class Simulation {
  readonly physics: PhysicsWorld;
  readonly built: BuiltTrack;
  readonly track: Track;
  readonly vehicles: Vehicle[] = [];
  readonly ais: AIController[] = [];
  readonly lines = new Map<'safe' | 'shortcut', RacingLine>();
  race!: RaceManager;
  readonly pickups: PickupManager;
  readonly roster: RosterEntry[];
  playerIndex: number | null;
  playerInput: DriveInput = { ...NO_INPUT };
  catchUp: boolean;
  time = 0;
  private flipTime: number[] = [];
  private lostTime: number[] = [];
  private pendingSpawn: Array<{ pos: THREE.Vector3; rot: THREE.Quaternion } | null> = [];

  static async create(opts: SimOptions): Promise<Simulation> {
    await initPhysics();
    return new Simulation(opts);
  }

  private constructor(private opts: SimOptions) {
    this.physics = new PhysicsWorld();
    const def = opts.track ?? TRACK1;
    this.built = buildTrack(opts.reverse ? reverseTrackDef(def) : def, this.physics);
    this.track = this.built.track;
    this.roster = opts.roster ?? DEFAULT_ROSTER;
    this.playerIndex = opts.playerIndex;
    this.catchUp = opts.catchUp ?? true;
    this.pickups = new PickupManager(this.track);

    const cfg0 = VEHICLES[this.roster[0].vehicle];
    const obstacles = this.built.decor
      .filter((d) => d.def.kind === 'boulder' && d.def.solid)
      .map((d) => ({ x: d.position.x, z: d.position.z, r: 1.1 * d.scale }));
    for (const r of this.track.routes) {
      this.lines.set(r.id, new RacingLine(r, this.track, cfg0.maxLateralAccel * 0.82, cfg0.topSpeed, cfg0.brakeDecel * 0.55, obstacles));
    }

    const slots = this.track.gridSlots();
    this.roster.forEach((entry, i) => {
      const cfg: VehicleConfig = VEHICLES[entry.vehicle];
      const slot = slots[i % slots.length];
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), slot.yaw);
      const pos = slot.position.clone();
      pos.y = this.track.groundHeight(pos.x, pos.z) + 1.1;
      const v = new Vehicle(i, cfg, this.physics, pos, rot);
      this.vehicles.push(v);
      this.ais.push(new AIController(v, PERSONALITIES[entry.personality], this.lines, this.track));
      this.flipTime.push(0);
      this.lostTime.push(0);
      this.pendingSpawn.push(null);
    });
    this.physics.world.step(); // make colliders queryable
    this.startRace();
  }

  private startRace(): void {
    const names = this.vehicles.map((v) => v.cfg.displayName);
    this.race = new RaceManager(this.track, this.vehicles, names, this.playerIndex, this.opts.laps);
    for (const v of this.vehicles) v.frozen = true;
    for (const ai of this.ais) ai.holdGridLane(4);
  }

  /** Put everyone back on the grid and restart the countdown. */
  restart(): void {
    const slots = this.track.gridSlots();
    this.vehicles.forEach((v, i) => {
      const slot = slots[i % slots.length];
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), slot.yaw);
      const pos = slot.position.clone();
      pos.y = this.track.groundHeight(pos.x, pos.z) + 1.1;
      v.body.setEnabled(true);
      v.respawnTimer = 0;
      v.teleport(pos, rot, 0);
      v.nitroCharges = v.cfg.nitroStartCharges;
      v.nitroTime = 0;
      v.ghostTime = 0.01;
      this.flipTime[i] = 0;
      this.lostTime[i] = 0;
      this.pendingSpawn[i] = null;
    });
    this.pickups.reset();
    this.time = 0;
    this.startRace();
  }

  private resolveSurface = (x: number, y: number, z: number, collider: RAPIER.Collider): SurfaceId => {
    const tag = this.physics.tagOf(collider);
    if (tag && (tag.kind === 'bridge' || tag.kind === 'static')) return tag.surface as SurfaceId;
    return this.track.surfaceAt(x, y, z);
  };

  /** Advance the world by one fixed step. */
  step(dt: number = FIXED_DT): SimEvent[] {
    const events: SimEvent[] = [];
    this.time += dt;
    const race = this.race;
    const racing = race.phase !== 'countdown';
    const leader = race.leaderProgress;

    // ---- Drivers → forces ----
    this.vehicles.forEach((v, i) => {
      v.storePrevious();
      if (v.respawnTimer > 0) return;
      const state = race.racers[i];
      v.frozen = !racing;
      const behind = leader - state.totalProgress;
      v.catchUp = this.catchUp ? 1 + 0.07 * clamp01((behind - 25) / 120) : 1;
      let input: DriveInput;
      const ai = this.ais[i];
      if (i === this.playerIndex && !state.finished) input = this.playerInput;
      else {
        input = ai.update(dt, state, this.vehicles, behind);
        if (state.finished) input = { ...input, throttle: input.throttle * 0.5, nitro: false };
      }
      v.senseGround(this.resolveSurface);
      for (const e of stepVehicle(v, input, dt)) events.push({ type: 'vehicle', racer: i, event: e });
    });

    this.physics.step();

    // ---- Collisions (strong hits stagger both cars → slides / spins) ----
    this.physics.events.drainContactForceEvents((e) => {
      const c1 = this.physics.world.getCollider(e.collider1());
      const c2 = this.physics.world.getCollider(e.collider2());
      const t1 = c1 && this.physics.tagOf(c1);
      const t2 = c2 && this.physics.tagOf(c2);
      const a = t1 && t1.kind === 'vehicle' ? t1.index : -1;
      const b = t2 && t2.kind === 'vehicle' ? t2.index : -1;
      if (a < 0 && b < 0) return;
      const va = a >= 0 ? this.vehicles[a] : this.vehicles[b];
      const strength = (e.totalForceMagnitude() * dt) / va.cfg.mass; // ≈ Δv in m/s
      if (a >= 0 && b >= 0) {
        for (const k of [a, b]) {
          if (strength > 2.5) this.vehicles[k].staggerTime = Math.max(this.vehicles[k].staggerTime, Math.min(0.7, 0.06 * strength));
        }
      }
      if (strength > 1.5) {
        const p = va.pos;
        events.push({ type: 'collision', a, b, strength, x: p.x, y: p.y, z: p.z });
      }
    });
    this.physics.events.clear();

    for (const v of this.vehicles) {
      v.readState();
      v.tickTimers(dt);
    }

    // ---- Race rules, pickups ----
    for (const e of race.update(dt, this.vehicles)) events.push({ type: 'race', event: e });
    for (const e of this.pickups.update(dt, this.vehicles)) events.push({ type: 'pickup', event: e });

    // ---- Recovery: flipped / fell / stuck / lost ----
    this.vehicles.forEach((v, i) => this.checkRecovery(v, i, dt, events));
    return events;
  }

  requestReset(i: number, reason: ResetReason = 'manual'): SimEvent | null {
    const v = this.vehicles[i];
    if (v.respawnTimer > 0) return null;
    const state = this.race.racers[i];
    const tr = state.tracker;
    // Respawn a little behind where we were, on the same road, centred and facing forward.
    let path = tr.path;
    let s = tr.s - 8;
    if (s < 0 && !path.closed) {
      path = this.track.main;
      s = this.track.splitS + s;
    }
    const smp = path.sampleAt(s);
    const pos = new THREE.Vector3(smp.x, 0, smp.z);
    // Don't drop onto another car.
    for (const o of this.vehicles) {
      if (o !== v && o.pos.distanceTo(pos) < 4 && smp.halfWidth > 4) {
        pos.x += smp.lx * 3;
        pos.z += smp.lz * 3;
      }
    }
    pos.y = Math.max(smp.y, this.track.groundHeight(pos.x, pos.z)) + 1.3;
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(smp.tx, smp.tz));
    this.pendingSpawn[i] = { pos, rot };
    v.respawnTimer = 0.55;
    v.body.setEnabled(false);
    state.respawns++;
    this.flipTime[i] = 0;
    this.lostTime[i] = 0;
    return { type: 'respawnStart', racer: i, reason, x: v.pos.x, y: v.pos.y, z: v.pos.z };
  }

  private checkRecovery(v: Vehicle, i: number, dt: number, events: SimEvent[]): void {
    if (v.respawnTimer > 0) {
      v.respawnTimer -= dt;
      if (v.respawnTimer <= 0) {
        const sp = this.pendingSpawn[i]!;
        v.body.setEnabled(true);
        v.teleport(sp.pos, sp.rot, 7);
        v.setGhost(1.6);
        this.race.racers[i].tracker.snap(sp.pos.x, sp.pos.z);
        this.ais[i].resync();
        this.pendingSpawn[i] = null;
        events.push({ type: 'respawnEnd', racer: i, x: sp.pos.x, y: sp.pos.y, z: sp.pos.z });
      }
      return;
    }
    const tr = this.race.racers[i].tracker;
    const smp = tr.path.samples[tr.index];
    const b = this.track.def.bounds;
    let reason: ResetReason | null = null;

    if (v.pos.y < -18 || v.pos.x < b.minX - 5 || v.pos.x > b.maxX + 5 || v.pos.z < b.minZ - 5 || v.pos.z > b.maxZ + 5) reason = 'offmap';
    const level = this.track.waterLevelAt(v.pos.x, v.pos.z);
    if (!reason && level !== null && v.pos.y < level + 0.2 && v.pos.y < smp.y - 1.5) reason = 'fell'; // in deep water
    if (!reason && (smp.bridge || level !== null) && v.pos.y < smp.y - this.track.def.fallDepth) reason = 'fell';

    this.flipTime[i] = v.up.y < 0.3 ? this.flipTime[i] + dt : 0;
    if (!reason && this.flipTime[i] > (v.speed < 4 ? 1.0 : 2.2)) reason = 'flipped';

    this.lostTime[i] = tr.outside > 16 ? this.lostTime[i] + dt : 0;
    if (!reason && this.lostTime[i] > 4) reason = 'lost';

    if (!reason && i !== this.playerIndex && this.ais[i].hopelessTime > 5) reason = 'stuck';
    if (!reason && i === this.playerIndex && this.race.phase === 'racing') {
      // Player wedged: holding throttle but not moving for a while.
      const inp = this.playerInput;
      this.ais[i].hopelessTime = (inp.throttle > 0 || inp.brake > 0) && v.speed < 1 ? this.ais[i].hopelessTime + dt : 0;
      if (this.ais[i].hopelessTime > 4) reason = 'stuck';
    }
    if (reason) {
      const e = this.requestReset(i, reason);
      if (e) events.push(e);
    }
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
