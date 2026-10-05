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
      // opened petals: low at the root, curling up toward the tips
      parts.push({ z0: 0.6, z1: 6, side: C.shade(flesh, -0.05), top: C.mix(fleshT, '#ff86b8', 0.3), ao: 0.45,
        shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; blade(c, a, 4.5 + zt * zt * 8.5, 14.5 - zt * 1.2, 2.6 + zt * 0.8, 3.6 - zt * 1.6, 1.6); } },
        detail: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; S.lines(c, cs(p.t, 0.15), 0.9, [Math.cos(a) * 13, Math.sin(a) * 13, Math.cos(a) * 15, Math.sin(a) * 15]); } } });
      // petal inner faces: veined, with glowing nectar spots near the root
      parts.push({ z0: 0.6, z1: 0.6, side: fleshT, top: C.mix(fleshT, '#ff86b8', 0.3), shape: (c) => { for (let i = 0; i < 5; i++) blade(c, i / 5 * TAU + 0.3, 4.5, 12.5, 2.6, 3.4, 1.4); },
        detail: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; S.lines(c, cs(p.t, 0.1), 0.7, [Math.cos(a) * 5.5, Math.sin(a) * 5.5, Math.cos(a) * 11.5, Math.sin(a) * 11.5]); glow(c, p.g, Math.cos(a) * 8, Math.sin(a) * 8, 1.6); } } });
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
})(window.AS);
