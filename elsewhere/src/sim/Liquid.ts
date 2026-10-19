import { TIMING } from '../config/p2Slice';
import { approach, clamp01 } from './vec';

export type DiverterPos = 'spill' | 'bridge';

/**
 * L01 — cyan circuit on 0B/0D. Deterministic channel fill levels (0..1) that the renderer draws;
 * no fluid solver. Cyan only constructs at the receiver: the bridge forms once the receiver is full.
 *
 *   seep (reed-blocked) -> feed -> junction (CV-01) -> spill route (broken cistern)   [default]
 *                                                   -> bridge route -> conduit -> receiver -> E02
 */
export class CyanCircuit {
  seepOpen = false;
  diverter: DiverterPos = 'spill';
  feed = 0; spill = 0; branch = 0; conduit = 0; receiver = 0; bridgeForm = 0;
  /** Safety latch: after the first full crossing the retaining slats keep E02 walkable. */
  bridgeSafe = false;
  /** A closure requested while someone is on the bridge waits here until the bridge is clear. */
  closePending = false;
  /** Set by the game each tick: is any actor currently on the bridge rect. */
  bridgeOccupied = false;
  /** Rising-edge events for audio/UI. */
  events: string[] = [];
  private lastSolid = false;

  get bridgeSolid(): boolean { return this.bridgeForm >= 1; }
  /** Walkable right now (liquid construct OR the latched safety slats). */
  get bridgeWalkable(): boolean { return this.bridgeSolid || this.bridgeSafe; }
  /** Is cyan heading down the bridge branch and able to keep the construct up. */
  get bridgeFed(): boolean { return this.seepOpen && this.diverter === 'bridge'; }

  openSeep(): void { if (!this.seepOpen) { this.seepOpen = true; this.events.push('seepOpened'); } }

  /** Toggle CV-01. Returns the new position. Closure is deferred while the bridge is occupied. */
  toggleDiverter(): DiverterPos {
    this.diverter = this.diverter === 'spill' ? 'bridge' : 'spill';
    this.events.push('diverter:' + this.diverter);
    return this.diverter;
  }

  update(dt: number): void {
    const up = (v: number, secs: number): number => approach(v, 1, dt / secs);
    const down = (v: number): number => approach(v, 0, dt / TIMING.drain);
    this.feed = this.seepOpen ? up(this.feed, TIMING.feedFill) : down(this.feed);
    const atJunction = this.feed >= 1;
    this.spill = atJunction && this.diverter === 'spill' ? up(this.spill, TIMING.branchFill) : down(this.spill);
    const wantBridge = atJunction && this.diverter === 'bridge';
    this.branch = wantBridge ? up(this.branch, TIMING.branchFill) : down(this.branch);
    this.conduit = wantBridge && this.branch >= 1 ? up(this.conduit, TIMING.conduitFill) : (wantBridge ? this.conduit : down(this.conduit));
    this.receiver = wantBridge && this.conduit >= 1 ? up(this.receiver, TIMING.receiverFill) : (wantBridge ? this.receiver : down(this.receiver));
    if (wantBridge) this.closePending = false;
    if (wantBridge && this.receiver >= 1) {
      this.bridgeForm = up(this.bridgeForm, TIMING.bridgeForm);
    } else if (!wantBridge && this.bridgeForm > 0) {
      // Never let the bridge vanish under a character.
      if (this.bridgeOccupied && !this.bridgeSafe) this.closePending = true;
      else { this.closePending = false; this.bridgeForm = approach(this.bridgeForm, 0, dt / TIMING.bridgeForm); }
    }
    this.bridgeForm = clamp01(this.bridgeForm);
    const solid = this.bridgeSolid;
    if (solid && !this.lastSolid) this.events.push('bridgeSolid');
    if (!solid && this.lastSolid) this.events.push('bridgeGone');
    this.lastSolid = solid;
  }

  latchSafe(): void { if (!this.bridgeSafe) { this.bridgeSafe = true; this.closePending = false; this.events.push('bridgeSafe'); } }

