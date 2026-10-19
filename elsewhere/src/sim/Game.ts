import {
  BRIDGE, FLOOR1_Y, INTERACTABLES, LIFT, START_STATE, TIMING, WHITE, type FlagId, type FloorId,
} from '../config/p2Slice';
import { Actor, type ActorId } from './Actor';
import { CyanCircuit, MagentaLift } from './Liquid';
import { NavGrid } from './NavGrid';
import { dist, type V2 } from './vec';

export type Selectable = 'dog' | 'cat';
export type WhiteMode = 'follow' | 'wait' | 'balk' | 'join' | 'ride';

export interface Hint { text: string; t: number }

/**
 * The P2 slice simulation. Render-free: the renderer, HUD and audio read this state and the
 * input layer calls the tap* methods. All timings are deterministic (fixed dt from the caller).
 */
export class Game {
  readonly dog = new Actor('dog', START_STATE.dog.x, START_STATE.dog.z, START_STATE.dog.floor, START_STATE.dog.facing);
  readonly cat = new Actor('cat', START_STATE.cat.x, START_STATE.cat.z, START_STATE.cat.floor, START_STATE.cat.facing);
  readonly white = new Actor('white', START_STATE.white.x, START_STATE.white.z, START_STATE.white.floor, START_STATE.white.facing);
  readonly nav: Record<FloorId, NavGrid> = { 0: new NavGrid(0), 1: new NavGrid(1) };
  readonly cyan = new CyanCircuit();
  readonly lift = new MagentaLift();
  selected: Selectable = START_STATE.selected;
  flags = new Set<string>(START_STATE.flags);
  time = 0;
  hint: Hint | null = null;
  /** rising-edge events consumed by audio/UI each frame */
  events: string[] = [];
  /** cumulative event log (tests/debug only) */
  history: string[] = [];
  scentTrail: V2[] = [];
  scentUntil = 0;
  whiteMode: WhiteMode = 'follow';
  whiteBalked = false;
  whiteReassured = false;
  completed = false;
  reunionT = -1;
  /** who is standing on the float waiting to depart, and who still has to walk on */
  private boarding: { actors: ActorId[]; pending: Set<ActorId>; fromFloor: FloorId } | null = null;
  private pendingBoard: { actor: Selectable; floor: FloorId } | null = null;
  private bridgeEntry = new Map<ActorId, 'W' | 'E'>();
  private whiteReplanT = 0;
  private whiteTarget: V2 | null = null;

  constructor() {
    this.nav[0].addDynamic({ id: 'E02', floor: 0, rect: BRIDGE.rect, walkable: true, enabled: false });
    this.nav[0].addDynamic({ id: 'shaft0', floor: 0, circle: LIFT.interior, walkable: false, enabled: false });
    this.nav[1].addDynamic({ id: 'shaft1', floor: 1, circle: LIFT.interior, walkable: false, enabled: true });
    this.syncNav();
  }

  get actors(): Actor[] { return [this.dog, this.cat, this.white]; }
  actor(id: ActorId): Actor { return id === 'dog' ? this.dog : id === 'cat' ? this.cat : this.white; }
  get current(): Actor { return this.actor(this.selected); }
  has(f: FlagId | string): boolean { return this.flags.has(f); }
  private award(f: FlagId): void { if (!this.flags.has(f)) { this.flags.add(f); this.events.push('flag:' + f); } }
  say(text: string): void { this.hint = { text, t: this.time }; }

  reset(): void {
    for (const id of ['dog', 'cat', 'white'] as const) {
      const a = this.actor(id); const s = START_STATE[id];
      a.setPos({ x: s.x, z: s.z }, s.floor); a.facing = s.facing; a.y = 0; a.path = []; a.motion = 'idle'; a.motionTime = 0; a.motionTotal = 0; a.onArrive = null; a.rideOffset = null; a.odometer = 0;
    }
    this.selected = START_STATE.selected; this.flags = new Set(START_STATE.flags); this.time = 0; this.hint = null; this.events = ['reset'];
    this.scentTrail = []; this.scentUntil = 0; this.whiteMode = 'follow'; this.whiteBalked = false; this.whiteReassured = false;
    this.history = []; this.completed = false; this.reunionT = -1; this.boarding = null; this.pendingBoard = null; this.bridgeEntry.clear(); this.whiteReplanT = 0; this.whiteTarget = null;
    this.cyan.reset(); this.lift.reset(); this.syncNav();
  }

