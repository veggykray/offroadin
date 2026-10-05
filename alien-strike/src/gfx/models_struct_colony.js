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
    parts.push({ z0: 0, z1: 0.3, side: '#120e0c', top: '#241b16', flat: true, bevel: false, shape: (c) => { S.ell(c, 12, 20, 13, 7.5, 0.15); S.ell(c, 23, 15, 5, 3.5, -0.4); },
      detail: (c) => {
        const g = c.createLinearGradient(0, 10, 30, 28); g.addColorStop(0, 'rgba(150,100,230,0.8)'); g.addColorStop(0.5, 'rgba(70,200,190,0.7)'); g.addColorStop(1, 'rgba(240,180,70,0.75)');
        c.save(); c.strokeStyle = g; c.lineWidth = 1.6; c.beginPath(); S.ell(c, 12, 20, 10.8, 5.8, 0.15); c.stroke(); c.restore();
        c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); S.ell(c, 7, 17, 4.5, 1, -0.2); S.ell(c, 23, 14.5, 2, 0.6, -0.4); c.fill();
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
  /* ======================================================================
   * GUN EMPLACEMENT — sandbag ring around an armoured gun-ring pedestal.
   * The rotating gun sheet (gun/gun2 'twin') sits on top: gunZ 6.5.
   * ====================================================================== */
  M.scTurretBunker = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const bagS = o.bagS || '#6a6046', bagT = o.bagT || '#b3a477';
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.d, 0.1);
    parts.push({ z0: 0, z1: 1, side: mix(p.d, '#000', 0.1), top: mix(p.d, p.a, 0.35), shape: (c) => S.circ(c, 0, 0, 13),
      detail: (c) => { S.lines(c, SEAM2, 0.5, [-11, 4, 11, 4, -11, -4, 11, -4]); } });
    // sandbag ring in two staggered courses, open at the back (-y)
    const course = (c, R, off, n) => { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + 0.55 + (i + off) * ((TAU - 1.1) / n); S.ell(c, Math.cos(a) * R, Math.sin(a) * R, 2.6, 1.7, a + Math.PI / 2); } };
    parts.push({ z0: 0, z1: 2.2, side: bagS, top: bagT, ao: 0.5, shape: (c) => course(c, 14.2, 0.5, 15) });
    parts.push({ z0: 2.2, z1: 4.4, side: bagS, top: bagT, ao: 0.3, shape: (c) => course(c, 13.6, 0, 15),
      detail: (c) => { for (let i = 0; i < 15; i++) { const a = -Math.PI / 2 + 0.55 + i * ((TAU - 1.1) / 15); S.lines(c, 'rgba(60,50,30,0.55)', 0.35, [Math.cos(a) * 12.6, Math.sin(a) * 12.6, Math.cos(a) * 14.6, Math.sin(a) * 14.6]); } } });
    // ammo crates inside the pit
    parts.push({ z0: 1, z1: 3.6, side: mix(p.t, '#3a2a14', 0.5), top: C.shade(p.t, 0.05), shape: (c) => { S.rect(c, -10, -6.5, 3.4, 4.6); S.rect(c, 7, -9, 4, 3.4); } });
    // armoured gun-ring pedestal
    parts.push({ z0: 1, z1: 6.5, side: gmS, top: gmT, shape: (c) => S.poly(c, ngon(0, 0, 8.4, 8, Math.PI / 8)),
      detail: (c) => { ring(c, SEAM, 0, 0, 6.6, 0.6); rivets(c, ngon(0, 0, 7.5, 8, 0), 0.4); } });
    parts.push(band(0, 0, 8, 2.4, 4.2, HAZ_A));
    parts.push({ z0: 2.4, z1: 4.2, side: HAZ_B, top: HAZ_B, flat: true, bevel: false, shape: (c, zt) => { for (let i = 0; i < 7; i++) { const a = 0.15 + i * 0.44 + zt * 0.2; arcSeg(c, 0, 0, 8.05, 1.1, a, a + 0.16); } } });
    parts.push(lamp(-9, 7, 4.4, p.g, 0.7));
    return { r: 18, h: 8, parts, gunZ: 6.5, style: 'unit' };
  };

  /* ======================================================================
   * FUEL DEPOT — three hazard-banded fuel tanks in a bund wall, a catwalk,
   * and a lit pump island at the front.
   * ====================================================================== */
  M.scFuelDepot = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.d, 0.1), owS = mix(p.a, p.b, 0.35), owT = C.shade(p.b, 0.12);
    const sl = slabCols(p);
    parts.push({ z0: 0, z1: 1, side: sl.side, top: sl.top, shape: (c) => S.rrect(c, -27, -21, 54, 44, 2),
      detail: (c) => { c.fillStyle = 'rgba(18,14,12,0.35)'; c.beginPath(); S.ell(c, 4, 4, 8, 3, 0.4); c.fill(); } });
    parts.push({ z0: 1, z1: 3.6, side: gmS, top: mix(p.a, p.b, 0.25), shape: (c) => { c.rect(-26, -20, 52, 42); c.moveTo(-23.6, -17.6); c.lineTo(-23.6, 19.6); c.lineTo(23.6, 19.6); c.lineTo(23.6, -17.6); c.closePath(); },
      detail: (c) => { hazard(c, rectPts(-26, -20, 8, 2.4), 1.2); hazard(c, rectPts(18, -20, 8, 2.4), 1.2); hazard(c, rectPts(-26, 19.6, 8, 2.4), 1.2); hazard(c, rectPts(18, 19.6, 8, 2.4), 1.2); } });
    const tanks = [[-12, -6, 8.6, 18], [9, -8, 8.6, 18], [-2, 10, 7.4, 14]];
    for (const t of tanks) {
      parts.push({ z0: 1, z1: 1 + t[3], side: owS, top: owT, shape: (c, zt) => { const k = zt > 0.85 ? Math.sqrt(1 - Math.pow((zt - 0.85) / 0.15, 2) * 0.5) : 1; S.circ(c, t[0], t[1], t[2] * k); },
        detail: (c) => {
          // flammable placard on the lid
          S.fillPoly(c, '#d8382a', [t[0], t[1] - 3, t[0] + 3, t[1], t[0], t[1] + 3, t[0] - 3, t[1]]);
          S.fillPoly(c, '#ffe0a0', [t[0], t[1] - 1.3, t[0] + 0.9, t[1] + 0.6, t[0] - 0.9, t[1] + 0.6]);
          S.lines(c, HI, 0.6, [t[0] - t[2] * 0.6, t[1] - t[2] * 0.25, t[0] - t[2] * 0.3, t[1] - t[2] * 0.6]);
        } });
      parts.push(band(t[0], t[1], t[2], 5, 8.5, HAZ_A));
      parts.push({ z0: 5, z1: 8.5, side: HAZ_B, top: HAZ_B, flat: true, bevel: false, shape: (c, zt) => { for (let i = 0; i < 6; i++) { const a = 0.12 + i * 0.52 + zt * 0.3; if (a < Math.PI - 0.1) arcSeg(c, t[0], t[1], t[2] + 0.05, 1.1, a, a + 0.2); } } });
    }
    // catwalk between the tank lids + pipes to the pump island
    parts.push(pipeRun(1, 3, 1.4, mix(p.t, p.d, 0.35), C.shade(p.t, 0.1), [-2, 10, 18, 10, 9, -8, 18, -8, 18, -8, 18, 10]));
    // pump island
    parts.push({ z0: 1, z1: 9, side: gmS, top: gmT, shape: (c) => S.rrect(c, 15, 6, 8, 9, 1),
      detail: (c) => { S.fillPoly(c, '#16191c', rectPts(16, 7.5, 6, 3.5)); S.fillPoly(c, cs(p.g, 0, 0.9), rectPts(16.6, 8, 4.8, 2.5)); S.lines(c, 'rgba(0,0,0,0.5)', 0.35, [17, 9, 20.6, 9]); } });
    parts.push({ z0: 4, z1: 7, side: C.shade(p.g, -0.15), top: p.g, flat: true, bevel: false, shape: frontStrip(16, 22, 15.4) });
    parts.push({ z0: 3, z1: 5, side: '#1c1d20', top: '#3a3c40', stroke: 0.9, bevel: false, shape: (c) => { c.moveTo(23, 9); c.quadraticCurveTo(27, 12, 24, 17); } });
    parts.push(lamp(-24, -18, 3.6, '#ff4a3a', 0.6)); parts.push(lamp(24, 20, 3.6, p.g, 0.7));
    return { r: 30, h: 22, parts, style: 'unit' };
  };

  /* ======================================================================
   * MUNITIONS STORE — corrugated quonset magazine with a loading dock,
   * ordnance crates and a shell rack. Red ordnance markings.
   * ====================================================================== */
  M.scAmmoDepot = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const ol = '#5a6046', olT = '#8f9670';
    const hutS = mix(p.a, ol, 0.55), hutT = mix(p.b, olT, 0.5);
    const sl = slabCols(p);
    parts.push({ z0: 0, z1: 1, side: sl.side, top: sl.top, shape: (c) => S.rrect(c, -24, -18, 48, 38, 2),
      detail: (c) => { hazard(c, rectPts(-24, 17.6, 48, 2.4), 1.4); } });
    const HR = 10.5, X0 = -18, X1 = 10;
    parts.push({ z0: 1, z1: 1 + HR, side: hutS, top: hutT, shape: (c, zt) => { const w = HR * Math.sqrt(Math.max(0.02, 1 - zt * zt)); S.rect(c, X0, -4 - w, X1 - X0, w * 2); },
      detail: (c) => S.lines(c, HI, 0.6, [X0 + 1, -4, X1 - 1, -4]) });
    // corrugation ribs
    parts.push({ z0: 1, z1: 1 + HR * 0.98, side: mix(hutS, '#000', 0.25), top: hutS, bevel: false, shape: (c, zt) => { const w = HR * Math.sqrt(Math.max(0.02, 1 - zt * zt)) + 0.25; for (let x = X0 + 1.5; x < X1; x += 3.2) S.rect(c, x, -4 - w, 0.6, w * 2); } });
    // end walls (darker)
    parts.push({ z0: 1, z1: 1 + HR * 0.96, side: mix(p.d, p.a, 0.3), top: mix(p.a, p.d, 0.2), shape: (c, zt) => { const w = HR * Math.sqrt(Math.max(0.02, 1 - zt * zt)) + 0.4; S.rect(c, X0 - 1, -4 - w, 1.4, w * 2); S.rect(c, X1 - 0.4, -4 - w, 1.4, w * 2); } });
    // loading dock + door on the front side
    parts.push({ z0: 1, z1: 8, side: mix(p.d, p.a, 0.3), top: mix(p.a, p.b, 0.3), shape: (c) => S.rect(c, -9, 4, 12, 6),
      detail: (c) => { hazard(c, rectPts(-9, 8.4, 12, 1.6), 1); S.fillPoly(c, '#c8382a', [-3, 5, -1, 7, -3, 9, -5, 7]); } });
    parts.push({ z0: 1, z1: 6.6, side: '#22262c', top: '#22262c', flat: true, bevel: false, shape: frontStrip(-7, 1, 10.4) });
    parts.push({ z0: 1, z1: 6.4, side: mix(p.a, p.b, 0.2), top: mix(p.a, p.b, 0.2), bevel: false, shape: (c, zt) => { for (let i = 0; i < 4; i++) frontStrip(-6.6 + i * 2, -5.2 + i * 2, 10.6)(c); } });
    // ordnance crates (olive, red stencil) + shell rack
    parts.push({ z0: 1, z1: 5, side: '#4a4e38', top: '#7c8360', shape: (c) => { S.rect(c, 13, -14, 8, 5); S.rect(c, 13, -8, 8, 5); S.rect(c, 13, 6, 8, 5); S.rect(c, -22, 8, 8, 5); },
      detail: (c) => { for (const q of [[13, -14], [13, -8], [13, 6], [-22, 8]]) { S.lines(c, 'rgba(20,24,12,0.6)', 0.35, [q[0] + 4, q[1], q[0] + 4, q[1] + 5]); S.fillPoly(c, '#c8382a', [q[0] + 1, q[1] + 1.6, q[0] + 2.6, q[1] + 1.6, q[0] + 2.6, q[1] + 3.4, q[0] + 1, q[1] + 3.4]); } } });
    parts.push({ z0: 5, z1: 9, side: '#4a4e38', top: '#7c8360', shape: (c) => S.rect(c, 13, -11, 8, 5), detail: (c) => S.fillPoly(c, '#c8382a', [14, -9.6, 15.6, -9.6, 15.6, -7.8, 14, -7.8]) });
    parts.push({ z0: 1, z1: 3, side: p.d, top: mix(p.a, p.d, 0.3), shape: (c) => S.rect(c, 12, 13, 10, 5) });
    parts.push({ z0: 3, z1: 6.5, side: '#8a6a2a', top: '#e0b860', shape: (c, zt) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) S.circ(c, 13.5 + i * 2.4, 14.4 + j * 2.3, zt > 0.75 ? 0.6 : 0.95); } });
    parts.push(lamp(X1 - 2, -4, 1 + HR, '#ff4a3a', 0.8));
    return { r: 26, h: 14, parts, style: 'unit' };
  };

  /* ======================================================================
   * PRISONER PEN (Choir) — energy cage: six bone pylons with violet crystal
   * tips, flickering light bars and a glowing floor glyph. anims 2.
   * ====================================================================== */
  M.scPen = function (p, o) {
    p = P(Object.assign({ a: '#a59e8c', b: '#d8d0bc', t: '#5a4f7a', g: '#b07cff', d: '#34303e' }, p)); o = o || {};
    const parts = [];
    const R = o.r || 23, N = 6;
    const pts = []; for (let i = 0; i < N; i++) { const a = i / N * TAU + Math.PI / 6; pts.push([Math.cos(a) * R, Math.sin(a) * R * 0.92]); }
    const glowC = p.g, hot = C.shade(p.g, 0.45);
    parts.push({ z0: 0, z1: 1.6, side: p.d, top: C.shade(p.d, 0.12), shape: (c) => S.poly(c, ngon(0, 0, R + 4, N, Math.PI / 6)),
      detail: (c) => {
        ring(c, cs(C.shade(p.g, -0.4), 0, 0.9), 0, 0, R * 0.62, 2);
        ring(c, cs(p.g, 0, 0.9), 0, 0, R * 0.62, 0.8);
        ring(c, cs(p.g, 0, 0.55), 0, 0, R * 0.3, 0.6);
        const g = []; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU - Math.PI / 2; g.push(Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58); }
        c.save(); c.strokeStyle = cs(p.g, 0, 0.75); c.lineWidth = 0.7; c.beginPath(); S.poly(c, g); c.stroke(); c.restore();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; S.lines(c, cs(p.g, 0, 0.6), 0.6, [Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86]); }
        glow(c, p.g, 0, 0, R * 0.35, 0.35);
      } });
    const pylon = (q) => [
      { z0: 0, z1: 3, side: p.d, top: C.mix(p.a, p.d, 0.4), shape: (c) => S.poly(c, ngon(q[0], q[1], 3.6, 4, Math.PI / 4)) },
      { z0: 3, z1: 20, side: p.a, top: p.b, shape: (c, zt) => { const r = 2.6 * (1 - zt * 0.45); S.poly(c, [q[0] - r, q[1], q[0], q[1] - r * 0.8, q[0] + r, q[1], q[0], q[1] + r * 0.8]); },
        detail: (c) => S.dot(c, glowC, q[0], q[1], 0.6) },
      { z0: 20, z1: 25, side: C.shade(glowC, -0.25), top: hot, flat: true, shape: (c, zt) => { const r = 1.5 * (1 - zt) + 0.2; S.poly(c, [q[0] - r, q[1], q[0], q[1] - r, q[0] + r, q[1], q[0], q[1] + r]); } },
    ];
    const back = pts.filter((q) => q[1] < 0), front = pts.filter((q) => q[1] >= 0);
    for (const q of back) parts.push(...pylon(q));
    // light bars between neighbouring pylons, two courses, flicker between frames
    for (const z of [7, 14]) parts.push({ z0: z, z1: z + 1.2, side: C.shade(glowC, -0.1), top: hot, flat: true, stroke: 0.9, bevel: false,
      shape: (c, zt, an) => { for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; if (an >= 0.5 && i === (z === 7 ? 2 : 4)) continue; S.seg(c, a[0], a[1], b[0], b[1]); } } });
    for (const q of front) parts.push(...pylon(q));
    return { r: R + 6, h: 26, parts, style: 'unit' };
  };

  /* ======================================================================
   * ICE PRISON — faceted ice-shard cluster with a dark huddled figure seen
   * through the translucent block.
   * ====================================================================== */
  M.scIceBlock = function (p, o) {
    o = o || {};
    const iceS = o.side || '#4f8fb8', iceT = o.top || '#d4f0ff', deep = '#0f1c2e';
    const parts = [];
    const core = [11, -3, 8, 7, 0, 10.5, -9, 7, -11.5, -1, -6, -9.5, 4, -10];
    // frozen ground puddle
    parts.push({ z0: 0, z1: 1, side: '#9fc8e0', top: '#eef9ff', bevel: false, shape: (c) => S.blob(c, 0, 1, 15, 6, 10, 0.3) });
    // back + side shards (behind the block)
    const shards = [[-8, -8, 3.4, 21, -0.2], [3, -10, 3, 18, 0.1], [9, -6, 2.6, 15, 0.35], [-12, -2, 2.4, 13, -0.5], [12, 2, 2.2, 10, 0.5]];
    const shardAt = (k, z) => { const t = z / k[3], r = k[2] * (t < 0.65 ? 1 : (1 - t) / 0.35) + 0.15; return [k[0] + k[4] * z * 0.3, k[1] - z * 0.08, r]; };
    parts.push({ z0: 0, z1: 21, side: iceS, top: iceT, ao: 0.2, shape: (c, zt) => { const z = zt * 21; for (const k of shards) { if (z > k[3]) continue; const q = shardAt(k, z), r = q[2]; S.poly(c, [q[0] - r, q[1], q[0] - r * 0.3, q[1] - r * 0.9, q[0] + r, q[1] - r * 0.2, q[0] + r * 0.4, q[1] + r * 0.8]); } } });
    parts.push({ z0: 0, z1: 19, side: '#e6f8ff', top: '#ffffff', flat: true, bevel: false, shape: (c, zt) => { const z = zt * 21; for (const k of shards) { if (z > k[3] * 0.9) continue; const q = shardAt(k, z), r = q[2]; S.poly(c, [q[0] - r, q[1], q[0] - r * 0.3, q[1] - r * 0.9, q[0] - r * 0.1, q[1] - r * 0.5, q[0] - r * 0.6, q[1] + 0.1]); } } });
    // main block
    parts.push({ z0: 0, z1: 10, side: iceS, top: iceT, ao: 0.25, shape: (c, zt) => { const k = 1 - zt * 0.14; S.poly(c, core.map((v) => v * k)); } });
    // the prisoner: dark huddled silhouette seen through the ice (front wall + top)
    parts.push({ z0: 4, z1: 4, side: deep, top: deep, flat: true, bevel: false,
      shape: (c) => { c.globalAlpha = 0.5; S.circ(c, -1.6, 0.5, 2.4); S.ell(c, 0.8, 3.6, 4.6, 3.4, 0.3); } });
    parts.push({ z0: 10, z1: 10, side: deep, top: deep, flat: true, bevel: false,
      shape: (c) => { c.globalAlpha = 0.72; S.circ(c, -1.6, -1.6, 2.5); S.ell(c, 0.8, 1.6, 4.8, 3.6, 0.3); S.ell(c, 4.2, -0.6, 1.5, 2.4, 0.6); },
      detail: (c) => { c.globalAlpha = 1; S.dot(c, 'rgba(255,190,120,0.9)', -2.2, -2, 0.5); S.dot(c, 'rgba(255,190,120,0.9)', -0.9, -2.2, 0.5); } });
    // frost facets over the top
    parts.push({ z0: 10, z1: 10, side: iceT, top: iceT, flat: true, bevel: false, shape: (c) => { c.globalAlpha = 0.4; S.poly(c, [-9, -2, -5, -8, 0, -5, -3, 0]); S.poly(c, [5, 4, 9, 1, 8, 6]); } });
    parts.push({ z0: 10, z1: 10, side: '#ffffff', top: '#ffffff', flat: true, bevel: false, shape: (c) => { S.poly(c, [-8.6, -1.6, -5, -7.6, -4.4, -7, -7.8, -1.2]); } });
    // a low front shard (keeps the figure visible)
    parts.push({ z0: 0, z1: 7, side: iceS, top: iceT, shape: (c, zt) => { const r = 2.4 * (1 - zt * 0.8); S.poly(c, [-6 - r, 9, -6, 9 - r, -6 + r, 9.4, -6, 9 + r * 0.7]); } });
    return { r: 17, h: 22, parts, style: 'unit' };
  };

  /* ======================================================================
   * COOLANT PUMP (W6) — frosted blue-glass coolant tank in a gunmetal frame on
   * a pump skid. Liquid glow pulses (anims 2).
   * ====================================================================== */
  M.scCoolant = function (p, o) {
    p = P(Object.assign({ a: '#4a5a6a', b: '#8aa0b8', t: '#7fe8ff', g: '#7fe8ff', d: '#1a2028' }, p)); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.4), gmT = mix(p.a, p.b, 0.3);
    const frost = '#e8f6ff', frostS = '#a8c8dc';
    const tx = -2, ty = -3, TR = 9;
    parts.push({ z0: 0, z1: 3, side: gmS, top: gmT, shape: (c) => S.rrect(c, -17, -15, 34, 30, 2),
      detail: (c) => { hazard(c, rectPts(-17, 12.6, 34, 2.4), 1.4); S.lines(c, SEAM, 0.45, [-17, 6, 17, 6]); rivets(c, [-15.5, -13.5, 15.5, -13.5, -15.5, 11, 15.5, 11]); } });
    // frost crust around the base
    parts.push({ z0: 3, z1: 4.2, side: frostS, top: frost, bevel: false, shape: (c) => { S.blob(c, tx, ty, TR + 3, 7, 12, 0.3); S.blob(c, 10, 9, 4, 3, 7, 0.4); } });
    // glass tank (liquid shows through)
    parts.push({ z0: 4, z1: 26, side: '#1f6f9c', top: '#3fb4e0', shape: (c) => S.circ(c, tx, ty, TR),
      detail: (c, an) => { glow(c, an < 0.5 ? '#bff6ff' : p.g, tx, ty, TR * 0.8, 0.9); ring(c, 'rgba(10,40,60,0.6)', tx, ty, TR - 0.6, 0.8); } });
    // inner liquid glow stripe + glass highlight on the camera side
    parts.push({ z0: 5, z1: 25, side: '#7fe8ff', top: '#bff6ff', flat: true, bevel: false, shape: (c, zt, an) => arcSeg(c, tx, ty, TR - 0.1, 1.2, 1.1, 1.6 + (an < 0.5 ? 0.15 : 0)) });
    parts.push({ z0: 7, z1: 24, side: '#ffffff', top: '#ffffff', flat: true, bevel: false, shape: (c) => arcSeg(c, tx, ty, TR, 0.9, 2.2, 2.42) });
    // frost creeping up the glass (front)
    parts.push({ z0: 4, z1: 9, side: frost, top: frost, flat: true, bevel: false, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = 0.15 + i * 0.62; const h = 0.25 + U.hash2(i, 3, 9) * 0.75; if (zt < h) arcSeg(c, tx, ty, TR + 0.05, 1, a, a + 0.42 * (1 - zt / h * 0.6)); } } });
    // frame posts + hoops + lid
    parts.push({ z0: 3, z1: 27, side: gmS, top: gmT, shape: (c) => { for (const a of [0.785, 2.356, 3.93, 5.5]) S.rect(c, tx + Math.cos(a) * (TR + 0.6) - 1, ty + Math.sin(a) * (TR + 0.6) - 1, 2, 2); } });
    parts.push(band(tx, ty, TR, 15, 16.4, gmS, gmT));
    parts.push({ z0: 26, z1: 28.5, side: gmS, top: gmT, shape: (c) => S.circ(c, tx, ty, TR + 1),
      detail: (c) => { S.dot(c, '#2a3038', tx, ty, 3); ring(c, frost, tx, ty, TR - 0.6, 0.9); S.dot(c, frost, tx - 4, ty - 4, 1.2); S.dot(c, frost, tx + 5, ty - 2, 0.9); } });
    parts.push({ z0: 28.5, z1: 31, side: gmS, top: frost, shape: (c) => S.circ(c, tx, ty, 1.6) });
    // pump + motor housing (front right)
    parts.push({ z0: 3, z1: 10, side: gmS, top: mix(p.b, '#ffffff', 0.15), shape: (c) => S.rrect(c, 7, 4, 9, 8, 1.4),
      detail: (c) => { for (let i = 0; i < 4; i++) S.lines(c, SEAM, 0.45, [8.5 + i * 2, 5, 8.5 + i * 2, 11]); } });
    parts.push(pipeRun(5, 7.5, 2.2, frostS, frost, [tx + TR - 1, ty + 2, 8, 6, 16, 8, 21, 8]));
    parts.push(lamp(-14, 10, 3, p.g, 0.7));
    return { r: 22, h: 33, parts, style: 'unit' };
  };

  /* ======================================================================
   * LANDING PAD — bevelled octagon with an H, painted ring, chevrons, tyre
   * scuffs, world-tinted grime (pal) and a chasing landing-light ring (anims 4).
   * ====================================================================== */
  M.scPad = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 40;
    const parts = [];
    const deck = o.deck || mix(p.d, p.a, 0.25), rim = mix(p.d, '#000', 0.1);
    const mark = o.mark || '#ece6d6', trim = p.t, light = o.light || p.g;
    const grime = o.grime || mix(p.a, '#5a4630', 0.5);
    parts.push({ z0: 0, z1: 2, side: rim, top: mix(p.a, p.d, 0.4), shape: (c, zt) => S.poly(c, ngon(0, 0, R + 2.5 - zt * 2, 8, Math.PI / 8)) });
    parts.push({ z0: 2, z1: 3, side: rim, top: deck, bevelW: 1.5, shape: (c) => S.poly(c, ngon(0, 0, R - 0.5, 8, Math.PI / 8)),
      detail: (c) => {
        // grime blotches toward the rim
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, d = R * (0.55 + U.hash2(i, 1, 5) * 0.3), x = Math.cos(a) * d, y = Math.sin(a) * d; const g = c.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, C.str(grime, 0.35)); g.addColorStop(1, C.str(grime, 0)); c.fillStyle = g; c.beginPath(); S.circ(c, x, y, 9); c.fill(); }
        // panel seams
        S.lines(c, SEAM2, 0.5, [-R, 0, R, 0, 0, -R, 0, R, -R * 0.7, -R * 0.7, R * 0.7, R * 0.7, -R * 0.7, R * 0.7, R * 0.7, -R * 0.7]);
        // tyre scuffs
        c.save(); c.strokeStyle = 'rgba(10,10,12,0.25)'; c.lineWidth = 2; c.beginPath(); c.arc(-4, 6, 18, -0.6, 0.5); c.moveTo(10, -14); c.arc(4, -10, 14, 2.4, 3.3); c.stroke(); c.restore();
        // painted ring + H
        ring(c, cs(trim, 0, 0.95), 0, 0, R * 0.74, 1.6);
        c.save(); c.fillStyle = mark; c.beginPath();
        const h = R * 0.36, w = R * 0.08;
        c.rect(-h * 0.75 - w, -h, w * 2, h * 2); c.rect(h * 0.75 - w, -h, w * 2, h * 2); c.rect(-h * 0.75, -w * 0.9, h * 1.5, w * 1.8); c.fill(); c.restore();
        // corner chevrons
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4, d = R * 0.86; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(a + Math.PI); S.fillPoly(c, trim, [0, -3, 2.2, 0, 0, 3, -1.2, 3, 1, 0, -1.2, -3]); c.restore(); }
      } });
    // landing lights in the bevel: chase around the ring
    const NL = 16;
    for (let f = 0; f < 4; f++) parts.push({ z0: 3, z1: 3.4, side: C.shade(light, -0.3), top: light, flat: true, bevel: false, when: (an) => Math.floor(an * 4 + 1e-6) % 4 === f,
      shape: (c) => { for (let i = 0; i < NL; i++) { const a = i / NL * TAU, d = R - 3; S.circ(c, Math.cos(a) * d, Math.sin(a) * d, 0.9); } },
      detail: (c) => { for (let i = 0; i < NL; i++) { const a = i / NL * TAU, d = R - 3; if (i % 4 === f) { glow(c, light, Math.cos(a) * d, Math.sin(a) * d, 3.2, 1); S.dot(c, '#ffffff', Math.cos(a) * d, Math.sin(a) * d, 0.6); } else S.dot(c, C.str(C.shade(light, -0.45)), Math.cos(a) * d, Math.sin(a) * d, 0.7); } } });
    return { r: R + 4, h: 5, parts, style: 'prop' };
  };

  /* ======================================================================
   * PLATFORM — steel deck on a braced sub-frame: diamond plate, hazard edges,
   * central hatch, corner bollard lamps.
   * ====================================================================== */
  M.scPlatform = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 28;
    const parts = [];
    const gmS = mix(p.d, p.a, 0.25), gmT = mix(p.a, p.d, 0.2);
    const oct = (r) => { const k = r * 0.3; return [-r + k, -r, r - k, -r, r, -r + k, r, r - k, r - k, r, -r + k, r, -r, r - k, -r, -r + k]; };
    parts.push({ z0: 0, z1: 4, side: p.d, top: gmS, shape: (c, zt) => S.poly(c, oct(R * (0.86 + zt * 0.06))) });
    parts.push({ z0: 4, z1: 6, side: gmS, top: mix(p.d, p.a, 0.5), bevelW: 1.4, shape: (c) => S.poly(c, oct(R)),
      detail: (c) => {
        c.save(); c.beginPath(); S.poly(c, oct(R - 3)); c.clip();
        c.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = -R; x < R; x += 2.4) for (let y = -R; y < R; y += 2.4) { c.fillRect(x + ((y / 2.4) % 2 ? 1.2 : 0), y, 0.8, 0.4); }
        c.restore();
        c.save(); c.strokeStyle = HAZ_A; c.lineWidth = 2; c.setLineDash([2, 2]); c.beginPath(); S.poly(c, oct(R - 1.6)); c.stroke(); c.restore();
        S.lines(c, SEAM, 0.5, [-R + 3, 0, -6, 0, 6, 0, R - 3, 0, 0, -R + 3, 0, -6, 0, 6, 0, R - 3]);
        S.fillPoly(c, mix(p.d, '#000', 0.1) && C.str(mix(p.d, '#000', 0.1)), oct(5.5));
        c.save(); c.strokeStyle = cs(p.b, 0, 0.6); c.lineWidth = 0.6; c.beginPath(); S.poly(c, oct(5.5)); c.stroke(); c.restore();
        S.lines(c, cs(p.b, 0, 0.5), 0.8, [-2.5, 0, 2.5, 0]);
        for (const x of [-R * 0.55, R * 0.55]) for (const y of [-R * 0.55, -R * 0.2, R * 0.2, R * 0.55]) { ring(c, 'rgba(20,22,26,0.6)', x, y, 1, 0.5); ring(c, HI, x - 0.2, y - 0.2, 1, 0.3, 3.4, 5.2); }
      } });
    for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = q[0] * (R - 5), y = q[1] * (R - 5);
      parts.push({ z0: 6, z1: 8.5, side: p.d, top: HAZ_A, shape: (c) => S.circ(c, x, y, 1.6) });
      parts.push(lamp(x, y, 8.5, p.g, 0.8));
    }
    return { r: R + 4, h: 11, parts, style: 'prop' };
  };
  /* ======================================================================
   * CONSOLES — shared interact language: a dark octagonal ground plate with a
   * lit green ring and four inward chevrons, then the device on top with a lit
   * screen or lamp. opt.ring overrides the ring colour.
   * ====================================================================== */
  const INTERACT = '#7dff9a';
  function consoleBase(parts, p, R, col) {
    col = col || INTERACT;
    parts.push({ z0: 0, z1: 1.2, side: mix(p.d, '#000', 0.2), top: mix(p.d, p.a, 0.2), shape: (c) => S.poly(c, ngon(0, 0, R, 8, Math.PI / 8)),
      detail: (c) => {
        ring(c, cs(col, -0.45, 0.9), 0, 0, R - 2.2, 1.6);
        ring(c, cs(col, 0.2), 0, 0, R - 2.2, 0.6);
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; c.save(); c.translate(Math.cos(a) * (R - 2.2), Math.sin(a) * (R - 2.2)); c.rotate(a + Math.PI); S.fillPoly(c, cs(col, 0.1), [-1, -1.8, 0.9, 0, -1, 1.8, -1.8, 1.8, 0, 0, -1.8, -1.8]); c.restore(); }
      } });
  }

  /* DATA RELAY — console desk with a lit screen + antenna mast (beacon blinks, anims 2) */
  M.scRelay = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.d, 0.1), scr = o.screen || p.g;
    consoleBase(parts, p, 13, o.ring);
    parts.push({ z0: 1.2, z1: 3, side: p.d, top: gmT, shape: (c) => S.rrect(c, -6, -4.5, 12, 9, 1) });
    parts.push({ z0: 3, z1: 9, side: gmS, top: mix(p.a, p.b, 0.35), shape: (c, zt) => S.rrect(c, -5, -4 + zt * 0.5, 10, 8 - zt * 2.5, 1),
      detail: (c, an) => {
        S.fillPoly(c, '#0d1418', rectPts(-4.2, -3.2, 8.4, 4.6));
        c.fillStyle = cs(scr, -0.1, 0.95); c.fillRect(-3.7, -2.8, 7.4, 3.8);
        S.lines(c, cs('#0d1418', 0, 0.55), 0.35, [-3.2, -1.9, 1.5, -1.9, -3.2, -0.9, 2.6, -0.9, -3.2, 0.1, 0.4, 0.1]);
        S.dot(c, an < 0.5 ? '#ffffff' : cs(scr, 0.3), 2.6, 0.1, 0.45);
        S.lines(c, HI, 0.5, [-4, -3.3, 4, -3.3]);
        for (let i = 0; i < 3; i++) S.dot(c, ['#ff5a4a', HAZ_A, INTERACT][i], -3 + i * 1.6, 2.4, 0.45);
      } });
    parts.push({ z0: 3, z1: 7, side: C.shade(scr, -0.2), top: scr, flat: true, bevel: false, shape: frontStrip(-4, 4, 3.9) });
    // antenna mast + dish + blinking beacon
    parts.push({ z0: 3, z1: 24, side: p.d, top: gmT, shape: (c, zt) => { const r = 1.6 - zt * 0.9; S.circ(c, 6 - r, -5, 0.45); S.circ(c, 6 + r, -5 - r, 0.45); S.circ(c, 6 + r, -5 + r, 0.45); } });
    parts.push({ z0: 15, z1: 17, side: mix(p.a, p.b, 0.3), top: C.shade(p.b, 0.1), shape: (c, zt) => S.ell(c, 4.2, -5, 1.8 + zt, 2.6 + zt, 0.3), detail: (c) => S.dot(c, '#2a2d31', 4.2, -5, 0.6) });
    parts.push({ z0: 24, z1: 25.4, side: '#ff7a5a', top: '#ffd0c0', flat: true, bevel: false, shape: (c) => S.circ(c, 6, -5, 1.1),
      detail: (c, an) => { if (an < 0.5) glow(c, '#ff5a3a', 6, -5, 3.6, 1); S.dot(c, an < 0.5 ? '#ffffff' : '#a03a2a', 6, -5, 0.55); } });
    // cable
    parts.push({ z0: 1.2, z1: 2, side: '#1c1d20', top: '#3a3c40', stroke: 0.8, bevel: false, shape: (c) => { c.moveTo(-5, 3); c.quadraticCurveTo(-9, 6, -10, 2); } });
    return { r: 15, h: 27, parts, style: 'unit' };
  };

  /* SEISMIC THUMPER — tall tripod piston rig; the hammer is up (frame 0) or slammed down (frame 1) */
  M.scThumper = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.3), gmT = mix(p.a, p.d, 0.1);
    const H = 30;
    consoleBase(parts, p, 13, o.ring);
    parts.push({ z0: 1.2, z1: 2.4, side: '#24262a', top: '#4c5056', shape: (c) => S.circ(c, 0, 0, 5),
      detail: (c, an) => { S.lines(c, 'rgba(10,10,12,0.6)', 0.4, [0, 0, 4.6, 1.5, 0, 0, -3.5, 3, 0, 0, -1, -4.6]); if (an >= 0.5) { ring(c, cs(HAZ_A, 0, 0.8), 0, 0, 4.4, 0.8); } } });
    // tripod legs (back legs first)
    const legs = [[-Math.PI / 2 - 0.5], [-Math.PI / 2 + Math.PI * 2 / 3 * 2 - 0.5], [-Math.PI / 2 + Math.PI * 2 / 3 - 0.5]];
    const legPart = (a) => ({ z0: 1.2, z1: H, side: gmS, top: C.shade(p.t, 0.05), shape: (c, zt) => { const r = 10 * (1 - zt) + 1.2; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.95); } });
    parts.push(legPart(-Math.PI / 2 + 0.3), legPart(-Math.PI / 2 - 1.8));
    // guide column
    parts.push({ z0: 2.4, z1: H, side: '#5a5e64', top: '#b0b6bc', shape: (c) => { S.circ(c, -1.2, 0, 0.45); S.circ(c, 1.2, 0, 0.45); } });
    // hammer mass (up / down)
    const ham = (z) => [
      { z0: z, z1: z + 6, side: C.shade(HAZ_A, -0.35), top: HAZ_A, shape: (c) => S.circ(c, 0, 0, 3.6),
        detail: (c) => { S.dot(c, '#2a2a2a', 0, 0, 1.4); rivets(c, ngon(0, 0, 2.7, 6, 0.3), 0.35); } },
      { z0: z + 1.5, z1: z + 3.5, side: HAZ_B, top: HAZ_B, flat: true, bevel: false, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = 0.1 + i * 0.62 + zt * 0.35; arcSeg(c, 0, 0, 3.65, 1, a, a + 0.28); } } },
    ];
    ham(18).forEach((q) => { q.when = (an) => an < 0.5; parts.push(q); });
    ham(2.4).forEach((q) => { q.when = (an) => an >= 0.5; parts.push(q); });
    parts.push(legPart(-Math.PI / 2 + 2.4));
    // motor head + lamp
    parts.push({ z0: H, z1: H + 3, side: gmS, top: mix(p.a, p.b, 0.35), shape: (c) => S.rrect(c, -3, -2.6, 6, 5.2, 1.2), detail: (c) => S.lines(c, SEAM, 0.4, [-3, 0, 3, 0]) });
    parts.push(lamp(0, 0, H + 3, p.g, 0.9));
    return { r: 15, h: H + 6, parts, style: 'unit' };
  };

  /* THERMAL VALVE — pipe manifold on a stub, big red hand-wheel, pressure gauge, status lamp */
  M.scValve = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.4), gmT = mix(p.a, p.b, 0.25);
    const pipeS = mix(p.a, p.d, 0.3), pipeT = mix(p.b, p.a, 0.2);
    consoleBase(parts, p, 13, o.ring);
    // incoming pipe stub (from the west / back) with flange
    parts.push({ z0: 1.2, z1: 3, side: p.d, top: gmT, shape: (c) => { S.rect(c, -12, -1.6, 1.6, 3.2); S.rect(c, -7.5, -1.6, 1.6, 3.2); } });
    parts.push(pipeRun(3, 6.2, 3.2, pipeS, pipeT, [-15, 0, -3, 0]));
    parts.push(pipeRun(2.6, 6.6, 0.9, p.d, gmT, [-6.2, -2, -6.2, 2]));
    // manifold body + outlet stubs
    parts.push({ z0: 1.2, z1: 7.5, side: gmS, top: gmT, shape: (c) => S.rrect(c, -3.5, -3.5, 7, 7, 1.4), detail: (c) => rivets(c, [-2.6, -2.6, 2.6, -2.6, -2.6, 2.6, 2.6, 2.6], 0.4) });
    parts.push(pipeRun(2.4, 4.8, 2.4, pipeS, pipeT, [3, 0, 8, 0, 0, 3, 0, 7]));
    // stem + hand-wheel
    parts.push({ z0: 7.5, z1: 10.4, side: '#4a4c50', top: '#9a9ea4', shape: (c) => S.circ(c, 0, 0, 0.8) });
    parts.push({ z0: 10.4, z1: 11.6, side: '#8a2418', top: '#e0503a', shape: (c) => annulus(c, 0, 0, 5, 3.9),
      detail: (c) => { S.lines(c, '#c0402e', 0.8, [-4, 0, 4, 0, 0, -4, 0, 4]); S.dot(c, '#5a1a12', 0, 0, 1); S.lines(c, HI, 0.5, [-3.4, -2.6, -1.2, -4.2]); } });
    parts.push({ z0: 10.4, z1: 11.4, side: '#8a2418', top: '#d8483a', bevel: false, shape: (c) => { c.rect(-4, -0.45, 8, 0.9); c.rect(-0.45, -4, 0.9, 8); } });
    // pressure gauge on a post (front right)
    parts.push({ z0: 1.2, z1: 6, side: p.d, top: gmT, shape: (c) => S.circ(c, 6.5, 5.5, 0.5) });
    parts.push({ z0: 6, z1: 7.4, side: '#2a2d31', top: '#f2eee4', shape: (c) => S.circ(c, 6.5, 5.5, 2.1),
      detail: (c) => { ring(c, '#2a2d31', 6.5, 5.5, 2.1, 0.5); ring(c, '#d8382a', 6.5, 5.5, 1.5, 0.5, -0.4, 0.5); S.lines(c, '#1a1a1a', 0.35, [6.5, 5.5, 7.6, 4.6]); } });
    // status lamp (closed = red)
    parts.push({ z0: 1.2, z1: 5, side: p.d, top: gmT, shape: (c) => S.circ(c, -5, 6, 0.5) });
    parts.push(lamp(-5, 6, 5, o.lamp || '#ff4a3a', 1.1));
    return { r: 16, h: 13, parts, style: 'unit' };
  };

  /* POWER JUNCTION — breaker cabinet with a bolt glyph, lever, insulators and ground cables */
  M.scSwitch = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const gmS = mix(p.d, p.a, 0.4), gmT = mix(p.a, p.b, 0.35);
    consoleBase(parts, p, 13, o.ring);
    parts.push(pipeRun(1.2, 2.2, 1.3, '#1a1b1e', '#3a3c40', [-3, 0, -13, 2, 3, -1, 12, -6, 0, 2, 4, 13]));
    // insulator stacks
    for (const q of [[-6, -5], [6, -5]]) {
      parts.push({ z0: 1.2, z1: 8, side: '#8a7a64', top: '#e8dcc4', shape: (c, zt) => S.circ(c, q[0], q[1], (Math.floor(zt * 6) % 2 ? 1.1 : 1.6)) });
      parts.push({ z0: 8, z1: 9, side: C.shade(p.t, -0.3), top: p.t, shape: (c) => S.circ(c, q[0], q[1], 0.9) });
    }
    parts.push({ z0: 8.6, z1: 9.2, side: '#2a2a2a', top: '#5a5a5a', stroke: 0.5, bevel: false, shape: (c) => { c.moveTo(-6, -5); c.quadraticCurveTo(0, -3, 6, -5); } });
    // cabinet
    parts.push({ z0: 1.2, z1: 9, side: gmS, top: gmT, shape: (c) => S.rrect(c, -4.5, -2.5, 9, 6.5, 1),
      detail: (c) => {
        S.fillPoly(c, '#1a1c1f', rectPts(-3.6, -1.7, 7.2, 4.6));
        S.fillPoly(c, cs(p.g, 0.1), [0.6, -1.4, -1.6, 0.8, -0.2, 0.8, -0.8, 2.6, 1.6, 0, 0.2, 0]);
        S.lines(c, HI, 0.45, [-4, -2.2, 4, -2.2]);
      } });
    parts.push({ z0: 2, z1: 7.5, side: HAZ_B, top: HAZ_B, bevel: false, shape: frontStrip(-4.5, 4.5, 4.4) });
    parts.push({ z0: 2, z1: 7.5, side: HAZ_A, top: HAZ_A, flat: true, bevel: false, shape: (c, zt) => { for (let x = -4.5; x < 4.5; x += 2.4) { const a = Math.max(-4.5, x + zt * 2), b = Math.min(4.5, a + 1.1); if (b > a) frontStrip(a, b, 4.8)(c); } } });
    // breaker lever
    parts.push({ z0: 9, z1: 13, side: '#4a4c50', top: '#9a9ea4', shape: (c, zt) => S.circ(c, 3 - zt * 1.5, 0.5, 0.45) });
    parts.push({ z0: 13, z1: 14.4, side: '#8a2418', top: '#e0503a', shape: (c) => S.circ(c, 1.5, 0.5, 1) });
    parts.push(lamp(-2.5, 0.5, 9, p.g, 1));
    return { r: 16, h: 16, parts, style: 'unit' };
  };

  /* DEMOLITION POINT — hazard-striped floor hatch inside a pulsing red bracket ring (anims 2) */
  M.scChargeSite = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const red = o.ring || p.g || '#ff4a3a';
    const R = 11;
    parts.push({ z0: 0, z1: 1, side: mix(p.d, '#000', 0.2), top: mix(p.d, '#2a2a2e', 0.4), shape: (c) => S.poly(c, ngon(0, 0, R, 8, Math.PI / 8)),
      detail: (c, an) => {
        // bracket ring (pulses)
        const k = an < 0.5 ? 1 : 0.55;
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; ring(c, cs(red, -0.4, 0.9 * k), 0, 0, R - 1.8, 1.6, a - 0.45, a + 0.45); ring(c, cs(red, 0.3, k), 0, 0, R - 1.8, 0.6, a - 0.45, a + 0.45); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; c.save(); c.translate(Math.cos(a) * (R - 1.8), Math.sin(a) * (R - 1.8)); c.rotate(a + Math.PI); S.fillPoly(c, cs(red, 0.1, k), [-1, -1.6, 0.9, 0, -1, 1.6, -1.8, 1.6, 0, 0, -1.8, -1.6]); c.restore(); }
      } });
    // hatch frame (hazard) + hatch lid
    parts.push({ z0: 1, z1: 2.2, side: HAZ_B, top: HAZ_A, shape: (c) => S.rrect(c, -6.5, -6.5, 13, 13, 1),
      detail: (c) => hazard(c, rectPts(-6.5, -6.5, 13, 13), 1.3) });
    parts.push({ z0: 2.2, z1: 3, side: mix(p.d, p.a, 0.3), top: mix(p.a, '#7a7e84', 0.5), shape: (c) => S.rrect(c, -4.4, -4.4, 8.8, 8.8, 0.8),
      detail: (c, an) => {
        rivets(c, [-3.6, -3.6, 3.6, -3.6, -3.6, 3.6, 3.6, 3.6], 0.45);
        S.lines(c, SEAM, 0.45, [-4.4, 0, 4.4, 0]);
        S.fillPoly(c, '#24262a', rectPts(-2, 1, 4, 1.4));
        // charge socket
        S.dot(c, '#1a1010', 0, -2, 1.4); S.dot(c, an < 0.5 ? cs(red, 0.4) : cs(red, -0.2), 0, -2, 0.8); if (an < 0.5) glow(c, red, 0, -2, 2.6, 0.9);
      } });
    return { r: 13, h: 4, parts, style: 'prop' };
  };

  /* ======================================================================
   * TUNNEL VENT — steaming fumarole: cracked mineral crust mound, glowing throat,
   * radiating fissures and translucent steam puffs (anims 2).
   * ====================================================================== */
  M.scVent = function (p, o) {
    p = P(Object.assign({ a: '#6a3a2a', b: '#9a5a3a', t: '#d8a070', g: '#ff8a4a', d: '#2a140c' }, p)); o = o || {};
    const parts = [];
    const crust = mix(p.t, '#f0e6c8', 0.55), sulf = '#e8d060';
    parts.push({ z0: 0, z1: 1, side: p.d, top: mix(p.a, p.d, 0.4), bevel: false, shape: (c) => S.blob(c, 0, 0, 22, 21, 14, 0.3),
      detail: (c) => {
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3, r1 = 9, r2 = 19 + U.hash2(i, 2, 4) * 3; const mx = Math.cos(a + 0.15) * (r1 + r2) / 2, my = Math.sin(a + 0.15) * (r1 + r2) / 2;
          c.save(); c.strokeStyle = cs(p.g, 0, 0.75); c.lineWidth = 0.7; c.beginPath(); c.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); c.quadraticCurveTo(mx, my, Math.cos(a - 0.1) * r2, Math.sin(a - 0.1) * r2); c.stroke(); c.restore(); }
      } });
    parts.push({ z0: 1, z1: 3.6, side: p.a, top: mix(p.b, crust, 0.45), ao: 0.5, shape: (c, zt) => { S.blob(c, 0, 0, 15 - zt * 3.5, 12, 11, 0.32); c.moveTo(8.2, 0); c.arc(0, 0, 8.2, 0, TAU, true); },
      detail: (c) => {
        for (const q of [[-8, -5, 2.2], [9, 3, 1.8], [-3, 10, 1.6], [6, -9, 1.4]]) S.dot(c, cs(sulf, 0, 0.75), q[0], q[1], q[2]);
        S.lines(c, 'rgba(60,30,20,0.5)', 0.4, [-11, 2, -7, 1, 10, -4, 7, -3]);
      } });
    parts.push({ z0: 1, z1: 3.4, side: mix(p.d, crust, 0.3), top: crust, bevel: false, shape: (c, zt) => { c.moveTo(9.4 - zt, 0); c.arc(0, 0, 9.4 - zt, 0, TAU); c.moveTo(7.4, 0); c.arc(0, 0, 7.4, 0, TAU, true); } });
    parts.push({ z0: 1, z1: 1.2, side: '#120806', top: '#1a0c08', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 7.8),
      detail: (c, an) => { glow(c, p.g, 0, 1, an < 0.5 ? 7.5 : 6, 1); glow(c, '#fff0c0', 0, 1, an < 0.5 ? 2.6 : 2, 0.8); } });
    // steam puffs (translucent — no outline)
    parts.push({ z0: 9, z1: 9, side: '#ffffff', top: '#ffffff', flat: true, bevel: false, shape: (c, zt, an) => { c.globalAlpha = 0.3; const d = an < 0.5 ? 0 : 1.5; S.circ(c, -1 + d, -1, 5); S.circ(c, 3 + d, 1, 3.6); } });
    parts.push({ z0: 17, z1: 17, side: '#ffffff', top: '#ffffff', flat: true, bevel: false, shape: (c, zt, an) => { c.globalAlpha = 0.22; const d = an < 0.5 ? 1.5 : 3; S.circ(c, 1 + d, -2, 6); S.circ(c, -3 + d, 0, 4); } });
    return { r: 24, h: 24, parts, style: 'prop' };
  };

  /* ======================================================================
   * INDUSTRIAL CRUSHER — heavy piston press: four columns, crown beam with twin
   * hydraulic rams, a striped press plate that slams down (anims 4), glowing
   * ore bed, back hopper and a debris chute.
   * ====================================================================== */
  M.scCrusher = function (p, o) {
    p = P(p); o = o || {};
    const parts = [];
    const ironS = mix(p.d, p.a, 0.4), ironT = mix(p.a, p.b, 0.45), dark = mix(p.d, '#000', 0.2);
    const hot = p.g || '#ff8a2a';
    // bed
    parts.push({ z0: 0, z1: 7, side: ironS, top: mix(p.a, p.d, 0.2), ao: 0.5, shape: (c) => S.rrect(c, -24, -17, 48, 34, 2),
      detail: (c) => { hazard(c, rectPts(-24, 14, 48, 3), 1.8); hazard(c, rectPts(-24, -17, 48, 3), 1.8); rivets(c, [-22, -12, 22, -12, -22, 11, 22, 11], 0.5); } });
    // ore bed (glowing crush zone)
    parts.push({ z0: 7, z1: 7.6, side: dark, top: '#2a1a12', bevel: false, shape: (c) => S.rrect(c, -15, -10, 30, 20, 1.5),
      detail: (c) => { for (const q of [[-8, -3, 2.2], [4, 4, 2.6], [9, -5, 1.8], [-3, 6, 1.6], [0, -6, 1.4]]) { S.dot(c, '#3a2a22', q[0], q[1], q[2]); S.dot(c, cs(hot, 0, 0.8), q[0] + 0.3, q[1] + 0.3, q[2] * 0.45); } glow(c, hot, 0, 0, 10, 0.35); } });
    // back hopper (funnel)
    parts.push({ z0: 7, z1: 22, side: ironS, top: ironT, shape: (c, zt) => { const w = 9 + zt * 5; c.rect(-w, -17 - zt * 4, w * 2, 6 + zt * 2); },
      detail: (c) => { S.fillPoly(c, '#1a1210', [-12, -20, 12, -20, 9, -16, -9, -16]); S.lines(c, SEAM, 0.5, [-14, -18.5, 14, -18.5]); } });
    const cols = [[-19, -12], [19, -12], [-19, 12], [19, 12]];
    const colPart = (q) => ({ z0: 7, z1: 44, side: ironS, top: ironT, shape: (c) => S.rect(c, q[0] - 2.6, q[1] - 2.6, 5.2, 5.2) });
    const colBand = (q) => band(q[0], q[1] + 0.5, 3, 28, 31, HAZ_A);
    parts.push(colPart(cols[0]), colPart(cols[1]));
    // press plate + rods (4 positions)
    const ZP = [30, 20, 8, 19];
    for (let f = 0; f < 4; f++) {
      const z = ZP[f], on = (an) => Math.floor(an * 4 + 1e-6) % 4 === f;
      parts.push({ z0: z + 6, z1: 44, side: '#6a6e74', top: '#c8ccd2', when: on, shape: (c) => { S.circ(c, -8, 0, 1.5); S.circ(c, 8, 0, 1.5); } });
      parts.push({ z0: z, z1: z + 6, side: ironS, top: ironT, when: on, shape: (c) => S.rrect(c, -16, -10, 32, 20, 1.5),
        detail: (c) => { S.lines(c, SEAM, 0.5, [-16, 0, 16, 0, -8, -10, -8, 10, 8, -10, 8, 10]); rivets(c, [-14.5, -8.5, 14.5, -8.5, -14.5, 8.5, 14.5, 8.5], 0.5); } });
      parts.push({ z0: z + 0.5, z1: z + 5, side: HAZ_A, top: HAZ_A, flat: true, bevel: false, when: on, shape: (c, zt) => { for (let x = -16; x < 16; x += 4) { const a = Math.max(-16, x + zt * 3), b = Math.min(16, a + 2); if (b > a) frontStrip(a, b, 10.3)(c); } } });
      if (f === 2) parts.push({ z0: 7.6, z1: 8, side: hot, top: '#fff0c0', flat: true, bevel: false, when: on, shape: (c) => { S.rect(c, -17, 9.6, 34, 1.2); S.rect(c, -17, -10.8, 34, 1); },
        detail: (c) => { for (const x of [-12, -2, 7, 14]) { S.lines(c, '#fff4c0', 0.4, [x, 10.2, x + 1.5, 13, x, 10.2, x - 1.2, 12.6]); } } });
    }
    parts.push(colPart(cols[2]), colPart(cols[3]));
    parts.push(colBand(cols[2]), colBand(cols[3]));
    // crown beam + ram cylinders
    parts.push({ z0: 44, z1: 50, side: ironS, top: ironT, shape: (c) => S.rrect(c, -23, -15, 46, 30, 2),
      detail: (c) => {
        hazard(c, rectPts(-23, 11.5, 46, 3.5), 1.8);
        for (const x of [-8, 8]) { S.dot(c, dark, x, 0, 4.4); S.dot(c, mix(p.a, p.b, 0.6) && cs(mix(p.a, p.b, 0.6)), x, 0, 3.4); S.dot(c, '#2a2a2a', x, 0, 1.2); }
        S.lines(c, SEAM, 0.5, [-23, -6, 23, -6]);
      } });
    parts.push({ z0: 50, z1: 54, side: ironS, top: ironT, shape: (c) => { S.circ(c, -8, 0, 3.6); S.circ(c, 8, 0, 3.6); }, detail: (c) => { S.dot(c, '#2a2a2a', -8, 0, 1.2); S.dot(c, '#2a2a2a', 8, 0, 1.2); } });
    parts.push(lamp(-21, -13, 50, '#ff4a3a', 0.9));
    parts.push(lamp(21, -13, 50, HAZ_A, 0.9));
    // debris chute out the front-right + rubble pile
    parts.push({ z0: 0, z1: 6, side: ironS, top: mix(p.a, p.b, 0.25), shape: (c, zt) => S.poly(c, [16, 15, 24, 15, 30 - zt * 2, 27, 20 - zt * 2, 27]) });
    parts.push({ z0: 0, z1: 3, side: '#3a2e28', top: '#6a5a4c', bevel: false, shape: (c) => { S.blob(c, 25, 28, 5, 3, 8, 0.4); S.blob(c, 30, 25, 3, 7, 7, 0.4); } });
    return { r: 34, h: 56, parts, style: 'unit' };
  };
})(window.AS);
