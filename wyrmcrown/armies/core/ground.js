/* WYRMCROWN — GROUND ARMIES: the ground an army can walk.
 *
 * GroundMap is a walking grid (square cells, default 64 units like AS.Nav)
 * with named PASSAGES laid over it. Each cell has a terrain kind, and each
 * kind a walking cost (0 = impassable: mountains, deep water). Passages are
 * the places that make ground war interesting:
 *
 *   tunnel   a way through a mountain; ground only (the dragon cannot follow)
 *   cave     a dead end in the rock, usually with an encounter inside
 *   bridge   a crossing over deep water (the dragon flies over it, of course)
 *   pass     any other chokepoint worth naming
 *
 * Any passage can be BLOCKED (a collapsed tunnel, a burnt bridge, a sealed
 * gate): its cells become impassable and every route and reachability answer
 * changes with it (the map's `version` counts such changes).
 *
 * A route is a smoothed polyline cut into LEGS of even ground. Progress along
 * it is measured in effort (length × walking cost), so a march is a pure
 * function of time: an army far from the dragon does not have to be stepped
 * frame by frame to know where it is (see core/sim.js).
 *
 * The grid can come from ASCII art (test scenarios), from a terrain-kind array,
 * or straight from a realm's existing walking grid (GroundMap.fromNav(g.nav)),
 * so the same armies can march on whatever world the campaign finally uses. */
