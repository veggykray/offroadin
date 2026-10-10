/* WYRMCROWN — AUTO-RESOLVE: a fight settled without playing it, from the same
 * troop statistics the real-time battle uses.
 *
 * Pure: no realm, no randomness beyond a seed. A side is
 *   { stacks: {key: count}, wounds: {key: 0..1 health of the stack's survivors},
 *     morale: 0..100, cmdr: commander record (data/commanders.js) or null,
 *     defending: bool, name }
 * where a key is a Conquest troop type (conquest/data/troops.js: its `base` battle
 * record scaled by `mul`) or a battle troop key (AS.Data.troops, as guardians and
 * monsters are). Nothing here keeps its own troop numbers.
 *
 * The fight is fought in rounds of ROUND seconds of "battle time":
 *   - frontage: only so many fighters reach the enemy at once (a tunnel holds six
 *     abreast, a cavern twelve, a pass ten, the open field everyone); big creatures
 *     take more room; archers shoot over the front rank only where there is room
 *   - damage: each fighter's damage per second, per blow (melee, missiles, thrown
 *     rocks) against the target's armour exactly as Entity.takeDamage reduces it
 *   - terrain: tunnels hamper bows and siege engines and cramp giants; creatures of
 *     the deep fight better in the dark; a pass or a fort favours its defenders
 *   - commanders: attack, defence, morale, underground skill, troop-type advantages
 *   - morale: losses and being outmatched wear it down; a side below BREAK routs
 *     and the winner cuts down some of the fleeing (one round at 30%). Undead barely care.
 *   - casualties come out of each stack's pooled health, so wounded survivors stay
 *     wounded (wounds), and a stack loses whole soldiers only as their health runs out
 *
 * resolve(A, B, ctx) → result (the same shape a future playable battle must return):
 *   { method: 'auto', winner: 'A'|'B'|null, retreat: 'A'|'B'|null, rounds,
 *     A: { before, after, lost, wounds, morale }, B: {…}, cmdr: { A: fate|null, B: fate|null },
 *     log: [lines] }
 * ctx: { terrain: 'open'|'pass'|'fort'|'tunnel'|'cavern', seed, retreat: 'A'|'B' (that
 *        side withdraws at once: one round of pursuit), maxRounds } */
