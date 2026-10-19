import type { Terrain } from './terrain';

/** Axis-aligned body. (x, y) is the bottom-centre (feet). Vertical positions are quantised to STEP. */
export interface Body {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; yAcc: number;
  grounded: boolean;
  /** Max ledge height this body can walk up without jumping. */
  stepUp: number;
  /** Ground-sensing width; wider than w for the six-legged walker so it bridges small gaps. */
  footSpan: number;
}

export const GRAVITY = 32;
export const STEP = 0.0625;
export const MAX_FALL = 42;
const EPS = 1e-4;

export function makeBody(x: number, y: number, w: number, h: number, stepUp = 1, footSpan = 0): Body {
  return { x, y: snap(y), w, h, vx: 0, vy: 0, yAcc: 0, grounded: false, stepUp, footSpan };
}
export const snap = (y: number): number => Math.round(y / STEP) * STEP;

export function collides(t: Terrain, b: Body, x = b.x, y = b.y): boolean {
  return t.rectSolid(x - b.w / 2 + EPS, y + EPS, x + b.w / 2 - EPS, y + b.h - EPS);
}

/**
 * Ground under the feet. `useSpan` widens the probe to the foot span (six-legged walker):
 * used to STAY grounded over small gaps, never to land on a ledge beside the body.
 */
export function onGround(t: Terrain, b: Body, x = b.x, y = b.y, useSpan = true): boolean {
  const span = useSpan ? Math.max(b.w, b.footSpan) : b.w;
  return t.rectSolid(x - span / 2 + EPS, y - STEP * 0.8, x + span / 2 - EPS, y - EPS);
}

/** Move horizontally with step-up. Returns the signed distance actually moved. */
export function moveX(t: Terrain, b: Body, dx: number): number {
  if (dx === 0) return 0;
  const dir = Math.sign(dx);
  let remaining = Math.abs(dx), moved = 0;
  while (remaining > 1e-9) {
    const s = Math.min(STEP, remaining);
    const nx = b.x + dir * s;
    if (!collides(t, b, nx, b.y)) { b.x = nx; moved += s; remaining -= s; continue; }
    let stepped = false;
    if (b.grounded) {
      for (let up = STEP; up <= b.stepUp + 1e-9; up += STEP) {
        if (!collides(t, b, b.x, b.y + up) && !collides(t, b, nx, b.y + up)) {
          b.x = nx; b.y = snap(b.y + up); moved += s; remaining -= s; stepped = true; break;
        }
      }
    }
    if (!stepped) break;
  }
  return dir * moved;
}

export function jump(b: Body, height: number): boolean {
  if (!b.grounded || height <= 0) return false;
  b.vy = Math.sqrt(2 * GRAVITY * height) + 0.6; // small margin so the quantised rise reaches the full height
  b.grounded = false; b.yAcc = 0;
  return true;
}

/** Gravity, knockback velocity, vertical collision and landing. */
export function integrate(t: Terrain, b: Body, dt: number): void {
  if (b.vx !== 0) {
    const want = b.vx * dt;
    const got = moveX(t, b, want);
    if (Math.abs(got) < Math.abs(want) * 0.5) b.vx = 0;
    if (b.grounded) { b.vx *= Math.exp(-6 * dt); if (Math.abs(b.vx) < 0.4) b.vx = 0; }
  }
  if (b.grounded && !onGround(t, b)) b.grounded = false;
  if (!b.grounded) {
    b.vy = Math.max(-MAX_FALL, b.vy - GRAVITY * dt);
    b.yAcc += b.vy * dt;
    while (Math.abs(b.yAcc) >= STEP) {
      const s = Math.sign(b.yAcc) * STEP;
      if (collides(t, b, b.x, b.y + s)) {
        if (s < 0) { b.grounded = true; }
        b.vy = 0; b.yAcc = 0; break;
      }
      b.y = snap(b.y + s); b.yAcc -= s;
    }
    if (!b.grounded && b.vy <= 0 && onGround(t, b, b.x, b.y, false)) { b.grounded = true; b.vy = 0; b.yAcc = 0; }
  }
}

/** True when the body has come to rest (used to decide when a turn step is "settled"). */
export function atRest(t: Terrain, b: Body): boolean {
  return b.grounded && b.vx === 0 && b.vy === 0 && onGround(t, b);
}

/** Height of the drop in front of the body at x (0 if ground continues). null = bottomless within maxProbe. */
export function dropAhead(t: Terrain, b: Body, x: number, maxProbe: number): number | null {
  if (onGround(t, b, x, b.y)) return 0;
  const span = Math.max(b.w, b.footSpan) / 2 - EPS;
  let best: number | null = null;
  for (const px of [x - span, x, x + span]) {
    const s = t.surfaceBelow(px, b.y, maxProbe);
    if (s !== null) { const d = b.y - s; if (best === null || d < best) best = d; }
  }
  return best;
}

/** Push a body out of terrain if it ended up embedded (e.g. spawned inside a step). Searches upward. */
export function unstick(t: Terrain, b: Body, maxUp = 4): void {
  let up = 0;
  while (collides(t, b) && up < maxUp) { b.y = snap(b.y + STEP); up += STEP; }
}
