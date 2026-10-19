import { describe, it, expect } from 'vitest';
import { Game } from '../src/game/game';
import { Mat } from '../src/world/terrain';
import { SPECS } from '../src/game/abilities';
import { ballisticAngles } from '../src/game/enemyAI';

describe('Projectiles and explosions', () => {
  it('cannon blast carves soil, spares stone, damages and knocks back an enemy', () => {
    const g = new Game({ seed: 3, skipIntro: true });
    const inv = g.hero('inventor')!;
    const raider = g.enemies[0];
    // Put the inventor on terrace 1 and the raider right on the soil wall edge.
    inv.body.x = 32; inv.body.y = 7; inv.body.grounded = true;
    raider.body.x = 42; raider.body.y = 11; raider.body.grounded = true;
    const stableBefore = g.terrain.countMat(Mat.Stable);
    const soilBefore = g.terrain.countMat(Mat.Soil);
    const hp = raider.hp;
    // Fire a shell that lands on the soil wall face (x=40, y 8.5..11): speed 24 -> power (24-14)/16
    const m = g.muzzle(inv);
    const angle = ballisticAngles(m, { x: 40.6, y: 9.6 }, 24)[1];
    g.selectHero(inv.id); g.setMode('signature');
    g.aim.angle = angle; g.aim.power = (24 - 14) / 16; g.aim.dir = 1;
    expect(g.confirm().ok).toBe(true);
    g.settle();
    expect(g.stats.explosions).toBeGreaterThanOrEqual(1); // the blast may also set off the powder barrel
    expect(g.terrain.countMat(Mat.Stable)).toBe(stableBefore);
    expect(g.terrain.countMat(Mat.Soil)).toBeLessThan(soilBefore);
    expect(raider.hp).toBeLessThan(hp);
    expect(raider.body.x).toBeGreaterThan(42.5); // knocked away from the blast
    expect(raider.body.grounded).toBe(true);
  });

  it('a shot never passes through solid terrain; it stops on the shooter side', () => {
    const g = new Game({ seed: 3, skipIntro: true });
    const inv = g.hero('inventor')!;
    inv.body.x = 32; inv.body.y = 7;
    const traj = g.previewTrajectory(inv, SPECS.shell, 0.05, 25); // flat shot into the terrace-2 soil wall
    expect(traj.end.type).toBe('terrain');
    expect(traj.end.x).toBeLessThan(40.01);
    expect(g.terrain.solidAt(traj.end.x, traj.end.y)).toBe(false);
    for (const p of traj.points) expect(g.terrain.solidAt(p.x, p.y)).toBe(false);
  });

  it('terrain destruction changes collision for bodies standing on it', () => {
    const g = new Game({ seed: 3, skipIntro: true });
    const raider = g.enemies[0];
    raider.body.x = 44; raider.body.y = 13; raider.body.grounded = true; // on the timber barricade
    g.step(5);
    expect(raider.body.y).toBe(13);
    g.explode(44, 12, { radius: 2.5, damage: 0, minDamage: 0, carve: 2.5, knockback: 0 }, -1);
    g.settle();
    expect(raider.body.y).toBeLessThan(13); // barricade gone -> fell
  });

  it('the powder barrel chain-detonates and exposes the hidden stone steps', () => {
    const g = new Game({ seed: 3, skipIntro: true });
    const barrel = g.barrels[0];
    expect(g.terrain.matAt(40.5, 9)).toBe(Mat.Soil);
    g.explode(barrel.x - 1.5, barrel.y + 0.5, { radius: 1.4, damage: 16, minDamage: 8, carve: 0.7, knockback: 5 }, -1);
    expect(barrel.alive).toBe(false);
    expect(g.terrain.matAt(40.5, 9)).toBe(Mat.Air);
    expect(g.terrain.matAt(41, 8)).toBe(Mat.Stable);
  });

  it('downed heroes are out but the mission continues; losing everyone is a defeat', () => {
    const g = new Game({ seed: 3, skipIntro: true });
    for (const h of g.heroes) g.damageUnit(h, 999, 0, 0, 'test');
    g.step(2);
    expect(g.phase).toBe('defeat');
    g.restart();
    expect(g.phase).toBe('player');
    expect(g.livingHeroes().length).toBe(5);
    expect(g.turn).toBe(1);
  });

  it('victory requires all enemies down and a hero on the goal platform', () => {
    const g = new Game({ seed: 3, skipIntro: true });
    for (const e of g.enemies) g.damageUnit(e, 999, 0, 0, 'test');
    g.step(2);
    expect(g.phase).toBe('player');
    const d = g.hero('duelist')!;
    d.body.x = 96; d.body.y = 9; d.body.grounded = true; d.body.vx = 0;
    g.step(2);
    expect(g.phase).toBe('victory');
  });
});
