// Compares the SAFE route and the SHORTCUT: one AI car alone, forced onto each route.
// Prints time between consecutive checkpoints for lap 2+ (flying laps).
import { Simulation } from '../src/game/Simulation';
import { PERSONALITIES } from '../src/vehicle/AIController';
import { FIXED_DT } from '../src/physics/PhysicsWorld';

const only = process.argv[2];
for (const pname of ['cautious', 'balanced', 'aggressive'] as const) {
  if (only && only !== pname) continue;
  for (const chance of [0, 1]) {
    const saved = PERSONALITIES[pname].shortcutChance;
    PERSONALITIES[pname].shortcutChance = chance;
    const sim = await Simulation.create({ playerIndex: null, roster: [{ vehicle: 'cindercrest', personality: pname }], catchUp: false, laps: 3 });
    const r = sim.race.racers[0];
    const v = sim.vehicles[0];
    let t = 0, last = 0;
    const splits: Record<string, number[]> = {};
    let minSpeed: Record<string, number> = {};
    while (t < 200 && !r.finished) {
      const ev = sim.step(FIXED_DT); t += FIXED_DT;
      const g = sim.track.gates[(r.nextGate + sim.track.gates.length - 1) % sim.track.gates.length].name;
      minSpeed[g] = Math.min(minSpeed[g] ?? 99, v.forwardSpeed);
      for (const e of ev) if (e.type === 'race' && (e.event.type === 'checkpoint' || e.event.type === 'lap' || e.event.type === 'finish')) {
        const gi = e.event.type === 'checkpoint' ? e.event.gate : 0;
        const name = sim.track.gates[(gi + sim.track.gates.length - 1) % sim.track.gates.length].name + '→' + sim.track.gates[gi].name;
        if (r.lap >= 2 || e.event.type !== 'checkpoint') (splits[name] ??= []).push(t - last);
        last = t;
      }
    }
    PERSONALITIES[pname].shortcutChance = saved;
    console.log(`${pname} ${chance ? 'SHORTCUT' : 'SAFE'} laps=[${r.lapTimes.map((x) => x.toFixed(2)).join(', ')}] resets=${r.respawns}`);
    for (const [k, arr] of Object.entries(splits)) console.log(`   ${k.padEnd(28)} ${arr.slice(-2).map((x) => x.toFixed(2)).join('  ')}   (min speed after ${k.split('→')[0]}: ${minSpeed[k.split('→')[0]]?.toFixed(1)})`);
  }
}
