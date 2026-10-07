/* WYRMCROWN — extra town buildings for the four kingdoms (building variety).
 * For each kingdom (human / elf / ice / undead) this file adds a second house family
 * and two outbuildings, in the same style and technique as that kingdom's own
 * architecture file (the private helpers of those files are copied here, section by
 * section, because each file keeps them inside its own closure):
 *   <fk>_house2   opt.v 0 manor · 1 hovel · 2 workshop · 3 tavern / inn
 *   <fk>_shed     small open-fronted store (logs, barrels, crates) ~14 x 10, 8 tall
 *   <fk>_granary  raised store / silo / dovecote ~10 x 10, 16-20 tall
 * All are 1-direction sheets (+y faces the camera), 1 anim frame, style 'unit'.
 * Palette keys as in data/palettes.js (a b t g d k k2 w s); missing keys fall back
 * to the kingdom's defaults. */
'use strict';
/* =============================================================================
 * KINGDOM OF ALDERMERE (human) — painted-face technique of models_human.js
 * ============================================================================= */
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});
  const PI = Math.PI;
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


  /* ===================================================== extra helpers */
  // thatch roof with a sagging (and optionally tilted) ridge along x, painted like roofGX:
  // both planes end on the same screen-space ridge curve. Returns { faces, lines, zAt, zr, zE }.
  function roofThatch(cx, cy, L, D, ze, hr, o) {
    o = o || {};
    const ov = o.ov !== undefined ? o.ov : 2.2, ovx = o.ovx !== undefined ? o.ovx : 1.6, sag = o.sag || 1.4, tilt = o.tilt || 0;
    const hd = D / 2, k = hr / hd, zE = ze - ov * k, zr = ze + hr;
    const run = hd + ov, x0 = cx - L / 2 - ovx, x1 = cx + L / 2 + ovx, yf = cy + run, yb = cy - run, Lx = x1 - x0;
    const Sl = Math.hypot(run, zr - zE), col = o.roofCol;
    const N = 12, ridgeZ = (u) => zr + tilt * (1 - 2 * u / Lx) - sag * Math.sin(PI * u / Lx);
    const dyB = (run - (zr - zE)) / Sl, dyF = (-run - (zr - zE)) / Sl;
    const pB = [0, 0, Lx, 0], pF = [0, 0, Lx, 0];
    for (let i = N; i >= 0; i--) {
      const u = Lx * i / N, ys = cy - ridgeZ(u);
      pB.push(u, Math.abs(dyB) < 0.05 ? Sl : (ys - (yb - zE)) / dyB);
      pF.push(u, (ys - (yf - zE)) / dyF);
    }
    const paint = o.paint;
    const faces = [face([x0, yb, zE], [1, 0, 0], [0, run, zr - zE], pB, { col, rows: 0, paint, contrast: 0.6 }), face([x0, yf, zE], [1, 0, 0], [0, -run, zr - zE], pF, { col, rows: 0, paint, contrast: 0.6 })];
    const lines = [];
    for (let i = 0; i < N; i++) { const ua = Lx * i / N, ub = Lx * (i + 1) / N; lines.push({ a: [x0 + ua, cy, ridgeZ(ua)], b: [x0 + ub, cy, ridgeZ(ub)], t: 'ridge', col: o.ridgeCol, hi: o.ridgeHi }); }
    lines.push({ a: [x0, yf, zE], b: [x0, cy, ridgeZ(0)], t: 'verge' }, { a: [x1, yf, zE], b: [x1, cy, ridgeZ(Lx)], t: 'verge' }, { a: [x0, yf, zE], b: [x1, yf, zE], t: 'eave' });
    const zAt = (x, y) => { const t = Math.max(0, run - Math.abs(y - cy)) / run; return zE + t * (ridgeZ(U.clamp(x - x0, 0, Lx)) - zE); };
    return { faces, lines, zAt, zr, zE, front: yf };
  }
  // thatch texture in a roof face's local frame: straw streaks down the slope + layer bands
  function thatchPaint(c, f, u0, u1, w0, w1) {
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(70,44,14,0.22)'; c.lineWidth = 0.3; c.beginPath();
    for (let u = u0 + 0.3, i = 0; u < u1; u += 0.85, i++) { const d = (U.hash2(i, 3, 9) - 0.5) * 0.9; c.moveTo(u, w0); c.lineTo(u + d, w1); }
    c.stroke();
    c.strokeStyle = 'rgba(255,240,190,0.2)'; c.lineWidth = 0.26; c.beginPath();
    for (let u = u0 + 0.72, i = 0; u < u1; u += 0.85, i++) { const d = (U.hash2(i, 5, 9) - 0.5) * 0.9; c.moveTo(u, w0); c.lineTo(u + d, w1); }
    c.stroke();
    c.strokeStyle = 'rgba(60,36,10,0.3)'; c.lineWidth = 0.5; c.beginPath();
    for (let w = w0 + 2.6; w < w1 - 1; w += 2.6) { c.moveTo(u0 - 1, w); for (let u = u0; u <= u1 + 1; u += 1.5) c.lineTo(u, w + 0.25 * Math.sin(u * 1.7 + w)); }
    c.stroke();
  }
  // stack of logs lying along y, ends toward the camera: x centre, half length hl, n0 logs in the bottom row
  function logPile(K, x, y, hl, n0, rows, r) {
    const m = K.m; r = r || 0.65;
    const logs = [];
    for (let row = 0; row < rows; row++) for (let i = 0; i < n0 - row; i++) logs.push([x + (i - (n0 - row - 1) / 2) * r * 2.05, row * r * 1.72 + r]);
    const zt1 = (rows - 1) * r * 1.72 + r * 2;
    K.parts.push({ z0: 0, z1: zt1, side: m.pkD, top: m.pk, ao: 0.35, bevel: false, shape: (c, zt) => {
      const z = zt * zt1;
      for (const g of logs) { const dz = z - g[1]; if (Math.abs(dz) > r) continue; const w = Math.sqrt(r * r - dz * dz); c.rect(g[0] - w, y - hl, w * 2, hl * 2); }
    } });
    K.parts.push(overlay((c) => { for (const g of logs) { const sy = y + hl - g[1]; S.dot(c, sh(m.pk, 0.22), g[0], sy, r * 0.95); S.dot(c, m.pkD, g[0], sy, r * 0.58); S.dot(c, sh(m.pk, 0.1), g[0], sy, r * 0.26); } }));
  }
  // stone or timber lean-to: walls z0..zHi at the back, open or boarded front, painted shed roof (pushed by the caller)
  function sideWalls(parts, m, x0, x1, yb, yf, zHi, zLo, t, col, colT) {
    const zAt = (y) => zLo + (zHi - zLo) * U.clamp((yf - y) / (yf - yb), 0, 1);
    parts.push({ z0: 0, z1: zHi, side: col, top: colT, ao: 0.3, shape: (c, zt) => {
      const z = zt * zHi; let yEnd = yf;
      if (z > zLo) yEnd = yf - (yf - yb) * (z - zLo) / (zHi - zLo);
      if (yEnd > yb + 0.2) { c.rect(x0, yb, t, yEnd - yb); c.rect(x1 - t, yb, t, yEnd - yb); }
      c.rect(x0, yb, x1 - x0, t);
    } });
    return zAt;
  }
  // hanging shop / inn sign on a post with a crossarm toward +x (painted; post at x, y)
  function postSign(c, m, x, y, zTop, arm, w, h, emblem) {
    seg2(c, [x, y], [x, y - zTop], m.wdD, 0.8); seg2(c, [x - 0.2, y - 0.4], [x - 0.2, y - zTop + 0.2], m.wdL, 0.25);
    seg2(c, [x - 0.4, y - zTop + 0.3], [x + arm, y - zTop + 0.3], m.wdD, 0.7);
    seg2(c, [x + 0.3, y - zTop + 1.2], [x + arm * 0.45, y - zTop + 0.35], m.wdD, 0.45);
    const sx = x + arm - w / 2 - 0.6, top = y - zTop + 1.3;
    seg2(c, [sx + 0.5, y - zTop + 0.6], [sx + 0.5, top], m.iron, 0.3); seg2(c, [sx + w - 0.5, y - zTop + 0.6], [sx + w - 0.5, top], m.iron, 0.3);
    c.fillStyle = m.wdD; c.fillRect(sx - 0.25, top - 0.25, w + 0.5, h + 0.5);
    c.fillStyle = m.pk; c.fillRect(sx, top, w, h);
    c.strokeStyle = 'rgba(40,22,10,0.35)'; c.lineWidth = 0.2; c.beginPath(); c.moveTo(sx, top + h * 0.5); c.lineTo(sx + w, top + h * 0.5); c.stroke();
    emblem(c, sx + w / 2, top + h / 2, w, h);
  }

  /* ============================================================ HOUSE 2
   * v0 manor: slate-roofed two-storey hall with twin chimneys and dormers, a jettied
   *    gabled front wing and a walled cobbled yard on the right
   * v1 hovel: sagging weathered thatch, patched cob walls, a lean-to and a woodpile
   * v2 smithy: stone house with an open-fronted forge under an awning, tall chimney,
   *    glowing forge mouth, anvil and quench trough
   * v3 inn: wide half-timbered hall, cross-gable dormer, hanging sign, stable annex, barrels */
  M.human_house2 = function (pal, opt) {
    opt = opt || {};
    const m = mats(pal), v = ((opt.v | 0) % 4 + 4) % 4;
    const parts = [], K = { m, parts, R: 23 };
    let H = 30, R = 23;
    if (v === 0) {
      m.rf = '#5b6472'; m.rfD = sh(m.rf, -0.45); m.rfL = sh(m.rf, 0.3);
      const h = hall(K, { cx: 4, cy: -5, W: 28, D: 15, ze: 16, upper: 8.5, jetty: 0.8, hr: 9.5, roof: 'hip', ro: { rows: 1.7 },
        wins: [[5, 2.6, 2.4, 3.4, { arch: true }], [11, 2.6, 2.4, 3.4, { arch: true }], [16.5, 2.6, 2, 3.2, { arch: true }], [4, 10.6, 2.2, 2.8, { box: true }], [9.5, 10.6, 2.2, 2.8], [15, 10.6, 2.2, 2.8, { box: true }]],
        chim: [[-8, -9.5, 3.6], [15.5, -9.5, 3.6]], frame: { pat: 'x', sp: 3.3 }, seed: 12 });
      dormer(K, h.roof, 4.5, 5.2, 3.5, 3.2, 2);
      dormer(K, h.roof, 13.5, 5.2, 3.5, 3.2, 2);
      // front wing with the lit door
      parts.push(box(-13.3, 2.5, 1.3, 11.4, 0, 1.2, m.stD, mx(m.stD, m.stS, 0.5), { ao: 0.25 }));
      hall(K, { cx: -6, cy: 5.2, W: 13, D: 10.6, ze: 16, upper: 8.5, jetty: 0.7, hr: 8.6, plinth: false, clip: behind(h.roof, 3.1), door: [-6, 3.4, 5.6, { lit: true }],
        wins: [[-10, 2.6, 2.2, 2.8, { shut: m.k }], [-2, 2.6, 2.2, 2.8, { shut: m.k }], [-9.2, 10.4, 2.2, 2.8], [-2.8, 10.4, 2.2, 2.8]], ro: { valley: h.roof.valley, ovb: 0, rows: 1.7 },
        gd: { attic: [2, 2.4] }, frame: { pat: 'k', sp: 3.2 }, seed: 14 });
      // walled cobbled yard with a timber gate
      const yard = rrP(9.5, 3.6, 21.5, 15.5, 1.5);
      parts.push(pad(yard, m.cob, sh(m.cob, -0.3), 'flag', 5));
      parts.push(overlay((c) => castShadow(c, yard, [[9.5, 3, 18, 3.6, 10]])));
      parts.push(box(20, 3.6, 21.5, 15.5, 0, 3.4, m.stS, m.stT, { ao: 0.3 }));
      parts.push(box(9.5, 14, 13.8, 15.5, 0, 3.4, m.stS, m.stT, { ao: 0.3 }), box(17.2, 14, 21.5, 15.5, 0, 3.4, m.stS, m.stT, { ao: 0.3 }));
      parts.push(box(13.2, 13.7, 14.2, 15.7, 0, 4.4, m.stS, m.stT, { ao: 0.25 }), box(16.8, 13.7, 17.8, 15.7, 0, 4.4, m.stS, m.stT, { ao: 0.25 }));
      parts.push(box(14.2, 14.3, 16.8, 14.9, 0, 3.4, m.wd, m.pk, { ao: 0.2 }));
      barrels(K, [[18.5, 6.8, 1.5]], 3.4);
      crates(K, [[12.5, 7.2, 2.6, 2.3], [15.5, 7.8, 2, 1.8]]);
      parts.push(overlay((c) => {
        onFace(c, 15.5, (c) => { ashlar(c, 9.5, 13.8, 0, 3.4, 4, { ch: 1.7, bw: 2.8 }); ashlar(c, 17.2, 21.5, 0, 3.4, 6, { ch: 1.7, bw: 2.8 }); c.fillStyle = m.stT; c.fillRect(9.3, 3.1, 4.7, 0.5); c.fillRect(17, 3.1, 4.7, 0.5); });
        onFace(c, 14.9, (c) => { planks(c, m, 14.2, 16.8, 0, 3.4); c.strokeStyle = m.iron; c.lineWidth = 0.3; c.beginPath(); c.moveTo(14.3, 0.9); c.lineTo(16.7, 2.6); c.stroke(); });
        onFace(c, 15.7, (c) => { c.fillStyle = m.stT; c.fillRect(13, 4.3, 1.4, 0.5); c.fillRect(16.6, 4.3, 1.4, 0.5); });
      }));
      H = 31; R = 24;
    } else if (v === 1) {
      // crooked cob hovel under weathered, sagging thatch
      const cob = mx(m.pl, '#9a8a66', 0.45), cobT = sh(cob, 0.1), thatch = mx(m.straw, '#6e5a34', 0.4);
      const wall = [-7.2, -4.4, 7.6, -5, 7.2, 6.4, -7.6, 6.4];
      parts.push({ z0: 0, z1: 1, side: m.dirtD, top: m.dirt, ao: 0.2, shape: (c) => S.poly(c, [-8.6, -5, 9.2, -5.6, 8.5, 7.2, -9, 7.2]) });
      parts.push({ z0: 0, z1: 7.4, side: cob, top: cobT, ao: 0.34, shape: (c) => S.poly(c, wall) });
      // lean-to on the right (planks)
      parts.push(box(7.2, -2.2, 12.6, 6.6, 0, 3.8, m.pkD, m.pk, { ao: 0.3 }));
      const rf = roofThatch(0, 0.9, 14.6, 11.2, 7.4, 6.6, { roofCol: thatch, sag: 1.7, tilt: 0.8, ov: 1.5, ovx: 1.6, paint: thatchPaint, ridgeCol: mx(thatch, m.d, 0.5), ridgeHi: sh(thatch, 0.35) });
      const lean = roofShed(7.6, 13.4, -2.6, 7.6, 5.6, 3.9, thatch, 0);
      lean.faces[0].paint = thatchPaint; lean.faces[0].contrast = 0.6;
      parts.push(overlay((c) => {
        onFace(c, 6.4, (c) => {
          // patched cob, crooked studs, a shuttered window and a plank door
          c.fillStyle = 'rgba(80,60,36,0.2)'; c.fillRect(-6.2, 1.2, 2.6, 2.1); c.fillRect(3.4, 4.3, 2.3, 1.9); c.fillStyle = 'rgba(255,240,210,0.12)'; c.fillRect(0.5, 0.6, 2, 1.4);
          c.strokeStyle = m.wdD; c.lineWidth = 0.6; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-6.9, 0); c.lineTo(-6.6, 7.4); c.moveTo(-0.4, 0); c.lineTo(-0.1, 7.4); c.moveTo(6.4, 0); c.lineTo(6.9, 7.4); c.moveTo(-7.2, 6.6); c.lineTo(7.2, 6.9); c.stroke();
          win(c, m, 3.4, 2.2, 1.7, 1.8, { shut: m.pkD });
          door(c, m, -3.6, 0, 2.8, 4.4, { frame: m.pkD });
          shadeBand(c, -7.6, 7.2, 7.4, 1.8, 0.3);
        });
        onFace(c, 6.6, (c) => { planks(c, m, 7.2, 12.6, 0, 3.8); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(9.2, 0, 2.2, 2.6); });
        paintFaces(c, rf.faces, K.R); paintLines(c, rf.lines, m);
        // thick cut edge of the thatch along the eave, moss near the eave
        const ey = rf.front - rf.zE;
        c.fillStyle = mx(thatch, m.d, 0.3); c.fillRect(-8.9, ey - 0.1, 17.8, 1.1);
        c.strokeStyle = 'rgba(255,230,170,0.25)'; c.lineWidth = 0.25; c.beginPath(); for (let x = -8.6; x < 8.9; x += 0.7) { c.moveTo(x, ey); c.lineTo(x + 0.15, ey + 1); } c.stroke();
        c.fillStyle = 'rgba(60,96,34,0.55)'; c.beginPath(); S.blob(c, 3.8, ey - 1.6, 1.5, 4, 8, 0.45); c.fill();
        c.fillStyle = 'rgba(60,96,34,0.45)'; c.beginPath(); S.blob(c, -5.2, ey - 2.4, 1.1, 7, 8, 0.45); c.fill();
        paintFaces(c, lean.faces, K.R); paintLines(c, lean.lines, m);
        c.fillStyle = mx(thatch, m.d, 0.3); c.fillRect(7.5, 7.6 - 3.9 - 0.1, 6, 0.9);
      }));
      // crooked clay chimney pot on the back slope + smoke
      const czb = rf.zAt(-4, -0.5);
      parts.push({ z0: czb - 1.2, z1: czb + 3.4, side: mx(m.rf, m.d, 0.3), top: mx(m.rf, m.stT, 0.3), ao: 0.15, shape: (c, zt) => S.circ(c, -4 + zt * 0.6, -0.5, zt > 0.8 ? 0.95 : 0.75), detail: (c) => S.dot(c, '#1c1512', -3.4, -0.5, 0.45) });
      parts.push(overlay((c) => { for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(160,150,140,' + (0.3 - i * 0.05) + ')'; c.beginPath(); c.arc(-3.3 + i * 0.9, -0.5 - czb - 3.6 - i * 1.5, 0.8 + i * 0.35, 0, TAU); c.fill(); } }));
      logPile(K, -11.2, 3.2, 2.4, 4, 2, 0.62);
      parts.push(cyl(10.6, 9.2, 1, 0, 1.6, mx(m.wd, '#8a6a44', 0.5), mx(m.wd, '#b89468', 0.5), { ao: 0.3, detail: (c) => S.dot(c, '#2a3a44', 10.6, 9.2, 0.7) }));
      H = 17; R = 16;
    } else if (v === 2) {
      // smithy: stone house, open forge under a tiled awning, tall chimney, glowing hearth
      const h = hall(K, { cx: -3, cy: -3.5, W: 24, D: 13, ze: 10, roof: 'gx', hr: 7, ro: { rows: 1.7 }, wins: [[-10.5, 3.2, 2.2, 2.8, { shut: m.k }], [-4.5, 7, 1.6, 1.6]], door: [-4.5, 3.4, 5.2, { lit: true }], chim: [[-12, -6, 2.4]], seed: 21 });
      // forge hearth with its stack (lower part under the awning)
      const hx0 = 3, hx1 = 8.6, hy0 = 7, hy1 = 12;
      parts.push(box(hx0, hy0, hx1, hy1, 0, 5, m.stS, m.stT, { ao: 0.32, detail: (c) => { c.fillStyle = 'rgba(30,20,14,0.5)'; c.fillRect(hx0 + 0.5, hy0 + 0.5, hx1 - hx0 - 1, 2.6); } }));
      const sx0 = 4, sx1 = 7.6, sy0 = 7.3, sy1 = 9.8;
      parts.push(box(sx0, sy0, sx1, sy1, 5, 6.6, m.stS, m.stT, { ao: 0.2 }));
      parts.push(beams([[1, 10.6, 0, 1, 10.6, 6.6], [12.6, 10.6, 0, 12.6, 10.6, 6.6], [1, 10.6, 6.2, 12.6, 10.6, 6.2]], 1.1, 0.7, m.wdD, m.wd));
      const aw = roofShed(0.2, 13.2, 3.1, 10.9, 8.3, 6.3, m.rf, 1.6);
      parts.push(overlay((c) => {
        onFace(c, hy1, (c) => {
          ashlar(c, hx0, hx1, 0, 5, 7, { ch: 1.5, bw: 2.4 });
          c.fillStyle = '#1a0e08'; c.beginPath(); c.moveTo(hx0 + 1, 0.6); c.lineTo(hx0 + 1, 2.8); c.arc((hx0 + hx1) / 2, 2.8, (hx1 - hx0) / 2 - 1, PI, 0, true); c.lineTo(hx1 - 1, 0.6); c.closePath(); c.fill();
          const g = c.createRadialGradient((hx0 + hx1) / 2, 1.6, 0.2, (hx0 + hx1) / 2, 1.6, 2.6);
          g.addColorStop(0, '#fff2a0'); g.addColorStop(0.35, '#ff9a30'); g.addColorStop(0.75, 'rgba(200,60,10,0.7)'); g.addColorStop(1, 'rgba(120,20,0,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(hx0 + 1, 0.6); c.lineTo(hx0 + 1, 2.8); c.arc((hx0 + hx1) / 2, 2.8, (hx1 - hx0) / 2 - 1, PI, 0, true); c.lineTo(hx1 - 1, 0.6); c.closePath(); c.fill();
          c.fillStyle = m.stD; c.fillRect(hx0 - 0.3, 4.3, hx1 - hx0 + 0.6, 0.6);
        });
        glow(c, '#ff8a2a', 5.8, hy1 + 1.2, 5.5, 0.3);
        paintFaces(c, aw.faces, K.R); paintLines(c, aw.lines, m);
      }));
      // stack above the awning, with a soft smoke plume
      parts.push({ z0: 6.6, z1: 21, side: m.stS, top: m.stT, ao: 0.12, shape: (c, zt) => { const e = zt > 0.93 ? 0.45 : 0; c.rect(sx0 - e, sy0 - e, sx1 - sx0 + e * 2, sy1 - sy0 + e * 2); }, detail: (c) => { c.beginPath(); c.fillStyle = '#1c1512'; c.rect(sx0 + 0.5, sy0 + 0.5, sx1 - sx0 - 1, sy1 - sy0 - 1); c.fill(); } });
      parts.push(overlay((c) => { for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(120,110,104,' + (0.3 - i * 0.05) + ')'; c.beginPath(); c.arc(5.8 + i * 1.1 + Math.sin(i * 2) * 0.5, sy0 + 1 - 21.6 - i * 1.6, 1 + i * 0.4, 0, TAU); c.fill(); } }));
      // anvil on a stump, quench trough, barrel
      parts.push(cyl(10.6, 13.6, 1.3, 0, 2.4, m.wd, m.pk, { ao: 0.3, detail: (c) => { c.strokeStyle = 'rgba(40,24,12,0.5)'; c.lineWidth = 0.22; c.beginPath(); c.arc(10.6, 13.6, 0.7, 0, TAU); c.stroke(); } }));
      parts.push({ z0: 2.4, z1: 3.7, side: m.iron, top: m.ironL, ao: 0.2, shape: (c, zt) => { const w = zt < 0.4 ? 0.9 : 1.5; c.rect(10.6 - w, 13.2, w * 2 + (zt > 0.4 ? 0.9 : 0), 0.9); } });
      parts.push(box(-3.8, 11.6, 0.6, 13.6, 0, 2, mx(m.wd, '#8a6a44', 0.5), mx(m.wd, '#b89468', 0.5), { ao: 0.3, detail: (c) => { c.fillStyle = '#2b3d48'; c.fillRect(-3.4, 12, 3.6, 1.2); S.dot(c, 'rgba(255,255,255,0.35)', -2.6, 12.4, 0.3); } }));
      parts.push(overlay((c) => onFace(c, 13.6, (c) => planks(c, m, -3.8, 0.6, 0, 2))));
      barrels(K, [[-11.5, 8.4, 1.5]], 3.4);
      H = 26; R = 19;
    } else {
      // half-timbered inn: wide hall, cross-gable dormer, sign post, stable annex, barrels
      const h = hall(K, { cx: -3, cy: -3, W: 28, D: 16, ze: 15, upper: 7.5, jetty: 1, hr: 9.5, roof: 'hip', ro: { rows: 1.8 },
        wins: [[-8, 2.6, 2.4, 2.8, { shut: m.k }], [5, 2.6, 2.4, 2.8, { shut: m.k }], [-13, 9.6, 2.2, 2.6, { box: true }], [-7.5, 9.6, 2.2, 2.6], [1.5, 9.6, 2.2, 2.6], [7, 9.6, 2.2, 2.6, { box: true }]],
        door: [-2, 3.8, 5.6, { lit: true }], chim: [[-12, -6, 3, true]], frame: { pat: 'k', sp: 3.4 }, seed: 31 });
      dormer(K, h.roof, -3, 6, 3.6, 3.4, 4);
      // stable annex: plank walls, gabled tile roof, wide split door
      hall(K, { cx: 15.5, cy: 2, W: 9, D: 12, ze: 7, wall: 'wood', roof: 'gx', hr: 4.6, ro: { rows: 1.6 }, seed: 33, deco: (c) => onFace(c, 8, (c) => {
        c.fillStyle = m.stL; c.fillRect(12.6, 0, 5.8, 5.2); c.fillStyle = m.pkD; c.fillRect(13, 0, 5, 4.8);
        c.strokeStyle = 'rgba(30,16,8,0.55)'; c.lineWidth = 0.22; c.beginPath(); for (let x = 13.8; x < 18; x += 0.85) { c.moveTo(x, 0); c.lineTo(x, 4.8); } c.stroke();
        c.strokeStyle = m.iron; c.lineWidth = 0.4; c.beginPath(); c.moveTo(13, 2.5); c.lineTo(18, 2.5); c.moveTo(13.2, 1); c.lineTo(15.3, 1); c.moveTo(13.2, 3.9); c.lineTo(15.3, 3.9); c.moveTo(15.5, 0); c.lineTo(15.5, 4.8); c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(15.6, 2.5, 2.4, 2.3);
        c.fillStyle = m.stD; c.fillRect(12.4, -0.3, 6.2, 0.5);
      }) });
      // hay by the stable, barrels by the door, inn sign on a post
      haystack(K, 21.5, 10.5, 2.6, 3.2);
      barrels(K, [[-7.2, 10.2, 1.6], [-4, 10.9, 1.6]], 3.6);
      parts.push(overlay((c) => postSign(c, m, -15.5, 10.2, 11.5, 5.2, 4.2, 3.2, (c, x, y, w, hh) => {
        // tankard emblem
        c.fillStyle = m.pl; c.fillRect(x - w / 2 + 0.3, y - hh / 2 + 0.3, w - 0.6, hh - 0.6);
        c.fillStyle = m.k; c.fillRect(x - 0.9, y - 0.8, 1.6, 2); c.strokeStyle = m.k; c.lineWidth = 0.4; c.beginPath(); c.arc(x + 1, y + 0.2, 0.55, -PI / 2, PI / 2); c.stroke();
        c.fillStyle = m.k2; c.fillRect(x - 0.9, y - 1.1, 1.6, 0.45);
      })));
      H = 29; R = 24;
    }
    return { r: R, h: H, parts, style: 'unit', bevel: 0.8 };
  };

  /* ============================================================== SHED
   * open-fronted stone store under a tiled lean-to roof: firewood, barrels and a crate */
  M.human_shed = function (pal, opt) {
    const m = mats(pal), parts = [], K = { m, parts, R: 10 };
    parts.push({ z0: 0, z1: 0.6, side: m.dirtD, top: m.dirt, ao: 0.2, bevel: false, shape: (c) => S.rrect(c, -8.2, -5.8, 16.4, 11.4, 2) });
    sideWalls(parts, m, -7.4, 7.4, -5.2, 4.4, 7.8, 6.4, 1.5, m.stS, m.stT);
    parts.push(overlay((c) => { c.fillStyle = 'rgba(20,14,8,0.45)'; c.fillRect(-5.9, -3.7, 11.8, 8.2); }));
    logPile(K, -3.2, 0.4, 2.4, 4, 3, 0.62);
    barrels(K, [[2.6, 1.8, 1.35], [5.2, 1.5, 1.35]], 3);
    crates(K, [[4.2, -2.2, 2.4, 2.2]]);
    parts.push(beams([[-6.7, 4.3, 0, -6.7, 4.3, 7.1], [6.7, 4.3, 0, 6.7, 4.3, 7.1], [-7.3, 4.3, 6.7, 7.3, 4.3, 6.7]], 1, 0.7, m.wdD, m.wd));
    const rf = roofShed(-8.4, 8.4, -5.8, 4.6, 8.9, 7.2, m.rf, 1.6);
    parts.push(overlay((c) => {
      onFace(c, 4.4, (c) => { ashlar(c, -7.4, -5.9, 0, 6.4, 3, { ch: 1.6, bw: 2.2 }); ashlar(c, 5.9, 7.4, 0, 6.4, 4, { ch: 1.6, bw: 2.2 }); });
      paintFaces(c, rf.faces, K.R); paintLines(c, rf.lines, m);
    }));
    return { r: 10, h: 10, parts, style: 'unit', bevel: 0.8 };
  };

  /* =========================================================== GRANARY
   * timber granary raised on staddle stones, pyramid tile roof with a finial, ladder */
  M.human_granary = function (pal, opt) {
    const m = mats(pal), parts = [], K = { m, parts, R: 8 };
    const st = [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]];
    parts.push({ z0: 0, z1: 3, side: m.stS, top: m.stT, ao: 0.35, shape: (c) => { for (const q of st) S.circ(c, q[0], q[1], 0.9); } });
    parts.push({ z0: 3, z1: 3.9, side: m.stS, top: m.stT, ao: 0.2, shape: (c, zt) => { for (const q of st) S.circ(c, q[0], q[1], 1.1 + zt * 0.5); } });
    parts.push(box(-4.6, -4.6, 4.6, 4.6, 3.9, 10.6, m.pk, m.pk, { ao: 0.3 }));
    const rf = roofGX(0, 0, 9.2, 9.2, 10.6, 5.4, { hip: true, ov: 1.3, roofCol: m.rf, rows: 1.5 });
    parts.push(overlay((c) => {
      onFace(c, 4.6, (c) => {
        planks(c, m, -4.6, 4.6, 3.9, 10.6);
        c.fillStyle = m.wdD; c.fillRect(-1.6, 4.6, 3.2, 3.6); c.fillStyle = m.pkD; c.fillRect(-1.3, 4.9, 2.6, 3); S.dot(c, m.k2, 0.7, 6.4, 0.2);
        c.fillStyle = m.wdD; c.fillRect(2.4, 7.6, 1.5, 1.5); c.fillStyle = m.gl; c.fillRect(2.65, 7.85, 1, 1);
        // ladder
        c.strokeStyle = m.wdD; c.lineWidth = 0.45; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-3.8, -1.2); c.lineTo(-2.6, 5.2); c.moveTo(-2.2, -1.2); c.lineTo(-1, 5.2); for (let i = 0; i < 6; i++) { const t = i / 6; c.moveTo(-3.8 + 1.2 * t, -1.2 + 6.4 * t); c.lineTo(-2.2 + 1.2 * t, -1.2 + 6.4 * t); } c.stroke();
      });
      paintFaces(c, rf.faces, K.R); paintLines(c, rf.lines, m);
      seg2(c, [0, -16.2], [0, -18.2], m.iron, 0.45); S.dot(c, m.k2, 0, -18.2, 0.55);
    }));
    // grain sacks by the stones
    parts.push({ z0: 0, z1: 2.2, side: mx(m.straw, m.dirt, 0.5), top: mx(m.straw, '#f0e0b0', 0.3), ao: 0.3, shape: (c, zt) => { const k = Math.sqrt(1 - zt * zt * 0.8); S.ell(c, 5.6, 2.6, 1.3 * k, 1 * k); S.ell(c, 6.4, 5, 1.3 * k, 1 * k); } });
    return { r: 8, h: 19, parts, style: 'unit', bevel: 0.8 };
  };
})(window.AS = window.AS || {});

/* =============================================================================
 * SYLVARAN REALM (elf) — stacked-geometry technique of models_elf.js
 * ============================================================================= */
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});
  const PI = Math.PI;
  const DEF = { a: '#97a690', b: '#efe9d6', t: '#2f8a6a', g: '#7affd8', d: '#2e3d30', k: '#23794a', k2: '#e3eaa8', w: '#6a5236', s: '#cfe0c0' };
  const P = (p) => { const o = Object.assign({}, DEF); if (p) for (const k in DEF) if (typeof p[k] === 'string' && p[k]) o[k] = p[k]; return o; };
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const rgba = (c, a) => C.str(c, a);
  /* derived material colours for one palette */
  function kit(p) {
    return {
      p,
      stS: mx(p.b, p.a, 0.2), stT: mx(p.b, '#ffffff', 0.18),            // ivory walls
      st2S: mx(p.s, p.a, 0.35), st2T: mx(p.s, p.b, 0.45),               // pale sage stone
      plS: mx(p.a, p.d, 0.4), plT: mx(p.a, p.b, 0.4),                   // plinth / terrace
      pave: mx(p.s, p.b, 0.25),
      rfF: mx(p.t, '#bfeee0', 0.08), rfB: mx(p.t, '#e2fff4', 0.56), rfT: mx(p.t, '#f0fff8', 0.66), rfM: mx(p.t, '#d0f5e6', 0.22),
      rib: mx(p.k2, '#ffffff', 0.4), silver: '#eef5f1', silS: '#a3b6b0',
      gl: p.g, glS: mx(p.g, p.t, 0.35), glHi: mx(p.g, '#ffffff', 0.65), win: mx(p.g, '#fffbe6', 0.3),
      wd: p.w, wdS: mx(p.w, p.d, 0.25), wdT: mx(p.w, p.k2, 0.35), bark: mx(p.w, p.a, 0.5), barkT: mx(p.w, p.s, 0.6),
      silverBark: mx(mx(p.w, p.a, 0.55), '#e8eee6', 0.35), silverBarkS: mx(p.w, p.d, 0.4),
      lfD: mx(p.d, '#4f8a3a', 0.6), lfM: mx(p.k, '#8fcf58', 0.62), lfL: mx('#d2ec7a', p.k2, 0.3), lfG: mx(p.k2, '#f0c850', 0.55),
      bn: p.k, bn2: p.k2, dark: mx(p.d, '#000000', 0.45), door: mx(p.w, p.d, 0.3),
      fil: rgba(mx('#ffffff', p.k2, 0.25), 0.75), seam: rgba(p.d, 0.35), seamL: 'rgba(255,255,255,0.3)',
      water: mx(p.t, p.d, 0.35), hay: '#d9b95a', hayS: '#a8873a',
      yard: mx(p.d, '#c9b47a', 0.55), yardS: mx(p.d, '#8a7650', 0.4),
    };
  }

  /* ================================================================ geometry */
  const res = () => (AS.Forge && AS.Forge.res) || 2;
  const dzOf = (z0, z1) => (z1 - z0) / Math.max(1, Math.round((z1 - z0) * res()));
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  /* does an object-space normal (nx, ny) face the camera (screen down) at this heading? */
  const facing = (c, nx, ny, k) => { const a = headingOf(c); return nx * Math.sin(a) + ny * Math.cos(a) > (k || 0); };
  const ngon = (n, r, rot, cx, cy, sy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r * (sy || 1)); } return a; };
  function tf(pts, ox, oy, a) {
    const ca = Math.cos(a || 0), sa = Math.sin(a || 0), out = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { out[i] = ox + pts[i] * ca - pts[i + 1] * sa; out[i + 1] = oy + pts[i] * sa + pts[i + 1] * ca; }
    return out;
  }
  /* leaf outline point: u 0..TAU, tip at +x (sharpness sf), stem end at -x (sb); 1 = pointed, 0 = round */
  function leafXY(u, L, W, sf, sb) {
    const cu = Math.cos(u), su = Math.sin(u);
    const e = 1 + (sb + (sf - sb) * (0.5 + 0.5 * cu));
    return [L * cu, W * Math.sign(su) * Math.pow(Math.abs(su), e)];
  }
  function leafPts(cx, cy, L, W, rot, sf, sb, n) {
    n = n || 32; sf = sf === undefined ? 1 : sf; sb = sb === undefined ? 0.35 : sb;
    const a = [];
    for (let i = 0; i < n; i++) { const q = leafXY(i / n * TAU, L, W, sf, sb); a.push(q[0], q[1]); }
    return tf(a, cx, cy, rot);
  }
  /* half a leaf (side s = +1 → local +y) closed along the midrib */
  function halfLeaf(cx, cy, L, W, rot, s, sf, sb, n) {
    n = n || 16; const a = [];
    for (let i = 0; i <= n; i++) { const q = leafXY(i / n * PI * s, L, W, sf, sb); a.push(q[0], q[1]); }
    return tf(a, cx, cy, rot);
  }
  /* point + outward normal on a leaf outline at parameter u */
  function leafNorm(cx, cy, L, W, rot, u, sf, sb) {
    const q0 = leafXY(u - 0.01, L, W, sf, sb), q1 = leafXY(u + 0.01, L, W, sf, sb), q = leafXY(u, L, W, sf, sb);
    let nx = q1[1] - q0[1], ny = -(q1[0] - q0[0]);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * q[0] + ny * q[1] < 0) { nx = -nx; ny = -ny; }
    const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0);
    return [cx + q[0] * ca - q[1] * sa, cy + q[0] * sa + q[1] * ca, nx * ca - ny * sa, nx * sa + ny * ca];
  }
  /* tapered crescent band along an arc (centre cx,cy, mid radius R, half width w) */
  function crescentPts(cx, cy, R, w, a0, a1, n, pw) {
    n = n || 24; pw = pw === undefined ? 0.6 : pw; const o = [], inn = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u, hw = w * Math.pow(Math.max(0, Math.sin(PI * u)), pw) + 0.15;
      o.push(cx + Math.cos(a) * (R + hw), cy + Math.sin(a) * (R + hw));
      inn.unshift(cy + Math.sin(a) * (R - hw)); inn.unshift(cx + Math.cos(a) * (R - hw));
    }
    return o.concat(inn);
  }
  /* one half of a crescent roof: from the ridge arc (radius R) out (s=+1) or in (s=-1) by ww */
  function halfCres(cx, cy, R, ww, a0, a1, s, pw, n) {
    n = n || 32; const o = [], e = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u, t = Math.pow(Math.max(0, Math.sin(PI * u)), pw) * 0.85 + 0.15;
      o.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      e.unshift(cy + Math.sin(a) * (R + s * ww * t)); e.unshift(cx + Math.cos(a) * (R + s * ww * t));
    }
    return o.concat(e);
  }
  function sector(c, cx, cy, r0, r1, a0, a1) { c.moveTo(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1); c.arc(cx, cy, r1, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath(); }
  function annulus(c, x, y, r1, r2) { c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU); c.moveTo(x + r2, y); c.arc(x, y, r2, TAU, 0, true); }
  /* thin quad on a wall at (x,y) with outward normal (nx,ny), half width hw along the wall */
  function wallQuad(c, x, y, nx, ny, hw, out, inn) {
    const tx = -ny, ty = nx, o = out === undefined ? 0.35 : out, i = inn === undefined ? 0.7 : inn;
    c.moveTo(x + tx * hw + nx * o, y + ty * hw + ny * o); c.lineTo(x - tx * hw + nx * o, y - ty * hw + ny * o);
    c.lineTo(x - tx * hw - nx * i, y - ty * hw - ny * i); c.lineTo(x + tx * hw - nx * i, y + ty * hw - ny * i); c.closePath();
  }
  /* pointed (elven) arch profile: 1 up to the springline, tapering to 0 at the apex */
  const archW = (zt, spring) => { const s = spring === undefined ? 0.55 : spring; return zt < s ? 1 : Math.max(0.05, 1 - Math.pow((zt - s) / (1 - s), 1.7)); };
  /* radius profiles (zt 0..1 → factor) */
  const PROF = {
    dome: (z) => Math.sqrt(Math.max(0.0025, 1 - z * z)),
    bud: (z) => (z < 0.38 ? 1 + 0.16 * Math.sin(z / 0.38 * PI / 2) : 1.16 * Math.pow(Math.cos((z - 0.38) / 0.62 * PI / 2), 1.35)) + 0.02,
    spire: (z) => Math.pow(1 - z, 1.55) + 0.02,
    cone: (z) => 1 - z * 0.97,
    flare: (z) => Math.pow(1 - z, 2.2) * 0.75 + (1 - z) * 0.25 + 0.02,
  };
  /* slice-wise stroked curves: f(z) -> [x, y] or null. Consecutive slices are joined so
   * near-horizontal members (arms, boughs) stay continuous. */
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

  /* ================================================================ depth sorter */
  /* first part of a model: re-orders the rest by layer then back-to-front by the screen depth
   * of each part's anchor `at` for the heading being rendered (shared anchors keep their order) */
  function sorted(parts) {
    const all = [null].concat(parts.filter(Boolean));
    all[0] = { z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: (c) => {
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
      const rest = all.slice(1).map((p, i) => ({ p, i, l: p.layer || 0, d: p.at ? p.at[0] * sa + p.at[1] * ca : 0 }));
      rest.sort((A, B) => (A.l - B.l) || (A.d - B.d) || (A.i - B.i));
      for (let i = 0; i < rest.length; i++) all[i + 1] = rest[i].p;
    } };
    return all;
  }
  const anchor = (at, list) => { for (const q of list) if (q && !q.at && at) q.at = at; return list; };

  /* ================================================================ detail painters */
  function glowDot(c, col, x, y, r, a) {
    const A = a === undefined ? 0.95 : a;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(mx(col, '#ffffff', 0.5), A)); g.addColorStop(0.4, rgba(col, A * 0.6)); g.addColorStop(1, rgba(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function ring(c, col, x, y, r, w, a0, a1) { c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0 || 0, a1 === undefined ? TAU : a1); c.stroke(); c.restore(); }
  /* silver filigree curl: a vine stroke ending in a spiral, at (x,y) heading rot, size s */
  function curl(c, col, x, y, s, rot, w, flip) {
    const f = flip ? -1 : 1;
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s * f);
    c.strokeStyle = col; c.lineWidth = (w || 0.4) / s; c.beginPath();
    c.moveTo(-1, 0); c.bezierCurveTo(-0.4, -0.6, 0.4, 0.5, 0.9, -0.1);
    c.arc(0.65, -0.1, 0.25, 0, -PI * 1.6, true);
    c.stroke(); c.restore();
  }
  /* ring of filigree curls */
  function curlRing(c, col, x, y, r, n, s, w) { for (let i = 0; i < n; i++) { const a = i / n * TAU; curl(c, col, x + Math.cos(a) * r, y + Math.sin(a) * r, s, a + PI / 2, w, i % 2); } }
  /* leaf-texture speckle over a crown top */
  function leafSpeckle(c, x, y, r, seed, cols, n) {
    c.save();
    for (let i = 0; i < (n || 14); i++) {
      const a = U.hash2(i, seed, 3) * TAU, d = Math.sqrt(U.hash2(i, seed, 5)) * r * 0.85;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      c.fillStyle = cols[i % cols.length]; c.beginPath(); S.ell(c, px, py, 0.9 + U.hash2(i, seed, 9) * 0.9, 0.55, a); c.fill();
    }
    c.restore();
  }
  const plinth = (k, shp, z1, extra) => Object.assign({ z0: 0, z1: z1 || 1.5, side: k.plS, top: k.plT, ao: 0.25, shape: shp }, extra || {});
  /* ivory wall body */
  const wallP = (k, shp, z0, z1, extra) => Object.assign({ z0, z1, side: k.stS, top: k.stT, ao: 0.42, shape: shp }, extra || {});
  /* band on the camera-facing half of round walls (heading aware) */
  function frontBand(k, pts, r, z0, z1, side, top, w) {
    w = w || 0.9;
    return { z0, z1, side: side || k.silS, top: top || k.rib, bevel: false, ao: 0.1, shape: (c) => {
      const a0 = -headingOf(c);
      for (const q of pts) {
        c.moveTo(q[0] + Math.cos(a0) * (r + w * 0.4), q[1] + Math.sin(a0) * (r + w * 0.4)); c.arc(q[0], q[1], r + w * 0.4, a0, a0 + PI);
        c.arc(q[0], q[1], r - w * 0.6, a0 + PI, a0, true); c.closePath();
      }
    } };
  }
  /* railing on the camera-facing half of a round platform: posts + top rail */
  function rail(k, x, y, r, z0, h, n) {
    return { z0, z1: z0 + h, side: k.silS, top: k.silver, bevel: false, ao: 0.1, shape: (c, zt) => {
      const a0 = -headingOf(c);
      if (zt > 0.78) { c.moveTo(x + Math.cos(a0 - 0.1) * (r + 0.25), y + Math.sin(a0 - 0.1) * (r + 0.25)); c.arc(x, y, r + 0.25, a0 - 0.1, a0 + PI + 0.1); c.arc(x, y, r - 0.35, a0 + PI + 0.1, a0 - 0.1, true); c.closePath(); return; }
      const m = n || 12; for (let i = 0; i <= m; i++) { const a = a0 + i / m * PI; S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.22); }
    } };
  }

  /* leaf roof: two planes meeting at a ridge along the leaf axis, silver leaf veins on the
   * visible planes, a pale ridge cap and upswept tips. Lit plane = the half facing the sun. */
  function leafRoof(k, o) {
    const { x, y, L, W, rot = 0, z0, H } = o;
    const sf = o.sf === undefined ? 1 : o.sf, sb = o.sb === undefined ? 0.55 : o.sb;
    const prof = o.prof || ((z) => Math.pow(1 - z, 1.2));
    const lk = o.lk === undefined ? 0.18 : o.lk;
    const parts = [];
    for (const s of [-1, 1]) {
      const nx = -s * Math.sin(rot), ny = s * Math.cos(rot);
      const lit = o.even ? 0.45 : U.clamp(0.5 - (nx * 0.55 + ny * 0.83) * 0.7, 0, 1);
      const side = mx(o.dark || k.rfF, o.light || k.rfB, lit);
      parts.push({ z0, z1: z0 + H, side, top: mx(side, '#ffffff', 0.2), ao: 0.22, bevel: false,
        shape: (c, zt) => S.poly(c, halfLeaf(x, y, L * (1 - lk * zt), W * prof(zt) + 0.15, rot, s, sf, sb, 18)) });
    }
    const nv = o.veins === undefined ? 4 : o.veins;
    if (nv) {
      const halfAt = (xl, zt) => { const Lz = L * (1 - lk * zt), q = U.clamp(xl / Lz, -1, 1), u = Math.acos(q); return leafXY(u, Lz, W * prof(zt) + 0.15, sf, sb)[1]; };
      const ca = Math.cos(rot), sa = Math.sin(rot);
      parts.push({ z0: z0 + 0.3, z1: z0 + H - 0.2, side: o.veinS || k.silS, top: o.vein || k.rib, bevel: false, ao: 0.05,
        shape: (c, zt) => {
          for (const s2 of [-1, 1]) {
            const nwx = -s2 * sa, nwy = s2 * ca;
            if (!facing(c, nwx, nwy, -0.25)) { const d = (W / H) * (prof(Math.max(0, zt - 0.05)) - prof(Math.min(1, zt + 0.05))) / 0.1; if (d < 1.25) continue; }
            for (let i = 0; i < nv; i++) {
              const xr = L * (1 - lk) * (0.75 - 1.5 * (i + 0.5) / nv) * 0.9, xe = xr - L * 0.32;
              const xl = xe + (xr - xe) * zt, yl = s2 * halfAt(xl, zt);
              if (Math.abs(xl) > L * (1 - lk * zt) * 0.92) continue;
              S.circ(c, x + xl * ca - yl * sa, y + xl * sa + yl * ca, 0.3);
            }
          }
        } });
    }
    const L1 = L * (1 - lk) * 0.98;
    const tip = tf([L1, 0, -L1 * 0.94, 0], x, y, rot);
    parts.push({ z0: z0 + H - 0.4, z1: z0 + H + 0.4, side: k.silS, top: o.ridge || k.rib, stroke: 0.75, bevel: false, shape: (c) => S.seg(c, tip[0], tip[1], tip[2], tip[3]) });
    if (o.horns !== false) {
      const hz = o.hornH || 4;
      parts.push({ z0: z0 + H - 0.5, z1: z0 + H + hz, side: k.silS, top: k.rib, bevel: false, shape: (c, zt) => {
        const r = 0.7 * (1 - zt) + 0.12, out = zt * zt * 2.2;
        const a = tf([L1 + out, 0, -(L1 * 0.94 + out), 0], x, y, rot);
        S.circ(c, a[0], a[1], r); if (o.horns !== 'front') S.circ(c, a[2], a[3], r);
      } });
    }
    return parts;
  }

  /* crescent roof over a curved hall: outer (back, lit) and inner (front, shaded) planes,
   * radial silver veins on the inner plane and a ridge cap along the arc */
  function crescentRoof(k, o) {
    const { x, y, R, w, a0, a1, z0, H } = o;
    const pw = o.pw === undefined ? 0.12 : o.pw;
    const prof = o.prof || ((z) => Math.pow(1 - z, 1.15));
    const parts = [];
    parts.push({ z0, z1: z0 + H, side: o.light || k.rfB, top: k.rfT, ao: 0.15, bevel: false, shape: (c, zt) => S.poly(c, halfCres(x, y, R, w * prof(zt) + 0.12, a0, a1, 1, pw)) });
    parts.push({ z0, z1: z0 + H, side: o.dark || k.rfF, top: k.rfT, ao: 0.25, bevel: false, shape: (c, zt) => S.poly(c, halfCres(x, y, R, w * prof(zt) + 0.12, a0, a1, -1, pw)) });
    const nv = o.veins === undefined ? Math.round((a1 - a0) * R / 7) : o.veins;
    parts.push({ z0: z0 + 0.3, z1: z0 + H - 0.2, side: k.silS, top: k.rib, bevel: false, ao: 0.05, shape: (c, zt) => {
      const hd = -headingOf(c);
      for (let i = 0; i < nv; i++) {
        const u = (i + 0.5) / nv, a = a0 + (a1 - a0) * u + (1 - zt) * 0.04, t = Math.pow(Math.max(0, Math.sin(PI * u)), pw) * 0.85 + 0.15;
        if (Math.sin(a - hd) > -0.15) continue;
        const r = R - (w * prof(zt) + 0.12) * t;
        S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.3);
      }
    } });
    parts.push({ z0: z0 + H - 0.4, z1: z0 + H + 0.4, side: k.silS, top: k.rib, stroke: 0.75, bevel: false, shape: (c) => { c.moveTo(x + Math.cos(a0 + 0.04) * R, y + Math.sin(a0 + 0.04) * R); c.arc(x, y, R, a0 + 0.04, a1 - 0.04); } });
    return parts;
  }

  /* round tower bodies (optionally flared at the base); pts = [[x,y],...] */
  function towerBody(k, pts, r, z0, z1, flare, extra) {
    const f = flare || 0;
    return Object.assign({ z0, z1, side: k.stS, top: k.stT, ao: 0.45, shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], r * (1 + f * Math.pow(1 - zt, 3))); } }, extra || {});
  }
  /* bud dome / spire roof: lit stripe, filigree ribs on the camera side, needle finial */
  function capRoof(k, o) {
    const pts = o.pts, R = o.R, z0 = o.z0, H = o.H;
    const prof = PROF[o.prof || 'bud'];
    const parts = [];
    if (o.band) parts.push({ z0: z0 - 0.5, z1: z0 + 0.6, side: k.silS, top: k.rib, bevel: false, shape: (c) => { for (const q of pts) S.circ(c, q[0], q[1], R * prof(0) + 0.5); } });
    parts.push({ z0, z1: z0 + H, side: o.side || k.rfM, top: o.top || k.rfT, ao: o.ao === undefined ? 0.35 : o.ao,
      shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], R * prof(zt)); } });
    if (o.hi !== false) parts.push({ z0: z0 + 0.4, z1: z0 + H * 0.8, side: mx(k.rfB, '#ffffff', 0.12), top: k.rfT, bevel: false, ao: 0.25,
      shape: (c, zt) => { const a0 = -headingOf(c), r = R * prof(zt * 0.8) + 0.08, w = Math.min(1.3, r * 0.38); for (const q of pts) { c.moveTo(q[0] + Math.cos(a0 + PI * 0.6) * r, q[1] + Math.sin(a0 + PI * 0.6) * r); c.arc(q[0], q[1], r, a0 + PI * 0.6, a0 + PI * 0.92); c.arc(q[0], q[1], r - w, a0 + PI * 0.92, a0 + PI * 0.6, true); c.closePath(); } } });
    const nr = o.ribs === undefined ? 5 : o.ribs;
    if (nr) parts.push({ z0: z0 + 0.3, z1: z0 + H * 0.88, side: k.silS, top: k.rib, bevel: false, ao: 0.1,
      shape: (c, zt) => { const hd = -headingOf(c), r = R * prof(zt * 0.88) + 0.1, rr = Math.max(0.16, 0.4 * (1 - zt * 0.6)); for (const q of pts) for (let i = 0; i < nr; i++) { const a = hd + PI * (i + 0.5) / nr; S.circ(c, q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r, rr); } } });
    const fh = o.finial === undefined ? H * 0.55 : o.finial;
    if (fh > 0) parts.push({ z0: z0 + H - 1, z1: z0 + H + fh, side: k.silS, top: k.silver, bevel: false, ao: 0,
      shape: (c, zt) => { const r = 0.55 * (1 - zt) + 0.1 + (Math.abs(zt - 0.3) < 0.07 ? 0.5 : 0); for (const q of pts) S.circ(c, q[0], q[1], r); } });
    return parts;
  }
  /* pointed-arch windows on round walls. angs: angles (0 = +x, PI/2 = front); rel → measured
   * from the screen-facing side (rotating sheets); inner → the wall faces the centre */
  function arcWins(k, pts, r, z0, z1, angs, hwA, col, extra, rel, inner) {
    const o1 = inner ? -0.35 : 0.3, o2 = inner ? 0.75 : -0.7;
    return Object.assign({ z0, z1, side: sh(col || k.win, -0.2), top: col || k.win, flat: true, bevel: false, ao: 0,
      shape: (c, zt) => { const w = hwA * archW(zt), off = rel ? -headingOf(c) : 0; for (const q of pts) for (const a0 of angs) { const a = a0 + off; c.moveTo(q[0] + Math.cos(a - w) * (r + o1), q[1] + Math.sin(a - w) * (r + o1)); c.arc(q[0], q[1], r + o1, a - w, a + w); c.arc(q[0], q[1], r + o2, a + w, a - w, true); c.closePath(); } } }, extra || {});
  }
  /* pointed-arch windows / doors on a leaf-shaped wall at outline parameters us */
  function leafWins(k, o, us, z0, z1, hw, col, extra) {
    return Object.assign({ z0, z1, side: sh(col || k.win, -0.2), top: col || k.win, flat: true, bevel: false, ao: 0,
      shape: (c, zt) => { for (const u of us) { const q = leafNorm(o.x, o.y, o.L, o.W, o.rot || 0, u, o.sf === undefined ? 1 : o.sf, o.sb === undefined ? 0.35 : o.sb); wallQuad(c, q[0], q[1], q[2], q[3], hw * archW(zt)); } } }, extra || {});
  }
  /* arched silver frames around those windows (drawn before the glass) */
  function leafFrames(k, o, us, z0, z1, hw, extra) { return leafWins(k, o, us, z0, z1 + 0.6, hw + 0.45, k.rib, Object.assign({ flat: false, side: k.silS, top: k.silver }, extra || {})); }

  /* climbing vine: a helix of leaf dots around a round shaft (front half only) */
  function vine(k, x, y, rAt, z0, z1, turns, a0) {
    return { z0, z1, side: k.lfM, top: k.lfL, bevel: false, ao: 0.2, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0), hd = -headingOf(c);
      for (const off of [0, PI * 0.9]) {
        const a = a0 + off + zt * turns * TAU, r = rAt(z) + 0.25;
        if (Math.sin(a - hd) < 0.08) continue;
        const lf = (Math.sin(zt * 70 + off) > 0.55) ? 0.75 : 0.42;
        S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, lf);
      }
    } };
  }
  /* scalloped cloud outline (union of circles): painted-tree crowns */
  function cloud(c, x, y, r, seed, n) {
    n = n || 8; S.circ(c, x, y, r * 0.7);
    for (let i = 0; i < n; i++) {
      const a = (i + U.hash2(i, seed, 41) * 0.5) / n * TAU + seed, rr = r * (0.3 + 0.12 * U.hash2(i, seed, 43));
      S.circ(c, x + Math.cos(a) * (r - rr), y + Math.sin(a) * (r - rr) * 0.94, rr);
    }
  }
  /* leaf clumps scattered over the camera-facing surface of a crown (slice-wise dots) */
  function leafTex(cx, cy, cz, cr, ch, prof, seed, col, n, a0, a1, zr) {
    const dots = [];
    for (let i = 0; i < n; i++) dots.push([zr[0] + (zr[1] - zr[0]) * U.hash2(i, seed, 51), a0 + (a1 - a0) * U.hash2(i, seed, 53), 0.55 + 0.6 * U.hash2(i, seed, 57)]);
    return { z0: cz, z1: cz + ch, side: col, top: col, bevel: false, ao: 0.05, shape: (c, zt) => {
      const hd = -headingOf(c);
      for (const d of dots) {
        const dz = (zt - d[0]) * ch; if (Math.abs(dz) >= d[2]) continue;
        const rr = Math.sqrt(d[2] * d[2] - dz * dz), r = cr * prof(zt) + 0.1, a = d[1] + hd;
        S.ell(c, cx + Math.cos(a) * (r - rr * 0.3), cy + Math.sin(a) * (r - rr * 0.3), rr * 1.3, rr * 0.8, a + PI / 2);
      }
    } };
  }
  /* leafy crown only (cloud body + lit cluster + leaf clumps) — branches, crowns on trunks */
  function crown(k, o) {
    const cx = o.x, cy = o.y, cz = o.z0, cr = o.cr, ch = o.ch || cr * 1.1, seed = o.seed || 1;
    const prof = (zt) => (zt < 0.4 ? 0.72 + 0.28 * Math.sin(zt / 0.4 * PI / 2) : Math.sqrt(Math.max(0.02, 1 - Math.pow((zt - 0.4) / 0.6, 2))));
    const lm = o.leafM || k.lfM, ll = o.leafL || k.lfL;
    const parts = [{ z0: cz, z1: cz + ch, side: lm, top: ll, ao: 0.6, shape: (c, zt) => cloud(c, cx, cy, cr * prof(zt) + 0.2, seed, 9) }];
    parts.push(leafTex(cx, cy, cz, cr, ch, (zt) => prof(zt) * 1.02, seed, mx(lm, k.lfD, 0.45), Math.round(cr * 0.9), PI * 0.05, PI * 0.95, [0.12, 0.5]));
    const hq = (zt) => { const q = zt * 1.6 - 0.6; return 0.52 * Math.sqrt(Math.max(0.02, 1 - q * q)); };
    const hx0 = cx - cr * 0.25, hy0 = cy - cr * 0.28;
    parts.push({ z0: cz + ch * 0.45, z1: cz + ch * 1.08, side: mx(lm, ll, 0.45), top: ll, ao: 0.25,
      shape: (c, zt) => cloud(c, hx0, hy0, cr * hq(zt), seed + 5, 6) });
    parts.push(leafTex(hx0, hy0, cz + ch * 0.45, cr, ch * 0.63, hq, seed + 9, o.gold ? k.lfG : mx(ll, '#ffffff', 0.25), Math.round(cr * (o.gold ? 0.9 : 0.6)), PI * 0.1, PI * 1.1, [0.25, 0.8]));
    return parts;
  }
  /* living tree: flared trunk with roots, cloud crown with dark underside and lit top-left cluster */
  function tree(k, o) {
    const { x, y } = o, z0 = o.z0 || 0, th = o.th || 10, cr = o.cr || 10, ch = o.ch || cr * 1.1, seed = o.seed || 1;
    const tr = o.tr || Math.max(0.9, cr * 0.13);
    const lean = o.lean || [0, 0];
    const cz = z0 + th;
    const parts = [{ z0, z1: cz + ch * 0.3, side: o.bark || k.bark, top: o.barkT || k.barkT, ao: 0.35,
      shape: (c, zt) => {
        const r = tr * (1 + 1.3 * Math.pow(1 - zt, 6)), lx = x + lean[0] * zt, ly = y + lean[1] * zt;
        S.circ(c, lx, ly, r);
        if (zt < 0.16 && !o.noRoots) for (let i = 0; i < 4; i++) { const a = i * 1.7 + seed, d = tr * (1.4 + (0.16 - zt) * 9); S.circ(c, lx + Math.cos(a) * d, ly + Math.sin(a) * d * 0.8, tr * 0.5 * (1 - zt * 4)); }
      } }];
    return parts.concat(crown(k, { x: x + lean[0], y: y + lean[1], z0: cz, cr, ch, seed, gold: o.gold, leafM: o.leafM, leafL: o.leafL }));
  }

  /* crystals: hexagonal prism with a pointed top (flat glow) and a lit facet sliver */
  function crystal(k, pts, z0, r, h, o) {
    o = o || {};
    const col = o.col || k.gl;
    const prof = (zt) => (zt < 0.62 ? 0.75 + 0.25 * Math.sin(zt / 0.62 * PI / 2) : (1 - zt) / 0.38) + 0.03;
    const rot = o.rot === undefined ? 0.3 : o.rot;
    const pul = (an) => (o.pulse ? 1 + 0.1 * Math.sin(an * TAU) : 1);
    return [
      { z0, z1: z0 + h, side: mx(col, k.p.t, 0.3), top: mx(col, '#ffffff', 0.55), flat: true, bevel: false, ao: -0.2,
        shape: (c, zt, an) => { for (const q of pts) S.poly(c, ngon(6, r * prof(zt) * pul(an), rot, q[0], q[1])); },
        detail: o.halo ? (c, an) => { for (const q of pts) glowDot(c, col, q[0], q[1], r * 2.2 * pul(an), 0.5); } : undefined },
      { z0, z1: z0 + h, side: mx(col, '#ffffff', 0.55), top: '#ffffff', flat: true, bevel: false, ao: 0,
        shape: (c, zt, an) => { for (const q of pts) { const rr = r * prof(zt) * pul(an) + 0.05; const a = ngon(6, rr, rot, q[0], q[1]), b = ngon(6, rr * 0.5, rot, q[0], q[1]); S.poly(c, [a[6], a[7], a[8], a[9], b[8], b[9], b[6], b[7]]); } } },
    ];
  }

  /* banners: silver pole with a knob and a swallow-tailed pennant that flutters with anim.
   * pts = [[x, y, dir]] (dir ±1 = side the cloth flies to) */
  function banner(k, pts, z0, h, o) {
    o = o || {};
    const fl = o.len || 4.6, fh = o.fh || h * 0.5, top = z0 + h;
    const cloth = (c, q, zt, an, u0, u1, inset, wid) => {
      const n = 6, w = fl * (0.55 + 0.45 * zt), dir = q[2] || 1, a = [], b = [];
      for (let i = 0; i <= n; i++) {
        const u = u0 + (u1 - u0) * i / n, xx = q[0] + dir * (0.3 + u * w);
        const wy = Math.sin(u * 4.2 - an * TAU + zt * 0.8) * 0.6 * u;
        a.push(xx, q[1] + wy - wid + inset); b.unshift(q[1] + wy + wid + inset); b.unshift(xx);
      }
      S.poly(c, a.concat(b));
    };
    return [
      { z0, z1: top + 1.6, side: k.silS, top: k.rib, bevel: false, ao: 0.2, shape: (c, zt) => { const r = zt > 0.93 ? 0.65 : 0.36; for (const q of pts) S.circ(c, q[0], q[1], r); } },
      { z0: top - fh, z1: top, side: mx(o.col || k.bn, '#ffffff', 0.12), top: mx(o.col || k.bn, '#ffffff', 0.3), bevel: false, ao: 0.05,
        shape: (c, zt, an) => { for (const q of pts) { if (zt < 0.22) { const cut = (0.22 - zt) / 0.22; cloth(c, q, zt, an, 0, 0.5 - cut * 0.3, 0, 0.25); cloth(c, q, zt, an, 0.5 + cut * 0.3, 1, 0, 0.25); } else cloth(c, q, zt, an, 0, 1, 0, 0.25); } } },
      // pale trim in one part: bottom hem tips, emblem band, top hem
      { z0: top - fh, z1: top + 0.3, side: o.col2 || k.bn2, top: o.col2 || k.bn2, bevel: false, ao: 0, flat: true,
        shape: (c, zt, an) => {
          const z = top - fh + zt * (fh + 0.3);
          for (const q of pts) {
            if (z < top - fh + 0.7) { cloth(c, q, 0, an, 0, 0.2, 0.12, 0.3); cloth(c, q, 0, an, 0.8, 1, 0.12, 0.3); }
            else if (z > top - fh * 0.66 && z < top - fh * 0.4) cloth(c, q, 0.5, an, 0.15, 0.6, 0.18, 0.2);
            else if (z > top - 0.3) cloth(c, q, 1, an, 0, 1, 0.1, 0.32);
          }
        } },
    ];
  }
  /* crystal lanterns on slender silver posts */
  function lantern(k, pts, h, z0) {
    z0 = z0 || 0;
    return [
      { z0, z1: z0 + h, side: k.silS, top: k.silver, bevel: false, ao: 0.3, shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], 0.35 + (zt < 0.08 ? 0.5 : 0)); } },
      { z0: z0 + h, z1: z0 + h + 2.2, side: k.glS, top: k.glHi, flat: true, bevel: false, ao: -0.2,
        shape: (c, zt) => { for (const q of pts) S.poly(c, ngon(4, 0.95 * (zt < 0.5 ? 0.6 + zt * 0.8 : (1 - zt) * 2) + 0.08, PI / 4, q[0], q[1])); },
        detail: (c) => { for (const q of pts) glowDot(c, k.gl, q[0], q[1], 2.6, 0.55); } },
    ];
  }
  /* steps descending toward +y: from yTop (height z) to yBot (ground), with lit nosings */
  function stairs(k, x, yTop, yBot, w, z, n, cols) {
    n = n || Math.max(2, Math.round(z / 0.9));
    const dy = (yBot - yTop) / n;
    const cs = cols || [k.plS, k.pave];
    return [
      { z0: 0, z1: z, side: cs[0], top: cs[1], ao: 0.2, shape: (c, zt) => { const m = Math.min(n, Math.ceil((1 - zt) * n + 1e-6)); S.rect(c, x - w / 2, yTop, w, dy * Math.max(1, m)); } },
      { z0: 0, z1: z, side: k.stT, top: k.stT, flat: true, bevel: false, shape: (c, zt) => { const f = (1 - zt) * n, m = Math.ceil(f - 1e-6); if (m < 1 || m - f > 0.34) return; S.rect(c, x - w / 2, yTop + dy * m - 0.35, w, 0.35); } },
    ];
  }
  const cylW = (zt) => Math.sqrt(Math.max(0.04, 1 - (2 * zt - 1) * (2 * zt - 1)));

  /* ===================================================== extra helpers */
  PROF.pagoda = (z) => 1 - 0.52 * z + 0.02;
  /* silver railing along an arc of a round or crescent platform: posts + top rail */
  function railArc(k, x, y, r, a0, a1, z0, h, n) {
    return { z0, z1: z0 + h, side: k.silS, top: k.silver, bevel: false, ao: 0.1, shape: (c, zt) => {
      if (zt > 0.8) { c.moveTo(x + Math.cos(a0) * (r + 0.25), y + Math.sin(a0) * (r + 0.25)); c.arc(x, y, r + 0.25, a0, a1); c.arc(x, y, r - 0.3, a1, a0, true); c.closePath(); return; }
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.22); }
    } };
  }
  /* flat discs standing on camera-facing (+y) surfaces: list [x, y, zc, r] (log ends, round signs) */
  function fdiscs(list, col, top, extra) {
    let zl = Infinity, zh = -Infinity;
    for (const q of list) { zl = Math.min(zl, q[2] - q[3]); zh = Math.max(zh, q[2] + q[3]); }
    return Object.assign({ z0: zl, z1: zh, side: col, top: top || col, flat: true, bevel: false, ao: 0, shape: (c, zt) => {
      const z = zl + zt * (zh - zl);
      for (const q of list) { const d = z - q[2]; if (Math.abs(d) >= q[3]) continue; wallQuad(c, q[0], q[1], 0, 1, Math.sqrt(q[3] * q[3] - d * d), 0.3, 0.3); }
    } }, extra || {});
  }
  /* a vertical crescent moon (thin disc facing the camera) opening to +x: centre (x, y), height centre zc */
  function moon(k, x, y, zc, r, col, top, extra, th) {
    th = th || 0.6;
    return Object.assign({ z0: zc - r, z1: zc + r, side: col || k.silS, top: top || k.silver, bevel: false, ao: 0, flat: !!extra && !!extra.flat, shape: (c, zt) => {
      const z = zc - r + zt * 2 * r, d = z - zc, w = Math.sqrt(Math.max(0.01, r * r - d * d));
      const d2 = z - zc - r * 0.18, w2 = Math.sqrt(Math.max(0, r * r * 0.81 - d2 * d2)), cut = r * 0.55 - w2;
      const xe = Math.min(w, cut);
      if (xe > -w + 0.05) c.rect(x - w, y - th / 2, xe + w, th);
    } }, extra || {});
  }
  /* logs lying along y with their ends to the camera: list [x, zc], half length hl, radius r (2 parts) */
  function logsY(k, list, y, hl, r) {
    return [
      { z0: list[0][1] - r, z1: Math.max.apply(null, list.map((g) => g[1])) + r, side: k.wdS, top: k.wdT, ao: 0.35, bevel: false, shape: (c, zt) => {
        const z0 = list[0][1] - r, z = z0 + zt * (Math.max.apply(null, list.map((g) => g[1])) + r - z0);
        for (const g of list) { const dz = z - g[1]; if (Math.abs(dz) > r) continue; const w = Math.sqrt(r * r - dz * dz); c.rect(g[0] - w, y - hl, w * 2, hl * 2); }
      } },
      fdiscs(list.map((g) => [g[0], y + hl, g[1], r * 0.92]), mx(k.wdT, k.p.k2, 0.3)),
      fdiscs(list.map((g) => [g[0], y + hl + 0.02, g[1], r * 0.5]), k.wdS),
    ];
  }

  /* ============================================================ HOUSE 2
   * v0 manor: two-storey leaf hall with twin spires at its tips and a crescent balcony
   * v1 hovel: a hollowed tree stump with a door, a porthole and a leaf laid on top
   * v2 glassblower: leaf hall under a raw-copper roof, kiln tower with a tall chimney,
   *    bench of glowing glass under a leaf awning
   * v3 teahouse: round pavilion under a tiered pagoda roof with a moon finial, moon
   *    lantern sign, stable wing, terrace steps */
  M.elf_house2 = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal)), v = (((opt.v | 0) % 4) + 4) % 4;
    const parts = [];
    let R = 22, H = 30;
    if (v === 0) {
      const B = { x: 0, y: 0, L: 13.5, W: 8.2, rot: 0, sf: 1, sb: 0.35 }, tp = [[-12.6, 0], [12.6, 0]];
      parts.push(...anchor([0, -30], tree(k, { x: -13.5, y: -11, th: 8, cr: 7.5, ch: 8.5, seed: 11 })));
      const lowU = [PI * 0.3, PI * 0.4, PI * 0.6, PI * 0.7], upU = lowU;
      parts.push(...anchor([0, -2], [
        plinth(k, (c) => { S.poly(c, leafPts(B.x, B.y, B.L + 2.2, B.W + 2.2, 0, 1, 0.35)); for (const q of tp) S.circ(c, q[0], q[1], 4.8); }),
        wallP(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L, B.W, 0, 1, 0.35)), 1.5, 16),
        leafFrames(k, B, lowU, 3.6, 7.2, 0.75), leafWins(k, B, lowU, 3.6, 7.2, 0.75),
        leafFrames(k, B, [PI * 0.5], 1.5, 7.2, 1.2), leafWins(k, B, [PI * 0.5], 1.5, 7.2, 1.2, k.door),
        // string course between the storeys
        wallP(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L + 0.5, B.W + 0.45, 0, 1, 0.35)), 8.7, 9.3, { side: k.silS, top: k.rib, bevel: false, ao: 0.1 }),
        leafFrames(k, B, upU, 10, 13.6, 0.72), leafWins(k, B, upU, 10, 13.6, 0.72),
        leafFrames(k, B, [PI * 0.5], 9.7, 13.8, 1), leafWins(k, B, [PI * 0.5], 9.7, 13.8, 1, k.door),
        ...leafRoof(k, { x: B.x, y: B.y, L: B.L + 1.6, W: B.W + 0.9, rot: 0, z0: 16, H: 6.5, sb: 0.35, veins: 5, horns: false }),
      ]));
      // crescent balcony on silver brackets, with a railing
      parts.push(...anchor([0, -1.95], [
        { z0: 6.8, z1: 8.8, side: k.silS, top: k.rib, bevel: false, ao: 0.2, shape: (c, zt) => { for (const a of [PI * 0.36, PI * 0.5, PI * 0.64]) { const r = 8.3 + zt * 1.6; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.32); } } },
        { z0: 8.8, z1: 9.7, side: k.st2S, top: k.st2T, ao: 0.25, shape: (c) => S.poly(c, crescentPts(0, 0, 10.2, 1.6, PI * 0.26, PI * 0.74, 20, 0.4)), detail: (c) => ring(c, k.fil, 0, 0, 10.2, 0.35, PI * 0.3, PI * 0.7) },
        railArc(k, 0, 0, 11.5, PI * 0.27, PI * 0.73, 9.7, 2.4, 12),
      ]));
      // twin spires on the leaf tips
      parts.push(...anchor([0, -1.9], [
        towerBody(k, tp, 3.4, 1.5, 20, 0.2),
        arcWins(k, tp, 3.4, 4.5, 8, [PI * 0.5], 0.3),
        arcWins(k, tp, 3.4, 12, 16, [PI * 0.5], 0.3),
        frontBand(k, tp, 3.4, 19.2, 20),
        ...capRoof(k, { pts: tp, R: 4.2, z0: 20, H: 11, prof: 'spire', ribs: 4, finial: 4 }),
      ]));
      parts.push(...anchor([0, 12], lantern(k, [[-7.5, 12.5], [7.5, 12.5]], 4.5)));
      R = 23; H = 37;
    } else if (v === 1) {
      const sx = 0, sy = 1, R0 = 6.4, Z1 = 9.5;
      const rAt = (zt) => R0 * (1 + 0.3 * Math.pow(1 - zt, 3));
      const rAtZ = (z) => rAt((z - 0.8) / (Z1 - 0.8));
      parts.push(...anchor([0, -20], tree(k, { x: 9.5, y: -7, th: 6, cr: 5.6, ch: 6.5, seed: 23 })));
      parts.push(...anchor([0, 0], [
        plinth(k, (c) => S.blob(c, sx, sy + 1.2, 10.2, 5, 12, 0.18), 0.8, { side: k.yardS, top: mx(k.yard, k.lfD, 0.3),
          detail: (c) => { for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, d = 7.2 + U.hash2(i, 2, 3) * 2; c.fillStyle = i % 2 ? rgba(k.lfM, 0.5) : rgba(k.lfD, 0.4); c.beginPath(); S.ell(c, sx + Math.cos(a) * d, sy + 1.2 + Math.sin(a) * d * 0.8, 1.3, 0.8, a); c.fill(); } } }),
        // the stump: flared bark, roots, ragged rim with tree rings
        { z0: 0.8, z1: Z1, side: k.bark, top: k.barkT, ao: 0.42, shape: (c, zt) => {
          const r = rAt(zt);
          if (zt > 0.94) S.blob(c, sx, sy, r, 3, 11, 0.18); else S.circ(c, sx, sy, r);
          if (zt < 0.2) for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4, d = R0 * (1.05 + (0.2 - zt) * 4.5); S.circ(c, sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, R0 * 0.2 * (1 - zt * 4)); }
        }, detail: (c) => { for (let r = 1.2; r < R0 - 0.5; r += 1.15) ring(c, 'rgba(60,40,20,0.3)', sx + 0.3, sy + 0.2, r, 0.3); ring(c, 'rgba(255,240,200,0.2)', sx + 0.1, sy, 2.6, 0.3); } },
        { z0: 1.2, z1: 8.8, side: k.wdS, top: k.wdS, flat: true, bevel: false, ao: 0, shape: (c, zt) => { const r = rAtZ(1.2 + zt * 7.6); for (const a of [PI * 0.22, PI * 0.38, PI * 0.63, PI * 0.8]) { const g = 0.18 + 0.12 * Math.sin(zt * 11 + a * 5); wallQuad(c, sx + Math.cos(a) * r, sy + Math.sin(a) * r, Math.cos(a), Math.sin(a), g, 0.3, 0.25); } } },
        // arched door and a glowing porthole set into the flare
        { z0: 1, z1: 5.8, side: k.silS, top: k.silver, bevel: false, ao: 0, shape: (c, zt) => { const z = 1 + zt * 4.8, r = rAtZ(z); wallQuad(c, sx + 0.4, sy + r, 0, 1, 1.55 * archW(zt, 0.6) + 0.1, 0.4, 0.4); } },
        { z0: 1, z1: 5.4, side: sh(k.door, -0.2), top: k.door, flat: true, bevel: false, ao: 0, shape: (c, zt) => { const z = 1 + zt * 4.4, r = rAtZ(z); wallQuad(c, sx + 0.4, sy + r, 0, 1, 1.3 * archW(zt, 0.6), 0.5, 0.4); } },
        { z0: 4.5, z1: 6.5, side: k.glS, top: k.win, flat: true, bevel: false, ao: 0, shape: (c, zt) => { const z = 4.5 + zt * 2, hw = Math.sqrt(Math.max(0.01, 1 - (z - 5.5) * (z - 5.5))), r = rAtZ(z), a = PI * 0.76; wallQuad(c, sx + Math.cos(a) * r, sy + Math.sin(a) * r, Math.cos(a), Math.sin(a), hw, 0.45, 0.4); },
          detail: (c) => { const a = PI * 0.76, r = rAtZ(5.5); glowDot(c, k.gl, sx + Math.cos(a) * r, sy + Math.sin(a) * r + 1, 2.2, 0.5); } },
        // clay stove pipe through the rim, mushrooms at the roots
        { z0: Z1 - 0.5, z1: Z1 + 2.6, side: k.plS, top: k.plT, ao: 0.2, shape: (c, zt) => S.circ(c, sx + 3.4, sy - 2.8, zt > 0.85 ? 0.85 : 0.65), detail: (c) => S.dot(c, k.dark, sx + 3.4, sy - 2.8, 0.4) },
        { z0: 0.8, z1: 2.2, side: '#e8dcc8', top: '#f4ece0', bevel: false, shape: (c) => { S.circ(c, -6.2, 6.4, 0.32); S.circ(c, -7.4, 7.4, 0.26); S.circ(c, -5.1, 7.6, 0.24); } },
        { z0: 2.2, z1: 2.9, side: '#b8362a', top: '#e0503c', ao: 0.15, shape: (c, zt) => { const q = 1 - zt * 0.6; S.circ(c, -6.2, 6.4, 1.05 * q); S.circ(c, -7.4, 7.4, 0.8 * q); S.circ(c, -5.1, 7.6, 0.7 * q); }, detail: (c) => { S.dot(c, '#fff4ea', -6.5, 6.2, 0.22); S.dot(c, '#fff4ea', -5.9, 6.7, 0.16); S.dot(c, '#fff4ea', -7.5, 7.2, 0.16); } },
      ]));
      // leaf laid over the hollow stump (a humble green leaf, not copper)
      parts.push(...anchor([0, 0.1], leafRoof(k, { x: sx + 0.5, y: sy - 0.6, L: 9.6, W: 6.3, rot: 0.42, z0: Z1 - 0.3, H: 3.6, sb: 0.4, veins: 4, hornH: 2.2, lk: 0.1,
        dark: mx(k.lfD, k.lfM, 0.3), light: mx(k.lfM, k.lfL, 0.35), vein: mx(k.lfL, k.lfG, 0.4), veinS: k.lfD, ridge: k.lfL })));
      // firewood and a basket
      parts.push(...anchor([0, 7], logsY(k, [[6.2, 1.4], [7.5, 1.4], [8.8, 1.4], [6.85, 2.5], [8.15, 2.5]], 6, 1.9, 0.62)));
      parts.push(...anchor([0, 9], [
        { z0: 0.8, z1: 2.6, side: k.hayS, top: k.hay, ao: 0.3, shape: (c, zt) => S.circ(c, -9.2, 8.6, 1.2 + zt * 0.25), detail: (c) => { ring(c, rgba(k.p.d, 0.35), -9.2, 8.6, 0.8, 0.3); S.lines(c, rgba(k.p.d, 0.3), 0.25, [-10.3, 8.6, -8.1, 8.6, -9.2, 7.5, -9.2, 9.7]); } },
        ...lantern(k, [[-10.5, 4.5]], 3.6),
      ]));
      R = 15; H = 16;
    } else if (v === 2) {
      const B = { x: -4.5, y: 2.5, L: 10.5, W: 6.4, rot: 0.18, sf: 1, sb: 0.4 }, kp = [[8.6, -3.5]];
      const cu = mx('#d27a3a', k.p.t, 0.06), cuD = mx(cu, k.p.d, 0.38), cuL = mx(cu, '#ffe4b8', 0.4), pat = mx(k.p.t, '#a8ead0', 0.35);
      const fire = '#ffb347', fireHi = '#fff0b0';
      parts.push(...anchor([0, -8], [
        plinth(k, (c) => { S.poly(c, leafPts(B.x, B.y, B.L + 1.8, B.W + 1.8, B.rot, 1, 0.4)); S.circ(c, kp[0][0], kp[0][1], 5.4); }),
        // kiln: stone drum, silver-framed furnace mouth with an amber fire, tall chimney with a copper cap
        towerBody(k, kp, 4, 1.5, 10.5, 0.2, { side: k.st2S, top: k.st2T }),
        arcWins(k, kp, 4, 2.2, 6.8, [PI * 0.5], 0.44, k.silver, { flat: false, side: k.silS }),
        arcWins(k, kp, 4, 2.2, 6.3, [PI * 0.5], 0.37, fire, { side: '#ff8a2a', top: fireHi, detail: (c) => glowDot(c, '#ff9a3a', kp[0][0], kp[0][1] + 4 + 2.3, 3.4, 0.55) }),
        frontBand(k, kp, 4, 9.6, 10.5),
        { z0: 10.5, z1: 12.2, side: k.st2S, top: k.st2T, ao: 0.2, shape: (c, zt) => S.circ(c, kp[0][0], kp[0][1], 4.4 - zt * 2.7) },
        towerBody(k, kp, 1.5, 12.2, 22, 0, { side: k.st2S, top: k.st2T }),
        { z0: 22, z1: 23.3, side: cuD, top: cuL, ao: 0.1, shape: (c, zt) => S.circ(c, kp[0][0], kp[0][1], 2.1 - zt * 0.4) },
        { z0: 23.3, z1: 23.6, side: fire, top: fireHi, flat: true, bevel: false, shape: (c) => S.circ(c, kp[0][0], kp[0][1], 1.05), detail: (c) => glowDot(c, '#ffb050', kp[0][0], kp[0][1], 3, 0.4) },
      ]));
      parts.push(...anchor([0, 2], [
        wallP(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L, B.W, B.rot, 1, 0.4)), 1.5, 8.5),
        leafFrames(k, B, [PI * 0.26, PI * 0.74], 4, 7, 0.75), leafWins(k, B, [PI * 0.26, PI * 0.74], 4, 7, 0.75),
        leafFrames(k, B, [PI * 0.5], 1.5, 6.8, 1.15), leafWins(k, B, [PI * 0.5], 1.5, 6.8, 1.15, k.door),
        ...leafRoof(k, { x: B.x, y: B.y, L: B.L + 1.6, W: B.W + 1.4, rot: B.rot, z0: 8.5, H: 5.2, sb: 0.4, veins: 4, hornH: 3, dark: cuD, light: cuL, vein: pat, veinS: mx(pat, k.p.d, 0.35), ridge: pat }),
      ]));
      // leaf awning on silver posts, bench of glowing glassware in front of it
      const ap = [[-12.5, 9], [-5.5, 9]];
      parts.push(...anchor([0, 9], [
        { z0: 0, z1: 6.4, side: k.silS, top: k.silver, bevel: false, ao: 0.3, shape: (c, zt) => { for (const q of ap) S.circ(c, q[0], q[1], 0.36 + (zt < 0.07 ? 0.45 : 0)); } },
        ...leafRoof(k, { x: -9, y: 5.6, L: 6.2, W: 4, rot: 0, z0: 6.4, H: 2.2, veins: 3, hornH: 1.8, sb: 0.6 }),
      ]));
      parts.push(...anchor([0, 11], [
        { z0: 0, z1: 2.6, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c) => S.rect(c, -13, 9.8, 8.4, 2.6), detail: (c) => S.lines(c, rgba(k.p.d, 0.3), 0.3, [-12.5, 11.1, -5, 11.1]) },
        { z0: 2.6, z1: 4.6, side: '#f06aa8', top: '#ffd0e8', flat: true, bevel: false, ao: -0.2, shape: (c, zt) => { const r = 0.6 * Math.sin(zt * PI) + 0.22; S.circ(c, -11.6, 11.1, r); S.circ(c, -6.4, 11.3, r * 0.8); } },
        { z0: 2.6, z1: 5, side: fire, top: fireHi, flat: true, bevel: false, ao: -0.2, shape: (c, zt) => { const r = 0.55 * Math.sin(zt * PI) + 0.2; S.circ(c, -9.4, 10.9, r); } },
        { z0: 2.6, z1: 4.2, side: k.glS, top: k.glHi, flat: true, bevel: false, ao: -0.2, shape: (c, zt) => { const r = 0.5 * Math.sin(zt * PI * 0.9) + 0.25; S.circ(c, -8, 11.4, r); S.circ(c, -10.7, 11.5, r * 0.7); },
          detail: (c) => { glowDot(c, k.gl, -8, 11.4 + 1.5, 2, 0.4); glowDot(c, '#ff9ac8', -11.6, 11.1 + 1.5, 2, 0.35); glowDot(c, fire, -9.4, 10.9 + 1.5, 2, 0.35); } },
        { z0: 0, z1: 2.2, side: k.wdS, top: k.wdT, ao: 0.25, shape: (c) => S.rect(c, -2.6, 10.4, 2.4, 2.4), detail: (c) => { c.fillStyle = mx(k.hay, '#ffffff', 0.35); c.beginPath(); S.rect(c, -2.3, 10.7, 1.8, 1.8); c.fill(); } },
        ...lantern(k, [[6, 10.5]], 4),
      ]));
      R = 17; H = 26;
    } else {
      const cx = 0, cy = -1, cp = [[cx, cy]], TY = cy + 2;
      parts.push(...anchor([0, -30], tree(k, { x: -13.5, y: -10, th: 8, cr: 6.4, ch: 7.5, seed: 41 })));
      parts.push(...anchor([0, -5], [
        plinth(k, (c) => S.circ(c, cx, TY, 13.5), 1.5, { detail: (c) => { ring(c, k.fil, cx, TY, 10.8, 0.4); curlRing(c, k.fil, cx, TY, 12.3, 10, 1.5, 0.35); S.lines(c, k.seam, 0.3, [-3.5, TY + 8, -3.5, TY + 13, 3.5, TY + 8, 3.5, TY + 13]); } }),
        // round pavilion with three wide tea-room arches
        towerBody(k, cp, 8.6, 1.5, 9, 0.04),
        arcWins(k, cp, 8.6, 1.5, 8.2, [PI * 0.3, PI * 0.5, PI * 0.7], 0.17, k.silver, { flat: false, side: k.silS }),
        arcWins(k, cp, 8.6, 1.5, 7.8, [PI * 0.3, PI * 0.5, PI * 0.7], 0.14, k.win),
        frontBand(k, cp, 8.6, 8.2, 9),
        ...capRoof(k, { pts: cp, R: 11.4, z0: 9, H: 4.4, prof: 'pagoda', ribs: 7, finial: 0 }),
        // lantern drum and bud dome with a silver crescent moon
        towerBody(k, cp, 4.8, 13.4, 16.4, 0),
        arcWins(k, cp, 4.8, 13.8, 15.9, [PI * 0.35, PI * 0.5, PI * 0.65], 0.14, k.win),
        frontBand(k, cp, 4.8, 15.8, 16.4),
        ...capRoof(k, { pts: cp, R: 5.9, z0: 16.4, H: 5, prof: 'bud', ribs: 5, finial: 0, band: true }),
        { z0: 21, z1: 22.2, side: k.silS, top: k.silver, bevel: false, shape: (c) => S.circ(c, cx, cy, 0.32) },
        moon(k, cx, cy, 24.3, 2.3, undefined, undefined, undefined, 0.85),
      ]));
      // stable wing on the left with a wide stall arch
      const A = { x: -11.5, y: 4.5, L: 6.6, W: 4.3, rot: -0.3, sf: 1, sb: 0.6 };
      parts.push(...anchor([0, 1], [
        wallP(k, (c) => S.poly(c, leafPts(A.x, A.y, A.L, A.W, A.rot, 1, 0.6)), 1.5, 6.4),
        leafFrames(k, A, [PI * 0.5], 1.5, 5.9, 1.75), leafWins(k, A, [PI * 0.5], 1.5, 5.9, 1.75, k.door),
        ...leafRoof(k, { x: A.x, y: A.y, L: A.L + 1.5, W: A.W + 1.4, rot: A.rot, z0: 6.4, H: 3.6, veins: 3, hornH: 2.6, sb: 0.6 }),
        { z0: 0, z1: 2.6, side: k.hayS, top: k.hay, ao: 0.3, shape: (c, zt) => S.blob(c, -16.5, 9.5, 2.2 * Math.sqrt(1 - zt * zt * 0.8) + 0.1, 5, 9, 0.15) },
      ]));
      // moon-lantern sign on a silver post, steps, path lanterns
      parts.push(...anchor([0, 9], [
        { z0: 0, z1: 9.8, side: k.silS, top: k.silver, bevel: false, ao: 0.2, shape: (c, zt) => { S.circ(c, 15, 10.5, 0.36 + (zt < 0.06 ? 0.5 : 0)); if (zt > 0.93) c.rect(11.4, 10.2, 3.8, 0.6); } },
        { z0: 8.3, z1: 9.4, side: k.silS, top: k.silver, bevel: false, shape: (c) => S.circ(c, 12.3, 10.5, 0.12) },
        moon(k, 12.3, 10.5, 6.9, 1.5, k.glS, k.glHi, { flat: true, ao: -0.2, detail: (c) => glowDot(c, k.gl, 12.3, 10.5 + 1.5, 3.2, 0.5) }, 0.7),
      ]));
      parts.push(...anchor([0, 20], stairs(k, cx, TY + 11.2, TY + 15, 7.5, 1.5)));
      parts.push(...anchor([0, 14], lantern(k, [[-7.5, TY + 11.5], [7.5, TY + 11.5]], 4)));
      R = 22; H = 28;
    }
    return { r: R, h: H, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ============================================================== SHED
   * open-fronted store: crescent ivory back wall, silver posts, leaf canopy; firewood,
   * barrels and a woven basket inside */
  M.elf_shed = function (pal, opt) {
    const k = kit(P(pal)), parts = [];
    parts.push(...anchor([0, -6], [
      plinth(k, (c) => S.ell(c, 0, 0.8, 9.2, 7.2), 0.8),
      wallP(k, (c) => S.poly(c, crescentPts(0, 1.2, 5.8, 1.2, PI * 1.02, PI * 1.98, 20, 0.05)), 0.8, 6.4),
      { z0: 0.8, z1: 0.9, side: k.dark, top: rgba(k.p.d, 0.45), flat: true, bevel: false, shape: (c) => S.poly(c, crescentPts(0, 1.2, 3.2, 3.2, PI * 1.02, PI * 1.98, 20, 0.05)) },
    ]));
    parts.push(...anchor([0, 0], logsY(k, [[-4.1, 1.45], [-2.8, 1.45], [-1.5, 1.45], [-3.45, 2.55], [-2.15, 2.55]], 1.8, 2.3, 0.62)));
    parts.push(...anchor([0, 1], [
      { z0: 0.8, z1: 3.6, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c, zt) => { const r = 1.25 * (1 + 0.1 * Math.sin(zt * PI)); S.circ(c, 2, 2.4, r); S.circ(c, 4.5, 1.9, r); }, detail: (c) => { for (const q of [[2, 2.4], [4.5, 1.9]]) ring(c, k.silS, q[0], q[1], 0.95, 0.3); } },
      { z0: 0.8, z1: 2.9, side: k.hayS, top: k.hay, ao: 0.3, shape: (c, zt) => S.circ(c, 3.4, 5.2, 1.3 + zt * 0.2), detail: (c) => { ring(c, rgba(k.p.d, 0.35), 3.4, 5.2, 0.85, 0.3); S.lines(c, rgba(k.p.d, 0.3), 0.25, [2.3, 5.2, 4.5, 5.2, 3.4, 4.1, 3.4, 6.3]); } },
    ]));
    parts.push(...anchor([0, 5], [
      { z0: 0.8, z1: 6.2, side: k.silS, top: k.silver, bevel: false, ao: 0.3, shape: (c, zt) => { for (const q of [[-6, 5.6], [6, 5.6]]) S.circ(c, q[0], q[1], 0.38 + (zt < 0.08 ? 0.45 : 0)); } },
      ...leafRoof(k, { x: 0.3, y: 1, L: 9.4, W: 5.8, rot: 0, z0: 6.3, H: 2.8, sb: 0.5, veins: 4, hornH: 2.2 }),
    ]));
    return { r: 10, h: 11, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* =========================================================== GRANARY
   * dovecote tower: slender ivory drum, silver bands, pigeon holes under a ledge with
   * doves, bud dome */
  M.elf_granary = function (pal, opt) {
    const k = kit(P(pal)), parts = [], gp = [[0, 0]];
    parts.push(...anchor([0, 0], [
      plinth(k, (c) => S.circ(c, 0, 0.6, 5.8)),
      towerBody(k, gp, 3.9, 1.5, 11, 0.12),
      arcWins(k, gp, 3.9, 1.5, 5.4, [PI * 0.5], 0.3, k.silver, { flat: false, side: k.silS }),
      arcWins(k, gp, 3.9, 1.5, 5, [PI * 0.5], 0.25, k.door),
      frontBand(k, gp, 3.9, 7, 7.7),
      { z0: 7.7, z1: 8.2, side: k.silS, top: k.st2T, bevel: false, ao: 0.1, shape: (c) => S.circ(c, 0, 0, 4.6) },
      arcWins(k, gp, 3.9, 8.3, 10, [PI * 0.14, PI * 0.32, PI * 0.5, PI * 0.68, PI * 0.86], 0.15, k.dark),
      { z0: 8.2, z1: 9.4, side: '#d6dce0', top: '#ffffff', bevel: false, ao: 0.2, shape: (c, zt) => { const r = 0.55 * Math.sin(zt * PI * 0.85 + 0.35) + 0.1; S.ell(c, 2.6, 4, r * 1.35, r); S.ell(c, -3.4, 3.3, r * 1.35, r); } },
      frontBand(k, gp, 3.9, 10.2, 11),
      ...capRoof(k, { pts: gp, R: 4.9, z0: 11, H: 6, prof: 'bud', ribs: 5, finial: 2.8, band: true }),
    ]));
    return { r: 7, h: 21, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };
})(window.AS = window.AS || {});

/* =============================================================================
 * HRIMGARD (ice) — facade-sliver technique of models_ice.js
 * ============================================================================= */
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models = AS.Models || {};
  const DEF = { a: '#71849a', b: '#dbe6f2', t: '#eef5fb', g: '#8ad8ff', d: '#253650', k: '#3567b4', k2: '#e2f1ff', w: '#5a4a3e', s: '#a9dcf3' };
  function P(p) { const o = Object.assign({}, DEF); if (p && typeof p === 'object') for (const q in p) if (p[q]) o[q] = p[q]; return o; }
  const hx = (c) => '#' + C.hex(c).map((v) => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => hx(C.mix(a, b, t));
  const sh = (c, f) => hx(C.shade(c, f));
  const rgba = (c, a) => C.str(c, a);
  function K(pal) {
    const p = P(pal);
    return {
      p,
      st: mix(p.a, p.d, 0.2), stT: mix(p.a, p.b, 0.32), stD: mix(p.a, p.d, 0.5), stL: mix(p.a, p.b, 0.5),
      pl: mix(p.d, p.a, 0.3), plT: mix(mix(p.a, p.b, 0.22), p.d, 0.08),
      sn: p.t, snS: mix(p.t, p.a, 0.3), snD: mix(p.t, p.d, 0.45), snL: mix(p.t, '#ffffff', 0.5),
      wd: p.w, wdD: sh(p.w, -0.4), wdL: mix(p.w, p.b, 0.3),
      ice: p.s, iceD: mix(p.s, p.d, 0.42), iceL: mix(p.s, '#ffffff', 0.55),
      gl: p.g, glH: mix(p.g, '#ffffff', 0.65), glD: mix(p.g, p.d, 0.45),
      win: mix(p.d, '#000000', 0.3), iron: mix(p.d, '#15161a', 0.55), ironT: mix(p.a, p.d, 0.45),
      k: p.k, kD: sh(p.k, -0.3), k2: p.k2,
    };
  }

  /* ------------------------------------------------------------ geometry helpers */
  const ngon = (x, y, r, n, rot) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push(x + Math.cos(t) * r, y + Math.sin(t) * r); } return a; };
  const tf = (pts, ox, oy, a) => { const ca = Math.cos(a || 0), sa = Math.sin(a || 0), out = []; for (let i = 0; i < pts.length; i += 2) out.push(ox + pts[i] * ca - pts[i + 1] * sa, oy + pts[i] * sa + pts[i + 1] * ca); return out; };
  // thin vertical sliver just proud of a +y (camera-facing) wall at y
  const fsl = (c, x0, x1, y, inn, out) => { inn = inn === undefined ? 0.6 : inn; out = out === undefined ? 0.32 : out; c.moveTo(x0, y - inn); c.lineTo(x1, y - inn); c.lineTo(x1, y + out); c.lineTo(x0, y + out); c.closePath(); };
  // sliver on the face of a cylinder between angles a0..a1 (front = PI/2)
  function arcSeg(c, x, y, r, w, a0, a1) { c.moveTo(x + Math.cos(a0) * (r + w * 0.35), y + Math.sin(a0) * (r + w * 0.35)); c.arc(x, y, r + w * 0.35, a0, a1); c.arc(x, y, r - w * 0.65, a1, a0, true); c.closePath(); }
  // faint ground halo (alpha below the forge's solid cut → no outline)
  function halo(c, col, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(col, a || 0.3)); g.addColorStop(1, C.str(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function snowPatch(c, x, y, r, seed, col) { c.save(); c.fillStyle = col; c.beginPath(); S.blob(c, x, y, r, seed, 9, 0.45); c.fill(); c.restore(); }
  // screen-down component of an object-space normal for the frame being rendered (> 0: faces the camera)
  const facing = (c, nx, ny) => { const t = c.getTransform(); const n = Math.hypot(t.a, t.b) || 1; return (t.b / n) * nx + (t.a / n) * ny; };
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  function deco(col, items, ex) {
    let z0 = Infinity, z1 = -Infinity;
    for (const it of items) { z0 = Math.min(z0, it[0]); z1 = Math.max(z1, it[1]); }
    if (!items.length) { z0 = 0; z1 = 0; }
    return Object.assign({ z0, z1, side: col, top: col, ao: 0, flat: true, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0);
      for (let i = 0; i < items.length; i++) { const it = items[i]; if (z >= it[0] - 1e-6 && z <= it[1] + 1e-6) it[2](c, z); }
    } }, ex || {});
  }
  const It = {
    rect: (x, y, w, za, zb, inn, out) => [za, zb, (c) => fsl(c, x - w / 2, x + w / 2, y, inn, out)],
    arch: (x, y, w, za, zb, inn, out) => [za, zb, (c, z) => { const r = w / 2, zc = zb - r; const h = z > zc ? Math.sqrt(Math.max(0, r * r - (z - zc) * (z - zc))) : r; if (h > 0.15) fsl(c, x - h, x + h, y, inn, out); }],
    // pointed nordic arch
    peak: (x, y, w, za, zb, inn, out) => [za, zb, (c, z) => { const r = w / 2, zc = zb - w * 0.75; const h = z > zc ? r * (1 - (z - zc) / (zb - zc)) : r; if (h > 0.15) fsl(c, x - h, x + h, y, inn, out); }],
    disc: (x, y, r, zc, half, out) => [zc - r, zc + r, (c, z) => { const h = Math.sqrt(Math.max(0, r * r - (z - zc) * (z - zc))); if (h < 0.12) return; if (half < 0) fsl(c, x - h, x, y, 0.3, out || 0.55); else if (half > 0) fsl(c, x, x + h, y, 0.3, out || 0.55); else fsl(c, x - h, x + h, y, 0.3, out || 0.55); }],
    hl: (xa, xb, y, z, t, inn, out) => [z, z + (t || 0.5), (c) => fsl(c, xa, xb, y, inn, out)],
    vl: (x, y, za, zb, w, inn, out) => [za, zb, (c) => fsl(c, x - (w || 0.5) / 2, x + (w || 0.5) / 2, y, inn, out)],
    arc: (cx, cy, r, a0, a1, za, zb, w) => [za, zb, (c) => arcSeg(c, cx, cy, r, w || 1, a0, a1)],
    fn: (za, zb, f) => [za, zb, f],
    // hanging banner with a swallowtail
    banner: (x, y, w, za, zb, notch) => [za, zb, (c, z) => { const n = notch === undefined ? w * 0.6 : notch; const h = w / 2; if (z < za + n) { const g = h * (1 - (z - za) / n); fsl(c, x - h, x - g, y, 0.3, 0.5); fsl(c, x + g, x + h, y, 0.3, 0.5); } else fsl(c, x - h, x + h, y, 0.3, 0.5); }],
  };
  // ashlar coursing (mortar lines + staggered joints) on a flat +y face
  function masonry(xa, xb, y, za, zb, ch, jw, seed) {
    const its = []; ch = ch || 3; jw = jw || 5; seed = seed || 1;
    let i = 0;
    for (let z = za; z < zb - 0.7; z += ch, i++) {
      if (z > za) its.push(It.hl(xa, xb, y, z, 0.45));
      const off = (U.hash2(i, seed, 3) * 0.6 + (i % 2) * 0.5) * jw;
      for (let x = xa + off; x < xb - 0.8; x += jw * (0.8 + U.hash2(i, Math.round(x * 3), seed) * 0.5)) if (x > xa + 0.8) its.push(It.vl(x, y, z + 0.45, Math.min(zb, z + ch), 0.42));
    }
    return its;
  }
  // coursing on the front half of a round tower
  function masonryR(cx, cy, r, za, zb, ch, n, seed) {
    const its = []; ch = ch || 3; n = n || 5; seed = seed || 1;
    let i = 0;
    for (let z = za; z < zb - 0.7; z += ch, i++) {
      if (z > za) its.push(It.arc(cx, cy, r, 0.05, Math.PI - 0.05, z, z + 0.45, 0.9));
      const off = (i % 2) * 0.5 + U.hash2(i, seed, 9) * 0.3;
      for (let q = 0; q < n; q++) { const a = 0.25 + (q + off) / n * (Math.PI - 0.5); its.push(It.arc(cx, cy, r, a, a + 0.05, z + 0.45, Math.min(zb, z + ch), 0.9)); }
    }
    return its;
  }

  /* Facade accumulator: collects deco items per material and flushes them as one part
   * per material in a fixed layering order (mortar → trims → wood → windows → glow →
   * banners → iron). */
  const FAC_ORDER = ['mas', 'quoin', 'frame', 'wood', 'woodD', 'win', 'gl', 'k', 'k2', 'iron', 'ice'];
  function Fac(k) {
    const L = {};
    const col = { mas: k.stD, quoin: k.stL, frame: k.stL, wood: k.wd, woodD: k.wdD, win: k.win, gl: k.gl, k: k.k, k2: k.k2, iron: k.iron, ice: k.iceL };
    const ex = { quoin: { flat: false }, frame: { flat: false }, wood: { flat: false, ao: 0.15 }, woodD: { flat: false, ao: 0.2 }, k: { flat: false, ao: 0.2 }, k2: { flat: false }, gl: { ao: -0.25 } };
    const F = {
      add(key, it) { (L[key] = L[key] || []).push(it); return F; },
      addAll(key, its) { for (const it of its) F.add(key, it); return F; },
      mas(its) { return F.addAll('mas', its); },
      // lit window: dark recess + inset frost glow
      win(x, y, w, za, zb, kind) { const f = It[kind || 'rect']; F.add('win', f(x, y, w, za, zb, 0.6, 0.3)); F.add('gl', f(x, y + 0.04, Math.max(0.6, w - 0.9), za + 0.45, zb - 0.3, 0.6, 0.36)); return F; },
      // arrow slit
      slit(x, y, za, zb) { return F.add('win', It.rect(x, y, 0.8, za, zb, 0.6, 0.3)); },
      // door: dressed-stone surround + plank leaf (+ iron straps)
      door(x, y, w, za, zb, kind, straps) { const f = It[kind || 'arch']; F.add('frame', f(x, y, w + 1.4, za, zb + 0.7, 0.6, 0.32)); F.add('woodD', f(x, y + 0.04, w, za, zb, 0.6, 0.4)); if (straps === false) return F; F.add('iron', It.hl(x - w / 2 + 0.3, x + w / 2 - 0.3, y + 0.08, za + (zb - za) * 0.3, 0.45, 0.6, 0.45)); F.add('iron', It.hl(x - w / 2 + 0.3, x + w / 2 - 0.3, y + 0.08, za + (zb - za) * 0.62, 0.45, 0.6, 0.45)); return F; },
      // round shields: k field, k2 half, iron boss
      shields(xs, y, zc, r) { r = r || 1.5; xs.forEach((x, i) => { F.add('k', It.disc(x, y, r, zc)); F.add('k2', It.disc(x, y + 0.04, r - 0.1, zc, i % 2 ? 1 : -1, 0.6)); F.add('iron', It.disc(x, y + 0.08, r * 0.3, zc, 0, 0.7)); }); return F; },
      // hanging banner: k swallowtail with a k2 band and stripe
      banner(x, y, w, za, zb) { F.add('k', It.banner(x, y, w, za, zb)); F.add('k2', It.rect(x, y + 0.04, w, zb - (zb - za) * 0.2, zb - (zb - za) * 0.13, 0.3, 0.56)); F.add('k2', It.rect(x, y + 0.04, w * 0.22, za + w * 0.7, zb - (zb - za) * 0.28, 0.3, 0.56)); return F; },
      quoins(x, y, za, zb, w) { w = w || 1.8; let i = 0; for (let z = za; z < zb - 0.6; z += 1.6, i++) F.add('frame', It.rect(x + (i % 2 ? w * 0.18 : -w * 0.18), y, w, z, Math.min(zb, z + 1.15), 0.6, 0.34)); return F; },
      flush(parts) { for (const key of FAC_ORDER) if (L[key] && L[key].length) { parts.push(deco(col[key], L[key], ex[key])); L[key] = []; } return F; },
    };
    return F;
  }

  /* ------------------------------------------------------------ building blocks */
  const box = (x0, y0, x1, y1, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => c.rect(x0, y0, x1 - x0, y1 - y0) }, ex || {});
  // battered (inward-leaning) box: thick Hrimgard walls
  const bbox = (x0, y0, x1, y1, z0, z1, bat, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c, zt) => { const b = bat * zt; c.rect(x0 + b, y0 + b, x1 - x0 - b * 2, y1 - y0 - b * 2); } }, ex || {});
  const cyl = (x, y, r, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => S.circ(c, x, y, r) }, ex || {});
  // battered round tower body (radius shrinks by bat toward the top)
  const tcyl = (x, y, r, z0, z1, bat, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c, zt) => S.circ(c, x, y, r - bat * zt) }, ex || {});
  function roofX(parts, k, o) {
    const x0 = o.x0, x1 = o.x1, yc = o.yc || 0, d = o.d, z0 = o.z0, z1 = o.z1, hip = o.hip || 0, seed = o.seed || 3;
    const lit = o.lit || k.snL, shd = o.shade || k.snS;
    const hw = (zt) => d * (1 - zt) + 0.05;
    const ax = (zt) => x0 + hip * zt, bx = (zt) => x1 - hip * zt;
    parts.push({ z0, z1, side: lit, top: lit, ao: 0.04, bevel: false, shape: (c, zt) => c.rect(ax(zt), yc - hw(zt), bx(zt) - ax(zt), hw(zt)) });
    parts.push({ z0, z1, side: shd, top: lit, ao: o.ao === undefined ? 0.16 : o.ao, bevel: false, shape: (c, zt) => c.rect(ax(zt), yc, bx(zt) - ax(zt), hw(zt)) });
    // wavy drift lines across the front plane: blue shadow band under a lit crest
    const rows = o.rows === undefined ? 2 : o.rows;
    if (rows) {
      const zs = []; for (let i = 1; i <= rows; i++) zs.push(z0 + (z1 - z0) * (i / (rows + 1)) * 0.92);
      const drift = (dz, w) => (c, zt) => {
        const z = z0 + zt * (z1 - z0);
        zs.forEach((q, j) => { if (Math.abs(z - q - dz) < 0.26) { const t = (z - z0) / (z1 - z0), xa = ax(t) + 1.2, xb = bx(t) - 1.2, y = yc + hw(t); c.moveTo(xa, y - 0.2); for (let x = xa; x <= xb; x += 1) c.lineTo(x, y + w + Math.sin(x * 0.55 + j * 2 + seed) * 0.6); c.lineTo(xb, y - 0.7); c.lineTo(xa, y - 0.7); c.closePath(); } });
      };
      parts.push({ z0, z1, side: mix(shd, k.p.a, 0.2), top: shd, flat: true, ao: 0, bevel: false, shape: drift(0, 0.9) });
      parts.push({ z0, z1, side: k.snL, top: k.snL, flat: true, ao: 0, bevel: false, shape: drift(0.5, 0.15) });
    }
    // one timber part: verge boards (gabled ends), eave fascia, ridge beam, dragon-head finials
    const verge = o.verge === undefined ? !hip : o.verge, fas = o.fascia !== false, rid = o.ridge !== false, hor = o.horns !== false, HH = o.hornH || 4.5;
    const tz0 = fas ? z0 - 1.5 : z0, tz1 = hor ? z1 + HH : z1 + 0.7;
    parts.push({ z0: tz0, z1: tz1, side: k.wdD, top: k.wd, ao: 0.08, bevel: false, shape: (c, zt) => {
      const z = tz0 + zt * (tz1 - tz0);
      if (fas && z <= z0 + 1e-6) c.rect(x0 + 0.3, yc + d - 1.1, x1 - x0 - 0.6, 1.05);
      if (verge && z >= z0 && z <= z1 + 0.3) { const t = Math.min(1, (z - z0) / (z1 - z0)), h = hw(t) + 0.35; c.rect(ax(t) - 0.5, yc - h, 1.1, h * 2); c.rect(bx(t) - 0.6, yc - h, 1.1, h * 2); }
      if (rid && z >= z1 - 0.8 && z <= z1 + 0.7) c.rect(ax(1) - 0.5, yc - 0.7, bx(1) - ax(1) + 1, 1.4);
      if (hor && z >= z1 - 0.4) { const ht = (z - z1 + 0.4) / (HH + 0.4); for (const sg of [-1, 1]) { const x = (sg < 0 ? ax(1) : bx(1)) + sg * ht * ht * 2.4; if (ht > 0.82) { const L = (ht - 0.7) * 6; c.rect(Math.min(x, x + sg * L), yc - 0.52, Math.abs(L), 1.04); } else S.circ(c, x, yc, 0.52); } }
    } });
    // one snow part: scalloped eave lip + icicles hanging below it
    const lip = o.lip !== false, icy = o.icicles !== false;
    const bl = []; for (let x = x0 + 0.6; x <= x1 - 0.4; x += 2.1) bl.push([x + (U.hash2(Math.round(x), seed, 4) - 0.5) * 0.6, 1.05 + U.hash2(Math.round(x), seed, 6) * 0.55]);
    const xs = []; for (let x = x0 + 1.2; x <= x1 - 1.2; x += 2.2 * (0.7 + U.hash2(Math.round(x * 5), seed, 1) * 0.6)) xs.push(x);
    const IL = xs.map((x, i) => 1 + U.hash2(i, seed, 5) * 2.4);
    if (lip || icy) {
      const lz0 = icy ? z0 - 4.1 : z0 - 0.8, lz1 = lip ? z0 + 0.9 : z0 - 0.7;
      parts.push({ z0: lz0, z1: lz1, side: mix(k.sn, k.p.a, 0.12), top: lit, ao: 0.1, bevel: false, shape: (c, zt) => {
        const z = lz0 + zt * (lz1 - lz0);
        if (lip && z >= z0 - 0.8) { const lt = (z - z0 + 0.8) / 1.7; c.rect(x0, yc + d - 1.4, x1 - x0, 1.4); for (const q of bl) S.circ(c, q[0], yc + d - 0.3, q[1] * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - lt)))); }
        if (icy && z <= z0 - 0.7) { const dep = z0 - 0.7 - z; for (let i = 0; i < xs.length; i++) if (dep < IL[i]) S.circ(c, xs[i], yc + d + 0.35, 0.06 + 0.4 * (1 - dep / IL[i])); }
      } });
    }
  }
  // carved dragon-head finials rising from both ends of an x ridge
  function hornsX(k, xa, xb, yc, z, H) {
    return { z0: z - 0.4, z1: z + H, side: k.wdD, top: k.wd, stroke: 1.05, bevel: false, ao: 0.1, shape: (c, zt) => {
      for (const sg of [-1, 1]) {
        const xe = sg < 0 ? xa : xb, x = xe + sg * (zt * zt * 2.4);
        if (zt > 0.82) S.seg(c, x, yc, x + sg * (zt - 0.7) * 6, yc); else S.seg(c, x, yc, x + sg * 0.01, yc);
      }
    } };
  }
  function icicles(k, xa, xb, y, z, seed, step) {
    const xs = []; step = step || 2.2;
    for (let x = xa; x <= xb; x += step * (0.7 + U.hash2(Math.round(x * 5), seed, 1) * 0.6)) xs.push(x);
    const L = xs.map((x, i) => 1 + U.hash2(i, seed, 5) * 2.4);
    return { z0: z - 3.4, z1: z, side: k.iceL, top: k.iceL, flat: true, ao: 0.3, bevel: false, shape: (c, zt) => {
      const dep = (1 - zt) * 3.4;
      for (let i = 0; i < xs.length; i++) if (dep < L[i]) S.circ(c, xs[i], y, 0.06 + 0.4 * (1 - dep / L[i]));
    } };
  }

  /* Gable-front roof (ridge along y): the carved gable faces the camera. Left plane
   * lit, right plane shaded, course lines, a timber gable wall with a round frost window,
   * and bargeboards crossing above the apex into dragon-head horns.
   * o.cut(z) → min y (for a valley into a roof behind). */
  function roofY(parts, k, o) {
    const xc = o.xc || 0, y0 = o.y0, y1 = o.y1, hw = o.hw, z0 = o.z0, z1 = o.z1;
    const lit = o.lit || k.snL, shd = o.shade || k.snS;
    const cut = o.cut || (() => y0);
    const wz = (z) => hw * (1 - (z - z0) / (z1 - z0));
    parts.push({ z0, z1, side: lit, top: lit, ao: 0.08, bevel: false, shape: (c, zt) => { const z = z0 + zt * (z1 - z0), w = wz(z) + 0.05, ya = Math.max(y0, cut(z)); if (ya < y1) c.rect(xc - w, ya, w, y1 - ya); } });
    parts.push({ z0, z1, side: shd, top: lit, ao: 0.18, bevel: false, shape: (c, zt) => { const z = z0 + zt * (z1 - z0), w = wz(z) + 0.05, ya = Math.max(y0, cut(z)); if (ya < y1) c.rect(xc, ya, w, y1 - ya); } });
    const rows = o.rows === undefined ? 2 : o.rows;
    if (rows) {
      const zs = []; for (let i = 1; i <= rows; i++) zs.push(z0 + (z1 - z0) * i / (rows + 1));
      parts.push({ z0, z1, side: mix(shd, k.p.a, 0.2), top: shd, flat: true, ao: 0, bevel: false, shape: (c, zt) => {
        const z = z0 + zt * (z1 - z0);
        for (const q of zs) if (Math.abs(z - q) < 0.26) { const w = wz(z), ya = Math.max(y0, cut(z)) + 0.4; c.rect(xc - w, ya, 0.7, y1 - ya - 0.4); c.rect(xc + w - 0.7, ya, 0.7, y1 - ya - 0.4); }
      } });
    }
    const bt = o.bt || 1.5;
    const zg = z1 - bt * (z1 - z0) / hw, zh = z1 + (o.horn === undefined ? 4 : o.horn);
    const gc = o.gable || k.wd, gab = o.gable !== false;
    if (gab) parts.push({ z0: z0 + 0.01, z1: zg, side: gc, top: gc, ao: 0.25, bevel: false, shape: (c, zt) => { const z = z0 + zt * (zg - z0), w = wz(z) - bt + 0.3; if (w > 0.1) c.rect(xc - w, y1 - 1.3, w * 2, 1.1); } });
    // one dark-timber part: plank seams + window ring on the gable, then the bargeboards
    // crossing above the apex into dragon-head horns
    const gr = Math.min(1.8, hw * 0.15), gz = z0 + (zg - z0) * 0.36, gw = gab && o.gwin !== false;
    parts.push({ z0, z1: zh, side: o.board || k.wdD, top: o.board || k.wd, ao: 0.05, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (zh - z0);
      if (gab && z < zg) {
        for (let x = -hw + bt + 1.6; x < hw - bt - 1; x += 1.7) if (Math.abs(x) < wz(z) - bt - 0.2) fsl(c, xc + x - 0.18, xc + x + 0.18, y1 - 0.2, 0.3, 0.12);
        if (gw && Math.abs(z - gz) < gr + 0.5) { const h = Math.sqrt(Math.max(0, (gr + 0.5) ** 2 - (z - gz) ** 2)); fsl(c, xc - h, xc + h, y1 - 0.1, 0.3, 0.3); }
      }
      let w = wz(z);
      if (z > z1) w *= 1 + 0.9 * Math.pow((z - z1) / (zh - z1), 1.5);
      for (const sg of [-1, 1]) { const xa = xc + sg * w; c.rect(xa - 0.85, y1 - 0.6, 1.7, 1.2); }
    } });
    if (gw) parts.push(deco(k.gl, [It.disc(xc, y1 + 0.05, gr, gz, 0, 0.3)], { ao: -0.3 }));
  }

  function crystals(parts, k, list, o) {
    o = o || {};
    let zmin = Infinity, zmax = -Infinity;
    for (const q of list) { zmin = Math.min(zmin, q[6] || 0); zmax = Math.max(zmax, (q[6] || 0) + q[3]); }
    const half = (sg) => (c, zt) => {
      const zz = zmin + zt * (zmax - zmin);
      for (const q of list) {
        const t = (zz - (q[6] || 0)) / q[3]; if (t < -1e-6 || t > 1) continue;
        const r = q[2] * (t < 0.68 ? 1 - t * 0.22 : 0.85 * (1 - (t - 0.68) / 0.32)) + 0.05;
        const cx = q[0] + (q[4] || 0) * t, cy = q[1] + (q[5] || 0) * t;
        S.poly(c, [cx, cy - r * 0.9, cx + sg * r * 0.86, cy - r * 0.45, cx + sg * r * 0.86, cy + r * 0.45, cx, cy + r * 0.9]);
      }
    };
    const lt = o.lit || mix(k.ice, '#ffffff', 0.4), dk = o.dark || mix(k.ice, k.p.d, 0.18);
    parts.push({ z0: zmin, z1: zmax, side: lt, top: k.iceL, flat: true, ao: -0.2, bevel: false, shape: half(-1), at: o.at });
    parts.push({ z0: zmin, z1: zmax, side: dk, top: lt, flat: true, ao: -0.3, bevel: false, shape: half(1), at: o.at });
  }

  /* frost brazier: stone pedestal, iron bowl, pale-blue flame (anim flicker) */
  function braziers(parts, k, pts, z, s) {
    s = s || 1;
    parts.push({ z0: z, z1: z + 2.6 * s, side: k.st, top: k.stT, shape: (c, zt) => { for (const q of pts) S.rrect(c, q[0] - 1.3 * s + zt * 0.3 * s, q[1] - 1.3 * s + zt * 0.3 * s, 2.6 * s - zt * 0.6 * s, 2.6 * s - zt * 0.6 * s, 0.5); } });
    parts.push({ z0: z + 2.6 * s, z1: z + 3.8 * s, side: k.iron, top: k.ironT, shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], (1.3 + zt * 0.7) * s); } });
    parts.push({ z0: z + 3.6 * s, z1: z + 8.4 * s, side: k.gl, top: k.glH, flat: true, ao: -0.5, bevel: false, shape: (c, zt, an) => {
      pts.forEach((q, i) => { const ph = an * TAU + i * 1.7; const r = 1.5 * s * Math.pow(1 - zt, 0.75) * (1 + 0.16 * Math.sin(ph * 2 + zt * 6)) + 0.1; S.circ(c, q[0] + Math.sin(ph + zt * 3) * zt * 0.8 * s, q[1], r); });
    }, detail: (c) => { for (const q of pts) S.dot(c, '#ffffff', q[0], q[1], 0.25 * s); } });
  }

  /* irregular stone yard / rock plinth with snow drifting onto its rim */
  function plinth(parts, k, x, y, r, sy, seed, z1, ex) {
    if (ex && ex.detail) { const d = ex.detail; ex = Object.assign({}, ex, { detail: (c, an) => { c.save(); c.clip(); d(c, an); c.restore(); } }); }
    parts.push(Object.assign({ z0: 0, z1: z1 || 2.4, side: k.pl, top: k.plT, ao: 0.3, shape: (c, zt) => { c.save(); c.translate(x, y); c.scale(1, sy); S.blob(c, 0, 0, r - zt * 1.2, seed, 18, 0.12); c.restore(); },
      detail: (c) => {
        c.save(); c.clip(); c.strokeStyle = rgba(k.p.d, 0.3); c.lineWidth = 0.4; c.beginPath();
        for (let i = 0; i < 12; i++) { const a = U.hash2(i, seed, 7) * TAU, r0 = r * 0.25 + U.hash2(i, seed, 8) * r * 0.55; c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * sy); c.lineTo(x + Math.cos(a + 0.22) * (r0 + 3), y + Math.sin(a + 0.22) * (r0 + 3) * sy); }
        c.stroke();
        for (let i = 0; i < 7; i++) { const a = Math.PI * (1.05 + U.hash2(i, seed, 1) * 0.9), rr = r * (0.84 + U.hash2(i, seed, 2) * 0.1); snowPatch(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr * sy, 1.2 + U.hash2(i, seed, 3) * 1.8, seed + i, rgba(k.sn, 0.6)); }
        c.restore();
      } }, ex || {}));
  }

  /* ------------------------------------------------------------ multi-instance parts
   * One part drawing several same-material objects with their own height ranges:
   * list items q, zr(q) → [za, zb], fn(c, q, lt, anim, z) with lt the local 0..1. */
  function multi(list, zr, fn, ex) {
    const rs = list.map(zr); let z0 = Infinity, z1 = -Infinity;
    rs.forEach((r) => { z0 = Math.min(z0, r[0]); z1 = Math.max(z1, r[1]); });
    return Object.assign({ z0, z1, shape: (c, zt, an) => {
      const z = z0 + zt * (z1 - z0);
      for (let i = 0; i < list.length; i++) { const r = rs[i]; if (z >= r[0] - 1e-6 && z <= r[1] + 1e-6) fn(c, list[i], (z - r[0]) / Math.max(1e-6, r[1] - r[0]), an, z); }
    } }, ex || {});
  }
  /* several poles with fluttering pennants: [x, y, z0, z1, L, dir] */
  function flags(parts, k, list) {
    const fh = (q) => Math.min(5, (q[3] - q[2]) * 0.45);
    const wave = (c, q, zt, an) => { const x = q[0], y = q[1], L = q[4] || 7, dir = q[5] || 1, n = 7; c.moveTo(x, y); for (let i = 1; i <= n; i++) { const u = i / n, tail = zt < 0.35 ? 1 - (0.35 - zt) * 1.2 * u : 1; c.lineTo(x + dir * L * u * tail, y + Math.sin(u * 3.2 - an * TAU + x) * 0.9 * u); } };
    parts.push(multi(list, (q) => [q[2], q[3] + 1.6], (c, q, lt, an, z) => { if (z > q[3] + 0.6) S.circ(c, q[0], q[1], 0.32); else S.seg(c, q[0], q[1], q[0] + 0.01, q[1]); }, { side: k.wdD, top: k.wd, stroke: 0.7, bevel: false }));
    parts.push(multi(list, (q) => [q[3] - fh(q), q[3]], (c, q, lt, an) => wave(c, q, lt, an), { side: k.k, top: sh(k.k, 0.2), stroke: 0.55, flat: true, ao: 0.25, bevel: false }));
    parts.push(multi(list, (q) => [q[3] - fh(q) * 0.62, q[3] - fh(q) * 0.42], (c, q, lt, an) => wave(c, q, 0.6, an), { side: k.k2, top: k.k2, stroke: 0.6, flat: true, ao: 0, bevel: false }));
  }
  /* several battered round towers: [x, y, r, z0, z1] */
  const towersR = (list, k, bat, ex) => multi(list, (q) => [q[3], q[4]], (c, q, lt) => S.circ(c, q[0], q[1], q[2] - (bat === undefined ? 0.6 : bat) * lt), Object.assign({ side: k.st, top: k.stT }, ex || {}));
  /* several conical snow roofs: [x, y, r, z0, z1] (cone, front rings, lip, icicles, finial) */
  function coneRoofs(parts, k, list, o) {
    o = o || {};
    const pw = o.pw || 1.45, rr = (q, lt) => Math.max(0.12, q[2] * Math.pow(1 - lt, pw));
    const icy = o.icicles !== false;
    parts.push(multi(list, (q) => [q[3] - (icy ? 3.2 : 0.7), q[3] + 0.6], (c, q, lt, an, z) => {
      if (z >= q[3] - 0.7) { c.moveTo(q[0] + q[2] + 0.5, q[1]); c.arc(q[0], q[1], q[2] + 0.5, 0, TAU); return; }
      const dep = q[3] - 0.4 - z, n = Math.max(4, Math.round(q[2] * 0.8));
      for (let i = 0; i < n; i++) { const L = 1 + U.hash2(i, Math.round(q[2] * 7 + q[0]), 5) * 2.2; if (dep > 0 && dep < L) { const a = 0.3 + (i + 0.5) / n * (Math.PI - 0.6); S.circ(c, q[0] + Math.cos(a) * (q[2] + 0.4), q[1] + Math.sin(a) * (q[2] + 0.4), 0.06 + 0.38 * (1 - dep / L)); } }
    }, { side: mix(k.sn, k.p.a, 0.12), top: k.snL, ao: 0.2, bevel: false }));
    parts.push(multi(list, (q) => [q[3], q[4]], (c, q, lt) => S.circ(c, q[0], q[1], rr(q, lt)), { side: o.side || mix(k.sn, k.p.a, 0.18), top: k.snL, ao: 0.14, bevel: false }));
    parts.push(multi(list, (q) => [q[3] + 0.2, q[4] - 0.6], (c, q, lt, an, z) => { const r = rr(q, (z - q[3]) / (q[4] - q[3])) - 0.12; for (const a of [0.3, 0.5, 0.7, 0.9]) S.circ(c, q[0] + Math.cos(a * Math.PI) * r, q[1] + Math.sin(a * Math.PI) * r, 0.26); }, { side: mix(k.sn, k.p.a, 0.42), top: k.snS, flat: true, ao: 0, bevel: false }));
    if (o.finial) parts.push(multi(list, (q) => [q[4] - 1, q[4] + (o.finH || 3.5)], (c, q) => S.seg(c, q[0], q[1], q[0] + 0.01, q[1]), { side: k.iron, top: k.ironT, stroke: 0.6, bevel: false }));
  }
  /* several square merlon rings around round tower tops: [x, y, r, z0, z1, n] */
  const merlonsRs = (list, k) => multi(list, (q) => [q[3], q[4]], (c, q) => { const n = q[5] || 8; for (let i = 0; i < n; i++) { const a0 = (i + 0.2) / n * TAU, a1 = (i + 0.8) / n * TAU; c.moveTo(q[0] + Math.cos(a0) * q[2], q[1] + Math.sin(a0) * q[2]); c.arc(q[0], q[1], q[2], a0, a1); c.arc(q[0], q[1], q[2] - 1.5, a1, a0, true); c.closePath(); } }, { side: k.st, top: k.sn, ao: 0.15 });

  /* oblique timber beam from A to B (any orientation): the slice at height z is the
   * piece of the beam whose axis lies within its vertical half-thickness of z.
   * q = [xa, ya, za, xb, yb, zb, w (width), t (thickness)] */
  function beamRange(q) { const ce = Math.hypot(q[3] - q[0], q[4] - q[1]) / Math.max(1e-6, Math.hypot(q[3] - q[0], q[4] - q[1], q[5] - q[2])), tv = (q[7] || q[6]) / Math.max(0.2, ce) * 0.5; return [Math.min(q[2], q[5]) - tv, Math.max(q[2], q[5]) + tv]; }
  function beamShape(c, q, z) {
    const xa = q[0], ya = q[1], za = q[2], dx = q[3] - xa, dy = q[4] - ya, dz = q[5] - za, w = q[6], t = q[7] || w;
    const hl = Math.hypot(dx, dy), L = Math.hypot(dx, dy, dz), tv = t / Math.max(0.2, hl / Math.max(1e-6, L)) * 0.5;
    let s0, s1;
    if (Math.abs(dz) < 1e-4) { if (Math.abs(z - za) > tv + 1e-6) return; s0 = 0; s1 = 1; }
    else { s0 = (z - tv - za) / dz; s1 = (z + tv - za) / dz; if (s0 > s1) { const tt = s0; s0 = s1; s1 = tt; } s0 = Math.max(0, s0); s1 = Math.min(1, s1); if (s0 > s1) return; }
    const x0 = xa + dx * s0, y0 = ya + dy * s0, x1 = xa + dx * s1, y1 = ya + dy * s1;
    if (hl < 1e-3) { c.rect(x0 - w / 2, y0 - w / 2, w, w); return; }
    const px = -dy / hl * w / 2, py = dx / hl * w / 2, ex = dx / hl * 0.15, ey = dy / hl * 0.15;
    S.poly(c, [x0 + px - ex, y0 + py - ey, x1 + px + ex, y1 + py + ey, x1 - px + ex, y1 - py + ey, x0 - px - ex, y0 - py - ey]);
  }
  const beams = (list, side, top, ex) => multi(list, beamRange, (c, q, lt, an, z) => beamShape(c, q, z), Object.assign({ side, top, bevel: false }, ex || {}));
  /* timber fence along a polyline: posts + two rails (2 parts) */
  function fence(parts, k, lines, z0, h, step) {
    step = step || 3.2; h = h || 5;
    if (!Array.isArray(lines[0])) lines = [lines];
    const posts = [];
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 2; i += 2) { const L = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]), n = Math.max(1, Math.round(L / step)); for (let j = 0; j < n; j++) posts.push([pts[i] + (pts[i + 2] - pts[i]) * j / n, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * j / n]); }
      posts.push([pts[pts.length - 2], pts[pts.length - 1]]);
    }
    parts.push({ z0, z1: z0 + h, side: k.wdD, top: k.sn, ao: 0.2, bevel: false, shape: (c) => { for (const p of posts) S.circ(c, p[0], p[1], 0.55); } });
    parts.push({ z0: z0 + h * 0.38, z1: z0 + h * 0.86, side: k.wd, top: k.wdL, stroke: 0.55, bevel: false, ao: 0, shape: (c, zt) => { if (zt > 0.18 && zt < 0.82) return; for (const pts of lines) for (let i = 0; i < pts.length - 2; i += 2) S.seg(c, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]); } });
  }
  /* snow-capped haystacks [x, y, r, h] (2 parts) */
  const HAY = '#c9a35a';
  function hay(parts, k, list, z0) {
    z0 = z0 || 0;
    parts.push(multi(list, (q) => [z0, z0 + q[3]], (c, q, lt) => S.blob(c, q[0], q[1], q[2] * Math.sqrt(Math.max(0.03, 1 - lt * lt)) + 0.2, 5 + q[0], 10, 0.12), { side: sh(HAY, -0.2), top: HAY, ao: 0.35 }));
    parts.push(multi(list, (q) => [z0 + q[3] * 0.55, z0 + q[3] + 0.4], (c, q, lt) => { const t = 0.55 + lt * 0.45; S.blob(c, q[0] - 0.3, q[1] - 0.3, q[2] * Math.sqrt(Math.max(0.03, 1 - t * t)) + 0.5, 9 + q[0], 9, 0.2); }, { side: mix(k.sn, k.p.a, 0.15), top: k.snL, ao: 0.1, bevel: false }));
  }
  /* crates [x, y, s, h, rot] and barrels [x, y, r, h] */
  const crates = (list, k, z0) => multi(list, (q) => [z0 || 0, (z0 || 0) + q[3]], (c, q) => S.poly(c, tf([-q[2] / 2, -q[2] / 2, q[2] / 2, -q[2] / 2, q[2] / 2, q[2] / 2, -q[2] / 2, q[2] / 2], q[0], q[1], q[4] || 0)),
    { side: k.wd, top: k.wdL, ao: 0.25, detail: (c) => { for (const q of list) { const p = tf([-q[2] / 2, 0, q[2] / 2, 0, 0, -q[2] / 2, 0, q[2] / 2], q[0], q[1], q[4] || 0); S.lines(c, rgba(k.wdD, 0.8), 0.4, p); } } });
  const barrels = (list, k, z0) => multi(list, (q) => [z0 || 0, (z0 || 0) + q[3]], (c, q, lt) => S.circ(c, q[0], q[1], q[2] * (1 + 0.12 * Math.sin(lt * Math.PI))),
    { side: k.wd, top: k.wdL, ao: 0.3, detail: (c) => { for (const q of list) { c.save(); c.strokeStyle = k.iron; c.lineWidth = 0.35; c.beginPath(); c.arc(q[0], q[1], q[2] * 0.85, 0, TAU); c.stroke(); c.restore(); } } });

  /* ===================================================== extra helpers */
  const diag = (xa, za, xb, zb, y, w, inn, out) => [Math.min(za, zb), Math.max(za, zb), (c, z) => { const t = (z - za) / ((zb - za) || 1e-6), x = xa + (xb - xa) * t, sp = Math.abs((xb - xa) / ((zb - za) || 1e-6)) * 0.28 + w / 2; fsl(c, x - sp, x + sp, y, inn, out); }];
  /* single-pitch snow roof sloping down toward the camera (high edge at yb): slab, timber
   * fascia, scalloped snow lip and icicles at the low (front) edge */
  function roofLean(parts, k, o) {
    const { x0, x1, yb, yf, zHi, zLo } = o, seed = o.seed || 3;
    const yAt = (z) => yf - (yf - yb) * U.clamp((z - zLo) / (zHi - zLo), 0, 1);
    parts.push({ z0: zLo - 0.7, z1: zLo, side: k.wdD, top: k.wd, bevel: false, ao: 0.1, shape: (c) => c.rect(x0 + 0.3, yf - 1.1, x1 - x0 - 0.6, 1.05) });
    parts.push({ z0: zLo, z1: zHi, side: o.shade || k.snS, top: k.snL, ao: 0.12, bevel: false, shape: (c, zt) => { const ye = yAt(zLo + zt * (zHi - zLo)); if (ye > yb + 0.2) c.rect(x0, yb, x1 - x0, ye - yb); } });
    parts.push({ z0: zLo, z1: zHi, side: mix(k.snS, k.p.a, 0.2), top: k.snS, flat: true, ao: 0, bevel: false, shape: (c, zt) => { const z = zLo + zt * (zHi - zLo), q = zLo + (zHi - zLo) * 0.5; if (Math.abs(z - q) < 0.26) { const y = yAt(z); c.moveTo(x0 + 1, y - 0.2); for (let x = x0 + 1; x <= x1 - 1; x += 1) c.lineTo(x, y + 0.9 + Math.sin(x * 0.55 + seed) * 0.5); c.lineTo(x1 - 1, y - 0.7); c.lineTo(x0 + 1, y - 0.7); c.closePath(); } } });
    const bl = []; for (let x = x0 + 0.6; x <= x1 - 0.4; x += 2.1) bl.push([x + (U.hash2(Math.round(x), seed, 4) - 0.5) * 0.6, 1.05 + U.hash2(Math.round(x), seed, 6) * 0.55]);
    const xs = []; for (let x = x0 + 1.2; x <= x1 - 1.2; x += 2.2 * (0.7 + U.hash2(Math.round(x * 5), seed, 1) * 0.6)) xs.push(x);
    const IL = xs.map((x, i) => 1 + U.hash2(i, seed, 5) * 2.4);
    const lz0 = zLo - 4.1, lz1 = zLo + 0.9;
    parts.push({ z0: lz0, z1: lz1, side: mix(k.sn, k.p.a, 0.12), top: k.snL, ao: 0.1, bevel: false, shape: (c, zt) => {
      const z = lz0 + zt * (lz1 - lz0);
      if (z >= zLo - 0.8) { const lt = (z - zLo + 0.8) / 1.7; c.rect(x0, yf - 1.4, x1 - x0, 1.4); for (const q of bl) S.circ(c, q[0], yf - 0.3, q[1] * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - lt)))); }
      if (z <= zLo - 0.7) { const dep = zLo - 0.7 - z; for (let i = 0; i < xs.length; i++) if (dep < IL[i]) S.circ(c, xs[i], yf + 0.35, 0.06 + 0.4 * (1 - dep / IL[i])); }
    } });
  }
  /* rising smoke puffs from (x, y, z0) */
  function smoke(parts, k, x, y, z0, n, col) {
    col = col || mix(k.p.b, '#8d949c', 0.5);
    const puffs = []; for (let i = 0; i < n; i++) puffs.push([x + i * 1.05 + Math.sin(i * 1.7) * 0.45, y - i * 0.25, z0 + 0.9 + i * 1.75, 0.62 + i * 0.3]);
    parts.push(multi(puffs, (q) => [q[2] - q[3], q[2] + q[3]], (c, q, lt) => S.circ(c, q[0], q[1], q[3] * Math.sqrt(Math.max(0.02, 1 - (2 * lt - 1) * (2 * lt - 1))) + 0.05), { side: col, top: mix(col, '#ffffff', 0.35), flat: true, bevel: false, ao: 0 }));
  }
  /* logs lying along y, ends toward the camera: list [x, zc], half length hl, radius r */
  function logsY(parts, k, list, y, hl, r) {
    parts.push(multi(list, (q) => [q[1] - r, q[1] + r], (c, q, lt) => { const w = r * Math.sqrt(Math.max(0.02, 1 - (2 * lt - 1) * (2 * lt - 1))); c.rect(q[0] - w, y - hl, w * 2, hl * 2); }, { side: k.wdD, top: k.wdL, ao: 0.35, bevel: false }));
    parts.push(deco(k.wdL, list.map((q) => It.disc(q[0], y + hl, r * 0.9, q[1], 0, 0.45))));
    parts.push(deco(k.wdD, list.map((q) => It.disc(q[0], y + hl + 0.04, r * 0.45, q[1], 0, 0.5))));
  }
  /* fish-drying rack: two poles, a crossbar and a row of hanging fish */
  function fishRack(parts, k, x, y, L, n) {
    parts.push(beams([[x - L / 2, y, 1.2, x - L / 2, y, 7.2, 0.6], [x + L / 2, y, 1.2, x + L / 2, y, 7.2, 0.6], [x - L / 2 - 0.4, y, 6.7, x + L / 2 + 0.4, y, 6.7, 0.5]], k.wdD, k.wd));
    parts.push({ z0: 3.4, z1: 6.5, side: mix(k.p.a, k.p.b, 0.3), top: k.stL, bevel: false, ao: 0.1, shape: (c, zt) => { for (let i = 0; i < n; i++) S.ell(c, x - L / 2 + 1.1 + i * (L - 2.2) / (n - 1), y, 0.35 + 0.28 * Math.sin(zt * Math.PI), 0.5); } });
  }

  /* ============================================================ HOUSE 2
   * v0 great hall: two-storey longhouse under a hipped snow roof, carved cross-gable with
   *    antler trophies and shields, walled yard with a gate, banners
   * v1 turf hovel: half-buried turf-and-snow mound with a smoking hole, a stone entrance
   *    passage, a fish line and firewood
   * v2 smokehouse: stone house with a tall smoking chimney through its gable roof,
   *    fish-drying racks, brine barrel
   * v3 mead hall: deep hall with its gable to the camera, a longboat dragon prow rising
   *    from the apex, shield sign, stable lean-to, barrels, brazier, banners */
  M.ice_house2 = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), v = ((opt.v | 0) % 4 + 4) % 4;
    const parts = [], F = Fac(k);
    if (v === 0) {
      plinth(parts, k, 2, 1.5, 24, 0.68, 31, 1.2);
      // chimney behind the ridge (drawn before the roof so the roof hides its base)
      parts.push(box(8.5, -7.5, 11.9, -4.3, 10, 23, k.stD, k.stT, { detail: (c) => { c.fillStyle = k.win; c.fillRect(9.2, -6.8, 2.1, 2); } }));
      parts.push(box(8.2, -7.8, 12.2, -4, 23, 23.9, k.snS, k.sn, { bevel: false }));
      parts.push(bbox(-15.5, -9, 15.5, 5, 1.2, 12.5, 0.5, k.st, k.stT));
      F.mas(masonry(-15.1, 15.1, 5, 1.2, 12.5, 2.6, 4.6, 17));
      F.quoins(-14.8, 5, 1.2, 12.5).quoins(14.8, 5, 1.2, 12.5);
      for (const x of [-12.5, -8.5, 8.5, 12.5]) { F.win(x, 5, 2.2, 3.4, 6.2); F.win(x, 5, 2.2, 8.4, 11.2, 'peak'); }
      F.flush(parts);
      roofX(parts, k, { x0: -17, x1: 17, yc: -2, d: 8.8, z0: 12.5, z1: 20.5, hip: 3.6, seed: 11, rows: 2, hornH: 5 });
      // cross-gable wing with the door, shields and an antler trophy on the carved gable
      parts.push(bbox(-6.5, -3, 6.5, 12.5, 1.2, 10.5, 0.4, k.st, k.stT));
      F.mas(masonry(-6.2, 6.2, 12.5, 1.2, 10.5, 2.6, 4.2, 19));
      F.quoins(-6, 12.5, 1.2, 10.5).quoins(6, 12.5, 1.2, 10.5);
      F.door(0, 12.5, 3.8, 1.2, 7.4);
      F.win(-4.3, 12.5, 1.8, 3.6, 6.2, 'peak').win(4.3, 12.5, 1.8, 3.6, 6.2, 'peak');
      F.shields([-4.5, 4.5], 12.5, 8.7, 1.25);
      F.flush(parts);
      roofY(parts, k, { xc: 0, y0: -4, y1: 13, hw: 9, z0: 10.5, z1: 19.5, horn: 4.5, cut: (z) => (z < 12.5 ? 4.8 : Math.max(-4, -2 + 8.8 * (1 - (z - 12.5) / 8))), rows: 1 });
      const ant = mix(k.p.b, '#d8c8a8', 0.55), az = 13.2, ay = 13.05, its = [];
      for (const sg of [-1, 1]) its.push(diag(sg * 0.7, az, sg * 3.4, az + 3.4, ay, 0.5, 0.3, 0.3), diag(sg * 1.9, az + 1.5, sg * 1.3, az + 3, ay, 0.4, 0.3, 0.3), diag(sg * 2.8, az + 2.6, sg * 2.5, az + 4, ay, 0.4, 0.3, 0.3), diag(sg * 3.4, az + 3.4, sg * 4.3, az + 4.3, ay, 0.4, 0.3, 0.3));
      its.push(It.rect(0, ay, 1.4, az - 0.6, az + 0.4, 0.3, 0.3));
      parts.push(deco(ant, its, { flat: false, ao: 0.1 }));
      // walled yard on the right: low stone wall with a timber gate, woodpile and a snowy haystack
      parts.push({ z0: 1.2, z1: 4.4, side: k.st, top: k.sn, ao: 0.3, shape: (c) => { c.rect(22.2, -2, 1.6, 15.4); c.rect(7.5, 11.8, 7, 1.6); c.rect(18.6, 11.8, 5.2, 1.6); } });
      parts.push(beams([[14.5, 12.6, 1.2, 14.5, 12.6, 5.4, 1], [18.6, 12.6, 1.2, 18.6, 12.6, 5.4, 1]], k.wdD, k.wd));
      parts.push(box(15, 12.2, 18.1, 12.9, 1.2, 4.2, k.wdD, k.wd));
      F.add('woodD', It.vl(15.6, 12.9, 1.2, 4.2, 0.3, 0.4, 0.35)).add('woodD', It.vl(16.6, 12.9, 1.2, 4.2, 0.3, 0.4, 0.35)).add('woodD', It.vl(17.6, 12.9, 1.2, 4.2, 0.3, 0.4, 0.35)).add('iron', It.hl(15.2, 17.9, 12.9, 2.4, 0.45, 0.4, 0.45));
      F.mas(masonry(7.8, 14.2, 13.4, 1.2, 4.4, 1.6, 2.4, 5)).mas(masonry(18.9, 23.5, 13.4, 1.2, 4.4, 1.6, 2.4, 6));
      F.flush(parts);
      logsY(parts, k, [[11, 1.85], [12.3, 1.85], [13.6, 1.85], [11.65, 2.95], [12.95, 2.95]], 7.6, 1.6, 0.62);
      hay(parts, k, [[18.5, 7.2, 2.4, 2.8]], 1.2);
      braziers(parts, k, [[-10, 15], [10, 15]], 1.2, 0.8);
      flags(parts, k, [[-10, 9.5, 1.2, 19, 5.5, -1], [10, 9.5, 1.2, 19, 5.5, 1]]);
      return { r: 25, h: 27, parts, style: 'unit', bevel: 0.7 };
    }
    if (v === 1) {
      plinth(parts, k, 0, 2.5, 13.5, 0.72, 41, 1.2);
      const turf = mix(k.p.w, '#5a6a3a', 0.55), turfT = mix(turf, '#8a9a56', 0.4);
      // turf mound with a snow blanket, stone-ringed smoke hole
      parts.push({ z0: 1.2, z1: 6.6, side: turf, top: turfT, ao: 0.42, shape: (c, zt) => S.blob(c, 0, -0.5, 9.4 * Math.sqrt(Math.max(0.03, 1 - Math.pow(zt, 1.6))) + 0.2, 7, 12, 0.14),
        detail: (c) => { c.strokeStyle = rgba(k.p.d, 0.25); c.lineWidth = 0.35; c.beginPath(); for (let i = 0; i < 9; i++) { const a = i * 0.7; c.moveTo(Math.cos(a) * 2, -0.5 + Math.sin(a) * 1.6); c.lineTo(Math.cos(a) * 3.2, -0.5 + Math.sin(a) * 2.6); } c.stroke(); } });
      parts.push({ z0: 4.2, z1: 7.8, side: k.snS, top: k.snL, ao: 0.14, bevel: false, shape: (c, zt) => S.blob(c, -0.3, -0.9, 8 * Math.sqrt(Math.max(0.03, 1 - zt * zt)) + 0.3, 9, 11, 0.2) });
      parts.push(cyl(0.6, -1.6, 1.25, 7.4, 8.1, k.stD, k.stT, { detail: (c) => S.dot(c, k.win, 0.6, -1.6, 0.75) }));
      smoke(parts, k, 0.6, -1.6, 8.1, 4);
      // stone-lined entrance passage with a snow top and a glowing doorway
      parts.push(box(-2.6, 5.5, 2.6, 10.2, 1.2, 4.4, k.st, k.stT));
      parts.push({ z0: 4.4, z1: 5.3, side: k.snS, top: k.snL, bevel: false, ao: 0.1, shape: (c, zt) => c.rect(-2.9, 5.2, 5.8, 5.3 - zt * 1.2) });
      F.mas(masonry(-2.3, 2.3, 10.2, 1.2, 4.4, 1.6, 2.2, 5));
      F.add('frame', It.arch(0, 10.2, 3.6, 1.2, 4.3, 0.6, 0.32)).add('woodD', It.arch(0, 10.24, 2.8, 1.2, 3.9, 0.6, 0.4)).add('gl', It.rect(0, 10.28, 1.1, 1.2, 2.6, 0.6, 0.45));
      F.flush(parts);
      // fish line, firewood, a bucket
      parts.push(beams([[6.5, 6, 1.2, 6.5, 6, 6.6, 0.55], [11.5, 3.5, 1.2, 11.5, 3.5, 6.6, 0.55], [6.5, 6, 6.2, 11.5, 3.5, 6.2, 0.35]], k.wdD, k.wd));
      parts.push({ z0: 3.6, z1: 6, side: mix(k.p.a, k.p.b, 0.3), top: k.stL, bevel: false, ao: 0.1, shape: (c, zt) => { for (let i = 0; i < 3; i++) S.ell(c, 7.6 + i * 1.3, 5.45 - i * 0.65, 0.32 + 0.25 * Math.sin(zt * Math.PI), 0.45); } });
      logsY(parts, k, [[-10.6, 1.8], [-9.3, 1.8], [-8, 1.8], [-9.95, 2.9]], 5, 1.7, 0.6);
      parts.push(cyl(-7.2, 9.4, 1, 1.2, 2.8, k.wdD, k.wdL, { detail: (c) => S.dot(c, k.iceD, -7.2, 9.4, 0.7) }));
      return { r: 15, h: 17, parts, style: 'unit', bevel: 0.7 };
    }
    if (v === 2) {
      plinth(parts, k, 1, 1, 18, 0.7, 51, 1.2);
      parts.push(bbox(-8.5, -6.5, 8.5, 6.5, 1.2, 8.5, 0.4, k.st, k.stT));
      F.mas(masonry(-8.2, 8.2, 6.5, 1.2, 8.5, 2.4, 4, 23));
      F.quoins(-8, 6.5, 1.2, 8.5).quoins(8, 6.5, 1.2, 8.5);
      F.door(-3.2, 6.5, 3.4, 1.2, 6.6, 'rect');
      F.win(3.8, 6.5, 2.2, 3.4, 6);
      F.flush(parts);
      roofY(parts, k, { xc: 0, y0: -8, y1: 6.9, hw: 11, z0: 8.5, z1: 16.5, horn: 3.5, rows: 1 });
      // tall smoking stack through the right roof plane (starts at the roof surface)
      parts.push(box(2.6, -5.6, 5.9, -2.5, 12.4, 24, k.stD, k.stT, { detail: (c) => { c.fillStyle = k.win; c.fillRect(3.3, -4.9, 1.9, 1.7); } }));
      parts.push(box(2.3, -5.9, 6.2, -2.2, 24, 24.8, k.snS, k.sn, { bevel: false }));
      smoke(parts, k, 4.25, -4, 24.8, 4);
      // fish-drying racks, brine barrel and a salt crate
      fishRack(parts, k, 14, 3, 6.5, 5);
      fishRack(parts, k, -13.5, 5, 6, 5);
      parts.push(barrels([[9.5, 9.2, 1.3, 3.2]], k, 1.2));
      parts.push(crates([[-7.5, 10, 2.4, 2, 0.2]], k, 1.2));
      return { r: 19, h: 31, parts, style: 'unit', bevel: 0.7 };
    }
    // v3: mead hall
    plinth(parts, k, 1, 1, 24, 0.74, 61, 1.2);
    parts.push(bbox(-11.5, -12, 11.5, 11, 1.2, 10, 0.5, k.st, k.stT));
    F.mas(masonry(-11.1, 11.1, 11, 1.2, 10, 2.6, 4.4, 27));
    F.quoins(-10.9, 11, 1.2, 10).quoins(10.9, 11, 1.2, 10);
    F.door(-3.5, 11, 4, 1.2, 7.4, 'arch');
    F.win(5.4, 11, 2.4, 3.6, 6.6, 'peak').win(-8.6, 11, 2, 3.6, 6.4, 'peak');
    // hanging shield sign on an iron bracket beside the door
    F.add('iron', It.hl(0.6, 4.2, 11.1, 8.9, 0.45, 0.3, 0.8)).add('iron', It.vl(3.4, 11.1, 8.2, 8.9, 0.4, 0.3, 0.8));
    F.shields([3.4], 11.12, 6.6, 1.6);
    F.flush(parts);
    roofY(parts, k, { xc: 0, y0: -13, y1: 11.5, hw: 14, z0: 10, z1: 20, horn: 0, rows: 2 });
    // longboat prow rising from the apex, dragon head with frost eyes
    parts.push({ z0: 19.4, z1: 27.5, side: k.wdD, top: k.wd, bevel: false, ao: 0.1, shape: (c, zt) => { const y = 11.9 + Math.pow(zt, 1.5) * 5.4; if (zt > 0.86) S.ell(c, 0, y + 0.5, 1.3, 1); else S.circ(c, 0, y, 0.72 - zt * 0.22); },
      detail: (c) => { S.dot(c, k.gl, -0.55, 17.2, 0.26); S.dot(c, k.gl, 0.55, 17.2, 0.26); } });
    // stable lean-to on the right with a wide plank door
    parts.push(box(11.5, -4, 20, 8, 1.2, 6.5, k.st, k.stT));
    F.mas(masonry(11.8, 19.7, 8, 1.2, 6.5, 2.4, 3.8, 29));
    F.door(15.8, 8, 5, 1.2, 5.6, 'rect');
    F.add('woodD', It.vl(15.8, 8.1, 1.2, 5.6, 0.4, 0.5, 0.45));
    F.flush(parts);
    parts.push({ z0: 6.5, z1: 9.6, side: mix(k.snS, k.p.a, 0.12), top: k.snL, ao: 0.12, bevel: false, shape: (c, zt) => c.rect(11, -4.7, 9.6 * (1 - zt) + 0.3, 13.6) });
    parts.push(icicles(k, 12, 20, 8.9, 6.4, 7));
    // barrels, brazier, banners
    parts.push(barrels([[-14.5, 9, 1.3, 3.2], [-14.2, 12.2, 1.3, 3.2], [-11.5, 13.4, 1.3, 3.2]], k, 1.2));
    braziers(parts, k, [[9.5, 13.5]], 1.2, 0.9);
    flags(parts, k, [[-15.5, 10.5, 1.2, 18.5, 5.5, -1], [23, 2, 1.2, 15, 5, 1]]);
    return { r: 25, h: 29, parts, style: 'unit', bevel: 0.7 };
  };

  /* ============================================================== SHED
   * open-fronted store: snow-topped stone side and back walls, timber posts, a snow
   * lean-to roof with icicles; firewood, barrels and a crate inside */
  M.ice_shed = function (pal, opt) {
    const k = K(pal), parts = [];
    plinth(parts, k, 0, 0.5, 9.6, 0.76, 71, 1);
    parts.push({ z0: 1, z1: 7.3, side: k.st, top: k.sn, ao: 0.35, shape: (c, zt) => {
      const z = 1 + zt * 6.3, ye = z <= 6.2 ? 4.6 : 4.6 - (z - 6.2) / 1.6 * 10.2;
      c.rect(-7.4, -5.4, 14.8, 1.7);
      if (ye > -3.5) { c.rect(-7.4, -3.7, 1.6, ye + 3.7); c.rect(5.8, -3.7, 1.6, ye + 3.7); }
    } });
    parts.push({ z0: 1, z1: 1.1, side: k.pl, top: mix(k.pl, k.p.d, 0.55), flat: true, bevel: false, shape: (c) => c.rect(-5.8, -3.7, 11.6, 8.2) });
    logsY(parts, k, [[-3.9, 1.65], [-2.6, 1.65], [-1.3, 1.65], [-3.25, 2.75], [-1.95, 2.75]], 0.6, 2.4, 0.62);
    parts.push(barrels([[2.6, 1.9, 1.3, 3], [5, 1.5, 1.3, 3]], k, 1));
    parts.push(crates([[4.2, -1.8, 2.4, 2.2, 0.15]], k, 1));
    parts.push(beams([[-6.6, 4.4, 1, -6.6, 4.4, 6.6, 1], [6.6, 4.4, 1, 6.6, 4.4, 6.6, 1], [-7.2, 4.4, 6.3, 7.2, 4.4, 6.3, 0.7]], k.wdD, k.wd));
    roofLean(parts, k, { x0: -8.4, x1: 8.4, yb: -5.9, yf: 4.8, zHi: 8.3, zLo: 6.6, seed: 5 });
    return { r: 10, h: 10, parts, style: 'unit', bevel: 0.7 };
  };

  /* =========================================================== GRANARY
   * stabbur: timber storehouse on stone pillars, jettied upper storey under a horned
   * snow roof, strapped door reached by a plank stair */
  M.ice_granary = function (pal, opt) {
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 1.5, 8, 0.8, 81, 1);
    const pl = [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]];
    parts.push(towersR(pl.map((q) => [q[0], q[1], 1, 1, 4.6]), k, 0.2));
    parts.push(multi(pl, () => [4.6, 5.3], (c, q) => S.circ(c, q[0], q[1], 1.5), { side: k.stD, top: k.stT }));
    parts.push(box(-4.2, -4.2, 4.2, 4.2, 5.3, 8.6, k.wdD, k.wd));
    parts.push(box(-5.2, -5.2, 5.2, 5.2, 8.6, 12, k.wdD, k.wd));
    for (let x = -3.4; x < 4; x += 1.1) F.add('woodD', It.vl(x, 4.2, 5.3, 8.6, 0.28, 0.4, 0.2));
    for (let x = -4.4; x < 5; x += 1.1) F.add('woodD', It.vl(x, 5.2, 8.6, 12, 0.28, 0.4, 0.2));
    F.add('woodD', It.hl(-5.2, 5.2, 5.25, 8.6, 0.5, 0.4, 0.45));
    F.door(0, 5.2, 2.6, 8.6, 11.4, 'rect');
    F.add('win', It.rect(2.2, 4.2, 1.3, 6.4, 7.6, 0.6, 0.3)).add('gl', It.rect(2.2, 4.24, 0.7, 6.7, 7.3, 0.6, 0.36));
    F.flush(parts);
    roofY(parts, k, { xc: 0, y0: -6.4, y1: 6, hw: 6.8, z0: 12, z1: 17.6, horn: 3, rows: 1, gwin: false, bt: 1.2 });
    parts.push({ z0: 1, z1: 8.6, side: k.wdD, top: k.wdL, bevel: false, ao: 0.15, shape: (c, zt) => { const y = 11.6 - zt * 6.2; c.rect(-1.3, y - 0.7, 2.6, 1.3); } });
    return { r: 8, h: 22, parts, style: 'unit', bevel: 0.7 };
  };
})(window.AS = window.AS || {});

/* ================================================================== gallery */
(function (AS) {
  const G = (AS.Gallery = AS.Gallery || []);
  const town = (group, bg, fk) => G.push({ group, bg, items: [
    { name: 'manor', gen: fk + '_house2', pal: fk, opt: { v: 0 } },
    { name: 'hovel', gen: fk + '_house2', pal: fk, opt: { v: 1 } },
    { name: 'workshop', gen: fk + '_house2', pal: fk, opt: { v: 2 } },
    { name: 'tavern', gen: fk + '_house2', pal: fk, opt: { v: 3 } },
    { name: 'shed', gen: fk + '_shed', pal: fk },
    { name: 'granary', gen: fk + '_granary', pal: fk },
  ] });
  if (AS.Models.human_house2) town('Town extra: Aldermere', 'human', 'human');
  if (AS.Models.elf_house2) town('Town extra: Sylvara', 'elf', 'elf');
  if (AS.Models.ice_house2) town('Town extra: Hrimgard', 'ice', 'ice');
  if (AS.Models.undead_house2) town('Town extra: Morgrave', 'undead', 'undead');
})(window.AS = window.AS || {});
