/* WYRMCROWN — dragon and rider art.
 * A dragon is drawn as a living rig rather than one rotating sprite:
 *  - body segments (head, neck, chest, hips, tail, tail tip) are forged
 *    stacked models (32 headings) placed along a spine chain, so the neck
 *    bends into turns and the tail trails behind with follow-through;
 *  - the wings are rendered every frame as lit membranes stretched between
 *    finger bones, flapping through a real stroke (elevation, fold, sweep),
 *    rolling with the bank and casting their own shadows;
 *  - the wizard rider is a small forged model in the saddle that turns to
 *    face where the staff is aimed.
 * Faction looks come from AS.Data.dragonLooks (body/belly/horn/membrane
 * colours, horn and tail-tip styles, membrane style). */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;

  /* ------------------------------------------------------------------ looks */
  const LOOKS = {
    human: { body: '#a32a20', top: '#c8402c', belly: '#e9a65a', horn: '#eadcc2', spine: '#5e1410', membrane: '#b83a26', bone: '#6e1c14', eye: '#ffd23a', tip: 'spade', horns: 'swept', mem: 'classic', breath: ['#fff2b0', '#ffb030', '#ff5a10'] },
    elf: { body: '#1f7a4c', top: '#38a866', belly: '#d8e8a0', horn: '#f0f4d8', spine: '#c8a84a', membrane: '#3fae6e', bone: '#1a5a3a', eye: '#a8fff0', tip: 'leaf', horns: 'antler', mem: 'leaf', breath: ['#f0fff0', '#7affc0', '#20c080'] },
    ice: { body: '#6f9cc8', top: '#a8d0f0', belly: '#e8f4ff', horn: '#ffffff', spine: '#d8f0ff', membrane: '#9ccff0', bone: '#4a78a8', eye: '#e0ffff', tip: 'crystal', horns: 'crown', mem: 'frost', breath: ['#ffffff', '#bfefff', '#5ab8ff'] },
    undead: { body: '#3a3440', top: '#5a5262', belly: '#cfc6aa', horn: '#d8cfb4', spine: '#d8cfb4', membrane: '#4a3a52', bone: '#d8cfb4', eye: '#93ff6a', tip: 'bone', horns: 'ram', mem: 'tattered', breath: ['#f0ffe0', '#a8ff6a', '#5a2a8a'] },
  };

  /* ------------------------------------------------------- body segment models */
  function scalesDetail(c, L, W, col, n) {
    c.save(); c.strokeStyle = col; c.lineWidth = 0.35; c.beginPath();
    for (let i = 0; i < n; i++) { const x = L / 2 - (i + 0.5) * (L / n); c.moveTo(x + 1, -W * 0.36); c.quadraticCurveTo(x - 1, 0, x + 1, W * 0.36); }
    c.stroke(); c.restore();
  }
  function spineRidge(L, z0, z1, col, n, w) {
    return { z0, z1, side: C.shade(col, -0.35), top: C.shade(col, 0.15), bevel: false, shape: (c, zt) => {
      for (let i = 0; i < n; i++) { const x = L / 2 - (i + 0.5) * (L / n), s = (w || 1.3) * (1 - zt * 0.8); c.moveTo(x + s * 0.9, 0); c.lineTo(x - s * 1.8, s * 0.55); c.lineTo(x - s * 1.4, 0); c.lineTo(x - s * 1.8, -s * 0.55); c.closePath(); }
    } };
  }

  const Seg = {
    head(lk, open) {
      const b = lk.body, t = lk.top, belly = lk.belly, horn = lk.horn;
      const parts = [];
      const jawDrop = open ? 1.6 : 0;
      // lower jaw (opens for breath / roar)
      parts.push({ z0: 0, z1: 2.2, side: C.shade(belly, -0.25), top: belly, shape: (c) => S.poly(c, S.sym([open ? 14.5 : 15.5, 0, 12, 2.4 + jawDrop * 0.4, 6, 3.6, 0, 3.8, -2, 0])) });
      if (open) parts.push({ z0: 2.2, z1: 2.2, side: '#5a0a0a', top: '#8a1a14', flat: true, shape: (c) => S.poly(c, S.sym([14, 0, 11, 2.2, 6, 2.8, 2, 2.4, 1, 0])), detail: (c) => {
        c.fillStyle = '#fff4e0';
        for (let i = 0; i < 5; i++) { for (const sg of [1, -1]) { c.beginPath(); c.moveTo(13 - i * 2.2, sg * (1.9 + i * 0.15)); c.lineTo(12.2 - i * 2.2, sg * (1.2 + i * 0.15)); c.lineTo(11.6 - i * 2.2, sg * (2 + i * 0.15)); c.fill(); } }
        S.dot(c, lk.breath[1], 9, 0, 1.4);
      } });
      // skull and snout
      parts.push({ z0: 2.2 + jawDrop, z1: 5.6 + jawDrop, side: b, top: t, shape: (c, zt) => S.poly(c, S.sym([16.5 - zt * 0.6, 0, 14.5, 2.2, 9, 3.2, 3, 4.4 - zt * 0.4, -1.5, 3.6, -3, 0])),
        detail: (c) => {
          S.lines(c, 'rgba(0,0,0,0.35)', 0.35, [14, 1.2, 10, 2.2, 14, -1.2, 10, -2.2]);
          S.dot(c, '#1a0a08', 15.4, 1.1, 0.45); S.dot(c, '#1a0a08', 15.4, -1.1, 0.45);
          S.lines(c, C.shade(t, 0.3), 0.6, [9.5, 2.6, 5, 3.6, 9.5, -2.6, 5, -3.6]); // brow ridges
          scalesDetail(c, 8, 6, 'rgba(0,0,0,0.18)', 3);
        } });
      // eyes (emissive)
      parts.push({ z0: 4.6 + jawDrop, z1: 5.4 + jawDrop, side: lk.eye, top: lk.eye, flat: true, bevel: false, shape: (c) => { S.ell(c, 7.6, 3.1, 1.2, 0.7, 0.3); S.ell(c, 7.6, -3.1, 1.2, 0.7, -0.3); } });
      // horns
      const hz = 5 + jawDrop;
      if (lk.horns === 'swept') parts.push({ z0: hz, z1: hz + 2.6, side: C.shade(horn, -0.35), top: horn, stroke: 1.5, bevel: false, shape: (c, zt) => { for (const sg of [1, -1]) { c.moveTo(3, sg * 2.6); c.quadraticCurveTo(-2, sg * 4.6, -8 + zt * 2, sg * (5 + zt)); } } });
      else if (lk.horns === 'antler') parts.push({ z0: hz, z1: hz + 3, side: C.shade(horn, -0.3), top: horn, stroke: 1.1, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(3, sg * 2.4); c.quadraticCurveTo(-1, sg * 5, -6, sg * 7); c.moveTo(-1.5, sg * 4.6); c.lineTo(-3, sg * 2.4); c.moveTo(-4, sg * 6.2); c.lineTo(-7.5, sg * 5.2); } } });
      else if (lk.horns === 'crown') parts.push({ z0: hz, z1: hz + 3.4, side: C.shade(horn, -0.3), top: horn, bevel: false, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = Math.PI * 0.55 + i / 4 * Math.PI * 0.9, r0 = 3.2, r1 = 6.5 - zt * 1.5; c.moveTo(1 + Math.cos(a) * r0 - 0.7, Math.sin(a) * r0); c.lineTo(1 + Math.cos(a) * r1, Math.sin(a) * r1); c.lineTo(1 + Math.cos(a) * r0 + 0.7, Math.sin(a) * r0 + 0.6); c.closePath(); } } });
      else parts.push({ z0: hz, z1: hz + 2.2, side: C.shade(horn, -0.35), top: horn, stroke: 1.7, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(3, sg * 2.8); c.bezierCurveTo(-2, sg * 6.5, -5, sg * 2.5, -1.5, sg * 2); } } });
      // cheek frills
      parts.push({ z0: 2.4 + jawDrop, z1: 4 + jawDrop, side: C.shade(lk.spine, -0.2), top: lk.spine, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.poly(c, [2.5, sg * 3.8, -3, sg * 6.4, -1, sg * 3.6]); } });
      return { r: 13, h: 10, style: 'hero', parts, scale: 1.22 };
    },
    neck(lk, w) {
      w = w || 6;
      return { r: 8, h: 7, style: 'hero', parts: [
        { z0: 0, z1: 1.5, side: C.shade(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 5.5, w * 0.5) },
        { z0: 1.5, z1: 4.8, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, 7, w * 0.58 * (1 - zt * 0.25)), detail: (c) => scalesDetail(c, 10, w, 'rgba(0,0,0,0.2)', 3) },
        spineRidge(9, 4.8, 6.4, lk.spine, 1, 1.2),
      ] };
    },
    chest(lk) {
      const b = lk.body, t = lk.top;
      return { r: 15, h: 11, style: 'hero', parts: [
        // tucked forelegs
        { z0: 0, z1: 2.4, side: C.shade(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, 2, sg * 6.6, 3.2, 1.6, sg * 0.5); } ,
          detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.dot(c, lk.horn, 4.6, sg * (6 + i * 0.8), 0.35); } },
        { z0: 0.6, z1: 3.4, side: C.shade(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 9.8, 7.4) },
        { z0: 3.4, z1: 8.6, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 10.4, 8.4 * (1 - zt * 0.22)),
          detail: (c) => { scalesDetail(c, 16, 12, 'rgba(0,0,0,0.2)', 5); S.lines(c, C.shade(t, 0.25), 0.5, [6, 3.5, -5, 4.5, 6, -3.5, -5, -4.5]); } },
        // wing roots (shoulders)
        { z0: 5.5, z1: 8.6, side: C.shade(b, -0.1), top: C.shade(t, 0.06), shape: (c) => { for (const sg of [1, -1]) S.ell(c, 1, sg * 5.6, 3.6, 2.4, sg * -0.3); } },
        spineRidge(16, 8.6, 10.8, lk.spine, 3, 1.6),
      ] };
    },
    hips(lk) {
      const b = lk.body, t = lk.top;
      return { r: 14, h: 10, style: 'hero', parts: [
        { z0: 0, z1: 2.6, side: C.shade(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, -3, sg * 6.4, 4, 2, sg * -0.4); },
          detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.dot(c, lk.horn, -6.6, sg * (5.6 + i * 0.9), 0.4); } },
        { z0: 0.6, z1: 3.2, side: C.shade(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 9, 6.4) },
        { z0: 3.2, z1: 7.6, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 9.6, 7.2 * (1 - zt * 0.24)), detail: (c) => scalesDetail(c, 15, 11, 'rgba(0,0,0,0.2)', 4) },
        spineRidge(14, 7.6, 9.6, lk.spine, 2, 1.4),
      ] };
    },
    tail(lk, w, L) {
      L *= 1.55; // long overlapping segments read as one continuous tail
      return { r: Math.max(6, L * 0.8), h: 6, style: 'hero', parts: [
        { z0: 0, z1: 1.2, side: C.shade(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, L * 0.55, w * 0.42) },
        { z0: 1.2, z1: 1.2 + w * 0.42, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, L * 0.58, w * 0.5 * (1 - zt * 0.25)), detail: (c) => scalesDetail(c, L, w, 'rgba(0,0,0,0.2)', 2) },
        spineRidge(L, 1.2 + w * 0.42, 2.2 + w * 0.5, lk.spine, 1, w * 0.2),
      ] };
    },
    tip(lk) {
      const col = lk.tip === 'crystal' ? '#dff6ff' : lk.tip === 'bone' ? lk.bone : lk.tip === 'leaf' ? C.shade(lk.membrane, 0.1) : lk.spine;
      const parts = [{ z0: 0, z1: 2, side: lk.body, top: lk.top, shape: (c) => S.ell(c, 0, 0, 3.4, 1.6) }];
      if (lk.tip === 'spade') parts.push({ z0: 1, z1: 2.6, side: C.shade(col, -0.3), top: col, shape: (c) => S.poly(c, [-6, 0, -2, 4.2, 1.2, 0, -2, -4.2]) });
      else if (lk.tip === 'leaf') parts.push({ z0: 1, z1: 2.2, side: C.shade(col, -0.3), top: col, shape: (c) => S.poly(c, [-8, 0, -4, 3.6, 1, 1.2, 1, -1.2, -4, -3.6]), detail: (c) => S.lines(c, lk.spine, 0.4, [-7, 0, 0.5, 0]) });
      else if (lk.tip === 'crystal') parts.push({ z0: 1, z1: 4.4, side: '#8ac8ec', top: col, flat: true, shape: (c, zt) => { S.poly(c, [-7 + zt * 2, 0, -2, 2 - zt, 1, 0, -2, -2 + zt]); S.poly(c, [-3, 2, -5.5, 4.6 - zt, -1.5, 2.6]); S.poly(c, [-3, -2, -5.5, -4.6 + zt, -1.5, -2.6]); } });
      else parts.push({ z0: 1, z1: 2.6, side: C.shade(col, -0.3), top: col, stroke: 1.2, bevel: false, shape: (c) => { c.moveTo(1, 0); c.lineTo(-7, 0); c.moveTo(-3, 0); c.lineTo(-6, 3); c.moveTo(-3, 0); c.lineTo(-6, -3); } });
      return { r: 10, h: 6, style: 'hero', parts };
    },
    rider(fk, pal) {
      const robe = pal.robe, trim = pal.trim, hat = pal.hat || robe, skin = pal.skin || '#e8c4a0';
      const parts = [
        // saddle with faction cloth
        { z0: 0, z1: 1.4, side: '#3a2414', top: '#6a4428', shape: (c) => S.rrect(c, -5, -3.6, 9, 7.2, 2), detail: (c) => { S.fillPoly(c, pal.cloth || trim, [-5, -3.6, -1, -3.6, -2, 3.6, -5, 3.6]); } },
        // robe / cloak draped back
        { z0: 1.4, z1: 5.5, side: C.shade(robe, -0.25), top: robe, shape: (c, zt) => S.poly(c, [2.4 - zt, 0, 1.2, 2.6 - zt * 0.6, -4.6, 3.2 - zt * 0.8, -5.4, 0, -4.6, -3.2 + zt * 0.8, 1.2, -2.6 + zt * 0.6]),
          detail: (c) => S.lines(c, trim, 0.5, [1.6, 1.8, -4.2, 2.6, 1.6, -1.8, -4.2, -2.6]) },
        // shoulders and arms reaching forward to the staff
        { z0: 5.5, z1: 7, side: C.shade(robe, -0.15), top: C.shade(robe, 0.12), shape: (c) => S.ell(c, 0.3, 0, 1.8, 2.8) },
        // staff (held out to the right, tilted forward)
        { z0: 4, z1: 9.5, side: '#4a3020', top: '#7a5434', stroke: 0.9, bevel: false, shape: (c, zt) => { c.moveTo(-1.5 + zt * 6, 3.2); c.lineTo(-1.4 + zt * 6, 3.3); } },
        // head
        { z0: 7, z1: 8.4, side: C.shade(skin, -0.2), top: skin, shape: (c) => S.circ(c, 0.6, 0, 1.4) },
      ];
      if (fk === 'undead') parts.push({ z0: 8.2, z1: 9.6, side: '#a89a6a', top: '#e8d890', bevel: false, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; c.moveTo(0.6 + Math.cos(a) * 1.5, Math.sin(a) * 1.5); c.lineTo(0.6 + Math.cos(a + 0.3) * (1.2 - zt * 0.3), Math.sin(a + 0.3) * (1.2 - zt * 0.3)); c.lineTo(0.6 + Math.cos(a + 0.6) * 1.5, Math.sin(a + 0.6) * 1.5); } } });
      else if (fk === 'elf') parts.push({ z0: 8.1, z1: 8.9, side: '#c8b060', top: '#f0e0a0', stroke: 0.5, bevel: false, shape: (c) => S.circ(c, 0.6, 0, 1.45) },
        { z0: 6.5, z1: 8, side: '#d8c890', top: '#f4ecc8', shape: (c) => S.poly(c, [0, 1.3, -3.4, 1.6, -3.8, 0, -3.4, -1.6, 0, -1.3]) });
      else if (fk === 'ice') parts.push({ z0: 7.8, z1: 9.6, side: C.shade(hat, -0.2), top: hat, shape: (c, zt) => S.circ(c, 0.4, 0, 1.9 - zt * 0.5) },
        { z0: 8.6, z1: 10.6, side: '#c8c0b0', top: '#f0ece0', stroke: 0.7, bevel: false, shape: (c) => { c.moveTo(0.6, 1.6); c.quadraticCurveTo(-0.5, 3.4, -2.4, 3.2); c.moveTo(0.6, -1.6); c.quadraticCurveTo(-0.5, -3.4, -2.4, -3.2); } });
      else parts.push(
        // the classic pointed wizard's hat
        { z0: 8, z1: 8.6, side: C.shade(hat, -0.3), top: C.shade(hat, 0.05), shape: (c) => S.ell(c, 0.5, 0, 3.1, 2.8), detail: (c) => S.lines(c, trim, 0.4, [0.5, -2.2, 0.5, 2.2]) },
        { z0: 8.6, z1: 13.5, side: C.shade(hat, -0.15), top: hat, shape: (c, zt) => S.circ(c, 0.5 - zt * 2.2, 0, 1.9 * (1 - zt * 0.9) + 0.15) });
      return { r: 9, h: 14, style: 'hero', parts };
    },
  };

  /* chain layout: rest spacing between consecutive segment centres (world
   * units, scale 1) and the sheets used for each node */
  const CHAIN = [
    { k: 'head', d: 0 }, { k: 'neck', d: 10.5, w: 5.6 }, { k: 'neck', d: 6.5, w: 6.4 }, { k: 'chest', d: 10 },
    { k: 'hips', d: 13 }, { k: 'tail', d: 11, w: 8, L: 10 }, { k: 'tail', d: 8, w: 6.6, L: 9 }, { k: 'tail', d: 7.2, w: 5.4, L: 8 },
    { k: 'tail', d: 6.4, w: 4.4, L: 7 }, { k: 'tail', d: 5.8, w: 3.5, L: 6 }, { k: 'tail', d: 5.2, w: 2.8, L: 5.5 }, { k: 'tip', d: 5 },
  ];
  const CHEST = 3, HIPS = 4;

  const rigCache = new Map();
  function rig(fk, scale) {
    scale = scale || 1;
    const key = fk + ':' + scale.toFixed(2);
    let r = rigCache.get(key);
    if (r) return r;
    const lk = LOOKS[fk] || LOOKS.human;
    const F = AS.Forge, D = 32;
    const sc = (m) => { m.scale = (m.scale || 1) * scale; return m; };
    const sheets = CHAIN.map((n, i) => {
      const id = 'drg:' + key + ':' + i;
      if (n.k === 'head') return F.sheet(id, () => sc(Seg.head(lk, false)), D, 1);
      if (n.k === 'neck') return F.sheet(id, () => sc(Seg.neck(lk, n.w)), D, 1);
      if (n.k === 'chest') return F.sheet(id, () => sc(Seg.chest(lk)), D, 1);
      if (n.k === 'hips') return F.sheet(id, () => sc(Seg.hips(lk)), D, 1);
      if (n.k === 'tail') return F.sheet(id, () => sc(Seg.tail(lk, n.w, n.L)), D, 1);
      return F.sheet(id, () => sc(Seg.tip(lk)), D, 1);
    });
    const headOpen = F.sheet('drg:' + key + ':headopen', () => sc(Seg.head(lk, true)), D, 1);
    r = { lk, sheets, headOpen, scale, chain: CHAIN.map((n) => n.d * scale) };
    rigCache.set(key, r);
    return r;
  }
  function riderSheet(fk, pal) {
    return AS.Forge.sheet('rider:' + fk + JSON.stringify(pal), () => Seg.rider(fk, pal), 32, 1);
  }

  /* --------------------------------------------------------------- wings
   * Wing geometry in body space at full spread (x forward, y outward, units):
   * shoulder → elbow → wrist on the leading edge, four fingers from the wrist
   * to the trailing-edge tips, membrane back to the flank. */
  const WING = {
    shoulder: [1, 5], elbow: [-4, 19], wrist: [5, 33],
    tips: [[-1, 52], [-13, 49], [-22, 40], [-27, 26]],
    flank: [-17, 6],
  };
  // fold: 0 = spread, 1 = folded tight along the body
  function wingPoints(span, fold, sweep, out) {
    const f = fold, sw = sweep;
    const lerp2 = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t)];
    const sh = WING.shoulder;
    // folded pose: wrist tucks back and in, fingers lie along the flank
    const elbow = lerp2(WING.elbow, [-6, 10], f), wrist = lerp2(WING.wrist, [-4, 15], f);
    const tips = WING.tips.map((p, i) => lerp2(p, [-22 - i * 4, 12 - i * 1.5], f));
    const P = [sh, elbow, wrist].concat(tips).concat([WING.flank]);
    for (let i = 0; i < P.length; i++) {
      let x = P[i][0], y = P[i][1] * span;
      // sweep swings the outer wing forward (+) or back (-) around the shoulder
      const ang = sw * Math.min(1, (y - sh[1]) / 30);
      const dx = x - sh[0], dy = y - sh[1] * span;
      out[i * 2] = sh[0] + dx * Math.cos(ang) - dy * Math.sin(ang) * 0.4;
      out[i * 2 + 1] = sh[1] * span + dy * Math.cos(ang * 0.5) + dx * Math.sin(ang) * 0.3;
    }
    return out;
  }

  /* --------------------------------------------------------------- draw API */
  const Art = {
    LOOKS, Seg, CHAIN, CHEST, HIPS, rig, riderSheet, wingPoints, WING,
    /* draw a full dragon. st = state prepared by the Dragon entity:
     *  { fk, scale, nodes:[{x,y,z,a}], wing:{ elev, fold, sweep, cup }, bank, open, hurt, ox, oy, alpha, glow } */
    draw(ctx, st, ox, oy, R) {
      const rg = rig(st.fk, st.scale);
      const lk = rg.lk, n = st.nodes;
      const ch = n[CHEST];
      const a = ch.a, ca = Math.cos(a), sa = Math.sin(a);
      // wings first: far wing (northern, smaller screen y) then near wing over it
      const wl = this.wingPoly(st, -1, rg), wr = this.wingPoly(st, 1, rg);
      const farFirst = Math.sin(a) > 0 ? [wl, wr] : [wr, wl];
      // when a wing is raised high it rises above the body in screen space and
      // must draw after it; otherwise wings tuck under the body
      const raised = st.wing.elev > 0.55;
      this.drawWing(ctx, farFirst[0], lk, st, ox, oy);
      if (!raised) this.drawWing(ctx, farFirst[1], lk, st, ox, oy);
      // body: back-to-front along the screen (tail usually behind in y)
      const order = this._order || (this._order = []);
      order.length = 0;
      for (let i = n.length - 1; i >= 0; i--) order.push(i);
      order.sort((i, j) => (n[i].y - n[i].z * 0.02) - (n[j].y - n[j].z * 0.02) || j - i);
      const alpha = st.alpha === undefined ? 1 : st.alpha;
      for (const i of order) {
        const nd = n[i];
        const sh = i === 0 && st.open ? rg.headOpen : rg.sheets[i];
        R.sprite(ctx, sh, nd.a, 0, nd.x, nd.y, nd.z, ox, oy, alpha);
        if (st.hurt > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.6, st.hurt * 3); R.flashSprite(ctx, sh, nd.a, 0, nd.x, nd.y, nd.z, ox, oy, '#ff7a5a'); ctx.restore(); }
        if (i === CHEST && st.rider) this.drawRider(ctx, st, ch, ox, oy, R);
      }
      if (raised) this.drawWing(ctx, farFirst[1], lk, st, ox, oy);
      // eye glow
      const hd = n[0];
      R.light(hd.x + Math.cos(hd.a) * 8 * st.scale, hd.y + Math.sin(hd.a) * 8 * st.scale - hd.z - 4, 10 * st.scale, lk.eye, 0.25);
      return { ca, sa };
    },
    drawRider(ctx, st, ch, ox, oy, R) {
      const sh = st.riderSheet;
      if (!sh) return;
      const s = st.scale;
      const x = ch.x + Math.cos(ch.a) * 1.5 * s, y = ch.y + Math.sin(ch.a) * 1.5 * s, z = ch.z + 7.5 * s;
      R.sprite(ctx, sh, st.aim, 0, x, y, z, ox, oy);
      // staff orb
      const ra = st.aim, sx = x + Math.cos(ra) * 5 + Math.cos(ra + Math.PI / 2) * 3.3, sy = y + Math.sin(ra) * 5 + Math.sin(ra + Math.PI / 2) * 3.3;
      const g = AS.Forge.glow(st.orb || '#9fd8ff', 32), pulse = 3 + Math.sin(st.t * 6) * 0.6 + (st.cast || 0) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(g, sx - ox - pulse, sy - z - 9.5 - oy - pulse, pulse * 2, pulse * 2);
      ctx.restore();
      R.light(sx, sy - z - 9.5, 14 + (st.cast || 0) * 30, st.orb || '#9fd8ff', 0.3 + (st.cast || 0) * 0.4);
      st.staffX = sx; st.staffY = sy - z - 9.5; st.staffZ = z + 9.5;
    },
    /* project one wing to screen points. side: -1 left, +1 right */
    wingPoly(st, side, rg) {
      const s = st.scale, ch = st.nodes[CHEST];
      const a = ch.a, ca = Math.cos(a), sa = Math.sin(a);
      const w = st.wing;
      const pts = this._wp || (this._wp = new Float32Array(16));
      wingPoints(w.span || 1, w.fold, w.sweep, pts);
      const elev = w.elev * 1.25; // radians-ish: + up
      const ce = Math.cos(elev), se = Math.sin(elev);
      const bankK = st.bank * side; // the outside wing rises in a turn
      const out = [];
      for (let i = 0; i < 8; i++) {
        const lx = pts[i * 2] * s, ly = pts[i * 2 + 1] * s;
        const outward = Math.max(0, ly - 4 * s);
        // elevation folds the membrane up around the shoulder line; cup curls the tips
        const cup = (w.cup || 0) * outward * 0.35;
        const yy = 4 * s + outward * ce;
        const zz = (outward * se - bankK * outward * 0.75 + cup) * 0.62;
        const wx = ch.x + lx * ca - yy * side * sa, wy = ch.y + lx * sa + yy * side * ca;
        out.push({ x: wx, y: wy, z: ch.z + 6 * s + zz });
      }
      return { side, pts: out, elev: w.elev, light: U.clamp(0.82 + 0.25 * Math.cos(elev) - bankK * 0.35 - side * 0.1 * Math.cos(a + 0.8), 0.5, 1.15) };
    },
    drawWing(ctx, wp, lk, st, ox, oy) {
      const P = wp.pts;
      const X = (p) => p.x - ox, Y = (p) => p.y - p.z - oy;
      // membrane outline: shoulder, elbow, wrist, tip0..tip3 (scalloped), flank
      ctx.save();
      if (st.alpha !== undefined) ctx.globalAlpha = st.alpha;
      const mem = lk.membrane, k = wp.light;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(X(P[0]), Y(P[0]));
        ctx.lineTo(X(P[1]), Y(P[1]));
        ctx.lineTo(X(P[2]), Y(P[2]));
        ctx.lineTo(X(P[3]), Y(P[3]));
        // scalloped trailing edge between finger tips (curving in toward the wrist)
        for (let i = 3; i < 7; i++) {
          const a = P[i], b = i < 6 ? P[i + 1] : P[7];
          const mx = (a.x + b.x) / 2 * 0.72 + P[2].x * 0.28, my = (a.y - a.z + b.y - b.z) / 2 * 0.72 + (P[2].y - P[2].z) * 0.28;
          ctx.quadraticCurveTo(mx - ox, my - oy, X(b), Y(b));
        }
        ctx.closePath();
      };
      path();
      // lit membrane: brighter toward the leading edge, translucent glow toward the trailing edge
      const gx0 = X(P[2]), gy0 = Y(P[2]), gx1 = X(P[5]), gy1 = Y(P[5]);
      const gr = ctx.createLinearGradient(gx0, gy0, (gx1 + X(P[7])) / 2, (gy1 + Y(P[7])) / 2);
      gr.addColorStop(0, C.str(C.shade(mem, (k - 1) * 0.9 - 0.12)));
      gr.addColorStop(0.55, C.str(C.shade(mem, (k - 1) * 0.9)));
      gr.addColorStop(1, C.str(C.shade(mem, (k - 1) * 0.9 + 0.16), lk.mem === 'frost' ? 0.78 : 0.95));
      ctx.fillStyle = gr; ctx.fill();
      if (lk.mem === 'tattered') {
        // holes torn in the undead membrane
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 3; i++) { const p = P[3 + i], q = P[2]; const hx = U.lerp(p.x, q.x, 0.35) - ox, hy = U.lerp(p.y - p.z, q.y - q.z, 0.35) - oy; ctx.beginPath(); ctx.ellipse(hx, hy, 2.4 * st.scale, 1.5 * st.scale, i, 0, TAU); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
      }
      // veins / panel lines
      ctx.strokeStyle = C.str(C.shade(mem, -0.35), 0.45); ctx.lineWidth = 0.5;
      ctx.beginPath(); for (let i = 3; i < 7; i++) { ctx.moveTo(X(P[2]), Y(P[2])); ctx.quadraticCurveTo((X(P[2]) + X(P[i])) / 2 + 1, (Y(P[2]) + Y(P[i])) / 2 + 1, X(P[i]), Y(P[i])); } ctx.stroke();
      if (lk.mem === 'leaf') { ctx.strokeStyle = 'rgba(255,240,170,0.35)'; ctx.lineWidth = 0.4; ctx.beginPath(); for (let i = 3; i < 7; i++) { const mx = (X(P[i]) + X(P[0])) / 2, my = (Y(P[i]) + Y(P[0])) / 2; ctx.moveTo(mx, my); ctx.lineTo(X(P[i]), Y(P[i])); } ctx.stroke(); }
      if (lk.mem === 'frost') { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 3; i < 7; i++) { ctx.beginPath(); ctx.arc(U.lerp(X(P[i]), X(P[2]), 0.3), U.lerp(Y(P[i]), Y(P[2]), 0.3), 0.6, 0, TAU); ctx.fill(); } }
      // outline
      path();
      ctx.strokeStyle = 'rgba(16,8,10,0.75)'; ctx.lineWidth = 0.9; ctx.stroke();
      // arm and finger bones
      const bone = lk.bone;
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.str(C.shade(bone, -0.4)); ctx.lineWidth = 2.6 * st.scale;
      ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2])); ctx.stroke();
      ctx.strokeStyle = C.str(C.shade(bone, (k - 1) * 0.6 + 0.1)); ctx.lineWidth = 1.5 * st.scale;
      ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2])); ctx.stroke();
      ctx.strokeStyle = C.str(C.shade(bone, (k - 1) * 0.6)); ctx.lineWidth = 0.8 * st.scale;
      ctx.beginPath(); for (let i = 3; i < 7; i++) { ctx.moveTo(X(P[2]), Y(P[2])); ctx.lineTo(X(P[i]), Y(P[i])); } ctx.stroke();
      // wrist claw
      ctx.fillStyle = lk.horn; ctx.beginPath(); ctx.arc(X(P[2]), Y(P[2]), 1 * st.scale, 0, TAU); ctx.fill();
      ctx.restore();
    },
    /* ground shadow of the whole dragon (body silhouettes + wing polygons) */
    drawShadow(ctx, st, ox, oy) {
      const rg = rig(st.fk, st.scale), n = st.nodes;
      for (let i = 0; i < n.length; i++) {
        const nd = n[i], sh = rg.sheets[i];
        const di = AS.Forge.frameIndex(sh, nd.a);
        const off = 2 + nd.z * 0.12;
        ctx.drawImage(sh.shadows[di], nd.x - ox - sh.ax + off + nd.z * 0.15, nd.y - oy - sh.ay + off * 0.5, sh.w, sh.h);
      }
      ctx.fillStyle = '#000';
      for (const side of [-1, 1]) {
        const wp = this.wingPoly(st, side, rg), P = wp.pts;
        ctx.beginPath();
        for (let i = 0; i < P.length; i++) {
          const p = P[i], off = 2 + p.z * 0.12;
          const x = p.x - ox + off + p.z * 0.15, y = p.y - oy + off * 0.5;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      }
    },
  };
  AS.DragonArt = Art;
  AS.Data = AS.Data || {};
  AS.Data.dragonLooks = LOOKS;
})(window.AS);