  // ---------------------------------------------------------------- input
  select(id: Selectable): void { if (this.selected !== id) { this.selected = id; this.events.push('select:' + id); } }

  tapGround(floor: FloorId, p: V2): boolean {
    const a = this.current;
    if (a.floor !== floor) { this.say(`${cap(a.id)} is on floor ${a.floor}. Switch portrait or tap that floor.`); return false; }
    if (a.motion === 'ride' || a.motion === 'board') { this.say('Wait for the lift to dock.'); return false; }
    if (this.boarding?.actors.includes(a.id)) this.cancelBoarding();
    this.pendingBoard = null;
    const ok = a.goTo(this.nav[floor], p);
    if (!ok) this.say('No way through for ' + (a.id === 'dog' ? 'the dog' : 'the cat') + ' there.');
    return ok;
  }

  tapActor(id: ActorId): void {
    if (id === 'white') { this.tryReassure(); return; }
    if (id !== this.selected) { this.select(id); return; }
    // Tapping the selected animal: investigate.
    const a = this.current;
    if (a.busy) return;
    if (a.id === 'dog') {
      a.play('sniff', 1.2);
      if (a.floor === 0 && !this.cyan.seepOpen) {
        const path = this.nav[0].findPath(a.pos, INTERACTABLES.seep.standPoint, 0.3) ?? [a.pos, INTERACTABLES.seep.standPoint];
        this.scentTrail = resample(path, 0.9); this.scentUntil = this.time + 14; this.events.push('scent');
        this.say('Wet mineral droplets… the dog smells cyan behind the reeds.');
      } else this.say(this.cyan.seepOpen ? 'The seep is open; the dog smells flowing cyan.' : 'Nothing new to smell here.');
    } else {
      a.play('inspect', 0.9);
      this.say(a.floor === 1 ? 'The cat watches the magenta column hum.' : 'The cat flicks an ear at the dry crossing.');
    }
  }

  tapInteractable(id: string): boolean {
    const def = INTERACTABLES[id]; if (!def) return false;
    const a = this.current;
    if (a.floor !== def.floor) { this.say(`${cap(a.id)} is on floor ${a.floor}; that is on floor ${def.floor}.`); return false; }
    if (!def.actors.includes(this.selected)) { this.say('Only the dog can scrape the reeds.'); return false; }
    if (a.motion === 'ride' || a.motion === 'board') return false;
    if (this.boarding?.actors.includes(a.id)) this.cancelBoarding();
    this.pendingBoard = null;
    if (id === 'liftBase' || id === 'liftTop') return this.orderBoard(this.selected, def.floor);
    const ok = a.goTo(this.nav[def.floor], def.standPoint, () => this.perform(id, a));
    if (!ok) this.say('Cannot reach that from here.');
    return ok;
  }

  private perform(id: string, a: Actor): void {
    a.facing = Math.atan2(INTERACTABLES[id].pos.x - a.x, INTERACTABLES[id].pos.z - a.z);
    switch (id) {
      case 'seep':
        if (this.cyan.seepOpen) { this.say('The seep already runs clear.'); a.play('sniff', 0.8); return; }
        a.play('scrape', TIMING.scrape); this.events.push('scrape');
        this.later(TIMING.scrape * 0.85, () => { this.cyan.openSeep(); this.say('Reeds scraped away — cyan wells up and follows the groove.'); });
        return;
      case 'CV-01':
        a.play('nudge', 1.0); this.events.push('valve');
        this.later(0.4, () => {
          const pos = this.cyan.toggleDiverter();
          if (pos === 'bridge') this.say(this.cyan.seepOpen ? 'CV-01 turned: cyan heads for the bridge receiver.' : 'CV-01 turned toward the receiver, but no cyan is flowing yet.');
          else this.say(this.cyan.bridgeSafe ? 'CV-01 back to the spill. The safety slats keep the crossing.' : 'CV-01 back to the spill route.');
        });
        return;
      case 'indicator':
        a.play('inspect', 1.4); this.events.push('inspect');
        this.say(this.lift.strength === 'weak' ? 'Load indicator: one band lit. The stream carries only the cat. MR-01 beside it sets the pressure.' : 'Load indicator: three bands lit. The stream carries everyone.');
        return;
      case 'MR-01':
        a.play('nudge', 1.2); this.events.push('valve');
        this.later(0.5, () => {
          if (this.lift.strengthen()) { this.award('P2_LIFT_STRONG'); this.say('MR-01 opened: the magenta stream surges — strong enough for the dog and White.'); }
          else this.say('MR-01 is already at full pressure.');
        });
        return;
    }
  }

