import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/game';

describe('Squad / enemy phase rules', () => {
  it('runs player -> enemy -> player and refreshes heroes', () => {
    const g = new Game({ seed: 7, skipIntro: true });
    expect(g.phase).toBe('player');
    const d = g.hero('duelist')!;
    g.selectHero(d.id);
    g.input.moveDir = 1; g.step(30); g.input.moveDir = 0;
    expect(d.moved).toBe(true); expect(d.moveLeft).toBeLessThan(d.def.moveBudget);
    expect(g.endSquadTurn()).toBe(true);
    expect(g.phase).toBe('enemy');
    const frames = g.settle(60 * 40);
    expect(frames).toBeLessThan(60 * 40);
    // enemy phase ended on its own
    g.step(60);
    expect(g.phase).toBe('player');
    expect(g.turn).toBe(2);
    expect(d.moved).toBe(false); expect(d.acted).toBe(false); expect(d.moveLeft).toBe(d.def.moveBudget);
  });

  it('each hero gets exactly one action per squad turn', () => {
    const g = new Game({ seed: 7, skipIntro: true });
    const d = g.hero('duelist')!;
    g.selectHero(d.id);
    expect(g.setMode('basic').ok).toBe(true);
    g.aimAt(d.body.x + 10, d.body.y + 3);
    expect(g.confirm().ok).toBe(true);
    expect(d.acted).toBe(true);
    g.settle();
    expect(g.setMode('basic').ok).toBe(false);
    expect(g.setMode('signature').ok).toBe(false);
    expect(g.confirm().ok).toBe(false);
    // another hero can still act
    const s = g.hero('spear')!;
    g.selectHero(s.id);
    expect(g.setMode('basic').ok).toBe(true);
  });

  it('every enemy acts at most once per enemy phase, in order, with an explainable intent', () => {
    const g = new Game({ seed: 7, skipIntro: true });
    g.endSquadTurn();
    g.settle(60 * 40); g.step(60);
    for (const e of g.livingEnemies()) expect(e.intent.length).toBeGreaterThan(0);
    const logs = g.messages.filter((m) => /Raider|Archer/.test(m.text)).length;
    expect(logs).toBeGreaterThanOrEqual(3);
    expect(logs).toBeLessThanOrEqual(8);
  });

  it('cannot end the turn while something is still moving', () => {
    const g = new Game({ seed: 7, skipIntro: true });
    const inv = g.hero('inventor')!;
    g.selectHero(inv.id); g.setMode('signature'); g.aimAt(inv.body.x + 12, inv.body.y + 10); g.confirm();
    expect(g.projectiles.length).toBe(1);
    expect(g.endSquadTurn()).toBe(false);
    g.settle();
    expect(g.endSquadTurn()).toBe(true);
  });

  it('selection works by index and by id, never for downed heroes', () => {
    const g = new Game({ seed: 7, skipIntro: true });
    for (let i = 0; i < 5; i++) { expect(g.selectByIndex(i)).toBe(true); expect(g.selected!.team).toBe('hero'); }
    const b = g.hero('beast')!;
    g.damageUnit(b, 999, 0, 0, 'test');
    expect(b.alive).toBe(false);
    expect(g.selectHero(b.id)).toBe(false);
  });
});
