/* WYRMCROWN — giants, trolls, ogres and the rare colossi (models_giants.js).
 * A redesign pass of the big monsters: one giant, troll and ogre design per
 * kingdom plus four landmark-sized colossi. Everything is built with the
 * creature kit exported by models_units.js (AS.UnitKit): bipeds through the
 * `person` rig with giant proportions (tree-trunk legs, long arms, hunched
 * backs, huge bellies, small heads), quadrupeds and the stranger colossi from
 * the tube / stack / band primitives and the depth-sorted `assemble` groups.
 *
 * Every generator takes opt.v (0, 1, 2): visible individual variation (size,
 * hair, trophies, horns, broken gear, skin shift) so a pack never looks
 * stamped. Natural colours, `pal` is ignored. Sheets: 16 dirs × 4 walk frames.
 * Object space: +x = facing, +y = right, z up, world units × model.scale.
 *
 * Technique notes
 * - Parts that hang off the front or back of a body (jaws, humps, mantles,
 *   trophies, packs) live in their own depth group keyed by their anchor so
 *   they sort in front of / behind the torso as the figure turns.
 * - Shaggy fur and bark are profile stacks with a per-slice lumpy outline
 *   (`shag`), so the silhouette reads as hair without extra parts.
 * - Colossus legs are drawn as two parts (far side / near side of the body)
 *   instead of one part per leg: the forge cost is per slice, not per path. */
