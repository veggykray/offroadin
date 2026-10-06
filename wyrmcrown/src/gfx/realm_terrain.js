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
      super(world, Object.assign({}, map, { zones: [] }));
      this.map = map;
      this.biomeNames = BIOMES;
      this.buildGrids(map);
      this.zones = (map.zones || []).map((z) => Object.assign({ r: 120, h: null, soft: 1.5 }, z));
      for (const z of this.zones) this.zoneLevel(z);
      this.bridges = []; // [{x0,y0,x1,y1,w}] corridors that make water passable
    }

    /* ---------- authored geography → lookup grids ---------- */
    buildGrids(map) {
      const gw = this.gw = Math.ceil(this.W / GC) + 2, gh = this.gh = Math.ceil(this.H / GC) + 2, N = gw * gh;
      const sd = this.seed;
      this.gWater = new Float32Array(N);   // signed distance to open water (negative = water)
      this.gMount = new Float32Array(N);   // mountain uplift 0..1
      this.gForest = new Float32Array(N);  // forest density 0..1
      this.gBiome = new Float32Array(N * 5); // soft region weights
      this.gRoad = new Float32Array(N);    // distance to the nearest road centre line
      this.gField = new Uint8Array(N);     // farmland / no-tree mask
      const rivers = (map.rivers || []).map((r) => ({ w: r.w || 60, pts: smoothLine(r.pts.map((p) => [p[0], p[1], p[2] !== undefined ? p[2] : (r.w || 60)]), 60) }));
      this.rivers = rivers;
      const ridges = (map.mountains || []).map((m) => ({ w: m.w || 420, hgt: m.h || 1, pts: smoothLine(m.pts, 90) }));
      this.ridges = ridges;
      const lakes = map.lakes || [];
      const roads = (map.roads || []).map((r) => smoothLine(r.pts || r, 70));
      this.roadLines = roads;
      const regions = map.regions || [];
      const forests = map.forests || [];
      const fields = map.fields || [];
      const clear = map.clearings || [];
      const tmpW = new Float32Array(5);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const x = (i - 1) * GC + GC / 2, y = (j - 1) * GC + GC / 2, k = j * gw + i;
        // water: rivers (variable width) and lakes, with a wobbly shoreline
        let wd = 1e9;
        for (const r of rivers) {
          const p = r.pts;
          for (let s = 0; s < p.length - 1; s++) {
            const a = p[s], b = p[s + 1];
            if (Math.abs(x - a[0]) > 900 && Math.abs(x - b[0]) > 900) continue;
            if (Math.abs(y - a[1]) > 900 && Math.abs(y - b[1]) > 900) continue;
            const d = Math.sqrt(segDist2(x, y, a[0], a[1], b[0], b[1])) - (a[2] + b[2]) * 0.25;
            if (d < wd) wd = d;
          }
        }
        for (const l of lakes) {
          const ang = Math.atan2(y - l.y, x - l.x);
          const rr = l.r * (1 + 0.16 * U.noise2(Math.cos(ang) * 1.6 + l.x * 0.001, Math.sin(ang) * 1.6 + l.y * 0.001, sd + 13)) * (l.sx ? 1 : 1);
          const dx = (x - l.x) / (l.sx || 1), dy = (y - l.y) / (l.sy || 1);
          const d = Math.hypot(dx, dy) - rr;
          if (d < wd) wd = d;
        }
        wd += U.noise2(x / 140, y / 140, sd + 17) * 14;
        this.gWater[k] = wd;
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
        this.gMount[k] = Math.min(1.3, mt);
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
        for (let q = 0; q < 5; q++) this.gBiome[k * 5 + q] = tmpW[q] / tot;
        // forests: authored blobs + biome default cover modulated by noise
        let fo = 0;
        for (const f of forests) {
          const d = Math.hypot((x - f.x) / (f.sx || 1), (y - f.y) / (f.sy || 1)) / f.r;
          const edge = 0.75 + U.noise2(x / 260, y / 260, sd + 41) * 0.35;
          if (d < edge) fo = Math.max(fo, (f.d || 1) * U.smoothstep(edge, edge * 0.55, d));
        }
        const cover = { human: 0.12, elf: 0.55, ice: 0.32, undead: 0.28, neutral: 0.14 };
        let base = 0;
        for (let q = 0; q < 5; q++) base += this.gBiome[k * 5 + q] * cover[BIOMES[q]];
        const n = U.fbm(x / 900, y / 900, 3, sd + 43);
        fo = Math.max(fo, U.clamp((n + base - 0.18) * 2.2, 0, 1) * Math.min(1, base * 2.2));
        if (mt > 0.55) fo *= U.clamp(1.6 - mt * 1.4, 0, 1); // tree line
        this.gForest[k] = fo;
        // farmland and clearings keep trees out
        let fm = 0;
        for (const f of fields) if (Math.hypot(x - f.x, y - f.y) < f.r) { fm = 1; break; }
        for (const c of clear) if (Math.hypot(x - c.x, y - c.y) < c.r) { fm = 2; break; }
        this.gField[k] = fm;
        // roads
        let rd = 1e9;
        for (const p of roads) for (let s = 0; s < p.length - 1; s++) {
          const a = p[s], b = p[s + 1];
          if (Math.abs(x - a[0]) > 300 && Math.abs(x - b[0]) > 300 && Math.sign(x - a[0]) === Math.sign(x - b[0])) continue;
          if (Math.abs(y - a[1]) > 300 && Math.abs(y - b[1]) > 300 && Math.sign(y - a[1]) === Math.sign(y - b[1])) continue;
          const d = Math.sqrt(segDist2(x, y, a[0], a[1], b[0], b[1]));
          if (d < rd) rd = d;
        }
        this.gRoad[k] = rd;
      }
    }
    // bilinear sample of a scalar grid
    gs(g, x, y) {
      const fx = x / GC + 0.5, fy = y / GC + 0.5;
      let i = Math.floor(fx), j = Math.floor(fy);
      const tx = fx - i, ty = fy - j;
      i = U.clamp(i, 0, this.gw - 2); j = U.clamp(j, 0, this.gh - 2);
      const k = j * this.gw + i, gw = this.gw;
      return (g[k] * (1 - tx) + g[k + 1] * tx) * (1 - ty) + (g[k + gw] * (1 - tx) + g[k + gw + 1] * tx) * ty;
    }
    // nearest-cell lookup (cheap; for masks)
    gn(g, x, y) {
      const i = U.clamp(Math.floor(x / GC + 1), 0, this.gw - 1), j = U.clamp(Math.floor(y / GC + 1), 0, this.gh - 1);
      return g[j * this.gw + i];
    }
    /* soft biome weights at a point → out[5] (human, elf, ice, undead, neutral) */
    biomeAt(x, y, out) {
      out = out || new Float32Array(5);
      const fx = x / GC + 0.5, fy = y / GC + 0.5;
      let i = Math.floor(fx), j = Math.floor(fy);
      const tx = fx - i, ty = fy - j;
      i = U.clamp(i, 0, this.gw - 2); j = U.clamp(j, 0, this.gh - 2);
      const gw = this.gw, B = this.gBiome;
      const k00 = (j * gw + i) * 5, k10 = k00 + 5, k01 = k00 + gw * 5, k11 = k01 + 5;
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
      const mt = this.gs(this.gMount, x, y);
      h += mt * 0.62;
      const water = this.gs(this.gWater, x, y);
      // valleys: terrain eases down toward rivers and lakes, water sits at level 0
      if (water < 160) h = Math.min(h, U.lerp(0.1, h, U.smoothstep(-10, 160, water)));
      const m = 0.5 + 0.6 * U.fbm(x / 600, y / 600, 2, sd + 40);
      let s = water;
      const zs = noZones ? null : this.zones;
      if (zs) for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
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
      // forest floor darkens under the canopy
      if (ex > 0.25 && s > 20) {
        const t = U.clamp((ex - 0.25) * 1.6, 0, 0.7);
        let fr = 0, fg = 0, fb = 0;
        for (let q = 0; q < 5; q++) { const F = LOOK_RGB[BIOMES[q]].floor, k = w[q]; fr += F[0] * k; fg += F[1] * k; fb += F[2] * k; }
        r = U.lerp(r, fr, t); g = U.lerp(g, fg, t); b = U.lerp(b, fb, t);
      }
      // cursed blight: dark veins and a sickly sheen in the undead lands
      if (deadW > 0.3) {
        const v = U.ridged(x / 90, y / 90, 1, sd + 61);
        if (v > 0.93) { const t = (v - 0.93) * 12 * deadW; r = U.lerp(r, 70, t); g = U.lerp(g, 54, t); b = U.lerp(b, 88, t); }
        const ash = U.noise2(x / 220, y / 220, sd + 62);
        if (ash > 0.35) { const t = (ash - 0.35) * 0.6 * deadW; r = U.lerp(r, 120, t); g = U.lerp(g, 116, t); b = U.lerp(b, 112, t); }
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
      for (const z of this.zones) { const dx = x - z.x, dy = y - z.y, rr = z.r * (z.treeR || 0.95) + r; if (dx * dx + dy * dy < rr * rr) return false; }
      for (const z of this.clearAreas) { const dx = x - z.x, dy = (y - z.y) / 0.8; if (dx * dx + dy * dy < (z.r + r) * (z.r + r)) return false; }
      const TD = st.TD, px = Math.round((x - st.x0) * TD) + st.ML, py = Math.round((y - st.y0) * TD) + st.top;
      if (px < 2 || py < 2 || px >= st.NW - 2 || py >= st.rows - 2) return false;
      const L = st.L, NW = st.NW, l = L[py * NW + px];
      const o = Math.max(2, Math.round(r * 0.7 * TD));
      if (px - o < 0 || px + o >= NW || py - o * 2 < 0 || py + o >= st.rows) return false;
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
          const bk = biomeOf(x, y);
          let kind = this.pickW(ds.trees[bk], U.hash2(gx, gy, sd + 404));
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
          if (this.gn(this.gField, x, y) === 1) continue;
          const mt = this.gs(this.gMount, x, y);
          const p = 0.16 + mt * 0.5 + this.gs(this.gForest, x, y) * 0.2;
          if (hv > p * q) continue;
          const bk = biomeOf(x, y);
          let k = this.pickW(ds.under[bk], U.hash2(gx, gy, sd + 414));
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
        ctx.globalAlpha = 0.36; ctx.drawImage(sh.shadows[0], lx - sh.ax + 3.2, ly - sh.ay + 1.8, sh.w, sh.h);
        ctx.globalAlpha = 1; ctx.drawImage(sh.frames[0][0], lx - sh.ax, ly - sh.ay, sh.w, sh.h);
        if (++n % 140 === 0) { ctx.restore(); yield null; ctx.save(); ctx.scale(st.TD, st.TD); ctx.imageSmoothingEnabled = true; }
      }
      ctx.restore();
    }
    stampDecor(ctx, cx, cy, st) { const it = this.stampDecorGen(ctx, cx, cy, st); let r; do { r = it.next(); } while (!r.done); }

    /* tactical map: also shades forests and roads */
    buildMap(scale) {
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

  RealmTerrain.BIOMES = BIOMES;
  RealmTerrain.LOOK = LOOK;
  RealmTerrain.smoothLine = smoothLine;
  AS.RealmTerrain = RealmTerrain;
})(window.AS);
