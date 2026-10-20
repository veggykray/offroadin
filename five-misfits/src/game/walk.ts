import { Terrain } from '../world/terrain';
import { type Body, moveX, jump, integrate, dropAhead, makeBody, GRAVITY } from '../world/physics';

export interface WalkParams {
  speed: number;
  jumpHeight: number;
  /** Largest drop the walker will willingly step off. */
  maxDrop: number;
}

export interface WalkStepResult { moved: number; blocked: boolean; jumped: boolean; cliff: boolean }

/**
 * One fixed frame of "walk toward dir" for an AI-driven body: cliff guard, step-up via moveX,
 * auto-jump when blocked, then gravity. Shared by enemies, the jackal and the headless
 * reachability simulation so previews and live runs agree exactly.
 */
export const JACKAL_WALK: WalkParams = { speed: 9, jumpHeight: 3.0, maxDrop: 8 };

export function walkStep(t: Terrain, b: Body, dir: number, p: WalkParams, dt: number, doIntegrate = true): WalkStepResult {
  let moved = 0, blocked = false, jumped = false, cliff = false;
  if (dir !== 0) {
    const want = dir * p.speed * dt;
    if (b.grounded) {
      const probe = b.x + dir * (Math.abs(want) + b.w / 2 + 0.1);
      const drop = dropAhead(t, b, probe, p.maxDrop + 0.01);
      if (drop !== 0 && p.jumpHeight > 0) {
        // Edge ahead: if there is a landing at or above our level within jump reach, leap for it.
        const airtime = 2 * Math.sqrt((2 * p.jumpHeight) / GRAVITY);
        const reach = p.speed * airtime;
        for (const k of [0.55, 0.72, 0.9]) {
          const landing = t.surfaceBelow(b.x + dir * (reach * k + b.w / 2), b.y + p.jumpHeight, p.jumpHeight + 0.5);
          if (landing !== null && landing <= b.y + p.jumpHeight - 0.4 && landing >= b.y - 0.5) { jumped = jump(b, p.jumpHeight); break; }
        }
      }
      if (drop === null && !jumped) cliff = true;
    }
    if (!cliff) {
      moved = moveX(t, b, want);
      if (Math.abs(moved) < Math.abs(want) * 0.5) {
        blocked = true;
        if (b.grounded && p.jumpHeight > 0) { jumped = jump(b, p.jumpHeight); if (jumped) moved += moveX(t, b, want - moved); }
      }
    }
  }
  if (doIntegrate) integrate(t, b, dt);
  return { moved, blocked, jumped, cliff };
}

export interface WalkSim {
  reached: boolean;
  /** Body snapshot per frame (x, y, grounded). */
  path: { x: number; y: number; grounded: boolean }[];
  end: Body;
  distance: number;
  reason: string;
}

export interface WalkGoal { x: number; y: number; reachDx: number; reachDy: number }

/** Headless simulation of walkStep toward a goal. Pure: works on a copy of the body and never mutates terrain. */
export function simulateWalk(t: Terrain, from: Body, goal: WalkGoal, p: WalkParams, maxSeconds: number, budget = Infinity): WalkSim {
  const b = makeBody(from.x, from.y, from.w, from.h, from.stepUp, from.footSpan);
  b.grounded = from.grounded; b.vx = 0; b.vy = 0;
  const path: WalkSim['path'] = [];
  const dt = 1 / 60;
  let distance = 0, stuckFrames = 0, lastX = b.x;
  const frames = Math.ceil(maxSeconds / dt);
  for (let i = 0; i < frames; i++) {
    const dx = goal.x - b.x, dy = goal.y - b.y;
    if (Math.abs(dx) <= goal.reachDx && Math.abs(dy) <= goal.reachDy && b.grounded) {
      return { reached: true, path, end: b, distance, reason: 'reached' };
    }
    const dir = distance >= budget ? 0 : Math.sign(dx);
    const r = walkStep(t, b, dir, p, dt);
    distance += Math.abs(r.moved);
    path.push({ x: b.x, y: b.y, grounded: b.grounded });
    if (dir === 0) { if (b.grounded && b.vy === 0) return { reached: false, path, end: b, distance, reason: 'out of movement' }; continue; }
    if (Math.abs(b.x - lastX) < 1e-6) stuckFrames++; else stuckFrames = 0;
    lastX = b.x;
    if (r.cliff && b.grounded) return { reached: false, path, end: b, distance, reason: 'a drop too high to risk' };
    if (stuckFrames > 45) return { reached: false, path, end: b, distance, reason: 'blocked by terrain' };
  }
  return { reached: false, path, end: b, distance, reason: 'too far' };
}
