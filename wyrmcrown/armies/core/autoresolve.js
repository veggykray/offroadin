/* WYRMCROWN — GROUND ARMIES: battles resolved without the real-time engine.
 *
 * Used where the dragon cannot take part (inside a tunnel or cave, or when it
 * is far away) and whenever nobody is watching. Pure and deterministic: the
 * same forces, ground and seed always give the same result.
 *
 * Everything comes from the troop data (core/stats.js): hit points, armour
 * (the real game's rule: a blow loses `armor`, but never below 40%; and a
 * blow never does more than kill the soldier it lands on), melee
 * damage × rate, melee splash, missiles (arrows, crossbows, catapult stones,
 * thrown rocks), regeneration, size and speed. On top of that:
 *
 *   rounds      ROUND seconds of fighting each. The first is the approach:
 *               only missiles and thrown rocks; melee joins from round two
 *   ground      the terrain kind of the battlefield (core/ground.js KINDS):
 *               missiles × ranged; a FRONTAGE (tunnels, caves, bridges) caps
 *               how many can fight abreast — big creatures take more room and
 *               swing less freely — so numbers count for less in a tunnel;
 *               high ground and fords favour the defender
 *   defender    stance (holding / defending / garrison) and fortification
 *               (`fort`, e.g. 2 for a fortress) cut the damage it takes; a
 *               `breach` (width) limits how many attackers reach the walls hand
 *               to hand; siege engines wear the walls down and widen the breach
 *   casualties  damage is carried per stack as wounds; whole soldiers fall
 *   retreat     each side breaks once its losses pass a point set by morale
 *               (the dead never break), or when the fight is hopeless. The
 *               broken side retreats and the winner's pursuit costs it more,
 *               by how much faster the pursuers are. A side with nowhere to
 *               go (`noRetreat`, e.g. a cave's last chamber) fights to the end
 *   time limit  after MAX_ROUNDS the defender holds and the attacker withdraws
 *
 * The result has the same survivors / casualties shape (troop id → count) as
 * a Conquest real-time battle result, so either kind of battle can settle the
 * same campaign record. */