  // ---------------------------------------------------------------- lift
  private orderBoard(actor: Selectable, floor: FloorId): boolean {
    const a = this.actor(actor);
    const nav = this.nav[floor];
    if (this.lift.busy) { this.say('The lift is moving — wait for it.'); return false; }
    if (this.lift.dockedFloor !== floor) {
      if (this.lift.call(floor)) { this.say('Calling the float ' + (floor === 0 ? 'down.' : 'up.')); this.pendingBoard = { actor, floor }; a.goTo(nav, LIFT.boardStand); return true; }
      this.say('The float is in use.'); return false;
    }
    if (!a.goTo(nav, LIFT.boardStand, () => this.stepOnto(actor, floor))) { this.say('Cannot reach the lift from here.'); return false; }
    return true;
  }

  private stepOnto(actor: Selectable, floor: FloorId): void {
    if (this.lift.dockedFloor !== floor) { this.pendingBoard = { actor, floor }; return; }
    const a = this.actor(actor);
    const nav = this.nav[floor];
    const joinWhite = actor === 'dog' && this.white.floor === floor && this.whiteReassured && this.lift.strength === 'strong' && dist(this.white.pos, a.pos) < 7;
    const spot: V2 = joinWhite ? { x: LIFT.centre.x - 0.45, z: LIFT.centre.z - 0.45 } : { x: LIFT.centre.x, z: LIFT.centre.z - 0.1 };
    this.boarding = { actors: joinWhite ? [actor, 'white'] : [actor], pending: new Set(joinWhite ? [actor, 'white'] : [actor]), fromFloor: floor };
    a.goTo(nav, spot, () => this.arrivedOnFloat(actor));
    if (joinWhite) {
      this.whiteMode = 'join';
      this.white.goTo(nav, { x: LIFT.centre.x + 0.55, z: LIFT.centre.z + 0.7 }, () => this.arrivedOnFloat('white'));
    } else if (actor === 'dog' && this.white.floor === floor && !this.whiteReassured && this.lift.strength === 'strong') {
      this.say('White hangs back from the roaring stream.');
    }
  }

  private arrivedOnFloat(id: ActorId): void {
    const b = this.boarding; if (!b) return;
    b.pending.delete(id);
    const a = this.actor(id); a.motion = 'board'; a.rideOffset = { x: a.x - LIFT.centre.x, z: a.z - LIFT.centre.z };
    a.facing = Math.atan2(-a.rideOffset.x, -a.rideOffset.z) + Math.PI; // face outward (west) roughly
    if (b.pending.size) return;
    const res = this.lift.depart(b.actors, LIFT.weakSeconds, LIFT.strongSeconds);
    if (res === 'ok') {
      for (const pid of b.actors) { const p = this.actor(pid); p.motion = 'ride'; if (pid === 'white') this.whiteMode = 'ride'; }
      this.events.push(b.fromFloor === 0 ? 'liftUp' : 'liftDown');
      this.say(this.lift.strength === 'weak' ? 'The weak stream lifts the cat alone.' : 'The strong stream carries them up together.');
    } else if (res === 'rejected') {
      for (const pid of b.actors) this.actor(pid).motion = 'ride';
      this.say('The weak stream sags under the dog. It cannot carry that load.');
    }
    this.boarding = null;
  }

  private cancelBoarding(): void {
    if (!this.boarding) return;
    for (const pid of this.boarding.actors) { const p = this.actor(pid); if (p.motion === 'board') p.motion = 'idle'; p.rideOffset = null; }
    if (this.whiteMode === 'join') this.whiteMode = 'follow';
    this.boarding = null;
  }