'use strict';
(function (AS) {
  const SQRT2 = Math.SQRT2;
  // terrain kinds: walking cost (0 = impassable) and how they shape a fight (core/autoresolve.js)
  //   ranged    × missile effect · frontage  how many can fight abreast (0 = open field)
  //   high      defender's high-ground bonus · ford  attackers struggle in the water
  //   groundOnly  the dragon cannot take part in a fight here
  const KINDS = [
    { key: 'plain', ch: '.', name: 'open ground', cost: 1, ranged: 1 },
    { key: 'road', ch: '=', name: 'road', cost: 0.55, ranged: 1 },
    { key: 'forest', ch: 'f', name: 'forest', cost: 1.4, ranged: 0.7, cover: 0.1 },
    { key: 'hill', ch: 'h', name: 'hills', cost: 1.8, ranged: 1.1, high: 0.15 },
    { key: 'mountain', ch: 'M', name: 'mountains', cost: 0 },
    { key: 'deep', ch: '~', name: 'deep water', cost: 0 },
    { key: 'shallow', ch: ',', name: 'ford', cost: 2.6, ranged: 0.9, ford: 0.8 },
    { key: 'bridge', ch: 'B', name: 'bridge', cost: 0.6, ranged: 1, frontage: 7 },
    { key: 'tunnel', ch: 'T', name: 'tunnel', cost: 0.9, ranged: 0.35, frontage: 5, groundOnly: true },
    { key: 'cave', ch: 'C', name: 'cave', cost: 1.3, ranged: 0.35, frontage: 4, groundOnly: true },
    { key: 'town', ch: 'S', name: 'settlement', cost: 0.7, ranged: 0.9, cover: 0.05 },
    { key: 'fort', ch: 'F', name: 'fortress', cost: 0.8, ranged: 1, high: 0.1 },
  ];
  const KIND = {}; KINDS.forEach((k, i) => { k.i = i; KIND[k.key] = k; });
  const GENERIC = { key: 'ground', name: 'ground', cost: 1, ranged: 1 };

  // a binary min-heap of cell indices keyed by f (Float32Array)
  class Heap {
    constructor() { this.a = []; }
    push(i, f) { const a = this.a; a.push(i); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (f[a[p]] <= f[i]) break; a[k] = a[p]; k = p; } a[k] = i; }
    pop(f) {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        let k = 0; const n = a.length;
        for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && f[a[c + 1]] < f[a[c]]) c++; if (f[a[c]] >= f[last]) break; a[k] = a[c]; k = c; }
        a[k] = last;
      }
      return top;
    }
    get size() { return this.a.length; }
  }

  class GroundMap {
    /* o: { W, H, cell=64, kinds?: Uint8Array (KINDS index per cell), cost?: Float32Array,
     *      passages?: [{ id, kind, name, cells: [[i,j]…] | ch, blocked, groundOnly, location }] } */
    constructor(o) {
      this.W = o.W; this.H = o.H; this.cell = o.cell || 64;
      const N = this.W * this.H;
      this.kinds = o.kinds || null;
      this.base = new Float32Array(N);
      if (o.cost) this.base.set(o.cost);
      else for (let k = 0; k < N; k++) this.base[k] = KINDS[this.kinds[k]].cost;
      this.cost = new Float32Array(N);
      this.pass = new Int16Array(N).fill(-1);    // passage index per cell
      this.passages = []; this.byId = {};
      for (const p of o.passages || []) this.addPassage(p);
      this.version = 0;
      // A* scratch (reused; stamps avoid clearing)
      this._g = new Float32Array(N); this._f = new Float32Array(N); this._par = new Int32Array(N);
      this._seen = new Uint32Array(N); this._closed = new Uint32Array(N); this._stamp = 0;
      this.cache = new Map();
      this.stats = { searches: 0, expanded: 0, cacheHits: 0 };
      this.refresh();
    }
    /* ---------- construction ---------- */
    // rows: array of equal-length strings; letters in `passages[].ch` mark a passage's cells
    // and take that passage's terrain kind (its `kind`)
    static fromAscii(rows, o) {
      o = o || {};
      const H = rows.length, W = rows[0].length, kinds = new Uint8Array(W * H);
      const byCh = {}; for (const k of KINDS) byCh[k.ch] = k.i;
      const passages = (o.passages || []).map((p) => Object.assign({}, p, p.ch ? { cells: [] } : {}));
      const pch = {}; for (const p of passages) if (p.ch) pch[p.ch] = p;
      for (let j = 0; j < H; j++) {
        if (rows[j].length !== W) throw new Error('GroundMap: row ' + j + ' is ' + rows[j].length + ' wide, expected ' + W);
        for (let i = 0; i < W; i++) {
          const ch = rows[j][i];
          if (pch[ch]) { kinds[j * W + i] = KIND[pch[ch].kind].i; pch[ch].cells.push([i, j]); continue; }
          if (byCh[ch] === undefined) throw new Error('GroundMap: unknown terrain "' + ch + '" at ' + i + ',' + j);
          kinds[j * W + i] = byCh[ch];
        }
      }
      return new GroundMap({ W, H, cell: o.cell, kinds, passages });
    }
    // any walking-cost grid (0 = impassable), e.g. a realm's g.nav (src/game/nav.js)
    static fromCostGrid(W, H, cost, cell, passages) { return new GroundMap({ W, H, cell, cost, passages }); }
    static fromNav(nav, passages) { return GroundMap.fromCostGrid(nav.W, nav.H, nav.cost, (AS.Nav && AS.Nav.CELL) || 64, passages); }
    addPassage(p) {
      const k = this.passages.length, kind = KIND[p.kind] || GENERIC;
      const P = Object.assign({ name: p.id, blocked: false }, p, { index: k, groundOnly: p.groundOnly !== undefined ? p.groundOnly : !!kind.groundOnly, cells: (p.cells || []).map((c) => c[1] * this.W + c[0]) });
      for (const c of P.cells) this.pass[c] = k;
      this.passages.push(P); this.byId[P.id] = P;
      return P;
    }
    /* ---------- state ---------- */
    refresh() {
      const N = this.W * this.H;
      this.minCost = Infinity;
      for (let k = 0; k < N; k++) {
        const p = this.pass[k] >= 0 ? this.passages[this.pass[k]] : null;
        const c = p && p.blocked ? 0 : this.base[k];
        this.cost[k] = c;
        if (c > 0 && c < this.minCost) this.minCost = c;
      }
      this.comp = null; this.cache.clear(); this.version++;
    }
    setBlocked(id, blocked) {
      const p = this.byId[id]; if (!p) throw new Error('GroundMap: no passage ' + id);
      if (p.blocked === !!blocked) return false;
      p.blocked = !!blocked; this.refresh();
      return true;
    }
    /* ---------- lookups ---------- */
    idx(x, y) { const i = Math.floor(x / this.cell), j = Math.floor(y / this.cell); return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : j * this.W + i; }
    centre(k) { const i = k % this.W, j = (k - i) / this.W; return { x: (i + 0.5) * this.cell, y: (j + 0.5) * this.cell }; }
    terrainAt(x, y) { const k = this.idx(x, y); return k < 0 ? KIND.mountain : this.kinds ? KINDS[this.kinds[k]] : GENERIC; }
    costAt(x, y) { const k = this.idx(x, y); return k < 0 ? 0 : this.cost[k]; }
    passable(x, y) { return this.costAt(x, y) > 0; }
    passageAt(x, y) { const k = this.idx(x, y); return k < 0 || this.pass[k] < 0 ? null : this.passages[this.pass[k]]; }
    // the dragon cannot join a fight on ground-only terrain or inside a ground-only passage
    groundOnlyAt(x, y) { const p = this.passageAt(x, y); return p ? p.groundOnly : !!this.terrainAt(x, y).groundOnly; }
    // a step between neighbouring cells is allowed if both are open and a diagonal does not cut a corner
    step(a, b) {
      if (this.cost[a] <= 0 || this.cost[b] <= 0) return false;
      const W = this.W, ai = a % W, bi = b % W;
      if (ai !== bi && (a - ai) !== (b - bi)) return this.cost[(a - ai) + bi] > 0 && this.cost[(b - bi) + ai] > 0;
      return true;
    }
    /* ---------- connected land ---------- */
    components() {
      if (this.comp) return this.comp;
      const W = this.W, H = this.H, C = this.comp = new Int32Array(W * H), st = [];
      let id = 0;
      for (let k = 0; k < C.length; k++) {
        if (C[k] || this.cost[k] <= 0) continue;
        C[k] = ++id; st.push(k);
        while (st.length) {
          const c = st.pop(), ci = c % W, cj = (c - ci) / W;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const ni = ci + di, nj = cj + dj;
            if ((!di && !dj) || ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
            const nk = nj * W + ni;
            if (C[nk] || !this.step(c, nk)) continue;
            C[nk] = id; st.push(nk);
          }
        }
      }
      return C;
    }
    componentAt(x, y) { const k = this.idx(x, y); return k < 0 ? 0 : this.components()[k]; }
    reachable(ax, ay, bx, by) { const a = this.componentAt(ax, ay); return a > 0 && a === this.componentAt(bx, by); }
    // the open ground nearest (tx, ty) that can be walked to from (fx, fy); null if none in range
    nearestReachable(fx, fy, tx, ty, maxCells) {
      const comp = this.componentAt(fx, fy); if (!comp) return null;
      const C = this.components(), W = this.W, H = this.H, cs = this.cell;
      const ti = Math.floor(tx / cs), tj = Math.floor(ty / cs);
      const t = this.idx(tx, ty);
      if (t >= 0 && C[t] === comp) return { x: tx, y: ty, exact: true };
      let best = null, bd = Infinity;
      const R = maxCells || Math.max(W, H);
      for (let r = 1; r <= R; r++) {
        if ((r - 1) * cs > bd) break;
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ti + di, j = tj + dj;
          if (i < 0 || j < 0 || i >= W || j >= H || C[j * W + i] !== comp) continue;
          const cx = (i + 0.5) * cs, cy = (j + 0.5) * cs, d = Math.hypot(cx - tx, cy - ty);
          if (d < bd) { bd = d; best = { x: cx, y: cy, exact: false, dist: d }; }
        }
      }
      return best;
    }
    // where a passage opens onto other walkable ground: [{ x, y, inner: {x, y} }]
    entrances(id) {
      const P = this.byId[id], W = this.W, out = [];
      for (const c of P.cells) {
        const ci = c % W, cj = (c - ci) / W;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= this.H) continue;
          const nk = nj * W + ni;
          if (this.pass[nk] === P.index || this.base[nk] <= 0) continue;
          out.push(Object.assign(this.centre(nk), { inner: this.centre(c) }));
        }
      }
      return out;
    }
    /* ---------- routes ---------- */
    /* findPath(ax, ay, bx, by, o) → route or null
     *   o.avoid: [{ x, y, r, penalty }] extra walking cost near dangers (retreats)
     *   o.within: passage id — walk only that passage's cells (plus the two end cells),
     *             so an order to go THROUGH a tunnel cannot be satisfied by going round
     * route: { pts: [[x, y]…], legs: [{ x0, y0, x1, y1, len, cost, e0 }], length, effort,
     *          passages: [ids in the order crossed], from, to } */
    findPath(ax, ay, bx, by, o) {
      o = o || {};
      const a = this.idx(ax, ay), b = this.idx(bx, by);
      if (a < 0 || b < 0 || this.cost[a] <= 0 || this.cost[b] <= 0) return null;
      if (!this.reachable(ax, ay, bx, by)) return null;
      const only = o.within ? this.byId[o.within].index : -1;
      const key = (o.avoid && o.avoid.length) || only >= 0 ? null : a + ':' + b;
      let cells = key && this.cache.get(key);
      if (cells) this.stats.cacheHits++;
      else {
        cells = this.search(a, b, o.avoid, only);
        if (!cells) return null;
        if (key) { if (this.cache.size > 512) this.cache.clear(); this.cache.set(key, cells); }
      }
      const pts = this.smooth(cells, ax, ay, bx, by);
      return this.makeRoute(pts);
    }
    search(a, b, avoid, only) {
      if (only === undefined) only = -1;
      this.stats.searches++;
      const W = this.W, H = this.H, cs = this.cell, cost = this.cost;
      const g = this._g, f = this._f, par = this._par, seen = this._seen, closed = this._closed;
      const s = ++this._stamp;
      const bi = b % W, bj = (b - bi) / W, mc = this.minCost;
      const D2 = (SQRT2 - 1) * mc;
      const h = (i, j) => { const dx = i > bi ? i - bi : bi - i, dy = j > bj ? j - bj : bj - j; return dx > dy ? dx * mc + dy * D2 : dy * mc + dx * D2; };
      const extra = (k) => {
        if (!avoid) return 0;
        const i = k % W, j = (k - i) / W, x = (i + 0.5) * cs, y = (j + 0.5) * cs;
        let e = 0;
        for (const v of avoid) { const d = Math.hypot(x - v.x, y - v.y); if (d < v.r) e += v.penalty * (1 - d / v.r); }
        return e;
      };
      const heap = new Heap();
      const ai = a % W; g[a] = 0; f[a] = h(ai, (a - ai) / W); par[a] = -1; seen[a] = s; heap.push(a, f);
      let n = 0;
      while (heap.size) {
        const c = heap.pop(f);
        if (closed[c] === s) continue;
        closed[c] = s; n++;
        if (c === b) break;
        const ci = c % W, cj = (c - ci) / W;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nk = nj * W + ni;
          if (closed[nk] === s || !this.step(c, nk)) continue;
          if (only >= 0 && nk !== b && this.pass[nk] !== only) continue;
          const ng = g[c] + (di && dj ? SQRT2 : 1) * ((cost[c] + cost[nk]) / 2 + extra(nk));
          if (seen[nk] === s && ng >= g[nk]) continue;
          seen[nk] = s; g[nk] = ng; par[nk] = c; f[nk] = ng + h(ni, nj);
          heap.push(nk, f);
        }
      }
      this.stats.expanded += n;
      if (closed[b] !== s) return null;
      const out = [];
      for (let k = b; k !== -1; k = par[k]) out.push(k);
      return out.reverse();
    }
    // straighten a cell path where the straight line stays on open ground no costlier
    // than the ground it replaces, and never enters or leaves a passage on the way
    smooth(cells, ax, ay, bx, by) {
      const P = cells.map((k) => { const c = this.centre(k); return [c.x, c.y]; });
      P[0] = [ax, ay]; P[P.length - 1] = [bx, by];
      if (P.length <= 2) return P;
      const out = [P[0]];
      let i = 0;
      while (i < P.length - 1) {
        // reach as far ahead as the line stays clear (the costliest ground passed so far is the limit)
        let j = i + 1, worst = Math.max(this.cost[cells[i]], this.cost[cells[i + 1]]);
        while (j + 1 < P.length) {
          const w = Math.max(worst, this.cost[cells[j + 1]]);
          if (!this.clearLine(P[i][0], P[i][1], P[j + 1][0], P[j + 1][1], w, cells, i, j + 1)) break;
          worst = w; j++;
        }
        out.push(P[j]); i = j;
      }
      return out;
    }
    clearLine(x0, y0, x1, y1, maxCost, cells, i, j) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / (this.cell / 3)));
      // the passages (or none, -1) the replaced stretch walks through
      let p0 = -2, p1 = -2;
      for (let k = i; k <= j; k++) { const p = this.pass[cells[k]]; if (p !== p0 && p !== p1) { if (p0 === -2) p0 = p; else if (p1 === -2) p1 = p; else return false; } }
      const W = this.W, H = this.H, inv = 1 / this.cell, cost = this.cost;
      let prev = -1;
      for (let s = 0; s <= n; s++) {
        const ci = Math.floor((x0 + (x1 - x0) * s / n) * inv), cj = Math.floor((y0 + (y1 - y0) * s / n) * inv);
        if (ci < 0 || cj < 0 || ci >= W || cj >= H) return false;
        const k = cj * W + ci;
        if (k === prev) continue;
        const pk = this.pass[k];
        if (cost[k] <= 0 || cost[k] > maxCost + 1e-6 || (pk !== p0 && pk !== p1)) return false;
        if (prev >= 0 && k !== prev && !this.step(prev, k)) return false;
        prev = k;
      }
      return true;
    }
    // cut a polyline into legs of even ground; effort = length × walking cost
    makeRoute(pts) {
      const legs = [], passages = [], step = this.cell / 4;
      let effort = 0, length = 0;
      for (let s = 1; s < pts.length; s++) {
        const [x0, y0] = pts[s - 1], [x1, y1] = pts[s], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / step));
        for (let q = 0; q < n; q++) {
          const t0 = q / n, t1 = (q + 1) / n, mx = x0 + (x1 - x0) * (t0 + t1) / 2, my = y0 + (y1 - y0) * (t0 + t1) / 2;
          const k = this.idx(mx, my), c = k >= 0 && this.cost[k] > 0 ? this.cost[k] : 1;
          const p = k >= 0 && this.pass[k] >= 0 ? this.passages[this.pass[k]].id : null;
          if (p && passages[passages.length - 1] !== p) passages.push(p);
          const sx = x0 + (x1 - x0) * t0, sy = y0 + (y1 - y0) * t0, ex = x0 + (x1 - x0) * t1, ey = y0 + (y1 - y0) * t1, len = d / n;
          const L = legs[legs.length - 1];
          if (L && L.cost === c && L.dx === (x1 - x0) / d && L.dy === (y1 - y0) / d) { L.x1 = ex; L.y1 = ey; L.len += len; }
          else legs.push({ x0: sx, y0: sy, x1: ex, y1: ey, len, cost: c, e0: effort, dx: d ? (x1 - x0) / d : 0, dy: d ? (y1 - y0) / d : 0 });
          effort += len * c; length += len;
        }
      }
      return { pts, legs, length, effort, passages, from: { x: pts[0][0], y: pts[0][1] }, to: { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] } };
    }
    // a point a given effort along a route
    static at(route, e) {
      const L = route.legs;
      if (!L.length || e <= 0) return { x: route.from.x, y: route.from.y, leg: 0 };
      if (e >= route.effort) return { x: route.to.x, y: route.to.y, leg: L.length - 1, done: true };
      let lo = 0, hi = L.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].e0 <= e) lo = m; else hi = m - 1; }
      const l = L[lo], t = Math.min(1, (e - l.e0) / (l.len * l.cost));
      return { x: l.x0 + (l.x1 - l.x0) * t, y: l.y0 + (l.y1 - l.y0) * t, leg: lo };
    }
    // chain routes end to end (a march through a tunnel and out of it)
    static join(a, b) {
      const pts = a.pts.concat(b.pts.slice(1)), off = a.effort;
      const legs = a.legs.concat(b.legs.map((l) => Object.assign({}, l, { e0: l.e0 + off })));
      const passages = a.passages.slice(); for (const p of b.passages) if (passages[passages.length - 1] !== p) passages.push(p);
      return { pts, legs, length: a.length + b.length, effort: a.effort + b.effort, passages, from: a.from, to: b.to };
    }
  }
  AS.Armies.Ground = { GroundMap, KINDS, KIND, at: GroundMap.at, join: GroundMap.join };
})(window.AS);
