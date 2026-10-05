/* ALIEN STRIKE — Choir unit models (package "choir").
 * The Choir are an ancient alien machine-cult: dark violet frames dressed in
 * bone-stone / ceramic plates, violet glow channels, crystal shards, and fins or
 * halos that float free of the hull. Every generator takes a Choir palette
 * p = { a: bone side, b: bone top, t: violet trim, g: glow, d: darkest } and
 * builds its dark body from d/t so units contrast with pale and warm grounds,
 * keeping the bone plates as readable accents.
 * Object space: +x forward, +y starboard, world units. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  const P = (p) => Object.assign({ a: '#a59e8c', b: '#d8d0bc', t: '#5a4f7a', g: '#b07cff', d: '#34303e' }, p || {});
  const lerp = (a, b, t) => a + (b - a) * t;
  const cs = (c, k) => C.str(k ? C.shade(c, k) : c);
  const SEAM = 'rgba(16,12,22,0.5)';
  const LITE = 'rgba(255,255,255,0.22)';
  const RED = '#e2433a', GOLD = '#e8b84a';

  /* Shared faction colours derived from a palette. */
  function tone(p) {
    const body = C.mix(p.d, p.t, 0.3);          // dark violet frame (walls)
    return {
      body,
      bodyT: C.mix(p.d, p.t, 0.78),              // frame top faces
      deep: C.shade(p.d, -0.25),                 // undersides, sockets
      shard: C.shade(C.mix(p.t, p.g, 0.12), -0.18), // crystal armour walls
      shardT: C.mix(p.t, p.g, 0.38),             // crystal armour tops
      boneS: C.hex(p.a), boneT: C.hex(p.b),
      glow: C.hex(p.g), hot: C.shade(p.g, 0.55), white: C.shade(p.g, 0.85),
    };
  }

  // n-gon points (for poly)
  function ngon(x, y, r, n, rot, sx) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (rot || 0) + (i / n) * TAU; pts.push(x + Math.cos(a) * r * (sx || 1), y + Math.sin(a) * r); }
    return pts;
  }
  // scale a point list toward (cx, cy) by k, then shift by (dx, dy)
  function squeeze(pts, cx, cy, k, dx, dy) {
    const out = [];
    for (let i = 0; i < pts.length; i += 2) out.push(cx + (pts[i] - cx) * k + (dx || 0), cy + (pts[i + 1] - cy) * k + (dy || 0));
    return out;
  }
  function centroid(pts) { let x = 0, y = 0; const n = pts.length / 2; for (let i = 0; i < pts.length; i += 2) { x += pts[i]; y += pts[i + 1]; } return [x / n, y / n]; }
  const mirrorY = (pts) => pts.map((v, i) => (i % 2 ? -v : v));
  // a crystal prism: base polygon that narrows to a ridge as zt rises, leaning by (lx, ly)
  function prism(c, pts, zt, keep, lx, ly) {
    const ce = centroid(pts);
    S.poly(c, squeeze(pts, ce[0], ce[1], 1 - (1 - keep) * zt, (lx || 0) * zt, (ly || 0) * zt));
  }
  // linear interpolation along a joint chain [[x,y,z],...] at height z
  function chainAt(ch, z) {
    if (z <= ch[0][2]) return ch[0];
    for (let i = 1; i < ch.length; i++) {
      const a = ch[i - 1], b = ch[i];
      if (z <= b[2]) { const t = (z - a[2]) / Math.max(0.001, b[2] - a[2]); return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), z, i - 1 + t]; }
    }
    return ch[ch.length - 1];
  }
  // glowing seam helper: wide soft line + bright core
  function glowLine(c, col, hot, w, segs) { S.lines(c, C.str(col, 0.55), w * 1.9, segs); S.lines(c, C.str(hot), w * 0.7, segs); }

  /* ==================================================================
   * THRALL — Choir infantry. Tall, thin reverse-jointed biped (~22 units)
   * with a dark violet frame, bone mask / pauldrons / tabard, a glowing chest
   * core and eye, a crystal lance-rifle and a floating crystal over the head.
   * anims 4 = walk cycle.
   * ================================================================== */
  M.chThrall = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const HIP = 9.6;
    const legOf = (an, i) => {
      const ph = (an + i * 0.5) * TAU;
      const fx = Math.sin(ph) * 2.7, lift = Math.max(0, Math.cos(ph)) * 1.5;
      const y = i ? -1.55 : 1.55;
      return [[fx, y * 1.15, lift], [fx * 0.55 - 1.7, y * 1.1, lift + 2.6], [fx * 0.3 + 1.2, y, 6.1], [-0.2, y * 0.9, HIP]];
    };
    const parts = [];
    // feet: pointed hoof plates that lift during the swing
    parts.push({ z0: 0, z1: 2.4, side: T.deep, top: T.bodyT, bevel: false, shape: (c, zt, an) => {
      const z = zt * 2.4;
      for (let i = 0; i < 2; i++) { const L = legOf(an, i); const f = L[0]; if (z < f[2] - 0.01 || z > f[2] + 0.8) continue; S.poly(c, [f[0] + 1.9, f[1], f[0] - 0.4, f[1] + 1, f[0] - 1.2, f[1], f[0] - 0.4, f[1] - 1]); }
    } });
    // legs: reverse-jointed columns, thicker at the thigh
    parts.push({ z0: 0, z1: HIP, side: T.body, top: T.bodyT, bevel: false, ao: 0.25, shape: (c, zt, an) => {
      const z = zt * HIP;
      for (let i = 0; i < 2; i++) { const L = legOf(an, i); if (z < L[0][2]) continue; const q = chainAt(L, z); S.circ(c, q[0], q[1], q[3] > 2 ? 1.05 : q[3] > 1 ? 0.75 : 0.62); }
    } });
    // thigh plates (bone)
    parts.push({ z0: 6.4, z1: 8.6, side: T.boneS, top: T.boneT, bevel: false, shape: (c, zt, an) => {
      for (let i = 0; i < 2; i++) { const L = legOf(an, i); const q = chainAt(L, 7.4); S.ell(c, q[0] + 0.3, q[1] * 1.12, 1.25, 0.95); }
    } });
    // pelvis + bone tabard hanging at the front
    parts.push({ z0: 8.6, z1: 10.4, side: T.deep, top: T.body, shape: (c) => S.ell(c, -0.1, 0, 1.6, 2.2) });
    parts.push({ z0: 5.8, z1: 10.6, side: T.boneS, top: T.boneT, bevel: false, shape: (c) => S.poly(c, [2.3, 0, 1.9, 1.15, 1.1, 1.05, 1.2, -1.05, 1.9, -1.15]),
      detail: (c) => S.lines(c, C.str(T.glow), 0.35, [1.95, -0.6, 1.95, 0.6]) });
    // torso: narrow waist widening to the shoulders
    parts.push({ z0: 10.2, z1: 15.4, side: T.body, top: T.bodyT, shape: (c, zt) => S.ell(c, 0.1, 0, 1.7 + zt * 0.7, 2.0 + zt * 1.5),
      detail: (c) => { glowLine(c, T.glow, T.hot, 0.35, [-1.6, 0, -0.2, 0]); S.lines(c, SEAM, 0.3, [-0.6, -2.6, -0.6, 2.6]); } });
    // glowing chest core (protrudes from the chest front)
    parts.push({ z0: 11.4, z1: 13.8, side: T.glow, top: T.hot, flat: true, shape: (c) => S.circ(c, 1.95, 0, 0.95),
      detail: (c) => S.dot(c, C.str(T.white), 2.1, -0.2, 0.42) });
    // arms: left swings, right is bent holding the rifle
    parts.push({ z0: 9.4, z1: 14.6, side: T.body, top: T.bodyT, bevel: false, ao: 0.2, shape: (c, zt, an) => {
      const z = 9.4 + zt * 5.2;
      const sw = Math.sin(an * TAU) * 1.7;
      const L = [[-sw, -3.2, 9.4], [-sw * 0.4, -3.15, 12], [-0.2, -2.9, 14.6]];
      const q = chainAt(L, z); S.circ(c, q[0], q[1], 0.62);
      if (z >= 10.4) { const R = [[1.4, 2.7, 10.4], [0.1, 3.1, 12.4], [-0.2, 2.9, 14.6]]; const r = chainAt(R, z); S.circ(c, r[0], r[1], 0.62); }
    } });
    // crystal lance-rifle held at the hip
    parts.push({ z0: 10, z1: 11.2, side: T.deep, top: T.bodyT, bevel: false, shape: (c) => S.poly(c, [6.4, 2.45, 5.6, 3.05, -1.2, 3.1, -1.6, 2.6, -1.2, 2.2, 5.6, 2.0]),
      detail: (c) => S.lines(c, LITE, 0.3, [-0.8, 2.3, 5.4, 2.2]) });
    parts.push({ z0: 10.4, z1: 11.6, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, [8.0, 2.55, 6.2, 3.0, 5.7, 2.55, 6.2, 2.1]) });
    // bone pauldrons
    parts.push({ z0: 13.6, z1: 15.8, side: T.boneS, top: T.boneT, shape: (c, zt) => { S.ell(c, -0.3, 3.0, 1.9 - zt * 0.25, 1.45, 0.25); S.ell(c, -0.3, -3.0, 1.9 - zt * 0.25, 1.45, -0.25); },
      detail: (c) => { S.lines(c, SEAM, 0.3, [-1.4, 2.4, 0.9, 3.6, -1.4, -2.4, 0.9, -3.6]); } });
    // bone mask head, tapering upward, pointed forward
    parts.push({ z0: 15.2, z1: 19.2, side: T.boneS, top: T.boneT, shape: (c, zt) => {
      const k = 1 - zt * 0.3;
      S.poly(c, [0.6 + 2.0 * k, 0, 0.6 + 1.1 * k, 1.25 * k, -1.2 * k, 1.05 * k, -1.6 * k, 0, -1.2 * k, -1.05 * k, 0.6 + 1.1 * k, -1.25 * k]);
    }, detail: (c) => { S.lines(c, SEAM, 0.28, [1.6, 0, -1, 0]); } });
    // glowing eye slit on the mask front
    parts.push({ z0: 16.6, z1: 17.6, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, [2.75, 0, 2.15, 0.95, 1.9, 0.85, 2.2, 0, 1.9, -0.85, 2.15, -0.95]) });
    // floating crystal above the head (diamond, detached)
    parts.push({ z0: 20.2, z1: 23.6, side: C.shade(T.glow, -0.25), top: T.hot, flat: true, shape: (c, zt) => {
      const w = Math.sin(Math.max(0.12, Math.min(0.88, zt)) * Math.PI) * 0.95;
      S.poly(c, [-0.3 + w, 0, -0.3, w * 0.8, -0.3 - w, 0, -0.3, -w * 0.8]);
    } });
    return { r: 10, h: 24, parts, scale: sc, bevel: 0.5 };
  };

  /* ==================================================================
   * SENTRY — angular hovering eye drone: faceted dark hull (inverted
   * pyramid underside), three floating bone fins that slowly spin, a big
   * violet lens in a bone socket and a bright under-thruster glow.
   * anims 1..4 (fins rotate 120 degrees per cycle, seamless).
   * ================================================================== */
  M.chSentry = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1, nf = o.fins || 3;
    const finRot = (an) => an * TAU / nf + 0.35;
    const fin = (c, an, grow) => {
      for (let i = 0; i < nf; i++) {
        const a = finRot(an) + (i / nf) * TAU + Math.PI / nf;
        const ca = Math.cos(a), sa = Math.sin(a);
        const pt = (r, t) => [ca * r - sa * t, sa * r + ca * t];
        const q = [pt(7.2, -1.8), pt(12.8 + grow, 1.4), pt(10.6, 2.6), pt(7.6, 1.5)];
        S.poly(c, [q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]]);
      }
    };
    const parts = [
      // under-thruster glow
      { z0: 0, z1: 0.6, side: T.glow, top: T.hot, flat: true, shape: (c) => S.circ(c, 0, 0, 2.4), detail: (c) => S.dot(c, C.str(T.white), 0, 0, 1.2) },
      // lower hull: inverted faceted pyramid
      { z0: 0.6, z1: 4.2, side: T.deep, top: T.body, ao: 0.2, shape: (c, zt) => S.poly(c, ngon(0, 0, 2.6 + zt * 3.8, 6, Math.PI / 6)) },
      // glowing waist band
      { z0: 4.2, z1: 4.8, side: T.glow, top: T.glow, flat: true, shape: (c) => S.poly(c, ngon(0, 0, 6.5, 6, Math.PI / 6)) },
      // upper hull: faceted, tapering
      { z0: 4.8, z1: 7.4, side: T.body, top: T.bodyT, shape: (c, zt) => S.poly(c, ngon(0, 0, 6.4 - zt * 1.4, 6, Math.PI / 6)),
        detail: (c) => {
          const h = ngon(0, 0, 5.0, 6, Math.PI / 6);
          S.lines(c, SEAM, 0.35, [0, 0, h[4], h[5], 0, 0, h[6], h[7], 0, 0, h[8], h[9]]);
          S.fillPoly(c, C.str(T.boneT), [-4.6, 0, -3.2, 2.2, -2.2, 1.4, -2.9, 0, -2.2, -1.4, -3.2, -2.2]);
        } },
      // floating fins (bone) + glowing tips
      { z0: 4.4, z1: 5.8, side: T.boneS, top: T.boneT, shape: (c, zt, an) => fin(c, an, 0),
        detail: (c, an) => { for (let i = 0; i < nf; i++) { const a = finRot(an) + (i / nf) * TAU + Math.PI / nf; const ca = Math.cos(a), sa = Math.sin(a); S.lines(c, C.str(T.glow), 0.5, [ca * 8 - sa * 0.4, sa * 8 + ca * 0.4, ca * 11.4 - sa * 1.6, sa * 11.4 + ca * 1.6]); } } },
      // lens socket (bone rim) — the eye sits forward on the crown
      { z0: 6.2, z1: 8.6, side: T.boneS, top: T.boneT, shape: (c, zt) => S.circ(c, 2.0, 0, 2.9 - zt * 0.3) },
      // lens
      { z0: 8.6, z1: 9.2, side: T.glow, top: T.glow, flat: true, shape: (c) => S.circ(c, 2.15, 0, 2.05),
        detail: (c) => {
          const g = c.createRadialGradient(2.5, -0.3, 0.1, 2.15, 0, 2.05);
          g.addColorStop(0, C.str(T.white)); g.addColorStop(0.35, C.str(T.hot)); g.addColorStop(0.8, C.str(T.glow)); g.addColorStop(1, C.str(C.shade(T.glow, -0.45)));
          c.fillStyle = g; c.beginPath(); S.circ(c, 2.15, 0, 2.05); c.fill();
          S.dot(c, C.str(C.shade(p.d, -0.3)), 2.6, 0, 0.62);
          S.dot(c, 'rgba(255,255,255,0.9)', 1.5, -0.8, 0.42);
        } },
    ];
    return { r: 15, h: 10, parts, scale: sc, bevel: 0.6 };
  };

  /* ==================================================================
   * SHARDBACK — hover tank. Bone hull on a dark anti-grav skirt with a
   * violet under-glow, faceted dark-violet crystal armour shards along the
   * flanks and a row of tall dorsal shards behind the turret ring. The
   * rotating gun sheet sits on the socket (gunZ 7.6). opt.turret bakes a
   * fixed long-cannon turret into the hull instead.
   * ================================================================== */
  M.chShardback = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const skirt = S.sym([16, 0, 12, 6.2, 4, 10, -8, 10.4, -14, 7.6, -15.6, 0]);
    const hull = S.sym([18, 0, 12.5, 5.2, 4.5, 8.4, -9, 8.8, -14.2, 6.4, -16, 0]);
    const flank = [[9.5, 6.6, 4.5, 8.6, 3.5, 11.6, 8.2, 8.6], [2.8, 8.2, -3.6, 9.4, -4.8, 12.6, 1.0, 10.2], [-4.6, 8.8, -11, 8.0, -12.8, 10.8, -6.6, 11.2]];
    const parts = [
      { z0: 0, z1: 1.2, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, squeeze(skirt, 0, 0, 0.84)) },
      { z0: 1.2, z1: 3, side: T.deep, top: T.body, ao: 0.2, shape: (c) => S.poly(c, skirt) },
      { z0: 3, z1: 6.2, side: T.boneS, top: T.boneT, shape: (c) => S.poly(c, hull),
        detail: (c) => {
          glowLine(c, T.glow, T.hot, 0.4, [16, 0, 8, 3.2, 16, 0, 8, -3.2, 8, 3.2, -2, 5.6, 8, -3.2, -2, -5.6]);
          S.lines(c, SEAM, 0.4, [12.5, 5.2, 9, 0, 12.5, -5.2, 9, 0, -9, 8.8, -12, 0, -9, -8.8, -12, 0]);
          S.fillPoly(c, cs(T.deep), [17.2, 0, 14.6, 1.3, 14, 0, 14.6, -1.3]);
          S.lines(c, LITE, 0.35, [17.2, 0.5, 12.6, 4.9]);
        } },
      // flank crystal shards (3 per side) leaning outward/back
      { z0: 4, z1: 8.8, side: T.shard, top: T.shardT, shape: (c, zt) => { for (const f of flank) { prism(c, f, zt, 0.35, -1.2, 0.8); prism(c, mirrorY(f), zt, 0.35, -1.2, -0.8); } },
        detail: (c) => { for (const f of flank) { const ce = centroid(f); S.dot(c, C.str(T.hot), ce[0] - 1.2, ce[1] + 0.8, 0.35); S.dot(c, C.str(T.hot), ce[0] - 1.2, -ce[1] - 0.8, 0.35); } } },
      // turret socket ring
      { z0: 6.2, z1: 7.6, side: T.deep, top: T.body, shape: (c) => S.poly(c, ngon(1, 0, 5.2, 8, Math.PI / 8)),
        detail: (c) => { c.save(); c.strokeStyle = C.str(T.glow); c.lineWidth = 0.5; c.beginPath(); S.circ(c, 1, 0, 4.1); c.stroke(); c.restore(); } },
      // dorsal shards: the "shard back" rising behind the turret
      { z0: 6.2, z1: 13.5, side: T.shard, top: T.shardT, shape: (c, zt) => {
        const sh = [[-5.6, 0, 2.6, 13.5], [-9.6, 0, 2.2, 11.6], [-13, 0, 1.8, 9.8]];
        for (const s of sh) { const top = (s[3] - 6.2) / 7.3; if (zt > top) continue; const k = zt / top; const w = s[2] * (1 - k * 0.8); S.poly(c, [s[0] + w * 1.4 - k * 2.6, 0, s[0] - k * 2.6, w, s[0] - w * 1.1 - k * 2.6, 0, s[0] - k * 2.6, -w]); }
      }, detail: (c) => glowLine(c, T.glow, T.hot, 0.3, [-6.6, 0, -9.0, 0]) },
    ];
    if (o.turret) {
      parts.push({ z0: 7.6, z1: 10.6, side: T.body, top: T.bodyT, shape: (c, zt) => S.poly(c, ngon(1, 0, 4.4 - zt * 0.8, 6, 0)), detail: (c) => S.dot(c, C.str(T.glow), -0.5, 0, 1) });
      parts.push({ z0: 8.6, z1: 10, side: T.deep, top: T.boneT, shape: (c) => S.rrect(c, 3, -0.9, 19, 1.8, 0.6), detail: (c) => S.lines(c, SEAM, 0.35, [8, -0.9, 8, 0.9, 14, -0.9, 14, 0.9]) });
      parts.push({ z0: 8.4, z1: 10.2, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, [24.5, 0, 22, 1.5, 21.4, 0, 22, -1.5]) });
    }
    return { r: o.turret ? 25 : 19, h: 15, parts, scale: sc, bevel: 0.7, gunZ: 7.6 * sc };
  };
})(window.AS);
