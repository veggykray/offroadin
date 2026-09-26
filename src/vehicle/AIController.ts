import type { Route, Track } from '../track/Track';
import { SURFACES } from '../track/SurfaceManager';
import type { Vehicle } from './Vehicle';
import type { DriveInput } from './VehicleController';
import type { RacerState } from '../game/RaceManager';

export interface AIPersonality {
  name: 'cautious' | 'balanced' | 'aggressive';
  /** Multiplier on the cornering speed the AI believes is safe. */
  cornerSpeed: number;
  /** Multiplier on straight-line target speed (lets cautious drivers lift a bit). */
  straightSpeed: number;
  /** Probability of choosing the shortcut on a given lap. */
  shortcutChance: number;
  /** Target speed on the bridge (m/s). */
  bridgeSpeed: number;
  /** 0..1 how readily it uses nitro on straights. */
  nitroEagerness: number;
  /** 0..1 willingness to hold its line / lean on rivals instead of avoiding. */
  aggression: number;
  /** Steering precision noise (small wobble). */
  sloppiness: number;
}

export const PERSONALITIES: Record<AIPersonality['name'], AIPersonality> = {
  cautious: { name: 'cautious', cornerSpeed: 0.9, straightSpeed: 0.97, shortcutChance: 0.2, bridgeSpeed: 15, nitroEagerness: 0.35, aggression: 0.1, sloppiness: 0.02 },
  balanced: { name: 'balanced', cornerSpeed: 0.97, straightSpeed: 1, shortcutChance: 0.45, bridgeSpeed: 18, nitroEagerness: 0.6, aggression: 0.45, sloppiness: 0.03 },
  aggressive: { name: 'aggressive', cornerSpeed: 1.02, straightSpeed: 1, shortcutChance: 0.7, bridgeSpeed: 21, nitroEagerness: 0.9, aggression: 0.9, sloppiness: 0.045 },
};

/** Precomputed racing line + speed profile for one route. */
export class RacingLine {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly offset: Float32Array;
  readonly speed: Float32Array;
  readonly n: number;

