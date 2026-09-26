// Runs full all-AI races in Node (no rendering) and reports whether the track is
// driveable: lap times, route choices, resets, and anyone who got stuck.
//   npm run sim            (1 race)
//   npm run sim -- 3       (3 races)
import { Simulation, type SimEvent } from '../src/game/Simulation';
import { FIXED_DT } from '../src/physics/PhysicsWorld';

const races = Number(process.argv[2] ?? 1);
const verbose = process.argv.includes('-v');
let failures = 0;
for (let r = 0; r < races; r++) {
  const sim = await Simulation.create({ playerIndex: null, catchUp: true });
  // Vary the random streams per race.
  sim.vehicles.forEach((v) => { for (let k = 0; k < r * 13 + v.index; k++) v.random(); });
  const resets: Record<string, number> = {};
  const landings: Record<string, number> = { clean: 0, rough: 0, hard: 0 };
  const lastCheckpoint = sim.vehicles.map(() => 0);
  let collisions = 0, bigHits = 0;
  const maxT = 60 * 8;
  let t = 0;
  const t0 = performance.now();
  while (t < maxT && sim.race.phase !== 'finished') {
    const ev: SimEvent[] = sim.step(FIXED_DT);
    t += FIXED_DT;
    for (const e of ev) {
      if (e.type === 'respawnStart') {
        resets[`${sim.vehicles[e.racer].cfg.displayName}:${e.reason}`] = (resets[`${sim.vehicles[e.racer].cfg.displayName}:${e.reason}`] ?? 0) + 1;
        if (verbose) { const tr = sim.race.racers[e.racer].tracker; console.log(`  t=${t.toFixed(1)} RESET ${sim.vehicles[e.racer].cfg.displayName} ${e.reason} at (${e.x.toFixed(0)},${e.y.toFixed(1)},${e.z.toFixed(0)}) path=${tr.path.def.id} s=${tr.s.toFixed(0)}`); }
      }
      if (e.type === 'vehicle' && e.event.type === 'landing') { landings[e.event.quality]++; if (verbose) console.log(`  t=${t.toFixed(1)} landing ${sim.vehicles[e.racer].cfg.displayName} ${e.event.quality} impact=${e.event.impact.toFixed(1)}`); }
      if (e.type === 'collision' && e.a >= 0 && e.b >= 0) { collisions++; if (e.strength > 5) bigHits++; }
      if (e.type === 'race' && (e.event.type === 'checkpoint' || e.event.type === 'lap' || e.event.type === 'finish')) lastCheckpoint[e.event.racer] = t;
      if (e.type === 'race' && verbose && (e.event.type === 'lap' || e.event.type === 'finish')) console.log(`  t=${t.toFixed(1)} ${e.event.type} ${sim.vehicles[e.event.racer].cfg.displayName} ${JSON.stringify(e.event)}`);
    }
    if (verbose && Math.abs(t % 10) < FIXED_DT) {
      console.log(`  t=${t.toFixed(0)} ` + sim.race.racers.map((rc) => `${rc.name.slice(0, 5)} L${rc.lap} g${rc.nextGate} p${rc.tracker.progress.toFixed(0)} ${rc.tracker.path.def.id[0]} v=${sim.vehicles[rc.index].forwardSpeed.toFixed(0)}`).join(' | '));
    }
    sim.race.racers.forEach((rc, i) => {
      if (!rc.finished && sim.race.phase === 'racing' && t - lastCheckpoint[i] > 40 && t - lastCheckpoint[i] < 40 + FIXED_DT) {
        const v = sim.vehicles[i];
        console.log(`  !! ${rc.name} no checkpoint for 40s at (${v.pos.x.toFixed(0)},${v.pos.y.toFixed(1)},${v.pos.z.toFixed(0)}) next gate ${rc.nextGate} path ${rc.tracker.path.def.id} s=${rc.tracker.s.toFixed(0)} speed=${v.speed.toFixed(1)}`);
      }
    });
  }
  const wall = (performance.now() - t0) / 1000;
  console.log(`\nRace ${r + 1}: simulated ${t.toFixed(0)}s in ${wall.toFixed(1)}s wall — phase=${sim.race.phase}`);
  const sorted = [...sim.race.racers].sort((a, b) => a.position - b.position);
  for (const rc of sorted) {
    const ai = sim.ais[rc.index];
    console.log(`  P${rc.position} ${rc.name.padEnd(12)} ${ai.personality.name.padEnd(10)} ${rc.finished ? 'finished ' + rc.finishTime.toFixed(1) + 's' : 'DNF lap ' + rc.lap} laps=[${rc.lapTimes.map((x) => x.toFixed(1)).join(', ')}] shortcuts=${rc.shortcutsTaken} resets=${rc.respawns}`);
    if (!rc.finished) failures++;
  }
  console.log('  resets:', JSON.stringify(resets), ' landings:', JSON.stringify(landings), ` car-car contacts=${collisions} big=${bigHits}`);
}
process.exit(failures ? 1 : 0);
