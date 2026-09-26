// Collision sanity checks: side-by-side shove, T-bone at speed, rear-end.
// Reports lateral displacement, yaw change, max height (no "launch into orbit").
import * as THREE from 'three';
import { initPhysics, PhysicsWorld, RAPIER, TERRAIN_GROUPS, FIXED_DT } from '../src/physics/PhysicsWorld';
import { Vehicle } from '../src/vehicle/Vehicle';
import { VEHICLES } from '../src/vehicle/VehicleConfig';
import { stepVehicle, type DriveInput } from '../src/vehicle/VehicleController';

await initPhysics();
type Setup = { name: string; a: [number, number, number, number]; b: [number, number, number, number]; ia: DriveInput; ib: DriveInput; secs: number };
const yawQ = (deg: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
const tests: Setup[] = [
  { name: 'side shove (A steers into B, both 20 m/s)', a: [0, 0, 0, 20], b: [-2.8, 0, 0, 20], ia: { throttle: 1, brake: 0, steer: 0.6, nitro: false }, ib: { throttle: 1, brake: 0, steer: 0, nitro: false }, secs: 2 },
  { name: 'T-bone (A 25 m/s into side of stopped B)', a: [0, -20, 0, 25], b: [0, 0, 90, 0], ia: { throttle: 1, brake: 0, steer: 0, nitro: false }, ib: { throttle: 0, brake: 0, steer: 0, nitro: false }, secs: 2.5 },
  { name: 'rear-end (A 28 into B 15)', a: [0, -12, 0, 28], b: [0, 0, 0, 15], ia: { throttle: 1, brake: 0, steer: 0, nitro: false }, ib: { throttle: 1, brake: 0, steer: 0, nitro: false }, secs: 2 },
  { name: 'nitro T-bone (A 38 into B)', a: [0, -25, 0, 38], b: [0, 0, 90, 0], ia: { throttle: 1, brake: 0, steer: 0, nitro: true }, ib: { throttle: 0, brake: 0, steer: 0, nitro: false }, secs: 3 },
];
for (const t of tests) {
  const pw = new PhysicsWorld();
  pw.tag(pw.world.createCollider(RAPIER.ColliderDesc.cuboid(500, 1, 500).setTranslation(0, -1, 0).setCollisionGroups(TERRAIN_GROUPS)), { kind: 'terrain' });
  const mk = (i: number, s: [number, number, number, number]) => new Vehicle(i, VEHICLES.cindercrest, pw, new THREE.Vector3(s[0], 1.1, s[1]), yawQ(s[2]));
  const A = mk(0, t.a), B = mk(1, t.b);
  pw.world.step();
  A.teleport(A.pos, A.quat, t.a[3]); B.teleport(B.pos, B.quat, t.b[3]);
  let maxY = 0, maxHit = 0; const b0 = B.pos.clone(); const yaw0 = Math.atan2(B.fwd.x, B.fwd.z);
  for (let k = 0; k < t.secs * 60; k++) {
    for (const [v, inp] of [[A, t.ia], [B, t.ib]] as const) { v.storePrevious(); v.senseGround(() => 'dirt'); stepVehicle(v, inp); }
    pw.step();
    pw.events.drainContactForceEvents((e) => { maxHit = Math.max(maxHit, (e.totalForceMagnitude() * FIXED_DT) / 1200); });
    for (const v of [A, B]) { v.readState(); v.tickTimers(); maxY = Math.max(maxY, v.pos.y); }
  }
  const yaw1 = Math.atan2(B.fwd.x, B.fwd.z);
  console.log(`${t.name}\n   B moved ${b0.distanceTo(B.pos).toFixed(1)} m, B yaw change ${(((yaw1 - yaw0) * 180) / Math.PI).toFixed(0)}°, max height ${maxY.toFixed(2)} m, hit Δv≈${maxHit.toFixed(1)} m/s, A up.y=${A.up.y.toFixed(2)} B up.y=${B.up.y.toFixed(2)}, A speed after ${A.forwardSpeed.toFixed(1)}`);
}
