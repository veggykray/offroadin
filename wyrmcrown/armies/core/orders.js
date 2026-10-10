/* WYRMCROWN — GROUND ARMIES: orders.
 * An order is a small JSON-safe record. Orders.check(sim, army, order) says
 * whether it can be carried out right now and, if so, plans it: the route and
 * where the army stands when it is done. The simulation (core/sim.js) carries
 * plans out and re-plans the orders that chase something (the dragon, an army).
 *
 *   follow                  stay with the dragon by the ground; if it is over a
 *                           mountain or the sea, wait at the nearest ground it
 *                           can walk to
 *   hold                    stop and stand ready (a defensive stance)
 *   move    {x, y}          march to accessible ground; refused if it cannot be
 *                           walked to (unless nearest: true)
 *   attack  {location|army} march on an enemy place or army and fight it; a place
 *                           taken is then defended (thenDefend, default true)
 *   defend  {location}      hold a place your side has captured, as its garrison
 *   retreat {location?}     fall back to a safe place your side holds (the given
 *                           one, else the quickest one not under threat), skirting
 *                           enemies, a little faster, avoiding battle
 *   enter   {passage|location}  go into a ground-only passage (through a tunnel to
 *                           its far side, into a cave to its chamber) or straight
 *                           at an encounter — places the dragon cannot go */
