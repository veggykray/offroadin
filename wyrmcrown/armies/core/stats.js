/* WYRMCROWN — GROUND ARMIES: troop profiles.
 * A profile is what the army layer needs to know about one kind of soldier,
 * read straight from the existing troop data — nothing is invented here:
 *
 *   AS.Conquest.Data.troops[id]  campaign troop type: base role + multipliers
 *                                (applied exactly as conquest/core/battle.js
 *                                spawn() applies them: hp, melee dmg, range, speed)
 *   AS.Data.troops[role]         the battle-mode role: hp, armour, speed, size,
 *                                melee, ranged, thrown rocks, regeneration
 *
 * A troop id may be either a campaign type ('h_soldier') or a battle role
 * ('troll'), so wild defenders can be listed by role as the realm lists them.
 *
 * Missile damage is not in the troop records; the real-time game keeps it in
 * AS.Combat.shoot (src/game/combat.js) and doubles catapult stones in
 * AS.Troop.attack (src/game/troops.js). WEAPON mirrors those numbers, and
 * tools/test_armies.mjs reads combat.js to prove they still match. */
'use strict';
(function (AS) {
  // per-shot damage and blast radius, as AS.Combat.shoot fires them
  const WEAPON = {
    arrow: { dmg: 4.5, radius: 0 },
    spear: { dmg: 7, radius: 0 },
    crossbow: { dmg: 7, radius: 0 },
    ballista: { dmg: 42, radius: 0 },
    magic: { dmg: 14, radius: 0 },
    stone: { dmg: 46, radius: 44 },
    rock: { dmg: 34, radius: 26 },
  };
  const STONE_MUL = 2; // AS.Troop.attack: dmgMul 2 for catapult stones at ground targets

  const cache = new Map();
  const Stats = {
    WEAPON, STONE_MUL,
    // the campaign type behind an id, if it is one
    type(id) { return (AS.Conquest && AS.Conquest.Data && AS.Conquest.Data.troops && AS.Conquest.Data.troops[id]) || null; },
    known(id) { return !!(this.type(id) || AS.Data.troops[id]); },
    profile(id) {
      let p = cache.get(id);
      if (p) return p;
      const t = this.type(id);
      const role = t ? t.base : id;
      const d = AS.Data.troops[role];
      if (!d) throw new Error('Armies: unknown troop "' + id + '"');
      const mul = (t && t.mul) || {};
      const melee = d.melee ? { dmg: d.melee.dmg * (mul.dmg || 1), rate: d.melee.rate, range: d.melee.range, splash: d.melee.splash || 0 } : null;
      const missiles = [];
      if (d.ranged) {
        const w = WEAPON[d.ranged.kind] || WEAPON.arrow;
        missiles.push({ kind: d.ranged.kind, dmg: w.dmg * (d.ranged.kind === 'stone' ? STONE_MUL : 1), radius: w.radius, rate: d.ranged.rate, range: d.ranged.range * (mul.range || 1), building: !!d.ranged.buildingPref });
      }
      // thrown rocks: ogres, trolls and giants hurl them at ground foes beyond arm's reach
      if (d.throwRock) missiles.push({ kind: 'rock', dmg: WEAPON.rock.dmg, radius: WEAPON.rock.radius, rate: d.throwRock.rate, range: d.throwRock.range, opening: true });
      const allegiance = t ? t.allegiance : null, tag = t ? t.tag : null;
      p = {
        id, role, name: t ? t.name : d.name,
        hp: d.hp * (mul.hp || 1), armor: d.armor || 0, r: d.r, speed: d.speed * (mul.speed || 1),
        big: !!d.big || d.r >= 11, melee, missiles, regen: d.regen || 0,
        siege: missiles.some((m) => m.building),
        // the risen and the dead do not break and run
        fearless: allegiance === 'undead' || tag === 'dead' || role === 'skeleton',
        animal: !!d.animal, flying: !!(t && t.flying),
        leadership: t ? t.leadership : Math.max(4, Math.round(d.hp / 5)),
      };
      cache.set(id, p);
      return p;
    },
    // damage one blow does to a target in armour (AS.Entity.takeDamage)
    afterArmor(dmg, armor) { return armor > 0 ? Math.max(dmg * 0.4, dmg - armor) : dmg; },
    // a stack's march speed is its slowest soldier's
    stackSpeed(stacks) {
      let v = Infinity;
      for (const s of stacks) if (s.count > 0) v = Math.min(v, this.profile(s.troop).speed);
      return v === Infinity ? 0 : v;
    },
    count(stacks) { let n = 0; for (const s of stacks) n += s.count; return n; },
    totalHp(stacks) { let h = 0; for (const s of stacks) h += s.count * this.profile(s.troop).hp - (s.wounds || 0); return Math.max(0, h); },
    // a rough fighting weight (hp × damage per second), for AI choices and readouts only
    power(stacks) {
      let w = 0;
      for (const s of stacks) {
        if (s.count <= 0) continue;
        const p = this.profile(s.troop);
        let dps = p.melee ? p.melee.dmg * p.melee.rate : 0;
        for (const m of p.missiles) if (!m.opening) dps = Math.max(dps, m.dmg * m.rate);
        w += s.count * Math.sqrt(p.hp * (1 + p.armor * 0.15) * dps);
      }
      return w;
    },
    clear() { cache.clear(); },
  };
  AS.Armies.Stats = Stats;
})(window.AS);
