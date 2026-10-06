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
  const Nav = {
    build(g) {
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
    open(g, i, j) { const N = g.nav; return i >= 0 && j >= 0 && i < N.W && j < N.H && N.cost[j * N.W + i] > 0; },
    nearestOpen(g, c) {
      if (this.open(g, c.i, c.j)) return c;
      for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.open(g, c.i + di, c.j + dj)) return { i: c.i + di, j: c.j + dj };
      return c;
    },
    path(g, x0, y0, x1, y1) {
      if (!g.nav) this.build(g);
      const N = g.nav;
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
        const c = this.cellOf(g, x, y), v = N.cost[c.j * N.W + c.i];
        if (v <= 0 || v > 1.5) return false;
        if (v < 1) road++;
      }
      // the coarse grid opens cells beside bridges: check the real ground finely
      const T = g.terrain, m = Math.ceil(d / 18);
      for (let s = 1; s < m; s++) { const t = s / m; if (!T.groundPassable(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t))) return false; }
      // don't cut corners off roads across country
      return d < 400 || road > n * 0.6 || road === 0;
    },
  };
  AS.Nav = Nav;
})(window.AS);
