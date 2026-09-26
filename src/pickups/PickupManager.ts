import * as THREE from 'three';
import type { Track } from '../track/Track';
import type { Vehicle } from '../vehicle/Vehicle';

export type PickupKind = 'nitro';

export interface Pickup {
  kind: PickupKind;
  position: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
}

export interface PickupEvent {
  kind: PickupKind;
  racer: number;
  pickup: number;
}

/**
 * Track pickups. Only nitro exists in this prototype (+1 charge, up to the car's max).
 * Future specials (jump, hazard drop, attack) plug in here: a racer will carry only one
 * special at a time, separate from the nitro meter.
 */
export class PickupManager {
  readonly pickups: Pickup[] = [];
  readonly radius = 2.8;
  readonly respawnTime = 8;

  constructor(track: Track) {
    for (const d of track.def.pickups) {
      const path = track.paths.get(d.path)!;
      const p = path.pointAt(path.node(d.at) + (d.offset ?? 0), d.lateral);
      p.y = track.groundHeight(p.x, p.z) + 1.1;
      this.pickups.push({ kind: d.kind, position: p, active: true, respawnTimer: 0 });
    }
  }

  reset(): void {
    for (const p of this.pickups) {
      p.active = true;
      p.respawnTimer = 0;
    }
  }

  update(dt: number, vehicles: Vehicle[]): PickupEvent[] {
    const events: PickupEvent[] = [];
    this.pickups.forEach((p, i) => {
      if (!p.active) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) p.active = true;
        return;
      }
      for (const v of vehicles) {
        if (v.respawnTimer > 0) continue;
        if (v.pos.distanceToSquared(p.position) > this.radius * this.radius) continue;
        if (p.kind === 'nitro') {
          if (v.nitroCharges >= v.cfg.nitroMaxCharges) continue; // full: leave it for someone else
          v.nitroCharges++;
        }
        p.active = false;
        p.respawnTimer = this.respawnTime;
        events.push({ kind: p.kind, racer: v.index, pickup: i });
        break;
      }
    });
    return events;
  }
}
