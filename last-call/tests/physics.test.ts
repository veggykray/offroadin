import { describe, it, expect } from 'vitest';
import { Terrain, Mat } from '../src/world/terrain';
import { makeBody, integrate, moveX, jump, onGround } from '../src/world/physics';

const dt = 1 / 60;
function flat(): Terrain { const t = new Terrain(40, 20, 0.25); t.fillRect(0, 0, 40, 2, Mat.Stable); return t; }
function run(t: Terrain, b: ReturnType<typeof makeBody>, frames: number, dir = 0, speed = 6) {
  for (let i = 0; i < frames; i++) { if (dir) moveX(t, b, dir * speed * dt); integrate(t, b, dt); }
}

describe('Body physics', () => {
  it('falls and lands exactly on the surface', () => {
    const t = flat(); const b = makeBody(5, 6, 1, 3, 1);
    run(t, b, 120);
    expect(b.grounded).toBe(true); expect(b.y).toBe(2); expect(b.vy).toBe(0);
  });

  it('steps up ledges within stepUp and is blocked by taller walls', () => {
    const t = flat();
    t.fillRect(8, 2, 12, 3, Mat.Stable);    // 1-unit step
    t.fillRect(12, 2, 14, 5, Mat.Stable);   // 3-unit wall
    const b = makeBody(5, 2, 1, 3, 1); run(t, b, 2);
    run(t, b, 90, 1);
    expect(b.y).toBe(3);                     // stepped up
    expect(b.x).toBeLessThan(12);            // stopped by wall
    expect(b.x).toBeGreaterThan(11);
  });

  it('a jump clears a 2-unit ledge', () => {
    const t = flat(); t.fillRect(10, 2, 20, 4, Mat.Stable);
    const b = makeBody(7.5, 2, 1, 3, 1); run(t, b, 2);
    expect(jump(b, 2.8)).toBe(true);
    run(t, b, 90, 1);
    expect(b.y).toBe(4); expect(b.grounded).toBe(true);
  });

  it('six-legged foot span bridges small gaps but not wide ones', () => {
    const t = new Terrain(40, 20, 0.25);
    t.fillRect(0, 0, 40, 6, Mat.Stable);    // thick floor (top at 6) so pits are deep
    t.fillRect(10, 0, 12.5, 6, Mat.Air);    // 2.5 gap
    t.fillRect(20, 0, 23.5, 6, Mat.Air);    // 3.5 gap
    const walker = makeBody(5, 6, 2.4, 3.4, 2, 3.2); run(t, walker, 2);
    run(t, walker, 60 * 3, 1, 3.5);
    expect(walker.y).toBe(6); expect(walker.x).toBeGreaterThan(13);  // crossed the 2.5 gap
    run(t, walker, 60 * 3, 1, 3.5);
    expect(walker.y).toBeLessThan(6);                                 // fell into the 3.5 gap
    const human = makeBody(5, 6, 1, 3, 1); run(t, human, 2);
    run(t, human, 60 * 2, 1, 6);
    expect(human.y).toBeLessThan(6);                                  // human (no span) falls into the 2.5 gap
  });

  it('knockback velocity moves a body and decays', () => {
    const t = flat(); const b = makeBody(5, 2, 1, 3, 1); run(t, b, 2);
    b.vx = 8; b.vy = 5; b.grounded = false;
    run(t, b, 90);
    expect(b.x).toBeGreaterThan(6); expect(b.vx).toBe(0); expect(b.grounded).toBe(true);
    expect(onGround(t, b)).toBe(true);
  });
});
