/* ALIEN STRIKE — stacked-model library, part 3: creatures and organisms.
 * Animation phase `an` (0..1) drives legs, wings and mouths. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;
  const P = (p) => Object.assign({ a: '#7a5236', b: '#a8774c', t: '#e4c48a', g: '#ffda6b', d: '#3a2618' }, p || {});

  /* Quadruped pack hunter / beast */
  M.quad = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, L = o.len || 9, W = o.wid || 4.5, lift = o.lift || 3;
    const legs = [[L * 0.55, W], [L * 0.55, -W], [-L * 0.5, W], [-L * 0.5, -W]];
    const parts = [
      { z0: 0, z1: lift + 1, side: p.d, top: p.a, stroke: 1.6, shape: (c, zt, an) => legs.forEach((h, i) => {
        const ph = Math.sin((an + (i === 0 || i === 3 ? 0 : 0.5)) * TAU) * (L * 0.35);
        S.circ(c, h[0] + ph * (1 - zt), h[1] * (1.3 - zt * 0.3), 0.5);
      }) },
      { z0: lift, z1: lift + W * 1.1, side: p.a, top: p.b, shape: (c, zt) => S.ell(c, -1, 0, L * (1 - zt * 0.25), W * (1 - zt * 0.35)),
        detail: (c) => {
          if (o.spikes) { const s = []; for (let i = -L * 0.6; i < L * 0.6; i += 2.5) s.push(i, 0, i - 2, 0); S.lines(c, p.t, 1.2, s); }
          if (o.stripes) S.lines(c, p.d, 0.8, [-3, -W * 0.6, -2, W * 0.6, 1, -W * 0.6, 2, W * 0.6]);
        } },
      { z0: lift + 1, z1: lift + W, side: p.a, top: p.b, shape: (c, zt, an) => { const bob = Math.sin(an * TAU * 2) * 0.4; S.ell(c, L + 1.5, bob, W * 0.75 * (1 - zt * 0.3), W * 0.6); },
        detail: (c) => { S.dot(c, p.g, L + 3, -1.2, 0.7); S.dot(c, p.g, L + 3, 1.2, 0.7); if (o.jaws) S.lines(c, p.t, 0.8, [L + 3, -1.8, L + 6, -1.2, L + 3, 1.8, L + 6, 1.2]); } },
      { z0: lift + 1, z1: lift + 2, side: p.a, top: p.b, stroke: 1.4, shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 2.5; c.moveTo(-L + 1, 0); c.quadraticCurveTo(-L - 3, sw, -L - 6, sw * 1.6); } },
    ];
    return { r: L + 9, h: lift + W + 3, parts, scale: sc };
  };

  /* Insectoid: segmented body, six legs, optional wings */
  M.insect = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, L = o.len || 8, lift = o.wings ? 1 : 2;
    const parts = [
      { z0: 0, z1: lift, side: p.d, top: p.a, stroke: 1.1, shape: (c, zt, an) => {
        for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
          const bx = L * 0.35 - i * L * 0.35;
          const sw = Math.sin((an + (i % 2) * 0.5 + (s > 0 ? 0 : 0.5)) * TAU) * 2.4;
          c.moveTo(bx, s * 2); c.lineTo(bx + sw + (1 - i) * 2, s * (L * 0.85));
        }
      } },
      { z0: lift, z1: lift + 4, side: p.a, top: p.b, shape: (c, zt) => { S.ell(c, -L * 0.55, 0, L * 0.6 * (1 - zt * 0.3), L * 0.42 * (1 - zt * 0.3)); S.ell(c, L * 0.25, 0, L * 0.38, L * 0.3); },
        detail: (c) => { S.lines(c, p.d, 0.7, [-L * 0.3, -L * 0.35, -L * 0.3, L * 0.35, -L * 0.7, -L * 0.3, -L * 0.7, L * 0.3]); if (o.glowSac) S.dot(c, p.g, -L * 0.75, 0, L * 0.18); } },
      { z0: lift + 1, z1: lift + 3, side: p.a, top: p.b, shape: (c) => S.ell(c, L * 0.75, 0, L * 0.25, L * 0.24),
        detail: (c) => { S.dot(c, p.g, L * 0.85, -L * 0.1, 0.7); S.dot(c, p.g, L * 0.85, L * 0.1, 0.7); S.lines(c, p.t, 0.8, [L * 0.95, -1.5, L * 1.25, -0.4, L * 0.95, 1.5, L * 1.25, 0.4]); } },
    ];
    if (o.wings) parts.push({ z0: lift + 4, z1: lift + 4, side: o.wingCol || '#c8e6d2', top: o.wingCol || '#c8e6d2', shape: (c, zt, an) => {
      const f = 0.45 + Math.abs(Math.sin(an * TAU)) * 0.55;
      S.ell(c, -L * 0.15, L * 0.55 * f + 1, L * 0.5, L * 0.38 * f, 0.3); S.ell(c, -L * 0.15, -L * 0.55 * f - 1, L * 0.5, L * 0.38 * f, -0.3);
    } });
    return { r: L * 1.5 + 4, h: lift + 7, parts, scale: sc };
  };

  /* Worm head (surfaced burrower) */
  M.worm = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, segs = o.segs || 3, R = o.rad || 6;
    const parts = [];
    for (let i = segs - 1; i >= 0; i--) {
      const x = -i * R * 1.2, r = R * (1 - i * 0.12);
      parts.push({ z0: 0, z1: r * 1.4, side: p.a, top: p.b, shape: (c, zt, an) => S.circ(c, x + Math.sin((an + i * 0.2) * TAU) * 0.6, Math.sin((an + i * 0.3) * TAU) * 1.2, r * Math.sqrt(1 - zt * zt * 0.7)),
        detail: (c) => { if (o.plates) S.lines(c, p.t, 0.9, [x - r * 0.6, -r * 0.5, x + r * 0.6, -r * 0.5, x - r * 0.6, r * 0.5, x + r * 0.6, r * 0.5]); } });
    }
    parts.push({ z0: R * 0.6, z1: R * 1.4, side: p.d, top: p.d, shape: (c, zt, an) => S.ell(c, R * 0.5, 0, R * 0.55, R * 0.7 * (0.6 + 0.4 * Math.sin(an * TAU))),
      detail: (c) => { const s = []; for (let a = 0; a < 6; a++) { const t = a / 6 * TAU; s.push(R * 0.5 + Math.cos(t) * R * 0.5, Math.sin(t) * R * 0.6, R * 0.5 + Math.cos(t) * R * 0.2, Math.sin(t) * R * 0.25); } S.lines(c, p.t, 0.9, s); S.dot(c, p.g, R * 0.5, 0, R * 0.18); } });
    return { r: segs * R * 1.3 + R + 4, h: R * 1.5 + 2, parts, scale: sc };
  };

  /* Flying ray / manta predator */
  M.ray = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, Wd = o.span || 16;
    const parts = [
      { z0: 0, z1: 3, side: p.a, top: p.b, shape: (c, zt, an) => {
        const f = Math.sin(an * TAU) * 0.5;
        S.poly(c, [12, 0, 4, Wd * 0.35, -2, Wd * (0.9 + f * 0.2), -6, Wd * 0.7, -8, 0, -6, -Wd * 0.7, -2, -Wd * (0.9 + f * 0.2), 4, -Wd * 0.35]);
      }, detail: (c, an) => { S.lines(c, p.g, 0.9, [6, 0, -2, Wd * 0.6, 6, 0, -2, -Wd * 0.6]); S.dot(c, p.g, 9, 0, 1); } },
      { z0: 0, z1: 1, side: p.d, top: p.a, stroke: 1.2, shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 3; c.moveTo(-8, 0); c.quadraticCurveTo(-14, sw, -20, -sw); } },
    ];
    return { r: Wd + 6, h: 5, parts, scale: sc };
  };

  /* Crystalline predator */
  M.crystal = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, L = o.len || 9;
    const parts = [
      { z0: 0, z1: 3, side: p.d, top: p.a, stroke: 1.5, shape: (c, zt, an) => { for (let i = 0; i < 4; i++) { const s = i < 2 ? 1 : -1, bx = (i % 2 ? -1 : 1) * L * 0.45; const sw = Math.sin((an + i * 0.25) * TAU) * 2.5; c.moveTo(bx, s * 2); c.lineTo(bx + sw, s * L * 0.9); } } },
      { z0: 3, z1: 9, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, [L, 0, L * 0.3, L * 0.55 * (1 - zt * 0.4), -L, L * 0.3, -L * 0.7, 0, -L, -L * 0.3, L * 0.3, -L * 0.55 * (1 - zt * 0.4)]),
        detail: (c) => S.lines(c, p.g, 0.8, [L, 0, -L * 0.7, 0, L * 0.3, 3, -L * 0.4, -2]) },
      { z0: 7, z1: 14, side: p.t, top: p.g, shape: (c, zt) => { S.poly(c, [-2 + zt * 2, -2, 2, 0, -2 + zt * 2, 2]); S.poly(c, [-L * 0.6, -3 + zt, -L * 0.4, -1, -L * 0.6, 0]); } },
    ];
    return { r: L + 6, h: 16, parts, scale: sc };
  };

  /* Fungal walker (biped with a cap) */
  M.fungal = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 6, side: p.d, top: p.a, stroke: 2, shape: (c, zt, an) => { const s = Math.sin(an * TAU) * 3 * (1 - zt); S.circ(c, s, 3, 0.5); S.circ(c, -s, -3, 0.5); } },
      { z0: 5, z1: 12, side: p.a, top: p.b, shape: (c, zt) => S.ell(c, 0, 0, 3.5, 3) },
      { z0: 11, z1: 15, side: p.t, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 8 - zt * 3), detail: (c) => { S.dot(c, p.g, -2, -2, 1.1); S.dot(c, p.g, 2.5, 1, 0.9); S.dot(c, p.g, -1, 3, 0.8); } },
    ];
    return { r: 12, h: 17, parts, scale: sc };
  };

  /* Ambush organism (jaws open with anim) */
  M.lurker = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, n = o.petals || 5;
    const parts = [
      { z0: 0, z1: 3, side: p.d, top: p.a, shape: (c, zt, an) => { const open = 0.3 + Math.sin(an * Math.PI) * 0.7; for (let i = 0; i < n; i++) { const a = i / n * TAU; S.poly(c, [Math.cos(a - 0.3) * 4, Math.sin(a - 0.3) * 4, Math.cos(a) * (7 + open * 6), Math.sin(a) * (7 + open * 6), Math.cos(a + 0.3) * 4, Math.sin(a + 0.3) * 4]); } } },
      { z0: 1, z1: 5, side: p.a, top: p.b, shape: (c) => S.circ(c, 0, 0, 5), detail: (c, an) => { S.dot(c, p.d, 0, 0, 2 + Math.sin(an * Math.PI) * 1.8); S.dot(c, p.g, 0, 0, 0.8); } },
    ];
    return { r: 16, h: 6, parts, scale: sc };
  };

  /* Amphibious lurcher */
  M.amphibian = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 3, side: p.d, top: p.a, shape: (c, zt, an) => { const s = Math.sin(an * TAU) * 2; S.ell(c, -5 + s, 7, 4, 2); S.ell(c, -5 - s, -7, 4, 2); S.ell(c, 5 - s, 6, 2.5, 1.5); S.ell(c, 5 + s, -6, 2.5, 1.5); } },
      { z0: 2, z1: 8, side: p.a, top: p.b, shape: (c, zt) => S.ell(c, 0, 0, 9 - zt * 2, 7 - zt * 2), detail: (c) => { S.lines(c, p.t, 1, [-6, -5, 3, -6, -6, 5, 3, 6]); S.dot(c, p.g, 6, -3, 1.1); S.dot(c, p.g, 6, 3, 1.1); } },
      { z0: 6, z1: 9, side: p.t, top: p.t, shape: (c, zt, an) => { for (let i = 0; i < 4; i++) S.poly(c, [-6 + i * 3, 0, -5 + i * 3, 5 + Math.sin(an * TAU + i) * 1, -4 + i * 3, 0]); } },
    ];
    return { r: 14, h: 10, parts, scale: sc };
  };

  /* Floating puffball / spore organism */
  M.puff = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, R = o.rad || 6;
    const parts = [
      { z0: 0, z1: R * 1.6, side: p.a, top: p.b, shape: (c, zt, an) => S.circ(c, 0, 0, R * Math.sin(Math.max(0.15, zt) * Math.PI) * (1 + Math.sin(an * TAU) * 0.08)),
        detail: (c) => { S.dot(c, p.g, -R * 0.3, -R * 0.3, R * 0.2); S.dot(c, p.g, R * 0.35, R * 0.1, R * 0.16); S.dot(c, p.t, 0, R * 0.4, R * 0.12); } },
    ];
    return { r: R + 6, h: R * 1.7, parts, scale: sc };
  };

})(window.AS);
