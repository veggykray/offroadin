/* ALIEN STRIKE — stacked-model library, part 2: machines (ground vehicles, aircraft,
 * turret guns). Every generator takes a palette p = {a: side, b: top, t: trim,
 * g: glow, d: dark} plus optional style flags so one function yields many distinct
 * world-specific units. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  const P = (p) => Object.assign({ a: '#6b6f78', b: '#a6abb3', t: '#c9963e', g: '#b07cff', d: '#2a2b33' }, p || {});
  const glowLines = (col, w, segs) => (c) => S.lines(c, col, w, segs);

  /* ---------------- Hover tank ---------------- */
  M.hovertank = function (p, o) {
    p = P(p); o = o || {};
    const style = o.style || 'shard';
    const sc = o.size || 1;
    let half;
    if (style === 'shard') half = [15, 0, 9, 5, 2, 10, -9, 11, -13, 7, -14, 0];
    else if (style === 'slab') half = [13, 0, 13, 7, 8, 10, -12, 10, -14, 8, -14, 0];
    else half = [14, 0, 10, 7, 2, 10.5, -8, 10.5, -13, 6, -14, 0]; // scarab
    const parts = [
      { z0: 0, z1: 2, side: p.d, top: p.d, shape: (c) => S.poly(c, S.sym(half.map((v, i) => v * 0.92))) },
      { z0: 1, z1: 1, side: p.g, top: p.g, shape: (c) => S.poly(c, S.sym(half.map((v, i) => (i % 2 ? v * 0.96 : v * 0.86)))) },
      {
        z0: 2, z1: 7, side: p.a, top: p.b, shape: (c) => (style === 'scarab' ? S.ell(c, 0, 0, 14, 10.5) : S.poly(c, S.sym(half))),
        detail: (c) => {
          if (style === 'shard') { S.lines(c, p.g, 0.9, [12, 0, -10, 6, 12, 0, -10, -6]); S.fillPoly(c, p.t, [-13, 5, -9, 9, -9, 5]); S.fillPoly(c, p.t, [-13, -5, -9, -9, -9, -5]); }
          else if (style === 'slab') { S.lines(c, 'rgba(0,0,0,0.35)', 0.8, [8, -9, 8, 9, -6, -9, -6, 9]); S.fillPoly(c, p.t, [12, -6, 12, 6, 10, 6, 10, -6]); }
          else { S.lines(c, 'rgba(0,0,0,0.3)', 0.8, [0, -10, 0, 10]); S.dot(c, p.g, 10, 0, 1.4); }
        },
      },
    ];
    return { r: 18, h: 9, parts, scale: sc };
  };

  /* ---------------- Turret guns (rotating parts) ---------------- */
  M.gun = function (p, o) {
    p = P(p); o = o || {};
    const kind = o.kind || 'cannon';
    const sc = o.size || 1;
    const parts = [];
    if (kind === 'cannon' || kind === 'twin' || kind === 'long' || kind === 'heavy') {
      const rad = kind === 'heavy' ? 7 : 5.5;
      parts.push({ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.poly(c, [rad + 1, 0, rad * 0.5, rad, -rad, rad * 0.8, -rad, -rad * 0.8, rad * 0.5, -rad]),
        detail: (c) => S.dot(c, p.g, -2, 0, 1.2) });
      const len = kind === 'long' ? 20 : kind === 'heavy' ? 16 : 12;
      const offs = kind === 'twin' ? [-2, 2] : [0];
      parts.push({ z0: 2, z1: 3, side: p.d, top: p.a, shape: (c) => { for (const y of offs) S.rect(c, 2, y - (kind === 'heavy' ? 1.6 : 1), len, kind === 'heavy' ? 3.2 : 2); } });
    } else if (kind === 'missile') {
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c) => S.rect(c, -6, -6, 12, 12),
        detail: (c) => { for (let i = 0; i < 4; i++) S.dot(c, p.d, 4, -4.5 + i * 3, 1.1); S.lines(c, p.t, 0.8, [-5, -5, -5, 5]); } });
    } else if (kind === 'beam') {
      parts.push({ z0: 0, z1: 5, side: p.a, top: p.b, shape: (c) => S.poly(c, [6, 0, 0, 5, -5, 3, -5, -3, 0, -5]) });
      parts.push({ z0: 2, z1: 4, side: p.d, top: p.g, shape: (c) => S.poly(c, [14, 0, 5, 2.2, 5, -2.2]) });
    } else if (kind === 'flak') {
      parts.push({ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.circ(c, 0, 0, 6) });
      parts.push({ z0: 2, z1: 3, side: p.d, top: p.a, shape: (c) => { for (const y of [-3.5, -1.2, 1.2, 3.5]) S.rect(c, 3, y - 0.6, 10, 1.2); } });
    } else if (kind === 'mortar') {
      parts.push({ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.circ(c, 0, 0, 6) });
      parts.push({ z0: 3, z1: 9, side: p.d, top: p.a, shape: (c, zt) => S.circ(c, 3 + zt * 4, 0, 3.2) });
    } else if (kind === 'organic') {
      parts.push({ z0: 0, z1: 5, side: p.a, top: p.b, shape: (c, zt) => S.ell(c, 0, 0, 6 - zt * 1.5, 5 - zt), detail: (c) => S.dot(c, p.g, 2, 0, 1.6) });
      parts.push({ z0: 3, z1: 5, side: p.d, top: p.a, shape: (c) => S.poly(c, [12, 0, 4, 2.5, 4, -2.5]) });
    } else if (kind === 'crystal') {
      parts.push({ z0: 0, z1: 7, side: p.a, top: p.b, shape: (c, zt) => S.star(c, 0, 0, 7 - zt * 3, 3.5 - zt, 5, 0) });
      parts.push({ z0: 4, z1: 6, side: p.g, top: p.g, shape: (c) => S.poly(c, [15, 0, 5, 2, 5, -2]) });
    }
    return { r: 22 * sc, h: 12, parts, scale: sc, post: { rimStrength: 0.26 } };
  };

  /* ---------------- Walker (2 or 4 legs) ---------------- */
  M.walker = function (p, o) {
    p = P(p); o = o || {};
    const legs = o.legs || 2, sc = o.size || 1, lift = o.lift || 14;
    const parts = [];
    const hips = legs === 2 ? [[0, 7], [0, -7]] : [[6, 8], [6, -8], [-6, 8], [-6, -8]];
    // Legs (stacked thin columns); feet stride with animation phase
    parts.push({
      z0: 0, z1: lift, side: p.d, top: p.a, stroke: 2.4, shape: (c, zt, an) => {
        hips.forEach((h, i) => {
          const ph = Math.sin((an + (i % 2) * 0.5 + (i > 1 ? 0.25 : 0)) * TAU) * 5;
          const fx = h[0] + ph * (1 - zt), fy = h[1] * (1.25 - zt * 0.25);
          S.circ(c, fx, fy, 0.6);
        });
      },
    });
    parts.push({ z0: 0, z1: 1, side: p.d, top: p.a, shape: (c, zt, an) => hips.forEach((h, i) => { const ph = Math.sin((an + (i % 2) * 0.5 + (i > 1 ? 0.25 : 0)) * TAU) * 5; S.ell(c, h[0] + ph, h[1] * 1.25, 3, 2); }) });
    // Body
    parts.push({
      z0: lift, z1: lift + 7, side: p.a, top: p.b, shape: (c, zt) => (o.round ? S.ell(c, 0, 0, 11 - zt * 2, 9 - zt * 2) : S.poly(c, [12, 0, 7, 9, -9, 9, -12, 0, -9, -9, 7, -9])),
      detail: (c) => { S.dot(c, p.g, 8, 0, 1.6); S.lines(c, p.t, 1, [-8, -6, -8, 6]); if (o.channels) S.lines(c, p.g, 0.8, [6, 5, -6, 5, 6, -5, -6, -5]); },
    });
    return { r: 18, h: lift + 10, parts, scale: sc };
  };

  /* ---------------- Tracked artillery / SAM / support trucks ---------------- */
  M.tracked = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1, L = o.len || 14, W = o.wid || 9;
    const parts = [
      { z0: 0, z1: 4, side: p.d, top: '#3a3a3a', shape: (c) => { S.rect(c, -L, -W - 1, L * 2, 4); S.rect(c, -L, W - 3, L * 2, 4); },
        detail: (c) => { const segs = []; for (let x = -L + 2; x < L; x += 3) segs.push(x, -W - 1, x, -W + 3, x, W - 3, x, W + 1); S.lines(c, 'rgba(0,0,0,0.5)', 0.6, segs); } },
      { z0: 2, z1: 7, side: p.a, top: p.b, shape: (c) => S.poly(c, [L + 2, -W + 3, L + 2, W - 3, L - 2, W - 2, -L, W - 2, -L, -W + 2, L - 2, -W + 2]),
        detail: (c) => { S.fillPoly(c, p.t, [-L + 1, -3, -L + 4, -3, -L + 4, 3, -L + 1, 3]); S.dot(c, p.g, L - 2, 0, 1.1); } },
    ];
    if (o.cab) parts.push({ z0: 7, z1: 11, side: p.a, top: p.b, shape: (c) => S.rrect(c, L - 8, -W + 3, 8, W * 2 - 6, 2), detail: (c) => S.lines(c, '#9fe8ff', 1, [L - 1, -3, L - 1, 3]) });
    if (o.cargo) parts.push({ z0: 7, z1: 13, side: o.cargoSide || '#8a6a3a', top: o.cargoTop || '#b89458', shape: (c) => S.rect(c, -L + 1, -W + 3, L * 2 - 11, W * 2 - 6),
      detail: (c) => S.lines(c, 'rgba(0,0,0,0.35)', 0.8, [-L + 6, -W + 3, -L + 6, W - 3, -L + 12, -W + 3, -L + 12, W - 3, -L + 18, -W + 3, -L + 18, W - 3]) });
    return { r: Math.max(L, W) + 6, h: 16, parts, scale: sc };
  };

  /* ---------------- Wheeled hauler (convoy) ---------------- */
  M.hauler = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 4, side: '#1d1d1f', top: '#333', shape: (c) => { for (const x of [-14, -7, 0, 10]) { S.rrect(c, x - 2.5, -9, 5, 3, 1); S.rrect(c, x - 2.5, 6, 5, 3, 1); } } },
      { z0: 3, z1: 6, side: p.d, top: p.a, shape: (c) => S.rect(c, -18, -7, 34, 14) },
      { z0: 6, z1: 13, side: p.a, top: p.b, shape: (c) => S.rrect(c, 6, -7, 12, 14, 2.5), detail: (c) => { S.fillPoly(c, '#9fe8ff', [16, -5, 17.5, -5, 17.5, 5, 16, 5]); S.dot(c, '#ffd35a', 17.5, -6, 0.8); S.dot(c, '#ffd35a', 17.5, 6, 0.8); } },
      { z0: 6, z1: 15, side: o.cargoSide || '#7a6a4e', top: o.cargoTop || '#a8916a', shape: (c) => S.rect(c, -18, -7.5, 22, 15),
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.3)', 0.8, [-13, -7.5, -13, 7.5, -7, -7.5, -7, 7.5, -1, -7.5, -1, 7.5]); S.fillPoly(c, p.t, [-17, -2, 3, -2, 3, 2, -17, 2]); } },
    ];
    return { r: 22, h: 17, parts };
  };

  /* ---------------- Hover bike / raider ---------------- */
  M.bike = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 2, side: p.d, top: p.g, shape: (c) => S.ell(c, -1, 0, 9, 3) },
      { z0: 2, z1: 5, side: p.a, top: p.b, shape: (c) => S.poly(c, [12, 0, 4, 4, -8, 5, -10, 0, -8, -5, 4, -4]), detail: (c) => S.lines(c, p.t, 1, [8, 0, -6, 0]) },
      { z0: 5, z1: 8, side: '#3b3530', top: o.rider || '#c1a27a', shape: (c) => S.ell(c, -2, 0, 3, 2.4) },
    ];
    return { r: 14, h: 10, parts };
  };

  /* ---------------- Skimmer boat (Drowned World) ---------------- */
  M.boat = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 4, side: p.d, top: p.a, shape: (c) => S.poly(c, [16, 0, 8, 7, -12, 7, -14, 0, -12, -7, 8, -7]) },
      { z0: 4, z1: 6, side: p.a, top: p.b, shape: (c) => S.poly(c, [14, 0, 7, 6, -11, 6, -12, 0, -11, -6, 7, -6]), detail: (c) => { S.lines(c, p.t, 1, [-10, 4, 6, 4, -10, -4, 6, -4]); } },
      { z0: 6, z1: 10, side: p.a, top: p.b, shape: (c) => S.rrect(c, -6, -4, 9, 8, 2), detail: (c) => S.lines(c, '#9fe8ff', 1, [2.5, -3, 2.5, 3]) },
    ];
    return { r: 18, h: 12, parts, scale: sc };
  };

  /* ---------------- Mining crawler (huge) ---------------- */
  M.crawler = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 7, side: '#232120', top: '#3b3835', shape: (c) => { S.rect(c, -34, -26, 62, 10); S.rect(c, -34, 16, 62, 10); },
        detail: (c) => { const s = []; for (let x = -32; x < 28; x += 4) s.push(x, -26, x, -16, x, 16, x, 26); S.lines(c, 'rgba(0,0,0,0.5)', 0.8, s); } },
      { z0: 5, z1: 18, side: p.a, top: p.b, shape: (c) => S.poly(c, [26, -16, 30, 0, 26, 16, -30, 17, -32, 0, -30, -17]),
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.3)', 1, [-20, -15, -20, 15, 0, -15, 0, 15]); S.fillPoly(c, p.t, [-30, -4, 24, -4, 24, 4, -30, 4]); } },
      { z0: 18, z1: 30, side: p.a, top: p.b, shape: (c) => S.rect(c, -24, -12, 18, 24), detail: (c) => { S.dot(c, '#ffcf6a', -8, -8, 1.3); S.dot(c, '#ffcf6a', -8, 8, 1.3); } },
      { z0: 18, z1: 40, side: p.d, top: '#2a2522', shape: (c, zt) => { S.circ(c, -28, -8, 2.8); S.circ(c, -28, 8, 2.8); } },
      { z0: 6, z1: 16, side: '#6f6a64', top: '#bdb4a6', shape: (c, zt, an) => S.star(c, 38, 0, 11, 6, 8, an * TAU), detail: (c) => S.dot(c, '#222', 38, 0, 2.5) },
    ];
    return { r: 52, h: 42, parts };
  };

  /* ---------------- Air: drone ---------------- */
  M.drone = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const fins = o.fins || 3;
    const parts = [
      { z0: 0, z1: 2, side: p.d, top: p.a, shape: (c) => { for (let i = 0; i < fins; i++) { const a = (i / fins) * TAU + Math.PI / fins; S.poly(c, [Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a + 0.25) * 11, Math.sin(a + 0.25) * 11, Math.cos(a + 0.5) * 9, Math.sin(a + 0.5) * 9]); } } },
      { z0: 0, z1: 5, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 6.5 - zt * 1.5), detail: (c) => { S.circ(c, 0, 0, 0); S.dot(c, p.d, 2, 0, 2.6); S.dot(c, p.g, 2.6, 0, 1.6); } },
    ];
    return { r: 14, h: 7, parts, scale: sc };
  };

  /* ---------------- Air: interceptor ---------------- */
  M.interceptor = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 2, side: p.d, top: p.a, shape: (c) => S.poly(c, S.sym([18, 0, 4, 3, -4, 14, -10, 14, -8, 4, -12, 3, -12, 0])),
        detail: (c) => { S.lines(c, p.t, 1, [-6, 12, 0, 4, -6, -12, 0, -4]); } },
      { z0: 1, z1: 5, side: p.a, top: p.b, shape: (c) => S.poly(c, S.sym([20, 0, 8, 3, -11, 3.5, -13, 0])), detail: (c) => { S.fillPoly(c, '#2b3b4a', [12, -1.5, 6, -2, 6, 2, 12, 1.5]); S.dot(c, p.g, -12, 0, 1.5); } },
    ];
    return { r: 22, h: 6, parts, scale: sc };
  };

  /* ---------------- Air: heavy gunship ---------------- */
  M.gunship = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 3, side: p.d, top: p.a, shape: (c) => S.poly(c, S.sym([12, 0, 4, 18, -6, 22, -12, 18, -8, 6, -16, 4, -18, 0])) },
      { z0: 2, z1: 8, side: p.a, top: p.b, shape: (c) => S.poly(c, S.sym([22, 0, 12, 5, -14, 6, -18, 0])), detail: (c) => { S.fillPoly(c, '#28323d', [18, -2, 12, -3, 12, 3, 18, 2]); S.lines(c, p.g, 0.9, [10, 0, -14, 0]); } },
      { z0: 2, z1: 6, side: p.a, top: p.b, shape: (c) => { S.ell(c, -2, 16, 6, 3.5); S.ell(c, -2, -16, 6, 3.5); }, detail: (c) => { S.dot(c, p.g, -7, 16, 1.4); S.dot(c, p.g, -7, -16, 1.4); } },
    ];
    return { r: 26, h: 10, parts, scale: sc };
  };

  /* ---------------- Ancient sentinel (Dead Machine) ---------------- */
  M.sentinel = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 3, side: p.d, top: p.a, stroke: 3, shape: (c, zt, an) => S.circ(c, 0, 0, 10) },
      { z0: 1, z1: 2, side: p.a, top: p.b, shape: (c, zt, an) => { for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + an * TAU * 0.25; S.poly(c, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a + 0.3) * 14, Math.sin(a + 0.3) * 14, Math.cos(a - 0.3) * 14, Math.sin(a - 0.3) * 14]); } } },
      { z0: 2, z1: 9, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 6 - Math.abs(zt - 0.5) * 3), detail: (c) => { S.dot(c, p.d, 2, 0, 3); S.dot(c, p.g, 2.5, 0, 2); } },
    ];
    return { r: 18, h: 10, parts, scale: sc };
  };

  /* ---------------- Repair / support drone ---------------- */
  M.repairer = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 2, side: p.d, top: p.a, stroke: 1.6, shape: (c) => { S.seg(c, 0, 0, 8, 8); S.seg(c, 0, 0, 8, -8); } },
      { z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.rrect(c, -6, -5, 12, 10, 3), detail: (c) => { S.fillPoly(c, '#7dff9a', [-1, -4, 1, -4, 1, -1, 4, -1, 4, 1, 1, 1, 1, 4, -1, 4, -1, 1, -4, 1, -4, -1, -1, -1]); } },
    ];
    return { r: 13, h: 8, parts };
  };

  /* ---------------- Slag golem (Obsidian Forge hybrid) ---------------- */
  M.golem = function (p, o) {
    p = P(p); o = o || {};
    const sc = o.size || 1;
    const parts = [
      { z0: 0, z1: 9, side: p.d, top: p.a, shape: (c, zt, an) => { const s = Math.sin(an * TAU) * 3; S.ell(c, s, 6, 3.5, 3); S.ell(c, -s, -6, 3.5, 3); } },
      { z0: 8, z1: 20, side: p.a, top: p.b, shape: (c, zt) => S.blob(c, 0, 0, 11 - Math.abs(zt - 0.6) * 4, 4, 8, 0.25),
        detail: (c) => { S.lines(c, p.g, 1.1, [-6, -4, 2, 0, 2, 0, -3, 6, 4, -6, 8, 2]); S.dot(c, p.g, 7, 0, 1.5); } },
      { z0: 12, z1: 17, side: p.d, top: p.a, shape: (c, zt, an) => { const s = Math.cos(an * TAU) * 2; S.ell(c, 4 + s, 13, 4, 3); S.ell(c, 4 - s, -13, 4, 3); } },
    ];
    return { r: 20, h: 22, parts, scale: sc };
  };
})(window.AS);
