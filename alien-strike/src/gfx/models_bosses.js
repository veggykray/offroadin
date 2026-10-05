/* ALIEN STRIKE — world boss models (package: bosses).
 * Ten bespoke boss generators plus their extra sheets (body segments, exposed
 * core). All follow the forge model contract: centred on the origin, +x = front,
 * ground at z 0. Boss behaviour code (src/game/bosses.js) sinks, lifts and trails
 * these sheets; nothing here depends on that code.
 *   boMaw, boKharad, boKharadSeg, boQueen, boPrism, boRefinery, boRefCore,
 *   boFoundry, boMind, boTempest, boTempestSeg, boWarden, boHeart */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------------- helpers ---------------- */
  const cs = (c) => (typeof c === 'string' ? c : C.str(c));
  const mix = (a, b, t) => C.mix(a, b, t);
  const sh = (c, k) => C.shade(c, k);
  // rotate + translate a flat [x,y,...] point list
  function tf(pts, cx, cy, a) {
    const ca = Math.cos(a || 0), sa = Math.sin(a || 0), o = [];
    for (let i = 0; i < pts.length; i += 2) o.push(cx + pts[i] * ca - pts[i + 1] * sa, cy + pts[i] * sa + pts[i + 1] * ca);
    return o;
  }
  function ngon(cx, cy, r, n, rot) {
    const o = [];
    for (let i = 0; i < n; i++) { const a = (rot || 0) + (i / n) * TAU; o.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    return o;
  }
  const hexPts = (cx, cy, r, rot) => ngon(cx, cy, r, 6, rot);
  function annulus(c, x, y, r1, r0) {
    c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU);
    c.moveTo(x + r0, y); c.arc(x, y, r0, TAU, 0, true);
  }
  // object-space unit vector pointing toward the screen light (top-left)
  function lightDir(c) {
    const T = c.getTransform();
    let lx = -(T.a + T.b), ly = -(T.c + T.d);
    const l = Math.hypot(lx, ly) || 1;
    return [lx / l, ly / l];
  }
  // how much an object-space normal faces the light (-1..1)
  function lit(c, nx, ny) {
    const T = c.getTransform();
    const sx = T.a * nx + T.c * ny, sy = T.b * nx + T.d * ny;
    const l = Math.hypot(sx, sy) || 1;
    return (-sx - sy) / (l * Math.SQRT2);
  }
  // faceted pyramid cap over a polygon: each facet shaded by the screen light
  function facetCap(c, pts, ax, ay, col, k, edge) {
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[((i + 1) % n) * 2], y2 = pts[((i + 1) % n) * 2 + 1];
      let nx = (x1 + x2) / 2 - ax, ny = (y1 + y2) / 2 - ay;
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const d = lit(c, nx, ny);
      c.fillStyle = cs(sh(col, d * (k || 0.4)));
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(ax, ay); c.closePath(); c.fill();
    }
    if (edge) {
      c.strokeStyle = edge; c.lineWidth = 0.35; c.beginPath();
      for (let i = 0; i < n; i++) { c.moveTo(pts[i * 2], pts[i * 2 + 1]); c.lineTo(ax, ay); }
      c.stroke();
    }
  }
  function radial(c, x, y, r, stops) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    for (const s of stops) g.addColorStop(s[0], cs(s[1]));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function glowDot(c, x, y, r, col, core) {
    radial(c, x, y, r, [[0, core || '#ffffff'], [0.35, col], [1, C.str(col, 0)]]);
  }
  // ring of teeth pointing inward (rOut -> rIn)
  function teeth(c, x, y, rOut, rIn, n, rot, col, edge, wk) {
    c.fillStyle = cs(col); c.beginPath();
    const w = (TAU / n) * (wk || 0.42);
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * TAU;
      c.moveTo(x + Math.cos(a - w) * rOut, y + Math.sin(a - w) * rOut);
      c.lineTo(x + Math.cos(a + w) * rOut, y + Math.sin(a + w) * rOut);
      c.lineTo(x + Math.cos(a) * rIn, y + Math.sin(a) * rIn);
      c.closePath();
    }
    c.fill();
    if (edge) { c.strokeStyle = edge; c.lineWidth = 0.3; c.stroke(); }
  }
  // jagged glowing crack polyline (deterministic)
  function crack(c, pts, col, w, glowCol) {
    if (glowCol) { c.save(); c.strokeStyle = glowCol; c.lineWidth = w * 2.6; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); c.restore(); }
    c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); c.restore();
  }
  const wave = (a, k) => 0.5 - 0.5 * Math.cos((a + (k || 0)) * TAU); // 0..1..0 over the cycle

  /* ==================================================================
   * W1 — THE BASALT MAW. A colossal magma worm head bursting out of the
   * ground: a forward-leaning column of hexagonal basalt plates over a molten
   * core (the glowing seams are the core showing through), a ring of broken
   * rock at its base, one body coil arching out behind, and a three-jaw head
   * whose plates open across the anim cycle to bare the magma throat.
   * ================================================================== */
  M.boMaw = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#3a3034', B = pal.b || '#6a5a5a', G = pal.g || '#ff8a3a';
    const plateS = mix(A, '#1e1c24', 0.5), plateT = mix(B, '#4a4048', 0.45);
    const plateT2 = mix(plateT, '#6a5a58', 0.25);
    const hot = '#ffe08a', deep = '#8a2408';
    const seam = 'rgba(14,10,12,0.6)';
    const tooth = '#efe2c4';
    const cx = (z) => -5 + z * 0.26;
    const HZ = 27;
    const hx = cx(HZ) + 1.5;
    const parts = [];

    // broken ground slabs thrown up around the column
    const chunks = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + U.hash2(i, 3, 11) * 0.4;
      const d = 29 + U.hash2(i, 5, 11) * 5;
      chunks.push([cx(0) + Math.cos(a) * d, Math.sin(a) * d * 0.95, 3.6 + U.hash2(i, 7, 11) * 3.4, i, a]);
    }
    parts.push({ z0: 0, z1: 5, side: '#3a2a22', top: '#8a5e3c', ao: 0.5,
      shape: (c, zt) => { for (const k of chunks) S.blob(c, k[0], k[1], k[2] * (1 - 0.3 * zt), k[3] + 4, 6, 0.45); },
      detail: (c) => { for (const k of chunks) S.lines(c, 'rgba(255,230,190,0.25)', 0.4, [k[0] - k[2] * 0.5, k[1] - k[2] * 0.3, k[0] + k[2] * 0.2, k[1] - k[2] * 0.6]); } });
    // a body coil arching out of the ground behind the head
    const hump = [-37, 5];
    parts.push({ z0: 0, z1: 13, side: '#a8300c', top: G, flat: true, ao: 0.6, bevel: false,
      shape: (c, zt) => { const k = Math.sqrt(1 - zt * zt * 0.85); S.ell(c, hump[0], hump[1], 12.5 * k, 10 * k); } });
    parts.push({ z0: 0, z1: 14, side: plateS, top: plateT, ao: 0.35,
      shape: (c, zt) => { const k = Math.sqrt(1 - zt * zt * 0.8); for (let i = 0; i < 3; i++) S.poly(c, hexPts(hump[0] - 7 + i * 7, hump[1] + (i - 1) * 1.5, 6.3 * k, 0.3 + i * 0.4)); },
      detail: (c) => { crack(c, [hump[0] - 6, hump[1] - 2, hump[0] - 3, hump[1], hump[0] + 1, hump[1] - 1.5], G, 0.45, C.str(G, 0.35)); } });

    // molten core column (shows through every seam between plates)
    parts.push({ z0: 0, z1: HZ, side: '#e0581a', top: G, flat: true, ao: 0.45, bevel: false,
      shape: (c, zt) => S.circ(c, cx(zt * HZ), 0, 18) });
    // four bands of hexagonal basalt plates, staggered, each band tapering inward
    const bands = [[0, 7.4, 0], [9.4, 16.6, 1], [18.6, 26.4, 0]];
    bands.forEach((bd, bi) => {
      const z0 = bd[0], z1 = bd[1];
      parts.push({ z0, z1, side: bi % 2 ? sh(plateS, 0.06) : plateS, top: plateT, ao: 0.28,
        shape: (c, zt) => {
          const x0 = cx(z0 + (z1 - z0) * zt), sc = 1 - 0.16 * zt;
          for (let k = 0; k < 7; k++) {
            const a = ((k + bd[2] * 0.5) / 7) * TAU + bi * 0.17;
            S.poly(c, hexPts(x0 + Math.cos(a) * 18.4, Math.sin(a) * 18.4, 6.9 * sc, a));
          }
        } });
    });
    // throat: magma well with an inner ring of teeth
    parts.push({ z0: HZ - 1, z1: HZ - 0.5, side: deep, top: G, flat: true, bevel: false,
      shape: (c) => S.circ(c, hx, 0, 15),
      detail: (c, an) => {
        const o = wave(an);
        radial(c, hx, 0, 15, [[0, '#fff6d0'], [0.18, hot], [0.5, G], [0.85, '#c2380c'], [1, deep]]);
        teeth(c, hx, 0, 14.6, 9.4 - o * 1.2, 13, an * 0.6, tooth, 'rgba(60,20,10,0.6)', 0.36);
        S.dot(c, '#4a0c04', hx, 0, 3.2 + o * 1.2);
        S.dot(c, hot, hx - 0.6, -0.6, 1.1);
      } });
    // head collar: thick ring of plates around the throat
    parts.push({ z0: HZ - 0.5, z1: HZ + 3.5, side: plateS, top: plateT, ao: 0.3,
      shape: (c) => { S.poly(c, ngon(hx, 0, 26.5, 9, 0.2)); c.moveTo(hx + 14, 0); c.arc(hx, 0, 14, TAU, 0, true); },
      detail: (c) => {
        const s = [];
        for (let k = 0; k < 9; k++) { const a = 0.2 + (k / 9) * TAU; s.push(hx + Math.cos(a) * 14.2, Math.sin(a) * 14.2, hx + Math.cos(a) * 26, Math.sin(a) * 26); }
        S.lines(c, seam, 0.5, s);
        for (let k = 0; k < 3; k++) { const a = Math.PI / 3 + (k / 3) * TAU; glowDot(c, hx + Math.cos(a) * 20.5, Math.sin(a) * 20.5, 3, G, hot); }
      } });
    // three jaw plates: back skull plate + two forward mandibles; open across the cycle
    const jaws = [[Math.PI, 25, 12.5, 0], [Math.PI / 3, 23, 10.5, 1], [-Math.PI / 3, 23, 10.5, 1]];
    const jawPts = (j, o, zt) => {
      const r0 = 2.5 + o * 11 + zt * 1.4, L = j[1] + o * 4 - zt * 2.5, w = j[2] * (1 - 0.18 * zt), w0 = 1.6 + o * 3.5;
      const hook = j[3] ? 4.5 : 1.5;
      const loc = [r0, -w0, r0 + L * 0.42, -w, r0 + L * 0.86, -w * 0.62, r0 + L + hook, -w * 0.12 * (j[3] ? -1 : 1), r0 + L * 0.86, w * 0.62, r0 + L * 0.42, w, r0, w0];
      return tf(loc, hx, 0, j[0] + (j[3] ? (j[0] > 0 ? 1 : -1) * o * 0.22 : 0));
    };
    parts.push({ z0: HZ + 2.5, z1: HZ + 9.5, side: plateS, top: plateT2, ao: 0.35,
      shape: (c, zt, an) => { const o = wave(an); for (const j of jaws) S.poly(c, jawPts(j, o, zt)); },
      detail: (c, an) => {
        const o = wave(an);
        for (const j of jaws) {
          const ang = j[0] + (j[3] ? (j[0] > 0 ? 1 : -1) * o * 0.22 : 0);
          const r0 = 3.9 + o * 11, L = j[1] + o * 4 - 2.5, w = j[2] * 0.82;
          // molten rim along the biting edge
          const P = (u, v) => [hx + Math.cos(ang) * u - Math.sin(ang) * v, Math.cos(ang) * v + Math.sin(ang) * u];
          const e0 = P(r0 + 0.6, -w * 0.35), e1 = P(r0 + 0.6, w * 0.35);
          S.lines(c, C.str(G, 0.9), 1.4, [e0[0], e0[1], e1[0], e1[1]]);
          // hex plate seams
          const a1 = P(r0 + L * 0.45, -w * 0.95), a2 = P(r0 + L * 0.3, 0), a3 = P(r0 + L * 0.45, w * 0.95), a4 = P(r0 + L * 0.72, 0), a5 = P(r0 + L + 1, 0);
          S.lines(c, seam, 0.5, [a1[0], a1[1], a2[0], a2[1], a2[0], a2[1], a3[0], a3[1], a2[0], a2[1], a4[0], a4[1], a4[0], a4[1], a5[0], a5[1]]);
          // magma crack across the plate
          const k1 = P(r0 + L * 0.55, -w * 0.5), k2 = P(r0 + L * 0.62, -w * 0.1), k3 = P(r0 + L * 0.5, w * 0.25), k4 = P(r0 + L * 0.66, w * 0.55);
          crack(c, [k1[0], k1[1], k2[0], k2[1], k3[0], k3[1], k4[0], k4[1]], hot, 0.42, C.str(G, 0.45));
          // fangs on the inner edge
          c.fillStyle = tooth; c.beginPath();
          for (let t = -2; t <= 2; t++) {
            const b0 = P(r0 + 1.4, t * (1.2 + o * 1.0) - 0.8), b1 = P(r0 + 1.4, t * (1.2 + o * 1.0) + 0.8), tp = P(r0 - 2.2, t * (1.2 + o * 0.9));
            c.moveTo(b0[0], b0[1]); c.lineTo(b1[0], b1[1]); c.lineTo(tp[0], tp[1]); c.closePath();
          }
          c.fill();
          const hl = P(r0 + L * 0.35, -w * 0.55);
          S.lines(c, 'rgba(255,255,255,0.22)', 0.5, [hl[0], hl[1], P(r0 + L * 0.8, -w * 0.4)[0], P(r0 + L * 0.8, -w * 0.4)[1]]);
        }
      } });
    return { r: 52, h: HZ + 11, parts, style: 'unit', mouth: [hx, 0, HZ] };
  };

  /* ==================================================================
   * W2 — KHARAD, THE DEEP MOUTH. Titanic sand-worm head pitched forward out
   * of the dunes: a lamprey maw ringed with three concentric tooth rings over a
   * glowing gullet, bone-ivory ridged collars, a fanned armour hood at the back
   * and two hooked tusks in front. Tooth rings counter-rotate over the cycle.
   * ================================================================== */
  M.boKharad = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#2e2a33', B = pal.b || '#5c5462', T = pal.t || '#eadcbc', G = pal.g || '#ffcc44', D = pal.d || '#140f14';
    const boneS = mix(T, A, 0.5), boneT = T, flesh = '#5a1822', fleshD = '#2a0a10';
    const seam = 'rgba(20,14,16,0.55)';
    const cx = (z) => -9 + z * 0.5;
    const NZ = 22, hx = cx(NZ + 2);
    const parts = [];
    // neck rising out of the sand
    parts.push({ z0: 0, z1: NZ, side: A, top: B, ao: 0.5, shape: (c, zt) => S.circ(c, cx(zt * NZ), 0, 18.5) });
    // two ridged armour collars
    for (const [z0, z1] of [[2, 8.5], [10.5, 17]]) {
      parts.push({ z0, z1, side: boneS, top: boneT, ao: 0.35,
        shape: (c, zt) => { const x = cx(z0 + (z1 - z0) * zt), k = 1 - 0.1 * zt; S.star(c, x, 0, 23 * k, 19.6 * k, 13, 0.1); },
        detail: (c) => {
          const x = cx(z1), s = [];
          for (let i = 0; i < 13; i++) { const a = 0.1 + (i / 13) * TAU; s.push(x + Math.cos(a) * 15, Math.sin(a) * 15, x + Math.cos(a) * 20.4, Math.sin(a) * 20.4); }
          S.lines(c, seam, 0.45, s);
        } });
    }
    // maw interior: concentric tooth rings over the glowing gullet
    parts.push({ z0: NZ, z1: NZ + 0.5, side: fleshD, top: flesh, flat: true, bevel: false,
      shape: (c) => S.circ(c, hx, 0, 16),
      detail: (c, an) => {
        const o = wave(an);
        radial(c, hx, 0, 16, [[0, '#fff4c0'], [0.16, G], [0.32, '#d0502a'], [0.6, flesh], [1, fleshD]]);
        teeth(c, hx, 0, 15.6, 10.6 - o, 15, an * (TAU / 15), T, 'rgba(40,14,10,0.7)', 0.4);
        teeth(c, hx, 0, 10.4, 6.4 - o * 0.8, 11, -an * (TAU / 11) + 0.15, sh(T, -0.08), 'rgba(40,14,10,0.7)', 0.4);
        teeth(c, hx, 0, 6.2, 3.2 - o * 0.6, 8, an * (TAU / 8) + 0.3, sh(T, -0.16), 'rgba(40,14,10,0.6)', 0.4);
        glowDot(c, hx, 0, 3.4 + o * 0.8, G, '#ffffff');
      } });
    // bone lip around the maw
    parts.push({ z0: NZ + 0.5, z1: NZ + 5, side: boneS, top: boneT, ao: 0.3,
      shape: (c) => { S.star(c, hx, 0, 22.5, 20.8, 16, 0); c.moveTo(hx + 15.4, 0); c.arc(hx, 0, 15.4, TAU, 0, true); },
      detail: (c) => {
        const s = [];
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; s.push(hx + Math.cos(a) * 15.8, Math.sin(a) * 15.8, hx + Math.cos(a) * 21.6, Math.sin(a) * 21.6); }
        S.lines(c, seam, 0.45, s);
        S.lines(c, 'rgba(255,255,255,0.35)', 0.5, [hx - 12, -15, hx - 3, -20.5]);
      } });
    // armour hood fanned out behind the maw
    const hood = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.62 + (i / 10) * Math.PI * 0.76; const r = i % 2 ? 31 : 35.5; hood.push(Math.cos(a) * r, Math.sin(a) * r); }
    for (let i = 10; i >= 0; i--) { const a = Math.PI * 0.62 + (i / 10) * Math.PI * 0.76; hood.push(Math.cos(a) * 19, Math.sin(a) * 19); }
    parts.push({ z0: 12, z1: NZ + 9, side: boneS, top: sh(boneT, -0.04), ao: 0.4,
      shape: (c, zt) => { const z = 12 + (NZ - 3) * zt, x = cx(z) + 1; S.poly(c, tf(hood.map((v, i) => v * (1 - 0.08 * zt)), x, 0, 0)); },
      detail: (c) => {
        const x = cx(NZ + 9) + 1, s = [];
        for (let i = 0; i <= 10; i += 2) { const a = Math.PI * 0.62 + (i / 10) * Math.PI * 0.76; s.push(x + Math.cos(a) * 19.5, Math.sin(a) * 19.5, x + Math.cos(a) * 32.5, Math.sin(a) * 32.5); }
        S.lines(c, seam, 0.6, s);
        for (let i = 1; i < 10; i += 2) { const a = Math.PI * 0.62 + (i / 10) * Math.PI * 0.76; glowDot(c, x + Math.cos(a) * 25, Math.sin(a) * 25, 1.9, G); }
      } });
    // hooked tusks at the front
    const tusk = [12, 13, 22, 15.5, 31, 11, 33.5, 5.5, 30, 7.5, 24, 10.5, 15, 9.5];
    parts.push({ z0: NZ - 2, z1: NZ + 4, side: boneS, top: '#fbf2dc', ao: 0.3,
      shape: (c, zt) => { const k = 1 - 0.15 * zt; S.poly(c, tf(tusk.map((v) => v * k), hx - 2, 0, 0)); S.poly(c, tf(tusk.map((v, i) => (i % 2 ? -v : v) * k), hx - 2, 0, 0)); },
      detail: (c) => { S.lines(c, 'rgba(60,30,20,0.5)', 0.45, [hx + 20, 13.4, hx + 26, 11, hx + 20, -13.4, hx + 26, -11]); } });
    return { r: 40, h: NZ + 10, parts, style: 'unit' };
  };

  /* Kharad body segment: drawn unrotated in a trailing chain, so it is radially
   * symmetric — a domed, bone-ridged carapace ring with glowing seams. */
  M.boKharadSeg = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#2e2a33', B = pal.b || '#5c5462', T = pal.t || '#eadcbc', G = pal.g || '#ffcc44';
    const R = (opt.rad || 13);
    const boneS = mix(T, A, 0.5);
    const parts = [
      { z0: 0, z1: 8, side: A, top: B, ao: 0.5, shape: (c, zt) => S.circ(c, 0, 0, R * (1 - 0.05 * zt)) },
      { z0: 8, z1: 8.5, side: '#7a3a10', top: G, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, R * 0.98) },
      { z0: 8.5, z1: 13, side: boneS, top: T, ao: 0.35, shape: (c, zt) => S.star(c, 0, 0, R * 1.04 * (1 - 0.12 * zt), R * 0.86 * (1 - 0.12 * zt), 11, 0.15),
        detail: (c) => { const s = []; for (let i = 0; i < 11; i++) { const a = 0.15 + (i / 11) * TAU; s.push(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45, Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86); } S.lines(c, 'rgba(20,14,16,0.5)', 0.45, s); } },
      { z0: 13, z1: 16, side: boneS, top: sh(T, 0.08), ao: 0.3, shape: (c, zt) => S.poly(c, ngon(0, 0, R * 0.5 * (1 - 0.2 * zt), 7, 0.2)),
        detail: (c) => { glowDot(c, 0, 0, R * 0.2, G); S.lines(c, 'rgba(255,255,255,0.4)', 0.45, [-R * 0.35, -R * 0.2, -R * 0.1, -R * 0.42]); } },
    ];
    return { r: R + 3, h: 17, parts, style: 'unit' };
  };
})(window.AS);
