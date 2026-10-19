import type { Terrain } from './terrain';
import { GRAVITY } from './physics';

export interface Target { id: number; x: number; y: number; w: number; h: number; alive: boolean; team: string }

export interface ProjectileSpec {
  kind: 'shell' | 'gadget' | 'stone' | 'bullet' | 'hatchet' | 'spear' | 'arrow';
  radius: number;
  gravityScale: number;
  /** Direct-hit damage. */
  damage: number;
  /** Splash explosion (shell, gadget). */
  splash?: { radius: number; damage: number; minDamage: number; carve: number; knockback: number };
  /** Knockback speed imparted on a direct hit. */
  hitKnock: number;
  /** Spear: passes through the first unit hit, continuing slower. */
  pierce?: boolean;
  maxTime: number;
}

export interface TrajectoryPoint { x: number; y: number; t: number }
export interface TrajectoryEvent { t: number; x: number; y: number; type: 'unit' | 'terrain' | 'timeout'; targetId?: number }
export interface Trajectory { points: TrajectoryPoint[]; events: TrajectoryEvent[]; end: TrajectoryEvent }

/**
 * Deterministically simulate a projectile until it hits terrain (or a unit, for non-piercing
 * projectiles). Sub-steps are short enough that nothing passes through a terrain cell. Explosions
 * happen at the last free position, so they resolve on the shooter's side of a wall.
 */
export function simulateTrajectory(
  t: Terrain, x: number, y: number, vx: number, vy: number, spec: ProjectileSpec,
  targets: Target[], ignoreId: number, targetTeam: string | null,
): Trajectory {
  const points: TrajectoryPoint[] = [{ x, y, t: 0 }];
  const events: TrajectoryEvent[] = [];
  const g = GRAVITY * spec.gravityScale;
  const hit = new Set<number>();
  let time = 0;
  const dt = 1 / 240;
  while (time < spec.maxTime) {
    const speed = Math.hypot(vx, vy);
    const sub = Math.max(1, Math.ceil((speed * dt) / 0.12));
    let ended: TrajectoryEvent | null = null;
    for (let i = 0; i < sub && !ended; i++) {
      const h = dt / sub;
      vy -= g * h;
      const nx = x + vx * h, ny = y + vy * h;
      if (t.solidAt(nx, ny) || nx < 0 || nx > t.width) {
        ended = { t: time, x, y, type: 'terrain' };
        break;
      }
      x = nx; y = ny;
      for (const u of targets) {
        if (!u.alive || u.id === ignoreId || hit.has(u.id)) continue;
        if (targetTeam && u.team !== targetTeam) continue;
        const r = spec.radius;
        if (x > u.x - u.w / 2 - r && x < u.x + u.w / 2 + r && y > u.y - r && y < u.y + u.h + r) {
          hit.add(u.id);
          const ev: TrajectoryEvent = { t: time, x, y, type: 'unit', targetId: u.id };
          if (spec.pierce) { events.push(ev); vx *= 0.6; vy *= 0.6; }
          else { ended = ev; }
          break;
        }
      }
    }
    time += dt;
    points.push({ x, y, t: time });
    if (ended) { events.push(ended); return { points, events, end: ended }; }
  }
  const end: TrajectoryEvent = { t: time, x, y, type: 'timeout' };
  events.push(end);
  return { points, events, end };
}

export function launchVelocity(angle: number, speed: number): { vx: number; vy: number } {
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}
