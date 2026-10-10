/* WYRMCROWN — MOUNTAIN TEST terrain: a real heightfield, drawn in projection.
 *
 * The game draws its world top-down at a 3/4 angle: a thing at ground (x, y) and
 * height z appears at screen-plane (x, y − z). Ordinary maps have no heights, so
 * ground (x, y) and screen (x, y) are the same. Here the land has true elevation
 * E(x, y), so the ground itself is drawn at (x, y − E):
 *
 *   ground space     x, y on the flat map; E(x, y) the height there (units)
 *   projected space  X = x, Y = y − E(x, y): where that ground appears
 *
 * Everything that stands on the ground (sites, troops, decals, projectiles, the
 * camera) works in projected space, so the engine draws it unchanged; the terrain
 * chunks are rasterised in projected space by marching each pixel column from
 * the viewer (south) into the distance, keeping a horizon, so a mountain hides
 * what lies behind it and a south face is drawn as the tall face it is. The
 * table UP maps projected → ground for gameplay queries (which ground is visible
 * at a screen point). Only the dragon lives in ground space with a true altitude
 * (src/game/mountain.js).
 *
 *   AS.MountainGen.build(map)  heightfield from map.relief (main thread, at load)
 *   AS.Relief                  the height data and its queries (page and workers)
 *   AS.MountainTerrain         the terrain (RealmTerrain's lookups and workers,
 *                              its own projected chunks, war map and queries) */