  constructor(
    readonly route: Route,
    track: Track,
    maxLat: number,
    topSpeed: number,
    brakeDecel: number,
    readonly obstacles: Array<{ x: number; z: number; r: number }> = [],
  ) {
    const pts = route.points;
    const n = (this.n = pts.length);
    this.offset = new Float32Array(n);
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.speed = new Float32Array(n);
    const margin = (i: number) => {
      const p = pts[i];
      if (p.bridge) return Math.max(0, p.halfWidth - 1.8);
      return Math.max(0, p.halfWidth - 3.0);
    };
    // Elastic-band smoothing → minimum-curvature line within the road edges.
    const off = this.offset;
    for (const k of [12, 8, 5, 3]) {
      for (let it = 0; it < 120; it++) {
        for (let i = 0; i < n; i++) {
          const a = pts[(i - k + n) % n], b = pts[(i + k) % n], c = pts[i];
          const oa = off[(i - k + n) % n], ob = off[(i + k) % n];
          const mx = (a.x + a.lx * oa + b.x + b.lx * ob) / 2;
          const mz = (a.z + a.lz * oa + b.z + b.lz * ob) / 2;
          const desired = (mx - c.x) * c.lx + (mz - c.z) * c.lz;
          const m = margin(i);
          off[i] = Math.max(-m, Math.min(m, off[i] + (desired - off[i]) * 0.5));
        }
      }
    }
    // Avoid mud patches on the racing line (push out of them where possible).
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      for (let tries = 0; tries < 8; tries++) {
        const x = p.x + p.lx * off[i], z = p.z + p.lz * off[i];
        if (!track.patchAt(x, z)) break;
        const m = margin(i);
        off[i] = Math.max(-m, Math.min(m, off[i] + (off[i] >= 0 ? -1.2 : 1.2)));
      }
    }
    // Steer the line clear of solid obstacles (boulders on the road), then re-smooth locally.
    const clearance = 2.6;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const m = margin(i);
        for (const o of obstacles) {
          const x = p.x + p.lx * off[i], z = p.z + p.lz * off[i];
          const d = Math.hypot(x - o.x, z - o.z);
          if (d > o.r + clearance + 4) continue;
          const oLat = (o.x - p.x) * p.lx + (o.z - p.z) * p.lz;
          const oAlong = Math.abs((o.x - p.x) * p.tx + (o.z - p.z) * p.tz);
          const need = o.r + clearance - oAlong * 0.25;
          if (need <= 0 || Math.abs(off[i] - oLat) >= need) continue;
          // Pass on whichever side has more room.
          const leftRoom = m - oLat, rightRoom = oLat + m;
          off[i] = leftRoom > rightRoom ? Math.min(m, oLat + need) : Math.max(-m, oLat - need);
        }
      }
      for (let it = 0; it < 30; it++) {
        for (let i = 0; i < n; i++) {
          const a = off[(i - 2 + n) % n], b = off[(i + 2) % n];
          const blocked = obstacles.some((o) => Math.hypot(pts[i].x - o.x, pts[i].z - o.z) < o.r + clearance + 8);
          if (!blocked) off[i] += ((a + b) / 2 - off[i]) * 0.3;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      this.x[i] = pts[i].x + pts[i].lx * off[i];
      this.z[i] = pts[i].z + pts[i].lz * off[i];
    }
    // Curvature of the line → max cornering speed.
    for (let i = 0; i < n; i++) {
      const a = (i - 4 + n) % n, b = (i + 4) % n;
      const ax = this.x[i] - this.x[a], az = this.z[i] - this.z[a];
      const bx = this.x[b] - this.x[i], bz = this.z[b] - this.z[i];
      const ang = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
      const ds = Math.hypot(ax, az) + Math.hypot(bx, bz);
      const k = ang / Math.max(ds * 0.5, 0.5);
      const surf = SURFACES[pts[i].surface];
      const lat = maxLat * surf.grip;
      let v = k > 1e-4 ? Math.sqrt(lat / k) : 999;
      v = Math.min(v, topSpeed * surf.topSpeed);
      this.speed[i] = v;
    }
    // Slow for dips/crests where the car would go light (vertical curvature).
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 5 + n) % n], b = pts[(i + 5) % n], c = pts[i];
      const vc = (a.y + b.y - 2 * c.y) / 25; // < 0 = crest
      if (vc < -0.004) this.speed[i] = Math.min(this.speed[i], Math.sqrt(20 / -vc) * 0.9);
    }
    // Backward pass: be able to brake in time.
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 2 * n; j >= 0; j--) {
        const i = j % n, nx = (i + 1) % n;
        const ds = Math.hypot(this.x[nx] - this.x[i], this.z[nx] - this.z[i]);
        const lim = Math.sqrt(this.speed[nx] ** 2 + 2 * brakeDecel * ds);
        if (lim < this.speed[i]) this.speed[i] = lim;
      }
    }
  }

  nearest(x: number, z: number, hint: number, window = 20): number {
    let best = hint, bd = Infinity;
    for (let k = -window; k <= window; k++) {
      const i = (hint + k + this.n) % this.n;
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  globalNearest(x: number, z: number): number {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.n; i++) {
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
}

/**
 * Computer driver. Produces the same DriveInput a human would — the car is fully
 * physical; the AI only steers, throttles, brakes and fires nitro.
 */
export class AIController {
  private lineId: 'safe' | 'shortcut' = 'safe';
  private index = 0;
  private laneBias = 0;
  private stuckTime = 0;
  private reverseTime = 0;
  private decidedLap = -1;
  private wobble = 0;
  /** Seconds the AI has been unable to make progress (Simulation may reset it). */
  hopelessTime = 0;
  debugTarget = { x: 0, z: 0 };

  constructor(
    readonly vehicle: Vehicle,
    readonly personality: AIPersonality,
    private lines: Map<'safe' | 'shortcut', RacingLine>,
    private track: Track,
  ) {
    this.index = this.line.globalNearest(vehicle.pos.x, vehicle.pos.z);
  }

  get line(): RacingLine {
    return this.lines.get(this.lineId) ?? this.lines.get('safe')!;
  }

  get routeId() {
    return this.lineId;
  }

  /** Re-acquire after a teleport. */
  resync(): void {
    this.index = this.line.globalNearest(this.vehicle.pos.x, this.vehicle.pos.z);
    this.stuckTime = 0;
    this.reverseTime = 0;
    this.hopelessTime = 0;
    this.laneBias = 0;
  }

  /** At the start, keep our own grid lane for a few seconds instead of all diving for one line. */
  holdGridLane(seconds: number): void {
    this.resync();
    const pt = this.line.route.points[this.index];
    const lat = (this.vehicle.pos.x - pt.x) * pt.lx + (this.vehicle.pos.z - pt.z) * pt.lz;
    this.gridLane = lat - this.line.offset[this.index];
    this.laneBias = this.gridLane;
    this.laneHold = seconds;
    this.laneHoldMax = seconds;
  }
  private gridLane = 0;
  private laneHold = 0;
  private laneHoldMax = 1;

  update(dt: number, me: RacerState, others: Vehicle[], leaderGap: number): DriveInput {
    const v = this.vehicle;
    const track = this.track;
    const p = this.personality;

    // ---- Route decision before the split (once per lap) ----
    if (this.lines.has('shortcut') && this.decidedLap !== me.lap) {
      const s = me.tracker.progress;
      if (!me.tracker.onShortcut && s > track.splitS - 140 && s < track.splitS - 40) {
        this.decidedLap = me.lap;
        // Trailing racers gamble a little more.
        const chance = Math.min(0.95, p.shortcutChance + (me.position >= 3 ? 0.12 : 0));
        const want: 'safe' | 'shortcut' = v.random() < chance ? 'shortcut' : 'safe';
        if (want !== this.lineId) {
          this.lineId = want;
          this.index = this.line.globalNearest(v.pos.x, v.pos.z);
        }
      }
    }
    // If physics put us on the other route, follow reality.
    const onSc = me.tracker.onShortcut;
    if (onSc && me.tracker.s > 18 && this.lineId !== 'shortcut' && this.lines.has('shortcut')) {
      this.lineId = 'shortcut';
      this.index = this.line.globalNearest(v.pos.x, v.pos.z);
    } else if (!onSc && this.lineId === 'shortcut' && me.tracker.outside < -1 && me.tracker.progress > track.splitS + 25 && me.tracker.progress < track.rejoinS - 5) {
      this.lineId = 'safe';
      this.index = this.line.globalNearest(v.pos.x, v.pos.z);
    }

    const line = this.line;
    this.index = line.nearest(v.pos.x, v.pos.z, this.index, 25);
    const speed = v.forwardSpeed;
    const n = line.n;

    // ---- Avoidance / aggression: shift lane around the car ahead ----
    let desiredBias = 0;
    const fx = v.fwd.x, fz = v.fwd.z;
    const fl = Math.hypot(fx, fz) || 1;
    for (const o of others) {
      if (o === v || o.respawnTimer > 0) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
      const ahead = (dx * fx + dz * fz) / fl;
      const side = (dx * fz - dz * fx) / fl; // + = to our left
      if (ahead > -2 && ahead < 14 && Math.abs(side) < 3.4) {
        const closing = speed - o.vel.dot(v.fwd);
        if (closing > -1) {
          const push = (1 - p.aggression * 0.7) * (3.4 - Math.abs(side));
          desiredBias += side >= 0 ? -push : push;
        }
      }
    }
    const pt = line.route.points[this.index];
    if (this.laneHold > 0) {
      if (!v.frozen) this.laneHold -= dt;
      desiredBias += this.gridLane * Math.min(1, (this.laneHold / this.laneHoldMax) * 1.6);
    }
    const room = Math.max(0, pt.halfWidth - 2.2 - Math.abs(line.offset[this.index]));
    desiredBias = Math.max(-room, Math.min(room, desiredBias));
    // Never let the lane offset steer us into a boulder the racing line avoids.
    for (const o of line.obstacles) {
      const ox = o.x - v.pos.x, oz = o.z - v.pos.z;
      const ahead = (ox * fx + oz * fz) / fl;
      if (ahead < -3 || ahead > 35) continue;
      const oi = line.nearest(o.x, o.z, this.index, 40);
      const op = line.route.points[oi];
      const oLat = (o.x - op.x) * op.lx + (o.z - op.z) * op.lz;
      const lineLat = line.offset[oi];
      const need = o.r + 2.4;
      if (Math.abs(lineLat + desiredBias - oLat) < need) {
        desiredBias = lineLat >= oLat ? Math.max(desiredBias, oLat + need - lineLat) : Math.min(desiredBias, oLat - need - lineLat);
      }
    }
    if (pt.bridge) desiredBias = 0;
    this.laneBias += (desiredBias - this.laneBias) * Math.min(1, dt * 2.5);

    // ---- Steering: pure pursuit on the racing line ----
    const look = 5 + Math.max(0, speed) * 0.42;
    const ti = (this.index + Math.round(look)) % n;
    const tpt = line.route.points[ti];
    const tx = line.x[ti] + tpt.lx * this.laneBias;
    const tz = line.z[ti] + tpt.lz * this.laneBias;
    this.debugTarget.x = tx;
    this.debugTarget.z = tz;
    const dx = tx - v.pos.x, dz = tz - v.pos.z;
    const heading = Math.atan2(v.fwd.x, v.fwd.z);
    let err = Math.atan2(dx, dz) - heading;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    // Positive err = target to the left → steer left (negative).
    this.wobble += (v.random() * 2 - 1) * p.sloppiness;
    this.wobble *= 0.97;
    const yawRate = v.angVel.y;
    let steer = -err * 2.4 + yawRate * 0.12 + this.wobble;
    steer = Math.max(-1, Math.min(1, steer));

    // ---- Speed: follow the profile a little ahead of us ----
    let target = 999;
    const ahead = Math.round(3 + Math.max(0, speed) * 0.15);
    for (let k = 0; k <= ahead; k++) target = Math.min(target, line.speed[(this.index + k) % n]);
    target *= target > 25 ? p.straightSpeed : p.cornerSpeed;
    // Bridge discipline.
    for (let k = 0; k < 30; k++) {
      const q = line.route.points[(this.index + k) % n];
      if (q.bridge) {
        target = Math.min(target, p.bridgeSpeed + k * 0.5);
        break;
      }
    }
    // Big heading error → slow down to get the nose round.
    if (Math.abs(err) > 0.6) target = Math.min(target, 12);

    let throttle = 0, brake = 0;
    if (speed < target - 1) throttle = 1;
    else if (speed < target + 0.5) throttle = 0.4;
    else if (speed > target + 2.5) brake = Math.min(1, (speed - target) / 8);

    // ---- Nitro on long straights ----
    let nitro = false;
    if (v.nitroCharges > 0 && !v.nitroActive && v.grounded && speed > 14 && Math.abs(err) < 0.12) {
      let straight = true;
      for (let k = 0; k < 70; k += 5) if (line.speed[(this.index + k) % n] < 27) straight = false;
      const behindBoost = leaderGap > 30 ? 0.2 : 0;
      if (straight && v.random() < (p.nitroEagerness + behindBoost) * dt * 3) nitro = true;
    }

    // ---- Stuck recovery: reverse out, then (via Simulation) reset ----
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      return { throttle: 0, brake: 1, steer: -steer, nitro: false };
    }
    if (!v.frozen && Math.abs(speed) < 1.5 && throttle > 0) {
      this.stuckTime += dt;
      this.hopelessTime += dt;
      if (this.stuckTime > 0.8) {
        this.stuckTime = 0;
        this.reverseTime = 1.0;
      }
    } else {
      this.stuckTime = 0;
      if (speed > 4) this.hopelessTime = 0;
    }

    return { throttle, brake, steer, nitro };
  }
}
