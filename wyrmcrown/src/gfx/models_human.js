/* WYRMCROWN — Human faction architecture (Kingdom of Aldermere).
 * Warm grey ashlar, timber-framed upper storeys (pal.w beams on pal.s plaster),
 * terracotta roofs (pal.t), round towers with conical roofs, crenellations,
 * crimson-and-gold banners (pal.k / pal.k2) and warm lit windows (pal.g, flat).
 *
 * Technique. Buildings are 1-direction sheets rendered at heading 0, so object
 * space is screen space: a world point (x, y, z) lands on the sprite at (x, y - z)
 * (+y faces the camera). Volumes (walls, towers, chimneys) are ordinary stacked
 * forge parts; roofs, cones, wall dressing (ashlar, timber framing, windows,
 * doors), banners and glows are painted by zero-height "overlay" parts in that
 * projected space, which gives roofs true lit/shaded planes, tile courses and
 * ridge caps. Parts are authored back (-y) to front (+y). Rotating models (wall,
 * gate: 16 dirs; ballista, catapult: 24 dirs) use pure stacked geometry, camera-
 * facing wall slivers and a per-heading depth sorter.
 *
 * Generators (AS.Models.*, signature (pal, opt), opt optional; missing palette keys
 * fall back to the Aldermere defaults):
 *   human_keep       opt.level 1-3 (motte keep in a palisade / stone castle / citadel)
 *   human_house      opt.v 0-3, opt.slate (blue-grey slate roof instead of pal.t)
 *   human_barracks   human_farm   human_stable   human_tower (archer tower)
 *   human_magetower  (anims 4: orb pulse)      human_watchtower (anims: beacon flicker)
 *   human_temple     human_market   human_workshop   human_roost
 *   human_wardstone  (anims 4: rune pulse)
 *   human_wall       16 dirs, 40 long on x, opt.level 1 palisade / 2 stone / 3 reinforced
 *   human_gate       16 dirs, 40 wide on x, opt.level 1-3, opt.open (doors / portcullis up)
 *   human_ballista   24 dirs, +x = aim
 *   human_catapult   24 dirs, +x = throw, anims 3 (cocked -> swinging -> released)
 * Any building with flags or fire animates when its sheet has anims 2-4 (anim 0 is a
 * complete still frame, so anims 1 is always valid). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});
  const PI = Math.PI;

  /* ================================================================ palette */
  const DEF = { a: '#8a7f74', b: '#d2c7b4', t: '#b0482c', g: '#ffcf6a', d: '#3e3028', k: '#b8262a', k2: '#e8b84a', w: '#5a3a24', s: '#e6dac0' };
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const rgba = (c, a) => C.str(c, a);
  function mats(pal) {
    const p = Object.assign({}, DEF);
    if (pal) for (const key in DEF) if (pal[key]) p[key] = pal[key];
    if (pal && pal.b && !pal.s) p.s = mx(pal.b, '#f2ead8', 0.4);
    return {
      p,
      stS: mx(p.a, p.b, 0.3), stT: mx(p.a, p.b, 0.72), stL: mx(p.b, '#fff8ea', 0.25), stD: mx(p.a, p.d, 0.42),
      pl: p.s, wd: p.w, pk: mx(p.w, '#b48c5e', 0.45), pkD: mx(p.w, '#6a4a2e', 0.5), wdL: sh(p.w, 0.25), wdD: sh(p.w, -0.42),
      rf: p.t, rfD: sh(p.t, -0.42), rfL: sh(p.t, 0.28),
      gl: p.g, k: p.k, k2: p.k2, d: p.d,
      iron: '#363436', ironL: '#7a7670', straw: '#d9b862', strawD: '#a6843c', dirt: '#8e7752', dirtD: '#6c5a3e',
      cob: mx(p.a, '#77705f', 0.45), water: '#4c86aa', leaf: '#4f7a34',
    };
  }

  /* ============================================================ vec helpers */
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const LG = nrm([-0.6, -0.3, 0.75]); // light direction (toward the sun: top-left, above)
  const pj = (x, y, z) => [x, y - z];

  /* ======================================================= stacked parts */
  const box = (x0, y0, x1, y1, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => c.rect(x0, y0, x1 - x0, y1 - y0) }, ex || {});
  // box whose back edge follows clip(z) (min y at height z)
  const cbox = (x0, y0, x1, y1, z0, z1, side, top, clip, ex) => Object.assign({ z0, z1, side, top, shape: (c, zt) => { const yb = clip ? Math.max(y0, clip(z0 + zt * (z1 - z0))) : y0; if (yb < y1 - 0.05) c.rect(x0, yb, x1 - x0, y1 - yb); } }, ex || {});
  // min-y clip for a wing standing in front of a main gx/hip roof whose front wall is at fy
  const behind = (roof, fy) => (z) => (z < roof.zE ? fy : Math.max(fy, roof.valley.y + (roof.valley.z - z) / roof.valley.k));
  const cyl = (cx, cy, r, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => S.circ(c, cx, cy, r) }, ex || {});
  // gable prism, ridge along y: its front face is the gable triangle (roof planes are painted over its slopes)
  const prism = (cx, cy, W, D, z0, h, col) => ({ z0, z1: z0 + h, side: col, top: col, ao: 0, bevel: false,
    shape: (c, zt) => { const hw = (W / 2) * (1 - zt); if (hw > 0.04) c.rect(cx - hw, cy - D / 2, hw * 2, D); } });
  // zero-height painting layer (object space = screen space for 1-direction sheets)
  const overlay = (fn) => ({ z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: () => {},
    detail: (c, an) => { c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; fn(c, an || 0); c.restore(); } });
  function ann(c, x, y, r1, r2) { c.moveTo(x + r2, y); c.arc(x, y, r2, 0, TAU); c.moveTo(x + r1, y); c.arc(x, y, r1, TAU, 0, true); }
  function sector(c, x, y, r1, r2, a0, a1) { c.moveTo(x + Math.cos(a0) * r2, y + Math.sin(a0) * r2); c.arc(x, y, r2, a0, a1); c.arc(x, y, r1, a1, a0, true); c.closePath(); }
  const ngon = (n, r, rot, cx, cy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r); } return a; };
  const rot = (pts, a, ox, oy) => { const ca = Math.cos(a), sa = Math.sin(a), out = []; for (let i = 0; i < pts.length; i += 2) out.push((ox || 0) + pts[i] * ca - pts[i + 1] * sa, (oy || 0) + pts[i] * sa + pts[i + 1] * ca); return out; };

  /* heading of the frame being rendered, camera-facing test, depth sorter (rotating models) */
  const headingOf = (c) => { const t = c.getTransform(); return Math.atan2(t.b, t.a); };
  const facing = (c, nx, ny, k) => { const a = headingOf(c); return nx * Math.sin(a) + ny * Math.cos(a) > (k || 0); };
  function withSorter(parts) {
    const all = [null].concat(parts);
    all[0] = { z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: (c) => {
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
      const rest = all.slice(1).map((p, i) => ({ p, i, l: p.layer || 0, d: p.at ? p.at[0] * sa + p.at[1] * ca : 0 }));
      rest.sort((A, B) => (A.l - B.l) || (A.d - B.d) || (A.i - B.i));
      for (let i = 0; i < rest.length; i++) all[i + 1] = rest[i].p;
    } };
    return all;
  }
  /* timber beams in 3D: segs = [[x0,y0,z0,x1,y1,z1], ...], plan width w, vertical thickness th */
  function beams(segs, w, th, side, top, ex) {
    let zA = Infinity, zB = -Infinity;
    for (const s of segs) { zA = Math.min(zA, s[2], s[5]); zB = Math.max(zB, s[2], s[5]); }
    zA -= th / 2; zB += th / 2;
    return Object.assign({ z0: Math.max(0, zA), z1: zB, side, top, stroke: w, bevel: false, ao: 0.15, shape: (c, zt) => {
      const z = zA + zt * (zB - zA);
      for (const s of segs) {
        let t0, t1;
        const dz = s[5] - s[2];
        if (Math.abs(dz) < 1e-4) { if (Math.abs(z - s[2]) > th / 2) continue; t0 = 0; t1 = 1; }
        else { t0 = (z - th / 2 - s[2]) / dz; t1 = (z + th / 2 - s[2]) / dz; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; } t0 = Math.max(0, t0); t1 = Math.min(1, t1); if (t0 > t1) continue; }
        const xa = s[0] + (s[3] - s[0]) * t0, ya = s[1] + (s[4] - s[1]) * t0, xb = s[0] + (s[3] - s[0]) * t1, yb = s[1] + (s[4] - s[1]) * t1;
        c.moveTo(xa, ya); c.lineTo(xb + (Math.abs(xb - xa) + Math.abs(yb - ya) < 0.01 ? 0.01 : 0), yb);
      }
    } }, ex || {});
  }

  /* ===================================================== painted faces (1-dir) */
  // planar face: origin p0, unit axes e1 (along) and e2 (across / up-slope), polygon in local (u, w)
  const face = (p0, e1, e2, poly, o) => Object.assign({ p0, e1: nrm(e1), e2: nrm(e2), poly }, o || {});
  const fpt = (f, u, w) => pj(f.p0[0] + f.e1[0] * u + f.e2[0] * w, f.p0[1] + f.e1[1] * u + f.e2[1] * w, f.p0[2] + f.e1[2] * u + f.e2[2] * w);
  function wallGrad(c, col, R) {
    const g = c.createLinearGradient(-R, 0, R, 0);
    g.addColorStop(0, C.str(C.shade(col, 0.12))); g.addColorStop(0.5, C.str(col)); g.addColorStop(1, C.str(C.shade(col, -0.3)));
    return g;
  }
  function tileRows(c, f, sp) {
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (let i = 0; i < f.poly.length; i += 2) { u0 = Math.min(u0, f.poly[i]); u1 = Math.max(u1, f.poly[i]); w0 = Math.min(w0, f.poly[i + 1]); w1 = Math.max(w1, f.poly[i + 1]); }
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(255,226,196,0.16)'; c.lineWidth = 0.32; c.beginPath();
    for (let w = w0 + sp; w < w1 - 0.5; w += sp) { c.moveTo(u0 - 1, w + 0.36); c.lineTo(u1 + 1, w + 0.36); }
    c.stroke();
    c.strokeStyle = 'rgba(48,14,6,0.36)'; c.lineWidth = 0.34; c.beginPath();
    for (let w = w0 + sp; w < w1 - 0.5; w += sp) { c.moveTo(u0 - 1, w); c.lineTo(u1 + 1, w); }
    c.stroke();
    if (f.joints !== false) {
      c.strokeStyle = 'rgba(48,14,6,0.17)'; c.lineWidth = 0.26; c.beginPath();
      let j = 0;
      for (let w = w0; w < w1 - 0.3; w += sp, j++) for (let u = u0 + (j % 2) * 1.05 + 0.5; u < u1; u += 2.1) { c.moveTo(u, w + 0.2); c.lineTo(u, Math.min(w1, w + sp - 0.1)); }
      c.stroke();
    }
  }
  function paintFaces(c, faces, R) {
    for (const f of faces) {
      let n = cross(f.e1, f.e2);
      if (f.wall ? n[1] < 0 : n[2] < 0) n = [-n[0], -n[1], -n[2]];
      if (n[1] + n[2] <= 0.02) continue;
      const pts = [];
      let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
      for (let i = 0; i < f.poly.length; i += 2) {
        const q = fpt(f, f.poly[i], f.poly[i + 1]); pts.push(q[0], q[1]);
        u0 = Math.min(u0, f.poly[i]); u1 = Math.max(u1, f.poly[i]); w0 = Math.min(w0, f.poly[i + 1]); w1 = Math.max(w1, f.poly[i + 1]);
      }
      c.beginPath(); S.poly(c, pts);
      if (f.wall) c.fillStyle = wallGrad(c, f.col, R);
      else {
        const k = n[0] * LG[0] + n[1] * LG[1] + n[2] * LG[2];
        const base = C.shade(f.col, U.clamp((k - 0.6) * (f.contrast || 0.72), -0.36, 0.22));
        const A = fpt(f, (u0 + u1) / 2, w0), B = fpt(f, (u0 + u1) / 2, w1);
        const g = c.createLinearGradient(A[0], A[1], B[0], B[1]);
        g.addColorStop(0, C.str(C.shade(base, -0.13))); g.addColorStop(0.6, C.str(base)); g.addColorStop(1, C.str(C.shade(base, 0.08)));
        c.fillStyle = g;
      }
      c.fill();
      if (f.rows || f.paint) {
        c.save(); c.beginPath(); S.poly(c, pts); c.clip();
        c.transform(f.e1[0], f.e1[1] - f.e1[2], f.e2[0], f.e2[1] - f.e2[2], f.p0[0], f.p0[1] - f.p0[2]);
        if (f.rows) tileRows(c, f, f.rows);
        if (f.paint) f.paint(c, f, u0, u1, w0, w1);
        c.restore();
      }
      c.beginPath(); S.poly(c, pts); c.strokeStyle = 'rgba(30,14,8,0.42)'; c.lineWidth = 0.28; c.stroke();
    }
  }
  function seg2(c, a, b, col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  function paintLines(c, lines, m) {
    c.save(); c.lineCap = 'round';
    for (const L of lines) {
      const a = pj(L.a[0], L.a[1], L.a[2]), b = pj(L.b[0], L.b[1], L.b[2]);
      if (L.t === 'ridge' || L.t === 'hip') { seg2(c, a, b, L.col || m.rfD, 1.15); seg2(c, [a[0] - 0.2, a[1] - 0.22], [b[0] - 0.2, b[1] - 0.22], L.hi || m.rfL, 0.42); }
      else if (L.t === 'verge') { seg2(c, a, b, m.wdD, 1.0); seg2(c, [a[0] - 0.15, a[1] - 0.2], [b[0] - 0.15, b[1] - 0.2], m.wdL, 0.32); }
      else if (L.t === 'valley') seg2(c, a, b, 'rgba(46,14,6,0.55)', 0.5);
      else if (L.t === 'eave') seg2(c, a, b, 'rgba(34,12,6,0.55)', 0.5);
    }
    c.restore();
  }

  /* roof with the ridge along y (gable faces the camera). o.valley = {y, z, k} cuts the back
   * of this wing against the front slope of a main roof (ridge at y, height z, slope k). */
  function roofGY(cx, cy, W, D, ze, hr, o) {
    o = o || {};
    const ov = o.ov !== undefined ? o.ov : 1.3, ovf = o.ovf !== undefined ? o.ovf : 1.1, ovb = o.ovb !== undefined ? o.ovb : 0.8;
    const hw = W / 2, k = hr / hw, zE = ze - ov * k, zr = ze + hr;
    const xl = cx - hw - ov, xr = cx + hw + ov, y0 = cy - D / 2 - ovb, y1 = cy + D / 2 + ovf, Ly = y1 - y0;
    const run = hw + ov, Sl = Math.hypot(run, zr - zE);
    let cut0 = 0, cutS = 0;
    if (o.valley) {
      const vl = o.valley, sinp = (zr - zE) / Sl;
      const A = (vl.z - zE) / vl.k + vl.y - y0, B = sinp / vl.k;
      cut0 = U.clamp(A, 0, Ly - 0.5); cutS = U.clamp(A - B * Sl, 0, Ly - 0.5);
    }
    const col = o.roofCol, rows = o.rows !== undefined ? o.rows : 1.9;
    const poly = [cut0, 0, Ly, 0, Ly, Sl, cutS, Sl];
    const faces = [face([xl, y0, zE], [0, 1, 0], [run, 0, zr - zE], poly, { col, rows }), face([xr, y0, zE], [0, 1, 0], [-run, 0, zr - zE], poly, { col, rows })];
    const lines = [{ a: [cx, y0 + cutS, zr], b: [cx, y1, zr], t: 'ridge' }, { a: [xl, y1, zE], b: [cx, y1, zr], t: 'verge' }, { a: [xr, y1, zE], b: [cx, y1, zr], t: 'verge' }];
    if (o.valley) lines.push({ a: [xl, y0 + cut0, zE], b: [cx, y0 + cutS, zr], t: 'valley' }, { a: [xr, y0 + cut0, zE], b: [cx, y0 + cutS, zr], t: 'valley' });
    const zAt = (x) => zE + Math.max(0, run - Math.abs(x - cx)) * k;
    return { faces, lines, zAt, zr, zE, apex: [cx, y1, zr], front: y1 };
  }
  /* roof with the ridge along x; o.hip makes hipped ends (o.hipK < 1 = steeper hips) */
  function roofGX(cx, cy, L, D, ze, hr, o) {
    o = o || {};
    const ov = o.ov !== undefined ? o.ov : 1.3, ovx = o.hip ? ov : (o.ovx !== undefined ? o.ovx : 0.9);
    const hd = D / 2, k = hr / hd, zE = ze - ov * k, zr = ze + hr;
    const run = hd + ov, x0 = cx - L / 2 - ovx, x1 = cx + L / 2 + ovx, yf = cy + run, yb = cy - run, Lx = x1 - x0;
    const Sl = Math.hypot(run, zr - zE);
    const a = o.hip ? Math.min(Lx / 2, run * (o.hipK || 1)) : 0;
    const col = o.roofCol, rows = o.rows !== undefined ? o.rows : 1.9;
    const tp = [0, 0, Lx, 0, Lx - a, Sl, a, Sl];
    const faces = [face([x0, yb, zE], [1, 0, 0], [0, run, zr - zE], tp, { col, rows })];
    if (a > 0) {
      const Sh = Math.hypot(a, zr - zE), hp = [0, 0, 2 * run, 0, run, Sh];
      faces.push(face([x0, yb, zE], [0, 1, 0], [a, 0, zr - zE], hp, { col, rows }), face([x1, yb, zE], [0, 1, 0], [-a, 0, zr - zE], hp, { col, rows }));
    }
    faces.push(face([x0, yf, zE], [1, 0, 0], [0, -run, zr - zE], tp, { col, rows }));
    const lines = [];
    if (Lx - 2 * a > 0.05) lines.push({ a: [x0 + a, cy, zr], b: [x1 - a, cy, zr], t: 'ridge' });
    if (a > 0) lines.push({ a: [x0, yf, zE], b: [x0 + a, cy, zr], t: 'hip' }, { a: [x1, yf, zE], b: [x1 - a, cy, zr], t: 'hip' }, { a: [x0, yb, zE], b: [x0 + a, cy, zr], t: 'hip' }, { a: [x1, yb, zE], b: [x1 - a, cy, zr], t: 'hip' });
    else lines.push({ a: [x0, yf, zE], b: [x0, cy, zr], t: 'verge' }, { a: [x1, yf, zE], b: [x1, cy, zr], t: 'verge' });
    lines.push({ a: [x0, yf, zE], b: [x1, yf, zE], t: 'eave' });
    const zAt = (x, y) => {
      let z = zE + Math.max(0, run - Math.abs(y - cy)) * k;
      if (a > 0) z = Math.min(z, zE + Math.max(0, Math.min(x - x0, x1 - x)) * (zr - zE) / a);
      return z;
    };
    return { faces, lines, zAt, zr, zE, valley: { y: cy, z: zr, k }, front: yf };
  }
  /* single-pitch lean-to roof against a wall at the back (high edge at y = yb) */
  function roofShed(x0, x1, yb, yf, zHi, zLo, col, rows) {
    return { faces: [face([x0, yf, zLo], [1, 0, 0], [0, yb - yf, zHi - zLo], [0, 0, x1 - x0, 0, x1 - x0, Math.hypot(yf - yb, zHi - zLo), 0, Math.hypot(yf - yb, zHi - zLo)], { col, rows: rows || 1.8 })],
      lines: [{ a: [x0, yf, zLo], b: [x1, yf, zLo], t: 'eave' }], zAt: (x, y) => zLo + (zHi - zLo) * U.clamp((yf - y) / (yf - yb), 0, 1), zr: zHi };
  }

  /* =================================================== face dressing (local u, v) */
  // run fn in the local frame of a vertical face at y = yF (u = x, v = z, v up)
  function onFace(c, yF, fn) { c.save(); c.transform(1, 0, 0, -1, 0, yF); fn(c); c.restore(); }
  // frame of a vertical face along an arbitrary direction (tower windows): origin (ox, oy), tangent (tx, ty)
  function onFaceAt(c, ox, oy, tx, ty, fn) { c.save(); c.transform(tx, ty, 0, -1, ox, oy); fn(c); c.restore(); }
  function ashlar(c, x0, x1, z0, z1, seed, o) {
    o = o || {};
    const ch = o.ch || 1.9, bw = o.bw || 3.3;
    c.save(); c.beginPath(); c.rect(x0, z0, x1 - x0, z1 - z0); c.clip();
    let row = 0;
    for (let z = z0; z < z1; z += ch, row++) {
      const off = (row % 2) * bw * 0.5;
      for (let x = x0 - off; x < x1; x += bw) {
        const h = U.hash2(Math.round(x * 3) + 99, row, seed || 1);
        if (h > 0.6) { c.fillStyle = h > 0.84 ? 'rgba(255,246,226,0.12)' : 'rgba(46,34,24,0.10)'; c.fillRect(x + 0.12, z + 0.12, bw - 0.24, ch - 0.24); }
      }
    }
    c.strokeStyle = o.mortar || 'rgba(44,32,24,0.26)'; c.lineWidth = 0.22; c.lineCap = 'butt'; c.beginPath();
    row = 0;
    for (let z = z0; z < z1; z += ch, row++) {
      if (row) { c.moveTo(x0, z); c.lineTo(x1, z); }
      const off = (row % 2) * bw * 0.5;
      for (let x = x0 - off + bw; x < x1; x += bw) { c.moveTo(x, z); c.lineTo(x, Math.min(z1, z + ch)); }
    }
    c.stroke(); c.restore();
  }
  function quoins(c, x0, x1, z0, z1, col) {
    c.fillStyle = col || 'rgba(255,248,230,0.2)';
    let i = 0;
    for (let z = z0 + 0.15; z < z1 - 0.4; z += 1.9, i++) {
      const L = i % 2 ? 1.6 : 2.6;
      c.fillRect(x0, z, L, 1.6); c.fillRect(x1 - L, z, L, 1.6);
    }
  }
  function shadeBand(c, x0, x1, ztop, h, a) {
    const g = c.createLinearGradient(0, ztop, 0, ztop - h);
    g.addColorStop(0, 'rgba(24,12,6,' + a + ')'); g.addColorStop(1, 'rgba(24,12,6,0)');
    c.fillStyle = g; c.fillRect(x0, ztop - h, x1 - x0, h);
  }
  function timber(c, m, x0, x1, z0, z1, o) {
    o = o || {};
    const W = x1 - x0, n = Math.max(2, Math.round(W / (o.sp || 3.6))), bw = o.bw || 0.72;
    const zm = z0 + (z1 - z0) * 0.5;
    c.save(); c.lineCap = 'butt';
    const pass = (col, w, dx, dz) => {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      c.moveTo(x0, z0 + bw * 0.5 + dz); c.lineTo(x1, z0 + bw * 0.5 + dz);
      c.moveTo(x0, z1 - bw * 0.5 + dz); c.lineTo(x1, z1 - bw * 0.5 + dz);
      if (o.mid !== false) { c.moveTo(x0, zm + dz); c.lineTo(x1, zm + dz); }
      for (let i = 0; i <= n; i++) { const x = U.clamp(x0 + (W * i) / n, x0 + bw * 0.5, x1 - bw * 0.5) + dx; c.moveTo(x, z0); c.lineTo(x, z1); }
      for (let i = 0; i < n; i++) {
        const xa = x0 + (W * i) / n + dx, xb = x0 + (W * (i + 1)) / n + dx;
        const pat = o.pat || 'k';
        if (pat === 'x' && i % 2 === 0) { c.moveTo(xa, z0); c.lineTo(xb, z1); c.moveTo(xb, z0); c.lineTo(xa, z1); }
        else if (pat === 'k' && (i === 0 || i === n - 1 || (n > 4 && i === Math.floor(n / 2)))) {
          if (i < n / 2) { c.moveTo(xa, z0 + dz); c.lineTo(xb, zm + dz); c.moveTo(xa, z1 + dz); c.lineTo(xb, zm + dz); }
          else { c.moveTo(xb, z0 + dz); c.lineTo(xa, zm + dz); c.moveTo(xb, z1 + dz); c.lineTo(xa, zm + dz); }
        } else if (pat === 'v' && i % 2 === 0) { c.moveTo(xa, z1 + dz); c.lineTo((xa + xb) / 2, z0 + dz); c.lineTo(xb, z1 + dz); }
      }
      c.stroke();
    };
    pass(m.wdD, bw + 0.22, 0, -0.08);
    pass(m.wd, bw, 0, 0);
    c.restore();
  }
  // vertical boards
  function planks(c, m, x0, x1, z0, z1) {
    c.save(); c.lineCap = 'butt';
    c.strokeStyle = 'rgba(40,22,10,0.42)'; c.lineWidth = 0.22; c.beginPath();
    for (let x = x0 + 1.1; x < x1 - 0.2; x += 1.1) { c.moveTo(x, z0); c.lineTo(x, z1); }
    c.stroke();
    c.strokeStyle = m.pkD; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x0, z0 + 0.8); c.lineTo(x1, z0 + 0.8); c.moveTo(x0, z1 - 0.5); c.lineTo(x1, z1 - 0.5); c.stroke();
    c.restore();
  }
  // window in a face frame: x centre, z sill, w, h; o.arch, o.stone (stone surround), o.shut (shutter colour)
  function win(c, m, x, z, w, h, o) {
    o = o || {};
    const arch = o.arch, x0 = x - w / 2;
    const path = (e) => { c.beginPath(); if (arch) { c.moveTo(x0 - e, z - e); c.lineTo(x0 - e, z + h - w / 2); c.arc(x, z + h - w / 2, w / 2 + e, PI, 0, true); c.lineTo(x0 + w + e, z - e); c.closePath(); } else c.rect(x0 - e, z - e, w + 2 * e, h + 2 * e); };
    if (o.shut) { c.fillStyle = o.shut; c.fillRect(x0 - w * 0.55 - 0.35, z - 0.1, w * 0.55, h + 0.2); c.fillRect(x0 + w + 0.35, z - 0.1, w * 0.55, h + 0.2); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x0 - 0.62, z - 0.1, 0.25, h + 0.2); c.fillRect(x0 + w + 0.36, z - 0.1, 0.25, h + 0.2); }
    path(o.stone ? 0.55 : 0.36); c.fillStyle = o.stone ? m.stL : m.wdD; c.fill();
    path(0);
    const g = c.createLinearGradient(0, z, 0, z + h);
    g.addColorStop(0, hx(C.shade(m.gl, 0.3))); g.addColorStop(1, hx(C.shade(m.gl, -0.18)));
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(60,34,18,0.85)'; c.lineWidth = Math.min(0.32, w * 0.12); c.beginPath();
    if (w > 1.3) { c.moveTo(x, z); c.lineTo(x, z + h); }
    if (h > 1.6) { c.moveTo(x0, z + h * 0.52); c.lineTo(x0 + w, z + h * 0.52); }
    c.stroke();
    if (!o.noSill) { c.fillStyle = o.stone ? m.stL : m.wdL; c.fillRect(x0 - 0.5, z - 0.62, w + 1, 0.42); }
    if (o.box) { c.fillStyle = m.wd; c.fillRect(x0 - 0.3, z - 1.25, w + 0.6, 0.7); for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#e05a4a' : '#f2d050'; c.beginPath(); c.arc(x0 + (i + 0.5) * w / 4, z - 0.45, 0.42, 0, TAU); c.fill(); } c.fillStyle = '#5c8a3a'; c.fillRect(x0 - 0.2, z - 0.75, w + 0.4, 0.25); }
  }
  // door in a face frame: x centre, z base, w, h (arched top), o.col
  function door(c, m, x, z, w, h, o) {
    o = o || {};
    const x0 = x - w / 2, ra = w / 2;
    const path = (e) => { c.beginPath(); c.moveTo(x0 - e, z); c.lineTo(x0 - e, z + h - ra); c.arc(x, z + h - ra, ra + e, PI, 0, true); c.lineTo(x0 + w + e, z); c.closePath(); };
    path(0.6); c.fillStyle = o.frame || m.stL; c.fill();
    path(0); c.fillStyle = o.col || m.wd; c.fill();
    c.strokeStyle = 'rgba(24,12,6,0.55)'; c.lineWidth = 0.22; c.beginPath();
    for (let xi = x0 + w / 4; xi < x0 + w - 0.1; xi += w / 4) { c.moveTo(xi, z); c.lineTo(xi, z + h - ra * 0.3); }
    c.stroke();
    c.strokeStyle = m.iron; c.lineWidth = 0.34; c.beginPath(); c.moveTo(x0, z + h * 0.25); c.lineTo(x0 + w, z + h * 0.25); c.moveTo(x0, z + h * 0.62); c.lineTo(x0 + w, z + h * 0.62); c.stroke();
    S.dot(c, m.k2, x + w * 0.28, z + h * 0.42, 0.22);
    if (o.lit) { c.fillStyle = rgba(m.gl, 0.9); c.beginPath(); c.arc(x, z + h - ra, ra * 0.5, 0, PI); c.fill(); }
    c.fillStyle = m.stD; c.fillRect(x0 - 0.8, z - 0.6, w + 1.6, 0.6);
  }
  // gable triangle dressing: half-width hw, base z ze, rise hr
  function gableDeco(c, m, cx, hw, ze, hr, o) {
    o = o || {};
    c.save(); c.beginPath(); c.moveTo(cx - hw, ze); c.lineTo(cx + hw, ze); c.lineTo(cx, ze + hr); c.closePath(); c.clip();
    if (o.stone) ashlar(c, cx - hw, cx + hw, ze, ze + hr, 5);
    else if (!o.plain) {
      c.lineCap = 'butt';
      for (const [col, w, dz] of [[m.wdD, 0.95, -0.08], [m.wd, 0.72, 0]]) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        c.moveTo(cx - hw, ze + 0.4 + dz); c.lineTo(cx + hw, ze + 0.4 + dz);
        c.moveTo(cx, ze); c.lineTo(cx, ze + hr);
        const zc = ze + hr * 0.42, xc = hw * 0.58;
        c.moveTo(cx - xc, zc + dz); c.lineTo(cx + xc, zc + dz);
        c.moveTo(cx - hw * 0.62, ze); c.lineTo(cx - hw * 0.62, zc); c.moveTo(cx + hw * 0.62, ze); c.lineTo(cx + hw * 0.62, zc);
        c.moveTo(cx - hw * 0.62, ze + 0.3); c.lineTo(cx, zc + hr * 0.3); c.moveTo(cx + hw * 0.62, ze + 0.3); c.lineTo(cx, zc + hr * 0.3);
        c.stroke();
      }
    }
    if (o.attic) win(c, m, cx, ze + hr * 0.2, o.attic[0], o.attic[1], { arch: o.atticArch, noSill: true, stone: o.stone });
    if (o.oculus) { S.dot(c, o.stone ? m.stL : m.wdD, cx, ze + hr * 0.42, o.oculus + 0.5); S.dot(c, m.gl, cx, ze + hr * 0.42, o.oculus); S.dot(c, sh(m.gl, 0.4), cx - o.oculus * 0.25, ze + hr * 0.42 + o.oculus * 0.25, o.oculus * 0.4); }
    // shadow under the verges
    c.strokeStyle = 'rgba(24,12,6,0.3)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx - hw - 1, ze - 1.4); c.lineTo(cx, ze + hr - 1.2); c.lineTo(cx + hw + 1, ze - 1.4); c.stroke();
    c.restore();
  }

  /* hall: the workhorse building block. Pushes plinth, walls, optional jettied timber upper
   * storey, gable prism, wall dressing, painted roof and chimneys onto K.parts. */
  function hall(K, o) {
    const m = K.m, parts = K.parts;
    const cx = o.cx || 0, cy = o.cy || 0, W = o.W, D = o.D, z0 = o.z0 || 0, ze = o.ze;
    const up = o.upper !== undefined, zu = o.upper, jt = up ? (o.jetty !== undefined ? o.jetty : 0.9) : 0;
    const stone = (o.wall || 'stone') === 'stone', wood = o.wall === 'wood';
    const rk = o.roof || 'gy';
    const x0 = cx - W / 2, x1 = cx + W / 2, by = cy - D / 2, fy = cy + D / 2;
    const ux0 = x0 - jt, ux1 = x1 + jt, ufy = fy + jt;
    const RW = W + jt * 2, RD = D + jt, rcy = cy + jt / 2;
    const hr = o.hr !== undefined ? o.hr : (rk === 'gy' ? RW : RD) * 0.42;
    const lowS = stone ? m.stS : wood ? m.pk : m.pl, lowT = stone ? m.stT : wood ? m.pk : m.pl;
    const cl = o.clip; // z -> minimum y (wing emerging from a main roof)
    if (o.plinth !== false && z0 < 0.5) parts.push(box(x0 - 0.7, cl ? Math.max(by, cl(0)) - 0.6 : by - 0.6, x1 + 0.7, fy + 0.8, 0, 1.2, m.stD, mx(m.stD, m.stS, 0.5), { ao: 0.25 }));
    parts.push(cbox(x0, by, x1, fy, z0, up ? zu : ze, lowS, lowT, cl, { ao: 0.32 }));
    if (up) parts.push(cbox(ux0, by, ux1, ufy, zu, ze, m.pl, m.pl, cl, { ao: 0.14 }));
    const gStone = o.gable === 'stone' || (o.gable === undefined && stone && !up);
    if (rk === 'gy') { const pr = prism(cx, rcy, RW, RD, ze, hr - 0.15, gStone ? m.stS : wood && !up ? m.pk : m.pl); if (cl) { const y1 = rcy + RD / 2; pr.shape = (c, zt) => { const hw = (RW / 2) * (1 - zt), yb = Math.max(rcy - RD / 2, cl(ze + zt * (hr - 0.15))); if (hw > 0.04 && yb < y1) c.rect(cx - hw, yb, hw * 2, y1 - yb); }; } parts.push(pr); }
    const ro = Object.assign({ roofCol: o.roofCol || m.rf }, o.ro || {});
    const roof = rk === 'gy' ? roofGY(cx, rcy, RW, RD, ze, hr, ro) : rk === 'none' ? null : roofGX(cx, rcy, RW, RD, ze, hr, Object.assign({ hip: rk === 'hip' }, ro));
    parts.push(overlay((c, an) => {
      const zl1 = up ? zu : ze;
      onFace(c, fy, (c) => {
        if (stone) { ashlar(c, x0, x1, z0, zl1, (o.seed || 1) + 3); quoins(c, x0, x1, z0, zl1); }
        else if (wood) planks(c, m, x0, x1, z0, zl1);
        else if (o.frameLow) timber(c, m, x0, x1, z0 + 0.6, zl1, o.frameLow);
        if (up) shadeBand(c, x0, x1, zu, 1.8, 0.34);
        else if (rk !== 'gy') shadeBand(c, x0, x1, ze, 2.4, 0.32);
      });
      if (up) onFace(c, ufy, (c) => { timber(c, m, ux0, ux1, zu, ze, o.frame); if (rk !== 'gy') shadeBand(c, ux0, ux1, ze, 2.4, 0.32); });
      if (rk === 'gy') onFace(c, up ? ufy : fy, (c) => { if (wood && !up) { c.save(); c.beginPath(); c.moveTo(cx - RW / 2, ze); c.lineTo(cx + RW / 2, ze); c.lineTo(cx, ze + hr); c.closePath(); c.clip(); planks(c, m, cx - RW / 2, cx + RW / 2, ze, ze + hr); c.restore(); } gableDeco(c, m, cx, RW / 2, ze, hr - 0.15, Object.assign({ stone: gStone, plain: wood && !up }, o.gd || {})); });
      for (const wn of o.wins || []) { const hi = up && wn[1] >= zu - 0.01; onFace(c, hi ? ufy : fy, (c) => win(c, m, wn[0], wn[1], wn[2], wn[3], Object.assign({ stone: stone && !hi }, wn[4] || {}))); }
      if (o.door) onFace(c, fy, (c) => door(c, m, o.door[0], z0, o.door[1], o.door[2], o.door[3]));
      if (o.deco) { c.save(); o.deco(c, an); c.restore(); }
      if (roof) { paintFaces(c, roof.faces, K.R); paintLines(c, roof.lines, m); if (o.roofDeco) o.roofDeco(c, roof, an); }
    }));
    for (const ch of o.chim || []) chimney(K, ch[0], ch[1], roof.zAt(ch[0], ch[1]), roof.zr + ch[2], ch[3]);
    return { roof, fy, ufy, zr: roof ? roof.zr : ze, x0, x1 };
  }
  function chimney(K, x, y, zb, zt, brick) {
    const m = K.m, w = 2.6, d = 2.2, col = brick ? mx(m.rf, m.d, 0.35) : m.stS, colT = brick ? mx(m.rf, m.stT, 0.4) : m.stT;
    K.parts.push({ z0: zb - 1.2, z1: zt, side: col, top: colT, ao: 0.1, shape: (c, t) => { const e = t > 1 - 0.9 / (zt - zb + 1.2) ? 0.4 : 0; c.rect(x - w / 2 - e, y - d / 2 - e, w + e * 2, d + e * 2); },
      detail: (c) => { c.beginPath(); c.fillStyle = '#1c1512'; c.rect(x - w / 2 + 0.45, y - d / 2 + 0.45, w - 0.9, d - 0.9); c.fill(); } });
  }

  /* ======================================================== towers & cones */
  // painted front band of a cylinder (z0..z1): roundness shading + ashlar courses
  function cylDeco(c, m, cx, cy, r, z0, z1, o) {
    o = o || {};
    c.save();
    c.beginPath(); c.arc(cx, cy - z0, r, 0, PI); c.lineTo(cx - r, cy - z1); c.arc(cx, cy - z1, r, PI, 0, true); c.closePath();
    c.clip();
    if (!o.plain) {
      c.strokeStyle = 'rgba(44,32,24,0.24)'; c.lineWidth = 0.22; c.lineCap = 'butt'; c.beginPath();
      let row = 0;
      for (let z = z0 + 1.9; z < z1 - 0.2; z += 1.9, row++) {
        c.moveTo(cx + r, cy - z); c.arc(cx, cy - z, r, 0, PI);
        const dA = 3.3 / r;
        for (let a = 0.12 + (row % 2) * dA * 0.5; a < PI - 0.1; a += dA) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; c.moveTo(x, y - z); c.lineTo(x, y - z + 1.9); }
      }
      c.stroke();
    }
    const g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, 'rgba(255,248,232,0.2)'); g.addColorStop(0.28, 'rgba(255,248,232,0.06)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(16,8,2,0.34)');
    c.fillStyle = g; c.fillRect(cx - r - 1, cy - z1 - r, r * 2 + 2, z1 - z0 + r * 2 + 1);
    c.restore();
  }
  // window / slit on a cylinder at angle phi (0 = +x, PI/2 = front)
  function cylWin(c, m, cx, cy, r, phi, z, w, h, o) {
    onFaceAt(c, cx + Math.cos(phi) * r, cy + Math.sin(phi) * r, Math.sin(phi), -Math.cos(phi), (c) => {
      if (o && o.slit) { c.fillStyle = m.stL; c.fillRect(-0.75, z - 0.45, 1.5, h + 0.9); c.fillStyle = '#1c1410'; c.fillRect(-0.28, z, 0.56, h); if (o.cross) c.fillRect(-0.7, z + h * 0.55, 1.4, 0.4); }
      else if (o && o.door) door(c, m, 0, z, w, h, o);
      else win(c, m, 0, z, w, h, Object.assign({ arch: true, stone: true }, o || {}));
    });
  }
  // painted conical roof: base circle (cx, cy, r) at height zb, apex hc above
  function paintCone(c, m, cx, cy, r, zb, hc, o) {
    o = o || {};
    const col = o.col || m.rf, by = cy - zb, ay = by - hc;
    const al = hc > r ? Math.acos(r / hc) : 0.05;
    const path = () => { c.beginPath(); c.moveTo(cx, ay); c.arc(cx, by, r, -PI / 2 + al, PI * 1.5 - al); c.closePath(); };
    path();
    const g = c.createLinearGradient(cx - r, 0, cx + r, 0);
    g.addColorStop(0, C.str(C.shade(col, 0.12))); g.addColorStop(0.3, C.str(C.shade(col, 0.2))); g.addColorStop(0.62, C.str(C.shade(col, -0.08))); g.addColorStop(1, C.str(C.shade(col, -0.36)));
    c.fillStyle = g; c.fill();
    c.save(); path(); c.clip();
    const be = Math.asin(Math.min(1, r / hc));
    const sp = o.rows || 1.8;
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(255,226,196,0.15)'; c.lineWidth = 0.3; c.beginPath();
    for (let h = sp; h < hc - 1.5; h += sp) { const rr = r * (1 - h / hc); c.moveTo(cx + Math.cos(-be) * rr, by - h - 0.36 + Math.sin(-be) * rr); c.arc(cx, by - h - 0.36, rr, -be, PI + be); }
    c.stroke();
    c.strokeStyle = 'rgba(48,14,6,0.34)'; c.lineWidth = 0.32; c.beginPath();
    for (let h = sp; h < hc - 1.5; h += sp) { const rr = r * (1 - h / hc); c.moveTo(cx + Math.cos(-be) * rr, by - h + Math.sin(-be) * rr); c.arc(cx, by - h, rr, -be, PI + be); }
    c.stroke();
    c.strokeStyle = 'rgba(48,14,6,0.14)'; c.lineWidth = 0.26; c.beginPath();
    const n = Math.max(6, Math.round(r * 1.1));
    for (let i = 1; i < n; i++) { const a = -be + (PI + 2 * be) * i / n; c.moveTo(cx + Math.cos(a) * r, by + Math.sin(a) * r); c.lineTo(cx + Math.cos(a) * r * 0.12, ay + (by - ay) * 0.12 + Math.sin(a) * r * 0.12); }
    c.stroke();
    c.strokeStyle = 'rgba(255,236,210,0.2)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(cx + Math.cos(PI * 0.78) * r * 0.92, by + Math.sin(PI * 0.78) * r * 0.92); c.lineTo(cx, ay + 0.6); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(34,12,6,0.6)'; c.lineWidth = 0.5; c.beginPath(); c.arc(cx, by, r, 0.05, PI - 0.05); c.stroke();
    if (o.finial !== false) { seg2(c, [cx, ay + 0.5], [cx, ay - 2.4], m.iron, 0.4); S.dot(c, m.k2, cx, ay - 0.2, 0.62); S.dot(c, '#fff4c0', cx - 0.2, ay - 0.42, 0.22); }
  }
  // painted pennant flying from a pole top; dir = +1 flies right
  function paintFlag(c, m, x, y, zTop, len, hgt, an, o) {
    o = o || {};
    const dir = o.dir || 1, N = 8, ph = an * TAU, top = y - zTop;
    const wave = (u) => Math.sin(u * 3.4 - ph) * 0.75 * u + u * 0.5;
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      const xa = x + dir * len * u0, xb = x + dir * len * u1 + dir * 0.05;
      const ya = top + wave(u0), yb = top + wave(u1);
      const ha = hgt * (1 - 0.18 * u0), hb = hgt * (1 - 0.18 * u1);
      const notch = o.tail && i === N - 1;
      const k = Math.cos((u0 + u1) * 1.7 - ph) * 0.2;
      c.fillStyle = C.str(C.shade(o.col || m.k, k));
      c.beginPath(); c.moveTo(xa, ya); c.lineTo(xb, yb); if (notch) c.lineTo(xb - dir * len * 0.1, yb + hb * 0.5); c.lineTo(xb, yb + hb); c.lineTo(xa, ya + ha); c.closePath(); c.fill();
      const bandA = ya + ha * 0.42, bandB = yb + hb * 0.42;
      c.fillStyle = C.str(C.shade(o.col2 || m.k2, k));
      c.beginPath(); c.moveTo(xa, bandA); c.lineTo(xb, bandB); c.lineTo(xb, bandB + hb * 0.2); c.lineTo(xa, bandA + ha * 0.2); c.closePath(); c.fill();
    }
    seg2(c, [x, y - zTop + hgt + 0.6], [x, y - zTop - 1.2], m.wdD, 0.5);
    S.dot(c, m.k2, x, y - zTop - 1.2, 0.45);
  }
  // full flag pole (painted) from z0 to zTop with pennant
  function paintPole(c, m, x, y, z0, zTop, len, hgt, an, o) {
    seg2(c, [x, y - z0], [x, y - zTop], m.wdD, 0.62);
    seg2(c, [x - 0.15, y - z0], [x - 0.15, y - zTop], m.wdL, 0.2);
    paintFlag(c, m, x, y, zTop, len, hgt, an, o);
  }
  // hanging banner (gonfalon) on a front face in local coords: x centre, z top, w, h
  function banner(c, m, x, zt, w, h, an, o) {
    o = o || {};
    const sway = Math.sin((an || 0) * TAU) * 0.25, x0 = x - w / 2;
    c.fillStyle = m.wdD; c.fillRect(x0 - 0.5, zt - 0.1, w + 1, 0.5);
    c.beginPath(); c.moveTo(x0, zt); c.lineTo(x0 + w, zt); c.lineTo(x0 + w + sway, zt - h); c.lineTo(x + sway, zt - h + w * 0.45); c.lineTo(x0 + sway, zt - h); c.closePath();
    const g = c.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, sh(o.col || m.k, 0.12)); g.addColorStop(0.5, o.col || m.k); g.addColorStop(1, sh(o.col || m.k, -0.3));
    c.fillStyle = g; c.fill();
    c.strokeStyle = o.col2 || m.k2; c.lineWidth = Math.max(0.25, w * 0.09); c.stroke();
    // emblem: gold crown
    const ey = zt - h * 0.38, s = w * 0.3;
    c.fillStyle = o.col2 || m.k2; c.beginPath(); c.moveTo(x - s + sway * 0.5, ey - s * 0.6); c.lineTo(x - s, ey + s * 0.5); c.lineTo(x - s * 0.4, ey); c.lineTo(x, ey + s * 0.75); c.lineTo(x + s * 0.4, ey); c.lineTo(x + s, ey + s * 0.5); c.lineTo(x + s + sway * 0.5, ey - s * 0.6); c.closePath(); c.fill();
  }
  // soft glow (painted)
  // (alpha stays under the forge's solid cut-off so halos never get outlined)
  function glow(c, col, x, y, r, a) {
    a = Math.min(0.37, a);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(C.shade(col, 0.6), a)); g.addColorStop(0.35, C.str(col, a * 0.75)); g.addColorStop(1, C.str(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  // crenellated round parapet (stacked): ring z0..z1 then n merlons up to z2
  function crenRing(parts, m, cx, cy, ro, ri, z0, z1, z2, n, rotA) {
    parts.push({ z0, z1, side: m.stS, top: m.stT, ao: 0.2, shape: (c) => ann(c, cx, cy, ri, ro) });
    const da = TAU / n;
    parts.push({ z0: z1, z1: z2, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => { for (let i = 0; i < n; i++) { const a = (rotA || 0) + i * da; sector(c, cx, cy, ri, ro, a, a + da * 0.56); } } });
  }
  // crenellated rectangular parapet (stacked) around x0..x1, y0..y1
  function crenRect(parts, m, x0, y0, x1, y1, t, z0, z1, z2, mw) {
    parts.push({ z0, z1, side: m.stS, top: m.stT, ao: 0.2, shape: (c) => { c.rect(x0, y0, x1 - x0, y1 - y0); c.moveTo(x0 + t, y0 + t); c.lineTo(x0 + t, y1 - t); c.lineTo(x1 - t, y1 - t); c.lineTo(x1 - t, y0 + t); c.closePath(); } });
    mw = mw || 2.4;
    parts.push({ z0: z1, z1: z2, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => {
      const edge = (ax, ay, bx, by, nx, ny) => {
        const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / (mw * 2))), st = L / n, ux = (bx - ax) / L, uy = (by - ay) / L;
        for (let i = 0; i < n; i++) { const s0 = i * st + st * 0.22, s1 = s0 + st * 0.56; const p = [ax + ux * s0, ay + uy * s0, ax + ux * s1, ay + uy * s1, ax + ux * s1 + nx * t, ay + uy * s1 + ny * t, ax + ux * s0 + nx * t, ay + uy * s0 + ny * t]; S.poly(c, p); }
      };
      edge(x0, y0, x1, y0, 0, 1); edge(x0, y1 - t, x1, y1 - t, 0, 1); edge(x0, y0 + t, x0, y1 - t, 1, 0); edge(x1 - t, y0 + t, x1 - t, y1 - t, 1, 0);
      c.rect(x0, y0, t, t); c.rect(x1 - t, y0, t, t); c.rect(x0, y1 - t, t, t); c.rect(x1 - t, y1 - t, t, t);
    } });
  }
  /* round tower: stacked shaft, painted dressing, optional painted cone roof or crenellated top */
  function roundTower(K, o) {
    const m = K.m, parts = K.parts;
    const cx = o.cx, cy = o.cy, r = o.r, z0 = o.z0 || 0, zt = o.zt, bt = o.batter || 0;
    if (o.plinth !== false && z0 < 0.5) parts.push(cyl(cx, cy, r + bt + 0.8, 0, 1.4, m.stD, mx(m.stD, m.stS, 0.5), { ao: 0.2 }));
    parts.push({ z0, z1: zt, side: o.side || m.stS, top: m.stT, ao: 0.3, shape: (c, t) => S.circ(c, cx, cy, r + bt * (1 - t)) });
    parts.push(overlay((c, an) => {
      cylDeco(c, m, cx, cy, r + bt * 0.5, z0, zt, o);
      for (const w of o.wins || []) cylWin(c, m, cx, cy, r + bt * 0.3, w[0], w[1], w[2], w[3], w[4]);
      if (o.deco) { c.save(); o.deco(c, an); c.restore(); }
      if (o.roof === 'cone') {
        const rc = r + (o.ov !== undefined ? o.ov : 1.3);
        paintCone(c, m, cx, cy, rc, zt - 0.6, o.ch, { finial: !o.flag && o.finial !== false, col: o.coneCol, rows: o.coneRows });
        if (o.flag) paintPole(c, m, cx, cy, zt + o.ch - 1, zt + o.ch + o.flag[0], o.flag[1], o.flag[2], an, { dir: o.flag[3] || 1, tail: true });
      }
    }));
    if (o.roof === 'crenel') {
      const ro = r + (o.ov !== undefined ? o.ov : 1.2);
      parts.push({ z0: zt - 2.6, z1: zt, side: m.stS, top: m.stT, ao: 0.15, shape: (c, t) => { const n = Math.round(ro * 1.4); for (let i = 0; i < n; i++) { const a = i / n * TAU; S.circ(c, cx + Math.cos(a) * (r - 0.2 + (ro - r) * t * 0.6), cy + Math.sin(a) * (r - 0.2 + (ro - r) * t * 0.6), 0.75); } } });
      parts.push(cyl(cx, cy, ro, zt, zt + 0.8, m.stS, m.pk, { ao: 0, detail: (c) => { c.save(); c.beginPath(); S.circ(c, cx, cy, ro - 1.2); c.clip(); c.strokeStyle = 'rgba(60,34,14,0.4)'; c.lineWidth = 0.2; c.beginPath(); for (let x = cx - ro; x < cx + ro; x += 1.3) { c.moveTo(x, cy - ro); c.lineTo(x, cy + ro); } c.stroke(); c.fillStyle = m.wdD; c.fillRect(cx + 1, cy + 0.5, 3, 2.6); c.strokeStyle = m.iron; c.lineWidth = 0.3; c.strokeRect(cx + 1, cy + 0.5, 3, 2.6); c.restore(); } }));
      crenRing(parts, m, cx, cy, ro, ro - 1.2, zt + 0.8, zt + 2.6, zt + 5, o.merlons || Math.max(6, Math.round(ro * 0.9)), o.mrot || 0.3);
    }
    return { top: o.roof === 'cone' ? zt + o.ch : zt + 5 };
  }


  /* ============================================ helpers for rotating models */
  // object-space vector for a screen-space offset at the heading being rendered
  const scr = (c, sx, sy) => { const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a); return [sx * ca + sy * sa, -sx * sa + sy * ca]; };
  // lit / shaded crescents painted over stacked cylinders or cones: items [cx, cy, r0, r1]
  function crescents(items, z0, z1, col, ao, ex) {
    const R = (it, zt) => (it[3] !== undefined ? it[2] + (it[3] - it[2]) * zt : it[2]);
    const mk = (k, sx) => Object.assign({ z0, z1, side: sh(col, k), top: sh(col, k), flat: true, bevel: false, ao: ao === undefined ? 0.3 : ao, shape: (c, zt) => {
      if (zt > 0.97) return;
      for (const it of items) { const r = R(it, zt); if (r < 0.35) continue; const o = scr(c, sx * r, 0); S.circ(c, it[0], it[1], r); c.moveTo(it[0] + o[0] + r * 1.03, it[1] + o[1]); c.arc(it[0] + o[0], it[1] + o[1], r * 1.03, TAU, 0, true); }
    } }, ex || {});
    return [mk(-0.3, -0.27), mk(0.17, 0.24)];
  }
  // ashlar on straight camera-facing wall faces of rotating models: faces [x0, x1, y, sg]
  // (sg = +1 face looks toward +y). Returns [tonal blocks, mortar courses + staggered joints].
  function wallTex(faces, z0, z1, m, ex) {
    const ch = 2, bw = 3.4, dep = 0.24;
    const fy = (f) => (f[3] > 0 ? f[2] - 0.04 : f[2] - dep + 0.04);
    const tone = Object.assign({ z0, z1, side: sh(m.stS, -0.1), top: sh(m.stS, -0.1), ao: 0.32, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0), row = Math.floor((z - z0) / ch);
      if ((z - z0) % ch < 0.45 || zt > 0.97) return;
      for (const f of faces) {
        if (!facing(c, 0, f[3], 0.05)) continue;
        const off = (row % 2) * bw * 0.5;
        for (let x = f[0] - off, k = 0; x < f[1]; x += bw, k++) {
          const h = U.hash2(Math.round(x * 3) + 50, row, Math.round(f[2] * 10) + 7);
          if (h < 0.7) continue;
          const xa = Math.max(f[0], x + 0.15), xb = Math.min(f[1], x + bw - 0.15);
          if (xb > xa) c.rect(xa, fy(f), xb - xa, dep);
        }
      }
    } }, ex || {});
    const mortar = Object.assign({ z0, z1, side: '#5c524a', top: '#5c524a', flat: true, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0), row = Math.floor((z - z0) / ch), f2 = (z - z0) % ch;
      if (z < z0 + 0.6 || zt > 0.97) return;
      for (const f of faces) {
        if (!facing(c, 0, f[3], 0.05)) continue;
        if (f2 < 0.45) { c.rect(f[0], fy(f), f[1] - f[0], dep); continue; }
        const off = (row % 2) * bw * 0.5;
        for (let x = f[0] - off + bw; x < f[1] - 0.2; x += bw) if (x > f[0] + 0.2) c.rect(x - 0.09, fy(f), 0.18, dep);
      }
    } }, ex || {});
    return [tone, mortar];
  }
  // smooth lit / shaded stripes on a stacked cone (overlapping offset discs): item [cx, cy, rBase]
  function coneShade(it, z0, z1, col, ex) {
    const mk = (k, sx, rr) => Object.assign({ z0, z1, side: sh(col, k), top: sh(col, k), flat: true, bevel: false, ao: 0.08, shape: (c, zt) => {
      if (zt > 0.94) return;
      const r = it[2] * (1 - zt), o = scr(c, sx * r, -0.12 * r);
      S.circ(c, it[0] + o[0], it[1] + o[1], r * rr);
    } }, ex || {});
    return [mk(0.18, -0.5, 0.36), mk(-0.28, 0.62, 0.36)];
  }
  // tile courses on the camera-facing half of a stacked cone: items [cx, cy, rBase, zBase, height]
  function coneRows(items, col, ex) {
    let zA = Infinity, zB = -Infinity;
    for (const it of items) { zA = Math.min(zA, it[3]); zB = Math.max(zB, it[3] + it[4]); }
    return Object.assign({ z0: zA, z1: zB, side: col, top: col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = zA + zt * (zB - zA), a = headingOf(c), th = Math.atan2(Math.cos(a), Math.sin(a));
      for (const it of items) {
        const zz = z - it[3];
        if (zz < 1.5 || zz > it[4] - 2) continue;
        if (zz % 2.5 > 0.45) continue;
        const r = it[2] * (1 - zz / it[4]);
        sector(c, it[0], it[1], r - 0.22, r - 0.02, th - 1.15, th + 1.15);
      }
    } }, ex || {});
  }
  // sharpened logs [x, y, ztip, r] (palisades) + a screen-left highlight stripe per log
  function logParts(logs, z0, col, colT, ex) {
    let zmax = 0;
    for (const g of logs) zmax = Math.max(zmax, g[2]);
    const shape = (k) => (c, t) => {
      const z = z0 + t * (zmax - z0), o = k ? scr(c, k, 0) : null;
      for (const g of logs) {
        if (z > g[2]) continue;
        const tip = g[2] - 2.4, r = z > tip ? g[3] * (1 - (z - tip) / 2.4) + 0.06 : g[3];
        if (o) S.circ(c, g[0] + o[0] * r, g[1] + o[1] * r, r * 0.4); else S.circ(c, g[0], g[1], r);
      }
    };
    return [Object.assign({ z0, z1: zmax, side: col, top: colT, ao: 0.4, shape: shape(0) }, ex || {}),
      Object.assign({ z0, z1: zmax, side: sh(col, 0.3), top: sh(colT, 0.25), flat: true, bevel: false, ao: 0.35, shape: shape(-0.5) }, ex || {})];
  }
  // logs along a polyline, spacing sp
  function logLine(pts, sp, h, r, seed, skip) {
    const out = [];
    for (let i = 0; i < pts.length - 2; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / sp));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (skip && skip(x, y)) continue;
        const hh = U.hash2(Math.round(x * 7), Math.round(y * 7), seed || 3);
        out.push([x, y, h + hh * 1.6, r * (0.92 + hh * 0.16)]);
      }
    }
    return out;
  }
  // stacked pennant on a pole (rotating models); flag flies along +x
  function stackFlag(x, y, z0, zt, len, fh, m, ex) {
    const fl = (col, za, zb) => Object.assign({ z0: za, z1: zb, side: col, top: col, ao: 0.1, bevel: false, stroke: 0.3, shape: (c, t, an) => {
      for (let i = 0; i < 5; i++) { const u0 = i / 5, u1 = (i + 1) / 5; c.moveTo(x + 0.3 + len * u0, y + Math.sin(u0 * 3.2 - an * TAU) * 0.6 * u0); c.lineTo(x + 0.3 + len * u1, y + Math.sin(u1 * 3.2 - an * TAU) * 0.6 * u1); }
    } }, ex || {});
    return [beams([[x, y, z0, x, y, zt + 0.6]], 0.42, 0.4, m.wdD, m.k2, ex), fl(m.k, zt - fh, zt), fl(m.k2, zt - fh * 0.45, zt - fh * 0.3)];
  }

  /* ======================================================== props (1-dir) */
  function barrels(K, list, h) {
    const m = K.m, col = mx(m.wd, '#9a6a3a', 0.45);
    K.parts.push({ z0: 0, z1: h, side: col, top: mx(m.wd, '#c49868', 0.5), ao: 0.3, shape: (c, t) => { for (const b of list) S.circ(c, b[0], b[1], b[2] * (1 + 0.1 * Math.sin(PI * t))); },
      detail: (c) => { for (const b of list) { c.beginPath(); c.strokeStyle = 'rgba(40,24,12,0.6)'; c.lineWidth = 0.25; c.arc(b[0], b[1], b[2] * 0.62, 0, TAU); c.stroke(); } } });
    K.parts.push(overlay((c) => { for (const b of list) for (const z of [h * 0.22, h * 0.78]) { c.strokeStyle = m.iron; c.lineWidth = 0.4; c.beginPath(); c.arc(b[0], b[1] - z, b[2] * 1.07, 0.15, PI - 0.15); c.stroke(); } }));
  }
  function crates(K, list) { // [x, y, s, h]
    const m = K.m;
    let H = 0; for (const b of list) H = Math.max(H, b[3]);
    for (const b of list) K.parts.push(box(b[0] - b[2] / 2, b[1] - b[2] / 2, b[0] + b[2] / 2, b[1] + b[2] / 2, b[4] || 0, (b[4] || 0) + b[3], mx(m.pk, m.wd, 0.25), sh(m.pk, 0.12), { ao: 0.25,
      detail: (c) => { S.lines(c, 'rgba(50,28,12,0.5)', 0.22, [b[0] - b[2] / 2, b[1] - b[2] / 6, b[0] + b[2] / 2, b[1] - b[2] / 6, b[0] - b[2] / 2, b[1] + b[2] / 6, b[0] + b[2] / 2, b[1] + b[2] / 6]); } }));
    K.parts.push(overlay((c) => { for (const b of list) onFace(c, b[1] + b[2] / 2, (c) => { const x0 = b[0] - b[2] / 2, z0 = b[4] || 0; c.strokeStyle = 'rgba(60,34,14,0.7)'; c.lineWidth = 0.32; c.strokeRect(x0 + 0.2, z0 + 0.2, b[2] - 0.4, b[3] - 0.4); c.beginPath(); c.moveTo(x0 + 0.3, z0 + 0.3); c.lineTo(x0 + b[2] - 0.3, z0 + b[3] - 0.3); c.stroke(); }); }));
  }
  function haystack(K, x, y, r, h) {
    const m = K.m;
    K.parts.push({ z0: 0, z1: h, side: m.straw, top: sh(m.straw, 0.25), ao: 0.32, shape: (c, t) => S.blob(c, x, y, r * Math.pow(Math.max(0.02, 1 - t * t), 0.6), 7, 9, 0.1) });
    K.parts.push(overlay((c) => {
      const g = c.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, 'rgba(255,244,200,0.22)'); g.addColorStop(0.45, 'rgba(255,244,200,0)'); g.addColorStop(1, 'rgba(70,40,10,0.3)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y - h * 0.35, r * 1.02, PI, 0); c.lineTo(x + r, y); c.arc(x, y, r, 0, PI); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(130,90,30,0.5)'; c.lineWidth = 0.22; c.beginPath();
      for (let i = 0; i < 14; i++) { const a = 0.15 + (i / 13) * (PI - 0.3); c.moveTo(x + Math.cos(a) * r * 0.95, y - 0.3 + Math.sin(a) * r * 0.55); c.quadraticCurveTo(x + Math.cos(a) * r * 0.75, y - h * 0.5, x + Math.cos(a) * r * 0.25, y - h * 0.92); }
      c.stroke();
      c.strokeStyle = m.strawD; c.lineWidth = 0.4; c.beginPath(); c.arc(x, y - h * 0.38, r * 0.86, 0.2, PI - 0.2); c.stroke();
    }));
  }
  // timber fence (1-dir or rotating): posts + 2 rails along a polyline
  function fence(pts, h, m, ex) {
    const posts = [], rails = [];
    for (let i = 0; i < pts.length; i += 2) posts.push([pts[i], pts[i + 1], 0, pts[i], pts[i + 1], h]);
    for (let i = 0; i < pts.length - 2; i += 2) for (const z of [h * 0.45, h * 0.88]) rails.push([pts[i], pts[i + 1], z, pts[i + 2], pts[i + 3], z]);
    return [beams(posts, 0.75, 0.6, m.wdD, m.wd, ex), beams(rails, 0.5, 0.5, m.wd, m.wdL, ex)];
  }
  // ground pad (flagstones / earth) with painted texture; outline follows the pad
  function pad(pts, col, colS, kind, seed) {
    return { z0: 0, z1: 0.6, side: colS, top: col, ao: 0.2, bevel: false, shape: (c) => S.poly(c, pts), detail: (c) => {
      c.save(); c.beginPath(); S.poly(c, pts); c.clip();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
      if (kind === 'flag') {
        let r = 0;
        for (let y = y0; y < y1; y += 2.6, r++) for (let x = x0 - (r % 2) * 1.6; x < x1; x += 3.2) {
          const h = U.hash2(Math.round(x * 5), Math.round(y * 5), seed || 2);
          c.fillStyle = h > 0.7 ? 'rgba(255,248,230,0.1)' : h < 0.25 ? 'rgba(30,24,16,0.12)' : 'rgba(0,0,0,0)';
          c.fillRect(x + 0.15, y + 0.15, 2.9, 2.3);
        }
        c.strokeStyle = 'rgba(40,32,24,0.28)'; c.lineWidth = 0.22; c.beginPath(); r = 0;
        for (let y = y0; y < y1; y += 2.6, r++) { c.moveTo(x0, y); c.lineTo(x1, y); for (let x = x0 - (r % 2) * 1.6; x < x1; x += 3.2) { c.moveTo(x, y); c.lineTo(x, y + 2.6); } }
        c.stroke();
      } else {
        for (let i = 0; i < 60; i++) { const h1 = U.hash2(i, 1, seed || 4), h2 = U.hash2(i, 2, seed || 4), h3 = U.hash2(i, 3, seed || 4); c.fillStyle = h3 > 0.5 ? 'rgba(60,44,24,0.16)' : 'rgba(255,240,210,0.1)'; c.beginPath(); S.ell(c, x0 + h1 * (x1 - x0), y0 + h2 * (y1 - y0), 1 + h3 * 2.4, 0.6 + h3, h1 * 3); c.fill(); }
      }
      c.restore();
    } };
  }
  // soft cast shadow of a footprint toward the bottom-right, clipped to a ground pad
  function castShadow(c, clipPts, items) {
    c.save(); c.beginPath(); S.poly(c, clipPts); c.clip();
    c.fillStyle = 'rgba(16,20,8,0.26)';
    for (const it of items) {
      const [x0, y0, x1, y1, h] = it, dx = h * 0.34, dy = h * 0.2;
      c.beginPath(); S.poly(c, [x0, y0, x1, y0, x1 + dx, y0 + dy, x1 + dx, y1 + dy, x0 + dx, y1 + dy, x0, y1]); c.fill();
    }
    c.restore();
  }
  const rectP = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const rrP = (x0, y0, x1, y1, k) => [x0 + k, y0, x1 - k, y0, x1, y0 + k, x1, y1 - k, x1 - k, y1, x0 + k, y1, x0, y1 - k, x0, y0 + k];

  // village well: stone ring, two posts and a little tiled roof
  function well(K, x, y) {
    const m = K.m;
    K.parts.push(cyl(x, y, 3, 0, 3, m.stS, m.stT, { ao: 0.3, detail: (c) => { S.dot(c, '#1e2a32', x, y, 2); S.dot(c, '#3c5a6a', x - 0.5, y - 0.4, 1.1); } }));
    K.parts.push(overlay((c) => cylDeco(c, m, x, y, 3, 0, 3, { plain: true })));
    K.parts.push(beams([[x - 2.6, y, 0, x - 2.6, y, 6.2], [x + 2.6, y, 0, x + 2.6, y, 6.2], [x - 2.6, y, 5.2, x + 2.6, y, 5.2]], 0.6, 0.5, m.wdD, m.wd));
    K.parts.push(overlay((c) => { seg2(c, [x, y - 5.2], [x, y - 3.4], 'rgba(60,40,20,0.8)', 0.18); S.fillPoly(c, m.wd, [x - 0.6, y - 3.6, x + 0.6, y - 3.6, x + 0.5, y - 2.6, x - 0.5, y - 2.6]); const f = roofGX(x, y, 5.4, 3.2, 6, 2.4, { roofCol: m.rf, ov: 0.6, rows: 1.4 }); paintFaces(c, f.faces, K.R); paintLines(c, f.lines, m); }));
  }

  /* ============================================================== HOUSE */
  M.human_house = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), v = ((opt.v | 0) % 4 + 4) % 4;
    if (opt.slate) { m.rf = '#5b6472'; m.rfD = sh(m.rf, -0.45); m.rfL = sh(m.rf, 0.3); }
    const parts = [], K = { m, parts, R: 22 };
    let H = 30;
    if (v === 0) {
      // front-gabled cottage: stone ground floor, jettied timber-framed upper storey
      hall(K, { W: 20, D: 22, ze: 14, upper: 7.5, hr: 10.5, door: [-4.2, 3.2, 5.6], wins: [[4.2, 2.4, 2.6, 2.8, { shut: m.k }], [-5, 9.4, 2.4, 2.8, { box: true }], [5, 9.4, 2.4, 2.8, { box: true }]],
        gd: { attic: [1.8, 2.4] }, chim: [[-6.5, -6, 2.8]], frame: { pat: 'k' }, seed: 2 });
      barrels(K, [[12.8, 7, 1.5]], 3.4);
      H = 29;
    } else if (v === 1) {
      // long hipped house with a front cross-gable dormer
      const h = hall(K, { W: 30, D: 17, ze: 13, upper: 6.5, hr: 8, roof: 'hip', door: [-6, 3, 5.2], wins: [[1, 2.4, 2.4, 2.6, { box: true }], [9, 2.4, 2.4, 2.6, { box: true }], [-10.5, 8.6, 2.2, 2.6], [-2, 8.6, 2.2, 2.6], [10.5, 8.6, 2.2, 2.6]],
        chim: [[9, -3, 3, true]], frame: { pat: 'v' }, seed: 4 });
      dormer(K, h.roof, 3.8, 6.5, 5.2, 4.2, 4.6);
      H = 26;
    } else if (v === 2) {
      // L-shaped: plastered hipped main wing with a front gabled wing
      const h = hall(K, { cx: -2, cy: -4, W: 30, D: 14, ze: 9, wall: 'plaster', frameLow: { pat: 'x' }, hr: 7.5, roof: 'hip', wins: [[-12.5, 2.6, 2.2, 2.6, { shut: m.k }], [-6, 2.6, 2.2, 2.6, { shut: m.k }]], chim: [[-10, -6, 3, true]], seed: 6 });
      hall(K, { cx: 7, cy: 5, W: 13, D: 12, ze: 10, upper: 5.5, jetty: 0.6, hr: 8.4, plinth: false, clip: behind(h.roof, 3), door: [-3, 2.8, 4.8], wins: [[3, 2.2, 2.2, 2.4], [-3, 6.6, 2, 2.2], [3, 6.6, 2, 2.2]], ro: { valley: h.roof.valley, ovb: 0 },
        gd: { attic: [1.6, 2.2] }, frame: { pat: 'k', sp: 3.2 }, seed: 7 });
      crates(K, [[-14, 6, 2.6, 2.4], [-11.2, 6.6, 2.2, 2]]);
      H = 22;
    } else {
      // stone manor with a round corner turret
      hall(K, { cx: 2, cy: -1, W: 24, D: 20, ze: 15, upper: 9, hr: 11, door: [5, 3.4, 6, { lit: true }], wins: [[-3, 2.6, 2.4, 3.6, { arch: true }], [-4, 11, 2.4, 2.8], [7, 11, 2.4, 2.8]],
        gd: { oculus: 1.1 }, chim: [[10, -6, 3]], frame: { pat: 'x' }, seed: 8 });
      roundTower(K, { cx: -11.5, cy: 7.5, r: 4.6, zt: 19, roof: 'cone', ch: 11, ov: 1.1, wins: [[PI * 0.55, 4, 1.6, 2.6], [PI * 0.62, 12.5, 1.6, 2.4]], flag: [5.5, 6, 3.2, -1] });
      H = 40;
    }
    return { r: 22, h: H, parts, style: 'unit', bevel: 0.8 };
  };
  // dormer (cross-gable window) sitting on the front slope of a gx / hip roof
  function dormer(K, roof, x, w, hWall, hRoof, yd) {
    const m = K.m, vl = roof.valley;
    const zs = roof.zAt(x, yd);
    const ze = zs + hWall;
    const r = roofGY(x, yd - 2.5, w, 5, ze, hRoof, { roofCol: m.rf, valley: vl, ov: 0.6, ovf: 0.5, ovb: 0, rows: 1.6 });
    K.parts.push(overlay((c) => {
      const fW = face([x - w / 2, yd, zs], [1, 0, 0], [0, 0, 1], [0, 0, w, 0, w, hWall, w / 2, hWall + hRoof - 0.2, 0, hWall], { wall: true, col: m.pl,
        paint: (c) => { gableDeco(c, m, w / 2, w / 2, hWall, hRoof - 0.2, {}); win(c, m, w / 2, 0.9, w * 0.48, hWall - 1.4, { noSill: true }); } });
      paintFaces(c, [fW], K.R);
      paintFaces(c, r.faces, K.R); paintLines(c, r.lines, m);
    }));
  }

  /* ============================================================== KEEP */
  // straight curtain wall (stacked): body + merlons along the outer edge ('n' | 's' | 'w' | 'e')
  function curtain(parts, m, x0, y0, x1, y1, H, outer, mh) {
    mh = mh || 3;
    parts.push(box(x0, y0, x1, y1, 0, H, m.stS, sh(m.stT, -0.06), { ao: 0.34, detail: (c) => {
      const horiz = outer === 'n' || outer === 's', segs = [];
      if (horiz) { segs.push(x0, (y0 + y1) / 2, x1, (y0 + y1) / 2); for (let x = x0 + 2.3; x < x1; x += 2.3) segs.push(x, y0 + 0.3, x, y1 - 0.3); }
      else { segs.push((x0 + x1) / 2, y0, (x0 + x1) / 2, y1); for (let y = y0 + 2.3; y < y1; y += 2.3) segs.push(x0 + 0.3, y, x1 - 0.3, y); }
      S.lines(c, 'rgba(50,38,28,0.28)', 0.22, segs);
    } }));
    parts.push({ z0: H, z1: H + mh, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => {
      const t = 1.4, horiz = outer === 'n' || outer === 's', L = horiz ? x1 - x0 : y1 - y0, n = Math.max(1, Math.round(L / 4.6)), st = L / n;
      for (let i = 0; i < n; i++) {
        const a = (horiz ? x0 : y0) + i * st + st * 0.2, w = st * 0.58;
        if (outer === 'n') c.rect(a, y0, w, t); else if (outer === 's') c.rect(a, y1 - t, w, t);
        else if (outer === 'w') c.rect(x0, a, t, w); else c.rect(x1 - t, a, t, w);
      }
    } });
  }
  // wall-face dressing for a curtain face at y = yF (u = x)
  function curtainFace(c, m, x0, x1, yF, H, o) {
    o = o || {};
    onFace(c, yF, (c) => {
      ashlar(c, x0, x1, 0, H, o.seed || 3);
      shadeBand(c, x0, x1, H, 1.2, 0.25);
      if (o.slits) for (let x = x0 + 4; x < x1 - 2; x += o.slits) { c.fillStyle = m.stL; c.fillRect(x - 0.7, H * 0.55 - 0.4, 1.4, 3.8); c.fillStyle = '#1e1612'; c.fillRect(x - 0.25, H * 0.55, 0.5, 3); }
    });
  }
  function keepL1(m) {
    const parts = [], K = { m, parts, R: 54 };
    const ground = ngon(26, 48, 0.1, 0, 2).map((v, i) => v * (1 + 0.05 * Math.sin(i * 1.7)) * (i % 2 ? 0.86 : 1));
    parts.push(pad(ground, mx(m.dirt, '#7a8a46', 0.35), m.dirtD, 'earth', 5));
    parts.push(overlay((c) => {
      castShadow(c, ground, [[-18, -24, 18, 6, 34], [-40, -22, -26, -12, 10]]);
      c.fillStyle = rgba(m.cob, 0.55); c.beginPath(); c.moveTo(-4, 4); c.lineTo(4, 4); c.lineTo(6, 44); c.lineTo(-6, 44); c.closePath(); c.fill();
    }));
    const ex = 44, ey = 38, cy0 = 3;
    const ring = [];
    for (let i = 0; i <= 48; i++) { const a = PI + (i / 48) * PI; ring.push(Math.cos(a) * ex, cy0 + Math.sin(a) * ey); }
    parts.push(...logParts(logLine(ring, 2.8, 10.5, 1.45, 11), 0, m.wd, m.wdL));
    // barn
    hall(K, { cx: -33, cy: -15, W: 14, D: 10, ze: 7, wall: 'wood', hr: 6, roof: 'gx', plinth: false, door: [0, 3.6, 5], seed: 3 });
    haystack(K, -22, -24, 4.2, 5);
    // the keep: stone donjon with a timber-framed top storey and a hipped roof
    const kp = hall(K, { cx: 0, cy: -10, W: 32, D: 26, ze: 31, upper: 24, jetty: 1.2, hr: 12, roof: 'hip', seed: 11,
      wins: [[-9, 9, 2.2, 4, { arch: true }], [9, 9, 2.2, 4, { arch: true }], [-9, 16.5, 2.2, 4, { arch: true }], [0, 16.5, 2.2, 4, { arch: true }], [-11, 26.5, 2.4, 2.8], [-3.5, 26.5, 2.4, 2.8], [4, 26.5, 2.4, 2.8], [11.5, 26.5, 2.4, 2.8]],
      deco: (c) => onFace(c, 3, (c) => { door(c, m, 0, 6.2, 3.6, 5.2, { lit: true }); banner(c, m, 9, 21, 3.4, 7.5, 0); }) });
    // timber stair up to the raised door
    parts.push(box(-2.6, 3, 2.6, 11, 0, 1.2, m.wd, m.pk), box(-2.6, 3, 2.6, 9, 1.2, 2.6, m.wd, m.pk), box(-2.6, 3, 2.6, 7, 2.6, 4, m.wd, m.pk), box(-2.6, 3, 2.6, 5, 4, 6.2, m.wd, m.pk));
    parts.push(overlay((c, an) => paintPole(c, m, -6, -10, kp.zr - 2, kp.zr + 9, 7, 4, an, { tail: true })));
    roundTower(K, { cx: 16.5, cy: 3.5, r: 4.4, zt: 37, roof: 'cone', ch: 10, wins: [[PI * 0.5, 12, 0, 3, { slit: true }], [PI * 0.45, 22, 0, 3, { slit: true }], [PI * 0.55, 30, 1.6, 2.6]], flag: [6, 6, 3.4] });
    well(K, -20, 18);
    barrels(K, [[22, 12, 1.5], [24.6, 13.5, 1.5]], 3.4);
    haystack(K, 27, 3, 4, 4.5);
    // front palisade with a timber gate
    const ringF = [];
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * PI; ringF.push(Math.cos(a) * ex, cy0 + Math.sin(a) * ey); }
    parts.push(...logParts(logLine(ringF, 2.8, 10.5, 1.45, 12, (x) => Math.abs(x) < 12), 0, m.wd, m.wdL));
    for (const sx of [-1, 1]) {
      hall(K, { cx: sx * 9, cy: 40, W: 7, D: 7, ze: 14, wall: 'wood', roof: 'hip', hr: 5, plinth: false, seed: 20 + sx,
        deco: (c) => onFace(c, 43.5, (c) => { c.fillStyle = '#1e1612'; c.fillRect(sx * 9 - 0.3, 9, 0.6, 2.6); }) });
    }
    parts.push(box(-5.5, 39, 5.5, 41, 0, 9.5, m.wd, m.wdL), box(-5.5, 37.5, 5.5, 42.5, 9.5, 10.6, m.wdD, m.wd));
    parts.push(overlay((c, an) => {
      onFace(c, 41, (c) => { planks(c, m, -5.5, 5.5, 0, 9.5); c.strokeStyle = m.iron; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-5.5, 2.5); c.lineTo(5.5, 2.5); c.moveTo(-5.5, 6.8); c.lineTo(5.5, 6.8); c.moveTo(0, 0); c.lineTo(0, 9.5); c.stroke(); });
      paintPole(c, m, 9, 40, 19, 25, 5, 3, an, { tail: true });
    }));
    return { r: 54, h: 58, parts, style: 'unit', bevel: 0.8 };
  }
  /* stone castle used by keep levels 2 and 3 */
  function castle(m, L) {
    const parts = [], R = L.R, K = { m, parts, R };
    const X = L.X, Yb = L.Yb, Yf = L.Yf, T = L.T, WH = L.WH, tr = L.tr;
    const court = rrP(-X + 1, Yb + 1, X - 1, Yf - 1, 6);
    parts.push(pad(court, m.cob, sh(m.cob, -0.3), 'flag', 7));
    parts.push(overlay((c) => castShadow(c, court, L.shadows)));
    // back wall (inner face visible) and back corner towers
    curtain(parts, m, -X, Yb, X, Yb + T, WH, 'n');
    parts.push(overlay((c) => curtainFace(c, m, -X, X, Yb + T, WH)));
    const flagT = (sx) => [L.flagH, 6.5, 3.6, sx];
    roundTower(K, { cx: -X, cy: Yb + 1, r: tr, zt: L.tz, roof: 'cone', ch: L.ch, wins: [[PI * 0.3, L.tz * 0.6, 0, 3.4, { slit: true }]], flag: flagT(1) });
    roundTower(K, { cx: X, cy: Yb + 1, r: tr, zt: L.tz, roof: 'cone', ch: L.ch, wins: [[PI * 0.7, L.tz * 0.6, 0, 3.4, { slit: true }]], flag: flagT(-1) });
    curtain(parts, m, -X, Yb + T, -X + T, Yf - T, WH, 'w');
    curtain(parts, m, X - T, Yb + T, X, Yf - T, WH, 'e');
    if (L.inner) L.inner(K);
    L.keep(K);
    // front wall + front towers + gatehouse
    const gw = L.gate.w;
    curtain(parts, m, -X, Yf - T, -gw, Yf, WH, 's');
    curtain(parts, m, gw, Yf - T, X, Yf, WH, 's');
    parts.push(overlay((c, an) => { curtainFace(c, m, -X, -gw, Yf, WH, { slits: 9 }); curtainFace(c, m, gw, X, Yf, WH, { slits: 9 }); if (L.wallBanners) onFace(c, Yf, (c) => { for (const x of L.wallBanners) banner(c, m, x, WH - 0.4, 3, 7, an); }); }));
    roundTower(K, { cx: -X, cy: Yf - 1, r: tr, zt: L.tz, roof: 'cone', ch: L.ch, wins: [[PI * 0.5, L.tz * 0.45, 0, 3.4, { slit: true, cross: true }], [PI * 0.42, L.tz * 0.75, 1.8, 3, {}]], flag: flagT(1) });
    roundTower(K, { cx: X, cy: Yf - 1, r: tr, zt: L.tz, roof: 'cone', ch: L.ch, wins: [[PI * 0.5, L.tz * 0.45, 0, 3.4, { slit: true, cross: true }], [PI * 0.58, L.tz * 0.75, 1.8, 3, {}]], flag: flagT(-1) });
    gatehouse(K, L.gate, Yf);
    return { r: R, h: L.H, parts, style: 'unit', bevel: 0.8 };
  }
  // gatehouse for the castle front: block with arch + two flanking round towers
  function gatehouse(K, G, Yf) {
    const m = K.m, parts = K.parts, w = G.w, yb = Yf - G.d, yf = Yf + 2;
    parts.push(box(-w, yb, w, yf, 0, G.h, m.stS, m.stT, { ao: 0.32 }));
    parts.push(...[]);
    crenRect(parts, m, -w - 0.6, yb, w + 0.6, yf + 0.6, 1.4, G.h, G.h + 0.6, G.h + 3.2, 2.2);
    parts.push(overlay((c, an) => onFace(c, yf, (c) => {
      ashlar(c, -w, w, 0, G.h, 9);
      const aw = G.aw, sz = G.ah - aw;
      c.fillStyle = m.stL; c.beginPath(); c.moveTo(-aw - 1.2, 0); c.lineTo(-aw - 1.2, sz); c.arc(0, sz, aw + 1.2, PI, 0, true); c.lineTo(aw + 1.2, 0); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(60,46,34,0.5)'; c.lineWidth = 0.22; c.beginPath(); for (let i = 0; i <= 8; i++) { const a = PI - (i / 8) * PI; c.moveTo(Math.cos(a) * aw, sz + Math.sin(a) * aw); c.lineTo(Math.cos(a) * (aw + 1.2), sz + Math.sin(a) * (aw + 1.2)); } c.stroke();
      c.fillStyle = '#1c1410'; c.beginPath(); c.moveTo(-aw, 0); c.lineTo(-aw, sz); c.arc(0, sz, aw, PI, 0, true); c.lineTo(aw, 0); c.closePath(); c.fill();
      if (G.portcullis) {
        const g = c.createLinearGradient(0, 0, 0, sz); g.addColorStop(0, rgba(m.gl, 0.55)); g.addColorStop(1, rgba(m.gl, 0)); c.fillStyle = g; c.fillRect(-aw, 0, aw * 2, sz);
        c.save(); c.beginPath(); c.moveTo(-aw, 0); c.lineTo(-aw, sz); c.arc(0, sz, aw, PI, 0, true); c.lineTo(aw, 0); c.closePath(); c.clip();
        c.strokeStyle = '#2c2a2a'; c.lineWidth = 0.42; c.beginPath(); for (let x = -aw + 0.8; x < aw; x += 1.25) { c.moveTo(x, 0); c.lineTo(x, sz + aw); } for (let z = 1; z < sz + aw; z += 1.6) { c.moveTo(-aw, z); c.lineTo(aw, z); } c.stroke();
        c.strokeStyle = 'rgba(160,150,140,0.45)'; c.lineWidth = 0.14; c.beginPath(); for (let x = -aw + 0.7; x < aw; x += 1.25) { c.moveTo(x, 0); c.lineTo(x, sz + aw); } c.stroke();
        c.restore();
      } else {
        c.fillStyle = m.wd; c.beginPath(); c.moveTo(-aw + 0.3, 0); c.lineTo(-aw + 0.3, sz); c.arc(0, sz, aw - 0.3, PI, 0, true); c.lineTo(aw - 0.3, 0); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(30,16,8,0.6)'; c.lineWidth = 0.22; c.beginPath(); for (let x = -aw + 1.1; x < aw; x += 1.1) { c.moveTo(x, 0); c.lineTo(x, sz + Math.sqrt(Math.max(0, aw * aw - x * x)) - 0.4); } c.stroke();
        c.strokeStyle = m.iron; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-aw, 1.8); c.lineTo(aw, 1.8); c.moveTo(-aw, sz * 0.75); c.lineTo(aw, sz * 0.75); c.moveTo(0, 0); c.lineTo(0, G.ah - 0.3); c.stroke();
      }
      if (G.banner) banner(c, m, 0, G.h - 0.5, 3.2, G.h - G.ah - 1.6, an);
      shadeBand(c, -w, w, G.h, 1.2, 0.25);
    })));
    for (const sx of [-1, 1]) roundTower(K, { cx: sx * G.tx, cy: yf - G.tr * 0.4, r: G.tr, zt: G.tz, roof: 'cone', ch: G.ch, wins: [[PI * (0.5 - sx * 0.1), G.tz * 0.4, 0, 3, { slit: true, cross: true }], [PI * (0.5 + sx * 0.12), G.tz * 0.72, 1.6, 2.8, {}]], flag: G.flag ? [G.flag, 5.5, 3.2, sx] : null });
  }
  // square donjon with a crenellated parapet, inner hipped roof and corner bartizans
  function donjon(K, D) {
    const m = K.m, parts = K.parts;
    const x0 = D.cx - D.W / 2, x1 = D.cx + D.W / 2, y0 = D.cy - D.D / 2, y1 = D.cy + D.D / 2, H = D.H;
    parts.push(box(x0 - 0.8, y0 - 0.8, x1 + 0.8, y1 + 0.8, 0, 1.6, m.stD, mx(m.stD, m.stS, 0.5), { ao: 0.2 }));
    parts.push(box(x0, y0, x1, y1, 0, H, m.stS, m.stT, { ao: 0.34 }));
    parts.push(overlay((c, an) => onFace(c, y1, (c) => {
      ashlar(c, x0, x1, 0, H, D.seed || 13); quoins(c, x0, x1, 0, H);
      for (const w of D.wins) win(c, m, w[0], w[1], w[2], w[3], Object.assign({ stone: true, arch: true }, w[4] || {}));
      if (D.door) door(c, m, D.cx, 0, D.door[0], D.door[1], { lit: true });
      for (const b of D.banners || []) banner(c, m, b[0], b[1], b[2], b[3], an);
      // string course under the parapet
      c.fillStyle = m.stT; c.fillRect(x0 - 0.4, H - 1.4, x1 - x0 + 0.8, 0.7); c.fillStyle = 'rgba(30,20,12,0.3)'; c.fillRect(x0 - 0.4, H - 1.9, x1 - x0 + 0.8, 0.5);
    })));
    // parapet: corbelled ledge, back + sides first, inner roof, then the front run
    const t = 1.5, e = 0.9, px0 = x0 - e, px1 = x1 + e, py0 = y0 - e, py1 = y1 + e;
    parts.push(box(px0, py0, px1, py1, H, H + 0.8, m.stT, mx(m.stT, m.stS, 0.4), { ao: 0 }));
    const back = (c) => { c.rect(px0, py0, px1 - px0, t); c.rect(px0, py0, t, py1 - py0); c.rect(px1 - t, py0, t, py1 - py0); };
    const merl = (c, ax, ay, bx, by, nx, ny) => { const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / 4.4)), st = L / n, ux = (bx - ax) / L, uy = (by - ay) / L; for (let i = 0; i < n; i++) { const s0 = i * st + st * 0.2, s1 = s0 + st * 0.6; S.poly(c, [ax + ux * s0, ay + uy * s0, ax + ux * s1, ay + uy * s1, ax + ux * s1 + nx * t, ay + uy * s1 + ny * t, ax + ux * s0 + nx * t, ay + uy * s0 + ny * t]); } };
    parts.push({ z0: H + 0.8, z1: H + 2.4, side: m.stS, top: m.stT, ao: 0.15, shape: back });
    parts.push({ z0: H + 2.4, z1: H + 5, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => { merl(c, px0, py0, px1, py0, 0, 1); merl(c, px0, py0 + t, px0, py1, 1, 0); merl(c, px1 - t, py0 + t, px1 - t, py1, 1, 0); } });
    const bz = [[px0 + 0.8, py0 + 0.8], [px1 - 0.8, py0 + 0.8], [px0 + 0.8, py1 - 0.8], [px1 - 0.8, py1 - 0.8]];
    const bart = (list) => {
      for (const b of list) {
        parts.push({ z0: H - 6, z1: H + D.bz, side: m.stS, top: m.stT, ao: 0.25, shape: (c, tt) => { const z = H - 6 + tt * (D.bz + 6); S.circ(c, b[0], b[1], z < H - 3 ? D.br * (0.55 + 0.45 * (z - H + 6) / 3) : D.br); } });
        parts.push(overlay((c, an) => { cylDeco(c, m, b[0], b[1], D.br, H - 3, H + D.bz, { plain: true }); cylWin(c, m, b[0], b[1], D.br, PI * 0.5, H + 1.5, 0, 2.4, { slit: true }); paintCone(c, m, b[0], b[1], D.br + 0.9, H + D.bz - 0.4, D.bch, { finial: !D.bflag }); if (D.bflag) paintPole(c, m, b[0], b[1], H + D.bz + D.bch - 1, H + D.bz + D.bch + 6, 4.5, 2.6, an, { tail: true, dir: b[0] < D.cx ? -1 : 1 }); }));
      }
    };
    bart(bz.slice(0, 2));
    // inner hipped roof, optionally pierced by a central tower
    const rr = roofGX(D.cx, D.cy, D.W - 1, D.D - 1, H + 1.5, D.hr, { hip: true, ov: 0, roofCol: m.rf });
    parts.push(overlay((c, an) => { paintFaces(c, rr.faces, K.R); paintLines(c, rr.lines, m); if (D.flag && !D.upper) paintPole(c, m, D.cx + 2, D.cy, rr.zr - 0.5, rr.zr + D.flag, 7, 4, an, { tail: true }); }));
    if (D.upper) {
      const U2 = D.upper, uf = U2.cy + U2.D / 2;
      hall(K, { cx: D.cx, cy: U2.cy, W: U2.W, D: U2.D, z0: rr.zAt(D.cx, uf) - 0.5, ze: U2.ze, roof: 'hip', hr: U2.hr, plinth: false, seed: 17, ro: { ov: 1.2 }, wins: U2.wins,
        deco: (c, an) => onFace(c, uf, (c) => { c.fillStyle = m.stT; c.fillRect(D.cx - U2.W / 2, U2.ze - 1.6, U2.W, 0.7); for (const b of U2.banners || []) banner(c, m, b[0], b[1], b[2], b[3], an); }) });
      if (U2.flag) parts.push(overlay((c, an) => paintPole(c, m, D.cx, U2.cy, U2.ze + U2.hr - 1.5, U2.ze + U2.hr + U2.flag, 8, 4.6, an, { tail: true })));
    }
    parts.push({ z0: H + 0.8, z1: H + 2.4, side: m.stS, top: m.stT, ao: 0.15, shape: (c) => c.rect(px0, py1 - t, px1 - px0, t) });
    parts.push({ z0: H + 2.4, z1: H + 5, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => merl(c, px0, py1 - t, px1, py1 - t, 0, 1) });
    bart(bz.slice(2));
  }
  M.human_keep = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), lv = U.clamp((opt.level | 0) || 1, 1, 3);
    if (lv === 1) return keepL1(m);
    if (lv === 2) return castle(m, { R: 60, H: 70, X: 46, Yb: -46, Yf: 38, T: 6, WH: 13, tr: 7.5, tz: 25, ch: 14, flagH: 8,
      shadows: [[-19, -28, 19, 2, 30], [-38, -36, -20, -20, 10]],
      gate: { w: 8, d: 8, h: 15, aw: 3.6, ah: 9, tx: 9.5, tr: 5.6, tz: 19, ch: 9.5, flag: 6 },
      inner: (K) => {
        hall(K, { cx: -30, cy: -28, W: 18, D: 12, ze: 10, upper: 5, hr: 7, roof: 'hip', plinth: false, seed: 31, wins: [[-35, 6.6, 2, 2.4], [-30, 6.6, 2, 2.4], [-25, 6.6, 2, 2.4]], door: [-30, 2.6, 4.2] });
        hall(K, { cx: 30, cy: -27, W: 16, D: 12, ze: 8, wall: 'wood', hr: 6, roof: 'hip', plinth: false, seed: 32, door: [26, 3.4, 5], wins: [[33, 3, 2.2, 2]] });
        haystack(K, 24, -12, 3.6, 4);
        barrels(K, [[-34, -12, 1.5], [-31.4, -11, 1.5]], 3.4);
        well(K, -28, 14);
      },
      keep: (K) => donjon(K, { cx: 0, cy: -14, W: 36, D: 28, H: 30, hr: 11, seed: 21, bz: 4.5, br: 2.6, bch: 6, flag: 10,
        wins: [[-10, 8, 2.4, 4.4], [10, 8, 2.4, 4.4], [-10, 18, 2.4, 4.4], [0, 18, 2.4, 4.4], [10, 18, 2.4, 4.4]], door: [4.4, 6.8], banners: [[-5, 27, 3.2, 8], [5, 27, 3.2, 8]] }),
      wallBanners: [-24, 24] });
    return castle(m, { R: 68, H: 84, X: 53, Yb: -54, Yf: 44, T: 7, WH: 15, tr: 9.5, tz: 32, ch: 17, flagH: 9,
      shadows: [[-22, -34, 22, 4, 40], [-48, -42, -26, -18, 14], [26, -40, 44, -20, 18]],
      gate: { w: 9, d: 9, h: 18, aw: 4.2, ah: 11, tx: 11, tr: 7, tz: 25, ch: 12, flag: 7, portcullis: true, banner: true },
      inner: (K) => {
        hall(K, { cx: -36, cy: -30, W: 20, D: 20, ze: 14, roof: 'gy', hr: 9, plinth: false, seed: 41, gable: 'stone', gd: { oculus: 1.4 }, wins: [[-41, 3, 2, 5, { arch: true }], [-31, 3, 2, 5, { arch: true }]], door: [-36, 3.4, 6.4, { lit: true }] });
        hall(K, { cx: 35, cy: -30, W: 18, D: 18, ze: 9, upper: 4.8, jetty: 0.7, hr: 8.5, roof: 'gy', plinth: false, seed: 42, door: [31, 2.8, 4.2], wins: [[39, 2, 2, 2.2], [31, 6, 2, 2.2], [39, 6, 2, 2.2]], gd: { attic: [1.6, 2.2] } });
        barrels(K, [[-44, -12, 1.5], [-41.4, -11, 1.5], [44, -12, 1.5]], 3.4);
        crates(K, [[40, -9, 2.6, 2.4]]);
        well(K, -32, 18);
      },
      keep: (K) => donjon(K, { cx: 0, cy: -16, W: 42, D: 32, H: 34, hr: 11, seed: 23, bz: 7, br: 3.4, bch: 8, bflag: true,
        upper: { cy: -17, W: 18, D: 15, ze: 60, hr: 10, flag: 10, wins: [[-4.5, 52, 2.2, 3.4, { arch: true }], [4.5, 52, 2.2, 3.4, { arch: true }]], banners: [[0, 57.5, 2.6, 6]] },
        wins: [[-13, 9, 2.6, 5], [13, 9, 2.6, 5], [-13, 20, 2.6, 5], [-4.5, 20, 2.6, 5], [4.5, 20, 2.6, 5], [13, 20, 2.6, 5]], door: [5, 8], banners: [[-8.5, 31, 3.6, 9], [8.5, 31, 3.6, 9]] }),
      wallBanners: [-31, 31] });
  };

  /* ============================================================ BARRACKS */
  M.human_barracks = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 32 };
    const yard = rrP(-28, -6, 28, 27, 3);
    parts.push(pad(yard, mx(m.dirt, '#a08a60', 0.3), m.dirtD, 'earth', 9));
    parts.push(overlay((c) => castShadow(c, yard, [[-24, -26, 24, -6, 24]])));
    // long two-storey troop hall
    const h = hall(K, { cx: 0, cy: -16, W: 46, D: 18, ze: 14, upper: 7.5, jetty: 0.8, hr: 9, roof: 'hip', seed: 51, frame: { pat: 'k' },
      wins: [[-18, 2.6, 2.4, 3], [-11, 2.6, 2.4, 3], [11, 2.6, 2.4, 3], [18, 2.6, 2.4, 3], [-18, 9.6, 2.2, 2.6], [-11, 9.6, 2.2, 2.6], [11, 9.6, 2.2, 2.6], [18, 9.6, 2.2, 2.6]],
      chim: [[-15, -19, 3], [15, -19, 3]] });
    // gabled entrance porch with banners
    hall(K, { cx: 0, cy: -4.5, W: 12, D: 5, ze: 14, upper: 7.5, jetty: 0.4, hr: 7, plinth: false, clip: behind(h.roof, -7), ro: { valley: h.roof.valley, ovb: 0 }, seed: 52, frame: { pat: 'x', sp: 3 },
      door: [0, 3.6, 6, { lit: true }], gd: { oculus: 0.9 }, deco: (c, an) => onFace(c, -1.6, (c) => { banner(c, m, -4, 13.4, 2.4, 5, an); banner(c, m, 4, 13.4, 2.4, 5, an); }) });
    // low yard wall
    const wl = [[-28, -6, -26.2, 27], [26.2, -6, 28, 27], [-28, 25.2, -6, 27], [6, 25.2, 28, 27]];
    parts.push({ z0: 0, z1: 3.4, side: m.stS, top: m.stT, ao: 0.3, shape: (c) => { for (const q of wl) c.rect(q[0], q[1], q[2] - q[0], q[3] - q[1]); } });
    parts.push(overlay((c) => { onFace(c, 27, (c) => { ashlar(c, -28, -6, 0, 3.4, 4, { ch: 1.7 }); ashlar(c, 6, 28, 0, 3.4, 5, { ch: 1.7 }); }); }));
    // sparring ring: rope on four posts around a sanded circle
    parts.push(overlay((c) => { c.fillStyle = 'rgba(236,214,160,0.45)'; c.beginPath(); c.ellipse(0, 10.5, 8, 5.8, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(120,90,50,0.5)'; c.lineWidth = 0.3; c.beginPath(); c.ellipse(0, 10.5, 8, 5.8, 0, 0, TAU); c.stroke(); }));
    const rp = [[-6.5, 5.5], [6.5, 5.5]];
    parts.push(beams(rp.map((q) => [q[0], q[1], 0, q[0], q[1], 4.2]).concat([[-6.5, 5.5, 3.4, 6.5, 5.5, 3.4], [-6.5, 5.5, 3.4, -6.5, 15.5, 3.4], [6.5, 5.5, 3.4, 6.5, 15.5, 3.4]]), 0.5, 0.4, m.wdD, m.wd));
    parts.push(beams([[-6.5, 15.5, 0, -6.5, 15.5, 4.2], [6.5, 15.5, 0, 6.5, 15.5, 4.2], [-6.5, 15.5, 3.4, 6.5, 15.5, 3.4]], 0.5, 0.4, m.wdD, m.wd));
    // weapon racks (left): A-frames with spears and shields
    const rack = [];
    for (const ry of [4, 15]) rack.push([-23.5, ry, 0, -23.5, ry, 5.6], [-16.5, ry, 0, -16.5, ry, 5.6], [-24, ry, 4.6, -16, ry, 4.6], [-24, ry, 1.6, -16, ry, 1.6]);
    parts.push(beams(rack, 0.65, 0.55, m.wdD, m.wd));
    const spears = [];
    for (const ry of [4, 15]) for (let i = 0; i < 6; i++) { const x = -22.8 + i * 1.15; spears.push([x, ry - 0.9, 0.2, x + 0.15, ry + 0.5, 10]); }
    parts.push(beams(spears, 0.34, 0.3, m.wd, m.wdL));
    parts.push(overlay((c) => {
      for (const ry of [4, 15]) for (let i = 0; i < 6; i++) { const x = -22.8 + i * 1.15 + 0.15, y = ry + 0.5 - 10; S.fillPoly(c, '#d8d4cc', [x - 0.42, y + 0.2, x + 0.42, y + 0.2, x, y - 1.8]); S.fillPoly(c, '#8a8680', [x, y + 0.2, x + 0.42, y + 0.2, x, y - 1.8]); }
      for (const [sx, ry] of [[-25.2, 4], [-14.8, 15]]) onFace(c, ry + 0.6, (c) => { c.fillStyle = m.k; c.beginPath(); c.moveTo(sx - 1.5, 5); c.lineTo(sx + 1.5, 5); c.lineTo(sx + 1.5, 3); c.quadraticCurveTo(sx + 1.3, 1.2, sx, 0.4); c.quadraticCurveTo(sx - 1.3, 1.2, sx - 1.5, 3); c.closePath(); c.fill(); c.strokeStyle = m.k2; c.lineWidth = 0.35; c.stroke(); c.fillStyle = m.k2; c.fillRect(sx - 0.25, 0.9, 0.5, 3.7); c.fillRect(sx - 1.2, 3.1, 2.4, 0.5); });
    }));
    // training dummies + archery target (right)
    const dum = [[14, 4], [21, 9], [15, 16]];
    parts.push(beams(dum.map((d) => [d[0], d[1], 0, d[0], d[1], 9]).concat(dum.map((d) => [d[0] - 2.8, d[1], 7, d[0] + 2.8, d[1], 7])), 0.6, 0.55, m.wdD, m.wd));
    parts.push({ z0: 3.4, z1: 8, side: m.straw, top: sh(m.straw, 0.2), ao: 0.3, shape: (c, t) => { for (const d of dum) S.circ(c, d[0], d[1], 1.9 - Math.abs(t - 0.45) * 0.9); } });
    parts.push({ z0: 8, z1: 10, side: m.straw, top: sh(m.straw, 0.25), ao: 0.15, shape: (c, t) => { for (const d of dum) S.circ(c, d[0], d[1], 1.2 * Math.sqrt(Math.max(0.05, 1 - t * t))); } });
    parts.push(overlay((c) => { for (const d of dum) { c.strokeStyle = m.k; c.lineWidth = 0.55; c.beginPath(); c.moveTo(d[0] - 1.8, d[1] - 6); c.lineTo(d[0] + 1.8, d[1] - 6); c.stroke(); c.strokeStyle = m.strawD; c.lineWidth = 0.3; c.beginPath(); c.moveTo(d[0] - 1.4, d[1] - 4.6); c.lineTo(d[0] + 1.4, d[1] - 4.6); c.stroke(); } }));
    parts.push(beams([[22, -1, 0, 22.8, -1.8, 7.6], [27, -1, 0, 26.2, -1.8, 7.6], [24.5, -3.4, 0, 24.5, -2.2, 6.4]], 0.55, 0.5, m.wdD, m.wd));
    parts.push(overlay((c) => { const x = 24.5, y = -1.4 - 7; for (const [r, col] of [[3.4, m.strawD], [3.0, '#f0ead8'], [2.2, m.k], [1.3, '#f0ead8'], [0.6, m.k2]]) S.dot(c, col, x, y, r); seg2(c, [x + 0.6, y - 0.4], [x + 2.4, y - 1.4], m.wdD, 0.25); seg2(c, [x - 0.8, y + 0.8], [x - 2.6, y + 0.2], m.wdD, 0.25); }));
    // banner poles at the yard gate
    parts.push(overlay((c, an) => { paintPole(c, m, -7.5, 26, 0, 11, 5, 3, an, { tail: true, dir: -1 }); paintPole(c, m, 7.5, 26, 0, 11, 5, 3, an, { tail: true }); }));
    return { r: 32, h: 38, parts, style: 'unit', bevel: 0.8 };
  };

  /* ================================================================ FARM */
  M.human_farm = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 32 };
    const yard = rrP(-28, -24, 29, 26, 5);
    parts.push(pad(yard, mx(m.dirt, '#8a9a50', 0.35), m.dirtD, 'earth', 13));
    parts.push(overlay((c) => castShadow(c, yard, [[-2, -22, 24, 4, 22], [-27, -22, -15, -12, 12], [-25, 2, -7, 18, 18]])));
    // granary: round, on stone base, thatched cone
    roundTower(K, { cx: -21, cy: -17, r: 5.2, zt: 9, roof: 'cone', ch: 8, ov: 1.6, coneCol: '#c9a24e', coneRows: 1.3, finial: false, wins: [[PI * 0.5, 1.4, 2, 3.4, { door: true, col: m.wd }]] });
    // big barn, gable to the front
    hall(K, { cx: 11, cy: -9, W: 22, D: 24, ze: 10, wall: 'wood', hr: 11, seed: 61, ro: { ov: 1.5 },
      deco: (c) => onFace(c, 3, (c) => {
        c.fillStyle = '#2a1c12'; c.fillRect(11 - 4.5, 0, 9, 8);
        c.fillStyle = m.strawD; c.fillRect(11 - 4, 0, 8, 2.2);
        c.strokeStyle = sh(m.pk, 0.3); c.lineWidth = 0.5; for (const sx of [-1, 1]) { const x0 = 11 + sx * 4.5, x1 = 11 + sx * 7.5; c.strokeRect(Math.min(x0, x1), 0, 3, 8); c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, 8); c.moveTo(x0, 8); c.lineTo(x1, 0); c.stroke(); }
        c.fillStyle = '#2a1c12'; c.fillRect(11 - 1.6, 12, 3.2, 3.2); c.fillStyle = m.straw; c.fillRect(11 - 1.6, 12, 3.2, 1);
      }) });
    // farmhouse
    hall(K, { cx: -16, cy: 10, W: 16, D: 14, ze: 11, upper: 6, jetty: 0.7, hr: 8.5, roof: 'gy', seed: 62, door: [-19, 3, 5], wins: [[-12.5, 2.4, 2.2, 2.4, { shut: m.k }], [-16, 7.6, 2, 2.2, { box: true }]], frame: { pat: 'v', sp: 3.2 }, chim: [[-20, 6, 2.6]] });
    // kitchen garden: furrowed rows of greens
    parts.push({ z0: 0, z1: 0.8, side: m.dirtD, top: mx(m.dirt, '#5a4630', 0.35), ao: 0.2, shape: (c) => c.rect(-2, 6, 14, 12), detail: (c) => {
      for (let r = 0; r < 5; r++) { const y = 7.4 + r * 2.3; S.lines(c, 'rgba(40,28,16,0.45)', 0.4, [-1.4, y + 0.9, 11.4, y + 0.9]); for (let x = -0.8; x < 11.6; x += 1.3) { const k = U.hash2(Math.round(x * 3), r, 5); S.dot(c, k > 0.75 ? '#e88a30' : r % 2 ? '#5f9a3a' : '#7ab448', x + (r % 2) * 0.6, y, k > 0.75 ? 0.55 : 0.62); } }
    } });
    haystack(K, 25, 9, 4.2, 5.4);
    haystack(K, 21, 15.5, 3.2, 4.2);
    // hay bales + cart wheel + fence corner
    parts.push({ z0: 0, z1: 2.2, side: m.straw, top: sh(m.straw, 0.2), ao: 0.25, shape: (c) => { c.rect(14, 19, 4, 2.4); c.rect(18.4, 19, 4, 2.4); }, detail: (c) => S.lines(c, 'rgba(120,86,30,0.6)', 0.25, [15.3, 19, 15.3, 21.4, 16.7, 19, 16.7, 21.4, 19.7, 19, 19.7, 21.4, 21.1, 19, 21.1, 21.4]) });
    parts.push(...fence([-28, 24, -4, 24.5, 12, 24, 29, 24, 29, 4], 3.6, m));
    barrels(K, [[-4.5, 12, 1.4]], 3.2);
    return { r: 32, h: 26, parts, style: 'unit', bevel: 0.8 };
  };

  /* ============================================================== STABLE */
  M.human_stable = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 32 };
    const yard = rrP(-30, -16, 30, 24, 4);
    parts.push(pad(yard, mx(m.dirt, '#9a8656', 0.4), m.dirtD, 'earth', 21));
    parts.push(overlay((c) => { castShadow(c, yard, [[-26, -16, 26, -1, 17]]); c.fillStyle = 'rgba(214,180,90,0.35)'; for (let i = 0; i < 18; i++) { const h1 = U.hash2(i, 4, 9), h2 = U.hash2(i, 5, 9); c.fillRect(-24 + h1 * 48, 0.5 + h2 * 4, 1.4, 0.3); } }));
    const W = 50, fy = -1.5, cx = 0;
    const h = hall(K, { cx, cy: -9, W, D: 15, ze: 9.5, wall: 'wood', hr: 7.5, roof: 'hip', seed: 71, ro: { ov: 1.1 },
      deco: (c) => onFace(c, fy, (c) => {
        c.fillStyle = m.wdD; c.fillRect(cx - W / 2, 6.4, W, 0.8);
        for (let i = 0; i < 6; i++) {
          if (i === 2 || i === 3) continue;
          const x = cx - W / 2 + 4.6 + i * 8.16;
          c.fillStyle = '#1e140c'; c.fillRect(x - 2.4, 0, 4.8, 6);
          c.fillStyle = m.pkD; c.fillRect(x - 2.4, 0, 4.8, 3.1); c.strokeStyle = sh(m.pk, 0.3); c.lineWidth = 0.35; c.strokeRect(x - 2.4, 0, 4.8, 3.1); c.beginPath(); c.moveTo(x - 2.4, 0); c.lineTo(x + 2.4, 3.1); c.stroke();
          if (i !== 1) {
            const col = ['#7a4a2a', '', '', '', '#d6c8b0', '#3a2a22'][i];
            c.fillStyle = col; c.beginPath(); c.moveTo(x - 0.9, 3.1); c.lineTo(x + 0.9, 3.1); c.lineTo(x + 1.1, 5.0); c.quadraticCurveTo(x + 0.3, 6.1, x - 0.7, 5.6); c.lineTo(x - 1.2, 4.2); c.closePath(); c.fill();
            c.fillStyle = i === 4 ? '#8a7a68' : '#2a1a10'; c.fillRect(x - 0.9, 5.2, 0.5, 0.9);
            S.dot(c, '#100804', x + 0.1, 4.9, 0.18);
          }
        }
      }) });
    // central cross-gable with the hay loft door over the wide carriage entry
    hall(K, { cx, cy: 0.5, W: 13, D: 4, ze: 9.5, wall: 'wood', hr: 6.5, plinth: false, clip: behind(h.roof, fy), ro: { valley: h.roof.valley, ovb: 0 }, seed: 72,
      deco: (c) => onFace(c, 2.5, (c) => {
        c.fillStyle = '#1e140c'; c.fillRect(-4, 0, 8, 7.4); c.fillStyle = m.strawD; c.fillRect(-3.6, 0, 7.2, 1.6);
        c.strokeStyle = sh(m.pk, 0.3); c.lineWidth = 0.45; c.strokeRect(-4, 0, 8, 7.4);
        c.fillStyle = '#1e140c'; c.fillRect(-1.5, 10, 3, 2.8); c.fillStyle = m.straw; c.fillRect(-1.5, 10, 3, 0.9); c.fillStyle = m.wdD; c.fillRect(-0.3, 12.8, 0.6, 2);
      }) });
    // water trough + hay
    parts.push(box(-20, 2.5, -11, 4.9, 0, 2.2, m.wd, m.wd, { detail: (c) => { c.beginPath(); c.fillStyle = m.water; c.rect(-19.5, 3, 8, 1.4); c.fill(); c.beginPath(); c.fillStyle = 'rgba(255,255,255,0.45)'; c.rect(-18.5, 3.2, 3, 0.35); c.fill(); } }));
    haystack(K, -25, 12, 4, 5);
    parts.push({ z0: 0, z1: 2.2, side: m.straw, top: sh(m.straw, 0.2), ao: 0.25, shape: (c) => { c.rect(14, 8, 4, 2.4); c.rect(18.4, 8, 4, 2.4); c.rect(16.2, 11, 4, 2.4); }, detail: (c) => S.lines(c, 'rgba(120,86,30,0.6)', 0.25, [15.3, 8, 15.3, 10.4, 16.7, 8, 16.7, 10.4, 19.7, 8, 19.7, 10.4, 21.1, 8, 21.1, 10.4]) });
    // paddock fence (front right) + saddle rail
    parts.push(...fence([6, 23, 18, 23, 29, 23, 29, 13, 29, 3], 4, m));
    parts.push(...fence([-29, 18, -29, 23, -14, 23], 4, m));
    parts.push(overlay((c, an) => {
      onFace(c, 23, (c) => { for (const x of [10, 13.5]) { c.fillStyle = '#6a3a1e'; c.beginPath(); c.moveTo(x - 1.3, 3.6); c.quadraticCurveTo(x, 4.6, x + 1.3, 3.6); c.lineTo(x + 1.1, 2.2); c.lineTo(x - 1.1, 2.2); c.closePath(); c.fill(); c.fillStyle = m.k; c.fillRect(x - 1.1, 2.2, 2.2, 0.5); } });
      paintPole(c, m, -27.5, 2, 0, 14, 5.5, 3.2, an, { tail: true });
    }));
    return { r: 32, h: 24, parts, style: 'unit', bevel: 0.8 };
  };

  /* ======================================================= ARCHER TOWER */
  M.human_tower = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 17 };
    // stair turret behind the right shoulder
    roundTower(K, { cx: 8.2, cy: -5, r: 3.8, zt: 54, roof: 'cone', ch: 9.5, ov: 1, plinth: false, wins: [[PI * 0.25, 46, 0, 2.6, { slit: true }]] });
    roundTower(K, { cx: 0, cy: 0, r: 9.2, batter: 1.2, zt: 44, roof: 'crenel', ov: 1.6, merlons: 9,
      wins: [[PI * 0.5, 1.2, 3, 5.2, { door: true }], [PI * 0.32, 13, 0, 4.2, { slit: true, cross: true }], [PI * 0.7, 23, 0, 4.2, { slit: true, cross: true }], [PI * 0.62, 34, 1.8, 3, {}]],
      deco: (c, an) => {
        for (const z of [16, 31]) { c.strokeStyle = m.stT; c.lineWidth = 0.9; c.beginPath(); c.arc(0, -z, 9.9, 0.05, PI - 0.05); c.stroke(); c.strokeStyle = 'rgba(30,20,12,0.35)'; c.lineWidth = 0.5; c.beginPath(); c.arc(0, -z + 0.7, 9.85, 0.05, PI - 0.05); c.stroke(); }
        onFaceAt(c, Math.cos(PI * 0.42) * 9.6, Math.sin(PI * 0.42) * 9.6, Math.sin(PI * 0.42), -Math.cos(PI * 0.42), (c) => banner(c, m, 0, 41, 3, 7.5, an));
      } });
    // platform kit: brazier and flag mast
    parts.push(cyl(-3.4, -3.6, 1.4, 44.8, 46.6, m.iron, '#2a2522', { detail: (c) => S.dot(c, '#ffb040', -3.4, -3.6, 1) }));
    parts.push(overlay((c, an) => {
      glow(c, '#ffa030', -3.4, -3.6 - 47.4, 4.2, 0.85);
      for (let i = 0; i < 3; i++) { const a = an * TAU + i * 2.1; S.fillPoly(c, i === 1 ? '#ffe9a0' : '#ff9a30', [-4.4 + i, -3.6 - 46.6, -3.4 + i * 0.4 - 0.4 + Math.sin(a) * 0.3, -3.6 - 49.4 - (i === 1 ? 1 : 0), -2.6 + i * 0.2 - 0.4, -3.6 - 46.6]); }
      paintPole(c, m, 3.8, -4.2, 44.8, 60, 6.5, 3.6, an, { tail: true });
    }));
    return { r: 17, h: 66, parts, style: 'unit', bevel: 0.8 };
  };

  /* ================================================================ WALL (16 dirs) */
  M.human_wall = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), lv = U.clamp((opt.level | 0) || 2, 1, 3), parts = [];
    const L = 20;
    if (lv === 1) {
      // timber palisade on an earth bank: sharpened logs, two binding rails, walkway braces
      parts.push({ z0: 0, z1: 1.8, side: m.dirtD, top: mx(m.dirt, '#7a8a46', 0.3), ao: 0.3, shape: (c, t) => S.rrect(c, -L, -4.2 + t * 0.8, L * 2, 8.4 - t * 1.6, 1.5) });
      const logs = [];
      for (let i = 0; i < 14; i++) { const x = -L + 1.43 + i * (L * 2 - 2.86) / 13; logs.push([x, (U.hash2(i, 3, 7) - 0.5) * 0.4, 13.2 + U.hash2(i, 5, 7) * 1.8, 1.42 + U.hash2(i, 9, 7) * 0.12]); }
      parts.push(...logParts(logs, 1.2, m.wd, m.wdL));
      // binding rails: only the camera-facing side is drawn over the logs
      for (const z of [4.2, 9.6]) parts.push({ z0: z, z1: z + 0.9, side: m.wdD, top: m.wd, ao: 0, bevel: false, shape: (c) => { for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) c.rect(-L, sg > 0 ? 1.45 : -1.95, L * 2, 0.5); } });
      return { r: 22, h: 16, parts, style: 'unit', bevel: 0.7 };
    }
    const T = lv === 3 ? 4.0 : 3.5, Hw = lv === 3 ? 14.5 : 12.5, mz = Hw + 1.2;
    parts.push({ z0: 0, z1: 2, side: sh(m.stD, -0.08), top: mx(m.stD, m.stS, 0.4), ao: 0.2, shape: (c, t) => c.rect(-L, -T - 1.1 + t * 0.3, L * 2, (T + 1.1 - t * 0.3) * 2) });
    const pil = lv === 3 ? [-13.3, 0, 13.3] : [];
    parts.push({ z0: 2, z1: Hw, side: m.stS, top: m.stT, ao: 0.32, shape: (c) => { c.rect(-L, -T, L * 2, T * 2); for (const x of pil) c.rect(x - 1.7, -T - 1.1, 3.4, (T + 1.1) * 2); } });
    // ashlar texture on the camera-facing faces (and pilaster fronts)
    const tf = [];
    if (!pil.length) tf.push([-L, L, T, 1], [-L, L, -T, -1]);
    else { let xa = -L; for (const x of pil) { tf.push([xa, x - 1.7, T, 1], [xa, x - 1.7, -T, -1], [x - 1.7, x + 1.7, T + 1.1, 1], [x - 1.7, x + 1.7, -T - 1.1, -1]); xa = x + 1.7; } tf.push([xa, L, T, 1], [xa, L, -T, -1]); }
    parts.push(...wallTex(tf, 2, Hw, m));
    // corbelled string course + wall walk
    parts.push({ z0: Hw, z1: mz, side: m.stT, top: mx(m.stT, m.stS, 0.35), ao: 0, shape: (c) => c.rect(-L, -T - 0.7, L * 2, (T + 0.7) * 2),
      detail: (c) => { S.lines(c, 'rgba(40,30,22,0.3)', 0.24, [-L, 0, L, 0]); for (let x = -L + 2.5; x < L; x += 5) S.lines(c, 'rgba(40,30,22,0.25)', 0.22, [x, -T + 1, x, T - 1]); } });
    // merlons both sides
    const MZ = mz + (lv === 3 ? 3.4 : 3);
    parts.push({ z0: mz, z1: MZ, side: m.stS, top: m.stT, ao: 0.12, shape: (c) => {
      for (let i = 0; i < 8; i++) { const x = -L + 2.5 + i * 5; for (const sg of [1, -1]) c.rect(x - 1.35, sg > 0 ? T - 0.9 : -T - 0.7, 2.7, 1.6); }
    } });
    if (lv === 3) {
      // gilded ward runes on the pilasters + hanging banner on the centre pilaster
      parts.push({ z0: 6, z1: 9, side: m.gl, top: m.gl, flat: true, bevel: false, shape: (c, zt) => {
        const w = 0.9 * (1 - Math.abs(zt * 2 - 1)) + 0.15;
        for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) for (const x of [-13.3, 13.3]) c.rect(x - w, sg > 0 ? T + 1.05 : -T - 1.35, w * 2, 0.3);
      } });
      parts.push({ z0: 3.5, z1: Hw - 0.5, side: m.k, top: m.k, ao: 0.3, bevel: false, shape: (c, zt) => {
        const z = 3.5 + zt * (Hw - 4), w = z < 5 ? 1.35 * (z - 3.5) / 1.5 : 1.35;
        for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) c.rect(-w, sg > 0 ? T + 1.05 : -T - 1.45, w * 2, 0.4);
      } });
      parts.push({ z0: 8.5, z1: 9.6, side: m.k2, top: m.k2, flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) c.rect(-1.4, sg > 0 ? T + 1.4 : -T - 1.85, 2.8, 0.45); } });
    }
    return { r: 22, h: Math.ceil(MZ + 0.5), parts, style: 'unit', bevel: 0.7 };
  };

  // frame of an arbitrary planar face (u along e1, v along e2): for tapered walls
  function onPlane(c, p0, e1, e2, fn) { const a = nrm(e1), b = nrm(e2); c.save(); c.transform(a[0], a[1] - a[2], b[0], b[1] - b[2], p0[0], p0[1] - p0[2]); fn(c); c.restore(); }
  // gothic rose window in a face frame
  function rose(c, m, x, z, r) {
    S.dot(c, m.stL, x, z, r + 0.7);
    const g = c.createRadialGradient(x, z, 0, x, z, r);
    g.addColorStop(0, sh(m.gl, 0.55)); g.addColorStop(0.6, m.gl); g.addColorStop(1, sh(m.gl, -0.25));
    c.fillStyle = g; c.beginPath(); c.arc(x, z, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(70,46,30,0.85)'; c.lineWidth = 0.28; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.moveTo(x + Math.cos(a) * r * 0.32, z + Math.sin(a) * r * 0.32); c.lineTo(x + Math.cos(a) * r, z + Math.sin(a) * r); }
    c.moveTo(x + r * 0.32, z); c.arc(x, z, r * 0.32, 0, TAU); c.stroke();
    S.dot(c, m.k, x, z, r * 0.2);
  }

  /* ========================================================== MAGE TOWER */
  M.human_magetower = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 20 };
    const arc = m.gl, core = mx(m.gl, '#fffbe6', 0.55), gold = m.k2, goldD = sh(m.k2, -0.35);
    roundTower(K, { cx: -10.5, cy: -2.5, r: 3.8, zt: 38, roof: 'cone', ch: 10, ov: 1, wins: [[PI * 0.62, 28, 1.4, 2.4], [PI * 0.6, 18, 0, 2.6, { slit: true }]] });
    roundTower(K, { cx: 0, cy: 0, r: 8, batter: 1.3, zt: 46,
      wins: [[PI * 0.5, 1.4, 3.2, 5.8, { door: true, lit: true }], [PI * 0.4, 14, 2, 4], [PI * 0.62, 25, 2, 4], [PI * 0.46, 36, 2, 4]],
      deco: (c) => { for (const z of [11.5, 22.5, 33.5]) { c.strokeStyle = m.stT; c.lineWidth = 0.8; c.beginPath(); c.arc(0, -z, 8.85, 0.05, PI - 0.05); c.stroke(); c.strokeStyle = rgba(arc, 0.6); c.lineWidth = 0.3; c.beginPath(); c.arc(0, -z - 0.15, 8.9, 0.2, PI - 0.2); c.stroke(); } } });
    // corbelled gallery with a rune circle
    parts.push({ z0: 43.5, z1: 46, side: m.stS, top: m.stT, ao: 0.15, shape: (c, t) => { for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = 8 + 2.2 * t; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.8); } } });
    parts.push(cyl(0, 0, 10.4, 46, 47.2, m.stT, sh(m.stT, -0.05), { ao: 0, detail: (c, an) => { c.beginPath(); c.strokeStyle = rgba(arc, 0.8); c.lineWidth = 0.4; c.arc(0, 0, 5.4, 0, TAU); c.stroke(); c.beginPath(); c.lineWidth = 0.25; c.arc(0, 0, 3.8, 0, TAU); c.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + an * 0.8; S.dot(c, core, Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0.38); } } }));
    const merl = (a0, a1) => ({ z0: 47.2, z1: 50, side: m.stS, top: m.stT, ao: 0.12, shape: (c, t) => { sector(c, 0, 0, 9.4, 10.4, a0, a1); if (t > 0.45) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = a0 + (i + 0.25) * (a1 - a0) / 6; sector(c, 0, 0, 9.4, 10.4, a, a + (a1 - a0) / 6 * 0.5); } } } });
    // golden prongs cradling the orb (back ones first)
    const prong = (list) => ({ z0: 47.2, z1: 62, side: goldD, top: gold, ao: 0.1, shape: (c, t) => { const r = 6.6 - 2.6 * Math.sin(t * PI * 0.7) + (t > 0.85 ? (t - 0.85) * 8 : 0); for (const a of list) S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.75 - t * 0.35); } });
    parts.push(merl(PI, TAU));
    parts.push(prong([PI * 1.1, PI * 1.5, PI * 1.9]));
    parts.push(overlay((c, an) => {
      const pul = 1 + 0.25 * Math.sin(an * TAU), oy = -58 - Math.sin(an * TAU) * 0.7;
      glow(c, arc, 0, oy, 11 * pul, 0.6);
      glow(c, core, 0, oy, 5.5 * pul, 0.75);
      const g = c.createRadialGradient(-1.2, oy - 1.2, 0, 0, oy, 4); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, core); g.addColorStop(1, sh(arc, -0.1));
      c.fillStyle = g; c.beginPath(); c.arc(0, oy, 3.9, 0, TAU); c.fill();
      c.strokeStyle = rgba('#ffffff', 0.55); c.lineWidth = 0.35; c.beginPath(); c.arc(0, oy, 2.9, PI * 1.1, PI * 1.55); c.stroke();
    }));
    parts.push(prong([PI * 0.3, PI * 0.7]));
    parts.push(merl(0, PI));
    parts.push(overlay((c, an) => {
      // orbiting runes (front half drawn over the prongs) + motes rising
      for (let i = 0; i < 6; i++) { const a = an * TAU + i * TAU / 6, x = Math.cos(a) * 7.2, y = Math.sin(a) * 7.2 - 56.5; if (Math.sin(a) < 0) continue; S.dot(c, rgba(core, 0.9), x, y, 0.55); }
      for (let i = 0; i < 4; i++) { const t = (an + i / 4) % 1, a = i * 1.9; S.dot(c, rgba(core, 1 - t), Math.cos(a) * 3, -60 - t * 9 + Math.sin(a), 0.4); }
    }));
    return { r: 20, h: 76, parts, style: 'unit', bevel: 0.8 };
  };

  /* ========================================================== WATCHTOWER */
  M.human_watchtower = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 14 };
    const H = 40, b0 = 7, b1 = 5.6;
    parts.push(box(-b0 - 0.8, -b0 - 0.8, b0 + 0.8, b0 + 0.8, 0, 1.6, m.stD, mx(m.stD, m.stS, 0.5), { ao: 0.2 }));
    parts.push({ z0: 1.6, z1: H, side: m.stS, top: m.stT, ao: 0.32, shape: (c, t) => { const h = b0 + (b1 - b0) * t; c.rect(-h, -h, h * 2, h * 2); } });
    parts.push(overlay((c) => onPlane(c, [-b0, b0, 1.6], [1, 0, 0], [0, b1 - b0, H - 1.6], (c) => {
      const L = Math.hypot(H - 1.6, b0 - b1), k = (b0 - b1) / L;
      c.save(); c.beginPath(); S.poly(c, [0, 0, 2 * b0, 0, 2 * b0 - k * L, L, k * L, L]); c.clip();
      ashlar(c, 0, 2 * b0, 0, L, 31); quoins(c, 0.0, 2 * b0, 0, L);
      c.restore();
      door(c, m, b0, 0, 3, 5, {});
      for (const z of [13, 25]) { c.fillStyle = m.stL; c.fillRect(b0 - 0.75, z - 0.45, 1.5, 4.3); c.fillStyle = '#1c1410'; c.fillRect(b0 - 0.28, z, 0.56, 3.4); }
      win(c, m, b0, 33, 1.8, 2.8, { stone: true, arch: true });
    })));
    // timber hoarding deck on corbel beams
    const D = 8.4;
    parts.push(beams([[-5, b1, H - 1.5, -5, D, H], [5, b1, H - 1.5, 5, D, H], [-b1, -5, H - 1.5, -D, -5, H], [b1, -5, H - 1.5, D, -5, H], [-b1, 5, H - 1.5, -D, 5, H], [b1, 5, H - 1.5, D, 5, H]], 0.8, 0.8, m.wdD, m.wd));
    parts.push(box(-D, -D, D, D, H, H + 1.4, m.wd, m.pk, { ao: 0.1, detail: (c) => S.lines(c, 'rgba(60,34,14,0.4)', 0.2, [-D, -4, D, -4, -D, 0, D, 0, -D, 4, D, 4]) }));
    const P = D - 0.6, z1 = H + 1.4, zr = H + 9.4;
    parts.push(beams([[-P, -P, z1, -P, -P, zr], [P, -P, z1, P, -P, zr], [-P, -P, z1 + 2.6, P, -P, z1 + 2.6], [-P, -P, z1 + 2.6, -P, P, z1 + 2.6], [P, -P, z1 + 2.6, P, P, z1 + 2.6]], 0.8, 0.6, m.wdD, m.wd));
    parts.push(beams([[-P, P, z1, -P, P, zr], [P, P, z1, P, P, zr], [-P, P, z1 + 2.6, P, P, z1 + 2.6]], 0.8, 0.6, m.wdD, m.wd));
    const rf = roofGX(0, 0, 2 * D - 0.2, 2 * D - 0.2, zr, 8.5, { hip: true, ov: 1.1, roofCol: m.rf, rows: 1.7 });
    parts.push(overlay((c) => { paintFaces(c, rf.faces, 14); paintLines(c, rf.lines, m); onFace(c, D + 0.1, (c) => banner(c, m, 0, H + 1.2, 3, 6.5, 0)); }));
    // beacon: stone flue through the apex carrying an iron fire basket
    const zb = rf.zr - 1.5;
    parts.push(box(-1.5, -1.5, 1.5, 1.5, zb, zb + 3, m.stS, m.stT, { ao: 0.15 }));
    parts.push(beams([[-1.5, -1.5, zb + 3, 1.5, -1.5, zb + 3], [1.5, -1.5, zb + 3, 1.5, 1.5, zb + 3], [1.5, 1.5, zb + 3, -1.5, 1.5, zb + 3], [-1.5, 1.5, zb + 3, -1.5, -1.5, zb + 3]], 0.4, 0.4, m.iron, m.ironL));
    parts.push({ z0: zb + 3, z1: zb + 5, side: m.iron, top: '#5a2a10', ao: 0.1, shape: (c, t) => S.circ(c, 0, 0, 1.5 + t * 0.9), detail: (c) => S.dot(c, '#ffb040', 0, 0, 1.6) });
    parts.push(overlay((c, an) => {
      const y = -zb - 5, f = Math.sin(an * TAU);
      glow(c, '#ff9a30', 0, y - 2, 10 + f, 0.75);
      S.fillPoly(c, '#ff6a18', [-2.3, y + 0.4, -1.6 + f * 0.3, y - 3.6, -0.5, y - 2.4, 0.2 - f * 0.4, y - 6, 1, y - 2.6, 1.8 + f * 0.2, y - 4, 2.4, y + 0.4]);
      S.fillPoly(c, '#ffd36a', [-1.2, y + 0.3, -0.5, y - 2.2, 0.1 - f * 0.2, y - 3.8, 0.8, y - 2, 1.3, y + 0.3]);
      for (let i = 0; i < 3; i++) { const t = (an + i / 3) % 1; S.dot(c, rgba('#ffd080', 1 - t), Math.sin(i * 2 + an * 6) * 1.2, y - 5 - t * 7, 0.35); }
    }));
    return { r: 14, h: 72, parts, style: 'unit', bevel: 0.8 };
  };

  /* ============================================================== TEMPLE */
  M.human_temple = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 30 };
    const heal = mx(m.gl, '#fffbe8', 0.5);
    const court = rrP(-27, -26, 27, 28, 4);
    parts.push(pad(court, mx(m.stT, m.cob, 0.45), sh(m.cob, -0.3), 'flag', 33));
    parts.push(overlay((c) => castShadow(c, court, [[-6, -24, 16, 6, 26], [-20, -6, -9, 4, 34]])));
    // nave: tall stone hall, gable to the front, rose window and a glowing doorway
    hall(K, { cx: 5, cy: -9, W: 21, D: 30, ze: 15, hr: 12.5, gable: 'stone', roof: 'gy', seed: 81, ro: { ovf: 0.8 },
      door: [5, 4.6, 8.4, { lit: true }],
      deco: (c, an) => onFace(c, 6, (c) => {
        for (const x of [-5.5, 15.5]) { c.fillStyle = m.stT; c.fillRect(x - 0.9, 0, 1.8, 13.5); c.fillStyle = 'rgba(30,20,12,0.25)'; c.fillRect(x + 0.4, 0, 0.5, 13.5); }
        win(c, m, -1.5, 4, 1.8, 5.4, { stone: true, arch: true }); win(c, m, 11.5, 4, 1.8, 5.4, { stone: true, arch: true });
        rose(c, m, 5, 17.6, 2.8);
        c.fillStyle = rgba(heal, 0.35 + 0.15 * Math.sin(an * TAU)); c.beginPath(); c.arc(5, 4.6 + 8.4 - 2.3, 4.4, 0, PI); c.fill();
      }) });
    // bell tower with a tall spire
    hall(K, { cx: -14.5, cy: -1, W: 10, D: 10, ze: 28, roof: 'hip', hr: 17, seed: 82, ro: { ov: 0.9, rows: 1.6 },
      wins: [[-14.5, 8, 1.6, 3.6, { arch: true }], [-14.5, 15, 1.6, 3.6, { arch: true }]],
      deco: (c) => onFace(c, 4, (c) => {
        c.fillStyle = m.stL; c.beginPath(); c.moveTo(-17.6, 20.4); c.lineTo(-17.6, 24.5); c.arc(-14.5, 24.5, 3.1, PI, 0, true); c.lineTo(-11.4, 20.4); c.closePath(); c.fill();
        c.fillStyle = '#1a120e'; c.beginPath(); c.moveTo(-16.8, 21); c.lineTo(-16.8, 24.5); c.arc(-14.5, 24.5, 2.3, PI, 0, true); c.lineTo(-12.2, 21); c.closePath(); c.fill();
        c.fillStyle = m.k2; c.beginPath(); c.moveTo(-15.6, 22.2); c.quadraticCurveTo(-15.6, 25.8, -14.5, 25.8); c.quadraticCurveTo(-13.4, 25.8, -13.4, 22.2); c.closePath(); c.fill();
        c.fillStyle = m.stT; c.fillRect(-19.6, 19.4, 10.2, 0.8); c.fillRect(-19.6, 27, 10.2, 0.8);
      }),
      roofDeco: (c, r) => { const y = -1 - r.zr; seg2(c, [-14.5, y + 0.6], [-14.5, y - 3.6], m.k2, 0.45); seg2(c, [-15.8, y - 2.4], [-13.2, y - 2.4], m.k2, 0.45); S.dot(c, '#fff4c0', -14.7, y - 3.4, 0.25); } });
    // healing pool with a glowing font
    parts.push(cyl(5, 17, 6.4, 0, 1.6, m.stS, m.stT, { ao: 0.3 }));
    parts.push({ z0: 1.2, z1: 1.4, side: heal, top: heal, flat: true, bevel: false, shape: (c) => S.circ(c, 5, 17, 5.2), detail: (c, an) => {
      const g = c.createRadialGradient(5, 17, 0, 5, 17, 5.2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, heal); g.addColorStop(1, mx(heal, '#6ac8c0', 0.4));
      c.fillStyle = g; c.beginPath(); c.arc(5, 17, 5.2, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.25; for (const r of [1.8 + an * 2.4, 3.4 + an * 1.6]) { c.beginPath(); c.arc(5, 17, Math.min(5, r), 0, TAU); c.stroke(); }
    } });
    parts.push(cyl(5, 17, 0.9, 1.4, 5.2, m.stT, m.stL));
    parts.push(overlay((c, an) => {
      cylDeco(c, m, 5, 17, 6.4, 0, 1.6, { plain: true });
      const p = 1 + 0.18 * Math.sin(an * TAU);
      glow(c, heal, 5, 17 - 4, 11 * p, 0.55);
      S.dot(c, heal, 5, 17 - 6.2, 1.2); S.dot(c, '#ffffff', 4.7, 17 - 6.5, 0.5);
      for (let i = 0; i < 4; i++) { const a = an * TAU + i * PI / 2, h = ((an + i / 4) % 1) * 6; S.dot(c, rgba('#ffffff', 0.9 * (1 - h / 6)), 5 + Math.cos(a) * 3, 17 - 2 - h + Math.sin(a) * 1.5, 0.35); }
    }));
    // lanterns along the path
    for (const x of [-4, 14]) parts.push(beams([[x, 22, 0, x, 22, 6]], 0.5, 0.5, m.iron, m.ironL));
    parts.push(overlay((c) => { for (const x of [-4, 14]) { glow(c, m.gl, x, 22 - 6.6, 3.2, 0.7); S.fillPoly(c, m.iron, [x - 0.8, 22 - 6, x + 0.8, 22 - 6, x + 0.6, 22 - 7.6, x - 0.6, 22 - 7.6]); S.dot(c, sh(m.gl, 0.3), x, 22 - 6.8, 0.5); } }));
    return { r: 30, h: 50, parts, style: 'unit', bevel: 0.8 };
  };

  /* ============================================================== MARKET */
  function stall(K, x, y, w, col, goods) {
    const m = K.m, d = 5.6, yb = y - d / 2, yf = y + d / 2, cream = '#f1e8d4';
    K.parts.push(beams([[x - w / 2 + 0.4, yb + 0.4, 0, x - w / 2 + 0.4, yb + 0.4, 7], [x + w / 2 - 0.4, yb + 0.4, 0, x + w / 2 - 0.4, yb + 0.4, 7]], 0.5, 0.5, m.wdD, m.wd));
    K.parts.push(box(x - w / 2, yf - 2.4, x + w / 2, yf, 0, 2.6, m.wd, m.pk, { ao: 0.25, detail: (c) => {
      const rng = new U.RNG(Math.round(x * 13 + y * 7 + 999) >>> 0);
      for (let i = 0; i < w * 2.2; i++) { const gx = x - w / 2 + 0.6 + rng.next() * (w - 1.2), gy = yf - 2.1 + rng.next() * 1.8, gc = goods[i % goods.length]; S.dot(c, sh(gc, -0.3), gx, gy + 0.12, 0.55); S.dot(c, gc, gx - 0.08, gy - 0.05, 0.46); S.dot(c, 'rgba(255,255,255,0.5)', gx - 0.2, gy - 0.2, 0.14); }
    } }));
    K.parts.push(overlay((c) => onFace(c, yf, (c) => planks(c, m, x - w / 2, x + w / 2, 0, 2.6))));
    K.parts.push(beams([[x - w / 2 + 0.4, yf - 0.2, 0, x - w / 2 + 0.4, yf + 0.5, 6], [x + w / 2 - 0.4, yf - 0.2, 0, x + w / 2 - 0.4, yf + 0.5, 6]], 0.5, 0.5, m.wdD, m.wd));
    const zb = 7.2, zf = 6.0, yz = yf + 0.9, Ls = Math.hypot(yz - yb, zb - zf), W2 = w + 0.8;
    const aw = face([x - W2 / 2, yz, zf], [1, 0, 0], [0, yb - yz, zb - zf], [0, 0, W2, 0, W2, Ls, 0, Ls], { col: cream, contrast: 0.45,
      paint: (c) => { c.fillStyle = col; for (let u = 0; u < W2; u += 2.4) c.fillRect(u, -1, 1.2, Ls + 2); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-1, Ls * 0.55, W2 + 2, Ls); } });
    K.parts.push(overlay((c) => {
      paintFaces(c, [aw], K.R);
      const ey = yz - zf;
      for (let i = 0; i * 1.2 < W2 - 0.05; i++) { const xx = x - W2 / 2 + i * 1.2; c.fillStyle = i % 2 ? cream : col; c.beginPath(); c.moveTo(xx, ey - 0.05); c.lineTo(xx + 1.2, ey - 0.05); c.arc(xx + 0.6, ey - 0.05, 0.6, 0, PI); c.closePath(); c.fill(); }
      c.strokeStyle = 'rgba(40,20,10,0.45)'; c.lineWidth = 0.22; c.beginPath(); c.moveTo(x - W2 / 2, ey); c.lineTo(x + W2 / 2, ey); c.stroke();
      // produce baskets on the ground in front
      for (const [bx, gc] of [[x - w * 0.3, goods[0]], [x + w * 0.25, goods[1 % goods.length]]]) {
        const by = yf + 2.2;
        c.fillStyle = m.wdD; c.beginPath(); c.ellipse(bx, by - 0.2, 1.5, 0.9, 0, 0, TAU); c.fill();
        c.fillStyle = mx(m.wd, '#c8964e', 0.5); c.beginPath(); c.moveTo(bx - 1.5, by - 1.2); c.lineTo(bx + 1.5, by - 1.2); c.lineTo(bx + 1.2, by + 0.3); c.lineTo(bx - 1.2, by + 0.3); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(60,34,14,0.5)'; c.lineWidth = 0.18; c.beginPath(); c.moveTo(bx - 1.4, by - 0.6); c.lineTo(bx + 1.4, by - 0.6); c.stroke();
        for (let k = 0; k < 5; k++) S.dot(c, k % 2 ? sh(gc, -0.15) : gc, bx - 1 + k * 0.5, by - 1.4 - (k % 2) * 0.3, 0.45);
      }
    }));
  }
  M.human_market = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 32 };
    const sq = rrP(-28, -26, 28, 27, 4);
    parts.push(pad(sq, mx(m.stT, m.cob, 0.3), sh(m.cob, -0.3), 'flag', 41));
    parts.push(overlay((c) => castShadow(c, sq, [[-17, -25, 17, -11, 16]])));
    // market hall: open stone arcade below, timber-framed upper storey, hipped roof
    hall(K, { cx: 0, cy: -18, W: 34, D: 13, ze: 13, upper: 6.5, jetty: 0.8, hr: 8, roof: 'hip', seed: 91, frame: { pat: 'x' }, chim: [[11, -21, 2.6, true]],
      wins: [[-12, 8.4, 2.2, 2.6], [-4, 8.4, 2.2, 2.6], [4, 8.4, 2.2, 2.6], [12, 8.4, 2.2, 2.6]],
      deco: (c) => onFace(c, -11.5, (c) => {
        for (let i = 0; i < 5; i++) {
          const x = -13.6 + i * 6.8;
          c.fillStyle = '#21160f'; c.beginPath(); c.moveTo(x - 2.6, 0); c.lineTo(x - 2.6, 3.2); c.arc(x, 3.2, 2.6, PI, 0, true); c.lineTo(x + 2.6, 0); c.closePath(); c.fill();
          c.fillStyle = 'rgba(255,200,120,0.18)'; c.fillRect(x - 2.6, 0, 5.2, 1.6);
          S.dot(c, '#d8c8a0', x - 1.2, 0.8, 0.8); S.dot(c, '#c8b48a', x + 0.4, 0.7, 0.9); S.dot(c, '#7a5a3a', x + 1.6, 0.9, 0.6);
        }
      }) });
    // stalls
    stall(K, -16, -3.5, 10, m.k, ['#d8402e', '#e8a030', '#8ac040']);
    stall(K, 16, -3.5, 10, '#3a6aa8', ['#e8d090', '#c08a40', '#f0e0b0']);
    // market cross
    parts.push(box(-4, 4.4, 4, 12.4, 0, 1, m.stD, m.stS), box(-3, 5.4, 3, 11.4, 1, 2, m.stS, m.stT), box(-2, 6.4, 2, 10.4, 2, 3, m.stS, m.stT));
    parts.push(cyl(0, 8.4, 1.1, 3, 12.5, m.stS, m.stT));
    parts.push(overlay((c) => { cylDeco(c, m, 0, 8.4, 1.1, 3, 12.5, { plain: true }); seg2(c, [0, 8.4 - 12.5], [0, 8.4 - 15.6], m.k2, 0.6); seg2(c, [-1.4, 8.4 - 14.3], [1.4, 8.4 - 14.3], m.k2, 0.6); S.dot(c, m.k2, 0, 8.4 - 12.9, 0.9); S.dot(c, '#fff2c0', -0.25, 8.4 - 13.2, 0.3); }));
    stall(K, -16, 14, 10, m.k2, ['#7ab040', '#e85a3a', '#f0c040']);
    stall(K, 16, 14, 10, '#4a8a50', ['#b0603a', '#e8d0a0', '#8a5ab0']);
    crates(K, [[-25.5, 4.5, 2.6, 2.4], [-23, 5.2, 2.4, 2.2], [-24.6, 4.8, 2.2, 2, 2.4]]);
    barrels(K, [[24.5, 4.5, 1.5], [25.5, 7.4, 1.5], [6, 23, 1.4]], 3.4);
    parts.push({ z0: 0, z1: 2.4, side: '#cdbb94', top: '#e6d6b0', ao: 0.3, shape: (c, t) => { for (const q of [[-8, 22], [-6.2, 23.4], [-9.6, 23.6]]) S.circ(c, q[0], q[1], 1.3 * Math.sqrt(Math.max(0.1, 1 - t * t * 0.7))); } });
    parts.push(overlay((c, an) => { paintPole(c, m, -26, 25, 0, 13, 5.5, 3.2, an, { tail: true }); paintPole(c, m, 26, 25, 0, 13, 5.5, 3.2, an, { tail: true, dir: -1 }); }));
    return { r: 32, h: 32, parts, style: 'unit', bevel: 0.8 };
  };

  /* ============================================================ WORKSHOP */
  M.human_workshop = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 32 };
    const raw = mx(m.pk, '#e0c08a', 0.35), rawD = sh(raw, -0.28);
    const yard = rrP(-30, -24, 30, 26, 5);
    parts.push(pad(yard, mx(m.dirt, '#b49a6a', 0.45), m.dirtD, 'earth', 51));
    parts.push(overlay((c) => { castShadow(c, yard, [[-28, -22, 4, -8, 14]]); c.fillStyle = 'rgba(240,220,170,0.35)'; for (let i = 0; i < 30; i++) { const h1 = U.hash2(i, 7, 3), h2 = U.hash2(i, 8, 3); c.beginPath(); S.ell(c, -24 + h1 * 40, -4 + h2 * 26, 0.8, 0.35, h1 * 3); c.fill(); } }));
    // open-fronted timber shed
    hall(K, { cx: -12, cy: -15, W: 30, D: 13, ze: 10, wall: 'wood', hr: 7, roof: 'hip', seed: 101, ro: { ov: 1.4 },
      deco: (c) => onFace(c, -8.5, (c) => {
        c.fillStyle = '#21160f'; c.fillRect(-26, 0, 28, 8.6);
        c.fillStyle = 'rgba(255,190,110,0.12)'; c.fillRect(-26, 0, 28, 3);
        c.strokeStyle = '#7a7268'; c.lineWidth = 0.35; c.beginPath(); for (let i = 0; i < 6; i++) { const x = -23 + i * 1.6; c.moveTo(x, 4.5); c.lineTo(x, 7.5); } c.stroke();
        c.fillStyle = m.pk; c.fillRect(-12, 0, 9, 2.4); c.fillStyle = m.wdD; c.fillRect(-12, 2.2, 9, 0.4);
        c.fillStyle = m.wd; for (const x of [-26, -16.6, -7.3, 2]) c.fillRect(x - 0.45, 0, 0.9, 8.8);
        c.fillStyle = m.wdD; c.fillRect(-26, 8.2, 28, 0.9);
      }) });
    // treadwheel crane
    const cx = 18, cy = -10;
    const ring = [];
    for (let i = 0; i < 12; i++) { const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU; for (const yy of [cy - 1.6, cy + 1.6]) ring.push([cx + Math.cos(a0) * 4.6, yy, 5 + Math.sin(a0) * 4.6, cx + Math.cos(a1) * 4.6, yy, 5 + Math.sin(a1) * 4.6]); }
    parts.push(beams([[cx - 3, cy - 3.5, 0, cx, cy - 1, 19], [cx + 3, cy - 3.5, 0, cx, cy - 1, 19], [cx - 3, cy + 2.5, 0, cx, cy - 1, 19]], 0.9, 0.8, m.wdD, m.wd));
    parts.push(beams(ring.concat([[cx - 4.6, cy - 1.6, 5, cx + 4.6, cy - 1.6, 5], [cx, cy - 1.6, 0.4, cx, cy - 1.6, 9.6], [cx - 4.6, cy + 1.6, 5, cx + 4.6, cy + 1.6, 5], [cx, cy + 1.6, 0.4, cx, cy + 1.6, 9.6]]), 0.55, 0.55, m.wd, m.pk));
    parts.push(beams([[cx, cy - 1, 18.4, cx - 15, cy + 6, 21]], 0.9, 0.9, m.wd, m.pk));
    parts.push(beams([[cx - 14.6, cy + 6, 20.6, cx - 14.6, cy + 6, 9.6], [cx, cy - 1, 18.6, cx, cy - 1.6, 5.4]], 0.18, 0.2, '#3a2c1e', '#6a5440'));
    // hanging timber on the hook
    parts.push({ z0: 7.4, z1: 9.4, side: rawD, top: raw, ao: 0.2, shape: (c) => c.rect(cx - 19, cy + 5.2, 9, 1.6) });
    // half-built trebuchet frame
    const tx = 2, ty = 6;
    parts.push(beams([[tx - 9, ty - 3.4, 0.6, tx + 9, ty - 3.4, 0.6], [tx - 9, ty + 3.4, 0.6, tx + 9, ty + 3.4, 0.6], [tx - 8, ty - 3.8, 0.9, tx - 8, ty + 3.8, 0.9], [tx + 8, ty - 3.8, 0.9, tx + 8, ty + 3.8, 0.9]], 1.2, 1.2, rawD, raw));
    parts.push(beams([[tx, ty - 3.4, 1, tx, ty - 3.4, 13], [tx - 6, ty - 3.4, 1, tx - 0.3, ty - 3.4, 11], [tx + 6, ty - 3.4, 1, tx + 0.3, ty - 3.4, 11]], 0.95, 0.95, rawD, raw));
    parts.push(beams([[tx, ty - 3.9, 12.6, tx, ty + 3.9, 12.6]], 0.8, 0.8, m.iron, m.ironL));
    parts.push(beams([[tx, ty + 3.4, 1, tx, ty + 3.4, 13], [tx - 6, ty + 3.4, 1, tx - 0.3, ty + 3.4, 11]], 0.95, 0.95, rawD, raw));
    // log pile with cut ends to the camera
    const logs = [[-22, 12, 1.3], [-19.3, 12, 1.3], [-16.6, 12, 1.3], [-20.65, 12, 3.6], [-17.95, 12, 3.6], [-19.3, 12, 5.9]];
    parts.push({ z0: 0, z1: 7.2, side: mx(m.wd, m.pk, 0.45), top: mx(m.wd, m.pk, 0.7), ao: 0.25, shape: (c, t) => { const z = t * 7.2; for (const g of logs) { const d = 1.35 * 1.35 - (z - g[2]) * (z - g[2]); if (d > 0) { const w = Math.sqrt(d); c.rect(g[0] - w, g[1] - 4.5, w * 2, 9); } } } });
    parts.push(overlay((c) => { for (const g of logs) { const y = g[1] + 4.5 - g[2]; S.dot(c, '#d8b07a', g[0], y, 1.3); c.strokeStyle = 'rgba(120,80,40,0.6)'; c.lineWidth = 0.2; c.beginPath(); c.arc(g[0], y, 0.8, 0, TAU); c.moveTo(g[0] + 0.35, y); c.arc(g[0], y, 0.35, 0, TAU); c.stroke(); c.strokeStyle = m.wdD; c.lineWidth = 0.3; c.beginPath(); c.arc(g[0], y, 1.3, 0, TAU); c.stroke(); } }));
    // sawhorse with a plank + stacked planks
    parts.push(beams([[18, 12, 0, 18, 13.5, 3], [18, 15, 0, 18, 13.5, 3], [24, 12, 0, 24, 13.5, 3], [24, 15, 0, 24, 13.5, 3]], 0.45, 0.45, m.wdD, m.wd));
    parts.push(box(16, 12.9, 27, 14.1, 3, 3.6, rawD, raw), box(10, 18, 20, 21, 0, 1.6, rawD, raw, { detail: (c) => S.lines(c, 'rgba(90,60,30,0.5)', 0.2, [10, 19, 20, 19, 10, 20, 20, 20]) }));
    barrels(K, [[27, 2, 1.4]], 3.2);
    parts.push(overlay((c, an) => paintPole(c, m, 28, 22, 0, 12, 5, 3, an, { tail: true, dir: -1 })));
    return { r: 32, h: 30, parts, style: 'unit', bevel: 0.8 };
  };

  /* ============================================================ WARDSTONE */
  M.human_wardstone = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    const rune = m.gl, core = mx(m.gl, '#fffbe6', 0.6);
    parts.push({ z0: 0, z1: 1.3, side: m.stD, top: mx(m.stD, m.stS, 0.5), ao: 0.2, shape: (c) => S.poly(c, ngon(8, 7.4, PI / 8)) });
    parts.push({ z0: 1.3, z1: 2.6, side: m.stS, top: m.stT, ao: 0.2, shape: (c) => S.poly(c, ngon(8, 5.4, PI / 8)), detail: (c, an) => {
      c.beginPath(); c.strokeStyle = rgba(rune, 0.6 + 0.3 * Math.sin(an * TAU)); c.lineWidth = 0.3; c.arc(0, 0, 4.2, 0, TAU); c.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.dot(c, rune, Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.35); }
    } });
    const H = 17, b0 = 2.3, b1 = 1.35;
    const obS = mx(m.stS, m.d, 0.35), obT = mx(m.stT, m.d, 0.3);
    parts.push({ z0: 2.6, z1: H, side: obS, top: obT, ao: 0.3, shape: (c, t) => { const h = b0 + (b1 - b0) * t; c.rect(-h, -h, h * 2, h * 2); } });
    parts.push({ z0: H, z1: H + 3.2, side: sh(m.k2, -0.25), top: m.k2, ao: 0, shape: (c, t) => { const h = b1 * (1 - t) + 0.05; c.rect(-h, -h, h * 2, h * 2); } });
    parts.push(overlay((c, an) => {
      const p = 0.5 + 0.5 * Math.sin(an * TAU);
      onPlane(c, [-b0, b0, 2.6], [1, 0, 0], [0, b1 - b0, H - 2.6], (c) => {
        const L = Math.hypot(H - 2.6, b0 - b1), k = (b0 - b1) / L;
        c.save(); c.beginPath(); S.poly(c, [0, 0, 2 * b0, 0, 2 * b0 - k * L, L, k * L, L]); c.clip();
        ashlar(c, 0, 2 * b0, 0, L, 61, { ch: 2.4, bw: 5 });
        const g = c.createLinearGradient(0, 0, 2 * b0, 0); g.addColorStop(0, 'rgba(255,250,235,0.18)'); g.addColorStop(1, 'rgba(20,10,0,0.18)'); c.fillStyle = g; c.fillRect(0, 0, 2 * b0, L);
        c.restore();
        const x = b0;
        c.save();
        glow(c, rune, x, 8.5, 5.5 + p * 2.5, 0.45 + p * 0.35);
        c.strokeStyle = sh(rune, -0.1); c.lineWidth = 0.95; c.lineCap = 'round'; c.beginPath();
        c.moveTo(x, 3); c.lineTo(x, 13.4); c.moveTo(x - 1, 11.4); c.lineTo(x, 12.6); c.lineTo(x + 1, 11.4); c.moveTo(x - 0.9, 5); c.lineTo(x, 4); c.lineTo(x + 0.9, 5); c.moveTo(x + 0.95, 8.4); c.arc(x, 8.4, 0.95, 0, TAU);
        c.stroke();
        c.strokeStyle = core; c.lineWidth = 0.42; c.beginPath();
        c.moveTo(x, 3); c.lineTo(x, 13.4);
        c.moveTo(x - 1, 11.4); c.lineTo(x, 12.6); c.lineTo(x + 1, 11.4);
        c.moveTo(x - 0.9, 5); c.lineTo(x, 4); c.lineTo(x + 0.9, 5);
        c.moveTo(x + 0.95, 8.4); c.arc(x, 8.4, 0.95, 0, TAU);
        c.stroke(); S.dot(c, '#ffffff', x, 8.4, 0.35);
        c.restore();
      });
      glow(c, rune, 0, -H - 1.6, 3.5 + p, 0.5);
      glow(c, rune, 0, -1.8, 7 + p * 1.5, 0.22 + p * 0.12);
      for (let i = 0; i < 4; i++) { const t = (an + i / 4) % 1, a = i * 1.7 + an * TAU; S.dot(c, rgba(core, 1 - t), Math.cos(a) * 3.8, Math.sin(a) * 1.4 - 3 - t * 14, 0.32); }
    }));
    return { r: 9, h: 22, parts, style: 'unit', bevel: 0.7 };
  };

  /* ================================================================ ROOST */
  M.human_roost = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [], K = { m, parts, R: 36 };
    const PR = 22, PH = 9, cy = -4;
    // battered round platform
    parts.push({ z0: 0, z1: PH - 1, side: m.stS, top: m.stT, ao: 0.34, shape: (c, t) => S.circ(c, 0, cy, PR + 1.6 * (1 - t)) });
    parts.push(overlay((c) => cylDeco(c, m, 0, cy, PR + 0.8, 0, PH - 1, {})));
    // buttresses
    parts.push({ z0: 0, z1: PH - 2, side: m.stS, top: m.stT, ao: 0.3, shape: (c, t) => { for (let i = 0; i < 7; i++) { const a = PI * (0.08 + i * 0.14); const r0 = PR + 0.4, r1 = PR + 3.2 - 2.4 * t; S.poly(c, rot([r0, -1.3, r1, -1.3, r1, 1.3, r0, 1.3], a, 0, cy)); } } });
    // deck with an inlaid sun and claw scratches
    parts.push(cyl(0, cy, PR + 0.6, PH - 1, PH, m.stT, sh(m.stT, -0.04), { ao: 0, detail: (c) => {
      c.save(); c.beginPath(); c.arc(0, cy, PR - 0.2, 0, TAU); c.clip();
      c.strokeStyle = 'rgba(50,38,28,0.28)'; c.lineWidth = 0.22; c.beginPath();
      for (const r of [6.5, 12, 17.5]) { c.moveTo(r, cy); c.arc(0, cy, r, 0, TAU); }
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const r0 = i % 2 ? 6.5 : 12; c.moveTo(Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(Math.cos(a) * PR, cy + Math.sin(a) * PR); }
      c.stroke();
      c.fillStyle = rgba(m.k, 0.85); c.beginPath(); c.arc(0, cy, 5.4, 0, TAU); c.fill();
      c.fillStyle = m.k2; c.beginPath(); S.star(c, 0, cy, 4.6, 2.2, 8, 0); c.fill(); S.dot(c, m.k, 0, cy, 1.5);
      c.strokeStyle = 'rgba(40,28,20,0.55)'; c.lineWidth = 0.32; c.lineCap = 'round';
      const claw = (x, y, a) => { c.beginPath(); for (let k = -1; k <= 1; k++) { const ox = Math.cos(a + PI / 2) * k * 0.9, oy = Math.sin(a + PI / 2) * k * 0.9; c.moveTo(x + ox, y + oy); c.quadraticCurveTo(x + ox + Math.cos(a) * 2.5, y + oy + Math.sin(a) * 2.5 + 0.4, x + ox + Math.cos(a) * 4.6, y + oy + Math.sin(a) * 4.6); } c.stroke(); };
      claw(-12, cy - 4, 0.4); claw(9, cy + 6, 2.6); claw(10, cy - 9, -2.2); claw(-8, cy + 10, -0.6); claw(-3, cy - 14, 0.2);
      c.restore();
    } }));
    // back parapet with merlons
    parts.push({ z0: PH, z1: PH + 2, side: m.stS, top: m.stT, ao: 0.15, shape: (c) => sector(c, 0, cy, PR - 1, PR + 0.6, PI * 1.08, PI * 1.92) });
    parts.push({ z0: PH + 2, z1: PH + 4.2, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => { for (let i = 0; i < 9; i++) { const a = PI * 1.08 + i * PI * 0.84 / 9 + 0.04; sector(c, 0, cy, PR - 1, PR + 0.6, a, a + 0.15); } } });
    // the perch: stone pillars with an iron-banded beam
    parts.push(cyl(-6, cy - 12, 1.8, PH, PH + 11, m.stS, m.stT), cyl(6, cy - 12, 1.8, PH, PH + 11, m.stS, m.stT));
    parts.push(beams([[-8.5, cy - 12, PH + 11.8, 8.5, cy - 12, PH + 11.8]], 2, 1.8, m.wd, m.pk));
    parts.push(overlay((c) => { cylDeco(c, m, -6, cy - 12, 1.8, PH, PH + 11, { plain: true }); cylDeco(c, m, 6, cy - 12, 1.8, PH, PH + 11, { plain: true }); for (const x of [-7.5, -3, 3, 7.5]) seg2(c, [x, cy - 12 + 1 - PH - 12.8], [x, cy - 12 + 1 - PH - 10.8], m.iron, 0.55); }));
    // banners around the back rim
    parts.push(overlay((c, an) => { for (const a of [PI * 1.15, PI * 1.85]) { const x = Math.cos(a) * (PR - 1.6), y = cy + Math.sin(a) * (PR - 1.6); paintPole(c, m, x, y, PH, PH + 17, 6.5, 3.8, an, { tail: true, dir: x < 0 ? -1 : 1 }); } }));
    // front stair
    for (let i = 0; i < 8; i++) parts.push(box(-5, cy + PR - 1.5 + i * 1.5, 5, cy + PR + i * 1.5, 0, PH - 1 - i * (PH - 1) / 8, m.stS, m.stT, { ao: 0.2 }));
    parts.push(box(-6.2, cy + PR - 1, -5, cy + PR + 12, 0, 2, m.stD, m.stS), box(5, cy + PR - 1, 6.2, cy + PR + 12, 0, 2, m.stD, m.stS));
    // braziers at the stair head + banners
    for (const x of [-8.4, 8.4]) parts.push(cyl(x, cy + PR - 2, 1.2, PH, PH + 2.6, m.iron, m.ironL), cyl(x, cy + PR - 2, 1.7, PH + 2.6, PH + 3.4, m.iron, '#4a2a14'));
    parts.push(overlay((c, an) => {
      for (const x of [-8.4, 8.4]) {
        const y = cy + PR - 2 - PH - 3.4, f = Math.sin(an * TAU + x);
        glow(c, '#ff9a30', x, y - 1.2, 6.5, 0.65);
        S.fillPoly(c, '#ff7a20', [x - 1.4, y, x - 0.8 + f * 0.2, y - 2.6, x, y - 1.6, x + 0.4 - f * 0.2, y - 3.8, x + 1.4, y]);
        S.fillPoly(c, '#ffd36a', [x - 0.7, y, x, y - 2.2, x + 0.7, y]);
      }
      for (const x of [-13, 13]) paintPole(c, m, x, cy + PR + 1, 0, 15, 5.5, 3.2, an, { tail: true, dir: x < 0 ? -1 : 1 });
    }));
    return { r: 36, h: 36, parts, style: 'unit', bevel: 0.8 };
  };

  /* ================================================================ GATE (16 dirs) */
  // shaded facets for a stacked square pyramid (rotating models)
  function pyrFacets(cx, cy, hx0, hy0, z0, h, col, ex) {
    const dz = 1 / ((AS.Forge && AS.Forge.res) || 2);
    const mk = (cls, k) => Object.assign({ z0, z1: z0 + h, side: sh(col, k), top: sh(col, k), flat: true, bevel: false, ao: 0.08, shape: (c, zt) => {
      if (zt > 0.97) return;
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a), f = 1 - zt, hx = hx0 * f, hy = hy0 * f;
      const w = Math.max(hx0, hy0) * dz / h + dz * (cls === 'F' ? 1.05 : 0.2) + 0.05;
      const E = [[-1, 0, cx - hx, cy - hy, cx - hx, cy + hy], [1, 0, cx + hx, cy - hy, cx + hx, cy + hy], [0, -1, cx - hx, cy - hy, cx + hx, cy - hy], [0, 1, cx - hx, cy + hy, cx + hx, cy + hy]];
      for (const e of E) {
        const sx = e[0] * ca - e[1] * sa, sy = e[0] * sa + e[1] * ca;
        const c2 = sx < -0.4 ? 'L' : sx > 0.4 ? 'D' : sy > 0 ? 'F' : 'B';
        if (c2 !== cls) continue;
        const ix = -e[0] * w, iy = -e[1] * w;
        S.poly(c, [e[2], e[3], e[4], e[5], e[4] + ix, e[5] + iy, e[2] + ix, e[3] + iy]);
      }
    } }, ex || {});
    return [Object.assign({ z0, z1: z0 + h, side: col, top: col, ao: 0.1, shape: (c, zt) => { const f = 1 - zt; c.rect(cx - hx0 * f, cy - hy0 * f, hx0 * f * 2 + 0.01, hy0 * f * 2 + 0.01); } }, ex || {}), mk('F', -0.06), mk('L', 0.17), mk('D', -0.3)];
  }
  function gateTimber(m, open) {
    const parts = [], TX = 14, TS = 4.6, TH = 15;
    const C0 = { at: [0, 0] };
    parts.push(Object.assign({ z0: 0, z1: 0.8, side: m.dirtD, top: mx(m.dirt, '#7a8a46', 0.3), ao: 0.2, layer: -1, shape: (c) => S.rrect(c, -21, -4.4, 42, 8.8, 2) }));
    if (open) {
      // leaves swung back against the towers
      for (const sx of [-1, 1]) parts.push(box(sx * 9.4 - (sx > 0 ? 1 : 0), -0.2, sx * 9.4 + (sx > 0 ? 0 : 1), 9.4, 0.6, 11, m.wd, m.pk, { at: [sx * 9, 4] }));
    } else {
      parts.push(box(-9.4, -1.1, 9.4, 1.1, 0.6, 11, m.wd, m.pk, C0));
      parts.push(Object.assign({ z0: 0.6, z1: 11, side: m.wdD, top: m.wdD, flat: true, bevel: false, ao: 0, shape: (c, zt) => { for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) for (let x = -8.3; x < 9; x += 1.15) c.rect(x - 0.08, sg > 0 ? 1.0 : -1.25, 0.16, 0.25); } }, C0));
      for (const z of [2.6, 7.6]) parts.push(Object.assign({ z0: z, z1: z + 0.7, side: m.iron, top: m.iron, flat: true, bevel: false, ao: 0, shape: (c) => { for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) c.rect(-9.2, sg > 0 ? 1.0 : -1.3, 18.4, 0.3); } }, C0));
    }
    parts.push(box(-9.4, -2.8, 9.4, 2.8, 11, 12.2, m.wdD, m.pk, C0));
    const lg = logLine([-9, -2.1, 9, -2.1], 1.55, 15.6, 0.72, 5).concat(logLine([-9, 2.1, 9, 2.1], 1.55, 15.6, 0.72, 6));
    parts.push(...logParts(lg, 12.2, m.wd, m.wdL, C0));
    for (const sx of [-1, 1]) {
      const at = { at: [sx * TX, 0] }, x = sx * TX;
      parts.push(box(x - TS, -TS, x + TS, TS, 0, TH, m.pk, m.pk, Object.assign({ ao: 0.35 }, at)));
      parts.push(Object.assign({ z0: 1, z1: TH, side: m.pkD, top: m.pkD, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
        const z = 1 + zt * (TH - 1);
        const plank = (z % 1.5) < 0.45, slit = z > 8.5 && z < 11.5;
        for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!facing(c, nx, ny, 0.05)) continue;
          const px = x + nx * TS, py = ny * TS;
          if (plank) { if (nx) c.rect(px - (nx > 0 ? 0.04 : 0.2), py - TS, 0.24, TS * 2); else c.rect(x - TS, py - (ny > 0 ? 0.04 : 0.2), TS * 2, 0.24); }
          if (slit) { if (nx) c.rect(px - (nx > 0 ? 0.04 : 0.3), -0.3, 0.34, 0.6); else c.rect(x - 0.3, py - (ny > 0 ? 0.04 : 0.3), 0.6, 0.34); }
        }
      } }, at));
      parts.push(box(x - TS - 0.5, -TS - 0.5, x + TS + 0.5, TS + 0.5, TH - 1.4, TH, m.wdD, m.wd, Object.assign({ ao: 0 }, at)));
      parts.push(...pyrFacets(x, 0, TS + 1.3, TS + 1.3, TH, 7, m.rf, at));
      parts.push(...stackFlag(x, 0, TH + 6.5, TH + 13, 5, 3, m, at));
    }
    return { r: 22, h: 30, parts: withSorter(parts), style: 'unit', bevel: 0.7 };
  }
  M.human_gate = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), lv = U.clamp((opt.level | 0) || 2, 1, 3);
    if (lv === 1) return gateTimber(m, !!opt.open);
    const open = !!opt.open;
    const parts = [], L3 = lv === 3;
    const TR = L3 ? 7.2 : 6.4, TX = 13.6, TZ = L3 ? 24 : 20, CH = L3 ? 13 : 11, T = L3 ? 4.4 : 3.8, GH = L3 ? 16.5 : 14.5;
    const aw = L3 ? 4.4 : 4.0, as = L3 ? 7.6 : 7, C0 = { at: [0, 0] };
    const gh = (c, e) => { const t = T + e, r = TR + e, k = Math.sqrt(r * r - t * t), ph = Math.asin(t / r); c.moveTo(-TX + k, -t); c.lineTo(TX - k, -t); c.arc(TX, 0, r, PI + ph, PI - ph, true); c.lineTo(-TX + k, t); c.arc(-TX, 0, r, ph, -ph, true); c.closePath(); };
    parts.push({ z0: 0, z1: 1.6, side: m.stD, top: mx(m.stD, m.stS, 0.5), ao: 0.2, layer: -1, shape: (c) => { c.rect(-TX, -T - 0.8, TX * 2, (T + 0.8) * 2); S.circ(c, -TX, 0, TR + 0.9); S.circ(c, TX, 0, TR + 0.9); } });
    parts.push(Object.assign({ z0: 1.6, z1: GH, side: m.stS, top: m.stT, ao: 0.32, shape: (c) => gh(c, 0) }, C0));
    // camera-facing courses on the gatehouse faces
    parts.push(...wallTex([[-TX + TR * 0.95, TX - TR * 0.95, T, 1], [-TX + TR * 0.95, TX - TR * 0.95, -T, -1]], 1.6, GH, m, C0));
    const archW = (z, e) => (z < as ? aw + e : Math.sqrt(Math.max(0, (aw + e) * (aw + e) - (z - as) * (z - as))));
    const sliv = (z0, z1, col, fn, flat) => Object.assign({ z0, z1, side: col, top: col, flat: flat !== false, bevel: false, ao: flat === false ? 0.3 : 0, shape: (c, zt) => { const z = z0 + zt * (z1 - z0); for (const sg of [1, -1]) if (facing(c, 0, sg, 0.05)) fn(c, z, sg); } }, C0);
    parts.push(sliv(1.6, as + aw + 1.2, m.stL, (c, z, sg) => { const w = archW(z, 1.2); if (w > 0.05) c.rect(-w, sg > 0 ? T - 0.05 : -T - 0.3, w * 2, 0.35); }));
    parts.push(sliv(1.6, as + aw, '#1c1410', (c, z, sg) => { const w = archW(z, 0); if (w > 0.05) c.rect(-w, sg > 0 ? T + 0.05 : -T - 0.4, w * 2, 0.35); }));
    if (open) parts.push(sliv(1.6, 2.6, mx(m.cob, '#1c1410', 0.45), (c, z, sg) => c.rect(-aw, sg > 0 ? T + 0.1 : -T - 0.45, aw * 2, 0.35)));
    if (L3) {
      parts.push(sliv(1.6, 3.8, mx(m.gl, '#1c1410', 0.35), (c, z, sg) => c.rect(-aw, sg > 0 ? T + 0.1 : -T - 0.45, aw * 2, 0.35)));
      if (!open) parts.push(sliv(1.6, as + aw - 0.2, m.iron, (c, z, sg) => { const w = archW(z, 0) - 0.1, y = sg > 0 ? T + 0.15 : -T - 0.5; if ((z - 1.6) % 1.5 < 0.45) { c.rect(-w, y, w * 2, 0.35); return; } for (let x = -aw + 0.75; x < aw; x += 1.2) if (Math.abs(x) < w) c.rect(x - 0.2, y, 0.4, 0.35); }));
      else parts.push(sliv(as + aw - 1.6, as + aw - 0.2, m.iron, (c, z, sg) => { const w = archW(z, 0) - 0.1, y = sg > 0 ? T + 0.15 : -T - 0.5; for (let x = -aw + 0.75; x < aw; x += 1.2) if (Math.abs(x) < w) c.rect(x - 0.2, y, 0.4, 0.35); }));
      parts.push(sliv(GH - 6.5, GH - 0.6, m.k, (c, z, sg) => { const w = z < GH - 5.3 ? 1.3 * (z - GH + 6.5) / 1.2 : 1.3; c.rect(-w, sg > 0 ? T + 0.05 : -T - 0.45, w * 2, 0.4); }, false));
      parts.push(sliv(GH - 3.4, GH - 2.4, m.k2, (c, z, sg) => c.rect(-0.7, sg > 0 ? T + 0.3 : -T - 0.7, 1.4, 0.4)));
      parts.push(sliv(5, 9, m.gl, (c, z, sg) => { const w = 0.8 * (1 - Math.abs((z - 7) / 2)) + 0.1; for (const x of [-aw - 2.6, aw + 2.6]) c.rect(x - w, sg > 0 ? T - 0.05 : -T - 0.3, w * 2, 0.35); }));
    } else if (!open) {
      parts.push(sliv(1.6, as + aw - 0.3, m.wd, (c, z, sg) => { const w = archW(z, 0) - 0.3; if (w > 0.1) { c.rect(-w, sg > 0 ? T + 0.15 : -T - 0.5, w - 0.12, 0.35); c.rect(0.12, sg > 0 ? T + 0.15 : -T - 0.5, w - 0.12, 0.35); } }, false));
      parts.push(sliv(1.6, as + aw - 0.3, m.iron, (c, z, sg) => { if (!((z > 3.2 && z < 3.8) || (z > 7.2 && z < 7.8))) return; const w = archW(z, 0) - 0.3; c.rect(-w, sg > 0 ? T + 0.25 : -T - 0.6, w * 2, 0.35); }));
    }
    // corbelled walk + merlons
    parts.push(Object.assign({ z0: GH, z1: GH + 0.9, side: m.stT, top: sh(m.stT, -0.05), ao: 0, shape: (c) => gh(c, 0.6) }, C0));
    parts.push(Object.assign({ z0: GH + 0.9, z1: GH + 3.6, side: m.stS, top: m.stT, ao: 0.1, shape: (c) => { for (const x of [-4.6, 0, 4.6]) for (const sg of [1, -1]) c.rect(x - 1.2, sg > 0 ? T - 0.8 : -T - 0.6, 2.4, 1.4); } }, C0));
    // flanking round towers
    for (const sx of [-1, 1]) {
      const x = sx * TX, at = { at: [x, 0] };
      parts.push(Object.assign({ z0: 1.6, z1: TZ, side: m.stS, top: m.stT, ao: 0.32, shape: (c) => S.circ(c, x, 0, TR) }, at));
      parts.push(...crescents([[x, 0, TR]], 1.6, TZ, m.stS, 0.32, at));
      parts.push(Object.assign({ z0: 9, z1: 12, side: m.stL, top: m.stL, flat: true, bevel: false, ao: 0, shape: (c) => { for (const a of [PI / 2, -PI / 2, sx > 0 ? 0 : PI]) if (facing(c, Math.cos(a), Math.sin(a), 0.3)) S.circ(c, x + Math.cos(a) * (TR - 0.3), Math.sin(a) * (TR - 0.3), 0.75); } }, at));
      parts.push(Object.assign({ z0: 9.4, z1: 11.6, side: '#1c1410', top: '#1c1410', flat: true, bevel: false, ao: 0, shape: (c) => { for (const a of [PI / 2, -PI / 2, sx > 0 ? 0 : PI]) if (facing(c, Math.cos(a), Math.sin(a), 0.3)) S.circ(c, x + Math.cos(a) * (TR - 0.05), Math.sin(a) * (TR - 0.05), 0.4); } }, at));
      if (L3) parts.push(Object.assign({ z0: 12.5, z1: 21, side: m.k, top: m.k, ao: 0.25, bevel: false, shape: (c, zt) => { const w = zt < 0.15 ? 1.4 * zt / 0.15 : 1.4; for (const sg of [1, -1]) if (facing(c, 0, sg, 0.3)) c.rect(x - w, sg > 0 ? TR - 0.6 : -TR - 0.2, w * 2, 0.8); } }, at));
      const rc = TR + 1.2;
      parts.push(Object.assign({ z0: TZ - 0.6, z1: TZ + CH, side: m.rf, top: m.rf, ao: 0.12, shape: (c, zt) => S.circ(c, x, 0, rc * (1 - zt) + 0.1) }, at));
      parts.push(...coneShade([x, 0, rc], TZ - 0.6, TZ + CH, m.rf, at));
      parts.push(coneRows([[x, 0, rc, TZ - 0.6, CH + 0.6]], sh(m.rf, -0.22), at));
      if (L3) parts.push(...stackFlag(x, 0, TZ + CH - 1, TZ + CH + 6.5, 5, 3, m, at).slice(0, 2));
      else parts.push(Object.assign({ z0: TZ + CH - 0.4, z1: TZ + CH + 1, side: sh(m.k2, -0.3), top: m.k2, ao: 0, shape: (c) => S.circ(c, x, 0, 0.55) }, at));
    }
    return { r: 22, h: L3 ? 45 : 33, parts: withSorter(parts), style: 'unit', bevel: 0.7 };
  };

  /* ============================================================ BALLISTA (24 dirs) */
  M.human_ballista = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    parts.push({ z0: 0, z1: 2.2, side: m.stS, top: m.stT, ao: 0.3, layer: -3, shape: (c) => S.poly(c, ngon(8, 10.2, PI / 8)), detail: (c) => {
      c.beginPath(); c.strokeStyle = 'rgba(50,38,28,0.3)'; c.lineWidth = 0.22; for (let i = 0; i < 8; i++) { const a = PI / 8 + i / 8 * TAU; c.moveTo(Math.cos(a) * 5.4, Math.sin(a) * 5.4); c.lineTo(Math.cos(a) * 9.4, Math.sin(a) * 9.4); } c.moveTo(5.4, 0); c.arc(0, 0, 5.4, 0, TAU); c.stroke();
      c.beginPath(); c.strokeStyle = m.k2; c.lineWidth = 0.35; c.arc(0, 0, 8.6, 0, TAU); c.stroke();
    } });
    parts.push(cyl(0, 0, 5, 2.2, 2.9, m.iron, m.ironL, { layer: -3, detail: (c) => { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; S.dot(c, '#9a948a', Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0.32); } } }));
    parts.push(cyl(0, 0, 4.3, 2.9, 3.6, m.wd, m.pk, { layer: -2 }));
    parts.push(cyl(0, 0, 1.4, 3.6, 6.4, m.wdD, m.wd, { layer: -2 }));
    parts.push(beams([[-4.4, -1.4, 3.6, -1, 0, 6.4], [-4.4, 1.4, 3.6, -1, 0, 6.4], [3.4, 0, 3.6, 1, 0, 6.4]], 0.7, 0.6, m.wdD, m.wd, { layer: -2 }));
    parts.push(box(-9.6, -1.2, 8.2, 1.2, 6.4, 8, m.wd, m.pk, { at: [-0.5, 0], detail: (c) => { c.beginPath(); c.fillStyle = m.wdD; c.rect(-9, -0.28, 16, 0.56); c.fill(); } }));
    const FX = 6.4;
    parts.push(box(FX - 1.3, -4.4, FX + 1.3, 4.4, 5.6, 6.8, m.wdD, m.wd, { at: [FX, 0] }));
    for (const sg of [-1, 1]) parts.push(cyl(FX, sg * 2.9, 1.15, 6.8, 11.4, '#6e5236', '#8e6c4a', { at: [FX, sg * 2.9] }));
    parts.push(box(FX + 1.3, -4.4, FX + 1.9, 4.4, 5.6, 8.8, m.k, m.k, { at: [FX + 1.7, 0], ao: 0.2, detail: (c) => { c.beginPath(); c.fillStyle = m.k2; c.rect(FX + 1.3, -4.4, 0.6, 0.7); c.rect(FX + 1.3, 3.7, 0.6, 0.7); c.rect(FX + 1.3, -0.35, 0.6, 0.7); c.fill(); } }));
    for (const sg of [-1, 1]) parts.push(beams([[FX - 0.2, sg * 2.9, 9.1, 1.2, sg * 10.6, 9.8]], 1.05, 1, m.wd, m.pk, { at: [3.6, sg * 6.6] }));
    for (const sg of [-1, 1]) parts.push(beams([[1.5, sg * 10.2, 9.75, 0.9, sg * 11, 9.85]], 1.2, 1.1, m.iron, m.ironL, { at: [1.2, sg * 10.6] }));
    parts.push(box(FX - 1.4, -4.5, FX + 1.4, 4.5, 11.4, 12.5, m.wdD, m.wd, { at: [FX, 0], layer: 1, detail: (c) => { for (const sg of [-1, 1]) { S.dot(c, m.iron, FX, sg * 2.9, 1); S.dot(c, m.ironL, FX - 0.3, sg * 2.9 - 0.3, 0.38); } } }));
    parts.push(beams([[1.2, -10.8, 9.8, -7.4, 0, 9.2], [1.2, 10.8, 9.8, -7.4, 0, 9.2]], 0.3, 0.3, '#d6cab0', '#efe6d0', { layer: 1, at: [-3, 0] }));
    parts.push(beams([[-7.4, 0, 9.3, 12.2, 0, 9.3]], 0.6, 0.55, m.wd, m.wdL, { layer: 1, at: [2.4, 0] }));
    parts.push(beams([[12, 0, 9.3, 14.8, 0, 9.3]], 1, 0.9, m.iron, m.ironL, { layer: 1, at: [13.4, 0] }));
    parts.push({ z0: 9.3, z1: 10.6, side: m.k, top: m.k, ao: 0, bevel: false, stroke: 0.32, layer: 1, at: [-5.6, 0], shape: (c, t) => { c.moveTo(-6.9, 0); c.lineTo(-4.6 + t * 0.6, 0); } });
    // winch
    parts.push(box(-10.6, -2.8, -9, -1.9, 4.6, 9.2, m.wdD, m.wd, { at: [-9.8, -2.4] }), box(-10.6, 1.9, -9, 2.8, 4.6, 9.2, m.wdD, m.wd, { at: [-9.8, 2.4] }));
    parts.push({ z0: 7.2, z1: 9.2, side: m.wd, top: m.pk, ao: 0.1, at: [-9.8, 0], shape: (c, t) => { const w = Math.sqrt(Math.max(0.05, 1 - (2 * t - 1) * (2 * t - 1))); c.rect(-9.8 - w, -1.9, w * 2, 3.8); } });
    parts.push(beams([[-9.8, -2.9, 8.2, -11.6, -3.2, 10], [-9.8, 2.9, 8.2, -8, 3.2, 6.4]], 0.42, 0.42, m.iron, m.ironL, { at: [-10, 0], layer: 1 }));
    return { r: 16, h: 14, parts: withSorter(parts), style: 'unit', bevel: 0.7 };
  };

  /* ============================================================ CATAPULT (24 dirs, anims 3) */
  M.human_catapult = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), parts = [];
    parts.push({ z0: 0, z1: 1, side: m.stD, top: mx(m.stD, m.stS, 0.5), ao: 0.2, layer: -3, shape: (c) => S.rrect(c, -15.5, -8, 30, 16, 3) });
    parts.push(beams([[-12.5, -4.6, 2, 11, -4.6, 2], [-12.5, 4.6, 2, 11, 4.6, 2]], 1.6, 1.8, m.wdD, m.wd, { layer: -2 }));
    parts.push(beams([[-11.5, -5.6, 2.3, -11.5, 5.6, 2.3], [9.8, -5.6, 2.3, 9.8, 5.6, 2.3], [-1.5, -5.6, 2.3, -1.5, 5.6, 2.3]], 1.3, 1.3, m.wdD, m.wd, { layer: -2 }));
    parts.push(beams([[-12.5, -4.6, 1.2, -12.5, -4.6, 1.21], [-12.5, 4.6, 1.2, -12.5, 4.6, 1.21], [11, -4.6, 1.2, 11, -4.6, 1.21], [11, 4.6, 1.2, 11, 4.6, 1.21]], 0.6, 0.6, m.iron, m.ironL, { layer: -1 }));
    const piv = [-1.5, 0, 4];
    parts.push({ z0: 2.6, z1: 5.4, side: '#6e5236', top: '#8e6c4a', layer: -1, shape: (c, t) => { const z = 2.6 + t * 2.8, d = 1.4 * 1.4 - (z - piv[2]) * (z - piv[2]); if (d > 0) { const w = Math.sqrt(d); c.rect(piv[0] - w, -3.9, 2 * w, 7.8); } } });
    for (const sg of [-1, 1]) parts.push({ z0: 1.8, z1: 6.2, side: m.iron, top: m.ironL, at: [piv[0], sg * 4.6], shape: (c, t) => { const z = 1.8 + t * 4.4, d = 2.2 * 2.2 - (z - piv[2]) * (z - piv[2]); if (d > 0) { const w = Math.sqrt(d); c.rect(piv[0] - w, sg * 4.6 - 0.35 + sg * 0.6, 2 * w, 0.7); } } });
    const UX = 1.2;
    for (const sg of [-1, 1]) parts.push(beams([[UX, sg * 4.6, 2.2, UX, sg * 4.6, 14.2], [UX + 6, sg * 4.6, 2.4, UX + 0.4, sg * 4.6, 10.5]], 1.2, 1.2, m.wdD, m.wd, { at: [UX + 1.5, sg * 4.6] }));
    parts.push(beams([[UX, -5.4, 13.6, UX, 5.4, 13.6]], 1.4, 1.4, m.wd, m.pk, { layer: 1 }));
    parts.push(beams([[UX - 0.75, -2.4, 13.3, UX - 0.75, 2.4, 13.3]], 1.1, 1.4, m.k, sh(m.k, 0.2), { layer: 1 }));
    const L = 13;
    [[182, true], [128, true], [79, false]].forEach(([deg, loaded], i) => {
      const a = deg * PI / 180, tip = [piv[0] + Math.cos(a) * L, 0, piv[2] + Math.sin(a) * L];
      const when = (an) => Math.min(2, Math.floor(an * 3 + 1e-6)) === i;
      parts.push(beams([[piv[0], 0, piv[2], tip[0], 0, tip[2]]], 1.25, 1.2, mx(m.pk, m.wd, 0.2), sh(m.pk, 0.22), { when, at: [(piv[0] + tip[0]) / 2, 0] }));
      parts.push(beams([[piv[0] + Math.cos(a) * 3, 0, piv[2] + Math.sin(a) * 3, piv[0] + Math.cos(a) * 3.8, 0, piv[2] + Math.sin(a) * 3.8], [piv[0] + Math.cos(a) * 9, 0, piv[2] + Math.sin(a) * 9, piv[0] + Math.cos(a) * 9.8, 0, piv[2] + Math.sin(a) * 9.8]], 1.45, 1.3, m.iron, m.ironL, { when, at: [(piv[0] + tip[0]) / 2, 0.02] }));
      parts.push({ z0: tip[2] - 0.6, z1: tip[2] + 1.1, side: m.wdD, top: '#2a1c12', ao: 0.1, when, at: [tip[0], 0.03], shape: (c, t) => S.circ(c, tip[0], 0, 1.3 + t * 0.6) });
      if (loaded) parts.push({ z0: tip[2] + 0.5, z1: tip[2] + 3.3, side: '#8a857c', top: '#c4bfb4', ao: 0.25, when, at: [tip[0], 0.04], shape: (c, t) => S.circ(c, tip[0], 0, 1.5 * Math.sqrt(Math.max(0.06, 1 - (2 * t - 1) * (2 * t - 1)))) });
    });
    // winch + rope (taut while cocked)
    parts.push(box(-14.4, -2.6, -13, -1.8, 2.6, 6.2, m.wdD, m.wd, { at: [-13.7, -2.2] }), box(-14.4, 1.8, -13, 2.6, 2.6, 6.2, m.wdD, m.wd, { at: [-13.7, 2.2] }));
    parts.push({ z0: 4.4, z1: 6, side: m.wd, top: m.pk, at: [-13.7, 0], shape: (c, t) => { const w = 0.8 * Math.sqrt(Math.max(0.05, 1 - (2 * t - 1) * (2 * t - 1))); c.rect(-13.7 - w, -1.8, w * 2, 3.6); } });
    parts.push(beams([[-13.7, 0, 5.6, -12, 0, 4.4]], 0.25, 0.25, '#d6cab0', '#efe6d0', { at: [-13, 0], layer: 1, when: (an) => an < 0.3 }));
    parts.push(...stackFlag(-12.5, 5.6, 2.2, 12, 4.2, 2.6, m, { at: [-12.5, 5.6] }).slice(0, 2));
    return { r: 18, h: 21, parts: withSorter(parts), style: 'unit', bevel: 0.7 };
  };

  /* ================================================================= gallery */
  (AS.Gallery = AS.Gallery || []).push({ group: 'Human buildings', bg: 'human', items: [
    { name: 'keep L1', gen: 'human_keep', pal: 'human', opt: { level: 1 }, anims: 4 },
    { name: 'keep L2', gen: 'human_keep', pal: 'human', opt: { level: 2 }, anims: 4 },
    { name: 'keep L3', gen: 'human_keep', pal: 'human', opt: { level: 3 }, anims: 4 },
    { name: 'house v0', gen: 'human_house', pal: 'human', opt: { v: 0 } },
    { name: 'house v1', gen: 'human_house', pal: 'human', opt: { v: 1 } },
    { name: 'house v2', gen: 'human_house', pal: 'human', opt: { v: 2 } },
    { name: 'house v3', gen: 'human_house', pal: 'human', opt: { v: 3 }, anims: 4 },
    { name: 'house v1 slate', gen: 'human_house', pal: 'human', opt: { v: 1, slate: true } },
    { name: 'barracks', gen: 'human_barracks', pal: 'human', anims: 4 },
    { name: 'farm', gen: 'human_farm', pal: 'human' },
    { name: 'stable', gen: 'human_stable', pal: 'human', anims: 4 },
    { name: 'archer tower', gen: 'human_tower', pal: 'human', anims: 4 },
    { name: 'mage tower', gen: 'human_magetower', pal: 'human', anims: 4 },
    { name: 'watchtower', gen: 'human_watchtower', pal: 'human', anims: 4 },
    { name: 'temple', gen: 'human_temple', pal: 'human', anims: 4 },
    { name: 'market', gen: 'human_market', pal: 'human', anims: 4 },
    { name: 'workshop', gen: 'human_workshop', pal: 'human', anims: 4 },
    { name: 'wardstone', gen: 'human_wardstone', pal: 'human', anims: 4 },
    { name: 'roost', gen: 'human_roost', pal: 'human', anims: 4 },
  ] });
  (AS.Gallery = AS.Gallery || []).push({ group: 'Human defences', bg: 'human', items: [
    { name: 'wall L1', gen: 'human_wall', pal: 'human', opt: { level: 1 }, dirs: 16 },
    { name: 'wall L2', gen: 'human_wall', pal: 'human', opt: { level: 2 }, dirs: 16 },
    { name: 'wall L3', gen: 'human_wall', pal: 'human', opt: { level: 3 }, dirs: 16 },
    { name: 'gate L1', gen: 'human_gate', pal: 'human', opt: { level: 1 }, dirs: 16 },
    { name: 'gate L2', gen: 'human_gate', pal: 'human', opt: { level: 2 }, dirs: 16 },
    { name: 'gate L3', gen: 'human_gate', pal: 'human', opt: { level: 3 }, dirs: 16 },
    { name: 'gate L2 open', gen: 'human_gate', pal: 'human', opt: { level: 2, open: true }, dirs: 16 },
    { name: 'gate L1 open', gen: 'human_gate', pal: 'human', opt: { level: 1, open: true }, dirs: 16 },
    { name: 'ballista', gen: 'human_ballista', pal: 'human', dirs: 24 },
    { name: 'catapult', gen: 'human_catapult', pal: 'human', dirs: 24, anims: 3 },
  ] });
})(window.AS);
