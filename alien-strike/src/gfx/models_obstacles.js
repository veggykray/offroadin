/* ALIEN STRIKE — obstacle library (one tall terrain feature per world style) and the
 * FRC heavy dropship parked at every LZ.
 * Obstacles: AS.Models.obsX(pal, { h, r, seed, glowVein }) — r is the footprint
 * radius (collision stays honest: solid mass sits within ~r, tall parts above),
 * h the tallest point. One direction, one frame (obsGearTower: 4 anim frames).
 * Wall detail technique: a part that STROKES only the south-facing edges of a
 * footprint polygon sweeps exactly that wall face as the forge stacks slices, so
 * facets, strata, window rows and glyph channels can be painted onto walls without
 * bleeding over the faces above them. Loads after models4.js. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------------- helpers ---------------- */
  const PAL = (p, def) => Object.assign({}, def, p || {});
  const rngOf = (seed, salt) => new U.RNG(((seed | 0) * 7919 + (salt || 0) * 104729 + 17) >>> 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hexS = (c, f) => { const v = C.shade(c, f); return '#' + v.map((x) => ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2)).join(''); };
  const mixS = (a, b, t) => { const v = C.mix(a, b, t); return '#' + v.map((x) => ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2)).join(''); };

  function ngon(n, r, rot, cx, cy) {
    const a = [];
    for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r); }
    return a;
  }
  // Irregular polygon (rocks, crowns), deterministic by seed.
  function jag(n, r, seed, rough, rot, cx, cy, sx, sy) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const t = (rot || 0) + (i / n) * TAU;
      const rr = r * (1 - rough / 2 + U.hash2(i, seed, 31) * rough);
      a.push((cx || 0) + Math.cos(t) * rr * (sx || 1), (cy || 0) + Math.sin(t) * rr * (sy || 1));
    }
    return a;
  }
  // Scale a polygon about (ox, oy) then translate by (dx, dy).
  function xf(pts, k, dx, dy, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    const o = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { o[i] = ox + (pts[i] - ox) * k + (dx || 0); o[i + 1] = oy + (pts[i + 1] - oy) * k + (dy || 0); }
    return o;
  }
  function area(pts) { let a = 0; const n = pts.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; } return a / 2; }
  /* Append the edges of a polygon whose outward normal satisfies test(nx, ny) as
   * open segments (for stroked wall-paint parts). Only edges with ny > 0 are ever
   * visible in the single-direction obstacle view. */
  function edges(ctx, pts, test, inset) {
    const n = pts.length, sg = area(pts) > 0 ? 1 : -1;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      const ex = pts[j] - pts[i], ey = pts[j + 1] - pts[i + 1], L = Math.hypot(ex, ey) || 1;
      const nx = sg * ey / L, ny = -sg * ex / L;
      if (ny <= 0.08 || !test(nx, ny)) continue;
      const k = inset ? Math.min(0.45, inset / L) : 0;
      ctx.moveTo(pts[i] + ex * k, pts[i + 1] + ey * k);
      ctx.lineTo(pts[j] - ex * k, pts[j + 1] - ey * k);
    }
  }
  const darkFace = (nx, ny) => nx > 0.28;            // faces turned away from the top-left light
  const litFace = (nx, ny) => nx < -0.35;            // faces turned toward the light
  const southFace = () => true;

  // Radial gradient pool painted on the ground (flat decal under a model).
  function pool(c, x, y, r, col, a, sy) {
    c.save(); c.translate(x, y); c.scale(1, sy || 1);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, C.str(col, a)); g.addColorStop(0.55, C.str(col, a * 0.45)); g.addColorStop(1, C.str(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.restore();
  }

  /* ==================================================================
   * W1 ASHEN VALE — basalt column cluster: 4-7 hexagonal prisms packed in a
   * honeycomb, stepping down from a tall core, faceted walls, cross-joints,
   * ochre dust caps and a scree apron.
   * ================================================================== */
  M.obsBasalt = function (pal, o) {
    const p = PAL(pal, { a: '#463a33', b: '#857262', t: '#c99a62', d: '#211a16', g: '#ffb04a' });
    o = o || {};
    const H = (o.h || 90) * 0.86, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 1);
    const cr = R * 0.37;                                   // column hex radius
    const step = cr * 1.74;
    // honeycomb slots: centre + 6 ring + a few outer
    const slots = [[0, 0]];
    for (let i = 0; i < 6; i++) { const t = i / 6 * TAU + Math.PI / 6; slots.push([Math.cos(t) * step, Math.sin(t) * step]); }
    const ring = slots.slice(1);
    // pick 3-6 ring slots, biased toward a random "fall" direction so the skyline steps down
    const fall = rg.range(0, TAU);
    ring.sort((a, b) => (Math.cos(Math.atan2(a[1], a[0]) - fall) - Math.cos(Math.atan2(b[1], b[0]) - fall)));
    const nRing = 3 + rg.int(0, 3);
    const cols = [{ x: 0, y: 0, h: H * rg.range(0.9, 1) }];
    for (let i = 0; i < nRing; i++) {
      const s = ring[i];
      const towards = Math.cos(Math.atan2(s[1], s[0]) - fall);   // -1 back .. 1 toward the fall side
      cols.push({ x: s[0], y: s[1], h: H * U.clamp(rg.range(0.5, 0.78) - towards * 0.18, 0.28, 0.86) });
    }
    // one or two stubby broken columns at the fall side
    const nStub = rg.int(1, 2);
    for (let i = 0; i < nStub; i++) {
      const t = fall + rg.range(-0.7, 0.7), d = step * rg.range(1.55, 1.85);
      cols.push({ x: Math.cos(t) * d, y: Math.sin(t) * d, h: H * rg.range(0.12, 0.24), stub: true });
    }
    cols.forEach((c, i) => { c.rot = rg.range(-0.12, 0.12); c.k = rg.range(0.9, 1.04); c.j = rg.range(0.35, 0.65); c.i = i; c.dust = rg.chance(0.6); });
    cols.sort((a, b) => a.y - b.y);

    const parts = [];
    // scree apron + fallen drums
    const apron = jag(11, R * 1.22, seed + 3, 0.3, rg.range(0, 1), 0, R * 0.08, 1.08, 0.92);
    parts.push({ z0: 0, z1: 2, side: hexS(p.t, -0.42), top: hexS(p.t, -0.12), ao: 0.3, bevel: false, shape: (c) => S.poly(c, apron),
      detail: (c) => {
        const r2 = rngOf(seed, 9);
        for (let i = 0; i < 26; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.55, 1.15); S.dot(c, r2.chance(0.5) ? hexS(p.a, -0.1) : hexS(p.t, 0.18), Math.cos(a) * d, Math.sin(a) * d * 0.9 + R * 0.08, r2.range(0.5, 1.2)); }
      } });
    const fallen = [];
    for (let i = 0; i < 2; i++) { const t = fall + rg.range(-1.2, 1.2), d = R * rg.range(0.95, 1.15); fallen.push({ x: Math.cos(t) * d, y: Math.sin(t) * d, a: rg.range(0, Math.PI) }); }
    parts.push({ z0: 0, z1: cr * 1.3, side: p.a, top: p.b, shape: (c) => { for (const f of fallen) { c.save(); c.translate(f.x, f.y); c.rotate(f.a); S.poly(c, [-cr * 1.2, -cr * 0.75, cr * 1.2, -cr * 0.75, cr * 1.35, 0, cr * 1.2, cr * 0.75, -cr * 1.2, cr * 0.75, -cr * 1.35, 0]); c.restore(); } } });

    for (const col of cols) {
      const hex = ngon(6, cr * col.k, col.rot, col.x, col.y);
      const hj = col.stub ? col.h : col.h * col.j;          // cross-joint height
      const hex2 = xf(hex, 0.94, 0, 0, col.x, col.y);
      const topC = col.h > H * 0.75 ? hexS(p.b, 0.06) : p.b;
      // lower drum
      parts.push({ z0: 0, z1: hj, side: p.a, top: col.stub ? topC : hexS(p.b, -0.12), ao: 0.45, shape: (c) => S.poly(c, hex) });
      if (!col.stub) parts.push({ z0: hj, z1: col.h, side: hexS(p.a, 0.04), top: topC, ao: 0.22, shape: (c) => S.poly(c, hex2),
        detail: (c) => {
          if (col.dust) { c.beginPath(); S.poly(c, xf(hex2, 0.62, -cr * 0.18, -cr * 0.12, col.x, col.y)); c.fillStyle = C.str(p.t, 0.45); c.fill(); }
          S.lines(c, 'rgba(20,14,10,0.45)', 0.4, [col.x - cr * 0.5, col.y + cr * 0.1, col.x + cr * 0.15, col.y - cr * 0.3, col.x + cr * 0.15, col.y - cr * 0.3, col.x + cr * 0.55, col.y + cr * 0.2]);
        } });
      // shadow-side facets (east-facing walls) painted over the full height
      parts.push({ z0: 0, z1: col.h, side: hexS(p.a, -0.38), top: hexS(p.a, -0.38), stroke: 0.7, ao: 0.15, bevel: false,
        shape: (c, zt) => edges(c, (zt * col.h > hj) ? hex2 : hex, darkFace) });
    }
    return { r: R * 1.45 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * LZ DROPSHIP — FRC heavy carrier "Halcyon": wide boxy hull, open rear ramp
   * onto the ground, four landing struts, four engine pods on stub wings,
   * raised cockpit, dorsal spine and nav lights. Parked, nose +x.
   * ================================================================== */
  M.dropship = function (pal, o) {
    const p = PAL(pal, { a: '#4c5664', b: '#c4ccd4', t: '#de9c3a', g: '#5fe6ff', d: '#20252c' });
    o = o || {};
    const hullS = p.a, hullT = p.b, panel = hexS(p.b, -0.2), dark = p.d, metal = '#3a414b';
    const seam = 'rgba(24,28,34,0.5)', seamL = 'rgba(255,255,255,0.25)', trim = p.t, glow = p.g;
    const HZ = 9;                // hull floor height (struts below)
    const parts = [];
    const strutPts = [[24, 15], [24, -15], [-26, 17], [-26, -17]];
    // ground: crates + fuel drums by the ramp
    parts.push({ z0: 0, z1: 4.5, side: '#6a5532', top: '#b08a4e', shape: (c) => { S.rect(c, -60, 13, 6, 6); S.rect(c, -54, 15, 5, 5); S.rect(c, -58, -21, 7, 6); },
      detail: (c) => { S.lines(c, 'rgba(50,34,16,0.6)', 0.4, [-60, 13, -54, 19, -60, 19, -54, 13, -58, -21, -51, -15, -58, -15, -51, -21]); S.fillPoly(c, trim, [-54, 15, -49, 15, -49, 16, -54, 16]); } });
    parts.push({ z0: 0, z1: 6, side: '#3a5a6a', top: '#6a96a8', shape: (c) => { S.circ(c, -49, -21.5, 2); S.circ(c, -45.5, -22.5, 2); }, detail: (c) => { S.dot(c, '#1d2a30', -49, -21.5, 0.6); S.dot(c, '#1d2a30', -45.5, -22.5, 0.6); } });
    // landing struts + foot pads
    parts.push({ z0: 0, z1: 1, side: dark, top: metal, bevel: false, shape: (c) => { for (const s of strutPts) S.ell(c, s[0], s[1], 3, 2.4); } });
    parts.push({ z0: 0.5, z1: HZ, side: '#2c323a', top: '#59626d', stroke: 1.8, bevel: false, shape: (c) => { for (const s of strutPts) S.circ(c, s[0], s[1], 0.15); } });
    parts.push({ z0: 3, z1: HZ, side: '#3f4752', top: '#6b7480', stroke: 0.9, bevel: false, shape: (c, zt) => { for (const s of strutPts) { const k = 1 - zt; S.seg(c, s[0], s[1], s[0] * (1 - 0.18 * (1 - k)) , s[1] * (0.55 + 0.45 * k)); } } });
    // rear ramp sloping from the bay floor to the ground (hazard chevrons)
    const rx0 = -40, rlen = 20, rw = 9;
    parts.push({ z0: 0, z1: HZ - 0.5, side: '#5a626c', top: '#8b939c', ao: 0.25, bevel: false,
      shape: (c, zt) => { const x = rx0 - rlen * (1 - zt); S.rect(c, x - 1.6, -rw, 3.2, rw * 2); } });
    parts.push({ z0: 0, z1: HZ - 0.5, side: trim, top: trim, flat: true, bevel: false, when: () => true,
      shape: (c, zt) => { const x = rx0 - rlen * (1 - zt); const ph = Math.floor(zt * 6) % 2; if (!ph) { S.rect(c, x - 1.6, -rw, 3.2, 1.6); S.rect(c, x - 1.6, rw - 1.6, 3.2, 1.6); } } });
    // ventral belly
    const belly = S.sym([42, 0, 38, 8, 28, 15, -34, 16.5, -40, 14, -41, 0]);
    parts.push({ z0: HZ - 2, z1: HZ, side: dark, top: metal, bevel: false, shape: (c) => S.poly(c, belly) });
    // stub wings + engine pods
    const wingF = [12, 14, 4, 30, -4, 30, -2, 14], wingR = [-18, 15, -24, 31, -32, 31, -32, 15];
    const mir = (a) => a.map((v, i) => (i % 2 ? -v : v));
    parts.push({ z0: HZ + 3, z1: HZ + 5.5, side: hullS, top: panel, shape: (c) => { S.poly(c, wingF); S.poly(c, mir(wingF)); S.poly(c, wingR); S.poly(c, mir(wingR)); },
      detail: (c) => { for (const sg of [1, -1]) { S.fillPoly(c, trim, [4, 29.4 * sg, -4, 29.4 * sg, -3.6, 27.8 * sg, 4.6, 27.8 * sg]); S.fillPoly(c, trim, [-24, 30.4 * sg, -32, 30.4 * sg, -32, 28.8 * sg, -24.6, 28.8 * sg]); } } });
    const pods = [[1, 27], [1, -27], [-27, 28], [-27, -28]];
    parts.push({ z0: HZ + 1, z1: HZ + 9, side: metal, top: '#8a94a0', shape: (c) => { for (const q of pods) S.rrect(c, q[0] - 9, q[1] - 4, 17, 8, 3.6); },
      detail: (c) => {
        for (const q of pods) {
          S.lines(c, seam, 0.4, [q[0] - 2, q[1] - 3.8, q[0] - 2, q[1] + 3.8, q[0] + 3, q[1] - 3.9, q[0] + 3, q[1] + 3.9]);
          S.dot(c, '#14181d', q[0] + 6.6, q[1], 2.6); S.dot(c, '#3c4550', q[0] + 6.6, q[1], 1.4);
          S.lines(c, seamL, 0.5, [q[0] - 6, q[1] - 2.8, q[0] + 4, q[1] - 2.8]);
        }
      } });
    // pod exhaust glows
    parts.push({ z0: HZ + 3, z1: HZ + 7, side: hexS(glow, -0.35), top: glow, flat: true, bevel: false, shape: (c) => { for (const q of pods) S.ell(c, q[0] - 9.2, q[1], 1.4, 3); } });
    // main hull with the open bay notch at the rear
    const hull = [44, 0, 40.5, 6, 33, 12, 22, 15.5, -30, 16.5, -40, 14.5, -40, 8.5, -16, 8.5, -16, -8.5, -40, -8.5, -40, -14.5, -30, -16.5, 22, -15.5, 33, -12, 40.5, -6];
    parts.push({ z0: HZ, z1: HZ + 10, side: hullS, top: hullT, ao: 0.35, shape: (c) => S.poly(c, hull),
      detail: (c) => {
        S.lines(c, seam, 0.45, [30, -12.5, 30, 12.5, 14, -15.4, 14, 15.4, -4, -16, -4, 16, -22, -16.4, -22, -8.5, -22, 8.5, -22, 16.4, 14, 0, -4, 0]);
        S.lines(c, seamL, 0.5, [43, 0.6, 33, 11.4, 22, 15, -30, 16]);
        // hazard stripes along the bay lips
        for (let i = 0; i < 6; i++) { const x = -39 + i * 4; S.fillPoly(c, i % 2 ? '#1f2328' : trim, [x, 8.6, x + 3.4, 8.6, x + 2.4, 11, x - 1, 11]); S.fillPoly(c, i % 2 ? '#1f2328' : trim, [x, -8.6, x + 3.4, -8.6, x + 2.4, -11, x - 1, -11]); }
        // amber trim chevrons on the nose shoulders + FRC roundel
        S.fillPoly(c, trim, [36, 9.6, 26, 13.8, 25, 12.6, 35, 8.5]); S.fillPoly(c, trim, [36, -9.6, 26, -13.8, 25, -12.6, 35, -8.5]);
        S.dot(c, '#2a3038', 4, 11.5, 2.4); S.dot(c, glow, 4, 11.5, 1.5); S.dot(c, '#2a3038', 4, 11.5, 0.7);
        // vents
        for (let i = 0; i < 4; i++) S.lines(c, 'rgba(14,16,20,0.7)', 0.5, [-8 - i * 1.6, -13.5, -8 - i * 1.6, -10.5]);
      } });
    // cargo bay floor (recessed) with interior light strips
    parts.push({ z0: HZ, z1: HZ + 1, side: '#2a3038', top: '#3e4651', flat: true, bevel: false, shape: (c) => S.rect(c, -40, -8.5, 24, 17),
      detail: (c) => {
        const g = c.createLinearGradient(-40, 0, -16, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        c.fillStyle = g; c.beginPath(); c.rect(-40, -8.5, 24, 17); c.fill();
        S.lines(c, C.str(glow, 0.9), 0.6, [-38, -7.6, -18, -7.6, -38, 7.6, -18, 7.6]);
        S.lines(c, 'rgba(255,255,255,0.12)', 0.4, [-36, -4, -36, 4, -31, -4, -31, 4, -26, -4, -26, 4, -21, -4, -21, 4]);
      } });
    // inner wall of the bay (north side faces the camera): darker panel
    parts.push({ z0: HZ + 1, z1: HZ + 10, side: '#3a424c', top: '#3a424c', stroke: 0.6, ao: 0.3, bevel: false, shape: (c) => S.seg(c, -40, -8.5, -16, -8.5) });
    // dorsal superstructure + spine
    const spine = S.sym([30, 0, 26, 7, -10, 8, -14, 6, -14, 0]);
    parts.push({ z0: HZ + 10, z1: HZ + 14, side: hexS(hullS, 0.05), top: hexS(hullT, 0.06), shape: (c) => S.poly(c, spine),
      detail: (c) => {
        S.lines(c, seam, 0.4, [12, -7.6, 12, 7.6, -2, -8, -2, 8]);
        for (let i = 0; i < 3; i++) S.rrect(c, -11 + i * 0.01, -2, 0.1, 0.1, 0.05);
        c.fillStyle = '#2a3038'; c.beginPath(); S.rrect(c, -10, -4.5, 7, 9, 1.4); c.fill();
        for (let i = 0; i < 4; i++) S.lines(c, '#14181d', 0.5, [-9 + i * 1.7, -3.6, -9 + i * 1.7, 3.6]);
      } });
    // cockpit block + glass
    parts.push({ z0: HZ + 10, z1: HZ + 13, side: '#262c34', top: '#353d47', shape: (c) => S.poly(c, S.sym([41, 0, 38.5, 5.4, 30, 7.4, 30, 0])) });
    parts.push({ z0: HZ + 13, z1: HZ + 14, side: '#123040', top: '#123040', flat: true, shape: (c) => S.poly(c, S.sym([40, 0, 37.8, 4.6, 31, 6.4, 31, 0])),
      detail: (c) => {
        const g = c.createLinearGradient(31, -6, 40, 6); g.addColorStop(0, '#7fe6ff'); g.addColorStop(0.45, '#1d5468'); g.addColorStop(1, '#0c1c26');
        c.fillStyle = g; c.beginPath(); S.poly(c, S.sym([40, 0, 37.8, 4.6, 31, 6.4, 31, 0])); c.fill();
        S.lines(c, 'rgba(10,14,18,0.7)', 0.45, [35, -5.6, 35, 5.6, 31, 0, 40, 0]);
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); S.ell(c, 37, -2.6, 2, 0.5, 0.5); c.fill();
      } });
    // antenna mast + dish + beacon
    parts.push({ z0: HZ + 14, z1: HZ + 21, side: '#8b939c', top: '#d6dde3', shape: (c) => S.circ(c, -6, 5, 0.5) });
    parts.push({ z0: HZ + 14, z1: HZ + 16, side: '#4b5560', top: '#9fb0bf', shape: (c) => S.ell(c, 6, -4, 2.6, 2.2) });
    // nav lights: port red, starboard green, tail white, cyan hull lights
    parts.push({ z0: HZ + 9, z1: HZ + 10, side: '#3a0a0a', top: '#ff4a4a', flat: true, bevel: false, shape: (c) => { S.circ(c, -28, -33, 1.1); S.circ(c, 0, -31.5, 0.9); } });
    parts.push({ z0: HZ + 9, z1: HZ + 10, side: '#0a3a14', top: '#5aff7a', flat: true, bevel: false, shape: (c) => { S.circ(c, -28, 33, 1.1); S.circ(c, 0, 31.5, 0.9); } });
    parts.push({ z0: HZ + 21, z1: HZ + 22, side: '#888', top: '#ffffff', flat: true, bevel: false, shape: (c) => S.circ(c, -6, 5, 1) });
    parts.push({ z0: HZ + 10, z1: HZ + 10.5, side: glow, top: glow, flat: true, bevel: false, shape: (c) => { S.circ(c, 42.5, 2.6, 0.7); S.circ(c, 42.5, -2.6, 0.7); S.circ(c, -39, 15, 0.7); S.circ(c, -39, -15, 0.7); } });
    return {
      r: 64, h: HZ + 23, parts, style: 'unit', bevel: 0.8,
      lights: [{ x: -28, y: -33, z: HZ + 10, col: '#ff4a4a' }, { x: -28, y: 33, z: HZ + 10, col: '#5aff7a' }, { x: -6, y: 5, z: HZ + 22, col: '#ffffff', strobe: true }],
      exhaust: pods.map((q) => [q[0] - 9.5, q[1], HZ + 5]), rampPt: [-58, 0],
    };
  };
})(window.AS);
