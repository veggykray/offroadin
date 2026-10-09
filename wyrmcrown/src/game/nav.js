/* WYRMCROWN — ground navigation.
 * A coarse passability grid (64-unit cells) over the realm: open water is
 * impassable except on bridges and over frozen lakes, roads are cheaper to
 * walk. A* with a binary heap finds routes for warbands and gold carts; routes
 * are smoothed by line-of-sight checks and cached because carts walk the same
 * roads again and again. */
'use strict';
(function (AS) {
  const U = AS.U;
  const CELL = 64;
  const NT = 32;            // a streamed map's walking grid comes in tiles of NT × NT cells (2048 units)
  const LOCAL = 5200;       // routes shorter than this are searched cell by cell; longer ones follow the roads
  const Nav = {
    CELL,
    // the walking cost of one cell (0 = impassable), from the terrain
    cellCost(g, i, j) {
      const T = g.terrain, x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
      let c = 1;
      if (!T.groundPassable(x, y)) {
        // a bridge corridor crossing this cell keeps it open
        let open = false;
        for (const b of T.bridges) if (U.segDist(x, y, b.x0, b.y0, b.x1, b.y1) < CELL * 0.7) { open = true; break; }
        c = open ? 1 : 0;
      } else {
        if (T.roadDist(x, y) < 40) c = 0.55;
        else if (T.gs(T.gMount, x, y) > 0.6) c = 2.2;
        else if (T.gs(T.gForest, x, y) > 0.55) c = 1.4;
      }
      return c;
    },
    build(g) {
      if (g.map.stream) return this.buildStream(g);
      const T = g.terrain, W = Math.ceil(g.map.w / CELL), H = Math.ceil(g.map.h / CELL);
      const cost = new Float32Array(W * H);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
        let c = 1;
        if (!T.groundPassable(x, y)) {
          // a bridge corridor crossing this cell keeps it open
          let open = false;
          for (const b of T.bridges) if (U.segDist(x, y, b.x0, b.y0, b.x1, b.y1) < CELL * 0.7) { open = true; break; }
          c = open ? 1 : 0;
        } else {
          if (T.roadDist(x, y) < 40) c = 0.55;
          else if (T.gs(T.gMount, x, y) > 0.6) c = 2.2;
          else if (T.gs(T.gForest, x, y) > 0.55) c = 1.4;
        }
        cost[j * W + i] = c;
      }
      g.nav = { W, H, cost, cache: new Map() };
    },
    cellOf(g, x, y) { const N = g.nav; return { i: U.clamp(Math.floor(x / CELL), 0, N.W - 1), j: U.clamp(Math.floor(y / CELL), 0, N.H - 1) }; },
    open(g, i, j) { const N = g.nav; return i >= 0 && j >= 0 && i < N.W && j < N.H && (N.stream ? this.costAt(N, i, j) : N.cost[j * N.W + i]) > 0; },
    nearestOpen(g, c) {
      if (this.open(g, c.i, c.j)) return c;
      for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.open(g, c.i + di, c.j + dj)) return { i: c.i + di, j: c.j + dj };
      return c;
    },
    path(g, x0, y0, x1, y1) {
      if (!g.nav) this.build(g);
      const N = g.nav;
      if (N.stream) return this.pathStream(g, x0, y0, x1, y1);
      const a = this.nearestOpen(g, this.cellOf(g, x0, y0)), b = this.nearestOpen(g, this.cellOf(g, x1, y1));
      const key = a.i + ',' + a.j + '>' + b.i + ',' + b.j;
      let cells = N.cache.get(key);
      if (!cells) {
        cells = this.astar(g, a, b);
        N.cache.set(key, cells);
        if (N.cache.size > 400) N.cache.delete(N.cache.keys().next().value);
      }
      const T = g.terrain;
      const pts = cells.map((k) => {
        const x = (k % N.W) * CELL + CELL / 2, y = Math.floor(k / N.W) * CELL + CELL / 2;
        if (T.groundPassable(x, y)) return [x, y];
        // a cell opened by a bridge: walk the deck itself, not the water beside it
        for (const b of T.bridges) if (U.segDist(x, y, b.x0, b.y0, b.x1, b.y1) < CELL * 1.2) {
          const dx = b.x1 - b.x0, dy = b.y1 - b.y0, t = U.clamp(((x - b.x0) * dx + (y - b.y0) * dy) / (dx * dx + dy * dy), 0, 1);
          return [b.x0 + dx * t, b.y0 + dy * t];
        }
        return [x, y];
      });
      pts.push([x1, y1]);
      return this.smooth(g, [[x0, y0]].concat(pts));
    },
    astar(g, a, b) {
      const N = g.nav, W = N.W, H = N.H, n = W * H;
      const gS = this._g && this._g.length === n ? this._g : (this._g = new Float32Array(n));
      const from = this._f && this._f.length === n ? this._f : (this._f = new Int32Array(n));
      const closed = this._c && this._c.length === n ? this._c : (this._c = new Uint8Array(n));
      gS.fill(1e9); from.fill(-1); closed.fill(0);
      const start = a.j * W + a.i, goal = b.j * W + b.i;
      const heap = [], hf = [];
      const push = (k, f) => { heap.push(k); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
      const pop = () => { const top = heap[0]; const lk = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lk; hf[0] = lf; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } } return top; };
      const h = (k) => { const dx = (k % W) - b.i, dy = Math.floor(k / W) - b.j; return Math.hypot(dx, dy) * 0.55; };
      gS[start] = 0; push(start, h(start));
      let iter = 0;
      while (heap.length && iter++ < 60000) {
        const k = pop();
        if (k === goal) break;
        if (closed[k]) continue;
        closed[k] = 1;
        const ci = k % W, cj = Math.floor(k / W);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nk = nj * W + ni, c = N.cost[nk];
          if (c <= 0 || closed[nk]) continue;
          if (di && dj && (N.cost[cj * W + ni] <= 0 || N.cost[nj * W + ci] <= 0)) continue;
          const ng = gS[k] + c * (di && dj ? 1.414 : 1);
          if (ng < gS[nk]) { gS[nk] = ng; from[nk] = k; push(nk, ng + h(nk)); }
        }
      }
      const out = [];
      let k = goal;
      if (from[k] === -1 && k !== start) { const r = [goal]; r.unreachable = true; return r; }
      while (k !== -1 && k !== start) { out.push(k); k = from[k]; }
      return out.reverse();
    },
    // can a walker get from one point to another over land and bridges?
    reachable(g, x0, y0, x1, y1) {
      if (!g.nav) this.build(g);
      const N = g.nav;
      if (N.stream) return !this.pathStream(g, x0, y0, x1, y1).unreachable;
      const a = this.nearestOpen(g, this.cellOf(g, x0, y0)), b = this.nearestOpen(g, this.cellOf(g, x1, y1));
      const key = a.i + ',' + a.j + '>' + b.i + ',' + b.j;
      let cells = N.cache.get(key);
      if (!cells) { cells = this.astar(g, a, b); N.cache.set(key, cells); }
      return !cells.unreachable;
    },
    // drop waypoints that can be skipped with a clear straight line
    smooth(g, pts) {
      if (pts.length < 3) return pts;
      const out = [pts[0]];
      let i = 0;
      while (i < pts.length - 1) {
        let j = Math.min(pts.length - 1, i + 14);
        while (j > i + 1 && !this.clear(g, pts[i], pts[j])) j--;
        out.push(pts[j]); i = j;
      }
      return out;
    },
    clear(g, a, b) {
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 40);
      const N = g.nav;
      let road = 0;
      for (let s = 1; s < n; s++) {
        const t = s / n, x = U.lerp(a[0], b[0], t), y = U.lerp(a[1], b[1], t);
        const c = this.cellOf(g, x, y), v = N.stream ? this.costAt(N, c.i, c.j) : N.cost[c.j * N.W + c.i];
        if (v <= 0 || v > 1.5) return false;
        if (v < 1) road++;
      }
      // the coarse grid opens cells beside bridges: check the real ground finely
      const T = g.terrain, m = Math.ceil(d / 18);
      for (let s = 1; s < m; s++) { const t = s / m; if (!T.groundPassable(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t))) return false; }
      // don't cut corners off roads across country
      return d < 400 || road > n * 0.6 || road === 0;
    },

    /* ================= streamed maps =================
     * The walking grid is built a tile at a time, the first time a route looks there
     * (tiles are small and kept). Short routes are an A* search inside a window
     * round the two ends. Long ones go by road: the map's roads form a graph (nodes
     * every ~256 units, joined where roads meet), searched with A*; the walk from
     * the start onto the road and from the road to the goal is searched cell by cell. */
    buildStream(g) {
      const W = Math.ceil(g.map.w / CELL), H = Math.ceil(g.map.h / CELL);
      g.nav = { stream: true, W, H, tiles: new Map(), cache: new Map(), lt: null, ltk: -1, tilesBuilt: 0, roads: this.roadGraph(g) };
      return g.nav;
    },
    costAt(N, i, j) {
      const ti = (i / NT) | 0, tj = (j / NT) | 0, key = ti * 65536 + tj;
      let t = key === N.ltk ? N.lt : N.tiles.get(key);
      if (!t) {
        t = new Float32Array(NT * NT);
        const g = N.g || AS.game;
        for (let jj = 0; jj < NT; jj++) for (let ii = 0; ii < NT; ii++) {
          const ci = ti * NT + ii, cj = tj * NT + jj;
          t[jj * NT + ii] = ci < N.W && cj < N.H ? this.cellCost(g, ci, cj) : 0;
        }
        N.tiles.set(key, t); N.tilesBuilt++;
      }
      N.lt = t; N.ltk = key;
      return t[(j - tj * NT) * NT + (i - ti * NT)];
    },
    // the road network as a graph
    roadGraph(g) {
      const T = g.terrain, nodes = [], hash = new Map(), STEP = 256, JOIN = 56;
      const key = (x, y) => Math.floor(x / 128) * 65536 + Math.floor(y / 128);
      const find = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const a = hash.get(key(x + dx * 128, y + dy * 128)); if (!a) continue;
          for (const n of a) if (Math.hypot(n.x - x, n.y - y) < JOIN) return n;
        }
        return null;
      };
      const node = (x, y) => {
        let n = find(x, y);
        if (n) return n;
        n = { id: nodes.length, x, y, e: [] }; nodes.push(n);
        const k = key(x, y); let a = hash.get(k); if (!a) { a = []; hash.set(k, a); } a.push(n);
        return n;
      };
      const link = (a, b, L) => { if (a === b) return; if (!a.e.some((q) => q[0] === b)) { a.e.push([b, L]); b.e.push([a, L]); } };
      for (const line of T.roadLines || []) {
        // resample the line every STEP units
        let prev = node(line[0][0], line[0][1]), acc = 0, px = line[0][0], py = line[0][1];
        for (let s = 1; s < line.length; s++) {
          const qx = line[s][0], qy = line[s][1], d = Math.hypot(qx - px, qy - py);
          acc += d; px = qx; py = qy;
          if (acc >= STEP || s === line.length - 1) { const n = node(qx, qy); link(prev, n, acc); prev = n; acc = 0; }
        }
      }
      // components (to answer "is there a road route at all" at once)
      let comp = 0;
      for (const n of nodes) {
        if (n.c !== undefined) continue;
        const st = [n]; n.c = comp;
        while (st.length) { const q = st.pop(); for (const [m] of q.e) if (m.c === undefined) { m.c = comp; st.push(m); } }
        comp++;
      }
      // a coarse grid of the nodes, for "nearest road"
      const grid = new Map();
      for (const n of nodes) { const k = Math.floor(n.x / 1024) * 65536 + Math.floor(n.y / 1024); let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(n); }
      return { nodes, grid };
    },
    nearRoad(N, x, y, R, out) {
      out.length = 0;
      const G = N.roads.grid, r = Math.ceil(R / 1024), cx = Math.floor(x / 1024), cy = Math.floor(y / 1024);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const a = G.get((cx + dx) * 65536 + cy + dy); if (!a) continue;
        for (const n of a) { const d = Math.hypot(n.x - x, n.y - y); if (d < R) out.push([n, d]); }
      }
      out.sort((a, b) => a[1] - b[1]);
      return out;
    },
    // A* over the road graph from any of the start nodes to any of the goal nodes
    roadRoute(N, starts, goals, gx, gy) {
      const best = new Map(), from = new Map(), open = [], goalSet = new Map();
      for (const [n, d] of goals) goalSet.set(n, d);
      const h = (n) => Math.hypot(n.x - gx, n.y - gy) * 0.55;
      const push = (n, f) => { open.push([f, n]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
      const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top[1]; };
      for (const [n, d] of starts) { const c = d * 1.6; if (!best.has(n) || c < best.get(n)) { best.set(n, c); push(n, c + h(n)); } }
      let end = null, endCost = 1e18, iter = 0;
      while (open.length && iter++ < 200000) {
        const n = pop(), c = best.get(n);
        if (c + h(n) >= endCost) break;
        if (goalSet.has(n)) { const tot = c + goalSet.get(n) * 1.6; if (tot < endCost) { endCost = tot; end = n; } }
        for (const [m, L] of n.e) {
          const nc = c + L * 0.55;
          if (!best.has(m) || nc < best.get(m)) { best.set(m, nc); from.set(m, n); push(m, nc + h(m)); }
        }
      }
      if (!end) return null;
      const out = [];
      for (let n = end; n; n = from.get(n)) out.push(n);
      return out.reverse();
    },
    // A* inside a window of cells round the two ends (m cells of margin)
    astarWin(g, a, b, m) {
      const N = g.nav;
      const i0 = Math.max(0, Math.min(a.i, b.i) - m), i1 = Math.min(N.W - 1, Math.max(a.i, b.i) + m);
      const j0 = Math.max(0, Math.min(a.j, b.j) - m), j1 = Math.min(N.H - 1, Math.max(a.j, b.j) + m);
      const W = i1 - i0 + 1, H = j1 - j0 + 1, n = W * H;
      if (!this._wg || this._wg.length < n) { this._wg = new Float32Array(n); this._wf = new Int32Array(n); this._wc = new Uint8Array(n); this._wcost = new Float32Array(n); }
      const gS = this._wg, from = this._wf, closed = this._wc, cost = this._wcost;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) cost[j * W + i] = this.costAt(N, i0 + i, j0 + j);
      gS.fill(1e9, 0, n); from.fill(-1, 0, n); closed.fill(0, 0, n);
      const start = (a.j - j0) * W + (a.i - i0), goal = (b.j - j0) * W + (b.i - i0);
      const heap = [], hf = [];
      const push = (k, f) => { heap.push(k); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
      const pop = () => { const top = heap[0]; const lk = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lk; hf[0] = lf; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let mm = i; if (l < heap.length && hf[l] < hf[mm]) mm = l; if (r < heap.length && hf[r] < hf[mm]) mm = r; if (mm === i) break; [heap[mm], heap[i]] = [heap[i], heap[mm]]; [hf[mm], hf[i]] = [hf[i], hf[mm]]; i = mm; } } return top; };
      const bi = b.i - i0, bj = b.j - j0;
      const h = (k) => { const dx = (k % W) - bi, dy = Math.floor(k / W) - bj; return Math.hypot(dx, dy) * 0.55; };
      gS[start] = 0; push(start, h(start));
      let iter = 0;
      while (heap.length && iter++ < 60000) {
        const k = pop();
        if (k === goal) break;
        if (closed[k]) continue;
        closed[k] = 1;
        const ci = k % W, cj = Math.floor(k / W);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const nk = nj * W + ni, c = cost[nk];
          if (c <= 0 || closed[nk]) continue;
          if (di && dj && (cost[cj * W + ni] <= 0 || cost[nj * W + ci] <= 0)) continue;
          const ng = gS[k] + c * (di && dj ? 1.414 : 1);
          if (ng < gS[nk]) { gS[nk] = ng; from[nk] = k; push(nk, ng + h(nk)); }
        }
      }
      if (from[goal] === -1 && goal !== start) return null;
      const out = [];
      for (let k = goal; k !== -1 && k !== start; k = from[k]) out.push(k);
      out.reverse();
      return out.map((k) => [(i0 + (k % W)) * CELL + CELL / 2, (j0 + Math.floor(k / W)) * CELL + CELL / 2]);
    },
    // cell-by-cell route between two points (or null), smoothed, ending exactly at (x1, y1)
    localRoute(g, x0, y0, x1, y1, margin) {
      const a = this.nearestOpen(g, this.cellOf(g, x0, y0)), b = this.nearestOpen(g, this.cellOf(g, x1, y1));
      const cells = this.astarWin(g, a, b, margin || 24);
      if (!cells) return null;
      const T = g.terrain;
      const pts = cells.map((q) => {
        if (T.groundPassable(q[0], q[1])) return q;
        for (const br of T.bridges) if (U.segDist(q[0], q[1], br.x0, br.y0, br.x1, br.y1) < CELL * 1.2) {
          const dx = br.x1 - br.x0, dy = br.y1 - br.y0, t = U.clamp(((q[0] - br.x0) * dx + (q[1] - br.y0) * dy) / (dx * dx + dy * dy), 0, 1);
          return [br.x0 + dx * t, br.y0 + dy * t];
        }
        return q;
      });
      pts.push([x1, y1]);
      return this.smooth(g, [[x0, y0]].concat(pts));
    },
    pathStream(g, x0, y0, x1, y1) {
      const N = g.nav; N.g = g;
      const ck = Math.round(x0 / 256) + ',' + Math.round(y0 / 256) + '>' + Math.round(x1 / 256) + ',' + Math.round(y1 / 256);
      const hit = N.cache.get(ck);
      if (hit) return hit;
      const keep = (r) => { N.cache.set(ck, r); if (N.cache.size > 300) N.cache.delete(N.cache.keys().next().value); return r; };
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d < LOCAL) { const r = this.localRoute(g, x0, y0, x1, y1, 24); if (r) return keep(r); }
      // by road: onto the network near the start, along it, and off near the goal
      // (a place far off the roads — a cave, a landmark in the wilds — is reached from the
      // nearest road further away)
      const near = (x, y) => { let r = this.nearRoad(N, x, y, 3500, []); if (!r.length) r = this.nearRoad(N, x, y, 8000, []); return r.slice(0, 24); };
      const S = near(x0, y0), G = near(x1, y1);
      const comps = new Set(S.map(([n]) => n.c)), Gc = G.filter(([n]) => comps.has(n.c));
      // (the walk onto or off the road is searched in a window, widened if need be; a road end
      // that cannot be walked to — across a river with no bridge — is dropped and another tried)
      const walk = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay); return this.localRoute(g, ax, ay, bx, by, L > 3500 ? 40 : 20) || this.localRoute(g, ax, ay, bx, by, 48); };
      let Ss = S, Gs = Gc;
      for (let tries = 0; tries < 3 && Ss.length && Gs.length; tries++) {
        const route = this.roadRoute(N, Ss, Gs, x1, y1);
        if (!route) break;
        const a = route[0], z = route[route.length - 1];
        const head = Math.hypot(a.x - x0, a.y - y0) < 90 ? [[x0, y0]] : walk(x0, y0, a.x, a.y);
        const tail = Math.hypot(z.x - x1, z.y - y1) < 90 ? [[z.x, z.y], [x1, y1]] : head && walk(z.x, z.y, x1, y1);
        if (head && tail) {
          const mid = route.map((n) => [n.x, n.y]);
          return keep(head.concat(mid.slice(1, -1), tail));
        }
        if (!head) Ss = Ss.filter(([n]) => Math.hypot(n.x - a.x, n.y - a.y) > 600);
        else Gs = Gs.filter(([n]) => Math.hypot(n.x - z.x, n.y - z.y) > 600);
      }
      // no road between them: a wider search for routes not far beyond the local range
      if (d < LOCAL * 2.2) { const r = this.localRoute(g, x0, y0, x1, y1, 40); if (r) return keep(r); }
      const r = [[x1, y1]]; r.unreachable = true;
      return keep(r);
    },
  };
  AS.Nav = Nav;
})(window.AS);
