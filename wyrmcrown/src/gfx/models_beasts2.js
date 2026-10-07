/* WYRMCROWN — wildlife and monsters of Hrimgard and Morgrave (models_beasts2.js).
 * Built on the creature rig exported by models_units.js (AS.UnitKit): swept-sphere
 * tubes for limbs, necks, tusks and tails, superellipse bodies, wall decals and the
 * view-aware part sorter. 16 directions × 4 frame walk cycles, +x = facing,
 * natural colours (pal ignored). Every species takes opt.v (0, 1, 2) for a visible
 * herd variant: size, tusk/horn/antler shape, markings, coat shift, ice crust or
 * boil count — same species, not a clone.
 *
 * Hrimgard (ice ground #dfe8f0): dark undersides, bluish shadow sides, dark feet,
 * eyes and noses so the beasts separate from the snow.
 * Morgrave (dead earth #4b4640): pale hide / bone trim and toxic glows so the
 * blighted things pop on the dark ground.
 *
 * Local helpers: mlegs (any number of legs, quadruped or arthropod knees, clipped
 * to the visible range so fur-hidden legs cost nothing), shagBody (lobed fur mass
 * with a ragged hem), streaks (matted fur bands), snowCap, boils, glowEyes. */
'use strict';
(function (AS) {
  const K = AS.UnitKit;
  const { lerp, hex, sh, css, cyc, dep, vis, ball, tube, gp, stack, ringProf, band, patch, glow, clipped, blobs, bodyK, bodyPt, bodyRing, bodyPart, quad, legSet, sideEye } = K;
  const U = AS.U, S = AS.Shapes, TAU = U.TAU, PI = Math.PI;
  const M = AS.Models;

  const V3 = (opt) => ((((opt && opt.v) | 0) % 3) + 3) % 3;
  const pick = (v, a, b, c) => [a, b, c][v];
  const IVORY = '#d8ccaa', IVORY_T = '#fff8e4', BONE = '#cfc6ac', BONE_T = '#f4eedc';

  /* ================================================================
   * local kit
   * ================================================================ */
  /* multi-leg builder → sorted groups (pass as quad({ items })).
   * list: [[x, y, phase, kind]]  kind 0 fore (knee forward), 1 hind (knee back), 2 arthropod (knee out and up)
   * L: { hipZ, kneeZ, stride, lift, r0 hip, r1 knee, r2 foot, col, top, ao, zr [z0, z1] clip, hock, kneeOut, footOut, toe, footR } */
  function mlegs(L, list) {
    const G = [];
    const col = hex(L.col), top = L.top ? hex(L.top) : sh(col, 0.15);
    for (const lg of list) {
      const sy = Math.sign(lg[1]) || 1, kind = lg[3] || 0;
      const pts = (an) => {
        const f = cyc(an, lg[2]), x = lg[0] + Math.cos(f) * L.stride, up = Math.max(0, -Math.sin(f)) * L.lift;
        let k, fy = lg[1];
        if (kind === 2) { k = [lerp(lg[0], x, 0.45), lg[1] + sy * (L.kneeOut || 2), L.kneeZ + up * 0.5]; fy = lg[1] + sy * (L.footOut || 3.5); }
        else k = [lerp(lg[0], x, 0.5) + (kind ? -(L.hock || 0.5) - up * 0.15 : (L.hock || 0.5) * 0.4 + up * 0.5), lg[1], L.kneeZ + up * 0.45];
        return { f: [x, fy, up], k, hp: [lg[0], lg[1], L.hipZ] };
      };
      const fr = L.footR || L.r2;
      const line = (an) => {
        const q = pts(an);
        const pl = [[q.f[0], q.f[1], q.f[2] + fr * 0.85, fr], q.k.concat(L.r1), q.hp.concat(L.r0)];
        if (L.toe) pl.unshift([q.f[0] + L.toe, q.f[1], q.f[2] + L.r2 * 0.7, L.r2 * 0.9]);
        return [pl];
      };
      const parts = [tube(col, top, line, { ao: L.ao !== undefined ? L.ao : 0.3, zr: L.zr })];
      G.push({ key: (a, an) => -0.5 + 0.01 * dep(a, pts(an).f[0], lg[1]), dk: (a) => dep(a, lg[0], lg[1]) * 0.6, shade: 0.1, parts });
    }
    return G;
  }

  /* shaggy fur mass: superellipse plan (B as in bodyPart, plus amp / lobes) whose outline is lobed into
   * hanging tufts; the tufts deepen toward the hem so the bottom edge reads ragged. */
  const lobeK = (B, t, zt) => 1 + (B.amp || 0.05) * (1 + 1.8 * Math.max(0, 1 - zt * 2.2)) * Math.sin(t * (B.lobes || 18) + 0.4);
  const shagRing = (B) => (z, t, k) => bodyPt(B, t, bodyK(B, z) * lobeK(B, t, (z - B.z0) / (B.z1 - B.z0)) * k);
  function shagBody(B, side, top, o) {
    o = o || {};
    const ring = shagRing(B);
    return { z0: B.z0, z1: B.z1, side: hex(side), top: hex(top), ao: o.ao !== undefined ? o.ao : 0.42, bevel: o.bevel, detail: o.detail,
      shape: (c, zt) => { const z = lerp(B.z0, B.z1, zt); for (let i = 0; i < 56; i++) { const q = ring(z, i / 56 * TAU - PI, 1); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.closePath(); } };
  }
  // matted streaks: darker vertical bands on the visible flank of a shag body. list: [[t, halfWidth], ...]
  const streaks = (B, col, list, z0, z1) => list.map((s) => band(col, null, shagRing(B), s[0] - s[1], s[0] + s[1], z0, z1, { out: 1.03, inK: 0.86, ao: 0.4 }));
  // fur strokes on a top face (call inside clipped)
  const furStrokes = (c, col, cx, cy, rx, ry, n, seed) => { c.save(); c.strokeStyle = col; c.lineWidth = 0.22; c.beginPath(); for (let i = 0; i < n; i++) { const t = i / n * TAU + seed; const x = cx + Math.cos(t) * rx * 0.45, y = cy + Math.sin(t) * ry * 0.45; c.moveTo(x, y); c.lineTo(x + Math.cos(t + 0.3) * rx * 0.5, y + Math.sin(t + 0.3) * ry * 0.5); } c.stroke(); c.restore(); };
  // snow lying on a top face: blobs [[x, y, r, seed], ...] from height z, thickness h
  const snowCap = (list, z, h) => gp('#b8cad8', '#f8fbfd', z, z + (h || 0.6), (c, zz) => { const u = (zz - z) / (h || 0.6); for (const q of list) S.blob(c, q[0], q[1], q[2] * (1 - u * 0.3), q[3] || 3, 9, 0.3); }, { ao: 0.05, bevel: true });
  // glowing boils bulging from a wall: ring(z, t, k) → [x, y]; list [[z, t, r, always]] (always: not hidden on the far side)
  function boils(ring, list, col, core) {
    return list.map((q) => {
      const p = ring(q[0], q[1], 0.9), r = q[2];
      return gp(col, sh(col, 0.25), q[0] - r, q[0] + r, (c, z) => ball(c, z, p[0], p[1], q[0], r), { flat: true, ao: 0, show: q[3] ? undefined : vis(Math.cos(q[1]), Math.sin(q[1]), -0.3),
        detail: (c) => S.dot(c, core || '#f6ffb4', p[0] - r * 0.25, p[1] - r * 0.25, r * 0.42) });
    });
  }
  // a pair of glowing eyes (flat, with a soft halo), hidden when facing away
  const glowEyes = (col, x, y, z, r) => [1, -1].map((s) => gp(col, sh(col, 0.35), z - r, z + r, (c, zz) => ball(c, zz, x, s * y, z, r), { flat: true, ao: 0, show: vis(0.4, s, 0.1),
    detail: (c) => glow(c, col, x, s * y, r * 2.4, '#ffffff', 0.55) }));
  // knobbly tube (vertebrae): points along a 3D polyline with alternating radii
  const knobs = (pts, n, rA, rB) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, j = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), u = t * (pts.length - 1) - j; const A = pts[j], B = pts[j + 1]; out.push([lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u), i % 2 ? rB : rA]); } return out; };
  /* slide a finished model along its facing axis so its extents are balanced around the origin: long heads, tusks
   * and necks otherwise force a big canvas radius (the forge's post pass costs per pixel) and an off-centre pivot.
   * Sorting keys and visibility tests only compare directions, so they are left in the unshifted frame. */
  function shiftX(m, dx) {
    m.parts = m.parts.map((p) => ({
      get z0() { return p.z0; }, get z1() { return p.z1; }, get side() { return p.side; }, get top() { return p.top; }, get ao() { return p.ao; },
      get flat() { return p.flat; }, get bevel() { return p.bevel; }, get bevelW() { return p.bevelW; }, get stroke() { return p.stroke; }, get when() { return p.when; },
      shape(c, zt, an) { c.translate(dx, 0); p.shape(c, zt, an); c.translate(-dx, 0); },
      get detail() { const d = p.detail; return d ? (c, an) => { c.translate(dx, 0); d(c, an); c.translate(-dx, 0); } : undefined; },
    }));
    m.shiftX = dx;
    return m;
  }

  /* ================================================================
   * HRIMGARD — frozen north
   * ================================================================ */
  /* Frosthulk: an enormous six-legged grazer under a matted fur skirt; six broad grey-blue feet tread out under
   * the hem, a high humped snow-laden back, a small low-slung tusked head. v0 grey-brown, v1 near-black bull with
   * heavy snow (×1.1), v2 pale tawny cow with long curled tusks (×0.92). */
  M.bst_frosthulk = function (pal, opt) {
    const v = V3(opt);
    const FUR = pick(v, '#5a4a3c', '#3a2e28', '#786048'), FURT = pick(v, '#9a8466', '#6a584a', '#b69c76');
    const MAT = sh(FUR, -0.32), DK = '#2a2420', DKT = '#4e4238', FT = '#5a6472', FTT = '#8e9aa8';
    const B = { cx: -0.8, a: 12.0, bF: 6.6, bR: 6.2, n: 2.4, z0: 4.4, z1: 19.6, mid: 0.3, kB: 0.18, kT: 0.62, amp: 0.05, lobes: 22 };
    const body = shagBody(B, FUR, FURT, { detail: clipped((c) => furStrokes(c, css(MAT, 0.5), 2.5, 0, 5.5, 3.5, 12, 0.3)) });
    const hump = shagBody({ cx: -3.6, a: 6.4, bF: 5.0, bR: 4.8, n: 2.2, z0: 17.2, z1: 24.2, mid: 0.12, kB: 0.1, kT: 0.9, amp: 0.04, lobes: 14 }, FUR, FURT, { ao: 0.25 });
    const sn = pick(v, 1, 1.35, 0.7);
    const snow = [snowCap([[-3.2, 0.3, 2.1 * sn, 3], [-5.4, -1.4, 1.3 * sn, 5], [-1.6, 1.6, 1.1 * sn, 7]], 24.2, 0.7), snowCap([[4.0, -1.0, 1.6 * sn, 4], [2.2, 1.6, 1.0 * sn, 6], [5.6, 1.2, 0.8 * sn, 8]], 19.6, 0.5)];
    const str = streaks(B, MAT, [[0.55, 0.11], [1.35, 0.13], [2.2, 0.1], [-0.7, 0.11], [-1.5, 0.1], [-2.35, 0.13]], 5.0, 13.0);
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.18;
    const tl = pick(v, 1, 0.75, 1.3), tc = pick(v, 1, 0.8, 1.25);
    const head = { at: [15.5, 0], parts: [
      tube(FUR, FURT, (an) => [[[10.4, 0, 10.8, 3.3], [13.6, 0, 9.0 + bob(an) * 0.5, 2.9]]], { ao: 0.3 }),
      tube(DK, DKT, (an) => [[[14.4, 0, 8.5 + bob(an) * 0.7, 2.45], [16.4, 0, 7.4 + bob(an), 2.05], [18.0, 0, 6.5 + bob(an), 1.3]]], { ao: 0.25 }),
      tube(IVORY, IVORY_T, (an) => [1, -1].map((s) => [[16.6, s * 1.45, 5.5 + bob(an), 0.5], [16.6 + 1.5 * tl, s * (1.5 + 0.8 * tc), 5.7 + bob(an), 0.44], [16.6 + 2.3 * tl, s * (1.5 + 1.2 * tc), 6.0 + 1.3 * tl + bob(an), 0.32], [16.6 + 2.1 * tl, s * (1.5 + 1.1 * tc), 6.0 + 2.5 * tl + bob(an), 0.16]]), { ao: 0 }),
      tube(FUR, FURT, (an) => [1, -1].map((s) => [[12.6, s * 2.85, 10.6 + bob(an) * 0.5, 0.6], [12.0, s * 3.95, 11.5 + bob(an) * 0.5, 0.32]]), { ao: 0 }),
      snowCap([[12.4, -0.3, 1.3 * sn, 2]], 11.4, 0.4),
    ].concat(sideEye('#100c0a', 15.2, 2.15, 8.8, 0.34)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.5;
    const tail = { at: [-14, 0], parts: [tube(FUR, FURT, (an) => [[[-13.0, 0, 11.0, 0.65], [-14.3, sw(an), 9.0, 0.5], [-14.8, sw(an) * 1.3, 6.8, 1.0]]], { ao: 0.2 })] };
    const legs = mlegs({ hipZ: 10, kneeZ: 5.4, stride: 1.8, lift: 0.7, r0: 1.55, r1: 1.35, r2: 1.2, col: FT, top: FTT, ao: 0.3, zr: [0, 5.6], hock: 0.5, toe: 0.5 },
      [[8.5, -5.6, 0, 0], [1.0, -5.6, 0.33, 1], [-6.5, -5.6, 0.66, 1], [8.5, 5.6, 0.5, 0], [1.0, 5.6, 0.83, 1], [-6.5, 5.6, 0.16, 1]]);
    return shiftX(quad({ legs: { list: [] }, items: legs, body, core: [hump].concat(snow, str), head, tail, r: 18, h: 25, scale: pick(v, 1, 1.1, 0.92) }), -1.9);
  };

  /* Woolly tusker: a mammoth — domed head, shoulder hump, trunk, huge curved tusks, shaggy rust fur hanging over
   * thick column legs. v0 rust bull, v1 dark old bull with snow on the back and a snapped left tusk (×1.12), v2 pale
   * young cow with slimmer, straighter tusks (×0.94). */
  M.bst_woollytusker = function (pal, opt) {
    const v = V3(opt);
    const FUR = pick(v, '#6a3e22', '#4a3024', '#7e5634'), FURT = pick(v, '#aa723e', '#7e5c48', '#b88c58');
    const MAT = sh(FUR, -0.3), SKIN = '#4a382c', SKINT = '#76604e';
    const B = { cx: -0.8, a: 8.6, bF: 5.3, bR: 4.9, n: 2.3, z0: 4.8, z1: 19.5, mid: 0.4, kB: 0.25, kT: 0.72, amp: 0.05, lobes: 18 };
    const body = shagBody(B, FUR, FURT, { detail: clipped((c) => furStrokes(c, css(MAT, 0.5), -1, 0, 4.4, 2.8, 10, 0.1)) });
    const hump = shagBody({ cx: 2.0, a: 5.4, bF: 4.4, bR: 4.2, n: 2.2, z0: 17.5, z1: 22.4, mid: 0.12, kB: 0.1, kT: 0.9, amp: 0.04, lobes: 14 }, FUR, FURT, { ao: 0.25 });
    const str = streaks(B, MAT, [[0.55, 0.11], [1.25, 0.13], [2.0, 0.1], [2.7, 0.12], [-0.7, 0.11], [-1.45, 0.1], [-2.2, 0.13]], 5.2, 12.5);
    const snow = v === 1 ? [snowCap([[2.2, -0.4, 1.6, 3], [0.4, 1.2, 1.0, 5]], 22.4, 0.5), snowCap([[9.0, 0.6, 1.3, 7]], 22.5, 0.4)] : [];
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.2;
    const sw = (an) => Math.sin(cyc(an)) * 0.6;
    const tl = pick(v, 1, 1.0, 0.9), curl = pick(v, 1, 1.15, 0.6), tr = pick(v, 1, 1.1, 0.8);
    const tusk = (s, an) => { const b = bob(an); return [[11.0, s * 1.9, 14.6 + b, 0.78 * tr], [13.6, s * 3.0, 13.0 + b, 0.68 * tr], [11.0 + 5.8 * tl, s * 3.4, 13.2 + b, 0.56 * tr], [11.0 + 8.0 * tl, s * (3.4 - 0.8 * curl), 13.2 + 2.2 * curl + b, 0.42 * tr], [11.0 + 9.0 * tl, s * (3.4 - 1.9 * curl), 13.2 + 4.4 * curl + b, 0.26 * tr]]; };
    const head = { at: [12, 0], parts: [
      tube(FUR, FURT, (an) => [[[7.0, 0, 18.5 + bob(an) * 0.5, 3.4], [9.4, 0, 19.2 + bob(an), 3.5], [11.0, 0, 17.6 + bob(an), 2.7]]], { ao: 0.3 }),
      tube(SKIN, SKINT, (an) => [[[11.6, 0, 17.0 + bob(an), 1.6], [13.5, 0, 13.6 + bob(an), 1.2], [14.3, 0, 9.0 + bob(an), 0.95], [14.0 + sw(an) * 0.3, sw(an) * 0.8, 4.6, 0.75], [13.4 + sw(an) * 0.5, sw(an) * 1.3, 2.8, 0.7]]], { ao: 0.25 }),
      tube(IVORY, IVORY_T, (an) => [1, -1].map((s) => (v === 1 && s < 0 ? tusk(s, an).slice(0, 2).concat([[14.8, s * 3.2, 12.9 + bob(an), 0.5]]) : tusk(s, an))), { ao: 0 }),
      tube(sh(FUR, -0.1), FUR, (an) => [1, -1].map((s) => [[8.2, s * 3.1, 19.4 + bob(an), 1.0], [7.6, s * 4.4, 18.0 + bob(an), 0.7]]), { ao: 0.1 }),
    ].concat(sideEye('#140c08', 11.4, 2.15, 17.2, 0.32)) };
    const tail = { at: [-10, 0], parts: [tube(FUR, FURT, (an) => [[[-9.4, 0, 14.0, 0.5], [-10.4, sw(an) * 0.6, 11.0, 0.42], [-10.8, sw(an), 8.6, 0.8]]], { ao: 0.15 })] };
    const legs = { list: legSet(5.0, 3.3, -5.4, 3.2), hipZ: 8.5, stride: 1.3, lift: 0.7, r0: 1.95, r1: 1.7, r2: 1.55, hoofH: 1.5, hock: 0.5, col: sh(FUR, -0.15), top: FUR, low: sh(FUR, -0.22), lowT: sh(FUR, -0.05), hoof: '#363230' };
    return shiftX(quad({ legs, body, core: [hump].concat(str, snow), head, tail, r: 16.5, h: 23, scale: pick(v, 1, 1.08, 0.94) }), -4.5);
  };

  /* Snowstalker: a long-legged white sabre-cat; high shoulders, broad head with dark-rimmed pale blue eyes, long
   * sabre fangs, black ear and tail tips. v0 plain, v1 faint grey stripes (×1.05), v2 big old grey-blue male with
   * longer fangs (×1.12). */
  M.bst_snowstalker = function (pal, opt) {
    const v = V3(opt);
    const WH = pick(v, '#a8b8c6', '#a4b4c4', '#94a8ba'), WHT = pick(v, '#f4f2ec', '#f0eee8', '#dadcdc');
    const BK = '#1a1a1e', BKT = '#3c3c42', PA = '#c6ced6';
    const B = { cx: -0.4, a: 5.6, bF: 2.0, bR: 1.75, n: 2.15, z0: 5.5, z1: 8.8, mid: 0.45, kT: 0.6, kB: 0.6 };
    const body = bodyPart(B, WH, WHT, { detail: clipped((c) => {
      c.save(); c.fillStyle = 'rgba(110,125,145,0.3)'; c.beginPath(); S.ell(c, -0.6, 0, 4.4, 0.7); c.fill();
      if (v === 1) { c.strokeStyle = 'rgba(70,78,90,0.55)'; c.lineWidth = 0.3; c.beginPath(); for (let i = 0; i < 7; i++) { const x = 2.6 - i * 1.1; c.moveTo(x, -0.25); c.lineTo(x - 0.5, -1.6); c.moveTo(x, 0.25); c.lineTo(x - 0.5, 1.6); } c.stroke(); }
      c.restore(); }) });
    const core = [stack(WH, WHT, [[7.4, 2.2, 2.05, 2.4], [9.2, 2.05, 1.95, 2.3], [10.0, 1.2, 1.15, 2.2]], { ao: 0.2 }), stack(WH, WHT, [[7.2, 1.9, 1.85, -3.6], [8.7, 1.7, 1.7, -3.5], [9.3, 1.0, 1.0, -3.4]], { ao: 0.2 })];
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.12;
    const fang = pick(v, 1, 1, 1.35);
    const head = { at: [7.4, 0], parts: [
      tube(WH, WHT, (an) => [[[4.2, 0, 8.6, 1.5], [5.6, 0, 9.0 + bob(an), 1.45]]], { ao: 0.25 }),
      tube(WH, WHT, (an) => [[[6.5, 0, 9.0 + bob(an), 1.7], [7.9, 0, 8.5 + bob(an), 1.15], [8.9, 0, 8.2 + bob(an), 0.85]]], { ao: 0.2 }),
      tube(PA, '#ffffff', (an) => [[[8.1, 0, 7.9 + bob(an), 0.8], [9.0, 0, 7.8 + bob(an), 0.62]]], { ao: 0, show: vis(1, 0, -0.3) }),
      tube('#1e1a1a', '#3e3838', (an) => [[[9.3, 0, 8.3 + bob(an), 0.36]]], { ao: 0 }),
      tube(IVORY, IVORY_T, (an) => [1, -1].map((s) => [[8.5, s * 0.62, 7.7 + bob(an), 0.28], [8.75, s * 0.68, 7.7 - 2.0 * fang + bob(an), 0.1]]), { ao: 0, show: vis(1, 0, -0.35) }),
      tube(WH, WHT, (an) => [1, -1].map((s) => [[6.0, s * 1.05, 10.1 + bob(an), 0.5], [5.7, s * 1.4, 11.1 + bob(an), 0.26]]), { ao: 0 }),
      tube(BK, BKT, (an) => [1, -1].map((s) => [[5.68, s * 1.42, 11.15 + bob(an), 0.26], [5.6, s * 1.48, 11.7 + bob(an), 0.1]]), { ao: 0 }),
      gp('#101014', '#101014', 8.75, 9.65, (c, z, an) => { for (const s of [1, -1]) ball(c, z, 7.3, s * 0.98, 9.2 + bob(an), 0.4); }, { flat: true, ao: 0 }),
    ].concat(sideEye('#8ad4ff', 7.5, 1.02, 9.25, 0.26, true)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.55;
    const tail = { at: [-8, 0], parts: [
      tube(WH, WHT, (an) => [[[-5.7, 0, 8.3, 0.52], [-7.4, sw(an) * 0.5, 7.5, 0.48], [-8.9, sw(an), 6.3, 0.42]]], { ao: 0.1 }),
      tube(BK, BKT, (an) => [[[-9.05, sw(an), 6.15, 0.5], [-10.1, sw(an) * 1.2, 5.4, 0.34]]], { ao: 0 }),
    ] };
    const legs = { list: legSet(3.7, 1.15, -4.1, 1.1), hipZ: 6.3, stride: 1.75, lift: 1.25, r0: 0.8, r1: 0.46, r2: 0.4, hoofH: 0.5, hock: 0.5, col: WH, top: WHT, low: WH, hoof: '#8e9aa6' };
    return quad({ legs, body, core, head, tail, r: 10.5, h: 12, scale: pick(v, 1, 1.05, 1.12) });
  };

  /* Icecrawler: a low, wide ten-legged armoured crawler; overlapping pale blue chitin plates with frost spines,
   * dark blue-steel legs and mandibles. v0 standard, v1 dark with long spines (×1.1), v2 pale, short-spined (×0.92). */
  M.bst_icecrawler = function (pal, opt) {
    const v = V3(opt);
    const CH = pick(v, '#3c6888', '#2c5070', '#4e7e9c'), CHT = pick(v, '#8ec2dc', '#6ea6c8', '#a6d2e6');
    const LG = sh(CH, -0.35), LGT = sh(CHT, -0.3), FR = '#9ccce0', FRT = '#f6fcff', DK = '#162430', DKT = '#4a6a80';
    const spn = pick(v, 1, 1.45, 0.65);
    const plate = (x, rx, ry, h, i, dark) => [
      stack(dark ? sh(CH, -0.12) : CH, dark ? sh(CHT, -0.1) : CHT, [[1.4, rx * 0.9, ry * 0.88, x], [3.2, rx, ry, x], [3.2 + h * 0.55, rx * 0.84, ry * 0.86, x - 0.2], [3.2 + h, rx * 0.42, ry * 0.46, x - 0.5]], { ao: 0.42, bevel: true,
        detail: (c) => { c.save(); c.fillStyle = 'rgba(240,250,255,0.55)'; c.beginPath(); S.blob(c, x - 0.7, -0.1, rx * 0.26, i + 2, 7, 0.4); c.fill(); c.restore(); } }),
      tube(FR, FRT, () => [[[x + 0.2, 0, 3.2 + h - 0.1, 0.42 * Math.min(1.2, spn)], [x - 1.3, 0, 3.2 + h + 2.0 * spn, 0.08]], [[x, ry * 0.6, 3.2 + h * 0.55, 0.36 * Math.min(1.2, spn)], [x - 1.0, ry * 0.95, 3.2 + h * 0.55 + 1.5 * spn, 0.07]], [[x, -ry * 0.6, 3.2 + h * 0.55, 0.36 * Math.min(1.2, spn)], [x - 1.0, -ry * 0.95, 3.2 + h * 0.55 + 1.5 * spn, 0.07]]], { ao: 0 }),
    ];
    const P = [[-5.0, 2.2, 2.9, 2.3], [-2.5, 2.5, 3.5, 2.7], [0, 2.6, 3.7, 2.8], [2.5, 2.5, 3.5, 2.7], [5.0, 2.3, 3.0, 2.5]];
    const items = P.map((q, i) => ({ key: (a) => dep(a, q[0], 0), parts: plate(q[0], q[1], q[2], q[3], i) }));
    const headParts = plate(7.4, 1.9, 2.3, 2.0, 7, true).concat([
      tube(DK, DKT, () => [1, -1].map((s) => [[8.6, s * 1.55, 2.2, 0.46], [10.2, s * 1.6, 1.9, 0.36], [11.4, s * 0.7, 1.8, 0.14]]), { ao: 0.1 }),
    ], sideEye('#0a1420', 8.8, 1.25, 3.8, 0.42));
    items.push({ key: (a) => dep(a, 7.4, 0), parts: headParts });
    const under = [tube(CH, CHT, () => [[[-6.6, 0, 3.2, 1.1], [-8.6, 0, 2.6, 0.55], [-9.8, 0, 2.2, 0.15]]], { ao: 0.3 })];
    const legs = mlegs({ hipZ: 2.6, kneeZ: 4.8, stride: 1.0, lift: 1.1, r0: 0.62, r1: 0.5, r2: 0.28, col: LG, top: LGT, ao: 0.25, kneeOut: 2.2, footOut: 3.6 },
      [-4.4, -2.2, 0, 2.2, 4.4].flatMap((x, i) => [[x, -3.0, i % 2 ? 0.5 : 0, 2], [x, 3.0, i % 2 ? 0 : 0.5, 2]]));
    // quad needs a body part: an invisible zero-height probe keeps the group order intact
    const body = gp(CH, CHT, 3.0, 3.0, () => {}, { ao: 0 });
    return shiftX(quad({ legs: { list: [] }, items: legs.concat(items), under, body, r: 11.5, h: 9, scale: pick(v, 1, 1.1, 0.92) }), -0.8);
  };

  /* Rime elk: a giant dark elk with a frost-dusted back and huge sweeping antlers crusted with ice crystals
   * (flat cyan). v0 umber bull, v1 near-black great bull with the biggest rack and most ice (×1.12),
   * v2 younger grey-brown bull with a lighter rack (×0.95). */
  M.bst_rimeelk = function (pal, opt) {
    const v = V3(opt);
    const BR = pick(v, '#3e342c', '#2c2622', '#4a3e34'), FRO = pick(v, '#8e9ca4', '#86949c', '#98a4aa'), LO = sh(BR, -0.25);
    const HN = '#5e5248', HNT = '#bcae94', PAM = '#8a8078', PAMT = '#c4bcb0', ICE = '#7cd8ff';
    const ak = pick(v, 1, 1.25, 0.85), iceN = pick(v, 1, 1.5, 0.6);
    const B = { cx: -0.4, a: 6.6, bF: 2.8, bR: 2.5, n: 2.2, z0: 7.6, z1: 13.2, mid: 0.42, kT: 0.6, kB: 0.6 };
    const body = bodyPart(B, BR, FRO, { detail: clipped((c) => { c.save(); c.fillStyle = 'rgba(40,32,28,0.45)'; c.beginPath(); S.ell(c, 0.2, 0, 4.6, 0.42); c.fill(); c.fillStyle = 'rgba(255,255,255,0.55)'; for (const q of [[2.8, -1.0, 0.55], [0.5, 1.1, 0.46], [-2.0, -0.7, 0.5], [-3.5, 1.0, 0.38], [1.5, 1.5, 0.32], [-0.8, -1.5, 0.3]]) { c.beginPath(); S.blob(c, q[0], q[1], q[2], 4, 6, 0.4); c.fill(); } c.restore(); }) });
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.16;
    const beam = (s, b) => [[7.4, s * 0.7, 17.4 + b, 0.6], [6.2, s * 2.4 * ak, 19.3 + b, 0.54], [4.4, s * 4.4 * ak, 20.9 + 0.6 * ak + b, 0.46], [2.8, s * 6.0 * ak, 21.9 + 1.0 * ak + b, 0.34], [1.4, s * 7.0 * ak, 22.1 + 1.2 * ak + b, 0.2]];
    const tines = (s, b) => { const bm = beam(s, b); const t = (p, dx, dy, dz, r) => [[p[0], p[1], p[2], r + 0.16], [p[0] + dx, p[1] + s * dy, p[2] + dz, r]]; return [t(bm[0], 1.8, 0.6, 1.2, 0.16), t(bm[1], 1.6, 0.5, 2.0, 0.18), t(bm[2], 1.6, 0.7, 2.2 * ak, 0.18), t(bm[3], 1.2, 0.9, 2.1 * ak, 0.15)]; };
    const crystals = () => { const L = []; for (const s of [1, -1]) { const bm = beam(s, 0), tn = tines(s, 0); L.push([bm[1][0], bm[1][1], bm[1][2] + 0.2, 0.5], [bm[2][0] - 0.2, bm[2][1], bm[2][2] + 0.3, 0.56], [bm[3][0], bm[3][1], bm[3][2] + 0.2, 0.46], [bm[4][0], bm[4][1], bm[4][2], 0.4]); for (const q of tn) L.push([q[1][0], q[1][1], q[1][2], 0.38]); if (iceN > 1.2) L.push([lerp(bm[1][0], bm[2][0], 0.5), lerp(bm[1][1], bm[2][1], 0.5), lerp(bm[1][2], bm[2][2], 0.5) + 0.4, 0.48], [lerp(bm[2][0], bm[3][0], 0.5), lerp(bm[2][1], bm[3][1], 0.5), lerp(bm[2][2], bm[3][2], 0.5) + 0.4, 0.46]); } return iceN < 0.8 ? L.filter((q, i) => i % 2 === 0) : L; };
    const CR = crystals();
    const head = { at: [9, 0], parts: [
      tube(BR, FRO, (an) => [[[4.8, 0, 11.4, 2.0], [6.6, 0, 14.4 + bob(an) * 0.5, 1.6], [7.4, 0, 16.0 + bob(an), 1.4]]], { ao: 0.3 }),
      tube(LO, BR, (an) => [[[5.2, 0, 10.2, 1.0], [6.6, 0, 11.7 + bob(an) * 0.4, 0.9]]], { ao: 0.2, show: vis(1, 0, -0.5) }),
      tube(BR, sh(BR, 0.25), (an) => [[[7.8, 0, 16.4 + bob(an), 1.45], [9.5, 0, 15.8 + bob(an), 1.1], [10.7, 0, 15.1 + bob(an), 0.8]]], { ao: 0.15 }),
      tube(PAM, PAMT, (an) => [[[10.0, 0, 15.2 + bob(an), 0.85], [11.0, 0, 14.95 + bob(an), 0.66]]], { ao: 0, show: vis(1, 0, -0.3) }),
      tube('#141010', '#3a3030', (an) => [[[11.3, 0, 15.0 + bob(an), 0.36]]], { ao: 0 }),
      tube(BR, sh(BR, 0.25), (an) => [1, -1].map((s) => [[7.2, s * 1.0, 16.9 + bob(an), 0.36], [6.7, s * 2.1, 17.4 + bob(an), 0.28]]), { ao: 0 }),
      tube(HN, HNT, (an) => { const b = bob(an); return [beam(1, b), beam(-1, b)].concat(tines(1, b), tines(-1, b)); }, { ao: 0 }),
      gp(ICE, '#e8fbff', 17.2, 25.5, (c, z, an) => { const b = bob(an); for (const q of CR) ball(c, z, q[0], q[1], q[2] + b, q[3]); }, { flat: true, ao: 0 }),
    ].concat(sideEye('#100c0a', 8.3, 1.02, 16.3, 0.26)) };
    const sw = (an) => Math.sin(cyc(an) * 2) * 0.1;
    const tail = { at: [-6.9, 0], parts: [tube(BR, FRO, (an) => [[[-6.8, 0, 12.8, 0.48], [-7.3, 0, 11.7 + sw(an), 0.38]]], { ao: 0 })] };
    const legs = { list: legSet(4.6, 1.45, -5.0, 1.45), hipZ: 8.6, stride: 1.5, lift: 1.1, r0: 0.9, r1: 0.56, r2: 0.46, hoofH: 0.65, hock: 0.65, col: BR, top: sh(BR, 0.15), low: LO, hoof: '#120e0c' };
    return shiftX(quad({ legs, body, head, tail, r: 10, h: 25.6, scale: pick(v, 1, 1.12, 0.95) }), -2.0);
  };

  /* Snow hare: tiny, cheap. v0 white, v1 brown-backed (turning coat, ×0.95), v2 small leveret (×0.86). */
  M.crt_snowhare = function (pal, opt) {
    const v = V3(opt);
    const WH = pick(v, '#9cacbe', '#9aa6b0', '#a0b0c0'), WHT = pick(v, '#f6f6f2', '#dcd6cc', '#f4f4f0');
    const body = stack(WH, WHT, [[0.5, 1.45, 1.1, -0.3], [1.5, 1.75, 1.3, -0.25], [2.7, 1.55, 1.18, -0.05], [3.4, 0.85, 0.7, 0.3]], { ao: 0.35,
      detail: v === 1 ? clipped((c) => blobs(c, 'rgba(120,96,72,0.55)', [[-0.3, 0.1, 0.6, 2], [0.5, -0.3, 0.4, 4]])) : undefined });
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.08;
    const head = { at: [1.9, 0], parts: [
      tube(WH, WHT, (an) => [[[1.3, 0, 2.95 + bob(an), 0.9], [2.3, 0, 2.75 + bob(an), 0.55]]], { ao: 0.2 }),
      tube(WH, WHT, (an) => [1, -1].map((s) => [[1.1, s * 0.4, 3.6 + bob(an), 0.32], [0.45, s * 0.66, 5.4 + bob(an), 0.26]]), { ao: 0 }),
      tube('#1e1c1e', '#3a3638', (an) => [1, -1].map((s) => [[0.43, s * 0.67, 5.42 + bob(an), 0.26], [0.3, s * 0.74, 6.0 + bob(an), 0.1]]), { ao: 0 }),
      tube('#d8a0a0', '#f0c8c8', (an) => [[[2.8, 0, 2.7 + bob(an), 0.17]]], { ao: 0 }),
    ].concat(sideEye('#141214', 1.9, 0.62, 3.1, 0.2)) };
    const tail = { at: [-1.8, 0], parts: [tube(WH, '#ffffff', () => [[[-1.75, 0, 2.5, 0.48]]], { ao: 0 })] };
    const legs = [tube(sh(WH, -0.1), WH, (an) => {
      const f = (ph) => cyc(an, ph), hop = (ph) => [Math.cos(f(ph)) * 0.45, Math.max(0, -Math.sin(f(ph))) * 0.3];
      return [1, -1].map((s) => { const h = hop(s > 0 ? 0 : 0.5); return [[-0.9 + h[0], s * 0.95, 0.35 + h[1], 0.42], [-0.6, s * 0.9, 1.3, 0.55]]; })
        .concat([1, -1].map((s) => { const h = hop(s > 0 ? 0.5 : 0); return [[1.0 + h[0] * 0.8, s * 0.55, 0.3 + h[1], 0.26], [0.95, s * 0.5, 1.1, 0.3]]; }));
    }, { ao: 0.3 })];
    return quad({ legs: { list: [] }, under: legs, body, head, tail, r: 3.2, h: 6.3, scale: pick(v, 1, 0.95, 0.86) });
  };

  /* ================================================================
   * MORGRAVE — the blighted marsh
   * ================================================================ */
  /* Bloatling: a sagging bloated swamp bag on stubby splayed legs, a ridiculously small head, mottled
   * purplish skin and glowing pustules. v0 9 boils, v1 14 small bright boils (×1.12), v2 6 big boils (×0.9). */
  M.bst_bloatling = function (pal, opt) {
    const v = V3(opt);
    const SK = pick(v, '#766082', '#6a5e74', '#806684'), SKT = pick(v, '#b09cb8', '#a094a8', '#b8a2b8');
    const MOT = sh(SK, -0.3), PU = pick(v, '#c2e63c', '#d8ec58', '#aee036');
    const prof = [[0.7, 7.4, 5.9, -0.6], [2.2, 8.5, 6.6, -0.7], [4.2, 8.3, 6.5, -0.7], [6.2, 7.2, 5.8, -0.5], [8.2, 5.2, 4.3, 0.2], [9.6, 2.8, 2.3, 1.0], [10.2, 1.2, 1.0, 1.4]];
    const ring = ringProf(prof);
    const body = stack(SK, SKT, prof, { ao: 0.42 });
    const mott = [[0.6, 0.3, 5.0, 1.4], [1.6, 0.25, 3.4, 1.2], [2.5, 0.35, 6.2, 1.3], [-0.9, 0.3, 4.2, 1.3], [-2.0, 0.28, 6.6, 1.1], [-2.9, 0.3, 3.2, 1.0], [3.0, 0.22, 2.6, 0.9]].map((q) => patch(MOT, null, ring, q[0], q[1], q[2], q[3], { inK: 0.8, out: 1.03, ao: 0.35 }));
    const BL = pick(v,
      [[8.8, 0.3, 0.75, 1], [9.0, 2.4, 0.7, 1], [8.6, -1.4, 0.65, 1], [7.4, 1.5, 0.6], [7.0, -0.5, 0.7], [6.0, -2.3, 0.55], [7.8, 3.2, 0.5], [5.6, 2.8, 0.6], [6.6, -3.0, 0.5]],
      [[8.9, 0.2, 0.5, 1], [9.1, 2.2, 0.5, 1], [8.7, -1.3, 0.5, 1], [8.9, 1.2, 0.45, 1], [7.5, 1.6, 0.45], [7.2, -0.6, 0.5], [6.1, -2.2, 0.45], [7.9, 3.1, 0.4], [5.7, 2.7, 0.45], [6.7, -2.9, 0.42], [5.0, 0.9, 0.42], [4.6, -1.6, 0.4], [7.6, -2.4, 0.4], [8.2, 0.9, 0.42]],
      [[8.8, 0.4, 0.95, 1], [8.7, -1.5, 0.85, 1], [7.2, 1.8, 0.8], [6.4, -0.6, 0.85], [6.2, 2.9, 0.7], [5.4, -2.6, 0.75]]);
    const bo = boils(ring, BL, PU, '#f4ffb0');
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.15;
    const head = { at: [11.2, 0], parts: [
      tube(SK, SKT, (an) => [[[7.6, 0, 8.5, 1.3], [9.9, 0, 9.0 + bob(an), 1.1]]], { ao: 0.2 }),
      tube(SK, SKT, (an) => [[[11.0, 0, 9.1 + bob(an), 1.6]]], { ao: 0.2 }),
      tube('#2a1c30', '#3a2a40', (an) => [[[11.6, -0.95, 8.5 + bob(an), 0.24], [12.4, 0, 8.4 + bob(an), 0.28], [11.6, 0.95, 8.5 + bob(an), 0.24]]], { ao: 0, show: vis(1, 0, -0.3) }),
    ].concat(sideEye('#ffe040', 11.6, 0.78, 9.75, 0.38, true)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.5;
    const tail = { at: [-10.5, 0], parts: [tube(SK, SKT, (an) => [[[-8.6, 0, 2.6, 1.2], [-10.6, sw(an) * 0.5, 1.6, 0.8], [-12.0, sw(an), 0.9, 0.45]]], { ao: 0.3 })] };
    const legs = mlegs({ hipZ: 3.0, kneeZ: 2.7, stride: 0.8, lift: 0.5, r0: 1.05, r1: 0.9, r2: 0.72, col: sh(SK, -0.2), top: SK, ao: 0.35, kneeOut: 1.6, footOut: 2.4, toe: 0.6 },
      [[3.6, -5.6, 0, 2], [-3.6, -5.6, 0.5, 2], [3.6, 5.6, 0.5, 2], [-3.6, 5.6, 0, 2]]);
    return quad({ legs: { list: [] }, items: legs, body, core: mott.concat(bo), head, tail, r: 13, h: 11, scale: pick(v, 1, 1.12, 0.9) });
  };

  /* Stilt strider: a wrong, towering marsh thing — four very long thin knob-kneed legs, a small ragged body held
   * high and a drooping neck ending in a beaked head that hangs below the body. v0 grey hide, v1 taller dark
   * blotched (×1.12), v2 shorter, hunched and raggedier (×0.92). */
  M.bst_stiltstrider = function (pal, opt) {
    const v = V3(opt);
    const HI = pick(v, '#847a6e', '#6c625a', '#8e8274'), HIT = pick(v, '#b8ac9c', '#9a8e7e', '#c2b6a6');
    const LG = pick(v, '#9e968a', '#8a8278', '#a8a094'), LGT = sh(LG, 0.22), RAG = sh(HI, -0.35), EYE = '#8cff5a', BEAK = '#26221f', BEAKT = '#5a524c';
    const hipZ = 24.5, droop = pick(v, 1, 0.9, 1.15);
    const legs = mlegs({ hipZ, kneeZ: 12.8, stride: 2.8, lift: 2.4, r0: 0.8, r1: 0.95, r2: 0.44, col: LG, top: LGT, ao: 0.3, hock: 2.3, footR: 0.62 },
      [[3.0, -2.6, 0.25, 1], [-3.0, -2.6, 0.5, 1], [3.0, 2.6, 0.75, 1], [-3.0, 2.6, 0, 1]]);
    const prof = [[hipZ - 1.2, 4.0, 2.5, -0.4], [hipZ + 1.4, 4.9, 3.0, -0.3], [hipZ + 3.6, 4.5, 2.8, -0.1], [hipZ + 5.0, 2.6, 1.7, 0.3]];
    const body = stack(HI, HIT, prof, { ao: 0.4, jag: pick(v, 0.28, 0.22, 0.4), detail: clipped((c) => blobs(c, css(RAG, 0.5), [[0.4, 0.3, 0.9, 1], [-1.2, -0.7, 0.6, 3]])) });
    const ring = ringProf(prof);
    const rags = [[0.9, 0.16, hipZ + 0.6, 1.6], [2.3, 0.12, hipZ + 0.2, 1.3], [-1.4, 0.14, hipZ + 0.5, 1.5], [-2.7, 0.1, hipZ + 0.3, 1.2]].map((q) => patch(RAG, null, ring, q[0], q[1], q[2], q[3], { inK: 0.8, out: 1.04, ao: 0.3 }));
    if (v === 1) rags.push(patch('#b8aa98', null, ring, 1.6, 0.2, hipZ + 2.4, 0.9, { inK: 0.85 }), patch('#b8aa98', null, ring, -0.6, 0.18, hipZ + 2.0, 0.8, { inK: 0.85 }));
    const sx = (an) => Math.cos(cyc(an)) * 0.4, sy = (an) => Math.sin(cyc(an)) * 0.7;
    const hz = hipZ - 11.4 * droop;
    const head = { at: [11, 0], parts: [
      tube(HI, HIT, (an) => [[[3.8, 0, hipZ + 3.4, 1.2], [7.4, 0, hipZ + 1.6, 1.05], [9.8, sy(an) * 0.3, hipZ - 3.0 * droop, 0.9], [10.8, sy(an) * 0.7, hipZ - 8.0 * droop, 0.85], [10.6 + sx(an), sy(an), hz + 1.2, 0.95]]], { ao: 0.2 }),
      tube(HI, HIT, (an) => [[[10.4 + sx(an), sy(an), hz, 1.8]]], { ao: 0.25 }),
      tube(BEAK, BEAKT, (an) => [[[11.8 + sx(an), sy(an), hz - 0.5, 0.62], [14.0 + sx(an), sy(an) * 1.1, hz - 1.8, 0.36], [15.2 + sx(an), sy(an) * 1.2, hz - 3.0, 0.12]]], { ao: 0.1 }),
      gp(EYE, '#ffffff', hz + 0.1, hz + 0.9, (c, z, an) => { for (const s of [1, -1]) ball(c, z, 11.2 + sx(an), s * 1.2 + sy(an), hz + 0.5, 0.4); }, { flat: true, ao: 0,
        detail: (c, an) => { for (const s of [1, -1]) glow(c, EYE, 11.2 + sx(an), s * 1.2 + sy(an), 1.0, '#ffffff', 0.55); } }),
    ] };
    const tail = { at: [-6.5, 0], parts: [tube(RAG, HI, (an) => [[[-4.6, 0, hipZ + 2.2, 0.6], [-7.0, Math.sin(cyc(an)) * 0.4, hipZ - 1.2, 0.45], [-8.2, Math.sin(cyc(an)) * 0.7, hipZ - 4.6, 0.28]]], { ao: 0.2 })] };
    return shiftX(quad({ legs: { list: [] }, items: legs, body, core: rags, head, tail, r: 12.5, h: hipZ + 5.2, scale: pick(v, 1, 1.12, 0.92) }), -3.5);
  };

  /* Grave hound: a gaunt skeletal predator — ribs and knobbed spine showing through patchy hide, a long open jaw,
   * green glowing eyes. v0 grey hide, v1 more bone showing, bigger (×1.08), v2 dark mangy runt (×0.94). */
  M.bst_gravehound = function (pal, opt) {
    const v = V3(opt);
    const HI = pick(v, '#766e64', '#827a70', '#665e58'), HIT = pick(v, '#9a9284', '#a69c8e', '#867c70'), DK = sh(HI, -0.35);
    const BO = pick(v, BONE, '#dcd4bc', '#b8b09a'), BOT = pick(v, BONE_T, '#fcf8ea', '#dcd6c4'), EYE = '#8cff5a';
    const B = { cx: -0.3, a: 4.4, bF: 1.4, bR: 1.1, n: 2.1, z0: 4.2, z1: 6.6, mid: 0.45, kT: 0.6, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, HI, HIT, { detail: clipped((c) => blobs(c, css(DK, 0.7), [[-2.4, 0.4, 0.7, 2], [0.8, -0.5, 0.5, 5]])) });
    const rib = (tc) => { const sg = Math.sign(tc); return band(BO, BOT, ring, (z) => tc - 0.075 + sg * (6.4 - z) * 0.09, (z) => tc + 0.075 + sg * (6.4 - z) * 0.09, 4.3, 6.4, { out: 1.08, inK: 0.9, ao: 0.2 }); };
    const ribT = v === 1 ? [0.85, 1.08, 1.3, 1.52, 1.75] : [0.95, 1.2, 1.45, 1.7];
    const core = ribT.flatMap((t) => [rib(t), rib(-t)]).concat([
      patch(DK, null, ring, 2.5, 0.35, 5.6, 1.0, { inK: 0.8, out: 1.03 }), patch(DK, null, ring, -2.2, 0.3, 5.3, 0.9, { inK: 0.8, out: 1.03 }),
      tube(BO, BOT, () => [knobs([[3.4, 0, 6.75], [-4.2, 0, 6.7]], 11, 0.4, 0.26)], { ao: 0 }),
      tube(BO, BOT, () => [1, -1].map((s) => [[-3.3, s * 1.05, 6.6, 0.52]]).concat([1, -1].map((s) => [[2.6, s * 1.1, 6.6, 0.46]])), { ao: 0.1 }),
    ]);
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.1;
    const head = { at: [7, 0], parts: [
      tube(HI, HIT, (an) => [[[4.0, 0, 6.2, 0.9], [5.2, 0, 6.6 + bob(an), 0.85]]], { ao: 0.2 }),
      tube(sh(BO, -0.12), BOT, (an) => [[[5.9, 0, 6.65 + bob(an), 1.05], [6.9, 0, 6.35 + bob(an), 0.74], [8.5, 0, 5.95 + bob(an), 0.44]]], { ao: 0.2 }),
      tube(sh(BO, -0.12), BOT, (an) => [[[6.4, 0, 5.45 + bob(an), 0.4], [8.3, 0, 5.1 + bob(an), 0.25]]], { ao: 0.1 }),
      tube('#ffffff', '#ffffff', (an) => [7.1, 7.6, 8.1].map((x) => [[x, 0, 5.85 + bob(an), 0.12], [x + 0.05, 0, 5.45 + bob(an), 0.06]]), { ao: 0, show: vis(1, 0, -0.3) }),
      gp('#0e120c', '#0e120c', 6.4, 7.35, (c, z, an) => { for (const s of [1, -1]) ball(c, z, 6.4, s * 0.68, 6.88 + bob(an), 0.45); }, { flat: true, ao: 0 }),
      tube(DK, HI, (an) => [1, -1].map((s) => [[5.6, s * 0.7, 7.3 + bob(an), 0.3], [5.2, s * 1.0, 8.2 + bob(an), 0.12]]), { ao: 0 }),
    ].concat(glowEyes(EYE, 6.58, 0.68, 6.92, 0.3)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.45;
    const tail = { at: [-6, 0], parts: [tube(sh(BO, -0.2), BO, (an) => [knobs([[-4.6, 0, 6.2], [-6.4, sw(an), 5.2], [-7.6, sw(an) * 1.3, 4.0]], 9, 0.26, 0.16)], { ao: 0 })] };
    const legs = { list: legSet(2.7, 0.8, -3.1, 0.75), hipZ: 4.8, stride: 1.5, lift: 1.0, r0: 0.5, r1: 0.32, r2: 0.26, hoofH: 0.35, hock: 0.5, col: DK, top: HI, low: DK, hoof: '#2a2624' };
    return quad({ legs, body, core, head, tail, r: 9, h: 8.6, scale: pick(v, 1, 1.08, 0.94) });
  };

  /* Carrion crawler: a long, low, pale twelve-legged segmented crawler with mandibles and a bulbous venom-lit
   * tail. v0 bone-pale, v1 bruised purple-grey with a swollen tail (×1.1), v2 yellowed, long mandibles (×0.9). */
  M.bst_carrioncrawler = function (pal, opt) {
    const v = V3(opt);
    const SG = pick(v, '#a69c8a', '#948896', '#b0a278'), SGT = pick(v, '#dcd4c2', '#c4bac8', '#e4d8aa'), JT = sh(SG, -0.3);
    const LG = sh(SG, -0.12), LGT = sh(SGT, -0.08), MD = '#3a2e26', MDT = '#6a5a4a', GL = '#b4ff5a';
    const tb = pick(v, 2.3, 2.8, 2.1), ml = pick(v, 1, 1, 1.4);
    const segs = [[7.0, 1.5], [5.9, 1.0], [4.8, 1.65], [3.7, 1.05], [2.6, 1.65], [1.5, 1.05], [0.4, 1.65], [-0.7, 1.05], [-1.8, 1.65], [-2.9, 1.05], [-4.0, 1.6], [-5.1, 1.0]];
    const body = tube(SG, SGT, () => [segs.map((q) => [q[0], 0, 1.9, q[1]]).concat([[-6.2, 0, 2.1, 1.3], [-7.0, 0, 2.5, tb]])], { ao: 0.38 });
    const under = [tube(JT, SG, () => [[[6.6, 0, 1.9, 1.15], [-5.6, 0, 1.9, 1.15]]], { ao: 0.3 })];
    const core = [
      tube(MD, MDT, () => [[[-7.0 - tb * 0.85, 0, 2.6, 0.45], [-7.0 - tb * 1.25, 0, 3.3, 0.3], [-7.0 - tb * 1.5, 0, 4.1, 0.1]]], { ao: 0 }),
      gp(GL, '#f0ffc0', 2.5 + tb * 0.7, 2.5 + tb * 0.95 + 0.5, (c, z) => ball(c, z, -7.0, 0, 2.5 + tb * 0.75, 0.75), { flat: true, ao: 0, detail: (c) => glow(c, GL, -7.0, 0, 1.9, '#ffffff', 0.5) }),
      gp(JT, JT, 2.6, 3.9, (c, z) => { for (const q of segs) if (q[1] > 1.3) ball(c, z, q[0] - 0.1, 0, 2.0 + q[1] * 0.78, 0.5); }, { ao: 0, flat: true }),
    ];
    const head = { at: [8.5, 0], parts: [
      tube(MD, MDT, () => [1, -1].map((s) => [[7.8, s * 1.15, 1.6, 0.5], [7.8 + 1.5 * ml, s * 1.5, 1.4, 0.36], [7.8 + 2.6 * ml, s * 0.6, 1.3, 0.14]]), { ao: 0.1 }),
    ].concat(sideEye('#c02a1e', 8.0, 0.72, 2.85, 0.3, true), sideEye('#c02a1e', 7.4, 1.2, 2.6, 0.22, true)) };
    const legs = mlegs({ hipZ: 1.6, kneeZ: 3.5, stride: 0.9, lift: 0.9, r0: 0.38, r1: 0.34, r2: 0.17, col: LG, top: LGT, ao: 0.25, kneeOut: 1.9, footOut: 3.7 },
      [5.4, 3.6, 1.8, 0, -1.8, -3.6].flatMap((x, i) => [[x, -1.5, i % 2 ? 0.5 : 0, 2], [x, 1.5, i % 2 ? 0 : 0.5, 2]]));
    return quad({ legs: { list: [] }, items: legs, under, body, core, head, r: 11.5, h: 6.0, scale: pick(v, 1, 1.1, 0.9) });
  };

  /* Plague boar: a malformed boar — one huge curling tusk and one stub, mangy bare patches, glowing boils, one milky
   * eye. v0 4 boils, v1 two big mismatched tusks and 8 boils (×1.1), v2 dark, bald with mange and 6 boils (×0.92). */
  M.bst_plagueboar = function (pal, opt) {
    const v = V3(opt);
    const BR = pick(v, '#6a5a52', '#6e5e5a', '#5a4e48'), BRT = pick(v, '#9a8878', '#a08c80', '#86766c'), DK = sh(BR, -0.4), DKT = sh(BR, -0.12);
    const MG = '#c0aca4', MGT = '#dcc8c0', SN = '#8a6a66', SNT = '#c49a94', PU = '#d8d040';
    const B = { cx: -0.7, a: 4.7, bF: 2.2, bR: 1.9, n: 2.3, z0: 2.9, z1: 6.6, mid: 0.4, kT: 0.55, kB: 0.6 };
    const ring = bodyRing(B);
    const body = bodyPart(B, BR, BRT, { detail: clipped((c) => { blobs(c, css(MGT, 0.9), v === 2 ? [[0.5, 0.6, 1.0, 3], [-2.0, -0.4, 0.8, 4], [1.8, -0.6, 0.6, 5]] : [[-1.6, 0.7, 0.7, 3], [1.4, -0.5, 0.5, 4]]); c.strokeStyle = 'rgba(40,30,24,0.5)'; c.lineWidth = 0.16; c.beginPath(); for (let i = 0; i < 14; i++) { const x = -4.2 + i * 0.6, y = ((i * 37) % 7 - 3) * 0.3; c.moveTo(x, y); c.lineTo(x - 0.6, y + (y > 0 ? 0.4 : -0.4)); } c.stroke(); }) });
    const hump = stack(BR, BRT, [[5.3, 2.3, 1.7, 1.0], [6.6, 2.15, 1.55, 1.0], [7.3, 1.6, 1.1, 0.9], [7.6, 0.8, 0.55, 0.8]], { ao: 0.3 });
    const mange = (v === 2 ? [[0.7, 0.38, 5.2, 1.4], [1.9, 0.32, 4.2, 1.1], [-1.0, 0.32, 4.8, 1.3], [-2.6, 0.26, 5.4, 1.0]] : [[0.7, 0.32, 5.0, 1.2], [-1.2, 0.28, 4.6, 1.1], [2.4, 0.24, 4.0, 0.9]]).map((q) => patch(MG, MGT, ring, q[0], q[1], q[2], q[3], { inK: 0.8, out: 1.04, ao: 0.3 }));
    const BL = pick(v, [[6.0, 0.6, 0.46], [5.6, -1.1, 0.44], [6.2, 2.4, 0.38], [5.4, -2.6, 0.4]],
      [[6.0, 0.6, 0.48], [5.6, -1.1, 0.46], [6.2, 2.4, 0.4], [5.4, -2.6, 0.42], [5.0, 1.6, 0.36], [6.3, -0.3, 0.38], [4.6, -1.9, 0.36], [5.8, 1.9, 0.34]],
      [[5.9, 0.7, 0.52], [5.5, -1.2, 0.5], [6.1, 2.5, 0.42], [5.3, -2.7, 0.44], [4.8, 1.7, 0.4], [4.5, -0.6, 0.36]]);
    const bo = boils(ring, BL, PU, '#fcf8a0');
    const crest = tube(DK, DKT, () => [knobs([[3.2, 0, 7.3], [1.0, 0, 7.9], [-1.5, 0, 7.4], [-4.0, 0, 6.9]], 12, 0.36, 0.2)], { ao: 0 });
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.1;
    const big = (s, an) => [[5.95, s * 0.65, 3.7 + bob(an), 0.44], [6.9, s * 1.1, 4.4 + bob(an), 0.4], [7.35, s * 1.5, 5.8 + bob(an), 0.32], [6.9, s * 1.75, 7.1 + bob(an), 0.2], [6.2, s * 1.7, 7.7 + bob(an), 0.1]];
    const mid = (s, an) => [[5.95, s * 0.65, 3.7 + bob(an), 0.38], [6.7, s * 1.0, 4.3 + bob(an), 0.32], [6.9, s * 1.15, 5.3 + bob(an), 0.2]];
    const stub = (s, an) => [[5.95, s * 0.65, 3.7 + bob(an), 0.36], [6.5, s * 0.95, 4.1 + bob(an), 0.28]];
    const tusks = (an) => [big(1, an), v === 1 ? mid(-1, an) : stub(-1, an)];
    const head = { at: [5.2, 0], parts: [
      tube(DK, DKT, (an) => [[[4.0, 0.9, 6.3 + bob(an), 0.4], [3.7, 1.25, 7.3 + bob(an), 0.14]], [[4.0, -0.9, 6.3 + bob(an), 0.34], [3.9, -1.35, 6.9 + bob(an), 0.1]]], { ao: 0 }),
      tube(BR, BRT, (an) => [[[3.4, 0, 5.4 + bob(an), 1.5], [4.9, 0, 4.75 + bob(an), 1.1], [6.3, 0, 4.1 + bob(an), 0.7]]], { ao: 0.25 }),
      tube(SN, SNT, (an) => [[[6.4, 0, 4.05 + bob(an), 0.7], [6.9, 0, 3.95 + bob(an), 0.66]]], { ao: 0.1 }),
      tube(IVORY, IVORY_T, tusks, { ao: 0 }),
      gp('#ecece0', '#ffffff', 5.0, 5.8, (c, z, an) => ball(c, z, 5.15, 0.86, 5.4 + bob(an), 0.32), { flat: true, ao: 0, show: vis(0.4, 1, 0.15) }),
      gp('#e05a2a', '#ff9a60', 5.1, 5.7, (c, z, an) => ball(c, z, 5.1, -0.82, 5.4 + bob(an), 0.22), { flat: true, ao: 0, show: vis(0.4, -1, 0.15) }),
    ] };
    const sw = (an) => Math.sin(cyc(an) * 2) * 0.4;
    const tail = { at: [-5.3, 0], parts: [tube(DK, DKT, (an) => [[[-5.1, 0, 5.6, 0.2], [-5.5, sw(an), 4.7, 0.16], [-5.6, sw(an), 4.3, 0.28]]], { ao: 0 })] };
    const legs = { list: legSet(2.5, 1.1, -3.1, 1.05), hipZ: 3.4, stride: 1.0, lift: 0.6, r0: 0.66, r1: 0.44, r2: 0.34, hoofH: 0.45, hock: 0.3, col: BR, low: DK, lowT: DKT, hoof: '#1a1412' };
    return quad({ legs, body, core: [hump, crest].concat(mange, bo), head, tail, r: 8.5, h: 9.2, scale: pick(v, 1, 1.1, 0.92) });
  };

  /* Rat: tiny, cheap. v0 brown, v1 dark grey with a pale belly (×1.0), v2 pale sickly plague rat (×1.15). */
  M.crt_rat = function (pal, opt) {
    const v = V3(opt);
    const FU = pick(v, '#7a6e62', '#5e5856', '#9a948a'), FUT = pick(v, '#a89a8a', '#8c8682', '#c8c2b4'), PK = '#c88a80', PKT = '#eab0a4';
    const body = tube(FU, FUT, () => [[[-1.7, 0, 0.95, 0.95], [0.5, 0, 1.05, 0.85], [1.9, 0, 0.85, 0.5], [2.6, 0, 0.7, 0.3]]], { ao: 0.35 });
    const head = { at: [2.2, 0], parts: [
      tube(PK, PKT, () => [1, -1].map((s) => [[1.2, s * 0.58, 1.62, 0.32]]), { ao: 0 }),
      tube(PK, PKT, () => [[[2.85, 0, 0.7, 0.14]]], { ao: 0 }),
    ].concat(sideEye('#100e0e', 1.95, 0.4, 1.08, 0.13)) };
    const sw = (an) => Math.sin(cyc(an)) * 0.5;
    const tail = { at: [-3.5, 0], parts: [tube(PK, PKT, (an) => [[[-2.4, 0, 0.62, 0.2], [-3.6, sw(an), 0.45, 0.15], [-4.6, sw(an) * 1.7, 0.3, 0.1]]], { ao: 0 })] };
    const legs = [tube(sh(FU, -0.15), FU, (an) => [[-1.0, 0.6, 0], [-1.0, -0.6, 0.5], [1.1, 0.45, 0.5], [1.1, -0.45, 0]].map((q) => { const f = cyc(an, q[2]); return [[q[0] + Math.cos(f) * 0.35, q[1] * 1.2, 0.2 + Math.max(0, -Math.sin(f)) * 0.2, 0.17], [q[0], q[1], 0.8, 0.22]]; }), { ao: 0.2 })];
    return quad({ legs: { list: [] }, under: legs, body, head, tail, r: 5, h: 2.6, scale: pick(v, 1, 1.0, 1.15) });
  };

  /* ================================================================
   * gallery
   * ================================================================ */
  const it = (name, gen, v) => ({ name: name + ' v' + v, gen, pal: 'neutral', opt: { v }, dirs: 16, anims: 4 });
  const trio = (name, gen) => [it(name, gen, 0), it(name, gen, 1), it(name, gen, 2)];
  (AS.Gallery = AS.Gallery || []).push(
    { group: 'Beasts: Hrimgard', bg: 'ice', items: [].concat(trio('frosthulk', 'bst_frosthulk'), trio('woolly tusker', 'bst_woollytusker'), trio('snowstalker', 'bst_snowstalker'), trio('icecrawler', 'bst_icecrawler'), trio('rime elk', 'bst_rimeelk'), trio('snow hare', 'crt_snowhare')) },
    { group: 'Beasts: Morgrave', bg: 'undead', items: [].concat(trio('bloatling', 'bst_bloatling'), trio('stilt strider', 'bst_stiltstrider'), trio('grave hound', 'bst_gravehound'), trio('carrion crawler', 'bst_carrioncrawler'), trio('plague boar', 'bst_plagueboar'), trio('rat', 'crt_rat')) }
  );
})(window.AS);