  private onLiftDocked(): void {
    const docked = this.lift.dockedFloor!;
    const land = (pid: ActorId): Actor => { const p = this.actor(pid); p.floor = docked; p.y = 0; p.motion = 'idle'; p.rideOffset = null; if (pid === 'white') this.whiteMode = 'follow'; return p; };
    for (const pid of this.lift.passengers) land(pid as ActorId);
    if (this.rejected.length) {
      // Step the dog (and White, if he had joined) back off the float, safely.
      for (const pid of this.rejected) { const p = land(pid); p.goTo(this.nav[docked], pid === 'white' ? { x: LIFT.boardStand.x - 0.4, z: LIFT.boardStand.z + 1.2 } : LIFT.boardStand); }
      this.rejected = [];
    }
    this.lift.passengers = [];
    this.syncNav();
    if (this.pendingBoard && this.pendingBoard.floor === docked) { const pb = this.pendingBoard; this.pendingBoard = null; const a = this.actor(pb.actor); if (a.floor === docked && !a.busy) a.goTo(this.nav[docked], LIFT.boardStand, () => this.stepOnto(pb.actor, pb.floor)); }
  }
  private rejected: ActorId[] = [];

  // ---------------------------------------------------------------- white
  private tryReassure(): void {
    const dog = this.dog;
    if (this.selected !== 'dog') { this.say('Only the dog can calm White. Select the dog.'); return; }
    if (dog.floor !== this.white.floor) { this.say('White is on another floor.'); return; }
    if (this.whiteReassured) { this.say('White stays close to the dog now.'); return; }
    if (!this.whiteBalked) { this.say('White is following the dog. He is nervous but fine.'); return; }
    if (dog.busy) return;
    const w = this.white;
    const side: V2 = { x: w.x + Math.cos(w.facing) * WHITE.sitBesideOffset, z: w.z - Math.sin(w.facing) * WHITE.sitBesideOffset };
    const spot = this.nav[dog.floor].nearestFree(side, dog.radius, 2) ?? side;
    this.whiteMode = 'balk';
    dog.goTo(this.nav[dog.floor], spot, () => {
      dog.facing = Math.atan2(w.x - dog.x, w.z - dog.z);
      dog.play('sit', TIMING.sit); this.events.push('sit');
      this.say('The dog sits beside White.');
      this.later(TIMING.sit * 0.8, () => {
        w.play('relax', TIMING.relax); this.whiteReassured = true; this.whiteMode = 'follow'; this.events.push('reassured');
        this.say('White’s shoulders drop. He will board with the dog once the stream is strong enough.');
      });
    });
  }