'use strict';
(function (AS) {
  const U = AS.U, CH = 256;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // piecewise smooth curve through [[t, v], ...] (cosine eased)
  function curve(pts, t) {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], k = (t - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(k * Math.PI)); }
    }
    return pts[pts.length - 1][1];
  }
  function segDist2T(px, py, ax, ay, bx, by, out) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    out[0] = t;
    return qx * qx + qy * qy;
  }

  /* ================= the height data and its queries ================= */
  class Relief {
    constructor(d) { Object.assign(this, d); }
    // the plain data (structured-clone safe: sent to the terrain workers)
    data() { const o = {}; for (const k of Object.keys(this)) o[k] = this[k]; return o; }
    h(x, y) {
      const HG = this.HG, gw = this.gw;
      let fx = x / HG, fy = y / HG;
      if (fx < 0) fx = 0; else if (fx > gw - 1.001) fx = gw - 1.001;
      if (fy < 0) fy = 0; else if (fy > this.gh - 1.001) fy = this.gh - 1.001;
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * gw + i, E = this.E;
      return (E[k] * (1 - tx) + E[k + 1] * tx) * (1 - ty) + (E[k + gw] * (1 - tx) + E[k + gw + 1] * tx) * ty;
    }
    // slope vector (dE/dx, dE/dy)
    grad(x, y, out) {
      const d = this.HG;
      out[0] = (this.h(x + d, y) - this.h(x - d, y)) / (2 * d);
      out[1] = (this.h(x, y + d) - this.h(x, y - d)) / (2 * d);
      return out;
    }
    slope(x, y) { const g = this.grad(x, y, this._g || (this._g = [0, 0])); return Math.hypot(g[0], g[1]); }
    // cast shadow 0..1 and cavity -1..1 (bilinear)
    shadow(x, y) { return this.samp8(this.SH, x, y) / 255; }
    ao(x, y) { return this.samp8(this.AO, x, y) / 127; }
    samp8(A, x, y) {
      const HG = this.HG, gw = this.gw;
      const fx = clamp(x / HG, 0, gw - 1.001), fy = clamp(y / HG, 0, this.gh - 1.001);
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * gw + i;
      return (A[k] * (1 - tx) + A[k + 1] * tx) * (1 - ty) + (A[k + gw] * (1 - tx) + A[k + gw + 1] * tx) * ty;
    }
    proj(x, y) { return y - this.h(x, y); }
    /* the ground y whose surface is what shows at projected (x, Y); NaN where no
     * ground shows (beyond the top edge). Table lookup, then refined at x itself. */
    unproj(x, Y) {
      const HG = this.HG, rows = this.upRows, UP = this.UP;
      const i = clamp(Math.round(x / HG), 0, this.gw - 1);
      const fk = (Y - this.upY0) / this.upRY;
      if (fk < 0 || fk >= rows - 1) return NaN;
      const k = fk | 0, t = fk - k, base = i * rows;
      const a = UP[base + k], b = UP[base + k + 1];
      let gy;
      if (a === 65535 && b === 65535) return NaN;
      if (a === 65535) gy = b * 0.5;
      else if (b === 65535) gy = a * 0.5;
      else if (b - a > 40) gy = (t < 0.5 ? a : b) * 0.5; // a silhouette between the rows: no blending across it
      else gy = (a + (b - a) * t) * 0.5;
      // refine for the exact column (the table is per grid column)
      for (let it = 0; it < 3; it++) {
        const e = Y - (gy - this.h(x, gy));
        if (e > -0.4 && e < 0.4) break;
        const dEdy = (this.h(x, gy + 3) - this.h(x, gy - 3)) / 6, den = 1 - dEdy;
        if (den < 0.25) break;
        gy += clamp(e / den, -12, 12);
      }
      return gy;
    }
    // is ground (x, y) the surface seen at its own projected point (not hidden behind a ridge)?
    visible(x, y, tol) {
      const g = this.unproj(x, y - this.h(x, y));
      return g === g && Math.abs(g - y) < (tol || 14);
    }
    // the highest ground on the straight line between two ground points (sampled)
    lineMax(x0, y0, x1, y1, step) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / (step || 20)));
      let m = -1e9;
      for (let i = 0; i <= n; i++) { const t = i / n, h = this.h(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); if (h > m) m = h; }
      return m;
    }
    /* line of sight between two points in the air (ground x, y, altitude z): the
     * first blocked fraction along the line, or 1 if clear */
    los(x0, y0, z0, x1, y1, z1, step, margin) {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(L / (step || 18)));
      const mg = margin === undefined ? 4 : margin;
      for (let i = 1; i < n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
        if (this.h(x, y) > z + mg) return t;
      }
      return 1;
    }
    // the highest ground in the column strip around x, for y ≥ y0 (bounds a column march)
    southMax(x, y0) {
      const s = clamp(Math.floor(x / 64), 0, this.smW - 1), b = clamp(Math.floor(y0 / 64), 0, this.smH - 1);
      return this.SM[b * this.smW + s];
    }
  }

  /* ================= the generator ================= */
  const MG = {
    build(map) {
      const t0 = performance.now();
      const RF = map.relief, W = map.w, H = map.h, HG = RF.HG || 10, sd = (map.seed || 0) * 13 + 501;
      const gw = Math.floor(W / HG) + 1, gh = Math.floor(H / HG) + 1, N = gw * gh;
      const E = new Float32Array(N);
      const n2 = U.noise2, fbm = U.fbm, ridged = U.ridged;
      // ---- per-column tables for the ranges (spine y, crest height, spine direction)
      const RG = RF.ranges.map((r) => {
        const ys = new Float32Array(gw), hc = new Float32Array(gw), cs = new Float32Array(gw);
        for (let i = 0; i < gw; i++) {
          const x = i * HG;
          ys[i] = curve(r.spine, x) + n2(x / 900, 3.3, sd + 3) * 70;
          hc[i] = curve(r.crest, x) + fbm(x / 520, 7.1, 3, sd + 4) * 58;
        }
        for (let i = 0; i < gw; i++) { const a = ys[Math.max(0, i - 3)], b = ys[Math.min(gw - 1, i + 3)]; cs[i] = Math.cos(Math.atan2(b - a, 6 * HG)); }
        return { r, ys, hc, cs };
      });
      const baseAt = (x, y) => curve(RF.base, y);
      // ---- 1. the land: base, rolling ground, ranges, summits, crags
      for (let j = 0; j < gh; j++) {
        const y = j * HG, B0 = baseAt(0, y);
        const upl = 1 - sstep(2300, 2900, y), foot = sstep(6700, 7300, y) * (1 - sstep(8800, 9600, y)), low = sstep(9000, 9800, y);
        for (let i = 0; i < gw; i++) {
          const x = i * HG;
          // base and its roll: moorland swells in the north, wooded hills in the foothills
          let B = B0 + fbm(x / 1400, y / 1400, 2, sd + 6) * 26;
          if (upl > 0) B += fbm(x / 800, y / 800, 3, sd + 7) * 48 * upl;
          if (foot > 0) B += (fbm(x / 650, y / 650, 3, sd + 8) * 0.8 + 0.25) * 70 * foot;
          if (low > 0) B += fbm(x / 1100, y / 1100, 2, sd + 9) * 12 * low;
          let h = B;
          for (const R of RG) {
            const d = (y - R.ys[i]) * R.cs[i], hw = (d < 0 ? R.r.hwN : R.r.hwS) * (1 + fbm(x / 1500, y / 1100, 2, sd + 11) * 0.34);
            const t = Math.abs(d) / hw;
            if (t >= 1) continue;
            const s = 1 - t, A = Math.max(0, R.hc[i] - B);
            // spurs and gullies run down the slopes (noise stretched across the spine)
            // (warped and varied in strength along the range, so they never fall into a regular comb)
            // (the High Pass corridor keeps the plain, even form: its road needs a steady grade)
            const pz = 1 - sstep(450, 900, Math.abs(x - 8000));
            const wx = x + n2(x / 600, d / 500, sd + 27) * 160 * (1 - pz);
            const gA = ridged(wx / 380 + n2(x / 900, d / 900, sd + 24) * 0.6, d / 900, 2, sd + 12) * 0.65 + ridged(wx / 210 + n2(x / 300, d / 260, sd + 28) * 0.5, d / 420, 2, sd + 25) * 0.35;
            const gul = pz > 0 ? gA + (ridged(x / 380 + n2(x / 900, d / 900, sd + 24) * 0.6, d / 900, 2, sd + 12) * 0.65 + ridged(x / 170, d / 420, 2, sd + 25) * 0.35 - gA) * pz : gA;
            const ev = 0.45 + 0.75 * sstep(-0.5, 0.6, n2(x / 1100, d / 800, sd + 29));
            const env = 4 * t * s * (ev + (1 - ev) * pz);
            let prof = Math.pow(s, 1.55 + n2(x / 1700, 1.7, sd + 26) * 0.35) * (1 + (gul - 0.6) * 0.75 * env);
            // the crest: a sharp arête, broken into summits
            prof *= 1 + (ridged(x / 330, y / 330, 2, sd + 13) - 0.6) * 0.16 * s;
            const v = B + A * prof;
            if (v > h) h = v;
          }
          E[j * gw + i] = h;
        }
      }
      // summits with radial arêtes
      for (const p of RF.peaks || []) MG.each(gw, gh, HG, p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r, (k, x, y) => {
        const dx = x - p.x, dy = y - p.y, r = Math.hypot(dx, dy) / p.r;
        if (r >= 1) return;
        const th = Math.atan2(dy, dx), arm = 0.6 + 0.4 * Math.cos(p.arms * th + n2(r * 3, th, sd + 14) * 1.4);
        E[k] += p.h * Math.pow(1 - r, 1.6) * arm;
      });
      // crags and strata on the high ground (benches and risers, broken by noise)
      for (let k = 0; k < N; k++) {
        const h = E[k];
        if (h < 230) continue;
        const x = (k % gw) * HG, y = ((k / gw) | 0) * HG;
        const hi = sstep(230, 520, h);
        let v = h + (ridged(x / 170, y / 170, 3, sd + 15) - 0.55) * 46 * hi;
        const st = 34 + n2(x / 900, y / 900, sd + 16) * 8, q = v / st, f = Math.floor(q), fr = q - f;
        const fr2 = fr < 0.7 ? fr * (0.3 / 0.7) : 0.3 + (fr - 0.7) / 0.3 * 0.7;
        const tk = sstep(-0.2, 0.4, n2(x / 600, y / 600, sd + 17)) * 0.4 * hi * (0.6 + 0.4 * sstep(-0.3, 0.3, n2(x / 140, y / 140, sd + 29)));
        E[k] = v + ((f + fr2) * st - v) * tk;
      }
      // ---- 2. the Wall: a cliff, the land north of it held up to the shelf's height.
      // The face is not one curtain: it climbs in two or three tiers with broken
      // ledges between them, juts out in buttresses and falls back in bays along
      // its length, and sheds a talus of fallen rock at its foot. The shelf above
      // rolls, with knolls and rock outcrops.
      const WL = RF.wall;
      if (WL) MG.each(gw, gh, HG, WL.x0 - 200, WL.y - WL.reach - 200, WL.x1 + 200, WL.y + 260, (k, x, y) => {
        if (x < WL.x0 - 150 || x > WL.x1 + 150) return;
        const yw = WL.y + Math.sin(x / WL.wobL) * WL.wob + n2(x / 160, 5.5, sd + 18) * 10 + n2(x / 70, 9.5, sd + 30) * 9;
        const ends = sstep(WL.x0 - 150, WL.x0 + 150, x) * (1 - sstep(WL.x1 - 150, WL.x1 + 150, x));
        const back = yw - y; // distance north of the cliff foot
        const top0 = curve(WL.top, x);
        if (back < 0) {
          // the talus: fans of fallen rock below the face, deepest under its gullies
          const Ht = Math.max(0, top0 - E[k]), T = 70 + 90 * sstep(-0.4, 0.6, n2(x / 170, 2.2, sd + 31));
          const fan = 0.55 + 0.75 * sstep(-0.2, 0.7, n2(x / 95, 4.4, sd + 32));
          const t = -back / T;
          if (t < 1) E[k] += Ht * 0.17 * fan * Math.pow(1 - t, 1.7) * ends;
          return;
        }
        // the shelf: rolling ground, knolls and outcrops (fading in away from the edge)
        const inl = sstep(40, 260, back);
        const top = top0 + fbm(x / 300, y / 300, 2, sd + 19) * 14 + (fbm(x / 520, y / 520, 2, sd + 33) * 16 + Math.max(0, ridged(x / 210, y / 210, 2, sd + 34) - 0.62) * 70) * inl;
        // the face in plan: buttresses stand out, bays fall back (the depth of the climb varies)
        const dpt = WL.depth * (0.75 + 1.1 * sstep(0.45, 0.85, ridged(x / 150, 1.7, 2, sd + 35)));
        const b = back + n2(x / 60, y / 60, sd + 20) * 6;
        // tiers: two ledges at varying heights, sometimes pinched out
        const f1 = 0.36 + n2(x / 400, 6.1, sd + 36) * 0.12, f2 = 0.7 + n2(x / 350, 7.3, sd + 37) * 0.1;
        const w1 = Math.max(0, 12 + 22 * n2(x / 230, 8.2, sd + 38)), w2 = Math.max(0, 9 + 20 * n2(x / 260, 9.4, sd + 39));
        const r1 = dpt * 0.34, r2 = dpt * 0.3, r3 = dpt * 0.36;
        let P;
        if (b < r1) P = f1 * sstep(0, r1, b);
        else if (b < r1 + w1) P = f1 + 0.04 * (b - r1) / Math.max(1, w1);
        else if (b < r1 + w1 + r2) P = f1 + 0.04 + (f2 - f1 - 0.04) * sstep(0, r2, b - r1 - w1);
        else if (b < r1 + w1 + r2 + w2) P = f2 + 0.03 * (b - r1 - w1 - r2) / Math.max(1, w2);
        else P = f2 + 0.03 + (0.97 - f2) * sstep(0, r3, b - r1 - w1 - r2 - w2) + 0.03 * sstep(r3, r3 + 40, b - r1 - w1 - r2 - w2);
        const fade = 1 - sstep(WL.reach * 0.55, WL.reach, back);
        const want = E[k] + (Math.max(E[k], top) - E[k]) * Math.min(1, P) * fade;
        E[k] = E[k] + (want - E[k]) * ends;
      });
      // ---- 3. the hidden basin: a bowl on the shelf, a rim round it, an outlet notch to the south
      const BS = RF.basin;
      if (BS) MG.each(gw, gh, HG, BS.x - BS.r * 1.4, BS.y - BS.r * 1.4, BS.x + BS.r * 1.4, BS.y + BS.r * 1.4, (k, x, y) => {
        const dx = x - BS.x, dy = y - BS.y, d = Math.hypot(dx, dy) / BS.r;
        if (d >= 1.35) return;
        const fl = BS.floor + fbm(x / 160, y / 160, 2, sd + 21) * 8;
        const inner = 1 - sstep(0.62, 0.95, d);
        let h = E[k] + (fl - E[k]) * inner;
        // the rim: a ring of crags (not where the stream leaves)
        const ring = Math.max(0, 1 - Math.abs(d - 1.0) / 0.22);
        const nd = Math.hypot(x - BS.notch[0], y - BS.notch[1]);
        const notch = sstep(60, 200, nd);
        h += BS.rim * ring * notch * (0.6 + 0.6 * ridged(x / 90, y / 90, 2, sd + 22));
        if (nd < 200) h = Math.min(h, fl + 4 + nd * 0.05);
        E[k] = h;
      });
      // ---- 4. rivers: the bed falls steadily downstream; the gorge is cut to it
      const smooth = AS.RealmTerrain.smoothLine;
      const rivers = (map.rivers || []).map((r) => ({ w: r.w || 60, pts: smooth(r.pts.map((p) => [p[0], p[1], p[2] !== undefined ? p[2] : (r.w || 60)]), 60) }));
      const RD = new Float32Array(N).fill(1e9); // distance to the nearest river's water edge
      for (const r of rivers) {
        const P = MG.densify(r.pts, 8), bed = new Float32Array(P.length);
        let prev = 1e9;
        for (let i = 0; i < P.length; i++) {
          // the lowest ground across the channel (the river finds the valley floor)
          const p = P[i]; let lo = MG.hAt(E, gw, gh, HG, p[0], p[1]);
          for (const o of [-30, 30]) lo = Math.min(lo, MG.hAt(E, gw, gh, HG, p[0] + o, p[1]), MG.hAt(E, gw, gh, HG, p[0], p[1] + o));
          const want = lo - 5;
          prev = Math.min(prev - 0.004 * 8, want);
          bed[i] = prev;
        }
        // relax the bed (no pits), keeping it monotone
        for (let it = 0; it < 4; it++) { for (let i = 1; i < P.length - 1; i++) bed[i] = Math.min(bed[i - 1], Math.max(bed[i], (bed[i - 1] + bed[i + 1]) * 0.5)); }
        r.P = P; r.bed = bed;
      }
      // the gorge: a floor at the river's banks, sheer walls
      const GZ = RF.gorge;
      if (GZ && rivers[0]) {
        const r = rivers[0], P = r.P, bed = r.bed, gp = smooth(GZ.pts, 60);
        const near = (x, y) => { let best = 1e9, bh = 0; for (let i = 0; i < P.length; i += 2) { const dx = P[i][0] - x, dy = P[i][1] - y, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bh = bed[i]; } } return bh; };
        MG.stampLine(gw, gh, HG, gp, GZ.wallW + 20, (k, x, y, d) => {
          const fl = near(x, y) + 7 + Math.max(0, d - 30) * 0.03;
          const wall = sstep(GZ.floorW, GZ.wallW, d + n2(x / 50, y / 50, sd + 23) * 12);
          E[k] = Math.min(E[k], fl + (E[k] - fl) * wall);
        });
      }
      // carve every river: water over the bed, banks easing up to the land
      for (const r of rivers) {
        const P = r.P, bed = r.bed;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i], b = P[i + 1], hw = (a[2] + b[2]) * 0.25, reach = hw + 26 + hw * 1.6;
          const tt = [0];
          MG.each(gw, gh, HG, Math.min(a[0], b[0]) - reach, Math.min(a[1], b[1]) - reach, Math.max(a[0], b[0]) + reach, Math.max(a[1], b[1]) + reach, (k, x, y) => {
            const d = Math.sqrt(segDist2T(x, y, a[0], a[1], b[0], b[1], tt)) - hw;
            if (d < RD[k]) RD[k] = d;
            if (d > reach - hw) return;
            const bh = bed[i] + (bed[i + 1] - bed[i]) * tt[0];
            const v = d < 0 ? bh - 3 * Math.min(1, -d / 10) : bh + (E[k] - bh) * sstep(0, reach - hw, d) * Math.min(1, 0.35 + d / 30);
            if (v < E[k]) E[k] = v;
          });
        }
      }
      // lakes: a basin under the water
      for (const l of map.lakes || []) {
        const sx = l.sx || 1, sy = l.sy || 1, R = l.r * 1.5;
        let lvl = 0; // the water level: a little under the shore's mean height
        for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; lvl += MG.hAt(E, gw, gh, HG, l.x + Math.cos(t) * l.r * sx, l.y + Math.sin(t) * l.r * sy) / 24; }
        lvl -= 6;
        l._lvl = lvl;
        MG.each(gw, gh, HG, l.x - R * sx, l.y - R * sy, l.x + R * sx, l.y + R * sy, (k, x, y) => {
          const d = Math.hypot((x - l.x) / sx, (y - l.y) / sy) / l.r;
          if (d > 1.5) return;
          const v = d < 1 ? lvl - 4 - (1 - d) * 18 : lvl + (E[k] - lvl) * sstep(1, 1.5, d);
          if (v < E[k]) E[k] = v;
        });
      }
      // ---- 5. small sheer faces (a cave in a hillside)
      for (const c of RF.cliffs || []) MG.each(gw, gh, HG, c.x - c.w - 60, c.y - 300, c.x + c.w + 60, c.y + 30, (k, x, y) => {
        const side = 1 - sstep(c.w * 0.6, c.w + 40, Math.abs(x - c.x));
        if (side <= 0 || y > c.y) return;
        const foot = MG.hAt(E, gw, gh, HG, x, c.y + 20);
        const back = c.y - y, face = sstep(0, c.depth, back), fade = 1 - sstep(220, 300, back);
        const want = Math.max(E[k], foot + c.rise * face * fade);
        E[k] += (want - E[k]) * side;
      });
      // ---- 6. site pads and roads (graded; cut into slopes, banked over hollows)
      const pads = RF.pads || [];
      const padIt = () => { for (const p of pads) {
        if (p.h === undefined || p._h === undefined) { if (p.h !== undefined) p._h = p.h; else { let s = 0, n = 0; for (let a = 0; a < 12; a++) { s += MG.hAt(E, gw, gh, HG, p.x + Math.cos(a / 12 * 6.283) * p.r * 0.5, p.y + Math.sin(a / 12 * 6.283) * p.r * 0.5); n++; } p._h = s / n; } }
        MG.each(gw, gh, HG, p.x - p.r * 1.7, p.y - p.r * 1.7, p.x + p.r * 1.7, p.y + p.r * 1.7, (k, x, y) => {
          if (RD[k] < 8) return;
          const d = Math.hypot(x - p.x, y - p.y);
          E[k] += (p._h - E[k]) * (1 - sstep(p.r * 0.85, p.r * 1.65, d));
        });
      } };
      padIt();
      const roads = (map.roads || []).map((r) => smooth(r.pts || r, 70));
      const RW = new Float32Array(N).fill(1e9), RH = new Float32Array(N);
      const grade = RF.grade || 0.14;
      for (const pts of roads) {
        const P = MG.densify(pts, 10), n = P.length, h = new Float32Array(n);
        for (let i = 0; i < n; i++) h[i] = MG.hAt(E, gw, gh, HG, P[i][0], P[i][1]);
        // over water the road keeps its approach heights (a bridge spans it)
        for (let i = 0; i < n; i++) if (MG.rdAt(RD, gw, gh, HG, P[i][0], P[i][1]) < 14) h[i] = NaN;
        for (let i = 0; i < n; i++) if (h[i] !== h[i]) { let a = i, b = i; while (a > 0 && h[a] !== h[a]) a--; while (b < n - 1 && h[b] !== h[b]) b++; const ha = h[a] === h[a] ? h[a] : h[b], hb = h[b] === h[b] ? h[b] : ha; for (let q = a + 1; q < b; q++) h[q] = ha + (hb - ha) * (q - a) / (b - a); i = b; }
        // smooth the profile, then hold it to the grade both ways
        const tmp = new Float32Array(n);
        for (let it = 0; it < 6; it++) { for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let q = -6; q <= 6; q++) { const v = h[clamp(i + q, 0, n - 1)]; s += v; c++; } tmp[i] = s / c; } h.set(tmp); }
        const g = grade * 10;
        for (let i = 1; i < n; i++) h[i] = clamp(h[i], h[i - 1] - g, h[i - 1] + g);
        for (let i = n - 2; i >= 0; i--) h[i] = clamp(h[i], h[i + 1] - g, h[i + 1] + g);
        const tt = [0];
        for (let i = 0; i < n - 1; i++) {
          const a = P[i], b = P[i + 1], R = 46;
          MG.each(gw, gh, HG, Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (k, x, y) => {
            const d = Math.sqrt(segDist2T(x, y, a[0], a[1], b[0], b[1], tt));
            if (d < RW[k]) { RW[k] = d; RH[k] = h[i] + (h[i + 1] - h[i]) * tt[0]; }
          });
        }
      }
      for (let k = 0; k < N; k++) {
        if (RW[k] >= 46 || RD[k] < 6) continue;
        const w = sstep(13, 44, RW[k]);
        E[k] = RH[k] + (E[k] - RH[k]) * w;
      }
      padIt();
      // ---- 7. a hold's front: a sheer dressed face cut back into the cliff, its
      // forecourt, a stair down to the yard, two towers standing out of the rock and
      // a stepped gable above the cliff's edge (painted by the terrain: paintMark)
      const HD = RF.hold;
      if (HD) MG.each(gw, gh, HG, HD.x - HD.w - 60, HD.face - 160, HD.x + HD.w + 60, HD.face + HD.court + HD.stair + 20, (k, x, y) => {
        const u = x - HD.x, au = Math.abs(u), back = HD.face - y;
        const tower = au >= HD.w - HD.tw && au <= HD.w;
        if (back <= 0) {
          if (tower && -back <= HD.td) { E[k] = HD.floor + HD.towerH; return; }
          if (au < HD.w - HD.tw && -back <= HD.court) { E[k] = HD.floor; return; }
          // the stair from the forecourt down to the yard
          if (au < HD.sw && -back <= HD.court + HD.stair) { E[k] = HD.floor + (HD.yard - HD.floor) * (-back - HD.court) / HD.stair; return; }
          return;
        }
        if (au > HD.w + 40) return;
        const side = 1 - sstep(HD.w, HD.w + 40, au);
        let want = Math.max(E[k], HD.floor + HD.faceH);
        if (tower && back < 22) want = Math.max(want, HD.floor + HD.towerH);
        // the gable: steps up toward the middle, a little way back into the shelf
        if (au < HD.gw && back < HD.gd) want = Math.max(want, HD.floor + HD.gableH - Math.floor(au / HD.gstep) * HD.gdrop);
        E[k] = E[k] + (want - E[k]) * side;
      });
      const tGen = performance.now() - t0;
      // ---- shading data: cast shadows (sun from the north-west), cavities, column bounds
      const SH = new Uint8Array(N), SHH = new Float32Array(N);
      const drop = HG * Math.SQRT2 * Math.tan(34 * Math.PI / 180);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const k = j * gw + i, e = E[k];
        const up = i > 0 && j > 0 ? SHH[k - gw - 1] - drop : -1e9;
        if (up > e) { SHH[k] = up; SH[k] = clamp(Math.round((up - e) / 10 * 255), 0, 255); } else { SHH[k] = e; SH[k] = 0; }
      }
      const AO = new Int8Array(N), BL = MG.blur(E, gw, gh, 7);
      for (let k = 0; k < N; k++) AO[k] = clamp(Math.round((E[k] - BL[k]) / 55 * 127), -127, 127);
      // scree: gentler, hollow ground close below steep ground (the foot of a cliff, a gully's fan)
      const SL = new Float32Array(N);
      for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) { const k = j * gw + i; const a = E[k + 1] - E[k - 1], b = E[k + gw] - E[k - gw]; SL[k] = Math.sqrt(a * a + b * b) / (2 * HG); }
      const SB = MG.blur(SL, gw, gh, 4), SC = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        const v = sstep(0.12, 0.5, SB[k] - SL[k]) * sstep(0.08, 0.25, SL[k]) * (1 - sstep(0.7, 1, SL[k])) * sstep(0.1, -0.35, AO[k] / 127);
        SC[k] = Math.round(clamp(v, 0, 1) * 255);
      }
      const smW = Math.ceil(W / 64) + 1, smH = Math.ceil(H / 64) + 1, SM = new Float32Array(smW * smH).fill(-1e9);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const v = E[j * gw + i], b = Math.floor(j * HG / 64);
        for (const s of [Math.floor((i * HG - HG) / 64), Math.floor((i * HG + HG) / 64)]) if (s >= 0 && s < smW && v > SM[b * smW + s]) SM[b * smW + s] = v;
      }
      for (let b = smH - 2; b >= 0; b--) for (let s = 0; s < smW; s++) SM[b * smW + s] = Math.max(SM[b * smW + s], SM[(b + 1) * smW + s]);
      // ---- the projection table: per grid column, ground y (×2) seen at each 4-unit row
      const upY0 = -480, upRY = 4, upRows = Math.ceil((H - upY0) / upRY) + 2, UP = new Uint16Array(gw * upRows).fill(65535);
      for (let i = 0; i < gw; i++) {
        let hz = Infinity, pY = 0, py = 0;
        const base = i * upRows;
        for (let yy = (gh - 1) * HG; yy >= 0; yy -= 2) {
          const fj = yy / HG, j = Math.min(gh - 2, fj | 0), t = fj - j;
          const Y = yy - (E[j * gw + i] * (1 - t) + E[(j + 1) * gw + i] * t);
          if (Y < hz) {
            if (hz !== Infinity) {
              const k0 = Math.max(0, Math.ceil((Y - upY0) / upRY)), k1 = Math.min(upRows - 1, Math.ceil((hz - upY0) / upRY) - 1);
              for (let k = k0; k <= k1; k++) { const Yr = upY0 + k * upRY, q = (Yr - pY) / (Y - pY); UP[base + k] = Math.round((py + (yy - py) * clamp(q, 0, 1)) * 2); }
            }
            hz = Y;
          }
          pY = Y; py = yy;
        }
      }
      const RW8 = new Uint8Array(N); for (let k = 0; k < N; k++) RW8[k] = Math.min(255, Math.round(RW[k] * 4));
      const R = new Relief({ W, H, HG, gw, gh, E, SH, AO, SC, SM, smW, smH, UP, upY0, upRY, upRows, RW8, ceiling: RF.ceiling || 500, snow: RF.snow || 460, treeLine: RF.treeLine || 330, RD, RW, marks: RF.marks || [], hold: RF.hold || null });
      R.stats = { genMs: Math.round(tGen), totalMs: Math.round(performance.now() - t0), cells: N, max: MG.max(E) };
      return R;
    },
    // visit grid cells inside a world rectangle: fn(k, x, y)
    each(gw, gh, HG, x0, y0, x1, y1, fn) {
      const i0 = clamp(Math.floor(x0 / HG), 0, gw - 1), i1 = clamp(Math.ceil(x1 / HG), 0, gw - 1), j0 = clamp(Math.floor(y0 / HG), 0, gh - 1), j1 = clamp(Math.ceil(y1 / HG), 0, gh - 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * gw + i, i * HG, j * HG);
    },
    // cells within dist of a polyline: fn(k, x, y, d)
    stampLine(gw, gh, HG, pts, R, fn) {
      const best = new Map(), tt = [0];
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s], b = pts[s + 1];
        MG.each(gw, gh, HG, Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (k, x, y) => {
          const d = Math.sqrt(segDist2T(x, y, a[0], a[1], b[0], b[1], tt));
          if (d < R) { const o = best.get(k); if (o === undefined || d < o) best.set(k, d); }
        });
      }
      for (const [k, d] of best) fn(k, (k % gw) * HG, ((k / gw) | 0) * HG, d);
    },
    densify(pts, step) {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
        for (let q = 0; q < n; q++) { const t = q / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] !== undefined ? a[2] + ((b[2] !== undefined ? b[2] : a[2]) - a[2]) * t : 0]); }
      }
      const l = pts[pts.length - 1]; out.push([l[0], l[1], l[2] || 0]);
      return out;
    },
    hAt(E, gw, gh, HG, x, y) {
      const fx = clamp(x / HG, 0, gw - 1.001), fy = clamp(y / HG, 0, gh - 1.001), i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * gw + i;
      return (E[k] * (1 - tx) + E[k + 1] * tx) * (1 - ty) + (E[k + gw] * (1 - tx) + E[k + gw + 1] * tx) * ty;
    },
    rdAt(A, gw, gh, HG, x, y) { const i = clamp(Math.round(x / HG), 0, gw - 1), j = clamp(Math.round(y / HG), 0, gh - 1); return A[j * gw + i]; },
    blur(E, gw, gh, r) {
      const A = new Float32Array(E.length), B = new Float32Array(E.length);
      for (let j = 0; j < gh; j++) { let s = 0; const row = j * gw; for (let i = -r; i <= r; i++) s += E[row + clamp(i, 0, gw - 1)]; for (let i = 0; i < gw; i++) { A[row + i] = s / (2 * r + 1); s += E[row + clamp(i + r + 1, 0, gw - 1)] - E[row + clamp(i - r, 0, gw - 1)]; } }
      for (let i = 0; i < gw; i++) { let s = 0; for (let j = -r; j <= r; j++) s += A[clamp(j, 0, gh - 1) * gw + i]; for (let j = 0; j < gh; j++) { B[j * gw + i] = s / (2 * r + 1); s += A[clamp(j + r + 1, 0, gh - 1) * gw + i] - A[clamp(j - r, 0, gh - 1) * gw + i]; } }
      return B;
    },
    max(E) { let m = -1e9; for (let k = 0; k < E.length; k++) if (E[k] > m) m = E[k]; return m; },
    curve,
  };
  AS.MountainGen = MG;
  AS.Relief = Relief;
})(window.AS);

