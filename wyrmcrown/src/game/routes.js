/* WYRMCROWN — ROUTES: how armies may travel between places.
 *
 * Ordinary ground is walked with the realm's own navigation (src/game/nav.js: the
 * passability grid, roads cheaper, open water and blocking peaks impassable,
 * bridges open). On top of it a map may describe a ROUTE NETWORK (map.routes):
 *
 *   nodes  { id, name, x, y, layer: 'surface'|'under', mx, my }
 *          a surface node is a real point on the map; an underground node has no
 *          ground position (mx, my only place it on the war map and the HUD)
 *   links  { id, name, a, b, type, travel?, length?, requires?: [condition…],
 *            chokepoint?: siteId, oneWay? }
 *          explicit connections the grid cannot see: a tunnel under a mountain, an
 *          underground road between distant places, a sea crossing. `travel` is
 *          the time it takes in seconds (an underground shortcut can join far-apart
 *          places almost at once); otherwise length / march speed.
 *
 * Route types (TYPES) say who may use a link and how fast:
 *   road, land, pass, bridge   surface ways (walked on the grid; listed so data can
 *                              name them, e.g. a pass that is a chokepoint)
 *   underground_entrance       from the surface into the ground: armies only
 *   underground                a way through the ground: armies only, no dragon
 *   sea                        needs transport (a ship): data and checks only for now
 *
 * Conditions (`requires`) are data, checked by allowed():
 *   { flag: 'name' }                 a world flag must be set (g.armies.flags)
 *   { owner: siteId }                the army's side must hold that place
 *   { cleared: groupId }             that enemy group must be gone
 *   { transport: 'ship' }            the army must have that transport
 *   { not: condition }               the opposite
 * plan() finds a way from an army to a point or a node: a walk on the grid where
 * the ground connects, explicit links where it does not. */
