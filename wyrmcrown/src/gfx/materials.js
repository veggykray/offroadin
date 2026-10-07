/* WYRMCROWN — creature surface materials (materials.js).
 * The forge builds creatures from stacked slices and only shows each slice's
 * camera-facing rim, so walls (most of what is seen of an upright creature)
 * used to be smooth gradients. A part may carry a `tex(ctx, zt, anim, isTop, k)`
 * hook that the forge calls after filling every slice with the slice path still
 * current. Two kinds of hook live here:
 *
 *  - Mat.tex(kind, o): a tileable surface (scales, plates, hide, skin, fur,
 *    bark, moss, cloth, leather, bone, ice, metal, horn). The pattern is fixed
 *    in the part's object space, so it turns with the creature, and each slice
 *    samples it one texel further along the view direction, so the walls show
 *    the pattern unrolled vertically (fur and bark use dz 0 for vertical
 *    strands and grooves, and `jump` breaks bark into plates). Marks are dark
 *    and light ink with alpha, so one pattern modulates any base colour.
 *
 *  - Mat.paint(z0, z1, features): projected wall painting. Each feature is an
 *    ellipse, box or tooth in (anchor, height) space; on every slice the row of
 *    each feature it crosses is painted as a short band at its anchor on the
 *    outline, oriented along the surface. Rows build up on the wall at full
 *    texel resolution: eyes with lids, irises, pupils and highlights, brows,
 *    nostrils, lips and teeth. Rows are skipped on the top slice.
 *
 * Mat.join(a, b, ...) combines hooks. Object space is the part's model units. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;
  const SZ = 64;
  const cache = new Map();
  function rnd(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
  function cv(n) { const c = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1); c.width = c.height = n || SZ; return c; }
  // run f at the 9 wrapped offsets so marks tile seamlessly
  const wrap = (c, f) => { for (let dx = -SZ; dx <= SZ; dx += SZ) for (let dy = -SZ; dy <= SZ; dy += SZ) { c.save(); c.translate(dx, dy); f(c); c.restore(); } };
  const ink = (o, a) => C.str(o.ink || '#000000', a);
  const glint = (o, a) => C.str(o.glint || '#ffffff', a);

  const KINDS = {
    // overlapping scales: dark lower rim, bright upper edge, a few darker scales
    scales(c, r, o) {
      const nx = o.n || 8, w = SZ / nx, rows = Math.max(2, Math.round(SZ / (w * 0.62) / 2) * 2), h = SZ / rows;
      for (let row = 0; row < rows; row++) for (let i = 0; i < nx; i++) {
        const x = i * w + (row % 2) * w / 2, y = row * h, dk = r();
        wrap(c, (c) => {
          if (dk < 0.25) { c.fillStyle = ink(o, 0.18); c.beginPath(); c.ellipse(x, y - h * 0.2, w * 0.45, h * 0.7, 0, 0, TAU); c.fill(); }
          c.beginPath(); c.arc(x, y - h * 0.55, w * 0.55, 0.12 * Math.PI, 0.88 * Math.PI); c.strokeStyle = ink(o, 0.85); c.lineWidth = o.lw || 1; c.stroke();
          c.beginPath(); c.arc(x, y - h * 0.35, w * 0.4, 1.2 * Math.PI, 1.8 * Math.PI); c.strokeStyle = glint(o, 0.5); c.lineWidth = 1; c.stroke();
        });
      }
    },
    // big armour plates / scutes
    plates(c, r, o) { KINDS.scales(c, r, Object.assign({ n: o.n || 4, lw: 1.6 }, o)); },
    // thick hide: blotches, deep creases with a lit lip, pores
    hide(c, r, o) {
      const N = o.blot || 14;
      for (let i = 0; i < N; i++) { const x = r() * SZ, y = r() * SZ, rr = 4 + r() * 9, d = r() < 0.55; wrap(c, (c) => { const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, d ? ink(o, 0.32) : glint(o, 0.13)); g.addColorStop(1, d ? ink(o, 0) : glint(o, 0)); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }); }
      const NC = o.creases !== undefined ? o.creases : 9;
      for (let i = 0; i < NC; i++) {
        const x = r() * SZ, y = r() * SZ, L = 6 + r() * 12, a = (r() - 0.5) * 1.2 + (o.creaseA || 0), bend = (r() - 0.5) * 6;
        const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
        wrap(c, (c) => {
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + x1) / 2 + bend, (y + y1) / 2 - bend, x1, y1); c.strokeStyle = ink(o, 0.8); c.lineWidth = 1.1; c.stroke();
          c.beginPath(); c.moveTo(x, y - 1.2); c.quadraticCurveTo((x + x1) / 2 + bend, (y + y1) / 2 - bend - 1.2, x1, y1 - 1.2); c.strokeStyle = glint(o, 0.35); c.lineWidth = 0.8; c.stroke();
        });
      }
      const NP = o.pores !== undefined ? o.pores : 40;
      for (let i = 0; i < NP; i++) { const x = (r() * SZ) | 0, y = (r() * SZ) | 0; c.fillStyle = r() < 0.7 ? ink(o, 0.45) : glint(o, 0.35); c.fillRect(x, y, 1, 1); }
    },
    skin(c, r, o) { KINDS.hide(c, r, Object.assign({ blot: 10, creases: 3, pores: 26 }, o)); },
    // fur: clump bands and strands, mostly along pattern y (walls use dz 0 → vertical locks)
    fur(c, r, o) {
      for (let i = 0; i < 9; i++) { const x = r() * SZ, w = 3 + r() * 5, d = r() < 0.5; wrap(c, (c) => { const g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, d ? ink(o, 0) : glint(o, 0)); g.addColorStop(0.5, d ? ink(o, 0.4) : glint(o, 0.28)); g.addColorStop(1, d ? ink(o, 0) : glint(o, 0)); c.fillStyle = g; c.fillRect(x - w, 0, w * 2, SZ); }); }
      for (let i = 0; i < 150; i++) {
        const x = r() * SZ, y = r() * SZ, L = 3 + r() * 6, a = Math.PI / 2 + (r() - 0.5) * 0.7, d = r() < 0.6;
        wrap(c, (c) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.strokeStyle = d ? ink(o, 0.55) : glint(o, 0.45); c.lineWidth = 0.9; c.stroke(); });
      }
    },
    // bark: wavy vertical grooves with lit ridges, knots
    bark(c, r, o) {
      const n = o.n || 9;
      for (let i = 0; i < n; i++) {
        const x0 = (i + r() * 0.6) * SZ / n, amp = 1 + r() * 2, ph = r() * TAU, w = 1 + r() * 1.4;
        wrap(c, (c) => {
          c.beginPath(); for (let y = 0; y <= SZ; y += 4) { const x = x0 + Math.sin(y / SZ * TAU * 2 + ph) * amp; y ? c.lineTo(x, y) : c.moveTo(x, y); }
          c.strokeStyle = ink(o, 0.85); c.lineWidth = w; c.stroke();
          c.beginPath(); for (let y = 0; y <= SZ; y += 4) { const x = x0 + 1.6 + Math.sin(y / SZ * TAU * 2 + ph) * amp; y ? c.lineTo(x, y) : c.moveTo(x, y); }
          c.strokeStyle = glint(o, 0.4); c.lineWidth = 0.9; c.stroke();
        });
      }
      for (let i = 0; i < (o.knots !== undefined ? o.knots : 2); i++) { const x = r() * SZ, y = r() * SZ, rr = 2 + r() * 2.5; wrap(c, (c) => { c.beginPath(); c.ellipse(x, y, rr, rr * 1.5, 0, 0, TAU); c.fillStyle = ink(o, 0.7); c.fill(); c.beginPath(); c.ellipse(x, y, rr + 1.2, rr * 1.5 + 1.6, 0, 0, TAU); c.strokeStyle = glint(o, 0.4); c.lineWidth = 0.9; c.stroke(); }); }
    },
    // moss: dense clumpy speckle
    moss(c, r, o) {
      for (let i = 0; i < 70; i++) { const x = r() * SZ, y = r() * SZ, rr = 1 + r() * 2.6, d = r() < 0.5; wrap(c, (c) => { c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fillStyle = d ? ink(o, 0.4) : glint(o, 0.32); c.fill(); }); }
      for (let i = 0; i < 60; i++) { c.fillStyle = r() < 0.5 ? ink(o, 0.5) : glint(o, 0.5); c.fillRect((r() * SZ) | 0, (r() * SZ) | 0, 1, 1); }
    },
    // woven cloth: fine weave, worn patches, a few stains
    cloth(c, r, o) {
      for (let y = 0; y < SZ; y += 2) for (let x = 0; x < SZ; x += 2) { if (((x + y) >> 1) % 2) { c.fillStyle = ink(o, 0.16); c.fillRect(x, y, 2, 1); } else { c.fillStyle = glint(o, 0.1); c.fillRect(x, y + 1, 1, 1); } }
      for (let i = 0; i < 6; i++) { const x = r() * SZ, y = r() * SZ, rr = 4 + r() * 8, d = r() < 0.6; wrap(c, (c) => { const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, d ? ink(o, 0.3) : glint(o, 0.22)); g.addColorStop(1, d ? ink(o, 0) : glint(o, 0)); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }); }
    },
    leather(c, r, o) { KINDS.hide(c, r, Object.assign({ blot: 9, creases: 6, pores: 14, creaseA: 0 }, o)); for (let i = 0; i < 8; i++) { const x = r() * SZ, y = r() * SZ, L = 3 + r() * 8; wrap(c, (c) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y + (r() - 0.5) * 2); c.strokeStyle = glint(o, 0.4); c.lineWidth = 0.7; c.stroke(); }); } },
    bone(c, r, o) {
      KINDS.hide(c, r, Object.assign({ blot: 8, creases: 0, pores: 34 }, o));
      for (let i = 0; i < 5; i++) { let x = r() * SZ, y = r() * SZ; const pts = [[x, y]]; for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 8; y += 2 + r() * 5; pts.push([x, y]); } wrap(c, (c) => { c.beginPath(); pts.forEach((q, j) => (j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.strokeStyle = ink(o, 0.6); c.lineWidth = 0.8; c.stroke(); }); }
    },
    ice(c, r, o) {
      for (let i = 0; i < 10; i++) { const x = r() * SZ, y = r() * SZ, a = r() * Math.PI, L = 6 + r() * 18; wrap(c, (c) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.strokeStyle = glint(o, 0.7); c.lineWidth = 0.9; c.stroke(); c.beginPath(); c.moveTo(x + 1, y + 1); c.lineTo(x + 1 + Math.cos(a) * L, y + 1 + Math.sin(a) * L); c.strokeStyle = ink(o, 0.35); c.lineWidth = 0.8; c.stroke(); }); }
      for (let i = 0; i < 5; i++) { const x = r() * SZ, y = r() * SZ, rr = 4 + r() * 6; wrap(c, (c) => { c.beginPath(); c.moveTo(x, y - rr); c.lineTo(x + rr, y); c.lineTo(x, y + rr * 0.6); c.lineTo(x - rr * 0.8, y); c.closePath(); c.fillStyle = r() < 0.5 ? glint(o, 0.18) : ink(o, 0.12); c.fill(); }); }
    },
    metal(c, r, o) {
      for (let i = 0; i < 30; i++) { const x = r() * SZ, y = r() * SZ, L = 4 + r() * 14; wrap(c, (c) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y + (r() - 0.5)); c.strokeStyle = r() < 0.6 ? glint(o, 0.35) : ink(o, 0.3); c.lineWidth = 0.6; c.stroke(); }); }
      for (let i = 0; i < 6; i++) { const x = r() * SZ, y = r() * SZ; wrap(c, (c) => { c.beginPath(); c.arc(x, y, 1.5 + r() * 1.5, 0, TAU); c.fillStyle = ink(o, 0.35); c.fill(); }); }
    },
    // horn / claw keratin: growth rings across, fine streaks along
    horn(c, r, o) {
      for (let y = 0; y < SZ; y += 3 + ((r() * 3) | 0)) { c.fillStyle = ink(o, 0.35 + r() * 0.2); c.fillRect(0, y, SZ, 1); c.fillStyle = glint(o, 0.25); c.fillRect(0, y + 1, SZ, 1); }
      for (let i = 0; i < 20; i++) { c.fillStyle = r() < 0.5 ? ink(o, 0.25) : glint(o, 0.2); c.fillRect((r() * SZ) | 0, 0, 1, SZ); }
    },
  };

  function pattern(kind, o) {
    const key = kind + '|' + (o.ink || '') + '|' + (o.glint || '') + '|' + (o.n || '') + '|' + (o.seed || 0) + '|' + (o.blot || '') + '|' + (o.creases === undefined ? '' : o.creases);
    let c = cache.get(key);
    if (c) return c;
    c = cv(); const x = c.getContext('2d');
    KINDS[kind](x, rnd(17 + (o.seed || 0) * 31 + kind.length * 7), o);
    cache.set(key, c);
    return c;
  }

  /* a surface hook. o: { a: strength (0.5), px: texels per pattern pixel (1), dz: texels the
   * pattern moves per slice along the view (1; 0 = vertical streaks), jump: slices per band
   * (bark plates, scale rows: the pattern steps sideways and the band edge darkens), top: also
   * texture the top face (true), wall: alpha on the walls relative to the top (1), seed, ink, glint } */
  function tex(kind, o) {
    o = o || {};
    const A = o.a !== undefined ? o.a : 0.5, PXS = o.px || 1, DZ = o.dz !== undefined ? o.dz : 1, JUMP = o.jump || 0;
    const WALL = o.wall !== undefined ? o.wall : 1;
    return (c, zt, an, isTop, k) => {
      if (isTop && o.top === false) return;
      const img = pattern(kind, o);
      const store = c.__mp || (c.__mp = new Map());
      let pat = store.get(img);
      if (!pat) { pat = c.createPattern(img, 'repeat'); store.set(img, pat); }
      const m = c.getTransform(), s = Math.hypot(m.a, m.b) || 1, ang = Math.atan2(m.b, m.a);
      const sc = PXS / s, kk = (k || 0) * DZ, band = JUMP ? Math.floor((k || 0) / JUMP) : 0, jx = band * 23.3 + (o.seed || 0) * 9.7;
      const nx = Math.sin(ang), ny = Math.cos(ang);
      pat.setTransform(new DOMMatrix([sc, 0, 0, sc, (nx * kk + ny * jx) / s, (ny * kk - nx * jx) / s]));
      // fill the slice's own path with the pattern (cheaper than clipping and covering the frame)
      const ga = c.globalAlpha;
      c.globalAlpha = Math.min(1, A * (isTop ? 1 : WALL));
      c.fillStyle = pat; c.fill();
      if (JUMP && !isTop && (k % JUMP) === 0) { c.globalAlpha = Math.min(1, A * 0.9); c.fillStyle = C.str(o.ink || '#000000', 0.55); c.fill(); }
      c.globalAlpha = ga;
    };
  }

  /* projected wall painting. features: [{ z, h, x, y, w, nrm, col, shape: 'ell'|'box'|'tooth'|'up',
   *   d (radial reach, local units; default 3 texels), at(z) → [x, y, nrm] (anchor that follows the
   *   outline), top: also paint on the top slice, min: minimum half-width in texels (and a row at
 *   least a texel tall) so small marks survive }] — x, y on the outline at height z, nrm the outward
   * normal angle in the plan, w the half-width along the surface, h the half-height. */
  function paint(z0, z1, fs) {
    return (c, zt, an, isTop) => {
      const z = z0 + (z1 - z0) * zt;
      const m = c.getTransform(), s = Math.hypot(m.a, m.b) || 1;
      let clipped = false;
      for (const f of fs) {
        if (isTop && !f.top) continue;
        const dz = z - f.z, fh = f.min ? Math.max(f.h, 0.62 / s) : f.h;
        if (dz < -fh || dz > fh) continue;
        const u = dz / fh; // -1 bottom .. 1 top
        let hw;
        if (f.shape === 'box') hw = f.w;
        else if (f.shape === 'tooth') hw = f.w * (u + 1) / 2; // point at the bottom
        else if (f.shape === 'up') hw = f.w * (1 - u) / 2; // point at the top
        else hw = f.w * Math.sqrt(Math.max(0, 1 - u * u));
        if (f.skew) hw *= 1 + f.skew * u;
        if (f.min) hw = Math.max(hw, f.min / s);
        if (hw * s < 0.35) continue;
        let x = f.x, y = f.y, nr = f.nrm || 0;
        if (f.at) { const q = f.at(z); x = q[0]; y = q[1]; nr = q[2]; }
        const ox = f.shift ? f.shift * u : 0; // slant along the surface (brows, lids)
        const tx = -Math.sin(nr), ty = Math.cos(nr), nx = Math.cos(nr), ny = Math.sin(nr);
        const d = f.d || 3 / s, cx = x + tx * ox, cy = y + ty * ox;
        if (!clipped) { c.save(); c.clip(); clipped = true; }
        c.fillStyle = typeof f.col === 'function' ? f.col(u) : f.col;
        c.beginPath();
        c.moveTo(cx - tx * hw - nx * d, cy - ty * hw - ny * d); c.lineTo(cx + tx * hw - nx * d, cy + ty * hw - ny * d);
        c.lineTo(cx + tx * hw + nx * d, cy + ty * hw + ny * d); c.lineTo(cx - tx * hw + nx * d, cy - ty * hw + ny * d);
        c.closePath(); c.fill();
      }
      if (clipped) c.restore();
    };
  }
  const join = (...hs) => { hs = hs.filter(Boolean); return hs.length < 2 ? hs[0] : (c, zt, an, isTop, k, n) => { for (const h of hs) h(c, zt, an, isTop, k, n); }; };

  AS.Mat = { tex, paint, join, pattern, KINDS };
})(window.AS);
