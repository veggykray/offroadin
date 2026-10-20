import { describe, it, expect } from 'vitest';
import { RIGS, INVENTOR_LEG_COUNT } from '../src/art/characters';
import { UNIT_DEFS, HERO_ORDER } from '../src/game/units';

const sources = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('Cast rigs', () => {
  it('every unit kind and the jackal has a rig', () => {
    for (const k of [...HERO_ORDER, 'raider', 'archer', 'jackal']) expect(RIGS[k], k).toBeDefined();
  });
  it('rig heights match the gameplay bodies so the camera scale rule holds', () => {
    for (const k of Object.keys(UNIT_DEFS) as (keyof typeof UNIT_DEFS)[]) expect(Math.abs(RIGS[k].height - UNIT_DEFS[k].h)).toBeLessThan(0.01);
    expect(RIGS.giant.height).toBeGreaterThan(RIGS.duelist.height * 1.6);
  });
  it("the fake wizard's machine has exactly six walking legs (three far, three near), each with two segments and a foot", () => {
    expect(INVENTOR_LEG_COUNT).toBe(6);
    const ids = RIGS.inventor.parts.map((p) => p.id);
    for (const row of ['b', 'f']) for (let i = 0; i < 3; i++) { expect(ids).toContain(`legU_${row}${i}`); expect(ids).toContain(`legL_${row}${i}`); expect(ids).toContain(`foot_${row}${i}`); }
    expect(ids).toContain('cannon'); expect(ids).toContain('head');
  });
  it('mentions no wheels anywhere in the source (mouse-wheel zoom aside)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    for (const [file, src] of Object.entries(sources)) {
      const cleaned = src.toLowerCase().replace(/no wheels/g, '').replace(/wheel zoom|<td>wheel\s*\/ right-drag<\/td>|'wheel'|mouse wheel|wheel\s*\/ right-drag/g, '');
      expect(cleaned.includes('wheel'), `${file} mentions wheels`).toBe(false);
    }
  });
  it('the beast master carries the bird and has a hatchet; the spearman has spear and sling parts', () => {
    expect(RIGS.beast.parts.some((p) => p.id === 'bird')).toBe(true);
    expect(RIGS.spear.parts.some((p) => p.id === 'weaponF')).toBe(true);
    expect(RIGS.spear.parts.some((p) => p.id === 'weaponB')).toBe(true);
    expect(RIGS.giant.parts.find((p) => p.id === 'weaponB')!.w).toBeGreaterThan(2); // the enormous shield
  });
});
