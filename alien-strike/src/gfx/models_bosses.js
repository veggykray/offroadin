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
  // shift the current drawing up the screen by dz world units (draw at another height)
  function liftZ(c, dz) { const T = c.getTransform(); c.setTransform(T.a, T.b, T.c, T.d, T.e, T.f - dz * Math.hypot(T.a, T.b)); }
  // screen-space depth of an object-space point (> 0: nearer the viewer / lower on screen)
  function scrY(c, x, y) { const T = c.getTransform(); return T.b * x + T.d * y; }
  // slice of an ellipse between x0 and x1 (for bands across a dome)
  function ellStrip(c, cx, cy, rx, ry, x0, x1, n) {
    const a0 = Math.max(x0, cx - rx), a1 = Math.min(x1, cx + rx);
    if (a1 <= a0) return;
    n = n || 8; const pts = [];
    for (let i = 0; i <= n; i++) { const x = a0 + (a1 - a0) * i / n, u = (x - cx) / rx; pts.push(x, cy + ry * Math.sqrt(Math.max(0, 1 - u * u))); }
    for (let i = n; i >= 0; i--) { const x = a0 + (a1 - a0) * i / n, u = (x - cx) / rx; pts.push(x, cy - ry * Math.sqrt(Math.max(0, 1 - u * u))); }
    S.poly(c, pts);
  }
  // tapering ribbon along a polyline [x,y,...] from width w0 to w1
  function ribbon(c, pts, w0, w1) {
    const n = pts.length / 2, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let dx = pts[i1 * 2] - pts[i0 * 2], dy = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
      L.push(pts[i * 2] - dy * w, pts[i * 2 + 1] + dx * w); R.unshift(pts[i * 2] + dy * w, pts[i * 2 + 1] - dx * w);
    }
    S.poly(c, L.concat(R));
  }

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

  /* ==================================================================
   * W3 — THE HIVE QUEEN. A huge flying matriarch: a bloated, banded egg-sac
   * abdomen glowing from within, an armoured thorax, two pairs of veined
   * translucent wings beating across the cycle (raised = foreshortened and
   * lifted), a crown of thorn plates behind the head and hooked mandibles.
   * ================================================================== */
  M.boQueen = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#4a3a5a', B = pal.b || '#8a6aa0', T = pal.t || '#e0c0ff', G = pal.g || '#ffef4a', D = pal.d || '#1a1020';
    const chS = mix(A, D, 0.3), chT = mix(B, A, 0.25);
    const wingCol = C.hex(opt.wingCol || '#e4d8f8');
    const eye = '#ff3a6a';
    const parts = [];
    // abdomen
    const acx = -30, arx = 36, ary = 26, AZ0 = 5, AZ1 = 25;
    const dk = (zt) => Math.sqrt(1 - zt * zt * 0.72);
    // dangling legs (seen under the body in flight)
    const legs = [[8, 9, 20, 24, 26, 30], [15, 9, 30, 22, 40, 27], [22, 8, 38, 16, 48, 18]];
    parts.push({ z0: 1, z1: 2, side: D, top: chS, stroke: 2.2, bevel: false,
      shape: (c) => { for (const l of legs) for (const sg of [1, -1]) { c.moveTo(l[0], l[1] * sg); c.lineTo(l[2], l[3] * sg); c.lineTo(l[4], l[5] * sg); } } });
    // ovipositor tail spike
    parts.push({ z0: 6, z1: 13, side: chS, top: chT, ao: 0.3,
      shape: (c, zt) => { const k = 1 - 0.5 * zt; S.poly(c, [acx - arx + 6, -6 * k, acx - arx - 14 + zt * 6, 0, acx - arx + 6, 6 * k]); } });
    // glowing egg sac
    parts.push({ z0: AZ0, z1: AZ1, side: mix(G, '#b05a10', 0.45), top: G, ao: 0.55,
      shape: (c, zt) => { const k = dk(zt); S.ell(c, acx, 0, arx * k, ary * k); },
      detail: (c) => {
        const k = dk(1);
        radial(c, acx + 2, -2, arx * k, [[0, '#fffbe0'], [0.5, C.str(G, 0.6)], [1, C.str(G, 0)]]);
        for (let i = 0; i < 9; i++) { const x = acx - 14 + U.hash2(i, 1, 9) * 28, y = (U.hash2(i, 2, 9) - 0.5) * 14; S.dot(c, 'rgba(160,90,10,0.45)', x, y, 1.6); S.dot(c, '#fffbe0', x - 0.4, y - 0.4, 0.6); }
      } });
    // chitin bands across the sac (slightly proud of it)
    const bands = [[-62, -54], [-46, -37], [-28, -19], [-10, -2]];
    parts.push({ z0: AZ0 - 1, z1: AZ1 + 1, side: chS, top: chT, ao: 0.4,
      shape: (c, zt) => { const k = dk(zt * 0.97) * 1.05; for (const b of bands) ellStrip(c, acx, 0, arx * k, ary * k, b[0], b[1], 8); },
      detail: (c) => { const k = dk(1) * 1.05; for (const b of bands) { const x = (b[0] + b[1]) / 2; S.lines(c, 'rgba(255,255,255,0.3)', 0.5, [x - 1, -ary * k * 0.8, x - 1, -ary * k * 0.2]); } } });
    // wings: drawn as translucent membranes, raised and foreshortened across the beat
    function wing(c, rx, ry, ang, L, wd, f, lift, ghost) {
      const loc = [0, -1.5, L * 0.28, -wd * 0.8, L * 0.7, -wd, L * 0.96, -wd * 0.45, L, wd * 0.1, L * 0.82, wd * 0.62, L * 0.4, wd * 0.6, 0, 1.5];
      const pts = [], ca = Math.cos(ang), sa = Math.sin(ang);
      for (let i = 0; i < loc.length; i += 2) { const u = loc[i] * f, v = loc[i + 1]; pts.push(rx + u * ca - v * sa, ry + u * sa + v * ca); }
      c.save(); liftZ(c, lift);
      const tip = [rx + L * f * ca, ry + L * f * sa];
      const g = c.createLinearGradient(rx, ry, tip[0], tip[1]);
      g.addColorStop(0, C.str(wingCol, ghost ? 0.12 : 0.72)); g.addColorStop(1, C.str(wingCol, ghost ? 0.05 : 0.42));
      c.fillStyle = g; c.beginPath(); S.poly(c, pts); c.fill();
      if (!ghost) {
        c.strokeStyle = C.str(sh(A, -0.1), 0.85); c.lineWidth = 0.55; c.stroke();
        const vs = [];
        for (const t of [[0.7, -0.75], [0.98, -0.2], [0.85, 0.45], [0.45, 0.5]]) { const u = L * t[0] * f, v = wd * t[1]; vs.push(rx, ry, rx + u * ca - v * sa, ry + u * sa + v * ca); }
        const m1 = [L * 0.35 * f, -wd * 0.35], m2 = [L * 0.6 * f, wd * 0.25];
        vs.push(rx + m1[0] * ca - m1[1] * sa, ry + m1[0] * sa + m1[1] * ca, rx + m2[0] * ca - m2[1] * sa, ry + m2[0] * sa + m2[1] * ca);
        S.lines(c, C.str(sh(A, -0.2), 0.7), 0.4, vs);
        S.dot(c, C.str(G, 0.9), rx + L * 0.78 * f * ca, ry + L * 0.78 * f * sa, 1.1);
      }
      c.restore();
    }
    parts.push({ z0: 21, z1: 21, side: chS, top: chS, flat: true, bevel: false,
      shape: () => {},
      detail: (c, an) => {
        for (const sg of [1, -1]) {
          const fH = 0.6 + 0.4 * Math.cos((an + 0.1) * TAU), fF = 0.6 + 0.4 * Math.cos(an * TAU);
          if (fF < 0.5) wing(c, 15, 6 * sg, sg * (Math.PI / 2 + 0.38), 56, 10, 1, 0, true);
          wing(c, 11, 6 * sg, sg * (Math.PI / 2 + 0.95), 42, 8, fH, (1 - fH) * 12);
          wing(c, 16, 6 * sg, sg * (Math.PI / 2 + 0.38), 56, 10, fF, (1 - fF) * 14);
        }
      } });
    // thorax
    parts.push({ z0: 8, z1: 22, side: chS, top: chT, ao: 0.45,
      shape: (c, zt) => { const k = Math.sqrt(1 - zt * zt * 0.6); S.ell(c, 13, 0, 14 * k, 11.5 * k); },
      detail: (c) => {
        S.lines(c, 'rgba(10,6,16,0.5)', 0.5, [4, 0, 22, 0, 8, -5, 18, -4, 8, 5, 18, 4]);
        S.dot(c, C.str(G, 0.9), 10, -3, 1.2); S.dot(c, C.str(G, 0.9), 10, 3, 1.2);
        S.lines(c, 'rgba(255,255,255,0.35)', 0.6, [6, -6, 14, -7.5]);
      } });
    // head + mandibles
    parts.push({ z0: 9, z1: 18, side: chS, top: chT, ao: 0.4,
      shape: (c, zt) => { const k = Math.sqrt(1 - zt * zt * 0.55); S.ell(c, 32, 0, 9.5 * k, 9 * k); } });
    parts.push({ z0: 10, z1: 13, side: D, top: mix(T, chT, 0.4), ao: 0.3,
      shape: (c) => { for (const sg of [1, -1]) S.poly(c, [36, 5 * sg, 44, 7.5 * sg, 50, 3.5 * sg, 47, 0.8 * sg, 44, 3.8 * sg, 37, 2 * sg]); } });
    parts.push({ z0: 15.5, z1: 17, side: '#801030', top: eye, flat: true, bevel: false,
      shape: (c) => { S.ell(c, 35, -5, 3.2, 2.3, 0.5); S.ell(c, 35, 5, 3.2, 2.3, -0.5); },
      detail: (c) => { S.dot(c, '#ffd0dc', 35.6, -5.6, 0.8); S.dot(c, '#ffd0dc', 35.6, 4.4, 0.8); } });
    // crown of thorn plates fanning behind the head
    const th = [];
    for (let i = 0; i < 7; i++) th.push([Math.PI * (0.62 + i * 0.127), i === 3 ? 22 : (i % 2 ? 17 : 19)]);
    parts.push({ z0: 14, z1: 30, side: mix(A, T, 0.25), top: T, ao: 0.35,
      shape: (c, zt) => {
        for (const t of th) {
          const len = t[1], d = 6 + len * 0.55 * zt, w = 2.8 * (1 - zt) + 0.4, l = 3.6 * (1 - zt * 0.7) + 0.5;
          const ca = Math.cos(t[0]), sa = Math.sin(t[0]), px = 31 + ca * d, py = sa * d;
          S.poly(c, [px + ca * l, py + sa * l, px - sa * w, py + ca * w, px - ca * l, py - sa * l, px + sa * w, py - ca * w]);
        }
      } });
    return { r: 62, h: 46, parts, style: 'unit' };
  };

  /* ==================================================================
   * W4 — THE PRISM COLOSSUS. A crystal titan: four leaning crystal legs on a
   * cracked ice plinth, a lattice of six huge prisms leaning out around a
   * pulsing refractive core, a crowning spire, and a halo of eight floating
   * shards that turns across the cycle. Back/front halves of the lattice are
   * chosen per heading so the core always sits between them.
   * ================================================================== */
  M.boPrism = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#2a3c7c', B = pal.b || '#6a8ee0', T = pal.t || '#e4fbff', G = pal.g || '#7ff6ff', D = pal.d || '#141c3a';
    const iceS = mix(D, A, 0.45), iceT = mix(A, '#8aa4cc', 0.35);
    const parts = [];
    // cracked ice plinth
    parts.push({ z0: 0, z1: 3, side: iceS, top: iceT, ao: 0.4,
      shape: (c) => S.blob(c, 0, 0, 40, 41, 12, 0.18),
      detail: (c) => {
        const cr = [];
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2, r1 = 22 + U.hash2(i, 1, 4) * 6, r2 = 36; cr.push(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a + 0.12) * r2, Math.sin(a + 0.12) * r2); }
        S.lines(c, C.str(G, 0.35), 1.4, cr); S.lines(c, '#e8ffff', 0.4, cr);
      } });
    // legs: heavy hex crystals leaning in from the feet to the hips
    const legs = [[24, 26], [24, -26], [-24, 26], [-24, -26]];
    parts.push({ z0: 2, z1: 24, side: A, top: B, ao: 0.35,
      shape: (c, zt) => { for (const l of legs) S.poly(c, hexPts(l[0] * (1 - 0.5 * zt), l[1] * (1 - 0.5 * zt), 8 - 2.5 * zt, 0.3)); },
      detail: (c) => { for (const l of legs) facetCap(c, hexPts(l[0] * 0.5, l[1] * 0.5, 5.5, 0.3), l[0] * 0.5, l[1] * 0.5, C.hex(B), 0.35, 'rgba(230,255,255,0.4)'); } });
    // lattice prisms (angle, height)
    const PZ0 = 12, PZ1 = 62;
    const pr = [[0.5, 54, 7], [1.55, 46, 6.5], [2.6, 58, 7.5], [3.65, 48, 6.5], [4.7, 60, 7], [5.75, 44, 6.5]];
    const pPos = (p, z) => { const t = (z - PZ0) / (p[1] - PZ0), d = 13 + t * 12; return [Math.cos(p[0]) * d, Math.sin(p[0]) * d]; };
    const pRad = (p, z) => { const t = (z - PZ0) / (p[1] - PZ0); return p[2] * (t < 0.72 ? 1 : 1 - (t - 0.72) * 1.6); };
    const lattice = (front) => ({ z0: PZ0, z1: PZ1, side: A, top: B, ao: 0.45,
      shape: (c, zt) => {
        const z = PZ0 + (PZ1 - PZ0) * zt;
        for (const p of pr) {
          if (z > p[1]) continue;
          const b = pPos(p, PZ0); if ((scrY(c, b[0], b[1]) > 0) !== front) continue;
          const q = pPos(p, z); S.poly(c, hexPts(q[0], q[1], pRad(p, z), p[0]));
        }
      },
      detail: (c) => {
        for (const p of pr) {
          const b = pPos(p, PZ0); if ((scrY(c, b[0], b[1]) > 0) !== front) continue;
          c.save(); liftZ(c, p[1] - PZ1);
          const q = pPos(p, p[1]), r = pRad(p, p[1]);
          facetCap(c, hexPts(q[0], q[1], r, p[0]), q[0] + Math.cos(p[0]) * r * 0.5, q[1] + Math.sin(p[0]) * r * 0.5, C.hex(B), 0.45, 'rgba(230,255,255,0.55)');
          c.restore();
        }
      } });
    // floating shard halo, turning over the cycle
    const halo = (front) => ({ z0: 34, z1: 40, side: A, top: T, ao: 0.3,
      shape: (c, zt, an) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + an * (TAU / 8), x = Math.cos(a) * 38, y = Math.sin(a) * 38;
          if ((scrY(c, x, y) > 0) !== front) continue;
          const k = 1 - Math.abs(zt - 0.4) * 1.3, L = 7 * k + 0.6, w = 2.4 * k + 0.3;
          S.poly(c, [x + Math.cos(a) * L, y + Math.sin(a) * L, x - Math.sin(a) * w, y + Math.cos(a) * w, x - Math.cos(a) * L * 0.6, y - Math.sin(a) * L * 0.6, x + Math.sin(a) * w, y - Math.cos(a) * w]);
        }
      } });
    parts.push(halo(false));
    parts.push(lattice(false));
    // the core: a pulsing refractive heart between the prisms
    parts.push({ z0: 16, z1: 44, side: mix(G, A, 0.35), top: G, flat: true, bevel: false,
      shape: (c, zt, an) => { const r = (12 + 1.6 * Math.sin(an * TAU)) * Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 1.6 - 0.9, 2))); S.circ(c, 0, 0, r); },
      detail: (c, an) => {
        const r = (12 + 1.6 * Math.sin(an * TAU)) * 0.9;
        radial(c, 0, 0, r, [[0, '#ffffff'], [0.35, '#d8ffff'], [0.7, G], [1, C.str(G, 0.2)]]);
        c.save(); c.globalAlpha = 0.55; c.lineWidth = 0.9;
        const rb = ['#ff7ad8', '#ffe27a', '#7affb0'];
        for (let i = 0; i < 3; i++) { c.strokeStyle = rb[i]; c.beginPath(); c.arc(0, 0, r * (0.55 + i * 0.12), i * 2 + an * TAU, i * 2 + an * TAU + 1.3); c.stroke(); }
        c.restore();
      } });
    parts.push(lattice(true));
    // crowning spire above the core
    parts.push({ z0: 42, z1: 74, side: A, top: B, ao: 0.3,
      shape: (c, zt) => S.poly(c, hexPts(0, 0, 7 * (zt < 0.7 ? 1 - zt * 0.25 : (1 - 0.175) * (1 - (zt - 0.7) * 2.2)), 0)),
      detail: (c) => facetCap(c, hexPts(0, 0, 7 * 0.825 * 0.34, 0), -0.5, -0.5, C.hex(T), 0.4, 'rgba(230,255,255,0.6)') });
    parts.push(halo(true));
    return { r: 50, h: 76, parts, style: 'unit' };
  };

  /* ==================================================================
   * W5 — THE ABYSSAL REFINERY (dirs 1). A floating Choir refinery: a
   * hexagonal bone-ceramic deck on dark pontoon floats with foam rings, four
   * low sponsons at the pump-turret mounts (+-46, -30 / +34), two ribbed
   * cracking towers, a flare stack with its flame, glowing violet fuel tanks,
   * pipework, and a hazard-ringed hatch at the centre where the exposed core
   * sheet (boRefCore) is drawn 8 units up.
   * ================================================================== */
  M.boRefinery = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#3e3848', B = pal.b || '#c8bca4', T = pal.t || '#e89a3a', G = pal.g || '#c07aff', D = pal.d || '#1a1620';
    const hullS = mix(D, A, 0.4), hullT = mix(A, '#5a5468', 0.4);
    const deckS = mix(A, B, 0.2), deckT = B;
    const DZ = 8;
    const parts = [];
    const sponsons = [[46, -30], [-46, -30], [46, 34], [-46, 34]];
    const floats = [[64, 0], [32, 55], [-32, 55], [-64, 0], [-32, -55], [32, -55]];
    // deck outline: hexagon with round notches around the four sponsons
    const NR = 15.5;
    const deck = [];
    const hx = hexPts(0, 0, 64, 0);
    for (let e = 0; e < 6; e++) {
      const x1 = hx[e * 2], y1 = hx[e * 2 + 1], x2 = hx[((e + 1) % 6) * 2], y2 = hx[((e + 1) % 6) * 2 + 1];
      for (let i = 0; i < 40; i++) {
        let px = x1 + (x2 - x1) * i / 40, py = y1 + (y2 - y1) * i / 40;
        for (const q of sponsons) {
          const dx = px - q[0], dy = py - q[1];
          if (dx * dx + dy * dy < NR * NR) {
            // pull the point toward the centre until it leaves the notch circle
            const L = Math.hypot(px, py);
            for (let t = 1; t > 0.3; t -= 0.01) { const qx = px * t - q[0], qy = py * t - q[1]; if (qx * qx + qy * qy >= NR * NR) { px *= t; py *= t; break; } }
            void L;
          }
        }
        deck.push(px, py);
      }
    }
    // foam / ripple rings on the water
    parts.push({ z0: 0, z1: 0, side: '#ffffff', top: '#ffffff', flat: true, bevel: false, shape: () => {},
      detail: (c) => {
        c.save(); c.lineWidth = 1.4; c.strokeStyle = 'rgba(220,250,255,0.5)';
        for (const f of floats) { c.beginPath(); c.arc(f[0], f[1], 13.5, 0, TAU); c.stroke(); }
        for (const f of sponsons) { c.beginPath(); c.arc(f[0], f[1], 14.5, 0, TAU); c.stroke(); }
        c.lineWidth = 0.8; c.strokeStyle = 'rgba(220,250,255,0.26)';
        for (const f of floats) { c.beginPath(); c.arc(f[0], f[1], 17.5, 0, TAU); c.stroke(); }
        c.restore();
      } });
    // pontoon floats under the deck corners
    parts.push({ z0: 0, z1: 6, side: hullS, top: hullT, ao: 0.5,
      shape: (c) => { for (const f of floats) S.circ(c, f[0], f[1], 11); },
      detail: (c) => { for (const f of floats) S.lines(c, cs(T), 1, [f[0] - 6, f[1] + 6, f[0] + 6, f[1] + 6]); } });
    // low sponsons for the pump turrets
    parts.push({ z0: 0, z1: 3, side: hullS, top: mix(A, B, 0.3), ao: 0.4,
      shape: (c) => { for (const f of sponsons) S.circ(c, f[0], f[1], 13); },
      detail: (c) => { for (const f of sponsons) { c.save(); c.strokeStyle = cs(T); c.lineWidth = 1.3; c.setLineDash([2, 2]); c.beginPath(); c.arc(f[0], f[1], 11, 0, TAU); c.stroke(); c.restore(); } } });
    // main deck
    parts.push({ z0: 3, z1: DZ, side: deckS, top: deckT, ao: 0.5,
      shape: (c) => S.poly(c, deck),
      detail: (c) => {
        const seams = [];
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; seams.push(Math.cos(a) * 21, Math.sin(a) * 21, Math.cos(a) * 44, Math.sin(a) * 44); }
        S.lines(c, 'rgba(60,44,40,0.35)', 0.5, seams);
        c.save(); c.strokeStyle = 'rgba(60,44,40,0.3)'; c.lineWidth = 0.5; c.beginPath(); S.poly(c, hexPts(0, 0, 44, 0)); c.stroke(); c.restore();
        // pipe runs: tanks and towers feed the core hatch
        const pipes = [[30, -16, 14, -6], [38, 14, 15, 6], [14, 36, 6, 15], [-30, -22, -13, -8], [-42, 8, -15, 3], [30, -16, 30, -46], [-22, 36, -6, 16]];
        for (const p of pipes) { S.lines(c, cs(sh(A, -0.15)), 2.8, p); S.lines(c, 'rgba(255,255,255,0.32)', 0.7, [p[0] - 0.6, p[1] - 0.6, p[2] - 0.6, p[3] - 0.6]); }
        // hazard trim along the deck edge
        c.save(); c.strokeStyle = cs(T); c.lineWidth = 1.5; c.setLineDash([3, 2.4]); c.beginPath(); S.poly(c, deck.map((v) => v * 0.955)); c.stroke(); c.restore();
      } });
    // core hatch ring (the core sheet sits on it)
    parts.push({ z0: DZ, z1: DZ + 2, side: hullS, top: hullT, ao: 0.3,
      shape: (c) => { S.poly(c, ngon(0, 0, 19, 8, 0.39)); c.moveTo(13, 0); c.arc(0, 0, 13, TAU, 0, true); },
      detail: (c) => {
        radial(c, 0, 0, 13, [[0, C.str(G, 0.9)], [0.6, C.str(sh(G, -0.4), 0.8)], [1, cs(D)]]);
        c.save(); c.strokeStyle = cs(T); c.lineWidth = 2; c.setLineDash([2.2, 2.2]); c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.stroke(); c.restore();
      } });
    // glowing violet fuel tanks on cradles
    const tanks = [[32, -16, 11], [40, 14, 10], [14, 38, 10], [-22, 38, 9]];
    parts.push({ z0: DZ, z1: DZ + 3, side: hullS, top: hullT, ao: 0.3,
      shape: (c) => { for (const t of tanks) S.circ(c, t[0], t[1], t[2] + 1.5); } });
    parts.push({ z0: DZ + 1, z1: DZ + 16, side: mix(G, D, 0.55), top: mix(G, '#ffffff', 0.15), ao: 0.45,
      shape: (c, zt) => { for (const t of tanks) S.circ(c, t[0], t[1], t[2] * Math.sqrt(1 - zt * zt * 0.7)); },
      detail: (c) => {
        for (const t of tanks) {
          const r = t[2] * Math.sqrt(0.3);
          glowDot(c, t[0] - r * 0.2, t[1] - r * 0.2, r * 1.4, G, '#ffffff');
          S.lines(c, 'rgba(30,10,50,0.55)', 0.6, [t[0] - r, t[1], t[0] + r, t[1], t[0], t[1] - r, t[0], t[1] + r]);
        }
      } });
    // two ribbed cracking towers
    const towers = [[-30, -22, 9, 56], [-42, 8, 7, 46]];
    parts.push({ z0: DZ, z1: DZ + 56, side: mix(A, B, 0.35), top: mix(B, '#ffffff', 0.1), ao: 0.5,
      shape: (c, zt) => {
        const z = zt * 56;
        for (const t of towers) { if (z > t[3]) continue; const rib = (z % 9) < 1.6 ? 1.3 : 0; S.circ(c, t[0], t[1], t[2] + rib - (z > t[3] - 4 ? (z - t[3] + 4) * 0.6 : 0)); }
      },
      detail: (c) => {
        for (const t of towers) { c.save(); liftZ(c, t[3] - 56); const r = t[2] - 2.4; S.dot(c, cs(D), t[0], t[1], r * 0.8); glowDot(c, t[0], t[1], r * 0.7, T, '#fff2c0'); c.restore(); }
      } });
    // flare stack at the back edge with its flame
    const fx = 30, fy = -48;
    parts.push({ z0: DZ, z1: DZ + 58, side: mix(A, B, 0.2), top: B, ao: 0.4,
      shape: (c, zt) => { S.circ(c, fx, fy, 3.4 - zt * 1.3); if (zt < 0.05) S.circ(c, fx, fy, 6.5); if (Math.abs(zt - 0.5) < 0.02) S.circ(c, fx, fy, 4.4); } });
    parts.push({ z0: DZ + 57, z1: DZ + 74, side: '#ff5a10', top: '#fff2a0', flat: true, bevel: false,
      shape: (c, zt) => { const r = zt < 0.25 ? 2.5 + zt * 11 : 5.2 * (1 - (zt - 0.25) / 0.75) + 0.3; S.circ(c, fx + zt * 2, fy, r); },
      detail: (c) => glowDot(c, fx + 2, fy, 3, '#ffb040', '#ffffff') });
    // gantry crane at the front-left, boom out over the water
    parts.push({ z0: DZ, z1: DZ + 28, side: hullS, top: T, ao: 0.4, shape: (c) => S.rrect(c, -36, 22, 7, 7, 1) });
    parts.push({ z0: DZ + 26, z1: DZ + 29, side: mix(T, A, 0.4), top: T, ao: 0.3,
      shape: (c) => S.poly(c, [-38, 22, -30, 21, -62, 56, -66, 54]),
      detail: (c) => { const s = []; for (let i = 0; i < 5; i++) { const u = 0.15 + i * 0.17; s.push(-34 - u * 30, 22 + u * 33, -31 - u * 30, 22 + u * 32); } S.lines(c, 'rgba(40,20,10,0.55)', 0.45, s); } });
    return { r: 82, h: 84, parts, style: 'unit' };
  };

  /* Exposed refinery core (dirs 1): a violet reactor orb clasped by six
   * armoured vanes on a dark collar, drawn over the refinery's centre hatch. */
  M.boRefCore = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#3e3848', B = pal.b || '#c8bca4', T = pal.t || '#e89a3a', G = pal.g || '#c07aff', D = pal.d || '#1a1620';
    const parts = [
      { z0: 0, z1: 3, side: mix(D, A, 0.4), top: mix(A, B, 0.2), ao: 0.4, shape: (c) => S.poly(c, ngon(0, 0, 15, 8, 0.39)),
        detail: (c) => { c.save(); c.strokeStyle = cs(T); c.lineWidth = 1.2; c.setLineDash([1.8, 1.8]); c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.stroke(); c.restore(); } },
      { z0: 2, z1: 17, side: mix(G, D, 0.4), top: '#ffffff', flat: true, bevel: false,
        shape: (c, zt) => S.circ(c, 0, 0, 8.5 * Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 2 - 1, 2)))),
        detail: (c) => radial(c, 0, 0, 5, [[0, '#ffffff'], [0.5, mix(G, '#ffffff', 0.5)], [1, C.str(G, 0.3)]]) },
      { z0: 2, z1: 18, side: A, top: B, ao: 0.45,
        shape: (c, zt) => {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + 0.26, d = 10 - zt * 2.5, w = 2.6 * (1 - zt * 0.4), l = 4.4;
            const ca = Math.cos(a), sa = Math.sin(a), x = ca * d, y = sa * d;
            S.poly(c, [x - ca * l * 0.3 - sa * w, y - sa * l * 0.3 + ca * w, x + ca * l - sa * w * 0.6, y + sa * l + ca * w * 0.6, x + ca * l + sa * w * 0.6, y + sa * l - ca * w * 0.6, x - ca * l * 0.3 + sa * w, y - sa * l * 0.3 - ca * w]);
          }
        },
        detail: (c) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; S.dot(c, cs(G), Math.cos(a) * 9, Math.sin(a) * 9, 0.8); } } },
    ];
    return { r: 18, h: 20, parts, style: 'unit' };
  };

  /* ==================================================================
   * W6 — THE FOUNDRY ENGINE. A tracked fortress-factory: twin tread banks
   * with grousers that roll across the cycle, an armoured bronze hull with a
   * hazard-striped dozer ram, a central smelter whose open crucible and
   * front grilles glow (flickering), three ribbed smokestacks and two crane
   * arms reaching forward.
   * ================================================================== */
  M.boFoundry = function (pal, opt) {
    pal = pal || {}; opt = opt || {};
    const A = pal.a || '#5a4632', B = pal.b || '#a8865a', T = pal.t || '#ffb03a', G = pal.g || '#ff7a1a', D = pal.d || '#1a1210';
    const steelS = '#2a2a30', steelT = '#6a6a72';
    const hullS = A, hullT = B;
    const ironS = mix(A, D, 0.45), ironT = mix(A, B, 0.35);
    const parts = [];
    // tread banks
    const TY0 = 28, TY1 = 47, TX0 = -60, TX1 = 56;
    parts.push({ z0: 0, z1: 13, side: steelS, top: steelT, ao: 0.45,
      shape: (c, zt) => { const k = zt < 0.2 ? zt * 10 : 2; for (const sg of [1, -1]) { const y0 = sg > 0 ? TY0 : -TY1; S.rrect(c, TX0 + 2 - k, y0, TX1 - TX0 - 4 + k * 2, TY1 - TY0, 6); } },
      detail: (c, an) => {
        const s = [], off = (an * 6) % 6;
        for (let x = TX0 + 2 + off; x < TX1 - 1; x += 6) for (const sg of [1, -1]) { const y0 = sg > 0 ? TY0 + 1 : -TY1 + 1; s.push(x, y0, x, y0 + TY1 - TY0 - 2); }
        S.lines(c, 'rgba(10,10,14,0.75)', 1.4, s);
        S.lines(c, 'rgba(255,255,255,0.18)', 0.5, s.map((v, i) => (i % 2 === 0 ? v + 1 : v)));
      } });
    // armoured side skirts over the outer tread edge
    parts.push({ z0: 5, z1: 15, side: ironS, top: ironT, ao: 0.35,
      shape: (c) => { for (const sg of [1, -1]) S.poly(c, [TX0 + 10, sg * (TY1 - 1), TX1 - 12, sg * (TY1 - 1), TX1 - 18, sg * (TY1 + 3), TX0 + 14, sg * (TY1 + 3)]); },
      detail: (c) => { for (const sg of [1, -1]) { const s = []; for (let x = TX0 + 22; x < TX1 - 16; x += 16) s.push(x, sg * (TY1 - 1), x, sg * (TY1 + 3)); S.lines(c, 'rgba(0,0,0,0.45)', 0.5, s); } } });
    // hull
    parts.push({ z0: 4, z1: 20, side: hullS, top: hullT, ao: 0.45,
      shape: (c) => S.poly(c, [-58, -27, 44, -27, 54, -18, 54, 18, 44, 27, -58, 27]),
      detail: (c) => {
        S.lines(c, 'rgba(30,18,10,0.45)', 0.5, [-58, -10, 54, -10, -58, 10, 54, 10, 18, -27, 18, 27, -30, -27, -30, 27]);
        const rv = [];
        for (let x = -54; x < 50; x += 8) rv.push([x, -24.5], [x, 24.5]);
        for (const p of rv) S.dot(c, 'rgba(40,24,10,0.6)', p[0], p[1], 0.55);
        // hazard chevrons on the bow
        c.save(); c.beginPath(); S.poly(c, [44, -26, 53, -17, 53, 17, 44, 26, 40, 26, 40, -26]); c.clip();
        c.fillStyle = cs(T); c.fillRect(38, -28, 18, 56);
        c.fillStyle = 'rgba(20,14,10,0.9)';
        for (let y = -32; y < 30; y += 7) { c.beginPath(); c.moveTo(38, y); c.lineTo(56, y + 9); c.lineTo(56, y + 12.5); c.lineTo(38, y + 3.5); c.fill(); }
        c.restore();
      } });
    // dozer ram
    parts.push({ z0: 0, z1: 12, side: steelS, top: '#8a8a92', ao: 0.4,
      shape: (c, zt) => S.poly(c, [54, -44, 62 + zt * 2, -40, 68 + zt * 2, -16, 70 + zt * 2, 0, 68 + zt * 2, 16, 62 + zt * 2, 40, 54, 44, 58, 0]),
      detail: (c) => { const s = []; for (let y = -36; y <= 36; y += 8) s.push(64, y, 71, y * 1.02); S.lines(c, 'rgba(20,20,24,0.6)', 0.6, s); S.lines(c, 'rgba(255,255,255,0.4)', 0.6, [63, -40, 69, -16]); } });
    // smelter house
    const SX = -8, SR = 22, SZ0 = 20, SZ1 = 38;
    const smOct = ngon(SX, 0, SR, 8, Math.PI / 8);
    parts.push({ z0: SZ0, z1: SZ1, side: ironS, top: ironT, ao: 0.5,
      shape: (c, zt) => S.poly(c, ngon(SX, 0, SR - zt * 2, 8, Math.PI / 8)),
      detail: (c) => {
        const s = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * TAU; s.push(SX + Math.cos(a) * 14, Math.sin(a) * 14, SX + Math.cos(a) * 19.6, Math.sin(a) * 19.6); }
        S.lines(c, 'rgba(20,10,6,0.5)', 0.6, s);
      } });
    // glowing grilles on the camera-facing walls of the smelter
    parts.push({ z0: SZ0 + 4, z1: SZ1 - 5, side: '#c03a08', top: G, flat: true, bevel: false,
      shape: (c, zt, an) => {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU, d = SR * Math.cos(Math.PI / 8) - zt * 2 + 0.35, x = SX + Math.cos(a) * d, y = Math.sin(a) * d;
          if (scrY(c, x - SX, y) < 3) continue;
          for (const o of [-4.5, 0, 4.5]) { const px = x - Math.sin(a) * o, py = y + Math.cos(a) * o; S.poly(c, [px - Math.sin(a) * 1.2, py + Math.cos(a) * 1.2, px + Math.sin(a) * 1.2, py - Math.cos(a) * 1.2, px + Math.sin(a) * 1.2 - Math.cos(a) * 0.6, py - Math.cos(a) * 1.2 - Math.sin(a) * 0.6, px - Math.sin(a) * 1.2 - Math.cos(a) * 0.6, py + Math.cos(a) * 1.2 - Math.sin(a) * 0.6]); }
        }
      } });
    // open crucible on top of the smelter (weak point)
    parts.push({ z0: SZ1, z1: SZ1 + 4, side: steelS, top: '#5a5458', ao: 0.3,
      shape: (c) => { S.circ(c, SX, 0, 15); c.moveTo(SX + 11, 0); c.arc(SX, 0, 11, TAU, 0, true); },
      detail: (c, an) => {
        const fl = 0.85 + 0.15 * Math.sin(an * TAU * 2);
        radial(c, SX, 0, 11, [[0, '#fffbe0'], [0.3 * fl, '#ffd04a'], [0.7, G], [1, '#801a04']]);
        crack(c, [SX - 7, -2, SX - 3, 1, SX + 2, -1, SX + 6, 2], 'rgba(120,30,4,0.7)', 0.6);
        S.lines(c, cs(T), 0.9, [SX - 14, -3, SX - 11, -3, SX + 11, 3, SX + 14, 3]);
      } });
    // smokestacks (ribbed)
    const stacks = [[-44, -15, 5.5, 58], [-50, 6, 5, 52], [-38, 18, 4.5, 46]];
    parts.push({ z0: 16, z1: 58, side: ironS, top: ironT, ao: 0.4,
      shape: (c, zt) => { const z = 16 + zt * 42; for (const s of stacks) { if (z > s[3]) continue; S.circ(c, s[0], s[1], s[2] + ((z % 8) < 1.5 ? 1.1 : 0) + (z > s[3] - 3 ? 0.8 : 0)); } },
      detail: (c, an) => {
        for (const s of stacks) { c.save(); liftZ(c, s[3] - 58); S.dot(c, '#140c08', s[0], s[1], s[2] * 0.75); glowDot(c, s[0], s[1], s[2] * 0.7, G, ['#ffe0a0', '#ffd080', '#fff0c0', '#ffc070'][Math.floor(an * 4) % 4]); c.restore(); }
      } });
    // crane arms reaching forward
    const pivots = [[24, -17], [24, 17]];
    parts.push({ z0: 20, z1: 28, side: steelS, top: steelT, ao: 0.35,
      shape: (c) => { for (const p of pivots) S.circ(c, p[0], p[1], 5); } });
    parts.push({ z0: 25, z1: 29, side: mix(T, A, 0.45), top: T, ao: 0.3,
      shape: (c) => { for (const sg of [1, -1]) S.poly(c, [22, sg * 14, 28, sg * 13, 58, sg * 30, 62, sg * 36, 58, sg * 38, 22, sg * 20]); },
      detail: (c) => {
        for (const sg of [1, -1]) {
          const s = []; for (let i = 0; i < 5; i++) { const u = 0.15 + i * 0.17; s.push(25 + u * 33, sg * (14 + u * 16), 27 + u * 33, sg * (19 + u * 17)); }
          S.lines(c, 'rgba(40,20,6,0.55)', 0.5, s);
          S.dot(c, cs(steelS), 24, sg * 17, 2.2); S.dot(c, '#9a9aa2', 23.4, sg * 16.4, 0.8);
        }
      } });
    // claws
    parts.push({ z0: 18, z1: 27, side: steelS, top: '#9a9aa2', ao: 0.35,
      shape: (c, zt) => { for (const sg of [1, -1]) S.poly(c, [58, sg * 32, 68, sg * (34 - zt * 2), 72, sg * 40, 66, sg * 38, 62, sg * 42, 56, sg * 38]); } });
    return { r: 74, h: 60, parts, style: 'unit' };
  };
})(window.AS);
