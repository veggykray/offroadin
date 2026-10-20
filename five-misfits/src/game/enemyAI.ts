import type { Game } from './game';
import { type Unit, unitCenter } from './units';
import { type Routine, waitSeconds, waitUntil } from '../core/coroutine';
import { walkStep, simulateWalk } from './walk';
import { SPECS } from './abilities';
import { GRAVITY } from '../world/physics';
import { DEG } from '../core/math';

const RAIDER_WALK = { speed: 5, jumpHeight: 3.2, maxDrop: 5 };
const REACH = { dx: 2.2, dy: 2.6 };
const ARCHER_RANGE = 45;
const ARROW_SPEED = 32;

/** All living enemies act once, in order. Deterministic given the game's seed. */
export function* enemyPhase(g: Game): Routine {
  for (const e of g.enemies) {
    if (!e.alive || g.livingHeroes().length === 0) continue;
    yield* enemyTurn(g, e);
    yield* waitUntil(() => g.settled(), 8);
  }
}

function nearestHero(g: Game, e: Unit): Unit | undefined {
  let best: Unit | undefined, bd = Infinity;
  for (const h of g.livingHeroes()) { const d = Math.hypot(h.body.x - e.body.x, h.body.y - e.body.y); if (d < bd) { bd = d; best = h; } }
  return best;
}

export function* enemyTurn(g: Game, e: Unit): Routine {
  g.focus = unitCenter(e);
  yield* waitSeconds(0.35);
  if (e.kind === 'raider') yield* raiderTurn(g, e); else yield* archerTurn(g, e);
}

function telegraph(g: Game, e: Unit, text: string): void {
  g.addFx({ kind: 'text', x: e.body.x, y: e.body.y + e.body.h + 1.2, vx: 0, vy: 0.4, life: 1.4, max: 1.4, color: '#ff9f9f', size: 1, text });
}

function* raiderTurn(g: Game, e: Unit): Routine {
  const target = nearestHero(g, e);
  if (!target) return;
  const sim = simulateWalk(g.terrain, e.body, { x: target.body.x, y: target.body.y, reachDx: REACH.dx, reachDy: REACH.dy }, RAIDER_WALK, 10);
  if (!sim.reached) {
    e.intent = `holds position — no path to ${target.def.name} (${sim.reason})`;
    g.log(`Raider holds position: no path to ${target.def.name} (${sim.reason}).`, 'info');
    telegraph(g, e, 'holds');
    yield* waitSeconds(0.7);
    return;
  }
  e.intent = `advances on ${target.def.name}`;
  g.log(`Raider advances on ${target.def.name}.`, 'info');
  telegraph(g, e, `→ ${target.def.name}`);
  g.addFx({ kind: 'line', x: e.body.x, y: e.body.y + 1.5, x2: target.body.x, y2: target.body.y + 1.5, vx: 0, vy: 0, life: 0.6, max: 0.6, color: 'rgba(255,120,120,0.6)', size: 0.08 });
  yield* waitSeconds(0.6);
  let dist = 0, frames = 0;
  while (dist < e.def.moveBudget && frames < 600) {
    const dx = target.body.x - e.body.x, dy = target.body.y - e.body.y;
    if (Math.abs(dx) <= REACH.dx && Math.abs(dy) <= REACH.dy && e.body.grounded) break;
    const dir = Math.sign(dx);
    if (dir !== 0) e.facing = dir > 0 ? 1 : -1;
    const dt: number = yield;
    const r = walkStep(g.terrain, e.body, dir, RAIDER_WALK, dt, false);
    dist += Math.abs(r.moved); frames++;
    g.focus = unitCenter(e);
    if (r.cliff) break;
  }
  yield* waitUntil(() => e.body.grounded, 3);
  const dx = target.body.x - e.body.x, dy = target.body.y - e.body.y;
  if (target.alive && Math.abs(dx) <= REACH.dx && Math.abs(dy) <= REACH.dy) {
    e.intent = `strikes ${target.def.name}`;
    e.anim.swing = 0.4;
    yield* waitSeconds(0.2);
    g.damageUnit(target, 16, Math.sign(dx || e.facing) * 6, 4, 'raider blade');
    g.log(`Raider strikes ${target.def.name} for 16.`, 'bad');
    yield* waitSeconds(0.35);
  } else {
    e.intent = `closes in on ${target.def.name}`;
    g.log(`Raider closes in but can't reach ${target.def.name} this turn.`, 'info');
    yield* waitSeconds(0.3);
  }
}

/** Launch angles (low, high) that hit (to) from (from) at speed v under gravity gr; empty if out of range. */
export function ballisticAngles(from: { x: number; y: number }, to: { x: number; y: number }, v: number, gr = GRAVITY): number[] {
  const dx = to.x - from.x, dy = to.y - from.y;
  const v2 = v * v;
  const disc = v2 * v2 - gr * (gr * dx * dx + 2 * dy * v2);
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  if (Math.abs(dx) < 1e-6) return [Math.PI / 2];
  return [Math.atan2(v2 - root, gr * dx), Math.atan2(v2 + root, gr * dx)];
}

function* archerTurn(g: Game, e: Unit): Routine {
  const spec = SPECS.arrow;
  const cands = g.livingHeroes()
    .filter((h) => Math.abs(h.body.x - e.body.x) <= ARCHER_RANGE)
    .sort((a, b) => Math.abs(a.body.x - e.body.x) - Math.abs(b.body.x - e.body.x));
  let chosen: { target: Unit; angle: number } | null = null;
  for (const h of cands) {
    const m = g.muzzle(e), c = unitCenter(h);
    for (const base of ballisticAngles(m, c, ARROW_SPEED)) {
      const angle = base + (g.rng.next() - 0.5) * 3 * DEG; // deterministic ±1.5° scatter
      const traj = g.previewTrajectory(e, spec, angle, ARROW_SPEED);
      const hitsHero = traj.end.type === 'unit' && g.unit(traj.end.targetId!)?.team === 'hero';
      const near = Math.hypot(traj.end.x - c.x, traj.end.y - c.y) <= 2.2;
      if (hitsHero || near) { chosen = { target: h, angle }; break; }
    }
    if (chosen) break;
  }
  if (!chosen) {
    e.intent = cands.length ? 'no clear shot — holds' : 'no hero in range — holds';
    g.log(`Archer: ${e.intent}.`, 'info');
    telegraph(g, e, 'holds');
    yield* waitSeconds(0.6);
    return;
  }
  const { target, angle } = chosen;
  e.facing = target.body.x >= e.body.x ? 1 : -1;
  e.intent = `takes aim at ${target.def.name}`;
  g.log(`Archer takes aim at ${target.def.name}.`, 'warn');
  telegraph(g, e, `aims → ${target.def.name}`);
  const m = g.muzzle(e);
  g.addFx({ kind: 'line', x: m.x, y: m.y, x2: target.body.x, y2: target.body.y + 1.5, vx: 0, vy: 0, life: 0.8, max: 0.8, color: 'rgba(255,110,110,0.7)', size: 0.08 });
  yield* waitSeconds(0.8);
  g.spawnProjectile(e, spec, angle, ARROW_SPEED, '#e8d8b0');
  yield* waitUntil(() => g.projectiles.length === 0, 8);
}
