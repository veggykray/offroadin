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

  /* ======================================================================
   * MENDER — raider-clan repair hover-truck: cab, flatbed of spares and a
   * raised crane boom whose claw carries a green repair emitter.
   * ==================================================================== */
  M.veMender = function (p, o) {
    p = P(p, { a: '#2a2628', b: '#e6dcc4', t: '#e8a02a', g: '#7dff8a', d: '#141214' });
    const bone = p.b, boneS = css(p.b, -0.4), dk = '#2a2628', dkT = '#4a4446';
    const rep = (p.g && p.g.length > 2) ? p.g : '#7dff8a';
    const pads = [[7, 5.2], [7, -5.2], [-8, 5.4], [-8, -5.4]];
    const base = [-4, 2.6], tip = [12, -0.6];
    const parts = [
      // hover pads with warm under-glow
      { z0: 0, z1: 1.6, side: '#1a1818', top: '#3a3436', shape: (c) => { for (const q of pads) S.ell(c, q[0], q[1], 3.4, 2.2); },
        detail: (c) => { for (const q of pads) glow(c, '#ff9a3a', q[0], q[1], 1.3, 1.7); } },
      // chassis
      { z0: 1.4, z1: 3.8, side: dk, top: dkT, shape: (c) => S.poly(c, S.sym([13, 0, 12.4, 4.6, 10, 6.2, -12.5, 6.2, -13.5, 4.8, -13.5, 0])),
        detail: (c) => { hazard(c, 11.6, -4.4, 1.6, 8.8, p.t, '#141214', 0.8); } },
      // flatbed deck
      { z0: 3.8, z1: 5, side: css(dk, 0.05), top: '#5a5254', shape: (c) => S.rrect(c, -13, -5.8, 17, 11.6, 1.2),
        detail: (c) => { S.lines(c, SEAM, 0.35, [-13, 0, 4, 0, -6, -5.6, -6, 5.6]); rivets(c, 'rgba(255,240,220,0.35)', [-12, -4.8, -12, 4.8, 3, -4.8, 3, 4.8]); } },
      // cab
      { z0: 3.8, z1: 9.6, side: boneS, top: bone, shape: (c) => S.poly(c, S.sym([12.6, 0, 12.2, 4, 10.6, 5.6, 4.6, 5.8, 4, 4.8, 4, 0])),
        detail: (c) => {
          S.fillPoly(c, '#1a2228', [12.1, 3.6, 10.2, 3.9, 10.2, -3.9, 12.1, -3.6]);
          S.lines(c, 'rgba(180,255,200,0.5)', 0.35, [11.6, -3, 10.8, -1.4]);
          S.fillPoly(c, dk, [9.2, 5.6, 5, 5.7, 5, 4.4, 9.2, 4.2]); S.fillPoly(c, dk, [9.2, -5.6, 5, -5.7, 5, -4.4, 9.2, -4.2]);
          // green repair cross on the roof
          S.fillPoly(c, '#141214', [8.6, -1.9, 5.2, -1.9, 5.2, 1.9, 8.6, 1.9]);
          S.fillPoly(c, rep, [7.4, -0.5, 6.4, -0.5, 6.4, -1.5, 5.9, -1.5, 5.9, -0.5, 5.6, -0.5, 5.6, 0.5, 5.9, 0.5, 5.9, 1.5, 6.4, 1.5, 6.4, 0.5, 7.4, 0.5].map((v, i) => (i % 2 ? v : v + 0.6)));
        } },
      // amber beacon on the cab
      { z0: 9.6, z1: 10.8, side: '#7a4a10', top: '#ffb030', flat: true, bevel: false, shape: (c) => S.circ(c, 6, 4.1, 0.9),
        detail: (c) => glow(c, '#ffb030', 6, 4.1, 0.8, 2) },
      // spares bin + tool crates on the bed
      { z0: 5, z1: 8.2, side: css(p.t, -0.45), top: css(p.t, -0.05), shape: (c) => { S.rrect(c, -12.4, -5.4, 5.2, 4.4, 0.6); S.rrect(c, -12.4, 1.6, 4, 3.8, 0.6); },
        detail: (c) => { S.lines(c, SEAM, 0.35, [-9.8, -5.3, -9.8, -1.1, -12.3, 3.5, -8.5, 3.5]); S.fillPoly(c, '#1a1616', [-11.6, -4.4, -8, -4.4, -8, -2, -11.6, -2]); } },
      // crane turntable
      { z0: 5, z1: 7.6, side: '#2a2628', top: '#6a6264', shape: (c) => S.circ(c, base[0], base[1], 2.6),
        detail: (c) => { S.dot(c, '#1a1616', base[0], base[1], 1.2); hazard(c, base[0] - 2.4, base[1] + 1.2, 1.4, 1.2, p.t, '#141214', 0.5); } },
      // boom: a raised, slanted arm from the turntable up over the cab
      { z0: 7.2, z1: 16, side: css(p.t, -0.35), top: p.t, bevel: false, ao: 0.1, shape: (c, zt) => {
        const x = lerp(base[0], tip[0], zt), y = lerp(base[1], tip[1], zt);
        S.rrect(c, x - 1.4, y - 1.25, 2.8, 2.5, 0.7);
      } },
      // counterweight behind the turntable
      { z0: 7.2, z1: 10, side: '#2a2628', top: '#5a5254', shape: (c) => S.rrect(c, base[0] - 4.4, base[1] - 2, 2.8, 4, 0.6),
        detail: (c) => hazard(c, base[0] - 4.2, base[1] - 1.8, 2.4, 3.6, p.t, '#141214', 0.6) },
      // hydraulic ram under the boom
      { z0: 7.2, z1: 11.2, side: '#2a2628', top: '#7a7274', bevel: false, shape: (c, zt) => S.circ(c, lerp(base[0] + 1.6, base[0] + 5.8, zt), lerp(base[1], base[1] - 1.4, zt), 0.6) },
      // cable + claw hanging from the boom tip
      { z0: 9, z1: 16, side: '#141214', top: '#2a2628', bevel: false, shape: (c) => S.circ(c, tip[0], tip[1], 0.32) },
      { z0: 7.2, z1: 9.4, side: '#2a2628', top: '#6a6264', bevel: false, shape: (c) => S.poly(c, [tip[0] + 1.6, tip[1], tip[0], tip[1] + 1.7, tip[0] - 1.6, tip[1], tip[0], tip[1] - 1.7]),
        detail: (c) => glow(c, rep, tip[0], tip[1], 1, 2.4) },
      { z0: 16, z1: 16.8, side: '#4a4446', top: '#8a8284', bevel: false, shape: (c) => S.circ(c, tip[0], tip[1], 1.4),
        detail: (c) => S.dot(c, rep, tip[0] + 0.3, tip[1], 0.4) },
    ];
    return { r: 18, h: 18, parts };
  };

  /* ---------------- walker legs (strider, infected walker) ----------------
   * legs: [{ h:[x,y] hip, k:[x,y] knee, f:[x,y] foot, ph: gait phase }]
   * Diagonal pairs alternate: a lifted foot swings forward, a planted foot
   * slides back. Lower legs run foot -> knee, upper legs knee -> hip; both are
   * slanted stacks so they read as jointed struts from every heading. */
  function gait(L, an, stride, liftH) {
    const ph = TAU * (an + L.ph);
    return { dx: -Math.cos(ph) * stride, lift: Math.max(0, Math.sin(ph)) * liftH };
  }
  function walkerLegs(legs, o) {
    const hipZ = o.hipZ, kneeZ = o.kneeZ, stride = o.stride, liftH = o.liftH;
    const maxK = kneeZ + liftH * 0.6;
    const lower = { z0: 0, z1: maxK, side: o.side, top: o.top, bevel: false, ao: 0.25,
      shape: (c, zt, an) => {
        const z = zt * maxK;
        for (const L of legs) {
          const g = gait(L, an, stride, liftH), kz = kneeZ + g.lift * 0.6;
          if (z < g.lift || z > kz) continue;
          const t = (z - g.lift) / Math.max(0.01, kz - g.lift);
          const x = lerp(L.f[0] + g.dx, L.k[0] + g.dx * 0.5, t), y = lerp(L.f[1], L.k[1], t);
          S.circ(c, x, y, z - g.lift < (o.footH || 1.3) ? o.footR : lerp(o.legR * 0.8, o.legR, t));
        }
      } };
    const upper = { z0: hipZ, z1: maxK + 0.8, side: o.side2 || o.side, top: o.top2 || o.top, bevel: false, ao: 0.1,
      shape: (c, zt, an) => {
        const z = hipZ + zt * (maxK + 0.8 - hipZ);
        for (const L of legs) {
          const g = gait(L, an, stride, liftH), kz = kneeZ + g.lift * 0.6;
          if (z > kz + 0.8) continue;
          const t = Math.min(1, (z - hipZ) / Math.max(0.01, kz - hipZ));
          const x = lerp(L.h[0], L.k[0] + g.dx * 0.5, t), y = lerp(L.h[1], L.k[1], t);
          S.circ(c, x, y, kz - z < 1.3 ? o.kneeR : o.legR * 1.2);
        }
      } };
    return { lower, upper };
  }

  /* ======================================================================
   * ICE STRIDER — wide, low four-legged walker: dark frost-rimed carapace
   * with icicles under the belly, splayed spider legs with high knees, an
   * orange sensor eye and two shoulder gun pods. anims: 4 (walk cycle).
   * ==================================================================== */
  M.veStrider = function (p, o) {
    p = P(p, { a: '#2c3442', b: '#56637a', t: '#e8742a', g: '#ff8a2a', d: '#161b24' });
    const frost = '#e8f4ff', ice = '#bfe6ff';
    const legs = [
      { h: [5.5, 8.5], k: [11.5, 15.5], f: [16, 21], ph: 0 },
      { h: [5.5, -8.5], k: [11.5, -15.5], f: [16, -21], ph: 0.5 },
      { h: [-6, 8.5], k: [-12, 15.5], f: [-16.5, 21], ph: 0.5 },
      { h: [-6, -8.5], k: [-12, -15.5], f: [-16.5, -21], ph: 0 },
    ];
    const LG = walkerLegs(legs, { hipZ: 9.5, kneeZ: 13.5, stride: 2.4, liftH: 2.4, side: '#2a313e', top: '#6a7890', legR: 1.5, footR: 2.4, kneeR: 2.5, footH: 1.4 });
    const shell = [11, 0, 9.5, 5.5, 5, 10, -5, 10.5, -10, 7.5, -11.5, 0];
    const bob = (an) => 0;
    const parts = [
      LG.lower,
      // icicles hanging under the belly
      { z0: 2.2, z1: 6, side: '#8ab4d4', top: ice, bevel: false, ao: 0, shape: (c, zt) => {
        const r = 0.15 + zt * 0.85;
        for (const q of [[7, 4], [7, -4.5], [2, 7.5], [-3, 8], [2, -7.5], [-3, -8], [-8, 4], [-8, -4], [-1, 0.5]]) S.circ(c, q[0], q[1] + (zt - 1) * 0.3, r * (q[0] === -1 ? 1.4 : 1));
      } },
      // belly plate
      { z0: 5.5, z1: 7.5, side: '#141820', top: '#2a303c', shape: (c) => S.poly(c, S.sym([9.5, 0, 8.5, 5, 4.5, 8.6, -4.5, 9, -9, 6.5, -10, 0])) },
      // carapace (domed)
      { z0: 7.5, z1: 11.6, side: p.a, top: p.b, shape: (c, zt) => { const k = 1 - zt * 0.14; S.poly(c, S.sym(shell).map((v) => v * k)); },
        detail: (c) => {
          const k = 0.86;
          S.lines(c, SEAM, 0.45, [3.5 * k, -9.2 * k, 3.5 * k, 9.2 * k, -4 * k, -9.6 * k, -4 * k, 9.6 * k, 9 * k, 0, -10 * k, 0]);
          // frost rime along the lit front-left edges + snow patches
          S.lines(c, 'rgba(240,250,255,0.9)', 1.1, [10.6 * k, 0, 9.5 * k, -5.5 * k, 9.5 * k, -5.5 * k, 5 * k, -10 * k, 5 * k, -10 * k, -5 * k, -10.5 * k, -5 * k, -10.5 * k, -9.6 * k, -7.4 * k]);
          c.save(); c.fillStyle = 'rgba(236,248,255,0.82)'; c.beginPath(); S.blob(c, -2.5, -5.5, 2.8, 3, 7, 0.5); S.blob(c, 5, 4.4, 1.9, 5, 7, 0.5); S.blob(c, -7.2, 3.2, 1.7, 9, 7, 0.5); S.blob(c, 2, -1.6, 1.3, 4, 6, 0.5); c.fill(); c.restore();
          rivets(c, 'rgba(220,240,255,0.5)', [6, 6, 6, -6, -6.5, 6.5, -6.5, -6.5], 0.4);
          // rear heat vent (warm)
          S.fillPoly(c, '#120e0c', [-6.5, -2.2, -9.2, -1.8, -9.2, 1.8, -6.5, 2.2]);
          S.lines(c, css(p.g, 0.1), 0.45, [-7.2, -1.4, -7.2, 1.4, -8.4, -1.2, -8.4, 1.2]);
        } },
      // spine ridge
      { z0: 11.6, z1: 13, side: css(p.a, -0.1), top: css(p.b, 0.12), shape: (c) => S.poly(c, S.sym([6, 0, 4, 2.2, -6, 2.4, -8, 0])),
        detail: (c) => { S.lines(c, 'rgba(240,250,255,0.7)', 0.5, [5.6, -0.3, -7, -1.8]); S.lines(c, SEAM, 0.35, [0, -2.2, 0, 2.2]); } },
      // sensor head
      { z0: 6.5, z1: 10.4, side: '#1a1f28', top: '#3e485a', shape: (c) => S.poly(c, S.sym([14, 0, 13.4, 2.6, 9.5, 3.6, 8.5, 0])) },
      { z0: 8, z1: 10, side: css(p.g, -0.3), top: p.g, flat: true, bevel: false, shape: (c) => S.ell(c, 13.6, 0, 0.9, 1.6),
        detail: (c) => { glow(c, p.g, 13.6, 0, 1, 2.2); S.dot(c, '#fff4e0', 13.8, -0.4, 0.35); } },
      LG.upper,
      // shoulder gun pods
      { z0: 11, z1: 14.2, side: '#222833', top: '#5a6680', shape: (c) => { S.rrect(c, 1.5, 5.5, 7, 4, 1.4); S.rrect(c, 1.5, -9.5, 7, 4, 1.4); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.35, [4.5, 5.7 * sg, 4.5, 9.3 * sg]); S.lines(c, 'rgba(240,250,255,0.6)', 0.4, [2.2, (sg > 0 ? 5.9 : -9.1), 8, (sg > 0 ? 5.9 : -9.1)]); hazard(c, 1.8, sg > 0 ? 8.2 : -9.2, 2, 1, p.t, '#141820', 0.5); } } },
      { z0: 12, z1: 13.2, side: '#141820', top: '#4a5466', bevel: false, shape: (c) => { for (const y of [6.6, 8.4, -6.6, -8.4]) S.rrect(c, 8, y - 0.5, 4.6, 1, 0.4); },
        detail: (c) => { for (const y of [6.6, 8.4, -6.6, -8.4]) S.dot(c, css(p.g, 0.2), 12.5, y, 0.42); } },
    ];
    return { r: 29, h: 17, parts };
  };

  /* ======================================================================
   * RIME DRONE — spiked ice orb: dark navy core ringed by pale crystal
   * spikes, four ice fins, a big cyan lens and a soft cyan hover ring.
   * ==================================================================== */
  M.veRimeDrone = function (p, o) {
    p = P(p, { a: '#34445e', b: '#6a7e9c', t: '#e6f4ff', g: '#6ff2ff', d: '#1a2232' });
    const R = 6.4;
    const parts = [
      { z0: 0, z1: 0.6, side: css(p.g, -0.2), top: p.g, flat: true, stroke: 1.1, bevel: false, shape: (c) => S.circ(c, 0, 0, 7.4) },
      // lower hemisphere
      { z0: 1, z1: 1 + R, side: p.d, top: p.a, bevel: false, shape: (c, zt) => S.circ(c, 0, 0, R * Math.sqrt(Math.max(0.05, 1 - (1 - zt) * (1 - zt)))) },
      // crystal spike crown at the equator
      { z0: 1 + R - 0.8, z1: 1 + R + 0.9, side: '#7f9cbc', top: p.t, shape: (c) => S.star(c, 0, 0, 12.6, 5.6, 8, TAU / 16),
        detail: (c) => { for (let i = 0; i < 8; i++) { const a = TAU / 16 + i * TAU / 8; S.lines(c, 'rgba(120,160,200,0.6)', 0.35, [Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 12, Math.sin(a) * 12]); } } },
      // upper hemisphere
      { z0: 1 + R + 0.9, z1: 1 + R * 2, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, R * Math.sqrt(Math.max(0.12, 1 - zt * zt)) * 0.96),
        detail: (c) => { S.dot(c, 'rgba(255,255,255,0.5)', -1, -1, 1); S.lines(c, SEAM, 0.35, [-2.6, -2.6, 2.6, 2.6, -2.6, 2.6, 2.6, -2.6]); S.dot(c, '#ff5a3a', -1.4, 0, 0.45); } },
      // four ice fins on top
      { z0: 9, z1: 15.5, side: '#7f9cbc', top: p.t, bevel: false, shape: (c, zt) => {
        for (let i = 0; i < 4; i++) { const a = TAU / 8 + i * TAU / 4, d = 3.2 + zt * 2.4, ca = Math.cos(a), sa = Math.sin(a), w = 1.1 - zt * 0.8;
          S.poly(c, [ca * (d + 1.6), sa * (d + 1.6), ca * d - sa * w, sa * d + ca * w, ca * (d - 1.2), sa * (d - 1.2), ca * d + sa * w, sa * d - ca * w]); }
      } },
      // lens housing + cyan eye
      { z0: 4.4, z1: 10.2, side: '#141a26', top: '#2a3448', bevel: false, shape: (c, zt) => S.ell(c, R - 0.4 + Math.sin(zt * Math.PI) * 0.6, 0, 1.6, 2.9) },
      { z0: 6, z1: 8.8, side: css(p.g, -0.3), top: p.g, flat: true, bevel: false, shape: (c) => S.ell(c, R + 0.6, 0, 1, 2.1),
        detail: (c) => { glow(c, p.g, R + 0.7, 0, 1.2, 2.2); S.dot(c, '#08202a', R + 0.9, 0, 0.55); S.dot(c, '#ffffff', R + 0.5, -0.9, 0.35); } },
    ];
    return { r: 15, h: 17, parts };
  };

  /* ======================================================================
   * GULL DRONE — seabird interceptor: bent M (gull) wings, white body,
   * dark grey outer wings with black feather tips, forked tail and an
   * orange beak sensor.
   * ==================================================================== */
  M.veGull = function (p, o) {
    p = P(p, { a: '#8a9494', b: '#eef0ea', t: '#ff8a2a', g: '#ffb84a', d: '#2a3030' });
    const white = p.b, whiteS = css(p.b, -0.35), grey = p.a, greyT = css(p.a, 0.25);
    const inner = [5.2, 1.6, 6.6, 8.4, 4.4, 9.6, 0, 9, -3.6, 1.8];
    const outer = [6.4, 8.2, 1.6, 12.6, -4.4, 17.2, -9.4, 16.6, -7.6, 13.8, -4.4, 11.8, -0.4, 8.8];
    const parts = [
      // outer wing panels (lower, grey, black tips)
      { z0: 2, z1: 3.2, side: css(grey, -0.3), top: greyT, shape: (c) => { S.poly(c, outer); S.poly(c, mir(outer)); },
        detail: (c) => { for (const sg of [1, -1]) {
          S.fillPoly(c, '#1e2222', [-2.2, 15.6 * sg, -4.4, 17.2 * sg, -9.4, 16.6 * sg, -7.6, 13.8 * sg, -5.6, 12.8 * sg]);
          S.lines(c, SEAM, 0.35, [2.4, 11.4 * sg, -5, 13.2 * sg, 0, 10.4 * sg, -2.4, 11.2 * sg]);
          S.lines(c, LITE, 0.45, [6, 8.6 * sg, -3.6, 16.6 * sg]);
          S.dot(c, sg > 0 ? '#5aff7a' : '#ff4a4a', -5, 17 * sg, 0.45);
        } } },
      // inner wing panels (raised elbows = gull bend)
      { z0: 2.6, z1: 4.6, side: whiteS, top: white, shape: (c) => { S.poly(c, inner); S.poly(c, mir(inner)); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.35, [3.2, 2.2 * sg, 3.6, 8.4 * sg]); S.fillPoly(c, p.t, [5.4, 6.4 * sg, 5.9, 8.4 * sg, 4.8, 8.6 * sg, 4.5, 6.6 * sg]); } } },
      // elbow joints
      { z0: 2.6, z1: 4.8, side: '#2a3030', top: '#6a7272', bevel: false, shape: (c) => { S.circ(c, 4, 8.6, 1.2); S.circ(c, 4, -8.6, 1.2); } },
      // forked tail
      { z0: 2.4, z1: 3.8, side: whiteS, top: css(white, -0.05), shape: (c) => S.poly(c, S.sym([-5, 0, -6, 1.8, -11.5, 4.2, -10.6, 1.8, -9.2, 0])),
        detail: (c) => S.fillPoly(c, '#2a3030', [-10.6, 3.6, -11.5, 4.2, -11.2, 3, -10.5, 2]) },
      // fuselage
      { z0: 2, z1: 6.2, side: whiteS, top: white, shape: (c, zt) => { const k = 1 - zt * 0.25; S.poly(c, S.sym([10.5, 0, 8.5, 1.6 * k, 3, 2.4 * k, -4, 2.2 * k, -8.5, 1.1 * k, -9.5, 0])); },
        detail: (c) => { S.lines(c, SEAM, 0.35, [5, -1.7, 5, 1.7, -3, -1.6, -3, 1.6]); S.lines(c, LITE, 0.4, [9.6, -0.3, 2, -1.4]); S.fillPoly(c, '#2a3030', [-4.5, -0.8, -8.4, -0.5, -8.4, 0.5, -4.5, 0.8]); glow(c, p.g, -8.8, 0, 0.6, 2.2); } },
      // eye canopy
      { z0: 6.2, z1: 7, side: '#122028', top: '#1e3440', flat: true, bevel: false, shape: (c) => S.ell(c, 5.6, 0, 2, 1.1),
        detail: (c) => { S.dot(c, '#ffd36b', 6.2, 0, 0.45); S.lines(c, 'rgba(255,255,255,0.6)', 0.3, [6.6, -0.6, 5, -0.8]); } },
      // orange beak sensor
      { z0: 3.2, z1: 5.2, side: css(p.t, -0.3), top: p.t, shape: (c) => S.poly(c, [14, 0, 10, 1.1, 9.6, 0, 10, -1.1]),
        detail: (c) => glow(c, p.g, 12.8, 0, 0.5, 2.2) },
    ];
    return { r: 18, h: 9, parts };
  };

  /* ======================================================================
   * SKIMMER — hydrofoil catamaran: twin white hulls with an orange stripe,
   * dark bridging deck, cabin, foil struts and bow spray. opt.tanker: a long
   * convoy tanker with two round tank domes, hazard band and stern bridge.
   * The gun (separate sheet) sits on the deck ring at (0,0), z ~5.6.
   * ==================================================================== */
  M.veSkimmer = function (p, o) {
    p = P(p, { a: '#5e6a6c', b: '#e4e6e0', t: '#ff7a2a', g: '#ffb04a', d: '#232a2c' });
    o = o || {};
    const tk = !!o.tanker;
    const L = tk ? 25 : 13.5, Y = tk ? 7.6 : 6.2, HW = tk ? 2.8 : 2.2;
    const white = p.b, whiteS = css(p.b, -0.42), stripe = p.t, deck = '#2e3638', deckT = '#525e60';
    const hull = (y) => [L, y, L - 3, y + HW, -L + 1, y + HW, -L, y + HW * 0.4, -L, y - HW * 0.6, -L + 1, y - HW, L - 3, y - HW];
    const parts = [
      // foam: bow spray + short V wake
      { z0: 0, z1: 0, side: '#1a2022', top: '#1a2022', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 0.1),
        detail: (c) => {
          c.save(); c.fillStyle = 'rgba(225,250,245,0.34)'; c.beginPath();
          for (const sg of [1, -1]) { const y = Y * sg;
            S.poly(c, [L + 1.8, y, L - 1.5, y + 3.2, L - 7, y + 4.6, L - 2.5, y + 1.6]); S.poly(c, [L + 1.8, y, L - 1.5, y - 3.2, L - 7, y - 4.6, L - 2.5, y - 1.6]);
            S.poly(c, [-L + 1, y + HW, -L - 9, y + 4.2, -L - 9, y - 4.2, -L + 1, y - HW]); }
          c.fill(); c.fillStyle = 'rgba(240,255,252,0.36)'; c.beginPath();
          for (const sg of [1, -1]) { const y = Y * sg; S.ell(c, L - 0.5, y, 2, HW + 0.6); S.ell(c, -L - 2, y, 3, HW * 0.8); }
          c.fill(); c.restore();
        } },
      // hydrofoil struts + foils
      { z0: 0, z1: 1.6, side: '#1a2022', top: '#3a4446', bevel: false, shape: (c) => { for (const x of tk ? [L - 6, -L + 5] : [L - 4, -L + 3]) S.rrect(c, x - 1, -Y - HW - 1.6, 2, (Y + HW + 1.6) * 2, 0.8); } },
      // twin hulls
      { z0: 0.6, z1: 3.6, side: whiteS, top: white, shape: (c) => { S.poly(c, hull(Y)); S.poly(c, hull(-Y)); },
        detail: (c) => { for (const sg of [1, -1]) { const y = Y * sg;
          S.fillPoly(c, stripe, [L - 2.6, y + HW * 0.95 * sg, -L + 1.4, y + HW * 0.95 * sg, -L + 1.4, y + HW * 0.45 * sg, L - 3.6, y + HW * 0.45 * sg]);
          S.lines(c, LITE, 0.4, [L - 0.6, y, L - 4, y - HW * 0.7 * sg]);
          S.lines(c, SEAM, 0.35, [0, y - HW, 0, y + HW]);
        } } },
      // bridging deck
      { z0: 2.6, z1: 4.6, side: deck, top: deckT, shape: (c) => S.poly(c, tk ? S.sym([L - 3, 0, L - 4, Y - 1, -L + 2, Y - 1, -L + 2, 0]) : S.sym([7, 0, 6, Y - 0.8, -11.5, Y - 0.8, -12, 0])),
        detail: (c) => { S.lines(c, SEAM, 0.35, tk ? [12, -Y + 1, 12, Y - 1, -12, -Y + 1, -12, Y - 1] : [-4, -Y + 1, -4, Y - 1]); if (tk) { hazard(c, -3.6, -Y + 1.2, 1.6, (Y - 1.2) * 2, p.t, '#1a1e20', 0.9); hazard(c, 2, -Y + 1.2, 1.6, (Y - 1.2) * 2, p.t, '#1a1e20', 0.9); } } },
      // gun ring
      { z0: 4.6, z1: 5.6, side: '#1a2022', top: '#3a4446', bevel: false, shape: (c) => S.circ(c, 0, 0, tk ? 4.6 : 4.4) },
    ];
    if (!tk) {
      parts.push(
        // cabin with wraparound glass
        { z0: 4.6, z1: 8, side: whiteS, top: white, shape: (c) => S.poly(c, S.sym([-5, 0, -5.8, 3.2, -11, 3.6, -11.6, 0])),
          detail: (c) => { S.fillPoly(c, '#16262c', [-5.3, -2.6, -6.4, -3.1, -6.4, 3.1, -5.3, 2.6]); S.fillPoly(c, stripe, [-9, -3.5, -10.2, -3.5, -10.2, 3.5, -9, 3.5]); S.lines(c, 'rgba(200,250,255,0.6)', 0.3, [-5.6, -1.4, -5.8, 0.2]); } },
        { z0: 8, z1: 11, side: '#3a4446', top: '#7a8486', bevel: false, shape: (c) => S.circ(c, -9.6, 2, 0.4) },
        { z0: 10.6, z1: 11.6, side: '#7a3a10', top: '#ff7a2a', flat: true, bevel: false, shape: (c) => S.circ(c, -9.6, 2, 0.75), detail: (c) => glow(c, p.g, -9.6, 2, 0.6, 2.2) },
        // twin outboard jets
        { z0: 1.6, z1: 4.4, side: '#1a2022', top: '#46504e', shape: (c) => { S.rrect(c, -L - 1.5, Y - 1.6, 4, 3.2, 1); S.rrect(c, -L - 1.5, -Y - 1.6, 4, 3.2, 1); },
          detail: (c) => { glow(c, p.g, -L - 1.2, Y, 0.7, 1.8); glow(c, p.g, -L - 1.2, -Y, 0.7, 1.8); } },
      );
    } else {
      parts.push(
        // tank domes fore and aft of the gun
        { z0: 4.6, z1: 10.5, side: '#5a6466', top: '#d4d8d2', shape: (c, zt) => { const r = 5.2 * Math.sqrt(Math.max(0.1, 1 - zt * zt * 0.85)); S.circ(c, 11.5, 0, r); S.circ(c, -10.5, 0, r); },
          detail: (c) => { for (const x of [11.5, -10.5]) { S.dot(c, '#2e3638', x, 0, 1); S.dot(c, '#ff7a2a', x, 0, 0.45); S.dot(c, 'rgba(255,255,255,0.55)', x - 0.6, -0.6, 0.5); } } },
        { z0: 6.6, z1: 7.4, side: css(p.t, -0.3), top: p.t, bevel: false, shape: (c) => { ring(c, 11.5, 0, 5, 4.4); ring(c, -10.5, 0, 5, 4.4); } },
        // stern bridge
        { z0: 4.6, z1: 10, side: whiteS, top: white, shape: (c) => S.rrect(c, -L + 1, -4.6, 6, 9.2, 1.2),
          detail: (c) => { S.fillPoly(c, '#16262c', [-L + 6.8, -4, -L + 6, -4.2, -L + 6, 4.2, -L + 6.8, 4]); glow(c, p.g, -L + 2, 3.4, 0.5, 2.2); } },
        // pipe manifold between the domes
        { z0: 4.6, z1: 5.8, side: '#2e3638', top: '#6a7476', bevel: false, shape: (c) => { S.rrect(c, -6, Y - 2.6, 12, 1.2, 0.5); S.rrect(c, -6, -Y + 1.4, 12, 1.2, 0.5); } },
      );
    }
    return { r: tk ? 33 : 22, h: tk ? 12 : 12, parts };
  };

  /* ======================================================================
   * BUOY TURRET — bobbing navigation-buoy flak turret: red/white striped
   * float collar, dark body, twin flak head and a mast light. anims 2 = the
   * mast light blinks.
   * ==================================================================== */
  M.veBuoy = function (p, o) {
    p = P(p, { a: '#2e383a', b: '#9aa4a4', t: '#e0302a', g: '#ffb84a', d: '#1a2224' });
    const red = p.t, white = '#eef0ea';
    const parts = [
      // float collar: alternating striped sectors
      { z0: 0, z1: 3.4, side: css(red, -0.25), top: css(red, 0.05), shape: (c, zt) => { const r = 8.4 - Math.abs(zt - 0.5) * 1.6; for (let i = 0; i < 6; i++) sector(c, 0, 0, r, 4, i * TAU / 6, i * TAU / 6 + TAU / 12); } },
      { z0: 0, z1: 3.4, side: '#a8acaa', top: white, shape: (c, zt) => { const r = 8.4 - Math.abs(zt - 0.5) * 1.6; for (let i = 0; i < 6; i++) sector(c, 0, 0, r, 4, i * TAU / 6 + TAU / 12, i * TAU / 6 + TAU / 6); } },
      // body drum
      { z0: 1, z1: 7.2, side: p.d, top: p.a, shape: (c, zt) => S.circ(c, 0, 0, 5 - zt * 0.8),
        detail: (c) => { S.lines(c, SEAM, 0.35, [-4, 0, 4, 0]); rivets(c, 'rgba(255,255,255,0.35)', [2.8, 2.8, -2.8, 2.8, 2.8, -2.8, -2.8, -2.8], 0.35); } },
      // flak head
      { z0: 7.2, z1: 10.4, side: '#20282a', top: '#5e6a6c', shape: (c) => S.poly(c, S.sym([4.2, 0, 3.4, 2.8, -2.4, 3, -3.6, 1.8, -3.6, 0])),
        detail: (c) => { hazard(c, 1.8, -2.6, 1.4, 5.2, '#ffb030', '#1a2224', 0.6); S.dot(c, '#140c0a', -1.2, 0, 1.2); glow(c, '#ff5a2a', -1.2, 0, 0.55, 1.8); } },
      { z0: 8.2, z1: 9.4, side: '#141a1c', top: '#3a4446', bevel: false, shape: (c) => { for (const y of [-1.6, 1.6]) S.rrect(c, 3.2, y - 0.55, 6.6, 1.1, 0.4); },
        detail: (c) => { for (const y of [-1.6, 1.6]) S.dot(c, '#0a0c0c', 9.6, y, 0.35); } },
      // mast + light
      { z0: 7.2, z1: 17, side: '#3a4446', top: '#9aa4a4', bevel: false, shape: (c) => S.circ(c, -2.6, 0, 0.45) },
      { z0: 16.5, z1: 18.4, side: '#7a3a10', top: '#ffb84a', flat: true, bevel: false, shape: (c) => S.circ(c, -2.6, 0, 1),
        detail: (c, an) => { if (an < 0.5) glow(c, p.g, -2.6, 0, 1, 2.6); else S.dot(c, '#7a3a10', -2.6, 0, 0.8); } },
    ];
    return { r: 11, h: 19, parts };
  };
  /* ======================================================================
   * FORGE DRONE — chunky iron tri-lobe with three heat-sink fins, a molten
   * core window on top, a hot orange eye and a hot exhaust disc beneath.
   * Light top plates so it separates from the black basalt.
   * ==================================================================== */
  M.veForgeDrone = function (p, o) {
    p = P(p, { a: '#4a4440', b: '#a0968c', t: '#ff7a2a', g: '#ff8a2a', d: '#1a1210' });
    const iron = p.a, ironT = p.b, hot = p.g;
    const tri = (r, k) => { const pts = []; for (let i = 0; i < 3; i++) { const a = i * TAU / 3, b = a + TAU / 6; pts.push(Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r * k, Math.sin(b) * r * k); } return pts; };
    const finA = [TAU / 6, Math.PI, -TAU / 6];
    const parts = [
      // hot exhaust disc
      { z0: 0, z1: 0.6, side: '#a03a10', top: '#ffb050', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 3.6),
        detail: (c) => glow(c, hot, 0, 0, 2.4, 2.2) },
      // lower body
      { z0: 1, z1: 4.4, side: p.d, top: iron, bevel: false, shape: (c, zt) => { const r = 4.6 + zt * 3; S.poly(c, tri(r, 0.82)); } },
      // heat-sink fins
      { z0: 2.6, z1: 6.6, side: css(iron, -0.2), top: css(ironT, -0.05), shape: (c) => {
        for (const a of finA) { const ca = Math.cos(a), sa = Math.sin(a), w = 1.2; S.poly(c, [ca * 4 - sa * w, sa * 4 + ca * w, ca * 12.6 - sa * 0.9, sa * 12.6 + ca * 0.9, ca * 13.4, sa * 13.4, ca * 12.6 + sa * 0.9, sa * 12.6 - ca * 0.9, ca * 4 + sa * w, sa * 4 - ca * w]); }
      }, detail: (c) => { for (const a of finA) { const ca = Math.cos(a), sa = Math.sin(a); S.lines(c, css(hot, 0.1), 0.5, [ca * 8, sa * 8, ca * 12, sa * 12]); S.dot(c, '#fff0c0', ca * 12.1, sa * 12.1, 0.4); } } },
      // upper shell
      { z0: 4.4, z1: 8.6, side: iron, top: ironT, shape: (c, zt) => { const r = 7.6 - zt * 1.4; S.poly(c, tri(r, 0.84)); },
        detail: (c) => {
          for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + TAU / 6, ca = Math.cos(a), sa = Math.sin(a);
            S.lines(c, SEAM, 0.4, [ca * 2.8, sa * 2.8, ca * 5.2, sa * 5.2]); }
          rivets(c, 'rgba(255,240,220,0.5)', [4.6, 0, -2.3, 4, -2.3, -4], 0.4);
          S.lines(c, 'rgba(255,255,255,0.35)', 0.5, [5.5, -0.8, -2, -4.6]);
        } },
      // molten core window
      { z0: 8.6, z1: 9.6, side: '#1a1210', top: '#2a201c', bevel: false, shape: (c) => S.circ(c, -0.4, 0, 2.6) },
      { z0: 9.6, z1: 10, side: '#a03a10', top: hot, flat: true, bevel: false, shape: (c) => S.circ(c, -0.4, 0, 1.9),
        detail: (c) => { glow(c, hot, -0.4, 0, 1.5, 1.6); S.dot(c, '#fff4c8', -0.6, -0.3, 0.7); S.lines(c, 'rgba(40,16,8,0.7)', 0.35, [-2.2, 0, 1.4, 0]); } },
      // eye
      { z0: 4, z1: 7.4, side: '#1a1210', top: '#3a302c', bevel: false, shape: (c) => S.ell(c, 6.6, 0, 1.6, 2.4) },
      { z0: 5, z1: 6.8, side: '#a02a10', top: '#ff5a2a', flat: true, bevel: false, shape: (c) => S.ell(c, 7.6, 0, 0.9, 1.6),
        detail: (c) => { glow(c, '#ff5a2a', 7.7, 0, 1, 2.2); S.dot(c, '#ffe8c8', 7.9, -0.5, 0.35); } },
    ];
    return { r: 14, h: 11, parts, scale: 1.15 };
  };

  /* ======================================================================
   * MAGMA MORTAR — tracked carrier for a big crucible of live magma: banded
   * reservoir tank with glowing slit windows and an open glowing top, pipes
   * feeding the mortar ring (the mortar tube is the separate gun sheet).
   * ==================================================================== */
  M.veMagma = function (p, o) {
    p = P(p, { a: '#3a3230', b: '#9a8c80', t: '#ff7a2a', g: '#ff9a3a', d: '#120c0a' });
    o = o || {};
    const L = o.len || 14, W = o.wid || 10, iron = p.a, ironT = p.b, hot = p.g;
    const TX = -L + 5.8, TR = 5.8;
    const parts = [
      // tracks
      { z0: 0, z1: 4.2, side: '#141010', top: '#34302e', shape: (c) => { S.rrect(c, -L, W - 3.6, L * 2, 4.4, 1.8); S.rrect(c, -L, -W - 0.8, L * 2, 4.4, 1.8); },
        detail: (c, an) => { trackTop(c, -L, L, W - 3.6, W + 0.8, 1.7, an); trackTop(c, -L, L, -W - 0.8, -W + 3.6, 1.7, an); } },
      // hull
      { z0: 1.8, z1: 5.6, side: '#241e1c', top: '#4a4240', shape: (c) => S.poly(c, S.sym([L + 1.5, 0, L + 1, W - 4, L - 2, W - 2.4, -L + 1, W - 2.4, -L, W - 4, -L, 0])) },
      // armoured skirts (light top for contrast on basalt)
      { z0: 4.2, z1: 5.8, side: css(ironT, -0.45), top: ironT, shape: (c) => { const h = [L, W - 3.8, L - 3, W + 1.2, -L + 1.5, W + 1.2, -L + 0.5, W - 3.8]; S.poly(c, h); S.poly(c, mir(h)); },
        detail: (c) => { for (const sg of [1, -1]) { hazard(c, L - 5.5, sg > 0 ? W - 3.6 : -W - 1.2, 3, 4.8, p.t, '#1a1210', 0.7); S.lines(c, SEAM, 0.35, [3, (W - 3.8) * sg, 3, (W + 1.2) * sg, -5, (W - 3.8) * sg, -5, (W + 1.2) * sg]); } } },
      // front deck + mortar ring
      { z0: 5.4, z1: 7, side: css(iron, -0.05), top: css(ironT, -0.12), shape: (c) => S.poly(c, S.sym([L, 0, L - 1.5, W - 4.4, -2, W - 4.2, -3, 0])),
        detail: (c) => { rivets(c, 'rgba(255,240,220,0.45)', [L - 3, 4.4, L - 3, -4.4]); glow(c, hot, L - 0.6, 3, 0.55, 1.8); glow(c, hot, L - 0.6, -3, 0.55, 1.8); } },
      { z0: 6.4, z1: 7.2, side: '#120c0a', top: '#2a2220', bevel: false, shape: (c) => S.circ(c, 0, 0, 6.4) },
      // feed pipes from the crucible to the mortar ring
      { z0: 5.6, z1: 7.4, side: '#2a2220', top: '#6a5e56', bevel: false, shape: (c) => { S.rrect(c, TX + 3, 2.6, -TX - 3.4, 1.4, 0.6); S.rrect(c, TX + 3, -4, -TX - 3.4, 1.4, 0.6); },
        detail: (c) => { S.lines(c, 'rgba(255,150,60,0.7)', 0.4, [TX + 4, 3.3, -1, 3.3, TX + 4, -3.3, -1, -3.3]); } },
      // crucible cradle
      { z0: 5.4, z1: 7.6, side: '#241e1c', top: '#4a4240', shape: (c) => S.rrect(c, TX - TR - 1, -TR - 1.2, TR * 2 + 2, TR * 2 + 2.4, 1.6) },
      // reservoir tank (banded)
      { z0: 7.6, z1: 15.6, side: iron, top: css(ironT, -0.1), shape: (c, zt) => S.circ(c, TX, 0, TR - (zt > 0.92 ? 0.5 : 0)),
        detail: (c) => { S.dot(c, '#1a1210', TX, 0, TR - 1); } },
      // glowing slit windows down the tank wall
      { z0: 8.2, z1: 14.6, side: '#ff8a2a', top: '#ffd080', flat: true, bevel: false, shape: (c) => { for (let i = 0; i < 6; i++) sector(c, TX, 0, TR + 0.2, TR - 0.6, i * TAU / 6 + 0.2, i * TAU / 6 + 0.62); } },
      // steel bands
      { z0: 9.6, z1: 10.4, side: '#241e1c', top: '#6a5e56', bevel: false, shape: (c) => ring(c, TX, 0, TR + 0.45, TR - 0.3) },
      { z0: 13.2, z1: 14, side: '#241e1c', top: '#6a5e56', bevel: false, shape: (c) => ring(c, TX, 0, TR + 0.45, TR - 0.3) },
      // open crucible: molten surface
      { z0: 15, z1: 15.4, side: '#a03a10', top: hot, flat: true, bevel: false, shape: (c) => S.circ(c, TX, 0, TR - 1.1),
        detail: (c) => { glow(c, '#ffb050', TX, 0, 2.4, 1.6); c.save(); c.fillStyle = 'rgba(120,30,10,0.55)'; c.beginPath(); S.blob(c, TX + 1.5, 1.2, 1.2, 4, 6, 0.5); S.blob(c, TX - 1.8, -1, 1, 7, 6, 0.5); S.blob(c, TX - 0.5, 2.6, 0.7, 2, 6, 0.5); c.fill(); c.restore(); S.dot(c, '#fff4c8', TX + 0.4, -0.6, 0.8); } },
      // exhaust stack
      { z0: 5.4, z1: 12, side: '#1a1412', top: '#3a3230', shape: (c) => S.circ(c, -L + 1.6, W - 3.4, 1), detail: (c) => glow(c, hot, -L + 1.6, W - 3.4, 0.6, 1.6) },
    ];
    return { r: 22, h: 16, parts };
  };

  /* ======================================================================
   * ANVIL TANK — anvil-shaped heavy hover hull: pointed front horn, broad
   * face, narrow waist and broad heel. Dark iron walls, light top plates,
   * bright orange heat vents and a glowing hover skirt. Heavy gun on top.
   * ==================================================================== */
  M.veAnvil = function (p, o) {
    p = P(p, { a: '#3a3230', b: '#9a8c80', t: '#ff7a2a', g: '#ff9a3a', d: '#120c0a' });
    const iron = '#2e2826', ironT = p.b, hot = p.g;
    const half = [23, 0, 19, 2.6, 13.5, 6.5, 12.5, 11, 5, 11.4, 3, 7.6, -4, 7.6, -6, 11, -16, 11, -17.5, 8.5, -17.5, 0];
    const hull = S.sym(half);
    const parts = [
      // hover skirt glow
      { z0: 0, z1: 1.2, side: '#1a1210', top: '#2a2220', bevel: false, shape: (c) => S.poly(c, S.sym([18, 0, 12, 6, 11, 9.6, -15, 9.6, -16, 0])),
        detail: (c) => { for (const q of [[8, 6], [8, -6], [-10, 6.5], [-10, -6.5]]) glow(c, hot, q[0], q[1], 1.6, 1.8); } },
      // lower hull walls
      { z0: 1.2, z1: 5.2, side: iron, top: '#4a4240', shape: (c, zt) => { const k = 0.92 + zt * 0.08; S.poly(c, hull.map((v) => v * k)); } },
      // heat vents on the waist walls (glowing)
      { z0: 2, z1: 4.6, side: '#ff7a2a', top: '#ffc070', flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.rrect(c, -3.2 + i * 2.2, sg > 0 ? 7.5 : -7.9, 1, 0.4, 0.2); } },
      // top plate (light)
      { z0: 5.2, z1: 7, side: css(ironT, -0.5), top: ironT, shape: (c) => S.poly(c, S.sym([22, 0, 18.5, 2.4, 13.2, 6.2, 12.2, 10.4, 5.4, 10.8, 3.6, 7, -4.6, 7, -6.4, 10.4, -15.6, 10.4, -17, 8.2, -17, 0])),
        detail: (c) => {
          S.lines(c, SEAM, 0.45, [12.5, -10, 12.5, 10, 4, -7, 4, 7, -5.6, -7, -5.6, 7]);
          S.lines(c, 'rgba(255,255,255,0.4)', 0.5, [21.6, -0.3, 18.4, -2.2, 18.4, -2.2, 13.2, -6]);
          // horn face plate (hardened, darker)
          S.fillPoly(c, css(ironT, -0.3), [21, 0, 18, 1.8, 14.5, 1.8, 14.5, -1.8, 18, -1.8]);
          for (const sg of [1, -1]) { hazard(c, 6, sg > 0 ? 8.4 : -10.4, 5, 2, p.t, '#1a1210', 0.8); rivets(c, 'rgba(40,30,26,0.6)', [10, 6 * sg, 7, 6 * sg, -8, 8.6 * sg, -12, 8.6 * sg, -15, 6 * sg]); }
        } },
      // heel: raised radiator block with glowing fins
      { z0: 7, z1: 9.6, side: css(iron, 0.05), top: '#5a504a', shape: (c) => S.rrect(c, -16, -8, 7.6, 16, 1.4),
        detail: (c) => { for (let i = 0; i < 5; i++) { const y = -6.4 + i * 3.2; S.fillPoly(c, '#140c0a', [-15, y - 0.8, -9.2, y - 0.8, -9.2, y + 0.8, -15, y + 0.8]); S.lines(c, hot, 0.5, [-14.4, y, -9.8, y]); } } },
      // horn spike
      { z0: 5.2, z1: 8, side: '#3a3230', top: '#c8beb4', shape: (c, zt) => S.poly(c, [25 - zt * 2, 0, 18, 1.4 - zt * 0.4, 16, 0, 18, -1.4 + zt * 0.4]) },
      // gun ring
      { z0: 7, z1: 7.6, side: '#120c0a', top: '#2a2220', bevel: false, shape: (c) => S.circ(c, 0, 0, 7.4) },
      // headlamps
      { z0: 4.4, z1: 6.2, side: '#1a1210', top: '#3a3230', bevel: false, shape: (c) => { S.circ(c, 12.8, 8.6, 1); S.circ(c, 12.8, -8.6, 1); },
        detail: (c) => { glow(c, hot, 13, 8.6, 0.6, 2); glow(c, hot, 13, -8.6, 0.6, 2); } },
    ];
    return { r: 27, h: 14, parts };
  };

  /* ======================================================================
   * INFECTED WALKER — a colony walker overgrown with fungus: cracked white
   * dome body on four legs, magenta shelf mushrooms, mint spore lights and
   * tendrils hanging off the hull. anims: 4 (walk cycle).
   * ==================================================================== */
  M.veInfected = function (p, o) {
    p = P(p, { a: '#6a6e76', b: '#c4c8cc', t: '#c0306a', g: '#7fffd0', d: '#22202c' });
    const shroom = p.t, shroomT = css(p.t, 0.25), spore = p.g, crust = '#5a3a62';
    const legs = [
      { h: [4.6, 5.6], k: [9, 11], f: [12, 14.5], ph: 0 },
      { h: [4.6, -5.6], k: [9, -11], f: [12, -14.5], ph: 0.5 },
      { h: [-4.6, 5.6], k: [-9, 11], f: [-12, 14.5], ph: 0.5 },
      { h: [-4.6, -5.6], k: [-9, -11], f: [-12, -14.5], ph: 0 },
    ];
    const LG = walkerLegs(legs, { hipZ: 12, kneeZ: 15.5, stride: 2.2, liftH: 2.2, side: '#5a5c64', top: '#a4a8b0', side2: '#7a7e86', top2: '#c4c8ce', legR: 1.9, footR: 2.7, kneeR: 2.8, footH: 1.6 });
    const parts = [
      LG.lower,
      // tendrils hanging from the belly
      { z0: 4, z1: 11, side: '#6a2a52', top: '#a04a7a', bevel: false, ao: 0.1, shape: (c, zt) => {
        for (const q of [[6.4, 2.5, 0.6], [5.2, -4.4, 0.3], [-2, 6.6, 0.1], [-6.6, -2.6, 0.45], [1, -6.8, 0.7]]) if (zt > q[2] * 0.6) S.circ(c, q[0] + Math.sin(zt * 5 + q[1]) * 0.4, q[1], 0.35 + zt * 0.5);
      } },
      // belly / hip ring
      { z0: 9, z1: 11.6, side: '#2a2a32', top: '#4a4c54', shape: (c) => S.circ(c, 0, 0, 7.2) },
      // dome body
      { z0: 11.6, z1: 17.6, side: css(p.b, -0.12), top: css(p.b, 0.15), shape: (c, zt) => S.circ(c, 0, 0, 8.4 * Math.sqrt(Math.max(0.3, 1 - zt * zt * 0.55))),
        detail: (c) => {
          // fungal crust spreading over the dome + cracks
          c.save(); c.fillStyle = crust; c.beginPath(); S.blob(c, -1.6, 1.6, 2.6, 3, 8, 0.6); S.blob(c, 1.4, -2.6, 1.4, 6, 7, 0.6); c.fill(); c.restore();
          S.lines(c, 'rgba(30,24,36,0.6)', 0.35, [2.4, 0.4, 3.6, 2.2, 3.6, 2.2, 2.8, 3.4, -2.6, -1.2, -3.4, -2.8]);
          for (const q of [[-2.4, 0.6], [-0.6, 2.8], [0.8, -3], [2.2, -2], [-3.2, 2.6]]) S.dot(c, spore, q[0], q[1], 0.42);
        } },
      // cockpit eye (cracked, glowing)
      { z0: 12.6, z1: 15.4, side: '#14121a', top: '#2a2632', bevel: false, shape: (c) => S.ell(c, 6.6, 0, 1.6, 3) },
      { z0: 13.2, z1: 15, side: css(spore, -0.4), top: spore, flat: true, bevel: false, shape: (c) => S.ell(c, 7.6, 0, 0.8, 2.2),
        detail: (c) => { glow(c, spore, 7.7, 0, 0.9, 2.2); S.lines(c, 'rgba(20,16,24,0.8)', 0.3, [7.6, -2, 7.9, -0.2, 7.9, -0.2, 7.5, 1]); } },
      LG.upper,
      // side gun / spore nozzles
      { z0: 12.6, z1: 14.6, side: '#3a3c44', top: '#8a8e96', shape: (c) => { S.rrect(c, 2, 6.8, 6, 2.2, 0.9); S.rrect(c, 2, -9, 6, 2.2, 0.9); },
        detail: (c) => { S.dot(c, spore, 7.7, 7.9, 0.45); S.dot(c, spore, 7.7, -7.9, 0.45); } },
      // mushroom stems
      { z0: 15.6, z1: 19.4, side: '#d8c8d0', top: '#efe4e8', bevel: false, shape: (c) => { S.circ(c, -2.6, 2.2, 0.9); S.circ(c, 1.6, -2.8, 0.7); S.circ(c, -4.4, -3.4, 0.6); } },
      // shelf-mushroom caps
      { z0: 19.4, z1: 21.6, side: css(shroom, -0.35), top: shroomT, shape: (c, zt) => { const k = 1 - zt * 0.3; S.ell(c, -2.6, 2.2, 3.6 * k, 3 * k, 0.4); S.ell(c, 1.6, -2.8, 2.6 * k, 2.2 * k); S.ell(c, -4.4, -3.4, 1.8 * k, 1.6 * k); },
        detail: (c) => { for (const q of [[-3.4, 1.4, 0.55], [-1.6, 3, 0.45], [-2.8, 3.4, 0.35], [1.2, -3.4, 0.45], [2.2, -2.2, 0.35], [-4.6, -3.8, 0.35]]) S.dot(c, '#ffd8ea', q[0], q[1], q[2]); glow(c, spore, -2.2, 2, 0.5, 2.6); } },
    ];
    return { r: 19, h: 22, parts };
  };

  /* ======================================================================
   * GEAR CRAWLER — machine-world tracked crawler: brass hull, an exposed
   * meshing gear train turning on the rear deck, toothed sprockets at the
   * track ends, pistons and a furnace grille. Twin gun on top. anims 4.
   * ==================================================================== */
  M.veGearCrawler = function (p, o) {
    p = P(p, { a: '#5a4c3e', b: '#a89a80', t: '#ff6a3a', g: '#ff9a3a', d: '#1e1c18' });
    o = o || {};
    const L = o.len || 14, W = o.wid || 10;
    const brass = '#b08a4a', brassT = '#e0bc72', brassS = '#6a4e26', hot = p.g;
    const gears = [[-L + 4.6, 3.6, 4.2, 10, 1], [-L + 4.4, -3.8, 3.4, 8, -1], [-L + 10.2, 0, 2.6, 7, -1]];
    const parts = [
      // tracks
      { z0: 0, z1: 4.4, side: '#161412', top: '#363230', shape: (c) => { S.rrect(c, -L, W - 3.8, L * 2, 4.6, 1.8); S.rrect(c, -L, -W - 0.8, L * 2, 4.6, 1.8); },
        detail: (c, an) => { trackTop(c, -L, L, W - 3.8, W + 0.8, 1.6, an * 2); trackTop(c, -L, L, -W - 0.8, -W + 3.8, 1.6, an * 2); } },
      // toothed sprockets at the track ends
      { z0: 1, z1: 5, side: brassS, top: brass, bevel: false, shape: (c, zt, an) => { for (const x of [L - 0.6, -L + 0.6]) for (const y of [W - 1.5, -W + 1.5]) S.star(c, x, y, 2.6, 1.9, 7, an * TAU / 7); },
        detail: (c) => { for (const x of [L - 0.6, -L + 0.6]) for (const y of [W - 1.5, -W + 1.5]) S.dot(c, '#2a2016', x, y, 0.8); } },
      // hull
      { z0: 2, z1: 6, side: p.d, top: '#3a3430', shape: (c) => S.poly(c, S.sym([L + 2, 0, L + 1, W - 4, L - 2, W - 2.6, -L + 1, W - 2.6, -L - 1, W - 4, -L - 1, 0])) },
      // brass armour deck (front half) + side skirts
      { z0: 4.4, z1: 6.6, side: brassS, top: brass, shape: (c) => { S.poly(c, S.sym([L + 1.5, 0, L, W - 3.6, L - 3, W + 1, -L + 2, W + 1, -L + 1, W - 3.4, -2, W - 3.4, -2, 0])); },
        detail: (c) => {
          S.lines(c, SEAM, 0.4, [4, -W - 0.6, 4, W + 0.6, -6, W - 3.2, -6, W + 0.8, -6, -W + 3.2, -6, -W - 0.8]);
          rivets(c, 'rgba(255,240,200,0.55)', [L - 1, 3.4, L - 1, -3.4, 0, W - 0.4, 0, -W + 0.4, -10, W - 0.4, -10, -W + 0.4], 0.38);
          S.lines(c, 'rgba(255,250,220,0.45)', 0.45, [L + 1.2, -0.3, L - 0.2, -W + 3.8]);
          for (const sg of [1, -1]) glow(c, hot, L + 0.4, 3 * sg, 0.55, 2);
        } },
      // turret ring
      { z0: 6.4, z1: 7.2, side: '#141210', top: '#2a2622', bevel: false, shape: (c) => S.circ(c, 0, 0, 6) },
      // rear gear pit (recessed)
      { z0: 4.4, z1: 5.4, side: '#1a1612', top: '#120e0c', bevel: false, shape: (c) => S.rrect(c, -L, -W + 2.6, 15, (W - 2.6) * 2, 1.4),
        detail: (c) => glow(c, hot, -L + 10.2, 0, 1, 3) },
      // exposed meshing gears (counter-rotating)
      { z0: 5.4, z1: 7.2, side: brassS, top: brassT, shape: (c, zt, an) => { for (const g of gears) S.star(c, g[0], g[1], g[2], g[2] - 0.85, g[3], g[4] * an * TAU / g[3]); },
        detail: (c, an) => { for (const g of gears) { S.dot(c, '#4a3618', g[0], g[1], g[2] * 0.55); S.dot(c, brass, g[0], g[1], g[2] * 0.42); S.dot(c, '#2a2016', g[0], g[1], 0.6);
          c.save(); c.translate(g[0], g[1]); c.rotate(g[4] * an * TAU / g[3]); S.lines(c, 'rgba(40,28,12,0.7)', 0.4, [-g[2] * 0.42, 0, g[2] * 0.42, 0, 0, -g[2] * 0.42, 0, g[2] * 0.42]); c.restore(); } } },
      // piston pair driving the gear train
      { z0: 6, z1: 8, side: '#3a3632', top: '#c8c4bc', bevel: false, shape: (c, zt, an) => { const d = Math.sin(an * TAU) * 1.1; S.rrect(c, -4.8 + d, W - 4.2, 4, 1.3, 0.5); S.rrect(c, -4.8 - d, -W + 2.9, 4, 1.3, 0.5); } },
      // furnace stack
      { z0: 5.4, z1: 12.5, side: '#2a2420', top: '#4a423a', shape: (c) => S.circ(c, -L + 1.2, W - 3.6, 1.3),
        detail: (c) => { S.dot(c, '#100c0a', -L + 1.2, W - 3.6, 0.8); glow(c, hot, -L + 1.2, W - 3.6, 0.6, 1.8); } },
      { z0: 11, z1: 11.8, side: brassS, top: brass, bevel: false, shape: (c) => ring(c, -L + 1.2, W - 3.6, 1.9, 1.2) },
    ];
    return { r: 20, h: 13, parts };
  };
  /* FRC / colony livery shared by the friendly hauler, tank and gunship
   * (matches the hero craft: gunmetal walls, light panels, amber trim, cyan). */
  const FRC = { hullS: '#565e69', hullT: '#a6aeb8', panel: '#7d8590', dark: '#262b33', darker: '#181c22', metal: '#3a414b', trim: '#de9c3a', glow: '#5fe6ff', ringT: '#a7bacb', ringS: '#323b45' };
  const frcGlow = (p) => { const g = p && p.g; if (!g) return FRC.glow; const k = C.hex(g); return k[2] > k[0] ? g : FRC.glow; };
  // rectangular frame (outer CW, inner CCW) for rails and cages
  function frame(c, x, y, w, h, t) {
    S.poly(c, [x, y, x + w, y, x + w, y + h, x, y + h]);
    S.poly(c, [x + t, y + t, x + t, y + h - t, x + w - t, y + h - t, x + w - t, y + t]);
  }

  /* ======================================================================
   * ORE HAULER — friendly colony convoy truck: six big wheels, off-white
   * cab with cyan roof lights, twin stacks, railed flatbed of ore crates
   * (opt.cargoSide / opt.cargoTop) and a heap of ore.
   * ==================================================================== */
  M.veHauler = function (p, o) {
    o = o || {};
    const g = frcGlow(p), trim = (p && p.t) || FRC.trim;
    const cabT = '#dcdfd8', cabS = '#8a9098', cS = o.cargoSide || '#7a5a3a', cT = o.cargoTop || '#a8825a';
    const axles = [14.5, -7.5, -14];
    const parts = [
      // wheels
      { z0: 0, z1: 4.6, side: '#141618', top: '#2e3236', shape: (c) => { for (const x of axles) for (const sg of [1, -1]) S.rrect(c, x - 2.8, sg > 0 ? 6.4 : -9.4, 5.6, 3, 1.2); },
        detail: (c) => { for (const x of axles) for (const sg of [1, -1]) { S.lines(c, 'rgba(0,0,0,0.55)', 0.45, [x - 1.6, (sg > 0 ? 6.6 : -9.2), x - 1.6, (sg > 0 ? 9.2 : -6.6), x, (sg > 0 ? 6.6 : -9.2), x, (sg > 0 ? 9.2 : -6.6), x + 1.6, (sg > 0 ? 6.6 : -9.2), x + 1.6, (sg > 0 ? 9.2 : -6.6)]); } } },
      // chassis
      { z0: 1.8, z1: 4.4, side: FRC.darker, top: FRC.metal, shape: (c) => S.rrect(c, -20.5, -6.4, 41.5, 12.8, 1.6) },
      // fenders
      { z0: 4.4, z1: 5.4, side: FRC.metal, top: FRC.panel, shape: (c) => { for (const sg of [1, -1]) { S.rrect(c, 11.2, sg > 0 ? 5.8 : -9.8, 6.6, 4, 1.4); S.rrect(c, -17.4, sg > 0 ? 5.8 : -9.8, 13.2, 4, 1.4); } },
        detail: (c) => { for (const sg of [1, -1]) hazard(c, -17.2, sg > 0 ? 8.6 : -9.6, 2.6, 1, trim, FRC.dark, 0.6); } },
      // flatbed deck
      { z0: 4.4, z1: 5.8, side: FRC.dark, top: '#4a525c', shape: (c) => S.rrect(c, -20.5, -6.8, 29, 13.6, 1),
        detail: (c) => { hazard(c, -20.3, -6.4, 1.4, 12.8, trim, FRC.dark, 0.9); S.dot(c, '#ff4a3a', -20, 5.6, 0.5); S.dot(c, '#ff4a3a', -20, -5.6, 0.5); } },
      // cargo: two crates + ore heap
      { z0: 5.8, z1: 10.4, side: cS, top: cT, shape: (c) => { S.rrect(c, -19.4, -6, 8.4, 12, 0.8); S.rrect(c, -1.6, -6, 8.4, 5.4, 0.8); },
        detail: (c) => { S.lines(c, 'rgba(30,20,10,0.55)', 0.55, [-15.2, -6, -15.2, 6, -19.4, 0, -11, 0, 2.6, -6, 2.6, -0.6]); S.fillPoly(c, trim, [-13.6, -4.8, -12, -4.8, -12, -3.2, -13.6, -3.2]); S.fillPoly(c, trim, [4.6, -5, 6, -5, 6, -3.6, 4.6, -3.6]); } },
      { z0: 5.8, z1: 9.6, side: '#4a3a2c', top: '#7a6450', shape: (c, zt) => S.blob(c, -5.4, 2, 5.2 - zt * 2.6, 12, 10, 0.25),
        detail: (c) => { for (const q of [[-6.4, 1.2, 0.9], [-4.2, 2.8, 0.7], [-5.6, 3.6, 0.6], [-3.8, 0.6, 0.5]]) { S.dot(c, '#3a2c20', q[0] + 0.2, q[1] + 0.2, q[2]); S.dot(c, '#9a8268', q[0], q[1], q[2] * 0.75); } S.dot(c, g, -5, 1.6, 0.35); } },
      // bed rails
      { z0: 5.8, z1: 8.6, side: FRC.ringS, top: FRC.ringT, bevel: false, shape: (c) => frame(c, -20.4, -6.8, 28.8, 13.6, 0.7) },
      // cab
      { z0: 4.4, z1: 11.6, side: cabS, top: cabT, shape: (c) => S.poly(c, S.sym([20.6, 0, 20.4, 5.4, 19, 6.8, 9.8, 6.8, 9, 5.6, 9, 0])),
        detail: (c) => {
          S.fillPoly(c, '#16242c', [20.2, 5, 18.2, 5.4, 18.2, -5.4, 20.2, -5]);
          S.lines(c, 'rgba(170,240,255,0.7)', 0.4, [19.6, -4, 18.8, -1.6]);
          S.lines(c, SEAM, 0.4, [14, -6.6, 14, 6.6]);
          S.fillPoly(c, trim, [17.6, 6.7, 10.2, 6.7, 10.2, 5.6, 17.6, 5.6]); S.fillPoly(c, trim, [17.6, -6.7, 10.2, -6.7, 10.2, -5.6, 17.6, -5.6]);
          S.fillPoly(c, FRC.dark, [13, -2.6, 10.2, -2.6, 10.2, 2.6, 13, 2.6]);
        } },
      // roof light bar (friendly cyan)
      { z0: 11.6, z1: 12.6, side: FRC.dark, top: FRC.metal, bevel: false, shape: (c) => S.rrect(c, 16, -4.6, 1.8, 9.2, 0.6),
        detail: (c) => { glow(c, g, 16.9, -3.4, 0.55, 2); glow(c, g, 16.9, 3.4, 0.55, 2); S.dot(c, '#ffd36b', 16.9, 0, 0.5); } },
      // headlights
      { z0: 4.8, z1: 6.6, side: FRC.dark, top: FRC.metal, bevel: false, shape: (c) => { S.rrect(c, 20, 3, 1.4, 2.6, 0.5); S.rrect(c, 20, -5.6, 1.4, 2.6, 0.5); },
        detail: (c) => { glow(c, '#fff4d8', 21, 4.3, 0.7, 2.2); glow(c, '#fff4d8', 21, -4.3, 0.7, 2.2); } },
      // twin exhaust stacks behind the cab
      { z0: 5.8, z1: 15, side: FRC.metal, top: '#9aa2ac', shape: (c) => { S.circ(c, 8, 5.4, 0.95); S.circ(c, 8, -5.4, 0.95); },
        detail: (c) => { S.dot(c, '#101214', 8, 5.4, 0.55); S.dot(c, '#101214', 8, -5.4, 0.55); } },
    ];
    return { r: 25, h: 16, parts };
  };

  /* ======================================================================
   * FRC WARDEN TANK — friendly heavy hover tank in the hero's livery:
   * gunmetal wedge hull, four anti-grav rings with cyan cores (like the
   * Vesper's), amber chevrons, cyan running lights. Heavy gun on top.
   * ==================================================================== */
  M.veWarden = function (p, o) {
    const g = frcGlow(p), trim = FRC.trim;
    const rings = [[10.5, 10.6], [10.5, -10.6], [-10.5, 10.6], [-10.5, -10.6]];
    const hull = S.sym([20, 0, 17, 4.6, 13, 8.4, -13, 8.8, -17, 6.6, -18, 0]);
    const parts = [
      // ventral skirt
      { z0: 0, z1: 1.6, side: FRC.darker, top: '#2c323b', bevel: false, shape: (c) => S.poly(c, S.sym([17, 0, 12, 7.6, -14, 8, -16, 0])) },
      // anti-grav ring glow cores
      { z0: 1.6, z1: 1.6, side: g, top: css(g, -0.2), flat: true, shape: (c) => { for (const q of rings) S.circ(c, q[0], q[1], 2.6); },
        detail: (c) => { for (const q of rings) { S.dot(c, css(g, 0.45), q[0], q[1], 1.3); S.lines(c, 'rgba(20,40,50,0.5)', 0.35, [q[0] - 2.2, q[1], q[0] + 2.2, q[1], q[0], q[1] - 2.2, q[0], q[1] + 2.2]); } } },
      // anti-grav rings
      { z0: 1.2, z1: 4.4, side: FRC.ringS, top: FRC.ringT, stroke: 1.5, bevel: false, shape: (c) => { for (const q of rings) S.circ(c, q[0], q[1], 3.6); } },
      // ring struts
      { z0: 2.4, z1: 4.2, side: FRC.dark, top: FRC.metal, bevel: false, shape: (c) => { for (const q of rings) S.rrect(c, q[0] - 1.1, q[1] > 0 ? 6.8 : -8.2, 2.2, 1.4, 0.4); } },
      // hull
      { z0: 1.6, z1: 6, side: FRC.hullS, top: FRC.hullT, shape: (c) => S.poly(c, hull),
        detail: (c) => {
          S.lines(c, 'rgba(24,28,34,0.55)', 0.45, [12, -8.2, 12, 8.2, -8, -8.6, -8, 8.6, 16, 0, 9, 0]);
          S.lines(c, 'rgba(255,255,255,0.28)', 0.5, [19.4, -0.4, 16.6, -4.6, 16.6, -4.6, 13, -8.2]);
          for (const sg of [1, -1]) { S.fillPoly(c, trim, [18.4, 1.2 * sg, 15.6, 4.6 * sg, 14.8, 4 * sg, 17.4, 0.8 * sg]); glow(c, g, 16.2, 5.6 * sg, 0.5, 2.2); }
          S.fillPoly(c, FRC.darker, [-11, -6.6, -16.4, -5, -16.4, 5, -11, 6.6]);
        } },
      // side armour sponsons between the rings
      { z0: 3, z1: 6.6, side: FRC.metal, top: FRC.panel, shape: (c) => { S.rrect(c, -6.4, 7.4, 12.8, 4.4, 1.4); S.rrect(c, -6.4, -11.8, 12.8, 4.4, 1.4); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, 'rgba(24,28,34,0.55)', 0.4, [0, 7.6 * sg, 0, 11.6 * sg]); S.fillPoly(c, trim, [5.6, (sg > 0 ? 10.8 : -11.2), -5.6, (sg > 0 ? 10.8 : -11.2), -5.6, (sg > 0 ? 11.2 : -10.8), 5.6, (sg > 0 ? 11.2 : -10.8)]); } } },
      // rear engine deck with twin cyan exhausts
      { z0: 6, z1: 8.4, side: FRC.metal, top: '#7c8693', shape: (c) => S.rrect(c, -17, -5.6, 8.4, 11.2, 1.6),
        detail: (c) => { for (const sg of [1, -1]) { S.dot(c, '#0d1014', -16.4, 3 * sg, 1.5); S.dot(c, css(g, -0.2), -16.4, 3 * sg, 1); S.dot(c, '#e8ffff', -16.5, 3 * sg, 0.45); } for (let i = 0; i < 3; i++) S.lines(c, 'rgba(10,12,16,0.6)', 0.45, [-13.6 + i * 1.5, -2, -13.6 + i * 1.5, 2]); } },
      // turret ring
      { z0: 6, z1: 7, side: FRC.darker, top: FRC.dark, bevel: false, shape: (c) => S.circ(c, 0, 0, 7.4) },
      // sensor mast
      { z0: 8.4, z1: 13, side: '#8b939c', top: '#d6dde3', bevel: false, shape: (c) => S.circ(c, -14.4, 4.2, 0.45) },
      { z0: 12.6, z1: 13.6, side: css(g, -0.3), top: g, flat: true, bevel: false, shape: (c) => S.circ(c, -14.4, 4.2, 0.8), detail: (c) => glow(c, g, -14.4, 4.2, 0.6, 2.2) },
    ];
    return { r: 24, h: 14, parts };
  };

  /* ======================================================================
   * FRC LANCER GUNSHIP — friendly gunship in the hero's livery but its own
   * silhouette: long fuselage with a lance nose cannon, tandem cyan canopy,
   * stub wings ending in ducted fan rings, rocket pods, canted twin fins.
   * ==================================================================== */
  M.veLancer = function (p, o) {
    const g = frcGlow(p), trim = FRC.trim, seam = 'rgba(24,28,34,0.55)';
    const fans = [[-2, 13.6], [-2, -13.6]], FR = 4.2;
    const wing = [6, 2.6, 2.6, 11, -5.6, 11, -7.4, 2.6];
    const parts = [
      // stub wings
      { z0: 2.2, z1: 3.8, side: FRC.hullS, top: FRC.hullT, shape: (c) => { S.poly(c, wing); S.poly(c, mir(wing)); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, seam, 0.4, [-1, 3 * sg, -1, 10.6 * sg]); S.fillPoly(c, trim, [2.2, 9.6 * sg, -5.2, 9.6 * sg, -5.4, 10.6 * sg, 2.4, 10.6 * sg]); } } },
      // rocket pods under the wings
      { z0: 1, z1: 3.6, side: FRC.dark, top: FRC.metal, shape: (c) => { S.rrect(c, -3, 5.4, 10.4, 3, 1.2); S.rrect(c, -3, -8.4, 10.4, 3, 1.2); },
        detail: (c) => { for (const sg of [1, -1]) { for (const y of [6.2, 7.6]) S.dot(c, '#101418', 7, y * sg, 0.45); S.fillPoly(c, trim, [5.2, 5.5 * sg, 4.2, 5.5 * sg, 4.2, 8.3 * sg, 5.2, 8.3 * sg]); } } },
      // ducted fan cores
      { z0: 2.8, z1: 2.8, side: g, top: css(g, -0.25), flat: true, shape: (c) => { for (const q of fans) S.circ(c, q[0], q[1], FR - 1.2); },
        detail: (c) => { for (const q of fans) { S.dot(c, css(g, 0.45), q[0], q[1], FR * 0.42); S.lines(c, 'rgba(20,40,50,0.5)', 0.35, [q[0] - FR + 1.4, q[1], q[0] + FR - 1.4, q[1], q[0], q[1] - FR + 1.4, q[0], q[1] + FR - 1.4]); } } },
      // fan shrouds
      { z0: 2, z1: 5.8, side: FRC.ringS, top: FRC.ringT, stroke: 1.9, bevel: false, shape: (c) => { for (const q of fans) S.circ(c, q[0], q[1], FR); } },
      // fuselage
      { z0: 1.6, z1: 7.2, side: FRC.hullS, top: FRC.hullT, shape: (c) => S.poly(c, S.sym([17, 0, 14, 2.4, 7, 3.9, -8, 3.7, -15, 2.6, -18.5, 0])),
        detail: (c) => {
          S.lines(c, seam, 0.45, [3, -3.8, 3, 3.8, -6, -3.7, -6, 3.7, -13, -2.9, -13, 2.9]);
          S.lines(c, 'rgba(255,255,255,0.24)', 0.5, [16.4, -0.4, 7, -3.4]);
          for (const sg of [1, -1]) S.fillPoly(c, trim, [15.4, 1 * sg, 12, 2.9 * sg, 11.4, 2.4 * sg, 14.6, 0.7 * sg]);
        } },
      // lance cannon
      { z0: 3.6, z1: 5, side: FRC.dark, top: '#9aa3ac', bevel: false, shape: (c) => { S.rrect(c, 14, -0.8, 9.2, 1.6, 0.6); S.rrect(c, 22, -1.2, 2.2, 2.4, 0.6); },
        detail: (c) => { S.dot(c, '#0d1014', 24, 0, 0.5); S.lines(c, 'rgba(255,255,255,0.3)', 0.3, [15, -0.5, 21.6, -0.5]); } },
      // canopy frame + glass
      { z0: 7.2, z1: 8.2, side: FRC.dark, top: '#2f3640', shape: (c) => S.ell(c, 9.4, 0, 5.4, 2.6) },
      { z0: 8.2, z1: 9.1, side: '#123040', top: '#123040', flat: true, shape: (c) => S.ell(c, 9.6, 0, 4.6, 2),
        detail: (c) => {
          const gr = c.createLinearGradient(5.6, -2, 14, 2); gr.addColorStop(0, '#7ff6ff'); gr.addColorStop(0.45, '#1b4a5c'); gr.addColorStop(1, '#0d1c26');
          c.fillStyle = gr; c.beginPath(); S.ell(c, 9.6, 0, 4.6, 2); c.fill();
          S.lines(c, 'rgba(10,14,18,0.7)', 0.4, [9, -2, 9, 2]); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); S.ell(c, 11.4, -0.8, 1.8, 0.4, -0.2); c.fill();
        } },
      // dorsal engine hump
      { z0: 7.2, z1: 10, side: FRC.metal, top: '#8f98a3', shape: (c) => S.poly(c, S.sym([3, 0, 1.6, 2.6, -11, 2.6, -13, 1.6, -13, 0])),
        detail: (c) => { for (let i = 0; i < 4; i++) S.lines(c, 'rgba(10,12,16,0.6)', 0.45, [-2 - i * 1.5, -1.6, -2 - i * 1.5, 1.6]); S.dot(c, '#101418', -12.4, 0, 1.2); S.dot(c, css(g, -0.2), -12.4, 0, 0.8); } },
      // canted twin tail fins
      { z0: 7, z1: 12.4, side: FRC.hullS, top: trim, shape: (c) => { S.poly(c, [-12, 2, -18.4, 5.8, -19.6, 5, -13.6, 1.4]); S.poly(c, [-12, -2, -18.4, -5.8, -19.6, -5, -13.6, -1.4]); } },
      // nav lights: port red, starboard green, white tail strobe
      { z0: 5.8, z1: 6.4, side: '#202428', top: '#202428', flat: true, bevel: false, shape: (c) => { S.circ(c, -2, 13.6 + FR, 0.5); S.circ(c, -2, -13.6 - FR, 0.5); },
        detail: (c) => { glow(c, '#5aff7a', -2, 13.6 + FR, 0.5, 2.2); glow(c, '#ff4a4a', -2, -13.6 - FR, 0.5, 2.2); } },
    ];
    return { r: 25, h: 13, parts };
  };
})(window.AS);