'use strict';
(function (AS) {
  const G = () => AS.Armies.Ground;
  const Orders = {
    KINDS: ['follow', 'hold', 'move', 'attack', 'defend', 'retreat', 'enter'],
    follow: () => ({ kind: 'follow' }),
    hold: () => ({ kind: 'hold' }),
    move: (x, y, o) => Object.assign({ kind: 'move', x, y }, o || {}),
    attack: (target, o) => Object.assign({ kind: 'attack' }, typeof target === 'string' ? { location: target } : target, o || {}),
    defend: (location) => ({ kind: 'defend', location }),
    retreat: (location) => (location ? { kind: 'retreat', location } : { kind: 'retreat' }),
    enter: (target, o) => Object.assign({ kind: 'enter' }, target && target.location ? target : { passage: target }, o || {}),

    /* → { ok: true, route|null, dest: {x, y}, ... } or { ok: false, reason } */
    check(sim, army, o) {
      const gm = sim.ground;
      const no = (reason) => ({ ok: false, reason });
      if (!o || !this.KINDS.includes(o.kind)) return no('unknown order');
      if (!army.stacks.some((s) => s.count > 0)) return no('the army has no soldiers left');
      const routeTo = (x, y, opt) => gm.findPath(army.x, army.y, x, y, opt);
      switch (o.kind) {
        case 'hold': return { ok: true, route: null, dest: { x: army.x, y: army.y } };
        case 'follow': {
          const D = sim.dragon;
          if (!D || D.alive === false) return no('there is no dragon to follow');
          return { ok: true, route: null, dest: null }; // planned every tick by the simulation
        }
        case 'move': {
          if (!gm.passable(o.x, o.y) || !gm.reachable(army.x, army.y, o.x, o.y)) {
            if (!o.nearest) return no(gm.passable(o.x, o.y) ? 'no ground route leads there' : 'that ground cannot be walked (' + gm.terrainAt(o.x, o.y).name + ')');
            const n = gm.nearestReachable(army.x, army.y, o.x, o.y);
            if (!n) return no('no ground route leads anywhere near there');
            return { ok: true, route: routeTo(n.x, n.y), dest: n };
          }
          return { ok: true, route: routeTo(o.x, o.y), dest: { x: o.x, y: o.y } };
        }
        case 'attack': {
          if (o.army) {
            const t = sim.armies.get(o.army);
            if (!t || !t.alive) return no('that army is gone');
            if (!sim.hostile(army.side, t.side)) return no('that army is not an enemy');
            if (!gm.reachable(army.x, army.y, t.x, t.y)) return no('no ground route leads to that army');
            return { ok: true, route: routeTo(t.x, t.y), dest: { x: t.x, y: t.y } };
          }
          const L = sim.location(o.location);
          if (!L) return no('no such place');
          if (!sim.hostile(army.side, L.owner) && !sim.defendersAt(L, army.side).length) return no(L.name + ' is not held by an enemy');
          if (!gm.reachable(army.x, army.y, L.x, L.y)) return no('no ground route leads to ' + L.name);
          return { ok: true, route: routeTo(L.x, L.y), dest: { x: L.x, y: L.y } };
        }
        case 'defend': {
          const L = sim.location(o.location);
          if (!L) return no('no such place');
          if (L.owner !== army.side) return no(L.name + ' must be captured before it can be defended');
          if (!gm.reachable(army.x, army.y, L.x, L.y)) return no('no ground route leads to ' + L.name);
          return { ok: true, route: routeTo(L.x, L.y), dest: { x: L.x, y: L.y } };
        }
        case 'retreat': {
          const pick = sim.safePlace(army, o.location);
          if (!pick) return no(o.location ? 'that place is not safe or cannot be reached' : 'there is nowhere safe to fall back to');
          return { ok: true, route: pick.route, dest: { x: pick.location.x, y: pick.location.y }, location: pick.location.id };
        }
        case 'enter': {
          if (o.location) {
            const L = sim.location(o.location);
            if (!L) return no('no such place');
            if (!gm.reachable(army.x, army.y, L.x, L.y)) return no('no ground route leads to ' + L.name);
            return { ok: true, route: routeTo(L.x, L.y), dest: { x: L.x, y: L.y } };
          }
          const P = gm.byId[o.passage];
          if (!P) return no('no such passage');
          if (P.blocked) return no(P.name + ' is blocked');
          const ends = gm.entrances(P.id).filter((e) => gm.reachable(army.x, army.y, e.x, e.y) || gm.passageAt(army.x, army.y) === P);
          if (!ends.length) return no('no ground route leads to ' + P.name);
          // the near mouth: the cheapest to reach
          let near = null, nr = null;
          const inside = gm.passageAt(army.x, army.y) === P;
          for (const e of ends) {
            const r = inside ? null : routeTo(e.x, e.y);
            if (inside || (r && (!nr || r.effort < nr.effort))) { near = e; nr = r; if (inside) break; }
          }
          // the goal: the encounter inside (a cave's chamber), else the far mouth (through a tunnel)
          const L = P.location ? sim.location(P.location) : null;
          let goal;
          if (L && o.through !== true) goal = { x: L.x, y: L.y };
          else {
            let far = null, fd = -1;
            for (const e of gm.entrances(P.id)) { const d = Math.hypot(e.x - near.x, e.y - near.y); if (d > fd) { fd = d; far = e; } }
            if (fd < gm.cell * 2) goal = { x: near.inner.x, y: near.inner.y }; // a dead end with nothing in it: go in and stand
            else goal = { x: far.x, y: far.y };
          }
          const start = inside ? { x: army.x, y: army.y } : near;
          const leg = gm.findPath(start.x, start.y, goal.x, goal.y, { within: P.id });
          if (!leg) return no('the way through ' + P.name + ' is closed');
          const route = nr ? G().join(nr, leg) : leg;
          return { ok: true, route, dest: goal, passage: P.id, location: L ? L.id : null };
        }
      }
      return no('unknown order');
    },
    // a short description, for logs and readouts
    describe(sim, o) {
      if (!o) return 'no orders';
      const L = o.location && sim.location(o.location), P = o.passage && sim.ground.byId[o.passage];
      switch (o.kind) {
        case 'follow': return 'follow the dragon';
        case 'hold': return 'hold position';
        case 'move': return 'march to ' + Math.round(o.x) + ', ' + Math.round(o.y);
        case 'attack': return 'attack ' + (L ? L.name : o.army);
        case 'defend': return 'defend ' + (L ? L.name : o.location);
        case 'retreat': return 'retreat' + (L ? ' to ' + L.name : '');
        case 'enter': return 'enter ' + (P ? P.name : L ? L.name : '?');
      }
      return o.kind;
    },
  };
  AS.Armies.Orders = Orders;
})(window.AS);