  private updateWhite(dt: number): void {
    const w = this.white, dog = this.dog;
    if (this.whiteMode === 'ride' || this.whiteMode === 'join' || w.motion === 'ride' || w.motion === 'board') return;
    if (w.motionTime > 0) return;
    if (this.completed) return;
    this.whiteReplanT -= dt;
    const nav = this.nav[w.floor];
    if (dog.floor !== w.floor || dog.motion === 'ride') {
      // Dog is away: wait in the explicit shelter (floor 0) or stay put (floor 1).
      if (this.whiteMode !== 'wait') { this.whiteMode = 'wait'; this.whiteTarget = null; }
      if (w.floor === 0 && dist(w.pos, WHITE.shelter) > 0.6 && !w.moving && this.whiteReplanT <= 0) { w.goTo(nav, WHITE.shelter); this.whiteReplanT = 1.0; }
      return;
    }
    if (this.whiteMode === 'wait') this.whiteMode = this.whiteBalked && !this.whiteReassured ? 'balk' : 'follow';
    // Balk once at the loud rise.
    if (w.floor === 0 && !this.whiteBalked && dist(dog.pos, LIFT.centre) < WHITE.balkRadius + 1.5 && dist(w.pos, LIFT.centre) < WHITE.balkRadius + 2.5) {
      this.whiteBalked = true; this.whiteMode = 'balk'; w.goTo(nav, WHITE.balkPoint, () => { w.facing = Math.atan2(LIFT.centre.x - w.x, LIFT.centre.z - w.z); w.play('balk', 1.6); });
      this.events.push('whiteBalk'); this.say('White stops short of the roaring magenta rise, shaking. Tap White with the dog to sit with him.');
      return;
    }
    if (this.whiteMode === 'balk') {
      // Stay at the balk point while the dog is near the lift; follow at a distance otherwise.
      if (dist(dog.pos, LIFT.centre) < WHITE.balkRadius + 2) { if (!w.moving && dist(w.pos, WHITE.balkPoint) > 0.5 && this.whiteReplanT <= 0) { w.goTo(nav, WHITE.balkPoint); this.whiteReplanT = 0.8; } return; }
    }
    // Follow the dog along verified safe paths (the nav grid only contains walkable, solid ground).
    const d = dist(w.pos, dog.pos);
    if (d <= WHITE.followDistance) { if (w.moving) w.stop(); if (!dog.moving) w.facing += (Math.atan2(dog.x - w.x, dog.z - w.z) - w.facing) * Math.min(1, dt * 4); return; }
    if (this.whiteReplanT > 0 && w.moving) return;
    let target: V2 = { x: dog.x - Math.sin(dog.facing) * WHITE.followDistance, z: dog.z - Math.cos(dog.facing) * WHITE.followDistance };
    if (!this.whiteReassured && w.floor === 0 && dist(target, LIFT.centre) < WHITE.balkRadius) target = WHITE.balkPoint;
    if (this.whiteTarget && dist(this.whiteTarget, target) < 0.5 && w.moving) return;
    const free = nav.nearestFree(target, w.radius, 2.5);
    if (free) { w.goTo(nav, free); this.whiteTarget = free; }
    this.whiteReplanT = 0.45;
  }

  // ---------------------------------------------------------------- tick
  private timers: { at: number; fn: () => void }[] = [];
  private later(secs: number, fn: () => void): void { this.timers.push({ at: this.time + secs, fn }); }

  update(dt: number): void {
    this.time += dt;
    this.events.length = 0;
    for (const t of this.timers.slice()) if (this.time >= t.at) { this.timers.splice(this.timers.indexOf(t), 1); t.fn(); }
    // Bridge occupancy and crossing detection.
    let occupied = false;
    for (const a of this.actors) {
      if (a.floor !== 0) continue;
      const r = BRIDGE.rect; const on = a.x > r.x0 - a.radius && a.x < r.x1 + a.radius && a.z > r.z0 - 0.2 && a.z < r.z1 + 0.2;
      if (on) { occupied = true; if (!this.bridgeEntry.has(a.id)) this.bridgeEntry.set(a.id, a.x < 0 ? 'W' : 'E'); }
      else if (this.bridgeEntry.has(a.id)) { const from = this.bridgeEntry.get(a.id)!; this.bridgeEntry.delete(a.id); if ((from === 'W' && a.x > 0) || (from === 'E' && a.x < 0)) { this.cyan.latchSafe(); this.award('P2_BRIDGE_SAFE'); } }
    }
    this.cyan.bridgeOccupied = occupied;
    const wasWalkable = this.cyan.bridgeWalkable;
    this.cyan.update(dt);
    for (const e of this.cyan.events) { this.events.push('cyan:' + e); if (e === 'bridgeSolid') this.award('P2_BRIDGE_READY'); if (e === 'bridgeSafe') this.say('The crossing locks: porcelain safety slats hold even if the cyan is sent elsewhere.'); }
    this.cyan.events.length = 0;
    if (this.cyan.closePending && !this.hintRecently('holds')) this.say('The crossing holds while someone is on it; it will drain once clear.');
    if (wasWalkable !== this.cyan.bridgeWalkable) this.syncNav();
    // Lift.
    const wasBusy = this.lift.busy;
    if (this.lift.state === 'rejecting' && !this.rejected.length) this.rejected = this.lift.passengers.slice() as ActorId[];
    const docked = this.lift.update(dt, LIFT.rejectSeconds);
    for (const e of this.lift.events) this.events.push('lift:' + e);
    const liftEvents = this.lift.events.slice(); this.lift.events.length = 0;
    for (const pid of this.lift.passengers) { const p = this.actor(pid as ActorId); p.y = this.lift.level * FLOOR1_Y; if (p.rideOffset) { p.x = LIFT.centre.x + p.rideOffset.x; p.z = LIFT.centre.z + p.rideOffset.z; } }
    for (const pid of this.rejected) { const p = this.actor(pid); p.y = this.lift.level * FLOOR1_Y; }
    if (docked) { this.lift.events.push(...liftEvents); this.onLiftDocked(); this.lift.events.length = 0; }
    else if (wasBusy !== this.lift.busy) this.syncNav();
    // Actors.
    for (const a of this.actors) a.update(dt, a.id === 'white' ? 1 : 1);
    this.updateWhite(dt);
    if (this.scentUntil && this.time > this.scentUntil) { this.scentTrail = []; this.scentUntil = 0; }
    // Completion: all three physically at 1A and not in transit.
    if (!this.completed && this.actors.every((a) => a.floor === 1 && a.motion !== 'ride' && a.motion !== 'board') && !this.lift.busy) {
      this.completed = true; this.reunionT = this.time; this.award('P2_ASCENDED'); this.events.push('reunion');
      const nav = this.nav[1]; const w = this.white;
      this.dog.goTo(nav, nav.nearestFree({ x: w.x - 1.3, z: w.z + 0.3 }, this.dog.radius, 2) ?? w.pos, () => { this.dog.facing = Math.atan2(w.x - this.dog.x, w.z - this.dog.z); this.dog.play('greet', 2.4); });
      this.cat.goTo(nav, nav.nearestFree({ x: w.x + 1.0, z: w.z + 0.6 }, this.cat.radius, 2) ?? w.pos, () => { this.cat.facing = Math.atan2(w.x - this.cat.x, w.z - this.cat.z); this.cat.play('greet', 2.4); });
      w.play('relax', 2.6);
      this.say('All three on Reed Quay. P2_ASCENDED — The First Rise.');
    }
    this.flushHistory();
  }

