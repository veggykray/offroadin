/* WYRMCROWN — GROUND ARMIES: the simulation.
 *
 * ArmySim holds the ground (a GroundMap), the places that matter (locations:
 * settlements, fortresses, caves… with an owner and a garrison), the armies
 * and the dragon's position, and carries out orders (core/orders.js).
 *
 * Time. Logic runs in fixed TICKs (default 1 s of game time) however the caller
 * steps it, so a run is deterministic: one big step, sixty small ones, or the
 * dragon looking elsewhere all give the same armies, battles and results.
 *
 * Near and far. Armies close to the view (the dragon, by default) are NEAR:
 * they get smooth per-frame positions (frame()) and a game can stand real
 * AS.Troop units in for them (the 'lod' events). FAR armies cost one O(1)
 * route lookup per tick — a march is a pure function of effort along its route
 * (core/ground.js), so nothing is stepped frame by frame — and contacts are
 * found by closest approach over the tick, so even fast, coarse ticks cannot
 * let two armies (or an army and a garrison) slip past each other.
 *
 * Battles. When hostile armies meet, or an army reaches a hostile place with
 * defenders, a battle record is made. If the dragon of a side in the fight is
 * within reach and the ground is not ground-only (a tunnel, a cave), and the
 * caller has set onTactical, the battle is handed over to be fought in the
 * real-time game and the armies wait for settle(battleId, result). Otherwise
 * it is auto-resolved at once (core/autoresolve.js). Results use the same
 * survivors/casualties payload either way.
 *
 * Events (sim.events, and on(fn)): order, rejected, depart, arrive, passage-in,
 * passage-out, through, replan, battle, tactical, battle-end, captured,
 * retreat, routed, cannot-follow, lod. */
