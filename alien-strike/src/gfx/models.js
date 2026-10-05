/* ALIEN STRIKE — stacked-model library, part 1: shape helpers + player craft.
 * Models are plain data: { r, h, parts:[...] } consumed by AS.Forge. Object space:
 * +x = forward (nose), +y = starboard. Units are world pixels. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;

  const S = {
    poly(ctx, pts) {
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
    },
    // Mirror a half outline (points along +y side from nose to tail) to a closed shape.
    sym(half) {
      const out = half.slice();
      for (let i = half.length - 2; i >= 0; i -= 2) if (half[i + 1] !== 0) out.push(half[i], -half[i + 1]);
      return out;
    },
    circ(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); },
    ell(ctx, x, y, rx, ry, rot) { ctx.moveTo(x + Math.cos(rot || 0) * rx, y + Math.sin(rot || 0) * rx); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); },
    rect(ctx, x, y, w, h) { ctx.rect(x, y, w, h); },
    rrect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },
    // Irregular blob (rocks, organic masses), deterministic by seed.
    blob(ctx, x, y, r, seed, lumps, rough) {
      lumps = lumps || 9; rough = rough === undefined ? 0.28 : rough;
      for (let i = 0; i <= lumps; i++) {
        const a = (i % lumps) / lumps * TAU;
        const rr = r * (1 - rough / 2 + U.hash2(i % lumps, seed, 77) * rough);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    },
    star(ctx, x, y, r1, r2, n, rot) {
      for (let i = 0; i < n * 2; i++) {
        const a = (rot || 0) + (i / (n * 2)) * TAU;
        const r = i % 2 ? r2 : r1;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
    },
    // Line segment as a path (for stroked parts)
    seg(ctx, x1, y1, x2, y2) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); },
    lines(ctx, color, w, segs) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i < segs.length; i += 4) { ctx.moveTo(segs[i], segs[i + 1]); ctx.lineTo(segs[i + 2], segs[i + 3]); }
      ctx.stroke(); ctx.restore();
    },
    dot(ctx, color, x, y, r) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); },
    fillPoly(ctx, color, pts) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); S.poly(ctx, pts); ctx.fill(); ctx.restore(); },
  };

  /* ------------------------------------------------------------------
   * PLAYER CRAFT — "Vesper", a hovering gunship built around a salvaged
   * Choir drive core. Upgrades (u = level map) visibly change the model;
   * opts.damage = 1 renders the battle-damaged variant. Besides the parts,
   * the model exports emitter points the engine animates every frame:
   * propulsion rings, engine exhausts, retro / lateral thrusters, nav lights
   * and the ventral retrieval-beam emitter (object space, z = height).
   * ------------------------------------------------------------------ */
  function craftModel(u, opts) {
    u = u || {}; opts = opts || {};
    const lv = (k) => u[k] || 0;
    const armor = lv('armor'), speed = lv('speed'), scan = lv('scanner'), fuel = lv('fuelCap');
    const cargo = lv('cargo') + lv('rescue'), shield = lv('shield');
    const techTier = Math.min(3, Math.floor((armor + speed + shield + scan + lv('shieldRegen') + lv('pDamage') + lv('sMulti')) / 4));
    const dmg = opts.damage || 0;
    const hullS = techTier >= 2 ? '#4c5664' : '#565e69';
    const hullT = techTier >= 2 ? '#aab7c6' : '#a6aeb8';
    const panelC = techTier >= 2 ? '#7f8c9c' : '#7d8590';
    const dark = '#262b33', darker = '#181c22', metal = '#3a414b';
    const trim = techTier >= 3 ? '#e4ddcb' : '#de9c3a';
    const glowC = techTier >= 2 ? '#7ff8ff' : '#5fe6ff';
    const seam = 'rgba(24,28,34,0.55)', seamLight = 'rgba(255,255,255,0.22)';

    const ringR = 5.2 + speed * 0.35;
    const wingTip = 23 + (armor >= 3 ? 1 : 0);
    const bayW = 6.4 + Math.min(3, cargo) * 0.55;
    const fus = S.sym([27, 0, 22.5, 2.4, 15, 4.8, 5, 6.6, -6, 7, -17, 6, -21.5, 4.2, -23, 0]);
    const wingHalf = [10, 5.5, -3, 20.5, -5.5, wingTip, -13.5, wingTip + 0.4, -16, 7.6];
    const mirror = (pts) => pts.map((v, i) => (i % 2 ? -v : v));
    const parts = [];
    const scorch = (c, x, y, r) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(16,12,10,0.85)'); g.addColorStop(0.6, 'rgba(30,22,18,0.45)'); g.addColorStop(1, 'rgba(30,22,18,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

    // ventral skirt — the dark anti-grav plate the craft hovers on
    parts.push({ z0: 0, z1: 1.6, side: darker, top: '#2c323b', bevel: false, shape: (c) => { S.poly(c, S.sym([24, 0, 14, 4.2, 4, 6, -16, 5.6, -21, 0])); S.poly(c, [8, 5, -4, wingTip - 3, -12, wingTip - 2.6, -14, 7]); S.poly(c, mirror([8, 5, -4, wingTip - 3, -12, wingTip - 2.6, -14, 7])); } });
    // swept wings
    parts.push({
      z0: 1.6, z1: 3.4, side: hullS, top: hullT, shape: (c) => { S.poly(c, wingHalf); S.poly(c, mirror(wingHalf)); },
      detail: (c) => {
        for (const sg of [1, -1]) {
          S.lines(c, seam, 0.45, [6, 7 * sg, -12.5, 8.6 * sg, 0, 13.5 * sg, -13, 15 * sg, -6, 19.5 * sg, -13.4, 20.5 * sg]);
          S.lines(c, seamLight, 0.5, [9.6, 5.9 * sg, -2.8, 20.2 * sg]);
          S.fillPoly(c, trim, [-4.2, (wingTip - 2.2) * sg, -12.6, (wingTip - 1.8) * sg, -12.9, (wingTip - 3.2) * sg, -4.9, (wingTip - 3.6) * sg]);
        }
        if (dmg) { scorch(c, -7, 15, 4.5); scorch(c, -9, -11, 3.2); c.fillStyle = 'rgba(14,16,20,0.9)'; c.beginPath(); S.poly(c, [-2, 16.5, -6, 17.8, -7.4, 15.2, -3.6, 14.4]); c.fill(); }
      },
    });
    // wingtip pods with nav lights (port red, starboard green)
    parts.push({
      z0: 1.6, z1: 4.6, side: metal, top: panelC, shape: (c) => { S.rrect(c, -14, wingTip - 1.9, 11.5, 3.6, 1.6); S.rrect(c, -14, -wingTip - 1.7, 11.5, 3.6, 1.6); },
      detail: (c) => { S.dot(c, '#5aff7a', -2.8, wingTip - 0.1, 0.85); S.dot(c, '#ff4a4a', -2.8, -wingTip + 0.1, 0.85); S.lines(c, seam, 0.35, [-8, wingTip - 1.8, -8, wingTip + 1.6, -8, -wingTip - 1.6, -8, -wingTip + 1.8]); },
    });
    // armour plates on the wing roots (upgrade)
    if (armor >= 1) parts.push({ z0: 3.4, z1: 4.4, side: '#3d444e', top: armor >= 4 ? '#8b95a1' : '#737c87', shape: (c) => { S.poly(c, [7, 6.4, -2.5, 16.5, -10, 16.2, -12.5, 8]); S.poly(c, mirror([7, 6.4, -2.5, 16.5, -10, 16.2, -12.5, 8])); },
      detail: (c) => S.lines(c, seam, 0.4, [2, 8, -9, 9.5, 2, -8, -9, -9.5]) });
    // propulsion rings — anti-grav emitters at the wing roots
    const ringPts = [[-3, 14], [-3, -14]];
    parts.push({ z0: 2.6, z1: 6.2, side: '#323b45', top: '#a7bacb', stroke: 2.3 + speed * 0.25, bevel: false, shape: (c) => { for (const p of ringPts) S.circ(c, p[0], p[1], ringR); } });
    parts.push({ z0: 3.4, z1: 3.4, side: glowC, top: C.shade(glowC, -0.25), flat: true, shape: (c) => { for (const p of ringPts) S.circ(c, p[0], p[1], ringR - 1.6); },
      detail: (c) => { for (const p of ringPts) { S.dot(c, C.shade(glowC, 0.45), p[0], p[1], ringR * 0.45); S.lines(c, 'rgba(20,40,50,0.5)', 0.35, [p[0] - ringR + 1.8, p[1], p[0] + ringR - 1.8, p[1], p[0], p[1] - ringR + 1.8, p[0], p[1] + ringR - 1.8]); } } });
    // hardpoint pylons for the weapon pods
    parts.push({ z0: 2, z1: 5.6, side: dark, top: metal, shape: (c) => { S.rrect(c, 1, 6.5, 6, 4.5, 1); S.rrect(c, 1, -11, 6, 4.5, 1); } });
    // fuel saddle tanks (upgrade)
    if (fuel >= 1) parts.push({ z0: 2.6, z1: 6.6, side: '#6d5a38', top: '#b39758', shape: (c) => { S.rrect(c, -11, 6.6, 12, 3.4, 1.7); S.rrect(c, -11, -10, 12, 3.4, 1.7); },
      detail: (c) => S.lines(c, 'rgba(40,30,16,0.6)', 0.4, [-7, 6.8, -7, 9.8, -3, 6.8, -3, 9.8, -7, -6.8, -7, -9.8, -3, -6.8, -3, -9.8]) });
    // main fuselage
    parts.push({
      z0: 1.6, z1: 7, side: hullS, top: hullT, shape: (c) => S.poly(c, fus),
      detail: (c) => {
        S.lines(c, seam, 0.45, [20, 0, -20, 0, 8, -6.4, 8, 6.4, -4, -6.9, -4, 6.9, -15, -6, -15, 6]);
        S.lines(c, seamLight, 0.5, [26.4, 0.4, 15, 4.4, 26.4, -0.4, 15, -4.4]);
        // intakes and lateral thruster ports
        c.fillStyle = darker; c.beginPath(); S.rrect(c, -1, 4.6, 6, 1.5, 0.6); c.fill(); c.beginPath(); S.rrect(c, -1, -6.1, 6, 1.5, 0.6); c.fill();
        S.dot(c, '#14171c', 1.5, 6.6, 0.7); S.dot(c, '#14171c', 1.5, -6.6, 0.7); S.dot(c, '#14171c', -12, 6.6, 0.7); S.dot(c, '#14171c', -12, -6.6, 0.7);
        S.fillPoly(c, trim, [24, 1.2, 19, 3.3, 18.2, 2.7, 23.2, 0.6]); S.fillPoly(c, trim, [24, -1.2, 19, -3.3, 18.2, -2.7, 23.2, -0.6]);
        if (dmg) { scorch(c, 4, 3.5, 3.4); scorch(c, -9, -4, 2.6); S.lines(c, 'rgba(10,10,12,0.7)', 0.4, [9, -2, 5, -4.6, 5, -4.6, 2, -3.4]); }
      },
    });
    // armour nose cap (upgrade)
    if (armor >= 3) parts.push({ z0: 7, z1: 8, side: '#3d444e', top: '#8a939f', shape: (c) => S.poly(c, [26, 0, 20, 3, 17, 0, 20, -3]) });
    // dorsal spine
    parts.push({
      z0: 7, z1: 9.6, side: hullS, top: C.shade(hullT, 0.08), shape: (c) => S.poly(c, [19, 0, 13, 2.8, -9, 2.6, -15, 1.7, -15, -1.7, -9, -2.6, 13, -2.8]),
      detail: (c) => { S.lines(c, seam, 0.4, [2, -2.5, 2, 2.5, -6, -2.6, -6, 2.6]); for (let i = 0; i < 3; i++) S.lines(c, 'rgba(10,12,16,0.6)', 0.45, [-1 - i * 1.4, -1.3, -1 - i * 1.4, 1.3]); },
    });
    // sensor blister (deliberate asymmetry — alien relic origin)
    parts.push({ z0: 7, z1: 10.4, side: '#334452', top: glowC, flat: true, shape: (c) => S.circ(c, 3, -4.6, 1.6) });
    // cockpit canopy: frame then glass
    parts.push({ z0: 9.6, z1: 10.8, side: '#20252c', top: '#2f3640', shape: (c) => S.ell(c, 12.4, 0, 6.2, 3.3) });
    parts.push({
      z0: 10.8, z1: 11.8, side: glass1(), top: glass1(), flat: true, shape: (c) => S.ell(c, 12.8, 0, 5.2, 2.6),
      detail: (c) => {
        const g = c.createLinearGradient(8, -2.6, 17, 2.6);
        g.addColorStop(0, techTier >= 2 ? '#7ff6ff' : '#6fd2ee'); g.addColorStop(0.45, '#1b4a5c'); g.addColorStop(1, '#0d1c26');
        c.fillStyle = g; c.beginPath(); S.ell(c, 12.8, 0, 5.2, 2.6); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); S.ell(c, 14.2, -1, 2.2, 0.5, -0.2); c.fill();
        S.lines(c, 'rgba(10,14,18,0.6)', 0.35, [11, -2.4, 11, 2.4]);
      },
    });
    // rear cargo / rescue bay with the retrieval-beam emitter on its deck
    parts.push({
      z0: 5.6, z1: 11.2, side: '#4a525d', top: '#8f98a3', shape: (c) => S.rrect(c, -21, -bayW, 13.5, bayW * 2, 2.2),
      detail: (c) => {
        S.lines(c, seam, 0.45, [-14, -bayW + 0.8, -14, bayW - 0.8, -21, 0, -8.3, 0]);
        for (let i = 0; i < 4; i++) S.fillPoly(c, i % 2 ? '#24272c' : trim, [-20.2, -bayW + 0.6 + i * 1.2, -19.4, -bayW + 0.6 + i * 1.2, -19.4, -bayW + 1.8 + i * 1.2, -20.2, -bayW + 1.8 + i * 1.2]);
        S.dot(c, '#14191f', -14.5, 0, 2.6); S.dot(c, C.shade(glowC, -0.35), -14.5, 0, 1.9); S.dot(c, '#0f1418', -14.5, 0, 1.1);
        S.dot(c, '#ff5a3c', -19.6, bayW - 1.4, 0.75);
        if (dmg) scorch(c, -11, bayW - 2, 2.4);
      },
    });
    // twin engine nacelles
    parts.push({
      z0: 2.6, z1: 8.4, side: metal, top: '#7c8693', shape: (c) => { S.rrect(c, -27, 1.8, 12, 4.8, 2.2); S.rrect(c, -27, -6.6, 12, 4.8, 2.2); },
      detail: (c) => { for (const sg of [1, -1]) { S.lines(c, seam, 0.4, [-19, 1.9 * sg, -19, 6.5 * sg, -23, 1.9 * sg, -23, 6.5 * sg]); S.dot(c, '#0d1014', -26.2, 4.2 * sg, 1.7); S.dot(c, C.shade(glowC, -0.2), -26.2, 4.2 * sg, 1); } },
    });
    // canted tail fins
    parts.push({ z0: 9, z1: 15, side: hullS, top: trim, shape: (c) => { S.poly(c, [-12.5, 3, -21.5, 6.6, -22.5, 5.6, -14, 2.2]); S.poly(c, [-12.5, -3, -21.5, -6.6, -22.5, -5.6, -14, -2.2]); } });
    // shield emitter nodes — base pair, more with upgrades
    parts.push({ z0: 3.4, z1: 4.8, side: '#24485a', top: '#bff', flat: true, shape: (c) => { S.circ(c, -6, wingTip - 3.4, 1.05); S.circ(c, -6, -wingTip + 3.4, 1.05); if (shield >= 1) { S.circ(c, 16, 4.4, 0.95); S.circ(c, 16, -4.4, 0.95); } if (shield >= 3) { S.circ(c, -18, 6.8, 0.95); S.circ(c, -18, -6.8, 0.95); } } });
    // scanner mast + dish (upgrade)
    if (scan >= 1) parts.push({ z0: 11.2, z1: 15 + scan * 2, side: '#8b939c', top: '#d6dde3', shape: (c) => S.circ(c, -17, 2.5, 0.8) });
    if (scan >= 2) parts.push({ z0: 15 + scan * 2, z1: 16 + scan * 2, side: '#4b5560', top: '#9ff', shape: (c) => S.ell(c, -17, 2.5, 1.6, 3.8) });

    function glass1() { return '#123040'; }
    const H = 16 + (scan >= 1 ? scan * 2 + 2 : 0);
    return {
      r: 29, h: H, parts, ringPts, ringR, glow: glowC, trim,
      pods: [[4, 9.6], [4, -9.6]], podZ: 5.2,
      exhaust: [[-27.5, 4.2, 5.4], [-27.5, -4.2, 5.4]],
      retro: [[20, 3.6, 5], [20, -3.6, 5]],
      lateral: [[1.5, 7, 4.5], [-12, 6.9, 4.5]],
      lights: [{ x: -2.8, y: wingTip, z: 4.2, col: '#5aff7a' }, { x: -2.8, y: -wingTip, z: 4.2, col: '#ff4a4a' }, { x: -22, y: 0, z: 14.5, col: '#ffffff', strobe: true }],
      beamPt: [-14.5, 0], bevel: 0.7,
    };
  }

  /* Articulated weapon pod (rotates to aim). Barrels grow with the spread upgrade. */
  function podModel(u, weaponId) {
    const sp = (u && u.pSpread) || 0;
    const barrels = sp >= 2 ? 3 : sp >= 1 ? 2 : 1;
    const col = { pulse: '#9fdcff', beam: '#ffd36b', rail: '#b4a7ff', arc: '#9fffcf', apc: '#ffb07a' }[weaponId] || '#9fdcff';
    const len = weaponId === 'rail' ? 12 : weaponId === 'beam' ? 9 : 9.5;
    const offs = barrels === 1 ? [0] : barrels === 2 ? [-1.5, 1.5] : [-2.2, 0, 2.2];
    const parts = [
      { z0: 0, z1: 2.6, side: '#33393f', top: '#7c858e', shape: (c) => S.rrect(c, -5, -3.6, 9, 7.2, 3.2),
        detail: (c) => { S.lines(c, 'rgba(20,24,28,0.6)', 0.35, [-1, -3.4, -1, 3.4]); S.dot(c, '#1a1f25', -3, 0, 1.2); } },
      { z0: 0.8, z1: 2.8, side: '#262a30', top: '#9aa3ac', shape: (c) => { for (const o of offs) S.rrect(c, 2, o - 0.75, len, 1.5, 0.6); },
        detail: (c) => { for (const o of offs) { S.lines(c, 'rgba(10,12,16,0.65)', 0.45, [2 + len - 0.6, o - 0.7, 2 + len - 0.6, o + 0.7]); S.lines(c, 'rgba(255,255,255,0.3)', 0.3, [3, o - 0.5, 1.5 + len - 1.4, o - 0.5]); } } },
      { z0: 2.6, z1: 3.2, side: col, top: col, flat: true, shape: (c) => S.circ(c, -1.6, 0, 1.25), detail: (c) => S.dot(c, '#ffffff', -1.9, -0.4, 0.45) },
    ];
    return { r: 15, h: 5, parts, post: { rimStrength: 0.3 }, len };
  }

  AS.Shapes = S;
  AS.Models = AS.Models || {};
  AS.Models.craft = craftModel;
  AS.Models.pod = podModel;
})(window.AS);
