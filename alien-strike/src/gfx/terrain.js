/* ALIEN STRIKE — procedural terrain.
 * The map is an analytic field (height, moisture, band, extra) sampled on a coarse
 * grid and rasterised into 256px chunk canvases on demand. Terraced height levels
 * produce oblique cliff faces (the visible south wall of every plateau), lips,
 * contact shadows and cast shadows, so flat 2D ground reads as a sculpted 3/4
 * landscape. Ten world types share this pipeline with type-specific colouring. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C;
  const CH = 256, G = 8;
  const rgb = (h) => C.hex(h);

  class Terrain {
    constructor(world, map) {
      this.world = world;
      this.T = world.terrain;
      this.type = this.T.type;
      this.W = map.w; this.H = map.h;
      this.seed = (this.T.seed + (map.seed || 0) * 7) | 0;
      this.zones = (map.zones || []).map((z) => Object.assign({ r: 120, h: null, soft: 1.5 }, z));
      this.levels = this.T.levels;
      this.sea = this.T.sea !== undefined ? this.T.sea : -1;
      this.F = this.T.cliff;
      this.cache = new Map();
      this.maxCache = 150;
      this.decals = new Map(); // chunkKey -> [decal]
      this.sdecals = new Map(); // chunkKey -> [static decal]
      this.clearAreas = []; // landmark footprints kept free of decor
      this.clearSegs = []; // roads kept free of decor: [x0, y0, x1, y1, halfWidth]
      this.typeGrid = new Uint8Array(Math.ceil(this.W / 32 + 2) * Math.ceil(this.H / 32 + 2)).fill(255);
      this.tgW = Math.ceil(this.W / 32 + 2);
      this.col = {
        ramp: this.T.ramp.map(rgb), alt: rgb(this.T.alt), face: rgb(this.T.face), faceDark: rgb(this.T.faceDark),
        lip: rgb(this.T.lip), speck: this.T.speck.map(rgb),
      };
      const T = this.T;
      if (T.river) this.col.river = { c: rgb(T.river.col), d: rgb(T.river.dark), k: rgb(T.river.crack) };
      if (T.water) this.col.water = { deep: rgb(T.water.deep), shallow: rgb(T.water.shallow), foam: rgb(T.water.foam), ruins: T.water.ruins ? rgb(T.water.ruins) : null };
      if (T.lava) this.col.lava = { hot: rgb(T.lava.hot), mid: rgb(T.lava.mid), crust: rgb(T.lava.crust) };
      if (T.canopy) this.col.canopy = { c: rgb(T.canopy.col), d: rgb(T.canopy.dark), h: rgb(T.canopy.hi) };
      if (T.fungus) this.col.fungus = { a: rgb(T.fungus.a), b: rgb(T.fungus.b), dot: rgb(T.fungus.dot) };
      if (T.cloud) this.col.cloud = [rgb(T.cloud.a), rgb(T.cloud.b), rgb(T.cloud.c), rgb(T.cloud.d)];
      if (T.metal) this.col.metal = { seam: rgb(T.metal.seam), rivet: rgb(T.metal.rivet), c1: rgb(T.metal.conduit), c2: rgb(T.metal.conduit2) };
      if (T.channel) this.col.channel = { a: rgb(T.channel.a), b: rgb(T.channel.b) };
      if (T.dune) this.col.dune = { c: rgb(T.dune.col), s: rgb(T.dune.shade) };
      this.decorSheets = null;
      this._f = new Float32Array(4);
      // zones without an explicit height flatten to the local ground level (so bases
      // sit flat without carving artificial circular plateaus); on water / cloud
      // worlds they are raised just above the surface to form islands.
      // The zone takes the terrace level most of its footprint already sits on, at
      // that level's centre height, so its rim never hovers on a level threshold
      // (which made ragged, stair-stepped edges).
      for (const z of this.zones) this.zoneLevel(z);
    }
    zoneLevel(z) {
      if (z.h !== null) return;
      const f = new Float32Array(4), votes = new Map();
      for (let i = 0; i < 13; i++) {
        const a = i * 2.4, rr = i === 0 ? 0 : z.r * (i % 2 ? 0.5 : 0.9);
        this.field(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, f, true);
        if (this.T.river && f[2] < this.T.river.width * 1.6) continue;
        if (this.T.lava && f[2] < this.T.lava.width * 1.8) continue;
        const l = Math.max(0, this.levelOf(f[0]));
        votes.set(l, (votes.get(l) || 0) + (i === 0 ? 2 : 1));
      }
      let best = this.levelOf(0.4), bv = 0;
      for (const [l, v] of votes) if (v > bv || (v === bv && l > best)) { best = l; bv = v; }
      z.h = U.clamp(this.levelMid(best), 0.05, 0.95);
    }
    /* flatten an extra area after construction (landmark sites); call before chunks exist */
    addZone(z) {
      z = Object.assign({ r: 120, h: null, soft: 1.5 }, z);
      this.zoneLevel(z);
      this.zones.push(z);
      this.typeGrid.fill(255);
      this.cache.clear(); this.pending = null;
      return z;
    }

    /* ---------- analytic field ---------- */
    field(x, y, out, noZones) {
      const T = this.T, sc = T.scale, sd = this.seed;
      const wx = x + U.noise2(x * sc * 0.6, y * sc * 0.6, sd + 5) * 180;
      const wy = y + U.noise2(x * sc * 0.6 + 41.3, y * sc * 0.6, sd + 6) * 180;
      let h = 0.5 + 0.62 * U.fbm(wx * sc, wy * sc, 4, sd);
      h = (h - 0.5) * 1.5 + 0.5;
      const m = 0.5 + 0.6 * U.fbm(x * sc * 2.7, y * sc * 2.7, 3, sd + 40);
      let s = 1, ex = 0;
      const ty = this.type;
      if (T.river) {
        s = Math.abs(U.fbm(wx * T.river.scale, wy * T.river.scale, 2, sd + 70));
        if (s < T.river.width * 1.6) h = Math.min(h, U.lerp(0.12, h, U.smoothstep(T.river.width * 0.7, T.river.width * 1.6, s)));
      } else if (T.lava) {
        s = Math.abs(U.fbm(wx * T.lava.scale, wy * T.lava.scale, 2, sd + 71));
        if (s < T.lava.width * 1.8) h = Math.min(h, U.lerp(0.1, h, U.smoothstep(T.lava.width * 0.8, T.lava.width * 1.8, s)));
      }
      if (ty === 'jungle') ex = U.fbm(x / 70, y / 70, 3, sd + 90);
      else if (ty === 'moon') ex = this.crater(x, y);
      else if (ty === 'clouds') ex = U.fbm(x / 160 + 9, y / 120, 4, sd + 91);
      else if (ty === 'dunes') ex = U.noise2(x / 300, y / 300, sd + 92);
      else if (ty === 'ice') ex = U.ridged(x / 260, y / 260, 3, sd + 93);
      else if (ty === 'sanctum') ex = U.fbm(x / 220, y / 220, 3, sd + 94);
      // mission zones (base plateaus, forced islands, lakes)
      const zs = noZones ? [] : this.zones;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        const dx = x - z.x, dy = y - z.y, R = z.r * z.soft;
        if (dx > R || dx < -R || dy > R || dy < -R) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= R) continue;
        const t = U.smoothstep(R, z.r, d);
        const target = z.h !== null ? z.h : this.landMid();
        h = U.lerp(h, target, t);
        s += (Math.max(s, 1.2) - s) * Math.min(1, t * 1.6); // rivers taper out of the zone
      }
      out[0] = h; out[1] = m; out[2] = s; out[3] = ex;
      return out;
    }

    landMid() {
      if (this.sea >= 0) return this.sea + (1 - this.sea) * 0.45;
      return 0.5;
    }

    crater(x, y) {
      const cell = 340, sd = this.seed;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let v = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const gx = cx + i, gy = cy + j;
        if (U.hash2(gx, gy, sd + 3) > 0.55) continue;
        const px = (gx + U.hash2(gx, gy, sd + 4)) * cell, py = (gy + U.hash2(gx, gy, sd + 5)) * cell;
        const r = 40 + U.hash2(gx, gy, sd + 6) * 110;
        const dx = x - px, dy = y - py, d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d < 1.7) {
          const side = (dx + dy) / (r * 1.41 * Math.max(d, 0.001)); // +1 on the far (south-east) side
          // inner bowl: the south-east inner wall faces the light, the north-west one is shaded
          if (d < 1) v += ((dx + dy) / (r * 1.41)) * 1.15 * (1 - d * d) - 0.3 * (1 - d);
          // raised rim: its outer slope is lit on the north-west side
          else if (d < 1.16) v += ((1.16 - d) / 0.16) * 0.42 * (0.55 - 0.45 * side);
          // pale ejecta blanket
          else v += ((1.7 - d) / 0.54) * 0.09;
        }
      }
      return v;
    }

    levelMid(l) {
      if (this.sea >= 0) return this.sea + ((l + 0.5) / (this.levels * 1.15)) * (1 - this.sea);
      return (l + 0.5) / this.levels;
    }

    levelOf(h) {
      if (this.sea >= 0) {
        if (h < this.sea) return -1;
        return U.clamp(Math.floor(((h - this.sea) / (1 - this.sea)) * this.levels * 1.15), 0, this.levels - 1);
      }
      return U.clamp(Math.floor(h * this.levels), 0, this.levels - 1);
    }

    /* Surface kind for gameplay: 0 ground, 1 water, 2 lava, 3 void (cloud), 4 riverbed, 5 out-of-bounds */
    kindAt(x, y) {
      if (x < 0 || y < 0 || x > this.W || y > this.H) return 5;
      const f = this.field(x, y, this._f);
      return this.kindOf(f[0], f[2]);
    }
    kindOf(h, s) {
      const T = this.T;
      if (T.lava && s < T.lava.width) return 2;
      if (this.sea >= 0 && h < this.sea) return this.type === 'clouds' ? 3 : 1;
      if (T.river && s < T.river.width) return 4;
      return 0;
    }
    /* Cached coarse kind lookup (32px cells) for AI pathing. */
    kindFast(x, y) {
      const gx = Math.floor(x / 32) + 1, gy = Math.floor(y / 32) + 1;
      if (gx < 0 || gy < 0 || gx >= this.tgW || x > this.W || y > this.H || x < 0 || y < 0) return 5;
      const i = gy * this.tgW + gx;
      let k = this.typeGrid[i];
      if (k === 255) { k = this.kindAt((gx - 1) * 32 + 16, (gy - 1) * 32 + 16); this.typeGrid[i] = k; }
      return k;
    }
    groundPassable(x, y, amphibious) {
      const k = this.kindFast(x, y);
      if (k === 5 || k === 3 || k === 2) return false;
      if (k === 1 && !amphibious) return this.world.terrain.water && this.world.terrain.water.frozen;
      return true;
    }
    isWater(x, y) { return this.kindFast(x, y) === 1; }

    /* ---------- chunk rasterisation ---------- */
    getChunk(cx, cy) {
      this.texel();
      const key = cx * 10000 + cy;
      let ch = this.cache.get(key);
      if (ch) { ch.used = this.frame; return ch.cv; }
      let cv;
      if (this.pending && this.pending.key === key) {
        let r; do { r = this.pending.it.next(); } while (!r.done);
        cv = r.value; this.pending = null;
      } else {
        const it = this.genChunk(cx, cy, 1);
        let r; do { r = it.next(); } while (!r.done);
        cv = r.value;
      }
      this.store(key, cx, cy, cv);
      return cv;
    }
    store(key, cx, cy, cv) {
      this.cache.set(key, { cv, used: this.frame });
      const ss = this.sdecals.get(key);
      if (ss) for (const d of ss) this.paintDecal(cv, cx, cy, d);
      const ds = this.decals.get(key);
      if (ds) for (const d of ds) this.paintDecal(cv, cx, cy, d);
      if (this.cache.size > this.maxCache) this.evict();
    }
    /* Incrementally generate queued chunks within a time budget (ms). */
    work(budget, queue) {
      this.texel();
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        if (!this.pending) {
          let next = null;
          while (queue.length) { const q = queue.shift(); if (!this.cache.has(q[0] * 10000 + q[1])) { next = q; break; } }
          if (!next) return;
          this.pending = { key: next[0] * 10000 + next[1], cx: next[0], cy: next[1], it: this.genChunk(next[0], next[1]) };
        }
        const r = this.pending.it.next();
        if (r.done) { this.store(this.pending.key, this.pending.cx, this.pending.cy, r.value); this.pending = null; }
      }
    }
    hasChunk(cx, cy) { return this.cache.has(cx * 10000 + cy); }
    evict() {
      let oldest = null, ok = null;
      for (const [k, v] of this.cache) if (!oldest || v.used < oldest.used) { oldest = v; ok = k; }
      if (ok !== null) this.cache.delete(ok);
    }

    /* Texels per world unit that chunks are rasterised at — matched to the renderer
     * so chunk blits are 1:1 (and crisp); 1 at low quality. Changing it drops the
     * chunk cache (decals are kept and repainted). */
    texel() {
      const R = AS.Renderer;
      const td = R && !R.pixelated && R.res ? R.res : 1;
      if (td !== this.TD) {
        this.TD = td; this.cache.clear(); this.pending = null; this._bufs = null;
        this.maxCache = td > 1.5 ? 56 : td > 1.01 ? 80 : 150;
      }
      return td;
    }

    bufs(slot) {
      this._bufs = this._bufs || [];
      if (!this._bufs[slot]) {
        const TD = this.TD;
        const topW = Math.ceil((this.F * 2.2 * 1.6 + 8) / G) * G; // world rows rasterised above the chunk
        // margins on every side so shading that samples neighbours (hillshade, shadows,
        // occlusion, lips) sees real terrain across chunk borders and stays seamless
        const ML = Math.ceil(18 * TD), MR = Math.ceil(6 * TD), MB = Math.ceil(7 * TD);
        const N = Math.round(CH * TD), top = Math.round(topW * TD), rows = N + top + MB, NW = N + ML + MR;
        const GL = 3; // grid cells left of the chunk (covers ML)
        const gw = CH / G + GL + 3, gh = Math.ceil((CH + topW + 8) / G) + 3, NG = gw * gh;
        const T = NW * rows;
        this._bufs[slot] = {
          TD, N, top, topW, rows, ML, MR, MB, NW, GL, gw, gh,
          GH: new Float32Array(NG), GM: new Float32Array(NG), GS: new Float32Array(NG), GX: new Float32Array(NG), GA: new Float32Array(NG),
          L: new Int8Array(T), HH: new Float32Array(T), SS: new Float32Array(T), MM: new Float32Array(T), XX: new Float32Array(T), AA: new Float32Array(T),
          cnt: new Int16Array(NW), dropL: new Int8Array(NW), faceH: new Float32Array(NW), faceNX: new Float32Array(NW), out: [0, 0, 0],
        };
      }
      return this._bufs[slot];
    }

    *genChunk(cx, cy, slot) {
      this.texel();
      const st = this.bufs(slot || 0);
      const TD = st.TD, N = st.N;
      st.cx = cx; st.cy = cy; st.x0 = cx * CH; st.y0 = cy * CH;
      for (let j = 0; j < st.gh; j += 12) { this._grid(st, j, Math.min(st.gh, j + 12)); yield null; }
      const upStep = Math.max(16, Math.round(72 / (TD * TD)));
      for (let y = 0; y < st.rows; y += upStep) { this._up(st, y, Math.min(st.rows, y + upStep)); yield null; }
      const cv = AS.Forge.canvas(N, N);
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(N, N);
      st.D = img.data;
      st.cnt.fill(0); st.dropL.fill(-9); st.faceH.fill(0); st.faceNX.fill(0);
      const shStep = Math.max(10, Math.round(44 / (TD * TD)));
      for (let y = 1; y < st.rows; y += shStep) { this._shade(st, y, Math.min(st.rows, y + shStep)); yield null; }
      ctx.putImageData(img, 0, 0);
      st.D = null;
      yield null;
      this.stampDecor(ctx, cx, cy, st);
      return cv;
    }

    _grid(st, j0, j1) {
      const f = this._f, gw = st.gw, sd = this.seed;
      const gx0 = st.x0 - G * (st.GL + 1), gy0 = st.y0 - st.topW - G;
      for (let j = j0; j < j1; j++) for (let i = 0; i < gw; i++) {
        const wx = gx0 + i * G, wy = gy0 + j * G;
        this.field(wx, wy, f);
        const k = j * gw + i;
        st.GH[k] = f[0]; st.GM[k] = f[1]; st.GS[k] = f[2]; st.GX[k] = f[3];
        // large soft albedo variation (soil patches) + a finer mottling
        st.GA[k] = U.noise2(wx / 260, wy / 260, sd + 101) * 0.7 + U.noise2(wx / 64, wy / 64, sd + 102) * 0.3;
      }
    }

    _up(st, y0, y1) {
      const { GH, GM, GS, GX, GA, HH, SS, MM, XX, AA, L, gw, NW, ML, TD, GL } = st;
      const sea = this.sea, levels = this.levels, invG = 1 / G, inv = 1 / TD;
      const seaK = sea >= 0 ? (levels * 1.15) / (1 - sea) : 0;
      for (let y = y0; y < y1; y++) {
        const fy = ((y + 0.5) * inv + G) * invG; const j = fy | 0, ty = fy - j;
        for (let xi = 0; xi < NW; xi++) {
          const fx = ((xi - ML + 0.5) * inv + G * (GL + 1)) * invG; const i = fx | 0, tx = fx - i;
          const k = j * gw + i, k2 = k + gw;
          const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
          const p = y * NW + xi;
          const h = GH[k] * a + GH[k + 1] * b + GH[k2] * c + GH[k2 + 1] * d;
          HH[p] = h;
          SS[p] = GS[k] * a + GS[k + 1] * b + GS[k2] * c + GS[k2 + 1] * d;
          MM[p] = GM[k] * a + GM[k + 1] * b + GM[k2] * c + GM[k2 + 1] * d;
          XX[p] = GX[k] * a + GX[k + 1] * b + GX[k2] * c + GX[k2 + 1] * d;
          AA[p] = GA[k] * a + GA[k + 1] * b + GA[k2] * c + GA[k2 + 1] * d;
          let l;
          if (sea >= 0) { if (h < sea) l = -1; else { l = ((h - sea) * seaK) | 0; if (l > levels - 1) l = levels - 1; } }
          else { l = (h * levels) | 0; if (l < 0) l = 0; else if (l > levels - 1) l = levels - 1; }
          L[p] = l;
        }
      }
    }

    _shade(st, y0, y1) {
      const { L, HH, SS, MM, XX, AA, cnt, dropL, faceH, faceNX, D, out, top, rows, x0: cx0, y0: cy0, N, NW, ML, TD } = st;
      const inv = 1 / TD;
      const F = this.F, clouds = this.type === 'clouds';
      const faceCol = this.col.face, faceDark = this.col.faceDark, lip = this.col.lip;
      const faceCloud = C.mix(faceCol, faceDark, 0.3);
      const shadowA = this.world.light.shadow !== undefined ? this.world.light.shadow : 0.3;
      const seed = this.seed, W = this.W, H = this.H, NR = NW * rows;
      const d3 = Math.max(1, Math.round(3 * TD)), d5 = Math.max(1, Math.round(5 * TD));
      const s1 = Math.max(1, Math.round(4 * TD)), s2 = Math.max(2, Math.round(9 * TD)), s3 = Math.max(3, Math.round(15 * TD));
      const ao = Math.max(1, Math.round(3.5 * TD));
      const lipW = Math.max(1, Math.round(TD * 1.2));
      const baseBand = 4 * TD;
      const D1 = NW + 1;
      for (let y = y0; y < y1; y++) {
        for (let xi = 0; xi < NW; xi++) {
          const p = y * NW + xi;
          const l = L[p], lu = L[p - NW];
          let c = cnt[xi];
          if (lu > l) {
            c = 1; dropL[xi] = lu;
            faceH[xi] = Math.min(F * 2.2, F * (lu - (l < -1 ? -1 : l)) * (l < 0 && clouds ? 1.6 : 1)) * TD;
            // which way the wall faces, from the height gradient along the plateau edge
            const pl = p - NW;
            faceNX[xi] = (HH[xi > d3 ? pl - d3 : pl] - HH[xi < NW - d3 ? pl + d3 : pl]) * 24;
          } else if (c > 0) { if (l < dropL[xi] && c < faceH[xi] + baseBand) c++; else c = 0; }
          cnt[xi] = c;
          const x = xi - ML;
          if (y < top || y >= top + N || x < 0 || x >= N) continue;
          const fh = faceH[xi];
          const py = y - top;
          const wx = cx0 + (x + 0.5) * inv, wy = cy0 + (py + 0.5) * inv;
          const pa = p - NW * d5 - d5, pb = p + NW * d5 + d5;
          this.colorize(wx, wy, HH[p], MM[p], SS[p], XX[p], l, out, (XX[pa >= 0 ? pa : p] - XX[pb < NR ? pb : p]) * 9);
          let r = out[0], g = out[1], b = out[2];
          // hillshade along the light direction (top-left) from the continuous height
          const pu = p - D1 * d3, pd = p + D1 * d3;
          let hs = (HH[pu >= 0 ? pu : p] - HH[pd < NR ? pd : p]) * 6.5;
          hs = hs < -0.22 ? -0.22 : hs > 0.26 ? 0.26 : hs;
          let sh = (1 + hs) * (1 + AA[p] * 0.09);
          const onFace = c > 0 && c <= fh;
          if (onFace) {
            const t = c / fh;
            const band = ((c * inv + dropL[xi] * 7) / 2.6) | 0;
            const strata = (U.hash2(band, dropL[xi], seed) - 0.5) * 0.2;
            const ck = U.hash2((wx * 0.8) | 0, band >> 1, seed + 1);
            const vert = ck > 0.92 ? -0.18 : (ck - 0.5) * 0.06;
            const c0 = l < 0 && clouds ? faceCloud : faceCol;
            const tt = t * 0.8;
            r = c0[0] + (faceDark[0] - c0[0]) * tt; g = c0[1] + (faceDark[1] - c0[1]) * tt; b = c0[2] + (faceDark[2] - c0[2]) * tt;
            const facing = faceNX[xi] < -1 ? -1 : faceNX[xi] > 1 ? 1 : faceNX[xi];
            sh = 1 + strata + vert - facing * 0.2 + (t < 0.1 ? 0.1 : 0) - (t > 0.88 ? 0.16 : 0);
            if (l < 0 && clouds && t > 0.6) {
              const qq = (t - 0.6) / 0.4;
              this.colorize(wx, wy, HH[p], MM[p], SS[p], XX[p], -1, out, 0);
              r += (out[0] - r) * qq; g += (out[1] - g) * qq; b += (out[2] - b) * qq;
            }
          } else if (c > fh) {
            // contact shadow at the foot of the wall
            sh *= 0.58 + (c - fh) * inv * 0.085;
          } else if (y + lipW < rows && L[p + NW * lipW] < l) {
            // lip: the sunlit edge of a plateau
            r += (lip[0] - r) * 0.6; g += (lip[1] - g) * 0.6; b += (lip[2] - b) * 0.6; sh *= 1.05;
          } else {
            // cast shadow from higher ground (light from the top-left), softer further out
            let shade = 0;
            if (p - D1 * s3 >= 0) {
              if (L[p - D1 * s1] > l) shade = 0.62;
              else if (L[p - D1 * s2] > l) shade = 0.42;
              else if (L[p - D1 * s3] > l) shade = 0.2;
            }
            // ambient occlusion beside walls to the left and right
            if (L[p - ao] > l || L[p + ao] > l) shade = Math.max(shade, 0.26);
            else if (L[p - 1] !== l) sh *= L[p - 1] > l ? 0.85 : 1.08;
            sh *= 1 - shade * shadowA * 1.5;
          }
          // fine grain and sparse gravel (no isolated bright specks)
          if (!onFace && l >= 0) {
            const hn = U.hash2((wx * 2.2) | 0, (wy * 2.2) | 0, seed + 9);
            if (hn > 0.988 && AA[p] > -0.1) sh *= hn > 0.995 ? 1.12 : 0.74;
            else sh *= 0.975 + hn * 0.05;
          }
          if (wx < 0 || wy < 0 || wx > W || wy > H) {
            const dd = Math.max(-wx, -wy, wx - W, wy - H);
            let k = 0.75 - dd / 500; k = k < 0.2 ? 0.2 : k > 0.75 ? 0.75 : k;
            sh *= k; r += (40 - r) * 0.3; g += (30 - g) * 0.3; b += (50 - b) * 0.3;
          }
          const q = (py * N + x) * 4;
          D[q] = r * sh; D[q + 1] = g * sh; D[q + 2] = b * sh; D[q + 3] = 255;
        }
      }
    }

    /* Type-specific base colouring. l = terrace level (-1 water/void). */
    colorize(x, y, h, m, s, ex, l, out, lit) {
      lit = lit || 0;
      const col = this.col, T = this.T;
      const ramp = col.ramp;
      let c;
      if (l >= 0) {
        c = ramp[Math.min(l, ramp.length - 1)];
        const altT = U.clamp((m - 0.62) * 3, 0, 1) * T.altAmt * 2;
        out[0] = U.lerp(c[0], col.alt[0], altT); out[1] = U.lerp(c[1], col.alt[1], altT); out[2] = U.lerp(c[2], col.alt[2], altT);
      }
      switch (this.type) {
        case 'terraces': {
          if (T.river) {
            const rw = T.river.width, rc = col.river;
            if (s < rw) {
              // dry riverbed: smooth pale sand, damp darker banks, faint mud cracks in the centre only
              const bank = U.smoothstep(rw * 0.55, rw, s);
              out[0] = U.lerp(rc.c[0], rc.d[0], bank * 0.85); out[1] = U.lerp(rc.c[1], rc.d[1], bank * 0.85); out[2] = U.lerp(rc.c[2], rc.d[2], bank * 0.85);
              if (s < rw * 0.5 && U.ridged(x / 16, y / 16, 1, this.seed + 33) > 0.94) { out[0] = U.lerp(out[0], rc.k[0], 0.38); out[1] = U.lerp(out[1], rc.k[1], 0.38); out[2] = U.lerp(out[2], rc.k[2], 0.38); }
            } else if (s < rw * 1.5 && l >= 0) {
              // darker damp soil along the banks
              const k = (1 - (s - rw) / (rw * 0.5)) * 0.16;
              out[0] *= 1 - k; out[1] *= 1 - k * 0.9; out[2] *= 1 - k * 0.8;
            }
          }
          break;
        }
        case 'dunes': {
          if (l >= 1) {
            // wind ripples: parallel crests along a fixed wind axis, gently meandering,
            // with a long lit stoss side and a short shadowed slip face; patchy strength
            const u = x * 0.825 + y * 0.565, v = y * 0.825 - x * 0.565;
            const ph = u * T.dune.freq + U.noise2(v / 210, u / 520, this.seed + 95) * 2.6;
            const f = ph / 6.2832 - Math.floor(ph / 6.2832);
            const patch = U.clamp(0.55 + ex * 0.9, 0, 1);
            const k = f > 0.56 && f < 0.7 ? 0.12 : f >= 0.7 && f < 0.8 ? -0.11 : 0;
            const dc = k > 0 ? col.dune.c : col.dune.s;
            const t = Math.abs(k) * 2.5 * U.clamp(l / 2, 0.5, 1) * (patch > 0.35 ? 1 : 0);
            out[0] = U.lerp(out[0], dc[0], t); out[1] = U.lerp(out[1], dc[1], t); out[2] = U.lerp(out[2], dc[2], t);
          } else if (l === 0 && m > 0.55) {
            out[0] = U.lerp(out[0], 216, 0.3); out[1] = U.lerp(out[1], 180, 0.3); out[2] = U.lerp(out[2], 154, 0.3);
          }
          break;
        }
        case 'jungle': {
          if (l < 0) { this.water(x, y, h, out); break; }
          if (ex > 0.02) {
            // dense canopy of individual tree crowns seen from above: each crown is
            // a rounded dome lit from the top-left, with dark gaps between crowns
            const t = U.clamp((ex - 0.02) * 5, 0, 1);
            const CELL = 24, gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), sd = this.seed;
            let best = 1e9, bx = 0, by = 0, br = 1, bh = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
              const cx = gx + i, cy = gy + j, hh = U.hash2(cx, cy, sd + 71);
              const px = (cx + 0.15 + U.hash2(cx, cy, sd + 72) * 0.7) * CELL, py = (cy + 0.15 + U.hash2(cx, cy, sd + 73) * 0.7) * CELL;
              const r = CELL * (0.55 + hh * 0.4), dd = Math.hypot(x - px, y - py) / r;
              if (dd < best) { best = dd; bx = px; by = py; br = r; bh = hh; }
            }
            const cn = col.canopy;
            let r0, g0, b0;
            if (best < 1) {
              const tone = bh;
              r0 = U.lerp(cn.c[0], cn.h[0], tone * 0.6); g0 = U.lerp(cn.c[1], cn.h[1], tone * 0.6); b0 = U.lerp(cn.c[2], cn.h[2], tone * 0.6);
              const litK = ((bx - x) + (by - y)) / (br * 1.41) * 0.32 - best * best * 0.3 + 0.08;
              const leaf = U.hash2((x * 1.3) | 0, (y * 1.3) | 0, sd + 74) * 0.08 - 0.04;
              r0 *= 1 + litK + leaf; g0 *= 1 + litK + leaf; b0 *= 1 + litK * 0.8 + leaf;
            } else { r0 = cn.d[0]; g0 = cn.d[1]; b0 = cn.d[2]; }
            out[0] = U.lerp(out[0], r0, t); out[1] = U.lerp(out[1], g0, t); out[2] = U.lerp(out[2], b0, t);
          }
          break;
        }
        case 'ice': {
          if (l < 0) {
            const w = col.water;
            const d = U.clamp((this.sea - h) * 5, 0, 1);
            out[0] = U.lerp(w.shallow[0], w.deep[0], d); out[1] = U.lerp(w.shallow[1], w.deep[1], d); out[2] = U.lerp(w.shallow[2], w.deep[2], d);
            if (ex > 0.92) { out[0] = w.foam[0]; out[1] = w.foam[1]; out[2] = w.foam[2]; }
            else {
              // sea ice: pale wind-polished plates, frost drifts and dark pressure cracks
              const drift = U.clamp(U.noise2(x / 140, y / 110, this.seed + 41) * 1.4, 0, 1) * 0.35 + 0.12;
              out[0] = U.lerp(out[0], w.foam[0], drift); out[1] = U.lerp(out[1], w.foam[1], drift); out[2] = U.lerp(out[2], w.foam[2], drift);
              const ck = U.ridged(x / 110, y / 110, 2, this.seed + 40);
              if (ck > 0.955) { const k = (ck - 0.955) * 14; out[0] *= 1 - k * 0.45; out[1] *= 1 - k * 0.35; out[2] *= 1 - k * 0.25; }
              else if (ck > 0.93) { out[0] += 10; out[1] += 12; out[2] += 12; }
            }
          } else if (ex > 0.95 && l < 2) { out[0] *= 0.7; out[1] *= 0.8; out[2] *= 0.9; }
          break;
        }
        case 'ocean': {
          if (l < 0) { this.water(x, y, h, out); break; }
          if (h < this.sea + 0.03) { const sd = rgb(T.ramp[0]); out[0] = sd[0]; out[1] = sd[1]; out[2] = sd[2]; }
          break;
        }
        case 'lava': {
          if (s < T.lava.width) {
            const k = s / T.lava.width;
            const L2 = col.lava;
            const flick = U.fbm(x / 22, y / 22, 2, this.seed + 55) * 0.5 + 0.5;
            let cc;
            if (k < 0.35 + flick * 0.15) cc = C.mix(L2.hot, L2.mid, k * 1.6);
            else if (k < 0.8) cc = C.mix(L2.mid, L2.crust, (k - 0.4) * 2);
            else cc = L2.crust;
            if (U.ridged(x / 18, y / 18, 1, this.seed + 56) > 0.9 && k > 0.3) cc = C.mix(cc, [40, 16, 10], 0.7);
            out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2];
          } else {
            if (m > 0.7) { out[0] = U.lerp(out[0], 90, 0.4); out[1] = U.lerp(out[1], 84, 0.4); out[2] = U.lerp(out[2], 82, 0.4); }
            // heat glow on the ground beside the lava
            if (s < T.lava.width * 2.4) { const k = U.clamp(1 - (s - T.lava.width) / (T.lava.width * 1.4), 0, 1); const w2 = k * k * 0.55; out[0] += 150 * w2; out[1] += 46 * w2; out[2] += 8 * w2; }
          }
          break;
        }
        case 'moon': {
          const k = U.clamp(ex, -0.6, 0.6);
          out[0] *= 1 + k * 0.62; out[1] *= 1 + k * 0.62; out[2] *= 1 + k * 0.55;
          // sunlit crater walls and rims pick up the pale lip colour
          if (k > 0.12) { const t = (k - 0.12) * 0.9; out[0] = U.lerp(out[0], col.lip[0], t); out[1] = U.lerp(out[1], col.lip[1], t); out[2] = U.lerp(out[2], col.lip[2], t); }
          const fz = (m - 0.55) * 0.9;
          if (fz > 0.12 && l >= 0) {
            const fc = fz > 0.25 ? col.fungus.b : col.fungus.a;
            const t = U.clamp((fz - 0.12) * 5, 0, 0.85);
            out[0] = U.lerp(out[0], fc[0], t); out[1] = U.lerp(out[1], fc[1], t); out[2] = U.lerp(out[2], fc[2], t);
            if (U.hash2(x, y, this.seed + 62) > 0.992) { out[0] = col.fungus.dot[0]; out[1] = col.fungus.dot[1]; out[2] = col.fungus.dot[2]; }
          }
          break;
        }
        case 'clouds': {
          if (l < 0) {
            const cl = col.cloud;
            const v = U.clamp(ex * 1.6 + 0.5, 0, 1);
            const lt = U.clamp(lit * 0.6, -1, 1);
            const i = Math.min(2, Math.floor(v * 3));
            const cc = C.mix(cl[i], cl[i + 1], (v * 3) % 1);
            const k = 1 + lt * 0.18;
            out[0] = cc[0] * k; out[1] = cc[1] * k; out[2] = cc[2] * k;
          }
          break;
        }
        case 'metal': {
          const M = T.metal, g = M.grid, mc = col.metal;
          const gx = Math.floor(x / g), gy = Math.floor(y / g);
          const lx = x - gx * g, ly = y - gy * g;
          const v = (U.hash2(gx, gy, this.seed) - 0.5) * 0.16;
          out[0] *= 1 + v; out[1] *= 1 + v; out[2] *= 1 + v;
          if (U.hash2(gx, gy, this.seed + 1) > 0.8) { out[0] = U.lerp(out[0], 106, 0.35); out[1] = U.lerp(out[1], 74, 0.35); out[2] = U.lerp(out[2], 58, 0.35); }
          if (lx < 1 || ly < 1) { out[0] = mc.seam[0]; out[1] = mc.seam[1]; out[2] = mc.seam[2]; }
          else if ((Math.abs(lx - 3.5) < 0.9 || Math.abs(lx - (g - 3.5)) < 0.9) && (Math.abs(ly - 3.5) < 0.9 || Math.abs(ly - (g - 3.5)) < 0.9)) { out[0] = mc.rivet[0]; out[1] = mc.rivet[1]; out[2] = mc.rivet[2]; }
          else if (U.hash2(gx, gy, this.seed + 2) > 0.86 && ly > 8 && ly < g - 8 && lx > 8 && lx < g - 8 && (((ly + lx) | 0) % 4 === 0)) { out[0] *= 0.6; out[1] *= 0.6; out[2] *= 0.65; }
          // power conduits along selected grid lines
          const cxl = U.hash2(gx, 0, this.seed + 3) > 0.82, cyl = U.hash2(0, gy, this.seed + 4) > 0.82;
          if ((cxl && lx >= g / 2 - 1 && lx <= g / 2 + 1) || (cyl && ly >= g / 2 - 1 && ly <= g / 2 + 1)) {
            const cc = U.hash2(gx + gy, 1, this.seed + 5) > 0.5 ? mc.c1 : mc.c2;
            const pulse = (Math.abs(lx - g / 2) < 0.6 || Math.abs(ly - g / 2) < 0.6) ? 1 : 0.55;
            out[0] = U.lerp(out[0], cc[0], pulse); out[1] = U.lerp(out[1], cc[1], pulse); out[2] = U.lerp(out[2], cc[2], pulse);
          }
          break;
        }
        case 'sanctum': {
          const g = 32;
          const lx = ((x % g) + g) % g, ly = ((y % g) + g) % g;
          const v = (U.hash2(Math.floor(x / g), Math.floor(y / g), this.seed) - 0.5) * 0.1;
          out[0] *= 1 + v; out[1] *= 1 + v; out[2] *= 1 + v;
          if (lx === 0 || ly === 0) { out[0] *= 0.82; out[1] *= 0.82; out[2] *= 0.8; }
          const cg = T.channel.grid;
          const ax = Math.abs(((x % cg) + cg) % cg - cg / 2), ay = Math.abs(((y % cg) + cg) % cg - cg / 2);
          const cxi = Math.floor(x / cg), cyi = Math.floor(y / cg);
          const ring = U.hash2(cxi, cyi, this.seed + 12) > 0.82 ? Math.abs(Math.hypot(ax, ay) - cg * 0.3) : 9;
          const onLine = (ax < 1.2 && U.hash2(cxi, 7, this.seed) > 0.72 && U.hash2(cxi, cyi, 5) > 0.3) || (ay < 1.2 && U.hash2(7, cyi, this.seed) > 0.72 && U.hash2(cxi, cyi, 6) > 0.3) || ring < 1;
          if (onLine && l >= 1) { const cc = U.hash2(Math.floor(x / cg), Math.floor(y / cg), 11) > 0.6 ? col.channel.b : col.channel.a; out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2]; }
          if (ex > 0.18 && !onLine) {
            const t = U.clamp((ex - 0.18) * 4, 0, 0.9);
            const vein = U.ridged(x / 30, y / 30, 2, this.seed + 7) > 0.88;
            out[0] = U.lerp(out[0], vein ? 150 : 96, t); out[1] = U.lerp(out[1], vein ? 70 : 42, t); out[2] = U.lerp(out[2], vein ? 100 : 58, t);
          }
          break;
        }
      }
      if (l < 0 && this.type !== 'jungle' && this.type !== 'ice' && this.type !== 'ocean' && this.type !== 'clouds') this.water(x, y, h, out);
    }

    water(x, y, h, out) {
      const w = this.col.water;
      if (!w) { out[0] = 30; out[1] = 50; out[2] = 70; return; }
      const d = U.clamp((this.sea - h) * 6, 0, 1);
      out[0] = U.lerp(w.shallow[0], w.deep[0], d); out[1] = U.lerp(w.shallow[1], w.deep[1], d); out[2] = U.lerp(w.shallow[2], w.deep[2], d);
      if (d < 0.08) { const t = (0.08 - d) * 9; out[0] = U.lerp(out[0], w.foam[0], t); out[1] = U.lerp(out[1], w.foam[1], t); out[2] = U.lerp(out[2], w.foam[2], t); }
      if (w.ruins) {
        // drowned city blocks visible beneath the surface
        const bs = 120, bx = Math.floor(x / bs), by = Math.floor(y / bs);
        const lx = x - bx * bs, ly = y - by * bs;
        if (U.hash2(bx, by, this.seed + 21) > 0.45 && lx > 14 && ly > 14 && lx < bs - 14 && ly < bs - 14) {
          const inner = (lx % 26 < 2 || ly % 26 < 2) ? 0.65 : 0.35;
          out[0] = U.lerp(out[0], w.ruins[0], inner * (1 - d * 0.4)); out[1] = U.lerp(out[1], w.ruins[1], inner * (1 - d * 0.4)); out[2] = U.lerp(out[2], w.ruins[2], inner * (1 - d * 0.4));
        }
      }
      // wind-driven wave crests and broad sky reflections
      const wv = Math.sin((x * 0.6 + y * 0.8) / 6.5 + U.noise2(x / 110, y / 110, this.seed + 23) * 7);
      const crest = wv > 0.8 ? (wv - 0.8) * 5 : wv < -0.85 ? (wv + 0.85) * 3 : 0;
      const broad = U.noise2(x / 320, y / 260, this.seed + 24) * 0.07;
      const k = 1 + broad + crest * 0.11 * (1 - d * 0.4);
      out[0] *= k; out[1] *= k; out[2] *= k;
      if (U.hash2(x >> 1, y, this.seed + 22) > 0.993) { out[0] += 40; out[1] += 50; out[2] += 50; }
    }

    /* ---------- decor: composed formations instead of an even scatter ----------
     * Rocks gather in clusters seeded from a world-space jittered grid (one large
     * formation, a few medium rocks, a spray of small stones and some vegetation),
     * so every chunk boundary is seamless. A few singles break up open ground. Base
     * zones stay clear and nothing is placed on walls, water or uneven ground. */
    buildDecorSets() {
      const wd = this.world, sets = { sheets: {}, any: false, big: null, med: null, small: null, veg: null, debris: null };
      const find = (...ks) => { for (const k of ks) { const d = wd.decor.find((e) => e.k === k); if (d) return d; } return null; };
      const mk = (name, kind, pal, n) => {
        sets.sheets[name] = [];
        for (let v = 0; v < n; v++) sets.sheets[name].push(AS.Forge.sheet('decor2:' + wd.key + ':' + kind + ':' + v + ':' + JSON.stringify(pal || {}), () => AS.Models.decor(kind, pal, v * 13 + 3), 1, 1));
        sets.any = true;
      };
      const rock = find('rock'), boulder = find('boulder'), crystal = find('crystal');
      const veg = find('tuft', 'shroomlet'), debris = find('bones', 'scrap', 'panel');
      let rockD = (rock ? rock.d : 0) + (boulder ? boulder.d * 2 : 0) + (crystal ? crystal.d : 0);
      if (rock || boulder) {
        const pal = (rock || boulder).pal, bpal = (boulder || rock).pal;
        mk('big', 'formation', bpal, 4); mk('med', 'rock', pal, 5); mk('small', 'pebbles', pal, 5);
        sets.big = 'big'; sets.med = 'med'; sets.small = 'small';
      }
      if (crystal) { mk('crys', 'crystal', crystal.pal, 4); if (!sets.med) { sets.med = 'crys'; sets.small = 'crys'; } else sets.accent = 'crys'; }
      if (veg) { mk('veg', veg.k, veg.pal, 5); sets.veg = 'veg'; }
      if (debris) { mk('deb', debris.k, debris.pal, 3); sets.debris = 'deb'; if (!sets.med) { sets.med = 'deb'; sets.small = 'deb'; rockD += debris.d * 2; } }
      sets.clusterP = U.clamp(rockD / 22, 0.1, 0.55);
      sets.single = Math.min(7, rockD * 0.22 + (veg ? veg.d * 0.3 : 0));
      sets.vegN = veg ? U.clamp(veg.d / 6, 0.5, 5) : 0;
      sets.debrisP = debris ? U.clamp(debris.d / 4, 0.1, 0.5) : 0;
      return sets;
    }
    atCliffFoot(x, y) {
      const f = this._fd || (this._fd = new Float32Array(4));
      this.field(x, y, f); const l = this.levelOf(f[0]);
      for (const [dx, dy] of [[0, -34], [-26, -20], [26, -20], [0, -60]]) { this.field(x + dx, y + dy, f); if (this.levelOf(f[0]) > l) return true; }
      return false;
    }
    decorOK(x, y, r) {
      if (x < 4 || y < 4 || x > this.W - 4 || y > this.H - 4) return false;
      for (const z of this.zones) { const dx = x - z.x, dy = y - z.y; if (dx * dx + dy * dy < (z.r * 0.95 + r) * (z.r * 0.95 + r)) return false; }
      for (const z of this.clearAreas) { const dx = x - z.x, dy = (y - z.y) / 0.8; if (dx * dx + dy * dy < (z.r + r) * (z.r + r)) return false; }
      for (const sg of this.clearSegs) if (U.segDist(x, y, sg[0], sg[1], sg[2], sg[3]) < sg[4] + r) return false;
      const f = this._fd || (this._fd = new Float32Array(4));
      this.field(x, y, f);
      const l = this.levelOf(f[0]);
      if (l < 0 || this.kindOf(f[0], f[2]) !== 0) return false;
      const rr = Math.max(4, r * 0.8);
      for (const [dx, dy] of [[rr, 0], [-rr, 0], [0, rr], [0, -rr * 1.4]]) { this.field(x + dx, y + dy, f); if (this.levelOf(f[0]) !== l || this.kindOf(f[0], f[2]) !== 0) return false; }
      return true;
    }
    stampDecor(ctx, cx, cy, st) {
      if (!this.decorSets) this.decorSets = this.buildDecorSets();
      const ds = this.decorSets;
      if (!ds.any) return;
      const TD = st.TD, q = (AS.Settings && AS.Settings.quality === 'low') ? 0.6 : 1;
      const x0 = cx * CH, y0 = cy * CH, CELL = 150, M = 44;
      const items = [];
      const add = (k, x, y, v, r) => { if (k && ds.sheets[k]) items.push({ k, x, y, v, r }); };
      for (let gy = Math.floor((y0 - M) / CELL); gy <= Math.floor((y0 + CH + M) / CELL); gy++) {
        for (let gx = Math.floor((x0 - M) / CELL); gx <= Math.floor((x0 + CH + M) / CELL); gx++) {
          if (U.hash2(gx, gy, this.seed + 300) > ds.clusterP * q) continue;
          const ccx = (gx + 0.2 + U.hash2(gx, gy, this.seed + 301) * 0.6) * CELL;
          const ccy = (gy + 0.2 + U.hash2(gx, gy, this.seed + 302) * 0.6) * CELL;
          // scree gathers at the foot of cliffs; open ground keeps more empty space
          if (!this.atCliffFoot(ccx, ccy) && U.hash2(gx, gy, this.seed + 303) > 0.45) continue;
          const rng = new U.RNG((Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663) ^ this.seed) >>> 0);
          const big = ds.big && rng.next() < 0.8;
          if (big) add(ds.big, ccx, ccy, rng.int(0, 3), 16);
          const nm = rng.int(1, 3) + (big ? 1 : 0);
          for (let i = 0; i < nm; i++) { const a = rng.next() * U.TAU, d = 12 + rng.next() * 14; add(ds.med, ccx + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.75, rng.int(0, 4), 8); }
          if (ds.accent && rng.next() < 0.6) { const a = rng.next() * U.TAU; add(ds.accent, ccx + Math.cos(a) * 16, ccy + Math.sin(a) * 12, rng.int(0, 3), 6); }
          const ns = rng.int(2, 5);
          for (let i = 0; i < ns; i++) { const a = rng.next() * U.TAU, d = 16 + rng.next() * 26; add(ds.small, ccx + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.75, rng.int(0, 4), 4); }
          const nv = Math.round(ds.vegN * rng.next() * 1.4);
          for (let i = 0; i < nv; i++) { const a = rng.next() * U.TAU, d = 10 + rng.next() * 34; add(ds.veg, ccx + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.8, rng.int(0, 4), 5); }
          if (rng.next() < ds.debrisP) add(ds.debris, ccx + (rng.next() - 0.5) * 60, ccy + (rng.next() - 0.5) * 40, rng.int(0, 2), 6);
        }
      }
      const rng = new U.RNG((cx * 7919 + cy * 104729 + this.seed) >>> 0);
      const nSingle = Math.round(ds.single * q * (0.6 + rng.next() * 0.8));
      for (let i = 0; i < nSingle; i++) add(ds.veg && rng.next() < 0.55 ? ds.veg : ds.small, x0 + rng.next() * CH, y0 + rng.next() * CH, rng.int(0, 4), 4);
      items.sort((a, b) => a.y - b.y);
      ctx.save();
      ctx.scale(TD, TD);
      ctx.imageSmoothingEnabled = true;
      for (const it of items) {
        if (it.x < x0 - 34 || it.x > x0 + CH + 34 || it.y < y0 - 34 || it.y > y0 + CH + 40) continue;
        if (!this.decorOK(it.x, it.y, it.r)) continue;
        const list = ds.sheets[it.k], sh = list[it.v % list.length];
        const lx = it.x - x0, ly = it.y - y0;
        ctx.globalAlpha = 0.34; ctx.drawImage(sh.shadows[0], lx - sh.ax + 2.4, ly - sh.ay + 1.4, sh.w, sh.h);
        ctx.globalAlpha = 1; ctx.drawImage(sh.frames[0][0], lx - sh.ax, ly - sh.ay, sh.w, sh.h);
      }
      ctx.restore();
    }

    /* ---------- decals baked into chunks ----------
     * Dynamic decals (scorch, craters, splats) are capped per chunk; static ones
     * (landmark sites, roads, foundations) are permanent and painted first. */
    addDecal(kind, x, y, r, col, opts) {
      const d = Object.assign({ kind, x, y, r, col, seed: (Math.random() * 1e6) | 0 }, opts || {});
      const st = !!d.static, map = st ? this.sdecals : this.decals;
      const bb = AS.Decals.bounds(d);
      const c0 = Math.floor(bb[0] / CH), c1 = Math.floor(bb[2] / CH);
      const r0 = Math.floor(bb[1] / CH), r1 = Math.floor(bb[3] / CH);
      for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) {
        const key = cx * 10000 + cy;
        let list = map.get(key);
        if (!list) { list = []; map.set(key, list); }
        list.push(d);
        if (!st && list.length > 60) list.shift();
        const ch = this.cache.get(key);
        if (ch) this.paintDecal(ch.cv, cx, cy, d);
      }
      return d;
    }
    paintDecal(cv, cx, cy, d) {
      const ctx = cv.getContext('2d');
      ctx.save();
      ctx.scale(cv.width / CH, cv.height / CH);
      AS.Decals.paint(ctx, d, cx * CH, cy * CH);
      ctx.restore();
    }

    /* Low-res colour map for the tactical display. */
    buildMap(scale) {
      const w = Math.ceil(this.W / scale), h = Math.ceil(this.H / scale);
      const cv = AS.Forge.canvas(w, h);
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(w, h);
      const D = img.data, f = new Float32Array(4), out = [0, 0, 0];
      let prevRow = new Float32Array(w);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const x = i * scale + scale / 2, y = j * scale + scale / 2;
          this.field(x, y, f);
          const l = this.levelOf(f[0]);
          this.colorize(x, y, f[0], f[1], f[2], f[3], l, out);
          const lu = j > 0 ? prevRow[i] : l;
          const k = lu > l ? 0.7 : lu < l ? 1.15 : 1;
          prevRow[i] = l;
          const q = (j * w + i) * 4;
          D[q] = out[0] * k; D[q + 1] = out[1] * k; D[q + 2] = out[2] * k; D[q + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return cv;
    }
  }

  Terrain.CH = CH;
  AS.Terrain = Terrain;
})(window.AS);