'use strict';
(function (AS) {
  const A = AS.Armies;
  const hash = (a, b) => { let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; return (Math.imul(h, 0x27d4eb2f) ^ (h >>> 13)) >>> 0; };
  // closest approach of two points moving straight over the same interval → { t, d }
  function approach(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) {
    const rx = bx0 - ax0, ry = by0 - ay0, dx = (bx1 - bx0) - (ax1 - ax0), dy = (by1 - by0) - (ay1 - ay0);
    const dd = dx * dx + dy * dy;
    const t = dd > 1e-9 ? AS.U.clamp(-(rx * dx + ry * dy) / dd, 0, 1) : 0;
    return { t, d: Math.hypot(rx + dx * t, ry + dy * t) };
  }

  class ArmySim {
    /* o: { ground, locations: [{ id, name, kind, x, y, r, owner, garrison: [{troop, count}], fort,
     *       groundOnly, noRetreat, capturable }], seed, tick, hostile(a, b), viewR, engage,
     *       dragonReach, onTactical(battle) } */
    constructor(o) {
      this.ground = o.ground;
      this.seed = (o.seed >>> 0) || 1;
      this.TICK = o.tick || 1;
      this.viewR = o.viewR || 900;            // armies this close to the view (default: the dragon) are near
      this.engage = o.engage || 110;          // armies this close fight
      this.dragonReach = o.dragonReach || 1000; // the dragon joins battles this close (if the ground allows)
      this.followNear = o.followNear || 220;  // a following army stops this close to the dragon
      this.threatR = o.threatR || 700;        // a place with enemies this close is not safe
      this.hostileFn = o.hostile || null;
      this.onTactical = o.onTactical || null;
      this.locations = (o.locations || []).map((L) => Object.assign({ r: 140, fort: 1, garrison: [], capturable: true }, L, { garrison: (L.garrison || []).map((s) => ({ troop: s.troop, count: s.count, wounds: 0 })) }));
      this.byLoc = {}; for (const L of this.locations) this.byLoc[L.id] = L;
      this.armies = new Map();
      this.t = 0; this.acc = 0; this.nArmy = 0; this.nBattle = 0;
      this.dragon = null; this.view = null;
      this.events = []; this.listeners = [];
      this.battles = [];
      this.stats = { ticks: 0, nearTicks: 0, farTicks: 0, frameNear: 0, frameSkipped: 0, contactChecks: 0 };
    }
    /* ---------- world ---------- */
    location(id) { return this.byLoc[id] || null; }
    hostile(a, b) {
      if (!a || !b || a === b) return false;
      return this.hostileFn ? !!this.hostileFn(a, b) : true;
    }
    on(fn) { this.listeners.push(fn); }
    emit(type, o) {
      const e = Object.assign({ t: this.t, type }, o || {});
      this.events.push(e);
      if (this.events.length > 4000) this.events.splice(0, 1000);
      for (const f of this.listeners) f(e);
      return e;
    }
    setDragon(d) { this.dragon = d ? Object.assign({ alive: true }, d) : null; }
    setView(v) { this.view = v; }
    /* ---------- armies ---------- */
    addArmy(o) {
      for (const s of o.stacks) if (!A.Stats.known(s.troop)) throw new Error('Armies: unknown troop ' + s.troop);
      if (!this.ground.passable(o.x, o.y)) throw new Error('Armies: ' + (o.name || 'army') + ' placed on impassable ground');
      const a = {
        id: o.id || 'army' + (++this.nArmy), side: o.side, name: o.name || 'Army', x: o.x, y: o.y, px: o.x, py: o.y, rx: o.x, ry: o.y,
        stacks: o.stacks.map((s) => ({ troop: s.troop, count: s.count, wounds: s.wounds || 0 })),
        morale: o.morale !== undefined ? o.morale : 1, home: { x: o.x, y: o.y },
        order: null, plan: null, status: 'idle', alive: true, lod: 'far',
        passage: null, safeUntil: 0, planT: -1e9, warnT: -1e9, battle: null,
      };
      this.armies.set(a.id, a);
      a.passage = this.passageId(a.x, a.y);
      return a;
    }
    passageId(x, y) { const p = this.ground.passageAt(x, y); return p ? p.id : null; }
    speed(a) { return A.Stats.stackSpeed(a.stacks) * (a.status === 'retreating' ? 1.15 : 1); }
    order(id, o) {
      const a = this.armies.get(id);
      if (!a || !a.alive) return { ok: false, reason: 'no such army' };
      if (a.battle) return { ok: false, reason: 'the army is in battle' };
      const r = A.Orders.check(this, a, o);
      if (!r.ok) { this.emit('rejected', { army: a.id, order: o, reason: r.reason }); return r; }
      a.order = Object.assign({}, o, r.location ? { location: r.location } : {}, r.passage ? { passage: r.passage } : {});
      this.setPlan(a, r.route, r.dest);
      a.status = { follow: 'following', hold: 'holding', move: 'moving', attack: 'attacking', defend: 'moving', retreat: 'retreating', enter: 'moving' }[o.kind];
      if (o.kind === 'retreat') a.safeUntil = this.t + 30;
      this.emit('order', { army: a.id, order: a.order, text: A.Orders.describe(this, a.order), via: r.route ? r.route.passages.slice() : [] });
      if (r.route) this.emit('depart', { army: a.id, length: Math.round(r.route.length), via: r.route.passages.slice() });
      return r;
    }
    setPlan(a, route, dest) {
      a.plan = route ? { route, e: 0, dest, v: this.ground.version } : null;
      a.planT = this.t;
    }
    /* ---------- safety ---------- */
    threatsTo(side) {
      const out = [];
      for (const b of this.armies.values()) if (b.alive && this.hostile(side, b.side)) out.push(b);
      return out;
    }
    underThreat(L, side) {
      for (const b of this.threatsTo(side)) if (Math.hypot(b.x - L.x, b.y - L.y) < this.threatR) return true;
      return false;
    }
    safePlace(a, onlyId) {
      const gm = this.ground, threats = this.threatsTo(a.side);
      const avoid = threats.map((b) => ({ x: b.x, y: b.y, r: 520, penalty: 6 }));
      const cands = onlyId ? [this.location(onlyId)].filter(Boolean) : this.locations.slice();
      let best = null;
      for (const L of cands) {
        if (L.owner !== a.side || this.underThreat(L, a.side) || !gm.reachable(a.x, a.y, L.x, L.y)) continue;
        const route = gm.findPath(a.x, a.y, L.x, L.y, { avoid });
        if (route && (!best || route.effort < best.route.effort)) best = { location: L, route };
      }
      if (!best && !onlyId && gm.reachable(a.x, a.y, a.home.x, a.home.y) && Math.hypot(a.home.x - a.x, a.home.y - a.y) > 50) {
        const route = gm.findPath(a.x, a.y, a.home.x, a.home.y, { avoid });
        if (route) best = { location: { id: null, name: 'where it set out', x: a.home.x, y: a.home.y }, route };
      }
      return best;
    }
    // who stands in defence of a place against `side`: its garrison and armies defending it
    defendersAt(L, side) {
      const out = [];
      if (this.hostile(side, L.owner) && L.garrison.some((s) => s.count > 0)) out.push({ garrison: L });
      for (const b of this.armies.values()) {
        if (!b.alive || b.battle || !b.order || b.order.kind !== 'defend' || b.order.location !== L.id || !this.hostile(side, b.side)) continue;
        if (Math.hypot(b.x - L.x, b.y - L.y) <= L.r * 1.5) out.push({ army: b });
      }
      return out;
    }
    /* ---------- time ---------- */
    step(dt) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= this.TICK - 1e-9) { this.acc -= this.TICK; this.tick(); n++; }
      if (Math.abs(this.acc) < 1e-6) this.acc = 0; // (float dust from many small steps)
      return n;
    }
    // smooth positions for near armies only (far ones are not touched between ticks)
    frame() {
      const k = AS.U.clamp(this.acc / this.TICK, 0, 1);
      for (const a of this.armies.values()) {
        if (!a.alive) continue;
        if (a.lod === 'near') { a.rx = a.px + (a.x - a.px) * k; a.ry = a.py + (a.y - a.py) * k; this.stats.frameNear++; }
        else this.stats.frameSkipped++;
      }
    }
    tick() {
      this.t += this.TICK; this.stats.ticks++;
      const list = [...this.armies.values()].filter((a) => a.alive);
      for (const a of list) if (!a.battle) this.think(a);
      for (const a of list) this.advance(a);
      this.contacts(list);
      // near / far
      const v = this.view || this.dragon;
      for (const a of list) {
        if (!a.alive) continue;
        const near = !!v && Math.hypot(a.x - v.x, a.y - v.y) < (v.r || this.viewR);
        const lod = near ? 'near' : 'far';
        if (lod !== a.lod) { a.lod = lod; this.emit('lod', { army: a.id, lod }); }
        a.rx = a.x; a.ry = a.y; // (far armies show where they stand; near ones are smoothed by frame())
        if (near) this.stats.nearTicks++; else this.stats.farTicks++;
        if (a.status === 'recovering') { a.morale = Math.min(1, a.morale + 0.02 * this.TICK); if (a.morale >= 0.9) a.status = 'holding'; }
      }
    }
    // orders that chase something re-plan here
    think(a) {
      const o = a.order; if (!o) return;
      const gm = this.ground;
      // the ground changed under a planned march (a tunnel collapsed, a bridge burnt): plan again
      if (a.plan && a.plan.v !== gm.version && o.kind !== 'follow' && !(o.kind === 'attack' && o.army)) {
        const r = A.Orders.check(this, a, o);
        if (r.ok && r.route) { this.setPlan(a, r.route, r.dest); this.emit('replan', { army: a.id, via: r.route.passages.slice(), length: Math.round(r.route.length) }); }
        else if (!r.ok) { this.emit('rejected', { army: a.id, order: o, reason: r.reason }); this.finish(a); }
        else a.plan.v = gm.version;
      }
      if (o.kind === 'follow') {
        const D = this.dragon;
        if (!D || D.alive === false) { a.status = 'waiting'; a.plan = null; return; }
        const goal = gm.nearestReachable(a.x, a.y, D.x, D.y);
        if (!goal) { a.status = 'waiting'; return; }
        const far = !goal.exact && Math.hypot(goal.x - D.x, goal.y - D.y) > 150; // over a mountain or the sea
        if (far && this.t - a.warnT > 20) { a.warnT = this.t; this.emit('cannot-follow', { army: a.id, reason: 'no ground route reaches the dragon', wait: { x: Math.round(goal.x), y: Math.round(goal.y) } }); }
        const d = Math.hypot(goal.x - a.x, goal.y - a.y);
        if (d < this.followNear) { a.plan = null; a.status = far ? 'waiting' : 'following'; return; }
        a.status = 'following';
        const P = a.plan;
        const stale = !P || Math.hypot(P.dest.x - goal.x, P.dest.y - goal.y) > Math.max(160, d * 0.2);
        if (stale && this.t - a.planT >= (a.lod === 'near' ? 2 : 8) - 1e-9) {
          const r = gm.findPath(a.x, a.y, goal.x, goal.y);
          if (r) this.setPlan(a, r, goal);
        }
      } else if (o.kind === 'attack' && o.army) {
        const t = this.armies.get(o.army);
        if (!t || !t.alive) { this.finish(a, 'target gone'); return; }
        const P = a.plan;
        if ((!P || Math.hypot(P.dest.x - t.x, P.dest.y - t.y) > 100) && this.t - a.planT >= 3 - 1e-9) {
          const r = gm.findPath(a.x, a.y, t.x, t.y);
          if (r) this.setPlan(a, r, { x: t.x, y: t.y }); else this.finish(a, 'target out of reach');
        }
      }
    }
    advance(a) {
      a.px = a.x; a.py = a.y;
      if (a.battle || !a.plan) return;
      const P = a.plan;
      P.e0 = P.e;
      P.e = Math.min(P.route.effort, P.e + this.speed(a) * this.TICK);
      const p = A.Ground.at(P.route, P.e);
      a.x = p.x; a.y = p.y;
      this.trackPassage(a);
      if (p.done) this.arrive(a);
    }
    trackPassage(a) {
      const id = this.passageId(a.x, a.y);
      if (id === a.passage) return;
      if (a.passage) this.emit('passage-out', { army: a.id, passage: a.passage });
      if (id) this.emit('passage-in', { army: a.id, passage: id, groundOnly: this.ground.byId[id].groundOnly });
      a.passage = id;
    }
    arrive(a) {
      const o = a.order; a.plan = null;
      if (!o) return;
      this.emit('arrive', { army: a.id, order: o.kind, x: Math.round(a.x), y: Math.round(a.y) });
      switch (o.kind) {
        case 'move': a.status = 'idle'; break;
        case 'follow': a.status = 'following'; break;
        case 'defend': a.status = 'defending'; break;
        case 'retreat': a.status = 'recovering'; break;
        case 'attack': {
          const L = o.location && this.location(o.location);
          if (L && this.hostile(a.side, L.owner) && !this.defendersAt(L, a.side).length) this.capture(a, L);
          else if (!L) a.status = 'holding';
          break;
        }
        case 'enter': {
          a.status = a.passage ? 'in-passage' : 'idle';
          if (o.passage && !a.passage) this.emit('through', { army: a.id, passage: o.passage });
          break;
        }
      }
    }
    finish(a, why) { a.order = { kind: 'hold' }; a.plan = null; a.status = 'holding'; if (why) this.emit('arrive', { army: a.id, order: 'hold', reason: why }); }
    capture(a, L) {
      const from = L.owner;
      if (L.capturable !== false) L.owner = a.side;
      L.garrison = [];
      this.emit('captured', { army: a.id, location: L.id, from, by: a.side });
      if (a.order && a.order.kind === 'attack' && a.order.thenDefend !== false && L.owner === a.side) {
        a.order = { kind: 'defend', location: L.id }; a.status = 'defending';
      } else if (a.order && a.order.kind === 'enter') a.status = a.passage ? 'in-passage' : 'holding';
      else a.status = 'holding';
    }
    /* ---------- contacts and battles ---------- */
    contacts(list) {
      const R = this.engage, CS = 512;
      const key = (i, j) => i * 100003 + j;
      // one coarse grid per side; armies only look into the grids of sides hostile to them,
      // so armies with no enemy anywhere near cost nothing here
      const grids = new Map(), box = (a) => [Math.floor((Math.min(a.px, a.x) - R) / CS), Math.floor((Math.max(a.px, a.x) + R) / CS), Math.floor((Math.min(a.py, a.y) - R) / CS), Math.floor((Math.max(a.py, a.y) + R) / CS)];
      const present = [...new Set(list.map((a) => a.side))];
      const atWar = new Set();
      for (const x of present) for (const y of present) if (this.hostile(x, y)) atWar.add(x);
      for (const a of list) {
        if (!a.alive || a.battle || !atWar.has(a.side)) continue;
        let G = grids.get(a.side); if (!G) grids.set(a.side, G = new Map());
        const [x0, x1, y0, y1] = box(a);
        for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const k = key(i, j); let c = G.get(k); if (!c) G.set(k, c = []); c.push(a); }
      }
      const sides = [...grids.keys()], meets = [], seen = new Set();
      for (const a of list) {
        if (!a.alive || a.battle || !atWar.has(a.side)) continue;
        const [x0, x1, y0, y1] = box(a);
        for (const sd of sides) {
          if (sd <= a.side || !this.hostile(a.side, sd)) continue; // each pair of sides once
          const G = grids.get(sd);
          for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
            const c = G.get(key(i, j)); if (!c) continue;
            for (const b of c) {
              const pk = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
              if (seen.has(pk)) continue; seen.add(pk);
              this.stats.contactChecks++;
              const m = approach(a.px, a.py, a.x, a.y, b.px, b.py, b.x, b.y);
              if (m.d <= R) meets.push({ a, b, t: m.t, pk });
            }
          }
        }
      }
      // places: hostile garrisons stop whoever walks into them
      const sieges = [];
      for (const a of list) {
        if (!a.alive || a.battle) continue;
        for (const L of this.locations) {
          if (!this.hostile(a.side, L.owner)) continue;
          const c = approach(a.px, a.py, a.x, a.y, L.x, L.y, L.x, L.y);
          if (c.d > L.r) continue;
          if (a.status === 'retreating' && !(a.order && a.order.location === L.id)) continue;
          if (this.defendersAt(L, a.side).length) sieges.push({ a, L, t: c.t });
        }
      }
      // earliest first, then by id, so the outcome never depends on iteration order
      meets.sort((m, n) => m.t - n.t || (m.pk < n.pk ? -1 : 1));
      for (const m of meets) {
        const { a, b } = m;
        if (!a.alive || !b.alive || a.battle || b.battle) continue;
        // a retreat avoids battle, unless it is hunted down
        const huntsB = a.order && a.order.kind === 'attack' && a.order.army === b.id, huntsA = b.order && b.order.kind === 'attack' && b.order.army === a.id;
        if ((a.status === 'retreating' && !huntsA) || (b.status === 'retreating' && !huntsB)) continue;
        if ((a.safeUntil > this.t && !huntsA) || (b.safeUntil > this.t && !huntsB)) continue;
        this.rewind(a, m.t); this.rewind(b, m.t);
        // the one standing its ground defends
        const still = (u) => !u.plan || ['holding', 'defending', 'recovering', 'in-passage', 'idle', 'waiting'].includes(u.status);
        let att = a, def = b;
        if (still(a) && !still(b)) { att = b; def = a; }
        else if (still(a) === still(b) && huntsA && !huntsB) { att = b; def = a; }
        this.fight({ attackers: [att], defenders: [{ army: def }], x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, location: null });
      }
      sieges.sort((m, n) => m.t - n.t || (m.a.id < n.a.id ? -1 : 1));
      for (const s of sieges) {
        if (!s.a.alive || s.a.battle) continue;
        const D = this.defendersAt(s.L, s.a.side);
        if (!D.length) continue;
        this.rewind(s.a, s.t);
        this.fight({ attackers: [s.a], defenders: D, x: s.L.x, y: s.L.y, location: s.L });
      }
    }
    // put an army back where it was at fraction t of this tick
    rewind(a, t) {
      if (!a.plan || a.plan.e0 === undefined) return;
      a.plan.e = a.plan.e0 + (a.plan.e - a.plan.e0) * t;
      const p = A.Ground.at(a.plan.route, a.plan.e);
      a.x = p.x; a.y = p.y;
      this.trackPassage(a);
    }
    dragonCanJoin(x, y, L, sides) {
      const D = this.dragon;
      if (!D || D.alive === false || !sides.includes(D.side)) return { joins: false, why: D ? 'not its fight' : 'no dragon' };
      if (this.ground.groundOnlyAt(x, y) || (L && L.groundOnly)) return { joins: false, why: 'ground-only' };
      if (Math.hypot(D.x - x, D.y - y) > this.dragonReach) return { joins: false, why: 'too far' };
      return { joins: true, why: 'in reach' };
    }
    fight(o) {
      const id = 'battle' + (++this.nBattle);
      const L = o.location;
      const att = o.attackers[0];
      const defSide = L && o.defenders.some((d) => d.garrison) ? L.owner : o.defenders[0].army.side;
      const terrain = this.ground.terrainAt(o.x, o.y);
      const dragon = this.dragonCanJoin(o.x, o.y, L, [att.side, defSide]);
      const B = {
        id, t: this.t, x: Math.round(o.x), y: Math.round(o.y), location: L ? L.id : null, terrain: terrain.key || 'ground',
        groundOnly: this.ground.groundOnlyAt(o.x, o.y) || !!(L && L.groundOnly),
        attacker: { side: att.side, armies: o.attackers.map((a) => a.id) },
        defender: { side: defSide, armies: o.defenders.filter((d) => d.army).map((d) => d.army.id), garrison: !!(L && o.defenders.some((d) => d.garrison)) },
        dragon: dragon.joins, dragonWhy: dragon.why, mode: null, result: null, seed: hash(this.seed, this.nBattle),
      };
      // the forces, each stack tagged with where it came from
      const aStacks = [], dStacks = [];
      for (const a of o.attackers) for (const s of a.stacks) if (s.count > 0) aStacks.push(Object.assign({}, s, { src: a.id }));
      let dStance = 'holding', dMorale = 1, n = 0;
      for (const d of o.defenders) {
        if (d.garrison) { for (const s of d.garrison.garrison) if (s.count > 0) dStacks.push(Object.assign({}, s, { src: '@' + d.garrison.id })); dStance = 'garrison'; }
        else { for (const s of d.army.stacks) if (s.count > 0) dStacks.push(Object.assign({}, s, { src: d.army.id })); dMorale = (dMorale * n + d.army.morale) / (n + 1); n++; if (dStance !== 'garrison') dStance = d.army.status === 'defending' ? 'defending' : d.army.plan ? 'moving' : 'holding'; }
      }
      const am = o.attackers.reduce((m, a) => m + a.morale, 0) / o.attackers.length;
      B.ctx = {
        attacker: { side: att.side, stacks: aStacks, morale: am, stance: att.status === 'retreating' ? 'retreating' : 'moving' },
        defender: { side: defSide, stacks: dStacks, morale: dMorale, stance: dStance, fort: L && (dStance === 'garrison' || dStance === 'defending') ? L.fort : 1, breach: L && L.breach, noRetreat: !!(L && L.noRetreat) },
        terrain: L && L.terrain ? A.Ground.KIND[L.terrain] : terrain, seed: B.seed,
      };
      this.battles.push(B);
      for (const a of o.attackers) { a.battle = id; a.status = 'fighting'; }
      for (const d of o.defenders) if (d.army) { d.army.battle = id; d.army.status = 'fighting'; }
      this.emit('battle', { battle: id, location: B.location, attacker: att.id, defenders: B.defender.armies, garrison: B.defender.garrison, dragon: B.dragon, why: B.dragonWhy, terrain: B.terrain, groundOnly: B.groundOnly });
      if (B.dragon && this.onTactical) {
        B.mode = 'tactical';
        this.emit('tactical', { battle: id });
        this.onTactical(B);
        return B;
      }
      B.mode = 'auto';
      this.settle(id, A.AutoResolve.resolve(B.ctx));
      return B;
    }
    /* apply a battle result — from the auto-resolver, or the same shape from a real-time battle */
    settle(id, res) {
      const B = this.battles.find((b) => b.id === id);
      if (!B || B.result) return false;
      B.result = { winner: res.winner, reason: res.reason, rounds: res.rounds, attacker: { casualties: res.attacker.casualties, lost: res.attacker.lost }, defender: { casualties: res.defender.casualties, lost: res.defender.lost }, log: res.log };
      const L = B.location ? this.location(B.location) : null;
      const back = (src, survivors) => survivors.filter((s) => s.src === src).map((s) => ({ troop: s.troop, count: s.count, wounds: s.wounds || 0 }));
      const losers = res.winner === 'attacker' ? 'defender' : 'attacker';
      const restOf = (side) => res[side];
      const touched = [];
      for (const aid of B.attacker.armies.concat(B.defender.armies)) {
        const a = this.armies.get(aid), side = B.attacker.armies.includes(aid) ? 'attacker' : 'defender';
        a.battle = null;
        a.stacks = back(aid, restOf(side).survivors);
        a.morale = restOf(side).morale;
        a.safeUntil = this.t + 15;
        touched.push([a, side]);
        if (!a.stacks.some((s) => s.count > 0)) { a.alive = false; a.status = 'routed'; a.plan = null; this.emit('routed', { army: a.id, battle: id }); }
      }
      if (L && B.defender.garrison) L.garrison = back('@' + L.id, res.defender.survivors);
      this.emit('battle-end', { battle: id, winner: res.winner, reason: res.reason, rounds: res.rounds, attackerLost: res.attacker.lost, defenderLost: res.defender.lost, mode: B.mode });
      // what each side does next (the beaten first, so they have left before the victors claim the ground)
      touched.sort((x, y) => (x[1] === losers ? 0 : 1) - (y[1] === losers ? 0 : 1));
      for (const [a, side] of touched) {
        if (!a.alive) continue;
        if (side === losers) this.fallBack(a, B);
        else if (side === 'attacker' && L) {
          if (!this.defendersAt(L, a.side).length) this.capture(a, L);
        } else this.resume(a);
      }
      // a beaten garrison abandons its walls: survivors march off as an army of their own
      if (L && B.defender.garrison && res.winner === 'attacker') {
        const left = L.garrison.filter((s) => s.count > 0), side = B.defender.side;
        L.garrison = [];
        const winner = this.armies.get(B.attacker.armies[0]);
        if (winner && winner.alive && L.owner !== winner.side && !this.defendersAt(L, winner.side).length) this.capture(winner, L);
        if (left.length) {
          const r = this.addArmy({ side, name: L.name + ' remnant', stacks: left, x: L.x, y: L.y, morale: 0.3 });
          r.status = 'retreating';
          const pick = this.safePlace(r);
          if (pick) { r.order = { kind: 'retreat', location: pick.location.id }; this.setPlan(r, pick.route, { x: pick.location.x, y: pick.location.y }); r.safeUntil = this.t + 30; this.emit('retreat', { army: r.id, to: pick.location.name }); }
          else { r.alive = false; r.status = 'dispersed'; this.emit('routed', { army: r.id, battle: id, dispersed: true }); }
        }
      }
      return true;
    }
    fallBack(a, B) {
      const pick = this.safePlace(a);
      if (pick) {
        a.order = { kind: 'retreat', location: pick.location.id }; a.status = 'retreating';
        this.setPlan(a, pick.route, { x: pick.location.x, y: pick.location.y });
        a.safeUntil = this.t + 30;
        this.emit('retreat', { army: a.id, battle: B.id, to: pick.location.name });
      } else { a.order = { kind: 'hold' }; a.plan = null; a.status = 'holding'; this.emit('retreat', { army: a.id, battle: B.id, to: null }); }
    }
    resume(a) {
      const o = a.order;
      if (!o) { a.status = 'idle'; return; }
      if (o.kind === 'follow') { a.status = 'following'; a.planT = -1e9; return; }
      if (o.kind === 'hold' || (o.kind === 'defend' && !a.plan)) { a.status = o.kind === 'hold' ? 'holding' : 'defending'; return; }
      if (a.plan) { a.status = { move: 'moving', attack: 'attacking', defend: 'moving', retreat: 'retreating', enter: 'moving' }[o.kind] || 'moving'; return; }
      a.status = o.kind === 'enter' && a.passage ? 'in-passage' : 'holding';
    }
    /* ---------- saving ---------- */
    snapshot() {
      const armies = [];
      for (const a of this.armies.values()) {
        armies.push({ id: a.id, side: a.side, name: a.name, x: a.x, y: a.y, stacks: a.stacks.map((s) => Object.assign({}, s)), morale: a.morale, home: a.home,
          order: a.order, status: a.status, alive: a.alive, safeUntil: a.safeUntil, planT: a.planT,
          plan: a.plan ? { pts: a.plan.route.pts, e: a.plan.e, dest: a.plan.dest } : null });
      }
      return {
        version: 1, t: this.t, acc: this.acc, nArmy: this.nArmy, nBattle: this.nBattle, seed: this.seed,
        blocked: this.ground.passages.filter((p) => p.blocked).map((p) => p.id),
        locations: this.locations.map((L) => ({ id: L.id, owner: L.owner, garrison: L.garrison.map((s) => Object.assign({}, s)) })),
        armies, dragon: this.dragon,
      };
    }
    restore(s) {
      this.t = s.t; this.acc = s.acc; this.nArmy = s.nArmy; this.nBattle = s.nBattle; this.seed = s.seed;
      for (const p of this.ground.passages) if (p.blocked !== s.blocked.includes(p.id)) { p.blocked = s.blocked.includes(p.id); }
      this.ground.refresh();
      for (const r of s.locations) { const L = this.byLoc[r.id]; if (L) { L.owner = r.owner; L.garrison = r.garrison.map((x) => Object.assign({}, x)); } }
      this.armies.clear();
      for (const r of s.armies) {
        const a = Object.assign({ px: r.x, py: r.y, rx: r.x, ry: r.y, lod: 'far', battle: null, warnT: -1e9 }, r, { stacks: r.stacks.map((x) => Object.assign({}, x)) });
        a.plan = r.plan ? { route: this.ground.makeRoute(r.plan.pts), e: r.plan.e, dest: r.plan.dest, v: this.ground.version } : null;
        a.passage = this.passageId(a.x, a.y);
        this.armies.set(a.id, a);
      }
      this.dragon = s.dragon;
    }
  }
  A.Sim = { ArmySim };
})(window.AS);
