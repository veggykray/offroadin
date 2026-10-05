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
      const f = new Float32Array(4);
      // The zone takes the terrace level most of its footprint already sits on, at
      // that level's centre height, so its rim never hovers on a level threshold
      // (which made ragged, stair-stepped edges).
      const votes = new Map();
      for (const z of this.zones) {
        if (z.h !== null) continue;
        votes.clear();
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
        if (d < 1.25) {
          // inner bowl shading: lit on the far (south-east) inner wall
          if (d < 1) v += ((dx + dy) / (r * 1.41)) * 0.9 * (1 - d * d) - 0.25 * (1 - d);
          else v += (1.25 - d) * 1.4; // rim
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
      const ds = this.decals.get(key);
      if (ds) for (const d of ds) this.paintDecal(cv, cx, cy, d);
      if (this.cache.size > this.maxCache) this.evict();
    }
    /* Incrementally generate queued chunks within a time budget (ms). */
    work(budget, queue) {
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

    bufs(slot) {
      this._bufs = this._bufs || [];
      if (!this._bufs[slot]) {
        const top = Math.ceil((this.F * 2.2 * 1.6 + 8) / G) * G;
        const rows = CH + top;
        const gw = CH / G + 3, gh = rows / G + 3, N = gw * gh;
        this._bufs[slot] = {
          top, rows, gw, gh,
          GH: new Float32Array(N), GM: new Float32Array(N), GS: new Float32Array(N), GX: new Float32Array(N),
          L: new Int8Array(CH * rows), HH: new Float32Array(CH * rows), SS: new Float32Array(CH * rows),
          MM: new Float32Array(CH * rows), XX: new Float32Array(CH * rows),
          cnt: new Int16Array(CH), dropL: new Int8Array(CH), faceH: new Float32Array(CH), out: [0, 0, 0],
        };
      }
      return this._bufs[slot];
    }

    *genChunk(cx, cy, slot) {
      const st = this.bufs(slot || 0);
      st.cx = cx; st.cy = cy; st.x0 = cx * CH; st.y0 = cy * CH;
      for (let j = 0; j < st.gh; j += 12) { this._grid(st, j, Math.min(st.gh, j + 12)); yield null; }
      for (let y = 0; y < st.rows; y += 72) { this._up(st, y, Math.min(st.rows, y + 72)); yield null; }
      const cv = AS.Forge.canvas(CH, CH);
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(CH, CH);
      st.D = img.data;
      st.cnt.fill(0); st.dropL.fill(-9); st.faceH.fill(0);
      for (let y = 1; y < st.rows; y += 48) { this._shade(st, y, Math.min(st.rows, y + 48)); yield null; }
      ctx.putImageData(img, 0, 0);
      st.D = null;
      yield null;
      this.stampDecor(ctx, cx, cy, st.L, st.HH, st.SS, st.top);
      return cv;
    }

    _grid(st, j0, j1) {
      const f = this._f, gw = st.gw;
      const gx0 = st.x0 - G, gy0 = st.y0 - st.top - G;
      for (let j = j0; j < j1; j++) for (let i = 0; i < gw; i++) {
        this.field(gx0 + i * G, gy0 + j * G, f);
        const k = j * gw + i;
        st.GH[k] = f[0]; st.GM[k] = f[1]; st.GS[k] = f[2]; st.GX[k] = f[3];
      }
    }

    _up(st, y0, y1) {
      const { GH, GM, GS, GX, HH, SS, MM, XX, L, gw } = st;
      const sea = this.sea, levels = this.levels, invG = 1 / G;
      const seaK = sea >= 0 ? (levels * 1.15) / (1 - sea) : 0;
      for (let y = y0; y < y1; y++) {
        const fy = (y + G) * invG; const j = fy | 0, ty = fy - j;
        for (let x = 0; x < CH; x++) {
          const fx = (x + G) * invG; const i = fx | 0, tx = fx - i;
          const k = j * gw + i, k2 = k + gw;
          const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
          const p = y * CH + x;
          const h = GH[k] * a + GH[k + 1] * b + GH[k2] * c + GH[k2 + 1] * d;
          HH[p] = h;
          SS[p] = GS[k] * a + GS[k + 1] * b + GS[k2] * c + GS[k2 + 1] * d;
          MM[p] = GM[k] * a + GM[k + 1] * b + GM[k2] * c + GM[k2 + 1] * d;
          XX[p] = GX[k] * a + GX[k + 1] * b + GX[k2] * c + GX[k2 + 1] * d;
          let l;
          if (sea >= 0) { if (h < sea) l = -1; else { l = ((h - sea) * seaK) | 0; if (l > levels - 1) l = levels - 1; } }
          else { l = (h * levels) | 0; if (l < 0) l = 0; else if (l > levels - 1) l = levels - 1; }
          L[p] = l;
        }
      }
    }

    _shade(st, y0, y1) {
      const { L, HH, SS, MM, XX, cnt, dropL, faceH, D, out, top, rows, x0: cx0, y0: cy0 } = st;
      const F = this.F, clouds = this.type === 'clouds';
      const faceCol = this.col.face, faceDark = this.col.faceDark, lip = this.col.lip;
      const faceCloud = C.mix(faceCol, faceDark, 0.3);
      const shadowK = 1 - (this.world.light.shadow || 0.3) * 0.9;
      const speck = this.col.speck, seed = this.seed, W = this.W, H = this.H, N = CH * rows;
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < CH; x++) {
          const p = y * CH + x;
          const l = L[p], lu = L[p - CH];
          let c = cnt[x];
          if (lu > l) { c = 1; dropL[x] = lu; faceH[x] = Math.min(F * 2.2, F * (lu - (l < -1 ? -1 : l)) * (l < 0 && clouds ? 1.6 : 1)); }
          else if (c > 0) { if (l < dropL[x] && c < faceH[x] + 4) c++; else c = 0; }
          cnt[x] = c;
          if (y < top) continue;
          const fh = faceH[x];
          const py = y - top;
          const wx = cx0 + x, wy = cy0 + py;
          const pd = x > 0 ? p - CH - 1 : p - CH;
          const pa = p - CH * 5 - (x > 4 ? 5 : x), pb = p + CH * 5 + (x < CH - 5 ? 5 : 0);
          this.colorize(wx, wy, HH[p], MM[p], SS[p], XX[p], l, out, (XX[pa] - XX[pb < N ? pb : p]) * 9);
          let r = out[0], g = out[1], b = out[2];
          const pn = p + CH * 2 < N ? p + CH * 2 : p;
          let hs = (HH[p - CH * 2 >= 0 ? p - CH * 2 : p] - HH[pn]) * 7;
          hs = hs < -0.18 ? -0.18 : hs > 0.22 ? 0.22 : hs;
          let sh = 1 + hs;
          const onFace = c > 0 && c <= fh;
          if (onFace) {
            const t = c / fh;
            const strata = (U.hash2(wx >> 1, ((c + dropL[x] * 7) / 3) | 0, seed) - 0.5) * 0.16;
            const vert = (U.hash2(wx, 0, seed + 1) - 0.5) * 0.12;
            const c0 = l < 0 && clouds ? faceCloud : faceCol;
            const tt = t * 0.85;
            r = c0[0] + (faceDark[0] - c0[0]) * tt; g = c0[1] + (faceDark[1] - c0[1]) * tt; b = c0[2] + (faceDark[2] - c0[2]) * tt;
            sh = 1 + strata + vert - (t > 0.9 ? 0.15 : 0);
            if (l < 0 && clouds && t > 0.6) {
              const q = (t - 0.6) / 0.4;
              this.colorize(wx, wy, HH[p], MM[p], SS[p], XX[p], -1, out, 0);
              r += (out[0] - r) * q; g += (out[1] - g) * q; b += (out[2] - b) * q;
            }
          } else if (c > fh) {
            sh *= 0.62 + (c - fh) * 0.07;
          } else if (y + 1 < rows && L[p + CH] < l) {
            r += (lip[0] - r) * 0.55; g += (lip[1] - g) * 0.55; b += (lip[2] - b) * 0.55;
          } else if (x > 0 && L[p - 1] !== l) {
            sh *= L[p - 1] > l ? 0.8 : 1.12;
          } else if (x > 3 && y > 3 && (L[p - CH * 3 - 3] > l || L[p - CH * 2 - 2] > l)) {
            sh *= shadowK;
          }
          const hn = U.hash2(wx, wy, seed + 9);
          if (hn > 0.985 && l >= 0 && !onFace) { const sp = speck[hn > 0.993 ? 1 : 0]; r = sp[0]; g = sp[1]; b = sp[2]; }
          else sh *= 0.96 + hn * 0.08;
          if (wx < 0 || wy < 0 || wx > W || wy > H) {
            const dd = Math.max(-wx, -wy, wx - W, wy - H);
            let k = 0.75 - dd / 500; k = k < 0.2 ? 0.2 : k > 0.75 ? 0.75 : k;
            sh *= k; r += (40 - r) * 0.3; g += (30 - g) * 0.3; b += (50 - b) * 0.3;
          }
          const q = (py * CH + x) * 4;
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
          if (T.river && s < T.river.width) {
            const rc = col.river;
            const crack = U.ridged(x / 14, y / 14, 1, this.seed + 33) > 0.93;
            const edge = s > T.river.width * 0.75;
            const cc = crack ? rc.k : edge ? rc.d : rc.c;
            out[0] = cc[0]; out[1] = cc[1]; out[2] = cc[2];
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
          if (ex > 0.08) {
            const t = U.clamp((ex - 0.08) * 6, 0, 1);
            const cc = lit > 0.2 ? col.canopy.h : lit < -0.3 ? col.canopy.d : col.canopy.c;
            out[0] = U.lerp(out[0], cc[0], t); out[1] = U.lerp(out[1], cc[1], t); out[2] = U.lerp(out[2], cc[2], t);
          }
          break;
        }
        case 'ice': {
          if (l < 0) {
            const w = col.water;
            const d = U.clamp((this.sea - h) * 5, 0, 1);
            out[0] = U.lerp(w.shallow[0], w.deep[0], d); out[1] = U.lerp(w.shallow[1], w.deep[1], d); out[2] = U.lerp(w.shallow[2], w.deep[2], d);
            if (ex > 0.92) { out[0] = w.foam[0]; out[1] = w.foam[1]; out[2] = w.foam[2]; }
            else if (U.hash2(x >> 2, y >> 2, 5) > 0.97) { out[0] += 20; out[1] += 24; out[2] += 26; }
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
          } else if (m > 0.7) { out[0] = U.lerp(out[0], 90, 0.4); out[1] = U.lerp(out[1], 84, 0.4); out[2] = U.lerp(out[2], 82, 0.4); }
          break;
        }
        case 'moon': {
          const k = U.clamp(ex, -0.6, 0.6);
          out[0] *= 1 + k * 0.5; out[1] *= 1 + k * 0.5; out[2] *= 1 + k * 0.45;
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
          if (lx === 0 || ly === 0) { out[0] = mc.seam[0]; out[1] = mc.seam[1]; out[2] = mc.seam[2]; }
          else if ((lx === 3 || lx === g - 3) && (ly === 3 || ly === g - 3)) { out[0] = mc.rivet[0]; out[1] = mc.rivet[1]; out[2] = mc.rivet[2]; }
          else if (U.hash2(gx, gy, this.seed + 2) > 0.86 && ly > 8 && ly < g - 8 && lx > 8 && lx < g - 8 && ((ly + lx) % 4 === 0)) { out[0] *= 0.6; out[1] *= 0.6; out[2] *= 0.65; }
          // power conduits along selected grid lines
          const cxl = U.hash2(gx, 0, this.seed + 3) > 0.82, cyl = U.hash2(0, gy, this.seed + 4) > 0.82;
          if ((cxl && lx >= g / 2 - 1 && lx <= g / 2 + 1) || (cyl && ly >= g / 2 - 1 && ly <= g / 2 + 1)) {
            const cc = U.hash2(gx + gy, 1, this.seed + 5) > 0.5 ? mc.c1 : mc.c2;
            const pulse = (lx === g / 2 || ly === g / 2) ? 1 : 0.55;
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
      if (U.hash2(x >> 1, y, this.seed + 22) > 0.993) { out[0] += 40; out[1] += 50; out[2] += 50; }
    }

    stampDecor(ctx, cx, cy, L, HH, SS, top) {
      const wd = this.world;
      if (!this.decorSheets) {
        this.decorSheets = wd.decor.map((d) => {
          const sheets = [];
          for (let v = 0; v < 5; v++) sheets.push(AS.Forge.sheet('decor:' + wd.key + ':' + d.k + ':' + v + ':' + JSON.stringify(d.pal || {}), () => AS.Models.decor(d.k, d.pal, v * 13 + 3), 1, 1));
          return { d, sheets };
        });
      }
      const rng = new U.RNG(cx * 7919 + cy * 104729 + this.seed);
      const q = (AS.Settings && AS.Settings.quality === 'low') ? 0.5 : 1;
      for (const ds of this.decorSheets) {
        const n = Math.round(ds.d.d * q * (0.6 + rng.next() * 0.8));
        for (let i = 0; i < n; i++) {
          const x = rng.int(6, CH - 6), y = rng.int(6, CH - 6);
          const p = (y + top) * CH + x;
          const l = L[p];
          if (l < 0 || L[p - CH * 4] !== l || L[p + CH * 4 < L.length ? p + CH * 4 : p] !== l) continue;
          const wx = cx * CH + x, wy = cy * CH + y;
          if (this.kindOf(HH[p], SS[p]) !== 0) continue;
          if (wx < 0 || wy < 0 || wx > this.W || wy > this.H) continue;
          const sh = ds.sheets[rng.int(0, ds.sheets.length - 1)];
          ctx.globalAlpha = 0.28;
          ctx.drawImage(sh.shadows[0], x - sh.ax + 2, y - sh.ay + 1, sh.w, sh.h);
          ctx.globalAlpha = 1;
          ctx.drawImage(sh.frames[0][0], x - sh.ax, y - sh.ay, sh.w, sh.h);
        }
      }
    }

    /* ---------- decals (scorch marks etc.) baked into chunks ---------- */
    addDecal(kind, x, y, r, col) {
      const d = { kind, x, y, r, col, seed: (Math.random() * 1e6) | 0 };
      const c0 = Math.floor((x - r) / CH), c1 = Math.floor((x + r) / CH);
      const r0 = Math.floor((y - r) / CH), r1 = Math.floor((y + r) / CH);
      for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) {
        const key = cx * 10000 + cy;
        let list = this.decals.get(key);
        if (!list) { list = []; this.decals.set(key, list); }
        list.push(d);
        if (list.length > 60) list.shift();
        const ch = this.cache.get(key);
        if (ch) this.paintDecal(ch.cv, cx, cy, d);
      }
    }
    paintDecal(cv, cx, cy, d) {
      const ctx = cv.getContext('2d');
      const x = d.x - cx * CH, y = d.y - cy * CH;
      const rng = new U.RNG(d.seed);
      ctx.save();
      if (d.kind === 'scorch' || d.kind === 'crater') {
        for (let i = 0; i < 14; i++) {
          const a = rng.next() * U.TAU, rr = rng.next() * d.r * 0.7;
          ctx.fillStyle = 'rgba(14,10,8,' + (0.12 + rng.next() * 0.16) + ')';
          ctx.beginPath(); ctx.arc(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.8), d.r * (0.25 + rng.next() * 0.45), 0, U.TAU); ctx.fill();
        }
        if (d.kind === 'crater') {
          ctx.fillStyle = 'rgba(8,6,6,0.45)';
          ctx.beginPath(); ctx.ellipse(x, y, d.r * 0.45, d.r * 0.36, 0, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,230,200,0.12)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, y + 1, d.r * 0.5, d.r * 0.4, 0, 0.2, Math.PI - 0.2); ctx.stroke();
        }
        // debris flecks
        for (let i = 0; i < d.r * 0.8; i++) {
          const a = rng.next() * U.TAU, rr = d.r * (0.5 + rng.next() * 0.9);
          ctx.fillStyle = rng.next() > 0.5 ? 'rgba(20,16,14,0.7)' : 'rgba(90,80,70,0.6)';
          ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.8), 1, 1);
        }
      } else if (d.kind === 'splat') {
        const c = C.hex(d.col || '#6a8a2a');
        for (let i = 0; i < 10; i++) {
          const a = rng.next() * U.TAU, rr = rng.next() * d.r;
          ctx.fillStyle = C.str(c, 0.35 + rng.next() * 0.3);
          ctx.beginPath(); ctx.arc(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1 + rng.next() * d.r * 0.3, 0, U.TAU); ctx.fill();
        }
      } else if (d.kind === 'wreck') {
        ctx.fillStyle = 'rgba(10,8,8,0.35)';
        ctx.beginPath(); ctx.ellipse(x, y, d.r, d.r * 0.7, 0, 0, U.TAU); ctx.fill();
      }
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
