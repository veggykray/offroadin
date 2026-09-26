// Automated regression check: npm test
//  - 3 all-AI races forward + 1 reverse must all finish with no racer stuck
//  - a keyboard-style (digital input) driver must be able to finish a race
import { Simulation } from '../src/game/Simulation';
import { FIXED_DT } from '../src/physics/PhysicsWorld';

let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

for (const [reverse, seed] of [[false, 0], [false, 1], [false, 2], [true, 0]] as const) {
  const sim = await Simulation.create({ playerIndex: null, reverse });
  sim.vehicles.forEach((v) => { for (let k = 0; k < seed * 17 + v.index; k++) v.random(); });
  let t = 0;
  while (t < 400 && sim.race.phase !== 'finished') { sim.step(FIXED_DT); t += FIXED_DT; }
  const r = sim.race.racers;
  const worst = Math.max(...r.map((x) => Math.max(...x.lapTimes)));
  check(r.every((x) => x.finished), `${reverse ? 'reverse' : 'forward'} race #${seed + 1}: all 4 AI finished (${t.toFixed(0)}s, slowest lap ${worst.toFixed(1)}s, resets ${r.map((x) => x.respawns).join('/')})`);
  check(worst < 45, `  no lap slower than 45s`);
}

{
  const sim = await Simulation.create({ playerIndex: 1, laps: 2 });
  const v = sim.vehicles[1], r = sim.race.racers[1], line = sim.lines.get('safe')!;
  let idx = line.globalNearest(v.pos.x, v.pos.z), t = 0;
  while (t < 150 && !r.finished) {
    idx = line.nearest(v.pos.x, v.pos.z, idx, 25);
    const ti = (idx + Math.round(6 + Math.max(0, v.forwardSpeed) * 0.45)) % line.n;
    let err = Math.atan2(line.x[ti] - v.pos.x, line.z[ti] - v.pos.z) - Math.atan2(v.fwd.x, v.fwd.z);
    while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    let target = 999; for (let k = 0; k < 4 + v.forwardSpeed * 0.15; k++) target = Math.min(target, line.speed[(idx + k) % line.n]);
    sim.playerInput = { throttle: v.forwardSpeed < target ? 1 : 0, brake: v.forwardSpeed > target + 3 ? 1 : 0, steer: err > 0.06 ? -1 : err < -0.06 ? 1 : 0, nitro: false };
    sim.step(FIXED_DT); t += FIXED_DT;
  }
  check(r.finished, `keyboard-style driver finished 2 laps (${r.lapTimes.map((x) => x.toFixed(1)).join(', ')}s)`);
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
