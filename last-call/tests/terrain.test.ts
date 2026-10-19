import { describe, it, expect } from 'vitest';
import { Terrain, Mat } from '../src/world/terrain';

describe('Terrain grid', () => {
  it('fills and queries cells in world units', () => {
    const t = new Terrain(10, 10, 0.25);
    t.fillRect(2, 2, 4, 3, Mat.Soil);
    expect(t.solidAt(3, 2.5)).toBe(true);
    expect(t.solidAt(3, 3.5)).toBe(false);
    expect(t.rectSolid(0, 0, 1.9, 1.9)).toBe(false);
    expect(t.rectSolid(1.9, 1.9, 2.1, 2.1)).toBe(true);
    expect(t.surfaceBelow(3, 6, 10)).toBe(3);
  });

  it('carving removes soil and timber but never stable stone', () => {
    const t = new Terrain(20, 20, 0.25);
    t.fillRect(0, 0, 20, 2, Mat.Stable);
    t.fillRect(0, 2, 20, 4, Mat.Soil);
    t.fillRect(8, 4, 12, 6, Mat.Timber);
    const stableBefore = t.countMat(Mat.Stable);
    const removed = t.carveCircle(10, 3, 2.5);
    expect(removed.length).toBeGreaterThan(0);
    expect(t.countMat(Mat.Stable)).toBe(stableBefore);
    expect(t.solidAt(10, 3)).toBe(false);      // soil gone
    expect(t.solidAt(10, 1)).toBe(true);       // stone intact
    expect(t.solidAt(10, 4.5)).toBe(false);    // timber gone (within bonus radius)
    expect(t.solidAt(1, 3)).toBe(true);        // far soil intact
    expect(t.removedCells).toBe(removed.length);
  });

  it('clone is independent', () => {
    const t = new Terrain(4, 4, 0.25);
    t.fillRect(0, 0, 4, 1, Mat.Soil);
    const c = t.clone();
    c.carveCircle(2, 0.5, 1);
    expect(t.solidAt(2, 0.5)).toBe(true);
    expect(c.solidAt(2, 0.5)).toBe(false);
  });

  it('treats the world edges as stone and the sky as air', () => {
    const t = new Terrain(4, 4, 0.25);
    expect(t.solidAt(-1, 1)).toBe(true);
    expect(t.solidAt(5, 1)).toBe(true);
    expect(t.solidAt(1, 10)).toBe(false);
  });
});
