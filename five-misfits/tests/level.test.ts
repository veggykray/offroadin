import { describe, it, expect } from 'vitest';
import { buildLevel, LEVEL_W, LEVEL_H } from '../src/world/level';
import { Mat } from '../src/world/terrain';
import { makeBody, collides, onGround } from '../src/world/physics';
import { simulateWalk } from '../src/game/walk';
import { UNIT_DEFS } from '../src/game/units';

const HUMAN = { speed: 6, jumpHeight: 2.8, maxDrop: 12 };
const GIANT = { speed: 5, jumpHeight: 1.8, maxDrop: 12 };
const WALKER = { speed: 3.5, jumpHeight: 0, maxDrop: 12 };

describe('Authored level', () => {
  const lvl = buildLevel();
  const t = lvl.terrain;

  it('is 16:9 and ~100 units wide', () => {
    expect(LEVEL_W).toBe(100); expect(LEVEL_W / LEVEL_H).toBeCloseTo(16 / 9, 5);
  });

  it('spawns every unit on solid ground, not inside terrain', () => {
    for (const s of [...lvl.heroes, ...lvl.enemies]) {
      const d = UNIT_DEFS[s.kind as keyof typeof UNIT_DEFS];
      const b = makeBody(s.x, s.y, d.w, d.h, d.stepUp, d.footSpan);
      expect(collides(t, b), `${s.kind} embedded`).toBe(false);
      expect(onGround(t, b), `${s.kind} floating`).toBe(true);
    }
  });

  it('has timber planks on the crossing and a stable goal platform', () => {
    expect(t.matAt(65, 11.5)).toBe(Mat.Timber);
    expect(t.matAt(96, 8.5)).toBe(Mat.Stable);
    expect(t.matAt(62, 11.5)).toBe(Mat.Stable);
  });

  it('humans can walk from the tavern to the market stall roof and on to terrace 2', () => {
    const b = makeBody(8, 10, 1.0, 3.0, 1); b.grounded = true;
    const sim = simulateWalk(t, b, { x: 42.5, y: 11, reachDx: 0.6, reachDy: 0.5 }, HUMAN, 30);
    expect(sim.reached, sim.reason).toBe(true);
  });

  it('the powder barrel opens a direct ground shortcut up to terrace 2 (hidden stone steps)', () => {
    // A non-jumping stepper (1.5-unit steps) standing by the barrel: the sheer 4-unit soil wall blocks it...
    const STEPPER = { speed: 5, jumpHeight: 0, maxDrop: 12 };
    const b = makeBody(37, 7, 1.0, 3.0, 1.5); b.grounded = true;
    const before = simulateWalk(t, b, { x: 42.3, y: 11, reachDx: 0.8, reachDy: 0.5 }, STEPPER, 20);
    expect(before.reached).toBe(false);
    // ...until the barrel blast strips the soil and exposes the stable steps underneath.
    const t2 = t.clone();
    t2.carveCircle(39, 7.75, 4.5); // powder barrel blast
    expect(t2.matAt(41, 8.25)).toBe(Mat.Stable); // hidden stone step exposed, intact
    const after = simulateWalk(t2, b, { x: 42.3, y: 11, reachDx: 0.8, reachDy: 0.5 }, STEPPER, 20);
    expect(after.reached, after.reason).toBe(true);
  });

  it('the six-legged walker can take the lower route: riverbed, stairs, field, goal', () => {
    const b = makeBody(65, 2, 2.4, 3.4, 2.0, 3.2); b.grounded = true;
    const sim = simulateWalk(t, b, { x: 96, y: 9, reachDx: 1.5, reachDy: 0.5 }, WALKER, 60);
    expect(sim.reached, sim.reason).toBe(true);
  });

  it('the giant can also take the riverbed and the stairs to the goal', () => {
    const b = makeBody(65, 2, 2.2, 5.5, 1.2); b.grounded = true;
    const sim = simulateWalk(t, b, { x: 96, y: 9, reachDx: 1.5, reachDy: 0.5 }, GIANT, 60);
    expect(sim.reached, sim.reason).toBe(true);
  });

  it('victory stays reachable with the planks destroyed (humans jump the gap, or everyone uses the riverbed)', () => {
    const t2 = t.clone();
    t2.fillRect(64, 11, 67.5, 12, Mat.Air);
    const human = makeBody(58, 12, 1.0, 3.0, 1); human.grounded = true;
    const over = simulateWalk(t2, human, { x: 96, y: 9, reachDx: 1.5, reachDy: 0.5 }, HUMAN, 60);
    expect(over.reached, over.reason).toBe(true);
    const walker = makeBody(58, 12, 2.4, 3.4, 2.0, 3.2); walker.grounded = true;
    const low = simulateWalk(t2, walker, { x: 96, y: 9, reachDx: 1.5, reachDy: 0.5 }, WALKER, 90);
    expect(low.reached, low.reason).toBe(true); // falls through the gap, then the riverbed route
  });
});
