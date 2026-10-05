/* ALIEN STRIKE — alien / Choir / organic structures and turret guns (package structAlien).
 * New generators only (never overwrites existing AS.Models entries):
 *   saTurret(p,{style})   turret bases: needle | ancient | rack | flak | organic (+ size)
 *   gun2(p,{kind,size})   rotating guns: cannon | long | heavy | twin | flak | missile | organic | beam | crystal | mortar
 *   ... structure generators below (spires, relays, wells, halls, hives, flora, cores).
 * Object space: +x right/forward, +y toward the viewer (front face of a structure). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;
  const P = (p) => Object.assign({ a: '#a59e8c', b: '#d8d0bc', t: '#5a4f7a', g: '#b07cff', d: '#34303e' }, p || {});
  const cs = (c, k) => C.str(k ? C.shade(c, k) : c);
  const ca = (c, a) => C.str(c, a);
  const ngon = (x, y, r, n, rot) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + i / n * TAU; a.push(x + Math.cos(t) * r, y + Math.sin(t) * r); } return a; };
  const SEAM = 'rgba(0,0,0,0.38)', SEAM2 = 'rgba(0,0,0,0.55)', HI = 'rgba(255,255,255,0.28)';
  const mirror = (pts) => pts.map((v, i) => (i % 2 ? -v : v));
  // soft emissive spot painted on a top face (the face is already solid, so alpha is safe)
  function glow(c, col, x, y, r, a) {
    a = a === undefined ? 1 : a;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(C.shade(col, 0.65), a)); g.addColorStop(0.35, C.str(col, a * 0.95)); g.addColorStop(1, C.str(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function ring(c, col, x, y, r, w, a0, a1) { c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0 || 0, a1 === undefined ? TAU : a1); c.stroke(); c.restore(); }
  // radial blade (fin / buttress / petal) from radius r0 to r1 along angle a
  function blade(c, a, r0, r1, w0, w1, tip) {
    const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    S.poly(c, [dx * r0 + px * w0, dy * r0 + py * w0, dx * r1 + px * w1, dy * r1 + py * w1, dx * (r1 + (tip || 0)), dy * (r1 + (tip || 0)), dx * r1 - px * w1, dy * r1 - py * w1, dx * r0 - px * w0, dy * r0 - py * w0]);
  }
  // vertical emissive strip on the FRONT (+y) wall of a part: a thin sliver just proud of the wall
  const frontStrip = (x0, x1, yWall) => (c) => S.poly(c, [x0, yWall - 0.8, x1, yWall - 0.8, x1, yWall + 0.35, x0, yWall + 0.35]);
  // multi-prism crystal cluster as two parts (body + lit facet edge): crystals = [[angle, lean, baseR, height, baseDist]]
  function crystalCluster(parts, z0, crystals, side, top, hi) {
    const zMax = Math.max.apply(null, crystals.map((k) => k[3]));
    const at = (k, z) => { const t = z / k[3]; const d = k[4] + k[1] * z; const r = k[2] * (t < 0.72 ? 1 - t * 0.15 : (1 - t) / 0.28 * 0.89); return [Math.cos(k[0]) * d, Math.sin(k[0]) * d, Math.max(0.15, r)]; };
    parts.push({ z0, z1: z0 + zMax, side, top, ao: 0.35, shape: (c, zt) => { const z = zt * zMax; for (const k of crystals) if (z <= k[3]) { const q = at(k, z); S.poly(c, ngon(q[0], q[1], q[2], 6, k[0])); } } });
    parts.push({ z0, z1: z0 + zMax, side: hi, top: hi, flat: true, shape: (c, zt) => { const z = zt * zMax; for (const k of crystals) if (z <= k[3] * 0.9) { const q = at(k, z); S.poly(c, [q[0] - q[2] * 0.95, q[1] + q[2] * 0.1, q[0] - q[2] * 0.55, q[1] + q[2] * 0.2, q[0] - q[2] * 0.55, q[1] + q[2] * 0.55, q[0] - q[2] * 0.85, q[1] + q[2] * 0.45]); } } });
  }
  // ring-with-hole path (nonzero fill)
  function annulus(c, x, y, r1, r2) { c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU); c.moveTo(x + r2, y); c.arc(x, y, r2, TAU, 0, true); }
  const hostile = (p) => C.str(C.mix(p.g, '#ff4a7a', 0.45));

  /* ======================================================================
   * TURRET BASES — single-direction sheets; the gun sheet sits at gunZ.
   * needle  (turret)          slender bone spire on a sunk violet plate, crystal needles, gunZ 12
   * ancient (turret_heavy/aa) big carved dome on a stepped plinth, glyph bands,     gunZ 12 (x size)
   * rack    (sam)             diamond launch pad with four corner launch pylons,    gunZ 8
   * flak    (flak)            hex gun deck on three float pontoons, ammo lockers,   gunZ 8
   * organic (turret_organic)  fleshy bulb in a ring of opened magenta petals,       gunZ 8
   * ====================================================================== */
  M.saTurret = function (p, o) {
    p = P(p); o = o || {};
    const st = o.style || 'needle';
    const parts = [];
    const plateTop = C.shade(p.d, 0.16);
    const sunkPlate = (R, n, rot) => ({
      z0: 0, z1: 2, side: p.d, top: plateTop, bevel: true, shape: (c) => S.poly(c, ngon(0, 0, R, n, rot)),
      detail: (c) => {
        ring(c, ca(C.shade(p.g, -0.35), 0.9), 0, 0, R * 0.8, 1.6);
        ring(c, cs(p.g, 0.15), 0, 0, R * 0.8, 0.7);
        for (let i = 0; i < n; i++) { const a = rot + (i + 0.5) / n * TAU; S.lines(c, SEAM2, 0.45, [Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, Math.cos(a) * R * 0.99, Math.sin(a) * R * 0.99]); }
      },
    });
    let H = 12, gunZ = 12, R = 14;
    if (st === 'needle') {
      R = 14;
      parts.push(sunkPlate(12.5, 8, TAU / 16));
      // three swept buttress fins
      parts.push({ z0: 0, z1: 9, side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => { for (let i = 0; i < 3; i++) blade(c, i / 3 * TAU + TAU / 12, 2, 11.5 - zt * 7.8, 1.9, 1.1, 0.8); } });
      // tall crystal needles between the fins, leaning outward
      parts.push({ z0: 0, z1: 13, side: C.mix(p.g, p.d, 0.35), top: C.shade(p.g, 0.5), ao: 0.15,
        shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + TAU / 12 + Math.PI / 3; const rr = 7.2 + zt * 3.6; const w = 1.5 - zt * 1.2; S.poly(c, [Math.cos(a) * rr - w, Math.sin(a) * rr, Math.cos(a) * rr, Math.sin(a) * rr - w, Math.cos(a) * rr + w, Math.sin(a) * rr, Math.cos(a) * rr, Math.sin(a) * rr + w]); } },
        detail: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + TAU / 12 + Math.PI / 3; S.dot(c, '#ffffff', Math.cos(a) * 10.8, Math.sin(a) * 10.8, 0.35); } } });
      // the spire shaft (slender, tapering, with a glowing front channel)
      parts.push({ z0: 2, z1: 14, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, ngon(0, 0, 4.6 - zt * 1.6, 6, TAU / 12)) });
      parts.push({ z0: 3, z1: 13, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.4), flat: true, shape: (c, zt) => { const r = (4.6 - zt * 1.6) * 0.866; S.poly(c, [-0.55, r - 0.6, 0.55, r - 0.6, 0.55, r + 0.3, -0.55, r + 0.3]); } });
      // collar the gun turns on
      parts.push({ z0: 13, z1: 15, side: p.d, top: C.shade(p.d, 0.22), shape: (c) => S.poly(c, ngon(0, 0, 5.4, 8, TAU / 16)),
        detail: (c) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; S.dot(c, cs(p.g, 0.3), Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0.55); } } });
      H = 16; gunZ = 15;
    } else if (st === 'ancient') {
      R = 15;
      parts.push(sunkPlate(14, 8, TAU / 16));
      // four claw buttresses on the diagonals
      parts.push({ z0: 0, z1: 7, side: p.d, top: C.shade(p.a, -0.25), ao: 0.45, shape: (c, zt) => { for (let i = 0; i < 4; i++) blade(c, i / 4 * TAU + TAU / 8, 8, 14.2 - zt * 4.6, 2.4, 1.4, 0.6); } });
      // carved drum
      parts.push({ z0: 2, z1: 6, side: p.a, top: p.b, shape: (c) => S.circ(c, 0, 0, 11),
        detail: (c) => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.lines(c, SEAM, 0.5, [Math.cos(a) * 9.2, Math.sin(a) * 9.2, Math.cos(a) * 10.8, Math.sin(a) * 10.8]); } } });
      // glyph slots on the drum front
      parts.push({ z0: 3, z1: 5, side: p.g, top: C.shade(p.g, 0.4), flat: true, shape: (c) => { for (const x of [-6.5, -2.2, 2.2, 6.5]) { const y = Math.sqrt(121 - x * x); S.poly(c, [x - 0.7, y - 0.8, x + 0.7, y - 0.8, x + 0.7, y + 0.3, x - 0.7, y + 0.3]); } } });
      // the dome
      parts.push({ z0: 6, z1: 12, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 10 * Math.cos(zt * 1.1)),
        detail: (c) => { ring(c, SEAM, 0, 0, 3.6, 0.5); } });
      // glowing glyph band around the dome (front arc only)
      parts.push({ z0: 8, z1: 8, side: p.g, top: C.shade(p.g, 0.25), flat: true, stroke: 0.9, shape: (c) => c.arc(0, 0, 9.0, 0.25, Math.PI - 0.25) });
      parts.push({ z0: 11, z1: 12.6, side: p.d, top: C.shade(p.d, 0.25), shape: (c) => S.circ(c, 0, 0, 5) });
      H = 13; gunZ = 12.5;
    } else if (st === 'rack') {
      R = 15;
      // diamond launch pad with hazard corners
      parts.push({ z0: 0, z1: 2.4, side: p.d, top: plateTop, shape: (c) => S.poly(c, [13.5, 0, 0, 13.5, -13.5, 0, 0, -13.5]),
        detail: (c) => {
          S.lines(c, SEAM2, 0.5, [6.75, -6.75, -6.75, 6.75, 6.75, 6.75, -6.75, -6.75]);
          for (const [x, y] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) { S.fillPoly(c, hostile(p), [x * 1.08, y * 1.08, x * 0.86 + y * 0.12, y * 0.86 + x * 0.12, x * 0.86 - y * 0.12, y * 0.86 - x * 0.12]); }
          ring(c, ca(p.g, 0.9), 0, 0, 8.2, 0.8);
        } });
      // four corner launch pylons (blast deflectors)
      parts.push({ z0: 1, z1: 11, side: p.a, top: p.b, ao: 0.45, shape: (c, zt) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; const r = 10.4 - zt * 1.6, w = 2.2 - zt * 1.1; S.poly(c, [Math.cos(a) * (r + w), Math.sin(a) * (r + w), Math.cos(a) * r - Math.sin(a) * w, Math.sin(a) * r + Math.cos(a) * w, Math.cos(a) * (r - w), Math.sin(a) * (r - w), Math.cos(a) * r + Math.sin(a) * w, Math.sin(a) * r - Math.cos(a) * w]); } } });
      parts.push({ z0: 11, z1: 12.5, side: p.g, top: C.shade(p.g, 0.55), flat: true, shape: (c) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; S.circ(c, Math.cos(a) * 8.8, Math.sin(a) * 8.8, 0.85); } } });
      // turntable
      parts.push({ z0: 2, z1: 7, side: p.d, top: C.shade(p.a, -0.2), shape: (c) => S.poly(c, ngon(0, 0, 6.2, 8, TAU / 16)),
        detail: (c) => { ring(c, SEAM2, 0, 0, 4.4, 0.6); } });
      H = 13; gunZ = 7.5;
    } else if (st === 'flak') {
      R = 18;
      // three float pontoons
      parts.push({ z0: 0, z1: 4, side: p.d, top: C.shade(p.d, 0.25), shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; S.ell(c, Math.cos(a) * 11.5, Math.sin(a) * 11.5, 6.4 - zt * 0.6, 3.4 - zt * 0.4, a + Math.PI / 2); } },
        detail: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; const x = Math.cos(a) * 11.5, y = Math.sin(a) * 11.5; S.lines(c, hostile(p), 1.1, [x + Math.sin(a) * 3.6, y - Math.cos(a) * 3.6, x - Math.sin(a) * 3.6, y + Math.cos(a) * 3.6]); } } });
      // gun deck
      parts.push({ z0: 3, z1: 6, side: C.shade(p.a, -0.2), top: p.b, shape: (c) => S.poly(c, ngon(0, 0, 10.5, 6, Math.PI / 6)),
        detail: (c) => {
          ring(c, SEAM2, 0, 0, 6.6, 0.6);
          S.lines(c, SEAM, 0.45, [7.5, -4.5, 7.5, 4.5, -3.75, 8.2, -9.6, -0.6, -3.75, -8.2, -9.6, 0.6]);
          for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; S.dot(c, SEAM2, Math.cos(a) * 9.5, Math.sin(a) * 9.5, 0.45); }
        } });
      // ammo lockers on alternating deck corners
      parts.push({ z0: 6, z1: 9, side: p.d, top: C.shade(p.a, -0.1), shape: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 3; const x = Math.cos(a) * 8.2, y = Math.sin(a) * 8.2; S.poly(c, ngon(x, y, 2.4, 4, a)); } },
        detail: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 3; S.dot(c, cs(p.g, 0.2), Math.cos(a) * 8.2, Math.sin(a) * 8.2, 0.6); } } });
      parts.push({ z0: 6, z1: 8, side: p.d, top: C.shade(p.d, 0.22), shape: (c) => S.circ(c, 0, 0, 5.4) });
      H = 10; gunZ = 8;
    } else { // organic
      R = 18;
      const flesh = p.a, fleshT = p.b;
      // creep pad and root tendrils
      parts.push({ z0: 0, z1: 1.5, side: p.d, top: C.shade(p.d, 0.2), bevel: false, shape: (c) => S.blob(c, 0, 0, 15.5, 41, 12, 0.32),
        detail: (c) => { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; S.lines(c, ca(p.g, 0.55), 0.6, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a + 0.2) * 13, Math.sin(a + 0.2) * 13]); } } });
      // opened petals: low at the root, curling up toward the tips (the walls form the lit inner face)
      parts.push({ z0: 0.6, z1: 6, side: C.mix(fleshT, '#ff86b8', 0.2), top: C.mix(fleshT, '#ffb0d0', 0.35), ao: 0.55,
        shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; blade(c, a, 4.5 + zt * zt * 8.5, 14.5 - zt * 1.2, 2.6 + zt * 0.8, 3.6 - zt * 1.6, 1.6); } },
        detail: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; S.lines(c, cs(p.t, 0.15), 0.9, [Math.cos(a) * 13, Math.sin(a) * 13, Math.cos(a) * 15, Math.sin(a) * 15]); } } });
      parts.push({ z0: 1.6, z1: 1.6, side: p.g, top: C.shade(p.g, 0.3), flat: true, shape: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; S.circ(c, Math.cos(a) * 7.4, Math.sin(a) * 7.4, 1.2); } } });
      // the bulb
      parts.push({ z0: 1.5, z1: 9, side: flesh, top: fleshT, shape: (c, zt) => S.blob(c, 0, 0, 6.2 * Math.cos(zt * 0.95), 17, 9, 0.12),
        detail: (c) => { S.lines(c, ca(C.shade(flesh, -0.4), 0.7), 0.5, [-2.5, -1, 1.5, 2.2, 1, -2.4, -1.5, 1.6]); } });
      // glowing sacs on the bulb front
      parts.push({ z0: 3, z1: 5, side: C.shade(p.g, -0.2), top: C.shade(p.g, 0.4), flat: true, shape: (c) => { S.circ(c, -2.8, 4.9, 1.1); S.circ(c, 2.2, 5.1, 0.9); S.circ(c, 4.9, 2.4, 0.75); } });
      parts.push({ z0: 9, z1: 9.5, side: p.d, top: C.shade(p.d, 0.15), shape: (c) => S.blob(c, 0, 0, 3.6, 5, 7, 0.2) });
      H = 10; gunZ = 8.5;
    }
    return { r: R, h: H + 2, parts, scale: o.size || 1, style: 'unit', gunZ: gunZ * (o.size || 1) };
  };

  /* ======================================================================
   * GUN2 — rotating turret guns (24 directions). +x is the muzzle.
   * ====================================================================== */
  M.gun2 = function (p, o) {
    p = P(p); o = o || {};
    const kind = o.kind || 'cannon';
    const sc = o.size || 1;
    const parts = [];
    const metalS = p.d, metalT = C.mix(p.d, p.b, 0.45);
    const lens = (x, y, r, z) => ({ z0: z, z1: z + 1, side: C.shade(p.g, -0.3), top: p.g, flat: true, shape: (c) => S.circ(c, x, y, r), detail: (c) => { glow(c, p.g, x, y, r); S.dot(c, '#ffffff', x - r * 0.3, y - r * 0.3, r * 0.3); } });
    if (kind === 'cannon' || kind === 'long') {
      const L = kind === 'long' ? 23 : 18.5;
      parts.push({ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.poly(c, S.sym([6.5, 0, 3, 3.8, -3.5, 4.4, -6.5, 2.4, -6.5, 0])),
        detail: (c) => { S.lines(c, SEAM, 0.45, [1, -3.9, 1, 3.9, -6, 0, -3.6, 0]); S.lines(c, HI, 0.45, [6, -0.3, 3, -3.4]); } });
      // swept crystal stabiliser fins
      parts.push({ z0: 2, z1: 6.5, side: p.d, top: C.mix(p.t, p.g, 0.35), shape: (c, zt) => { const t = zt * 1.4; S.poly(c, [-1, 3.6, -7 - t, 5.8 + t * 0.4, -7.8 - t, 4.6, -2.6, 2.6]); S.poly(c, mirror([-1, 3.6, -7 - t, 5.8 + t * 0.4, -7.8 - t, 4.6, -2.6, 2.6])); } });
      // needle barrel
      parts.push({ z0: 1.6, z1: 3.2, side: metalS, top: metalT, shape: (c) => S.poly(c, [3, -1.3, L - 3.5, -0.75, L, 0, L - 3.5, 0.75, 3, 1.3]),
        detail: (c) => S.lines(c, cs(p.g, 0.25), 0.5, [5, 0, L - 3.5, 0]) });
      parts.push({ z0: 1, z1: 3.8, side: p.d, top: C.mix(p.a, p.t, 0.4), shape: (c) => { S.rrect(c, 4.5, -1.9, 2.2, 3.8, 0.6); S.rrect(c, L * 0.62, -1.4, 1.4, 2.8, 0.5); } });
      parts.push({ z0: 1.8, z1: 3, side: C.shade(p.g, -0.2), top: C.shade(p.g, 0.5), flat: true, shape: (c) => S.poly(c, [L - 3, -0.6, L + 1.4, 0, L - 3, 0.6]) });
      parts.push(lens(-2, 0, 1.25, 4));
    } else if (kind === 'heavy') {
      // armoured mantlet
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c) => S.poly(c, S.sym([7.5, 0, 6.5, 5.2, -1.5, 7.4, -7, 6.6, -9, 3.2, -9, 0])),
        detail: (c) => {
          S.lines(c, SEAM, 0.5, [-1.5, -7.2, -1.5, 7.2, 6.2, -5, -1.5, -5, 6.2, 5, -1.5, 5]);
          S.lines(c, HI, 0.5, [7.2, -0.4, 6.2, -4.8]);
          for (let i = 0; i < 3; i++) S.lines(c, SEAM2, 0.5, [-8.4 + i * 1.5, -2.2, -8.4 + i * 1.5, 2.2]);
        } });
      // cheek armour plates
      parts.push({ z0: 1, z1: 6.8, side: p.d, top: C.mix(p.a, p.d, 0.35), shape: (c) => { S.poly(c, [5, 5.4, -2, 7.8, -6.8, 7.2, -5, 5.2]); S.poly(c, mirror([5, 5.4, -2, 7.8, -6.8, 7.2, -5, 5.2])); },
        detail: (c) => { S.lines(c, cs(p.g, 0.15), 0.6, [3, 5.9, -4.6, 6.8, 3, -5.9, -4.6, -6.8]); } });
      // lance barrel
      parts.push({ z0: 2, z1: 4.8, side: metalS, top: metalT, shape: (c) => S.rrect(c, 4, -2.1, 17.5, 4.2, 1.2),
        detail: (c) => { S.lines(c, HI, 0.5, [6, -1.4, 20, -1.4]); S.lines(c, SEAM2, 0.5, [6, 1.2, 20, 1.2]); } });
      // capacitor rings (glow bands)
      parts.push({ z0: 1.5, z1: 5.3, side: C.shade(p.g, -0.25), top: C.shade(p.g, 0.35), flat: true, shape: (c) => { S.rrect(c, 9, -2.7, 1.5, 5.4, 0.5); S.rrect(c, 13.4, -2.6, 1.4, 5.2, 0.5); } });
      // muzzle head
      parts.push({ z0: 1.6, z1: 5.2, side: p.d, top: C.mix(p.a, p.t, 0.3), shape: (c) => S.poly(c, [19.5, -2.9, 23.5, -1.8, 23.5, 1.8, 19.5, 2.9]),
        detail: (c) => S.dot(c, cs(p.g, 0.4), 23, 0, 0.9) });
      parts.push(lens(-4, 0, 2, 6));
    } else if (kind === 'twin') {
      parts.push({ z0: 0, z1: 4.6, side: p.a, top: p.b, shape: (c) => S.rrect(c, -6.5, -5.4, 12, 10.8, 2.6),
        detail: (c) => {
          S.lines(c, SEAM, 0.45, [-2, -5.2, -2, 5.2, -6.2, 0, -2, 0]);
          S.fillPoly(c, cs(p.t), [-6.2, -4.4, -4.6, -4.4, -4.6, 4.4, -6.2, 4.4]);
          S.lines(c, HI, 0.45, [4.8, -4, 4.8, 4]);
        } });
      parts.push({ z0: 1.8, z1: 3.4, side: metalS, top: metalT, shape: (c) => { S.rrect(c, 3, -3.1, 13.5, 1.7, 0.7); S.rrect(c, 3, 1.4, 13.5, 1.7, 0.7); },
        detail: (c) => S.lines(c, HI, 0.35, [4, -2.8, 15, -2.8, 4, 1.7, 15, 1.7]) });
      parts.push({ z0: 1.3, z1: 3.9, side: p.d, top: C.mix(p.a, p.d, 0.3), shape: (c) => { S.rrect(c, 14, -3.5, 3, 2.5, 0.6); S.rrect(c, 14, 1, 3, 2.5, 0.6); S.rrect(c, 4, -4, 2, 8, 0.6); } });
      parts.push({ z0: 0.6, z1: 5.2, side: p.d, top: C.shade(p.t, 0.1), shape: (c) => S.rrect(c, -4.5, 5, 6.5, 3.2, 1),
        detail: (c) => S.lines(c, SEAM2, 0.4, [-2.3, 5.2, -2.3, 8, -0.1, 5.2, -0.1, 8]) });
      parts.push(lens(1.5, -2.6, 0.95, 4.6));
    } else if (kind === 'flak') {
      parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.25), shape: (c) => S.circ(c, 0, 0, 6.8) });
      // side ammo drums
      parts.push({ z0: 1, z1: 6, side: p.d, top: C.mix(p.a, p.t, 0.5), shape: (c) => { S.circ(c, -1.5, 6.6, 2.7); S.circ(c, -1.5, -6.6, 2.7); },
        detail: (c) => { for (const y of [6.6, -6.6]) { ring(c, SEAM2, -1.5, y, 1.6, 0.5); S.dot(c, cs(p.g, 0.2), -1.5, y, 0.6); } } });
      // mantlet
      parts.push({ z0: 3, z1: 6.6, side: p.a, top: p.b, shape: (c) => S.poly(c, S.sym([5.5, 0, 5, 4.6, -4, 5, -6, 3.2, -6, 0])),
        detail: (c) => { S.lines(c, SEAM, 0.45, [1, -4.6, 1, 4.6, -5.5, 0, -2.5, 0]); S.lines(c, HI, 0.45, [5.2, -0.3, 4.8, -4.2]); } });
      // four barrels (two pairs)
      parts.push({ z0: 3.8, z1: 5.2, side: metalS, top: metalT, shape: (c) => { for (const y of [-3.7, -1.5, 1.5, 3.7]) S.rrect(c, 4, y - 0.65, 11.5, 1.3, 0.5); } });
      parts.push({ z0: 3.4, z1: 5.6, side: p.d, top: C.mix(p.a, p.d, 0.3), shape: (c) => { S.rrect(c, 14, -4.8, 2.2, 4.4, 0.6); S.rrect(c, 14, 0.4, 2.2, 4.4, 0.6); S.rrect(c, 8.5, -4.6, 1.4, 9.2, 0.5); } });
      parts.push(lens(-3, 0, 1.1, 6.6));
    } else if (kind === 'missile') {
      const war = hostile(p);
      // pivot yoke
      parts.push({ z0: 0, z1: 4, side: p.d, top: C.shade(p.d, 0.22), shape: (c) => S.rrect(c, -4.5, -4, 9, 8, 2.2) });
      // twin pods
      parts.push({ z0: 3, z1: 9, side: p.a, top: p.b, shape: (c) => { S.rrect(c, -6.5, 1.3, 13, 7.2, 1.6); S.rrect(c, -6.5, -8.5, 13, 7.2, 1.6); },
        detail: (c) => {
          for (const sg of [1, -1]) {
            const yc = 4.9 * sg;
            S.lines(c, SEAM, 0.45, [-3, yc - 3.4, -3, yc + 3.4]);
            for (const dx of [1.6, 4.6]) for (const dy of [-1.8, 1.8]) { S.dot(c, '#141218', dx, yc + dy, 1.15); S.dot(c, war, dx + 0.25, yc + dy, 0.6); }
            S.fillPoly(c, cs(p.t, 0.1), [-6, yc - 3.2, -4.4, yc - 3.2, -4.4, yc + 3.2, -6, yc + 3.2]);
          }
        } });
      // warhead noses poking out of the tubes
      parts.push({ z0: 4, z1: 7.8, side: C.shade(war, -0.25), top: war, flat: true, shape: (c, zt) => { for (const yc of [4.9, -4.9]) for (const dy of [-1.8, 1.8]) S.poly(c, [6.4, yc + dy - 1, 8.6, yc + dy, 6.4, yc + dy + 1]); } });
      // rear blast plates
      parts.push({ z0: 3.5, z1: 8.6, side: p.d, top: C.mix(p.a, p.d, 0.4), shape: (c) => { S.rrect(c, -8, 1.6, 1.6, 6.6, 0.5); S.rrect(c, -8, -8.2, 1.6, 6.6, 0.5); } });
      // centre sensor between the pods
      parts.push({ z0: 4, z1: 6.5, side: p.d, top: C.shade(p.d, 0.3), shape: (c) => S.rrect(c, -2, -1.1, 6, 2.2, 0.8) });
      parts.push(lens(3.4, 0, 0.9, 6.5));
    } else if (kind === 'organic') {
      // fleshy head
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.ell(c, -0.5, 0, 6.8 - zt * 1.8, 5.8 - zt * 1.5),
        detail: (c) => { S.lines(c, ca(p.t, 0.8), 0.5, [-4, -2, 0, -0.6, -4, 2, 0, 0.6, -3, 0, 1.5, 0]); glow(c, p.g, -2.4, 0, 2.2); } });
      // mandible petals opening forward
      parts.push({ z0: 1.5, z1: 5, side: C.shade(p.a, -0.2), top: C.mix(p.b, p.t, 0.5), shape: (c, zt) => { const s = 1 + zt * 0.4; S.poly(c, [2.5, 1.4, 7, 3.4 * s, 10.5, 3, 7.5, 1.9, 4, 0.6]); S.poly(c, mirror([2.5, 1.4, 7, 3.4 * s, 10.5, 3, 7.5, 1.9, 4, 0.6])); } });
      // the spine (bone spike) it spits along
      parts.push({ z0: 2.4, z1: 4.4, side: C.shade(p.t, -0.3), top: C.shade(p.t, 0.35), shape: (c) => S.poly(c, [2, -1.2, 16, 0, 2, 1.2]),
        detail: (c) => S.lines(c, SEAM, 0.35, [6, -0.8, 6, 0.8, 9.5, -0.55, 9.5, 0.55, 12.5, -0.35, 12.5, 0.35]) });
      parts.push({ z0: 2.8, z1: 4, side: C.shade(p.g, -0.2), top: C.shade(p.g, 0.5), flat: true, shape: (c) => S.circ(c, 14.8, 0, 0.75) });
      // dorsal quills
      parts.push({ z0: 5, z1: 9, side: C.shade(p.t, -0.35), top: C.shade(p.t, 0.3), ao: 0.2, shape: (c, zt) => { const r = 1.3 * (1 - zt) + 0.15; S.circ(c, -3 - zt * 1.5, -2.2, r); S.circ(c, -3 - zt * 1.5, 2.2, r); S.circ(c, -5 - zt * 1.8, 0, r * 1.1); } });
    } else if (kind === 'beam') {
      parts.push({ z0: 0, z1: 5, side: p.a, top: p.b, shape: (c) => S.poly(c, S.sym([6.5, 0, 2, 5, -5.5, 4, -6.5, 0])),
        detail: (c) => S.lines(c, SEAM, 0.45, [-1, -4.4, -1, 4.4]) });
      parts.push({ z0: 1.5, z1: 4.5, side: p.d, top: C.mix(p.a, p.t, 0.4), shape: (c) => { S.poly(c, [3, 1.5, 15, 2.8, 15.5, 1.6, 4, 0.6]); S.poly(c, mirror([3, 1.5, 15, 2.8, 15.5, 1.6, 4, 0.6])); } });
      parts.push({ z0: 2.2, z1: 3.8, side: C.shade(p.g, -0.2), top: C.shade(p.g, 0.5), flat: true, shape: (c) => S.poly(c, [6, -0.7, 13, 0, 6, 0.7]) });
      parts.push(lens(-1.5, 0, 1.6, 5));
    } else if (kind === 'crystal') {
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.star(c, 0, 0, 7 - zt * 2.5, 3.6 - zt, 5, 0.3) });
      parts.push({ z0: 3, z1: 5.5, side: C.shade(p.g, -0.25), top: C.shade(p.g, 0.45), flat: true, shape: (c) => S.poly(c, [3, -1.8, 16, 0, 3, 1.8]),
        detail: (c) => S.lines(c, 'rgba(255,255,255,0.6)', 0.4, [4, -0.5, 14, 0]) });
      parts.push(lens(-1, 0, 1.4, 6));
    } else if (kind === 'mortar') {
      parts.push({ z0: 0, z1: 3.5, side: p.d, top: C.shade(p.d, 0.25), shape: (c) => S.circ(c, 0, 0, 6.6) });
      parts.push({ z0: 2, z1: 5, side: p.a, top: p.b, shape: (c) => { S.rrect(c, -3, 4.5, 6, 2, 0.8); S.rrect(c, -3, -6.5, 6, 2, 0.8); } });
      parts.push({ z0: 2.5, z1: 10, side: metalS, top: metalT, shape: (c, zt) => S.circ(c, 1.5 + zt * 4.5, 0, 3.1) ,
        detail: (c) => { S.dot(c, '#141218', 6, 0, 2.1); S.dot(c, ca(p.g, 0.7), 6, 0, 0.9); } });
    } else {
      return M.gun(p, o);
    }
    return { r: 24, h: 11, parts, scale: sc, style: 'unit', post: { rimStrength: 0.26 } };
  };

  /* ======================================================================
   * SPIRES — saSpire(p, {style, h})
   * lancer    (lancertower) jagged crystal cluster leaning out around a floating cyan aiming gem
   * resonator (resonator)   tall twin-tine prism fork with a violet resonance orb (anims 2 pulse)
   * ruin      (obelisk)     carved bone-stone monolith with violet glyph channels, broken top, fragments
   * arc       (pylon)       Choir tesla spire: tripod legs, floating charge rings, crystal tip
   * rod       (rod)         colony lightning rod: lattice mast, insulator stack, copper spike, console box
   * ====================================================================== */
  M.saSpire = function (p, o) {
    p = P(p); o = o || {};
    const st = o.style || 'ruin';
    const parts = [];
    let R = 16, H = 40;
    const cluster = (z0, crystals, side, top, hi) => crystalCluster(parts, z0, crystals, side, top, hi);
    if (st === 'lancer') {
      R = 18; H = o.h || 34;
      parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.2), shape: (c, zt) => S.blob(c, 0, 0, 13 - zt * 2, 23, 9, 0.3),
        detail: (c) => { ring(c, ca(p.g, 0.75), 0, 0, 5.5, 0.8); } });
      const k = H / 34;
      cluster(2, [[-2.6, 0.3, 3.9, 31 * k, 4.2], [-0.5, 0.34, 3.2, 25 * k, 4.8], [0.25, 0.4, 3.4, 27 * k, 4.4], [2.75, 0.36, 2.8, 19 * k, 5.4], [1.3, 0.42, 2.3, 14 * k, 8.4], [-1.6, 0.46, 2.1, 12 * k, 8.8], [3.6, 0.5, 1.8, 9 * k, 10]], C.shade(p.a, -0.05), p.b, C.mix(p.b, '#ffffff', 0.5));
      // gem cradle prongs + floating aiming gem (threat: cyan core)
      parts.push({ z0: 3, z1: 18 * k, side: p.d, top: p.a, shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; S.circ(c, Math.cos(a) * (1.5 + zt * 1.6), Math.sin(a) * (1.5 + zt * 1.6), 0.9); } } });
      const gz = 20 * k;
      parts.push({ z0: gz, z1: gz + 11, side: C.shade(p.g, -0.15), top: C.shade(p.g, 0.6), flat: true, shape: (c, zt) => { const r = 4.4 * (zt < 0.4 ? zt / 0.4 : (1 - zt) / 0.6) + 0.2; S.poly(c, [0, -r, r * 0.9, 0, 0, r, -r * 0.9, 0]); } });
      parts.push({ z0: gz + 3, z1: gz + 3, side: C.shade(p.g, -0.2), top: p.g, flat: true, stroke: 0.7, shape: (c) => S.ell(c, 0, 0, 6.4, 3) });
      parts.push({ z0: gz + 5, z1: gz + 5, side: C.shade(p.g, 0.3), top: '#ffffff', flat: true, shape: (c) => S.poly(c, [-1.6, 0.2, -0.5, -1.2, 0.3, 0.1]) });
      H = Math.max(H, gz + 12);
    } else if (st === 'resonator') {
      R = 16; H = o.h || 44;
      parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.22), shape: (c) => S.poly(c, ngon(0, 0, 11, 6, 0)),
        detail: (c) => { ring(c, ca(p.g, 0.85), 0, 0, 8.2, 1); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + TAU / 12; S.dot(c, cs(p.g, 0.3), Math.cos(a) * 8.2, Math.sin(a) * 8.2, 0.6); } } });
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => { for (let i = 0; i < 3; i++) blade(c, i / 3 * TAU + Math.PI / 2, 2, 9.5 - zt * 6, 1.8, 1.2, 0.6); } });
      const stem = Math.round(H * 0.42);
      parts.push({ z0: 2, z1: stem, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, ngon(0, 0, 3.6 - zt * 0.8, 4, Math.PI / 4)) });
      // fork yoke
      parts.push({ z0: stem, z1: stem + 3, side: p.d, top: p.a, shape: (c) => S.poly(c, [-6.5, -1.6, 6.5, -1.6, 7.5, 0, 6.5, 1.6, -6.5, 1.6, -7.5, 0]) });
      // twin tines diverging upward
      const tH = H - stem - 3;
      parts.push({ z0: stem + 3, z1: H, side: p.a, top: p.b, ao: 0.25, shape: (c, zt) => { const x = 5.5 + zt * 2.4, w = zt < 0.8 ? 2.4 : 2.4 * (1 - zt) / 0.2 + 0.2; S.poly(c, ngon(x, 0, w, 4, Math.PI / 4)); S.poly(c, ngon(-x, 0, w, 4, Math.PI / 4)); } });
      parts.push({ z0: stem + 3, z1: H - 3, side: C.mix(p.b, '#ffffff', 0.4), top: '#ffffff', flat: true, shape: (c, zt) => { const x = 5.5 + zt * 2.2; S.poly(c, [x - 1.6, 0.4, x - 0.8, 0.5, x - 0.8, 1.4, x - 1.4, 1.2]); S.poly(c, [-x - 1.6, 0.4, -x - 0.8, 0.5, -x - 0.8, 1.4, -x - 1.4, 1.2]); } });
      // the resonance orb and its halo ring (pulses on anim)
      const oz = stem + 3 + tH * 0.55;
      parts.push({ z0: oz - 3.5, z1: oz + 3.5, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.6), flat: true, shape: (c, zt, an) => S.circ(c, 0, 0, (2.9 + (an >= 0.5 ? 0.6 : 0)) * Math.sin(Math.max(0.12, zt) * Math.PI)),
        detail: (c) => glow(c, '#ffffff', 0, 0, 1.6) });
      parts.push({ z0: oz - 1, z1: oz - 1, side: p.g, top: C.shade(p.g, 0.35), flat: true, stroke: 0.8, shape: (c, zt, an) => S.ell(c, 0, 0, an >= 0.5 ? 6 : 4.8, an >= 0.5 ? 2.6 : 2.1) });
      parts.push({ z0: Math.round(stem * 0.7), z1: Math.round(stem * 0.7), side: p.g, top: C.shade(p.g, 0.35), flat: true, stroke: 0.8, shape: (c, zt, an) => S.ell(c, 0, 0, an >= 0.5 ? 4.6 : 5.4, an >= 0.5 ? 2 : 2.4) });
    } else if (st === 'ruin') {
      R = 17; H = o.h || 46;
      // tilted sunk footing slab + broken fragments
      parts.push({ z0: 0, z1: 3, side: C.mix(p.d, p.a, 0.25), top: C.mix(p.d, p.a, 0.5), shape: (c) => S.poly(c, [-11, -6, 9, -8, 12, 5, -9, 8]),
        detail: (c) => { S.lines(c, SEAM2, 0.5, [-10, 1, 11, -1, -1, -7, 1, 7]); S.lines(c, ca(p.g, 0.7), 0.7, [-8, 4.5, -3, 4.2, 4, -5.5, 8, -6]); } });
      parts.push({ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c, zt) => { S.poly(c, [11.5, 6, 15.5, 7, 15, 10.5, 11, 10.5]); S.poly(c, [-14, -1, -10.5, -2.5, -10, 1.5, -13.5, 2.5]); if (zt < 0.6) S.poly(c, [6, 9.5, 9.5, 9, 9, 12, 6.5, 12.5]); } });
      // the monolith: wide in x, thin in y, chamfered, broken top corner
      const mono = (zt) => { const w = 7 - zt * 1.3, d = 3.6 - zt * 0.6; const z = zt * (H - 3); const cut = z > H - 12 ? (z - (H - 12)) * 0.9 : 0; return [-w, -d + 0.8, -w + 0.8, -d, w - 0.8 - cut * 0.9, -d, w - cut, -d + 0.8, w - cut, d - 0.8, w - 0.8 - cut, d, -w + 0.8, d, -w, d - 0.8]; };
      parts.push({ z0: 3, z1: H, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, mono(zt)),
        detail: (c) => S.lines(c, SEAM, 0.45, [-4.5, -2.4, -4.5, 2.4]) });
      // carved glyph channel down the front face
      parts.push({ z0: 6, z1: H - 6, side: C.shade(p.g, -0.05), top: C.shade(p.g, 0.4), flat: true, shape: (c, zt) => {
        const z = 6 + zt * (H - 12), d = 3.6 - (z - 3) / (H - 3) * 0.6;
        const band = Math.floor(z) % 7;
        if (band === 0) S.poly(c, [-3.2, d - 0.8, 3.2, d - 0.8, 3.2, d + 0.3, -3.2, d + 0.3]);
        else if (band === 3) { S.poly(c, [-3.2, d - 0.8, -1.8, d - 0.8, -1.8, d + 0.3, -3.2, d + 0.3]); S.poly(c, [1.8, d - 0.8, 3.2, d - 0.8, 3.2, d + 0.3, 1.8, d + 0.3]); S.poly(c, [-0.5, d - 0.8, 0.5, d - 0.8, 0.5, d + 0.3, -0.5, d + 0.3]); }
        else S.poly(c, [-0.5, d - 0.8, 0.5, d - 0.8, 0.5, d + 0.3, -0.5, d + 0.3]);
      } });
      // weathering: dark crack line + the hollow eye glyph near the top
      parts.push({ z0: H - 9, z1: H - 6, side: p.g, top: '#ffffff', flat: true, shape: (c) => { const d = 3.1; S.poly(c, [-1.6, d - 0.7, 1.6, d - 0.7, 1.6, d + 0.35, -1.6, d + 0.35]); } });
    } else if (st === 'arc') {
      R = 16; H = o.h || 40;
      const arc = o.arc || '#9ff6ff';
      parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.2), shape: (c) => S.poly(c, ngon(0, 0, 11, 6, Math.PI / 6)),
        detail: (c) => { ring(c, ca(arc, 0.8), 0, 0, 8.4, 0.8); } });
      // tripod legs converging upward
      parts.push({ z0: 2, z1: 22, side: p.a, top: p.b, ao: 0.45, shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; const d = 8.6 * (1 - zt) + 1.6; S.poly(c, ngon(Math.cos(a) * d, Math.sin(a) * d, 1.7 - zt * 0.5, 4, a)); } } });
      parts.push({ z0: 4, z1: H - 6, side: p.d, top: C.shade(p.d, 0.3), shape: (c, zt) => S.circ(c, 0, 0, 1.6 - zt * 0.5) });
      // floating charge rings
      for (const [z, r] of [[16, 6], [23, 4.8], [29, 3.6]]) parts.push({ z0: z, z1: z + 1.5, side: C.shade(arc, -0.35), top: arc, flat: true, stroke: 1.1, shape: (c) => S.circ(c, 0, 0, r) });
      // crystal tip
      parts.push({ z0: H - 7, z1: H, side: C.shade(arc, -0.2), top: '#ffffff', flat: true, shape: (c, zt) => { const r = 2.4 * (zt < 0.3 ? 0.5 + zt / 0.6 : (1 - zt) / 0.7) + 0.2; S.poly(c, [0, -r, r, 0, 0, r, -r, 0]); } });
    } else { // rod (colony)
      R = 14; H = o.h || 50;
      parts.push({ z0: 0, z1: 2.5, side: '#4a4c50', top: '#8a8c8e', shape: (c) => S.rrect(c, -10, -9, 20, 18, 2),
        detail: (c) => { for (let i = 0; i < 5; i++) S.fillPoly(c, i % 2 ? '#2a2a2c' : cs(p.t), [-10 + i * 2, 9, -8.6 + i * 2, 9, -10 + i * 2 + 1.4, 7.6, -10 + i * 2, 7.6]); S.lines(c, SEAM, 0.45, [-10, 0, 10, 0]); } });
      // lattice mast (three legs) with cross bracing
      parts.push({ z0: 2, z1: H - 10, side: p.a, top: p.b, shape: (c, zt) => { const d = 4.2 - zt * 2.6; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; S.circ(c, Math.cos(a) * d, Math.sin(a) * d, 0.75); } } });
      parts.push({ z0: 8, z1: H - 12, side: C.shade(p.a, -0.2), top: p.a, shape: (c, zt) => { const z = 8 + zt * (H - 20); if (Math.floor(z) % 6 === 0) { const d = 4.2 - (z - 2) / (H - 12) * 2.6; S.poly(c, ngon(0, 0, d + 0.4, 3, -Math.PI / 2)); } } });
      // insulator disc stack
      parts.push({ z0: H - 12, z1: H - 4, side: '#3a5a6a', top: '#a8d8e8', shape: (c, zt, an) => { const z = zt * 8; S.circ(c, 0, 0, Math.floor(z) % 2 ? 1.1 : 2.4); } });
      parts.push({ z0: H - 4, z1: H + 3, side: '#8a4a1a', top: '#ffb070', shape: (c, zt) => S.circ(c, 0, 0, 1 - zt * 0.8) });
      // console box with status light
      parts.push({ z0: 2, z1: 7, side: p.d, top: p.a, shape: (c) => S.rrect(c, 3.5, 3, 5.5, 4.5, 0.8), detail: (c) => { S.fillPoly(c, cs(p.g), [4.4, 3.8, 8, 3.8, 8, 5.4, 4.4, 5.4]); S.dot(c, '#ff5a3a', 7.6, 6.6, 0.5); } });
      parts.push({ z0: 2, z1: 4, side: '#2a2c30', top: '#4a4c50', shape: (c) => S.circ(c, -6, 4, 2.6), detail: (c) => ring(c, cs(p.t), -6, 4, 1.6, 0.7) });
      H += 3;
    }
    return { r: R, h: H + 2, parts, style: 'unit' };
  };

  /* ======================================================================
   * SYSTEMS
   * saRadar     (radar, anims 8)       Choir sensor spire: buttressed mast, rotating dish, halo ring
   * saComms     (comms anims 2; shieldpylon {h, sanctum})  tall crystal broadcast spire with signal rings
   * saShieldGen (shieldgen anims 4)    emitter prongs around a core orb with two orbiting tilted rings
   * saWell      (power; reactor {style:'reactor'})  Lumen Well pit with crystal crown + light shaft /
   *                                    foundry reactor with molten grilles, fins and twin stacks
   * ====================================================================== */
  M.saRadar = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.18), shape: (c) => S.poly(c, ngon(0, 0, 12.5, 6, Math.PI / 6)),
      detail: (c) => { ring(c, ca(p.g, 0.8), 0, 0, 9.4, 0.8); S.lines(c, SEAM2, 0.45, [-10.8, 0, -8.6, 0, 10.8, 0, 8.6, 0]); } });
    // three buttress legs leaning in to the mast
    parts.push({ z0: 2, z1: 20, side: p.a, top: p.b, ao: 0.45, shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; const d = 9.5 * (1 - zt) + 2; blade(c, a, d - 1.2, d + 1.2, 1.5 - zt * 0.5, 1.3 - zt * 0.5, 0); } } });
    parts.push({ z0: 3, z1: 27, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, ngon(0, 0, 2.6 - zt * 0.8, 6, 0)) });
    parts.push({ z0: 6, z1: 20, side: C.shade(p.g, -0.1), top: p.g, flat: true, shape: (c, zt) => { const r = (2.6 - (zt * 14 + 3) / 24 * 0.8) * 0.86; S.poly(c, [-0.45, r - 0.5, 0.45, r - 0.5, 0.45, r + 0.35, -0.45, r + 0.35]); } });
    // head collar
    parts.push({ z0: 25, z1: 28, side: p.d, top: C.shade(p.d, 0.25), shape: (c) => S.poly(c, ngon(0, 0, 4.2, 8, 0)), detail: (c) => glow(c, p.g, 0, 0, 2) });
    // rotating dish: thick crescent with a lit concave face and a glowing feed horn
    parts.push({ z0: 27, z1: 33, side: p.a, top: p.b, shape: (c, zt, an) => { const a = an * TAU, ux = Math.cos(a), uy = Math.sin(a); const sp = 1.05 - Math.abs(zt - 0.5) * 0.5; c.moveTo(ux * 9 + Math.cos(a - sp) * 0.1, uy * 9); c.arc(-ux * 4, -uy * 4, 13.5, a - sp, a + sp); c.arc(-ux * 10, -uy * 10, 16, a + sp * 0.8, a - sp * 0.8, true); c.closePath(); },
      detail: (c, an) => { const a = an * TAU, ux = Math.cos(a), uy = Math.sin(a); S.lines(c, SEAM2, 0.6, [0, 0, ux * 9, uy * 9]); glow(c, p.g, ux * 9.5, uy * 9.5, 2); } });
    // floating halo + eye
    parts.push({ z0: 35, z1: 35, side: p.g, top: C.shade(p.g, 0.4), flat: true, stroke: 0.9, shape: (c) => S.circ(c, 0, 0, 3.6) });
    parts.push({ z0: 32, z1: 34, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.6), flat: true, shape: (c) => S.circ(c, 0, 0, 1.4) });
    return { r: 16, h: 38, parts, style: 'unit' };
  };

  M.saComms = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 64, sanct = !!o.sanctum;
    const parts = [];
    const cryS = C.mix(p.g, p.d, 0.45), cryT = C.mix(p.g, '#ffffff', 0.45);
    // stepped plinth
    parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.18), shape: (c) => S.poly(c, ngon(0, 0, sanct ? 15 : 11.5, sanct ? 8 : 6, sanct ? TAU / 16 : 0)),
      detail: (c) => { ring(c, ca(p.g, 0.85), 0, 0, sanct ? 12.5 : 9.4, 0.9); } });
    parts.push({ z0: 3, z1: 6, side: p.a, top: p.b, shape: (c) => S.poly(c, ngon(0, 0, 7.5, 6, 0)), detail: (c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; S.lines(c, SEAM, 0.45, [Math.cos(a) * 5, Math.sin(a) * 5, Math.cos(a) * 7.3, Math.sin(a) * 7.3]); } } });
    if (sanct) parts.push({ z0: 2, z1: 16, side: p.a, top: p.b, shape: (c, zt) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; S.poly(c, ngon(Math.cos(a) * 12, Math.sin(a) * 12, 2 - zt * 0.8, 4, a)); } } });
    if (sanct) parts.push({ z0: 16, z1: 18, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.5), flat: true, shape: (c) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; S.circ(c, Math.cos(a) * 12, Math.sin(a) * 12, 1.1); } } });
    // bone sheath blades gripping the crystal
    parts.push({ z0: 5, z1: Math.round(H * 0.4), side: p.a, top: p.b, ao: 0.35, shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2 + zt * 0.5; const d = 4.6 - zt * 1.4; S.poly(c, ngon(Math.cos(a) * d, Math.sin(a) * d, 1.7 - zt * 0.9, 4, a)); } } });
    // the crystal shaft (slight twist)
    parts.push({ z0: 6, z1: H, side: cryS, top: cryT, ao: 0.25, shape: (c, zt) => { const r = zt < 0.85 ? 3.4 - zt * 1.2 : (1 - zt) / 0.15 * 2.38 + 0.15; S.poly(c, ngon(0, 0, r, 4, zt * 0.9)); } });
    parts.push({ z0: 8, z1: H - 6, side: cryT, top: '#ffffff', flat: true, shape: (c, zt) => { const r = 3.4 - zt * 1.2; S.poly(c, [-r * 0.8, r * 0.1, -r * 0.45, r * 0.25, -r * 0.45, r * 0.6, -r * 0.7, r * 0.5]); } });
    // signal rings (pulse outward on alternate frames)
    const rings = [[0.5, 7], [0.66, 5.6], [0.8, 4.2]];
    for (const [f, r] of rings) parts.push({ z0: Math.round(H * f), z1: Math.round(H * f), side: p.g, top: C.shade(p.g, 0.4), flat: true, stroke: 0.9, shape: (c, zt, an) => S.ell(c, 0, 0, r * (an >= 0.5 ? 1.25 : 1), r * 0.45 * (an >= 0.5 ? 1.25 : 1)) });
    // beacon
    parts.push({ z0: H - 3, z1: H + 2, side: C.shade(p.g, -0.05), top: '#ffffff', flat: true, shape: (c, zt, an) => S.circ(c, 0, 0, (an >= 0.5 ? 2.1 : 1.5) * Math.sin(Math.max(0.2, zt) * Math.PI)) });
    return { r: sanct ? 17 : 14, h: H + 4, parts, style: 'unit' };
  };

  M.saShieldGen = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.18), shape: (c) => S.poly(c, ngon(0, 0, 13.5, 6, 0)),
      detail: (c) => { ring(c, ca(p.g, 0.85), 0, 0, 10.5, 0.9); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + TAU / 12; S.lines(c, ca(p.g, 0.7), 0.6, [Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * 9.5, Math.sin(a) * 9.5]); } } });
    // three curved emitter prongs
    parts.push({ z0: 2, z1: 20, side: p.a, top: p.b, ao: 0.45, shape: (c, zt) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; const d = 8.6 - Math.sin(zt * Math.PI) * 1.5 + zt * 1.5; S.poly(c, ngon(Math.cos(a) * d, Math.sin(a) * d, 2.2 - zt * 1.2, 4, a)); } } });
    parts.push({ z0: 20, z1: 21.5, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.5), flat: true, shape: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 2; S.circ(c, Math.cos(a) * 10, Math.sin(a) * 10, 1); } } });
    // core column + orb
    parts.push({ z0: 3, z1: 11, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, ngon(0, 0, 4.5 - zt * 1.5, 6, 0)) });
    parts.push({ z0: 11, z1: 21, side: C.shade(p.g, -0.15), top: C.shade(p.g, 0.6), flat: true, shape: (c, zt) => S.circ(c, 0, 0, 4.2 * Math.sin(Math.max(0.15, zt) * Math.PI)), detail: (c) => glow(c, '#ffffff', -0.6, -0.6, 1.6) });
    // two orbiting tilted rings (phase advances with anim)
    const rc = C.shade(p.g, 0.25);
    const orbit = (R, ph) => ({ z0: 10, z1: 22, side: rc, top: rc, flat: true, shape: (c, zt, an) => { const z = 10 + zt * 12; for (let i = 0; i < 48; i++) { const t = i / 48 * TAU; const rz = 16 + Math.sin(t + ph(an)) * 4.5; if (Math.abs(rz - z) < 0.55) S.circ(c, Math.cos(t) * R, Math.sin(t) * R * 0.95, 0.75); } } });
    parts.push(orbit(7.6, (an) => -an * TAU));
    parts.push(orbit(9.2, (an) => an * TAU + Math.PI * 0.5));
    return { r: 16, h: 24, parts, style: 'unit' };
  };

  M.saWell = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    if (o.style === 'reactor') {
      const hot = '#ffcf6a', molten = C.str(C.mix(p.g, '#ff5a1a', 0.3));
      // base slab with charge-port hatch
      parts.push({ z0: 0, z1: 4, side: p.d, top: C.shade(p.d, 0.2), shape: (c) => S.rrect(c, -24, -20, 48, 40, 4),
        detail: (c) => {
          S.lines(c, SEAM2, 0.6, [-24, 9, 24, 9, -24, -9, 24, -9]);
          // hazard-framed charge hatch
          c.save(); c.beginPath(); S.rrect(c, 12, 10, 10, 8.5, 1); c.clip();
          for (let i = -2; i < 8; i++) S.fillPoly(c, i % 2 ? '#1a1612' : '#f0b02a', [12 + i * 2.4, 10, 14 + i * 2.4, 10, 10 + i * 2.4, 18.5, 8 + i * 2.4, 18.5]);
          c.restore();
          S.fillPoly(c, cs(p.d, 0.05), [13.5, 11.5, 20.5, 11.5, 20.5, 17, 13.5, 17]);
          S.dot(c, molten, 17, 14.2, 1);
          for (let i = 0; i < 6; i++) S.dot(c, SEAM2, -21 + i * 3.4, 17.5, 0.5);
        } });
      // cooling fins
      parts.push({ z0: 4, z1: 17, side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + TAU / 20; blade(c, a, 10, 17.5 - zt * 3.5, 0.9, 0.8, 0); } } });
      // reactor vessel
      parts.push({ z0: 4, z1: 22, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, ngon(0, 0, 12 - zt * 1.4, 8, TAU / 16)),
        detail: (c) => { ring(c, SEAM2, 0, 0, 8.4, 1.4); S.dot(c, '#1a120e', 0, 0, 7.6); glow(c, hot, 0, 0, 7.4); glow(c, '#ffffff', 0, 0, 3); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.lines(c, SEAM2, 0.5, [Math.cos(a) * 8.6, Math.sin(a) * 8.6, Math.cos(a) * 10.4, Math.sin(a) * 10.4]); } } });
      // molten core seen through the front grille: bright slits between dark bars
      parts.push({ z0: 7, z1: 19, side: C.mix(hot, '#ff7a1a', 0.3), top: hot, flat: true, ao: -0.25, shape: (c, zt) => { const r = (12 - (zt * 12 + 3) / 18 * 1.4) * 0.924; for (const x of [-5.6, -2.8, 0, 2.8, 5.6]) { const y = Math.sqrt(Math.max(0, r * r - x * x * 0.55)); S.poly(c, [x - 0.8, y - 0.9, x + 0.8, y - 0.9, x + 0.8, y + 0.3, x - 0.8, y + 0.3]); } } });
      // feed pipes out to the slab edges
      parts.push({ z0: 4, z1: 8, side: p.d, top: C.mix(p.a, p.d, 0.4), shape: (c) => { S.rrect(c, -23, -2.2, 12, 4.4, 2); S.rrect(c, 11, -2.2, 12, 4.4, 2); },
        detail: (c) => S.lines(c, SEAM2, 0.5, [-19, -2.2, -19, 2.2, -15, -2.2, -15, 2.2, 15, -2.2, 15, 2.2, 19, -2.2, 19, 2.2]) });
      // twin smoke stacks at the back
      parts.push({ z0: 4, z1: 40, side: C.shade(p.a, -0.15), top: '#1a1412', shape: (c, zt) => S.circ(c, -15, -12, 3.8 - zt * 0.7), detail: (c) => glow(c, molten, -15, -12, 2.4, 0.85) });
      parts.push({ z0: 4, z1: 29, side: C.shade(p.a, -0.15), top: '#1a1412', shape: (c, zt) => S.circ(c, 17, -7, 3 - zt * 0.5), detail: (c) => glow(c, molten, 17, -7, 2, 0.85) });
      parts.push({ z0: 31, z1: 33, side: p.d, top: C.shade(p.d, 0.25), shape: (c) => S.circ(c, -15, -12, 4) });
      parts.push({ z0: 4, z1: 9, side: p.d, top: C.mix(p.a, p.d, 0.4), shape: (c) => S.rrect(c, -18, -15, 6, 3, 1) });
      return { r: 30, h: 40, parts, style: 'unit' };
    }
    // ---- Lumen Well ----
    const g = p.g, light = C.mix(p.g, '#ffffff', 0.55);
    parts.push({ z0: 0, z1: 1, side: p.d, top: C.shade(p.d, 0.12), bevel: false, shape: (c) => S.circ(c, 0, 0, 23),
      detail: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.6; S.lines(c, ca(g, 0.85), 1.2, [Math.cos(a) * 18, Math.sin(a) * 18, Math.cos(a) * 23, Math.sin(a) * 23]); } } });
    // glowing pool deep in the pit
    parts.push({ z0: 0, z1: 1, side: g, top: light, flat: true, shape: (c) => S.circ(c, 0, 0, 12),
      detail: (c) => { glow(c, '#ffffff', 0, 0, 9); ring(c, ca(C.shade(g, -0.3), 0.6), 0, 0, 10, 1); } });
    // carved rim with an open centre
    parts.push({ z0: 0, z1: 5, side: p.a, top: p.b, shape: (c, zt) => annulus(c, 0, 0, 19 - zt * 1.5, 11.5 + zt * 0.5),
      detail: (c) => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.lines(c, SEAM, 0.5, [Math.cos(a) * 12.5, Math.sin(a) * 12.5, Math.cos(a) * 17, Math.sin(a) * 17]); } ring(c, ca(g, 0.9), 0, 0, 14.7, 0.7); } });
    // crystalline crown leaning out of the rim
    const cr = []; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.2; cr.push([a, 0.22, i % 2 ? 1.9 : 2.5, i % 2 ? 9 : 14, 14.8]); }
    crystalCluster(parts, 3, cr, C.mix(g, p.d, 0.4), C.mix(g, '#ffffff', 0.35), C.mix(g, '#ffffff', 0.6));
    // light shaft rising from the pool
    parts.push({ z0: 1, z1: 30, side: light, top: C.mix(g, '#ffffff', 0.8), flat: true, ao: -0.35, shape: (c, zt) => S.circ(c, 0, 0, 3.4 - zt * 1.6) });
    parts.push({ z0: 18, z1: 18, side: g, top: C.shade(g, 0.4), flat: true, stroke: 0.8, shape: (c) => S.ell(c, 0, 0, 5.5, 2.4) });
    parts.push({ z0: 25, z1: 25, side: g, top: C.shade(g, 0.4), flat: true, stroke: 0.7, shape: (c) => S.ell(c, 0, 0, 3.8, 1.7) });
    return { r: 26, h: 32, parts, style: 'unit' };
  };

  /* ======================================================================
   * HALLS
   * saFoundry  (factory)   stepped Choir smelting hall, glowing open bay door, three stacks, slag conveyor
   * saBarracks (barracks)  ribbed barrel-vault spawning hall with a glowing arched doorway
   * ====================================================================== */
  M.saFoundry = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const molten = C.str(C.mix(p.g, '#ff7a1a', 0.55)), hot = '#ffd27a';
    const k = o.scale || 1;
    parts.push({ z0: 0, z1: 3, side: p.d, top: C.shade(p.d, 0.16), shape: (c) => S.rrect(c, -44, -30, 88, 60, 4),
      detail: (c) => {
        // apron with hazard edge + glowing slag runnel toward the bay
        for (let i = 0; i < 9; i++) S.fillPoly(c, i % 2 ? '#1a1612' : cs(p.t, 0.2), [-14 + i * 3.2, 28.6, -12.4 + i * 3.2, 28.6, -14 + i * 3.2 + 1.6, 26.8, -14 + i * 3.2, 26.8]);
        c.save(); const sg = c.createLinearGradient(0, 23, 0, 30); sg.addColorStop(0, C.str(C.mix(p.g, '#ff7a1a', 0.55), 0.85)); sg.addColorStop(1, C.str(C.mix(p.g, '#ff7a1a', 0.55), 0)); c.fillStyle = sg; c.beginPath(); c.moveTo(-13, 23); c.lineTo(13, 23); c.lineTo(17, 30); c.lineTo(-17, 30); c.fill(); c.restore();
        S.lines(c, SEAM2, 0.6, [-44, 22, -16, 22, 16, 22, 44, 22]);
      } });
    // lower hall
    parts.push({ z0: 3, z1: 17, side: p.a, top: p.b, shape: (c) => S.rrect(c, -40, -26, 80, 49, 2),
      detail: (c) => { S.lines(c, SEAM, 0.55, [-40, 10, 40, 10, 20, 10, 20, 23, -26, -26, -26, 23]); for (let x = 24; x < 38; x += 3.2) S.lines(c, SEAM2, 0.7, [x, 13, x, 20]); glow(c, p.g, 33, 6, 1.4); glow(c, p.g, -34, 16, 1.4); } });
    // wall ribs on the lower hall front
    parts.push({ z0: 3, z1: 16, side: C.shade(p.a, -0.3), top: p.a, shape: (c) => { for (const x of [-38, -26, -16, 16, 26, 38]) S.rect(c, x - 1.2, 22, 2.4, 1.8); } });
    // bay door frame + molten-lit open bay
    parts.push({ z0: 3, z1: 16.5, side: p.d, top: p.d, shape: (c) => S.rect(c, -16, 22.4, 32, 1.2) });
    parts.push({ z0: 3, z1: 15, side: C.mix(molten, hot, 0.25), top: hot, flat: true, ao: -0.45, shape: (c, zt) => { const w = 13.5 - Math.max(0, zt - 0.75) * 14; S.rect(c, -w, 23, w * 2, 0.9); } });
    parts.push({ z0: 3, z1: 15, side: '#2a1a12', top: '#2a1a12', flat: true, shape: (c, zt) => { if (zt > 0.15 && zt < 0.85) { S.rect(c, -6.5, 23.5, 1.4, 0.6); S.rect(c, 5.1, 23.5, 1.4, 0.6); } } });
    // stepped upper tiers (ziggurat toward the back)
    parts.push({ z0: 17, z1: 27, side: p.a, top: p.b, shape: (c) => S.rrect(c, -34, -25, 58, 30, 2),
      detail: (c) => { S.lines(c, SEAM, 0.5, [-34, -8, 24, -8, -6, -25, -6, 5]); for (let i = 0; i < 5; i++) S.fillPoly(c, molten, [-30 + i * 6, 2, -26 + i * 6, 2, -26 + i * 6, 3.4, -30 + i * 6, 3.4]); } });
    parts.push({ z0: 17, z1: 25, side: C.mix(molten, hot, 0.2), top: hot, flat: true, shape: (c) => { for (let i = 0; i < 5; i++) S.rect(c, -30 + i * 11, 4.6, 5, 0.8); } });
    parts.push({ z0: 27, z1: 35, side: p.a, top: p.b, shape: (c) => S.rrect(c, -28, -24, 30, 18, 2),
      detail: (c) => { S.lines(c, SEAM, 0.5, [-13, -24, -13, -6]); glow(c, p.g, -20, -15, 1.6); glow(c, p.g, -6, -15, 1.6); } });
    // smelting stacks
    parts.push({ z0: 17, z1: 60, side: C.mix(p.a, p.d, 0.55), top: '#1a1412', shape: (c, zt) => { S.circ(c, 14, -16, 4.6 - zt * 0.9); } , detail: (c) => glow(c, molten, 14, -16, 2.8, 0.9) });
    parts.push({ z0: 35, z1: 64, side: C.mix(p.a, p.d, 0.55), top: '#1a1412', shape: (c, zt) => { S.circ(c, -22, -17, 4.2 - zt * 0.8); S.circ(c, -6, -17, 3.6 - zt * 0.7); }, detail: (c) => { glow(c, molten, -22, -17, 2.6, 0.9); glow(c, molten, -6, -17, 2.2, 0.9); } });
    parts.push({ z0: 46, z1: 48, side: p.d, top: C.shade(p.d, 0.25), shape: (c) => { S.circ(c, 14, -16, 4.6); S.circ(c, -22, -17, 4.4); } });
    // slag conveyor out to the right
    parts.push({ z0: 1, z1: 5, side: p.d, top: C.shade(p.d, 0.3), shape: (c) => S.rect(c, 40, 6, 13, 9),
      detail: (c) => { for (let x = 41.5; x < 52; x += 4) { S.fillPoly(c, molten, [x, 8, x + 2.6, 8, x + 2.6, 13, x, 13]); } S.lines(c, SEAM2, 0.5, [40, 10.5, 53, 10.5]); } });
    return { r: 54, h: 66, parts, style: 'unit', scale: k };
  };

  M.saBarracks = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const VW = 14, VH = 17, Y0 = -19, Y1 = 15;
    const vw = (zt) => VW * Math.sqrt(Math.max(0, 1 - zt * zt)) + 0.3;
    parts.push({ z0: 0, z1: 2.5, side: p.d, top: C.shade(p.d, 0.16), shape: (c) => S.rrect(c, -27, -23, 54, 46, 4),
      detail: (c) => { ring(c, ca(p.g, 0.7), 0, 19, 6, 0.8, 0, Math.PI); S.lines(c, ca(p.g, 0.75), 0.8, [-4, 22.5, -4, 17, 4, 22.5, 4, 17]); for (const sx of [-1, 1]) S.lines(c, SEAM2, 0.5, [sx * 22, -20, sx * 22, 20]); } });
    // flanking spawn pods
    parts.push({ z0: 1, z1: 9, side: p.a, top: p.b, shape: (c, zt) => { const r = 5.2 * Math.sqrt(1 - zt * zt * 0.7); for (const x of [-20, 20]) for (const y of [-12, 6]) S.circ(c, x, y, r); },
      detail: (c) => { for (const x of [-20, 20]) for (const y of [-12, 6]) glow(c, p.g, x, y, 1.6); } });
    // the vault
    parts.push({ z0: 2, z1: 2 + VH, side: p.a, top: p.b, shape: (c, zt) => { const w = vw(zt); S.rect(c, -w, Y0, w * 2, Y1 - Y0); } });
    // arch ribs across the vault
    parts.push({ z0: 2, z1: 3 + VH, side: C.mix(p.a, p.d, 0.45), top: C.mix(p.b, p.a, 0.4), shape: (c, zt) => { const w = VW * 1.08 * Math.sqrt(Math.max(0, 1 - zt * zt)) + 0.5; for (const y of [-17, -10, -3, 4, 11]) S.rect(c, -w, y - 0.9, w * 2, 1.8); } });
    // ridge light
    parts.push({ z0: 2 + VH, z1: 3 + VH, side: p.g, top: C.shade(p.g, 0.4), flat: true, shape: (c) => S.rect(c, -0.7, Y0 + 1, 1.4, Y1 - Y0 - 2) });
    // gable rib around the doorway
    parts.push({ z0: 2, z1: 2 + VH, side: p.d, top: C.mix(p.b, p.a, 0.4), shape: (c, zt) => { const w = vw(zt); S.rect(c, -w - 0.6, Y1 - 0.6, w * 2 + 1.2, 1.6); } });
    // glowing arched doorway
    parts.push({ z0: 2, z1: 13, side: C.shade(p.g, 0.1), top: C.shade(p.g, 0.6), flat: true, ao: -0.45, shape: (c, zt) => { const w = 6.4 * Math.sqrt(Math.max(0, 1 - zt * zt)) + 0.2; S.rect(c, -w, Y1 + 0.6, w * 2, 0.8); } });
    return { r: 30, h: VH + 6, parts, style: 'unit' };
  };

  /* ======================================================================
   * ORGANIC
   * saHive   style hive (termite tower, glowing entrances) | burrow (crater nest) | root (spore root knot)
   * saFungus style spore (towering fungal stalk) | specimen (glass lantern plant) | resin (amber pheromone column)
   * saPods   style eggs (pulsing pustule cluster, anims 2) | cocoon (silk-wrapped people)
   * ====================================================================== */
  M.saHive = function (p, o) {
    p = P(p); o = o || {};
    const st = o.style || 'hive', seed = o.seed || 3;
    const parts = [];
    if (st === 'hive') {
      const H = o.h || 48;
      // resin creep spreading out
      parts.push({ z0: 0, z1: 1.5, side: p.d, top: C.mix(p.t, p.d, 0.25), bevel: false, shape: (c) => S.blob(c, 0, 2, 27, seed, 14, 0.38),
        detail: (c) => { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + seed; S.lines(c, ca(p.g, 0.5), 0.7, [Math.cos(a) * 15, Math.sin(a) * 15, Math.cos(a + 0.15) * 25, Math.sin(a + 0.15) * 25]); } } });
      // spires: [x, y, r, h]
      const sp = [[0, -2, 11, H], [-10, 6, 7, H * 0.58], [10, 5, 7.5, H * 0.68], [3, 11, 5.5, H * 0.36], [-12, -8, 5, H * 0.42]];
      const rad = (q, z) => { const t = z / q[3]; return q[2] * (1 - t * 0.55) * (t > 0.82 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.18)) : 1); };
      parts.push({ z0: 0, z1: H, side: p.a, top: p.b, ao: 0.45, shape: (c, zt) => { const z = zt * H; for (const q of sp) if (z <= q[3]) S.blob(c, q[0] + Math.sin(z * 0.25 + q[0]) * 0.6, q[1], rad(q, z), seed + q[0], 8, 0.16); },
        detail: (c) => { S.dot(c, '#1a0c10', 0.5, -2, 1.4); glow(c, p.g, 0.5, -2, 1.2); } });
      // honeycomb entrances on the front faces (dark mouth + glow)
      const holes = []; sp.forEach((q, i) => { for (let j = 0; j < 4; j++) { const z = q[3] * (0.18 + j * 0.2); if (z > q[3] * 0.8) continue; const r = rad(q, z); const x = (U.hash2(i, j, seed) - 0.5) * r * 0.9; holes.push([q[0] + x, q[1] + Math.sqrt(Math.max(0, r * r - x * x)), z, 1.3 + (i === 0 ? 0.6 : 0)]); } });
      parts.push({ z0: 0, z1: H, side: '#1a0a14', top: '#1a0a14', flat: true, shape: (c, zt) => { const z = zt * H; for (const h of holes) if (Math.abs(z - h[2]) < h[3]) { const w = h[3] * Math.sqrt(1 - Math.pow((z - h[2]) / h[3], 2)); S.ell(c, h[0], h[1] - 0.4, w + 0.3, 0.9); } } });
      parts.push({ z0: 0, z1: H, side: p.g, top: C.shade(p.g, 0.5), flat: true, ao: -0.2, shape: (c, zt) => { const z = zt * H; for (const h of holes) if (Math.abs(z - h[2]) < h[3] * 0.6) { const w = h[3] * 0.6 * Math.sqrt(1 - Math.pow((z - h[2]) / (h[3] * 0.6), 2)); S.ell(c, h[0], h[1] - 0.2, w, 0.8); } } });
      return { r: 30, h: H + 2, parts, style: 'unit' };
    }
    if (st === 'burrow') {
      const R = o.r || 20;
      parts.push({ z0: 0, z1: 1.2, side: p.d, top: C.shade(p.d, 0.12), bevel: false, shape: (c) => S.blob(c, 0, 0, R + 6, seed, 12, 0.35) });
      // mound ring with the burrow throat
      parts.push({ z0: 0, z1: R * 0.42, side: p.a, top: p.b, shape: (c, zt) => { c.moveTo(0, 0); S.blob(c, 0, 0, R * (1 - zt * 0.3), seed, 11, 0.22); c.moveTo(R * 0.45, 0); c.ellipse(0, 0, R * (0.3 + zt * 0.22), R * (0.26 + zt * 0.2), 0, TAU, 0, true); },
        detail: (c) => { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; S.lines(c, SEAM, 0.6, [Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.5, Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.66]); } } });
      parts.push({ z0: 0, z1: 0.5, side: '#0c0a10', top: '#120e18', shape: (c) => S.ell(c, 0, 0, R * 0.42, R * 0.36), detail: (c) => { glow(c, p.g, -2, 1, R * 0.16); glow(c, p.g, 3, -2, R * 0.12); glow(c, p.g, 1, 4, R * 0.1); } });
      // chitin spikes leaning out of the rim
      parts.push({ z0: 2, z1: R * 0.85, side: C.shade(p.t, -0.45), top: p.t, ao: 0.3, shape: (c, zt) => { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.4; const d = R * (0.7 + zt * 0.32); S.circ(c, Math.cos(a) * d, Math.sin(a) * d * 0.95, 2.2 * (1 - zt) + 0.2); } } });
      return { r: R + 8, h: R * 0.85 + 3, parts, style: 'unit' };
    }
    // root: gnarled spore-root knot
    const R = o.r || 18;
    parts.push({ z0: 0, z1: 1.2, side: p.d, top: C.mix(p.d, p.a, 0.35), bevel: false, shape: (c) => S.blob(c, 0, 0, R + 7, seed, 12, 0.4),
      detail: (c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; S.lines(c, ca(p.g, 0.55), 0.6, [Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, Math.cos(a + 0.2) * (R + 6), Math.sin(a + 0.2) * (R + 6)]); } } });
    // buttress roots radiating out (low at the tips)
    parts.push({ z0: 0, z1: 7, side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; blade(c, a, 3, R + 4 - zt * (R - 2), 3.4 - zt, 1.4, 1.5); } } });
    // central knot
    parts.push({ z0: 0, z1: 14, side: p.a, top: p.b, shape: (c, zt) => S.blob(c, 0, 0, 8.5 * Math.cos(zt * 1.05), seed + 3, 9, 0.24), detail: (c) => glow(c, p.g, 0, 0, 2.6) });
    // twisted tendrils with glowing pods
    const tn = [[0.4, 26], [2.5, 21], [4.4, 17]];
    parts.push({ z0: 8, z1: 28, side: p.a, top: p.b, shape: (c, zt) => { const z = 8 + zt * 20; for (const t of tn) if (z <= t[1]) { const u = (z - 8) / (t[1] - 8); const d = 3 + u * 5; S.circ(c, Math.cos(t[0] + u * 1.4) * d, Math.sin(t[0] + u * 1.4) * d, 2.2 * (1 - u * 0.6)); } } });
    parts.push({ z0: 14, z1: 30, side: C.shade(p.g, -0.15), top: C.shade(p.g, 0.5), flat: true, shape: (c, zt) => { const z = 14 + zt * 16; for (const t of tn) { const d = 3 + 5, a = t[0] + 1.4; const cz = t[1] + 1; if (Math.abs(z - cz) < 2.4) S.circ(c, Math.cos(a) * d, Math.sin(a) * d, 2.4 * Math.sqrt(1 - Math.pow((z - cz) / 2.4, 2)) + 0.2); } } });
    return { r: R + 9, h: 32, parts, style: 'unit' };
  };

  // sphere-ish blobs built from slices: list of [x, y, zc, r] -> circle cross-sections
  function spheres(list, squash) {
    return (c, z) => { for (const q of list) { const dz = (z - q[2]) / (squash || 1); if (Math.abs(dz) < q[3]) S.circ(c, q[0], q[1], Math.sqrt(q[3] * q[3] - dz * dz) + 0.1); } };
  }

  M.saFungus = function (p, o) {
    p = P(p); o = o || {};
    const st = o.style || 'spore';
    const parts = [];
    if (st === 'spore') {
      const H = o.h || 66;
      const sway = (z) => [Math.sin(z * 0.07) * 2.2, Math.cos(z * 0.05) * 1.2];
      parts.push({ z0: 0, z1: 1.2, side: p.d, top: C.mix(p.d, p.a, 0.4), bevel: false, shape: (c) => S.blob(c, 0, 1, 21, 7, 13, 0.4),
        detail: (c) => { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3; S.lines(c, ca(p.g, 0.6), 0.7, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a + 0.25) * 20, Math.sin(a + 0.25) * 20]); } } });
      // root flare + tendrils
      parts.push({ z0: 0, z1: 8, side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => { for (let i = 0; i < 5; i++) blade(c, i / 5 * TAU + 0.4, 4, 15 - zt * 8, 3, 1.4, 1.2); } });
      // the stalk
      parts.push({ z0: 4, z1: H - 6, side: p.a, top: p.b, shape: (c, zt) => { const z = 4 + zt * (H - 10); const q = sway(z); S.circ(c, q[0], q[1], 8 - zt * 3 + Math.sin(z * 0.6) * 0.35); } });
      // growth rings
      parts.push({ z0: 12, z1: H - 10, side: C.shade(p.t, -0.2), top: p.t, shape: (c, zt) => { const z = 12 + zt * (H - 22); if (Math.floor(z) % 11 === 0) { const q = sway(z); S.circ(c, q[0], q[1], 6.6 - zt * 2); } } });
      // glowing pod clusters on the stalk
      const pods = [];
      [[0.3, 0.9], [0.48, -0.6], [0.62, 2.2], [0.78, 0.2]].forEach((d, i) => { const z = H * d[0]; const q = sway(z); const r = 5.6 - (z - 4) / (H - 10) * 2; for (let j = 0; j < 3; j++) { const a = d[1] + (j - 1) * 0.55; pods.push([q[0] + Math.cos(a) * (r + 1.2), q[1] + Math.sin(a) * (r + 1.2), z + (j % 2) * 2.2, 1.9 - j * 0.25]); } });
      parts.push({ z0: 10, z1: H - 4, side: C.shade(p.g, -0.25), top: C.shade(p.g, 0.45), flat: true, shape: (c, zt) => spheres(pods)(c, 10 + zt * (H - 14)), detail: () => {} });
      // bracket-fungus shelves jutting from alternating sides: [z, angle, reach]
      const sh = [[H * 0.32, 0.4, 14], [H * 0.5, 2.8, 12.5], [H * 0.68, 0.8, 10.5]];
      for (const [z, a, reach] of sh) {
        const q = sway(z), zi = Math.round(z);
        parts.push({ z0: zi, z1: zi + 3, side: C.mix(p.a, p.t, 0.3), top: C.mix(p.b, p.t, 0.45), shape: (c, zt) => { const r = reach * (1 - zt * 0.35); c.moveTo(q[0], q[1]); c.ellipse(q[0] + Math.cos(a) * 2.5, q[1] + Math.sin(a) * 2.5, r, r * 0.62, a, -Math.PI / 2, Math.PI / 2); c.closePath(); },
          detail: (c) => { for (let k = 0; k < 3; k++) S.lines(c, ca(C.shade(p.a, -0.3), 0.6), 0.4, [q[0] + Math.cos(a) * 3, q[1] + Math.sin(a) * 3, q[0] + Math.cos(a + (k - 1) * 0.6) * reach * 0.85, q[1] + Math.sin(a + (k - 1) * 0.6) * reach * 0.85]); } });
        parts.push({ z0: zi - 1, z1: zi, side: p.g, top: C.shade(p.g, 0.4), flat: true, stroke: 0.9, shape: (c) => c.ellipse(q[0] + Math.cos(a) * 2.5, q[1] + Math.sin(a) * 2.5, reach * 0.95, reach * 0.6, a, Math.max(-Math.PI / 2, -a + 0.05), Math.min(Math.PI / 2, Math.PI - a - 0.05)) });
      }
      // crown of bulbous spore pods at the top
      const cz = H - 6, cq = sway(cz);
      const crown = [[0, 0, cz + 6, 6], [-6, 3, cz + 3, 4.4], [5.6, 2.6, cz + 3.5, 4.2], [1.2, -5.6, cz + 3.5, 4.4], [-4.6, -4, cz + 2, 3.4], [4.8, -4.4, cz + 1.5, 3.2]].map((q) => [q[0] + cq[0], q[1] + cq[1], q[2], q[3]]);
      parts.push({ z0: cz - 3, z1: cz + 13, side: C.mix(p.a, p.t, 0.35), top: C.mix(p.b, p.t, 0.5), shape: (c, zt) => spheres(crown, 1.15)(c, cz - 3 + zt * 16), detail: (c) => glow(c, p.g, cq[0] - 0.5, cq[1] - 0.5, 2.6) });
      parts.push({ z0: cz - 1, z1: cz + 6, side: p.g, top: C.shade(p.g, 0.5), flat: true, shape: (c, zt) => { const z = cz - 1 + zt * 7; for (const q of crown) { const dz = (z - q[2]) / 1.15; if (Math.abs(dz) < q[3] * 0.75) { const r = Math.sqrt(q[3] * q[3] - dz * dz); S.circ(c, q[0] - r * 0.15, q[1] + r * 0.82, r * 0.2); } } } });
      return { r: 26, h: H + 12, parts, style: 'unit' };
    }
    if (st === 'specimen') {
      const H = o.h || 24;
      parts.push({ z0: 0, z1: 1, side: p.d, top: C.mix(p.d, p.a, 0.4), bevel: false, shape: (c) => S.blob(c, 0, 0, 12, 13, 10, 0.3) });
      // broad leaves, curling up at the tips
      parts.push({ z0: 0.5, z1: 6, side: p.a, top: p.b, ao: 0.4, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.9; blade(c, a, 2 + zt * zt * 8, 13 - zt * 1.5, 1.8 + zt, 3.2 - zt * 1.5, 2); } },
        detail: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.9; S.lines(c, ca(p.t, 0.8), 0.5, [Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a) * 14, Math.sin(a) * 14]); } } });
      parts.push({ z0: 0.6, z1: 0.6, side: p.g, top: p.g, flat: true, shape: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.9; S.circ(c, Math.cos(a) * 6, Math.sin(a) * 6, 0.7); } } });
      // arching stems carrying hanging lanterns: [baseAngle, height, lean]
      const st3 = [[-0.6, H, 6], [2.2, H * 0.72, 5], [4, H * 0.55, 4]];
      const stemAt = (t, z) => { const u = z / t[1]; const d = Math.sin(u * 1.4) * t[2]; return [Math.cos(t[0]) * d, Math.sin(t[0]) * d]; };
      parts.push({ z0: 0, z1: H, side: p.a, top: p.b, shape: (c, zt) => { const z = zt * H; for (const t of st3) if (z <= t[1]) { const q = stemAt(t, z); S.circ(c, q[0], q[1], 1.3 - z / t[1] * 0.5); } } });
      const lanterns = st3.map((t) => { const q = stemAt(t, t[1]); const d = Math.hypot(q[0], q[1]) + 1.5; return [Math.cos(t[0]) * d, Math.sin(t[0]) * d, t[1] - 3.5, t === st3[0] ? 3.6 : 2.6]; });
      parts.push({ z0: 4, z1: H, side: C.shade(p.g, -0.2), top: C.shade(p.g, 0.55), flat: true, shape: (c, zt) => spheres(lanterns, 1.3)(c, 4 + zt * (H - 4)) });
      parts.push({ z0: H - 2, z1: H - 1, side: '#ffffff', top: '#ffffff', flat: true, shape: (c) => { const l = lanterns[0]; S.circ(c, l[0] - 1, l[1] + 0.6, 0.8); } });
      return { r: 18, h: H + 3, parts, style: 'unit' };
    }
    // resin: amber pheromone column
    const H = o.h || 30;
    parts.push({ z0: 0, z1: 1.2, side: p.d, top: C.mix(p.d, p.a, 0.45), bevel: false, shape: (c) => S.blob(c, 0, 0, 19, 21, 12, 0.35),
      detail: (c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.2; S.lines(c, ca(p.g, 0.45), 0.8, [Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a) * 18, Math.sin(a) * 18]); } } });
    // drips / satellite resin knobs around the base
    parts.push({ z0: 0, z1: 9, side: p.a, top: p.b, shape: (c, zt) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; const d = 10 + (i % 2) * 2; if (zt * 9 < 4 + (i % 3) * 2.5) S.circ(c, Math.cos(a) * d, Math.sin(a) * d, (2.6 - zt * 1.5) + (i % 2) * 0.6); } } });
    // the column (lumpy, swaying)
    parts.push({ z0: 0, z1: H, side: p.a, top: p.b, ao: 0.35, shape: (c, zt) => { const z = zt * H; S.blob(c, Math.sin(z * 0.15) * 1.2, 0, 7 - zt * 2.6 + Math.sin(z * 0.45) * 0.9, 9, 9, 0.14); },
      detail: (c) => { glow(c, p.g, 0, 0, 4); } });
    // inner glow veins showing through the resin (front face)
    parts.push({ z0: 3, z1: H - 3, side: C.mix(p.b, p.g, 0.5), top: p.g, flat: true, shape: (c, zt) => { const z = 3 + zt * (H - 6); const r = 7 - (z / H) * 2.6 + Math.sin(z * 0.45) * 0.9 - 1.3; const x0 = Math.sin(z * 0.15) * 1.2; for (const k of [-0.5, 0.25]) { const x = x0 + Math.sin(z * 0.2 + k * 6) * r * 0.5; S.poly(c, [x - 0.5, r - 0.2, x + 0.5, r - 0.2, x + 0.5, r + 1.2, x - 0.5, r + 1.2]); } } });
    // embedded glowing nodules
    const nod = [[2, 5.2, H * 0.3, 1.8], [-2.4, 4.6, H * 0.55, 1.5], [1, 3.8, H * 0.78, 1.3]];
    parts.push({ z0: 2, z1: H, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.6), flat: true, shape: (c, zt) => spheres(nod)(c, 2 + zt * (H - 2)) });
    // crown bulb + haze ring
    parts.push({ z0: H - 1, z1: H + 6, side: C.mix(p.b, p.g, 0.5), top: C.shade(p.g, 0.5), flat: true, shape: (c, zt) => S.circ(c, Math.sin(H * 0.15) * 1.2, 0, 4 * Math.sin(Math.max(0.15, zt) * Math.PI)) });
    parts.push({ z0: H + 2, z1: H + 2, side: p.g, top: C.shade(p.g, 0.3), flat: true, stroke: 0.8, shape: (c, zt, an) => S.ell(c, Math.sin(H * 0.15) * 1.2, 0, an >= 0.5 ? 8.5 : 7, an >= 0.5 ? 3.6 : 3) });
    return { r: 22, h: H + 8, parts, style: 'unit' };
  };

  M.saPods = function (p, o) {
    p = P(p); o = o || {};
    const st = o.style || 'eggs', seed = o.seed || 1;
    const parts = [];
    if (st === 'eggs') {
      // vine mat with radiating veins
      parts.push({ z0: 0, z1: 1.4, side: p.d, top: C.mix(p.d, p.a, 0.18), bevel: false, shape: (c) => S.blob(c, 0, 0, 21, seed + 4, 12, 0.36),
        detail: (c) => { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + seed; const r0 = 8, r1 = 19 + U.hash2(i, seed, 5) * 5; S.lines(c, cs(p.a, 0.1), 1, [Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a + 0.18) * r1, Math.sin(a + 0.18) * r1]); S.dot(c, cs(p.g, 0.2), Math.cos(a + 0.18) * r1, Math.sin(a + 0.18) * r1, 0.8); } } });
      // pustules / eggs, each its own part so every egg gets its own light + bevel: [x, y, r, h]
      const eg = [[-1, -3, 6, 12], [-9.5, 3, 4.6, 9], [8, 3.5, 5, 10], [-2, 9, 3.8, 7.5], [10, -8, 3.4, 7], [-11, -8, 3.2, 6.5], [3, -12, 2.8, 5.5]];
      eg.sort((u, v) => u[1] - v[1]);
      for (const q of eg) {
        const er = (t, an) => q[2] * (an >= 0.5 ? 1.07 : 1) * Math.sqrt(Math.max(0.16, 1 - Math.pow(t * 1.8 - 0.62, 2) / 1.4));
        parts.push({ z0: 0.5, z1: q[3], side: C.mix(p.a, p.b, 0.45), top: p.b, ao: 0.6, shape: (c, zt, an) => S.circ(c, q[0], q[1], er(zt, an)),
          detail: (c, an) => { glow(c, p.g, q[0], q[1], q[2] * (an >= 0.5 ? 0.62 : 0.5)); } });
        parts.push({ z0: 1 + q[3] * 0.2, z1: q[3] * 0.62, side: C.mix(p.t, p.g, 0.35), top: C.shade(p.g, 0.5), flat: true, ao: -0.3, shape: (c, zt, an) => { const t = 0.2 + zt * 0.42; const r = er(t, an); S.ell(c, q[0] - r * 0.1, q[1] + r * 0.8, r * (an >= 0.5 ? 0.42 : 0.34), r * 0.2); } });
      }
      return { r: 25, h: 15, parts, style: 'unit' };
    }
    // cocoon: silk-wrapped captives hung in web
    const n = o.n || 3;
    const co = [[-8, -3, 0.14, 15], [2, 3, -0.1, 16], [11, -4, 0.2, 13], [-2, -10, 0, 12]].slice(0, Math.max(1, Math.min(4, n)));
    parts.push({ z0: 0, z1: 1, side: p.d, top: C.mix(p.d, p.a, 0.12), bevel: false, shape: (c) => S.blob(c, 0, -1, 19, seed + 2, 11, 0.3),
      detail: (c) => { S.lines(c, ca(p.b, 0.55), 0.4, [-16, -6, 14, 4, -12, 8, 12, -9, -2, -16, 2, 14, -16, 2, 16, -2]); ring(c, ca(p.b, 0.45), 0, -1, 9, 0.4); ring(c, ca(p.b, 0.4), 0, -1, 14, 0.4); } });
    // web posts (bent thorn stakes) the cocoons hang from
    parts.push({ z0: 0, z1: 20, side: p.d, top: p.t, shape: (c, zt) => { S.circ(c, -14 + zt * 2, -8, 1.3 - zt * 0.6); S.circ(c, 16 - zt * 2, 2, 1.3 - zt * 0.6); } });
    const cocR = (zt) => 4.6 * Math.sin(Math.max(0.12, Math.min(1, zt * 1.05)) * Math.PI) * (zt < 0.5 ? 0.85 + zt * 0.3 : 1);
    parts.push({ z0: 0.5, z1: 17, side: p.a, top: p.b, ao: 0.3, shape: (c, zt) => { const z = 0.5 + zt * 16.5; for (const q of co) { const t = z / q[3]; if (t <= 1) S.ell(c, q[0] + q[2] * z, q[1], cocR(t), cocR(t) * 0.9); } } });
    // silk wrap bands spiralling round the front faces
    parts.push({ z0: 1, z1: 16, side: C.shade(p.a, -0.25), top: p.a, flat: true, shape: (c, zt) => { const z = 1 + zt * 15; for (const q of co) { const t = z / q[3]; if (t > 0.08 && t < 0.92) { const r = cocR(t) * 0.9; const x = q[0] + q[2] * z + Math.sin(z * 0.9 + q[0]) * r * 0.7; S.ell(c, x, q[1] + Math.sqrt(Math.max(0, r * r - Math.pow(x - q[0] - q[2] * z, 2))) * 0.9, 0.5, 0.45); } } } });
    // faint face / silhouette shadow near the top of each cocoon
    parts.push({ z0: 1, z1: 16, side: C.mix(p.a, p.d, 0.55), top: p.d, flat: true, shape: (c, zt) => { const z = 1 + zt * 15; for (const q of co) { const t = z / q[3]; if (t > 0.66 && t < 0.82) S.ell(c, q[0] + q[2] * z, q[1] + cocR(t) * 0.68, 1.1, 0.5); } } });
    // web strands between the cocoon tops and the posts
    parts.push({ z0: 15, z1: 15, side: p.b, top: C.shade(p.b, 0.3), flat: true, stroke: 0.35, shape: (c) => { S.seg(c, -12, -8, co[0][0], co[0][1]); for (let i = 1; i < co.length; i++) S.seg(c, co[i - 1][0], co[i - 1][1], co[i][0], co[i][1]); S.seg(c, co[co.length - 1][0], co[co.length - 1][1], 14, 2); } });
    parts.push({ z0: 1, z1: 3, side: C.shade(p.g, -0.2), top: p.g, flat: true, shape: (c) => { S.circ(c, -10, 6, 0.8); S.circ(c, 8, 7, 0.7); } });
    return { r: 22, h: 22, parts, style: 'unit' };
  };

  /* ======================================================================
   * NODES + CORE
   * saEmitter  style coupling (power coupling: conduits into a clamped capacitor) | sonar (ring emitter)
   * saLanceCore (weaponcore, anims 4)  four great claws around a pulsing core and the lance needle
   * ====================================================================== */
  M.saEmitter = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    if (o.style === 'sonar') {
      const H = o.h || 8;
      parts.push({ z0: 0, z1: 0.5, side: p.g, top: C.shade(p.g, 0.2), flat: true, stroke: 0.8, shape: (c) => S.circ(c, 0, 0, 17) });
      parts.push({ z0: 0, z1: 4, side: p.d, top: C.shade(p.d, 0.25), shape: (c, zt) => annulus(c, 0, 0, 14 - zt, 8 + zt * 0.5),
        detail: (c) => { ring(c, ca(p.g, 0.9), 0, 0, 11, 1.1); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.lines(c, SEAM2, 0.5, [Math.cos(a) * 8.6, Math.sin(a) * 8.6, Math.cos(a) * 9.8, Math.sin(a) * 9.8]); } } });
      parts.push({ z0: 2, z1: 6, side: p.a, top: p.b, shape: (c, zt) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + TAU / 12; S.circ(c, Math.cos(a) * 11, Math.sin(a) * 11, 2.2 - zt * 0.8); } },
        detail: (c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + TAU / 12; glow(c, p.g, Math.cos(a) * 11, Math.sin(a) * 11, 1.3); } } });
      parts.push({ z0: 0, z1: H, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, ngon(0, 0, 4.6 - zt * 3, 6, 0)) });
      parts.push({ z0: H, z1: H + 3, side: C.shade(p.g, -0.1), top: C.shade(p.g, 0.6), flat: true, shape: (c, zt) => S.circ(c, 0, 0, 1.8 * Math.sin(Math.max(0.2, zt) * Math.PI)) });
      return { r: 19, h: H + 4, parts, style: 'unit' };
    }
    // coupling
    const H = o.h || 20;
    parts.push({ z0: 0, z1: 2, side: p.d, top: C.shade(p.d, 0.18), shape: (c) => S.poly(c, ngon(0, 0, 11, 8, TAU / 16)),
      detail: (c) => { for (let i = 0; i < 8; i++) S.fillPoly(c, i % 2 ? '#1a1612' : '#e8a02a', [Math.cos(i / 8 * TAU) * 9.5, Math.sin(i / 8 * TAU) * 9.5, Math.cos((i + 0.5) / 8 * TAU) * 10.6, Math.sin((i + 0.5) / 8 * TAU) * 10.6, Math.cos((i + 1) / 8 * TAU) * 9.5, Math.sin((i + 1) / 8 * TAU) * 9.5]); } });
    // three conduits running out along the ground
    parts.push({ z0: 0, z1: 4, side: C.mix(p.a, p.d, 0.5), top: p.a, shape: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2 + 0.3; blade(c, a, 4, 17, 2.2, 2.2, 0); } },
      detail: (c) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2 + 0.3; S.lines(c, cs(p.g, 0.1), 0.9, [Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 17, Math.sin(a) * 17]); for (const d of [10, 14]) S.lines(c, SEAM2, 0.7, [Math.cos(a) * d - Math.sin(a) * 2.4, Math.sin(a) * d + Math.cos(a) * 2.4, Math.cos(a) * d + Math.sin(a) * 2.4, Math.sin(a) * d - Math.cos(a) * 2.4]); } } });
    // clamp housing
    parts.push({ z0: 2, z1: 8, side: p.a, top: p.b, shape: (c) => S.poly(c, ngon(0, 0, 7, 8, TAU / 16)), detail: (c) => ring(c, SEAM2, 0, 0, 4.6, 0.7) });
    // capacitor core with clamps
    parts.push({ z0: 8, z1: H, side: C.shade(p.g, -0.2), top: C.shade(p.g, 0.55), flat: true, ao: -0.2, shape: (c, zt) => S.poly(c, ngon(0, 0, 3.4 - zt * 0.6, 6, 0)) });
    parts.push({ z0: 8, z1: H + 1, side: p.d, top: C.mix(p.a, p.d, 0.3), shape: (c, zt) => { const z = 8 + zt * (H - 7); if (Math.floor(z) % 5 === 0 || zt > 0.92) S.poly(c, ngon(0, 0, 4.4, 6, 0)); else for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + Math.PI / 6; S.circ(c, Math.cos(a) * 3.8, Math.sin(a) * 3.8, 0.9); } } });
    return { r: 19, h: H + 3, parts, style: 'unit' };
  };

  M.saLanceCore = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const R = o.r || 44;
    parts.push({ z0: 0, z1: 4, side: p.d, top: C.shade(p.d, 0.15), shape: (c) => S.poly(c, ngon(0, 0, R + 6, 8, TAU / 16)),
      detail: (c) => { ring(c, ca(p.g, 0.8), 0, 0, R - 2, 1.2); ring(c, ca(p.g, 0.5), 0, 0, R + 2.5, 0.6); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.lines(c, ca(p.g, 0.75), 1, [Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * (R - 2), Math.sin(a) * (R - 2)]); S.lines(c, SEAM2, 0.6, [Math.cos(a + TAU / 16) * (R - 4), Math.sin(a + TAU / 16) * (R - 4), Math.cos(a + TAU / 16) * (R + 5), Math.sin(a + TAU / 16) * (R + 5)]); } } });
    parts.push({ z0: 4, z1: 9, side: p.a, top: p.b, shape: (c) => annulus(c, 0, 0, 27, 15),
      detail: (c) => { for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; S.lines(c, SEAM, 0.55, [Math.cos(a) * 16, Math.sin(a) * 16, Math.cos(a) * 26.5, Math.sin(a) * 26.5]); } } });
    // well of light inside the ring
    parts.push({ z0: 4, z1: 5, side: p.g, top: C.mix(p.g, '#ffffff', 0.5), flat: true, shape: (c) => S.circ(c, 0, 0, 15.5), detail: (c) => glow(c, '#ffffff', 0, 0, 12) });
    // four great claws arching in toward the core
    const claw = (zt) => 34 - Math.sin(zt * Math.PI * 0.62) * 16;
    parts.push({ z0: 2, z1: 58, side: p.a, top: p.b, ao: 0.4, shape: (c, zt) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; const d = claw(zt); const w = 9.5 - zt * 7; S.poly(c, ngon(Math.cos(a) * d, Math.sin(a) * d, w, 4, a)); } } });
    parts.push({ z0: 6, z1: 54, side: C.shade(p.g, -0.05), top: C.shade(p.g, 0.5), flat: true, shape: (c, zt) => { for (const i of [0, 1]) { const a = i / 4 * TAU + TAU / 8; const d = claw(zt * 0.93) + (9.5 - zt * 0.93 * 7) * 0.72; S.circ(c, Math.cos(a) * d, Math.sin(a) * d, 1); } } });
    // pulsing core
    parts.push({ z0: 10, z1: 44, side: C.shade(p.g, -0.1), top: C.mix(p.g, '#ffffff', 0.7), flat: true, ao: -0.3, shape: (c, zt, an) => S.circ(c, 0, 0, 14 * (1 + Math.sin(an * TAU) * 0.08) * Math.sin(Math.max(0.12, zt) * Math.PI)), detail: (c) => glow(c, '#ffffff', -1.5, -1.5, 4) });
    // containment rings (rotate with anim)
    const rc = C.shade(p.g, 0.3);
    parts.push({ z0: 18, z1: 34, side: rc, top: rc, flat: true, shape: (c, zt, an) => { const z = 18 + zt * 16; for (let i = 0; i < 64; i++) { const t = i / 64 * TAU; const rz = 26 + Math.sin(t - an * TAU) * 6.5; if (Math.abs(rz - z) < 0.55) S.circ(c, Math.cos(t) * 18.5, Math.sin(t) * 18.5, 1); } } });
    parts.push({ z0: 18, z1: 34, side: rc, top: rc, flat: true, shape: (c, zt, an) => { const z = 18 + zt * 16; for (let i = 0; i < 64; i++) { const t = i / 64 * TAU; const rz = 26 + Math.sin(t + an * TAU + 1.6) * 6.5; if (Math.abs(rz - z) < 0.55) S.circ(c, Math.cos(t) * 21.5, Math.sin(t) * 21.5, 1); } } });
    // the lance needle
    parts.push({ z0: 40, z1: 92, side: C.mix(p.g, p.d, 0.3), top: '#ffffff', ao: 0.1, shape: (c, zt) => S.poly(c, ngon(0, 0, 4.6 * (1 - zt) + 0.3, 4, Math.PI / 4)) });
    parts.push({ z0: 42, z1: 86, side: C.mix(p.g, '#ffffff', 0.6), top: '#ffffff', flat: true, shape: (c, zt) => { const r = 4.6 * (1 - (zt * 44 + 2) / 52) + 0.3; S.poly(c, [-r * 0.7, r * 0.1, -r * 0.3, r * 0.4, -r * 0.3, r * 0.75, -r * 0.6, r * 0.5]); } });
    return { r: R + 10, h: 94, parts, style: 'unit' };
  };
})(window.AS);
