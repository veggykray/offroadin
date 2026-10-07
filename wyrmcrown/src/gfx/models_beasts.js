/* WYRMCROWN — wildlife and monsters of Aldermere and Sylvara (models_beasts.js).
 * Built on the creature kit exported by models_units.js (AS.UnitKit): swept-sphere
 * tubes, profile stacks, wall decals and the view-sorted assembler. Every model is
 * 16 directions × 4 frame walk cycle, +x = facing, natural colours (pal ignored).
 * opt.v (0, 1, 2) picks a visible variant of the species: size, horn / antler
 * shape, markings, colour shift, scars — a herd must not look cloned.
 *
 * Aldermere (rich human countryside): bst_greatstag, bst_aurochs, bst_moorhound,
 *   bst_bear, crt_hare, crt_fox.
 * Sylvara (ancient magical woodland): bst_elderhorn, bst_glimmerdeer,
 *   bst_greatbeetle, bst_marshcroaker, bst_spindlelurker, bst_treeshambler.
 *
 * Sizes are world units before the variant `scale` (the forge multiplies r and h
 * by it); a person is ~10 tall, the deer 15.5, the horse 14.2, the wolf r 7. */
'use strict';
(function (AS) {
  const K = AS.UnitKit;
  const { lerp, hex, sh, mx, css, cyc, viewA, dep, vis, assemble, ball, tube, gp, stack, ringProf, band, patch, glow, clipped, blobs,
    bodyRing, bodyPart, quad, legSet, sideEye } = K;
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes, PI = Math.PI;
  const M = AS.Models = AS.Models || {};

  /* ================================================================
   * helpers
   * ================================================================ */
  // variant index 0..2 and a per-variant pick
  const V = (opt) => (((opt && opt.v) | 0) % 3 + 3) % 3;
  const pick = (v, a, b, c) => (v === 1 ? b : v === 2 ? c : a);
  const bobF = (k, ph) => (an) => Math.cos(cyc(an, ph || 0) * 2) * k;
  // the kit's quadruped foot / knee maths, reproduced so extras (claws, feathering) can follow a leg
  function legPts(L, lg, an) {
    const f = cyc(an, lg[2]), x = lg[0] + Math.cos(f) * L.stride, up = Math.max(0, -Math.sin(f)) * L.lift, y = lg[1] * 1.03;
    const kz = L.hipZ * (lg[3] ? 0.52 : 0.46) + up * 0.45;
    const kx = lg[3] ? (x + lg[0]) / 2 - (L.hock || 0.4) - up * 0.15 : (x + lg[0]) / 2 + 0.15 + up * 0.55;
    return { f: [x, y, up], k: [kx, y, kz], hp: [lg[0], lg[1], L.hipZ] };
  }
  /* claws on every foot of a quad leg set: n short tapering tubes fanned forward of the foot. Returns one
   * group per leg keyed just after that leg so they draw with it. */
  function claws(L, o) {
    o = o || {};
    const n = o.n || 3, len = o.len || 0.9, spread = o.spread || 0.5, col = hex(o.col || '#d8d0bc');
    return L.list.map((lg) => ({
      key: (a, an) => -0.5 + 0.01 * dep(a, legPts(L, lg, an).f[0], lg[1]) + 0.002, shade: 0.1, dk: (a) => dep(a, lg[0], lg[1]) * 0.6,
      parts: [tube(col, sh(col, 0.25), (an) => {
        const q = legPts(L, lg, an), f = q.f, r2 = L.r2 * (o.k || 1.0);
        const out = [];
        for (let i = 0; i < n; i++) {
          const t = n > 1 ? i / (n - 1) - 0.5 : 0;
          out.push([[f[0] + r2 * 0.6, f[1] + t * spread * 1.2, f[2] + L.hoofH * 0.45, o.r || 0.17], [f[0] + r2 * 0.6 + len, f[1] + t * spread * 1.7, f[2] + L.hoofH * 0.18, (o.r || 0.17) * 0.5]]);
        }
        return out;
      }, { ao: 0 })],
    }));
  }
  /* insect leg: coxa at the body (bx, by, bz) → knee out and up → foot on the ground. Phase ph; the foot
   * swings fore/aft by stride and lifts. Returns a group with one tube (and an optional darker tarsus). */
  function bugLeg(o) {
    const col = hex(o.col), top = o.top ? hex(o.top) : sh(col, 0.2);
    const pts = (an) => {
      const f = cyc(an, o.ph), sw = Math.cos(f) * o.stride, up = Math.max(0, -Math.sin(f)) * o.lift;
      const fx = o.fx + sw, fy = o.fy, fz = up;
      const kx = lerp(o.bx, fx, o.kt !== undefined ? o.kt : 0.55), ky = lerp(o.by, fy, o.kt !== undefined ? o.kt : 0.55) * (o.kOut || 1.0);
      return { f: [fx, fy, fz], k: [kx, ky, o.kz + up * 0.5], b: [o.bx, o.by, o.bz] };
    };
    const parts = [thinTube(col, top, (an) => { const q = pts(an); return [[q.b.concat(o.r0), q.k.concat(o.r1), [q.f[0], q.f[1], q.f[2] + 0.1, o.r2]]]; }, { ao: o.ao !== undefined ? o.ao : 0.1 })];
    if (o.joint) parts.push(tube(o.joint, sh(o.joint, 0.2), (an) => { const q = pts(an); return [[q.k.concat(o.r1 * 1.25)]]; }, { ao: 0 }));
    return { key: (a, an) => (o.keyBase !== undefined ? o.keyBase : -0.5) + 0.01 * dep(a, pts(an).f[0], o.fy), dk: (a) => dep(a, o.fx, o.fy) * 0.6, shade: 0.1, parts };
  }
  /* thin limb: like `tube`, but each segment's cross-section at height z is a single ellipse (the horizontal cut of a
   * tilted cylinder, clipped to the segment) plus the end spheres, instead of a chain of overlapping circles —
   * several times cheaper for long thin legs. */
  function thinSeg(c, z, A, B, PX) {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz), lxy = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    if (Math.abs(dz) < 1e-4) { // horizontal: a capsule of the chord width
      const r = Math.max((A[3] + B[3]) * 0.5, 0.55 / PX), d = (z - A[2]) / Math.max(r, 0.3); if (d <= -1 || d >= 1) return;
      const w = r * Math.sqrt(1 - d * d), nx = -dy / lxy * w, ny = dx / lxy * w;
      c.moveTo(A[0] + nx, A[1] + ny); c.lineTo(B[0] + nx, B[1] + ny); c.lineTo(B[0] - nx, B[1] - ny); c.lineTo(A[0] - nx, A[1] - ny); c.closePath(); return;
    }
    const t0 = (z - A[2]) / dz, r = Math.max(lerp(A[3], B[3], Math.max(0, Math.min(1, t0))), 0.55 / PX);
    if (lxy < 1e-4) { if (t0 >= 0 && t0 <= 1) S.circ(c, A[0], A[1], r); return; }
    const a = r * L / Math.abs(dz), ta = Math.max(0, t0 - a / lxy), tb = Math.min(1, t0 + a / lxy);
    if (ta >= tb) return;
    const tm = (ta + tb) * 0.5;
    S.ell(c, A[0] + dx * tm, A[1] + dy * tm, Math.max(r, (tb - ta) * 0.5 * lxy + r * 0.35), r, Math.atan2(dy, dx));
  }
  function thinTube(side, top, fn, o) {
    o = o || {};
    const b = o.zr || K.zBounds(fn);
    return { z0: b[0], z1: b[1], side: hex(side), top: hex(top || side), bevel: false, ao: o.ao !== undefined ? o.ao : 0.18, flat: o.flat,
      detail: o.detail ? (c, an) => { if (!o.show || o.show(c, an)) o.detail(c, an); } : undefined,
      shape: (c, zt, an) => {
        if (o.show && !o.show(c, an)) return;
        const m = c.getTransform(), PX = Math.max(0.5, Math.hypot(m.a, m.b)), z = lerp(b[0], b[1], zt);
        for (const pl of fn(an)) { for (let i = 0; i < pl.length; i++) { ball(c, z, pl[i][0], pl[i][1], pl[i][2], pl[i][3]); if (i < pl.length - 1) thinSeg(c, z, pl[i], pl[i + 1], PX); } }
      } };
  }
  /* tilted slab (antler palms, shelf fungus): points base + u·d1 + w·d2, inside(u, w) → bool. At height z the
   * slab (thickness th in z) is a band across the plane; it is drawn as parallelograms along w. */
  function slab(c, z, base, d1, d2, th, w0, w1, inside, dw) {
    dw = dw || 0.12;
    const n = Math.max(1, Math.ceil((w1 - w0) / dw)), d = (w1 - w0) / n;
    const uAt = (w) => (z - base[2] - w * d2[2]) / d1[2];
    const hu = th / (2 * Math.abs(d1[2]));
    const P2 = (u, w) => [base[0] + u * d1[0] + w * d2[0], base[1] + u * d1[1] + w * d2[1]];
    let s = -1;
    const emit = (wa, wb) => {
      const ua = uAt(wa), ub = uAt(wb);
      const p0 = P2(ua - hu, wa), p1 = P2(ua + hu, wa), p2 = P2(ub + hu, wb), p3 = P2(ub - hu, wb);
      c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.closePath();
    };
    for (let i = 0; i <= n + 1; i++) {
      const w = w0 + i * d, inn = i <= n && inside(uAt(w), w);
      if (inn && s < 0) s = i;
      else if (!inn && s >= 0) { emit(w0 + (s - 0.5) * d, w0 + (i - 0.5) * d); s = -1; }
    }
  }
  // triangular tine bumps along u: peaks at u = u0 + k·sp, height hgt, half-width hw
  const tines = (u, u0, sp, hgt, hw) => { const k = Math.round((u - u0) / sp); if (k < 0) return 0; const du = Math.abs(u - (u0 + k * sp)); return Math.max(0, 1 - du / hw) * hgt; };
  /* shift a finished model along x (so a long creature's canvas is centred on its extent and `r` stays small).
   * The forge's gradients, view probe and visibility tests are unaffected by a translate of the path. */
  function shiftX(model, dx) {
    model.parts = model.parts.map((p) => {
      const q = Object.create(p);
      q.shape = (c, zt, an) => { c.translate(dx, 0); p.shape(c, zt, an); c.translate(-dx, 0); };
      Object.defineProperty(q, 'detail', { get() { const d = p.detail; return d ? (c, an) => { c.translate(dx, 0); d(c, an); c.translate(-dx, 0); } : undefined; } });
      return q;
    });
    return model;
  }
  // a simple view-sorted model from groups
  const beast = (G, r, h, scale) => ({ r, h, parts: assemble(G), style: 'unit', scale: scale || 1 });
  // ellipse-ish dome cross-section helper: horizontal radii at height z of a dome spanning z0..z1
  const domeK = (z, z0, z1, flatK) => { const t = Math.max(0, Math.min(1, (z - z0) / (z1 - z0))); return Math.sqrt(Math.max(0.03, 1 - Math.pow(t, 2) * (flatK !== undefined ? flatK : 0.92))); };
  // scar: a pale jagged line on the body top
  const scar = (c, col, x, y, len, ang) => { c.save(); c.strokeStyle = col; c.lineWidth = 0.22; c.lineCap = 'round'; c.beginPath(); const dx = Math.cos(ang), dy = Math.sin(ang); c.moveTo(x - dx * len / 2, y - dy * len / 2); c.lineTo(x + dx * len / 2, y + dy * len / 2); for (let i = -1; i <= 1; i++) { const px = x + dx * i * len * 0.3, py = y + dy * i * len * 0.3; c.moveTo(px - dy * 0.3, py + dx * 0.3); c.lineTo(px + dy * 0.3, py - dx * 0.3); } c.stroke(); c.restore(); };

  /* ================================================================
   * ALDERMERE
   * ================================================================ */
  /* Great stag: bigger than a horse, enormous palmate antlers, white chest blaze, dark legs.
   * v0 stag · v1 monarch (bigger, darker, wider palms, scarred flank) · v2 young (smaller, lighter, narrow palms) */
  M.bst_greatstag = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#6a4426', '#5a381e', '#7c5432'), COT = pick(v, '#a8784a', '#946840', '#b88a5c');
    const MANE = sh(CO, -0.22), LOW = '#352012', WH = '#e4dac6', WHT = '#f8f2e6', ANT = pick(v, '#c9b996', '#bfae8a', '#d6c8a8'), ANTT = '#f4ebd6';
    const L = pick(v, 6.2, 7.2, 5.2), sp = pick(v, 1.25, 1.05, 1.5);
    const B = { cx: -0.6, a: 7.0, bF: 2.6, bR: 2.4, n: 2.15, z0: 8.2, z1: 13.2, mid: 0.42, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => {
      c.save(); c.fillStyle = css(WHT); c.beginPath(); S.ell(c, -7.2, 0, 1.4, 1.2); c.fill();
      c.fillStyle = 'rgba(52,26,10,0.42)'; c.beginPath(); S.ell(c, 0.3, 0, 5.4, 0.55); c.fill(); c.restore();
      if (v === 1) scar(c, 'rgba(230,210,190,0.8)', -1.8, 1.3, 2.4, 0.5);
    }) });
    const core = [
      band(WH, WHT, ring, -0.72, 0.72, 8.4, 12.2, { inK: 0.72 }),                       // chest blaze
      band(WH, WHT, ring, PI - 0.62, PI + 0.62, 8.6, 12.4, { inK: 0.72 }),              // rump
      band(sh(CO, 0.28), sh(COT, 0.2), ring, -0.95, 0.95, 8.2, 8.9, { inK: 0.75 }),    // pale belly line under the chest
      stack(CO, COT, [[12.6, 2.5, 2.2, 2.4], [13.9, 2.1, 1.85, 2.7], [14.6, 1.2, 1.0, 3.0]], { ao: 0.25 }), // withers
    ];
    const bob = bobF(0.14);
    // antler palms: tilted slabs from the pedicle out / back / up; a long beam, then a hand-shaped palm
    // broadening outward with big tines on its front edge and two at the far end
    const d1s = (s) => [-0.22, s * 0.8, 0.56], d2 = [0.924, 0, 0.382];
    const inside = (u, w) => {
      if (u < 0) return false;
      if (u < 2.2) return Math.abs(w) < 0.33 + u * 0.05;                                 // beam
      if (u <= L) {
        const p = (u - 2.2) / (L - 2.2);
        const w0 = -(0.35 + 1.0 * Math.pow(p, 0.9)), w1 = 0.4 + 2.3 * Math.pow(p, 0.75) + (u < L - 0.2 ? tines(u, 3.2, sp, 1.5, sp * 0.42) : 0);
        return w > w0 && w < w1;
      }
      if (u < L + 1.4) { const e = (u - L) / 1.4; return Math.abs(w - 1.35) < 0.3 * (1 - e) + 0.04 || Math.abs(w + 0.85) < 0.28 * (1 - e) + 0.04; } // end tines
      return false;
    };
    const aZ0 = 17.5, aZ1 = 17.9 + (L + 1.4) * 0.56 + 4.0 * 0.382 + 0.5;
    const antlers = gp(ANT, ANTT, aZ0, aZ1, (c, z, an) => { const b = bob(an); for (const s of [1, -1]) slab(c, z, [8.0, s * 0.5, 17.9 + b], d1s(s), d2, 0.9, -1.6, 4.3, inside, 0.1); }, { ao: 0.06 });
    const brow = tube(ANT, ANTT, (an) => { const b = bob(an); return [1, -1].map((s) => [[8.15, s * 0.8, 18.2 + b, 0.26], [9.3, s * 1.05, 19.2 + b, 0.2], [9.9, s * 1.15, 20.1 + b, 0.12]]); }, { ao: 0 });
    const head = { at: [8.8, 0], parts: [
      tube(MANE, sh(MANE, 0.15), () => [[[4.2, 0, 10.4, 1.65], [6.3, 0, 12.9, 1.25], [7.5, 0, 14.9, 0.9]]], { ao: 0.25 }), // mane under the neck
      tube(CO, COT, (an) => [[[4.6, 0, 11.9, 1.95], [6.6, 0, 14.6, 1.5], [8.0, 0, 16.6 + bob(an) * 0.5, 1.25]]], { ao: 0.3 }),
      tube(CO, COT, (an) => { const b = bob(an); return [[[8.0, 0, 17.2 + b, 1.3], [9.6, 0, 16.9 + b, 1.02], [11.2, 0, 16.1 + b, 0.72]]]; }, { ao: 0.12 }),
      tube(WH, WHT, (an) => { const b = bob(an); return [[[9.7, 0, 16.15 + b, 0.74], [11.0, 0, 15.65 + b, 0.56]]]; }, { ao: 0, show: vis(1, 0, -0.25) }), // pale muzzle
      tube('#1a120e', '#3e3028', (an) => [[[11.55, 0, 16.0 + bob(an), 0.48]]], { ao: 0 }),
      tube(CO, COT, (an) => { const b = bob(an); return [1, -1].map((s) => [[7.9, s * 0.65, 17.6 + b, 0.4], [7.5, s * 1.7, 18.55 + b, 0.36], [7.3, s * 2.1, 18.9 + b, 0.2]]); }, { ao: 0 }),
      tube(sh(WH, -0.1), WHT, (an) => { const b = bob(an); return [1, -1].map((s) => [[7.55, s * 1.4, 18.35 + b, 0.2], [7.35, s * 1.9, 18.7 + b, 0.1]]); }, { ao: 0, show: vis(1, 0, 0.3) }),
      antlers, brow,
    ].concat(sideEye('#140c08', 9.35, 0.84, 17.15, 0.21)) };
    const tail = { at: [-7.2, 0], parts: [tube(WH, WHT, (an) => [[[-7.0, 0, 12.7, 0.5], [-7.7, 0, 11.5 + Math.sin(cyc(an) * 2) * 0.12, 0.38]]], { ao: 0 })] };
    const legs = { list: legSet(4.7, 1.35, -5.3, 1.4), hipZ: 8.8, stride: 1.9, lift: 1.3, r0: 0.95, r1: 0.52, r2: 0.4, hoofH: 0.72, hock: 0.85, col: CO, top: COT, low: LOW, lowT: sh(LOW, 0.15), hoof: '#1a1410' };
    return shiftX(quad({ legs, body, core, head, tail, r: Math.max(10.0, L + 2.6), h: aZ1, scale: pick(v, 1.0, 1.12, 0.92) }), -2.0);
  };

  /* Aurochs: huge wild cattle, forward-curving horns, black-brown with a pale dorsal stripe, humped shoulders.
   * v0 bull · v1 cow (smaller, red-brown, short horns) · v2 old bull (biggest, greyed muzzle, a broken horn, scars) */
  M.bst_aurochs = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#2e2219', '#5a3a24', '#3a2f27'), COT = pick(v, '#4e3c2e', '#8a6242', '#5e5248');
    const STRIPE = pick(v, '#c8b088', '#d8bc90', '#c4bca8'), MUZ = pick(v, '#b4a48c', '#c0ac90', '#aaa49c'), MUZT = sh(MUZ, 0.2);
    const HORN = '#d6cab0', HORNT = '#f4ecd8', TIP = '#2a2420', TIPT = '#5a5048';
    const hk = pick(v, 1.0, 0.68, 1.08); // horn size
    const B = { cx: -0.7, a: 7.0, bF: 3.1, bR: 2.9, n: 2.5, z0: 5.2, z1: 10.8, mid: 0.42, kT: 0.62, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => {
      c.save(); c.fillStyle = css(STRIPE, 0.85); c.beginPath(); S.ell(c, -1.0, 0, 5.6, 0.52); c.fill(); c.restore();
      if (v === 2) { scar(c, 'rgba(200,180,160,0.7)', -3.4, -1.2, 2.2, -0.4); scar(c, 'rgba(200,180,160,0.7)', 1.6, 1.6, 1.6, 0.9); }
    }) });
    const hump = stack(CO, COT, [[10.3, 3.0, 2.7, 2.2], [11.6, 2.6, 2.3, 2.5], [12.5, 1.8, 1.6, 2.8], [12.9, 0.9, 0.8, 3.0]], { ao: 0.25,
      detail: (c) => { c.save(); c.fillStyle = css(STRIPE, 0.8); c.beginPath(); S.ell(c, 3.0, 0, 0.9, 0.4); c.fill(); c.restore(); } });
    const core = [hump, band(sh(CO, 0.1), sh(COT, 0.1), ring, -0.9, 0.9, 5.2, 7.4, { inK: 0.75 })];
    const bob = bobF(0.12);
    const hornPts = (s, an) => { const b = bob(an); return [[7.3, s * 1.25, 10.3 + b, 0.64 * hk], [6.9, s * (1.25 + 2.1 * hk), 10.9 + b, 0.52 * hk], [8.1, s * (1.25 + 3.2 * hk), 11.9 + b * 1.1, 0.42 * hk], [9.6, s * (1.25 + 2.9 * hk), 13.1 + b, 0.3 * hk]]; };
    const tipPts = (s, an) => { const q = hornPts(s, an)[3]; return [q, [q[0] + 1.3 * hk, q[1] - s * 0.9 * hk, q[2] + 1.15 * hk, 0.13]]; };
    const head = { at: [9.0, 0], parts: [
      tube(sh(CO, -0.08), COT, () => [[[5.2, 0, 7.0, 1.45], [7.6, 0, 6.5, 1.1]]], { ao: 0.3 }),            // dewlap
      tube(CO, COT, () => [[[5.4, 0, 9.4, 2.4], [7.3, 0, 9.2, 2.05]]], { ao: 0.3 }),                       // neck
      tube(CO, COT, (an) => { const b = bob(an); return [[[7.2, 0, 9.3 + b * 0.5, 1.95], [9.0, 0, 8.4 + b, 1.5], [10.5, 0, 7.6 + b, 1.15]]]; }, { ao: 0.15 }),
      tube(MUZ, MUZT, (an) => { const b = bob(an); return [[[10.4, 0, 7.5 + b, 1.12], [11.0, 0, 7.3 + b, 0.98]]]; }, { ao: 0.05 }),
      tube('#15100c', '#3a302a', (an) => [[[11.35, 0, 7.15 + bob(an), 0.62]]], { ao: 0 }),
      tube(CO, COT, (an) => { const b = bob(an); return [1, -1].map((s) => [[7.7, s * 1.5, 9.5 + b, 0.42], [7.5, s * 2.7, 9.15 + b, 0.32]]); }, { ao: 0 }),
      tube(HORN, HORNT, (an) => [hornPts(1, an), hornPts(-1, an)], { ao: 0.05 }),
      tube(TIP, TIPT, (an) => (v === 2 ? [tipPts(-1, an)] : [tipPts(1, an), tipPts(-1, an)]), { ao: 0 }),
    ].concat(sideEye('#100a06', 8.7, 1.32, 8.95, 0.2)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.6;
    const tail = { at: [-7.6, 0], parts: [
      tube(CO, COT, (an) => [[[-7.5, 0, 10.1, 0.42], [-8.1, sw(an) * 0.4, 8.2, 0.3], [-8.2, sw(an), 6.3, 0.26]]], { ao: 0.1 }),
      tube('#15100c', '#3a302a', (an) => [[[-8.2, sw(an), 6.0, 0.55], [-8.25, sw(an) * 1.1, 5.2, 0.42]]], { ao: 0 }),
    ] };
    const legs = { list: legSet(4.4, 1.75, -4.9, 1.8), hipZ: 6.2, stride: 1.45, lift: 0.9, r0: 1.0, r1: 0.64, r2: 0.52, hoofH: 0.78, hock: 0.6, col: CO, top: COT, low: CO, lowT: COT, hoof: '#15100c' };
    return shiftX(quad({ legs, body, core, head, tail, r: 10.4, h: 13.1 + 1.2 * hk + 0.6, scale: pick(v, 1.0, 0.9, 1.08) }), -1.8);
  };

  /* Moorhound: lanky long-legged pack predator, ribs showing, big ears, long thin tail, brindled grey-brown.
   * v0 grey-brown · v1 dark, bigger, torn ear · v2 sandy, smaller, scarred */
  M.bst_moorhound = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#5e5446', '#413832', '#7c6c52'), COT = pick(v, '#8e8472', '#6c6258', '#ac9a78');
    const BR = pick(v, '#322c27', '#211d1b', '#4a3c2e'), BRT = sh(BR, 0.15), PA = sh(CO, 0.3), PAT = sh(COT, 0.25), RIB = sh(CO, 0.2);
    const B = { cx: -0.3, a: 4.5, bF: 1.4, bR: 1.05, n: 2.1, z0: 5.0, z1: 7.5, mid: 0.45, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => {
      c.save(); c.fillStyle = css(BRT, 0.85); c.beginPath(); S.ell(c, -0.6, 0, 3.4, 0.55); c.fill(); c.restore();
      blobs(c, css(BR, 0.7), [[1.6, -0.6, 0.45, 2], [-1.2, 0.7, 0.4, 4], [-2.6, -0.4, 0.35, 6]]);
      if (v === 2) scar(c, 'rgba(220,200,180,0.75)', 0.9, 0.9, 1.6, 0.6);
    }) });
    const under = [stack(PA, PAT, [[3.6, 1.35, 1.1, 1.9], [4.6, 1.75, 1.3, 1.9], [5.6, 1.5, 1.2, 1.8]], { ao: 0.3 })]; // deep chest
    const core = [
      patch(BR, BRT, ring, 1.15, 0.16, 6.4, 1.0), patch(BR, BRT, ring, 1.95, 0.14, 6.2, 0.9), patch(BR, BRT, ring, -1.35, 0.16, 6.5, 1.0), patch(BR, BRT, ring, -2.15, 0.13, 6.1, 0.9),
      band(RIB, null, ring, 1.42, 1.5, 5.1, 6.1, { inK: 0.8, out: 1.04 }), band(RIB, null, ring, 1.72, 1.8, 5.1, 6.0, { inK: 0.8, out: 1.04 }),
      band(RIB, null, ring, -1.5, -1.42, 5.1, 6.1, { inK: 0.8, out: 1.04 }), band(RIB, null, ring, -1.8, -1.72, 5.1, 6.0, { inK: 0.8, out: 1.04 }),
    ];
    const bob = bobF(0.1);
    const earL = (s) => (v === 1 && s > 0 ? 1.0 : 1.6);
    const head = { at: [5.2, 0], parts: [
      tube(CO, COT, (an) => [[[3.3, 0, 7.0, 0.92], [4.4, 0, 7.6 + bob(an) * 0.5, 0.82]]], { ao: 0.2 }),
      tube(CO, COT, (an) => { const b = bob(an); return [[[4.3, 0, 7.85 + b, 0.86], [5.4, 0, 7.6 + b, 0.6], [6.6, 0, 7.1 + b, 0.38]]]; }, { ao: 0.15 }),
      tube(PA, PAT, (an) => { const b = bob(an); return [[[4.9, 0, 7.35 + b, 0.5], [6.4, 0, 6.9 + b, 0.3]]]; }, { ao: 0, show: vis(1, 0, -0.3) }),
      tube('#121010', '#3a3636', (an) => [[[6.85, 0, 7.05 + bob(an), 0.27]]], { ao: 0 }),
      tube(BR, BRT, (an) => { const b = bob(an); return [1, -1].map((s) => [[4.05, s * 0.52, 8.3 + b, 0.4], [3.75, s * 0.95, 8.3 + b + earL(s), 0.3], [3.6, s * 1.1, 8.4 + b + earL(s) * 1.25, 0.1]]); }, { ao: 0 }),
    ].concat(sideEye('#d8f04a', 5.15, 0.46, 7.78, 0.15, true)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.6;
    const tail = { at: [-5.2, 0], parts: [tube(BR, BRT, (an) => [[[-4.5, 0, 6.7, 0.32], [-6.0, sw(an) * 0.5, 5.7, 0.24], [-7.3, sw(an), 4.3, 0.17]]], { ao: 0.1 })] };
    const legs = { list: legSet(2.9, 0.85, -3.3, 0.85), hipZ: 5.4, stride: 1.65, lift: 1.15, r0: 0.52, r1: 0.3, r2: 0.25, hoofH: 0.36, hock: 0.6, col: CO, top: COT, low: CO, lowT: COT, hoof: sh(BR, -0.1) };
    return quad({ legs, under, body, core, head, tail, r: 7.8, h: 10.6, scale: pick(v, 1.0, 1.08, 0.92) });
  };

  /* Bear: broad brown bear, shoulder hump, small round ears, long claws.
   * v0 brown · v1 big dark grizzled · v2 cinnamon, pale chest, smaller */
  M.bst_bear = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#4e3620', '#3a2a1c', '#6c4a28'), COT = pick(v, '#7e5c38', '#6e6048', '#a27a48');
    const MUZ = pick(v, '#a88a60', '#8a7a5c', '#c0a070'), MUZT = sh(MUZ, 0.2), DK = sh(CO, -0.2), CL = '#d8d0bc';
    const B = { cx: -0.4, a: 5.9, bF: 3.0, bR: 2.9, n: 2.4, z0: 3.4, z1: 9.8, mid: 0.5, kT: 0.55, kB: 0.65 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => { c.save(); c.fillStyle = 'rgba(255,235,200,0.14)'; c.beginPath(); S.ell(c, -1.2, -0.6, 3.6, 0.9, -0.05); c.fill(); c.restore(); }) });
    const core = [stack(CO, COT, [[9.4, 2.6, 2.4, 2.2], [10.6, 2.25, 2.05, 2.45], [11.4, 1.3, 1.2, 2.7]], { ao: 0.25 })];
    if (v === 2) core.push(band('#d8c8a0', '#efe2c0', ring, -0.55, 0.55, 4.0, 7.2, { inK: 0.75 }));
    const bob = bobF(0.1);
    const head = { at: [7.4, 0], parts: [
      tube(CO, COT, (an) => [[[5.0, 0, 8.0, 1.95], [6.5, 0, 7.9 + bob(an) * 0.5, 1.65]]], { ao: 0.3 }),
      tube(CO, COT, (an) => { const b = bob(an); return [[[6.5, 0, 8.05 + b, 1.6], [7.7, 0, 7.55 + b, 1.25]]]; }, { ao: 0.15 }),
      tube(MUZ, MUZT, (an) => { const b = bob(an); return [[[7.7, 0, 7.2 + b, 0.95], [8.8, 0, 6.8 + b, 0.72]]]; }, { ao: 0.1 }),
      tube('#110c0a', '#3a302a', (an) => [[[9.1, 0, 6.78 + bob(an), 0.44]]], { ao: 0 }),
      tube(DK, COT, (an) => { const b = bob(an); return [1, -1].map((s) => [[6.2, s * 1.35, 9.3 + b, 0.52]]); }, { ao: 0 }),
      tube(MUZ, MUZT, (an) => { const b = bob(an); return [1, -1].map((s) => [[6.35, s * 1.35, 9.35 + b, 0.26]]); }, { ao: 0, show: vis(1, 0, 0.2) }),
    ].concat(sideEye('#100a06', 7.55, 0.74, 7.9, 0.17)) };
    const tail = { at: [-6.2, 0], parts: [tube(CO, COT, () => [[[-6.1, 0, 7.4, 0.5], [-6.5, 0, 7.0, 0.4]]], { ao: 0 })] };
    const legs = { list: legSet(3.7, 1.75, -3.9, 1.75), hipZ: 4.6, stride: 1.3, lift: 0.6, r0: 1.15, r1: 0.85, r2: 0.78, hoofH: 0.6, hock: 0.3, col: CO, top: COT, low: CO, lowT: COT, hoof: DK };
    return quad({ legs, body, core, head, tail, items: claws(legs, { n: 3, len: 1.05, spread: 0.6, col: CL, r: 0.17 }), r: 9.8, h: 11.6, scale: pick(v, 1.0, 1.12, 0.92) });
  };

  /* Hare: tiny, cheap. v0 brown · v1 grey, a bit bigger · v2 sandy, smaller */
  M.crt_hare = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#8c7352', '#7e7a72', '#a08860'), COT = pick(v, '#b89c76', '#aaa49a', '#cdb48a'), WH = '#e8e0d0', WHT = '#f8f4ec', TIP = '#2a2220';
    const prof = [[0.8, 1.3, 0.85, -0.2], [1.6, 1.55, 1.0, -0.1], [2.6, 1.3, 0.85, 0.1], [3.2, 0.6, 0.45, 0.3]];
    const swH = (an) => Math.cos(cyc(an)) * 0.45, swF = (an) => Math.cos(cyc(an, 0.5)) * 0.35;
    const G = [
      { key: () => -0.5, parts: [tube(CO, COT, (an) => [1, -1].map((s) => [[-1.0 + swH(an) * s, s * 0.72, 0.2, 0.3], [-1.15, s * 0.75, 1.3, 0.44]]).concat([1, -1].map((s) => [[0.9 + swF(an) * s, s * 0.45, 0.15, 0.2], [0.8, s * 0.45, 1.3, 0.26]])), { ao: 0.1 })] },
      { key: () => 0, parts: [
        stack(CO, COT, prof, { ao: 0.3, detail: (c) => { c.save(); c.fillStyle = 'rgba(60,40,20,0.3)'; c.beginPath(); S.ell(c, 0, 0, 0.8, 0.22); c.fill(); c.restore(); } }),
        band(WH, WHT, ringProf(prof), -PI, PI, 0.8, 1.45, { inK: 0.8, out: 1.04 }),
        tube(CO, COT, () => [[[1.35, 0, 2.95, 0.64], [2.1, 0, 2.75, 0.44]]], { ao: 0.15 }),
        tube(CO, COT, () => [1, -1].map((s) => [[1.05, s * 0.26, 3.35, 0.2], [0.65, s * 0.48, 4.0, 0.18]]), { ao: 0 }),
        tube(TIP, sh(TIP, 0.2), () => [1, -1].map((s) => [[0.62, s * 0.48, 4.05, 0.17], [0.5, s * 0.52, 4.45, 0.1]]), { ao: 0 }),
        tube(WH, WHT, () => [[[-1.75, 0, 2.3, 0.36]]], { ao: 0 }),
      ].concat(sideEye('#140c08', 1.95, 0.4, 2.95, 0.12)) },
    ];
    return beast(G, 2.6, 4.6, pick(v, 1.0, 1.08, 0.9));
  };

  /* Fox: small, bushy white-tipped tail, black legs and ears. v0 red · v1 dark cross fox, bigger · v2 pale, smaller */
  M.crt_fox = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#b4521e', '#80401c', '#c87c46'), COT = pick(v, '#e0863e', '#b06a34', '#e8a870'), WH = '#efe9dc', WHT = '#fbf8f2', BK = '#1e1614', BKT = '#3e3430';
    const B = { cx: -0.2, a: 2.8, bF: 1.05, bR: 0.95, n: 2.1, z0: 1.9, z1: 3.9, mid: 0.45, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: v === 1 ? clipped((c) => { c.save(); c.fillStyle = css(BKT, 0.75); c.beginPath(); S.ell(c, -0.2, 0, 1.6, 0.4); c.fill(); c.restore(); }) : undefined });
    const core = [band(WH, WHT, ring, -0.8, 0.8, 1.9, 3.3, { inK: 0.75 })];
    const bob = bobF(0.08);
    const head = { at: [3.2, 0], parts: [
      tube(CO, COT, (an) => { const b = bob(an); return [[[2.2, 0, 3.55 + b * 0.5, 0.72], [3.1, 0, 3.4 + b, 0.5], [3.9, 0, 3.05 + b, 0.3]]]; }, { ao: 0.15 }),
      tube(WH, WHT, (an) => { const b = bob(an); return [[[2.9, 0, 3.2 + b, 0.42], [3.75, 0, 2.95 + b, 0.26]]]; }, { ao: 0, show: vis(1, 0, -0.3) }),
      tube(BK, BKT, (an) => [[[4.05, 0, 3.0 + bob(an), 0.2]]], { ao: 0 }),
      tube(BK, BKT, (an) => { const b = bob(an); return [1, -1].map((s) => [[2.0, s * 0.42, 3.95 + b, 0.24], [1.85, s * 0.66, 4.9 + b, 0.11]]); }, { ao: 0 }),
    ].concat(sideEye('#e8b040', 3.0, 0.42, 3.55, 0.12, true)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.45;
    const tail = { at: [-3.6, 0], parts: [
      tube(CO, COT, (an) => [[[-2.6, 0, 3.0, 0.55], [-3.8, sw(an) * 0.4, 2.65, 0.72], [-4.9, sw(an), 2.25, 0.55]]], { ao: 0.1 }),
      tube(WH, WHT, (an) => [[[-5.0, sw(an), 2.15, 0.5], [-5.55, sw(an) * 1.1, 2.0, 0.3]]], { ao: 0 }),
    ] };
    const legs = { list: legSet(1.75, 0.6, -1.95, 0.6), hipZ: 2.2, stride: 0.95, lift: 0.6, r0: 0.33, r1: 0.2, r2: 0.17, hoofH: 0.25, hock: 0.3, col: CO, top: COT, low: BK, lowT: BKT, hoof: BK };
    return quad({ legs, body, core, head, tail, r: 6.0, h: 5.2, scale: pick(v, 1.0, 1.08, 0.9) });
  };

  /* ================================================================
   * SYLVARA
   * ================================================================ */
  /* Elderhorn: enormous ancient horned herbivore; trunk legs, a moss carpet on its back with ferns, mushrooms and
   * softly glowing moss spots. v0 · v1 the eldest (bigger, horns sweep higher, a sapling grows on it) · v2 young
   * (smaller, lighter coat, shorter straighter horns, less moss) */
  M.bst_elderhorn = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#4c3a2a', '#45362a', '#5c4a38'), COT = pick(v, '#786650', '#6e6050', '#8c7a62'), LEG = sh(CO, -0.1), FOOT = '#2a2018';
    const MOSS = '#5e9034', MOSST = '#9ccb55', GLO = '#c4ff9c', HORN = '#c4bba4', HORNT = '#ebe5d0', FERN = '#4a8a38', FERNT = '#7cc05a';
    const B = { cx: -1.5, a: 10.5, bF: 5.2, bR: 4.8, n: 2.4, z0: 10.5, z1: 22.5, mid: 0.5, kT: 0.55, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => { c.save(); c.fillStyle = 'rgba(40,28,16,0.35)'; c.beginPath(); S.ell(c, -2.0, 0, 7.5, 1.1); c.fill(); c.restore(); }) });
    const mossK = pick(v, 1.0, 1.15, 0.72);
    const mossBlobs = [[-4.0, 0.6, 4.8, 3], [1.2, -1.0, 4.3, 5], [-0.8, 2.0, 3.6, 8], [-7.2, -0.8, 2.6, 11]];
    const glowPts = [[-5.0, -1.6], [-2.4, 2.4], [0.8, -2.2], [2.6, 1.4], [-7.6, 0.6], [-3.2, 0.2]];
    const core = [
      stack(CO, COT, [[22.0, 4.6, 4.0, 3.6], [23.5, 3.9, 3.4, 3.9], [24.5, 2.4, 2.1, 4.3], [24.9, 1.0, 0.9, 4.5]], { ao: 0.25 }), // withers
      gp(MOSS, MOSST, 22.2, 23.7, (c, z) => { const k = (1 - (z - 22.2) / 1.5 * 0.4) * mossK; for (const q of mossBlobs) S.blob(c, q[0], q[1], q[2] * k, q[3], 9, 0.38); }, { ao: 0.25, bevel: true,
        detail: (c) => { for (const q of glowPts) glow(c, GLO, q[0], q[1], 1.5 * mossK, '#eaffd8', 0.55); } }),
      gp(GLO, '#f0ffe0', 23.7, 23.95, (c) => { for (const q of glowPts) S.circ(c, q[0], q[1], 0.42 * mossK); }, { flat: true, ao: 0, bevel: false }),    // glowing moss spots
      gp(FERN, FERNT, 23.6, 25.4, (c, z) => { const t = 0.25 + (z - 23.6) / 1.8 * 0.75; for (const q of [[-5.4, 2.6, 0.3], [1.8, 2.2, 1.4], [-1.6, -2.8, 2.5]]) S.star(c, q[0], q[1], 1.9 * t * mossK, 0.55 * t * mossK, 6, q[2]); }, { ao: 0.2, bevel: false }),
      tube('#e4d8bc', '#f6f0dc', () => [[[-2.6, -0.9, 23.3, 0.32], [-2.6, -0.9, 24.7, 0.3]], [[3.4, -1.4, 23.5, 0.26], [3.4, -1.4, 24.5, 0.24]]], { ao: 0.1 }),   // mushroom stems
      tube('#b85c34', '#e08a5a', () => [[[-2.6, -0.9, 25.0, 1.0]], [[3.4, -1.4, 24.7, 0.72]]], { ao: 0.05 }),                                               // mushroom caps
    ];
    if (v === 1) core.push(tube('#5a4430', '#8a6c4c', () => [[[-6.4, 1.4, 23.3, 0.38], [-6.8, 1.6, 27.2, 0.26]]], { ao: 0.1 }), tube('#3f7a30', '#86c45a', () => [[[-6.8, 1.6, 28.0, 1.9]]], { ao: 0.2 }));
    const bob = bobF(0.14);
    const hornK = pick(v, 1.0, 1.1, 0.78);
    const horn = (s, an) => { const b = bob(an) * 0.5, k = hornK; return v === 2
      ? [[11.6, s * 1.6, 19.2 + b, 1.3], [10.9, s * 4.6, 20.6 + b, 1.0], [11.6, s * 6.6, 22.6 + b, 0.72], [12.8, s * 7.2, 24.4 + b, 0.4]]
      : [[11.6, s * 1.6, 19.2 + b, 1.35], [10.8, s * 5.0, 20.6 + b, 1.1], [11.6, s * 7.6, 23.2 + b, 0.85], [13.4, s * 8.4, 23.2 + 2.8 * k + b, 0.6], [15.2, s * 7.6, 23.2 + 5.2 * k + b, 0.34]]; };
    const head = { at: [13.5, 0], parts: [
      tube(CO, COT, (an) => [[[8.6, 0, 19.0, 3.4], [12.0, 0, 17.6 + bob(an) * 0.5, 2.8]]], { ao: 0.3 }),
      tube('#8a9478', '#b8c0a4', (an) => { const b = bob(an); return [[[14.0, 0, 13.8 + b, 1.2], [15.4, 0, 12.0 + b, 0.9], [15.9, 0, 10.9 + b, 0.5]]]; }, { ao: 0.1 }),   // lichen beard
      tube(CO, COT, (an) => { const b = bob(an); return [[[12.0, 0, 17.6 + b, 2.7], [14.5, 0, 16.2 + b, 2.2], [16.2, 0, 15.2 + b, 1.7]]]; }, { ao: 0.15 }),
      tube(sh(COT, -0.05), sh(COT, 0.15), (an) => { const b = bob(an); return [[[16.1, 0, 15.0 + b, 1.62], [17.0, 0, 14.7 + b, 1.35]]]; }, { ao: 0.05 }),
      tube('#20160f', '#3a2c20', (an) => { const b = bob(an); return [1, -1].map((s) => [[17.4, s * 0.55, 14.5 + b, 0.3]]); }, { ao: 0, show: vis(1, 0, 0.1) }), // nostrils
      stack(CO, COT, [[18.0, 2.7, 2.5, 11.5], [19.3, 2.3, 2.1, 11.6], [19.9, 1.1, 1.0, 11.7]], { ao: 0.2 }),                                                   // brow boss
      tube(CO, COT, (an) => { const b = bob(an); return [1, -1].map((s) => [[11.0, s * 2.9, 18.4 + b, 0.72], [10.2, s * 4.5, 18.0 + b, 0.5]]); }, { ao: 0 }),
      tube(HORN, HORNT, (an) => [horn(1, an), horn(-1, an)], { ao: 0.08 }),
      tube(MOSS, MOSST, (an) => { const b = bob(an) * 0.5; return [1, -1].map((s) => [[11.6, s * 1.9, 19.5 + b, 1.2], [11.2, s * 3.6, 20.0 + b, 0.9]]); }, { ao: 0.1 }),   // mossy horn bases
    ].concat(sideEye('#e8a840', 13.7, 1.95, 17.0, 0.3, true)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.6;
    const tail = { at: [-12.0, 0], parts: [tube(CO, COT, (an) => [[[-11.3, 0, 19.6, 0.75], [-12.4, sw(an) * 0.3, 17.0, 0.5], [-12.7, sw(an), 14.0, 0.45], [-12.7, sw(an), 13.4, 0.95], [-12.8, sw(an) * 1.1, 12.0, 0.6]]], { ao: 0.3 })] };
    // trunk legs: one swept tube per leg (foot pad → knee → hip), darker toward the ground
    const L = { list: legSet(6.0, 3.3, -6.8, 3.3), hipZ: 12.5, stride: 1.7, lift: 0.8, r0: 1.95, r1: 1.6, r2: 1.5, hoofH: 1.3, hock: 0.5 };
    const legG = L.list.map((lg) => ({ key: (a, an) => -0.5 + 0.01 * dep(a, legPts(L, lg, an).f[0], lg[1]), dk: (a) => dep(a, lg[0], lg[1]) * 0.6, shade: 0.1,
      parts: [tube(LEG, COT, (an) => { const q = legPts(L, lg, an); return [[[q.f[0] + 0.1, q.f[1], q.f[2] + 0.35, L.r2 * 1.25], [q.f[0], q.f[1], q.f[2] + 1.6, L.r2], q.k.concat(L.r1), q.hp.concat(L.r0), [q.hp[0], q.hp[1] * 0.8, q.hp[2] + 1.0, L.r0 * 1.1]]]; }, { ao: 0.42 })] }));
    const h = v === 2 ? 25.4 : 23.2 + 5.2 * hornK + 1.0;
    return shiftX(quad({ legs: { list: [] }, body, core, head, tail, items: legG, r: 15.6, h: Math.max(h, v === 1 ? 30.2 : 0), scale: pick(v, 1.0, 1.12, 0.9) }), -2.4);
  };

  /* Glimmerdeer: luminous pale deer, antlers of glowing pale wood, glowing spots along the flank.
   * v0 stag · v1 hind (no antlers, more spots, warmer) · v2 great stag (bigger, bluish, bigger antlers) */
  M.bst_glimmerdeer = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#b4b0c4', '#c0bac4', '#a6afc8'), COT = pick(v, '#eceaf4', '#f2eef2', '#e4eaf8'), LO = sh(CO, -0.2), HOOF = '#5a5670';
    const GL = '#9affdc', GLT = '#dcfff2', ANT = '#d4ffe8', ANTT = '#f0fff8', EYE = '#8affee';
    const B = { cx: -0.35, a: 4.7, bF: 1.8, bR: 1.68, n: 2.15, z0: 5.4, z1: 8.6, mid: 0.42, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const spotsTop = v === 1 ? [[-2.6, 0.9], [-1.0, -1.0], [0.9, 0.7], [-3.6, -0.5], [2.2, -0.6]] : [[-2.4, 0.9], [-0.8, -1.0], [1.0, 0.8]];
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => { c.save(); c.fillStyle = css(GLT); for (const q of spotsTop) { c.beginPath(); S.circ(c, q[0], q[1], 0.3); c.fill(); } c.restore(); }) });
    const core = [band(sh(COT, -0.05), COT, ring, -0.9, 0.9, 5.4, 6.2, { inK: 0.7 })];
    const flank = v === 1 ? [[1.15, 7.3], [1.6, 6.8], [2.05, 7.4], [2.5, 6.9]] : [[1.2, 7.3], [1.8, 6.8], [2.45, 7.3]];
    for (const s of [1, -1]) for (const q of flank) core.push(patch(GL, GLT, ring, s * q[0], 0.11, q[1], 0.34, { flat: true, inK: 0.8, out: 1.05 }));
    const bob = bobF(0.14);
    const parts = [
      tube(CO, COT, (an) => [[[3.5, 0, 7.6, 1.0], [4.6, 0, 9.4 + bob(an) * 0.5, 0.8], [5.0, 0, 10.3 + bob(an), 0.72]]], { ao: 0.25 }),
      tube(CO, COT, (an) => [[[4.95, 0.5, 11.0 + bob(an), 0.3], [4.85, 1.35, 11.45 + bob(an), 0.3]], [[4.95, -0.5, 11.0 + bob(an), 0.3], [4.85, -1.35, 11.45 + bob(an), 0.3]]], { ao: 0 }),
      tube(GL, GLT, (an) => [1, -1].map((s) => [[4.9, s * 0.95, 11.2 + bob(an), 0.14], [4.85, s * 1.3, 11.42 + bob(an), 0.1]]), { ao: 0, flat: true, show: vis(1, 0, 0.3) }),
      tube(COT, '#ffffff', (an) => [[[4.7, 0, 9.3 + bob(an) * 0.5, 0.62], [5.15, 0, 9.85 + bob(an), 0.5]]], { ao: 0, show: vis(1, 0, -0.2) }),
      tube(CO, COT, (an) => [[[5.1, 0, 10.65 + bob(an), 0.78], [6.1, 0, 10.25 + bob(an), 0.58], [6.95, 0, 9.85 + bob(an), 0.42]]], { ao: 0.1 }),
      tube('#3a3048', '#6a6080', (an) => [[[7.05, 0, 9.85 + bob(an), 0.33]]], { ao: 0 }),
    ].concat(sideEye(EYE, 5.75, 0.55, 10.65, 0.16, true));
    if (v !== 1) {
      const k = v === 2 ? 1.28 : 1.0;
      const A = (s) => (an) => { const b = bob(an); return [
        [[5.1, s * 0.42, 11.2 + b, 0.36], [4.75, s * 1.15 * k, 11.2 + 1.4 * k + b, 0.32], [4.95, s * 1.85 * k, 11.2 + 2.8 * k + b, 0.28], [5.55, s * 2.2 * k, 11.2 + 3.8 * k + b, 0.2]],
        [[4.8, s * 1.05 * k, 11.2 + 1.2 * k + b, 0.28], [5.65, s * 1.2 * k, 11.2 + 2.05 * k + b, 0.2]],
        [[4.92, s * 1.75 * k, 11.2 + 2.5 * k + b, 0.26], [5.7, s * 1.6 * k, 11.2 + 3.4 * k + b, 0.19]],
        [[5.0, s * 0.62, 11.6 + b, 0.28], [5.85, s * 0.75 * k, 11.95 + 0.3 * k + b, 0.19]],
      ]; };
      parts.push(tube(ANT, ANTT, (an) => A(1)(an).concat(A(-1)(an)), { ao: 0, flat: true, detail: (c, an) => { const b = bob(an); for (const s of [1, -1]) glow(c, GL, 5.55, s * 2.2 * k, 1.6, '#ffffff', 0.5); } }));
    }
    const head = { at: [5.6, 0], parts };
    const tail = { at: [-5.1, 0], parts: [tube(COT, '#ffffff', (an) => [[[-4.95, 0, 8.2, 0.38], [-5.35, 0, 7.5 + Math.sin(cyc(an) * 2) * 0.1, 0.3]]], { ao: 0 })] };
    const legs = { list: legSet(3.35, 0.95, -3.7, 0.95), hipZ: 6.0, stride: 1.35, lift: 1.0, r0: 0.62, r1: 0.36, r2: 0.28, hoofH: 0.5, hock: 0.55, col: CO, top: COT, low: LO, lowT: sh(LO, 0.15), hoof: HOOF };
    return quad({ legs, body, core, head, tail, r: 8, h: v === 1 ? 11.9 : v === 2 ? 16.6 : 15.5, scale: pick(v, 1.0, 0.92, 1.1) });
  };

  /* Great beetle: boar-sized, six jointed legs, a forked head horn pincered by a thoracic horn, elytra split into a
   * green and a violet half (iridescent two-tone). v0 green / violet · v1 bronze / green, bigger, longer horn ·
   * v2 blue / teal, smaller */
  M.bst_greatbeetle = function (pal, opt) {
    const v = V(opt);
    const EL = pick(v, '#1f7a4c', '#7a4a1e', '#1e4a8a'), ELT = pick(v, '#52c484', '#c48a3e', '#4a9ad8');
    const ER = pick(v, '#452a84', '#1f7a4c', '#1e7a6a'), ERT = pick(v, '#8e64dc', '#52c484', '#52c4a4');
    const PRO = pick(v, '#17382a', '#3a2a16', '#16304a'), PROT = pick(v, '#2e6e4e', '#7a5a2e', '#2e6a8e');
    const LEG = '#1e1a16', LEGT = '#3e3630', HORN = '#2a2018', HORNT = '#5e4e3c', hk = pick(v, 1.0, 1.25, 0.85);
    const z0 = 2.8, z1 = 7.4;
    const dk = (z) => domeK(z, z0, z1, 0.95), dcx = (z) => -1.0 + (z - z0) / (z1 - z0) * 0.6;
    const dome = gp(EL, ELT, z0, z1, (c, z) => S.ell(c, dcx(z), 0, 4.9 * dk(z), 3.5 * dk(z)), { ao: 0.3, bevel: true,
      detail: (c) => { c.save(); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(dcx(z1) + 1.2, 0); c.lineTo(dcx(z1) - 1.6, 0); c.stroke(); c.restore(); } });
    const dring = (z, t, k) => [dcx(z) + Math.cos(t) * 4.9 * dk(z) * k, Math.sin(t) * 3.5 * dk(z) * k];
    const sheen = [1, -1].map((s) => patch(ER, ERT, dring, s * PI * 0.52, 0.95, 4.6, 1.75, { inK: 0.72, out: 1.05 }));
    const pron = gp(PRO, PROT, 3.0, 7.2, (c, z) => { const t = (z - 3.0) / 4.2, k = domeK(z, 3.0, 7.2, 0.9); S.ell(c, 3.7 + t * 0.3, 0, 2.7 * k, 3.05 * k); }, { ao: 0.3, bevel: true });
    const bob = bobF(0.08);
    const G = [
      { key: () => -0.4, parts: [stack('#2a2420', '#3e3630', [[1.6, 4.4, 2.7, -0.2], [3.2, 4.9, 3.1, -0.2]], { ao: 0.3 })] },
      { key: () => 0, parts: [dome].concat(sheen) },
      { key: (a) => dep(a, 4.2, 0), parts: [
        pron,
        tube(HORN, HORNT, (an) => { const b = bob(an); return [[[4.4, 0, 7.0 + b, 0.42], [5.6, 0, 7.9 + b, 0.3], [6.4 + 0.8 * hk, 0, 8.4 + 0.6 * hk + b, 0.14]]]; }, { ao: 0 }),   // thoracic horn
        tube('#141210', '#36302a', (an) => [[[6.6, 0, 4.4 + bob(an), 1.15]]], { ao: 0.1 }),                                                                               // head
        tube(HORN, HORNT, (an) => { const b = bob(an); return [[[6.6, 0, 4.9 + b, 0.6], [8.0 * hk + 0.4, 0, 6.2 + b, 0.46], [8.3 * hk + 0.8, 0, 7.4 + 1.6 * hk + b, 0.3]],
          [[8.3 * hk + 0.8, 0.0, 7.4 + 1.6 * hk + b, 0.3], [8.6 * hk + 1.1, 0.55, 7.9 + 2.0 * hk + b, 0.13]], [[8.3 * hk + 0.8, 0.0, 7.4 + 1.6 * hk + b, 0.3], [8.6 * hk + 1.1, -0.55, 7.9 + 2.0 * hk + b, 0.13]]]; }, { ao: 0 }),
        tube('#0e0c0a', '#2a2622', (an) => [1, -1].map((s) => [[7.5, s * 0.85, 4.1 + bob(an), 0.26], [8.4, s * 1.2, 3.7 + bob(an), 0.12]]), { ao: 0 }),            // mandibles
      ] },
    ];
    const legs = [[3.0, 1.7, 1.3, 5.4, 0], [0.2, 1.9, 0.0, 5.8, 0.5], [-2.6, 1.8, -1.2, 5.5, 0]];
    for (const s of [1, -1]) legs.forEach((l, i) => G.push(bugLeg({ col: LEG, top: LEGT, bx: l[0], by: s * l[1], bz: 2.7, fx: l[2], fy: s * l[3], kz: 4.6, kt: 0.5, r0: 0.46, r1: 0.36, r2: 0.2, ph: l[4] + (s > 0 ? 0 : 0.5), stride: 0.9, lift: 0.6, joint: '#2e2a26' })));
    return beast(G, 6.8 + 3.2 * hk, 8.2 + 2.0 * hk, pick(v, 1.0, 1.12, 0.9));
  };

  /* Marsh croaker: giant toad, squat and wide, enormous mouth, bulging eyes on top, a pulsing glowing throat sac,
   * warty back. v0 mud-olive · v1 dark, bigger, orange throat · v2 green with yellow stripes, smaller */
  M.bst_marshcroaker = function (pal, opt) {
    const v = V(opt);
    const CO = pick(v, '#5e4c2a', '#403620', '#4e5a2a'), COT = pick(v, '#9c8c48', '#706a34', '#8aa048'), BLOT = pick(v, '#3e3a20', '#262416', '#304020');
    const WART = pick(v, '#c4b45a', '#8c8444', '#d0c858'), BELLY = '#d8cc9a', BELLYT = '#ece4bc', THR = pick(v, '#c8ff5a', '#ffb04a', '#d8ff6a'), EYE = '#e8b83a', EYED = '#a07c22';
    const B = { cx: -0.8, a: 5.3, bF: 4.3, bR: 3.7, n: 2.6, z0: 1.2, z1: 6.4, mid: 0.4, kT: 0.78, kB: 0.5 };
    const ring = bodyRing(B);
    const body = bodyPart(B, CO, COT, { detail: clipped((c) => {
      blobs(c, css(BLOT, 0.55), [[-2.6, 1.4, 1.1, 2], [0.6, -1.6, 0.95, 4], [-3.8, -1.2, 0.8, 6], [1.8, 1.9, 0.7, 7], [-0.9, 0.2, 0.6, 9]]);
      if (v === 2) { c.save(); c.strokeStyle = 'rgba(230,220,90,0.7)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(3.2, 0); c.lineTo(-4.5, 0); c.moveTo(2.4, -1.8); c.lineTo(-3.6, -2.4); c.moveTo(2.4, 1.8); c.lineTo(-3.6, 2.4); c.stroke(); c.restore(); }
    }) });
    const core = [
      band(BELLY, BELLYT, ring, -PI, PI, 1.2, 2.3, { inK: 0.8, out: 1.03 }),
      tube(WART, sh(WART, 0.25), () => [[-2.4, 1.6, 6.35, 0.5], [0.4, -2.0, 6.3, 0.45], [-3.6, -0.9, 6.15, 0.4], [1.6, 1.2, 6.4, 0.4], [-1.0, -0.4, 6.55, 0.36], [-4.6, 1.3, 5.7, 0.35], [2.2, -0.9, 6.2, 0.32], [-2.2, -2.6, 5.9, 0.34]].map((q) => [q]), { ao: 0 }),
    ];
    const hz0 = 2.0, hz1 = 5.8, hk = (z) => domeK(z, hz0, hz1, 0.85);
    const hring = (z, t, k) => [4.4 + Math.cos(t) * 2.8 * hk(z) * k, Math.sin(t) * 4.0 * hk(z) * k];
    const pulse = (an) => 1.45 + 0.35 * Math.sin(cyc(an));
    const head = { at: [4.6, 0], parts: [
      gp(CO, COT, hz0, hz1, (c, z) => S.ell(c, 4.4, 0, 2.8 * hk(z), 4.0 * hk(z)), { ao: 0.3, bevel: true,
        detail: clipped((c) => blobs(c, css(BLOT, 0.5), [[3.6, 0.6, 0.6, 3], [4.8, -1.4, 0.5, 5]])) }),
      band('#241c10', '#3a3020', hring, -1.45, 1.45, 3.25, 3.7, { inK: 0.78, out: 1.06 }),                                                   // the mouth
      tube(EYED, EYE, () => [1, -1].map((s) => [[4.2, s * 2.35, 6.35, 1.05]]), { ao: 0.1 }),
      tube('#0e0c08', '#2a2420', () => [1, -1].map((s) => [[5.05, s * 2.35, 6.45, 0.42]]), { ao: 0, show: vis(1, 0, -0.15) }),
      gp(THR, sh(THR, 0.4), 0.5, 3.4, (c, z, an) => ball(c, z, 6.2, 0, 1.95, pulse(an)), { flat: true, ao: 0, bevel: false,
        detail: (c, an) => { glow(c, THR, 6.2, 0, pulse(an) * 1.8, '#ffffff', 0.5); } }),
    ] };
    const LEGC = sh(CO, -0.12), LEGT = COT;
    const legG = [];
    for (const s of [1, -1]) {
      const hp = 0 + (s > 0 ? 0 : 0.5), fp = 0.25 + (s > 0 ? 0 : 0.5);
      legG.push({ key: (a, an) => -0.5 + 0.01 * dep(a, -1.6, s * 5.0), dk: (a) => dep(a, -1.6, s * 5.0) * 0.6, shade: 0.1, parts: [
        tube(LEGC, LEGT, (an) => { const f = cyc(an, hp), sw = Math.cos(f) * 0.9, up = Math.max(0, -Math.sin(f)) * 0.7;
          return [[[-2.2, s * 3.0, 3.0, 1.05], [-0.5 + sw, s * 4.7, 3.5 + up, 0.85], [-3.3 + sw, s * 5.0, 1.4 + up, 0.6], [-1.4 + sw * 1.3, s * 5.5, 0.4 + up, 0.5]],
            [[-1.4 + sw * 1.3, s * 5.5, 0.4 + up, 0.45], [0.1 + sw * 1.3, s * 5.2, 0.2 + up, 0.2]], [[-1.4 + sw * 1.3, s * 5.5, 0.4 + up, 0.45], [-0.3 + sw * 1.3, s * 6.4, 0.2 + up, 0.2]]]; }, { ao: 0.2 }),
      ] });
      legG.push({ key: (a, an) => -0.5 + 0.01 * dep(a, 4.4, s * 3.5), dk: (a) => dep(a, 4.4, s * 3.5) * 0.6, shade: 0.1, parts: [
        tube(LEGC, LEGT, (an) => { const f = cyc(an, fp), sw = Math.cos(f) * 0.7, up = Math.max(0, -Math.sin(f)) * 0.6;
          return [[[3.0, s * 2.7, 2.7, 0.62], [3.9 + sw, s * 3.5, 1.7 + up, 0.48], [4.7 + sw, s * 3.7, 0.4 + up, 0.42]],
            [[4.7 + sw, s * 3.7, 0.35 + up, 0.36], [5.8 + sw, s * 3.4, 0.2 + up, 0.16]], [[4.7 + sw, s * 3.7, 0.35 + up, 0.36], [5.5 + sw, s * 4.4, 0.2 + up, 0.16]]]; }, { ao: 0.15 }),
      ] });
    }
    return quad({ legs: { list: [] }, body, core, head, items: legG, r: 8.6, h: 7.6, scale: pick(v, 1.0, 1.1, 0.9) });
  };

  /* Spindlelurker: a spider-thing on eight very long thin legs, the small pale body held high, a glowing eye
   * cluster. v0 pale · v1 bigger, dark-banded legs · v2 smaller, grey-green, striped abdomen */
  M.bst_spindlelurker = function (pal, opt) {
    const v = V(opt);
    const LEG = pick(v, '#b8bcc8', '#9a9eac', '#b4c2b4'), LEGT = pick(v, '#e8ecf4', '#d0d4dc', '#e0ece0'), JOINT = pick(v, '#80848f', '#2e323c', '#6e7e6e');
    const BOD = pick(v, '#c4bed6', '#b8b2cc', '#bcc8bc'), BODT = pick(v, '#ece8f6', '#e4e0f0', '#e8f0e4'), MARK = pick(v, '#8a7ea8', '#6a6088', '#5a7a5a'), EYE = '#b4fcff';
    const bz = 12.6, kz = 16.0;
    const G = [
      { key: () => 0, parts: [
        tube(BOD, BODT, () => [[[-1.8, 0, bz + 0.3, 2.35]]], { ao: 0.25 }),                                                   // abdomen
        tube(MARK, sh(MARK, 0.2), () => (v === 2 ? [[[-1.0, 0, bz + 2.1, 0.7]], [[-2.4, 0, bz + 2.2, 0.7]]] : [[[-1.9, 0, bz + 2.15, 1.05]]]), { ao: 0 }), // abdomen mark
        tube(BOD, BODT, () => [[[1.3, 0, bz, 1.65]]], { ao: 0.25 }),                                                         // cephalothorax
        tube('#2a2630', '#4a4654', () => [1, -1].map((s) => [[2.6, s * 0.5, bz - 0.9, 0.26], [3.1, s * 0.62, bz - 2.1, 0.1]]), { ao: 0, show: vis(1, 0, -0.4) }), // fangs
        gp(EYE, '#ffffff', bz - 0.4, bz + 0.9, (c, z) => { for (const q of [[2.75, 0.32, 0.5, 0.3], [2.75, -0.32, 0.5, 0.3], [2.5, 0.8, 0.15, 0.22], [2.5, -0.8, 0.15, 0.22], [2.2, 1.15, 0.5, 0.17], [2.2, -1.15, 0.5, 0.17], [2.65, 0, 0.05, 0.16], [2.4, 0.5, -0.1, 0.13], [2.4, -0.5, -0.1, 0.13]]) ball(c, z, q[0], q[1], bz + q[2], q[3]); },
          { flat: true, ao: 0, bevel: false, show: vis(1, 0, -0.35), detail: (c) => { glow(c, EYE, 2.6, 0, 1.9, '#ffffff', 0.55); } }),
      ] },
    ];
    const legs = [[2.0, 1.0, 7.6, 5.6, 0], [1.5, 1.35, 3.8, 8.6, 0.5], [0.7, 1.4, -1.8, 8.6, 0], [-0.1, 1.25, -6.4, 6.2, 0.5]];
    for (const s of [1, -1]) legs.forEach((l) => G.push(bugLeg({ col: LEG, top: LEGT, bx: l[0], by: s * l[1], bz: bz - 0.2, fx: l[2], fy: s * l[3], kz, kt: 0.42, r0: 0.4, r1: 0.3, r2: 0.18, ph: l[4] + (s > 0 ? 0 : 0.5), stride: 1.3, lift: 1.1, joint: JOINT, ao: 0.05 })));
    return beast(G, 10.4, kz + 1.4, pick(v, 1.0, 1.15, 0.9));
  };

  /* Tree shambler: a monster disguised as a dead tree — a lobed bark trunk on two root-bundle legs, two branch arms,
   * glowing green knot-eyes, a hollow mouth, a few leaves. v0 dead oak · v1 taller pale birch-like · v2 squat,
   * mossy, with fungus shelves */
  M.bst_treeshambler = function (pal, opt) {
    const v = V(opt);
    const BK = pick(v, '#564434', '#9a9488', '#4e4030'), BKT = pick(v, '#7c6a52', '#c4beb0', '#6e5e48'), ROOT = sh(BK, -0.18), ROOTT = sh(BKT, -0.1);
    const LEAF = '#5a8c38', LEAFT = '#8ec060', EYE = '#8cff5a', MOSS = '#5e9034', MOSST = '#9ccb55';
    const tz0 = 4.5, tz1 = pick(v, 20.0, 22.5, 18.0), seed = pick(v, 3, 7, 11);
    const R = (z) => { const t = (z - tz0) / (tz1 - tz0); return (v === 1 ? 2.3 : 2.7) * (1 - t * 0.38) + (t > 0.85 ? (t - 0.85) * 1.5 : 0); };
    const DX = (z) => ((z - tz0) / (tz1 - tz0)) * 0.6;
    const ez = tz1 - 3.6, mz = tz1 - 6.4;
    const trunk = gp(BK, BKT, tz0, tz1, (c, z) => S.blob(c, DX(z), 0, R(z), seed, 11, 0.32), { ao: 0.35, bevel: true,
      detail: (c) => { c.save(); c.strokeStyle = 'rgba(30,20,10,0.55)'; c.lineWidth = 0.25; c.beginPath(); c.arc(DX(tz1), 0, R(tz1) * 0.5, 0, TAU); c.moveTo(DX(tz1) + R(tz1) * 0.25, 0); c.arc(DX(tz1), 0, R(tz1) * 0.25, 0, TAU); c.stroke(); c.restore(); } });
    const core = [trunk,
      tube('#1a1812', '#2a2820', () => [[[R(mz) + DX(mz) - 0.1, 0, mz, 0.95], [R(mz) + DX(mz) + 0.2, 0, mz - 0.3, 0.6]]], { ao: 0, show: vis(1, 0, -0.1) }),              // hollow mouth
      tube('#1a1a12', '#2a2a1c', () => [1, -1].map((s) => [[R(ez) + DX(ez) - 0.25, s * 0.95, ez, 0.72]]), { ao: 0, show: vis(1, 0, -0.25) }),                          // knot sockets
      gp(EYE, '#f0ffd8', ez - 0.5, ez + 0.5, (c, z) => { for (const s of [1, -1]) ball(c, z, R(ez) + DX(ez) + 0.1, s * 0.95, ez, 0.42); }, { flat: true, ao: 0, bevel: false, show: vis(1, 0, -0.25),
        detail: (c) => { for (const s of [1, -1]) glow(c, EYE, R(ez) + DX(ez) + 0.1, s * 0.95, 1.3, '#ffffff', 0.55); } }),
      tube(BK, BKT, () => [[[DX(tz1), 0, tz1 - 0.3, 1.1], [DX(tz1) - 0.7, 0.7, tz1 + 2.6, 0.55], [DX(tz1) - 1.2, 1.3, tz1 + 4.6, 0.22]], [[DX(tz1) + 0.2, -0.4, tz1 - 0.2, 0.8], [DX(tz1) + 1.0, -1.6, tz1 + 2.9, 0.2]], [[DX(tz1) - 0.3, 0.2, tz1 + 1.6, 0.5], [DX(tz1) + 0.9, 1.1, tz1 + 3.4, 0.18]]], { ao: 0.1 }), // crown stubs
      gp(LEAF, LEAFT, tz1 + 1.6, tz1 + 3.0, (c, z) => { const k = 1 - Math.abs((z - tz1 - 2.3) / 0.8); S.ell(c, DX(tz1) - 1.1, 1.2, 1.2 * k, 0.85 * k, 0.5); S.ell(c, DX(tz1) + 1.0, -1.5, 1.0 * k, 0.7 * k, -0.4); S.ell(c, DX(tz1) + 1.0, 1.0, 0.85 * k, 0.6 * k, 0.2); }, { ao: 0.15, bevel: true }),
    ];
    if (v === 2) core.push(
      gp(MOSS, MOSST, 7.5, 9.6, (c, z) => { const k = 1 - Math.abs((z - 8.5) / 1.2) * 0.6; S.blob(c, DX(8.5) - 0.6, -R(8.5) * 0.55, 1.5 * k, 4, 8, 0.4); S.blob(c, DX(8.5) + 1.2, R(8.5) * 0.3, 1.1 * k, 6, 8, 0.4); }, { ao: 0.2, bevel: true }),
      gp('#c48a3a', '#e8b860', 11.0, 11.7, (c) => { S.ell(c, DX(11.3), R(11.3) + 0.5, 1.2, 1.3); S.ell(c, DX(11.3) - 0.4, -R(11.3) - 0.3, 0.9, 1.0); }, { ao: 0.2, bevel: true }),
      gp('#c48a3a', '#e8b860', 13.2, 13.8, (c) => { S.ell(c, DX(13.5) + 0.3, R(13.5) + 0.4, 1.0, 1.1); }, { ao: 0.2, bevel: true }));
    const G = [];
    for (const s of [1, -1]) {
      const ph = s > 0 ? 0 : 0.5, sw = (an) => Math.cos(cyc(an, ph)) * 1.3, up = (an) => Math.max(0, -Math.sin(cyc(an, ph))) * 0.9;
      G.push({ key: (a, an) => -0.5 + 0.01 * dep(a, sw(an), s * 1.6), dk: (a) => dep(a, 0, s * 1.6) * 0.6, shade: 0.1, parts: [
        tube(ROOT, ROOTT, (an) => { const x = sw(an), u = up(an); const hip = [0.2, s * 1.1, tz0 + 1.4, 0.95], kn = [x * 0.5, s * 1.6, 2.9 + u, 0.62];
          return [[hip, kn, [x + 1.4, s * 1.1, 0.35 + u, 0.3], [x + 2.3, s * 0.9, 0.25 + u, 0.14]], [hip, kn, [x - 1.1, s * 1.5, 0.35 + u, 0.3], [x - 2.1, s * 1.9, 0.25 + u, 0.14]], [hip, kn, [x + 0.2, s * 2.3, 0.35 + u, 0.3], [x + 0.5, s * 3.3, 0.25 + u, 0.14]]]; }, { ao: 0.25 }),
      ] });
    }
    G.push({ key: () => 0, parts: core });
    for (const s of [1, -1]) {
      const ph = s > 0 ? 0.5 : 0, sw = (an) => Math.cos(cyc(an, ph)) * 0.7, az = tz1 - 4.2;
      G.push({ key: (a, an) => dep(a, 2.4 + sw(an), s * 4.4), shade: 0.06, parts: [
        tube(BK, BKT, (an) => { const x = sw(an); const sh0 = [DX(az) + 0.3, s * 1.7, az, 0.8], el = [1.9 + x, s * 4.3, az + 1.9, 0.6], hd = [3.8 + x, s * 5.6, az - 1.0, 0.4];
          return [[sh0, el, hd], [el, [2.6 + x, s * 5.0, az + 4.0, 0.2]], [hd, [5.2 + x, s * 6.0, az - 2.6, 0.16]], [hd, [4.3 + x, s * 7.0, az - 0.2, 0.16]], [hd, [5.0 + x, s * 5.0, az - 0.4, 0.16]]]; }, { ao: 0.1 }),
      ] });
    }
    return beast(G, 8.4, tz1 + 4.9, pick(v, 1.0, 1.08, 0.94));
  };

  /* ================================================================
   * gallery
   * ================================================================ */
  const A4 = { dirs: 16, anims: 4 };
  const it = (name, gen, pal, v) => Object.assign({ name: name + ' v' + v, gen, pal, opt: { v } }, A4);
  const trio = (name, gen, pal) => [0, 1, 2].map((v) => it(name, gen, pal, v));
  (AS.Gallery = AS.Gallery || []).push(
    { group: 'Beasts: Aldermere', bg: 'human', items: [].concat(
      trio('great stag', 'bst_greatstag', 'neutral'), trio('aurochs', 'bst_aurochs', 'neutral'), trio('moorhound', 'bst_moorhound', 'neutral'),
      trio('bear', 'bst_bear', 'neutral'), trio('hare', 'crt_hare', 'neutral'), trio('fox', 'crt_fox', 'neutral')) },
    { group: 'Beasts: Sylvara', bg: 'elf', items: [].concat(
      trio('elderhorn', 'bst_elderhorn', 'elf'), trio('glimmerdeer', 'bst_glimmerdeer', 'elf'), trio('great beetle', 'bst_greatbeetle', 'elf'),
      trio('marsh croaker', 'bst_marshcroaker', 'elf'), trio('spindlelurker', 'bst_spindlelurker', 'elf'), trio('tree shambler', 'bst_treeshambler', 'elf')) }
  );
})(window.AS);