'use strict';
(function (AS) {
  const ROUND = 2;          // seconds of fighting per round
  const BREAK = 20;         // morale below which a side routs
  // missile damage per shot, as AS.Combat.shoot fires them (src/game/combat.js); a troop
  // catapult's stone counts double against the ground (troops.js attack)
  const SHOT = { arrow: 4.5, crossbow: 7, spear: 7, ballista: 42, magic: 14, stone: 92, rock: 34 };
  const TERRAIN = {
    open:   { front: 1e9, ranged: 1, siege: 1, big: 1, native: 1, defend: 1.1 },
    pass:   { front: 10, ranged: 0.85, siege: 0.6, big: 0.9, native: 1, defend: 1.3 },
    fort:   { front: 14, ranged: 1.1, siege: 1.3, big: 1, native: 1, defend: 1.5 },
    cavern: { front: 12, ranged: 0.75, siege: 0.3, big: 0.9, native: 1.15, defend: 1.15 },
    tunnel: { front: 6, ranged: 0.5, siege: 0.15, big: 0.7, native: 1.2, defend: 1.25 },
  };
  const UNDER = { tunnel: 1, cavern: 1 };
  // creatures at home underground
  const NATIVE = { troll: 1, skeleton: 1, gravehound: 1, spindlelurker: 1, carrioncrawler: 1, greatbeetle: 1, icecrawler: 1, u_skeleton: 1, n_troll: 1, n_frosttroll: 1, n_blighttroll: 1 };

  const AR = {
    ROUND, BREAK, TERRAIN, SHOT,
    // the fighting numbers of one soldier of a key, from the battle records
    stats(key) {
      const C = AS.Conquest && AS.Conquest.Data && AS.Conquest.Data.troops[key];
      const baseKey = C ? C.base : key, B = AS.Data.troops[baseKey];
      if (!B) return null;
      const m = (C && C.mul) || {};
      const melee = B.melee ? { blow: B.melee.dmg * (m.dmg || 1), rate: B.melee.rate, splash: B.melee.splash ? 1 + B.melee.splash / 14 : 1 } : null;
      let shot = null;
      if (B.ranged) shot = { blow: SHOT[B.ranged.kind] || 5, rate: B.ranged.rate };
      else if (B.throwRock) shot = { blow: SHOT.rock, rate: B.throwRock.rate };
      const cls = baseKey === 'siege' ? 'siege' : B.ranged ? 'ranged' : (B.big || B.hp > 250) ? 'big' : B.animal ? 'beast' : (B.armor || 0) >= 3 ? 'heavy' : 'foot';
      const undead = baseKey === 'skeleton' || (C && C.allegiance === 'undead') || (C && C.tag === 'dead');
      return { key, base: baseKey, hp: B.hp * (m.hp || 1), armor: B.armor || 0, melee, shot, cls, room: B.big ? 4 : B.hp > 250 ? 2 : 1, undead: !!undead, native: !!(NATIVE[key] || NATIVE[baseKey]) };
    },
    // damage per second one soldier deals to a target of the given armour
    dps(s, armor, T, ranks) {
      const hit = (b) => Math.max(b * 0.4, b - armor);
      let d = 0;
      if (s.melee) d += hit(s.melee.blow) * s.melee.rate * s.melee.splash;
      if (s.shot) {
        let k = s.cls === 'siege' ? T.siege : T.ranged;
        if (!ranks) k *= 0.6; // no room behind the front: bows fire over shoulders or not at all
        const sd = hit(s.shot.blow) * s.shot.rate * k;
        d = s.cls === 'ranged' || s.cls === 'siege' ? Math.max(d, sd) : d + sd * 0.5;
      }
      return d;
    },
    count(stacks) { let n = 0; for (const k in stacks) n += stacks[k]; return n; },

    resolve(A0, B0, ctx) {
      ctx = ctx || {};
      const T = TERRAIN[ctx.terrain] || TERRAIN.open, under = !!UNDER[ctx.terrain];
      const rng = new AS.U.RNG((ctx.seed >>> 0) || 1);
      const log = [];
      const side = (S, tag) => {
        const st = {};
        for (const k in S.stacks) {
          const n = S.stacks[k] | 0; if (n <= 0) continue;
          const s = this.stats(k); if (!s) continue;
          const w = S.wounds && S.wounds[k] !== undefined ? AS.U.clamp(S.wounds[k], 0.05, 1) : 1;
          st[k] = { s, n, pool: n * s.hp * w };
        }
        const c = S.cmdr || null, tr = (c && c.traits) || {};
        return { tag, name: S.name || tag, st, cmdr: c, tr, defending: !!S.defending,
          morale: AS.U.clamp((S.morale === undefined ? 80 : S.morale) + (tr.morale || 0), 0, 130), before: this.alive(st), start: this.count(this.alive(st)) };
      };
      const A = side(A0, 'A'), B = side(B0, 'B');
      const total = (X) => { let n = 0; for (const k in X.st) n += X.st[k].n; return n; };
      const hpOf = (X) => { let h = 0; for (const k in X.st) h += X.st[k].pool; return h; };
      // the damage one side deals the other in one round
      const strike = (X, Y, k) => {
        // who reaches the enemy: front first (foot, heavy, big, beasts), then shooters behind if there is room
        let room = T.front, front = 0;
        const order = Object.values(X.st).filter((q) => q.n > 0).sort((a, b) => (a.s.cls === 'ranged' || a.s.cls === 'siege' ? 1 : 0) - (b.s.cls === 'ranged' || b.s.cls === 'siege' ? 1 : 0));
        let out = 0;
        // the enemy's armour, weighted by numbers
        let arm = 0, an = 0; for (const q of Object.values(Y.st)) if (q.n > 0) { arm += q.s.armor * q.n; an += q.n; }
        arm = an ? arm / an : 0;
        for (const q of order) {
          const shooter = q.s.cls === 'ranged' || q.s.cls === 'siege';
          let n = q.n;
          if (!shooter) { const fit = Math.max(0, Math.floor(room / q.s.room)); n = Math.min(n, fit); room -= n * q.s.room; front += n; }
          else if (T.front < 1e8) n = Math.min(n, Math.max(1, Math.floor(T.front * 0.75))); // a narrow place: few can shoot
          if (n <= 0) continue;
          let m = 1;
          if (q.s.cls === 'big') m *= T.big;
          if (under && q.s.native) m *= T.native;
          const tm = X.tr.troops || {};
          m *= tm[q.s.key] || tm[q.s.base] || 1;
          out += this.dps(q.s, arm, T, front > 0 || T.front > 1e8) * n * m;
        }
        let mul = (X.tr.attack || 1) * (under ? X.tr.underground || 1 : 1) * (ctx.siege && X.tag === ctx.attacker ? X.tr.siege || 1 : 1);
        mul *= 0.6 + 0.4 * AS.U.clamp(X.morale, 0, 100) / 100;
        const def = (Y.tr.defence || 1) * (under ? Math.sqrt(Y.tr.underground || 1) : 1) * (Y.defending ? T.defend : 1);
        return out * mul / def * ROUND * k * (0.9 + rng.next() * 0.2);
      };
      // spread damage over the enemy's stacks: the front line takes most of it
      const take = (Y, dmg) => {
        const live = Object.values(Y.st).filter((q) => q.n > 0);
        let wsum = 0; const w = live.map((q) => { const x = q.n * (q.s.cls === 'ranged' || q.s.cls === 'siege' ? 0.6 : 1.4) * q.s.room; wsum += x; return x; });
        let lost = 0;
        live.forEach((q, i) => {
          q.pool = Math.max(0, q.pool - dmg * w[i] / (wsum || 1));
          const n = Math.ceil(q.pool / q.s.hp - 1e-6);
          lost += q.n - n; q.n = n;
        });
        return lost;
      };
      const wear = (X, lost, Y) => {
        // the dead hardly fear death: morale falls slower the more of the side is undead
        let nu = 0, nn = 0; for (const q of Object.values(X.st)) { nn += q.n; if (q.s.undead) nu += q.n; }
        const fear = 1 - 0.75 * (nn ? nu / nn : 0);
        const ratio = hpOf(Y) / Math.max(1, hpOf(X));
        X.morale -= (lost / Math.max(1, X.start) * 85 + (ratio > 1.5 ? 3 : 0)) * fear;
      };
      let rounds = 0, winner = null, retreat = null;
      const maxR = ctx.maxRounds || 40;
      if (ctx.retreat) {
        // a withdrawal before the fight is joined: one round of pursuit, nothing back
        const R = ctx.retreat === 'A' ? A : B, P = R === A ? B : A;
        const l = take(R, strike(P, R, 0.35));
        retreat = R.tag; winner = P.tag; rounds = 1;
        log.push(R.name + ' withdraws; ' + l + ' fall in the pursuit');
      } else {
        while (rounds < maxR && total(A) > 0 && total(B) > 0) {
          rounds++;
          const dA = strike(A, B, 1), dB = strike(B, A, 1);
          const lb = take(B, dA), la = take(A, dB);
          wear(A, la, B); wear(B, lb, A);
          if (la || lb) log.push('round ' + rounds + ': ' + A.name + ' lose ' + la + ', ' + B.name + ' lose ' + lb);
          const aBreak = A.morale < BREAK && total(A) > 0, bBreak = B.morale < BREAK && total(B) > 0;
          if (aBreak || bBreak) {
            // the side worse off runs; the other cuts down some as they flee
            const R = aBreak && (!bBreak || A.morale <= B.morale) ? A : B, P = R === A ? B : A;
            const l = take(R, strike(P, R, 0.3));
            retreat = R.tag; winner = P.tag;
            log.push(R.name + ' break and run; ' + l + ' more fall in the rout');
            break;
          }
        }
        if (!winner) {
          if (total(A) <= 0 && total(B) > 0) winner = 'B';
          else if (total(B) <= 0 && total(A) > 0) winner = 'A';
          else if (total(A) > 0 && total(B) > 0) {
            // nobody broke in time: the attacker gives up
            const att = ctx.attacker || 'A';
            winner = att === 'A' ? 'B' : 'A'; retreat = att;
            log.push('neither side breaks; ' + (att === 'A' ? A.name : B.name) + ' pull back');
          }
        }
      }
      // what is left of each side
      const sum = (X) => {
        const after = {}, wounds = {}, lost = {};
        for (const k in X.st) {
          const q = X.st[k];
          lost[k] = X.before[k] - q.n;
          if (q.n > 0) { after[k] = q.n; wounds[k] = +(q.pool / (q.n * q.s.hp)).toFixed(3); }
        }
        return { before: Object.assign({}, X.before), after, lost, wounds, morale: Math.round(AS.U.clamp(X.morale, 0, 100)) };
      };
      const res = { method: 'auto', terrain: ctx.terrain || 'open', winner, retreat, rounds, A: sum(A), B: sum(B), cmdr: { A: null, B: null }, log };
      // the commanders' fate: wiped out with the enemy still standing means captured;
      // routed means a chance of being wounded out of the fight; the victor rarely
      for (const X of [A, B]) {
        if (!X.cmdr) continue;
        const r = res[X.tag], left = this.count(r.after), was = this.count(r.before), lostK = was ? 1 - left / was : 1;
        if (!left) res.cmdr[X.tag] = { kind: 'captured' };
        else if (retreat === X.tag && rng.next() < 0.2 + lostK * 0.5) res.cmdr[X.tag] = { kind: 'incapacitated' };
        else if (winner === X.tag && rng.next() < 0.03) res.cmdr[X.tag] = { kind: 'incapacitated' };
      }
      log.push((winner === 'A' ? A.name : winner === 'B' ? B.name : 'nobody') + ' hold the field after ' + rounds + ' rounds');
      return res;
    },
    alive(st) { const o = {}; for (const k in st) o[k] = st[k].n; return o; },
  };
  AS.AutoResolve = AR;
})(window.AS);
