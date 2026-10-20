import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/game';
import type { Unit } from '../src/game/units';
import { ballisticAngles } from '../src/game/enemyAI';
import { SPECS, SPEEDS } from '../src/game/abilities';
import { walkStep } from '../src/game/walk';
import { unitCenter } from '../src/game/units';

/**
 * A simple scripted "player" that uses only legal commands (select, move with the same physics the
 * keyboard uses, aim, confirm, end turn). Proves the slice is winnable under the real rules,
 * including enemy phases, and that it stays winnable with the planks destroyed.
 */
function nearestEnemy(g: Game, u: Unit): Unit | undefined {
  return g.livingEnemies().sort((a, b) => Math.hypot(a.body.x - u.body.x, a.body.y - u.body.y) - Math.hypot(b.body.x - u.body.x, b.body.y - u.body.y))[0];
}

/** Walk toward x with the hero's own movement rules (step-up, jump), spending the movement budget. */
function walkTo(g: Game, u: Unit, targetX: number, maxFrames = 900): void {
  const p = { speed: u.def.walkSpeed, jumpHeight: u.def.jumpHeight, maxDrop: 12 };
  let stuck = 0, lastX = u.body.x;
  for (let i = 0; i < maxFrames && u.alive; i++) {
    const dx = targetX - u.body.x;
    if (Math.abs(dx) < 0.4 || u.moveLeft <= 0) break;
    const dir = Math.sign(dx);
    u.facing = dir > 0 ? 1 : -1;
    const r = walkStep(g.terrain, u.body, dir, p, 1 / 60, false);
    u.moveLeft = Math.max(0, u.moveLeft - Math.abs(r.moved) - (r.jumped ? 1 : 0));
    u.moved = true;
    g.step(1);
    if (Math.abs(u.body.x - lastX) < 1e-6) stuck++; else stuck = 0;
    lastX = u.body.x;
    if (stuck > 90) break;
  }
  g.settle(600);
}

/** Try an aimed projectile ability at the target; returns true if fired. */
function tryShoot(g: Game, u: Unit, mode: 'basic' | 'signature', specKey: string, target: Unit, tolerance: number): boolean {
  if (!g.setMode(mode).ok) return false;
  const spec = SPECS[specKey];
  const [lo, hi] = SPEEDS[specKey];
  const m = g.muzzle(u), c = unitCenter(target);
  const speeds = lo === hi ? [lo] : [hi, hi - (hi - lo) * 0.25, hi - (hi - lo) * 0.5, lo + (hi - lo) * 0.25];
  for (const speed of speeds) {
    const angles = lo === hi ? [Math.atan2(c.y - m.y, c.x - m.x) + 0.02] : ballisticAngles(m, c, speed);
    for (const angle of angles) {
      const traj = g.previewTrajectory(u, spec, angle, speed);
      const hit = traj.events.some((e) => e.type === 'unit' && e.targetId === target.id);
      const near = Math.hypot(traj.end.x - c.x, traj.end.y - c.y) <= tolerance;
      if (hit || (spec.splash && near)) {
        g.aim.angle = angle; g.aim.power = lo === hi ? 1 : (speed - lo) / (hi - lo); g.aim.dir = c.x >= u.body.x ? 1 : -1;
        if (g.confirm().ok) { g.settle(1200); return true; }
      }
    }
  }
  g.cancel();
  return false;
}

function heroTurn(g: Game, u: Unit, goalX: number): void {
  if (!u.alive) return;
  g.selectHero(u.id);
  const enemy = nearestEnemy(g, u);
  if (!enemy) { walkTo(g, u, goalX); return; }
  let acted = false;
  switch (u.kind) {
    case 'inventor': acted = tryShoot(g, u, 'signature', 'shell', enemy, 3.0) || tryShoot(g, u, 'basic', 'gadget', enemy, 1.0); break;
    case 'duelist': acted = tryShoot(g, u, 'basic', 'bullet', enemy, 0); break;
    case 'spear':
      if (g.spear.state === 'held') acted = tryShoot(g, u, 'signature', 'spear', enemy, 0);
      if (!acted) acted = tryShoot(g, u, 'basic', 'stone', enemy, 0);
      break;
    case 'beast': acted = tryShoot(g, u, 'basic', 'hatchet', enemy, 0); break;
    case 'giant': break; // the giant only melee-strikes when adjacent
  }
  if (!acted) {
    // Approach: toward the enemy but keep ranged heroes a few units away; the spearman goes for a dropped spear first.
    const tx = u.kind === 'spear' && g.spear.state === 'resting' ? g.spear.body.x : enemy.body.x - Math.sign(enemy.body.x - u.body.x) * (u.kind === 'giant' ? 2 : 6);
    walkTo(g, u, tx);
    if (u.kind === 'giant' && !u.acted) { g.selectHero(u.id); g.aim.dir = enemy.body.x >= u.body.x ? 1 : -1; if (g.setMode('basic').ok) { const pv = g.ability(u, 'basic')!.preview(g, u, g.aim); if (pv.label && pv.label.includes('hits')) g.confirm(); else g.cancel(); } }
    else if (!u.acted) {
      g.selectHero(u.id);
      const e2 = nearestEnemy(g, u);
      if (e2) {
        if (u.kind === 'inventor') tryShoot(g, u, 'signature', 'shell', e2, 3.0);
        else if (u.kind === 'duelist') tryShoot(g, u, 'basic', 'bullet', e2, 0);
        else if (u.kind === 'spear') (g.spear.state === 'held' && tryShoot(g, u, 'signature', 'spear', e2, 0)) || tryShoot(g, u, 'basic', 'stone', e2, 0);
        else if (u.kind === 'beast') tryShoot(g, u, 'basic', 'hatchet', e2, 0);
      }
    }
  }
}

function playToWin(g: Game, maxTurns: number): { turns: number; log: string[] } {
  const order = ['inventor', 'duelist', 'spear', 'beast', 'giant'] as const;
  const log: string[] = [];
  for (let t = 0; t < maxTurns && g.phase === 'player'; t++) {
    const goalX = 96;
    for (const k of order) { const u = g.hero(k)!; if (u.alive) heroTurn(g, u, goalX); }
    // If the raiders are gone, make sure someone keeps pushing to the goal every turn.
    g.settle(600);
    if (g.phase !== 'player') break;
    log.push(`turn ${g.turn}: enemies ${g.livingEnemies().length}, heroes ${g.livingHeroes().length}, duelist x=${g.hero('duelist')!.body.x.toFixed(1)} inventor x=${g.hero('inventor')!.body.x.toFixed(1)}`);
    expect(g.endSquadTurn()).toBe(true);
    g.settle(60 * 60);
    g.step(30);
  }
  return { turns: g.turn, log };
}

describe('Scripted playthrough (legal commands only)', () => {
  it('wins the mission within 14 squad turns', () => {
    const g = new Game({ seed: 1234, skipIntro: true });
    const { turns, log } = playToWin(g, 14);
    expect(g.phase, log.join('\n')).toBe('victory');
    expect(g.hero('inventor')!.body.x, 'the walker must get out of the courtyard: ' + log.join('\n')).toBeGreaterThan(30);
    expect(g.livingHeroes().length).toBeGreaterThan(0);
    expect(turns).toBeLessThanOrEqual(14);
  });

  it('still wins after the plank section of the crossing has been destroyed', () => {
    const g = new Game({ seed: 99, skipIntro: true });
    g.terrain.fillRect(64, 11, 67.5, 12, 0);
    const { log } = playToWin(g, 16);
    expect(g.phase, log.join('\n')).toBe('victory');
  });
});
