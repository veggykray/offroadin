/* WYRMCROWN — Undead faction architecture (Dominion of Morgrave).
 * Black stone (pal.a / pal.d), gothic spiked roofs (pal.t), broken and patched
 * masonry, bone ornaments and skulls (pal.s), iron spikes, sickly green (pal.g)
 * and purple (pal.k) glows. The undead ground is dark earth, so every model keeps
 * lit stone tops, bone trim and flat glows to pop off it.
 * Object space: +x right, +y toward the camera (front walls face +y), z up.
 * Buildings are 1-direction sheets authored back-to-front. Walls, gates and the
 * siege engines are multi-direction sheets and use a per-heading depth sorter.
 * Generators (AS.Models): undead_keep (level 1-3), undead_house (v 0-3),
 * undead_barracks, undead_farm, undead_stable, undead_magetower, undead_tower,
 * undead_ballista, undead_catapult, undead_wall (level 1-3), undead_gate (level 1-3),
 * undead_watchtower, undead_temple, undead_market, undead_workshop,
 * undead_wardstone, undead_roost. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});
  const PI = Math.PI;

  /* ================================================================ palette */
  const DEF = { a: '#3b3741', b: '#6d6773', t: '#2b2532', g: '#93ff6a', d: '#141219', k: '#5c2a6c', k2: '#b0ff8a', w: '#3a3028', s: '#d8cfb6', skin: '#b8c4a8' };
  const okCol = (v) => typeof v === 'string' && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v);
  function P(p) { const o = {}; for (const k in DEF) o[k] = p && okCol(p[k]) ? p[k] : DEF[k]; return o; }
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const cs = (c, a) => C.str(c, a);
  /* material set derived from the palette (never hard-coded faction colours) */
  function mats(pal) {
    const p = P(pal);
    return {
      p,
      wall: mx(p.a, p.b, 0.1), wallT: mx(p.a, p.b, 0.9), wallD: mx(p.a, p.d, 0.4),
      trim: mx(p.b, p.s, 0.4), trimS: mx(p.a, p.b, 0.6),
      corn: mx(p.s, p.a, 0.5), cornT: mx(p.s, p.b, 0.3),
      patch: mx(p.a, p.b, 0.4),
      roofL: mx(mx(p.t, p.b, 0.85), p.k, 0.2), roofS: mx(p.t, p.k, 0.1), roofLn: mx(p.t, p.d, 0.6),
      roofM: mx(mx(mx(p.t, p.b, 0.85), p.k, 0.2), mx(p.t, p.k, 0.1), 0.35),
      bone: p.s, boneS: mx(p.s, p.a, 0.42), boneT: mx(p.s, '#ffffff', 0.25),
      iron: mx(p.d, p.a, 0.45), ironT: mx(p.b, '#c4c8d2', 0.35),
      wood: p.w, woodT: mx(p.w, p.s, 0.3), woodD: mx(p.w, p.d, 0.4),
      glow: p.g, glowT: mx(p.g, '#ffffff', 0.55), glowS: mx(p.g, p.d, 0.25),
      vio: mx(p.k, '#e4aaff', 0.6), vioT: mx(p.k, '#ffffff', 0.8),
      ban: p.k, banT: mx(p.k, '#ffffff', 0.15), banS: mx(p.k, p.d, 0.35), ban2: p.k2,
      floor: mx(p.a, p.d, 0.3), floorT: mx(p.a, p.b, 0.3),
      dark: p.d, void: mx(p.d, '#000000', 0.35),
      earth: mx(p.w, p.d, 0.25), earthT: mx(p.w, p.b, 0.3),
    };
  }
  const SEAM = 'rgba(8,6,12,0.5)', SEAM2 = 'rgba(8,6,12,0.32)';

  /* ================================================================ geometry */
  const res = () => (AS.Forge && AS.Forge.res) || 2;
  const dzOf = (z0, z1) => (z1 - z0) / Math.max(1, Math.round((z1 - z0) * res()));
  const ngon = (n, r, rot, cx, cy, sx, sy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r * (sx || 1), (cy || 0) + Math.sin(t) * r * (sy || 1)); } return a; };
  const rectP = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  // rectangle with a rectangular hole (nonzero winding: inner path reversed)
  function frame(c, x0, y0, x1, y1, t) { c.rect(x0, y0, x1 - x0, y1 - y0); c.moveTo(x0 + t, y0 + t); c.lineTo(x0 + t, y1 - t); c.lineTo(x1 - t, y1 - t); c.lineTo(x1 - t, y0 + t); c.closePath(); }
  function annulus(c, x, y, r1, r2) { c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU); c.moveTo(x + r2, y); c.arc(x, y, r2, TAU, 0, true); }
  // screen-left (-1, lit) or screen-right (+1, shaded) half of a disc, whatever the sheet heading
  function halfDisc(c, x, y, r, side) {
    const hd = headingOf(c), th = Math.atan2(Math.sin(hd), -Math.cos(hd)), a0 = side < 0 ? th - PI / 2 : th + PI / 2;
    c.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.arc(x, y, r, a0, a0 + PI); c.closePath();
  }
  // screen-space normal of an object-space direction at the current heading
  const scrN = (c, nx, ny) => { const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a); return [nx * ca - ny * sa, nx * sa + ny * ca]; };
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  // which y face looks at the camera at this heading: +1, -1 or 0 (edge-on)
  const faceY = (c) => { const k = Math.cos(headingOf(c)); return k > 0.12 ? 1 : k < -0.12 ? -1 : 0; };
  /* Depth sorter for rotating sheets: first part re-orders the rest per heading by
   * `layer`, then by the screen depth of each part's anchor `at`. */
  function withSorter(parts) {
    const all = [null].concat(parts);
    all[0] = { z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: (c) => {
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
      const rest = all.slice(1).map((p, i) => ({ p, i, l: p.layer || 0, d: p.at ? p.at[0] * sa + (p.atAuto ? Math.abs(p.at[1] * ca) : p.at[1] * ca) : 0 }));
      rest.sort((A, B) => (A.l - B.l) || (A.d - B.d) || (A.i - B.i));
      for (let i = 0; i < rest.length; i++) all[i + 1] = rest[i].p;
    } };
    return all;
  }
  const at = (part, x, y, layer) => { part.at = [x, y]; if (layer) part.layer = layer; return part; };
  // anchor for camera-facing decorations / symmetric parts: depth mirrored to the visible side
  const atA = (part, x, y) => { part.at = [x, y]; part.atAuto = true; return part; };

  /* x-extent of a convex (x, z) polygon inside the z band [za, zb] */
  function bandX(pts, za, zb) {
    let lo = Infinity, hi = -Infinity;
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2], z0 = pts[i * 2 + 1], j = (i + 1) % n, x1 = pts[j * 2], z1 = pts[j * 2 + 1];
      if (z0 >= za && z0 <= zb) { if (x0 < lo) lo = x0; if (x0 > hi) hi = x0; }
      if ((z0 - za) * (z1 - za) < 0) { const x = x0 + (x1 - x0) * (za - z0) / (z1 - z0); if (x < lo) lo = x; if (x > hi) hi = x; }
      if ((z0 - zb) * (z1 - zb) < 0) { const x = x0 + (x1 - x0) * (zb - z0) / (z1 - z0); if (x < lo) lo = x; if (x > hi) hi = x; }
    }
    return lo <= hi ? [lo, hi] : null;
  }
  /* Elevation part: convex polygons drawn in the x-z plane (a facade, gable,
   * skull, window, flag...) extruded through y in [y0, y1]. Entries may be flat
   * arrays or { p, y0, y1 }. polys may be a function(anim). ex.auto mirrors the
   * slab to whichever y face looks at the camera (rotating sheets). */
  function elev(polys, y0, y1, side, top, ex) {
    ex = ex || {};
    const fn = typeof polys === 'function' ? polys : null;
    let zl = Infinity, zh = -Infinity;
    const scan = (ps) => { for (const q of ps) { const pts = q.p || q; for (let i = 1; i < pts.length; i += 2) { if (pts[i] < zl) zl = pts[i]; if (pts[i] > zh) zh = pts[i]; } } };
    if (fn) { for (let a = 0; a < 1; a += 0.125) scan(fn(a)); } else scan(polys);
    if (!isFinite(zl)) { zl = 0; zh = 0.1; }
    const z0 = ex.z0 !== undefined ? ex.z0 : zl, z1 = ex.z1 !== undefined ? ex.z1 : zh, dz = dzOf(z0, z1), auto = ex.auto;
    const part = { z0, z1, side, top: top || side, bevel: false, ao: 0.12, shape: (c, zt, an) => {
      const z = z0 + zt * (z1 - z0), ps = fn ? fn(an) : polys;
      let flip = 1;
      if (auto) { flip = faceY(c); if (!flip) return; }
      for (const q of ps) {
        const iv = bandX(q.p || q, z - dz * 0.55, z + dz * 0.55);
        if (!iv) continue;
        let ya = q.p ? q.y0 : y0, yb = q.p ? q.y1 : y1;
        if (flip < 0) { const t = ya; ya = -yb; yb = -t; }
        c.rect(iv[0], ya, Math.max(0.06, iv[1] - iv[0]), yb - ya);
      }
    } };
    for (const k in ex) if (k !== 'z0' && k !== 'z1' && k !== 'auto') part[k] = ex[k];
    return part;
  }
  // x-z polygon shorthands
  const lancet = (x, zb, w, h, k) => { const t = Math.min(h * 0.9, w * (k || 0.8)); return [x - w / 2, zb, x + w / 2, zb, x + w / 2, zb + h - t, x + w * 0.3, zb + h - t * 0.35, x, zb + h, x - w * 0.3, zb + h - t * 0.35, x - w / 2, zb + h - t]; };
  const archP = (x, zb, w, h) => { const r = w / 2, s = zb + h - r, a = []; a.push(x - r, zb, x + r, zb); for (let i = 0; i <= 6; i++) { const t = (i / 6) * PI; a.push(x + Math.cos(t) * r, s + Math.sin(t) * r); } return a; };
  const rectXZ = (x0, z0, x1, z1) => [x0, z0, x1, z0, x1, z1, x0, z1];
  const diamond = (x, z, r, rz) => [x, z - (rz || r), x + r, z, x, z + (rz || r), x - r, z];
  const triXZ = (x0, x1, zb, zt, xa) => [x0, zb, x1, zb, xa === undefined ? (x0 + x1) / 2 : xa, zt];
  // skull face in the x-z plane: cranium + jaw (bone); eyes / nose for a second part
  const skullP = (x, z, r) => [ngon(8, r, PI / 8, x, z + r * 0.18), [x - r * 0.52, z - r * 0.92, x + r * 0.52, z - r * 0.92, x + r * 0.66, z - r * 0.25, x - r * 0.66, z - r * 0.25]];
  const skullEyes = (x, z, r) => [diamond(x - r * 0.36, z + r * 0.06, r * 0.24, r * 0.27), diamond(x + r * 0.36, z + r * 0.06, r * 0.24, r * 0.27), [x - r * 0.12, z - r * 0.42, x + r * 0.12, z - r * 0.42, x, z - r * 0.18]];

  /* ================================================================ builders */
  const box = (x0, y0, x1, y1, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => c.rect(x0, y0, x1 - x0, y1 - y0) }, ex || {});
  const polyPart = (pts, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => S.poly(c, pts) }, ex || {});
  // cylinders: list of [x, y, r, (z0), (z1)] (per-item heights share one part)
  function drums(list, z0, z1, side, top, ex) {
    let zl = z0, zh = z1;
    for (const q of list) { if (q[3] !== undefined) zl = Math.min(zl, q[3]); if (q[4] !== undefined) zh = Math.max(zh, q[4]); }
    return Object.assign({ z0: zl, z1: zh, side, top, shape: (c, zt) => {
      const z = zl + zt * (zh - zl);
      for (const q of list) { const a = q[3] !== undefined ? q[3] : z0, b = q[4] !== undefined ? q[4] : z1; if (z >= a - 0.01 && z <= b + 0.01) S.circ(c, q[0], q[1], q[2]); }
    } }, ex || {});
  }
  // cones split into a lit left and a shaded right half: list [x, y, r, (z0), (h)]; pw = profile exponent
  function cones(list, z0, h, lit, shade, ex) {
    ex = ex || {};
    const pw = ex.pw || 1.25, tip = ex.tip || 0.12;
    let zl = z0, zh = z0 + h;
    for (const q of list) { const a = q[3] !== undefined ? q[3] : z0, b = a + (q[4] !== undefined ? q[4] : h); zl = Math.min(zl, a); zh = Math.max(zh, b); }
    const mk = (sd, col) => Object.assign({ z0: zl, z1: zh, side: col, top: sd < 0 ? sh(lit, 0.2) : lit, ao: 0.2, bevel: false,
      shape: (c, zt) => {
        const z = zl + zt * (zh - zl);
        for (const q of list) {
          const a = q[3] !== undefined ? q[3] : z0, hh = q[4] !== undefined ? q[4] : h, u = (z - a) / hh;
          if (u < -0.01 || u > 1.01) continue;
          halfDisc(c, q[0], q[1], q[2] * Math.pow(1 - U.clamp(u, 0, 1), pw) + tip, sd);
        }
      } }, ex.extra || {});
    return [mk(-1, lit), mk(1, shade)];
  }
  // rectangular spire split left / right: list [x, y, hw, hd]
  function pyramids(list, z0, h, lit, shade, ex) {
    ex = ex || {};
    const pw = ex.pw || 1.15;
    const mk = (sd, col) => Object.assign({ z0, z1: z0 + h, side: col, top: sd < 0 ? sh(lit, 0.2) : lit, ao: 0.18, bevel: false,
      shape: (c, zt) => { const k = Math.pow(1 - zt, pw); for (const q of list) { const w = q[2] * k + 0.12, d = q[3] * k + 0.12; c.rect(sd < 0 ? q[0] - w : q[0], q[1] - d, w, d * 2); } } }, ex.extra || {});
    return [mk(-1, lit), mk(1, shade)];
  }
  /* Gabled roof: ridge along o.axis ('x' | 'y') over a rectangle centred (x, y),
   * half length L along the ridge, half width W across, rising h from z0.
   * hip (0..1) pulls the ridge ends in. Returns [lit, shade] parts:
   * axis 'x' → back plane then front plane; axis 'y' → left plane then right plane. */
  function gable(o) {
    const hip = o.hip || 0;
    // part 0 (lit colour) draws the half facing away from the camera, part 1 (shade) the camera-facing half
    const mk = (part, col, top) => ({ z0: o.z0, z1: o.z0 + o.h, side: col, top, ao: o.ao !== undefined ? o.ao : 0.16, bevel: false,
      shape: (c, zt) => {
        const w = Math.max(o.ridge ? 0.6 : 0.35, o.W * (1 - zt)), l = Math.max(0.4, o.L - hip * o.W * zt);
        const n = scrN(c, o.axis === 'x' ? 0 : 1, o.axis === 'x' ? 1 : 0);
        const key = Math.abs(n[1]) > 0.05 ? n[1] : n[0];
        const half = (part === 1) === (key > 0) ? 1 : -1; // +1: the +y (axis x) / +x (axis y) half
        if (o.axis === 'x') c.rect(o.x - l, half < 0 ? o.y - w : o.y, 2 * l, w); else c.rect(half < 0 ? o.x - w : o.x, o.y - l, w, 2 * l);
      } });
    return [mk(0, o.lit, o.ridge || sh(o.lit, 0.15)), mk(1, o.shade, o.ridge || o.lit)];
  }
  /* Hipped roof / pyramid spire over a rectangle centred (x, y) with half sizes L (x)
   * and W (y), rising h from z0 (pw > 1 gives a concave gothic spire). Three facet
   * parts: back + left (lit), front (mid), right (shade). */
  function hipSlice(o, zt) {
    const m0 = Math.min(o.L, o.W), d = m0 * (1 - Math.pow(1 - zt, o.pw || 1)), l = Math.max(0.3, o.L - d), w = Math.max(0.3, o.W - d);
    const x0 = o.x - l, x1 = o.x + l, y0 = o.y - w, y1 = o.y + w;
    const A = l >= w ? [o.x - l + w, o.y] : [o.x, o.y - w + l], B = l >= w ? [o.x + l - w, o.y] : [o.x, o.y + w - l];
    return { x0, x1, y0, y1, A, B, l, w };
  }
  function hipSectors(q) {
    const A = q.A, B = q.B;
    if (q.l >= q.w) return [[0, -1, [q.x0, q.y0, q.x1, q.y0, B[0], B[1], A[0], A[1]]], [-1, 0, [q.x0, q.y0, A[0], A[1], q.x0, q.y1]], [0, 1, [q.x0, q.y1, A[0], A[1], B[0], B[1], q.x1, q.y1]], [1, 0, [q.x1, q.y0, q.x1, q.y1, B[0], B[1]]]];
    return [[0, -1, [q.x0, q.y0, q.x1, q.y0, A[0], A[1]]], [-1, 0, [q.x0, q.y0, A[0], A[1], B[0], B[1], q.x0, q.y1]], [0, 1, [q.x0, q.y1, B[0], B[1], q.x1, q.y1]], [1, 0, [q.x1, q.y0, q.x1, q.y1, B[0], B[1], A[0], A[1]]]];
  }
  // facet class at the current heading: 0 lit (faces the top-left light), 1 shade, 2 camera-facing (mid)
  function facetOf(c, nx, ny) { const n = scrN(c, nx, ny); if (n[1] > 0.38) return 2; return -0.8 * n[0] - 0.6 * n[1] > 0 ? 0 : 1; }
  function hipRoof(o) {
    const mk = (cls, col, top) => ({ z0: o.z0, z1: o.z0 + o.h, side: col, top, ao: o.ao !== undefined ? o.ao : 0.14, bevel: false, shape: (c, zt) => {
      for (const sct of hipSectors(hipSlice(o, zt))) if (facetOf(c, sct[0], sct[1]) === cls) S.poly(c, sct[2]);
    } });
    // drawn lit, shade, then the camera-facing facet last
    return [mk(0, o.lit, o.ridge || sh(o.lit, 0.15)), mk(1, o.shade, o.ridge || o.lit), mk(2, o.mid || mx(o.lit, o.shade, 0.3), o.ridge || o.lit)];
  }
  /* course lines on every facet of a hipRoof() + (optional) bone hip ridges */
  function hipLines(o, col, step) {
    step = step || 2.2;
    const dz = dzOf(0, o.h);
    return { z0: o.z0, z1: o.z0 + o.h * 0.9, side: col, top: col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = zt * o.h * 0.9, row = Math.floor(z / step);
      if (row === Math.floor((z - dz) / step) || z < 0.4) return;
      const q = hipSlice(o, z / o.h);
      frame(c, q.x0 - 0.15, q.y0 - 0.15, q.x1 + 0.15, q.y1 + 0.15, 0.5);
    } };
  }
  function hipRidges(o, side, top, wd) {
    wd = wd || 0.5;
    return { z0: o.z0, z1: o.z0 + o.h, side, top, bevel: false, ao: 0.1, shape: (c, zt) => {
      const q = hipSlice(o, zt), r = wd, back = o.h < Math.min(o.L, o.W) * 0.9;
      for (const p of back ? [[q.x0, q.y1], [q.x1, q.y1], [q.x0, q.y0], [q.x1, q.y0]] : [[q.x0, q.y1], [q.x1, q.y1]]) c.rect(p[0] - r + (p[0] < o.x ? r * 0.6 : -r * 0.6), p[1] - r + (p[1] < o.y ? r * 0.6 : -r * 0.6), r * 2, r * 2);
      if (zt > 0.985) c.rect(Math.min(q.A[0], q.B[0]) - r, Math.min(q.A[1], q.B[1]) - r, Math.abs(q.B[0] - q.A[0]) + r * 2, Math.abs(q.B[1] - q.A[1]) + r * 2);
    } };
  }
  /* slate course lines (and staggered joints) painted on both planes of a gable() */
  function roofLines(o, col) {
    const hip = o.hip || 0, step = o.step || 2.4, z1 = o.h - 0.8, dz = dzOf(0, z1), jstep = o.joint || 3.2;
    return { z0: o.z0, z1: o.z0 + z1, side: col, top: col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = zt * z1, w = o.W * (1 - z / o.h), l = o.L - hip * o.W * z / o.h;
      const row = Math.floor(z / step), line = row !== Math.floor((z - dz) / step) && z > 0.4;
      if (o.axis === 'x') {
        if (line) { c.rect(o.x - l, o.y + w - 0.45, 2 * l, 0.6); c.rect(o.x - l, o.y - w - 0.15, 2 * l, 0.55); return; }
        for (let jx = -l + 1 + (row % 2) * jstep * 0.5; jx < l - 0.6; jx += jstep) c.rect(o.x + jx, o.y + w - 0.35, 0.32, 0.5);
      } else {
        if (line) { c.rect(o.x - w - 0.15, o.y - l, 0.55, 2 * l); c.rect(o.x + w - 0.4, o.y - l, 0.55, 2 * l); return; }
        for (let jy = -l + 1 + (row % 2) * jstep * 0.5; jy < l - 0.6; jy += jstep) { c.rect(o.x - w - 0.1, o.y + jy, 0.45, 0.3); c.rect(o.x + w - 0.35, o.y + jy, 0.45, 0.3); }
      }
    } };
  }
  /* broken hole in a roof plane (dark void with rafters showing through):
   * plane = 'front' (axis x), 'left' or 'right' (axis y); u = centre along the ridge,
   * zc / rz = height centre / half height, ru = half span */
  function roofHole(o, plane, u, zc, ru, rz, col) {
    const z0 = zc - rz, z1 = zc + rz;
    return { z0: o.z0 + z0, z1: o.z0 + z1, side: col, top: col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0), q = (z - zc) / rz, w = o.W * (1 - z / o.h);
      const hw = ru * Math.sqrt(Math.max(0, 1 - q * q)) * (0.8 + 0.3 * Math.sin(z * 2.7 + u));
      if (hw < 0.2) return;
      for (let s = -hw; s < hw; s += 2.2) {
        const a = s + 0.55, b = Math.min(hw, s + 2.2);
        if (b <= a) continue;
        if (plane === 'front') c.rect(o.x + u + a, o.y + w - 0.7, b - a, 0.9);
        else if (plane === 'left') c.rect(o.x - w - 0.2, o.y + u + a, 0.9, b - a);
        else c.rect(o.x + w - 0.7, o.y + u + a, 0.9, b - a);
      }
    } };
  }
  // pointed or spiky merlons along a rectangle's edges
  function merlonsRect(x0, y0, x1, y1, z0, h, size, gap, side, top, ex) {
    const pts = [];
    const run = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / (size + gap))); for (let i = 0; i <= n; i++) pts.push(ax + (bx - ax) * i / n, ay + (by - ay) * i / n); };
    run(x0, y0, x1, y0); run(x1, y0, x1, y1); run(x1, y1, x0, y1); run(x0, y1, x0, y0);
    return merlonsAt(pts, z0, h, size, side, top, ex);
  }
  function merlonsAt(pts, z0, h, size, side, top, ex) {
    const spike = !ex || ex.spike !== false;
    return Object.assign({ z0, z1: z0 + h, side, top, ao: 0.2, shape: (c, zt) => {
      const k = spike && zt > 0.45 ? Math.max(0.12, 1 - (zt - 0.45) / 0.55) : 1, s = size * k / 2;
      for (let i = 0; i < pts.length; i += 2) c.rect(pts[i] - s, pts[i + 1] - s, s * 2, s * 2);
    } }, ex || {});
  }
  function merlonsRing(cx, cy, r, n, z0, h, size, side, top, ex) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    return merlonsAt(pts, z0, h, size, side, top, ex);
  }
  // iron / bone spikes: list [x, y, r, leanX, leanY]
  const spikes = (list, z0, h, side, top, ex) => Object.assign({ z0, z1: z0 + h, side, top, bevel: false, ao: 0.2, shape: (c, zt) => {
    const k = Math.pow(1 - zt, 0.9);
    for (const q of list) S.circ(c, q[0] + (q[3] || 0) * zt * zt, q[1] + (q[4] || 0) * zt * zt, q[2] * k + 0.07);
  } }, ex || {});
  // per-item spike heights: list [x, y, r, leanX, leanY, z0, h]
  const spikeShape = (list) => function (c, zt) {
    const z = this.z0 + zt * (this.z1 - this.z0);
    for (const q of list) {
      const u = (z - q[5]) / q[6];
      if (u < -0.01 || u > 1.01) continue;
      const v = U.clamp(u, 0, 1), k = Math.pow(1 - v, 0.9);
      S.circ(c, q[0] + (q[3] || 0) * v * v, q[1] + (q[4] || 0) * v * v, q[2] * k + 0.07);
    }
  };
  // small window slits / lancets on the front arc of cylinders: [cx, cy, r, angle, zb, h, w]
  function arcWins(list, col, top, ex) {
    let zl = Infinity, zh = -Infinity;
    for (const q of list) { zl = Math.min(zl, q[4]); zh = Math.max(zh, q[4] + q[5]); }
    const dz = dzOf(zl, zh);
    return Object.assign({ z0: zl, z1: zh, side: col, top: top || col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = zl + zt * (zh - zl);
      for (const q of list) {
        const iv = bandX(lancet(0, q[4], q[6], q[5]), z - dz * 0.55, z + dz * 0.55);
        if (!iv) continue;
        const ca = Math.cos(q[3]), sa = Math.sin(q[3]), tx = -sa, ty = ca, R0 = q[2] - 0.15, R1 = q[2] + 0.45;
        const px = q[0] + ca * R0, py = q[1] + sa * R0, ox = q[0] + ca * R1, oy = q[1] + sa * R1;
        c.moveTo(px + tx * iv[0], py + ty * iv[0]); c.lineTo(px + tx * iv[1], py + ty * iv[1]); c.lineTo(ox + tx * iv[1], oy + ty * iv[1]); c.lineTo(ox + tx * iv[0], oy + ty * iv[0]); c.closePath();
      }
    } }, ex || {});
  }
  // braziers: list [x, y, h, r] → [stand + bowl, flame, core]
  function braziers(list, m, col) {
    col = col || m.glow;
    const top = Math.max.apply(null, list.map((q) => q[2]));
    const stand = { z0: 0, z1: top + 2, side: m.iron, top: m.dark, ao: 0.25, shape: (c, zt) => {
      const z = zt * (top + 2);
      for (const q of list) {
        const h = q[2], r = q[3] || 1.8;
        if (z > h + 2) continue;
        if (z < h) { const k = 0.25 + 0.75 * (1 - z / h); for (const a of [0.5, 2.6, 4.7]) S.circ(c, q[0] + Math.cos(a) * r * 0.55 * k, q[1] + Math.sin(a) * r * 0.55 * k, 0.32); }
        else S.circ(c, q[0], q[1], r * (0.55 + 0.45 * (z - h) / 2));
      }
    }, detail: (c) => { for (const q of list) { if (q[2] + 2 < top + 2 - 0.01) continue; S.dot(c, cs(col, 0.9), q[0], q[1], (q[3] || 1.8) * 0.8); } } };
    // flames sit on each bowl: shared part from the lowest bowl
    const zb = Math.min.apply(null, list.map((q) => q[2])) + 1.4, fh = 5.5 + (top - zb);
    const flame = (k, c1, c2) => ({ z0: zb, z1: zb + fh * k + 1, side: c1, top: c2, flat: true, bevel: false, ao: 0.3, shape: (c, zt, an) => {
      const z = zb + zt * (fh * k + 1);
      list.forEach((q, i) => {
        const base = q[2] + 1.4, hh = (5.5 * k) * (0.85 + 0.15 * Math.sin(an * TAU + i * 2.1)), u = (z - base) / hh;
        if (u < 0 || u > 1) return;
        const r = (q[3] || 1.8) * k * 0.95 * Math.pow(1 - u, 0.75) * (1 + 0.18 * Math.sin(u * 7 + an * TAU * 2 + i));
        const sway = Math.sin(an * TAU + i + u * 2.5) * 0.7 * u;
        S.circ(c, q[0] + sway, q[1], r + 0.1);
        if (u < 0.55 && k > 0.8) { S.circ(c, q[0] - r * 0.6 + sway * 0.6, q[1] + 0.2, r * 0.5 * (1 - u)); S.circ(c, q[0] + r * 0.62 + sway, q[1] - 0.2, r * 0.45 * (1 - u)); }
      });
    } });
    return [stand, flame(1, col, mx(col, '#ffffff', 0.4)), flame(0.55, mx(col, '#ffffff', 0.45), mx(col, '#ffffff', 0.8))];
  }
  /* hanging banners (gonfalons) on T-poles or flat against a wall:
   * list [x, y, zTop, w, len, pole(bool)] → parts [poles?, cloth, sigil] */
  function banners(list, m, ex) {
    ex = ex || {};
    const poles = list.filter((q) => q[5]);
    const out = [];
    if (poles.length) {
      const zt = Math.max.apply(null, poles.map((q) => q[2] + 2));
      out.push({ z0: 0, z1: zt, side: m.iron, top: m.ironT, ao: 0.3, bevel: false, shape: (c, t) => {
        const z = t * zt;
        for (const q of poles) {
          if (z > q[2] + 2) continue;
          S.circ(c, q[0], q[1] - 0.6, 0.42);
          if (z > q[2] - 0.5 && z < q[2] + 0.4) c.rect(q[0] - q[3] / 2 - 0.6, q[1] - 0.95, q[3] + 1.2, 0.7);
        }
      } });
      out.push(spikes(poles.map((q) => [q[0], q[1] - 0.6, 0.6]), zt - 2, 3, m.iron, m.boneT));
    }
    const cloth = (an) => list.map((q, i) => {
      const s = Math.sin(an * TAU + i * 1.7) * 0.55, x0 = q[0] - q[3] / 2, x1 = q[0] + q[3] / 2, zt = q[2], zb = q[2] - q[4];
      return { p: [x0, zt, x1, zt, x1 + s * 0.6, zb + q[3] * 0.55, q[0] + s, zb, x0 + s * 0.6, zb + q[3] * 0.55], y0: q[1] - 0.35, y1: q[1] + 0.25 };
    });
    out.push(elev(cloth, 0, 0, m.banT, sh(m.ban, 0.35), { ao: 0.35, z0: Math.min.apply(null, list.map((q) => q[2] - q[4])), z1: Math.max.apply(null, list.map((q) => q[2])) }));
    const sig = (an) => {
      const ps = [];
      list.forEach((q, i) => {
        const s = Math.sin(an * TAU + i * 1.7) * 0.3, z = q[2] - q[4] * 0.38, r = q[3] * 0.26;
        for (const pp of skullP(q[0] + s, z, r)) ps.push({ p: pp, y0: q[1] + 0.2, y1: q[1] + 0.45 });
        ps.push({ p: rectXZ(q[0] - q[3] / 2 + 0.3, q[2] - 1.1, q[0] + q[3] / 2 - 0.3, q[2] - 0.6), y0: q[1] + 0.2, y1: q[1] + 0.45 });
      });
      return ps;
    };
    out.push(elev(sig, 0, 0, m.ban2, sh(m.ban2, 0.3), { flat: true, ao: 0 }));
    return out;
  }
  // a 3D skull resting on a point (top of a stake / merlon): list [x, y, z, r]
  function skulls3d(list, m) {
    const zl = Math.min.apply(null, list.map((q) => q[2])), zh = Math.max.apply(null, list.map((q) => q[2] + q[3] * 1.9));
    return { z0: zl, z1: zh, side: m.boneS, top: m.bone, ao: 0.3, bevel: false, shape: (c, zt) => {
      const z = zl + zt * (zh - zl);
      for (const q of list) {
        const u = (z - q[2]) / (q[3] * 1.9);
        if (u < 0 || u > 1) continue;
        const r = q[3] * (u < 0.35 ? 0.72 : Math.sqrt(Math.max(0.05, 1 - Math.pow((u - 0.45) / 0.58, 2))));
        S.circ(c, q[0], q[1], r);
      }
    }, detail: (c) => {
      const a = headingOf(c), fx = Math.sin(a), fy = Math.cos(a);
      for (const q of list) {
        if (Math.abs(q[2] + q[3] * 1.9 - zh) > 0.6) continue;
        const r = q[3];
        S.dot(c, m.void, q[0] + fx * r * 0.35 - fy * r * 0.36, q[1] + fy * r * 0.35 + fx * r * 0.36, r * 0.24);
        S.dot(c, m.void, q[0] + fx * r * 0.35 + fy * r * 0.36, q[1] + fy * r * 0.35 - fx * r * 0.36, r * 0.24);
      }
    } };
  }
  /* slice-wise stroked curves (bone ribs, buttresses, sails): fns f(z) → [x, y] | null */
  function curves(fns, z0, z1, w, side, top, ex) {
    const dz = dzOf(z0, z1);
    return Object.assign({ z0, z1, side, top, stroke: w, bevel: false, ao: 0.25, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0);
      for (const f of fns) {
        const a = f(z), b = f(Math.min(z1, z + dz * 1.1));
        if (!a || !b) continue;
        c.moveTo(a[0], a[1]); c.lineTo(b[0] + (a[0] === b[0] && a[1] === b[1] ? 0.01 : 0), b[1]);
      }
    } }, ex || {});
  }
  /* quarter-ellipse rib from (xa, ya, za) arching out and down to (xb, yb, zb) */
  const ribF = (xa, ya, za, xb, yb, zb) => (z) => {
    if (z > za + 0.01 || z < zb - 0.01) return null;
    const ct = U.clamp((z - zb) / (za - zb), 0, 1), st = Math.sqrt(1 - ct * ct);
    return [xa + (xb - xa) * st, ya + (yb - ya) * st];
  };
  /* arch rib rising from (x0, y0) to height h and down at (x1, y1) */
  const archF = (x0, y0, x1, y1, h, zb) => [0, 1].map((leg) => (z) => {
    const q = (z - (zb || 0)) / h;
    if (q < -0.01 || q > 1.01) return null;
    const s = Math.asin(U.clamp(q, 0, 1)) / PI, t = leg ? 1 - s : s;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  });
  // rune glyph strip in the x-z plane (glowing marks along a facade)
  function runeRow(x0, x1, zc, sz, seed) {
    const out = [], rng = new U.RNG(seed || 7);
    for (let x = x0; x < x1 - sz * 0.5; x += sz * 1.35) {
      const k = rng.int(0, 3), hz = sz * 0.75;
      if (k === 0) out.push(rectXZ(x, zc - hz, x + sz * 0.28, zc + hz));
      else if (k === 1) out.push(diamond(x + sz * 0.4, zc, sz * 0.42, hz));
      else if (k === 2) { out.push(rectXZ(x, zc - hz, x + sz * 0.24, zc + hz)); out.push([x + sz * 0.24, zc + hz * 0.2, x + sz * 0.8, zc + hz, x + sz * 0.8, zc + hz * 0.5, x + sz * 0.24, zc - hz * 0.3]); }
      else out.push([x, zc - hz, x + sz * 0.7, zc - hz, x + sz * 0.35, zc + hz]);
    }
    return out;
  }
  // rune marks around the front arc of cylinders: list [cx, cy, r], band centre zc
  function runeArcs(list, zc, col, top, seed) {
    const w = [], rng = new U.RNG(seed || 5);
    for (const q of list) for (let a = PI * 0.12; a < PI * 0.9; a += 0.36 / Math.max(0.5, q[2] / 8)) w.push([q[0], q[1], q[2], a, zc - 1 + rng.range(-0.5, 0.5), rng.range(1.4, 2.6), rng.next() < 0.3 ? 1 : 0.5]);
    return arcWins(w, col, top);
  }
  // course lines and staggered joints on flat front faces: segs [x0, x1, yFace]
  function courses(segs, z0, z1, step, col, ex) {
    const dz = dzOf(z0, z1);
    return Object.assign({ z0, z1, side: col, top: col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = zt * (z1 - z0), r = Math.floor(z / step), line = r !== Math.floor((z - dz) / step) && zt > 0.02 && zt < 0.98;
      for (const s of segs) {
        if (line) { c.rect(s[0], s[2] - 0.1, s[1] - s[0], 0.42); continue; }
        const off = (r % 2) * step * 0.95 + (s[3] || 0);
        for (let x = s[0] + 1.3 + off; x < s[1] - 0.5; x += step * 1.9) c.rect(x, s[2] - 0.1, 0.28, 0.42);
      }
    } }, ex || {});
  }
  /* top-face texture: flagstones / blocks clipped to a polygon with some patched,
   * cracked and missing stones */
  function flagstones(c, pts, cell, seed, light, dark) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    c.save(); c.beginPath(); S.poly(c, pts); c.clip();
    const rng = new U.RNG(seed * 7919 + 13);
    let row = 0;
    for (let y = y0; y < y1; y += cell, row++) {
      for (let x = x0 - (row % 2) * cell * 0.6; x < x1; x += cell * 1.25) {
        const r = rng.next();
        if (r < 0.14) { c.fillStyle = light || 'rgba(255,255,255,0.07)'; c.fillRect(x + 0.3, y + 0.3, cell * 1.25 - 0.6, cell - 0.6); }
        else if (r < 0.24) { c.fillStyle = dark || 'rgba(0,0,0,0.16)'; c.fillRect(x + 0.3, y + 0.3, cell * 1.25 - 0.6, cell - 0.6); }
      }
    }
    c.strokeStyle = SEAM2; c.lineWidth = 0.32; c.beginPath();
    row = 0;
    for (let y = y0; y < y1; y += cell, row++) {
      c.moveTo(x0, y); c.lineTo(x1, y);
      for (let x = x0 - (row % 2) * cell * 0.6; x < x1; x += cell * 1.25) { c.moveTo(x, y); c.lineTo(x, y + cell); }
    }
    c.stroke();
    // cracks
    c.strokeStyle = 'rgba(0,0,0,0.38)'; c.lineWidth = 0.3; c.beginPath();
    for (let i = 0; i < 4; i++) {
      let x = x0 + rng.next() * (x1 - x0), y = y0 + rng.next() * (y1 - y0);
      c.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rng.range(-2.5, 2.5); y += rng.range(-2.5, 2.5); c.lineTo(x, y); }
    }
    c.stroke();
    c.restore();
  }
  function glowDot(c, col, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(col, a === undefined ? 0.85 : a)); g.addColorStop(1, C.str(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function boneBits(c, m, list) { // scattered little bones on a top face: [x, y, rot, len]
    for (const q of list) {
      const ca = Math.cos(q[2]), sa = Math.sin(q[2]), l = (q[3] || 1.6) / 2;
      S.lines(c, cs(m.bone, 0.9), 0.45, [q[0] - ca * l, q[1] - sa * l, q[0] + ca * l, q[1] + sa * l]);
      S.dot(c, cs(m.bone), q[0] - ca * l, q[1] - sa * l, 0.38); S.dot(c, cs(m.bone), q[0] + ca * l, q[1] + sa * l, 0.38);
    }
  }
  const lvl = (o) => U.clamp(Math.round((o && +o.level) || 1), 1, 3);

  /* =====================================================================
   * KEEP — the Necropolis donjon. L1: black donjon with gable rose window,
   * corner turrets and a crenellated bailey. L2: bigger, four round curtain
   * towers with spiked cones. L3: grand citadel with a central soul-spire,
   * glowing rune bands and bone flying buttresses. anims 4 (flames, banners).
   * ===================================================================== */
  M.undead_keep = function (pal, opt) {
    opt = opt || {};
    const L = lvl(opt), m = mats(pal), parts = [];
    const K = [null,
      { pw: 47, pb: -40, pf: 45, cw: 41, cb: -35, cf: 32, cH: 10, dw: 20, db: -21, df: 7, dH: 26, rH: 21, tr: 4.6, tH: 36, gw: 11, gH: 18, R: 53 },
      { pw: 55, pb: -46, pf: 51, cw: 48, cb: -40, cf: 37, cH: 12, dw: 23, db: -24, df: 8, dH: 31, rH: 24, tr: 5, tH: 42, gw: 12, gH: 21, R: 61, tw: 7.5, twH: 32 },
      { pw: 63, pb: -52, pf: 57, cw: 55, cb: -45, cf: 42, cH: 14, dw: 26, db: -26, df: 9, dH: 35, rH: 26, tr: 5.4, tH: 48, gw: 13, gH: 24, R: 69, tw: 9, twH: 38 },
    ][L];
    const Z = 2.6; // top of the rock plinth
    const plin = [-K.pw + 10, K.pb, K.pw - 10, K.pb, K.pw, K.pb + 10, K.pw, K.pf - 12, K.pw - 12, K.pf, 15, K.pf, 11, K.pf + 6, -11, K.pf + 6, -15, K.pf, -K.pw + 12, K.pf, -K.pw, K.pf - 12, -K.pw, K.pb + 10];
    parts.push(polyPart(plin, 0, Z, m.wallD, m.floorT, { ao: 0.35, detail: (c) => {
      flagstones(c, plin, 3.2, 3 + L, 'rgba(255,255,255,0.045)', 'rgba(0,0,0,0.12)');
      c.fillStyle = cs(m.trimS, 0.4); c.beginPath(); c.rect(-5, K.df, 10, K.pf + 6 - K.df); c.fill();
      S.lines(c, SEAM2, 0.3, [-5, K.df, -5, K.pf + 6, 5, K.df, 5, K.pf + 6]);
      boneBits(c, m, [[-K.cw + 8, K.cf - 6, 0.4], [K.cw - 9, K.cf - 8, 2.2], [-K.cw + 14, K.df + 3, 1.2, 1.2], [K.cw - 15, K.df + 6, 0.2, 1.3], [-K.pw + 6, K.pf - 9, 1.1], [K.pw - 7, K.pb + 14, 2.6]]);
      glowDot(c, m.glow, 0, K.pf + 1, 10, 0.2);
      // grave mounds and headstones in the bailey
      for (const g of [[-K.cw + 9, K.df + 8], [-K.cw + 15, K.df + 12], [K.cw - 10, K.df + 9], [K.cw - 16, K.df + 13], [-K.cw + 9, K.db + 7], [K.cw - 9, K.db + 9]]) {
        c.fillStyle = cs(m.earthT, 0.55); c.beginPath(); S.ell(c, g[0], g[1] + 2, 1.6, 2.6); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); S.rrect(c, g[0] - 1.2, g[1] - 0.2, 2.6, 1.3, 0.5); c.fill();
        c.fillStyle = cs(m.trim); c.beginPath(); S.rrect(c, g[0] - 1.4, g[1] - 0.6, 2.6, 1.3, 0.5); c.fill();
      }
    } }));
    // curtain wall (bailey) + spiked merlons (+ bone tusks on the corners at L1)
    const ct = 3.8;
    parts.push({ z0: Z, z1: Z + K.cH, side: m.wall, top: m.wallT, ao: 0.32, shape: (c) => frame(c, -K.cw, K.cb, K.cw, K.cf, ct),
      detail: (c) => { S.lines(c, SEAM2, 0.3, [-K.cw + ct / 2, K.cb + ct, -K.cw + ct / 2, K.cf - ct, K.cw - ct / 2, K.cb + ct, K.cw - ct / 2, K.cf - ct]); } });
    parts.push(merlonsRect(-K.cw + 1.2, K.cb + 1.2, K.cw - 1.2, K.cf - 1.2, Z + K.cH, 3.4, 2.4, 2.4, m.wall, m.trim));
    if (L === 1) parts.push(spikes([[-K.cw, K.cb, 2.4, -5, -3], [K.cw, K.cb, 2.4, 5, -3], [-K.cw, K.cf, 2.6, -6, 3], [K.cw, K.cf, 2.6, 6, 3]], Z + K.cH - 1, 15, m.boneS, m.boneT, { ao: 0.35 }));
    // ---- donjon
    const dcy = (K.db + K.df) / 2, dhd = (K.df - K.db) / 2, Z1 = Z + K.dH;
    parts.push(box(-K.dw, K.db, K.dw, K.df, Z, Z1, m.wall, m.wallT, { ao: 0.32 }));
    // masonry courses (curtain front + donjon front) and patched stones
    parts.push(courses([[-K.cw, K.cw, K.cf], [-K.dw, K.dw, K.df, 0.7]], Z, Z1 - 1, 2.7, mx(m.wall, m.dark, 0.4)));
    parts.push(elev([
      { p: rectXZ(-K.cw + 4, Z + 2, -K.cw + 8, Z + 4.4), y0: K.cf - 0.1, y1: K.cf + 0.3 }, { p: rectXZ(K.cw - 12, Z + 5, K.cw - 8.6, Z + 7.2), y0: K.cf - 0.1, y1: K.cf + 0.3 },
      { p: rectXZ(-K.cw * 0.35, Z + 1, -K.cw * 0.35 + 3, Z + 3), y0: K.cf - 0.1, y1: K.cf + 0.3 },
      rectXZ(-K.dw + 3, Z + 4, -K.dw + 7, Z + 6.6), rectXZ(K.dw - 8, Z + 13, K.dw - 4.5, Z + 15.4), rectXZ(-K.dw * 0.45, Z1 - 6, -K.dw * 0.45 + 3.6, Z1 - 3.8), rectXZ(K.dw - 6, Z + 3, K.dw - 2.5, Z + 5),
    ], K.df - 0.1, K.df + 0.32, m.patch, m.patch));
    // stepped gothic buttresses on the front face
    const bx = [-K.dw * 0.42, K.dw * 0.42];
    parts.push({ z0: Z, z1: Z1 - 2, side: m.wall, top: m.wallT, ao: 0.32, shape: (c, zt) => {
      const d = zt < 0.4 ? 3.2 : zt < 0.75 ? 2.2 : 1.2;
      for (const x of bx) c.rect(x - 1.4, K.df - 0.5, 2.8, d + 0.5);
    } });
    // bone rib buttresses on the flanks (L2+)
    if (L >= 2) {
      const ribs = [];
      for (const sd of [-1, 1]) for (const y of [K.db + 7, (K.db + K.df) / 2 + 3]) ribs.push(ribF(sd * K.dw, y, Z1 - 3, sd * (K.dw + 10 + L * 2), y, Z));
      parts.push(curves(ribs, Z, Z1 - 3, 1.7, m.boneS, m.bone));
    }
    // bone cornice band
    parts.push(box(-K.dw - 0.9, K.db - 0.9, K.dw + 0.9, K.df + 0.9, Z1, Z1 + 1.6, m.corn, m.cornT, { ao: 0.2 }));
    if (L === 3) parts.push(elev(runeRow(-K.dw + 1.5, K.dw - 1.5, Z1 - 2.6, 1.5, 11).concat(runeRow(-K.cw + 3, -K.gw - 6, Z + K.cH * 0.45, 1.6, 3).map((p) => ({ p, y0: K.cf + 0.1, y1: K.cf + 0.5 })), runeRow(K.gw + 6, K.cw - 3, Z + K.cH * 0.45, 1.6, 4).map((p) => ({ p, y0: K.cf + 0.1, y1: K.cf + 0.5 }))), K.df + 0.1, K.df + 0.5, m.glow, m.glowT, { flat: true, ao: 0 }));
    // steep gable roof, ridge along y (gable faces the camera), bone ridge line
    const RO = { x: 0, y: dcy, L: dhd + 1.6, W: K.dw + 1.6, z0: Z1 + 1.6, h: K.rH, axis: 'y', lit: m.roofL, shade: m.roofS, ridge: m.bone, step: 2.6, joint: 3.4 };
    parts.push(...gable(RO));
    parts.push(roofLines(RO, m.roofLn));
    if (L === 1) parts.push(roofHole(RO, 'right', -dhd * 0.3, K.rH * 0.35, 3.2, 2.6, m.void));
    // stone gable with rose window; window frames, glows and tracery share parts
    const gz = RO.z0, gy = dcy + RO.L, RT = RO.z0 + RO.h;
    parts.push(elev([triXZ(-K.dw + 0.3, K.dw - 0.3, gz, gz + K.rH * (K.dw - 0.3) / RO.W)], gy - 0.9, gy + 0.1, m.wall, m.corn, { ao: 0.3 }));
    const rz = gz + K.rH * 0.36, rr = K.dw * 0.2;
    const wx = [-K.dw * 0.72, K.dw * 0.72], frames = [], wins = [];
    for (const x of wx) { frames.push(lancet(x, Z + K.dH * 0.42, 3.6, K.dH * 0.42)); wins.push(lancet(x, Z + K.dH * 0.42 + 0.5, 2.4, K.dH * 0.42 - 1.1)); }
    frames.push(lancet(0, Z + K.dH * 0.55, 3.4, K.dH * 0.3)); wins.push(lancet(0, Z + K.dH * 0.55 + 0.5, 2.2, K.dH * 0.3 - 1.1));
    frames.push(lancet(0, Z, 7.8, 11.5, 0.55)); wins.push(lancet(0, Z, 5.6, 10.2, 0.55));
    frames.push({ p: ngon(12, rr + 1, 0, 0, rz), y0: gy + 0.1, y1: gy + 0.4 });
    parts.push(elev(frames, K.df - 0.1, K.df + 0.45, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev(wins, K.df + 0.45, K.df + 0.7, m.glow, m.glowT, { flat: true, ao: 0.3 }));
    parts.push(elev([ngon(12, rr, 0, 0, rz)], gy + 0.4, gy + 0.6, m.vio, m.vioT, { flat: true, ao: 0 }));
    const dark = [{ p: rectXZ(-0.22, Z, 0.22, Z + 9.4), y0: K.df + 0.7, y1: K.df + 0.9 }, { p: rectXZ(-2.8, Z + 4.6, 2.8, Z + 5), y0: K.df + 0.7, y1: K.df + 0.9 }, ngon(8, rr * 0.28, PI / 8, 0, rz)];
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI, ca = Math.cos(a) * rr, sa = Math.sin(a) * rr; dark.push([-ca - sa * 0.08, rz - sa + ca * 0.08, ca - sa * 0.08, rz + sa + ca * 0.08, ca + sa * 0.08, rz + sa - ca * 0.08, -ca + sa * 0.08, rz - sa - ca * 0.08]); }
    parts.push(elev(dark, gy + 0.6, gy + 0.8, m.void, m.dark, { ao: 0 }));
    let H = RT + 8;
    const spk = [[0, gy - 0.3, 1.3, 0, 0, RT - 0.4, 7.5]];
    if (L < 3) spk.push([0, dcy - RO.L + 0.4, 1.1, 0, 0, RT - 0.4, 7.5]);
    for (let y = dcy - RO.L + 4; y < gy - 2; y += 4) if (L < 3 || y > dcy - dhd * 0.4 + 8.5) spk.push([0, y, 0.55, 0, 0, RT - 0.4, 4]);
    // ---- gatehouse body (drawn before the shared tower parts: no screen overlap with the donjon turrets)
    const gw = K.gw, gy0 = K.cf - 7, gy1 = K.cf + 4, G1 = Z + K.gH, gT = G1 + 4;
    parts.push(box(-gw, gy0, gw, gy1, Z, G1, m.wall, m.wallT, { ao: 0.32, detail: (c) => { S.dot(c, m.void, 0, (gy0 + gy1) / 2, 2.4); glowDot(c, m.glow, 0, (gy0 + gy1) / 2, 3.4, 0.55); } }));
    parts.push(merlonsRect(-gw + 1.2, gy0 + 1.2, gw - 1.2, gy1 - 1.2, G1, 3.4, 2.2, 2.2, m.wall, m.trim));
    // ---- towers: donjon turrets, curtain towers (L2+), gate turrets and the L3 soul-spire share body / trim / cone parts
    const tz1 = Z + K.tH, t1 = Z + (K.twH || 0);
    const tur = [[-K.dw, K.df, K.tr], [K.dw, K.df, K.tr]];
    const twr = K.tw ? [[-K.cw, K.cb, K.tw], [K.cw, K.cb, K.tw], [-K.cw, K.cf, K.tw], [K.cw, K.cf, K.tw]] : [];
    const gt = [[-gw, gy1 - 2.4, 3.6], [gw, gy1 - 2.4, 3.6]];
    const bodies = [], bands = [], cn = [];
    for (const q of tur) { bodies.push([q[0], q[1], q[2] + 1.3, Z, Z + 3.2], [q[0], q[1], q[2], Z, tz1 - 3]); bands.push([q[0], q[1], q[2] + 0.9, tz1 - 3, tz1]); cn.push([q[0], q[1], q[2] + 1.6, tz1, K.tH * 0.42]); spk.push([q[0], q[1], 0.5, 0, 0, tz1 + K.tH * 0.38, 4]); }
    for (const q of twr) { bodies.push([q[0], q[1], q[2] + 1.3, Z, Z + 3.2], [q[0], q[1], q[2], Z, t1 - 3.4]); bands.push([q[0], q[1], q[2] + 1, t1 - 3.4, t1]); cn.push([q[0], q[1], q[2] + 1.8, t1, K.twH * 0.7]); spk.push([q[0], q[1], 0.7, 0, 0, t1 + K.twH * 0.62, 6]); }
    for (const q of gt) { bodies.push([q[0], q[1], q[2], Z, gT]); bands.push([q[0], q[1], q[2] + 0.8, gT, gT + 1.6]); cn.push([q[0], q[1], q[2] + 1.3, gT + 1.6, 9 + L]); }
    let spire = null;
    if (L === 3) {
      const sy = dcy - dhd * 0.4, sr = 7, sz0 = RO.z0 + RO.h * (1 - sr / RO.W) - 2, sz1 = RT + 9, bel = 7, sph = 30;
      spire = { sy, sr, sz1, bel };
      bodies.push([0, sy, sr, sz0, sz1]);
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; bands.push([Math.cos(a) * (sr - 0.8), sy + Math.sin(a) * (sr - 0.8), 0.85, sz1, sz1 + bel]); }
      bands.push([0, sy, sr + 1, sz1 + bel, sz1 + bel + 1.6]);
      cn.push([0, sy, sr + 1.4, sz1 + bel + 1.6, sph]);
      spk.push([0, sy, 0.9, 0, 0, sz1 + bel + 1.6 + sph - 1, 6]);
      H = sz1 + bel + 1.6 + sph + 7;
    }
    parts.push(drums(bodies, Z, Z + 1, m.wall, m.wallT, { ao: 0.32 }));
    if (spire) parts.push(drums([[0, spire.sy, spire.sr - 1.4]], spire.sz1, spire.sz1 + spire.bel, m.glowS, m.glowT, { flat: true, ao: 0.5 }));
    parts.push(drums(bands, Z, Z + 1, m.corn, m.cornT, { ao: 0.25 }));
    parts.push(...cones(cn, 0, 1, m.roofL, m.roofS));
    parts.push(spikes(spk.map((q) => q.slice(0, 5)), 0, 1, m.iron, m.boneT, { z0: Math.min.apply(null, spk.map((q) => q[5])), z1: Math.max.apply(null, spk.map((q) => q[5] + q[6])), shape: spikeShape(spk) }));
    // tower windows (+ L3 rune bands) in one glow part
    const w = [];
    for (const q of twr) for (const a of [PI * 0.32, PI * 0.68]) { w.push([q[0], q[1], q[2], a, Z + K.twH * 0.42, 4.6, 1.4]); w.push([q[0], q[1], q[2], a + (a < PI / 2 ? 0.25 : -0.25), Z + 6, 3, 0.8]); }
    for (const q of tur) w.push([q[0], q[1], q[2], PI / 2, Z + K.tH * 0.55, 4.5, 1.3]);
    for (const q of gt) w.push([q[0], q[1], q[2], PI / 2, G1 - 5, 3.6, 1.1]);
    if (L === 3) { const rng = new U.RNG(9); for (const q of twr) for (let a = PI * 0.12; a < PI * 0.9; a += 0.32) w.push([q[0], q[1], q[2], a, t1 - 8 + rng.range(-0.5, 0.5), rng.range(1.4, 2.6), rng.next() < 0.3 ? 1 : 0.5]); }
    parts.push(arcWins(w, m.glow, m.glowT));
    // gate arch: bone-trimmed frame, green portal glow, portcullis, skull frieze + keystone with burning eyes
    const aw = gw * 0.5, ah = K.gH * 0.6, kz = Z + ah + 3, fz = G1 - 2.2;
    parts.push(elev([lancet(0, Z, aw * 2 + 2.6, ah + 1.6, 0.6)], gy1 - 0.1, gy1 + 0.5, m.trimS, m.corn, { ao: 0.2 }));
    const glw = [{ p: lancet(0, Z, aw * 2, ah, 0.6), y0: gy1 + 0.5, y1: gy1 + 0.7 }], sk = [];
    for (const pp of skullP(0, kz, 2.1)) sk.push(pp);
    for (const pp of skullEyes(0, kz, 2.1)) glw.push({ p: pp, y0: gy1 + 1.2, y1: gy1 + 1.4 });
    for (let x = -gw + 4.6; x <= gw - 4.5; x += 2.7) { if (Math.abs(x) < 3) continue; for (const pp of skullP(x, fz, 0.95)) sk.push(pp); for (const pp of skullEyes(x, fz, 0.95).slice(0, 2)) glw.push({ p: pp, y0: gy1 + 1.2, y1: gy1 + 1.4 }); }
    parts.push(elev(glw, 0, 0, m.glowS, m.glow, { flat: true, ao: 0.45 }));
    const pc = [];
    for (let x = -aw + 1.2; x < aw - 0.5; x += 1.8) pc.push(rectXZ(x - 0.24, Z + 1.4, x + 0.24, Z + ah - 0.6 - Math.max(0, Math.abs(x) - aw * 0.4) * 1.6));
    for (let z = Z + 3; z < Z + ah - 3; z += 2.4) pc.push(rectXZ(-aw + 0.5, z, aw - 0.5, z + 0.4));
    parts.push(elev(pc, gy1 + 0.7, gy1 + 1, m.iron, m.ironT, { ao: 0 }));
    parts.push(elev(sk, gy1 + 0.5, gy1 + 1.2, m.boneS, m.bone, { ao: 0.25 }));
    // braziers flanking the gate, banners draped on the curtain front
    parts.push(...braziers([[-gw - 6.5, K.pf - 2, 3.6 + Z, 1.9], [gw + 6.5, K.pf - 2, 3.6 + Z, 1.9]], m));
    const bw = 4.4 + L * 0.4;
    parts.push(...banners([[-K.cw * 0.58, K.cf + 0.6, Z + K.cH - 0.4, bw, K.cH - 1.4, false], [K.cw * 0.58, K.cf + 0.6, Z + K.cH - 0.4, bw, K.cH - 1.4, false]], m));
    if (K.tw) H = Math.max(H, t1 + K.twH * 0.62 + 7);
    return { r: K.R + 5, h: Math.ceil(H + 2), parts, style: 'unit', bevel: 0.8 };
  };

  /* =====================================================================
   * HOUSE — crypt dwellings. v0 gabled mausoleum with a portico, v1 tall
   * narrow gothic house with a broken spire roof, v2 domed tomb, v3 long
   * patched crypt-house with a collapsed roof and a small graveyard.
   * ===================================================================== */
  M.undead_house = function (pal, opt) {
    opt = opt || {};
    const v = U.clamp(Math.round(+opt.v || 0), 0, 3), m = mats(pal), parts = [];
    let H = 26, R = 20;
    if (v === 0) {
      // gabled mausoleum: columns, green-lit crypt door, skull pediment, spiked acroteria
      const base = rectP(-13, -12, 13, 14);
      parts.push(polyPart(base, 0, 1.6, m.wallD, m.floorT, { ao: 0.3, detail: (c) => { flagstones(c, base, 2.8, 11); boneBits(c, m, [[-11, 12, 0.5, 1.2], [11.4, -9, 2, 1.3]]); } }));
      parts.push(box(-6, 14, 6, 17, 0, 1, m.wallD, m.trimS, { ao: 0.2, detail: (c) => S.lines(c, SEAM, 0.35, [-6, 15.5, 6, 15.5]) }));
      parts.push(box(-10, -11, 10, 9, 1.6, 10.5, m.wall, m.wallT, { ao: 0.3 }));
      parts.push(courses([[-10, 10, 9]], 1.6, 10.5, 2.2, mx(m.wall, m.dark, 0.4)));
      parts.push(elev([lancet(0, 1.6, 5.4, 7.8, 0.6), lancet(-5.2, 4.2, 1.8, 4.6), lancet(5.2, 4.2, 1.8, 4.6)], 8.9, 9.4, m.trimS, m.corn));
      parts.push(elev([lancet(0, 1.6, 3.8, 6.8, 0.6), lancet(-5.2, 4.6, 0.9, 3.8), lancet(5.2, 4.6, 0.9, 3.8)], 9.4, 9.6, m.glowS, m.glow, { flat: true, ao: 0.5 }));
      parts.push(elev([rectXZ(-0.18, 1.6, 0.18, 7.6), rectXZ(-1.9, 4.6, 1.9, 4.95)], 9.6, 9.8, m.iron, m.ironT, { ao: 0 }));
      parts.push(drums([[-8.7, 9.5, 1.3], [8.7, 9.5, 1.3]], 1.6, 10.5, m.trimS, m.trim, { ao: 0.3 }));
      parts.push(box(-11, -12, 11, 10.8, 10.5, 11.6, m.corn, m.cornT, { ao: 0.15 }));
      const RO = { x: 0, y: -0.6, L: 11.4, W: 11.6, z0: 11.6, h: 10, axis: 'y', lit: m.roofL, shade: m.roofS, ridge: m.bone, step: 2.1, joint: 2.6 };
      parts.push(...gable(RO));
      parts.push(roofLines(RO, m.roofLn));
      const gy = RO.y + RO.L;
      parts.push(elev([triXZ(-10.8, 10.8, 11.6, 11.6 + RO.h * 10.8 / RO.W)], gy - 0.8, gy, m.wall, m.corn, { ao: 0.25 }));
      parts.push(elev(skullP(0, 15, 1.9), gy, gy + 0.6, m.boneS, m.bone));
      parts.push(elev(skullEyes(0, 15, 1.9), gy + 0.6, gy + 0.8, m.glow, m.glowT, { flat: true, ao: 0 }));
      parts.push(spikes([[0, gy - 0.4, 1, 0, 0.6], [0, RO.y - RO.L + 0.4, 0.8], [-10.6, gy - 0.4, 0.8, -0.8, 0.4], [10.6, gy - 0.4, 0.8, 0.8, 0.4]], 21, 5, m.iron, m.boneT, { shape: spikeShape([[0, gy - 0.4, 1, 0, 0.6, 21, 5.5], [0, RO.y - RO.L + 0.4, 0.8, 0, 0, 21, 4], [-10.6, gy - 0.4, 0.9, -0.9, 0.5, 11.6, 3.8], [10.6, gy - 0.4, 0.9, 0.9, 0.5, 11.6, 3.8]]), z0: 11.6, z1: 26.5 }));
      parts.push(...braziers([[-9.6, 15.8, 1.8, 1.3], [9.6, 15.8, 1.8, 1.3]], m));
      H = 30; R = 19;
    } else if (v === 1) {
      // tall narrow gothic house: steep three-facet spire roof with a broken hole, purple-lit chimney, iron railing
      const base = rectP(-10, -10, 10, 12);
      parts.push(polyPart(base, 0, 1.2, m.wallD, m.floorT, { ao: 0.3, detail: (c) => { flagstones(c, base, 2.6, 12); boneBits(c, m, [[7.5, 10.6, 0.3, 1.2]]); } }));
      parts.push(box(-7.6, -8.2, -4.4, -5, 1.2, 27, m.wall, m.wallT, { detail: (c) => { S.dot(c, m.void, -6, -6.6, 1.1); glowDot(c, m.vio, -6, -6.6, 2, 0.85); } }));
      parts.push(box(-8.5, -8.6, 8.5, 7.5, 1.2, 13.5, m.wall, m.wallT, { ao: 0.3 }));
      parts.push(courses([[-8.5, 8.5, 7.5]], 1.2, 13.5, 2.2, mx(m.wall, m.dark, 0.4)));
      parts.push(elev([rectXZ(4.6, 2.2, 7.6, 4.2), rectXZ(-7.8, 9.4, -5.2, 11.4)], 7.4, 7.75, m.patch, m.patch));
      parts.push(elev([lancet(-4.6, 5.6, 2.8, 7), lancet(4.6, 5.6, 2.8, 7), lancet(0, 1.2, 4.2, 6.6, 0.6)], 7.4, 7.9, m.trimS, m.corn));
      parts.push(elev([lancet(-4.6, 6.1, 1.7, 6), lancet(4.6, 6.1, 1.7, 6)], 7.9, 8.1, m.glow, m.glowT, { flat: true, ao: 0.3 }));
      parts.push(elev([lancet(0, 1.2, 3, 5.8, 0.6)], 7.9, 8.1, m.woodD, m.wood, { ao: 0.3 }));
      parts.push(elev([rectXZ(-0.16, 1.2, 0.16, 5.6), rectXZ(-4.6 - 0.12, 6.1, -4.6 + 0.12, 11.8), rectXZ(4.6 - 0.12, 6.1, 4.6 + 0.12, 11.8)], 8.1, 8.3, m.iron, m.ironT, { ao: 0 }));
      parts.push(box(-9.4, -9.4, 9.4, 8.3, 13.5, 14.6, m.corn, m.cornT, { ao: 0.15 }));
      const RO = { x: 0, y: -0.55, L: 9.6, W: 9.4, z0: 14.6, h: 14, pw: 1.3, lit: m.roofL, shade: m.roofS };
      parts.push(...hipRoof(RO));
      parts.push(hipLines(RO, m.roofLn, 2));
      // broken hole in the front facet, rafters showing
      parts.push({ z0: 16.5, z1: 21, side: m.void, top: m.void, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
        const z = 1.9 + zt * 4.5, q = hipSlice(RO, z / RO.h), hw = 2.6 * Math.sin(zt * PI) * (0.8 + 0.3 * Math.sin(z * 3.1));
        for (let s = -hw; s < hw; s += 1.8) { const b = Math.min(hw, s + 1.8); if (b > s + 0.5) c.rect(2.6 + s + 0.5, q.y1 - 0.7, b - s - 0.5, 0.9); }
      } });
      parts.push(hipRidges(RO, m.boneS, m.bone, 0.42));
      parts.push(spikes([[0, -0.55, 0.7]], 27.6, 5, m.iron, m.boneT));
      // iron railing in front
      const fence = [];
      for (let x = -9; x <= 9.01; x += 1.5) if (Math.abs(x) > 2.4) fence.push([x, 10.9, 0.3]);
      parts.push(spikes(fence, 1.2, 4.6, m.iron, m.ironT, { ao: 0.1 }));
      parts.push(box(-9.3, 10.7, -2.4, 11.1, 3.7, 4.2, m.iron, m.ironT, { bevel: false, shape: (c) => { c.rect(-9.3, 10.7, 6.9, 0.4); c.rect(2.4, 10.7, 6.9, 0.4); } }));
      H = 35; R = 16;
    } else if (v === 2) {
      // domed tomb: octagonal drum, bone-ribbed dome, violet lantern, flanking flames
      const base = ngon(8, 14, PI / 8);
      parts.push(polyPart(base, 0, 1.6, m.wallD, m.floorT, { ao: 0.3, detail: (c) => flagstones(c, base, 2.8, 13) }));
      parts.push(box(-5, 12, 5, 16, 0, 1.1, m.wallD, m.trimS, { ao: 0.2, detail: (c) => S.lines(c, SEAM, 0.35, [-5, 14, 5, 14]) }));
      parts.push(spikes([[-10.4, -6, 1.5], [10.4, -6, 1.5]], 1.6, 12, m.wall, m.trim));
      const dr = 9.6;
      parts.push({ z0: 1.6, z1: 11, side: m.wall, top: m.wallT, ao: 0.3, shape: (c) => S.poly(c, ngon(8, dr, PI / 8)) });
      parts.push(courses([[-dr * 0.38, dr * 0.38, dr * 0.92]], 1.6, 11, 2.2, mx(m.wall, m.dark, 0.4)));
      parts.push({ z0: 11, z1: 12.4, side: m.corn, top: m.cornT, ao: 0.2, shape: (c) => S.poly(c, ngon(8, dr + 1, PI / 8)) });
      const DH = 10;
      parts.push(...[-1, 1].map((sd) => ({ z0: 12.4, z1: 12.4 + DH, side: sd < 0 ? m.roofL : m.roofS, top: m.roofL, ao: 0.2, bevel: false, shape: (c, zt) => halfDisc(c, 0, 0, dr * Math.sqrt(Math.max(0.01, 1 - zt * zt)) + 0.2, sd) })));
      parts.push({ z0: 12.4, z1: 12.4 + DH * 0.96, side: m.boneS, top: m.bone, ao: 0.15, bevel: false, shape: (c, zt) => {
        const r = dr * Math.sqrt(Math.max(0.01, 1 - zt * zt)) + 0.3;
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.45); }
      } });
      parts.push(drums([[0, 0, 2.3]], 12.4 + DH - 0.6, 12.4 + DH + 2.6, m.vio, m.vioT, { flat: true, ao: 0.3 }));
      parts.push(spikes([[0, 0, 2.8]], 12.4 + DH + 2.6, 3.2, m.roofS, m.roofL));
      parts.push(spikes([[0, 0, 0.5]], 12.4 + DH + 5.2, 4, m.iron, m.boneT));
      parts.push(elev([lancet(0, 1.6, 5.2, 8, 0.6)], dr * 0.92 - 0.1, dr * 0.92 + 0.5, m.trimS, m.corn));
      parts.push(elev([lancet(0, 1.6, 3.6, 7, 0.6)], dr * 0.92 + 0.5, dr * 0.92 + 0.7, m.glowS, m.glow, { flat: true, ao: 0.5 }));
      parts.push(arcWins([[0, 0, dr * 0.95, PI / 2 - 0.8, 5, 4, 1], [0, 0, dr * 0.95, PI / 2 + 0.8, 5, 4, 1]], m.glow, m.glowT));
      parts.push(...braziers([[-9.6, 9.6, 3, 1.2], [9.6, 9.6, 3, 1.2]], m));
      H = 31; R = 18;
    } else {
      // long patched crypt-house: hipped slate roof with a collapsed hole, barred green windows, little graveyard
      const base = rectP(-16, -11, 16, 15);
      parts.push(polyPart(base, 0, 1.2, m.earth, m.earthT, { ao: 0.3, detail: (c) => {
        flagstones(c, rectP(-16, -11, 16, 6.5), 2.6, 14);
        for (const g of [[-8, 11.6], [6, 12], [12.5, 13.4]]) { c.fillStyle = cs(m.earthT, 0.6); c.beginPath(); S.ell(c, g[0], g[1], 1.8, 2.2); c.fill(); }
        boneBits(c, m, [[12, 9.4, 0.6], [-13, 13, 2.1, 1.2], [1, 13.4, 1.2, 1.1]]);
      } }));
      parts.push(box(-14.5, -9.5, 14.5, 5.5, 1.2, 9.6, m.wall, m.wallT, { ao: 0.3 }));
      parts.push(courses([[-14.5, 14.5, 5.5]], 1.2, 9.6, 2.2, mx(m.wall, m.dark, 0.4)));
      parts.push(elev([rectXZ(-13, 2, -9.6, 4.2), rectXZ(8.6, 1.6, 12.4, 3.8), rectXZ(-1.6, 7, 1.4, 8.8)], 5.4, 5.75, m.patch, m.patch));
      parts.push(elev([lancet(-3.6, 1.2, 4.4, 6.8, 0.6), rectXZ(4.3, 4.2, 8.7, 7.8), rectXZ(-12.6, 4.2, -8.8, 7.6)], 5.4, 5.9, m.trimS, m.corn));
      parts.push(elev([lancet(-3.6, 1.2, 3.1, 6, 0.6)], 5.9, 6.1, m.woodD, m.wood, { ao: 0.3 }));
      parts.push(elev([rectXZ(5, 4.8, 8, 7.2), rectXZ(-12, 4.8, -9.4, 7)], 5.9, 6.1, m.glow, m.glowT, { flat: true, ao: 0.2 }));
      parts.push(elev([rectXZ(5.9, 4.8, 6.2, 7.2), rectXZ(6.9, 4.8, 7.2, 7.2), rectXZ(-10.85, 4.8, -10.55, 7), rectXZ(-3.75, 1.2, -3.45, 6.2)], 6.1, 6.3, m.iron, m.ironT, { ao: 0 }));
      parts.push(elev(skullP(-3.6, 8.6, 0.95), 5.9, 6.4, m.boneS, m.bone));
      parts.push(box(-15.3, -10.3, 15.3, 6.3, 9.6, 10.6, m.corn, m.cornT, { ao: 0.15 }));
      const RO = { x: 0, y: -2, L: 16, W: 9.6, z0: 10.6, h: 9.5, lit: m.roofL, shade: m.roofS };
      parts.push(...hipRoof(RO));
      parts.push(hipLines(RO, m.roofLn, 2));
      parts.push({ z0: 12, z1: 16.5, side: m.void, top: m.void, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
        const z = 1.4 + zt * 4.5, q = hipSlice(RO, z / RO.h), hw = 3.4 * Math.sin(zt * PI) * (0.8 + 0.3 * Math.sin(z * 2.7));
        for (let s = -hw; s < hw; s += 2) { const b = Math.min(hw, s + 2); if (b > s + 0.55) c.rect(6 + s + 0.55, q.y1 - 0.7, b - s - 0.55, 0.9); }
      } });
      parts.push(hipRidges(RO, m.boneS, m.bone, 0.45));
      parts.push(spikes([[-6.4, -2, 0.7], [6.4, -2, 0.7]], 20, 3.5, m.iron, m.boneT));
      parts.push(box(-10.2, -7.2, -7.4, -4.6, 13, 23.5, m.wall, m.wallT, { detail: (c) => { S.dot(c, m.void, -8.8, -5.9, 0.95); glowDot(c, m.glow, -8.8, -5.9, 2, 0.9); } }));
      parts.push({ z0: 1.2, z1: 5.4, side: m.trimS, top: m.trim, ao: 0.3, bevel: false, shape: (c, zt) => {
        for (const g of [[-8, 9.6], [6, 10], [12.5, 11.4]]) { const w = zt > 0.7 ? 1.5 * (1 - (zt - 0.7) * 1.8) : 1.5; c.rect(g[0] - w, g[1] - 0.45, w * 2, 0.9); }
      } });
      parts.push(...braziers([[-13.6, 11.5, 5, 1.1]], m));
      H = 26; R = 19;
    }
    return { r: R, h: H, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * BARRACKS — the Bone Pit: an ossuary hall walled with skull friezes,
   * and in front a sunken training pit under a giant beast ribcage, with
   * skeleton practice posts, weapon racks and banners. anims 4.
   * ===================================================================== */
  M.undead_barracks = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1.4, PY = 9, PR = 13.8;
    const base = [-27, -26, 27, -26, 30, -21, 30, 23, 25, 28, -25, 28, -30, 23, -30, -21];
    parts.push(polyPart(base, 0, Z, m.wallD, m.floorT, { ao: 0.3, detail: (c) => {
      flagstones(c, rectP(-30, -26, 30, -5), 3, 21);
      c.save(); c.beginPath(); S.poly(c, base); c.clip();
      c.fillStyle = cs(m.earth, 0.55); c.fillRect(-30, -5, 60, 34);
      c.restore();
      // pit floor: trampled dark earth, bones and a sickly glow
      S.dot(c, cs(m.void, 0.9), 0, PY, PR - 1.2);
      glowDot(c, m.glow, 0, PY + 1, PR - 2, 0.22);
      boneBits(c, m, [[-6, PY - 4, 0.4], [5, PY + 5, 2.1], [-3, PY + 7, 1.2, 1.2], [7, PY - 3, 0.9], [0, PY + 2, 2.7, 1.1], [-8, PY + 3, 1.7]]);
      boneBits(c, m, [[-24, 20, 0.3], [23, -2, 1.9], [14, 25, 2.5, 1.2]]);
      c.fillStyle = cs(m.trimS, 0.45); c.beginPath(); c.rect(-3.5, PY + PR, 7, 28 - PY - PR); c.fill();
    } }));
    // ossuary hall
    const hy0 = -23, hy1 = -7, Z1 = 12.5;
    parts.push(box(-24, hy0, 24, hy1, Z, Z1, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(courses([[-24, 24, hy1]], Z, Z1, 2.3, mx(m.wall, m.dark, 0.4)));
    // skull friezes (the ossuary walls) + their empty sockets
    const sk = [], so = [];
    for (const zr of [[Z + 1.6, 0.95], [Z1 - 1.6, 0.95]]) for (let x = -22.6; x <= 22.7; x += 2.3) {
      if (Math.abs(x) < 5) continue;
      for (const pp of skullP(x, zr[0], zr[1])) sk.push(pp);
      for (const pp of skullEyes(x, zr[0], zr[1])) so.push(pp);
    }
    parts.push(elev(sk, hy1 - 0.1, hy1 + 0.45, m.boneS, m.bone, { ao: 0.2 }));
    parts.push(elev(so, hy1 + 0.45, hy1 + 0.6, m.void, m.dark, { ao: 0 }));
    parts.push(elev([lancet(0, Z, 8.2, 10, 0.6), lancet(-12.5, Z + 4.4, 2.6, 5.2), lancet(12.5, Z + 4.4, 2.6, 5.2), lancet(-19, Z + 4.4, 2.6, 5.2), lancet(19, Z + 4.4, 2.6, 5.2)], hy1 - 0.1, hy1 + 0.5, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev([lancet(0, Z, 6, 9, 0.6), lancet(-12.5, Z + 4.9, 1.5, 4.2), lancet(12.5, Z + 4.9, 1.5, 4.2), lancet(-19, Z + 4.9, 1.5, 4.2), lancet(19, Z + 4.9, 1.5, 4.2)], hy1 + 0.5, hy1 + 0.7, m.glowS, m.glow, { flat: true, ao: 0.5 }));
    parts.push(elev([rectXZ(-0.2, Z, 0.2, Z + 8.2), rectXZ(-2.2, Z, -1.8, Z + 7.6), rectXZ(1.8, Z, 2.2, Z + 7.6), rectXZ(-3, Z + 4.5, 3, Z + 4.9)], hy1 + 0.7, hy1 + 0.9, m.iron, m.ironT, { ao: 0 }));
    parts.push(box(-25, hy0 - 1, 25, hy1 + 1, Z1, Z1 + 1.2, m.corn, m.cornT, { ao: 0.15 }));
    const RO = { x: 0, y: (hy0 + hy1) / 2, L: 25.6, W: 9.4, z0: Z1 + 1.2, h: 9.5, lit: m.roofL, shade: m.roofS };
    parts.push(...hipRoof(RO));
    parts.push(hipLines(RO, m.roofLn, 2.1));
    parts.push(hipRidges(RO, m.boneS, m.bone, 0.45));
    // vertebrae along the ridge, pit ribcage spine
    const spk = [];
    for (let x = -15; x <= 15.1; x += 2.5) spk.push([x, RO.y, 0.75, 0, 0, RO.z0 + RO.h - 0.4, 2.6]);
    const ribs = [], SPZ = 16;
    for (const dy of [-6, -2, 2, 6]) {
      const hx2 = Math.sqrt(PR * PR - dy * dy) - 0.6, hh = SPZ - 1 - Math.abs(dy) * 0.25;
      ribs.push(...archF(-hx2, PY + dy, hx2, PY + dy, hh - Z - 3.4, Z + 3.4));
    }
    for (let y = PY - 8; y <= PY + 8.1; y += 2.2) spk.push([0, y, 0.8, 0, 0, SPZ - 0.4, 2]);
    // pit ring wall with skulls
    parts.push({ z0: Z, z1: Z + 3.4, side: m.wall, top: m.wallT, ao: 0.3, shape: (c) => annulus(c, 0, PY, PR + 1.4, PR - 1),
      detail: (c) => { c.save(); c.strokeStyle = SEAM2; c.lineWidth = 0.3; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; c.moveTo(Math.cos(a) * (PR - 1), PY + Math.sin(a) * (PR - 1)); c.lineTo(Math.cos(a) * (PR + 1.4), PY + Math.sin(a) * (PR + 1.4)); } c.stroke(); c.restore(); } });
    // practice posts (skeleton dummies) + weapon racks
    const dummies = [[-5.5, PY - 1], [5.5, PY + 2]];
    parts.push({ z0: Z, z1: Z + 8, side: m.woodD, top: m.woodT, ao: 0.3, bevel: false, shape: (c, zt) => {
      const z = zt * 8;
      for (const d of dummies) { S.circ(c, d[0], d[1], 0.45); if (z > 5.2 && z < 5.9) c.rect(d[0] - 2.4, d[1] - 0.3, 4.8, 0.6); }
    } });
    const sk3 = dummies.map((d) => [d[0], d[1], Z + 8, 1]);
    for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * TAU; if (Math.sin(a) > 0.9) continue; sk3.push([Math.cos(a) * (PR + 0.2), PY + Math.sin(a) * (PR + 0.2), Z + 3.4, 0.75]); }
    parts.push(skulls3d(sk3, m));
    parts.push(curves(ribs, Z + 3.4, SPZ, 1.5, m.boneS, m.bone));
    parts.push(box(-0.9, PY - 9, 0.9, PY + 9, SPZ - 1.4, SPZ, m.boneS, m.bone, { ao: 0.2 }));
    parts.push(spikes(spk.map((q) => q.slice(0, 5)), 0, 1, m.boneS, m.boneT, { z0: Math.min.apply(null, spk.map((q) => q[5])), z1: Math.max.apply(null, spk.map((q) => q[5] + q[6])), shape: spikeShape(spk) }));
    // weapon racks at the front corners (posts, spears, shields)
    const racks = [[-22, 20], [22, 20]], wood = [], iron = [], shields = [];
    for (const r of racks) {
      const x0 = r[0] - 4, x1 = r[0] + 4;
      wood.push(rectXZ(x0, Z, x0 + 0.7, Z + 6.6), rectXZ(x1 - 0.7, Z, x1, Z + 6.6), rectXZ(x0, Z + 5.4, x1, Z + 6), rectXZ(x0, Z + 2.2, x1, Z + 2.7));
      for (let x = x0 + 1.3; x < x1 - 0.8; x += 1.3) { iron.push(rectXZ(x - 0.14, Z + 0.4, x + 0.14, Z + 9)); iron.push(diamond(x, Z + 9.5, 0.4, 0.9)); }
      shields.push({ p: ngon(10, 1.6, 0, r[0] - 1.8, Z + 3.3), y0: r[1] + 0.7, y1: r[1] + 1.1 }, { p: ngon(10, 1.6, 0, r[0] + 2, Z + 3.1), y0: r[1] + 0.7, y1: r[1] + 1.1 });
    }
    parts.push(elev(iron, racks[0][1] - 0.5, racks[0][1] - 0.2, m.iron, m.ironT, { ao: 0.1 }));
    parts.push(elev(wood, racks[0][1] - 0.2, racks[0][1] + 0.5, m.woodD, m.woodT, { ao: 0.2 }));
    parts.push(elev(shields, 0, 0, m.ban, m.boneT, { ao: 0.25 }));
    // banners on poles before the hall, braziers at the pit gate
    parts.push(...banners([[-26.5, -4, 17, 4.4, 8, true], [26.5, -4, 17, 4.4, 8, true]], m));
    parts.push(...braziers([[-6.5, 25, 3.2, 1.6], [6.5, 25, 3.2, 1.6]], m));
    return { r: 37, h: 34, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * FARM — corpse garden and bone-mill: a dark plank barn, a stone mill
   * whose bone-spar sails turn (anims 4) to grind bones, grave-mound rows
   * sprouting sickly glow, a skeletal scarecrow and a bone picket fence.
   * ===================================================================== */
  M.undead_farm = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1;
    const base = [-29, -27, -8, -28, 22, -27, 31, -22, 33, 2, 31, 26, 4, 27.5, -30, 26, -33, 10, -32, -18];
    parts.push(polyPart(base, 0, Z, mx(m.earth, m.dark, 0.2), mx(m.earth, m.earthT, 0.45), { ao: 0.3, detail: (c) => {
      // furrowed grave rows
      c.save(); c.beginPath(); S.poly(c, base); c.clip();
      c.fillStyle = cs(m.earth, 0.5); c.fillRect(-28, 4, 46, 20);
      S.lines(c, 'rgba(0,0,0,0.25)', 0.5, [-28, 8.5, 18, 8.5, -28, 14.5, 18, 14.5, -28, 20.5, 18, 20.5]);
      c.restore();
      boneBits(c, m, [[24, 14, 0.4], [27, 20, 2.2, 1.2], [-29, -10, 1.2], [8, -4, 0.3]]);
      c.fillStyle = cs(m.trimS, 0.35); c.beginPath(); c.rect(-12, -4, 6, 30); c.fill();
    } }));
    // ---- dark barn (back left): stone footing, plank walls, gable to the camera
    const bx0 = -28, bx1 = -6, by0 = -24, by1 = -5;
    parts.push(box(bx0, by0, bx1, by1, Z, Z + 1.6, m.wallD, m.trimS, { ao: 0.2 }));
    parts.push(box(bx0 + 0.4, by0 + 0.4, bx1 - 0.4, by1 - 0.4, Z + 1.6, 11.5, m.wood, m.woodT, { ao: 0.3 }));
    const planks = [];
    for (let x = bx0 + 1.5; x < bx1 - 0.6; x += 1.5) planks.push(rectXZ(x - 0.12, Z + 1.6, x + 0.12, 11.4));
    parts.push(elev(planks, by1 - 0.5, by1 - 0.25, m.woodD, m.woodD, { ao: 0 }));
    const bc = (bx0 + bx1) / 2;
    const RO = { x: bc, y: (by0 + by1) / 2, L: (by1 - by0) / 2 + 1.4, W: (bx1 - bx0) / 2 + 1.4, z0: 11.5, h: 11, axis: 'y', lit: m.roofL, shade: m.roofS, ridge: m.bone, step: 2.2 };
    parts.push(...gable(RO));
    parts.push(roofLines(RO, m.roofLn));
    parts.push(roofHole(RO, 'left', 2, 5, 2.6, 2.2, m.void));
    const gy = RO.y + RO.L;
    parts.push(elev([triXZ(bx0 + 0.4, bx1 - 0.4, 11.5, 11.5 + RO.h * ((bx1 - bx0) / 2 - 0.4) / RO.W)], gy - 0.9, gy, m.wood, m.woodT, { ao: 0.2 }));
    // barn doors with bone cross-braces, hay loft glowing
    parts.push(elev([rectXZ(bc - 5.2, Z, bc + 5.2, Z + 9), rectXZ(bc - 2, 13.5, bc + 2, 17)], gy - 0.1, gy + 0.4, m.woodD, m.wood, { ao: 0.2 }));
    parts.push(elev([rectXZ(bc - 1.4, 14, bc + 1.4, 16.5)], gy + 0.4, gy + 0.6, m.glowS, m.glow, { flat: true, ao: 0.4 }));
    const brace = (x0, x1) => [[x0, Z + 0.6, x0 + 0.8, Z + 0.6, x1, Z + 8.2, x1 - 0.8, Z + 8.2], [x1 - 0.8, Z + 0.6, x1, Z + 0.6, x0 + 0.8, Z + 8.2, x0, Z + 8.2]];
    parts.push(elev(brace(bc - 5, bc - 0.3).concat(brace(bc + 0.3, bc + 5), [rectXZ(bc - 5.2, Z + 8.2, bc + 5.2, Z + 9), rectXZ(bc - 0.25, Z, bc + 0.25, Z + 9)]), gy + 0.4, gy + 0.8, m.boneS, m.bone, { ao: 0.15 }));
    // ---- bone-mill (back right): round stone tower, conical cap, turning bone sails
    const mx0 = 16, my0 = -14, mr = 6.5, MZ = 22;
    parts.push(drums([[mx0, my0, mr + 1.2, Z, Z + 2.4], [mx0, my0, mr, Z, MZ]], Z, MZ, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(drums([[mx0, my0, mr + 0.8]], MZ, MZ + 1.4, m.corn, m.cornT, { ao: 0.2 }));
    parts.push(...cones([[mx0, my0, mr + 1.6]], MZ + 1.4, 9, m.roofL, m.roofS, { pw: 1.1 }));
    parts.push(arcWins([[mx0, my0, mr, PI / 2, Z, 6, 3.2], [mx0, my0, mr, PI * 0.3, 11, 3.6, 1.2]], m.woodD, m.wood, { flat: false, ao: 0.2 }));
    parts.push(arcWins([[mx0, my0, mr + 0.4, PI * 0.3, 11.4, 2.8, 0.7], [mx0, my0, mr, PI * 0.7, 14, 3, 1]], m.glow, m.glowT));
    // sails: four bone spars with tattered cloth, rotating in the facade plane
    const hubZ = MZ - 3, sy0 = my0 + mr + 1.4, SL = 12;
    const sail = (an, cloth) => {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const a = an * (TAU / 4) + i * TAU / 4 + 0.35, ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca;
        if (!cloth) { const w = 0.55; out.push([mx0 + px * w, hubZ + pz * w, mx0 + ca * SL + px * w, hubZ + sa * SL + pz * w, mx0 + ca * SL - px * w, hubZ + sa * SL - pz * w, mx0 - px * w, hubZ - pz * w]); }
        else { const r0 = 3.2, r1 = SL - 0.8, w0 = 0.6, w1 = 3.2 - (i % 2) * 0.8; out.push([mx0 + ca * r0 + px * w0, hubZ + sa * r0 + pz * w0, mx0 + ca * r1 + px * w1, hubZ + sa * r1 + pz * w1, mx0 + ca * r1 + px * 0.5, hubZ + sa * r1 + pz * 0.5, mx0 + ca * r0 + px * 0.5, hubZ + sa * r0 + pz * 0.5]); }
      }
      return out;
    };
    parts.push(elev((an) => sail(an, true), sy0 - 0.2, sy0 + 0.1, mx(m.p.s, m.p.k, 0.3), mx(m.p.s, m.p.k, 0.15), { ao: 0.25, z0: hubZ - SL - 0.5, z1: hubZ + SL + 0.5 }));
    parts.push(elev((an) => sail(an, false), sy0 + 0.1, sy0 + 0.6, m.woodD, m.woodT, { ao: 0.2, z0: hubZ - SL - 0.5, z1: hubZ + SL + 0.5 }));
    parts.push(elev(skullP(mx0, hubZ, 1.4), sy0 + 0.6, sy0 + 1.2, m.boneS, m.bone));
    parts.push(elev(skullEyes(mx0, hubZ, 1.4), sy0 + 1.2, sy0 + 1.4, m.glow, m.glowT, { flat: true, ao: 0 }));
    // bone heap waiting for the millstones
    parts.push({ z0: Z, z1: Z + 3.6, side: m.boneS, top: m.bone, ao: 0.35, shape: (c, zt) => { const k = 1 - zt * 0.75; S.blob(c, 25, -3, 4.2 * k, 3, 9, 0.45); S.blob(c, 21.5, -0.5, 2.6 * k, 4, 8, 0.4); } ,
      detail: (c) => boneBits(c, m, [[25, -3.4, 0.6, 1.4], [24.6, -2.6, 2.2, 1.2]]) });
    // ---- corpse garden: grave mounds with bone markers and glowing sprouts
    const mounds = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) mounds.push([-24 + i * 9.4 + (r % 2) * 2.2, 6.5 + r * 6]);
    parts.push({ z0: Z, z1: Z + 1.8, side: m.earth, top: m.earthT, ao: 0.3, bevel: false, shape: (c, zt) => { for (const q of mounds) S.ell(c, q[0], q[1], 3.4 * (1 - zt * 0.5), 1.8 * (1 - zt * 0.55)); } });
    const marks = mounds.filter((q, i) => i % 2 === 0).map((q) => [q[0] - 2.6, q[1] - 0.6]);
    parts.push({ z0: Z, z1: Z + 4.2, side: m.boneS, top: m.boneT, ao: 0.25, bevel: false, shape: (c, zt) => {
      const z = zt * 4.2;
      for (const q of marks) { c.rect(q[0] - 0.3, q[1] - 0.3, 0.6, 0.6); if (z > 2.6 && z < 3.3) c.rect(q[0] - 1.2, q[1] - 0.25, 2.4, 0.5); }
    } });
    parts.push({ z0: Z + 1, z1: Z + 2.8, side: m.glowS, top: m.glowT, flat: true, ao: 0.3, bevel: false, shape: (c, zt) => {
      mounds.forEach((q, i) => { const k = 1 - zt; S.circ(c, q[0] + 0.8, q[1] - 0.2, 0.55 * k + 0.1); if (i % 3 === 1) S.circ(c, q[0] - 1, q[1] + 0.4, 0.45 * k + 0.1); });
    } });
    // skeletal scarecrow on a pole
    parts.push(elev([rectXZ(-0.35, Z, 0.35, Z + 11), rectXZ(-4, Z + 8, 4, Z + 8.6)], 16.7, 17.3, m.woodD, m.woodT, { ao: 0.25 }));
    parts.push(elev([[-0.9, Z + 5, 0.9, Z + 5, 1.6, Z + 8.4, -1.6, Z + 8.4], rectXZ(-3.6, Z + 7.6, -2.9, Z + 8.4), rectXZ(2.9, Z + 7.6, 3.6, Z + 8.4)], 17.3, 17.6, m.banS, m.ban, { ao: 0.3 }));
    parts.push(skulls3d([[0, 17, Z + 10.6, 1.05]], m));
    // bone picket fence along the front, gate gap on the path
    const pick = [];
    for (let x = -30; x <= 30.1; x += 2) if (x < -13 || x > -5) pick.push([x, 25, 0.4]);
    parts.push(spikes(pick, Z, 4.4, m.boneS, m.boneT, { ao: 0.2 }));
    parts.push(box(-30, 24.75, -13, 25.25, Z + 2.2, Z + 2.7, m.boneS, m.bone, { bevel: false, shape: (c) => { c.rect(-30, 24.75, 17, 0.5); c.rect(-5, 24.75, 35, 0.5); } }));
    return { r: 37, h: 36, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * STABLE — nightmare stables: a long low stable block whose dark stall
   * doors show pairs of burning eyes, a loft tower, rotten hay, a bone-fenced
   * paddock corner with a trough of green ooze and scorched hoofprints.
   * ===================================================================== */
  M.undead_stable = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1.2, hay = mx(mx(m.p.s, m.p.w, 0.5), m.p.g, 0.14), hayT = mx(mx(m.p.s, m.p.w, 0.25), m.p.g, 0.14);
    const base = [-29, -20, 29, -20, 31, -16, 31, 22, -31, 22, -31, -16];
    parts.push(polyPart(base, 0, Z, m.wallD, m.floorT, { ao: 0.3, detail: (c) => {
      flagstones(c, rectP(-31, -20, 31, 0), 2.8, 31);
      c.save(); c.beginPath(); S.poly(c, base); c.clip(); c.fillStyle = cs(m.earth, 0.6); c.fillRect(0, 2, 32, 21); c.restore();
      // scorched hoofprints in the paddock
      for (const q of [[8, 8], [11, 10.5], [14, 7.5], [17, 10], [20, 13], [12, 15], [23, 9], [9, 18], [19, 18]]) { c.fillStyle = 'rgba(10,8,12,0.55)'; c.beginPath(); S.ell(c, q[0], q[1], 0.75, 0.55); c.fill(); glowDot(c, m.glow, q[0], q[1], 1.1, 0.25); }
      boneBits(c, m, [[-25, 14, 0.4], [-14, 18, 2.2, 1.2], [26, 20, 1]]);
      for (let i = 0; i < 40; i++) { const x = -30 + U.hash2(i, 5, 3) * 30, y = -1 + U.hash2(i, 6, 3) * 22, a = U.hash2(i, 7, 3) * PI; S.lines(c, cs(hayT, 0.7), 0.3, [x, y, x + Math.cos(a) * 1.1, y + Math.sin(a) * 0.6]); }
    } }));
    // stable block
    const sx0 = -27, sx1 = 2, sy0 = -18, sy1 = -3, Z1 = 9;
    parts.push(box(sx0, sy0, sx1, sy1, Z, Z1, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(courses([[sx0, sx1, sy1]], Z, Z1, 2.2, mx(m.wall, m.dark, 0.4)));
    const stalls = [-22.5, -16.5, -10.5, -4.5];
    parts.push(elev(stalls.map((x) => archP(x, Z, 4.6, 6.8)), sy1 - 0.1, sy1 + 0.45, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev(stalls.map((x) => archP(x, Z, 3.4, 6.2)), sy1 + 0.45, sy1 + 0.6, m.void, m.dark, { ao: 0 }));
    // burning eyes in the dark stalls (alternating green / violet)
    const eyesG = [], eyesV = [];
    stalls.forEach((x, i) => { const e = [diamond(x - 0.75, Z + 4.4, 0.42, 0.3), diamond(x + 0.75, Z + 4.4 + (i % 2) * 0.2, 0.42, 0.3)]; (i % 2 ? eyesV : eyesG).push(...e); });
    parts.push(elev(eyesG, sy1 + 0.6, sy1 + 0.75, m.glow, m.glowT, { flat: true, ao: 0 }));
    parts.push(elev(eyesV, sy1 + 0.6, sy1 + 0.75, m.vio, m.vioT, { flat: true, ao: 0 }));
    // half doors (wood) with iron straps
    parts.push(elev(stalls.map((x) => rectXZ(x - 1.8, Z, x + 1.8, Z + 3)), sy1 + 0.75, sy1 + 1.1, m.woodD, m.woodT, { ao: 0.2 }));
    parts.push(elev(stalls.map((x) => rectXZ(x - 1.8, Z + 2.1, x + 1.8, Z + 2.5)), sy1 + 1.1, sy1 + 1.25, m.iron, m.ironT, { ao: 0 }));
    parts.push(box(sx0 - 0.9, sy0 - 0.9, sx1 + 0.9, sy1 + 0.9, Z1, Z1 + 1, m.corn, m.cornT, { ao: 0.15 }));
    const RO = { x: (sx0 + sx1) / 2, y: (sy0 + sy1) / 2, L: (sx1 - sx0) / 2 + 1.4, W: (sy1 - sy0) / 2 + 1.4, z0: Z1 + 1, h: 7.5, lit: m.roofL, shade: m.roofS };
    parts.push(...hipRoof(RO));
    parts.push(hipLines(RO, m.roofLn, 2));
    parts.push(hipRidges(RO, m.boneS, m.bone, 0.42));
    // hay loft tower at the right end
    const lx0 = 2, lx1 = 14, ly0 = -19, ly1 = -5, LZ = 14;
    parts.push(box(lx0, ly0, lx1, ly1, Z, LZ, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(courses([[lx0, lx1, ly1]], Z, LZ, 2.2, mx(m.wall, m.dark, 0.4)));
    parts.push(elev([archP(8, Z, 5.2, 7.4), rectXZ(6, 9, 10, 12.4)], ly1 - 0.1, ly1 + 0.45, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev([archP(8, Z, 4, 6.8)], ly1 + 0.45, ly1 + 0.6, m.woodD, m.wood, { ao: 0.3 }));
    parts.push(elev([rectXZ(6.6, 9.5, 9.4, 12)], ly1 + 0.45, ly1 + 0.6, m.void, m.void, { ao: 0 }));
    parts.push(elev([[6.7, 9.5, 9.3, 9.5, 9.3, 10.6, 8.6, 11.2, 7.6, 10.4, 6.7, 11]], ly1 + 0.6, ly1 + 0.9, hay, hayT, { ao: 0.2 }));
    parts.push(box(lx0 - 0.8, ly0 - 0.8, lx1 + 0.8, ly1 + 0.8, LZ, LZ + 1, m.corn, m.cornT, { ao: 0.15 }));
    const LO = { x: (lx0 + lx1) / 2, y: (ly0 + ly1) / 2, L: (lx1 - lx0) / 2 + 1.2, W: (ly1 - ly0) / 2 + 1.2, z0: LZ + 1, h: 11, pw: 1.25, lit: m.roofL, shade: m.roofS };
    parts.push(...hipRoof(LO));
    parts.push(hipLines(LO, m.roofLn, 2));
    parts.push(hipRidges(LO, m.boneS, m.bone, 0.4));
    parts.push(spikes([[LO.x, LO.y, 0.6]], LZ + 11.6, 5, m.iron, m.boneT));
    // rotten hay bales and a skull lantern post
    // skull-topped hitching posts before the stalls
    parts.push(drums([[-19.5, 0.4, 0.6], [-7.5, 0.4, 0.6]], Z, Z + 5, m.iron, m.ironT, { ao: 0.2 }));
    parts.push(skulls3d([[-19.5, 0.4, Z + 5, 0.9], [-7.5, 0.4, Z + 5, 0.9]], m));
    parts.push({ z0: Z, z1: Z + 6, side: hay, top: hayT, ao: 0.3, shape: (c, zt) => { if (zt < 0.5) { S.rrect(c, -29, 2, 5, 3.2, 0.8); S.rrect(c, -24, 1.4, 5, 3.2, 0.8); S.rrect(c, -27, 5.6, 5, 3.2, 0.8); } else S.rrect(c, -26.5, 2.4, 5, 3.2, 0.8); },
      detail: (c) => S.lines(c, 'rgba(40,30,20,0.5)', 0.35, [-25, 2.4, -25, 5.6]) });
    // paddock fence (bone posts + iron rails) and the ooze trough
    const posts = [];
    for (let x = 4; x <= 30.1; x += 3.25) posts.push([x, 21.5, 0.55]);
    for (let y = 2; y < 21; y += 3.2) posts.push([30.5, y, 0.55]);
    parts.push(spikes(posts, Z, 5.6, m.boneS, m.boneT, { ao: 0.2, shape: function (c, zt) { const k = zt > 0.82 ? 1 - (zt - 0.82) * 4 : 1; for (const q of posts) S.circ(c, q[0], q[1], q[2] * Math.max(0.2, k)); } }));
    parts.push({ z0: Z + 2, z1: Z + 4.4, side: m.iron, top: m.ironT, ao: 0, bevel: false, shape: (c, zt) => { if (zt > 0.25 && zt < 0.75) return; c.rect(4, 21.2, 26.5, 0.5); c.rect(30.2, 2, 0.5, 19.7); } });
    parts.push(box(17, 2.6, 26, 5.4, Z, Z + 2.6, m.woodD, m.woodT, { ao: 0.3 }));
    parts.push(box(17.6, 3.2, 25.4, 4.8, Z + 2.6, Z + 2.7, m.glow, m.glowT, { flat: true, bevel: false, detail: (c) => { glowDot(c, m.glow, 21.5, 4, 5, 0.4); S.dot(c, m.glowT, 19.5, 3.7, 0.4); S.dot(c, m.glowT, 23.4, 4.3, 0.3); } }));
    parts.push(...braziers([[1, 0.5, 6.5, 1.1]], m, m.vio));
    return { r: 36, h: 32, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * MAGE TOWER — necromancer's spire: buttressed black tower, rune band,
   * bone claws cradling a pulsing soul orb, orbiting bone shards (anims 4).
   * ===================================================================== */
  M.undead_magetower = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 2, R1 = 10, Z1 = 26, R2 = 7.4, Z2 = 50, OZ = 63;
    parts.push({ z0: 0, z1: Z, side: m.wallD, top: m.floorT, ao: 0.3, shape: (c) => S.poly(c, ngon(8, 16, PI / 8)), detail: (c) => {
      flagstones(c, ngon(8, 16, PI / 8), 2.6, 41);
      c.save(); c.strokeStyle = cs(m.glow, 0.55); c.lineWidth = 0.45; c.beginPath(); S.poly(c, ngon(8, 14.2, PI / 8)); c.stroke(); c.restore();
      glowDot(c, m.glow, 0, 13, 6, 0.3);
    } });
    // lower tower with bone flying ribs (back pair drawn before the tower)
    const rib = (a) => ribF(Math.cos(a) * R1 * 0.9, Math.sin(a) * R1 * 0.9, Z1 - 2, Math.cos(a) * 15, Math.sin(a) * 15, Z);
    parts.push(curves([rib(PI * 1.25), rib(PI * 1.75)], Z, Z1 - 2, 1.7, m.boneS, m.bone));
    parts.push({ z0: Z, z1: Z1, side: m.wall, top: m.wallT, ao: 0.3, shape: (c, zt) => S.poly(c, ngon(8, R1 * (1 - zt * 0.08), PI / 8)) });
    parts.push(courses([[-R1 * 0.38, R1 * 0.38, R1 * 0.92]], Z, Z1, 2.4, mx(m.wall, m.dark, 0.4)));
    parts.push(curves([rib(PI * 0.25), rib(PI * 0.75)], Z, Z1 - 2, 1.7, m.boneS, m.bone));
    parts.push(elev([lancet(0, Z, 5.6, 9, 0.6)], R1 * 0.92 - 0.1, R1 * 0.92 + 0.5, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev([lancet(0, Z, 4, 8.2, 0.6)], R1 * 0.92 + 0.5, R1 * 0.92 + 0.7, m.glowS, m.glow, { flat: true, ao: 0.5 }));
    parts.push({ z0: Z1, z1: Z1 + 1.6, side: m.corn, top: m.cornT, ao: 0.2, shape: (c) => S.poly(c, ngon(8, R1 + 0.6, PI / 8)) });
    parts.push(merlonsRing(0, 0, R1 - 0.4, 12, Z1 + 1.6, 3, 1.6, m.wall, m.trim));
    // upper shaft with rune band and violet lancets
    parts.push(drums([[0, 0, R2]], Z1 + 1.6, Z2, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(arcWins([[0, 0, R2, PI * 0.5, Z1 + 10, 7, 1.8], [0, 0, R2, PI * 0.22, Z1 + 11, 5, 1.2], [0, 0, R2, PI * 0.78, Z1 + 11, 5, 1.2]], m.vio, m.vioT));
    parts.push(runeArcs([[0, 0, R2]], Z2 - 5, m.glow, m.glowT, 17));
    // bowl platform and bone claws
    parts.push({ z0: Z2, z1: Z2 + 2.4, side: m.corn, top: m.wallT, ao: 0.25, shape: (c, zt) => S.circ(c, 0, 0, R2 + 0.5 + zt * 2.2),
      detail: (c, an) => { S.dot(c, m.void, 0, 0, 5.4); glowDot(c, m.glow, 0, 0, 6.5, 0.55 + 0.3 * Math.sin(an * TAU)); } });
    const claws = [];
    for (let i = 0; i < 5; i++) { const a = PI * 0.5 + (i + 0.5) / 5 * TAU; claws.push([Math.cos(a) * 8.4, Math.sin(a) * 8.4, 1.35, -Math.cos(a) * 4.2, -Math.sin(a) * 4.2]); }
    parts.push(spikes(claws, Z2 + 2, 11, m.boneS, m.boneT, { ao: 0.35 }));
    // pulsing soul orb (outer glow + bright core) and orbiting bone shards
    const orb = (k, col, top) => ({ z0: OZ - 5, z1: OZ + 5, side: col, top, flat: true, bevel: false, ao: 0.25, shape: (c, zt, an) => {
      const R = (3.6 + 0.7 * Math.sin(an * TAU)) * k, u = (zt - 0.5) * 10 / R;
      if (Math.abs(u) > 1) return;
      S.circ(c, 0, 0, R * Math.sqrt(1 - u * u) + 0.05);
    } });
    parts.push(orb(1, m.glow, m.glowT));
    parts.push(orb(0.55, m.glowT, '#ffffff'));
    parts.push({ z0: OZ - 1.5, z1: OZ + 1.5, side: m.boneS, top: m.bone, ao: 0.3, bevel: false, shape: (c, zt, an) => {
      for (let i = 0; i < 4; i++) { const a = an * TAU / 4 + i * TAU / 4, r = 8.2, x = Math.cos(a) * r, y = Math.sin(a) * r * 0.9, k = 1 - Math.abs(zt - 0.5) * 1.6; S.poly(c, [x - 1.1 * k, y, x, y - 0.5 * k, x + 1.1 * k, y, x, y + 0.5 * k]); }
    } });
    parts.push({ z0: OZ - 0.2, z1: OZ, side: m.vio, top: m.vioT, flat: true, bevel: false, stroke: 0.55, shape: (c, zt, an) => { S.ell(c, 0, 0, 6.2 + 1.1 * Math.sin(an * TAU + 1), 5.2 + 0.9 * Math.sin(an * TAU + 1)); } });
    return { r: 19, h: OZ + 7, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * ARCHER TOWER — battered black shaft with bone-capped buttresses and
   * anti-dragon iron spikes, machicolated archer platform with spiked
   * merlons, a stair turret with a needle spire, banner and brazier.
   * ===================================================================== */
  M.undead_tower = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1.6, B0 = 11, B1 = 8.6, TZ = 40, P = 11.4, PZ = 44;
    parts.push(polyPart(rectP(-14, -14, 14, 14), 0, Z, m.wallD, m.floorT, { ao: 0.3, detail: (c) => { flagstones(c, rectP(-14, -14, 14, 14), 2.6, 51); boneBits(c, m, [[-11, 12, 0.5], [10, 11, 2.3, 1.2]]); } }));
    // stair turret (back left) with needle spire
    const st = [-B1 - 1, -B1 - 1, 3.6];
    parts.push(drums([[st[0], st[1], st[2], Z, 52]], Z, 52, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(drums([[st[0], st[1], st[2] + 0.8, 52, 53.4]], 52, 53.4, m.corn, m.cornT, { ao: 0.2 }));
    // shaft: battered, tapering
    parts.push({ z0: Z, z1: TZ, side: m.wall, top: m.wallT, ao: 0.3, shape: (c, zt) => { const h = B0 + (B1 - B0) * zt; c.rect(-h, -h, h * 2, h * 2); } });
    parts.push(courses([[-B1, B1, B1 + 0.3]], Z + 2, TZ, 2.6, mx(m.wall, m.dark, 0.4)));
    // corner buttresses capped with bone
    parts.push({ z0: Z, z1: TZ - 6, side: m.wall, top: m.cornT, ao: 0.3, shape: (c, zt) => {
      const h = B0 + (B1 - B0) * zt * (TZ - 6 - Z) / (TZ - Z), d = 2.4 * (1 - zt * 0.5);
      for (const sx of [-1, 1]) c.rect(sx > 0 ? h - 1.6 : -h - d + 1.6, h - 1.6, d, d);
    } });
    // arrow slits
    parts.push(elev([lancet(-4, 10, 1.6, 4.4), lancet(4, 10, 1.6, 4.4), lancet(0, 20, 1.6, 4.4), lancet(-4, 30, 1.6, 4), lancet(4, 30, 1.6, 4)], B1 + 1.2, B1 + 1.5, m.glow, m.glowT, { flat: true, ao: 0.2, shape: function (c, zt) {
      const z = this.z0 + zt * (this.z1 - this.z0), dz = dzOf(this.z0, this.z1);
      for (const pg of [lancet(-4, 10, 1.6, 4.4), lancet(4, 10, 1.6, 4.4), lancet(0, 20, 1.6, 4.4), lancet(-4, 30, 1.6, 4), lancet(4, 30, 1.6, 4)]) {
        const iv = bandX(pg, z - dz * 0.55, z + dz * 0.55); if (!iv) continue;
        const yf = B0 + (B1 - B0) * (z - Z) / (TZ - Z) + 0.15; c.rect(iv[0], yf - 0.3, Math.max(0.06, iv[1] - iv[0]), 0.5);
      }
    } }));
    // anti-dragon spikes jutting from the shaft corners
    const sp = [];
    for (const sx of [-1, 1]) for (const sy2 of [-1, 1]) sp.push([sx * 9.6, sy2 * 9.6, 0.8, sx * 5.5, sy2 * 5.5]);
    parts.push(spikes(sp, 24, 7, m.iron, m.ironT, { ao: 0.2 }));
    // machicolations + platform with spiked merlons
    parts.push({ z0: TZ, z1: PZ, side: m.wall, top: m.wallT, ao: 0.25, shape: (c, zt) => { const h = zt < 0.35 ? B1 + (P - B1) * zt / 0.35 : P; c.rect(-h, -h, h * 2, h * 2); } });
    const corb = [];
    for (let x = -P + 1.6; x < P - 1; x += 2.6) corb.push(rectXZ(x - 0.5, TZ + 0.4, x + 0.5, TZ + 1.6));
    parts.push(elev(corb, P + 0.1 - 1.4, P + 0.1, m.void, m.void, { ao: 0, shape: function (c, zt) {
      const z = this.z0 + zt * (this.z1 - this.z0), dz = dzOf(this.z0, this.z1), yf = B1 + (P - B1) * Math.min(1, (z - TZ) / (0.35 * (PZ - TZ))) + 0.1;
      for (const pg of corb) { const iv = bandX(pg, z - dz * 0.55, z + dz * 0.55); if (iv) c.rect(iv[0], yf - 0.3, iv[1] - iv[0], 0.5); }
    } }));
    parts.push(box(-P - 0.4, P - 0.4, P + 0.4, P + 0.5, PZ - 1.4, PZ, m.corn, m.cornT, { ao: 0.15, bevel: false }));
    parts.push(box(-P + 2, -P + 2, P - 2, P - 2, PZ - 0.2, PZ, m.floor, m.floorT, { bevel: false, detail: (c) => { flagstones(c, rectP(-P + 2, -P + 2, P - 2, P - 2), 2.2, 52); S.dot(c, m.void, -5, -5, 1.4); } }));
    parts.push(merlonsRect(-P + 1, -P + 1, P - 1, P - 1, PZ, 4.4, 2.4, 2, m.wall, m.trim));
    // skull corbels under the platform front
    parts.push(elev([-6, 0, 6].reduce((a, x) => a.concat(skullP(x, TZ + 2.2, 1.1)), []), P + 0.2, P + 0.8, m.boneS, m.bone));
    parts.push(elev([-6, 0, 6].reduce((a, x) => a.concat(skullEyes(x, TZ + 2.2, 1.1).slice(0, 2)), []), P + 0.8, P + 1, m.glow, m.glowT, { flat: true, ao: 0 }));
    // front corner bartizans (corbelled out, glowing slits) + all spires
    const bz = [[-P + 0.4, P - 0.4, 2.5], [P - 0.4, P - 0.4, 2.5]];
    parts.push(drums(bz.map((q) => [q[0], q[1], q[2], TZ - 3, PZ + 3.6]), TZ - 3, PZ + 3.6, m.wall, m.wallT, { ao: 0.25, shape: function (c, zt) { const z = this.z0 + zt * (this.z1 - this.z0), k = z < TZ ? 0.45 + 0.55 * (z - TZ + 3) / 3 : 1; for (const q of bz) S.circ(c, q[0], q[1], q[2] * k); } }));
    parts.push(arcWins(bz.map((q) => [q[0], q[1], q[2], PI / 2, PZ - 0.6, 2.8, 0.8]), m.glow, m.glowT));
    parts.push(...cones([[st[0], st[1], st[2] + 1.4, 53.4, 13]].concat(bz.map((q) => [q[0], q[1], q[2] + 0.8, PZ + 3.6, 7.5])), 0, 1, m.roofL, m.roofS, { pw: 1.3 }));
    parts.push(spikes([[st[0], st[1], 0.5, 0, 0, 65.5, 4]].concat(bz.map((q) => [q[0], q[1], 0.4, 0, 0, PZ + 10.4, 3])).map((q) => q.slice(0, 5)), 0, 1, m.iron, m.boneT, { z0: PZ + 10.4, z1: 69.5, shape: spikeShape([[st[0], st[1], 0.5, 0, 0, 65.5, 4]].concat(bz.map((q) => [q[0], q[1], 0.4, 0, 0, PZ + 10.4, 3]))) }));
    // brazier on the platform, banner hanging from the parapet
    parts.push(...braziers([[3.5, 2, PZ + 1.6, 1.6]], m).map((p) => { p.z0 = Math.max(p.z0, PZ); return p; }));
    parts.push(...banners([[0, P + 0.7, PZ - 1.6, 4.6, 10, false]], m));
    return { r: 17, h: 72, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * WATCHTOWER — gaunt octagonal needle with bone stays, a lookout ring of
   * iron spikes and a caged green beacon fire on top (anims 4).
   * ===================================================================== */
  M.undead_watchtower = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1.4, R0 = 5.6, R1 = 4.4, TZ = 48, PR = 7.6, PZ = 50.5;
    parts.push({ z0: 0, z1: Z, side: m.wallD, top: m.floorT, ao: 0.3, shape: (c) => S.poly(c, ngon(8, 10, PI / 8)), detail: (c) => { flagstones(c, ngon(8, 10, PI / 8), 2.2, 61); boneBits(c, m, [[-6, 6, 0.4], [6.5, 5, 2.1, 1.2]]); } });
    // bone stays from mid height to the ground (the back one drawn before the shaft)
    const stay = (a) => ribF(Math.cos(a) * R0 * 0.9, Math.sin(a) * R0 * 0.9, 24, Math.cos(a) * 9.4, Math.sin(a) * 9.4, Z);
    parts.push(curves([stay(PI * 1.5)], Z, 24, 1.3, m.boneS, m.bone));
    parts.push({ z0: Z, z1: Z + 3, side: m.wall, top: m.trimS, ao: 0.3, shape: (c) => S.poly(c, ngon(8, R0 + 1.4, PI / 8)) });
    parts.push({ z0: Z + 3, z1: TZ, side: m.wall, top: m.wallT, ao: 0.3, shape: (c, zt) => S.poly(c, ngon(8, R0 + (R1 - R0) * zt, PI / 8)) });
    parts.push(curves([stay(PI * 0.17), stay(PI * 0.83)], Z, 24, 1.3, m.boneS, m.bone));
    // slit windows up the shaft
    parts.push(arcWins([[0, 0, R0 - 0.3, PI * 0.5, 9, 3.4, 1], [0, 0, R0 - 0.6, PI * 0.35, 20, 3.4, 0.9], [0, 0, R1 + 0.3, PI * 0.62, 32, 3.4, 0.9], [0, 0, R1 + 0.1, PI * 0.45, 41, 3, 0.9]], m.glow, m.glowT));
    parts.push(elev([lancet(0, Z, 2.8, 5.2, 0.6)], R0 * 0.92 + 0.5, R0 * 0.92 + 0.9, m.woodD, m.wood, { ao: 0.2 }));
    // lookout: corbelled ring, floor, iron railing spikes
    parts.push({ z0: TZ - 2, z1: PZ, side: m.wall, top: m.wallT, ao: 0.25, shape: (c, zt) => S.poly(c, ngon(8, R1 + (PR - R1) * Math.min(1, zt * 1.6), PI / 8)) });
    parts.push({ z0: PZ - 0.6, z1: PZ + 0.4, side: m.corn, top: m.cornT, ao: 0.1, bevel: false, shape: (c) => annulus(c, 0, 0, PR + 0.3, PR - 1.2) });
    const rail = [];
    for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; rail.push([Math.cos(a) * (PR - 0.4), Math.sin(a) * (PR - 0.4), 0.32, Math.cos(a) * 0.8, Math.sin(a) * 0.8]); }
    parts.push(spikes(rail, PZ, 4.2, m.iron, m.ironT, { ao: 0.1 }));
    // beacon cage + green fire
    parts.push({ z0: PZ, z1: PZ + 9, side: m.iron, top: m.ironT, ao: 0.15, bevel: false, shape: (c, zt) => {
      const z = zt * 9, r = z < 2.4 ? 1.6 + z : z < 7 ? 4 : 4 - (z - 7) * 1.5;
      if (z < 2.4) { S.circ(c, 0, 0, r); return; }
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.3); }
      if (z > 8.6) S.circ(c, 0, 0, 1.2);
    } });
    const bf = braziers([[0, 0, PZ + 1.2, 2.9]], m).slice(1);
    for (const f of bf) f.z1 = f.z0 + (f.z1 - f.z0) * 1.45; // flame shape depends only on zt: stretch it taller
    parts.push(...bf);
    parts.push(spikes([[0, 0, 0.5]], PZ + 9, 5, m.iron, m.boneT));
    // banner pole on the ring
    parts.push(...banners([[-PR + 0.6, 1.4, PZ + 9, 3, 6.5, true]], m).map((p) => { if (p.z0 === 0) p.z0 = PZ; return p; }));
    return { r: 14, h: Math.ceil(PZ + 16), parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * WALL SEGMENT — 16 dirs, 40 long along x, ~7 thick. L1 sharpened stake
   * palisade with impaled skulls; L2 black stone curtain with spiked merlons
   * and buttresses; L3 taller black stone with glowing rune bands and eyes.
   * Parts stacked on the same base share its anchor (ties keep authored
   * order); camera-face decorations use mirrored (atA) anchors.
   * ===================================================================== */
  M.undead_wall = function (pal, opt) {
    opt = opt || {};
    const L = lvl(opt), m = mats(pal), parts = [];
    if (L === 1) {
      parts.push(at({ z0: 0, z1: 1.8, side: m.earth, top: m.earthT, ao: 0.3, shape: (c, zt) => { const k = 1 - zt * 0.35; S.rrect(c, -20, -4.6 * k, 40, 9.2 * k, 2); },
        detail: (c) => boneBits(c, m, [[-14, 3.4, 0.3], [9, -3.2, 2.1, 1.2], [16, 3, 1.1], [-4, -3.6, 0.8, 1.2]]) }, 0, 0, -1));
      const stakes = [];
      for (let i = 0; i < 18; i++) { const x = -19.4 + i * 2.28; stakes.push([x, (i % 2 ? 0.9 : -0.9), 1.15, 14 + U.hash2(i, 3, 7) * 3.6]); }
      const ST = Math.max.apply(null, stakes.map((q) => q[3]));
      // lashing rails on both faces (real 3D, true anchors), stakes, raw-wood tips, skulls
      for (const y of [-2.35, 2.35]) parts.push(at({ z0: 5.2, z1: 6.4, side: m.woodD, top: m.woodT, ao: 0.2, shape: (c) => c.rect(-19.8, y - 0.4, 39.6, 0.8) }, 0, y));
      parts.push(at({ z0: 1.2, z1: ST, side: m.wood, top: m.woodT, ao: 0.35, shape: (c, zt) => {
        const z = 1.2 + zt * (ST - 1.2);
        for (const q of stakes) { if (z > q[3]) continue; const k = z > q[3] - 3 ? (q[3] - z) / 3 : 1; S.circ(c, q[0], q[1], q[2] * k + 0.06); }
      } }, 0, 0));
      parts.push(at({ z0: 10, z1: ST, side: mx(m.wood, m.p.s, 0.25), top: mx(m.woodT, m.p.s, 0.45), ao: 0.1, bevel: false, shape: (c, zt) => {
        const z = 10 + zt * (ST - 10);
        for (const q of stakes) { if (z > q[3] || z < q[3] - 3) continue; S.circ(c, q[0], q[1], q[2] * (q[3] - z) / 3 + 0.06); }
      } }, 0, 0));
      parts.push(at(skulls3d(stakes.filter((q, i) => i % 3 === 1).map((q) => [q[0], q[1], q[3] - 1.8, 1.05]), m), 0, 0));
      // sharpened anti-charge stakes at the foot, leaning out on both sides
      const sp = [];
      for (let x = -17; x <= 17; x += 4.25) { sp.push([x, 3.6, 0.45, 0, 2.4]); sp.push([x + 2.1, -3.6, 0.45, 0, -2.4]); }
      parts.push(at(spikes(sp.filter((q) => q[1] > 0), 0.8, 3.8, m.woodD, m.woodT), 0, 3.6));
      parts.push(at(spikes(sp.filter((q) => q[1] < 0), 0.8, 3.8, m.woodD, m.woodT), 0, -3.6));
      return { r: 23, h: 21, parts: withSorter(parts), style: 'unit', bevel: 0.6 };
    }
    const H = L === 2 ? 15 : 17.5, T = L === 2 ? 3.4 : 3.8, Z = 1.4;
    parts.push(at({ z0: 0, z1: Z, side: m.wallD, top: m.floorT, ao: 0.3, shape: (c) => c.rect(-20, -T - 1.2, 40, (T + 1.2) * 2) }, 0, 0, -1));
    parts.push(at(box(-20, -T, 20, T, Z, H, m.wall, m.wallT, { ao: 0.32, detail: (c) => { S.lines(c, SEAM2, 0.3, [-20, 0, 20, 0]); for (let x = -16; x < 20; x += 8) S.lines(c, SEAM2, 0.3, [x, -T, x, T]); } }), 0, 0));
    parts.push(at(merlonsAt((() => { const ml = []; for (let x = -18.6; x <= 18.7; x += 3.1) ml.push(x, T - 0.8, x, -T + 0.8); return ml; })(), H, L === 2 ? 3.4 : 4.2, 1.9, m.wall, m.trim), 0, 0));
    if (L === 3) { const isp = []; for (let x = -17.05; x <= 17.1; x += 3.1) isp.push([x, 0, 0.5]); parts.push(at(spikes(isp, H, 3, m.iron, m.ironT), 0, 0)); }
    // masonry, patches, skulls and runes on whichever face looks at the camera
    const crs = courses([[-20, 20, T]], Z, H - 0.6, 2.6, mx(m.wall, m.dark, 0.4));
    crs.shape = autoFace(crs.shape);
    parts.push(atA(crs, 0, T));
    parts.push(atA(elev([rectXZ(-11.5, Z + 3, -8, Z + 5.2), rectXZ(7, Z + 8, 10.6, Z + 10), rectXZ(-3, Z + 1, 0.4, Z + 3)], T - 0.1, T + 0.3, m.patch, m.patch, { auto: true }), 0, T));
    const bxs = [-13.3, 0, 13.3], fr = [], fe = [];
    if (L === 2) for (const x of [-6.65, 6.65]) { fr.push(...skullP(x, H - 4.4, 1.25)); fe.push(...skullEyes(x, H - 4.4, 1.25)); }
    else {
      for (let x = -18; x <= 18.1; x += 3) { if (bxs.some((b) => Math.abs(b - x) < 2)) continue; fr.push(...skullP(x, H - 2.4, 0.9)); fe.push(...skullEyes(x, H - 2.4, 0.9).slice(0, 2)); }
      fe.push(...runeRow(-19, 19, Z + 5.6, 1.5, 21));
    }
    parts.push(atA(elev(fr, T - 0.05, T + 0.45, m.boneS, m.bone, { auto: true }), 0, T + 0.1));
    parts.push(atA(elev(fe, T + 0.45, T + 0.65, m.glow, m.glowT, { flat: true, ao: 0, auto: true }), 0, T + 0.1));
    // stepped buttresses on both faces (true anchors), L3 glowing eye slits on their fronts
    for (const sy of [-1, 1]) parts.push(at({ z0: Z, z1: H - 3, side: m.wall, top: m.wallT, ao: 0.3, shape: (c, zt) => { const d = zt < 0.45 ? 2.2 : zt < 0.8 ? 1.5 : 0.8; for (const x of bxs) c.rect(x - 1.5, sy > 0 ? T - 0.2 : -T - d, 3, d + 0.2); } }, 0, sy * (T + 1)));
    if (L === 3) parts.push(atA(elev(bxs.map((x) => lancet(x, Z + 2.2, 0.9, 3.4)), T + 2.2, T + 2.45, m.glow, m.glowT, { flat: true, ao: 0, auto: true }), 0, T + 2.3));
    return { r: 23, h: L === 2 ? 21 : 24, parts: withSorter(parts), style: 'unit', bevel: 0.6 };
  };
  // wrap a front-face (+y) shape so it is mirrored to whichever face the camera sees
  const autoFace = (fn) => function (c, zt, an) { const f = faceY(c); if (!f) return; if (f < 0) { c.save(); c.scale(1, -1); } fn.call(this, c, zt, an); if (f < 0) c.restore(); };

  /* =====================================================================
   * GATE — 16 dirs, 40 wide along x, two gate towers. L1 timber stake
   * towers and a bone-braced log gate; L2 black stone towers with spiked
   * pyramid roofs, pointed arch and portcullis; L3 crenellated towers with
   * needle spires, rune-lit arch and a green-glowing warded portcullis.
   * ===================================================================== */
  M.undead_gate = function (pal, opt) {
    opt = opt || {};
    const L = lvl(opt), m = mats(pal), parts = [];
    const TX = 14.6, TW = 5.4, TD = 5, OW = 9.2;
    // camera-facing banner on one tower (anchored with that tower)
    const towerBanner = (cx, zt, w, len, anc) => { for (const p of banners([[cx, TD + 0.5, zt, w, len, false]], m)) { p.shape = autoFace(p.shape); parts.push(atA(p, cx, anc)); } };
    if (L === 1) {
      parts.push(at({ z0: 0, z1: 1.6, side: m.earth, top: m.earthT, ao: 0.3, shape: (c, zt) => { const k = 1 - zt * 0.3; S.rrect(c, -20.5, -6 * k, 41, 12 * k, 2.5); },
        detail: (c) => { c.fillStyle = cs(m.trimS, 0.35); c.fillRect(-OW, -6, OW * 2, 12); boneBits(c, m, [[-3, 4.4, 0.3], [5, -4, 2.1]]); } }, 0, 0, -1));
      // log gate leaves, bone braces (camera face), lintel with hanging skulls
      parts.push(at({ z0: 0.8, z1: 12.5, side: m.wood, top: m.woodT, ao: 0.3, shape: (c, zt) => { for (let x = -OW + 0.9; x < OW; x += 1.84) S.circ(c, x, 0, 0.95 * (zt > 0.88 ? Math.max(0.15, 1 - (zt - 0.88) * 7) : 1)); } }, 0, 0));
      const br = [[-OW + 0.6, 2, -OW + 1.8, 2, -0.6, 11, -1.8, 11], [OW - 0.6, 2, OW - 1.8, 2, 0.6, 11, 1.8, 11], rectXZ(-OW + 0.3, 3.2, OW - 0.3, 4.2), rectXZ(-OW + 0.3, 8.6, OW - 0.3, 9.6)];
      parts.push(atA(elev(br, 0.9, 1.4, m.boneS, m.bone, { auto: true }), 0, 1));
      parts.push(at(box(-TX, -1, TX, 1, 13.6, 15.2, m.woodD, m.woodT, { ao: 0.2 }), 0, 0));
      parts.push(at(skulls3d([[-4.5, 0, 11.4, 0.9], [0, 0, 11, 1.1], [4.5, 0, 11.4, 0.9]], m), 0, 0));
      // stake towers: corner logs, platform, spiked palisade parapet, skulls, beacon flame
      for (const sx of [-1, 1]) {
        const cx = sx * TX, posts = [[cx - TW + 1.2, -TD + 1.2], [cx + TW - 1.2, -TD + 1.2], [cx - TW + 1.2, TD - 1.2], [cx + TW - 1.2, TD - 1.2]];
        parts.push(atA({ z0: 1.2, z1: 15, side: m.wood, top: m.woodT, ao: 0.3, shape: (c, zt) => { for (const p of posts) S.circ(c, p[0], p[1], 1.15); if (zt > 0.35 && zt < 0.42) { c.rect(cx - TW + 0.6, -TD + 0.8, TW * 2 - 1.2, 0.8); c.rect(cx - TW + 0.6, TD - 1.6, TW * 2 - 1.2, 0.8); } } }, cx, TD - 1));
        parts.push(atA(box(cx - TW, -TD, cx + TW, TD, 15, 16.4, m.woodD, m.woodT, { ao: 0.2, detail: (c) => S.lines(c, 'rgba(0,0,0,0.35)', 0.3, [cx - TW, -1.7, cx + TW, -1.7, cx - TW, 1.7, cx + TW, 1.7]) }), cx, TD - 1));
        const pl = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; pl.push([cx - TW + 0.6 + t * (TW * 2 - 1.2), -TD + 0.6, 0.62], [cx - TW + 0.6 + t * (TW * 2 - 1.2), TD - 0.6, 0.62]); }
        for (let i = 1; i < 7; i++) { const t = i / 7; pl.push([cx - TW + 0.6, -TD + 0.6 + t * (TD * 2 - 1.2), 0.62], [cx + TW - 0.6, -TD + 0.6 + t * (TD * 2 - 1.2), 0.62]); }
        parts.push(atA(spikes(pl, 16.4, 5.6, m.wood, mx(m.woodT, m.p.s, 0.45), { ao: 0.2 }), cx, TD - 1));
        parts.push(atA(skulls3d([[cx - TW + 0.6, TD - 0.6, 20.4, 0.95], [cx + TW - 0.6, -TD + 0.6, 20.4, 0.95], [cx + TW - 0.6, TD - 0.6, 20.4, 0.95]], m), cx, TD - 1));
        const fl = braziers([[cx, 0, 16.4, 1.5]], m);
        parts.push(atA(fl[1], cx, TD - 1), atA(fl[2], cx, TD - 1));
      }
      towerBanner(-TX, 14.6, 3.8, 7.5, TD - 1);
      return { r: 24, h: 27, parts: withSorter(parts), style: 'unit', bevel: 0.6 };
    }
    const TH = L === 2 ? 24 : 28, Z = 1.4, AH = L === 2 ? 15 : 17, BT = L === 2 ? 20 : 23, AD = 3.4;
    parts.push(at({ z0: 0, z1: Z, side: m.wallD, top: m.floorT, ao: 0.3, shape: (c) => c.rect(-20.5, -TD - 1.4, 41, (TD + 1.4) * 2),
      detail: (c) => { c.fillStyle = cs(m.trimS, 0.4); c.fillRect(-OW, -TD - 1.4, OW * 2, (TD + 1.4) * 2); if (L === 3) glowDot(c, m.glow, 0, 0, 9, 0.35); } }, 0, 0, -1));
    // arch block with a pointed opening, merlons on its wall-walk
    const asp = Z + AH * 0.55, aw = OW + 0.2;
    const archHW = (z) => { if (z < asp) return aw; const R = aw * 1.5, h = z - asp, x = -(R - aw) + Math.sqrt(Math.max(0, R * R - h * h)); return Math.max(0, x); };
    if (L === 3) parts.push(at({ z0: Z, z1: Z + AH, side: m.glowS, top: m.glowT, flat: true, ao: 0.5, bevel: false, shape: (c, zt) => { const z = Z + zt * AH, hw = archHW(z) - 0.1; if (hw > 0.1) c.rect(-hw, -0.25, hw * 2, 0.5); } }, 0, 0));
    parts.push(at({ z0: Z + 4, z1: Z + AH, side: m.iron, top: m.ironT, ao: 0, bevel: false, shape: (c, zt) => {
      const z = Z + 4 + zt * (AH - 4), hw = archHW(z) - 0.2;
      if (hw < 0.2) return;
      if ((z - Z) % 2.4 < 0.45) { c.rect(-hw, 0.2, hw * 2, 0.6); return; }
      for (let x = -aw + 1; x < aw; x += 1.7) if (Math.abs(x) < hw) c.rect(x - 0.22, 0.2, 0.44, 0.6);
    } }, 0, 0));
    parts.push(at({ z0: Z, z1: BT, side: m.wall, top: m.wallT, ao: 0.3, shape: (c, zt) => {
      const z = Z + zt * (BT - Z), hw = archHW(z);
      if (hw <= 0.05) { c.rect(-TX, -AD, TX * 2, AD * 2); return; }
      c.rect(-TX, -AD, TX - hw, AD * 2); c.rect(hw, -AD, TX - hw, AD * 2);
    } }, 0, 0));
    const wm = [];
    for (let x = -7.5; x <= 7.6; x += 3) wm.push(x, AD - 0.7, x, -AD + 0.7);
    parts.push(at(merlonsAt(wm, BT, 3, 1.6, m.wall, m.trim), 0, 0));
    // bone voussoirs, keystone skull + eyes (+ L3 runes) on the camera face of the arch
    const vs = [];
    for (let i = 0; i <= 10; i++) { const z = asp + i * (AH + Z - asp + 1.2) / 10, hw = archHW(z); if (hw > 0.2) { vs.push(rectXZ(hw - 0.2, z - 0.5, hw + 1.3, z + 0.5), rectXZ(-hw - 1.3, z - 0.5, -hw + 0.2, z + 0.5)); } }
    vs.push(rectXZ(-aw - 1.3, Z, -aw + 0.1, asp), rectXZ(aw - 0.1, Z, aw + 1.3, asp));
    parts.push(atA(elev(vs, AD - 0.1, AD + 0.4, m.corn, m.cornT, { auto: true }), 0, AD));
    const kz = Z + AH + 1.8;
    parts.push(atA(elev(skullP(0, kz, 1.6), AD + 0.3, AD + 0.9, m.boneS, m.bone, { auto: true }), 0, AD));
    parts.push(atA(elev(skullEyes(0, kz, 1.6).concat(L === 3 ? runeRow(-TX + 6, -aw - 2, BT - 2.2, 1.3, 31).concat(runeRow(aw + 2, TX - 6, BT - 2.2, 1.3, 32)) : []), AD + 0.9, AD + 1.1, m.glow, m.glowT, { flat: true, ao: 0, auto: true }), 0, AD));
    // gate towers: all parts of a tower share its (mirrored) anchor so they stay in authored order
    for (const sx of [-1, 1]) {
      const cx = sx * TX, A = (p) => parts.push(atA(p, cx, TD - 0.5));
      A(box(cx - TW, -TD, cx + TW, TD, Z, TH, m.wall, m.wallT, { ao: 0.32 }));
      const cr = courses([[cx - TW, cx + TW, TD]], Z, TH - 1, 2.6, mx(m.wall, m.dark, 0.4)); cr.shape = autoFace(cr.shape); A(cr);
      A(elev([lancet(cx, TH - 9, 1.8, 5), lancet(cx, Z + 5, 1.4, 3.6)].concat(L === 3 ? runeRow(cx - TW + 0.8, cx + TW - 0.8, TH - 12, 1.3, 40 + sx) : []), TD - 0.05, TD + 0.35, m.glow, m.glowT, { flat: true, ao: 0.2, auto: true }));
      A(box(cx - TW - 0.7, -TD - 0.7, cx + TW + 0.7, TD + 0.7, TH, TH + 1.3, m.corn, m.cornT, { ao: 0.15 }));
      if (L === 2) {
        const RO = { x: cx, y: 0, L: TW + 1.1, W: TD + 1.1, z0: TH + 1.3, h: 13, pw: 1.3, lit: m.roofL, shade: m.roofS };
        for (const p of hipRoof(RO)) A(p);
        A(hipRidges(RO, m.boneS, m.bone, 0.4));
        A(spikes([[cx, 0, 0.6]], TH + 13.6, 5, m.iron, m.boneT));
      } else {
        const ml = [];
        for (let i = 0; i <= 4; i++) { const t = i / 4; ml.push(cx - TW + 0.5 + t * (TW * 2 - 1), -TD + 0.5, cx - TW + 0.5 + t * (TW * 2 - 1), TD - 0.5); }
        for (let i = 1; i < 4; i++) { const t = i / 4; ml.push(cx - TW + 0.5, -TD + 0.5 + t * (TD * 2 - 1), cx + TW - 0.5, -TD + 0.5 + t * (TD * 2 - 1)); }
        A(merlonsAt(ml, TH + 1.3, 3.8, 1.6, m.wall, m.trim));
        A(drums([[cx, 0, 2.6]], TH + 1.3, TH + 6, m.wall, m.wallT, { ao: 0.3 }));
        for (const p of cones([[cx, 0, 3.4]], TH + 6, 15, m.roofL, m.roofS, { pw: 1.35 })) A(p);
        A(spikes([[cx, 0, 0.5]], TH + 20, 4.5, m.iron, m.boneT));
      }
      towerBanner(cx, TH - 1, 3.8, 9, TD - 0.5);
    }
    return { r: 24, h: L === 2 ? TH + 21 : TH + 27, parts: withSorter(parts), style: 'unit', bevel: 0.6 };
  };

  /* =====================================================================
   * BALLISTA — 24 dirs, +x = aim. Bone-limbed bolt thrower on a turntable
   * over a small round rune platform; green-glowing bolt head, skull prow.
   * ===================================================================== */
  M.undead_ballista = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    parts.push(at({ z0: 0, z1: 2.2, side: m.wallD, top: m.floorT, ao: 0.3, shape: (c) => S.poly(c, ngon(10, 9.2, 0)),
      detail: (c) => { c.save(); c.strokeStyle = cs(m.glow, 0.6); c.lineWidth = 0.35; c.beginPath(); S.circ(c, 0, 0, 7.6); c.stroke(); c.restore(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; S.lines(c, SEAM2, 0.3, [Math.cos(a) * 9.2, Math.sin(a) * 9.2, Math.cos(a) * 6.4, Math.sin(a) * 6.4]); } } }, 0, 0, -1));
    parts.push(at(drums([[0, 0, 5.4]], 2.2, 3.2, m.iron, m.ironT, { ao: 0.2, detail: (c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.dot(c, m.dark, Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0.35); } } }), 0, 0, -1));
    parts.push(at(box(-2, -1.6, 2, 1.6, 3.2, 6.2, m.woodD, m.woodT, { ao: 0.3 }), 0, 0));
    parts.push(at({ z0: 6.2, z1: 7.8, side: m.wood, top: m.woodT, ao: 0.25, shape: (c) => S.poly(c, [-8, -1.3, 7, -1.1, 8.6, 0, 7, 1.1, -8, 1.3]),
      detail: (c) => { S.lines(c, 'rgba(0,0,0,0.5)', 0.5, [-7.5, 0, 6.5, 0]); S.lines(c, SEAM2, 0.3, [-3, -1.25, -3, 1.25, 2, -1.2, 2, 1.2]); } }, 0, 0));
    parts.push(at(box(-4.6, -0.35, 9, 0.35, 7.8, 8.5, m.woodD, m.ironT, { ao: 0.1, bevel: false }), 0, 0));
    // winch drum and its crank spikes at the back
    parts.push(at({ z0: 6.2, z1: 9.2, side: m.iron, top: m.ironT, ao: 0.2, shape: (c, zt) => { const hw = 1.5 * Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 2 - 1, 2))); c.rect(-7.4 - hw, -2.6, hw * 2, 5.2); } }, -7.4, 0));
    parts.push(at(spikes([[-7.4, -2.9, 0.4], [-7.4, 2.9, 0.4]], 6.2, 4.4, m.iron, m.boneT), -7.4, 0));
    // bone limbs (curving back) and the bowstring
    const limb = (sg) => { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([5 - t * 4.2 - t * t * 2.2, sg * (1.2 + t * 8.4)]); } return pts; };
    parts.push(at({ z0: 7.1, z1: 7.5, side: m.boneT, top: m.boneT, ao: 0, bevel: false, stroke: 0.3, shape: (c) => { const a = limb(1)[8], b = limb(-1)[8]; c.moveTo(a[0], a[1]); c.lineTo(-4.6, 0); c.lineTo(b[0], b[1]); } }, 0, 0));
    parts.push(at({ z0: 6.4, z1: 8, side: m.boneS, top: m.bone, ao: 0.25, bevel: false, shape: (c) => {
      for (const sg of [-1, 1]) { const p = limb(sg); for (let i = 0; i < p.length - 1; i++) { const w = 0.95 - i * 0.07; const a = p[i], b = p[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * w, ny = dx / l * w; S.poly(c, [a[0] + nx, a[1] + ny, b[0] + nx, b[1] + ny, b[0] - nx, b[1] - ny, a[0] - nx, a[1] - ny]); S.circ(c, b[0], b[1], w); } }
    } }, 3, 0));
    // glowing bolt head, skull prow
    parts.push(at({ z0: 7.6, z1: 8.7, side: m.glow, top: m.glowT, flat: true, ao: 0.2, bevel: false, shape: (c) => S.poly(c, [12, 0, 9, -0.9, 9.4, 0, 9, 0.9]) }, 10, 0));
    parts.push(at(skulls3d([[8.2, 0, 6.2, 1.15]], m), 8.2, 0));
    return { r: 13, h: 12, parts: withSorter(parts), style: 'unit', bevel: 0.6 };
  };

  /* =====================================================================
   * CATAPULT — 24 dirs, +x = aim, anims 3: arm cocked (down, loaded with a
   * green soul-fire skull) → swinging up → released against the crossbar.
   * Black-timber frame with bone braces; the arm is a giant spine bone.
   * ===================================================================== */
  M.undead_catapult = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const PX = -3, PZ = 5.8, AL = 13.5, BZ0 = 2.4, BZ1 = 4.4;
    const angOf = (an) => (an < 1 / 3 ? 2.92 : an < 2 / 3 ? 1.95 : 1.12); // arm angle in the x-z plane (pi = lying back)
    // soft contact shadow (alpha only: no outline)
    parts.push(at({ z0: 0, z1: 0, side: '#000000', top: '#000000', flat: true, bevel: false, shape: () => {}, detail: (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, 'rgba(10,8,12,0.32)'); g.addColorStop(1, 'rgba(10,8,12,0)');
      c.fillStyle = g; c.beginPath(); S.ell(c, 0, 0, 12, 9); c.fill();
    } }, 0, 0, -2));
    // per side: wheels (iron rim, bone hub), side beam, skull, prow spike, A-frame upright
    for (const sy of [-1, 1]) {
      const y = sy * 4.4, wy = sy * 6.1, A = (p) => parts.push(at(p, 0, y));
      const wh = [], hub = [];
      for (const x of [-6.6, 6.6]) { wh.push(ngon(12, 2.7, 0, x, 2.7)); hub.push(ngon(8, 0.9, PI / 8, x, 2.7)); }
      parts.push(at(elev(wh, wy - 0.5, wy + 0.5, m.iron, m.ironT, { ao: 0.25 }), 0, wy));
      parts.push(at(elev(hub, sy > 0 ? wy + 0.5 : wy - 0.8, sy > 0 ? wy + 0.8 : wy - 0.5, m.boneS, m.bone, { ao: 0 }), 0, wy));
      A(box(-10, y - 0.95, 10, y + 0.95, BZ0, BZ1, m.wood, m.woodT, { ao: 0.25, detail: (c) => S.lines(c, SEAM2, 0.3, [-6, y - 0.95, -6, y + 0.95, 4, y - 0.95, 4, y + 0.95]) }));
      A(skulls3d([[-9, y, BZ1, 0.85]], m));
      A(spikes([[10, y, 0.7, 2.8, 0]], BZ0 + 0.4, 3.4, m.boneS, m.boneT));
      A({ z0: BZ1, z1: 12.4, side: m.wood, top: m.woodT, ao: 0.3, shape: (c, zt) => { const x = 3.2 - zt * 1.6; S.circ(c, x, y, 0.8); S.circ(c, x - 5.2 + zt * 4.8, y, 0.7); } });
    }
    parts.push(at({ z0: BZ0 + 0.2, z1: BZ1 - 0.2, side: m.woodD, top: m.woodT, ao: 0.3, shape: (c) => { c.rect(-9.4, -3.6, 1.8, 7.2); c.rect(7.6, -3.6, 1.8, 7.2); c.rect(PX - 1, -3.6, 2, 7.2); } }, 0, 0, -1));
    // torsion bundle on the pivot axle
    parts.push(at({ z0: PZ - 1.8, z1: PZ + 1.8, side: mx(m.wood, m.p.s, 0.3), top: mx(m.woodT, m.p.s, 0.35), ao: 0.25, shape: (c, zt) => { const hw = 1.8 * Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 2 - 1, 2))); c.rect(PX - hw, -3.6, hw * 2, 7.2); },
      detail: (c) => S.lines(c, 'rgba(0,0,0,0.4)', 0.3, [PX - 0.8, -3.2, PX + 0.8, -2.2, PX - 0.8, -1.2, PX + 0.8, -0.2, PX - 0.8, 0.8, PX + 0.8, 1.8, PX - 0.8, 2.8]) }, PX, 0));
    // the spine-bone arm: vertebra segments + iron cup + soul-fire skull (frames 0-1)
    const armPts = (an) => { const a = angOf(an), ca = Math.cos(a), sa = Math.sin(a), out = []; for (let i = 0; i < 6; i++) { const t0 = i / 6 * (AL - 2), t1 = t0 + (AL - 2) / 6 - 0.3, w = 1.05 - i * 0.05; out.push([PX + ca * t0 - sa * w, PZ + sa * t0 + ca * w, PX + ca * t1 - sa * w, PZ + sa * t1 + ca * w, PX + ca * t1 + sa * w, PZ + sa * t1 - ca * w, PX + ca * t0 + sa * w, PZ + sa * t0 - ca * w]); } return out; };
    parts.push(at(elev((an) => armPts(an), -1, 1, m.boneS, m.boneT, { ao: 0.15, z0: 0, z1: PZ + AL + 1 }), PX, 0));
    const cup = (an) => { const a = angOf(an), ca = Math.cos(a), sa = Math.sin(a), cx = PX + ca * (AL - 1.2), cz = PZ + sa * (AL - 1.2), px = -sa, pz = ca; return [[cx - ca * 1.6 + px * 0.3, cz - sa * 1.6 + pz * 0.3, cx + ca * 1.6 + px * 0.3, cz + sa * 1.6 + pz * 0.3, cx + ca * 2 + px * 2.2, cz + sa * 2 + pz * 2.2, cx - ca * 2 + px * 2.2, cz - sa * 2 + pz * 2.2]]; };
    parts.push(at(elev(cup, -1.7, 1.7, m.iron, m.ironT, { ao: 0.2, z0: 0, z1: PZ + AL + 3 }), PX, 0));
    const proj = (k, col, top) => ({ z0: 0, z1: PZ + AL + 5.5, side: col, top, flat: true, ao: 0.25, bevel: false, shape: (c, zt, an) => {
      if (an >= 2 / 3) return;
      const a = angOf(an), ca = Math.cos(a), sa = Math.sin(a), cx = PX + ca * (AL - 1.2) - sa * 3.4, cz = PZ + sa * (AL - 1.2) + ca * 3.4, R = 1.9 * k;
      const z = zt * (PZ + AL + 5.5), u = (z - cz) / R;
      if (Math.abs(u) > 1) return;
      S.circ(c, cx, 0, R * Math.sqrt(1 - u * u) + 0.05);
    } });
    parts.push(at(proj(1, m.glow, m.glowT), PX, 0));
    parts.push(at(proj(0.55, m.glowT, '#ffffff'), PX, 0));
    // crossbar (padded with bone) the arm slams into
    parts.push(at(box(0.7, -5, 2.5, 5, 11.8, 13.4, m.woodD, m.woodT, { ao: 0.2 }), 1.6, 0));
    parts.push(at(box(0.9, -1.7, 2.3, 1.7, 13.4, 14.4, m.boneS, m.bone, { ao: 0.2, bevel: false }), 1.6, 0));
    return { r: 18, h: Math.ceil(PZ + AL + 7), parts: withSorter(parts), style: 'unit', bevel: 0.6 };
  };

  /* =====================================================================
   * TEMPLE — chapel of the restless dead: cruciform nave held up by bone
   * flying ribs, a tall steeple with a soul-lit belfry, green rose window,
   * ossuary niches and a glowing restoration pool ringed by candles in the
   * forecourt (soft green healing glow, anims 4).
   * ===================================================================== */
  M.undead_temple = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1.6;
    const base = [-15, -26, 15, -26, 25, -18, 25, 0, 17, 9, 12, 28, -12, 28, -17, 9, -25, 0, -25, -18];
    parts.push(polyPart(base, 0, Z, m.wallD, m.floorT, { ao: 0.3, detail: (c, an) => {
      flagstones(c, base, 2.8, 71);
      c.fillStyle = cs(m.trimS, 0.4); c.beginPath(); c.rect(-3.5, 6, 7, 22); c.fill();
      glowDot(c, m.glow, 0, 18, 10, 0.16 + 0.06 * Math.sin(an * TAU));
      boneBits(c, m, [[-20, -4, 0.4], [19, -6, 2.1, 1.2], [-9, 23, 1.2]]);
    } }));
    const ny0 = -23, ny1 = 6, nw = 10, Z1 = 16, ty0 = -15, ty1 = -4, tw = 20, TZ = 12.5;
    // transept arms + nave
    parts.push(box(-tw, ty0, tw, ty1, Z, TZ, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(box(-nw, ny0, nw, ny1, Z, Z1, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(courses([[-nw, nw, ny1], [-tw, -nw, ty1], [nw, tw, ty1]], Z, Z1 - 0.6, 2.4, mx(m.wall, m.dark, 0.4)));
    // ossuary niches in the transept fronts (skull piles in dark arches)
    parts.push(elev([archP(-15, Z, 4.4, 7.4), archP(15, Z, 4.4, 7.4)], ty1 - 0.1, ty1 + 0.45, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev([archP(-15, Z, 3.2, 6.6), archP(15, Z, 3.2, 6.6)], ty1 + 0.45, ty1 + 0.6, m.void, m.dark, { ao: 0 }));
    parts.push(elev([-15, 15].reduce((a, x) => a.concat(skullP(x - 0.8, Z + 1.1, 0.7), skullP(x + 0.8, Z + 1.1, 0.7), skullP(x, Z + 2.5, 0.7)), []), ty1 + 0.6, ty1 + 1.1, m.boneS, m.bone));
    // transept: hipped roof; bone flying ribs along the nave flanks
    parts.push(box(-tw - 0.8, ty0 - 0.8, tw + 0.8, ty1 + 0.8, TZ, TZ + 1, m.corn, m.cornT, { ao: 0.15 }));
    const TR = { x: 0, y: (ty0 + ty1) / 2, L: tw + 1.4, W: (ty1 - ty0) / 2 + 1.4, z0: TZ + 1, h: 6.5, lit: m.roofL, shade: m.roofS };
    parts.push(...hipRoof(TR));
    parts.push(hipLines(TR, m.roofLn, 1.9));
    parts.push(hipRidges(TR, m.boneS, m.bone, 0.4));
    const ribs = [];
    for (const sd of [-1, 1]) for (const y of [-20, 1.5]) ribs.push(ribF(sd * nw, y, Z1 - 2, sd * (nw + 8), y, Z));
    parts.push(curves(ribs, Z, Z1 - 2, 1.6, m.boneS, m.bone));
    parts.push(spikes([[-nw - 8, -20, 0.8], [nw + 8, -20, 0.8], [-nw - 8, 1.5, 0.8], [nw + 8, 1.5, 0.8]], Z, 6, m.wall, m.trim));
    // nave: steep gable to the camera, stone facade gable with rose window and door
    parts.push(box(-nw - 0.9, ny0 - 0.9, nw + 0.9, ny1 + 0.9, Z1, Z1 + 1.1, m.corn, m.cornT, { ao: 0.15 }));
    const RO = { x: 0, y: (ny0 + ny1) / 2, L: (ny1 - ny0) / 2 + 1.4, W: nw + 1.4, z0: Z1 + 1.1, h: 14, axis: 'y', lit: m.roofL, shade: m.roofS, ridge: m.bone, step: 2.3 };
    parts.push(...gable(RO));
    parts.push(roofLines(RO, m.roofLn));
    const gy = RO.y + RO.L, rz = Z1 + 5.6;
    parts.push(elev([triXZ(-nw + 0.2, nw - 0.2, Z1 + 1.1, Z1 + 1.1 + RO.h * (nw - 0.2) / RO.W)], gy - 0.9, gy, m.wall, m.corn, { ao: 0.25 }));
    parts.push(elev([{ p: ngon(12, 3.9, 0, 0, rz), y0: gy, y1: gy + 0.3 }].concat([lancet(0, Z, 6.6, 9.8, 0.6), lancet(-6.2, Z + 4.4, 2, 6.4), lancet(6.2, Z + 4.4, 2, 6.4)].map((p) => ({ p, y0: ny1 - 0.1, y1: ny1 + 0.45 }))), 0, 0, m.trimS, m.corn, { ao: 0.2 }));
    parts.push(elev([{ p: ngon(12, 3.1, 0, 0, rz), y0: gy + 0.3, y1: gy + 0.5 }].concat([lancet(0, Z, 5, 9, 0.6), lancet(-6.2, Z + 4.9, 1.1, 5.4), lancet(6.2, Z + 4.9, 1.1, 5.4)].map((p) => ({ p, y0: ny1 + 0.45, y1: ny1 + 0.65 }))), 0, 0, m.glowS, m.glow, { flat: true, ao: 0.45 }));
    const tr = [ngon(8, 0.85, PI / 8, 0, rz)];
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI, ca = Math.cos(a) * 3.1, sa = Math.sin(a) * 3.1; tr.push([-ca - sa * 0.07, rz - sa + ca * 0.07, ca - sa * 0.07, rz + sa + ca * 0.07, ca + sa * 0.07, rz + sa - ca * 0.07, -ca + sa * 0.07, rz - sa - ca * 0.07]); }
    tr.push({ p: rectXZ(-0.2, Z, 0.2, Z + 8.6), y0: ny1 + 0.65, y1: ny1 + 0.85 }, { p: rectXZ(-2.5, Z + 4.6, 2.5, Z + 5), y0: ny1 + 0.65, y1: ny1 + 0.85 });
    parts.push(elev(tr, gy + 0.5, gy + 0.7, m.void, m.dark, { ao: 0 }));
    // steeple at the crossing: square tower, bone-pillared soul belfry, needle spire
    const sy = (ty0 + ty1) / 2, SR = 4.8, SZ = Z1 + 15, BZ = SZ + 5.4;
    parts.push(box(-SR, sy - SR, SR, sy + SR, Z1 + 8, SZ, m.wall, m.wallT, { ao: 0.25 }));
    parts.push(elev([lancet(-2, SZ - 6.5, 1.3, 4.5), lancet(2, SZ - 6.5, 1.3, 4.5)], sy + SR - 0.1, sy + SR + 0.3, m.vio, m.vioT, { flat: true, ao: 0 }));
    parts.push(box(-SR + 1, sy - SR + 1, SR - 1, sy + SR - 1, SZ, BZ, m.glowS, m.glowT, { flat: true, ao: 0.5 }));
    parts.push({ z0: SZ, z1: BZ + 1.2, side: m.corn, top: m.cornT, ao: 0.2, shape: (c, zt) => { if (zt * (BZ + 1.2 - SZ) < BZ - SZ) { for (const q of [[-SR, -SR], [SR - 1.4, -SR], [-SR, SR - 1.4], [SR - 1.4, SR - 1.4], [-0.7, SR - 1.4], [-0.7, -SR], [-SR, -0.7], [SR - 1.4, -0.7]]) c.rect(q[0], sy + q[1], 1.4, 1.4); } else c.rect(-SR - 0.6, sy - SR - 0.6, SR * 2 + 1.2, SR * 2 + 1.2); } });
    const SO = { x: 0, y: sy, L: SR + 0.6, W: SR + 0.6, z0: BZ + 1.2, h: 19, pw: 1.4, lit: m.roofL, shade: m.roofS };
    parts.push(...hipRoof(SO));
    parts.push(hipRidges(SO, m.boneS, m.bone, 0.35));
    const spk = [[0, gy - 0.3, 1, 0, 0, RO.z0 + RO.h - 0.5, 5], [0, sy, 0.6, 0, 0, BZ + 19.6, 5], [-tw - 0.8, TR.y, 0.6, 0, 0, TR.z0 + TR.h - 0.6, 3.2], [tw + 0.8, TR.y, 0.6, 0, 0, TR.z0 + TR.h - 0.6, 3.2]];
    parts.push(spikes(spk.map((q) => q.slice(0, 5)), 0, 1, m.iron, m.boneT, { z0: TR.z0 + TR.h - 0.6, z1: BZ + 25, shape: spikeShape(spk) }));
    // forecourt restoration pool: bone-rimmed basin, glowing water, candles
    parts.push(drums([[0, 18, 6]], Z, Z + 1.6, m.boneS, m.bone, { ao: 0.25 }));
    parts.push({ z0: Z + 1.2, z1: Z + 1.3, side: m.glowS, top: mx(m.glowS, m.dark, 0.25), flat: true, bevel: false, shape: (c) => S.circ(c, 0, 18, 4.8),
      detail: (c, an) => {
        glowDot(c, m.glow, 0, 18, 4.8, 0.55);
        c.save(); c.strokeStyle = cs(m.glowT, 0.75); c.lineWidth = 0.35; c.beginPath();
        for (const r of [1.4, 2.7, 4]) { const rr = r + an * 1.3; if (rr < 4.6) { c.moveTo(rr, 18); S.ell(c, 0, 18, rr, rr * 0.92); } }
        c.stroke(); c.restore();
        S.dot(c, '#ffffff', -1.6, 16.6, 0.35);
      } });
    const cand = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; cand.push([Math.cos(a) * 8.2, 18 + Math.sin(a) * 6.4]); }
    parts.push({ z0: Z, z1: Z + 2.4, side: m.boneS, top: m.boneT, ao: 0.2, bevel: false, shape: (c) => { for (const q of cand) S.circ(c, q[0], q[1], 0.42); } });
    parts.push({ z0: Z + 2.4, z1: Z + 3.6, side: m.glow, top: m.glowT, flat: true, bevel: false, ao: 0.2, shape: (c, zt, an) => { cand.forEach((q, i) => S.circ(c, q[0] + Math.sin(an * TAU + i) * 0.1, q[1], 0.36 * (1 - zt) + 0.06)); } });
    return { r: 30, h: Math.ceil(BZ + 26), parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * MARKET — the bone bazaar: stalls with tattered violet awnings around a
   * gibbet obelisk; goods are skulls, bones, potion racks (green glow),
   * coffins, crates and caged lanterns.
   * ===================================================================== */
  M.undead_market = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1;
    const base = ngon(10, 28, PI / 10, 0, 0, 1, 0.9);
    parts.push(polyPart(base, 0, Z, m.wallD, m.floorT, { ao: 0.3, detail: (c) => {
      flagstones(c, base, 2.8, 81);
      c.save(); c.strokeStyle = cs(m.trim, 0.35); c.lineWidth = 0.6; c.beginPath(); S.circ(c, 0, 0, 7.5); c.stroke(); c.restore();
      boneBits(c, m, [[-8, 15, 0.4], [10, 17, 2.2, 1.2], [3, -18, 1.1], [-17, -4, 2.8]]);
    } }));
    // stalls: counter + goods + four posts + pitched awning (two cloth planes)
    const stalls = [[-14, -12, 0], [14, -12, 1], [-17, 8, 2], [17, 8, 3]];
    const W = 6.2, D = 3.6;
    parts.push({ z0: Z, z1: Z + 3.4, side: m.woodD, top: m.woodT, ao: 0.3, shape: (c) => { for (const s of stalls) c.rect(s[0] - W + 0.6, s[1] - 0.6, (W - 0.6) * 2, D); },
      detail: (c) => { for (const s of stalls) S.lines(c, 'rgba(0,0,0,0.35)', 0.3, [s[0] - W + 0.6, s[1] + 1.2, s[0] + W - 0.6, s[1] + 1.2]); } });
    // goods on the counters: skulls, bones, potion racks
    const gsk = [], pot = [];
    for (const s of stalls) {
      if (s[2] % 2 === 0) for (let i = 0; i < 4; i++) gsk.push([s[0] - 4.2 + i * 2.8, s[1] + 1.2, Z + 3.4, 0.8]);
      else for (let i = 0; i < 6; i++) pot.push([s[0] - 4.5 + i * 1.8, s[1] + 0.9 + (i % 2) * 0.8, 0.5]);
    }
    parts.push(skulls3d(gsk, m));
    parts.push({ z0: Z + 3.4, z1: Z + 5.2, side: m.glowS, top: m.glowT, flat: true, ao: 0.4, shape: (c, zt) => { const k = zt > 0.6 ? 0.5 : 1; for (const q of pot) S.circ(c, q[0], q[1], q[2] * k); } });
    parts.push({ z0: Z, z1: Z + 11, side: m.wood, top: m.woodT, ao: 0.3, bevel: false, shape: (c) => { for (const s of stalls) for (const p of [[-W, -0.8], [W, -0.8], [-W, D + 1.2], [W, D + 1.2]]) S.circ(c, s[0] + p[0], s[1] + p[1], 0.42); } });
    for (const s of stalls) {
      const AO = { x: s[0], y: s[1] + D / 2, L: W + 1, W: D / 2 + 2.6, z0: Z + 10.4, h: 3.2, axis: 'x', lit: mx(m.ban, m.p.b, 0.25), shade: m.banS, ridge: m.boneT };
      parts.push(...gable(AO));
    }
    // tattered awning fringe on the front edges
    parts.push(elev((an) => stalls.map((s) => { const y = s[1] + D / 2 + D / 2 + 2.6; const pts = [s[0] - W - 1, Z + 10.6]; for (let i = 0; i <= 8; i++) { const x = s[0] - W - 1 + i * (W + 1) / 4; pts.push(x, Z + 10.6 - (i % 2 ? 1.6 : 0.4)); } pts.push(s[0] + W + 1, Z + 10.6); return { p: [s[0] - W - 1, Z + 10.6, s[0] + W + 1, Z + 10.6, s[0] + W + 1, Z + 9.6, s[0] - W - 1, Z + 9.6], y0: y - 0.4, y1: y }; }), 0, 0, m.banS, m.ban, { ao: 0.2, z0: Z + 9.5, z1: Z + 10.7 }));
    // central gibbet obelisk with a hanging cage lantern
    parts.push({ z0: Z, z1: Z + 2, side: m.wall, top: m.wallT, ao: 0.3, shape: (c) => S.poly(c, ngon(8, 4, PI / 8)) });
    parts.push(...hipRoof({ x: 0, y: 0, L: 2.4, W: 2.4, z0: Z + 2, h: 18, pw: 0.8, lit: m.wallT, shade: m.wall, mid: m.trimS }));
    parts.push(elev([rectXZ(-0.3, Z + 14, 0.3, Z + 15), rectXZ(0, Z + 14.6, 5.4, Z + 15.4), rectXZ(4.8, Z + 12, 5.2, Z + 15)], -0.3, 0.3, m.iron, m.ironT, { ao: 0.1 }));
    parts.push(drums([[5, 0, 1.3]], Z + 9.4, Z + 12, m.glow, m.glowT, { flat: true, ao: 0.4 }));
    parts.push({ z0: Z + 9.2, z1: Z + 12.2, side: m.iron, top: m.ironT, ao: 0, bevel: false, shape: (c, zt) => { if (zt < 0.06 || zt > 0.94) { S.circ(c, 5, 0, 1.6); return; } for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; S.circ(c, 5 + Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.18); } } });
    // coffins, crates and a bone heap
    parts.push({ z0: Z, z1: Z + 2.4, side: m.woodD, top: m.wood, ao: 0.3, shape: (c) => { S.poly(c, [-6, 16, -2, 15, 4, 15.6, 4.4, 18.4, -2, 19, -6, 18]); S.poly(c, [20, -2, 23, -3, 26, -2, 26.2, 0.4, 23, 1.2, 20, 0.2]); },
      detail: (c) => { S.lines(c, cs(m.boneT, 0.8), 0.4, [-1.6, 15.2, -1.6, 18.8, -3.4, 16.6, 0.2, 16.6, 23, -2.8, 23, 1, 21.8, -1.6, 24.2, -1.6]); } });
    parts.push({ z0: Z, z1: Z + 3.6, side: m.wood, top: m.woodT, ao: 0.3, shape: (c) => { c.rect(-25, -3, 4, 4); c.rect(-24, 1.4, 3.4, 3.4); c.rect(8, 16, 3.6, 3.6); },
      detail: (c) => S.lines(c, 'rgba(0,0,0,0.4)', 0.3, [-25, -3, -21, 1, -21, -3, -25, 1, 8, 16, 11.6, 19.6, 11.6, 16, 8, 19.6]) });
    parts.push({ z0: Z, z1: Z + 2.4, side: m.boneS, top: m.bone, ao: 0.35, shape: (c, zt) => { const k = 1 - zt * 0.7; S.blob(c, 15, 18.5, 3 * k, 5, 8, 0.45); } });
    parts.push(...braziers([[-7, 4, 3.4, 1.3], [7, 4, 3.4, 1.3]], m, m.vio));
    return { r: 32, h: 26, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * WORKSHOP — siege works: an open timber shed on a stone back wall with
   * a soul-forge, a gallows crane hoisting a skull-cage, a half-built bone
   * catapult on its wheels, stacked black logs and scattered shavings.
   * ===================================================================== */
  M.undead_workshop = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1;
    const base = [-27, -25, 27, -25, 31, -19, 31, 23, -31, 23, -31, -19];
    parts.push(polyPart(base, 0, Z, mx(m.earth, m.dark, 0.2), mx(m.earth, m.earthT, 0.45), { ao: 0.3, detail: (c) => {
      flagstones(c, rectP(-31, -25, 6, -3), 2.6, 91);
      for (let i = 0; i < 30; i++) { const x = U.hash2(i, 1, 9) * 56 - 28, y = U.hash2(i, 2, 9) * 22; S.lines(c, cs(m.woodT, 0.7), 0.3, [x, y, x + 0.9, y + 0.35]); }
      boneBits(c, m, [[12, 18, 0.4], [-6, 20, 2.2, 1.2], [26, 14, 1]]);
      glowDot(c, m.glow, -19, -8, 7, 0.28);
    } }));
    // shed: stone back wall, posts, soul-forge with chimney, gabled roof with a hole
    parts.push(box(-29, -23, 5, -19.5, Z, 12, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(courses([[-29, 5, -19.5]], Z, 12, 2.3, mx(m.wall, m.dark, 0.4)));
    parts.push(box(-24, -18.5, -14, -13.5, Z, 5, m.wallD, m.trimS, { ao: 0.3, detail: (c) => { S.dot(c, m.void, -19, -16, 2.1); glowDot(c, m.glow, -19, -16, 3.6, 0.95); S.dot(c, m.glowT, -19, -16, 0.8); } }));
    parts.push(elev([archP(-19, Z, 4, 3.2)], -13.6, -13.3, m.glowS, m.glow, { flat: true, ao: 0.4 }));
    parts.push({ z0: Z, z1: 12, side: m.wood, top: m.woodT, ao: 0.3, shape: (c) => { for (const x of [-28.2, -17.4, -6.6, 4.2]) c.rect(x - 0.8, -6.4, 1.6, 1.6); } });
    parts.push(box(-28.8, -6.6, 4.8, -5, 10.6, 12, m.woodD, m.woodT, { ao: 0.2, bevel: false }));
    const RO = { x: -12, y: -13.8, L: 18.2, W: 9.4, z0: 12, h: 7.5, axis: 'x', lit: m.roofL, shade: m.roofM, ridge: m.bone, step: 2 };
    parts.push(...gable(RO));
    parts.push(roofLines(RO, m.roofLn));
    parts.push(roofHole(RO, 'front', 9, 2.6, 3, 1.8, m.void));
    parts.push(drums([[-19, -17.6, 1.5, 12, 22], [-19, -17.6, 1.9, 22, 23.4]], 12, 23.4, m.wall, m.wallT, { ao: 0.25, detail: (c) => { S.dot(c, m.void, -19, -17.6, 1.1); glowDot(c, m.glow, -19, -17.6, 2.2, 0.85); } }));
    // log stacks (left front)
    const logs = (x, y, n, rows) => { const out = []; for (let r = 0; r < rows; r++) for (let i = 0; i < n - r; i++) out.push([x + (i + r * 0.5) * 2.2, y, r]); return out; };
    const lg = logs(-29, 5, 4, 3).concat(logs(-29, 12.5, 3, 2));
    parts.push({ z0: Z, z1: Z + 6.4, side: m.woodD, top: m.woodT, ao: 0.3, shape: (c, zt) => { const z = zt * 6.4; for (const q of lg) { const zc = 1.1 + q[2] * 1.9, u = (z - zc) / 1.1; if (Math.abs(u) > 1) continue; const hw = 1.1 * Math.sqrt(1 - u * u); c.rect(q[0] - hw, q[1] - 2.8, hw * 2, 5.6); } } });
    parts.push(elev(lg.map((q) => ngon(7, 0.85, 0, q[0], Z + 1.1 + q[2] * 1.9)), 0, 0, mx(m.woodT, m.p.s, 0.35), mx(m.woodT, m.p.s, 0.5), { ao: 0, shape: function (c, zt) {
      const z = this.z0 + zt * (this.z1 - this.z0), dz = dzOf(this.z0, this.z1);
      for (const q of lg) { const iv = bandX(ngon(7, 0.85, 0, q[0], Z + 1.1 + q[2] * 1.9), z - dz * 0.55, z + dz * 0.55); if (iv) c.rect(iv[0], q[1] + 2.8, iv[1] - iv[0], 0.3); }
    } }));
    // half-built bone catapult on wheels (frame, uprights, spine arm propped up)
    const cx0 = 6, cx1 = 22, cyA = 3, cyB = 11;
    parts.push(elev([ngon(10, 2.4, 0, cx0 + 3, Z + 2.4), ngon(10, 2.4, 0, cx1 - 3, Z + 2.4)].map((p) => ({ p, y0: cyA - 1.6, y1: cyA - 0.9 })).concat([ngon(10, 2.4, 0, cx0 + 3, Z + 2.4), ngon(10, 2.4, 0, cx1 - 3, Z + 2.4)].map((p) => ({ p, y0: cyB + 0.9, y1: cyB + 1.6 }))), 0, 0, m.iron, m.ironT, { ao: 0.25 }));
    parts.push({ z0: Z + 2, z1: Z + 3.8, side: m.wood, top: m.woodT, ao: 0.3, shape: (c) => { c.rect(cx0, cyA - 0.8, cx1 - cx0, 1.6); c.rect(cx0, cyB - 0.8, cx1 - cx0, 1.6); c.rect(cx0 + 0.6, cyA, 1.6, cyB - cyA); c.rect(cx1 - 2.2, cyA, 1.6, cyB - cyA); } });
    parts.push(elev([ngon(8, 0.8, PI / 8, cx0 + 3, Z + 2.4), ngon(8, 0.8, PI / 8, cx1 - 3, Z + 2.4)], cyB + 1.6, cyB + 1.9, m.boneS, m.bone, { ao: 0 }));
    parts.push({ z0: Z + 3.8, z1: Z + 11, side: m.wood, top: m.woodT, ao: 0.3, shape: (c, zt) => { const x = cx1 - 5 - zt * 1.4; S.circ(c, x, cyA, 0.7); S.circ(c, x, cyB, 0.7); if (zt > 0.92) c.rect(x - 0.7, cyA, 1.4, cyB - cyA); } });
    parts.push(elev([[cx0 + 4, Z + 3.4, cx0 + 5.6, Z + 3, cx1 - 2, Z + 13.4, cx1 - 3.6, Z + 13.8]], 6.4, 7.6, m.boneS, m.bone, { ao: 0.2 }));
    parts.push(skulls3d([[cx0 + 1.4, 7, Z + 3.8, 0.85]], m));
    // gallows crane with a hanging skull-cage
    const CX = 25, CY = -11;
    parts.push(box(CX - 3, CY - 3, CX + 3, CY + 3, Z, Z + 1.6, m.wallD, m.trimS, { ao: 0.25 }));
    parts.push(box(CX - 0.9, CY - 0.9, CX + 0.9, CY + 0.9, Z + 1.6, Z + 26, m.wood, m.woodT, { ao: 0.25 }));
    parts.push(elev([[CX - 0.6, Z + 24, CX + 0.6, Z + 24, CX - 13, Z + 25.4, CX - 13, Z + 24.6], [CX, Z + 18, CX + 0.9, Z + 18.6, CX - 5.4, Z + 24.6, CX - 6.4, Z + 24.6], rectXZ(CX - 14, Z + 24.2, CX - 12, Z + 26)], CY - 0.6, CY + 0.6, m.woodD, m.woodT, { ao: 0.2 }));
    parts.push(elev([rectXZ(CX - 12.2, Z + 15, CX - 11.8, Z + 24.4)], CY - 0.2, CY + 0.2, m.iron, m.ironT, { ao: 0 }));
    parts.push({ z0: Z + 10, z1: Z + 15, side: m.iron, top: m.ironT, ao: 0, bevel: false, shape: (c, zt) => { const x = CX - 12, y = CY; if (zt < 0.08 || zt > 0.92) { S.circ(c, x, y, 2); return; } for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; S.circ(c, x + Math.cos(a) * 1.9, y + Math.sin(a) * 1.9, 0.2); } } });
    parts.push(skulls3d([[CX - 12, CY, Z + 10.6, 1.2]], m));
    parts.push(...braziers([[-2, 15, 3, 1.2]], m));
    return { r: 35, h: 30, parts, style: 'unit', bevel: 0.7 };
  };

  /* =====================================================================
   * WARDSTONE — black obelisk with a strong pulsing green rune on its face,
   * bone ring and skulls at the foot, glowing ground ring, rising motes
   * (anims 4).
   * ===================================================================== */
  M.undead_wardstone = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const Z = 1.2, OH = 26, BW = 3.4, BD = 2.8, Z2 = Z + 2.6;
    parts.push({ z0: 0, z1: Z, side: m.wallD, top: m.floorT, ao: 0.3, shape: (c) => S.poly(c, ngon(8, 10, PI / 8)), detail: (c, an) => {
      flagstones(c, ngon(8, 10, PI / 8), 2.2, 101);
      glowDot(c, m.glow, 0, 2.5, 9, 0.2 + 0.14 * Math.sin(an * TAU));
      c.save(); c.strokeStyle = cs(m.glow, 0.45 + 0.35 * Math.sin(an * TAU)); c.lineWidth = 0.5; c.beginPath(); S.circ(c, 0, 0, 8.2); c.stroke();
      c.lineWidth = 0.35; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.moveTo(Math.cos(a) * 7.4, Math.sin(a) * 7.4); c.lineTo(Math.cos(a) * 8.2, Math.sin(a) * 8.2); } c.stroke(); c.restore();
    } });
    parts.push({ z0: Z, z1: Z2, side: m.wall, top: m.wallT, ao: 0.3, shape: (c, zt) => c.rect(-BW - 1.4 + zt * 0.8, -BD - 1.4 + zt * 0.8, (BW + 1.4 - zt * 0.8) * 2, (BD + 1.4 - zt * 0.8) * 2) });
    const OB = { x: 0, y: 0, L: BW, W: BD, z0: Z2, h: OH, pw: 0.3, lit: m.wallT, shade: m.wall, mid: mx(m.wall, m.wallT, 0.3) };
    parts.push(...hipRoof(OB));
    parts.push(hipRidges(OB, m.boneS, m.bone, 0.3));
    // the rune on the front face, in three brightness steps so it pulses
    const rz = Z2 + 4;
    const rune = [rectXZ(-0.32, rz, 0.32, rz + 10), diamond(0, rz + 11.3, 1.6, 1.6), [-2.2, rz + 2.6, -1.6, rz + 2.1, 0.2, rz + 5, -0.35, rz + 5.5], [2.2, rz + 2.6, 1.6, rz + 2.1, -0.2, rz + 5, 0.35, rz + 5.5], rectXZ(-1.7, rz + 7.2, 1.7, rz + 7.7), [-1, rz - 0.6, 1, rz - 0.6, 0, rz + 0.8]];
    const fy = (z) => OB.W - Math.min(OB.L, OB.W) * (1 - Math.pow(1 - (z - Z2) / OH, 0.3)) + 0.12;
    const runePart = (col, top, when) => ({ z0: rz - 0.7, z1: rz + 13, side: col, top, flat: true, bevel: false, ao: 0, when, shape: function (c, zt) {
      const z = this.z0 + zt * (this.z1 - this.z0), dz = dzOf(this.z0, this.z1), y = fy(z);
      for (const pg of rune) { const iv = bandX(pg, z - dz * 0.55, z + dz * 0.55); if (iv) c.rect(iv[0], y - 0.35, Math.max(0.06, iv[1] - iv[0]), 0.6); }
    } });
    parts.push(runePart(m.glowS, m.glow, (an) => an < 0.25));
    parts.push(runePart(m.glow, m.glowT, (an) => (an >= 0.25 && an < 0.5) || an >= 0.75));
    parts.push(runePart(m.glowT, '#ffffff', (an) => an >= 0.5 && an < 0.75));
    // bone ring and skulls around the foot
    parts.push({ z0: Z, z1: Z + 1.2, side: m.boneS, top: m.bone, ao: 0.2, bevel: false, shape: (c) => annulus(c, 0, 0, 7.2, 6.4) });
    parts.push(skulls3d([[-5, 4.6, Z, 0.9], [5, 4.6, Z, 0.9], [0, 6.6, Z, 1], [-6.6, -1.4, Z, 0.85], [6.6, -1.4, Z, 0.85], [-3, -6, Z, 0.8], [3, -6, Z, 0.8]], m));
    // motes rising and orbiting
    parts.push({ z0: Z + 3, z1: Z + OH, side: m.glow, top: m.glowT, flat: true, bevel: false, ao: 0, shape: (c, zt, an) => {
      const z = zt * (OH - 3);
      for (let i = 0; i < 6; i++) { const ph = (an + i / 6) % 1, mz = ph * (OH - 4), a = ph * TAU + i * 1.3, r = 5.2 - ph * 1.6; if (Math.abs(z - mz) < 0.5) S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.5 * (1 - ph * 0.6)); }
    } });
    return { r: 12, h: OH + 8, parts, style: 'unit', bevel: 0.6 };
  };

  /* =====================================================================
   * ROOST — dragon roost: a raised claw-scratched black stone platform
   * reached by a skull-lined stair, ringed by giant curved bone tusks,
   * a perch crowned with a great dragon skull, banners and green braziers.
   * ===================================================================== */
  M.undead_roost = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const PR = 22, PZ = 9, SW = 6;
    parts.push({ z0: 0, z1: 1, side: m.earth, top: mx(m.earth, m.earthT, 0.5), ao: 0.3, shape: (c) => S.blob(c, 0, 3, 31, 13, 14, 0.12),
      detail: (c) => boneBits(c, m, [[-24, 14, 0.4], [22, 17, 2.2, 1.3], [26, -6, 1.1], [-27, -8, 2.6]]) });
    // platform drum (battered) with courses
    parts.push({ z0: 1, z1: PZ, side: m.wall, top: m.wallT, ao: 0.32, shape: (c, zt) => S.poly(c, ngon(12, PR + 1.6 - zt * 1.6, PI / 12)),
      detail: (c) => {
        flagstones(c, ngon(12, PR, PI / 12), 3.2, 111, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)');
        c.save(); c.strokeStyle = 'rgba(8,6,10,0.65)'; c.lineWidth = 0.6; c.beginPath();
        for (const sc of [[-9, -6, 0.6], [7, -12, -0.4], [11, 4, 1.2], [-8, 8, -1], [2, 1, 0.2]]) for (let k = -1; k <= 1; k++) { const ca = Math.cos(sc[2]), sa = Math.sin(sc[2]); c.moveTo(sc[0] - ca * 4.4 - sa * k * 1.2, sc[1] - sa * 4.4 + ca * k * 1.2); c.quadraticCurveTo(sc[0] - sa * k * 1.4, sc[1] + ca * k * 1.4 + 0.6, sc[0] + ca * 4.4 - sa * k * 1.2, sc[1] + sa * 4.4 + ca * k * 1.2); }
        c.stroke(); c.restore();
        c.save(); c.strokeStyle = cs(m.glow, 0.5); c.lineWidth = 0.5; c.beginPath(); S.circ(c, 0, 0, PR - 3); c.stroke(); c.restore();
      } });
    parts.push(courses([[-PR * 0.42, -SW - 1, PR + 0.6], [SW + 1, PR * 0.42, PR + 0.6]], 1, PZ - 0.6, 2.4, mx(m.wall, m.dark, 0.4)));
    parts.push({ z0: PZ, z1: PZ + 0.8, side: m.corn, top: m.cornT, ao: 0.1, bevel: false, shape: (c) => annulus(c, 0, 0, PR + 0.2, PR - 1.1) });
    // stair down the front (lit treads), skull-topped balustrade posts
    parts.push({ z0: 1, z1: PZ, side: m.wallD, top: m.trimS, ao: 0.25, shape: (c, zt) => { const y1 = PR + 9 - zt * 9; c.rect(-SW, PR - 4, SW * 2, y1 - (PR - 4)); } });
    parts.push({ z0: 1, z1: PZ, side: m.trimS, top: m.trim, ao: 0, flat: true, bevel: false, shape: (c, zt) => { const z = zt * (PZ - 1), y1 = PR + 9 - zt * 9; if (Math.floor(z / 1.6) !== Math.floor((z - 0.5) / 1.6)) c.rect(-SW + 0.4, y1 - 0.5, SW * 2 - 0.8, 0.5); } });
    parts.push(drums([[-SW - 0.8, PR + 7.6, 0.9, 1, 4.6], [SW + 0.8, PR + 7.6, 0.9, 1, 4.6], [-SW - 0.8, PR + 2.4, 0.9, 1, PZ + 2.8], [SW + 0.8, PR + 2.4, 0.9, 1, PZ + 2.8]], 1, PZ + 2.8, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(skulls3d([[-SW - 0.8, PR + 7.6, 4.6, 0.95], [SW + 0.8, PR + 7.6, 4.6, 0.95], [-SW - 0.8, PR + 2.4, PZ + 2.8, 0.95], [SW + 0.8, PR + 2.4, PZ + 2.8, 0.95]], m));
    // giant bone tusks around the rim: back ones before the perch, front ones after
    const tusks = [];
    for (let i = 0; i < 10; i++) { const a = PI * 0.66 + (i / 9) * PI * 1.68; tusks.push([Math.cos(a) * (PR - 1.6), Math.sin(a) * (PR - 1.6), 2, Math.cos(a) * 7.5, Math.sin(a) * 7.5]); }
    parts.push(spikes(tusks.filter((q) => q[1] < 2), PZ, 21, m.boneS, m.boneT, { ao: 0.35 }));
    // perch: squat pillar crowned by a great dragon skull facing the camera
    const PX = 0, PY = -5, PT = PZ + 7;
    parts.push(drums([[PX, PY, 5, PZ, PZ + 2], [PX, PY, 3.8, PZ, PT]], PZ, PT, m.wall, m.wallT, { ao: 0.3 }));
    parts.push(drums([[PX, PY, 4.8, PT, PT + 1.4]], PT, PT + 1.4, m.corn, m.cornT, { ao: 0.2 }));
    const SK = PT + 1.4;
    parts.push(spikes([[PX - 3.4, PY - 1.6, 1.3, -4.5, -5], [PX + 3.4, PY - 1.6, 1.3, 4.5, -5]], SK + 3, 9, m.boneS, m.boneT, { ao: 0.25 }));
    parts.push({ z0: SK, z1: SK + 6, side: m.boneS, top: m.bone, ao: 0.3, shape: (c, zt) => {
      const k = Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 1.15 - 0.15, 2)));
      S.ell(c, PX, PY - 0.4, 4.6 * k, 3.8 * k);
      if (zt < 0.62) S.poly(c, [PX - 2.6, PY + 1.6, PX + 2.6, PY + 1.6, PX + 1.8, PY + 9.6, PX - 1.8, PY + 9.6]);
    }, detail: (c) => { S.lines(c, 'rgba(60,50,40,0.45)', 0.35, [PX - 2, PY + 0.6, PX + 2, PY + 0.6, PX, PY - 3, PX, PY + 0.4]); } });
    parts.push(elev([[PX - 1.8, SK, PX + 1.8, SK, PX + 2.4, SK + 2.4, PX - 2.4, SK + 2.4]], PY + 9.4, PY + 9.9, m.boneS, m.bone, { ao: 0.2 }));
    parts.push(elev([diamond(PX - 1.7, SK + 4, 0.9, 0.7), diamond(PX + 1.7, SK + 4, 0.9, 0.7)], PY + 3.2, PY + 3.5, m.glow, m.glowT, { flat: true, ao: 0 }));
    parts.push(elev([diamond(PX - 0.7, SK + 2.7, 0.35, 0.35), diamond(PX + 0.7, SK + 2.7, 0.35, 0.35), rectXZ(PX - 1.6, SK + 1.2, PX + 1.6, SK + 1.5)], PY + 9.9, PY + 10.1, m.void, m.void, { ao: 0 }));
    parts.push(spikes(tusks.filter((q) => q[1] >= 2), PZ, 21, m.boneS, m.boneT, { ao: 0.35 }));
    // banners and braziers at the stair head
    parts.push(...banners([[-PR + 4, 7, PZ + 17, 4.6, 9, true], [PR - 4, 7, PZ + 17, 4.6, 9, true]], m).map((p) => { if (p.z0 === 0) p.z0 = PZ; return p; }));
    parts.push(...braziers([[-SW - 4, PR - 6, PZ + 3, 1.7], [SW + 4, PR - 6, PZ + 3, 1.7]], m).map((p) => { if (p.z0 === 0) p.z0 = PZ; return p; }));
    return { r: 34, h: 42, parts, style: 'unit', bevel: 0.7 };
  };

  (AS.Gallery = AS.Gallery || []).push({ group: 'Undead buildings: keep', bg: 'undead', items: [
    { name: 'keep L1', gen: 'undead_keep', pal: 'undead', opt: { level: 1 }, anims: 4 },
    { name: 'keep L2', gen: 'undead_keep', pal: 'undead', opt: { level: 2 }, anims: 4 },
    { name: 'keep L3', gen: 'undead_keep', pal: 'undead', opt: { level: 3 }, anims: 4 },
  ] }, { group: 'Undead buildings: town', bg: 'undead', items: [
    { name: 'house v0', gen: 'undead_house', pal: 'undead', opt: { v: 0 }, anims: 4 },
    { name: 'house v1', gen: 'undead_house', pal: 'undead', opt: { v: 1 } },
    { name: 'house v2', gen: 'undead_house', pal: 'undead', opt: { v: 2 }, anims: 4 },
    { name: 'house v3', gen: 'undead_house', pal: 'undead', opt: { v: 3 }, anims: 4 },
    { name: 'barracks', gen: 'undead_barracks', pal: 'undead', anims: 4 },
    { name: 'farm', gen: 'undead_farm', pal: 'undead', anims: 4 },
    { name: 'stable', gen: 'undead_stable', pal: 'undead', anims: 4 },
    { name: 'mage tower', gen: 'undead_magetower', pal: 'undead', anims: 4 },
    { name: 'temple', gen: 'undead_temple', pal: 'undead', anims: 4 },
    { name: 'market', gen: 'undead_market', pal: 'undead', anims: 4 },
    { name: 'workshop', gen: 'undead_workshop', pal: 'undead', anims: 4 },
    { name: 'wardstone', gen: 'undead_wardstone', pal: 'undead', anims: 4 },
    { name: 'roost', gen: 'undead_roost', pal: 'undead', anims: 4 },
  ] }, { group: 'Undead buildings: defence', bg: 'undead', items: [
    { name: 'archer tower', gen: 'undead_tower', pal: 'undead', anims: 4 },
    { name: 'watchtower', gen: 'undead_watchtower', pal: 'undead', anims: 4 },
    { name: 'wall L1', gen: 'undead_wall', pal: 'undead', opt: { level: 1 }, dirs: 16 },
    { name: 'wall L2', gen: 'undead_wall', pal: 'undead', opt: { level: 2 }, dirs: 16 },
    { name: 'wall L3', gen: 'undead_wall', pal: 'undead', opt: { level: 3 }, dirs: 16 },
    { name: 'gate L1', gen: 'undead_gate', pal: 'undead', opt: { level: 1 }, dirs: 16 },
    { name: 'gate L2', gen: 'undead_gate', pal: 'undead', opt: { level: 2 }, dirs: 16 },
    { name: 'gate L3', gen: 'undead_gate', pal: 'undead', opt: { level: 3 }, dirs: 16 },
  ] }, { group: 'Undead buildings: siege', bg: 'undead', items: [
    { name: 'ballista', gen: 'undead_ballista', pal: 'undead', dirs: 24 },
    { name: 'catapult', gen: 'undead_catapult', pal: 'undead', dirs: 24, anims: 3 },
  ] });
})(window.AS);
