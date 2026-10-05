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
    return { r: 118, h: 36, parts, style: 'prop', bevel: 0.8,
      // object-space hot spots for the engine (fx / lights)
      spots: { smoke: [-8, 2, 18], fire: [-36, 2, 6], beacon: choir ? null : [54, -4.5, 23], engine: [-108, 7, 6] } };
  };

  /* ------------------------------------------------------- shared helpers 2 */
  /* heading of the frame being rendered (the forge rotates the context by it) */
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  /* Depth sorter: put first in a model's parts. When the forge reaches it, it reads the
   * heading and re-orders the remaining parts in place: by `layer` (ground stuff first),
   * then back-to-front by the screen depth of each part's anchor `at: [x, y]`. Parts that
   * share an anchor keep their authored (bottom-to-top) order. */
  function sorter(parts) {
    return { z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: (c) => {
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
      const rest = parts.slice(1).map((p, i) => ({ p, i, l: p.layer || 0, d: p.at ? p.at[0] * sa + p.at[1] * ca : 0 }));
      rest.sort((A, B) => (A.l - B.l) || (A.d - B.d) || (A.i - B.i));
      for (let i = 0; i < rest.length; i++) parts[i + 1] = rest[i].p;
    } };
  }
  const withSorter = (parts) => { const all = [null].concat(parts); all[0] = sorter(all); return all; };
  /* front half of a horizontal ring (for bands drawn after the body they wrap) */
  const frontArc = (c, x, y, R) => { const a = headingOf(c), t0 = -a; c.moveTo(x + Math.cos(t0) * R, y + Math.sin(t0) * R); c.arc(x, y, R, t0, t0 + Math.PI); };
  /* Facet slivers along the wall edges of a convex cross-section, chosen by the edge's
   * screen-space outward normal (sx, sy): lets a part paint lit / shaded facets. */
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
  /* is an object-space direction (nx, ny) facing the viewer (screen down) at this heading? */
  const facing = (c, nx, ny, k) => { const a = headingOf(c); return nx * Math.sin(a) + ny * Math.cos(a) > (k || 0); };
  /* Slice-wise stroked curves: each curve f(z) -> [x, y] (or null outside its range). */
  function curvePart(curves, z0, z1, stroke, side, top, extra) {
    const dz = dzOf(z0, z1);
    return Object.assign({ z0, z1, side, top, stroke, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0);
      for (const f of curves) {
        const a = f(z), b = f(Math.min(z1, z + dz * 1.05));
        if (!a || !b) continue;
        c.moveTo(a[0], a[1]); c.lineTo(b[0] + (a[0] === b[0] && a[1] === b[1] ? 0.01 : 0), b[1]);
      }
    } }, extra || {});
  }
  /* translucent ground stain (no outline: alpha stays below the forge's solid cut) */
  function stain(rx, ry, a, col, ox, oy) {
    return { z0: 0, z1: 0, flat: true, bevel: false, layer: -9, side: '#000000', top: '#000000', shape: () => {}, detail: (c) => {
      c.save(); c.translate(ox || 0, oy || 0); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, C.str(col || '#140e0a', a)); g.addColorStop(0.6, C.str(col || '#140e0a', a * 0.55)); g.addColorStop(1, C.str(col || '#140e0a', 0));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    } };
  }
  const ngon = (n, r, rot, cx, cy, sx, sy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r * (sx || 1), (cy || 0) + Math.sin(t) * r * (sy || 1)); } return a; };
  const BONE = { a: '#a89c80', b: '#d8ccb0', t: '#8a7a60', g: '#ffe0a0', d: '#4a4234' };
  const CHOIR_P = { a: '#a59e8c', b: '#d8d0bc', t: '#5a4f7a', g: '#b07cff', d: '#34303e' };
  /* a curved 3D rib: rises from (x0, y0) to height h and comes down at (x1, y1), bowed
   * sideways by (bx, by) at the crown so it reads as an arc from every heading */
  function ribPart(x0, y0, x1, y1, h, bx, by, st, side, top, extra) {
    const P_ = 0.8;
    const pos = (s) => { const b = Math.sin(Math.PI * s); return [x0 + (x1 - x0) * s + bx * b, y0 + (y1 - y0) * s + by * b]; };
    const sAt = (z) => Math.asin(Math.pow(U.clamp(z / h, 0, 1), 1 / P_)) / Math.PI;
    const legA = (z) => (z > h + 0.01 ? null : pos(sAt(z)));
    const legB = (z) => (z > h + 0.01 ? null : pos(1 - sAt(z)));
    return curvePart([legA, legB], 0, h, st, side, top, Object.assign({ at: [(x0 + x1) / 2, (y0 + y1) / 2], ao: 0.45 }, extra || {}));
  }

  /* =================================================================
   * GIANT SKELETON — kind 'beast': a fossil lying on its side, tall arched
   * ribs rising from a ground-level spine, horned skull with a dropped jaw,
   * scattered limb bones. kind 'worm': a sand-worm, ~22 rib rings along an
   * S-curve with a lamprey maw and mandible tusks. Front (+x) = skull.
   * ================================================================= */
  M.skeleton = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, BONE);
    const worm = opt.kind === 'worm';
    const boneT = p.b, boneS = mx(p.a, p.b, 0.3), boneD = sh(p.a, -0.22);
    const crack = 'rgba(70,56,36,0.55)', hole = mx(p.d, '#000000', 0.45);
    const parts = [];
    parts.push(stain(worm ? 130 : 120, worm ? 62 : 58, 0.3, null, 0, worm ? 0 : 8));
    const rib = (x, y, nx, ny, w, h, st, extra) => {
      const r = { x, y, nx, ny, w, h };
      return archPart([r], h, st, boneS, boneT, Object.assign({ at: [x, y], ao: 0.45 }, extra || {}));
    };
    if (!worm) {
      const ys = (x) => -12 + 4 * Math.sin((x + 120) / 55) + (x < -60 ? 0.0035 * (x + 60) * (x + 60) : 0);
      // spine: vertebrae along the ground, small at the tail tip
      const verts = [];
      for (let x = -122; x <= 64; x += 6.2) { const k = U.clamp((x + 122) / 70, 0.35, 1); verts.push([x, ys(x), 2.1 + 2.3 * k]); }
      parts.push({ z0: 0, z1: 6, side: boneS, top: boneT, layer: -1, ao: 0.5, shape: (c, zt) => {
        for (const v of verts) { const r = v[2] * (1 - 0.45 * zt * zt); if (zt * 6 > v[2] * 1.3) continue; S.ell(c, v[0], v[1], r * 0.8, r, 0); }
      }, detail: (c) => { for (const v of verts) S.lines(c, crack, 0.45, [v[0] - v[2] * 0.8, v[1], v[0] + v[2] * 0.8, v[1]]); } });
      // spinous processes: raked spikes off each vertebra
      const sp = verts.filter((v, i) => i % 1 === 0 && v[0] > -100).map((v) => (z) => { const hh = v[2] * 2.1; if (z > hh) return null; const q = z / hh; return [v[0] - q * 4.5, v[1] - 2 - q * 2.5]; });
      parts.push(curvePart(sp, 0, 10, 1.5, boneS, boneT, { layer: -1, ao: 0.35 }));
      // limb bones lying in the sand (femur + shin, knobbed ends)
      const limbs = [[-46, 30, -18, 44], [-14, 42, 6, 50], [-70, 26, -84, 44], [30, 40, 50, 46]];
      parts.push({ z0: 0, z1: 3.6, side: boneS, top: boneT, layer: -1, shape: (c, zt) => {
        const w = 1.7 * (1 - 0.3 * zt);
        for (const l of limbs) {
          const dx = l[2] - l[0], dy = l[3] - l[1], L = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
          S.poly(c, tf([0, -w, L, -w, L, w, 0, w], l[0], l[1], a));
          S.circ(c, l[0], l[1], w * 1.8); S.circ(c, l[2], l[3], w * 1.6);
        }
      }, detail: (c) => { for (const l of limbs) S.lines(c, crack, 0.4, [(l[0] * 2 + l[2]) / 3, (l[1] * 2 + l[3]) / 3 - 0.8, (l[0] + l[2] * 2) / 3, (l[1] + l[3] * 2) / 3 - 0.8]); } });
      // the ribcage: separate arched ribs (depth sorted) from the spine over to the far side
      const hs = [22, 30, 37, 42, 44, 42, 38, 31, 23];
      hs.forEach((h, i) => {
        const x = -40 + i * 10.5, y0 = ys(x) + 2.5, tip = 32 + 4 * Math.sin(i * 1.7);
        parts.push(ribPart(x, y0, x - 10 - i * 0.3, tip, h, -9 - i * 0.4, 2, 3.3 - Math.abs(i - 4) * 0.12, boneS, boneT));
      });
      // pelvis / hip plate where the ribs end
      parts.push({ z0: 0, z1: 7, side: boneS, top: boneT, at: [-62, -8], shape: (c, zt) => { const k = 1 - 0.35 * zt; S.poly(c, tf([9 * k, 0, 3, 8 * k, -8 * k, 6 * k, -10 * k, -2, -2, -9 * k, 6 * k, -6 * k], -62, ys(-62) + 1, 0.3)); },
        detail: (c) => { S.dot(c, hole, -61, ys(-62) + 2, 2.4); S.lines(c, crack, 0.45, [-66, ys(-62) - 4, -58, ys(-62) + 6]); } });
      // skull: long wedge cranium lying on its side, brow ridge, big horns sweeping back
      const SX = 84, SY = -6, SA = 0.12;
      const skull = (k) => [30 * k + 2, 1, 22, 5.5 * k, 8, 9 * k, -4, 12 * k, -13 * k, 9, -16 * k, 2, -13 * k, -7, -3, -11 * k, 9, -8.5 * k, 22, -5 * k];
      parts.push({ z0: 0, z1: 12, side: boneS, top: boneT, at: [SX, SY], ao: 0.5, shape: (c, zt) => {
        const k = Math.sqrt(Math.max(0.06, 1 - zt * zt * 0.8));
        S.poly(c, tf(skull(k), SX, SY, SA));
      }, detail: (c) => {
        c.save(); c.translate(SX, SY); c.rotate(SA);
        c.fillStyle = hole; c.beginPath(); S.poly(c, [-6, 3.5, 2, 1.5, 4, 5, -3, 7.5]); c.fill();
        c.beginPath(); S.ell(c, 21, 1.5, 2.6, 1.1, 0.1); c.fill();
        c.beginPath(); S.poly(c, [9, -4, 15, -3.2, 12, -1]); c.fill();
        S.lines(c, 'rgba(255,255,255,0.4)', 0.8, [-8, -5, 6, -6.5, 6, -6.5, 18, -3.5]);
        S.lines(c, crack, 0.5, [-10, 0, -2, -3, -2, -3, 4, -1]);
        c.restore();
      } });
      parts.push({ z0: 0, z1: 4, side: boneS, top: boneT, at: [SX + 2, SY], shape: (c, zt) => {
        // upper tooth row along the jaw line
        for (let i = 0; i < 6; i++) { const q = 1 - zt; S.poly(c, tf([6 + i * 3.6, 7.5 - i * 0.6, 7.6 + i * 3.6, 7.2 - i * 0.6, 6.8 + i * 3.6, 7.5 - i * 0.6 + 3 * q], SX, SY, SA)); }
      } });
      const horn = (bx, by, dy, len, hz) => (z) => { if (z > hz) return null; const q = U.clamp((z - 6) / (hz - 6), 0, 1); return tf([-len * q * q - 2 * q, dy * Math.sin(q * 1.9)], bx, by, SA); };
      parts.push(curvePart([horn(SX - 10, SY - 4, -10, 30, 30), horn(SX - 9, SY + 6, 9, 24, 24)], 6, 30, 3, boneS, sh(boneT, 0.06), { at: [SX - 1, SY] }));
      // dropped lower jaw with teeth, lying open in front of the skull
      parts.push({ z0: 0, z1: 3.2, side: boneS, top: boneT, at: [SX + 4, SY + 16], shape: (c, zt) => {
        const w = 1.9 * (1 - 0.3 * zt);
        S.poly(c, tf([-12, -w, 22, -w * 0.6, 22, w * 0.6, -12, w], SX + 2, SY + 14, 0.32));
        S.circ(c, ...tf([-12, 0], SX + 2, SY + 14, 0.32), w * 1.9);
      }, detail: (c) => {
        c.save(); c.translate(SX + 2, SY + 14); c.rotate(0.32);
        for (let i = 0; i < 6; i++) S.fillPoly(c, '#f4ead4', [i * 4 - 4, -1.4, i * 4 - 2.6, -4.2, i * 4 - 1.2, -1.4]);
        c.restore();
      } });
      return { r: 136, h: 46, parts: withSorter(parts), style: 'prop', bevel: 0.8, spots: {} };
    }
    // ----- worm: rib rings along an S-curve
    const cy = (x) => 26 * Math.sin(x / 62);
    const dcy = (x) => 26 / 62 * Math.cos(x / 62);
    const rings = [];
    for (let x = -112; x <= 86; x += 9) {
      const t = (x + 112) / 198;
      const w = 6 + 13 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (t > 0.86 ? 1 - (t - 0.86) * 1.5 : 1);
      rings.push({ x, y: cy(x), w, h: w * 1.15 + 2 });
    }
    for (const r of rings) {
      const tx = 1, ty = dcy(r.x), tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl, ux = tx / tl, uy = ty / tl;
      const bow = 4 + r.w * 0.22;
      const part = ribPart(r.x - nx * r.w, r.y - ny * r.w, r.x + nx * r.w, r.y + ny * r.w, r.h, -ux * bow, -uy * bow, 2.6, boneS, boneT, { at: [r.x, r.y], ao: 0.5 });
      // vertebra on top of each ring: a short bar along the spine at the crown
      const inner = part.shape, ax = r.x - ux * bow, ay = r.y - uy * bow;
      part.z1 = r.h + 1; part.z0 = 0;
      part.shape = (c, zt) => {
        const z = zt * part.z1;
        if (z <= r.h) inner(c, z / r.h);
        if (z > r.h - 2 && z < r.h + 1) { const L = 3.6; c.moveTo(ax - ux * L, ay - uy * L); c.lineTo(ax + ux * L, ay + uy * L); }
      };
      parts.push(part);
    }
    // trailing tail vertebrae on the ground
    const tail = [];
    for (let i = 0; i < 7; i++) tail.push([-118 - i * 5.5, cy(-118 - i * 5.5) - i * i * 0.35, 3.2 - i * 0.32]);
    parts.push({ z0: 0, z1: 4, side: boneS, top: boneT, layer: -1, shape: (c, zt) => { for (const v of tail) if (zt * 4 < v[2] * 1.2) S.ell(c, v[0], v[1], v[2], v[2] * 0.8, 0); } });
    // the maw: a squat skull dome with a ring of inward teeth and four mandible tusks
    const HX = 104, HY = cy(98) + 2;
    parts.push({ z0: 0, z1: 16, side: boneS, top: boneT, at: [HX - 4, HY], ao: 0.5, shape: (c, zt) => {
      const k = Math.sqrt(Math.max(0.04, 1 - zt * zt));
      S.blob(c, HX - 6, HY, 17 * k, 4, 10, 0.12);
    }, detail: (c) => {
      c.fillStyle = hole; c.beginPath(); S.ell(c, HX - 4, HY, 5, 4.4, 0); c.fill();
      S.lines(c, crack, 0.5, [HX - 14, HY - 3, HX - 8, HY + 2]);
    } });
    // mouth ring: dark throat with teeth, opening forward
    parts.push({ z0: 0, z1: 5, side: boneD, top: boneS, at: [HX + 10, HY], shape: (c, zt) => { const k = 1 - zt * 0.2; S.ell(c, HX + 12, HY, 7 * k, 13 * k, 0); },
      detail: (c) => {
        c.fillStyle = hole; c.beginPath(); S.ell(c, HX + 12.5, HY, 4.6, 9.6, 0); c.fill();
        for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, cxx = HX + 12.5, cyy = HY; S.fillPoly(c, '#f2e8d2', [cxx + Math.cos(a) * 4.6, cyy + Math.sin(a) * 9.6, cxx + Math.cos(a + 0.18) * 4.6, cyy + Math.sin(a + 0.18) * 9.6, cxx + Math.cos(a + 0.09) * 2.6, cyy + Math.sin(a + 0.09) * 6]); }
      } });
    const tusks = [[12, 1.0], [-12, 1.0], [7, 0.8], [-7, 0.8]].map(([dy, k]) => ({ x: HX + 14, y: HY + dy, nx: -0.6, ny: Math.sign(dy) * 0.8, w: 10 * k, h: 22 * k, one: -1 }));
    parts.push(archPart(tusks, 22, 2.4, boneS, sh(boneT, 0.05), { at: [HX + 14, HY] }));
    return { r: 140, h: 30, parts: withSorter(parts), style: 'prop', bevel: 0.8, spots: {} };
  };

  /* =================================================================
   * CHOIR MONOLITH — carved bone-stone slab on a sunken plinth, glyph channels
   * glowing pal.g on its broad faces, chipped (or snapped) top, optional lean
   * and a fallen fragment. h 30-60.
   * ================================================================= */
  M.monolith = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, CHOIR_P);
    const rng = new U.RNG(((opt.seed || 3) * 131 + 17) >>> 0);
    const broken = !!opt.broken;
    const H0 = U.clamp(opt.h || 44, 24, 66);
    const H = broken ? Math.round(H0 * rng.range(0.48, 0.62)) : H0;
    const lean = U.clamp(opt.lean || 0, -0.2, 0.2);
    const L = 5.6 + H0 * 0.035, D = 3.1;
    const side = mx(p.a, p.d, 0.32), top = p.b, glow = p.g, glowHi = mx(p.g, '#ffffff', 0.55);
    const ox = (z) => lean * z;
    const kz = (z) => 1 - 0.16 * z / H0;
    const chipSide = rng.next() < 0.5 ? 1 : -1;
    // cross-section at height z (chamfered rectangle, chipped / snapped near the top)
    const sect = (z) => {
      const k = kz(z), l = L * k, d = D * k, ch = 1.1 * k;
      let pts = [l, -d + ch, l, d - ch, l - ch, d, -l + ch, d, -l, d - ch, -l, -d + ch, -l + ch, -d, l - ch, -d];
      if (broken) {
        const q = (z - (H - 7)) / 7;
        if (q > 0) { const step = Math.floor(q * 4); const X = l - (2 * l) * (0.25 + 0.2 * step + 0.12 * U.hash2(step, opt.seed || 3, 5)); pts = clipX(pts.map((v, i) => (i % 2 ? v : v * chipSide)), X).map((v, i) => (i % 2 ? v : v * chipSide)); }
      } else {
        const q = (z - (H - 4.5)) / 4.5;
        if (q > 0) pts = clipX(pts.map((v, i) => (i % 2 ? v : v * chipSide)), l - q * l * 1.1).map((v, i) => (i % 2 ? v : v * chipSide));
      }
      return tf(pts, ox(z), 0, 0);
    };
    const parts = [];
    // sunken plinth + rubble
    parts.push({ z0: 0, z1: 2.2, side: sh(p.d, 0.12), top: mx(p.a, p.d, 0.15), layer: -1, ao: 0.3, shape: (c, zt) => {
      const g = 1 - zt * 0.12; S.rrect(c, -L * 1.55 * g, -D * 2.2 * g, L * 3.1 * g, D * 4.4 * g, 2);
      
    }, detail: (c) => { S.lines(c, 'rgba(0,0,0,0.3)', 0.45, [-L * 1.4, 0, -L * 1.1, 0, L * 1.1, 0, L * 1.4, 0]); S.lines(c, C.str(glow, 0.5), 0.5, [-L * 1.45, -D * 2.05, L * 1.45, -D * 2.05, -L * 1.45, D * 2.05, L * 1.45, D * 2.05]); } });
    // body
    parts.push({ z0: 2, z1: H, side, top, at: [0, 0], ao: 0.5, shape: (c, zt) => polyOK(c, sect(2 + zt * (H - 2))),
      detail: (c) => {
        const z = H, k = kz(z), l = L * k;
        c.save(); c.translate(ox(z), 0);
        if (broken) { S.lines(c, 'rgba(40,30,30,0.45)', 0.5, [-l * 0.2, -D * 0.6, l * 0.1, D * 0.5]); S.dot(c, C.str(glow, 0.9), -l * 0.35 * chipSide, 0, 0.9); }
        else { c.strokeStyle = C.str(glow, 0.95); c.lineWidth = 0.55; c.beginPath(); c.arc(-l * 0.25 * chipSide, 0, D * 0.55, 0, TAU); c.stroke(); S.dot(c, glowHi, -l * 0.25 * chipSide, 0, 0.6); }
        c.restore();
      } });
    // glyph channels: protruding slivers on the faces that face the viewer
    const bars = [];
    for (let z = 7, i = 0; z < H - 7; z += rng.range(5.5, 8.5), i++) bars.push([z, rng.range(0.25, 0.6), rng.range(-0.55, 0.05)]);
    const chanX = -0.3;
    parts.push({ z0: 4, z1: H - 3, side: glow, top: glowHi, flat: true, ao: 0, bevel: false, at: [0, 0], shape: (c, zt) => {
      const z = 4 + zt * (H - 7), k = kz(z), l = L * k, d = D * k, o = ox(z);
      for (const sg of [1, -1]) {
        if (!facing(c, 0, sg, 0.02)) continue;
        const y0 = sg * (d + 0.32), y1 = sg * (d - 0.5);
        // vertical channel
        if (z < H - 6) c.rect(o + chanX * l - 0.45, Math.min(y0, y1), 0.9, Math.abs(y0 - y1));
        // glyph bars and ticks
        for (const b of bars) {
          if (z >= b[0] && z <= b[0] + 1.1) c.rect(o + b[2] * l, Math.min(y0, y1), b[1] * l * 2, Math.abs(y0 - y1));
          if (z >= b[0] + 1.1 && z <= b[0] + 3.2) c.rect(o + (b[2] + b[1] * 2) * l - 0.8, Math.min(y0, y1), 0.8, Math.abs(y0 - y1));
        }
      }
      // narrow faces: a single channel each
      for (const sx of [1, -1]) if (facing(c, sx, 0, 0.02) && z < H - 6 && z > 8) c.rect(sx * (l + 0.32) + o - (sx > 0 ? 0.82 : 0), -0.45, 0.82, 0.9);
    } });
    if (broken) {
      // the snapped-off top lying beside the base
      const fa = rng.range(-0.6, 0.6) + (chipSide > 0 ? 0.2 : Math.PI - 0.2), fx = chipSide * (L + 9), fy = rng.range(4, 9) * (rng.next() < 0.5 ? 1 : -1);
      const FL = (H0 - H) * 0.42 + 4;
      parts.push({ z0: 0, z1: D * 1.6, side, top, at: [fx, fy], shape: (c, zt) => { const k = 1 - 0.08 * zt; S.poly(c, tf([FL, -D * k, FL - 2, D * 1.1 * k, -FL, D * k, -FL + 1.5, -D * 1.2 * k], fx, fy, fa)); },
        detail: (c) => { c.save(); c.translate(fx, fy); c.rotate(fa); S.lines(c, C.str(glow, 0.95), 0.7, [-FL * 0.7, -0.2, FL * 0.5, -0.2, FL * 0.1, -0.2, FL * 0.1, -D * 0.8]); S.lines(c, 'rgba(40,30,30,0.4)', 0.5, [FL - 1, -D, FL - 3, D]); c.restore(); } });
      parts.push({ z0: 0, z1: 1.6, side: sh(p.d, 0.15), top: mx(p.a, p.d, 0.3), layer: -1, shape: (c) => { for (let i = 0; i < 5; i++) S.blob(c, chipSide * (L + rng.range(1, 6)), rng.range(-7, 7), rng.range(0.9, 1.8), i + 1, 6, 0.4); } });
    }
    const R = Math.max(L * 1.8, broken ? L + 9 + (H0 - H) * 0.42 + 6 : 0) + Math.abs(lean) * H + 4;
    return { r: Math.ceil(R), h: H + 1, parts: withSorter(parts), style: 'prop', bevel: 0.7, spots: { top: [ox(H), 0, H] } };
  };

  /* =================================================================
   * CHOIR TOWER — segmented bone-stone spire on root buttresses, glowing
   * joint seams, two floating halo rings (split front/back so the spire
   * occludes them correctly) and a claw crown holding a glowing crystal.
   * ================================================================= */
  M.choirTower = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, CHOIR_P);
    const H = U.clamp(opt.h || 96, 70, 112), k = H / 96;
    const side = mx(p.a, p.d, 0.25), top = p.b, glow = p.g, glowHi = mx(p.g, '#ffffff', 0.6);
    const segs = [[0, 18, 13.5, 9.6], [18, 36, 10.4, 8.2], [36, 52, 8.9, 7.1], [52, 66, 7.6, 6], [66, 78, 6.3, 4.8]].map((s) => [s[0] * k, s[1] * k, s[2], s[3]]);
    const lobe = (r, th, rot) => r * (1 + 0.16 * Math.cos(3 * (th - rot)));
    const sectPts = (r, rot, cx, cy) => { const a = []; for (let i = 0; i < 18; i++) { const th = (i / 18) * TAU; const rr = lobe(r, th, rot); a.push((cx || 0) + Math.cos(th) * rr, (cy || 0) + Math.sin(th) * rr); } return a; };
    const parts = [];
    // root mound + buttress fins
    parts.push({ z0: 0, z1: 4, side: sh(p.d, 0.2), top: mx(p.d, p.a, 0.45), ao: 0.3, shape: (c, zt) => S.blob(c, 0, 0, 17 * (1 - zt * 0.25), 6, 11, 0.2) });
    parts.push({ z0: 0, z1: 15 * k, side, top, ao: 0.45, shape: (c, zt) => {
      const R = 25 * (1 - zt) + 9, w = 2.4 * (1 - zt * 0.5);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; S.poly(c, tf([0, -w * 1.6, R, -w * 0.3, R + 1, 0, R, w * 0.3, 0, w * 1.6], 0, 0, a)); }
    }, detail: (c) => { for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; S.lines(c, C.str(glow, 0.8), 0.5, tf([10, 0, 16, 0], 0, 0, a)); } } });
    // halo ring helpers (back half before the segment it surrounds, front half after)
    // segmented halo arcs: drawn as runs within the back or front half for this heading
    const arcRuns = (c, R, front, rot) => {
      const a = headingOf(c), t0 = front ? -a : Math.PI - a;
      let on = false;
      for (let i = 0; i <= 48; i++) {
        const t = t0 + (i / 48) * Math.PI, u = ((t - rot) % (TAU / 3) + TAU) % (TAU / 3);
        const inSeg = u < TAU / 3 - 0.42;
        const x = Math.cos(t) * R, y = Math.sin(t) * R;
        if (inSeg) { if (!on) c.moveTo(x, y); else c.lineTo(x, y); }
        on = inSeg;
      }
    };
    const halo = (z, R, front, rot) => ({ z0: z, z1: z + 1.8, side: mx(p.b, p.g, 0.15), top: mx(p.b, p.g, 0.4), stroke: 1.7, bevel: false, ao: 0.1, lineCap: 'butt', shape: (c) => arcRuns(c, R, front, rot) });
    const haloGlow = (z, R, rot) => ({ z0: z + 1.8, z1: z + 1.8, side: glow, top: glow, flat: true, stroke: 0.6, bevel: false, shape: (c) => arcRuns(c, R, true, rot) });
    const halos = [[44 * k, 15, 2, 0.3], [69 * k, 11.5, 3, 1.2]];
    segs.forEach((s, i) => {
      const rot = i * 0.5;
      for (const h of halos) if (h[2] === i) parts.push(halo(h[0], h[1], false, h[3]));
      parts.push({ z0: s[0], z1: s[1], side, top, ao: i ? 0.25 : 0.45, shape: (c, zt) => {
        const r = (s[2] + (s[3] - s[2]) * zt) * (1 + 0.1 * Math.sin(zt * Math.PI));
        S.poly(c, sectPts(r, rot));
      }, detail: (c) => { const r = s[3]; S.lines(c, 'rgba(30,20,40,0.35)', 0.5, [0, 0, Math.cos(rot) * r, Math.sin(rot) * r, 0, 0, Math.cos(rot + 2.1) * r, Math.sin(rot + 2.1) * r, 0, 0, Math.cos(rot + 4.2) * r, Math.sin(rot + 4.2) * r]); } });
      // vertical glyph seams in the lobe valleys facing the viewer
      parts.push({ z0: s[0] + 2, z1: s[1] - 2, side: glow, top: glow, flat: true, ao: 0, bevel: false, shape: (c, zt) => {
        const r = (s[2] + (s[3] - s[2]) * (0.1 + zt * 0.8)) * (1 + 0.1 * Math.sin((0.1 + zt * 0.8) * Math.PI));
        for (let j = 0; j < 3; j++) {
          const th = rot + Math.PI / 3 + j * TAU / 3, nx = Math.cos(th), ny = Math.sin(th);
          if (!facing(c, nx, ny, 0.15)) continue;
          const rr = lobe(r, th, rot);
          c.moveTo(nx * (rr + 0.3) - ny * 0.5, ny * (rr + 0.3) + nx * 0.5); c.lineTo(nx * (rr + 0.3) + ny * 0.5, ny * (rr + 0.3) - nx * 0.5);
          c.lineTo(nx * (rr - 0.6) + ny * 0.5, ny * (rr - 0.6) - nx * 0.5); c.lineTo(nx * (rr - 0.6) - ny * 0.5, ny * (rr - 0.6) + nx * 0.5); c.closePath();
        }
      } });
      // glowing joint seam
      if (i < segs.length - 1) parts.push({ z0: s[1] - 0.6, z1: s[1] + 0.6, side: glow, top: glowHi, flat: true, ao: 0, bevel: false, shape: (c) => S.poly(c, sectPts(s[3] * 1.06 + 0.4, rot)) });
      for (const h of halos) if (h[2] === i) { parts.push(halo(h[0], h[1], true, h[3])); parts.push(haloGlow(h[0], h[1], h[3])); }
    });
    // claw crown: three prongs curling up and in around the crystal
    const ZC = segs[segs.length - 1][1];
    const prong = (a) => (z) => { if (z < ZC - 1 || z > ZC + 18) return null; const q = (z - ZC + 1) / 19; const r = 3.6 + 6.5 * Math.sin(q * Math.PI * 0.85); return [Math.cos(a + q * 0.5) * r, Math.sin(a + q * 0.5) * r]; };
    parts.push(curvePart([0, 1, 2].map((i) => prong(i * TAU / 3 + 0.3)), ZC - 1, ZC + 18, 1.9, side, top, { ao: 0.1 }));
    // the crystal (octahedron) and its halo glow
    const CZ = ZC + 5, CH = 14;
    parts.push({ z0: CZ, z1: CZ + CH, side: mx(glow, p.d, 0.15), top: glowHi, flat: true, ao: -0.25, shape: (c, zt) => { const r = 4.2 * (1 - Math.abs(zt * 2 - 1)) + 0.25; S.poly(c, ngon(4, r, 0.4)); } });
    parts.push({ z0: CZ, z1: CZ + CH, side: mx(glow, '#ffffff', 0.35), top: glowHi, flat: true, ao: 0, bevel: false, shape: (c, zt) => {
      const r = 4.2 * (1 - Math.abs(zt * 2 - 1)) + 0.25; slivers(c, ngon(4, r, 0.4), (sx, sy) => sx < -0.1 && sy > -0.3, Math.min(1.1, r * 0.5));
    } });
    return { r: 30, h: CZ + CH + 1, parts, style: 'prop', bevel: 0.8, spots: { crown: [0, 0, CZ + CH / 2] } };
  };

  /* =================================================================
   * INDUSTRIAL STACKS — refinery / foundry landmark: two banded smoke stacks
   * (at the data fx points), a hyperbolic cooling tower with a hollow steaming
   * mouth, white storage tanks, a process block and a pipe gantry. ~100 across.
   * ================================================================= */
  M.industrialStacks = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, null);
    const metalS = sh(p.a, -0.12), metalT = p.b, dark = sh(p.d, 0.05);
    const conS = mx(p.a, '#bdb4a2', 0.55), conT = mx(p.b, '#e6dccb', 0.5);
    const tankS = mx(p.b, '#d8d4cc', 0.35), tankT = mx(p.b, '#ffffff', 0.45);
    const trim = p.t, red = '#b8402e';
    const parts = [];
    // concrete pad
    parts.push({ z0: 0, z1: 1.4, side: mx(p.d, '#2a2826', 0.5), top: mx(p.d, p.a, 0.3), layer: -2, ao: 0.2, shape: (c) => { S.poly(c, [52, -40, 54, 30, 42, 46, -30, 50, -52, 38, -50, -28, -34, -44, 28, -46]); },
      detail: (c) => { S.lines(c, 'rgba(0,0,0,0.22)', 0.5, [-54, 4, 56, 4, 0, -48, 0, 54]); S.fillPoly(c, trim, [40, 46, 52, 30, 54, 32, 42, 48]); scorch(c, 8, 18, 14, 0.4); } });
    // ---- smoke stacks at the fx points: A (-18,-10) 80 high, B (18, 8) 66 high
    const stack = (x, y, R, H) => {
      const at = [x, y];
      const rad = (z) => R * (1.15 - 0.18 * z / H);
      parts.push({ z0: 0, z1: 6, side: dark, top: metalS, at, shape: (c, zt) => S.circ(c, x, y, R * 1.7 - zt * 1.2) });
      // body in stacked colour segments: concrete, amber service ring, red / white crown
      const segs = [[6, H * 0.45, conS, conT], [H * 0.45, H * 0.45 + 2, trim, trim], [H * 0.45 + 2, H - 13, conS, conT], [H - 13, H - 8.5, red, red], [H - 8.5, H - 4.5, conT, conT], [H - 4.5, H, red, sh(red, 0.1)]];
      segs.forEach((g, i) => parts.push({ z0: g[0], z1: g[1], side: g[2], top: g[3], at, ao: i === 0 ? 0.3 : 0, bevel: i === segs.length - 1, shape: (c, zt) => S.circ(c, x, y, rad(g[0] + zt * (g[1] - g[0]))),
        detail: i === segs.length - 1 ? (c) => { const r = rad(H); S.dot(c, '#3a3634', x, y, r * 0.8); S.dot(c, '#121212', x, y, r * 0.62); const gg = c.createRadialGradient(x, y, 0, x, y, r * 0.6); gg.addColorStop(0, 'rgba(255,140,60,0.6)'); gg.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 0.6, 0, TAU); c.fill(); } : null }));
      // ladder cage up the front
      parts.push({ z0: 6, z1: H - 6, side: dark, top: dark, at, stroke: 0.5, bevel: false, ao: 0, shape: (c, zt) => { const z = 6 + zt * (H - 12); const r = rad(z) + 0.6; const a = headingOf(c) * -1 + Math.PI / 2 + 0.5; S.seg(c, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a + 0.12) * r, y + Math.sin(a + 0.12) * r); } });
    };
    stack(-18, -10, 5.2, 80);
    stack(18, 8, 4.4, 66);
    // ---- cooling tower (hyperboloid with a hollow mouth)
    const CX = -27, CY = 25, CH = 52;
    const cr = (zt) => 13.5 + 8 * Math.pow(Math.abs(zt - 0.72) / 0.72, 1.6) * (zt < 0.72 ? 1 : 0.35);
    parts.push({ z0: 0, z1: CH - 7, side: sh(conS, -0.08), top: conT, at: [CX, CY], ao: 0.45, shape: (c, zt) => S.circ(c, CX, CY, cr(zt * (CH - 7) / CH)) });
    parts.push({ z0: CH - 7, z1: CH, side: mx(conS, '#3a3430', 0.55), top: mx(conT, '#6a625a', 0.4), at: [CX, CY], ao: -0.1, shape: (c, zt) => S.circ(c, CX, CY, cr((CH - 7 + zt * 7) / CH)),
      detail: (c) => {
        const r = cr(1) - 1.3;
        const g = c.createRadialGradient(CX - 1, CY - 1, 0, CX, CY, r);
        g.addColorStop(0, '#5a5650'); g.addColorStop(0.75, '#2c2a28'); g.addColorStop(1, '#1a1918');
        c.fillStyle = g; c.beginPath(); c.arc(CX, CY, r, 0, TAU); c.fill();
        c.fillStyle = 'rgba(235,235,230,0.55)'; c.beginPath(); S.blob(c, CX + 2, CY + 1, r * 0.55, 3, 8, 0.4); c.fill();
      } });
    // support legs ring at the base of the cooling tower
    parts.push({ z0: 0, z1: 4, side: dark, top: metalS, at: [CX, CY], stroke: 1.2, bevel: false, shape: (c) => { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; S.seg(c, CX + Math.cos(a) * 21.6, CY + Math.sin(a) * 21.6, CX + Math.cos(a + 0.2) * 21.6, CY + Math.sin(a + 0.2) * 21.6); } } });
    // ---- storage tanks (white, domed) with amber bands
    const tank = (x, y, R, H) => {
      parts.push({ z0: 0, z1: H, side: tankS, top: tankT, at: [x, y], ao: 0.3, shape: (c, zt) => { const z = zt * H, dome = H - R * 0.45; S.circ(c, x, y, z < dome ? R : R * Math.sqrt(Math.max(0.1, 1 - Math.pow((z - dome) / (R * 0.45), 2)))); },
        detail: (c) => { S.dot(c, sh(tankT, -0.2), x + 0.5, y + 0.5, R * 0.3); S.lines(c, 'rgba(0,0,0,0.3)', 0.4, [x - R * 0.3, y, x + R * 0.3, y]); } });
      parts.push({ z0: H * 0.3, z1: H * 0.3 + 1.8, side: trim, top: trim, at: [x, y], ao: 0, bevel: false, stroke: 0.8, shape: (c) => frontArc(c, x, y, R + 0.1) });
    };
    tank(34, -26, 10, 20);
    tank(10, -34, 7, 15);
    // ---- process block with lit windows and roof vents
    parts.push({ z0: 0, z1: 13, side: metalS, top: metalT, at: [36, 30], shape: (c) => S.rrect(c, 26, 20, 22, 18, 1.2),
      detail: (c) => {
        S.lines(c, 'rgba(0,0,0,0.35)', 0.45, [37, 20, 37, 38]);
        c.fillStyle = '#3a3e44'; c.beginPath(); S.rrect(c, 29, 23, 5, 5, 0.8); S.rrect(c, 40, 30, 5, 5, 0.8); c.fill();
        S.dot(c, '#22262a', 31.5, 25.5, 1.6); S.dot(c, '#22262a', 42.5, 32.5, 1.6);
        S.fillPoly(c, trim, [26, 36.6, 48, 36.6, 48, 38, 26, 38]);
      } });
    parts.push({ z0: 4, z1: 6, side: '#1e2428', top: '#ffcf6a', flat: true, at: [36.1, 30.1], shape: (c) => { if (!facing(c, 0, 1)) return; for (let i = 0; i < 4; i++) c.rect(27.5 + i * 5.2, 37.9, 3, 0.5); } });
    // ---- pipe gantry: elevated pipes between tanks, stacks and the cooling tower
    const pipes = [[34, -26, 18, 8], [10, -34, -18, -10], [-18, -10, -28, 26], [18, 8, 36, 30], [18, 8, -10, 30]];
    parts.push({ z0: 0, z1: 11, side: dark, top: metalS, layer: 1, stroke: 0.9, bevel: false, shape: (c) => {
      for (const q of pipes) for (let t = 0.2; t < 0.9; t += 0.25) { const x = q[0] + (q[2] - q[0]) * t, y = q[1] + (q[3] - q[1]) * t; S.seg(c, x, y, x + 0.01, y); }
    } });
    parts.push({ z0: 11, z1: 13.2, side: metalS, top: mx(metalT, '#ffffff', 0.2), layer: 1, stroke: 2, bevel: false, shape: (c) => { for (const q of pipes) S.seg(c, q[0], q[1], q[2], q[3]); } });
    parts.push({ z0: 13.2, z1: 14.4, side: trim, top: sh(trim, 0.2), layer: 1, stroke: 1.1, bevel: false, shape: (c) => { for (const q of pipes) S.seg(c, q[0] + (q[2] - q[0]) * 0.45, q[1] + (q[3] - q[1]) * 0.45 + 1.2, q[0] + (q[2] - q[0]) * 0.55, q[1] + (q[3] - q[1]) * 0.55 + 1.2); } });
    // beacon lamps on the stack crowns
    parts.push({ z0: 80, z1: 81.6, side: '#7a1a10', top: '#ff5a3a', flat: true, layer: 2, shape: (c) => { S.circ(c, -18 + 4.6, -10, 0.9); S.circ(c, 18 + 3.8, 8, 0.8); } });
    return { r: 66, h: 82, parts: withSorter(parts), style: 'prop', bevel: 0.8,
      spots: { smokeA: [-18, -10, 80], smokeB: [18, 8, 66], steam: [CX, CY, CH], beacon: [-18, -10, 82] } };
  };

  /* =================================================================
   * CRYSTAL CLUSTER — 8 faceted hexagonal prisms leaning outward from a
   * rocky base; three-tone facets (lit / glowing / shaded) picked per heading.
   * ================================================================= */
  M.crystalCluster = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, { a: '#6a8aa8', b: '#bfe4ff', t: '#e0f4ff', g: '#7ff', d: '#2a3a52' });
    const rng = new U.RNG(((opt.seed || 5) * 977 + 3) >>> 0);
    const mid = mx(p.g, p.a, 0.3), lit = mx(p.g, '#ffffff', 0.62), shade = mx(mx(p.a, p.d, 0.55), p.g, 0.15), tip = mx(p.g, '#ffffff', 0.8);
    const parts = [];
    parts.push(stain(46, 36, 0.32, p.d, 0, 4));
    // rock base
    parts.push({ z0: 0, z1: 7, side: mx(p.d, '#30302c', 0.4), top: mx(p.d, p.a, 0.4), layer: -1, ao: 0.4, shape: (c, zt) => {
      const k = 1 - zt * 0.45; S.blob(c, 0, 2, 22 * k, 11, 11, 0.3); S.blob(c, 18, 14, 9 * k, 4, 8, 0.4); S.blob(c, -20, -8, 8 * k, 7, 8, 0.4);
    }, detail: (c) => S.lines(c, 'rgba(0,0,0,0.3)', 0.5, [-10, 4, 2, -2, 6, 8, 14, 4]) });
    const N = 8, cr = [];
    for (let i = 0; i < N; i++) {
      const centre = i === 0;
      const a = centre ? rng.range(0, TAU) : (i / (N - 1)) * TAU + rng.range(-0.3, 0.3);
      const d = centre ? 2 : rng.range(9, 16);
      const H = centre ? rng.range(70, 80) : rng.range(26, 58) * (i % 3 === 0 ? 0.7 : 1);
      const R = centre ? 8.5 : rng.range(4.2, 7.2);
      const lean = centre ? 0.08 : rng.range(0.22, 0.42);
      cr.push({ x: Math.cos(a) * d, y: Math.sin(a) * d + 2, a, H, R, lean, rot: rng.range(0, TAU), el: rng.range(0.75, 1) });
    }
    for (const k of cr) {
      const sect = (zt) => {
        const z = zt * k.H, q = zt < 0.74 ? 1 : Math.max(0.02, (1 - zt) / 0.26);
        const r = k.R * (zt < 0.74 ? 1 - 0.1 * zt : q * 0.92);
        return ngon(6, r, k.rot, k.x + Math.cos(k.a) * k.lean * z, k.y + Math.sin(k.a) * k.lean * z, 1, k.el);
      };
      const at = [k.x, k.y];
      parts.push({ z0: 2, z1: k.H, side: mid, top: tip, flat: true, ao: 0.35, at, shape: (c, zt) => S.poly(c, sect(zt)) });
      parts.push({ z0: 2, z1: k.H, side: lit, top: tip, flat: true, ao: 0.15, bevel: false, at, shape: (c, zt) => { const pts = sect(zt); slivers(c, pts, (sx, sy) => sx < -0.28 && sy > -0.35, Math.min(1.3, k.R * (zt < 0.74 ? 0.45 : 0.3))); } });
      parts.push({ z0: 2, z1: k.H, side: shade, top: shade, flat: true, ao: 0.2, bevel: false, at, shape: (c, zt) => { const pts = sect(zt); slivers(c, pts, (sx, sy) => sx > 0.3 && sy > -0.35, Math.min(1.3, k.R * (zt < 0.74 ? 0.45 : 0.3))); } });
    }
    // small shards scattered at the base
    parts.push({ z0: 0, z1: 9, side: mid, top: lit, flat: true, layer: -1, ao: 0.3, shape: (c, zt) => {
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.4, d = 22 + (i % 3) * 3, r = (2.4 - (i % 2) * 0.7) * (1 - zt); S.poly(c, ngon(4, r + 0.1, a, Math.cos(a) * d + Math.cos(a) * zt * 4, Math.sin(a) * d + 3 + Math.sin(a) * zt * 4)); }
    } });
    return { r: 50, h: 82, parts: withSorter(parts), style: 'prop', bevel: 0.6, spots: { glow: [0, 0, 30] } };
  };

  /* =================================================================
   * GIANT SHROOMS — 4 giant mushrooms: flared stems with a skirt ring,
   * comb-like gills under wide domed caps, glowing spots (top + front side).
   * Cap colour = pal.t, glow = pal.g, stems pale.
   * ================================================================= */
  M.giantShrooms = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, { a: '#6a5a8a', b: '#a090c0', t: '#c0306a', g: '#7fffd0', d: '#2a2040' });
    const capS = sh(p.t, -0.18), capT = mx(p.t, '#ffffff', 0.18), gill = mx(p.d, p.t, 0.35);
    const stemS = mx(p.b, '#e8dccb', 0.55), stemT = mx(p.b, '#ffffff', 0.6), glow = p.g, glowHi = mx(p.g, '#ffffff', 0.6);
    const parts = [];
    parts.push(stain(52, 40, 0.3, p.d, 0, 4));
    // root mound with glowing bulbs
    parts.push({ z0: 0, z1: 4, side: mx(p.d, p.a, 0.3), top: mx(p.d, p.a, 0.6), layer: -1, shape: (c, zt) => { const k = 1 - zt * 0.5; S.blob(c, -6, 2, 24 * k, 2, 12, 0.35); S.blob(c, 22, 14, 10 * k, 5, 9, 0.4); } });
    parts.push({ z0: 0, z1: 3, side: sh(glow, -0.3), top: glowHi, flat: true, layer: -1, shape: (c, zt) => { const k = 1 - zt * 0.4; for (const [x, y, r] of [[-30, 10, 2.2], [-27, 14, 1.5], [12, 30, 1.8], [30, 4, 1.6], [-14, -26, 1.7]]) S.circ(c, x, y, r * k); } });
    const shrooms = opt.layout || [
      { x: -14, y: -10, R: 30, H: 60, bend: [6, -3] },
      { x: 18, y: 8, R: 21, H: 40, bend: [5, 4] },
      { x: -4, y: 24, R: 14, H: 24, bend: [-3, 4] },
      { x: 28, y: -22, R: 10, H: 15, bend: [3, -2] },
    ];
    shrooms.forEach((m, mi) => {
      const at = [m.x, m.y];
      const cx = (z) => m.x + m.bend[0] * Math.sin((z / m.H) * Math.PI / 2), cyy = (z) => m.y + m.bend[1] * Math.sin((z / m.H) * Math.PI / 2);
      const sR = m.R * 0.2;
      // stem: flared foot, slim neck
      parts.push({ z0: 0, z1: m.H, side: stemS, top: stemT, at, ao: 0.45, shape: (c, zt) => { const z = zt * m.H, r = sR * (0.85 + 0.9 * Math.pow(1 - zt, 4)); S.circ(c, cx(z), cyy(z), r); } });
      // skirt ring
      const zs = m.H * 0.72;
      parts.push({ z0: zs - 2, z1: zs, side: sh(stemS, -0.1), top: stemT, at, ao: 0.2, shape: (c, zt) => S.circ(c, cx(zs), cyy(zs), sR * (1.25 + 0.55 * (1 - zt))) });
      // gills: radial comb under the cap
      const capX = cx(m.H), capY = cyy(m.H), CH = m.R * 0.45;
      parts.push({ z0: m.H - 2.5, z1: m.H, side: gill, top: gill, at, stroke: 0.7, bevel: false, ao: 0.1, shape: (c) => { const n = Math.round(m.R * 1.6); for (let i = 0; i < n; i++) { const a = i / n * TAU; S.seg(c, capX + Math.cos(a) * sR, capY + Math.sin(a) * sR, capX + Math.cos(a) * m.R * 0.93, capY + Math.sin(a) * m.R * 0.93); } } });
      // cap dome
      const capR = (zt) => m.R * Math.sqrt(Math.max(0.02, 1 - Math.pow(zt * 0.93, 2))) * (zt < 0.12 ? 0.93 + zt * 0.55 : 1);
      parts.push({ z0: m.H, z1: m.H + CH, side: capS, top: capT, at, ao: 0.35, shape: (c, zt) => S.circ(c, capX, capY, capR(zt)),
        detail: (c) => {
          const r = capR(1);
          for (let i = 0; i < 5; i++) { const a = i * 2.4 + mi, d = r * (0.25 + 0.5 * ((i * 37) % 10) / 10); glowDot(c, glow, capX + Math.cos(a) * d, capY + Math.sin(a) * d, 2.6, 0.55); S.dot(c, glowHi, capX + Math.cos(a) * d, capY + Math.sin(a) * d, 0.9 + (i % 2) * 0.4); }
        } });
      // glowing spots on the visible side of the dome
      const spots = [];
      for (let i = 0; i < Math.round(m.R * 0.7); i++) spots.push([i * 2.39 + mi * 0.7, 0.18 + ((i * 53) % 60) / 100, 0.9 + ((i * 31) % 5) * 0.22 * (m.R / 22)]);
      parts.push({ z0: m.H, z1: m.H + CH, side: glow, top: glowHi, flat: true, ao: 0, bevel: false, at, shape: (c, zt) => {
        for (const sp of spots) {
          const dz = Math.abs(zt - sp[1]) * CH * 1.8; if (dz > sp[2]) continue;
          const nx = Math.cos(sp[0]), ny = Math.sin(sp[0]);
          if (!facing(c, nx, ny, 0.2)) continue;
          const rr = capR(zt) + 0.3, w = Math.sqrt(sp[2] * sp[2] - dz * dz) / rr;
          c.moveTo(capX + Math.cos(sp[0] - w) * rr, capY + Math.sin(sp[0] - w) * rr);
          c.arc(capX, capY, rr, sp[0] - w, sp[0] + w); c.arc(capX, capY, rr - 0.9, sp[0] + w, sp[0] - w, true); c.closePath();
        }
      } });
    });
    return { r: 50, h: 88, parts: withSorter(parts), style: 'prop', bevel: 0.7, spots: { glow: [-14, -10, 70] } };
  };

  /* =================================================================
   * GIANT GEAR — a colossal toothed wheel tilted ~60° and half-buried, with
   * spokes (open between them), a raised rim, a hub boss, plus broken pipes.
   * The tilted disc is rendered as horizontal chords per slice.
   * ================================================================= */
  M.giantGear = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, null);
    const rust = mx(p.a, '#9a5a32', 0.55), rustT = mx(p.b, '#c08454', 0.5), rim = mx(rustT, '#e0b080', 0.35), hubC = sh(p.a, -0.3);
    const TH = (opt.tilt || 30) * Math.PI / 180, st = Math.sin(TH), ct = Math.cos(TH);
    const RO = 44, RT = 51, RI = 36, RH = 11, NT = 20, T = 8, SPOKES = 6;
    const zc = opt.tilt > 45 ? 13 : 7; // centre height: below -zc/st of the disc is under ground
    const gx = 0, gy = 6, ga = 0.25; // centre offset & in-plane rotation
    const toothR = (th) => { const u = ((th / TAU) * NT % 1 + 1) % 1; return u < 0.18 || u > 0.82 ? RT : u < 0.3 ? RT - (RT - RO) * (u - 0.18) / 0.12 : u > 0.7 ? RO + (RT - RO) * (u - 0.7) / 0.12 : RO; };
    const member = (u, v, which) => {
      const r = Math.hypot(u, v); const th = Math.atan2(v, u) + ga;
      if (which === 'rim') return r >= RI && r <= toothR(th);
      if (which === 'hub') return r <= RH + 3;
      if (r > toothR(th)) return false;
      if (r >= RI || r <= RH) return r > 3.2;
      const sp = ((th / TAU) * SPOKES % 1 + 1) % 1, w = 3.6 / r * SPOKES / TAU; // spoke half-width in turns
      return sp < w || sp > 1 - w;
    };
    // chord intervals of the disc at slice height z (offset along the normal by off)
    const chords = (c, z, which, off, halfT) => {
      const v = (z - zc - off * ct) / st, yc = gy - v * ct + off * st, hw = halfT / st;
      let run = null;
      for (let u = -RT; u <= RT + 0.5; u += 0.5) {
        const ins = u <= RT && member(u, v, which);
        if (ins && run === null) run = u;
        if (!ins && run !== null) { c.rect(gx + run, yc - hw, u - run, hw * 2); run = null; }
      }
    };
    const ZT = zc + RT * st + 4;
    const parts = [];
    parts.push(stain(60, 44, 0.3, '#1a120c', 0, 8));
    // buried-edge rubble mound
    parts.push({ z0: 0, z1: 4, side: sh(rust, -0.45), top: sh(rust, -0.25), layer: -1, ao: 0.3, shape: (c, zt) => {
      const k = 1 - zt * 0.5, yb = gy + (zc / st) * ct;
      for (let i = 0; i < 7; i++) S.blob(c, -44 + i * 14.5, yb + Math.sin(i * 2.1) * 3, (6 + (i % 3) * 2) * k, i + 2, 8, 0.4);
    } });
    // broken pipes lying on the ground
    parts.push({ z0: 0, z1: 9, side: mx(p.a, '#5a6068', 0.4), top: mx(p.b, '#9aa0a8', 0.3), at: [-30, -24], shape: (c, zt) => { const v = zt * 2 - 1, hw = 4.5 * Math.sqrt(Math.max(0.05, 1 - v * v)); S.poly(c, tf([-24, -hw, 14, -hw, 18, -hw * 0.3, 15, hw * 0.2, 17, hw, -24, hw], -30, -24, -0.35)); },
      detail: (c) => { const q = tf([15.5, 0], -30, -24, -0.35); S.dot(c, '#1a1a1a', q[0], q[1], 3); S.lines(c, 'rgba(0,0,0,0.35)', 0.5, tf([-14, -4, -14, 4, -4, -4, -4, 4], -30, -24, -0.35)); } });
    parts.push({ z0: 0, z1: 10, side: sh(rust, -0.15), top: rustT, at: [-30, -24], shape: (c, zt) => { const v = zt * 2 - 1, hw = 6 * Math.sqrt(Math.max(0.05, 1 - v * v)); S.poly(c, tf([-25, -hw, -22, -hw, -22, hw, -25, hw], -30, -24, -0.35)); } });
    parts.push({ z0: 0, z1: 26, side: mx(p.a, '#5a6068', 0.4), top: mx(p.b, '#9aa0a8', 0.3), at: [36, -22], shape: (c, zt) => { const x = 36 + zt * 5, y = -22 - zt * 3; S.circ(c, x, y, 3.6); },
      detail: (c) => { S.dot(c, '#141414', 41, -25, 2.4); } });
    parts.push({ z0: 18, z1: 20, side: sh(rust, -0.15), top: rustT, at: [36, -22], shape: (c) => S.circ(c, 36 + 4, -22 - 2.4, 4.8) });
    // the gear: spokes/web, then the raised rim, then the hub boss
    parts.push({ z0: 0, z1: ZT, side: rust, top: rustT, at: [gx, gy], ao: 0.55, shape: (c, zt) => chords(c, zt * ZT, 'web', 0, T / 2) });
    parts.push({ z0: 0, z1: ZT, side: rim, top: mx(rim, '#ffffff', 0.25), flat: true, ao: 0.4, bevel: false, at: [gx, gy], shape: (c, zt) => chords(c, zt * ZT, 'rim', 1.2, T / 2) });
    parts.push({ z0: 0, z1: ZT, side: hubC, top: sh(hubC, 0.3), ao: 0.2, bevel: false, at: [gx, gy], shape: (c, zt) => chords(c, zt * ZT, 'hub', 3.5, T / 2) });
    return { r: 64, h: ZT + 2, parts: withSorter(parts), style: 'prop', bevel: 0.7, spots: { sparks: [36, -22, 24], hub: [gx, gy + 3 * st, zc + 3] } };
  };

  /* =================================================================
   * CONVOY HULK — burned-out convoy vehicle, ~46 long. opt.seed picks the
   * variant: 0 box truck, 1 tanker, 2 tracked crawler. Rust, scorch, missing
   * panels with exposed frames, flat tyres, a slight list to one side.
   * ================================================================= */
  M.convoyHulk = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, null);
    const seed = opt.seed || 0, v = opt.kind !== undefined ? opt.kind % 3 : Math.abs(Math.floor(seed / 17)) % 3;
    const rng = new U.RNG(((seed + 1) * 4243) >>> 0);
    const burnt = '#3a302a', burntT = '#5a4a3e', rust = '#8a4a2a', rustT = '#a8643a', paint = mx(p.b, '#a89a88', 0.3), paintS = mx(p.a, '#5a5048', 0.4);
    const tyre = '#1c1a18', frame = '#2c2622';
    const list = rng.range(0.05, 0.11) * (rng.next() < 0.5 ? 1 : -1); // lateral lean per unit height
    const L = (z) => list * z;
    const parts = [];
    parts.push(stain(30, 20, 0.45, '#120c08'));
    // wheels / tracks
    if (v === 2) {
      parts.push({ z0: 0, z1: 6, side: tyre, top: '#3a3430', ao: 0.2, shape: (c) => { S.rrect(c, -22, -13, 44, 6.5, 3); S.rrect(c, -22, 6.5, 44, 6.5, 3); },
        detail: (c) => { const segs = []; for (let x = -20; x <= 20; x += 2.6) segs.push(x, -12.6, x, -6.9, x, 6.9, x, 12.6); S.lines(c, 'rgba(0,0,0,0.5)', 0.5, segs); } });
      // a thrown track lying behind
      parts.push({ z0: 0, z1: 1.2, side: tyre, top: '#3a3430', shape: (c) => S.poly(c, [-24, 8, -36, 13, -40, 20, -38, 22, -33, 16, -23, 12]) });
    } else {
      parts.push({ z0: 0, z1: 6.5, side: tyre, top: '#34302c', ao: 0.15, shape: (c, zt) => {
        const k = 0.6 + 0.4 * Math.sqrt(1 - Math.pow(zt * 2 - 1, 2));
        for (const x of [15, -6, -14]) for (const sg of [1, -1]) { if (x === -14 && v === 0 && sg < 0) continue; S.rrect(c, x - 4 * k, sg * 10.5 - 2, 8 * k, 4, 1.6); }
      }, detail: (c) => { for (const x of [15, -6, -14]) for (const sg of [1, -1]) S.dot(c, rustT, x, sg * 10.5, 1.2); } });
    }
    // chassis rails
    parts.push({ z0: 3, z1: 5.5, side: frame, top: '#4a3e36', shape: (c, zt) => { S.rrect(c, -22 + L(4), -7, 44, 3, 0.8); S.rrect(c, -22 + 0, 4, 44, 3, 0.8); } });
    // cab (front, +x)
    const cabH = v === 2 ? 15 : 14;
    parts.push({ z0: 5, z1: cabH, side: v === 2 ? burnt : paintS, top: v === 2 ? burntT : paint, ao: 0.5, shape: (c, zt) => { const z = 5 + zt * (cabH - 5), k = 1 - zt * 0.12; S.rrect(c, 11 + (1 - k) * 4, -9 * k + L(z), 12 * k, 18 * k, 2); },
      detail: (c) => {
        const o = L(cabH);
        c.fillStyle = '#141210'; c.beginPath(); S.poly(c, [21, -7 + o, 23, -5 + o, 23, 5 + o, 21, 7 + o]); c.fill();
        S.lines(c, 'rgba(255,255,255,0.35)', 0.4, [22, -4 + o, 22.6, -1 + o]);
        scorch(c, 15, 1 + o, 8, 0.9); scorch(c, 19, -5 + o, 4, 0.7);
        if (v !== 2) S.fillPoly(c, p.t, [12, 7 + o, 17, 7 + o, 17, 8.4 + o, 12, 8.4 + o]);
        c.fillStyle = '#18120e'; c.beginPath(); S.poly(c, [13, -3 + o, 17, -4 + o, 18, 1 + o, 14, 2 + o]); c.fill();
      } });
    if (v === 0) {
      // cargo box: walls with missing panels, frame ribs over the open roof
      const panels = [];
      for (let i = 0; i < 6; i++) for (const sg of [1, -1]) if (rng.next() < 0.72) panels.push([-21 + i * 5, sg]);
      parts.push({ z0: 5, z1: 17, side: paintS, top: paint, ao: 0.5, shape: (c, zt) => { const z = 5 + zt * 12; for (const pn of panels) { const y = pn[1] > 0 ? 7.6 : -9; S.rect(c, pn[0] + L(z) * 0.0, y + L(z), 5.1, 1.4); } S.rect(c, -22, -9 + L(z), 1.4, 18); },
        detail: (c) => { const o = L(17); for (const pn of panels) if (rng.next() < 0.5) S.fillPoly(c, rust, [pn[0], (pn[1] > 0 ? 7.6 : -9) + o, pn[0] + 5, (pn[1] > 0 ? 7.6 : -9) + o, pn[0] + 5, (pn[1] > 0 ? 9 : -7.6) + o, pn[0], (pn[1] > 0 ? 9 : -7.6) + o]); } });
      parts.push({ z0: 5, z1: 5.8, side: burnt, top: '#241c18', shape: (c) => S.rect(c, -22, -8, 31, 16), detail: (c) => { scorch(c, -8, 0, 12, 0.9); S.lines(c, rust, 0.8, [-18, -4, -10, 3, -4, -6, 2, 5]); for (let i = 0; i < 5; i++) S.fillPoly(c, '#5a4a3e', [-19 + i * 6, -3 + i % 2 * 4, -16 + i * 6, -2 + i % 2 * 4, -17 + i * 6, 1 + i % 2 * 4]); } });
      parts.push(archPart([-18, -12, -6, 0, 6].map((x) => ({ x: x + L(10), y: L(10), nx: 0, ny: 1, w: 8.4, h: 13 })), 18, 0.9, frame, rustT, { z0: 0, z1: 18 }));
    } else if (v === 1) {
      // tanker: a long cylinder, split and blackened, rust streaks
      parts.push({ z0: 4, z1: 17, side: paintS, top: paint, ao: 0.4, shape: (c, zt) => { const vv = zt * 2 - 1, hw = 8.5 * Math.sqrt(Math.max(0.05, 1 - vv * vv)); const z = 4 + zt * 13; S.rrect(c, -23, -hw + L(z), 32, hw * 2, Math.min(hw, 5)); },
        detail: (c) => { const o = L(17); scorch(c, -6, o, 11, 0.95); c.fillStyle = '#100c0a'; c.beginPath(); S.poly(c, [-10, -2 + o, -3, -3 + o, -1, 1 + o, -8, 2.5 + o]); c.fill(); S.lines(c, rust, 0.9, [-20, -3 + o, -14, -3 + o, 2, 2 + o, 7, 2 + o]); S.lines(c, 'rgba(0,0,0,0.4)', 0.45, [-12, -8 + o, -12, 8 + o, 0, -8 + o, 0, 8 + o]); S.fillPoly(c, p.t, [4, -8 + o, 7, -8 + o, 7, 8 + o, 4, 8 + o]); } });
    } else {
      // crawler: armoured hull with a dorsal turret ring (turret gone), exposed engine bay
      parts.push({ z0: 5, z1: 13, side: burnt, top: burntT, ao: 0.5, shape: (c, zt) => { const z = 5 + zt * 8, k = 1 - zt * 0.1; S.poly(c, [12, -10 * k + L(z), 12, 10 * k + L(z), -20 * k, 10 * k + L(z), -23 * k, 5 + L(z), -23 * k, -5 + L(z), -20 * k, -10 * k + L(z)]); },
        detail: (c) => { const o = L(13); c.fillStyle = '#120e0c'; c.beginPath(); c.arc(-3, o, 5.5, 0, TAU); c.fill(); S.lines(c, rustT, 0.8, [-3, o - 5.5, -3, o + 5.5]); c.fillStyle = '#16100c'; c.beginPath(); S.rrect(c, -20, -6 + o, 8, 12, 1); c.fill(); S.lines(c, rust, 0.7, [-19, -4 + o, -13, -4 + o, -19, 0 + o, -13, 0 + o, -19, 4 + o, -13, 4 + o]); scorch(c, 4, -4 + o, 7, 0.8); S.fillPoly(c, p.t, [6, 8.4 + o, 11, 8.4 + o, 11, 9.6 + o, 6, 9.6 + o]); } });
      // the toppled turret lying beside
      parts.push({ z0: 0, z1: 6, side: burnt, top: burntT, shape: (c) => { S.circ(c, -6, -20, 5.5); S.poly(c, [-2, -21, 14, -27, 15, -25, -1, -18.6]); }, detail: (c) => { scorch(c, -6, -20, 5, 0.8); } });
    }
    // scattered panels / debris
    parts.push({ z0: 0, z1: 1.2, side: frame, top: rust, shape: (c) => { for (let i = 0; i < 5; i++) { const x = rng.range(-30, 30), y = rng.range(14, 20) * (i % 2 ? 1 : -1), s = rng.range(1.6, 3.2), a = rng.range(0, TAU); S.poly(c, tf([s, 0, 0, s * 0.8, -s, 0.2, -0.2, -s * 0.7], x, y, a)); } } });
    return { r: 42, h: 20, parts, style: 'prop', bevel: 0.7, spots: { smoke: [14, 0, 14] } };
  };

  /* =================================================================
   * DROWNED TOWER — the top of a skyscraper breaking the sea: window-grid
   * floors (only the faces turned to the viewer are slotted), algae-stained
   * waterline with foam, broken upper floors with exposed columns and rebar,
   * rooftop AC units / water tank, or a helipad roof (opt.helipad). opt.seed
   * varies footprint and height. Model z = 0 is the water surface.
   * ================================================================= */
  M.drownedTower = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, null);
    const seed = opt.seed || 5, rng = new U.RNG(((seed + 3) * 7919) >>> 0);
    const kind = Math.abs(seed) % 3;
    if (opt.helipad === undefined) opt = Object.assign({}, opt, { helipad: Math.floor(Math.abs(seed) / 17) % 2 === 1 });
    const W = kind === 1 ? 34 : rng.range(40, 48), D = kind === 1 ? 34 : rng.range(30, 36);
    const H = Math.round(rng.range(26, 44) + (opt.helipad ? 0 : 6));
    const foot = kind === 2
      ? [W / 2, -D / 2, W / 2, D / 2, -W / 2 + 12, D / 2, -W / 2 + 12, D / 2 - 12, -W / 2, D / 2 - 12, -W / 2, -D / 2]
      : [W / 2 - 3, -D / 2, W / 2, -D / 2 + 3, W / 2, D / 2 - 3, W / 2 - 3, D / 2, -W / 2 + 3, D / 2, -W / 2, D / 2 - 3, -W / 2, -D / 2 + 3, -W / 2 + 3, -D / 2];
    const conc = mx(p.b, '#d8d2c4', 0.4), concS = mx(p.a, '#8a8478', 0.35), glass = '#1c2a36', lit = '#ffd88a', algae = '#2e4a36';
    const FL = 5; // floor height
    const broken = !opt.helipad && rng.next() < 0.75;
    const parts = [];
    // foam ring at the waterline
    parts.push({ z0: 0, z1: 0.8, side: '#cfeee8', top: '#e6fbf6', flat: true, layer: -1, ao: 0, shape: (c) => { S.poly(c, foot.map((v, i) => v * (1 + 2.6 / (i % 2 ? D / 2 : W / 2)))); } });
    // algae / waterline staining band
    parts.push({ z0: 0, z1: 3.2, side: algae, top: algae, ao: 0.3, bevel: false, shape: (c) => S.poly(c, foot.map((v, i) => v * (1 + 0.35 / (i % 2 ? D / 2 : W / 2)))) });
    // tower body
    parts.push({ z0: 0, z1: H, side: concS, top: conc, ao: 0.2, shape: (c) => S.poly(c, foot),
      detail: (c) => {
        S.lines(c, 'rgba(0,0,0,0.28)', 0.5, [-W / 2 + 2, -D / 2 + 2, W / 2 - 2, -D / 2 + 2, -W / 2 + 2, D / 2 - 2, W / 2 - 2, D / 2 - 2]);
        if (opt.helipad) {
          c.fillStyle = '#4a4e52'; c.beginPath(); c.arc(0, 0, Math.min(W, D) * 0.4, 0, TAU); c.fill();
          c.strokeStyle = '#e8e2d0'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, Math.min(W, D) * 0.34, 0, TAU); c.stroke();
          S.lines(c, '#f2c84a', 1.6, [-4, -5, -4, 5, 4, -5, 4, 5, -4, 0, 4, 0]);
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = Math.min(W, D) * 0.4; S.dot(c, '#7fe8ff', Math.cos(a) * r, Math.sin(a) * r, 0.7); }
        } else {
          c.fillStyle = 'rgba(40,46,40,0.35)'; c.beginPath(); S.blob(c, -W * 0.2, D * 0.1, 7, 3, 9, 0.5); c.fill();
          S.lines(c, 'rgba(0,0,0,0.3)', 0.5, [W * 0.1, -D / 2 + 3, W * 0.3, D * 0.1]);
        }
      } });
    // windows: slotted bands on the faces turned to the viewer
    const edges = [];
    for (let i = 0; i < foot.length / 2; i++) { const j = (i + 1) % (foot.length / 2); edges.push([foot[i * 2], foot[i * 2 + 1], foot[j * 2], foot[j * 2 + 1]]); }
    const winPart = (col, sel) => ({ z0: 0, z1: H - 1.5, side: col, top: col, flat: true, ao: 0, bevel: false, shape: (c, zt) => {
      const z = zt * (H - 1.5), f = z % FL;
      if (f < 1.6 || f > 4.2 || z < 2) return;
      const fi = Math.floor(z / FL);
      for (let e = 0; e < edges.length; e++) {
        const [x0, y0, x1, y1] = edges[e], len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 6) continue;
        const ux = (x1 - x0) / len, uy = (y1 - y0) / len; let nx = uy, ny = -ux;
        if (nx * (x0 + x1) + ny * (y0 + y1) < 0) { nx = -nx; ny = -ny; }
        if (!facing(c, nx, ny, 0.08)) continue;
        const n = Math.floor((len - 2) / 3.6);
        for (let w = 0; w < n; w++) {
          if (!sel(fi, e, w)) continue;
          const t0 = 1.6 + w * 3.6, t1 = t0 + 2.4;
          const ax = x0 + ux * t0, ay = y0 + uy * t0, bx = x0 + ux * t1, by = y0 + uy * t1;
          c.moveTo(ax + nx * 0.3, ay + ny * 0.3); c.lineTo(bx + nx * 0.3, by + ny * 0.3); c.lineTo(bx - nx * 0.6, by - ny * 0.6); c.lineTo(ax - nx * 0.6, ay - ny * 0.6); c.closePath();
        }
      }
    } });
    const hsh = (a, b, cc) => U.hash2(a * 7 + cc, b * 13 + seed, 3);
    parts.push(winPart(glass, (f, e, w) => hsh(f, e * 31 + w, 1) > 0.08));
    parts.push(winPart(lit, (f, e, w) => hsh(f, e * 31 + w, 1) > 0.08 && hsh(f, e * 31 + w, 2) > 0.9));
    if (broken) {
      // a ragged storey of the next floors: corner walls, exposed columns, rebar
      const H2 = H + FL * 2;
      const cx = (rng.next() < 0.5 ? -1 : 1) * W * 0.18, cy = (rng.next() < 0.5 ? -1 : 1) * D * 0.15;
      const ruin = [cx + W * 0.32, cy - D * 0.32, cx + W * 0.32, cy + D * 0.3, cx - W * 0.1, cy + D * 0.3, cx - W * 0.3, cy + D * 0.05, cx - W * 0.3, cy - D * 0.32];
      parts.push({ z0: H, z1: H2, side: concS, top: conc, at: [cx, cy], ao: 0.3, shape: (c, zt) => {
        const z = H + zt * (H2 - H), q = zt;
        // the ruin crumbles toward one end: clip by height
        polyOK(c, clipX(ruin, cx + W * 0.32 - q * W * 0.5 - (U.hash2(Math.floor(z), seed, 4) * 3)));
      }, detail: (c) => { scorch(c, cx, cy, 8, 0.5); } });
      parts.push(winPart(glass, () => true));
      parts[parts.length - 1].z0 = H + 0.5; parts[parts.length - 1].z1 = H + FL - 0.5;
      const cols = [[-W / 2 + 3, -D / 2 + 3], [W / 2 - 3, D / 2 - 3], [-W / 2 + 3, D / 2 - 3], [0, -D / 2 + 3]];
      parts.push({ z0: H, z1: H + FL * 2.4, side: concS, top: conc, stroke: 1.6, bevel: false, ao: 0, shape: (c, zt) => { const z = H + zt * FL * 2.4; cols.forEach((q, i) => { if (z < H + FL * (1.2 + (i % 3) * 0.6)) S.seg(c, q[0], q[1], q[0] + 0.01, q[1]); }); } });
      const reb = [];
      for (let i = 0; i < 10; i++) { const q = cols[i % cols.length]; const a = rng.range(0, TAU), hz = rng.range(2, 6); reb.push(((q, a, hz, b) => (z) => { if (z > b + hz) return null; const t = (z - b) / hz; return [q[0] + Math.cos(a) * t * t * 2.5, q[1] + Math.sin(a) * t * t * 2.5]; })(q, a, hz, H + FL * (1.2 + (i % 3) * 0.6))); }
      parts.push(curvePart(reb, H + FL, H + FL * 3.4, 0.45, '#5a3a2a', '#8a5a3a', { ao: 0 }));
    }
    if (!opt.helipad) {
      // rooftop plant: AC units with fans, a water tank
      const ac = broken ? [[W / 2 - 9, -D / 2 + 6]] : [[W / 2 - 9, -D / 2 + 6], [W / 2 - 9, D / 2 - 7], [-W / 2 + 9, -D / 2 + 7]];
      parts.push({ z0: H, z1: H + 3.4, side: '#7a7e84', top: '#b4b8bc', shape: (c) => { for (const q of ac) S.rrect(c, q[0] - 4.5, q[1] - 3, 9, 6, 0.8); },
        detail: (c) => { for (const q of ac) { S.dot(c, '#2a2e32', q[0] - 2, q[1], 2.1); S.dot(c, '#2a2e32', q[0] + 2.4, q[1], 2.1); S.lines(c, '#6a6e72', 0.4, [q[0] - 3.6, q[1], q[0] - 0.4, q[1], q[0] + 0.8, q[1], q[0] + 4, q[1]]); } } });
      if (!broken) parts.push({ z0: H, z1: H + 9, side: '#5a6068', top: '#8a9098', shape: (c, zt) => S.circ(c, -W / 2 + 9, D / 2 - 9, zt > 0.85 ? 4 * (1 - (zt - 0.85) * 3) : 4) });
    } else {
      parts.push({ z0: H, z1: H + 1.4, side: '#3a3e42', top: '#9aa0a6', stroke: 0.6, bevel: false, shape: (c) => S.poly(c, foot.map((v) => v * 0.97)) });
    }
    // antenna mast with the beacon (data fx: beacon at dx 0, dy 0, z 50)
    const MX = opt.helipad ? W / 2 - 3.5 : 0.5, MY = opt.helipad ? -D / 2 + 3.5 : 0.5, MZ = broken ? H + FL * 2.4 : H + 12;
    parts.push({ z0: broken ? H + FL * 2 : H, z1: MZ, side: '#3a3e44', top: '#9aa0a8', stroke: 0.7, bevel: false, shape: (c) => S.seg(c, MX, MY, MX + 0.01, MY) });
    parts.push({ z0: MZ, z1: MZ + 1.4, side: '#7a1a10', top: '#ff5a3a', flat: true, shape: (c) => S.circ(c, MX, MY, 0.9) });
    const r = Math.hypot(W, D) / 2 + 6;
    return { r: Math.ceil(r), h: Math.ceil(Math.max(MZ + 2, H + FL * 3.4)), parts: withSorter(parts), style: 'prop', bevel: 0.8, spots: { beacon: [MX, MY, MZ + 1], roof: [0, 0, H] } };
  };

  /* =================================================================
   * COLONY RUINS — a ruined frontier block: broken prefab walls (L-runs with
   * ragged panel heights and window gaps), a collapsed hab dome shell with its
   * frame exposed, snapped pillars with rebar, rubble and scorch. opt.seed.
   * ================================================================= */
  M.colonyRuins = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, null);
    const seed = opt.seed || 5, rng = new U.RNG(((seed + 11) * 2671) >>> 0);
    const wallS = mx(p.a, p.b, 0.4), wallT = mx(p.b, '#ece8e0', 0.4), floorC = mx(mx(p.a, p.d, 0.5), '#5a5650', 0.35), trim = p.t;
    const parts = [];
    parts.push(stain(62, 50, 0.3, '#16100c'));
    // floor slabs (cracked, some missing)
    const slabs = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 0; j++) if (rng.next() < 0.85) slabs.push([i * 27 + rng.range(-1, 1), j * 27 + 12 + rng.range(-1, 1), rng.range(-0.04, 0.04)]);
    parts.push({ z0: 0, z1: 0.7, side: sh(floorC, -0.25), top: floorC, layer: -2, bevel: false, shape: (c) => { for (const s of slabs) S.poly(c, tf([-13.2, -13.2, 13.2, -13.2, 13.2, 13.2, -13.2, 13.2], s[0], s[1], s[2])); },
      detail: (c) => { for (const s of slabs) if (U.hash2(s[0], s[1], seed) > 0.6) scorch(c, s[0], s[1], 9, 0.5); S.lines(c, 'rgba(0,0,0,0.3)', 0.45, [-30, -10, -10, 4, 8, -24, 20, -6]); } });
    // walls: L-shaped runs of prefab panels; each panel has its own broken height
    const runs = [
      [[-40, -34], [6, -34], [6, -14]],
      [[-40, -30], [-40, 18]],
      [[14, 28], [44, 28], [44, -6]],
      [[-22, 30], [-4, 30]],
    ];
    const panels = [];
    runs.forEach((run, ri) => {
      for (let k = 0; k < run.length - 1; k++) {
        const [ax, ay] = run[k], [bx, by] = run[k + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 6));
        for (let i = 0; i < n; i++) {
          const r = rng.next();
          if (r < 0.12) continue; // missing panel
          const h = r < 0.35 ? rng.range(3, 6) : r < 0.75 ? rng.range(8, 12) : rng.range(13, 17);
          panels.push({ x0: ax + (bx - ax) * i / n, y0: ay + (by - ay) * i / n, x1: ax + (bx - ax) * (i + 1) / n, y1: ay + (by - ay) * (i + 1) / n, h, win: rng.next() < 0.45, slope: rng.range(-0.5, 0.5), run: ri });
        }
      }
    });
    // group panels by run so each run depth-sorts as one wall
    runs.forEach((run, ri) => {
      const ps = panels.filter((q) => q.run === ri);
      if (!ps.length) return;
      const top = Math.max.apply(null, ps.map((q) => q.h));
      let ax = 0, ay = 0; for (const q of ps) { ax += q.x0 + q.x1; ay += q.y0 + q.y1; } ax /= ps.length * 2; ay /= ps.length * 2;
      parts.push({ z0: 0, z1: top, side: wallS, top: wallT, at: [ax, ay], ao: 0.45, shape: (c, zt) => {
        const z = zt * top;
        for (const q of ps) {
          if (q.win && z > 5 && z < 8.5) continue;
          const len = Math.hypot(q.x1 - q.x0, q.y1 - q.y0), ux = (q.x1 - q.x0) / len, uy = (q.y1 - q.y0) / len;
          // ragged top: the panel's usable length shrinks toward one end above its height - 3
          let t0 = 0, t1 = 1;
          if (z > q.h) continue;
          if (z > q.h - 3) { const cut = (z - (q.h - 3)) / 3; if (q.slope > 0) t1 = 1 - cut * 0.7; else t0 = cut * 0.7; }
          const x0 = q.x0 + (q.x1 - q.x0) * t0, y0 = q.y0 + (q.y1 - q.y0) * t0, x1 = q.x0 + (q.x1 - q.x0) * t1, y1 = q.y0 + (q.y1 - q.y0) * t1;
          const w = 1.3;
          c.moveTo(x0 - uy * w - ux * 0.2, y0 + ux * w - uy * 0.2); c.lineTo(x1 - uy * w + ux * 0.2, y1 + ux * w + uy * 0.2); c.lineTo(x1 + uy * w + ux * 0.2, y1 - ux * w + uy * 0.2); c.lineTo(x0 + uy * w - ux * 0.2, y0 - ux * w - uy * 0.2); c.closePath();
        }
      } });
      // amber hazard band near the base of standing panels (front faces)
      parts.push({ z0: 1.5, z1: 2.8, side: trim, top: trim, flat: true, ao: 0, bevel: false, at: [ax, ay], shape: (c) => {
        for (const q of ps) {
          if (q.h < 5) continue;
          const len = Math.hypot(q.x1 - q.x0, q.y1 - q.y0), ux = (q.x1 - q.x0) / len, uy = (q.y1 - q.y0) / len;
          for (const sg of [1, -1]) { if (!facing(c, -uy * sg, ux * sg, 0.1)) continue; c.moveTo(q.x0 - uy * 1.6 * sg, q.y0 + ux * 1.6 * sg); c.lineTo(q.x1 - uy * 1.6 * sg, q.y1 + ux * 1.6 * sg); c.lineTo(q.x1 - uy * 1.0 * sg, q.y1 + ux * 1.0 * sg); c.lineTo(q.x0 - uy * 1.0 * sg, q.y0 + ux * 1.0 * sg); c.closePath(); }
        }
      } });
    });
    // collapsed hab dome: a shell with a broken sector, frame ribs across the gap
    const DX = 22, DY = -8, DR = 19, DH = 15;
    const gapA = rng.range(0, TAU), gapW = 2.2;
    parts.push({ z0: 0, z1: 1.6, side: sh(floorC, -0.2), top: mx(floorC, '#2a2622', 0.5), at: [DX, DY - 0.1], shape: (c) => S.circ(c, DX, DY, DR), detail: (c) => { scorch(c, DX + Math.cos(gapA) * 6, DY + Math.sin(gapA) * 6, 12, 0.85); for (let i = 0; i < 6; i++) S.fillPoly(c, wallS, tf([2.4, 0, 0, 2, -2.2, 0.4, -0.4, -1.8], DX + Math.cos(gapA + i) * (5 + i * 1.6), DY + Math.sin(gapA + i) * (5 + i * 1.6), i)); } });
    parts.push({ z0: 0, z1: DH, side: mx(p.b, '#d8d4cc', 0.3), top: mx(p.b, '#ffffff', 0.4), at: [DX, DY], stroke: 2.2, ao: 0.4, bevel: false, shape: (c, zt) => {
      if (zt > 0.8) return; // the crown has fallen in
      const r = DR * Math.sqrt(Math.max(0.02, 1 - zt * zt)) - 1.1, w = gapW * (0.6 + 1.1 * zt * zt) + 0.25 * Math.sin(zt * 23);
      c.moveTo(DX + Math.cos(gapA + w / 2) * r, DY + Math.sin(gapA + w / 2) * r); c.arc(DX, DY, r, gapA + w / 2, gapA + TAU - w / 2);
    } });
    const ribs = [-0.35, 0, 0.35].map((o) => { const a = gapA + o; return { x: DX + Math.cos(a) * 0, y: DY + Math.sin(a) * 0, nx: Math.cos(a), ny: Math.sin(a), w: DR - 1.2, h: DH, one: 1 }; });
    parts.push(archPart(ribs, DH, 0.9, '#3a3e44', '#9aa0a8', { at: [DX, DY + 0.1] }));
    // pillars with rebar
    const pillars = [[-24, -6, 15], [-8, 14, 11], [26, 18, 18]];
    for (const [x, y, h] of pillars) {
      parts.push({ z0: 0, z1: h, side: wallS, top: wallT, at: [x, y], ao: 0.4, shape: (c, zt) => { const z = zt * h; if (z > h - 2.5) S.poly(c, [x - 2, y - 2, x + 2 - (z - h + 2.5), y - 2, x + 2 - (z - h + 2.5), y + 2, x - 2, y + 2]); else S.rect(c, x - 2, y - 2, 4, 4); } });
      parts.push(curvePart([[-1, -1], [1, 1], [1, -1]].map((o, i) => (z) => { if (z > h + 3 + i) return null; const t = Math.max(0, z - h) / (3 + i); return [x + o[0] + t * t * 2 * o[0], y + o[1] + t * t * 2 * (i - 1)]; }), h - 1, h + 5, 0.45, '#5a3a2a', '#8a5a3a', { at: [x, y + 0.05], ao: 0 }));
    }
    // rubble heaps
    parts.push({ z0: 0, z1: 4.5, side: sh(wallS, -0.15), top: sh(wallT, -0.1), layer: -1, ao: 0.4, shape: (c, zt) => {
      const k = 1 - zt * 0.6;
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + seed, d = 30 + (i % 3) * 8; S.blob(c, Math.cos(a) * d * 0.9, Math.sin(a) * d * 0.75, (3 + (i % 4)) * k, i + seed, 7, 0.45); }
      S.blob(c, -30, 6, 7 * k, 2, 8, 0.4); S.blob(c, 6, -26, 6 * k, 3, 8, 0.4);
    } });
    const sc = opt.scale || 1.25;
    return { r: 60, h: DH + 6, scale: sc, parts: withSorter(parts), style: 'prop', bevel: 0.7, spots: { smoke: [DX * sc, DY * sc, 4 * sc] } };
  };
})(window.AS);
