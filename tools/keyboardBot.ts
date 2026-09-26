// Can a KEYBOARD driver (steer -1/0/+1, throttle on/off, brake on/off) lap cleanly?
// A bang-bang bot follows the AI racing line using only digital inputs, as the
// player in slot 1 with three AI opponents.
import { Simulation } from '../src/game/Simulation';
import { FIXED_DT } from '../src/physics/PhysicsWorld';

for (const route of ['safe', 'shortcut'] as const) {
  const sim = await Simulation.create({ playerIndex: 1, laps: 3 });
  const v = sim.vehicles[1];
  const r = sim.race.racers[1];
  const line = sim.lines.get(route)!;
  let idx = line.globalNearest(v.pos.x, v.pos.z);
  let t = 0, steerHold = 0;
  while (t < 150 && !r.finished) {
    idx = line.nearest(v.pos.x, v.pos.z, idx, 25);
    const look = Math.round(6 + Math.max(0, v.forwardSpeed) * 0.45);
    const ti = (idx + look) % line.n;
    let err = Math.atan2(line.x[ti] - v.pos.x, line.z[ti] - v.pos.z) - Math.atan2(v.fwd.x, v.fwd.z);
    while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    // Digital steering with a little human-like hysteresis (holds a key ≥ 80 ms).
    if (steerHold <= 0) { steerHold = 0.08; }
    steerHold -= FIXED_DT;
    const want = err > 0.06 ? -1 : err < -0.06 ? 1 : 0;
    let target = 999;
    for (let k = 0; k < 4 + v.forwardSpeed * 0.15; k++) target = Math.min(target, line.speed[(idx + k) % line.n]);
    const throttle = v.forwardSpeed < target ? 1 : 0;
    const brake = v.forwardSpeed > target + 3 ? 1 : 0;
    const nitro = v.nitroCharges > 0 && line.speed[(idx + 40) % line.n] > 30 && Math.abs(err) < 0.05;
    sim.playerInput = { throttle, brake, steer: want, nitro };
    sim.step(FIXED_DT); t += FIXED_DT;
  }
  console.log(`keyboard bot (${route}): ${r.finished ? 'finished P' + r.position : 'DNF'} laps=[${r.lapTimes.map((x) => x.toFixed(2)).join(', ')}] resets=${r.respawns}`);
}