  reset(): void {
    this.seepOpen = false; this.diverter = 'spill';
    this.feed = this.spill = this.branch = this.conduit = this.receiver = this.bridgeForm = 0;
    this.bridgeSafe = false; this.closePending = false; this.bridgeOccupied = false; this.lastSolid = false; this.events = [];
  }
}

export type LiftStrength = 'weak' | 'strong';
export type FloatState = 'docked0' | 'docked1' | 'rising' | 'descending' | 'rejecting';

/**
 * L02/V02 — one physical magenta lift. The float disc is carried by the magenta column. Weak
 * pressure carries the cat only; the dog is rejected safely (float sags back down). MR-01 at 1A
 * raises the pressure (persists until reset).
 */
export class MagentaLift {
  strength: LiftStrength = 'weak';
  state: FloatState = 'docked0';
  /** 0 = floor 0, 1 = floor 1 */
  level = 0;
  /** actors riding (ids) */
  passengers: string[] = [];
  /** load requested by the current passengers (dog = 3, white = 1, cat = 1) */
  events: string[] = [];
  private rejectT = 0;

  get capacity(): number { return this.strength === 'weak' ? 1 : 5; }
  get dockedFloor(): 0 | 1 | null { return this.state === 'docked0' ? 0 : this.state === 'docked1' ? 1 : null; }
  get busy(): boolean { return this.state === 'rising' || this.state === 'descending' || this.state === 'rejecting'; }
  /** Column intensity for the renderer (0.35 weak .. 1 strong), with a surge while moving. */
  get intensity(): number { return (this.strength === 'weak' ? 0.42 : 1) * (this.busy ? 1.25 : 1); }

  static loadOf(id: string): number { return id === 'dog' ? 3 : 1; }

  strengthen(): boolean { if (this.strength === 'strong') return false; this.strength = 'strong'; this.events.push('strong'); return true; }

  /** Attempt to depart with the given passengers from the docked floor. */
  depart(passengers: string[], secondsWeak: number, secondsStrong: number): 'ok' | 'rejected' | 'busy' {
    if (this.busy) return 'busy';
    const load = passengers.reduce((s, p) => s + MagentaLift.loadOf(p), 0);
    this.passengers = passengers.slice();
    if (load > this.capacity) { this.state = 'rejecting'; this.rejectT = 0; this.events.push('reject'); return 'rejected'; }
    this.rideSeconds = this.strength === 'weak' ? secondsWeak : secondsStrong;
    this.state = this.state === 'docked0' ? 'rising' : 'descending';
    this.events.push(this.state);
    return 'ok';
  }
  private rideSeconds = 4;

  /** Call the empty float to the other floor. */
  call(toFloor: 0 | 1): boolean {
    if (this.busy || this.passengers.length) return false;
    if (this.dockedFloor === toFloor) return false;
    this.rideSeconds = this.strength === 'weak' ? 3.4 : 2.6;
    this.state = toFloor === 1 ? 'rising' : 'descending';
    this.events.push('call');
    return true;
  }

  /** True on the tick the float docks; caller moves passengers to the new floor. */
  update(dt: number, rejectSeconds: number): boolean {
    if (this.state === 'rising') { this.level = approach(this.level, 1, dt / this.rideSeconds); if (this.level >= 1) { this.state = 'docked1'; this.events.push('docked1'); return true; } }
    else if (this.state === 'descending') { this.level = approach(this.level, 0, dt / this.rideSeconds); if (this.level <= 0) { this.state = 'docked0'; this.events.push('docked0'); return true; } }
    else if (this.state === 'rejecting') {
      this.rejectT += dt / rejectSeconds;
      // bob up a little then settle back
      this.level = Math.max(0, Math.sin(Math.min(1, this.rejectT) * Math.PI) * 0.06);
      if (this.rejectT >= 1) { this.level = 0; this.state = 'docked0'; this.passengers = []; this.events.push('rejected'); return true; }
    }
    return false;
  }

  reset(): void { this.strength = 'weak'; this.state = 'docked0'; this.level = 0; this.passengers = []; this.events = []; this.rejectT = 0; }
}