'use strict';
(function (AS) {
  const S = () => AS.Armies.Stats;
  const ROUND = 4, MAX_ROUNDS = 30;
  // the share of a round spent actually trading blows (closing in, spacing, pauses for breath):
  // the real-time game's soldiers are not all striking every second of a fight
  const INTENSITY = 0.3;
  const STANCE = { garrison: 1.15, defending: 1.15, holding: 1.08, moving: 1, retreating: 0.85 };

  const clone = (stacks) => stacks.filter((s) => s.count > 0).map((s) => { const o = { troop: s.troop, count: s.count, wounds: s.wounds || 0 }; if (s.src !== undefined) o.src = s.src; return o; });
  const width = (p) => Math.max(1, p.r / 6);

  function sideHp(stacks) { return S().totalHp(stacks); }
  function avgArmor(stacks) {
    let a = 0, n = 0;
    for (const s of stacks) { if (s.count <= 0) continue; a += S().profile(s.troop).armor * s.count; n += s.count; }
    return n ? a / n : 0;
  }
  function avgSpeed(stacks) {
    let v = 0, n = 0;
    for (const s of stacks) { if (s.count <= 0) continue; v += S().profile(s.troop).speed * s.count; n += s.count; }
    return n ? v / n : 0;
  }
  // how many soldiers a blast or a sweeping blow catches
  function caught(radius, targetR, cramped) {
    if (!radius) return 1;
    const n = 1 + (radius * radius) / (targetR * targetR * 6);
    return Math.min(cramped ? 2 : 3, n);
  }
  function avgHp(stacks) {
    let h = 0, n = 0;
    for (const s of stacks) { if (s.count <= 0) continue; h += S().profile(s.troop).hp * s.count; n += s.count; }
    return n ? h / n : 1;
  }
  function avgR(stacks) {
    let r = 0, n = 0;
    for (const s of stacks) { if (s.count <= 0) continue; r += S().profile(s.troop).r * s.count; n += s.count; }
    return n ? r / n : 6;
  }

  /* the damage one side deals to the other in a round (before the target's protections) */
  function volley(own, foe, ctx, opening, siegeVsFort) {
    const T = ctx.terrain, cramped = !!T.frontage;
    const armor = avgArmor(foe), fr = avgR(foe), fhp = avgHp(foe);
    // a blow can do no more than kill the soldier it lands on (no overkill on a swarm)
    const blow = (d) => Math.min(S().afterArmor(d, armor), fhp);
    // frontage: share of this side that can actually reach the enemy
    let share = 1;
    if (T.frontage) {
      let w = 0; for (const s of own) if (s.count > 0) w += s.count * width(S().profile(s.troop));
      share = Math.min(1, T.frontage * 2 / Math.max(1, w)); // two ranks can strike: the front and over its shoulders
    }
    // storming walls: only as many as the breach holds reach the defenders hand to hand
    let meleeShare = share;
    if (ctx.breach) {
      let w = 0; for (const s of own) if (s.count > 0 && S().profile(s.troop).melee) w += s.count * width(S().profile(s.troop));
      meleeShare = Math.min(share, ctx.breach * 2 / Math.max(1, w));
    }
    let dmg = 0, siege = 0;
    for (const s of own) {
      if (s.count <= 0) continue;
      const p = S().profile(s.troop);
      let shot = 0, hand = 0;
      for (const m of p.missiles) {
        if (opening ? false : m.opening) continue;      // rocks are hurled during the approach only
        const blast = caught(m.radius, fr, cramped);
        // lobbed stones and rocks are aimed where a moving target will be, and often miss
        let d = blow(m.dmg) * m.rate * blast * (m.radius ? 0.6 : 1) * (T.ranged !== undefined ? T.ranged : 1);
        if (m.building && siegeVsFort) { d *= 1.5; siege += s.count; }
        if (!opening && !m.opening && p.melee) d *= 0.75; // archers in the melee shoot less
        shot = Math.max(shot, d);
      }
      if (!opening && p.melee) {
        const sweep = p.melee.splash ? caught(p.melee.splash, fr, cramped) : 1;
        hand = blow(p.melee.dmg) * p.melee.rate * sweep;
        if (cramped && p.big) hand *= 0.75;             // no room to swing
      }
      // each soldier fights the way it does best; those kept from the melee shoot if they can
      const inMelee = hand > shot ? s.count * meleeShare : 0;
      const shooters = hand > shot ? (shot > 0 ? s.count * share - inMelee : 0) : s.count * share;
      dmg += (inMelee * hand + Math.max(0, shooters) * shot) * ROUND * INTENSITY;
    }
    return { dmg, siege };
  }

  /* spread damage over the target's stacks: the front line (melee, large bodies) soaks most */
  function apply(stacks, dmg, opening, out) {
    let wsum = 0;
    const ws = stacks.map((s) => {
      if (s.count <= 0) return 0;
      const p = S().profile(s.troop);
      const w = s.count * width(p) * (opening || p.melee && !p.missiles.length ? 1 : p.missiles.length && !p.missiles[0].opening ? 0.4 : 1);
      wsum += w; return w;
    });
    if (wsum <= 0) return;
    stacks.forEach((s, i) => {
      if (!ws[i]) return;
      const p = S().profile(s.troop);
      s.wounds += dmg * ws[i] / wsum;
      const dead = Math.min(s.count, Math.floor(s.wounds / p.hp + 1e-9));
      if (dead) { s.count -= dead; s.wounds -= dead * p.hp; out[s.troop] = (out[s.troop] || 0) + dead; }
      if (s.count <= 0) { s.count = 0; s.wounds = 0; }
    });
  }

  function breakPoint(side, stacks, fortified) {
    if (side.noRetreat) return Infinity;
    let hp = 0, fearless = 0;
    for (const s of stacks) { const p = S().profile(s.troop), h = s.count * p.hp; hp += h; if (p.fearless) fearless += h; }
    const f = hp ? fearless / hp : 0;
    let b = 0.4 + 0.25 * (side.morale !== undefined ? side.morale : 1) + (fortified ? 0.1 : 0);
    return b + (0.97 - b) * f;
  }
  function fearlessShare(stacks) {
    let hp = 0, fl = 0;
    for (const s of stacks) { const p = S().profile(s.troop), h = s.count * p.hp; hp += h; if (p.fearless) fl += h; }
    return hp ? fl / hp : 0;
  }

  const AutoResolve = {
    ROUND, MAX_ROUNDS, INTENSITY, STANCE,
    /* ctx: { attacker: { side, stacks, morale, stance }, defender: { side, stacks, morale, stance, fort, noRetreat },
     *        terrain: KINDS record or key, seed } */
    resolve(ctx) {
      const G = AS.Armies.Ground;
      const T = typeof ctx.terrain === 'string' ? (G.KIND[ctx.terrain] || G.KIND.plain) : (ctx.terrain || G.KIND.plain);
      const rng = new AS.U.RNG((ctx.seed >>> 0) || 1);
      const A = ctx.attacker, D = ctx.defender;
      const a = clone(A.stacks), d = clone(D.stacks);
      const aHp0 = sideHp(a), dHp0 = sideHp(d);
      const cas = { attacker: {}, defender: {} }, log = [];
      const fort0 = D.fort || 1;
      const aBreak = breakPoint(A, a, false), dBreak = breakPoint(D, d, fort0 > 1);
      const anyMissiles = (st) => st.some((s) => S().profile(s.troop).missiles.length);
      let round = 0, winner = null, reason = 'held', broke = null;
      log.push(T.name + ': ' + S().count(a) + ' attack ' + S().count(d) + (fort0 > 1 ? ' behind defences ×' + fort0 : ''));
      if (!aHp0 || !dHp0) {
        winner = aHp0 ? 'attacker' : 'defender'; reason = 'unopposed';
      }
      while (!winner && round < MAX_ROUNDS) {
        round++;
        const opening = round === 1 && !T.frontage && (anyMissiles(a) || anyMissiles(d));
        // siege engines wear down the walls: fortification is weaker for every engine still in the field
        let engines = 0; for (const s of a) if (s.count > 0 && S().profile(s.troop).siege) engines += s.count;
        const fort = 1 + (fort0 - 1) * Math.max(0.25, 1 - 0.2 * engines);
        const breach = fort0 > 1 && D.breach ? D.breach + 3 * engines : 0;
        const va = volley(a, d, { terrain: T, breach }, opening, fort0 > 1), vd = volley(d, a, { terrain: T }, opening, false);
        // the defender's protections and advantages
        const guard = (STANCE[D.stance] || 1) * fort * (1 + (T.high || 0)) * (1 + (T.cover || 0));
        const aStance = STANCE[A.stance] || 1;
        let toD = va.dmg / guard * (T.ford || 1) * rng.range(0.9, 1.1);
        let toA = vd.dmg * (fort > 1 ? 1.15 : 1) * (1 + (T.high || 0)) / aStance * rng.range(0.9, 1.1);
        apply(d, toD, opening, cas.defender);
        apply(a, toA, opening, cas.attacker);
        // regeneration closes wounds between rounds (trolls)
        for (const st of [a, d]) for (const s of st) { const p = S().profile(s.troop); if (p.regen && s.count) s.wounds = Math.max(0, s.wounds - p.regen * ROUND * INTENSITY * s.count); }
        const aHp = sideHp(a), dHp = sideHp(d);
        if (dHp <= 0 || aHp <= 0) { winner = dHp <= 0 && aHp > 0 ? 'attacker' : 'defender'; reason = 'wiped'; break; }
        const aLoss = 1 - aHp / aHp0, dLoss = 1 - dHp / dHp0;
        // hopeless: far outmatched after the first exchanges (the dead and the cornered fight on)
        const ratio = S().power(a) / Math.max(1e-6, S().power(d));
        const aHopeless = round >= 2 && ratio < 0.2 && fearlessShare(a) < 0.5 && !A.noRetreat;
        const dHopeless = round >= 2 && ratio > 5 && fearlessShare(d) < 0.5 && !D.noRetreat;
        const aBroke = aLoss >= aBreak || aHopeless, dBroke = dLoss >= dBreak || dHopeless;
        if (aBroke || dBroke) {
          broke = aBroke && dBroke ? (aLoss - aBreak >= dLoss - dBreak ? 'attacker' : 'defender') : aBroke ? 'attacker' : 'defender';
          winner = broke === 'attacker' ? 'defender' : 'attacker'; reason = 'broke';
        }
        if (round <= 3 || winner) log.push('round ' + round + ': attacker ' + S().count(a) + ' (−' + Math.round(aLoss * 100) + '%), defender ' + S().count(d) + ' (−' + Math.round(dLoss * 100) + '%)');
      }
      if (!winner) { winner = 'defender'; reason = 'held'; broke = 'attacker'; log.push('the defenders hold; the attack is called off'); }
      // pursuit of the side that broke
      let pursued = 0;
      if (broke && reason === 'broke') {
        const loser = broke === 'attacker' ? a : d, win = broke === 'attacker' ? d : a, out = cas[broke];
        const k = 0.12 * AS.U.clamp(avgSpeed(win) / Math.max(1, avgSpeed(loser)), 0.25, 1.6) * (T.frontage ? 0.5 : 1);
        for (const s of loser) {
          if (!s.count) continue;
          const p = S().profile(s.troop);
          const slow = AS.U.clamp(avgSpeed(win) / p.speed, 0.4, 1.6);
          const dead = Math.min(s.count, Math.round(s.count * k * slow));
          if (dead) { s.count -= dead; out[s.troop] = (out[s.troop] || 0) + dead; pursued += dead; }
        }
        log.push(broke + ' breaks and retreats under pursuit (' + pursued + ' cut down)');
      }
      const pack = (side, st, c, retreated) => {
        const lost = Object.values(c).reduce((x, y) => x + y, 0);
        const won = winner === (side === A ? 'attacker' : 'defender');
        return {
          side: side.side, survivors: st.filter((s) => s.count > 0), casualties: c, lost, retreated,
          routed: !st.some((s) => s.count > 0),
          morale: AS.U.clamp((side.morale !== undefined ? side.morale : 1) + (won ? 0.1 : -0.3), 0.1, 1),
        };
      };
      const res = {
        winner, reason, pursued, rounds: round, seconds: round * ROUND, terrain: T.key || 'ground', seed: ctx.seed >>> 0,
        attacker: pack(A, a, cas.attacker, winner === 'defender' && S().count(a) > 0),
        defender: pack(D, d, cas.defender, winner === 'attacker' && S().count(d) > 0),
        log,
      };
      log.push(winner + ' wins (' + reason + ') after ' + round + ' rounds');
      return res;
    },
    // chance the attacker wins, over n seeds (for AI choices and order previews)
    estimate(ctx, n) {
      n = n || 16; let w = 0, loss = 0;
      for (let i = 0; i < n; i++) {
        const r = this.resolve(Object.assign({}, ctx, { seed: ((ctx.seed || 1) + i * 7919) >>> 0 }));
        if (r.winner === 'attacker') w++;
        loss += r.attacker.lost;
      }
      return { win: w / n, attackerLoss: loss / n };
    },
    // conversions to and from Conquest's { troopId: n } payloads
    toCounts(stacks) { const o = {}; for (const s of stacks) if (s.count > 0) o[s.troop] = (o[s.troop] || 0) + s.count; return o; },
    fromCounts(o) { return Object.keys(o).filter((k) => o[k] > 0).map((k) => ({ troop: k, count: o[k], wounds: 0 })); },
  };
  AS.Armies.AutoResolve = AutoResolve;
})(window.AS);
