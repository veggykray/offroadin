import { describe, it, expect } from 'vitest';
import { INVENTOR_LEGS } from '../src/render/renderer';
import { UNIT_DEFS } from '../src/game/units';

const sources = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe("The inventor's walker", () => {
  it('has exactly six legs', () => { expect(INVENTOR_LEGS).toBe(6); });
  it('cannot jump, climbs 2-unit ledges and bridges gaps under its leg span', () => {
    const d = UNIT_DEFS.inventor;
    expect(d.jumpHeight).toBe(0); expect(d.stepUp).toBe(2); expect(d.footSpan).toBeGreaterThan(d.w);
  });
  it('has no wheels anywhere in model, rules or HUD copy (mouse-wheel zoom aside)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    for (const [file, src] of Object.entries(sources)) {
      const cleaned = src.toLowerCase()
        .replace(/there are no wheels/g, '')
        .replace(/wheel zoom|<td>wheel<\/td>|'wheel'|mouse wheel/g, '');
      expect(cleaned.includes('wheel'), `${file} mentions wheels`).toBe(false);
    }
  });
});