/* ================= the terrain: projected chunks over a heightfield ================= */
(function (AS) {
  if (!AS.RealmTerrain) return;
  const U = AS.U, CH = 256, GC = 32;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const GRIDS = ['gWater', 'gMount', 'gForest', 'gBiome', 'gRoad', 'gField'];
  // sun from the north-west, high: the same light the sprites are forged with
  const LX = -0.46, LY = -0.56, LZ = 0.69, LN = Math.hypot(LX, LY, LZ);
  const HAZE = [122, 140, 166];

  class MountainTerrain extends AS.RealmTerrain {
    /* page: (world, map, relief) — the relief comes built (AS.MountainGen.build);
     * worker: (world, map) — map.reliefData is its plain data */
    constructor(world, map, relief) {
      super(world, map);
      this.isMountain = true;
      this.R = relief || new AS.Relief(map.reliefData);
      // the authored lookups (water, forest, biome, road…) are in ground space
      this.G = {}; for (const k of GRIDS) this.G[k] = this[k];
      this.P = null;
      this.pass = null; // troop footing, cached per 16-unit projected cell
      if (relief) this.buildProjected();
    }
    /* the same lookups resampled in projected space: what everything standing on the
     * ground (settlements, troops, wildlife, the war map) reads */
    buildProjected() {
      const gw = this.gw, gh = this.gh, N = gw * gh, R = this.R, G = this.G;
      const P = { gWater: new Float32Array(N), gMount: new Float32Array(N), gForest: new Float32Array(N), gBiome: new Float32Array(N * 5), gRoad: new Float32Array(N), gField: new Uint8Array(N) };
      const bw = new Float32Array(5);
      this.useGround(true);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const k = j * gw + i, x = (i - 1) * GC + GC / 2, Y = (j - 1) * GC + GC / 2;
        let gy = R.unproj(clamp(x, 0, this.W), Y);
        const none = gy !== gy;
        if (none) gy = clamp(Y + 300, 0, this.H);
        P.gWater[k] = none ? 2000 : this.gs(G.gWater, x, gy);
        P.gMount[k] = clamp((R.h(x, gy) - 260) / 300, 0, 1.3);
        P.gForest[k] = none ? 0 : this.gs(G.gForest, x, gy);
        P.gRoad[k] = none ? 1e9 : this.gs(G.gRoad, x, gy);
        P.gField[k] = none ? 0 : this.gn(G.gField, x, gy);
        this.biomeAt(x, gy, bw);
        for (let q = 0; q < 5; q++) P.gBiome[k * 5 + q] = bw[q];
      }
      this.P = P;
      this.useGround(false);
    }
    // which lookups the shared RealmTerrain code reads: ground (rasterising) or projected (gameplay)
    useGround(on) {
      const S = on ? this.G : this.P;
      if (!S) return;
      for (const k of GRIDS) this[k] = S[k];
    }
    asyncInit() {
      if (this._wk !== undefined) return !!this._wk;
      this.useGround(true);
      try { return super.asyncInit(); } finally { this.useGround(false); }
    }

    /* ---------- gameplay queries (projected coordinates in, as everywhere) ---------- */
    groundY(x, Y) { return this.R.unproj(x, Y); }
    heightAt(x, Y) { const gy = this.R.unproj(x, Y); return gy === gy ? this.R.h(x, gy) : 0; }
    field(x, y, out) { out[0] = 0.45; out[1] = 0.5; out[2] = this.gs(this.gWater, x, y); out[3] = this.gs(this.gForest, x, y); return out; }
    levelOf() { return 1; }
    kindAt(x, Y) {
      if (x < 0 || Y < 0 || x > this.W || Y > this.H) return 5;
      const gy = this.R.unproj(x, Y);
      if (gy !== gy) return 5;
      return this.gs(this.G.gWater, x, gy) < 0 ? 1 : 0;
    }
    groundPassable(x, Y) {
      const k = this.kindFast(x, Y);
      if (k === 5) return false;
      if (k === 1) return this.frozenAt(x, Y) || this.onBridge(x, Y);
      return this.footing(x, Y);
    }
    /* can a soldier stand here? Not on a slope steeper than ~27° (except on a road),
     * not on the broken high ground of the ranges, not across a ridge line (where
     * the visible ground jumps from one slope to another far behind it) */
    footing(x, Y) {
      if (!this.pass) { this.passW = Math.ceil(this.W / 16) + 1; this.pass = new Uint8Array(this.passW * (Math.ceil(this.H / 16) + 1)); }
      const ci = clamp(Math.floor(x / 16), 0, this.passW - 1), cj = clamp(Math.floor(Y / 16), 0, (this.pass.length / this.passW | 0) - 1), key = cj * this.passW + ci;
      let v = this.pass[key];
      if (!v) { v = this.footingAt(ci * 16 + 8, cj * 16 + 8) ? 2 : 1; this.pass[key] = v; }
      return v === 2;
    }
    footingAt(x, Y) {
      const R = this.R, gy = R.unproj(x, Y);
      if (gy !== gy) return false;
      const a = R.unproj(x, Y - 7), b = R.unproj(x, Y + 7);
      if (a !== a || b !== b || b - a > 34 || b < a) return false;
      const s = R.slope(x, gy), road = this.gs(this.G.gRoad, x, gy) < 22;
      if (road) return s < 0.62;
      if (s > 0.5) return false;
      if (R.h(x, gy) > 285 && s > 0.27) return false;
      return true;
    }
    /* the walking grid (nav.js): a cell is open if a soldier can stand somewhere in it
     * (sampled 4 × 4: mountain roads are narrower than a cell), cheap along a road */
    navCost(x, Y, cell) {
      let ok = 0, road = 0, bridge = false;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const px = x - cell / 2 + (i + 0.5) * cell / 4, py = Y - cell / 2 + (j + 0.5) * cell / 4;
        if (this.groundPassable(px, py)) { ok++; if (this.gs(this.gRoad, px, py) < 24) road++; }
        else if (!bridge && this.onBridge(px, py)) bridge = true;
      }
      if (bridge) return 1;
      if (!ok) return 0;
      if (road) return 0.5;
      return ok >= 8 ? 1.1 : 1.6;
    }
    // where in a cell to walk: the passable sample nearest its centre (a road sample first)
    navPoint(x, Y, cell) {
      let best = null, bd = Infinity;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const px = x - cell / 2 + (i + 0.5) * cell / 4, py = Y - cell / 2 + (j + 0.5) * cell / 4;
        if (!this.groundPassable(px, py)) continue;
        const d = Math.hypot(px - x, py - Y) + (this.gs(this.gRoad, px, py) < 24 ? 0 : 40);
        if (d < bd) { bd = d; best = [px, py]; }
      }
      return best;
    }
    // ground distance per projected distance (a march up a south face covers more screen than ground)
    moveScale(x, Y, dx, dy) {
      const R = this.R, gy = R.unproj(x, Y);
      if (gy !== gy) return 1;
      const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, g = R.grad(x, gy, this._mg || (this._mg = [0, 0]));
      // a unit step in projected y is 1/(1 − dE/dy) in ground y
      const den = 1 - g[1];
      const gdy = uy / (den > 0.2 ? den : 0.2), gdx = ux;
      const run = Math.hypot(gdx, gdy), rise = g[0] * gdx + g[1] * gdy, dist = Math.hypot(run, rise);
      // climbing is slower; the march covers ground distance, whatever the screen shows
      const climb = rise > 0 ? 1 / (1 + 1.2 * rise / Math.max(0.05, run)) : 1;
      return clamp(climb / dist, 0.25, 1.4);
    }

    /* ---------- chunks ---------- */
    *genChunk(cx, cy) { this.texel(); return this.renderChunk(cx, cy, this.TD); }
    quickChunk(cx, cy) { return this.renderChunk(cx, cy, 0.375, true); }
    newCanvas(n) { return typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined' ? new OffscreenCanvas(n, n) : AS.Forge.canvas(n, n); }
    /* rasterise one chunk of projected space: march every pixel column from the
     * viewer's side, keep the horizon, colour the ground each pixel shows */
    renderChunk(cx, cy, TD, quick) {
      const R = this.R, N = Math.round(CH * TD), x0 = cx * CH, Y0 = cy * CH;
      const MT = 6, MB = quick ? 4 : 52, ML = quick ? 0 : 18, MR = ML;
      const cols = N + Math.round((ML + MR) * TD), rows = N + Math.round((MT + MB) * TD), oc = Math.round(ML * TD), orow = Math.round(MT * TD);
      const B = this._rbuf && this._rbuf.n >= cols * rows ? this._rbuf : (this._rbuf = { n: cols * rows, GY: new Float32Array(cols * rows) });
      const GY = B.GY;
      GY.fill(NaN, 0, cols * rows);
      const HG = R.HG, gw = R.gw, gh = R.gh, E = R.E, H = this.H;
      const Ytop = Y0 - MT, step = Math.min(1, 0.9 / TD);
      for (let c = 0; c < cols; c++) {
        const x = x0 - ML + (c + 0.5) / TD;
        let fx = clamp(x / HG, 0, gw - 1.001); const i = fx | 0, tx = fx - i;
        const Ybot = Y0 + CH + MB;
        let y = Math.min(H, Ybot + R.southMax(x, Ytop) + 4), hz = Infinity, pY = 0, py = 0, first = true;
        for (; y >= 0; y -= step) {
          let fy = y / HG; if (fy > gh - 1.001) fy = gh - 1.001;
          const j = fy | 0, ty = fy - j, k = j * gw + i;
          const e = (E[k] * (1 - tx) + E[k + 1] * tx) * (1 - ty) + (E[k + gw] * (1 - tx) + E[k + gw + 1] * tx) * ty;
          const Y = y - e, r = (Y - Ytop) * TD - 0.5;
          if (r < hz) {
            const r0 = Math.max(0, Math.ceil(r)), r1 = Math.min(rows - 1, hz === Infinity ? rows - 1 : Math.ceil(hz) - 1);
            for (let q = r0; q <= r1; q++) {
              const Yr = Ytop + (q + 0.5) / TD;
              GY[q * cols + c] = first ? y : py + (y - py) * clamp((Yr - pY) / (Y - pY), 0, 1);
            }
            hz = r;
            if (hz <= 0) break;
          }
          first = false; pY = Y; py = y;
        }
      }
      // colour the chunk's own pixels
      const cv = this.newCanvas(N), ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), D = img.data;
      this.useGround(true);
      const out = [0, 0, 0], g = [0, 0], sd = this.seed;
      const marks = this.marksNear(x0 - 40, Y0 - 40, x0 + CH + 40, Y0 + CH + 1200);
      for (let r = 0; r < N; r++) {
        const br = r + orow;
        for (let c = 0; c < N; c++) {
          const q = (r * N + c) * 4, x = x0 + (c + 0.5) / TD, gy = GY[br * cols + c + oc];
          if (gy !== gy) { D[q] = HAZE[0] * 0.7; D[q + 1] = HAZE[1] * 0.7; D[q + 2] = HAZE[2] * 0.75; D[q + 3] = 255; continue; }
          this.shadeAt(x, gy, out, g, sd, marks, quick);
          // ridge lines: the far ground just above a crest darkens, the crest catches the light
          const below = br + 1 < rows ? GY[(br + 1) * cols + c + oc] : gy, above = br > 0 ? GY[(br - 1) * cols + c + oc] : gy;
          let k = 1;
          if (below - gy > 26 / Math.max(0.5, TD) + 18) k = 0.62;
          else if (gy - above > 26 / Math.max(0.5, TD) + 18) k = 1.16;
          else if (br + 2 < rows && GY[(br + 2) * cols + c + oc] - gy > 44 + 26 / Math.max(0.5, TD)) k = 0.8;
          D[q] = out[0] * k; D[q + 1] = out[1] * k; D[q + 2] = out[2] * k; D[q + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (!quick) { try { this.stampTrees(ctx, cx, cy, TD, GY, cols, rows, oc, orow); } catch (e) { /* decor is cosmetic */ } }
      this.useGround(false);
      return cv;
    }
    marksNear(x0, y0, x1, y1) {
      const out = [];
      for (const m of this.R.marks) { const mx = m.x, my = m.y; if (mx + 260 > x0 && mx - 260 < x1 && my + 60 > y0 - 1200 && my - 600 < y1) out.push(Object.assign({ e0: this.R.h(m.x, m.y + 6) }, m)); }
      return out;
    }
    /* the colour of the ground at ground point (x, y) → out (lit, hazed) */
    shadeAt(x, y, out, g, sd, marks, quick) {
      const R = this.R, G = this.G, e = R.h(x, y);
      R.grad(x, y, g);
      const s2 = Math.sqrt(g[0] * g[0] + g[1] * g[1]);
      // where this ground shows on screen: texture laid out in (x, Y) is never stretched,
      // however steep the face it lies on
      const Y = y - e;
      const wd = this.gs(G.gWater, x, y), fo = this.gs(G.gForest, x, y);
      const m = 0.5 + 0.6 * U.fbm(x / 600, y / 600, 2, sd + 40);
      this.colorize(x, Y, 0.45, m, wd, fo, 1, out);
      let r = out[0], gg = out[1], b = out[2];
      const ao = clamp(R.ao(x, y), -1, 1);
      const nb = U.noise2(x / 52, Y / 40, sd + 80); // breaks up every transition
      // height reads as colour: lush, warm valley floors; paler, cooler heights
      const lowK = 1 - sstep(60, 330, e);
      r *= 1 - 0.05 * lowK; gg *= 1 + 0.05 * lowK; b *= 1 - 0.04 * lowK;
      // alpine meadow above the tree line: thin, tawny grass (a ragged edge, not a band)
      const alp = sstep(R.treeLine - 80, R.treeLine + 90, e + nb * 45);
      if (alp > 0 && wd > 0) { r = lerp(r, 140, alp * 0.55); gg = lerp(gg, 134, alp * 0.55); b = lerp(b, 96, alp * 0.55); }
      // the turf is never one smooth colour: clumps, bare patches, stones
      if (wd > 0 && !quick) {
        const cl = U.noise2(x / 9, Y / 6, sd + 77) * 0.07 + U.noise2(x / 31, Y / 22, sd + 76) * 0.06;
        r *= 1 + cl; gg *= 1 + cl; b *= 1 + cl * 0.8;
        if (alp > 0.3 && U.hash2((x / 3) | 0, (Y / 2.4) | 0, sd + 75) > 0.988) { r = 150; gg = 146; b = 136; }
      }
      // river banks: gravel and shingle rather than crags
      const bank = wd > 0 ? 1 - sstep(40, 150, wd) : 0;
      // bare rock: crags break through the turf in ragged patches on steep ground, and
      // take over high up
      let rockT = sstep(0.53, 0.6, s2 + nb * 0.18 + U.noise2(x / 13, Y / 9, sd + 78) * 0.12 - Math.max(0, -ao) * 0.1);
      rockT = Math.max(rockT, sstep(R.snow - 95, R.snow + 20, e + nb * 40) * (0.55 + 0.35 * sstep(-0.2, 0.5, U.noise2(x / 130, Y / 110, sd + 79))));
      if (wd < 6) rockT *= 0.3;
      rockT *= 1 - 0.75 * bank;
      let ledge = 0, fdx = 0, fdy = 0;
      if (rockT > 0.01 && quick) {
        // (a stand-in: plain rock, no texture)
        r = lerp(r, 128, rockT); gg = lerp(gg, 122, rockT); b = lerp(b, 114, rockT);
      } else if (rockT > 0.01) {
        // broken rock: big irregular masses, wider than tall (bedded rock), each tilted
        // to the light its own way; a fracture shows only where two masses differ
        const fx = x / 44, fy = Y / 19, ix = Math.floor(fx), iy = Math.floor(fy);
        let d1 = 9, d2 = 9, id = 0, id2 = 0, dyN = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const cx = ix + ox, cy = iy + oy;
          const dx = cx + U.hash2(cx, cy, sd + 501) - fx, dy = cy + U.hash2(cx, cy, sd + 502) - fy;
          const d = dx * dx + dy * dy * 1.3;
          if (d < d1) { d2 = d1; id2 = id; d1 = d; id = cx * 7919 + cy; dyN = dy; } else if (d < d2) { d2 = d; id2 = cx * 7919 + cy; }
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1), hf = U.hash2(id, 3, sd + 503), hf2 = U.hash2(id2, 3, sd + 503);
        // finer chips inside each mass, and sparse fissures
        const chip = U.noise2(x / 7, Y / 4.5, sd + 505), fis = U.ridged(x / 60 + U.noise2(x / 120, Y / 120, sd + 506), Y / 26, 2, sd + 507);
        // strata: beds at a constant height, broken along their length
        const bed = U.noise2(e / 10, x / 800, sd + 82) * sstep(-0.2, 0.4, U.noise2(x / 300, e / 60, sd + 83));
        let k = 0.88 + hf * 0.16 + bed * 0.08 + chip * 0.05 + U.noise2(x / 160, Y / 120, sd + 508) * 0.08;
        if (edge < 0.045 && Math.abs(hf - hf2) > 0.42 && s2 > 0.5) k *= 0.76 + edge * 5;
        else if (dyN > 0.3 && edge < 0.12) k *= 1.06; // a mass's lit upper lip
        if (fis > 0.9) k *= 0.8;
        ledge = sstep(0.55, 0.68, U.noise2(x / 240, e / 8, sd + 95)) * sstep(0.45, 0.9, s2);
        k += ledge * 0.12;
        const warm = sstep(-0.3, 0.6, U.noise2(x / 700, y / 700, sd + 85));
        let rr = lerp(118, 142, warm) * k, rg = lerp(116, 128, warm) * k, rb = lerp(118, 106, warm) * k;
        // lichen on the lower crags
        const lich = sstep(0.35, 0.8, U.noise2(x / 24, Y / 18, sd + 87)) * (1 - sstep(260, 460, e)) * 0.35;
        rr = lerp(rr, 122, lich); rg = lerp(rg, 132, lich); rb = lerp(rb, 80, lich);
        r = lerp(r, rr, rockT); gg = lerp(gg, rg, rockT); b = lerp(b, rb, rockT);
        fdx = (hf - 0.5) * 0.8 * rockT; fdy = (U.hash2(id, 5, sd + 504) - 0.5) * 0.5 * rockT;
      }
      // grass holds on the ledges and gentler steps among the rock
      if (rockT > 0.2 && wd > 0 && e < R.treeLine + 120 && !quick) {
        const tuft = sstep(0.15, 0.55, U.noise2(x / 14, Y / 9, sd + 88)) * (1 - sstep(0.55, 0.95, s2)) * 0.55 * rockT;
        r = lerp(r, 104, tuft); gg = lerp(gg, 122, tuft); b = lerp(b, 66, tuft);
      }
      // scree: loose stone fanned out below the cliffs
      const sc = R.SC ? R.samp8(R.SC, x, y) / 255 : 0;
      if ((sc > 0.02 || bank > 0.05) && wd > 4) {
        const t = Math.max(sstep(0.05, 0.6, sc + nb * 0.25), bank * sstep(0.18, 0.5, s2) * 0.9);
        const k = quick ? 0.95 : 0.8 + U.hash2((x / 2.6) | 0, (Y / 2.2) | 0, sd + 89) * 0.3 - (U.hash2((x / 5) | 0, (Y / 4) | 0, sd + 90) > 0.86 ? 0.2 : 0);
        r = lerp(r, 150 * k, t); gg = lerp(gg, 144 * k, t); b = lerp(b, 132 * k, t);
      }
      // snow: lower on north-facing slopes and in hollows; on the steep faces it lies only
      // on ledges and in gullies; the wind scours the sharp crests
      const line = R.snow + U.noise2(x / 320, y / 320, sd + 86) * 38 + nb * 22 - (g[1] > 0.15 ? 30 : 0) + (g[1] < -0.4 ? 18 : 0) - Math.max(0, -ao) * 40;
      const steep = sstep(0.75, 1.3, s2);
      let sn = sstep(line - 14, line + 22, e) * (1 - steep) + sstep(line - 120, line, e) * steep * Math.max(ledge, sstep(0.2, 0.55, U.noise2(x / 26, Y / 16, sd + 98)) * 0.75);
      sn *= 1 - 0.45 * sstep(0.35, 0.8, ao) * sstep(0.3, 0.7, s2);
      if (sn > 0) {
        const sp = U.hash2((x * 1.3) | 0, (y * 1.3) | 0, sd + 87) > 0.992 ? 14 : 0;
        const blue = sstep(0.2, 0.9, g[1]) * 0.18; // shaded snow is blue
        r = lerp(r, (236 + sp) * (1 - blue), sn); gg = lerp(gg, (241 + sp) * (1 - blue * 0.6), sn); b = lerp(b, 250, sn);
        fdx *= 1 - sn; fdy *= 1 - sn;
      }
      // falling water: white streaks where the river runs down a steep face
      if (wd < 2 && s2 > 0.45) {
        const st = 0.6 + 0.4 * U.noise2(x / 3.5, e / 40, sd + 88);
        const t = Math.min(1, (s2 - 0.45) * 2.2) * st;
        r = lerp(r, 232, t); gg = lerp(gg, 242, t); b = lerp(b, 248, t);
      }
      // the road: packed earth in the valleys, worn stone up in the mountains
      if (wd > -2) {
        const rd = R.RW8 ? R.samp8(R.RW8, x, y) / 4 : this.gs(G.gRoad, x, y);
        if (rd < 13) {
          const t = 1 - sstep(8.5, 12.5, rd), hi = sstep(220, 380, e);
          const rut = Math.abs(rd - 4.5) < 1.1 ? 0.86 : 1, cob = hi > 0.3 && U.hash2((x / 2.4) | 0, (y / 2.4) | 0, sd + 89) > 0.7 ? 1.1 : 1;
          const kr = lerp(160, 150, hi) * rut * cob, kg = lerp(136, 142, hi) * rut * cob, kb = lerp(96, 128, hi) * rut * cob;
          r = lerp(r, kr, t); gg = lerp(gg, kg, t); b = lerp(b, kb, t);
          if (rd > 9.5 && rd < 12.5) { r *= 0.86; gg *= 0.86; b *= 0.86; }
        }
      }
      // carved stone and cave mouths on the faces
      this._em = null;
      if (marks.length) for (const mk of marks) if (this.paintMark(mk, x, y, e, s2, out, r, gg, b)) { r = out[0]; gg = out[1]; b = out[2]; fdx = fdy = 0; break; }
      // light: sun, cast shadow, cavities
      const gx = g[0] + fdx, gy2 = g[1] + fdy;
      const nl = Math.hypot(gx, gy2, 1), ndl = (-gx * LX - gy2 * LY + LZ) / (nl * LN);
      // (a south face, turned to the viewer, takes some light from the sky and the valley)
      const south = Math.max(0, -gy2) / nl;
      let lit = (0.52 + 0.66 * Math.max(0, ndl) + 0.26 * south) / (0.52 + 0.66 * (LZ / LN));
      lit *= 1 - 0.46 * R.shadow(x, y) * (1 - 0.3 * sstep(0.8, 2, s2));
      lit *= 1 + 0.3 * ao;
      // air: the valleys sit in a blue haze, the heights in clear, cool light
      const hz = 0.2 * (1 - sstep(20, 460, e));
      const hl = 1 + sstep(380, 900, e) * 0.08;
      out[0] = lerp(r * lit, HAZE[0], hz) * hl; out[1] = lerp(gg * lit, HAZE[1], hz) * hl; out[2] = lerp(b * lit, HAZE[2], hz) * (hl + sstep(420, 900, e) * 0.03);
      // what shines by its own light (fire in the hold, runes, lit windows)
      const em = this._em;
      if (em) { out[0] += em[0]; out[1] += em[1]; out[2] += em[2]; }
      void quick;
      return out;
    }
    /* face art at (x, y): the hold's carved front, a cave mouth. Writes out and returns true when painted */
    paintMark(mk, x, y, e, s2, out, r, g, b) {
      if (mk.k === 'facade') return this.paintHold(x, y, e, s2, out, r, g, b);
      const u = x - mk.x, v = e - mk.e0;
      if (y > mk.y + 10) return false;
      if (mk.k === 'cave') {
        if (Math.abs(u) > mk.w * 1.6 || v < -2 || v > mk.w * 2.2) return false;
        const sd = this.seed, rr = mk.w * (1 + U.noise2(u / 9, v / 9, sd + 90) * 0.18);
        const d = Math.hypot(u, (v - rr * 0.35) * 1.25) / rr;
        if (d < 1) {
          const k = 0.12 + 0.18 * sstep(0.4, 1, d);
          out[0] = 40 * k + 10; out[1] = 34 * k + 8; out[2] = 30 * k + 8; return true;
        }
        if (d < 1.25) { const k = 0.7 + (d - 1) * 1.2; out[0] = r * k; out[1] = g * k; out[2] = b * k; return true; }
        return false;
      }
      return false;
    }
    /* KHAZ DURN's front (map.relief.hold): the dressed face with its gate, the carved
     * king's head over it, pilasters and lattice panels, the two towers with their
     * banners, lit windows and battlements, the stepped gable, the paved forecourt,
     * the stair and the yard. (u across, v up from the forecourt floor) */
    paintHold(x, y, e, s2, out, r, g, b) {
      const H = this.R.hold;
      if (!H) return false;
      const u = x - H.x, au = Math.abs(u), back = H.face - y;
      if (au > H.w + 300 || back > 130 || back < -(H.court + H.stair + 380)) return false;
      const sd = this.seed, v = e - H.floor, W = H.w, tw = H.tw;
      const tower = au >= W - tw && au <= W && back > -H.td - 3 && back < 27;
      const em = (cr, cg, cb) => { this._em = [cr, cg, cb]; };
      const put = (cr, cg, cb) => { out[0] = cr; out[1] = cg; out[2] = cb; return true; };
      // ashlar: courses of dressed blocks; a joint darkens, each block its own tone
      const ashlar = (uu, vv, bl, ch, base) => {
        const c = Math.floor(vv / ch), off = (c % 2) * bl * 0.5, bu = uu + off + 4000, bi = Math.floor(bu / bl);
        let k = 0.9 + U.hash2(c, bi, sd + 91) * 0.16;
        if (vv - c * ch < 1.1 || bu - bi * bl < 1.2) k *= 0.7;
        k *= 1 - 0.1 * sstep(0.2, 0.8, U.noise2(uu / 7, vv / 46, sd + 92)); // rain streaks
        return [base[0] * k, base[1] * k, base[2] * k];
      };
      const STONE = [156, 148, 134], DARK = [26, 22, 20];
      // ---------------- the ground in front of the face ----------------
      if (s2 < 0.55 && !tower && back <= 2) {
        const d = -back;
        if (au < W - tw && d <= H.court) {
          // the forecourt: great flagstones, a darker border, an inlaid ring of runes
          const cu = u + 4000, fi = Math.floor(cu / 17), fj = Math.floor((d + (fi % 2) * 6) / 13);
          let k = 0.88 + U.hash2(fi, fj, sd + 93) * 0.14;
          if (cu - fi * 17 < 1.2 || (d + (fi % 2) * 6) - fj * 13 < 1.2) k *= 0.72;
          if (au > W - tw - 14 || d > H.court - 10) k *= 0.82;
          let c = [168 * k, 160 * k, 146 * k];
          const rc = Math.hypot(u, (d - H.court * 0.52) * 1.15);
          if (rc > 30 && rc < 38) { c = [118, 112, 104]; if (U.hash2(Math.floor(Math.atan2(d - H.court * 0.52, u) * 9), 1, sd + 94) > 0.5 && rc > 32 && rc < 36) { c = [96, 140, 160]; em(18, 46, 60); } }
          return put(c[0], c[1], c[2]);
        }
        if (au < H.sw && d <= H.court + H.stair) {
          // the stair: treads and risers, low walls either side
          const t = d - H.court, st = Math.floor(t / 4.5), f = t - st * 4.5;
          let k = f < 1.4 ? 0.7 : 0.98 + (st % 2) * 0.05;
          if (au > H.sw - 5) k = 0.8;
          return put(160 * k, 152 * k, 138 * k);
        }
        // the yard: worn cobbles, rutted where the carts come and go
        const yc = Math.hypot(u * 0.9, d - 210);
        if (yc < 250 + U.noise2(u / 40, d / 40, sd + 95) * 22 && (d < 328 || (au < 60 + (d - 328) * 0.6 && d < 400))) {
          const ci = Math.floor((u + 4000) / 6), cj = Math.floor((d + (ci % 2) * 3) / 5);
          let k = 0.84 + U.hash2(ci, cj, sd + 96) * 0.18;
          if (U.hash2(ci, cj, sd + 97) > 0.93) k *= 0.8;
          const ed = sstep(250, 210, yc);
          return put(lerp(r, 150 * k, ed * 0.85), lerp(g, 140 * k, ed * 0.85), lerp(b, 124 * k, ed * 0.85));
        }
        return false;
      }
      // retaining walls round the forecourt and the yard: coursed masonry
      if (!tower && back < -2) {
        if (s2 < 0.55 || au > W + 260) return false;
        const c = ashlar(u, v + 40, 15, 7, [140, 134, 122]);
        return put(c[0], c[1], c[2]);
      }
      // ---------------- the towers ----------------
      if (tower) {
        const tu = au - (W - tw), tc = tu - tw / 2;
        if (s2 < 0.55) {
          // the tower top: flags inside a parapet
          if (v < H.towerH - 8) return false;
          const rim = tu < 6 || tu > tw - 6 || back > 16 || back < -H.td + 6;
          if (rim) { const mer = ((tu + (back + 400)) % 14) < 8; return put(mer ? 170 : 92, mer ? 162 : 86, mer ? 148 : 80); }
          const k = 0.8 + U.hash2(Math.floor(x / 9), Math.floor(y / 9), sd + 98) * 0.1;
          return put(118 * k, 112 * k, 104 * k);
        }
        let c = ashlar(u, v, 16, 10, STONE);
        if (v < 24) c = ashlar(u, v, 24, 12, [146, 140, 128]); // the battered plinth
        if (tu < 6 || tu > tw - 6) { const q = Math.floor(v / 10) % 2; c = ashlar(u + q * 5, v, 10, 10, [168, 160, 146]); } // quoins
        // string courses carved with chevrons
        for (const sv of [96, 190]) if (v > sv && v < sv + 6) { const ch = Math.abs(((u + 4000) % 8) - 4) - (v - sv - 1); c = ch < 1.2 && ch > -1.2 ? [112, 106, 96] : [176, 168, 152]; }
        // machicolations and battlements
        if (v > 260 && v < 272) { const q = (tu + 1000) % 8; c = q < 4 ? [182, 172, 156] : [70, 64, 58]; if (v < 263) c = [52, 46, 42]; }
        if (v > 282) { const q = (tu + 1000) % 14; if (q > 8) c = [c[0] * 0.55, c[1] * 0.55, c[2] * 0.58]; }
        // the banner of the hold: dwarf red, a gold border and the anvil
        if (v > 150 && v < 252 && Math.abs(tc) < 10 - (v < 160 ? (160 - v) * 0.6 : 0)) {
          const edge = Math.abs(tc) > 8 || v > 248;
          c = edge ? [196, 150, 60] : [138, 40, 32];
          const av = v - 200;
          if (!edge && ((av > -4 && av < 4 && Math.abs(tc) < 6) || (av > -12 && av <= -4 && Math.abs(tc) < 2.5) || (av > -16 && av <= -12 && Math.abs(tc) < 5))) c = [214, 170, 70];
        }
        // windows: arrow slits low and high, lit lancets between
        if (Math.abs(tc) < 2.2 && ((v > 46 && v < 72) || (v > 216 && v < 238))) { c = DARK; }
        if (Math.abs(tc) < 6 && v > 112 && v < 138 + Math.sqrt(Math.max(0, 36 - tc * tc)) && !(v > 150)) { c = [60, 34, 18]; em(150, 82, 30); }
        return put(c[0], c[1], c[2]);
      }
      // ---------------- the face ----------------
      if (s2 < 0.55) {
        // the gable's steps and the cornice: coping stones
        if (au < H.gw && back > 0 && back < H.gd + 6 && v > H.faceH + 6) { const k = 0.9 + U.hash2(Math.floor(x / 8), 2, sd + 99) * 0.1, j = ((x + 4000) % 8) < 1 ? 0.8 : 1; return put(146 * k * j, 140 * k * j, 128 * k * j); }
        return false;
      }
      if (au > W + 6 || back < -3) return false;
      let c = ashlar(u, v, 22, 12, STONE);
      if (v < 14) c = ashlar(u, v, 30, 14, [138, 132, 120]); // the plinth
      // the cornice over the face
      if (v > H.faceH - 8 && v <= H.faceH + 1) c = v > H.faceH - 3 ? [184, 176, 160] : [78, 72, 66];
      // the gable over the cornice (above the cliff's edge): stepped, each step capped
      if (v > H.faceH + 1) {
        const step = Math.floor(au / H.gstep), topv = H.gableH - step * H.gdrop - H.floor + H.floor;
        c = ashlar(u, v, 18, 11, [150, 144, 132]);
        if (v > topv - 6) c = [178, 170, 156];
      }
      // ---- the king's head over the gate: helm, brow, burning eyes, nose, beard to the lintel
      const hv = v - 170;
      if (au < 44 && hv > 0 && hv < 104) {
        const fw = 40 - Math.max(0, hv - 80) * 0.6; // the helm narrows at the crown
        if (au < fw) {
          let fc = [164, 156, 140];
          if (hv < 36) { // the beard: braids, zig-zag plaited
            const bw = 36 - (36 - hv) * 0.35;
            if (au < bw) { const br = Math.floor((u + 400) / 8), z = (hv + Math.abs(((u + 400) % 8) - 4) * 1.5) % 6; fc = z < 2 ? [118, 110, 100] : [170 + (br % 2) * 8, 162 + (br % 2) * 8, 146]; }
          } else if (hv < 44) { fc = [180, 172, 156]; if (Math.abs(au - 16) < 14 && hv > 39) fc = [120, 112, 102]; } // the moustache
          else if (hv < 60) { if (au < 6) fc = [182, 174, 158]; else if (au < 8) fc = [110, 104, 96]; } // the nose
          if (hv >= 56 && hv < 66 && au > 8 && au < 26) { // the eyes, burning deep in the stone
            const ec = Math.hypot(au - 17, (hv - 61) * 1.4);
            fc = [26, 20, 18]; if (ec < 4) { fc = [90, 40, 16]; em(170, 80, 20); }
          }
          if (hv >= 66 && hv < 74) fc = [128, 120, 110]; // the brow
          if (hv >= 74) { fc = [128, 130, 138]; if (hv < 78) fc = [168, 170, 176]; else if ((Math.floor(u + 400) % 9) === 0 && hv < 82) fc = [190, 186, 170]; } // the helm: a riveted rim
          if (hv > 4 && hv < 100) c = fc;
        }
      }
      // ---- the gate: a tall trapezoid portal in three receding orders, the halls glowing beyond
      const PH = 132, hw = 44 - v * 0.06;
      if (v < PH + 22 && au < hw + 24) {
        if (au < hw && v < PH) {
          // inside: the vaults run back into the dark; firelight from the deep halls
          const t = Math.max(au / hw, v / PH), ring = (t * 5) % 1;
          let cr = 20, cg = 16, cb = 15;
          if (ring < 0.07 && t > 0.2) { cr = 40; cg = 32; cb = 28; }
          const glow = Math.pow(1 - v / PH, 1.4) * (1 - (au / hw) * (au / hw)) * (1 - t * 0.5);
          // the great doors, swung back against the jambs: bronze with iron bands and studs
          if (au > hw * 0.72 && v < PH - 6) {
            const bandV = (v % 22) < 3, stud = (Math.floor(v) % 11 === 5) && Math.abs(au - hw * 0.86) < 1.2;
            cr = 92; cg = 66; cb = 38; if (bandV) { cr = 54; cg = 50; cb = 50; } if (stud) { cr = 150; cg = 120; cb = 70; }
            em(26 * glow, 12 * glow, 4 * glow);
          } else em(210 * glow, 100 * glow, 36 * glow);
          return put(cr, cg, cb);
        }
        // the orders: deepest (shadowed) to outermost (lit, carved with runes)
        const o = Math.max(au - hw, v - PH);
        if (o < 8) c = [c[0] * 0.62, c[1] * 0.6, c[2] * 0.6];
        else if (o < 16) c = [140, 134, 122];
        else { c = [176, 168, 152]; if (((Math.floor(v / 6) + Math.floor(au / 6)) % 3 === 0) && Math.abs(o - 20) < 1.5) { c = [100, 150, 170]; em(16, 44, 60); } }
      }
      // ---- the lintel: one great slab, a band of glowing runes across it
      if (v >= PH + 22 && v < 170 && au < 96) {
        c = [170, 162, 148];
        if (v > PH + 22 + 5 && v < 165 && au < 88 && au > 44) { if (U.hash2(Math.floor(u / 5), 7, sd + 92) > 0.5 && ((u + 400) % 5) < 2.6) { c = [120, 200, 240]; em(30, 70, 90); } else c = [140, 132, 120]; }
        if (v < PH + 24 || v > 168) c = [96, 90, 84];
      }
      // ---- pilasters, fluted, with capitals and bases
      for (const pu of [92, 126]) {
        const dd = Math.abs(au - pu);
        if (v < 170 && dd < (v > 156 || v < 10 ? 10 : 7)) {
          c = [172, 164, 150];
          if (v <= 156 && v >= 10 && dd > 1 && ((dd | 0) % 3 === 0)) c = [132, 126, 116];
          if (v > 154 && v < 157) c = [92, 86, 80];
        }
      }
      // ---- carved lattice panels between the pilasters
      if (au > 101 && au < 117 && v > 18 && v < 148) {
        const pu = (u + 4000) % 12 - 6, pv = v % 12 - 6, dd = Math.abs(pu) + Math.abs(pv);
        c = Math.abs(dd - 5) < 1 ? [112, 106, 98] : [160, 152, 138];
      }
      return put(c[0], c[1], c[2]);
    }
    /* trees and rocks, stamped in projection: rooted on ground that is seen, nearer ones over farther */
    stampTrees(ctx, cx, cy, TD, GY, cols, rows, oc, orow) {
      if (!this.decorSets) this.decorSets = this.buildDecorSets();
      const ds = this.decorSets, R = this.R, G = this.G, sd = this.seed, x0 = cx * CH, Y0 = cy * CH, Ytop = Y0 - orow / TD;
      let gmin = Infinity, gmax = -Infinity;
      for (let q = 0; q < cols * rows; q++) { const v = GY[q]; if (v === v) { if (v < gmin) gmin = v; if (v > gmax) gmax = v; } }
      if (gmin === Infinity) return;
      const items = [], bw = new Float32Array(5);
      const qual = (AS.Settings && AS.Settings.quality === 'low') ? 0.6 : 1;
      const seen = (x, gy, Y) => {
        const c = Math.floor((x - x0) * TD) + oc, r = Math.floor((Y - Ytop) * TD);
        if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
        const v = GY[r * cols + c];
        return v === v && Math.abs(v - gy) < 3 + 1.5 / TD;
      };
      const zoneHit = (x, Y, rad) => {
        for (const z of this.zones) { const dx = x - z.x, dy = Y - z.y, rr = z.r * (z.treeR || 0.95) + rad; if (dx * dx + dy * dy < rr * rr) return true; }
        for (const z of this.clearAreas) { const dx = x - z.x, dy = (Y - z.y) / 0.8; if (dx * dx + dy * dy < (z.r + rad) * (z.r + rad)) return true; }
        return false;
      };
      const TC = 13;
      for (let gj = Math.floor(gmin / TC); gj <= Math.floor(gmax / TC); gj++) for (let gi = Math.floor((x0 - 18) / TC); gi <= Math.floor((x0 + CH + 18) / TC); gi++) {
        const x = (gi + 0.15 + U.hash2(gi, gj, sd + 401) * 0.7) * TC, gy = (gj + 0.15 + U.hash2(gi, gj, sd + 402) * 0.7) * TC;
        const hv = U.hash2(gi, gj, sd + 403);
        if (hv > 0.5) { /* most cells are open: test the cheap things first */ }
        const fo = this.gs(G.gForest, x, gy);
        const e = R.h(x, gy);
        const treeK = 1 - sstep(R.treeLine - 40, R.treeLine + 30, e);
        const lone = 0.01;
        if (hv > fo * 0.85 * qual * treeK + lone * treeK) {
          // scree and boulders on the open slopes
          // boulders: thick on the scree below the cliffs, rare elsewhere
          if (hv < 0.9 || e < 120) continue;
          const sc = R.SC ? R.samp8(R.SC, x, gy) / 255 : 0;
          if (hv < (sc > 0.25 ? 0.9 : 0.988)) continue;
          const s2 = R.slope(x, gy);
          if (s2 < 0.15 || s2 > 0.95) continue;
          const Y = gy - e;
          if (!seen(x, gy, Y) || this.gs(G.gWater, x, gy) < 12 || this.gs(G.gRoad, x, gy) < 20 || zoneHit(x, Y, 6)) continue;
          items.push({ k: e > R.snow ? 'rocksnow' : 'rock', x, Y, v: (U.hash2(gi, gj, sd + 406) * 97) | 0 });
          continue;
        }
        if (this.gn(G.gField, x, gy)) continue;
        const Y = gy - e;
        if (Y < Ytop - 4 || Y > Ytop + rows / TD) continue;
        if (!seen(x, gy, Y)) continue;
        const wd = this.gs(G.gWater, x, gy);
        if (wd < 14 || this.gs(G.gRoad, x, gy) < 26) continue;
        if (R.slope(x, gy) > 0.85) continue;
        if (zoneHit(x, Y, 7)) continue;
        let kind;
        if (e > R.treeLine - 25) kind = U.hash2(gi, gj, sd + 404) < 0.6 ? 'snowpine' : 'pine';
        else if (e > 200) kind = U.hash2(gi, gj, sd + 404) < 0.75 ? 'pine' : 'birch';
        else {
          this.biomeAt(x, gy, bw);
          let best = 4, bv = -1; for (let q = 0; q < 5; q++) if (bw[q] > bv) { bv = bw[q]; best = q; }
          kind = this.pickW(ds.trees[AS.RealmTerrain.BIOMES[best]], U.hash2(gi, gj, sd + 404));
          if (wd < 80 && U.hash2(gi, gj, sd + 405) < 0.4) kind = 'willow';
        }
        items.push({ k: kind, x, Y, v: (U.hash2(gi, gj, sd + 406) * 97) | 0 });
      }
      items.sort((a, b) => a.Y - b.Y);
      ctx.save(); ctx.scale(TD, TD); ctx.imageSmoothingEnabled = true;
      for (const it of items) {
        const list = ds.sheets[it.k];
        if (!list || !list.length) continue;
        const sh = list[it.v % list.length], lx = it.x - x0, ly = it.Y - Y0;
        ctx.globalAlpha = 0.34; ctx.drawImage(sh.shadows[0], lx - sh.ax + 3.2, ly - sh.ay + 1.8, sh.w, sh.h);
        ctx.globalAlpha = 1; ctx.drawImage(sh.frames[0][0], lx - sh.ax, ly - sh.ay, sh.w, sh.h);
      }
      ctx.restore();
    }

    /* ---------- the war map (projected, like the view) ---------- */
    buildMap(scale) {
      const w = Math.ceil(this.W / scale), h = Math.ceil(this.H / scale), cv = AS.Forge.canvas(w, h), ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), D = img.data;
      const R = this.R, G = this.G, g = [0, 0];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = i * scale + scale / 2, Y = j * scale + scale / 2, q = (j * w + i) * 4, gy = R.unproj(x, Y);
        if (gy !== gy) { D[q] = 60; D[q + 1] = 70; D[q + 2] = 86; D[q + 3] = 255; continue; }
        const e = R.h(x, gy); R.grad(x, gy, g);
        const s2 = Math.hypot(g[0], g[1]), wd = this.gs(G.gWater, x, gy), fo = this.gs(G.gForest, x, gy), rd = this.gs(G.gRoad, x, gy);
        let c;
        if (wd < 0) c = [70, 120, 150];
        else if (e > R.snow + 10 && s2 < 1.2) c = [232, 236, 244];
        else if (s2 > 0.7 || e > R.snow - 60) c = [128, 120, 110];
        else if (e > R.treeLine) c = [140, 136, 98];
        else if (fo > 0.35) c = [62, 92, 50];
        else c = [104, 134, 70];
        if (rd < Math.max(14, scale * 0.8) && wd > 0) c = [204, 180, 132];
        const ndl = (-g[0] * LX - g[1] * LY + LZ) / (Math.hypot(g[0], g[1], 1) * LN);
        const lit = (0.45 + 0.7 * Math.max(0, ndl)) / (0.45 + 0.7 * (LZ / LN)) * (1 - 0.35 * R.shadow(x, gy));
        D[q] = c[0] * lit; D[q + 1] = c[1] * lit; D[q + 2] = c[2] * lit; D[q + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return cv;
    }
  }
  AS.MountainTerrain = MountainTerrain;
})(window.AS);
