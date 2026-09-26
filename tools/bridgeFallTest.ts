// Drive the player off the side of the log bridge and check recovery is quick and sane.
import * as THREE from 'three';
import { Simulation, type SimEvent } from '../src/game/Simulation';
import { FIXED_DT } from '../src/physics/PhysicsWorld';

const sim = await Simulation.create({ playerIndex: 1, catchUp: false });
sim.race.phase = 'racing';
const sc = sim.track.shortcut!;
const v = sim.vehicles[1];
const start = sc.sampleAt(sc.node('bridgeNorth') - 6);
v.teleport(new THREE.Vector3(start.x, start.y + 1.1, start.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(start.tx, start.tz)), 16);
sim.race.racers[1].tracker.snap(v.pos.x, v.pos.z);
let t = 0, fellAt = -1, backAt = -1;
let reason = '';
while (t < 8) {
  // Hard right onto the bridge edge.
  sim.playerInput = { throttle: 1, brake: 0, steer: t > 0.4 && fellAt < 0 ? 1 : 0, nitro: false };
  const ev: SimEvent[] = sim.step(FIXED_DT); t += FIXED_DT;
  for (const e of ev) {
    if (e.type === 'respawnStart' && e.racer === 1) { fellAt = t; reason = e.reason; console.log(`t=${t.toFixed(2)} RESET (${e.reason}) from (${e.x.toFixed(1)}, ${e.y.toFixed(1)}, ${e.z.toFixed(1)})`); }
    if (e.type === 'respawnEnd' && e.racer === 1) { backAt = t; const tr = sim.race.racers[1].tracker; console.log(`t=${t.toFixed(2)} back on ${tr.path.def.id} s=${tr.s.toFixed(0)} (bridge ${sc.node('bridgeNorth').toFixed(0)}–${sc.node('bridgeSouth').toFixed(0)}) at (${e.x.toFixed(1)}, ${e.y.toFixed(1)}, ${e.z.toFixed(1)})`); }
  }
  if (backAt > 0 && t > backAt + 2) break;
}
console.log(`fell: ${fellAt > 0 ? 'yes (' + reason + ')' : 'NO'}, recovery took ${(backAt - fellAt).toFixed(2)}s, speed 2s after respawn ${v.forwardSpeed.toFixed(1)} m/s, grounded ${v.groundedWheels}/4`);