  private flushHistory(): void { if (this.events.length) { this.history.push(...this.events); if (this.history.length > 600) this.history.splice(0, this.history.length - 600); } }

  private hintRecently(needle: string): boolean { return !!this.hint && this.hint.text.includes(needle) && this.time - this.hint.t < 3; }

  private syncNav(): void {
    this.nav[0].setDynamic('E02', this.cyan.bridgeWalkable);
    this.nav[0].setDynamic('shaft0', this.lift.state !== 'docked0');
    this.nav[1].setDynamic('shaft1', this.lift.state !== 'docked1');
  }

  /** Debug/test snapshot. */
  snapshot(): Record<string, unknown> {
    return {
      time: +this.time.toFixed(2), selected: this.selected, flags: [...this.flags],
      dog: { x: +this.dog.x.toFixed(2), z: +this.dog.z.toFixed(2), y: +this.dog.y.toFixed(2), floor: this.dog.floor, motion: this.dog.motion },
      cat: { x: +this.cat.x.toFixed(2), z: +this.cat.z.toFixed(2), y: +this.cat.y.toFixed(2), floor: this.cat.floor, motion: this.cat.motion },
      white: { x: +this.white.x.toFixed(2), z: +this.white.z.toFixed(2), y: +this.white.y.toFixed(2), floor: this.white.floor, motion: this.white.motion, mode: this.whiteMode, balked: this.whiteBalked, reassured: this.whiteReassured },
      cyan: { seepOpen: this.cyan.seepOpen, diverter: this.cyan.diverter, bridgeForm: +this.cyan.bridgeForm.toFixed(2), bridgeSolid: this.cyan.bridgeSolid, bridgeSafe: this.cyan.bridgeSafe, closePending: this.cyan.closePending, receiver: +this.cyan.receiver.toFixed(2) },
      lift: { strength: this.lift.strength, state: this.lift.state, level: +this.lift.level.toFixed(2), passengers: this.lift.passengers },
      completed: this.completed, hint: this.hint?.text ?? null,
    };
  }
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Resample a polyline at roughly `step` spacing. */
function resample(path: V2[], step: number): V2[] {
  const out: V2[] = [];
  let carry = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]; const d = dist(a, b); if (d === 0) continue;
    for (let s = carry; s < d; s += step) { const t = s / d; out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); carry = s + step - d; }
  }
  return out;
}
