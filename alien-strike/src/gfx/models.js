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
   * Choir drive core. Upgrades (u = level map) visibly change the model.
   * ------------------------------------------------------------------ */
  function craftModel(u, palette) {
    u = u || {};
    const lv = (k) => u[k] || 0;
    const armor = lv('armor'), speed = lv('speed'), scan = lv('scanner'), fuel = lv('fuelCap');
    const cargo = lv('cargo') + lv('rescue'), shield = lv('shield');
    const techTier = Math.min(3, Math.floor((armor + speed + shield + scan + lv('shieldRegen') + lv('pDamage') + lv('sMulti')) / 4));
    const hull = palette && palette.hull || (techTier >= 2 ? '#4d5866' : '#5d636b');
    const hullTop = techTier >= 2 ? '#8996a8' : '#8d9296';
    const trim = techTier >= 3 ? '#d8d2c0' : '#c9963e';
    const glowC = techTier >= 2 ? '#7ff8ff' : '#5fe6ff';
    const dark = '#2b3038';

    const ringR = 4.1 + speed * 0.35;
    const wing = 18 + (armor >= 3 ? 1 : 0);
    const bodyHalf = [23, 0, 13, 3.6, 5, 6.5, 1, wing - 4, -4, wing, -9, wing - 1.5, -11, 10, -16, 7.5, -19, 4, -19, 0];
    const parts = [];

    // Underside emitter skirt (dark, wide)
    parts.push({ z0: 0, z1: 2, side: dark, top: '#3a4049', shape: (c) => S.poly(c, S.sym([16, 0, 6, 5, 0, wing - 3, -8, wing - 1, -12, 6, -15, 0])) });
    // Main hull
    parts.push({
      z0: 2, z1: 5, side: hull, top: hullTop, shape: (c) => S.poly(c, S.sym(bodyHalf)),
      detail: (c) => {
        // panel lines & trim stripes on the wings
        S.lines(c, 'rgba(30,34,40,0.55)', 0.8, [6, 6, -8, 14, 6, -6, -8, -14, -2, 3, -14, 3, -2, -3, -14, -3]);
        S.fillPoly(c, trim, [2, wing - 2, -5, wing, -6, wing - 2.4, 1, wing - 4]);
        S.fillPoly(c, trim, [2, -wing + 2, -5, -wing, -6, -wing + 2.4, 1, -wing + 4]);
        if (techTier >= 1) S.lines(c, glowC, 0.9, [12, 2, -10, 2, 12, -2, -10, -2]);
      },
    });
    // Ablative armour plates (upgrade)
    if (armor >= 1) parts.push({ z0: 5, z1: 6, side: '#3f454e', top: armor >= 4 ? '#6e7783' : '#646b73', shape: (c) => { S.poly(c, [8, 7, -4, wing - 1, -9, wing - 2, 2, 6]); S.poly(c, [8, -7, -4, -wing + 1, -9, -wing + 2, 2, -6]); } });
    if (armor >= 3) parts.push({ z0: 5, z1: 7, side: '#3f454e', top: '#7a828c', shape: (c) => { S.poly(c, [20, 0, 13, 4.5, 11, 0, 13, -4.5]); } });
    // Fuel saddle tanks (upgrade)
    if (fuel >= 1) parts.push({ z0: 3, z1: 7, side: '#6a5a3c', top: '#a48a52', shape: (c) => { S.rrect(c, -14, 7.5, 10, 4, 2); S.rrect(c, -14, -11.5, 10, 4, 2); } });
    // Propulsion rings (anti-grav emitters)
    const ringPts = [[-3.5, 11], [-3.5, -11]];
    parts.push({ z0: 3, z1: 6, side: '#3a4652', top: '#9fb3c4', stroke: 2.2 + speed * 0.25, shape: (c) => { for (const p of ringPts) S.circ(c, p[0], p[1], ringR); } });
    parts.push({ z0: 4, z1: 4, side: glowC, top: C.shade(glowC, 0.25), shape: (c) => { for (const p of ringPts) S.circ(c, p[0], p[1], ringR - 2.2); } });
    // Rear cargo / rescue compartment
    const cw = 5 + Math.min(3, cargo) * 0.8;
    parts.push({
      z0: 4, z1: 9, side: '#4a5059', top: '#7d848c', shape: (c) => S.rrect(c, -18, -cw, 11, cw * 2, 2),
      detail: (c) => { S.lines(c, 'rgba(25,28,33,0.6)', 0.7, [-16, -cw + 1, -16, cw - 1, -12, -cw + 1, -12, cw - 1]); S.dot(c, '#ff5a3c', -17, 0, 0.9); },
    });
    // Dorsal spine
    parts.push({ z0: 5, z1: 9, side: hull, top: '#a3a9ae', shape: (c) => S.poly(c, [18, 0, 9, 2.6, -8, 2.2, -8, -2.2, 9, -2.6]) });
    // Cockpit canopy
    parts.push({ z0: 8, z1: 10, side: '#2a3442', top: techTier >= 2 ? '#6fe9ff' : '#e9b85c', shape: (c) => S.ell(c, 10, 0, 4.2, 2.3),
      detail: (c) => S.dot(c, 'rgba(255,255,255,0.75)', 11.5, -0.8, 0.9) });
    // Sensor blister (deliberate asymmetry — alien relic origin)
    parts.push({ z0: 5, z1: 8, side: '#3a4652', top: glowC, shape: (c) => S.circ(c, 2, -5.5, 1.8) });
    // Scanner mast (upgrade)
    if (scan >= 1) parts.push({ z0: 9, z1: 13 + scan * 2, side: '#8b939c', top: '#d6dde3', shape: (c) => S.circ(c, -10, 0, 0.9) });
    if (scan >= 2) parts.push({ z0: 13 + scan * 2, z1: 14 + scan * 2, side: '#4b5560', top: '#8ff', shape: (c) => S.ell(c, -10, 0, 1.5, 3.5) });
    // Shield emitter nodes (upgrade)
    if (shield >= 1) parts.push({ z0: 5, z1: 7, side: '#2b5160', top: '#9ff', shape: (c) => { S.circ(c, -8, wing - 0.5, 1.4); S.circ(c, -8, -wing + 0.5, 1.4); if (shield >= 3) { S.circ(c, 6, 6.5, 1.2); S.circ(c, 6, -6.5, 1.2); } } });

    return { r: 26 + (scan >= 1 ? 0 : 0), h: 14 + scan * 2 + 2, parts, ringPts, ringR, glow: glowC, trim };
  }

  /* Articulated weapon pod (rotates to aim). Barrels grow with the spread upgrade. */
  function podModel(u, weaponId) {
    const sp = (u && u.pSpread) || 0;
    const barrels = sp >= 2 ? 3 : sp >= 1 ? 2 : 1;
    const col = { pulse: '#9fdcff', beam: '#ffd36b', rail: '#b4a7ff', arc: '#9fffcf', apc: '#ffb07a' }[weaponId] || '#9fdcff';
    const parts = [
      { z0: 0, z1: 3, side: '#3d434b', top: '#7c848c', shape: (c) => S.ell(c, 0, 0, 4.2, 3.4) },
      {
        z0: 1, z1: 3, side: '#30353c', top: '#949ca4', shape: (c) => {
          const offs = barrels === 1 ? [0] : barrels === 2 ? [-1.4, 1.4] : [-2, 0, 2];
          for (const o of offs) S.rect(c, 1, o - 0.7, weaponId === 'rail' ? 11 : 8.5, 1.4);
        },
      },
      { z0: 3, z1: 3, side: col, top: col, shape: (c) => S.circ(c, -1, 0, 1.3) },
    ];
    return { r: 12, h: 4, parts, post: { rimStrength: 0.3 } };
  }

  AS.Shapes = S;
  AS.Models = AS.Models || {};
  AS.Models.craft = craftModel;
  AS.Models.pod = podModel;
})(window.AS);