'use strict';
(function (AS) {
  const U = AS.U;
  const TYPES = {
    road: { surface: true, speed: 1.15, label: 'road' },
    land: { surface: true, speed: 1, label: 'open land' },
    pass: { surface: true, speed: 0.75, chokepoint: true, label: 'mountain pass' },
    bridge: { surface: true, speed: 1, chokepoint: true, label: 'bridge' },
    underground_entrance: { groundOnly: true, speed: 0.6, label: 'underground entrance' },
    underground: { groundOnly: true, under: true, speed: 0.9, label: 'underground way' },
    sea: { transport: 'ship', speed: 1.6, label: 'sea crossing' },
  };

  const Routes = {
    TYPES,
    net(g) { return (g.map && g.map.routes) || { nodes: [], links: [] }; },
    node(g, id) { return this.net(g).nodes.find((n) => n.id === id) || null; },
    link(g, id) { return this.net(g).links.find((l) => l.id === id) || null; },
    // is the ground at (x, y) connected on foot to (x2, y2)? (one flood fill per map)
    sameLand(g, x, y, x2, y2) {
      if (g.nav && g.nav.stream) return AS.Nav.reachable(g, x, y, x2, y2);
      return AS.BigCampaign.landOf(g, x, y) === AS.BigCampaign.landOf(g, x2, y2);
    },
    // may this army use this link now? → { ok, reason }
    allowed(g, link, army) {
      const T = TYPES[link.type] || TYPES.land;
      if (T.transport && !(army.transport || []).includes(T.transport)) return { ok: false, reason: 'needs a ' + T.transport + ' (' + (link.name || T.label) + ')' };
      for (const c of link.requires || []) { const r = this.check(g, c, army); if (!r.ok) return { ok: false, reason: (link.name || T.label) + ': ' + r.reason }; }
      return { ok: true };
    },
    check(g, c, army) {
      const A = g.armies;
      if (c.not) { const r = this.check(g, c.not, army); return r.ok ? { ok: false, reason: c.why || 'not allowed' } : { ok: true }; }
      if (c.flag) return A && A.flags[c.flag] ? { ok: true } : { ok: false, reason: c.why || 'closed' };
      if (c.owner) { const s = g.byId.get(c.owner); return s && s.owner === army.owner ? { ok: true } : { ok: false, reason: c.why || 'you must hold ' + (s ? s.name : c.owner) }; }
      if (c.cleared) { const G = A && A.groups[c.cleared]; return !G || G.defeated ? { ok: true } : { ok: false, reason: c.why || G.name + ' bar the way' }; }
      if (c.transport) return (army.transport || []).includes(c.transport) ? { ok: true } : { ok: false, reason: 'needs a ' + c.transport };
      return { ok: true };
    },
    // the walking route between two points on connected ground, or null
    walk(g, x0, y0, x1, y1) {
      if (!this.sameLand(g, x0, y0, x1, y1)) return null;
      const p = AS.Nav.path(g, x0, y0, x1, y1);
      return p && !p.unreachable ? p.map((q) => [q[0], q[1]]) : null;
    },
    plen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; },

    /* plan a way for an army from (x0, y0) — or from an underground node — to a target
     * { x, y } on the surface or { node }. → { ok, legs, reason, notes }
     * legs: { kind: 'walk', pts } on the ground, { kind: 'link', link, from, to, travel, under }
     * through an explicit connection. Searches the network with the grid's walks as
     * implicit edges between surface points on the same ground (Dijkstra; tiny graphs). */
    plan(g, army, target, opt) {
      opt = opt || {};
      const N = this.net(g), speed = Math.max(10, army.speed || 40);
      const from = army.layer === 'under' && army.node ? { node: army.node } : { x: army.x, y: army.y };
      const goal = target.node ? this.node(g, target.node) : null;
      if (target.node && !goal) return { ok: false, reason: 'no such place' };
      // the simple case: the same ground, no network needed
      if (!from.node && !target.node) {
        const w = this.walk(g, from.x, from.y, target.x, target.y);
        if (w) return { ok: true, legs: [{ kind: 'walk', pts: w }], notes: this.chokepoints(g, w, army) };
      }
      // vertices: the network's nodes, then the start and the goal when they are plain points
      const V = [], idx = {};
      for (const n of N.nodes) { idx[n.id] = V.length; V.push({ x: n.x, y: n.y, node: n.id, layer: n.layer || 'surface' }); }
      let S, G;
      if (from.node) S = idx[from.node]; else { S = V.length; V.push({ x: from.x, y: from.y, layer: 'surface' }); }
      if (goal) G = idx[goal.id]; else { G = V.length; V.push({ x: target.x, y: target.y, layer: 'surface' }); }
      const surf = (v) => v.layer !== 'under' && v.x !== undefined;
      const edges = V.map(() => []), blocked = [];
      // explicit links
      for (const l of N.links) {
        const a = idx[l.a], b = idx[l.b]; if (a === undefined || b === undefined) continue;
        const T = TYPES[l.type] || TYPES.land;
        if (T.surface) continue; // surface ways are walked on the ground (the implicit walks below)
        const ok = opt.open ? { ok: true } : this.allowed(g, l, army);
        if (!ok.ok) { blocked.push(ok.reason); continue; }
        const t = l.travel !== undefined ? l.travel : (l.length || Math.hypot(V[a].x - V[b].x, V[a].y - V[b].y)) / (speed * T.speed);
        edges[a].push({ to: b, cost: t, link: l });
        if (!l.oneWay) edges[b].push({ to: a, cost: t, link: l });
      }
      // implicit walks between surface points on the same ground (straight-line estimate × 1.25)
      for (let i = 0; i < V.length; i++) for (let j = 0; j < V.length; j++) {
        if (i === j || j === S || i === G || !surf(V[i]) || !surf(V[j])) continue;
        if (!this.sameLand(g, V[i].x, V[i].y, V[j].x, V[j].y)) continue;
        edges[i].push({ to: j, cost: Math.hypot(V[i].x - V[j].x, V[i].y - V[j].y) * 1.25 / speed, walk: true });
      }
      // Dijkstra
      const dist = V.map(() => 1e18), prev = V.map(() => null), done = V.map(() => false);
      dist[S] = 0;
      for (;;) {
        let u = -1; for (let i = 0; i < V.length; i++) if (!done[i] && dist[i] < 1e17 && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0 || u === G) break;
        done[u] = true;
        for (const e of edges[u]) if (dist[u] + e.cost < dist[e.to]) { dist[e.to] = dist[u] + e.cost; prev[e.to] = { from: u, e }; }
      }
      if (dist[G] > 1e17) {
        // say which closed way would have led there (the same search with every way open)
        let why = 'no way there on foot';
        if (blocked.length && !opt.open) {
          const o = this.plan(g, army, target, { open: true });
          const shut = o.ok ? o.legs.filter((L) => L.kind === 'link').map((L) => this.allowed(g, this.link(g, L.link), army)).filter((r) => !r.ok) : [];
          why = shut.length ? shut[0].reason : 'no open way — ' + blocked[0];
        }
        return { ok: false, reason: why, blocked };
      }
      // the chain of steps, then real walking routes for the walks
      const steps = [];
      for (let v = G; prev[v]; v = prev[v].from) steps.unshift({ a: prev[v].from, b: v, e: prev[v].e });
      const legs = [];
      for (const s of steps) {
        const A = V[s.a], B = V[s.b];
        if (s.e.walk) {
          const w = this.walk(g, A.x, A.y, B.x, B.y);
          if (!w) return { ok: false, reason: 'the ground route failed' };
          legs.push({ kind: 'walk', pts: w });
        } else {
          const l = s.e.link, T = TYPES[l.type] || TYPES.land;
          legs.push({ kind: 'link', link: l.id, from: A.node, to: B.node, travel: +s.e.cost.toFixed(2), under: !!T.under || l.type === 'underground_entrance', type: l.type });
        }
      }
      const notes = [];
      for (const L of legs) if (L.kind === 'walk') notes.push(...this.chokepoints(g, L.pts, army));
      return { ok: true, legs, notes };
    },
    /* a named ground-only passage (map.routes.passages: { id, name, links: [linkId…] }):
     * walk to its mouth, then through its links in order, out at the far end */
    passage(g, id) { return (this.net(g).passages || []).find((q) => q.id === id) || null; },
    passagePlan(g, army, id) {
      const P = this.passage(g, id); if (!P) return { ok: false, reason: 'no such passage' };
      const links = P.links.map((l) => this.link(g, l));
      for (const l of links) { const r = this.allowed(g, l, army); if (!r.ok) return { ok: false, reason: r.reason }; }
      const mouth = this.node(g, links[0].a), legs = [], speed = Math.max(10, army.speed || 40);
      if (Math.hypot(army.x - mouth.x, army.y - mouth.y) > 120) {
        const w = this.walk(g, army.x, army.y, mouth.x, mouth.y);
        if (!w) return { ok: false, reason: 'the army cannot walk to ' + mouth.name };
        legs.push({ kind: 'walk', pts: w });
      }
      for (const l of links) {
        const T = TYPES[l.type] || TYPES.land, A = this.node(g, l.a), B = this.node(g, l.b);
        const t = l.travel !== undefined ? l.travel : (l.length || Math.hypot(A.x - B.x, A.y - B.y)) / (speed * T.speed);
        legs.push({ kind: 'link', link: l.id, from: l.a, to: l.b, travel: +t.toFixed(2), under: !!T.under || l.type === 'underground_entrance', type: l.type });
      }
      return { ok: true, legs, notes: legs[0].kind === 'walk' ? this.chokepoints(g, legs[0].pts, army) : [], exit: links[links.length - 1].b };
    },
    // defended chokepoints a walk passes (a link marks one with `chokepoint: siteId`)
    chokepoints(g, pts, army) {
      const out = [];
      for (const l of this.net(g).links) {
        if (!l.chokepoint) continue;
        const s = g.byId.get(l.chokepoint); if (!s || !s.guarded || !s.guarded() || s.owner === army.owner) continue;
        for (let i = 1; i < pts.length; i++) if (U.segDist(s.x, s.y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) < 420) { out.push((l.name || 'a pass') + ' is held by enemies: the army will have to fight through'); break; }
      }
      return out;
    },
  };
  AS.Routes = Routes;
})(window.AS);
