/* ALIEN STRIKE — stacked-model library, part 4: structures, scenery, obstacles,
 * pickups, cargo and terrain decor. Structures render in a single orientation; some
 * have animation frames (radar dishes, pistons, beacons). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;
  const P = (p) => Object.assign({ a: '#6b6f78', b: '#a6abb3', t: '#c9963e', g: '#b07cff', d: '#2a2b33' }, p || {});
  const hexPts = (r, n, rot) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push(Math.cos(t) * r, Math.sin(t) * r); } return a; };

  /* ---------- defensive structures ---------- */
  M.turretBase = function (p, o) {
    p = P(p); o = o || {};
    const st = o.style || 'needle';
    const parts = [];
    if (st === 'needle' || st === 'ancient') {
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, hexPts(11 - zt * 2, 6, Math.PI / 6)),
        detail: (c) => { S.lines(c, p.g, 0.9, [-6, 0, 6, 0, -3, -5, 3, 5, -3, 5, 3, -5]); } });
    } else if (st === 'bunker') {
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.rrect(c, -11 + zt, -11 + zt, 22 - zt * 2, 22 - zt * 2, 3),
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.3)', 0.8, [-8, -8, 8, -8, -8, 8, 8, 8]); S.fillPoly(c, p.t, [-10, 7, -7, 10, -10, 10]); } });
    } else if (st === 'organic') {
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.blob(c, 0, 0, 12 - zt * 3, 31, 10, 0.22), detail: (c) => { S.dot(c, p.g, -6, 4, 1.4); S.dot(c, p.g, 5, -6, 1.1); } });
    } else if (st === 'ice') {
      parts.push({ z0: 0, z1: 6, side: p.a, top: p.b, shape: (c, zt) => S.star(c, 0, 0, 12 - zt * 2, 8, 6, 0.2) });
    } else {
      parts.push({ z0: 0, z1: 5, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 11 - zt * 2), detail: (c) => S.lines(c, p.t, 1, [-9, 0, 9, 0]) });
    }
    return { r: 14, h: 8, parts };
  };

  M.radar = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.rect(c, -9, -9, 18, 18) },
      { z0: 4, z1: 28, side: p.d, top: p.a, stroke: 1.4, shape: (c, zt) => { const r = 6 - zt * 4; S.circ(c, r, r, 0.4); S.circ(c, -r, r, 0.4); S.circ(c, r, -r, 0.4); S.circ(c, -r, -r, 0.4); } },
      { z0: 28, z1: 30, side: p.a, top: p.b, shape: (c) => S.circ(c, 0, 0, 3) },
      { z0: 30, z1: 34, side: p.a, top: p.b, shape: (c, zt, an) => { const a = an * TAU; S.ell(c, Math.cos(a) * 2, Math.sin(a) * 2, 3 + zt * 2, 10, a); },
        detail: (c, an) => { const a = an * TAU; S.dot(c, p.g, Math.cos(a) * 6, Math.sin(a) * 6, 1.2); } },
    ];
    return { r: 16, h: 36, parts };
  };

  M.comms = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 46;
    const parts = [
      { z0: 0, z1: 5, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, hexPts(9 - zt * 2, 5, 0)) },
      { z0: 5, z1: H, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, hexPts(4 - zt * 2.5, 3, zt * 2)), detail: () => {} },
      { z0: Math.round(H * 0.45), z1: Math.round(H * 0.45) + 2, side: p.d, top: p.t, stroke: 1.2, shape: (c) => { S.seg(c, -9, 0, 9, 0); S.seg(c, 0, -9, 0, 9); } },
      { z0: Math.round(H * 0.75), z1: Math.round(H * 0.75) + 1, side: p.d, top: p.t, stroke: 1.2, shape: (c) => { S.seg(c, -6, -6, 6, 6); S.seg(c, -6, 6, 6, -6); } },
      { z0: H, z1: H + 2, side: p.g, top: '#ffffff', shape: (c, zt, an) => S.circ(c, 0, 0, an < 0.5 ? 2 : 1.2) },
    ];
    return { r: 14, h: H + 4, parts };
  };

  M.shieldgen = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 5, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, hexPts(13 - zt * 2, 6, 0)), detail: (c) => S.lines(c, p.g, 1, [-8, 0, 8, 0, -4, -7, 4, 7, -4, 7, 4, -7]) },
      { z0: 5, z1: 14, side: p.d, top: p.a, shape: (c, zt) => { for (const a of [0, 2.09, 4.19]) S.poly(c, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a + 0.3) * (8 - zt * 4), Math.sin(a + 0.3) * (8 - zt * 4), Math.cos(a - 0.3) * (8 - zt * 4), Math.sin(a - 0.3) * (8 - zt * 4)]); } },
      { z0: 16, z1: 26, side: p.g, top: '#f4eaff', shape: (c, zt) => S.poly(c, hexPts(4.5 * Math.sin(Math.max(0.15, zt) * Math.PI), 4, zt)) },
    ];
    return { r: 16, h: 28, parts };
  };

  M.power = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 6, side: p.a, top: p.b, shape: (c) => S.rect(c, -20, -16, 40, 32), detail: (c) => { S.lines(c, 'rgba(0,0,0,0.3)', 1, [-20, 0, 20, 0]); S.fillPoly(c, p.t, [-18, -14, -12, -14, -18, -8]); } },
      { z0: 6, z1: 22, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, -6, 0, 10 - zt * 2), detail: (c) => { S.dot(c, p.g, -6, 0, 5); S.dot(c, '#ffffff', -6, 0, 2); } },
      { z0: 6, z1: 18, side: p.d, top: p.a, shape: (c, zt) => { S.circ(c, 12, -8, 4); S.circ(c, 12, 8, 4); } },
      { z0: 10, z1: 16, side: p.g, top: p.g, stroke: 1, shape: (c) => { S.circ(c, -6, 0, 11); } },
    ];
    return { r: 26, h: 24, parts };
  };

  M.factory = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 16, side: p.a, top: p.b, shape: (c) => S.rect(c, -28, -20, 56, 40),
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.28)', 1, [-28, -6, 28, -6, -28, 6, 28, 6, -10, -20, -10, 20, 10, -20, 10, 20]); S.fillPoly(c, p.t, [-26, 16, 26, 16, 26, 19, -26, 19]); S.dot(c, p.g, 22, -14, 1.6); } },
      { z0: 16, z1: 34, side: p.d, top: '#3a3633', shape: (c) => { S.circ(c, -18, -10, 4); S.circ(c, -6, -10, 4); } },
      { z0: 16, z1: 22, side: p.a, top: p.b, shape: (c) => S.poly(c, [4, -2, 26, -2, 26, 18, 4, 18]), detail: (c) => S.lines(c, p.g, 0.8, [8, 8, 22, 8]) },
    ];
    return { r: 36, h: 36, parts };
  };

  M.barracks = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 10, side: p.a, top: p.b, shape: (c) => S.rrect(c, -24, -12, 48, 24, 4),
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.25)', 1, [-24, 0, 24, 0]); for (let x = -18; x <= 18; x += 9) S.dot(c, p.g, x, 9, 1); } },
      { z0: 10, z1: 14, side: p.d, top: p.a, shape: (c) => S.rrect(c, -20, -9, 40, 18, 6) },
    ];
    return { r: 28, h: 16, parts };
  };

  M.nest = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 22, seed = o.seed || 3;
    const parts = [
      { z0: 0, z1: R * 0.7, side: p.a, top: p.b, shape: (c, zt) => S.blob(c, 0, 0, R * Math.sqrt(1 - zt * 0.85), seed, 11, 0.3),
        detail: (c) => { S.dot(c, p.d, -R * 0.2, -R * 0.1, R * 0.16); S.dot(c, p.d, R * 0.2, R * 0.12, R * 0.12); S.dot(c, p.g, -R * 0.2, -R * 0.1, R * 0.06); } },
      { z0: 0, z1: 6, side: p.d, top: p.a, shape: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + seed; S.ell(c, Math.cos(a) * R, Math.sin(a) * R, 5, 3, a); } } },
    ];
    return { r: R + 8, h: R * 0.7 + 4, parts };
  };

  M.sporeTower = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 54;
    const parts = [
      { z0: 0, z1: 8, side: p.d, top: p.a, shape: (c, zt) => S.blob(c, 0, 0, 16 - zt * 6, 9, 9, 0.35) },
      { z0: 6, z1: H, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, Math.sin(zt * 4) * 2, Math.cos(zt * 3) * 1.5, 6 - zt * 3.5 + Math.sin(zt * 12) * 0.8) },
      { z0: Math.round(H * 0.4), z1: Math.round(H * 0.4) + 6, side: p.t, top: p.g, shape: (c, zt) => { S.circ(c, 6, 2, 3.2 * Math.sin(Math.max(0.2, zt) * Math.PI)); S.circ(c, -5, -3, 2.6 * Math.sin(Math.max(0.2, zt) * Math.PI)); } },
      { z0: H - 2, z1: H + 8, side: p.t, top: p.g, shape: (c, zt) => S.circ(c, 0, 0, 6 * Math.sin(Math.max(0.15, zt) * Math.PI)), detail: (c) => S.dot(c, '#fff', -1, -1, 1.2) },
    ];
    return { r: 20, h: H + 10, parts };
  };

  M.pods = function (p, o) {
    p = P(p); o = o || {};
    const n = o.n || 5, seed = o.seed || 1;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([(U.hash2(i, seed, 1) - 0.5) * 22, (U.hash2(i, seed, 2) - 0.5) * 18, 4 + U.hash2(i, seed, 3) * 4]);
    const parts = [
      { z0: 0, z1: 3, side: p.d, top: p.a, shape: (c) => S.blob(c, 0, 0, 18, seed, 10, 0.3) },
      { z0: 2, z1: 14, side: p.a, top: p.b, shape: (c, zt) => { for (const q of pts) S.ell(c, q[0], q[1], q[2] * Math.sin(Math.max(0.15, zt) * Math.PI), q[2] * 0.8 * Math.sin(Math.max(0.15, zt) * Math.PI)); },
        detail: (c) => { for (const q of pts) S.dot(c, p.g, q[0] - 1, q[1] - 1, q[2] * 0.3); } },
    ];
    return { r: 22, h: 16, parts };
  };

  M.station = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 2, side: '#4b4740', top: '#6f6a60', shape: (c) => S.rect(c, -30, -20, 60, 40) },
      { z0: 2, z1: 12, side: p.a, top: p.b, shape: (c) => { S.rrect(c, -26, -16, 22, 14, 3); S.rrect(c, 4, -16, 22, 14, 3); S.rrect(c, -12, 4, 24, 12, 3); },
        detail: (c) => { S.lines(c, p.t, 1, [-26, -9, -4, -9, 4, -9, 26, -9]); S.dot(c, '#9fe8ff', -15, -9, 1); S.dot(c, '#9fe8ff', 15, -9, 1); } },
      { z0: 4, z1: 9, side: p.d, top: p.a, shape: (c) => { S.rect(c, -4, -11, 8, 4); S.rect(c, -2, -2, 4, 6); } },
      { z0: 12, z1: 20, side: p.d, top: p.a, stroke: 1, shape: (c) => S.circ(c, 18, -10, 0.5) },
      { z0: 20, z1: 22, side: p.a, top: p.b, shape: (c) => S.ell(c, 18, -10, 5, 3, 0.6) },
    ];
    return { r: 34, h: 24, parts };
  };

  M.pad = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 40;
    const parts = [
      { z0: 0, z1: 3, side: '#3b3c40', top: '#5d6066', shape: (c) => S.poly(c, hexPts(R, 8, Math.PI / 8)),
        detail: (c) => {
          S.lines(c, o.mark || '#e8c24a', 2, [-R * 0.4, -R * 0.4, -R * 0.4, R * 0.4, R * 0.4, -R * 0.4, R * 0.4, R * 0.4, -R * 0.4, 0, R * 0.4, 0]);
          c.save(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.beginPath(); S.circ(c, 0, 0, R * 0.78); c.stroke(); c.restore();
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.dot(c, o.light || '#7dff9a', Math.cos(a) * (R - 4), Math.sin(a) * (R - 4), 1.3); }
        } },
    ];
    return { r: R + 4, h: 4, parts, post: { dither: false } };
  };

  M.wreckShip = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 4, side: '#2a2522', top: '#3d3530', shape: (c) => S.blob(c, 0, 0, 40, 5, 12, 0.35) },
      { z0: 2, z1: 16, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, [36, -4, 20, -12, -24, -14, -34, -6, -30, 8, -8, 12, 22, 8]),
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.35)', 1, [-20, -12, -18, 10, 0, -12, 2, 11, 18, -10, 18, 8]); S.fillPoly(c, '#1d1a18', [4, -6, 14, -9, 18, 0, 8, 4]); S.fillPoly(c, p.t, [-30, -4, -24, -4, -24, 4, -30, 4]); } },
      { z0: 12, z1: 22, side: p.a, top: p.b, shape: (c) => S.poly(c, [-6, -26, 4, -24, 0, -12, -10, -12]) },
      { z0: 14, z1: 20, side: p.d, top: '#ff8a3a', shape: (c) => S.circ(c, 10, -2, 2.5) },
    ];
    return { r: 46, h: 24, parts };
  };

  M.bunker = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 12, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, [22 - zt * 3, -16 + zt * 2, 22 - zt * 3, 16 - zt * 2, -22 + zt * 3, 16 - zt * 2, -22 + zt * 3, -16 + zt * 2]),
        detail: (c) => { S.fillPoly(c, '#191a1d', [6, 12, 6, 14, -6, 14, -6, 12]); S.lines(c, p.g, 1, [-14, 0, 14, 0]); S.dot(c, o.locked === false ? '#7dff9a' : '#ff5a4a', 0, -8, 1.6); } },
    ];
    return { r: 26, h: 14, parts };
  };

  M.relay = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 6, side: p.a, top: p.b, shape: (c) => S.rect(c, -10, -8, 20, 16), detail: (c) => { S.fillPoly(c, '#0f2026', [-7, -5, 3, -5, 3, 5, -7, 5]); S.lines(c, p.g, 0.8, [-6, -3, 2, -3, -6, 0, 0, 0, -6, 3, 1, 3]); } },
      { z0: 6, z1: 30, side: p.d, top: p.a, stroke: 1.3, shape: (c) => S.circ(c, 6, 0, 0.5) },
      { z0: 28, z1: 31, side: p.g, top: '#fff', shape: (c, zt, an) => S.circ(c, 6, 0, an < 0.5 ? 1.8 : 1) },
    ];
    return { r: 14, h: 32, parts };
  };

  M.thumper = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.poly(c, hexPts(10, 3, 0)) },
      { z0: 4, z1: 26, side: p.d, top: p.a, stroke: 1.6, shape: (c) => { for (const a of [0, 2.09, 4.19]) S.circ(c, Math.cos(a) * 6, Math.sin(a) * 6, 0.4); } },
      { z0: 0, z1: 1, side: p.d, top: p.a, shape: (c) => S.circ(c, 0, 0, 0) },
      { z0: 6, z1: 12, side: p.a, top: p.t, shape: (c, zt, an) => S.circ(c, 0, 0, 4.5), when: (an) => an < 0.5 },
      { z0: 16, z1: 22, side: p.a, top: p.t, shape: (c, zt, an) => S.circ(c, 0, 0, 4.5), when: (an) => an >= 0.5 },
      { z0: 26, z1: 28, side: p.g, top: '#fff', shape: (c) => S.circ(c, 0, 0, 1.6) },
    ];
    return { r: 14, h: 30, parts };
  };

  M.derrick = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 5, side: p.a, top: p.b, shape: (c) => S.rect(c, -14, -14, 28, 28), detail: (c) => S.fillPoly(c, p.t, [-14, -14, -8, -14, -14, -8]) },
      { z0: 5, z1: 48, side: p.d, top: p.a, stroke: 1.4, shape: (c, zt) => { const r = 10 - zt * 8; S.circ(c, r, r, 0.3); S.circ(c, -r, r, 0.3); S.circ(c, r, -r, 0.3); S.circ(c, -r, -r, 0.3); } },
      { z0: 14, z1: 15, side: p.d, top: p.a, stroke: 1, shape: (c) => { S.seg(c, -8, -8, 8, 8); S.seg(c, -8, 8, 8, -8); } },
      { z0: 30, z1: 31, side: p.d, top: p.a, stroke: 1, shape: (c) => { S.seg(c, -4, -4, 4, 4); S.seg(c, -4, 4, 4, -4); } },
      { z0: 48, z1: 51, side: p.a, top: p.b, shape: (c) => S.rect(c, -3, -3, 6, 6), detail: (c) => S.dot(c, '#ff4a3a', 0, 0, 1) },
      { z0: 5, z1: 12, side: p.a, top: p.b, shape: (c, zt, an) => S.circ(c, 0, 0, 3 + Math.sin(an * TAU) * 0.6) },
    ];
    return { r: 18, h: 53, parts };
  };

  M.refinery = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 3, side: '#3f3a35', top: '#5f5850', shape: (c) => S.rect(c, -34, -24, 68, 48) },
      { z0: 3, z1: 26, side: p.a, top: p.b, shape: (c, zt) => { S.circ(c, -18, -10, 10); S.circ(c, -18, 12, 8); }, detail: (c) => { S.lines(c, p.t, 1.2, [-28, -10, -8, -10]); S.dot(c, p.g, -18, 12, 2); } },
      { z0: 3, z1: 14, side: p.a, top: p.b, shape: (c) => S.rect(c, 2, -18, 28, 20), detail: (c) => S.lines(c, 'rgba(0,0,0,0.3)', 1, [2, -8, 30, -8]) },
      { z0: 6, z1: 9, side: p.d, top: p.t, stroke: 2, shape: (c) => { S.seg(c, -8, -10, 2, -10); S.seg(c, -10, 12, 16, 12); S.seg(c, 16, 12, 16, 2); } },
      { z0: 14, z1: 40, side: p.d, top: '#2b2724', shape: (c) => S.circ(c, 22, 14, 3) },
    ];
    return { r: 40, h: 42, parts };
  };

  M.tanks = function (p, o) {
    p = P(p); o = o || {};
    const pos = [[-12, -8], [10, -8], [-1, 10]];
    const parts = [
      { z0: 0, z1: 2, side: '#3f3a35', top: '#5f5850', shape: (c) => S.rect(c, -24, -20, 48, 40) },
      { z0: 2, z1: 16, side: o.side || '#b3762e', top: o.top || '#e0a54a', shape: (c, zt) => { for (const q of pos) S.circ(c, q[0], q[1], 8 - (zt > 0.9 ? (zt - 0.9) * 20 : 0)); },
        detail: (c) => { for (const q of pos) { S.lines(c, 'rgba(0,0,0,0.35)', 0.8, [q[0] - 6, q[1], q[0] + 6, q[1]]); S.dot(c, '#fff3', q[0] - 2, q[1] - 2, 1.5); } } },
    ];
    return { r: 28, h: 18, parts };
  };

  M.pen = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 26;
    const parts = [
      { z0: 0, z1: 1, side: '#3b342c', top: '#544a3e', shape: (c) => S.rect(c, -R, -R, R * 2, R * 2) },
      { z0: 0, z1: 12, side: p.d, top: p.a, stroke: 1.1, shape: (c) => { for (let i = -R; i <= R; i += 6) { S.circ(c, i, -R, 0.4); S.circ(c, i, R, 0.4); S.circ(c, -R, i, 0.4); S.circ(c, R, i, 0.4); } } },
      { z0: 10, z1: 11, side: p.d, top: p.g, stroke: 0.8, shape: (c) => { c.rect(-R, -R, R * 2, R * 2); } },
    ];
    return { r: R + 4, h: 14, parts };
  };

  M.heatStation = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 10, side: p.a, top: p.b, shape: (c) => S.rrect(c, -26, -18, 52, 36, 5), detail: (c) => { S.lines(c, p.t, 1.2, [-26, 0, 26, 0]); S.fillPoly(c, '#ff9a3a', [-20, -14, -12, -14, -12, -6, -20, -6]); } },
      { z0: 10, z1: 30, side: p.a, top: p.b, shape: (c, zt) => { S.circ(c, 10, -6, 7 - zt * 2); S.circ(c, 10, 10, 6 - zt * 2); } },
      { z0: 30, z1: 31, side: p.d, top: '#ff8d3a', shape: (c) => { S.circ(c, 10, -6, 3); S.circ(c, 10, 10, 2.5); } },
    ];
    return { r: 32, h: 32, parts };
  };

  M.iceBlock = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 16, side: '#8fb6cc', top: '#d9f1ff', shape: (c, zt) => S.poly(c, [12 - zt * 3, -6, 6, 11 - zt * 3, -10 + zt * 2, 9, -12 + zt * 3, -5, -3, -12 + zt * 2, 8, -10]),
        detail: (c) => { S.fillPoly(c, '#e98a3a', [-2, -3, 2, -3, 2, 3, -2, 3]); S.lines(c, '#ffffff', 0.8, [-8, -6, -3, -9, 5, 7, 9, 3]); } },
    ];
    return { r: 16, h: 18, parts, post: { levels: 26 } };
  };

  M.obelisk = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 40;
    const parts = [
      { z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.poly(c, [12, 0, 4, 10, -10, 8, -12, -2, -2, -11]) },
      { z0: 4, z1: H, side: p.a, top: p.b, shape: (c, zt) => S.poly(c, [6 - zt * 2, -1, 1, 5 - zt * 2, -5 + zt * 2, 3 - zt, -4 + zt, -5 + zt * 2, 2, -6 + zt * 2]),
        detail: (c) => S.lines(c, p.g, 0.8, [-2, -3, 2, 2]) },
      { z0: Math.round(H * 0.3), z1: Math.round(H * 0.7), side: p.g, top: p.g, shape: (c) => S.rect(c, 1.5, 3, 1, 1) },
    ];
    return { r: 15, h: H + 2, parts };
  };

  M.dome = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 24;
    const parts = [
      { z0: 0, z1: 3, side: '#4c4c50', top: '#6c6c72', shape: (c) => S.circ(c, 0, 0, R + 3) },
      { z0: 3, z1: 3 + R * 0.8, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, R * Math.cos(zt * 1.35)),
        detail: (c) => { S.lines(c, 'rgba(255,255,255,0.4)', 0.8, [-R * 0.2, -R * 0.2, R * 0.2, -R * 0.1]); } },
      { z0: 0, z1: 8, side: p.a, top: p.b, shape: (c) => S.rect(c, R * 0.8, -4, 8, 8) },
    ];
    return { r: R + 10, h: R * 0.8 + 6, parts };
  };

  M.platform = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 30;
    const parts = [
      { z0: 0, z1: 6, side: p.d, top: p.a, shape: (c, zt) => S.poly(c, hexPts(R * (0.7 + zt * 0.3), 6, 0)) },
      { z0: 6, z1: 9, side: p.a, top: p.b, shape: (c) => S.poly(c, hexPts(R, 6, 0)), detail: (c) => { S.lines(c, p.t, 1, [-R * 0.6, 0, R * 0.6, 0]); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; S.dot(c, p.g, Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), 1.2); } } },
    ];
    return { r: R + 4, h: 10, parts };
  };

  M.rod = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 5, side: p.a, top: p.b, shape: (c) => S.poly(c, hexPts(9, 6, 0)) },
      { z0: 5, z1: 50, side: '#5b6370', top: '#c8d0dc', shape: (c, zt) => S.circ(c, 0, 0, 2.6 - zt * 1.6) },
      { z0: 20, z1: 22, side: p.d, top: p.g, shape: (c) => S.circ(c, 0, 0, 4) },
      { z0: 36, z1: 38, side: p.d, top: p.g, shape: (c) => S.circ(c, 0, 0, 3.2) },
    ];
    return { r: 12, h: 52, parts };
  };

  M.node = function (p, o) {
    p = P(p); o = o || {};
    const parts = [
      { z0: 0, z1: 6, side: p.a, top: p.b, shape: (c) => S.poly(c, hexPts(12, 8, 0)), detail: (c) => S.lines(c, p.g, 1.2, [-12, 0, 12, 0, 0, -12, 0, 12]) },
      { z0: 6, z1: o.h || 14, side: p.d, top: p.g, shape: (c, zt) => S.poly(c, hexPts(6 - zt * 2, 4, zt)) },
    ];
    return { r: 15, h: (o.h || 14) + 2, parts };
  };

  M.core = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 40;
    const parts = [
      { z0: 0, z1: 10, side: p.d, top: p.a, shape: (c, zt) => S.poly(c, hexPts(R - zt * 6, 8, Math.PI / 8)), detail: (c) => S.lines(c, p.g, 1.5, [-R + 8, 0, R - 8, 0, 0, -R + 8, 0, R - 8]) },
      { z0: 10, z1: 40, side: p.a, top: p.b, shape: (c, zt) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; S.poly(c, [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, Math.cos(a + 0.25) * R * (0.75 - zt * 0.3), Math.sin(a + 0.25) * R * (0.75 - zt * 0.3), Math.cos(a - 0.25) * R * (0.75 - zt * 0.3), Math.sin(a - 0.25) * R * (0.75 - zt * 0.3)]); } } },
      { z0: 14, z1: 50, side: p.g, top: '#ffffff', shape: (c, zt, an) => S.circ(c, 0, 0, R * 0.22 * Math.sin(Math.max(0.12, zt) * Math.PI) * (1 + Math.sin(an * TAU) * 0.1)) },
    ];
    return { r: R + 6, h: 54, parts };
  };

  M.vent = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 4, side: p.a, top: p.b, shape: (c, zt) => S.blob(c, 0, 0, 20 - zt * 3, 12, 10, 0.25), detail: (c) => { S.dot(c, '#140f0c', 0, 0, 10); S.dot(c, p.g, 0, 0, 3); } },
    ];
    return { r: 24, h: 6, parts };
  };

  M.crusher = function (p, o) {
    p = P(p);
    const parts = [
      { z0: 0, z1: 3, side: '#2a2522', top: '#423a33', shape: (c) => S.rect(c, -22, -22, 44, 44), detail: (c) => S.lines(c, '#e8b23a', 2, [-22, -22, 22, 22, -22, 22, 22, -22]) },
      { z0: 3, z1: 40, side: p.d, top: p.a, shape: (c) => { S.rect(c, -24, -26, 6, 6); S.rect(c, 18, -26, 6, 6); S.rect(c, -24, 20, 6, 6); S.rect(c, 18, 20, 6, 6); } },
      { z0: 40, z1: 46, side: p.a, top: p.b, shape: (c) => S.rect(c, -26, -26, 52, 52), detail: (c) => S.fillPoly(c, p.t, [-24, -24, 24, -24, 24, -20, -24, -20]) },
    ];
    return { r: 34, h: 48, parts };
  };

  /* ---------- obstacles (block the craft) ---------- */
  M.spire = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 90, seed = o.seed || 1, R = o.r || 16;
    const parts = [
      { z0: 0, z1: H, side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => { const r = R * (1 - zt * 0.45) * (1 + Math.sin(zt * 9 + seed) * 0.05); S.blob(c, Math.sin(zt * 3 + seed) * 2, 0, r, seed, 7, 0.32); },
        detail: (c) => { S.lines(c, p.t, 1, [-R * 0.3, -R * 0.2, R * 0.1, R * 0.2]); } },
    ];
    if (o.glowVein) parts.push({ z0: Math.round(H * 0.2), z1: Math.round(H * 0.6), side: p.g, top: p.g, shape: (c, zt) => S.rect(c, -R * 0.5 + zt * 2, R * 0.55 - zt * 5, 1.2, 1.2) });
    return { r: R + 6, h: H + 2, parts, post: { levels: 18 } };
  };

  M.tree = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 70, seed = o.seed || 1, R = o.r || 26;
    const parts = [
      { z0: 0, z1: H * 0.6, side: '#3c2a1e', top: '#5c432c', ao: 0.5, shape: (c, zt) => S.blob(c, 0, 0, 6 - zt * 2 + (zt < 0.1 ? 5 * (0.1 - zt) * 10 : 0), seed, 7, 0.3) },
      { z0: H * 0.5, z1: H, side: p.a, top: p.b, shape: (c, zt) => { const r = R * Math.sin(0.35 + zt * 2.4) * 0.9; S.blob(c, 0, 0, r, seed + 3, 11, 0.3); S.blob(c, R * 0.4, R * 0.3, r * 0.6, seed + 5, 9, 0.3); },
        detail: (c) => { S.dot(c, p.g, -R * 0.2, -R * 0.2, 1.6); S.dot(c, p.g, R * 0.3, R * 0.1, 1.2); S.dot(c, p.t, -R * 0.4, R * 0.25, 1.4); } },
    ];
    return { r: R + 12, h: H + 2, parts };
  };

  M.bigShroom = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 60, R = o.r || 24, seed = o.seed || 1;
    const parts = [
      { z0: 0, z1: H * 0.85, side: '#8d8a9a', top: '#c9c4d6', shape: (c, zt) => S.circ(c, Math.sin(zt * 2 + seed) * 3, 0, 5 + (1 - zt) * 2) },
      { z0: H * 0.75, z1: H, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, Math.sin(2 + seed) * 3, 0, R * Math.sqrt(Math.max(0.05, 1 - zt * zt * 0.8)) * (zt < 0.3 ? 0.6 + zt * 1.3 : 1)),
        detail: (c) => { for (let i = 0; i < 6; i++) { const a = U.hash2(i, seed, 4) * TAU, d = U.hash2(i, seed, 5) * R * 0.75; S.dot(c, p.g, Math.cos(a) * d, Math.sin(a) * d, 1.3 + U.hash2(i, seed, 6) * 1.5); } } },
    ];
    return { r: R + 6, h: H + 2, parts };
  };

  M.column = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 70, R = o.r || 10;
    const parts = [
      { z0: 0, z1: 6, side: p.a, top: p.b, shape: (c) => S.rect(c, -R - 4, -R - 4, R * 2 + 8, R * 2 + 8) },
      { z0: 6, z1: H, side: p.a, top: p.b, shape: (c) => S.poly(c, hexPts(R, 8, Math.PI / 8)), detail: (c) => S.lines(c, p.g, 1, [-R + 2, 0, R - 2, 0]) },
      { z0: Math.round(H * 0.3), z1: Math.round(H * 0.8), side: p.g, top: p.g, shape: (c) => S.rect(c, -1, R - 1, 2, 1) },
      { z0: H, z1: H + 4, side: p.a, top: p.b, shape: (c) => S.rect(c, -R - 3, -R - 3, R * 2 + 6, R * 2 + 6) },
    ];
    return { r: R + 10, h: H + 6, parts };
  };

  M.gearTower = function (p, o) {
    p = P(p); o = o || {};
    const H = o.h || 50, R = o.r || 24;
    const parts = [
      { z0: 0, z1: H, side: p.a, top: p.b, shape: (c, zt, an) => S.star(c, 0, 0, R, R * 0.82, 14, an * TAU / 14), detail: (c) => { S.dot(c, p.d, 0, 0, R * 0.4); S.dot(c, p.g, 0, 0, R * 0.15); } },
    ];
    return { r: R + 6, h: H + 2, parts };
  };

  /* ---------- small destructible scenery ---------- */
  M.prop = function (kind, p, o) {
    p = P(p); o = o || {};
    const seed = o.seed || 1;
    switch (kind) {
      case 'crate': return { r: 8, h: 8, parts: [{ z0: 0, z1: 6, side: '#7a5a34', top: '#a57e4a', shape: (c) => S.rect(c, -5, -5, 10, 10), detail: (c) => S.lines(c, '#5a3f22', 0.8, [-5, -5, 5, 5, -5, 5, 5, -5]) }] };
      case 'barrel': return { r: 6, h: 9, parts: [{ z0: 0, z1: 7, side: o.col || '#8a3a22', top: o.top || '#c45a32', shape: (c) => S.circ(c, 0, 0, 3.4), detail: (c) => S.dot(c, '#222', 1, -1, 0.8) }] };
      case 'container': return { r: 16, h: 10, parts: [{ z0: 0, z1: 8, side: o.col || '#3c6070', top: o.top || '#5a8aa0', shape: (c) => S.rect(c, -12, -5, 24, 10), detail: (c) => { const s = []; for (let x = -10; x < 12; x += 3) s.push(x, -5, x, 5); S.lines(c, 'rgba(0,0,0,0.25)', 0.7, s); } }] };
      case 'fence': return { r: 16, h: 8, parts: [{ z0: 0, z1: 6, side: '#5b5a55', top: '#8e8c84', stroke: 1, shape: (c) => { for (let x = -12; x <= 12; x += 6) S.circ(c, x, 0, 0.4); } }, { z0: 4, z1: 5, side: '#5b5a55', top: '#a8a59b', stroke: 0.8, shape: (c) => S.seg(c, -12, 0, 12, 0) }] };
      case 'mast': return { r: 8, h: 26, parts: [{ z0: 0, z1: 22, side: '#6d6e70', top: '#a5a7aa', stroke: 1.3, shape: (c) => S.circ(c, 0, 0, 0.4) }, { z0: 22, z1: 23, side: '#ff4a3a', top: '#ff6a5a', shape: (c) => S.circ(c, 0, 0, 1.2) }, { z0: 0, z1: 2, side: '#4d4e50', top: '#77787a', shape: (c) => S.rect(c, -3, -3, 6, 6) }] };
      case 'pipe': return { r: 18, h: 8, parts: [{ z0: 0, z1: 3, side: '#4d4a46', top: '#66625c', shape: (c) => { S.rect(c, -12, -4, 3, 8); S.rect(c, 9, -4, 3, 8); } }, { z0: 3, z1: 7, side: o.col || '#7a6e5e', top: o.top || '#aa9a80', shape: (c) => S.rect(c, -15, -2, 30, 4) }] };
      case 'wreck': return { r: 16, h: 10, parts: [{ z0: 0, z1: 6, side: '#2e2b29', top: '#4a4440', shape: (c) => S.poly(c, [12, -3, 8, 7, -10, 6, -12, -1, -6, -7, 6, -6]) }, { z0: 6, z1: 9, side: '#3d3835', top: '#5c5550', shape: (c) => S.rect(c, -4, -4, 8, 8) }] };
      case 'lamp': return { r: 6, h: 18, parts: [{ z0: 0, z1: 15, side: '#5a5a5a', top: '#8a8a8a', stroke: 1.2, shape: (c) => S.circ(c, 0, 0, 0.3) }, { z0: 15, z1: 17, side: '#ffe08a', top: '#fff6c8', shape: (c) => S.circ(c, 0, 0, 1.5) }] };
      case 'plant': return { r: 12, h: 12, parts: [{ z0: 0, z1: 10, side: p.a, top: p.b, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + seed; S.ell(c, Math.cos(a) * (3 + zt * 4), Math.sin(a) * (3 + zt * 4), 2.2, 1.2, a); } }, detail: (c) => S.dot(c, p.g, 0, 0, 1.5) }] };
      case 'crystals': return { r: 10, h: 14, post: { levels: 26 }, parts: [{ z0: 0, z1: 12, side: p.a, top: p.b, shape: (c, zt) => { S.poly(c, [0, -2, 3 - zt * 2, 0, 0, 2, -3 + zt * 2, 0]); if (zt < 0.7) { S.poly(c, [5, 2, 7 - zt * 2, 4, 5, 6, 3 + zt * 2, 4]); S.poly(c, [-5, -4, -3 - zt * 2, -2, -5, 0, -7 + zt * 2, -2]); } } }] };
      case 'shroom': return { r: 9, h: 12, parts: [{ z0: 0, z1: 7, side: '#b8b2c6', top: '#ddd8ea', shape: (c) => S.circ(c, 0, 0, 1.6) }, { z0: 7, z1: 10, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 5 - zt * 2), detail: (c) => S.dot(c, p.g, -1, -1, 1) }] };
      case 'gearbit': return { r: 10, h: 6, parts: [{ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.star(c, 0, 0, 7, 5.5, 8, seed), detail: (c) => S.dot(c, p.d, 0, 0, 2) }] };
      case 'coral': return { r: 10, h: 14, parts: [{ z0: 0, z1: 12, side: p.a, top: p.b, stroke: 1.6, shape: (c, zt) => { S.circ(c, -3 + zt * 2, 0, 0.5); S.circ(c, 3 - zt, 2, 0.5); S.circ(c, 0, -3 + zt * 3, 0.5); } }] };
      default: return { r: 6, h: 6, parts: [{ z0: 0, z1: 4, side: p.a, top: p.b, shape: (c) => S.circ(c, 0, 0, 4) }] };
    }
  };

  /* ---------- pickups ---------- */
  M.pickup = function (kind) {
    const base = (side, top, sh, det) => ({ r: 10, h: 10, parts: [{ z0: 0, z1: 6, side, top, shape: sh, detail: det }], post: { rimStrength: 0.3 } });
    switch (kind) {
      case 'fuel': return { r: 10, h: 12, parts: [{ z0: 0, z1: 9, side: '#a35c14', top: '#f0a030', shape: (c) => S.rrect(c, -4, -4, 8, 8, 3), detail: (c) => { S.dot(c, '#3a1d06', 0, 0, 1.6); } }, { z0: 3, z1: 5, side: '#ffd36b', top: '#fff2b0', shape: (c) => S.circ(c, 0, 0, 4.6) }] };
      case 'ammo': return base('#3f5b2c', '#6c9a48', (c) => S.rect(c, -6, -4, 12, 8), (c) => { S.lines(c, '#e8d36a', 1, [-4, -2, -4, 2, -1, -2, -1, 2, 2, -2, 2, 2]); });
      case 'missiles': return base('#4a4f58', '#7b8492', (c) => S.rect(c, -6, -5, 12, 10), (c) => { for (let i = 0; i < 3; i++) S.fillPoly(c, '#ff6a4a', [-4, -3.5 + i * 3, 4, -3.5 + i * 3, 5, -2.5 + i * 3, 4, -1.5 + i * 3, -4, -1.5 + i * 3]); });
      case 'repair': return base('#a0a4a8', '#e6e8ea', (c) => S.rrect(c, -6, -5, 12, 10, 2), (c) => { S.fillPoly(c, '#ff7a2a', [-1.2, -3.5, 1.2, -3.5, 1.2, -1.2, 3.5, -1.2, 3.5, 1.2, 1.2, 1.2, 1.2, 3.5, -1.2, 3.5, -1.2, 1.2, -3.5, 1.2, -3.5, -1.2, -1.2, -1.2]); });
      case 'shield': return { r: 10, h: 12, parts: [{ z0: 0, z1: 2, side: '#2a3a55', top: '#48608a', shape: (c) => S.poly(c, hexPts(6, 6, 0)) }, { z0: 2, z1: 10, side: '#3aa0ff', top: '#bfe6ff', shape: (c, zt) => S.circ(c, 0, 0, 4 * Math.sin(Math.max(0.2, zt) * Math.PI)) }] };
      case 'special': return { r: 10, h: 12, parts: [{ z0: 0, z1: 2, side: '#3a2a55', top: '#5a4380', shape: (c) => S.poly(c, hexPts(6, 6, 0)) }, { z0: 2, z1: 10, side: '#b05aff', top: '#f0c8ff', shape: (c, zt) => S.poly(c, hexPts(4.5 * Math.sin(Math.max(0.2, zt) * Math.PI), 4, zt)) }] };
      case 'tech': return { r: 10, h: 14, parts: [{ z0: 0, z1: 3, side: '#3b3846', top: '#c9c2b0', shape: (c) => S.poly(c, [6, 0, 2, 5, -5, 3, -5, -3, 2, -5]) }, { z0: 3, z1: 11, side: '#7a4cd8', top: '#e6d2ff', shape: (c, zt) => S.poly(c, [3 - zt * 2, 0, 0, 3 - zt * 2, -3 + zt * 2, 0, 0, -3 + zt * 2]) }] };
      case 'salvage': return { r: 10, h: 8, parts: [{ z0: 0, z1: 5, side: '#5b5650', top: '#8d867c', shape: (c) => { S.poly(c, [-6, -2, -1, -5, 2, -1, -3, 3]); S.poly(c, [1, 1, 6, -1, 5, 4, 0, 5]); }, detail: (c) => { S.dot(c, '#e8c24a', -2, -1, 1); S.dot(c, '#9fe8ff', 3, 2, 0.8); } }] };
      case 'intel': return base('#2a3a3a', '#4a6a6a', (c) => S.rrect(c, -5, -6, 10, 12, 2), (c) => { S.fillPoly(c, '#5fffe0', [-3, -4, 3, -4, 3, 1, -3, 1]); S.lines(c, '#5fffe0', 0.6, [-3, 3, 3, 3]); });
      default: return base('#777', '#aaa', (c) => S.circ(c, 0, 0, 5));
    }
  };

  /* ---------- carried cargo ---------- */
  M.cargo = function (kind) {
    switch (kind) {
      case 'blackbox': return { r: 9, h: 9, parts: [{ z0: 0, z1: 6, side: '#a8521a', top: '#f08a3a', shape: (c) => S.rect(c, -5, -4, 10, 8), detail: (c) => S.lines(c, '#3a1a08', 0.8, [-5, 0, 5, 0]) }] };
      case 'datacore': return { r: 9, h: 12, parts: [{ z0: 0, z1: 9, side: '#2a5a6a', top: '#7fe8ff', shape: (c) => S.circ(c, 0, 0, 3.5), detail: (c) => S.dot(c, '#fff', 0, 0, 1.2) }, { z0: 0, z1: 2, side: '#3a3f46', top: '#5a636e', shape: (c) => S.circ(c, 0, 0, 5) }] };
      case 'artifact': return { r: 10, h: 14, parts: [{ z0: 0, z1: 3, side: '#3b3846', top: '#c9c2b0', shape: (c) => S.poly(c, hexPts(6, 5, 0)) }, { z0: 3, z1: 12, side: '#8a5ae0', top: '#f0e0ff', shape: (c, zt) => S.star(c, 0, 0, 4 - zt * 2, 2, 3, zt) }] };
      case 'fuelcore': return { r: 9, h: 12, parts: [{ z0: 0, z1: 10, side: '#b86a1a', top: '#ffd06a', shape: (c) => S.rrect(c, -3.5, -3.5, 7, 7, 2), detail: (c) => S.dot(c, '#fff8d0', 0, 0, 1.5) }] };
      case 'sample': return { r: 8, h: 10, parts: [{ z0: 0, z1: 8, side: '#3a7a3a', top: '#9cff7a', shape: (c) => S.circ(c, 0, 0, 3), detail: (c) => S.dot(c, '#eaffd8', -1, -1, 1) }] };
      case 'charge': return { r: 9, h: 10, parts: [{ z0: 0, z1: 7, side: '#7a2020', top: '#d84a3a', shape: (c) => S.rrect(c, -4, -4, 8, 8, 1), detail: (c) => { S.dot(c, '#ffe04a', 0, 0, 1.4); } }] };
      case 'powercell': return { r: 9, h: 11, parts: [{ z0: 0, z1: 9, side: '#2a4a8a', top: '#7aa8ff', shape: (c) => S.rect(c, -3, -4, 6, 8), detail: (c) => S.lines(c, '#ffffff', 0.8, [-2, 0, 2, 0]) }] };
      default: return M.cargo('blackbox');
    }
  };

  /* ---------- rubble left by destroyed structures ---------- */
  M.rubble = function (p, o) {
    p = P(p); o = o || {};
    const R = o.r || 16, seed = o.seed || 2;
    const parts = [
      { z0: 0, z1: 3, side: '#2c2826', top: '#3e3936', shape: (c) => S.blob(c, 0, 0, R, seed, 12, 0.4) },
      { z0: 2, z1: 6, side: p.d, top: p.a, shape: (c) => { for (let i = 0; i < 6; i++) { const a = U.hash2(i, seed, 1) * TAU, d = U.hash2(i, seed, 2) * R * 0.7; S.blob(c, Math.cos(a) * d, Math.sin(a) * d, 2 + U.hash2(i, seed, 3) * R * 0.18, seed + i, 5, 0.4); } } },
    ];
    return { r: R + 4, h: 8, parts };
  };

  /* ---------- terrain decor (baked into terrain chunks) ---------- */
  M.decor = function (kind, p, seed) {
    const m = decorModel(kind, P(p), seed);
    m.style = 'decor';
    return m;
  };
  function decorModel(kind, p, seed) {
    switch (kind) {
      case 'rock': {
        // medium rock: a main body and a smaller lump leaning on it
        const R = 4.5 + U.hash2(seed, 1, 9) * 4.5, a = U.hash2(seed, 2, 9) * TAU;
        return { r: R + 6, h: R * 1.1, parts: [
          { z0: 0, z1: Math.round(R * 0.85), side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => S.blob(c, 0, 0, R * (1 - zt * 0.45), seed, 7, 0.38), detail: (c) => S.lines(c, p.d || 'rgba(0,0,0,0.4)', 0.45, [-R * 0.3, -R * 0.2, R * 0.1, R * 0.05]) },
          { z0: 0, z1: Math.round(R * 0.5), side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => S.blob(c, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.7, R * 0.5 * (1 - zt * 0.4), seed + 5, 6, 0.4) },
        ] };
      }
      case 'formation': {
        // large outcrop: a tall core flanked by smaller blocks, cracked top faces
        const R = 11 + U.hash2(seed, 1, 9) * 6;
        const lumps = [];
        for (let i = 0; i < 4; i++) { const a = U.hash2(seed, i, 31) * TAU, d = R * (0.55 + U.hash2(seed, i, 32) * 0.35); lumps.push([Math.cos(a) * d, Math.sin(a) * d * 0.8, R * (0.32 + U.hash2(seed, i, 33) * 0.22)]); }
        const parts = [
          { z0: 0, z1: Math.round(R * 0.35), side: C.shade(p.a, -0.1), top: p.a, ao: 0.55, shape: (c) => S.blob(c, 0, 0, R * 1.05, seed + 9, 11, 0.32) },
          { z0: 0, z1: Math.round(R * 1.05), side: p.a, top: p.b, ao: 0.55, shape: (c, zt) => S.blob(c, -R * 0.08, -R * 0.05, R * 0.72 * (1 - zt * 0.42), seed, 9, 0.34),
            detail: (c) => S.lines(c, p.d || 'rgba(0,0,0,0.45)', 0.55, [-R * 0.35, -R * 0.15, R * 0.05, R * 0.1, R * 0.05, R * 0.1, R * 0.25, -R * 0.2]) },
        ];
        for (let i = 0; i < lumps.length; i++) { const L = lumps[i]; parts.push({ z0: 0, z1: Math.round(L[2] * 1.3), side: p.a, top: p.b, ao: 0.5, shape: (c, zt) => S.blob(c, L[0], L[1], L[2] * (1 - zt * 0.4), seed + i * 3, 7, 0.4) }); }
        return { r: R * 1.7, h: R * 1.15, parts };
      }
      case 'pebbles': {
        const parts = [];
        for (let i = 0; i < 4; i++) { const a = U.hash2(seed, i, 41) * TAU, d = 1.5 + U.hash2(seed, i, 42) * 4.5, rr = 0.9 + U.hash2(seed, i, 43) * 1.6; parts.push({ z0: 0, z1: Math.max(1, Math.round(rr)), side: p.a, top: p.b, ao: 0.5, bevel: false, shape: (c) => S.blob(c, Math.cos(a) * d, Math.sin(a) * d * 0.8, rr, seed + i, 6, 0.35) }); }
        return { r: 9, h: 3, parts };
      }
      case 'boulder': { const R = 9 + U.hash2(seed, 1, 9) * 7; return { r: R + 3, h: R, parts: [{ z0: 0, z1: Math.round(R * 0.9), side: p.a, top: p.b, shape: (c, zt) => S.blob(c, 0, 0, R * Math.sqrt(1 - zt * 0.75), seed, 9, 0.3), detail: (c) => S.lines(c, p.d, 0.7, [-R * 0.3, -R * 0.1, R * 0.2, R * 0.15]) }] }; }
      case 'bones': return { r: 10, h: 4, parts: [{ z0: 0, z1: 2, side: '#a39a86', top: '#e6dcc4', stroke: 1.2, shape: (c) => { for (let i = 0; i < 4; i++) { c.moveTo(-6 + i * 3, -4); c.quadraticCurveTo(-4 + i * 3, 0, -6 + i * 3, 4); } S.seg(c, -8, 0, 6, 0); } }] };
      case 'tuft': return { r: 7, h: 5, parts: [{ z0: 0, z1: 3, side: p.a, top: p.b, shape: (c, zt) => { S.blob(c, 0, 0, 3.3 - zt * 1.2, seed, 6, 0.45); S.blob(c, 2.6, 1.2, 2.3 - zt * 0.8, seed + 1, 5, 0.45); S.blob(c, -2, 1.5, 1.8 - zt * 0.6, seed + 2, 5, 0.45); } }] };
      case 'crystal': return { r: 7, h: 9, post: { levels: 26 }, parts: [{ z0: 0, z1: 7, side: p.a, top: p.b, shape: (c, zt) => { S.poly(c, [0, -1.5, 2 - zt * 1.5, 0, 0, 1.5, -2 + zt * 1.5, 0]); S.poly(c, [3, 1.5, 4 - zt, 2.5, 3, 3.5, 2 + zt, 2.5]); } }] };
      case 'scrap': return { r: 8, h: 4, parts: [{ z0: 0, z1: 2, side: '#4a4642', top: '#77716a', shape: (c) => { S.poly(c, [-5, -2, 0, -4, 2, 0, -3, 2]); S.rect(c, 1, 1, 4, 2); } }] };
      case 'shroomlet': return { r: 6, h: 6, parts: [{ z0: 0, z1: 3, side: '#b8b2c6', top: '#ddd8ea', shape: (c) => S.circ(c, 0, 0, 0.9) }, { z0: 3, z1: 5, side: p.a, top: p.b, shape: (c, zt) => S.circ(c, 0, 0, 2.6 - zt) }] };
      case 'panel': return { r: 10, h: 2, parts: [{ z0: 0, z1: 1, side: p.d, top: p.a, shape: (c) => S.rect(c, -7, -5, 14, 10), detail: (c) => S.lines(c, p.g, 0.7, [-5, 0, 5, 0]) }] };
      default: return decorModel('rock', p, seed);
    }
  };
})(window.AS);
