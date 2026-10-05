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
  const baseGun = M.gun; // captured at load so chGun's fallback never recurses if it replaces M.gun

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
    const HIP = 10.4;
    const legOf = (an, i) => {
      const ph = (an + i * 0.5) * TAU;
      const fx = Math.sin(ph) * 2.8, lift = Math.max(0, Math.cos(ph)) * 1.6;
      const y = i ? -1.45 : 1.45;
      return [[fx, y * 1.15, lift], [fx * 0.55 - 1.8, y * 1.1, lift + 2.8], [fx * 0.3 + 1.3, y, 6.6], [-0.2, y * 0.85, HIP]];
    };
    const parts = [];
    // feet: pointed hoof plates that lift during the swing
    parts.push({ z0: 0, z1: 2.6, side: T.deep, top: T.bodyT, bevel: false, shape: (c, zt, an) => {
      const z = zt * 2.6;
      for (let i = 0; i < 2; i++) { const f = legOf(an, i)[0]; if (z < f[2] - 0.01 || z > f[2] + 0.8) continue; S.poly(c, [f[0] + 2.0, f[1], f[0] - 0.4, f[1] + 1, f[0] - 1.2, f[1], f[0] - 0.4, f[1] - 1]); }
    } });
    // legs: reverse-jointed columns, thicker at the thigh
    parts.push({ z0: 0, z1: HIP, side: T.body, top: T.bodyT, bevel: false, ao: 0.25, shape: (c, zt, an) => {
      const z = zt * HIP;
      for (let i = 0; i < 2; i++) { const L = legOf(an, i); if (z < L[0][2]) continue; const q = chainAt(L, z); S.circ(c, q[0], q[1], q[3] > 2 ? 1.0 : q[3] > 1 ? 0.72 : 0.6); }
    } });
    // bone shin guards
    parts.push({ z0: 3.2, z1: 5.6, side: T.boneS, top: T.boneT, bevel: false, shape: (c, zt, an) => {
      const z = 3.2 + zt * 2.4;
      for (let i = 0; i < 2; i++) { const L = legOf(an, i); if (z < L[1][2]) continue; const q = chainAt(L, z); S.ell(c, q[0] + 0.45, q[1], 0.75, 0.62); }
    } });
    // pelvis + violet tabard hanging at the front
    parts.push({ z0: 9.4, z1: 11, side: T.deep, top: T.body, shape: (c) => S.ell(c, -0.1, 0, 1.5, 2.0) });
    parts.push({ z0: 6.6, z1: 11.2, side: C.shade(p.t, -0.25), top: p.t, bevel: false, shape: (c) => S.poly(c, [2.2, 0, 1.8, 1.0, 1.0, 0.9, 1.1, -0.9, 1.8, -1.0]),
      detail: (c) => S.lines(c, C.str(T.glow), 0.4, [1.9, -0.55, 1.9, 0.55]) });
    // torso: narrow waist widening to the shoulders
    parts.push({ z0: 10.8, z1: 16.4, side: T.body, top: T.bodyT, shape: (c, zt) => S.ell(c, 0, 0, 1.45 + zt * 0.7, 1.6 + zt * 1.45),
      detail: (c) => { glowLine(c, T.glow, T.hot, 0.35, [-1.7, 0, -0.4, 0]); S.lines(c, SEAM, 0.3, [-0.7, -2.5, -0.7, 2.5]); } });
    // glowing chest core (protrudes from the chest front)
    parts.push({ z0: 12.4, z1: 15, side: T.glow, top: T.hot, flat: true, shape: (c) => S.circ(c, 1.85, 0, 1.05),
      detail: (c) => S.dot(c, C.str(T.white), 2.0, -0.25, 0.45) });
    // arms: left swings, right is bent holding the rifle
    parts.push({ z0: 10.2, z1: 15.6, side: T.body, top: T.bodyT, bevel: false, ao: 0.2, shape: (c, zt, an) => {
      const z = 10.2 + zt * 5.4;
      const sw = Math.sin(an * TAU) * 1.7;
      const L = [[-sw, -3.0, 10.2], [-sw * 0.4, -3.0, 12.8], [-0.2, -2.7, 15.6]];
      const q = chainAt(L, z); S.circ(c, q[0], q[1], 0.58);
      if (z >= 11.2) { const R = [[1.4, 2.6, 11.2], [0.1, 2.95, 13.2], [-0.2, 2.7, 15.6]]; const r = chainAt(R, z); S.circ(c, r[0], r[1], 0.58); }
    } });
    // crystal lance-rifle held at the hip
    parts.push({ z0: 10.8, z1: 12, side: T.deep, top: T.bodyT, bevel: false, shape: (c) => S.poly(c, [6.6, 2.4, 5.8, 3.0, -1.2, 3.05, -1.6, 2.55, -1.2, 2.15, 5.8, 1.95]),
      detail: (c) => S.lines(c, LITE, 0.3, [-0.8, 2.25, 5.6, 2.15]) });
    parts.push({ z0: 11.2, z1: 12.4, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, [8.3, 2.5, 6.4, 2.95, 5.9, 2.5, 6.4, 2.05]) });
    // bone pauldrons
    parts.push({ z0: 15.0, z1: 16.8, side: T.boneS, top: T.boneT, shape: (c, zt) => { S.ell(c, -0.3, 2.75, 1.35 - zt * 0.2, 1.05, 0.25); S.ell(c, -0.3, -2.75, 1.35 - zt * 0.2, 1.05, -0.25); },
      detail: (c) => S.lines(c, SEAM, 0.3, [-1.1, 2.3, 0.7, 3.2, -1.1, -2.3, 0.7, -3.2]) });
    // bone mask head, tapering upward, pointed forward
    parts.push({ z0: 16.4, z1: 19.6, side: T.boneS, top: T.boneT, shape: (c, zt) => {
      const k = 0.82 * (1 - zt * 0.3);
      S.poly(c, [0.5 + 2.0 * k, 0, 0.5 + 1.1 * k, 1.25 * k, -1.2 * k, 1.05 * k, -1.6 * k, 0, -1.2 * k, -1.05 * k, 0.5 + 1.1 * k, -1.25 * k]);
    }, detail: (c) => S.lines(c, SEAM, 0.28, [1.3, 0, -0.8, 0]) });
    // glowing eye slit on the mask front
    parts.push({ z0: 17.6, z1: 18.6, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, [2.5, 0, 1.95, 0.85, 1.7, 0.75, 1.95, 0, 1.7, -0.75, 1.95, -0.85]) });
    // floating crystal above the head (diamond, detached)
    parts.push({ z0: 21, z1: 24.6, side: C.shade(T.glow, -0.25), top: T.hot, flat: true, shape: (c, zt) => {
      const w = Math.sin(Math.max(0.12, Math.min(0.88, zt)) * Math.PI) * 0.95;
      S.poly(c, [-0.3 + w, 0, -0.3, w * 0.8, -0.3 - w, 0, -0.3, -w * 0.8]);
    } });
    return { r: 10, h: 25, parts, scale: sc, bevel: 0.5 };
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
      { z0: 6.4, z1: 8.2, side: T.boneS, top: T.boneT, shape: (c, zt) => S.circ(c, 2.0, 0, 3.4 - zt * 0.3) },
      // lens
      { z0: 8.2, z1: 8.8, side: T.glow, top: T.glow, flat: true, shape: (c) => S.circ(c, 2.2, 0, 2.55),
        detail: (c) => {
          const g = c.createRadialGradient(2.6, -0.3, 0.1, 2.2, 0, 2.55);
          g.addColorStop(0, C.str(T.white)); g.addColorStop(0.35, C.str(T.hot)); g.addColorStop(0.8, C.str(T.glow)); g.addColorStop(1, C.str(C.shade(T.glow, -0.45)));
          c.fillStyle = g; c.beginPath(); S.circ(c, 2.2, 0, 2.55); c.fill();
          c.save(); c.strokeStyle = C.str(C.shade(p.d, -0.2), 0.7); c.lineWidth = 0.3; c.beginPath(); S.circ(c, 2.2, 0, 1.7); c.stroke(); c.restore();
          S.dot(c, C.str(C.shade(p.d, -0.3)), 2.75, 0, 0.7);
          S.dot(c, 'rgba(255,255,255,0.9)', 1.4, -0.9, 0.5);
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
    const skirt = S.sym([17, 0, 11, 5.4, 4, 9.4, -8, 10, -14.4, 7.6, -16, 3, -16, 0]);
    const hull = S.sym([19, 0, 13, 4.8, 6, 8.4, -6, 9.2, -13, 8.0, -16.4, 4.2, -16.4, 0]);
    // faceted crystal armour plates on the deck (starboard; mirrored)
    const plates = [[13.6, 3.0, 11.6, 5.4, 5.6, 7.8, 7.4, 3.6], [5.0, 4.0, 4.2, 8.2, -4.4, 8.8, -3.8, 4.4], [-5.6, 4.4, -5.6, 8.8, -12.4, 7.6, -12.0, 3.6]];
    // shards jutting out of the flanks, swept back
    const spikes = [[9.2, 6.6, 3.2, 8.8, -0.6, 13.2], [1.4, 8.8, -5.4, 9.4, -9.2, 13.6], [-7.0, 9.2, -12.6, 8.2, -17.2, 11.4]];
    const parts = [
      { z0: 0, z1: 1.2, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, squeeze(skirt, 0, 0, 0.86)) },
      { z0: 1.2, z1: 3, side: T.deep, top: T.body, ao: 0.2, shape: (c) => S.poly(c, skirt) },
      // dark core hull
      { z0: 3, z1: 5.4, side: T.body, top: T.bodyT, shape: (c) => S.poly(c, hull),
        detail: (c) => glowLine(c, T.glow, T.hot, 0.3, [18, 0.4, 13, 4.4, 18, -0.4, 13, -4.4]) },
      // flank spikes
      { z0: 3.6, z1: 7.4, side: T.shard, top: T.shardT, shape: (c, zt) => { for (const f of spikes) { prism(c, f, zt, 0.4, -0.8, 0.9); prism(c, mirrorY(f), zt, 0.4, -0.8, -0.9); } } },
      // bone spine / prow plate
      { z0: 5.4, z1: 7, side: T.boneS, top: T.boneT, shape: (c) => S.poly(c, [19.4, 0, 14.4, 2.4, 2, 3.2, -15.8, 2.2, -15.8, -2.2, 2, -3.2, 14.4, -2.4]),
        detail: (c) => {
          glowLine(c, T.glow, T.hot, 0.35, [17.6, 0, 10, 0, 14, -1.5, 14, 1.5]);
          S.lines(c, SEAM, 0.35, [-8, -2.6, -8, 2.6, -12.5, -2.3, -12.5, 2.3]);
          S.lines(c, LITE, 0.35, [19, 0.4, 14.2, 2.2]);
        } },
      // crystal armour plates
      { z0: 5, z1: 7.8, side: T.shard, top: T.shardT, shape: (c, zt) => { for (const f of plates) { prism(c, f, zt, 0.75, -0.2, 0.3); prism(c, mirrorY(f), zt, 0.75, -0.2, -0.3); } },
        detail: (c) => { for (const f of plates) { const ce = centroid(f); for (const sg of [1, -1]) { S.lines(c, 'rgba(255,255,255,0.3)', 0.35, [f[0] - 0.2, (f[1] + 0.3) * sg, f[2] - 0.2, (f[3] + 0.3) * sg]); S.lines(c, C.str(T.hot, 0.75), 0.3, [ce[0] + 1, ce[1] * sg, ce[0] - 1.2, (ce[1] + 1.2) * sg]); } } } },
      // turret socket ring
      { z0: 7, z1: 7.8, side: T.deep, top: T.body, shape: (c) => S.poly(c, ngon(0.5, 0, 4.8, 8, Math.PI / 8)),
        detail: (c) => { c.save(); c.strokeStyle = C.str(T.glow); c.lineWidth = 0.55; c.beginPath(); S.circ(c, 0.5, 0, 3.8); c.stroke(); c.restore(); } },
      // dorsal shards: the "shard back" rising behind the turret
      { z0: 6.8, z1: 16, side: T.shard, top: T.shardT, shape: (c, zt) => {
        const sh = [[-7.0, 2.7, 16], [-11.0, 2.3, 13.6], [-14.4, 1.9, 11.2]];
        for (const s of sh) { const top = (s[2] - 6.8) / 9.2; if (zt > top) continue; const k = zt / top; const w = s[1] * (1 - k * 0.82), x = s[0] - k * 3.4; S.poly(c, [x + w * 1.4, 0, x, w, x - w * 1.1, 0, x, -w]); }
      }, detail: (c) => glowLine(c, T.glow, T.hot, 0.3, [-8.4, 0, -10.6, 0]) },
    ];
    if (o.turret) {
      parts.push({ z0: 7.8, z1: 10.6, side: T.body, top: T.bodyT, shape: (c, zt) => S.poly(c, ngon(2, 0, 4.4 - zt * 0.8, 6, 0)), detail: (c) => S.dot(c, C.str(T.glow), 0.5, 0, 1) });
      parts.push({ z0: 8.6, z1: 10, side: T.deep, top: T.boneT, shape: (c) => S.rrect(c, 4, -0.9, 19, 1.8, 0.6), detail: (c) => S.lines(c, SEAM, 0.35, [9, -0.9, 9, 0.9, 15, -0.9, 15, 0.9]) });
      parts.push({ z0: 8.4, z1: 10.2, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, [25.5, 0, 23, 1.5, 22.4, 0, 23, -1.5]) });
    }
    return { r: o.turret ? 26 : 20, h: 17, parts, scale: sc, bevel: 0.7, gunZ: 7.8 * sc };
  };

  /* ==================================================================
   * NEEDLER — missile battery. A wide, boxy sled on four anti-grav pads
   * with two bone launcher banks full of glowing needle missiles along the
   * flanks; the rotating missile rack (gun sheet) sits on the centre
   * socket (gunZ 6.8).
   * ================================================================== */
  M.chNeedler = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const pads = [[9, 9.6], [9, -9.6], [-9.5, 9.8], [-9.5, -9.8]];
    const hull = S.sym([14, 0, 13, 4.6, 10, 7.2, -10.5, 7.4, -13.6, 5, -13.6, 0]);
    const cells = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) cells.push([2.6 - i * 3.3, 8.0 + j * 2.4]);
    const parts = [
      { z0: 0, z1: 0.8, side: T.glow, top: T.hot, flat: true, shape: (c) => { for (const q of pads) S.ell(c, q[0], q[1], 2.6, 1.8); } },
      { z0: 0.8, z1: 3, side: T.deep, top: T.body, ao: 0.2, shape: (c, zt) => { for (const q of pads) S.ell(c, q[0], q[1], 3.2 + zt * 0.6, 2.3 + zt * 0.4); },
        detail: (c) => { for (const q of pads) S.lines(c, C.str(T.glow, 0.8), 0.35, [q[0] - 2.4, q[1], q[0] + 2.4, q[1]]); } },
      { z0: 2, z1: 5.6, side: T.body, top: T.bodyT, shape: (c) => S.poly(c, hull),
        detail: (c) => { S.lines(c, SEAM, 0.4, [6, -6.8, 6, 6.8, -6, -6.8, -6, 6.8]); glowLine(c, T.glow, T.hot, 0.3, [-13, 2.4, -13, -2.4]); } },
      // prow mask with twin eyes
      { z0: 5.6, z1: 6.6, side: T.boneS, top: T.boneT, shape: (c) => S.poly(c, [14.6, 0, 12.4, 4.2, 8.6, 4.6, 9.6, 0, 8.6, -4.6, 12.4, -4.2]),
        detail: (c) => { S.fillPoly(c, C.str(T.hot), [13.4, 1.0, 11.6, 2.8, 11.2, 2.2, 12.8, 0.8]); S.fillPoly(c, C.str(T.hot), [13.4, -1.0, 11.6, -2.8, 11.2, -2.2, 12.8, -0.8]); } },
      // launcher banks along both flanks
      { z0: 3.6, z1: 8.6, side: T.boneS, top: T.boneT, shape: (c) => { S.poly(c, [5.2, 6.4, 5.2, 11.6, -12, 11.8, -13, 10, -13, 6.4]); S.poly(c, [5.2, -6.4, 5.2, -11.6, -12, -11.8, -13, -10, -13, -6.4]); },
        detail: (c) => {
          for (const sg of [1, -1]) {
            c.save(); c.fillStyle = C.str(T.deep); c.beginPath(); S.rrect(c, -11.6, (sg > 0 ? 6.9 : -11.1), 16, 4.2, 0.8); c.fill(); c.restore();
            for (const q of cells) { S.dot(c, C.str(C.shade(p.d, -0.4)), q[0], q[1] * sg, 0.95); S.dot(c, C.str(T.glow), q[0] + 0.25, q[1] * sg, 0.55); S.dot(c, C.str(T.white), q[0] + 0.35, q[1] * sg, 0.22); }
            S.lines(c, LITE, 0.35, [4.8, 6.6 * sg, -12.6, 6.6 * sg]);
            S.fillPoly(c, C.str(p.t), [-12.8, 6.8 * sg, -12.8, 11.4 * sg, -12.0, 11.4 * sg, -12.0, 6.8 * sg]);
          }
        } },
      // needle tips poking out of the front cells (loaded)
      { z0: 8.6, z1: 10.4, side: T.glow, top: T.white, flat: true, shape: (c, zt) => { const r = 0.5 * (1 - zt * 0.7); for (const q of cells.slice(0, 4)) { S.circ(c, q[0] + 0.25, q[1], r); S.circ(c, q[0] + 0.25, -q[1], r); } } },
      // centre socket for the rotating rack
      { z0: 5.6, z1: 6.8, side: T.deep, top: T.body, shape: (c) => S.poly(c, ngon(0, 0, 5.2, 8, Math.PI / 8)),
        detail: (c) => { c.save(); c.strokeStyle = C.str(T.glow); c.lineWidth = 0.5; c.beginPath(); S.circ(c, 0, 0, 4.2); c.stroke(); c.restore(); } },
    ];
    return { r: 17, h: 12, parts, scale: sc, bevel: 0.7, gunZ: 6.8 * sc };
  };

  /* ==================================================================
   * OVERSEER KA-THEL — unique commander hover tank. Broad kite hull with
   * two fixed heavy sponson cannons, bone armour trimmed in red and gold, a
   * glowing data-core orb in a gold cradle on the rear deck, and a crown of
   * five floating crystal fins arcing behind the turret (bob over anims).
   * Built at full size (use opt {} — not size 1.35); gun sheet at gunZ 9.
   * ================================================================== */
  M.chOverseer = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const skirt = S.sym([23, 0, 15, 7.5, 6, 14.4, -10, 15.4, -18, 11.6, -21.5, 5, -21.5, 0]);
    const hull = S.sym([25, 0, 16, 7, 6, 13.6, -10, 14.6, -17.6, 11, -21, 5, -21, 0]);
    const crown = [];
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.72 + i * 0.14); crown.push([Math.cos(a) * 11.5 - 3, Math.sin(a) * 11.5, a, i === 2 ? 1 : i === 1 || i === 3 ? 0.85 : 0.7]); }
    const bob = (an, i) => Math.sin((an + i * 0.2) * TAU) * 0.7;
    const parts = [
      { z0: 0, z1: 1.4, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, squeeze(skirt, 0, 0, 0.86)) },
      { z0: 1.4, z1: 3.4, side: T.deep, top: T.body, ao: 0.2, shape: (c) => S.poly(c, skirt) },
      { z0: 3.4, z1: 6.4, side: T.body, top: T.bodyT, shape: (c) => S.poly(c, hull),
        detail: (c) => { glowLine(c, T.glow, T.hot, 0.35, [23, 0, 15, 5, 23, 0, 15, -5]); S.lines(c, SEAM, 0.4, [6, -12, 6, 12, -10, -13.4, -10, 13.4]); } },
      // sponson housings (bone, red stripe, gold edge)
      { z0: 4.4, z1: 8.6, side: T.shard, top: T.shardT, shape: (c) => { S.poly(c, [10, 8.8, 9, 14.6, -6, 15.6, -9, 12, -8, 8.4]); S.poly(c, [10, -8.8, 9, -14.6, -6, -15.6, -9, -12, -8, -8.4]); },
        detail: (c) => { for (const sg of [1, -1]) { S.fillPoly(c, RED, [9.6, 9.6 * sg, 9.2, 12.4 * sg, -6.6, 13.6 * sg, -7.2, 11.2 * sg]); S.lines(c, GOLD, 0.45, [9.2, 12.6 * sg, -6.4, 13.9 * sg, 9.8, 9.4 * sg, -7.6, 11.0 * sg]); S.dot(c, GOLD, -2, 12.2 * sg, 0.7); } } },
      // heavy sponson barrels
      { z0: 5.4, z1: 7.6, side: T.deep, top: C.mix(T.bodyT, T.boneT, 0.3), shape: (c) => { S.poly(c, [27, 10.6, 27, 13, 9, 13.6, 9, 10]); S.poly(c, [27, -10.6, 27, -13, 9, -13.6, 9, -10]); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.35, [16, 10.2 * sg, 16, 13.4 * sg, 21, 10.4 * sg, 21, 13.2 * sg]); S.lines(c, LITE, 0.35, [10, 10.6 * sg, 26, 10.9 * sg]); } } },
      { z0: 5.0, z1: 8.0, side: C.shade(GOLD, -0.3), top: GOLD, shape: (c) => { S.rrect(c, 26, 10, 2.4, 3.6, 0.6); S.rrect(c, 26, -13.6, 2.4, 3.6, 0.6); },
        detail: (c) => { S.dot(c, RED, 27.4, 11.8, 0.8); S.dot(c, RED, 27.4, -11.8, 0.8); } },
      // bone spine with gold trim
      { z0: 6.4, z1: 8, side: T.boneS, top: T.boneT, shape: (c) => S.poly(c, [25.4, 0, 18, 2.8, 4, 3.6, -20, 2.6, -20, -2.6, 4, -3.6, 18, -2.8]),
        detail: (c) => { S.lines(c, GOLD, 0.5, [24.6, 0.4, 17.6, 2.5, 24.6, -0.4, 17.6, -2.5]); S.fillPoly(c, RED, [23, 0, 19.4, 1.2, 18.4, 0, 19.4, -1.2]); glowLine(c, T.glow, T.hot, 0.3, [-19, 0, -16, 0]); } },
      // crystal plates on the deck
      { z0: 6, z1: 8.8, side: T.shard, top: T.shardT, shape: (c, zt) => { const pl = [16.6, 5.4, 13, 8.2, 6.4, 10.6, 7.6, 5.8]; const pl2 = [-11, 5.2, -11, 12.4, -16.8, 10.4, -18.4, 4.6]; for (const f of [pl, pl2]) { prism(c, f, zt, 0.7, -0.2, 0.3); prism(c, mirrorY(f), zt, 0.7, -0.2, -0.3); } } },
      // turret socket ring (gold)
      { z0: 8, z1: 9, side: C.shade(GOLD, -0.45), top: C.shade(GOLD, -0.15), shape: (c) => S.poly(c, ngon(0, 0, 6.6, 10, 0)),
        detail: (c) => { c.save(); c.strokeStyle = C.str(T.glow); c.lineWidth = 0.6; c.beginPath(); S.circ(c, 0, 0, 5.4); c.stroke(); c.restore(); } },
      // data-core cradle (gold) and the glowing core orb
      { z0: 8, z1: 10, side: C.shade(GOLD, -0.4), top: GOLD, shape: (c) => { S.circ(c, -13.6, 0, 4.0); },
        detail: (c) => { S.dot(c, C.str(T.deep), -13.6, 0, 3.1); for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; S.dot(c, RED, -13.6 + Math.cos(a) * 3.55, Math.sin(a) * 3.55, 0.45); } } },
      { z0: 9.6, z1: 15.2, side: T.hot, top: T.white, flat: true, shape: (c, zt) => S.circ(c, -13.6, 0, Math.max(0.4, Math.sin(Math.min(0.9, 0.1 + zt) * Math.PI) * 2.9)),
        detail: (c) => { S.dot(c, C.str(T.glow, 0.6), -13.2, 0.4, 1.6); S.dot(c, '#ffffff', -14.2, -0.7, 0.8); } },
      // crown of floating fins (crystal, gold tipped), arcing behind the turret
      { z0: 11, z1: 22, side: C.mix(T.shard, T.glow, 0.25), top: C.mix(T.shardT, T.hot, 0.35), shape: (c, zt, an) => {
        const z = 11 + zt * 11;
        crown.forEach((q, i) => {
          const zb = 12 + bob(an, i), zh = zb + 9 * q[3];
          if (z < zb || z > zh) return;
          const k = (z - zb) / (zh - zb);
          const w = (k < 0.25 ? 0.6 + k * 1.6 : 1 - (k - 0.25) * 1.25) * 2.1;
          const out = 1 + k * 3.2, ca = Math.cos(q[2]), sa = Math.sin(q[2]);
          const cx = q[0] + ca * out, cy = q[1] + sa * out;
          S.poly(c, [cx + ca * w * 1.1, cy + sa * w * 1.1, cx - sa * w * 0.8, cy + ca * w * 0.8, cx - ca * w * 0.9, cy - sa * w * 0.9, cx + sa * w * 0.8, cy - ca * w * 0.8]);
        });
      } },
      // gold tips on the crown fins
      { z0: 18, z1: 22.6, side: C.shade(GOLD, -0.2), top: '#fff0b0', flat: true, shape: (c, zt, an) => {
        const z = 18 + zt * 4.6;
        crown.forEach((q, i) => {
          const zh = 12 + bob(an, i) + 9 * q[3];
          if (z < zh - 1.1 || z > zh + 0.3) return;
          const ca = Math.cos(q[2]), sa = Math.sin(q[2]);
          S.circ(c, q[0] + ca * 4.2, q[1] + sa * 4.2, 0.55);
        });
      } },
    ];
    return { r: 30, h: 24, parts, scale: sc, bevel: 0.8, gunZ: 9 * sc };
  };

  /* ==================================================================
   * STORM INTERCEPTOR — Choir fighter. Low needle fuselage with a bone
   * dorsal plate, forward-swept dark crystal blade wings with glowing
   * leading edges, mandible prongs at the nose and twin violet drives.
   * ================================================================== */
  M.chStormInt = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const wing = [-1, 2.4, 7.4, 14.6, 5.6, 16.2, -6.4, 11.2, -10.4, 3];
    const parts = [
      // drive glow (rear)
      { z0: 1.6, z1: 3.6, side: T.glow, top: T.hot, flat: true, shape: (c) => { S.ell(c, -14.4, 1.9, 1.4, 1.1); S.ell(c, -14.4, -1.9, 1.4, 1.1); } },
      // forward-swept crystal blades
      { z0: 1.2, z1: 2.6, side: T.shard, top: C.mix(T.shardT, T.body, 0.35), shape: (c) => { S.poly(c, wing); S.poly(c, mirrorY(wing)); },
        detail: (c) => { for (const sg of [1, -1]) { glowLine(c, T.glow, T.hot, 0.35, [-0.6, 2.8 * sg, 6.8, 14.4 * sg]); S.lines(c, SEAM, 0.35, [-4, 4 * sg, 2.4, 12.2 * sg]); S.lines(c, 'rgba(255,255,255,0.3)', 0.3, [-9.6, 3.4 * sg, -6.2, 10.8 * sg]); } } },
      // wingtip fins (bone, canted)
      { z0: 1.8, z1: 5.2, side: T.boneS, top: T.boneT, shape: (c, zt) => { const d = zt * 0.8; S.poly(c, [7.4 - d, 15.2 + d, 2.4 - d, 16.6 + d, 1.6 - d, 15.6 + d]); S.poly(c, [7.4 - d, -15.2 - d, 2.4 - d, -16.6 - d, 1.6 - d, -15.6 - d]); } },
      // fuselage
      { z0: 1.6, z1: 4.4, side: T.body, top: T.bodyT, shape: (c) => S.poly(c, S.sym([16, 0, 10, 2.4, -6, 3.2, -13, 3.2, -15, 1.4, -15, 0])),
        detail: (c) => { S.lines(c, SEAM, 0.35, [4, -2.6, 4, 2.6, -8, -3, -8, 3]); } },
      // mandible prongs
      { z0: 1.8, z1: 3.6, side: T.deep, top: T.boneT, shape: (c) => { S.poly(c, [19.6, 2.6, 12, 4.4, 9.4, 2.8, 12, 2.2]); S.poly(c, [19.6, -2.6, 12, -4.4, 9.4, -2.8, 12, -2.2]); } },
      // bone dorsal plate + glowing eye slit
      { z0: 4.4, z1: 5.6, side: T.boneS, top: T.boneT, shape: (c) => S.poly(c, S.sym([14, 0, 9, 1.6, -9, 2.2, -12, 1.2, -12, 0])),
        detail: (c) => { S.fillPoly(c, C.str(T.hot), [12.6, 0, 10, 1.1, 9.2, 0, 10, -1.1]); glowLine(c, T.glow, T.hot, 0.3, [6, 0, -10, 0]); S.lines(c, LITE, 0.3, [13.6, 0.3, 9, 1.4]); } },
      // floating crest fin over the drives
      { z0: 7, z1: 9.4, side: T.shard, top: T.shardT, shape: (c, zt) => S.poly(c, [-6 - zt * 2, 0, -9 - zt * 2, 0.9 * (1 - zt * 0.5), -14 - zt, 0, -9 - zt * 2, -0.9 * (1 - zt * 0.5)]) },
    ];
    return { r: 21, h: 11, parts, scale: sc, bevel: 0.6 };
  };

  /* ==================================================================
   * CHOIR GUNSHIP — heavy floating reliquary. Long keel hull with a bone
   * deck, stub wings carrying two plasma nacelles, a tall crystal spire
   * rising through a floating halo ring (glyphs orbit over anims), and a
   * bank of violet drive ports at the stern.
   * ================================================================== */
  M.chGunship = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const keel = S.sym([27, 0, 20, 5.4, 6, 8.4, -14, 8.6, -22, 6, -25, 0]);
    const wingH = [8, 6, 2, 19, -8, 20.4, -12, 7.4];
    const parts = [
      // ventral glow keel
      { z0: 0, z1: 1.2, side: T.glow, top: T.hot, flat: true, shape: (c) => S.poly(c, squeeze(keel, 0, 0, 0.7)) },
      // stub wings
      { z0: 2.6, z1: 4.4, side: T.body, top: T.bodyT, shape: (c) => { S.poly(c, wingH); S.poly(c, mirrorY(wingH)); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.4, [4, 8 * sg, -2, 17 * sg]); glowLine(c, T.glow, T.hot, 0.3, [6.6, 7.4 * sg, 1.2, 17.6 * sg]); } } },
      // keel hull
      { z0: 1.2, z1: 7.4, side: T.body, top: T.bodyT, shape: (c) => S.poly(c, keel),
        detail: (c) => { S.lines(c, SEAM, 0.45, [14, -6.6, 14, 6.6, -8, -8.4, -8, 8.4]); } },
      // plasma nacelles (bone) with glowing muzzles
      { z0: 1.6, z1: 7.6, side: T.boneS, top: T.boneT, shape: (c) => { const n = [13.6, 18.2, 9, 21.6, -9, 21.8, -12.4, 19.6, -12.4, 16.8, -9, 14.6, 9, 14.8]; S.poly(c, n); S.poly(c, mirrorY(n)); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.4, [4, 15.2 * sg, 4, 21.2 * sg, -4, 15.2 * sg, -4, 21.2 * sg]); S.fillPoly(c, C.str(p.t), [-10, 16.6 * sg, -6, 16.6 * sg, -6, 19.8 * sg, -10, 19.8 * sg]); glowLine(c, T.glow, T.hot, 0.35, [10, 18.2 * sg, -2, 18.2 * sg]); } } },
      { z0: 2.6, z1: 6.6, side: T.glow, top: T.white, flat: true, shape: (c) => { S.ell(c, 13.4, 18.2, 1.2, 2.0); S.ell(c, 13.4, -18.2, 1.2, 2.0); } },
      // bone deck plates
      { z0: 7.4, z1: 9, side: T.boneS, top: T.boneT, shape: (c) => { S.poly(c, [26, 0, 19, 4.2, 9, 5.4, 9, -5.4, 19, -4.2]); S.poly(c, [-6, 5.6, -20, 4.8, -22.6, 0, -20, -4.8, -6, -5.6]); },
        detail: (c) => { glowLine(c, T.glow, T.hot, 0.35, [24, 0, 12, 0, 17, -2.4, 17, 2.4]); S.fillPoly(c, C.str(T.deep), [23.6, 1.4, 21, 2.8, 21, -2.8, 23.6, -1.4]); S.lines(c, SEAM, 0.35, [-12, -4.6, -12, 4.6, -17, -4, -17, 4]); } },
      // drive ports
      { z0: 2.6, z1: 6.8, side: T.glow, top: T.hot, flat: true, shape: (c) => { for (const y of [-4.4, 0, 4.4]) S.ell(c, -24.4 + Math.abs(y) * 0.5, y, 1.2, 1.6); } },
      // spire base + crystal spire
      { z0: 7.4, z1: 10.4, side: T.deep, top: T.body, shape: (c) => S.poly(c, ngon(-2, 0, 4.6, 6, 0)) },
      { z0: 10.4, z1: 21, side: T.shard, top: T.shardT, shape: (c, zt) => { const w = 3.2 * (1 - zt * 0.85); S.poly(c, [-2 + w * 1.3, 0, -2 - zt * 1.4, w, -2 - w * 1.2 - zt * 1.4, 0, -2 - zt * 1.4, -w]); },
        detail: (c) => S.dot(c, C.str(T.white), -3.2, 0, 0.5) },
      // floating halo ring
      { z0: 12.2, z1: 13.8, side: T.boneS, top: T.boneT, stroke: 2.6, bevel: false, shape: (c) => S.circ(c, -2, 0, 11.4) },
      { z0: 13.8, z1: 14.2, side: T.glow, top: T.hot, flat: true, stroke: 0.9, shape: (c) => S.circ(c, -2, 0, 11.4),
        detail: (c, an) => { for (let i = 0; i < 6; i++) { const a = an * TAU / 6 + i * TAU / 6; S.dot(c, C.str(T.white), -2 + Math.cos(a) * 11.4, Math.sin(a) * 11.4, 0.75); } } },
    ];
    return { r: 30, h: 22, parts, scale: sc, bevel: 0.8 };
  };

  /* ==================================================================
   * SERAPH — winged angelic fighter. Slim violet body with a bone mask,
   * three layers of swept feather blades per side (dark under-feathers,
   * bone mid and glowing-edged upper coverts) and a floating halo.
   * ================================================================== */
  M.chSeraph = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    // wing arm: swept bone leading edge (starboard; mirrored)
    const arm = [5, 1.8, 3.4, 9, -1, 17, -5.4, 23.2, -7.2, 22.4, -4.6, 15.4, -3.2, 8.4, -3, 2.2];
    // primaries hang back from the arm: [root x, root y, tip x, tip y, width]
    const prim = [[-5.6, 21.6, -15.4, 23.6, 1.5], [-4.6, 17.8, -15.6, 19.0, 1.7], [-3.8, 13.8, -15.0, 14.4, 1.7], [-3.4, 9.8, -13.6, 9.8, 1.6], [-3.2, 5.8, -11.6, 5.4, 1.5]];
    const coverts = [[-2.6, 19.4, -9.6, 20.6, 1.4], [-2.2, 15.2, -10, 15.8, 1.5], [-1.8, 11, -9.4, 11, 1.5], [-1.6, 6.8, -8.2, 6.6, 1.4]];
    const blade = (c, f, sg) => { const dx = f[2] - f[0], dy = f[3] - f[1], L = Math.hypot(dx, dy), nx = -dy / L * f[4], ny = dx / L * f[4];
      S.poly(c, [f[0] + nx, (f[1] + ny) * sg, f[0] + dx * 0.7 + nx * 0.8, (f[1] + dy * 0.7 + ny * 0.8) * sg, f[2], f[3] * sg, f[0] + dx * 0.6 - nx * 0.9, (f[1] + dy * 0.6 - ny * 0.9) * sg, f[0] - nx, (f[1] - ny) * sg]); };
    const parts = [
      { z0: 1.2, z1: 3.2, side: T.glow, top: T.hot, flat: true, shape: (c) => S.ell(c, -12.8, 0, 1.6, 1.4) },
      // primaries (dark violet) with glowing tips
      { z0: 0.6, z1: 1.8, side: T.deep, top: T.bodyT, shape: (c) => { for (const sg of [1, -1]) for (const f of prim) blade(c, f, sg); },
        detail: (c) => { for (const sg of [1, -1]) for (const f of prim) glowLine(c, T.glow, T.hot, 0.3, [lerp(f[0], f[2], 0.62), lerp(f[1], f[3], 0.62) * sg, lerp(f[0], f[2], 0.95), lerp(f[1], f[3], 0.95) * sg]); } },
      // coverts (bone)
      { z0: 1.8, z1: 2.8, side: T.boneS, top: T.boneT, shape: (c) => { for (const sg of [1, -1]) for (const f of coverts) blade(c, f, sg); },
        detail: (c) => { for (const sg of [1, -1]) for (const f of coverts) S.lines(c, SEAM, 0.3, [f[0] - 1, f[1] * sg, lerp(f[0], f[2], 0.8), lerp(f[1], f[3], 0.8) * sg]); } },
      // wing arms (bone) with a violet glow channel
      { z0: 2.2, z1: 3.8, side: T.boneS, top: T.boneT, shape: (c) => { S.poly(c, arm); S.poly(c, mirrorY(arm)); },
        detail: (c) => { for (const sg of [1, -1]) { glowLine(c, T.glow, T.hot, 0.3, [1.4, 3 * sg, -2, 12 * sg, -2, 12 * sg, -5.6, 21.4 * sg]); S.lines(c, LITE, 0.35, [4.6, 2.2 * sg, 3, 9 * sg, 3, 9 * sg, -1.2, 16.8 * sg]); } } },
      // tail streamers
      { z0: 1.6, z1: 2.8, side: T.boneS, top: T.boneT, shape: (c) => { S.poly(c, [-9, 1.2, -20, 3.4, -19, 1.4, -10, 0.4]); S.poly(c, [-9, -1.2, -20, -3.4, -19, -1.4, -10, -0.4]); } },
      // slim body
      { z0: 1.6, z1: 5, side: T.body, top: T.bodyT, shape: (c, zt) => S.poly(c, S.sym([14 - zt, 0, 8, 2.4 - zt * 0.4, -6, 2.8 - zt * 0.5, -12, 1.4, -13.4, 0])),
        detail: (c) => { glowLine(c, T.glow, T.hot, 0.3, [4, 0, -10, 0]); S.lines(c, SEAM, 0.3, [0, -2.3, 0, 2.3]); } },
      // bone mask head with glowing eye
      { z0: 4.4, z1: 6.4, side: T.boneS, top: T.boneT, shape: (c, zt) => S.poly(c, S.sym([15.4 - zt, 0, 11, 1.7 - zt * 0.3, 6.4, 1.5, 5.6, 0])),
        detail: (c) => { S.fillPoly(c, C.str(T.hot), [13.8, 0, 11.2, 0.9, 10.6, 0, 11.2, -0.9]); S.lines(c, LITE, 0.3, [14.2, 0.3, 10.6, 1.4]); } },
      // floating halo
      { z0: 9, z1: 9.8, side: T.glow, top: T.hot, flat: true, stroke: 1.1, shape: (c) => S.circ(c, 6.4, 0, 3.8),
        detail: (c) => { c.save(); c.strokeStyle = C.str(T.white); c.lineWidth = 0.4; c.beginPath(); S.circ(c, 6.4, 0, 3.8); c.stroke(); c.restore(); } },
    ];
    return { r: 25, h: 11, parts, scale: sc, bevel: 0.6 };
  };

  /* ==================================================================
   * CHOIR LANCER — elite W10 hover tank, a catamaran: two dark pontoons
   * with bone crests whose bows run forward into crystal fork prongs, a
   * floating focus gem between the prongs, swept crystal fins at the stern
   * and the beam turret socket amidships (gunZ 7.4). Built at full size.
   * ================================================================== */
  M.chLancer = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const pont = [14, 6.2, 12, 10.6, -12, 11.2, -16.6, 9.4, -17, 6.8, -12, 5.4];
    const prong = [12.4, 6.0, 25.6, 3.4, 24.0, 5.2, 13.8, 10.4];
    const parts = [
      { z0: 0, z1: 1.2, side: T.glow, top: T.hot, flat: true, shape: (c) => { S.poly(c, squeeze(pont, -1.5, 8.3, 0.8)); S.poly(c, mirrorY(squeeze(pont, -1.5, 8.3, 0.8))); } },
      // pontoons
      { z0: 1.2, z1: 5.6, side: T.body, top: T.bodyT, shape: (c) => { S.poly(c, pont); S.poly(c, mirrorY(pont)); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.4, [4, 5.8 * sg, 4, 11 * sg, -6, 5.6 * sg, -6, 11.2 * sg]); glowLine(c, T.glow, T.hot, 0.35, [12.6, 10.2 * sg, -11.6, 10.8 * sg]); } } },
      // fork prongs (crystal) running forward from the bows
      { z0: 2.2, z1: 5.2, side: T.shard, top: T.shardT, shape: (c, zt) => { prism(c, prong, zt, 0.7, 0, 0); prism(c, mirrorY(prong), zt, 0.7, 0, 0); },
        detail: (c) => { for (const sg of [1, -1]) glowLine(c, T.glow, T.hot, 0.35, [14, 6.4 * sg, 24.6, 3.8 * sg]); } },
      // centre deck bridging the pontoons
      { z0: 2.4, z1: 6.2, side: T.deep, top: T.body, shape: (c) => S.poly(c, S.sym([12, 0, 10, 6, -10, 6.4, -14, 3.6, -14, 0])),
        detail: (c) => { glowLine(c, T.glow, T.hot, 0.3, [11, 0, 6, 0]); S.lines(c, SEAM, 0.35, [-8, -5.6, -8, 5.6]); } },
      // bone crests along the pontoons
      { z0: 5.6, z1: 7.2, side: T.boneS, top: T.boneT, shape: (c) => { const cr = [13, 8.2, 8, 9.8, -13.6, 9.8, -15.6, 8.4, -13, 7.0, 8, 7.0]; S.poly(c, cr); S.poly(c, mirrorY(cr)); },
        detail: (c) => { for (const sg of [1, -1]) { S.lines(c, SEAM, 0.3, [2, 7.1 * sg, 2, 9.7 * sg, -7, 7.1 * sg, -7, 9.7 * sg]); S.lines(c, LITE, 0.3, [12.6, 8.1 * sg, 8, 7.2 * sg]); } } },
      // focus gem floating between the prongs
      { z0: 4, z1: 9.4, side: T.glow, top: T.white, flat: true, shape: (c, zt) => { const w = Math.sin(Math.max(0.1, Math.min(0.9, zt)) * Math.PI) * 1.8; S.poly(c, [20.4 + w, 0, 20.4, w * 0.8, 20.4 - w, 0, 20.4, -w * 0.8]); } },
      // swept stern fins (crystal, floating just above the pontoons)
      { z0: 7.8, z1: 14, side: T.shard, top: T.shardT, shape: (c, zt) => { const k = 1 - zt * 0.75; const fin = (sg) => S.poly(c, [-8 - zt * 4.5, (9.0 + zt * 1.4) * sg, -11 - zt * 4.5, (9.0 + zt * 1.4 + 1.1 * k) * sg, -15.5 - zt * 3, (9.0 + zt * 1.4) * sg, -11 - zt * 4.5, (9.0 + zt * 1.4 - 1.1 * k) * sg]); fin(1); fin(-1); } },
      // beam turret socket
      { z0: 6.2, z1: 7.4, side: T.deep, top: T.body, shape: (c) => S.poly(c, ngon(0, 0, 5, 8, Math.PI / 8)),
        detail: (c) => { c.save(); c.strokeStyle = C.str(T.glow); c.lineWidth = 0.55; c.beginPath(); S.circ(c, 0, 0, 3.9); c.stroke(); c.restore(); } },
    ];
    return { r: 28, h: 15, parts, scale: sc, bevel: 0.7, gunZ: 7.4 * sc };
  };

  /* ==================================================================
   * CHOIR TITAN — giant biped war-frame (~46 units tall). Reverse-jointed
   * legs on three-toed feet, a broad dark chest under bone carapace with a
   * blazing core, heavy forearm plasma cannons, a missile pod on the left
   * shoulder, a small bone head and a vertical halo floating behind it.
   * anims 4 = walk cycle. Built at full size (use opt {}).
   * ================================================================== */
  M.chTitan = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), sc = o.size || 1;
    const HIP = 21;
    const legOf = (an, i) => {
      const ph = (an + i * 0.5) * TAU;
      const fx = Math.sin(ph) * 5.2, lift = Math.max(0, Math.cos(ph)) * 2.8;
      const y = i ? -6.2 : 6.2;
      return [[fx, y * 1.08, lift], [fx * 0.6 - 3.4, y * 1.05, lift + 6], [fx * 0.3 + 3, y, 13.4], [-0.6, y * 0.9, HIP]];
    };
    const parts = [];
    // three-toed feet
    parts.push({ z0: 0, z1: 5.2, side: T.deep, top: T.bodyT, shape: (c, zt, an) => {
      const z = zt * 5.2;
      for (let i = 0; i < 2; i++) { const f = legOf(an, i)[0]; if (z < f[2] - 0.01 || z > f[2] + 2) continue; const x = f[0], y = f[1];
        S.poly(c, [x + 5.4, y, x + 3, y + 1.2, x + 4.2, y + 3.4, x + 1, y + 2.6, x - 3, y + 1.8, x - 3.6, y, x - 3, y - 1.8, x + 1, y - 2.6, x + 4.2, y - 3.4, x + 3, y - 1.2]); }
    } });
    // legs
    parts.push({ z0: 0, z1: HIP, side: T.body, top: T.bodyT, bevel: false, ao: 0.25, shape: (c, zt, an) => {
      const z = zt * HIP;
      for (let i = 0; i < 2; i++) { const L = legOf(an, i); if (z < L[0][2] + 1) continue; const q = chainAt(L, z); S.ell(c, q[0], q[1], q[3] > 2 ? 2.8 : q[3] > 1 ? 2.0 : 1.7, q[3] > 2 ? 2.4 : 1.7); }
    } });
    // knee armour (bone) + glowing knee joints
    parts.push({ z0: 11.4, z1: 15.6, side: T.boneS, top: T.boneT, shape: (c, zt, an) => { for (let i = 0; i < 2; i++) { const q = legOf(an, i)[2]; S.poly(c, [q[0] + 3.4, q[1], q[0] + 0.6, q[1] + 2.6, q[0] - 1.6, q[1] + 1.6, q[0] - 1.6, q[1] - 1.6, q[0] + 0.6, q[1] - 2.6]); } },
      detail: (c, an) => { for (let i = 0; i < 2; i++) { const q = legOf(an, i)[2]; S.dot(c, C.str(T.glow), q[0] + 0.6, q[1], 0.9); S.dot(c, C.str(T.white), q[0] + 0.6, q[1], 0.4); } } });
    // pelvis
    parts.push({ z0: 19.4, z1: 23, side: T.deep, top: T.body, shape: (c) => S.poly(c, S.sym([4, 0, 3, 5, -1, 7.4, -4.6, 5.4, -5, 0])) });
    // torso: broad, wedge-shaped chest
    parts.push({ z0: 22.4, z1: 32, side: T.body, top: T.bodyT, shape: (c, zt) => { const k = 0.8 + zt * 0.25; S.poly(c, S.sym([6 * k, 0, 5 * k, 4.2 * k, 1, 8.6 * k, -4.4, 8 * k, -6.4 * k, 4, -6.6 * k, 0])); },
      detail: (c) => { glowLine(c, T.glow, T.hot, 0.4, [-6, 0, -2, 0, -2, 0, -4, 4, -2, 0, -4, -4]); } });
    // core blazing in the chest front
    parts.push({ z0: 25, z1: 29.4, side: T.glow, top: T.white, flat: true, shape: (c) => S.poly(c, [7.6, 0, 6.2, 2.2, 4.6, 0, 6.2, -2.2]),
      detail: (c) => S.dot(c, '#ffffff', 6.4, -0.4, 0.7) });
    // bone carapace plates over the chest
    parts.push({ z0: 32, z1: 33.6, side: T.boneS, top: T.boneT, shape: (c) => { S.poly(c, [6.2, 1, 4.4, 6.6, -1.8, 8.2, -2.4, 1.2]); S.poly(c, [6.2, -1, 4.4, -6.6, -1.8, -8.2, -2.4, -1.2]); },
      detail: (c) => { S.lines(c, SEAM, 0.4, [3, 1.5, 2, 6.6, 3, -1.5, 2, -6.6]); S.lines(c, LITE, 0.35, [6, 1.4, 4.4, 6.2]); } });
    // arms: hanging from the shoulders down to the forearm cannons, slight swing
    parts.push({ z0: 21, z1: 31, side: T.body, top: T.bodyT, bevel: false, ao: 0.2, shape: (c, zt, an) => {
      const z = 21 + zt * 10, sw = Math.sin(an * TAU) * 1.4;
      for (const sg of [1, -1]) { const L = [[1.2 + sw * sg, 10.4 * sg, 21], [-0.6 + sw * 0.5 * sg, 10.6 * sg, 26], [-1.6, 9.8 * sg, 31]]; const q = chainAt(L, z); S.circ(c, q[0], q[1], 1.6); }
    } });
    // forearm plasma cannons
    parts.push({ z0: 19, z1: 23.4, side: T.deep, top: C.mix(T.bodyT, T.boneT, 0.4), shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 1.4; for (const sg of [1, -1]) S.poly(c, [14 + sw * sg, (10.4 - 1.2) * sg, 14 + sw * sg, (10.4 + 1.2) * sg, -2 + sw * sg, (10.4 + 2.4) * sg, -3 + sw * sg, 10.4 * sg, -2 + sw * sg, (10.4 - 2.4) * sg]); },
      detail: (c, an) => { const sw = Math.sin(an * TAU) * 1.4; for (const sg of [1, -1]) { S.lines(c, SEAM, 0.35, [4 + sw * sg, 8.4 * sg, 4 + sw * sg, 12.4 * sg, 9 + sw * sg, 9 * sg, 9 + sw * sg, 11.8 * sg]); glowLine(c, T.glow, T.hot, 0.35, [-1 + sw * sg, 10.4 * sg, 8 + sw * sg, 10.4 * sg]); } } });
    parts.push({ z0: 19.6, z1: 22.8, side: T.glow, top: T.white, flat: true, shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 1.4; S.ell(c, 14.6 + sw, 10.4, 0.9, 1.3); S.ell(c, 14.6 - sw, -10.4, 0.9, 1.3); } });
    // bone pauldrons
    parts.push({ z0: 30, z1: 34.4, side: T.boneS, top: T.boneT, shape: (c, zt) => { const k = 1 - zt * 0.2; S.ell(c, -1.2, 10, 4.2 * k, 3.4 * k, 0.2); S.ell(c, -1.2, -10, 4.2 * k, 3.4 * k, -0.2); },
      detail: (c) => { S.lines(c, SEAM, 0.4, [-3.6, 8, 1.8, 11.4, -3.6, -8, 1.8, -11.4]); S.fillPoly(c, C.str(p.t), [-4, 11.2, -1.2, 13, -0.6, 12.2, -3.4, 10.4]); } });
    // missile pod on the port shoulder
    parts.push({ z0: 34.4, z1: 38.4, side: T.body, top: T.bodyT, shape: (c) => S.rrect(c, -5, -13.2, 7.6, 6, 1.2),
      detail: (c) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { S.dot(c, C.str(T.deep), 1 - i * 2.2, -11.6 + j * 2.8, 0.8); S.dot(c, C.str(T.hot), 1.2 - i * 2.2, -11.6 + j * 2.8, 0.42); } } });
    // head: small bone mask with eye slit
    parts.push({ z0: 32, z1: 36.6, side: T.boneS, top: T.boneT, shape: (c, zt) => { const k = 1 - zt * 0.25; S.poly(c, S.sym([5.6 * k + 1, 0, 3.6 * k + 1, 2.0 * k, -1.6 * k, 1.8 * k, -2.4 * k, 0])); },
      detail: (c) => S.lines(c, SEAM, 0.3, [4.4, 0, -1.4, 0]) });
    parts.push({ z0: 34, z1: 35.4, side: T.glow, top: T.white, flat: true, shape: (c) => S.poly(c, [6.6, 0, 5.6, 1.5, 5.2, 1.3, 5.7, 0, 5.2, -1.3, 5.6, -1.5]) });
    // vertical halo floating behind the head
    parts.push({ z0: 34.8, z1: 46.4, side: C.shade(T.glow, -0.15), top: T.hot, flat: true, shape: (c, zt) => {
      const R = 5.4, zc = 40.6, z = 34.8 + zt * 11.6, dz = z - zc;
      if (Math.abs(dz) > R + 0.1) return;
      const y = Math.sqrt(Math.max(0, R * R - dz * dz));
      if (y < 1.0) S.ell(c, -4.4, 0, 0.7, Math.max(0.7, y + 0.5)); else { S.circ(c, -4.4, y, 0.7); S.circ(c, -4.4, -y, 0.7); }
    } });
    return { r: 24, h: 47, parts, scale: sc, bevel: 0.8 };
  };

  /* ==================================================================
   * CHOIR GUN — rotating turret sheet in the Choir style, drop-in for
   * AS.Models.gun(pal, gunDef): faceted dark-violet head with bone cheek
   * plates and crystal muzzles. kinds: cannon, long, heavy, twin, missile,
   * beam; anything else falls back to the shared gun model.
   * ================================================================== */
  M.chGun = function (p, o) {
    p = P(p); o = o || {};
    const T = tone(p), kind = o.kind || 'cannon', sc = o.size || 1;
    const parts = [];
    const head = (rad, z1) => parts.push({ z0: 0, z1, side: T.body, top: T.bodyT, shape: (c, zt) => S.poly(c, [rad + 1.2, 0, rad * 0.55, rad * (1 - zt * 0.15), -rad * 0.9, rad * 0.8, -rad * 1.1, 0, -rad * 0.9, -rad * 0.8, rad * 0.55, -rad * (1 - zt * 0.15)]),
      detail: (c) => { S.fillPoly(c, C.str(T.boneT), [rad * 0.5, rad * 0.75, -rad * 0.8, rad * 0.62, -rad * 0.55, rad * 0.25, rad * 0.4, rad * 0.35]); S.fillPoly(c, C.str(T.boneT), [rad * 0.5, -rad * 0.75, -rad * 0.8, -rad * 0.62, -rad * 0.55, -rad * 0.25, rad * 0.4, -rad * 0.35]); S.dot(c, C.str(T.glow), -rad * 0.45, 0, rad * 0.22); S.dot(c, C.str(T.white), -rad * 0.45, 0, rad * 0.1); } });
    if (kind === 'cannon' || kind === 'long' || kind === 'heavy' || kind === 'twin') {
      const rad = kind === 'heavy' ? 6.4 : kind === 'twin' ? 5.6 : 4.8;
      const len = kind === 'long' ? 21 : kind === 'heavy' ? 17 : kind === 'twin' ? 15 : 16;
      const bw = kind === 'heavy' ? 1.5 : 0.95;
      const offs = kind === 'twin' ? [-2.1, 2.1] : [0];
      head(rad, 3.6);
      parts.push({ z0: 1.4, z1: 2.8, side: T.deep, top: C.mix(T.bodyT, T.boneT, 0.35), shape: (c) => { for (const y of offs) S.poly(c, [len, y - bw * 0.8, len, y + bw * 0.8, rad * 0.4, y + bw * 1.15, rad * 0.4, y - bw * 1.15]); },
        detail: (c) => { for (const y of offs) { S.lines(c, SEAM, 0.3, [len * 0.55, y - bw, len * 0.55, y + bw]); S.lines(c, LITE, 0.3, [rad, y - bw * 0.5, len - 1, y - bw * 0.4]); } } });
      // crystal muzzle collars
      parts.push({ z0: 1.2, z1: 3.0, side: C.shade(T.glow, -0.2), top: T.hot, flat: true, shape: (c) => { for (const y of offs) S.poly(c, [len + 1.6, y, len, y + bw * 1.4, len - 1.4, y, len, y - bw * 1.4]); } });
    } else if (kind === 'missile') {
      // needle-pod rack: two angled pods with glowing tips
      parts.push({ z0: 0, z1: 2.4, side: T.deep, top: T.body, shape: (c) => S.poly(c, ngon(0, 0, 4.4, 6, 0)) });
      parts.push({ z0: 2.4, z1: 6.2, side: T.boneS, top: T.boneT, shape: (c) => { S.rrect(c, -5.4, -6.4, 10.4, 5.2, 1.2); S.rrect(c, -5.4, 1.2, 10.4, 5.2, 1.2); },
        detail: (c) => { for (const sy of [-3.8, 3.8]) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = 3.2 - i * 3.2, y = sy - 1.2 + j * 2.4; S.dot(c, C.str(T.deep), x, y, 0.95); S.dot(c, C.str(T.hot), x + 0.2, y, 0.5); } S.lines(c, SEAM, 0.3, [-5, -3.8, 4.6, -3.8, -5, 3.8, 4.6, 3.8]); } });
      parts.push({ z0: 2.4, z1: 4.4, side: T.glow, top: T.hot, flat: true, shape: (c) => S.rect(c, -2.6, -1.0, 5.2, 2.0) });
    } else if (kind === 'beam') {
      head(4.6, 3.4);
      // twin crystal prongs with a floating focus gem between them
      parts.push({ z0: 1.2, z1: 3.2, side: T.shard, top: T.shardT, shape: (c) => { S.poly(c, [16, 1.5, 9, 3.4, 3, 2.6, 3, 1.4, 9, 1.6]); S.poly(c, [16, -1.5, 9, -3.4, 3, -2.6, 3, -1.4, 9, -1.6]); } });
      parts.push({ z0: 1.6, z1: 3.4, side: T.glow, top: T.white, flat: true, shape: (c, zt) => S.poly(c, [12.6, 0, 10.6, 1.0 - zt * 0.3, 8.6, 0, 10.6, -1.0 + zt * 0.3]) });
    } else {
      return baseGun(p, o);
    }
    return { r: 24 * sc, h: 8, parts, scale: sc, post: { rimStrength: 0.26 } };
  };
})(window.AS);
