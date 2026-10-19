import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/game';

describe('Signature abilities validate physically', () => {
  it('jackal refuses an unreachable target (archer on the perch) without spending the action', () => {
    const g = new Game({ seed: 5, skipIntro: true });
    const b = g.hero('beast')!; const archer = g.enemies[2];
    g.selectHero(b.id); g.setMode('signature');
    g.aim.targetId = archer.id;
    const res = g.confirm();
    expect(res.ok).toBe(false); expect(res.reason).toMatch(/can't reach/);
    expect(b.acted).toBe(false);
  });

  it('jackal runs a real path to a reachable raider, bites, and settles on ground', () => {
    const g = new Game({ seed: 5, skipIntro: true });
    const b = g.hero('beast')!; const raider = g.enemies[0];
    b.body.x = 30; b.body.y = 7; g.jackal.body.x = 28.5; g.jackal.body.y = 7; g.jackal.body.grounded = true;
    raider.body.x = 36; raider.body.y = 10; raider.body.grounded = true; // on the stall roof: needs crate + jump
    g.step(2);
    g.selectHero(b.id); g.setMode('signature'); g.aim.targetId = raider.id;
    const hp = raider.hp;
    expect(g.confirm().ok).toBe(true);
    g.settle(60 * 20);
    expect(raider.hp).toBe(hp - 20);
    expect(g.jackal.state).toBe('heel');
    expect(g.jackal.body.grounded).toBe(true);
    expect(g.terrain.rectSolid(g.jackal.body.x - 0.7, g.jackal.body.y + 0.01, g.jackal.body.x + 0.7, g.jackal.body.y + 0.8)).toBe(false);
  });

  it('shield charge breaks timber, stops at stone, and never runs off a cliff', () => {
    const g = new Game({ seed: 5, skipIntro: true });
    const gi = g.hero('giant')!;
    gi.body.x = 14; gi.body.y = 10; gi.body.grounded = true; // courtyard, timber cover at x 20-22
    g.step(2);
    g.selectHero(gi.id); g.setMode('signature'); g.aim.dir = 1;
    const pv = g.preview ?? g.ability(gi, 'signature')!.preview(g, gi, g.aim);
    expect(pv.ok).toBe(true);
    expect(g.confirm().ok).toBe(true);
    g.settle(60 * 10);
    expect(g.terrain.matAt(21, 11)).toBe(0);               // timber cover smashed
    expect(gi.body.x).toBeGreaterThan(22);
    expect(gi.body.grounded).toBe(true);
    // charge toward the bridge gap from the west deck stops at the edge once the planks are gone
    g.terrain.fillRect(64, 11, 67.5, 12, 0);
    gi.body.x = 58; gi.body.y = 12; gi.acted = false; g.step(2);
    g.setMode('signature'); g.aim.dir = 1;
    g.confirm(); g.settle(60 * 10);
    expect(gi.body.x).toBeLessThan(64); expect(gi.body.y).toBe(12);
  });

  it('show-off needs footing and a clear path; otherwise refuses without spending the action', () => {
    const g = new Game({ seed: 5, skipIntro: true });
    const d = g.hero('duelist')!; const raider = g.enemies[0]; const archer = g.enemies[2];
    g.selectHero(d.id); g.setMode('signature');
    g.aim.targetId = archer.id;                   // far away
    expect(g.confirm().ok).toBe(false); expect(d.acted).toBe(false);
    d.body.x = 46; d.body.y = 11; d.body.grounded = true; raider.body.x = 49.5; raider.body.y = 11; raider.body.grounded = true;
    g.step(2);
    g.setMode('signature'); g.aim.targetId = raider.id;
    const hp = raider.hp;
    expect(g.confirm().ok).toBe(true);
    g.settle(60 * 5);
    expect(raider.hp).toBe(hp - 40);
    expect(Math.abs(d.body.x - 48)).toBeLessThan(0.3);
    expect(d.body.grounded).toBe(true);
  });

  it('the inventor cannot jump and the giant hits the barrel with a strike', () => {
    const g = new Game({ seed: 5, skipIntro: true });
    const inv = g.hero('inventor')!;
    g.selectHero(inv.id); g.input.jump = true; g.step(1);
    expect(inv.body.grounded).toBe(true);
    expect(g.messages.some((m) => /cannot jump/.test(m.text))).toBe(true);
    const gi = g.hero('giant')!; gi.body.x = 36.8; gi.body.y = 7; gi.body.grounded = true; g.step(1);
    g.selectHero(gi.id); g.setMode('basic'); g.aim.dir = 1;
    expect(g.confirm().ok).toBe(true);
    expect(g.barrels[0].alive).toBe(false);
  });
});
