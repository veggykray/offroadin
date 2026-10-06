/* WYRMCROWN — neutral objectives and props (sites, village pieces, magic places).
 * Stacked models for AS.Forge. Sites are 1-direction sheets (they never rotate), so
 * besides real geometry they use "paint layers": zero-height parts whose detail draws
 * in projected screen space, (x, y, z) -> (x, y - z), to put windows, timber frames,
 * thatch courses, runes and swirls exactly onto walls and roof planes. Bridge, fence
 * and cart are 16-direction sheets and use geometry only (modelled along +x).
 * Every generator: AS.Models.<gen>(pal, opt), opt optional, palette keys optional.
 * opt.owner (palette key or object) recolours banners with that faction's k / k2
 * while keeping the site's own materials (a captured site). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});

  /* ================================================================ helpers */
  const DEF = { a: '#7c6c5a', b: '#bcac8c', t: '#c79e52', g: '#ffcf6a', d: '#3a2b1f', k: '#8a8070', k2: '#d8ccb0', w: '#5e4430', s: '#a89a80', skin: '#e2bc98' };
  function P(pal, opt) {
    const p = Object.assign({}, DEF);
    if (pal) for (const key in pal) if (typeof pal[key] === 'string' && pal[key]) p[key] = pal[key];
    const o = opt && opt.owner;
    const op = typeof o === 'string' ? (AS.Data && AS.Data.pal && AS.Data.pal[o]) : o;
    if (op && typeof op === 'object') { if (op.k) p.k = op.k; if (op.k2) p.k2 = op.k2; }
    return p;
  }
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const al = (c, a) => C.str(c, a);
  const rng = (seed, salt) => new U.RNG((((seed | 0) + 3) * 7919 + (salt || 0) * 104729 + 17) >>> 0);
  const res = () => (AS.Forge && AS.Forge.res) || 2;
  const dzOf = (z0, z1) => (z1 - z0) / Math.max(1, Math.round((z1 - z0) * res()));
  const lerp = (a, b, t) => a + (b - a) * t;
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
        // draw the stretch of this beam that lies within the slice band [z, z + dz)
        if (z + dz < lo - 0.01 || z > hi + 0.01) continue;
        if (hi - lo < 0.05) { if (z <= lo + 0.01 && z + dz > lo - 0.01) { c.moveTo(b[0], b[1]); c.lineTo(b[3], b[4]); } continue; }
        const at = (zz) => { const t = U.clamp((zz - b[2]) / (b[5] - b[2]), 0, 1); return [b[0] + (b[3] - b[0]) * t, b[1] + (b[4] - b[1]) * t]; };
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
      const z = U.clamp(z0 + zt * (z1 - z0), z0 + 0.02, z1 - 0.02);
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
  /* (u, z) helpers for profiles */
  const ringQuads = (cu, cz, r0, r1, n, a0, a1) => { const out = []; a0 = a0 || 0; a1 = a1 === undefined ? TAU : a1; for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n; out.push([cu + Math.cos(t0) * r0, cz + Math.sin(t0) * r0, cu + Math.cos(t0) * r1, cz + Math.sin(t0) * r1, cu + Math.cos(t1) * r1, cz + Math.sin(t1) * r1, cu + Math.cos(t1) * r0, cz + Math.sin(t1) * r0]); } return out; };
  const barUZ = (u0, z0, u1, z1, w) => { const dx = u1 - u0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; return [u0 + nx, z0 + nz, u1 + nx, z1 + nz, u1 - nx, z1 - nz, u0 - nx, z0 - nz]; };

  /* Weathered boulders: each rock {x, y, r, h, seed, n, rough, sx, sy, top (top radius
   * fraction), lx, ly (lean at the top)} tapers to a rounded crown. One part per group. */
  const rockK = (R, q) => { const tp = R.top === undefined ? 0.16 : R.top; return tp + (1 - tp) * Math.sqrt(Math.max(0, 1 - Math.pow(q, R.pw || 2.2))); };
  const rockSect = (R, z) => { const q = U.clamp(z / R.h, 0, 1), k = rockK(R, q); return xf(R.base, k, k, 0, 0, R.x + (R.lx || 0) * q, R.y + (R.ly || 0) * q); };
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
  /* moss clumps on rock crowns (dark base, mid body, sunlit top-left dabs) + cracks.
   * Painted in projected space (1-direction models only). */
  const MOSS = ['#3c5622', '#557a2c', '#7a9c40', '#a6c25e'];
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
        pe.lines('rgba(30,26,22,0.4)', 0.32, s);
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
  function rune(pe, x, y, z, s, col, gi, a) {
    const g = GLYPHS[((gi % GLYPHS.length) + GLYPHS.length) % GLYPHS.length], seg = [];
    for (let i = 0; i < g.length; i += 4) seg.push(x + g[i] * s, y, z + g[i + 1] * s, x + g[i + 2] * s, y, z + g[i + 3] * s);
    pe.lines(al(col, 0.28 * (a === undefined ? 1 : a)), s * 0.42, seg);
    pe.lines(al(mx(col, '#ffffff', 0.55), 0.95 * (a === undefined ? 1 : Math.max(0.35, a))), s * 0.16, seg);
  }
  /* a lying cylinder (column drum, log) along angle a: cross-section at height z */
  function lyingCyl(c, x, y, len, R, a, z, sink) {
    const v = (sink || 0) + (z / (R * 2)) * (2 - (sink || 0)) - 1, hw = R * Math.sqrt(Math.max(0.03, 1 - v * v));
    S.poly(c, tf([-len / 2, -hw, len / 2, -hw, len / 2, hw, -len / 2, hw], x, y, a));
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
      glow(col, x, y, z, r, a) { const g = c.createRadialGradient(x, y - z, 0, x, y - z, r); g.addColorStop(0, C.str(col, a === undefined ? 0.8 : a)); g.addColorStop(1, C.str(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y - z, r, 0, TAU); c.fill(); },
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
  /* lit window on a south wall: sill at z, centred at x */
  function win(pe, x, y, z, w, h, o) {
    o = o || {};
    const fr = o.frame || '#3b2a1c', c = pe.c;
    if (o.shut) { pe.wall(o.shut, x - w / 2 - 0.4 - w * 0.48, x - w / 2 - 0.2, y, z - 0.1, z + h + 0.1); pe.wall(o.shut, x + w / 2 + 0.2, x + w / 2 + 0.4 + w * 0.48, y, z - 0.1, z + h + 0.1); pe.lines('rgba(20,14,8,0.45)', 0.25, [x - w / 2 - 0.3 - w * 0.24, y, z, x - w / 2 - 0.3 - w * 0.24, y, z + h, x + w / 2 + 0.3 + w * 0.24, y, z, x + w / 2 + 0.3 + w * 0.24, y, z + h]); }
    archRect(pe, fr, x - w / 2 - 0.45, x + w / 2 + 0.45, y, z - 0.4, z + h + 0.45, o.arch);
    let g;
    if (o.dark) g = o.dark === true ? '#1c1612' : o.dark;
    else { g = c.createLinearGradient(0, y - z - h, 0, y - z); g.addColorStop(0, o.g1 || '#fff2b8'); g.addColorStop(0.55, o.g2 || '#ffc860'); g.addColorStop(1, o.g3 || '#d8782a'); }
    archRect(pe, g, x - w / 2, x + w / 2, y, z, z + h, o.arch);
    if (!o.dark && o.mull !== false) pe.lines(fr, 0.35, [x, y, z, x, y, z + h - (o.arch ? 0.2 : 0), x - w / 2, y, z + h * 0.52, x + w / 2, y, z + h * 0.52]);
    if (o.sill !== false) pe.wall(o.sillCol || '#cfc2a2', x - w / 2 - 0.75, x + w / 2 + 0.75, y + 0.02, z - 0.85, z - 0.3);
    if (o.box) { pe.wall('#4a3422', x - w / 2 - 0.4, x + w / 2 + 0.4, y + 0.04, z - 1.9, z - 0.85); for (let i = 0; i < 5; i++) pe.dot(['#e85a6a', '#f2d24a', '#f0f0f0', '#d84a8a', '#6aa84a'][(i + (x | 0)) % 5], x - w / 2 + (i + 0.5) * w / 5, y + 0.05, z - 0.75 + (i % 2) * 0.25, 0.42); }
  }
  /* plank door with frame, straps and a ring */
  function door(pe, x, y, w, h, wood, o) {
    o = o || {};
    archRect(pe, o.frame || '#3a2a1e', x - w / 2 - 0.5, x + w / 2 + 0.5, y, 0, h + 0.5, o.arch);
    archRect(pe, wood, x - w / 2, x + w / 2, y, 0, h, o.arch);
    const s = [];
    for (let i = 1; i < 4; i++) { const xx = x - w / 2 + (w * i) / 4; s.push(xx, y, 0, xx, y, h - (o.arch ? w * 0.18 : 0.1)); }
    pe.lines('rgba(25,15,8,0.45)', 0.28, s);
    pe.wall('rgba(28,24,22,0.85)', x - w / 2, x + w / 2 - 0.3, y, h * 0.22, h * 0.22 + 0.38);
    pe.wall('rgba(28,24,22,0.85)', x - w / 2, x + w / 2 - 0.3, y, h * 0.66, h * 0.66 + 0.38);
    pe.dot('#d8b060', x + w * 0.28, y, h * 0.45, 0.3);
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
        c.fillStyle = tint < 0.3 ? 'rgba(255,250,235,0.16)' : tint > 0.75 ? 'rgba(30,24,18,0.16)' : 'rgba(0,0,0,0)'; c.fill();
        c.strokeStyle = o.joint || 'rgba(40,32,24,0.42)'; c.lineWidth = 0.3; c.stroke();
        x += w;
      }
    }
    c.restore();
  }

  /* ------------------------------------------------------------------ roofs
   * Hip roof (gable when Lr == L) built as one stacked part per roof plane, drawn back
   * to front so each plane keeps its own colour: north and west planes catch the
   * top-left sun, south is mid, east is shaded. ax 'y' turns the ridge north-south
   * (the gable end faces the camera). clip(pts, z) may trim each slice (valleys). */
  function roof(o) {
    const L = o.L, W = o.W, Lr = o.Lr === undefined ? L : Math.min(o.Lr, L), H = o.H, z0 = o.z, ex = o.ex || 1;
    const ay = o.ax === 'y';
    const mp = ay ? (u, v) => [o.x + v, o.y + u] : (u, v) => [o.x + u, o.y + v];
    const kq = (zt) => Math.pow(Math.max(0, 1 - zt), ex);
    const dims = (zt) => { const k = kq(zt); return [Lr + (L - Lr) * k, W * k]; };
    const REG = {
      lo: (l, w) => [-l, -w, l, -w, Lr, 0, -Lr, 0],
      hi: (l, w) => [-l, w, -Lr, 0, Lr, 0, l, w],
      ua: (l, w) => [-l, -w, -Lr, 0, -l, w],
      ub: (l, w) => [l, -w, l, w, Lr, 0],
    };
    const toXY = (uv) => { const out = []; for (let i = 0; i < uv.length; i += 2) { const m = mp(uv[i], uv[i + 1]); out.push(m[0], m[1]); } return out; };
    const cols = o.cols;
    const colOf = ay ? { lo: cols.W, hi: cols.E, ua: cols.N, ub: cols.S } : { lo: cols.N, hi: cols.S, ua: cols.W, ub: cols.E };
    const order = ay ? ['ua', 'lo', 'hi', 'ub'] : ['lo', 'ua', 'ub', 'hi'];
    const slice = (r, zt) => { const d = dims(zt); let pts = toXY(REG[r](d[0], d[1])); if (o.clip) pts = o.clip(pts, z0 + zt * H); return pts; };
    const parts = [];
    if (o.fascia) parts.push({ z0: z0 - o.fascia, z1: z0 + 0.01, side: o.fasciaCol || sh(cols.S, -0.12), top: cols.S, ao: 0.3, bevel: false, shape: (c) => { let pts = toXY([-L, -W, L, -W, L, W, -L, W]); if (o.clip) pts = o.clip(pts, z0); polyOK(c, pts); } });
    for (const r of order) {
      if ((r === 'ua' || r === 'ub') && L - Lr < 0.05) continue;
      parts.push({ z0, z1: z0 + H, side: colOf[r], top: colOf[r], ao: o.ao === undefined ? 0.16 : o.ao, bevel: false, shape: (c, zt) => polyOK(c, slice(r, zt)) });
    }
    const R = {
      parts, L, W, Lr, H, z0, ex, ay, mp,
      contour(z) { const zt = U.clamp((z - z0) / H, 0, 1), d = dims(zt), xy = toXY([-d[0], -d[1], d[0], -d[1], d[0], d[1], -d[0], d[1]]); const out = []; for (let i = 0; i < 8; i += 2) out.push(xy[i], xy[i + 1], z); return out; },
      /* union of every slice, projected — the roof's exact screen footprint (for clipping paint) */
      clipPath(c) {
        const n = Math.max(2, Math.round(H * res()));
        for (let i = 0; i <= n; i++) {
          const zt = i / n, z = z0 + zt * H;
          for (const r of order) { if ((r === 'ua' || r === 'ub') && L - Lr < 0.05) continue; const pts = slice(r, zt); if (pts.length < 6) continue; c.moveTo(pts[0], pts[1] - z); for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1] - z); c.closePath(); }
        }
        if (o.fascia) { let pts = toXY([-L, -W, L, -W, L, W, -L, W]); if (o.clip) pts = o.clip(pts, z0); for (let zz = z0 - o.fascia; zz <= z0; zz += 0.5) { if (pts.length < 6) break; c.moveTo(pts[0], pts[1] - zz); for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1] - zz); c.closePath(); } }
      },
      /* surface point at local (u, v): [x, y, z, du, dv] with the downslope direction */
      surf(u, v) {
        const fv = Math.abs(v) / W, fu = L - Lr > 0.05 ? Math.max(0, Math.abs(u) - Lr) / (L - Lr) : 0;
        const f = Math.min(1, Math.max(fv, fu)), zt = 1 - Math.pow(f, 1 / ex), m = mp(u, v);
        return fv >= fu ? [m[0], m[1], z0 + zt * H, 0, Math.sign(v) || 1] : [m[0], m[1], z0 + zt * H, Math.sign(u) || 1, 0];
      },
      ridge() { const a = mp(-Lr, 0), b = mp(Lr, 0); return [a[0], a[1], b[0], b[1], z0 + H]; },
    };
    return R;
  }
  /* thatch: course lines along the contours, straw strokes running downslope */
  function paintThatch(pe, R, seed, o) {
    o = o || {};
    const c = pe.c, base = o.col || '#c79e52';
    c.save(); c.beginPath(); R.clipPath(c); c.clip();
    const n = Math.max(2, Math.round(R.H / (o.step || 1.6)));
    for (let i = 1; i < n; i++) {
      const z = R.z0 + R.H * (1 - Math.pow(1 - i / n, 1)) - 0.2;
      const q = R.contour(z);
      c.beginPath(); pe.path(q); c.strokeStyle = al(sh(base, -0.55), 0.32); c.lineWidth = 0.55; c.stroke();
      c.save(); c.translate(0, 0.55); c.beginPath(); pe.path(q); c.strokeStyle = al(sh(base, 0.5), 0.2); c.lineWidth = 0.45; c.stroke(); c.restore();
    }
    const r = rng(seed, 9), N = o.n || Math.round(R.L * R.W * 0.9);
    c.lineWidth = 0.32;
    for (let i = 0; i < N; i++) {
      const u = r.range(-R.L, R.L), v = r.range(-R.W, R.W), s = R.surf(u, v);
      const e = R.surf(u + s[3] * 1.1, v + s[4] * 1.1);
      c.beginPath(); c.moveTo(s[0], s[1] - s[2]); c.lineTo(e[0], e[1] - e[2]);
      c.strokeStyle = r.next() < 0.5 ? al(sh(base, -0.5), 0.3) : al(sh(base, 0.45), 0.28); c.stroke();
    }
    // sunlit ridge and hip arrises
    { const rg = R.ridge(), zt = R.z0 + R.H - 0.15, cs = R.contour(R.z0 + 0.05);
      const s = [rg[0], rg[1], zt, rg[2], rg[3], zt];
      if (R.L - R.Lr > 0.05) s.push(rg[0], rg[1], zt, cs[0], cs[1], cs[2], rg[0], rg[1], zt, cs[9], cs[10], cs[11], rg[2], rg[3], zt, cs[3], cs[4], cs[5], rg[2], rg[3], zt, cs[6], cs[7], cs[8]);
      pe.lines(al(sh(base, 0.6), 0.42), 0.55, s); }
    // darker band along the eave lip
    if (o.eave !== false) { c.beginPath(); const q = R.contour(R.z0 + 0.15); pe.path(q); c.strokeStyle = al(sh(base, -0.6), 0.35); c.lineWidth = 0.9; c.stroke(); }
    c.restore();
  }
  /* shingles / slates: rows along contours with staggered joints */
  function paintShingles(pe, R, seed, o) {
    o = o || {};
    const c = pe.c, base = o.col || '#7a5a44';
    c.save(); c.beginPath(); R.clipPath(c); c.clip();
    const rowZ = o.row || 1.1, n = Math.max(2, Math.round(R.H / rowZ));
    for (let i = 1; i <= n; i++) {
      const z = R.z0 + (R.H * i) / n - 0.05, q = R.contour(z);
      c.beginPath(); pe.path(q); c.strokeStyle = al(sh(base, -0.55), 0.42); c.lineWidth = 0.4; c.stroke();
      c.save(); c.translate(0, 0.4); c.beginPath(); pe.path(q); c.strokeStyle = al(sh(base, 0.4), 0.18); c.lineWidth = 0.35; c.stroke(); c.restore();
    }
    const r = rng(seed, 4), N = o.n || Math.round(R.L * R.W * 1.2);
    for (let i = 0; i < N; i++) {
      const u = r.range(-R.L, R.L), v = r.range(-R.W, R.W), s = R.surf(u, v);
      const e = R.surf(u + s[3] * 0.55, v + s[4] * 0.55);
      c.beginPath(); c.moveTo(s[0], s[1] - s[2]); c.lineTo(e[0], e[1] - e[2]);
      c.strokeStyle = al(sh(base, -0.5), 0.35); c.lineWidth = 0.28; c.stroke();
      if (r.next() < 0.18) { c.beginPath(); c.moveTo(s[0] + 0.2, s[1] - s[2]); c.lineTo(e[0] + 0.2, e[1] - e[2]); c.strokeStyle = al(sh(base, r.next() < 0.5 ? 0.3 : -0.3), 0.5); c.lineWidth = 0.6; c.stroke(); }
    }
    c.restore();
  }
  /* gable end facing the camera (ax 'y' roofs): plaster triangle with timbers */
  function paintGable(pe, R, fill, o) {
    o = o || {};
    const ys = R.mp(R.L, 0)[1] + 0.02, xc = R.mp(0, 0)[0], b = o.inset === undefined ? 1.1 : o.inset;
    const w = R.W - b * 1.5, zt = R.z0 + R.H - b * 1.3, zb = R.z0 + (o.drop || 0);
    pe.poly(fill, [xc - w, ys, zb, xc + w, ys, zb, xc, ys, zt]);
    if (o.timber) {
      const tc = o.timber;
      pe.lines(tc, 0.7, [xc - w, ys, zb + 0.3, xc + w, ys, zb + 0.3, xc, ys, zb, xc, ys, zt - 0.4, xc - w * 0.5, ys, zb, xc - w * 0.5, ys, zb + (zt - zb) * 0.5, xc + w * 0.5, ys, zb, xc + w * 0.5, ys, zb + (zt - zb) * 0.5]);
    }
    if (o.vent) archRect(pe, o.vent, xc - 0.9, xc + 0.9, ys, zb + (zt - zb) * 0.38, zb + (zt - zb) * 0.38 + 2.4, true);
    if (o.win) win(pe, xc, ys, zb + (zt - zb) * 0.22, 2, 2.4, o.win);
    // shadow under the barge boards
    pe.lines('rgba(30,20,10,0.35)', 0.6, [xc - w, ys, zb + 0.1, xc, ys, zt - 0.1, xc, ys, zt - 0.1, xc + w, ys, zb + 0.1]);
  }

  /* -------------------------------------------------------------- banners
   * Painted cloth on a pole for 1-direction sites: waves with light/dark folds,
   * k body with a k2 stripe and swallowtail. Pole + finial are geometry. */
  function flagPole(x, y, z0, h, p, extra) {
    return [
      cyl(x, y, 0.45, z0, z0 + h, sh(p.w, -0.2), sh(p.w, 0.2), Object.assign({ ao: 0.2, bevel: false }, extra || {})),
      cyl(x, y, 0.75, z0 + h, z0 + h + 1.1, '#a8823a', '#f2d47a', { ao: 0.1, bevel: false }),
    ];
  }
  function paintFlag(pe, x, y, zt, len, hgt, anim, k, k2, o) {
    o = o || {};
    const c = pe.c, N = 10, ph = anim * TAU + (o.ph || 0), amp = o.amp === undefined ? 1.1 : o.amp, dir = o.dir || 1;
    const wave = (u) => Math.sin(u / len * 5.2 - ph) * amp * (0.25 + u / len) - (o.droop || 0.25) * u / len * hgt;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * len, dz = wave(u), ss = Math.cos(u / len * 5.2 - ph) * 0.35 * (u / len);
      top.push([x + u * dir * (1 - 0.06 * Math.abs(ss)), y + ss, zt + dz]);
      bot.push([x + u * dir * (1 - 0.06 * Math.abs(ss)), y + ss, zt - hgt + dz * 1.1]);
    }
    const tail = o.tail !== false;
    const outline = [];
    for (const q of top) outline.push(q[0], q[1], q[2]);
    if (tail) { const a = top[N], b = bot[N]; outline.push(a[0] - len * 0.18 * dir, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); }
    for (let i = N; i >= 0; i--) outline.push(bot[i][0], bot[i][1], bot[i][2]);
    pe.poly(k, outline);
    // k2 stripe through the middle
    const st = [];
    for (let i = 0; i <= N; i++) st.push(top[i][0], top[i][1], lerp(top[i][2], bot[i][2], 0.36));
    for (let i = N; i >= 0; i--) st.push(bot[i][0], bot[i][1], lerp(top[i][2], bot[i][2], 0.62));
    c.save(); c.beginPath(); pe.path(outline); c.clip();
    pe.poly(k2, st);
    // folds: shade by wave slope
    for (let i = 0; i < N; i++) {
      const s = Math.cos(((i + 0.5) / N) * 5.2 - ph);
      const q = [top[i][0], top[i][1], top[i][2] + 0.5, top[i + 1][0], top[i + 1][1], top[i + 1][2] + 0.5, bot[i + 1][0], bot[i + 1][1], bot[i + 1][2] - 0.5, bot[i][0], bot[i][1], bot[i][2] - 0.5];
      pe.poly(s > 0 ? 'rgba(255,255,255,' + (0.18 * s).toFixed(3) + ')' : 'rgba(0,0,0,' + (-0.26 * s).toFixed(3) + ')', q);
    }
    c.restore();
    c.beginPath(); pe.path(outline); c.strokeStyle = al(sh(k, -0.6), 0.85); c.lineWidth = 0.35; c.stroke();
  }

  /* Embed another model's parts at (dx, dy, dz), rotated by rot (props inside sites).
   * Path points are transformed when they are added, so wrapping shape and detail in a
   * save / translate / restore is enough. Optional 'only' filters parts. */
  function embed(model, dx, dy, dz, rot) {
    dz = dz || 0; rot = rot || 0;
    return model.parts.filter((pt) => !pt.isStain).map((pt) => Object.assign({}, pt, {
      z0: pt.z0 + dz, z1: pt.z1 + dz,
      shape: (c, zt, an) => { c.save(); c.translate(dx, dy); if (rot) c.rotate(rot); pt.shape(c, zt, an); c.restore(); },
      detail: pt.detail ? (c, an) => { c.save(); c.translate(dx, dy); if (rot) c.rotate(rot); pt.detail(c, an); c.restore(); } : undefined,
    }));
  }

  /* Broken curtain walls: a run of points is cut into ~seg-long pieces, each with
   * its own height; intact pieces carry merlons on the outer edge (out = ±1 side of
   * the run direction), broken ones get a ragged slanting top. */
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
    const mh = o.mh || 2.2, ml = o.ml || 2.2, mg = o.mg || 1.7, out = o.out || 1;
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
          if (!q.cren && z > q.h - 3) { const cut = (z - (q.h - 3)) / 3; if (q.slope > 0) b = len * (1 - cut * 0.75); else a = len * cut * 0.75; }
          quad(a, b, -w, w);
        }
      }
    } }, o.extra || {});
  }
  /* visible face paint for walls running along x (south faces): stone courses */
  function paintWallFaces(pe, segs, th, seed, o) {
    o = o || {};
    for (const q of segs) {
      if (Math.abs(q.y1 - q.y0) > 0.5) continue;
      const y = Math.max(q.y0, q.y1) + th / 2 + 0.02, x0 = Math.min(q.x0, q.x1), x1 = Math.max(q.x0, q.x1), top = q.cren ? q.h : q.h - 3;
      if (top > 0.6) stones(pe, x0, x1, y, 0, top, seed + (x0 | 0), { row: o.row || 1.6, w: 1.4, joint: 'rgba(40,34,28,0.32)' });
      if (o.slits && q.cren && q.h > 9 && ((x0 | 0) % 3 === 0)) archRect(pe, '#1e1812', (x0 + x1) / 2 - 0.5, (x0 + x1) / 2 + 0.5, y + 0.01, q.h * 0.45, q.h * 0.45 + 3, true);
      if (q.cren) pe.wall('rgba(255,250,230,0.16)', x0, x1, y - th + 0.04, q.h - 0.01, q.h);
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

  /* materials shared by the village pieces */
  function mats(p) {
    return {
      plaster: mx(p.b, '#f4ecd8', 0.55), plasterS: mx(p.b, '#e6dcc4', 0.35),
      timber: mx(p.w, '#2a1c12', 0.25), wood: p.w, woodL: sh(p.w, 0.22), woodD: sh(p.w, -0.35),
      stoneS: mx(p.a, '#8a8a84', 0.35), stoneT: mx(p.s, '#c8c2b2', 0.35), stoneD: mx(p.a, '#4a4842', 0.45),
      rockS: mx(p.s, '#8e8d86', 0.5), rockT: mx(p.b, '#c4c0b2', 0.45),
      thatch: p.t, glow: p.g, iron: '#3c3a3a', ironL: '#7a7874',
      thatchCols: { N: sh(p.t, 0.28), W: sh(p.t, 0.16), S: sh(p.t, -0.05), E: sh(p.t, -0.3) },
    };
  }

  /* ======================================================== site_cottage
   * Thatched village cottage, opt.v 0-3:
   *  0 timber-framed cottage under a rounded hip thatch, chimney at the east end
   *  1 fieldstone cottage, gable end to the front, lean-to woodshed
   *  2 L-shaped farmhouse: hip roof + front wing gable (valley-clipped)
   *  3 roundhouse: cob wall, conical thatch, little garden fence
   * ================================================================== */
  M.site_cottage = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), m = mats(p), v = (((opt.v | 0) % 4) + 4) % 4;
    const parts = [stain(24, 16, 0.32, '#2a2216', 0, 3)];
    let H = 20, r = 21, smoke = null;
    const plinth = (x, y, w, d) => box(x, y, w, d, 0, 1.2, m.stoneD, m.stoneS, { ao: 0.3 });
    if (v === 0) {
      const Ww = 7, Lw = 12, Hw = 9;
      parts.push(plinth(0, 0, Lw * 2 + 1, Ww * 2 + 1));
      parts.push(box(0, 0, Lw * 2, Ww * 2, 1.2, Hw, m.plasterS, m.plaster, { ao: 0.3 }));
      parts.push(layer((pe) => {
        const y = Ww + 0.01;
        stones(pe, -Lw - 0.5, Lw + 0.5, Ww + 0.51, 0, 1.2, 3, { row: 0.6, w: 0.8 });
        pe.wall(m.timber, -Lw, Lw, y, 1.2, 1.9);
        pe.wall(m.timber, -Lw, Lw, y, 5.6, 6.2);
        for (const x of [-Lw, -6.5, 1.5, 6, Lw - 0.7]) pe.wall(m.timber, x, x + 0.7, y, 1.2, Hw);
        pe.lines(m.timber, 0.6, [-Lw + 0.6, y, 1.9, -6.6, y, 5.6, Lw - 0.6, y, 1.9, 6.1, y, 5.6]);
        door(pe, -2.4, y, 3, 5.2, m.woodL, { arch: true });
        win(pe, -9.3, y, 2.6, 2.2, 2.4, { shut: '#4f6e5a', box: true });
        win(pe, 3.7, y, 2.6, 2.2, 2.4, { shut: '#4f6e5a' });
        win(pe, 9.2, y, 2.6, 2.0, 2.4, {});
      }));
      parts.push(box(-2.4, Ww + 0.7, 4.2, 1.6, 0, 0.6, m.stoneD, m.stoneT, { bevel: false }));
      const R = roof({ x: 0, y: 0, L: Lw + 1.6, W: Ww + 1.7, Lr: Lw - 5, z: Hw, H: 7.5, ex: 0.78, fascia: 1.1, cols: m.thatchCols });
      parts.push(...R.parts);
      parts.push(layer((pe) => paintThatch(pe, R, 11, { col: p.t })));
      // stone chimney rising out of the east hip
      parts.push(box(8.5, -1.5, 2.8, 2.8, 12.5, 19.5, m.stoneS, m.stoneT, { ao: 0.2, detail: (c) => { S.dot(c, '#1a1410', 8.5, -1.5, 0.8); } }));
      parts.push(layer((pe) => { stones(pe, 7.1, 9.9, -0.1, 12.5, 19.5, 7, { row: 1.2, w: 0.6 }); pe.wall('rgba(0,0,0,0.25)', 7.1, 9.9, -0.08, 18.6, 19.5); }));
      parts.push(box(0, 0, 2.2, 2.2, 15.6, 16.8, sh(p.t, -0.3), sh(p.t, -0.1), { bevel: false, shape: (c) => S.rrect(c, -Lw + 4.4, -1.1, (Lw - 4.4) * 2, 2.2, 1) }));
      // woodpile + barrel
      parts.push({ z0: 0, z1: 3.2, side: m.woodD, top: m.woodL, ao: 0.3, shape: (c) => c.rect(Lw + 0.8, -3, 2.6, 7) });
      parts.push(layer((pe) => { for (let i = 0; i < 6; i++) pe.dot(i % 2 ? '#c8a070' : '#b08858', Lw + 1.4 + (i % 2) * 1.2, 4.05, 0.7 + Math.floor(i / 2) * 0.95, 0.5); }));
      parts.push(cyl(-7, Ww + 2.2, 1.2, 0, 3, m.woodD, m.wood, { detail: (c) => { S.dot(c, '#2a2018', -7, Ww + 2.2, 0.9); } }));
      smoke = [8.5, -1.5, 20]; H = 21; r = 18;
    } else if (v === 1) {
      const Ww = 8, Lw = 10, Hw = 8;
      parts.push(plinth(0, 0, Ww * 2 + 1, Lw * 2 + 1));
      parts.push(box(0, 0, Ww * 2, Lw * 2, 1.2, Hw, m.stoneS, m.stoneT, { ao: 0.35 }));
      // lean-to woodshed on the east side
      parts.push(box(Ww + 3, 3, 6, 11, 0, 4.6, m.woodD, m.wood, { ao: 0.35 }));
      parts.push({ z0: 4.6, z1: 6.4, side: sh(p.t, -0.25), top: sh(p.t, -0.08), ao: 0.15, bevel: false, shape: (c, zt) => c.rect(Ww - 0.2, -3.6, 7.2 * (1 - zt * 0.85) + 0.4, 13.2) });
      parts.push(layer((pe) => {
        const y = Lw + 0.01;
        stones(pe, -Ww, Ww, y, 1.2, Hw, 21, { row: 1.25 });
        stones(pe, -Ww - 0.5, Ww + 0.5, Lw + 0.51, 0, 1.2, 4, { row: 0.6, w: 0.8 });
        door(pe, -2.6, y, 3, 5.2, m.woodL, { arch: true });
        win(pe, 3.6, y, 2.2, 2.4, 2.6, { shut: '#6a4a3a', box: true });
        // shed front: stacked logs
        pe.wall(m.woodD, Ww + 0.2, Ww + 5.8, 8.51, 0, 4.4);
        for (let i = 0; i < 12; i++) pe.dot(i % 3 ? '#b88c5c' : '#d0a874', Ww + 1 + (i % 4) * 1.35, 8.53, 0.7 + Math.floor(i / 4) * 1.2, 0.6);
      }));
      const R = roof({ x: 0, y: 0, L: Lw + 1.4, W: Ww + 1.6, z: Hw, H: 8.5, ax: 'y', fascia: 0.9, cols: m.thatchCols });
      parts.push(...R.parts);
      parts.push(layer((pe) => {
        paintThatch(pe, R, 23, { col: p.t });
        paintGable(pe, R, m.plaster, { timber: m.timber, win: { shut: false, sill: false }, drop: 0.2 });
      }));
      parts.push(box(0, -6, 2.8, 2.8, 13, 19.5, m.stoneS, m.stoneT, { ao: 0.2, detail: (c) => S.dot(c, '#1a1410', 0, -6, 0.8) }));
      parts.push(layer((pe) => stones(pe, -1.4, 1.4, -4.58, 13, 19.5, 9, { row: 1.2, w: 0.6 })));
      parts.push(box(0, Lw + 0.8, 4.2, 1.6, 0, 0.6, m.stoneD, m.stoneT, { bevel: false }));
      smoke = [0, -6, 20]; H = 20; r = 17;
    } else if (v === 2) {
      // main block along x + a front wing gable at the west end
      const Hw = 8.5;
      parts.push(plinth(0, -3, 29, 13));
      parts.push(plinth(-8, 5, 13, 12));
      parts.push(box(0, -3, 28, 12, 1.2, Hw, m.plasterS, m.plaster, { ao: 0.3 }));
      parts.push(box(-8, 5, 12, 11, 1.2, Hw, m.plasterS, m.plaster, { ao: 0.3 }));
      parts.push(layer((pe) => {
        const y = 3.01;
        pe.wall(m.timber, -2, 14, y, 1.2, 1.9); pe.wall(m.timber, -2, 14, y, 5.4, 6);
        for (const x of [-2, 5, 13.3]) pe.wall(m.timber, x, x + 0.7, y, 1.2, Hw);
        door(pe, 2.2, y, 3, 5.2, m.woodL, { arch: false });
        win(pe, 9.2, y, 2.4, 2.4, 2.6, { shut: '#7a4a3a', box: true });
        const y2 = 10.51;
        stones(pe, -14.5, -1.5, 11.01, 0, 1.2, 6, { row: 0.6, w: 0.8 });
        pe.wall(m.timber, -14, -2, y2, 1.2, 1.9);
        for (const x of [-14, -8.35, -2.7]) pe.wall(m.timber, x, x + 0.7, y2, 1.2, Hw);
        pe.lines(m.timber, 0.6, [-13.4, y2, 1.9, -8.4, y2, Hw - 0.5, -2.6, y2, 1.9, -7.7, y2, Hw - 0.5]);
        win(pe, -11, y2, 2.2, 2.4, 2.4, {});
        win(pe, -5, y2, 2.2, 2.4, 2.4, {});
      }));
      const RM = roof({ x: 0, y: -3, L: 15.5, W: 7.6, Lr: 9, z: Hw, H: 7, ex: 0.8, fascia: 1, cols: m.thatchCols });
      // the wing roof dives into the main roof: trim each slice at the main south plane
      const mainY = (z) => -3 + 7.6 * Math.pow(Math.max(0, 1 - (z - Hw) / 7), 0.8);
      const RW = roof({ x: -8, y: 5.5, L: 7.2, W: 7.6, z: Hw, H: 6.4, ax: 'y', fascia: 0.9, cols: m.thatchCols, clip: (pts, z) => clipHalf(pts, 0, 1, mainY(z) - 0.2) });
      parts.push(...RM.parts);
      parts.push(layer((pe) => paintThatch(pe, RM, 31, { col: p.t })));
      parts.push(box(10, -5, 2.6, 2.6, 12, 18.5, m.stoneS, m.stoneT, { ao: 0.2, detail: (c) => S.dot(c, '#1a1410', 10, -5, 0.75) }));
      parts.push(layer((pe) => stones(pe, 8.7, 11.3, -3.68, 12, 18.5, 8, { row: 1.2, w: 0.6 })));
      parts.push(...RW.parts);
      parts.push(layer((pe) => { paintThatch(pe, RW, 33, { col: p.t }); paintGable(pe, RW, m.plaster, { timber: m.timber, vent: '#2a2018' }); }));
      // a little bench and a cart wheel against the wall
      parts.push(box(9, 4.6, 5, 1.4, 1.1, 1.8, m.woodD, m.woodL, { bevel: false }));
      parts.push(beams([[7, 4.6, 0, 7, 4.6, 1.2], [11, 4.6, 0, 11, 4.6, 1.2]], 0.6, m.woodD, m.wood));
      smoke = [10, -5, 19]; H = 19; r = 20;
    } else {
      // roundhouse
      const Rw = 8.5, Hw = 8.4;
      parts.push(cyl(0, 0, Rw + 0.6, 0, 1.2, m.stoneD, m.stoneS, { ao: 0.3 }));
      parts.push(cyl(0, 0, Rw, 1.2, Hw, mx(m.plasterS, '#c8a880', 0.35), m.plaster, { ao: 0.35 }));
      parts.push(layer((pe) => {
        door(pe, -1.2, Rw * 0.98, 3, 5, m.woodL, { arch: true });
        win(pe, 4.6, Math.sqrt(Rw * Rw - 21) + 0.02, 2.4, 2, 2.2, { sill: false });
        win(pe, -6, Math.sqrt(Rw * Rw - 36) + 0.02, 2.6, 1.6, 2, { sill: false });
        // cob texture: a few horizontal smears
        const s = [];
        for (let i = 0; i < 9; i++) { const x = -7 + i * 1.7, y = Math.sqrt(Math.max(0, Rw * Rw - x * x)); if (Math.abs(x + 1.2) < 2.2) continue; s.push(x, y, 1.5 + (i % 3) * 1.4, x + 1.1, y, 1.5 + (i % 3) * 1.4); }
        pe.lines('rgba(90,60,30,0.3)', 0.4, s);
      }));
      // conical thatch with a slight bell
      const RR = Rw + 1.8, HR = 9.5;
      parts.push({ z0: Hw - 1, z1: Hw, side: sh(p.t, -0.2), top: p.t, ao: 0.2, bevel: false, shape: (c) => S.circ(c, 0, 0, RR) });
      parts.push({ z0: Hw, z1: Hw + HR, side: p.t, top: sh(p.t, 0.2), ao: 0.18, bevel: false, shape: (c, zt) => S.circ(c, 0, 0.0, Math.max(0.3, RR * Math.pow(1 - zt, 0.8))) });
      parts.push(layer((pe) => {
        const c = pe.c;
        c.save(); c.beginPath(); for (let z = Hw - 1; z <= Hw + HR; z += 0.5) { const rr = z < Hw ? RR : Math.max(0.3, RR * Math.pow(1 - (z - Hw) / HR, 0.8)); c.moveTo(rr, -z); c.arc(0, -z, rr, 0, TAU); } c.clip();
        for (let i = 1; i < 7; i++) { const z = Hw + HR * i / 7, rr = RR * Math.pow(1 - i / 7, 0.8); c.beginPath(); c.arc(0, -z, rr, -0.25, Math.PI + 0.25); c.strokeStyle = al(sh(p.t, -0.55), 0.32); c.lineWidth = 0.55; c.stroke(); c.beginPath(); c.arc(0, -z + 0.55, rr, -0.2, Math.PI + 0.2); c.strokeStyle = al(sh(p.t, 0.5), 0.2); c.lineWidth = 0.45; c.stroke(); }
        const rr = rng(41, 1);
        for (let i = 0; i < 120; i++) { const a = rr.range(-0.3, Math.PI + 0.3), q = rr.range(0.05, 1), z = Hw + HR * (1 - Math.pow(q, 1 / 0.8)), r0 = RR * q, r1 = RR * Math.min(1, q + 0.09), z1 = Hw + HR * (1 - Math.pow(Math.min(1, q + 0.09), 1 / 0.8)); c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - z); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - z1); c.strokeStyle = rr.next() < 0.5 ? al(sh(p.t, -0.5), 0.3) : al(sh(p.t, 0.45), 0.26); c.lineWidth = 0.32; c.stroke(); }
        c.beginPath(); c.arc(0, -(Hw - 0.8), RR, 0, Math.PI); c.strokeStyle = al(sh(p.t, -0.6), 0.4); c.lineWidth = 0.9; c.stroke();
        c.restore();
      }));
      // smoke-hole cap
      parts.push(cyl(0, 0, 1.4, Hw + HR - 1.6, Hw + HR + 0.8, sh(p.t, -0.35), sh(p.t, -0.1), { bevel: false, detail: (c) => S.dot(c, '#2a1e12', 0, 0, 0.7) }));
      // wattle garden fence + cabbages
      parts.push(beams([[-13, 4, 2.4, -9, 11, 2.4], [-9, 11, 2.4, -3, 13.5, 2.4], [-13, 4, 1.2, -9, 11, 1.2], [-9, 11, 1.2, -3, 13.5, 1.2]], 0.5, m.woodD, m.woodL));
      parts.push(beams([[-13, 4, 0, -13, 4, 3], [-11, 7.5, 0, -11, 7.5, 3], [-9, 11, 0, -9, 11, 3], [-6, 12.5, 0, -6, 12.5, 3], [-3, 13.5, 0, -3, 13.5, 3]], 0.55, m.woodD, m.wood));
      parts.push({ z0: 0, z1: 1.2, side: '#4a7a3a', top: '#8ac05a', ao: 0.3, bevel: false, shape: (c) => { for (const q of [[-10, 6.5], [-8, 9], [-6.5, 10.5], [-11.5, 5]]) S.circ(c, q[0], q[1], 0.9); } });
      smoke = [0, 0, Hw + HR + 1]; H = Hw + HR + 1; r = 16;
    }
    return { r, h: H, parts, style: 'prop', bevel: 0.7, spots: { smoke } };
  };

  /* ============================================================ site_well
   * Fieldstone well with a little shingled roof, winch, rope and bucket. ~12 */
  M.site_well = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), m = mats(p);
    const parts = [stain(10, 7, 0.3, '#2a2216', 0, 1)];
    parts.push(cyl(0, 0, 5.6, 0, 0.6, m.stoneD, m.stoneS, { bevel: false }));
    parts.push(cyl(0, 0, 3.4, 0, 2.6, '#1c2a32', '#2c4a5a', { flat: true, detail: (c) => { S.dot(c, 'rgba(160,220,255,0.35)', -1, -0.9, 1.3); S.dot(c, 'rgba(255,255,255,0.4)', -1.4, -1.2, 0.45); } }));
    parts.push({ z0: 0.6, z1: 4.2, side: m.stoneS, top: m.stoneT, stroke: 1.9, ao: 0.35, bevel: false, shape: (c) => S.circ(c, 0, 0, 4.25),
      detail: (c) => { const s = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; s.push(Math.cos(a) * 3.3, Math.sin(a) * 3.3, Math.cos(a) * 5.2, Math.sin(a) * 5.2); } S.lines(c, 'rgba(40,32,24,0.4)', 0.3, s); } });
    parts.push(layer((pe) => {
      const c = pe.c;
      c.save(); c.beginPath(); for (let z = 0.6; z <= 4.2; z += 0.5) { c.moveTo(5.2, -z); c.arc(0, -z, 5.2, 0, TAU); } c.clip();
      const r = rng(5, 2);
      for (let row = 0; row < 3; row++) {
        const z = 0.6 + row * 1.2;
        for (let a = row * 0.3 - 0.2; a < Math.PI + 0.2; a += r.range(0.42, 0.6)) { const x = Math.cos(a) * 5.15, y = Math.sin(a) * 5.15; c.beginPath(); c.moveTo(x, y - z); c.lineTo(x, y - z - 1.2); c.strokeStyle = 'rgba(40,32,24,0.42)'; c.lineWidth = 0.3; c.stroke(); }
        c.beginPath(); c.arc(0, -z - 1.2, 5.15, 0, Math.PI); c.strokeStyle = 'rgba(40,32,24,0.38)'; c.lineWidth = 0.3; c.stroke();
      }
      c.restore();
      pe.ell('#5c7a2e', -4.2, 2.6, 0.4, 1.4, 0.7);
    }));
    // posts, winch, rope, bucket
    parts.push(box(-4.6, 0, 1, 1, 2.5, 11.6, m.woodD, m.wood, { ao: 0.2 }));
    parts.push(box(4.6, 0, 1, 1, 2.5, 11.6, m.woodD, m.wood, { ao: 0.2 }));
    parts.push(box(0, 0, 8.6, 1, 8.4, 9.4, m.woodD, m.woodL, { bevel: false, shape: (c) => S.rrect(c, -4.3, -0.5, 8.6, 1, 0.5) }));
    parts.push(beams([[5.3, 0, 8.9, 6.4, 0, 8.9], [6.4, 0, 8.9, 6.4, 1.3, 7.8]], 0.45, m.iron, m.ironL));
    parts.push(beams([[0, 0.5, 8.8, 0, 0.5, 5.4]], 0.18, '#8a7a5a', '#c8b88a'));
    parts.push({ z0: 4, z1: 5.6, side: m.woodD, top: '#3a2a1a', ao: 0.2, shape: (c, zt) => S.circ(c, 0, 0.5, 0.8 + zt * 0.25), detail: (c) => S.dot(c, '#22303a', 0, 0.5, 0.7) });
    const R = roof({ x: 0, y: 0, L: 6, W: 3.3, z: 11.4, H: 2.9, cols: { N: sh(p.w, 0.32), S: sh(p.w, 0.06), W: sh(p.w, 0.2), E: sh(p.w, -0.2) }, fascia: 0.6 });
    parts.push(...R.parts);
    parts.push(layer((pe) => paintShingles(pe, R, 3, { col: p.w, row: 0.75 })));
    parts.push(box(0, 0, 12.4, 0.8, 14.1, 14.8, m.woodD, m.woodL, { bevel: false }));
    // a spare bucket on the rim
    parts.push(cyl(3.6, 3.6, 0.8, 4.2, 5.4, m.woodD, m.wood, { detail: (c) => S.dot(c, '#2a2018', 3.6, 3.6, 0.55) }));
    return { r: 8, h: 15.5, parts, style: 'prop', bevel: 0.6 };
  };

  /* ======================================================== site_goldmine
   * Mine adit cut into a mossy rocky hillock: heavy timber frame under a shingled
   * hood, rail track curving out to an ore cart, gold ore piles with flat glints,
   * lantern, crates and a claim banner (pal.k). ~70 */
  M.site_goldmine = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), m = mats(p);
    const GOLD = '#e8b84a', GOLD_HI = '#fff0a8', GOLD_D = '#a8741c';
    const parts = [];
    parts.push(stain(42, 28, 0.36, '#3a2a18', 0, 4));
    // spoil apron of grey-brown gravel in front of the adit
    parts.push({ z0: 0, z1: 0.8, side: '#6e6252', top: '#a09276', ao: 0.25, bevel: false, shape: (c) => S.poly(c, jag(16, 15, 7, 0.28, 0, 1, 7, 1.3, 0.75)),
      detail: (c) => { const r = rng(3, 1); for (let i = 0; i < 46; i++) { const a = r.range(0, TAU), d = r.range(0, 14); S.dot(c, r.next() < 0.5 ? 'rgba(60,50,40,0.45)' : 'rgba(230,220,200,0.3)', 1 + Math.cos(a) * d * 1.2, 7 + Math.sin(a) * d * 0.68, r.range(0.3, 0.7)); } } });
    // the hillock: a crag of weathered boulders behind the cut face
    const back = [
      { x: 6, y: -31, r: 11, h: 21, seed: 17 },
      { x: -5, y: -22, r: 15, h: 29, seed: 3, n: 13, sx: 1.2, sy: 0.85 },
      { x: 15, y: -19, r: 11.5, h: 22, seed: 8, n: 12 },
      { x: -21, y: -15, r: 11, h: 17, seed: 5, n: 12 },
      { x: 27, y: -8, r: 7.5, h: 11, seed: 12 },
      { x: -30, y: -5, r: 6.5, h: 8, seed: 14 },
    ];
    parts.push(rockPart(back, m.rockS, m.rockT));
    parts.push(...rockFacets(back, m.rockT, sh(m.rockS, -0.3)));
    parts.push(layer((pe) => paintMoss(pe, back, 3)));
    // the cut face: a D-shaped cliff whose flat south face (y = yF) takes the adit
    const yF = -3, FH = 14;
    const faceSect = (z) => { const q = z / FH, w = 10.5 * (1 - 0.22 * q), dn = 1.5 + 11 * (1 - Math.pow(q, 1.5)), pts = [-w, yF, w, yF]; for (let i = 1; i < 9; i++) { const a = (i / 9) * Math.PI; pts.push(Math.cos(a) * w * 1.12, yF - Math.sin(a) * dn * (0.9 + 0.2 * U.hash2(i, 5, 2))); } return pts; };
    parts.push({ z0: 0, z1: FH, side: mx(m.rockS, '#6a6258', 0.3), top: m.rockT, ao: 0.4, shape: (c, zt) => S.poly(c, faceSect(zt * FH)) });
    parts.push(layer((pe) => {
      const c = pe.c, y = yF + 0.02;
      stones(pe, -9.5, 9.5, y, 0, FH - 0.5, 77, { row: 2.2, w: 1.8, joint: 'rgba(40,34,28,0.35)' });
      const g = c.createLinearGradient(0, y - 9.5, 0, y);
      g.addColorStop(0, '#0b0806'); g.addColorStop(0.7, '#1a120c'); g.addColorStop(1, '#2e2216');
      archRect(pe, g, -4.6, 4.6, y, 0, 9.6, true);
      pe.wall('rgba(255,190,100,0.16)', -2.4, 2.4, y, 0, 1.6);
      // grass fringe along the top and moss trickling down
      const r = rng(5, 5);
      for (let i = 0; i < 40; i++) { const x = r.range(-8.5, 8.5); pe.dot(['#4c6a28', '#6a8c34', '#8eae4a'][i % 3], x, yF - r.range(0.2, 2), FH - r.range(0, 0.6), r.range(0.4, 0.9)); }
      for (const x of [-7.5, -6.6, 7, 8]) pe.lines('rgba(76,106,40,0.85)', 0.5, [x, y, FH, x + r.range(-0.4, 0.4), y, FH - r.range(2, 5)]);
    }));
    const front = [
      { x: -15, y: -3, r: 7.5, h: 12.5, seed: 21 },
      { x: 15, y: -2, r: 7, h: 10.5, seed: 25 },
      { x: -22.5, y: 3, r: 4.2, h: 5, seed: 27 },
      { x: 22, y: 5, r: 3.6, h: 4.2, seed: 29 },
      { x: -8, y: 16, r: 2.3, h: 2.4, seed: 31, moss: 0.3 },
      { x: 31, y: 2, r: 2.6, h: 2.8, seed: 33, moss: 0.4 },
    ];
    parts.push(rockPart(front, m.rockS, m.rockT));
    parts.push(...rockFacets(front, m.rockT, sh(m.rockS, -0.3)));
    parts.push(layer((pe) => paintMoss(pe, front, 7)));
    // track: sleepers then rails, out of the adit and curving east to a buffer
    const path = [];
    for (let i = 0; i <= 22; i++) { const t = i / 22; if (t < 0.36) path.push([0, yF + 1 + (t / 0.36) * 11]); else { const a = ((t - 0.36) / 0.64) * (Math.PI / 2); path.push([11 - Math.cos(a) * 11, yF + 12 + Math.sin(a) * 9.4]); } }
    for (let i = 1; i <= 7; i++) path.push([11 + i * 2.2, yF + 21.4]);
    const off = (d) => path.map((q, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [q[0] - (dy / l) * d, q[1] + (dx / l) * d]; });
    const railA = off(1.6), railB = off(-1.6);
    parts.push({ z0: 0, z1: 0.55, side: m.woodD, top: '#8a6a4a', bevel: false, shape: (c) => {
      for (let i = 0; i < path.length; i++) { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], q = path[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l; S.poly(c, [q[0] - uy * 2.5 - ux * 0.45, q[1] + ux * 2.5 - uy * 0.45, q[0] - uy * 2.5 + ux * 0.45, q[1] + ux * 2.5 + uy * 0.45, q[0] + uy * 2.5 + ux * 0.45, q[1] - ux * 2.5 + uy * 0.45, q[0] + uy * 2.5 - ux * 0.45, q[1] - ux * 2.5 - uy * 0.45]); }
    } });
    parts.push({ z0: 0.55, z1: 1.05, side: '#3a3836', top: '#b4b0a6', stroke: 0.42, bevel: false, shape: (c) => { for (const r of [railA, railB]) { c.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) c.lineTo(r[i][0], r[i][1]); } } });
    const bx = path[path.length - 1][0] + 0.8, by = yF + 21.4;
    parts.push(box(bx, by, 1.4, 5, 0, 2.2, m.woodD, m.woodL, { bevel: false }));
    // timber frame: posts, braces, lintel, shingled hood, sign
    parts.push({ z0: 0, z1: 10.4, side: m.woodD, top: m.wood, ao: 0.25, shape: (c) => { c.rect(-6.3, yF + 0.1, 1.7, 1.7); c.rect(4.6, yF + 0.1, 1.7, 1.7); } });
    parts.push(beams([[-4.7, yF + 1, 7, -2.8, yF + 1, 9.8], [4.7, yF + 1, 7, 2.8, yF + 1, 9.8]], 0.65, m.woodD, m.wood));
    parts.push(box(0, yF + 0.9, 15, 2, 9.8, 11.6, m.woodD, m.woodL, { bevel: false }));
    parts.push({ z0: 11.6, z1: 13.6, side: sh(p.w, -0.15), top: sh(p.w, 0.15), ao: 0.15, bevel: false, shape: (c, zt) => c.rect(-8, yF - 3, 16, 6.6 - zt * 5.4) });
    parts.push(layer((pe) => {
      const y = yF + 1.92;
      // shingle rows on the hood slope
      const s = [];
      for (let i = 0; i < 4; i++) { const zz = 11.9 + i * 0.5, yy = yF + 3.6 - (i * 0.5 / 2) * 5.4; s.push(-8, yy, zz, 8, yy, zz); }
      pe.lines('rgba(30,20,12,0.45)', 0.3, s);
      pe.lines('rgba(30,20,12,0.5)', 0.3, [-7.4, y, 10.7, 7.4, y, 10.7]);
      // sign board with crossed picks
      pe.wall('#3a281a', -2.6, 2.6, y + 0.02, 9.95, 11.45); pe.wall('#7a5a3a', -2.3, 2.3, y + 0.03, 10.15, 11.25);
      pe.lines(GOLD, 0.35, [-1.4, y + 0.04, 10.35, 1.4, y + 0.04, 11.05, 1.4, y + 0.04, 10.35, -1.4, y + 0.04, 11.05]);
      pe.lines(GOLD_HI, 0.3, [-1.6, y + 0.04, 10.85, -1.0, y + 0.04, 11.15, 1.6, y + 0.04, 10.85, 1.0, y + 0.04, 11.15]);
      pe.dot('#f2d47a', -7.1, y, 10.7, 0.32); pe.dot('#f2d47a', 7.1, y, 10.7, 0.32);
    }));
    // hanging lantern
    parts.push(box(3.4, yF + 1.9, 1.1, 1.1, 7.4, 8.7, '#ffb84a', '#fff0b0', { flat: true, bevel: false }));
    parts.push(layer((pe) => { pe.glow('#ffc860', 3.4, yF + 1.9, 8, 3.4, 0.5); pe.lines('#2a2420', 0.25, [3.4, yF + 1.9, 9.8, 3.4, yF + 1.9, 8.7]); pe.wall('#3a2a1a', 2.8, 4, yF + 2.46, 8.6, 8.9); }));
    // gold ore piles
    const piles = [
      { x: -15, y: 11, r: 6.5, h: 4.6, seed: 41, n: 10, top: 0.12, pw: 1.6 },
      { x: -7.5, y: 20, r: 3.6, h: 2.6, seed: 43, n: 9, top: 0.12, pw: 1.6 },
      { x: 24, y: 9.5, r: 4.4, h: 3.2, seed: 47, n: 9, top: 0.12, pw: 1.6 },
    ];
    parts.push(rockPart(piles, '#6c5a44', '#9a8466', { ao: 0.4 }));
    parts.push({ z0: 0, z1: 5.2, side: GOLD_D, top: GOLD_HI, flat: true, ao: 0.3, bevel: false, shape: (c, zt) => {
      const z = zt * 5.2, r = rng(5, 6);
      for (const q of piles) for (let i = 0; i < 9; i++) {
        const a = r.range(0, TAU), d = r.range(0.1, 0.75), zz = q.h * (1 - d * d) * 0.95 + 0.3, s = r.range(0.45, 0.85);
        if (z > zz || z < zz - s * 1.3) continue;
        S.poly(c, ngon(4, s * (1 - ((zz - z) / (s * 1.5)) * 0.3), a, q.x + Math.cos(a) * d * q.r, q.y + Math.sin(a) * d * q.r * 0.9));
      }
    } });
    parts.push(layer((pe) => { const r = rng(9, 2); for (const q of piles) for (let i = 0; i < 14; i++) { const a = r.range(0, TAU), d = r.range(0, 0.9); const z = q.h * (1 - d * d) + 0.1; pe.dot(r.next() < 0.6 ? GOLD : GOLD_HI, q.x + Math.cos(a) * d * q.r, q.y + Math.sin(a) * d * q.r * 0.9, z, r.range(0.22, 0.42)); } }));
    // ore cart on the east-west stretch
    const cx = 17, cy = yF + 21.4;
    const disc = (u) => { const out = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; out.push(u + Math.cos(a) * 1.6, 1.6 + Math.sin(a) * 1.6); } return out; };
    parts.push(xzPart([disc(cx - 3.1), disc(cx + 3.1)], 0, 3.2, '#2a2826', '#5a5652', { oy: cy + 2.3, v0: -0.4, v1: 0.4 }, { ao: 0.1, bevel: false }));
    parts.push({ z0: 1.8, z1: 6.2, side: '#4a3a2c', top: '#7a6048', ao: 0.25, shape: (c, zt) => { const g = 1 + zt * 0.12; c.rect(cx - 4.6 * g, cy - 3 * g, 9.2 * g, 6 * g); } });
    parts.push(layer((pe) => { const y = cy + 3.38; pe.wall('#2e2a28', cx - 5.15, cx + 5.15, y, 5.2, 6.0); pe.wall('#2e2a28', cx - 4.9, cx + 4.9, y, 2.4, 3.0); pe.lines('rgba(20,14,8,0.5)', 0.3, [cx - 1.7, y, 3, cx - 1.7, y, 5.2, cx + 1.7, y, 3, cx + 1.7, y, 5.2]); pe.dot('#8a8680', cx - 4.4, y, 5.6, 0.25); pe.dot('#8a8680', cx + 4.4, y, 5.6, 0.25); }));
    parts.push({ z0: 6.2, z1: 8.4, side: GOLD_D, top: GOLD, ao: 0.35, shape: (c, zt) => S.blob(c, cx, cy, 4.6 * (1 - zt * 0.55), 51, 9, 0.35), detail: (c) => { const r = rng(4, 4); for (let i = 0; i < 9; i++) S.dot(c, r.next() < 0.5 ? GOLD_HI : '#fff8d8', cx + r.range(-2.6, 2.6), cy + r.range(-1.6, 1.6), r.range(0.2, 0.42)); S.dot(c, '#5a4a3a', cx - 1.5, cy + 0.6, 0.6); S.dot(c, '#5a4a3a', cx + 1.8, cy - 0.5, 0.5); } });
    // crates + barrel + tools by the entrance
    parts.push({ z0: 0, z1: 6, side: m.woodD, top: sh(m.woodL, 0.06), ao: 0.3, shape: (c, zt) => { c.rect(-11.8, 2.7, 3.6, 3.6); if (zt * 6 > 3.3) c.rect(-11.8, 2.8, 2.8, 2.8); } });
    parts.push(cyl(-5.5, 9.5, 1.4, 0, 3.4, m.woodD, m.wood, { detail: (c) => S.dot(c, '#2a2018', -5.5, 9.5, 1) }));
    parts.push(layer((pe) => {
      pe.lines('rgba(30,20,12,0.45)', 0.3, [-11.8, 6.31, 0.2, -8.2, 6.31, 3.2, -11.8, 6.31, 3.2, -8.2, 6.31, 0.2]);
      pe.lines('rgba(30,20,12,0.45)', 0.3, [-11.8, 5.61, 3.5, -9, 5.61, 5.8]);
      pe.lines('#6a4a30', 0.45, [-7.6, 6.6, 0, -6.4, 6.6, 4.6]); pe.lines('#8a8a86', 0.6, [-7.4, 6.62, 4.4, -5.6, 6.62, 4.9]);
      pe.wall('rgba(30,28,26,0.7)', -6.9, -4.1, 10.91, 0.7, 1.05); pe.wall('rgba(30,28,26,0.7)', -6.9, -4.1, 10.91, 2.4, 2.75);
    }));
    // claim banner
    parts.push(...flagPole(9.8, 1.2, 0, 17, p));
    parts.push(layer((pe, a) => paintFlag(pe, 10.25, 1.2, 17.2, 6.5, 4.2, a, p.k, p.k2)));
    return { r: 42, h: 30, parts, style: 'prop', bevel: 0.7, spots: { entrance: [0, yF, 0], lantern: [3.4, yF + 1.9, 8] } };
  };

  /* ===================================================== site_villagehall
   * Village hall / inn: stone ground floor, jettied timber-framed upper floor,
   * long shingled roof with two chimneys, a front cross-wing with the double door
   * and gable, a hanging inn sign (pal.k board, k2 rim) and a flag on the ridge. ~44 */
  M.site_villagehall = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), m = mats(p);
    const slate = mx(p.w, p.a, 0.5);
    const rc = { N: sh(slate, 0.32), W: sh(slate, 0.18), S: sh(slate, -0.02), E: sh(slate, -0.3) };
    const parts = [stain(30, 20, 0.32, '#2a2216', 0, 4)];
    const yc = -2.5, G = 6, U2 = 12.5;
    // main hall
    parts.push(box(0, yc, 37.2, 16.2, 0, 1, m.stoneD, m.stoneS, { ao: 0.3 }));
    parts.push(box(0, yc, 36, 15, 1, G, m.stoneS, m.stoneT, { ao: 0.35 }));
    parts.push(box(0, yc + 0.4, 37, 15.8, G, U2, m.plasterS, m.plaster, { ao: 0.22 }));
    // front cross-wing
    parts.push(box(0, 6, 15.2, 15.2, 0, 1, m.stoneD, m.stoneS, { ao: 0.3 }));
    parts.push(box(0, 6, 14, 14, 1, G, m.stoneS, m.stoneT, { ao: 0.35 }));
    parts.push(box(0, 6.4, 14.6, 14.8, G, U2, m.plasterS, m.plaster, { ao: 0.22 }));
    parts.push(layer((pe) => {
      const yG = 5.01, yU = 5.81, yWG = 13.01, yWU = 13.81;
      for (const [x0, x1] of [[-18, -7], [7, 18]]) {
        stones(pe, x0, x1, yG, 1, G, x0 | 0, { row: 1.25 });
        stones(pe, x0 - 0.6, x1 + 0.6, yG + 0.6, 0, 1, 3, { row: 0.5, w: 0.8 });
        pe.wall('rgba(20,14,8,0.32)', x0, x1, yG + 0.01, G - 0.9, G);
        pe.wall(m.timber, x0 - 0.5, x1 + 0.3, yU, G, G + 0.7);
        const posts = [x0 - 0.5, (x0 * 2 + x1) / 3, (x0 + x1 * 2) / 3, x1 - 0.4];
        for (const x of posts) pe.wall(m.timber, x, x + 0.7, yU, G, U2);
        pe.lines(m.timber, 0.6, [posts[0] + 0.5, yU, G + 0.7, posts[1], yU, U2 - 1.6, posts[3], yU, G + 0.7, posts[2] + 0.7, yU, U2 - 1.6]);
      }
      for (const x of [-14.4, -10.2, 10.2, 14.4]) win(pe, x, yG, 2.4, 2.6, 2.4, { sillCol: '#b8b0a0' });
      win(pe, -12.3, yU, 8.4, 2.4, 2.4, { shut: '#5a6e48', box: true });
      win(pe, 12.3, yU, 8.4, 2.4, 2.4, { shut: '#5a6e48', box: true });
      // wing front
      stones(pe, -7, 7, yWG, 1, G, 41, { row: 1.25 });
      stones(pe, -7.6, 7.6, yWG + 0.6, 0, 1, 9, { row: 0.5, w: 0.8 });
      pe.wall('rgba(20,14,8,0.32)', -7, 7, yWG + 0.01, G - 0.9, G);
      archRect(pe, '#8a8478', -3.2, 3.2, yWG + 0.01, 0, 5.9, true);
      door(pe, -1.05, yWG + 0.02, 2.1, 4.9, m.woodL, { arch: false, frame: '#5a4a3a' });
      door(pe, 1.05, yWG + 0.02, 2.1, 4.9, m.woodL, { arch: false, frame: '#5a4a3a' });
      archRect(pe, '#3a2a1e', -2.6, 2.6, yWG + 0.03, 4.4, 5.5, true);
      archRect(pe, '#ffcf6a', -2.1, 2.1, yWG + 0.04, 4.6, 5.25, true);
      win(pe, -5.2, yWG, 2.4, 1.6, 2.2, {});
      win(pe, 5.2, yWG, 2.4, 1.6, 2.2, {});
      pe.wall(m.timber, -7.3, 7.3, yWU, G, G + 0.7);
      for (const x of [-7.3, -2.6, 1.9, 6.6]) pe.wall(m.timber, x, x + 0.7, yWU, G, U2);
      win(pe, -4.9, yWU, 8.2, 2.2, 2.4, { shut: '#5a6e48' });
      win(pe, 4.9, yWU, 8.2, 2.2, 2.4, { shut: '#5a6e48' });
      win(pe, 0, yWU, 8.1, 1.6, 2.6, { arch: true });
    }));
    // door step
    parts.push(box(0, 14.2, 7.4, 2.4, 0, 0.7, m.stoneD, m.stoneT, { bevel: false }));
    const RM = roof({ x: 0, y: yc, L: 20.2, W: 9.9, z: U2, H: 9, cols: rc, fascia: 0.8 });
    parts.push(...RM.parts);
    parts.push(layer((pe) => paintShingles(pe, RM, 5, { col: slate })));
    parts.push({ z0: 18.5, z1: 26, side: m.stoneS, top: m.stoneT, ao: 0.2, shape: (c) => { c.rect(-14.4, yc - 1.4, 2.8, 2.8); c.rect(11.6, yc - 1.4, 2.8, 2.8); },
      detail: (c) => { S.dot(c, '#1a1410', -13, yc, 0.8); S.dot(c, '#1a1410', 13, yc, 0.8); } });
    parts.push(layer((pe) => { stones(pe, -14.4, -11.6, yc + 1.42, 18.5, 26, 3, { row: 1.2, w: 0.6 }); stones(pe, 11.6, 14.4, yc + 1.42, 18.5, 26, 4, { row: 1.2, w: 0.6 }); pe.wall('rgba(0,0,0,0.3)', -14.4, -11.6, yc + 1.43, 25, 26); pe.wall('rgba(0,0,0,0.3)', 11.6, 14.4, yc + 1.43, 25, 26); }));
    const mainY = (z) => yc + 9.9 * Math.max(0, 1 - (z - U2) / 9);
    const RW = roof({ x: 0, y: 6.4, L: 8.4, W: 8.4, z: U2, H: 7.8, ax: 'y', fascia: 0.8, cols: { N: rc.N, S: rc.S, W: sh(slate, 0.12), E: sh(slate, -0.17) }, clip: (pts, z) => clipHalf(pts, 0, 1, mainY(z) - 0.15) });
    parts.push(...RW.parts);
    parts.push(layer((pe) => { paintShingles(pe, RW, 7, { col: slate }); paintGable(pe, RW, m.plaster, { timber: m.timber, win: { arch: true, sill: false, mull: false } }); }));
    // inn sign on an iron bracket at the wing corner
    parts.push(beams([[-7.4, 13.7, 9.6, -11.6, 13.7, 9.6], [-7.4, 13.7, 7.8, -9.6, 13.7, 9.6]], 0.42, '#2a2624', '#6a6660'));
    parts.push(xzPart([[-11.2, 5.4, -8.2, 5.4, -8.2, 8.6, -11.2, 8.6]], 5.4, 8.6, sh(p.k, -0.25), p.k, { oy: 13.7, v0: -0.25, v1: 0.25 }, { ao: 0.15, bevel: false }));
    parts.push(layer((pe) => {
      const y = 13.97;
      pe.lines('#2a2624', 0.22, [-10.8, y, 8.6, -10.8, y, 9.6, -8.6, y, 8.6, -8.6, y, 9.6]);
      pe.wall(p.k2, -11.2, -8.2, y, 5.4, 5.75); pe.wall(p.k2, -11.2, -8.2, y, 8.25, 8.6); pe.wall(p.k2, -11.2, -10.85, y, 5.4, 8.6); pe.wall(p.k2, -8.55, -8.2, y, 5.4, 8.6);
      // golden tankard
      pe.wall('#e8b84a', -10.3, -9.0, y + 0.01, 6.1, 7.7); pe.wall('#fff2c0', -10.3, -9.0, y + 0.01, 7.5, 7.95);
      pe.lines('#e8b84a', 0.3, [-9.0, y + 0.01, 7.3, -8.6, y + 0.01, 7.0, -8.6, y + 0.01, 7.0, -9.0, y + 0.01, 6.5]);
      pe.lines('rgba(120,80,20,0.6)', 0.2, [-9.9, y + 0.02, 6.3, -9.9, y + 0.02, 7.4]);
      // door lanterns
      for (const x of [-4.2, 4.2]) { pe.wall('#2a2420', x - 0.5, x + 0.5, 13.3, 4.8, 6.0); pe.wall('#ffd27a', x - 0.32, x + 0.32, 13.31, 4.95, 5.85); pe.glow('#ffc860', x, 13.3, 5.4, 2.8, 0.45); }
    }));
    // flag on the wing ridge
    parts.push(...flagPole(0, 12.6, 19.8, 7, p));
    parts.push(layer((pe, a) => paintFlag(pe, 0.45, 12.6, 26.9, 5.6, 3.6, a, p.k, p.k2)));
    // barrels, bench and table, lamp post
    parts.push({ z0: 0, z1: 3.4, side: m.woodD, top: m.wood, ao: 0.3, shape: (c) => { S.circ(c, -16.5, 8, 1.4); S.circ(c, -13.6, 8.6, 1.4); S.circ(c, -15.2, 10.8, 1.4); },
      detail: (c) => { for (const q of [[-16.5, 8], [-13.6, 8.6], [-15.2, 10.8]]) S.dot(c, '#3a2a1a', q[0], q[1], 0.95); } });
    parts.push(layer((pe) => { for (const q of [[-15.2, 12.2]]) { pe.wall('rgba(30,26,24,0.75)', q[0] - 1.4, q[0] + 1.4, q[1], 0.7, 1.0); pe.wall('rgba(30,26,24,0.75)', q[0] - 1.4, q[0] + 1.4, q[1], 2.4, 2.7); } }));
    parts.push({ z0: 0, z1: 2.6, side: m.woodD, top: m.woodL, ao: 0.3, shape: (c, zt) => { if (zt * 2.6 < 2) { c.rect(10, 9.4, 0.6, 3.6); c.rect(14.4, 9.4, 0.6, 3.6); c.rect(9.6, 14.2, 6, 0.6); } else c.rect(9.6, 9.4, 5.8, 3.6); } });
    parts.push(box(12.4, 15.6, 6, 1.2, 1, 1.6, m.woodD, m.woodL, { bevel: false }));
    parts.push(layer((pe) => { pe.dot('#d8c8a0', 11, 11, 2.7, 0.45); pe.dot('#8a5a3a', 13.6, 10.6, 2.75, 0.5); pe.wall('#e8b84a', 12, 12.7, 11.8, 2.6, 3.4); }));
    parts.push(beams([[19, 13, 0, 19, 13, 8.4]], 0.6, '#2a2624', '#6a6660'));
    parts.push(box(19, 13, 1.3, 1.3, 8.4, 10, '#ffb84a', '#fff0b0', { flat: true, bevel: false }));
    parts.push(layer((pe) => { pe.glow('#ffc860', 19, 13, 9.2, 4, 0.5); pe.wall('#2a2420', 18.2, 19.8, 13.66, 9.9, 10.4); }));
    return { r: 27, h: 30, parts, style: 'prop', bevel: 0.7, spots: { smoke: [-13, yc, 26.5], smoke2: [13, yc, 26.5], door: [0, 14, 0] } };
  };

  /* ======================================================== site_windmill
   * Whitewashed tower mill on a stone footing, a timber reefing stage, shingled
   * cap and four lattice sails turning in front (anims 4 = a quarter turn). ~30 */
  M.site_windmill = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), m = mats(p);
    const parts = [stain(22, 15, 0.3, '#2a2216', 0, 3)];
    const R0 = 9.6, R1 = 6.4, TH = 30, ST = 13;
    const rAt = (z) => lerp(R0, R1, U.clamp((z - 1.2) / (TH - 1.2), 0, 1));
    const capC = mx(p.w, '#4a3a30', 0.3);
    parts.push(cyl(0, 0, 11.4, 0, 1.2, m.stoneD, m.stoneS, { ao: 0.3 }));
    parts.push({ z0: 1.2, z1: 5, side: m.stoneS, top: m.stoneT, ao: 0.35, shape: (c, zt) => S.circ(c, 0, 0, rAt(1.2 + zt * 3.8) + 0.3) });
    parts.push({ z0: 5, z1: ST, side: m.plasterS, top: m.plaster, ao: 0.25, shape: (c, zt) => S.circ(c, 0, 0, rAt(5 + zt * (ST - 5))) });
    // reefing stage: deck ring, rail ring and posts (drawn before the upper tower hides their back half)
    parts.push({ z0: ST - 0.8, z1: ST, side: m.woodD, top: m.woodL, stroke: 2.8, bevel: false, ao: 0.2, shape: (c) => S.circ(c, 0, 0, rAt(ST) + 1.5) });
    const posts = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; posts.push([Math.cos(a) * (rAt(ST) + 2.6), Math.sin(a) * (rAt(ST) + 2.6), ST, Math.cos(a) * (rAt(ST) + 2.6), Math.sin(a) * (rAt(ST) + 2.6), ST + 2.4]); }
    parts.push(beams(posts, 0.38, m.woodD, m.wood));
    parts.push({ z0: ST + 2.1, z1: ST + 2.6, side: m.woodD, top: m.woodL, stroke: 0.45, bevel: false, ao: 0, shape: (c) => S.circ(c, 0, 0, rAt(ST) + 2.6) });
    parts.push({ z0: ST, z1: TH, side: m.plasterS, top: m.plaster, ao: 0.12, shape: (c, zt) => S.circ(c, 0, 0, rAt(ST + zt * (TH - ST))) });
    parts.push(layer((pe) => {
      const fy = (x, z) => Math.sqrt(Math.max(0, rAt(z) * rAt(z) - x * x)) + 0.02;
      const c = pe.c;
      // stone footing courses
      c.save(); c.beginPath(); for (let z = 1.2; z <= 5; z += 0.5) { const r = rAt(z) + 0.3; c.moveTo(r, -z); c.arc(0, -z, r, 0, TAU); } c.clip();
      for (let z = 1.2; z < 5; z += 1.25) { c.beginPath(); c.arc(0, -z, rAt(z) + 0.3, 0.05, Math.PI - 0.05); c.strokeStyle = 'rgba(40,32,24,0.4)'; c.lineWidth = 0.3; c.stroke(); for (let a = (z * 0.7) % 0.5 + 0.2; a < Math.PI; a += 0.42) { const r = rAt(z) + 0.3; c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r - z); c.lineTo(Math.cos(a) * r, Math.sin(a) * r - z - 1.25); c.stroke(); } }
      c.restore();
      door(pe, -0.6, fy(-0.6, 1.2) + 0.3, 3, 5.2, m.woodL, { arch: true });
      win(pe, 3.8, fy(3.8, 8), 7.6, 1.6, 2.4, { arch: true, sill: false, mull: false });
      win(pe, -2.2, fy(-2.2, 18), 18.5, 1.6, 2.4, { arch: true, sill: false, mull: false });
      win(pe, 1.8, fy(1.8, 24), 23.8, 1.4, 2.1, { arch: true, sill: false, mull: false });
      // weathering streaks
      pe.lines('rgba(120,100,70,0.18)', 0.8, [-5, fy(-5, 6), 6, -5.2, fy(-5, 11), 11, 6, fy(6, 6), 6, 5.6, fy(6, 10), 10.5]);
    }));
    // cap: curb, conical shingled cap, windshaft
    parts.push(cyl(0, 0, R1 + 1, TH - 0.4, TH + 1, m.woodD, m.wood, { ao: 0.2 }));
    parts.push({ z0: TH + 1, z1: TH + 9.5, side: capC, top: sh(capC, 0.2), ao: 0.2, bevel: false, shape: (c, zt) => S.circ(c, 0, -0.6 * zt, Math.max(0.3, (R1 + 1.6) * Math.pow(1 - zt, 0.72))) });
    parts.push(layer((pe) => {
      const c = pe.c, z0 = TH + 1, HC = 8.5, RC = R1 + 1.6;
      c.save(); c.beginPath(); for (let z = z0; z <= z0 + HC; z += 0.5) { const q = (z - z0) / HC, rr = Math.max(0.3, RC * Math.pow(1 - q, 0.72)); c.moveTo(rr, -0.6 * q - z); c.arc(0, -0.6 * q - z, rr, 0, TAU); } c.clip();
      for (let i = 1; i < 8; i++) { const q = i / 8, z = z0 + HC * q, rr = RC * Math.pow(1 - q, 0.72); c.beginPath(); c.arc(0, -0.6 * q - z, rr, -0.3, Math.PI + 0.3); c.strokeStyle = al(sh(capC, -0.5), 0.45); c.lineWidth = 0.35; c.stroke(); c.beginPath(); c.arc(0, -0.6 * q - z + 0.4, rr, -0.2, Math.PI + 0.2); c.strokeStyle = al(sh(capC, 0.4), 0.2); c.lineWidth = 0.3; c.stroke(); }
      c.restore();
    }));
    parts.push(...flagPole(0, -0.6, TH + 9.2, 3.4, p));
    parts.push(layer((pe, a) => paintFlag(pe, 0.4, -0.6, TH + 12.6, 3.6, 2.2, a, p.k, p.k2, { amp: 0.6 })));
    const HY = R1 + 4.4, HZ = TH + 3, SR = 22;
    parts.push(beams([[0, 3, HZ + 0.6, 0, HY, HZ]], 1.9, m.woodD, m.wood));
    parts.push(cyl(0, HY + 0.2, 1.3, HZ - 1.2, HZ + 1.2, m.iron, m.ironL, { bevel: false }));
    // the sails, painted in their vertical plane in front of the tower
    parts.push(layer((pe, a) => {
      const c = pe.c, th0 = a * (Math.PI / 2) + 0.42, y = HY + 1.2;
      const cloth = '#ece2c8', clothD = '#c8b894', lat = '#5a4030', stock = '#4a3424';
      for (let i = 0; i < 4; i++) {
        const th = th0 + (i * Math.PI) / 2, ux = Math.cos(th), uz = Math.sin(th), px = -uz, pz = ux;
        const Q = (s, t) => [s * ux + t * px, y, HZ + s * uz + t * pz];
        const quad = (s0, s1, t0, t1) => [].concat(Q(s0, t0), Q(s1, t0), Q(s1, t1), Q(s0, t1));
        const full = i % 2 === 0;
        // sail cloth (light on the upper-left facing sails)
        const lit = 0.5 + 0.5 * (-ux * 0.6 + uz * 0.8);
        if (full) pe.poly(mx(clothD, cloth, 0.35 + 0.65 * lit), quad(4.6, SR, 0.5, 4.6));
        else { pe.poly(al(mx(clothD, cloth, 0.5), 0.95), quad(4.6, SR, 0.5, 1.6)); }
        // lattice frame
        const s = [];
        const seg = (a0, a1) => { s.push(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2]); };
        for (let k = 0; k <= 8; k++) { const ss = 4.6 + (SR - 4.6) * (k / 8); seg(Q(ss, 0.3), Q(ss, 4.6)); }
        seg(Q(4.6, 4.6), Q(SR, 4.6)); seg(Q(4.6, 2.5), Q(SR, 2.5));
        pe.lines(lat, 0.42, s);
        if (full) pe.lines('rgba(90,70,50,0.35)', 0.3, [].concat(Q(5, 1.5), Q(SR - 0.4, 1.5), Q(5, 3.5), Q(SR - 0.4, 3.5)));
        // stock (spar)
        pe.lines(stock, 1, [].concat(Q(-0.5, 0), Q(SR + 0.8, 0)));
        pe.lines('rgba(255,230,190,0.35)', 0.3, [].concat(Q(1.5, -0.3), Q(SR + 0.5, -0.3)));
      }
      pe.dot('#2a2420', 0, y + 0.05, HZ, 1.4); pe.dot('#8a8680', -0.3, y + 0.06, HZ + 0.3, 0.5);
    }));
    // flour sacks and a wheelbarrow at the door
    parts.push({ z0: 0, z1: 2.8, side: '#b8a888', top: '#e8dcc0', ao: 0.35, shape: (c, zt) => { const k = 1 - zt * zt * 0.5; S.blob(c, 7.6, 9.4, 1.8 * k, 3, 8, 0.25); S.blob(c, 9.8, 8.2, 1.6 * k, 5, 8, 0.25); S.blob(c, 8.8, 11.2, 1.7 * k, 7, 8, 0.25); },
      detail: (c) => { S.lines(c, 'rgba(90,70,40,0.5)', 0.3, [7, 9, 8.2, 9.2]); } });
    parts.push({ z0: 1.2, z1: 3, side: m.woodD, top: m.woodL, ao: 0.3, shape: (c, zt) => { const g = 1 + zt * 0.2; c.rect(-11.6 * 1, 9 - 1.6 * g, 4.6 * g, 3.2 * g); } });
    parts.push(beams([[-7, 9.2, 1.8, -4.4, 9.2, 1.2], [-7, 11.4, 1.8, -4.4, 11.4, 1.2], [-11.4, 10.3, 0, -11.4, 10.3, 1.4]], 0.4, m.woodD, m.wood));
    return { r: 25, h: HZ + SR + 2, parts, style: 'prop', bevel: 0.7 };
  };

  /* =========================================================== site_ruins
   * Ancient temple ruins: a cracked two-step platform with missing slabs and grass,
   * a colonnade (two columns under a broken architrave, a lone tall column, snapped
   * ones and stumps), a standing arch, fallen drums and voussoirs, ivy and bushes. ~90 */
  M.site_ruins = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const marS = mx(p.b, '#d2cab6', 0.5), marT = mx(p.b, '#f2ecdc', 0.6), marD = mx(p.a, '#6e685c', 0.35);
    const flr = mx(p.s, '#a8a290', 0.5), flrD = mx(p.a, '#5e5a50', 0.4);
    const parts = [stain(48, 32, 0.3, '#2a2416', 0, 2)];
    parts.push(layer((pe) => {
      const r = rng(11, 3);
      for (let i = 0; i < 80; i++) { const x = r.range(-46, 46), y = r.range(-30, 30); if (Math.abs(x) < 30 && Math.abs(y) < 18) continue; const s = []; for (let k = 0; k < 4; k++) s.push(x + k * 0.35, y, 0, x + k * 0.35 + r.range(-0.6, 0.6), y, r.range(1, 2.2)); pe.lines(r.next() < 0.5 ? '#536e2a' : '#8aa848', 0.32, s); }
    }));
    const bush = (list, seed) => [rockPart(list, '#3a5a22', '#5a7e30', { ao: 0.45 }), layer((pe) => paintMoss(pe, list.map((b) => Object.assign({}, b, { moss: 2.6 })), seed, { cracks: false, size: 1.5 }))];
    const back = [{ x: -40, y: -13, r: 5, h: 5.6, seed: 64 }, { x: 25, y: -21, r: 5.4, h: 6.4, seed: 65 }, { x: 39, y: -9, r: 4, h: 4.6, seed: 66 }];
    parts.push(...bush(back, 21));
    { const bl = [{ x: -16, y: -22, r: 3.2, h: 2.4, seed: 55, n: 6, rough: 0.2, top: 0.7, pw: 4 }, { x: 8, y: -20, r: 2.4, h: 2, seed: 58, n: 5, rough: 0.2, top: 0.7, pw: 4 }]; parts.push(rockPart(bl, flrD, flr, { ao: 0.4 })); parts.push(layer((pe) => paintMoss(pe, bl, 8, { cracks: false }))); }
    // platform
    const step1 = clipHalf(clipHalf(jag(20, 1, 4, 0.06, 0.1, 0, 1, 34, 21), 0.7, -1, -31), -0.5, 1, -19);
    parts.push({ z0: 0, z1: 1.3, side: flrD, top: mx(flr, flrD, 0.3), ao: 0.35, shape: (c) => S.poly(c, step1) });
    const step2 = [-27, -16, 26, -16, 27, 11, 16, 13, 10, 15.5, -21, 15, -28, 5];
    parts.push({ z0: 1.3, z1: 2.4, side: flrD, top: flr, ao: 0.3, shape: (c) => S.poly(c, step2),
      detail: (c) => {
        const r = rng(13, 1), s = [];
        for (let y = -16; y < 15; y += 4.6) { s.push(-28, y, 27, y); for (let x = -27 + r.range(0, 4); x < 27; x += r.range(4, 7.5)) s.push(x, y, x + r.range(-0.3, 0.3), y + 4.6); }
        S.lines(c, 'rgba(50,44,34,0.42)', 0.3, s);
        // missing slabs (earth) and invading grass
        for (const q of [[-14, 8, 4.6, 4.6], [9, -2, 5.5, 4.6], [17, 9, 4, 4.6], [-22, -7, 4.2, 4.6]]) { S.fillPoly(c, '#5a4a32', [q[0], q[1], q[0] + q[2], q[1], q[0] + q[2], q[1] + q[3], q[0], q[1] + q[3]]); S.fillPoly(c, 'rgba(80,110,40,0.85)', jag(7, q[2] * 0.45, q[0] | 0, 0.4, 0, q[0] + q[2] / 2, q[1] + q[3] / 2, 1, 0.8)); }
        for (let i = 0; i < 26; i++) S.dot(c, i % 3 ? 'rgba(84,112,44,0.8)' : 'rgba(130,160,70,0.8)', r.range(-26, 25), r.range(-15, 14), r.range(0.4, 1.1));
        S.lines(c, 'rgba(40,34,26,0.5)', 0.4, [-8, 2, -3, 6, -3, 6, 1, 4, 14, -9, 19, -4, 19, -4, 24, -5]);
        for (let i = 0; i < 18; i++) { const x = r.range(-27, 26), y = r.range(-15, 14); S.dot(c, 'rgba(255,250,235,0.18)', x, y, r.range(1, 2.4)); }
      } });
    parts.push(layer((pe) => { const r = rng(17, 4); for (const q of [[-11.7, 10.3], [11.7, 0.3], [19, 11.3], [-19.9, -4.7]]) for (let i = 0; i < 3; i++) clump(pe, q[0] + r.range(-1.2, 1.2), q[1] + r.range(-1, 1), 2.6, 1.1, r); }));
    // columns: back row (y = -10) and two front stumps (y = 9)
    const CR = 2.75;
    const cols = [
      { x: -20, y: -10, h: 26 }, { x: -9, y: -10, h: 26 }, { x: 2, y: -10, h: 13, br: 1 }, { x: 13, y: -10, h: 26, lone: 1 }, { x: 23, y: -10, h: 7, br: -1 },
      { x: -20, y: 9, h: 4.6, br: 1 }, { x: 20, y: 7, h: 9, br: -1 },
    ];
    const rC = (z) => CR - 0.32 * (z / 26);
    const shaft = (q, z) => {
      let pts = ngon(14, rC(z), 0.11, q.x, q.y);
      if (q.br && z > q.h - 3.4) pts = clipHalf(pts, -q.br * 0.8, 0.6, (z - (q.h - 3.4)) * 1.5 - 2.6 - q.br * q.x * 0.8 + 0.6 * q.y);
      return pts;
    };
    parts.push({ z0: 2.4, z1: 3.8, side: marD, top: marS, ao: 0.3, shape: (c) => { for (const q of cols) c.rect(q.x - 3.4, q.y - 3.4, 6.8, 6.8); } });
    parts.push({ z0: 3.8, z1: 24.4, side: marS, top: marT, ao: 0.3, shape: (c, zt) => { const z = 3.8 + zt * 20.6; for (const q of cols) if (z <= q.h) polyOK(c, shaft(q, z)); } });
    parts.push({ z0: 24.2, z1: 25.2, side: marS, top: marT, ao: 0.2, bevel: false, shape: (c, zt) => { for (const q of cols) if (q.h >= 26) S.circ(c, q.x, q.y, 2.4 + zt * 1); } });
    parts.push({ z0: 25.2, z1: 26.6, side: marD, top: marT, ao: 0.2, shape: (c) => { for (const q of cols) if (q.h >= 26) c.rect(q.x - 3.5, q.y - 3.5, 7, 7); } });
    parts.push({ z0: 26.6, z1: 29.6, side: marS, top: marT, ao: 0.25, shape: (c, zt) => S.poly(c, [-24, -13, -4.2 - zt * 1.6, -13, -5.4, -10.4, -3.8 + zt * 0.5, -7, -24, -7]),
      detail: (c) => S.lines(c, 'rgba(60,52,40,0.4)', 0.3, [-14.5, -13, -14.5, -7]) });
    parts.push(layer((pe) => {
      const r = rng(7, 2);
      for (const q of cols) {
        const top = q.h >= 26 ? 24.2 : q.h - (q.br ? 2.8 : 0);
        const s = [];
        for (let k = -3; k <= 3; k++) { const dx = k * 0.74, y = q.y + Math.sqrt(Math.max(0, 2.5 * 2.5 - dx * dx)) + 0.02; s.push(q.x + dx, y, 4, q.x + dx, y, top); }
        pe.lines('rgba(80,70,52,0.3)', 0.32, s);
        pe.lines('rgba(255,252,240,0.35)', 0.3, [q.x - 1.7, q.y + 1.75, 4, q.x - 1.7, q.y + 1.75, top]);
        pe.wall('rgba(60,52,40,0.18)', q.x - 3.4, q.x + 3.4, q.y + 3.42, 2.4, 3.8);
        if (q.br) { const z = q.h - 1.5; pe.ell(al(marT, 0.9), q.x - q.br * 0.4, q.y + 0.2, z, 1.9, 1.4, 0.4 * q.br); pe.ell('rgba(60,50,40,0.25)', q.x + q.br * 0.7, q.y + 0.7, z - 0.4, 0.9, 0.5); }
        const ivyH = q.h >= 26 ? (q.lone ? 20 : 12) : q.h * 0.7;
        for (let i = 0; i < ivyH * 1.5; i++) { const z = 3.8 + (i / (ivyH * 1.5)) * ivyH, dx = Math.sin(i * 0.8 + q.x) * 1.5 + (q.x > 0 ? 0.6 : -0.6), y = q.y + Math.sqrt(Math.max(0, 6 - dx * dx)) + 0.05; pe.dot(i % 3 ? '#466626' : '#7a9c40', q.x + dx, y, z, 0.55 + r.next() * 0.4); }
      }
      pe.wall('rgba(60,52,40,0.38)', -24, -5.4, -6.98, 28, 28.3);
      pe.wall('rgba(255,250,235,0.3)', -24, -5.4, -6.98, 26.9, 27.2);
      for (const q of [[-22, 28.8], [-18.6, 29]]) pe.lines('#466626', 0.55, [q[0], -6.94, q[1], q[0] + 0.3, -6.94, q[1] - 5]);
    }));
    // standing arch on the west step
    const AX = -33, AY = 2;
    const arch = [[-7.4, 0, -4.2, 0, -4.2, 10, -7.4, 10], [4.2, 0, 7.4, 0, 7.4, 10, 4.2, 10], ...ringQuads(0, 10, 4.2, 7.4, 10, 0, Math.PI)];
    parts.push(xzPart(arch, 0, 17.4, marS, marT, { ox: AX, oy: AY, v0: -1.9, v1: 1.9 }, { ao: 0.3 }));
    parts.push(layer((pe) => {
      const y = AY + 1.92, s = [];
      for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; s.push(AX + Math.cos(a) * 4.2, y, 10 + Math.sin(a) * 4.2, AX + Math.cos(a) * 7.4, y, 10 + Math.sin(a) * 7.4); }
      for (const x0 of [AX - 7.4, AX + 4.2]) for (let z = 2.5; z < 10; z += 2.5) s.push(x0, y, z, x0 + 3.2, y, z);
      pe.lines('rgba(60,52,40,0.42)', 0.3, s);
      pe.poly(marT, [AX - 1.1, y + 0.01, 17.1, AX + 1.1, y + 0.01, 17.1, AX + 0.7, y + 0.01, 14.4, AX - 0.7, y + 0.01, 14.4]);
      const r = rng(3, 9);
      for (let i = 0; i < 16; i++) { const t = i / 16, a = Math.PI * (0.62 + t * 0.38); pe.dot(i % 3 ? '#466626' : '#7a9c40', AX + Math.cos(a) * 7.6, y + 0.05, 10 + Math.sin(a) * 7.6 - t * 6, 0.55 + r.next() * 0.4); }
      clump(pe, AX - 4.8, y, 15.6, 1.6, r);
    }));
    // fallen voussoirs, drums, rubble, front bushes
    const blocks = [
      { x: 27, y: 15, r: 2.6, h: 2.4, seed: 51, n: 5, rough: 0.12, top: 0.75, pw: 5, moss: 0.4 },
      { x: 32, y: 18, r: 2.4, h: 2.2, seed: 52, n: 5, rough: 0.14, top: 0.75, pw: 5, moss: 0.3 },
      { x: 36, y: 13, r: 2.2, h: 2.2, seed: 53, n: 4, rough: 0.12, top: 0.75, pw: 5, moss: 0 },
      { x: -4, y: 21, r: 2.6, h: 2.2, seed: 54, n: 5, rough: 0.16, top: 0.75, pw: 5, moss: 0.5 },
      { x: -38, y: 14, r: 3.2, h: 2.6, seed: 57, n: 6, rough: 0.2, top: 0.7, pw: 4, moss: 0.6 },
    ];
    parts.push(rockPart(blocks, marS, marT, { ao: 0.4 }));
    parts.push({ z0: 0, z1: 4.6, side: marS, top: marT, ao: 0.35, shape: (c, zt) => { const z = zt * 4.6; lyingCyl(c, 10, 21, 8, 2.3, 0.22, z, 0.1); lyingCyl(c, 19, 18, 6, 2.3, -0.6, z, 0.1); lyingCyl(c, -15, 21.5, 6.5, 2.2, 1.3, z, 0.1); } });
    parts.push(layer((pe) => {
      const s = [];
      for (const q of [[10, 21, 8, 0.22], [19, 18, 6, -0.6], [-15, 21.5, 6.5, 1.3]]) for (let k = -2; k <= 2; k++) { const e = tf([-q[2] / 2 + 0.4, k * 0.85, q[2] / 2 - 0.4, k * 0.85], q[0], q[1], q[3]); const z = 2.3 + Math.sqrt(Math.max(0, 5.29 - k * k * 0.72)); s.push(e[0], e[1], z, e[2], e[3], z); }
      pe.lines('rgba(80,70,52,0.3)', 0.3, s);
      paintMoss(pe, blocks, 5, { cracks: false });
    }));
    parts.push(...bush([{ x: -46, y: 15, r: 4.6, h: 5.2, seed: 61 }, { x: 41, y: 7, r: 4.6, h: 5, seed: 62 }, { x: 3, y: 25, r: 3.4, h: 3.6, seed: 63 }], 23));
    return { r: 50, h: 31, parts, style: 'prop', bevel: 0.7 };
  };

  /* =================================================== site_wizardtower
   * Lone crooked arcane tower on a rock outcrop: wobbling stone shaft with banded
   * joints, an overhanging upper chamber on corbels, a tall bent indigo cone, glowing
   * violet / cyan windows, three rune shards orbiting it and a pulsing orb on the tip.
   * anims 4 (glow pulse, shards a third of a turn). ~30 base, ~95 tall */
  M.site_wizardtower = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const G1 = opt.glow || '#a07cff', G2 = opt.glow2 || '#6ad8ff', GH = '#f0e8ff';
    const stS = mx(p.a, '#6c6a7a', 0.5), stT = mx(p.s, '#bab6c8', 0.45), stD = mx(p.d, '#2a2834', 0.5);
    const roofS = '#40367a', roofT = '#6e60b4';
    const ax = (z) => [Math.sin(z / 21) * 2.8 + z * 0.018, -Math.sin(z / 34 + 0.6) * 1.5];
    const rad = (z) => lerp(7.4, 5.7, z / 56) * (1 + 0.04 * Math.sin(z / 3.1));
    const sect = (z, k) => { const c0 = ax(z); return jag(11, rad(z) * (k || 1), 9 + Math.floor(z / 7), 0.06, 0.2, c0[0], c0[1]); };
    const parts = [stain(24, 16, 0.32, '#241c2c', 0, 2)];
    parts.push(layer((pe, a) => { const c = pe.c, g = c.createRadialGradient(0, 2, 0, 0, 2, 22); g.addColorStop(0, al(G1, 0.16 + 0.1 * pulse(a))); g.addColorStop(1, al(G1, 0)); c.save(); c.scale(1, 0.7); c.fillStyle = g; c.beginPath(); c.arc(0, 2 / 0.7, 22, 0, TAU); c.fill(); c.restore(); }));
    const rocks = [
      { x: -6, y: -5, r: 8, h: 8, seed: 71 }, { x: 7, y: -4, r: 7, h: 7, seed: 72 }, { x: 0, y: 5, r: 8.5, h: 5.5, seed: 73 },
      { x: -12, y: 6, r: 4, h: 3.5, seed: 74 }, { x: 12, y: 7, r: 3.4, h: 3, seed: 75 },
    ];
    const rockS = mx(p.a, '#5e5c68', 0.55), rockT = mx(p.s, '#a09eaa', 0.5);
    parts.push(rockPart(rocks, rockS, rockT));
    parts.push(...rockFacets(rocks, rockT, sh(rockS, -0.32)));
    parts.push(layer((pe) => paintMoss(pe, rocks, 4)));
    // steps up to the door
    parts.push(box(-1.2, 9.6, 4.4, 2.4, 0, 2.4, stD, stT, { bevel: false }));
    parts.push(box(-1.2, 8.4, 4.4, 2.4, 2.4, 4.4, stD, stT, { bevel: false }));
    const seg = (z0, z1, k) => ({ z0, z1, side: stS, top: stT, ao: 0.3, shape: (c, zt) => S.poly(c, sect(z0 + zt * (z1 - z0), k)) });
    const band = (z) => ({ z0: z - 0.7, z1: z + 0.7, side: stD, top: stT, ao: 0.1, bevel: false, shape: (c) => S.poly(c, sect(z, 1.09)) });
    // orbiting rune shards
    const shardAt = (a, i) => { const th = (a + i) * (TAU / 3) + 0.4, c0 = ax(40); return { x: c0[0] + Math.cos(th) * 12.5, y: c0[1] + Math.sin(th) * 12.5, z: 40 + Math.sin((a + i * 0.33) * TAU) * 1.4 + i * 2.2, front: Math.sin(th) > -0.05 }; };
    const shards = (front) => ({ z0: 36, z1: 50, side: mx(G1, '#2a1a5a', 0.35), top: GH, flat: true, ao: 0.2, bevel: false, shape: (c, zt, a) => {
      const z = 36 + zt * 14;
      for (let i = 0; i < 3; i++) { const s = shardAt(a, i); if (s.front !== front) continue; const q = (z - (s.z - 2.4)) / 4.8; if (q < 0 || q > 1) continue; S.poly(c, ngon(4, 1.35 * (1 - Math.abs(q * 2 - 1)) + 0.1, 0.5, s.x, s.y)); }
    } });
    parts.push(seg(3, 22));
    parts.push(band(22));
    parts.push(shards(false));
    parts.push(seg(22, 41));
    parts.push(band(41));
    parts.push(seg(41, 44.2));
    // little timber balcony on the east side (between the shaft halves so its back is hidden)
    const BC = ax(44), BR = rad(44);
    const sector = (r0, r1) => { const pts = []; for (let i = 0; i <= 8; i++) { const t = -0.95 + 1.9 * i / 8; pts.push(BC[0] + Math.cos(t) * r1, BC[1] + Math.sin(t) * r1); } for (let i = 8; i >= 0; i--) { const t = -0.95 + 1.9 * i / 8; pts.push(BC[0] + Math.cos(t) * r0, BC[1] + Math.sin(t) * r0); } return pts; };
    parts.push({ z0: 43.3, z1: 44.2, side: sh(p.w, -0.3), top: sh(p.w, 0.15), ao: 0.15, bevel: false, shape: (c) => S.poly(c, sector(BR - 1, BR + 3.6)) });
    { const ps = []; for (let i = 0; i <= 5; i++) { const t = -0.95 + 1.9 * i / 5; ps.push([BC[0] + Math.cos(t) * (BR + 3.3), BC[1] + Math.sin(t) * (BR + 3.3), 44.2, BC[0] + Math.cos(t) * (BR + 3.3), BC[1] + Math.sin(t) * (BR + 3.3), 46.4]); } parts.push(beams(ps, 0.35, sh(p.w, -0.3), p.w)); }
    parts.push({ z0: 46.1, z1: 46.6, side: sh(p.w, -0.3), top: sh(p.w, 0.2), stroke: 0.4, bevel: false, ao: 0, shape: (c) => { c.moveTo(BC[0] + Math.cos(-0.95) * (BR + 3.3), BC[1] + Math.sin(-0.95) * (BR + 3.3)); c.arc(BC[0], BC[1], BR + 3.3, -0.95, 0.95); } });
    parts.push(seg(44.2, 55));
    // corbel flare and the overhanging chamber
    parts.push({ z0: 53.6, z1: 57.4, side: stD, top: stS, ao: 0.25, shape: (c, zt) => { const c0 = ax(56); S.poly(c, jag(14, lerp(rad(54) * 1.02, 8.8, Math.pow(zt, 1.6)), 3, 0.05, 0, c0[0] + 1.2 * zt, c0[1] - 0.3 * zt)); } });
    const CH = [ax(56)[0] + 1.2, ax(56)[1] - 0.3];
    parts.push({ z0: 57.4, z1: 69, side: mx(stS, '#7a6a8a', 0.2), top: stT, ao: 0.28, shape: (c, zt) => S.poly(c, jag(14, 8.8 * (1 - 0.03 * zt), 5, 0.04, 0, CH[0], CH[1])) });
    parts.push(shards(true));
    parts.push(layer((pe, a) => {
      const c = pe.c, gp = pulse(a);
      const fy = (x, z) => { const c0 = ax(z); return c0[1] + Math.sqrt(Math.max(0, rad(z) * rad(z) - (x - c0[0]) * (x - c0[0]))) + 0.02; };
      // block courses on the shaft
      for (let z = 4.5; z < 55; z += 2.6) { const c0 = ax(z), rr = rad(z); c.beginPath(); c.ellipse(c0[0], c0[1] - z, rr, rr, 0, 0.15, Math.PI - 0.15); c.strokeStyle = 'rgba(30,26,40,0.28)'; c.lineWidth = 0.3; c.stroke(); for (let k = 0; k < 4; k++) { const t = 0.35 + k * 0.8 + (z % 5.2 > 2.6 ? 0.4 : 0); if (t > Math.PI - 0.2) continue; c.beginPath(); c.moveTo(c0[0] + Math.cos(t) * rr, c0[1] + Math.sin(t) * rr - z); c.lineTo(c0[0] + Math.cos(t) * rr, c0[1] + Math.sin(t) * rr - z - 2.6); c.stroke(); } }
      // door
      const dx = ax(4)[0] - 1.2;
      door(pe, dx, fy(dx, 4.4), 3, 5, '#4a3a5a', { arch: true, frame: stD });
      pe.poly('rgba(0,0,0,0)', []);
      // glowing slit windows up the shaft
      const wins = [[0.6, 14], [-2.4, 27], [2.1, 35], [-1.2, 47]];
      for (const w of wins) { const x = ax(w[1])[0] + w[0], y = fy(x, w[1]); archRect(pe, stD, x - 1.05, x + 1.05, y, w[1] - 0.4, w[1] + 3.6, true); archRect(pe, mx(G2, G1, 0.4 + 0.3 * gp), x - 0.65, x + 0.65, y + 0.01, w[1], w[1] + 3.1, true); pe.glow(G1, x, y, w[1] + 1.5, 3.2, 0.25 + 0.2 * gp); }
      // chamber windows and corbel brackets
      for (const dxw of [-5.6, -1.4, 3.2]) { const x = CH[0] + dxw, y = CH[1] + Math.sqrt(Math.max(0, 8.6 * 8.6 - dxw * dxw)) + 0.02; archRect(pe, stD, x - 1.4, x + 1.4, y, 60.2, 65.6, true); archRect(pe, mx(G1, G2, 0.3 + 0.4 * gp), x - 0.95, x + 0.95, y + 0.01, 60.6, 65.1, true); pe.lines(stD, 0.3, [x, y + 0.02, 60.6, x, y + 0.02, 64.4]); pe.glow(G1, x, y, 63, 4, 0.22 + 0.2 * gp); }
      for (const dxb of [-6.4, -3, 0.6, 4.4, 6.8]) { const x = CH[0] + dxb, y = CH[1] + Math.sqrt(Math.max(0, 8.4 * 8.4 - dxb * dxb)); pe.lines(stD, 0.9, [x, y, 57.2, x, y - 1.6, 54.6]); }
      // balcony brackets and a door onto it
      for (const t of [-0.2, 0.55]) { const x = BC[0] + Math.cos(t) * (BR + 2.4), y = BC[1] + Math.sin(t) * (BR + 2.4); pe.lines(sh(p.w, -0.35), 0.5, [x, y, 43.3, BC[0] + Math.cos(t) * BR, BC[1] + Math.sin(t) * BR, 40.6]); }
      { const x = BC[0] + BR * 0.62, y = fy(x, 44.4); archRect(pe, stD, x - 1.2, x + 1.2, y, 44.2, 48.4, true); archRect(pe, mx(G2, G1, 0.5 + 0.3 * gp), x - 0.8, x + 0.8, y + 0.01, 44.2, 48, true); }
      // ivy on the foot of the shaft
      const r = rng(19, 2);
      for (let i = 0; i < 26; i++) { const x = ax(6)[0] + r.range(-6.4, 6.4), z = 4 + Math.pow(r.next(), 1.6) * 12; if (Math.abs(x - dx) < 2 && z < 10) continue; pe.dot(i % 3 ? '#3c5a26' : '#6a8c3a', x, fy(x, z) + 0.05, z, 0.5 + r.next() * 0.4); }
    }));
    // bent cone roof
    const RZ = 69, RH = 23, tip = (zt) => [CH[0] - 5.2 * Math.pow(zt, 2.4), CH[1] + 1.2 * Math.pow(zt, 2)];
    parts.push({ z0: RZ - 0.8, z1: RZ + 0.6, side: sh(roofS, -0.2), top: roofS, ao: 0.1, bevel: false, shape: (c) => S.poly(c, jag(16, 11, 7, 0.04, 0, CH[0], CH[1])) });
    parts.push({ z0: RZ + 0.6, z1: RZ + RH, side: roofS, top: roofT, ao: 0.2, bevel: false, shape: (c, zt) => { const t = tip(zt); S.circ(c, t[0], t[1], Math.max(0.25, 11 * Math.pow(1 - zt, 1.25))); } });
    parts.push(layer((pe) => {
      const c = pe.c;
      c.save(); c.beginPath(); for (let i = 0; i <= 46; i++) { const zt = i / 46, z = RZ + 0.6 + zt * (RH - 0.6), t = tip(zt), rr = Math.max(0.25, 11 * Math.pow(1 - zt, 1.25)); c.moveTo(t[0] + rr, t[1] - z); c.arc(t[0], t[1] - z, rr, 0, TAU); } c.clip();
      for (let i = 1; i < 12; i++) { const zt = i / 12, z = RZ + 0.6 + zt * (RH - 0.6), t = tip(zt), rr = 11 * Math.pow(1 - zt, 1.25); c.beginPath(); c.arc(t[0], t[1] - z, rr, -0.25, Math.PI + 0.25); c.strokeStyle = 'rgba(20,14,50,0.5)'; c.lineWidth = 0.4; c.stroke(); c.beginPath(); c.arc(t[0], t[1] - z + 0.45, rr, -0.2, Math.PI + 0.2); c.strokeStyle = 'rgba(190,180,255,0.18)'; c.lineWidth = 0.35; c.stroke(); }
      { const g = c.createLinearGradient(CH[0] - 11, 0, CH[0] + 11, 0); g.addColorStop(0, 'rgba(200,190,255,0.32)'); g.addColorStop(0.42, 'rgba(200,190,255,0.04)'); g.addColorStop(0.6, 'rgba(10,6,30,0.06)'); g.addColorStop(1, 'rgba(10,6,30,0.42)'); c.fillStyle = g; c.fillRect(CH[0] - 14, -RZ - RH - 4, 28, RH + 8); }
      // a little dormer of light and silver star studs
      for (const q of [[0.22, 0.6], [0.4, -0.9], [0.55, 1.5], [0.7, -0.2]]) { const zt = q[0], z = RZ + 0.6 + zt * (RH - 0.6), t = tip(zt), rr = 11 * Math.pow(1 - zt, 1.25); pe.dot('#e8e0ff', t[0] + Math.cos(q[1] + 1.57) * rr * 0.8, t[1] + Math.sin(q[1] + 1.57) * rr * 0.8, z, 0.35); }
      c.restore();
    }));
    // orb on the bent tip
    const T = tip(1), OZ = RZ + RH + 2.2;
    parts.push({ z0: OZ - 1.8, z1: OZ + 1.8, side: mx(G1, G2, 0.3), top: GH, flat: true, ao: -0.2, bevel: false, shape: (c, zt) => S.circ(c, T[0], T[1], Math.max(0.3, 1.8 * Math.sqrt(1 - (zt * 2 - 1) * (zt * 2 - 1)))) });
    parts.push(layer((pe, a) => {
      const gp = pulse(a);
      pe.glow(G2, T[0], T[1], OZ, 6 + 2.5 * gp, 0.35 + 0.25 * gp);
      pe.glow('#ffffff', T[0] - 0.5, T[1], OZ + 0.5, 1.1, 0.8);
      // sparkles around the shards (front ones)
      for (let i = 0; i < 3; i++) { const s = shardAt(a, i); if (!s.front) continue; pe.glow(G1, s.x, s.y, s.z, 3.4, 0.35 + 0.2 * gp); pe.dot(GH, s.x - 0.3, s.y, s.z + 0.5, 0.3); }
      for (let i = 0; i < 6; i++) { const th = i * 1.05 + a * TAU * 0.5, rr = 3.5 + (i % 3); pe.dot(al(i % 2 ? G2 : G1, 0.4 + 0.5 * pulse(a, i * 0.17)), T[0] + Math.cos(th) * rr, T[1] + Math.sin(th) * rr * 0.5, OZ + Math.sin(th * 2) * 1.5, 0.3); }
    }));
    return { r: 22, h: OZ + 3, parts, style: 'prop', bevel: 0.7, spots: { orb: [T[0], T[1], OZ] } };
  };

  /* ===================================================== site_magicwell
   * Ring of carved standing stones round a glowing pool: flagstone apron, carved
   * lip, flat blue-cyan water with expanding ripples, pulsing runes and rising motes.
   * anims 4. ~40 */
  M.site_magicwell = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const W1 = opt.glow || '#5ae8ff', W2 = '#2276c8', WH = '#e4ffff';
    const stS = mx(p.a, '#7c7c80', 0.5), stT = mx(p.s, '#c6c4be', 0.45);
    const parts = [];
    parts.push(layer((pe, a) => { const c = pe.c, g = c.createRadialGradient(0, 0, 0, 0, 0, 24); g.addColorStop(0, al(W1, 0.2 + 0.08 * pulse(a))); g.addColorStop(0.6, al(W1, 0.07)); g.addColorStop(1, al(W1, 0)); c.save(); c.scale(1, 0.72); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); c.restore(); }));
    // flagstone apron
    parts.push({ z0: 0, z1: 0.7, side: sh(stS, -0.2), top: mx(stT, '#9a9a90', 0.3), ao: 0.3, bevel: false, shape: (c) => S.poly(c, jag(22, 16.5, 3, 0.1)),
      detail: (c) => { const s = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.1; s.push(Math.cos(a) * 9.8, Math.sin(a) * 9.8, Math.cos(a) * 16.5, Math.sin(a) * 16.5); } S.lines(c, 'rgba(40,40,44,0.4)', 0.3, s); c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.strokeStyle = 'rgba(40,40,44,0.35)'; c.lineWidth = 0.3; c.stroke(); for (const q of [[-12, 6], [11, -9], [4, 14]]) S.fillPoly(c, 'rgba(80,110,50,0.5)', ngon(5, 1.6, 0.4, q[0], q[1], 1.4, 0.9)); } });
    // water
    parts.push({ z0: 0.7, z1: 1.3, side: W2, top: W1, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 8.6) });
    parts.push(layer((pe, a) => {
      const c = pe.c, z = 1.3;
      c.save(); c.beginPath(); c.arc(0, -z, 8.6, 0, TAU); c.clip();
      const g = c.createRadialGradient(-1, -z - 1, 0, 0, -z, 8.6); g.addColorStop(0, WH); g.addColorStop(0.35, W1); g.addColorStop(1, W2);
      c.fillStyle = g; c.fillRect(-9, -z - 9, 18, 18);
      for (let k = 0; k < 3; k++) { const rr = ((a + k / 3) % 1) * 8.4; c.beginPath(); c.arc(0, -z, rr, 0, TAU); c.strokeStyle = al(WH, 0.55 * (1 - rr / 8.6)); c.lineWidth = 0.45; c.stroke(); }
      const r = rng(3, frame4(a));
      for (let i = 0; i < 9; i++) { const aa = r.range(0, TAU), d = r.range(1, 7.5); pe.dot(al('#ffffff', r.range(0.5, 0.9)), Math.cos(aa) * d, Math.sin(aa) * d, z, r.range(0.18, 0.38)); }
      c.restore();
    }));
    // carved lip
    parts.push({ z0: 0.7, z1: 2.6, side: stS, top: stT, stroke: 1.9, ao: 0.35, bevel: false, shape: (c) => S.circ(c, 0, 0, 9.5),
      detail: (c, a) => { for (let i = 0; i < 12; i++) { const t = (i / 12) * TAU; S.lines(c, 'rgba(40,40,44,0.45)', 0.3, [Math.cos(t) * 8.6, Math.sin(t) * 8.6, Math.cos(t) * 10.4, Math.sin(t) * 10.4]); S.dot(c, al(W1, 0.5 + 0.4 * pulse(a, i / 12)), Math.cos(t + 0.26) * 9.5, Math.sin(t + 0.26) * 9.5, 0.3); } } });
    // standing stones
    const stones8 = [];
    for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU + 0.2, d = 14 + (i % 2) * 0.8; stones8.push({ x: Math.cos(t) * d, y: Math.sin(t) * d, r: 1.9, sx: 1.55, sy: 1, rot: t + Math.PI / 2, h: 8 + ((i * 5) % 4) * 1.1, seed: 80 + i, n: 7, rough: 0.16, top: 0.55, pw: 5, lx: Math.cos(t) * 0.6, ly: Math.sin(t) * 0.6, moss: 0.5, t }); }
    parts.push(rockPart(stones8, stS, stT, { ao: 0.42 }));
    parts.push(...rockFacets(stones8, stT, sh(stS, -0.3)));
    parts.push(layer((pe, a) => {
      paintMoss(pe, stones8, 9, { cracks: false, size: 0.8 });
      for (let i = 0; i < 8; i++) { const s = stones8[i], q = 0.42, x = s.x + s.lx * q, y = s.y + s.ly * q + 1.1; const ap = 0.45 + 0.55 * pulse(a, i / 8); rune(pe, x - 0.2, y + 0.4, s.h * 0.3, 2.6, W1, i * 3 + 1, ap); pe.glow(W1, x, y + 0.4, s.h * 0.45, 2.6, 0.16 * ap); }
      // motes rising from the pool
      for (let i = 0; i < 10; i++) { const ph = (a + i / 10) % 1, aa = i * 2.4; pe.dot(al(i % 3 ? W1 : '#ffffff', 0.9 * (1 - ph)), Math.cos(aa) * (2 + i % 4 * 1.4), Math.sin(aa) * (2 + i % 4 * 1.4), 1.5 + ph * 12, 0.32 + 0.12 * (1 - ph)); }
    }));
    return { r: 22, h: 16, parts, style: 'prop', bevel: 0.7, spots: { glow: [0, 0, 2] } };
  };

  /* ============================================================ site_fort
   * Abandoned fort ~130: crenellated stone curtain on the north and west, broken
   * to rubble in places, a ruined round tower (banner, pal.k), a collapsed corner,
   * a roofless barracks with bare rafters, a timber palisade with gaps and leaning
   * stakes on the east, and a ruined gatehouse with a broken arch and fallen gate. */
  M.site_fort = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), m = mats(p);
    const stS = mx(p.a, '#8a867c', 0.35), stT = mx(p.s, '#c4beb0', 0.35), stD = mx(p.a, '#5a5650', 0.4);
    const wd = mx(p.w, '#6a4c32', 0.3), wdT = sh(wd, 0.3);
    const parts = [stain(70, 54, 0.18, '#2a2216', 0, 0)];
    parts.push(layer((pe) => {
      const c = pe.c, g = c.createRadialGradient(0, 0, 4, 0, 0, 52);
      g.addColorStop(0, 'rgba(120,94,60,0.22)'); g.addColorStop(0.75, 'rgba(120,94,60,0.16)'); g.addColorStop(1, 'rgba(120,94,60,0)');
      c.save(); c.scale(1, 0.82); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 52, 0, TAU); c.fill(); c.restore();
      pe.lines('rgba(70,52,30,0.22)', 1, [-1.6, 52, 0, -4, 10, 0, 1.6, 52, 0, 3.4, 10, 0]);
    }));
    // north curtain + NW tower + NE collapsed corner
    const north = wallRun([[-45, -42], [45, -42]], 3, { H: 13, gap: 0.1, low: 0.35 });
    parts.push(wallPart(north, 5, stS, stT, { out: -1 }));
    parts.push(layer((pe) => paintWallFaces(pe, north, 5, 5, { slits: true })));
    const TR = 8.5, TH = 22;
    parts.push({ z0: 0, z1: TH, side: stS, top: stT, ao: 0.32, shape: (c, zt) => { const z = zt * TH; let pts = ngon(18, TR - z * 0.03, 0, -52, -42); if (z > TH - 6) pts = clipHalf(pts, 0.75, 0.66, (z - (TH - 6)) * 2.2 - 6 + 0.75 * -52 + 0.66 * -42); polyOK(c, pts); } });
    parts.push(layer((pe) => {
      const c = pe.c;
      c.save(); c.beginPath(); for (let z = 0; z <= TH; z += 0.5) { let pts = ngon(18, TR - z * 0.03, 0, -52, -42); if (z > TH - 6) pts = clipHalf(pts, 0.75, 0.66, (z - (TH - 6)) * 2.2 - 6 + 0.75 * -52 + 0.66 * -42); if (pts.length < 6) continue; c.moveTo(pts[0], pts[1] - z); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1] - z); c.closePath(); } c.clip();
      for (let z = 1.6; z < TH; z += 1.6) { c.beginPath(); c.arc(-52, -42 - z, TR - z * 0.03, 0.1, Math.PI - 0.1); c.strokeStyle = 'rgba(40,34,28,0.32)'; c.lineWidth = 0.3; c.stroke(); }
      for (const q of [[-3, 6], [2.6, 12], [-1.5, 16.5]]) archRect(pe, '#1e1812', -52 + q[0] - 0.55, -52 + q[0] + 0.55, -42 + Math.sqrt(TR * TR - q[0] * q[0]) + 0.02, q[1], q[1] + 3, true);
      c.restore();
      const r = rng(5, 1);
      for (let i = 0; i < 4; i++) clump(pe, -55 + r.range(-2, 3), -38 + r.range(-1, 2), r.range(1, 6), 1.4, r);
    }));
    parts.push(...flagPole(-55, -44, TH - 1, 8, p));
    parts.push(layer((pe, a) => paintFlag(pe, -54.55, -44, TH + 6.8, 7.5, 4.6, a, p.k, p.k2, { droop: 0.35 })));
    const rub = [
      { x: 52, y: -42, r: 9, h: 6, seed: 3, n: 12, rough: 0.4, top: 0.3 }, { x: 46, y: -35, r: 4, h: 3, seed: 4, n: 7, rough: 0.4 },
      { x: -52, y: 40, r: 7, h: 5.5, seed: 5, n: 11, rough: 0.4 }, { x: 58, y: -34, r: 3, h: 2.2, seed: 6, n: 7 },
    ];
    for (const q of north.concat()) if (q.h < 3) rub.push({ x: (q.x0 + q.x1) / 2, y: -40, r: 3.4, h: 2.4, seed: (q.x0 | 0) + 50, n: 7, rough: 0.45 });
    // barracks ruin: a roofless stone shell with window holes, charred beams inside
    const bar = wallRun([[-34, -35], [-4, -35], [-4, -21], [-34, -21], [-34, -35]], 31, { H: 7.5, gap: 0.12, low: 0.45, seg: 4.5, noCren: true });
    parts.push({ z0: 0, z1: 0.5, side: sh(wd, -0.3), top: mx(wd, '#5a5040', 0.5), ao: 0.2, bevel: false, shape: (c) => c.rect(-33.2, -34.2, 28.4, 12.4) });
    parts.push({ z0: 0, z1: 2.2, side: sh(wd, -0.4), top: sh(wd, -0.2), ao: 0.3, shape: (c, zt) => { const z = zt * 2.2; lyingCyl(c, -22, -29, 16, 0.8, 0.2, z); lyingCyl(c, -14, -26, 11, 0.7, -0.5, z); lyingCyl(c, -27, -25, 8, 0.7, 1.1, z); } });
    parts.push(wallPart(bar, 1.6, stS, stT));
    parts.push(layer((pe) => {
      for (const q of bar) {
        if (Math.abs(q.y1 - q.y0) > 0.5 || q.y0 < -30) continue;
        const x0 = Math.min(q.x0, q.x1), x1 = Math.max(q.x0, q.x1), y = -21 + 0.82, top = q.h - 3;
        if (top > 0.6) stones(pe, x0, x1, y, 0, top, (x0 | 0) + 3, { row: 1.3, w: 1.1, joint: 'rgba(40,34,28,0.32)' });
        if (q.h > 5.5) archRect(pe, '#241c14', (x0 + x1) / 2 - 0.8, (x0 + x1) / 2 + 0.8, y + 0.01, 2.2, 4.8, true);
      }
      const r = rng(7, 3);
      for (let i = 0; i < 3; i++) clump(pe, -30 + i * 11 + r.range(-2, 2), -20 + r.range(0, 1), r.range(0.4, 1.4), 1.2, r);
    }));
    // west curtain (outer = west)
    const west = wallRun([[-52, -34], [-52, 33]], 7, { H: 12, gap: 0.14, low: 0.4 });
    parts.push(wallPart(west, 5, stS, stT, { out: 1 }));
    parts.push(layer((pe) => { for (const q of west) { if (q.cren) pe.poly(al(stT, 0.9), [-52 + 0.5, q.y0, q.h, -49.5, q.y0, q.h, -49.5, q.y1, q.h, -52 + 0.5, q.y1, q.h]); } }));
    for (const q of west) if (q.h < 3) rub.push({ x: -49, y: (q.y0 + q.y1) / 2 + 1, r: 3.6, h: 2.6, seed: (q.y0 | 0) + 90, n: 7, rough: 0.45 });
    // east palisade
    const stakes = [], r = rng(13, 2), fallen = [];
    for (let y = -36; y <= 36; y += 2.05) { if ((y > -12 && y < -4) || (y > 18 && y < 24)) { if (r.next() < 0.5) fallen.push([55 + r.range(1, 5), y, r.range(6, 9), r.range(-0.4, 0.4)]); continue; } const br = r.next() < 0.18; stakes.push({ x: 53 + r.range(-0.3, 0.3), y, h: br ? r.range(2.4, 5) : r.range(8.6, 10.8), lx: r.next() < 0.15 ? r.range(1, 2.4) : r.range(-0.3, 0.3), ly: r.range(-0.4, 0.4), r: r.range(1.1, 1.35) }); }
    for (let x = 16; x <= 52; x += 2.05) { if (x > 30 && x < 37) { if (r.next() < 0.6) fallen.push([x, 44 + r.range(1, 4), r.range(6, 9), Math.PI / 2 + r.range(-0.5, 0.5)]); continue; } const br = r.next() < 0.2; stakes.push({ x, y: 41 + r.range(-0.3, 0.3), h: br ? r.range(2.4, 5) : r.range(8.6, 10.8), lx: r.range(-0.3, 0.3), ly: r.next() < 0.15 ? r.range(1, 2.2) : r.range(-0.3, 0.3), r: r.range(1.1, 1.35) }); }
    const stakePart = (list) => ({ z0: 0, z1: 11, side: wd, top: wdT, ao: 0.35, shape: (c, zt) => { const z = zt * 11; for (const s of list) { if (z > s.h) continue; const q = z / s.h; S.circ(c, s.x + s.lx * q, s.y + s.ly * q, s.r * Math.min(1, (s.h - z) / 1.7 + 0.08)); } } });
    parts.push(stakePart(stakes.filter((s) => s.y < 38)));
    parts.push({ z0: 0, z1: 2, side: wd, top: wdT, ao: 0.3, shape: (c, zt) => { for (const f of fallen) lyingCyl(c, f[0], f[1], f[2], 1, f[3], zt * 2); } });
    parts.push(rockPart(rub, stS, stT, { ao: 0.4 }));
    parts.push(layer((pe) => paintMoss(pe, rub, 11, { cracks: false })));
    // courtyard clutter
    if (M.prop_crates) parts.push(...embed(M.prop_crates(pal, {}), 18, -22, 0));
    if (M.prop_barrels) parts.push(...embed(M.prop_barrels(pal, {}), 27, -17, 0));
    if (M.prop_logs) parts.push(...embed(M.prop_logs(pal, {}), -30, 6, 0));
    // south: broken wall, SW stump, gatehouse, SE palisade
    const sw = wallRun([[-46, 41], [-14, 41]], 21, { H: 11, gap: 0.2, low: 0.6 });
    parts.push(wallPart(sw, 5, stS, stT, { out: 1 }));
    parts.push(layer((pe) => paintWallFaces(pe, sw, 5, 23)));
    parts.push({ z0: 0, z1: 10, side: stS, top: stT, ao: 0.32, shape: (c, zt) => { const z = zt * 10; let pts = ngon(16, 6.6, 0, -52, 41); if (z > 5) pts = clipHalf(pts, -0.6, 0.8, (z - 5) * 1.6 - 6 - 0.6 * -52 + 0.8 * 41); polyOK(c, pts); } });
    const GT = [{ x: -9.5, h: 18 }, { x: 9.5, h: 12.5, br: 1 }];
    parts.push({ z0: 0, z1: 18, side: stS, top: stT, ao: 0.32, shape: (c, zt) => { const z = zt * 18; for (const g of GT) { if (z > g.h) continue; let pts = [g.x - 5, 35.5, g.x + 5, 35.5, g.x + 5, 46.5, g.x - 5, 46.5]; if (g.br && z > g.h - 4) pts = clipHalf(pts, -0.8, 0.6, (z - (g.h - 4)) * 2.4 - 7 - 0.8 * g.x + 0.6 * 41); polyOK(c, pts); } } });
    parts.push(wallPart(wallRun([[-14.5, 35.5], [-4.5, 35.5], [-4.5, 46.5], [-14.5, 46.5], [-14.5, 35.5]], 1, { hs: [18], H: 18, seg: 2.5 }), 1.4, stS, stT, { out: -1, mh: 2.4 }));
    const arch = ringQuads(0, 8, 4.5, 6.6, 4, Math.PI * 0.66, Math.PI);
    parts.push(xzPart(arch, 0, 14.8, stS, stT, { oy: 41, v0: -5, v1: 5 }, { ao: 0.3 }));
    parts.push(layer((pe) => {
      for (const g of GT) { stones(pe, g.x - 5, g.x + 5, 46.52, 0, g.br ? g.h - 4 : g.h, (g.x | 0) + 7, { row: 1.6, w: 1.4, joint: 'rgba(40,34,28,0.32)' }); archRect(pe, '#1e1812', g.x - 0.55, g.x + 0.55, 46.54, 9, 12, true); }
      const s = []; for (let i = 1; i < 4; i++) { const a = Math.PI * (0.66 + 0.34 * i / 4); s.push(Math.cos(a) * 4.5, 46.05, 8 + Math.sin(a) * 4.5, Math.cos(a) * 6.6, 46.05, 8 + Math.sin(a) * 6.6); }
      pe.lines('rgba(40,34,28,0.42)', 0.3, s);
      const r2 = rng(9, 3);
      for (let i = 0; i < 4; i++) clump(pe, 9.5 + r2.range(-4, 4), 41 + r2.range(-3, 3), 11.8, 1.1, r2);
      // binding bands on the south palisade
      for (const st of stakes) if (st.y > 38 && st.h > 7) { pe.wall('rgba(40,28,18,0.7)', st.x - 1, st.x + 1, st.y + 1.05, 2.6, 3.2); pe.wall('rgba(40,28,18,0.7)', st.x - 1, st.x + 1, st.y + 1.05, 6.6, 7.2); }
    }));
    parts.push(stakePart(stakes.filter((s) => s.y >= 38)));
    parts.push(rockPart([{ x: 2.5, y: 37, r: 3.4, h: 2.4, seed: 81, n: 7, rough: 0.45 }, { x: -2, y: 44, r: 2.6, h: 1.8, seed: 82, n: 7, rough: 0.45 }], stS, stT));
    // the fallen gate leaf
    parts.push({ z0: 0, z1: 0.9, side: sh(wd, -0.3), top: wd, ao: 0.2, shape: (c) => S.poly(c, tf([-4, -3.2, 4, -3.2, 3.6, 3.2, -4, 3.2], 3, 52, 0.35)),
      detail: (c) => { c.save(); c.translate(3, 52); c.rotate(0.35); S.lines(c, 'rgba(30,20,12,0.55)', 0.3, [-2, -3.2, -2, 3.2, 0, -3.2, 0, 3.2, 2, -3.2, 2, 3.2]); S.lines(c, '#3a3634', 0.6, [-4, -1.8, 3.8, -1.8, -4, 1.8, 3.7, 1.8]); c.restore(); } });
    return { r: 76, h: 32, parts, style: 'prop', bevel: 0.7, spots: { flag: [-55, -44, TH + 7], gate: [0, 44, 0] } };
  };

  /* ========================================================== site_bridge
   * Stone arch bridge, 16 directions, modelled along x: 120 long, 26 wide. Three
   * elliptical arches on pointed cutwaters, voussoir rings, a cornice, low parapets
   * with coping, newel pillars at the deck ends and paved ramps down to the banks.
   * Deck walk height ~7 (ramps down to 1.2 at x = ±60). */
  M.site_bridge = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const stS = mx(p.a, '#8c8678', 0.4), stT = mx(p.s, '#c6bea8', 0.4), stD = mx(p.a, '#5e5a52', 0.4), ring = mx(p.s, '#b0a890', 0.3), deck = mx(p.s, '#a89e86', 0.4);
    const DZ = 7, L = 60, RX = 46, W = 12;
    const arches = [[-31.5, 10.5, 4.6], [0, 15, 5.3], [31.5, 10.5, 4.6]];
    const ell = (cu, hs, zc, t) => [cu + Math.cos(t) * hs, Math.sin(t) * zc];
    const prof = [-L, 0, -L, 1.2, -RX, DZ, RX, DZ, L, 1.2, L, 0];
    for (let k = arches.length - 1; k >= 0; k--) { const [cu, hs, zc] = arches[k]; prof.push(cu + hs, 0); for (let i = 1; i < 12; i++) { const q = ell(cu, hs, zc, (i / 12) * Math.PI); prof.push(q[0], q[1]); } prof.push(cu - hs, 0); }
    const parts = [];
    // cutwaters at the piers (both sides)
    const cw = [-21, 21];
    parts.push({ z0: 0, z1: 5.2, side: stS, top: stT, ao: 0.35, shape: (c, zt) => { const k = 1 - zt * 0.15; for (const x of cw) for (const s of [1, -1]) S.poly(c, [x - 3 * k, s * (W - 0.5), x + 3 * k, s * (W - 0.5), x, s * (W + 4.6 * k)]); } });
    parts.push({ z0: 5.2, z1: 6.8, side: stD, top: stT, ao: 0.1, bevel: false, shape: (c, zt) => { for (const x of cw) for (const s of [1, -1]) S.poly(c, [x - 2.6 * (1 - zt), s * W, x + 2.6 * (1 - zt), s * W, x, s * (W + 4 * (1 - zt))]); } });
    parts.push(xzPart([prof], 0, DZ, stS, deck, { v0: -W, v1: W }, { ao: 0.38,
      detail: (c) => {
        const s = [], r = rng(5, 5);
        S.fillPoly(c, 'rgba(70,60,44,0.14)', [-RX, -4.6, RX, -4.6, RX, 4.6, -RX, 4.6]);
        for (let x = -RX + 2.4; x < RX; x += 2.4) s.push(x, -W + 1.6, x, W - 1.6);
        for (let y = -W + 1.6 + 2.6; y < W - 1.6; y += 2.6) for (let x = -RX + (y * 7 % 2.4); x < RX; x += 4.8) s.push(x, y, x + 2.4, y);
        S.lines(c, 'rgba(60,52,40,0.4)', 0.28, s);
        for (let i = 0; i < 60; i++) S.dot(c, r.next() < 0.5 ? 'rgba(255,250,235,0.16)' : 'rgba(40,34,26,0.14)', r.range(-RX, RX), r.range(-W + 2, W - 2), r.range(0.5, 1.1));
        S.lines(c, 'rgba(60,52,40,0.25)', 0.9, [-RX, -3.4, RX, -3.4, -RX, 3.4, RX, 3.4]);
        for (const q of [[-30, -6, 1.6], [12, 7, 1.3], [36, -2, 1.1], [-8, 4, 0.9]]) S.dot(c, 'rgba(90,110,50,0.5)', q[0], q[1], q[2]);
      } }));
    // arch voussoir rings (proud of the faces)
    const rq = [];
    for (const [cu, hs, zc] of arches) for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI, a1 = ((i + 1) / 12) * Math.PI, p0 = ell(cu, hs, zc, a0), p1 = ell(cu, hs, zc, a1), q0 = ell(cu, hs + 1.5, zc + 1.4, a0), q1 = ell(cu, hs + 1.5, zc + 1.4, a1); rq.push([p0[0], p0[1], q0[0], q0[1], q1[0], q1[1], p1[0], p1[1]]); }
    parts.push(xzPart(rq, 0, 7, ring, stT, { v0: -W - 0.35, v1: W + 0.35 }, { ao: 0.25, bevel: false }));
    // cornice ledge under the parapets
    parts.push(xzPart([[-RX, DZ - 1.3, RX, DZ - 1.3, RX, DZ, -RX, DZ]], DZ - 1.3, DZ, stD, stT, { v0: -W - 0.7, v1: W + 0.7 }, { ao: 0.1, bevel: false }));
    // ramps re-surfaced in the deck colour
    parts.push(xzPart([[-L, 0, -L, 1.2, -RX, DZ, -RX + 0.5, 0], [L, 0, L, 1.2, RX, DZ, RX - 0.5, 0]], 0, DZ, mx(deck, stS, 0.45), deck, { v0: -W + 1.8, v1: W - 1.8 }, { ao: 0.25, bevel: false }));
    // parapets with coping
    const par = [-L + 2, 1.2, -RX, DZ, RX, DZ, L - 2, 1.2, L - 2, 4.4, RX, DZ + 3.2, -RX, DZ + 3.2, -L + 2, 4.4];
    parts.push(xzPart([par], 1.2, DZ + 3.2, stS, stT, { v0: W - 1.8, v1: W }, { ao: 0.3 }));
    parts.push(xzPart([par], 1.2, DZ + 3.2, stS, stT, { v0: -W, v1: -W + 1.8 }, { ao: 0.3 }));
    // newel pillars at the deck ends and posts at the bank ends
    parts.push({ z0: 0, z1: DZ + 4.6, side: stS, top: stT, ao: 0.35, shape: (c, zt) => { const z = zt * (DZ + 4.6); for (const x of [-RX, RX]) for (const s of [1, -1]) c.rect(x - 1.7, s * (W - 0.9) - 1.7, 3.4, 3.4); if (z < 5.6) for (const x of [-L + 2, L - 2]) for (const s of [1, -1]) c.rect(x - 1.4, s * (W - 0.9) - 1.4, 2.8, 2.8); } });
    parts.push({ z0: DZ + 4.6, z1: DZ + 5.8, side: stD, top: stT, ao: 0.1, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.6; for (const x of [-RX, RX]) for (const s of [1, -1]) S.poly(c, ngon(4, 2.6 * k, Math.PI / 4, x, s * (W - 0.9))); } });
    return { r: 63, h: DZ + 6.5, parts, style: 'prop', bevel: 0.7, deckZ: DZ };
  };

  /* =========================================================== site_shrine
   * Standing-stone circle ~60: nine weathered monoliths (a trilithon at the north,
   * one fallen, one broken) round a stepped dais with a carved altar, glowing runes
   * (opt.glow, default warm gold) on stones, altar and dais, a soft light shaft.
   * anims 4 optional (rune pulse, motes). */
  M.site_shrine = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const G = opt.glow || '#ffd66a', GH = '#fff6d6';
    const stS = mx(p.s, '#8e8c84', 0.5), stT = mx(p.b, '#d2cec2', 0.45);
    const parts = [stain(36, 26, 0.2, '#2a2216', 0, 2)];
    parts.push(layer((pe, a) => {
      const c = pe.c;
      c.save(); c.scale(1, 0.8);
      c.beginPath(); c.arc(0, 2.5, 25, 0, TAU); c.arc(0, 2.5, 19, 0, TAU, true); c.fillStyle = 'rgba(110,90,58,0.16)'; c.fill();
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 20); g.addColorStop(0, al(G, 0.16 + 0.08 * pulse(a))); g.addColorStop(1, al(G, 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill();
      c.restore();
    }));
    parts.push({ z0: 0, z1: 0.9, side: sh(stS, -0.15), top: mx(stT, stS, 0.4), ao: 0.3, bevel: false, shape: (c) => S.poly(c, jag(16, 10, 5, 0.08)) });
    parts.push({ z0: 0.9, z1: 1.8, side: sh(stS, -0.1), top: mx(stT, stS, 0.25), ao: 0.3, shape: (c) => S.poly(c, ngon(12, 7.2, 0.13)),
      detail: (c, a) => { const ap = 0.5 + 0.5 * pulse(a); for (let i = 0; i < 12; i++) { const t = (i / 12) * TAU, x = Math.cos(t) * 6, y = Math.sin(t) * 6; S.lines(c, al(G, 0.5 + 0.45 * ap), 0.3, [x - 0.4, y, x + 0.4, y, x, y - 0.5, x, y + 0.5]); } c.beginPath(); c.arc(0, 0, 5.2, 0, TAU); c.strokeStyle = al(G, 0.35 + 0.3 * ap); c.lineWidth = 0.25; c.stroke(); } });
    // altar
    parts.push(box(0, 0, 6, 3.4, 1.8, 4.8, stS, stT, { ao: 0.3 }));
    parts.push(box(0, 0, 7.6, 4.6, 4.8, 5.9, sh(stS, 0.05), stT, { ao: 0.15, detail: (c) => { S.lines(c, 'rgba(50,46,40,0.35)', 0.3, [-3.4, -1.8, 3.4, -1.8]); } }));
    parts.push({ z0: 5.9, z1: 7.1, side: '#8a6a34', top: '#c89a48', ao: 0.2, bevel: false, shape: (c, zt) => S.circ(c, 0, 0, 1.4 + zt * 0.5) });
    // standing stones
    const R = 22, st = [];
    for (let i = 0; i < 9; i++) {
      const t = -Math.PI / 2 + (i / 9) * TAU + (i === 0 ? 0 : 0.08 * Math.sin(i * 3));
      if (i === 5) continue; // fallen one
      const tri = i === 0;
      const h = tri ? 15 : i === 3 ? 5 : 12.5 + ((i * 7) % 5) * 1.2;
      const lean = tri ? 0 : (i % 2 ? 0.08 : -0.06) * h;
      for (const o of tri ? [-0.15, 0.15] : [0]) st.push({ x: Math.cos(t + o) * R, y: Math.sin(t + o) * R, r: 2.5, sx: 1.4, sy: 1, rot: t + o + Math.PI / 2, h, seed: 90 + i * 3 + (o > 0 ? 1 : 0), n: 8, rough: tri ? 0.14 : 0.26, top: tri ? 0.6 : 0.42, pw: tri ? 6 : 3.4, lx: Math.cos(t) * lean, ly: Math.sin(t) * lean, moss: 0.6, t: t + o, gi: i });
    }
    parts.push(rockPart(st, stS, stT, { ao: 0.42 }));
    parts.push(...rockFacets(st, stT, sh(stS, -0.3)));
    // trilithon lintel and the fallen stone
    const t0 = -Math.PI / 2;
    parts.push({ z0: 15, z1: 17.6, side: stS, top: stT, ao: 0.2, shape: (c) => S.poly(c, tf([-5.6, -1.6, 5.4, -1.8, 5.8, 1.6, -5.4, 1.7], Math.cos(t0) * R, Math.sin(t0) * R, t0 + Math.PI / 2)) });
    const tf5 = -Math.PI / 2 + (5 / 9) * TAU;
    parts.push({ z0: 0, z1: 3.2, side: stS, top: stT, ao: 0.35, shape: (c, zt) => S.poly(c, tf(jag(8, 1, 7, 0.12, 0, 0, 0, 7.5 * (1 - zt * 0.1), 2.6 * (1 - zt * 0.25)), Math.cos(tf5) * (R + 3), Math.sin(tf5) * (R + 3), tf5 + 0.35)) });
    parts.push(layer((pe, a) => {
      paintMoss(pe, st, 13, { cracks: true, size: 0.8 });
      for (const s of st) { if (s.h < 8) continue; const q = 0.4, x = s.x + s.lx * q, y = s.y + s.ly * q + 1.3; const ap = 0.45 + 0.55 * pulse(a, s.gi / 9); rune(pe, x - 0.2, y, s.h * 0.32, 3, G, s.gi * 2 + 3, ap); pe.glow(G, x, y, s.h * 0.45, 3, 0.14 * ap); }
      // altar runes and the light shaft
      const ap = 0.5 + 0.5 * pulse(a);
      for (let i = 0; i < 3; i++) rune(pe, -1.8 + i * 1.8, 1.72, 2.4, 1.5, G, i + 4, ap);
      const c = pe.c;
      for (const [w0, w1, aa] of [[3, 7, 0.1], [1.4, 3.2, 0.2]]) { const g = c.createLinearGradient(0, -7, 0, -36); g.addColorStop(0, al(G, aa + 0.08 * ap)); g.addColorStop(1, al(G, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(-w0, -7); c.lineTo(w0, -7); c.lineTo(w1, -36); c.lineTo(-w1, -36); c.closePath(); c.fill(); }
      pe.glow(GH, 0, 0, 7.4, 2.6, 0.9);
      for (let i = 0; i < 8; i++) { const ph = (a + i / 8) % 1, th = i * 2.3; pe.dot(al(i % 2 ? G : GH, 0.9 * (1 - ph)), Math.cos(th) * (1 + (i % 3)), Math.sin(th) * 1.2, 8 + ph * 18, 0.3); }
    }));
    return { r: 34, h: 30, parts, style: 'prop', bevel: 0.7, spots: { altar: [0, 0, 7] } };
  };

  /* ============================================================= site_cave
   * Cave mouth in a boulder mound ~70: a jagged black opening with fangs of rock,
   * roots trailing over it, a churned mud apron with claw marks, scattered bones
   * and a beast's ribcage, and (opt.eyes, default on) two eyes glinting inside. */
  M.site_cave = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const rkS = mx(p.a, '#6c6860', 0.5), rkT = mx(p.s, '#aaa698', 0.45), BONE = '#e4dac0';
    const parts = [stain(40, 28, 0.32, '#1e1810', 0, 6)];
    parts.push({ z0: 0, z1: 0.6, side: '#4a3a2a', top: '#6e5a42', ao: 0.2, bevel: false, shape: (c) => S.poly(c, jag(14, 13, 9, 0.3, 0, 0, 7, 1.35, 0.7)),
      detail: (c) => { S.lines(c, 'rgba(30,22,14,0.6)', 0.35, [-6, 4, -3, 9, -5, 4, -2, 9.4, -4, 4, -1, 9.8, 5, 6, 8, 11, 6, 6, 9, 10.8, 7, 6, 10, 10.4]); for (const q of [[-9, 10], [3, 13], [10, 7]]) S.dot(c, 'rgba(30,22,14,0.35)', q[0], q[1], 1.2); } });
    const back = [
      { x: -8, y: -33, r: 11, h: 20, seed: 101 }, { x: 13, y: -31, r: 10, h: 19, seed: 102 },
      { x: 1, y: -22, r: 17, h: 31, seed: 103, n: 13, sx: 1.2, sy: 0.85 },
      { x: -21, y: -15, r: 12, h: 21, seed: 104, n: 12 }, { x: 21, y: -14, r: 12, h: 20, seed: 105, n: 12 },
      { x: -33, y: -3, r: 7.5, h: 10, seed: 106 }, { x: 32, y: -2, r: 7.5, h: 9, seed: 107 },
    ];
    parts.push(rockPart(back, rkS, rkT));
    parts.push(...rockFacets(back, rkT, sh(rkS, -0.32)));
    parts.push(layer((pe) => paintMoss(pe, back, 17)));
    const yF = -5, FH = 17;
    const faceSect = (z) => { const q = z / FH, w = 12.5 * (1 - 0.22 * q), dn = 1.5 + 12 * (1 - Math.pow(q, 1.4)), pts = [-w, yF, w, yF]; for (let i = 1; i < 9; i++) { const a = (i / 9) * Math.PI; pts.push(Math.cos(a) * w * 1.12, yF - Math.sin(a) * dn * (0.9 + 0.2 * U.hash2(i, 7, 2))); } return pts; };
    parts.push({ z0: 0, z1: FH, side: mx(rkS, '#5a564e', 0.3), top: rkT, ao: 0.42, shape: (c, zt) => S.poly(c, faceSect(zt * FH)) });
    parts.push(layer((pe, a) => {
      const c = pe.c, y = yF + 0.02;
      // jagged mouth
      const mouth = [-9, 0, -9.4, 4, -8.2, 8, -6.4, 11, -3.6, 12.8, -0.6, 13.6, 2.6, 13.2, 5.6, 11.6, 7.8, 9, 9, 5, 9.2, 0];
      c.beginPath(); for (let i = 0; i < mouth.length; i += 2) { const X = mouth[i], Z = mouth[i + 1]; if (i) c.lineTo(X, y - Z); else c.moveTo(X, y - Z); } c.closePath();
      const g = c.createRadialGradient(0, y - 4, 1, 0, y - 5, 13); g.addColorStop(0, '#050403'); g.addColorStop(0.6, '#120e0a'); g.addColorStop(1, '#2a2218'); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(20,16,12,0.8)'; c.lineWidth = 0.6; c.stroke();
      // rock fangs hanging from the lip and rising from the floor
      for (const f of [[-6.2, 10.6, 1.1, 2.6], [-3.4, 12.4, 0.9, 3.2], [0.4, 13.2, 1.2, 2.2], [3.6, 12.4, 0.9, 3], [6.4, 10.2, 1, 2.4]]) pe.poly(mx(rkS, rkT, 0.3), [f[0] - f[2], y, f[1] + 0.3, f[0] + f[2], y, f[1] + 0.3, f[0] + 0.15, y, f[1] - f[3]]);
      for (const f of [[-7, 1, 2.4], [5.8, 0.9, 2], [8.2, 1, 1.6]]) pe.poly(mx(rkS, rkT, 0.15), [f[0] - f[1], y, 0, f[0] + f[1], y, 0, f[0], y, f[2]]);
      if (opt.eyes !== false) { const gp = 0.6 + 0.4 * pulse(a); for (const x of [-1.6, 1.6]) { pe.glow('#ffb030', x, y, 5.4, 1.6, 0.5 * gp); pe.ell('#ffd060', x, y, 5.4, 0.55, 0.32); pe.dot('#2a1000', x + 0.1, y, 5.4, 0.16); } }
      // roots and ivy over the lip
      const r = rng(9, 4);
      for (let i = 0; i < 9; i++) { const x = r.range(-9, 8), l = r.range(2, 6); pe.lines(i % 3 ? 'rgba(70,52,34,0.9)' : 'rgba(76,106,40,0.9)', 0.4, [x, y, FH - 0.2, x + r.range(-0.8, 0.8), y, FH - l]); }
      for (let i = 0; i < 40; i++) pe.dot(['#3c5622', '#557a2c', '#7a9c40'][i % 3], r.range(-10, 10), yF - r.range(0.2, 2.2), FH - r.range(0, 0.6), r.range(0.4, 0.95));
      pe.lines('rgba(30,26,22,0.45)', 0.35, [-11, y, 3, -10, y, 7, 10.5, y, 4, 11.2, y, 9, -9.6, y, 14, -8, y, 16]);
    }));
    const front = [
      { x: -17, y: -5, r: 8, h: 14, seed: 111 }, { x: 17, y: -4, r: 7.6, h: 12.5, seed: 112 },
      { x: -24, y: 4, r: 4.6, h: 5.6, seed: 113 }, { x: 25, y: 5, r: 4, h: 4.6, seed: 114 },
      { x: -13, y: 14, r: 2.6, h: 2.6, seed: 115, moss: 0.4 }, { x: 14, y: 17, r: 2.2, h: 2.2, seed: 116, moss: 0.3 },
    ];
    parts.push(rockPart(front, rkS, rkT));
    parts.push(...rockFacets(front, rkT, sh(rkS, -0.32)));
    parts.push(layer((pe) => {
      paintMoss(pe, front, 19);
      paintBones(pe, [[-6, 10, 'bone', 0.4, 1], [-3, 13, 'bone', -0.9, 0.9], [4, 12, 'skull', 0, 1.1], [7, 15, 'bone', 0.2, 1.1], [-9, 16, 'bone', 1.2, 0.8], [1, 17, 'bone', -0.3, 0.9], [-1, 9.5, 'skull', 0, 0.8]], BONE);
    }));
    // a beast's ribcage beside the apron
    const ribs = [];
    for (let i = 0; i < 5; i++) { const x = 17 + i * 2.2, h = 4.4 - Math.abs(i - 1.6) * 0.5; ribs.push([x, 9.5, 0, x + 0.4, 12, h, x + 0.4, 12, h, x + 0.9, 14.6, 0.4]); }
    parts.push(beams(ribs.map((q) => q.slice(0, 6)).concat(ribs.map((q) => q.slice(6, 12))), 0.6, '#b0a68c', BONE));
    parts.push(beams([[15.5, 12, 0.6, 27.5, 12.3, 0.6]], 0.9, '#b0a68c', BONE));
    return { r: 42, h: 32, parts, style: 'prop', bevel: 0.7, spots: { mouth: [0, yF, 5] } };
  };

  /* ============================================================= site_nest
   * Dragon nest ~70: a flat-topped rock outcrop crowned by a huge woven ring of
   * branches, a straw-lined hollow with three large eggs (flat, faintly glowing:
   * crimson, teal, amber), gold coins and bones among the twigs. */
  M.site_nest = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const rkS = mx(p.a, '#76706a', 0.45), rkT = mx(p.s, '#b2aca0', 0.45);
    const twD = '#3e2c1c', tw = '#6a4e32', twL = '#9a7a52';
    const parts = [stain(38, 28, 0.3, '#221a12', 0, 3)];
    const out = [
      { x: 0, y: -2, r: 24, h: 10, seed: 121, n: 16, rough: 0.18, top: 0.66, pw: 4, sx: 1.12, sy: 0.86, moss: 0.4 },
      { x: 15, y: -22, r: 8, h: 8, seed: 122 }, { x: -26, y: 5, r: 7, h: 6, seed: 123 }, { x: 25, y: 9, r: 6, h: 5, seed: 124 },
      { x: -11, y: 19, r: 5, h: 4, seed: 125 }, { x: 8, y: 20, r: 3.4, h: 2.8, seed: 126 },
    ];
    parts.push(rockPart(out, rkS, rkT));
    parts.push(...rockFacets(out, rkT, sh(rkS, -0.32)));
    parts.push(layer((pe) => {
      paintMoss(pe, out.slice(1), 23);
      paintBones(pe, [[-18, 14, 'bone', 0.5, 1.1], [-14, 17, 'rib', 0.3, 1], [16, 16, 'skull', 0, 1.1], [20, 14, 'bone', -0.8, 1], [-2, 20, 'bone', 0.1, 0.9]]);
      // claw scratches on the cliff
      pe.lines('rgba(30,26,22,0.55)', 0.4, [-8, 17.3, 7, -6, 17.3, 3, -6.6, 17.4, 7.2, -4.6, 17.4, 3.2, -5.2, 17.5, 7.4, -3.2, 17.5, 3.4]);
    }));
    // nest: two stroked rings of branches (rounded profile)
    const NX = 0, NY = -3, NR = 13.5;
    const lumpy = (c, R0, ph) => { for (let i = 0; i <= 40; i++) { const t = (i / 40) * TAU, rr = R0 + Math.sin(t * 5 + ph) * 0.8 + Math.sin(t * 11 + ph * 2) * 0.5; const x = NX + Math.cos(t) * rr, y = NY + Math.sin(t) * rr * 0.96; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
    parts.push({ z0: 9.6, z1: 10.6, side: tw, top: '#c8a860', ao: 0.1, bevel: false, shape: (c) => lumpy(c, NR - 1, 0.5) });
    parts.push({ z0: 9.6, z1: 13.2, side: twD, top: tw, stroke: 7.2, ao: 0.3, bevel: false, shape: (c) => lumpy(c, NR, 0) });
    parts.push({ z0: 13.2, z1: 15.6, side: tw, top: twL, stroke: 5, ao: 0.25, bevel: false, shape: (c) => lumpy(c, NR - 0.6, 1.3) });
    parts.push(layer((pe) => {
      const c = pe.c, r = rng(31, 1);
      // straw lining and gold
      for (let i = 0; i < 40; i++) { const a = r.range(0, TAU), d = r.range(0, 9.5); const x = NX + Math.cos(a) * d, y = NY + Math.sin(a) * d; pe.lines(r.next() < 0.5 ? '#e0c070' : '#b08840', 0.35, [x, y, 10.7, x + r.range(-1.4, 1.4), y + r.range(-1, 1), 10.7]); }
      for (let i = 0; i < 16; i++) { const a = r.range(0, TAU), d = r.range(3, 9); pe.ell(r.next() < 0.5 ? '#f2c84a' : '#ffe890', NX + Math.cos(a) * d, NY + Math.sin(a) * d, 10.8, 0.55, 0.38); }
      // twigs woven round the rim, on top and on the outer face
      for (let i = 0; i < 150; i++) {
        const t = r.range(0, TAU), rr = NR + r.range(-3.2, 3.4), z = r.next() < 0.6 ? 15.6 + r.range(-0.4, 0.2) : r.range(10, 14.6);
        const dt = r.range(0.18, 0.45) * (r.next() < 0.5 ? 1 : -1);
        const x0 = NX + Math.cos(t) * rr, y0 = NY + Math.sin(t) * rr, x1 = NX + Math.cos(t + dt) * (rr + r.range(-1, 1)), y1 = NY + Math.sin(t + dt) * (rr + r.range(-1, 1));
        if (z < 15 && Math.sin(t) < 0.15) continue;
        const outer = z < 15 ? NR + 3.6 : rr;
        const xa = z < 15 ? NX + Math.cos(t) * outer : x0, ya = z < 15 ? NY + Math.sin(t) * outer : y0, xb = z < 15 ? NX + Math.cos(t + dt) * outer : x1, yb = z < 15 ? NY + Math.sin(t + dt) * outer : y1;
        pe.lines([twD, tw, twL, '#b89a6a'][Math.floor(r.next() * 4)], r.range(0.3, 0.6), [xa, ya, z, xb, yb, z + r.range(-0.6, 0.6)]);
      }
    }));
    // branches sticking out of the rim
    const br = [];
    for (let i = 0; i < 11; i++) { const t = (i / 11) * TAU + 0.2, r0 = NR + 2, r1 = NR + 6 + (i % 3) * 1.6; br.push([NX + Math.cos(t) * r0, NY + Math.sin(t) * r0, 12 + (i % 2) * 2, NX + Math.cos(t + 0.15) * r1, NY + Math.sin(t + 0.15) * r1, 13.5 + (i % 3) * 1.2]); }
    parts.push(beams(br, 0.65, twD, twL));
    // three eggs
    const eggs = [[-4.4, -5.8, '#a8323a', '#f06a54'], [4.2, -7, '#2a7a80', '#62dcd0'], [0.1, -0.6, '#c88a2a', '#ffd46e']];
    for (const e of eggs) parts.push({ z0: 10.4, z1: 19.6, side: e[2], top: e[3], flat: true, ao: 0.42, bevel: false, shape: (c, zt) => { const s = Math.sin(Math.PI * Math.min(1, zt * 1.08)), rr = 3.7 * Math.pow(Math.max(0.02, s), 0.75) * (1 - 0.18 * zt); S.circ(c, e[0], e[1], Math.max(0.2, rr)); } });
    parts.push(layer((pe) => {
      for (const e of eggs) {
        pe.glow(e[3], e[0], e[1], 14, 7.5, 0.26);
        pe.ell(al('#ffffff', 0.45), e[0] - 1.2, e[1] - 0.5, 17, 1.1, 2, -0.5);
        const r = rng((e[0] * 10) | 0, 2);
        for (let i = 0; i < 11; i++) { const a = r.range(-0.4, Math.PI + 0.4), z = r.range(11.5, 18.5), rr = 3.7 * Math.sin(Math.PI * (z - 10.4) / 9.2) * 0.9; pe.dot(al(mx(e[2], '#000000', 0.4), 0.7), e[0] + Math.cos(a) * rr, e[1] + Math.sin(a) * rr, z, r.range(0.2, 0.4)); }
      }
    }));
    return { r: 40, h: 23, parts, style: 'prop', bevel: 0.7, spots: { eggs: [NX, NY, 13] } };
  };

  /* striped pavilion tent: ten-sided canvas wall, bell cone roof with alternating
   * wedges (painted back to front), door flaps, scalloped valance, pennant */
  function pavilion(x, y, R, Hw, Hr, c1, c2, p) {
    const n = 10, parts = [], RR = R * 1.2, ez = Hw - 0.7;
    const rr = (zt) => Math.max(0.2, RR * Math.pow(1 - zt, 1.15));
    const V = (a, r, z) => [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
    parts.push({ z0: 0, z1: Hw, side: sh(c2, -0.05), top: c2, ao: 0.3, shape: (c) => S.poly(c, ngon(n, R, 0, x, y)) });
    parts.push({ z0: ez, z1: Hw + Hr, side: c1, top: c1, ao: 0.12, bevel: false, shape: (c, zt) => S.poly(c, ngon(n, rr(zt), 0, x, y)) });
    parts.push(layer((pe) => {
      for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; if (Math.sin((a0 + a1) / 2) < -0.05 || i % 2 === 0) continue; pe.poly(c1, [].concat(V(a0, R + 0.02, 0), V(a1, R + 0.02, 0), V(a1, R + 0.02, Hw), V(a0, R + 0.02, Hw))); }
      for (let i = 0; i < n; i++) { const am = ((i + 0.5) / n) * TAU; if (Math.sin(am) < 0) continue; pe.poly('rgba(0,0,0,' + (0.12 * Math.max(0, Math.cos(am))).toFixed(3) + ')', [].concat(V((i / n) * TAU, R + 0.03, 0), V(((i + 1) / n) * TAU, R + 0.03, 0), V(((i + 1) / n) * TAU, R + 0.03, Hw), V((i / n) * TAU, R + 0.03, Hw))); }
      const ya = y + R * Math.cos(Math.PI / n) + 0.05;
      pe.poly('#2a2018', [x - 1.8, ya, 0, x + 1.8, ya, 0, x + 0.7, ya, Hw - 0.4, x - 0.7, ya, Hw - 0.4]);
      pe.poly(sh(c2, -0.12), [x - 1.8, ya + 0.02, 0, x - 2.7, ya + 0.02, 0, x - 0.7, ya + 0.02, Hw - 0.4]);
      pe.poly(sh(c2, -0.2), [x + 1.8, ya + 0.02, 0, x + 2.7, ya + 0.02, 0, x + 0.7, ya + 0.02, Hw - 0.4]);
      const faces = [];
      for (let i = 0; i < n; i++) faces.push({ i, s: Math.sin(((i + 0.5) / n) * TAU), c: Math.cos(((i + 0.5) / n) * TAU) });
      faces.sort((A, B) => A.s - B.s);
      for (const f of faces) {
        const q = [].concat([x, y, Hw + Hr], V((f.i / n) * TAU, RR, ez), V(((f.i + 1) / n) * TAU, RR, ez));
        pe.poly(f.i % 2 ? c2 : c1, q);
        pe.poly(f.c < 0 ? 'rgba(255,250,235,' + (-0.16 * f.c).toFixed(3) + ')' : 'rgba(0,0,0,' + (0.2 * f.c).toFixed(3) + ')', q);
      }
      for (let i = 0; i < 20; i++) { const a = ((i + 0.5) / 20) * TAU; if (Math.sin(a) < -0.2) continue; const v = V(a, RR, ez); pe.c.beginPath(); pe.c.arc(v[0], v[1] - v[2], 0.85, 0, Math.PI); pe.c.fillStyle = i % 2 ? c1 : c2; pe.c.fill(); }
    }));
    parts.push(...flagPole(x, y, Hw + Hr - 0.6, 3.4, p));
    parts.push(layer((pe, a) => paintFlag(pe, x + 0.4, y, Hw + Hr + 2.9, 3.8, 2.1, a, c1, c2, { amp: 0.5 })));
    return parts;
  }

  /* ======================================================= site_tradepost
   * Trade post ~80: two striped pavilions, a canvas tent, a market stall, a rug of
   * pots, crates, barrels, a loaded cart and a central banner (pal.k). */
  M.site_tradepost = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const parts = [stain(46, 32, 0.2, '#2a2216', 0, 2)];
    parts.push(layer((pe) => {
      const c = pe.c, g = c.createRadialGradient(0, 2, 2, 0, 2, 40);
      g.addColorStop(0, 'rgba(140,110,70,0.24)'); g.addColorStop(0.7, 'rgba(140,110,70,0.14)'); g.addColorStop(1, 'rgba(140,110,70,0)');
      c.save(); c.scale(1, 0.72); c.fillStyle = g; c.beginPath(); c.arc(0, 2 / 0.72, 40, 0, TAU); c.fill(); c.restore();
      // rug with pots
      pe.poly('#8a2a2a', [14, 4, 0.05, 25, 4, 0.05, 25, 11, 0.05, 14, 11, 0.05]);
      pe.poly('#d8a840', [15, 5, 0.06, 24, 5, 0.06, 24, 10, 0.06, 15, 10, 0.06]);
      pe.poly('#2a4a7a', [16, 6, 0.07, 23, 6, 0.07, 23, 9, 0.07, 16, 9, 0.07]);
      for (let i = 0; i < 7; i++) pe.dot('#d8a840', 16.5 + i, 7.5, 0.08, 0.3);
    }));
    parts.push({ z0: 0, z1: 2.6, side: '#8a4a2a', top: '#c07a4a', ao: 0.3, shape: (c, zt) => { const k = 0.8 + 0.25 * Math.sin(Math.PI * zt); for (const q of [[16, 6.4, 1.2], [19, 5.8, 0.9], [21.6, 6.6, 1.3], [17.6, 8.8, 0.8], [23, 9, 0.9]]) S.circ(c, q[0], q[1], q[2] * k); },
      detail: (c) => { for (const q of [[16, 6.4, 1.2], [19, 5.8, 0.9], [21.6, 6.6, 1.3], [17.6, 8.8, 0.8], [23, 9, 0.9]]) S.dot(c, '#3a1e10', q[0], q[1], q[2] * 0.5); } });
    parts.push(...pavilion(-19, -15, 8.5, 5, 9.5, '#b8342a', '#efe4c8', p));
    parts.push(...pavilion(17, -17, 10, 5.5, 11, '#2f62a0', '#f0d888', p));
    parts.push(...flagPole(0, -4, 0, 21, p));
    parts.push(layer((pe, a) => paintFlag(pe, 0.45, -4, 21.2, 7, 4.4, a, p.k, p.k2)));
    if (M.prop_signpost) parts.push(...embed(M.prop_signpost(pal, {}), 37, -3, 0));
    if (M.prop_tent) parts.push(...embed(M.prop_tent(pal, { col: '#dfe6cc', trim: '#3e7a3a' }), -35, 4, 0));
    if (M.prop_stall) parts.push(...embed(M.prop_stall(pal, { v: 2 }), -9, 6, 0));
    if (M.prop_cart) parts.push(...embed(M.prop_cart(pal, {}), 29, 17, 0, -0.45));
    if (M.prop_crates) parts.push(...embed(M.prop_crates(pal, {}), -24, 17, 0));
    if (M.prop_barrels) parts.push(...embed(M.prop_barrels(pal, {}), -16, 21, 0));
    return { r: 46, h: 30, parts, style: 'prop', bevel: 0.7, spots: { flag: [0, -4, 21] } };
  };

  /* ======================================================== site_oldwatch
   * Old wooden watchtower on stilts ~16 base, 56 tall: four leaning log legs with
   * X bracing, a plank platform with a broken railing, a pyramid roof of grey
   * thatch with a hole, a ladder and a tattered pennant (pal.k). */
  M.site_oldwatch = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const wd = mx(mx(p.w, '#8a6a48', 0.4), '#8a8478', 0.25), wdD = sh(wd, -0.38), wdT = sh(wd, 0.3);
    const PZ = 40, B = 7.4, T = 5.4;
    const leg = (sx, sy, z) => { const t = z / (PZ + 1); return [sx * lerp(B, T, t), sy * lerp(B, T, t), z]; };
    const X = (a, b) => [a[0], a[1], a[2], b[0], b[1], b[2]];
    const parts = [stain(14, 10, 0.3, '#2a2216', 0, 1)];
    parts.push(layer((pe) => { const r = rng(4, 4); for (let i = 0; i < 30; i++) { const x = r.range(-10, 10), y = r.range(-8, 10), s = []; for (let k = 0; k < 3; k++) s.push(x + k * 0.4, y, 0, x + k * 0.4 + r.range(-0.5, 0.5), y, r.range(1, 2.2)); pe.lines(r.next() < 0.5 ? '#536e2a' : '#8aa848', 0.3, s); } }));
    const back = [], front = [];
    for (const [z0, z1] of [[3, 20], [21, 38]]) {
      back.push(X(leg(-1, -1, z0), leg(1, -1, z1)), X(leg(1, -1, z0), leg(-1, -1, z1)));
      back.push(X(leg(-1, -1, z0), leg(-1, 1, z1)), X(leg(-1, 1, z0), leg(-1, -1, z1)), X(leg(1, -1, z0), leg(1, 1, z1)), X(leg(1, 1, z0), leg(1, -1, z1)));
      front.push(X(leg(-1, 1, z0), leg(1, 1, z1)), X(leg(1, 1, z0), leg(-1, 1, z1)));
    }
    for (const z of [20.5, 38]) { back.push(X(leg(-1, -1, z), leg(1, -1, z)), X(leg(-1, -1, z), leg(-1, 1, z)), X(leg(1, -1, z), leg(1, 1, z))); front.push(X(leg(-1, 1, z), leg(1, 1, z))); }
    parts.push(beams(back, 0.7, wdD, wd));
    parts.push(beams([X(leg(-1, -1, 0), leg(-1, -1, PZ + 0.5)), X(leg(1, -1, 0), leg(1, -1, PZ + 0.5)), X(leg(-1, 1, 0), leg(-1, 1, PZ + 0.5)), X(leg(1, 1, 0), leg(1, 1, PZ + 0.5))], 1.7, wdD, wdT, { ao: 0.4 }));
    parts.push(beams(front, 0.7, wdD, wd));
    // platform, broken railing, roof posts, roof
    parts.push(box(0, 0, 14.6, 14.6, PZ, PZ + 1.3, wdD, wdT, { ao: 0.2, detail: (c) => { const s = []; for (let x = -6; x <= 6; x += 1.5) s.push(x, -7.3, x, 7.3); S.lines(c, 'rgba(40,30,20,0.45)', 0.25, s); } }));
    parts.push({ z0: PZ + 1.3, z1: PZ + 4.6, side: wd, top: wdT, ao: 0.25, shape: (c, zt) => {
      const z = PZ + 1.3 + zt * 3.3, e = 7, th = 0.7;
      c.rect(-e, -e, 2 * e, th); c.rect(-e, -e, th, 2 * e); c.rect(e - th, -e, th, 2 * e);
      c.rect(-e, e - th, 4.6, th); if (z < PZ + 3.2) c.rect(-1.4, e - th, 2.2, th); c.rect(2.6, e - th, 4.4, th);
    } });
    parts.push(layer((pe) => { const y = 7.02, s = []; for (let x = -6.6; x < 7; x += 1.1) { if (x > -2.4 && x < 2.6 && !(x > -1.4 && x < 0.8)) continue; s.push(x, y, PZ + 1.3, x, y, x > -1.4 && x < 0.8 ? PZ + 3.2 : PZ + 4.6); } pe.lines('rgba(40,30,20,0.5)', 0.25, s); pe.wall('rgba(40,30,20,0.35)', -7.3, 7.3, 7.32, PZ, PZ + 0.4); }));
    parts.push(beams([[-6.3, -6.3, PZ + 1.3, -6.3, -6.3, PZ + 9.2], [6.3, -6.3, PZ + 1.3, 6.3, -6.3, PZ + 9.2], [-6.3, 6.3, PZ + 1.3, -6.3, 6.3, PZ + 9.2], [6.3, 6.3, PZ + 1.3, 6.3, 6.3, PZ + 9.2]], 0.8, wdD, wd));
    const thatch = mx(p.t, '#8e8670', 0.5);
    const R = roof({ x: 0, y: 0, L: 8.8, W: 8.8, Lr: 0, z: PZ + 9.2, H: 7.2, fascia: 0.8, cols: { N: sh(thatch, 0.22), W: sh(thatch, 0.12), S: sh(thatch, -0.04), E: sh(thatch, -0.26) } });
    parts.push(...R.parts);
    parts.push(layer((pe) => {
      paintThatch(pe, R, 7, { col: thatch, n: 50 });
      // a hole torn in the south slope, rafters showing
      const z = PZ + 9.2 + 2.4, yy = 8.8 * (1 - 2.4 / 7.2);
      pe.poly('#2a2218', [1.2, yy + 0.8, z - 0.8, 4.6, yy + 0.6, z - 0.6, 4, yy - 1.4, z + 1.4, 1.8, yy - 1.6, z + 1.6]);
      pe.lines(wdD, 0.45, [2, yy + 1, z - 1, 2.2, yy - 1.8, z + 1.8, 3.6, yy + 1, z - 1, 3.4, yy - 1.8, z + 1.8]);
    }));
    parts.push(...flagPole(0, 0, PZ + 15.8, 4.4, p));
    parts.push(layer((pe, a) => paintFlag(pe, 0.4, 0, PZ + 20, 5.2, 2.6, a, p.k, p.k2, { droop: 0.4 })));
    // ladder on the south face
    const L0 = [[-1.3, 10.6, 0], [-1.2, 7.7, PZ + 1.8]], L1 = [[1.3, 10.6, 0], [1.2, 7.7, PZ + 1.8]];
    parts.push(beams([L0[0].concat(L0[1]), L1[0].concat(L1[1])], 0.45, wdD, wd));
    parts.push(layer((pe) => { const s = []; for (let z = 1.6; z < PZ + 1; z += 1.8) { const t = z / (PZ + 1.8), y = lerp(10.6, 7.7, t) + 0.25; s.push(-1.25, y, z, 1.25, y, z); } pe.lines(wdD, 0.35, s); }));
    return { r: 15, h: PZ + 24, parts, style: 'prop', bevel: 0.7, spots: { lookout: [0, 0, PZ + 3] } };
  };

  /* =========================================================== site_castle
   * Ruined old castle ~160: crenellated curtain walls with breaches, four corner
   * towers (an intact one with merlons and a banner in pal.k, broken ones, a stump),
   * a roofless keep shell with window holes and a collapsed corner, a twin-towered
   * gatehouse with a half-raised portcullis, rubble, bushes and a dead tree. */
  M.site_castle = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const stS = mx(p.a, '#8c887e', 0.35), stT = mx(p.s, '#c8c2b4', 0.35), stD = mx(p.a, '#5a5650', 0.4);
    const X = 66, Y = 52;
    const parts = [stain(90, 72, 0.18, '#2a2216', 0, 0)];
    parts.push(layer((pe) => {
      const c = pe.c, g = c.createRadialGradient(0, 4, 6, 0, 4, 60);
      g.addColorStop(0, 'rgba(110,96,62,0.2)'); g.addColorStop(0.7, 'rgba(110,96,62,0.12)'); g.addColorStop(1, 'rgba(110,96,62,0)');
      c.save(); c.scale(1, 0.8); c.fillStyle = g; c.beginPath(); c.arc(0, 5, 60, 0, TAU); c.fill(); c.restore();
      pe.poly('rgba(110,90,58,0.16)', [-4, Y, 0, 4, Y, 0, 3, -6, 0, -3, -6, 0]);
    }));
    // ruined tower: a hollow shell whose wall pieces break off at their own heights (breach toward nx, ny)
    const ragTower = (x, y, r, h, cut, nx, ny) => {
      const run = []; for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU; run.push([x + Math.cos(a) * (r - 1.3), y + Math.sin(a) * (r - 1.3)]); }
      const segs = wallRun(run, (x * 7 + y) | 0, { H: h, gap: 0, low: 0, seg: 3.6, noCren: true });
      for (const q of segs) { const mx_ = (q.x0 + q.x1) / 2 - x, my_ = (q.y0 + q.y1) / 2 - y, f = (mx_ * nx + my_ * ny) / r; q.h = Math.max(1.5, h - cut * U.clamp(0.5 + f * 0.9, 0, 1) - 2.5 * U.hash2(q.s0 | 0, 3, 7)); }
      return [{ z0: 0, z1: 0.8, side: stD, top: mx(stD, '#6a6050', 0.5), ao: 0.2, bevel: false, shape: (c) => S.circ(c, x, y, r - 2) }, wallPart(segs, 2.6, stS, stT)];
    };
    const towerPaint = (pe, x, y, r, h, slits) => {
      const c = pe.c;
      for (let z = 1.8; z < h - 1; z += 1.8) { c.beginPath(); c.arc(x, y - z, r - z * 0.025 + 0.02, 0.25, Math.PI - 0.25); c.strokeStyle = 'rgba(40,34,28,0.28)'; c.lineWidth = 0.3; c.stroke(); }
      for (const q of slits) archRect(pe, '#1e1812', x + q[0] - 0.6, x + q[0] + 0.6, y + Math.sqrt(Math.max(0, r * r - q[0] * q[0])) + 0.02, q[1], q[1] + 3.2, true);
    };
    // north curtain
    const north = wallRun([[-X + 9, -Y], [X - 9, -Y]], 5, { H: 16, gap: 0.1, low: 0.3, seg: 7 });
    parts.push(wallPart(north, 6, stS, stT, { out: -1, mh: 2.6, ml: 2.6, mg: 2 }));
    parts.push(layer((pe) => paintWallFaces(pe, north, 6, 9, { slits: true, row: 1.8 })));
    // NW tower: intact with merlons and the banner
    const TR = 11, TH = 30;
    parts.push(cyl(-X, -Y, TR, 0, TH, stS, stT, { ao: 0.32 }));
    const ringRun = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * TAU; ringRun.push([-X + Math.cos(a) * (TR - 0.8), -Y + Math.sin(a) * (TR - 0.8)]); }
    parts.push(wallPart(wallRun(ringRun, 2, { hs: [TH], H: TH, seg: 3.4 }), 1.6, stS, stT, { out: -1, mh: 2.6, ml: 2.2, mg: 1.6 }));
    parts.push(layer((pe) => { towerPaint(pe, -X, -Y, TR, TH, [[-4, 9], [3, 17], [-1, 24]]); const r = rng(3, 3); for (let i = 0; i < 5; i++) clump(pe, -X + r.range(-8, 8), -Y + 9 + r.range(0, 2), r.range(0.5, 5), 1.5, r); }));
    parts.push(...flagPole(-X - 2, -Y - 2, TH, 9, p));
    parts.push(layer((pe, a) => paintFlag(pe, -X - 1.55, -Y - 2, TH + 8.8, 9, 5.6, a, p.k, p.k2, { droop: 0.3 })));
    // NE tower, broken
    parts.push(...ragTower(X, -Y, 10, 21, 12, -0.7, 0.7));
    parts.push(layer((pe) => towerPaint(pe, X, -Y, 10, 8, [[-3, 4]])));
    // keep shell
    const keep = wallRun([[-22, -36], [22, -36], [22, -8], [-22, -8], [-22, -36]], 41, { H: 34, gap: 0, low: 0, seg: 5.5, noCren: true });
    for (const q of keep) {
      const cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2, hh = U.hash2(cx | 0, cy | 0, 3);
      if (cy < -35) q.h = 30 + 5 * hh;
      else if (cy > -9) q.h = cx > 9 ? 8 + 5 * hh : 21 + 5 * hh;
      else if (cx > 21) q.h = cy > -18 ? 10 + 5 * hh : 23 + 6 * hh;
      else q.h = 25 + 7 * hh;
    }
    parts.push({ z0: 0, z1: 0.6, side: stD, top: mx(stD, '#6a6050', 0.5), ao: 0.2, bevel: false, shape: (c) => c.rect(-20, -34, 40, 24) });
    parts.push(rockPart([{ x: 14, y: -14, r: 5, h: 3.4, seed: 7, n: 9, rough: 0.45 }, { x: 8, y: -22, r: 4, h: 2.4, seed: 8, n: 8, rough: 0.45 }], stS, stT));
    parts.push(wallPart(keep, 4, stS, stT));
    parts.push({ z0: 0, z1: 36, side: stS, top: stT, ao: 0.32, shape: (c, zt) => { const z = zt * 36; for (const q of [[-22, -36, 36], [22, -36, 34], [-22, -8, 29], [22, -8, 12]]) { if (z > q[2]) continue; let pts = [q[0] - 3.2, q[1] - 3.2, q[0] + 3.2, q[1] - 3.2, q[0] + 3.2, q[1] + 3.2, q[0] - 3.2, q[1] + 3.2]; if (z > q[2] - 3) pts = clipHalf(pts, -0.7, 0.7, (z - (q[2] - 3)) * 1.8 - 4.5 - 0.7 * q[0] + 0.7 * q[1]); polyOK(c, pts); } } });
    parts.push(layer((pe) => {
      // inner face of the north wall (seen over the lower south wall) and the south face
      for (const q of keep) {
        if (Math.abs(q.y1 - q.y0) > 0.5) continue;
        const x0 = Math.min(q.x0, q.x1), x1 = Math.max(q.x0, q.x1), xm = (x0 + x1) / 2;
        if (q.y0 < -30) { stones(pe, x0, x1, -33.98, 14, q.h - 3, (x0 | 0) + 11, { row: 1.8, w: 1.4, joint: 'rgba(40,34,28,0.28)' }); pe.wall('rgba(20,16,12,0.32)', x0, x1, -33.97, 14, q.h - 3); for (const z of [16, 24]) if (q.h > z + 6 && Math.abs(xm) < 18) archRect(pe, '#1a140e', xm - 1.1, xm + 1.1, -33.96, z, z + 4, true); }
        else { const y = -5.98, top = q.h - 3; if (top > 0.5) stones(pe, x0, x1, y, 0, top, (x0 | 0) + 17, { row: 1.8, w: 1.4, joint: 'rgba(40,34,28,0.3)' }); for (const z of [5, 14]) if (top > z + 5) archRect(pe, '#1a140e', xm - 1.1, xm + 1.1, y + 0.01, z, z + 4.2, true); }
      }
      const r = rng(9, 9);
      for (let i = 0; i < 6; i++) clump(pe, r.range(-22, 22), -6 + r.range(0, 1.5), r.range(0.4, 4), 1.4, r);
    }));
    // west and east curtains
    const west = wallRun([[-X, -Y + 10], [-X, Y - 9]], 13, { H: 15, gap: 0.12, low: 0.35, seg: 7 });
    const east = wallRun([[X, -Y + 9], [X, Y - 10]], 17, { H: 15, gap: 0.15, low: 0.45, seg: 7 });
    parts.push(wallPart(west, 6, stS, stT, { out: 1, mh: 2.6, ml: 2.6, mg: 2 }));
    parts.push(wallPart(east, 6, stS, stT, { out: -1, mh: 2.6, ml: 2.6, mg: 2 }));
    parts.push(layer((pe) => { for (const q of west) if (q.cren) pe.poly(al(stT, 0.9), [-X + 0.5, q.y0, q.h, -X + 3, q.y0, q.h, -X + 3, q.y1, q.h, -X + 0.5, q.y1, q.h]); for (const q of east) if (q.cren) pe.poly(al(stT, 0.9), [X - 3, q.y0, q.h, X - 0.5, q.y0, q.h, X - 0.5, q.y1, q.h, X - 3, q.y1, q.h]); }));
    // courtyard: rubble, bushes, a dead tree
    const rub = [{ x: -X + 3, y: 6, r: 5, h: 3, seed: 21, n: 9, rough: 0.45 }, { x: X - 3, y: -10, r: 5.4, h: 3.2, seed: 22, n: 9, rough: 0.45 }, { x: X - 2, y: 20, r: 4.6, h: 2.8, seed: 23, n: 8, rough: 0.45 }, { x: 30, y: 18, r: 3, h: 2, seed: 24, n: 7, rough: 0.4 }, { x: -34, y: 30, r: 3.4, h: 2.4, seed: 25, n: 7, rough: 0.4 }, { x: 0, y: -50, r: 4, h: 2.4, seed: 26, n: 8, rough: 0.45 }];
    for (const q of west.concat(east)) if (q.h < 3) rub.push({ x: (q.x0 + q.x1) / 2 + (q.x0 < 0 ? 3 : -3), y: (q.y0 + q.y1) / 2, r: 3.6, h: 2.4, seed: (q.y0 | 0) + 120, n: 7, rough: 0.45 });
    parts.push(rockPart(rub, stS, stT, { ao: 0.4 }));
    const bushes = [{ x: -40, y: 14, r: 5, h: 5.4, seed: 31 }, { x: 44, y: 34, r: 4.4, h: 4.6, seed: 32 }, { x: -50, y: -30, r: 4.4, h: 5, seed: 33 }, { x: 34, y: -6, r: 3.6, h: 4, seed: 34 }];
    parts.push(rockPart(bushes, '#3a5a22', '#5a7e30', { ao: 0.45 }));
    parts.push(layer((pe) => { paintMoss(pe, rub, 13, { cracks: false }); paintMoss(pe, bushes.map((b) => Object.assign({}, b, { moss: 2.6 })), 17, { cracks: false, size: 1.5 }); }));
    parts.push(beams([[24, 26, 0, 25, 25.5, 9], [25, 25.5, 7, 21, 24, 12], [25, 25.5, 8, 29, 26, 13], [24.6, 25.6, 5, 28, 27, 8], [21, 24, 12, 19, 22.5, 13.4], [29, 26, 13, 30.4, 24, 14.6]], 0.8, '#3a3430', '#6a625a'));
    // south curtain with the gatehouse
    const sw = wallRun([[-X + 9, Y], [-14, Y]], 29, { H: 14, gap: 0.2, low: 0.5, seg: 7 });
    const se = wallRun([[14, Y], [X - 9, Y]], 31, { H: 14, gap: 0.2, low: 0.5, seg: 7 });
    parts.push(wallPart(sw.concat(se), 6, stS, stT, { out: 1, mh: 2.6, ml: 2.6, mg: 2 }));
    parts.push(layer((pe) => paintWallFaces(pe, sw.concat(se), 6, 33, { row: 1.8 })));
    parts.push(...ragTower(-X, Y, 9, 10, 7, 0.6, -0.8));
    parts.push(...ragTower(X, Y, 10, 24, 14, -0.8, -0.6));
    parts.push(layer((pe) => { towerPaint(pe, -X, Y, 9, 3, []); towerPaint(pe, X, Y, 10, 9, [[-4, 5]]); }));
    parts.push(cyl(-11, Y, 7.6, 0, 21, stS, stT, { ao: 0.32 }));
    { const rr = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU; rr.push([-11 + Math.cos(a) * 6.9, Y + Math.sin(a) * 6.9]); } parts.push(wallPart(wallRun(rr, 4, { hs: [21], H: 21, seg: 3.1 }), 1.4, stS, stT, { out: -1, mh: 2.2, ml: 1.8, mg: 1.4 })); }
    parts.push(...ragTower(11, Y, 7.6, 15, 9, -0.7, -0.7));
    parts.push(xzPart([...ringQuads(0, 8.5, 4.6, 7, 8, 0, Math.PI), [-7.5, 13, 7.5, 13, 7.5, 18.4, -7.5, 18.4]], 0, 18.4, stS, stT, { oy: Y, v0: -4.2, v1: 4.2 }, { ao: 0.3 }));
    parts.push(layer((pe) => {
      towerPaint(pe, -11, Y, 7.6, 20, [[-2, 8], [1, 14]]); towerPaint(pe, 11, Y, 7.6, 5, []);
      const y = Y + 4.22, s = [];
      for (let i = 1; i < 8; i++) { const a = (i / 8) * Math.PI; s.push(Math.cos(a) * 4.6, y, 8.5 + Math.sin(a) * 4.6, Math.cos(a) * 7, y, 8.5 + Math.sin(a) * 7); }
      pe.lines('rgba(40,34,28,0.42)', 0.3, s);
      // half-raised portcullis inside the arch
      const g = [];
      for (let x = -3.8; x <= 3.9; x += 1.25) g.push(x, Y + 3.4, 7.2, x, Y + 3.4, 8.5 + Math.sqrt(Math.max(0, 21 - x * x)) - 0.6);
      for (let z = 7.8; z < 13; z += 1.4) { const w = z > 8.5 ? Math.sqrt(Math.max(0, 21 - (z - 8.5) * (z - 8.5))) : 4.6; g.push(-w, Y + 3.4, z, w, Y + 3.4, z); }
      pe.lines('#2a2826', 0.42, g);
      for (let x = -3.8; x <= 3.9; x += 1.25) pe.poly('#3a3836', [x - 0.3, Y + 3.4, 7.2, x + 0.3, Y + 3.4, 7.2, x, Y + 3.4, 6.2]);
    }));
    return { r: 96, h: 42, parts, style: 'prop', bevel: 0.7, spots: { flag: [-X - 2, -Y - 2, TH + 9], gate: [0, Y + 4, 0], keep: [0, -22, 0] } };
  };

  /* ========================================================== site_crystal
   * Mana crystal cluster ~40: tall faceted violet-to-cyan crystals (flat glow) bursting
   * from cracked dark rock that leaks light, floating shards. anims 4 (pulse). */
  M.site_crystal = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const C1 = opt.glow || '#9a62ff', C2 = opt.glow2 || '#62e2ff', CH = '#effcff';
    const mid = mx(C1, C2, 0.32), lit = mx(C2, '#ffffff', 0.4), dark = mx(C1, '#22104a', 0.45);
    const rkS = mx(p.a, '#4e4a5a', 0.55), rkT = mx(p.s, '#8a869a', 0.5);
    const parts = [stain(22, 16, 0.3, '#1a1426', 0, 2)];
    parts.push(layer((pe, a) => { const c = pe.c, g = c.createRadialGradient(0, 0, 0, 0, 0, 24); g.addColorStop(0, al(C1, 0.22 + 0.12 * pulse(a))); g.addColorStop(0.55, al(C2, 0.08 + 0.05 * pulse(a))); g.addColorStop(1, al(C2, 0)); c.save(); c.scale(1, 0.74); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); c.restore(); }));
    const rocks = [
      { x: -2, y: -3, r: 11, h: 6, seed: 151, n: 12 }, { x: 9, y: 2, r: 7, h: 5, seed: 152 }, { x: -10, y: 4, r: 6.5, h: 4.4, seed: 153 },
      { x: 2, y: 9, r: 5.5, h: 3.2, seed: 154 }, { x: -14, y: -6, r: 4, h: 3, seed: 155 }, { x: 15, y: -5, r: 3.6, h: 2.6, seed: 156 },
    ];
    parts.push(rockPart(rocks, rkS, rkT));
    parts.push(...rockFacets(rocks, rkT, sh(rkS, -0.35)));
    parts.push(layer((pe, a) => { const gp = pulse(a); pe.lines(al(C2, 0.5 + 0.4 * gp), 0.5, [-8, 7.5, 1, -5, 7.5, 3.4, -5, 7.5, 3.4, -6, 7.5, 5, 6, 8.4, 0.8, 8, 8.4, 3.6, 2, 13.2, 0.5, 3, 13.2, 2.4]); for (const q of [[-6.5, 7.5, 3], [7, 8.4, 2.2]]) pe.glow(C2, q[0], q[1], q[2], 2.6, 0.35 * gp + 0.15); }));
    const cr = [
      { x: 0, y: -2, a: -1.6, H: 38, R: 5.2, lean: 0.05, rot: 0.3 },
      { x: -5, y: -6, a: -2.3, H: 26, R: 3.6, lean: 0.3, rot: 0.9 }, { x: 5, y: -5, a: -0.8, H: 23, R: 3.4, lean: 0.34, rot: 0.1 },
      { x: -6.5, y: 1, a: 2.9, H: 19, R: 3.2, lean: 0.4, rot: 0.5 }, { x: 6.5, y: 0, a: 0.15, H: 17, R: 3, lean: 0.42, rot: 1.2 },
      { x: -2.5, y: 4.5, a: 1.9, H: 13, R: 2.6, lean: 0.45, rot: 0.7 }, { x: 3.5, y: 5, a: 1.2, H: 11, R: 2.4, lean: 0.5, rot: 0.2 },
      { x: 12, y: 5, a: 0.6, H: 8, R: 1.8, lean: 0.4, rot: 0.4 }, { x: -12, y: -1, a: 3.3, H: 9, R: 2, lean: 0.4, rot: 0.8 },
    ];
    const sect = (k, z) => { const zt = (z - 2) / (k.H - 2), q = zt < 0.74 ? 1 - 0.1 * zt : Math.max(0.02, (1 - zt) / 0.26) * 0.92; return ngon(6, k.R * q, k.rot, k.x + Math.cos(k.a) * k.lean * (z - 2), k.y + Math.sin(k.a) * k.lean * (z - 2)); };
    const crystals = (side, top, test, ao) => ({ z0: 2, z1: 38, side, top, flat: true, ao, bevel: false, shape: (c, zt) => { const z = 2 + zt * 36; for (const k of cr) { if (z > k.H) continue; const pts = sect(k, z); if (test) slivers(c, pts, test, Math.min(1.3, k.R * 0.42)); else S.poly(c, pts); } } });
    parts.push(crystals(mid, CH, null, 0.38));
    parts.push(crystals(lit, CH, (sx, sy) => sx < -0.28 && sy > -0.4, 0.15));
    parts.push(crystals(dark, dark, (sx, sy) => sx > 0.3 && sy > -0.4, 0.2));
    parts.push(layer((pe, a) => {
      const c = pe.c, gp = pulse(a);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < cr.length; i++) {
        const k = cr[i], pp = pulse(a, i * 0.13), zm = 2 + (k.H - 2) * 0.45;
        const cx = k.x + Math.cos(k.a) * k.lean * (zm - 2), cy = k.y + Math.sin(k.a) * k.lean * (zm - 2) + k.R * 0.55;
        pe.glow(C2, cx, cy, zm, k.R * 1.6, 0.18 + 0.22 * pp);
        const t0 = [k.x + Math.cos(k.a) * k.lean * 1, k.y + Math.sin(k.a) * k.lean * 1 + k.R * 0.5, 3], z1 = 2 + (k.H - 2) * 0.72, t1 = [k.x + Math.cos(k.a) * k.lean * (z1 - 2), k.y + Math.sin(k.a) * k.lean * (z1 - 2) + k.R * 0.5, z1];
        pe.lines(al(CH, 0.2 + 0.3 * pp), Math.max(0.4, k.R * 0.22), t0.concat(t1));
      }
      c.restore();
      // floating shards and sparkles
      for (let i = 0; i < 4; i++) { const th = i * 1.7 + 0.5, rr = 13 + (i % 2) * 3, z = 12 + i * 4 + Math.sin((a + i * 0.25) * TAU) * 1.4, x = Math.cos(th) * rr, y = Math.sin(th) * rr * 0.6; pe.poly(mid, [x, y, z + 1.6, x + 0.8, y, z, x, y, z - 1.6, x - 0.8, y, z]); pe.poly(lit, [x, y + 0.01, z + 1.6, x - 0.8, y + 0.01, z, x, y + 0.01, z - 0.4]); pe.glow(C2, x, y, z, 2.4, 0.2 + 0.2 * gp); }
      for (let i = 0; i < 8; i++) { const ph = (a + i / 8) % 1, th = i * 2.2; pe.dot(al(i % 2 ? C2 : CH, 0.9 * Math.sin(ph * Math.PI)), Math.cos(th) * (4 + i % 4 * 2), Math.sin(th) * 3, 6 + ph * 30, 0.35); }
    }));
    return { r: 24, h: 46, parts, style: 'prop', bevel: 0.6, spots: { glow: [0, -2, 20] } };
  };

  /* ============================================================ site_relic
   * Relic altar ~40: a three-tier round marble dais with gold inlay and runes, four
   * gold-capped pillars with flame orbs, a carved pedestal and, above it, a floating
   * golden orb-relic with a turning ring, star spikes and light rays (anims 4). */
  M.site_relic = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const GOLD = '#e8b84a', GD = '#9a6a1c', GH = '#fff2b0', GL = opt.glow || '#ffe08a';
    const stS = mx(p.s, '#b2ac9e', 0.5), stT = mx(p.b, '#eee8da', 0.55), stD = mx(p.a, '#7a7468', 0.4);
    const parts = [stain(22, 16, 0.24, '#2a2216', 0, 2)];
    parts.push(layer((pe, a) => { const c = pe.c, g = c.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, al(GL, 0.2 + 0.1 * pulse(a))); g.addColorStop(1, al(GL, 0)); c.save(); c.scale(1, 0.75); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill(); c.restore(); }));
    const tier = (r, z0, z1, k) => ({ z0, z1, side: k ? stD : stS, top: stT, ao: 0.3, shape: (c) => S.poly(c, ngon(16, r, 0.1)),
      detail: (c, a) => { c.beginPath(); c.arc(0, 0, r - 0.9, 0, TAU); c.strokeStyle = al(GOLD, 0.85); c.lineWidth = 0.32; c.stroke(); for (let i = 0; i < 16; i++) { const t = (i / 16) * TAU + 0.1; S.lines(c, 'rgba(90,80,64,0.35)', 0.25, [Math.cos(t) * (r - 0.3), Math.sin(t) * (r - 0.3), Math.cos(t) * (r - 2.2), Math.sin(t) * (r - 2.2)]); } } });
    parts.push(tier(18, 0, 1.3, 1), tier(14, 1.3, 2.6), tier(10, 2.6, 3.9));
    parts.push(layer((pe, a) => { const ap = 0.5 + 0.5 * pulse(a); for (let i = 0; i < 10; i++) { const t = (i / 10) * TAU + 0.3; rune(pe, Math.cos(t) * 12 - 0.3, Math.sin(t) * 12 * 0.98, 2.62, 1.2, GL, i, ap); } }));
    const pil = [[-8.4, -8.4], [8.4, -8.4], [-8.4, 8.4], [8.4, 8.4]];
    parts.push({ z0: 2.6, z1: 9.6, side: stS, top: stT, ao: 0.3, shape: (c) => { for (const q of pil) c.rect(q[0] - 1.1, q[1] - 1.1, 2.2, 2.2); } });
    parts.push({ z0: 9.6, z1: 11, side: GD, top: GH, ao: 0.1, bevel: false, shape: (c, zt) => { for (const q of pil) S.poly(c, ngon(4, 1.7 * (1 - zt * 0.75), Math.PI / 4, q[0], q[1])); } });
    parts.push({ z0: 11, z1: 12.6, side: '#ffb040', top: '#fff0b0', flat: true, ao: -0.2, bevel: false, shape: (c, zt, a) => { for (let i = 0; i < 4; i++) { const q = pil[i], s = 0.75 * Math.sin(Math.PI * zt) * (0.85 + 0.25 * pulse(a, i * 0.25)); S.circ(c, q[0], q[1], Math.max(0.1, s)); } } });
    // pedestal
    parts.push(box(0, 0, 5, 5, 3.9, 4.9, stD, stT, { ao: 0.2 }));
    parts.push(cyl(0, 0, 1.7, 4.9, 8.4, stS, stT, { ao: 0.3 }));
    parts.push({ z0: 8.4, z1: 9.4, side: GD, top: '#6a4a24', ao: 0.1, shape: (c, zt) => S.circ(c, 0, 0, 2 + zt * 1) });
    parts.push(layer((pe, a) => {
      const c = pe.c, gp = pulse(a), zc = 15.5 + Math.sin(a * TAU) * 1;
      for (const q of pil) pe.glow('#ffc860', q[0], q[1], 11.8, 2.6, 0.45);
      pe.lines(al(GOLD, 0.8), 0.3, [-1.6, 1.72, 6, 1.6, 1.72, 6]);
      // rays behind the relic
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) { const t = (i / 12) * TAU + a * TAU / 12, L = i % 2 ? 9 : 13; c.beginPath(); c.moveTo(0, -zc); c.lineTo(Math.cos(t - 0.08) * L, -zc + Math.sin(t - 0.08) * L); c.lineTo(Math.cos(t + 0.08) * L, -zc + Math.sin(t + 0.08) * L); c.closePath(); c.fillStyle = al(GL, 0.1 + 0.07 * gp); c.fill(); }
      c.restore();
      pe.glow(GL, 0, 0, zc, 7 + 2 * gp, 0.35 + 0.2 * gp);
      // back half of the turning ring
      const th = a * Math.PI, rx = Math.abs(Math.cos(th)) * 4.8 + 0.5;
      c.beginPath(); c.ellipse(0, -zc, rx, 4.8, 0, Math.PI, TAU); c.strokeStyle = GD; c.lineWidth = 0.75; c.stroke();
    }));
    parts.push({ z0: 11.6, z1: 19.4, side: GD, top: GH, ao: 0.25, bevel: false, shape: (c, zt, a) => { const z = 11.6 + zt * 7.8, zc = 15.5 + Math.sin(a * TAU) * 1, d = z - zc; if (Math.abs(d) > 2.7) return; S.circ(c, 0, 0, Math.max(0.2, Math.sqrt(7.29 - d * d))); } });
    parts.push(layer((pe, a) => {
      const c = pe.c, zc = 15.5 + Math.sin(a * TAU) * 1, th = a * Math.PI, rx = Math.abs(Math.cos(th)) * 4.8 + 0.5;
      c.beginPath(); c.ellipse(0, -zc, rx, 4.8, 0, 0, Math.PI); c.strokeStyle = GOLD; c.lineWidth = 0.8; c.stroke();
      c.beginPath(); c.ellipse(0, -zc, rx, 4.8, 0, 0.3, Math.PI - 0.3); c.strokeStyle = GH; c.lineWidth = 0.3; c.stroke();
      pe.poly(GOLD, [0, 0, zc + 2.6, 0.9, 0, zc + 4.6, 0, 0, zc + 7.4, -0.9, 0, zc + 4.6]);
      pe.poly(GOLD, [0, 0, zc - 2.6, 0.8, 0, zc - 4, 0, 0, zc - 5.8, -0.8, 0, zc - 4]);
      pe.poly(GOLD, [2.6, 0, zc, 4.2, 0, zc + 0.7, 5.6, 0, zc, 4.2, 0, zc - 0.7]); pe.poly(GOLD, [-2.6, 0, zc, -4.2, 0, zc + 0.7, -5.6, 0, zc, -4.2, 0, zc - 0.7]);
      pe.poly(GH, [0, 0.01, zc + 2.6, -0.9, 0.01, zc + 4.6, 0, 0.01, zc + 7.4]);
      pe.dot('#ff4a4a', 0, 2.7, zc, 0.8); pe.dot('#ffd0c0', -0.25, 2.7, zc + 0.25, 0.26);
      pe.dot('#ffffff', -0.9, 1.6, zc + 1.2, 0.5);
      for (let i = 0; i < 8; i++) { const ph = (a + i / 8) % 1, t = i * 2.3; pe.dot(al(i % 2 ? GL : '#ffffff', 0.9 * Math.sin(ph * Math.PI)), Math.cos(t) * (3 + i % 3 * 2), Math.sin(t) * 2, 9 + ph * 14, 0.3); }
    }));
    return { r: 20, h: 26, parts, style: 'prop', bevel: 0.6, spots: { relic: [0, 0, 15.5] } };
  };

  /* ========================================================== site_waygate
   * Waygate ~50: a ring of fitted stones standing on a stepped dais, glowing keystone
   * runes, swirling portal light inside (anims 4 turn the spiral), twin blue-flame
   * braziers and light spilling onto the steps. */
  M.site_waygate = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const P1 = opt.glow || '#62e6ff', P2 = opt.glow2 || '#9a66ff', PH = '#f0ffff';
    const stS = mx(p.a, '#7a7880', 0.45), stT = mx(p.s, '#c6c4c0', 0.4), stD = mx(p.a, '#4e4c54', 0.45);
    const RZ = 20, RI = 12.4, RO = 17.2, GY = -3, GT = 2.8;
    const parts = [stain(28, 18, 0.26, '#1e1a26', 0, 2)];
    parts.push({ z0: 0, z1: 1.4, side: stD, top: mx(stT, stS, 0.4), ao: 0.3, shape: (c) => S.rrect(c, -24, -13, 48, 26, 6),
      detail: (c) => { const s = []; for (let x = -20; x < 24; x += 4) s.push(x, -13, x, 13); S.lines(c, 'rgba(40,38,44,0.3)', 0.28, s); } });
    parts.push({ z0: 1.4, z1: 2.8, side: stD, top: mx(stT, stS, 0.2), ao: 0.3, shape: (c) => S.rrect(c, -18, -9.5, 36, 15, 4),
      detail: (c, a) => { const ap = 0.5 + 0.5 * pulse(a); c.beginPath(); S.rrect(c, -16.5, -8, 33, 12, 3); c.strokeStyle = al(P1, 0.35 + 0.35 * ap); c.lineWidth = 0.3; c.stroke(); } });
    parts.push(layer((pe, a) => { const c = pe.c, gp = pulse(a); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(0, -2.8 + 2, 0, 0, -2.8 + 2, 18); g.addColorStop(0, al(P1, 0.25 + 0.15 * gp)); g.addColorStop(1, al(P1, 0)); c.fillStyle = g; c.beginPath(); c.ellipse(0, -0.8, 18, 9, 0, 0, TAU); c.fill(); c.restore(); }));
    // cradle block under the ring
    parts.push({ z0: 2.8, z1: 6.4, side: stS, top: stT, ao: 0.3, shape: (c, zt) => S.poly(c, [-9 + zt, GY - 4, 9 - zt, GY - 4, 10 - zt * 2, GY + 4, -10 + zt * 2, GY + 4]) });
    parts.push(xzPart(ringQuads(0, RZ, RI, RO, 28), 2.8, RZ + RO, stS, stT, { oy: GY, v0: -GT, v1: GT }, { ao: 0.32 }));
    parts.push(layer((pe, a) => {
      const c = pe.c, y = GY + GT + 0.02, gp = pulse(a), s = [];
      for (let i = 0; i < 28; i++) { const t = (i / 28) * TAU; s.push(Math.cos(t) * RI, y, RZ + Math.sin(t) * RI, Math.cos(t) * RO, y, RZ + Math.sin(t) * RO); }
      c.save(); c.beginPath(); c.arc(0, y - RZ, RO, 0, TAU); c.arc(0, y - RZ, RI, 0, TAU, true); c.clip();
      pe.lines('rgba(30,28,36,0.42)', 0.3, s);
      for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU + Math.PI / 8, rm = (RI + RO) / 2, x = Math.cos(t) * rm, z = RZ + Math.sin(t) * rm; pe.poly(mx(stT, '#ffffff', 0.15), [].concat([Math.cos(t - 0.1) * RI, y, RZ + Math.sin(t - 0.1) * RI], [Math.cos(t - 0.1) * RO, y, RZ + Math.sin(t - 0.1) * RO], [Math.cos(t + 0.1) * RO, y, RZ + Math.sin(t + 0.1) * RO], [Math.cos(t + 0.1) * RI, y, RZ + Math.sin(t + 0.1) * RI])); rune(pe, x - 0.5, y + 0.01, z - 1, 2, P1, i + 2, 0.5 + 0.5 * pulse(a, i / 8)); }
      c.restore();
      // the portal: see-through lens between the front and back openings
      c.save();
      c.beginPath(); c.arc(0, GY + GT - RZ, RI, 0, TAU); c.clip();
      c.beginPath(); c.arc(0, GY - GT - RZ, RI, 0, TAU); c.clip();
      const cy = GY - RZ;
      const g = c.createRadialGradient(0, cy, 0, 0, cy, RI + 2);
      g.addColorStop(0, PH); g.addColorStop(0.25, P1); g.addColorStop(0.7, P2); g.addColorStop(1, mx(P2, '#100830', 0.5));
      c.fillStyle = g; c.fillRect(-RI - 1, cy - RI - 4, 2 * RI + 2, 2 * RI + 8);
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        for (let i = 0; i <= 40; i++) { const t = i / 40, ang = (k / 4) * TAU + a * (TAU / 4) + t * 5.2, rr = 0.6 + t * (RI + 1); const xx = Math.cos(ang) * rr, yy = cy + Math.sin(ang) * rr; if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
        c.strokeStyle = al(k % 2 ? PH : '#c8f8ff', 0.55); c.lineWidth = 1.1; c.stroke();
      }
      const r = rng(5, frame4(a));
      for (let i = 0; i < 14; i++) { const t = r.range(0, TAU), d = r.range(2, RI); pe.dot(al('#ffffff', r.range(0.4, 0.9)), Math.cos(t) * d, GY + Math.sin(t) * d * 0.2, RZ + Math.sin(t) * d, r.range(0.2, 0.4)); }
      c.restore();
      pe.glow(PH, 0, GY, RZ, 4 + gp * 1.5, 0.7);
    }));
    // braziers with blue flames
    const BR = [[-15, 6], [15, 6]];
    parts.push({ z0: 2.8, z1: 6.6, side: stD, top: stS, ao: 0.3, shape: (c, zt) => { for (const q of BR) S.circ(c, q[0], q[1], zt < 0.7 ? 1 : 1 + (zt - 0.7) * 4); } });
    parts.push({ z0: 6.6, z1: 10.6, side: mx(P1, P2, 0.4), top: PH, flat: true, ao: -0.3, bevel: false, shape: (c, zt, a) => { for (let i = 0; i < 2; i++) { const q = BR[i], h = 0.85 + 0.25 * Math.sin((a + i * 0.5) * TAU); if (zt > h) continue; const s = 1.3 * Math.pow(1 - zt / h, 0.7); S.circ(c, q[0] + Math.sin((a + zt) * TAU) * 0.3 * zt, q[1], Math.max(0.1, s)); } } });
    parts.push(layer((pe, a) => { for (const q of BR) pe.glow(P1, q[0], q[1], 8, 4, 0.35 + 0.15 * pulse(a)); for (let i = 0; i < 6; i++) { const ph = (a + i / 6) % 1, t = i * 2.1; pe.dot(al(i % 2 ? P1 : PH, 0.9 * Math.sin(ph * Math.PI)), Math.cos(t) * 8, GY + 2 + Math.sin(t) * 1.5, 4 + ph * 26, 0.3); } }));
    return { r: 28, h: RZ + RO + 2, parts, style: 'prop', bevel: 0.7, spots: { portal: [0, GY, RZ] } };
  };

  /* ============================================================ site_grove
   * Enchanted grove centre ~40: a vast ancient stump on spreading roots, its hollow
   * crown cradling a glowing pool and a luminous sapling, glowing mushrooms, mossy
   * stones and drifting fireflies (anims 4). */
  M.site_grove = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const G = opt.glow || '#c8ff7a', G2 = opt.glow2 || '#7affd8', GH = '#f4ffe0';
    const bark = mx(p.w, '#5a4a3a', 0.4), barkT = mx(p.w, '#9a8466', 0.5);
    const parts = [stain(24, 18, 0.32, '#1c2414', 0, 2)];
    parts.push(layer((pe, a) => {
      const c = pe.c, g = c.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, al(G, 0.18 + 0.08 * pulse(a))); g.addColorStop(1, al(G, 0)); c.save(); c.scale(1, 0.74); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill(); c.restore();
      const r = rng(7, 1);
      for (let i = 0; i < 40; i++) { const t = r.range(0, TAU), d = r.range(11, 19); pe.dot(['#e8f0a0', '#f0b0d8', '#ffffff', '#b0d8ff'][i % 4], Math.cos(t) * d, Math.sin(t) * d * 0.78, 0.1, r.range(0.25, 0.45)); }
    }));
    const stones = [];
    for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU + 0.5; stones.push({ x: Math.cos(t) * 17, y: Math.sin(t) * 13, r: 2, h: 3.4 + (i % 3), seed: 160 + i, n: 7, rough: 0.2, top: 0.5, pw: 4, moss: 1 }); }
    const sN = stones.filter((s) => s.y < 0), sS = stones.filter((s) => s.y >= 0);
    parts.push(rockPart(sN, '#6e6a62', '#a8a49a'));
    parts.push(layer((pe) => paintMoss(pe, sN, 3, { cracks: false })));
    // roots
    const roots = [];
    for (let i = 0; i < 7; i++) { const t = (i / 7) * TAU + 0.2 + 0.2 * Math.sin(i * 3); roots.push({ t, L: 10 + (i % 3) * 2.4, h: 3.8 - (i % 2) * 0.8, w: 2.6 - (i % 2) * 0.5, bend: (i % 2 ? 1 : -1) * 1.6 }); }
    parts.push({ z0: 0, z1: 4, side: bark, top: barkT, ao: 0.4, shape: (c, zt) => {
      const z = zt * 4;
      for (const rt of roots) {
        const tm = 1 - z / rt.h; if (tm <= 0.02) continue;
        const ux = Math.cos(rt.t), uy = Math.sin(rt.t), nx = -uy, ny = ux, L = [], R = [];
        for (let k = 0; k <= 6; k++) { const s = (k / 6) * tm, d = 5 + s * rt.L, off = Math.sin(s * Math.PI) * rt.bend, w = rt.w * (1 - s * 0.85) * Math.sqrt(Math.max(0.05, 1 - z / rt.h * 0.7)); L.push(ux * d + nx * (off + w), uy * d + ny * (off + w)); R.push(ux * d + nx * (off - w), uy * d + ny * (off - w)); }
        const pts = []; for (const q of L) pts.push(q[0], q[1]); for (let k = R.length - 1; k >= 0; k--) pts.push(R[k][0], R[k][1]);
        S.poly(c, pts);
      }
    } });
    // the stump
    const stumpPts = (zt) => jag(16, 6.6 - zt * 0.6, 7, 0.16);
    parts.push({ z0: 0, z1: 8.4, side: bark, top: barkT, ao: 0.4, shape: (c, zt) => S.poly(c, stumpPts(zt)),
      detail: (c, a) => { const pts = stumpPts(1); c.save(); c.beginPath(); S.poly(c, pts); c.clip(); for (let r = 1; r < 6.2; r += 0.9) { c.beginPath(); c.arc(0.3, 0.2, r, 0, TAU); c.strokeStyle = 'rgba(90,64,40,0.45)'; c.lineWidth = 0.25; c.stroke(); } S.dot(c, '#2a2014', 0.3, 0.2, 2.9); const g = c.createRadialGradient(0.3, 0.2, 0, 0.3, 0.2, 2.6); g.addColorStop(0, GH); g.addColorStop(0.5, al(G, 0.95)); g.addColorStop(1, al(G2, 0.6)); c.fillStyle = g; c.beginPath(); c.arc(0.3, 0.2, 2.5, 0, TAU); c.fill(); c.restore(); } });
    parts.push(layer((pe, a) => {
      const r = rng(9, 3), s = [];
      for (let i = 0; i < 16; i++) { const x = r.range(-5.6, 5.6), y = Math.sqrt(Math.max(0, 6.3 * 6.3 - x * x)) * 0.95 + 0.05; s.push(x, y, r.range(0.4, 2), x + r.range(-0.4, 0.4), y, r.range(5, 8)); }
      pe.lines('rgba(40,28,18,0.5)', 0.35, s);
      for (let i = 0; i < 5; i++) clump(pe, r.range(-5, 5), r.range(3, 6), r.range(1, 7.5), 1.2, r);
      for (let i = 0; i < 4; i++) { const t = 0.4 + i * 0.7, x = Math.cos(t) * 6.2, y = Math.sin(t) * 6.2; clump(pe, x, y, 8.4, 1.1, r); }
      pe.glow(G, 0.3, 0.2, 9, 5, 0.3 + 0.2 * pulse(a));
    }));
    // luminous sapling
    parts.push(beams([[0.3, 0.2, 8.4, 0.8, -0.2, 14], [0.7, -0.1, 12, -1.6, -0.5, 14.6], [0.7, -0.1, 12.6, 2.6, 0.2, 15]], 0.45, '#6a5a3a', '#a89060'));
    parts.push({ z0: 13.4, z1: 17.6, side: mx(G, '#3a8a3a', 0.45), top: GH, flat: true, ao: 0.35, bevel: false, shape: (c, zt) => { const k = Math.sin(Math.PI * Math.min(1, zt * 1.1 + 0.05)); S.circ(c, 0.8, -0.3, 2.2 * k + 0.1); S.circ(c, -1.7, -0.5, 1.5 * k + 0.1); S.circ(c, 2.7, 0.2, 1.6 * k + 0.1); } });
    // glowing mushrooms on the roots
    const shrooms = [[-8, 5, 1.2], [-9.4, 6.4, 0.8], [9, 4, 1], [10.6, 2.6, 0.7], [3, 11, 0.9], [-2, -9.5, 0.8], [7, -7, 0.7]];
    parts.push(beams(shrooms.map((q) => [q[0], q[1], 0, q[0], q[1], 1 + q[2]]), 0.4, '#d8d0b8', '#f0ead8'));
    parts.push({ z0: 1.2, z1: 2.8, side: mx(G2, '#2a6a6a', 0.3), top: mx(G2, '#ffffff', 0.4), flat: true, ao: 0.3, bevel: false, shape: (c, zt) => { for (const q of shrooms) { const z = 1.2 + zt * 1.6; if (z > 1.2 + q[2] * 1.2) continue; S.circ(c, q[0], q[1], q[2] * (1.3 - (z - 1.2) / (q[2] * 1.2) * 0.8)); } } });
    parts.push(rockPart(sS, '#6e6a62', '#a8a49a'));
    parts.push(layer((pe, a) => {
      paintMoss(pe, sS, 5, { cracks: false });
      for (const q of shrooms) pe.glow(G2, q[0], q[1], 2, 2.4, 0.3 + 0.15 * pulse(a));
      pe.glow(G, 0.6, -0.3, 15.5, 6, 0.3 + 0.15 * pulse(a));
      const r = rng(11, 4);
      for (let i = 0; i < 14; i++) { const base = r.range(0, TAU), rr = r.range(5, 16), zb = r.range(4, 16), ph = (a + i / 14) * TAU; const x = Math.cos(base + Math.sin(ph) * 0.2) * rr, y = Math.sin(base + Math.sin(ph) * 0.2) * rr * 0.7, z = zb + Math.sin(ph * 2 + i) * 1.2; const on = 0.35 + 0.65 * Math.max(0, Math.sin(ph + i)); pe.glow(G, x, y, z, 1.6, 0.4 * on); pe.dot(al(GH, on), x, y, z, 0.32); }
    }));
    return { r: 24, h: 20, parts, style: 'prop', bevel: 0.6, spots: { glow: [0.3, 0.2, 9] } };
  };

  /* ============================================================ site_chest
   * Treasure chest ~10: iron-bound chest with the lid thrown open, heaped gold
   * spilling over the front onto the grass, two gems and a goblet. */
  M.site_chest = function (pal, opt) {
    opt = opt || {};
    const GOLD = '#e8b84a', GD = '#a8741c', GH = '#fff2b0';
    const wood = '#7a4628', woodT = '#a8683a', iron = '#38343a';
    const parts = [stain(7, 5, 0.3, '#2a2216', 0, 1)];
    // spill on the ground
    parts.push({ z0: 0, z1: 1, side: GD, top: GOLD, ao: 0.3, shape: (c, zt) => { const k = 1 - zt * 0.6; S.blob(c, 0.8, 3.6, 3.2 * k, 5, 9, 0.35); S.blob(c, -2.6, 3.4, 1.5 * k, 7, 7, 0.4); } });
    parts.push(layer((pe) => { const r = rng(3, 3); for (let i = 0; i < 24; i++) { const x = r.range(-4.6, 5), y = r.range(2.2, 6.2); pe.ell(r.next() < 0.6 ? GOLD : GH, x, y, r.range(0, 0.9), 0.42, 0.28); } }));
    // chest body
    parts.push(box(0, -0.6, 7.2, 4.4, 0, 3.6, wood, woodT, { ao: 0.3 }));
    parts.push({ z0: 3.2, z1: 4.8, side: GD, top: GOLD, ao: 0.25, shape: (c, zt) => S.blob(c, 0, -0.6, 3.3 * (1 - zt * 0.55), 9, 9, 0.2), detail: (c) => { const r = rng(5, 1); for (let i = 0; i < 9; i++) S.dot(c, GH, r.range(-1.6, 1.6), -0.6 + r.range(-1, 1), r.range(0.2, 0.4)); } });
    // open lid leaning back
    const yl = (z) => -2.85 - (z - 3.6) * 0.24;
    parts.push({ z0: 3.6, z1: 7.8, side: sh(wood, -0.12), top: woodT, ao: 0.15, shape: (c, zt) => { const z = 3.6 + zt * 4.2; c.rect(-3.7, yl(z) - 0.45, 7.4, 0.9); } });
    parts.push(layer((pe) => {
      const y = 1.62;
      // iron bands, corners and the lock plate on the front
      pe.wall(iron, -3.6, -2.9, y, 0, 3.6); pe.wall(iron, 2.9, 3.6, y, 0, 3.6); pe.wall(iron, -1.6, -1.1, y, 0, 3.6); pe.wall(iron, 1.1, 1.6, y, 0, 3.6);
      pe.wall(iron, -3.6, 3.6, y, 3.1, 3.6);
      pe.wall(GOLD, -0.7, 0.7, y + 0.01, 2.2, 3.4); pe.dot('#2a2018', 0, y + 0.02, 2.6, 0.22);
      pe.lines('rgba(40,20,10,0.4)', 0.25, [-3.6, y, 1.2, 3.6, y, 1.2, -3.6, y, 2.3, 3.6, y, 2.3]);
      // lid inner face: dark wood, velvet lining, bands
      const yi = yl(5.7) + 0.47;
      pe.poly('#7a1e2a', [-3.2, yl(4) + 0.46, 4, 3.2, yl(4) + 0.46, 4, 3.2, yl(7.4) + 0.46, 7.4, -3.2, yl(7.4) + 0.46, 7.4]);
      pe.lines(iron, 0.5, [-3.5, yi, 3.7, -3.5, yi, 7.7, 3.5, yi, 3.7, 3.5, yi, 7.7]);
      // gems, goblet, coins over the rim
      pe.dot('#e83a4a', -1.4, 0.4, 4.7, 0.5); pe.dot('#ffd0d0', -1.55, 0.35, 4.85, 0.16);
      pe.dot('#3a8ae8', 1.6, -0.4, 4.6, 0.45); pe.dot('#d0e8ff', 1.45, -0.45, 4.75, 0.14);
      pe.poly(GOLD, [2.4, 0.6, 4.4, 3.2, 0.6, 4.4, 3, 0.6, 5.6, 3.5, 0.6, 6.4, 2.1, 0.6, 6.4, 2.6, 0.6, 5.6]); pe.poly(GH, [2.25, 0.61, 6.3, 2.6, 0.61, 6.3, 2.6, 0.61, 5.7]);
      for (let i = 0; i < 7; i++) pe.ell(i % 2 ? GOLD : GH, -2.4 + i * 0.8, 1.7, 3.5 - Math.abs(i - 3) * 0.35, 0.42, 0.3);
    }));
    return { r: 7, h: 8.4, parts, style: 'prop', bevel: 0.6 };
  };

  /* ================================================================ PROPS
   * Small village / camp props, 6-20 units. 1-direction unless noted. */
  const woodOf = (p) => { const b = mx(p.w, '#a8804e', 0.42); return { s: b, t: sh(b, 0.3), d: sh(b, -0.36), l: sh(b, 0.48) }; };

  /* domed haystack with a pole, straw strokes and loose wisps */
  M.prop_haystack = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), hay = mx(p.t, '#dcbc5c', 0.45), R = 6.2, H = 8.4;
    const prof = (zt) => Math.max(0.3, R * Math.pow(1 - Math.pow(zt, 1.8), 0.62));
    const parts = [stain(9, 6.5, 0.28, '#2a2216', 0, 1)];
    parts.push(layer((pe) => { const r = rng(3, 1); for (let i = 0; i < 26; i++) { const a = r.range(0, TAU), d = r.range(R * 0.9, R * 1.45); const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85; pe.lines(r.next() < 0.5 ? sh(hay, -0.2) : sh(hay, 0.25), 0.3, [x, y, 0, x + r.range(-1.2, 1.2), y + r.range(-0.4, 0.4), 0.1]); } }));
    parts.push({ z0: 0, z1: H, side: sh(hay, -0.08), top: sh(hay, 0.25), ao: 0.42, bevel: false, shape: (c, zt) => S.circ(c, 0, 0, prof(zt)) });
    parts.push(layer((pe) => {
      const c = pe.c, r = rng(5, 2);
      c.save(); c.beginPath(); for (let z = 0; z <= H; z += 0.5) { c.moveTo(prof(z / H), -z); c.arc(0, -z, prof(z / H), 0, TAU); } c.clip();
      for (let i = 0; i < 90; i++) { const a = r.range(-0.4, Math.PI + 0.4), zt = r.range(0, 0.95), z = zt * H, rr = prof(zt), z2 = Math.max(0, z - r.range(0.8, 1.6)), r2 = prof(z2 / H); c.beginPath(); c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr - z); c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 - z2); c.strokeStyle = r.next() < 0.55 ? al(sh(hay, -0.45), 0.35) : al(sh(hay, 0.5), 0.35); c.lineWidth = 0.3; c.stroke(); }
      for (const z of [2.6, 5.4]) { c.beginPath(); c.arc(0, -z, prof(z / H), 0.05, Math.PI - 0.05); c.strokeStyle = al(sh(hay, -0.5), 0.35); c.lineWidth = 0.45; c.stroke(); }
      c.restore();
    }));
    parts.push(beams([[0.3, 0, H - 1, 0.6, -0.3, H + 3]], 0.55, sh(p.w, -0.2), sh(p.w, 0.25)));
    parts.push(layer((pe) => { pe.lines(sh(p.w, -0.1), 0.4, [4.6, 4.4, 0, 6.6, 4.6, 7.6]); pe.lines('#8a8680', 0.3, [6.6, 4.6, 7.6, 6.1, 4.6, 9, 6.6, 4.6, 7.6, 6.9, 4.6, 9.1, 6.6, 4.6, 7.6, 7.4, 4.6, 8.9]); }));
    return { r: 9, h: H + 3.5, parts, style: 'prop', bevel: 0.6 };
  };

  /* stacked crates with plank seams and corner braces */
  M.prop_crates = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), w = woodOf(p), wl = mx(p.w, '#c09868', 0.58);
    const cr = [[-2.3, 0.2, 4.2, 0, 4.2, 0], [2.1, 0.7, 3.8, 0, 3.8, 0.1], [-1.4, 0, 3.4, 4.2, 7.6, 0.28]];
    const parts = [stain(7, 5, 0.28, '#2a2216', 0, 1)];
    for (const q of cr) {
      const [x, y, s, z0, z1, a] = q;
      parts.push({ z0, z1, side: mx(wl, w.d, 0.18), top: sh(wl, 0.12), ao: 0.3, shape: (c) => S.poly(c, tf([-s / 2, -s / 2, s / 2, -s / 2, s / 2, s / 2, -s / 2, s / 2], x, y, a)),
        detail: (c) => { c.save(); c.translate(x, y); c.rotate(a); const h = s / 2; S.lines(c, al(w.d, 0.6), 0.3, [-h, -h / 3, h, -h / 3, -h, h / 3, h, h / 3]); S.lines(c, al(w.d, 0.75), 0.4, [-h + 0.2, -h + 0.2, h - 0.2, -h + 0.2, h - 0.2, -h + 0.2, h - 0.2, h - 0.2, h - 0.2, h - 0.2, -h + 0.2, h - 0.2, -h + 0.2, h - 0.2, -h + 0.2, -h + 0.2]); c.restore(); } });
      parts.push(layer((pe) => {
        const pts = tf([-s / 2, s / 2, s / 2, s / 2], x, y, a), yy = Math.max(pts[1], pts[3]) + 0.02, x0 = Math.min(pts[0], pts[2]), x1 = Math.max(pts[0], pts[2]);
        if (a > 0.15) return;
        pe.lines(al(w.d, 0.55), 0.28, [x0, yy, z0 + (z1 - z0) / 3, x1, yy, z0 + (z1 - z0) / 3, x0, yy, z0 + (z1 - z0) * 2 / 3, x1, yy, z0 + (z1 - z0) * 2 / 3]);
        pe.lines(al(w.d, 0.8), 0.45, [x0 + 0.25, yy, z0 + 0.25, x1 - 0.25, yy, z1 - 0.25, x0 + 0.25, yy, z0 + 0.2, x0 + 0.25, yy, z1 - 0.2, x1 - 0.25, yy, z0 + 0.2, x1 - 0.25, yy, z1 - 0.2]);
      }));
    }
    return { r: 7, h: 8, parts, style: 'prop', bevel: 0.6 };
  };

  /* three bellied barrels with iron hoops (one with an open lid of ale) */
  M.prop_barrels = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), w = woodOf(p), st = mx(p.w, '#b08250', 0.55);
    const B = [[-1.8, -1.2, 1.7, 4.4], [1.9, -0.6, 1.6, 4.2], [0, 2, 1.7, 4.4]];
    const rb = (q, zt) => q[2] * (0.88 + 0.14 * Math.sin(Math.PI * zt));
    const parts = [stain(6.5, 4.6, 0.28, '#2a2216', 0, 1)];
    B.forEach((q, i) => {
      parts.push({ z0: 0, z1: q[3], side: st, top: sh(st, 0.25), ao: 0.35, shape: (c, zt) => S.circ(c, q[0], q[1], rb(q, zt)),
        detail: (c) => { S.dot(c, '#3a2a1a', q[0], q[1], rb(q, 1) - 0.15); S.dot(c, i === 2 ? '#6a3a1a' : sh(st, 0.15), q[0], q[1], rb(q, 1) - 0.45); S.lines(c, al(w.d, 0.5), 0.25, [q[0] - 1, q[1], q[0] + 1, q[1], q[0] - 1, q[1] - 0.5, q[0] + 1, q[1] - 0.5, q[0] - 1, q[1] + 0.5, q[0] + 1, q[1] + 0.5]); } });
      parts.push(layer((pe) => {
        const c = pe.c;
        for (const zt of [0.18, 0.82]) { const z = q[3] * zt, rr = rb(q, zt); c.beginPath(); c.arc(q[0], q[1] - z, rr + 0.04, 0.1, Math.PI - 0.1); c.strokeStyle = '#2e2a28'; c.lineWidth = 0.45; c.stroke(); }
        const s = []; for (const dx of [-0.9, 0, 0.9]) { const y = q[1] + Math.sqrt(Math.max(0, q[2] * q[2] - dx * dx)); s.push(q[0] + dx * 0.95, y, 0.3, q[0] + dx * 1.05, y, q[3] - 0.3); }
        pe.lines(al(w.d, 0.4), 0.25, s);
      }));
    });
    return { r: 6, h: 5, parts, style: 'prop', bevel: 0.6 };
  };

  /* log pile: six logs lying north-south, end grain to the front */
  M.prop_logs = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), bark = mx(p.w, '#7a5a3c', 0.5), barkT = sh(bark, 0.28), grain = '#d4ac78';
    const R = 1.55, L0 = -2.4, L1 = 2.4;
    const logs = [[-3.1, R], [0, R], [3.1, R], [-1.55, R * 2.7], [1.55, R * 2.7], [0, R * 4.4]];
    const parts = [stain(8, 6, 0.28, '#2a2216', 0, 1)];
    parts.push({ z0: 0, z1: R * 5.4, side: bark, top: barkT, ao: 0.3, shape: (c, zt) => {
      const z = zt * R * 5.4;
      for (const q of logs) { const dz = z - q[1]; if (Math.abs(dz) > R) continue; const hw = Math.sqrt(R * R - dz * dz); c.rect(q[0] - hw, L0 + (q[0] * 0.3), hw * 2, L1 - L0); }
    } });
    parts.push(layer((pe) => {
      for (const q of logs) {
        const y = L1 + q[0] * 0.3 + 0.02;
        pe.dot(sh(grain, -0.25), q[0], y, q[1], R);
        pe.dot(grain, q[0] - 0.08, y, q[1] + 0.08, R - 0.32);
        const c = pe.c;
        for (const rr of [0.45, 0.85]) { c.beginPath(); c.arc(q[0] - 0.08, y - q[1] - 0.08, rr, 0, TAU); c.strokeStyle = 'rgba(120,80,40,0.55)'; c.lineWidth = 0.18; c.stroke(); }
        pe.lines('rgba(90,60,30,0.6)', 0.18, [q[0], y, q[1], q[0] + 0.9, y, q[1] + 0.6]);
      }
      // bark texture along the top of each log
      const r = rng(4, 4), s = [];
      for (const q of logs) for (let k = 0; k < 3; k++) { const x = q[0] + r.range(-0.9, 0.9), y0 = L0 + q[0] * 0.3 + r.range(0, 2), z = q[1] + Math.sqrt(Math.max(0, R * R - (x - q[0]) * (x - q[0]))); s.push(x, y0, z, x + r.range(-0.2, 0.2), y0 + r.range(1.5, 3), z); }
      pe.lines(al(sh(bark, -0.5), 0.6), 0.25, s);
      // a hatchet in the top log
      pe.lines('#6a4a30', 0.45, [1.2, 0.6, 6.9, 3, 0.6, 9.6]); pe.poly('#9a9a96', [2.6, 0.6, 9.2, 4, 0.6, 9.9, 3.6, 0.6, 8.6]);
    }));
    return { r: 7, h: 10.5, parts, style: 'prop', bevel: 0.6 };
  };

  /* market stall: counter of goods under a striped awning (opt.v 0-2 colours) */
  M.prop_stall = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), w = woodOf(p), v = (((opt.v | 0) % 3) + 3) % 3;
    const AW = [['#b8342a', '#f0e6cc'], ['#2f6aa8', '#f2d98a'], ['#3e7a3a', '#efe2c4']][v];
    const parts = [stain(9, 6, 0.28, '#2a2216', 0, 1)];
    parts.push(beams([[-5.6, -2.8, 0, -5.6, -2.8, 9.2], [5.6, -2.8, 0, 5.6, -2.8, 9.2], [-5.6, 1.8, 0, -5.6, 1.8, 7.4], [5.6, 1.8, 0, 5.6, 1.8, 7.4]], 0.6, w.d, w.s));
    parts.push(box(0, 2.4, 11.2, 4.2, 0, 3.2, w.s, w.t, { ao: 0.3 }));
    parts.push(layer((pe) => { pe.lines(al(w.d, 0.6), 0.3, [-5.6, 4.51, 1.1, 5.6, 4.51, 1.1, -5.6, 4.51, 2.2, 5.6, 4.51, 2.2]); for (const x of [-3, 0, 3]) pe.lines(al(w.d, 0.5), 0.3, [x, 4.51, 0, x, 4.51, 3.2]); }));
    // goods: baskets of fruit, cloth bolts, pots
    const goods = [[-3.8, 3, '#d8402a'], [-1.3, 3.4, '#e8b030'], [1.3, 2.8, '#6aa83a'], [3.8, 3.4, '#a8508a']];
    parts.push({ z0: 3.2, z1: 4.4, side: '#7a5a34', top: '#a88050', ao: 0.2, bevel: false, shape: (c) => { for (const g of goods) S.circ(c, g[0], g[1], 1.1); } });
    parts.push(layer((pe) => { const r = rng(7, v); for (const g of goods) for (let i = 0; i < 7; i++) { const a = r.range(0, TAU), d = r.range(0, 0.7); pe.dot(i % 3 ? g[2] : sh(g[2], 0.35), g[0] + Math.cos(a) * d, g[1] + Math.sin(a) * d * 0.8, 4.5 + r.range(0, 0.4), 0.42); } }));
    parts.push(cyl(-4.4, 1, 0.8, 3.2, 5, '#9a5a3a', '#c8805a', { detail: (c) => S.dot(c, '#3a2018', -4.4, 1, 0.45) }));
    parts.push(cyl(4.4, 0.9, 0.6, 3.2, 6.2, AW[0], sh(AW[0], 0.3), { bevel: false }));
    // awning sloping down to the front
    parts.push({ z0: 7.2, z1: 9.2, side: sh(AW[0], -0.2), top: AW[1], ao: 0.1, bevel: false, shape: (c, zt) => c.rect(-6.4, -3.4, 12.8, 5.6 - zt * 5) });
    parts.push(layer((pe) => {
      const c = pe.c;
      c.save(); c.beginPath(); for (let z = 7.2; z <= 9.2; z += 0.25) { const zt = (z - 7.2) / 2; c.rect(-6.4, -3.4 - z, 12.8, 5.6 - zt * 5); } c.clip();
      for (let i = 0; i < 8; i++) if (i % 2 === 0) pe.poly(AW[0], [-6.4 + i * 1.6, 2.2, 7.2, -6.4 + (i + 1) * 1.6, 2.2, 7.2, -6.4 + (i + 1) * 1.6, -3.4, 9.2, -6.4 + i * 1.6, -3.4, 9.2]);
      c.restore();
      // scalloped valance along the front edge
      for (let i = 0; i < 8; i++) { const x = -6.4 + (i + 0.5) * 1.6; pe.c.beginPath(); pe.c.arc(x, 2.2 - 7.2, 0.8, 0, Math.PI); pe.c.fillStyle = i % 2 ? AW[1] : AW[0]; pe.c.fill(); }
    }));
    return { r: 8, h: 10, parts, style: 'prop', bevel: 0.6 };
  };

  /* A-frame canvas tent, door flap to the front, guy ropes, pennant (opt.col, opt.trim) */
  M.prop_tent = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), cv = opt.col || '#e4d8ba', tr = opt.trim || '#a8402e';
    const parts = [stain(10, 7, 0.28, '#2a2216', 0, 1)];
    parts.push(layer((pe) => { pe.lines('rgba(200,190,160,0.9)', 0.18, [-5.2, -4, 2.6, -8.6, -5.4, 0, 5.2, -4, 2.6, 8.6, -5.4, 0, -5.2, 3, 2.6, -8.6, 4.4, 0, 5.2, 3, 2.6, 8.6, 4.4, 0]); for (const q of [[-8.6, -5.4], [8.6, -5.4], [-8.6, 4.4], [8.6, 4.4]]) pe.lines('#5a4030', 0.4, [q[0], q[1], 0, q[0], q[1], 0.8]); }));
    const R = roof({ x: 0, y: -0.6, L: 5.6, W: 5.8, z: 0.01, H: 7.6, ax: 'y', cols: { N: sh(cv, 0.1), S: cv, W: sh(cv, 0.08), E: sh(cv, -0.22) }, ao: 0.25 });
    parts.push(...R.parts);
    parts.push(layer((pe) => {
      const ys = 5.02;
      // seams and a trim band along the eaves
      pe.lines(al(sh(cv, -0.4), 0.5), 0.25, [-2.9, -6.2, 3.8, -2.9, 5, 3.8, 2.9, -6.2, 3.8, 2.9, 5, 3.8]);
      pe.poly(tr, [-5.8, ys, 0, -5.2, ys, 0.8, 5.2, ys, 0.8, 5.8, ys, 0]);
      pe.poly(al(tr, 0.9), [-5.8, -6.2, 0, -5.8, 5, 0, -5.2, 5, 0.8, -5.2, -6.2, 0.8]);
      // door: open flap and dark interior
      pe.poly('#2a2018', [-2.2, ys, 0, 2.2, ys, 0, 0, ys, 5.6]);
      pe.poly(sh(cv, -0.12), [0, ys + 0.02, 5.6, 2.2, ys + 0.02, 0, 3.4, ys + 0.3, 0.4, 1.2, ys + 0.2, 4.6]);
      pe.lines(al(sh(cv, -0.5), 0.6), 0.3, [0, ys, 7.4, -5.6, ys, 0.1, 0, ys, 7.4, 5.6, ys, 0.1]);
    }));
    parts.push(...flagPole(0, 5.2, 6.6, 3.4, p).map((q, i) => Object.assign(q, i ? {} : {})));
    parts.push(layer((pe, a) => paintFlag(pe, 0.4, 5.2, 10, 3.2, 1.8, a, tr, sh(tr, 0.5), { amp: 0.5 })));
    return { r: 10, h: 12, parts, style: 'prop', bevel: 0.6 };
  };

  /* campfire: stone ring, crossed logs, flickering flames (anims 4), embers */
  M.prop_campfire = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt);
    const ring = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2; ring.push({ x: Math.cos(a) * 3.6, y: Math.sin(a) * 3.1, r: 1.05, h: 1.3, seed: 140 + i, n: 7, moss: 0 }); }
    const parts = [];
    parts.push(layer((pe, a) => { const c = pe.c, g = c.createRadialGradient(0, 0, 0, 0, 0, 9); g.addColorStop(0, al('#ffa040', 0.28 + 0.06 * pulse(a))); g.addColorStop(1, al('#ffa040', 0)); c.save(); c.scale(1, 0.8); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.restore(); pe.ell('#2a2018', 0, 0, 0, 3, 2.5); pe.ell('#3a2a1e', 0, 0, 0.05, 2.2, 1.8); }));
    parts.push(rockPart(ring.filter((q) => q.y < 0), '#6e6a62', '#a8a49a'));
    parts.push({ z0: 0, z1: 1.8, side: '#3a2618', top: '#6a4a30', ao: 0.3, shape: (c, zt) => { const z = zt * 1.8; lyingCyl(c, 0, 0, 5.2, 0.55, 0.5, z); lyingCyl(c, 0, 0, 5.2, 0.55, -0.6, z); lyingCyl(c, 0, 0.3, 4.6, 0.5, 1.6, z); } });
    parts.push(layer((pe, a) => { const r = rng(5, frame4(a)); for (let i = 0; i < 9; i++) pe.dot(r.next() < 0.5 ? '#ff7a2a' : '#ffd060', r.range(-1.8, 1.8), r.range(-1.4, 1.4), 1.2, r.range(0.2, 0.42)); }));
    // flames: three tongues, each a flat stack swaying per frame
    const tongues = [[0, 0.2, 1.5, 6.4, 0], [-0.9, -0.3, 1, 4.4, 0.33], [1, -0.2, 0.95, 4.8, 0.66]];
    const flame = (col, k, hk) => ({ z0: 1, z1: 7.8, side: col[0], top: col[1], flat: true, ao: -0.3, bevel: false, shape: (c, zt, a) => {
      const z = 1 + zt * 6.8;
      for (const t of tongues) { const ph = (a + t[4]) * TAU, H = t[3] * hk * (0.85 + 0.2 * Math.sin(ph)); if (z - 1 > H) continue; const q = (z - 1) / H, rr = t[2] * k * Math.pow(1 - q, 0.8) * (0.7 + 0.6 * Math.sin(Math.PI * Math.min(1, q * 2 + 0.25))); const sx = Math.sin(ph + q * 3) * 0.7 * q; S.circ(c, t[0] + sx, t[1], Math.max(0.12, rr)); }
    } });
    parts.push(flame(['#d8401a', '#ff8a2a'], 1, 1));
    parts.push(flame(['#ff9a2a', '#ffd050'], 0.62, 0.78));
    parts.push(flame(['#ffe070', '#fff6c8'], 0.32, 0.55));
    parts.push(rockPart(ring.filter((q) => q.y >= 0), '#6e6a62', '#a8a49a'));
    parts.push(layer((pe, a) => { for (let i = 0; i < 5; i++) { const ph = (a + i / 5) % 1; pe.dot(al(i % 2 ? '#ffb040' : '#ffe080', 1 - ph), Math.sin(i * 2.1 + ph * 3) * 1.6, -0.2, 6 + ph * 7, 0.22); } pe.glow('#ffb040', 0, 0, 3.4, 4.6, 0.3); }));
    return { r: 7, h: 14, parts, style: 'prop', bevel: 0.6, spots: { fire: [0, 0, 3] } };
  };

  /* signpost with three arrow boards and a little cap */
  M.prop_signpost = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), w = woodOf(p), bd = mx(p.w, '#a88458', 0.4);
    const parts = [stain(6, 4, 0.26, '#2a2216', 0, 1)];
    parts.push({ z0: 0, z1: 1, side: '#6e6a62', top: '#9a968c', ao: 0.3, bevel: false, shape: (c) => S.blob(c, 0, 0, 1.8, 3, 7, 0.3) });
    parts.push(box(0, 0, 1, 1, 0, 12.2, w.d, w.s, { ao: 0.25 }));
    parts.push({ z0: 12.2, z1: 13.6, side: w.d, top: w.t, ao: 0.1, bevel: false, shape: (c, zt) => S.poly(c, ngon(4, 1.4 * (1 - zt * 0.8), Math.PI / 4)) });
    const boards = [[0.6, 9.6, 1, 0.55], [-0.6, 7.4, -1, 0.5], [0.6, 5.2, 1, 0.48]];
    const arrow = (u0, z, dir, len) => { const L = len * 12, h = 1.7; return dir > 0 ? [u0, z - h / 2, u0 + L - 1.4, z - h / 2, u0 + L, z, u0 + L - 1.4, z + h / 2, u0, z + h / 2] : [u0, z - h / 2, u0 - L + 1.4, z - h / 2, u0 - L, z, u0 - L + 1.4, z + h / 2, u0, z + h / 2]; };
    parts.push(xzPart(boards.map((b) => arrow(b[0], b[1], b[2], b[3])), 4.2, 10.6, sh(bd, -0.15), bd, { v0: 0.5, v1: 0.95 }, { ao: 0.12, bevel: false }));
    parts.push(layer((pe) => {
      const r = rng(3, 3);
      for (const b of boards) { const y = 0.97, s = []; const L = b[3] * 12; for (let k = 0; k < 5; k++) { const u = b[0] + b[2] * (1 + k * (L - 3) / 5); s.push(u, y, b[1] + r.range(-0.3, 0.1), u + b[2] * r.range(0.6, 1.2), y, b[1] + r.range(-0.1, 0.3)); } pe.lines('rgba(50,30,16,0.75)', 0.28, s); pe.lines('rgba(255,240,210,0.3)', 0.2, [b[0], y, b[1] + 0.8, b[0] + b[2] * (L - 1.4), y, b[1] + 0.8]); }
      pe.dot('#8a8680', 0, 0.55, 9.6, 0.2); pe.dot('#8a8680', 0, 0.55, 7.4, 0.2); pe.dot('#8a8680', 0, 0.55, 5.2, 0.2);
    }));
    return { r: 8, h: 14, parts, style: 'prop', bevel: 0.6 };
  };

  /* weathered statue of a cloaked hero raising a sword, on a moulded pedestal
   * (opt.v 1 = verdigris bronze) */
  M.prop_statue = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), bronze = opt.v === 1;
    const fS = bronze ? '#3e7a6a' : mx(p.s, '#a8a49a', 0.5), fT = bronze ? '#7ac0a8' : mx(p.b, '#dcd8cc', 0.5);
    const pS = mx(p.a, '#7a766c', 0.45), pT = mx(p.s, '#c0bcae', 0.4);
    const parts = [stain(8, 6, 0.28, '#2a2216', 0, 1)];
    parts.push(box(0, 0, 7.6, 7.6, 0, 1.2, sh(pS, -0.15), pT, { ao: 0.3 }));
    parts.push(box(0, 0, 6, 6, 1.2, 4.6, pS, pT, { ao: 0.3 }));
    parts.push(box(0, 0, 6.8, 6.8, 4.6, 5.4, sh(pS, -0.05), pT, { ao: 0.1, bevel: false }));
    // cloak / legs
    parts.push({ z0: 5.4, z1: 11.6, side: fS, top: fT, ao: 0.3, shape: (c, zt) => S.ell(c, -0.2 + zt * 0.2, 0.1, 2.3 - zt * 0.7, 1.9 - zt * 0.55, 0) });
    // torso + shoulders
    parts.push({ z0: 11.6, z1: 14.4, side: fS, top: fT, ao: 0.2, shape: (c, zt) => S.ell(c, 0, 0, 1.7 + Math.sin(zt * Math.PI) * 0.2 + zt * 0.3, 1.3, 0) });
    // shield on the left arm (a vertical disc facing south-west)
    const disc = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; disc.push(Math.cos(a) * 1.7, 11.4 + Math.sin(a) * 2); }
    parts.push(xzPart([disc], 9.4, 13.4, sh(fS, -0.1), fT, { ox: -1.9, oy: 1, a: 0.5, v0: 0, v1: 0.6 }, { ao: 0.2, bevel: false }));
    // head
    parts.push({ z0: 14.4, z1: 16.6, side: fS, top: fT, ao: 0.15, bevel: false, shape: (c, zt) => S.circ(c, 0.1, 0, Math.max(0.3, 0.95 * Math.sqrt(1 - Math.pow(zt * 2 - 1, 2)) + 0.1)) });
    // raised sword arm
    parts.push(beams([[1.6, 0, 13.6, 2.3, 0.2, 16.2], [2.3, 0.2, 16.2, 2.4, 0.2, 22.4]], 0.6, fS, fT));
    parts.push(beams([[1.6, 0.2, 16.6, 3.2, 0.2, 16.6]], 0.45, fS, fT));
    parts.push(layer((pe) => {
      pe.lines(al(fT, 0.9), 0.3, [2.2, 0.55, 17, 2.3, 0.55, 22]);
      pe.lines('rgba(30,26,22,0.35)', 0.3, [-1.6, 2.02, 6, -1.2, 2.02, 11, 0, 2.02, 6, 0.1, 2.02, 11, 1.4, 1.92, 6, 1.1, 1.92, 11]);
      pe.wall(bronze ? 'rgba(220,180,90,0.5)' : 'rgba(60,54,46,0.4)', -2, 2, 3.02, 2.6, 3.4);
      pe.lines('rgba(40,36,30,0.55)', 0.25, [-1.4, 3.03, 3, 1.4, 3.03, 3]);
      // weathering streaks + moss on the pedestal
      pe.lines(bronze ? 'rgba(40,90,70,0.5)' : 'rgba(70,64,54,0.3)', 0.6, [-2.4, 3.02, 4.6, -2.4, 3.02, 2.4, 2.1, 3.02, 4.6, 2.2, 3.02, 3]);
      const r = rng(9, 1); clump(pe, -3.2, 3.4, 1.4, 1.1, r); clump(pe, 3.4, 2.8, 0.8, 0.9, r); clump(pe, -2.6, -1.8, 5.5, 0.8, r);
    }));
    return { r: 6, h: 23, parts, style: 'prop', bevel: 0.6 };
  };

  /* gravestone, opt.v 0 rounded headstone · 1 ringed cross · 2 leaning cracked slab · 3 wooden cross on a fresh mound */
  M.prop_gravestone = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), v = (((opt.v | 0) % 4) + 4) % 4;
    const gS = mx(p.s, '#8e8c86', 0.5), gT = mx(p.b, '#cfccc2', 0.45), w = woodOf(p);
    const parts = [stain(5, 3.8, 0.26, '#2a2216', 0, 1)];
    // grave mound
    parts.push({ z0: 0, z1: v === 3 ? 1.4 : 0.7, side: v === 3 ? '#5a4632' : '#56663a', top: v === 3 ? '#7a6248' : '#6e8044', ao: 0.25, bevel: false, shape: (c, zt) => S.ell(c, 0, 2, 2.1 * (1 - zt * 0.4), 3.1 * (1 - zt * 0.3), 0) });
    let H = 7;
    if (v === 0) {
      const prof = [-2.2, 0, 2.2, 0, 2.2, 4.4]; for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; prof.push(Math.cos(a) * 2.2, 4.4 + Math.sin(a) * 2.2); } prof.push(-2.2, 4.4);
      parts.push(xzPart([prof], 0, 6.6, gS, gT, { oy: -1.2, v0: -0.6, v1: 0.6 }, { ao: 0.3 }));
      parts.push(layer((pe) => { const y = -0.58; pe.lines('rgba(50,46,40,0.6)', 0.35, [0, y, 2.6, 0, y, 5.4, -1, y, 4.5, 1, y, 4.5]); pe.lines('rgba(50,46,40,0.45)', 0.25, [-1.3, y, 1.7, 1.3, y, 1.7, -1, y, 1.1, 1, y, 1.1]); clump(pe, 1.6, y, 0.4, 0.8, rng(1, 1)); }));
    } else if (v === 1) {
      const bar = (u0, z0, u1, z1) => [u0, z0, u1, z0, u1, z1, u0, z1];
      parts.push(xzPart([bar(-0.75, 0, 0.75, 8.2), bar(-2.6, 5, 2.6, 6.4), ...ringQuads(0, 5.7, 1.4, 2, 10)], 0, 8.2, gS, gT, { oy: -1.2, v0: -0.55, v1: 0.55 }, { ao: 0.3 }));
      parts.push(box(0, -1.2, 2.6, 1.8, 0, 1, sh(gS, -0.1), gT, { bevel: false }));
      parts.push(layer((pe) => { const y = -0.63; pe.lines('rgba(50,46,40,0.45)', 0.25, [0, y, 1.5, 0, y, 4.4, -1.8, y, 5.7, 1.8, y, 5.7]); clump(pe, -0.9, y + 0.3, 0.6, 0.9, rng(2, 1)); }));
      H = 8.6;
    } else if (v === 2) {
      // leaning slab with a broken corner
      const lean = 0.35;
      parts.push({ z0: 0, z1: 5.6, side: gS, top: gT, ao: 0.3, shape: (c, zt) => { const z = zt * 5.6; let pts = [-2, -1.6 + z * lean - 0.5, 2, -1.6 + z * lean - 0.5, 2, -1.6 + z * lean + 0.5, -2, -1.6 + z * lean + 0.5]; if (z > 4) pts = clipHalf(pts, -1, -0.5, -2 + (z - 4) * 1.4 - 0.5 * (-1.6 + z * lean)); polyOK(c, pts); } });
      parts.push(layer((pe) => { const y = -1.6 + 0.5; pe.lines('rgba(40,36,30,0.6)', 0.3, [-1.2, y + 1, 1.4, 0.2, y + 1.6, 3.6, 0.2, y + 1.6, 3.6, 1.2, y + 1.9, 4.1]); clump(pe, -1.8, y + 0.4, 0.5, 1, rng(3, 1)); clump(pe, 1.6, y + 0.4, 0.3, 0.8, rng(4, 1)); }));
      parts.push({ z0: 0, z1: 0.7, side: gS, top: gT, ao: 0.2, shape: (c) => S.poly(c, tf([-1, -0.6, 1, -0.4, 0.8, 0.6, -0.9, 0.5], 2.8, 1.6, 0.6)) });
      H = 6;
    } else {
      parts.push(box(0, -1, 0.7, 0.7, 0, 6.4, w.d, w.s, { ao: 0.25 }));
      parts.push(box(0, -1, 4, 0.6, 4.2, 4.9, w.d, w.t, { bevel: false }));
      parts.push(layer((pe) => { pe.lines('rgba(220,210,180,0.7)', 0.25, [-0.1, -0.68, 4.2, 0.2, -0.68, 3.6, 0.2, -0.68, 3.6, -0.2, -0.68, 3.2]); for (let i = 0; i < 4; i++) pe.dot(['#e85a6a', '#f2e24a', '#f0f0f0', '#a86ad8'][i], -0.8 + i * 0.55, 2.6 + (i % 2) * 0.4, 1.5, 0.32); pe.lines('#4a7a32', 0.25, [-0.8, 2.6, 1.4, -0.4, 3.2, 1.2]); }));
    }
    return { r: 5, h: H, parts, style: 'prop', bevel: 0.6 };
  };

  /* faction banner: stone cairn, pole, gold finial and a fluttering flag in pal.k / pal.k2 (anims 4) */
  M.prop_banner = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), HP = opt.h || 18;
    const parts = [stain(6, 4.4, 0.26, '#2a2216', 0, 1)];
    const cairn = [{ x: -1, y: -0.4, r: 1.6, h: 1.6, seed: 1, n: 7, moss: 0.3 }, { x: 1.2, y: 0.2, r: 1.5, h: 1.4, seed: 2, n: 7, moss: 0 }, { x: 0, y: 1.3, r: 1.4, h: 1.3, seed: 3, n: 7, moss: 0.4 }];
    parts.push(rockPart(cairn, '#7a766e', '#b2aea2'));
    parts.push(cyl(0, 0, 0.5, 0, HP, sh(p.w, -0.25), sh(p.w, 0.2), { ao: 0.25, bevel: false }));
    parts.push(beams([[0, 0, HP - 0.6, 6.4, 0, HP - 0.6]], 0.42, sh(p.w, -0.25), sh(p.w, 0.2)));
    parts.push(cyl(0, 0, 0.85, HP, HP + 1.3, '#a8823a', '#f2d47a', { ao: 0.1, bevel: false }));
    parts.push(layer((pe) => paintMoss(pe, cairn, 3, { cracks: false, size: 0.8 })));
    // hanging banner from the crossbar: k field, k2 border and emblem, swallowtail, sways per frame
    parts.push(layer((pe, a) => {
      const c = pe.c, ph = a * TAU, N = 8, top = HP - 0.8, len = 9.2;
      const sway = (t) => Math.sin(ph - t * 2.2) * 0.9 * t;
      const L = [], R = [];
      for (let i = 0; i <= N; i++) { const t = i / N; L.push([0.5 + sway(t) * 0.6, 0.3, top - t * len]); R.push([6 + sway(t) * 1.1, 0.3, top - t * len - Math.sin(ph - t * 2.2) * 0.25 * t]); }
      const out = []; for (const q of L) out.push(q[0], q[1], q[2]); out.push((L[N][0] + R[N][0]) / 2, 0.3, top - len + 1.6); for (let i = N; i >= 0; i--) out.push(R[i][0], R[i][1], R[i][2]);
      pe.poly(p.k, out);
      c.save(); c.beginPath(); pe.path(out); c.clip();
      for (let i = 0; i < N; i++) { const s = Math.cos(ph - ((i + 0.5) / N) * 2.2); pe.poly(s > 0 ? 'rgba(255,255,255,' + (0.14 * s).toFixed(3) + ')' : 'rgba(0,0,0,' + (-0.22 * s).toFixed(3) + ')', [L[i][0] - 1, 0.3, L[i][2], R[i][0] + 1, 0.3, R[i][2], R[i + 1][0] + 1, 0.3, R[i + 1][2], L[i + 1][0] - 1, 0.3, L[i + 1][2]]); }
      c.restore();
      c.beginPath(); pe.path(out); c.strokeStyle = p.k2; c.lineWidth = 0.5; c.stroke();
      // emblem: a k2 chevron and disc
      const mI = 3, m = [(L[mI][0] + R[mI][0]) / 2, 0.32, L[mI][2]];
      pe.dot(p.k2, m[0], m[1], m[2] - 0.4, 1.2);
      pe.lines(p.k2, 0.55, [m[0] - 2, m[1], m[2] - 3.4, m[0], m[1], m[2] - 2.2, m[0], m[1], m[2] - 2.2, m[0] + 2, m[1], m[2] - 3.4]);
      pe.lines(al(sh(p.k, -0.6), 0.8), 0.3, [0.4, 0.3, top + 0.1, 6.2, 0.3, top + 0.1]);
    }));
    return { r: 7, h: HP + 1.6, parts, style: 'prop', bevel: 0.6 };
  };

  /* wooden fence segment, 16 directions, 24 long along x */
  M.prop_fence = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), w = woodOf(p), r = rng(opt.seed || 1, 7);
    const posts = [-11.4, -3.8, 3.8, 11.4].map((x) => [x + r.range(-0.3, 0.3), r.range(-0.2, 0.2), 5.6 + r.range(-0.4, 0.5)]);
    const parts = [];
    parts.push({ z0: 0, z1: 6.4, side: w.d, top: w.t, ao: 0.3, shape: (c, zt) => { const z = zt * 6.4; for (const q of posts) { if (z > q[2]) continue; const k = z > q[2] - 0.8 ? 1 - (z - (q[2] - 0.8)) * 0.6 : 1; c.rect(q[0] - 0.6 * k, q[1] - 0.6 * k, 1.2 * k, 1.2 * k); } } });
    const rails = [];
    for (let i = 0; i < 3; i++) { const a = posts[i], b = posts[i + 1]; rails.push([a[0], a[1] + 0.5, 2.2 + r.range(-0.2, 0.2), b[0], b[1] + 0.5, 2.2 + r.range(-0.2, 0.2)]); rails.push([a[0], a[1] + 0.5, 4.4 + r.range(-0.2, 0.2), b[0], b[1] + 0.5, 4.4 + r.range(-0.3, 0.1)]); }
    parts.push(beams(rails, 0.75, w.s, w.l, { ao: 0.15 }));
    return { r: 13, h: 6.6, parts, style: 'prop', bevel: 0.6 };
  };

  /* wooden cart with gold sacks, 16 directions, ~18 long, +x forward (shafts for a horse) */
  M.prop_cart = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), w = woodOf(p), wl = mx(p.w, '#a07a50', 0.35), GOLD = '#e8b84a';
    const parts = [];
    const WX = -1.6, WR = 3.3, WZ = 3.3, WY = 4.7;
    const wheel = () => { const q = ringQuads(WX, WZ, WR - 0.65, WR, 14); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; q.push(barUZ(WX - Math.cos(a) * (WR - 0.4), WZ - Math.sin(a) * (WR - 0.4), WX + Math.cos(a) * (WR - 0.4), WZ + Math.sin(a) * (WR - 0.4), 0.42)); } const hub = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; hub.push(WX + Math.cos(a) * 0.8, WZ + Math.sin(a) * 0.8); } q.push(hub); return q; };
    parts.push(xzPart(wheel(), 0, WZ + WR, w.d, w.t, { oy: -WY, v0: -0.4, v1: 0.4 }, { ao: 0.15, bevel: false }));
    parts.push(beams([[WX, -WY, WZ, WX, WY, WZ]], 0.7, w.d, w.s));
    parts.push(beams([[3.6, 2.6, 4.1, 11.2, 2.3, 3.4], [3.6, -2.6, 4.1, 11.2, -2.3, 3.4], [8.6, -2.4, 3.6, 8.6, 2.4, 3.6]], 0.55, w.d, w.l));
    parts.push(box(-1.4, 0, 11.4, 7.8, 3.4, 4.3, w.d, wl, { ao: 0.2 }));
    parts.push({ z0: 4.3, z1: 6.8, side: w.s, top: w.l, stroke: 0.6, ao: 0.25, bevel: false, shape: (c) => c.rect(-6.8, -3.6, 10.8, 7.2) });
    // goods: sacks, an open sack of gold, a small chest
    parts.push({ z0: 4.3, z1: 8.6, side: '#a89070', top: '#d8c4a0', ao: 0.35, shape: (c, zt) => { const k = 1 - zt * zt * 0.55; S.blob(c, -4.4, -1.4, 1.9 * k, 3, 8, 0.2); S.blob(c, -4.6, 1.6, 1.8 * k, 5, 8, 0.2); if (zt < 0.8) S.blob(c, -1.4, 1.5, 1.8 * k, 7, 8, 0.2); },
      detail: (c) => { S.lines(c, 'rgba(90,70,40,0.6)', 0.3, [-5, -1.4, -3.8, -1.4]); S.dot(c, '#8a7050', -4.6, 1.6, 0.4); } });
    parts.push({ z0: 7.2, z1: 8.2, side: '#b08a2a', top: GOLD, ao: 0.2, bevel: false, shape: (c, zt) => S.circ(c, -1.4, 1.5, 1.3 * (1 - zt * 0.5)),
      detail: (c) => { for (const q of [[-1.8, 1.2], [-1, 1.8], [-1.3, 1], [-0.9, 1.3]]) S.dot(c, '#fff0a8', q[0], q[1], 0.25); } });
    parts.push(box(1.4, -1.2, 3.2, 2.6, 4.3, 6.6, '#6a3e22', '#9a6034', { ao: 0.2, detail: (c) => { S.lines(c, '#3a3634', 0.4, [-0.1, -2.5, -0.1, 0.1, 2.9, -2.5, 2.9, 0.1]); S.dot(c, GOLD, 1.4, -1.2, 0.35); } }));
    parts.push(xzPart(wheel(), 0, WZ + WR, w.d, w.t, { oy: WY, v0: -0.4, v1: 0.4 }, { ao: 0.15, bevel: false }));
    return { r: 12, h: 9, parts, style: 'prop', bevel: 0.6 };
  };

  /* ================================================================ gallery */
  (AS.Gallery = AS.Gallery || []).push({ group: 'Neutral sites', bg: 'neutral', items: [
    { name: 'gold mine', gen: 'site_goldmine', pal: 'neutral' },
    { name: 'cottage v0', gen: 'site_cottage', pal: 'neutral', opt: { v: 0 } },
    { name: 'cottage v1', gen: 'site_cottage', pal: 'neutral', opt: { v: 1 } },
    { name: 'cottage v2', gen: 'site_cottage', pal: 'neutral', opt: { v: 2 } },
    { name: 'cottage v3', gen: 'site_cottage', pal: 'neutral', opt: { v: 3 } },
    { name: 'well', gen: 'site_well', pal: 'neutral' },
    { name: 'village hall', gen: 'site_villagehall', pal: 'neutral' },
    { name: 'windmill', gen: 'site_windmill', pal: 'neutral', anims: 4 },
    { name: 'ruins', gen: 'site_ruins', pal: 'neutral' },
    { name: 'wizard tower', gen: 'site_wizardtower', pal: 'neutral', anims: 4 },
    { name: 'magic well', gen: 'site_magicwell', pal: 'neutral', anims: 4 },
    { name: 'fort', gen: 'site_fort', pal: 'neutral' },
    { name: 'bridge', gen: 'site_bridge', pal: 'neutral', dirs: 16 },
    { name: 'shrine', gen: 'site_shrine', pal: 'neutral', anims: 4 },
    { name: 'cave', gen: 'site_cave', pal: 'neutral' },
    { name: 'dragon nest', gen: 'site_nest', pal: 'neutral' },
    { name: 'trade post', gen: 'site_tradepost', pal: 'neutral' },
    { name: 'old watchtower', gen: 'site_oldwatch', pal: 'neutral' },
    { name: 'castle ruin', gen: 'site_castle', pal: 'neutral' },
    { name: 'mana crystal', gen: 'site_crystal', pal: 'neutral', anims: 4 },
    { name: 'relic altar', gen: 'site_relic', pal: 'neutral', anims: 4 },
    { name: 'waygate', gen: 'site_waygate', pal: 'neutral', anims: 4 },
    { name: 'enchanted grove', gen: 'site_grove', pal: 'neutral', anims: 4 },
    { name: 'treasure chest', gen: 'site_chest', pal: 'neutral' },
  ] }, { group: 'Props', bg: 'neutral', items: [
    { name: 'haystack', gen: 'prop_haystack', pal: 'neutral' },
    { name: 'crates', gen: 'prop_crates', pal: 'neutral' },
    { name: 'barrels', gen: 'prop_barrels', pal: 'neutral' },
    { name: 'logs', gen: 'prop_logs', pal: 'neutral' },
    { name: 'stall v0', gen: 'prop_stall', pal: 'neutral', opt: { v: 0 } },
    { name: 'stall v1', gen: 'prop_stall', pal: 'neutral', opt: { v: 1 } },
    { name: 'tent', gen: 'prop_tent', pal: 'neutral' },
    { name: 'campfire', gen: 'prop_campfire', pal: 'neutral', anims: 4 },
    { name: 'signpost', gen: 'prop_signpost', pal: 'neutral' },
    { name: 'statue', gen: 'prop_statue', pal: 'neutral' },
    { name: 'statue bronze', gen: 'prop_statue', pal: 'neutral', opt: { v: 1 } },
    { name: 'gravestone v0', gen: 'prop_gravestone', pal: 'neutral', opt: { v: 0 } },
    { name: 'gravestone v1', gen: 'prop_gravestone', pal: 'neutral', opt: { v: 1 } },
    { name: 'gravestone v2', gen: 'prop_gravestone', pal: 'neutral', opt: { v: 2 } },
    { name: 'gravestone v3', gen: 'prop_gravestone', pal: 'neutral', opt: { v: 3 } },
    { name: 'banner neutral', gen: 'prop_banner', pal: 'neutral', anims: 4 },
    { name: 'banner human', gen: 'prop_banner', pal: 'human', anims: 4 },
    { name: 'banner elf', gen: 'prop_banner', pal: 'elf', anims: 4 },
    { name: 'banner undead', gen: 'prop_banner', pal: 'undead', anims: 4 },
    { name: 'fence', gen: 'prop_fence', pal: 'neutral', dirs: 16 },
    { name: 'cart', gen: 'prop_cart', pal: 'neutral', dirs: 16 },
  ] });
})(window.AS);
