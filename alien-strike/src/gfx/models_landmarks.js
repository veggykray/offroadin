/* ALIEN STRIKE — landmark set pieces (large single-frame models placed by
 * src/game/landmarks.js and a few scenery structures). Each generator returns a
 * stacked model in object space (+x = long axis / front). Sizes are world units.
 *   crashShip      crashed starship broken into sections (variant colony | choir)
 *   skeleton       giant fossil (kind beast | worm)
 *   colonyRuins    ruined frontier settlement block (seed)
 *   monolith       carved Choir monolith (h, broken, lean, seed)
 *   choirTower     alien spire with floating halos and a glowing crown
 *   industrialStacks refinery / foundry stacks, tanks and pipe gantry
 *   crystalCluster giant crystal outcrop
 *   giantShrooms   cluster of giant glowing mushrooms
 *   giantGear      colossal half-buried tilted gear + broken pipes
 *   convoyHulk     burned-out convoy truck / crawler (seed variants)
 *   drownedTower   drowned skyscraper top breaking the water (helipad, seed) */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------------------------------------------------------------- helpers */
  const P = (p, d) => Object.assign({ a: '#7d8288', b: '#b9bec4', t: '#d08a2a', g: '#7fe8ff', d: '#33363a' }, d || {}, p || {});
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const SEAM = 'rgba(16,14,12,0.42)', SEAM_L = 'rgba(255,255,255,0.22)';
  const res = () => (AS.Forge && AS.Forge.res) || 2;
  const dzOf = (z0, z1) => (z1 - z0) / Math.max(1, Math.round((z1 - z0) * res()));

  /* rotate (a) then translate (ox, oy) a flat point list */
  function tf(pts, ox, oy, a) {
    const ca = Math.cos(a || 0), sa = Math.sin(a || 0), out = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { out[i] = ox + pts[i] * ca - pts[i + 1] * sa; out[i + 1] = oy + pts[i] * sa + pts[i + 1] * ca; }
    return out;
  }
  const scaleY = (pts, k) => pts.map((v, i) => (i % 2 ? v * k : v));
  /* clip a polygon to x <= X (Sutherland-Hodgman, one plane) */
  function clipX(pts, X) {
    const out = [], n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = pts[i * 2], ay = pts[i * 2 + 1], j = (i + 1) % n, bx = pts[j * 2], by = pts[j * 2 + 1];
      const ain = ax <= X, bin = bx <= X;
      if (ain) out.push(ax, ay);
      if (ain !== bin) { const t = (X - ax) / (bx - ax); out.push(X, ay + (by - ay) * t); }
    }
    return out;
  }
  const polyOK = (c, pts) => { if (pts.length >= 6) S.poly(c, pts); };
  function scorch(c, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(14,10,8,' + (a || 0.8) + ')'); g.addColorStop(0.55, 'rgba(26,20,16,' + (a || 0.8) * 0.5 + ')'); g.addColorStop(1, 'rgba(26,20,16,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function glowDot(c, col, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(col, a === undefined ? 0.9 : a)); g.addColorStop(1, C.str(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  /* Arch ribs as one stroked part: each rib {x, y, nx, ny, w, h, sx, sy} rises from
   * base points (x,y) ± n·w to an apex at height h over (x,y) (+ sweep s·(1-z/h)).
   * Draws the slice of every rib between z and z+dz so near-horizontal crowns stay solid. */
  function archPart(ribs, z1, stroke, side, top, extra) {
    const dz = dzOf(0, z1);
    const at = (r, z) => {
      const q = U.clamp(z / r.h, 0, 1), d = r.w * Math.sqrt(Math.max(0, 1 - q * q)) * (r.bulge ? 1 + r.bulge * Math.sin(q * Math.PI) : 1);
      const s = 1 - q;
      return [r.x + (r.sx || 0) * s, r.y + (r.sy || 0) * s, d];
    };
    return Object.assign({
      z0: 0, z1, side, top, stroke, bevel: false,
      shape: (c, zt) => {
        const z = zt * z1;
        for (const r of ribs) {
          if (z > r.h + 0.01) continue;
          const z2 = Math.min(r.h, z + dz * 1.05);
          const a = at(r, z), b = at(r, z2);
          for (const sg of r.one ? [r.one] : [1, -1]) {
            c.moveTo(a[0] + r.nx * a[2] * sg, a[1] + r.ny * a[2] * sg);
            c.lineTo(b[0] + r.nx * b[2] * sg, b[1] + r.ny * b[2] * sg);
          }
        }
      },
    }, extra || {});
  }
  /* horizontal cylinder lying along x (x0..x1) at y, radius R, sunk by `sink` (0..1 of R) */
  function cylX(c, x0, x1, y, R, zt, sink, cap) {
    const v = (sink || 0) + zt * (2 - (sink || 0)) - 1; // -1..1 through the cylinder
    const hw = R * Math.sqrt(Math.max(0.04, 1 - v * v));
    const e = cap === undefined ? Math.min(hw, R * 0.6) : cap;
    S.rrect(c, x0, y - hw, x1 - x0, hw * 2, Math.min(e, hw));
  }
  const ringPts = (r, n, rot, cx, cy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r); } return a; };

  /* =================================================================
   * CRASHED STARSHIP — 180 long, broken into nose / mid / tail with gaps,
   * torn port wing lying beside, exposed frames at the breaks, plowed berm
   * at the nose. variant 'colony' (survey ship Compass) | 'choir'.
   * ================================================================= */
  M.crashShip = function (pal, opt) {
    opt = opt || {};
    const choir = opt.variant === 'choir';
    const p = P(pal, choir ? { a: '#a59e8c', b: '#d8d0bc', t: '#5a4f7a', g: '#b07cff', d: '#34303e' } : null);
    const parts = [];
    const dirt = opt.dirt || (choir ? '#dfe9f2' : '#8a6a4c');
    // hull colours
    const hullS = choir ? sh(p.a, -0.42) : sh(p.a, -0.18);
    const hullT = choir ? sh(p.a, -0.08) : p.b;
    const darkM = choir ? sh(p.d, -0.1) : '#2c3036';
    const panel = choir ? sh(p.a, -0.25) : sh(p.b, -0.14);
    const glow = p.g, trim = choir ? p.g : p.t;
    // fuselage half-width along x (nose at +88)
    const halfW = choir
      ? (x) => x > 70 ? 13 * Math.sqrt(Math.max(0, (90 - x) / 20)) : x > -60 ? 13 + 5 * Math.sin((70 - x) / 130 * Math.PI) : 13 - (-60 - x) * 0.22
      : (x) => x > 64 ? 15 * Math.sqrt(Math.max(0, (90 - x) / 26)) : x > -70 ? 15 + 3 * U.smoothstep(64, 30, x) : 18 - (-70 - x) * 0.25;
    // build a section outline between xa (rear) and xb (front); jagged break edges
    function section(xa, xb, jagA, jagB, seed) {
      const pts = [];
      const N = 10;
      for (let i = 0; i <= N; i++) { const x = xb - (xb - xa) * i / N; pts.push(x, halfW(x)); }
      if (jagA) { const w = halfW(xa); for (let i = 1; i < 6; i++) { const t = i / 6; pts.push(xa + (U.hash2(i, seed, 3) - 0.5) * 9, w - 2 * w * t); } }
      for (let i = 0; i <= N; i++) { const x = xa + (xb - xa) * i / N; pts.push(x, -halfW(x)); }
      if (jagB) { const w = halfW(xb); for (let i = 1; i < 6; i++) { const t = i / 6; pts.push(xb + (U.hash2(i, seed, 9) - 0.5) * 9, -w + 2 * w * t); } }
      else pts.push(xb, 0);
      return pts;
    }
    const roundK = (zt) => 1 - 0.38 * Math.pow(Math.max(0, (zt - 0.45) / 0.55), 2);
    // section transforms: [xa, xb, ox, oy, rot, hullTop]
    const SEC = {
      tail: { xa: -92, xb: -40, ox: -6, oy: -4, rot: 0.09, top: 15, seed: 3 },
      mid: { xa: -33, xb: 26, ox: 0, oy: 0, rot: 0, top: 17, seed: 5 },
      nose: { xa: 34, xb: 90, ox: 4, oy: 3, rot: -0.07, top: 14, seed: 8 },
    };
    const place = (s, pts) => tf(pts, s.ox, s.oy, s.rot);
    const local = (c, s, fn) => { c.save(); c.translate(s.ox, s.oy); c.rotate(s.rot); fn(c); c.restore(); };
    for (const k in SEC) { const s = SEC[k]; s.pts = section(s.xa, s.xb, k !== 'tail' || choir ? true : true, k !== 'nose', s.seed); }
    SEC.tail.pts = section(-92, -40, false, true, 3);
    // tail end is a flat engine block, not jagged
    SEC.tail.pts = (() => { const pts = []; const N = 8; for (let i = 0; i <= N; i++) { const x = -40 - 52 * i / N; pts.push(x, halfW(x)); } for (let i = 0; i <= N; i++) { const x = -92 + 52 * i / N; pts.push(x, -halfW(x)); } const w = halfW(-40); for (let i = 1; i < 6; i++) pts.push(-40 + (U.hash2(i, 3, 9) - 0.5) * 9, -w + 2 * w * i / 6); return pts; })();

    // 0. plowed berm in front of / beside the nose, and a drift against the tail
    parts.push({ z0: 0, z1: 5, side: sh(dirt, -0.18), top: dirt, ao: 0.3, shape: (c, zt) => {
      const k = 1 - zt * 0.55;
      S.blob(c, 92, 2, 15 * k, 4, 9, 0.35); S.blob(c, 78, 20, 10 * k, 6, 8, 0.4); S.blob(c, 80, -17, 9 * k, 7, 8, 0.4);
      S.blob(c, -30, 22, 7 * k, 9, 7, 0.4);
    } });
    // 1. debris plates scattered in the gaps and along the skid
    parts.push({ z0: 0, z1: 1.6, side: darkM, top: panel, shape: (c) => {
      const r = new U.RNG(choir ? 77 : 41);
      for (let i = 0; i < 9; i++) {
        const x = [-37, -36, 29, 31, -104, -112, 10, 52, -60][i] + r.range(-4, 4), y = [14, -12, 16, -20, 6, -10, 24, -24, 26][i] + r.range(-3, 3);
        const s = r.range(2.2, 4.2), a = r.range(0, TAU);
        S.poly(c, tf([s, 0, s * 0.2, s * 0.9, -s, s * 0.4, -s * 0.6, -s * 0.7], x, y, a));
      }
    } });
    // 2. torn port wing lying on the ground beside the mid section
    const wingP = choir ? [20, 0, 6, 10, -22, 30, -30, 26, -16, 0] : [18, 0, 4, 9, -24, 28, -33, 27, -28, 18, -16, 0];
    const wingX = 2, wingY = -44, wingR = 2.6;
    parts.push({ z0: 0, z1: 2.6, side: hullS, top: choir ? panel : sh(hullT, -0.06), shape: (c) => S.poly(c, tf(wingP, wingX, wingY, wingR)),
      detail: (c) => { c.save(); c.translate(wingX, wingY); c.rotate(wingR);
        if (choir) { S.lines(c, 'rgba(30,20,40,0.5)', 0.8, [8, 2, -22, 24, 0, 2, -26, 22]); S.lines(c, glow, 0.6, [4, 4, -18, 20]); }
        else { S.lines(c, SEAM, 0.5, [10, 2, -26, 26, 0, 3, -28, 20, -10, 10, -6, 16]); S.fillPoly(c, trim, [-24, 26.6, -31, 26, -30.4, 24.4, -23.6, 25]); }
        scorch(c, 14, 3, 9, 0.85); S.lines(c, '#1a1612', 1, [16, 0, 13, 4, 13, 4, 15, 7]);
        c.restore(); } });
    // spars poking out of the torn wing root
    parts.push({ z0: 1.2, z1: 2.4, side: darkM, top: '#6b6e72', stroke: 0.9, bevel: false, shape: (c) => {
      const pp = tf([18, 1, 24, 3, 17, 5, 22, 8.5], wingX, wingY, wingR); S.seg(c, pp[0], pp[1], pp[2], pp[3]); S.seg(c, pp[4], pp[5], pp[6], pp[7]);
    } });

    // 3. starboard wing (intact but ragged) on the mid section
    const wingS = choir ? [14, 10, -4, 18, -30, 50, -36, 46, -26, 14] : [16, 10, -6, 16, -26, 52, -31, 53, -29, 44, -36, 40, -26, 14];
    parts.push({ z0: 1, z1: 4, side: hullS, top: choir ? panel : sh(hullT, -0.04), shape: (c) => { S.poly(c, wingS); polyOK(c, [10, -14, 2, -21, -6, -19, -10, -15, -18, -14]); },
      detail: (c) => {
        if (choir) { S.lines(c, 'rgba(30,20,40,0.45)', 0.9, [6, 14, -28, 46, -2, 15, -32, 44]); S.lines(c, glow, 0.6, [2, 15, -29, 45]); S.dot(c, glow, -31, 46, 1.2); }
        else {
          S.lines(c, SEAM, 0.5, [8, 12, -27, 47, -4, 15, -30, 44, -14, 26, -7, 28, -20, 37, -13, 39]);
          S.fillPoly(c, trim, [-26.5, 51, -30.5, 52.2, -30, 49, -26.8, 48.6]);
          S.dot(c, '#5aff7a', -29, 50, 0.9);
          scorch(c, -18, 30, 8, 0.6);
        }
        // torn port stub
        scorch(c, -6, -17, 7, 0.9);
      } });
    // exposed spars at the port root
    parts.push({ z0: 2.5, z1: 3.6, side: darkM, top: choir ? sh(p.b, -0.1) : '#7c8088', stroke: 0.8, bevel: false,
      shape: (c) => { S.seg(c, 6, -18, 8, -26); S.seg(c, -2, -19, -1, -28); S.seg(c, -9, -17, -12, -24); } });

    // 4. engine nacelles on the tail section (colony) / crescent drive blades (choir)
    const T = SEC.tail;
    if (!choir) {
      parts.push({ z0: 0, z1: 12, side: sh(p.a, -0.3), top: sh(p.b, -0.06), shape: (c, zt) => {
        for (const sg of [1, -1]) { const pts = []; const v = 0.3 + zt * 1.7 - 1, hw = 6.4 * Math.sqrt(Math.max(0.04, 1 - v * v)); pts.push(-58, sg * 20 - hw, -58, sg * 20 + hw, -96, sg * 20 + hw, -96, sg * 20 - hw); S.poly(c, place(T, pts)); }
      }, detail: (c) => local(c, T, (c) => {
        for (const sg of [1, -1]) {
          S.lines(c, SEAM, 0.5, [-66, sg * 16, -66, sg * 24, -78, sg * 16, -78, sg * 24, -88, sg * 16, -88, sg * 24]);
          S.lines(c, SEAM_L, 0.5, [-60, sg * 18, -94, sg * 18]);
          S.fillPoly(c, trim, [-60, sg * 15.6, -63, sg * 15.6, -63, sg * 24.4, -60, sg * 24.4]);
        }
        scorch(c, -84, 20, 9, 0.75);
      }) });
      // nozzle bells
      parts.push({ z0: 0.6, z1: 11, side: '#24272c', top: '#3c4048', shape: (c, zt) => {
        for (const sg of [1, -1]) { const v = 0.3 + zt * 1.7 - 1, hw = 7.2 * Math.sqrt(Math.max(0.04, 1 - v * v)); S.poly(c, place(T, [-95, sg * 20 - hw, -95, sg * 20 + hw, -102, sg * 20 + hw * 1.05, -102, sg * 20 - hw * 1.05])); }
      }, detail: (c) => local(c, T, (c) => { for (const sg of [1, -1]) { S.dot(c, '#101216', -100.5, sg * 20, 3.6); } glowDot(c, '#ff8a3a', -100.5, 20, 3, 0.85); S.dot(c, '#ffcf7a', -100.5, 20, 0.9); }) });
    } else {
      // crescent drive blades flanking the tail
      parts.push({ z0: 2, z1: 9, side: hullS, top: hullT, shape: (c, zt) => {
        for (const sg of [1, -1]) { const k = 1 - zt * 0.25; S.poly(c, place(T, [-48, sg * 14, -66, sg * (30 * k), -96, sg * (34 * k), -108, sg * 28 * k, -80, sg * 22, -70, sg * 15])); }
      }, detail: (c) => local(c, T, (c) => { for (const sg of [1, -1]) { S.lines(c, 'rgba(30,20,40,0.55)', 1, [-60, sg * 17, -100, sg * 27]); S.lines(c, glow, 0.7, [-62, sg * 18, -98, sg * 27.5]); } }) });
    }

    // 5. hull sections
    const hullDetail = (s, kind) => (c) => local(c, s, (c) => {
      const k = roundK(1);
      if (choir) {
        // carapace rib bands with glowing seams
        for (let x = s.xa + 6; x < s.xb - 2; x += 7.5) {
          const w = halfW(x) * k;
          c.strokeStyle = 'rgba(30,22,40,0.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 2, -w); c.quadraticCurveTo(x - 3, 0, x + 2, w); c.stroke();
          c.strokeStyle = C.str(glow, 0.85); c.lineWidth = 0.55; c.beginPath(); c.moveTo(x + 2.8, -w * 0.9); c.quadraticCurveTo(x - 2.2, 0, x + 2.8, w * 0.9); c.stroke();
        }
        S.lines(c, 'rgba(255,255,255,0.18)', 0.8, [s.xa + 4, -halfW(s.xa) * k * 0.55, s.xb - 4, -halfW(s.xb) * k * 0.4]);
      } else {
        // panel seams, longitudinal spine, hatches
        const segs = [];
        for (let x = Math.ceil(s.xa / 9) * 9; x < s.xb - 3; x += 9) { const w = halfW(x) * k; segs.push(x, -w, x, w); }
        segs.push(s.xa + 2, 0, s.xb - (kind === 'nose' ? 12 : 2), 0);
        S.lines(c, SEAM, 0.5, segs);
        S.lines(c, SEAM_L, 0.6, [s.xa + 3, -halfW(s.xa) * k + 2, s.xb - 6, -halfW(s.xb - 6) * k + 2]);
        // amber hull stripe
        S.fillPoly(c, trim, [s.xa + 4, 6.2, s.xb - 6, 6.2, s.xb - 6, 8, s.xa + 4, 8]);
      }
      if (kind === 'mid') {
        if (choir) { S.dot(c, sh(p.d, -0.2), -2, -3, 4.2); glowDot(c, glow, -2, -3, 5, 0.75); S.dot(c, sh(glow, 0.5), -2, -3, 1.4); }
        else {
          // missing panels showing the frame, a dorsal hatch, scorch
          c.fillStyle = '#17191c'; c.beginPath(); S.poly(c, [6, -9, 15, -10, 17, -3, 9, -1, 5, -4]); c.fill();
          S.lines(c, '#5c6168', 0.6, [9, -9.6, 11, -1.8, 13, -9.8, 15, -2.6]);
          c.fillStyle = sh(p.a, -0.35); c.beginPath(); S.rrect(c, -20, -5, 9, 10, 1.5); c.fill(); S.lines(c, SEAM, 0.4, [-15.5, -5, -15.5, 5]);
          scorch(c, -26, 3, 11, 0.85); scorch(c, 20, -4, 7, 0.6);
        }
      }
      if (kind === 'tail') {
        if (!choir) { c.fillStyle = '#16181b'; c.beginPath(); S.poly(c, [-56, 2, -48, -3, -44, 4, -52, 8]); c.fill(); S.lines(c, '#5c6168', 0.5, [-53, 1, -49, 6]); scorch(c, -46, -2, 10, 0.85); }
        else scorch(c, -46, 0, 9, 0.6);
      }
      if (kind === 'nose') {
        if (choir) {
          // eye-slit sensor band
          c.fillStyle = sh(p.d, -0.25); c.beginPath(); S.ell(c, 70, 0, 9, 3.4); c.fill();
          glowDot(c, glow, 72, 0, 6, 0.8); S.lines(c, sh(glow, 0.5), 0.8, [64, 0, 78, 0]);
        } else {
          // cockpit glazing with cyan glints
          const g = c.createLinearGradient(62, -7, 80, 7); g.addColorStop(0, '#6fd2ee'); g.addColorStop(0.45, '#1b4a5c'); g.addColorStop(1, '#0d1c26');
          c.fillStyle = '#20252c'; c.beginPath(); S.poly(c, [58, -8, 72, -6.5, 79, -2.5, 79, 2.5, 72, 6.5, 58, 8]); c.fill();
          c.fillStyle = g; c.beginPath(); S.poly(c, [60, -6.6, 71.5, -5.3, 77.5, -2, 77.5, 2, 71.5, 5.3, 60, 6.6]); c.fill();
          S.lines(c, '#20252c', 0.6, [66, -6.2, 66, 6.2, 72, -5.4, 72, 5.4]);
          c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); S.ell(c, 70, -3, 3, 0.6, -0.2); c.fill();
          // hull number block + crack
          S.fillPoly(c, trim, [44, -9, 52, -9, 52, -5.5, 44, -5.5]);
          S.lines(c, '#121416', 0.6, [52, 4, 47, 9, 47, 9, 44, 8]);
        }
        scorch(c, 38, 2, 9, 0.85);
      }
    });
    for (const kind of ['tail', 'mid', 'nose']) {
      const s = SEC[kind];
      const slope = kind === 'nose';
      parts.push({
        z0: 0, z1: s.top, side: hullS, top: hullT, ao: 0.5,
        shape: (c, zt) => {
          let pts = scaleY(s.pts, roundK(zt));
          if (slope) pts = clipX(pts, 90 - Math.max(0, zt - 0.1) * 30); // nose buried: deck slopes down to the front
          if (kind === 'tail') pts = clipX(pts.map((v, i) => (i % 2 ? v : v)), 100).filter(() => true);
          polyOK(c, place(s, pts));
        },
        detail: hullDetail(s, kind),
      });
    }

    // 6. exposed frames at the breaks (arched ribs) and stringers sticking out
    const fr = [];
    const addFrames = (s, x, dir) => {
      const ca = Math.cos(s.rot), sa = Math.sin(s.rot);
      for (let i = 0; i < 2; i++) {
        const xx = x + dir * (2 + i * 3.2), w = halfW(xx) * 0.92;
        const wx = s.ox + xx * ca, wy = s.oy + xx * sa;
        fr.push({ x: wx, y: wy, nx: -sa, ny: ca, w, h: s.top - 1 - i * 2.5 });
      }
    };
    addFrames(SEC.tail, -40, 1); addFrames(SEC.mid, -33, -1); addFrames(SEC.mid, 26, 1); addFrames(SEC.nose, 34, -1);
    parts.push(archPart(fr, 17, 1.4, choir ? sh(p.d, 0.1) : '#3a3e44', choir ? p.b : '#9aa0a8'));
    parts.push({ z0: 9, z1: 10.2, side: darkM, top: choir ? p.b : '#8a9098', stroke: 0.9, bevel: false, shape: (c) => {
      const st = (s, x, dir) => { const a = tf([x, -6, x + dir * 8, -8, x, 5, x + dir * 6, 9, x, 0, x + dir * 10, 1], s.ox, s.oy, s.rot); for (let i = 0; i < a.length; i += 4) S.seg(c, a[i], a[i + 1], a[i + 2], a[i + 3]); };
      st(SEC.tail, -40, 1); st(SEC.mid, 26, 1); st(SEC.mid, -33, -1);
    } });
    // glowing break interiors / crystal growth (choir) or embers (colony)
    if (choir) {
      parts.push({ z0: 4, z1: 20, side: sh(glow, -0.35), top: sh(glow, 0.45), flat: true, shape: (c, zt) => {
        const k = 1 - zt;
        const sp = (x, y, a, r) => S.poly(c, [x + Math.cos(a) * zt * 6, y + Math.sin(a) * zt * 6, x + 1.8 * k + 0.2, y, x, y + 1.8 * k + 0.2, x - 1.8 * k - 0.2, y]);
        sp(-34, 4, 2.6, 1); sp(-36, -3, 3.4, 1); sp(29, 2, 0.4, 1); sp(31, -5, -0.6, 1);
      } });
      // dorsal crest spines on the mid section
      parts.push({ z0: 15, z1: 28, side: hullS, top: hullT, shape: (c, zt) => {
        const k = 1 - zt;
        for (const [x, l] of [[-22, 1], [-8, 1.15], [8, 1]]) S.poly(c, [x + 2 - zt * 10, 0, x - 6 * k - zt * 10, 1.6 * k + 0.2, x - 9 * k - zt * 10 * l, 0, x - 6 * k - zt * 10, -1.6 * k - 0.2]);
      } });
    } else {
      // tail fin (canted, amber tip) and a dorsal sensor mast on the nose
      parts.push({ z0: 13, z1: 34, side: hullS, top: trim, shape: (c, zt) => {
        const f = -50 - zt * 14, b = -80 - zt * 6;
        S.poly(c, tf([f, 0, f - 4, 1.4, b, 1.2, b, -1.2, f - 4, -1.4], T.ox, T.oy, T.rot));
      } });
      parts.push({ z0: 10, z1: 22, side: '#3a3e44', top: '#aab0b8', stroke: 0.9, bevel: false, shape: (c) => { const a = tf([50, -4], SEC.nose.ox, SEC.nose.oy, SEC.nose.rot); S.circ(c, a[0], a[1], 0.4); } });
      parts.push({ z0: 22, z1: 23.5, side: '#7a1a10', top: '#ff5a3a', flat: true, shape: (c) => { const a = tf([50, -4], SEC.nose.ox, SEC.nose.oy, SEC.nose.rot); S.circ(c, a[0], a[1], 1.3); } });
      // cyan cabin lights along the mid hull (port side windows)
      parts.push({ z0: 9, z1: 10, side: '#1d4a5a', top: glow, flat: true, shape: (c) => { for (let x = -24; x < 22; x += 6) S.circ(c, x, halfW(x) * roundK(0.55) + 0.2, 0.75); } });
    }
    return { r: 104, h: 36, parts, style: 'prop', bevel: 0.8,
      // object-space hot spots for the engine (fx / lights)
      spots: { smoke: [-8, 2, 18], fire: [-38, 6, 6], beacon: choir ? null : [54, -1, 23], engine: [-104, 16, 6] } };
  };
})(window.AS);
