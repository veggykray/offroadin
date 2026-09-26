import type { Track, TrackPath } from '../track/Track';
import type { Vehicle } from '../vehicle/Vehicle';

/**
 * Follows one racer along the course: which path they're on (main / shortcut),
 * their arc position, lateral offset and main-equivalent progress.
 */
export class RacerTracker {
  path: TrackPath;
  index = 0;
  lateral = 0;
  outside = 0;

  constructor(private track: Track, x: number, z: number) {
    this.path = track.main;
    this.snap(x, z);
  }

  get s(): number {
    return this.path.samples[this.index].s;
  }

  get progress(): number {
    return this.track.progressOf(this.path.def.id, this.s);
  }

  get onShortcut(): boolean {
    return this.path !== this.track.main;
  }

  /** Global re-acquire (after teleports). */
  snap(x: number, z: number): void {
    const q = this.track.queryRoad(x, z, 60);
    if (q) {
      this.path = q.path;
      this.index = q.index;
    }
    this.measure(x, z);
  }

  update(x: number, z: number): void {
    const track = this.track;
    // Local search on the current path.
    this.index = this.path.nearestIndexNear(x, z, this.index, 14);
    this.measure(x, z);
    // Possible switch between main and the shortcut near the branch zone.
    const sc = track.shortcut;
    if (!sc) return;
    const other = this.path === track.main ? sc : track.main;
    const inZone = this.path === sc || (this.s > track.splitS - 25 && this.s < track.rejoinS + 25);
    if (!inZone) return;
    const n = track.nearestOnPath(other, x, z, 24);
    if (!n) return;
    const smp = other.samples[n.index];
    const lat = (x - smp.x) * smp.lx + (z - smp.z) * smp.lz;
    const outsideOther = Math.abs(lat) - smp.halfWidth;
    // Switch only when clearly better (hysteresis avoids flicker where the roads overlap).
    const myNorm = Math.abs(this.lateral) / this.path.samples[this.index].halfWidth;
    const otherNorm = Math.abs(lat) / smp.halfWidth;
    const atShortcutEnd = this.path === sc && this.index >= sc.samples.length - 3;
    if (atShortcutEnd || (outsideOther < -0.5 && otherNorm < myNorm - 0.35)) {
      // Leaving the shortcut only into main near the rejoin (or it was a real transfer).
      this.path = other;
      this.index = n.index;
      this.measure(x, z);
    }
  }

  private measure(x: number, z: number): void {
    const smp = this.path.samples[this.index];
    this.lateral = (x - smp.x) * smp.lx + (z - smp.z) * smp.lz;
    this.outside = Math.abs(this.lateral) - smp.halfWidth;
  }
}

export interface RacerState {
  index: number;
  name: string;
  isPlayer: boolean;
  tracker: RacerTracker;
  /** Current lap (1-based). */
  lap: number;
  /** Index of the next checkpoint gate to cross (0 = finish line). */
  nextGate: number;
  /** Signed distance to each gate last step (for crossing detection). */
  gateSide: number;
  finished: boolean;
  finishTime: number;
  lapStart: number;
  lapTimes: number[];
  bestLap: number;
  position: number;
  totalProgress: number;
  wrongWayTime: number;
  respawns: number;
  shortcutsTaken: number;
  onShortcutThisLap: boolean;
}

export type RaceEvent =
  | { type: 'go' }
  | { type: 'lap'; racer: number; lap: number; time: number }
  | { type: 'finish'; racer: number; position: number; time: number }
  | { type: 'checkpoint'; racer: number; gate: number };

/**
 * Race rules: countdown → racing → finished. Ordered checkpoint gates (crossed in the
 * forward direction only) so laps cannot be farmed by reversing over the line.
 */
export class RaceManager {
  phase: 'countdown' | 'racing' | 'finished' = 'countdown';
  countdown = 3.2;
  raceTime = 0;
  readonly racers: RacerState[] = [];
  readonly laps: number;
  /** Time since the player finished (the race winds down after everyone is done). */
  private postFinish = 0;

