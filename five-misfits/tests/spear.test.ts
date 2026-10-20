import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/game';

describe('The one spear', () => {
  it('throw -> lands -> unusable until retrieved -> pick up by walking over -> throw again', () => {
    const g = new Game({ seed: 11, skipIntro: true });
    const v = g.hero('spear')!;
    g.selectHero(v.id);
    expect(g.setMode('signature').ok).toBe(true);
    g.aimAt(v.body.x + 6, v.body.y + 5);
    expect(g.confirm().ok).toBe(true);
    expect(g.spear.state).toBe('flying');
    g.settle();
    expect(g.spear.state).toBe('resting');
    expect(g.spear.body.grounded).toBe(true);
    const sx = g.spear.body.x;
    expect(sx).toBeGreaterThan(v.body.x);
    // next turn: signature refused with a reason, slingshot still fine
    g.endSquadTurn(); g.settle(60 * 40); g.step(60);
    expect(g.phase).toBe('player');
    g.selectHero(v.id);
    const r = g.setMode('signature');
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/lying at/);
    expect(v.acted).toBe(false);
    expect(g.setMode('basic').ok).toBe(true);
    g.cancel();
    // walk over the spear (jump when blocked), with a generous budget for the test
    v.moveLeft = 60;
    let n = 0, lastX = v.body.x, still = 0;
    while (g.spear.state !== 'held' && n < 900) {
      g.input.moveDir = Math.sign(g.spear.body.x - v.body.x) || 1;
      if (Math.abs(v.body.x - lastX) < 1e-6) still++; else still = 0;
      if (still > 8 && v.body.grounded) { g.input.jump = true; still = 0; }
      lastX = v.body.x;
      g.step(1); n++;
    }
    g.input.moveDir = 0;
    expect(g.spear.state).toBe('held');
    g.settle();
    expect(g.setMode('signature').ok).toBe(true);
    g.aimAt(v.body.x + 6, v.body.y + 5);
    expect(g.confirm().ok).toBe(true);
    expect(g.spear.state).toBe('flying');
    g.settle();
    expect(g.spear.state).toBe('resting');
  });

  it('a resting spear falls when the ground under it is destroyed, and stays inside the level', () => {
    const g = new Game({ seed: 11, skipIntro: true });
    g.spear.state = 'resting'; g.spear.body.x = 65.5; g.spear.body.y = 12; g.spear.body.grounded = true; // on the planks
    g.step(3);
    expect(g.spear.body.y).toBe(12);
    g.terrain.fillRect(64, 11, 67.5, 12, 0);
    g.step(1); g.settle();
    expect(g.spear.body.y).toBeLessThan(12);
    expect(g.spear.body.grounded).toBe(true);
    expect(g.spear.body.x).toBeGreaterThan(0); expect(g.spear.body.x).toBeLessThan(100);
  });

  it('piercing: the spear passes through the first enemy it hits and keeps flying', () => {
    const g = new Game({ seed: 11, skipIntro: true });
    const v = g.hero('spear')!; const raider = g.enemies[0];
    v.body.x = 30; v.body.y = 7; raider.body.x = 36; raider.body.y = 10; raider.body.grounded = true; // stall roof
    g.selectHero(v.id); g.setMode('signature');
    g.aimAt(36, 11.6);
    g.aim.power = 0.5;
    const hp = raider.hp;
    g.confirm(); g.settle();
    expect(raider.hp).toBe(hp - 35);
    expect(g.spear.body.x).toBeGreaterThan(36.5);
    expect(g.spear.state).toBe('resting');
  });
});
