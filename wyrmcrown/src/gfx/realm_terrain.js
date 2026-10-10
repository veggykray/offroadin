/* WYRMCROWN — the realm terrain.
 * A subclass of the ALIEN STRIKE terrain (alien-strike/src/gfx/terrain.js): the
 * chunk rasteriser, terraced cliffs, cast shadows, decal baking and tactical-map
 * builder are all inherited. What changes is the field itself: instead of one
 * world type, a map is authored as four faction regions (blended with warped,
 * soft Voronoi borders) plus neutral heartland, with hand-laid rivers, lakes,
 * mountain ridges, forests and roads. Everything authored is rasterised once
 * into coarse lookup grids so per-texel queries stay cheap. Trees, rocks and
 * undergrowth are stamped into chunks per biome (models_nature.js). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C;
  const CH = AS.Terrain.CH;
  const BIOMES = ['human', 'elf', 'ice', 'undead', 'neutral'];
  const GC = 32; // lookup grid cell (world units)
  // a streamed map (map.stream: one far larger than a battle map) keeps its lookup grids
  // in tiles of TS × TS cells (2048 units), built the first time something looks there
  // and dropped again when not used (least recently used first)
  const TS = 64, TN = TS + 1;
  const IS_WORKER = typeof document === 'undefined';
  const NONE = [];

  // per-biome ground colour by terrace level (0 = lowest) and accents
  const LOOK = {
    human: { ramp: ['#58702f', '#6b8638', '#7e9a44', '#8e9a5a', '#9b9686'], alt: '#9aa04e', speck: '#c8b04a', floor: '#3e5224' },
    elf: { ramp: ['#335a2a', '#3f6c31', '#4b7c38', '#5f8a4a', '#8a9488'], alt: '#5e8a3a', speck: '#a8f0c8', floor: '#24401f' },
    ice: { ramp: ['#c9d6e2', '#d8e3ee', '#e4edf5', '#eef4fa', '#f6f9fc'], alt: '#b8c8d8', speck: '#ffffff', floor: '#a8b8c6' },
    undead: { ramp: ['#3f3a35', '#4a443d', '#55504a', '#5f5a56', '#6a6668'], alt: '#4a3f48', speck: '#8aff6a', floor: '#2c2a28' },
    neutral: { ramp: ['#66783a', '#7a8a46', '#8f9650', '#9c9a64', '#a09a88'], alt: '#a89a5a', speck: '#e8d070', floor: '#46542a' },
  };
  const LOOK_RGB = {};
  for (const k of BIOMES) {
    const L = LOOK[k];
    LOOK_RGB[k] = { ramp: L.ramp.map((c) => C.hex(c)), alt: C.hex(L.alt), speck: C.hex(L.speck), floor: C.hex(L.floor) };
  }
  // cliff faces per biome: [face, faceDark, lip]
  const FACE = {
    human: [C.hex('#8a7460'), C.hex('#3a2c22'), C.hex('#d8d098')],
    elf: [C.hex('#6e7462'), C.hex('#262c22'), C.hex('#a8d890')],
    ice: [C.hex('#8aa0b8'), C.hex('#34465e'), C.hex('#ffffff')],
    undead: [C.hex('#4e4650'), C.hex('#18141c'), C.hex('#8a8090')],
    neutral: [C.hex('#857260'), C.hex('#352a20'), C.hex('#e0d4a0')],
  };

  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    return qx * qx + qy * qy;
  }
  // Catmull-Rom resample of an authored polyline so rivers and ridges curve
  function smoothLine(pts, step) {
    if (pts.length < 3) return pts.slice();
    const out = [];
    const P = (i) => pts[U.clamp(i, 0, pts.length - 1)];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const w = p1.length > 2 ? U.lerp(p1[2], p2[2] !== undefined ? p2[2] : p1[2], t) : undefined;
        out.push(w !== undefined ? [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), w] : [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  class RealmTerrain extends AS.Terrain {
    constructor(world, map) {
      // the base constructor flattens zones via field(), which needs the grids:
      // build them first from the map, then run the base constructor body
      // (a streamed map skips the base's whole-map kind grid: its kinds live in the tiles)
      super(world, Object.assign({}, map, { zones: [] }, map.stream ? { w: 64, h: 64 } : null));
      if (map.stream) { this.W = map.w; this.H = map.h; this.typeGrid = null; }
      this.map = map;
      this.biomeNames = BIOMES;
      this.buildGrids(map);
      this.zones = (map.zones || []).map((z) => Object.assign({ r: 120, h: null, soft: 1.5 }, z));
      // (a streamed map levels each zone the first time the ground there is shaded: see field)
      if (!map.stream) for (const z of this.zones) this.zoneLevel(z);
      this.bridges = []; // [{x0,y0,x1,y1,w}] corridors that make water passable
      this.sseq = 0;     // static decals are numbered (see store / the terrain worker)
    }

    /* ---------- background shading: a pool of workers builds whole chunks ----------
     * terrain_worker.js runs the per-texel passes, stamps the decor and paints the
     * static decals, and hands back an ImageBitmap; the page only stores it. A chunk
     * the camera needs before a worker delivers it gets a stand-in (standIn) — the
     * page never shades a full chunk during play. Without workers (file://, old
     * browsers) the engine's own incremental path runs unchanged. */
    asyncInit() {
      if (this._wk !== undefined) return !!this._wk;
      this._wk = null;
      try {
        if (typeof Worker === 'undefined' || location.protocol === 'file:' || !this._args) return false;
        const n = Math.max(1, Math.min(3, ((navigator.hardwareConcurrency || 4) - 2) | 0));
        const url = new URL('src/gfx/terrain_worker.js', location.href).href;
        // static decals known so far go with the start-up message (each numbered, so the
        // page can tell which ones a delivered chunk already carries); later ones follow
        const sd = new Set(); for (const list of this.sdecals.values()) for (const d of list) sd.add(d);
        for (const d of sd) if (!d.seq) d.seq = ++this.sseq;
        // the lookup grids go along (copied), so the workers do not spend seconds rebuilding
        // them; so do the footprints kept free of trees (buildings, landmarks, scenery)
        // (a streamed map sends none: each worker builds the tiles it needs from the features)
        const grids = this.gtiles ? null : { gw: this.gw, gh: this.gh, gWater: this.gWater, gMount: this.gMount, gForest: this.gForest, gBiome: this.gBiome, gRoad: this.gRoad, gField: this.gField, rivers: this.rivers, ridges: this.ridges, roadLines: this.roadLines };
        this._sentClear = this.clearAreas.length;
        const init = { type: 'init', world: this._args.world, map: this._args.map, zones: this.zones, bridges: this.bridges, sdecals: [...sd], forgeRes: AS.Forge.res, grids, clearAreas: this.clearAreas, clearSegs: this.clearSegs };
        const pool = [];
        for (let i = 0; i < n; i++) {
          const w = new Worker(url);
          w.onmessage = (e) => this.onWorker(e.data, w);
          w.onerror = () => { this._wk = null; };
          w.postMessage(init);
          w.busy = 0;
          pool.push(w);
        }
        // one realm renders at a time (the attract-mode war or the match): retire the previous pool
        if (AS.__terrainPool && AS.__terrainPool.owner !== this) { for (const x of AS.__terrainPool.pool) x.terminate(); AS.__terrainPool.owner._wk = null; }
        AS.__terrainPool = { owner: this, pool };
        this._wk = pool; this._req = new Map(); this._ready = []; this._fin = null;
        return true;
      } catch (e) { this._wk = null; return false; }
    }
    onWorker(r, w) {
      if (r.type === 'ready') { w.ready = r.ms; return; }
      if (r.type === 'tile') { this.tileArrived(r, w); return; }
      if (r.type === 'kinds') { this.wkKinds = new Set(r.kinds); return; }
      w.busy--;
      if (r.far) {
        const F = this.far, key = r.cx * 10000 + r.cy;
        if (!F) { if (r.bmp) r.bmp.close(); return; }
        F.req.delete(key);
        if (r.TD !== F.TD || F.cache.has(key)) { if (r.bmp) r.bmp.close(); return; }
        F.cache.set(key, { cv: r.bmp, used: this.frame || 0 }); F.stub.delete(key);
        if (F.cache.size > Math.max(F.max, F.need || 0)) this.farEvict();
        return;
      }
      if (!this._req) { if (r.bmp) r.bmp.close(); return; }
      const key = r.cx * 10000 + r.cy;
      this._req.delete(key);
      if (r.TD !== this.TD || this.cache.has(key)) { if (r.bmp) r.bmp.close(); return; }
      this._ready.push(r);
    }
    // a finished chunk from a worker: stored as it is (decals newer than it are painted on)
    finish(r) {
      const key = r.cx * 10000 + r.cy;
      if (this._quick) this._quick.delete(key);
      if (this._old) { const o = this._old.get(key); if (o) { if (o.cv.close) o.cv.close(); this._old.delete(key); } }
      this.store(key, r.cx, r.cy, r.bmp, r.sseq);
      return this.cache.get(key).cv;
    }
    addDecal(kind, x, y, r, col, opts) {
      const d = super.addDecal(kind, x, y, r, col, opts);
      if (d.static) { d.seq = ++this.sseq; if (this._wk) for (const w of this._wk) w.postMessage({ type: 'sdecal', d }); }
      return d;
    }
    getChunk(cx, cy) {
      if (!this._wk || this.syncOK) return super.getChunk(cx, cy);
      if (this.farMode) return this.farChunk(cx, cy);
      this.texel();
      const key = cx * 10000 + cy, ch = this.cache.get(key);
      if (ch) { ch.used = this.frame; return ch.cv; }
      // a needed chunk a worker has already finished is simply stored
      const i = this._ready.findIndex((q) => q.cx === cx && q.cy === cy);
      if (i >= 0) return this.finish(this._ready.splice(i, 1)[0]);
      // Not delivered yet (the camera outran the workers, or the render scale just
      // changed): never shade it here — a full chunk costs 100–300 ms of main thread.
      // Draw a stand-in until the worker's chunk arrives (it is first in the queue):
      // the same chunk at the previous scale if there is one, else the ground alone at
      // low detail (~5–10 ms, at most about one a frame), else the war map's pixels.
      const old = this._old && this._old.get(key);
      if (old) return old.cv;
      return this.standIn(cx, cy, key);
    }
    standIn(cx, cy, key) {
      // after high flight the far layer usually has this chunk already: far better than a quick build
      if (this.far) { const f = this.far.cache.get(key); if (f) { f.used = this.frame; return f.cv; } }
      const Q = this._quick || (this._quick = new Map());
      let q = Q.get(key);
      if (q && q.fine) return q.cv;
      if (this._qFrame !== this.frame) { this._qFrame = this.frame; this._qMs = 0; }
      if (this._qMs < 6) {
        const t0 = performance.now();
        q = { cv: this.quickChunk(cx, cy), fine: true };
        this._qMs += performance.now() - t0;
        this.standN = (this.standN || 0) + 1;
      } else if (!q) {
        const M = this.overview, sc = M ? this.W / M.width : 1, cv = AS.Forge.canvas(16, 16), c = cv.getContext('2d');
        if (M) { c.imageSmoothingEnabled = true; c.drawImage(M, (cx * CH) / sc, (cy * CH) / sc, CH / sc, CH / sc, 0, 0, 16, 16); } else { c.fillStyle = '#5a6a3a'; c.fillRect(0, 0, 16, 16); }
        q = { cv, fine: false };
        this.standN = (this.standN || 0) + 1;
      } else return q.cv;
      Q.set(key, q);
      if (Q.size > 96) Q.delete(Q.keys().next().value);
      return q.cv;
    }
    // the ground of a chunk (no decor, no decals) at a low, fixed texel density
    quickChunk(cx, cy) {
      const TD0 = this.TD, td = 0.375;
      if (!this._qst) { const keep = this._bufs; this._bufs = null; this.TD = td; this._qst = this.bufs(0); this._bufs = keep; this.TD = TD0; }
      const st = this._qst, N = st.N;
      st.cx = cx; st.cy = cy; st.x0 = cx * CH; st.y0 = cy * CH;
      this._grid(st, 0, st.gh);
      this._up(st, 0, st.rows);
      const cv = AS.Forge.canvas(N, N), ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
      st.D = img.data; st.cnt.fill(0); st.dropL.fill(-9); st.faceH.fill(0); st.faceNX.fill(0);
      this._shade(st, 1, st.rows);
      st.D = null;
      ctx.putImageData(img, 0, 0);
      return cv;
    }
    work(budget, queue) {
      if (!this.asyncInit()) return super.work(budget, queue);
      this.texel();
      if (this.farMode) { this.farWork(queue); return; } // high flight: the far layer is what is drawn
      // the worker pool keeps a few requests in flight, nearest first; then any
      // places the camera may jump to (warmAt) get shaded in the background
      const pool = this._wk;
      if (this.clearAreas.length > this._sentClear) { const a = this.clearAreas.slice(this._sentClear); this._sentClear = this.clearAreas.length; for (const w of pool) w.postMessage({ type: 'clear', a }); }
      if (this._old && ((this.frame || 0) - this._oldF > 900 || !this._old.size)) { for (const e of this._old.values()) if (e.cv.close) e.cv.close(); this._old = null; }
      if (this._pre) { this._pre = this._pre.filter((q) => !this.cache.has(q[0] * 10000 + q[1])); if (this._pre.length) queue = queue.concat(this._pre); else this._pre = null; }
      for (const q of queue) {
        const key = q[0] * 10000 + q[1];
        if (this.cache.has(key) || this._req.has(key) || this._ready.some((r) => r.cx === q[0] && r.cy === q[1])) continue;
        let w = null; for (const x of pool) if (x.busy < 2 && (!w || x.busy < w.busy)) w = x;
        if (!w) break;
        w.busy++; this._req.set(key, 1);
        w.postMessage({ type: 'chunk', cx: q[0], cy: q[1], TD: this.TD, forgeRes: AS.Forge.res });
      }
      // store finished chunks (cheap: decals newer than the worker's copy are the only painting)
      const t0 = performance.now();
      while (this._ready.length && performance.now() - t0 < budget) {
        const r = this._ready.shift();
        if (r.TD === this.TD && !this.cache.has(r.cx * 10000 + r.cy)) this.finish(r);
        else if (r.bmp) r.bmp.close();
      }
    }
    /* shade, ahead of time, the chunks a view of w × h around each point would show —
     * where a jump of the camera (waygate travel, respawning at the roost) lands */
    warmAt(pts, w, h) {
      if (!this._wk) return;
      const out = [], seen = new Set();
      for (const p of pts) {
        for (let cy = Math.floor((p.y - h / 2 - 64) / CH); cy <= Math.floor((p.y + h / 2 + 64) / CH); cy++)
          for (let cx = Math.floor((p.x - w / 2 - 64) / CH); cx <= Math.floor((p.x + w / 2 + 64) / CH); cx++) {
            const k = cx * 10000 + cy; if (seen.has(k) || this.cache.has(k)) continue; seen.add(k); out.push([cx, cy]);
          }
      }
      this._pre = out.length ? out : null;
    }
    get async() { return !!this._wk; }

    /* ---------- the far layer: terrain for high flight ----------
     * Zoomed far out, full-detail chunks would cost several times the memory and
     * the workers' time for detail nobody can see. The far layer is the same
     * terrain shaded by the same workers at a low texel density (FAR_TD, about a
     * seventh of the texels at full resolution) in a cache of its own; while a far
     * chunk is on its way, a full-detail one (if cached) or the war map stands in.
     * The near layer is untouched, so dropping back down costs nothing. */
    setFar(on) {
      on = !!(on && this._wk);
      if (on && !this.far) this.far = { TD: 0.9, cache: new Map(), req: new Map(), stub: new Map(), max: 260, need: 0 };
      this.farMode = on;
    }
    hasChunk(cx, cy) { return this.farMode ? this.far.cache.has(cx * 10000 + cy) : this.cache.has(cx * 10000 + cy); }
    farChunk(cx, cy) {
      const F = this.far, key = cx * 10000 + cy, e = F.cache.get(key);
      if (e) { e.used = this.frame; return e.cv; }
      const near = this.cache.get(key);
      if (near) { near.used = this.frame; return near.cv; }
      let s = F.stub.get(key);
      if (!s) {
        const M = this.overview, sc = M ? this.W / M.width : 1;
        s = AS.Forge.canvas(16, 16); const c = s.getContext('2d');
        if (M) { c.imageSmoothingEnabled = true; c.drawImage(M, (cx * CH) / sc, (cy * CH) / sc, CH / sc, CH / sc, 0, 0, 16, 16); } else { c.fillStyle = '#5a6a3a'; c.fillRect(0, 0, 16, 16); }
        F.stub.set(key, s);
        if (F.stub.size > 600) F.stub.delete(F.stub.keys().next().value);
      }
      return s;
    }
    farEvict() {
      const F = this.far;
      while (F.cache.size > Math.max(F.max, F.need || 0)) {
        let ok = null, oldest = Infinity;
        for (const [k, v] of F.cache) if (v.used < oldest) { oldest = v.used; ok = k; }
        if (ok === null) break;
        const v = F.cache.get(ok); if (v.cv && v.cv.close) v.cv.close(); F.cache.delete(ok);
      }
    }
    farWork(queue) {
      const F = this.far, pool = this._wk;
      for (const q of queue) {
        const key = q[0] * 10000 + q[1];
        if (F.cache.has(key) || F.req.has(key)) continue;
        let w = null; for (const x of pool) if (x.busy < 3 && (!w || x.busy < w.busy)) w = x;
        if (!w) break;
        w.busy++; F.req.set(key, 1);
        w.postMessage({ type: 'chunk', cx: q[0], cy: q[1], TD: F.TD, far: true, forgeRes: AS.Forge.res });
      }
    }
    texel() {
      const R = AS.Renderer, want = R && !R.pixelated && R.res ? R.res : 1;
      if (this._wk && want !== this.TD && this.cache.size) {
        // the render scale changed: keep the chunks shaded at the old scale and draw
        // them (stretched) until the workers deliver the new ones — rebuilding the whole
        // view at once on the main thread used to freeze the game for seconds
        if (this._old) for (const e of this._old.values()) if (e.cv.close) e.cv.close();
        this._old = this.cache; this.cache = new Map(); this._oldF = this.frame || 0;
      }
      const before = this.TD, td = super.texel();
      if (td !== before) {
        if (this._ready) { for (const r of this._ready) if (r.bmp) r.bmp.close(); this._ready.length = 0; }
        // keep the view, its prefetch ring and a margin cached (about 120 MB of chunk canvases)
        const px = Math.round(CH * td) * Math.round(CH * td) * 4;
        this.maxCache = Math.max(56, Math.min(150, Math.round(120e6 / px)));
      }
      return td;
    }

    /* ---------- authored geography → lookup grids ---------- */
    // the authored features, resampled (shared by the whole-map grids and the streamed tiles)
    features(map) {
      const rivers = (map.rivers || []).map((r) => ({ w: r.w || 60, pts: smoothLine(r.pts.map((p) => [p[0], p[1], p[2] !== undefined ? p[2] : (r.w || 60)]), 60) }));
      this.rivers = rivers;
      const ridges = (map.mountains || []).map((m) => ({ w: m.w || 420, hgt: m.h || 1, pts: smoothLine(m.pts, 90) }));
      this.ridges = ridges;
      const roads = (map.roads || []).map((r) => smoothLine(r.pts || r, 70));
      this.roadLines = roads;
      return { rivers, ridges, lakes: map.lakes || [], islands: map.islands || [], roads, regions: map.regions || [], forests: map.forests || [], fields: map.fields || [], clear: map.clearings || [], tints: map.tints || [], flora: map.flora || [], riversCut: !!map.riversCut };
    }
    buildGrids(map) {
      const Fe = this.features(map);
      if (map.stream) return this.streamInit(Fe);
      const gw = this.gw = Math.ceil(this.W / GC) + 2, gh = this.gh = Math.ceil(this.H / GC) + 2, N = gw * gh;
      this.gWater = new Float32Array(N);   // signed distance to open water (negative = water)
      this.gMount = new Float32Array(N);   // mountain uplift 0..1
      this.gForest = new Float32Array(N);  // forest density 0..1
      this.gBiome = new Float32Array(N * 5); // soft region weights
      this.gRoad = new Float32Array(N);    // distance to the nearest road centre line
      this.gField = new Uint8Array(N);     // farmland / no-tree mask
      const tmpW = new Float32Array(5);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) this.cellInto(Fe, (i - 1) * GC + GC / 2, (j - 1) * GC + GC / 2, j * gw + i, this, tmpW);
    }
    // one lookup cell at (x, y) → index k of the arrays in A
    cellInto(Fe, x, y, k, A, tmpW) {
      const sd = this.seed;
      const { rivers, ridges, lakes, islands, roads, regions, forests, fields, clear } = Fe;
      // water: rivers (variable width) and lakes, with a wobbly shoreline
      let wd = 1e9;
      if (Fe.pre) wd = Fe.pre.riv[k]; // (a streamed tile: river distances stamped beforehand)
      else for (const r of rivers) {
        const p = r.pts;
        for (let s = 0; s < p.length - 1; s++) {
          const a = p[s], b = p[s + 1];
          if (Math.abs(x - a[0]) > 900 && Math.abs(x - b[0]) > 900) continue;
          if (Math.abs(y - a[1]) > 900 && Math.abs(y - b[1]) > 900) continue;
          const d = Math.sqrt(segDist2(x, y, a[0], a[1], b[0], b[1])) - (a[2] + b[2]) * 0.25;
          if (d < wd) wd = d;
        }
      }
      const riverD = wd;
      for (const l of lakes) {
        if (l.after) continue; // (an inland lake on an island: applied after the islands below)
        { const hx = (x - l.x) / (l.sx || 1), hy = (y - l.y) / (l.sy || 1); if (Math.sqrt(hx * hx + hy * hy) - l.r * 1.17 >= wd) continue; }
        const ang = Math.atan2(y - l.y, x - l.x);
        const rr = l.r * (1 + 0.16 * U.noise2(Math.cos(ang) * 1.6 + l.x * 0.001, Math.sin(ang) * 1.6 + l.y * 0.001, sd + 13));
        const dx = (x - l.x) / (l.sx || 1), dy = (y - l.y) / (l.sy || 1);
        const d = Math.hypot(dx, dy) - rr;
        if (d < wd) wd = d;
      }
      // islands: land that rises out of a lake or sea (land wins inside them)
      // (a streamed map reads the sea as no deeper than 800 below the shore: deeper water
      // looks and behaves the same, and far islands can then be skipped)
      if (Fe.shallow && wd < -800) wd = -800;
      for (const l of islands) {
        // an island whose largest possible reach is below the value so far cannot raise it
        // (the shoreline noise stays within ±1.05)
        const sx = l.sx || 1, sy = l.sy || 1, hx = (x - l.x) / sx, hy = (y - l.y) / sy;
        if (l.r * 1.21 - Math.sqrt(hx * hx + hy * hy) <= wd) continue;
        const ang = Math.atan2(y - l.y, x - l.x);
        const rr = l.r * (1 + 0.2 * U.noise2(Math.cos(ang) * 1.8 + l.x * 0.001, Math.sin(ang) * 1.8 + l.y * 0.001, sd + 19));
        const d = rr - Math.hypot((x - l.x) / (l.sx || 1), (y - l.y) / (l.sy || 1));
        wd = Math.max(wd, d);
      }
      for (const l of lakes) {
        if (!l.after) continue;
        { const hx = (x - l.x) / (l.sx || 1), hy = (y - l.y) / (l.sy || 1); if (Math.sqrt(hx * hx + hy * hy) - l.r * 1.17 >= wd) continue; }
        const ang = Math.atan2(y - l.y, x - l.x);
        const rr = l.r * (1 + 0.16 * U.noise2(Math.cos(ang) * 1.6 + l.x * 0.001, Math.sin(ang) * 1.6 + l.y * 0.001, sd + 13));
        const d = Math.hypot((x - l.x) / (l.sx || 1), (y - l.y) / (l.sy || 1)) - rr;
        if (d < wd) wd = d;
      }
      // (map.riversCut: rivers run on through the islands' land, as a map built of islands means them to)
      if (Fe.riversCut && riverD < wd) wd = riverD;
      wd += U.noise2(x / 140, y / 140, sd + 17) * 14;
      A.gWater[k] = wd;
      // mountains: ridged uplift along authored ridge lines
      let mt = 0;
      for (const m of ridges) {
        const p = m.pts;
        for (let s = 0; s < p.length - 1; s++) {
          const a = p[s], b = p[s + 1];
          const d2 = segDist2(x, y, a[0], a[1], b[0], b[1]);
          if (d2 > m.w * m.w * 2.2) continue;
          const t = 1 - Math.sqrt(d2) / (m.w * 1.4);
          if (t > 0) mt = Math.max(mt, U.smooth(Math.min(1, t)) * m.hgt);
        }
      }
      if (mt > 0) mt *= 0.65 + 0.55 * U.ridged(x / 520, y / 520, 3, sd + 23);
      A.gMount[k] = Math.min(1.3, mt);
      // regions: weighted Voronoi with warped distances and a soft-max blend
      const wx = x + U.noise2(x / 1700, y / 1700, sd + 31) * 520, wy = y + U.noise2(x / 1700 + 7.7, y / 1700, sd + 32) * 520;
      tmpW.fill(0);
      let tot = 0;
      if (regions.length) {
        let best = 1e9;
        const sc = [];
        for (const r of regions) { const d = Math.hypot(wx - r.x, wy - r.y) / (r.r || 2400); sc.push(d); if (d < best) best = d; }
        for (let q = 0; q < regions.length; q++) {
          const e = Math.exp(-(sc[q] - best) * 9);
          tmpW[BIOMES.indexOf(regions[q].biome)] += e; tot += e;
        }
      } else { tmpW[4] = 1; tot = 1; }
      for (let q = 0; q < 5; q++) A.gBiome[k * 5 + q] = tmpW[q] / tot;
      // forests: authored blobs + biome default cover modulated by noise
      let fo = 0;
      for (const f of forests) {
        const d = Math.hypot((x - f.x) / (f.sx || 1), (y - f.y) / (f.sy || 1)) / f.r;
        const edge = 0.75 + U.noise2(x / 260, y / 260, sd + 41) * 0.35;
        if (d < edge) fo = Math.max(fo, (f.d || 1) * U.smoothstep(edge, edge * 0.55, d));
      }
      const cover = { human: 0.12, elf: 0.55, ice: 0.32, undead: 0.28, neutral: 0.14 };
      let base = 0;
      for (let q = 0; q < 5; q++) base += A.gBiome[k * 5 + q] * cover[BIOMES[q]];
      const n = U.fbm(x / 900, y / 900, 3, sd + 43);
      fo = Math.max(fo, U.clamp((n + base - 0.18) * 2.2, 0, 1) * Math.min(1, base * 2.2));
      // glades: sunlit clearings opened in the woods, most of all in the old forest
      const gl = U.fbm(x / 430, y / 430, 2, sd + 44);
      const elfK = A.gBiome[k * 5 + 1];
      const glade = U.smoothstep(0.32 - elfK * 0.12, 0.62, gl);
      fo *= 1 - glade * (0.55 + elfK * 0.4);
      if (mt > 0.55) fo *= U.clamp(1.6 - mt * 1.4, 0, 1); // tree line
      A.gForest[k] = fo;
      // farmland and clearings keep trees out
      let fm = 0;
      for (const f of fields) if (Math.hypot(x - f.x, y - f.y) < f.r) { fm = 1; break; }
      for (const c of clear) if (Math.hypot(x - c.x, y - c.y) < c.r) { fm = 2; break; }
      A.gField[k] = fm;
      // roads
      let rd = 1e9;
      if (Fe.pre) rd = Fe.pre.road[k];
      else for (const p of roads) for (let s = 0; s < p.length - 1; s++) {
        const a = p[s], b = p[s + 1];
        if (Math.abs(x - a[0]) > 300 && Math.abs(x - b[0]) > 300 && Math.sign(x - a[0]) === Math.sign(x - b[0])) continue;
        if (Math.abs(y - a[1]) > 300 && Math.abs(y - b[1]) > 300 && Math.sign(y - a[1]) === Math.sign(y - b[1])) continue;
        const d = Math.sqrt(segDist2(x, y, a[0], a[1], b[0], b[1]));
        if (d < rd) rd = d;
      }
      A.gRoad[k] = rd;
    }
    // a province's own ground colour (a multiplier, faded at its edge) and tree species, for the
    // lookup cells of a gw × gh block whose first cell centre is (x0, y0) — worked out on a coarse
    // lattice (every 8th cell) and blended between, as both change only over kilometres
    tintsInto(Fe, x0, y0, gw, gh, A) {
      if (!A.gTintR) return;
      const sd = this.seed, tints = Fe.tints || [], flora = Fe.flora || [], C = 8;
      const cw = Math.ceil((gw - 1) / C) + 1, ch = Math.ceil((gh - 1) / C) + 1;
      const LR = new Float32Array(cw * ch), LG = new Float32Array(cw * ch), LB = new Float32Array(cw * ch), LF = new Uint8Array(cw * ch);
      for (let cj = 0; cj < ch; cj++) for (let ci = 0; ci < cw; ci++) {
        const x = x0 + ci * C * GC, y = y0 + cj * C * GC, q = cj * cw + ci;
        let mr = 1, mg = 1, mb = 1, fl = 0, fw = 0.45;
        if (tints.length) {
          const wx2 = x + U.noise2(x / 1300, y / 1300, sd + 91) * 700, wy2 = y + U.noise2(x / 1300 + 3.3, y / 1300, sd + 92) * 700;
          for (let i = 0; i < tints.length; i++) {
            const t = tints[i], d = Math.hypot(wx2 - t.x, wy2 - t.y) / t.r;
            if (d >= 1) continue;
            const w = U.smoothstep(1, 0.55, d) * (t.k === undefined ? 1 : t.k);
            mr += (t.col[0] - 1) * w; mg += (t.col[1] - 1) * w; mb += (t.col[2] - 1) * w;
          }
        }
        for (let i = 0; i < flora.length; i++) { const f = flora[i], d = Math.hypot(x - f.x, y - f.y) / f.r; if (d < 1 && 1 - d > fw) { fw = 1 - d; fl = f.kind; } }
        LR[q] = mr; LG[q] = mg; LB[q] = mb; LF[q] = fl;
      }
      for (let j = 0; j < gh; j++) {
        const cj = Math.min(ch - 2, (j / C) | 0), ty = j / C - cj;
        for (let i = 0; i < gw; i++) {
          const ci = Math.min(cw - 2, (i / C) | 0), tx = i / C - ci, q = cj * cw + ci, k = j * gw + i;
          const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
          A.gTintR[k] = LR[q] * w00 + LR[q + 1] * w10 + LR[q + cw] * w01 + LR[q + cw + 1] * w11;
          A.gTintG[k] = LG[q] * w00 + LG[q + 1] * w10 + LG[q + cw] * w01 + LG[q + cw + 1] * w11;
          A.gTintB[k] = LB[q] * w00 + LB[q + 1] * w10 + LB[q + cw] * w01 + LB[q + cw + 1] * w11;
          A.gFlora[k] = LF[q + (tx >= 0.5 ? 1 : 0) + (ty >= 0.5 ? cw : 0)];
        }
      }
    }
    /* ---------- streamed lookup grids (map.stream) ----------
     * The grids are named, not allocated (this.gWater === 'gWater', …): gs / gn /
     * biomeAt look the name up in the tile that holds the cell. A tile carries one
     * extra row and column (its neighbours' first) so bilinear sampling never needs
     * a second tile. Each tile is built from the features near it only; the values
     * agree with a whole-map grid wherever they matter (deep water and far roads
     * and forests read as "far" either way). */
    streamInit(Fe) {
      this.gw = Math.ceil(this.W / GC) + 2; this.gh = Math.ceil(this.H / GC) + 2;
      this.gWater = 'gWater'; this.gMount = 'gMount'; this.gForest = 'gForest'; this.gBiome = 'gBiome'; this.gRoad = 'gRoad'; this.gField = 'gField';
      // provinces with their own ground colour and trees (map.tints, map.flora)
      this.hasTint = !!(Fe.tints.length || Fe.flora.length);
      if (this.hasTint) { this.gTintR = 'gTintR'; this.gTintG = 'gTintG'; this.gTintB = 'gTintB'; this.gFlora = 'gFlora'; }
      this.feat = Fe;
      this.gtiles = new Map(); this.gtMax = IS_WORKER ? 90 : 220; this.gtClock = 0; this.gtBuilt = 0; this.gtMs = 0;
      this._lt = null; this._ltKey = -1;
      // bounding boxes, for picking the features near a tile
      const bbOf = (pts, m) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } return [x0 - m, y0 - m, x1 + m, y1 + m]; };
      this.featBB = {
        // rivers and roads are split into short runs, each with its own box
        rivers: [], roads: [],
        ridges: Fe.ridges.map((r) => bbOf(r.pts, r.w * 1.5)),
        lakes: Fe.lakes.map((l) => [l.x - l.r * 1.3 * (l.sx || 1) - 4000, l.y - l.r * 1.3 * (l.sy || 1) - 4000, l.x + l.r * 1.3 * (l.sx || 1) + 4000, l.y + l.r * 1.3 * (l.sy || 1) + 4000]),
        islands: Fe.islands.map((l) => [l.x - l.r * 1.3 * (l.sx || 1) - 4000, l.y - l.r * 1.3 * (l.sy || 1) - 4000, l.x + l.r * 1.3 * (l.sx || 1) + 4000, l.y + l.r * 1.3 * (l.sy || 1) + 4000]),
        forests: Fe.forests.map((f) => [f.x - f.r * 1.2 * (f.sx || 1), f.y - f.r * 1.2 * (f.sy || 1), f.x + f.r * 1.2 * (f.sx || 1), f.y + f.r * 1.2 * (f.sy || 1)]),
        fields: Fe.fields.map((f) => [f.x - f.r, f.y - f.r, f.x + f.r, f.y + f.r]),
        clear: Fe.clear.map((f) => [f.x - f.r, f.y - f.r, f.x + f.r, f.y + f.r]),
        tints: Fe.tints.map((f) => [f.x - f.r - 720, f.y - f.r - 720, f.x + f.r + 720, f.y + f.r + 720]),
        flora: Fe.flora.map((f) => [f.x - f.r, f.y - f.r, f.x + f.r, f.y + f.r]),
      };
      const runs = (list, out, m, isRiver) => list.forEach((r) => {
        const p = isRiver ? r.pts : r;
        for (let s = 0; s < p.length - 1; s += 12) { const seg = p.slice(s, Math.min(p.length, s + 13)); out.push({ pts: seg, w: r.w, bb: bbOf(seg, m) }); }
      });
      runs(Fe.rivers, this.featBB.rivers, 1000, true);
      runs(Fe.roads, this.featBB.roads, 400, false);
    }
    // the features that can matter for the tile whose world box is [x0, y0, x1, y1]
    tileFeatures(x0, y0, x1, y1) {
      const Fe = this.feat, B = this.featBB;
      const hit = (b) => b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0;
      const pick = (list, bbs) => { const out = []; for (let i = 0; i < list.length; i++) if (hit(bbs[i])) out.push(list[i]); return out; };
      // regions: soft-max weights fall off as exp(-9 Δd); a region more than 1.3 (in units of
      // its radius) behind the nearest is weighed below 1e-5 and can be left out
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = Math.hypot(x1 - x0, y1 - y0) / 2 + 560;
      let bestHi = 1e9;
      const rs = Fe.regions.map((r) => { const d = Math.hypot(cx - r.x, cy - r.y), R = r.r || 2400, lo = Math.max(0, d - half) / R, hi = (d + half) / R; if (hi < bestHi) bestHi = hi; return lo; });
      return {
        rivers: B.rivers.filter((q) => hit(q.bb)).map((q) => ({ w: q.w, pts: q.pts })),
        roads: B.roads.filter((q) => hit(q.bb)).map((q) => q.pts),
        ridges: pick(Fe.ridges, B.ridges), lakes: pick(Fe.lakes, B.lakes), islands: pick(Fe.islands, B.islands),
        regions: Fe.regions.filter((r, i) => rs[i] < bestHi + 1.3),
        forests: pick(Fe.forests, B.forests), fields: pick(Fe.fields, B.fields), clear: pick(Fe.clear, B.clear),
        tints: pick(Fe.tints, B.tints), flora: pick(Fe.flora, B.flora), riversCut: Fe.riversCut,
      };
    }
    tileAt(ti, tj) {
      const key = ti * 65536 + tj;
      if (key === this._ltKey) return this._lt;
      let t = this.gtiles.get(key);
      if (!t) {
        const t0 = performance.now();
        t = this.buildTile(ti, tj);
        this.gtiles.set(key, t);
        this.gtBuilt++; this.gtMs += performance.now() - t0;
        if (this.gtiles.size > this.gtMax) this.evictTiles();
      }
      t.used = ++this.gtClock;
      this._lt = t; this._ltKey = key;
      return t;
    }
    hasTile(ti, tj) { return this.gtiles.has(ti * 65536 + tj); }
    /* ask the terrain workers to build the tiles under a world box (they send the arrays
     * back); a tile that is needed before it arrives is still built here at once */
    requestTiles(x0, y0, x1, y1, fx, fy) {
      if (!this.gtiles || !this._wk) return;
      const S = TS * GC, P = this._tilePend || (this._tilePend = new Map()), now = performance.now();
      // nearest the focus (fx, fy: the dragon) first
      if (fx === undefined) { fx = (x0 + x1) / 2; fy = (y0 + y1) / 2; }
      const want = [];
      for (let tj = Math.max(0, Math.floor(y0 / S)); tj <= Math.floor(y1 / S); tj++) for (let ti = Math.max(0, Math.floor(x0 / S)); ti <= Math.floor(x1 / S); ti++) {
        const key = ti * 65536 + tj;
        if (this.gtiles.has(key) || (P.has(key) && now - P.get(key) < 8000)) continue;
        want.push([Math.hypot((ti + 0.5) * S - fx, (tj + 0.5) * S - fy), ti, tj, key]);
      }
      want.sort((a, b) => a[0] - b[0]);
      for (const [, ti, tj, key] of want) {
        let best = null;
        for (const w of this._wk) if (!best || (w.tiles || 0) < (best.tiles || 0)) best = w;
        if ((best.tiles || 0) >= 4) return; // a few in flight per worker at most
        best.tiles = (best.tiles || 0) + 1;
        P.set(key, now);
        best.postMessage({ type: 'tile', ti, tj });
      }
    }
    tileArrived(r, w) {
      w.tiles = Math.max(0, (w.tiles || 0) - 1);
      const key = r.ti * 65536 + r.tj;
      if (this._tilePend) this._tilePend.delete(key);
      if (!this.gtiles || this.gtiles.has(key)) return;
      this.gtiles.set(key, { gWater: r.gWater, gMount: r.gMount, gForest: r.gForest, gBiome: r.gBiome, gRoad: r.gRoad, gField: r.gField, kind: r.kind, gTintR: r.gTintR, gTintG: r.gTintG, gTintB: r.gTintB, gFlora: r.gFlora, used: ++this.gtClock });
      this.gtFromWorkers = (this.gtFromWorkers || 0) + 1;
      if (this.gtiles.size > this.gtMax) this.evictTiles();
    }
    evictTiles() {
      const all = [...this.gtiles.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < all.length - this.gtMax * 0.8; i++) this.gtiles.delete(all[i][0]);
      this._ltKey = -1; this._lt = null;
    }
    buildTile(ti, tj) {
      const n = TN * TN;
      const A = { gWater: new Float32Array(n), gMount: new Float32Array(n), gForest: new Float32Array(n), gBiome: new Float32Array(n * 5), gRoad: new Float32Array(n), gField: new Uint8Array(n), kind: new Uint8Array(n).fill(255), used: 0 };
      if (this.hasTint) { A.gTintR = new Float32Array(n); A.gTintG = new Float32Array(n); A.gTintB = new Float32Array(n); A.gFlora = new Uint8Array(n); }
      const i0 = ti * TS, j0 = tj * TS;
      const x0 = (i0 - 1) * GC, y0 = (j0 - 1) * GC, x1 = x0 + TN * GC, y1 = y0 + TN * GC;
      const Fe = this.tileFeatures(x0, y0, x1, y1), tmpW = new Float32Array(5);
      Fe.shallow = true;
      // river and road distances: each segment stamps the cells near it (rather than every cell
      // measuring every segment)
      const riv = new Float32Array(n).fill(1e9), road = new Float32Array(n).fill(1e9);
      const stamp = (out, a, b, m, sub) => {
        const ia = Math.max(0, Math.floor((Math.min(a[0], b[0]) - m - x0) / GC)), ib = Math.min(TN - 1, Math.ceil((Math.max(a[0], b[0]) + m - x0) / GC));
        const ja = Math.max(0, Math.floor((Math.min(a[1], b[1]) - m - y0) / GC)), jb = Math.min(TN - 1, Math.ceil((Math.max(a[1], b[1]) + m - y0) / GC));
        for (let jj = ja; jj <= jb; jj++) for (let ii = ia; ii <= ib; ii++) {
          const x = (i0 + ii - 1) * GC + GC / 2, y = (j0 + jj - 1) * GC + GC / 2;
          const d = Math.sqrt(segDist2(x, y, a[0], a[1], b[0], b[1])) - sub, q = jj * TN + ii;
          if (d < out[q]) out[q] = d;
        }
      };
      for (const r of Fe.rivers) for (let q = 0; q < r.pts.length - 1; q++) { const a = r.pts[q], b = r.pts[q + 1]; stamp(riv, a, b, 900, (a[2] + b[2]) * 0.25); }
      for (const p of Fe.roads) for (let q = 0; q < p.length - 1; q++) stamp(road, p[q], p[q + 1], 450, 0);
      Fe.pre = { riv, road };
      for (let jj = 0; jj < TN; jj++) for (let ii = 0; ii < TN; ii++) this.cellInto(Fe, (i0 + ii - 1) * GC + GC / 2, (j0 + jj - 1) * GC + GC / 2, jj * TN + ii, A, tmpW);
      this.tintsInto(Fe, (i0 - 1) * GC + GC / 2, (j0 - 1) * GC + GC / 2, TN, TN, A);
      return A;
    }
    // the tile holding lookup cell (i, j), and the cell's index in it (this._tk)
    tileCell(i, j) {
      const ti = (i / TS) | 0, tj = (j / TS) | 0, t = this.tileAt(ti, tj);
      this._tk = (j - tj * TS) * TN + (i - ti * TS);
      return t;
    }
    // build the tiles under a world box now (loading, or ahead of the dragon)
    warmTiles(x0, y0, x1, y1, budgetMs) {
      if (!this.gtiles) return true;
      // (budget: none = build them all; < 0 = build none; otherwise at least one, then until the time is used)
      const t0 = performance.now(), S = TS * GC;
      let built = 0;
      for (let tj = Math.max(0, Math.floor(y0 / S)); tj <= Math.floor(y1 / S); tj++) for (let ti = Math.max(0, Math.floor(x0 / S)); ti <= Math.floor(x1 / S); ti++) {
        if (this.hasTile(ti, tj)) continue;
        if (budgetMs !== undefined && (budgetMs < 0 || (built && performance.now() - t0 > budgetMs))) return false;
        this.tileAt(ti, tj); built++;
      }
      return true;
    }

    // bilinear sample of a scalar grid
    gs(g, x, y) {
      const fx = x / GC + 0.5, fy = y / GC + 0.5;
      let i = Math.floor(fx), j = Math.floor(fy);
      const tx = fx - i, ty = fy - j;
      i = U.clamp(i, 0, this.gw - 2); j = U.clamp(j, 0, this.gh - 2);
      if (typeof g === 'string') {
        const a = this.tileCell(i, j)[g], k = this._tk;
        return (a[k] * (1 - tx) + a[k + 1] * tx) * (1 - ty) + (a[k + TN] * (1 - tx) + a[k + TN + 1] * tx) * ty;
      }
      const k = j * this.gw + i, gw = this.gw;
      return (g[k] * (1 - tx) + g[k + 1] * tx) * (1 - ty) + (g[k + gw] * (1 - tx) + g[k + gw + 1] * tx) * ty;
    }
    // nearest-cell lookup (cheap; for masks)
    gn(g, x, y) {
      const i = U.clamp(Math.floor(x / GC + 1), 0, this.gw - 1), j = U.clamp(Math.floor(y / GC + 1), 0, this.gh - 1);
      if (typeof g === 'string') { const a = this.tileCell(i, j)[g]; return a[this._tk]; }
      return g[j * this.gw + i];
    }
    // the surface kind, cached per lookup cell (streamed maps keep it in the tiles)
    kindFast(x, y) {
      if (!this.gtiles) return super.kindFast(x, y);
      if (x < 0 || y < 0 || x > this.W || y > this.H) return 5;
      const gx = Math.floor(x / 32) + 1, gy = Math.floor(y / 32) + 1;
      const t = this.tileCell(gx, gy), k = this._tk;
      let v = t.kind[k];
      if (v === 255) { v = this.kindAt((gx - 1) * 32 + 16, (gy - 1) * 32 + 16); t.kind[k] = v; }
      return v;
    }
    /* soft biome weights at a point → out[5] (human, elf, ice, undead, neutral) */
    biomeAt(x, y, out) {
      out = out || new Float32Array(5);
      const fx = x / GC + 0.5, fy = y / GC + 0.5;
      let i = Math.floor(fx), j = Math.floor(fy);
      const tx = fx - i, ty = fy - j;
      i = U.clamp(i, 0, this.gw - 2); j = U.clamp(j, 0, this.gh - 2);
      let gw = this.gw, B = this.gBiome, k00;
      if (typeof B === 'string') { B = this.tileCell(i, j).gBiome; gw = TN; k00 = this._tk * 5; } else k00 = (j * gw + i) * 5;
      const k10 = k00 + 5, k01 = k00 + gw * 5, k11 = k01 + 5;
      const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
      for (let q = 0; q < 5; q++) out[q] = B[k00 + q] * a + B[k10 + q] * b + B[k01 + q] * c + B[k11 + q] * d;
      return out;
    }
    biomeKey(x, y) {
      const w = this.biomeAt(x, y, this._bw || (this._bw = new Float32Array(5)));
      let best = 4, bv = -1;
      for (let q = 0; q < 5; q++) if (w[q] > bv) { bv = w[q]; best = q; }
      return BIOMES[best];
    }
    frozenAt(x, y) { const w = this.biomeAt(x, y, this._bw2 || (this._bw2 = new Float32Array(5))); return w[2] > 0.55; }

    /* ---------- analytic field (overrides the world-type field) ---------- */
    field(x, y, out, noZones) {
      const sd = this.seed;
      if (!this.gWater) { out[0] = 0.4; out[1] = 0.5; out[2] = 999; out[3] = 0; return out; }
      const wx = x + U.noise2(x / 1100, y / 1100, sd + 5) * 120;
      const wy = y + U.noise2(x / 1100 + 41.3, y / 1100, sd + 6) * 120;
      let h = 0.4 + 0.42 * U.fbm(wx / 1500, wy / 1500, 3, sd);
      // landscape structure: rolling hills in the farmland and heartland, gentler
      // swells under the forest, craggy broken ground in the north and the blight
      const bw = this.biomeAt(x, y, this._bwh || (this._bwh = new Float32Array(5)));
      const roll = U.fbm(wx / 560, wy / 560, 2, sd + 7);
      const crag = U.ridged(x / 330, y / 330, 2, sd + 8) - 0.5;
      h += roll * (0.095 * (bw[0] + bw[4]) + 0.06 * bw[1] + 0.05 * bw[2] + 0.04 * bw[3]) + crag * (0.07 * bw[2] + 0.075 * bw[3]);
      const mt = this.gs(this.gMount, x, y);
      h += mt * 0.62;
      const water = this.gs(this.gWater, x, y);
      // valleys: terrain eases down toward rivers and lakes, water sits at level 0
      if (water < 160) h = Math.min(h, U.lerp(0.1, h, U.smoothstep(-10, 160, water)));
      const m = 0.5 + 0.6 * U.fbm(x / 600, y / 600, 2, sd + 40);
      let s = water;
      const zs = noZones ? null : this.zones.length > 48 ? this.binned('zones', x, y) : this.zones;
      if (zs) for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        if (z.h === null) this.zoneLevel(z); // (a streamed map levels its zones on first use)
        const dx = x - z.x, dy = y - z.y, R = z.r * z.soft;
        if (dx > R || dx < -R || dy > R || dy < -R) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R) continue;
        const t = U.smoothstep(R, z.r, d);
        h = U.lerp(h, z.h !== null ? z.h : 0.42, t);
        if (!z.keepWater) s += (Math.max(s, 200) - s) * Math.min(1, t * 1.6);
      }
      out[0] = h; out[1] = m; out[2] = s; out[3] = this.gs(this.gForest, x, y);
      return out;
    }
    /* the zones (or clear areas) whose reach covers the 512-unit bin holding (x, y): a
     * spatial index for maps with many of them. Items pushed onto the list later are
     * filed on the next query; a list replaced wholesale is indexed afresh. */
    binned(name, x, y) {
      const list = this[name], B = this._bins || (this._bins = {});
      let ix = B[name];
      if (!ix || ix.list !== list || ix.n > list.length) ix = B[name] = { list, n: 0, map: new Map() };
      if (ix.n < list.length) {
        for (let q = ix.n; q < list.length; q++) {
          const z = list[q], R = name === 'zones' ? Math.max(z.r * (z.soft || 1.5), z.r + 24) : (z.r + 24) * 1.25;
          for (let by = Math.floor((z.y - R) / 512); by <= Math.floor((z.y + R) / 512); by++) for (let bx = Math.floor((z.x - R) / 512); bx <= Math.floor((z.x + R) / 512); bx++) {
            const k = bx * 65536 + by; let a = ix.map.get(k); if (!a) { a = []; ix.map.set(k, a); } a.push(z);
          }
        }
        ix.n = list.length;
      }
      return ix.map.get(Math.floor(x / 512) * 65536 + Math.floor(y / 512)) || NONE;
    }
    levelOf(h) { return U.clamp(Math.floor(h * this.levels), 0, this.levels - 1); }
    levelMid(l) { return (l + 0.5) / this.levels; }
    kindOf(h, s) { return s < 0 ? 1 : 0; }
    kindAt(x, y) {
      if (x < 0 || y < 0 || x > this.W || y > this.H) return 5;
      return this.gs(this.gWater, x, y) < 0 ? 1 : 0;
    }
    groundPassable(x, y) {
      const k = this.kindFast(x, y);
      if (k === 5) return false;
      // maps may make their high peaks a wall that only dragons cross (map.peaksBlock = uplift threshold)
      if (this.map && this.map.peaksBlock && this.gs(this.gMount, x, y) > this.map.peaksBlock) return false;
      if (k === 1) return this.frozenAt(x, y) || this.onBridge(x, y);
      return true;
    }
    onBridge(x, y) {
      for (const b of this.bridges) if (U.segDist(x, y, b.x0, b.y0, b.x1, b.y1) < b.w) return true;
      return false;
    }
    roadDist(x, y) { return this.gs(this.gRoad, x, y); }

    /* per-biome cliff faces (hook read by the base _shade) */
    faceColAt(wx, wy, out) {
      const w = this.biomeAt(wx, wy, this._bwf || (this._bwf = new Float32Array(5)));
      let fr = 0, fg = 0, fb = 0, dr = 0, dg = 0, db = 0;
      for (let q = 0; q < 5; q++) {
        const F = FACE[BIOMES[q]], k = w[q];
        fr += F[0][0] * k; fg += F[0][1] * k; fb += F[0][2] * k;
        dr += F[1][0] * k; dg += F[1][1] * k; db += F[1][2] * k;
      }
      out[0] = fr; out[1] = fg; out[2] = fb; out[3] = dr; out[4] = dg; out[5] = db;
      return out;
    }

    /* ---------- colouring ---------- */
    colorize(x, y, h, m, s, ex, l, out, lit) {
      const w = this.biomeAt(x, y, this._bwc || (this._bwc = new Float32Array(5)));
      const sd = this.seed;
      const li = l < 0 ? 0 : l;
      let r = 0, g = 0, b = 0;
      // patchy meadow tone: blend toward each biome's alternate colour in moist patches
      const alt = U.clamp((m - 0.6) * 3, 0, 0.7);
      for (let q = 0; q < 5; q++) {
        const k = w[q]; if (k < 0.004) continue;
        const L = LOOK_RGB[BIOMES[q]];
        const c = L.ramp[Math.min(li, 4)], a = L.alt;
        r += (c[0] + (a[0] - c[0]) * alt) * k; g += (c[1] + (a[1] - c[1]) * alt) * k; b += (c[2] + (a[2] - c[2]) * alt) * k;
      }
      const iceW = w[2], deadW = w[3], elfW = w[1];
      // high ground: bare rock, then snow (snow comes lower in the ice region)
      const mt = h;
      const rockT = U.clamp((mt - 0.74) * 6, 0, 0.75) * (1 - iceW * 0.6);
      if (rockT > 0) { r = U.lerp(r, 132, rockT); g = U.lerp(g, 124, rockT); b = U.lerp(b, 112, rockT); }
      const snowLine = 0.86 - iceW * 0.3;
      if (mt > snowLine) {
        // snow caps, except in the blight where the peaks are ash and black glass
        const t = U.clamp((mt - snowLine) * 9, 0, 1) * (1 - deadW * 0.85), ta = U.clamp((mt - snowLine) * 9, 0, 1) * deadW;
        r = U.lerp(r, 238, t); g = U.lerp(g, 243, t); b = U.lerp(b, 250, t);
        r = U.lerp(r, 86, ta); g = U.lerp(g, 80, ta); b = U.lerp(b, 88, ta);
      }
      // ---- ground detail: nothing in the realm is one flat colour
      const humW = w[0] + w[4];
      const p1 = U.noise2(x / 96, y / 96, sd + 71), p2 = U.noise2(x / 38, y / 38, sd + 72);
      const hh2 = U.hash2((x * 1.9) | 0, (y * 1.9) | 0, sd + 73);
      if (s > 20 && l >= 0) {
        if (humW > 0.2 && ex < 0.45) {
          // flower meadows on the sunny patches, worn dry grass on the others
          if (p1 > 0.4) {
            const t = Math.min(1, (p1 - 0.4) * 3) * humW;
            r = U.lerp(r, 138, t * 0.3); g = U.lerp(g, 160, t * 0.3); b = U.lerp(b, 70, t * 0.3);
            if (hh2 > 0.972 - t * 0.02) { const pick = hh2 > 0.993 ? [240, 236, 210] : hh2 > 0.986 ? [236, 90, 110] : hh2 > 0.979 ? [250, 214, 70] : [130, 150, 236]; r = U.lerp(r, pick[0], 0.85); g = U.lerp(g, pick[1], 0.85); b = U.lerp(b, pick[2], 0.85); }
          } else if (p1 < -0.5) {
            const t = Math.min(1, (-0.5 - p1) * 3) * humW * 0.4;
            r = U.lerp(r, 156, t); g = U.lerp(g, 150, t); b = U.lerp(b, 86, t);
          }
        }
        if (elfW > 0.2) {
          // bright moss cushions, dark loam, luminous ferns
          if (p2 > 0.35) { const t = Math.min(1, (p2 - 0.35) * 3) * elfW * 0.4; r = U.lerp(r, 90, t); g = U.lerp(g, 170, t); b = U.lerp(b, 108, t); }
          if (p1 < -0.45) { const t = Math.min(1, (-0.45 - p1) * 3) * elfW * 0.45; r = U.lerp(r, 44, t); g = U.lerp(g, 64, t); b = U.lerp(b, 38, t); }
          if (hh2 > 0.991 && p2 > 0) { r = U.lerp(r, 168, 0.7 * elfW); g = U.lerp(g, 240, 0.7 * elfW); b = U.lerp(b, 190, 0.7 * elfW); }
        }
        if (deadW > 0.2) {
          // dead grass tufts and bone chips on the dust; bog pools in the low ground near water
          if (p1 < -0.35 && hh2 > 0.94) { r = U.lerp(r, 112, 0.6 * deadW); g = U.lerp(g, 98, 0.6 * deadW); b = U.lerp(b, 64, 0.6 * deadW); }
          if (hh2 > 0.9965) { r = U.lerp(r, 200, 0.7 * deadW); g = U.lerp(g, 192, 0.7 * deadW); b = U.lerp(b, 170, 0.7 * deadW); }
          if (l === 0 && s < 130 && p1 > -0.15) {
            const t = Math.min(1, (p1 + 0.15) * 2.5) * Math.min(1, (130 - s) / 60) * deadW;
            r = U.lerp(r, 42, t * 0.7); g = U.lerp(g, 52, t * 0.7); b = U.lerp(b, 36, t * 0.7);
            if (p2 > 0.3) { const q = Math.min(1, (p2 - 0.3) * 4) * t; r = U.lerp(r, 50, q); g = U.lerp(g, 72, q); b = U.lerp(b, 66, q); if (hh2 > 0.985) { r += 30 * q; g += 36 * q; b += 30 * q; } }
          }
        }
        if (iceW > 0.2) {
          // rock showing through on the high ground, sheets of blue ice in the hollows, blue hollows in the snow
          const rk = U.ridged(x / 150, y / 150, 1, sd + 74);
          if (l >= 2 && rk > 0.7) { const t = Math.min(1, (rk - 0.7) * 6) * iceW * (l >= 3 ? 0.9 : 0.5); const dk = 1 - (hh2 > 0.93 ? 0.25 : 0) + (p2 > 0.3 ? 0.08 : 0); r = U.lerp(r, 118 * dk, t); g = U.lerp(g, 126 * dk, t); b = U.lerp(b, 140 * dk, t); }
          if (l === 0 && s < 220 && p1 > 0.55) { const t = Math.min(1, (p1 - 0.55) * 5) * Math.min(1, (220 - s) / 100) * iceW * 0.55; r = U.lerp(r, 190, t); g = U.lerp(g, 218, t); b = U.lerp(b, 238, t); if (hh2 > 0.99) { r += 24 * t; g += 24 * t; b += 20 * t; } }
        }
        // the verges of the roads are trodden to dust; the banks are mud
        const rd = this.gs(this.gRoad, x, y);
        if (rd < 64 && iceW < 0.5) { const t = (1 - rd / 64) * (0.55 + p2 * 0.45) * 0.45; if (t > 0) { r = U.lerp(r, 150, t); g = U.lerp(g, 128, t); b = U.lerp(b, 88, t); } }
        if (s > 26 && s < 58 && iceW < 0.5) { const t = (1 - (s - 26) / 32) * 0.35; r = U.lerp(r, 96, t); g = U.lerp(g, 80, t); b = U.lerp(b, 56, t); }
      }
      // forest floor darkens under the canopy
      if (ex > 0.25 && s > 20) {
        const t = U.clamp((ex - 0.25) * 1.6, 0, 0.7);
        let fr = 0, fg = 0, fb = 0;
        for (let q = 0; q < 5; q++) { const F = LOOK_RGB[BIOMES[q]].floor, k = w[q]; fr += F[0] * k; fg += F[1] * k; fb += F[2] * k; }
        r = U.lerp(r, fr, t); g = U.lerp(g, fg, t); b = U.lerp(b, fb, t);
        // leaf litter and the odd fallen branch under the trees
        if (hh2 > 0.975 && iceW < 0.4) { const lit2 = humW > 0.5 ? [150, 104, 48] : elfW > 0.5 ? [120, 128, 60] : [78, 64, 56]; r = U.lerp(r, lit2[0], 0.6); g = U.lerp(g, lit2[1], 0.6); b = U.lerp(b, lit2[2], 0.6); }
      }
      // cursed blight: dark veins and a sickly sheen in the undead lands
      if (deadW > 0.3) {
        // cracked earth, in patches: fine dark fissures where the ground has split
        const ck = U.noise2(x / 420, y / 420, sd + 60);
        if (ck > 0.05) {
          const v = U.ridged(x / 70, y / 70, 1, sd + 61), m = Math.min(1, (ck - 0.05) * 3);
          if (v > 0.965) { const t = Math.min(1, (v - 0.965) * 40) * deadW * m; r = U.lerp(r, 22, t * 0.7); g = U.lerp(g, 16, t * 0.7); b = U.lerp(b, 30, t * 0.7); }
        }
        const ash = U.noise2(x / 220, y / 220, sd + 62);
        if (ash > 0.3) { const t = (ash - 0.3) * 0.9 * deadW; r = U.lerp(r, 128, t); g = U.lerp(g, 122, t); b = U.lerp(b, 116, t); }
        if (ash < -0.35) { const t = (-0.35 - ash) * 0.9 * deadW; r = U.lerp(r, 92, t); g = U.lerp(g, 82, t); b = U.lerp(b, 52, t); } // dead yellow grass
      }
      // wind-scoured snow drifts and blue shadows in the north
      if (iceW > 0.3) {
        const dft = U.noise2(x / 160 + y / 400, y / 90, sd + 63);
        const t = U.clamp(dft * 0.5, -0.25, 0.3) * iceW;
        r += t * 30; g += t * 26; b += t * 18;
      }
      // water: rivers and lakes (frozen solid in the ice region)
      if (s < 0) {
        const d = U.clamp(-s / 70, 0, 1);
        if (iceW > 0.55) {
          // frozen: pale blue sheet with pressure cracks and snow dusting
          r = U.lerp(186, 150, d); g = U.lerp(214, 196, d); b = U.lerp(232, 226, d);
          const ck = U.ridged(x / 70, y / 70, 2, sd + 64);
          if (ck > 0.94) { r *= 0.82; g *= 0.88; b *= 0.94; }
          else if (U.noise2(x / 50, y / 50, sd + 65) > 0.3) { r += 18; g += 14; b += 10; }
        } else {
          const deep = deadW > 0.5 ? [28, 40, 34] : [30, 66, 92], shal = deadW > 0.5 ? [64, 78, 62] : elfW > 0.5 ? [66, 132, 128] : [74, 140, 160];
          r = U.lerp(shal[0], deep[0], d); g = U.lerp(shal[1], deep[1], d); b = U.lerp(shal[2], deep[2], d);
          if (d < 0.12) { const t = (0.12 - d) * 6; r = U.lerp(r, 200, t * 0.6); g = U.lerp(g, 226, t * 0.6); b = U.lerp(b, 220, t * 0.6); }
          const wv = Math.sin((x * 0.6 + y * 0.8) / 7 + U.noise2(x / 120, y / 120, sd + 66) * 7);
          const crest = wv > 0.82 ? (wv - 0.82) * 5 : 0;
          const k = 1 + crest * 0.12 + U.noise2(x / 300, y / 260, sd + 67) * 0.06;
          r *= k; g *= k; b *= k;
          if (U.hash2(x >> 1, y, sd + 68) > 0.994) { r += 40; g += 46; b += 46; }
          if (elfW > 0.5 && d < 0.3 && U.noise2(x / 30, y / 30, sd + 75) > 0.55 && U.hash2((x * 0.5) | 0, (y * 0.5) | 0, sd + 76) > 0.6) { r = 70; g = 132; b = 60; }
        }
      } else if (s < 26) {
        // banks: wet earth, pebbles, a pale strand on lake shores
        const t = 1 - s / 26;
        const sand = iceW > 0.55 ? [210, 220, 228] : deadW > 0.5 ? [72, 66, 58] : [150, 136, 100];
        r = U.lerp(r, sand[0], t * 0.7); g = U.lerp(g, sand[1], t * 0.7); b = U.lerp(b, sand[2], t * 0.7);
      }
      // fine speckle: wildflowers in meadows, sparkle on snow, glowing motes in the blight
      if (s > 26 && l >= 0) {
        const hh = U.hash2((x * 1.7) | 0, (y * 1.7) | 0, sd + 69);
        if (hh > 0.993 && ex < 0.4) {
          let best = 4, bv = 0;
          for (let q = 0; q < 5; q++) if (w[q] > bv) { bv = w[q]; best = q; }
          const sp = LOOK_RGB[BIOMES[best]].speck;
          const t = best === 3 ? 0.5 : best === 2 ? 0.5 : 0.75;
          r = U.lerp(r, sp[0], t); g = U.lerp(g, sp[1], t); b = U.lerp(b, sp[2], t);
        }
      }
      // a province's own ground colour (heather moor, olive marsh, ochre badlands…), on dry land
      if (this.hasTint && s > 0) {
        const k = U.clamp(s / 40, 0, 1);
        r *= 1 + (this.gs(this.gTintR, x, y) - 1) * k; g *= 1 + (this.gs(this.gTintG, x, y) - 1) * k; b *= 1 + (this.gs(this.gTintB, x, y) - 1) * k;
      }
      out[0] = r; out[1] = g; out[2] = b;
    }

    /* ---------- decor: forests and undergrowth stamped per biome ---------- */
    buildDecorSets() {
      const M = AS.Models, F = AS.Forge, sets = { sheets: {}, any: true };
      const tint = this.map.foliage || {};
      const mk = (name, gen, pal, n, opt) => {
        const list = [];
        for (let v = 0; v < n; v++) {
          const o = Object.assign({ seed: v }, opt || {});
          if (M[gen]) list.push(F.sheet('rdecor:' + gen + ':' + v + ':' + JSON.stringify(pal || {}) + JSON.stringify(opt || {}), () => { const m = M[gen](pal, o); m.style = 'decor'; return m; }, 1, 1));
        }
        if (!list.length) {
          // fallback until a model exists: engine rocks / tufts
          for (let v = 0; v < 3; v++) list.push(F.sheet('rdecor:fb:' + name + v, () => M.decor(name.startsWith('rock') ? 'rock' : 'tuft', { a: '#3e5a2a', b: '#6a8a3e', d: '#20301a' }, v * 13 + 3), 1, 1));
        }
        sets.sheets[name] = list;
      };
      const P = (k) => tint[k] || null;
      mk('oak', 'tree_oak', P('human'), 8); mk('oakAutumn', 'tree_oak', null, 5, { tint: 'autumn' }); mk('birch', 'tree_birch', P('human'), 4); mk('pine', 'tree_pine', P('neutral'), 6);
      mk('willow', 'tree_willow', null, 3); mk('fruit', 'tree_fruit', null, 3);
      mk('elfoak', 'tree_oak', P('elf'), 6, { tint: 'emerald' });
      mk('elder', 'tree_elder', null, 3); mk('elfbirch', 'tree_birch', P('elf'), 3, { tint: 'spring' });
      mk('snowpine', 'tree_snowpine', null, 5); mk('dead', 'tree_dead', null, 5);
      mk('darkpine', 'tree_pine', P('undead') || { leafA: '#1c2a24', leafB: '#36483c', bark: '#2a2420' }, 4);
      mk('bush', 'bush', null, 4); mk('berry', 'bush_berry', null, 3); mk('flowers', 'flowers', null, 4); mk('reeds', 'reeds', null, 3);
      mk('rock', 'rock_mossy', null, 4); mk('rocksnow', 'rock_snow', null, 4); mk('rockdark', 'rock_dark', null, 4);
      mk('shard', 'ice_shard', null, 3); mk('shroom', 'mushrooms_glow', null, 3); mk('bones', 'bones_pile', null, 3); mk('stump', 'stump', null, 3);
      // tree choice per biome: [set name, weight]
      sets.trees = {
        human: [['oak', 4], ['oakAutumn', 1.6], ['birch', 2], ['pine', 1.2], ['fruit', 0.4]],
        elf: [['elfoak', 4], ['elfbirch', 2], ['elder', 0.35], ['pine', 0.6]],
        ice: [['snowpine', 6], ['pine', 0.8]],
        undead: [['dead', 4], ['darkpine', 2.2]],
        neutral: [['oak', 3], ['oakAutumn', 0.6], ['pine', 2.5], ['birch', 1.5]],
      };
      // a province's trees and undergrowth (map.flora kind 1-5), instead of the realm's
      sets.floraTrees = [null,
        [['pine', 5], ['darkpine', 2], ['birch', 0.6]],               // 1 dark pine forest
        [['dead', 3], ['willow', 2.2], ['darkpine', 0.6]],            // 2 bog and marsh
        [['birch', 2], ['pine', 1.2], ['dead', 0.3]],                 // 3 heath and moor
        [['dead', 2], ['darkpine', 0.4]],                             // 4 badlands
        [['oak', 3], ['fruit', 1.6], ['birch', 1], ['oakAutumn', 1]], // 5 lush shire country
      ];
      sets.floraUnder = [null,
        [['rock', 1.2], ['stump', 1], ['bush', 0.8]],
        [['reeds', 2.5], ['stump', 1], ['shroom', 0.4], ['bush', 0.6]],
        [['rock', 2.2], ['bush', 1], ['flowers', 0.5], ['stump', 0.3]],
        [['rock', 2.5], ['rockdark', 1.2], ['bones', 0.5]],
        [['flowers', 3], ['bush', 1.5], ['berry', 0.8]],
      ];
      sets.under = {
        human: [['bush', 2], ['flowers', 2.5], ['berry', 0.6], ['rock', 0.6], ['stump', 0.3]],
        elf: [['bush', 2], ['flowers', 1.6], ['berry', 1], ['rock', 0.8]],
        ice: [['rocksnow', 2], ['shard', 0.9]],
        undead: [['rockdark', 1.6], ['bones', 0.8], ['shroom', 1.3], ['stump', 0.8]],
        neutral: [['bush', 2], ['rock', 1.4], ['flowers', 1.4], ['stump', 0.4]],
      };
      return sets;
    }
    pickW(list, v) {
      let tot = 0; for (const e of list) tot += e[1];
      let t = v * tot;
      for (const e of list) { t -= e[1]; if (t <= 0) return e[0]; }
      return list[0][0];
    }
    // flat dry ground at (x, y) using the chunk's own level buffer (cheap)
    stampOK(st, x, y, r) {
      if (x < 6 || y < 6 || x > this.W - 6 || y > this.H - 6) return false;
      if (this.gs(this.gWater, x, y) < 14 + r * 0.6) return false;
      if (this.gs(this.gRoad, x, y) < 28 + r) return false;
      for (const z of this.zones.length > 48 ? this.binned('zones', x, y) : this.zones) { const dx = x - z.x, dy = y - z.y, rr = z.r * (z.treeR || 0.95) + r; if (dx * dx + dy * dy < rr * rr) return false; }
      for (const z of this.clearAreas.length > 48 ? this.binned('clearAreas', x, y) : this.clearAreas) { const dx = x - z.x, dy = (y - z.y) / 0.8; if (dx * dx + dy * dy < (z.r + r) * (z.r + r)) return false; }
      const TD = st.TD, px = Math.round((x - st.x0) * TD) + st.ML, py = Math.round((y - st.y0) * TD) + st.top;
      const o = Math.max(2, Math.round(r * 0.7 * TD));
      if (px - o < 0 || px + o >= st.NW || py - o * 2 < 0 || py + o >= st.rows) {
        // rooted outside this chunk's level buffer (its canopy still reaches in):
        // test the terrain directly so the neighbouring chunk agrees on the tree
        const f = this._sf || (this._sf = new Float32Array(4)), lv = (xx, yy) => this.levelOf(this.field(xx, yy, f)[0]);
        const l = lv(x, y), d = r * 0.7;
        return lv(x - d, y) === l && lv(x + d, y) === l && lv(x, y + d) === l && lv(x, y - d * 2) === l;
      }
      const L = st.L, NW = st.NW, l = L[py * NW + px];
      if (L[py * NW + px - o] !== l || L[py * NW + px + o] !== l || L[(py + o) * NW + px] !== l || L[(py - o * 2) * NW + px] !== l) return false;
      return true;
    }
    *stampDecorGen(ctx, cx, cy, st) {
      if (!this.decorSets) this.decorSets = this.buildDecorSets();
      const ds = this.decorSets, sd = this.seed;
      const q = (AS.Settings && AS.Settings.quality === 'low') ? 0.6 : 1;
      const x0 = cx * CH, y0 = cy * CH, M = 40;
      const items = [];
      const bw = new Float32Array(5);
      const biomeOf = (x, y) => {
        this.biomeAt(x, y, bw);
        let best = 4, bv = -1;
        // dithered pick so borders mix species instead of a hard line
        const jitter = (U.hash2(x | 0, y | 0, sd + 77) - 0.5) * 0.5;
        for (let k = 0; k < 5; k++) { const v = bw[k] + (k === 0 ? jitter * 0.3 : 0) + U.hash2((x | 0) + k, y | 0, sd + 78) * 0.25; if (v > bv) { bv = v; best = k; } }
        return BIOMES[best];
      };
      // trees: jittered world grid, density from the forest grid
      const TC = 13;
      for (let gy = Math.floor((y0 - M) / TC); gy <= Math.floor((y0 + CH + M) / TC); gy++) {
        for (let gx = Math.floor((x0 - M) / TC); gx <= Math.floor((x0 + CH + M) / TC); gx++) {
          const x = (gx + 0.15 + U.hash2(gx, gy, sd + 401) * 0.7) * TC, y = (gy + 0.15 + U.hash2(gx, gy, sd + 402) * 0.7) * TC;
          if (x < x0 - 30 || x > x0 + CH + 30 || y < y0 - 30 || y > y0 + CH + 46) continue;
          if (this.gn(this.gField, x, y)) continue;
          let dens = this.gs(this.gForest, x, y);
          const lone = 0.012; // lone trees dot the open country
          const hv = U.hash2(gx, gy, sd + 403);
          if (hv > dens * 0.82 * q + lone) continue;
          const bk = biomeOf(x, y), fl = this.gFlora ? this.gn(this.gFlora, x, y) : 0;
          let kind = this.pickW(fl ? ds.floraTrees[fl] : ds.trees[bk], U.hash2(gx, gy, sd + 404));
          if (kind === 'elder' && (gx % 3 || gy % 3)) kind = 'elfoak';
          // willows lean over the water's edge
          if (bk !== 'ice' && bk !== 'undead' && this.gs(this.gWater, x, y) < 90 && U.hash2(gx, gy, sd + 405) < 0.5) kind = 'willow';
          items.push({ k: kind, x, y, v: (U.hash2(gx, gy, sd + 406) * 97) | 0, r: kind === 'elder' ? 20 : 7 });
        }
      }
      yield null;
      // undergrowth, rocks and reeds
      const UC = 30;
      for (let gy = Math.floor((y0 - M) / UC); gy <= Math.floor((y0 + CH + M) / UC); gy++) {
        for (let gx = Math.floor((x0 - M) / UC); gx <= Math.floor((x0 + CH + M) / UC); gx++) {
          const x = (gx + U.hash2(gx, gy, sd + 411)) * UC, y = (gy + U.hash2(gx, gy, sd + 412)) * UC;
          if (x < x0 - 20 || x > x0 + CH + 20 || y < y0 - 20 || y > y0 + CH + 30) continue;
          const wd = this.gs(this.gWater, x, y);
          const hv = U.hash2(gx, gy, sd + 413);
          if (wd > 14 && wd < 60 && hv < 0.35) { const bk = biomeOf(x, y); if (bk !== 'ice') { items.push({ k: 'reeds', x, y, v: (hv * 50) | 0, r: 3, nearWater: true }); continue; } }
          // boulders and pebbles along the banks
          if (wd > 8 && wd < 44 && hv > 0.62 && hv < 0.78) { const bk = biomeOf(x, y); items.push({ k: bk === 'ice' ? 'rocksnow' : bk === 'undead' ? 'rockdark' : 'rock', x, y, v: (hv * 97) | 0, r: 3, nearWater: true }); continue; }
          if (this.gn(this.gField, x, y) === 1) continue;
          const mt = this.gs(this.gMount, x, y);
          const fo2 = this.gs(this.gForest, x, y);
          const edge = fo2 > 0.08 && fo2 < 0.5 ? 1 - Math.abs(fo2 - 0.29) / 0.21 : 0; // the scrubby fringe of a wood
          const p = 0.16 + mt * 0.5 + fo2 * 0.2 + edge * 0.3;
          if (hv > p * q) continue;
          const bk = biomeOf(x, y), fl = this.gFlora ? this.gn(this.gFlora, x, y) : 0;
          let k = this.pickW(fl ? ds.floraUnder[fl] : ds.under[bk], U.hash2(gx, gy, sd + 414));
          if (edge > 0.3 && bk !== 'ice' && bk !== 'undead' && U.hash2(gx, gy, sd + 417) < 0.6) k = U.hash2(gx, gy, sd + 418) < 0.3 ? 'berry' : 'bush';
          if (mt > 0.35 && U.hash2(gx, gy, sd + 415) < 0.6) k = bk === 'ice' ? 'rocksnow' : bk === 'undead' ? 'rockdark' : 'rock';
          items.push({ k, x, y, v: (U.hash2(gx, gy, sd + 416) * 97) | 0, r: 4 });
        }
      }
      yield null;
      items.sort((a, b) => a.y - b.y);
      ctx.save();
      ctx.scale(st.TD, st.TD);
      ctx.imageSmoothingEnabled = true;
      let n = 0;
      for (const it of items) {
        if (!this.stampOK(st, it.x, it.y, it.nearWater ? 1 : it.r)) continue;
        const list = ds.sheets[it.k];
        if (!list || !list.length) continue;
        const sh = list[it.v % list.length];
        const lx = it.x - x0, ly = it.y - y0;
        if ((it.k === 'rocksnow' || it.k === 'snowpine' || it.k === 'shard') && this.frozenAt(it.x, it.y)) {
          // a drift banked against the windward side, a blue hollow in the lee
          const rr = sh.w * 0.55;
          ctx.globalAlpha = 0.5; ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.ellipse(lx - rr * 0.25, ly + 1, rr, rr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.22; ctx.fillStyle = '#7a9cc8'; ctx.beginPath(); ctx.ellipse(lx + rr * 0.45, ly + 2.5, rr * 0.7, rr * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.36; ctx.drawImage(sh.shadows[0], lx - sh.ax + 3.2, ly - sh.ay + 1.8, sh.w, sh.h);
        ctx.globalAlpha = 1; ctx.drawImage(sh.frames[0][0], lx - sh.ax, ly - sh.ay, sh.w, sh.h);
        if (++n % 140 === 0) { ctx.restore(); yield null; ctx.save(); ctx.scale(st.TD, st.TD); ctx.imageSmoothingEnabled = true; }
      }
      ctx.restore();
    }
    stampDecor(ctx, cx, cy, st) { const it = this.stampDecorGen(ctx, cx, cy, st); let r; do { r = it.next(); } while (!r.done); }

    /* tactical map: also shades forests and roads */
    buildMap(scale) {
      // a streamed map starts with a blank war map, painted block by block as it is seen (paintMapBlock)
      if (this.gtiles) { const cv = AS.Forge.canvas(Math.ceil(this.W / scale), Math.ceil(this.H / scale)), c = cv.getContext('2d'); c.fillStyle = '#26323a'; c.fillRect(0, 0, cv.width, cv.height); cv.scale = scale; return cv; }
      const cv = super.buildMap(scale);
      const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
      const img = ctx.getImageData(0, 0, w, h), D = img.data;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = i * scale + scale / 2, y = j * scale + scale / 2, q = (j * w + i) * 4;
        const fo = this.gs(this.gForest, x, y), wd = this.gs(this.gWater, x, y);
        if (fo > 0.3 && wd > 20 && !this.gn(this.gField, x, y)) { const k = 1 - Math.min(0.42, (fo - 0.3) * 0.7); D[q] *= k * 0.92; D[q + 1] *= k; D[q + 2] *= k * 0.9; }
        if (this.gs(this.gRoad, x, y) < Math.max(18, scale * 1.1) && wd > 0) { D[q] = U.lerp(D[q], 196, 0.55); D[q + 1] = U.lerp(D[q + 1], 176, 0.55); D[q + 2] = U.lerp(D[q + 2], 132, 0.55); }
      }
      ctx.putImageData(img, 0, 0);
      return cv;
    }
  }

  /* one block (MAPB world units square) of a streamed map's war map, painted the same
   * way as the whole-map build (terraces shaded against the row above, forests, roads) */
  const MAPB = TS * GC;
  RealmTerrain.MAPB = MAPB;
  RealmTerrain.prototype.paintMapBlock = function (cv, bx, by) {
    const scale = cv.scale, W = cv.width, H = cv.height;
    const i0 = Math.floor(bx * MAPB / scale), i1 = Math.min(W, Math.floor((bx + 1) * MAPB / scale)), j0 = Math.floor(by * MAPB / scale), j1 = Math.min(H, Math.floor((by + 1) * MAPB / scale));
    const w = i1 - i0, h = j1 - j0;
    if (w <= 0 || h <= 0) return;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), D = img.data, f = new Float32Array(4), out = [0, 0, 0];
    const prev = new Float32Array(w);
    // (the terraces are shaded against the row above: taken from the block above only if its tile is built)
    const above = j0 > 0 && (!this.gtiles || this.hasTile(bx, by - 1));
    for (let i = 0; i < w; i++) { const x = (i0 + i) * scale + scale / 2, y = (j0 - 1) * scale + scale / 2; prev[i] = above ? this.levelOf(this.field(x, y, f)[0]) : -1; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = (i0 + i) * scale + scale / 2, y = (j0 + j) * scale + scale / 2;
      this.field(x, y, f);
      const l = this.levelOf(f[0]);
      this.colorize(x, y, f[0], f[1], f[2], f[3], l, out);
      const lu = prev[i] < 0 ? l : prev[i], k = lu > l ? 0.7 : lu < l ? 1.15 : 1;
      prev[i] = l;
      const q = (j * w + i) * 4;
      D[q] = out[0] * k; D[q + 1] = out[1] * k; D[q + 2] = out[2] * k; D[q + 3] = 255;
      const fo = this.gs(this.gForest, x, y), wd = this.gs(this.gWater, x, y);
      if (fo > 0.3 && wd > 20 && !this.gn(this.gField, x, y)) { const kk = 1 - Math.min(0.42, (fo - 0.3) * 0.7); D[q] *= kk * 0.92; D[q + 1] *= kk; D[q + 2] *= kk * 0.9; }
      if (this.gs(this.gRoad, x, y) < Math.max(18, scale * 1.1) && wd > 0) { D[q] = U.lerp(D[q], 196, 0.55); D[q + 1] = U.lerp(D[q + 1], 176, 0.55); D[q + 2] = U.lerp(D[q + 2], 132, 0.55); }
    }
    ctx.putImageData(img, i0, j0);
  };
  /* a sharper picture of one block for the minimap and a zoomed war map: the same colours as
   * the war map, at `scale` world units a pixel, painted a few rows at a time (e: the block's
   * entry { bx, by }, kept between calls) within budgetMs. Returns true once the block is done. */
  RealmTerrain.prototype.paintDetail = function (e, scale, budgetMs) {
    const N = Math.round(MAPB / scale);
    if (!e.cv) { e.cv = AS.Forge.canvas(N, N); e.row = 0; e.prev = new Float32Array(N).fill(-1); }
    const ctx = e.cv.getContext('2d'), f = this._pdF || (this._pdF = new Float32Array(4)), out = [0, 0, 0], t0 = performance.now();
    const X0 = e.bx * MAPB, Y0 = e.by * MAPB, roadW = Math.max(14, scale * 1.1);
    while (e.row < N && performance.now() - t0 < budgetMs) {
      const rows = Math.min(8, N - e.row), img = ctx.createImageData(N, rows), D = img.data;
      for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) {
        const x = X0 + i * scale + scale / 2, y = Y0 + (e.row + j) * scale + scale / 2;
        this.field(x, y, f);
        const l = this.levelOf(f[0]);
        this.colorize(x, y, f[0], f[1], f[2], f[3], l, out);
        const lu = e.prev[i] < 0 ? l : e.prev[i], k = lu > l ? 0.7 : lu < l ? 1.15 : 1;
        e.prev[i] = l;
        const q = (j * N + i) * 4;
        D[q] = out[0] * k; D[q + 1] = out[1] * k; D[q + 2] = out[2] * k; D[q + 3] = 255;
        const fo = this.gs(this.gForest, x, y), wd = this.gs(this.gWater, x, y);
        if (fo > 0.3 && wd > 20 && !this.gn(this.gField, x, y)) { const kk = 1 - Math.min(0.42, (fo - 0.3) * 0.7); D[q] *= kk * 0.92; D[q + 1] *= kk; D[q + 2] *= kk * 0.9; }
        if (this.gs(this.gRoad, x, y) < roadW && wd > 0) { D[q] = U.lerp(D[q], 196, 0.6); D[q + 1] = U.lerp(D[q + 1], 176, 0.6); D[q + 2] = U.lerp(D[q + 2], 132, 0.6); }
      }
      ctx.putImageData(img, 0, e.row); e.row += rows;
    }
    return e.row >= N;
  };
  RealmTerrain.BIOMES = BIOMES;
  RealmTerrain.LOOK = LOOK;
  RealmTerrain.smoothLine = smoothLine;
  AS.RealmTerrain = RealmTerrain;
})(window.AS);