  constructor(private track: Track, vehicles: Vehicle[], names: string[], playerIndex: number | null, laps?: number) {
    this.laps = laps ?? track.def.laps;
    vehicles.forEach((v, i) => {
      const tracker = new RacerTracker(track, v.pos.x, v.pos.z);
      this.racers.push({
        index: i,
        name: names[i],
        isPlayer: i === playerIndex,
        tracker,
        lap: 1,
        nextGate: 1 % track.gates.length,
        gateSide: this.gateDistance(1 % track.gates.length, v.pos.x, v.pos.z),
        finished: false,
        finishTime: 0,
        lapStart: 0,
        lapTimes: [],
        bestLap: Infinity,
        position: i + 1,
        totalProgress: 0,
        wrongWayTime: 0,
        respawns: 0,
        shortcutsTaken: 0,
        onShortcutThisLap: false,
      });
    });
  }

  private gateDistance(gateIndex: number, x: number, z: number): number {
    const g = this.track.gates[gateIndex];
    return (x - g.x) * g.tx + (z - g.z) * g.tz;
  }

  get allFinished(): boolean {
    return this.racers.every((r) => r.finished);
  }

  update(dt: number, vehicles: Vehicle[]): RaceEvent[] {
    const events: RaceEvent[] = [];
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'racing';
        events.push({ type: 'go' });
      }
    } else {
      this.raceTime += dt;
    }

    const L = this.track.lapLength;
    for (const r of this.racers) {
      const v = vehicles[r.index];
      if (v.respawnTimer > 0) continue;
      r.tracker.update(v.pos.x, v.pos.z);
      // Count the shortcut as taken only in its middle part (the ends overlap the main road).
      const sc = this.track.shortcut;
      if (sc && r.tracker.path === sc && r.tracker.s > sc.length * 0.3 && r.tracker.s < sc.length * 0.7) r.onShortcutThisLap = true;

      // ---- Checkpoints ----
      if (this.phase !== 'countdown' && !r.finished) {
        const g = this.track.gates[r.nextGate];
        const d = this.gateDistance(r.nextGate, v.pos.x, v.pos.z);
        const lat = Math.abs((v.pos.x - g.x) * g.tz - (v.pos.z - g.z) * g.tx);
        if (r.gateSide < 0 && d >= 0 && lat < g.halfWidth && Math.abs(v.pos.y - g.y) < 12) {
          if (r.nextGate === 0) {
            // Completed a lap.
            const lapTime = this.raceTime - r.lapStart;
            r.lapTimes.push(lapTime);
            r.bestLap = Math.min(r.bestLap, lapTime);
            r.lapStart = this.raceTime;
            if (r.onShortcutThisLap) r.shortcutsTaken++;
            r.onShortcutThisLap = false;
            if (r.lap >= this.laps) {
              r.finished = true;
              r.finishTime = this.raceTime;
              events.push({ type: 'finish', racer: r.index, position: 0, time: this.raceTime });
            } else {
              r.lap++;
              events.push({ type: 'lap', racer: r.index, lap: r.lap, time: lapTime });
            }
          } else {
            events.push({ type: 'checkpoint', racer: r.index, gate: r.nextGate });
          }
          r.nextGate = (r.nextGate + 1) % this.track.gates.length;
          r.gateSide = this.gateDistance(r.nextGate, v.pos.x, v.pos.z);
        } else {
          r.gateSide = d;
        }
      }

      // ---- Continuous progress for positions ----
      let p = r.tracker.progress;
      const nextS = r.nextGate === 0 ? L : this.track.gates[r.nextGate].s;
      if (p > nextS + 40) p -= L; // e.g. reversing behind the grid
      r.totalProgress = r.finished ? this.laps * L + 1e6 - r.finishTime * 100 : (r.lap - 1) * L + p;

      // ---- Wrong way ----
      const smp = r.tracker.path.samples[r.tracker.index];
      const along = v.vel.x * smp.tx + v.vel.z * smp.tz;
      r.wrongWayTime = along < -3 && this.phase === 'racing' ? r.wrongWayTime + dt : 0;
    }

    // ---- Positions ----
    const order = [...this.racers].sort((a, b) => b.totalProgress - a.totalProgress);
    order.forEach((r, i) => (r.position = i + 1));
    for (const e of events) if (e.type === 'finish') e.position = this.racers[e.racer].position;

    if (this.phase === 'racing') {
      const player = this.racers.find((r) => r.isPlayer);
      if (player?.finished || (!player && this.allFinished)) {
        this.postFinish += dt;
        if (this.allFinished || this.postFinish > 20) this.phase = 'finished';
      }
    }
    return events;
  }

  get leaderProgress(): number {
    return Math.max(...this.racers.map((r) => r.totalProgress));
  }
}
