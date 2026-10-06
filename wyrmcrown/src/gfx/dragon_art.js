/* WYRMCROWN — dragon and rider art.
 * Four different kinds of dragon, not four colours of one:
 *  - Aldermere's EMBER WYRM: the classic western war-dragon, heavy and regal,
 *    crimson scales and gold belly plates, swept horns, a royal blue-and-gold
 *    caparison under the saddle, broad bat wings, a spade tail.
 *  - Sylvara's GLADE SERPENT: long, slender and graceful, stag antlers hung
 *    with leaves, trailing whiskers, gold filigree and glowing spots, a crest
 *    of leaf fronds, wings of layered leaf-feathers, a fan of fronds at the tail.
 *  - Hrimgard's WINTER TYRANT: a massive crystalline drake, plated like a
 *    glacier, a crown of ice-crystal horns and spires along its back,
 *    faceted shard-glass wings that glint, a club of crystals on the tail.
 *  - Morgrave's UNBURIED: a bone dragon, a skull with burning green sockets,
 *    a ribcage with ghost-fire inside, a spine of vertebrae down to a bone
 *    blade, finger bones with rotten membrane torn to rags.
 * Each is a living rig: body segments are forged stacked models (32 headings)
 * on a spine chain whose proportions differ per kind, so the neck bends into
 * turns and the tail trails with follow-through; the wings are drawn every
 * frame through a real stroke (elevation, fold, sweep, bank) in each kind's
 * own way; the wizard rider sits in the saddle and turns to face the aim. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;

  /* ------------------------------------------------------------------ looks */
  const LOOKS = {
    human: { body: '#a3241c', top: '#cc3a28', belly: '#e8b05a', horn: '#efe2c4', spine: '#5a120c', membrane: '#9e2a1c', bone: '#5e1610', eye: '#ffd23a', gold: '#f0c048', cloth: '#22408a', cloth2: '#3a62c0', breath: ['#fff2b0', '#ffb030', '#ff5a10'], kind: 'wyrm' },
    elf: { body: '#1c7448', top: '#34a464', belly: '#dbe9a8', horn: '#f2ead0', spine: '#d6b452', membrane: '#3fae6e', leaf: '#6fd08a', leaf2: '#e0d070', bone: '#f0e2b0', eye: '#a8fff0', glow: '#9affe0', breath: ['#f0fff0', '#7affc0', '#20c080'], kind: 'serpent' },
    ice: { body: '#3e5f8a', top: '#6d95c2', belly: '#d4e8f8', horn: '#ffffff', spine: '#d8f0ff', membrane: '#9ad4f4', bone: '#e8f8ff', eye: '#e8ffff', crystal: '#f2fdff', crystalSide: '#7fd4ff', breath: ['#ffffff', '#bfefff', '#5ab8ff'], kind: 'tyrant' },
    undead: { body: '#3a2e44', top: '#5a4a66', belly: '#2a2030', horn: '#5a5260', spine: '#ece4cc', membrane: '#4a3a58', bone: '#e6dcc2', bone2: '#b8ac90', eye: '#93ff6a', glow: '#8cff5a', breath: ['#f0ffe0', '#a8ff6a', '#5a2a8a'], kind: 'bones' },
  };

  /* --------------------------------------------- chain proportions per kind
   * rest spacing between consecutive segment centres (world units, scale 1);
   * every kind has 12 nodes with the chest at 3 and the hips at 4 */
  const CHAINS = {
    human: [
      { k: 'head', d: 0 }, { k: 'neck', d: 10.5, w: 6 }, { k: 'neck', d: 6.5, w: 6.8 }, { k: 'chest', d: 10 },
      { k: 'hips', d: 13 }, { k: 'tail', d: 11, w: 8.2, L: 10 }, { k: 'tail', d: 8, w: 6.8, L: 9 }, { k: 'tail', d: 7.2, w: 5.6, L: 8 },
      { k: 'tail', d: 6.4, w: 4.6, L: 7 }, { k: 'tail', d: 5.8, w: 3.7, L: 6 }, { k: 'tail', d: 5.2, w: 3, L: 5.5 }, { k: 'tip', d: 5.5 },
    ],
    elf: [
      { k: 'head', d: 0 }, { k: 'neck', d: 13, w: 4.4 }, { k: 'neck', d: 9, w: 5 }, { k: 'chest', d: 11 },
      { k: 'hips', d: 13 }, { k: 'tail', d: 11, w: 6, L: 10 }, { k: 'tail', d: 9.2, w: 5, L: 9.5 }, { k: 'tail', d: 8.6, w: 4.2, L: 9 },
      { k: 'tail', d: 8, w: 3.4, L: 8.5 }, { k: 'tail', d: 7.4, w: 2.7, L: 8 }, { k: 'tail', d: 6.8, w: 2.1, L: 7.5 }, { k: 'tip', d: 7 },
    ],
    ice: [
      { k: 'head', d: 0 }, { k: 'neck', d: 9.5, w: 7.8 }, { k: 'neck', d: 6.5, w: 8.8 }, { k: 'chest', d: 11 },
      { k: 'hips', d: 14 }, { k: 'tail', d: 11, w: 10, L: 10 }, { k: 'tail', d: 8, w: 8.6, L: 9 }, { k: 'tail', d: 7, w: 7.2, L: 8 },
      { k: 'tail', d: 6.2, w: 6, L: 7 }, { k: 'tail', d: 5.6, w: 5, L: 6 }, { k: 'tail', d: 5, w: 4.2, L: 5.5 }, { k: 'tip', d: 6 },
    ],
    undead: [
      { k: 'head', d: 0 }, { k: 'neck', d: 12, w: 4.6 }, { k: 'neck', d: 8.4, w: 5 }, { k: 'chest', d: 10.5 },
      { k: 'hips', d: 13 }, { k: 'tail', d: 10.5, w: 5, L: 9 }, { k: 'tail', d: 8.4, w: 4.4, L: 8.5 }, { k: 'tail', d: 7.8, w: 3.8, L: 8 },
      { k: 'tail', d: 7.2, w: 3.2, L: 7.5 }, { k: 'tail', d: 6.6, w: 2.6, L: 7 }, { k: 'tail', d: 6, w: 2.1, L: 6.5 }, { k: 'tip', d: 6.5 },
    ],
  };
  const CHAIN = CHAINS.human;
  const CHEST = 3, HIPS = 4;
  const RIDER_Z = { human: 8.6, elf: 6.8, ice: 10.2, undead: 7.4 };

  /* ------------------------------------------------------------ helpers */
  const sh = (c, k) => C.shade(c, k);
  function scalesDetail(c, L, W, col, n) {
    c.save(); c.strokeStyle = col; c.lineWidth = 0.35; c.beginPath();
    for (let i = 0; i < n; i++) { const x = L / 2 - (i + 0.5) * (L / n); c.moveTo(x + 1, -W * 0.36); c.quadraticCurveTo(x - 1, 0, x + 1, W * 0.36); }
    c.stroke(); c.restore();
  }
  // a row of triangular dorsal spikes along x, rising from z0 to z1
  function spikes(L, z0, z1, side, top, n, w, x0) {
    return { z0, z1, side, top, bevel: false, shape: (c, zt) => {
      for (let i = 0; i < n; i++) { const x = (x0 || 0) + L / 2 - (i + 0.5) * (L / n), s = (w || 1.3) * (1 - zt * 0.85); c.moveTo(x + s * 1.1, 0); c.lineTo(x - s * 1.9, s * 0.6); c.lineTo(x - s * 1.5, 0); c.lineTo(x - s * 1.9, -s * 0.6); c.closePath(); }
    } };
  }
  // a faceted crystal shard (translucent-looking) standing up from z0
  function crystal(lk, x, y, z0, hgt, w, lean) {
    return { z0, z1: z0 + hgt, side: lk.crystalSide, top: lk.crystal, bevel: false, shape: (c, zt) => {
      const k = zt < 0.55 ? 1 - zt * 0.35 : (1 - zt) * 1.8, ox = (lean || 0) * zt * hgt * 0.35;
      S.poly(c, [x + ox + w * k, y, x + ox + w * 0.2 * k, y + w * 0.75 * k, x + ox - w * k, y, x + ox + w * 0.2 * k, y - w * 0.75 * k]);
    }, detail: (c) => S.lines(c, 'rgba(255,255,255,0.7)', 0.3, [x - w * 0.5, y, x + w * 0.5, y]) };
  }
  // a leaf with a midrib, pointing from (x0,y0) to (x1,y1)
  function leafPath(c, x0, y0, x1, y1, wk) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w = L * (wk || 0.32);
    c.moveTo(x0, y0);
    c.quadraticCurveTo(x0 + dx * 0.45 + nx * w, y0 + dy * 0.45 + ny * w, x1, y1);
    c.quadraticCurveTo(x0 + dx * 0.45 - nx * w, y0 + dy * 0.45 - ny * w, x0, y0);
  }
  // a vertebra: a bone disc with a spinous process, seen from above
  function vertebraParts(lk, x, w, z0) {
    return [
      { z0, z1: z0 + w * 0.55, side: sh(lk.bone, -0.35), top: lk.bone, shape: (c, zt) => S.ell(c, x, 0, w * 0.42 * (1 - zt * 0.2), w * 0.5 * (1 - zt * 0.15)) },
      { z0: z0 + w * 0.5, z1: z0 + w * 0.95, side: sh(lk.bone, -0.25), top: sh(lk.bone, 0.08), bevel: false, shape: (c, zt) => S.poly(c, [x + w * 0.18, 0, x - w * 0.42 * (1 - zt * 0.4), w * 0.1, x - w * 0.42 * (1 - zt * 0.4), -w * 0.1]) },
      { z0: z0 + w * 0.08, z1: z0 + w * 0.32, side: sh(lk.bone, -0.4), top: sh(lk.bone, -0.12), bevel: false, shape: (c) => { for (const sg of [1, -1]) S.poly(c, [x + w * 0.1, sg * w * 0.35, x - w * 0.1, sg * w * 0.82, x - w * 0.22, sg * w * 0.38]); } },
    ];
  }

  /* ================================================== ALDERMERE · EMBER WYRM */
  const Wyrm = {
    head(lk, open) {
      const b = lk.body, t = lk.top, belly = lk.belly, horn = lk.horn;
      const parts = [], jd = open ? 1.7 : 0;
      parts.push({ z0: 0, z1: 2.3, side: sh(belly, -0.3), top: belly, shape: (c) => S.poly(c, S.sym([open ? 14.5 : 15.6, 0, 12, 2.6 + jd * 0.4, 6, 3.9, 0, 4.1, -2.4, 0])),
        detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 4; i++) S.dot(c, horn, 3 + i * 2.6, sg * (3.6 - i * 0.25), 0.45); } });
      if (open) parts.push({ z0: 2.3, z1: 2.3, side: '#5a0a0a', top: '#8a1a14', flat: true, shape: (c) => S.poly(c, S.sym([14, 0, 11, 2.3, 6, 3, 2, 2.6, 1, 0])), detail: (c) => {
        c.fillStyle = '#fff4e0';
        for (let i = 0; i < 5; i++) for (const sg of [1, -1]) { c.beginPath(); c.moveTo(13 - i * 2.2, sg * (2 + i * 0.15)); c.lineTo(12.2 - i * 2.2, sg * (1.2 + i * 0.15)); c.lineTo(11.6 - i * 2.2, sg * (2.1 + i * 0.15)); c.fill(); }
        S.dot(c, lk.breath[1], 9, 0, 1.5);
      } });
      parts.push({ z0: 2.3 + jd, z1: 6 + jd, side: b, top: t, shape: (c, zt) => S.poly(c, S.sym([17.2 - zt * 0.7, 0, 15, 2.5, 9.5, 3.6, 3.5, 4.9 - zt * 0.4, -1.5, 4.3, -3.6, 0])),
        detail: (c) => {
          S.lines(c, 'rgba(0,0,0,0.35)', 0.4, [14.5, 1.3, 10, 2.4, 14.5, -1.3, 10, -2.4]);
          // ember-lit nostrils
          S.dot(c, '#ff8a2a', 16, 1.1, 0.6); S.dot(c, '#ff8a2a', 16, -1.1, 0.6); S.dot(c, '#ffe08a', 16.1, 1.1, 0.25); S.dot(c, '#ffe08a', 16.1, -1.1, 0.25);
          S.lines(c, sh(t, 0.35), 0.7, [10, 2.9, 5, 4, 10, -2.9, 5, -4]);
          scalesDetail(c, 8, 7, 'rgba(0,0,0,0.2)', 3);
        } });
      // a nose horn
      parts.push({ z0: 5.2 + jd, z1: 7.4 + jd, side: sh(horn, -0.3), top: horn, bevel: false, shape: (c, zt) => S.poly(c, [14.2 + zt * 0.6, 0, 12.2, 0.8 * (1 - zt), 12.2, -0.8 * (1 - zt)]) });
      parts.push({ z0: 5 + jd, z1: 5.8 + jd, side: lk.eye, top: lk.eye, flat: true, bevel: false, shape: (c) => { S.ell(c, 8, 3.3, 1.3, 0.7, 0.3); S.ell(c, 8, -3.3, 1.3, 0.7, -0.3); } });
      // great swept horns, and a lower pair along the jaw
      const hz = 5.4 + jd;
      parts.push({ z0: hz, z1: hz + 3.2, side: sh(horn, -0.4), top: horn, stroke: 1.9, bevel: false, shape: (c, zt) => { for (const sg of [1, -1]) { c.moveTo(3.5, sg * 2.8); c.bezierCurveTo(-1, sg * 5, -6, sg * 5.6, -11 + zt * 2.5, sg * (4.4 + zt * 1.4)); } } });
      parts.push({ z0: 2.6 + jd, z1: 4.4 + jd, side: sh(horn, -0.4), top: horn, stroke: 1.2, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(0.5, sg * 4.2); c.quadraticCurveTo(-3.5, sg * 6.4, -7, sg * 6.8); } } });
      // a gold ring on each horn: Aldermere's crown-dragon
      parts.push({ z0: hz + 0.6, z1: hz + 1.6, side: sh(lk.gold, -0.3), top: lk.gold, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.ell(c, -2.8, sg * 4.75, 0.9, 0.75); } });
      parts.push({ z0: 2.6 + jd, z1: 4.4 + jd, side: sh(lk.spine, -0.2), top: lk.spine, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.poly(c, [2, sg * 4, -2.5, sg * 6.6, -3.5, sg * 4.6, -5.5, sg * 6, -4.5, sg * 3.6]); } });
      return { r: 15, h: 11, style: 'hero', parts, scale: 1.22 };
    },
    neck(lk, w, i) {
      const parts = [
        { z0: 0, z1: 1.5, side: sh(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 5.6, w * 0.5), detail: (c) => S.lines(c, sh(lk.belly, -0.35), 0.4, [-2, -w * 0.4, -2, w * 0.4, 2, -w * 0.4, 2, w * 0.4]) },
        { z0: 1.5, z1: 5, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, 7, w * 0.6 * (1 - zt * 0.25)), detail: (c) => scalesDetail(c, 10, w, 'rgba(0,0,0,0.22)', 3) },
        spikes(9, 5, 7.2, sh(lk.spine, -0.2), sh(lk.spine, 0.2), 1, 1.5),
      ];
      // a jewelled gold collar where the neck meets the shoulders
      if (i === 2) parts.push({ z0: 1.2, z1: 5.4, side: sh(lk.gold, -0.35), top: lk.gold, shape: (c, zt) => { S.ell(c, -2.4, 0, 2.2, w * 0.66 * (1 - zt * 0.2)); S.ell(c, -2.4, 0, 1.2, w * 0.45); }, detail: (c) => { S.dot(c, '#3a7aff', -2.4, w * 0.55, 0.6); S.dot(c, '#3a7aff', -2.4, -w * 0.55, 0.6); S.dot(c, '#ff3a3a', -0.6, 0, 0.6); } });
      return { r: 9, h: 8, style: 'hero', parts };
    },
    chest(lk) {
      const b = lk.body, t = lk.top;
      return { r: 17, h: 12, style: 'hero', parts: [
        { z0: 0, z1: 2.6, side: sh(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, 2.4, sg * 7, 3.4, 1.7, sg * 0.5); },
          detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.dot(c, lk.horn, 5.2, sg * (6.3 + i * 0.85), 0.42); } },
        { z0: 0.6, z1: 3.4, side: sh(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 10, 7.6), detail: (c) => S.lines(c, sh(lk.belly, -0.35), 0.45, [6, -6, 6, 6, 2, -7, 2, 7, -2, -7, -2, 7, -6, -6, -6, 6]) },
        { z0: 3.4, z1: 8.8, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 10.8, 8.8 * (1 - zt * 0.2)), detail: (c) => scalesDetail(c, 17, 13, 'rgba(0,0,0,0.22)', 5) },
        { z0: 5.5, z1: 8.8, side: sh(b, -0.1), top: sh(t, 0.06), shape: (c) => { for (const sg of [1, -1]) S.ell(c, 1, sg * 6, 3.8, 2.6, sg * -0.3); } },
        // gold chest plate (peytral) across the breast
        { z0: 2.6, z1: 7, side: sh(lk.gold, -0.35), top: lk.gold, shape: (c, zt) => S.poly(c, [11.6 - zt, 0, 10.4, 4.6, 8, 6.4, 7, 4.8, 8.6, 0, 7, -4.8, 8, -6.4, 10.4, -4.6]), detail: (c) => { S.dot(c, '#c81e1e', 10.2, 0, 0.9); S.lines(c, sh(lk.gold, -0.3), 0.35, [9.6, 3.6, 9.6, -3.6]); } },
        // the royal caparison: blue cloth bordered in gold, with Aldermere's crest
        { z0: 8.6, z1: 9.6, side: sh(lk.cloth, -0.3), top: lk.cloth, bevel: false, shape: (c) => S.poly(c, [5, -9.4, 5, 9.4, -7, 9.8, -8.4, 7, -8.4, -7, -7, -9.8]),
          detail: (c) => {
            c.save(); c.strokeStyle = lk.gold; c.lineWidth = 0.9; c.beginPath(); S.poly(c, [4.4, -8.8, 4.4, 8.8, -6.7, 9.2, -7.8, 6.6, -7.8, -6.6, -6.7, -9.2]); c.stroke(); c.restore();
            S.lines(c, lk.cloth2, 0.6, [3, -8.2, 3, 8.2, -5.6, -8.2, -5.6, 8.2]);
            for (const sg of [1, -1]) { S.fillPoly(c, lk.gold, [-1.4, sg * 6.4, 0.4, sg * 5.2, 2, sg * 6.4, 1.4, sg * 7.8, -0.8, sg * 7.8]); S.dot(c, '#c81e1e', 0.3, sg * 6.6, 0.55); }
            // tassels at the hem
            for (let i = -3; i <= 3; i++) S.dot(c, lk.gold, -8.2, i * 2.4, 0.45);
          } },
        spikes(8, 9.6, 11.6, sh(lk.spine, -0.2), sh(lk.spine, 0.25), 1, 1.6, -7),
      ] };
    },
    hips(lk) {
      const b = lk.body, t = lk.top;
      return { r: 15, h: 11, style: 'hero', parts: [
        { z0: 0, z1: 2.8, side: sh(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, -3, sg * 6.8, 4.2, 2.1, sg * -0.4); },
          detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.dot(c, lk.horn, -7, sg * (6 + i * 0.9), 0.42); } },
        { z0: 0.6, z1: 3.2, side: sh(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 9.2, 6.6) },
        { z0: 3.2, z1: 7.8, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 9.8, 7.4 * (1 - zt * 0.24)), detail: (c) => scalesDetail(c, 15, 11, 'rgba(0,0,0,0.22)', 4) },
        // the caparison's back flap
        { z0: 7.6, z1: 8.4, side: sh(lk.cloth, -0.3), top: lk.cloth, bevel: false, shape: (c) => S.poly(c, [8.5, -7.6, 8.5, 7.6, 3, 6.4, 1.5, 0, 3, -6.4]), detail: (c) => { c.save(); c.strokeStyle = lk.gold; c.lineWidth = 0.8; c.beginPath(); S.poly(c, [8, -7, 8, 7, 3.4, 5.9, 2.1, 0, 3.4, -5.9]); c.stroke(); c.restore(); } },
        spikes(10, 7.8, 10, sh(lk.spine, -0.2), sh(lk.spine, 0.25), 2, 1.5, -3),
      ] };
    },
    tail(lk, w, L) {
      L *= 1.55;
      return { r: Math.max(6, L * 0.8), h: 7, style: 'hero', parts: [
        { z0: 0, z1: 1.2, side: sh(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, L * 0.55, w * 0.42) },
        { z0: 1.2, z1: 1.2 + w * 0.45, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, L * 0.58, w * 0.52 * (1 - zt * 0.25)), detail: (c) => scalesDetail(c, L, w, 'rgba(0,0,0,0.22)', 2) },
        spikes(L, 1.2 + w * 0.45, 2.6 + w * 0.6, sh(lk.spine, -0.2), sh(lk.spine, 0.25), 2, w * 0.24),
      ] };
    },
    tip(lk) {
      return { r: 11, h: 6, style: 'hero', parts: [
        { z0: 0, z1: 2, side: lk.body, top: lk.top, shape: (c) => S.ell(c, 0, 0, 3.6, 1.6) },
        { z0: 0.8, z1: 2.8, side: sh(lk.spine, -0.1), top: sh(lk.top, -0.1), shape: (c, zt) => S.poly(c, [-8 + zt, 0, -3, 5 - zt, 1.4, 0, -3, -5 + zt]), detail: (c) => { S.lines(c, lk.gold, 0.5, [-7, 0, 0.6, 0]); S.lines(c, 'rgba(0,0,0,0.3)', 0.35, [-3, 3.6, -5.5, 0, -3, -3.6]); } },
      ] };
    },
  };

  /* ================================================ SYLVARA · GLADE SERPENT */
  const Serpent = {
    head(lk, open) {
      const b = lk.body, t = lk.top, belly = lk.belly, horn = lk.horn;
      const parts = [], jd = open ? 1.4 : 0;
      parts.push({ z0: 0, z1: 1.8, side: sh(belly, -0.3), top: belly, shape: (c) => S.poly(c, S.sym([open ? 16.5 : 18, 0, 14, 1.8 + jd * 0.3, 7, 2.8, 0, 3, -2, 0])) });
      if (open) parts.push({ z0: 1.8, z1: 1.8, side: '#0a3a24', top: '#1a5a3a', flat: true, shape: (c) => S.poly(c, S.sym([16, 0, 12, 1.6, 6, 2.2, 1, 0])), detail: (c) => S.dot(c, lk.breath[1], 10, 0, 1.3) });
      parts.push({ z0: 1.8 + jd, z1: 4.6 + jd, side: b, top: t, shape: (c, zt) => S.poly(c, S.sym([19.5 - zt * 0.8, 0, 16, 1.7, 10, 2.5, 4, 3.4 - zt * 0.3, -1, 3, -3, 0])),
        detail: (c) => {
          // gold filigree swirls along the snout and brow
          c.save(); c.strokeStyle = lk.spine; c.lineWidth = 0.35; c.beginPath();
          for (const sg of [1, -1]) { c.moveTo(16, sg * 0.6); c.bezierCurveTo(12, sg * 2, 8, sg * 0.6, 5, sg * 2.2); c.bezierCurveTo(3, sg * 3, 1, sg * 1.6, -1.5, sg * 2.2); }
          c.stroke(); c.restore();
          S.dot(c, '#0a2a1a', 18.4, 0.8, 0.35); S.dot(c, '#0a2a1a', 18.4, -0.8, 0.35);
        } });
      parts.push({ z0: 3.8 + jd, z1: 4.6 + jd, side: lk.eye, top: lk.eye, flat: true, bevel: false, shape: (c) => { S.ell(c, 8.4, 2.3, 1.6, 0.55, 0.25); S.ell(c, 8.4, -2.3, 1.6, 0.55, -0.25); } });
      // trailing whiskers (barbels) from the snout
      parts.push({ z0: 2.6 + jd, z1: 3.2 + jd, side: sh(lk.spine, -0.2), top: lk.spine, stroke: 0.55, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(16, sg * 1.6); c.bezierCurveTo(12, sg * 5, 4, sg * 6.5, -6, sg * 4.5); } } });
      // stag antlers, tines hung with small leaves
      const hz = 4.2 + jd;
      parts.push({ z0: hz, z1: hz + 4, side: sh(horn, -0.35), top: horn, stroke: 1.15, bevel: false, shape: (c) => {
        for (const sg of [1, -1]) {
          c.moveTo(2.5, sg * 2); c.bezierCurveTo(-0.5, sg * 4.5, -4, sg * 6.5, -9, sg * 8.5);
          c.moveTo(-0.6, sg * 4); c.lineTo(1.6, sg * 6.6);
          c.moveTo(-3.6, sg * 6); c.lineTo(-2.6, sg * 9.4);
          c.moveTo(-6.6, sg * 7.5); c.lineTo(-7.2, sg * 10.8);
          c.moveTo(-9, sg * 8.5); c.lineTo(-12, sg * 8.2);
        }
      } });
      parts.push({ z0: hz + 3.4, z1: hz + 4.4, side: sh(lk.leaf, -0.25), top: lk.leaf, bevel: false, shape: (c) => { for (const sg of [1, -1]) { leafPath(c, 1.6, sg * 6.6, 3, sg * 8.2, 0.4); leafPath(c, -2.6, sg * 9.4, -1.8, sg * 11.2, 0.4); leafPath(c, -7.2, sg * 10.8, -6.8, sg * 12.6, 0.4); leafPath(c, -12, sg * 8.2, -13.8, sg * 8.8, 0.4); } } });
      // leaf-frond ears
      parts.push({ z0: 3 + jd, z1: 4.2 + jd, side: sh(lk.leaf, -0.3), top: lk.leaf, bevel: false, shape: (c) => { for (const sg of [1, -1]) leafPath(c, 0, sg * 2.6, -5.5, sg * 5.4, 0.36); } });
      return { r: 18, h: 10, style: 'hero', parts, scale: 1.16 };
    },
    neck(lk, w) {
      return { r: 9, h: 7, style: 'hero', parts: [
        { z0: 0, z1: 1.3, side: sh(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 6.4, w * 0.48) },
        { z0: 1.3, z1: 4, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, 7.8, w * 0.56 * (1 - zt * 0.25)),
          detail: (c) => { c.save(); c.strokeStyle = lk.spine; c.lineWidth = 0.3; c.beginPath(); for (const sg of [1, -1]) { c.moveTo(6, sg * w * 0.2); c.bezierCurveTo(2, sg * w * 0.45, -2, sg * w * 0.1, -6, sg * w * 0.35); } c.stroke(); c.restore(); } },
        { z0: 3.2, z1: 3.9, side: lk.glow, top: lk.glow, flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) { S.circ(c, 2, sg * w * 0.42, 0.45); S.circ(c, -2.5, sg * w * 0.4, 0.4); } } },
        { z0: 3.8, z1: 6.4, side: sh(lk.leaf, -0.3), top: lk.leaf, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.5; leafPath(c, 3, 0, -5 * k, 0.01, 0.32 * k); } },
      ] };
    },
    chest(lk) {
      const b = lk.body, t = lk.top;
      return { r: 15, h: 10, style: 'hero', parts: [
        { z0: 0, z1: 2, side: sh(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, 2.6, sg * 5.8, 3.4, 1.1, sg * 0.6); } },
        { z0: 0.5, z1: 2.8, side: sh(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 9.6, 5.8) },
        { z0: 2.8, z1: 7, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 10.4, 6.6 * (1 - zt * 0.22)),
          detail: (c) => {
            c.save(); c.strokeStyle = lk.spine; c.lineWidth = 0.35; c.beginPath();
            for (const sg of [1, -1]) { c.moveTo(9, sg * 1); c.bezierCurveTo(5, sg * 4.6, 1, sg * 1.2, -2, sg * 4); c.bezierCurveTo(-4, sg * 5.2, -7, sg * 2, -9, sg * 3.6); c.moveTo(4, sg * 3.2); c.arc(3.2, sg * 3.2, 0.8, 0, TAU); }
            c.stroke(); c.restore();
          } },
        { z0: 6, z1: 6.7, side: lk.glow, top: lk.glow, flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 4; i++) S.circ(c, 6 - i * 4, sg * (4.4 - Math.abs(i - 1.5) * 0.5), 0.5); } },
        { z0: 4.5, z1: 7, side: sh(b, -0.1), top: sh(t, 0.08), shape: (c) => { for (const sg of [1, -1]) S.ell(c, 1, sg * 4.6, 3.4, 2, sg * -0.3); } },
        // a crest of leaf fronds down the spine
        { z0: 6.8, z1: 9.6, side: sh(lk.leaf, -0.3), top: lk.leaf, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.45; for (let i = 0; i < 3; i++) leafPath(c, 7 - i * 5.5, 0, 2.5 - i * 5.5 - 4 * k, 0.01, 0.34 * k); } },
        { z0: 9.2, z1: 9.6, side: lk.leaf2, top: lk.leaf2, flat: true, bevel: false, shape: (c) => { for (let i = 0; i < 3; i++) S.circ(c, 0.5 - i * 5.5, 0, 0.5); } },
      ] };
    },
    hips(lk) {
      const b = lk.body, t = lk.top;
      return { r: 13, h: 9, style: 'hero', parts: [
        { z0: 0, z1: 2, side: sh(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, -3, sg * 5.6, 3.6, 1.3, sg * -0.5); } },
        { z0: 0.5, z1: 2.6, side: sh(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 8.6, 5) },
        { z0: 2.6, z1: 6.2, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 9.2, 5.8 * (1 - zt * 0.24)),
          detail: (c) => { c.save(); c.strokeStyle = lk.spine; c.lineWidth = 0.35; c.beginPath(); for (const sg of [1, -1]) { c.moveTo(8, sg * 1.5); c.bezierCurveTo(3, sg * 4.6, -2, sg * 1, -8, sg * 3); } c.stroke(); c.restore(); } },
        { z0: 5.4, z1: 6, side: lk.glow, top: lk.glow, flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.circ(c, 4 - i * 4, sg * 3.6, 0.45); } },
        { z0: 6, z1: 8.4, side: sh(lk.leaf, -0.3), top: lk.leaf, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.45; for (let i = 0; i < 2; i++) leafPath(c, 6 - i * 6, 0, 1.5 - i * 6 - 4 * k, 0.01, 0.32 * k); } },
      ] };
    },
    tail(lk, w, L) {
      L *= 1.5;
      return { r: Math.max(6, L * 0.8), h: 6, style: 'hero', parts: [
        { z0: 0, z1: 1, side: sh(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, L * 0.55, w * 0.4) },
        { z0: 1, z1: 1 + w * 0.4, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, L * 0.58, w * 0.48 * (1 - zt * 0.25)),
          detail: (c) => { c.save(); c.strokeStyle = lk.spine; c.lineWidth = 0.3; c.beginPath(); c.moveTo(L * 0.45, w * 0.15); c.bezierCurveTo(L * 0.1, w * 0.35, -L * 0.1, -w * 0.3, -L * 0.45, -w * 0.15); c.stroke(); c.restore(); } },
        { z0: 1 + w * 0.36, z1: 1.6 + w * 0.4, side: lk.glow, top: lk.glow, flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.circ(c, 0, sg * w * 0.32, Math.max(0.3, w * 0.07)); } },
        { z0: 1 + w * 0.4, z1: 2.4 + w * 0.65, side: sh(lk.leaf, -0.3), top: lk.leaf, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.5; leafPath(c, L * 0.3, 0, L * 0.3 - L * 0.55 * k, 0.01, 0.3 * k); } },
      ] };
    },
    tip(lk) {
      return { r: 13, h: 6, style: 'hero', parts: [
        { z0: 0, z1: 1.6, side: lk.body, top: lk.top, shape: (c) => S.ell(c, 0, 0, 3, 1.2) },
        // a fan of fronds, gold at the edges
        { z0: 0.6, z1: 2.2, side: sh(lk.leaf, -0.3), top: lk.leaf, bevel: false, shape: (c) => { for (let i = -2; i <= 2; i++) { const a = Math.PI + i * 0.38; leafPath(c, 0, 0, Math.cos(a) * (11 - Math.abs(i) * 1.4), Math.sin(a) * (11 - Math.abs(i) * 1.4), 0.3); } },
          detail: (c) => { c.save(); c.strokeStyle = lk.leaf2; c.lineWidth = 0.4; c.beginPath(); for (let i = -2; i <= 2; i++) { const a = Math.PI + i * 0.38, r = 11 - Math.abs(i) * 1.4; c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); } c.stroke(); c.restore(); } },
      ] };
    },
  };

  /* ================================================ HRIMGARD · WINTER TYRANT */
  const Tyrant = {
    head(lk, open) {
      const b = lk.body, t = lk.top, belly = lk.belly;
      const parts = [], jd = open ? 1.8 : 0;
      parts.push({ z0: 0, z1: 2.6, side: sh(belly, -0.3), top: belly, shape: (c) => S.poly(c, S.sym([open ? 13.5 : 14.6, 0, 13, 3.2 + jd * 0.4, 7, 4.8, 0, 5.2, -2.6, 0])) });
      // icicle beard: crystal spikes along the jaw
      parts.push({ z0: 0.4, z1: 2.4, side: lk.crystalSide, top: lk.crystal, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.8; for (const sg of [1, -1]) for (let i = 0; i < 4; i++) { const x = 11 - i * 3.2, y = sg * (3.6 + i * 0.5); S.poly(c, [x + 0.8 * k, y, x - 0.6, y + sg * (2.2 + i * 0.4) * k, x - 1.2 * k, y]); } } });
      if (open) parts.push({ z0: 2.6, z1: 2.6, side: '#1a3a5a', top: '#2a5a8a', flat: true, shape: (c) => S.poly(c, S.sym([13, 0, 11, 3, 6, 3.8, 1, 0])), detail: (c) => { c.fillStyle = '#f4fcff'; for (let i = 0; i < 4; i++) for (const sg of [1, -1]) { c.beginPath(); c.moveTo(12.4 - i * 2.4, sg * (2.6 + i * 0.2)); c.lineTo(11.6 - i * 2.4, sg * (1.6 + i * 0.2)); c.lineTo(10.8 - i * 2.4, sg * (2.7 + i * 0.2)); c.fill(); } S.dot(c, lk.breath[1], 8, 0, 1.6); } });
      parts.push({ z0: 2.6 + jd, z1: 6.6 + jd, side: b, top: t, shape: (c, zt) => S.poly(c, S.sym([15.6 - zt * 0.6, 0, 14.6, 3.2, 10, 4.8 - zt * 0.2, 4, 6 - zt * 0.4, -2, 5.6, -4.2, 0])),
        detail: (c) => {
          // armour plates
          S.lines(c, 'rgba(10,30,60,0.4)', 0.45, [13, -2.6, 13, 2.6, 8.6, -4.2, 8.6, 4.2, 3.6, -5.2, 3.6, 5.2, 13, 0, 3.6, 0]);
          S.lines(c, 'rgba(255,255,255,0.55)', 0.5, [12, 3, 5, 5, 12, -3, 5, -5]); // frosted brow
          S.dot(c, '#0a1a2a', 14.8, 1.4, 0.5); S.dot(c, '#0a1a2a', 14.8, -1.4, 0.5);
        } });
      parts.push({ z0: 5.6 + jd, z1: 6.4 + jd, side: lk.eye, top: lk.eye, flat: true, bevel: false, shape: (c) => { S.ell(c, 8.6, 3.8, 1.2, 0.8, 0.2); S.ell(c, 8.6, -3.8, 1.2, 0.8, -0.2); } });
      // a crown of tall crystal horns
      const hz = 6 + jd;
      parts.push(crystal(lk, -0.5, 4.4, hz, 6.5, 1.5, -1), crystal(lk, -0.5, -4.4, hz, 6.5, 1.5, -1));
      parts.push(crystal(lk, -3.5, 2.6, hz, 8.5, 1.6, -1.3), crystal(lk, -3.5, -2.6, hz, 8.5, 1.6, -1.3));
      parts.push(crystal(lk, 3, 2.8, hz, 4.2, 1.1, -0.6), crystal(lk, 3, -2.8, hz, 4.2, 1.1, -0.6));
      parts.push(crystal(lk, -4.5, 0, hz - 0.5, 5, 1.2, -1.5));
      return { r: 15, h: 16, style: 'hero', parts, scale: 1.2 };
    },
    neck(lk, w) {
      return { r: 10, h: 9, style: 'hero', parts: [
        { z0: 0, z1: 1.8, side: sh(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 5.6, w * 0.5) },
        { z0: 1.8, z1: 6, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, 7, w * 0.6 * (1 - zt * 0.2)),
          detail: (c) => { S.lines(c, 'rgba(10,30,60,0.4)', 0.45, [3, -w * 0.5, 3, w * 0.5, -2, -w * 0.55, -2, w * 0.55]); S.lines(c, 'rgba(255,255,255,0.45)', 0.4, [4, -w * 0.3, 0, -w * 0.45]); } },
        crystal(lk, -1, 0, 5.6, 4.2, 1.3, -1),
      ] };
    },
    chest(lk) {
      const b = lk.body, t = lk.top;
      return { r: 18, h: 20, style: 'hero', parts: [
        { z0: 0, z1: 3, side: sh(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, 2.4, sg * 8.2, 4, 2.4, sg * 0.4); },
          detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.dot(c, lk.crystal, 5.8, sg * (7.2 + i * 1), 0.55); } },
        { z0: 0.6, z1: 4, side: sh(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 11, 9) },
        { z0: 4, z1: 10, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 11.8, 10.4 * (1 - zt * 0.18)),
          detail: (c) => {
            // hexagonal armour plates
            c.save(); c.strokeStyle = 'rgba(10,30,60,0.35)'; c.lineWidth = 0.45; c.beginPath();
            for (let ix = -2; ix <= 2; ix++) for (let iy = -2; iy <= 2; iy++) { const x = ix * 4.2, y = iy * 3.8 + (ix % 2 ? 1.9 : 0); if (x * x / 120 + y * y / 95 > 1) continue; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, a2 = (k + 1) / 6 * TAU; c.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2); c.lineTo(x + Math.cos(a2) * 2, y + Math.sin(a2) * 2); } }
            c.stroke(); c.restore();
            S.lines(c, 'rgba(255,255,255,0.5)', 0.6, [8, -6, 2, -8.5, 8, 6, 2, 8.5]);
          } },
        { z0: 6.5, z1: 10, side: sh(b, -0.1), top: sh(t, 0.08), shape: (c) => { for (const sg of [1, -1]) S.ell(c, 1, sg * 7.4, 4.4, 3, sg * -0.3); } },
        // crystal spires along the spine (the saddle sits between them)
        crystal(lk, 8.5, 0, 9.4, 7, 2.2, -0.8),
        crystal(lk, -7, 0, 9.4, 11, 2.8, -1.1),
        crystal(lk, -6, 3.4, 9, 7, 1.9, -1),
        crystal(lk, -6, -3.4, 9, 7, 1.9, -1),
        crystal(lk, 2, 6.5, 8.6, 4.5, 1.5, -0.6),
        crystal(lk, 2, -6.5, 8.6, 4.5, 1.5, -0.6),
      ] };
    },
    hips(lk) {
      const b = lk.body, t = lk.top;
      return { r: 17, h: 18, style: 'hero', parts: [
        { z0: 0, z1: 3, side: sh(b, -0.3), top: b, shape: (c) => { for (const sg of [1, -1]) S.ell(c, -3, sg * 7.8, 4.6, 2.6, sg * -0.4); } },
        { z0: 0.6, z1: 3.6, side: sh(lk.belly, -0.25), top: lk.belly, shape: (c) => S.ell(c, 0, 0, 10, 8) },
        { z0: 3.6, z1: 9, side: b, top: t, shape: (c, zt) => S.ell(c, 0, 0, 10.6, 9 * (1 - zt * 0.2)),
          detail: (c) => { S.lines(c, 'rgba(10,30,60,0.35)', 0.45, [6, -7, 6, 7, 1, -8, 1, 8, -4, -7.5, -4, 7.5]); S.lines(c, 'rgba(255,255,255,0.45)', 0.5, [6, -5, 0, -7]); } },
        crystal(lk, 3, 0, 8.5, 9.5, 2.5, -1),
        crystal(lk, -4.5, 0, 8.4, 7.5, 2.1, -1),
        crystal(lk, -0.5, 3.6, 8, 5.5, 1.6, -0.8),
        crystal(lk, -0.5, -3.6, 8, 5.5, 1.6, -0.8),
      ] };
    },
    tail(lk, w, L) {
      L *= 1.5;
      return { r: Math.max(7, L * 0.8), h: 10, style: 'hero', parts: [
        { z0: 0, z1: 1.4, side: sh(lk.belly, -0.3), top: lk.belly, shape: (c) => S.ell(c, 0, 0, L * 0.55, w * 0.44) },
        { z0: 1.4, z1: 1.4 + w * 0.48, side: lk.body, top: lk.top, shape: (c, zt) => S.ell(c, 0, 0, L * 0.58, w * 0.52 * (1 - zt * 0.2)), detail: (c) => S.lines(c, 'rgba(10,30,60,0.35)', 0.4, [0, -w * 0.45, 0, w * 0.45]) },
        crystal(lk, 0, 0, 1.2 + w * 0.45, 2 + w * 0.75, Math.max(0.8, w * 0.24), -1),
      ] };
    },
    tip(lk) {
      return { r: 12, h: 10, style: 'hero', parts: [
        { z0: 0, z1: 2.6, side: lk.body, top: lk.top, shape: (c) => S.ell(c, 0, 0, 4, 2.4) },
        // a club of crystal shards
        crystal(lk, -3, 0, 1, 7, 2, -2),
        crystal(lk, -2, 2.4, 0.8, 5, 1.4, -1.6), crystal(lk, -2, -2.4, 0.8, 5, 1.4, -1.6),
        { z0: 0.6, z1: 2.6, side: lk.crystalSide, top: lk.crystal, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.6; for (const a of [Math.PI - 0.6, Math.PI, Math.PI + 0.6, Math.PI * 0.5, -Math.PI * 0.5]) S.poly(c, [Math.cos(a) * 8 * k, Math.sin(a) * 6 * k, Math.cos(a + 0.4) * 2, Math.sin(a + 0.4) * 2, Math.cos(a - 0.4) * 2, Math.sin(a - 0.4) * 2]); } },
      ] };
    },
  };

  /* ===================================================== MORGRAVE · THE UNBURIED */
  const Bones = {
    head(lk, open) {
      const bone = lk.bone, bone2 = lk.bone2;
      const parts = [], jd = open ? 1.8 : 0;
      // the lower jaw bone
      parts.push({ z0: 0, z1: 1.8, side: sh(bone2, -0.35), top: bone2, shape: (c) => { S.poly(c, S.sym([open ? 14 : 15, 0, 13.5, 1.6, 9, 2.6, 3, 3.6, -1, 3.2, -1, 2.2, 3, 2.4, 9, 1.4, 13, 0.6])); },
        detail: (c) => { c.fillStyle = '#f4eedc'; for (const sg of [1, -1]) for (let i = 0; i < 6; i++) { const x = 13 - i * 2; c.beginPath(); c.moveTo(x, sg * (1.5 + i * 0.15)); c.lineTo(x - 0.5, sg * (0.7 + i * 0.15)); c.lineTo(x - 1, sg * (1.6 + i * 0.15)); c.fill(); } } });
      if (open) parts.push({ z0: 1.8, z1: 1.8, side: '#0a0a08', top: '#14100c', flat: true, shape: (c) => S.poly(c, S.sym([14, 0, 11, 2.2, 5, 2.8, 1, 0])), detail: (c) => S.dot(c, lk.glow, 8, 0, 1.6) });
      // the skull
      parts.push({ z0: 1.8 + jd, z1: 5.8 + jd, side: sh(bone, -0.3), top: bone, shape: (c, zt) => S.poly(c, S.sym([16.5 - zt * 0.8, 0, 15, 1.8, 11, 2.6, 7, 3.2, 3, 4.6 - zt * 0.4, -1, 4.8 - zt * 0.5, -4.5, 3.2, -5.5, 0])),
        detail: (c) => {
          // dark sockets, nasal cavity and cracks
          c.fillStyle = '#120a10';
          for (const sg of [1, -1]) { c.beginPath(); c.ellipse(5.4, sg * 2.6, 2.2, 1.3, sg * 0.3, 0, TAU); c.fill(); }
          c.beginPath(); c.moveTo(15.4, 0); c.lineTo(13.2, 0.9); c.lineTo(13.2, -0.9); c.fill();
          S.lines(c, 'rgba(60,40,30,0.55)', 0.35, [1, 1, -2.5, 2.4, -1.4, 1.6, -3, 0.6, 10, -1.4, 8, -2]);
          // teeth along the upper jaw
          c.fillStyle = '#f8f2e0';
          for (const sg of [1, -1]) for (let i = 0; i < 7; i++) { const x = 14.4 - i * 1.9; c.beginPath(); c.moveTo(x, sg * (1.7 + i * 0.12)); c.lineTo(x - 0.5, sg * (2.6 + i * 0.12)); c.lineTo(x - 0.9, sg * (1.8 + i * 0.12)); c.fill(); }
        } });
      // burning green eyes deep in the sockets
      parts.push({ z0: 4.6 + jd, z1: 5.2 + jd, side: lk.eye, top: lk.eye, flat: true, bevel: false, shape: (c) => { S.circ(c, 5.4, 2.6, 0.9); S.circ(c, 5.4, -2.6, 0.9); } });
      // curled ram horns, blackened
      const hz = 4.6 + jd;
      parts.push({ z0: hz, z1: hz + 2.6, side: sh(lk.horn, -0.4), top: lk.horn, stroke: 1.9, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(1, sg * 3.4); c.bezierCurveTo(-3, sg * 8, -8.5, sg * 6, -6, sg * 2.6); c.quadraticCurveTo(-4, sg * 1.8, -4, sg * 3.8); } } });
      // tatters of hide at the back of the skull
      parts.push({ z0: 2.4 + jd, z1: 3.4 + jd, side: sh(lk.membrane, -0.3), top: lk.membrane, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.poly(c, [-3, sg * 3.4, -8, sg * 5, -7, sg * 3.6, -9.5, sg * 3.2, -5, sg * 2]); } });
      return { r: 16, h: 9, style: 'hero', parts, scale: 1.2 };
    },
    neck(lk, w) {
      return { r: 9, h: 6, style: 'hero', parts: [
        // dark sinew under the bones
        { z0: 0.4, z1: 1.8, side: sh(lk.body, -0.2), top: lk.body, shape: (c) => S.ell(c, 0, 0, 6.6, w * 0.3) },
      ].concat(vertebraParts(lk, 3, w, 1), vertebraParts(lk, -2.6, w * 0.95, 1)) };
    },
    chest(lk) {
      const bone = lk.bone;
      const ribs = [];
      for (let i = 0; i < 5; i++) ribs.push(5 - i * 2.6);
      return { r: 16, h: 11, style: 'hero', parts: [
        // bony forelegs
        { z0: 0, z1: 1.6, side: sh(lk.bone2, -0.35), top: lk.bone2, stroke: 1, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(4, sg * 4); c.lineTo(6, sg * 7); c.lineTo(9, sg * 7.4); } } },
        { z0: 0, z1: 1, side: lk.bone, top: lk.bone, flat: true, bevel: false, shape: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.circ(c, 9.3, sg * (6.8 + i * 0.6), 0.35); } },
        // shrunken dark hide stretched inside the ribs
        { z0: 1, z1: 5, side: sh(lk.body, -0.25), top: lk.body, shape: (c, zt) => S.ell(c, 0, 0, 9.6, 6 * (1 - zt * 0.2)) },
        // ghost-fire glowing inside the ribcage
        { z0: 5, z1: 5.4, side: lk.glow, top: lk.glow, flat: true, bevel: false, shape: (c) => { S.ell(c, -0.5, 0, 6.5, 3.8); }, detail: (c) => { S.dot(c, '#e8ffd0', -0.5, 0, 2); } },
        // the ribs, arching up and over
        { z0: 2.5, z1: 8.4, side: sh(bone, -0.35), top: bone, stroke: 1.05, bevel: false, shape: (c, zt) => {
          for (const x of ribs) for (const sg of [1, -1]) { const out = 7.6 * (1 - zt * 0.85) + 0.6; c.moveTo(x, 0); c.quadraticCurveTo(x + 0.6, sg * out * 0.9, x - 1.8, sg * out); }
        } },
        // spine and sternum on top
        ...vertebraParts(lk, 6.5, 4.2, 6.6), ...vertebraParts(lk, 2, 4.2, 6.8), ...vertebraParts(lk, -2.5, 4.2, 6.8), ...vertebraParts(lk, -7, 4, 6.6),
        // shoulder blades (wing roots)
        { z0: 6, z1: 8, side: sh(bone, -0.3), top: sh(bone, -0.05), shape: (c) => { for (const sg of [1, -1]) S.poly(c, [4, sg * 3, 0, sg * 7, -3, sg * 6, -1, sg * 3]); } },
      ] };
    },
    hips(lk) {
      const bone = lk.bone;
      return { r: 14, h: 9, style: 'hero', parts: [
        { z0: 0, z1: 1.6, side: sh(lk.bone2, -0.35), top: lk.bone2, stroke: 1, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(-2, sg * 4); c.lineTo(-5, sg * 7.2); c.lineTo(-8.5, sg * 7); } } },
        { z0: 0.8, z1: 4, side: sh(lk.body, -0.25), top: lk.body, shape: (c, zt) => S.ell(c, 0, 0, 7.4, 4.4 * (1 - zt * 0.2)) },
        // pelvis: two flared hip bones
        { z0: 3.6, z1: 6.4, side: sh(bone, -0.35), top: bone, shape: (c, zt) => { const k = 1 - zt * 0.25; for (const sg of [1, -1]) S.poly(c, [4, sg * 1.5, 1.5, sg * 6.6 * k, -3.5, sg * 6 * k, -5, sg * 2.4, -1, sg * 1.2]); },
          detail: (c) => { c.fillStyle = '#120a10'; for (const sg of [1, -1]) { c.beginPath(); c.ellipse(-1, sg * 3.8, 1.2, 0.8, 0, 0, TAU); c.fill(); } } },
        ...vertebraParts(lk, 4, 3.8, 5.4), ...vertebraParts(lk, 0, 3.8, 5.6), ...vertebraParts(lk, -4, 3.6, 5.4),
      ] };
    },
    tail(lk, w, L) {
      L *= 1.45;
      return { r: Math.max(6, L * 0.8), h: 6, style: 'hero', parts: [
        { z0: 0.3, z1: 1.2, side: sh(lk.body, -0.2), top: lk.body, shape: (c) => S.ell(c, 0, 0, L * 0.55, w * 0.22) },
      ].concat(vertebraParts(lk, L * 0.22, w * 1.05, 0.8), vertebraParts(lk, -L * 0.22, w, 0.8)) };
    },
    tip(lk) {
      return { r: 13, h: 6, style: 'hero', parts: [
        ...vertebraParts(lk, 1, 2.4, 0.6),
        // a curved bone blade
        { z0: 0.6, z1: 2.4, side: sh(lk.bone, -0.35), top: lk.bone, shape: (c, zt) => { const k = 1 - zt * 0.4; S.poly(c, [-1, 0.8, -6, 3.6 * k, -11, 2.4, -13.5, -1.5, -9, 0.4, -4, -0.8 * k]); },
          detail: (c) => S.lines(c, 'rgba(60,40,30,0.5)', 0.4, [-2, 0.6, -11, 1.6]) },
      ] };
    },
  };

  const KINDS = { human: Wyrm, elf: Serpent, ice: Tyrant, undead: Bones };

  /* ----------------------------------------------------------- the rider */
  const Seg = {
    rider(fk, pal) {
      const robe = pal.robe, trim = pal.trim, hat = pal.hat || robe, skin = pal.skin || '#e8c4a0';
      const parts = [
        { z0: 0, z1: 1.4, side: '#3a2414', top: '#6a4428', shape: (c) => S.rrect(c, -5, -3.6, 9, 7.2, 2), detail: (c) => { S.fillPoly(c, pal.cloth || trim, [-5, -3.6, -1, -3.6, -2, 3.6, -5, 3.6]); } },
        { z0: 1.4, z1: 5.5, side: C.shade(robe, -0.25), top: robe, shape: (c, zt) => S.poly(c, [2.4 - zt, 0, 1.2, 2.6 - zt * 0.6, -4.6, 3.2 - zt * 0.8, -5.4, 0, -4.6, -3.2 + zt * 0.8, 1.2, -2.6 + zt * 0.6]),
          detail: (c) => S.lines(c, trim, 0.5, [1.6, 1.8, -4.2, 2.6, 1.6, -1.8, -4.2, -2.6]) },
        { z0: 5.5, z1: 7, side: C.shade(robe, -0.15), top: C.shade(robe, 0.12), shape: (c) => S.ell(c, 0.3, 0, 1.8, 2.8) },
        { z0: 4, z1: 9.5, side: '#4a3020', top: '#7a5434', stroke: 0.9, bevel: false, shape: (c, zt) => { c.moveTo(-1.5 + zt * 6, 3.2); c.lineTo(-1.4 + zt * 6, 3.3); } },
        { z0: 7, z1: 8.4, side: C.shade(skin, -0.2), top: skin, shape: (c) => S.circ(c, 0.6, 0, 1.4) },
      ];
      if (fk === 'undead') parts.push({ z0: 8.2, z1: 9.6, side: '#a89a6a', top: '#e8d890', bevel: false, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; c.moveTo(0.6 + Math.cos(a) * 1.5, Math.sin(a) * 1.5); c.lineTo(0.6 + Math.cos(a + 0.3) * (1.2 - zt * 0.3), Math.sin(a + 0.3) * (1.2 - zt * 0.3)); c.lineTo(0.6 + Math.cos(a + 0.6) * 1.5, Math.sin(a + 0.6) * 1.5); } } });
      else if (fk === 'elf') parts.push({ z0: 8.1, z1: 8.9, side: '#c8b060', top: '#f0e0a0', stroke: 0.5, bevel: false, shape: (c) => S.circ(c, 0.6, 0, 1.45) },
        { z0: 6.5, z1: 8, side: '#d8c890', top: '#f4ecc8', shape: (c) => S.poly(c, [0, 1.3, -3.4, 1.6, -3.8, 0, -3.4, -1.6, 0, -1.3]) });
      else if (fk === 'ice') parts.push({ z0: 7.8, z1: 9.6, side: C.shade(hat, -0.2), top: hat, shape: (c, zt) => S.circ(c, 0.4, 0, 1.9 - zt * 0.5) },
        { z0: 8.6, z1: 10.6, side: '#c8c0b0', top: '#f0ece0', stroke: 0.7, bevel: false, shape: (c) => { c.moveTo(0.6, 1.6); c.quadraticCurveTo(-0.5, 3.4, -2.4, 3.2); c.moveTo(0.6, -1.6); c.quadraticCurveTo(-0.5, -3.4, -2.4, -3.2); } });
      else parts.push(
        { z0: 8, z1: 8.6, side: C.shade(hat, -0.3), top: C.shade(hat, 0.05), shape: (c) => S.ell(c, 0.5, 0, 3.1, 2.8), detail: (c) => S.lines(c, trim, 0.4, [0.5, -2.2, 0.5, 2.2]) },
        { z0: 8.6, z1: 13.5, side: C.shade(hat, -0.15), top: hat, shape: (c, zt) => S.circ(c, 0.5 - zt * 2.2, 0, 1.9 * (1 - zt * 0.9) + 0.15) });
      return { r: 9, h: 14, style: 'hero', parts };
    },
  };

  const rigCache = new Map();
  function rig(fk, scale) {
    scale = scale || 1;
    const key = fk + ':' + scale.toFixed(2);
    let r = rigCache.get(key);
    if (r) return r;
    const lk = LOOKS[fk] || LOOKS.human, K = KINDS[fk] || Wyrm, chain = CHAINS[fk] || CHAIN;
    const F = AS.Forge, D = 32;
    const sc = (m) => { m.scale = (m.scale || 1) * scale; return m; };
    let neckI = 0;
    const sheets = chain.map((n, i) => {
      const id = 'drg2:' + key + ':' + i;
      if (n.k === 'head') return F.sheet(id, () => sc(K.head(lk, false)), D, 1);
      if (n.k === 'neck') { const ni = ++neckI; return F.sheet(id, () => sc(K.neck(lk, n.w, ni)), D, 1); }
      if (n.k === 'chest') return F.sheet(id, () => sc(K.chest(lk)), D, 1);
      if (n.k === 'hips') return F.sheet(id, () => sc(K.hips(lk)), D, 1);
      if (n.k === 'tail') return F.sheet(id, () => sc(K.tail(lk, n.w, n.L)), D, 1);
      return F.sheet(id, () => sc(K.tip(lk)), D, 1);
    });
    const headOpen = F.sheet('drg2:' + key + ':headopen', () => sc(K.head(lk, true)), D, 1);
    r = { lk, sheets, headOpen, scale, chain: chain.map((n) => n.d * scale) };
    rigCache.set(key, r);
    return r;
  }
  function riderSheet(fk, pal) {
    return AS.Forge.sheet('rider:' + fk + JSON.stringify(pal), () => Seg.rider(fk, pal), 32, 1);
  }

  /* --------------------------------------------------------------- wings
   * Wing geometry in body space at full spread (x forward, y outward):
   * shoulder → elbow → wrist on the leading edge, four finger tips on the
   * trailing edge, and the flank. Each kind has its own shape. */
  const WINGS = {
    human: { shoulder: [1, 5], elbow: [-4, 19], wrist: [5, 33], tips: [[-1, 52], [-13, 49], [-22, 40], [-27, 26]], flank: [-17, 6] },
    elf: { shoulder: [1, 4.5], elbow: [-3, 17], wrist: [7, 30], tips: [[3, 57], [-8, 54], [-18, 45], [-24, 31]], flank: [-15, 5.5] },
    ice: { shoulder: [1, 6], elbow: [-5, 19], wrist: [4, 31], tips: [[-2, 48], [-13, 47], [-23, 39], [-29, 26]], flank: [-20, 7] },
    undead: { shoulder: [1, 4.5], elbow: [-4, 21], wrist: [7, 35], tips: [[1, 56], [-13, 53], [-24, 43], [-30, 28]], flank: [-16, 5.5] },
  };
  const WING = WINGS.human;
  // fold: 0 = spread, 1 = folded tight along the body
  function wingPoints(span, fold, sweep, out, G) {
    G = G || WING;
    const f = fold, sw = sweep;
    const lerp2 = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t)];
    const shd = G.shoulder;
    const elbow = lerp2(G.elbow, [-6, 10], f), wrist = lerp2(G.wrist, [-4, 15], f);
    const tips = G.tips.map((p, i) => lerp2(p, [-22 - i * 4, 12 - i * 1.5], f));
    const P = [shd, elbow, wrist].concat(tips).concat([G.flank]);
    for (let i = 0; i < P.length; i++) {
      const x = P[i][0], y = P[i][1] * span;
      const ang = sw * Math.min(1, (y - shd[1]) / 30);
      const dx = x - shd[0], dy = y - shd[1] * span;
      out[i * 2] = shd[0] + dx * Math.cos(ang) - dy * Math.sin(ang) * 0.4;
      out[i * 2 + 1] = shd[1] * span + dy * Math.cos(ang * 0.5) + dx * Math.sin(ang) * 0.3;
    }
    return out;
  }

  /* --------------------------------------------------------------- draw API */
  const Art = {
    LOOKS, Seg, CHAIN, CHAINS, CHEST, HIPS, rig, riderSheet, wingPoints, WING, WINGS, KINDS,
    chainFor(fk) { return CHAINS[fk] || CHAIN; },
    /* draw a full dragon. st = state prepared by the Dragon entity:
     *  { fk, scale, nodes:[{x,y,z,a}], wing:{ elev, fold, sweep, cup }, bank, open, hurt, ox, oy, alpha, glow } */
    draw(ctx, st, ox, oy, R) {
      const rg = rig(st.fk, st.scale);
      const lk = rg.lk, n = st.nodes;
      const ch = n[CHEST];
      const a = ch.a, ca = Math.cos(a), sa = Math.sin(a);
      const wl = this.wingPoly(st, -1, rg), wr = this.wingPoly(st, 1, rg);
      const farFirst = Math.sin(a) > 0 ? [wl, wr] : [wr, wl];
      const raised = st.wing.elev > 0.55;
      this.drawWing(ctx, farFirst[0], lk, st, ox, oy);
      if (!raised) this.drawWing(ctx, farFirst[1], lk, st, ox, oy);
      const order = this._order || (this._order = []);
      order.length = 0;
      for (let i = n.length - 1; i >= 0; i--) order.push(i);
      order.sort((i, j) => (n[i].y - n[i].z * 0.02) - (n[j].y - n[j].z * 0.02) || j - i);
      const alpha = st.alpha === undefined ? 1 : st.alpha;
      for (const i of order) {
        const nd = n[i];
        const shd = i === 0 && st.open ? rg.headOpen : rg.sheets[i];
        R.sprite(ctx, shd, nd.a, 0, nd.x, nd.y, nd.z, ox, oy, alpha);
        if (st.hurt > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.6, st.hurt * 3); R.flashSprite(ctx, shd, nd.a, 0, nd.x, nd.y, nd.z, ox, oy, '#ff7a5a'); ctx.restore(); }
        if (i === CHEST && st.rider) this.drawRider(ctx, st, ch, ox, oy, R);
      }
      if (raised) this.drawWing(ctx, farFirst[1], lk, st, ox, oy);
      this.drawExtras(ctx, st, rg, ox, oy, R);
      return { ca, sa };
    },
    /* the loop-the-loop: the pose comes from Dragon.layoutLoop (P.nodes with a
     * screen heading, a length factor, an inversion amount and a scale per node).
     * Each segment sprite is drawn at its node with its own heading, squashed
     * along that heading by its length factor and scaled up as it rises; over
     * the top the segments are tinted with the belly colour and the wings are
     * drawn above the body, with the rider hidden beneath it. */
    drawLoop(ctx, st, ox, oy, R, P) {
      const rg = rig(st.fk, st.scale), lk = rg.lk, n = P.nodes;
      const ch = n[CHEST];
      const st2 = this._loopSt || (this._loopSt = {});
      Object.assign(st2, st); st2.nodes = n;
      const wl = this.wingPoly(st2, -1, rg, ch, P.spanK[0]), wr = this.wingPoly(st2, 1, rg, ch, P.spanK[1]);
      const farFirst = Math.sin(ch.a) > 0 ? [wl, wr] : [wr, wl];
      const over = P.inv > 0.5; // inverted: the wings hang below the body, nearer the camera
      if (!over) { this.drawWing(ctx, farFirst[0], lk, st2, ox, oy); this.drawWing(ctx, farFirst[1], lk, st2, ox, oy); }
      const order = this._order || (this._order = []);
      order.length = 0;
      for (let i = n.length - 1; i >= 0; i--) order.push(i);
      order.sort((i, j) => (n[i].y - n[i].z * 0.02) - (n[j].y - n[j].z * 0.02) || j - i);
      const belly = C.str(C.mix(lk.belly || lk.leaf2 || lk.bone2 || '#d8c8a0', '#f4ecdc', 0.45));
      for (const i of order) {
        const nd = n[i];
        const shd = i === 0 && st.open ? rg.headOpen : rg.sheets[i];
        const di = AS.Forge.frameIndex(shd, nd.a), img = shd.frames[0][di];
        const px = nd.x - ox, py = nd.y - nd.z - oy;
        ctx.save();
        ctx.translate(px, py); ctx.rotate(nd.a); ctx.scale(nd.len * nd.sc, nd.sc); ctx.rotate(-nd.a);
        if (st.alpha !== undefined && st.alpha < 1) ctx.globalAlpha = st.alpha;
        ctx.drawImage(img, -shd.ax, -shd.ay, shd.w, shd.h);
        if (nd.inv > 0.02) {
          // the pale underside, in shadow
          let f = shd.__belly;
          if (!f) f = shd.__belly = shd.frames[0].map((im) => { const c = AS.Forge.canvas(im.width, im.height), x2 = c.getContext('2d'); x2.drawImage(im, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = belly; x2.fillRect(0, 0, c.width, c.height); return c; });
          ctx.globalAlpha = nd.inv * 0.36; ctx.drawImage(f[di], -shd.ax, -shd.ay, shd.w, shd.h);
          ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = nd.inv * 0.2; ctx.drawImage(f[di], -shd.ax, -shd.ay, shd.w, shd.h);
        }
        ctx.restore();
        if (i === CHEST && st.rider && P.inv < 0.6) { ctx.save(); ctx.globalAlpha = 1 - P.inv / 0.6; this.drawRider(ctx, st2, ch, ox, oy, R); ctx.restore(); }
      }
      if (over) { this.drawWing(ctx, farFirst[0], lk, st2, ox, oy); this.drawWing(ctx, farFirst[1], lk, st2, ox, oy); }
      this.drawExtras(ctx, st2, rg, ox, oy, R);
    },
    // per-kind glows and glints drawn over the body
    drawExtras(ctx, st, rg, ox, oy, R) {
      const lk = rg.lk, n = st.nodes, s = st.scale, hd = n[0], ch = n[CHEST], t = st.t || 0;
      const hx = hd.x + Math.cos(hd.a) * 8 * s, hy = hd.y + Math.sin(hd.a) * 8 * s;
      if (lk.kind === 'bones') {
        // burning sockets and the ghost-fire in the ribs
        R.light(hx, hy - hd.z - 5, 16 * s, lk.glow, 0.45 + Math.sin(t * 7) * 0.08);
        R.light(ch.x, ch.y - ch.z - 6, 28 * s, lk.glow, 0.35 + Math.sin(t * 5.3) * 0.08);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = AS.Forge.glow(lk.glow, 64);
        for (const sg of [1, -1]) {
          const ex = hd.x + Math.cos(hd.a) * 6.5 * s - Math.sin(hd.a) * 3.1 * s * sg, ey = hd.y + Math.sin(hd.a) * 6.5 * s + Math.cos(hd.a) * 3.1 * s * sg;
          const r = (2.6 + Math.sin(t * 9 + sg) * 0.5) * s;
          ctx.drawImage(g, ex - ox - r, ey - hd.z - 6.4 * s - oy - r, r * 2, r * 2);
        }
        const rr = (8 + Math.sin(t * 4) * 1.2) * s;
        ctx.globalAlpha = 0.55; ctx.drawImage(g, ch.x - ox - rr, ch.y - ch.z - 6 * s - oy - rr * 0.7, rr * 2, rr * 1.4);
        ctx.restore();
      } else if (lk.kind === 'tyrant') {
        // the crystals glow with cold light, and glints flash along them
        R.light(hx, hy - hd.z - 6, 12 * s, lk.eye, 0.25);
        R.light(ch.x, ch.y - ch.z - 14 * s, 26 * s, '#9fe8ff', 0.22);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.6;
        const pts = [[hd, -2, 0, 12], [ch, -7, 0, 18], [ch, 8.5, 0, 14], [n[HIPS], 3, 0, 16], [n[n.length - 1], -3, 0, 7]];
        const cg = AS.Forge.glow('#8ae4ff', 64);
        pts.forEach(([nd, dx, dy, z], i) => {
          const x = nd.x + Math.cos(nd.a) * dx * s - ox, y = nd.y + Math.sin(nd.a) * dx * s - (nd.z + z * s * 0.7) - oy, r = (5 + Math.sin(t * 1.7 + i) * 0.8) * s;
          ctx.globalAlpha = 0.42; ctx.drawImage(cg, x - r, y - r, r * 2, r * 2);
        });
        pts.forEach(([nd, dx, dy, z], i) => {
          const k = Math.max(0, Math.sin(t * 2.2 + i * 1.9)), r = (1.5 + k * 3) * s;
          if (k < 0.55) return;
          const x = nd.x + Math.cos(nd.a) * dx * s - ox, y = nd.y + Math.sin(nd.a) * dx * s - (nd.z + z * s) - oy;
          ctx.globalAlpha = (k - 0.55) * 2.2;
          ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
        });
        ctx.restore();
      } else if (lk.kind === 'serpent') {
        // the glowing spots and the eyes
        R.light(hx, hy - hd.z - 4, 12 * s, lk.eye, 0.3);
        R.light(ch.x, ch.y - ch.z - 5, 22 * s, lk.glow, 0.16 + Math.sin(t * 2.4) * 0.05);
      } else {
        // ember-lit eyes and nostrils
        R.light(hx, hy - hd.z - 4, 12 * s, '#ffb040', 0.32 + Math.sin(t * 6) * 0.05);
      }
    },
    drawRider(ctx, st, ch, ox, oy, R) {
      const sheet = st.riderSheet;
      if (!sheet) return;
      const s = st.scale;
      const x = ch.x + Math.cos(ch.a) * 1.5 * s, y = ch.y + Math.sin(ch.a) * 1.5 * s, z = ch.z + (RIDER_Z[st.fk] || 7.5) * s;
      R.sprite(ctx, sheet, st.aim, 0, x, y, z, ox, oy);
      const ra = st.aim, sx = x + Math.cos(ra) * 5 + Math.cos(ra + Math.PI / 2) * 3.3, sy = y + Math.sin(ra) * 5 + Math.sin(ra + Math.PI / 2) * 3.3;
      const g = AS.Forge.glow(st.orb || '#9fd8ff', 32), pulse = 3 + Math.sin(st.t * 6) * 0.6 + (st.cast || 0) * 5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(g, sx - ox - pulse, sy - z - 9.5 - oy - pulse, pulse * 2, pulse * 2);
      ctx.restore();
      R.light(sx, sy - z - 9.5, 14 + (st.cast || 0) * 30, st.orb || '#9fd8ff', 0.3 + (st.cast || 0) * 0.4);
      st.staffX = sx; st.staffY = sy - z - 9.5; st.staffZ = z + 9.5;
    },
    /* project one wing to screen points. side: -1 left, +1 right */
    wingPoly(st, side, rg, chOver, spanK) {
      const s = st.scale, ch = chOver || st.nodes[CHEST];
      const a = ch.a, ca = Math.cos(a), sa = Math.sin(a);
      const w = st.wing;
      const pts = this._wp || (this._wp = new Float32Array(16));
      wingPoints((w.span || 1) * (spanK || 1), w.fold, w.sweep, pts, WINGS[st.fk]);
      const elev = w.elev * 1.25;
      const ce = Math.cos(elev), se = Math.sin(elev);
      const bankK = st.bank * side;
      const out = [];
      for (let i = 0; i < 8; i++) {
        const lx = pts[i * 2] * s, ly = pts[i * 2 + 1] * s;
        const outward = Math.max(0, ly - 4 * s);
        const cup = (w.cup || 0) * outward * 0.35;
        const yy = 4 * s + outward * ce;
        const zz = (outward * se - bankK * outward * 0.75 + cup) * 0.62;
        const wx = ch.x + lx * ca - yy * side * sa, wy = ch.y + lx * sa + yy * side * ca;
        out.push({ x: wx, y: wy, z: ch.z + 6 * s + zz });
      }
      return { side, pts: out, elev: w.elev, light: U.clamp(0.82 + 0.25 * Math.cos(elev) - bankK * 0.35 - side * 0.1 * Math.cos(a + 0.8), 0.5, 1.15) };
    },
    drawWing(ctx, wp, lk, st, ox, oy) {
      ctx.save();
      if (st.alpha !== undefined) ctx.globalAlpha = st.alpha;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (lk.kind === 'serpent') this.leafWing(ctx, wp, lk, st, ox, oy);
      else if (lk.kind === 'tyrant') this.crystalWing(ctx, wp, lk, st, ox, oy);
      else if (lk.kind === 'bones') this.boneWing(ctx, wp, lk, st, ox, oy);
      else this.batWing(ctx, wp, lk, st, ox, oy);
      ctx.restore();
    },
    armBones(ctx, P, X, Y, lk, st, k, thick) {
      const s = st.scale, bone = lk.bone;
      ctx.strokeStyle = C.str(C.shade(bone, -0.4)); ctx.lineWidth = (thick || 2.6) * s;
      ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2])); ctx.stroke();
      ctx.strokeStyle = C.str(C.shade(bone, (k - 1) * 0.6 + 0.12)); ctx.lineWidth = (thick || 2.6) * 0.58 * s;
      ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2])); ctx.stroke();
    },

    /* Aldermere: a broad bat wing, sunlit through the membrane at the edge */
    batWing(ctx, wp, lk, st, ox, oy) {
      const P = wp.pts, s = st.scale, k = wp.light, mem = lk.membrane;
      const X = (p) => p.x - ox, Y = (p) => p.y - p.z - oy;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2])); ctx.lineTo(X(P[3]), Y(P[3]));
        for (let i = 3; i < 7; i++) {
          const a = P[i], b = i < 6 ? P[i + 1] : P[7];
          const mx = (a.x + b.x) / 2 * 0.72 + P[2].x * 0.28, my = (a.y - a.z + b.y - b.z) / 2 * 0.72 + (P[2].y - P[2].z) * 0.28;
          ctx.quadraticCurveTo(mx - ox, my - oy, X(b), Y(b));
        }
        ctx.closePath();
      };
      path();
      const gr = ctx.createLinearGradient(X(P[2]), Y(P[2]), (X(P[5]) + X(P[7])) / 2, (Y(P[5]) + Y(P[7])) / 2);
      gr.addColorStop(0, C.str(C.shade(mem, (k - 1) * 0.9 - 0.18)));
      gr.addColorStop(0.5, C.str(C.shade(mem, (k - 1) * 0.9)));
      gr.addColorStop(1, C.str(C.shade('#ff7a2a', (k - 1) * 0.6 - 0.1), 0.95)); // the sun glowing through the thin trailing edge
      ctx.fillStyle = gr; ctx.fill();
      // veins: finger bones out to the edge, with branching side veins
      ctx.strokeStyle = C.str(C.shade(mem, -0.45), 0.55); ctx.lineWidth = 0.55;
      ctx.beginPath();
      for (let i = 3; i < 7; i++) {
        const b = i < 6 ? P[i + 1] : P[7], mx = (P[i].x + b.x) / 2, my = (P[i].y - P[i].z + b.y - b.z) / 2;
        const fx = U.lerp(P[2].x, P[i].x, 0.55) - ox, fy = U.lerp(P[2].y - P[2].z, P[i].y - P[i].z, 0.55) - oy;
        ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + mx - ox) / 2 + 1, (fy + my - oy) / 2, U.lerp(fx, mx - ox, 0.85), U.lerp(fy, my - oy, 0.85));
      }
      ctx.stroke();
      path(); ctx.strokeStyle = 'rgba(30,6,4,0.8)'; ctx.lineWidth = 0.9; ctx.stroke();
      this.armBones(ctx, P, X, Y, lk, st, k, 2.8);
      ctx.strokeStyle = C.str(C.shade(lk.bone, (k - 1) * 0.6)); ctx.lineWidth = 0.95 * s;
      ctx.beginPath(); for (let i = 3; i < 7; i++) { ctx.moveTo(X(P[2]), Y(P[2])); ctx.lineTo(X(P[i]), Y(P[i])); } ctx.stroke();
      // knuckles and the thumb claw
      ctx.fillStyle = lk.horn;
      for (const i of [1, 2]) { ctx.beginPath(); ctx.arc(X(P[i]), Y(P[i]), 1.1 * s, 0, TAU); ctx.fill(); }
      const tx = X(P[2]), ty = Y(P[2]), dx = X(P[2]) - X(P[1]), dy = Y(P[2]) - Y(P[1]), dl = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(tx + dx / dl * 4 * s, ty + dy / dl * 4 * s); ctx.lineTo(tx - dy / dl * 1.4 * s, ty + dx / dl * 1.4 * s); ctx.lineTo(tx + dy / dl * 1.4 * s, ty - dx / dl * 1.4 * s); ctx.closePath(); ctx.fill();
    },

    /* Sylvara: wings of layered leaf-feathers fanning from the arm */
    leafWing(ctx, wp, lk, st, ox, oy) {
      const P = wp.pts, s = st.scale, k = wp.light;
      const X = (p) => p.x - ox, Y = (p) => p.y - p.z - oy;
      // sample a polyline of points at parameter t (0..1)
      const along = (pts, t) => {
        const segs = pts.length - 1, f = U.clamp(t, 0, 0.9999) * segs, i = Math.floor(f), u = f - i;
        return [U.lerp(X(pts[i]), X(pts[i + 1]), u), U.lerp(Y(pts[i]), Y(pts[i + 1]), u)];
      };
      const trail = [P[3], P[4], P[5], P[6], P[7]], arm = [P[2], P[1], P[0]];
      const N = 12;
      const leaf = (bx, by, tx, ty, wk, c0, c1) => {
        const gr = ctx.createLinearGradient(bx, by, tx, ty);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        ctx.beginPath(); leafPath(ctx, bx, by, tx, ty, wk);
        ctx.fillStyle = gr; ctx.fill();
        ctx.strokeStyle = 'rgba(8,40,20,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(250,236,160,0.55)'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(U.lerp(bx, tx, 0.92), U.lerp(by, ty, 0.92)); ctx.stroke();
      };
      const dark = C.str(C.shade(lk.membrane, (k - 1) * 0.8 - 0.22)), mid = C.str(C.shade(lk.leaf, (k - 1) * 0.8)), gold = C.str(C.shade(lk.leaf2, (k - 1) * 0.6));
      // flight feathers: inner ones first, the long outer primaries on top
      for (let i = N - 1; i >= 0; i--) {
        const t = i / (N - 1);
        const [bx, by] = along(arm, Math.min(1, t * 1.08));
        const [tx, ty] = along(trail, t);
        leaf(bx, by, tx, ty, i < 4 ? 0.13 : 0.17, dark, i < 5 ? gold : mid);
      }
      // a row of short covert leaves along the arm
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        const [bx, by] = along(arm, t);
        const [tx, ty] = along(trail, t);
        leaf(bx, by, U.lerp(bx, tx, 0.42), U.lerp(by, ty, 0.42), 0.26, mid, C.str(C.shade(lk.leaf, (k - 1) * 0.8 + 0.12)));
      }
      this.armBones(ctx, P, X, Y, lk, st, k, 1.8);
    },

    /* Hrimgard: a membrane of ice facets with a jagged trailing edge */
    crystalWing(ctx, wp, lk, st, ox, oy) {
      const P = wp.pts, s = st.scale, k = wp.light, mem = lk.membrane, t = st.t || 0;
      const X = (p) => p.x - ox, Y = (p) => p.y - p.z - oy;
      // trailing edge: finger tips with sharp notches between them
      const edge = [];
      for (let i = 3; i < 7; i++) {
        const a = P[i], b = i < 6 ? P[i + 1] : P[7];
        edge.push([X(a), Y(a)]);
        edge.push([U.lerp((X(a) + X(b)) / 2, X(P[2]), 0.22), U.lerp((Y(a) + Y(b)) / 2, Y(P[2]), 0.22)]);
      }
      edge.push([X(P[7]), Y(P[7])]);
      const W2 = [X(P[2]), Y(P[2])], E1 = [X(P[1]), Y(P[1])], S0 = [X(P[0]), Y(P[0])];
      // facets fanning from the wrist and the elbow
      const tri = (a, b, c, i) => {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
        const v = ((i * 37) % 7) / 7 - 0.5;
        ctx.fillStyle = C.str(C.shade(mem, (k - 1) * 0.9 + v * 0.28), 0.78); ctx.fill();
        ctx.strokeStyle = 'rgba(240,252,255,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
      };
      ctx.beginPath(); ctx.moveTo(S0[0], S0[1]); ctx.lineTo(E1[0], E1[1]); ctx.lineTo(W2[0], W2[1]); ctx.closePath();
      for (let i = 0; i < 5; i++) tri(W2, edge[i], edge[i + 1], i);
      for (let i = 5; i < edge.length - 1; i++) tri(E1, edge[i], edge[i + 1], i);
      tri(E1, W2, edge[5], 11); tri(S0, E1, edge[edge.length - 1], 13);
      // a frosted bright rim
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(S0[0], S0[1]); ctx.lineTo(E1[0], E1[1]); ctx.lineTo(W2[0], W2[1]); ctx.lineTo(edge[0][0], edge[0][1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,70,120,0.7)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]); for (const p of edge) ctx.lineTo(p[0], p[1]); ctx.lineTo(S0[0], S0[1]); ctx.stroke();
      this.armBones(ctx, P, X, Y, lk, st, k, 2.6);
      // glints on the facets
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * 3 + i * 2.1 + wp.side), p = edge[i * 2];
        if (f < 0.6) continue;
        const r = (f - 0.6) * 9 * s, gx = U.lerp(p[0], W2[0], 0.3), gy = U.lerp(p[1], W2[1], 0.3);
        ctx.globalAlpha = (f - 0.6) * 2.5;
        ctx.beginPath(); ctx.moveTo(gx - r, gy); ctx.lineTo(gx + r, gy); ctx.moveTo(gx, gy - r); ctx.lineTo(gx, gy + r); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    },

    /* Morgrave: finger bones with rotten membrane torn to rags */
    boneWing(ctx, wp, lk, st, ox, oy) {
      const P = wp.pts, s = st.scale, k = wp.light, mem = lk.membrane, t = st.t || 0;
      const X = (p) => p.x - ox, Y = (p) => p.y - p.z - oy;
      // a ragged trailing edge with hanging strips, fluttering
      const rng = new U.RNG(91 + (wp.side > 0 ? 7 : 0));
      ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2]));
      // the membrane stops short of the finger tips: bone claws stick out past it
      const fin = (i) => [U.lerp(X(P[2]), X(P[i]), 0.82), U.lerp(Y(P[2]), Y(P[i]), 0.82)];
      let prev = fin(3); ctx.lineTo(prev[0], prev[1]);
      for (let i = 3; i < 7; i++) {
        const nx = i < 6 ? fin(i + 1) : [X(P[7]), Y(P[7])];
        const steps = 5;
        for (let j = 1; j <= steps; j++) {
          const u = j / steps, bx = U.lerp(prev[0], nx[0], u), by = U.lerp(prev[1], nx[1], u);
          const inX = U.lerp(bx, X(P[2]), 0.3), inY = U.lerp(by, Y(P[2]), 0.3);
          const tear = rng.next(), fl = Math.sin(t * 6 + i * 2 + j) * 0.04;
          const d = j === steps ? 0 : tear < 0.35 ? 0.34 + fl : tear < 0.55 ? -0.12 + fl : 0.12 + fl * 2;
          ctx.lineTo(U.lerp(bx, inX, d), U.lerp(by, inY, d));
        }
        prev = nx;
      }
      ctx.closePath();
      const gr = ctx.createLinearGradient(X(P[2]), Y(P[2]), X(P[7]), Y(P[7]));
      gr.addColorStop(0, C.str(C.shade(mem, (k - 1) * 0.8 - 0.1), 0.88)); gr.addColorStop(1, C.str(C.shade(mem, (k - 1) * 0.8 + 0.08), 0.7));
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = C.str(lk.glow, 0.35); ctx.lineWidth = 1.4; ctx.stroke(); // a sickly ghost-light at the torn edges
      ctx.strokeStyle = 'rgba(10,4,12,0.8)'; ctx.lineWidth = 0.6; ctx.stroke();
      // rot holes
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 4; i++) {
        const p = P[3 + (i % 4)], q = P[i < 2 ? 2 : 1], u = 0.35 + rng.next() * 0.3;
        const hx = U.lerp(X(p), X(q), u), hy = U.lerp(Y(p), Y(q), u);
        ctx.beginPath(); ctx.ellipse(hx, hy, (1.8 + rng.next() * 1.6) * s, (1.1 + rng.next()) * s, rng.next() * 3, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // the bones: arm, knuckles and long finger bones ending in claws
      this.armBones(ctx, P, X, Y, lk, st, k, 2.4);
      ctx.strokeStyle = C.str(C.shade(lk.bone, (k - 1) * 0.6 - 0.05)); ctx.lineWidth = 1.05 * s;
      ctx.beginPath(); for (let i = 3; i < 7; i++) { ctx.moveTo(X(P[2]), Y(P[2])); ctx.lineTo(X(P[i]), Y(P[i])); } ctx.stroke();
      ctx.fillStyle = C.str(C.shade(lk.bone, (k - 1) * 0.6));
      for (const i of [1, 2]) { ctx.beginPath(); ctx.arc(X(P[i]), Y(P[i]), 1.4 * s, 0, TAU); ctx.fill(); }
      for (let i = 3; i < 7; i++) {
        const mx = U.lerp(X(P[2]), X(P[i]), 0.5), my = U.lerp(Y(P[2]), Y(P[i]), 0.5);
        ctx.beginPath(); ctx.arc(mx, my, 0.8 * s, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(X(P[i]), Y(P[i]), 0.9 * s, 0, TAU); ctx.fill();
      }
    },

    /* ground shadow of the whole dragon (body silhouettes + wing polygons) */
    drawShadow(ctx, st, ox, oy) {
      const rg = rig(st.fk, st.scale), n = st.nodes;
      for (let i = 0; i < n.length; i++) {
        const nd = n[i], shd = rg.sheets[i];
        const di = AS.Forge.frameIndex(shd, nd.a);
        const off = 2 + nd.z * 0.12;
        ctx.drawImage(shd.shadows[di], nd.x - ox - shd.ax + off + nd.z * 0.15, nd.y - oy - shd.ay + off * 0.5, shd.w, shd.h);
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
