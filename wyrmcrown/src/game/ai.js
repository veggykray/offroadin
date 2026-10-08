/* WYRMCROWN — rival AI.
 *  AILord  — the strategist of one realm: spends gold by its personality and
 *            the situation, musters and sends warbands, and every second or so
 *            picks the dragon's goal (hunt, retreat, defend, capture, raid,
 *            duel, claim a power-up, besiege a weakened rival).
 *  AIPilot — flies the dragon toward that goal through the same input record
 *            the human pilot fills (throttle, turn, dive, skim, aim, fire,
 *            breath, eat), so AI dragons obey exactly the same flight model.
 * Personalities (data/factions.js ai.style):
 *  balanced  (Aldermere) — organised: walls and towers early, steady expansion
 *  evasive   (Sylvara)   — fast and slippery: kites with bolts, ambushes near home
 *  fortress  (Hrimgard)  — slow and territorial: heavy defences, holds its half
 *  aggressive(Morgrave)  — relentless raids, livestock theft, early sieges
 * The AI fights everyone, not just the player: targets are chosen by value,
 * distance and weakness among all rivals. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const SITE_VALUE = { goldmine: 5, village: 4, tradepost: 4, castle: 7, fort: 3, wizardtower: 3, magicwell: 2.6, grove: 2.2, crystal: 3, relic: 3, bridge: 2.4, shrine: 2, cave: 3, nest: 3, watchtower: 1.4, waygate: 1.8, ruins: 2.5 };
  const STYLE = {
    balanced: { harassAt: 300, harassEvery: 125, siegeTime: 720, retreat: 0.3, hunt: 0.33, duel: 0.55, kite: 0, sprint: 0.5, raid: 0.35, home: 1.0, siegeAt: 4, buildOrder: ['tower', 'wall', 'farm', 'recruitSoldiers', 'scales', 'staffPower', 'market', 'recruitArchers', 'ballista', 'wings', 'lungs', 'keepUp', 'tower', 'magetower', 'temple', 'stable', 'recruitKnights', 'workshop', 'catapult', 'wall', 'stomach', 'staffRate'] },
    evasive: { harassAt: 240, harassEvery: 110, siegeTime: 720, retreat: 0.35, hunt: 0.35, duel: 0.5, kite: 340, sprint: 0.7, raid: 0.4, home: 1.15, siegeAt: 5, buildOrder: ['farm', 'magetower', 'tower', 'wings', 'staffPower', 'recruitArchers', 'market', 'staffRate', 'wall', 'scales', 'ballista', 'keepUp', 'temple', 'lungs', 'recruitSoldiers', 'farm', 'stomach', 'tower', 'wall'] },
    fortress: { harassAt: 330, harassEvery: 150, siegeTime: 840, retreat: 0.3, hunt: 0.3, duel: 0.5, kite: 0, sprint: 0.35, raid: 0.25, home: 1.35, siegeAt: 6, buildOrder: ['wall', 'tower', 'ballista', 'farm', 'scales', 'recruitSoldiers', 'tower', 'wall', 'lungs', 'ballista', 'keepUp', 'magetower', 'market', 'workshop', 'catapult', 'temple', 'recruitArchers', 'wall', 'stomach', 'wings'] },
    aggressive: { harassAt: 170, harassEvery: 100, siegeTime: 480, retreat: 0.28, hunt: 0.3, duel: 0.68, kite: 0, sprint: 0.6, raid: 0.45, home: 0.8, siegeAt: 3, buildOrder: ['recruitSoldiers', 'lungs', 'tower', 'farm', 'scales', 'workshop', 'recruitSoldiers', 'staffPower', 'recruitSiege', 'wall', 'wings', 'magetower', 'keepUp', 'recruitArchers', 'catapult', 'market', 'stomach', 'tower', 'recruitSiege'] },
  };

  /* ===================================================== the strategist */
  class AILord {
    constructor(g, F) {
      this.g = g; this.F = F; this.style = STYLE[F.def.ai.style] || STYLE.balanced;
      this.goal = { type: 'patrol', x: F.townPos.x, y: F.townPos.y };
      this.thinkT = 1 + Math.random(); this.econT = 4 + Math.random() * 3; this.warT = 60 + Math.random() * 40;
      this.goalT = 0; this.threat = null; this.threatT = -99; this.buildIdx = 0;
      F.lord = this;
    }
    update(dt) {
      const F = this.F;
      if (F.eliminated) return;
      this.goalT += dt;
      this.thinkT -= dt; this.econT -= dt; this.warT -= dt;
      if (this.thinkT <= 0) { this.thinkT = 0.9 + Math.random() * 0.4; this.think(); }
      if (this.econT <= 0) { this.econT = 3 + Math.random() * 2; this.economy(); }
      if (this.warT <= 0) { this.warT = 40 + Math.random() * 30; this.military(); }
    }
    onAttacked(b, src) {
      if (src && src.alive !== false && src.team && src.team !== this.F.key) { this.threat = src; this.threatT = this.g.time; }
    }
    setGoal(gl) {
      const cur = this.goal;
      if (cur && cur.type === gl.type && cur.ref === gl.ref) { Object.assign(cur, gl); return; }
      this.goal = gl; this.goalT = 0;
    }

    /* ---------- choose the dragon's goal ---------- */
    think() {
      const g = this.g, F = this.F, d = F.dragon, S = this.style;
      if (!d || d.down > 0) return;
      const hp = d.hp / d.maxHp, en = d.energy / d.maxEnergy;
      const home = F.roost;
      // survival first
      if (hp < S.retreat || (this.goal.type === 'retreat' && hp < 0.8)) return this.setGoal({ type: 'retreat', x: home.x, y: home.y });
      if (en < S.hunt || (this.goal.type === 'hunt' && en < 0.85 && d.carry === null && this.goalT < 30)) {
        const prey = this.findPrey(d);
        if (prey) return this.setGoal({ type: 'hunt', ref: prey, x: prey.x, y: prey.y });
      }
      // defend the town against raiders nearby
      if (this.threat && g.time - this.threatT < 18 && this.threat.alive !== false && Math.hypot(this.threat.x - F.townPos.x, this.threat.y - F.townPos.y) < 900) {
        return this.setGoal({ type: this.threat.isDragon ? 'duel' : 'attack', ref: this.threat, x: this.threat.x, y: this.threat.y });
      }
      // an ally comes to the defence of the player's town against a common enemy
      const pact = g.pact && g.pact(F.key, g.playerKey);
      if (pact && pact.kind === 'alliance' && hp > 0.5) {
        const PT = g.playerFaction.townPos;
        if (Math.hypot(d.x - PT.x, d.y - PT.y) < 2800) for (const e of g.dragons) {
          if (e === d || !e.targetable || e.isPlayer || !g.hostile(F.key, e.team)) continue;
          if (Math.hypot(e.x - PT.x, e.y - PT.y) < 900) return this.setGoal({ type: 'duel', ref: e, x: e.x, y: e.y });
        }
      }
      // harassing a rival town: keep at it for a while, switching targets there
      if (this.goal.type === 'harass' && hp < S.retreat + 0.22) return this.setGoal({ type: 'retreat', x: home.x, y: home.y });
      if (this.goal.type === 'harass' && (this.goal.engaged || 0) < 45) {
        const gl = this.goal;
        // the clock only runs once we are over their town
        if (gl.rival && Math.hypot(d.x - gl.rival.townPos.x, d.y - gl.rival.townPos.y) < 1100) gl.engaged = (gl.engaged || 0) + 1.1;
        // only turn on their dragon if it is right on us and weaker
        const near = this.nearestDragon(d, 350);
        if (near && hp > near.hp / near.maxHp + 0.1) return this.setGoal({ type: 'duel', ref: near, x: near.x, y: near.y });
        if (gl.ref && gl.ref.alive) return;
        const t = this.harassTarget(d, gl.rival);
        if (t) return this.setGoal({ type: 'harass', ref: t, x: t.x, y: t.y, rival: gl.rival, engaged: gl.engaged });
      }
      // an enemy dragon close by: fight it if we are the stronger, or it is in our lands
      const foe = this.nearestDragon(d, 750);
      if (foe) {
        const inOurLands = Math.hypot(foe.x - F.townPos.x, foe.y - F.townPos.y) < 1600;
        const fhp = foe.hp / foe.maxHp;
        // (on easier settings the player's dragon is picked on less readily: it takes a bigger edge)
        const dk = foe.isPlayer ? (g.diff.dragonDuel || 1) : 1, edge = dk < 1 ? (1 - dk) * 0.5 : 0;
        if ((inOurLands && (dk >= 1 || hp >= fhp * 0.9 - 0.1 || Math.hypot(foe.x - F.townPos.x, foe.y - F.townPos.y) < 900)) || (hp > S.duel + edge && hp >= fhp * 0.9 + edge) || (this.goal.type === 'duel' && this.goal.ref === foe && hp > S.retreat + 0.1 + edge * 0.5)) return this.setGoal({ type: 'duel', ref: foe, x: foe.x, y: foe.y });
      }
      // magic nearby
      const orb = g.pickups.find((q) => q.alive && q.def && Math.hypot(q.x - d.x, q.y - d.y) < 1100);
      if (orb && this.goal.type !== 'siege') return this.setGoal({ type: 'powerup', ref: orb, x: orb.x, y: orb.y });
      if (g.time > S.harassAt && g.time > (this.harassNext || 0) && hp > 0.6 && en > 0.45) {
        const t = this.harassTarget(d, null);
        this.harassNext = g.time + S.harassEvery * U.range(0.8, 1.25);
        if (t) {
          if (t.faction === g.playerFaction) g.news(F.def.short + '\'s dragon is coming for ' + t.faction.def.short + '!', F.key, false);
          return this.setGoal({ type: 'harass', ref: t, x: t.x, y: t.y, rival: t.faction });
        }
      }
      // a weakened rival to break
      const prey = this.siegeTarget();
      if (prey) {
        const t = prey.buildings.find((b) => b.kind === 'wardstone' && b.alive && b.built >= 1) || (prey.keep && prey.keep.alive ? prey.keep : null);
        if (t) return this.setGoal({ type: 'siege', ref: t, x: t.x, y: t.y, rival: prey });
      }
      // raid: carts and herds of rivals (aggressive realms more often)
      if (Math.random() < S.raid * 0.35 || (this.goal.type === 'raid' && this.goalT < 25)) {
        const r = this.raidTarget(d);
        if (r) return this.setGoal({ type: 'raid', ref: r, x: r.x, y: r.y });
      }
      // guardians we make no headway against: leave that site alone for a while
      const cg = this.goal;
      if (cg.type === 'capture' && cg.ref && cg.ref.guarded && cg.ref.guarded()) {
        const st = cg.ref, ghp = st.guards.reduce((a, u) => a + (u.alive ? u.hp : 0), 0);
        const tr = this.tries || (this.tries = new Map());
        let r = tr.get(st);
        if (!r || g.time - r.last > 20) { r = { t: 0, hp0: ghp, last: g.time }; tr.set(st, r); }
        r.t += g.time - r.last; r.last = g.time;
        if (r.t > 40 && ghp > r.hp0 * 0.55) { (this.skip || (this.skip = new Map())).set(st, g.time + 150); tr.delete(st); }
      }
      // otherwise expand: claim the most valuable site within reach
      const site = this.bestSite(d);
      if (site) return this.setGoal({ type: 'capture', ref: site, x: site.x, y: site.y });
      this.setGoal({ type: 'patrol', x: F.townPos.x + U.range(-600, 600), y: F.townPos.y + U.range(-600, 600) });
    }
    findPrey(d) {
      const g = this.g, F = this.F;
      let best = null, bs = -1e9;
      for (const o of g.life.animals) {
        if (o.dead || o.carried || o.owner === F.key || (o.owner && g.pact && g.pact(F.key, o.owner))) continue;
        const dist = Math.hypot(o.x - d.x, o.y - d.y);
        if (dist > 3000) continue;
        let sc = -dist / 400 + o.A.food / 12;
        if (o.owner && o.owner !== F.key) sc += this.style.raid * 3; // stealing a rival's food hurts them too
        if (this.dangerAt(o.x, o.y) > 0) sc -= 4;
        if (sc > bs) { bs = sc; best = o; }
      }
      if (!best) for (const o of g.life.animals) if (!o.dead && !o.carried) { best = o; break; }
      return best;
    }
    nearestDragon(d, r) {
      let best = null, bd = r;
      for (const e of this.g.dragons) { if (e === d || !e.targetable || (this.g.pact && this.g.pact(d.team, e.team))) continue; const dd = Math.hypot(e.x - d.x, e.y - d.y); if (dd < bd) { bd = dd; best = e; } }
      return best;
    }
    // how dangerous a point is for our dragon: enemy defences in range
    dangerAt(x, y) {
      let v = 0;
      for (const R of this.g.factionList) {
        if (R === this.F || R.eliminated) continue;
        if (Math.hypot(x - R.townPos.x, y - R.townPos.y) > 900) continue;
        for (const b of R.buildings) if (b.alive && b.shoots && Math.hypot(x - b.x, y - b.y) < b.shoots.range) v += b.kind === 'ballista' ? 3 : 1;
      }
      return v;
    }
    bestSite(d) {
      const g = this.g, F = this.F, S = this.style;
      let best = null, bs = -1e9;
      for (const s of g.sites) {
        if (s.owner === F.key || (s.def.treasure && s.looted) || (s.owner && g.pact && g.pact(F.key, s.owner))) continue;
        if (this.skip && this.skip.get(s) > g.time) continue; // guardians too strong for now
        const dist = Math.hypot(s.x - d.x, s.y - d.y), fromHome = Math.hypot(s.x - F.townPos.x, s.y - F.townPos.y);
        let v = (SITE_VALUE[s.kind] || 2) * (s.rich ? 1.5 : 1);
        v -= dist / 1400 + fromHome / 1800 * S.home;
        if (s.guarded()) { let gs = 0; for (const u of s.guards) if (u.alive) gs += u.hp; v -= gs / 380; }
        if (s.owner) v -= 1.2 - S.raid; // taking from a rival is harder but sweet
        if (s.controller === F.key && s.control > 0) v += 1.5; // finish what we started
        // the fortress realm keeps to its own half of the map
        if (S.home > 1.4 && fromHome > 3600) v -= 4;
        for (const e of g.dragons) if (e !== d && e.targetable && Math.hypot(e.x - s.x, e.y - s.y) < 400) v -= 1;
        if (v > bs) { bs = v; best = s; }
      }
      return best;
    }
    raidTarget(d) {
      const g = this.g, F = this.F;
      let best = null, bs = -1e9;
      for (const t of g.troops) {
        if (t.role !== 'cart' || !t.alive || t.team === F.key || (g.pact && g.pact(F.key, t.team))) continue;
        const dist = Math.hypot(t.x - d.x, t.y - d.y);
        if (dist > 3200) continue;
        const sc = t.cargo / 25 - dist / 600 - this.dangerAt(t.x, t.y);
        if (sc > bs) { bs = sc; best = t; }
      }
      return best;
    }
    /* an outlying building of a rival town to burn: wardstones first (they
     * hold up the stronghold's ward), then farms and houses, away from the
     * heaviest defences; rivals that hit us, and nearby ones, come first */
    harassTarget(d, only) {
      const g = this.g, F = this.F;
      const VAL = { wardstone: 5, farm: 3, house: 1.8, barracks: 2, market: 2.2, temple: 2, stable: 1.6, roost: 1.5, watchtower: 1.4, tower: 1.2, ballista: 1.4, magetower: 1 };
      let best = null, bs = -1e9;
      for (const R of g.factionList) {
        if (R === F || R.eliminated || (only && R !== only) || (g.pact && g.pact(F.key, R.key))) continue;
        let rs = -Math.hypot(R.townPos.x - F.townPos.x, R.townPos.y - F.townPos.y) / 2500;
        if (R.underdog === 0 && R.power() - F.power() > 4) rs += 1.2; // cut the leader down to size
        if (R.lastAttacker === F) rs += 0.3; else if (F.lastAttacker === R) rs += 1.5;
        // don't all pile onto the same realm at once
        for (const O of g.factionList) if (O !== F && O.lord && O.lord.goal.type === 'harass' && O.lord.goal.rival === R) rs -= 1.5;
        for (const b of R.buildings) {
          if (!b.alive || b.built < 1 || !VAL[b.kind]) continue;
          const sc = rs + VAL[b.kind] - this.dangerAt(b.x, b.y) * 0.45 - Math.hypot(b.x - d.x, b.y - d.y) / 4000 + Math.random() * 0.6;
          if (sc > bs) { bs = sc; best = b; }
        }
      }
      return best;
    }
    // a rival whose ward is failing and whom we can reach
    siegeTarget() {
      const g = this.g, F = this.F;
      const strength = F.sitesOwned + (F.upgrades.scales || 0) + (F.upgrades.lungs || 0) + F.keepLevel;
      if (strength < this.style.siegeAt && g.time < this.style.siegeTime) return null;
      let best = null, bs = -1e9;
      for (const R of g.factionList) {
        if (R === F || R.eliminated || !R.keep || (g.pact && g.pact(F.key, R.key))) continue;
        const ward = R.wardStrength(), dist = Math.hypot(R.townPos.x - F.townPos.x, R.townPos.y - F.townPos.y);
        let sc = (4 - ward) * 1.5 - dist / 3000 - R.alive('tower') * 0.3 - R.alive('ballista') * 0.6 + (1 - R.keep.hp / R.keep.maxHp) * 3;
        if (R.lastAttacker === F) sc += 0.5;
        if (sc > bs) { bs = sc; best = R; }
      }
      return bs > 0.5 || g.time > this.style.siegeTime * 1.5 ? best : null;
    }

    /* ---------- spending ---------- */
    economy() {
      const F = this.F, g = this.g;
      // emergencies: rebuild wardstones, wall up when raided
      const wards = F.alive('wardstone');
      if (wards < 3 && !F.blocker('wardstone')) { F.buy('wardstone'); return; }
      if (g.time - F.attackedT < 30 && !F.wallLevel && !F.blocker('wall')) { F.buy('wall'); return; }
      if (F.troopCount() < 5 && !F.blocker('recruitSoldiers')) { F.buy('recruitSoldiers'); return; }
      // the personality's build order, skipping what can't be bought yet
      const order = this.style.buildOrder;
      for (let tries = 0; tries < order.length; tries++) {
        const id = order[this.buildIdx % order.length];
        const why = F.blocker(id);
        if (!why) { F.buy(id); this.buildIdx++; return; }
        if (why === 'Not enough gold') return; // save up for it
        this.buildIdx++; // can't ever (yet): move on
      }
    }
    /* ---------- warbands ---------- */
    military() {
      const g = this.g, F = this.F;
      const free = F.troops.filter((t) => t.alive && t.role !== 'cart' && t.state === 'garrison');
      if (free.length < 7) return;
      // siege a broken rival, or seize an unguarded site near home
      const R = this.siegeTarget();
      let target = null, raid = null;
      const walk = (x, y) => AS.Nav.reachable(g, F.townPos.x, F.townPos.y, x, y);
      if (R && Math.random() < 0.6 && walk(R.townPos.x, R.townPos.y)) target = { x: R.townPos.x, y: R.townPos.y, siege: true };
      else if (g.time > this.style.harassAt * 1.6 && Math.random() < 0.25 + this.style.raid * 0.4 && (raid = this.harassTarget(F.dragon, null)) && walk(raid.x, raid.y)) target = { x: raid.x, y: raid.y, siege: true, raid };
      else {
        let best = null, bs = -1e9;
        for (const s of g.sites) {
          if (s.owner === F.key || s.def.treasure || s.kind === 'bridge') continue;
          if (!AS.Nav.reachable(g, F.townPos.x, F.townPos.y, s.x, s.y)) continue; // islands are for dragons
          const dist = Math.hypot(s.x - F.townPos.x, s.y - F.townPos.y);
          const sc = (SITE_VALUE[s.kind] || 2) - dist / 1200 - (s.guarded() ? 3 : 0);
          if (sc > bs) { bs = sc; best = s; }
        }
        if (best) target = { x: best.x, y: best.y };
      }
      if (!target) return;
      const send = free.slice(4);
      for (const u of send) u.marchTo(target.x + U.range(-40, 40), target.y + U.range(-40, 40), { siege: !!target.siege, r: 130 });
      const foeF = target.raid ? target.raid.faction : R;
      if (send.length >= 4) g.news(F.def.short + ' sends a warband' + (target.raid ? ' to raid ' + foeF.def.short + '!' : target.siege ? ' to besiege ' + foeF.def.short + '!' : ' into the field'), F.key, !!target.siege && foeF === g.playerFaction);
    }
    onSiteCaptured() {}
  }

  /* ===================================================== the pilot */
  class AIPilot {
    constructor(g, F) { this.g = g; this.F = F; this.ai = true; this.jitter = Math.random() * 10; this.orbitDir = Math.random() < 0.5 ? 1 : -1; }
    read(d, inp, dt) {
      const g = this.g, F = d.faction;
      d.ai = this;
      if (!F.lord) new AILord(g, F);
      const L = F.lord, S = L.style, gl = L.goal;
      inp.fire = false; inp.breath = false; inp.breathTarget = null; inp.dive = false; inp.skim = false; inp.sprint = false; inp.eatHit = false; inp.eat = false; inp.steer = null; inp.spellHit = false; inp.loop = false;
      this.t = (this.t || 0) + dt;
      // keep the goal's position fresh for moving targets
      if (gl.ref && gl.ref.x !== undefined) { gl.x = gl.ref.x; gl.y = gl.ref.y; }
      if (gl.ref && (gl.ref.alive === false || gl.ref.dead || gl.ref.carried || gl.ref.removed)) { L.thinkT = 0; gl.ref = null; }
      switch (gl.type) {
        case 'retreat': this.flyTo(d, inp, gl.x, gl.y, { arrive: 70, hover: true, sprint: true }); break;
        case 'hunt': this.hunt(d, inp, gl); break;
        case 'duel': this.duel(d, inp, gl.ref || L.nearestDragon(d, 900)); break;
        case 'attack': case 'raid': case 'siege': case 'harass': this.strike(d, inp, gl.ref, gl.type === 'siege' || gl.type === 'harass'); break;
        case 'powerup': this.flyTo(d, inp, gl.x, gl.y, { arrive: 10, low: true }); break;
        case 'capture': this.capture(d, inp, gl.ref); break;
        default: this.flyTo(d, inp, gl.x, gl.y, { arrive: 300 });
      }
      // a dragon that has landed takes off again unless resting at home or claiming the ground it sits on
      this.landedT = d.landed ? (this.landedT || 0) + dt : 0;
      if (this.landedT > 6) {
        const claiming = gl.type === 'capture' && gl.ref && Math.hypot(d.x - gl.ref.x, d.y - gl.ref.y) < gl.ref.capR * 0.9;
        const resting = gl.type === 'retreat' && d.hp < d.maxHp * 0.97;
        if (!claiming && !resting) inp.throttle = 1;
      }
      // carrying stolen livestock: fly it home, otherwise eat at once
      if (d.carry) { this.wantDeposit = d.carry.owner && d.carry.owner !== d.team && Math.hypot(d.x - F.townPos.x, d.y - F.townPos.y) < 2500 && d.energy > d.maxEnergy * 0.4; if (this.wantDeposit) this.flyTo(d, inp, F.townPos.x, F.townPos.y, { arrive: 200 }); else inp.eatHit = true; }
      // opportunistic bolts at anything hostile in reach
      if (!inp.fire && d.mana > 35) {
        const t = g.nearestFoe(d.team, d.x, d.y, 420, { prefer: (e) => e.isDragon });
        if (t && !t.isBuilding) this.aimAt(d, inp, t);
      }
      // cast a stored spell when it would do some good
      if (d.spell && d.spellCharges > 0 && this.t > (this.spellT || 0)) {
        const foes = g.foesNear(d.team, d.x, d.y, d.spell === 'nova' ? 300 : 480);
        if (foes.length >= (d.spell === 'summon' ? 2 : 3) || (foes.some((e) => e.isDragon) && d.spell !== 'summon')) { inp.spellHit = true; this.spellT = this.t + 8; }
      }
      // under fire from a rival dragon, now and then loop the loop to shake it off
      if (d.loopCd <= 0 && !d.carry && g.time - d.lastHurt < 0.4 && d.lastHitBy && d.lastHitBy.isDragon && d.energy > d.maxEnergy * 0.3 &&
        Math.random() < dt * (S.kite ? 2.6 : 1.2) * (g.diff.ai || 1)) inp.loop = true;
      // AI aim gets steadier on harder difficulty
      const acc = (g.diff.ai || 1) * (g.diff.dragonAim || 1);
      inp.aimX += Math.sin(this.t * 3.1 + this.jitter) * 18 / acc; inp.aimY += Math.cos(this.t * 2.7 + this.jitter) * 14 / acc;
    }
    /* steer toward a point; opts: arrive, hover (brake & hover on arrival), low, sprint */
    flyTo(d, inp, tx, ty, o) {
      o = o || {};
      // skirt enemy defences unless that's where we're going
      const L = d.faction.lord;
      if (!o.brave && L.dangerAt(d.x + Math.cos(d.angle) * 250, d.y + Math.sin(d.angle) * 250) >= 2) {
        const side = this.orbitDir;
        tx = d.x + Math.cos(d.angle + side * 1.4) * 400; ty = d.y + Math.sin(d.angle + side * 1.4) * 400;
      }
      const want = Math.atan2(ty - d.y, tx - d.x), diff = U.wrapAngle(want - d.angle), dist = Math.hypot(tx - d.x, ty - d.y);
      inp.turn = U.clamp(diff * 2.4, -1, 1);
      const arrive = o.arrive || 150;
      if (dist > arrive * 2.5 + 200) {
        inp.throttle = Math.abs(diff) < 1.4 ? 1 : d.speed > 260 ? -1 : 0;
        inp.sprint = (o.sprint || dist > 2000) && d.energy > d.maxEnergy * 0.45 && Math.random() < d.faction.lord.style.sprint + 0.3;
      } else if (dist > arrive) {
        inp.throttle = Math.abs(diff) > 1 ? -1 : 0.4;
      } else {
        inp.throttle = o.hover ? -1 : 0;
      }
      if (o.low && dist < 380) { if (d.speed > 180) inp.throttle = -1; inp.skim = true; }
      inp.aimX = d.x + Math.cos(d.angle) * 200; inp.aimY = d.y - d.z + Math.sin(d.angle) * 200;
      return dist;
    }
    aimAt(d, inp, t) {
      const lead = Math.hypot(t.x - d.x, t.y - d.y) / 640;
      inp.aimX = t.x + (t.vx || 0) * lead * 0.8; inp.aimY = (t.py !== undefined ? t.py : t.y) + (t.vy || 0) * lead * 0.8;
      inp.fire = true;
    }
    // breathe when the target is within reach of a swing of the head
    breathIfAligned(d, inp, t) {
      if (!t || d.fireCharge < 8) return false;
      const dist = Math.hypot(t.x - d.x, t.y - d.y), bi = AS.Combat.breathInfo(d);
      const off = Math.abs(U.wrapAngle(Math.atan2(t.y - d.y, t.x - d.x) - d.angle));
      const dz = Math.abs((t.z || 0) - d.z);
      if (dist < bi.L * (t.isDragon ? 1.05 : 0.95) && dist > 20 && off < 1.15 && (t.isDragon ? dz < 70 : d.z < 70)) {
        inp.breath = true; inp.breathTarget = t; inp.aimX = t.x; inp.aimY = t.y;
        return true;
      }
      return false;
    }
    hunt(d, inp, gl) {
      const o = gl.ref;
      if (!o) return this.flyTo(d, inp, gl.x, gl.y, { arrive: 100 });
      const dist = this.flyTo(d, inp, o.x, o.y, { arrive: 20, low: true });
      if (dist < 140) { inp.skim = true; inp.throttle = d.speed > 90 ? -1 : 0.2; }
      const R = AS.Life.snatchReach(d);
      if (dist < R.r * 0.85 && d.z < R.z) inp.eatHit = true;
      // hungry dragons don't waste breath on dinner unless it is fleeing far
    }
    capture(d, inp, s) {
      if (!s) return;
      if (s.guarded()) {
        // clear the guardians first: strafe them with breath and bolts
        let best = null, bd = 1e9;
        for (const u of s.guards) if (u.alive) { const dd = Math.hypot(u.x - d.x, u.y - d.y); if (dd < bd) { bd = dd; best = u; } }
        if (best) return this.strike(d, inp, best, false);
      }
      const dist = this.flyTo(d, inp, s.x, s.y, { arrive: s.capR * 0.4, hover: true, brave: !!s.owner });
      // glide in low, and only flare (and perhaps land) well inside the ring
      if (dist < s.capR * 0.75) { inp.throttle = -1; if (d.z > 40) inp.skim = true; }
      else if (dist < s.capR * 1.4) { inp.throttle = d.landed ? 1 : 0.2; inp.skim = true; }
      // circle slowly over the site while claiming it
      if (dist < s.capR * 0.6) inp.turn = this.orbitDir * 0.6;
    }
    /* attack runs: come in low and straight with the breath, overfly the
     * target, carry on out past it, swing round wide and come again; a
     * dragon that hovers over a town is a dragon the archers bring down */
    strike(d, inp, t, siege) {
      if (!t) return;
      const run = this.run || (this.run = { phase: 'in', ref: null, outA: 0 });
      if (run.ref !== t) { run.ref = t; run.phase = 'in'; }
      const dist = Math.hypot(t.x - d.x, t.y - d.y);
      const ahead = U.wrapAngle(Math.atan2(t.y - d.y, t.x - d.x) - d.angle);
      const low = t.isBuilding || t.isTroop;
      if (run.phase === 'in') {
        this.flyTo(d, inp, t.x, t.y, { arrive: 10, brave: true });
        if (dist < 480) { inp.skim = low; inp.throttle = Math.abs(ahead) < 0.5 ? (d.speed < 150 ? 0.6 : 0) : -0.6; }
        if (dist < 60 || (dist < 200 && Math.abs(ahead) > 1.7)) { run.phase = 'out'; run.outA = d.angle + (Math.random() - 0.5) * 0.6; }
      } else {
        this.flyTo(d, inp, t.x + Math.cos(run.outA) * 420, t.y + Math.sin(run.outA) * 420, { arrive: 60, brave: true });
        inp.throttle = 1; inp.skim = dist < 200 && low;
        if (dist > 340) run.phase = 'in';
      }
      if (dist < 520 && d.mana > 12) this.aimAt(d, inp, t);
      this.breathIfAligned(d, inp, t);
      if (siege && t.isBuilding && d.faction.lord.dangerAt(d.x, d.y) > 5 && d.hp < d.maxHp * 0.5) d.faction.lord.thinkT = 0;
    }
    duel(d, inp, e) {
      if (!e || !e.targetable) { d.faction.lord.thinkT = 0; return; }
      const S = d.faction.lord.style;
      const dist = Math.hypot(e.x - d.x, e.y - d.y);
      // where will it be?
      const lead = Math.min(1, dist / 500);
      const px = e.x + e.vx * lead * 0.6, py = e.y + e.vy * lead * 0.6;
      if (S.kite && dist < S.kite * 0.8) {
        // too close for an elf: break away, then turn back to shoot
        const away = Math.atan2(d.y - e.y, d.x - e.x) + this.orbitDir * 0.7;
        this.flyTo(d, inp, d.x + Math.cos(away) * 500, d.y + Math.sin(away) * 500, { arrive: 50, brave: true });
        inp.sprint = d.energy > d.maxEnergy * 0.3;
      } else if (S.kite && dist < S.kite * 1.5) {
        // circle at range with bolts
        const around = Math.atan2(d.y - e.y, d.x - e.x) + this.orbitDir * 0.9;
        this.flyTo(d, inp, e.x + Math.cos(around) * S.kite, e.y + Math.sin(around) * S.kite, { arrive: 30, brave: true });
      } else {
        this.flyTo(d, inp, px, py, { arrive: 60, brave: true });
        // tighten the turn when the foe slips to the side
        const ang = Math.abs(U.wrapAngle(Math.atan2(py - d.y, px - d.x) - d.angle));
        if (ang > 1.2 && d.speed > 200) inp.throttle = -1;
        else if (dist > 180) inp.throttle = 1;
        // break turn if the foe is right behind us and closing
        const behind = Math.abs(U.wrapAngle(Math.atan2(d.y - e.y, d.x - e.x) - e.angle)) < 0.35 && dist < 220;
        if (behind && S.duel < 0.7) { inp.turn = this.orbitDir; inp.dive = d.z > 30; }
      }
      // match the foe's height a little
      if (e.z < 40 && dist < 300) inp.skim = true;
      if (dist < 560) this.aimAt(d, inp, e);
      this.breathIfAligned(d, inp, e);
    }
  }

  AS.AILord = AILord;
  AS.AIPilot = AIPilot;
})(window.AS);
