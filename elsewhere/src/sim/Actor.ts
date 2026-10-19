import { ACTOR, type FloorId } from '../config/p2Slice';
import type { NavGrid } from './NavGrid';
import { angleDelta, approach, dist, type V2 } from './vec';

export type ActorId = 'dog' | 'cat' | 'white';
export type Motion = 'idle' | 'walk' | 'turn' | 'sniff' | 'scrape' | 'nudge' | 'sit' | 'inspect' | 'board' | 'ride' | 'balk' | 'relax' | 'greet';

/**
 * Pure movement/animation state for one character. Position is authoritative here; the renderer
 * reads it. Gait phase advances with distance travelled so feet never slide.
 */
export class Actor {
  readonly id: ActorId;
  x: number; z: number; y = 0;
  floor: FloorId;
  facing: number;
  path: V2[] = [];
  motion: Motion = 'idle';
  /** seconds remaining in a timed one-shot motion */
  motionTime = 0;
  motionTotal = 0;
  onArrive: (() => void) | null = null;
  /** distance travelled (drives the gait) */
  odometer = 0;
  speedNow = 0;
  radius: number; speed: number; turnRate: number; stride: number;
  /** when riding, the actor is parented to the lift float; this is the offset on the float */
  rideOffset: V2 | null = null;

  constructor(id: ActorId, x: number, z: number, floor: FloorId, facing: number) {
    this.id = id; this.x = x; this.z = z; this.floor = floor; this.facing = facing;
    const a = ACTOR[id];
    this.radius = a.radius; this.speed = a.speed; this.turnRate = a.turnRate; this.stride = a.stride;
  }

  get pos(): V2 { return { x: this.x, z: this.z }; }
  get busy(): boolean { return this.motionTime > 0 || this.motion === 'ride' || this.motion === 'board'; }
  get moving(): boolean { return this.path.length > 0; }

  setPos(p: V2, floor?: FloorId): void { this.x = p.x; this.z = p.z; if (floor !== undefined) this.floor = floor; }

  /** Replace any current order with a path to `to` (returns false if unreachable). */
  goTo(nav: NavGrid, to: V2, onArrive: (() => void) | null = null): boolean {
    if (this.motion === 'ride' || this.motion === 'board') return false;
    const path = nav.findPath(this.pos, to, this.radius);
    if (!path) { this.path = []; this.onArrive = null; return false; }
    this.path = path.slice(1);
    if (this.path.length === 0) this.path = [to];
    this.onArrive = onArrive;
    this.motionTime = 0;
    this.motion = 'walk';
    return true;
  }

  stop(): void { this.path = []; this.onArrive = null; if (this.motion === 'walk' || this.motion === 'turn') this.motion = 'idle'; }

  /** Start a timed one-shot motion (sniff, scrape, sit…). */
  play(m: Motion, seconds: number): void { this.path = []; this.onArrive = null; this.motion = m; this.motionTime = seconds; this.motionTotal = seconds; }

  /** 0..1 progress through the current one-shot motion. */
  get motionProgress(): number { return this.motionTotal > 0 ? 1 - this.motionTime / this.motionTotal : 1; }

  update(dt: number, speedScale = 1): void {
    this.speedNow = 0;
    if (this.motionTime > 0) {
      this.motionTime -= dt;
      if (this.motionTime <= 0) { this.motionTime = 0; this.motionTotal = 0; if (this.motion !== 'ride' && this.motion !== 'sit' && this.motion !== 'balk') this.motion = 'idle'; }
      return;
    }
    if (this.motion === 'ride' || this.motion === 'board') return;
    if (!this.path.length) { if (this.motion === 'walk' || this.motion === 'turn') this.motion = 'idle'; return; }
    const target = this.path[0];
    const d = dist(this.pos, target);
    const want = Math.atan2(target.x - this.x, target.z - this.z);
    const delta = angleDelta(this.facing, want);
    // Turn in place for sharp turns, otherwise steer while walking.
    const maxTurn = this.turnRate * dt;
    this.facing += approach(0, delta, maxTurn);
    const sharp = Math.abs(delta) > 1.1;
    this.motion = sharp ? 'turn' : 'walk';
    const v = sharp ? 0 : this.speed * speedScale * Math.min(1, 0.25 + d / 0.6);
    const step = Math.min(d, v * dt);
    if (step > 0) {
      this.x += Math.sin(this.facing) * step; this.z += Math.cos(this.facing) * step;
      this.odometer += step; this.speedNow = step / dt;
    }
    if (d - step < 0.03) {
      this.x = target.x; this.z = target.z; this.path.shift();
      if (!this.path.length) { this.motion = 'idle'; const cb = this.onArrive; this.onArrive = null; cb?.(); }
    }
  }
}
