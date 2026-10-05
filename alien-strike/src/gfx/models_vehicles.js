/* ALIEN STRIKE — redesigned vehicles + aircraft (package: vehicles).
 * New generators only (ve*): raider bike, artillery, heavy tanks, repair truck,
 * mining crawler, walkers, drones, boats, buoy turret, convoy hauler and the
 * friendly FRC tank + gunship. Object space: +x forward, +y starboard, world units.
 * Hulls that carry a separate rotating gun sheet keep a turret ring at (0,0) whose
 * deck sits at z ~7 (the game draws the gun at z + gunZ, default 7). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------------- shared helpers ---------------- */
  const P = (p, d) => Object.assign({}, d, p || {});
  // colour helper: returns '#rrggbb' (usable both as a part side/top and as a canvas
  // fillStyle) or an rgba() string when an alpha is given
  const hx2 = (v) => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
  const css = (c, f, a) => {
    if (a !== undefined) return C.css(c, f || 0, a);
    const k = f ? C.shade(c, f) : C.hex(c);
    return '#' + hx2(k[0]) + hx2(k[1]) + hx2(k[2]);
  };
  const SEAM = 'rgba(10,8,8,0.45)', SEAM2 = 'rgba(10,8,8,0.28)', LITE = 'rgba(255,255,255,0.26)';
  const mir = (pts) => pts.map((v, i) => (i % 2 ? -v : v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // annulus path (hole via opposite winding)
  function ring(c, x, y, r1, r2) {
    c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU, false);
    c.moveTo(x + r2, y); c.arc(x, y, r2, TAU, 0, true);
  }
  // ring sector path from angle a0 to a1 (annulus wedge)
  function sector(c, x, y, r1, r2, a0, a1) {
    c.moveTo(x + Math.cos(a0) * r1, y + Math.sin(a0) * r1);
    c.arc(x, y, r1, a0, a1, false);
    c.lineTo(x + Math.cos(a1) * r2, y + Math.sin(a1) * r2);
    c.arc(x, y, r2, a1, a0, true);
    c.closePath();
  }
  // emissive light: soft halo, saturated body, hot core
  function glow(c, col, x, y, r, halo) {
    const R = r * (halo || 2.2);
    const g = c.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, css(col, 0.7, 1)); g.addColorStop(0.3, css(col, 0, 0.95)); g.addColorStop(0.55, css(col, 0, 0.35)); g.addColorStop(1, css(col, 0, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill(); c.restore();
    S.dot(c, css(col, 0.55), x, y, r * 0.55);
  }
  // rectangle filled with diagonal hazard stripes
  function hazard(c, x, y, w, h, a, b, step) {
    step = step || 1.4;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = a; c.fillRect(x, y, w, h);
    c.fillStyle = b; c.beginPath();
    for (let s = x - h - step * 2; s < x + w + h; s += step * 2) { c.moveTo(s, y); c.lineTo(s + step, y); c.lineTo(s + step + h, y + h); c.lineTo(s + h, y + h); c.closePath(); }
    c.fill(); c.restore();
  }
  function hazardPoly(c, pts, a, b, step) {
    c.save(); c.beginPath(); S.poly(c, pts); c.clip();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    c.restore();
    c.save(); c.beginPath(); S.poly(c, pts); c.clip();
    hazard(c, x0, y0, x1 - x0, y1 - y0, a, b, step);
    c.restore();
  }
  function rivets(c, col, pts, r) { c.save(); c.fillStyle = col; c.beginPath(); for (let i = 0; i < pts.length; i += 2) { c.moveTo(pts[i] + (r || 0.32), pts[i + 1]); c.arc(pts[i], pts[i + 1], r || 0.32, 0, TAU); } c.fill(); c.restore(); }
  // tread bars across a track top (scroll with anim)
  function treads(c, x0, x1, y0, y1, step, an, col) {
    const off = ((an || 0) * step) % step;
    const segs = [];
    for (let x = x0 + off; x <= x1; x += step) segs.push(x, y0, x, y1);
    S.lines(c, col || 'rgba(0,0,0,0.55)', step * 0.38, segs);
  }
  // tread highlight edges
  function trackTop(c, x0, x1, y0, y1, step, an) {
    treads(c, x0 + 0.6, x1 - 0.6, y0 + 0.3, y1 - 0.3, step, an);
    S.lines(c, 'rgba(255,255,255,0.16)', 0.3, [x0 + 1, y0 + 0.4, x1 - 1, y0 + 0.4]);
  }
  // red raider-clan pennant on a mast (two parts)
  function pennant(x, y, z0, z1, col, len) {
    len = len || 6;
    return [
      { z0, z1, side: '#2a2624', top: '#6a625a', bevel: false, shape: (c) => S.circ(c, x, y, 0.42) },
      { z0: z1 - 2.6, z1, side: css(col, -0.3), top: col, bevel: false, ao: 0.15,
        shape: (c, zt) => { const w = Math.sin(zt * 3.2) * 0.8; S.poly(c, [x, y - 0.2, x - len * 0.55, y + w - 0.6, x - len, y + w * 1.6 - 0.2, x - len * 0.5, y + w + 0.6, x, y + 0.4]); } },
    ];
  }

  /* ======================================================================
   * DUNE RAIDER — long skimmer bike, bone-white/black livery, visible rider,
   * red clan pennant. Hover pad glows orange.
   * ==================================================================== */
  M.veRaider = function (p, o) {
    p = P(p, { a: '#1c1a1c', b: '#ebe1cb', t: '#d8322a', g: '#ff8a2a', d: '#121012' });
    o = o || {};
    const bone = p.b, boneS = css(p.b, -0.38), black = '#1a181b', blackT = '#38343a';
    const red = o.flag || '#e0302a';
    const parts = [
      // under-glow hover pad
      { z0: 0, z1: 0.6, side: css(p.g, -0.2), top: p.g, flat: true, bevel: false, shape: (c) => S.ell(c, -2, 0, 9.5, 2.6) },
      // black chassis + forward skid prongs
      { z0: 0.8, z1: 3.2, side: black, top: blackT, shape: (c) => {
        S.poly(c, S.sym([9, 0, 7, 1.8, 0, 2.6, -8, 2.6, -12, 1.8, -12.8, 0]));
        S.rrect(c, 4, 1.6, 12.5, 1.1, 0.5); S.rrect(c, 4, -2.7, 12.5, 1.1, 0.5);
      }, detail: (c) => { S.dot(c, css(p.g, 0.2), 16, 2.15, 0.45); S.dot(c, css(p.g, 0.2), 16, -2.15, 0.45); } },
      // twin rear turbine pods
      { z0: 1.2, z1: 4.4, side: '#2a272c', top: '#5a5560', shape: (c) => { S.rrect(c, -13, 2.2, 8.5, 2.6, 1.2); S.rrect(c, -13, -4.8, 8.5, 2.6, 1.2); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.35, [-9, 2.3 * sg, -9, 4.7 * sg]); glow(c, p.g, -12.8, 3.5 * sg, 0.9, 1.8); } } },
      // bone fairing: long nose + tail
      { z0: 3.2, z1: 5.2, side: boneS, top: bone, shape: (c) => S.poly(c, S.sym([14, 0, 11, 1.4, 5, 2.8, -2, 3, -8, 2.6, -12.5, 1.6, -13.5, 0])),
        detail: (c) => {
          S.fillPoly(c, black, [13.6, 0, 9, 1.6, 7.6, 0.9, 7.6, -0.9, 9, -1.6]);
          S.fillPoly(c, red, [-8, 2.5, -12, 1.7, -12.4, 0.9, -8.4, 1.6]); S.fillPoly(c, red, [-8, -2.5, -12, -1.7, -12.4, -0.9, -8.4, -1.6]);
          S.lines(c, SEAM, 0.35, [5, -2.6, 5, 2.6, -8.5, -2.4, -8.5, 2.4]);
          S.lines(c, LITE, 0.4, [12.5, 0.6, 6, 2.4, 12.5, -0.6, 6, -2.4]);
          glow(c, p.g, 13.4, 0, 0.7, 2);
        } },
      // dark saddle
      { z0: 5.2, z1: 5.9, side: black, top: '#2e2a2e', bevel: false, shape: (c) => S.rrect(c, -8, -1.8, 7.5, 3.6, 1.4) },
      // smoked windscreen
      { z0: 5.2, z1: 6.8, side: '#1c2a32', top: '#3e5a66', flat: true, bevel: false, shape: (c) => S.poly(c, [7.2, 0, 5.6, 2, 4.4, 1.9, 4.4, -1.9, 5.6, -2]),
        detail: (c) => S.lines(c, 'rgba(255,255,255,0.55)', 0.35, [6.6, -0.5, 5.4, -1.6]) },
      // rider torso, leaning forward
      { z0: 5.9, z1: 9.6, side: '#2a2426', top: '#4a4044', shape: (c, zt) => S.ell(c, -3.6 + zt * 2.4, 0, 2.4 - zt * 0.3, 2.5 - zt * 0.5),
        detail: (c) => { S.fillPoly(c, bone, [-0.2, 1.9, -2.4, 2.1, -2.2, 1.1, -0.4, 1.0]); S.fillPoly(c, bone, [-0.2, -1.9, -2.4, -2.1, -2.2, -1.1, -0.4, -1.0]); } },
      // arms to the bars
      { z0: 7.4, z1: 8.2, side: '#2a2426', top: '#4e4448', stroke: 1, bevel: false, shape: (c) => { S.seg(c, -0.6, 1.8, 4.6, 2.3); S.seg(c, -0.6, -1.8, 4.6, -2.3); } },
      // helmet with red crest and hot visor
      { z0: 9.6, z1: 11.6, side: css(bone, -0.35), top: bone, shape: (c, zt) => S.circ(c, -0.4, 0, 1.75 - zt * 0.35),
        detail: (c) => { S.fillPoly(c, red, [-2, 0.35, 0.8, 0.3, 0.8, -0.3, -2, -0.35]); S.fillPoly(c, '#141216', [1.5, 0, 0.7, 1.2, 0.4, 0.9, 0.9, 0, 0.4, -0.9, 0.7, -1.2]); S.dot(c, css(p.g, 0.3), 1.1, 0, 0.35); } },
    ].concat(pennant(-11.5, -1.6, 3.2, 15, red, 6.5));
    return { r: 18, h: 16, parts };
  };

  /* ======================================================================
   * DRAGOON — raider-clan tracked artillery. Long gun is the separate 'long'
   * gun sheet; the hull gives the artillery read: spade outriggers, shell
   * rack, raised deck, bone armour and a clan pennant.
   * ==================================================================== */
  M.veDragoon = function (p, o) {
    p = P(p, { a: '#3a3532', b: '#d6c8aa', t: '#e8a02a', g: '#ff7a2a', d: '#1c1918' });
    o = o || {};
    const L = o.len || 15, W = o.wid || 10;
    const bone = p.b, boneS = css(p.b, -0.42), iron = p.a, ironT = css(p.a, 0.22);
    const parts = [
      // rear stabiliser spades (deployed outriggers)
      { z0: 0, z1: 1.8, side: '#24201e', top: '#4a4440', shape: (c) => { S.poly(c, [-L + 3, W - 2, -L - 3, W + 4.5, -L - 5.5, W + 3.5, -L + 0.5, W - 3]); S.poly(c, mir([-L + 3, W - 2, -L - 3, W + 4.5, -L - 5.5, W + 3.5, -L + 0.5, W - 3])); },
        detail: (c) => { for (const sg of [1, -1]) hazardPoly(c, [-L - 2.6, (W + 4.4) * sg, -L - 5.5, (W + 3.5) * sg, -L - 4.4, (W + 2.3) * sg, -L - 1.6, (W + 3.2) * sg], p.t, '#1a1614', 0.8); } },
      // tracks
      { z0: 0, z1: 4.2, side: '#1a1818', top: '#3a3634', shape: (c) => { S.rrect(c, -L, W - 3.6, L * 2, 4.4, 1.8); S.rrect(c, -L, -W - 0.8, L * 2, 4.4, 1.8); },
        detail: (c, an) => { trackTop(c, -L, L, W - 3.6, W + 0.8, 1.7, an); trackTop(c, -L, L, -W - 0.8, -W + 3.6, 1.7, an); } },
      // lower hull
      { z0: 2, z1: 5.4, side: '#2a2624', top: '#4e4844', shape: (c) => S.poly(c, S.sym([L + 1.5, 0, L + 1.5, W - 4, L - 2, W - 2.6, -L + 1, W - 2.6, -L - 1, W - 4, -L - 1, 0])) },
      // bone track skirts
      { z0: 4.2, z1: 5.6, side: boneS, top: bone, shape: (c) => { S.poly(c, [L - 1, W - 3.8, L - 4, W + 1.2, -L + 2, W + 1.2, -L + 1, W - 3.8]); S.poly(c, mir([L - 1, W - 3.8, L - 4, W + 1.2, -L + 2, W + 1.2, -L + 1, W - 3.8])); },
        detail: (c) => { for (const sg of [1, -1]) { hazard(c, L - 6, (sg > 0 ? W - 3.6 : -W - 1.2), 3, 4.8, p.t, '#1c1918', 0.7); S.lines(c, SEAM, 0.35, [2, (W - 3.8) * sg, 2, (W + 1.2) * sg, -6, (W - 3.8) * sg, -6, (W + 1.2) * sg]); } } },
      // raised gun deck
      { z0: 5.4, z1: 7, side: css(iron, -0.1), top: ironT, shape: (c) => S.poly(c, S.sym([L - 1, 0, L - 2.5, W - 4.2, -L + 6, W - 3.8, -L + 4.5, 0])),
        detail: (c) => {
          S.lines(c, SEAM, 0.4, [8.5, -5.5, 8.5, 5.5]);
          rivets(c, 'rgba(255,240,220,0.4)', [11, 4.6, 11, -4.6, -6, 5, -6, -5]);
          glow(c, p.g, L - 1.6, 2.6, 0.6, 1.8); glow(c, p.g, L - 1.6, -2.6, 0.6, 1.8);
          S.fillPoly(c, '#141210', [L - 1.2, 1.2, L - 2, 1.8, L - 2, -1.8, L - 1.2, -1.2]);
        } },
      // turret ring
      { z0: 6.4, z1: 7.2, side: '#1c1918', top: '#2c2826', bevel: false, shape: (c) => S.circ(c, 0, 0, 6.2) },
      // rear shell rack + crate
      { z0: 5.4, z1: 9.2, side: css(bone, -0.45), top: css(bone, -0.08), shape: (c) => S.rrect(c, -L + 0.5, -W + 3.4, 7.6, (W - 3.4) * 2, 1.2),
        detail: (c) => { S.lines(c, SEAM, 0.4, [-L + 4.3, -W + 3.6, -L + 4.3, W - 3.6]); S.fillPoly(c, '#1c1918', [-L + 1, -1.2, -L + 1, 1.2, -L + 8, 1.2, -L + 8, -1.2]); } },
      { z0: 9.2, z1: 10.6, side: '#8a6a2a', top: '#e0b050', bevel: false, shape: (c) => { for (let i = 0; i < 4; i++) { S.circ(c, -L + 2.3, -4.1 + i * 2.75, 0.95); S.circ(c, -L + 6.1, -4.1 + i * 2.75, 0.95); } },
        detail: (c) => { for (let i = 0; i < 4; i++) { S.dot(c, '#c03a26', -L + 2.3, -4.1 + i * 2.75, 0.45); S.dot(c, '#c03a26', -L + 6.1, -4.1 + i * 2.75, 0.45); } } },
      // exhaust stack
      { z0: 5.4, z1: 11.5, side: '#201c1a', top: '#3a3430', shape: (c) => S.circ(c, -L + 9.6, W - 2.8, 1.1), detail: (c) => glow(c, p.g, -L + 9.6, W - 2.8, 0.6, 1.6) },
    ].concat(pennant(-L + 9.6, -W + 2.8, 5.4, 17, o.flag || '#e0302a', 6));
    return { r: 24, h: 18, parts };
  };

  /* ======================================================================
   * SCARAB — raider-clan heavy: wide, welded scrap-plate hull on four track
   * pods, hazard-striped dozer ram, exhaust stacks. Heavy gun on top.
   * ==================================================================== */
  M.veScarab = function (p, o) {
    p = P(p, { a: '#2e2a28', b: '#cfc0a0', t: '#f0b020', g: '#ff6a2a', d: '#161312' });
    const iron = '#2c2826', ironT = '#4c4642', rust = '#8e4426', rustT = '#b8643a', bone = p.b;
    const pods = [[9.5, 10.5], [-9.5, 10.5], [9.5, -10.5], [-9.5, -10.5]];
    const parts = [
      // four track pods
      { z0: 0, z1: 4.6, side: '#191716', top: '#383432', shape: (c) => { for (const q of pods) S.rrect(c, q[0] - 6, q[1] - 2.6, 12, 5.2, 2); },
        detail: (c, an) => { for (const q of pods) trackTop(c, q[0] - 6, q[0] + 6, q[1] - 2.6, q[1] + 2.6, 1.6, an); } },
      // belly
      { z0: 1.4, z1: 5, side: '#1e1b1a', top: '#34302e', shape: (c) => S.poly(c, S.sym([14, 0, 13.5, 7.5, -13, 7.5, -15, 5.5, -15, 0])) },
      // dozer ram with spikes
      { z0: 0.6, z1: 6, side: '#3a2a1e', top: '#5a4a3a', shape: (c) => {
        S.poly(c, [16, -12.5, 18.4, -11, 19.6, -5, 20, 0, 19.6, 5, 18.4, 11, 16, 12.5, 15, 11.5, 16.4, 5, 16.6, 0, 16.4, -5, 15, -11.5]);
        for (const y of [-8, 0, 8]) S.poly(c, [19.4, y - 1.3, 22.8, y, 19.4, y + 1.3]);
      }, detail: (c) => hazardPoly(c, [16, -12.5, 18.4, -11, 19.6, -5, 20, 0, 19.6, 5, 18.4, 11, 16, 12.5, 15, 11.5, 16.4, 5, 16.6, 0, 16.4, -5, 15, -11.5], p.t, '#151210', 1.1) },
      // main hull
      { z0: 5, z1: 7.6, side: iron, top: ironT, shape: (c) => S.poly(c, S.sym([16, 0, 15, 6, 11, 8.6, -11, 9, -15.5, 6.5, -16.5, 0])),
        detail: (c) => {
          // welded scrap plates
          S.fillPoly(c, rustT, [15, 1.5, 14.2, 6, 10.6, 8.2, 8, 7.2, 8.6, 1.5]);
          S.fillPoly(c, css(bone, -0.1), [-8, 8.4, -11, 8.8, -15, 6.4, -15.6, 3, -9, 4.2]);
          S.fillPoly(c, rust, [-9.5, -3, -15.8, -2.4, -15.2, -6.2, -11, -8.6, -7.4, -8.1]);
          S.fillPoly(c, '#5a524c', [14.6, -1.5, 14, -6, 9.8, -8.4, 7, -6.8, 8.2, -1.5]);
          S.lines(c, 'rgba(255,200,140,0.45)', 0.3, [8.6, 1.5, 15, 1.5, 8.2, -1.5, 14.6, -1.5, -9, 4.2, -15.6, 3, -9.5, -3, -15.8, -2.4]);
          rivets(c, 'rgba(255,230,200,0.5)', [12.5, 3.2, 10.4, 5.6, 12, -3.4, 10, -5.6, -12, 6.6, -13, -4.4, -10.5, -6.4]);
          glow(c, p.g, 15.2, 4.4, 0.6, 2); glow(c, p.g, 15.2, -4.4, 0.6, 2);
        } },
      // side armour sponsons over the pods
      { z0: 4.6, z1: 7, side: css(rust, -0.25), top: rustT, shape: (c) => { const h = [11, 8, 7, 13.6, -11.5, 13.6, -13.5, 8]; S.poly(c, h); S.poly(c, mir(h)); },
        detail: (c) => { for (const sg of [1, -1]) { hazard(c, 6.4, (sg > 0 ? 11.3 : -13.4), 3.2, 2.1, p.t, '#151210', 0.75); S.lines(c, SEAM, 0.35, [0, 8.4 * sg, 0, 13.4 * sg, -6, 8.4 * sg, -6, 13.4 * sg]); rivets(c, 'rgba(255,220,190,0.45)', [-3, 12.4 * sg, -9, 12.4 * sg, 3, 12.4 * sg]); } } },
      // turret ring
      { z0: 7, z1: 7.6, side: '#141110', top: '#2a2624', bevel: false, shape: (c) => S.circ(c, 0, 0, 7.4) },
      // exhaust stacks
      { z0: 7, z1: 13.5, side: '#1c1816', top: '#3a3430', shape: (c) => { S.circ(c, -13, 4.6, 1.3); S.circ(c, -13, -4.6, 1.3); },
        detail: (c) => { glow(c, p.g, -13, 4.6, 0.75, 1.6); glow(c, p.g, -13, -4.6, 0.75, 1.6); } },
    ].concat(pennant(-11, 7.6, 7, 18.5, o && o.flag || '#e0302a', 6.5));
    return { r: 25, h: 19, parts };
  };

  /* ======================================================================
   * MINING CRAWLER — huge tracked strip-miner (W2 convoy). Keeps the tracked
   * hull + spinning cutter silhouette; adds an ore hopper of glowing ore,
   * exhaust stacks, a cab with work lights and a rotating amber beacon.
   * ==================================================================== */
  M.veCrawler = function (p, o) {
    p = P(p, { a: '#46403a', b: '#d9a83a', t: '#e8742a', g: '#ffd36b', d: '#1e1a16' });
    const yel = p.b, yelS = css(p.b, -0.45), steel = p.a, steelT = css(p.a, 0.3);
    const ore = '#ff8a2a';
    const parts = [
      // tracks
      { z0: 0, z1: 7, side: '#1c1a19', top: '#3a3633', shape: (c) => { S.rrect(c, -36, 15.5, 66, 11.5, 4); S.rrect(c, -36, -27, 66, 11.5, 4); },
        detail: (c, an) => { treads(c, -35, 29, 16, 26.5, 4, an); treads(c, -35, 29, -26.5, -16, 4, an); S.lines(c, 'rgba(255,255,255,0.14)', 0.5, [-33, 16.2, 27, 16.2, -33, -26.3, 27, -26.3]); } },
      // track fenders
      { z0: 7, z1: 8.4, side: yelS, top: yel, shape: (c) => { S.rrect(c, -30, 15, 54, 12.4, 2); S.rrect(c, -30, -27.4, 54, 12.4, 2); },
        detail: (c) => { for (const sg of [1, -1]) { hazard(c, 18, sg > 0 ? 15.2 : -27.2, 5.6, 12, '#1c1a19', p.b, 1.6); hazard(c, -30, sg > 0 ? 15.2 : -27.2, 4, 12, '#1c1a19', p.b, 1.6); S.lines(c, SEAM, 0.5, [0, 15.2 * sg, 0, 27.2 * sg, -14, 15.2 * sg, -14, 27.2 * sg]); } } },
      // main hull
      { z0: 5, z1: 17, side: steel, top: steelT, shape: (c) => S.poly(c, [26, -16, 30.5, -8, 30.5, 8, 26, 16, -30, 16.5, -33.5, 8, -33.5, -8, -30, -16.5]),
        detail: (c) => { S.lines(c, SEAM, 0.6, [26, -14, -30, -14, 26, 14, -30, 14]); rivets(c, 'rgba(255,240,210,0.35)', [28, -9, 28, 9, -31.5, -9, -31.5, 9], 0.5); } },
      // cutter arms
      { z0: 6, z1: 12, side: '#2a2724', top: '#55504a', shape: (c) => { S.rrect(c, 24, 9, 14, 4, 1.2); S.rrect(c, 24, -13, 14, 4, 1.2); } },
      // rotating cutter head
      { z0: 4, z1: 15, side: '#5c5650', top: '#c8c0b2', shape: (c, zt, an) => S.star(c, 40, 0, 12, 7.5, 10, an * TAU / 10),
        detail: (c, an) => {
          c.save(); c.translate(40, 0); c.rotate(an * TAU / 10);
          for (let i = 0; i < 10; i++) { const a = i * TAU / 10; S.dot(c, '#f2eee6', Math.cos(a) * 11, Math.sin(a) * 11, 0.7); }
          c.restore();
          S.dot(c, '#2a2622', 40, 0, 4.6); S.dot(c, yel, 40, 0, 3.2); hazard(c, 38.2, -1.4, 3.6, 2.8, yel, '#1c1a19', 0.8); S.dot(c, '#1c1a19', 40, 0, 1);
        } },
      // deck plating (raised spine + walkway)
      { z0: 17, z1: 18.4, side: yelS, top: yel, shape: (c) => S.poly(c, [26, -14.5, 29, 0, 26, 14.5, -2, 14.5, -2, -14.5]),
        detail: (c) => { S.lines(c, SEAM, 0.5, [12, -14, 12, 14, 2, -14, 2, 14]); hazard(c, 25, -9, 2.6, 18, yel, '#1c1a19', 1.2); } },
      // ore hopper (rim)
      { z0: 17, z1: 26, side: yelS, top: css(yel, 0.08), shape: (c) => S.poly(c, [-3, -14.5, -3, 14.5, -31, 15, -32.5, 0, -31, -15]),
        detail: (c) => { S.lines(c, SEAM, 0.5, [-10, -14.6, -10, -12.6, -24, -14.8, -24, -12.8, -10, 14.6, -10, 12.6, -24, 14.8, -24, 12.8]); } },
      // ore load inside the hopper: dark rubble with glowing seams
      { z0: 24, z1: 28, side: '#2a1e18', top: '#4a3428', shape: (c, zt) => S.blob(c, -17.5, 0, 12.6 - zt * 5, 4, 14, 0.18),
        detail: (c) => {
          const lumps = [[-12, -6, 2.4], [-20, 5, 2.8], [-24, -4, 2.2], [-15, 4, 1.8], [-18.5, -1, 2], [-9.5, 2, 1.6], [-26, 3, 1.6], [-21, -8, 1.6], [-13, 9, 1.4]];
          for (const l of lumps) { S.dot(c, '#1e1612', l[0] + 0.3, l[1] + 0.4, l[2]); S.dot(c, '#5a4232', l[0], l[1], l[2] * 0.8); }
          S.lines(c, ore, 0.55, [-14, -3, -18, 2, -18, 2, -22, 1, -11, 4, -14, 6, -23, -6, -20, -3]);
          glow(c, ore, -17, -2.5, 1.3, 2.4); glow(c, ore, -12.5, 5.5, 0.9, 2.2); glow(c, ore, -23, 5.5, 0.9, 2.2); glow(c, '#ffc04a', -19, 3.4, 0.7, 2);
        } },
      // cab
      { z0: 18.4, z1: 29, side: css(yel, -0.3), top: yel, shape: (c) => S.rrect(c, 6, -15.5, 16, 12, 2.2),
        detail: (c) => { S.lines(c, SEAM, 0.45, [14, -15.3, 14, -3.7]); S.fillPoly(c, '#222', [8, -14, 12, -14, 12, -12, 8, -12]); } },
      // cab windows (dark glass band on the front)
      { z0: 23, z1: 27.5, side: '#16242c', top: '#16242c', flat: true, bevel: false, shape: (c) => S.rrect(c, 20.6, -15, 1.8, 11, 0.6),
        detail: (c) => S.lines(c, 'rgba(160,230,255,0.6)', 0.4, [21.6, -14, 21.6, -9]) },
      // roof light bar + rotating amber beacon
      { z0: 29, z1: 30.2, side: '#2a2724', top: '#55504a', bevel: false, shape: (c) => S.rrect(c, 18, -15, 2.6, 11, 1),
        detail: (c) => { for (let i = 0; i < 4; i++) glow(c, '#fff4c0', 19.3, -13.5 + i * 2.7, 0.6, 2.2); } },
      { z0: 29, z1: 31.5, side: '#7a4a10', top: '#ffb030', flat: true, bevel: false, shape: (c) => S.circ(c, 9, -9.5, 1.3),
        detail: (c, an) => glow(c, an < 0.5 ? '#ffb030' : '#ff7a10', 9, -9.5, an < 0.5 ? 1.2 : 0.8, an < 0.5 ? 2.6 : 1.6) },
      // exhaust stacks
      { z0: 18.4, z1: 36, side: '#24211f', top: '#3c3834', shape: (c) => { S.circ(c, 1, 6.5, 1.9); S.circ(c, 1, 11.2, 1.9); },
        detail: (c) => { S.dot(c, '#0e0c0b', 1, 6.5, 1.2); S.dot(c, '#0e0c0b', 1, 11.2, 1.2); glow(c, '#ff7a2a', 1, 6.5, 0.6, 1.8); glow(c, '#ff7a2a', 1, 11.2, 0.6, 1.8); } },
      { z0: 30, z1: 31.2, side: '#4a4440', top: '#7a726a', bevel: false, shape: (c) => { ring(c, 1, 6.5, 2.4, 1.6); ring(c, 1, 11.2, 2.4, 1.6); } },
      // front work lights on the hull nose
      { z0: 14, z1: 16.6, side: '#2a2724', top: '#4a4540', bevel: false, shape: (c) => { S.rrect(c, 28.4, 3.5, 2.4, 4, 0.8); S.rrect(c, 28.4, -7.5, 2.4, 4, 0.8); },
        detail: (c) => { glow(c, '#fff2c8', 30, 5.5, 1, 2.6); glow(c, '#fff2c8', 30, -5.5, 1, 2.6); } },
    ];
    return { r: 53, h: 37, parts };
  };
})(window.AS);
