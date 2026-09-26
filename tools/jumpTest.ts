// Fires one car at the main jump at a range of speeds and reports flight + landing quality.
import * as THREE from 'three';
import { Simulation } from '../src/game/Simulation';
import { FIXED_DT } from '../src/physics/PhysicsWorld';

const sim = await Simulation.create({ playerIndex: 0, catchUp: false });
const track = sim.track;
const main = track.main;
const lipS = main.node('jumpLip');
const useNitro = process.argv.includes('--nitro');
// Park the other cars far away.
sim.vehicles.slice(1).forEach((v, i) => { v.body.setEnabled(false); v.teleport(new THREE.Vector3(120, 30, 90 - i * 10), new THREE.Quaternion()); });
sim.race.phase = 'racing';
for (const speed of [12, 15, 18, 20, 22, 24, 26, 28, 30, 33, 36]) {
  const v = sim.vehicles[0];
  const s0 = lipS - 45;
  const smp = main.sampleAt(s0);
  const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(smp.tx, smp.tz));
  v.teleport(new THREE.Vector3(smp.x, smp.y + 1.1, smp.z), rot, speed);
  v.frozen = false; v.nitroCharges = 3; v.nitroTime = 0;
  let takeoff = 0, airStart = -1, landedAt = -1, maxAir = 0, t = 0;
  let quality = '-', impact = 0, landS = 0;
  const tracker = sim.race.racers[0].tracker; tracker.snap(v.pos.x, v.pos.z);
  while (t < 6) {
    // Steering: aim down the centreline. Throttle: hold the test speed until the lip.
    const idx = main.nearestIndexNear(v.pos.x, v.pos.z, main.indexAt(Math.max(0, tracker.s)), 30);
    const tgt = main.samples[main.wrap(idx + 12)];
    let err = Math.atan2(tgt.x - v.pos.x, tgt.z - v.pos.z) - Math.atan2(v.fwd.x, v.fwd.z);
    while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const before = main.samples[idx].s < lipS;
    const throttle = before ? (v.forwardSpeed < speed ? 1 : 0) : 1;
    sim.playerInput = { throttle, brake: before && v.forwardSpeed > speed + 1 ? 0.5 : 0, steer: Math.max(-1, Math.min(1, -err * 2.4)), nitro: useNitro && before && main.samples[idx].s > lipS - 28 };
    const ev = sim.step(FIXED_DT);
    t += FIXED_DT;
    if (!v.grounded && airStart < 0 && main.samples[idx].s > lipS - 10) { airStart = t; takeoff = v.forwardSpeed; }
    if (airStart >= 0 && landedAt < 0) maxAir = Math.max(maxAir, v.airTime);
    for (const e of ev) if (e.type === 'vehicle' && e.event.type === 'landing' && airStart >= 0 && landedAt < 0) {
      landedAt = t; quality = e.event.quality; impact = e.event.impact; landS = main.samples[main.nearestIndexNear(v.pos.x, v.pos.z, idx, 40)].s - lipS;
    }
    if (landedAt > 0 && t > landedAt + 1.5) break;
  }
  console.log(`approach ${speed.toString().padStart(2)} m/s  takeoff ${takeoff.toFixed(1).padStart(5)}  air ${maxAir.toFixed(2)}s  lands ${landS.toFixed(1).padStart(5)} m past lip  impact ${impact.toFixed(1).padStart(5)}  ${quality}   speed after ${v.forwardSpeed.toFixed(1)}`);
}
