/* WYRMCROWN — realm landmarks and scenery props (environmental storytelling).
 * Big memorable things visible from far away (colossi, stone circles, dragon bones,
 * great trees, frozen ships, obelisks) and small ruin / wreck / camp pieces for the
 * four kingdoms. Stacked models for AS.Forge: 1-direction `prop` sheets (sites never
 * rotate, so besides geometry they use projected "paint layers", (x, y, z) -> (x, y - z),
 * for carvings, ivy, runes and cracks exactly on walls), `decor` for things baked into
 * the ground, and a few 16-direction segments (hedgerow, dry-stone wall, ruined wall)
 * that use geometry only and are modelled along +x.
 * Every generator: AS.Models.lm_<name>(pal, opt), opt optional, palette keys optional
 * (the neutral palette is the default). Faction colours used: pal.g glow, pal.s stone /
 * ice / bone, pal.k / pal.k2 cloth, pal.w timber. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});
  const clamp = U.clamp, lerp = U.lerp;

  /* ================================================================ helpers */
  const DEF = { a: '#7c6c5a', b: '#bcac8c', t: '#c79e52', g: '#ffcf6a', d: '#3a2b1f', k: '#8a8070', k2: '#d8ccb0', w: '#5e4430', s: '#a89a80', skin: '#e2bc98' };
  function P(pal) {
    const p = Object.assign({}, DEF);
    if (pal) for (const key in pal) if (typeof pal[key] === 'string' && pal[key]) p[key] = pal[key];
    return p;
  }
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const al = (c, a) => C.str(c, a);
  const rng = (seed, salt) => new U.RNG((((seed | 0) + 3) * 7919 + (salt || 0) * 104729 + 17) >>> 0);
  const res = () => (AS.Forge && AS.Forge.res) || 2;
  const dzOf = (z0, z1) => (z1 - z0) / Math.max(1, Math.round((z1 - z0) * res()));
  const frame4 = (a) => Math.floor((a || 0) * 4 + 1e-6) % 4;
  const pulse = (a, ph) => 0.5 + 0.5 * Math.sin(((a || 0) + (ph || 0)) * TAU);

  function tf(pts, ox, oy, a) {
    const ca = Math.cos(a || 0), sa = Math.sin(a || 0), out = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { out[i] = ox + pts[i] * ca - pts[i + 1] * sa; out[i + 1] = oy + pts[i] * sa + pts[i + 1] * ca; }
    return out;
  }
  const ngon = (n, r, rot, cx, cy, sx, sy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r * (sx || 1), (cy || 0) + Math.sin(t) * r * (sy || 1)); } return a; };
  function jag(n, r, seed, rough, rot, cx, cy, sx, sy) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const t = (rot || 0) + (i / n) * TAU, rr = r * (1 - rough / 2 + U.hash2(i, seed, 31) * rough);
      a.push((cx || 0) + Math.cos(t) * rr * (sx || 1), (cy || 0) + Math.sin(t) * rr * (sy || 1));
    }
    return a;
  }
  /* scale a point list about (ox, oy) by (kx, ky) then move by (dx, dy) */
  function xf(pts, kx, ky, ox, oy, dx, dy) {
    const o = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { o[i] = ox + (pts[i] - ox) * kx + (dx || 0); o[i + 1] = oy + (pts[i + 1] - oy) * ky + (dy || 0); }
    return o;
  }
  /* keep the part of a polygon where nx*x + ny*y >= d */
  function clipHalf(pts, nx, ny, d) {
    const out = [], n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = pts[i * 2], ay = pts[i * 2 + 1], j = (i + 1) % n, bx = pts[j * 2], by = pts[j * 2 + 1];
      const da = nx * ax + ny * ay - d, db = nx * bx + ny * by - d;
      if (da >= 0) out.push(ax, ay);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push(ax + (bx - ax) * t, ay + (by - ay) * t); }
    }
    return out;
  }
  const polyOK = (c, pts) => { if (pts && pts.length >= 6) S.poly(c, pts); };
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  // Rounded closed outline through the edge midpoints (pebbles, snow, moss, water).
  function smoothPoly(c, p) {
    const n = p.length;
    c.moveTo((p[n - 2] + p[0]) / 2, (p[n - 1] + p[1]) / 2);
    for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; c.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[j]) / 2, (p[i + 1] + p[j + 1]) / 2); }
    c.closePath();
  }
  /* lit / shaded facet slivers along the edges of a convex cross-section (any heading) */
  function slivers(c, pts, test, t, out) {
    const n = pts.length / 2;
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
    cx /= n; cy /= n;
    const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a), o = out || 0.12;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[j * 2], y1 = pts[j * 2 + 1];
      let nx = y1 - y0, ny = -(x1 - x0);
      const l = Math.hypot(nx, ny);
      if (l < 1e-4) continue;
      nx /= l; ny /= l;
      if (nx * ((x0 + x1) / 2 - cx) + ny * ((y0 + y1) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
      if (!test(nx * ca - ny * sa, nx * sa + ny * ca, i)) continue;
      c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); c.lineTo(x1 - nx * t, y1 - ny * t); c.lineTo(x0 - nx * t, y0 - ny * t); c.closePath();
    }
  }
  /* open edges of a polygon whose outward normal (rotated into screen space) passes test(sx, sy) — sy > 0 faces the camera */
  function faceEdges(c, pts, test) {
    const n = pts.length / 2;
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
    cx /= n; cy /= n;
    const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[j * 2], y1 = pts[j * 2 + 1];
      let nx = y1 - y0, ny = -(x1 - x0);
      const l = Math.hypot(nx, ny);
      if (l < 1e-4) continue;
      nx /= l; ny /= l;
      if (nx * ((x0 + x1) / 2 - cx) + ny * ((y0 + y1) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
      if (!test(nx * ca - ny * sa, nx * sa + ny * ca, i)) continue;
      c.moveTo(x0, y0); c.lineTo(x1, y1);
    }
  }
  const camFace = (sx, sy) => sy > 0.2;
  /* translucent ground stain (stays under the forge's solid cut, so no outline) */
  function stain(rx, ry, a, col, ox, oy) {
    return { z0: 0, z1: 0, flat: true, bevel: false, isStain: true, side: '#000000', top: '#000000', shape: () => {}, detail: (c) => {
      c.save(); c.translate(ox || 0, oy || 0); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, C.str(col || '#2a2014', a)); g.addColorStop(0.6, C.str(col || '#2a2014', a * 0.55)); g.addColorStop(1, C.str(col || '#2a2014', 0));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    } };
  }
  /* simple box (centre x, y; size w × d) */
  const box = (x, y, w, d, z0, z1, side, top, extra) => Object.assign({ z0, z1, side, top, shape: (c) => c.rect(x - w / 2, y - d / 2, w, d) }, extra || {});
  /* vertical cylinder */
  const cyl = (x, y, r, z0, z1, side, top, extra) => Object.assign({ z0, z1, side, top, shape: (c) => S.circ(c, x, y, r) }, extra || {});
  /* slice-wise stroked 3D segments (posts, braces, poles, ropes) — any heading */
  function beams(list, w, side, top, extra) {
    let z0 = 1e9, z1 = -1e9;
    for (const b of list) { z0 = Math.min(z0, b[2], b[5]); z1 = Math.max(z1, b[2], b[5]); }
    const dz = dzOf(z0, z1);
    return Object.assign({ z0, z1, side, top, stroke: w, bevel: false, ao: 0.25, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0);
      for (const b of list) {
        const lo = Math.min(b[2], b[5]), hi = Math.max(b[2], b[5]);
        if (z + dz < lo - 0.01 || z > hi + 0.01) continue;
        if (hi - lo < 0.05) { if (z <= lo + 0.01 && z + dz > lo - 0.01) { c.moveTo(b[0], b[1]); c.lineTo(b[3], b[4]); } continue; }
        const at = (zz) => { const t = clamp((zz - b[2]) / (b[5] - b[2]), 0, 1); return [b[0] + (b[3] - b[0]) * t, b[1] + (b[4] - b[1]) * t]; };
        const p0 = at(Math.max(lo, z)), p1 = at(Math.min(hi, z + dz * 1.05));
        c.moveTo(p0[0], p0[1]); c.lineTo(p1[0] + 0.01, p1[1]);
      }
    } }, extra || {});
  }
  /* Profiles in a vertical plane: polygons in (u, z) extruded across v0..v1. The plane
   * runs through (ox, oy) along angle a. Gives arches, sails, boards, wheels, gables. */
  function xzPart(polys, z0, z1, side, top, fr, extra) {
    fr = fr || {};
    const ox = fr.ox || 0, oy = fr.oy || 0, ca = Math.cos(fr.a || 0), sa = Math.sin(fr.a || 0), v0 = fr.v0 === undefined ? -0.5 : fr.v0, v1 = fr.v1 === undefined ? 0.5 : fr.v1;
    return Object.assign({ z0, z1, side, top, shape: (c, zt, anim) => {
      const z = clamp(z0 + zt * (z1 - z0), z0 + 0.02, z1 - 0.02);
      const list = typeof polys === 'function' ? polys(anim) : polys;
      for (const P_ of list) {
        const xs = [], n = P_.length / 2;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, ua = P_[i * 2], za = P_[i * 2 + 1], ub = P_[j * 2], zb = P_[j * 2 + 1];
          if ((za <= z && zb > z) || (zb <= z && za > z)) xs.push(ua + (z - za) / (zb - za) * (ub - ua));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const a = xs[k], b = xs[k + 1];
          c.moveTo(ox + a * ca - v0 * sa, oy + a * sa + v0 * ca); c.lineTo(ox + b * ca - v0 * sa, oy + b * sa + v0 * ca);
          c.lineTo(ox + b * ca - v1 * sa, oy + b * sa + v1 * ca); c.lineTo(ox + a * ca - v1 * sa, oy + a * sa + v1 * ca); c.closePath();
        }
      }
    } }, extra || {});
  }
  const ringQuads = (cu, cz, r0, r1, n, a0, a1) => { const out = []; a0 = a0 || 0; a1 = a1 === undefined ? TAU : a1; for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n; out.push([cu + Math.cos(t0) * r0, cz + Math.sin(t0) * r0, cu + Math.cos(t0) * r1, cz + Math.sin(t0) * r1, cu + Math.cos(t1) * r1, cz + Math.sin(t1) * r1, cu + Math.cos(t1) * r0, cz + Math.sin(t1) * r0]); } return out; };
  const barUZ = (u0, z0, u1, z1, w) => { const dx = u1 - u0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; return [u0 + nx, z0 + nz, u1 + nx, z1 + nz, u1 - nx, z1 - nz, u0 - nx, z0 - nz]; };
  /* pointed (gothic / elven) arch ring in (u, z): springs at cz, half-span r0 inner, r1 outer */
  function pointedArch(cu, cz, r0, r1, n, k) {
    k = k || 0.55; // centre offset of each arc (0 round, larger = more pointed)
    const out = [];
    for (const sg of [-1, 1]) {
      const cx = cu - sg * r0 * k, R0 = r0 * (1 + k), R1 = r1 + r0 * k;
      const aEnd = Math.acos(clamp((r0 * k) / R0, 0, 1)); // where the two arcs meet above cu
      for (let i = 0; i < n; i++) {
        const t0 = (i / n) * aEnd, t1 = ((i + 1) / n) * aEnd;
        const a0 = sg > 0 ? Math.PI - t0 : t0, a1 = sg > 0 ? Math.PI - t1 : t1;
        out.push([cx + Math.cos(a0) * R0, cz + Math.sin(a0) * R0, cx + Math.cos(a0) * R1, cz + Math.sin(a0) * R1, cx + Math.cos(a1) * R1, cz + Math.sin(a1) * R1, cx + Math.cos(a1) * R0, cz + Math.sin(a1) * R0]);
      }
    }
    return out;
  }

  /* Weathered boulders: each rock {x, y, r, h, seed, n, rough, sx, sy, top (top radius
   * fraction), pw, lx, ly (lean at the top)} tapers to a rounded crown. One part per group. */
  const rockK = (R, q) => { const tp = R.top === undefined ? 0.16 : R.top; return tp + (1 - tp) * Math.sqrt(Math.max(0, 1 - Math.pow(q, R.pw || 2.2))); };
  const rockSect = (R, z) => { const q = clamp(z / R.h, 0, 1), k = rockK(R, q); return xf(R.base, k, k, 0, 0, R.x + (R.lx || 0) * q, R.y + (R.ly || 0) * q); };
  function rockPart(list, side, top, extra) {
    const zmax = Math.max.apply(null, list.map((r) => r.h));
    for (const R of list) R.base = R.base || jag(R.n || 11, R.r, R.seed || 1, R.rough === undefined ? 0.3 : R.rough, R.rot || 0, 0, 0, R.sx || 1, R.sy || 1);
    return Object.assign({ z0: 0, z1: zmax, side, top, ao: 0.5, shape: (c, zt) => {
      const z = zt * zmax;
      for (const R of list) if (z <= R.h + 0.01) S.poly(c, rockSect(R, z));
    } }, extra || {});
  }
  /* chiselled facets: lit slivers on west-facing edges, shade on east-facing ones */
  function rockFacets(list, lit, dark) {
    const zmax = Math.max.apply(null, list.map((r) => r.h));
    const mk = (col, test) => ({ z0: 0, z1: zmax, side: col, top: col, ao: 0.35, bevel: false, shape: (c, zt) => {
      const z = zt * zmax;
      for (const R of list) { if (z > R.h - 0.3) continue; const pts = rockSect(R, z); slivers(c, pts, test, Math.min(1.6, R.r * 0.16)); }
    } });
    return [mk(lit, (sx, sy) => sx < -0.42 && sy > -0.75), mk(dark, (sx, sy) => sx > 0.4 && sy > -0.4)];
  }
  /* moss clumps (dark base, mid body, sunlit top-left dabs). Painted in projected space (1-direction models only). */
  const MOSS = ['#3c5622', '#557a2c', '#7a9c40', '#a6c25e'];
  const FROST = ['#9fb8cf', '#c9dcec', '#eaf3fb', '#ffffff'];
  const LICHEN = ['#6a7a3a', '#9aa650', '#c4c878', '#e0e0a0'];
  function clump(pe, x, y, z, cr, r, cols) {
    cols = cols || MOSS;
    for (let i = 0; i < 6; i++) { const a = r.range(0, TAU), d = r.range(0, cr * 0.7); pe.dot(cols[0], x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, z, cr * r.range(0.38, 0.55)); }
    for (let i = 0; i < 5; i++) { const a = r.range(0, TAU), d = r.range(0, cr * 0.55); pe.dot(cols[1], x + Math.cos(a) * d - cr * 0.1, y + Math.sin(a) * d * 0.8 - cr * 0.12, z + cr * 0.12, cr * r.range(0.3, 0.45)); }
    for (let i = 0; i < 3; i++) { const a = r.range(0, TAU), d = r.range(0, cr * 0.4); pe.dot(cols[2], x + Math.cos(a) * d - cr * 0.24, y + Math.sin(a) * d * 0.8 - cr * 0.24, z + cr * 0.22, cr * r.range(0.22, 0.32)); }
    pe.dot(cols[3], x - cr * 0.34, y - cr * 0.3, z + cr * 0.3, cr * 0.13);
  }
  function paintMoss(pe, list, seed, o) {
    o = o || {};
    const r = rng(seed, 13);
    for (const R of list) {
      if (R.moss === 0) continue;
      const amt = R.moss === undefined ? 1 : R.moss;
      const tp = R.top === undefined ? 0.16 : R.top, pw = R.pw || 2.2;
      const zAt = (d) => { if (d <= tp) return R.h; const t = (d - tp) / (1 - tp); return R.h * Math.pow(Math.max(0, 1 - t * t), 1 / pw); };
      const nc = Math.max(1, Math.round((1 + R.r / 4.5) * amt));
      for (let i = 0; i < nc; i++) {
        const a = r.range(0, TAU), d = Math.pow(r.next(), 0.8) * 0.62;
        const ox = Math.cos(a) * d - 0.16, oy = Math.sin(a) * d * 0.85 - 0.2;
        const dd = Math.min(0.92, Math.hypot(ox, oy)), z = zAt(dd), q = z / R.h;
        const x = R.x + (R.lx || 0) * q + ox * R.r * (R.sx || 1), y = R.y + (R.ly || 0) * q + oy * R.r * (R.sy || 1);
        clump(pe, x, y, z, R.r * r.range(0.16, 0.27) * (o.size || 1), r, o.cols);
      }
      if (o.cracks !== false) {
        const s = [];
        for (let i = 0; i < 2; i++) { const x0 = R.x + r.range(-0.5, 0.4) * R.r; const yF = R.y + R.r * (R.sy || 1) * 0.72; const z0 = r.range(0.2, 0.5) * R.h; s.push(x0, yF, z0, x0 + r.range(-1.6, 1.6), yF, z0 + r.range(1.4, 3)); }
        pe.lines(o.crackCol || 'rgba(30,26,22,0.4)', 0.32, s);
      }
    }
  }
  /* runic glyphs (unit box, strokes) and a glowing painter */
  const GLYPHS = [
    [0, 0, 0, 1, 0, 0.7, 0.5, 1, 0, 0.4, 0.5, 0.7],
    [0, 0, 0, 1, 0, 1, 0.45, 0.78, 0.45, 0.78, 0, 0.55, 0, 0.55, 0.45, 0],
    [0, 0, 0, 1, 0, 0.6, -0.42, 1, 0, 0.6, 0.42, 1],
    [0, 0.5, 0.35, 0.85, 0.35, 0.85, 0.7, 0.5, 0.7, 0.5, 0.35, 0.15, 0.35, 0.15, 0, 0.5, 0.35, 0.15, 0, -0.05, 0.35, 0.15, 0.7, -0.05],
    [0, 0, 0, 1, 0, 0.78, 0.4, 0.5, 0.4, 0.5, 0, 0.22],
    [0, 0, 0, 1, -0.4, 0.72, 0, 1, 0, 1, 0.4, 0.72],
    [-0.3, 0, -0.3, 1, 0.3, 0, 0.3, 1, -0.3, 1, 0.3, 0, -0.3, 0, 0.3, 1],
  ];
  function rune(pe, x, y, z, s, col, gi, a, faint) {
    const g = GLYPHS[((gi % GLYPHS.length) + GLYPHS.length) % GLYPHS.length], seg = [];
    for (let i = 0; i < g.length; i += 4) seg.push(x + g[i] * s, y, z + g[i + 1] * s, x + g[i + 2] * s, y, z + g[i + 3] * s);
    if (faint) { pe.lines(al(col, a === undefined ? 0.6 : a), s * 0.16, seg); return; }
    pe.lines(al(col, 0.28 * (a === undefined ? 1 : a)), s * 0.42, seg);
    pe.lines(al(mx(col, '#ffffff', 0.55), 0.95 * (a === undefined ? 1 : Math.max(0.35, a))), s * 0.16, seg);
  }
  /* a lying cylinder (column drum, log, barrel) along angle a: cross-section at height z */
  function lyingCyl(c, x, y, len, R, a, z, sink) {
    const v = (sink || 0) + (z / (R * 2)) * (2 - (sink || 0)) - 1, hw = R * Math.sqrt(Math.max(0.03, 1 - v * v));
    S.poly(c, tf([-len / 2, -hw, len / 2, -hw, len / 2, hw, -len / 2, hw], x, y, a));
  }
  // Tapered limb / root / fin with a round tip, wound clockwise like S.circ.
  function taper(c, x0, y0, x1, y1, w0, w1) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
    c.moveTo(x0 - nx * w0, y0 - ny * w0);
    c.lineTo(x1 - nx * w1, y1 - ny * w1);
    c.arc(x1, y1, Math.max(0.05, w1), an + Math.PI, an + TAU, false);
    c.lineTo(x0 + nx * w0, y0 + ny * w0);
    c.closePath();
  }
  // Point on a 3-D polyline [[x, y, z], ...] (z ascending) at height z.
  function polyAt(L, z) {
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      if (z <= b[2] || i === L.length - 2) { const u = clamp((z - a[2]) / Math.max(1e-4, b[2] - a[2]), 0, 1); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; }
    }
    return [L[0][0], L[0][1]];
  }
  /* Stroked 3-D lines (branches, roots, horns, strands): each slice strokes the short run
   * of every line between z - 0.8 and z, so sloped and nearly flat limbs sweep out without gaps. */
  function limbPart(lines, w, side, top, extra) {
    if (!lines.length) return null;
    let z0 = Infinity, z1 = -Infinity;
    for (const L of lines) { z0 = Math.min(z0, L[0][2]); z1 = Math.max(z1, L[L.length - 1][2]); }
    if (z1 - z0 < 0.2) z1 = z0 + 0.2;
    return Object.assign({ z0, z1, side, top, stroke: w, bevel: false, ao: 0.2,
      shape: (c, zt) => {
        const z = lerp(z0, z1, zt);
        for (const L of lines) {
          const lz0 = L[0][2], lz1 = L[L.length - 1][2];
          if (z < lz0 - 1e-3 || z > lz1 + 1e-3) continue;
          const p = polyAt(L, z), q = polyAt(L, Math.max(lz0, z - 0.8));
          c.moveTo(q[0], q[1]);
          c.lineTo(p[0] + (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 0.01 ? 0.01 : 0), p[1]);
        }
      } }, extra || {});
  }
  /* a 3-D polyline whose stroke width shrinks from w0 to w1 along its height (horns, tusks, tapering limbs) */
  function taperLimb(L, w0, w1, side, top, extra) {
    const z0 = L[0][2], z1 = L[L.length - 1][2], n = Math.max(2, Math.round((z1 - z0) * 1.5));
    const parts = [];
    for (let i = 0; i < n; i++) {
      const za = lerp(z0, z1, i / n), zb = lerp(z0, z1, (i + 1) / n), pa = polyAt(L, za), pb = polyAt(L, zb);
      parts.push([[pa[0], pa[1], za], [pb[0], pb[1], zb], lerp(w0, w1, (i + 0.5) / n)]);
    }
    // at most three width classes, so a horn or tusk costs three parts, not a dozen
    const byW = {};
    parts.forEach((q, i) => { const cls = Math.min(2, Math.floor((i / n) * 3)), k = lerp(w0, w1, (cls + 0.5) / 3); (byW[k] = byW[k] || []).push([q[0], q[1]]); });
    return Object.keys(byW).map((k) => limbPart(byW[k], +k, side, top, extra));
  }
  /* Soft ground shadow / glow pool painted at z 0 (alpha stays under the forge's solid threshold). */
  function pool(rx, ry, dx, dy, col, a, extra) {
    return { z0: 0, z1: 0, side: '#000', top: '#000', flat: true, bevel: false, isStain: true, shape: () => {},
      detail: (c) => {
        c.save(); c.translate(dx, dy); c.scale(1, ry / rx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, al(col, a)); g.addColorStop(0.55, al(col, a * 0.7)); g.addColorStop(1, al(col, 0));
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
        if (extra) extra(c);
      } };
  }
  const contact = (rx, ry, dx, dy, a, extra) => pool(rx, ry, dx, dy, '#0c1408', a === undefined ? 0.3 : a, extra);

  /* Scalloped leaf clump: a ring of outward bulging arcs. */
  function puff(c, x, y, r, seed, n) {
    if (r < 0.12) return;
    n = n || 7;
    const a0 = U.hash2(seed, 1, 5) * TAU;
    let pa = 0, pr = 0;
    for (let i = 0; i <= n; i++) {
      const ii = i % n;
      const a = a0 + ((i + (U.hash2(ii, seed, 6) - 0.5) * 0.45) / n) * TAU;
      const rr = r * (0.8 + U.hash2(ii, seed, 7) * 0.2);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) c.moveTo(px, py);
      else { const am = (pa + a) / 2, rm = ((pr + rr) / 2) * 1.24; c.quadraticCurveTo(x + Math.cos(am) * rm, y + Math.sin(am) * rm, px, py); }
      pa = a; pr = rr;
    }
    c.closePath();
  }
  // Radius factor up a dome: b0 at the base, full width at f, easing to e at the top.
  const dome = (b0, f, e) => (zt) => (zt < f ? lerp(b0, 1, Math.sin((zt / f) * Math.PI / 2))
    : lerp(e, 1, Math.sqrt(Math.max(0, 1 - Math.pow((zt - f) / (1 - f), 2)))));
  /* Leaf-crown tiers (see models_nature.js): rings of scalloped clumps on a foreshortened
   * footprint, each tier a short dome with staggered clump starts, lit per clump. */
  const ELDER = [
    { n: 10, d: 0.68, r: 0.36, c: 0.55, off: -0.05, z0: 0, z1: 0.4, b0: 0.6, e: 0.74 },
    { n: 8, d: 0.53, r: 0.33, c: 0.46, off: 0.04, z0: 0.18, z1: 0.58, b0: 0.7, e: 0.7 },
    { n: 7, d: 0.38, r: 0.3, c: 0.34, off: 0.11, z0: 0.38, z1: 0.76, b0: 0.74, e: 0.66 },
    { n: 5, d: 0.22, r: 0.25, c: 0.16, off: 0.18, z0: 0.56, z1: 0.9, b0: 0.76, e: 0.62 },
    { n: 3, d: 0.1, r: 0.19, c: 0, off: 0.25, z0: 0.72, z1: 1, b0: 0.78, e: 0.58, fleck: true },
  ];
  function leafDetail(clumps, k, col, o, fleck, extra) {
    return (c) => {
      c.save();
      c.beginPath(); for (const q of clumps) puff(c, q.x, q.y, q.r * k, q.s, q.n); c.clip();
      if (o) {
        const CR = o.CR, gx = (o.x || 0) - CR * 0.5, gy = (o.y || 0) - CR * 0.5;
        const G = c.createRadialGradient(gx, gy, CR * 0.05, gx + CR * 0.3, gy + CR * 0.3, CR * 1.6);
        G.addColorStop(0, al(col.hi, 0.42)); G.addColorStop(0.42, al(col.hi, 0)); G.addColorStop(0.66, al(col.lo, 0)); G.addColorStop(1, al(col.lo, 0.4));
        c.fillStyle = G; c.fillRect(gx - CR * 2, gy - CR * 2, CR * 5, CR * 5);
      }
      for (const q of clumps) {
        const rr = q.r * k;
        const g = c.createRadialGradient(q.x - rr * 0.38, q.y - rr * 0.42, rr * 0.05, q.x - rr * 0.1, q.y - rr * 0.1, rr * 1.15);
        g.addColorStop(0, al(col.hi, 0.5)); g.addColorStop(0.4, al(col.hi, 0)); g.addColorStop(0.7, al(col.lo, 0)); g.addColorStop(1, al(col.lo, 0.55));
        c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, rr * 1.2, 0, TAU); c.fill();
        const r2 = rng(q.s, 9);
        const nd = clamp(Math.round(rr * rr * 0.9), 3, 16);
        for (let i = 0; i < nd; i++) {
          const a = r2.range(0, TAU), d = rr * Math.sqrt(r2.next()) * 0.92, px = q.x + Math.cos(a) * d, py = q.y + Math.sin(a) * d;
          const t = (-(Math.cos(a) + Math.sin(a)) * 0.707) * (d / rr) + r2.range(-0.35, 0.35);
          const lr = r2.range(0.32, 0.62) * Math.min(1, rr / 2);
          c.fillStyle = t > 0 ? al(col.hi, Math.min(0.7, 0.25 + t * 0.5)) : al(col.lo, Math.min(0.42, 0.1 - t * 0.34));
          c.beginPath(); c.ellipse(px, py, lr, lr * 0.62, r2.range(0, Math.PI), 0, TAU); c.fill();
        }
        if (fleck) for (let i = 0; i < 2; i++) { const a = r2.range(3.4, 4.6), d = rr * r2.range(0.15, 0.55); S.dot(c, al(fleck, 0.85), q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, r2.range(0.28, 0.48)); }
      }
      c.restore();
      if (extra) extra(c);
    };
  }
  function crown(o) {
    const rg = rng(o.seed, 41);
    const T = o.tiers || ELDER, CR = o.CR, D = o.D, zc = o.zc, col = o.col;
    const sx = o.sx || 1, sy = (o.sy || 1) * (o.squash === undefined ? 0.8 : o.squash), cs = o.centres || [[0, 0]];
    const lk = cs.length > 1 ? (o.lobeK || 0.68) : 1;
    const parts = [];
    T.forEach((t, ti) => {
      const clumps = [];
      const ox = (o.x || 0) - t.off * CR, oy = (o.y || 0) - t.off * CR * 0.7;
      for (const ce of cs) {
        const bx = ox + ce[0], by = oy + ce[1];
        const ck = ce[2] || lk;
        if (t.c) { const r = t.c * CR * ck * rg.range(0.92, 1.08); clumps.push({ x: bx + rg.range(-0.05, 0.05) * CR, y: by + rg.range(-0.05, 0.05) * CR, r, s: rg.int(1, 1e6), n: clamp(Math.round(r * 1.4), 7, 13) }); }
        const n = Math.max(2, Math.round(t.n * (cs.length > 1 ? 0.8 : 1)) + rg.int(-1, 1));
        const a0 = rg.range(0, TAU);
        for (let i = 0; i < n; i++) {
          const a = a0 + ((i + rg.range(-0.25, 0.25)) / n) * TAU, d = t.d * CR * ck * rg.range(0.82, 1.12);
          const r = t.r * CR * ck * rg.range(0.8, 1.18);
          clumps.push({ x: bx + Math.cos(a) * d * sx, y: by + Math.sin(a) * d * sy, r, s: rg.int(1, 1e6), n: clamp(Math.round(r * 1.5), 6, 12) + rg.int(0, 1) });
        }
      }
      if (!clumps.length) return;
      clumps.sort((a, b) => a.y - b.y);
      const prof = dome(t.b0, 0.34, t.e), kTop = prof(1), cc = col[Math.min(col.length - 1, ti)];
      for (const q of clumps) q.z = ti === 0 ? rg.range(0, 0.2) : rg.range(0, 0.38);
      parts.push({ z0: zc + t.z0 * D, z1: zc + t.z1 * D, side: cc.s, top: cc.t, ao: ti === 0 ? 0.5 : 0.4,
        shape: (c, zt) => { for (const q of clumps) { if (zt < q.z) continue; puff(c, q.x, q.y, q.r * prof((zt - q.z) / (1 - q.z)), q.s, q.n); } },
        detail: leafDetail(clumps, kTop, cc, o, t.fleck ? (o.fleck || cc.hi) : null, o.decorate ? (c) => o.decorate(c, clumps, kTop, ti) : null) });
    });
    return parts;
  }

  /* ---------------------------------------------------- paint layers (1 dir) */
  function pen(c) {
    const Y = (y, z) => y - z;
    const pe = {
      c, Y,
      path(p3) { c.moveTo(p3[0], p3[1] - p3[2]); for (let i = 3; i < p3.length; i += 3) c.lineTo(p3[i], p3[i + 1] - p3[i + 2]); c.closePath(); },
      poly(col, p3) { c.beginPath(); pe.path(p3); c.fillStyle = col; c.fill(); },
      lines(col, w, s3) { c.beginPath(); for (let i = 0; i < s3.length; i += 6) { c.moveTo(s3[i], s3[i + 1] - s3[i + 2]); c.lineTo(s3[i + 3], s3[i + 4] - s3[i + 5]); } c.strokeStyle = col; c.lineWidth = w; c.stroke(); },
      dot(col, x, y, z, r) { c.beginPath(); c.arc(x, y - z, Math.max(0.05, r), 0, TAU); c.fillStyle = col; c.fill(); },
      ell(col, x, y, z, rx, ry, rot) { c.beginPath(); c.ellipse(x, y - z, Math.max(0.05, rx), Math.max(0.05, ry), rot || 0, 0, TAU); c.fillStyle = col; c.fill(); },
      wall(col, x0, x1, y, z0, z1) { c.fillStyle = col; c.fillRect(x0, y - z1, x1 - x0, z1 - z0); },
      glow(col, x, y, z, r, a) { const g = c.createRadialGradient(x, y - z, 0, x, y - z, r); g.addColorStop(0, al(col, a === undefined ? 0.8 : a)); g.addColorStop(1, al(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y - z, r, 0, TAU); c.fill(); },
      /* a polyline (projected) stroked with width w */
      curve(col, w, p3) { c.beginPath(); c.moveTo(p3[0], p3[1] - p3[2]); for (let i = 3; i < p3.length; i += 3) c.lineTo(p3[i], p3[i + 1] - p3[i + 2]); c.strokeStyle = col; c.lineWidth = w; c.stroke(); },
    };
    return pe;
  }
  function layer(fn, extra) {
    return Object.assign({ z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: () => {}, detail: (c, a) => { c.save(); fn(pen(c), a || 0); c.restore(); } }, extra || {});
  }
  /* rectangle with an optional round arch on top, on wall plane y */
  function archRect(pe, col, x0, x1, y, z0, z1, arch) {
    const c = pe.c, r = (x1 - x0) / 2;
    c.beginPath();
    if (arch) { c.moveTo(x0, y - z0); c.lineTo(x0, y - (z1 - r)); c.arc((x0 + x1) / 2, y - (z1 - r), r, Math.PI, TAU); c.lineTo(x1, y - z0); c.closePath(); }
    else c.rect(x0, y - z1, x1 - x0, z1 - z0);
    c.fillStyle = col; c.fill();
  }
  /* fieldstone pattern on a south wall rect */
  function stones(pe, x0, x1, y, z0, z1, seed, o) {
    o = o || {};
    const r = rng(seed, 5), rowH = o.row || 1.5, c = pe.c;
    c.save(); c.beginPath(); c.rect(x0, y - z1, x1 - x0, z1 - z0); c.clip();
    for (let z = z0, row = 0; z < z1; z += rowH, row++) {
      let x = x0 - r.range(0, 2);
      while (x < x1) {
        const w = r.range(1.6, 3.2) * (o.w || 1);
        const tint = r.next();
        c.beginPath(); S.rrect(c, x + 0.15, y - z - rowH + 0.15, w - 0.3, rowH - 0.3, 0.45);
        c.fillStyle = tint < 0.3 ? (o.light || 'rgba(255,250,235,0.16)') : tint > 0.75 ? (o.dark || 'rgba(30,24,18,0.16)') : 'rgba(0,0,0,0)'; c.fill();
        c.strokeStyle = o.joint || 'rgba(40,32,24,0.42)'; c.lineWidth = 0.3; c.stroke();
        x += w;
      }
    }
    c.restore();
  }
  /* ivy: leaves climbing a wall plane y between z0 and z1 around x, drifting sideways */
  function ivy(pe, r, x, y, z0, z1, o) {
    o = o || {};
    const cols = o.cols || ['#3a5a22', '#527a2c', '#7a9c40'];
    const n = Math.round((z1 - z0) * (o.dens || 1.6));
    let xx = x;
    for (let i = 0; i < n; i++) {
      const z = z0 + (i / n) * (z1 - z0);
      xx += r.range(-0.9, 0.9) * (o.sway || 1);
      pe.lines('rgba(40,50,24,0.7)', 0.3, [xx, y, z, xx + r.range(-0.6, 0.6), y, z + (z1 - z0) / n]);
      pe.dot(cols[i % 3], xx + r.range(-1, 1), y, z + r.range(-0.4, 0.4), r.range(0.45, 0.85) * (o.size || 1));
      if (r.next() < 0.4) pe.dot(cols[(i + 1) % 3], xx + r.range(-1.6, 1.6), y, z, r.range(0.35, 0.6) * (o.size || 1));
    }
  }
  /* bones (ground decal) — femurs, ribs and a skull, painted (1-dir) */
  function paintBones(pe, list, col) {
    col = col || '#e6dcc4';
    const dk = 'rgba(70,60,44,0.55)';
    for (const b of list) {
      const [x, y, kind, a, s] = b;
      if (kind === 'bone') { const e = tf([-1.6 * s, 0, 1.6 * s, 0], x, y, a); pe.lines(dk, 0.75 * s, [e[0], e[1] + 0.15, 0, e[2], e[3] + 0.15, 0]); pe.lines(col, 0.55 * s, [e[0], e[1], 0.2, e[2], e[3], 0.2]); pe.dot(col, e[0], e[1], 0.25, 0.42 * s); pe.dot(col, e[2], e[3], 0.25, 0.42 * s); }
      else if (kind === 'rib') { const c = pe.c; c.beginPath(); c.arc(x, y - 0.2, 1.6 * s, a, a + 2.2); c.strokeStyle = col; c.lineWidth = 0.35 * s; c.stroke(); c.beginPath(); c.arc(x + 0.7 * s, y - 0.2, 1.6 * s, a, a + 2.2); c.stroke(); }
      else if (kind === 'skull') { pe.ell(dk, x + 0.15, y + 0.2, 0, 1.25 * s, 0.9 * s); pe.ell(col, x, y, 0.7 * s, 1.1 * s, 0.85 * s); pe.ell(col, x + 0.1 * s, y + 0.3 * s, 0.2 * s, 0.7 * s, 0.45 * s); pe.dot('#2a2018', x - 0.42 * s, y + 0.25 * s, 0.75 * s, 0.26 * s); pe.dot('#2a2018', x + 0.42 * s, y + 0.25 * s, 0.75 * s, 0.26 * s); }
    }
  }
  /* grass tufts on the ground (1-dir): little fans of blades */
  function tufts(pe, r, n, x0, x1, y0, y1, cols, skip) {
    cols = cols || ['#536e2a', '#8aa848'];
    for (let i = 0; i < n; i++) {
      const x = r.range(x0, x1), y = r.range(y0, y1);
      if (skip && skip(x, y)) continue;
      const s = [];
      for (let k = 0; k < 3; k++) s.push(x + k * 0.4, y, 0, x + k * 0.4 + r.range(-0.7, 0.7), y, r.range(1.2, 2.4));
      pe.lines(cols[i % cols.length], 0.22, s);
    }
  }

  /* Broken walls: a run of points is cut into ~seg-long pieces, each with its own
   * height; intact pieces may carry merlons; broken ones get a ragged slanting top. */
  function wallRun(pts, seed, o) {
    const r = rng(seed, 1), segs = [];
    let s = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const ax = pts[k][0], ay = pts[k][1], bx = pts[k + 1][0], by = pts[k + 1][1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / (o.seg || 6)));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, q = r.next();
        const seg = { x0: ax + (bx - ax) * t0, y0: ay + (by - ay) * t0, x1: ax + (bx - ax) * t1, y1: ay + (by - ay) * t1, s0: s + len * t0, s1: s + len * t1, slope: r.range(-1, 1) };
        if (o.hs) { seg.h = o.hs[segs.length % o.hs.length]; seg.cren = seg.h >= o.H; }
        else if (q < (o.gap || 0)) seg.h = r.range(0.9, 2.4);
        else if (q < (o.gap || 0) + (o.low || 0.4)) seg.h = r.range(o.H * 0.35, o.H * 0.8);
        else { seg.h = o.H; seg.cren = true; }
        if (o.noCren && seg.cren) { seg.cren = false; seg.h = o.H * r.range(0.82, 1); }
        segs.push(seg);
      }
      s += len;
    }
    return segs;
  }
  function wallPart(segs, th, side, top, o) {
    o = o || {};
    const mh = o.mh || 2.2, ml = o.ml || 2.2, mg = o.mg || 1.7, out = o.out || 1, brk = o.brk === undefined ? 3 : o.brk;
    const zmax = Math.max.apply(null, segs.map((q) => q.h + (q.cren ? mh : 0)));
    return Object.assign({ z0: 0, z1: zmax, side, top, ao: 0.32, shape: (c, zt) => {
      const z = zt * zmax;
      for (const q of segs) {
        const len = Math.hypot(q.x1 - q.x0, q.y1 - q.y0), ux = (q.x1 - q.x0) / len, uy = (q.y1 - q.y0) / len, nx = -uy, ny = ux, w = th / 2;
        const quad = (a, b, o0, o1) => { c.moveTo(q.x0 + ux * a + nx * o0, q.y0 + uy * a + ny * o0); c.lineTo(q.x0 + ux * b + nx * o0, q.y0 + uy * b + ny * o0); c.lineTo(q.x0 + ux * b + nx * o1, q.y0 + uy * b + ny * o1); c.lineTo(q.x0 + ux * a + nx * o1, q.y0 + uy * a + ny * o1); c.closePath(); };
        if (q.cren && z > q.h) {
          if (z > q.h + mh) continue;
          const P_ = ml + mg;
          for (let k = Math.floor(q.s0 / P_); k * P_ < q.s1; k++) { const a = Math.max(k * P_, q.s0) - q.s0, b = Math.min(k * P_ + ml, q.s1) - q.s0; if (b - a > 0.2) quad(a, b, out * w, out * (w - th * 0.42)); }
        } else {
          if (z > q.h) continue;
          let a = -0.15, b = len + 0.15;
          if (!q.cren && brk > 0 && z > q.h - brk) { const cut = (z - (q.h - brk)) / brk; if (q.slope > 0) b = len * (1 - cut * 0.75); else a = len * cut * 0.75; }
          quad(a, b, -w, w);
        }
      }
    } }, o.extra || {});
  }
  /* ruined round tower: a hollow shell whose wall pieces break off at their own heights,
   * lowest toward the breach direction (nx, ny); returns [floor, wall] */
  function ruinTower(x, y, r, h, cut, nx, ny, side, top, floor, seed) {
    const run = [];
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU; run.push([x + Math.cos(a) * (r - 1.3), y + Math.sin(a) * (r - 1.3)]); }
    const segs = wallRun(run, seed || ((x * 7 + y) | 0), { H: h, gap: 0, low: 0, seg: 3.6, noCren: true });
    for (const q of segs) { const mx_ = (q.x0 + q.x1) / 2 - x, my_ = (q.y0 + q.y1) / 2 - y, f = (mx_ * nx + my_ * ny) / r; q.h = Math.max(1.5, h - cut * clamp(0.5 + f * 0.9, 0, 1) - 2.5 * U.hash2(q.s0 | 0, 3, 7)); }
    return { segs, parts: [{ z0: 0, z1: 0.8, side: floor, top: mx(floor, '#6a6050', 0.5), ao: 0.2, bevel: false, shape: (c) => S.circ(c, x, y, r - 2) }, wallPart(segs, 2.6, side, top)] };
  }
  /* course lines on a wall's camera-facing faces (any heading): zero-height stroked rings */
  function courses(zs, sect, col, w) {
    return zs.map((z) => ({ z0: z, z1: z, side: col, top: col, stroke: w || 0.35, bevel: false, ao: 0, flat: true, shape: (c) => { for (const pts of sect(z)) faceEdges(c, pts, camFace); } }));
  }
  /* curved wooden / iron plank boards lying on the ground: thin boxes at angle a */
  const plank = (x, y, L, W, a, z0, z1, side, top) => ({ z0, z1, side, top, ao: 0.3, bevel: false, shape: (c) => S.poly(c, tf([-L / 2, -W / 2, L / 2, -W / 2, L / 2, W / 2, -L / 2, W / 2], x, y, a)) });
  /* snow cap: flat white patch with a blue shade crescent on the far / right edges */
  function snowCap(ptsFn, z0, z1, extra) {
    return [
      Object.assign({ z0, z1, side: '#eef4fb', top: '#ffffff', flat: true, ao: 0.1, bevel: false, shape: (c, zt) => smoothPoly(c, ptsFn(zt)) }, extra || {}),
      { z0, z1: lerp(z0, z1, 0.7), side: '#a9c2e2', top: '#a9c2e2', flat: true, stroke: 0.8, ao: 0.1, bevel: false, shape: (c, zt) => faceEdges(c, ptsFn(zt * 0.7), (sx, sy) => sx > 0.3 && sy > -0.3) },
    ];
  }
  /* small tongues of fire (campfire / brazier) around (x, y) from z0: three swaying flat stacks */
  function fire(x, y, z0, H, R, cols, extra) {
    const tongues = [[0, 0.1, 1, 1, 0], [-0.5, -0.15, 0.68, 0.7, 0.33], [0.55, -0.1, 0.62, 0.76, 0.66]];
    const flame = (col, k, hk) => Object.assign({ z0, z1: z0 + H, side: col[0], top: col[1], flat: true, ao: -0.3, bevel: false, shape: (c, zt, a) => {
      const z = z0 + zt * H;
      for (const t of tongues) { const ph = (a + t[4]) * TAU, hh = H * t[3] * hk * (0.85 + 0.2 * Math.sin(ph)); if (z - z0 > hh) continue; const q = (z - z0) / hh, rr = R * t[2] * k * Math.pow(1 - q, 0.8) * (0.7 + 0.6 * Math.sin(Math.PI * Math.min(1, q * 2 + 0.25))); const sx = Math.sin(ph + q * 3) * R * 0.45 * q; S.circ(c, x + t[0] * R + sx, y + t[1] * R, Math.max(0.12, rr)); }
    } }, extra || {});
    return [flame([cols[0], cols[1]], 1, 1), flame([cols[1], cols[2]], 0.62, 0.78), flame([cols[2], cols[3]], 0.32, 0.55)];
  }

  /* ================================================================ materials */
  const stoneOf = (p) => ({ s: mx(p.s, '#8e8c84', 0.5), t: mx(p.b, '#d2cec2', 0.45), d: mx(p.a, '#5a5650', 0.45) });
  const woodOf = (p) => { const b = mx(p.w, '#a8804e', 0.42); return { s: b, t: sh(b, 0.3), d: sh(b, -0.36), l: sh(b, 0.48) }; };
  const BONE = { s: '#b4aa90', t: '#efe8d4', d: '#7a7060' };
  const CHAR = { s: '#241f1c', t: '#3e3733', l: '#55504a' };

  /* ======================================================= lm_colossus_statue
   * Colossal king on a two-tier plinth, ~r 24, h 78: crowned, bearded, a long cloak
   * down his back, sword point-down between his feet, a crow on his shoulder. Lichen,
   * rain streaks and cracks make him old. Faces the camera. */
  M.lm_colossus_statue = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p);
    const fS = mx(p.s, '#a8a69e', 0.55), fT = mx(p.b, '#dcdad0', 0.55), fD = sh(fS, -0.25);
    const parts = [stain(27, 19, 0.3, '#2a2416', 0, 3)];
    parts.push(layer((pe) => tufts(pe, rng(3, 1), 36, -25, 25, -18, 18, undefined, (x, y) => Math.hypot(x / 20, y / 17) < 1)));
    // plinth: two octagonal tiers with a carved frieze, cracked and mossy
    parts.push({ z0: 0, z1: 4, side: st.d, top: mx(st.s, st.t, 0.4), ao: 0.35, shape: (c) => S.poly(c, ngon(8, 19, Math.PI / 8)),
      detail: (c) => { S.lines(c, 'rgba(40,36,30,0.45)', 0.35, [-16, -4, -11, 1, -11, 1, -9, 6, 10, -9, 14, -3]); for (let i = 0; i < 14; i++) S.dot(c, i % 2 ? 'rgba(255,250,235,0.16)' : 'rgba(40,36,30,0.12)', Math.cos(i * 2.4) * 15, Math.sin(i * 2.4) * 13, 1.2 + (i % 3) * 0.5); } });
    parts.push({ z0: 4, z1: 10, side: st.s, top: st.t, ao: 0.32, shape: (c) => S.poly(c, ngon(8, 14.5, Math.PI / 8)),
      detail: (c) => { S.lines(c, 'rgba(40,36,30,0.4)', 0.3, [-12, 2, -6, -1, 8, 7, 12, 4]); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; S.lines(c, 'rgba(40,36,30,0.3)', 0.3, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 14.3, Math.sin(a) * 14.3]); } } });
    parts.push({ z0: 10, z1: 11.6, side: st.d, top: st.t, ao: 0.2, shape: (c) => S.ell(c, 0, 0.5, 9.5, 7.5, 0) });
    // robe and the cloak hanging down the back (wider at the hem)
    parts.push({ z0: 11.6, z1: 42, side: fS, top: fT, ao: 0.3, shape: (c, zt) => {
      S.ell(c, 0, 0.6, 8.2 - 2.4 * zt, 6.2 - 1.4 * zt, 0);
      const w = 9.6 - 3.4 * zt; S.poly(c, [-w, -7.2 + zt * 1.2, w, -7.2 + zt * 1.2, w * 0.9, -2, -w * 0.9, -2]);
    } });
    parts.push({ z0: 42, z1: 58, side: fD, top: fS, ao: 0.3, shape: (c, zt) => { const w = 6.4 + zt * 1.6; S.poly(c, [-w, -6.2 + zt * 0.6, w, -6.2 + zt * 0.6, w * 0.95, -2.4, -w * 0.95, -2.4]); } });
    // belt, torso, pauldrons, neck
    parts.push({ z0: 41.4, z1: 43.4, side: sh(fS, -0.2), top: fS, ao: 0.2, bevel: false, shape: (c) => S.ell(c, 0, 0.6, 6.1, 4.9, 0) });
    parts.push({ z0: 43.4, z1: 58, side: fS, top: fT, ao: 0.25, shape: (c, zt) => S.ell(c, 0, 0.4, 6 + Math.pow(zt, 1.6) * 2.4, 4.6 + zt * 0.6, 0) });
    parts.push({ z0: 56.5, z1: 60.5, side: fS, top: fT, ao: 0.2, shape: (c, zt) => { const k = Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 1.1 - 0.1, 2))); S.ell(c, -8.2, 0.3, 2.6 * k, 2.4 * k, 0); S.ell(c, 8.2, 0.3, 2.6 * k, 2.4 * k, 0); } });
    parts.push(cyl(0, 0.6, 2.3, 58, 61.5, fD, fS, { ao: 0.3, bevel: false }));
    // head with a heavy beard, crown band and seven points
    parts.push({ z0: 61.5, z1: 70.5, side: fS, top: fT, ao: 0.25, shape: (c, zt) => {
      const k = Math.sqrt(Math.max(0.08, 1 - Math.pow(zt * 2 - 1, 2))) * 0.85 + 0.15;
      S.ell(c, 0, 0.8, 4.4 * k, 4 * k, 0);
      if (zt < 0.5) { const b = 1 - zt * 2; S.ell(c, 0, 2.6 + b * 1.4, 3.4 * (0.5 + b * 0.5), 2.4 * (0.4 + b * 0.6), 0); }
    } });
    parts.push({ z0: 70.2, z1: 72.2, side: sh(fS, -0.12), top: fS, ao: 0.15, bevel: false, shape: (c) => S.circ(c, 0, 0.8, 4.3) });
    parts.push({ z0: 72.2, z1: 77, side: fS, top: fT, ao: 0.1, bevel: false, shape: (c, zt) => S.star(c, 0, 0.8, 4.6 * (1 - 0.22 * zt), 3.3 - zt * 0.6, 7, -Math.PI / 2) });
    // arms: right to the sword hilt, left holding the cloak
    parts.push(limbPart([[[6.2, 5.6, 42], [8.4, 3.6, 50], [8.3, 0.6, 57.5]], [[-5.8, 4.4, 45], [-8.4, 3, 51], [-8.3, 0.6, 57.5]]], 2.9, fS, fT, { ao: 0.3 }));
    parts.push({ z0: 41.2, z1: 46.6, side: fS, top: fT, ao: 0.25, bevel: false, shape: (c, zt) => { if (zt < 0.6) S.ell(c, 5.6, 6.4, 1.9, 1.7, 0); if (zt > 0.3) S.ell(c, -5.6, 5.2, 1.8, 1.6, 0); } });
    // sword, point down between the feet
    parts.push(xzPart([[-1.3, 15.6, 1.3, 15.6, 1.3, 40, -1.3, 40], [-1.3, 15.6, 1.3, 15.6, 0, 11.7]], 11.7, 40, mx(fS, '#9aa0a8', 0.4), mx(fT, '#e8ecf0', 0.5), { ox: 5.6, oy: 7.6, v0: -0.35, v1: 0.35 }, { ao: 0.2, bevel: false }));
    parts.push(box(5.6, 7.6, 7.2, 1.3, 40, 41.4, fD, fS, { ao: 0.15, bevel: false }));
    parts.push(cyl(5.6, 7.6, 1.15, 46.4, 48.2, fD, fS, { ao: 0.15, bevel: false }));
    // crow on the left shoulder
    parts.push({ z0: 59.5, z1: 62.2, side: '#262422', top: '#464240', ao: 0.3, bevel: false, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt * 0.9 + 0.1, 0, 1)); S.ell(c, -9.2 - zt * 0.6, -0.6, 2 * k + 0.3, 1.1 * k + 0.2, 0.25); } });
    parts.push({ z0: 62, z1: 64.2, side: '#262422', top: '#4a4644', ao: 0.2, bevel: false, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt, 0, 1)) * 0.8 + 0.2; S.circ(c, -7.6, -0.6, 0.95 * k); } });
    parts.push(layer((pe) => {
      const r = rng(11, 2);
      // beak and eye of the crow
      pe.poly('#b08a40', [-6.7, -0.1, 63.3, -5.2, -0.1, 62.9, -6.7, -0.1, 62.6]);
      pe.dot('#e8e0c0', -7.2, 0.3, 63.5, 0.22);
      // face: brow shadow, closed stern eyes, nose, beard strokes
      const fy = 0.8 + 4.1;
      pe.ell('rgba(40,36,30,0.55)', -1.6, fy, 67.2, 1.1, 0.5); pe.ell('rgba(40,36,30,0.55)', 1.6, fy, 67.2, 1.1, 0.5);
      pe.lines('rgba(40,36,30,0.5)', 0.45, [-2.8, fy, 68.4, -0.6, fy, 68.1, 0.6, fy, 68.1, 2.8, fy, 68.4]);
      pe.lines('rgba(40,36,30,0.4)', 0.4, [0, fy + 0.3, 67.6, 0.2, fy + 0.6, 65.2]);
      pe.lines('rgba(255,250,240,0.35)', 0.3, [-0.5, fy + 0.3, 67.4, -0.4, fy + 0.6, 65.4]);
      for (let i = 0; i < 9; i++) { const x = -2.6 + i * 0.65; pe.lines(i % 2 ? 'rgba(40,36,30,0.4)' : 'rgba(255,250,240,0.28)', 0.3, [x, fy + 2.4, 64.6 - Math.abs(x) * 0.25, x * 0.8, fy + 2.1, 62 - Math.abs(x) * 0.4]); }
      // crown: dark gaps between the points, a gem
      for (let i = -2; i <= 2; i++) pe.lines('rgba(40,36,30,0.5)', 0.35, [i * 1.6, 5.4, 72.4, i * 1.6, 5.4, 74.6 - Math.abs(i) * 0.4]);
      pe.dot('#8a2a30', 0, 5.3, 71.2, 0.55); pe.dot('rgba(255,200,200,0.8)', -0.15, 5.3, 71.4, 0.2);
      // torso: folds, a clasp, rain streaks down the robe, the hem
      pe.lines('rgba(40,36,30,0.5)', 0.55, [-3.8, 5.6, 56, -4.4, 6.2, 45, 3.6, 5.6, 56, 4.2, 6.2, 45, 0, 5.2, 56.5, 0, 5.4, 44.5]);
      pe.lines('rgba(255,250,240,0.3)', 0.35, [-2.6, 5.7, 55, -3, 6.3, 45.5, 2.4, 5.7, 55, 2.9, 6.3, 45.5]);
      pe.dot('#8a7a50', 0, 5.3, 56.8, 0.9); pe.dot('rgba(255,240,200,0.7)', -0.2, 5.3, 57, 0.35);
      pe.lines('rgba(40,36,30,0.55)', 0.45, [-6, 6, 41.5, -3.5, 6.3, 20, -1, 6.4, 40, -1.5, 6.6, 24, 2.5, 6.3, 40, 3.5, 6.6, 18, 5.8, 6.2, 39, 7, 6.4, 30]);
      pe.lines('rgba(255,250,240,0.3)', 0.3, [-5.2, 6.1, 41, -2.8, 6.4, 22, 1.8, 6.4, 40, 2.6, 6.7, 20]);
      pe.lines('rgba(40,36,30,0.5)', 0.5, [-7.6, 6.8, 13, -6, 6.8, 12.6, -3.5, 6.8, 12.4, 0, 6.8, 12.2, 4, 6.8, 12.4, 7.4, 6.8, 13]);
      // sword blade: a bright edge and fuller
      pe.lines('rgba(255,255,255,0.55)', 0.3, [4.9, 8, 39, 5.1, 8, 18]); pe.lines('rgba(40,44,50,0.5)', 0.3, [5.9, 8, 39, 5.9, 8, 18]);
      // lichen on sunlit tops and a few on the cloak, moss and cracks on the plinth
      const lich = (x, y, z, s) => { for (let i = 0; i < 5; i++) pe.dot(LICHEN[i % 4], x + r.range(-s, s), y + r.range(-s, s) * 0.6, z + r.range(-s, s) * 0.3, r.range(0.3, 0.6) * s * 0.7); };
      lich(-8.4, 0.3, 60.6, 1.4); lich(-2, 1, 70.6, 1.2); lich(4, -2, 10.8, 1.6); lich(-10, -6, 10.4, 1.4); lich(-9, 9, 4.4, 1.8); lich(13, -4, 4.3, 1.4); lich(-5, -6.2, 50, 1.1);
      for (const q of [[-14, 11, 1.6], [12, 12.5, 1.3], [-8, 15, 1.2], [10, 7, 1.1], [-6, 6.5, 1.3]]) clump(pe, q[0], q[1] + 0.3, q[2] > 1.5 ? 0.4 : 4.2, q[2], r);
      pe.lines('rgba(40,36,30,0.55)', 0.4, [-7, 13.4, 1, -5, 13.4, 5.5, -5, 13.4, 5.5, -3.8, 13.4, 9.6, 9, 17.6, 0.5, 10.4, 17.6, 3.6]);
      // inscription band on the upper tier's front face
      for (let i = 0; i < 12; i++) { const x = -9.8 + i * 1.8; pe.lines('rgba(40,36,30,0.45)', 0.3, [x, 13.42, 6.4, x + 0.4, 13.42, 8.2, x, 13.42, 7.3, x + 0.9, 13.42, 7.1]); }
      pe.wall('rgba(255,250,240,0.2)', -14, 14, 13.4, 9.4, 9.9); pe.wall('rgba(40,36,30,0.25)', -14, 14, 13.41, 4.2, 4.7);
      stones(pe, -13.4, 13.4, 13.43, 0.4, 3.8, 5, { row: 1.7, w: 1.6, joint: 'rgba(40,34,28,0.3)' });
    }));
    return { r: 24, h: 78, parts, style: 'prop', bevel: 0.7, spots: { crown: [0, 0, 77], sword: [5.6, 7.6, 12] } };
  };

    /* ========================================================== lm_stonecircle
   * Ring of eleven standing stones (three trilithons with lintels, one fallen), a
   * flat altar slab at the centre on a worn flagstone floor, faint old runes. r 48, h 22. */
  M.lm_stonecircle = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p);
    const RX = 36, RY = 29;
    const parts = [stain(46, 32, 0.22, '#2a2416', 0, 2)];
    parts.push(layer((pe) => {
      const c = pe.c, r = rng(13, 1);
      c.save(); c.scale(1, RY / RX); c.beginPath(); c.arc(0, 0, RX + 5, 0, TAU); c.arc(0, 0, RX - 6, 0, TAU, true); c.fillStyle = 'rgba(110,96,62,0.14)'; c.fill(); c.restore();
      tufts(pe, r, 120, -46, 46, -32, 32, undefined, (x, y) => Math.hypot(x / 9, y / 7) < 1);
      // flagstone floor round the altar
      const g = c.createRadialGradient(0, 0, 1, 0, 0, 10); g.addColorStop(0, al(st.s, 0.55)); g.addColorStop(1, al(st.s, 0)); c.save(); c.scale(1, 0.8); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill(); c.restore();
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, d = 6.2; pe.poly(al(mx(st.s, st.t, 0.5), 0.75), [Math.cos(a) * d - 1.6, Math.sin(a) * d * 0.8 - 1.2, 0, Math.cos(a) * d + 1.8, Math.sin(a) * d * 0.8 - 1.4, 0, Math.cos(a) * d + 1.6, Math.sin(a) * d * 0.8 + 1.3, 0, Math.cos(a) * d - 1.7, Math.sin(a) * d * 0.8 + 1.1, 0]); }
    }));
    const stones_ = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const t = -Math.PI / 2 + (i / N) * TAU;
      if (i === 7) continue; // fallen
      const tri = i === 0 || i === 4 || i === 8;
      const h = tri ? 16 + (i === 4 ? 1.5 : 0) : [13, 15.5, 11, 14.5, 12.5, 16, 10.5, 13.5, 15, 12, 14][i] ;
      const lean = tri ? 0 : (i % 2 ? 0.07 : -0.05) * h;
      for (const o of tri ? [-0.11, 0.11] : [0]) stones_.push({ x: Math.cos(t + o) * RX, y: Math.sin(t + o) * RY, r: 2.9, sx: 1.55, sy: 1, rot: t + o + Math.PI / 2, h, seed: 90 + i * 3 + (o > 0 ? 1 : 0), n: 8, rough: tri ? 0.16 : 0.3, top: tri ? 0.66 : 0.5, pw: tri ? 7 : 4, lx: Math.cos(t) * lean, ly: Math.sin(t) * lean, moss: 0.7, t: t + o, gi: i, tri });
    }
    parts.push(rockPart(stones_, st.s, st.t, { ao: 0.42 }));
    parts.push(...rockFacets(stones_, st.t, sh(st.s, -0.3)));
    // lintels on the trilithons
    parts.push({ z0: 16, z1: 19.2, side: st.s, top: st.t, ao: 0.2, shape: (c, zt) => { for (const i of [0, 4, 8]) { const t = -Math.PI / 2 + (i / N) * TAU, h = 16 + (i === 4 ? 1.5 : 0), z = 16 + zt * 3.2; if (z < h || z > h + 2.8) continue; S.poly(c, tf([-7.2, -1.8, 7, -2, 7.4, 1.7, -6.8, 1.9], Math.cos(t) * RX, Math.sin(t) * RY, t + Math.PI / 2)); } },
      detail: (c) => { for (const i of [0, 4, 8]) { const t = -Math.PI / 2 + (i / N) * TAU; const q = tf([-5, -1, -4.6, 1, 2.4, -1.2, 2.8, 1.2], Math.cos(t) * RX, Math.sin(t) * RY, t + Math.PI / 2); S.lines(c, 'rgba(40,36,30,0.4)', 0.3, q); } } });
    // the fallen stone and the altar
    const tf7 = -Math.PI / 2 + (7 / N) * TAU;
    parts.push({ z0: 0, z1: 3.4, side: st.s, top: st.t, ao: 0.35, shape: (c, zt) => S.poly(c, tf(jag(8, 1, 7, 0.12, 0, 0, 0, 8 * (1 - zt * 0.1), 2.8 * (1 - zt * 0.3)), Math.cos(tf7) * (RX + 2), Math.sin(tf7) * (RY + 1), tf7 + 0.45)) });
    parts.push({ z0: 0, z1: 1.2, side: st.d, top: mx(st.s, st.t, 0.3), ao: 0.3, bevel: false, shape: (c) => S.poly(c, jag(12, 7.6, 3, 0.1, 0, 0, 0.5, 1, 0.8)) });
    parts.push({ z0: 1.2, z1: 4.2, side: st.s, top: st.t, ao: 0.3, shape: (c, zt) => S.poly(c, jag(10, 1, 4, 0.1, 0.1, 0, 0, 6.2 - zt * 0.4, 3.6 - zt * 0.3)),
      detail: (c) => { S.lines(c, 'rgba(40,36,30,0.5)', 0.4, [-4, -1.4, -1, 0.4, -1, 0.4, 2, -0.6, 2, -0.6, 4.6, 1.2]); S.dot(c, 'rgba(40,36,30,0.45)', -2.2, 1.4, 1.2); S.dot(c, 'rgba(40,36,30,0.45)', 2.6, -1.6, 0.9); } });
    parts.push(layer((pe) => {
      const r = rng(17, 2);
      paintMoss(pe, stones_, 13, { cracks: true, size: 0.8 });
      for (const s of stones_) {
        if (s.h < 11 || Math.sin(s.t) < -0.3) continue;
        const q = 0.35, x = s.x + s.lx * q, y = s.y + s.ly * q + 2.1;
        rune(pe, x - 0.3, y, s.h * 0.3, 2.6, '#2a2a26', s.gi * 2 + 1, 0.4, true);
        if (s.tri) rune(pe, x + 0.4, y, s.h * 0.58, 1.9, '#2a2a26', s.gi + 5, 0.35, true);
      }
      // faint carvings and lichen on the altar, grass against the stones
      for (let i = 0; i < 3; i++) rune(pe, -2.6 + i * 2.2, 3.72, 1.6, 1.4, '#2a2a26', i + 2, 0.4, true);
      for (let i = 0; i < 7; i++) pe.dot(LICHEN[i % 4], r.range(-5, 5), r.range(-3, 3), 4.3, r.range(0.3, 0.6));
      for (const s of stones_) for (let i = 0; i < 4; i++) { const x = s.x + r.range(-4, 4), y = s.y + 2.6 + r.range(0, 1.6); pe.lines(i % 2 ? '#536e2a' : '#8aa848', 0.32, [x, y, 0, x + r.range(-0.4, 0.4), y, r.range(1.5, 2.8)]); }
    }));
    return { r: 48, h: 22, parts, style: 'prop', bevel: 0.7, spots: { altar: [0, 0, 4.2] } };
  };

  /* ====================================================== lm_dragon_skeleton
   * A great dragon's bones bleaching in the grass: horned skull, arching ribcage, a long
   * curling tail, one wing splayed out behind, leg bones and claws. r 80, h 26. */
  M.lm_dragon_skeleton = function (pal, opt) {
    opt = opt || {};
    const bS = BONE.s, bT = BONE.t, bD = BONE.d;
    const ys = (x) => 5 * Math.sin((x + 10) / 28);
    const parts = [stain(70, 30, 0.26, '#2a2416', -8, 4)];
    parts.push(layer((pe) => {
      const r = rng(21, 1);
      // scorched, dusty ground under the bones and grass through the ribs
      const c = pe.c; c.save(); c.scale(1, 0.55); const g = c.createRadialGradient(10, 0, 4, 10, 0, 44); g.addColorStop(0, 'rgba(120,104,70,0.3)'); g.addColorStop(1, 'rgba(120,104,70,0)'); c.fillStyle = g; c.beginPath(); c.arc(10, 0, 44, 0, TAU); c.fill(); c.restore();
      tufts(pe, r, 80, -76, 66, -30, 30, undefined, (x, y) => Math.abs(y - ys(x)) < 4 && x > -40);
      paintBones(pe, [[-22, 20, 'bone', 0.4, 1], [38, 18, 'bone', -0.6, 1.1], [-50, 14, 'bone', 1.1, 0.9], [20, -30, 'bone', 0.3, 0.9], [58, -14, 'rib', 0.4, 1]], bT);
    }));
    // the far wing, spread flat behind the body: humerus, forearm and three long fingers
    const sh_ = [24, ys(24) - 5];
    const wing = [[[30, sh_[1] - 15, 4.5], [sh_[0], sh_[1], 15]], [[26, sh_[1] - 30, 0.8], [30, sh_[1] - 15, 4.5]]];
    const wrist = [26, sh_[1] - 30];
    for (const f of [[-12, -38, 0.5], [2, -46, 0.5], [18, -50, 0.5]]) wing.push([[f[0], sh_[1] + f[1], 0.3], [wrist[0], wrist[1], 0.8]]);
    const wingUp = wing.map((L) => L[0][2] > L[1][2] ? [L[1], L[0]] : L);
    parts.push(limbPart(wingUp, 1.6, bS, bT, { ao: 0.3 }));
    parts.push({ z0: 0, z1: 1.8, side: bS, top: bT, ao: 0.3, bevel: false, shape: (c, zt) => { const k = Math.sqrt(Math.max(0.1, 1 - zt * zt)); for (const f of [[-12, -38], [2, -46], [18, -50], [26, -30]]) S.circ(c, f[0], sh_[1] + f[1], 1.3 * k); } });
    // spine: vertebrae from the tail tip to the skull, riding high over the ribcage
    const verts = [];
    const spineZ = (x) => x > 30 ? lerp(17, 9.5, clamp((x - 30) / 14, 0, 1)) : x > -8 ? 17 : lerp(17, 1.2, Math.pow(clamp((-8 - x) / 62, 0, 1), 0.8));
    for (let x = -70; x <= 44; x += 3.1) { const mid = clamp(1 - Math.abs(x - 12) / 60, 0.25, 1); verts.push({ x, y: ys(x), z: spineZ(x), r: 0.9 + mid * 1.1, h: 1.9 + mid * 1.1, sp: x > -8 && x < 32 ? 3.2 + mid : x >= 32 ? 1.6 : 0 }); }
    parts.push({ z0: 0, z1: 20.5, side: bS, top: bT, ao: 0.3, bevel: false, shape: (c, zt) => { const z = zt * 20.5; for (const v of verts) { if (z < v.z - 0.3 || z > v.z + v.h) continue; const k = 0.8 + 0.2 * Math.sin(Math.PI * clamp((z - v.z) / v.h, 0, 1)); S.ell(c, v.x, v.y, v.r * k * 1.15, v.r * k, 0); } } });
    parts.push({ z0: 14, z1: 22, side: bS, top: bT, ao: 0.2, bevel: false, shape: (c, zt) => { const z = 14 + zt * 8; for (const v of verts) { if (!v.sp || z < v.z + v.h - 0.2 || z > v.z + v.h + v.sp) continue; const u = (z - v.z - v.h) / v.sp; S.ell(c, v.x - u * 0.8, v.y, 0.75 * (1 - u * 0.5), 0.5, 0); } } });
    // ribs: far side first, then the near side; two are broken
    const ribs = (sg) => { const out = []; for (let i = 0; i < 7; i++) { const x = -6 + i * 6, y0 = ys(x), w = 13.5 - Math.abs(i - 3) * 1.4, brk = sg > 0 && (i === 2 || i === 5); const L = [[x + 1.8, y0 + sg * w * 0.86, 0.3], [x + 1.3, y0 + sg * w * 1.06, 5], [x + 0.5, y0 + sg * w * 0.8, 11.5], [x, y0 + sg * 1.2, 16.6]]; out.push(brk ? L.slice(2) : L); } return out; };
    parts.push(limbPart(ribs(-1), 1.2, bS, bT, { ao: 0.25 }));
    // shoulder and hip blades
    parts.push({ z0: 9, z1: 15, side: bS, top: bT, ao: 0.2, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.6; for (const q of [[24, 1], [24, -1], [-4, 1], [-4, -1]]) S.ell(c, q[0] + zt * 1.5, ys(q[0]) + q[1] * (5.4 * k + 2.2), 2.6 * k + 0.6, 1.4 * k + 0.4, q[1] * 0.4); } });
    // skull: cranium wide at the back, tapering to the snout, lower jaw on the ground
    const SX = 44, SY = ys(50);
    const skull = [0, -4.8, 4, -5.6, 9, -4.6, 14, -2.6, 18.6, -1.3, 19.6, 0, 18.6, 1.3, 14, 2.6, 9, 4.6, 4, 5.6, 0, 4.8];
    parts.push({ z0: 0, z1: 1.8, side: bD, top: bS, ao: 0.3, bevel: false, shape: (c) => S.poly(c, xf([2, -5.2, 10, -4.4, 20.4, -1.4, 21, 0, 20.4, 1.4, 10, 4.4, 2, 5.2], 1, 1, 0, 0, SX, SY)) });
    parts.push({ z0: 1.2, z1: 11, side: bS, top: bT, ao: 0.35, shape: (c, zt) => { const k = Math.sqrt(Math.max(0.06, 1 - Math.pow(zt, 2.4))), kx = 0.5 + 0.5 * k; S.poly(c, xf(skull, kx, k, 4, 0, SX, SY)); },
      detail: (c) => { S.lines(c, 'rgba(70,60,44,0.5)', 0.35, [SX + 3, SY - 1.5, SX + 9, SY - 0.4, SX + 9, SY - 0.4, SX + 13, SY + 0.8, SX + 6, SY + 1.8, SX + 8, SY + 0.6]); S.dot(c, 'rgba(255,255,250,0.5)', SX + 4, SY - 1.2, 0.8); } });
    // horns sweeping back from the brow, brow spikes
    for (const sg of [-1, 1]) parts.push(...taperLimb([[SX + 2, SY + sg * 4, 8], [SX - 2.5, SY + sg * 7, 12], [SX - 7, SY + sg * 8.6, 17], [SX - 10, SY + sg * 8, 22.5]], 2.3, 0.7, bS, bT, { ao: 0.25 }));
    parts.push(limbPart([[[SX + 11, SY - 4.4, 5.5], [SX + 13, SY - 6.4, 9]], [[SX + 11, SY + 4.4, 5.5], [SX + 13, SY + 6.4, 9]]], 1.1, bS, bT, { ao: 0.2 }));
    parts.push(limbPart(ribs(1), 1.2, bS, bT, { ao: 0.25 }));
    // legs: femur, shin and three claws on the near side, a hind leg half hidden
    parts.push(beams([[2, ys(2) + 11, 2.2, -4, ys(2) + 20, 1.2], [-4, ys(2) + 20, 1.2, 2, ys(2) + 27, 0.8], [26, ys(26) + 10.5, 2.4, 32, ys(26) + 19, 1.2], [32, ys(26) + 19, 1.2, 28, ys(26) + 26, 0.8]], 1.7, bS, bT, { ao: 0.3 }));
    parts.push({ z0: 0, z1: 1.9, side: bS, top: bT, ao: 0.3, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.65; for (const q of [[2, 27, 0.9], [28, 26, -0.5]]) for (let i = -1; i <= 1; i++) { const a = q[2] + i * 0.55; taper(c, q[0], ys(q[0]) + q[1], q[0] + Math.cos(a) * 4.2, ys(q[0]) + q[1] + Math.sin(a) * 4.2, 0.9 * k, 0.25 * k); } } });
    parts.push(layer((pe) => {
      // eye socket, nostril, jaw line and teeth on the camera side of the skull
      pe.ell('#1e1a16', SX + 6.5, SY + 4.6, 6.2, 2.2, 1.6, -0.15); pe.ell('rgba(60,52,44,0.6)', SX + 6.8, SY + 4.6, 6.6, 1.1, 0.7);
      pe.dot('#1e1a16', SX + 18, SY + 1.4, 4.8, 0.6);
      pe.lines('rgba(70,60,44,0.7)', 0.45, [SX + 3, SY + 5.6, 1.9, SX + 19.6, SY + 1.6, 1.9]);
      for (let i = 0; i < 9; i++) { const u = i / 8, x = SX + 5 + u * 14.4, y = SY + 5.6 - u * 4, s = 1.1 - Math.abs(u - 0.5) * 0.5; pe.poly('#fbf7ea', [x - 0.45 * s, y + 0.02, 1.95, x + 0.45 * s, y + 0.02, 1.95, x, y + 0.02, 1.95 - 1.4 * s]); }
      pe.lines('rgba(70,60,44,0.4)', 0.3, [SX + 1, SY + 6, 4, SX + 2, SY + 6.4, 7.5, SX + 12, SY + 3.6, 3, SX + 11.5, SY + 4, 6]);
      // shading in the rib hollows and cracks on a couple of ribs
      for (let i = 0; i < 7; i++) { const x = -6 + i * 6; pe.lines('rgba(70,60,44,0.35)', 0.3, [x + 0.6, ys(x) + 9.6, 5.5, x + 0.3, ys(x) + 8.6, 9]); }
      pe.lines('rgba(70,60,44,0.5)', 0.3, [11.2, ys(12) + 11, 7, 11.9, ys(12) + 10.6, 8.6, -5.5, ys(-6) + 12, 4, -4.9, ys(-6) + 11.6, 5.8]);
    }));
    return { r: 80, h: 26, parts, style: 'prop', bevel: 0.7, spots: { skull: [SX + 9, SY, 10], ribs: [12, ys(12), 10] } };
  };

  /* ========================================================= lm_ruined_tower
   * Broken round tower, opt.v 0-2: 0 tall shell collapsed to the south-east, 1 sheared
   * west with a surviving arched window, 2 a low stump with one tall fang of wall at the
   * back. Rubble, ivy, stone courses, a dark doorway. r 20, h 40-55. */
  M.lm_ruined_tower = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p), v = (((opt.v | 0) % 3) + 3) % 3;
    const TR = 11, H = [54, 46, 40][v], cut = [32, 26, 34][v], bn = [[0.7, 0.7], [-0.9, 0.35], [0.15, 1]][v];
    const parts = [stain(22, 16, 0.3, '#2a2416', 0, 2)];
    const T = ruinTower(0, 0, TR, H, cut, bn[0], bn[1], st.s, st.t, st.d, 41 + v * 7);
    const segs = T.segs;
    // force a doorway gap at the front for v0 / v1 (a low sill), keep the back wall tall
    for (const q of segs) { const mx_ = (q.x0 + q.x1) / 2, my_ = (q.y0 + q.y1) / 2; if (my_ > 8.5 && Math.abs(mx_) < 3 && v !== 2) q.door = true; if (v === 2 && my_ < -6 && Math.abs(mx_) < 5) q.h = H; }
    parts.push(layer((pe) => tufts(pe, rng(5 + v, 1), 50, -22, 22, -16, 16, undefined, (x, y) => Math.hypot(x, y) < TR + 1)));
    parts.push(T.parts[0]);
    // debris inside: fallen blocks and a charred beam across the floor
    parts.push(rockPart([{ x: -3 + v, y: -2, r: 2.6, h: 2.2, seed: 61 + v, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.5 }, { x: 3, y: 1.5 - v, r: 2, h: 1.8, seed: 62 + v, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.3 }], st.s, st.t, { ao: 0.4 }));
    parts.push(beams([[-6, 3, 0.6, 5, -4, 2.6]], 0.9, '#3a3430', '#6a625a'));
    parts.push(T.parts[1]);
    // doorway: a dark arch cut by painting; rubble heaped on the breach side
    const bx = bn[0] * (TR + 5), by = bn[1] * (TR + 4);
    const rub = [];
    const rr = rng(71 + v, 2);
    for (let i = 0; i < 6; i++) { const a = rr.range(0, TAU), d = rr.range(0, 7); rub.push({ x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d * 0.7, r: rr.range(1.6, 3.2), h: rr.range(1.4, 2.8), seed: 80 + i + v * 10, n: rr.int(5, 7), rough: 0.16, top: 0.72, pw: 5, moss: rr.range(0.2, 0.8) }); }
    rub.push({ x: -bn[0] * 14, y: 10 + bn[1] * 2, r: 2.4, h: 2, seed: 99 + v, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.6 });
    parts.push(rockPart(rub, st.s, st.t, { ao: 0.4 }));
    parts.push(...rockFacets(rub, st.t, sh(st.s, -0.3)));
    // a fallen slab of wall lying in the rubble
    parts.push({ z0: 0, z1: 2.6, side: st.s, top: st.t, ao: 0.3, shape: (c, zt) => S.poly(c, tf([-5, -1.4 + zt * 0.3, 5, -1.3 + zt * 0.3, 4.6, 1.4 - zt * 0.3, -5.2, 1.3 - zt * 0.3], bx * 1.15, by * 1.2 + 2, Math.atan2(by, bx) + 1.2)) });
    parts.push(layer((pe) => {
      const c = pe.c, r = rng(9 + v, 3);
      // stone courses on the standing front faces
      for (let z = 1.8, row = 0; z < H; z += 1.9, row++) {
        for (const q of segs) {
          if (q.h < z + 0.6) continue;
          const a0 = Math.atan2(q.y0, q.x0), a1 = Math.atan2(q.y1, q.x1);
          if (Math.sin((a0 + a1) / 2) < 0.05) continue;
          const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
          c.beginPath(); c.arc(0, -z, TR + 0.03, lo, hi); c.strokeStyle = 'rgba(40,34,28,0.17)'; c.lineWidth = 0.3; c.stroke();
          for (let k = 0; k < 2; k++) { const a = lo + (hi - lo) * ((k + (row % 2 ? 0.55 : 0.2)) / 2); const x = Math.cos(a) * (TR + 0.03), y = Math.sin(a) * (TR + 0.03); pe.lines('rgba(40,34,28,0.22)', 0.3, [x, y, z - 1.9, x, y, z]); if (r.next() < 0.22) pe.wall(r.next() < 0.5 ? 'rgba(255,250,235,0.1)' : 'rgba(30,24,18,0.1)', x - 0.9, x + 0.9, y, z - 1.8, z - 0.1); }
        }
      }
      for (const q of segs) {
        const mx_ = (q.x0 + q.x1) / 2, my_ = (q.y0 + q.y1) / 2, a = Math.atan2(my_, mx_);
        if (Math.sin(a) < 0.2) continue;
        const fx = Math.cos(a) * (TR + 0.04), fy = Math.sin(a) * (TR + 0.04);
        if (q.door) archRect(pe, '#1a1510', fx - 2.4, fx + 2.4, fy, 0.8, 8.2, true);
        else if (q.h > 15 && Math.abs(Math.cos(a)) > 0.3) archRect(pe, '#1e1812', fx - 0.8, fx + 0.8, fy, q.h * 0.42, q.h * 0.42 + 3.4, true);
        if (q.h > 30 && Math.abs(Math.cos(a)) > 0.25) archRect(pe, '#1e1812', fx - 1.5, fx + 1.5, fy, q.h - 11, q.h - 5.6, true);
        if (q.h > 0.5 && q.h < H - 3) pe.lines('rgba(255,250,235,0.3)', 0.5, [q.x0 * (TR + 0.1) / (TR - 1.3), q.y0 * (TR + 0.1) / (TR - 1.3), q.h - 0.3, q.x1 * (TR + 0.1) / (TR - 1.3), q.y1 * (TR + 0.1) / (TR - 1.3), q.h - 0.3]);
      }
      // ivy climbing the sunlit side and over the door, lichen, grass at the foot
      const ivyX = v === 1 ? 5 : -6, ivyA = Math.atan2(Math.sqrt(Math.max(0.1, TR * TR - ivyX * ivyX)), ivyX);
      let hAt = 0; for (const q of segs) { if (Math.abs(Math.atan2((q.y0 + q.y1) / 2, (q.x0 + q.x1) / 2) - ivyA) < 0.3) hAt = q.h; }
      ivy(pe, r, ivyX, Math.sin(ivyA) * (TR + 0.08), 0.5, Math.max(8, Math.min(hAt - 2, 26)), { dens: 1.8, size: 1.1 });
      ivy(pe, r, ivyX + 7, Math.sqrt(Math.max(0.1, TR * TR - (ivyX + 7) * (ivyX + 7))) + 0.08, 0.5, 9, { dens: 1.4 });
      for (let i = 0; i < 10; i++) { const a = r.range(0.3, 2.8); pe.dot(LICHEN[i % 4], Math.cos(a) * (TR + 0.1), Math.sin(a) * (TR + 0.1), r.range(2, 20), r.range(0.3, 0.6)); }
      paintMoss(pe, rub, 15 + v, { cracks: false });
      pe.lines('rgba(40,34,28,0.5)', 0.4, [-4, 10.3, 12, -3, 10.4, 18, -3, 10.4, 18, -4.5, 10.3, 23]);
    }));
    return { r: 20, h: H + 1, parts, style: 'prop', bevel: 0.7, spots: { door: [0, TR + 1, 0] } };
  };

  /* ========================================================== lm_ruined_wall
   * Collapsed curtain wall segment, 16 dirs, 40 long along x, 6 thick: pieces standing at
   * their own heights with ragged tops, rubble at the foot, mortar courses on the faces
   * that face the camera. h 14. */
  M.lm_ruined_wall = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p), seed = opt.seed || 3;
    const segs = wallRun([[-20, 0], [20, 0]], seed, { H: 14, gap: 0.14, low: 0.5, seg: 5, noCren: true });
    segs[0].h = Math.max(segs[0].h, 9); segs[segs.length - 1].h = Math.min(segs[segs.length - 1].h, 5);
    const parts = [];
    const r = rng(seed, 4), rub = [];
    for (const q of segs) if (q.h < 6) { const n = q.h < 3 ? 3 : 2; for (let i = 0; i < n; i++) rub.push({ x: (q.x0 + q.x1) / 2 + r.range(-2.4, 2.4), y: (r.next() < 0.5 ? -1 : 1) * r.range(3.4, 6.2), r: r.range(1.5, 2.6), h: r.range(1.2, 2.4), seed: 90 + rub.length, n: r.int(5, 7), rough: 0.16, top: 0.72, pw: 5 }); }
    rub.push({ x: 21.5, y: 2.5, r: 2.2, h: 1.8, seed: 120, n: 5, rough: 0.14, top: 0.74, pw: 5 });
    parts.push(rockPart(rub, st.s, st.t, { ao: 0.4, detail: (c) => { for (const q of rub) S.dot(c, 'rgba(90,120,50,0.6)', q.x - q.r * 0.3, q.y - q.r * 0.3, q.r * 0.3); } }));
    parts.push(...rockFacets(rub, st.t, sh(st.s, -0.3)));
    parts.push(wallPart(segs, 6, st.s, st.t, { brk: 3, extra: { detail: (c) => { const r2 = rng(seed, 9); for (const q of segs) { if (q.h < 13) continue; S.lines(c, 'rgba(40,36,30,0.4)', 0.35, [q.x0 + 1, -2, q.x0 + 2, 1.5, q.x1 - 1.5, -2.6, q.x1 - 0.8, 0.5]); for (let i = 0; i < 4; i++) S.dot(c, i % 2 ? 'rgba(90,120,50,0.6)' : 'rgba(255,250,235,0.2)', r2.range(q.x0, q.x1), r2.range(-2.4, 2.4), r2.range(0.5, 1)); } } } }));
    const quad = (q) => [q.x0 - 0.15, -3, q.x1 + 0.15, -3, q.x1 + 0.15, 3, q.x0 - 0.15, 3];
    const zmax = Math.max.apply(null, segs.map((q) => q.h));
    const litDark = (col, test, t) => ({ z0: 0.3, z1: zmax, side: col, top: col, ao: 0.3, bevel: false, shape: (c, zt) => { const z = 0.3 + zt * (zmax - 0.3); for (const q of segs) if (z < q.h - 3.2) slivers(c, quad(q), test, t); } });
    parts.push(litDark(st.t, (sx, sy) => sx < -0.42 && sy > -0.75, 0.7));
    parts.push(litDark(sh(st.s, -0.32), (sx, sy) => sx > 0.4 && sy > -0.4, 0.7));
    parts.push(...courses([2.6, 5.2, 7.8, 10.4], (z) => segs.filter((q) => q.h > z + 2.6).map(quad), 'rgba(40,34,28,0.35)', 0.35));
    return { r: 24, h: zmax + 1, parts, style: 'prop', bevel: 0.6 };
  };

    /* ============================================================= lm_hedgerow
   * Dense hedge segment, 16 dirs, 30 long along x, ~7 wide, 7 tall: two tiers of
   * scalloped leaf clumps, lighter on top, with blossom and berries. */
  M.lm_hedgerow = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed || 1, r = rng(seed, 7);
    const lo = [], hi = [];
    for (let i = 0; i < 8; i++) { const x = -13 + i * 3.7 + r.range(-0.5, 0.5); lo.push({ x, y: r.range(-0.9, 0.9), r: r.range(3.4, 4.2), s: r.int(1, 1e5), n: 8 }); }
    for (let i = 0; i < 7; i++) { const x = -11.5 + i * 3.8 + r.range(-0.6, 0.6); hi.push({ x: x - 0.4, y: r.range(-0.6, 0.6) - 0.5, r: r.range(2.6, 3.3), s: r.int(1, 1e5), n: 7 }); }
    const prof = dome(0.7, 0.3, 0.78);
    const parts = [];
    parts.push({ z0: 0, z1: 1.4, side: '#3a2a1a', top: '#5a4428', ao: 0.4, bevel: false, shape: (c) => c.rect(-13.5, -1.2, 27, 2.4) });
    const dabs = (clumps, k, dark, light, extra) => (c) => {
      const r2 = rng(seed, 21);
      c.save(); c.beginPath(); for (const q of clumps) puff(c, q.x, q.y, q.r * k, q.s, q.n); c.clip();
      for (const q of clumps) { const rr = q.r * k; for (let i = 0; i < 9; i++) { const a = r2.range(0, TAU), d = rr * Math.sqrt(r2.next()) * 0.9, lit = -(Math.cos(a) + Math.sin(a)) > 0; c.fillStyle = lit ? light : dark; c.beginPath(); c.ellipse(q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, r2.range(0.4, 0.7), r2.range(0.25, 0.45), r2.range(0, Math.PI), 0, TAU); c.fill(); } }
      if (extra) extra(c, r2);
      c.restore();
    };
    parts.push({ z0: 0.6, z1: 5.4, side: '#203a16', top: '#4a7a2c', ao: 0.5, shape: (c, zt) => { for (const q of lo) puff(c, q.x, q.y, q.r * prof(zt), q.s, q.n); }, detail: dabs(lo, prof(1), 'rgba(16,34,10,0.5)', 'rgba(140,190,80,0.45)') });
    parts.push({ z0: 2.8, z1: 7.2, side: '#35602a', top: '#79ab3f', ao: 0.42, shape: (c, zt) => { for (const q of hi) puff(c, q.x, q.y, q.r * prof(zt), q.s, q.n); },
      detail: dabs(hi, prof(1), 'rgba(24,50,14,0.5)', 'rgba(190,230,110,0.5)', (c, r2) => {
        for (let i = 0; i < 9; i++) { const q = hi[r2.int(0, hi.length - 1)], a = r2.range(0, TAU), d = q.r * r2.range(0.1, 0.6), x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d; if (i % 3 === 0) { S.dot(c, '#f6f0f8', x, y, 0.5); S.dot(c, '#f2d040', x, y, 0.18); } else { for (let b = 0; b < 3; b++) { const bx = x + (b - 1) * 0.42, by = y + (b === 1 ? -0.35 : 0); S.dot(c, '#7a1424', bx + 0.08, by + 0.08, 0.34); S.dot(c, '#d8243a', bx, by, 0.3); S.dot(c, '#ffb0b8', bx - 0.1, by - 0.1, 0.1); } } }
      }) });
    return { r: 17, h: 7.5, parts, style: 'prop', bevel: 0.5 };
  };

  /* ============================================================ lm_stonewall
   * Dry-stone field wall segment, 16 dirs, 30 long along x, 3 wide, 4 tall: a bumpy
   * battered course wall with upright coping stones, lit and shaded facets, moss. */
  M.lm_stonewall = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p), seed = opt.seed || 1;
    const sS = mx(st.s, '#6e6c66', 0.4), sT = mx(st.t, '#a8a69c', 0.4);
    const top_ = [], bot = [];
    for (let x = -15; x <= 15; x += 1.5) { top_.push(x, 1.5 + (U.hash2(x * 2 | 0, seed, 3) - 0.5) * 0.5); bot.unshift(x, -1.5 - (U.hash2(x * 2 | 0, seed, 4) - 0.5) * 0.5); }
    const base = top_.concat(bot);
    const sect = (z) => [xf(base, 1, 1 - 0.18 * (z / 3.2), 0, 0)];
    const parts = [];
    parts.push({ z0: 0, z1: 3.2, side: sS, top: sT, ao: 0.45, shape: (c, zt) => S.poly(c, sect(zt * 3.2)[0]),
      detail: (c) => { const r = rng(seed, 11); for (let x = -14; x < 15; x += r.range(1.4, 2.6)) S.lines(c, 'rgba(40,36,30,0.4)', 0.3, [x, -1.2, x + r.range(-0.3, 0.3), 1.2]); for (let i = 0; i < 8; i++) S.dot(c, i % 2 ? 'rgba(90,120,50,0.65)' : 'rgba(160,160,100,0.5)', r.range(-14, 14), r.range(-1, 1), r.range(0.35, 0.7)); } });
    parts.push({ z0: 0.3, z1: 2.9, side: sT, top: sT, ao: 0.3, bevel: false, shape: (c, zt) => slivers(c, sect(0.3 + zt * 2.6)[0], (sx, sy) => sx < -0.42 && sy > -0.75, 0.5) });
    parts.push({ z0: 0.3, z1: 2.9, side: sh(sS, -0.32), top: sh(sS, -0.32), ao: 0.1, bevel: false, shape: (c, zt) => slivers(c, sect(0.3 + zt * 2.6)[0], (sx, sy) => sx > 0.4 && sy > -0.4, 0.5) });
    parts.push(...courses([1.1, 2.2], sect, 'rgba(40,34,28,0.4)', 0.3));
    parts.push({ z0: 3.2, z1: 4.3, side: sh(sS, -0.1), top: mx(sT, sS, 0.3), ao: 0.3, shape: (c, zt) => { const k = 1 - zt * 0.35; for (let i = 0; i < 19; i++) { const x = -14.2 + i * 1.58, dy = (i % 2 ? 0.18 : -0.18); S.poly(c, tf([-0.62 * k, -1.05 * k, 0.62 * k, -1.05 * k, 0.62 * k, 1.05 * k, -0.62 * k, 1.05 * k], x, dy, (U.hash2(i, seed, 8) - 0.5) * 0.3)); } } });
    return { r: 16, h: 4.6, parts, style: 'prop', bevel: 0.5 };
  };

  /* ============================================================= lm_wayshrine
   * Roadside shrine: a stone niche under a little gabled cap, a tiny saint inside,
   * candles burning on the step, flowers left by travellers, moss. r 8, h 14. */
  M.lm_wayshrine = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p), G = p.g;
    const parts = [stain(8, 6, 0.28, '#2a2216', 0, 1.5)];
    parts.push(box(0, 1.2, 7.4, 6, 0, 1.3, st.d, mx(st.s, st.t, 0.4), { ao: 0.3, detail: (c) => S.lines(c, 'rgba(40,36,30,0.4)', 0.3, [-3.6, 2.6, 3.6, 2.6, -1, -1.6, -1, 4]) }));
    parts.push(box(0, 0, 5.6, 4.4, 1.3, 9.6, st.s, st.t, { ao: 0.32 }));
    // gabled cap: north plane lit, south plane mid, a ridge stone and a little orb
    parts.push({ z0: 9.6, z1: 12.8, side: sh(st.t, 0.08), top: sh(st.t, 0.1), ao: 0.14, bevel: false, shape: (c, zt) => { const w = 2.9 * (1 - zt); c.rect(-3.4, -w, 6.8, w + 0.05); } });
    parts.push({ z0: 9.6, z1: 12.8, side: mx(st.s, st.t, 0.4), top: mx(st.s, st.t, 0.5), ao: 0.14, bevel: false, shape: (c, zt) => { const w = 2.9 * (1 - zt); c.rect(-3.4, -0.05, 6.8, w + 0.05); } });
    parts.push(box(0, 0, 7, 1, 12.6, 13.2, st.s, st.t, { ao: 0.1, bevel: false }));
    parts.push(cyl(0, 0, 0.7, 13.2, 14.4, '#8a6a34', '#d8b060', { ao: 0.15, bevel: false }));
    // candles on the step with flames
    const cand = [[-2.4, 3.2, 1.6], [-1.5, 3.9, 1.1], [2.3, 3.4, 1.3]];
    parts.push({ z0: 1.3, z1: 3, side: '#c8bc9c', top: '#efe6d0', ao: 0.3, bevel: false, shape: (c, zt) => { const z = 1.3 + zt * 1.7; for (const q of cand) if (z <= 1.3 + q[2] + 0.05) S.circ(c, q[0], q[1], 0.42); } });
    parts.push({ z0: 2.4, z1: 3.9, side: '#ff9a30', top: '#fff0b0', flat: true, bevel: false, shape: (c, zt) => { const z = 2.4 + zt * 1.5; for (const q of cand) { const z0 = 1.3 + q[2], u = (z - z0) / 1.1; if (u < 0 || u > 1) continue; S.circ(c, q[0], q[1], 0.3 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 0.05); } } });
    parts.push(layer((pe) => {
      const r = rng(7, 1), y = 2.22;
      // the niche with a tiny saint, a shelf and a carved border
      archRect(pe, '#1a1510', -1.6, 1.6, y, 3.2, 8.4, true);
      archRect(pe, 'rgba(255,250,235,0.3)', -1.95, 1.95, y + 0.01, 3, 8.8, true); archRect(pe, '#1a1510', -1.6, 1.6, y + 0.02, 3.2, 8.4, true);
      pe.glow(G, 0, y, 4.6, 2.6, 0.35);
      pe.poly('#d8d2c0', [-0.8, y + 0.03, 3.3, 0.8, y + 0.03, 3.3, 0.6, y + 0.03, 6.4, -0.6, y + 0.03, 6.4]);
      pe.dot('#e8e2d0', 0, y + 0.03, 7.1, 0.62); pe.lines('rgba(40,36,30,0.6)', 0.25, [-0.5, y + 0.04, 5.4, 0.5, y + 0.04, 5.4, 0, y + 0.04, 4.2, 0, y + 0.04, 6.2]);
      pe.wall(mx(st.s, st.t, 0.5), -2.4, 2.4, y + 0.01, 2.8, 3.2);
      pe.lines('rgba(40,36,30,0.35)', 0.3, [-2.6, y, 1.6, 2.6, y, 1.6, -2.6, y, 9.2, 2.6, y, 9.2]);
      for (const q of cand) { pe.glow('#ffb040', q[0], q[1], 1.3 + q[2] + 0.8, 2.4, 0.4); pe.lines('rgba(120,90,40,0.6)', 0.25, [q[0], q[1] + 0.42, 1.3 + q[2] - 0.6, q[0] + 0.3, q[1] + 0.42, 1.3 + q[2] - 1.2]); }
      // flowers and leaves on the step, moss on the cap's shaded edge and the step
      for (let i = 0; i < 7; i++) { const x = r.range(-3.2, 3.2), yy = r.range(2.6, 4.2); pe.dot('#3e6a2a', x + 0.4, yy + 0.2, 1.35, 0.5); pe.dot(['#e85a6a', '#f2e24a', '#f0f0f0', '#a86ad8', '#ff9a50'][i % 5], x, yy, 1.5, 0.42); pe.dot('rgba(255,255,255,0.6)', x - 0.1, yy - 0.1, 1.55, 0.14); }
      clump(pe, -2.6, -2.2, 9.9, 1.1, r); clump(pe, 3.2, 2.4, 1.4, 0.9, r); clump(pe, -3.4, 3.6, 1.4, 0.8, r);
      for (let i = 0; i < 5; i++) pe.dot(LICHEN[i % 4], r.range(-3, 3), -2.6 + r.range(0, 1), 11.8 - r.range(0, 1.4), r.range(0.3, 0.5));
      pe.lines('rgba(40,36,30,0.45)', 0.3, [2.2, y, 4, 2.7, y, 6.5, 2.7, y, 6.5, 2.4, y, 8.6]);
    }));
    return { r: 8, h: 14.6, parts, style: 'prop', bevel: 0.6, spots: { candles: [0, 3.5, 3] } };
  };

  /* =========================================================== lm_wagon_wreck
   * Wagon thrown onto its side: the bed stands as a wall of planks with its underframe to
   * the camera, one wheel in the air on the upturned axle, one wheel broken off, barrels
   * and grain sacks spilled in the grass, the tongue snapped. r 16, h 10. */
  M.lm_wagon_wreck = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), w = woodOf(p), wl = mx(p.w, '#a07a50', 0.35);
    const BY = -1.6;
    const parts = [stain(16, 10, 0.3, '#2a2216', 0, 2)];
    parts.push(layer((pe) => { const r = rng(9, 1); for (let i = 0; i < 40; i++) { const x = r.range(-4, 12), y = r.range(2, 10); pe.lines(r.next() < 0.5 ? '#d8b860' : '#b89040', 0.3, [x, y, 0, x + r.range(-1.4, 1.4), y + r.range(-0.8, 0.8), 0.1]); } for (let i = 0; i < 22; i++) pe.dot('#e8d8a0', 5 + r.range(-3, 3), 7.2 + r.range(-2, 2), 0.1, 0.28); tufts(pe, r, 30, -15, 14, -8, 10, undefined, (x, y) => Math.abs(y - BY) < 2 && Math.abs(x) < 8); }));
    // ground wheels (on the lowered side) and the broken-off wheel in the grass
    const wheelRing = (c, x, y, R, a0, a1) => { c.moveTo(x + Math.cos(a0 || 0) * R, y + Math.sin(a0 || 0) * R); c.arc(x, y, R, a0 || 0, a1 === undefined ? TAU : a1); };
    parts.push({ z0: 0, z1: 0.9, side: w.d, top: w.s, stroke: 0.9, ao: 0.1, bevel: false, shape: (c) => { wheelRing(c, -3, BY + 0.6, 3.8); wheelRing(c, 4.2, BY + 0.6, 3.8); wheelRing(c, 10.6, -3.6, 3.6, 0.9, 6.1); } });
    parts.push({ z0: 0, z1: 0.7, side: w.d, top: w.t, stroke: 0.5, ao: 0.1, bevel: false, shape: (c) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; for (const q of [[-3, BY + 0.6], [4.2, BY + 0.6]]) S.seg(c, q[0] - Math.cos(a) * 3.3, q[1] - Math.sin(a) * 3.3, q[0] + Math.cos(a) * 3.3, q[1] + Math.sin(a) * 3.3); if (i % 2 === 0) S.seg(c, 10.6, -3.6, 10.6 + Math.cos(a + 0.9) * 3.1, -3.6 + Math.sin(a + 0.9) * 3.1); } } });
    // the bed, a wall of planks; its underframe (axle posts, bolsters) faces the camera
    parts.push(xzPart([[-7, 0.3, 7, 0.3, 7, 8.4, -7, 8.4], [-7.2, 0.2, -6.2, 0.2, -6.2, 10.2, -7.2, 10.2]], 0.2, 10.2, w.d, w.s, { oy: BY, v0: -0.45, v1: 0.45 }, { ao: 0.25, bevel: false }));
    parts.push({ z0: 0, z1: 8.2, side: sh(w.d, -0.1), top: w.s, ao: 0.3, bevel: false, shape: (c) => { S.circ(c, -3, BY + 0.6, 0.55); S.circ(c, 4.2, BY + 0.6, 0.55); } });
    parts.push(beams([[-6.8, BY + 0.5, 4.3, 6.8, BY + 0.5, 4.3], [-7.2, BY + 0.2, 8.6, 7.2, BY + 0.2, 8.6], [3.5, BY + 0.2, 8.6, 9.6, BY + 0.8, 5]], 0.75, w.d, w.l, { ao: 0.2 }));
    // the wheel still in the air on the upturned axle
    parts.push({ z0: 7.7, z1: 8.6, side: w.d, top: w.s, stroke: 1, ao: 0.1, bevel: false, shape: (c) => wheelRing(c, -3, BY + 0.6, 3.8) });
    parts.push({ z0: 8.1, z1: 8.5, side: w.d, top: w.t, stroke: 0.5, ao: 0.1, bevel: false, shape: (c) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; S.seg(c, -3 - Math.cos(a) * 3.4, BY + 0.6 - Math.sin(a) * 3.4, -3 + Math.cos(a) * 3.4, BY + 0.6 + Math.sin(a) * 3.4); } } });
    parts.push(cyl(-3, BY + 0.6, 0.9, 8.2, 9.4, sh(w.d, -0.2), w.s, { ao: 0.2, bevel: false }));
    // snapped tongue, spilled barrels (one burst), sacks, a loose board
    parts.push(beams([[-7.4, BY + 0.4, 3.6, -13.5, 0.6, 0.6], [-12, 0.2, 0.5, -15.2, 2.4, 0.3]], 0.8, w.d, w.l, { ao: 0.2 }));
    parts.push({ z0: 0, z1: 3.9, side: mx(p.w, '#b08250', 0.5), top: mx(p.w, '#d8a870', 0.5), ao: 0.4, shape: (c, zt) => { lyingCyl(c, 2.4, 5.6, 5.2, 1.95, 0.35, zt * 3.9); lyingCyl(c, -5.6, 7.2, 5.2, 1.95, -0.55, zt * 3.9); } });
    parts.push(plank(10, 4.6, 5, 1.1, 0.7, 0, 0.6, w.d, wl)); parts.push(plank(12.6, 7.4, 4.6, 1.1, -0.3, 0, 0.6, w.d, wl));
    parts.push({ z0: 0, z1: 0.6, side: '#3a3836', top: '#6a6866', stroke: 0.45, ao: 0.1, bevel: false, shape: (c) => { S.ell(c, 11.4, 8.8, 2.1, 1.1, 0.3); S.ell(c, 8.6, 9.8, 2, 1, -0.4); } });
    parts.push({ z0: 0, z1: 3.2, side: '#b8a47c', top: '#e8dcbc', ao: 0.35, shape: (c, zt) => { const k = 1 - zt * zt * 0.55; S.blob(c, 6.6, 8.4, 2.2 * k, 3, 8, 0.2); S.blob(c, 3.6, 10, 1.8 * k, 5, 8, 0.2); } });
    parts.push(layer((pe) => {
      // plank lines and a torn-out board on the bed, iron straps, barrel hoops, the sack's spill
      const y = BY + 0.47;
      for (const z of [2.3, 4.3, 6.4]) pe.lines('rgba(40,26,14,0.55)', 0.32, [-6.8, y, z, 6.8, y, z]);
      pe.poly('#1e1610', [1.2, y + 0.01, 4.4, 3.4, y + 0.01, 4.4, 3.6, y + 0.01, 6.3, 1.4, y + 0.01, 6.3]);
      pe.lines('rgba(60,58,56,0.8)', 0.4, [-4.6, y + 0.02, 0.6, -4.6, y + 0.02, 8.2, 5.8, y + 0.02, 0.6, 5.8, y + 0.02, 8.2]);
      for (const q of [[2.4, 5.6, 0.35], [-5.6, 7.2, -0.55]]) for (const d of [-1.6, 1.6]) { const e = tf([d, -2.1, d, 2.1], q[0], q[1], q[2]); pe.c.beginPath(); pe.c.ellipse((e[0] + e[2]) / 2, (e[1] + e[3]) / 2 - 1.95, Math.abs(Math.sin(q[2])) * 2.1 + 0.3, 1.95, 0, 0, TAU); pe.c.strokeStyle = 'rgba(50,48,46,0.8)'; pe.c.lineWidth = 0.4; pe.c.stroke(); }
      pe.lines('rgba(120,90,50,0.6)', 0.3, [6, 10.5, 1.2, 7.2, 10.5, 1.2]);
    }));
    return { r: 16, h: 10.5, parts, style: 'prop', bevel: 0.6 };
  };

  /* ========================================================= lm_camp_deserted
   * Abandoned camp: one tent standing, one collapsed over its broken pole, a cold firepit
   * with a tripod and pot, a weapon rack with a spear, a shield and crossbar, a log seat,
   * a barrel and a bedroll. r 30, h 10. */
  M.lm_camp_deserted = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), w = woodOf(p);
    const CV = mx(p.k2, '#a89878', 0.6), CVN = sh(CV, 0.16), CVS = sh(CV, -0.08);
    const parts = [stain(30, 20, 0.3, '#2a2216', 0, 2)];
    parts.push(layer((pe) => { const c = pe.c, g = c.createRadialGradient(0, 2, 2, 0, 2, 20); g.addColorStop(0, 'rgba(110,90,58,0.3)'); g.addColorStop(1, 'rgba(110,90,58,0)'); c.save(); c.scale(1, 0.75); c.fillStyle = g; c.beginPath(); c.arc(0, 2, 20, 0, TAU); c.fill(); c.restore(); tufts(pe, rng(4, 1), 60, -29, 29, -19, 19, undefined, (x, y) => Math.hypot(x / 16, (y - 2) / 11) < 1); }));
    // standing tent: two canvas planes on a ridge along x, sagging, with a dark door flap
    const TX = -12, TY = -5, TL = 7.5, TW = 6.2, TH = 7.6;
    parts.push({ z0: 0, z1: TH, side: CVN, top: CVN, ao: 0.12, bevel: false, shape: (c, zt) => { const ww = TW * Math.pow(1 - zt, 1.08), l = TL - zt * 0.4; c.rect(TX - l, TY - ww, 2 * l, ww + 0.03); } });
    parts.push({ z0: 0, z1: TH, side: CVS, top: CVS, ao: 0.12, bevel: false, shape: (c, zt) => { const ww = TW * Math.pow(1 - zt, 1.08), l = TL - zt * 0.4; c.rect(TX - l, TY - 0.03, 2 * l, ww + 0.03); } });
    parts.push(beams([[TX - TL - 0.2, TY, 0, TX - TL - 0.2, TY, TH + 0.6], [TX + TL + 0.2, TY, 0, TX + TL + 0.2, TY, TH + 0.6], [TX - TL - 0.3, TY, TH + 0.4, TX + TL + 0.3, TY, TH + 0.4]], 0.6, w.d, w.l, { ao: 0.2 }));
    parts.push(beams([[TX - TL - 0.2, TY, TH, TX - TL - 4.5, TY + 2, 0.2], [TX + TL + 0.2, TY, TH, TX + TL + 4.4, TY - 1.5, 0.2]], 0.25, '#8a7a5a', '#c8b890', { ao: 0 }));
    // collapsed tent: a heap of canvas over a snapped pole
    parts.push({ z0: 0, z1: 2.4, side: CVS, top: CVN, ao: 0.3, shape: (c, zt) => { const k = 1 - zt * zt * 0.5; S.blob(c, 11, 8, 6.4 * k, 5, 9, 0.3); S.blob(c, 15.5, 6.5, 3.6 * k, 7, 8, 0.3); },
      detail: (c) => { S.lines(c, 'rgba(60,50,30,0.45)', 0.4, [6, 8, 12, 5, 12, 5, 16, 7.5, 8, 11, 13, 9.5, 13, 9.5, 17, 9]); S.lines(c, 'rgba(255,250,235,0.3)', 0.35, [7, 6.5, 12, 4, 10, 10.5, 14, 8]); } });
    parts.push(beams([[6.6, 10.4, 0.4, 13, 7.4, 4.8], [13, 7.4, 4.8, 15, 5.6, 3.2]], 0.6, w.d, w.l, { ao: 0.2 }));
    // cold firepit: stone ring, grey ash, charred logs, a tripod with a hanging pot
    const ring = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2; ring.push({ x: Math.cos(a) * 3.8, y: 2 + Math.sin(a) * 3.1, r: 1.05, h: 1.3, seed: 140 + i, n: 7 }); }
    parts.push(rockPart(ring, '#6e6a62', '#a8a49a'));
    parts.push({ z0: 0, z1: 0.6, side: '#4a4844', top: '#8a8682', ao: 0.1, bevel: false, shape: (c) => S.ell(c, 0, 2, 2.8, 2.2, 0), detail: (c) => { S.dot(c, '#3a3836', -0.6, 1.6, 0.9); S.dot(c, '#5a5856', 0.9, 2.5, 0.6); } });
    parts.push({ z0: 0, z1: 1.4, side: '#1e1a18', top: '#3a3430', ao: 0.3, shape: (c, zt) => { lyingCyl(c, 0, 2, 4.6, 0.5, 0.5, zt * 1.4); lyingCyl(c, 0.3, 2.2, 4.2, 0.5, -0.7, zt * 1.4); } });
    parts.push(beams([[-3.4, 4.6, 0, 0, 2, 7.4], [3.4, 4.4, 0, 0, 2, 7.4], [0.4, -1.4, 0, 0, 2, 7.4]], 0.45, w.d, w.l, { ao: 0.2 }));
    parts.push(beams([[0, 2, 7.2, 0, 2, 5.2]], 0.25, '#3a3836', '#6a6866', { ao: 0 }));
    parts.push({ z0: 3.2, z1: 5.2, side: '#2a2c2e', top: '#4a4c50', ao: 0.35, shape: (c, zt) => S.circ(c, 0, 2, 1.1 + 0.5 * Math.sin(Math.PI * zt)), detail: (c) => S.dot(c, '#151413', 0, 2, 0.9) });
    // weapon rack: two posts and a crossbar, a leaning spear, a shield against a post
    parts.push({ z0: 0, z1: 6.2, side: w.d, top: w.t, ao: 0.3, shape: (c) => { c.rect(11.5, -9.4, 0.8, 0.8); c.rect(19.5, -9.4, 0.8, 0.8); } });
    parts.push(beams([[11.6, -8.9, 5.6, 20.2, -8.9, 5.6], [11.6, -8.9, 2.4, 20.2, -8.9, 2.4]], 0.55, w.d, w.l, { ao: 0.2 }));
    parts.push(beams([[14.2, -5.6, 0, 16, -9.2, 10.2]], 0.35, w.d, w.l, { ao: 0.1 }));
    parts.push({ z0: 9.6, z1: 11.2, side: '#7a7c80', top: '#c8ccd0', ao: 0.1, bevel: false, shape: (c, zt) => S.ell(c, 15.9 - zt * 0.1, -9.1, 0.55 * (1 - zt * 0.8) + 0.1, 0.3, 0) });
    { const disc = []; for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; disc.push(Math.cos(a) * 2.3, 2.6 + Math.sin(a) * 2.3); }
      parts.push(xzPart([disc], 0.3, 4.9, '#6a3a2a', mx(p.k, '#b04040', 0.4), { ox: 19.2, oy: -7.6, a: 0.25, v0: 0, v1: 0.5 }, { ao: 0.2, bevel: false })); }
    // log seat, barrel, crate, bedroll
    parts.push({ z0: 0, z1: 2.4, side: w.d, top: w.s, ao: 0.4, shape: (c, zt) => lyingCyl(c, -3, 9.5, 8, 1.2, 0.12, zt * 2.4), detail: (c) => S.lines(c, 'rgba(40,26,14,0.5)', 0.3, [-6.8, 9.3, 1, 9.6, -5, 9.1, -1, 9.5]) });
    parts.push(cyl(-20, 5, 2, 0, 4.4, mx(p.w, '#b08250', 0.5), mx(p.w, '#d8a870', 0.5), { ao: 0.35, detail: (c) => { c.save(); c.strokeStyle = 'rgba(40,26,14,0.5)'; c.lineWidth = 0.3; c.beginPath(); c.arc(-20, 5, 1.6, 0, TAU); c.stroke(); c.restore(); } }));
    parts.push(box(21, 3, 3.6, 3.2, 0, 3, w.d, w.s, { ao: 0.3, detail: (c) => S.lines(c, 'rgba(40,26,14,0.5)', 0.35, [19.4, 3, 22.6, 3, 21, 1.6, 21, 4.4]) }));
    parts.push({ z0: 0, z1: 2.2, side: mx(p.k, '#5a4a60', 0.5), top: mx(p.k, '#9a8aa0', 0.6), ao: 0.4, shape: (c, zt) => lyingCyl(c, -13, 5.5, 6, 1.1, 0.15, zt * 2.2) });
    parts.push(layer((pe) => {
      // door flap on the tent's east end, a patch on the canvas, ties; rust and a boss on the shield
      const ex = TX + TL + 0.02;
      pe.poly('#2a2018', [ex, TY - 1.9, 0, ex, TY + 1.9, 0, ex, TY, TH - 1.2]);
      pe.poly(sh(CVS, -0.12), [ex + 0.01, TY + 1.9, 0, ex + 0.01, TY + 3.2, 0, ex + 0.01, TY + 0.6, TH - 1.6]);
      pe.poly(sh(CV, -0.25), [TX - 3, TY + 4.6, 1.8, TX - 0.6, TY + 4.2, 2.3, TX - 0.9, TY + 2.4, 4.4, TX - 3.1, TY + 2.8, 3.9]);
      pe.lines('rgba(60,50,30,0.5)', 0.3, [TX - 3, TY + 4.6, 1.8, TX - 0.6, TY + 4.2, 2.3, TX - 0.9, TY + 2.4, 4.4, TX - 3.1, TY + 2.8, 3.9]);
      pe.dot('#d8c890', 19.2 + 0.4, -7.6 + 0.45, 2.6, 0.5); pe.lines('rgba(40,30,20,0.6)', 0.3, [17.6, -7.3, 2.6, 20.6, -7.9, 2.6]);
      // trodden path, a dropped bowl and a boot
      pe.ell('#6a5a40', 4, 12, 0, 1.1, 0.7); pe.ell('#8a7a60', 4, 12, 0.2, 0.7, 0.4);
      pe.poly('#4a3a2a', [-7, 1, 0, -4.6, 0.4, 0, -4.4, 1.6, 0, -5.4, 2.2, 0, -5.4, 2.2, 1.8, -6.6, 2.4, 1.8]);
    }));
    return { r: 30, h: 11.5, parts, style: 'prop', bevel: 0.6, spots: { fire: [0, 2, 1] } };
  };

  /* ========================================================= lm_old_foundation
   * Ancient foundations baked into the ground (decor): low broken courses outlining two
   * rooms, flagstones with grass pushing through, a hearth, a column base. r 34, h 4. */
  M.lm_old_foundation = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p);
    const wS = mx(st.s, '#746e62', 0.4), wT = mx(st.t, '#c0b8a6', 0.4);
    const parts = [stain(34, 24, 0.18, '#2a2416', 0, 1)];
    parts.push({ z0: 0, z1: 0.6, side: sh(wS, -0.1), top: mx(wS, wT, 0.55), ao: 0.15, bevel: false, shape: (c) => S.poly(c, jag(14, 1, 5, 0.05, 0, 0, 0, 27, 17.5)),
      detail: (c) => {
        const r = rng(6, 1), s = [];
        for (let y = -17; y < 17; y += 4.4) { s.push(-27, y, 27, y); for (let x = -27 + r.range(0, 4); x < 27; x += r.range(3.6, 6.4)) s.push(x, y, x + r.range(-0.3, 0.3), y + 4.4); }
        S.lines(c, 'rgba(50,44,34,0.4)', 0.3, s);
        for (const q of [[-18, 6, 4.6, 4.4], [8, -12, 5, 4.4], [16, 8, 4.2, 4.4], [-6, -2, 4.4, 4.4], [22, -4, 4, 4.4], [-24, -14, 4, 4.4]]) { S.fillPoly(c, '#5a4a32', [q[0], q[1], q[0] + q[2], q[1], q[0] + q[2], q[1] + q[3], q[0], q[1] + q[3]]); S.fillPoly(c, 'rgba(84,112,44,0.9)', jag(7, q[2] * 0.48, q[0] | 0, 0.4, 0, q[0] + q[2] / 2, q[1] + q[3] / 2, 1, 0.8)); }
        for (let i = 0; i < 40; i++) S.dot(c, i % 3 ? 'rgba(84,112,44,0.75)' : 'rgba(130,160,70,0.75)', r.range(-26, 26), r.range(-16, 16), r.range(0.4, 1.1));
        for (let i = 0; i < 20; i++) S.dot(c, 'rgba(255,250,235,0.15)', r.range(-26, 26), r.range(-16, 16), r.range(1, 2.2));
        // the hearth: a blackened square of flags
        S.fillPoly(c, 'rgba(20,16,12,0.7)', [9, -16, 17, -16, 17, -10, 9, -10]); S.dot(c, 'rgba(60,54,50,0.6)', 13, -13, 2);
      } });
    const segs = wallRun([[-28, -18], [28, -18], [28, 18], [-28, 18], [-28, -18]], 9, { H: 3.4, gap: 0.22, low: 0.55, seg: 5.5, noCren: true })
      .concat(wallRun([[-4, -18], [-4, 18]], 10, { H: 3, gap: 0.3, low: 0.5, seg: 5, noCren: true }), wallRun([[-4, 2], [28, 2]], 11, { H: 2.6, gap: 0.3, low: 0.5, seg: 5, noCren: true }));
    for (const q of segs) { q.cren = false; if (q.h > 3.4) q.h = 3.4; }
    parts.push(wallPart(segs, 2.6, wS, wT, { brk: 1.5, extra: { ao: 0.4, detail: (c) => { const r = rng(8, 2); for (const q of segs) { if (q.h < 1.2) continue; const xm = (q.x0 + q.x1) / 2, ym = (q.y0 + q.y1) / 2; S.lines(c, 'rgba(40,36,30,0.4)', 0.3, [q.x0 + (q.x1 - q.x0) * 0.4, q.y0 + (q.y1 - q.y0) * 0.4 - 1.2, q.x0 + (q.x1 - q.x0) * 0.42, q.y0 + (q.y1 - q.y0) * 0.42 + 1.2]); if (r.next() < 0.6) S.dot(c, 'rgba(90,120,50,0.7)', xm + r.range(-1.5, 1.5), ym + r.range(-0.8, 0.8), r.range(0.5, 1)); } } } }));
    parts.push(cyl(-16, -8, 2.2, 0.6, 2.2, wS, wT, { ao: 0.3, detail: (c) => { S.lines(c, 'rgba(40,36,30,0.4)', 0.3, [-17.5, -9, -14.8, -7.2]); S.dot(c, 'rgba(90,120,50,0.7)', -17, -7, 0.7); } }));
    parts.push(rockPart([{ x: 10, y: 10, r: 2.4, h: 1.7, seed: 71, n: 5, rough: 0.14, top: 0.74, pw: 5 }, { x: -22, y: 12, r: 2, h: 1.4, seed: 72, n: 5, rough: 0.14, top: 0.74, pw: 5 }], wS, wT, { ao: 0.4 }));
    parts.push({ z0: 0.6, z1: 1.1, side: sh(wS, -0.1), top: mx(wS, wT, 0.7), ao: 0.2, bevel: false, shape: (c) => c.rect(-2.2, 16.4, 5, 2.6) });
    parts.push(layer((pe) => { const r = rng(12, 3); tufts(pe, r, 50, -34, 34, -24, 24, undefined, (x, y) => Math.abs(x) < 26 && Math.abs(y) < 16.5); for (const q of segs) if (q.h > 2 && r.next() < 0.5) clump(pe, (q.x0 + q.x1) / 2 + r.range(-1.5, 1.5), (q.y0 + q.y1) / 2 + 1.3, q.h, 1.1, r); }));
    return { r: 34, h: 4.4, parts, style: 'decor', bevel: 0.5 };
  };

  /* ======================================================= lm_broken_statue
   * The toppled colossus: his crowned head lies on its side, a third sunk in the turf,
   * stone face turned to the camera; a giant hand and a broken sword nearby. r 30, h 18. */
  M.lm_broken_statue = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p);
    const fS = mx(p.s, '#a8a69e', 0.55), fT = mx(p.b, '#dcdad0', 0.55), fD = sh(fS, -0.25);
    // head ellipsoid: crown end at -x, chin at +x, face to +y; centre ZC below the top
    const HX = -4, HY = -3, A = 13.5, B = 9.4, RZ = 10, ZC = 6.6;
    const kz = (z) => Math.sqrt(Math.max(0, 1 - Math.pow((z - ZC) / RZ, 2)));
    const kx = (x) => Math.sqrt(Math.max(0, 1 - Math.pow((x - HX) / A, 2)));
    const wAt = (x, z) => B * Math.sqrt(Math.max(0, 1 - Math.pow((x - HX) / A, 2) - Math.pow((z - ZC) / RZ, 2)));
    const yF = (x, z) => HY + wAt(x, z);
    // the face looks up and toward the camera: a point on the surface at x, at angle th
    // round the head's long axis (0 = toward the camera, PI/2 = straight up)
    const srf = (x, th) => { const k = kx(x); return [x, HY + B * k * Math.cos(th) + 0.03, ZC + RZ * k * Math.sin(th)]; };
    const FA = 0.8;
    const parts = [stain(30, 20, 0.3, '#2a2416', 0, 2)];
    parts.push(layer((pe) => { const r = rng(5, 1); tufts(pe, r, 60, -30, 30, -20, 20, undefined, (x, y) => Math.hypot((x - HX) / (A + 1), (y - HY) / (B + 1)) < 1 || Math.hypot((x - 19) / 9, (y - 8) / 6) < 1); }));
    parts.push({ z0: 0, z1: ZC + RZ, side: fS, top: fT, ao: 0.4, shape: (c, zt) => { const z = zt * (ZC + RZ), k = Math.max(0.04, kz(z)); S.ell(c, HX, HY, A * k, B * k, 0); } });
    // the brow ridge and the nose stand proud of the face; the crown band wraps the head
    { const xb = HX - 3.4, z0 = srf(xb, FA - 0.55)[2], z1 = srf(xb, FA + 0.45)[2];
      parts.push({ z0, z1, side: fS, top: fT, ao: 0.2, bevel: false, shape: (c, zt) => { const z = lerp(z0, z1, zt); S.ell(c, xb, yF(xb, z) - 0.9, 1.7, 1.6, 0); } }); }
    { const xn = HX + 1.8, zn = srf(xn, FA)[2], z0 = zn - 1.8, z1 = zn + 2.6;
      parts.push({ z0, z1, side: fS, top: fT, ao: 0.2, bevel: false, shape: (c, zt) => { const z = lerp(z0, z1, zt), k = 1 - Math.abs(zt - 0.5) * 0.4; S.ell(c, xn, yF(xn, z) - 0.5, 3.3 * k, 1.7 * k, 0); } }); }
    const XB = HX - 8.6, kxb = kx(XB), zTop = ZC + RZ * kxb, bS = mx(fS, '#6a665e', 0.55), bT = mx(fT, '#8a867e', 0.45);
    parts.push({ z0: 0, z1: zTop + 0.8, side: bS, top: bT, ao: 0.3, bevel: false, shape: (c, zt) => { const z = zt * (zTop + 0.8), w = (z < zTop ? wAt(XB, z) : 0) + 0.8; c.rect(XB - 1.3, HY - w, 2.6, 2 * w); } });
    parts.push({ z0: 2, z1: zTop + 3.4, side: bS, top: bT, ao: 0.25, bevel: false, shape: (c, zt) => {
      const z = 2 + zt * (zTop + 1.4);
      for (const th of [0.15, 0.7, 1.25, 1.8, 2.35]) { const y = HY + Math.cos(th) * (B * kxb + 0.6), zp = ZC + Math.sin(th) * (RZ * kxb + 0.6); if (z < zp - 0.4 || z > zp + 2.4) continue; const k = 1 - Math.max(0, (z - zp) / 2.4) * 0.7; S.poly(c, [XB - 1.3 * k, y - 1.2 * k + Math.cos(th) * 1.2, XB + 1.3 * k, y - 1.2 * k + Math.cos(th) * 1.2, XB + 1.3 * k, y + 1.2 * k + Math.cos(th) * 1.2, XB - 1.3 * k, y + 1.2 * k + Math.cos(th) * 1.2]); }
    } });
    // the hand, palm down, fingers curled into the grass; the sword and plinth rubble
    const PX = 19, PY = 8;
    parts.push({ z0: 0, z1: 3.6, side: fS, top: fT, ao: 0.4, shape: (c, zt) => { const k = 1 - zt * zt * 0.35; S.poly(c, tf([-4.2 * k, -3.6 * k, 3.8 * k, -3.2 * k, 4.4 * k, 2.8 * k, -3.6 * k, 3.4 * k], PX, PY, 0.2)); } });
    parts.push(beams([[PX + 3.6, PY - 2.6, 1.9, PX + 9.4, PY - 3.2, 1.3], [PX + 4, PY - 0.4, 2.1, PX + 10.4, PY - 0.2, 1.4], [PX + 3.8, PY + 1.8, 2, PX + 9.6, PY + 2.6, 1.3], [PX + 3, PY + 3.4, 1.7, PX + 7.4, PY + 5.4, 1.1], [PX - 3.4, PY - 3, 1.6, PX - 6.4, PY - 6.4, 1.0]], 2.5, fS, fT, { ao: 0.35 }));
    parts.push({ z0: 0, z1: 2.6, side: fS, top: fT, ao: 0.3, bevel: false, shape: (c, zt) => { const k = Math.sqrt(Math.max(0.1, 1 - zt * zt)); for (const q of [[9.4, -3.2], [10.4, -0.2], [9.6, 2.6], [7.4, 5.4]]) S.circ(c, PX + q[0], PY + q[1], 1.25 * k); } });
    parts.push(plank(-9, 15, 13, 2.8, 0.3, 0, 0.9, mx(fD, '#8a9098', 0.4), mx(fT, '#e8ecf0', 0.5)));
    parts.push({ z0: 0, z1: 1.4, side: fD, top: fS, ao: 0.2, bevel: false, shape: (c) => S.poly(c, tf([-3, -0.7, 3, -0.7, 3, 0.7, -3, 0.7], -15.4, 13, 0.3 + Math.PI / 2)) });
    const blocks = [{ x: 14, y: -12, r: 3.2, h: 2.8, seed: 51, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.6 }, { x: -22, y: 9, r: 2.6, h: 2.2, seed: 52, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.4 }];
    parts.push(rockPart(blocks, st.s, st.t, { ao: 0.4 }));
    parts.push(layer((pe) => {
      const r = rng(7, 3), c = pe.c;
      // the face on the camera side: hollow eyes above and below the nose line, the mouth, the beard to the chin
      for (const sg of [-1, 1]) {
        const q = srf(HX - 1.2, FA + sg * 0.4), x = q[0], y = q[1], z = q[2];
        c.beginPath(); c.ellipse(x, y - z, 2.3, 1.5, 0, 0, TAU); c.fillStyle = '#26221e'; c.fill();
        c.beginPath(); c.ellipse(x - 0.2, y - z + 0.25, 1.5, 0.85, 0, 0, TAU); c.fillStyle = '#4a4440'; c.fill();
        pe.dot('#15120f', x + 0.1, y, z - 0.15, 0.62);
        pe.lines('rgba(255,250,240,0.45)', 0.4, [x - 2.2, y, z - 1.7, x + 2.2, y, z - 1.7]);
        pe.lines('rgba(40,36,30,0.45)', 0.4, [x - 2.4, y, z + 1.7, x + 2.4, y, z + 1.6]);
      }
      { const a = srf(HX + 6.2, FA - 0.3), m = srf(HX + 6.6, FA), b = srf(HX + 6.2, FA + 0.3); pe.lines('rgba(40,36,30,0.8)', 0.6, [a[0], a[1], a[2], m[0], m[1], m[2], m[0], m[1], m[2], b[0], b[1], b[2]]); pe.lines('rgba(255,250,240,0.35)', 0.32, [a[0] + 0.7, a[1], a[2], m[0] + 0.8, m[1], m[2], m[0] + 0.8, m[1], m[2], b[0] + 0.7, b[1], b[2]]); }
      for (let i = 0; i < 9; i++) { const th = FA - 0.5 + i * 0.125, x0 = HX + 7.8 + Math.abs(i - 4) * 0.15, x1 = HX + 12.6 - Math.abs(i - 4) * 0.9, a = srf(x0, th), b = srf(x1, th + r.range(-0.04, 0.04)); pe.lines(i % 2 ? 'rgba(40,36,30,0.55)' : 'rgba(255,250,240,0.35)', 0.45, [a[0], a[1], a[2], b[0], b[1], b[2]]); }
      // nostrils, the shadow under the brow, hair strokes behind the crown, a crack through the cheek
      for (const d of [-0.1, 0.12]) { const q = srf(HX + 4.6, FA + d); pe.dot('rgba(40,36,30,0.65)', q[0], q[1], q[2], 0.5); }
      { const a = srf(HX - 2.4, FA - 0.5), b = srf(HX - 2.4, FA + 0.5); pe.lines('rgba(40,36,30,0.45)', 0.45, [a[0], a[1], a[2], b[0], b[1], b[2]]); }
      for (let i = 0; i < 8; i++) { const th = FA - 0.7 + i * 0.22, x0 = XB - 1.8, x1 = HX - A + 1.6 + Math.abs(i - 3.5) * 0.9, a = srf(x0, th), b = srf(x1, th + 0.03); pe.lines(i % 2 ? 'rgba(40,36,30,0.5)' : 'rgba(255,250,240,0.3)', 0.45, [a[0], a[1], a[2], b[0], b[1], b[2]]); }
      { const a = srf(HX + 2.6, FA + 0.75), b = srf(HX + 3.8, FA + 0.5), d = srf(HX + 5.4, FA + 0.36); pe.lines('rgba(40,36,30,0.6)', 0.45, [a[0], a[1], a[2], b[0], b[1], b[2], b[0], b[1], b[2], d[0], d[1], d[2]]); }
      // lichen on the sunlit crown of the head, moss where it meets the turf, grass against it
      for (const q of [[HX - 5, HY - 3, 15, 1.6], [HX + 4, HY - 5, 13.6, 1.4], [HX - 6, HY - 7, 10, 1.2], [PX - 1, PY - 2, 3.5, 1.3]]) for (let i = 0; i < 6; i++) pe.dot(LICHEN[i % 4], q[0] + r.range(-q[3], q[3]), q[1] + r.range(-q[3], q[3]) * 0.6, q[2] + r.range(-0.4, 0.4), r.range(0.3, 0.55));
      for (const q of [[HX - 12, HY + 6], [HX + 10.5, HY + 5.8], [HX - 2, HY + 9.4], [HX + 6, HY + 9], [PX - 4, PY + 4], [PX + 6, PY - 5.5], [-8, 16.4], [14, -9.5]]) clump(pe, q[0], q[1], 0.5, 1.3, r);
      for (let i = 0; i < 12; i++) { const a = r.range(0.2, 2.9), x = HX + Math.cos(a) * (A + 0.6), y = HY + Math.sin(a) * (B + 0.6); pe.lines(i % 2 ? '#536e2a' : '#8aa848', 0.25, [x, y, 0, x + r.range(-0.5, 0.5), y, r.range(1.6, 3)]); }
      pe.lines('rgba(40,36,30,0.4)', 0.35, [PX + 6.4, PY - 2.9, 2.2, PX + 6.4, PY - 2.9, 0.9, PX + 7, PY - 0.3, 2.3, PX + 7, PY - 0.3, 1, PX + 6.6, PY + 2.2, 2.2, PX + 6.6, PY + 2.2, 0.9]);
      pe.lines('rgba(255,255,255,0.5)', 0.3, [-15, 13.2, 1, -3.4, 16.8, 1]);
      paintMoss(pe, blocks, 9, { cracks: false });
    }));
    return { r: 30, h: 19, parts, style: 'prop', bevel: 0.7 };
  };

  /* =========================================================== lm_burned_farm
   * Burnt-out farmhouse: low plaster walls with sooted tops and charred timbers showing,
   * black posts and the west gable frame still standing, the roof fallen in as broken
   * rafters, the stone chimney stack untouched, ash and a few embers. r 26, h 16. */
  M.lm_burned_farm = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), st = stoneOf(p);
    const X0 = -17, X1 = 13, Y0 = -6, Y1 = 10;
    const PL = '#a89c86', PLT = '#4e4844';
    const parts = [stain(30, 20, 0.55, '#141210', -2, 2)];
    parts.push({ z0: 0, z1: 0.5, side: '#1c1816', top: '#2e2926', ao: 0.1, bevel: false, shape: (c) => c.rect(X0 + 1, Y0 + 1, X1 - X0 - 2, Y1 - Y0 - 2),
      detail: (c) => { const r = rng(3, 1); for (let i = 0; i < 30; i++) S.dot(c, r.next() < 0.5 ? 'rgba(140,132,124,0.4)' : 'rgba(0,0,0,0.45)', r.range(X0 + 1, X1 - 1), r.range(Y0 + 1, Y1 - 1), r.range(0.6, 1.8)); } });
    const hs = [6.2, 5.4, 7, 4.6, 6.6, 5, 4.8, 2.4, 3.6, 1.6, 0.8, 3.2, 1.2, 0.6, 2.6, 3.8, 5.2, 6.4];
    const segs = wallRun([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, Y0]], 7, { H: 10, hs, seg: 5, noCren: true });
    for (const q of segs) q.cren = false;
    parts.push(wallPart(segs, 2, PL, PLT, { brk: 1.6 }));
    // charred studs at the corners and along the walls, standing above the burnt plaster
    parts.push(beams([[X0 + 0.3, Y0 + 0.3, 0, X0 + 0.6, Y0 + 0.5, 11.5], [X1 - 0.3, Y0 + 0.3, 0, X1 - 0.6, Y0 + 0.5, 10], [X0 + 0.3, Y1 - 0.3, 0, X0 + 0.5, Y1 - 0.5, 8.6], [-2, Y0 + 0.4, 0, -1.6, Y0 + 0.6, 10.5], [X1 - 0.3, Y1 - 0.3, 0, X1 - 0.5, Y1 - 0.5, 4.4], [-7, Y1 - 0.4, 0, -7.2, Y1 - 0.5, 6], [5, Y1 - 0.4, 0, 5.2, Y1 - 0.5, 3.6]], 1.1, CHAR.s, CHAR.l, { ao: 0.3 }));
    // rafters that fell inward, the west gable frame (tie beam, two rafters, king post)
    parts.push(beams([[-9, 2, 0.8, -8, Y0 + 0.5, 8.6], [3, 5, 0.8, 4.5, Y0 + 0.6, 8.4], [9, Y1 - 2, 0.6, 8, -1, 6], [-14, 4, 1, -5, -3, 2.2], [0, 7, 0.6, 7, 4, 0.9], [-12, Y1 - 1, 0.6, -13, 0, 5.4]], 0.9, CHAR.s, CHAR.l, { ao: 0.3 }));
    parts.push(xzPart([barUZ(Y0 + 0.3, 8.4, Y1 - 0.3, 8.4, 1), barUZ(Y0 + 0.4, 8.2, 2.2, 15, 1), barUZ(Y1 - 0.4, 8.2, 2.2, 15, 1), barUZ(2.2, 8.2, 2.2, 14.8, 0.9)], 7.8, 15.4, CHAR.s, CHAR.l, { ox: X0 + 0.4, a: Math.PI / 2, v0: -0.5, v1: 0.5 }, { ao: 0.25, bevel: false }));
    // chimney stack: intact, sooted at the top
    parts.push(box(9, -2, 4.4, 4.4, 0, 14, st.s, st.t, { ao: 0.32 }));
    parts.push(box(9, -2, 5.2, 5.2, 14, 16, sh(st.s, -0.1), '#2a2622', { ao: 0.2, detail: (c) => { c.save(); c.fillStyle = '#0e0c0a'; c.beginPath(); c.rect(7.6, -3.4, 2.8, 2.8); c.fill(); c.restore(); } }));
    // debris: a charred barrel, an iron cauldron, planks, a wheel rim, embers in the ash
    parts.push({ z0: 0, z1: 3.2, side: '#1e1a18', top: '#3a3430', ao: 0.35, shape: (c, zt) => lyingCyl(c, -4, 13.5, 4.6, 1.6, 0.4, zt * 3.2) });
    parts.push(cyl(4, 1, 1.6, 0.5, 2.6, '#2a2c2e', '#4a4c50', { ao: 0.3, detail: (c) => S.dot(c, '#151413', 4, 1, 1.1) }));
    parts.push(plank(-12, 12.8, 7, 1.3, -0.25, 0, 0.7, CHAR.s, CHAR.t));
    parts.push(plank(16.5, 6, 6, 1.2, 1.1, 0, 0.7, CHAR.s, CHAR.t));
    parts.push({ z0: 0, z1: 0.7, side: CHAR.s, top: CHAR.l, stroke: 0.7, ao: 0.1, bevel: false, shape: (c) => { c.moveTo(18 + 3, 1); c.arc(18, 1, 3, 0.4, 4.6); } });
    parts.push({ z0: 0.5, z1: 0.7, side: '#ff7a30', top: '#ffb060', flat: true, bevel: false, shape: (c) => { for (const q of [[-7, 3], [-1, -3.5], [5, 7], [-11, -1]]) S.circ(c, q[0], q[1], 0.45); } });
    parts.push(layer((pe) => {
      const r = rng(5, 2);
      // front faces: soot licking up from the floor and down from the burnt top, timber framing, cracks
      for (const q of segs) {
        if (Math.abs(q.y1 - q.y0) > 0.5 || q.y0 < 0 || q.h < 1.2) continue;
        const x0 = Math.min(q.x0, q.x1) - 0.1, x1 = Math.max(q.x0, q.x1) + 0.1, y = Y1 + 1.02, top = q.h - 1.6;
        if (top < 0.6) continue;
        const g = pe.c.createLinearGradient(0, y - top, 0, y - top + 2.6); g.addColorStop(0, 'rgba(20,16,14,0.8)'); g.addColorStop(1, 'rgba(20,16,14,0)');
        pe.poly(g, [x0, y, top - 2.6, x1, y, top - 2.6, x1, y, top + 0.2, x0, y, top + 0.2]);
        pe.poly('rgba(20,16,14,0.45)', [x0, y, 0, x1, y, 0, x1, y, 1.2, x0, y, 1.2]);
        pe.lines('rgba(28,22,18,0.85)', 0.55, [x0 + 1.6, y, 0.2, x0 + 1.6, y, top, x0 + 1.6, y, top * 0.55, x1 - 0.6, y, top * 0.2]);
        pe.lines('rgba(28,22,18,0.4)', 0.3, [x0 + 3, y, 0.6, x0 + 3.6, y, top * 0.7]);
      }
      // inner face of the back wall seen over the low front: scorched plaster and the hearth arch
      pe.poly('#7a6e62', [X0 + 0.6, Y0 + 1.02, 0.4, X1 - 1, Y0 + 1.02, 0.4, X1 - 1, Y0 + 1.02, 4.4, X0 + 0.6, Y0 + 1.02, 5.2]);
      pe.poly('rgba(10,8,6,0.7)', [X0 + 0.6, Y0 + 1.03, 2.6, X1 - 1, Y0 + 1.03, 2.2, X1 - 1, Y0 + 1.03, 6.6, X0 + 0.6, Y0 + 1.03, 7]);
      archRect(pe, '#0e0c0a', 7, 11, Y0 + 1.04, 0.4, 4.2, true);
      pe.poly('rgba(10,8,6,0.5)', [7.6, 0.22, 2, 10.4, 0.22, 2, 10.6, 0.22, 11, 7.4, 0.22, 10]);
      stones(pe, 6.8, 11.2, 0.21, 0.3, 13.6, 4, { row: 1.6, w: 1.2, joint: 'rgba(40,34,28,0.3)' });
      for (let i = 0; i < 14; i++) pe.dot('rgba(150,142,132,0.35)', r.range(X0, X1), r.range(Y0, Y1 + 4), 0.1, r.range(0.8, 2));
      for (const q of [[-7, 3], [-1, -3.5], [5, 7], [-11, -1]]) pe.glow('#ff7a30', q[0], q[1], 0.6, 2.6, 0.4);
    }));
    return { r: 26, h: 16.5, parts, style: 'prop', bevel: 0.7, spots: { chimney: [9, -2, 16] } };
  };

  /* ================================================================ SYLVARA */
  const ivoryOf = (p) => ({ s: mx(p.b, '#cfc6b0', 0.5), t: mx(p.b, '#f4eee0', 0.6), d: mx(p.a, '#8a8878', 0.4) });
  const lum = (c) => { const v = C.hex(c); return (v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11) / 255; };
  // n tier colours from the dark underside to the sunlit top (see models_nature.js)
  function ramp(a, b, n) {
    if (lum(b) - lum(a) < 0.2) b = mx(b, '#e8f0c8', clamp((0.2 - (lum(b) - lum(a))) * 1.6, 0, 0.5));
    const out = [];
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 1 : k / (n - 1);
      out.push({ s: mx(mx(a, b, 0.04), mx(a, b, 0.56), u), t: mx(mx(a, b, 0.34), mx(b, '#f4f0b0', 0.12), u), hi: mx(mx(a, b, 0.62), mx(b, '#fbf6c0', 0.45), u), lo: sh(a, -0.5) });
    }
    return out;
  }
  /* a small living tree (for ruins): blob trunk + a two-tier crown */
  function smallTree(x, y, H, CR, seed, bark, fol) {
    const col = ramp(fol[0], fol[1], 3);
    const zc = H - CR * 0.9;
    const parts = [{ z0: 0, z1: zc + 3, side: bark.s, top: bark.t, ao: 0.45, shape: (c, zt) => S.blob(c, x + zt * 0.6, y, 1.6 * (1 - zt * 0.35) + 1.2 * Math.max(0, 1 - zt * 6), seed, 8, 0.2) }];
    parts.push(...crown({ x: x + 0.6, y, zc, CR, D: CR * 0.9, seed, col, tiers: [{ n: 6, d: 0.6, r: 0.42, c: 0.55, off: -0.04, z0: 0, z1: 0.55, b0: 0.7, e: 0.74 }, { n: 4, d: 0.36, r: 0.36, c: 0.4, off: 0.1, z0: 0.3, z1: 0.82, b0: 0.76, e: 0.68 }, { n: 2, d: 0.14, r: 0.28, c: 0, off: 0.2, z0: 0.6, z1: 1, b0: 0.8, e: 0.6, fleck: true }] }));
    return parts;
  }
  /* glowing flowers on the ground (1-dir): a halo, petals and a bright heart */
  function glowFlowers(pe, r, list, col) {
    for (const q of list) {
      pe.glow(col, q[0], q[1], 0.4, 2.6 * (q[2] || 1), 0.35);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; pe.ell(al(mx(col, '#ffffff', 0.5), 0.9), q[0] + Math.cos(a) * 0.5 * (q[2] || 1), q[1] + Math.sin(a) * 0.4 * (q[2] || 1), 0.8, 0.38 * (q[2] || 1), 0.26 * (q[2] || 1), a); }
      pe.dot('#ffffff', q[0], q[1], 0.9, 0.22 * (q[2] || 1));
      pe.lines('rgba(40,70,40,0.8)', 0.25, [q[0], q[1], 0, q[0] + r.range(-0.3, 0.3), q[1], 0.8]);
    }
  }

  /* ============================================================ lm_great_tree
   * The forest's heart: an enormous ancient tree, r 60, h 110. Massive buttressed trunk
   * with a hollow at its foot, twisted roots spreading wide, five great limbs and a
   * many-lobed luminous canopy hung with seed-lanterns. Glow in pal.g. */
  M.lm_great_tree = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), seed = opt.seed | 0, rg = rng(seed, 51);
    const G = p.g || '#7affd8', G2 = '#fff0a8';
    const bk = { s: '#7e8890', t: '#e2e8ea', g: '#3e464c', h: '#b4bcc2' };
    const CR = 46, D = 46, H = 108, zc = H - D, tr = 11;
    const fol = ['#0f4a40', '#b8f4cc'];
    const col = ramp(fol[0], fol[1], ELDER.length).map((t, i) => ({ s: mx(t.s, G, 0.06 + i * 0.03), t: mx(t.t, G, 0.1 + i * 0.05), hi: mx(t.hi, '#fffbe0', 0.3), lo: mx(t.lo, '#0c3a40', 0.4) }));
    const parts = [contact(40, 26, 4, 3, 0.34), pool(30, 20, 0, 2, G, 0.22)];
    parts.push(layer((pe) => { const r = rng(seed, 52); glowFlowers(pe, r, [[-30, 14], [26, 18], [-14, 24], [34, -2], [-36, -6], [12, 27], [-22, -16, 0.8], [30, 10, 0.8]], G); for (let i = 0; i < 20; i++) { const a = r.range(0, TAU), d = r.range(14, 40); pe.dot(al(i % 3 ? G : G2, 0.5), Math.cos(a) * d, Math.sin(a) * d * 0.7, 0.4, r.range(0.25, 0.5)); } }));
    // roots: thick near the trunk, thinning out across the ground
    const rl = [], nr = 9, ra = rg.range(0, TAU);
    for (let i = 0; i < nr; i++) {
      const a = ra + (i / nr) * TAU + rg.range(-0.2, 0.2), L = rg.range(26, 40), b = rg.range(-0.35, 0.35);
      rl.push([[Math.cos(a + b) * L, Math.sin(a + b) * L * 0.75, 0.3], [Math.cos(a + b * 0.4) * L * 0.6, Math.sin(a + b * 0.4) * L * 0.72 * 0.6, 1.4], [Math.cos(a) * tr * 1.2, Math.sin(a) * tr * 1.05, 3.6]]);
    }
    parts.push(limbPart(rl.map((L) => [L[0], L[1]]), 1.7, bk.s, bk.t, { ao: 0.35 }));
    parts.push(limbPart(rl.map((L) => [L[1], L[2]]), 3.2, bk.s, bk.t, { ao: 0.4 }));
    // buttress fins sweeping down from the trunk
    const nF = 6, fins = [];
    for (let i = 0; i < nF; i++) fins.push({ a: (i / nF) * TAU + 0.3 + rg.range(-0.25, 0.25), L: tr * rg.range(1.9, 2.4) });
    const finH = 20;
    parts.push({ z0: 0, z1: finH, side: bk.s, top: bk.t, ao: 0.42, shape: (c, zt) => {
      const k = Math.pow(1 - zt, 1.3);
      for (const f of fins) { const L = tr + (f.L - tr) * k; taper(c, Math.cos(f.a) * tr * 0.4, Math.sin(f.a) * tr * 0.32, Math.cos(f.a) * L, Math.sin(f.a) * L * 0.82, tr * 0.5 * (1 - zt * 0.25), tr * (0.28 + 0.12 * (1 - zt))); }
      S.circ(c, 0, 0, tr * 0.9);
    } });
    parts.push({ z0: 0.4, z1: finH * 0.8, side: bk.g, top: bk.g, stroke: 0.5, ao: 0, bevel: false,
      shape: (c, zt) => { const k = Math.pow(1 - zt / 0.8, 1.3); for (const f of fins) { if (Math.sin(f.a) < 0.2) continue; const L = tr * 0.95 + (f.L - tr) * k * 0.6; const x = Math.cos(f.a + 0.2) * L, y = Math.sin(f.a + 0.2) * L * 0.82; c.moveTo(x, y); c.lineTo(x + 0.01, y); } } });
    // trunk: tapering blob with deep bark grooves and sap-light in the grooves
    const lean = [1.5, -1];
    const off = (z) => { const u = clamp(z / zc, 0, 1); return [lean[0] * u * u, lean[1] * u * u]; };
    const rad = (z) => tr * (1 - 0.36 * clamp(z / (zc + 6), 0, 1)) + tr * 0.3 * Math.pow(Math.max(0, 1 - z / 20), 2);
    parts.push({ z0: 0, z1: zc + 8, side: bk.s, top: bk.t, ao: 0.5, shape: (c, zt) => { const z = zt * (zc + 8), o = off(z); S.blob(c, o[0], o[1], rad(z), seed + 3, 10, 0.14); } });
    parts.push({ z0: 1, z1: zc + 4, side: bk.g, top: bk.g, stroke: 0.55, ao: 0.1, bevel: false,
      shape: (c, zt) => { const z = 1 + zt * (zc + 3), o = off(z), rr = rad(z) * 0.93; for (let i = 0; i < 7; i++) { const a = 0.3 + (i * 2.2) / 6 + Math.sin(z * 0.4 + i * 2.1) * 0.14; c.moveTo(o[0] + Math.cos(a) * rr, o[1] + Math.sin(a) * rr); c.lineTo(o[0] + Math.cos(a) * rr + 0.01, o[1] + Math.sin(a) * rr); } } });
    parts.push({ z0: finH, z1: zc - 2, side: G, top: G, stroke: 0.36, ao: 0, bevel: false, flat: true,
      shape: (c, u) => { const z = lerp(finH, zc - 2, u), o = off(z), rr = rad(z) * 0.94; for (let i = 0; i < 3; i++) { const a = 0.8 + i * 1.05 + Math.sin(z * 0.14 + i * 2) * 0.3; if (Math.sin(z * 0.4 + i * 1.7) < -0.1) continue; c.moveTo(o[0] + Math.cos(a) * rr, o[1] + Math.sin(a) * rr); c.lineTo(o[0] + Math.cos(a) * rr + 0.01, o[1] + Math.sin(a) * rr); } } });
    // the great limbs into the crown
    const lines = [], nl = 5, la = rg.range(0, TAU);
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + rg.range(-0.25, 0.25), d = CR * rg.range(0.42, 0.58), zs = zc - rg.range(6, 10), o = off(zs);
      lines.push([[o[0], o[1], zs], [o[0] + Math.cos(a) * d * 0.45, o[1] + Math.sin(a) * d * 0.36, zc - 1], [lean[0] + Math.cos(a) * d, lean[1] + Math.sin(a) * d * 0.72, zc + 4]]);
    }
    parts.push(limbPart(lines, tr * 0.42, bk.s, bk.t, { ao: 0.3 }));
    // seed-lanterns on silk under the south rim of the crown
    const hang = [];
    for (let i = 0; i < 10; i++) { const a = 0.15 + (i / 9) * 2.8 + rg.range(-0.1, 0.1), d = CR * rg.range(0.6, 0.86); hang.push([lean[0] + Math.cos(a) * d, lean[1] + Math.sin(a) * d * 0.72, zc - rg.range(3, 9)]); }
    parts.push(limbPart(hang.map((h) => [[h[0], h[1], h[2]], [h[0], h[1], zc + 2]]), 0.25, sh(G, -0.35), G, { flat: true }));
    const decorate = (c, clumps, k, ti) => {
      if (ti === 0) return;
      const r2 = rng(seed * 7 + ti, 53);
      for (const q of clumps) {
        if (!r2.chance(0.35)) continue;
        const rr = q.r * k, g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr * 1.1);
        g.addColorStop(0, al(G, 0.32)); g.addColorStop(1, al(G, 0));
        c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, rr * 1.1, 0, TAU); c.fill();
      }
      for (const q of clumps) {
        const nd = ti >= 3 ? 3 : 2;
        for (let j = 0; j < nd; j++) {
          if (!r2.chance(0.7)) continue;
          const rr = q.r * k, a = r2.range(0, TAU), d = rr * r2.range(0.1, 0.8), x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d;
          const gc = r2.chance(0.3) ? G2 : G;
          S.dot(c, al(gc, 0.25), x, y, 1.5); S.dot(c, al(gc, 0.55), x, y, 0.8); S.dot(c, '#ffffff', x, y, 0.34);
        }
      }
    };
    parts.push(...crown({ x: lean[0], y: lean[1], zc, CR, D, seed: seed * 53 + 11, col, tiers: ELDER, decorate, fleck: '#f4fff8', centres: [[0, 0, 0.82], [-CR * 0.5, -CR * 0.12, 0.6], [CR * 0.5, CR * 0.1, 0.58], [CR * 0.08, -CR * 0.48, 0.5], [-CR * 0.12, CR * 0.42, 0.48]] }));
    parts.push({ z0: zc - 9, z1: zc - 2, side: G2, top: '#fffbe8', flat: true, bevel: false,
      shape: (c, zt) => { const z = lerp(zc - 9, zc - 2, zt); for (const h of hang) if (Math.abs(z - h[2]) <= 0.9) S.circ(c, h[0], h[1], 1.05 * Math.sqrt(1 - Math.pow((z - h[2]) / 0.95, 2))); } });
    parts.push(layer((pe) => {
      // the hollow at the foot of the trunk, lit faintly from within, mushrooms at its lip
      const y = rad(3) * 0.98;
      pe.c.beginPath(); pe.c.moveTo(-4.2, y); pe.c.lineTo(-4.4, y - 5); pe.c.quadraticCurveTo(-3.6, y - 10.5, 0.2, y - 11); pe.c.quadraticCurveTo(4, y - 10.4, 4.4, y - 5.4); pe.c.lineTo(4.2, y); pe.c.closePath();
      const g = pe.c.createRadialGradient(0, y - 3, 1, 0, y - 4, 9); g.addColorStop(0, '#07110f'); g.addColorStop(0.5, '#0b1a17'); g.addColorStop(1, '#2a3630'); pe.c.fillStyle = g; pe.c.fill();
      pe.glow(G, 0, y, 2.2, 3.4, 0.4);
      pe.lines(al(bk.h, 0.6), 0.5, [-4.6, y + 0.02, 0.2, -4.8, y + 0.02, 5.2, 4.6, y + 0.02, 0.2, 4.8, y + 0.02, 5.6]);
      for (const q of [[-5.6, 1.2], [5.4, 0.8], [-6.4, 3.6]]) { pe.dot('#cfd6d0', q[0], y + 0.5, q[1], 0.42); pe.dot(G, q[0], y + 0.5, q[1] + 0.9, 0.7); pe.dot(al('#ffffff', 0.7), q[0] - 0.2, y + 0.5, q[1] + 1.1, 0.22); }
      for (const h of hang) pe.glow(G2, h[0], h[1], h[2], 3.2, 0.3);
    }));
    return { r: 60, h: 110, parts, style: 'prop', bevel: 0.5, spots: { hollow: [0, 12, 2], crown: [lean[0], lean[1], H] } };
  };

  /* ========================================================= lm_giant_mushroom
   * Giant forest mushrooms, opt.v 0-2 by size: 0 small violet (r 8, h 16), 1 amber pair
   * (r 14, h 26), 2 towering blue-violet with a ring of children (r 22, h 40). Glowing
   * gills under the cap (flat), pale spots, a soft pool of light. */
  M.lm_giant_mushroom = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), v = (((opt.v | 0) % 3) + 3) % 3, G = p.g || '#7affd8';
    const amber = v === 1;
    const capS = amber ? '#9a5a24' : '#5a4a9a', capT = amber ? '#f0b460' : '#b0a2e8', capL = amber ? '#ffd890' : '#d8ccff';
    const stS = '#b8ae98', stT = '#ebe4d2';
    const list = v === 0 ? [[0, 0, 7, 16, 0]] : v === 1 ? [[-3, 1, 10, 26, 1], [7, 5, 6.5, 16, 2]] : [[0, 0, 19, 40, 3], [-14, 8, 6, 14, 4], [15, 9, 5, 11, 5], [-6, 14, 4, 8, 6]];
    const R = [8, 14, 22][v], H = [16, 26, 40][v];
    const parts = [pool(R * 1.1, R * 0.7, 0, R * 0.1, G, 0.28), contact(R * 0.8, R * 0.5, R * 0.15, R * 0.1, 0.25)];
    list.sort((a, b) => a[1] - b[1]);
    for (const m of list) {
      const [x, y, CR_, h, s] = m, sr = CR_ * 0.3, lx = (s % 2 ? -1 : 1) * CR_ * 0.08, capZ = h - CR_ * 0.55;
      const ctr = (z) => { const u = z / h; return [x + lx * u * u, y]; };
      parts.push({ z0: 0, z1: capZ + 1, side: stS, top: stT, ao: 0.45, shape: (c, zt) => { const z = zt * (capZ + 1), q = ctr(z); S.circ(c, q[0], q[1], sr * (1.3 - zt * 0.35) + sr * 0.5 * Math.max(0, 1 - z / (sr * 1.2))); } });
      // skirt ring on the stem and the glowing gill disc just under the cap
      parts.push({ z0: capZ * 0.55, z1: capZ * 0.55 + sr * 0.5, side: sh(stS, -0.1), top: stT, ao: 0.3, bevel: false, shape: (c, zt) => { const q = ctr(capZ * 0.55); S.circ(c, q[0], q[1] + 0.2, sr * (1.25 - zt * 0.3)); } });
      parts.push({ z0: capZ - 1.3, z1: capZ - 0.2, side: sh(G, -0.15), top: G, flat: true, ao: 0, bevel: false, shape: (c, zt) => { const q = ctr(capZ); S.circ(c, q[0], q[1], CR_ * (0.74 + zt * 0.2)); } });
      // the cap: a wide shallow dome with a rolled lip
      const top = ctr(capZ);
      parts.push({ z0: capZ - 0.4, z1: h, side: capS, top: capT, ao: 0.42,
        shape: (c, zt) => { const k = zt < 0.12 ? lerp(0.86, 1, zt / 0.12) : Math.pow(Math.max(0, 1 - Math.pow((zt - 0.12) / 0.88, 2.2)), 0.5); S.ell(c, top[0], top[1], CR_ * Math.max(0.05, k), CR_ * 0.86 * Math.max(0.05, k), 0); },
        detail: (c) => {
          const r2 = rng(s, 3), rr = CR_ * 0.2;
          S.dot(c, al(capL, 0.75), top[0] - rr * 1.2, top[1] - rr * 1.1, rr * 1.3);
          for (let i = 0; i < 4; i++) { const a = r2.range(0, TAU), d = rr * r2.range(0.2, 1.1); S.dot(c, al('#ffffff', 0.55), top[0] + Math.cos(a) * d, top[1] + Math.sin(a) * d, r2.range(0.3, 0.5) * CR_ * 0.08 + 0.2); }
        } });
    }
    parts.push(layer((pe) => {
      const r = rng(v, 5);
      for (const m of list) {
        const [x, y, CR_, h, s] = m, sr = CR_ * 0.3, capZ = h - CR_ * 0.55;
        // pale spots down the cap's camera side, glow cast on the stem, a rim of light under the cap
        const r2 = rng(s, 4);
        for (let i = 0; i < Math.round(CR_ * 0.8); i++) { const a = r2.range(0.15, 2.95), d = CR_ * r2.range(0.45, 0.95); const dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.86; const zz = capZ + (h - capZ) * Math.sqrt(Math.max(0, 1 - Math.pow(d / CR_, 2))) * 0.95; pe.ell(al(capL, 0.85), x + dx, y + dy, zz, r2.range(0.5, 1) * CR_ * 0.08 + 0.3, r2.range(0.35, 0.7) * CR_ * 0.08 + 0.2); }
        pe.glow(G, x, y + sr * 0.9, capZ - 2.5, sr * 2.2, 0.45);
        pe.c.beginPath(); pe.c.ellipse(x, y - capZ + 1.4, CR_ * 0.96, CR_ * 0.86 * 0.96, 0, 0.1, Math.PI - 0.1); pe.c.strokeStyle = al(mx(G, '#ffffff', 0.4), 0.8); pe.c.lineWidth = 0.7; pe.c.stroke();
        for (let k = 0; k < Math.round(CR_ * 1.1); k++) { const a = 0.15 + (k + 0.5) / Math.round(CR_ * 1.1) * (Math.PI - 0.3); pe.lines(al(G, 0.5), 0.3, [x + Math.cos(a) * CR_ * 0.95, y + Math.sin(a) * CR_ * 0.82, capZ - 0.3, x + Math.cos(a) * CR_ * 0.72, y + Math.sin(a) * CR_ * 0.62, capZ - 1.6]); }
      }
      glowFlowers(pe, r, [[R * 0.7, R * 0.45], [-R * 0.8, R * 0.3], [R * 0.2, R * 0.72]], G);
    }));
    return { r: R + 2, h: H + 1, parts, style: 'prop', bevel: 0.6, spots: { cap: [list[list.length - 1][0], list[list.length - 1][1], H] } };
  };

  /* ============================================================= lm_moss_ruin
   * Moss-grown elven ruin, r 44, h 30: a curved run of slender ivory columns, one tall
   * pointed arch and the stump of another, a cracked leaf-pattern floor, roots of a
   * young tree threading through the stones, moss over everything. */
  M.lm_moss_ruin = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), iv = ivoryOf(p), G = p.g || '#7affd8';
    const parts = [stain(42, 30, 0.3, '#1c2414', 0, 2)];
    parts.push(layer((pe) => { const r = rng(21, 1); tufts(pe, r, 50, -42, 42, -30, 30, ['#3e6a2c', '#7aa84a'], (x, y) => Math.hypot(x / 28, (y + 2) / 18) < 1); }));
    // the floor: a leaf-shaped platform, broken at the east end, with a carved leaf pattern
    const fl = clipHalf(jag(22, 1, 7, 0.06, 0, 0, 0, 30, 18), -0.8, 0.6, -26);
    parts.push({ z0: 0, z1: 1.8, side: iv.d, top: mx(iv.s, iv.t, 0.5), ao: 0.3, shape: (c) => S.poly(c, fl),
      detail: (c) => {
        const r = rng(23, 2);
        c.save(); c.beginPath(); S.poly(c, fl); c.clip();
        c.strokeStyle = 'rgba(70,74,60,0.4)'; c.lineWidth = 0.35;
        for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(-2, 0, 4 + i * 4, 2.6 + i * 2.5, 0, 0, TAU); c.stroke(); }
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(-2, 0); c.lineTo(-2 + Math.cos(a) * 30, Math.sin(a) * 18); c.stroke(); }
        for (const q of [[-14, 6], [8, -9], [16, 8], [-22, -8], [2, 12]]) { S.fillPoly(c, '#3a4a2c', jag(7, 3.4, q[0] | 0, 0.35, 0, q[0], q[1], 1, 0.8)); S.fillPoly(c, 'rgba(90,140,60,0.85)', jag(7, 2.4, q[0] | 0, 0.4, 0.3, q[0] - 0.4, q[1] - 0.3, 1, 0.8)); }
        for (let i = 0; i < 30; i++) S.dot(c, i % 3 ? 'rgba(70,120,50,0.7)' : 'rgba(150,200,90,0.7)', r.range(-28, 26), r.range(-16, 16), r.range(0.4, 1));
        S.lines(c, 'rgba(50,54,40,0.55)', 0.45, [-6, -12, -2, -4, -2, -4, 4, 3, 4, 3, 2, 14]);
        c.restore();
      } });
    // columns on a crescent round the back, fluted, several broken short
    const cols = [];
    for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + i * 0.14); cols.push({ x: Math.cos(a) * 26, y: Math.sin(a) * 15 + 1, h: [22, 24, 9, 23, 14, 6, 21][i], br: [0, 0, 1, 0, -1, 1, 0][i] }); }
    const CR = 1.7;
    parts.push({ z0: 1.8, z1: 3.2, side: iv.d, top: iv.s, ao: 0.3, shape: (c) => { for (const q of cols) S.poly(c, ngon(6, 2.6, 0, q.x, q.y)); } });
    parts.push({ z0: 3.2, z1: 24.2, side: iv.s, top: iv.t, ao: 0.3, shape: (c, zt) => { const z = 3.2 + zt * 21; for (const q of cols) { if (z > q.h) continue; let pts = ngon(12, CR - 0.25 * (z / 24), 0.1, q.x, q.y); if (q.br && z > q.h - 2.6) pts = clipHalf(pts, -q.br * 0.8, 0.6, (z - (q.h - 2.6)) * 1.3 - 1.9 - q.br * q.x * 0.8 + 0.6 * q.y); polyOK(c, pts); } } });
    parts.push({ z0: 23.8, z1: 25.4, side: iv.s, top: iv.t, ao: 0.2, bevel: false, shape: (c, zt) => { for (const q of cols) if (q.h >= 21) S.poly(c, ngon(6, 2 + zt * 1.1, 0, q.x, q.y)); } });
    // a leaf-shaped lintel joining the two tallest columns, the pointed arch, a broken arch stub
    parts.push({ z0: 25.4, z1: 27.6, side: iv.s, top: iv.t, ao: 0.2, shape: (c, zt) => S.poly(c, tf([-8.4, -1.6 + zt * 0.3, 8.4, -1.6 + zt * 0.3, 7.6, 1.5 - zt * 0.3, -7.8, 1.5 - zt * 0.3], (cols[0].x + cols[1].x) / 2, (cols[0].y + cols[1].y) / 2, Math.atan2(cols[1].y - cols[0].y, cols[1].x - cols[0].x))) });
    const AX = 14, AY = 4, AA = -0.35;
    parts.push(xzPart([[-7.6, 0, -4.8, 0, -4.8, 11, -7.6, 11], [4.8, 0, 7.6, 0, 7.6, 11, 4.8, 11], ...pointedArch(0, 11, 4.8, 7.6, 7, 0.5)], 0, 23.6, iv.s, iv.t, { ox: AX, oy: AY, a: AA, v0: -1.8, v1: 1.8 }, { ao: 0.3 }));
    parts.push(xzPart([[-7.6, 0, -4.8, 0, -4.8, 7, -7.6, 7], ...pointedArch(0, 7, 4.8, 7.6, 7, 0.5).slice(0, 3)], 0, 15, iv.s, iv.t, { ox: -16, oy: 12, a: 0.4, v0: -1.6, v1: 1.6 }, { ao: 0.3 }));
    // a young tree rooted in the floor, roots over the stones, fallen drums and blocks
    parts.push(...smallTree(24, -10, 30, 11, 5, { s: '#6a5a44', t: '#a8947a' }, ['#1a4a30', '#8ad08a']));
    parts.push(limbPart([[[8, 4, 0.3], [15, -2, 1.2], [21, -8, 2.4]], [[18, 10, 0.3], [22, 2, 1.1], [24, -6, 2.4]], [[30, 6, 0.3], [28, -3, 1.2], [25, -8, 2.4]], [[32, -16, 0.3], [27, -12, 1.4], [25, -10, 2.6]]], 1.4, '#5a4a38', '#9a846a', { ao: 0.35 }));
    parts.push({ z0: 0, z1: 3.6, side: iv.s, top: iv.t, ao: 0.35, shape: (c, zt) => { lyingCyl(c, -6, 13, 7, 1.8, 0.3, zt * 3.6, 0.1); lyingCyl(c, 4, -12, 5, 1.6, 1.1, zt * 3.6, 0.1); } });
    const blocks = [{ x: -28, y: 10, r: 2.6, h: 2.2, seed: 31, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.7 }, { x: 32, y: 12, r: 2.2, h: 1.8, seed: 32, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.6 }, { x: -34, y: -6, r: 2, h: 1.6, seed: 33, n: 5, rough: 0.14, top: 0.74, pw: 5, moss: 0.5 }];
    parts.push(rockPart(blocks, iv.s, iv.t, { ao: 0.4 }));
    parts.push(layer((pe) => {
      const r = rng(27, 3);
      // fluting on the columns, moss creeping up their feet, vines on two
      for (const q of cols) {
        const top = q.h - (q.br ? 2 : 0), s = [];
        for (let k = -2; k <= 2; k++) { const dx = k * 0.62, y = q.y + Math.sqrt(Math.max(0, CR * CR - dx * dx)) + 0.02; s.push(q.x + dx, y, 3.4, q.x + dx, y, top); }
        pe.lines('rgba(90,86,70,0.3)', 0.3, s);
        pe.lines('rgba(255,252,240,0.4)', 0.3, [q.x - 1.1, q.y + 1.25, 3.4, q.x - 1.1, q.y + 1.25, top]);
        for (let i = 0; i < 3; i++) clump(pe, q.x + r.range(-1.6, 1.6), q.y + 1.6, 3.2 + r.range(0, 2.4), 1, r);
        if (q.h > 20 && q.x < 0) ivy(pe, r, q.x, q.y + CR + 0.05, 3.5, q.h * 0.7, { sway: 0.6 });
      }
      // arch: joint lines, a keystone rune that still glows a little, moss on the shaded flank
      const ca = Math.cos(AA), sa = Math.sin(AA), yA = AY + 1.82;
      for (let i = 1; i < 7; i++) { const t = i / 7; const u = -4.8 + t * 9.6, zq = 11 + Math.sqrt(Math.max(0, 1 - Math.pow(u / 4.8, 2))) * 6.6; pe.lines('rgba(90,86,70,0.4)', 0.3, [AX + u * ca, yA + u * sa, zq, AX + u * ca * 1.5, yA + u * sa * 1.5, zq + 2.6]); }
      rune(pe, AX - 0.6, yA + 0.1, 17.6, 2.4, G, 3, 0.8);
      pe.glow(G, AX, yA, 18.8, 4, 0.22);
      for (let i = 0; i < 5; i++) clump(pe, AX + 5.6 + r.range(-1, 1), yA + 2 + r.range(0, 1), r.range(1, 9), 1, r);
      for (let i = 0; i < 4; i++) clump(pe, -16 - 6 + r.range(-1, 2), 12 + 1.7, r.range(1, 6), 1, r);
      paintMoss(pe, blocks, 29, { cracks: false });
      for (const q of [[-6, 13, 7, 0.3], [4, -12, 5, 1.1]]) for (let k = -1; k <= 1; k++) { const e = tf([-q[2] / 2 + 0.4, k * 0.9, q[2] / 2 - 0.4, k * 0.9], q[0], q[1], q[3]); const z = 1.8 + Math.sqrt(Math.max(0, 3.2 - k * k * 0.8)); pe.lines('rgba(90,86,70,0.3)', 0.3, [e[0], e[1], z, e[2], e[3], z]); }
      glowFlowers(pe, r, [[-30, 18], [30, 20, 0.8], [-38, 2, 0.8]], G);
    }));
    return { r: 44, h: 31, parts, style: 'prop', bevel: 0.6, spots: { arch: [AX, AY, 0] } };
  };

  /* ========================================================= lm_forest_temple
   * Small overgrown temple, r 46, h 36: three round steps, a ring of slender ivory
   * columns under a cracked copper-teal dome with a bite out of its side, a glowing altar
   * at the centre, vines, moss and a sapling in the broken step. */
  M.lm_forest_temple = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), iv = ivoryOf(p), G = p.g || '#7affd8';
    const cu = p.t || '#2f8a6a', cuL = mx(cu, '#9ad8b8', 0.45), cuD = sh(cu, -0.3);
    const parts = [stain(44, 30, 0.3, '#1c2414', 0, 3)];
    parts.push(layer((pe, a) => { const r = rng(31, 1); tufts(pe, r, 40, -44, 44, -30, 30, ['#3e6a2c', '#7aa84a'], (x, y) => Math.hypot(x / 34, y / 26) < 1); const c = pe.c, g = c.createRadialGradient(0, 0, 0, 0, 0, 24); g.addColorStop(0, al(G, 0.2 + 0.08 * pulse(a))); g.addColorStop(1, al(G, 0)); c.save(); c.scale(1, 0.78); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); c.restore(); }));
    // steps: three round tiers, the lowest broken at the south-east
    const tiers = [[34, 0, 2.2], [28, 2.2, 4.2], [22, 4.2, 6.2]];
    tiers.forEach((t, i) => parts.push({ z0: t[1], z1: t[2], side: i ? iv.s : iv.d, top: i === 2 ? iv.t : mx(iv.s, iv.t, 0.6), ao: 0.3, shape: (c) => { let pts = jag(20, 1, 11 + i, 0.05, 0.1, 0, 0, t[0], t[0] * 0.78); if (i === 0) pts = clipHalf(pts, -0.6, -0.8, -34); S.poly(c, pts); },
      detail: (c) => { const r = rng(33 + i, 2); for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; S.lines(c, 'rgba(70,74,60,0.35)', 0.3, [Math.cos(a) * t[0] * 0.7, Math.sin(a) * t[0] * 0.55, Math.cos(a) * t[0], Math.sin(a) * t[0] * 0.78]); } for (let k = 0; k < 10; k++) S.dot(c, k % 2 ? 'rgba(70,120,50,0.7)' : 'rgba(150,200,90,0.6)', r.range(-t[0], t[0]) * 0.9, r.range(-t[0], t[0]) * 0.7, r.range(0.5, 1.2)); } }));
    // the columns
    const cols = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; cols.push({ x: Math.cos(a) * 16, y: Math.sin(a) * 12.5, h: i === 2 ? 12 : i === 6 ? 15 : 24, br: i === 2 ? 1 : i === 6 ? -1 : 0, a }); }
    parts.push({ z0: 6.2, z1: 7.4, side: iv.d, top: iv.s, ao: 0.3, shape: (c) => { for (const q of cols) S.poly(c, ngon(8, 2.4, 0, q.x, q.y)); } });
    parts.push({ z0: 7.4, z1: 24.5, side: iv.s, top: iv.t, ao: 0.3, shape: (c, zt) => { const z = 7.4 + zt * 17.1; for (const q of cols) { if (z > q.h) continue; let pts = ngon(12, 1.6 - 0.2 * (z / 24), 0.1, q.x, q.y); if (q.br && z > q.h - 2.4) pts = clipHalf(pts, -q.br * 0.8, 0.6, (z - (q.h - 2.4)) * 1.3 - 1.8 - q.br * q.x * 0.8 + 0.6 * q.y); polyOK(c, pts); } } });
    parts.push({ z0: 24.2, z1: 25.6, side: iv.s, top: iv.t, ao: 0.2, bevel: false, shape: (c, zt) => { for (const q of cols) if (q.h >= 24) S.poly(c, ngon(8, 1.9 + zt * 1, 0, q.x, q.y)); } });
    // the entablature ring with a gap over the broken columns, then the cracked dome
    const gapA = (a) => { const d = ((a - cols[2].a + Math.PI) % TAU + TAU) % TAU - Math.PI; return Math.abs(d) < 0.55; };
    parts.push({ z0: 25.6, z1: 28, side: iv.s, top: iv.t, ao: 0.25, shape: (c) => { for (let i = 0; i < 24; i++) { const a0 = (i / 24) * TAU, a1 = ((i + 1) / 24) * TAU; if (gapA((a0 + a1) / 2)) continue; S.poly(c, [Math.cos(a0) * 19.5, Math.sin(a0) * 15.2, Math.cos(a1) * 19.5, Math.sin(a1) * 15.2, Math.cos(a1) * 14.5, Math.sin(a1) * 11.3, Math.cos(a0) * 14.5, Math.sin(a0) * 11.3]); } },
      detail: (c) => { for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; S.lines(c, 'rgba(70,74,60,0.4)', 0.3, [Math.cos(a) * 14.8, Math.sin(a) * 11.5, Math.cos(a) * 19.2, Math.sin(a) * 15]); } } });
    const DZ = 28, DH = 9.5, DR = 19;
    parts.push({ z0: DZ, z1: DZ + DH, side: cu, top: cuL, ao: 0.2, bevel: false, shape: (c, zt) => { const k = Math.sqrt(Math.max(0, 1 - zt * zt)); let pts = ngon(28, DR * k, 0, 0, 0, 1, 0.78); if (zt > 0.3) pts = clipHalf(pts, -0.75, -0.66, -DR * 0.62 * (1 - (zt - 0.3) * 0.9)); polyOK(c, pts); },
      detail: (c) => { S.dot(c, al('#ffffff', 0.5), -2, -2, 1.6); S.lines(c, 'rgba(20,50,40,0.6)', 0.4, [0, 0, 2, 1, 2, 1, 3, 3]); } });
    parts.push({ z0: DZ, z1: DZ + DH * 0.92, side: cuD, top: cuD, stroke: 0.9, ao: 0.1, bevel: false, flat: true, shape: (c, zt) => { const k = Math.sqrt(Math.max(0, 1 - Math.pow(zt * 0.92, 2))); for (const a of [0.2, 0.9, 1.6, 2.3, 3.0]) { const x = Math.cos(a) * DR * k, y = Math.sin(a) * DR * k * 0.78; if (zt > 0.3 && -0.75 * x - 0.66 * y < -DR * 0.62 * (1 - (zt * 0.92 - 0.3) * 0.9)) continue; c.moveTo(x, y); c.lineTo(x + 0.01, y); } } });
    parts.push(cyl(-1, -0.5, 1.4, DZ + DH - 0.4, DZ + DH + 1.6, iv.s, iv.t, { ao: 0.1, bevel: false }));
    // the altar: a carved block with a flat glowing crystal on top
    parts.push(box(0, 0, 6.4, 4.2, 6.2, 10, iv.s, iv.t, { ao: 0.3, detail: (c) => S.lines(c, 'rgba(70,74,60,0.4)', 0.3, [-3, -1.8, 3, -1.8, -3, 1.8, 3, 1.8]) }));
    parts.push({ z0: 10, z1: 11, side: G, top: mx(G, '#ffffff', 0.4), flat: true, bevel: false, shape: (c) => S.ell(c, 0, 0, 2.2, 1.4, 0) });
    parts.push(layer((pe, a) => {
      const r = rng(37, 3), ap = 0.5 + 0.5 * pulse(a);
      // fluting, vines on the front columns, moss on the capitals and the dome's broken lip
      for (const q of cols) {
        const top = q.h - (q.br ? 2 : 0), s = [];
        for (let k = -2; k <= 2; k++) { const dx = k * 0.58, y = q.y + Math.sqrt(Math.max(0, 2.5 - dx * dx)) + 0.02; s.push(q.x + dx, y, 7.6, q.x + dx, y, top); }
        pe.lines('rgba(90,86,70,0.3)', 0.3, s);
        pe.lines('rgba(255,252,240,0.4)', 0.3, [q.x - 1, q.y + 1.2, 7.6, q.x - 1, q.y + 1.2, top]);
        if (q.y > 4 && !q.br) ivy(pe, r, q.x, q.y + 1.65, 7.8, 19, { sway: 0.5 });
        clump(pe, q.x + r.range(-1, 1), q.y + 1.4, 7.2, 0.9, r);
      }
      for (let i = 0; i < 6; i++) clump(pe, -8 + i * 2.6 + r.range(-1, 1), -11 + i * 0.8, DZ + 4 + r.range(-1, 1.5), 1.2, r);
      for (let i = 0; i < 8; i++) { const a2 = 0.3 + i * 0.32; pe.lines('rgba(20,50,40,0.5)', 0.35, [Math.cos(a2) * 17, Math.sin(a2) * 13.5 + 0.1, DZ + 1.5, Math.cos(a2) * 16 + 0.5, Math.sin(a2) * 12.6 + 0.1, DZ + 5.5]); pe.lines(al(cuL, 0.7), 0.3, [Math.cos(a2) * 17 + 0.5, Math.sin(a2) * 13.5 + 0.1, DZ + 1.3, Math.cos(a2) * 16 + 1, Math.sin(a2) * 12.6 + 0.1, DZ + 5]); }
      // the altar's light: runes, a shaft and motes rising
      for (let i = 0; i < 3; i++) rune(pe, -2 + i * 1.8, 2.12, 7, 1.6, G, i + 1, ap);
      pe.glow(G, 0, 0, 11.4, 7, 0.3 + 0.15 * ap); pe.glow('#ffffff', 0, 0, 11, 2.4, 0.9);
      const c = pe.c; for (const [w0, w1, aa] of [[2.4, 5, 0.06], [1, 2.2, 0.1]]) { const g = c.createLinearGradient(0, -11, 0, -30); g.addColorStop(0, al(G, aa + 0.08 * ap)); g.addColorStop(1, al(G, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(-w0, -11); c.lineTo(w0, -11); c.lineTo(w1, -30); c.lineTo(-w1, -30); c.closePath(); c.fill(); }
      for (let i = 0; i < 7; i++) { const ph = (a + i / 7) % 1; pe.dot(al(i % 2 ? G : '#ffffff', 0.9 * (1 - ph)), Math.sin(i * 2.3) * 2, Math.cos(i * 1.7) * 1.2, 11 + ph * 16, 0.3); }
      glowFlowers(pe, r, [[-30, 20], [26, 22, 0.8], [36, -8, 0.8], [-38, -4]], G);
    }));
    parts.push(...smallTree(27, 21, 22, 8, 9, { s: '#6a5a44', t: '#a8947a' }, ['#1a4a30', '#8ad08a']));
    return { r: 46, h: 40, parts, style: 'prop', bevel: 0.6, spots: { altar: [0, 0, 11] } };
  };

  /* ====================================================== lm_statue_forgotten
   * Forgotten elf: a tall hooded figure on a six-sided plinth, head bowed, hands folded
   * on a staff, vines climbing the cloak, moss on the shoulders, pale flowers at the foot.
   * r 12, h 40. */
  M.lm_statue_forgotten = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), iv = ivoryOf(p), G = p.g || '#7affd8';
    const fS = mx(iv.s, '#b8b4a4', 0.4), fT = mx(iv.t, '#e8e4d8', 0.4), fD = sh(fS, -0.25);
    const parts = [stain(12, 9, 0.3, '#1c2414', 0, 1.5)];
    parts.push(box(0, 0, 11, 9, 0, 1.4, iv.d, mx(iv.s, iv.t, 0.5), { ao: 0.3, shape: (c) => S.poly(c, ngon(6, 6.2, 0, 0, 0, 1, 0.82)) }));
    parts.push({ z0: 1.4, z1: 7, side: iv.s, top: iv.t, ao: 0.32, shape: (c, zt) => S.poly(c, ngon(6, 5 - zt * 0.3, 0, 0, 0, 1, 0.82)), detail: (c) => { S.lines(c, 'rgba(70,74,60,0.45)', 0.35, [-3, 1, -1, -2, 2, 2.2, 3.6, -0.4]); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; S.lines(c, 'rgba(70,74,60,0.3)', 0.3, [Math.cos(a) * 3, Math.sin(a) * 2.5, Math.cos(a) * 4.6, Math.sin(a) * 3.8]); } } });
    // the cloak: a long tapering fall, shoulders, then the hood bowed forward
    parts.push({ z0: 7, z1: 31, side: fS, top: fT, ao: 0.3, shape: (c, zt) => { const w = 4.6 - zt * 1.4, d = 3.6 - zt * 1; S.poly(c, [-w, -d * 0.6, -w * 0.8, -d, w * 0.8, -d, w, -d * 0.6, w * 0.9, d * 0.7, 0, d, -w * 0.9, d * 0.7]); } });
    parts.push({ z0: 30.4, z1: 34, side: fS, top: fT, ao: 0.25, shape: (c, zt) => { const k = 1 - Math.pow(zt, 2) * 0.5; S.ell(c, 0, 0.3 + zt * 0.4, 4 * k, 2.6 * k, 0); } });
    parts.push({ z0: 33.4, z1: 40, side: fS, top: fT, ao: 0.25, shape: (c, zt) => { const k = zt < 0.6 ? 1 : 1 - (zt - 0.6) / 0.4 * 0.85; S.ell(c, 0.2, 1.6 + zt * 1.4, 2.7 * k + 0.1, 2.3 * k + 0.1, 0); } });
    // folded hands on a staff
    parts.push(beams([[0.6, 3.4, 7.4, 0.9, 3.4, 30]], 0.7, fD, fS, { ao: 0.2 }));
    parts.push({ z0: 19, z1: 22.2, side: fS, top: fT, ao: 0.25, bevel: false, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt * 1.1, 0, 1)) * 0.6 + 0.4; S.ell(c, 0.4, 3.2, 2.2 * k, 1.5 * k, 0); } });
    parts.push({ z0: 30, z1: 31.6, side: G, top: mx(G, '#ffffff', 0.5), flat: true, bevel: false, shape: (c, zt) => S.circ(c, 0.9, 3.4, 0.9 * Math.sin(Math.PI * zt) + 0.15) });
    parts.push(layer((pe) => {
      const r = rng(41, 2);
      // the shadowed face inside the hood, a pale chin and the hood's edge
      pe.c.beginPath(); pe.c.ellipse(0.2, 3.9 - 35.6, 2, 1.9, 0, 0, TAU); pe.c.fillStyle = '#1e2a24'; pe.c.fill();
      pe.ell('rgba(236,232,220,0.9)', 0.2, 3.95, 34.6, 1.1, 0.55);
      pe.lines('rgba(255,252,240,0.5)', 0.4, [-2.2, 3.9, 37.2, 0.2, 4.1, 38.4, 0.2, 4.1, 38.4, 2.4, 3.9, 37]);
      // cloak folds, rain streaks, the staff's shadow
      pe.lines('rgba(70,74,60,0.5)', 0.5, [-2.6, 3.7, 30, -3.2, 3.9, 8, 2.6, 3.7, 30, 3.3, 3.9, 8, -0.8, 3.8, 19, -1, 3.9, 8.5]);
      pe.lines('rgba(255,252,240,0.3)', 0.3, [-1.8, 3.8, 29, -2.3, 3.95, 9, 1.9, 3.8, 29, 2.4, 3.95, 9]);
      pe.lines('rgba(70,74,60,0.35)', 0.45, [1.5, 3.95, 18.4, 1.6, 3.95, 8]);
      // vines up the cloak and over a shoulder, moss on the shoulders, plinth and hood
      ivy(pe, r, -2.4, 3.95, 7.2, 26, { sway: 0.5, size: 0.85 }); ivy(pe, r, 2.8, 3.9, 7.2, 17, { sway: 0.4, size: 0.8 });
      clump(pe, -3.2, 0.4, 32.6, 1.2, r); clump(pe, 3, -0.2, 32.4, 0.9, r); clump(pe, -1, 1, 39.4, 0.8, r);
      clump(pe, -4, 2.8, 7.2, 1.1, r); clump(pe, 4.2, -1.6, 7.2, 1, r); clump(pe, -5.4, 3.8, 1.6, 1, r);
      for (let i = 0; i < 6; i++) pe.dot(LICHEN[i % 4], r.range(-3, 3), r.range(-2, 2), 7.3, r.range(0.3, 0.5));
      glowFlowers(pe, r, [[-8, 5], [7.4, 4.4, 0.8], [8.6, -3, 0.7], [-7, -5, 0.7]], G);
      pe.glow(G, 0.9, 3.4, 30.8, 3, 0.4);
    }));
    return { r: 12, h: 40.5, parts, style: 'prop', bevel: 0.6, spots: { head: [0.2, 2.5, 40] } };
  };

  /* ======================================================== lm_colossal_stump
   * Stump of a felled giant, r 28, h 16: a vast cut face with growth rings and a split,
   * ridged silver bark, roots spreading, shelf mushrooms up the side, a dark hollow and
   * moss on the north rim. */
  M.lm_colossal_stump = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), G = p.g || '#7affd8', seed = opt.seed | 0;
    const bk = { s: '#6e7076', t: '#c8ccd0', g: '#363a40' };
    const R = 19, H = 16, wood = '#d2b07e', ring = 'rgba(120,80,40,0.5)';
    const parts = [contact(R * 1.5, R, R * 0.2, R * 0.15, 0.32)];
    // roots spreading, the bark body flaring at the foot
    const rl = [], nr = 8;
    for (let i = 0; i < nr; i++) { const a = (i / nr) * TAU + 0.2 + U.hash2(i, seed, 1) * 0.3, L = R * (1.3 + U.hash2(i, seed, 2) * 0.35); rl.push([[Math.cos(a) * L, Math.sin(a) * L * 0.8, 0.3], [Math.cos(a) * L * 0.6, Math.sin(a) * L * 0.5, 1.6], [Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.75, 3.4]]); }
    parts.push(limbPart(rl, 2.6, bk.s, bk.t, { ao: 0.35 }));
    const rad = (z) => R * (1 + 0.22 * Math.pow(Math.max(0, 1 - z / 6), 2));
    parts.push({ z0: 0, z1: H, side: bk.s, top: wood, ao: 0.5, shape: (c, zt) => S.blob(c, 0, 0, rad(zt * H), seed + 5, 13, 0.12),
      detail: (c) => {
        c.save(); c.beginPath(); S.blob(c, 0, 0, R * 0.985, seed + 5, 13, 0.12); c.clip();
        const g = c.createRadialGradient(-2, -1, 1, -2, -1, R); g.addColorStop(0, '#e6c892'); g.addColorStop(0.7, wood); g.addColorStop(1, '#b89060'); c.fillStyle = g; c.fillRect(-R, -R, 2 * R, 2 * R);
        c.lineWidth = 0.35; c.strokeStyle = ring;
        for (let i = 1; i <= 11; i++) { c.beginPath(); S.blob(c, -1.6 + i * 0.12, -1 + i * 0.08, R * (0.08 * i), seed + i, 9, 0.1); c.stroke(); }
        c.lineWidth = 1.2; c.strokeStyle = 'rgba(60,40,20,0.55)'; c.beginPath(); c.moveTo(-1.2, -0.8); c.lineTo(R * 0.45, R * 0.5); c.lineTo(R * 0.7, R * 0.52); c.stroke();
        c.lineWidth = 0.5; c.strokeStyle = 'rgba(60,40,20,0.4)'; c.beginPath(); c.moveTo(-1, -0.6); c.lineTo(-R * 0.6, -R * 0.35); c.stroke();
        S.dot(c, 'rgba(60,40,20,0.7)', -1.4, -0.9, 1.1); S.dot(c, 'rgba(255,240,200,0.5)', -R * 0.4, -R * 0.4, 2.2);
        c.lineWidth = 1.4; c.strokeStyle = sh(bk.s, -0.2); c.beginPath(); S.blob(c, 0, 0, R * 0.975, seed + 5, 13, 0.12); c.stroke();
        c.restore();
      } });
    parts.push({ z0: 0.6, z1: H - 0.5, side: bk.g, top: bk.g, stroke: 0.55, ao: 0.05, bevel: false,
      shape: (c, zt) => { const z = 0.6 + zt * (H - 1.1), rr = rad(z) * 0.96; for (let i = 0; i < 9; i++) { const a = 0.2 + i * 0.68 + Math.sin(z * 0.5 + i) * 0.1; c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); c.lineTo(Math.cos(a) * rr + 0.01, Math.sin(a) * rr); } } });
    parts.push({ z0: 0.6, z1: H - 0.5, side: bk.t, top: bk.t, stroke: 0.5, ao: 0.3, bevel: false,
      shape: (c, zt) => { const z = 0.6 + zt * (H - 1.1), rr = rad(z) * 0.96; for (let i = 0; i < 9; i++) { const a = 0.42 + i * 0.68 + Math.sin(z * 0.5 + i) * 0.1; if (Math.cos(a) > 0.2 && Math.sin(a) > -0.6) continue; c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); c.lineTo(Math.cos(a) * rr + 0.01, Math.sin(a) * rr); } } });
    // shelf mushrooms on the camera side, a moss cushion on the north rim
    const shelves = [[-9, 5, 2.6], [-6, 9.4, 2], [7, 7, 2.4], [10, 11.5, 1.6], [2, 12.8, 1.8]];
    parts.push({ z0: 4, z1: 14.6, side: '#8a5a30', top: '#d89a58', ao: 0.4, bevel: false, shape: (c, zt) => { const z = 4 + zt * 10.6; for (const q of shelves) { if (z < q[1] || z > q[1] + 1.4) continue; const k = 1 - (z - q[1]) / 1.4 * 0.5; const y = Math.sqrt(Math.max(0, rad(z) * rad(z) - q[0] * q[0])) * 0.97; S.ell(c, q[0], y + q[2] * 0.4, q[2] * 1.3 * k, q[2] * 0.9 * k, 0); } } });
    parts.push({ z0: H - 0.6, z1: H + 1.2, side: '#3e5a22', top: '#7a9e3a', ao: 0.2, shape: (c, zt) => { const k = 1 - zt * 0.25; puff(c, -R * 0.35, -R * 0.55, R * 0.42 * k, seed + 2, 8); puff(c, R * 0.3, -R * 0.62, R * 0.3 * k, seed + 4, 7); },
      detail: (c) => { const r2 = rng(seed, 152); for (let i = 0; i < 12; i++) S.dot(c, i % 2 ? 'rgba(170,210,90,0.7)' : 'rgba(30,50,20,0.5)', -R * 0.35 + r2.range(-1, 1) * R * 0.4, -R * 0.55 + r2.range(-1, 1) * R * 0.3, r2.range(0.3, 0.5)); } });
    parts.push(layer((pe) => {
      const r = rng(43, 2), yF = rad(2) * 0.985;
      // the hollow at the foot, root crevices, lichen, ferns and glowing flowers
      pe.c.beginPath(); pe.c.moveTo(-3.8, yF); pe.c.lineTo(-4.2, yF - 3); pe.c.quadraticCurveTo(-3, yF - 7.6, 0.6, yF - 7.8); pe.c.quadraticCurveTo(4, yF - 7.2, 4, yF - 3); pe.c.lineTo(3.8, yF); pe.c.closePath();
      const g = pe.c.createRadialGradient(0, yF - 2, 1, 0, yF - 3, 7); g.addColorStop(0, '#0b100e'); g.addColorStop(0.6, '#141c18'); g.addColorStop(1, '#303a34'); pe.c.fillStyle = g; pe.c.fill();
      pe.glow(G, 0, yF, 1.5, 2.6, 0.35);
      for (const q of shelves) { const y = Math.sqrt(Math.max(0, rad(q[1]) * rad(q[1]) - q[0] * q[0])) * 0.97 + q[2] * 0.4; pe.lines('rgba(90,50,20,0.6)', 0.3, [q[0] - q[2] * 1.1, y + q[2] * 0.6, q[1] - 0.1, q[0] + q[2] * 1.1, y + q[2] * 0.6, q[1] - 0.1]); pe.dot('rgba(255,230,180,0.6)', q[0] - q[2] * 0.4, y - q[2] * 0.2, q[1] + 1.1, q[2] * 0.3); }
      for (let i = 0; i < 10; i++) pe.dot(LICHEN[i % 4], r.range(-R, R) * 0.8, yF - r.range(0, 3), r.range(3, 14), r.range(0.3, 0.6));
      for (let i = 0; i < 12; i++) { const a = r.range(0.1, 3), x = Math.cos(a) * (R * 1.35 + r.range(0, 4)), y = Math.sin(a) * (R * 1.1 + r.range(0, 3)); for (let k = 0; k < 4; k++) pe.lines(k % 2 ? '#2e5a26' : '#5a9a3a', 0.3, [x, y, 0, x + (k - 1.5) * 1.1, y - 0.5, r.range(1.5, 3.2)]); }
      glowFlowers(pe, r, [[-R * 1.2, R * 0.5], [R * 1.25, R * 0.4, 0.8], [R * 0.2, R * 1.25, 0.8]], G);
    }));
    return { r: 28, h: 17.5, parts, style: 'prop', bevel: 0.6, spots: { top: [0, 0, H] } };
  };

  /* =========================================================== lm_forest_pool
   * Still forest pool (decor), r 30, h 3: dark glassy water in a mossy bank, lily pads
   * with blossoms, stones at the edge, reeds and glowing flowers. */
  M.lm_forest_pool = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), G = p.g || '#7affd8', seed = opt.seed | 0;
    const bank = jag(18, 1, 17 + seed, 0.16, 0.3, 0, 0, 27, 19), water = xf(bank, 0.86, 0.84, 0, 0, 0.3, 0.4);
    const WZ = 0.7;
    const parts = [contact(30, 21, 0, 1, 0.22)];
    parts.push({ z0: 0, z1: 1.4, side: '#3a4a26', top: '#5e7e34', ao: 0.3, bevel: false, shape: (c) => smoothPoly(c, bank),
      detail: (c) => { const r = rng(seed, 3); for (let i = 0; i < 40; i++) { const a = r.range(0, TAU), d = r.range(0.86, 1) ; S.dot(c, i % 3 ? 'rgba(40,70,30,0.7)' : 'rgba(150,200,90,0.6)', Math.cos(a) * 27 * d, Math.sin(a) * 19 * d, r.range(0.5, 1.2)); } } });
    parts.push({ z0: WZ, z1: WZ + 0.3, side: '#1c3a3e', top: '#24484c', flat: true, bevel: false, shape: (c) => smoothPoly(c, water),
      detail: (c) => {
        const r = rng(seed, 7);
        c.save(); c.beginPath(); smoothPoly(c, water); c.clip();
        const g = c.createRadialGradient(-6, -4, 1, -6, -4, 26); g.addColorStop(0, 'rgba(90,160,150,0.35)'); g.addColorStop(0.5, 'rgba(40,90,90,0.15)'); g.addColorStop(1, 'rgba(10,30,34,0.5)'); c.fillStyle = g; c.fillRect(-30, -22, 60, 44);
        // reflections of the canopy above and the sky, ripple rings
        c.strokeStyle = 'rgba(200,240,230,0.35)'; c.lineWidth = 0.35;
        for (let i = 0; i < 9; i++) { const x = r.range(-20, 16), y = r.range(-12, 10), w = r.range(2, 6); c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); }
        c.strokeStyle = 'rgba(180,230,220,0.3)'; for (const q of [[4, 3, 3.2], [-12, 6, 2.2], [10, -8, 2.6]]) for (let k = 1; k <= 2; k++) { c.beginPath(); c.ellipse(q[0], q[1], q[2] * k, q[2] * k * 0.7, 0, 0, TAU); c.stroke(); }
        c.fillStyle = 'rgba(10,24,26,0.5)'; c.beginPath(); c.ellipse(8, 6, 12, 7, 0.3, 0, TAU); c.fill();
        c.restore();
      } });
    // lily pads and blossoms, stones in the shallows and on the bank, reeds
    const pads = [[-14, -3, 3.2, 0.6], [-9, 4, 2.6, 2.2], [3, -7, 3.4, 4], [9, 2, 2.4, 1], [15, -4, 2.8, 5.2], [-3, 9, 2.2, 3]];
    parts.push({ z0: WZ + 0.3, z1: WZ + 0.7, side: '#2c6a2e', top: '#5aa040', ao: 0.1, bevel: false, shape: (c) => { for (const q of pads) { c.moveTo(q[0] + Math.cos(q[3]) * q[2], q[1] + Math.sin(q[3]) * q[2] * 0.8); c.ellipse(q[0], q[1], q[2], q[2] * 0.8, 0, q[3] + 0.5, q[3] + TAU - 0.5); c.lineTo(q[0], q[1]); c.closePath(); } },
      detail: (c) => { for (const q of pads) { S.lines(c, 'rgba(20,60,20,0.5)', 0.3, [q[0], q[1], q[0] + Math.cos(q[3] + Math.PI) * q[2] * 0.9, q[1] + Math.sin(q[3] + Math.PI) * q[2] * 0.72]); S.dot(c, 'rgba(200,240,160,0.4)', q[0] - q[2] * 0.3, q[1] - q[2] * 0.3, q[2] * 0.3); } } });
    parts.push({ z0: WZ + 0.7, z1: WZ + 2.2, side: '#d86a9a', top: '#ffd0e4', ao: 0.2, bevel: false, shape: (c, zt) => { const k = zt < 0.5 ? 0.6 + zt * 0.8 : 1 - (zt - 0.5) * 1.4; for (const q of [[-14, -3], [3, -7], [15, -4]]) S.star(c, q[0] - 0.3, q[1] - 0.2, 1.3 * k, 0.7 * k, 6, zt); }, detail: (c) => { for (const q of [[-14, -3], [3, -7], [15, -4]]) S.dot(c, '#ffe060', q[0] - 0.3, q[1] - 0.2, 0.35); } });
    const st = [{ x: -22, y: 12, r: 3.4, h: 2.4, seed: 61, moss: 0.8 }, { x: 20, y: 13, r: 2.8, h: 2, seed: 62, moss: 0.6 }, { x: 25, y: -9, r: 2.4, h: 2, seed: 63, moss: 0.5 }, { x: -25, y: -8, r: 2.2, h: 1.8, seed: 64, moss: 0.4 }, { x: 6, y: 13.5, r: 1.8, h: 1.3, seed: 65, moss: 0.3 }, { x: -6, y: -15, r: 2, h: 1.5, seed: 66, moss: 0.5 }];
    parts.push(rockPart(st, '#5c6058', '#a8aa9c', { ao: 0.45 }));
    parts.push(...rockFacets(st, '#a8aa9c', '#363a34'));
    parts.push(limbPart([[[-18, 8, 0], [-17.6, 7.8, 5]], [[-16.6, 9.2, 0], [-16, 9, 6]], [[-19.4, 10, 0], [-19.2, 10, 4.4]], [[22, -2, 0], [22.4, -2.2, 5.2]], [[23.4, 0.2, 0], [23.9, 0, 4.2]]], 0.4, '#4a6a2a', '#9ac050', { ao: 0.2 }));
    parts.push(layer((pe) => {
      const r = rng(seed, 9);
      paintMoss(pe, st, 13 + seed, { cracks: false, size: 0.9 });
      for (const q of [[-18, 8, 5], [-16.6, 9.2, 6], [22, -2, 5.2]]) pe.ell('#6a4a2a', q[0], q[1], q[2] - 0.6, 0.35, 0.9);
      glowFlowers(pe, r, [[-24, 2], [24, 6], [-10, -17], [12, 16], [27, -2, 0.8], [-20, -14, 0.8]], G);
      for (let i = 0; i < 8; i++) { const a = r.range(0, TAU); pe.dot(al(G, 0.55), Math.cos(a) * 24, Math.sin(a) * 17, 1.4, r.range(0.25, 0.45)); }
      for (let i = 0; i < 24; i++) { const a = r.range(0, TAU), x = Math.cos(a) * 28, y = Math.sin(a) * 20; for (let k = 0; k < 3; k++) pe.lines(k % 2 ? '#2e5a26' : '#5a9a3a', 0.28, [x, y, 0, x + (k - 1) * 0.9, y, r.range(1.2, 2.4)]); }
    }));
    return { r: 30, h: 4, parts, style: 'decor', bevel: 0.5, spots: { water: [0, 0, WZ] } };
  };

  /* =============================================================== HRIMGARD
   * Snow is almost white (#dfe8f0), so everything here keeps a dark body, blue shade
   * sides and crisp white caps with a blue-shaded edge (snowCap). */
  const frostOf = (p) => ({ s: mx(p.a, '#4a5a70', 0.55), t: mx(p.a, '#9aa8ba', 0.45), d: mx(p.d, '#2a3448', 0.5), ice: p.s || '#a9dcf3', iceS: '#3f7cbc', iceT: '#d6f2ff', iceL: '#a6e2ff', iceD: '#1c4a86', snow: '#ffffff', snowS: '#eef4fb', shade: '#a9c2e2', wood: mx(p.w, '#4a3c30', 0.5), woodT: mx(p.w, '#8a7260', 0.5), woodD: mx(p.w, '#2a2018', 0.5) });
  const blueShadow = (rx, ry, a, ox, oy) => stain(rx, ry, a, '#5a7898', ox, oy);
  /* white snow lying on the tops of broken wall segments, with a blue-shaded far edge */
  function snowOnSegs(segs, th, lift) {
    const zmax = Math.max.apply(null, segs.map((q) => q.h)) + (lift || 0.9);
    const quad = (q, g) => { const len = Math.hypot(q.x1 - q.x0, q.y1 - q.y0), ux = (q.x1 - q.x0) / len, uy = (q.y1 - q.y0) / len, nx = -uy, ny = ux, w = th / 2 + g; return [q.x0 + nx * w - ux * g, q.y0 + ny * w - uy * g, q.x1 + nx * w + ux * g, q.y1 + ny * w + uy * g, q.x1 - nx * w + ux * g, q.y1 - ny * w + uy * g, q.x0 - nx * w - ux * g, q.y0 - ny * w - uy * g]; };
    return [
      { z0: 0.5, z1: zmax, side: '#eef4fb', top: '#ffffff', flat: true, ao: 0.05, bevel: false, shape: (c, zt) => { const z = 0.5 + zt * (zmax - 0.5); for (const q of segs) { if (q.h < 0.8 || z < q.h - 0.2 || z > q.h + (lift || 0.9)) continue; S.poly(c, quad(q, 0.25 * (1 - (z - q.h) / (lift || 0.9)))); } } },
      { z0: 0.5, z1: zmax, side: '#a9c2e2', top: '#a9c2e2', flat: true, stroke: 0.6, ao: 0, bevel: false, shape: (c, zt) => { const z = 0.5 + zt * (zmax - 0.5); for (const q of segs) { if (q.h < 0.8 || z < q.h - 0.2 || z > q.h + 0.4) continue; faceEdges(c, quad(q, 0.2), (sx, sy) => sx > 0.3 && sy > -0.5); } } },
    ];
  }
  /* faceted ice spires (see ice_shard in models_nature.js): body, lit / dark edges, arris
   * highlight and a flat translucent core. list: {base (poly about 0,0), bx, by, h, lean[2]} */
  function iceSpires(parts, sh_, F, o) {
    o = o || {};
    for (const s of sh_) {
      const kf = (u) => 0.1 + 0.9 * Math.pow(1 - u, 0.8);
      const at = (z) => { const u = clamp(z / s.h, 0, 1); return xf(s.base, kf(u), kf(u), 0, 0, s.bx + s.lean[0] * u, s.by + s.lean[1] * u); };
      parts.push({ z0: 0, z1: s.h, side: F.iceS, top: F.iceT, ao: 0.35, shape: (c, zt) => S.poly(c, at(zt * s.h)) });
      parts.push({ z0: s.h * 0.15, z1: s.h * 0.82, side: mx(F.ice, '#ffffff', 0.35), top: mx(F.ice, '#ffffff', 0.5), flat: true, ao: 0, bevel: false, shape: (c, zt) => { const z = s.h * (0.15 + zt * 0.67), p = at(z); let cx = 0, cy = 0; for (let i = 0; i < p.length; i += 2) { cx += p[i]; cy += p[i + 1]; } cx /= p.length / 2; cy /= p.length / 2; S.poly(c, xf(p, 0.42, 0.42, cx, cy, 0, 0)); } });
      parts.push({ z0: 0.4, z1: s.h - 0.6, side: F.iceL, top: F.iceL, stroke: 0.85, ao: 0.3, bevel: false, shape: (c, zt) => faceEdges(c, at(lerp(0.4, s.h - 0.6, zt)), (sx, sy) => sx < -0.3 && sy > -0.8) });
      parts.push({ z0: 0.4, z1: s.h - 0.6, side: F.iceD, top: F.iceD, stroke: 0.85, ao: 0.1, bevel: false, shape: (c, zt) => faceEdges(c, at(lerp(0.4, s.h - 0.6, zt)), (sx, sy) => sx > 0.3 && sy > -0.5) });
      let vi = 0, best = -1e9;
      for (let k = 0; k < s.base.length; k += 2) { const v = -s.base[k] * 0.7 + s.base[k + 1] * 0.7; if (v > best) { best = v; vi = k; } }
      parts.push({ z0: 0.5, z1: s.h - 0.4, side: '#f2fbff', top: '#f2fbff', stroke: 0.45, ao: 0, bevel: false, flat: true, shape: (c, zt) => { const p = at(lerp(0.5, s.h - 0.4, zt)); c.moveTo(p[vi], p[vi + 1]); c.lineTo(p[vi] + 0.01, p[vi + 1]); } });
    }
  }
  const shardBase = (L, W, ang) => { const raw = [L, 0, 0.3 * L, W, -0.5 * L, W * 0.8, -L, 0, -0.35 * L, -W, 0.45 * L, -W * 0.85], b = []; for (let k = 0; k < raw.length; k += 2) b.push(raw[k] * Math.cos(ang) - raw[k + 1] * Math.sin(ang), raw[k] * Math.sin(ang) + raw[k + 1] * Math.cos(ang)); return b; };
  /* snow drift: a soft white mound with a blue-shaded far side */
  const drift = (x, y, r, h, seed, sx, sy) => snowCap((zt) => jag(11, r * (1 - zt * zt * 0.6), seed, 0.4, 0, x - zt * 0.3, y - zt * 0.3, sx || 1.1, sy || 0.75), 0, h);

  /* ========================================================== lm_carved_stone
   * A great rune stone, r 12, h 40: a leaning slab of blue-grey rock carved with a
   * knotwork border, a serpent band and a column of runes, snow on its crown and
   * ledges, a drift at its foot. One rune still glows faintly frost-blue. */
  M.lm_carved_stone = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p), G = p.g || '#8ad8ff';
    const R = { x: 0, y: 0, r: 5.4, h: 38, seed: 7, n: 8, rough: 0.18, sx: 1.35, sy: 0.9, top: 0.55, pw: 6, lx: 1.6, ly: -0.8, rot: 0.1 };
    const parts = [blueShadow(13, 8, 0.3, 1, 2)];
    parts.push(...drift(0, 2, 9, 1.8, 3, 1.2, 0.7));
    parts.push(rockPart([R], F.s, F.t, { ao: 0.45 }));
    parts.push(...rockFacets([R], F.t, F.d));
    parts.push(...snowCap((zt) => xf(rockSect(R, R.h - 0.2), 0.95 - zt * 0.15, 0.95 - zt * 0.15, R.x + R.lx, R.y + R.ly, 0, -0.2), R.h - 0.3, R.h + 1.6));
    parts.push(...snowCap((zt) => jag(7, 2.2 * (1 - zt * 0.5), 5, 0.4, 0, 3.6 + R.lx * 0.55, -2.4, 1.3, 0.7), 20.6, 21.6));
    parts.push(layer((pe) => {
      const c = pe.c, r = rng(9, 2);
      const fy = (z) => { const s = rockSect(R, z); let m = -1e9; for (let i = 1; i < s.length; i += 2) m = Math.max(m, s[i]); return m + 0.03; };
      const fx = (z) => R.lx * clamp(z / R.h, 0, 1);
      const carve = (dark, light, w, s3) => { pe.lines(dark, w, s3); const o = []; for (let i = 0; i < s3.length; i += 6) o.push(s3[i] - 0.22, s3[i + 1], s3[i + 2] + 0.22, s3[i + 3] - 0.22, s3[i + 4], s3[i + 5] + 0.22); pe.lines(light, w * 0.6, o); };
      const D = 'rgba(20,28,44,0.75)', L = 'rgba(225,238,252,0.65)';
      // border with corner spirals
      const bz0 = 4, bz1 = 33, hw = (z) => 3.6 * (1 - 0.3 * z / R.h);
      const border = []; for (let z = bz0; z < bz1; z += 1) { border.push(fx(z) - hw(z), fy(z), z, fx(z + 1) - hw(z + 1), fy(z + 1), z + 1, fx(z) + hw(z), fy(z), z, fx(z + 1) + hw(z + 1), fy(z + 1), z + 1); }
      border.push(fx(bz0) - hw(bz0), fy(bz0), bz0, fx(bz0) + hw(bz0), fy(bz0), bz0, fx(bz1) - hw(bz1), fy(bz1), bz1, fx(bz1) + hw(bz1), fy(bz1), bz1);
      carve(D, L, 0.5, border);
      // serpent band: an interlaced chain of loops down the middle
      for (let i = 0; i < 6; i++) {
        const z = 8 + i * 4.1, x = fx(z) + (i % 2 ? 0.6 : -0.6);
        c.beginPath(); c.ellipse(x, fy(z) - z, 1.35, 1.9, 0, 0, TAU); c.strokeStyle = D; c.lineWidth = 0.55; c.stroke();
        c.beginPath(); c.ellipse(x - 0.2, fy(z) - z - 0.2, 1.35, 1.9, 0, 0, TAU); c.strokeStyle = L; c.lineWidth = 0.3; c.stroke();
      }
      pe.dot(D, fx(31.5), fy(31.5), 31.5, 0.9); pe.dot('#1a2232', fx(31.5) - 0.3, fy(31.5), 31.8, 0.3); pe.dot('#1a2232', fx(31.5) + 0.3, fy(31.5), 31.8, 0.3);
      // runes down both margins, one still alight
      for (let i = 0; i < 5; i++) { const z = 7 + i * 5, x = fx(z) - 2.7; rune(pe, x, fy(z), z, 1.5, '#182030', i + 1, 0.75, true); rune(pe, x + 0.25, fy(z) - 0.01, z + 0.25, 1.5, '#d8e6f4', i + 1, 0.3, true); }
      for (let i = 0; i < 5; i++) { const z = 9.5 + i * 5, x = fx(z) + 1.6; if (i === 2) { rune(pe, x, fy(z), z, 1.5, G, i + 4, 1); pe.glow(G, x + 0.7, fy(z), z + 0.8, 3.2, 0.4); } else { rune(pe, x, fy(z), z, 1.5, '#182030', i + 4, 0.75, true); rune(pe, x + 0.25, fy(z) - 0.01, z + 0.25, 1.5, '#d8e6f4', i + 4, 0.3, true); } }
      // frost in the cracks, ice glaze on the shaded flank, snow blown against the foot
      pe.lines('rgba(20,28,44,0.5)', 0.4, [fx(14) + 3.4, fy(14), 14, fx(18) + 2.6, fy(18), 18, fx(18) + 2.6, fy(18), 18, fx(21) + 3.2, fy(21), 21]);
      for (let i = 0; i < 14; i++) pe.dot('rgba(255,255,255,0.7)', fx(3 + i * 2.4) + r.range(-3.6, 3.6), fy(3 + i * 2.4), 3 + i * 2.4 + r.range(-0.5, 0.5), r.range(0.15, 0.35));
      pe.poly('rgba(255,255,255,0.85)', [-7.5, 4, 0, 7, 4.2, 0, 5, 4.6, 2.2, 1, 4.9, 3.4, -4, 4.7, 2.6, -7.5, 4.3, 1.2]);
    }));
    return { r: 12, h: 41, parts, style: 'prop', bevel: 0.7, spots: { rune: [1.5, 4.5, 20] } };
  };

  /* ========================================================= lm_brazier_huge
   * Great iron brazier on a stepped stone base, r 14, h 26, anims 4: a riveted bowl
   * roaring with blue-white fire (pal.g), sparks, snow on the steps, light on the snow. */
  M.lm_brazier_huge = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p), G = p.g || '#8ad8ff';
    const iron = '#262a32', ironT = '#4a5058', ironL = '#6e7680';
    const parts = [blueShadow(14, 9, 0.28, 1, 2), pool(17, 11, 0, 2, G, 0.3)];
    parts.push({ z0: 0, z1: 3.6, side: F.d, top: F.s, ao: 0.4, shape: (c) => S.poly(c, ngon(8, 9, Math.PI / 8)), detail: (c) => { S.lines(c, 'rgba(20,28,44,0.45)', 0.35, [-6, -3, -2, 1, 5, 2, 7, 5]); } });
    parts.push({ z0: 3.6, z1: 6.6, side: F.s, top: F.t, ao: 0.35, shape: (c) => S.poly(c, ngon(8, 6.4, Math.PI / 8)), detail: (c) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; S.lines(c, 'rgba(20,28,44,0.4)', 0.3, [Math.cos(a) * 3.2, Math.sin(a) * 3.2, Math.cos(a) * 6.2, Math.sin(a) * 6.2]); } } });
    parts.push(...snowCap((zt) => jag(9, 3.2 * (1 - zt * 0.5), 4, 0.4, 0, -5.4, -4.6, 1.2, 0.7), 3.5, 4.6));
    parts.push(...snowCap((zt) => jag(9, 2.6 * (1 - zt * 0.5), 6, 0.4, 0, 6, -5.2, 1.2, 0.7), 3.5, 4.4));
    parts.push(...snowCap((zt) => jag(9, 2.2 * (1 - zt * 0.5), 8, 0.4, 0, -3.6, 4.4, 1.2, 0.7), 6.5, 7.4));
    // iron stem with a collar, the flaring bowl, a riveted rim ring, legs
    parts.push({ z0: 6.6, z1: 13.5, side: iron, top: ironT, ao: 0.35, shape: (c, zt) => S.circ(c, 0, 0, 2.6 - zt * 0.6 + 0.9 * Math.max(0, 1 - zt * 5)) });
    parts.push({ z0: 9.6, z1: 10.6, side: iron, top: ironL, ao: 0.2, bevel: false, shape: (c) => S.poly(c, ngon(8, 2.9, 0)) });
    parts.push({ z0: 13.5, z1: 19, side: iron, top: '#1a1206', ao: 0.4, shape: (c, zt) => S.circ(c, 0, 0, 3 + Math.pow(zt, 0.7) * 6.6), detail: (c) => { S.dot(c, '#2e2010', 0, 0, 7.6); S.dot(c, '#5a3a14', 0.4, 0.4, 5.2); } });
    parts.push({ z0: 18.6, z1: 20, side: sh(iron, 0.1), top: ironL, stroke: 1.4, ao: 0.2, bevel: false, shape: (c) => S.circ(c, 0, 0, 9.4) });
    parts.push(beams([[-7.4, -5, 12, -8.8, -6, 7.4], [7.4, -5, 12, 8.8, -6, 7.4], [0, 8.8, 12, 0, 10.6, 7.4]], 1, iron, ironT, { ao: 0.2 }));
    // coals and fire
    parts.push({ z0: 19.2, z1: 19.8, side: sh(G, -0.3), top: mx(G, '#ffffff', 0.4), flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 7.2),
      detail: (c, a) => { const r = rng(5, frame4(a)); for (let i = 0; i < 12; i++) S.dot(c, r.next() < 0.5 ? '#ffffff' : sh(G, -0.4), r.range(-5, 5), r.range(-4, 4), r.range(0.3, 0.7)); } });
    parts.push(...fire(0, 0, 19.6, 11.5, 6.6, [sh(G, -0.25), G, mx(G, '#ffffff', 0.55), '#ffffff'], { ao: -0.2 }));
    parts.push(layer((pe, a) => {
      const r = rng(7, frame4(a));
      for (let i = 0; i < 9; i++) { const ph = (a + i / 9) % 1; pe.dot(al(i % 2 ? G : '#ffffff', 1 - ph), Math.sin(i * 2.1 + ph * 4) * 5 * (0.4 + ph), 0.4, 25 + ph * 12, r.range(0.2, 0.42)); }
      pe.glow(G, 0, 0, 24, 11, 0.32 + 0.1 * pulse(a));
      // rivets round the rim and the bowl, frost on the shaded iron, snow glittering below
      for (let i = 0; i < 9; i++) { const t = 0.2 + (i / 8) * 2.7; pe.dot(ironL, Math.cos(t) * 9.4, Math.sin(t) * 9.4 + 0.02, 19.6, 0.32); pe.dot(ironL, Math.cos(t) * 8.4, Math.sin(t) * 8.4 + 0.02, 17.2, 0.28); }
      pe.lines('rgba(220,236,250,0.35)', 0.4, [5.8, 7.2, 16.6, 7.6, 5.6, 18.2, 2.2, 1.8, 7.5, 2.1, 1.8, 12.5]);
      for (let i = 0; i < 10; i++) pe.dot('rgba(255,255,255,0.8)', r.range(-12, 12), r.range(2, 9), 0.2, r.range(0.15, 0.3));
    }));
    return { r: 14, h: 32, parts, style: 'prop', bevel: 0.6, spots: { fire: [0, 0, 22] } };
  };

  /* ============================================================ lm_frozen_ship
   * Longship frozen into the lake, r 60, h 40: hull listing to starboard in a plate of
   * cracked ice with pressure ridges, shields on the rail, snow on the thwarts, mast and
   * yard with a torn striped sail (pal.k / k2), dragon prow, oars locked in the ice. */
  M.lm_frozen_ship = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p);
    const K = p.k || '#3567b4', K2 = p.k2 || '#e2f1ff';
    const A = -0.8, UX = Math.cos(A), UY = Math.sin(A), VX = -Math.sin(A), VY = Math.cos(A), LEAN = 0.26;
    const W = (u, v, z) => [u * UX + (v + LEAN * (z || 0)) * VX, u * UY + (v + LEAN * (z || 0)) * VY];
    const U0 = -40, U1 = 44;
    const bw = (u) => 8.2 * Math.pow(Math.max(0, 1 - Math.pow((u - 2) / 43, 2)), 0.62) + 0.4;
    const hullK = (zt) => 0.5 + 0.5 * zt;
    const outline = (z) => { const pts = [], k = hullK(clamp(z / 9, 0, 1)); for (let u = U0; u <= U1; u += 3) { const q = W(u, -bw(u) * k, z); pts.push(q[0], q[1]); } for (let u = U1; u >= U0; u -= 3) { const q = W(u, bw(u) * k, z); pts.push(q[0], q[1]); } return pts; };
    const parts = [blueShadow(50, 34, 0.26, 2, 4)];
    // the ice plate with cracks, pressure ridges along the hull
    const plate = jag(18, 1, 5, 0.12, 0.2, 0, 0, 44, 32);
    parts.push({ z0: 0, z1: 1.2, side: '#8fb8d2', top: '#c0dff0', ao: 0.2, bevel: false, shape: (c) => smoothPoly(c, plate),
      detail: (c) => {
        const r = rng(3, 1);
        c.save(); c.beginPath(); smoothPoly(c, plate); c.clip();
        c.strokeStyle = 'rgba(40,70,110,0.45)'; c.lineWidth = 0.45;
        for (let i = 0; i < 9; i++) { const u = r.range(U0 + 6, U1 - 6), sg = r.next() < 0.5 ? -1 : 1; let q = W(u, sg * (bw(u) + 0.5), 0); c.beginPath(); c.moveTo(q[0], q[1]); let v = sg * (bw(u) + 0.5); for (let k = 0; k < 4; k++) { v += sg * r.range(3, 7); q = W(u + r.range(-4, 4), v, 0); c.lineTo(q[0], q[1]); } c.stroke(); }
        c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.6;
        for (let i = 0; i < 8; i++) { const x = r.range(-40, 40), y = r.range(-28, 28); c.beginPath(); c.moveTo(x, y); c.lineTo(x + r.range(-6, 6), y + r.range(-4, 4)); c.stroke(); }
        c.restore();
      } });
    const ridges = [];
    for (let i = 0; i < 9; i++) { const u = U0 + 6 + i * 9.5, sg = i % 2 ? 1 : -1, q = W(u, sg * (bw(u) + 2.6), 0); ridges.push({ x: q[0], y: q[1], r: 2.2 + (i % 3) * 0.6, h: 2.2 + (i % 3) * 0.8, seed: 40 + i, n: 6, rough: 0.4 }); }
    parts.push(rockPart(ridges, '#6a9cc8', '#d6ecfa', { ao: 0.3 }));
    parts.push(...rockFacets(ridges, '#e8f6ff', '#2f66a0'));
    // oars locked in the ice on the far side, the hull, gunwale and thwarts
    parts.push(beams([-20, -6, 10, 24].map((u) => { const a = W(u, -bw(u) * 0.95, 7.5), b = W(u - 4, -bw(u) - 10, 0.6); return [a[0], a[1], 7.5, b[0], b[1], 0.6]; }), 0.7, F.woodD, F.woodT, { ao: 0.2 }));
    parts.push({ z0: 0, z1: 9, side: F.woodD, top: F.wood, ao: 0.45, shape: (c, zt) => S.poly(c, outline(zt * 9)),
      detail: (c) => { c.save(); c.strokeStyle = 'rgba(20,14,10,0.5)'; c.lineWidth = 0.35; for (let v = -6; v <= 6; v += 2) { c.beginPath(); for (let u = U0 + 2; u <= U1 - 2; u += 4) { const k = bw(u); if (Math.abs(v) > k - 0.5) continue; const q = W(u, v, 9); if (u === U0 + 2 || Math.abs(v) > bw(u - 4) - 0.5) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]); } c.stroke(); } const q0 = W(U0, 0, 9), q1 = W(U1, 0, 9); c.strokeStyle = 'rgba(80,60,40,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(q0[0], q0[1]); c.lineTo(q1[0], q1[1]); c.stroke(); c.restore(); } });
    parts.push({ z0: 9, z1: 10.2, side: F.woodD, top: F.woodT, stroke: 1.1, ao: 0.2, bevel: false, shape: (c) => S.poly(c, outline(9)) });
    parts.push(beams([-30, -22, -14, -6, 2, 10, 18, 26].map((u) => { const a = W(u, -bw(u) + 0.6, 9.4), b = W(u, bw(u) - 0.6, 9.4); return [a[0], a[1], 9.4, b[0], b[1], 9.4]; }), 1.2, F.woodD, F.woodT, { ao: 0.15 }));
    for (const [u, rr] of [[-26, 3.6], [-10, 4.6], [6, 4.2], [20, 3.4], [34, 2.4]]) { const q = W(u, 0.3, 9.6); parts.push(...drift(q[0], q[1], rr, 1.6, 20 + u, 1.2, 0.8)); }
    // shields along the near rail: discs standing in the hull plane, alternating colours
    const shields = [];
    for (let i = 0; i < 9; i++) { const u = -28 + i * 6.6; shields.push({ u, v: bw(u) + 0.55, col: i % 2 ? K : K2 }); }
    for (const col of [K, K2]) parts.push({ z0: 7.2, z1: 12.4, side: sh(col, -0.15), top: sh(col, 0.2), ao: 0.15, bevel: false, shape: (c, zt) => { const z = 7.2 + zt * 5.2; for (const s of shields) { if (s.col !== col) continue; const hw = Math.sqrt(Math.max(0, 2.6 * 2.6 - (z - 9.8) * (z - 9.8))); if (hw < 0.2) continue; const a = W(s.u - hw, s.v, z), b = W(s.u + hw, s.v, z), d = W(s.u + hw, s.v + 0.7, z), e = W(s.u - hw, s.v + 0.7, z); S.poly(c, [a[0], a[1], b[0], b[1], d[0], d[1], e[0], e[1]]); } } });
    // prow: curved stem and a dragon head; stern post curling the other way
    const stemL = [[W(42, 0, 8), 8], [W(45.5, 0, 13), 13], [W(47.5, 0, 18), 18], [W(48, 0, 21), 21]];
    parts.push(limbPart([stemL.map((q) => [q[0][0], q[0][1], q[1]])], 2, F.woodD, F.woodT, { ao: 0.25 }));
    { const h = W(49.5, 0, 22); parts.push({ z0: 20.5, z1: 25.5, side: F.woodD, top: F.woodT, ao: 0.3, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt * 1.05, 0, 1)) * 0.6 + 0.4; S.poly(c, tf([-2.4 * k, -1.7 * k, 3.6 * k, -1.2 * k, 4.6 * k, 0, 3.6 * k, 1.2 * k, -2.4 * k, 1.7 * k], h[0], h[1], A)); } });
      const j = W(51, 0, 20.5), j2 = W(54.5, 0, 18.6); parts.push(beams([[j[0], j[1], 20.5, j2[0], j2[1], 18.6]], 1, F.woodD, F.woodT, { ao: 0.2 }));
      const hn = W(48, 0, 24.5); parts.push(limbPart([[-1, 1].map((sg) => { const a = W(47.5, sg * 1.2, 24.5), b = W(44.5, sg * 2.4, 27.5); return [[a[0], a[1], 24.5], [b[0], b[1], 27.5]]; })[0], [-1, 1].map((sg) => { const a = W(47.5, sg * 1.2, 24.5), b = W(44.5, sg * 2.4, 27.5); return [[a[0], a[1], 24.5], [b[0], b[1], 27.5]]; })[1]], 0.8, F.woodD, F.woodT, { ao: 0.2 })); parts.push({ z0: 23.2, z1: 23.9, side: '#ffd060', top: '#ffd060', flat: true, bevel: false, shape: (c) => { const e = W(50.4, 1.6, 23.5); S.circ(c, e[0], e[1], 0.42); } }); void hn; }
    parts.push(limbPart([[[...W(-38, 0, 8), 8], [...W(-41.5, 0, 12), 12], [...W(-43, 0, 16), 16], [...W(-42, 0, 18.5), 18.5]]], 1.8, F.woodD, F.woodT, { ao: 0.25 }));
    // mast, yard, rigging and the torn sail
    const MU = -4, mb = W(MU, 0, 9), mt = W(MU, 0, 40);
    parts.push(beams([[mb[0], mb[1], 9, mt[0], mt[1], 40]], 1.5, F.woodD, F.woodT, { ao: 0.2 }));
    { const a = W(MU, -15, 34.5), b = W(MU, 15, 34.5); parts.push(beams([[a[0], a[1], 34.5, b[0], b[1], 34.5]], 0.9, F.woodD, F.woodT, { ao: 0.2 })); parts.push({ z0: 34.9, z1: 35.5, side: '#eef4fb', top: '#ffffff', flat: true, bevel: false, shape: (c) => { const a2 = W(MU, -14, 35), b2 = W(MU, 14, 35), d = W(MU + 0.9, 14, 35), e = W(MU + 0.9, -14, 35); S.poly(c, [a2[0], a2[1], b2[0], b2[1], d[0], d[1], e[0], e[1]]); } }); }
    { const t = W(MU, 0, 39.5), pr = W(44, 0, 10), st = W(-38, 0, 10); parts.push(beams([[t[0], t[1], 39.5, pr[0], pr[1], 10], [t[0], t[1], 39.5, st[0], st[1], 10]], 0.3, '#2a2420', '#8a7a66', { ao: 0 })); }
    const sailO = W(MU - 1.2, LEAN * 24, 0);
    const sail = [[-13, 34.2, 13, 34.2, 13, 27, 11.5, 22, 12.5, 17, 9, 19, 7, 13.5, 4.5, 20, 1, 15, -2, 21, -5, 17, -7.5, 23, -10, 19, -13, 25], [3, 30, 6, 27, 4, 24.5, 1.5, 27.5], [-9, 29, -6, 31.5, -5, 28.5]];
    parts.push(xzPart(sail, 13, 34.4, '#9aa6b4', '#dde6ee', { ox: sailO[0], oy: sailO[1], a: A + Math.PI / 2, v0: -0.3, v1: 0.3 }, { ao: 0.25, bevel: false }));
    parts.push(layer((pe) => {
      const r = rng(11, 4), c = pe.c;
      // strakes along the near side of the hull, frost rime and snow on the rail
      for (const z of [1.6, 3.6, 5.6, 7.6]) { const k = hullK(z / 9), s = []; let prev = null; for (let u = U0 + 1; u <= U1 - 1; u += 2.5) { const q = W(u, bw(u) * k + 0.03, z); if (prev) s.push(prev[0], prev[1], z, q[0], q[1], z); prev = q; } pe.lines('rgba(14,10,8,0.5)', 0.35, s); }
      for (let i = 0; i < 26; i++) { const u = r.range(U0 + 2, U1 - 2), z = r.range(0.5, 4), q = W(u, bw(u) * hullK(z / 9) + 0.05, z); pe.dot('rgba(230,240,250,0.7)', q[0], q[1], z, r.range(0.25, 0.6)); }
      // shield bosses and rims
      for (const s of shields) { const q = W(s.u, s.v + 0.75, 9.8); pe.dot('#8a8f98', q[0], q[1], 9.8, 0.6); c.beginPath(); c.arc(q[0], q[1] - 9.8, 2.45, 0, TAU); c.strokeStyle = 'rgba(30,30,36,0.7)'; c.lineWidth = 0.35; c.stroke(); }
      // the sail: vertical stripes in the faction colours, shading on the folds, tears outlined
      const sa = A + Math.PI / 2, ca = Math.cos(sa), sn = Math.sin(sa), nv = [ -Math.sin(sa) * 0.32, Math.cos(sa) * 0.32 ];
      const sp = (u, z) => [sailO[0] + u * ca + nv[0], sailO[1] + u * sn + nv[1], z];
      c.save(); c.beginPath(); pe.path(sail[0].flatMap((v, i, arr) => i % 2 ? [] : sp(arr[i], arr[i + 1]))); for (let h = 1; h < sail.length; h++) { const hp = sail[h]; c.moveTo(sp(hp[0], hp[1])[0], sp(hp[0], hp[1])[1] - hp[1]); for (let k = 2; k < hp.length; k += 2) { const q = sp(hp[k], hp[k + 1]); c.lineTo(q[0], q[1] - hp[k + 1]); } c.closePath(); } c.clip('evenodd');
      for (let i = -3; i < 3; i++) { const u0 = i * 4.4, u1 = u0 + 4.4; pe.poly(i % 2 ? K2 : K, [...sp(u0, 35), ...sp(u1, 35), ...sp(u1, 12), ...sp(u0, 12)]); }
      for (let i = 0; i < 6; i++) { const u = -12 + i * 4.6; pe.poly(i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(10,20,40,0.18)', [...sp(u, 35), ...sp(u + 4.6, 35), ...sp(u + 4.6, 12), ...sp(u, 12)]); }
      c.restore();
      pe.lines('rgba(20,28,44,0.6)', 0.4, [...sp(13, 27), ...sp(11.5, 22), ...sp(11.5, 22), ...sp(12.5, 17), ...sp(7, 13.5), ...sp(4.5, 20), ...sp(1, 15), ...sp(-2, 21)]);
      // the dragon head's eye glint, frost on the stem, snow on the prow
      const e = W(50.4, 1.65, 23.6); pe.dot('#1a1008', e[0], e[1], 23.6, 0.18);
      const pz = W(48.4, 0, 25.5); pe.ell('#ffffff', pz[0], pz[1], 25.6, 2.2, 1.2);
    }));
    return { r: 60, h: 41, parts, style: 'prop', bevel: 0.7, spots: { mast: [mt[0], mt[1], 40], prow: [...W(48, 0, 22), 22] } };
  };

  /* ========================================================= lm_ice_formation
   * Clustered ice spires, opt.v 0-2: 0 three leaning shards (r 16, h 30), 1 a fan of
   * five (r 22, h 40), 2 a crown of seven (r 28, h 50). Faceted translucent ice with a
   * bright core, lit arrises, blue shade, a snow apron and a faint glow on the snow. */
  M.lm_ice_formation = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p), v = (((opt.v | 0) % 3) + 3) % 3, G = p.g || '#8ad8ff';
    const R = [16, 22, 28][v], H = [30, 40, 50][v], n = [3, 5, 7][v], rg = rng(121 + v * 17, 1);
    const sh_ = [], a0 = rg.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const main = i === 0, a = a0 + (i / n) * TAU + rg.range(-0.35, 0.35), d = main ? 0.8 : R * rg.range(0.3, 0.6);
      const L = (main ? R * 0.34 : R * rg.range(0.16, 0.28)), Wd = L * rg.range(0.55, 0.75), ang = rg.range(0, Math.PI);
      const bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.78, h = main ? H : H * rg.range(0.35, 0.72);
      const out = Math.hypot(bx, by) || 1, lk = h * rg.range(0.12, 0.3);
      sh_.push({ base: shardBase(L, Wd, ang), bx, by, h, lean: [(bx / out) * lk + (main ? 1.5 : 0), (by / out) * lk - (main ? h * 0.06 : 0)] });
    }
    sh_.sort((a, b) => a.by - b.by);
    const parts = [blueShadow(R * 1.05, R * 0.7, 0.3, R * 0.1, R * 0.12), pool(R * 1.2, R * 0.8, 0, R * 0.1, G, 0.22)];
    parts.push(...snowCap((zt) => jag(13, R * 0.85 * (1 - zt * zt * 0.5), 3 + v, 0.45, 0, 0, R * 0.15, 1.15, 0.78), 0, 1.6));
    iceSpires(parts, sh_, F);
    parts.push(layer((pe) => {
      const r = rng(7 + v, 2);
      // sparkle on the lit faces, snow caught on ledges, drift shadow lines
      for (const s of sh_) { for (let i = 0; i < 5; i++) { const z = s.h * r.range(0.2, 0.85), u = z / s.h, k = 0.1 + 0.9 * Math.pow(1 - u, 0.8); pe.dot('rgba(255,255,255,0.85)', s.bx + s.lean[0] * u + r.range(-1, 0.2) * k * 2.5, s.by + s.lean[1] * u + 2.4 * k + 0.1, z, r.range(0.2, 0.45)); } pe.glow('#ffffff', s.bx + s.lean[0] * 0.5, s.by + s.lean[1] * 0.5, s.h * 0.5, 2.5, 0.25); }
      for (let i = 0; i < 10; i++) pe.dot('rgba(255,255,255,0.9)', r.range(-R, R), R * 0.15 + r.range(-R * 0.6, R * 0.6), 0.3, r.range(0.15, 0.32));
    }));
    return { r: R + 3, h: H + 2, parts, style: 'prop', bevel: 0.6, spots: { tip: [sh_[0].bx + sh_[0].lean[0], sh_[0].by + sh_[0].lean[1], H] } };
  };

  /* ======================================================== lm_longhouse_ruin
   * Collapsed longhouse, r 34, h 16: stone footings under snow, charred posts, a
   * surviving snow-laden roof section with crossed gable boards at the west end, fallen
   * rafters, drifts inside, the carved doorway still standing. */
  M.lm_longhouse_ruin = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p);
    const X0 = -22, X1 = 22, Y0 = -9, Y1 = 9;
    const parts = [blueShadow(34, 22, 0.26, 0, 3)];
    parts.push({ z0: 0, z1: 0.5, side: '#3e3a3a', top: '#5e5856', ao: 0.1, bevel: false, shape: (c) => c.rect(X0 + 1, Y0 + 1, X1 - X0 - 2, Y1 - Y0 - 2), detail: (c) => { const r = rng(2, 1); for (let i = 0; i < 24; i++) S.dot(c, r.next() < 0.5 ? 'rgba(30,26,24,0.5)' : 'rgba(200,210,220,0.3)', r.range(X0 + 1, X1 - 1), r.range(Y0 + 1, Y1 - 1), r.range(0.6, 1.6)); } });
    const hs = [4.2, 3.6, 4.4, 2.6, 3.8, 4, 1.4, 3.2, 2.4, 4.2, 1.6, 0.6, 3.4, 4.4, 2.8, 2.2, 1.8, 3.6, 4.2, 3];
    const segs = wallRun([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, Y0]], 7, { H: 5, hs, seg: 4.4, noCren: true });
    for (const q of segs) { q.cren = false; if (Math.abs(q.y0 - Y1) < 0.1 && Math.abs(q.y1 - Y1) < 0.1 && Math.abs((q.x0 + q.x1) / 2) < 3) { q.h = 0.6; q.door = true; } }
    parts.push(wallPart(segs, 2.4, F.s, F.t, { brk: 1.4 }));
    parts.push(...snowOnSegs(segs, 2.4, 0.9));
    // surviving roof over the west third: two snow planes on a ridge, ragged east edge
    const RX0 = X0 + 0.5, RX1 = -6, RZ = 4.6, RH = 10.5;
    const edge = (zt) => RX1 - zt * 3 + Math.sin(zt * 9) * 0.8;
    parts.push({ z0: RZ, z1: RZ + RH, side: '#f4f8fc', top: '#ffffff', flat: true, ao: 0.08, bevel: false, shape: (c, zt) => { const w = (Y1 + 1.2) * (1 - zt); c.rect(RX0 - 1, -w, edge(zt) - RX0 + 1, w + 0.05); } });
    parts.push({ z0: RZ, z1: RZ + RH, side: '#c8d8ea', top: '#e2ecf6', flat: true, ao: 0.1, bevel: false, shape: (c, zt) => { const w = (Y1 + 1.2) * (1 - zt); c.rect(RX0 - 1, -0.05, edge(zt) - RX0 + 1, w + 0.05); } });
    parts.push(beams([[RX0 - 1.4, 0, RZ + RH + 0.3, RX1 - 1.5, 0, RZ + RH + 0.3]], 1.1, F.woodD, F.woodT, { ao: 0.2 }));
    parts.push(xzPart([barUZ(-Y1 - 1.6, RZ + 0.4, 0, RZ + RH + 2.8, 1.1), barUZ(Y1 + 1.6, RZ + 0.4, 0, RZ + RH + 2.8, 1.1), barUZ(-Y1 - 0.6, RZ + 0.5, Y1 + 0.6, RZ + 0.5, 0.9), barUZ(0, RZ + 0.5, 0, RZ + RH, 0.8)], RZ, RZ + RH + 3, F.woodD, F.woodT, { ox: RX0 - 0.6, a: Math.PI / 2, v0: -0.5, v1: 0.5 }, { ao: 0.25, bevel: false }));
    // standing posts, fallen rafters, the doorway posts and lintel
    parts.push(beams([[X1 - 0.6, Y0 + 0.6, 0, X1 - 0.8, Y0 + 0.8, 9], [X1 - 0.6, Y1 - 0.6, 0, X1 - 0.8, Y1 - 0.8, 6.4], [6, Y0 + 0.6, 0, 5.8, Y0 + 0.8, 10.5], [6, Y1 - 0.6, 0, 6.2, Y1 - 0.8, 5], [-3, 0, 0, -3, 0.3, 11], [13, 0, 0, 13.2, 0.2, 7]], 1.2, F.woodD, F.woodT, { ao: 0.3 }));
    parts.push(beams([[1, Y0 + 1, 4.5, 4, 2, 0.8], [10, Y1 - 1, 4.2, 9, -3, 0.9], [16, Y0 + 1, 4.4, 20, 5, 0.8], [-3, 0.3, 11, 5.6, Y0 + 1, 4.6], [-3, 0.3, 11, 2, Y1 - 1.2, 4.4], [13.2, 0.2, 7, 19, Y1 - 1, 4.2]], 0.9, F.woodD, F.woodT, { ao: 0.3 }));
    parts.push(beams([[-3.2, Y1 + 0.2, 0, -3.2, Y1 + 0.2, 7.2], [3.2, Y1 + 0.2, 0, 3.2, Y1 + 0.2, 7.2], [-3.8, Y1 + 0.2, 7.2, 3.8, Y1 + 0.2, 7.2]], 1.3, F.woodD, F.woodT, { ao: 0.25 }));
    // drifts inside and against the walls, a cauldron, a barrel, a broken bench
    parts.push(...drift(-14, 2, 6, 2.6, 11, 1.3, 0.7)); parts.push(...drift(3, -3, 5, 2.2, 12, 1.2, 0.8)); parts.push(...drift(15, 3, 6.5, 2.8, 13, 1.1, 0.7)); parts.push(...drift(X1 + 4, -2, 5, 2, 14, 0.8, 1.2)); parts.push(...drift(-10, Y1 + 4, 7, 2.2, 15, 1.4, 0.6));
    parts.push(cyl(9, 1, 2, 0.4, 3.2, '#262a30', '#484e56', { ao: 0.35, detail: (c) => { S.dot(c, '#15161a', 9, 1, 1.4); S.dot(c, '#f4f8fc', 8.4, 0.5, 0.9); } }));
    parts.push(cyl(18, -5, 1.7, 0.4, 4.4, mx(p.w, '#a08060', 0.5), mx(p.w, '#c8a078', 0.5), { ao: 0.35, detail: (c) => { c.save(); c.strokeStyle = 'rgba(40,30,20,0.5)'; c.lineWidth = 0.3; c.beginPath(); c.arc(18, -5, 1.3, 0, TAU); c.stroke(); c.restore(); } }));
    parts.push(plank(-6, 5.5, 7, 1.6, 0.2, 1.2, 2, F.woodD, F.woodT));
    parts.push(layer((pe) => {
      const r = rng(5, 3);
      // stone courses on the south footing, carved doorway posts, snow sparkle, icicles under the eave
      for (const q of segs) { if (Math.abs(q.y1 - q.y0) > 0.5 || q.y0 < 0 || q.h < 1.5) continue; stones(pe, Math.min(q.x0, q.x1), Math.max(q.x0, q.x1), Y1 + 1.22, 0.2, q.h - 1.4, (q.x0 | 0) + 3, { row: 1.4, w: 1.2, joint: 'rgba(20,28,44,0.4)', light: 'rgba(220,235,250,0.14)', dark: 'rgba(20,28,44,0.14)' }); }
      for (const x of [-3.2, 3.2]) { for (let z = 1; z < 6.5; z += 1.4) pe.lines('rgba(240,246,252,0.5)', 0.3, [x - 0.4, Y1 + 0.86, z, x + 0.4, Y1 + 0.86, z + 0.7, x + 0.4, Y1 + 0.86, z, x - 0.4, Y1 + 0.86, z + 0.7]); }
      pe.poly('rgba(240,246,252,0.7)', [-3.8, Y1 + 0.86, 7.5, 3.8, Y1 + 0.86, 7.5, 3.8, Y1 + 0.86, 7.9, -3.8, Y1 + 0.86, 7.9]);
      for (let i = 0; i < 7; i++) { const x = RX0 + 1 + i * 2.2; pe.poly('#cfe6f6', [x - 0.35, Y1 + 1.25, RZ + 0.2, x + 0.35, Y1 + 1.25, RZ + 0.2, x, Y1 + 1.25, RZ - r.range(1.2, 2.6)]); }
      pe.lines('rgba(20,28,44,0.4)', 0.45, [RX0 - 1, Y1 + 1.25, RZ + 0.2, RX1 - 1, Y1 + 1.25, RZ + 0.2]);
      for (let i = 0; i < 22; i++) pe.dot('rgba(255,255,255,0.85)', r.range(X0 - 4, X1 + 6), r.range(Y0 - 2, Y1 + 8), 0.3, r.range(0.15, 0.3));
      // soot on the standing posts, wood grain on the roof gable boards
      pe.lines('rgba(10,8,8,0.45)', 0.5, [6, Y0 + 1.5, 0.5, 5.9, Y0 + 1.5, 6, -3, 0.9, 0.4, -3, 1, 7]);
    }));
    return { r: 34, h: 19, parts, style: 'prop', bevel: 0.7, spots: { door: [0, Y1 + 1, 0], ridge: [RX0 + 4, 0, RZ + RH] } };
  };

  /* ====================================================== lm_frozen_travellers
   * A sad little scene, r 20: an overturned sled with its runners in the air, three
   * frozen figures huddled round a dead fire, a spear with a stiff pennant planted in
   * the snow, a pack and a crate, drifts over everything. h 13. */
  M.lm_frozen_travellers = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p), K = p.k || '#3567b4';
    const cloak = '#363a4a', cloakT = '#8c96aa', skin = '#aebcd0';
    const parts = [blueShadow(20, 13, 0.3, 0, 2)];
    // the sled upside down at the west: deck plank, struts, two runners curling up at the front
    const SX = -11, SY = -3;
    parts.push(box(SX, SY, 10, 5.2, 0, 1, F.woodD, F.wood, { ao: 0.3, detail: (c) => S.lines(c, 'rgba(20,14,10,0.5)', 0.3, [SX - 4.8, SY - 1, SX + 4.8, SY - 1, SX - 4.8, SY + 1, SX + 4.8, SY + 1]) }));
    parts.push(beams([[SX - 3.5, SY - 2.3, 1, SX - 3.5, SY - 2.3, 3.8], [SX + 3.5, SY - 2.3, 1, SX + 3.5, SY - 2.3, 3.8], [SX - 3.5, SY + 2.3, 1, SX - 3.5, SY + 2.3, 3.8], [SX + 3.5, SY + 2.3, 1, SX + 3.5, SY + 2.3, 3.8]], 0.6, F.woodD, F.woodT, { ao: 0.2 }));
    for (const sg of [-1, 1]) parts.push(limbPart([[[SX - 5.5, SY + sg * 2.3, 3.8], [SX + 4.2, SY + sg * 2.3, 3.9], [SX + 6.4, SY + sg * 2.3, 5.6], [SX + 7.2, SY + sg * 2.3, 7.2]]], 0.8, F.woodD, F.woodT, { ao: 0.2 }));
    parts.push(box(SX - 2, SY + 6, 3.4, 3, 0, 2.8, F.woodD, F.wood, { ao: 0.3, detail: (c) => S.lines(c, 'rgba(20,14,10,0.5)', 0.35, [SX - 3.7, SY + 6, SX - 0.3, SY + 6, SX - 2, SY + 4.5, SX - 2, SY + 7.5]) }));
    parts.push({ z0: 0, z1: 2.6, side: '#5a4634', top: '#8a7058', ao: 0.4, shape: (c, zt) => S.blob(c, SX + 6, SY + 6.5, 2.2 * (1 - zt * zt * 0.5), 3, 8, 0.2) });
    // the dead fire and the three figures huddled round it
    const FX = 4, FY = 4;
    parts.push({ z0: 0, z1: 0.8, side: '#3a3836', top: '#6a6866', ao: 0.1, bevel: false, shape: (c) => S.ell(c, FX, FY, 2.4, 1.8, 0), detail: (c) => { S.dot(c, '#2a2826', FX - 0.5, FY - 0.3, 0.8); S.lines(c, '#1e1a18', 0.6, [FX - 2, FY + 0.5, FX + 1.8, FY - 0.6, FX - 1.4, FY - 1, FX + 1.2, FY + 1]); } });
    const figs = [[FX - 5, FY - 1.5, 0.5], [FX + 5.2, FY - 1, -0.5], [FX + 0.6, FY + 5.2, Math.PI]];
    for (const f of figs) {
      const fx = Math.sin(f[2]) * 0.9, fy = Math.cos(f[2]) * 0.9; // facing the fire: lean of the head
      parts.push({ z0: 0, z1: 5.4, side: cloak, top: cloakT, ao: 0.45, shape: (c, zt) => { const k = 1 - zt * zt * 0.45; S.ell(c, f[0] + fx * zt * 0.6, f[1] + fy * zt * 0.6, 2.3 * k, 1.9 * k, f[2]); } });
      parts.push({ z0: 5, z1: 7.4, side: cloak, top: cloakT, ao: 0.3, bevel: false, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt * 1.05, 0, 1)) * 0.75 + 0.25; S.circ(c, f[0] + fx * 1.2, f[1] + fy * 1.2, 1.25 * k); } });
    }
    // spear with a frozen pennant, drifts over the figures' backs and the sled
    parts.push(beams([[13, -4, 0, 13.6, -4.6, 13]], 0.5, F.woodD, F.woodT, { ao: 0.1 }));
    parts.push({ z0: 12.6, z1: 15, side: '#7a7c80', top: '#c8ccd0', ao: 0.1, bevel: false, shape: (c, zt) => S.ell(c, 13.6, -4.6, 0.7 * (1 - zt * 0.85) + 0.08, 0.35, 0) });
    parts.push(...drift(FX - 7, FY - 3.6, 3.6, 1.6, 21, 1.1, 0.7)); parts.push(...drift(FX + 7.5, FY - 3.4, 3.2, 1.5, 22, 1.1, 0.7)); parts.push(...drift(SX - 5, SY - 4, 4.4, 1.8, 23, 1.2, 0.7)); parts.push(...drift(SX + 2, SY + 10, 5, 1.5, 24, 1.3, 0.6)); parts.push(...drift(14, 3, 4, 1.4, 25, 1.1, 0.7));
    parts.push(layer((pe) => {
      const r = rng(3, 2);
      // the pennant, stiff with ice; faces under the hoods; frost on the shoulders; shadow on the fire pit
      pe.poly(K, [13.5, -4.1, 12.2, 17.6, -3.6, 11.4, 17, -3.8, 10.2, 13.5, -4.1, 9.6]);
      pe.lines('rgba(220,236,250,0.6)', 0.3, [13.5, -4.1, 12.2, 17.6, -3.6, 11.4]);
      for (const f of figs) {
        const fx = Math.sin(f[2]) * 0.9, fy = Math.cos(f[2]) * 0.9, hx = f[0] + fx * 1.2, hy = f[1] + fy * 1.2 + 1.2;
        if (fy >= -0.2) { pe.ell(skin, hx, hy, 5.9, 0.75, 0.6); pe.dot('#262a36', hx - 0.3, hy, 6, 0.16); pe.dot('#262a36', hx + 0.3, hy, 6, 0.16); }
        pe.ell('rgba(20,24,40,0.45)', hx, hy, 6.9, 1.1, 0.5);
        for (let i = 0; i < 6; i++) pe.dot('rgba(255,255,255,0.8)', f[0] + r.range(-1.8, 1.8), f[1] + r.range(-1.2, 1.2), 4.6 + r.range(0, 1), r.range(0.2, 0.42));
        pe.lines('rgba(20,24,40,0.35)', 0.4, [f[0] - 1.2, f[1] + 1.9, 1, f[0] - 0.8, f[1] + 1.95, 4, f[0] + 1, f[1] + 1.9, 1, f[0] + 0.8, f[1] + 1.95, 4.2]);
      }
      pe.glow('#5a7898', FX, FY, 0.5, 4, 0.2);
      for (let i = 0; i < 20; i++) pe.dot('rgba(255,255,255,0.9)', r.range(-19, 19), r.range(-12, 12), 0.3, r.range(0.15, 0.3));
      // the sled's runner bindings and a dropped mitten
      pe.lines('rgba(220,236,250,0.5)', 0.3, [SX - 3.5, SY + 2.7, 1.2, SX - 3.5, SY + 2.7, 3.6, SX + 3.5, SY + 2.7, 1.2, SX + 3.5, SY + 2.7, 3.6]);
      pe.ell('#8a3a3a', 1, 10, 0.3, 1, 0.6, 0.4); pe.ell('#8a3a3a', 1.8, 10.3, 0.5, 0.5, 0.4);
    }));
    return { r: 20, h: 15, parts, style: 'prop', bevel: 0.6, spots: { fire: [FX, FY, 0.5] } };
  };

  /* ============================================================= lm_totem_ice
   * Carved totem pole, r 6, h 32: bear, wolf and raven faces stacked on a dark timber
   * post, painted bands in the faction blue and white, the raven's wings spread at the
   * top, snow on every ledge. */
  M.lm_totem_ice = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p), K = p.k || '#3567b4';
    const wS = F.woodD, wT = F.wood, rS = '#5a2a1e', rT = '#8a4a34';
    const parts = [blueShadow(6, 4, 0.3, 0.5, 1)];
    parts.push(...drift(0, 0.6, 4.2, 1.4, 31, 1.2, 0.8));
    parts.push({ z0: 0, z1: 30, side: wS, top: wT, ao: 0.4, shape: (c, zt) => S.circ(c, 0, 0, 2.3 - zt * 0.25 + 0.6 * Math.max(0, 1 - zt * 12)) });
    // snouts and ears / brows of the three faces
    const faces = [[3, 'bear'], [12, 'wolf'], [21, 'raven']];
    parts.push({ z0: 3, z1: 30, side: wS, top: wT, ao: 0.3, bevel: false, shape: (c, zt) => {
      const z = 3 + zt * 27;
      for (const f of faces) {
        const z0 = f[0], kind = f[1];
        if (z >= z0 + 1.6 && z <= z0 + 4.4) { const L = kind === 'raven' ? 3.2 : kind === 'wolf' ? 2.6 : 2; const k = kind === 'raven' ? 1 - (z - z0 - 1.6) / 2.8 * 0.7 : 1; S.poly(c, [-1.3 * k, 1.8, 1.3 * k, 1.8, 0.9 * k, 1.8 + L * k, -0.9 * k, 1.8 + L * k]); }
        if (z >= z0 + 6.4 && z <= z0 + 8.4 && kind !== 'raven') { const k = 1 - (z - z0 - 6.4) / 2 * 0.5; S.ell(c, -2.2, 0.6, 0.9 * k, 0.7 * k, 0); S.ell(c, 2.2, 0.6, 0.9 * k, 0.7 * k, 0); }
      }
    } });
    // the raven's wings and beak at the top
    parts.push({ z0: 24.5, z1: 28.5, side: wS, top: wT, ao: 0.25, shape: (c, zt) => { const k = 1 - Math.abs(zt - 0.4) * 0.6; S.poly(c, [-2, -0.4, -5.6 * k, -1.2, -5.8 * k, 0.6, -2, 1.2]); S.poly(c, [2, -0.4, 5.6 * k, -1.2, 5.8 * k, 0.6, 2, 1.2]); } });
    parts.push({ z0: 30, z1: 32, side: wS, top: wT, ao: 0.2, bevel: false, shape: (c, zt) => S.circ(c, 0, 0, 2 * Math.sqrt(Math.max(0.05, 1 - zt * zt))) });
    parts.push(...snowCap((zt) => jag(7, 1.9 * (1 - zt * 0.4), 2, 0.4, 0, 0, -0.3, 1.1, 0.8), 31.4, 32.6));
    parts.push(...snowCap((zt) => jag(7, 1.6 * (1 - zt * 0.4), 4, 0.4, 0, -3.8, -0.4, 1.3, 0.6), 28.3, 29.1));
    parts.push(...snowCap((zt) => jag(7, 1.6 * (1 - zt * 0.4), 6, 0.4, 0, 3.8, -0.4, 1.3, 0.6), 28.3, 29.1));
    parts.push(layer((pe) => {
      const y = 2.32, r = rng(9, 1);
      // painted bands between the faces, carved grooves, eyes and teeth
      for (const z of [10.6, 19.6]) { pe.wall(K, -2.1, 2.1, y, z, z + 1.1); pe.wall('#eef4fb', -2.1, 2.1, y + 0.01, z - 0.5, z); pe.wall(rT, -2.1, 2.1, y + 0.01, z + 1.1, z + 1.5); }
      for (const f of faces) {
        const z0 = f[0], kind = f[1];
        for (const sg of [-1, 1]) { pe.ell('#f4f8fc', sg * 1.1, y, z0 + 5.4, 0.62, 0.48); pe.dot('#141820', sg * 1.1 + 0.12, y, z0 + 5.35, 0.27); pe.lines('rgba(20,14,10,0.7)', 0.3, [sg * 0.4, y, z0 + 6.3, sg * 1.8, y, z0 + 6.1]); }
        if (kind !== 'raven') { pe.dot('#141820', 0, y + 2.2, z0 + 3.9, 0.4); pe.lines('rgba(20,14,10,0.7)', 0.3, [-1.1, y + 1.8, z0 + 2.4, 1.1, y + 1.8, z0 + 2.4]); for (let k = -1; k <= 1; k++) pe.poly('#f4f8fc', [k * 0.6 - 0.22, y + 1.82, z0 + 2.4, k * 0.6 + 0.22, y + 1.82, z0 + 2.4, k * 0.6, y + 1.82, z0 + 1.7]); }
        else { pe.lines('rgba(20,14,10,0.6)', 0.3, [-0.9, y + 2.2, z0 + 3, 0.9, y + 2.2, z0 + 3]); }
        pe.lines('rgba(20,14,10,0.55)', 0.3, [-2, y, z0 + 0.6, 2, y, z0 + 0.6, -1.6, y, z0 + 7.6, 1.6, y, z0 + 7.6]);
        if (kind === 'bear') pe.lines(rT, 0.45, [-1.4, y, z0 + 4.6, -0.6, y, z0 + 5, 0.6, y, z0 + 5, 1.4, y, z0 + 4.6]);
        if (kind === 'wolf') { pe.lines(K, 0.5, [-1.6, y, z0 + 4.4, -0.4, y, z0 + 5.6, 0.4, y, z0 + 5.6, 1.6, y, z0 + 4.4]); }
      }
      // wing feathers and the raven's beak line
      for (const sg of [-1, 1]) for (let i = 0; i < 4; i++) pe.lines('rgba(20,14,10,0.6)', 0.3, [sg * (2.4 + i * 0.8), 0.9, 24.8, sg * (2.8 + i * 0.8), 0.9, 27.6]);
      pe.lines(rT, 0.5, [-1.8, 0.95, 26.2, 1.8, 0.95, 26.2]);
      pe.lines('rgba(20,14,10,0.5)', 0.35, [0, y + 3, 22.8, 0, y + 1.9, 24.9]);
      for (let i = 0; i < 6; i++) pe.dot('rgba(255,255,255,0.85)', r.range(-2, 2), y - 0.1, r.range(3, 28), r.range(0.15, 0.3));
      pe.lines('rgba(20,14,10,0.4)', 0.35, [-1.5, y, 1, -1.4, y, 10, 1.4, y, 12, 1.5, y, 19]);
    }));
    return { r: 6.5, h: 33, parts, style: 'prop', bevel: 0.6, spots: { top: [0, 0, 32] } };
  };

  /* ======================================================= lm_frozen_waterfall
   * Frozen fall, r 36, h 44: a dark cliff of blue-grey rock with a sheet of ice
   * columns pouring down its face, a bulging lip and icicles at the top, a cracked
   * plunge pool below with ice boulders and drifts. */
  M.lm_frozen_waterfall = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), F = frostOf(p), G = p.g || '#8ad8ff';
    const parts = [blueShadow(36, 24, 0.3, 0, 6)];
    const cliff = [
      { x: -24, y: -12, r: 12, h: 30, seed: 101, n: 11, sx: 1.1, sy: 0.9 }, { x: 24, y: -11, r: 12, h: 28, seed: 102, n: 11, sx: 1.1, sy: 0.9 },
      { x: 0, y: -14, r: 17, h: 40, seed: 103, n: 13, sx: 1.25, sy: 0.9, top: 0.5, pw: 4 },
      { x: -33, y: 0, r: 6, h: 9, seed: 104 }, { x: 33, y: 1, r: 6, h: 8, seed: 105 },
    ];
    parts.push(rockPart(cliff, mx(F.s, '#3a4658', 0.5), mx(F.t, '#8290a2', 0.4)));
    parts.push(...rockFacets(cliff, mx(F.t, '#aab6c6', 0.4), F.d));
    parts.push({ z0: 26, z1: 42, side: '#eef4fb', top: '#ffffff', flat: true, ao: 0.05, bevel: false, shape: (c, zt) => { const z = 26 + zt * 16; for (const R of cliff) { if (z < R.h - 0.5 || z > R.h + 1.2) continue; smoothPoly(c, xf(rockSect(R, R.h - 0.4), 0.9, 0.9, R.x, R.y, 0, 0)); } } });
    // the fall: a sheet of lumpy ice columns on the central face, a bright core inside each
    const main = cliff[2];
    const yF = (z) => { const s = rockSect(main, Math.min(z, main.h - 0.1)); let m = -1e9; for (let i = 1; i < s.length; i += 2) m = Math.max(m, s[i]); return m; };
    const cols = [[-9.5, 2.4], [-4.6, 2.9], [0.4, 3.2], [5.2, 2.7], [9.6, 2.2]];
    parts.push({ z0: 1, z1: 39.5, side: '#5a92c4', top: '#d8f0ff', ao: 0.3, shape: (c, zt) => { const z = 1 + zt * 38.5, y = yF(z) + 1.2; for (const q of cols) { const rr = q[1] * (0.85 + 0.15 * Math.sin(z * 0.7 + q[0])) * (z < 5 ? 1.25 : 1); S.ell(c, q[0] + Math.sin(z * 0.25 + q[0]) * 0.4, y, rr, rr * 0.75, 0); } } });
    parts.push({ z0: 3, z1: 36, side: mx(F.ice, '#ffffff', 0.4), top: '#ffffff', flat: true, ao: 0, bevel: false, shape: (c, zt) => { const z = 3 + zt * 33, y = yF(z) + 1.2; for (const q of cols) { if (Math.sin(z * 0.5 + q[0] * 2) < -0.3) continue; S.ell(c, q[0] + Math.sin(z * 0.25 + q[0]) * 0.4 - 0.5, y - 0.2, q[1] * 0.3, q[1] * 0.25, 0); } } });
    parts.push({ z0: 2, z1: 38, side: F.iceD, top: F.iceD, stroke: 0.7, ao: 0.1, bevel: false, shape: (c, zt) => { const z = 2 + zt * 36, y = yF(z) + 1.2; for (const q of cols) { const rr = q[1] * (0.85 + 0.15 * Math.sin(z * 0.7 + q[0])); const x = q[0] + Math.sin(z * 0.25 + q[0]) * 0.4 + rr * 0.92; c.moveTo(x, y + 0.1); c.lineTo(x + 0.01, y + 0.1); } } });
    // the lip bulge and the icicle fringe
    parts.push({ z0: 37, z1: 42.5, side: '#6aa0cc', top: '#e6f4ff', ao: 0.2, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt, 0, 1)) * 0.6 + 0.4; S.ell(c, 0, yF(39) + 1.6 - zt * 1.2, 13.5 * k + 1, 2.6 * k, 0); } });
    const ics = [-13, -10.5, -7, -4.5, -1.5, 1, 3.5, 6.5, 9, 12, 14];
    parts.push({ z0: 28, z1: 38.5, side: '#7ab0dc', top: '#ddf2ff', ao: 0.25, bevel: false, shape: (c, zt) => { const z = 28 + zt * 10.5, y = yF(38) + 2.6; for (let i = 0; i < ics.length; i++) { const L = 5 + (i % 3) * 2.4, top = 38.5; if (z < top - L) continue; const rr = 0.9 * Math.pow((z - (top - L)) / L, 0.7); S.circ(c, ics[i], y + (i % 2) * 0.6, Math.max(0.1, rr)); } } });
    // plunge pool: cracked ice plate, ice boulders, drifts, blown snow
    const pl = jag(16, 1, 9, 0.14, 0.1, 0, 10, 24, 11);
    parts.push({ z0: 0, z1: 1, side: '#8fb8d2', top: '#c4e2f2', ao: 0.2, bevel: false, shape: (c) => smoothPoly(c, pl),
      detail: (c) => { c.save(); c.beginPath(); smoothPoly(c, pl); c.clip(); c.strokeStyle = 'rgba(40,70,110,0.5)'; c.lineWidth = 0.45; const r = rng(4, 1); for (let i = 0; i < 7; i++) { let x = r.range(-14, 14), y = r.range(3, 12); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += r.range(-5, 5); y += r.range(-3, 4); c.lineTo(x, y); } c.stroke(); } const g = c.createRadialGradient(0, 4, 1, 0, 6, 14); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-24, -4, 48, 24); c.restore(); } });
    const bould = [{ x: -19, y: 14, r: 4.4, h: 4, seed: 61, n: 7, rough: 0.4 }, { x: 17, y: 16, r: 3.6, h: 3.4, seed: 62, n: 7, rough: 0.4 }, { x: 22, y: 8, r: 3, h: 2.8, seed: 63, n: 6, rough: 0.4 }, { x: -8, y: 19, r: 2.6, h: 2.4, seed: 64, n: 6, rough: 0.4 }];
    parts.push(rockPart(bould, '#6a9cc8', '#d6ecfa', { ao: 0.3 }));
    parts.push(...rockFacets(bould, '#e8f6ff', '#2f66a0'));
    parts.push(...drift(-30, 8, 6, 2.4, 71, 1.2, 0.7)); parts.push(...drift(30, 9, 5.5, 2.2, 72, 1.2, 0.7)); parts.push(...drift(6, 21, 5, 1.6, 73, 1.4, 0.6));
    parts.push(layer((pe) => {
      const r = rng(13, 2);
      // cracks and snow dust on the cliff, spray-frost on the columns, mist glow at the foot
      for (const R of cliff.slice(0, 3)) { const yF2 = (z) => { const s = rockSect(R, Math.min(z, R.h - 0.1)); let m = -1e9; for (let i = 1; i < s.length; i += 2) m = Math.max(m, s[i]); return m + 0.03; }; for (let i = 0; i < 3; i++) { const z0 = r.range(3, R.h - 8), x0 = R.x + r.range(-R.r * 0.5, R.r * 0.5); pe.lines('rgba(20,28,44,0.5)', 0.4, [x0, yF2(z0), z0, x0 + r.range(-2, 2), yF2(z0 + 4), z0 + 4, x0 + r.range(-2, 2), yF2(z0 + 4), z0 + 4, x0 + r.range(-3, 3), yF2(z0 + 8), z0 + 8]); } for (let i = 0; i < 8; i++) { const z = r.range(4, R.h - 2); pe.dot('rgba(255,255,255,0.6)', R.x + r.range(-R.r * 0.7, R.r * 0.7), yF2(z), z, r.range(0.3, 0.8)); } }
      for (let i = 0; i < 30; i++) { const z = r.range(3, 36), q = cols[r.int(0, 4)]; pe.dot('rgba(255,255,255,0.75)', q[0] + r.range(-q[1], q[1]) * 0.8, yF(z) + 1.2 + q[1] * 0.7, z, r.range(0.15, 0.4)); }
      pe.glow(G, 0, yF(2) + 3, 2, 12, 0.22); pe.glow('#ffffff', 0, yF(2) + 2.5, 1.6, 7, 0.4);
      for (let i = 0; i < 18; i++) pe.dot('rgba(255,255,255,0.9)', r.range(-30, 30), r.range(2, 22), 0.3, r.range(0.15, 0.32));
    }));
    return { r: 36, h: 44, parts, style: 'prop', bevel: 0.7, spots: { foot: [0, yF(2) + 3, 1], lip: [0, yF(39), 42] } };
  };

  /* ================================================================ MORGRAVE
   * Dead earth (#4b4640) is dark, so every piece carries pale bone trim (pal.s),
   * lighter top faces and sickly green glows (pal.g) to separate from the ground. */
  const blightOf = (p) => ({ s: mx(p.a, '#2e2a36', 0.5), t: mx(p.b, '#7a7484', 0.5), d: mx(p.d, '#141219', 0.5), boneS: mx(p.s, '#a0957c', 0.4), boneT: mx(p.s, '#efe6cc', 0.5), iron: '#26262c', ironT: '#5a5a62', wood: mx(p.w, '#3a3028', 0.5), woodT: mx(p.w, '#7a6a5a', 0.6), woodD: mx(p.w, '#1e1812', 0.5), purple: p.k || '#5c2a6c' });
  const greenShadow = (rx, ry, a, ox, oy) => stain(rx, ry, a, '#0a0c0a', ox, oy);
  /* a skull resting on a point: a sphere with a shorter jaw block, sockets painted later */
  function skullPart(list, m, extra) {
    const zl = Math.min.apply(null, list.map((q) => q[2])), zh = Math.max.apply(null, list.map((q) => q[2] + q[3] * 1.9));
    return Object.assign({ z0: zl, z1: zh, side: m.boneS, top: m.boneT, ao: 0.3, bevel: false, shape: (c, zt) => {
      const z = zl + zt * (zh - zl);
      for (const q of list) {
        const u = (z - q[2]) / (q[3] * 1.9);
        if (u < 0 || u > 1) continue;
        const r = q[3] * (u < 0.35 ? 0.72 : Math.sqrt(Math.max(0.05, 1 - Math.pow((u - 0.45) / 0.58, 2))));
        S.ell(c, q[0], q[1] + (u < 0.35 ? q[3] * 0.1 : 0), r, r * 0.92, 0);
      }
    } }, extra || {});
  }
  /* sockets, nose and teeth painted on the camera side of skullPart skulls (1-dir) */
  function skullFaces(pe, list, m, glow) {
    for (const q of list) {
      const r = q[3], zc = q[2] + r * 1.05, y = q[1] + r * 0.92 + 0.03;
      for (const sg of [-1, 1]) { pe.ell(m.void || '#15120f', q[0] + sg * r * 0.36, y, zc, r * 0.24, r * 0.27); if (glow) { pe.glow(glow, q[0] + sg * r * 0.36, y, zc, r * 0.5, 0.7); pe.dot(mx(glow, '#ffffff', 0.5), q[0] + sg * r * 0.36, y, zc, r * 0.1); } }
      pe.poly(m.void || '#15120f', [q[0] - r * 0.1, y, zc - r * 0.45, q[0] + r * 0.1, y, zc - r * 0.45, q[0], y, zc - r * 0.2]);
      for (let t = -2; t <= 2; t++) pe.lines('rgba(40,34,26,0.6)', 0.2, [q[0] + t * r * 0.17, y, q[2] + r * 0.25, q[0] + t * r * 0.17, y, q[2] + r * 0.55]);
      pe.lines('rgba(40,34,26,0.5)', 0.25, [q[0] - r * 0.5, y, q[2] + r * 0.6, q[0] + r * 0.5, y, q[2] + r * 0.6]);
    }
  }
  /* crows: a dark body, a round head, a beak and an eye glint */
  function crows(list, extra) {
    const out = [];
    out.push(Object.assign({ z0: Math.min.apply(null, list.map((q) => q[2])), z1: Math.max.apply(null, list.map((q) => q[2])) + 2.6, side: '#1c1a1c', top: '#3e3a40', ao: 0.3, bevel: false, shape: (c, zt) => {
      const z0 = Math.min.apply(null, list.map((q) => q[2])), z = z0 + zt * (Math.max.apply(null, list.map((q) => q[2])) + 2.6 - z0);
      for (const q of list) {
        const u = (z - q[2]);
        if (u < 0 || u > 2.6) continue;
        if (u <= 1.4) { const k = Math.sin(Math.PI * u / 1.5); S.ell(c, q[0] - 0.3 * Math.cos(q[3]), q[1] - 0.3 * Math.sin(q[3]), 1.5 * k + 0.2, 0.85 * k + 0.15, q[3]); }
        if (u >= 1.1) { const k = Math.sin(Math.PI * clamp((u - 1.1) / 1.6, 0, 1)); S.circ(c, q[0] + 0.9 * Math.cos(q[3]), q[1] + 0.9 * Math.sin(q[3]), 0.62 * k + 0.1); }
      }
    } }, extra || {}));
    return out;
  }
  const crowFaces = (pe, list) => { for (const q of list) { const hx = q[0] + 0.9 * Math.cos(q[3]), hy = q[1] + 0.9 * Math.sin(q[3]); if (Math.sin(q[3]) < -0.6) continue; pe.poly('#6a5a30', [hx + 0.5 * Math.cos(q[3]), hy + 0.5 * Math.sin(q[3]) + 0.3, q[2] + 2.05, hx + 1.4 * Math.cos(q[3]), hy + 1.4 * Math.sin(q[3]) + 0.3, q[2] + 1.9, hx + 0.5 * Math.cos(q[3]), hy + 0.5 * Math.sin(q[3]) + 0.3, q[2] + 1.75]); pe.dot('#d8d0c0', hx + 0.1, hy + 0.55, q[2] + 2.2, 0.14); } };
  /* scattered bone litter on the ground (1-dir) */
  function boneLitter(pe, r, n, x0, x1, y0, y1, col) {
    const list = [];
    for (let i = 0; i < n; i++) list.push([r.range(x0, x1), r.range(y0, y1), r.next() < 0.2 ? 'skull' : r.next() < 0.3 ? 'rib' : 'bone', r.range(0, TAU), r.range(0.7, 1.1)]);
    paintBones(pe, list, col);
  }

  /* ========================================================== lm_obelisk_dark
   * Black obelisk, r 10, h 46, anims 4: a stepped base with skulls at its corners and
   * a bone-pale collar, a tapering black shaft carved with green runes that pulse, a
   * pyramidion tipped with a burning green point. */
  M.lm_obelisk_dark = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const parts = [greenShadow(12, 8, 0.4, 0, 2), pool(13, 8.5, 0, 1.5, G, 0.22)];
    parts.push({ z0: 0, z1: 2.8, side: m.d, top: m.t, ao: 0.35, shape: (c) => S.poly(c, ngon(8, 9.2, Math.PI / 8)), detail: (c) => { S.lines(c, 'rgba(0,0,0,0.5)', 0.35, [-6, -3, -2, 2, 5, 1, 7, 4]); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + Math.PI / 8; S.lines(c, 'rgba(0,0,0,0.35)', 0.3, [Math.cos(a) * 6.4, Math.sin(a) * 6.4, Math.cos(a) * 9, Math.sin(a) * 9]); } } });
    parts.push(box(0, 0, 11, 11, 2.8, 6, m.s, m.t, { ao: 0.35 }));
    parts.push(box(0, 0, 9.4, 9.4, 6, 7.1, m.boneS, m.boneT, { ao: 0.2, bevel: false }));
    parts.push(skullPart([[-4.6, -4.6, 6, 1.1], [4.6, -4.6, 6, 1.1], [-4.6, 4.6, 6, 1.1], [4.6, 4.6, 6, 1.1]], m));
    const hw = (z) => 4.2 - ((z - 7.1) / 32.9) * 1.4;
    parts.push({ z0: 7.1, z1: 40, side: m.s, top: m.t, ao: 0.35, shape: (c, zt) => { const w = hw(7.1 + zt * 32.9); c.rect(-w, -w, 2 * w, 2 * w); } });
    parts.push({ z0: 40, z1: 46, side: m.s, top: m.t, ao: 0.3, bevel: false, shape: (c, zt) => { const w = 2.8 * (1 - zt) + 0.1; c.rect(-w, -w, 2 * w, 2 * w); } });
    parts.push({ z0: 45, z1: 48, side: G, top: mx(G, '#ffffff', 0.6), flat: true, bevel: false, shape: (c, zt) => S.circ(c, 0, 0, 0.9 * Math.sin(Math.PI * clamp(zt, 0, 1)) + 0.12) });
    parts.push(layer((pe, a) => {
      const r = rng(5, 1);
      skullFaces(pe, [[-4.6, -4.6, 6, 1.1], [4.6, -4.6, 6, 1.1], [-4.6, 4.6, 6, 1.1], [4.6, 4.6, 6, 1.1]].filter((q) => q[1] > 0), m);
      // the rune column on the south face, pulsing in sequence; a pale edge on the collar
      for (let i = 0; i < 7; i++) { const z = 9.5 + i * 4.4, y = hw(z) + 0.03, ap = 0.35 + 0.65 * pulse(a, i / 7); rune(pe, -1 + (i % 2) * 0.4, y, z, 2.4, G, i + 1, ap); pe.glow(G, 0, y, z + 1.2, 3.6, 0.22 * ap); }
      for (let i = 0; i < 4; i++) { const z = 12 + i * 7, y = hw(z); pe.lines('rgba(0,0,0,0.5)', 0.35, [-hw(z) + 0.5, y + 0.02, z, hw(z) - 0.5, y + 0.02, z]); }
      pe.lines(al(m.boneT, 0.9), 0.4, [-4.7, 4.72, 7.05, 4.7, 4.72, 7.05]);
      pe.lines('rgba(0,0,0,0.6)', 0.4, [-2.8, 2.84, 45.8, 0, 2.84 - 2.8, 48.2, 2.8, 2.84, 45.8, 0, 2.84 - 2.8, 48.2]);
      pe.glow(G, 0, 0, 47, 7, 0.4 + 0.2 * pulse(a));
      // bone litter and a green seep at the foot
      boneLitter(pe, r, 7, -11, 11, 3, 9, m.boneT);
      for (let i = 0; i < 6; i++) pe.dot(al(G, 0.5), r.range(-8, 8), r.range(4, 9), 0.2, r.range(0.3, 0.7));
    }));
    return { r: 10, h: 49, parts, style: 'prop', bevel: 0.6, spots: { tip: [0, 0, 47], rune: [0, 4, 20] } };
  };

  /* ============================================================== lm_gallows
   * Gallows, r 14, h 26: a plank platform with steps, post and arm with a brace, an
   * iron cage swinging on a chain with a skeleton inside, a noose, crows on the arm. */
  M.lm_gallows = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const parts = [greenShadow(15, 10, 0.4, 0, 2)];
    parts.push(box(-1, 0, 14, 10, 0, 2.6, m.woodD, m.woodT, { ao: 0.35, detail: (c) => { S.lines(c, 'rgba(10,8,6,0.55)', 0.3, [-8, -3, 6, -3, -8, -1, 6, -1, -8, 1, 6, 1, -8, 3, 6, 3]); S.dot(c, 'rgba(10,8,6,0.5)', 3, 2, 0.9); } }));
    parts.push(box(2.5, 7, 5, 2.2, 0, 1.3, m.woodD, m.woodT, { ao: 0.3, bevel: false })); parts.push(box(2.5, 5.6, 5, 1.4, 1.3, 2.6, m.woodD, m.woodT, { ao: 0.3, bevel: false }));
    parts.push(box(-5, -1.5, 1.6, 1.6, 2.6, 24.5, m.wood, m.woodT, { ao: 0.3 }));
    parts.push(beams([[-5, -1.5, 24, 5.5, -1.5, 24], [-5, -1.5, 18.5, 0.5, -1.5, 23.6]], 1.2, m.wood, m.woodT, { ao: 0.2 }));
    // chain, cage of bars with hoops, a skeleton slumped inside
    parts.push(beams([[4.4, -1.5, 23.6, 4.4, -1.5, 18]], 0.4, m.iron, m.ironT, { ao: 0 }));
    const CX = 4.4, CY = -1.5;
    parts.push({ z0: 8, z1: 18.2, side: m.iron, top: m.ironT, stroke: 0.42, ao: 0.1, bevel: false, shape: (c, zt) => { const z = 8 + zt * 10.2, k = z > 16.5 ? 1 - (z - 16.5) / 1.7 * 0.85 : 1; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.moveTo(CX + Math.cos(a) * 2.2 * k, CY + Math.sin(a) * 2 * k); c.lineTo(CX + Math.cos(a) * 2.2 * k + 0.01, CY + Math.sin(a) * 2 * k); } } });
    parts.push(skullPart([[CX, CY + 0.2, 13.6, 1.05]], m));
    parts.push({ z0: 9.2, z1: 13.4, side: m.boneS, top: m.boneT, ao: 0.3, bevel: false, shape: (c, zt) => { const k = Math.sin(Math.PI * clamp(zt * 0.9 + 0.1, 0, 1)); S.ell(c, CX, CY + 0.1, 1.5 * k + 0.2, 1.2 * k + 0.15, 0); } });
    for (const z of [8.2, 12.2, 16.2]) parts.push({ z0: z, z1: z + 0.5, side: m.iron, top: m.ironT, stroke: 0.55, ao: 0.1, bevel: false, shape: (c) => S.ell(c, CX, CY, 2.3, 2.1, 0) });
    parts.push({ z0: 7.4, z1: 8.2, side: m.iron, top: m.ironT, ao: 0.2, bevel: false, shape: (c) => S.ell(c, CX, CY, 2.4, 2.2, 0) });
    parts.push(beams([[0.2, -1.5, 23.6, 0.3, -1.5, 19.4]], 0.3, '#7a6a4a', '#b8a67a', { ao: 0 }));
    const cr = [[1.6, -1.6, 24.6, 0.3], [-5.2, -1.7, 25.3, -0.4], [4.2, 3.6, 2.6, 2.6]];
    parts.push(...crows(cr));
    parts.push(layer((pe) => {
      const r = rng(7, 2);
      crowFaces(pe, cr);
      skullFaces(pe, [[CX, CY + 0.2, 13.6, 1.05]], m);
      // ribs on the skeleton, the noose loop, grain on the post, ironwork on the cage
      for (let i = 0; i < 4; i++) pe.lines('rgba(40,34,26,0.6)', 0.22, [CX - 1.2, CY + 1.3, 10 + i * 0.8, CX + 1.2, CY + 1.3, 10 + i * 0.8]);
      pe.c.beginPath(); pe.c.ellipse(0.3, -1.5 - 18.6, 0.9, 1.3, 0, 0, TAU); pe.c.strokeStyle = '#a8966a'; pe.c.lineWidth = 0.32; pe.c.stroke();
      pe.lines('rgba(10,8,6,0.5)', 0.3, [-5.4, -0.68, 3, -5.3, -0.68, 23, -4.6, -0.68, 5, -4.7, -0.68, 20]);
      pe.lines('rgba(120,120,128,0.6)', 0.3, [CX - 2.2, CY + 2.12, 8.3, CX + 2.2, CY + 2.12, 8.3, CX - 2.2, CY + 2.12, 12.3, CX + 2.2, CY + 2.12, 12.3, CX - 2.1, CY + 2.12, 16.3, CX + 2.1, CY + 2.12, 16.3]);
      pe.glow(G, CX, CY, 12, 5, 0.14);
      boneLitter(pe, r, 5, -9, 9, 5.5, 10, m.boneT);
      pe.dot('rgba(60,20,24,0.55)', 1, 1.6, 2.62, 1.4); pe.dot('rgba(60,20,24,0.5)', 2.4, 2.6, 2.62, 0.7);
    }));
    return { r: 14, h: 28, parts, style: 'prop', bevel: 0.6, spots: { cage: [CX, CY, 13], arm: [0, -1.5, 24] } };
  };

  /* ============================================================ lm_mausoleum
   * Crypt, r 24, h 24: a black stone block on a plinth with bone-pale cornice and
   * corner pilasters, a stepped gable roof bristling with iron finials, skull reliefs on
   * the pediment, an iron door leaking green light, a barred window above it. */
  M.lm_mausoleum = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const parts = [greenShadow(26, 18, 0.4, 0, 3), pool(14, 7, 0, 13, G, 0.28)];
    parts.push(box(0, 0, 30, 20, 0, 1.5, m.d, mx(m.s, m.t, 0.5), { ao: 0.3 }));
    parts.push(box(0, 0, 25, 16, 1.5, 14, m.s, m.t, { ao: 0.35 }));
    parts.push(box(0, 0, 27, 18, 1.5, 2.2, m.boneS, m.boneT, { ao: 0.15, bevel: false }));
    for (const q of [[-12, -7.6], [12, -7.6], [-12, 7.6], [12, 7.6]]) { parts.push(box(q[0], q[1], 2.6, 2.6, 1.5, 14.6, sh(m.s, 0.05), m.t, { ao: 0.3 })); parts.push(box(q[0], q[1], 3.2, 3.2, 14.4, 15.2, m.boneS, m.boneT, { ao: 0.1, bevel: false })); }
    parts.push(box(0, 0, 28, 19, 14, 15.4, m.boneS, m.boneT, { ao: 0.15, bevel: false, detail: (c) => S.lines(c, 'rgba(60,50,40,0.45)', 0.3, [-14, -8.5, 14, -8.5, -14, 8.5, 14, 8.5]) }));
    // roof: a stepped gable, ridge along y so the pediment faces the camera; iron finials
    parts.push({ z0: 15.4, z1: 23, side: sh(m.s, -0.05), top: sh(m.t, 0.1), ao: 0.18, bevel: false, shape: (c, zt) => { const w = 13.5 * (1 - Math.floor(zt * 6) / 6); c.rect(-w, -9.4, 2 * w, 18.8); } });
    parts.push(beams([[0, -9.6, 23, 0, 9.6, 23]], 1.4, m.iron, m.ironT, { ao: 0.2 }));
    parts.push({ z0: 23, z1: 27, side: m.iron, top: m.ironT, ao: 0.2, bevel: false, shape: (c, zt) => { const k = 1 - zt; for (const y of [-8.6, -3, 3, 8.6]) S.circ(c, 0, y, 0.55 * k + 0.08); } });
    parts.push({ z0: 15.2, z1: 18.6, side: m.iron, top: m.ironT, ao: 0.2, bevel: false, shape: (c, zt) => { const k = 1 - zt; for (const q of [[-12, -7.6], [12, -7.6], [-12, 7.6], [12, 7.6]]) S.circ(c, q[0], q[1], 0.5 * k + 0.08); } });
    parts.push({ z0: 9.8, z1: 12.4, side: G, top: G, flat: true, bevel: false, shape: (c, zt) => { const k = 1 - Math.pow(Math.max(0, zt - 0.5) * 2, 2); c.rect(-1.6 * k, 7.9, 3.2 * k, 0.4); } });
    parts.push(layer((pe) => {
      const r = rng(9, 1), y = 8.03;
      // the iron door with straps and a skull knocker, green light at its seams
      pe.glow(G, 0, y, 4.5, 8, 0.45);
      archRect(pe, '#0e0d12', -3.2, 3.2, y, 1.5, 9.6, true);
      pe.lines(al(G, 0.9), 0.45, [-3.1, y, 1.6, -3.1, y, 7, 3.1, y, 1.6, 3.1, y, 7, -1.4, y, 1.55, 1.4, y, 1.55]);
      pe.lines('rgba(90,90,100,0.8)', 0.5, [-2.8, y - 0.01, 3.6, 2.8, y - 0.01, 3.6, -2.8, y - 0.01, 7, 2.8, y - 0.01, 7, 0, y - 0.01, 1.6, 0, y - 0.01, 9.2]);
      pe.ell(m.boneT, 0, y - 0.02, 5.5, 0.75, 0.8); pe.dot('#15120f', -0.28, y - 0.02, 5.6, 0.2); pe.dot('#15120f', 0.28, y - 0.02, 5.6, 0.2);
      pe.c.beginPath(); pe.c.arc(0, y - 4.7, 0.6, 0.2, Math.PI - 0.2); pe.c.strokeStyle = '#9a9aa4'; pe.c.lineWidth = 0.35; pe.c.stroke();
      // barred window, skull reliefs with bone wreaths either side of the door, a bone frieze line
      pe.glow(G, 0, y, 11.4, 4, 0.4); pe.lines('#111016', 0.35, [-1, y - 0.02, 10, -1, y - 0.02, 12.2, 1, y - 0.02, 10, 1, y - 0.02, 12.2, -1.6, y - 0.02, 11.2, 1.6, y - 0.02, 11.2]);
      for (const x of [-8, 8]) { pe.ell(m.boneT, x, y, 7.8, 1.6, 1.5); pe.ell(m.boneT, x, y, 6.2, 1.05, 0.8); pe.dot('#15120f', x - 0.62, y, 7.9, 0.42); pe.dot('#15120f', x + 0.62, y, 7.9, 0.42); pe.poly('#15120f', [x - 0.2, y, 7, x + 0.2, y, 7, x, y, 7.4]); for (let t = -2; t <= 2; t++) pe.lines('rgba(40,34,26,0.6)', 0.2, [x + t * 0.36, y, 6, x + t * 0.36, y, 6.6]); pe.lines(al(m.boneT, 0.7), 0.4, [x - 2.6, y, 4.2, x - 1.4, y, 9.8, x + 2.6, y, 4.2, x + 1.4, y, 9.8]); }
      pe.lines('rgba(0,0,0,0.5)', 0.35, [-12.4, y, 4.8, -9.8, y, 4.8, 9.8, y, 4.8, 12.4, y, 4.8, -12.4, y, 11, -9.8, y, 11, 9.8, y, 11, 12.4, y, 11]);
      // the pediment: bone edging on the raking cornice, a skull at the apex, cracks
      const py = 9.43; const w = (z) => 13.5 * (1 - (z - 15.4) / 7.6);
      pe.poly('rgba(0,0,0,0.25)', [-13.5, py, 15.4, 13.5, py, 15.4, 0.4, py, 23]);
      pe.lines(al(m.boneT, 0.85), 0.5, [-13.6, py, 15.5, 0, py, 23.1, 0, py, 23.1, 13.6, py, 15.5]);
      pe.ell(m.boneT, 0, py, 18.6, 1.5, 1.4); pe.dot('#15120f', -0.55, py, 18.7, 0.4); pe.dot('#15120f', 0.55, py, 18.7, 0.4); pe.poly('#15120f', [-0.2, py, 17.8, 0.2, py, 17.8, 0, py, 18.2]);
      for (const sg of [-1, 1]) pe.lines(al(m.boneT, 0.7), 0.35, [sg * 3, py, 17.4, sg * 7.5, py, 16.6, sg * 7.5, py, 16.6, sg * 9, py, 17.4]);
      pe.lines('rgba(0,0,0,0.6)', 0.4, [-6, y, 1.6, -5.2, y, 3.4, -5.2, y, 3.4, -6.2, y, 5, 9.6, py, 15.5, 8.8, py, 16.9]);
      void w;
      // a dead vine on the east pilaster, green seep, bones at the threshold
      for (let i = 0; i < 9; i++) pe.lines('rgba(30,26,22,0.9)', 0.35, [12 + r.range(-1.4, 1.4), 8.95, 2 + i * 1.3, 12 + r.range(-1.4, 1.4), 8.95, 3.3 + i * 1.3]);
      boneLitter(pe, r, 6, -13, 13, 10.5, 15, m.boneT);
      for (let i = 0; i < 6; i++) pe.dot(al(G, 0.45), r.range(-5, 5), r.range(10, 14), 0.2, r.range(0.3, 0.7));
    }));
    return { r: 24, h: 28, parts, style: 'prop', bevel: 0.6, spots: { door: [0, 9, 4] } };
  };

  /* ============================================================ lm_bone_totem
   * Bone totem, r 8, h 24: a spear-shaft hung with stacked skulls (the horned one on
   * top with green-burning eyes), crossed long bones, tattered purple rags on a
   * crossbar, a crow, skulls and ribs in the dirt below. */
  M.lm_bone_totem = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const parts = [greenShadow(8, 5.5, 0.4, 0, 1), pool(7, 4.5, 0, 1, G, 0.16)];
    parts.push(beams([[0, 0, 0, 0.2, 0, 24.6]], 0.75, m.woodD, m.woodT, { ao: 0.25 }));
    parts.push({ z0: 24.4, z1: 27, side: '#6a6a72', top: '#c0c0c8', ao: 0.1, bevel: false, shape: (c, zt) => S.ell(c, 0.2, 0, 0.8 * (1 - zt * 0.9) + 0.1, 0.4, 0) });
    parts.push(beams([[-5.2, 0.3, 16.6, 5.4, -0.3, 16.6]], 0.6, m.woodD, m.woodT, { ao: 0.2 }));
    const sk = [[0, 0.3, 3.6, 1.5], [0.1, 0.2, 8.4, 1.7], [0.1, 0.2, 13.4, 1.6], [0.2, 0.2, 18.2, 2.2]];
    parts.push(skullPart(sk, m));
    parts.push(beams([[-3.2, 1.2, 10.5, 3.4, -1, 14.6], [3.2, 1.2, 10.5, -3.4, -1, 14.6], [-2.8, 1, 5.4, 2.8, -0.8, 8.2]], 0.7, m.boneS, m.boneT, { ao: 0.2 }));
    parts.push({ z0: 5, z1: 15, side: m.boneS, top: m.boneT, ao: 0.2, bevel: false, shape: (c, zt) => { const z = 5 + zt * 10; for (const q of [[-3.2, 1.2, 10.5], [3.4, -1, 14.6], [3.2, 1.2, 10.5], [-3.4, -1, 14.6], [-2.8, 1, 5.4], [2.8, -0.8, 8.2]]) if (Math.abs(z - q[2]) < 0.6) S.circ(c, q[0], q[1], 0.62); } });
    for (const sg of [-1, 1]) parts.push(...taperLimb([[0.2 + sg * 1.6, 0, 21.4], [0.2 + sg * 3.4, -0.4, 23.4], [0.2 + sg * 4.2, -1.2, 26], [0.2 + sg * 3.6, -2, 28]], 1.3, 0.45, m.boneS, m.boneT, { ao: 0.2 }));
    parts.push({ z0: 20.3, z1: 21.1, side: G, top: mx(G, '#ffffff', 0.5), flat: true, bevel: false, shape: (c) => { S.circ(c, -0.6, 2.2, 0.42); S.circ(c, 1, 2.2, 0.42); } });
    const cr = [[-4.6, 0.3, 17, 0.4]];
    parts.push(...crows(cr));
    parts.push(layer((pe) => {
      const r = rng(11, 3);
      skullFaces(pe, sk.slice(0, 3), m);
      skullFaces(pe, [sk[3]], m, G);
      crowFaces(pe, cr);
      // rags hanging from the crossbar, lashings, the spear's binding
      for (const q of [[-4.4, 4.6, 7], [-1.8, 3.4, 5], [2.4, 4, 6.5], [4.6, 3, 4.5]]) { const x = q[0], w = q[1] * 0.5, L = q[2]; pe.poly(m.purple, [x - w, 0.65, 16.3, x + w, 0.65, 16.3, x + w * 0.7, 0.65, 16.3 - L * 0.7, x + w * 0.2, 0.65, 16.3 - L, x - w * 0.3, 0.65, 16.3 - L * 0.6, x - w * 0.9, 0.65, 16.3 - L * 0.85]); pe.lines('rgba(0,0,0,0.5)', 0.3, [x - w * 0.3, 0.66, 16.3, x - w * 0.4, 0.66, 16.3 - L * 0.6]); pe.lines(al(mx(m.purple, '#ffffff', 0.4), 0.5), 0.3, [x + w * 0.3, 0.66, 16.1, x + w * 0.4, 0.66, 16.3 - L * 0.5]); }
      pe.lines('#8a7a5a', 0.3, [-0.6, 0.78, 16, 0.8, 0.78, 17.2, -0.6, 0.78, 17.2, 0.8, 0.78, 16, -0.5, 0.78, 6.2, 0.7, 0.78, 7.4, -0.5, 0.78, 11.5, 0.7, 0.78, 12.7]);
      boneLitter(pe, r, 8, -7, 7, 1.5, 5.5, m.boneT);
      pe.glow(G, 0.2, 2.2, 20.7, 3.4, 0.4);
    }));
    return { r: 8, h: 29, parts, style: 'prop', bevel: 0.6, spots: { eyes: [0.2, 2.2, 20.7] } };
  };

  /* ========================================================= lm_ruined_chapel
   * Ruined chapel, r 40, h 36: the nave's black walls broken to the sills of their
   * lancet windows, a tall gothic arch standing alone at the east end, a bell tower
   * stump at the west, rafters fallen inward, the cracked bell lying on the floor,
   * bone-pale quoins and coping, gravestones leaning outside, a green haunt-light. */
  M.lm_ruined_chapel = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const parts = [greenShadow(42, 30, 0.4, 0, 3), pool(16, 10, 6, 0, G, 0.16)];
    parts.push({ z0: 0, z1: 0.6, side: m.d, top: mx(m.s, m.t, 0.4), ao: 0.15, bevel: false, shape: (c) => c.rect(-22, -12, 44, 24), detail: (c) => { const r = rng(3, 1), s = []; for (let y = -12; y < 12; y += 4) { s.push(-22, y, 22, y); for (let x = -22 + r.range(0, 3); x < 22; x += r.range(3, 5.5)) s.push(x, y, x, y + 4); } S.lines(c, 'rgba(0,0,0,0.45)', 0.3, s); for (let i = 0; i < 14; i++) S.dot(c, 'rgba(100,96,110,0.4)', r.range(-21, 21), r.range(-11, 11), r.range(0.8, 2)); } });
    const hs = [16, 12, 9, 20, 7, 4, 14, 2.5, 6, 11, 18, 8, 3, 13, 22, 9, 5, 15];
    const nave = wallRun([[-10, -12], [22, -12], [22, 12], [-10, 12]], 7, { H: 24, hs, seg: 5, noCren: true });
    for (const q of nave) q.cren = false;
    parts.push(wallPart(nave, 2.6, m.s, m.t, { brk: 2.6 }));
    // the bell tower stump, hollow, with a ragged top
    const tw = wallRun([[-22, -7], [-10, -7], [-10, 7], [-22, 7], [-22, -7]], 11, { H: 34, hs: [34, 30, 26, 22, 20, 24, 33, 31], seg: 6, noCren: true });
    for (const q of tw) q.cren = false;
    parts.push({ z0: 0, z1: 0.8, side: m.d, top: mx(m.s, m.t, 0.3), ao: 0.2, bevel: false, shape: (c) => c.rect(-20.5, -5.5, 9, 11) });
    parts.push(wallPart(tw, 2.8, m.s, m.t, { brk: 3 }));
    // the east gable arch standing alone, pointed, one side fallen
    parts.push(xzPart([[-7.5, 0, -4.5, 0, -4.5, 13, -7.5, 13], [4.5, 0, 7.5, 0, 7.5, 13, 4.5, 13], ...pointedArch(0, 13, 4.5, 7.5, 7, 0.55).slice(0, 10)], 0, 27, m.s, m.t, { ox: 22, oy: 0, a: Math.PI / 2, v0: -1.4, v1: 1.4 }, { ao: 0.3 }));
    parts.push(box(22.5, 0, 3, 16, 26, 27.2, m.boneS, m.boneT, { ao: 0.1, bevel: false, shape: (c) => S.poly(c, [21, -2.4, 24, -2.4, 24, 2.4, 21, 2.4]) }));
    // rafters, the fallen bell, a roof scrap against the tower
    parts.push(beams([[-9, -11, 20, -2, -4, 1.2], [4, 11, 16, 8, 3, 1.2], [14, -11, 15, 16, -2, 1], [-9.6, 2, 20, -8, 10, 8]], 1, m.woodD, m.woodT, { ao: 0.3 }));
    parts.push({ z0: 20, z1: 25, side: sh(m.s, -0.1), top: m.t, ao: 0.15, bevel: false, shape: (c, zt) => { const w = 5.5 * (1 - zt); c.rect(-9.8, -6 + zt * 1.5, w, 6 - zt * 2); } });
    const BX = 8, BY = 2;
    parts.push({ z0: 0, z1: 7.4, side: '#3a5648', top: '#86a890', ao: 0.4, shape: (c, zt) => { const r = 4 * (1 - 0.55 * Math.pow(zt, 1.4)) + (zt < 0.12 ? 0.5 * (1 - zt / 0.12) : 0); S.circ(c, BX + zt * 1.6, BY - zt * 0.4, Math.max(0.3, r)); }, detail: (c) => { S.circ(c, BX + 1.6, BY - 0.4, 0.9); c.fillStyle = '#5a7c66'; c.fill(); } });
    parts.push({ z0: 7.2, z1: 8.6, side: '#3a5648', top: '#86a890', ao: 0.2, bevel: false, shape: (c, zt) => S.circ(c, BX + 1.6, BY - 0.4, 1 - zt * 0.5) });
    // gravestones outside the south wall
    for (const q of [[-4, 17, 0.2], [4, 18.5, -0.3], [12, 17, 0.15]]) parts.push({ z0: 0, z1: 4.6, side: m.s, top: m.t, ao: 0.3, shape: (c, zt) => { const z = zt * 4.6; let pts = tf([-1.5, -0.5, 1.5, -0.5, 1.5, 0.5, -1.5, 0.5], q[0] + z * q[2], q[1], 0.1); if (zt > 0.7) pts = xf(pts, 1 - (zt - 0.7) * 1.2, 1, q[0] + z * q[2], q[1], 0, 0); S.poly(c, pts); } });
    parts.push(layer((pe) => {
      const r = rng(13, 2);
      // bone-pale quoins and coping on the south faces, lancet windows cut by the breaks, joints
      for (const q of nave.concat(tw)) {
        if (Math.abs(q.y1 - q.y0) > 0.5 || q.h < 2) continue;
        const front = q.y0 > 0;
        const x0 = Math.min(q.x0, q.x1), x1 = Math.max(q.x0, q.x1), y = q.y0 + (front ? 1.42 : -1.38), top = q.h - 2.6;
        if (!front && q.y0 > -8) continue;
        if (top > 1) { stones(pe, x0, x1, y, 0.3, top, (x0 | 0) + 5, { row: 1.9, w: 1.5, joint: 'rgba(0,0,0,0.35)', light: 'rgba(200,190,210,0.12)', dark: 'rgba(0,0,0,0.2)' }); pe.wall(al(m.boneT, 0.7), x0, x1, y + 0.01, q.h - 0.5, q.h - 0.1); }
        if (front && q.h > 10 && x1 - x0 > 4) { const xm = (x0 + x1) / 2; archRect(pe, al(m.boneT, 0.8), xm - 1.5, xm + 1.5, y + 0.02, 5, Math.min(q.h - 2.8, 13.4), true); archRect(pe, '#0e0d12', xm - 1.05, xm + 1.05, y + 0.03, 5.5, Math.min(q.h - 3.4, 12.8), true); if (q.h > 14) pe.glow(G, xm, y, 9, 3.2, 0.2); }
      }
      for (const x of [-22, -10, 22]) pe.lines(al(m.boneT, 0.8), 0.6, [x, 13.44, 0.5, x, 13.44, 9]);
      for (let i = 0; i < 5; i++) pe.wall(al(m.boneT, 0.75), -22.6 + (i % 2) * 0.8, -21.2 + (i % 2) * 0.8, 8.45, 1 + i * 3.4, 2.2 + i * 3.4);
      // the arch: joint lines and a keystone skull
      for (let i = 1; i < 7; i++) { const t = i / 7, u = -4.5 + t * 9, zq = 13 + Math.sqrt(Math.max(0, 1 - Math.pow(u / 4.5, 2))) * 6.4; if (u > 2.5) continue; pe.lines('rgba(0,0,0,0.45)', 0.3, [23.42, u, zq, 23.42, u * 1.6, zq + 3]); }
      pe.ell(m.boneT, 23.43, 0.5, 23.2, 1.1, 1); pe.dot('#15120f', 23.43, 0.1, 23.3, 0.3); pe.dot('#15120f', 23.43, 0.9, 23.3, 0.3);
      // the bell: crack, rim band, a sound bow highlight; haunt-light in the nave
      pe.lines('rgba(10,20,14,0.8)', 0.45, [BX - 1, BY + 4, 0.5, BX - 0.4, BY + 3.6, 3.5, BX - 0.4, BY + 3.6, 3.5, BX + 0.6, BY + 3.1, 5.4]);
      pe.lines('rgba(10,20,14,0.6)', 0.4, [BX - 3.6, BY + 3.9, 1.2, BX + 3.6, BY + 3.9, 1.2]);
      pe.lines('rgba(220,240,230,0.5)', 0.4, [BX - 2.2, BY + 3.6, 2, BX - 1.4, BY + 2.6, 6]);
      pe.glow(G, 6, -2, 1, 9, 0.2);
      for (let i = 0; i < 7; i++) pe.dot(al(G, 0.55), 6 + r.range(-7, 7), -2 + r.range(-5, 5), r.range(1, 6), r.range(0.25, 0.5));
      boneLitter(pe, r, 6, -20, 20, 14, 19, m.boneT);
      for (const q of [[-4, 17], [4, 18.5], [12, 17]]) { pe.lines('rgba(0,0,0,0.5)', 0.3, [q[0] - 0.8, q[1] + 0.55, 1.4, q[0] + 0.8, q[1] + 0.55, 1.4, q[0] - 0.6, q[1] + 0.55, 2.4, q[0] + 0.6, q[1] + 0.55, 2.4]); }
    }));
    return { r: 40, h: 36, parts, style: 'prop', bevel: 0.6, spots: { bell: [BX, BY, 8], arch: [22, 0, 27] } };
  };

  /* ==================================================== lm_dead_colossal_tree
   * Colossal dead tree, r 30, h 70: a black twisted trunk with a hollow that glows
   * green, grasping roots, clawed branches with hanging moss, a nest of bones and
   * skulls wedged in a crook. Pale lit flank and bone keep it readable on dead earth. */
  M.lm_dead_colossal_tree = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a', seed = opt.seed | 0, rg = rng(seed, 61);
    const bk = { s: '#1e1a1e', t: '#4c464c', g: '#0c0a0c', h: '#5e585e' };
    const H = 70, zT = 46, tr = 6.5;
    const ph = rg.range(0, TAU);
    const cen = (z) => { const u = z / zT; return [Math.sin(z * 0.12 + ph) * 2 * u + 1.5 * u * u, Math.cos(z * 0.1 + ph) * 1.2 * u - 1 * u * u]; };
    const rad = (z) => tr * (1 - 0.45 * clamp(z / zT, 0, 1)) + tr * 0.6 * Math.pow(Math.max(0, 1 - z / 7), 2);
    const W = [tr * 0.7, tr * 0.42, 1.4, 0.8];
    const cls = [[], [], [], []];
    function branch(pt, a, el, L, depth) {
      const pts = [pt.slice()];
      let x = pt[0], y = pt[1], z = pt[2];
      for (let s = 0; s < 3; s++) {
        a += rg.range(-0.5, 0.5); el = clamp(el + rg.range(-0.25, 0.2), 0.2, 1.2);
        const h = L / 3;
        x += Math.cos(a) * Math.cos(el) * h; y += Math.sin(a) * Math.cos(el) * h * 0.85; z += Math.max(0.6, Math.sin(el) * h);
        pts.push([x, y, z]);
      }
      cls[Math.min(3, depth)].push(pts);
      if (depth < 2) { const nk = depth === 0 ? 2 : rg.int(1, 2); for (let k = 0; k < nk; k++) { const q = pts[rg.int(1, 2)]; branch(q, a + rg.range(0.5, 1.1) * (rg.chance(0.5) ? 1 : -1), el + rg.range(-0.1, 0.3), L * rg.range(0.45, 0.62), depth + 1); } }
      const tip = pts[pts.length - 1], nt = rg.int(2, 3);
      for (let k = 0; k < nt; k++) { const ta = a + rg.range(-1, 1), tl = L * rg.range(0.16, 0.28); cls[3].push([tip.slice(), [tip[0] + Math.cos(ta) * tl, tip[1] + Math.sin(ta) * tl * 0.85, tip[2] + tl * rg.range(0.5, 1)]]); }
    }
    const ba = rg.range(0, TAU);
    for (let i = 0; i < 5; i++) { const z = zT * rg.range(0.55, 1), c0 = cen(z); branch([c0[0], c0[1], z], ba + (i / 5) * TAU + rg.range(-0.3, 0.3), rg.range(0.35, 0.8), rg.range(18, 26), 0); }
    { const c0 = cen(zT); branch([c0[0], c0[1], zT - 1], rg.range(0, TAU), 1.15, (H - zT) * 0.85, 1); }
    const parts = [greenShadow(26, 17, 0.45, 2, 3), pool(12, 8, 0, 6, G, 0.2)];
    // roots clawing the ground
    const rl = [], nr = 7, ra = rg.range(0, TAU);
    for (let i = 0; i < nr; i++) { const a = ra + (i / nr) * TAU + rg.range(-0.3, 0.3), L = tr * rg.range(2.6, 3.8); rl.push([[Math.cos(a) * L, Math.sin(a) * L * 0.85, 0.3], [Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.48, 1], [Math.cos(a) * tr * 0.5, Math.sin(a) * tr * 0.45, 3]]); }
    parts.push(limbPart(rl, tr * 0.5, bk.s, bk.t, { ao: 0.3 }));
    parts.push({ z0: 0, z1: zT, side: bk.s, top: bk.t, ao: 0.4, shape: (c, zt) => { const z = zt * zT, q = cen(z); S.blob(c, q[0], q[1], rad(z), seed + Math.floor(z * 0.5), 8, 0.3); } });
    parts.push({ z0: 0.8, z1: zT - 0.8, side: bk.h, top: bk.t, stroke: 0.9, ao: 0.4, bevel: false, shape: (c, u) => { const z = lerp(0.8, zT - 0.8, u), q = cen(z), rr = rad(z) * 0.8; c.moveTo(q[0] - rr * 0.8, q[1] + rr * 0.55); c.lineTo(q[0] - rr * 0.8 + 0.01, q[1] + rr * 0.55); } });
    parts.push({ z0: 0.5, z1: zT - 0.6, side: bk.g, top: bk.g, stroke: 0.5, ao: 0, bevel: false, shape: (c, u) => { const z = lerp(0.5, zT - 0.6, u), q = cen(z), rr = rad(z) * 0.9; for (let i = 0; i < 4; i++) { const a = 0.5 + i * 0.75 + Math.sin(z * 0.6 + i) * 0.25; c.moveTo(q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr); c.lineTo(q[0] + Math.cos(a) * rr + 0.01, q[1] + Math.sin(a) * rr); } } });
    for (let k = 0; k < 4; k++) {
      const lp = limbPart(cls[k], W[k], k < 2 ? bk.s : sh(bk.s, 0.08), k < 2 ? bk.t : sh(bk.t, -0.1), { ao: 0.25 });
      if (!lp) continue;
      parts.push(lp);
      if (k < 3) { const o = W[k] * 0.3; parts.push(limbPart(cls[k].map((L) => L.map((q) => [q[0] - o, q[1] - o, q[2]])), W[k] * 0.3, bk.h, bk.h, { ao: 0.35 })); }
    }
    // hanging moss from the big limbs, the bone nest in a crook, a hollow with green light
    const moss = [];
    for (const L of cls[0].concat(cls[1])) for (let i = 1; i < L.length; i++) { if (!rg.chance(0.6)) continue; const q = L[i], len = rg.range(4, 9); moss.push([[q[0] + rg.range(-1, 1), q[1] + 1.5, q[2] - len], [q[0], q[1] + 1, q[2] - 0.5]]); }
    parts.push(limbPart(moss, 0.55, '#3e4a3a', '#6a7a62', { ao: 0.1 }));
    const nest = cls[0][1] ? cls[0][1][1] : [8, 2, 40];
    const NX = nest[0], NY = nest[1], NZ = nest[2];
    parts.push({ z0: NZ - 1, z1: NZ + 2.2, side: m.boneS, top: m.boneT, stroke: 2.4, ao: 0.3, bevel: false, shape: (c, zt) => { for (let i = 0; i <= 24; i++) { const t = (i / 24) * TAU, rr = 4.4 + Math.sin(t * 5 + zt * 3) * 0.6; const x = NX + Math.cos(t) * rr, y = NY + Math.sin(t) * rr * 0.9; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); } });
    parts.push(skullPart([[NX - 1, NY - 0.6, NZ + 0.6, 1.3], [NX + 1.6, NY + 0.4, NZ + 0.4, 1]], m));
    parts.push(layer((pe) => {
      const r = rng(seed, 63);
      skullFaces(pe, [[NX - 1, NY - 0.6, NZ + 0.6, 1.3], [NX + 1.6, NY + 0.4, NZ + 0.4, 1]], m);
      for (let i = 0; i < 10; i++) { const t = r.range(0, TAU), rr = r.range(2.6, 5.4); pe.lines(i % 2 ? m.boneT : m.boneS, 0.4, [NX + Math.cos(t) * rr, NY + Math.sin(t) * rr * 0.9, NZ + 1.8 + r.range(-0.6, 0.6), NX + Math.cos(t + 0.5) * (rr + r.range(-1, 1)), NY + Math.sin(t + 0.5) * rr * 0.9, NZ + 1.8 + r.range(-0.6, 0.6)]); }
      // the hollow and its green light
      const q = cen(4), y = q[1] + rad(4) * 0.96;
      pe.c.beginPath(); pe.c.moveTo(q[0] - 2.6, y); pe.c.lineTo(q[0] - 3, y - 4); pe.c.quadraticCurveTo(q[0] - 1.6, y - 9, q[0] + 0.6, y - 9.2); pe.c.quadraticCurveTo(q[0] + 2.8, y - 8, q[0] + 2.8, y - 3.5); pe.c.lineTo(q[0] + 2.6, y); pe.c.closePath();
      const g = pe.c.createRadialGradient(q[0], y - 3, 0.5, q[0], y - 3, 7); g.addColorStop(0, mx(G, '#000000', 0.3)); g.addColorStop(0.5, mx(G, '#000000', 0.75)); g.addColorStop(1, '#050605'); pe.c.fillStyle = g; pe.c.fill();
      pe.glow(G, q[0], y, 3.5, 6, 0.4);
      for (let i = 0; i < 5; i++) pe.dot(al(G, 0.7), q[0] + r.range(-4, 4), y + r.range(1, 5), 0.3, r.range(0.3, 0.6));
      // a few lichen scabs on the lit flank, bark splits
      for (let i = 0; i < 8; i++) pe.dot(['#4a5048', '#6a7260'][i % 2], cen(6 + i * 4.5)[0] - rad(6 + i * 4.5) * 0.5 + r.range(-1, 1), cen(6 + i * 4.5)[1] + rad(6 + i * 4.5) * 0.8, 6 + i * 4.5, r.range(0.3, 0.6));
      boneLitter(pe, r, 6, -16, 16, 8, 15, m.boneT);
    }));
    let ext = 0;
    for (const L of cls.flat()) for (const q of L) ext = Math.max(ext, Math.abs(q[0]), Math.abs(q[1]));
    return { r: Math.max(30, Math.ceil(ext + 3)), h: H + 2, parts, style: 'prop', bevel: 0.6, spots: { hollow: [0, 7, 3], nest: [NX, NY, NZ + 2] } };
  };

  /* ============================================================ lm_giant_skull
   * An enormous horned skull half buried in the dead earth, r 34, h 30: cranium dome
   * with a cracked crown and a missing piece, brow ridge, eye sockets lit by a sickly
   * green glow, the upper teeth biting the ground, two great horns. */
  M.lm_giant_skull = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const bS = mx(m.boneS, '#b0a48a', 0.4), bT = mx(m.boneT, '#f0e8d2', 0.4);
    const A = 24, B = 17, H = 28;
    const k = (z) => Math.sqrt(Math.max(0, 1 - Math.pow(z / H, 2.3)));
    const yF = (z) => B * k(z);
    const parts = [greenShadow(34, 22, 0.45, 0, 4), pool(20, 10, 0, 16, G, 0.14)];
    parts.push({ z0: 0, z1: H, side: bS, top: bT, ao: 0.4, shape: (c, zt) => { const z = zt * H; let pts = ngon(26, 1, 0, 0, 0, A * k(z), B * k(z)); if (z > 19) pts = clipHalf(pts, -0.8, 0.6, -A * 0.5 * (1 - (z - 19) / 9 * 0.45)); polyOK(c, pts); },
      detail: (c) => { S.lines(c, 'rgba(60,50,40,0.6)', 0.5, [-6, -2, -2, 1, -2, 1, 3, -3, 3, -3, 7, 0]); S.dot(c, 'rgba(255,255,250,0.5)', -3, -3, 2.4); } });
    parts.push({ z0: 14, z1: 18.5, side: bS, top: bT, ao: 0.25, bevel: false, shape: (c, zt) => { const z = 14 + zt * 4.5, kk = 1 - Math.abs(zt - 0.5) * 0.6; S.ell(c, 0, yF(z) - 1.4, 17 * kk + 2, 2.4 * kk, 0); } });
    parts.push({ z0: 0, z1: 5.2, side: bT, top: '#fbf6ea', ao: 0.3, bevel: false, shape: (c, zt) => { const z = zt * 5.2; for (let i = -4; i <= 4; i++) { const x = i * 3.3; const rr = 0.6 + 0.9 * zt; S.ell(c, x, yF(z) * 0.97 - 0.3, rr, rr * 0.8, 0); } } });
    for (const sg of [-1, 1]) parts.push(...taperLimb([[sg * 20, -4, 16], [sg * 27, -5, 21], [sg * 31, -1, 26], [sg * 29, 5, 30]], 3.4, 1, bS, bT, { ao: 0.25 }));
    parts.push(layer((pe) => {
      const r = rng(17, 1);
      // eye sockets lit from inside, the nasal cavity, the jaw line over the teeth
      for (const sg of [-1, 1]) {
        const x = sg * 8.5, z = 12.5, y = yF(z) + 0.03;
        pe.c.beginPath(); pe.c.ellipse(x, y - z, 6, 4.4, sg * 0.15, 0, TAU); pe.c.fillStyle = '#0c0b0a'; pe.c.fill();
        pe.glow(G, x, y, z - 0.8, 4.2, 0.55); pe.ell(al(G, 0.9), x + sg * 0.5, y, z - 1.2, 1.8, 0.9); pe.ell(al(mx(G, '#ffffff', 0.6), 0.9), x + sg * 0.5, y, z - 1.1, 0.7, 0.4);
        pe.lines('rgba(255,250,240,0.4)', 0.5, [x - 5.4, y, z + 3.2, x + 5.4, y, z + 3.4]);
      }
      { const z = 6.5, y = yF(z) + 0.03; pe.poly('#0c0b0a', [-2.4, y, z - 2.6, 2.4, y, z - 2.6, 0.6, y, z + 2.6, -0.6, y, z + 2.6]); }
      pe.lines('rgba(60,50,40,0.6)', 0.5, [-14.5, yF(4.6) + 0.03, 4.6, 14.5, yF(4.6) + 0.03, 4.6]);
      for (let i = -4; i <= 4; i++) pe.lines('rgba(60,50,40,0.5)', 0.3, [i * 3.3 - 1.6, yF(3) + 0.05, 1, i * 3.3 - 1.6, yF(3) + 0.05, 4.4]);
      // cracks across the cranium, the broken edge of the missing piece, a few sutures
      pe.lines('rgba(60,50,40,0.6)', 0.5, [-10, yF(22) + 0.03, 22, -7, yF(25) + 0.03, 25, -7, yF(25) + 0.03, 25, -2, yF(27) + 0.03, 27, 6, yF(20) + 0.03, 20, 9, yF(17) + 0.03, 17]);
      pe.lines('rgba(60,50,40,0.5)', 0.35, [-16, yF(9) + 0.03, 9, -14, yF(14) + 0.03, 14, 16, yF(9) + 0.03, 9, 14, yF(13) + 0.03, 13, 0, yF(16) + 0.03, 16, 0.5, yF(20) + 0.03, 20]);
      for (let i = 0; i < 6; i++) { const z = 19 + i * 1.6, w = A * 0.5 * (1 - (z - 19) / 9 * 0.45); const x = (w + 0.6 * 0) * 0.8 / 1, pts = []; void pts; pe.dot('rgba(30,26,22,0.8)', 0.8 * w * 1.25 - 0.6 * 0, -0.6 * 0 + 0.6 * 0 * 0 + (-0.6 * 0), z, 0.1); void x; }
      pe.glow(G, 14, -4, 22, 7, 0.22);
      // moss-mould on the shaded side, bone litter and a green seep at the foot
      for (let i = 0; i < 12; i++) pe.dot(['#3a4a38', '#56684e'][i % 2], 10 + r.range(0, 12), -4 + r.range(-6, 6), 8 + r.range(0, 12), r.range(0.4, 0.9));
      boneLitter(pe, r, 9, -30, 30, 19, 24, m.boneT);
      for (let i = 0; i < 7; i++) pe.dot(al(G, 0.5), r.range(-16, 16), r.range(18, 23), 0.2, r.range(0.3, 0.7));
    }));
    return { r: 34, h: 32, parts, style: 'prop', bevel: 0.6, spots: { crown: [0, 0, H], eyes: [0, 16, 12] } };
  };

  /* =============================================================== lm_sinkhole
   * Sinkhole (decor), r 30, h 4: a black pit with a cracked rim sloping down and away
   * from it, roots dangling into the dark from the far edge, bone-pale stones at the
   * lip, a breath of green from below. */
  M.lm_sinkhole = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a', seed = opt.seed | 0;
    const inner = jag(16, 1, 21 + seed, 0.2, 0.2, 0, 0, 17, 11.5);
    const innerRev = []; for (let i = inner.length - 2; i >= 0; i -= 2) innerRev.push(inner[i], inner[i + 1]);
    const parts = [];
    parts.push({ z0: 0, z1: 3, side: '#2a2622', top: '#5a544c', ao: 0.35, bevel: false, shape: (c, zt) => { const ro = 30 - zt * 10; S.poly(c, jag(18, 1, 23 + seed, 0.14, 0.1, 0, 0, ro, ro * 0.7)); S.poly(c, innerRev); },
      detail: (c) => { const r = rng(seed, 3); c.save(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.45; for (let i = 0; i < 14; i++) { const a = r.range(0, TAU); let x = Math.cos(a) * 18.5, y = Math.sin(a) * 12.6; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += Math.cos(a + r.range(-0.6, 0.6)) * r.range(2, 4); y += Math.sin(a + r.range(-0.6, 0.6)) * r.range(1.4, 3); c.lineTo(x, y); } c.stroke(); } c.restore(); for (let i = 0; i < 10; i++) S.dot(c, 'rgba(120,112,100,0.5)', r.range(-20, 20), r.range(-13, 13), r.range(0.8, 1.6)); } });
    parts.push({ z0: 0, z1: 0.3, side: '#060504', top: '#080706', flat: true, bevel: false, shape: (c) => S.poly(c, inner),
      detail: (c) => { const g = c.createRadialGradient(0, 2, 1, 0, 2, 16); g.addColorStop(0, al(G, 0.18)); g.addColorStop(0.5, al(G, 0.05)); g.addColorStop(1, al(G, 0)); c.fillStyle = g; c.beginPath(); S.poly(c, inner); c.fill(); c.save(); c.beginPath(); S.poly(c, inner); c.clip(); const g2 = c.createLinearGradient(0, -12, 0, -2); g2.addColorStop(0, 'rgba(70,64,56,0.9)'); g2.addColorStop(1, 'rgba(70,64,56,0)'); c.fillStyle = g2; c.fillRect(-20, -13, 40, 12); c.restore(); } });
    // pale stones round the lip, roots into the dark from the far side
    const lip = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3, d = 1 + (i % 3) * 0.6; lip.push({ x: Math.cos(a) * (17 + d), y: Math.sin(a) * (11.5 + d), r: 1.6 + (i % 3) * 0.5, h: 1.2 + (i % 2) * 0.5, seed: 50 + i, n: 6, rough: 0.3 }); }
    parts.push(rockPart(lip, mx(m.boneS, '#8a8276', 0.5), mx(m.boneT, '#c8c0b0', 0.5), { ao: 0.4 }));
    const roots = [];
    for (let i = 0; i < 7; i++) { const a = Math.PI + 0.35 + i * 0.36, x0 = Math.cos(a) * 17.5, y0 = Math.sin(a) * 12; roots.push([[x0 + (i % 2 ? 1.5 : -1.2), y0 + 3.5 + (i % 3), 0.2], [x0 + (i % 2 ? 0.6 : -0.4), y0 + 1.6, 1.8], [x0, y0 - 0.5, 3]]); }
    parts.push(limbPart(roots, 0.7, '#2e2622', '#5a4e44', { ao: 0.2 }));
    parts.push(layer((pe) => {
      const r = rng(seed, 5);
      boneLitter(pe, r, 7, -26, 26, 13, 20, m.boneT);
      paintBones(pe, [[-19, -2, 'skull', 0, 1.1], [21, 4, 'bone', 0.4, 1]], m.boneT);
      for (let i = 0; i < 9; i++) pe.dot(al(G, 0.4), r.range(-10, 10), r.range(-4, 6), 0.3, r.range(0.5, 1.2));
      for (let i = 0; i < 14; i++) { const a = r.range(0, TAU); pe.lines('rgba(70,80,60,0.8)', 0.22, [Math.cos(a) * 24, Math.sin(a) * 17, 0.2, Math.cos(a) * 24 + r.range(-0.5, 0.5), Math.sin(a) * 17, r.range(1, 2)]); }
    }));
    return { r: 31, h: 4.5, parts, style: 'decor', bevel: 0.5, spots: { pit: [0, 0, 0] } };
  };

  /* ============================================================ lm_plague_cart
   * Abandoned plague cart, r 16, h 12: two spoked wheels, a plank bed with rails, a
   * tarpaulin humped over its load with a pale hand hanging out, shafts down in the
   * dirt, a green lantern on a pole (flat glow), a crow on the rail, a shovel. */
  M.lm_plague_cart = function (pal, opt) {
    opt = opt || {};
    const p = P(pal), m = blightOf(p), G = p.g || '#93ff6a';
    const tarp = mx(m.purple, '#3a3440', 0.6), tarpT = mx(m.purple, '#7a7080', 0.6);
    const parts = [greenShadow(17, 11, 0.4, 0, 2), pool(9, 5, 7, -3, G, 0.26)];
    const WX = -1, WR = 4.2, WZ = 4.2, WY = 4.6;
    const wheel = () => { const q = ringQuads(WX, WZ, WR - 0.85, WR, 16); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; q.push(barUZ(WX - Math.cos(a) * (WR - 0.5), WZ - Math.sin(a) * (WR - 0.5), WX + Math.cos(a) * (WR - 0.5), WZ + Math.sin(a) * (WR - 0.5), 0.5)); } const hub = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; hub.push(WX + Math.cos(a) * 0.8, WZ + Math.sin(a) * 0.8); } q.push(hub); return q; };
    parts.push(xzPart(wheel(), 0, WZ + WR, m.woodD, m.woodT, { oy: -WY, v0: -0.45, v1: 0.45 }, { ao: 0.15, bevel: false }));
    parts.push(beams([[WX, -WY, WZ, WX, WY, WZ]], 0.7, m.woodD, m.woodT));
    parts.push(beams([[4.4, 2.8, 4.6, 13, 2.4, 0.7], [4.4, -2.8, 4.6, 13, -2.4, 0.7], [9.6, -2.5, 2.4, 9.6, 2.5, 2.4]], 0.6, m.woodD, m.woodT));
    parts.push(box(-1.4, 0, 12, 8, 4, 5, m.woodD, m.wood, { ao: 0.2 }));
    parts.push({ z0: 5, z1: 8, side: sh(m.woodD, 0.05), top: m.woodT, stroke: 0.7, ao: 0.25, bevel: false, shape: (c) => c.rect(-7, -3.7, 11.2, 7.4) });
    // the tarpaulin humped over the load, a hand and a foot showing
    parts.push({ z0: 5, z1: 11, side: tarp, top: tarpT, ao: 0.4, shape: (c, zt) => { const k = Math.sqrt(Math.max(0.05, 1 - Math.pow(zt, 1.8))); S.blob(c, -1.6, 0.2, 1, 7, 9, 0.12); c.rect(-1.6 - 5.6 * k - 0.6, -3.4 * k - 0.4, 11.2 * k + 1.2, 6.8 * k + 0.8); },
      detail: (c) => { S.lines(c, 'rgba(0,0,0,0.45)', 0.5, [-6, -1, -2, 1.5, -2, 1.5, 3, -0.5, 1, -3, 1.5, 2.8]); S.lines(c, 'rgba(255,255,255,0.12)', 0.4, [-5, -2, -1, 0.5]); S.dot(c, 'rgba(40,20,20,0.5)', 1.5, 1.2, 1.4); } });
    parts.push(beams([[-7.4, 1, 5.4, -8.8, 2, 2.2]], 0.8, '#8a9680', '#c4d0b4', { ao: 0.2 }));
    parts.push({ z0: 1.4, z1: 2.4, side: '#8a9680', top: '#c4d0b4', ao: 0.2, bevel: false, shape: (c, zt) => { for (let i = -1; i <= 1; i++) taper(c, -8.8, 2, -9.6 + i * 0.3, 3.2 + i * 0.5, 0.3 * (1 - zt * 0.5), 0.15); } });
    parts.push({ z0: 8.2, z1: 9.6, side: '#8a9680', top: '#c4d0b4', ao: 0.2, bevel: false, shape: (c, zt) => S.ell(c, 3.6, -3.9, 1.1 * (1 - zt * 0.4), 0.6, 0.2) });
    // lantern pole and lantern, a shovel, a crow on the rail
    parts.push(beams([[4.2, -3.4, 5, 4.6, -3.6, 12]], 0.45, m.iron, m.ironT, { ao: 0 }));
    parts.push(beams([[4.6, -3.6, 12, 7, -4, 11.4]], 0.4, m.iron, m.ironT, { ao: 0 }));
    parts.push(box(7, -4, 1.8, 1.4, 8.4, 10.8, m.iron, m.ironT, { ao: 0.1, bevel: false }));
    parts.push({ z0: 8.7, z1: 10.5, side: G, top: mx(G, '#ffffff', 0.5), flat: true, bevel: false, shape: (c) => c.rect(6.3, -4.5, 1.4, 1) });
    parts.push(beams([[-5, 6, 0.4, 1, 4.2, 6.2]], 0.45, m.woodD, m.woodT, { ao: 0.1 }));
    parts.push({ z0: 0, z1: 0.9, side: m.iron, top: m.ironT, ao: 0.2, bevel: false, shape: (c) => S.poly(c, tf([-1.2, -1.4, 1.2, -1.4, 1.5, 1.2, -1.5, 1.2], -5.8, 6.3, -0.3)) });
    const cr = [[-6.2, -3.6, 8, 0.2]];
    parts.push(...crows(cr));
    parts.push(xzPart(wheel(), 0, WZ + WR, m.woodD, m.woodT, { oy: WY, v0: -0.45, v1: 0.45 }, { ao: 0.15, bevel: false }));
    parts.push(layer((pe) => {
      const r = rng(19, 2);
      crowFaces(pe, cr);
      // the lantern's light, the plague cross daubed on the side rail, planks, iron bands
      pe.glow(G, 7, -4, 9.6, 6.5, 0.55);
      pe.lines('#d8d0c0', 0.5, [-5, 3.75, 5.6, -3.4, 3.75, 7.4, -3.4, 3.75, 5.6, -5, 3.75, 7.4]);
      pe.lines('rgba(10,8,6,0.55)', 0.3, [-7, 4.02, 4.3, 4.2, 4.02, 4.3, -7, 4.02, 4.7, 4.2, 4.02, 4.7]);
      pe.lines('rgba(90,90,100,0.7)', 0.4, [-5.5, 4.03, 4.05, -5.5, 4.03, 5, 2.6, 4.03, 4.05, 2.6, 4.03, 5]);
      pe.lines('rgba(40,34,26,0.6)', 0.22, [-9.1, 2.6, 2.4, -9.5, 3.1, 1.6, -8.8, 2.6, 2.3, -9, 3.3, 1.5]);
      pe.lines('rgba(0,0,0,0.5)', 0.35, [-6.6, 3.6, 8.6, -4, 3.6, 10.6, 0, 3.4, 10.9, 2.6, 3.6, 9]);
      boneLitter(pe, r, 4, -4, 12, 6, 10, m.boneT);
      for (let i = 0; i < 5; i++) pe.dot(al(G, 0.4), 7 + r.range(-4, 4), -2 + r.range(0, 5), 0.2, r.range(0.3, 0.6));
      // ruts behind the wheels
      pe.lines('rgba(0,0,0,0.35)', 0.8, [-16, -WY - 0.6, 0, -6, -WY - 0.4, 0, -16, WY + 0.4, 0, -6, WY + 0.5, 0]);
    }));
    return { r: 16, h: 13, parts, style: 'prop', bevel: 0.6, spots: { lantern: [7, -4, 9.6] } };
  };

  /* ================================================================ gallery */
  (AS.Gallery = AS.Gallery || []).push({ group: 'Landmarks: Aldermere', bg: 'human', items: [
    { name: 'colossus statue', gen: 'lm_colossus_statue', pal: 'neutral' },
    { name: 'broken statue', gen: 'lm_broken_statue', pal: 'neutral' },
    { name: 'stone circle', gen: 'lm_stonecircle', pal: 'neutral' },
    { name: 'dragon skeleton', gen: 'lm_dragon_skeleton', pal: 'neutral' },
    { name: 'ruined tower v0', gen: 'lm_ruined_tower', pal: 'neutral', opt: { v: 0 } },
    { name: 'ruined tower v1', gen: 'lm_ruined_tower', pal: 'neutral', opt: { v: 1 } },
    { name: 'ruined tower v2', gen: 'lm_ruined_tower', pal: 'neutral', opt: { v: 2 } },
    { name: 'ruined wall', gen: 'lm_ruined_wall', pal: 'neutral', dirs: 16 },
    { name: 'burned farm', gen: 'lm_burned_farm', pal: 'neutral' },
    { name: 'hedgerow', gen: 'lm_hedgerow', pal: 'neutral', dirs: 16 },
    { name: 'stone wall', gen: 'lm_stonewall', pal: 'neutral', dirs: 16 },
    { name: 'wayshrine', gen: 'lm_wayshrine', pal: 'neutral' },
    { name: 'wagon wreck', gen: 'lm_wagon_wreck', pal: 'neutral' },
    { name: 'deserted camp', gen: 'lm_camp_deserted', pal: 'neutral' },
    { name: 'old foundation', gen: 'lm_old_foundation', pal: 'neutral' },
  ] }, { group: 'Landmarks: Sylvara', bg: 'elf', items: [
    { name: 'great tree', gen: 'lm_great_tree', pal: 'elf' },
    { name: 'giant mushroom v0', gen: 'lm_giant_mushroom', pal: 'elf', opt: { v: 0 } },
    { name: 'giant mushroom v1', gen: 'lm_giant_mushroom', pal: 'elf', opt: { v: 1 } },
    { name: 'giant mushroom v2', gen: 'lm_giant_mushroom', pal: 'elf', opt: { v: 2 } },
    { name: 'moss ruin', gen: 'lm_moss_ruin', pal: 'elf' },
    { name: 'forest temple', gen: 'lm_forest_temple', pal: 'elf', anims: 4 },
    { name: 'forgotten statue', gen: 'lm_statue_forgotten', pal: 'elf' },
    { name: 'colossal stump', gen: 'lm_colossal_stump', pal: 'elf' },
    { name: 'forest pool', gen: 'lm_forest_pool', pal: 'elf' },
  ] }, { group: 'Landmarks: Hrimgard', bg: 'ice', items: [
    { name: 'carved stone', gen: 'lm_carved_stone', pal: 'ice' },
    { name: 'huge brazier', gen: 'lm_brazier_huge', pal: 'ice', anims: 4 },
    { name: 'frozen ship', gen: 'lm_frozen_ship', pal: 'ice' },
    { name: 'ice formation v0', gen: 'lm_ice_formation', pal: 'ice', opt: { v: 0 } },
    { name: 'ice formation v1', gen: 'lm_ice_formation', pal: 'ice', opt: { v: 1 } },
    { name: 'ice formation v2', gen: 'lm_ice_formation', pal: 'ice', opt: { v: 2 } },
    { name: 'longhouse ruin', gen: 'lm_longhouse_ruin', pal: 'ice' },
    { name: 'frozen travellers', gen: 'lm_frozen_travellers', pal: 'ice' },
    { name: 'ice totem', gen: 'lm_totem_ice', pal: 'ice' },
    { name: 'frozen waterfall', gen: 'lm_frozen_waterfall', pal: 'ice' },
  ] }, { group: 'Landmarks: Morgrave', bg: 'undead', items: [
    { name: 'dark obelisk', gen: 'lm_obelisk_dark', pal: 'undead', anims: 4 },
    { name: 'gallows', gen: 'lm_gallows', pal: 'undead' },
    { name: 'mausoleum', gen: 'lm_mausoleum', pal: 'undead' },
    { name: 'bone totem', gen: 'lm_bone_totem', pal: 'undead' },
    { name: 'ruined chapel', gen: 'lm_ruined_chapel', pal: 'undead' },
    { name: 'dead colossal tree', gen: 'lm_dead_colossal_tree', pal: 'undead' },
    { name: 'giant skull', gen: 'lm_giant_skull', pal: 'undead' },
    { name: 'sinkhole', gen: 'lm_sinkhole', pal: 'undead' },
    { name: 'plague cart', gen: 'lm_plague_cart', pal: 'undead' },
  ] });
})(window.AS);
