/* ALIEN STRIKE — native creature models (redesign pass).
 * New generators only (crXxx); the old ones in models3.js stay untouched.
 * Object space: +x forward, +y starboard, world units. Animation phase `an`
 * (0..1) drives legs, wings, jaws and sacs; every cycle loops seamlessly over
 * 4 frames. Colours are tuned per creature for contrast with its world ground;
 * the palette mostly feeds the emissive / accent colours (pal.g, pal.t). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------------- shared helpers ---------------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const css = (c, a) => C.str(c, a);
  const shade = (c, k) => C.str(C.shade(c, k));
  const mixc = (a, b, t) => C.str(C.mix(a, b, t));
  const P = (p, d) => Object.assign({}, d, p || {});
  const DEF = { a: '#7a4a2e', b: '#b0754a', t: '#e8c890', g: '#ffcf4a', d: '#3a2214' };
  const sn = (an, ph) => Math.sin((an + (ph || 0)) * TAU);
  // mirror a point list about y = 0 and reverse it, so the winding is preserved
  // (overlapping subpaths of opposite winding would punch holes under 'nonzero').
  const mir = (pts) => { const o = []; for (let i = pts.length - 2; i >= 0; i -= 2) o.push(pts[i], -pts[i + 1]); return o; };
  const both = (c, pts) => { S.poly(c, pts); S.poly(c, mir(pts)); };
  // domed taper for stacked ellipses (1 at the base, ~k at the top)
  const dome = (zt, k) => Math.sqrt(Math.max(0.02, 1 - zt * zt * (k === undefined ? 0.75 : k)));
  // glossy specular streak
  const spec = (c, x, y, rx, ry, rot, a) => { c.save(); c.fillStyle = 'rgba(255,255,255,' + (a || 0.55) + ')'; c.beginPath(); S.ell(c, x, y, rx, ry, rot || 0); c.fill(); c.restore(); };
  // radial glow blob (bright core → colour → transparent rim) drawn inside a detail
  const glow = (c, col, x, y, r, core) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, core || '#ffffff'); g.addColorStop(0.35, css(col)); g.addColorStop(1, css(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  };
  const arcLine = (c, col, w, x, y, r, a0, a1) => { c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); c.restore(); };
  const curve = (c, col, w, x0, y0, cx, cy, x1, y1) => { c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); c.restore(); };

  /* Jointed legs as two stacked tube parts (foot→knee, hip↔knee).
   * L: [{ h:[x,y], k:[x,y], f:[x,y], ph }], cfg: { hz, kz, stride, rf, rk, rh, side, top, lift }
   * The foot slides ±stride along x with sin(an + ph); the knee follows halfway.
   * cfg.lift raises the knee outward-up during the swing half of the cycle. */
  function legs(L, cfg) {
    const st = cfg.stride === undefined ? 2 : cfg.stride, hz = cfg.hz, kz = cfg.kz;
    const swingY = cfg.swingY || 0;
    const q = (lg, an) => {
      const s = sn(an, lg.ph), sx = s * st, lift = Math.max(0, Math.cos((an + lg.ph) * TAU)) * (cfg.lift || 0);
      const sy = s * swingY * Math.sign(lg.f[1] || 1);
      return [lg.f[0] + sx, lg.f[1] + sy - Math.sign(lg.f[1]) * lift * 0.6, lg.k[0] + sx * 0.5, lg.k[1] + sy * 0.5 + Math.sign(lg.k[1]) * lift * 0.4, lg.h[0], lg.h[1]];
    };
    const tube = (z0, z1, from, to, r0, r1) => (c, zt, an) => {
      const d = 1 / Math.max(1, (z1 - z0) * 2);
      for (const lg of L) {
        const p = q(lg, an);
        for (let j = 0; j < 3; j++) {
          const t = Math.max(0, zt - d * j / 3);
          S.circ(c, lerp(p[from], p[to], t), lerp(p[from + 1], p[to + 1], t), lerp(r0, r1, t));
        }
      }
    };
    const out = [{ z0: 0, z1: kz, side: cfg.side, top: cfg.top, bevel: false, ao: 0.3, shape: tube(0, kz, 0, 2, cfg.rf, cfg.rk) }];
    if (kz >= hz) out.push({ z0: hz, z1: kz, side: cfg.side, top: cfg.top, bevel: false, ao: 0.2, shape: tube(hz, kz, 4, 2, cfg.rh, cfg.rk) });
    else out.push({ z0: kz, z1: hz, side: cfg.side, top: cfg.top, bevel: false, ao: 0.2, shape: tube(kz, hz, 2, 4, cfg.rk, cfg.rh) });
    return out;
  }

  /* Curved manta outline: one closed path nose → starboard wing → tail → port wing.
   * k = { nose, sh:[x,y], lead:[x,y] (ctrl), tip:[x,y], trailC:[x,y], trail:[x,y], tailC:[x,y], tail } */
  function manta(c, k) {
    const q0x = (k.nose + k.sh[0]) / 2 + 0.6, q0y = k.sh[1] * 0.8;
    c.moveTo(k.nose, 0);
    c.quadraticCurveTo(q0x, q0y, k.sh[0], k.sh[1]); c.quadraticCurveTo(k.lead[0], k.lead[1], k.tip[0], k.tip[1]);
    c.quadraticCurveTo(k.trailC[0], k.trailC[1], k.trail[0], k.trail[1]); c.quadraticCurveTo(k.tailC[0], k.tailC[1], k.tail, 0);
    c.quadraticCurveTo(k.tailC[0], -k.tailC[1], k.trail[0], -k.trail[1]); c.quadraticCurveTo(k.trailC[0], -k.trailC[1], k.tip[0], -k.tip[1]);
    c.quadraticCurveTo(k.lead[0], -k.lead[1], k.sh[0], -k.sh[1]); c.quadraticCurveTo(q0x, -q0y, k.nose, 0);
    c.closePath();
  }
  // mirror right-side legs to the left with a half-cycle phase offset (alternating gait)
  const pairLegs = (R) => R.concat(R.map((l) => ({ h: [l.h[0], -l.h[1]], k: [l.k[0], -l.k[1]], f: [l.f[0], -l.f[1]], ph: (l.ph || 0) + 0.5 })));

  /* ============================================================
   * W1 — SKITTER: low, wide six-legged arthropod. Dark umber chitin
   * (reads darker than the ochre ground), segmented back plates with
   * dorsal spikes, two glowing eyes, snapping mandibles.
   * opt.leader: red crest spikes (pack-leader variant).
   * ============================================================ */
  M.crSkitter = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const shS = '#241a17', shT = '#4c3a31', plS = '#2e221d', plT = '#5d4739';
    const bone = p.t || '#e8c890', eye = p.g || '#ffcf4a';
    const spikeT = o.leader ? '#ff5a3a' : bone, spikeS = o.leader ? '#8a1e14' : '#6a5440';
    const L = pairLegs([
      { h: [3.4, 2.2], k: [7.4, 7], f: [10.8, 9.4], ph: 0 },
      { h: [0.8, 2.8], k: [1.4, 8.8], f: [1, 12.2], ph: 0.5 },
      { h: [-1.8, 2.5], k: [-5.4, 8], f: [-9, 10.8], ph: 0 },
    ]);
    const parts = legs(L, { hz: 3, kz: 5, stride: 2.2, rf: 0.6, rk: 1, rh: 0.95, side: '#1e1613', top: '#7a6050', lift: 1.2 });
    // thorax / underbody
    parts.push({ z0: 1.6, z1: 4, side: shS, top: shT, shape: (c) => S.ell(c, 0.5, 0, 5, 3.4) });
    // segmented abdomen plates (rear → front so front plates overlap)
    const plates = [[-7, 3.6, 4.4, 2.6, 5.8], [-3.6, 3.4, 5.4, 3, 6.6], [-0.2, 3.2, 5.6, 3.2, 7.2]];
    plates.forEach((pl, i) => parts.push({
      z0: pl[3], z1: pl[4], side: plS, top: plT, shape: (c, zt) => { const f = dome(zt, 0.55); S.ell(c, pl[0], 0, pl[1] * f, pl[2] * f); },
      detail: (c) => {
        arcLine(c, css(bone, 0.55), 0.45, pl[0] - 1.6, 0, pl[1] + 1.2, -1.05, 1.05);
        S.lines(c, 'rgba(10,6,4,0.45)', 0.4, [pl[0] - 2.2, -pl[2] * 0.55, pl[0] - 2.2, pl[2] * 0.55]);
        if (i === 0) { S.dot(c, css(eye, 0.85), pl[0] - 1.6, 2.2, 0.45); S.dot(c, css(eye, 0.85), pl[0] - 1.6, -2.2, 0.45); }
      },
    }));
    // head (cephalothorax wedge)
    parts.push({
      z0: 2.4, z1: 5.8, side: shS, top: '#5a463a', shape: (c, zt) => { const f = dome(zt, 0.4); S.poly(c, S.sym([8.8, 0, 8, 2.2 * f, 5.6, 3.6 * f, 2.6, 3.4 * f, 1.8, 0])); },
      detail: (c) => { S.lines(c, 'rgba(10,6,4,0.5)', 0.4, [3.2, -2.6, 3.2, 2.6]); S.lines(c, css(bone, 0.5), 0.4, [8.4, 0.3, 5.6, 3, 8.4, -0.3, 5.6, -3]); },
    });
    // mandibles: curved hooks that snap with the gait
    parts.push({ z0: 2.6, z1: 3.8, side: '#5a4634', top: bone, bevel: false, shape: (c, zt, an) => {
      const op = 0.5 + 0.5 * sn(an * 2);
      for (const s of [1, -1]) { S.circ(c, 9, s * (1.9 + op * 0.4), 0.75); S.circ(c, 10.3, s * (1.9 + op * 0.7), 0.65); S.circ(c, 11.4, s * (1.3 + op * 0.6), 0.55); S.circ(c, 12, s * (0.6 + op * 0.4), 0.42); }
    } });
    // dorsal spikes, raked back
    const spk = [[-6.6, 5.4, 10, 1.6], [-3.1, 6.2, 11.6, 1.8], [0.5, 6.8, 11, 1.6]];
    spk.forEach((k) => parts.push({ z0: k[1], z1: k[2], side: spikeS, top: spikeT, bevel: false, shape: (c, zt) => S.ell(c, k[0] - zt * 2.2, 0, k[3] * (1 - zt) + 0.2, k[3] * 0.7 * (1 - zt) + 0.2) }));
    // eyes
    parts.push({ z0: 5.8, z1: 6.3, side: C.shade(eye, -0.4), top: eye, flat: true, bevel: false, shape: (c) => { S.circ(c, 6.4, 1.6, 0.95); S.circ(c, 6.4, -1.6, 0.95); },
      detail: (c) => { S.dot(c, '#fffbe0', 6.6, 1.4, 0.4); S.dot(c, '#fffbe0', 6.6, -1.8, 0.4); } });
    return { r: 15, h: 11, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W1 — TUNNELER: a ringed burrower rearing out of a dirt mound, its
   * four-way split jaws opening on a glowing acid maw.
   * ============================================================ */
  M.crTunneler = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const acid = o.acid || '#b6ff4a', bone = '#d9c296', boneS = '#7a6446';
    const fleshS = '#3a2830', fleshT = '#6a4a50';
    const lean = (zt) => -2.2 + zt * 4.2; // body leans toward the target
    const parts = [];
    // churned dirt mound + thrown chunks
    parts.push({ z0: 0, z1: 2.2, side: '#4a3020', top: '#6e4a2c', ao: 0.5, shape: (c, zt) => S.blob(c, -1, 0, 11.5 * (1 - zt * 0.25), 5, 13, 0.32),
      detail: (c) => { c.save(); c.fillStyle = 'rgba(30,18,10,0.55)'; c.beginPath(); c.arc(-1.4, 0, 7.4, 0, TAU); c.fill(); c.restore(); } });
    parts.push({ z0: 1.6, z1: 3.6, side: '#4e3422', top: '#8a6440', shape: (c, zt) => { const f = 1 - zt * 0.4; S.blob(c, -9.5, 6, 1.9 * f, 2, 6, 0.4); S.blob(c, 6.5, -8, 1.6 * f, 3, 6, 0.4); S.blob(c, -7, -8.4, 1.4 * f, 4, 6, 0.4); S.blob(c, 8.4, 6.5, 1.3 * f, 5, 6, 0.4); } });
    // ringed body: each segment bulges and pinches, so the AO bands it
    const segs = [[0.8, 4.4, 6.4], [4.4, 8, 6.1], [8, 11.6, 5.8], [11.6, 15, 5.6]];
    segs.forEach((sg, i) => parts.push({
      z0: sg[0], z1: sg[1], side: fleshS, top: fleshT, ao: 0.55,
      shape: (c, zt, an) => { const Z = (sg[0] + (sg[1] - sg[0]) * zt) / 15, w = sn(an, i * 0.15) * 0.5 * Z; S.circ(c, lean(Z), w, sg[2] * (0.84 + 0.16 * Math.sin(zt * Math.PI))); },
      detail: (c) => { // armour plate on the back of each ring
        const x = lean(sg[1] / 15);
        c.save(); c.fillStyle = bone; c.beginPath(); c.arc(x, 0, sg[2] * 0.92, Math.PI * 0.62, Math.PI * 1.38); c.arc(x + 1.4, 0, sg[2] * 0.6, Math.PI * 1.32, Math.PI * 0.68, true); c.closePath(); c.fill(); c.restore();
      },
    }));
    // 4-way split jaws flaring up and out
    const hx = lean(1);
    parts.push({ z0: 14.4, z1: 19.4, side: boneS, top: bone, bevel: false, shape: (c, zt, an) => {
      const op = 0.75 + 0.25 * sn(an);
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + TAU / 8, R0 = 3.2 + zt * 2.2, R1 = 4.8 + zt * 7 * op;
        const ca = Math.cos(a), sa = Math.sin(a), ca1 = Math.cos(a + 0.55), sa1 = Math.sin(a + 0.55), ca2 = Math.cos(a - 0.55), sa2 = Math.sin(a - 0.55);
        S.poly(c, [hx + ca2 * R0, sa2 * R0, hx + ca * R1, sa * R1, hx + ca1 * R0, sa1 * R0, hx + ca * R0 * 0.5, sa * R0 * 0.5]);
      }
    }, detail: (c, an) => {
      const op = 0.75 + 0.25 * sn(an);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + TAU / 8, R = 4.8 + 7 * op; S.dot(c, '#fff4d8', hx + Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, 0.45); }
    } });
    // the maw: dark throat, acid glow, teeth ring
    parts.push({ z0: 15.4, z1: 15.8, side: '#1a0e12', top: '#1a0e12', flat: true, bevel: false, shape: (c) => S.circ(c, hx, 0, 3.6),
      detail: (c, an) => {
        glow(c, acid, hx, 0, 3.4 + 0.4 * sn(an), '#f6ffd8');
        const s = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; s.push(hx + Math.cos(a) * 3.5, Math.sin(a) * 3.5, hx + Math.cos(a) * 2.6, Math.sin(a) * 2.6); }
        S.lines(c, '#f2e6c4', 0.55, s);
      } });
    return { r: 15, h: 20, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W2 — SAND WYRM: long armoured eel arching out of the dunes; dark
   * hide with pale bone dorsal plates, a raised head with a round
   * lamprey maw (rings of teeth around a molten throat).
   * ============================================================ */
  M.crSandwyrm = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const hideS = '#2a1a18', hideT = '#4a302a', plate = '#e0cca4', plateS = '#8a7458', throat = p.g || '#ff8a4a';
    // spine samples from the sand exit (rear) to the neck
    const N = 7;
    const spine = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      spine.push({ x: -15 + t * 19, zc: 1.8 + Math.sin(t * Math.PI * 0.9) * 6 + t * 3.2, r: 4.6 + t * 0.9, ph: t * 0.9 });
    }
    const parts = [];
    // sand mound where it breaks the surface + spray lumps
    parts.push({ z0: 0, z1: 2.4, side: '#7a3a22', top: '#c07a4a', ao: 0.45, shape: (c, zt) => { S.blob(c, -15.5, 0, 7.5 * (1 - zt * 0.35), 9, 11, 0.3); S.blob(c, 7, 0, 4.5 * (1 - zt * 0.4), 3, 9, 0.3); },
      detail: (c) => { c.save(); c.fillStyle = 'rgba(40,14,8,0.6)'; c.beginPath(); S.ell(c, -14.5, 0, 4.4, 4.8); c.fill(); c.restore(); } });
    spine.forEach((sp, i) => parts.push({
      z0: Math.max(0, sp.zc - sp.r * 0.9), z1: sp.zc + sp.r * 0.55, side: hideS, top: hideT, ao: 0.35,
      shape: (c, zt, an) => { const f = dome(Math.abs(zt - 0.35) / 0.65, 0.65); S.ell(c, sp.x, sn(an, sp.ph) * 1.6, 3.1 * f + 0.4, sp.r * f); },
      detail: (c, an) => {
        const y = sn(an, sp.ph) * 1.6, w = sp.r * 0.78;
        S.fillPoly(c, plate, [sp.x + 2.6, y, sp.x + 1.2, y + w, sp.x - 2.4, y + w * 0.82, sp.x - 1.6, y, sp.x - 2.4, y - w * 0.82, sp.x + 1.2, y - w]);
        S.lines(c, plateS, 0.4, [sp.x - 1.6, y, sp.x + 2.6, y]);
        S.lines(c, 'rgba(255,255,255,0.45)', 0.35, [sp.x + 2.4, y + 0.3, sp.x + 1, y + w - 0.3]);
      },
    }));
    // head: heavy armoured skull raised over the neck
    const hz0 = 8.4, hz1 = 14.2;
    parts.push({ z0: hz0, z1: hz1, side: hideS, top: '#5a3a30', shape: (c, zt, an) => { const f = dome(Math.abs(zt - 0.4) / 0.6, 0.6); S.ell(c, 8, sn(an, 1) * 1.2, 5.4 * f, 5.6 * f); },
      detail: (c, an) => {
        const y = sn(an, 1) * 1.2;
        S.fillPoly(c, plate, [5.5, y - 4.8, 2.6, y - 3, 2.6, y + 3, 5.5, y + 4.8, 4.6, y]);
        S.dot(c, '#ffd27a', 4.8, y + 3.6, 0.6); S.dot(c, '#ffd27a', 4.8, y - 3.6, 0.6);
      } });
    // lamprey maw: rings of teeth around a glowing throat
    parts.push({ z0: hz1, z1: hz1 + 0.6, side: '#1a0c0a', top: '#24100c', flat: true, bevel: false, shape: (c, zt, an) => S.circ(c, 9.2, sn(an, 1) * 1.2, 4.2),
      detail: (c, an) => {
        const y = sn(an, 1) * 1.2;
        glow(c, throat, 9.2, y, 2.6 + 0.3 * sn(an * 2), '#fff0c0');
        for (const [R, n, w] of [[3.8, 14, 0.5], [2.6, 10, 0.42]]) { const s = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + R; s.push(9.2 + Math.cos(a) * R, y + Math.sin(a) * R, 9.2 + Math.cos(a) * (R - 0.9), y + Math.sin(a) * (R - 0.9)); } S.lines(c, '#f4e8cc', w, s); }
        arcLine(c, plate, 0.6, 9.2, y, 4.3, 0, TAU);
      } });
    return { r: 21, h: 16, parts, scale: sc, style: 'unit' };
  };

  /* Hive palette (W3): dark plum chitin with amber / bone highlights. */
  const HIVE = { chS: '#24152a', chT: '#4a2c52', amber: '#f0a030', bone: '#efe2c4' };

  /* ============================================================
   * W3 — HIVE DRONE: a big-winged wasp. Dark plum body with amber
   * bands, translucent blurred wings, glowing tail light.
   * ============================================================ */
  M.crHiveDrone = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const tail = o.tail || p.g || '#e0ff6a', wing = o.wingCol || '#eaf6dc';
    const parts = [];
    // legs tucked under (short dark strokes)
    parts.push({ z0: 0.6, z1: 2, side: '#140a16', top: '#3a2440', stroke: 0.6, bevel: false, shape: (c) => { for (const s of [1, -1]) { S.seg(c, 1.5, s * 1, 3, s * 3.4); S.seg(c, 0.4, s * 1, -0.6, s * 3.6); S.seg(c, -0.8, s * 0.9, -3, s * 3.2); } } });
    // abdomen with amber bands + stinger
    parts.push({ z0: 1.6, z1: 4.6, side: HIVE.chS, top: HIVE.chT, shape: (c, zt) => { const f = dome(zt, 0.6); S.ell(c, -4, 0, 4.2 * f, 2.6 * f); S.poly(c, [-7.6, 0.7 * f, -10.2, 0, -7.6, -0.7 * f]); },
      detail: (c) => { for (const x of [-2.6, -4.6, -6.4]) S.lines(c, HIVE.amber, 0.85, [x, -2.3 + Math.abs(x + 4) * 0.25, x, 2.3 - Math.abs(x + 4) * 0.25]); spec(c, -3.2, -1, 1.6, 0.45, -0.1, 0.4); } });
    // tail light
    parts.push({ z0: 3, z1: 3.6, side: tail, top: tail, flat: true, bevel: false, shape: (c) => S.circ(c, -8.6, 0, 1.15), detail: (c) => glow(c, tail, -8.6, 0, 1.4) });
    // thorax + head
    parts.push({ z0: 2, z1: 5.2, side: HIVE.chS, top: '#5a3462', shape: (c, zt) => { const f = dome(zt, 0.6); S.circ(c, 0.6, 0, 2.3 * f); S.ell(c, 3.6, 0, 1.6 * f, 1.9 * f); } });
    parts.push({ z0: 4.6, z1: 5.2, side: '#ff7a2a', top: '#ffb040', flat: true, bevel: false, shape: (c) => { S.ell(c, 4.1, 1.05, 0.8, 0.65); S.ell(c, 4.1, -1.05, 0.8, 0.65); },
      detail: (c) => { S.dot(c, '#fff4d0', 4.4, 0.8, 0.28); S.dot(c, '#fff4d0', 4.4, -1.3, 0.28); } });
    // wings: blurred ghost + crisp pair; beat changes spread and sweep
    const wingShape = (c, an, k) => {
      const b = sn(an), sweep = 0.35 + b * 0.35 * k, len = 6.6 + b * 0.8;
      for (const s of [1, -1]) {
        S.ell(c, 0.2 - Math.sin(sweep) * len * 0.5, s * (1.2 + Math.cos(sweep) * len * 0.5), len * 0.5, 1.7, s * (Math.PI / 2 - sweep));
        S.ell(c, -1.4 - Math.sin(sweep + 0.5) * len * 0.36, s * (1.2 + Math.cos(sweep + 0.5) * len * 0.36), len * 0.36, 1.2, s * (Math.PI / 2 - sweep - 0.5));
      }
    };
    parts.push({ z0: 5.4, z1: 5.4, side: wing, top: wing, flat: true, bevel: false, shape: (c, zt, an) => wingShape(c, an + 0.25, -1),
      detail: (c, an) => { c.save(); c.fillStyle = css(wing, 0.18); c.beginPath(); wingShape(c, an + 0.25, -1); c.fill(); c.restore(); } });
    parts.push({ z0: 5.6, z1: 5.6, side: wing, top: wing, flat: true, bevel: false, shape: (c, zt, an) => wingShape(c, an, 1),
      detail: (c, an) => { const b = sn(an), sweep = 0.35 + b * 0.35, len = 6.6 + b * 0.8; for (const s of [1, -1]) S.lines(c, 'rgba(60,40,60,0.45)', 0.3, [0.4, s * 1.2, 0.2 - Math.sin(sweep) * len * 0.9, s * (1.2 + Math.cos(sweep) * len * 0.9)]); } });
    return { r: 11, h: 7, parts, scale: sc, style: 'unit', post: { rimStrength: 0.28 } };
  };

  /* ============================================================
   * W3 — SPITTER: squat dark-plum bug dragging a swollen, glowing
   * amber acid sac; a spout on the head. The sac pulses.
   * ============================================================ */
  M.crSpitter = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const sacC = o.sac || '#ffb020', sacHot = '#fff070', bone = HIVE.bone;
    const L = pairLegs([
      { h: [3.2, 2], k: [5.4, 5.4], f: [7.6, 7.2], ph: 0 },
      { h: [1, 2.4], k: [0.8, 6.4], f: [0.2, 8.6], ph: 0.5 },
      { h: [-1.2, 2.2], k: [-3.4, 6], f: [-5.4, 8], ph: 0 },
    ]);
    const parts = legs(L, { hz: 2.6, kz: 5, stride: 1.4, rf: 0.5, rk: 0.85, rh: 0.8, side: '#160c18', top: '#5a3a5e' });
    // thorax
    parts.push({ z0: 1.6, z1: 5, side: HIVE.chS, top: HIVE.chT, shape: (c, zt) => { const f = dome(zt, 0.6); S.ell(c, 1.4, 0, 4 * f, 3.4 * f); },
      detail: (c) => { S.lines(c, 'rgba(8,4,10,0.5)', 0.4, [0.2, -3, 0.2, 3]); arcLine(c, css(bone, 0.5), 0.45, 0.6, 0, 3.6, -1.1, 1.1); } });
    // head + spout
    parts.push({ z0: 2.2, z1: 5.4, side: HIVE.chS, top: '#5c3864', shape: (c, zt) => { const f = dome(zt, 0.6); S.ell(c, 5.6, 0, 2.4 * f, 2.6 * f); } });
    parts.push({ z0: 3.6, z1: 5, side: '#6a3a20', top: sacC, shape: (c, zt) => S.poly(c, [10.2, 0, 7, 1.2 - zt * 0.3, 6.6, 0, 7, -1.2 + zt * 0.3]), detail: (c) => S.dot(c, sacHot, 9.6, 0, 0.55) });
    parts.push({ z0: 5.2, z1: 5.6, side: '#ff5a2a', top: '#ff8a3a', flat: true, bevel: false, shape: (c) => { S.circ(c, 6.4, 1.4, 0.65); S.circ(c, 6.4, -1.4, 0.65); } });
    // the acid sac — swollen, translucent, pulsing
    const sacR = (an) => 4.9 + 0.5 * sn(an);
    parts.push({ z0: 1.4, z1: 9.4, side: '#ff9a1a', top: '#ffc840', flat: true, ao: 0.3, shape: (c, zt, an) => S.ell(c, -4.6, 0, sacR(an) * dome(zt, 0.92) * 1.08, sacR(an) * dome(zt, 0.92)),
      detail: (c, an) => {
        const R = sacR(an) * 0.4;
        glow(c, '#ffe060', -4.6, 0, R * 2.6, '#fffbd0');
        S.lines(c, 'rgba(120,50,10,0.55)', 0.35, [-4.6, -R, -6, -R * 2, -4.6, R, -6.4, R * 1.9, -3.8, 0, -2.6, 1.4]);
        spec(c, -3.8, -0.9, 0.9, 0.42, -0.5, 0.75);
      } });
    return { r: 13, h: 11, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W3 — HIVE WARRIOR: big armoured beetle-ant. Slate-teal carapace
   * with bone rims (pops off dark jungle), glowing teal mandibles.
   * ============================================================ */
  M.crWarrior = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const glowC = p.g || '#7affd0', bone = p.t || '#c0e0e0';
    const caS = '#1c2a34', caT = '#5e7f8a', rim = '#e8eedd';
    const L = pairLegs([
      { h: [4, 3], k: [9.6, 8.4], f: [14.6, 10], ph: 0 },
      { h: [0.6, 3.6], k: [0.4, 10.4], f: [-1, 14.2], ph: 0.5 },
      { h: [-2.6, 3.4], k: [-8.4, 9.4], f: [-14, 11.4], ph: 0 },
    ]);
    const parts = legs(L, { hz: 4.4, kz: 6.8, stride: 2.6, rf: 0.85, rk: 1.55, rh: 1.4, side: '#121c24', top: '#8aa8b0', lift: 1.4 });
    // abdomen (big rear dome, split elytra)
    parts.push({ z0: 2.6, z1: 10, side: caS, top: caT, shape: (c, zt) => { const f = dome(zt, 0.7); S.ell(c, -7.4, 0, 7.6 * f, 6.4 * f); },
      detail: (c) => {
        S.lines(c, 'rgba(6,12,16,0.6)', 0.55, [-1.6, 0, -13.4, 0]);
        arcLine(c, rim, 0.6, -7.4, 0, 5.2, -2.5, -0.62); arcLine(c, rim, 0.6, -7.4, 0, 5.2, 0.62, 2.5);
        S.dot(c, glowC, -9.4, 2.6, 0.6); S.dot(c, glowC, -9.4, -2.6, 0.6); S.dot(c, glowC, -6, 3.4, 0.45); S.dot(c, glowC, -6, -3.4, 0.45);
        spec(c, -8.4, -2.4, 2.4, 0.7, -0.3, 0.3);
      } });
    // pronotum (thorax shield) with forward horns
    parts.push({ z0: 3.4, z1: 9.4, side: caS, top: '#6c8e98', shape: (c, zt) => { const f = dome(zt, 0.6); S.poly(c, S.sym([5.6, 0, 5.4, 3 * f, 3.6, 5 * f, -0.6, 5.2 * f, -2, 3.4 * f, -2.4, 0])); },
      detail: (c) => { S.lines(c, rim, 0.55, [5, 2.6, 3.4, 4.6, 5, -2.6, 3.4, -4.6]); S.lines(c, 'rgba(6,12,16,0.5)', 0.45, [1.4, -4, 1.4, 4]); } });
    parts.push({ z0: 7.6, z1: 11.2, side: '#4a5a5a', top: rim, bevel: false, shape: (c, zt) => { const f = 1 - zt * 0.8; S.ell(c, 3 + zt * 1.4, 2.6, 1.3 * f + 0.2, 0.9 * f + 0.2); S.ell(c, 3 + zt * 1.4, -2.6, 1.3 * f + 0.2, 0.9 * f + 0.2); } });
    // head
    parts.push({ z0: 3, z1: 7.6, side: caS, top: '#567680', shape: (c, zt) => { const f = dome(zt, 0.6); S.ell(c, 8.2, 0, 3.2 * f, 3.8 * f); },
      detail: (c) => { S.dot(c, glowC, 9.2, 2.2, 0.85); S.dot(c, glowC, 9.2, -2.2, 0.85); S.dot(c, '#ffffff', 9.4, 2, 0.32); S.dot(c, '#ffffff', 9.4, -2.4, 0.32); } });
    // mandibles: bone sickles with glowing inner edges
    const mand = (an) => { const op = 0.45 + 0.55 * (0.5 + 0.5 * sn(an * 2)); return [10, 2.4, 13.4, 3.6 + op * 1.4, 16, 1.6 + op * 1.6, 15, 0.9 + op * 0.8, 12.6, 1.6 + op * 0.6, 10.4, 1]; };
    parts.push({ z0: 3.4, z1: 5.4, side: '#5a6a68', top: bone, shape: (c, zt, an) => both(c, mand(an)),
      detail: (c, an) => { const m = mand(an); for (const s of [1, -1]) S.lines(c, glowC, 0.6, [m[10], m[11] * s, m[8], m[9] * s, m[8], m[9] * s, m[6], m[7] * s]); } });
    return { r: 19, h: 12, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W3 — THORN LURKER (dirs 1). Frame 0 = hidden: a thorny leaf mound
   * with two eye glints. Frames 1-3 = revealed: the leaf skirt splays
   * open and a crimson thorn-mantis rears out of it, scythes raised.
   * It faces the camera (+y) since the ambush AI never turns it.
   * ============================================================ */
  M.crLurker = function (p, o) {
    p = P(p, { a: '#2a5a22', b: '#5a9a3a', t: '#e0a040', g: '#ff4a6a', d: '#2a1214' }); o = o || {};
    const sc = o.size || 1;
    const hid = (an) => an < 0.1, rev = (an) => an >= 0.1;
    const bodyS = '#3a0e16', bodyT = '#a8344a', bone = '#efdcb8', eye = p.g;
    const n = 7;
    const parts = [];
    // leaf skirt: closed mound (hidden) or splayed thorny leaves (revealed)
    parts.push({ z0: 0, z1: 4.2, side: C.shade(p.a, -0.25), top: p.a, when: hid, shape: (c, zt) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.3, R = 9.5 * (1 - zt * 0.75); S.poly(c, [Math.cos(a - 0.5) * R * 0.45, Math.sin(a - 0.5) * R * 0.45, Math.cos(a) * R, Math.sin(a) * R, Math.cos(a + 0.5) * R * 0.45, Math.sin(a + 0.5) * R * 0.45, 0, 0]); } },
      detail: (c) => { S.dot(c, eye, -1, 1.6, 0.6); S.dot(c, eye, 1, 1.6, 0.6); } });
    parts.push({ z0: 0, z1: 1.6, side: C.shade(p.a, -0.2), top: p.b, when: rev, shape: (c, zt, an) => {
      const op = 0.9 + 0.1 * sn(an);
      for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.3, R = 16 * op; S.poly(c, [Math.cos(a - 0.4) * 4, Math.sin(a - 0.4) * 4, Math.cos(a - 0.2) * R * 0.7, Math.sin(a - 0.2) * R * 0.7, Math.cos(a) * R, Math.sin(a) * R, Math.cos(a + 0.2) * R * 0.7, Math.sin(a + 0.2) * R * 0.7, Math.cos(a + 0.4) * 4, Math.sin(a + 0.4) * 4]); }
    }, detail: (c, an) => {
      const op = 0.9 + 0.1 * sn(an);
      for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.3, R = 16 * op; S.lines(c, 'rgba(10,30,8,0.55)', 0.45, [Math.cos(a) * 4.5, Math.sin(a) * 4.5, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9]); S.dot(c, p.t, Math.cos(a) * (R - 0.6), Math.sin(a) * (R - 0.6), 0.55); }
    } });
    // abdomen (behind, up-screen) + rearing thorax column
    parts.push({ z0: 1, z1: 7, side: bodyS, top: '#8a2a3c', when: rev, shape: (c, zt) => { const f = dome(zt, 0.6); S.ell(c, 0, -6, 4.6 * f, 6.4 * f); },
      detail: (c) => { S.lines(c, 'rgba(20,4,8,0.5)', 0.45, [-3.8, -4.4, 3.8, -4.4, -3.8, -7.2, 3.8, -7.2]); S.lines(c, bone, 0.7, [0, -2, 0, -10.4]); S.dot(c, eye, -2, -8.4, 0.5); S.dot(c, eye, 2, -8.4, 0.5); } });
    // thorns along the back of the abdomen
    parts.push({ z0: 5, z1: 10, side: '#6a5a3a', top: bone, bevel: false, when: rev, shape: (c, zt) => { for (const q of [[-2.4, -4.4], [2.4, -4.4], [-2, -8], [2, -8]]) S.circ(c, q[0] * (1 + zt * 0.3), q[1] - zt * 1.6, 1.1 * (1 - zt) + 0.15); } });
    parts.push({ z0: 3, z1: 18, side: bodyS, top: bodyT, when: rev, shape: (c, zt) => S.ell(c, 0, -1.6 + zt * 3.4, 2.8 - zt * 0.6, 3 - zt * 0.6) });
    // raptorial arms: upper arm shoulder→elbow (rising), scythe elbow→tip (falling)
    const pose = (an) => { const k = an < 0.4 ? 0 : an < 0.6 ? 1 : 0.45; return { ex: 11 - k * 2.6, ey: 0.6 + k * 3.4, tx: 3.6 - k * 1.4, ty: 5.4 + k * 4.6 }; };
    parts.push({ z0: 15, z1: 23, side: '#5a1420', top: bodyT, bevel: false, when: rev, shape: (c, zt, an) => { const q = pose(an); for (const s of [1, -1]) for (let j = 0; j < 3; j++) { const t = Math.max(0, zt - j * 0.025); S.circ(c, s * lerp(2.2, q.ex, t), lerp(1.8, q.ey, t), lerp(1.4, 1.5, t)); } } });
    parts.push({ z0: 13, z1: 23, side: '#9a7a52', top: bone, bevel: false, when: rev, shape: (c, zt, an) => { const q = pose(an); for (const s of [1, -1]) for (let j = 0; j < 3; j++) { const t = Math.min(1, zt + j * 0.02); const x = s * lerp(q.tx, q.ex, t), y = lerp(q.ty, q.ey, t); S.circ(c, x, y, 0.35 + Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.85) * 1.5); if (j === 0 && t > 0.15 && t < 0.85 && (Math.round(t * 26) % 4 === 0)) S.circ(c, x - s * 1.2, y + 0.4, 0.7); } } });
    // head: triangular, two big glowing eyes, bone mandibles
    parts.push({ z0: 17.4, z1: 20.6, side: bodyS, top: bodyT, when: rev, shape: (c) => S.poly(c, [-3.4, 1.4, 3.4, 1.4, 0, 6.2]),
      detail: (c) => { S.dot(c, eye, -1.9, 2.6, 1.2); S.dot(c, eye, 1.9, 2.6, 1.2); S.dot(c, '#fff0f4', -1.6, 2.2, 0.45); S.dot(c, '#fff0f4', 2.2, 2.2, 0.45); S.lines(c, bone, 0.6, [-0.8, 5.4, -0.3, 7.2, 0.8, 5.4, 0.3, 7.2]); } });
    return { r: 19, h: 25, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W3 — BLOAT BOMBER: plum manta carrying a translucent dorsal brood
   * sac packed with glowing bomb pods. Slow heavy wingbeat.
   * ============================================================ */
  M.crBomber = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1, Wd = o.span || 15;
    const bomb = o.bomb || '#e8ff4a', memS = '#2a1430', memT = '#6a3270', vein = '#e05aa0', bone = HIVE.bone;
    const wk = (an) => { const f = sn(an), sp = Wd * (0.88 + 0.12 * f), tx = -3.4 - f * 2.4; return { nose: 12, sh: [5, 5.6], lead: [1.4, sp * 0.9], tip: [tx, sp], trailC: [-4.6, sp * 0.5], trail: [-9, 4.6], tailC: [-12, 3], tail: -13 }; };
    const parts = [];
    // whip tail
    parts.push({ z0: 1, z1: 2, side: memS, top: memT, stroke: 1, bevel: false, shape: (c, zt, an) => { const sw = sn(an) * 2.4; c.moveTo(-11, 0); c.quadraticCurveTo(-16, sw, -21, -sw * 0.6); } });
    // wings / body membrane
    parts.push({ z0: 0, z1: 2.6, side: memS, top: memT, shape: (c, zt, an) => manta(c, wk(an)),
      detail: (c, an) => {
        const k = wk(an);
        for (const s of [1, -1]) {
          c.save(); c.strokeStyle = css(vein, 0.8); c.lineWidth = 0.55; c.beginPath();
          c.moveTo(3, s * 3.6); c.quadraticCurveTo(0, s * k.tip[1] * 0.6, k.tip[0] + 0.6, s * k.tip[1] * 0.94);
          c.moveTo(0, s * 3.8); c.quadraticCurveTo(-3, s * k.tip[1] * 0.5, k.tip[0] - 1.4, s * k.tip[1] * 0.7);
          c.moveTo(-3, s * 3.8); c.quadraticCurveTo(-5.4, s * 5.4, -7.6, s * 5.4); c.stroke();
          c.strokeStyle = css(bone, 0.7); c.lineWidth = 0.6; c.beginPath(); c.moveTo(9, s * 2.6); c.quadraticCurveTo(6, s * 5, 5, s * 5.6); c.quadraticCurveTo(k.lead[0], s * k.lead[1] * 0.98, k.tip[0], s * k.tip[1]); c.stroke(); c.restore();
        }
      } });
    // head lobe + eyes
    parts.push({ z0: 1.6, z1: 4.4, side: memS, top: '#7a3a80', shape: (c, zt) => { const f = dome(zt, 0.5); S.ell(c, 8.6, 0, 3.6 * f, 3.4 * f); },
      detail: (c) => { S.dot(c, '#ffb040', 10.4, 1.7, 0.75); S.dot(c, '#ffb040', 10.4, -1.7, 0.75); S.lines(c, css(bone, 0.7), 0.45, [11.6, 0.8, 13.2, 1.4, 11.6, -0.8, 13.2, -1.4]); } });
    // brood sac: translucent dome packed with glowing pods
    parts.push({ z0: 1.6, z1: 8.6, side: '#4a6a14', top: '#8aac2a', flat: true, ao: 0.3, shape: (c, zt, an) => { const f = dome(zt, 0.92) * (1 + 0.04 * sn(an)); S.ell(c, -1.6, 0, 6 * f, 5 * f); },
      detail: (c, an) => {
        const pods = [[0.6, 1.8], [0.6, -1.8], [-3, 2], [-3, -2], [-1.4, 0]];
        pods.forEach((q, i) => { glow(c, bomb, q[0], q[1], 2 + 0.3 * sn(an, i * 0.2), '#ffffe8'); S.dot(c, '#fbffc8', q[0], q[1], 0.8); });
        c.save(); c.strokeStyle = 'rgba(40,60,10,0.5)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(-1.6, -4.6); c.quadraticCurveTo(-0.2, 0, -1.6, 4.6); c.stroke(); c.restore();
        spec(c, 0.4, -2.6, 1.8, 0.6, -0.3, 0.6);
      } });
    return { r: Wd + 7, h: 10, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W4 — SHARD STALKER: low wedge quadruped, dark navy hide with a
   * crest of bright crystal spines raked back, two cyan eye glints.
   * ============================================================ */
  M.crStalker = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = (o.size || 1) * 0.95;
    const hideS = '#10162a', hideT = '#2c3a62', cr = p.t || '#e0f4ff', crS = '#4ac8e8', eye = p.g || '#7ff';
    const L = pairLegs([
      { h: [5, 3], k: [8.2, 6.6], f: [10.4, 8], ph: 0 },
      { h: [-5.4, 3.2], k: [-8.6, 6.8], f: [-10.6, 8.2], ph: 0.5 },
    ]);
    const parts = legs(L, { hz: 3.6, kz: 4.6, stride: 2.6, rf: 0.75, rk: 1.25, rh: 1.4, side: '#0c1020', top: '#4a5c90', lift: 1 });
    // wedge body
    parts.push({ z0: 2.2, z1: 6.4, side: hideS, top: hideT, shape: (c, zt) => { const f = dome(zt, 0.5); S.poly(c, S.sym([12.4, 0, 10, 2.2 * f, 5, 4.6 * f, -2, 5 * f, -8, 3.8 * f, -11.6, 1.6 * f, -13, 0])); },
      detail: (c) => { S.lines(c, 'rgba(120,220,255,0.55)', 0.4, [11.4, 0, 4, 3.8, 11.4, 0, 4, -3.8]); S.lines(c, 'rgba(0,4,12,0.5)', 0.4, [4, -4, 4, 4, -5, -3.6, -5, 3.6]); } });
    // head
    parts.push({ z0: 3, z1: 7, side: hideS, top: '#34467a', shape: (c, zt) => { const f = dome(zt, 0.5); S.poly(c, S.sym([14.6, 0, 12.4, 1.8 * f, 8.4, 2.8 * f, 7, 0])); },
      detail: (c) => { S.dot(c, eye, 11.4, 1.5, 0.75); S.dot(c, eye, 11.4, -1.5, 0.75); S.dot(c, '#ffffff', 11.6, 1.3, 0.3); S.dot(c, '#ffffff', 11.6, -1.7, 0.3); } });
    // crystal spines: diamonds shrinking with height, raked back
    const sp = [[5, 0, 1.6, 1], [1.6, 1.8, 1.4, 0.9], [1.6, -1.8, 1.4, 0.9], [-2.2, 0, 1.7, 1], [-5.6, 1.6, 1.3, 0.75], [-5.6, -1.6, 1.3, 0.75], [-9, 0, 1.1, 0.6]];
    parts.push({ z0: 5.6, z1: 14, side: crS, top: cr, shape: (c, zt) => { for (const k of sp) { if (zt > k[3]) continue; const w = k[2] * (1 - zt / k[3]) + 0.15, x = k[0] - zt * 4.5, y = k[1] * (1 + zt * 0.8); S.poly(c, [x + w * 1.6, y, x, y + w, x - w * 1.6, y, x, y - w]); } } });
    return { r: 17, h: 15, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W4 — CRYSTAL LANCER (rooted, dirs 1): a navy bulb rooted in a frost
   * ring, a fan of tall crystal shards behind a glowing focal socket.
   * The rotating crystal gun (gunZ 7) sits in the socket as the gem.
   * ============================================================ */
  M.crLancer = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const navyS = '#121a32', navyT = '#2e4272', cr = p.t || '#e0f4ff', crS = '#3aa8d8', gem = p.g || '#7ff';
    const parts = [];
    // frost ring
    parts.push({ z0: 0, z1: 0.3, side: '#cfe6f6', top: '#eef8ff', flat: true, bevel: false, shape: (c) => S.star(c, 0, 0, 14.5, 11.5, 14, 0.1),
      detail: (c) => { c.save(); c.fillStyle = 'rgba(140,200,240,0.35)'; c.beginPath(); c.arc(0, 0, 10.5, 0, TAU); c.fill(); c.restore(); } });
    // roots
    parts.push({ z0: 0, z1: 1.4, side: '#0c1224', top: '#3a5080', stroke: 1.3, bevel: false, shape: (c) => { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.5; c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.quadraticCurveTo(Math.cos(a + 0.3) * 9, Math.sin(a + 0.3) * 9, Math.cos(a + 0.1) * 12.5, Math.sin(a + 0.1) * 12.5); } } });
    // fan of shards behind (−y is up-screen), tallest in the middle
    const fan = [[-152, 15], [-122, 21], [-90, 27], [-58, 21], [-28, 15]];
    fan.forEach((f) => {
      const a = f[0] * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), H = f[1];
      parts.push({ z0: 2, z1: H, side: crS, top: cr, shape: (c, zt) => {
        const R = 4.2 + zt * (5 + H * 0.12), w = 2.6 * (1 - zt) + 0.25, x = ca * R, y = sa * R;
        S.poly(c, [x + ca * w * 1.4, y + sa * w * 1.4, x - sa * w, y + ca * w, x - ca * w * 1.4, y - sa * w * 1.4, x + sa * w, y - ca * w]);
      } });
    });
    // bulb
    parts.push({ z0: 0, z1: 7, side: navyS, top: navyT, shape: (c, zt) => S.blob(c, 0, 0, 7.4 * dome(zt, 0.55), 3, 11, 0.12),
      detail: (c) => { S.lines(c, 'rgba(130,230,255,0.6)', 0.45, [-5, 3, -2.4, 1.2, 4.4, 3.4, 2, 1.4, 0, -5, 0, -2.6]); } });
    // small front shards
    parts.push({ z0: 2, z1: 9, side: crS, top: cr, shape: (c, zt) => { for (const a of [0.55, 2.6]) { const R = 6 + zt * 2.4, w = 1.5 * (1 - zt) + 0.2, x = Math.cos(a) * R, y = Math.sin(a) * R; S.poly(c, [x + w * 1.3, y, x, y + w, x - w * 1.3, y, x, y - w]); } } });
    // glowing socket
    parts.push({ z0: 7, z1: 7.4, side: gem, top: gem, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 4.2), detail: (c) => glow(c, gem, 0, 0, 4.2) });
    return { r: 17, h: 28, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W5 — LURCHER: frog-fish amphibian. Broad flat head with a wide jaw,
   * glossy dark-teal skin with wet highlights, bright yellow throat sacs
   * that pump, warning spots, a short fish tail.
   * ============================================================ */
  M.crLurcher = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const skS = '#0b2628', skT = '#2a6a64', sac = p.g || '#ffef6a', spot = p.t || '#e0a040';
    const parts = [];
    // tail fin
    parts.push({ z0: 1, z1: 2.4, side: '#123a3a', top: '#3a8a80', shape: (c, zt, an) => { const w = sn(an) * 2.2; S.poly(c, [-9, 2, -15.5, 4.6 + w, -14, w * 0.6, -15.5, -4.6 + w, -9, -2]); },
      detail: (c, an) => { const w = sn(an) * 2.2; S.lines(c, 'rgba(160,255,230,0.4)', 0.35, [-10, 0, -15, 3.6 + w, -10, 0, -15, -3.6 + w]); } });
    // legs: big folded hind legs, small fore legs
    parts.push({ z0: 0, z1: 3.6, side: skS, top: '#2e726a', shape: (c, zt, an) => {
      const s = sn(an) * 1.6, f = dome(zt, 0.6);
      for (const g of [1, -1]) { S.ell(c, -5 + s * g, g * 7.6, 4.6 * f, 2.6 * f, g * 0.5); S.ell(c, -10 + s * g * 1.4, g * 9.6, 2.6 * f, 1.6 * f, g * -0.4); S.ell(c, 5 - s * g, g * 7.2, 2.2 * f, 1.4 * f, g * -0.5); }
    } });
    // body: broad pear with the wide head forward
    parts.push({ z0: 1, z1: 7.4, side: skS, top: skT, shape: (c, zt) => { const f = dome(zt, 0.6); S.poly(c, S.sym([12, 0, 11.6, 3.6 * f, 9.6, 6.8 * f, 5.4, 8 * f, 0, 7.6 * f, -5, 6.2 * f, -9, 3.6 * f, -10.4, 0])); },
      detail: (c) => {
        c.save(); c.strokeStyle = '#06181a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(8.6, -6.6); c.quadraticCurveTo(13.4, 0, 8.6, 6.6); c.stroke(); c.restore();
        for (const q of [[-1, 3.4, 0.9], [-4.4, -2.6, 0.8], [-6.6, 1.6, 0.65], [1.6, -4.2, 0.7], [-2, -0.2, 0.6]]) S.dot(c, spot, q[0], q[1], q[2]);
        spec(c, 2, -3.6, 4.2, 0.9, -0.15, 0.5); spec(c, -4, -2.2, 2.4, 0.55, -0.25, 0.4); spec(c, 9, -2.6, 1.6, 0.45, -0.6, 0.5);
      } });
    // throat sacs pump at the jaw hinges
    parts.push({ z0: 2.6, z1: 6.6, side: '#c8a010', top: sac, flat: true, shape: (c, zt, an) => { const R = (2.3 + 0.7 * (0.5 + 0.5 * sn(an * 2))) * dome(zt, 0.85); S.circ(c, 6.6, 7.6, R); S.circ(c, 6.6, -7.6, R); },
      detail: (c) => { glow(c, sac, 6.4, 7.4, 2.2, '#ffffe8'); glow(c, sac, 6.4, -7.8, 2.2, '#ffffe8'); spec(c, 6, -8.4, 0.9, 0.4, -0.4, 0.8); } });
    // eye bumps
    parts.push({ z0: 6, z1: 9, side: skS, top: '#3a8a80', shape: (c, zt) => { const r = 1.9 * dome(zt, 0.7); S.circ(c, 6.2, 3.6, r); S.circ(c, 6.2, -3.6, r); },
      detail: (c) => { for (const g of [1, -1]) { S.dot(c, '#d8ff6a', 6.6, g * 3.6, 1.1); S.dot(c, '#10200a', 6.9, g * 3.6, 0.5); S.dot(c, '#ffffff', 6.2, g * 3.6 - 0.5, 0.35); } } });
    return { r: 17, h: 10, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W6 — SLAG GOLEM: hulking hunched basalt biped knuckle-walking on
   * huge fists. Light ash-grey plates over a molten core that shows
   * through wide glowing seams; eye slit and fist cracks glow.
   * ============================================================ */
  M.crGolem = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = (o.size || 1) * 1.25;
    const basS = '#2a2624', ash = '#aaa298', ashS = '#5a5450', molten = p.g || '#ff7a2a', hot = '#ffe27a';
    const parts = [];
    const step = (an) => sn(an) * 2.6;
    // stumpy legs (alternate)
    parts.push({ z0: 0, z1: 7, side: basS, top: '#4a4440', shape: (c, zt, an) => { const s = step(an), f = 1 - zt * 0.2; S.blob(c, -5 + s, 5, 2.9 * f, 1, 7, 0.2); S.blob(c, -5 - s, -5, 2.9 * f, 2, 7, 0.2); } });
    // arms: shoulder → fist (swing opposite to legs)
    parts.push({ z0: 4, z1: 12, side: '#4a4440', top: ash, bevel: false, shape: (c, zt, an) => { const s = -step(an); for (const g of [1, -1]) for (let j = 0; j < 3; j++) { const t = Math.max(0, zt - j * 0.04); S.circ(c, lerp(7.4 + s * g, 1.5, t), g * lerp(10.8, 8.4, t), lerp(2.9, 3.6, t)); } } });
    // fists with molten knuckle cracks
    parts.push({ z0: 0, z1: 5.2, side: '#3a3532', top: '#948c84', shape: (c, zt, an) => { const s = -step(an), f = dome(zt, 0.5); S.blob(c, 8 + s, 11, 4 * f, 4, 8, 0.22); S.blob(c, 8 - s, -11, 4 * f, 5, 8, 0.22); },
      detail: (c, an) => { const s = -step(an); for (const g of [1, -1]) S.lines(c, molten, 0.7, [6.4 + s * g, g * 9.6, 9.8 + s * g, g * 10.8, 7.8 + s * g, g * 12.8, 9.4 + s * g, g * 10.2]); } });
    // molten core (shows through the plate seams)
    parts.push({ z0: 5, z1: 15.8, side: '#c84a0c', top: '#ff9a2a', flat: true, ao: 0.2, shape: (c, zt) => { const f = dome(zt, 0.3); S.ell(c, -1.2 + zt * 2, 0, 8.8 * f, 8.8 * f); },
      detail: (c) => { glow(c, hot, 0.8, 0, 7.5, '#fffbe0'); } });
    // ash basalt plates with gaps (the seams)
    const plates = [
      [3.6, 0.6, 7.8, 2.2, 6.8, 6.4, 2.6, 7.4, 0.4, 3.4],
      [3.6, -0.6, 0.4, -3.4, 2.6, -7.4, 6.8, -6.4, 7.8, -2.2],
      [-0.6, 3.6, 1.8, 7.8, -2.8, 8.4, -6.6, 5, -3.2, 1.6],
      [-3.2, -1.6, -6.6, -5, -2.8, -8.4, 1.8, -7.8, -0.6, -3.6],
      [-4.4, 1.2, -7.6, 3.8, -9.6, 0, -7.6, -3.8, -4.4, -1.2],
    ];
    const shrunk = plates.map((pl) => { let cx = 0, cy = 0; const n = pl.length / 2; for (let i = 0; i < pl.length; i += 2) { cx += pl[i] / n; cy += pl[i + 1] / n; } return pl.map((v, i) => (i % 2 ? cy + (v - cy) * 0.8 : cx + (v - cx) * 0.8)); });
    parts.push({ z0: 7, z1: 17, side: ashS, top: ash, shape: (c, zt) => { const f = dome(zt, 0.3), dx = -1.2 + zt * 2; for (const pl of shrunk) { const q = []; for (let i = 0; i < pl.length; i += 2) q.push(pl[i] * f + dx, pl[i + 1] * f); S.poly(c, q); } },
      detail: (c) => { for (const q of [[3, 4.4], [3, -4.4], [-3.4, 5], [-3.4, -5], [-6.4, 0]]) S.lines(c, 'rgba(255,255,255,0.22)', 0.4, [q[0] + 1, q[1] - 0.6, q[0] - 1, q[1] + 0.6]); } });
    // shoulder boulders
    parts.push({ z0: 9, z1: 15, side: ashS, top: '#bcb4aa', shape: (c, zt) => { const f = dome(zt, 0.5); S.blob(c, 1.6, 8.4, 3.2 * f, 6, 7, 0.2); S.blob(c, 1.6, -8.4, 3.2 * f, 7, 7, 0.2); } });
    // head: low, forward, glowing slit
    parts.push({ z0: 8, z1: 13, side: '#3a3532', top: '#8a837c', shape: (c, zt) => { const f = dome(zt, 0.5); S.blob(c, 8.6, 0, 3.4 * f, 8, 7, 0.15); },
      detail: (c) => { S.lines(c, hot, 0.9, [10.6, -1.8, 11.2, 0, 11.2, 0, 10.6, 1.8]); glow(c, molten, 11, 0, 1.8, '#fff6c0'); } });
    return { r: 18, h: 18, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W7 — SPORELING: small fungal runner. A bright magenta toadstool cap
   * with cream spots and a glowing mint gill rim, scuttling on root legs.
   * ============================================================ */
  M.crSporeling = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const capS = '#6a1438', capT = '#e8507e', cream = '#f6ead6', gill = p.g || '#7fffd0', stalk = '#d6cab8';
    const L = pairLegs([{ h: [1.6, 1.6], k: [4.2, 4.8], f: [6.2, 6.6], ph: 0 }, { h: [-1.6, 1.6], k: [-4.2, 4.8], f: [-6.2, 6.6], ph: 0.5 }]);
    const parts = legs(L, { hz: 4.6, kz: 3.8, stride: 2, rf: 0.55, rk: 0.9, rh: 1, side: '#4a3c34', top: '#b8a690', lift: 0.8 });
    parts.push({ z0: 2.6, z1: 9, side: '#8a7c6a', top: stalk, shape: (c, zt) => S.ell(c, 0.4, 0, 2.8 - zt * 0.4, 2.6 - zt * 0.4) });
    // face lobe with glowing eyes (in front of the stalk)
    parts.push({ z0: 4, z1: 7, side: '#8a7c6a', top: stalk, shape: (c, zt) => S.ell(c, 4.2, 0, 2.2 * dome(zt, 0.5), 2.6 * dome(zt, 0.5)),
      detail: (c) => { S.dot(c, gill, 5.2, 1.1, 0.75); S.dot(c, gill, 5.2, -1.1, 0.75); S.dot(c, '#ffffff', 5.4, 0.9, 0.28); S.dot(c, '#ffffff', 5.4, -1.3, 0.28); } });
    // glowing gill rim under the cap
    parts.push({ z0: 7.4, z1: 7.9, side: gill, top: gill, flat: true, bevel: false, shape: (c) => S.ell(c, -0.8, 0, 8, 7.8) });
    // cap
    parts.push({ z0: 7.9, z1: 10.8, side: '#8a1c48', top: '#f4648e', shape: (c, zt, an) => { const f = (1 - zt * zt * 0.42) * (1 + 0.03 * sn(an * 2)); S.ell(c, -0.8, 0, 7.6 * f, 7.4 * f); },
      detail: (c) => { for (const q of [[-0.6, 0, 1.4], [2.2, 2.8, 1], [2, -3, 0.95], [-3.6, 2.4, 1.05], [-3.2, -2.8, 0.9], [-1, 4.6, 0.7], [-0.6, -4.8, 0.7], [3.4, 0, 0.7]]) S.dot(c, cream, q[0], q[1], q[2]); spec(c, -2, -1.4, 2.4, 0.8, -0.5, 0.3); } });
    return { r: 11, h: 13, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W7 — PUFFBALL MINE (dirs 1): a floating translucent spore bladder
   * with glowing spore spots, a vent crown and drifting tendrils.
   * ============================================================ */
  M.crPuffball = function (p, o) {
    p = P(p, { a: '#8a5a9a', b: '#d0a0e0', t: '#fff', g: '#fff0a0' }); o = o || {};
    const sc = o.size || 1, R = o.rad || 7;
    const parts = [];
    // tendrils hanging below, swaying
    const ten = [[0.3, 1], [1.5, 0.8], [2.6, 1], [3.7, 0.85], [4.9, 0.95], [5.8, 0.8]];
    parts.push({ z0: 0, z1: 6, side: C.shade(p.a, -0.35), top: p.a, bevel: false, shape: (c, zt, an) => {
      for (const t of ten) { const a = t[0] + sn(an, t[0] * 0.15) * 0.25 * (1 - zt), r0 = R * 0.55, r1 = R * (0.75 + 0.35 * t[1]); for (let j = 0; j < 3; j++) { const z = Math.max(0, zt - j * 0.03), rr = lerp(r1, r0, z); S.circ(c, Math.cos(a) * rr, Math.sin(a) * rr, lerp(0.3, 0.7, z)); } }
    } });
    // bladder
    const zc = 5, H = R * 1.6;
    parts.push({ z0: zc, z1: zc + H, side: p.a, top: p.b, shape: (c, zt, an) => { const r = R * Math.sqrt(Math.max(0.04, 1 - (zt * 2 - 1) * (zt * 2 - 1) * 0.85)) * (1 + 0.07 * sn(an)); S.blob(c, 0, 0, r, 11, 10, 0.08); },
      detail: (c, an) => {
        const k = 1 + 0.07 * sn(an);
        S.lines(c, css(p.t, 0.35), 0.35, [0, 0, -4.4 * k, 3.6 * k, 0, 0, 4.6 * k, -2.6 * k, 0, 0, 1 * k, 5 * k]);
        spec(c, -2.6, -3.6, 2.4, 0.9, -0.5, 0.45);
      } });
    // glowing spore spots on the bladder skin
    const spots = [[0.4, 0.62, 1.3], [1.9, 0.5, 1.1], [3.1, 0.66, 1.2], [4.4, 0.45, 1], [5.4, 0.7, 0.95], [1.2, 0.3, 0.9], [2.6, 0.82, 0.9]];
    parts.push({ z0: zc + H * 0.55, z1: zc + H * 0.55, side: p.g, top: p.g, flat: true, bevel: false, shape: (c, zt, an) => { const k = 1 + 0.07 * sn(an); for (const q of spots) S.circ(c, Math.cos(q[0]) * R * q[1] * k, Math.sin(q[0]) * R * q[1] * k, q[2] * 0.55); },
      detail: (c, an) => { const k = 1 + 0.07 * sn(an); for (const q of spots) glow(c, p.g, Math.cos(q[0]) * R * q[1] * k, Math.sin(q[0]) * R * q[1] * k, q[2] * 1.3, '#ffffff'); } });
    // vent crown
    parts.push({ z0: zc + H - 1.4, z1: zc + H + 1.4, side: C.shade(p.a, -0.2), top: p.b, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; S.circ(c, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.9 * (1 - zt * 0.4)); } },
      detail: (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; S.dot(c, p.g, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.45); } } });
    return { r: R + 6, h: zc + H + 2, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W7 — SPORE MORTAR (dirs 1): squat fleshy mound ringed with pale gill
   * frills and glowing spore sacs, a tall launch chimney whose orifice
   * pulses violet.
   * ============================================================ */
  M.crSporeMortar = function (p, o) {
    p = P(p, { a: '#5a3a6a', b: '#8a5aa0', g: '#c58aff', d: '#22142a' }); o = o || {};
    const sc = o.size || 1;
    const fleshS = '#24142c', fleshT = '#5e3a70', frill = '#eadcc6', frillS = '#8a7a6a', gl = p.g;
    const parts = [];
    parts.push({ z0: 0, z1: 1.2, side: fleshS, top: '#4a2c58', stroke: 1.4, bevel: false, shape: (c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.2; c.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); c.quadraticCurveTo(Math.cos(a + 0.25) * 13, Math.sin(a + 0.25) * 13, Math.cos(a + 0.1) * 16, Math.sin(a + 0.1) * 16); } } });
    parts.push({ z0: 0, z1: 6.4, side: fleshS, top: fleshT, shape: (c, zt) => S.blob(c, 0, 0, 12.4 * dome(zt, 0.6), 7, 12, 0.16) });
    // gill frills radiating
    parts.push({ z0: 4, z1: 7.6, side: frillS, top: frill, shape: (c, zt) => { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r0 = 5.2, r1 = 10.6 - zt * 2.6, w = 0.16; S.poly(c, [Math.cos(a - w) * r0, Math.sin(a - w) * r0, Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a + w) * r0, Math.sin(a + w) * r0]); } } });
    // spore sacs
    const sacs = [[0.9, 9], [2.9, 9.4], [4.6, 8.6]];
    parts.push({ z0: 2, z1: 8.6, side: '#6a3a9a', top: gl, flat: true, shape: (c, zt, an) => { for (let i = 0; i < 3; i++) { const q = sacs[i], r = (2.3 + 0.3 * sn(an, i * 0.3)) * dome(zt, 0.85); S.circ(c, Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1], r); } },
      detail: (c, an) => { for (let i = 0; i < 3; i++) { const q = sacs[i]; glow(c, gl, Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1], 2.2, '#ffffff'); } } });
    // launch chimney
    parts.push({ z0: 4, z1: 19, side: fleshS, top: '#7a4c8e', ao: 0.55, shape: (c, zt, an) => { const r = 4.4 - zt * 0.9 + zt * zt * 1.6 + 0.15 * sn(an); S.circ(c, -0.6 + zt * 1, 0, r); },
      detail: (c) => { S.lines(c, frill, 0.5, [-0.8, -4.4, -0.8, 4.4]); } });
    // rings on the chimney
    parts.push({ z0: 9, z1: 10, side: frillS, top: frill, shape: (c) => S.circ(c, -0.1, 0, 4.4) });
    parts.push({ z0: 14, z1: 15, side: frillS, top: frill, shape: (c) => S.circ(c, 0.2, 0, 4.2) });
    // orifice
    parts.push({ z0: 19, z1: 19.4, side: '#120814', top: '#120814', flat: true, bevel: false, shape: (c) => S.circ(c, 0.4, 0, 4.4),
      detail: (c, an) => { glow(c, gl, 0.4, 0, 3.6 + 0.6 * sn(an), '#ffffff'); arcLine(c, frill, 0.7, 0.4, 0, 4.4, 0, TAU); } });
    return { r: 17, h: 21, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W8 — SKY RAY: graceful storm manta. Swept indigo wings with pale
   * leading edges, glowing cyan nerve lines, cephalic fins, a long
   * whip tail with a charged tip. Wingtips sweep with the beat.
   * ============================================================ */
  M.crSkyRay = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1, Wd = o.span || 17;
    const wS = '#121a3e', wT = '#3a5098', edge = p.t || '#c0d8ff', glowC = p.g || '#9ff';
    const wk = (an) => { const f = sn(an), sp = Wd * (0.9 + 0.1 * f), tx = -5.4 - f * 2.8; return { nose: 9.6, sh: [4, 4.8], lead: [1.6, sp * 0.8], tip: [tx, sp], trailC: [-5.4, sp * 0.4], trail: [-8.6, 3.4], tailC: [-10.6, 2], tail: -11.2 }; };
    const parts = [];
    // whip tail with a charged tip
    parts.push({ z0: 0.6, z1: 1.6, side: wS, top: '#5a70b0', stroke: 0.9, bevel: false, shape: (c, zt, an) => { const sw = sn(an, 0.25) * 2.6; c.moveTo(-10, 0); c.bezierCurveTo(-15, sw, -20, -sw, -27, sw * 0.6); } });
    parts.push({ z0: 1, z1: 1.6, side: glowC, top: glowC, flat: true, bevel: false, shape: (c, zt, an) => S.circ(c, -27, sn(an, 0.25) * 2.6 * 0.6, 0.95) });
    // wings
    parts.push({ z0: 0, z1: 2.2, side: wS, top: wT, shape: (c, zt, an) => manta(c, wk(an)),
      detail: (c, an) => {
        const k = wk(an);
        c.save();
        for (const s of [1, -1]) {
          c.strokeStyle = css(edge, 0.9); c.lineWidth = 0.75; c.beginPath(); c.moveTo(8.6, s * 2); c.quadraticCurveTo(6, s * 4.4, 4, s * 4.8); c.quadraticCurveTo(k.lead[0], s * k.lead[1] * 0.98, k.tip[0], s * k.tip[1]); c.stroke();
          c.strokeStyle = css(glowC, 0.85); c.lineWidth = 0.45; c.beginPath(); c.moveTo(1, s * 3); c.quadraticCurveTo(-1.6, s * k.tip[1] * 0.55, k.tip[0] + 1.2, s * k.tip[1] * 0.88); c.moveTo(-2.6, s * 3); c.quadraticCurveTo(-5, s * 4.6, -7.6, s * 3.6); c.stroke();
        }
        c.restore();
        for (const q of [[2, 6.4, 0.7], [-0.6, 8.6, 0.55], [2, -6.4, 0.7], [-0.6, -8.6, 0.55]]) S.dot(c, css(edge, 0.7), q[0], q[1], q[2]);
        for (const s of [1, -1]) S.dot(c, glowC, k.tip[0] + 0.4, s * k.tip[1] * 0.96, 0.6);
      } });
    // low dorsal swell blending into the wings
    parts.push({ z0: 1.4, z1: 3.4, side: wS, top: '#4660aa', shape: (c, zt) => { const f = dome(zt, 0.5); S.ell(c, -0.4, 0, 7.4 * f, 3.4 * f); },
      detail: (c) => { spec(c, 1.6, -1.4, 3, 0.6, -0.08, 0.3); S.lines(c, css(glowC, 0.7), 0.4, [4.6, 0, -6, 0]); } });
    // curled cephalic fins + eyes
    parts.push({ z0: 1.2, z1: 2.8, side: wS, top: '#5a74bc', shape: (c, zt, an) => { const k = sn(an) * 0.15; S.ell(c, 11.4, 2.3, 2.4, 0.95, 0.35 + k); S.ell(c, 11.4, -2.3, 2.4, 0.95, -0.35 - k); },
      detail: (c) => { S.dot(c, '#e8ffff', 8, 2.6, 0.6); S.dot(c, '#e8ffff', 8, -2.6, 0.6); } });
    return { r: Wd + 13, h: 5, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W9 — ANCIENT SENTINEL: floating relic machine. A weathered bronze
   * disc on a glowing lift ring, three armour vanes slowly orbiting,
   * a domed head with one huge orange lens (+x) and glyph channels.
   * ============================================================ */
  M.crSentinel = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = o.size || 1;
    const brS = '#3a3428', brT = '#c4b696', dark = '#2a241c', lens = p.g || '#ff6a3a', trim = p.t || '#c8b890';
    const parts = [];
    // lift glow under the core
    parts.push({ z0: 0, z1: 0.8, side: lens, top: '#ffb07a', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 3.2), detail: (c) => glow(c, lens, 0, 0, 3.4, '#fff0d8') });
    // fins hanging from the ring (rotate 1/3 turn per cycle: seamless)
    parts.push({ z0: 1.2, z1: 6.4, side: dark, top: '#d8ccb0', shape: (c, zt, an) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + an * TAU / 3 + 0.5; const v = [[10.4, -0.3], [16.2, -0.12], [16.6, 0.1], [10.4, 0.34]]; S.poly(c, v.flatMap((q) => [Math.cos(a + q[1]) * q[0] * (1 - zt * 0.08), Math.sin(a + q[1]) * q[0] * (1 - zt * 0.08)])); } },
      detail: (c, an) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + an * TAU / 3 + 0.5; S.dot(c, lens, Math.cos(a) * 14.6, Math.sin(a) * 14.6, 0.7); } } });
    // halo ring
    parts.push({ z0: 4, z1: 7, side: brS, top: brT, stroke: 2.8, bevel: false, shape: (c) => S.circ(c, 0, 0, 10),
      detail: (c, an) => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.lines(c, i % 3 ? 'rgba(20,16,10,0.5)' : css(lens, 0.9), i % 3 ? 0.35 : 0.6, [Math.cos(a) * 9, Math.sin(a) * 9, Math.cos(a) * 11, Math.sin(a) * 11]); } } });
    // spokes
    parts.push({ z0: 5, z1: 6.2, side: dark, top: '#8a7e66', stroke: 1, bevel: false, shape: (c) => { for (const a of [0.9, 3, 5.1]) { c.moveTo(Math.cos(a) * 4.6, Math.sin(a) * 4.6); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); } } });
    // suspended core sphere
    parts.push({ z0: 2, z1: 11.4, side: brS, top: brT, shape: (c, zt) => S.circ(c, 0, 0, 5.6 * Math.sqrt(Math.max(0.05, 1 - (zt * 2 - 1) * (zt * 2 - 1) * 0.8))),
      detail: (c) => { S.lines(c, css(trim, 0.7), 0.4, [-1.6, -1.2, -0.4, -2, -1.6, 1.2, -0.4, 2]); spec(c, -0.8, -0.8, 1.2, 0.5, -0.6, 0.4); } });
    // the eye
    parts.push({ z0: 6.6, z1: 7, side: '#1a1612', top: '#1a1612', flat: true, bevel: false, shape: (c) => S.ell(c, 3.4, 0, 2.6, 3.4) });
    parts.push({ z0: 7, z1: 7.4, side: lens, top: lens, flat: true, bevel: false, shape: (c) => S.ell(c, 3.8, 0, 1.9, 2.7), detail: (c, an) => glow(c, lens, 4, 0, 2.6 + 0.3 * sn(an), '#fff4d8') });
    return { r: 19, h: 12, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W9 — MACHINE MITE: small mechanical tick. Riveted brass shell on six
   * piston legs, a sensor head with one hot orange eye and drill
   * mandibles, a vent on the back.
   * ============================================================ */
  M.crMite = function (p, o) {
    p = P(p, { a: '#5a5448', b: '#9a9078', t: '#ff6a3a', g: '#ff6a3a', d: '#1e1c18' }); o = o || {};
    const sc = o.size || 1;
    const shS = '#4a4234', shT = '#d4c49a', metal = '#5a5650', eye = p.g;
    const L = pairLegs([
      { h: [2.4, 2.2], k: [5, 5.8], f: [7.6, 7.4], ph: 0 },
      { h: [0, 2.6], k: [0, 6.6], f: [-0.4, 8.8], ph: 0.5 },
      { h: [-2.4, 2.2], k: [-5, 5.8], f: [-7.4, 7.6], ph: 0 },
    ]);
    const parts = legs(L, { hz: 2.6, kz: 4.6, stride: 1.8, rf: 0.45, rk: 0.8, rh: 0.65, side: '#2a2824', top: '#cfc8ba', lift: 0.8 });
    parts.push({ z0: 1.6, z1: 3.4, side: '#1e1c18', top: metal, shape: (c) => S.ell(c, 0, 0, 5, 3.6) });
    // shell
    parts.push({ z0: 2.6, z1: 6.6, side: shS, top: shT, shape: (c, zt) => { const f = dome(zt, 0.5); S.ell(c, -1.2, 0, 5.4 * f, 4.4 * f); },
      detail: (c) => {
        S.lines(c, 'rgba(20,16,10,0.55)', 0.45, [-1.2, -3.8, -1.2, 3.8, 1.6, -2.6, -4, -2.6, 1.6, 2.6, -4, 2.6]);
        for (const q of [[1.8, 1.4], [1.8, -1.4], [-3.6, 1.4], [-3.6, -1.4]]) S.dot(c, '#e8dcc0', q[0], q[1], 0.35);
        S.fillPoly(c, p.t, [-5.6, -0.8, -4.2, -0.8, -4.2, 0.8, -5.6, 0.8]);
        spec(c, -0.6, -1.8, 1.8, 0.45, -0.2, 0.4);
      } });
    // sensor head
    parts.push({ z0: 2.2, z1: 5.6, side: shS, top: '#9a8c6c', shape: (c, zt) => S.ell(c, 4.6, 0, 2.2 * dome(zt, 0.5), 2.6 * dome(zt, 0.5)) });
    parts.push({ z0: 2.4, z1: 3.6, side: metal, top: '#c0b8a8', bevel: false, shape: (c, zt, an) => { const op = 0.4 * sn(an * 2); for (const g of [1, -1]) { S.circ(c, 6.6, g * (1.4 + op), 0.6); S.circ(c, 7.6, g * (1.1 + op), 0.5); S.circ(c, 8.4, g * (0.7 + op * 0.6), 0.38); } } });
    parts.push({ z0: 5.6, z1: 6, side: eye, top: eye, flat: true, bevel: false, shape: (c) => S.circ(c, 5.2, 0, 1.2), detail: (c) => glow(c, eye, 5.3, 0, 1.4, '#fff0d0') });
    return { r: 12, h: 8, parts, scale: sc, style: 'unit' };
  };

  /* ============================================================
   * W10 — LIVING ENGINE (behemoth): colossal armoured quadruped. Maroon
   * hide under bone-pink armour plates split by violet glowing seams,
   * three dorsal engine vents, a heavy tusked head, pillar legs.
   * ============================================================ */
  M.crBehemoth = function (p, o) {
    p = P(p, DEF); o = o || {};
    const sc = (o.size || 1) * 1.05;
    const hideS = '#1e0a12', hideT = '#5a2434', plate = p.t || '#e0b0c0', plateS = '#6a3a48', gl = p.g || '#c09aff';
    const L = pairLegs([
      { h: [10.6, 7.6], k: [13, 11.4], f: [13.6, 12], ph: 0 },
      { h: [-10.6, 7.6], k: [-13.2, 11.4], f: [-13.8, 12], ph: 0.5 },
    ]);
    const parts = legs(L, { hz: 11, kz: 6.4, stride: 3.2, rf: 2.7, rk: 2.7, rh: 3.3, side: '#3a1622', top: plate, lift: 1.2 });
    // feet claws
    parts.push({ z0: 0, z1: 1.6, side: '#3a2028', top: plate, bevel: false, shape: (c, zt, an) => { for (const lg of L) { const x = lg.f[0] + sn(an, lg.ph) * 3.2, y = lg.f[1]; S.circ(c, x + 2.4, y, 0.8); S.circ(c, x + 2, y + 1.4, 0.7); S.circ(c, x + 2, y - 1.4, 0.7); } } });
    // tail
    parts.push({ z0: 6, z1: 10, side: hideS, top: hideT, shape: (c, zt, an) => { const w = sn(an) * 1.6; S.poly(c, [-14, 4 * (1 - zt * 0.4), -22, 1.6 + w, -25, w, -22, -1.6 + w, -14, -4 * (1 - zt * 0.4)]); } });
    // body
    parts.push({ z0: 7, z1: 18, side: hideS, top: hideT, shape: (c, zt) => { const f = dome(zt, 0.7); S.ell(c, -1, 0, 17 * f, 10.4 * f); } });
    // violet seam glow layer (under the plates)
    parts.push({ z0: 17, z1: 18.6, side: '#5a2a8a', top: gl, flat: true, shape: (c) => S.ell(c, -1, 0, 13.8, 8.2), detail: (c) => { glow(c, gl, -1, 0, 9, '#f4eaff'); } });
    // armour plates (shoulder, back, rump) separated by seams
    const plates = [[7.4, 0, 5, 8.6], [0.4, 0, 5.6, 9.2], [-7, 0, 5.4, 8.6], [-12.8, 0, 3.4, 6.4]];
    parts.push({ z0: 15, z1: 20.4, side: plateS, top: plate, shape: (c, zt) => { const f = dome(zt, 0.6); for (const q of plates) S.ell(c, q[0], q[1], q[2] * f, q[3] * f); },
      detail: (c) => { for (const q of plates) { arcLine(c, 'rgba(255,255,255,0.4)', 0.6, q[0], q[1], q[3] * 0.62, 3.6, 5.4); S.lines(c, 'rgba(60,20,30,0.45)', 0.5, [q[0], -q[3] * 0.5, q[0], q[3] * 0.5]); } } });
    // engine vents on the back plates
    const vents = [[3.6, 4.2], [3.6, -4.2], [-3.4, 0]];
    parts.push({ z0: 19, z1: 24, side: '#2a1a24', top: '#8a6a7a', shape: (c, zt) => { for (const v of vents) S.circ(c, v[0] - zt * 0.8, v[1], 2.1 - zt * 0.3); } });
    parts.push({ z0: 24, z1: 24.4, side: gl, top: gl, flat: true, bevel: false, shape: (c) => { for (const v of vents) S.circ(c, v[0] - 0.8, v[1], 1.5); }, detail: (c, an) => { for (const v of vents) glow(c, gl, v[0] - 0.8, v[1], 1.6 + 0.3 * sn(an), '#ffffff'); } });
    // head
    parts.push({ z0: 7, z1: 15.6, side: hideS, top: '#6a2c3e', shape: (c, zt) => { const f = dome(zt, 0.55); S.poly(c, S.sym([24.4, 0, 23.4, 3.6 * f, 19.6, 5.8 * f, 14.6, 6.2 * f, 13, 0])); },
      detail: (c) => { S.fillPoly(c, plate, [22.6, 0, 20.2, 2.8, 15.6, 3.6, 16.6, 0, 15.6, -3.6, 20.2, -2.8]); S.dot(c, gl, 20.6, 4.2, 0.9); S.dot(c, gl, 20.6, -4.2, 0.9); S.dot(c, '#ffffff', 20.8, 4, 0.35); S.dot(c, '#ffffff', 20.8, -4.4, 0.35); } });
    // tusks
    parts.push({ z0: 6, z1: 9, side: '#8a6a6a', top: '#f4e4d8', bevel: false, shape: (c, zt) => { for (const g of [1, -1]) for (let i = 0; i < 6; i++) { const t = i / 5; S.circ(c, 22 + t * 6, g * (5.4 + Math.sin(t * Math.PI) * 1.6 - t * 1.6), 1.3 * (1 - t * 0.7)); } } });
    return { r: 30, h: 26, parts, scale: sc, style: 'unit' };
  };

})(window.AS);
