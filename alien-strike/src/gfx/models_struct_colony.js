/* ALIEN STRIKE — redesigned colony / industrial structures and consoles (package structColony).
 * Human-frontier language: gunmetal walls, off-white panels, amber hazard trim, teal/cyan
 * (or world palette glow) lights, rivets, antennas and floodlights. Single-direction sheets.
 * Front (+y) walls face the camera, so doors, windows and screens sit on the +y side.
 * Generators (all registered on AS.Models, prefix "sc"):
 *   scTurretBunker  sandbagged gun pit + armoured gun ring   (gun sheet sits at gunZ 7)
 *   scDerrick       lattice drill tower, pumpjack, oil spill   (anims 4)
 *   scRefinery      cracking towers, tanks, sphere, flare stack (anims 4 flame)
 *   scFuelDepot     hazard-banded fuel tanks inside a bund wall
 *   scAmmoDepot     quonset munitions store + crate stacks
 *   scPen           Choir energy cage: pylons, violet light bars, floor glyph (anims 2)
 *   scIceBlock      faceted ice-shard prison with a huddled figure inside
 *   scCoolant       frosted blue-glass coolant tank on a pump skid (anims 2)
 *   scHeatStation   reactor dome, twin cooling towers, radiating heat pipes (anims 2)
 *   scPad           bevelled octagon landing pad with H and light ring (anims 4 chase)
 *   scStation       modular research compound: hab domes, solar array, comms dish
 *   scDome          fortified colony shelter: ribbed dome, windows, airlock, beacon (anims 2)
 *   scPlatform      steel deck platform with hazard edges
 *   scVent          steaming fumarole with mineral crust (anims 2)
 *   scCrusher       piston press with slamming plate and warning stripes (anims 4)
 *   scRelay / scThumper / scValve / scSwitch / scChargeSite   consoles (shared interact ring)
 *   scBunker        blast door in an armoured berm with floodlights */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  const P = (p) => Object.assign({ a: '#7d8288', b: '#b9bec4', t: '#d08a2a', g: '#7fe8ff', d: '#33363a' }, p || {});
  const SEAM = 'rgba(16,18,22,0.5)', SEAM2 = 'rgba(16,18,22,0.32)', HI = 'rgba(255,255,255,0.28)';
  const HAZ_A = '#e8b23a', HAZ_B = '#22201c';
  const cs = (col, f, a) => C.str(f ? C.shade(col, f) : col, a);
  const mix = (a, b, t) => C.mix(a, b, t);
  const ngon = (x, y, r, n, rot) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push(x + Math.cos(t) * r, y + Math.sin(t) * r); } return a; };
  function glow(c, col, x, y, r, a) {
    a = a === undefined ? 1 : a;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(C.shade(col, 0.7), a)); g.addColorStop(0.35, C.str(col, a * 0.9)); g.addColorStop(1, C.str(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function ring(c, col, x, y, r, w, a0, a1) { c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0 || 0, a1 === undefined ? TAU : a1); c.stroke(); c.restore(); }
  function annulus(c, x, y, r1, r2) { c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU); c.moveTo(x + r2, y); c.arc(x, y, r2, TAU, 0, true); }
  // square frame path (outer cw, inner ccw → hole with nonzero fill)
  function frame(c, x, y, R, w) { c.rect(x - R, y - R, R * 2, R * 2); c.moveTo(x - R + w, y - R + w); c.lineTo(x - R + w, y + R - w); c.lineTo(x + R - w, y + R - w); c.lineTo(x + R - w, y - R + w); c.closePath(); }
  // diagonal hazard stripes clipped to a polygon
  function hazard(c, pts, w, ca, cb, ang) {
    c.save(); c.beginPath(); S.poly(c, pts); c.clip();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    c.fillStyle = cb || HAZ_B; c.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
    c.fillStyle = ca || HAZ_A;
    const k = ang === undefined ? 1 : ang, span = (x1 - x0) + (y1 - y0) + w * 4;
    c.beginPath();
    for (let s = -span; s < span; s += w * 2) { const xa = x0 + s; c.moveTo(xa, y0 - 1); c.lineTo(xa + w, y0 - 1); c.lineTo(xa + w + (y1 - y0 + 2) * k, y1 + 1); c.lineTo(xa + (y1 - y0 + 2) * k, y1 + 1); c.closePath(); }
    c.fill(); c.restore();
  }
  const rectPts = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h];
  function rivets(c, pts, r, col) { c.save(); c.fillStyle = col || 'rgba(20,22,26,0.55)'; c.beginPath(); for (let i = 0; i < pts.length; i += 2) { c.moveTo(pts[i] + (r || 0.35), pts[i + 1]); c.arc(pts[i], pts[i + 1], r || 0.35, 0, TAU); } c.fill(); c.restore(); }
  // thin vertical sliver just proud of a front (+y) wall: windows, doors, stripes on walls
  const frontStrip = (x0, x1, yWall) => (c) => S.poly(c, [x0, yWall - 0.7, x1, yWall - 0.7, x1, yWall + 0.4, x0, yWall + 0.4]);
  // front (+y, camera-facing) half of a ring: a band painted on a cylinder wall without covering its top
  function frontArc(c, x, y, r, w) { c.moveTo(x + r + w * 0.35, y); c.arc(x, y, r + w * 0.35, 0, Math.PI); c.lineTo(x - r + w * 0.65, y); c.arc(x, y, r - w * 0.65, Math.PI, 0, true); c.closePath(); }
  const band = (x, y, r, z0, z1, side, top) => ({ z0, z1, side, top: top || side, bevel: false, flat: !top, shape: (c) => (Array.isArray(x) ? x.forEach((q) => frontArc(c, q[0], q[1], q[2], 1)) : frontArc(c, x, y, r, 1)) });
  // row of lit windows on a flat front wall
  const windows = (x0, x1, n, yWall, z0, z1, col) => ({ z0, z1, side: C.shade(col, -0.15), top: C.shade(col, 0.3), flat: true, bevel: false,
    shape: (c) => { const w = (x1 - x0) / n; for (let i = 0; i < n; i++) frontStrip(x0 + i * w + w * 0.18, x0 + (i + 1) * w - w * 0.18, yWall)(c); } });
  // lit window slits on a cylinder / dome front: arcs between angles
  function arcSeg(c, x, y, r, w, a0, a1) { c.moveTo(x + Math.cos(a0) * (r + w * 0.35), y + Math.sin(a0) * (r + w * 0.35)); c.arc(x, y, r + w * 0.35, a0, a1); c.arc(x, y, r - w * 0.65, a1, a0, true); c.closePath(); }
  // emissive lamp part (flat lens + halo)
  const lamp = (x, y, z, col, r) => ({ z0: z, z1: z + 0.8, side: C.shade(col, -0.35), top: col, flat: true, bevel: false, shape: (c) => S.circ(c, x, y, r || 0.9),
    detail: (c) => { glow(c, col, x, y, (r || 0.9) * 2.4, 0.9); S.dot(c, '#ffffff', x - (r || 0.9) * 0.25, y - (r || 0.9) * 0.25, (r || 0.9) * 0.35); } });
  // a pipe run on the ground as a stroked part
  const pipeRun = (z0, z1, w, side, top, segs) => ({ z0, z1, side, top, stroke: w, bevel: false, shape: (c) => { for (let i = 0; i < segs.length; i += 4) S.seg(c, segs[i], segs[i + 1], segs[i + 2], segs[i + 3]); } });
  // concrete / ground slab
  const slabCols = (p) => ({ side: mix(p.d, '#000000', 0.15), top: mix(p.d, p.a, 0.5) });

  /* ======================================================================
   * REFINERY — W2 primary target. Visual radius ~60 (collision r 38).
   * Back: twin cracking towers + flare stack with animated flame.
   * Front: storage tanks, a horton sphere and the process hall.
   * ====================================================================== */
  M.scRefinery = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.b, 0.35), owS = mix(p.a, p.b, 0.35), owT = C.shade(p.b, 0.1);
    const sl = slabCols(p);
    const slab = [-54, -30, -40, -44, 30, -46, 54, -30, 56, 26, 40, 40, -30, 42, -56, 22];
    parts.push({ z0: 0, z1: 2, side: sl.side, top: sl.top, shape: (c) => S.poly(c, slab),
      detail: (c) => {
        S.lines(c, SEAM2, 0.5, [-54, 0, 56, 0, 0, -45, 0, 41, -28, -40, -28, 41, 28, -45, 28, 40]);
        // painted lane + oil stains
        c.save(); c.setLineDash([3, 2.5]); S.lines(c, cs(p.t, 0, 0.85), 0.9, [-50, 6, 50, 6]); c.restore();
        for (const q of [[-18, 30, 7, 3], [14, -4, 5, 2.4], [-44, -10, 4, 2]]) { c.fillStyle = 'rgba(18,14,12,0.45)'; c.beginPath(); S.ell(c, q[0], q[1], q[2], q[3], 0.3); c.fill(); }
      } });
    // process hall (front left)
    parts.push({ z0: 2, z1: 14, side: gmS, top: gmT, shape: (c) => S.rrect(c, -50, 8, 30, 22, 1.5),
      detail: (c) => {
        S.lines(c, SEAM, 0.45, [-40, 8.5, -40, 29.5, -30, 8.5, -30, 29.5]);
        hazard(c, rectPts(-50, 27.6, 30, 2.2), 1.4);
        // roof fans
        for (const x of [-45, -35, -25]) { S.dot(c, '#1d2024', x, 16, 3.4); ring(c, cs(p.b, -0.1), x, 16, 3.4, 0.6); S.lines(c, 'rgba(160,170,180,0.5)', 0.5, [x - 2.6, 16, x + 2.6, 16, x, 13.4, x, 18.6]); }
        rivets(c, [-49, 9.5, -21, 9.5, -49, 25.5, -21, 25.5]);
      } });
    parts.push(windows(-48, -22, 5, 30, 5, 9, p.g));
    // storage tanks (front right) — squat cylinders with domed lids
    const tank = (x, y, r, h, z0) => ({ z0: z0 || 2, z1: (z0 || 2) + h, side: owS, top: owT, shape: (c, zt) => { const k = zt > 0.82 ? Math.sqrt(1 - Math.pow((zt - 0.82) / 0.18, 2) * 0.55) : 1; S.circ(c, x, y, r * k); },
      detail: (c) => { ring(c, SEAM, x, y, r * 0.6, 0.5); S.dot(c, '#3a3d42', x, y, 1.6); S.lines(c, HI, 0.6, [x - r * 0.55, y - r * 0.35, x - r * 0.2, y - r * 0.62]); } });
    parts.push(tank(30, 18, 13, 17));
    parts.push(band(30, 18, 13, 6, 9, C.shade(p.t, -0.1), p.t));
    parts.push(tank(4, 28, 9.5, 13));
    parts.push(band(4, 28, 9.5, 5, 7.5, C.shade(p.t, -0.1), p.t));
    // horton sphere on legs (right back)
    parts.push({ z0: 2, z1: 12, side: p.d, top: gmT, shape: (c, zt) => { for (const a of [0.4, 2.0, 3.6, 5.2]) S.circ(c, 36 + Math.cos(a) * 8, -22 + Math.sin(a) * 8, 1.1); } });
    parts.push({ z0: 6, z1: 28, side: owS, top: owT, shape: (c, zt) => S.circ(c, 36, -22, 11 * Math.sqrt(Math.max(0.04, 1 - Math.pow(zt * 2 - 1, 2)))),
      detail: (c) => { S.dot(c, '#2f3236', 36, -22, 1.4); } });
    parts.push(band(36, -22, 11, 15, 18, C.shade(p.t, -0.1), p.t));
    // cracking towers (back)
    const towers = [[-12, -26, 6.5, 66], [6, -32, 5, 54]];
    for (const t of towers) {
      parts.push({ z0: 2, z1: t[3], side: gmS, top: owT, shape: (c, zt) => S.circ(c, t[0], t[1], t[2] * (zt > 0.93 ? Math.sqrt(1 - Math.pow((zt - 0.93) / 0.07, 2) * 0.6) : 1)),
        detail: (c) => { S.dot(c, '#2a2d31', t[0], t[1], t[2] * 0.35); } });
    }
    // catwalk rings on the towers
    for (const z of [18, 34, 50]) parts.push({ z0: z, z1: z + 1.4, side: C.shade(p.t, -0.2), top: p.t, bevel: false, shape: (c) => { for (const t of towers) if (z < t[3] - 4) frontArc(c, t[0], t[1], t[2] + 0.6, 2); } });
    // pipe racks linking the units
    parts.push({ z0: 2, z1: 7, side: p.d, top: gmT, shape: (c) => { for (const q of [[-30, -8], [-6, -8], [16, -8], [16, 6]]) S.rect(c, q[0] - 0.8, q[1] - 0.8, 1.6, 1.6); } });
    parts.push(pipeRun(7, 9, 1.6, mix(p.t, p.d, 0.4), C.shade(p.t, 0.1), [-36, 8, -36, -8, -36, -8, 22, -8, 22, -8, 22, 5, -12, -20, -12, -8, 6, -27, 6, -8, 36, -11, 22, -8]));
    parts.push(pipeRun(9, 10.6, 1.1, mix(p.b, p.d, 0.4), owT, [-36, -6, 24, -6, 24, -6, 24, 8]));
    // flare stack with a tripod derrick (far left back)
    const fx = -40, fy = -30, FH = 82;
    parts.push({ z0: 2, z1: FH - 10, side: p.d, top: gmT, shape: (c, zt) => { const r = 7 * (1 - zt * 0.85); for (const a of [0.5, 2.6, 4.7]) S.circ(c, fx + Math.cos(a) * r, fy + Math.sin(a) * r, 0.7); } });
    for (const z of [16, 34, 52]) parts.push({ z0: z, z1: z + 0.6, side: p.d, top: gmT, stroke: 0.6, bevel: false, shape: (c) => { const r = 7 * (1 - (z - 2) / (FH - 12) * 0.85); S.poly(c, ngon(fx, fy, r, 3, 0.5)); } });
    parts.push({ z0: 2, z1: FH, side: mix(p.d, p.a, 0.5), top: '#3a3532', shape: (c) => S.circ(c, fx, fy, 1.5) });
    parts.push({ z0: FH - 6, z1: FH - 4, side: HAZ_B, top: HAZ_A, bevel: false, shape: (c) => S.circ(c, fx, fy, 1.9) });
    // flame (animated): tongue leaning with the wind
    parts.push({ z0: FH, z1: FH + 15, side: '#ff6a14', top: '#ffd060', flat: true, bevel: false,
      shape: (c, zt, an) => { const w = Math.sin(an * TAU) * 1.2; const r = 3.8 * Math.pow(1 - zt, 0.8) * (1 + 0.22 * Math.sin(an * TAU * 2 + zt * 5)) + 0.4; S.circ(c, fx + zt * (4 + w), fy + Math.sin(zt * 3 + an * TAU) * 0.6, r); } });
    parts.push({ z0: FH, z1: FH + 8, side: '#ffc040', top: '#fffbe0', flat: true, bevel: false, shape: (c, zt, an) => S.circ(c, fx + zt * 2, fy, 2.2 * (1 - zt) + 0.3) });
    // tower crowns: aviation lamps
    parts.push(lamp(-12, -26, 66.5, '#ff4a3a', 0.9));
    parts.push(lamp(6, -32, 54.5, p.g, 0.8));
    return { r: 60, h: FH + 18, parts, style: 'unit' };
  };

  /* ======================================================================
   * DERRICK — W2 primary. Lattice tower ~76 tall (1.5x), travelling block that
   * rides the drill string, a nodding pumpjack and a glossy oil spill. anims 4.
   * ====================================================================== */
  M.scDerrick = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const sl = slabCols(p);
    const TH = 74, B = 10.5, T = 2.6, Z0 = 3;
    const legR = (z) => B + (T - B) * ((z - Z0) / (TH - Z0));
    // oil spill pool (under everything)
    parts.push({ z0: 0, z1: 0.3, side: '#120e0c', top: '#1c1613', flat: true, bevel: false, shape: (c) => { S.blob(c, 10, 19, 12, 4, 13, 0.22); S.blob(c, 24, 21, 6, 9, 9, 0.3); },
      detail: (c) => {
        const g = c.createLinearGradient(0, 10, 30, 28); g.addColorStop(0, 'rgba(130,90,210,0.5)'); g.addColorStop(0.5, 'rgba(60,180,170,0.4)'); g.addColorStop(1, 'rgba(230,170,60,0.45)');
        c.save(); c.strokeStyle = g; c.lineWidth = 1; c.beginPath(); S.blob(c, 10, 19, 10.6, 4, 13, 0.22); c.stroke(); c.restore();
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); S.ell(c, 6, 15, 4, 0.8, -0.3); S.ell(c, 23, 19, 2, 0.5, -0.3); c.fill();
      } });
    // drill floor / substructure
    parts.push({ z0: 0, z1: 3, side: sl.side, top: sl.top, shape: (c) => S.rrect(c, -15, -15, 30, 30, 1.5),
      detail: (c) => {
        hazard(c, rectPts(-15, 12.4, 30, 2.6), 1.5); hazard(c, rectPts(-15, -15, 2.6, 27.4), 1.5);
        S.lines(c, SEAM, 0.45, [-12, -6, 15, -6, -12, 6, 15, 6]);
        S.dot(c, '#141212', 0, 0, 2.6); ring(c, cs(p.b), 0, 0, 2.6, 0.6);
      } });
    // drawworks shed (back left)
    parts.push({ z0: 3, z1: 10, side: mix(p.d, p.a, 0.3), top: C.shade(p.t, -0.05), shape: (c) => S.rrect(c, -22, -24, 13, 9, 1),
      detail: (c) => { S.lines(c, SEAM, 0.45, [-22, -19.5, -9, -19.5]); S.dot(c, '#2a2a2a', -12, -21.5, 1.2); } });
    // lattice legs
    const legCol = mix(p.d, p.a, 0.2), legTop = C.shade(p.b, 0.05);
    parts.push({ z0: Z0, z1: TH, side: legCol, top: legTop, shape: (c, zt) => { const r = legR(Z0 + zt * (TH - Z0)); for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.circ(c, sx * r, sy * r, 0.95); } });
    // X-bracing panels (each slice is a dot travelling across the face) + girder frame on top
    const lv = [3, 15, 26, 36, 45, 53, 60, 66];
    for (let i = 0; i < lv.length - 1; i++) {
      const za = lv[i], zb = lv[i + 1];
      parts.push({ z0: za, z1: zb, side: legCol, top: legTop, bevel: false,
        shape: (c, zt) => {
          const z = za + zt * (zb - za), r = legR(z);
          if (zt > 0.97) { frame(c, 0, 0, r + 0.5, 1.1); return; }
          const u = (zt * 2 - 1) * r;
          for (const s of [-1, 1]) { S.circ(c, u, s * r, 0.5); S.circ(c, -u, s * r, 0.5); S.circ(c, s * r, u, 0.5); S.circ(c, s * r, -u, 0.5); }
        } });
    }
    // drill string + travelling block (animated)
    parts.push({ z0: Z0, z1: TH - 4, side: '#4a4c50', top: '#9a9ea4', shape: (c) => S.circ(c, 0, 0, 0.6) });
    parts.push({ z0: 30, z1: 36, side: C.shade(HAZ_A, -0.35), top: HAZ_A, shape: (c) => S.rrect(c, -1.8, -1.8, 3.6, 3.6, 0.8),
      when: (an) => an < 0.25 || an >= 0.75 });
    parts.push({ z0: 44, z1: 50, side: C.shade(HAZ_A, -0.35), top: HAZ_A, shape: (c) => S.rrect(c, -1.8, -1.8, 3.6, 3.6, 0.8),
      when: (an) => an >= 0.25 && an < 0.75 });
    // crown block + beacon
    parts.push({ z0: TH, z1: TH + 3, side: p.d, top: mix(p.a, p.b, 0.5), shape: (c) => S.rect(c, -3.4, -3.4, 6.8, 6.8),
      detail: (c) => { S.lines(c, SEAM, 0.45, [-3.4, 0, 3.4, 0]); } });
    parts.push(lamp(0, 0, TH + 3, '#ff4a3a', 1.1));
    // pumpjack (front right): skid, samson post, nodding walking beam, horse head
    const jx = 20, jy = 2;
    parts.push({ z0: 0, z1: 2, side: p.d, top: mix(p.a, p.d, 0.3), shape: (c) => S.rrect(c, jx - 9, jy - 2.6, 18, 5.2, 1) });
    parts.push({ z0: 2, z1: 10, side: p.d, top: mix(p.a, p.b, 0.3), shape: (c, zt) => { const w = 3.4 * (1 - zt) + 0.7; S.circ(c, jx - w, jy - 1.4, 0.75); S.circ(c, jx + w * 0.4, jy - 1.4, 0.75); S.circ(c, jx - w, jy + 1.4, 0.75); S.circ(c, jx + w * 0.4, jy + 1.4, 0.75); } });
    for (let k = 0; k < 4; k++) {
      const tilt = Math.sin((k / 4) * TAU) * 3.2;
      const on = (an) => Math.floor(an * 4 + 1e-6) % 4 === k;
      parts.push({ z0: 9, z1: 12, side: p.d, top: mix(p.a, p.d, 0.2), when: on,
        shape: (c, zt) => { const z = 9 + zt * 3; for (let x = -8; x <= 8; x += 1) { const zb = 10.5 + tilt * x / 9; if (Math.abs(z - zb) < 0.8) S.rect(c, jx + x - 0.6, jy - 1.2, 1.2, 2.4); } } });
      parts.push({ z0: 10.5 + tilt - 3, z1: 10.5 + tilt + 1.6, side: C.shade(p.t, -0.3), top: C.shade(p.t, 0.12), when: on,
        shape: (c) => S.poly(c, [jx + 7.6, jy - 1.5, jx + 10.6, jy - 1.5, jx + 12, jy, jx + 10.6, jy + 1.5, jx + 7.6, jy + 1.5]) });
      parts.push({ z0: 10.5 - tilt - 3, z1: 10.5 - tilt + 0.8, side: '#3c3b3a', top: '#6c6a66', when: on, shape: (c) => S.rrect(c, jx - 10, jy - 1.8, 3, 3.6, 0.8) });
    }
    parts.push({ z0: 0, z1: 4, side: '#3a3836', top: '#7a7670', shape: (c) => S.circ(c, jx + 11, jy, 1.4) });
    // pipeline stub toward the refinery
    parts.push({ z0: 0, z1: 2, side: p.d, top: mix(p.a, p.d, 0.3), shape: (c) => { S.rect(c, 24, -9, 1.6, 3); S.rect(c, 31, -9, 1.6, 3); } });
    parts.push(pipeRun(2, 3.8, 1.8, mix(p.t, p.d, 0.4), C.shade(p.t, 0.1), [0, -7.5, 34, -7.5]));
    return { r: 36, h: TH + 6, parts, style: 'unit' };
  };

  /* ======================================================================
   * THERMAL STATION — W4 defend target (heatstation). ~110 across.
   * Reactor drum + dome with a glowing orange crown vent, two hollow cooling
   * towers behind, insulated heat pipes radiating out (N, E, W), control block.
   * anims 2 (vent pulse).
   * ====================================================================== */
  M.scHeatStation = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const hot = o.hot || '#ff8a2a';
    const gmS = mix(p.d, p.a, 0.25), gmT = mix(p.a, p.d, 0.25), owS = mix(p.a, p.d, 0.2), owT = mix(p.b, p.a, 0.35);
    const sl = slabCols(p);
    // pad
    parts.push({ z0: 0, z1: 2, side: sl.side, top: mix(p.d, p.a, 0.3), shape: (c) => S.poly(c, ngon(0, -4, 40, 8, Math.PI / 8)),
      detail: (c) => { ring(c, cs(p.t, 0, 0.8), 0, -4, 34, 1); c.save(); c.setLineDash([2, 2]); ring(c, 'rgba(0,0,0,0.3)', 0, -4, 28, 0.6); c.restore(); } });
    // heat pipes radiating out (to the valves): N, E, W, plus support saddles
    const pipeCol = mix(p.t, p.d, 0.25), pipeTop = C.shade(p.t, 0.15);
    parts.push({ z0: 0, z1: 3, side: p.d, top: gmT, shape: (c) => { for (const q of [[-48, 8], [-40, 8], [46, 8], [38, 8], [0, -50]]) S.rect(c, q[0] - 1.2, q[1] - 2.4, 2.4, 4.8); } });
    parts.push(pipeRun(3, 6, 3, pipeCol, pipeTop, [-20, 8, -54, 8, 20, 8, 54, 8, -6, -30, -6, -54]));
    parts.push({ z0: 3, z1: 7, side: p.d, top: gmT, shape: (c) => { for (const q of [[-50, 8, 0], [50, 8, 0], [-6, -52, 1]]) q[2] ? S.rect(c, q[0] - 2.2, q[1] - 1.2, 4.4, 2.4) : S.rect(c, q[0] - 1.2, q[1] - 2.2, 2.4, 4.4); } });
    // cooling towers (hollow hyperboloids) with a warm glow inside
    const ct = [[-24, -22], [22, -26]];
    parts.push({ z0: 2, z1: 40, side: mix(p.a, p.d, 0.35), top: mix(p.b, p.a, 0.2),
      shape: (c, zt) => { const r = 13 - 6.5 * Math.sin(Math.min(1, zt / 0.78) * Math.PI / 2) + (zt > 0.78 ? (zt - 0.78) * 9 : 0); for (const q of ct) annulus(c, q[0], q[1], r, r - 1.3); },
      detail: (c) => { for (const q of ct) ring(c, cs(hot, 0, 0.5), q[0], q[1], 7.2, 0.8); } });
    parts.push({ z0: 40, z1: 40, side: '#1a1512', top: '#1a1512', flat: true, bevel: false, shape: (c) => { for (const q of ct) S.circ(c, q[0], q[1], 7.1); },
      detail: (c) => { for (const q of ct) { c.save(); c.beginPath(); S.circ(c, q[0], q[1], 7.1); c.clip(); glow(c, hot, q[0], q[1] + 3, 9, 0.85); glow(c, '#fff0c0', q[0], q[1] + 4, 3, 0.6); c.restore(); } } });
    parts.push(band([[ct[0][0], ct[0][1], 10.6], [ct[1][0], ct[1][1], 10.6]], 0, 0, 10, 13, C.shade(p.t, -0.1), p.t));
    // reactor drum
    parts.push({ z0: 2, z1: 12, side: gmS, top: gmT, shape: (c) => S.poly(c, ngon(0, 6, 21, 12, 0)),
      detail: (c) => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.lines(c, SEAM, 0.45, [Math.cos(a) * 17, 6 + Math.sin(a) * 17, Math.cos(a) * 21, 6 + Math.sin(a) * 21]); } } });
    // off-white panel band + hazard band on the drum wall
    parts.push(band(0, 6, 20.8, 5, 9, owT, owT));
    parts.push(band(0, 6, 20.8, 2, 3.4, HAZ_A));
    // dome
    parts.push({ z0: 12, z1: 27, side: mix(p.a, p.b, 0.15), top: owT, shape: (c, zt) => S.circ(c, 0, 6, 17.5 * Math.cos(zt * 1.25) + 0.5),
      detail: (c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; S.lines(c, SEAM, 0.5, [Math.cos(a) * 6.5, 6 + Math.sin(a) * 6.5, Math.cos(a) * 9.5, 6 + Math.sin(a) * 9.5]); } } });
    // dome ribs on the camera-facing side (dots travelling up the curve)
    parts.push({ z0: 12, z1: 26, side: gmS, top: gmT, bevel: false, shape: (c, zt) => { const r = 17.5 * Math.cos(zt * 1.25) + 0.7; for (const a of [0.35, 1.05, 1.75, 2.45, 3.0, 0.0 - 0.2]) S.circ(c, Math.cos(a) * r, 6 + Math.sin(a) * r, 0.8); } });
    // glowing crown vent (pulses)
    parts.push({ z0: 27, z1: 29, side: gmS, top: '#2a2420', shape: (c) => S.circ(c, 0, 6, 6.2) });
    parts.push({ z0: 29, z1: 29.6, side: hot, top: hot, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 6, 4.6),
      detail: (c, an) => { glow(c, an < 0.5 ? '#ffd27a' : hot, 0, 6, an < 0.5 ? 5.2 : 4.4, 1); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.78; S.lines(c, 'rgba(60,20,10,0.6)', 0.6, [Math.cos(a) * 1.6, 6 + Math.sin(a) * 1.6, Math.cos(a) * 4.5, 6 + Math.sin(a) * 4.5]); } } });
    // control block (front left) with lit windows
    parts.push({ z0: 2, z1: 11, side: gmS, top: owT, shape: (c) => S.rrect(c, -40, 14, 18, 14, 1.5),
      detail: (c) => { hazard(c, rectPts(-40, 25.8, 18, 2.2), 1.3); S.lines(c, SEAM, 0.45, [-31, 14.5, -31, 25.5]); S.dot(c, '#2a2d31', -36, 18, 1.6); } });
    parts.push(windows(-39, -23, 4, 28, 5, 8.5, p.g));
    // transformer / pump skid (front right)
    parts.push({ z0: 2, z1: 8, side: gmS, top: gmT, shape: (c) => { S.rrect(c, 24, 16, 12, 10, 1); },
      detail: (c) => { for (let i = 0; i < 4; i++) S.lines(c, SEAM, 0.45, [25 + i * 3, 17, 25 + i * 3, 25]); } });
    // lamps
    parts.push(lamp(-24, -31, 40, '#ff4a3a', 0.8));
    parts.push(lamp(22, -35, 40, '#ff4a3a', 0.8));
    parts.push(lamp(-23, 21, 11.2, p.g, 0.9));
    return { r: 58, h: 44, parts, style: 'unit' };
  };
  /* ======================================================================
   * RESEARCH STATION — modular colony compound (~84 across). Two hab domes
   * joined by a corridor, a prefab lab block, solar array, comms dish mast,
   * barrier blocks. opt.ruined: collapsed dome, scorch, lights out.
   * ====================================================================== */
  M.scStation = function (p, o) {
    p = P(p); o = o || {};
    const ruined = !!o.ruined;
    const parts = [];
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.d, 0.15), owS = mix(p.a, p.b, 0.3), owT = C.shade(p.b, 0.12);
    const lit = ruined ? '#3a3c40' : p.g;
    const sl = slabCols(p);
    parts.push({ z0: 0, z1: 1.6, side: sl.side, top: sl.top, shape: (c) => S.rrect(c, -42, -32, 84, 62, 4),
      detail: (c) => {
        S.lines(c, SEAM2, 0.5, [-42, 0, 42, 0, -14, -32, -14, 30, 14, -32, 14, 30]);
        c.save(); c.setLineDash([2.5, 2]); S.lines(c, cs(p.t, 0, 0.8), 0.8, [-38, 26, 38, 26]); c.restore();
        if (ruined) for (const q of [[-18, -6, 14], [12, 8, 9], [30, -16, 7]]) { const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], q[2]); g.addColorStop(0, 'rgba(14,10,8,0.85)'); g.addColorStop(1, 'rgba(14,10,8,0)'); c.fillStyle = g; c.beginPath(); S.circ(c, q[0], q[1], q[2]); c.fill(); }
      } });
    // solar array (front left): two rows of panels on short legs
    parts.push({ z0: 1.6, z1: 3.5, side: p.d, top: gmT, shape: (c) => { for (const x of [-38, -26]) for (const y of [8, 20]) S.rect(c, x + 4.5, y + 1, 1.2, 1.2); } });
    parts.push({ z0: 3.5, z1: 4.6, side: '#1c2a44', top: '#2c4a78', shape: (c) => { for (const x of [-38, -26]) for (const y of [8, 20]) S.rect(c, x, y - 2.5, 10.5, 7); },
      detail: (c) => { for (const x of [-38, -26]) for (const y of [8, 20]) { S.lines(c, 'rgba(150,200,255,0.35)', 0.35, [x + 3.5, y - 2.5, x + 3.5, y + 4.5, x + 7, y - 2.5, x + 7, y + 4.5, x, y + 1, x + 10.5, y + 1]); S.lines(c, HI, 0.5, [x + 0.5, y - 2, x + 3, y - 2]); } } });
    // corridor tube between the domes
    parts.push({ z0: 1.6, z1: 7, side: gmS, top: owT, shape: (c) => S.poly(c, [-8, -10, 6, -15, 7.5, -10.5, -6.5, -5.5]),
      detail: (c) => S.lines(c, SEAM, 0.45, [-1, -12.5, 0.5, -8]) });
    // hab domes
    const domes = ruined ? [[-18, -4, 14, 0.5], [16, -16, 10.5, 1]] : [[-18, -4, 14, 1], [16, -16, 10.5, 1]];
    for (const d of domes) {
      const H = d[2] * 0.85 * d[3];
      parts.push({ z0: 1.6, z1: 4, side: gmS, top: gmT, shape: (c) => S.circ(c, d[0], d[1], d[2] + 1.2) });
      parts.push({ z0: 4, z1: 4 + H, side: owS, top: d[3] < 1 ? '#3a3330' : owT,
        shape: (c, zt) => { const r = d[2] * Math.cos(zt * d[3] * 1.25) + 0.4; if (d[3] < 1) S.blob(c, d[0], d[1], r, 3, 9, 0.12 + zt * 0.4); else S.circ(c, d[0], d[1], r); },
        detail: (c) => { if (d[3] < 1) { S.dot(c, '#141110', d[0], d[1], d[2] * 0.55); return; } S.dot(c, gmS, d[0], d[1], d[2] * 0.22); ring(c, SEAM, d[0], d[1], d[2] * 0.22, 0.5); } });
      // ribs (front half) + window band
      parts.push({ z0: 4, z1: 4 + H * 0.95, side: gmS, top: gmT, bevel: false, shape: (c, zt) => { const r = d[2] * Math.cos(zt * d[3] * 1.25) + 0.5; for (const a of [0.15, 0.95, 1.75, 2.55, 3.3]) S.circ(c, d[0] + Math.cos(a) * r, d[1] + Math.sin(a) * r, 0.6); } });
      parts.push({ z0: 6.5, z1: 8.5, side: C.shade(lit, -0.15), top: C.shade(lit, 0.3), flat: true, bevel: false, shape: (c) => { const r = d[2] * Math.cos(0.12 * 1.25) + 0.2; for (const a of [0.3, 1.1, 1.9, 2.7]) arcSeg(c, d[0], d[1], r, 1, a + 0.12, a + 0.62); } });
    }
    // prefab lab block (front right)
    parts.push({ z0: 1.6, z1: 11, side: gmS, top: owT, shape: (c) => S.rrect(c, 6, 2, 28, 15, 1.4),
      detail: (c) => {
        S.lines(c, SEAM, 0.45, [15, 2.5, 15, 16.5, 25, 2.5, 25, 16.5]);
        hazard(c, rectPts(6, 15, 28, 2), 1.3);
        for (const x of [10, 20]) { S.fillPoly(c, '#2a2d31', rectPts(x, 5, 4, 4)); S.lines(c, 'rgba(150,160,170,0.6)', 0.4, [x + 0.5, 6, x + 3.5, 6, x + 0.5, 7.5, x + 3.5, 7.5]); }
        rivets(c, [7, 3, 33, 3, 7, 14, 33, 14]);
        if (ruined) { const g = c.createRadialGradient(24, 8, 0, 24, 8, 8); g.addColorStop(0, 'rgba(14,10,8,0.8)'); g.addColorStop(1, 'rgba(14,10,8,0)'); c.fillStyle = g; c.beginPath(); S.circ(c, 24, 8, 8); c.fill(); }
      } });
    parts.push(windows(7, 33, 5, 17, 4.5, 8, lit));
    // door with amber frame
    parts.push({ z0: 1.6, z1: 7.5, side: C.shade(p.t, -0.2), top: p.t, bevel: false, shape: frontStrip(-21, -15, 10.2 + 0.4) });
    // comms dish on a lattice mast (back right)
    const mx = 32, my = -20;
    parts.push({ z0: 1.6, z1: 4, side: gmS, top: gmT, shape: (c) => S.rect(c, mx - 3, my - 3, 6, 6) });
    parts.push({ z0: 4, z1: 22, side: p.d, top: gmT, shape: (c, zt) => { const r = 2.2 - zt * 1.2; S.circ(c, mx - r, my, 0.55); S.circ(c, mx + r, my - r, 0.55); S.circ(c, mx + r, my + r, 0.55); } });
    parts.push({ z0: 21, z1: 24, side: owS, top: owT, shape: (c, zt) => S.ell(c, mx - 1, my, 4 + zt * 2.5, 2.8 + zt * 2.5, -0.5),
      detail: (c) => { S.dot(c, '#7d8590', mx - 1, my, 4); S.dot(c, '#2a2d31', mx - 1, my, 1); S.lines(c, HI, 0.6, [mx - 5, my - 2, mx - 2, my - 4.5]); } });
    // antenna whip + lamps
    parts.push({ z0: 11, z1: 20, side: p.d, top: gmT, shape: (c) => S.circ(c, 30, 4, 0.4) });
    if (!ruined) {
      parts.push(lamp(30, 4, 20, '#ff4a3a', 0.7));
      parts.push(lamp(-40, -30, 1.6, p.g, 0.9)); parts.push(lamp(40, -30, 1.6, p.g, 0.9)); parts.push(lamp(-40, 28, 1.6, p.g, 0.9)); parts.push(lamp(40, 28, 1.6, p.g, 0.9));
    }
    // crates + barrier blocks
    parts.push({ z0: 1.6, z1: 5.5, side: mix(p.t, '#3a2a14', 0.5), top: C.shade(p.t, 0.05), shape: (c) => { S.rect(c, 36, 6, 4.5, 4.5); S.rect(c, 36, 11.5, 4.5, 4.5); S.rect(c, -6, 20, 4.5, 4.5); },
      detail: (c) => S.lines(c, 'rgba(40,24,10,0.6)', 0.4, [36, 8.2, 40.5, 8.2, 36, 13.7, 40.5, 13.7, -6, 22.2, -1.5, 22.2]) });
    parts.push({ z0: 1.6, z1: 4.5, side: mix(p.a, p.d, 0.3), top: mix(p.a, p.b, 0.4), shape: (c) => { for (const q of [[-42, -32, 1], [42, -32, -1]]) { S.rect(c, q[0] + (q[2] > 0 ? 0 : -8), q[1], 8, 3); S.rect(c, q[0] + (q[2] > 0 ? 0 : -3), q[1], 3, 8); } },
      detail: (c) => { hazard(c, rectPts(-42, -32, 8, 3), 1.2); hazard(c, rectPts(34, -32, 8, 3), 1.2); } });
    return { r: 46, h: 26, parts, style: 'unit' };
  };

  /* ======================================================================
   * COLONY SHELTER DOME — W6 protect target (~84 across). Perimeter wall with
   * lamps, ribbed off-white dome on a gunmetal drum, lit window ring, front
   * airlock, rooftop mast with a blinking beacon (anims 2).
   * ====================================================================== */
  M.scDome = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const R = o.r || 26;
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.d, 0.1), owS = mix(p.a, p.b, 0.45), owT = C.shade(p.b, 0.15);
    const sl = slabCols(p);
    const WR = R + 13;
    parts.push({ z0: 0, z1: 1.2, side: sl.side, top: sl.top, shape: (c) => S.circ(c, 0, 0, WR + 2),
      detail: (c) => { ring(c, SEAM2, 0, 0, R + 6, 0.6); c.save(); c.setLineDash([2, 2]); ring(c, cs(p.t, 0, 0.7), 0, 0, R + 4, 0.7); c.restore(); } });
    // perimeter wall segments (gap at the front for the airlock road)
    const gap = 0.42;
    parts.push({ z0: 1.2, z1: 6, side: gmS, top: mix(p.a, p.b, 0.3), shape: (c) => { const segs = 7; for (let i = 0; i < segs; i++) { const a0 = Math.PI / 2 + gap + i * (TAU - gap * 2) / segs + 0.05, a1 = a0 + (TAU - gap * 2) / segs - 0.1; c.moveTo(Math.cos(a0) * WR, Math.sin(a0) * WR); c.arc(0, 0, WR, a0, a1); c.arc(0, 0, WR - 2.6, a1, a0, true); c.closePath(); } },
      detail: (c) => { c.save(); c.setLineDash([1.6, 1.6]); ring(c, HAZ_A, 0, 0, WR - 1.3, 0.8, Math.PI / 2 + gap, Math.PI / 2 + TAU - gap); c.restore(); } });
    for (const a of [Math.PI / 2 + gap + 0.05, Math.PI / 2 - gap - 0.05, -0.4, Math.PI + 0.4, -Math.PI / 2]) parts.push(lamp(Math.cos(a) * (WR - 1.3), Math.sin(a) * (WR - 1.3), 6, p.g, 0.8));
    // drum
    parts.push({ z0: 1.2, z1: 6, side: gmS, top: gmT, shape: (c) => S.circ(c, 0, 0, R + 1.5) });
    parts.push(band(0, 0, R + 1.5, 1.2, 2.6, HAZ_A));
    // dome
    const DH = R * 0.9;
    parts.push({ z0: 6, z1: 6 + DH, side: owS, top: owT, shape: (c, zt) => S.circ(c, 0, 0, R * Math.cos(zt * 1.3) + 0.5),
      detail: (c) => { S.dot(c, gmS, 0, 0, 4.2); ring(c, SEAM, 0, 0, 4.2, 0.5); } });
    // ribs on the camera-facing side
    parts.push({ z0: 6, z1: 6 + DH * 0.97, side: gmS, top: gmT, bevel: false, shape: (c, zt) => { const r = R * Math.cos(zt * 1.3) + 0.7; for (let i = -1; i <= 7; i++) { const a = i * (Math.PI / 6); S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.85); } } });
    // armour ring + window slits
    parts.push(band(0, 0, R * Math.cos(0.18 * 1.3) + 0.4, 9, 10.4, gmS, gmT));
    parts.push({ z0: 11.5, z1: 14, side: C.shade(p.g, -0.15), top: C.shade(p.g, 0.35), flat: true, bevel: false, shape: (c) => { const r = R * Math.cos(0.3 * 1.3) + 0.3; for (let i = 0; i < 6; i++) { const a = i * (Math.PI / 6) + 0.1; arcSeg(c, 0, 0, r, 1, a, a + 0.32); } } });
    // airlock (front)
    parts.push({ z0: 1.2, z1: 11, side: gmS, top: owT, shape: (c) => S.rrect(c, -6.5, R - 4, 13, 12, 1.6),
      detail: (c) => { hazard(c, rectPts(-6.5, R + 6, 13, 2), 1.2); S.lines(c, SEAM, 0.45, [-6.5, R + 1, 6.5, R + 1]); S.dot(c, '#2a2d31', 0, R + 2.5, 1.2); } });
    parts.push({ z0: 1.2, z1: 8, side: '#22262c', top: '#22262c', flat: true, bevel: false, shape: frontStrip(-3.6, 3.6, R + 8.4) });
    parts.push({ z0: 1.2, z1: 7.5, side: C.shade(p.g, -0.1), top: p.g, flat: true, bevel: false, shape: frontStrip(-0.3, 0.3, R + 8.8) });
    parts.push(lamp(4.8, R + 6.6, 11, '#7dff9a', 0.7));
    // vent stacks + antenna mast with beacon (blinks)
    parts.push({ z0: 6, z1: 6 + DH * 0.6, side: gmS, top: '#2a2d31', shape: (c) => { S.circ(c, -R * 0.62, -R * 0.42, 1.8); S.circ(c, R * 0.6, -R * 0.48, 1.5); } });
    parts.push({ z0: 6 + DH, z1: 6 + DH + 7, side: p.d, top: gmT, shape: (c) => S.circ(c, 0, 0, 0.6) });
    parts.push({ z0: 6 + DH + 7, z1: 6 + DH + 8.4, side: '#ff7a5a', top: '#ffd0c0', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 1.4),
      detail: (c, an) => { if (an < 0.5) glow(c, '#ff5a3a', 0, 0, 4.5, 1); S.dot(c, an < 0.5 ? '#ffffff' : '#c04a3a', 0, 0, 0.7); } });
    return { r: WR + 4, h: 6 + DH + 10, parts, style: 'unit' };
  };

  /* ======================================================================
   * SEALED BUNKER / ARCHIVE VAULT — heavy blast door in an armoured berm.
   * Concrete portal frame, hazard-striped door, floodlights, chevron apron.
   * opt.locked === false shows a green lock lamp and a lit door seam.
   * ====================================================================== */
  M.scBunker = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const open = o.locked === false;
    const conS = mix(p.d, p.a, 0.35), conT = mix(p.a, p.b, 0.3);
    const earthS = mix(p.d, '#3a2e24', 0.5), earthT = mix(p.a, '#6a5a44', 0.45);
    // apron with chevrons
    parts.push({ z0: 0, z1: 0.8, side: mix(p.d, '#000', 0.1), top: mix(p.d, p.a, 0.45), shape: (c) => S.poly(c, [-18, 8, 18, 8, 22, 30, -22, 30]),
      detail: (c) => {
        for (let i = 0; i < 3; i++) { const y = 26 - i * 6; S.fillPoly(c, cs(HAZ_A, 0, 0.9), [-7, y, 0, y - 3.4, 7, y, 7, y + 1.8, 0, y - 1.6, -7, y + 1.8]); }
        S.lines(c, cs(p.b, 0, 0.5), 0.8, [-14, 12, -17, 29, 14, 12, 17, 29]);
      } });
    // berm: vertical front face, sloping back and sides
    parts.push({ z0: 0, z1: 15, side: earthS, top: earthT, ao: 0.5, shape: (c, zt) => S.poly(c, [-30 + zt * 9, 12, 30 - zt * 9, 12, 26 - zt * 9, -22 + zt * 13, -26 + zt * 9, -22 + zt * 13]),
      detail: (c) => {
        for (const q of [[-14, -4, 2.2], [12, -2, 1.6], [-4, -6, 1.2], [16, 6, 1.4], [-17, 6, 1.2]]) { S.dot(c, 'rgba(0,0,0,0.25)', q[0] + 0.4, q[1] + 0.4, q[2]); S.dot(c, cs(earthT, 0.15), q[0], q[1], q[2]); }
        // roof vents
        for (const x of [-10, 10]) { S.fillPoly(c, '#24272b', rectPts(x - 2.5, -4, 5, 3)); S.lines(c, 'rgba(160,170,180,0.6)', 0.35, [x - 2, -3.2, x + 2, -3.2, x - 2, -2, x + 2, -2]); }
      } });
    // portal frame (concrete, proud of the berm face)
    parts.push({ z0: 0, z1: 17, side: conS, top: conT, shape: (c) => S.poly(c, [-15, 8, 15, 8, 15, 16, -15, 16]),
      detail: (c) => { hazard(c, rectPts(-15, 13, 30, 3), 1.6); S.lines(c, SEAM, 0.45, [-15, 10.5, 15, 10.5]); rivets(c, [-13.5, 9.3, -6, 9.3, 6, 9.3, 13.5, 9.3]); } });
    // door recess + door leaves + diagonal hazard stripes painted on the door
    parts.push({ z0: 0, z1: 13, side: '#16181b', top: '#16181b', flat: true, bevel: false, shape: frontStrip(-11, 11, 16.4) });
    parts.push({ z0: 0, z1: 12, side: mix(p.a, p.d, 0.2), top: mix(p.a, p.b, 0.2), bevel: false, shape: (c) => { frontStrip(-10, -0.3, 16.8)(c); frontStrip(0.3, 10, 16.8)(c); } });
    parts.push({ z0: 0, z1: 4, side: HAZ_A, top: HAZ_A, flat: true, bevel: false, shape: (c, zt) => { for (let x = -10; x < 10; x += 3.2) { const a = Math.max(-10, x + zt * 3), b = Math.min(10, a + 1.5); if (b > a) frontStrip(a, b, 17.2)(c); } } });
    parts.push({ z0: 0, z1: 12, side: open ? '#9fffcf' : '#0e0f11', top: open ? '#9fffcf' : '#0e0f11', flat: true, bevel: false, shape: frontStrip(-0.3, 0.3, 17.2) });
    parts.push({ z0: 6, z1: 8, side: '#2a2d31', top: '#5a5e64', bevel: false, shape: (c) => { frontStrip(-7, -3, 17.4)(c); frontStrip(3, 7, 17.4)(c); } });
    // lock lamp above the door
    parts.push({ z0: 14, z1: 15.6, side: open ? '#5aff7a' : '#ff3a2a', top: open ? '#b0ffc0' : '#ff9a8a', flat: true, bevel: false, shape: frontStrip(-1.2, 1.2, 16.6) });
    // floodlights on the frame corners, aimed down at the apron
    for (const sx of [-1, 1]) {
      parts.push({ z0: 17, z1: 18.5, side: p.d, top: mix(p.a, p.d, 0.2), shape: (c) => S.rrect(c, sx * 12 - 1.8, 11, 3.6, 3, 0.6) });
      parts.push({ z0: 18.5, z1: 21.5, side: '#2a2d31', top: mix(p.a, p.b, 0.3), shape: (c) => S.rrect(c, sx * 12 - 2.2, 11.5, 4.4, 3.4, 0.8) });
      parts.push({ z0: 18.6, z1: 21.2, side: '#fff6d0', top: '#fff6d0', flat: true, bevel: false, shape: frontStrip(sx * 12 - 1.7, sx * 12 + 1.7, 15.3) });
    }
    parts.push({ z0: 0.8, z1: 0.8, side: '#fff', top: '#fff', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 24, 0.1), detail: (c) => { glow(c, '#fff4c8', -12, 24, 7, 0.35); glow(c, '#fff4c8', 12, 24, 7, 0.35); } });
    // antenna on the berm
    parts.push({ z0: 15, z1: 26, side: p.d, top: conT, shape: (c) => S.circ(c, 17, -10, 0.5) });
    parts.push(lamp(17, -10, 26, '#ff4a3a', 0.7));
    return { r: 34, h: 28, parts, style: 'unit' };
  };
})(window.AS);
