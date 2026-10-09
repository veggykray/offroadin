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
      // a ridge of thick scutes runs under the spikes so they grow out of the back, not sit on it
      if (zt < 0.22) { const wr = (w || 1.3) * (0.55 - zt); c.moveTo((x0 || 0) + L / 2, 0); c.ellipse((x0 || 0), 0, L / 2, wr, 0, 0, TAU); c.closePath(); }
      for (let i = 0; i < n; i++) { const x = (x0 || 0) + L / 2 - (i + 0.5) * (L / n), s = (w || 1.3) * (1 - zt * 0.85); c.moveTo(x + s * 1.1, 0); c.quadraticCurveTo(x - s * 0.6, s * 0.75, x - s * 1.9, s * 0.6); c.lineTo(x - s * 1.5, 0); c.lineTo(x - s * 1.9, -s * 0.6); c.quadraticCurveTo(x - s * 0.6, -s * 0.75, x + s * 1.1, 0); c.closePath(); }
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

  /* ------------------------------------------------------- finishing helpers
   * The dragons are seen from above at ~45°: the head's top carries the face (eyes on its
   * flanks under a brow, nostrils, scale rows) and its side walls carry the profile (the eye
   * again, the lip line and the teeth), painted with AS.Mat (materials.js). */
  // half-width of a mirrored polygon (S.sym point list, x descending) at x
  function halfW(pts, x) {
    for (let i = 0; i + 3 < pts.length; i += 2) { const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3]; if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) { const t = (x - x0) / ((x1 - x0) || 1); return y0 + (y1 - y0) * t; } }
    return 0;
  }
  /* an eye on the top of the head, both sides. e: { x, y, len, wid, tilt (outer corner back, rad), iris: [core, rim],
   *  pupil: 'slit'|'round'|'flame', sock, lid, lower, brow (lit ridge colour), scowl (brow drop toward the snout), glow } */
  function eyeArt(c, e) {
    for (const sg of [1, -1]) {
      c.save(); c.translate(e.x, e.y * sg); c.rotate(-e.tilt * sg); c.scale(1, sg);
      const L = e.len / 2, W = e.wid / 2;
      // +v points out over the head's flank, -v toward its crown (the upper lid, seen from above)
      const almond = (k, dv) => { c.beginPath(); c.moveTo(L * k, dv || 0); c.quadraticCurveTo(L * 0.1, -W * 2.1 * k + (dv || 0), -L * k, (dv || 0) + W * 0.25); c.quadraticCurveTo(-L * 0.1, W * 2.0 * k + (dv || 0), L * k, dv || 0); c.closePath(); };
      // socket and the brow's shadow
      almond(1.45, -W * 0.15); c.fillStyle = e.sock; c.fill();
      if (e.brow) { // the lit brow ridge over the upper lid, dropping toward the snout when scowling
        c.beginPath(); c.moveTo(L * 1.55, -W * (1.0 - (e.scowl || 0))); c.quadraticCurveTo(0, -W * 2.9, -L * 1.35, -W * 1.9);
        c.lineWidth = W * 0.85; c.strokeStyle = e.brow; c.lineCap = 'round'; c.stroke();
      }
      almond(1); const g = c.createRadialGradient(L * 0.1, 0, 0, 0, 0, L * 1.05); g.addColorStop(0, e.iris[0]); g.addColorStop(0.55, e.iris[1]); g.addColorStop(1, e.iris[2] || C.str(C.shade(e.iris[1], -0.45))); c.fillStyle = g; c.fill();
      c.save(); almond(1); c.clip();
      if (e.pupil === 'slit') { c.beginPath(); c.ellipse(L * 0.05, 0, L * 0.14, W * 1.6, 0, 0, TAU); c.fillStyle = '#0a0606'; c.fill(); }
      else if (e.pupil === 'round') { c.beginPath(); c.arc(L * 0.05, 0, W * 0.75, 0, TAU); c.fillStyle = '#081210'; c.fill(); }
      else if (e.pupil === 'flame') { const f = c.createRadialGradient(L * 0.05, 0, 0, L * 0.05, 0, W * 1.3); f.addColorStop(0, '#ffffff'); f.addColorStop(0.4, e.iris[0]); f.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = f; c.fillRect(-L, -W * 2, L * 2, W * 4); }
      // the upper lid's shadow across the top of the eye
      c.fillStyle = 'rgba(0,0,0,0.38)'; c.fillRect(-L * 1.2, -W * 2.4, L * 2.4, W * 1.25);
      c.restore();
      // lids
      c.beginPath(); c.moveTo(L * 1.08, 0); c.quadraticCurveTo(L * 0.1, -W * 2.15, -L * 1.12, W * 0.2); c.lineWidth = Math.max(0.36, W * 0.42); c.strokeStyle = e.lid; c.stroke();
      c.beginPath(); c.moveTo(L * 0.95, W * 0.15); c.quadraticCurveTo(-L * 0.1, W * 2.05, -L * 1.0, W * 0.35); c.lineWidth = Math.max(0.28, W * 0.25); c.strokeStyle = e.lower; c.stroke();
      // the glint, front and toward the crown
      c.beginPath(); c.arc(L * 0.38, -W * 0.45, Math.max(0.26, W * 0.32), 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      c.restore();
    }
  }
  /* the same eye and the mouth projected onto the head's side walls (profile views).
   * pts: the head part's S.sym list, z0/z1 its heights, e as above, teeth: { col, xs: [...], z, h }, lip: colour */
  function headSides(pts, z0, z1, e, o) {
    if (!AS.Mat) return null;
    o = o || {};
    const fs = [];
    const side = (x, sg, push) => () => [x, sg * (halfW(pts, x) + (push || 0)), sg * Math.PI / 2];
    const ez = o.ez !== undefined ? o.ez : z1 - (z1 - z0) * 0.28;
    for (const sg of [1, -1]) {
      fs.push({ z: ez + 0.1, h: e.wid * 0.85, w: e.len * 0.7, at: side(e.x, sg), col: e.sock, min: 1 });
      fs.push({ z: ez, h: e.wid * 0.48, w: e.len * 0.45, at: side(e.x, sg), col: e.iris[1], min: 1.2 });
      fs.push({ z: ez, h: e.wid * 0.48, w: e.len * 0.08, at: side(e.x + e.len * 0.05, sg), col: e.pupil === 'flame' ? '#ffffff' : '#0a0606', min: 0.5 });
      fs.push({ z: ez + e.wid * 0.62, h: e.wid * 0.22, w: e.len * 0.55, at: side(e.x, sg), col: e.lid, min: 0.6 });
      fs.push({ z: ez + e.wid * 0.25, h: 0.12, w: 0.12, at: side(e.x + e.len * 0.2, sg), col: '#ffffff', shape: 'box', min: 0.5 });
      if (o.teeth) for (const x of o.teeth.xs) fs.push({ z: z0 + (o.teeth.h || 0.5), h: o.teeth.h || 0.5, w: o.teeth.w || 0.35, at: side(x, sg), col: o.teeth.col, shape: 'tooth', min: 0.5 });
      if (o.lip) fs.push({ z: z0 + 0.12, h: 0.14, w: o.lipW || 5, at: side(o.lipX || 9, sg), col: o.lip, shape: 'box', min: 0.5 });
      for (const sc of o.scars || []) fs.push({ z: ez - 0.8, h: 0.12, w: 1.6, at: side(sc, sg), col: 'rgba(0,0,0,0.35)', shape: 'box' });
    }
    return AS.Mat.paint(z0, z1, fs);
  }
  // material hooks, made once AS.Mat exists (dragons are forged lazily, after every script has loaded)
  let MATS = null;
  function mats() {
    if (MATS || !AS.Mat) return MATS;
    const T = AS.Mat.tex;
    MATS = {
      scales: T('scales', { a: 0.42, n: 10, seed: 1 }), scalesL: T('scales', { a: 0.4, n: 7, seed: 2 }), fine: T('scales', { a: 0.34, n: 14, seed: 3 }),
      plates: T('plates', { a: 0.45, n: 4, seed: 4 }), belly: T('plates', { a: 0.5, n: 3, seed: 5, glint: '#fff4d8' }),
      horn: T('horn', { a: 0.45, dz: 0.5 }), bone: T('bone', { a: 0.5 }), leaf: T('fur', { a: 0.25, dz: 0 }), ice: T('ice', { a: 0.55 }), hide: T('leather', { a: 0.45 }),
      cloth: T('cloth', { a: 0.45 }), metal: T('metal', { a: 0.5 }),
    };
    return MATS;
  }
  // give every plain part of a forged segment its material by role (body scales, belly plates, horn, bone)
  function finish(m, lk) {
    const X = mats();
    if (!X) return m;
    const bodyT = lk.kind === 'tyrant' ? X.plates : lk.kind === 'serpent' ? X.fine : X.scales;
    for (const p of m.parts) {
      if (p.tex || p.stroke || p.flat) continue;
      const t = p.top, sd = p.side;
      if (t === lk.top || sd === lk.body || t === lk.body) p.tex = bodyT;
      else if (t === lk.belly) p.tex = lk.kind === 'bones' ? X.hide : X.belly;
      else if (t === lk.horn || t === lk.spine) p.tex = X.horn;
      else if (t === lk.bone || t === lk.bone2) p.tex = X.bone;
      else if (t === lk.cloth) p.tex = X.cloth;
      else if (t === lk.gold) p.tex = X.metal;
    }
    return m;
  }
  // a claw: a short curved horn triangle pointing along angle a
  function claw(c, x, y, a, len) { const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca; c.moveTo(x + nx * len * 0.3, y + ny * len * 0.3); c.quadraticCurveTo(x + ca * len * 0.7 + nx * len * 0.25, y + sa * len * 0.7 + ny * len * 0.25, x + ca * len, y + sa * len); c.lineTo(x - nx * len * 0.3, y - ny * len * 0.3); c.closePath(); }

  // curved claws on tucked feet, mirrored: list [[x, y, angle, len], ...] for the +y side
  function claws(col, list, z0, z1) {
    return { z0, z1, side: sh(col, -0.4), top: col, bevel: false, shape: (c, zt) => { const k = 1 - zt * 0.35; for (const sg of [1, -1]) for (const q of list) { claw(c, q[0], sg * q[1], sg * q[2], q[3] * k); } } };
  }
  const toeRow = (x, y, a, n, sp, len) => Array.from({ length: n }, (_, i) => [x + Math.cos(a + 1.57) * (i - (n - 1) / 2) * sp * 0.2, y + Math.sin(a + 1.57) * (i - (n - 1) / 2) * sp, a + (i - (n - 1) / 2) * 0.18, len]);

  /* ================================================== ALDERMERE · EMBER WYRM */
  const Wyrm = {
    head(lk, open) {
      const b = lk.body, t = lk.top, belly = lk.belly, horn = lk.horn;
      const parts = [], jd = open ? 1.7 : 0;
      const E = { x: 8.1, y: 3.35, len: 3.4, wid: 1.55, tilt: 0.32, iris: ['#fff2a0', '#f0a020', '#8a3a08'], pupil: 'slit', sock: '#3a0806', lid: '#2a0604', lower: C.str(C.shade(t, 0.25)), brow: C.str(C.shade(t, 0.32)), scowl: 0.55 };
      const jawPts = S.sym([open ? 14.5 : 15.6, 0, 12, 2.6 + jd * 0.4, 6, 3.9, 0, 4.1, -2.4, 0]);
      parts.push({ z0: 0, z1: 2.3, side: sh(belly, -0.3), top: belly, shape: (c) => S.poly(c, jawPts),
        tex: headSides(jawPts, 0, 2.3, E, { ez: -5, teeth: { col: '#fff4e0', xs: [14.2, 12.6, 11, 9.4, 7.8], z: 2.3, h: 0.45, w: 0.32 } }),
        detail: (c) => { // lower teeth along the jaw's rim, the throat's scutes
          c.fillStyle = '#fff4e0';
          for (const sg of [1, -1]) for (let i = 0; i < 5; i++) { const x = 14 - i * 1.6, y = halfW(jawPts, x) - 0.35; c.beginPath(); c.moveTo(x + 0.4, sg * y); c.lineTo(x - 0.1, sg * (y - 0.9)); c.lineTo(x - 0.5, sg * y); c.fill(); }
          S.lines(c, C.str(C.shade(belly, -0.35)), 0.35, [10, -2.4, 10, 2.4, 6, -3.2, 6, 3.2, 2, -3.5, 2, 3.5]);
        } });
      if (open) parts.push({ z0: 2.3, z1: 2.3, side: '#5a0a0a', top: '#8a1a14', flat: true, shape: (c) => S.poly(c, S.sym([14, 0, 11, 2.3, 6, 3, 2, 2.6, 1, 0])), detail: (c) => {
        c.fillStyle = '#fff4e0';
        for (let i = 0; i < 5; i++) for (const sg of [1, -1]) { c.beginPath(); c.moveTo(13 - i * 2.2, sg * (2 + i * 0.15)); c.lineTo(12.2 - i * 2.2, sg * (1.2 + i * 0.15)); c.lineTo(11.6 - i * 2.2, sg * (2.1 + i * 0.15)); c.fill(); }
        S.dot(c, lk.breath[1], 9, 0, 1.5);
      } });
      // cheek plates: the jaw muscles bulging behind the eyes, edged with a frill of small spikes
      parts.push({ z0: 1.6 + jd, z1: 5.0 + jd, side: sh(b, -0.08), top: sh(t, -0.04), shape: (c, zt) => { for (const sg of [1, -1]) { S.ell(c, 1.6, sg * 4.3, 3.3 * (1 - zt * 0.25), 1.6 * (1 - zt * 0.3), sg * 0.25); } },
        detail: (c) => { c.fillStyle = C.str(C.shade(lk.spine, 0.1)); for (const sg of [1, -1]) for (let i = 0; i < 3; i++) { c.beginPath(); claw(c, 2.6 - i * 1.5, sg * (5.3 + i * 0.15), sg * (1.9 + i * 0.25), 1.6); c.fill(); } } });
      const topPts = (zt) => S.sym([17.2 - zt * 0.7, 0, 15, 2.5, 9.5, 3.6, 3.5, 4.9 - zt * 0.4, -1.5, 4.3, -3.6, 0]);
      parts.push({ z0: 2.3 + jd, z1: 6 + jd, side: b, top: t, shape: (c, zt) => S.poly(c, topPts(zt)),
        tex: AS.Mat ? AS.Mat.join(mats().scales, headSides(topPts(0.5), 2.3 + jd, 6 + jd, E, { ez: 5.0 + jd, teeth: { col: '#fff4e0', xs: [15.2, 13.8, 12.4, 11.0, 9.6, 8.2], h: 0.5, w: 0.3 }, lip: '#3a0806', lipW: 5.5, lipX: 11 })) : null,
        detail: (c) => {
          // scale rows down the muzzle, folds behind the eye, the crown's armoured scutes
          c.save(); c.strokeStyle = 'rgba(40,0,0,0.42)'; c.lineWidth = 0.32; c.beginPath();
          for (let r = 0; r < 4; r++) for (let i = -2; i <= 2; i++) { const x = 15 - r * 1.6, y = i * 0.75 + (r % 2) * 0.37; if (Math.abs(y) > halfW(topPts(1), x) - 0.5) continue; c.moveTo(x + 0.4, y - 0.36); c.quadraticCurveTo(x - 0.25, y, x + 0.4, y + 0.36); }
          for (const sg of [1, -1]) for (let i = 0; i < 3; i++) { c.moveTo(5.6 - i * 0.9, sg * (2.4 + i * 0.25)); c.quadraticCurveTo(4.8 - i * 0.9, sg * (3.6 + i * 0.3), 5.4 - i * 0.9, sg * (4.6 + i * 0.2)); }
          for (let i = 0; i < 3; i++) { c.moveTo(3 - i * 1.7, -1.6); c.quadraticCurveTo(2.2 - i * 1.7, 0, 3 - i * 1.7, 1.6); }
          c.stroke(); c.restore();
          // flared nostrils with an ember glow inside
          for (const sg of [1, -1]) { c.beginPath(); c.ellipse(15.7, sg * 1.15, 0.85, 0.42, sg * 0.5, 0, TAU); c.fillStyle = C.str(C.shade(t, 0.3)); c.fill(); c.beginPath(); c.ellipse(15.8, sg * 1.18, 0.6, 0.26, sg * 0.5, 0, TAU); c.fillStyle = '#2a0402'; c.fill(); c.beginPath(); c.ellipse(15.9, sg * 1.2, 0.3, 0.14, sg * 0.5, 0, TAU); c.fillStyle = '#ffb040'; c.fill(); }
          // the ridge between the eyes and down the snout
          S.lines(c, C.str(C.shade(t, 0.28)), 0.55, [14.2, 0, 9.5, 0]);
          eyeArt(c, E);
        } });
      // the brow ridges: armoured crests over the eyes, dropping toward the snout in a scowl
      parts.push({ z0: 5.4 + jd, z1: 6.7 + jd, side: sh(b, -0.18), top: sh(t, 0.14), shape: (c, zt) => { const k = 1 - zt * 0.35; for (const sg of [1, -1]) S.poly(c, [10.8, sg * 2.0, 8.8, sg * (1.85 + 0.35 * k), 5.6, sg * (2.7 + 0.35 * k), 4.4, sg * (3.2 + 0.2 * k), 5.2, sg * 2.3, 8.6, sg * 1.4]); } });
      // a nose horn
      parts.push({ z0: 5.2 + jd, z1: 7.4 + jd, side: sh(horn, -0.3), top: horn, bevel: false, shape: (c, zt) => S.poly(c, [14.2 + zt * 0.6, 0, 12.2, 0.8 * (1 - zt), 12.2, -0.8 * (1 - zt)]) });
      // great swept horns rooted in thick bases, and a lower pair along the jaw
      const hz = 5.4 + jd;
      parts.push({ z0: hz - 0.6, z1: hz + 1.2, side: sh(b, -0.2), top: sh(t, 0.08), bevel: false, shape: (c) => { for (const sg of [1, -1]) S.ell(c, 3.2, sg * 3.0, 1.7, 1.2, sg * 0.4); } });
      parts.push({ z0: hz, z1: hz + 3.2, side: sh(horn, -0.4), top: horn, stroke: 1.9, bevel: false, shape: (c, zt) => { for (const sg of [1, -1]) { c.moveTo(3.5, sg * 2.8); c.bezierCurveTo(-1, sg * 5, -6, sg * 5.6, -11 + zt * 2.5, sg * (4.4 + zt * 1.4)); } } });
      parts.push({ z0: hz + 2.2, z1: hz + 3.6, side: sh(horn, -0.25), top: sh(horn, 0.12), bevel: false, shape: (c, zt) => { for (const sg of [1, -1]) { for (const u of [0.25, 0.45, 0.65]) { const x = -1 - u * 9, y = sg * (4.4 + u * 1.3); S.ell(c, x, y, 0.32, 0.95 * (1 - zt * 0.4), sg * -0.4); } } } });
      parts.push({ z0: 2.6 + jd, z1: 4.4 + jd, side: sh(horn, -0.4), top: horn, stroke: 1.2, bevel: false, shape: (c) => { for (const sg of [1, -1]) { c.moveTo(0.5, sg * 4.2); c.quadraticCurveTo(-3.5, sg * 6.4, -7, sg * 6.8); } } });
      // a gold ring on each horn: Aldermere's crown-dragon
      parts.push({ z0: hz + 0.6, z1: hz + 1.6, side: sh(lk.gold, -0.3), top: lk.gold, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.ell(c, -2.8, sg * 4.75, 0.9, 0.75); } });
      parts.push({ z0: 2.6 + jd, z1: 4.4 + jd, side: sh(lk.spine, -0.2), top: lk.spine, bevel: false, shape: (c) => { for (const sg of [1, -1]) S.poly(c, [2, sg * 4, -2.5, sg * 6.6, -3.5, sg * 4.6, -5.5, sg * 6, -4.5, sg * 3.6]); } });
      return { r: 16, h: 11, style: 'hero', parts, scale: 1.22 };
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
          detail: (c) => S.lines(c, 'rgba(40,0,0,0.45)', 0.3, [4.6, 6.6, 3.2, 6.9, 4.4, 7.6, 3.0, 7.7, 4.6, -6.6, 3.2, -6.9, 4.4, -7.6, 3.0, -7.7]) },
        claws(lk.horn, toeRow(5.2, 7.05, 0.35, 3, 0.8, 1.5), 0.2, 1.6),
        // heavy shoulders under the wing roots: the flight muscles, banded with larger scales
        { z0: 3.0, z1: 8.3, side: sh(b, -0.06), top: sh(t, 0.04), shape: (c, zt) => { for (const sg of [1, -1]) S.ell(c, 2.4, sg * 7.4 * (1 - zt * 0.1), 4.2 * (1 - zt * 0.22), 2.7 * (1 - zt * 0.3), sg * 0.28); },
          detail: (c) => { c.save(); c.strokeStyle = 'rgba(40,0,0,0.4)'; c.lineWidth = 0.35; c.beginPath(); for (const sg of [1, -1]) { c.moveTo(5.6, sg * 6.4); c.quadraticCurveTo(2.4, sg * 8.6, -0.8, sg * 7.0); c.moveTo(4.4, sg * 5.8); c.quadraticCurveTo(2.0, sg * 7.4, 0.2, sg * 6.4); } c.stroke(); c.restore(); } },
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
          detail: (c) => S.lines(c, 'rgba(40,0,0,0.45)', 0.3, [-1, 5.4, -3.4, 8.2, -1, -5.4, -3.4, -8.2]) },
        claws(lk.horn, toeRow(-6.8, 6.9, Math.PI - 0.3, 3, 0.9, 1.5), 0.2, 1.6),
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
      const E = { x: 8.0, y: 2.25, len: 3.6, wid: 1.6, tilt: -0.22, iris: ['#e8fff4', '#4ad8b0', '#0a5a48'], pupil: 'round', sock: '#0a2a1c', lid: '#06180e', lower: C.str(C.shade(t, 0.3)), brow: C.str(C.shade(lk.spine, 0.1)), scowl: -0.3 };
      const sPts = (zt) => S.sym([19.5 - zt * 0.8, 0, 16, 1.7, 10, 2.5, 4, 3.4 - zt * 0.3, -1, 3, -3, 0]);
      parts.push({ z0: 1.8 + jd, z1: 4.6 + jd, side: b, top: t, shape: (c, zt) => S.poly(c, sPts(zt)),
        tex: AS.Mat ? AS.Mat.join(mats().fine, headSides(sPts(0.5), 1.8 + jd, 4.6 + jd, E, { ez: 3.8 + jd, teeth: { col: '#f4f0dc', xs: [17, 15.6, 14.2, 12.8], h: 0.32, w: 0.22 }, lip: '#0a2a1c', lipW: 6, lipX: 13 })) : null,
        detail: (c) => {
          eyeArt(c, E);
          // a lid line sweeping back from each eye, gentle and long
          c.save(); c.strokeStyle = C.str(C.shade(lk.spine, -0.1)); c.lineWidth = 0.32; c.beginPath(); for (const sg of [1, -1]) { c.moveTo(6.2, sg * 2.7); c.quadraticCurveTo(4.6, sg * 3.1, 3.2, sg * 3.0); } c.stroke(); c.restore();
          // fine scale rows on the muzzle
          c.save(); c.strokeStyle = 'rgba(0,30,15,0.35)'; c.lineWidth = 0.28; c.beginPath(); for (let r = 0; r < 4; r++) for (let i = -1; i <= 1; i++) { const x = 16.5 - r * 1.5, y = i * 0.7 + (r % 2) * 0.35; c.moveTo(x + 0.35, y - 0.3); c.quadraticCurveTo(x - 0.2, y, x + 0.35, y + 0.3); } c.stroke(); c.restore();
          // gold filigree swirls along the snout and brow
          c.save(); c.strokeStyle = lk.spine; c.lineWidth = 0.35; c.beginPath();
          for (const sg of [1, -1]) { c.moveTo(16, sg * 0.6); c.bezierCurveTo(12, sg * 2, 8, sg * 0.6, 5, sg * 2.2); c.bezierCurveTo(3, sg * 3, 1, sg * 1.6, -1.5, sg * 2.2); }
          c.stroke(); c.restore();
          for (const sg of [1, -1]) { c.beginPath(); c.ellipse(18.2, sg * 0.85, 0.55, 0.28, sg * 0.4, 0, TAU); c.fillStyle = '#0a2a1a'; c.fill(); c.beginPath(); c.ellipse(18.0, sg * 1.05, 0.55, 0.16, sg * 0.4, 0, TAU); c.fillStyle = C.str(C.shade(t, 0.35)); c.fill(); }
        } });
      // soft brow ridges with gold scales, arched (not scowling)
      parts.push({ z0: 4.1 + jd, z1: 5.0 + jd, side: sh(b, -0.15), top: sh(t, 0.12), shape: (c, zt) => { const k = 1 - zt * 0.4; for (const sg of [1, -1]) S.poly(c, [10.2, sg * 1.5, 8.2, sg * (1.25 + 0.3 * k), 5.6, sg * (1.6 + 0.4 * k), 5.0, sg * 1.4, 7.8, sg * 0.95]); }, detail: (c) => { for (const sg of [1, -1]) for (let i = 0; i < 3; i++) S.dot(c, lk.spine, 9 - i * 1.4, sg * (1.3 + i * 0.1), 0.22); } });
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
      return { r: 19, h: 10, style: 'hero', parts, scale: 1.16 };
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
        claws(lk.spine, toeRow(4.9, 7.6, 0.6, 3, 0.55, 1.1), 0.2, 1.3),
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
        claws(lk.spine, toeRow(-6.1, 7.3, Math.PI - 0.5, 3, 0.55, 1.1), 0.2, 1.3),
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
      const E = { x: 8.5, y: 4.05, len: 3.0, wid: 1.1, tilt: 0.12, iris: ['#ffffff', '#a8e8ff', '#2a6aa0'], pupil: 'slit', sock: '#0a1a30', lid: '#08142a', lower: '#e8f6ff', brow: null };
      const tPts = (zt) => S.sym([15.6 - zt * 0.6, 0, 14.6, 3.2, 10, 4.8 - zt * 0.2, 4, 6 - zt * 0.4, -2, 5.6, -4.2, 0]);
      parts.push({ z0: 2.6 + jd, z1: 6.6 + jd, side: b, top: t, shape: (c, zt) => S.poly(c, tPts(zt)),
        tex: AS.Mat ? AS.Mat.join(mats().plates, headSides(tPts(0.5), 2.6 + jd, 6.6 + jd, E, { ez: 5.2 + jd, teeth: { col: '#f4fcff', xs: [14.2, 12.6, 11, 9.4, 7.8, 6.2], h: 0.55, w: 0.34 }, lip: '#0a1a30', lipW: 5, lipX: 10 })) : null,
        detail: (c) => {
          // armour plates
          S.lines(c, 'rgba(10,30,60,0.4)', 0.45, [13, -2.6, 13, 2.6, 8.6, -4.2, 8.6, 4.2, 3.6, -5.2, 3.6, 5.2, 13, 0, 3.6, 0]);
          eyeArt(c, E);
          for (const sg of [1, -1]) { c.beginPath(); c.ellipse(14.7, sg * 1.45, 0.6, 0.38, sg * 0.3, 0, TAU); c.fillStyle = '#0a1a2a'; c.fill(); c.beginPath(); c.ellipse(14.55, sg * 1.75, 0.6, 0.16, sg * 0.3, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill(); }
        } });
      // the hood: a massive crystal-rimmed brow plate overhanging each eye, so it glares out from under it
      parts.push({ z0: 6.0 + jd, z1: 7.3 + jd, side: sh(b, -0.12), top: sh(t, 0.16), shape: (c, zt) => { const k = 1 - zt * 0.3; for (const sg of [1, -1]) S.poly(c, [11.2, sg * 2.5, 9.6, sg * (3.05 + 0.3 * k), 6.0, sg * (3.45 + 0.35 * k), 4.6, sg * (3.4 + 0.2 * k), 5.6, sg * 2.7, 9.4, sg * 2.1]); },
        detail: (c) => { for (const sg of [1, -1]) S.lines(c, 'rgba(255,255,255,0.75)', 0.45, [10.6, sg * 2.75, 6.2, sg * 3.55]); } });
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
          detail: (c) => S.lines(c, 'rgba(10,30,60,0.45)', 0.35, [5.4, 7.4, 3.6, 7.8, 5.2, 8.8, 3.4, 8.9, 5.4, -7.4, 3.6, -7.8, 5.2, -8.8, 3.4, -8.9]) },
        claws(lk.crystal, toeRow(6.0, 8.3, 0.4, 3, 1.0, 1.9), 0.3, 2.0),
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
        claws(lk.crystal, toeRow(-7.2, 8.0, Math.PI - 0.35, 3, 1.0, 1.9), 0.3, 2.0),
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
      const E = { x: 5.4, y: 2.75, len: 2.6, wid: 1.5, tilt: 0.35, iris: ['#f0ffd8', '#8cff5a', '#1a3a10'], pupil: 'flame', sock: '#0c060a', lid: '#0c060a', lower: '#0c060a', brow: null };
      const bPts = (zt) => S.sym([16.5 - zt * 0.8, 0, 15, 1.8, 11, 2.6, 7, 3.2, 3, 4.6 - zt * 0.4, -1, 4.8 - zt * 0.5, -4.5, 3.2, -5.5, 0]);
      parts.push({ z0: 1.8 + jd, z1: 5.8 + jd, side: sh(bone, -0.3), top: bone, shape: (c, zt) => S.poly(c, bPts(zt)),
        tex: AS.Mat ? AS.Mat.join(mats().bone, headSides(bPts(0.5), 1.8 + jd, 5.8 + jd, E, { ez: 4.6 + jd, teeth: { col: '#f8f2e0', xs: [14.4, 12.8, 11.2, 9.6, 8.0, 6.4], h: 0.55, w: 0.3 }, lip: '#0c060a', lipW: 6.5, lipX: 9.5 })) : null,
        detail: (c) => {
          // deep sockets under a bony brow, the cheekbone arch below each, nasal cavity and cracks
          c.fillStyle = '#120a10';
          for (const sg of [1, -1]) { c.beginPath(); c.ellipse(5.4, sg * 2.6, 2.3, 1.45, sg * 0.35, 0, TAU); c.fill(); }
          c.save(); c.lineCap = 'round';
          for (const sg of [1, -1]) {
            c.beginPath(); c.moveTo(7.9, sg * 1.5); c.quadraticCurveTo(5.4, sg * 0.7, 3.0, sg * 1.9); c.lineWidth = 0.75; c.strokeStyle = '#fbf6e6'; c.stroke(); // brow bone, lit
            c.beginPath(); c.moveTo(7.4, sg * 3.35); c.quadraticCurveTo(5, sg * 4.6, 2.2, sg * 4.2); c.lineWidth = 0.5; c.strokeStyle = C.str(C.shade(bone, -0.35)); c.stroke(); // cheekbone arch shadow
          }
          c.restore();
          eyeArt(c, E);
          c.beginPath(); c.moveTo(15.4, 0); c.lineTo(13.2, 0.9); c.lineTo(13.2, -0.9); c.fill();
          S.lines(c, 'rgba(60,40,30,0.55)', 0.35, [1, 1, -2.5, 2.4, -1.4, 1.6, -3, 0.6, 10, -1.4, 8, -2]);
          // teeth along the upper jaw
          c.fillStyle = '#f8f2e0';
          for (const sg of [1, -1]) for (let i = 0; i < 7; i++) { const x = 14.4 - i * 1.9; c.beginPath(); c.moveTo(x, sg * (1.7 + i * 0.12)); c.lineTo(x - 0.5, sg * (2.6 + i * 0.12)); c.lineTo(x - 0.9, sg * (1.8 + i * 0.12)); c.fill(); }
        } });

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
        claws(lk.bone, toeRow(9.2, 7.4, 0.15, 3, 0.65, 1.5), 0.1, 1.2),
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
        claws(lk.bone, toeRow(-8.6, 7.0, Math.PI - 0.1, 3, 0.65, 1.5), 0.1, 1.2),
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

  /* the model of one segment of a rig: o = { fk, scale, i } (i = chain index or 'headopen') */
  function segModel(o) {
    const fk = o.fk, scale = o.scale || 1;
    const lk = LOOKS[fk] || LOOKS.human, K = KINDS[fk] || Wyrm, chain = CHAINS[fk] || CHAIN;
    const sc = (m) => { m.scale = (m.scale || 1) * scale; return finish(m, lk); };
    if (o.i === 'headopen') return sc(K.head(lk, true));
    const n = chain[o.i];
    if (n.k === 'head') return sc(K.head(lk, false));
    if (n.k === 'neck') { let ni = 0; for (let j = 0; j <= o.i; j++) if (chain[j].k === 'neck') ni++; return sc(K.neck(lk, n.w, ni)); }
    if (n.k === 'chest') return sc(K.chest(lk));
    if (n.k === 'hips') return sc(K.hips(lk));
    if (n.k === 'tail') return sc(K.tail(lk, n.w, n.L));
    return sc(K.tip(lk));
  }
  AS.Models = AS.Models || {};
  AS.Models.drg_seg = (pal, o) => segModel(o && o.fk ? o : { fk: 'human', scale: 1, i: 0 });

  const rigCache = new Map();
  function rig(fk, scale) {
    scale = scale || 1;
    const key = fk + ':' + scale.toFixed(2);
    let r = rigCache.get(key);
    if (r) return r;
    const lk = LOOKS[fk] || LOOKS.human, K = KINDS[fk] || Wyrm, chain = CHAINS[fk] || CHAIN;
    const F = AS.Forge, D = 32;
    // each segment's model comes from a recipe (drg_seg below), so the forge workers can draw it
    const sheets = chain.map((n, i) => F.sheet('drg2:' + key + ':' + i, F.recipe('drg_seg', {}, { fk, scale, i }), D, 1));
    const headOpen = F.sheet('drg2:' + key + ':headopen', F.recipe('drg_seg', {}, { fk, scale, i: 'headopen' }), D, 1);
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
          if (!f) f = shd.__belly = [];
          if (!f[di]) { const c = AS.Forge.canvas(img.width, img.height, true), x2 = c.getContext('2d'); x2.drawImage(img, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = belly; x2.fillRect(0, 0, c.width, c.height); f[di] = c; }
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
      st.staffX = sx; st.staffY = sy - z - 9.5; st.staffZ = z + 9.5; st.staffAt = AS.game ? AS.game.time : 0; // (fresh only while drawn)
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

    // a tapered, lit bone between two screen points: dark underside, the bone, a highlight along its top
    taperBone(ctx, ax, ay, bx, by, w0, w1, col, k) {
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const quad = (e) => { ctx.beginPath(); ctx.moveTo(ax + nx * (w0 / 2 + e), ay + ny * (w0 / 2 + e)); ctx.lineTo(bx + nx * (w1 / 2 + e), by + ny * (w1 / 2 + e)); ctx.lineTo(bx - nx * (w1 / 2 + e), by - ny * (w1 / 2 + e)); ctx.lineTo(ax - nx * (w0 / 2 + e), ay - ny * (w0 / 2 + e)); ctx.closePath(); };
      quad(0.45); ctx.fillStyle = C.str(C.shade(col, -0.55)); ctx.fill();
      quad(0); ctx.fillStyle = C.str(C.shade(col, (k - 1) * 0.6)); ctx.fill();
      // the lit edge faces up-left on screen
      const sgn = (nx * -0.6 + ny * -0.8) > 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(ax + nx * sgn * w0 * 0.28, ay + ny * sgn * w0 * 0.28); ctx.lineTo(bx + nx * sgn * w1 * 0.28, by + ny * sgn * w1 * 0.28);
      ctx.lineWidth = Math.max(0.5, (w0 + w1) * 0.14); ctx.strokeStyle = C.str(C.shade(col, (k - 1) * 0.5 + 0.35), 0.85); ctx.stroke();
    },
    knuckle(ctx, x, y, r, col, k) {
      ctx.beginPath(); ctx.arc(x, y, r + 0.45, 0, TAU); ctx.fillStyle = C.str(C.shade(col, -0.55)); ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r); g.addColorStop(0, C.str(C.shade(col, (k - 1) * 0.5 + 0.35))); g.addColorStop(1, C.str(C.shade(col, (k - 1) * 0.6 - 0.15)));
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
    },
    // the membrane's form: it bellies out between bones (lit down the middle of each panel, shaded along the
    // bones), creases fan from the root, and veins branch off the fingers
    membraneForm(ctx, P, X, Y, s, k, mem, path, o) {
      ctx.save(); path(); ctx.clip();
      ctx.lineCap = 'round';
      const W = [X(P[2]), Y(P[2])], tip = (i) => [X(P[i]), Y(P[i])];
      for (let i = 3; i < 7; i++) {
        const a = tip(i), b = i < 6 ? tip(i + 1) : [X(P[7]), Y(P[7])];
        // shade hugging each bone
        ctx.beginPath(); ctx.moveTo(W[0], W[1]); ctx.lineTo(a[0], a[1]); ctx.lineWidth = 3.2 * s; ctx.strokeStyle = C.str(C.shade(mem, -0.6), 0.22); ctx.stroke();
        // the bellied middle of the panel catching the light
        const m = [(a[0] + b[0]) / 2 * 0.8 + W[0] * 0.2, (a[1] + b[1]) / 2 * 0.8 + W[1] * 0.2];
        const g = ctx.createLinearGradient(W[0], W[1], m[0], m[1]);
        g.addColorStop(0, C.str(C.shade(mem, 0.5), 0)); g.addColorStop(0.55, C.str(C.shade(mem, 0.45 + (k - 1) * 0.5), 0.26)); g.addColorStop(1, C.str(C.shade(mem, 0.3), 0.08));
        ctx.beginPath(); ctx.moveTo(W[0], W[1]); ctx.lineTo(m[0], m[1]); ctx.lineWidth = 4.2 * s; ctx.strokeStyle = g; ctx.stroke();
        // veins branching off the finger into the panel
        ctx.beginPath();
        for (const u of [0.32, 0.55, 0.76]) {
          const fx = U.lerp(W[0], a[0], u), fy = U.lerp(W[1], a[1], u), tx = U.lerp(fx, m[0] + (a[0] - W[0]) * u * 0.25, 0.42), ty = U.lerp(fy, m[1] + (a[1] - W[1]) * u * 0.25, 0.42);
          ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + tx) / 2 + (ty - fy) * 0.2, (fy + ty) / 2 - (tx - fx) * 0.2, tx, ty);
        }
        ctx.lineWidth = 0.45; ctx.strokeStyle = C.str(C.shade(mem, -0.5), 0.5); ctx.stroke();
      }
      // creases fanning out of the root into the inner panel
      const S0 = [X(P[0]), Y(P[0])], E1 = [X(P[1]), Y(P[1])], F = [X(P[7]), Y(P[7])], T6 = tip(6);
      for (let j = 0; j < (o && o.creases || 4); j++) {
        const u = (j + 1) / 5, st0 = [U.lerp(S0[0], E1[0], u * 0.8), U.lerp(S0[1], E1[1], u * 0.8)], en = [U.lerp(F[0], T6[0], u), U.lerp(F[1], T6[1], u)];
        const mx = U.lerp(st0[0], en[0], 0.45), my = U.lerp(st0[1], en[1], 0.45);
        ctx.beginPath(); ctx.moveTo(st0[0], st0[1]); ctx.quadraticCurveTo(mx + 1.2 * s, my + 0.8 * s, U.lerp(st0[0], en[0], 0.7), U.lerp(st0[1], en[1], 0.7));
        ctx.lineWidth = 0.7; ctx.strokeStyle = C.str(C.shade(mem, -0.6), 0.45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(st0[0] + 0.7, st0[1] - 0.5); ctx.quadraticCurveTo(mx + 1.9 * s, my + 0.3 * s, U.lerp(st0[0], en[0], 0.68) + 0.7, U.lerp(st0[1], en[1], 0.68) - 0.5);
        ctx.lineWidth = 0.5; ctx.strokeStyle = C.str(C.shade(mem, 0.45), 0.3); ctx.stroke();
      }
      ctx.restore();
    },
    // where the wing grows out of the shoulder: a fillet of body scales over the root
    wingRoot(ctx, P, X, Y, s, lk, k) {
      const x = X(P[0]), y = Y(P[0]), g = ctx.createRadialGradient(x - s, y - s, 0, x, y, 3.0 * s);
      g.addColorStop(0, C.str(C.shade(lk.top || lk.body, (k - 1) * 0.5 + 0.12))); g.addColorStop(1, C.str(C.shade(lk.body, (k - 1) * 0.6 - 0.1), 0));
      ctx.beginPath(); ctx.ellipse(x, y, 3.0 * s, 2.3 * s, 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
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
      gr.addColorStop(0, C.str(C.shade(mem, (k - 1) * 0.9 - 0.22)));
      gr.addColorStop(0.5, C.str(C.shade(mem, (k - 1) * 0.9)));
      gr.addColorStop(1, C.str(C.shade('#ff7a2a', (k - 1) * 0.6 - 0.1), 0.95)); // the sun glowing through the thin trailing edge
      ctx.fillStyle = gr; ctx.fill();
      this.membraneForm(ctx, P, X, Y, s, k, mem, path);
      // the thin trailing edge, a lighter rim, and the outline
      path(); ctx.strokeStyle = C.str(C.shade('#ffb070', (k - 1) * 0.5), 0.35); ctx.lineWidth = 1.6; ctx.stroke();
      path(); ctx.strokeStyle = 'rgba(30,6,4,0.85)'; ctx.lineWidth = 0.8; ctx.stroke();
      this.wingRoot(ctx, P, X, Y, s, lk, k);
      // fingers: tapered bones with a knuckle part-way out
      for (let i = 3; i < 7; i++) {
        const ax = X(P[2]), ay = Y(P[2]), bx = X(P[i]), by = Y(P[i]);
        this.taperBone(ctx, ax, ay, bx, by, 1.5 * s, 0.4 * s, lk.bone, k);
        this.knuckle(ctx, U.lerp(ax, bx, 0.42), U.lerp(ay, by, 0.42), 0.55 * s, lk.bone, k);
      }
      // the arm: the wing's thick leading edge, shoulder to elbow to wrist
      this.taperBone(ctx, X(P[0]), Y(P[0]), X(P[1]), Y(P[1]), 3.4 * s, 2.6 * s, lk.bone, k);
      this.taperBone(ctx, X(P[1]), Y(P[1]), X(P[2]), Y(P[2]), 2.6 * s, 2.0 * s, lk.bone, k);
      this.knuckle(ctx, X(P[1]), Y(P[1]), 1.45 * s, lk.bone, k);
      this.knuckle(ctx, X(P[2]), Y(P[2]), 1.3 * s, lk.bone, k);
      // the thumb claw, hooked forward off the wrist
      const tx = X(P[2]), ty = Y(P[2]), dx = X(P[2]) - X(P[1]), dy = Y(P[2]) - Y(P[1]), dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
      ctx.beginPath(); ctx.moveTo(tx - uy * 1.0 * s, ty + ux * 1.0 * s); ctx.quadraticCurveTo(tx + ux * 3.2 * s - uy * 0.6 * s, ty + uy * 3.2 * s + ux * 0.6 * s, tx + ux * 4.4 * s + uy * 0.9 * s, ty + uy * 4.4 * s - ux * 0.9 * s);
      ctx.quadraticCurveTo(tx + ux * 2.4 * s + uy * 0.9 * s, ty + uy * 2.4 * s - ux * 0.9 * s, tx + uy * 1.0 * s, ty - ux * 1.0 * s); ctx.closePath();
      ctx.fillStyle = C.str(C.shade(lk.horn, (k - 1) * 0.5)); ctx.fill(); ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.lineWidth = 0.5; ctx.stroke();
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
      const leaf = (bx, by, tx, ty, wk, c0, c1, veins) => {
        // the shadow it casts on the leaf beneath, then the leaf with a lit midrib and side veins
        ctx.beginPath(); leafPath(ctx, bx + 0.8, by + 1.0, tx + 0.8, ty + 1.0, wk); ctx.fillStyle = 'rgba(4,30,14,0.28)'; ctx.fill();
        const gr = ctx.createLinearGradient(bx, by, tx, ty);
        gr.addColorStop(0, c0); gr.addColorStop(1, c1);
        ctx.beginPath(); leafPath(ctx, bx, by, tx, ty, wk);
        ctx.fillStyle = gr; ctx.fill();
        ctx.strokeStyle = 'rgba(8,40,20,0.75)'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(250,236,160,0.6)'; ctx.lineWidth = 0.42;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(U.lerp(bx, tx, 0.92), U.lerp(by, ty, 0.92));
        if (veins) {
          const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w = L * wk * 0.8;
          for (const u of [0.3, 0.5, 0.7]) { const px = bx + dx * u, py = by + dy * u; for (const sg of [1, -1]) { ctx.moveTo(px, py); ctx.lineTo(px + dx * 0.12 + nx * w * sg * (1 - u * 0.6), py + dy * 0.12 + ny * w * sg * (1 - u * 0.6)); } }
        }
        ctx.stroke();
      };
      const dark = C.str(C.shade(lk.membrane, (k - 1) * 0.8 - 0.22)), mid = C.str(C.shade(lk.leaf, (k - 1) * 0.8)), gold = C.str(C.shade(lk.leaf2, (k - 1) * 0.6));
      // flight feathers: inner ones first, the long outer primaries on top
      for (let i = N - 1; i >= 0; i--) {
        const t = i / (N - 1);
        const [bx, by] = along(arm, Math.min(1, t * 1.08));
        const [tx, ty] = along(trail, t);
        leaf(bx, by, tx, ty, i < 4 ? 0.13 : 0.17, dark, i < 5 ? gold : mid, true);
      }
      // a row of short covert leaves along the arm
      for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8;
        const [bx, by] = along(arm, t);
        const [tx, ty] = along(trail, t);
        leaf(bx, by, U.lerp(bx, tx, 0.42), U.lerp(by, ty, 0.42), 0.26, mid, C.str(C.shade(lk.leaf, (k - 1) * 0.8 + 0.12)), false);
      }
      this.wingRoot(ctx, P, X, Y, s, lk, k);
      // the arm: a slim living branch with knots at the joints
      this.taperBone(ctx, X(P[0]), Y(P[0]), X(P[1]), Y(P[1]), 2.2 * s, 1.7 * s, lk.bone, k);
      this.taperBone(ctx, X(P[1]), Y(P[1]), X(P[2]), Y(P[2]), 1.7 * s, 1.2 * s, lk.bone, k);
      this.knuckle(ctx, X(P[1]), Y(P[1]), 1.0 * s, lk.bone, k);
      this.knuckle(ctx, X(P[2]), Y(P[2]), 0.9 * s, lk.bone, k);
    },

    /* Hrimgard: a membrane of ice facets with a jagged trailing edge, held on pale finger struts */
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
      const rng = new U.RNG(311 + (wp.side > 0 ? 5 : 0));
      // facets fanning from the wrist and the elbow, each with a fracture inside it
      const tri = (a, b, c, i) => {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
        const v = ((i * 37) % 7) / 7 - 0.5;
        const g = ctx.createLinearGradient(a[0], a[1], (b[0] + c[0]) / 2, (b[1] + c[1]) / 2);
        g.addColorStop(0, C.str(C.shade(mem, (k - 1) * 0.9 + v * 0.28 - 0.12), 0.82)); g.addColorStop(1, C.str(C.shade(mem, (k - 1) * 0.9 + v * 0.28 + 0.18), 0.7));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(240,252,255,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
        const u = 0.3 + rng.next() * 0.4, w = 0.3 + rng.next() * 0.4, px = U.lerp(a[0], U.lerp(b[0], c[0], w), u), py = U.lerp(a[1], U.lerp(b[1], c[1], w), u);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(U.lerp(px, b[0], 0.5), U.lerp(py, b[1], 0.5)); ctx.moveTo(px, py); ctx.lineTo(U.lerp(px, c[0], 0.35), U.lerp(py, c[1], 0.35));
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.35; ctx.stroke();
      };
      for (let i = 0; i < 5; i++) tri(W2, edge[i], edge[i + 1], i);
      for (let i = 5; i < edge.length - 1; i++) tri(E1, edge[i], edge[i + 1], i);
      tri(E1, W2, edge[5], 11); tri(S0, E1, edge[edge.length - 1], 13);
      // a frosted bright rim and the dark edge
      ctx.strokeStyle = 'rgba(30,70,120,0.7)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]); for (const p of edge) ctx.lineTo(p[0], p[1]); ctx.lineTo(S0[0], S0[1]); ctx.stroke();
      this.wingRoot(ctx, P, X, Y, s, lk, k);
      // finger struts of pale ice-bone out to the tips, rimed at the joints
      for (let i = 0; i < 4; i++) { const p = edge[i * 2]; this.taperBone(ctx, W2[0], W2[1], p[0], p[1], 1.3 * s, 0.35 * s, lk.bone, k); this.knuckle(ctx, U.lerp(W2[0], p[0], 0.45), U.lerp(W2[1], p[1], 0.45), 0.5 * s, '#ffffff', k); }
      this.taperBone(ctx, S0[0], S0[1], E1[0], E1[1], 3.2 * s, 2.5 * s, lk.bone, k);
      this.taperBone(ctx, E1[0], E1[1], W2[0], W2[1], 2.5 * s, 1.9 * s, lk.bone, k);
      this.knuckle(ctx, E1[0], E1[1], 1.4 * s, lk.bone, k); this.knuckle(ctx, W2[0], W2[1], 1.25 * s, lk.bone, k);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(S0[0], S0[1] - 1); ctx.lineTo(E1[0], E1[1] - 1); ctx.lineTo(W2[0], W2[1] - 1); ctx.lineTo(edge[0][0], edge[0][1]); ctx.stroke();
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
      // rot stains and dark veins in what is left of the membrane
      ctx.save(); ctx.beginPath(); ctx.moveTo(X(P[0]), Y(P[0])); ctx.lineTo(X(P[1]), Y(P[1])); ctx.lineTo(X(P[2]), Y(P[2])); for (let i = 3; i < 7; i++) { const f = fin(i); ctx.lineTo(f[0], f[1]); } ctx.lineTo(X(P[7]), Y(P[7])); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 5; i++) { const p = P[3 + (i % 4)], q = P[1 + (i % 2)], u = 0.25 + rng.next() * 0.5, hx = U.lerp(X(p), X(q), u), hy = U.lerp(Y(p), Y(q), u), r = (2 + rng.next() * 2.5) * s; const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r); g.addColorStop(0, 'rgba(20,10,24,0.45)'); g.addColorStop(1, 'rgba(20,10,24,0)'); ctx.fillStyle = g; ctx.fillRect(hx - r, hy - r, r * 2, r * 2); }
      ctx.beginPath(); for (let i = 3; i < 7; i++) { const W = [X(P[2]), Y(P[2])], a = [X(P[i]), Y(P[i])]; for (const u of [0.35, 0.6]) { const fx = U.lerp(W[0], a[0], u), fy = U.lerp(W[1], a[1], u); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + 2 * s, fy + 2.5 * s, fx + 1 * s, fy + 4.5 * s); } }
      ctx.lineWidth = 0.45; ctx.strokeStyle = 'rgba(10,4,14,0.6)'; ctx.stroke(); ctx.restore();
      // the bones: arm, knuckles and long jointed finger bones ending in claws
      this.taperBone(ctx, X(P[0]), Y(P[0]), X(P[1]), Y(P[1]), 2.8 * s, 2.0 * s, lk.bone, k);
      this.taperBone(ctx, X(P[1]), Y(P[1]), X(P[2]), Y(P[2]), 2.0 * s, 1.6 * s, lk.bone, k);
      for (let i = 3; i < 7; i++) {
        const ax = X(P[2]), ay = Y(P[2]), bx = X(P[i]), by = Y(P[i]);
        this.taperBone(ctx, ax, ay, bx, by, 1.2 * s, 0.45 * s, lk.bone, k);
        for (const u of [0.38, 0.7]) this.knuckle(ctx, U.lerp(ax, bx, u), U.lerp(ay, by, u), (0.6 - u * 0.3) * s, lk.bone, k);
        this.knuckle(ctx, bx, by, 0.55 * s, lk.bone, k);
      }
      this.knuckle(ctx, X(P[1]), Y(P[1]), 1.35 * s, lk.bone, k);
      this.knuckle(ctx, X(P[2]), Y(P[2]), 1.25 * s, lk.bone, k);
    },

    /* ground shadow of the whole dragon (body silhouettes + wing polygons), cast as ONE
     * shape: every piece is drawn solid into a small buffer, which then goes onto the
     * ground once at the shadow's strength (the caller's globalAlpha). Overlapping
     * pieces no longer darken each other, and the buffer's lower resolution, smoothed
     * when it is laid down, gives the shadow a slightly soft edge. */
    drawShadow(ctx, st, ox, oy) {
      const rg = rig(st.fk, st.scale), n = st.nodes;
      const pieces = [], wings = [];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < n.length; i++) {
        const nd = n[i], shd = rg.sheets[i];
        const off = 2 + nd.z * 0.12, x = nd.x - shd.ax + off + nd.z * 0.15, y = nd.y - shd.ay + off * 0.5;
        pieces.push([shd.shadows[AS.Forge.frameIndex(shd, nd.a)], x, y, shd.w, shd.h]);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + shd.w); y1 = Math.max(y1, y + shd.h);
      }
      for (const side of [-1, 1]) {
        const P = this.wingPoly(st, side, rg).pts, pts = [];
        for (const p of P) { const off = 2 + p.z * 0.12, x = p.x + off + p.z * 0.15, y = p.y + off * 0.5; pts.push(x, y); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        wings.push(pts);
      }
      const pad = 4; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      const k = Math.max(0.5, ((AS.Renderer && AS.Renderer.res) || 1) * 0.32); // buffer texels per world unit
      const W = Math.ceil((x1 - x0) * k), H = Math.ceil((y1 - y0) * k);
      let cv = this._shadowCv;
      if (!cv || cv.width < W || cv.height < H) cv = this._shadowCv = AS.Forge.canvas(Math.max(W, cv ? cv.width : 0), Math.max(H, cv ? cv.height : 0));
      const c = cv.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W + 2, H + 2);
      c.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
      c.imageSmoothingEnabled = true;
      for (const [img, x, y, w, h] of pieces) c.drawImage(img, x, y, w, h);
      c.fillStyle = '#000';
      for (const pts of wings) { c.beginPath(); for (let i = 0; i < pts.length; i += 2) { if (i) c.lineTo(pts[i], pts[i + 1]); else c.moveTo(pts[i], pts[i + 1]); } c.closePath(); c.fill(); }
      const q = ctx.imageSmoothingQuality;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cv, 0, 0, W, H, x0 - ox, y0 - oy, W / k, H / k);
      ctx.imageSmoothingQuality = q;
    },
  };
  AS.DragonArt = Art;
  AS.Data = AS.Data || {};
  AS.Data.dragonLooks = LOOKS;
})(window.AS);
