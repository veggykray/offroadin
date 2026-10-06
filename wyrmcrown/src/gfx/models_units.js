/* WYRMCROWN — creatures and people (models_units.js).
 * Animals, villagers, soldiers, faction troops, monsters and the catapult cart,
 * all as stacked Sprite Forge models: 16 directions × 4 frame walk cycles
 * (the cart: 24 directions × 4 frames of rolling wheels). Object space: +x is
 * the facing direction, +y the right-hand side, units are world units.
 *
 * People take their clothing from the palette (a garment dark, b garment light,
 * t trim, k faction colour, k2 accent, g glow, skin); animals and monsters use
 * fixed natural colours and ignore it.
 *
 * Technique notes
 * - Limbs, necks, tails, horns and weapon shafts are swept spheres along a 3D
 *   polyline (`tube`), sliced at every forge height step, so they can point in
 *   any direction and swing with the walk phase.
 * - Flat things standing upright (shields, blades, bows, wheels with spokes)
 *   are vertical planar shapes sliced horizontally (`plane`).
 * - Wall decals (belts, tabard stripes, cow patches) are thin shells on the
 *   visible half of a body's outline (`band`), clipped to the current view.
 * - The forge draws parts in list order with no depth sort, but a figure's far
 *   arm, shield or cloak must swap in front of / behind the body as it turns.
 *   Part 0 of every model is a probe that records the frame's view angle (read
 *   from the canvas transform) and walk phase; the remaining parts are proxies
 *   that resolve per frame to the real parts sorted back-to-front by the screen
 *   depth of their group's anchor. This relies only on the forge rendering one
 *   frame at a time and visiting parts in order (it does). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models = AS.Models || {};

  /* ================================================================
   * maths, colour, palette
   * ================================================================ */
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = (c) => C.hex(c);
  const sh = (c, k) => (k ? C.shade(c, k) : C.hex(c));
  const mx = (a, b, t) => C.mix(a, b, t);
  const css = (c, a) => C.str(c, a);
  const cyc = (an, ph) => ((an || 0) + (ph || 0)) * TAU;
  const PI = Math.PI;

  // keep garments from vanishing on dark ground: lift colours darker than ~22% luminance
  const lum = (c) => { const h = C.hex(c); return (h[0] * 0.3 + h[1] * 0.59 + h[2] * 0.11) / 255; };
  const lift = (c, min) => { const l = lum(c); min = min || 0.24; return l >= min ? C.hex(c) : C.mix(c, '#b4aec0', Math.min(0.5, (min - l) * 2.2)); };
  const PDEF = { a: '#7c6c5a', b: '#bcac8c', t: '#c79e52', g: '#ffcf6a', d: '#3a2b1f', k: '#8a8070', k2: '#d8ccb0', w: '#5e4430', s: '#a89a80', skin: '#e2bc98' };
  function P(pal) {
    if (typeof pal === 'string') pal = AS.Data && AS.Data.pal && AS.Data.pal[pal];
    const o = Object.assign({}, PDEF);
    if (pal && typeof pal === 'object') for (const k in pal) if (pal[k]) o[k] = pal[k];
    return o;
  }

  // natural materials
  const BOOT = '#3a2a1e', LEATH = '#6a4a2e', STEEL = '#7d8995', STEEL_T = '#e2e8ee', MAIL = '#69737d', MAIL_T = '#aeb8c0';
  const IRON = '#45494f', IRON_T = '#8a9096', WOOD = '#6a4628', WOOD_T = '#a37249', STRAW = '#b48a3a', STRAW_T = '#f2d88c';
  const ROPE = '#a07f52', ROPE_T = '#d8bc88', BONE = '#a89e84', BONE_T = '#f2ead4', GOLD = '#a87c22', GOLD_T = '#f6d77c';
  const HAIR = { dark: '#3a2516', brown: '#6a4222', auburn: '#8a3a1a', blond: '#c99a48', grey: '#8e8a84', white: '#d8d4cc', black: '#1e1916', red: '#a2461c' };

  /* ================================================================
   * view-aware assembly
   * ================================================================ */
  const VIEW = { a: 0.8, an: 0 };
  const viewA = (c) => { if (c && c.getTransform) { const m = c.getTransform(); VIEW.a = Math.atan2(m.b, m.a); } return VIEW.a; };
  // screen depth of an object-space offset (larger = nearer the camera)
  const dep = (a, x, y) => x * Math.sin(a) + y * Math.cos(a);
  const vis = (x, y, th) => (c) => dep(viewA(c), x, y) > (th || 0);

  function probe() {
    return { z0: 0, z1: 0, side: '#000000', top: '#000000', bevel: false, flat: true,
      when: (an) => { VIEW.an = an || 0; return true; }, shape: (c) => { viewA(c); } };
  }
  function proxy(get) {
    return {
      get z0() { return get().p.z0; }, get z1() { return get().p.z1; },
      get side() { return get().side; }, get top() { return get().top; },
      get ao() { return get().p.ao; }, get flat() { return get().p.flat; },
      get bevel() { return get().p.bevel; }, get bevelW() { return get().p.bevelW; },
      get stroke() { return get().p.stroke; }, get detail() { return get().p.detail; },
      shape(c, zt, an) { get().p.shape(c, zt, an); },
    };
  }
  /* groups: [{ key(a, an) → depth (back-to-front), parts: [...], shade?: k, dk?(a, an) → depth for shading }]
   * Shaded groups darken when they sit on the far side (a soft depth cue for limbs). */
  function assemble(groups) {
    const n = groups.reduce((s, g) => s + g.parts.length, 0);
    let ca = NaN, cn = NaN, list = null;
    const resolve = (i) => {
      if (VIEW.a !== ca || VIEW.an !== cn) {
        ca = VIEW.a; cn = VIEW.an;
        const ks = groups.map((g, j) => ({ g, j, d: g.key ? g.key(ca, cn) : 0 }));
        ks.sort((A, B) => A.d - B.d || A.j - B.j);
        list = [];
        for (const k of ks) {
          const dd = k.g.dk ? k.g.dk(ca, cn) : k.d;
          const f = k.g.shade ? Math.max(-0.2, Math.min(0.05, dd * k.g.shade)) : 0;
          for (const p of k.g.parts) list.push({ p, side: f && !p.flat ? sh(p.side, f) : p.side, top: f && !p.flat ? sh(p.top, f) : p.top });
        }
      }
      return list[i];
    };
    const parts = [probe()];
    for (let i = 0; i < n; i++) parts.push(proxy(() => resolve(i)));
    return parts;
  }

  /* ================================================================
   * geometry primitives
   * ================================================================ */
  /* texels per world unit of the frame being drawn (forge res × model scale), read from the
   * canvas transform. Thin tubes and plates are kept at least ~1 texel thick so they stay solid
   * (and outlined) at every quality level and model scale. */
  let PX = 2;
  const px = (c) => { if (c && c.getTransform) { const m = c.getTransform(); PX = Math.max(0.5, Math.hypot(m.a, m.b)); } };
  // horizontal cross-section (height z) of a sphere at (x, y, zz) radius r
  function ball(c, z, x, y, zz, r) {
    r = Math.max(r, 0.55 / PX);
    const rz = Math.max(r, 0.6 / PX, 0.3), d = (z - zz) / rz;
    if (d <= -1 || d >= 1) return;
    S.circ(c, x, y, r * Math.max(0.5, Math.sqrt(1 - d * d)));
  }
  // cross-section at height z of spheres swept along a polyline [[x, y, z, r], ...]
  function sweep(c, z, pts) {
    const last = pts.length - 1;
    for (let i = 0; i <= last; i++) {
      const A = pts[i], B = i < last ? pts[i + 1] : null;
      if (!B) { ball(c, z, A[0], A[1], A[2], A[3]); break; }
      const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
      const n = Math.max(1, Math.ceil(len / (Math.max(0.12, Math.min(A[3], B[3])) * 0.5)));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        ball(c, z, lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t));
      }
    }
  }
  function zBounds(fn) {
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 8; i++) for (const pl of fn(i / 8)) for (const p of pl) { const r = Math.max(p[3], 0.3); lo = Math.min(lo, p[2] - r); hi = Math.max(hi, p[2] + r); }
    return [Math.max(0, lo), hi];
  }
  /* tube part: fn(an) → [polyline, ...]; o: { ao, flat, show(c, an), zr, detail, bevel } */
  function tube(side, top, fn, o) {
    o = o || {};
    const b = o.zr || zBounds(fn);
    return { z0: b[0], z1: b[1], side: hex(side), top: hex(top || side), bevel: o.bevel || false, ao: o.ao !== undefined ? o.ao : 0.18, flat: o.flat,
      detail: o.detail ? (c, an) => { if (!o.show || o.show(c, an)) o.detail(c, an); } : undefined,
      shape: (c, zt, an) => { if (o.show && !o.show(c, an)) return; px(c); const z = lerp(b[0], b[1], zt); for (const pl of fn(an)) sweep(c, z, pl); } };
  }
  /* generic part: fn(c, z, an) appends geometry for absolute height z */
  function gp(side, top, z0, z1, fn, o) {
    o = o || {};
    return { z0, z1, side: hex(side), top: hex(top || side), ao: o.ao !== undefined ? o.ao : 0.15, bevel: o.bevel || false, flat: o.flat, stroke: o.stroke,
      detail: o.detail ? (c, an) => { if (!o.show || o.show(c, an)) o.detail(c, an); } : undefined,
      shape: (c, zt, an) => { if (o.show && !o.show(c, an)) return; px(c); fn(c, lerp(z0, z1, zt), an); } };
  }
  // quad of a vertical plate: in-plane axis (ux, uy), thickness w, from u0 to u1
  function quadU(c, ox, oy, ux, uy, w, u0, u1) {
    w = Math.max(w, 1.05 / PX);
    const nx = -uy * w * 0.5, ny = ux * w * 0.5;
    c.moveTo(ox + ux * u0 + nx, oy + uy * u0 + ny); c.lineTo(ox + ux * u1 + nx, oy + uy * u1 + ny);
    c.lineTo(ox + ux * u1 - nx, oy + uy * u1 - ny); c.lineTo(ox + ux * u0 - nx, oy + uy * u0 - ny); c.closePath();
  }
  /* vertical planar shape through (ox, oy), in-plane axis at angle th, thickness w (≥ 0.5 so
   * stacked slices tile). inside(u, z) is sampled along u; each covered run becomes a quad. */
  function plane(c, z, ox, oy, th, w, u0, u1, inside, du) {
    du = du || 0.1;
    const ux = Math.cos(th), uy = Math.sin(th);
    const n = Math.max(1, Math.ceil((u1 - u0) / du)), d = (u1 - u0) / n;
    let s = -1;
    for (let i = 0; i <= n + 1; i++) {
      const inn = i <= n && inside(u0 + i * d, z);
      if (inn && s < 0) s = i;
      else if (!inn && s >= 0) { quadU(c, ox, oy, ux, uy, w, u0 + (s - 0.5) * d, u0 + (i - 0.5) * d); s = -1; }
    }
  }
  // circular cap with the front cut away at x = cx + xc (hair, hoods)
  function capCut(c, cx, cy, r, xc) {
    if (xc >= r) { S.circ(c, cx, cy, r); return; }
    if (xc <= -r) return;
    const t = Math.acos(xc / r);
    c.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    c.arc(cx, cy, r, t, TAU - t);
    c.closePath();
  }

  /* shell around a head: outer circle (co, ro) with the front cut at absolute x = xc, minus the
   * head circle (ci, ri). Drawing a shell instead of a filled cap keeps the lower slices of a hood
   * from painting over the face that the higher head slices project onto. */
  function shellCut(c, co, ro, xc, ci, ri) {
    const cy = 0;
    if (xc >= co + ro) { S.circ(c, co, cy, ro); c.moveTo(ci + ri, cy); c.arc(ci, cy, ri, 0, TAU, true); c.closePath(); return; }
    if (xc <= co - ro) return;
    const to = Math.acos(Math.max(-1, Math.min(1, (xc - co) / ro)));
    if (xc >= ci + ri) { // opening is in front of the head: closed outer cap with a head-shaped hole
      c.moveTo(co + Math.cos(to) * ro, cy + Math.sin(to) * ro); c.arc(co, cy, ro, to, TAU - to); c.closePath();
      c.moveTo(ci + ri, cy); c.arc(ci, cy, ri, 0, TAU, true); c.closePath(); return;
    }
    const ti = xc <= ci - ri ? PI : Math.acos(Math.max(-1, Math.min(1, (xc - ci) / ri)));
    c.moveTo(co + Math.cos(to) * ro, cy + Math.sin(to) * ro); c.arc(co, cy, ro, to, TAU - to);
    c.lineTo(ci + Math.cos(TAU - ti) * ri, cy + Math.sin(TAU - ti) * ri); c.arc(ci, cy, ri, TAU - ti, ti, true); c.closePath();
  }

  /* profile stacks: [[z, rx, ry, dx], ...] interpolated linearly in z */
  function profAt(pr, z) {
    if (z <= pr[0][0]) return pr[0];
    for (let i = 1; i < pr.length; i++) if (z <= pr[i][0]) {
      const A = pr[i - 1], B = pr[i], t = (z - A[0]) / Math.max(1e-6, B[0] - A[0]);
      return [z, lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3] || 0, B[3] || 0, t)];
    }
    return pr[pr.length - 1];
  }
  function stack(side, top, pr, o) {
    o = o || {};
    const z0 = pr[0][0], z1 = pr[pr.length - 1][0];
    return { z0, z1, side: hex(side), top: hex(top || side), ao: o.ao !== undefined ? o.ao : 0.35, bevel: o.bevel, flat: o.flat, detail: o.detail,
      shape: (c, zt, an) => {
        const q = profAt(pr, lerp(z0, z1, zt));
        const x = (q[3] || 0) + (o.cx || 0) + (o.sway ? o.sway(an, zt) : 0);
        if (o.jag) { // ragged hem: star-ish outline near the bottom
          const j = o.jag * Math.max(0, 1 - zt * 3), N = 14;
          for (let i = 0; i <= N * 2; i++) { const t = i / (N * 2) * TAU, k = i % 2 ? 1 - j : 1 + j * 0.3; const px = x + Math.cos(t) * q[1] * k, py = (o.cy || 0) + Math.sin(t) * q[2] * k; i ? c.lineTo(px, py) : c.moveTo(px, py); }
          c.closePath();
        } else S.ell(c, x, o.cy || 0, Math.max(0.05, q[1]), Math.max(0.05, q[2]));
      } };
  }
  const ringProf = (pr, cy) => (z, t, k) => { const q = profAt(pr, z); return [(q[3] || 0) + Math.cos(t) * q[1] * k, (cy || 0) + Math.sin(t) * q[2] * k]; };

  // clip the angular range [t0, t1] to the half of an outline facing the camera
  function visClip(t0, t1, a) {
    const v0 = -a + 0.1, v1 = PI - a - 0.1, out = [];
    for (let k = -2; k <= 2; k++) { const lo = Math.max(t0 + k * TAU, v0), hi = Math.min(t1 + k * TAU, v1); if (hi > lo) out.push([lo, hi]); }
    return out;
  }
  /* wall decal: a thin shell on ring(z, t, k) between scale kIn and kOut for t in [t0, t1] (t = 0 is +x,
   * t = π/2 is +y), heights za..zb, drawn only on the visible half. */
  function band(col, top, ring, t0, t1, za, zb, o) {
    o = o || {};
    const kO = o.out || 1.06, kI = o.inK || 0.84;
    return { z0: za, z1: zb, side: hex(col), top: hex(top || col), bevel: false, ao: o.ao !== undefined ? o.ao : 0.08, flat: o.flat,
      shape: (c, zt) => {
        const a = viewA(c), z = lerp(za, zb, zt);
        const T0 = typeof t0 === 'function' ? t0(z) : t0, T1 = typeof t1 === 'function' ? t1(z) : t1;
        if (T1 - T0 < 0.02) return;
        for (const iv of visClip(T0, T1, a)) {
          const n = Math.max(2, Math.ceil((iv[1] - iv[0]) / 0.18));
          for (let i = 0; i <= n; i++) { const q = ring(z, lerp(iv[0], iv[1], i / n), kO); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
          for (let i = n; i >= 0; i--) { const q = ring(z, lerp(iv[0], iv[1], i / n), kI); c.lineTo(q[0], q[1]); }
          c.closePath();
        }
      } };
  }
  // oval patch on a wall: angular half-width rt at its widest (height zc), vertical half-height rz
  function patch(col, top, ring, tc, rt, zc, rz, o) {
    const f = (z) => Math.sqrt(Math.max(0, 1 - Math.pow((z - zc) / rz, 2)));
    return band(col, top, ring, (z) => tc - rt * f(z), (z) => tc + rt * f(z), zc - rz, zc + rz, o);
  }
  // radial glow inside a detail
  function glow(c, col, x, y, r, core, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, core || '#ffffff'); g.addColorStop(0.4, css(col, a || 0.9)); g.addColorStop(1, css(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  // clip the detail to the current (top-slice) path, then draw
  const clipped = (fn) => (c, an) => { c.save(); c.clip(); fn(c, an); c.restore(); };
  const blobs = (c, col, list) => { c.save(); c.fillStyle = col; for (const q of list) { c.beginPath(); S.blob(c, q[0], q[1], q[2], q[3] || 3, 8, 0.3); c.fill(); } c.restore(); };

  /* ================================================================
   * PEOPLE — rig and builder
   * ================================================================ */
  const HB = { hip: 4.15, legY: 0.7, legR: 0.6, kneeR: 0.52, ankleR: 0.45, bootH: 1.35, kneeF: 0.2, stride: 1.2, lift: 0.8,
    shX: 0, shY: 1.88, shZ: 7.2, upper: 1.5, fore: 1.45, armR: 0.47, handR: 0.48, swing: 0.95,
    tRx: 1.05, tRy: 1.55, top: 7.7, headX: 0.04, headZ: 9.12, headR: 1.15, neckR: 0.5 };

  function rig(D, pose) {
    const R = { D };
    R.foot = (s, an) => { const f = cyc(an, s > 0 ? 0 : 0.5); return [Math.cos(f) * D.stride, s * D.legY, Math.max(0, -Math.sin(f)) * D.lift]; };
    R.shoulder = (s) => [D.shX, s * D.shY, D.shZ];
    R.swing = (s, an) => Math.cos(cyc(an, s > 0 ? 0.5 : 0));
    R.arm = (s, an) => {
      const ps = pose[s > 0 ? 'R' : 'L'];
      if (ps) return ps(an, R, s);
      const S0 = R.shoulder(s), sw = R.swing(s, an) * D.swing;
      return { e: [S0[0] + sw * 0.42 - 0.12, s * (D.shY + 0.1), S0[2] - D.upper], h: [S0[0] + sw, s * (D.shY + 0.04), S0[2] - D.upper - D.fore + Math.abs(sw) * 0.22] };
    };
    return R;
  }
  function legLines(R, s, an) {
    const D = R.D, f = R.foot(s, an), x = f[0], y = f[1], up = f[2];
    const kx = x * 0.5 + D.kneeF + up * 0.9, kz = D.hip * 0.5 + up * 0.5;
    return {
      leg: [[x - 0.05, y, 0.95 + up, D.ankleR], [kx, y * 0.98, kz, D.kneeR], [0, y * 0.92, D.hip, D.legR], [0, y * 0.8, D.hip + 0.6, D.legR]],
      boot: [[x + 0.58, y, 0.3 + up * 0.85, D.ankleR * 0.8], [x - 0.12, y, 0.42 + up, D.ankleR * 1.05], [x - 0.04, y, D.bootH + up, D.ankleR + 0.05]],
    };
  }
  function armLines(R, s, an) {
    const D = R.D, A = R.arm(s, an), S0 = R.shoulder(s);
    const w = [lerp(A.e[0], A.h[0], 0.78), lerp(A.e[1], A.h[1], 0.78), lerp(A.e[2], A.h[2], 0.78)];
    return [[[S0[0], S0[1] * 0.9, S0[2] + 0.15, D.armR + 0.1], [A.e[0], A.e[1], A.e[2], D.armR], [w[0], w[1], w[2], D.armR * 0.88]]];
  }
  function torsoProf(kind, D) {
    if (Array.isArray(kind)) return kind;
    const X = D.tRx, Y = D.tRy, T = D.top;
    const up = [[T - 1.25, X, Y * 1.05], [T - 0.35, X * 0.95, Y * 1.02], [T, X * 0.6, Y * 0.66]];
    const base = {
      tunic: [[3.25, X * 1.2, Y * 1.14], [3.9, X * 1.08, Y * 1.0], [4.4, X * 0.98, Y * 0.94], [5.4, X, Y * 0.98]],
      short: [[3.85, X * 1.06, Y * 1.0], [4.4, X * 0.98, Y * 0.94], [5.4, X, Y * 0.98]],
      robe: [[0.15, X * 1.62, Y * 1.36], [1.4, X * 1.42, Y * 1.22], [3.4, X * 1.16, Y * 1.04], [4.5, X, Y * 0.95], [5.4, X, Y * 0.98]],
      dress: [[0.3, X * 1.55, Y * 1.4], [2.0, X * 1.32, Y * 1.2], [4.0, X * 0.98, Y * 0.92], [4.6, X * 0.94, Y * 0.9], [5.6, X * 1.04, Y]],
      coat: [[1.9, X * 1.34, Y * 1.2], [3.4, X * 1.15, Y * 1.06], [4.4, X * 0.99, Y * 0.95], [5.4, X, Y * 0.98]],
      armor: [[3.45, X * 1.18, Y * 1.12], [4.2, X * 0.98, Y * 0.95], [5.3, X * 1.1, Y * 1.0], [6.2, X * 1.16, Y * 1.04]],
    }[kind] || null;
    return (base || [[3.25, X * 1.2, Y * 1.14], [3.9, X * 1.08, Y * 1.0], [4.4, X * 0.98, Y * 0.94], [5.4, X, Y * 0.98]]).concat(up);
  }

  /* person(p, cfg) → model. cfg:
   *  dims (overrides HB), pose {R, L}(an, rig, side) → {e, h}, legs, boots, torso (kind | profile),
   *  torsoSide, torsoTop, torsoDetail, torsoAo, jag (ragged hem), bands [{col, t0, t1, z0, z1, out, inK}],
   *  coreMid(D, prof) → parts after the torso, sleeve, hands, skin, pauldron(rig, side) → part,
   *  heldR/heldL [{under, over}] (gear glued to a hand), items [sorted groups: cloaks, shields, quivers],
   *  head: { hair, style, beard, beardLen, fringe, nose, mask, eyes, eyeR, eyeFlat, eyeGlow, hat(D) → parts },
   *  noHead, r, h, scale */
  function person(p, c) {
    const D = Object.assign({}, HB, c.dims || {});
    const R = rig(D, c.pose || {});
    const skin = hex(c.skin || p.skin);
    const G = [];
    // legs: under the torso, far leg drawn first and slightly darker
    const legC = lift(c.legs || p.a), bootC = hex(c.boots || BOOT);
    for (const s of [1, -1]) {
      const d = (a, an) => dep(a, R.foot(s, an)[0] * 0.4, s * D.legY);
      G.push({ key: (a, an) => -0.5 + 0.01 * d(a, an), dk: d, shade: 0.09,
        parts: [tube(legC, sh(legC, 0.12), (an) => [legLines(R, s, an).leg], { ao: 0.3 }), tube(bootC, sh(bootC, 0.16), (an) => [legLines(R, s, an).boot], { ao: 0.1 })] });
    }
    // arms (+ held gear)
    for (const s of [1, -1]) {
      const held = (s > 0 ? c.heldR : c.heldL) || [];
      const sl = hex(c.sleeve || c.torsoSide || p.b), hd = hex(c.hands || skin);
      const parts = [tube(sl, sh(sl, 0.14), (an) => armLines(R, s, an), { ao: 0.14 })];
      if (c.pauldron) parts.push(c.pauldron(R, s));
      for (const h of held) if (h.under) parts.push(...h.under);
      parts.push(tube(hd, sh(hd, 0.12), (an) => [[R.arm(s, an).h.concat([D.handR])]], { ao: 0 }));
      for (const h of held) if (h.over) parts.push(...h.over);
      const d = (a, an) => { const h = R.arm(s, an).h; return dep(a, (h[0] + D.shX) * 0.5, h[1]); };
      G.push({ key: d, shade: 0.07, parts });
    }
    // core: torso, decals, neck, head, hair, hat
    const prof = torsoProf(c.torso || 'tunic', D);
    const tS = hex(c.torsoSide || p.b), tT = hex(c.torsoTop || sh(tS, 0.16));
    const core = [stack(tS, tT, prof, { ao: c.torsoAo !== undefined ? c.torsoAo : 0.32, detail: c.torsoDetail, jag: c.jag })];
    const ring = ringProf(prof);
    for (const b of c.bands || []) core.push(band(b.col, b.top, ring, b.t0, b.t1, b.z0, b.z1, b));
    if (c.coreMid) core.push(...c.coreMid(D, prof));
    const hd = c.head || {};
    if (!c.noHead) core.push(tube(sh(skin, -0.12), skin, () => [[[D.headX * 0.5 + (prof[prof.length - 1][3] || 0) * 0.5, 0, D.top - 0.4, D.neckR], [D.headX, 0, D.headZ - 0.5, D.neckR]]], { ao: 0.2 }));
    if (!c.noHead) core.push(...headParts(D, skin, hd));
    G.push({ key: () => 0, parts: core });
    for (const it of c.items || []) G.push(it);
    return { r: c.r || 3.5, h: c.h || 10.7, parts: assemble(G), style: 'unit', scale: c.scale || 1 };
  }

  function headParts(D, skin, h) {
    const parts = [];
    const hz = D.headZ, HR = D.headR, hx = D.headX;
    const headSide = h.headSide || sh(skin, -0.08), headTop = h.headTop || skin;
    parts.push({ z0: hz - HR * 0.92, z1: hz + HR, side: hex(headSide), top: hex(headTop), ao: 0.16,
      shape: (c, zt) => { const z = lerp(hz - HR * 0.92, hz + HR, zt), d = (z - hz) / HR, k = Math.sqrt(Math.max(0.16, 1 - d * d)); S.ell(c, hx, 0, HR * 1.04 * k, HR * 0.96 * k); } });
    if (h.mask) { const mz = h.maskZ || [-0.75, -0.05]; parts.push(band(h.mask, null, (z, t, k) => { const d = (z - hz) / HR, kk = Math.sqrt(Math.max(0.16, 1 - d * d)); return [hx + Math.cos(t) * HR * 1.04 * kk * k, Math.sin(t) * HR * 0.96 * kk * k]; }, h.maskZ ? -0.8 : -1.5, h.maskZ ? 0.8 : 1.5, hz + HR * mz[0], hz + HR * mz[1], { out: 1.06, inK: 0.85 })); }
    if (h.nose) parts.push(tube(sh(skin, -0.08), skin, () => [[[hx + HR * 0.8, 0, hz - 0.05, h.nose * 0.8], [hx + HR + h.nose * 1.6, 0, hz - 0.45, h.nose]]], { show: vis(1, 0, -0.5) }));
    if (h.eyes) {
      const ec = hex(h.eyes), er = h.eyeR || 0.2;
      for (const s of [1, -1]) parts.push(gp(ec, sh(ec, 0.3), hz + 0.08 - er - 0.05, hz + 0.08 + er, (c, z) => ball(c, z, hx + HR * 0.9, s * HR * 0.4, hz + 0.08, er), { flat: h.eyeFlat, ao: 0, show: vis(1, s * 0.6, 0.05),
        detail: h.eyeGlow ? (c) => glow(c, ec, hx + HR * 0.9, s * HR * 0.4, er * 1.8, '#ffffff', 0.6) : undefined }));
    }
    if (h.beard) {
      const bc = hex(h.beard), bl = h.beardLen || 1.0;
      parts.push(tube(sh(bc, -0.05), sh(bc, 0.15), () => [[[hx + HR * 0.55, 0, hz - 0.25, HR * 0.62], [hx + HR * 0.72, 0, hz - 0.55 - bl * 0.5, HR * 0.55], [hx + HR * 0.6, 0, hz - 0.6 - bl, HR * 0.3]]], { show: vis(1, 0, -0.42) }));
    }
    const style = h.style || 'short';
    if (h.hair && style !== 'bald' && style !== 'none') {
      const hc = hex(h.hair);
      parts.push(hairCap(hc, D, { low: style === 'long' ? 0.55 : 0.32, fr: h.fringe || 0 }));
      if (style === 'bun') parts.push(tube(sh(hc, -0.05), sh(hc, 0.2), () => [[[hx - HR * 0.75, 0, hz + HR * 0.55, HR * 0.5]]]));
    }
    if (h.hat) parts.push(...h.hat(D));
    return parts;
  }
  function hairCap(col, D, o) {
    o = o || {};
    const hz = D.headZ, HR = D.headR, hx = D.headX, k = o.k || 1.08;
    const za = hz - HR * (o.low || 0.32), zb = hz + HR * k;
    return gp(col, sh(col, 0.2), za, zb, (c, z) => {
      const d = (z - hz) / (HR * k), r = HR * k * Math.sqrt(Math.max(0.08, 1 - d * d));
      const u = (z - za) / (zb - za);
      capCut(c, hx - 0.06, 0, r, lerp(-0.45 * HR, 1.3 * HR, Math.pow(u, 1.5)) + (o.fr || 0));
    }, { ao: 0.12, bevel: true });
  }
  // long hair hanging down the back (a group, so it sorts against the torso)
  function hairBack(col, D, len) {
    const hc = hex(col), hx = D.headX;
    return { key: (a) => dep(a, hx - 1.0, 0), parts: [tube(sh(hc, -0.05), sh(hc, 0.18), () => [[[hx - 0.75, 0.35, D.headZ, 0.62], [hx - 0.95, 0.4, D.headZ - len, 0.5]], [[hx - 0.75, -0.35, D.headZ, 0.62], [hx - 0.95, -0.4, D.headZ - len, 0.5]]])] };
  }

  /* ---------------- hats and helmets (core parts) ---------------- */
  const crownProf = (z0, h, r0, r1, rTop, dx) => [[z0, r0, r0 * 0.96, dx || 0], [z0 + h * 0.6, r1, r1 * 0.96, dx || 0], [z0 + h, rTop, rTop * 0.96, dx || 0]];
  function hatStraw(col, wide) {
    return (D) => {
      const z = D.headZ + D.headR * 0.42, hx = D.headX - 0.05, W = wide || 2.35;
      const pr = crownProf(z + 0.25, 1.25, 1.18, 1.08, 0.7, hx);
      return [
        gp(STRAW, STRAW_T, z, z + 0.4, (c) => S.ell(c, hx, 0, W, W * 0.96), { ao: 0.1, bevel: true,
          detail: (c) => { c.save(); c.strokeStyle = 'rgba(120,80,20,0.35)'; c.lineWidth = 0.14; for (const r of [1.5, 1.95]) { c.beginPath(); c.ellipse(hx, 0, r, r * 0.96, 0, 0, TAU); c.stroke(); } c.restore(); } }),
        stack(STRAW, STRAW_T, pr, { ao: 0.2, bevel: true }),
        band(col, null, ringProf(pr), -PI, PI, z + 0.32, z + 0.68, { out: 1.07, inK: 0.85 }),
      ];
    };
  }
  function hatHelm(o) {
    o = o || {};
    return (D) => {
      const hz = D.headZ, HR = D.headR, hx = D.headX;
      const side = hex(o.side || STEEL), top = hex(o.top || STEEL_T);
      const z0 = hz - HR * (o.low || 0.05), z1 = hz + HR + 0.22;
      const parts = [];
      if (o.brim) parts.push(gp(side, top, z0 + 0.1, z0 + 0.45, (c) => S.ell(c, hx, 0, HR * 1.62, HR * 1.56), { ao: 0.1, bevel: true }));
      parts.push(gp(side, top, z0, z1, (c, z) => { const d = Math.max(0, (z - hz) / (z1 - hz)), k = Math.sqrt(Math.max(0.1, 1 - d * d * (o.flatTop ? 0.55 : 0.92))); S.ell(c, hx - 0.03, 0, HR * (o.k || 1.13) * k, HR * ((o.k || 1.13) - 0.05) * k); },
        { ao: 0.25, bevel: true, detail: (c) => { S.dot(c, 'rgba(255,255,255,0.55)', hx - 0.3, -0.35, 0.28); } }));
      if (o.ridge) parts.push(tube(sh(side, -0.1), top, () => [[[hx + HR * 0.9, 0, hz + 0.3, 0.2], [hx, 0, z1 + 0.05, 0.22], [hx - HR * 0.95, 0, hz + 0.3, 0.2]]]));
      if (o.nasal) parts.push(gp(side, top, hz - 0.75, hz + 0.3, (c, z) => S.ell(c, hx + HR * 1.12, 0, 0.18, 0.2), { show: vis(1, 0, -0.3) }));
      if (o.visor) parts.push(band('#15171a', null, (z, t, k) => [hx - 0.03 + Math.cos(t) * HR * 1.13 * k, Math.sin(t) * HR * 1.08 * k], -0.95, 0.95, hz - 0.05, hz + 0.3, { out: 1.02, inK: 0.8 }));
      return parts;
    };
  }
  function hatHood(col, o) {
    o = o || {};
    return (D) => {
      const hz = D.headZ, HR = D.headR, hx = D.headX, hc = hex(col);
      const za = hz - HR * 0.98, zb = hz + HR * 1.12;
      const pts = [[za, 1.4], [hz - HR * 0.55, 1.22], [hz, 1.2], [hz + HR * 0.6, 1.07], [zb, 0.42]];
      const rAt = (z) => { for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) { const t = (z - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return lerp(pts[i - 1][1], pts[i][1], t) * HR; } return pts[pts.length - 1][1] * HR; };
      return [
        gp(sh(hc, -0.05), sh(hc, 0.18), za, zb, (c, z) => {
          const r = rAt(z), d = (z - hz) / HR, ri = HR * 0.98 * Math.sqrt(Math.max(0, 1 - d * d));
          const xc = z > hz + HR * 0.5 ? 99 : z < hz - HR * 0.72 ? hx - 0.2 * HR : hx + HR * 0.72;
          if (ri < 0.2 || z > hz + HR * 0.75) capCut(c, hx - 0.25, 0, r, xc - hx + 0.25); else shellCut(c, hx - 0.25, r, xc, hx, ri);
        }, { ao: 0.3, bevel: true }),
        tube(sh(hc, -0.05), sh(hc, 0.15), () => [[[hx - 0.9, 0, hz + 0.7, 0.42], [hx - 1.55, 0, hz + 0.15, 0.3], [hx - 1.85, 0, hz - 0.55, 0.18]]]),
      ];
    };
  }
  function hatWizard(col, bandCol) {
    return (D) => {
      const hz = D.headZ, HR = D.headR, hx = D.headX, hc = hex(col);
      const z = hz + HR * 0.4, H = 5.2;
      const pr = [];
      for (let i = 0; i <= 7; i++) { const u = i / 7, r = lerp(1.32, 0.12, Math.pow(u, 0.8)); pr.push([z + 0.3 + u * H, r, r * 0.96, hx - 0.05 - 1.7 * u * u * u]); }
      return [
        gp(sh(hc, -0.1), sh(hc, 0.14), z, z + 0.45, (c) => S.ell(c, hx - 0.05, 0, 2.3, 2.22), { ao: 0.1, bevel: true }),
        stack(sh(hc, -0.06), sh(hc, 0.18), pr, { ao: 0.28, bevel: true }),
        band(bandCol, null, ringProf(pr), -PI, PI, z + 0.45, z + 1.0, { out: 1.08, inK: 0.85 }),
      ];
    };
  }
  function hatKerchief(col) {
    return (D) => [hairCap(hex(col), D, { low: 0.42, fr: -0.12, k: 1.11 }), tube(sh(col, -0.05), sh(col, 0.15), () => [[[D.headX - D.headR * 1.0, 0, D.headZ - 0.1, 0.34], [D.headX - D.headR * 1.35, 0.15, D.headZ - 0.65, 0.26]]])];
  }
  function hatCap(col) {
    return (D) => {
      const hz = D.headZ, HR = D.headR, hx = D.headX, cc = hex(col);
      return [gp(sh(cc, -0.08), sh(cc, 0.16), hz + HR * 0.15, hz + HR * 1.18, (c, z) => { const d = (z - (hz + HR * 0.15)) / (HR * 1.03), k = Math.sqrt(Math.max(0.1, 1 - d * d * 0.9)); S.ell(c, hx - 0.15, 0, HR * 1.12 * k, HR * 1.08 * k); }, { ao: 0.2, bevel: true }),
        tube(sh(cc, -0.08), sh(cc, 0.12), () => [[[hx - HR * 0.6, 0, hz + HR * 0.95, 0.45], [hx - HR * 1.3, 0, hz + HR * 0.6, 0.35]]])];
    };
  }

  /* ---------------- gear ---------------- */
  const handAt = (R, s) => (an) => R.arm(s, an).h;
  // spear: shaft through the hand, leaf-shaped steel tip; optional pennant in k
  function gSpear(R, s, o) {
    o = o || {};
    const H = handAt(R, s), top = o.top || 14.2, bot = o.bot !== undefined ? o.bot : 0.8, tipH = o.tipH || 2.3, wood = hex(o.wood || WOOD);
    const parts = [
      tube(wood, sh(wood, 0.25), (an) => { const h = H(an); return [[[h[0] + 0.04, h[1], bot, o.r || 0.31], [h[0] + 0.04, h[1], top, o.r || 0.31]]]; }, { ao: 0.08 }),
      gp(STEEL, STEEL_T, top - 0.2, top + tipH, (c, z, an) => { const h = H(an), u = (z - top) / tipH; const r = u < 0 ? 0.34 : u < 0.3 ? 0.34 + u / 0.3 * 0.2 : 0.54 * (1 - (u - 0.3) / 0.7) + 0.05; S.ell(c, h[0] + 0.04, h[1], r * 0.7, r); }, { ao: 0.05 }),
    ];
    if (o.pennant) {
      const pc = hex(o.pennant), pz = top - 0.3;
      parts.push(gp(sh(pc, -0.1), sh(pc, 0.15), pz - 1.7, pz, (c, z, an) => {
        const h = H(an), fl = Math.sin(cyc(an)) * 0.22;
        plane(c, z, h[0] + 0.04, h[1], PI + fl, 0.5, 0.1, 2.6, (u, zz) => { const v = (zz - (pz - 1.7)) / 1.7; const half = 0.5 * (1 - u / 2.6); return Math.abs(v - 0.5 - u * 0.05) < half; }, 0.12);
      }, { ao: 0.05 }));
    }
    return { under: parts };
  }
  // round shield on the forearm; a group of its own so it sorts against arm and body
  function gShield(R, s, o) {
    o = o || {};
    const Rr = o.r || 1.85, ang = o.ang !== undefined ? o.ang : 0.62, zc = o.zc || 5.85;
    const H = handAt(R, s);
    const ctr = (an) => { const h = H(an); return [h[0] + 0.15, h[1] + s * 0.45]; };
    const th = s < 0 ? ang : -ang, nx = Math.sin(ang), ny = s < 0 ? -Math.cos(ang) : Math.cos(ang);
    const ux = Math.cos(th), uy = Math.sin(th);
    const faceOn = (c) => dep(viewA(c), nx, ny) > 0;
    const disc = (c, z, an, rad, off) => { const q = ctr(an), dz = z - zc; if (Math.abs(dz) >= rad) return; const hl = Math.sqrt(rad * rad - dz * dz); quadU(c, q[0] + nx * off, q[1] + ny * off, ux, uy, 0.55, -hl, hl); };
    const rim = hex(o.rim || p2(o, 'k2')), face = hex(o.face || '#884422'), back = hex(o.back || WOOD), boss = hex(o.boss || STEEL);
    const parts = [
      gp(rim, sh(rim, 0.2), zc - Rr, zc + Rr, (c, z, an) => disc(c, z, an, Rr, 0), { ao: 0.12 }),
      gp(face, sh(face, 0.18), zc - Rr, zc + Rr, (c, z, an) => { if (faceOn(c)) disc(c, z, an, Rr - 0.26, 0.2); }, { ao: 0.12 }),
      gp(back, sh(back, 0.15), zc - Rr, zc + Rr, (c, z, an) => { if (!faceOn(c)) disc(c, z, an, Rr - 0.3, -0.2); }, { ao: 0.12 }),
    ];
    if (o.emblem !== 'none') {
      const em = hex(o.emblemCol || rim);
      parts.push(gp(em, sh(em, 0.2), zc - Rr, zc + Rr, (c, z, an) => {
        if (!faceOn(c)) return;
        const q = ctr(an), dz = z - zc, r2 = Rr - 0.38;
        if (o.emblem === 'band') { if (Math.abs(dz) < 0.32) { const hl = Math.sqrt(Math.max(0, r2 * r2 - dz * dz)); quadU(c, q[0] + nx * 0.36, q[1] + ny * 0.36, ux, uy, 0.55, -hl, hl); } return; }
        if (o.emblem === 'chevron') { plane(c, z, q[0] + nx * 0.36, q[1] + ny * 0.36, th, 0.55, -r2, r2, (u, zz) => { const v = zz - zc + Math.abs(u) * 0.8 - 0.2; return Math.abs(v) < 0.3 && u * u + (zz - zc) * (zz - zc) < r2 * r2; }); return; }
        // cross
        if (Math.abs(dz) < 0.3) { const hl = Math.sqrt(Math.max(0, r2 * r2 - dz * dz)); quadU(c, q[0] + nx * 0.36, q[1] + ny * 0.36, ux, uy, 0.55, -hl, hl); }
        else if (Math.abs(dz) < r2) quadU(c, q[0] + nx * 0.36, q[1] + ny * 0.36, ux, uy, 0.55, -0.3, 0.3);
      }, { ao: 0.05 }));
    }
    parts.push(gp(boss, sh(boss, 0.45), zc - 0.6, zc + 0.6, (c, z, an) => { if (!faceOn(c)) return; const q = ctr(an); ball(c, z, q[0] + nx * 0.5, q[1] + ny * 0.5, zc, 0.55); }, { ao: 0 }));
    return { key: (a, an) => { const q = ctr(an); return dep(a, q[0], q[1]); }, shade: 0.05, parts };
  }
  const p2 = (o, k) => (o.pal ? o.pal[k] : PDEF[k]);
  // bow held upright in the hand, limbs curving forward, light string behind
  function gBow(R, s, o) {
    o = o || {};
    const H = handAt(R, s), L = o.len || 4.0, bul = o.bulge || 1.25, wood = hex(o.wood || '#a8743a');
    const limb = (u, z, h) => { const v = (z - h[2]) / L; if (v <= -1 || v >= 1) return false; const ub = bul * (1 - v * v) - bul + (Math.abs(v) > 0.82 ? (Math.abs(v) - 0.82) * 1.6 : 0); return Math.abs(u - ub) < 0.24 + 0.16 * (1 - Math.abs(v)); };
    let zl = 1e9, zh = -1e9; for (let i = 0; i < 8; i++) { const z = H(i / 8)[2]; zl = Math.min(zl, z - L - 0.2); zh = Math.max(zh, z + L + 0.2); }
    zl = Math.max(0, zl);
    return { under: [
      gp('#d8d0bc', '#f4eedc', zl, zh, (c, z, an) => { const h = H(an); if (Math.abs(z - h[2]) > L * 0.97) return; quadU(c, h[0] - bul + 0.05, h[1], 1, 0, 0.5, -0.09, 0.09); }, { ao: 0 }),
      gp(wood, o.woodT || '#f0c27a', zl, zh, (c, z, an) => { const h = H(an); plane(c, z, h[0], h[1], 0, 0.55, -bul - 0.5, 0.5, (u, zz) => limb(u, zz, h), 0.08); }, { ao: 0.05 }),
    ] };
  }
  // quiver on the back (a group)
  function gQuiver(o) {
    o = o || {};
    const lc = hex(o.col || '#4a2a18'), fl = hex(o.fletch || '#f2ecdc');
    return { key: (a) => dep(a, -1.4, 0.5), parts: [
      tube(sh(lc, -0.05), sh(lc, 0.25), () => [[[-1.3, 0.5, 5.0, 0.55], [-1.7, 0.95, 9.0, 0.58]]], { ao: 0.25 }),
      tube('#c8a050', '#f0d080', () => [[[-1.66, 0.9, 8.6, 0.64], [-1.7, 0.95, 8.95, 0.64]]], { ao: 0 }),
      tube(sh(fl, -0.2), fl, () => [[[-1.75, 0.75, 9.2, 0.3], [-1.82, 0.7, 9.9, 0.24]], [[-1.95, 1.15, 9.15, 0.3], [-2.05, 1.2, 9.8, 0.24]], [[-1.55, 1.1, 9.3, 0.3], [-1.6, 1.2, 10.0, 0.24]]], { ao: 0 }),
    ] };
  }
  // straight sword held up and forward, gold hilt
  function gSword(R, s, o) {
    o = o || {};
    const H = handAt(R, s), len = o.len || 4.4, el = o.elev !== undefined ? o.elev : 1.15;
    const dir = [Math.cos(el), 0.05 * s, Math.sin(el)];
    const blade = hex(o.blade || STEEL), bladeT = hex(o.bladeT || STEEL_T), hilt = hex(o.hilt || GOLD), hiltT = hex(o.hiltT || GOLD_T);
    const P0 = (an, t) => { const h = H(an); return [h[0] + dir[0] * t, h[1] + dir[1] * t, h[2] + dir[2] * t]; };
    return { under: [
      tube(blade, bladeT, (an) => { const a = P0(an, 0.5), b = P0(an, 0.5 + len * 0.85), e = P0(an, 0.5 + len); return [[a.concat(0.34), b.concat(0.26), e.concat(0.09)]]; }, { ao: 0 }),
      tube(hilt, hiltT, (an) => { const g = P0(an, 0.48), m = P0(an, -0.62); return [[[g[0] - dir[2] * 0.0, g[1] - 0.72, g[2], 0.2], [g[0], g[1] + 0.72, g[2], 0.2]], [m.concat(0.28)]]; }, { ao: 0 }),
    ] };
  }
  // big bearded axe held upright in the hand, blade facing forward
  function gAxe(R, s, o) {
    o = o || {};
    const H = handAt(R, s), top = o.top || 10.6, bot = o.bot || 3.0, wood = hex(o.wood || WOOD);
    const head = hex(o.head || '#8c96a0'), headT = hex(o.headT || STEEL_T);
    const hz = top - 0.75;
    const blade = (u, z) => { const v = z - hz; if (u < 0.05 || u > 2.15) return false; const t = u / 2.1; const hi = 0.45 + 0.85 * Math.pow(t, 1.6), lo = -0.45 - 1.25 * Math.pow(t, 1.4); const edge = 2.1 - 0.5 * Math.pow((v + 0.25) / 1.6, 2); return v < hi && v > lo && u < edge; };
    return { under: [
      tube(wood, sh(wood, 0.25), (an) => { const h = H(an); return [[[h[0] + 0.1, h[1], bot, 0.33], [h[0] + 0.1, h[1], top, 0.33]]]; }, { ao: 0.05 }),
      gp(head, headT, hz - 1.8, hz + 1.4, (c, z, an) => { const h = H(an); plane(c, z, h[0] + 0.1, h[1], 0, 0.55, 0, 2.3, blade, 0.08); }, { ao: 0.05 }),
      gp(IRON, IRON_T, hz - 0.5, hz + 0.5, (c, z, an) => { const h = H(an); plane(c, z, h[0] + 0.1, h[1], 0, 0.62, -0.6, 0.35, (u, zz) => Math.abs(zz - hz) < 0.42 - Math.max(0, -u - 0.25)); }, { ao: 0 }),
    ] };
  }
  // elven glaive: long pale shaft, sweeping curved blade with a teal tassel
  function gGlaive(R, s, o) {
    o = o || {};
    const H = handAt(R, s), top = o.top || 12.6, bot = o.bot || 0.6, BL = 3.4;
    const shaft = hex(o.shaft || '#d8d2c0'), blade = hex(o.blade || '#a8b4bc'), bladeT = hex(o.bladeT || '#f4fbff'), acc = hex(o.acc || '#2f8a6a');
    const inside = (u, z) => { const v = (z - top) / BL; if (v < 0 || v > 1) return false; const back = -0.28 + v * 0.1 - 0.5 * v * v; const front = 0.28 + 0.95 * Math.sin(PI * Math.min(1, v * 0.95)) * (1 - v * 0.35) - 0.55 * v * v; return u > back && u < front; };
    return { under: [
      tube(shaft, sh(shaft, 0.2), (an) => { const h = H(an); return [[[h[0] + 0.05, h[1], bot, 0.3], [h[0] + 0.05, h[1], top + 0.1, 0.3]]]; }, { ao: 0.05 }),
      gp(blade, bladeT, top, top + BL, (c, z, an) => { const h = H(an); plane(c, z, h[0] + 0.05, h[1], 0, 0.55, -1.2, 1.4, inside, 0.07); }, { ao: 0 }),
      tube(acc, sh(acc, 0.25), (an) => { const h = H(an); return [[[h[0] - 0.35, h[1], top + 0.05, 0.24], [h[0] + 0.45, h[1], top + 0.05, 0.24]], [[h[0] - 0.2, h[1], top - 0.1, 0.22], [h[0] - 0.55, h[1], top - 1.2, 0.18]]]; }, { ao: 0 }),
    ] };
  }
  // staff with a glowing orb held in claws (mages); glow: null for a plain walking stick
  function gStaff(R, s, o) {
    o = o || {};
    const H = handAt(R, s), top = o.top || 12.2, bot = o.bot !== undefined ? o.bot : 0.3, wood = hex(o.wood || '#6e4a2c');
    const parts = [tube(wood, sh(wood, 0.25), (an) => { const h = H(an); const lean = o.lean || 0; return [[[h[0] + 0.05 - lean, h[1], bot, 0.31], [h[0] + 0.05 + lean * 0.6, h[1], top, 0.33]]]; }, { ao: 0.08 })];
    if (o.glow) {
      const g = hex(o.glow), cl = hex(o.claw || GOLD), cz = top + 0.95;
      parts.push(tube(cl, sh(cl, 0.3), (an) => { const h = H(an), x = h[0] + 0.05 + (o.lean || 0) * 0.6; return [[[x, h[1], top - 0.1, 0.3], [x + 0.55, h[1], top + 0.5, 0.18], [x + 0.45, h[1], top + 1.4, 0.12]], [[x, h[1], top - 0.1, 0.3], [x - 0.55, h[1], top + 0.5, 0.18], [x - 0.45, h[1], top + 1.4, 0.12]]]; }, { ao: 0 }));
      parts.push(gp(g, sh(g, 0.5), cz - 0.8, cz + 0.8, (c, z, an) => { const h = H(an); ball(c, z, h[0] + 0.05 + (o.lean || 0) * 0.6, h[1], cz, 0.72 + 0.06 * Math.sin(cyc(an, 0) * 2)); }, { flat: true, ao: 0,
        detail: (c, an) => { const h = H(an), x = h[0] + 0.05 + (o.lean || 0) * 0.6; glow(c, g, x, h[1], 1.7 + 0.2 * Math.sin(cyc(an) * 2), '#ffffff', 0.5); S.dot(c, '#ffffff', x - 0.18, h[1] - 0.2, 0.26); } }));
    }
    return { under: parts };
  }
  // hoe over the shoulder: shaft from the hand past the shoulder, blade hanging behind
  function gHoe(R, s) {
    const wood = hex('#8a6438');
    const end = [-2.35, s * 1.98, 10.0];
    return { under: [
      tube(wood, sh(wood, 0.3), (an) => { const h = R.arm(s, an).h; return [[[h[0] + 0.7, h[1] - s * 0.05, h[2] - 0.6, 0.31], [end[0], end[1], end[2], 0.31]]]; }, { ao: 0.05 }),
      gp('#5a5e64', '#c4cad0', 8.3, 10.25, (c, z) => plane(c, z, end[0] - 0.05 + (10.1 - z) * 0.18, end[1], PI / 2, 0.6, -0.7, 0.7, (u, zz) => zz > 8.3 + Math.abs(u) * 0.25), { ao: 0.1 }),
    ] };
  }
  // wicker basket of produce carried in front with both hands (a group)
  function gBasket() {
    const wk = hex('#9a7038');
    return { key: (a) => dep(a, 1.7, 0), parts: [
      gp(wk, '#d8a860', 3.5, 5.0, (c, z) => { const k = 0.82 + (z - 3.5) * 0.12; S.ell(c, 1.7, 0, 1.15 * k, 1.5 * k); }, { ao: 0.3, bevel: true,
        detail: (c) => { S.dot(c, '#5a3a18', 1.7, 0, 1.1); } }),
      gp('#c83a2a', '#ff7a5a', 4.7, 5.6, (c, z) => { ball(c, z, 1.4, 0.55, 5.0, 0.46); ball(c, z, 1.95, -0.4, 5.05, 0.46); ball(c, z, 2.05, 0.6, 5.0, 0.42); }, { ao: 0 }),
      gp('#6a9a2a', '#b8e05a', 4.7, 5.6, (c, z) => { ball(c, z, 1.35, -0.6, 5.0, 0.44); ball(c, z, 1.75, 0.05, 5.15, 0.44); }, { ao: 0 }),
      gp(wk, '#d8a860', 4.6, 6.4, (c, z) => plane(c, z, 1.7, 0, PI / 2, 0.55, -1.45, 1.45, (u, zz) => { const v = zz - 4.75; return Math.abs(Math.sqrt(u * u * 0.55 + v * v * 1.4) - 1.05) < 0.2 && v > 0; }), { ao: 0 }),
    ] };
  }
  // cloak hanging from the shoulders (a group that sorts behind/in front of the body)
  function gCloak(D, prof, col, o) {
    o = o || {};
    const cc = hex(col), z0 = o.z0 !== undefined ? o.z0 : 1.6, z1 = D.top - 0.05, inner = hex(o.inner || sh(cc, -0.35));
    const shape = (k0, th) => (c, z, an) => {
      const u = (z - z0) / (z1 - z0), q = profAt(prof, Math.max(z, prof[0][0]));
      const rx = Math.max(q[1], D.tRx * 0.95) + 0.28 + (1 - u) * 0.55, ry = Math.max(q[2], D.tRy * 0.95) + 0.22 + (1 - u) * (o.flare || 0.45);
      const sway = Math.cos(cyc(an, 0.25)) * 0.3 * (1 - u) * (1 - u), cx = (q[3] || 0) - 0.12 - sway - (1 - u) * 0.25;
      const t0 = PI * (u > 0.88 ? 0.3 : 0.52), t1 = TAU - t0, n = 22;
      for (let i = 0; i <= n; i++) { const t = lerp(t0, t1, i / n); const x = cx + Math.cos(t) * rx * k0, y = Math.sin(t) * ry * k0; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      for (let i = n; i >= 0; i--) { const t = lerp(t0, t1, i / n); c.lineTo(cx + Math.cos(t) * (rx * k0 - th), Math.sin(t) * (ry * k0 - th)); }
      c.closePath();
    };
    return { key: (a) => dep(a, -1.25, 0), parts: [
      gp(inner, sh(inner, 0.2), z0, z1, (c, z, an) => { const a = viewA(c); if (dep(a, 1, 0) > 0.2) shape(0.97, 0.5)(c, z, an); }, { ao: 0.3 }),
      gp(cc, sh(cc, 0.18), z0, z1, shape(1, 0.55), { ao: 0.35, bevel: true }),
    ] };
  }

  /* ================================================================
   * QUADRUPEDS — builder
   * ================================================================ */
  function bodyK(B, z) {
    const zt = (z - B.z0) / (B.z1 - B.z0), m = B.mid || 0.45;
    if (zt < m) { const d = (m - zt) / m; return Math.sqrt(Math.max(0.05, 1 - d * d * (B.kB !== undefined ? B.kB : 0.6))); }
    const d = (zt - m) / (1 - m); return Math.sqrt(Math.max(0.05, 1 - d * d * (B.kT !== undefined ? B.kT : 0.6)));
  }
  function bodyPt(B, t, k) {
    const ct = Math.cos(t), st = Math.sin(t), e = 2 / (B.n || 2);
    const x = Math.sign(ct) * Math.pow(Math.abs(ct), e), y = Math.sign(st) * Math.pow(Math.abs(st), e);
    return [B.cx + x * B.a * k, y * lerp(B.bR, B.bF, (1 + ct) / 2) * k];
  }
  const bodyRing = (B) => (z, t, k) => bodyPt(B, t, bodyK(B, z) * k);
  function bodyPart(B, side, top, o) {
    o = o || {};
    return { z0: B.z0, z1: B.z1, side: hex(side), top: hex(top), ao: o.ao !== undefined ? o.ao : 0.35, detail: o.detail,
      shape: (c, zt) => { const k = bodyK(B, lerp(B.z0, B.z1, zt)); for (let i = 0; i < 40; i++) { const q = bodyPt(B, i / 40 * TAU - PI, k); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.closePath(); } };
  }
  /* cfg: { legs: { list: [[x, y, phase, hind]], hipZ, stride, lift, r0, r1, r2, hoofH, hock, col, top, low, lowT, hoof },
   *        under: [parts before the body], body: part, core: [parts after the body],
   *        head: { at: [x, y], parts }, tail: { at, parts }, r, h } */
  function quad(cfg) {
    const L = cfg.legs, G = [];
    for (const lg of L.list) {
      const pts = (an) => {
        const f = cyc(an, lg[2]), x = lg[0] + Math.cos(f) * L.stride, up = Math.max(0, -Math.sin(f)) * L.lift, y = lg[1] * 1.03;
        const kz = L.hipZ * (lg[3] ? 0.52 : 0.46) + up * 0.45;
        const kx = lg[3] ? (x + lg[0]) / 2 - (L.hock || 0.4) - up * 0.15 : (x + lg[0]) / 2 + 0.15 + up * 0.55;
        return { f: [x, y, up], k: [kx, y, kz], hp: [lg[0], lg[1], L.hipZ] };
      };
      const col = hex(L.col), low = hex(L.low || L.col), hoof = hex(L.hoof || '#2a2420');
      const parts = [
        tube(col, L.top || sh(col, 0.15), (an) => { const q = pts(an); return [[q.k.concat(L.r1), q.hp.concat(L.r0), [q.hp[0], q.hp[1] * 0.8, q.hp[2] + 1.3, L.r0 * 1.15]]]; }, { ao: 0.2 }),
        tube(low, L.lowT || sh(low, 0.12), (an) => { const q = pts(an); return [[[q.f[0], q.f[1], q.f[2] + L.hoofH * 0.7, L.r2], q.k.concat(L.r1)]]; }, { ao: 0.15 }),
        tube(hoof, sh(hoof, 0.25), (an) => { const q = pts(an); return [[[q.f[0] + 0.06, q.f[1], q.f[2] + 0.12, L.r2 * 1.12], [q.f[0], q.f[1], q.f[2] + L.hoofH, L.r2 * 1.04]]]; }, { ao: 0.05 }),
      ];
      const d = (a) => dep(a, lg[0], lg[1]);
      G.push({ key: (a, an) => -0.5 + 0.01 * dep(a, pts(an).f[0], lg[1]), dk: (a) => d(a) * 0.6, shade: 0.1, parts });
    }
    if (cfg.under) G.push({ key: () => -0.4, parts: cfg.under });
    G.push({ key: () => 0, parts: [cfg.body].concat(cfg.core || []) });
    if (cfg.head) G.push({ key: (a) => dep(a, cfg.head.at[0], cfg.head.at[1]), parts: cfg.head.parts });
    if (cfg.tail) G.push({ key: (a) => dep(a, cfg.tail.at[0], cfg.tail.at[1]), parts: cfg.tail.parts });
    for (const it of cfg.items || []) G.push(it);
    return { r: cfg.r, h: cfg.h, parts: assemble(G), style: 'unit', scale: cfg.scale || 1 };
  }
  // walk order for quadrupeds: left hind, left fore, right hind, right fore
  const legSet = (fx, fy, hx, hy) => [[hx, -hy, 0, 1], [fx, -fy, 0.25, 0], [hx, hy, 0.5, 1], [fx, fy, 0.75, 0]];
  const sideEye = (col, x, y, z, r, flat) => [1, -1].map((s) => gp(col, flat ? col : sh(col, 0.4), z - r - 0.05, z + r, (c, zz) => ball(c, zz, x, s * y, z, r), { flat, ao: 0, show: vis(0.4, s, 0.15) }));

  /* ================================================================
   * ANIMALS
   * ================================================================ */
  M.ani_cow = function (pal, opt) {
    opt = opt || {};
    const W = '#c9c1b2', WT = '#f2ede2', BK = '#1d1a18', BKT = '#3a3431', PINK = '#c98a84', PINKT = '#eab0a8';
    const B = { cx: -0.4, a: 5.3, bF: 2.45, bR: 2.4, n: 2.6, z0: 4.4, z1: 8.7, mid: 0.42, kT: 0.62, kB: 0.6 };
    const ring = bodyRing(B);
    const patchesTop = [[1.3, -0.5, 1.45, 3], [-2.5, 0.9, 1.6, 5], [-4.6, -0.7, 1.0, 7], [3.6, 1.0, 0.85, 2], [-0.6, -1.6, 0.9, 9]];
    const body = bodyPart(B, W, WT, { detail: clipped((c) => blobs(c, css(BKT), patchesTop)) });
    const pk = { inK: 0.7, out: 1.05 };
    const core = [
      patch(BK, BKT, ring, 1.45, 0.42, 7.4, 1.6, pk), patch(BK, BKT, ring, 2.62, 0.28, 6.3, 1.25, pk), patch(BK, BKT, ring, 0.55, 0.2, 5.6, 0.75, pk),
      patch(BK, BKT, ring, -1.05, 0.38, 7.5, 1.5, pk), patch(BK, BKT, ring, -2.45, 0.32, 6.9, 1.35, pk), patch(BK, BKT, ring, -0.3, 0.16, 6.0, 0.7, pk),
    ];
    const under = [gp(PINK, PINKT, 3.1, 4.9, (c, z) => { ball(c, z, -2.6, 0, 4.0, 0.9); }, { ao: 0.2 })];
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.12;
    const head = { at: [6.2, 0], parts: [
      tube(BK, BKT, (an) => [[[5.6, 1.0, 7.75 + bob(an), 0.3], [5.4, 1.9, 7.6 + bob(an), 0.3]], [[5.6, -1.0, 7.75 + bob(an), 0.3], [5.4, -1.9, 7.6 + bob(an), 0.3]]], { ao: 0 }),
      tube(W, WT, (an) => [[[3.6, 0, 7.2, 1.55], [5.2, 0, 7.05 + bob(an), 1.28]]], { ao: 0.3 }),
      tube(W, WT, (an) => [[[5.5, 0, 7.55 + bob(an), 1.08], [6.6, 0, 7.05 + bob(an), 0.92], [7.25, 0, 6.5 + bob(an), 0.82]]], { ao: 0.2 }),
      tube(BK, BKT, (an) => [[[5.45, 0, 7.95 + bob(an), 0.86], [6.35, 0, 7.55 + bob(an), 0.62]]], { ao: 0 }),
      tube(PINK, PINKT, (an) => [[[7.45, 0, 6.3 + bob(an), 0.8]]], { ao: 0.1 }),
      tube('#c8b890', '#f6ecd0', (an) => [[[5.55, 0.62, 8.35 + bob(an), 0.3], [5.75, 1.3, 8.75 + bob(an), 0.24], [6.15, 1.5, 9.35 + bob(an), 0.15]], [[5.55, -0.62, 8.35 + bob(an), 0.3], [5.75, -1.3, 8.75 + bob(an), 0.24], [6.15, -1.5, 9.35 + bob(an), 0.15]]], { ao: 0 }),
    ].concat(sideEye('#141010', 6.15, 0.82, 7.6, 0.17)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.5;
    const tail = { at: [-5.6, 0], parts: [
      tube(W, WT, (an) => [[[-5.55, 0, 8.3, 0.28], [-5.95, sw(an) * 0.4, 6.8, 0.22], [-6.05, sw(an), 5.0, 0.2]]], { ao: 0.1 }),
      tube(BK, BKT, (an) => [[[-6.05, sw(an), 4.7, 0.45], [-6.05, sw(an) * 1.1, 4.1, 0.38]]], { ao: 0 }),
    ] };
    const legs = { list: legSet(3.3, 1.45, -3.75, 1.5), hipZ: 5.4, stride: 1.2, lift: 0.85, r0: 0.78, r1: 0.52, r2: 0.43, hoofH: 0.7, hock: 0.5, col: W, top: WT, hoof: '#2b2420' };
    return quad({ legs, under, body, core, head, tail, r: 9, h: 9.8 });
  };

  M.ani_sheep = function (pal, opt) {
    opt = opt || {};
    const WO = '#b9b0a0', WOT = '#f4efe4', DK = '#2a2421', DKT = '#5a4e48';
    const z0 = 2.3, z1 = 6.5;
    const cloud = (c, z) => {
      const zt = (z - z0) / (z1 - z0), k = zt < 0.4 ? Math.sqrt(1 - Math.pow((0.4 - zt) / 0.4, 2) * 0.55) : Math.sqrt(Math.max(0.08, 1 - Math.pow((zt - 0.4) / 0.6, 2) * 0.82));
      S.ell(c, -0.2, 0, 2.5 * k, 1.85 * k);
      for (let i = 0; i < 9; i++) { const t = i / 9 * TAU + 0.2 + zt * 0.5; S.circ(c, -0.2 + Math.cos(t) * 2.45 * k, Math.sin(t) * 1.75 * k, (0.95 + ((i * 5) % 3) * 0.16) * k); }
    };
    const body = gp(WO, WOT, z0, z1, cloud, { ao: 0.4, bevel: true,
      detail: (c) => { c.save(); c.strokeStyle = 'rgba(150,135,110,0.45)'; c.lineWidth = 0.16; for (const q of [[-1.2, -0.5], [0.4, 0.6], [-0.4, -0.2], [0.9, -0.6], [-1.7, 0.6]]) { c.beginPath(); c.arc(q[0], q[1], 0.42, 0.4, 3.6); c.stroke(); } c.restore(); } });
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.1;
    const head = { at: [3.4, 0], parts: [
      tube(DK, DKT, (an) => [1, -1].map((s) => [[3.0, s * 0.75, 5.3 + bob(an), 0.3], [2.8, s * 1.65, 4.95 + bob(an), 0.28]]), { ao: 0 }),
      tube(DK, DKT, (an) => [[[2.8, 0, 5.1 + bob(an), 0.95], [3.75, 0, 4.7 + bob(an), 0.8], [4.4, 0, 4.2 + bob(an), 0.62]]], { ao: 0.15 }),
      tube(WO, WOT, (an) => [[[2.65, 0, 5.85 + bob(an), 0.8]]], { ao: 0.1 }),
    ].concat(sideEye('#0a0808', 3.35, 0.62, 5.1, 0.13)) };
    const tail = { at: [-3.2, 0], parts: [tube(WO, WOT, () => [[[-3.15, 0, 5.0, 0.62], [-3.4, 0, 4.4, 0.45]]], { ao: 0.1 })] };
    const legs = { list: legSet(1.9, 0.95, -2.1, 0.95), hipZ: 2.9, stride: 0.85, lift: 0.6, r0: 0.4, r1: 0.32, r2: 0.28, hoofH: 0.45, hock: 0.25, col: DK, top: DKT, hoof: '#151110' };
    return quad({ legs, body, head, tail, r: 5.5, h: 6.8 });
  };

  M.ani_goat = function (pal, opt) {
    opt = opt || {};
    const BR = '#7a5838', BRT = '#c49a68', DK = '#2a221c', DKT = '#5e4c3e', HORN = '#6a6256', HORNT = '#c4bcae';
    const B = { cx: -0.2, a: 3.55, bF: 1.45, bR: 1.38, n: 2.2, z0: 3.4, z1: 6.4, mid: 0.45, kT: 0.6, kB: 0.6 };
    const body = bodyPart(B, BR, BRT, { detail: clipped((c) => { S.lines(c, css(DK, 0.9), 0.55, [3.2, 0, -3.6, 0]); }) });
    const core = [band(DK, DKT, bodyRing(B), 2.3, 3.98, 3.4, 4.5, { inK: 0.7 })];
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.1;
    const head = { at: [3.8, 0], parts: [
      tube(BR, BRT, (an) => [[[3.35, 0.5, 7.65 + bob(an), 0.22], [3.3, 1.25, 7.4 + bob(an), 0.2]], [[3.35, -0.5, 7.65 + bob(an), 0.22], [3.3, -1.25, 7.4 + bob(an), 0.2]]], { ao: 0 }),
      tube(BR, BRT, (an) => [[[2.4, 0, 5.6, 0.86], [3.25, 0, 7.1 + bob(an), 0.62]]], { ao: 0.25 }),
      tube(DK, DKT, (an) => [[[3.3, 0, 7.5 + bob(an), 0.66], [4.05, 0, 7.1 + bob(an), 0.52], [4.65, 0, 6.75 + bob(an), 0.4]]], { ao: 0.1 }),
      tube(DK, DKT, (an) => [[[4.35, 0, 6.5 + bob(an), 0.3], [4.3, 0, 5.75 + bob(an), 0.2], [4.2, 0, 5.4 + bob(an), 0.12]]], { ao: 0, show: vis(1, 0, -0.6) }),
      tube(HORN, HORNT, (an) => [[[3.3, 0.33, 8.0 + bob(an), 0.28], [2.95, 0.48, 8.9 + bob(an), 0.22], [2.25, 0.6, 9.15 + bob(an), 0.17], [1.75, 0.66, 8.7 + bob(an), 0.12]], [[3.3, -0.33, 8.0 + bob(an), 0.28], [2.95, -0.48, 8.9 + bob(an), 0.22], [2.25, -0.6, 9.15 + bob(an), 0.17], [1.75, -0.66, 8.7 + bob(an), 0.12]]], { ao: 0 }),
    ].concat(sideEye('#e0b84a', 3.9, 0.48, 7.6, 0.13, true)) };
    const tail = { at: [-3.7, 0], parts: [tube(DK, DKT, (an) => [[[-3.6, 0, 6.0, 0.24], [-3.95, 0, 6.8 + Math.sin(cyc(an) * 2) * 0.15, 0.18]]], { ao: 0 })] };
    const legs = { list: legSet(2.2, 0.85, -2.45, 0.85), hipZ: 3.9, stride: 0.95, lift: 0.7, r0: 0.5, r1: 0.31, r2: 0.25, hoofH: 0.5, hock: 0.35, col: BR, low: DK, lowT: DKT, hoof: '#151110' };
    return quad({ legs, body, core, head, tail, r: 5.5, h: 9.6 });
  };

  M.ani_deer = function (pal, opt) {
    opt = opt || {};
    const BR = '#7e4826', BRT = '#c0804c', WH = '#d8ccb6', WHT = '#f6eee0', LO = '#5a361e', ANT = '#b8a47e', ANTT = '#f4e8cc';
    const B = { cx: -0.35, a: 4.7, bF: 1.8, bR: 1.68, n: 2.15, z0: 5.4, z1: 8.6, mid: 0.42, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, BR, BRT, { detail: clipped((c) => { c.save(); c.fillStyle = css(WHT); c.beginPath(); S.ell(c, -5.0, 0, 1.1, 1.0); c.fill(); c.fillStyle = 'rgba(70,36,16,0.35)'; c.beginPath(); S.ell(c, 0.2, 0, 3.4, 0.45); c.fill(); c.restore(); }) });
    const core = [band(WH, WHT, ring, 2.55, 3.73, 5.9, 8.6, { inK: 0.7 }), band(WH, WHT, ring, -0.9, 0.9, 5.4, 6.2, { inK: 0.7 })];
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.14;
    const parts = [
      tube(BR, BRT, (an) => [[[4.95, 0.5, 11.0 + bob(an), 0.3], [4.85, 1.35, 11.45 + bob(an), 0.3]], [[4.95, -0.5, 11.0 + bob(an), 0.3], [4.85, -1.35, 11.45 + bob(an), 0.3]]], { ao: 0 }),
      tube(BR, BRT, (an) => [[[3.5, 0, 7.6, 1.0], [4.6, 0, 9.4 + bob(an) * 0.5, 0.8], [5.0, 0, 10.3 + bob(an), 0.72]]], { ao: 0.25 }),
      tube(WH, WHT, (an) => [[[4.7, 0, 9.3 + bob(an) * 0.5, 0.62], [5.15, 0, 9.85 + bob(an), 0.5]]], { ao: 0, show: vis(1, 0, -0.2) }),
      tube(BR, BRT, (an) => [[[5.1, 0, 10.65 + bob(an), 0.78], [6.1, 0, 10.25 + bob(an), 0.58], [6.95, 0, 9.85 + bob(an), 0.42]]], { ao: 0.1 }),
      tube('#1e1410', '#4a3a30', (an) => [[[7.05, 0, 9.85 + bob(an), 0.33]]], { ao: 0 }),
    ].concat(sideEye('#140c08', 5.75, 0.55, 10.65, 0.15));
    if (!opt.doe) {
      const A = (s) => (an) => { const b = bob(an); return [
        [[5.1, s * 0.42, 11.2 + b, 0.36], [4.75, s * 1.15, 12.6 + b, 0.32], [4.95, s * 1.85, 14.0 + b, 0.28], [5.55, s * 2.2, 15.0 + b, 0.2]],
        [[4.8, s * 1.05, 12.4 + b, 0.28], [5.65, s * 1.2, 13.25 + b, 0.2]],
        [[4.92, s * 1.75, 13.7 + b, 0.26], [5.7, s * 1.6, 14.6 + b, 0.19]],
        [[5.0, s * 0.62, 11.6 + b, 0.28], [5.85, s * 0.75, 11.95 + b, 0.19]],
      ]; };
      parts.push(tube(ANT, ANTT, (an) => A(1)(an).concat(A(-1)(an)), { ao: 0 }));
    }
    const head = { at: [5.6, 0], parts };
    const tail = { at: [-5.1, 0], parts: [tube(WH, WHT, (an) => [[[-4.95, 0, 8.2, 0.38], [-5.35, 0, 7.5 + Math.sin(cyc(an) * 2) * 0.1, 0.3]]], { ao: 0 })] };
    const legs = { list: legSet(3.35, 0.95, -3.7, 0.95), hipZ: 6.0, stride: 1.35, lift: 1.0, r0: 0.62, r1: 0.36, r2: 0.28, hoofH: 0.5, hock: 0.55, col: BR, low: LO, hoof: '#1a1410' };
    return quad({ legs, body, core, head, tail, r: 8, h: opt.doe ? 11.8 : 15.5 });
  };

  M.ani_boar = function (pal, opt) {
    opt = opt || {};
    const DK = '#241c18', DKT = '#54443a', BR = '#36281f', BRT = '#7a6250', SN = '#8a5e56', SNT = '#d8a094', TU = '#d8ceb4', TUT = '#ffffff';
    const B = { cx: -0.7, a: 4.6, bF: 2.15, bR: 1.85, n: 2.3, z0: 2.9, z1: 6.5, mid: 0.4, kT: 0.55, kB: 0.6 };
    const body = bodyPart(B, BR, BRT, { detail: clipped((c) => { c.save(); c.strokeStyle = 'rgba(160,130,100,0.45)'; c.lineWidth = 0.18; c.beginPath(); for (let i = 0; i < 18; i++) { const x = -4.6 + i * 0.5, y = ((i * 37) % 7 - 3) * 0.35; c.moveTo(x, y); c.lineTo(x - 0.7, y + (y > 0 ? 0.4 : -0.4)); } c.stroke(); c.restore(); }) });
    const hump = stack(BR, BRT, [[5.3, 2.3, 1.7, 1.0], [6.6, 2.15, 1.55, 1.0], [7.3, 1.6, 1.1, 0.9], [7.6, 0.8, 0.55, 0.8]], { ao: 0.3 });
    const crest = gp('#7a6650', '#9a8670', 5.6, 9.2, (c, z) => plane(c, z, 0, 0, 0, 0.75, -4.6, 3.4, (u, zz) => {
      const base = u > 1.2 ? 7.4 - (u - 1.2) * 0.75 : u > -1.5 ? 7.4 - (1.2 - u) * 0.12 : 7.08 - (-1.5 - u) * 0.6;
      const saw = 1.15 * Math.abs(((u * 1.15) % 1 + 1) % 1 - 0.5) * 2 * Math.min(1, (u + 4.4) / 2, (3.3 - u) / 1.2);
      return zz < base + saw && zz > base - 1.2 && u > -4.4 && u < 3.3;
    }, 0.07), { ao: 0.78 });
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.1;
    const head = { at: [4.8, 0], parts: [
      tube(DK, DKT, (an) => [[[4.0, 0.85, 6.3 + bob(an), 0.38], [3.75, 1.15, 7.25 + bob(an), 0.14]], [[4.0, -0.85, 6.3 + bob(an), 0.38], [3.75, -1.15, 7.25 + bob(an), 0.14]]], { ao: 0 }),
      tube(BR, BRT, (an) => [[[3.4, 0, 5.4 + bob(an), 1.45], [4.9, 0, 4.75 + bob(an), 1.05], [6.25, 0, 4.1 + bob(an), 0.66]]], { ao: 0.25 }),
      tube(SN, SNT, (an) => [[[6.35, 0, 4.05 + bob(an), 0.66], [6.8, 0, 3.95 + bob(an), 0.62]]], { ao: 0.1 }),
      tube(TU, TUT, (an) => [1, -1].map((s) => [[5.95, s * 0.62, 3.7 + bob(an), 0.34], [6.65, s * 0.95, 4.15 + bob(an), 0.3], [6.75, s * 1.05, 4.95 + bob(an), 0.2], [6.45, s * 1.0, 5.45 + bob(an), 0.12]]), { ao: 0 }),
    ].concat(sideEye('#e05a2a', 5.05, 0.78, 5.35, 0.13, true)) };
    const sw = (an) => Math.sin(cyc(an) * 2) * 0.4;
    const tail = { at: [-5.2, 0], parts: [tube(DK, DKT, (an) => [[[-5.1, 0, 5.6, 0.2], [-5.45, sw(an), 4.7, 0.16], [-5.5, sw(an), 4.3, 0.28]]], { ao: 0 })] };
    const legs = { list: legSet(2.5, 1.1, -3.1, 1.05), hipZ: 3.4, stride: 1.0, lift: 0.6, r0: 0.66, r1: 0.44, r2: 0.34, hoofH: 0.45, hock: 0.3, col: BR, low: DK, lowT: DKT, hoof: '#100c0a' };
    return quad({ legs, body, core: [hump, crest], head, tail, r: 8, h: 9.2 });
  };

  M.ani_horse = function (pal, opt) {
    opt = opt || {};
    const p = P(pal);
    const BY = '#683a1e', BYT = '#ad6a3c', BK = '#1a1410', BKT = '#3e322a';
    const B = { cx: -0.3, a: 5.4, bF: 2.1, bR: 2.05, n: 2.3, z0: 6.0, z1: 9.6, mid: 0.45, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const core = [];
    let detail = null;
    if (opt.saddle) {
      const k = hex(p.k), k2 = hex(p.k2);
      detail = clipped((c) => { c.save(); c.fillStyle = css(k); c.beginPath(); S.rrect(c, -1.9, -2.6, 3.6, 5.2, 0.6); c.fill(); c.strokeStyle = css(k2); c.lineWidth = 0.32; c.beginPath(); S.rrect(c, -1.75, -2.45, 3.3, 4.9, 0.5); c.stroke(); c.restore(); });
      core.push(band(k, null, ring, 1.18, 1.96, 7.3, 9.6, { inK: 0.75 }), band(k, null, ring, -1.96, -1.18, 7.3, 9.6, { inK: 0.75 }));
      core.push(band(k2, null, ring, 1.18, 1.96, 7.25, 7.6, { inK: 0.75, out: 1.08 }), band(k2, null, ring, -1.96, -1.18, 7.25, 7.6, { inK: 0.75, out: 1.08 }));
      core.push(stack('#4a2c18', '#8a5a34', [[9.3, 1.25, 1.35, -0.1], [9.9, 1.15, 1.3, -0.1], [10.3, 0.75, 0.9, -0.1]], { ao: 0.2, bevel: true }));
      core.push(tube('#4a2c18', '#8a5a34', () => [[[0.95, 0, 10.0, 0.35], [1.1, 0, 10.6, 0.3]], [[-1.2, 0, 10.0, 0.45], [-1.3, 0, 10.5, 0.4]]], { ao: 0 }));
    }
    const sheen = clipped((c) => { c.save(); c.fillStyle = 'rgba(255,230,200,0.22)'; c.beginPath(); S.ell(c, -0.6, -0.55, 3.8, 0.55, -0.04); c.fill(); c.restore(); });
    const body = bodyPart(B, BY, BYT, { detail: detail ? (c, an) => { sheen(c, an); detail(c, an); } : sheen });
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.16;
    const head = { at: [6.6, 0], parts: [
      tube(BY, BYT, (an) => [[[3.8, 0, 8.3, 1.42], [5.3, 0, 10.4 + bob(an) * 0.5, 1.05], [5.95, 0, 11.75 + bob(an), 0.9]]], { ao: 0.3 }),
      tube(BK, BKT, (an) => [[[3.4, 0, 9.85, 0.5], [4.7, 0, 11.3 + bob(an) * 0.5, 0.56], [5.7, 0, 12.75 + bob(an), 0.46]]], { ao: 0.05 }),
      tube(BY, BYT, (an) => [[[6.05, 0, 12.15 + bob(an), 0.88], [7.25, 0, 11.25 + bob(an), 0.7], [8.25, 0, 10.35 + bob(an), 0.56]]], { ao: 0.15 }),
      tube('#3a2416', '#6a4630', (an) => [[[8.35, 0, 10.25 + bob(an), 0.56]]], { ao: 0 }),
      tube(BY, BYT, (an) => [[[5.9, 0.38, 12.8 + bob(an), 0.26], [5.75, 0.5, 13.65 + bob(an), 0.1]], [[5.9, -0.38, 12.8 + bob(an), 0.26], [5.75, -0.5, 13.65 + bob(an), 0.1]]], { ao: 0 }),
      tube(BK, BKT, (an) => [[[6.4, 0, 12.85 + bob(an), 0.4], [6.75, 0, 12.45 + bob(an), 0.28]]], { ao: 0 }),
      gp('#f2ece0', '#ffffff', 10.4, 12.3, (c, z, an) => { const b = bob(an); const t = (12.3 + b - z) / 1.9; if (t < 0 || t > 1) return; S.ell(c, lerp(6.6, 8.1, t) + 0.35, 0, 0.25, 0.22); }, { ao: 0, show: vis(1, 0, -0.1) }),
    ].concat(sideEye('#100a06', 6.75, 0.68, 11.9, 0.17)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.55;
    const tail = { at: [-5.8, 0], parts: [tube(BK, BKT, (an) => [[[-5.55, 0, 9.2, 0.55], [-6.3, sw(an) * 0.4, 8.2, 0.72], [-6.65, sw(an), 6.6, 0.66], [-6.5, sw(an) * 1.25, 5.0, 0.42]]], { ao: 0.1 })] };
    const legs = { list: legSet(3.6, 1.05, -3.85, 1.1), hipZ: 6.7, stride: 1.5, lift: 1.15, r0: 0.86, r1: 0.5, r2: 0.4, hoofH: 0.55, hock: 0.6, col: BY, top: BYT, low: BK, lowT: BKT, hoof: '#26201a' };
    return quad({ legs, body, core, head, tail, r: 9.5, h: 14.2 });
  };

  M.ani_wolf = function (pal, opt) {
    opt = opt || {};
    const GR = '#545860', GRT = '#a6abb2', DK = '#2c2e33', DKT = '#5a5d64', PA = '#b8b2a8', PAT = '#ece8e0';
    const B = { cx: -0.4, a: 3.9, bF: 1.55, bR: 1.22, n: 2.1, z0: 3.5, z1: 6.0, mid: 0.45, kT: 0.6, kB: 0.6 };
    const body = bodyPart(B, GR, GRT, { detail: clipped((c) => { c.save(); c.fillStyle = css(DKT, 0.9); c.beginPath(); S.ell(c, -0.9, 0, 2.6, 0.75); c.fill(); c.restore(); }) });
    const under = [stack(PA, PAT, [[2.9, 1.3, 1.1, 1.9], [4.4, 1.55, 1.3, 1.9], [5.4, 1.3, 1.15, 1.9]], { ao: 0.3 })];
    const core = [stack(GR, GRT, [[4.6, 1.5, 1.45, 1.7], [6.0, 1.45, 1.4, 1.6], [6.5, 0.9, 0.9, 1.5]], { ao: 0.2, detail: (c) => { S.dot(c, css(DKT, 0.8), 1.3, 0, 0.6); } })];
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.1;
    const head = { at: [4.4, 0], parts: [
      tube(DK, DKT, (an) => [[[3.55, 0.5, 6.7 + bob(an), 0.34], [3.45, 0.62, 7.75 + bob(an), 0.07]], [[3.55, -0.5, 6.7 + bob(an), 0.34], [3.45, -0.62, 7.75 + bob(an), 0.07]]], { ao: 0 }),
      tube(GR, GRT, (an) => [[[2.7, 0, 5.4, 1.0], [3.65, 0, 6.0 + bob(an), 0.9], [4.55, 0, 5.75 + bob(an), 0.62], [5.6, 0, 5.4 + bob(an), 0.36]]], { ao: 0.2 }),
      tube(PA, PAT, (an) => [[[4.2, 0, 5.3 + bob(an), 0.55], [5.4, 0, 5.15 + bob(an), 0.3]]], { ao: 0, show: vis(1, 0, -0.3) }),
      tube('#121212', '#3a3a3a', (an) => [[[5.75, 0, 5.45 + bob(an), 0.24]]], { ao: 0 }),
    ].concat(sideEye('#ffcc3a', 4.55, 0.45, 6.05, 0.15, true)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.45;
    const tail = { at: [-4.4, 0], parts: [
      tube(GR, GRT, (an) => [[[-4.0, 0, 5.4, 0.5], [-5.0, sw(an) * 0.4, 4.7, 0.72], [-5.9, sw(an), 3.8, 0.62]]], { ao: 0.15 }),
      tube(DK, DKT, (an) => [[[-6.1, sw(an), 3.55, 0.48], [-6.45, sw(an) * 1.1, 3.2, 0.28]]], { ao: 0 }),
    ] };
    const legs = { list: legSet(2.3, 0.78, -2.7, 0.75), hipZ: 3.9, stride: 1.25, lift: 0.95, r0: 0.55, r1: 0.34, r2: 0.27, hoofH: 0.4, hock: 0.45, col: GR, top: GRT, low: GR, hoof: '#26282c' };
    return quad({ legs, under, body, core, head, tail, r: 7, h: 8.2 });
  };

  /* ================================================================
   * PEOPLE
   * ================================================================ */
  const swingK = (R, s, an, k) => R.swing(s, an) * (k || 0.15);
  const POSE = {
    spear: (an, R, s) => { const w = swingK(R, s, an, 0.12); return { e: [-0.25, s * 2.18, 5.75], h: [0.82 + w, s * 1.98, 5.3] }; },
    shield: (an, R, s) => { const w = swingK(R, s, an, 0.12); return { e: [0.05, s * 2.18, 5.75], h: [0.72 + w, s * 2.0, 5.35] }; },
    hoe: (an, R, s) => { const w = swingK(R, s, an, 0.08); return { e: [0.35, s * 2.12, 5.75], h: [0.95 + w, s * 1.8, 6.85] }; },
    bow: (an, R, s) => { const w = swingK(R, s, an, 0.12); return { e: [0.5, s * 2.3, 5.8], h: [1.55 + w, s * 2.45, 5.3] }; },
    sword: (an, R, s) => { const w = swingK(R, s, an, 0.15); return { e: [0.2, s * 2.22, 5.7], h: [1.05 + w, s * 2.05, 5.0] }; },
    staff: (an, R, s) => { const w = swingK(R, s, an, 0.25); return { e: [0.3, s * 2.15, 5.95], h: [1.0 + w, s * 2.05, 5.95] }; },
    basket: (an, R, s) => ({ e: [0.5, s * 1.98, 5.6], h: [1.35, s * 1.3, 4.95] }),
    axe: (an, R, s) => { const w = swingK(R, s, an, 0.15); return { e: [0.15, s * 2.3, 5.7], h: [0.95 + w, s * 2.15, 5.15] }; },
  };

  M.ppl_peasant = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const basket = opt.tool === 'basket' || opt.v === 1;
    const tunic = mx(p.b, '#a88a60', 0.35);
    const pose = basket ? { R: POSE.basket, L: POSE.basket } : { R: POSE.hoe }, R = rig(HB, pose);
    return person(p, {
      legs: mx(p.a, '#6a5a48', 0.3), boots: '#4a3424', torso: 'tunic', torsoSide: tunic, torsoTop: sh(tunic, 0.2),
      bands: [{ col: ROPE, top: ROPE_T, t0: -PI, t1: PI, z0: 4.3, z1: 4.65, out: 1.07, inK: 0.86 }],
      sleeve: tunic, pose,
      heldR: basket ? [] : [gHoe(R, 1)],
      items: basket ? [gBasket()] : [],
      head: { hair: HAIR.brown, hat: hatStraw(p.t) },
      r: 4.5, h: 11.2,
    });
  };

  M.ppl_villager = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const v = ((opt.v | 0) % 4 + 4) % 4;
    if (v === 0) { // farmhand: muted faction tunic, brown hair
      const tunic = mx(p.k, '#6e5236', 0.5);
      return person(p, { legs: mx(p.a, '#4a4038', 0.35), torso: 'tunic', torsoSide: tunic, sleeve: mx(p.b, '#a89070', 0.3),
        bands: [{ col: LEATH, top: '#9a7046', t0: -PI, t1: PI, z0: 4.3, z1: 4.7 }], head: { hair: HAIR.dark, style: 'short' } });
    }
    if (v === 1) { // woman: long dress, apron, kerchief
      const dress = mx(p.t, '#6a4a3a', 0.35), apron = '#e8e2d2';
      return person(p, { legs: dress, boots: '#3a2a20', torso: 'dress', torsoSide: dress, sleeve: mx(p.b, '#c8b89a', 0.4), dims: { tRy: 1.45, shY: 1.8 },
        bands: [{ col: apron, top: '#ffffff', t0: -0.75, t1: 0.75, z0: 0.9, z1: 4.9, out: 1.05, inK: 0.85 }, { col: '#5a4030', t0: -PI, t1: PI, z0: 4.45, z1: 4.8 }],
        head: { hair: HAIR.auburn, style: 'long', hat: hatKerchief(p.k) }, items: [hairBack(HAIR.auburn, HB, 1.6)] });
    }
    if (v === 2) { // craftsman: leather vest over light shirt, cap, beard, leather apron
      const shirt = mx(p.b, '#ece4d2', 0.45);
      return person(p, { legs: mx(p.a, '#3e3630', 0.4), torso: 'tunic', torsoSide: shirt, torsoTop: sh(shirt, 0.15), sleeve: shirt,
        bands: [{ col: '#4a3020', top: '#7a5434', t0: -1.0, t1: 1.0, z0: 3.3, z1: 6.6, out: 1.06, inK: 0.85 }, { col: '#4a3020', t0: -PI, t1: PI, z0: 4.4, z1: 4.75, out: 1.07 }],
        head: { hair: HAIR.red, beard: HAIR.red, beardLen: 0.7, hat: hatCap(mx(p.t, '#5a4a3a', 0.4)) } });
    }
    // elder: long coat, dark cloak, white hair and beard, walking stick, a slight stoop
    const coat = mx(p.a, '#5a4a3a', 0.35), cloakC = mx(p.k, '#2e2c2a', 0.5);
    const dims = { headX: 0.35, headZ: 8.95, shX: 0.12, shZ: 7.05, top: 7.55 };
    const D = Object.assign({}, HB, dims);
    const R = rig(D, { R: POSE.staff });
    const prof = torsoProf('coat', D);
    return person(p, { dims, legs: '#4a4038', torso: 'coat', torsoSide: coat, sleeve: coat, pose: { R: POSE.staff },
      bands: [{ col: '#3a2c20', t0: -PI, t1: PI, z0: 4.35, z1: 4.7 }],
      heldR: [gStaff(R, 1, { top: 9.8, lean: 0.25 })],
      head: { hair: HAIR.white, style: 'short', beard: HAIR.white, beardLen: 1.1, fringe: -0.4 },
      items: [gCloak(D, prof, cloakC, { z0: 1.4 })] });
  };

  M.ppl_soldier = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const D = HB, pose = { R: POSE.spear, L: POSE.shield }, R = rig(D, pose);
    const k = hex(p.k), k2 = hex(p.k2);
    return person(p, {
      legs: p.a, boots: BOOT, torso: 'tunic', torsoSide: k, torsoTop: MAIL_T, sleeve: MAIL, pose,
      bands: [
        { col: k2, t0: -PI, t1: PI, z0: 3.25, z1: 3.6, out: 1.07, inK: 0.88 },
        { col: LEATH, top: '#9a7046', t0: -PI, t1: PI, z0: 4.35, z1: 4.75, out: 1.08, inK: 0.86 },
        { col: MAIL, top: MAIL_T, t0: -PI, t1: PI, z0: 6.95, z1: 7.7, out: 1.04, inK: 0.85 },
      ],
      heldR: [gSpear(R, 1, { top: 14.0, pennant: opt.pennant ? p.k : null })],
      items: [gShield(R, -1, { face: k, rim: k2, boss: k2, emblem: opt.emblem || 'none', emblemCol: k2 })],
      head: { hair: HAIR.brown, hat: hatHelm({ ridge: true, nasal: true, low: -0.1, k: 1.06 }) },
      r: 4.5, h: 16.3,
    });
  };

  M.ppl_archer = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const pose = { L: POSE.bow }, R = rig(HB, pose);
    const k = hex(p.k), jerk = mx(LEATH, p.a, 0.3);
    return person(p, {
      legs: mx(p.a, '#3a3530', 0.3), boots: '#4a3424', torso: 'tunic', torsoSide: jerk, torsoTop: sh(jerk, 0.18), sleeve: mx(p.b, '#a89878', 0.4), pose,
      bands: [{ col: '#3e2a1a', top: '#6a4a30', t0: -PI, t1: PI, z0: 4.35, z1: 4.75, out: 1.08 }, { col: k, t0: -PI, t1: PI, z0: 6.6, z1: 7.7, out: 1.08, inK: 0.84 }],
      hands: '#7a5638',
      heldL: [gBow(R, -1)],
      items: [gQuiver({ fletch: p.k2 })],
      head: { hair: HAIR.dark, hat: hatHood(k) },
      r: 4, h: 10.5,
    });
  };

  M.ppl_knight = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const pose = { R: POSE.sword }, R = rig(HB, pose);
    const k = hex(p.k), k2 = hex(p.k2);
    const prof = torsoProf('armor', HB);
    const plume = (D) => [tube(sh(k, -0.1), sh(k, 0.2), () => [[[D.headX + 0.1, 0, D.headZ + D.headR + 0.1, 0.42], [D.headX - 0.4, 0, D.headZ + D.headR + 1.0, 0.55], [D.headX - 1.35, 0, D.headZ + D.headR + 1.15, 0.48], [D.headX - 2.2, 0, D.headZ + D.headR + 0.35, 0.3]]], { ao: 0.1 })];
    return person(p, {
      legs: STEEL, boots: IRON, torso: prof, torsoSide: k, torsoTop: STEEL_T, sleeve: STEEL, hands: IRON, pose,
      bands: [
        { col: k2, t0: -0.28, t1: 0.28, z0: 3.6, z1: 7.0, out: 1.07, inK: 0.86 },
        { col: k2, t0: -0.95, t1: 0.95, z0: 5.9, z1: 6.35, out: 1.07, inK: 0.86 },
        { col: k2, t0: PI - 0.28, t1: PI + 0.28, z0: 3.6, z1: 7.0, out: 1.07, inK: 0.86 },
        { col: '#2e2018', top: '#6a4a30', t0: -PI, t1: PI, z0: 4.3, z1: 4.65, out: 1.09, inK: 0.86 },
        { col: STEEL, top: STEEL_T, t0: -PI, t1: PI, z0: 7.0, z1: 7.7, out: 1.05, inK: 0.84 },
      ],
      pauldron: (R2, s) => tube(STEEL, STEEL_T, () => [[[0, s * 1.85, 7.25, 0.78], [-0.1, s * 2.05, 6.9, 0.7]]], { ao: 0.15, bevel: true }),
      heldR: [gSword(R, 1, { hilt: k2, hiltT: sh(k2, 0.3), len: 5.0, elev: 1.22 })],
      items: [gCloak(HB, prof, k, { z0: 2.9, flare: 0.3 })],
      head: { hat: (D) => hatHelm({ low: 0.95, flatTop: true, visor: true })(D).concat(plume(D)) },
      r: 4.5, h: 12,
    });
  };

  M.ppl_mage = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const pose = { R: POSE.staff }, R = rig(HB, pose);
    const k = hex(p.k), k2 = hex(p.k2), robe = mx(k, '#1e1830', 0.15);
    return person(p, {
      legs: robe, boots: '#2e2420', torso: 'robe', torsoSide: robe, torsoTop: sh(robe, 0.15), sleeve: robe, pose, dims: { armR: 0.55 },
      bands: [
        { col: k2, t0: -PI, t1: PI, z0: 0.15, z1: 0.6, out: 1.05, inK: 0.88 },
        { col: k2, t0: -0.2, t1: 0.2, z0: 0.3, z1: 7.2, out: 1.05, inK: 0.86 },
        { col: k2, top: sh(k2, 0.2), t0: -PI, t1: PI, z0: 4.4, z1: 4.75, out: 1.08, inK: 0.86 },
      ],
      heldR: [gStaff(R, 1, { glow: p.g, claw: k2 })],
      head: { hair: HAIR.grey, beard: opt.beard ? HAIR.white : null, beardLen: 1.4, hat: hatWizard(sh(robe, -0.18), k2) },
      r: 4, h: 15.1,
    });
  };

  /* ---------------- faction troops ---------------- */
  M.trp_elf_warden = function (pal, opt) {
    const p = P(pal || 'elf'); opt = opt || {};
    const dims = { hip: 4.5, legR: 0.55, kneeR: 0.48, ankleR: 0.42, top: 8.1, shZ: 7.6, shY: 1.8, tRx: 0.98, tRy: 1.42, headZ: 9.55, headR: 1.08, upper: 1.6, fore: 1.5, stride: 1.35 };
    const D = Object.assign({}, HB, dims);
    const pose = { R: POSE.spear }, R = rig(D, pose);
    const iv = hex(p.b), tl = hex(p.t), k = hex(p.k), k2 = hex(p.k2), g = hex(p.g);
    const prof = torsoProf('armor', D);
    const crest = (D2) => [
      tube(sh(tl, -0.1), sh(tl, 0.25), () => [[[D2.headX + 0.9, 0, D2.headZ + 0.6, 0.2], [D2.headX + 0.2, 0, D2.headZ + D2.headR + 0.45, 0.32], [D2.headX - 1.0, 0, D2.headZ + D2.headR + 0.8, 0.26], [D2.headX - 2.0, 0, D2.headZ + D2.headR + 0.25, 0.12]]], { ao: 0 }),
      gp(g, '#ffffff', D2.headZ + 0.2, D2.headZ + 0.55, (c, z) => ball(c, z, D2.headX + D2.headR * 1.08, 0, D2.headZ + 0.38, 0.2), { flat: true, ao: 0, show: vis(1, 0, -0.2) }),
    ];
    return person(p, {
      dims, pose, legs: mx(p.a, '#4a5a48', 0.3), boots: iv, torso: prof, torsoSide: iv, torsoTop: sh(iv, 0.1), sleeve: mx(p.a, '#5a6a58', 0.2), hands: iv,
      bands: [
        { col: tl, t0: -0.5, t1: 0.5, z0: 4.6, z1: 7.2, out: 1.06, inK: 0.85 },
        { col: k2, t0: -PI, t1: PI, z0: 4.5, z1: 4.85, out: 1.08, inK: 0.86 },
        { col: tl, t0: -PI, t1: PI, z0: 3.45, z1: 3.8, out: 1.07, inK: 0.88 },
      ],
      pauldron: (R2, s) => tube(tl, sh(tl, 0.3), () => [[[0.45, s * 1.6, 7.75, 0.45], [-0.2, s * 2.0, 7.55, 0.62], [-0.95, s * 2.2, 7.15, 0.38]]], { ao: 0.1, bevel: true }),
      heldR: [gGlaive(R, 1, { acc: tl, blade: '#a6b6bc', bladeT: '#f6feff' })],
      items: [gCloak(D, prof, k, { z0: 1.2, flare: 0.6 }), hairBack('#e6d49a', D, 1.9)],
      head: { hair: '#e6d49a', style: 'long', hat: (D2) => hatHelm({ side: '#b8b2a0', top: '#fbf8ee', low: 0.15 })(D2).concat(crest(D2)) },
      r: 3.5, h: 16,
    });
  };

  M.trp_ice_berserker = function (pal, opt) {
    const p = P(pal || 'ice'); opt = opt || {};
    const dims = { tRx: 1.2, tRy: 1.82, shY: 2.15, legR: 0.68, kneeR: 0.6, ankleR: 0.52, legY: 0.8, armR: 0.58, handR: 0.56, headR: 1.15, headZ: 9.2, stride: 1.25 };
    const D = Object.assign({}, HB, dims);
    const pose = { R: POSE.axe }, R = rig(D, pose);
    const k = hex(p.k), skin = hex(p.skin), FUR = '#6e5c48', FURT = '#b8a284';
    const mantle = (D2) => [gp(FUR, FURT, 6.5, 8.2, (c, z) => { const u = (z - 6.5) / 1.7, k2 = Math.sqrt(Math.max(0.15, 1 - Math.pow(Math.max(0, u - 0.35) / 0.65, 2) * 0.75)); S.blob(c, -0.1, 0, 2.35 * k2, 4, 16, 0.18); }, { ao: 0.35, bevel: true,
      detail: (c) => { c.save(); c.strokeStyle = 'rgba(140,130,115,0.6)'; c.lineWidth = 0.16; c.beginPath(); for (let i = 0; i < 10; i++) { const t = i / 10 * TAU; c.moveTo(Math.cos(t) * 1.1, Math.sin(t) * 1.1); c.lineTo(Math.cos(t + 0.15) * 1.6, Math.sin(t + 0.15) * 1.6); } c.stroke(); c.restore(); } })];
    const horns = (D2) => hatHelm({ nasal: true, low: 0.1 })(D2).concat([tube('#cbbf9e', '#fbf4dc', () => [[[D2.headX, 0.95, D2.headZ + 0.65, 0.34], [D2.headX + 0.2, 1.75, D2.headZ + 1.0, 0.28], [D2.headX + 0.55, 2.1, D2.headZ + 1.9, 0.18], [D2.headX + 0.85, 1.95, D2.headZ + 2.6, 0.1]], [[D2.headX, -0.95, D2.headZ + 0.65, 0.34], [D2.headX + 0.2, -1.75, D2.headZ + 1.0, 0.28], [D2.headX + 0.55, -2.1, D2.headZ + 1.9, 0.18], [D2.headX + 0.85, -1.95, D2.headZ + 2.6, 0.1]]], { ao: 0 })]);
    return person(p, {
      dims, pose, legs: mx(p.a, '#3a4a5a', 0.3), boots: '#8a7e6e', torso: 'short', torsoSide: '#5a4030', torsoTop: '#8a6446', sleeve: skin,
      bands: [
        { col: k, top: sh(k, 0.25), t0: -PI, t1: PI, z0: 4.1, z1: 4.8, out: 1.09, inK: 0.86 },
        { col: '#d8b04a', t0: -0.25, t1: 0.25, z0: 4.2, z1: 4.7, out: 1.13, inK: 1.0 },
        { col: sh(skin, -0.05), top: skin, t0: -0.45, t1: 0.45, z0: 5.0, z1: 6.6, out: 1.05, inK: 0.85 },
      ],
      coreMid: mantle,
      heldR: [gAxe(R, 1)],
      head: { hair: HAIR.blond, beard: '#d8963e', beardLen: 1.3, hat: horns },
      r: 4.5, h: 12.1,
    });
  };

  M.trp_undead_skeleton = function (pal, opt) {
    const p = P(pal || 'undead'); opt = opt || {};
    const bone = hex(p.s && p.s !== PDEF.s ? p.s : '#d8cfb6');
    const BS = sh(bone, -0.3), BT = sh(bone, 0.25);
    const dims = { legR: 0.32, kneeR: 0.38, ankleR: 0.27, bootH: 0.7, armR: 0.28, handR: 0.33, headR: 1.05, headZ: 9.25, neckR: 0.28, tRx: 0.9, tRy: 1.2, stride: 1.15, swing: 0.8 };
    const D = Object.assign({}, HB, dims);
    const pose = { R: POSE.sword, L: POSE.shield }, R = rig(D, pose);
    const k = hex(p.k), g = hex(p.g);
    const rust = '#7a5236', rustT = '#b88a60';
    // loincloth: ragged k skirt at the pelvis
    const skirt = [[3.2, 1.05, 1.3], [3.9, 1.0, 1.25], [4.6, 0.85, 1.1]];
    const groups = [];
    const ribs = [[5.25, 0.84, 1.1], [6.15, 0.98, 1.28], [7.05, 0.95, 1.3]];
    const ribPart = (r) => ({ z0: r[0], z1: r[0], side: BT, top: BT, stroke: 0.55, bevel: false, ao: 0, shape: (c) => S.ell(c, 0.05, 0, r[1], r[2]) });
    const skull = [
      tube(BS, BT, () => [[[-0.15, 0, 7.5, 0.26], [D.headX, 0, D.headZ - 0.6, 0.26]]], { ao: 0 }),
      { z0: D.headZ - 0.95, z1: D.headZ + D.headR, side: sh(bone, -0.08), top: BT, ao: 0.2, shape: (c, zt) => { const z = lerp(D.headZ - 0.95, D.headZ + D.headR, zt), d = (z - D.headZ) / D.headR, kk = Math.sqrt(Math.max(0.2, 1 - d * d)); S.ell(c, D.headX + (z < D.headZ - 0.4 ? 0.25 : 0), 0, D.headR * 1.04 * kk * (z < D.headZ - 0.4 ? 0.8 : 1), D.headR * 0.92 * kk * (z < D.headZ - 0.4 ? 0.78 : 1)); } },
    ];
    for (const s of [1, -1]) {
      skull.push(gp('#0e0c10', '#0e0c10', D.headZ - 0.4, D.headZ + 0.42, (c, z) => ball(c, z, D.headX + D.headR * 0.8, s * 0.43, D.headZ + 0.02, 0.44), { ao: 0, show: vis(1, s * 0.55, 0) }));
      skull.push(gp(g, '#ffffff', D.headZ - 0.25, D.headZ + 0.3, (c, z) => ball(c, z, D.headX + D.headR * 0.98, s * 0.43, D.headZ + 0.04, 0.27), { flat: true, ao: 0, show: vis(1, s * 0.55, 0),
        detail: (c) => glow(c, g, D.headX + D.headR * 0.98, s * 0.43, 0.48, '#f4ffe8', 0.6) }));
    }
    skull.push(gp('#1a161a', '#1a161a', D.headZ - 0.85, D.headZ - 0.45, (c, z) => { S.ell(c, D.headX + D.headR * 0.86, 0, 0.18, 0.55); }, { ao: 0, show: vis(1, 0, 0) }));
    groups.push({ key: (a) => dep(a, -0.45, 0), parts: [tube(BS, BT, () => [[[-0.35, 0, 4.2, 0.3], [-0.42, 0, 6.2, 0.28], [-0.3, 0, 7.6, 0.28]]], { ao: 0.1 }), tube(BS, BT, () => [[[-0.1, 1.45, 7.35, 0.3], [-0.2, 0, 7.55, 0.28], [-0.1, -1.45, 7.35, 0.3]]], { ao: 0 })] });
    groups.push({ key: (a) => dep(a, 0.35, 0), parts: ribs.map(ribPart).concat([tube(BS, BT, () => [[[0.95, 0, 5.4, 0.2], [1.0, 0, 7.0, 0.22]]], { ao: 0 })]) });
    groups.push({ key: () => 0.6, parts: skull });
    return person(p, {
      dims, pose, legs: bone, boots: bone, torso: skirt, torsoSide: k, torsoTop: sh(k, 0.15), jag: 0.32, torsoAo: 0.25, sleeve: bone, hands: bone,
      heldR: [gSword(R, 1, { blade: rust, bladeT: rustT, hilt: IRON, hiltT: IRON_T, len: 3.8, elev: 0.75 })],
      items: [gShield(R, -1, { r: 1.7, face: mx(k, '#3a3030', 0.4), rim: rust, boss: IRON, emblem: 'band', emblemCol: IRON })].concat(groups),
      noHead: true,
      r: 5.5, h: 10.3,
    });
  };
  M.trp_undead_ghoul = function (pal, opt) {
    const p = P(pal || 'undead'); opt = opt || {};
    const skin = hex(mx(p.skin, '#6e8060', 0.55)), skinT = sh(skin, 0.22), k = hex(p.k), g = hex(p.g);
    const dims = { hip: 3.7, legR: 0.48, kneeR: 0.44, ankleR: 0.38, kneeF: 0.7, stride: 1.0, lift: 0.7, shX: 1.3, shY: 1.55, shZ: 6.35, top: 6.9,
      armR: 0.38, handR: 0.44, headX: 2.2, headZ: 7.15, headR: 1.12, neckR: 0.45, tRx: 1.0, tRy: 1.35 };
    const D = Object.assign({}, HB, dims);
    const claw = (an, R2, s) => { const sw = R2.swing(s, an) * 0.55; return { e: [1.9 + sw * 0.4, s * 2.05, 4.6], h: [2.55 + sw, s * 1.8, 2.75] }; };
    const pose = { R: claw, L: claw }, R = rig(D, pose);
    const prof = [[3.25, 1.05, 1.25, 0.05], [4.2, 0.95, 1.18, 0.2], [5.2, 1.05, 1.45, 0.6], [6.2, 1.05, 1.55, 1.1], [6.9, 0.62, 0.95, 1.4]];
    const claws = (s) => ({ over: [tube(BONE, BONE_T, (an) => { const h = R.arm(s, an).h; return [[-0.3, 0, 0.3].map((o) => [[h[0] + 0.2, h[1] + o, h[2] - 0.1, 0.17], [h[0] + 0.75, h[1] + o * 1.4, h[2] - 0.6, 0.13], [h[0] + 0.85, h[1] + o * 1.5, h[2] - 1.15, 0.08]])][0]; }, { ao: 0 })] });
    return person(p, {
      dims, pose, legs: skin, boots: sh(skin, -0.2), torso: prof, torsoSide: skin, torsoTop: skinT, sleeve: skin, hands: skin,
      torsoDetail: (c) => { S.lines(c, 'rgba(40,50,30,0.6)', 0.18, [0.6, -0.6, 1.0, -0.2, 0.6, 0.6, 1.0, 0.2, 0.7, -0.9, 1.25, -0.5, 0.7, 0.9, 1.25, 0.5]); },
      bands: [
        { col: k, top: sh(k, 0.2), t0: -PI, t1: PI, z0: 3.2, z1: 4.4, out: 1.08, inK: 0.85 },
        { col: sh(skin, -0.25), t0: 0.35, t1: 0.9, z0: 5.2, z1: 5.5, out: 1.04, inK: 0.9 },
        { col: sh(skin, -0.25), t0: -0.9, t1: -0.35, z0: 5.2, z1: 5.5, out: 1.04, inK: 0.9 },
      ],
      heldR: [claws(1)], heldL: [claws(-1)],
      head: { headSide: sh(skin, -0.22), headTop: sh(skin, 0.05), eyes: g, eyeFlat: true, eyeR: 0.27, eyeGlow: true, hair: '#4a4842', style: 'short', fringe: -0.5 },
      coreMid: () => [tube(sh(skin, -0.2), skinT, () => [[[-0.75, 0, 5.0, 0.32], [-0.35, 0, 6.2, 0.36], [0.6, 0, 7.05, 0.34], [1.4, 0, 7.25, 0.3]]], { ao: 0.1, show: vis(-1, 0, -0.25) })],
      r: 5, h: 8.4,
    });
  };

  /* ---------------- monsters ---------------- */
  M.mon_ogre = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const SK = '#7a5e52', SKT = '#c8a08a';
    const dims = { hip: 3.3, legR: 0.88, kneeR: 0.78, ankleR: 0.66, legY: 0.95, stride: 0.9, lift: 0.5, bootH: 1.0,
      shY: 2.45, shZ: 7.25, upper: 1.7, fore: 1.65, armR: 0.78, handR: 0.82, swing: 0.6,
      tRx: 1.6, tRy: 2.0, top: 7.95, headX: 0.5, headZ: 9.0, headR: 1.2, neckR: 0.7 };
    const D = Object.assign({}, HB, dims);
    const clubPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.1; return { e: [0.35, s * 2.8, 5.6], h: [1.25 + w, s * 2.45, 6.5] }; };
    const pose = { R: clubPose }, R = rig(D, pose);
    const prof = [[3.9, 1.75, 2.05], [4.6, 2.05, 2.25], [5.5, 2.1, 2.3], [6.4, 1.8, 2.25], [7.2, 1.45, 2.3], [7.65, 1.15, 2.0], [7.95, 0.7, 1.25]];
    const club = { under: [
      tube('#5e4026', '#9a6c42', (an) => { const h = R.arm(1, an).h; return [[[h[0] + 0.55, h[1], h[2] - 0.5, 0.42], [h[0] - 0.6, h[1] + 0.1, h[2] + 1.6, 0.6], [h[0] - 1.7, h[1] + 0.2, h[2] + 3.6, 0.95]]]; }, { ao: 0.1 }),
      tube('#4a3420', '#8a6040', (an) => { const h = R.arm(1, an).h; return [[[h[0] - 1.2, h[1] + 0.75, h[2] + 2.9, 0.3]], [[h[0] - 1.6, h[1] - 0.55, h[2] + 3.4, 0.3]], [[h[0] - 2.25, h[1] + 0.3, h[2] + 3.9, 0.32]]]; }, { ao: 0 }),
    ] };
    const loin = [stack('#4e3220', '#8a5a36', [[2.4, 1.65, 1.9], [3.6, 1.6, 1.9], [4.3, 1.55, 1.85]], { ao: 0.35, jag: 0.14 })];
    const tusks = (D2) => [tube('#d8cca8', '#fff8e4', () => [1, -1].map((s) => [[D2.headX + 0.95, s * 0.5, D2.headZ - 0.75, 0.26], [D2.headX + 1.2, s * 0.58, D2.headZ - 0.1, 0.15]]), { ao: 0, show: vis(1, 0, -0.35) }),
      tube('#1e1814', '#4a3a30', () => [[[D2.headX - 0.45, 0, D2.headZ + 1.0, 0.48], [D2.headX - 0.9, 0, D2.headZ + 1.55, 0.36], [D2.headX - 1.45, 0, D2.headZ + 1.2, 0.22]]], { ao: 0 }),
      tube(sh(SK, -0.1), SKT, () => [[[D2.headX + 0.1, 1.05, D2.headZ + 0.1, 0.3], [D2.headX - 0.2, 1.65, D2.headZ + 0.45, 0.14]], [[D2.headX + 0.1, -1.05, D2.headZ + 0.1, 0.3], [D2.headX - 0.2, -1.65, D2.headZ + 0.45, 0.14]]], { ao: 0 })];
    return person(p, {
      dims, pose, skin: SK, legs: SK, boots: '#5a4a32', torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      torsoDetail: (c) => { S.dot(c, 'rgba(90,70,40,0.5)', 1.0, 0, 0.18); },
      bands: [
        { col: '#3a2416', top: '#6a4a30', t0: (z) => -1.05 + (z - 4.4) * 0.62, t1: (z) => -0.6 + (z - 4.4) * 0.62, z0: 4.4, z1: 7.7, out: 1.06, inK: 0.86 },
        { col: '#3a2416', top: '#6a4a30', t0: (z) => PI + 0.6 - (z - 4.4) * 0.62, t1: (z) => PI + 1.05 - (z - 4.4) * 0.62, z0: 4.4, z1: 7.7, out: 1.06, inK: 0.86 },
      ],
      heldR: [club],
      items: [{ key: () => -0.45, parts: loin }],
      head: { headSide: sh(SK, -0.05), headTop: SKT, eyes: '#ffdf6a', eyeFlat: true, eyeR: 0.17, nose: 0.32, style: 'bald', hat: tusks },
      r: 4.2, h: 11.1, scale: 1.75,
    });
  };

  M.mon_troll = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const SK = '#5c6c56', SKT = '#9aac8c', MOSS = '#3e5a22', MOSST = '#86a848';
    const dims = { hip: 4.7, legR: 0.5, kneeR: 0.46, ankleR: 0.4, legY: 0.85, stride: 1.45, lift: 0.95, kneeF: 0.45, bootH: 0.9,
      shX: 0.75, shY: 1.9, shZ: 7.3, upper: 1.9, fore: 2.0, armR: 0.42, handR: 0.62, swing: 1.1,
      tRx: 0.92, tRy: 1.3, top: 7.85, headX: 1.45, headZ: 8.45, headR: 0.95, neckR: 0.45 };
    const prof = [[4.3, 0.95, 1.25, 0], [5.3, 0.85, 1.15, 0.15], [6.5, 1.0, 1.5, 0.45], [7.3, 0.95, 1.65, 0.7], [7.85, 0.55, 0.95, 0.85]];
    const moss = [gp(MOSS, MOSST, 6.9, 8.0, (c, z) => { const kk = 1 - (z - 6.9) / 1.1 * 0.45; S.blob(c, 0.55, 0.9, 0.95 * kk, 3, 7, 0.35); S.blob(c, 0.4, -1.1, 0.8 * kk, 5, 7, 0.35); S.blob(c, -0.2, 0.0, 0.7 * kk, 8, 7, 0.35); }, { ao: 0.2, bevel: true })];
    const headX = (D2) => [
      tube(SK, SKT, () => [[[D2.headX + 0.5, 0.7, D2.headZ + 0.2, 0.26], [D2.headX + 0.2, 1.55, D2.headZ + 0.45, 0.18], [D2.headX - 0.1, 1.95, D2.headZ + 0.6, 0.1]], [[D2.headX + 0.5, -0.7, D2.headZ + 0.2, 0.26], [D2.headX + 0.2, -1.55, D2.headZ + 0.45, 0.18], [D2.headX - 0.1, -1.95, D2.headZ + 0.6, 0.1]]], { ao: 0 }),
      gp(MOSS, MOSST, D2.headZ + 0.5, D2.headZ + 1.3, (c, z) => { const kk = 1 - (z - D2.headZ - 0.5) / 0.8 * 0.5; S.blob(c, D2.headX - 0.3, 0, 0.95 * kk, 11, 8, 0.4); }, { ao: 0.1, bevel: true }),
    ];
    const TR = rig(Object.assign({}, HB, dims), {});
    const claws = (s) => ({ over: [tube('#2a2a22', '#6a6a58', (an) => { const h = TR.arm(s, an).h; return [-0.3, 0, 0.3].map((o) => [[h[0] + 0.3, h[1] + o, h[2] - 0.2, 0.14], [h[0] + 0.7, h[1] + o * 1.3, h[2] - 0.75, 0.08]]); }, { ao: 0 })] });
    return person(p, {
      dims, skin: SK, legs: SK, boots: sh(SK, -0.2), torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      bands: [{ col: '#4a3a24', top: '#7a6440', t0: -PI, t1: PI, z0: 4.3, z1: 5.2, out: 1.08, inK: 0.84 }],
      coreMid: () => moss,
      heldR: [claws(1)], heldL: [claws(-1)],
      head: { headSide: sh(SK, -0.05), headTop: SKT, eyes: '#ff6a2a', eyeFlat: true, eyeR: 0.15, nose: 0.36, style: 'bald', hat: headX },
      r: 4, h: 9.8, scale: 2.45,
    });
  };

  M.mon_giant = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const SK = '#c8906a', SKT = '#f0c4a0', HIDE = '#7a5634', HIDET = '#b88a58', FUR = '#857c6c', FURT = '#c4bcac', HR = '#6a3a1a';
    const dims = { tRx: 1.25, tRy: 1.8, shY: 2.1, legR: 0.7, kneeR: 0.62, ankleR: 0.55, legY: 0.82, armR: 0.6, handR: 0.6, headR: 1.12, stride: 1.15, swing: 0.75 };
    const D = Object.assign({}, HB, dims);
    const trunkPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.4, s * 2.45, 5.75], h: [1.05 + w, s * 2.0, 6.9] }; };
    const pose = { R: trunkPose }, R = rig(D, pose);
    const trunk = { under: [
      tube('#4e3a28', '#86684a', (an) => { const h = R.arm(1, an).h; return [[[h[0] + 0.9, h[1] - 0.1, h[2] - 0.65, 0.5], [h[0] - 1.2, h[1] + 0.1, h[2] + 2.3, 0.72], [h[0] - 2.7, h[1] + 0.2, h[2] + 4.0, 0.95]]]; }, { ao: 0.1 }),
      tube('#3e2e20', '#6e563c', (an) => { const h = R.arm(1, an).h; return [[[h[0] - 1.5, h[1] + 0.6, h[2] + 2.8, 0.25], [h[0] - 1.4, h[1] + 1.35, h[2] + 3.4, 0.16]], [[h[0] - 2.4, h[1] - 0.5, h[2] + 3.7, 0.24], [h[0] - 2.0, h[1] - 1.1, h[2] + 4.3, 0.15]]]; }, { ao: 0 }),
      tube('#4a7a2a', '#9ac85a', (an) => { const h = R.arm(1, an).h; return [[[h[0] - 1.4, h[1] + 1.45, h[2] + 3.55, 0.42]], [[h[0] - 2.0, h[1] - 1.25, h[2] + 4.45, 0.38]]]; }, { ao: 0 }),
    ] };
    const mantle = () => [gp(FUR, FURT, 6.7, 8.1, (c, z) => { const u = (z - 6.7) / 1.4, kk = Math.sqrt(Math.max(0.2, 1 - Math.pow(Math.max(0, u - 0.3) / 0.7, 2) * 0.7)); S.blob(c, -0.15, 0, 2.15 * kk, 9, 14, 0.2); }, { ao: 0.3, bevel: true })];
    return person(p, {
      dims, pose, skin: SK, legs: SK, boots: FUR, torso: 'tunic', torsoSide: HIDE, torsoTop: HIDET, jag: 0.22, sleeve: SK, hands: SK,
      torsoDetail: (c) => { blobs(c, 'rgba(60,36,18,0.6)', [[0.5, 0.5, 0.25, 1], [-0.4, -0.6, 0.22, 2], [0.2, -1.0, 0.2, 3]]); },
      bands: [{ col: ROPE, top: ROPE_T, t0: -PI, t1: PI, z0: 4.3, z1: 4.7, out: 1.08, inK: 0.86 }, { col: '#5a3a20', t0: 0.2, t1: 0.9, z0: 3.4, z1: 6.4, out: 1.05, inK: 0.88 }, { col: '#5a3a20', t0: -2.4, t1: -1.6, z0: 3.4, z1: 6.0, out: 1.05, inK: 0.88 }],
      coreMid: mantle,
      heldR: [trunk],
      head: { hair: HR, style: 'long', beard: HR, beardLen: 1.2, nose: 0.22 },
      items: [hairBack(HR, D, 1.6)],
      r: 4.2, h: 11.9, scale: 3.4,
    });
  };

  M.mon_bandit = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const CL = '#555a42', CLT = '#8e9670', LE = '#74502f';
    const cbR = (an, R2, s) => ({ e: [0.05, s * 1.95, 5.5], h: [0.95, s * 0.75, 5.95] });
    const cbL = (an, R2, s) => ({ e: [0.85, s * 1.9, 5.55], h: [2.2, s * -0.05, 6.1] });
    const pose = { R: cbR, L: cbL };
    const D = HB, prof = torsoProf('tunic', D);
    const xbow = { key: (a) => dep(a, 2.2, 0.3) + 0.6, parts: [
      tube('#8a5a30', '#c8905a', () => [[[0.55, 0.45, 5.85, 0.32], [3.5, 0.3, 6.35, 0.32]]], { ao: 0 }),
      tube('#7a828a', '#e0e6ec', () => [[[2.75, -1.55, 6.4, 0.24], [3.25, 0.3, 6.5, 0.28], [2.75, 2.15, 6.4, 0.24]]], { ao: 0 }),
      tube('#d8d0bc', '#f8f4e8', () => [[[2.75, -1.5, 6.45, 0.1], [1.8, 0.3, 6.45, 0.1], [2.75, 2.1, 6.45, 0.1]]], { ao: 0 }),
      tube('#6a6e74', '#c8ced4', () => [[[1.9, 0.3, 6.62, 0.12], [3.3, 0.3, 6.78, 0.12]]], { ao: 0 }),
    ] };
    return person(p, {
      pose, legs: '#463f3a', boots: '#2a221c', torso: 'tunic', torsoSide: LE, torsoTop: '#8a6a4a', sleeve: CL, hands: '#3a2e24',
      bands: [{ col: '#2a1e16', top: '#5a4030', t0: -PI, t1: PI, z0: 4.3, z1: 4.7, out: 1.08 }, { col: '#2a1e16', t0: 0.5, t1: 1.0, z0: 4.5, z1: 7.4, out: 1.07, inK: 0.88 }],
      items: [gCloak(D, prof, CL, { z0: 3.0 }), xbow],
      head: { hair: HAIR.dark, mask: '#8e2a20', hat: hatHood(CL) },
      r: 4, h: 10.5,
    });
  };

  /* ================================================================
   * SIEGE — catapult cart (24 dirs, 4 frames rolling wheels)
   * ================================================================ */
  M.sg_catapult_cart = function (pal, opt) {
    const p = P(pal); opt = opt || {};
    const wood = sh(p.w, 0.1), woodT = sh(wood, 0.38), woodD = sh(wood, -0.22), k = hex(p.k), k2 = hex(p.k2);
    const WR = 2.45, WZ = 2.5, WX = 5.4, WY = 4.55, NSP = 6;
    const G = [];
    // chassis
    const chassis = [
      gp(woodD, wood, 3.1, 4.4, (c) => { S.rrect(c, -8.4, 2.5, 16.6, 1.0, 0.25); S.rrect(c, -8.4, -3.5, 16.6, 1.0, 0.25); }, { ao: 0.3, bevel: true,
        detail: (c) => { S.lines(c, 'rgba(30,18,8,0.5)', 0.14, [-5, 2.5, -5, 3.5, 0, 2.5, 0, 3.5, 5, 2.5, 5, 3.5, -5, -2.5, -5, -3.5, 0, -2.5, 0, -3.5, 5, -2.5, 5, -3.5]); for (const x of [-7.6, 7.4]) for (const y of [3, -3]) S.dot(c, '#2a2a2e', x, y, 0.22); } }),
      gp(woodD, wood, 3.4, 4.2, (c) => { S.rect(c, -8.0, -2.6, 1.0, 5.2); S.rect(c, -1.9, -2.6, 1.0, 5.2); S.rect(c, 6.7, -2.6, 1.0, 5.2); }, { ao: 0.3, bevel: true }),
      gp(IRON, IRON_T, 2.2, 2.8, (c) => { S.rect(c, WX - 0.3, -WY + 0.4, 0.6, WY * 2 - 0.8); S.rect(c, -WX - 0.3, -WY + 0.4, 0.6, WY * 2 - 0.8); }, { ao: 0.1 }),
      // sideboards painted in the faction colour (sit on the side beams, rear half)
      gp(sh(k, -0.1), sh(k, 0.2), 4.4, 5.6, (c) => { S.rect(c, -8.0, 2.65, 7.0, 0.7); S.rect(c, -8.0, -3.35, 7.0, 0.7); }, { ao: 0.2, bevel: true }),
      band(k2, null, (z, t, kk) => [Math.max(-8.1, Math.min(-0.9, -4.5 + Math.cos(t) * 4.2 * kk)), Math.sin(t) * 3.42 * kk], -PI, PI, 4.85, 5.15, { out: 1.0, inK: 0.93 }),
      // deck planks at the rear
      gp(woodD, woodT, 3.6, 4.0, (c) => S.rect(c, -7.9, -2.55, 5.9, 5.1), { ao: 0.2, bevel: true, detail: (c) => S.lines(c, 'rgba(30,18,8,0.45)', 0.12, [-7.9, -1.3, -2, -1.3, -7.9, 0, -2, 0, -7.9, 1.3, -2, 1.3]) }),
      // torsion bundle (rope skein) across the frame
      tube(ROPE, ROPE_T, () => [[[-3.0, -2.6, 4.7, 0.75], [-3.0, 2.6, 4.7, 0.75]]], { ao: 0.2 }),
      // uprights + braces
      tube(woodD, woodT, () => [[[1.2, 2.55, 4.0, 0.42], [1.0, 2.2, 10.0, 0.36]], [[1.2, -2.55, 4.0, 0.42], [1.0, -2.2, 10.0, 0.36]], [[4.6, 2.75, 4.2, 0.3], [1.15, 2.3, 8.6, 0.28]], [[4.6, -2.75, 4.2, 0.3], [1.15, -2.3, 8.6, 0.28]]], { ao: 0.15 }),
      // padded stop bar in the faction colour
      tube(woodD, woodT, () => [[[1.0, -2.6, 9.95, 0.42], [1.0, 2.6, 9.95, 0.42]]], { ao: 0.1 }),
      tube(sh(k, -0.1), sh(k, 0.2), () => [[[1.05, -1.2, 9.95, 0.62], [1.05, 1.2, 9.95, 0.62]]], { ao: 0.1 }),
      // winch drum at the rear with spoked handles
      tube(woodD, woodT, () => [[[-6.6, -2.4, 4.9, 0.55], [-6.6, 2.4, 4.9, 0.55]]], { ao: 0.15 }),
      gp(woodD, woodT, 3.6, 6.3, (c, z) => { for (const y of [-2.75, 2.75]) plane(c, z, -6.6, y, 0, 0.5, -1.4, 1.4, (u, zz) => { const v = zz - 4.9; const r = Math.hypot(u, v); return (r < 1.3 && (Math.abs(u) < 0.17 || Math.abs(v) < 0.17)) || r < 0.4; }); }, { ao: 0.1 }),
      // throwing arm resting against the stop bar, bucket of stones on top
      tube(sh(wood, 0.12), sh(woodT, 0.1), () => [[[-3.4, 0, 4.9, 0.58], [-0.6, 0, 8.3, 0.5], [1.55, 0, 10.9, 0.44]]], { ao: 0.15 }),
      tube(IRON, IRON_T, () => [[[-2.55, 0, 5.85, 0.64], [-2.4, 0, 6.15, 0.64]], [[-0.95, 0, 7.75, 0.56], [-0.8, 0, 8.05, 0.56]], [[0.6, 0, 9.65, 0.5], [0.75, 0, 9.95, 0.5]]], { ao: 0 }),
      gp(woodD, woodT, 10.5, 12.2, (c, z) => { const u = (z - 10.5) / 1.7; S.ell(c, 1.9 - u * 0.2, 0, 1.0 + u * 0.5, 1.05 + u * 0.55); }, { ao: 0.25, bevel: true, detail: (c) => { S.dot(c, '#2a1a10', 1.7, 0, 1.1); } }),
      gp('#6e6a64', '#c8c2b8', 11.8, 12.9, (c, z) => { ball(c, z, 1.45, -0.45, 12.25, 0.52); ball(c, z, 1.95, 0.45, 12.2, 0.5); ball(c, z, 1.6, 0.3, 12.5, 0.44); }, { ao: 0 }),
      // rope from the winch to the arm
      tube('#c8ac78', '#efdcae', () => [[[-6.4, 0, 5.4, 0.13], [-2.3, 0, 6.0, 0.13]]], { ao: 0 }),
    ];
    G.push({ key: () => 0, parts: chassis });
    // banner pole at the rear corner
    const flagPh = (an) => Math.sin(cyc(an)) * 0.25;
    G.push({ key: (a) => dep(a, -7.6, -2.9), parts: [
      tube(sh(wood, 0.1), sh(woodT, 0.2), () => [[[-7.6, -2.95, 3.8, 0.3], [-7.6, -2.95, 12.7, 0.26]]], { ao: 0.1 }),
      tube(GOLD, GOLD_T, () => [[[-7.6, -2.95, 12.85, 0.34]]], { ao: 0 }),
      gp(sh(k, -0.1), sh(k, 0.15), 9.6, 12.4, (c, z, an) => plane(c, z, -7.6, -2.95, PI + flagPh(an), 0.5, 0.1, 3.2, (u, zz) => { const v = zz - 9.6 - 0.12 * u; return v > 0 && v < 2.6 - u * 0.2 && !(u > 2.4 && Math.abs(v - 1.2 + 0.1 * u) < (u - 2.4) * 0.9); }, 0.1), { ao: 0.05 }),
      gp(sh(k2, -0.1), k2, 10.6, 11.2, (c, z, an) => plane(c, z, -7.6, -2.95, PI + flagPh(an), 0.58, 0.3, 2.3, () => true), { ao: 0 }),
    ] });
    // wheels: iron tyre, wooden felloe, rotating spokes, hub
    for (const wx of [WX, -WX]) for (const wy of [WY, -WY]) {
      const ins = (r0, r1, spokes) => (an) => (u, z) => {
        const v = z - WZ, r = Math.hypot(u, v);
        if (r >= r0 && r <= r1) return true;
        if (!spokes || r > r0 + 0.05) return false;
        if (r < 0.62) return true;
        const rot = -an * TAU / NSP;
        for (let i = 0; i < NSP; i++) { const al = i * TAU / NSP + rot; if (Math.abs(-u * Math.sin(al) + v * Math.cos(al)) < 0.2 && u * Math.cos(al) + v * Math.sin(al) > 0) return true; }
        return false;
      };
      const tyre = ins(WR - 0.38, WR, false), felloe = ins(WR - 0.85, WR - 0.3, true);
      G.push({ key: (a) => dep(a, wx, wy), shade: 0.03, parts: [
        gp(woodD, woodT, WZ - WR + 0.3, WZ + WR - 0.3, (c, z, an) => plane(c, z, wx, wy, 0, 0.6, -WR, WR, felloe(an), 0.08), { ao: 0.1 }),
        gp(IRON, IRON_T, 0, WZ + WR, (c, z, an) => plane(c, z, wx, wy, 0, 0.72, -WR - 0.05, WR + 0.05, tyre(an), 0.08), { ao: 0.05 }),
        tube(IRON, IRON_T, () => [[[wx, wy - Math.sign(wy) * 0.45, WZ, 0.45], [wx, wy + Math.sign(wy) * 0.5, WZ, 0.4]]], { ao: 0 }),
      ] });
    }
    return { r: 12, h: 13.2, parts: assemble(G), style: 'unit' };
  };

  /* ================================================================
   * kit: the rig and primitives, shared with the other creature files
   * (models_beasts*.js, models_giants.js) so every creature is built the same way
   * ================================================================ */
  AS.UnitKit = { P, PDEF, HAIR, lerp, hex, sh, mx, css, cyc, lum, lift, viewA, dep, vis, probe, proxy, assemble, ball, sweep, zBounds, tube, gp, plane, capCut, shellCut,
    profAt, stack, ringProf, visClip, band, patch, glow, clipped, blobs, HB, rig, legLines, armLines, torsoProf, person, headParts, hairCap, hairBack,
    hatStraw, hatHelm, hatHood, hatWizard, hatKerchief, hatCap, handAt, gSpear, gShield, gBow, gQuiver, gSword, gAxe, gGlaive, gStaff, gHoe, gBasket, gCloak,
    bodyK, bodyPt, bodyRing, bodyPart, quad, legSet, sideEye,
    BOOT, LEATH, STEEL, STEEL_T, MAIL, MAIL_T, IRON, IRON_T, WOOD, WOOD_T, STRAW, STRAW_T, ROPE, ROPE_T, BONE, BONE_T, GOLD, GOLD_T };

  /* ================================================================
   * gallery
   * ================================================================ */
  const A4 = { dirs: 16, anims: 4 };
  const it = (name, gen, pal, o) => Object.assign({ name, gen, pal }, A4, o || {});
  (AS.Gallery = AS.Gallery || []).push(
    { group: 'Animals', bg: 'neutral', items: [
      it('cow', 'ani_cow', 'neutral'), it('sheep', 'ani_sheep', 'neutral'), it('goat', 'ani_goat', 'neutral'), it('deer', 'ani_deer', 'neutral'),
      it('boar', 'ani_boar', 'neutral'), it('horse', 'ani_horse', 'neutral'), it('horse saddled', 'ani_horse', 'human', { opt: { saddle: true } }), it('wolf', 'ani_wolf', 'neutral'),
    ] },
    { group: 'People', bg: 'human', items: [
      it('peasant hoe', 'ppl_peasant', 'human'), it('peasant basket', 'ppl_peasant', 'human', { opt: { tool: 'basket' } }),
      it('villager v0', 'ppl_villager', 'human', { opt: { v: 0 } }), it('villager v1', 'ppl_villager', 'human', { opt: { v: 1 } }),
      it('villager v2', 'ppl_villager', 'human', { opt: { v: 2 } }), it('villager v3', 'ppl_villager', 'human', { opt: { v: 3 } }),
      it('soldier', 'ppl_soldier', 'human'), it('archer', 'ppl_archer', 'human'), it('knight', 'ppl_knight', 'human'), it('mage', 'ppl_mage', 'human'),
    ] },
    { group: 'Elf troops', bg: 'elf', items: [
      it('elf warden', 'trp_elf_warden', 'elf'), it('soldier (elf)', 'ppl_soldier', 'elf'), it('archer (elf)', 'ppl_archer', 'elf'), it('knight (elf)', 'ppl_knight', 'elf'), it('mage (elf)', 'ppl_mage', 'elf'), it('villager (elf)', 'ppl_villager', 'elf', { opt: { v: 1 } }),
    ] },
    { group: 'Ice troops', bg: 'ice', items: [
      it('ice berserker', 'trp_ice_berserker', 'ice'), it('soldier (ice)', 'ppl_soldier', 'ice'), it('archer (ice)', 'ppl_archer', 'ice'), it('knight (ice)', 'ppl_knight', 'ice'), it('mage (ice)', 'ppl_mage', 'ice'), it('peasant (ice)', 'ppl_peasant', 'ice'),
    ] },
    { group: 'Undead troops', bg: 'undead', items: [
      it('skeleton', 'trp_undead_skeleton', 'undead'), it('ghoul', 'trp_undead_ghoul', 'undead'), it('soldier (undead)', 'ppl_soldier', 'undead'), it('archer (undead)', 'ppl_archer', 'undead'), it('knight (undead)', 'ppl_knight', 'undead'), it('mage (undead)', 'ppl_mage', 'undead'),
    ] },
    { group: 'Monsters', bg: 'neutral', items: [
      it('ogre', 'mon_ogre', 'neutral'), it('troll', 'mon_troll', 'neutral'), it('giant', 'mon_giant', 'neutral'), it('bandit', 'mon_bandit', 'neutral'),
    ] },
    { group: 'Siege', bg: 'human', items: [
      it('catapult cart', 'sg_catapult_cart', 'human', { dirs: 24 }), it('catapult cart (undead)', 'sg_catapult_cart', 'undead', { dirs: 24 }),
    ] }
  );
})(window.AS);