'use strict';
(function (AS) {
  const K = AS.UnitKit;
  const { lerp, hex, sh, css, cyc, dep, vis, viewA, assemble, ball, sweep, tube, gp, plane, stack, ringProf, profAt, band, patch, glow, clipped, blobs,
    HB, rig, person, hatHelm, visClip, ROPE, ROPE_T, BONE, BONE_T, IRON, IRON_T, STEEL, STEEL_T, LEATH } = K;
  const M = AS.Models, S = AS.Shapes, U = AS.U, TAU = U.TAU, PI = Math.PI;

  /* ================================================================
   * shared helpers
   * ================================================================ */
  const V = (opt) => ((((opt && opt.v) | 0) % 3) + 3) % 3;
  const pk = (v, a, b, c) => [a, b, c][v];
  const at = (x, y) => (a) => dep(a, x, y);
  const grp = (x, y, parts, shade) => ({ key: at(x, y), parts, shade: shade || 0 });
  const H = (R, s) => (an) => R.arm(s, an).h;

  // profile stack with a lumpy per-slice outline: fur, bark, moss (same profile format as `stack`)
  function shag(side, top, pr, o) {
    o = o || {};
    const z0 = pr[0][0], z1 = pr[pr.length - 1][0], N = o.n || 18, rough = o.rough || 0.22, seed = o.seed || 3, zf = o.zf || 3;
    return gp(side, top, z0, z1, (c, z, an) => {
      const q = profAt(pr, z), zi = Math.round(z * zf), x = (q[3] || 0) + (o.cx || 0) + (o.sway ? o.sway(an, z) : 0);
      for (let i = 0; i <= N; i++) {
        const t = i / N * TAU, k = 1 - rough / 2 + U.hash2(i % N, zi, seed) * rough;
        const px = x + Math.cos(t) * q[1] * k, py = (o.cy || 0) + Math.sin(t) * q[2] * k;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath();
    }, { ao: o.ao !== undefined ? o.ao : 0.35, bevel: o.bevel !== false, detail: o.detail, show: o.show, flat: o.flat });
  }
  // lumpy boulder around pos(an) → [x, y, z], radius r (vertical radius r × sq)
  function rockAt(side, top, pos, r, seed, o) {
    o = o || {};
    const sq = o.sq || 0.85;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < 4; i++) { const p = pos(i / 4); lo = Math.min(lo, p[2] - r * sq); hi = Math.max(hi, p[2] + r * sq); }
    return gp(side, top, Math.max(0, lo), hi, (c, z, an) => {
      const p = pos(an), d = (z - p[2]) / (r * sq); if (d <= -1 || d >= 1) return;
      const k = Math.sqrt(Math.max(0.12, 1 - d * d));
      S.blob(c, p[0], p[1], r * k, seed, o.lumps || 9, o.rough || 0.3);
    }, { ao: o.ao !== undefined ? o.ao : 0.35, bevel: true, flat: o.flat, show: o.show, detail: o.detail });
  }
  // chain / beads along a path: alternating radii
  function chain(pts, r, n) {
    const out = [], L = pts.length - 1; n = n || 8;
    for (let i = 0; i <= n; i++) { const t = i / n * L, j = Math.min(L - 1, Math.floor(t)), f = t - j, A = pts[j], B = pts[j + 1]; out.push([lerp(A[0], B[0], f), lerp(A[1], B[1], f), lerp(A[2], B[2], f), i % 2 ? r * 0.5 : r]); }
    return out;
  }
  // a skull as a tube polyline: cranium + jaw ball toward direction d (unit xy)
  const skullPL = (x, y, z, r, dx, dy) => [[x, y, z, r], [x + (dx || 1) * r * 0.55, y + (dy || 0) * r * 0.55, z - r * 0.42, r * 0.6]];
  // several bands in one part: strips [[t0, t1, z0, z1], ...] on a ring (clipped to the visible half)
  function strips(col, top, ring, list, o) {
    o = o || {};
    const kO = o.out || 1.05, kI = o.inK || 0.86;
    const za = Math.min(...list.map((l) => l[2])), zb = Math.max(...list.map((l) => l[3]));
    return { z0: za, z1: zb, side: hex(col), top: hex(top || col), bevel: false, ao: o.ao !== undefined ? o.ao : 0.08, flat: o.flat,
      shape: (c, zt) => {
        const a = viewA(c), z = lerp(za, zb, zt);
        for (const l of list) {
          if (z < l[2] || z > l[3]) continue;
          for (const iv of visClip(l[0], l[1], a)) {
            const n = Math.max(2, Math.ceil((iv[1] - iv[0]) / 0.18));
            for (let i = 0; i <= n; i++) { const q = ring(z, lerp(iv[0], iv[1], i / n), kO); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
            for (let i = n; i >= 0; i--) { const q = ring(z, lerp(iv[0], iv[1], i / n), kI); c.lineTo(q[0], q[1]); }
            c.closePath();
          }
        }
      } };
  }
  // tree-trunk club resting over the shoulder of arm s; o { side, top, r0, r1, r2, stubs, cap(h) → extra polylines }
  function clubOver(R, s, o) {
    o = o || {};
    const wood = hex(o.side || '#4e3a28'), woodT = hex(o.top || '#86684a'), h = H(R, s);
    const L = o.len || 1;
    const parts = [tube(wood, woodT, (an) => { const p = h(an); return [[[p[0] + 1.0, p[1] - 0.1 * s, p[2] - 0.7, o.r0 || 0.5], [p[0] - 1.2 * L, p[1] + s * 0.1, p[2] + 2.2 * L, o.r1 || 0.72], [p[0] - 2.8 * L, p[1] + s * 0.25, p[2] + 4.0 * L, o.r2 || 1.0]]]; }, { ao: 0.1 })];
    if (o.stubs !== false) parts.push(tube(sh(wood, -0.12), sh(woodT, -0.1), (an) => { const p = h(an); return [[[p[0] - 1.5 * L, p[1] + s * 0.6, p[2] + 2.8 * L, 0.26], [p[0] - 1.3 * L, p[1] + s * 1.4, p[2] + 3.4 * L, 0.15]], [[p[0] - 2.4 * L, p[1] - s * 0.5, p[2] + 3.7 * L, 0.25], [p[0] - 2.1 * L, p[1] - s * 1.25, p[2] + 4.3 * L, 0.15]]]; }, { ao: 0 }));
    if (o.extra) parts.push(...o.extra(h));
    return { under: parts };
  }
  // big toes / root feet: three stubs splaying forward from each foot (an items group below the body)
  function toes(R, D, col, top, o) {
    o = o || {};
    const n = o.n || 3, len = o.len || 0.55, r = o.r || 0.22, spread = o.spread || 0.5;
    return { key: () => -0.48, parts: [tube(col, top, (an) => {
      const out = [];
      for (const s of [1, -1]) { const f = R.foot(s, an), fx = f[0] + 0.58, fz = 0.32 + f[2] * 0.85; for (let i = 0; i < n; i++) { const yy = f[1] + (i - (n - 1) / 2) * spread; out.push([[fx - 0.1, yy * 0.98, fz, r], [fx + len, yy, fz - 0.05 + (o.lift || 0), r * 0.75]]); } }
      return out;
    }, { ao: 0.05 })] };
  }
  // heavy brow + eyes block for a big-jawed head: brow tube across the forehead (front-facing)
  const brow = (hx, hz, HR, col, top, o) => tube(col, top, () => [[[hx + HR * 0.72, -HR * 0.62, hz + HR * 0.38, HR * 0.26], [hx + HR * 0.86, 0, hz + HR * 0.32, HR * 0.3], [hx + HR * 0.72, HR * 0.62, hz + HR * 0.38, HR * 0.26]]], { ao: 0, show: vis(1, 0, (o && o.th) !== undefined ? o.th : -0.35) });
  // a pair of tusks rising from the jaw corners
  const tusks = (col, top, x, y, z, r, len, o) => tube(col, top, () => [1, -1].map((s) => [[x, s * y, z, r], [x + (o && o.fwd || 0.15), s * (y + 0.12), z + len * 0.6, r * 0.75], [x + (o && o.fwd || 0.15) * 2, s * (y + 0.18), z + len, r * 0.35]]), { ao: 0 });

  /* ================================================================
   * GIANTS — h ≈ 36-44 (base rig ~11.5 × scale 3.3-3.9)
   * common plan: tree-trunk legs, long arms, oversized hands, a hunched
   * back under a mantle (hides, fur, moss or bare bone), big belly, massive
   * shoulders, a small low-set head with a huge underbite jaw.
   * ================================================================ */
  const GIANT = { hip: 3.4, legY: 1.3, legR: 1.05, kneeR: 0.95, ankleR: 0.82, bootH: 1.1, kneeF: 0.2, stride: 1.0, lift: 0.5,
    shX: 0.55, shY: 2.95, shZ: 7.7, upper: 2.3, fore: 2.35, armR: 0.8, handR: 1.0, swing: 0.65,
    tRx: 2.0, tRy: 2.5, top: 8.2, headX: 1.6, headZ: 8.45, headR: 0.95, neckR: 0.85 };
  // belly + hunch profile (z, rx, ry, dx)
  const giantProf = (k) => { k = k || {}; const b = k.belly || 1, h = k.hunch || 1, w = k.w || 1; return [
    [3.2, 1.85 * b * w, 2.25 * b, -0.1], [4.3, 2.15 * b * w, 2.6 * b, 0.05], [5.4, 2.2 * b * w, 2.65 * b, 0.25 * h], [6.4, 1.95 * w, 2.45, 0.5 * h],
    [7.3, 1.85 * w, 2.7, 0.8 * h], [7.9, 1.5 * w, 2.45, 1.0 * h], [8.2, 0.85, 1.5, 1.15 * h]]; };
  // deltoid balls on the shoulders (arm group)
  const delts = (col, top, r) => (R, s) => tube(col, top, () => [[[R.D.shX - 0.15, s * (R.D.shY + 0.1), R.D.shZ + 0.25, r || 1.05]]], { ao: 0.2 });
  // hunched mantle: a dome over the shoulders whose crown sits behind the head (own depth group)
  const mantleProf = (D, o) => { o = o || {}; const z = D.top, rx = o.rx || 2.7, ry = o.ry || 3.5, x0 = D.headX - 1.2 + (o.dx || 0); return [
    [z - 1.1, rx, ry, x0 + 0.2], [z - 0.3, rx * 0.97, ry * 0.97, x0 + 0.1], [z + 0.4, rx * 0.78, ry * 0.8, x0 - 0.15], [z + 0.9, rx * 0.42, ry * 0.45, x0 - 0.45]]; };
  const mantle = (col, top, D, o) => { o = o || {}; const pr = mantleProf(D, o); return grp(D.headX - 1.6, 0, [shag(col, top, pr, { rough: o.rough || 0.26, seed: o.seed || 3, n: o.n || 20, ao: 0.35 })].concat(o.extra ? o.extra(pr) : [])); };
  // massive underbite jaw: a wide slab hanging below the front of the head, with optional tusks,
  // a tooth row and a heavy brow (own depth group so it sorts in front of / behind the head)
  function jaw(D, col, top, o) {
    o = o || {};
    const hx = D.headX, hz = D.headZ, HR = D.headR;
    const ry = (o.w || 0.95) * HR, rx = (o.d || 0.7) * HR, zc = hz - HR * (o.dz || 0.85), hh = (o.h || 0.5) * HR, x0 = hx + HR * (o.fwd || 0.55);
    const parts = [gp(sh(col, -0.1), col, zc - hh, zc + hh, (c, z) => { const u = (z - (zc - hh)) / (2 * hh); S.ell(c, x0 + u * 0.15 * HR, 0, rx * (0.85 + 0.15 * u), ry * (0.8 + 0.2 * u)); }, { ao: 0.25, bevel: true })];
    if (o.tusks) parts.push(tusks(o.tusks[0], o.tusks[1], x0 + rx * 0.7, ry * 0.72, zc + hh * 0.2, o.tuskR || 0.2, o.tuskLen || 0.7));
    if (o.teeth) parts.push(tube(o.teeth[0], o.teeth[1], () => [[[x0 + rx * 0.95, -ry * 0.5, zc + hh * 0.75, 0.14], [x0 + rx * 0.95, ry * 0.5, zc + hh * 0.75, 0.14]]], { ao: 0, show: vis(1, 0, 0) }));
    if (o.brow) parts.push(tube(o.brow[0], o.brow[1], () => [[[hx + HR * 0.7, -HR * 0.62, hz + HR * 0.58, HR * 0.22], [hx + HR * 0.86, 0, hz + HR * 0.52, HR * 0.26], [hx + HR * 0.7, HR * 0.62, hz + HR * 0.58, HR * 0.22]]], { ao: 0, show: vis(1, 0, -0.35) }));
    if (o.extra) parts.push(...o.extra);
    return grp(x0 + rx, 0, parts);
  }
  // pointed ears out of the sides of the head (core part via head.hat)
  const ears = (col, top, k, o) => (D2) => [tube(col, top, () => [1, -1].map((s) => [[D2.headX - 0.1, s * D2.headR * 0.92, D2.headZ + 0.15, 0.24 * (k || 1)], [D2.headX - 0.25 - (o && o.back || 0), s * D2.headR * (1.35 + (o && o.len || 0)), D2.headZ + 0.3 + (o && o.up || 0), 0.12 * (k || 1)]]), { ao: 0 })];
  // skull trophies: one part per anchor side (front / back sort), list [[x, y, z, r, dx, dy], ...]
  const skulls = (list, col, top) => { const front = list.filter((q) => q[0] >= 0), back = list.filter((q) => q[0] < 0); const mk = (l) => grp(l[0][0], l[0][1], [tube(col || BONE, top || BONE_T, () => l.map((q) => skullPL(q[0], q[1], q[2], q[3], q[4], q[5])), { ao: 0.1 })]); return (front.length ? [mk(front)] : []).concat(back.length ? [mk(back)] : []); };
  const giantHead = (SK, o) => { o = o || {}; const e = ears(sh(SK, -0.04), sh(SK, 0.2), 1.1); return Object.assign({ headSide: sh(SK, -0.04), headTop: sh(SK, 0.32), eyes: '#1e1410', eyeR: 0.2, nose: 0.3, style: 'bald' }, o, { hat: (D2) => e(D2).concat(o.hat ? o.hat(D2) : []) }); };

  /* ---------------- hill giant (Aldermere / neutral) ---------------- */
  M.gnt_hill = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#c28a62', '#b8805a', '#cc9670'), SKT = sh(SK, 0.24), SKD = sh(SK, -0.2);
    const HIDE = pk(v, '#6e4e30', '#64482e', '#765636'), HIDET = sh(HIDE, 0.32), HIDE2 = '#a08058', HIDE2T = '#d0ae80';
    const dims = Object.assign({}, GIANT, { legY: 1.35, headR: 0.92 });
    const D = Object.assign({}, HB, dims);
    const clubPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.55, s * 3.3, 6.0], h: [1.2 + w, s * 2.5, 6.6] }; };
    const pose = { R: clubPose }, R = rig(D, pose);
    const prof = giantProf({ belly: 1.06, hunch: 0.9 });
    const ring = ringProf(prof);
    const kiltPr = [[1.9, 2.1, 2.55, -0.05], [3.0, 2.15, 2.6, -0.05], [3.9, 2.05, 2.5, -0.05]];
    const items = [
      // hide poncho over the shoulders and hunched back, one lighter patch of a different pelt
      mantle(HIDE, HIDET, D, { seed: 7 + v, rough: 0.2, extra: (pr) => [patch(HIDE2, HIDE2T, ringProf(pr), v === 1 ? 2.3 : -2.2, 0.55, 7.75, 0.8, { out: 1.04, inK: 0.9 })] }),
      jaw(D, SK, SKT, { tusks: ['#d8cca8', '#fff8e4'], tuskR: 0.24, tuskLen: 0.8, brow: [SKD, SK] }),
      // belly: lighter skin on the front
      grp(0.3, 0, [patch(sh(SK, 0.1), sh(SK, 0.3), ring, 0, 0.95, 4.7, 1.2, { out: 1.02, inK: 0.9 })]),
      // hide kilt with a patch (drawn under the torso)
      { key: () => -0.45, parts: [stack(HIDE, HIDET, kiltPr, { ao: 0.35, jag: 0.16 }), patch(HIDE2, HIDE2T, ringProf(kiltPr), 0.9, 0.45, 2.9, 0.75, { out: 1.04, inK: 0.9 })] },
      // sheep-skull trophies on the rope belt + the knot
      ...skulls(pk(v, [[2.15, -1.1, 4.55, 0.42, 1, -0.3], [1.3, 2.3, 4.5, 0.38, 0.4, 1]], [[2.1, 1.2, 4.6, 0.42, 1, 0.3]], [[2.15, -1.1, 4.55, 0.42, 1, -0.3], [1.3, 2.3, 4.5, 0.38, 0.4, 1], [-0.6, -2.5, 4.4, 0.36, -0.3, -1]])),
      grp(2.3, 0.2, [tube(ROPE, ROPE_T, () => [[[2.25, 0.25, 4.5, 0.3]], [[2.05, 0.35, 4.3, 0.17], [2.4, 0.55, 3.5, 0.14]], [[2.05, 0.05, 4.3, 0.17], [2.3, -0.3, 3.6, 0.14]]], { ao: 0 })]),
    ];
    if (v === 1) items.push(grp(-0.2, -3.0, [tube(IRON, IRON_T, () => [[[0.3, -2.95, 8.35, 0.85], [-0.5, -3.3, 7.6, 0.75]]], { ao: 0.2 })])); // dented iron pauldron
    const head = giantHead(SK, v === 1 ? { beard: '#5a3a22', beardLen: 0.9 } : v === 2 ? { hair: '#4a2e1a', style: 'bun', fringe: -0.5 } : {});
    const bandsL = [{ col: ROPE, top: ROPE_T, t0: -PI, t1: PI, z0: 4.25, z1: 4.75, out: 1.08, inK: 0.86 }];
    if (v !== 1) bandsL.push({ col: SKD, t0: 0.25, t1: 0.9, z0: 5.1, z1: 5.35, out: 1.04, inK: 0.9 }); // belly scar
    return person({ skin: SK }, {
      dims, pose, skin: SK, legs: SK, boots: SKD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      bands: bandsL, pauldron: delts(SK, SKT, 1.08),
      heldR: [clubOver(R, 1, { len: 0.95, r2: 1.05 })],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.24, len: 0.5, spread: 0.55 })]),
      r: 4.4, h: 11.3, scale: 3.4 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- frost giant (Hrimgard) ---------------- */
  M.gnt_frost = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#7c90a8', '#728aa4', '#8494a8'), SKT = sh(SK, 0.26), SKD = sh(SK, -0.24);
    const FUR = pk(v, '#5c5048', '#4e4642', '#665a4e'), FURT = sh(FUR, 0.5);
    const ICE = '#cfe8f6', ICET = '#f4fbff', STONE = '#4c5560', STONET = '#8e9aa6';
    const dims = Object.assign({}, GIANT, { shX: 0.8, shY: 3.05, shZ: 7.9, headX: 2.0, headZ: 8.2, headR: 0.95, neckR: 0.9, bootH: 1.8, top: 8.3 });
    const D = Object.assign({}, HB, dims);
    const clubPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.7, s * 3.4, 6.1], h: [1.4 + w, s * 2.6, 6.5] }; };
    const pose = { R: clubPose }, R = rig(D, pose);
    const prof = [[3.2, 1.85, 2.3, -0.1], [4.3, 2.1, 2.55, 0.1], [5.4, 2.1, 2.6, 0.4], [6.4, 1.95, 2.5, 0.75], [7.3, 1.9, 2.75, 1.1], [7.9, 1.55, 2.5, 1.35], [8.3, 0.9, 1.5, 1.5]];
    // ice-crusted stone club
    const club = clubOver(R, 1, { side: STONE, top: STONET, r0: 0.5, r1: 0.8, r2: 1.1, stubs: false, len: 0.95,
      extra: (h) => [tube(ICE, ICET, (an) => { const p = h(an); return [[[p[0] - 2.4, p[1] + 0.7, p[2] + 4.1, 0.42]], [[p[0] - 3.0, p[1] - 0.4, p[2] + 3.7, 0.38]], [[p[0] - 1.8, p[1] - 0.6, p[2] + 2.9, 0.3]], [[p[0] - 2.8, p[1] + 0.2, p[2] + 4.6, 0.3], [p[0] - 2.9, p[1] + 0.2, p[2] + 5.3, 0.1]]]; }, { ao: 0, flat: true })] });
    const items = [
      // fur mantle: shaggy dome over the hunched shoulders, icicles hanging off it for v1
      mantle(FUR, FURT, D, { seed: 5 + v, rough: 0.3, rx: 2.75, ry: 3.6, dx: -0.3, extra: v === 1 ? () => [tube(ICE, ICET, () => [[[-1.0, -1.2, 8.6, 0.14], [-1.2, -1.3, 7.5, 0.05]], [[-0.8, 1.3, 8.6, 0.14], [-0.9, 1.4, 7.7, 0.05]], [[-1.9, 0.2, 8.4, 0.12], [-2.1, 0.2, 7.4, 0.05]]], { ao: 0, flat: true })] : null }),
      // braids over the shoulders with bone beads
      grp(D.headX + 0.4, 0, [tube('#d9c9a0', '#f4ead0', () => [1, -1].map((s) => chain([[D.headX - 0.3, s * 0.8, D.headZ + 0.3], [D.headX + 0.5, s * 1.35, D.headZ - 0.9], [D.headX + 0.7, s * 1.5, D.headZ - 2.6]], 0.3, 7)), { ao: 0.1 })]),
      jaw(D, SK, SKT, { brow: [SKD, SK], extra: [
        // icicle beard
        tube('#cbdde8', '#f6fbff', () => [[[D.headX + 0.6, 0, D.headZ - 0.9, 0.62], [D.headX + 1.0, 0, D.headZ - 1.35, 0.55], [D.headX + 1.1, 0, D.headZ - 1.75, 0.3]]], { ao: 0.1, show: vis(1, 0, -0.42) }),
        tube(ICE, ICET, () => [[[D.headX + 1.1, -0.35, D.headZ - 1.2, 0.2], [D.headX + 1.15, -0.4, D.headZ - 2.2, 0.06]], [[D.headX + 1.35, 0.1, D.headZ - 1.25, 0.22], [D.headX + 1.4, 0.1, D.headZ - 2.5, 0.06]], [[D.headX + 1.05, 0.5, D.headZ - 1.2, 0.18], [D.headX + 1.1, 0.55, D.headZ - 2.0, 0.06]]], { ao: 0, flat: true, show: vis(1, 0, -0.35) }),
      ] }),
      // skulls on a rope across the chest
      grp(2.0, 0.3, [tube(ROPE, ROPE_T, () => [[[0.3, -2.9, 7.6, 0.14], [1.9, -1.2, 6.2, 0.14], [2.2, 0.4, 5.8, 0.14], [1.6, 2.1, 6.3, 0.14], [0.3, 3.0, 7.5, 0.14]]], { ao: 0 }),
        tube(BONE, BONE_T, () => [skullPL(2.05, -0.75, 6.05, 0.4, 1, -0.2), skullPL(2.1, 0.7, 5.9, 0.4, 1, 0.2)].concat(v === 2 ? [skullPL(1.7, 1.9, 6.35, 0.36, 0.8, 0.6)] : []), { ao: 0.1 })]),
    ];
    const head = giantHead(SK, { headTop: sh(SK, 0.36), eyes: '#bfe8ff', eyeFlat: true, eyeR: 0.2, eyeGlow: true, nose: 0.28, hair: '#d9c9a0', style: 'long', fringe: -0.3 });
    return person({ skin: SK }, {
      dims, pose, skin: SK, legs: SK, boots: FUR, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      bands: [
        { col: FUR, top: FURT, t0: -PI, t1: PI, z0: 3.2, z1: 3.9, out: 1.09, inK: 0.86 },
        { col: LEATH, top: '#9a7046', t0: -PI, t1: PI, z0: 4.5, z1: 4.95, out: 1.08, inK: 0.86 },
        { col: '#6a7a8a', top: '#b8c8d4', t0: -PI, t1: PI, z0: 4.55, z1: 4.9, out: 1.1, inK: 1.02 },
      ],
      pauldron: delts(SK, SKT, 1.1),
      heldR: [club],
      head, items: items.concat([toes(R, D, FUR, FURT, { r: 0.26, len: 0.45, spread: 0.55, n: 2 })]),
      r: 4.6, h: 11.4, scale: 3.45 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- wood colossus (Sylvara) ---------------- */
  M.gnt_wood = function (pal, opt) {
    const v = V(opt);
    const BK = pk(v, '#7d6a56', '#74644e', '#86735e'), BKT = sh(BK, 0.3), BKD = sh(BK, -0.28);
    const MOSS = pk(v, '#6f9a34', '#5e8c30', '#7aa63c'), MOSST = sh(MOSS, 0.4), FERN = '#8fcf4a', FERNT = '#d2f58c';
    const ANT = '#a89070', ANTT = '#e4d4b0', GL = '#9cff5a';
    const dims = Object.assign({}, GIANT, { legR: 0.95, kneeR: 0.9, ankleR: 0.95, bootH: 1.2, upper: 2.9, fore: 2.9, armR: 0.72, handR: 0.95, swing: 0.6, shX: 0.6, shZ: 7.8, shY: 2.8,
      headX: 1.7, headZ: 8.55, headR: 1.0, neckR: 0.9, top: 8.3 });
    const D = Object.assign({}, HB, dims);
    const rockPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.9, s * 3.4, 5.9], h: [1.55 + w, s * 2.7, 6.5] }; };
    const pose = { R: rockPose }, R = rig(D, pose);
    const prof = [[3.2, 1.9, 2.3, -0.1], [4.3, 2.05, 2.5, 0.05], [5.4, 2.0, 2.5, 0.25], [6.4, 1.9, 2.45, 0.45], [7.3, 1.9, 2.75, 0.75], [7.9, 1.6, 2.5, 0.95], [8.3, 0.95, 1.55, 1.1]];
    const ring = ringProf(prof);
    // boulder held like a club
    const hand = H(R, 1);
    const boulder = { under: [rockAt('#6a6e68', '#b8bcb2', (an) => { const p = hand(an); return [p[0] - 0.2, p[1] + 0.15, p[2] + 1.4]; }, 1.5, 11 + v, { sq: 0.8, rough: 0.28, lumps: 9, ao: 0.4 }),
      tube(MOSS, MOSST, (an) => { const p = hand(an); return [[[p[0] - 0.9, p[1] + 0.5, p[2] + 2.4, 0.42]], [[p[0] + 0.4, p[1] - 0.6, p[2] + 2.2, 0.32]]]; }, { ao: 0 })] };
    // antler / branch crown
    const crown = (D2) => { const hx = D2.headX, hz = D2.headZ + D2.headR; return [tube(ANT, ANTT, () => [1, -1].map((s) => [[hx - 0.2, s * 0.45, hz - 0.3, 0.3], [hx - 0.5, s * 1.0, hz + 0.7, 0.26], [hx - 0.4, s * 1.6, hz + 1.7, 0.2], [hx + 0.1, s * 1.9, hz + 2.5, 0.12]]).concat([1, -1].map((s) => [[hx - 0.45, s * 0.9, hz + 0.6, 0.2], [hx + 0.35, s * 1.1, hz + 1.5, 0.11]]), [[[hx - 0.1, 0, hz - 0.2, 0.26], [hx - 0.5, 0, hz + 1.2, 0.2], [hx - 0.3, v === 2 ? 0.3 : 0, hz + 2.2, 0.1]]]), { ao: 0 })]; };
    const items = [
      // moss growing over the hunched shoulders, ferns sprouting from it
      mantle(MOSS, MOSST, D, { seed: 9 + v, rough: 0.34, n: 22, rx: 2.5, ry: 3.3, extra: () => [
        tube(FERN, FERNT, () => [[[0.3, 2.4, 8.7, 0.15], [1.0, 3.2, 9.9, 0.08]], [[0.1, 2.1, 8.8, 0.15], [-0.6, 3.1, 10.1, 0.08]], [[0.0, -2.5, 8.7, 0.15], [0.6, -3.3, 10.0, 0.08]], [[-0.7, 0.2, 9.1, 0.17], [-1.8, -0.5, 10.4, 0.08]], [[-0.8, 0.5, 9.1, 0.17], [-1.5, 1.4, 10.3, 0.08]]].concat(v === 2 ? [[[-0.3, -2.2, 8.8, 0.15], [-1.1, -3.0, 9.9, 0.08]]] : []), { ao: 0 })] }),
      // knot holes and a bark seam on the trunk-belly
      grp(0.3, 0, [patch('#4a3828', '#6a5440', ring, v === 1 ? -0.6 : 0.55, 0.3, 5.2, 0.55, { out: 1.03, inK: 0.9 }), strips(BKD, null, ring, [[-0.2, -0.05, 3.4, 7.2], [1.15, 1.3, 3.6, 6.4]], { out: 1.03, inK: 0.9 })]),
      jaw(D, BK, BKT, { w: 0.85, d: 0.62, brow: [BKD, BK] }),
    ];
    const head = giantHead(BK, { headTop: sh(BK, 0.36), eyes: GL, eyeFlat: true, eyeR: 0.25, eyeGlow: true, nose: 0, hat: crown });
    return person({ skin: BK }, {
      dims, pose, skin: BK, legs: BK, boots: BKD, torso: prof, torsoSide: BK, torsoTop: BKT, sleeve: BK, hands: BKD,
      bands: [{ col: MOSS, top: MOSST, t0: PI - 1.1, t1: PI + 1.1, z0: 6.4, z1: 7.4, out: 1.06, inK: 0.86 }],
      pauldron: delts(BK, BKT, 1.0),
      heldR: [boulder],
      head, items: items.concat([toes(R, D, BKD, BK, { r: 0.2, len: 0.85, spread: 0.6, n: 4 })]),
      r: 4.85, h: 11.9, scale: 3.4 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- corpse giant (Morgrave) ---------------- */
  M.gnt_corpse = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#8a9686', '#86927e', '#929a8c'), SKT = sh(SK, 0.26), SKD = sh(SK, -0.26);
    const HIDE = pk(v, '#a09080', '#9a8a7c', '#a89686'), HIDET = sh(HIDE, 0.25), GL = '#93ff6a', RUST = '#7a4e30', RUSTT = '#b88458';
    const dims = Object.assign({}, GIANT, { legR: 0.85, kneeR: 0.8, ankleR: 0.72, tRx: 1.5, tRy: 2.1, shY: 2.75, shX: 0.7, shZ: 7.9, upper: 2.5, fore: 2.5, armR: 0.62, handR: 0.95,
      headX: 2.0, headZ: 8.35, headR: 0.95, neckR: 0.62, top: 8.3 });
    const D = Object.assign({}, HB, dims);
    const cleaverPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.7, s * 3.2, 6.0], h: [1.35 + w, s * 2.5, 6.3] }; };
    const pose = { R: cleaverPose }, R = rig(D, pose);
    const prof = [[3.2, 1.45, 1.95, -0.1], [4.3, 1.55, 2.05, 0.05], [5.4, 1.5, 2.1, 0.3], [6.4, 1.55, 2.3, 0.6], [7.3, 1.65, 2.65, 0.95], [7.9, 1.4, 2.4, 1.2], [8.3, 0.8, 1.4, 1.35]];
    const ring = ringProf(prof);
    // rusted giant cleaver over the shoulder: a slanted slab blade with a notch and a broken tip
    const hand = H(R, 1);
    const cleaver = { under: [
      tube('#3a3028', '#6a5a48', (an) => { const p = hand(an); return [[[p[0] + 0.9, p[1], p[2] - 0.6, 0.3], [p[0] - 0.7, p[1] + 0.1, p[2] + 1.4, 0.3]]]; }, { ao: 0.05 }),
      gp(RUST, RUSTT, 6.0, 11.8, (c, z, an) => { const p = hand(an); const zb = p[2] + 1.2; const u0 = -0.7 - (z - zb) * 0.72; if (z < zb - 0.2 || z > zb + 4.4) return; const len = z > zb + 3.7 ? 3.0 - (z - zb - 3.7) * 2.8 : 3.0; if (len < 0.3) return; plane(c, z, p[0] + u0, p[1] + 0.1, 0, 0.5, 0, len, (u, zz) => !(zz > zb + 2.2 && zz < zb + 2.8 && u > 2.3) && !(zz < zb + 0.9 && u > 2.4 && zz - zb < (u - 2.4) * 2)); }, { ao: 0.05 }),
    ] };
    // exposed ribs with ghost-fire inside
    const chest = [
      band('#1c201a', null, ring, -0.95, 0.95, 5.2, 7.6, { out: 1.02, inK: 0.7 }),
      band(GL, '#e8ffd8', ring, -0.7, 0.7, 5.45, 7.35, { out: 1.0, inK: 0.78, flat: true }),
      strips('#d8d0b8', '#f2ead4', ring, [[-0.98, 0.98, 5.45, 5.62], [-1.0, 1.0, 6.0, 6.17], [-0.98, 0.98, 6.55, 6.72], [-0.9, 0.9, 7.1, 7.27]], { out: 1.07, inK: 0.9 }),
    ];
    const collarZ = 7.95;
    const items = [
      // bony hunched back: vertebrae beads down the spine
      grp(-0.9, 0, [stack(SK, sh(SK, 0.1), [[7.2, 1.2, 1.7, -0.4], [8.3, 1.25, 1.75, -0.6], [8.9, 0.7, 1.0, -0.8]], { ao: 0.3 }),
        tube('#cfc6ae', '#efe8d4', () => [chain([[-0.9, 0, 9.0], [-1.45, 0, 7.5], [-1.7, 0, 6.0]], 0.25, 7)], { ao: 0.1 })]),
      grp(1.2, 0, chest),
      // stitched hide patches with seams
      grp(0.1, 2.0, [patch(HIDE, HIDET, ring, 1.5, 0.55, 5.6, 1.4, { out: 1.03, inK: 0.9 }), tube('#2a2a26', '#4a4a44', () => [[[0.6, 2.05, 6.9, 0.1], [0.3, 2.3, 4.5, 0.1]], [[0.75, 1.75, 6.3, 0.1], [0.35, 2.4, 6.4, 0.1]], [[0.6, 1.85, 5.5, 0.1], [0.2, 2.5, 5.6, 0.1]], [[0.45, 1.95, 4.9, 0.1], [0.1, 2.6, 5.0, 0.1]]], { ao: 0 })]),
      grp(0.1, -2.0, [patch(HIDE, HIDET, ring, -1.9, 0.5, 4.6, 1.0, { out: 1.03, inK: 0.9 })]),
      // iron collar and a hanging chain
      grp(D.headX - 0.2, 0, [tube(IRON, IRON_T, () => { const n = 10, pts = [], cx = D.headX - 0.15; for (let i = 0; i <= n; i++) { const t = i / n * TAU; pts.push([cx + Math.cos(t) * 0.95, Math.sin(t) * 0.92, collarZ, 0.3]); } return [pts]; }, { ao: 0.1 }),
        tube('#3e4044', '#8a8e94', () => [chain([[D.headX + 0.6, 0.55, collarZ - 0.2], [D.headX + 0.95, 1.0, collarZ - 1.5], [D.headX + 0.6, 1.3, collarZ - 3.3]], 0.27, 8)], { ao: 0 })]),
      jaw(D, SK, SKT, { w: 0.85, teeth: ['#d8d0b8', '#f4ecd4'], brow: [SKD, SK] }),
    ];
    if (v !== 1) items.push(grp(0, -2.9, [tube('#4a4a4e', '#9a9ea4', () => [[[0.5, -2.9, 8.45, 0.9], [-0.3, -3.25, 7.65, 0.78]]], { ao: 0.2 }), tube(STEEL, STEEL_T, () => [[[0.4, -3.6, 8.9, 0.15], [0.5, -4.2, 9.6, 0.06]], [[-0.2, -3.5, 8.8, 0.15], [-0.5, -4.1, 9.5, 0.06]]], { ao: 0 })])); // broken spiked pauldron
    if (v === 2) items.push(grp(0.5, 2.6, [tube('#3e4044', '#8a8e94', (an) => { const p = R.arm(-1, an).h; return [chain([[p[0] - 0.3, p[1] - 0.2, p[2] - 0.3], [p[0] - 1.5, p[1] - 0.4, 2.2]], 0.27, 6)]; }, { ao: 0 })])); // chain trailing from the wrist
    const head = giantHead(SK, { headTop: sh(SK, 0.34), eyes: GL, eyeFlat: true, eyeR: 0.24, eyeGlow: true, style: v === 1 ? 'short' : 'bald', hair: '#3a3a36', fringe: -0.5 });
    return person({ skin: SK }, {
      dims, pose, skin: SK, legs: SK, boots: SKD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SKD,
      bands: [{ col: '#3a2e26', top: '#6a5a4a', t0: -PI, t1: PI, z0: 3.9, z1: 4.4, out: 1.08, inK: 0.86 }, { col: IRON, top: IRON_T, t0: -0.35, t1: 0.35, z0: 3.85, z1: 4.5, out: 1.12, inK: 1.0 }],
      pauldron: delts(SK, SKT, 0.95),
      heldR: [cleaver],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.2, len: 0.5, spread: 0.5 })]),
      r: 4.6, h: 11.6, scale: 3.4 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ================================================================
   * TROLLS — h ≈ 24-30, four body types
   * ================================================================ */
  // long claws on a hand (held-gear `over` part); n claws, length len, colours
  const claws = (R, s, col, top, o) => { o = o || {}; const n = o.n || 3, len = o.len || 0.9, r = o.r || 0.15, sp = o.spread || 0.3; return { over: [tube(col, top, (an) => { const h = R.arm(s, an).h, out = []; for (let i = 0; i < n; i++) { const yy = (i - (n - 1) / 2) * sp; out.push([[h[0] + 0.25, h[1] + yy, h[2] - 0.15, r], [h[0] + 0.5 + len * 0.6, h[1] + yy * 1.4, h[2] - 0.5 - len * 0.3, r * 0.8], [h[0] + 0.5 + len, h[1] + yy * 1.6, h[2] - 0.6 - len * 0.55, r * 0.4]]); } return out; }, { ao: 0 })] }; };
  // ragged loincloth / skirt under the torso (sorts below the body)
  const loin = (col, top, pr, jag) => ({ key: () => -0.45, parts: [stack(col, top, pr, { ao: 0.35, jag: jag || 0.16 })] });
  // mushrooms: stems with coloured caps, list [[x, y, z, r]] (one part each colour)
  const shrooms = (list, cap, capT) => [tube('#e6dcc0', '#fbf6e8', () => list.map((q) => [[q[0], q[1], q[2] - q[3] * 1.2, q[3] * 0.35], [q[0], q[1], q[2], q[3] * 0.32]]), { ao: 0 }),
    gp(cap, capT, Math.min(...list.map((q) => q[2] - q[3] * 0.4)), Math.max(...list.map((q) => q[2] + q[3] * 0.55)), (c, z) => { for (const q of list) { const d = (z - q[2]) / (q[3] * 0.6); if (d < -0.7 || d >= 1) continue; const k = d < 0 ? 1 : Math.sqrt(Math.max(0.15, 1 - d * d)); S.circ(c, q[0], q[1], q[3] * k); } }, { ao: 0.1, bevel: true })];

  /* ---------------- cave troll (Aldermere caves) ---------------- */
  M.trl_cave = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#aca69a', '#a29c92', '#b4ae9e'), SKT = sh(SK, 0.24), SKD = sh(SK, -0.26);
    const HIDE = '#5a4632', HIDET = '#8a6e4e', STONE = '#6a6a66', STONET = '#b4b4ae';
    const dims = { hip: 3.0, legY: 1.25, legR: 0.85, kneeR: 0.8, ankleR: 0.72, bootH: 0.9, kneeF: 0.2, stride: 0.9, lift: 0.45,
      shX: 0.4, shY: 2.8, shZ: 6.5, upper: 2.4, fore: 2.4, armR: 0.72, handR: 1.0, swing: 0.5,
      tRx: 1.9, tRy: 2.45, top: 7.0, headX: 1.5, headZ: 7.05, headR: 1.2, neckR: 1.0 };
    const D = Object.assign({}, HB, dims);
    const clubPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.5, s * 3.1, 4.9], h: [1.1 + w, s * 2.4, 5.4] }; };
    const pose = { R: clubPose }, R = rig(D, pose);
    const prof = [[2.9, 1.9, 2.4, -0.1], [3.9, 2.05, 2.55, 0.0], [5.0, 2.0, 2.5, 0.2], [6.0, 1.95, 2.6, 0.4], [6.7, 1.7, 2.5, 0.55], [7.0, 1.0, 1.6, 0.6]];
    const ring = ringProf(prof);
    // crude stone club: a lashed boulder on a haft over the shoulder
    const hand = H(R, 1);
    const club = { under: [
      tube('#5a4632', '#9a7a56', (an) => { const p = hand(an); return [[[p[0] + 0.8, p[1] - 0.1, p[2] - 0.5, 0.32], [p[0] - 1.6, p[1] + 0.25, p[2] + 2.6, 0.36]]]; }, { ao: 0.05 }),
      rockAt(STONE, STONET, (an) => { const p = hand(an); return [p[0] - 1.7, p[1] + 0.3, p[2] + 3.0]; }, pk(v, 1.0, 0.85, 1.1), 21 + v, { sq: pk(v, 0.85, 1.1, 0.8), rough: 0.3, lumps: 8, ao: 0.4 }),
      tube(ROPE, ROPE_T, (an) => { const p = hand(an); return [[[p[0] - 1.1, p[1] + 0.2, p[2] + 1.9, 0.42]], [[p[0] - 2.2, p[1] + 0.35, p[2] + 3.4, 0.4]]]; }, { ao: 0 }),
    ] };
    const hz = D.headZ, hx = D.headX, HR = D.headR;
    const nose = [tube(sh(SK, -0.02), SKT, () => [[[hx + HR * 0.8, 0, hz + 0.05, 0.42], [hx + HR * 1.25, 0, hz - 0.45, 0.42], [hx + HR * 1.3, 0, hz - 0.8, 0.3]]], { ao: 0.05, show: vis(1, 0, -0.45) })];
    const items = [
      jaw(D, SK, SKT, { w: 0.92, d: 0.62, h: 0.4, dz: 0.78, teeth: ['#e4dcc4', '#fff8e8'], brow: [SKD, SK], extra: nose }),
      // stony patches on the shoulders and back
      grp(-0.5, 0, [patch('#7e7a74', '#a8a49e', ring, PI, 0.9, 5.6, 1.2, { out: 1.03, inK: 0.9 }), patch('#7e7a74', '#a8a49e', ring, 1.5, 0.45, 6.2, 0.6, { out: 1.03, inK: 0.9 })]),
      loin(HIDE, HIDET, [[1.7, 2.0, 2.5, -0.05], [2.6, 2.05, 2.55, -0.05], [3.4, 1.95, 2.45, -0.05]], 0.18),
    ];
    if (v === 2) items.push(...skulls([[2.0, -1.2, 4.1, 0.36, 1, -0.3], [1.95, 1.3, 4.05, 0.34, 1, 0.3]]));
    const hat = (D2) => ears(sh(SK, -0.04), sh(SK, 0.2), 1.25, { len: 0.35, up: 0.3 })(D2).concat(v === 1 ? [tube('#4a4440', '#7a746e', () => [[[hx - 0.3, 0, hz + HR * 0.95, 0.3], [hx - 0.9, 0, hz + HR * 1.4, 0.3], [hx - 1.5, 0, hz + HR * 1.25, 0.2]]], { ao: 0 })] : []);
    const head = { headSide: sh(SK, -0.04), headTop: sh(SK, 0.3), eyes: '#141010', eyeR: 0.14, style: 'bald', hat };
    if (v === 2) { head.hair = '#5a5450'; head.style = 'short'; head.fringe = -0.6; }
    return person({ skin: SK }, {
      dims, pose, skin: SK, legs: SK, boots: SKD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      bands: [{ col: ROPE, top: ROPE_T, t0: -PI, t1: PI, z0: 3.6, z1: 4.0, out: 1.08, inK: 0.86 }],
      pauldron: delts(SK, SKT, 1.0),
      heldR: [club], heldL: [claws(R, -1, '#3a3630', '#7a746c', { len: 0.6, r: 0.16, spread: 0.4 })],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.22, len: 0.45, spread: 0.5 })]),
      r: 4.4, h: 9.4, scale: 2.55 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- moss troll (Sylvara) ---------------- */
  M.trl_moss = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#86947a', '#7e8c72', '#8e9c80'), SKT = sh(SK, 0.28), SKD = sh(SK, -0.26);
    const MOSS = pk(v, '#6a9a34', '#5c8a2c', '#78a83c'), MOSST = sh(MOSS, 0.42), BARK = '#4e3c2c', BARKT = '#7a6248';
    const CAP = pk(v, '#c85a2a', '#b84a28', '#d4703a'), CAPT = sh(CAP, 0.35);
    const dims = { hip: 5.0, legY: 0.95, legR: 0.55, kneeR: 0.5, ankleR: 0.45, bootH: 0.8, kneeF: 0.55, stride: 1.5, lift: 1.0,
      shX: 1.0, shY: 1.95, shZ: 8.0, upper: 2.4, fore: 2.5, armR: 0.45, handR: 0.6, swing: 1.0,
      tRx: 1.0, tRy: 1.4, top: 8.4, headX: 2.5, headZ: 8.0, headR: 0.95, neckR: 0.5 };
    const D = Object.assign({}, HB, dims);
    const R = rig(D, {});
    const prof = [[4.6, 1.0, 1.35, 0], [5.6, 0.95, 1.3, 0.2], [6.8, 1.05, 1.55, 0.55], [7.6, 1.0, 1.7, 0.85], [8.4, 0.6, 1.0, 1.1]];
    const ring = ringProf(prof);
    const hz = D.headZ, hx = D.headX, HR = D.headR;
    const mossBack = [[7.3, 1.3, 1.9, 0.3], [8.2, 1.35, 1.95, 0.2], [8.9, 1.0, 1.5, -0.1], [9.3, 0.5, 0.8, -0.3]];
    const items = [
      // moss hump on the stooped back, mushrooms growing from it
      grp(-0.4, 0, [shag(MOSS, MOSST, mossBack, { rough: 0.36, seed: 13 + v, n: 16 })].concat(shrooms(pk(v, [[-0.2, 0.9, 9.6, 0.42], [0.2, -0.8, 9.45, 0.36], [-0.6, -0.1, 9.75, 0.3]], [[-0.1, 0.7, 9.6, 0.5], [0.3, -0.9, 9.4, 0.34]], [[-0.3, 1.0, 9.6, 0.4], [0.1, -0.9, 9.5, 0.38], [-0.7, 0.2, 9.8, 0.3], [0.5, 0.3, 9.4, 0.24]]), CAP, CAPT))),
      // bark plates on the shoulders / upper arms
      grp(0.6, 0, [patch(BARK, BARKT, ring, 1.9, 0.6, 7.3, 0.7, { out: 1.05, inK: 0.9 }), patch(BARK, BARKT, ring, -1.9, 0.6, 7.2, 0.7, { out: 1.05, inK: 0.9 }), patch(BARK, BARKT, ring, 0.2, 0.35, 5.6, 0.8, { out: 1.04, inK: 0.9 })]),
      jaw(D, SK, SKT, { w: 0.8, d: 0.6, h: 0.42, dz: 0.8, teeth: v !== 1 ? ['#e4dcc4', '#fff8e8'] : null, brow: [SKD, SK] }),
      // vine belt with a dangling leaf
      grp(1.2, 0.6, [tube('#4a6a2a', '#8ab050', () => [[[1.0, 1.3, 5.0, 0.12], [1.3, 1.5, 4.0, 0.1], [1.1, 1.6, 3.4, 0.22]]], { ao: 0 })]),
    ];
    const hat = (D2) => ears(sh(SK, -0.04), sh(SK, 0.2), 1.1, { len: 0.6, up: 0.5, back: 0.4 })(D2).concat([
      gp(MOSS, MOSST, hz + HR * 0.45, hz + HR * 1.25, (c, z) => { const kk = 1 - (z - hz - HR * 0.45) / (HR * 0.8) * 0.5; S.blob(c, hx - 0.3, 0, HR * 1.0 * kk, 11 + v, 8, 0.4); }, { ao: 0.1, bevel: true })],
      v === 2 ? shrooms([[hx - 0.6, 0.35, hz + HR * 1.6, 0.3]], CAP, CAPT) : []);
    const head = { headSide: sh(SK, -0.04), headTop: sh(SK, 0.3), eyes: '#ffb82a', eyeFlat: true, eyeR: 0.17, nose: 0.42, style: 'bald', hat };
    const clawL = claws(R, -1, '#2e2e28', '#6a6a5c', { len: 1.3, r: 0.14, spread: 0.3 }), clawR = claws(R, 1, '#2e2e28', '#6a6a5c', { len: 1.3, r: 0.14, spread: 0.3 });
    return person({ skin: SK }, {
      dims, skin: SK, legs: SK, boots: SKD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: BARKT,
      bands: [{ col: '#4a6a2a', top: '#8ab050', t0: -PI, t1: PI, z0: 4.7, z1: 5.05, out: 1.08, inK: 0.86 }],
      heldR: [clawR], heldL: [clawL],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.14, len: 0.6, spread: 0.4 })]),
      r: 4.7, h: 9.9, scale: 2.75 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- frost troll (Hrimgard) ---------------- */
  M.trl_frost = function (pal, opt) {
    const v = V(opt);
    const FUR = pk(v, '#8da2b8', '#8498b0', '#96aabe'), FURT = sh(FUR, 0.45), FURD = sh(FUR, -0.3);
    const SK = '#4e6078', SKT = '#8498ae', SKD = '#36465a', TUSK = '#f0e6cc', TUSKT = '#fffdf2', ICE = '#dff4ff';
    const dims = { hip: 3.6, legY: 1.15, legR: 0.8, kneeR: 0.74, ankleR: 0.62, bootH: 1.0, kneeF: 0.2, stride: 1.0, lift: 0.5,
      shX: 0.5, shY: 2.85, shZ: 7.0, upper: 2.2, fore: 2.2, armR: 0.8, handR: 0.85, swing: 0.55,
      tRx: 1.85, tRy: 2.4, top: 7.6, headX: 1.6, headZ: 7.75, headR: 1.1, neckR: 0.9 };
    const D = Object.assign({}, HB, dims);
    const R = rig(D, {});
    // the smooth torso is a stub under the neck; the real body is a shaggy fur stack
    const stub = [[6.9, 0.6, 0.9, 0.4], [7.6, 0.6, 0.9, 0.45]];
    const fur = [[3.0, 1.85, 2.35, -0.1], [4.0, 2.05, 2.6, 0.0], [5.0, 2.05, 2.6, 0.15], [6.0, 2.0, 2.7, 0.3], [6.9, 1.8, 2.65, 0.45], [7.5, 1.35, 2.1, 0.55], [7.8, 0.7, 1.1, 0.6]];
    const ring = ringProf(fur);
    const hz = D.headZ, hx = D.headX, HR = D.headR;
    const body = shag(FUR, FURT, fur, { rough: 0.3, seed: 17 + v, n: 20, ao: 0.4 });
    const items = [
      // dark chest skin showing through the fur, icicles hanging from the belly fur
      grp(1.8, 0, [patch(SK, SKT, ring, 0, 0.6, 5.3, 1.2, { out: 1.0, inK: 0.85 }),
        tube(ICE, '#ffffff', () => [[[1.9, -0.9, 3.4, 0.14], [1.95, -0.95, 2.5, 0.05]], [[2.1, 0.4, 3.3, 0.16], [2.15, 0.45, 2.2, 0.05]], [[1.7, 1.5, 3.5, 0.13], [1.75, 1.6, 2.7, 0.05]]].concat(v === 2 ? [[[1.4, -2.1, 3.7, 0.13], [1.45, -2.2, 2.9, 0.05]]] : []), { ao: 0, flat: true })]),
      jaw(D, SK, SKT, { w: 0.95, d: 0.62, h: 0.42, dz: 0.8, tusks: [TUSK, TUSKT], tuskR: 0.27, tuskLen: v === 1 ? 0.7 : 1.05, brow: [SKD, SK] }),
    ];
    if (v === 1) items.push(grp(1.6, 0, [tube(BONE, BONE_T, () => [chain([[0.9, -1.9, 6.6], [1.9, -0.6, 5.9], [2.0, 0.6, 5.9], [1.0, 1.9, 6.6]], 0.26, 10)], { ao: 0 })])); // bone necklace
    if (v === 2) items.push(grp(-1.2, 0, [tube(ICE, '#ffffff', () => [[[-1.2, -1.6, 6.3, 0.14], [-1.3, -1.7, 5.3, 0.05]], [[-1.5, 0.9, 6.5, 0.14], [-1.6, 1.0, 5.4, 0.05]]], { ao: 0, flat: true })]));
    const hat = (D2) => [
      // fur crest / mane over the skull
      gp(FUR, FURT, hz + HR * 0.1, hz + HR * 1.3, (c, z) => { const u = (z - hz - HR * 0.1) / (HR * 1.2), kk = Math.sqrt(Math.max(0.1, 1 - u * u * 0.85)); S.blob(c, hx - 0.25 - u * 0.2, 0, HR * 1.15 * kk, 23 + v, 12, 0.3); }, { ao: 0.2, bevel: true }),
      tube(FUR, FURT, () => [1, -1].map((s) => [[hx - 0.2, s * HR * 0.95, hz + 0.2, 0.3], [hx - 0.5, s * HR * 1.35, hz + 0.45, 0.14]]), { ao: 0 }),
    ];
    const head = { headSide: SKD, headTop: SKT, eyes: '#bfe8ff', eyeFlat: true, eyeR: 0.17, eyeGlow: true, nose: 0.3, style: 'bald', hat };
    return person({ skin: SK }, {
      dims, skin: SK, legs: FUR, boots: FURD, torso: stub, torsoSide: FUR, torsoTop: FURT, sleeve: FUR, hands: SK,
      coreMid: () => [body],
      pauldron: delts(FUR, FURT, 1.0),
      heldR: [claws(R, 1, '#2a2e34', '#6c7480', { len: 0.8, r: 0.16, spread: 0.36 })], heldL: [claws(R, -1, '#2a2e34', '#6c7480', { len: 0.8, r: 0.16, spread: 0.36 })],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.2, len: 0.45, spread: 0.5 })]),
      r: 4.5, h: 9.3, scale: 2.7 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- blight troll (Morgrave) ---------------- */
  M.trl_blight = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#6e5278', '#644c6c', '#76587e'), SKT = sh(SK, 0.36), SKD = sh(SK, -0.26);
    const GL = '#9eff6a', SPUR = '#e0d8c0', SPURT = '#fbf6e8', CLOTH = '#2e2430', CLOTHT = '#5a4a5e';
    const dims = { hip: 4.2, legY: 1.0, legR: 0.65, kneeR: 0.6, ankleR: 0.55, bootH: 0.85, kneeF: 0.4, stride: 1.3, lift: 0.8,
      shX: 0.7, shY: 2.35, shZ: 7.3, upper: 2.2, fore: 2.3, armR: 0.55, handR: 0.75, swing: 0.9,
      tRx: 1.35, tRy: 1.8, top: 7.9, headX: 2.0, headZ: 7.9, headR: 1.0, neckR: 0.6 };
    const D = Object.assign({}, HB, dims);
    const R = rig(D, {});
    const prof = [[4.0, 1.4, 1.8, -0.1], [5.0, 1.4, 1.85, 0.1], [6.0, 1.45, 2.0, 0.4], [7.0, 1.5, 2.2, 0.75], [7.6, 1.2, 1.9, 1.0], [7.9, 0.7, 1.1, 1.15]];
    const ring = ringProf(prof);
    const hz = D.headZ, hx = D.headX, HR = D.headR;
    // bone spurs along the spine (curving back from the hunch)
    const spine = tube(SPUR, SPURT, () => [[[-0.95, 0, 6.2, 0.24], [-1.4, 0, 7.0, 0.06]], [[-0.5, 0, 6.9, 0.26], [-1.0, 0, 7.9, 0.06]], [[0.05, 0, 7.5, 0.28], [-0.4, 0, 8.6, 0.07]], [[0.65, 0, 7.9, 0.26], [0.35, 0, 9.0, 0.07]], [[1.2, 0, 8.1, 0.22], [1.05, 0, 9.0, 0.06]]].concat(v === 2 ? [[[-1.3, 0, 5.5, 0.2], [-1.75, 0, 6.2, 0.06]]] : []), { ao: 0 });
    // forearm spurs (held-gear `under` parts following the arm)
    const armSpurs = (s) => ({ under: [tube(SPUR, SPURT, (an) => { const A = R.arm(s, an), e = A.e, h = A.h, out = []; for (const t of [0.35, 0.65]) { const p = [lerp(e[0], h[0], t), lerp(e[1], h[1], t), lerp(e[2], h[2], t)]; out.push([[p[0], p[1], p[2], 0.2], [p[0] - 0.25, p[1] + s * 0.75, p[2] + 0.25, 0.06]]); } return out; }, { ao: 0 })] });
    // pustules: flat green boils (shoulders, back, head)
    const boils = gp(GL, '#f0ffe0', 6.0, 9.3, (c, z) => { for (const q of pk(v, [[0.2, -1.9, 7.4, 0.3], [-0.6, 0.9, 7.1, 0.26], [0.9, 1.6, 7.8, 0.24], [hx - 0.5, -0.6, hz + 0.8, 0.22]], [[0.4, 1.9, 7.5, 0.28], [-0.5, -1.2, 7.0, 0.3], [hx - 0.4, 0.5, hz + 0.75, 0.24]], [[0.2, -1.9, 7.4, 0.3], [-0.6, 0.9, 7.1, 0.26], [0.9, 1.6, 7.8, 0.24], [-0.9, -0.9, 6.5, 0.26], [hx - 0.5, -0.6, hz + 0.8, 0.22], [hx + 0.2, 0.7, hz + 0.6, 0.18]])) ball(c, z, q[0], q[1], q[2], q[3]); }, { flat: true, ao: 0 });
    const items = [grp(-0.3, 0, [spine]), grp(0.4, 0, [boils]), loin(CLOTH, CLOTHT, [[2.6, 1.5, 1.9, -0.05], [3.4, 1.5, 1.9, -0.05], [4.3, 1.45, 1.85, 0]], 0.3)];
    // split jaw (v0, v2): two mandibles diverging from the chin around a dark mouth
    if (v !== 1) items.push(grp(hx + 1.4, 0, [
      tube(sh(SK, -0.1), SK, () => [1, -1].map((s) => [[hx + 0.35, s * 0.15, hz - 0.65, 0.4], [hx + 1.15, s * 0.55, hz - 0.85, 0.34], [hx + 1.55, s * 0.8, hz - 0.8, 0.22]]), { ao: 0.2 }),
      gp('#1e1420', '#2a1a2c', hz - 0.95, hz - 0.45, (c, z) => ball(c, z, hx + 1.05, 0, hz - 0.7, 0.42), { flat: true, ao: 0, show: vis(1, 0, -0.1) }),
      tube('#e4dcc4', '#fff8e8', () => [1, -1].map((s) => [[hx + 0.9, s * 0.28, hz - 0.55, 0.1], [hx + 1.3, s * 0.42, hz - 0.5, 0.1], [hx + 1.6, s * 0.62, hz - 0.55, 0.08]]), { ao: 0, show: vis(1, 0, -0.2) }),
      tube(SKD, SK, () => [[[hx + HR * 0.7, -HR * 0.62, hz + HR * 0.55, HR * 0.22], [hx + HR * 0.86, 0, hz + HR * 0.5, HR * 0.26], [hx + HR * 0.7, HR * 0.62, hz + HR * 0.55, HR * 0.22]]], { ao: 0, show: vis(1, 0, -0.35) }),
    ]));
    else items.push(jaw(D, SK, SKT, { w: 0.85, d: 0.6, h: 0.4, dz: 0.8, teeth: ['#e4dcc4', '#fff8e8'], brow: [SKD, SK] }));
    // third stunted arm from the left ribs (v1, v2)
    if (v !== 0) items.push(grp(1.6, -1.6, [tube(sh(SK, -0.05), SKT, (an) => { const w = Math.cos(cyc(an, 0.3)) * 0.2; return [[[0.9, -1.55, 6.2, 0.34], [1.8 + w, -1.95, 5.5, 0.28], [2.3 + w, -1.7, 4.9, 0.24]]]; }, { ao: 0.1 }),
      tube(SK, SKT, (an) => { const w = Math.cos(cyc(an, 0.3)) * 0.2; return [[[2.45 + w, -1.65, 4.75, 0.36]]]; }, { ao: 0 }),
      tube('#2a2a24', '#605e54', (an) => { const w = Math.cos(cyc(an, 0.3)) * 0.2; return [-0.25, 0.25].map((o) => [[2.6 + w, -1.65 + o, 4.6, 0.1], [2.95 + w, -1.65 + o * 1.5, 4.2, 0.05]]); }, { ao: 0 })]));
    const head = { headSide: sh(SK, -0.04), headTop: sh(SK, 0.32), eyes: GL, eyeFlat: true, eyeR: 0.2, eyeGlow: true, nose: v === 1 ? 0.3 : 0, style: 'bald',
      hat: (D2) => ears(sh(SK, -0.04), sh(SK, 0.2), 1.0, { len: 0.5, up: 0.4, back: 0.3 })(D2).concat([tube(SPUR, SPURT, () => [[[hx - 0.55, 0, hz + HR * 0.8, 0.2], [hx - 1.1, 0, hz + HR * 1.4, 0.06]]], { ao: 0 })]) };
    return person({ skin: SK }, {
      dims, skin: SK, legs: SK, boots: SKD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SKD,
      bands: [{ col: '#3a2c3e', top: '#6a5a6e', t0: -PI, t1: PI, z0: 4.2, z1: 4.55, out: 1.08, inK: 0.86 }, { col: SKD, t0: -0.6, t1: 0.6, z0: 5.0, z1: 7.3, out: 1.02, inK: 0.9 }],
      pauldron: delts(SK, SKT, 0.85),
      heldR: [armSpurs(1), claws(R, 1, '#2a2a24', '#605e54', { len: 0.9, r: 0.15, spread: 0.32 })], heldL: [armSpurs(-1), claws(R, -1, '#2a2a24', '#605e54', { len: 0.9, r: 0.15, spread: 0.32 })],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.16, len: 0.5, spread: 0.45 })]),
      r: 4.5, h: 9.5, scale: 2.7 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ================================================================
   * OGRES — h ≈ 20
   * ================================================================ */
  const OGRE = { hip: 3.3, legY: 1.05, legR: 0.9, kneeR: 0.8, ankleR: 0.68, bootH: 1.0, kneeF: 0.2, stride: 0.9, lift: 0.5,
    shX: 0.3, shY: 2.55, shZ: 7.3, upper: 1.9, fore: 1.8, armR: 0.78, handR: 0.85, swing: 0.6,
    tRx: 1.9, tRy: 2.2, top: 8.0, headX: 0.7, headZ: 9.1, headR: 1.2, neckR: 0.8 };
  const ogreProf = (k) => { k = k || 1; return [[3.8, 1.9 * k, 2.2 * k, -0.1], [4.6, 2.25 * k, 2.5 * k, 0.1], [5.5, 2.35 * k, 2.6 * k, 0.25], [6.4, 2.1 * k, 2.45 * k, 0.3], [7.2, 1.7, 2.3, 0.35], [7.7, 1.3, 1.9, 0.4], [8.0, 0.8, 1.3, 0.45]]; };
  // warts: small darker bumps with light tops (one part)
  const warts = (col, top, list) => gp(col, top, Math.min(...list.map((q) => q[2] - q[3])), Math.max(...list.map((q) => q[2] + q[3])), (c, z) => { for (const q of list) ball(c, z, q[0], q[1], q[2], q[3]); }, { ao: 0 });

  /* ---------------- hill ogre (Aldermere / neutral) ---------------- */
  M.ogr_hill = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#b8886e', '#ae8068', '#c09478'), SKT = sh(SK, 0.26), SKD = sh(SK, -0.24);
    const HIDE = '#5a4030', HIDET = '#8a6648';
    const dims = Object.assign({}, OGRE, {});
    const D = Object.assign({}, HB, dims);
    const clubPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.08; return { e: [0.4, s * 2.9, 5.6], h: [1.2 + w, s * 2.4, 6.3] }; };
    const pose = { R: clubPose }, R = rig(D, pose);
    const prof = ogreProf(pk(v, 1, 0.96, 1.05));
    const ring = ringProf(prof);
    const hx = D.headX, hz = D.headZ, HR = D.headR;
    // spiked wooden club over the shoulder
    const hand = H(R, 1);
    const club = clubOver(R, 1, { side: '#5e4026', top: '#9a6c42', r0: 0.42, r1: 0.62, r2: 0.95, len: 0.85, stubs: false,
      extra: (h) => [tube(IRON, IRON_T, (an) => { const p = h(an); return [[[p[0] - 2.2, p[1] + 0.5, p[2] + 3.6, 0.2], [p[0] - 2.4, p[1] + 1.3, p[2] + 4.0, 0.06]], [[p[0] - 2.6, p[1] - 0.4, p[2] + 3.4, 0.2], [p[0] - 3.3, p[1] - 0.9, p[2] + 3.6, 0.06]], [[p[0] - 2.5, p[1], p[2] + 4.2, 0.2], [p[0] - 2.8, p[1], p[2] + 5.0, 0.06]]]; }, { ao: 0 })] });
    const items = [
      jaw(D, SK, SKT, { w: 0.9, d: 0.62, h: 0.4, dz: 0.75, tusks: ['#e4dcc4', '#fff8e8'], tuskR: 0.2, tuskLen: 0.65, brow: [SKD, SK] }),
      loin(HIDE, HIDET, [[2.4, 1.75, 2.0], [3.4, 1.7, 2.0], [4.2, 1.65, 1.95]], 0.14),
      grp(0.8, 0, [warts(sh(SK, -0.18), sh(SK, 0.15), pk(v, [[1.9, 1.2, 5.2, 0.24], [2.1, -0.8, 6.0, 0.22], [1.2, 2.2, 7.1, 0.22], [hx + 0.4, -0.75, hz + 0.75, 0.2]], [[2.0, -1.1, 5.4, 0.24], [1.0, 2.3, 6.5, 0.22], [hx + 0.2, 0.8, hz + 0.8, 0.2]], [[1.9, 1.2, 5.2, 0.24], [2.1, -0.8, 6.0, 0.22], [1.2, 2.2, 7.1, 0.22], [0.5, -2.3, 6.6, 0.22], [hx + 0.4, -0.75, hz + 0.75, 0.2], [hx - 0.3, 0.6, hz + 0.95, 0.18]]))]),
    ];
    if (v === 2) items.push(grp(1.5, 0, [tube(BONE, BONE_T, () => [chain([[0.6, -1.9, 7.9], [1.6, -0.6, 7.1], [1.7, 0.6, 7.1], [0.6, 1.9, 7.9]], 0.24, 10)], { ao: 0 })]));
    // iron pot helmet: upturned cooking pot with a rim and a handle loop; v1 has lost it (bald, topknot), v2's is dented
    const pot = (D2) => hatHelm({ side: '#4a4e54', top: '#9aa0a8', flatTop: true, k: 1.22, brim: true, low: 0.0 })(D2).concat([
      tube('#3a3e44', '#8a9098', () => [[[hx - 0.5, 0, hz + HR + 0.2, 0.14], [hx - 0.2, 0, hz + HR + 0.7, 0.13], [hx + 0.4, 0, hz + HR + 0.7, 0.13], [hx + 0.7, 0, hz + HR + 0.2, 0.14]]], { ao: 0 }),
    ].concat(v === 2 ? [gp('#2a2c30', '#2a2c30', hz + 0.2, hz + 0.75, (c, z) => ball(c, z, hx - 0.9, 0.55, hz + 0.5, 0.3), { flat: true, ao: 0, show: vis(-1, 0.5, 0.1) })] : []));
    const head = { headSide: sh(SK, -0.04), headTop: sh(SK, 0.3), eyes: '#ffdf6a', eyeFlat: true, eyeR: 0.18, nose: 0.36, style: 'bald',
      hat: (D2) => ears(sh(SK, -0.04), sh(SK, 0.2), 1.0, { len: 0.2 })(D2).concat(v === 1 ? [tube('#2a1e16', '#5a4030', () => [[[hx - 0.4, 0, hz + HR * 0.95, 0.45], [hx - 1.0, 0, hz + HR * 1.5, 0.32], [hx - 1.6, 0, hz + HR * 1.2, 0.18]]], { ao: 0 })] : pot(D2)) };
    return person({ skin: SK }, {
      dims, pose, skin: SK, legs: SK, boots: SKD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      bands: [{ col: ROPE, top: ROPE_T, t0: -PI, t1: PI, z0: 4.2, z1: 4.6, out: 1.08, inK: 0.86 },
        { col: HIDE, top: HIDET, t0: (z) => PI + 0.55 - (z - 4.5) * 0.55, t1: (z) => PI + 1.0 - (z - 4.5) * 0.55, z0: 4.5, z1: 7.8, out: 1.06, inK: 0.86 }],
      pauldron: delts(SK, SKT, 0.95),
      heldR: [club],
      head, items: items.concat([toes(R, D, SKD, SK, { r: 0.22, len: 0.45, spread: 0.5 })]),
      r: 4.2, h: 11.0, scale: 1.9 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ---------------- swamp ogre (Morgrave marshes) ---------------- */
  M.ogr_swamp = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#6e8a5a', '#668256', '#769462'), SKT = sh(SK, 0.3), SKD = sh(SK, -0.26);
    const MUD = '#5e5040', MUDT = '#8a7a60', NET = '#4e5438', NETT = '#8a8c62', RUST = '#7a4e30', RUSTT = '#b88458';
    const dims = Object.assign({}, OGRE, { tRx: 2.1, tRy: 2.4, upper: 2.1, fore: 2.0, headX: 0.9, headZ: 9.0, headR: 1.15, neckR: 1.0 });
    const D = Object.assign({}, HB, dims);
    const hookPose = (an, R2, s) => { const w = R2.swing(s, an) * 0.1; return { e: [0.5, s * 2.9, 5.4], h: [1.5 + w, s * 2.5, 4.6] }; };
    const pose = { R: hookPose }, R = rig(D, pose);
    const prof = ogreProf(pk(v, 1.06, 1.0, 1.1));
    const ring = ringProf(prof);
    const hx = D.headX, hz = D.headZ, HR = D.headR;
    // rusty hook on a rope
    const hand = H(R, 1);
    const hook = { under: [tube(ROPE, ROPE_T, (an) => { const p = hand(an); return [[[p[0], p[1], p[2] + 0.6, 0.14], [p[0] + 0.1, p[1], p[2] - 0.5, 0.14]]]; }, { ao: 0 }),
      tube(RUST, RUSTT, (an) => { const p = hand(an); return [[[p[0] + 0.1, p[1], p[2] - 0.5, 0.2], [p[0] + 0.25, p[1], p[2] - 2.0, 0.22], [p[0] + 0.95, p[1] + 0.1, p[2] - 2.35, 0.2], [p[0] + 1.35, p[1] + 0.1, p[2] - 1.7, 0.14], [p[0] + 1.3, p[1] + 0.1, p[2] - 1.2, 0.07]]]; }, { ao: 0.05 })] };
    const items = [
      jaw(D, SK, SKT, { w: 0.95, d: 0.65, h: 0.42, dz: 0.75, tusks: ['#e4dcc4', '#fff8e8'], tuskR: 0.22, tuskLen: 0.7, brow: [SKD, SK] }),
      // mud caked on the belly and legs
      grp(0.6, 0, [patch(MUD, MUDT, ring, 0.2, 1.0, 4.3, 0.75, { out: 1.03, inK: 0.9 }), patch(MUD, MUDT, ring, -2.2, 0.5, 4.6, 0.6, { out: 1.03, inK: 0.9 })]),
      // bone jewellery: necklace of bone beads and a tusk pendant
      grp(1.6, 0, [tube(BONE, BONE_T, () => [chain([[0.6, -2.0, 7.9], [1.7, -0.6, 6.9], [1.8, 0.6, 6.9], [0.6, 2.0, 7.9]], 0.26, 10), [[1.85, 0.05, 6.75, 0.22], [2.1, 0.1, 5.9, 0.1]]], { ao: 0 })]),
      loin('#4a4432', '#7a7250', [[2.4, 1.85, 2.15], [3.4, 1.8, 2.15], [4.2, 1.75, 2.1]], 0.22),
      grp(0.8, 0, [warts(sh(SK, -0.2), sh(SK, 0.12), pk(v, [[2.0, 1.4, 5.6, 0.26], [1.3, -2.1, 6.6, 0.24], [hx + 0.3, -0.7, hz + 0.75, 0.2]], [[2.1, -1.2, 5.8, 0.26], [0.9, 2.3, 6.9, 0.24]], [[2.0, 1.4, 5.6, 0.26], [1.3, -2.1, 6.6, 0.24], [0.4, 2.4, 7.0, 0.22], [hx + 0.3, -0.7, hz + 0.75, 0.2]]))]),
    ];
    // dripping net slung over the left shoulder (v1, v2)
    if (v !== 0) items.push(grp(-0.9, -1.4, [shag(NET, NETT, [[3.6, 0.8, 0.9, -1.1], [5.4, 1.15, 1.2, -1.0], [6.8, 1.0, 1.0, -0.6], [7.8, 0.55, 0.55, 0.0]], { rough: 0.3, seed: 31 + v, n: 12, cy: -1.5, ao: 0.4 }),
      tube('#a8d8c8', '#e8fff8', () => [[[-1.3, -2.2, 3.7, 0.12], [-1.35, -2.25, 2.9, 0.05]], [[-0.6, -1.0, 3.5, 0.12], [-0.6, -1.0, 2.6, 0.05]]], { ao: 0, flat: true })]));
    const head = { headSide: sh(SK, -0.04), headTop: sh(SK, 0.3), eyes: '#f4ff8a', eyeFlat: true, eyeR: 0.18, nose: 0.34, style: 'bald',
      hat: (D2) => ears(sh(SK, -0.04), sh(SK, 0.2), 1.0, { len: 0.25 })(D2).concat([tube(BONE, BONE_T, () => [[[hx + HR * 1.1, -0.45, hz - 0.3, 0.1], [hx + HR * 1.1, 0.45, hz - 0.3, 0.1]]], { ao: 0, show: vis(1, 0, -0.2) })],
        v === 2 ? [gp(MUD, MUDT, hz + HR * 0.5, hz + HR * 1.12, (c, z) => { const kk = 1 - (z - hz - HR * 0.5) / (HR * 0.62) * 0.6; S.blob(c, hx - 0.2, 0.1, HR * 0.9 * kk, 7, 8, 0.35); }, { ao: 0.1, bevel: true })] : []) };
    return person({ skin: SK }, {
      dims, pose, skin: SK, legs: MUD, boots: MUD, torso: prof, torsoSide: SK, torsoTop: SKT, sleeve: SK, hands: SK,
      bands: [{ col: ROPE, top: ROPE_T, t0: -PI, t1: PI, z0: 4.3, z1: 4.65, out: 1.08, inK: 0.86 }],
      pauldron: delts(SK, SKT, 0.95),
      heldR: v === 1 ? [] : [hook],
      head, items: items.concat([toes(R, D, MUD, MUDT, { r: 0.22, len: 0.45, spread: 0.5 })]),
      r: 4.2, h: 10.3, scale: 1.9 * pk(v, 1, 0.92, 1.08),
    });
  };

  /* ================================================================
   * COLOSSI — very rare, landmark-sized. Big simple forms, parts ≲ 36.
   * Legs of the many-legged ones are drawn as two parts (far side / near
   * side of the body, decided per frame) so the forge cost stays sane.
   * ================================================================ */
  // quadruped / multi-leg columns: legs [{x, y, ph, back}], L { hipZ, stride, lift, knee, r0, r1, r2, footZ }
  function bigLegs(col, top, legs, L, o) {
    o = o || {};
    const pts = (lg, an) => { const f = cyc(an, lg.ph), x = lg.x + Math.cos(f) * L.stride, up = Math.max(0, -Math.sin(f)) * L.lift;
      const kz = L.hipZ * (lg.back ? 0.52 : 0.46) + up * 0.5, kx = (x + lg.x) / 2 + (lg.back ? -L.knee : L.knee) + up * 0.3;
      return { f: [x, lg.y, up + (L.footZ || 0)], k: [kx, lg.y, kz], h: [lg.x, lg.y * 0.92, L.hipZ] }; };
    const line = (lg, an) => { const q = pts(lg, an); return [q.f.concat(L.r2), q.k.concat(L.r1), q.h.concat(L.r0), [q.h[0], q.h[1] * 0.8, q.h[2] + L.r0 * 0.9, L.r0 * 1.1]]; };
    const near = (c, lg) => dep(viewA(c), lg.x, lg.y) >= 0;
    const mk = (sign) => gp(col, top, Math.max(0, (L.footZ || 0) - L.r2), L.hipZ + L.r0 * 2.0, (c, z, an) => { for (const lg of legs) if ((sign > 0) === near(c, lg)) sweep(c, z, line(lg, an)); }, { ao: o.ao !== undefined ? o.ao : 0.25 });
    const hoof = (sign) => gp(o.hoof || '#2a2420', o.hoofT || '#5a5048', 0, (L.hoofH || 2) + L.lift, (c, z, an) => { for (const lg of legs) if ((sign > 0) === near(c, lg)) { const q = pts(lg, an); ball(c, z, q.f[0] + L.r2 * 0.25, q.f[1], q.f[2] + (L.hoofH || 2) * 0.35, L.r2 * 1.18); } }, { ao: 0.1 });
    return { far: [mk(-1), hoof(-1)], near: [mk(1), hoof(1)], pts };
  }
  const quadLegs = (fx, fy, hx, hy) => [{ x: hx, y: -hy, ph: 0, back: true }, { x: fx, y: -fy, ph: 0.25 }, { x: hx, y: hy, ph: 0.5, back: true }, { x: fx, y: fy, ph: 0.75 }];

  /* ---------------- ancient titan (wandering, neutral) ---------------- */
  M.col_titan = function (pal, opt) {
    const v = V(opt);
    const ST = pk(v, '#8a8880', '#84827a', '#908e86'), STT = sh(ST, 0.3), STD = sh(ST, -0.28);
    const MOSS = '#5e8a34', MOSST = '#9cc85a', GL = pk(v, '#ffb347', '#ff9a3a', '#ffc85a'), IRONC = '#3e4044', IRONT = '#8a8e94';
    const dims = { hip: 3.3, legY: 1.4, legR: 1.15, kneeR: 1.05, ankleR: 0.95, bootH: 1.1, kneeF: 0.2, stride: 0.85, lift: 0.4,
      shX: 0.7, shY: 3.1, shZ: 7.6, upper: 2.0, fore: 2.0, armR: 0.95, handR: 1.15, swing: 0.5,
      tRx: 2.1, tRy: 2.6, top: 8.2, headX: 1.9, headZ: 8.2, headR: 0.95, neckR: 0.95 };
    const D = Object.assign({}, HB, dims);
    const R = rig(D, {});
    const prof = [[3.1, 2.0, 2.5, -0.1], [4.2, 2.2, 2.7, 0.05], [5.3, 2.2, 2.75, 0.3], [6.3, 2.1, 2.7, 0.6], [7.2, 2.05, 2.9, 0.95], [7.9, 1.6, 2.5, 1.2], [8.2, 0.9, 1.5, 1.35]];
    const ring = ringProf(prof);
    // glowing cracks: zig-zag bands on the chest (flat)
    const zig = (t, w, z0, z1, k) => ({ col: GL, top: '#fff2d0', t0: (z) => t + Math.sin((z - z0) * k) * 0.22 - w, t1: (z) => t + Math.sin((z - z0) * k) * 0.22 + w, z0, z1, out: 1.03, inK: 0.9, flat: true });
    const items = [
      // hunched stone back with moss and a ruined column + a small tree growing on the shoulders
      mantle(ST, STT, D, { seed: 41 + v, rough: 0.14, n: 16, rx: 2.9, ry: 3.8, dx: -0.2, extra: (pr) => [
        shag(MOSS, MOSST, [[8.5, 2.1, 2.9, 0.35], [8.9, 1.5, 2.2, 0.15], [9.25, 0.6, 0.9, -0.1]], { rough: 0.4, seed: 44 + v, n: 18, ao: 0.3 }),
        gp('#b8b4a8', '#e2ded2', 8.6, 10.6, (c, z) => { S.circ(c, -0.6, 2.4, z > 9.9 ? 0.34 : z > 9.6 ? 0.46 : 0.4); if (v !== 1) S.circ(c, -1.2, 1.7, z < 9.3 ? 0.36 : 0.0); }, { ao: 0.25, bevel: true }),
        tube('#4e3a28', '#7a5e40', () => [[[-0.3, -2.3, 8.6, 0.22], [-0.2, -2.5, 10.3, 0.18]]], { ao: 0.1 }),
        gp('#3e6a2a', '#8ac850', 9.9, 11.5, (c, z) => { const u = (z - 9.9) / 1.6, k = u < 0.4 ? 0.7 + u : 1.1 - (u - 0.4) * 1.3; S.blob(c, -0.25, -2.5, 1.05 * Math.max(0.15, k), 5 + v, 8, 0.3); S.blob(c, 0.4, -2.0, 0.7 * Math.max(0.1, k - 0.2), 9 + v, 7, 0.3); }, { ao: 0.3, bevel: true }),
      ] }),
      jaw(D, ST, STT, { w: 0.95, d: 0.7, h: 0.45, brow: [STD, ST] }),
      // broken chains: a collar chain down the chest and chains trailing from the wrists
      grp(D.headX + 0.3, 0, [tube(IRONC, IRONT, () => [chain([[D.headX + 0.5, -0.5, 7.8], [D.headX + 0.9, -0.9, 6.7], [D.headX + 0.5, -1.2, 5.6]], 0.3, 7)], { ao: 0 })]),
      grp(0.6, 2.9, [tube(IRONC, IRONT, (an) => { const h = R.arm(-1, an).h; return [chain([[h[0] - 0.4, h[1] - 0.3, h[2] - 0.3], [h[0] - 1.3, h[1] - 0.5, h[2] - 1.1]], 0.3, 4)]; }, { ao: 0 })]),
      // moss on the belly and a lichen patch on the hip
      grp(0.4, 0, [patch(MOSS, MOSST, ring, -1.6, 0.5, 4.4, 0.9, { out: 1.03, inK: 0.9 }), patch('#9a9a78', '#c8c8a0', ring, 0.9, 0.35, 6.1, 0.6, { out: 1.03, inK: 0.9 }), patch(STD, ST, ring, 0.5, 0.45, 4.0, 0.8, { out: 1.03, inK: 0.9 }), patch(STD, ST, ring, -2.3, 0.5, 5.6, 1.0, { out: 1.03, inK: 0.9 })]),
    ];
    if (v === 2) items.push(grp(0.2, 2.9, [tube('#b8b4a8', '#e2ded2', () => [[[0.3, 2.9, 8.5, 0.5], [0.1, 3.2, 9.6, 0.42]]], { ao: 0.25 })])); // a second column stump on the other shoulder
    const head = giantHead(ST, { headSide: sh(ST, -0.16), headTop: sh(ST, 0.42), eyes: GL, eyeFlat: true, eyeR: 0.26, eyeGlow: true, nose: 0 });
    return person({ skin: ST }, {
      dims, skin: ST, legs: ST, boots: STD, torso: prof, torsoSide: ST, torsoTop: STT, sleeve: ST, hands: STD,
      bands: [zig(0.25, 0.07, 5.0, 7.2, 2.4), zig(-0.45, 0.06, 5.4, 6.9, 3.0), { col: STD, t0: PI - 0.9, t1: PI - 0.6, z0: 3.6, z1: 5.6, out: 1.02, inK: 0.92 }],
      pauldron: delts(ST, STT, 1.15),
      head, items: items.concat([toes(R, D, STD, ST, { r: 0.28, len: 0.55, spread: 0.6 })]),
      r: 4.8, h: 11.6, scale: 5.5 * pk(v, 1, 0.94, 1.06),
    });
  };

  /* ---------------- spider queen (Sylvara) ---------------- */
  M.col_spiderqueen = function (pal, opt) {
    const v = V(opt);
    const BK = pk(v, '#3a2a30', '#34262c', '#402c34'), BKT = sh(BK, 0.35), RED = pk(v, '#6a2a2a', '#5e2630', '#742e2a'), REDT = sh(RED, 0.4);
    const PAL = '#e4d4b0', PALT = '#fbf4e2', EYE = '#ff3a3a', SAC = '#d8d0b8', SACT = '#f6f0e0', LEGC = '#2e2228', LEGT = '#6e5a62';
    const k = pk(v, 1, 0.92, 1.08);
    // 8 legs: front legs reach forward, hind legs back; alternating tetrapod gait
    const legs = [];
    [[9, 0.0, false], [5.5, 0.5, false], [1.5, 0.0, true], [-2.5, 0.5, true]].forEach((q, i) => { legs.push({ x: q[0], y: 5.5, ph: q[1], back: q[2] }, { x: q[0], y: -5.5, ph: q[1] + 0.25, back: q[2] }); });
    const spread = [25, 28, 29, 25], fx = [17, 7, -6, -19];
    const legLine = (lg, i, an) => {
      const pair = Math.floor(i / 2), s = Math.sign(lg.y), f = cyc(an, lg.ph), sw = Math.cos(f) * 2.2, up = Math.max(0, -Math.sin(f)) * 3.0;
      const tipX = fx[pair] + sw, tipY = s * spread[pair], kx = (lg.x + tipX) * 0.5, ky = s * (spread[pair] * 0.55);
      return [[tipX, tipY, up + 0.3, 0.7], [tipX * 0.85 + kx * 0.15, tipY * 0.82 + ky * 0.18, 9 + up * 0.5, 1.1], [kx, ky, 23 + up * 0.4, 1.45], [lg.x, s * 7.5, 14.5, 1.9], [lg.x, s * 5.2, 12.5, 2.1]];
    };
    const near = (c, lg) => dep(viewA(c), lg.x, lg.y) >= 0;
    const legPart = (sign) => gp(LEGC, LEGT, 0, 26, (c, z, an) => { legs.forEach((lg, i) => { if ((sign > 0) === near(c, lg)) sweep(c, z, legLine(lg, i, an)); }); }, { ao: 0.25 });
    const bands = (sign) => gp(PAL, PALT, 7, 25, (c, z, an) => { legs.forEach((lg, i) => { if ((sign > 0) !== near(c, lg)) return; const L = legLine(lg, i, an); for (const t of [1.0, 2.0]) { const A = L[Math.floor(t)], B = L[Math.floor(t) + 1] || A; const P = [lerp(A[0], B[0], 0.12), lerp(A[1], B[1], 0.12), lerp(A[2], B[2], 0.12), lerp(A[3], B[3], 0.12) * 1.12]; ball(c, z, P[0], P[1], P[2], P[3]); } }); }, { ao: 0.1 });
    // body: cephalothorax (front) and the bulbous abdomen (back)
    const abd = { cx: -11, z: 18, r: 13.5 * k, sq: 0.92 };
    const abdPart = gp(RED, REDT, abd.z - abd.r * abd.sq, abd.z + abd.r * abd.sq, (c, z) => { const d = (z - abd.z) / (abd.r * abd.sq); const kk = Math.sqrt(Math.max(0.1, 1 - d * d)); S.blob(c, abd.cx - d * 1.5, 0, abd.r * kk, 3, 18, 0.06); }, { ao: 0.42, bevel: true,
      detail: (c) => { c.save(); c.fillStyle = css(PALT, 0.9); c.beginPath(); S.poly(c, [abd.cx + 2.5, 0, abd.cx + 0.5, 1.6, abd.cx - 2.5, 0.8, abd.cx - 1.2, 0, abd.cx - 2.5, -0.8, abd.cx + 0.5, -1.6]); c.fill(); c.restore(); } });
    const abdRing = (z, t, kk) => { const d = (z - abd.z) / (abd.r * abd.sq), r = abd.r * Math.sqrt(Math.max(0.1, 1 - d * d)); return [abd.cx - d * 1.5 + Math.cos(t) * r * kk, Math.sin(t) * r * kk]; };
    const pattern = strips(PAL, PALT, abdRing, [[-0.55, 0.55, 20, 24], [PI - 0.9, PI + 0.9, 17, 21.5], [1.1, 1.7, 13, 19], [-1.7, -1.1, 13, 19], [2.0, 2.6, 21, 25], [-2.6, -2.0, 21, 25]], { out: 1.0, inK: 0.86 });
    const ceph = stack(BK, BKT, [[8, 7.0, 7.6, 5], [11, 7.8, 8.4, 5.3], [15, 7.4, 8.0, 5.6], [17.5, 4.5, 5.0, 5.8]], { ao: 0.35, bevel: true,
      detail: (c) => { c.save(); c.fillStyle = css(REDT, 0.85); c.beginPath(); S.ell(c, 6.2, 0, 2.6, 1.6); c.fill(); c.restore(); } });
    const eyes = gp(EYE, '#ffe0e0', 11.5, 15.5, (c, z) => { for (const q of [[12.6, 0, 14.2, 1.1], [12.4, 2.2, 13.9, 0.9], [12.4, -2.2, 13.9, 0.9], [11.9, 3.9, 13.2, 0.65], [11.9, -3.9, 13.2, 0.65], [12.5, 1.2, 12.6, 0.55], [12.5, -1.2, 12.6, 0.55], [12.1, 3.0, 12.4, 0.45], [12.1, -3.0, 12.4, 0.45]]) ball(c, z, q[0], q[1], q[2], q[3]); }, { flat: true, ao: 0, show: vis(1, 0, -0.2),
      detail: (c) => glow(c, EYE, 12.8, 0, 3.2, '#ffffff', 0.5) });
    const fangs = tube('#1a1216', '#4a3a40', (an) => { const b = Math.sin(cyc(an) * 2) * 0.4; return [1, -1].map((s) => [[12.0, s * 2.2, 10.0, 1.3], [14.0 + b, s * 2.8, 6.5, 0.9], [14.6 + b, s * 2.3, 3.6, 0.4]]); }, { ao: 0.1 });
    const palps = tube(LEGC, LEGT, (an) => { const w = Math.cos(cyc(an)) * 0.6; return [1, -1].map((s) => [[11.5, s * 4.6, 11.5, 1.0], [15.5 + w, s * 6.5, 12.5, 0.8], [18.5, s * 6.0, 9.0, 0.5]]); }, { ao: 0.1 });
    // egg sacs: pale silk bundles under the abdomen's rear and one dragged behind
    const sacs = gp(SAC, SACT, 0.5, 11.5, (c, z) => { for (const q of pk(v, [[-21, 4, 4.5, 4.6], [-19, -5, 4.0, 4.2], [-25, -1, 3.5, 3.6]], [[-21, 3, 4.5, 4.6], [-24, -3, 3.8, 4.0]], [[-21, 4.5, 4.5, 4.6], [-19, -5.5, 4.0, 4.2], [-26, 0, 3.8, 4.0], [-16, 8, 3.2, 3.3]])) ball(c, z, q[0], q[1], q[2], q[3]); }, { ao: 0.3, bevel: true,
      detail: (c) => { c.save(); c.strokeStyle = 'rgba(120,100,70,0.5)'; c.lineWidth = 0.4; for (const q of [[-21, 4], [-19, -5], [-25, -1]]) { c.beginPath(); c.arc(q[0], q[1], 1.6, 0.5, 3.4); c.stroke(); } c.restore(); } });
    const spinnerets = tube(BK, BKT, (an) => [[[-23.5 * k, 0.8, 10, 1.2], [-26 * k, 1.0, 8.5, 0.6]], [[-23.5 * k, -0.8, 10, 1.2], [-26 * k, -1.0, 8.5, 0.6]]], { ao: 0.1 });
    const G = [
      { key: () => -1, parts: [legPart(-1), bands(-1), sacs] },
      { key: () => 0, parts: [abdPart, pattern, spinnerets, ceph, eyes] },
      { key: (a) => dep(a, 13, 0), parts: [fangs, palps] },
      { key: () => 1, parts: [legPart(1), bands(1)] },
    ];
    return { r: 34, h: 31, parts: assemble(G), style: 'unit' };
  };

  /* ---------------- great worm (Morgrave) ---------------- */
  M.col_greatworm = function (pal, opt) {
    const v = V(opt);
    const SK = pk(v, '#cfc4ae', '#c6bca8', '#d6ccb6'), SKT = sh(SK, 0.26), SEG = pk(v, '#6e5e50', '#685a52', '#746454'), SEGT = sh(SEG, 0.4);
    const MAW = '#3a141c', TOOTH = '#f0e8d0', TOOTHT = '#fffdf4', SLIME = '#b8d860', SLIMET = '#e4ff98', DIRT = '#5a4a38', DIRTT = '#86745a';
    const k = pk(v, 1, 0.93, 1.07);
    // spine: from the ground behind, rearing up and forward; writhes with the phase
    const X = 3.5; // the model is shifted forward so the canvas is centred: the ground mound sits ~6 units behind the anchor
    const spine = (an) => { const ph = cyc(an); const sw = (t) => Math.sin(ph + t * 2.6) * 2.4 * t; return [
      [-12 + X, sw(0), -4, 11.5 * k], [-11 + X, sw(0.15), 8, 11 * k], [-7.5 + X, sw(0.35), 22, 10.4 * k], [-1 + X, sw(0.55), 35, 9.8 * k], [6 + X, sw(0.75), 45, 9.0 * k], [10.5 + X, sw(0.9), 50.5, 9.2 * k], [13.5 + X, sw(1.0), 52.5, 7.0 * k]]; };
    const headAt = (an) => { const s = spine(an); return s[s.length - 1]; };
    const ribbed = (pts) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const A = pts[i], B = pts[i + 1], n = 3; for (let j = 0; j < n; j++) { const t = j / n; out.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t) * (j % 2 ? 0.9 : 1)]); } } out.push(pts[pts.length - 1]); return out; };
    const body = tube(SK, SKT, (an) => [ribbed(spine(an))], { ao: 0.3, zr: [0, 59] });
    // segment rings: darker bands bulging at the grooves
    const rings = gp(SEG, SEGT, 2, 52, (c, z, an) => { const s = spine(an); for (let i = 0; i < s.length - 1; i++) for (const t of [0.33, 0.66]) { const A = s[i], B = s[i + 1]; if (i >= 5 && t > 0.5) continue; ball(c, z, lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t) * 1.1); } }, { ao: 0.3 });
    // warty knobs down the back
    const warts = gp('#8a7866', '#b4a48c', 4, 54, (c, z, an) => { const s = spine(an); for (let i = 0; i < s.length - 1; i++) for (const t of [0.15, 0.5, 0.85]) { const A = s[i], B = s[i + 1]; const r = lerp(A[3], B[3], t); ball(c, z, lerp(A[0], B[0], t) - r * 0.78, lerp(A[1], B[1], t), lerp(A[2], B[2], t) + r * 0.38, 1.9); } }, { ao: 0.15 });
    // round maw at the front of the head: dark throat, a ring of teeth, a drool of slime
    const mawPts = (an) => { const h = headAt(an); return { x: h[0] + 1.2, y: h[1], z: h[2] - 1.5, r: h[3] }; };
    const throat = gp(MAW, '#5a2030', 44, 58, (c, z, an) => { const m = mawPts(an); const d = (z - m.z) / (m.r * 0.9); if (d <= -1 || d >= 1) return; const kk = Math.sqrt(1 - d * d); S.ell(c, m.x + 2.6 - Math.abs(d) * 1.5, m.y, m.r * 0.48 * kk, m.r * 0.82 * kk); }, { flat: true, ao: 0, show: vis(1, 0, -0.15) });
    const teeth = tube(TOOTH, TOOTHT, (an) => { const m = mawPts(an), out = [], n = 14; for (let i = 0; i < n; i++) { const t = i / n * TAU, ry = m.r * 0.86, rz = m.r * 0.86; const y0 = m.y + Math.sin(t) * ry, z0 = m.z + Math.cos(t) * rz; out.push([[m.x + 4.0, y0, z0, 0.95], [m.x + 5.2, y0 * 0.8 + m.y * 0.2, z0 * 0.78 + m.z * 0.22, 0.35]]); } return out; }, { ao: 0, zr: [42, 62] });
    const slime = tube(SLIME, SLIMET, (an) => { const m = mawPts(an), ph = cyc(an); return [[[m.x + 3.5, m.y - 2.5, m.z - m.r * 0.7, 0.9], [m.x + 3.0, m.y - 3.0, m.z - m.r * 0.7 - 5 - Math.sin(ph) * 1.5, 0.35]], [[m.x + 2.0, m.y + 3.5, m.z - m.r * 0.75, 0.8], [m.x + 1.5, m.y + 3.8, m.z - m.r * 0.75 - 4 + Math.cos(ph) * 1.2, 0.3]], [[-9 + X, 6.5, 14, 0.6], [-9.5 + X, 7.5, 9, 0.3]]]; }, { ao: 0, flat: true, zr: [8, 50] });
    // churned earth where it broke the ground
    const mound = stack(DIRT, DIRTT, [[0, 17 * k, 15 * k, -10 + X], [2.2, 15 * k, 13 * k, -10 + X], [3.6, 11 * k, 9.5 * k, -10.5 + X]], { ao: 0.3, bevel: true, jag: 0.2,
      detail: (c) => { blobs(c, 'rgba(40,30,20,0.4)', [[-18 + X, 4, 2.2, 1], [-5 + X, -7, 1.8, 2], [-14 + X, -9, 1.6, 3]]); } });
    const G = [{ key: () => -1, parts: [mound] }, { key: () => 0, parts: [body, rings, warts] }, { key: (a) => dep(a, 12 + X, 0), parts: [throat, teeth, slime] }];
    return { r: 26, h: 60, parts: assemble(G), style: 'unit' };
  };

  /* ---------------- ice behemoth (Hrimgard) ---------------- */
  M.col_icebehemoth = function (pal, opt) {
    const v = V(opt);
    const FUR = pk(v, '#6e7e90', '#687888', '#748496'), FURT = sh(FUR, 0.5), FURD = sh(FUR, -0.3);
    const ICE = '#8ec4e0', ICET = '#eef9ff', HORN = pk(v, '#c8b48c', '#bcaa88', '#d2be96'), HORNT = sh(HORN, 0.3), SNOW = '#ffffff';
    const k = pk(v, 1, 0.93, 1.07);
    const L = { hipZ: 30, stride: 4.0, lift: 2.6, knee: 2.5, r0: 4.8, r1: 3.6, r2: 3.0, hoofH: 3.0 };
    const legs = bigLegs(FUR, FURT, quadLegs(13, 10.5, -14, 11), L, { hoof: '#2a2e36', hoofT: '#6a7484' });
    // shaggy body with a hanging fringe, hump rising toward the shoulders
    const bodyPr = [[20, 19, 12.5, -3], [24, 21.5, 14.0, -2], [30, 22.5, 14.5, -1], [36, 21.5, 13.5, 0], [41, 18, 11.5, 1], [45, 11, 7.5, 2]];
    const body = shag(FUR, FURT, bodyPr.map((q) => [q[0], q[1] * k, q[2] * k, q[3]]), { rough: 0.16, seed: 51 + v, n: 26, ao: 0.42 });
    const fringe = shag(FURD, FUR, [[15, 17 * k, 11 * k, -3.5], [20.5, 19.5 * k, 13 * k, -3]], { rough: 0.3, seed: 57 + v, n: 24, ao: 0.3, zf: 2 });
    // glacier plates on the back: jagged ice slabs
    const plates = gp(ICE, ICET, 39, 59, (c, z) => {
      const slabs = pk(v, [[-9, 0, 58, 7.5, 1.3], [1, 3, 54, 6, 1.1], [-2, -6, 52, 5, 1.0], [8, -2, 50, 4.5, 0.9]], [[-8, 1, 56, 7, 1.3], [2, -3, 53, 6, 1.0], [6, 4, 49, 4, 0.9]], [[-10, -1, 59, 8, 1.4], [0, 4, 55, 6.5, 1.1], [-3, -7, 53, 5.5, 1.0], [8, -1, 51, 5, 0.9], [-16, 2, 48, 4, 0.8]]);
      for (const q of slabs) { const top = q[2], base = 38; if (z > top) continue; const u = (top - z) / (top - base); S.blob(c, q[0], q[1], q[3] * (0.35 + 0.65 * Math.min(1, u * 1.4)), 5 + Math.round(q[0]), 6, 0.35); }
    }, { ao: 0.3, bevel: true, detail: (c) => { S.lines(c, 'rgba(255,255,255,0.6)', 0.5, [-10, -2, -7, 2, 0, 1, 3, 5]); } });
    // head: broad shaggy skull low at the front, dark muzzle, glowing eyes, curled horns
    const bob = (an) => Math.cos(cyc(an) * 2) * 0.8;
    const head = [
      tube(FUR, FURT, (an) => [[[22, 0, 33, 8.5 * k], [29, 0, 31 + bob(an), 7.2 * k]]], { ao: 0.3 }),
      tube('#2a2e36', '#6a7484', (an) => [[[31, 0, 28 + bob(an), 5.0 * k], [36, 0, 25.5 + bob(an), 4.2 * k]]], { ao: 0.25 }),
      gp('#dfe8f0', '#ffffff', 22, 27, (c, z, an) => { for (const s of [1, -1]) ball(c, z, 35.5, s * 2.6, 24 + bob(an), 1.1); }, { ao: 0, show: vis(1, 0, -0.2) }),
      gp('#8ad8ff', '#ffffff', 31, 35, (c, z, an) => { for (const s of [1, -1]) ball(c, z, 31.5, s * 4.6, 33 + bob(an), 1.2); }, { flat: true, ao: 0, show: vis(1, 0, -0.1), detail: (c, an) => { for (const s of [1, -1]) glow(c, '#8ad8ff', 31.5, s * 4.6, 2.6, '#ffffff', 0.5); } }),
      tube(HORN, HORNT, (an) => { const b = bob(an); return [1, -1].map((s) => [[25, s * 7, 38 + b, 2.8], [21, s * 13, 42 + b, 2.4], [20, s * 19, 38 + b, 2.0], [25, s * 21, 31 + b, 1.6], [31, s * 17, 29 + b, 1.2], [34, s * 13, 33 + b, 0.7]]); }, { ao: 0.15 }),
      shag(FURD, FUR, [[35, 7.5 * k, 9 * k, 26], [39, 6 * k, 7.5 * k, 26.5]], { rough: 0.3, seed: 61, n: 14, ao: 0.2 }),
    ];
    const tail = tube(FUR, FURT, (an) => [[[-32, 0, 30, 3.2], [-37, Math.sin(cyc(an)) * 2.5, 26, 2.4], [-40, Math.sin(cyc(an)) * 3.5, 21, 1.6]]], { ao: 0.2 });
    // snow blowing off the plates (flat white puffs drifting back with the phase)
    const snow = gp(SNOW, SNOW, 42, 60, (c, z, an) => { const ph = (an || 0); for (let i = 0; i < 7; i++) { const t = ((i * 0.37 + ph) % 1); const x = -4 - t * 22 - i * 1.5, y = (i % 2 ? 1 : -1) * (2 + i * 1.3) * (0.5 + t), zz = 52 + i * 1.1 - t * 6, r = 1.6 * (1 - t) + 0.3; ball(c, z, x, y, zz, r); } }, { flat: true, ao: 0, bevel: false });
    const G = [
      { key: () => -1, parts: legs.far },
      { key: () => 0, parts: [fringe, body, plates, snow] },
      { key: (a) => dep(a, 30, 0), parts: head },
      { key: (a) => dep(a, -36, 0), parts: [tail] },
      { key: () => 1, parts: legs.near },
    ];
    return { r: 42, h: 60, parts: assemble(G), style: 'unit', scale: 0.82 * k };
  };

  /* ================================================================
   * gallery
   * ================================================================ */
  const A4 = { dirs: 16, anims: 4 };
  const it = (name, gen, bg, v) => Object.assign({ name: name + ' v' + v, gen, pal: 'neutral', bg, opt: { v } }, A4);
  const trio = (name, gen, bg) => [0, 1, 2].map((v) => it(name, gen, bg, v));
  (AS.Gallery = AS.Gallery || []).push(
    { group: 'Giants', items: [].concat(trio('hill giant', 'gnt_hill', 'neutral'), trio('frost giant', 'gnt_frost', 'ice'), trio('wood colossus', 'gnt_wood', 'elf'), trio('corpse giant', 'gnt_corpse', 'undead')) },
    { group: 'Trolls', items: [].concat(trio('cave troll', 'trl_cave', 'neutral'), trio('moss troll', 'trl_moss', 'elf'), trio('frost troll', 'trl_frost', 'ice'), trio('blight troll', 'trl_blight', 'undead')) },
    { group: 'Ogres', items: [].concat(trio('hill ogre', 'ogr_hill', 'neutral'), trio('swamp ogre', 'ogr_swamp', 'undead')) },
    { group: 'Colossi', items: [].concat(trio('ancient titan', 'col_titan', 'neutral'), trio('spider queen', 'col_spiderqueen', 'elf'), trio('great worm', 'col_greatworm', 'undead'), trio('ice behemoth', 'col_icebehemoth', 'ice')) }
  );
})(window.AS);
