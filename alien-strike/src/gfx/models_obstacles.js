/* ALIEN STRIKE — obstacle library (one tall terrain feature per world style) and the
 * FRC heavy dropship parked at every LZ.
 * Obstacles: AS.Models.obsX(pal, { h, r, seed, glowVein }) — r is the footprint
 * radius (collision stays honest: solid mass sits within ~r, tall parts above),
 * h the tallest point. One direction, one frame (obsGearTower: 4 anim frames).
 * Wall detail technique: a part that STROKES only the south-facing edges of a
 * footprint polygon sweeps exactly that wall face as the forge stacks slices, so
 * facets, strata, window rows and glyph channels can be painted onto walls without
 * bleeding over the faces above them. Loads after models4.js. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------------- helpers ---------------- */
  const PAL = (p, def) => Object.assign({}, def, p || {});
  // World palette, then an explicit opt.pal (mapping override) on top of the generator defaults.
  const pickPal = (pal, o, def) => Object.assign({}, def, pal || {}, (o && o.pal) || {});
  const rngOf = (seed, salt) => new U.RNG(((seed | 0) * 7919 + (salt || 0) * 104729 + 17) >>> 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hexS = (c, f) => { const v = C.shade(c, f); return '#' + v.map((x) => ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2)).join(''); };
  const mixS = (a, b, t) => { const v = C.mix(a, b, t); return '#' + v.map((x) => ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2)).join(''); };

  function ngon(n, r, rot, cx, cy) {
    const a = [];
    for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r); }
    return a;
  }
  // Irregular polygon (rocks, crowns), deterministic by seed.
  function jag(n, r, seed, rough, rot, cx, cy, sx, sy) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const t = (rot || 0) + (i / n) * TAU;
      const rr = r * (1 - rough / 2 + U.hash2(i, seed, 31) * rough);
      a.push((cx || 0) + Math.cos(t) * rr * (sx || 1), (cy || 0) + Math.sin(t) * rr * (sy || 1));
    }
    return a;
  }
  // Scale a polygon about (ox, oy) then translate by (dx, dy).
  function xf(pts, k, dx, dy, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    const o = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { o[i] = ox + (pts[i] - ox) * k + (dx || 0); o[i + 1] = oy + (pts[i + 1] - oy) * k + (dy || 0); }
    return o;
  }
  function area(pts) { let a = 0; const n = pts.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]; } return a / 2; }
  /* Append the edges of a polygon whose outward normal satisfies test(nx, ny) as
   * open segments (for stroked wall-paint parts). Only edges with ny > 0 are ever
   * visible in the single-direction obstacle view. */
  function edges(ctx, pts, test, inset) {
    const n = pts.length, sg = area(pts) > 0 ? 1 : -1;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      const ex = pts[j] - pts[i], ey = pts[j + 1] - pts[i + 1], L = Math.hypot(ex, ey) || 1;
      const nx = sg * ey / L, ny = -sg * ex / L;
      if (ny <= 0.08 || !test(nx, ny)) continue;
      const k = inset ? Math.min(0.45, inset / L) : 0;
      ctx.moveTo(pts[i] + ex * k, pts[i + 1] + ey * k);
      ctx.lineTo(pts[j] - ex * k, pts[j + 1] - ey * k);
    }
  }
  const darkFace = (nx, ny) => nx > 0.28;            // faces turned away from the top-left light
  const litFace = (nx, ny) => nx < -0.35;            // faces turned toward the light
  const southFace = () => true;

  /* Emit dashes along each qualifying edge (window rows, vents, glyph ticks). */
  function dashEdges(ctx, pts, test, on, off, inset) {
    const n = pts.length, sg = area(pts) > 0 ? 1 : -1;
    inset = inset || 0;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      const ex = pts[j] - pts[i], ey = pts[j + 1] - pts[i + 1], L = Math.hypot(ex, ey) || 1;
      const nx = sg * ey / L, ny = -sg * ex / L;
      if (ny <= 0.08 || !test(nx, ny)) continue;
      const usable = L - inset * 2;
      const cnt = Math.floor((usable + off) / (on + off));
      if (cnt < 1) continue;
      let s = inset + (usable - (cnt * (on + off) - off)) / 2;
      for (let k = 0; k < cnt; k++, s += on + off) {
        ctx.moveTo(pts[i] + ex * s / L, pts[i + 1] + ey * s / L);
        ctx.lineTo(pts[i] + ex * (s + on) / L, pts[i + 1] + ey * (s + on) / L);
      }
    }
  }
  const frac = (v) => v - Math.floor(v);
  /* A vertical stack of tiers sharing one base outline (centred on the origin).
   * Each tier scales the outline by kf(u) (u = 0..1 up the tier) or lerp(k0, k1);
   * `lean` shifts the outline toward (lx, ly) with height. at(z) gives the
   * cross-section at any height so wall paint can follow the surface. */
  function stack(base, tiers, cx, cy, lean, linear) {
    const topZ = tiers[tiers.length - 1].z1;
    const off = (z) => { const t = linear ? z / topZ : (z / topZ) * (z / topZ); return [(cx || 0) + (lean ? lean[0] * t : 0), (cy || 0) + (lean ? lean[1] * t : 0)]; };
    const kAt = (T, z) => { const u = U.clamp((z - T.z0) / Math.max(0.01, T.z1 - T.z0), 0, 1); return T.kf ? T.kf(u) : lerp(T.k0, T.k1, u); };
    const st = {
      tiers, topZ, base,
      tierAt(z) { for (const T of tiers) if (z < T.z1) return T; return tiers[tiers.length - 1]; },
      polyT(T, z) { const o = off(z); return xf(base, kAt(T, z), o[0], o[1]); },
      at(z) { return st.polyT(st.tierAt(z), z); },
      centre(z) { return off(z); },
      part(T, side, top, extra) { return Object.assign({ z0: T.z0, z1: T.z1, side, top, shape: (c, zt) => S.poly(c, st.polyT(T, lerp(T.z0, T.z1, zt))) }, extra || {}); },
    };
    return st;
  }
  /* Wall paint: strokes the camera-facing edges of a stack's cross-section between
   * z0 and z1 wherever band(z) is true. */
  function paint(st, z0, z1, col, opt) {
    opt = opt || {};
    const test = opt.test || southFace, band = opt.band, dash = opt.dash;
    return Object.assign({ z0, z1, side: col, top: col, stroke: opt.w || 0.9, ao: opt.ao !== undefined ? opt.ao : 0.1, bevel: false,
      shape: (c, zt) => {
        const z = lerp(z0, z1, zt);
        if (band && !band(z)) return;
        const pts = st.at(z);
        if (dash) dashEdges(c, pts, test, dash[0], dash[1], dash[2]); else edges(c, pts, test, opt.inset);
      } }, opt.extra || {});
  }
  // Vertical streak on a wall: one dot per slice at the cross-section vertex `vi` (or a fixed point).
  function streak(st, z0, z1, col, w, pick, extra) {
    return Object.assign({ z0, z1, side: col, top: col, stroke: w, ao: 0.05, bevel: false,
      shape: (c, zt) => { const z = lerp(z0, z1, zt); const q = pick(st ? st.at(z) : null, z, zt); if (!q) return; for (let i = 0; i < q.length; i += 2) { c.moveTo(q[i], q[i + 1]); c.lineTo(q[i] + 0.01, q[i + 1]); } } }, extra || {});
  }
  // Index of the polygon vertex that best matches direction (dx, dy).
  function extremeVertex(pts, dx, dy) { let best = 0, bv = -1e9; for (let i = 0; i < pts.length; i += 2) { const v = pts[i] * dx + pts[i + 1] * dy; if (v > bv) { bv = v; best = i; } } return best; }
  // Clip helper for top-face details.
  function clipTo(c, fn) { c.save(); c.beginPath(); fn(); c.clip(); }

  // Radial gradient pool painted on the ground (flat decal under a model).
  function pool(c, x, y, r, col, a, sy) {
    c.save(); c.translate(x, y); c.scale(1, sy || 1);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, C.str(col, a)); g.addColorStop(0.55, C.str(col, a * 0.45)); g.addColorStop(1, C.str(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.restore();
  }

  /* ==================================================================
   * W1 ASHEN VALE — basalt column cluster: 4-7 hexagonal prisms packed in a
   * honeycomb, stepping down from a tall core, faceted walls, cross-joints,
   * ochre dust caps and a scree apron.
   * ================================================================== */
  M.obsBasalt = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#463a33', b: '#857262', t: '#c99a62', d: '#211a16', g: '#ffb04a' });
    const H = (o.h || 90) * 0.86, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 1);
    const cr = R * 0.37;                                   // column hex radius
    const step = cr * 1.74;
    // honeycomb slots: centre + 6 ring + a few outer
    const slots = [[0, 0]];
    for (let i = 0; i < 6; i++) { const t = i / 6 * TAU + Math.PI / 6; slots.push([Math.cos(t) * step, Math.sin(t) * step]); }
    const ring = slots.slice(1);
    // pick 3-6 ring slots, biased toward a random "fall" direction so the skyline steps down
    const fall = rg.range(0, TAU);
    ring.sort((a, b) => (Math.cos(Math.atan2(a[1], a[0]) - fall) - Math.cos(Math.atan2(b[1], b[0]) - fall)));
    const nRing = 3 + rg.int(0, 3);
    const cols = [{ x: 0, y: 0, h: H * rg.range(0.9, 1) }];
    for (let i = 0; i < nRing; i++) {
      const s = ring[i];
      const towards = Math.cos(Math.atan2(s[1], s[0]) - fall);   // -1 back .. 1 toward the fall side
      cols.push({ x: s[0], y: s[1], h: H * U.clamp(rg.range(0.5, 0.78) - towards * 0.18, 0.28, 0.86) });
    }
    // one or two stubby broken columns at the fall side
    const nStub = rg.int(1, 2);
    for (let i = 0; i < nStub; i++) {
      const t = fall + rg.range(-0.7, 0.7), d = step * rg.range(1.55, 1.85);
      cols.push({ x: Math.cos(t) * d, y: Math.sin(t) * d, h: H * rg.range(0.12, 0.24), stub: true });
    }
    cols.forEach((c, i) => { c.rot = rg.range(-0.12, 0.12); c.k = rg.range(0.9, 1.04); c.j = rg.range(0.35, 0.65); c.i = i; c.dust = rg.chance(0.6); });
    cols.sort((a, b) => a.y - b.y);

    const parts = [];
    // scree apron + fallen drums
    const apron = jag(11, R * 1.22, seed + 3, 0.3, rg.range(0, 1), 0, R * 0.08, 1.08, 0.92);
    parts.push({ z0: 0, z1: 2, side: hexS(p.t, -0.42), top: hexS(p.t, -0.12), ao: 0.3, bevel: false, shape: (c) => S.poly(c, apron),
      detail: (c) => {
        const r2 = rngOf(seed, 9);
        for (let i = 0; i < 26; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.55, 1.15); S.dot(c, r2.chance(0.5) ? hexS(p.a, -0.1) : hexS(p.t, 0.18), Math.cos(a) * d, Math.sin(a) * d * 0.9 + R * 0.08, r2.range(0.5, 1.2)); }
      } });
    const fallen = [];
    for (let i = 0; i < 2; i++) { const t = fall + rg.range(-1.2, 1.2), d = R * rg.range(0.95, 1.15); fallen.push({ x: Math.cos(t) * d, y: Math.sin(t) * d, a: rg.range(0, Math.PI) }); }
    parts.push({ z0: 0, z1: cr * 1.3, side: p.a, top: p.b, shape: (c) => { for (const f of fallen) { c.save(); c.translate(f.x, f.y); c.rotate(f.a); S.poly(c, [-cr * 1.2, -cr * 0.75, cr * 1.2, -cr * 0.75, cr * 1.35, 0, cr * 1.2, cr * 0.75, -cr * 1.2, cr * 0.75, -cr * 1.35, 0]); c.restore(); } } });

    for (const col of cols) {
      const hex = ngon(6, cr * col.k, col.rot, col.x, col.y);
      const hj = col.stub ? col.h : col.h * col.j;          // cross-joint height
      const hex2 = xf(hex, 0.94, 0, 0, col.x, col.y);
      const topC = col.h > H * 0.75 ? hexS(p.b, 0.06) : p.b;
      // lower drum
      parts.push({ z0: 0, z1: hj, side: p.a, top: col.stub ? topC : hexS(p.b, -0.12), ao: 0.45, shape: (c) => S.poly(c, hex) });
      if (!col.stub) parts.push({ z0: hj, z1: col.h, side: hexS(p.a, 0.04), top: topC, ao: 0.22, shape: (c) => S.poly(c, hex2),
        detail: (c) => {
          if (col.dust) { c.beginPath(); S.poly(c, xf(hex2, 0.62, -cr * 0.18, -cr * 0.12, col.x, col.y)); c.fillStyle = C.str(p.t, 0.45); c.fill(); }
          S.lines(c, 'rgba(20,14,10,0.45)', 0.4, [col.x - cr * 0.5, col.y + cr * 0.1, col.x + cr * 0.15, col.y - cr * 0.3, col.x + cr * 0.15, col.y - cr * 0.3, col.x + cr * 0.55, col.y + cr * 0.2]);
        } });
      // shadow-side facets (east-facing walls) painted over the full height
      parts.push({ z0: 0, z1: col.h, side: hexS(p.a, -0.38), top: hexS(p.a, -0.38), stroke: 0.7, ao: 0.15, bevel: false,
        shape: (c, zt) => edges(c, (zt * col.h > hj) ? hex2 : hex, darkFace) });
    }
    return { r: R * 1.45 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W2 CRIMSON DUNES — wind-sculpted sandstone: a cluster of 2-3 hoodoos
   * (bulging pedestal, pinched neck, dark overhanging caprock) or, by seed,
   * a stepped mesa butte. Pale and deep strata bands run across every wall;
   * a wind-blown sand drift and a few fallen boulders sit at the foot.
   * ================================================================== */
  M.obsHoodoo = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#5a2418', b: '#8a3c26', t: '#a85a3a', g: '#ffb06a' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 2);
    const body = mixS(p.b, '#b8603c', 0.55), bodyT = mixS(p.t, '#e6b07a', 0.6);
    const pale = mixS(body, '#f4d6a0', 0.62), deep = mixS(body, mixS(p.a, '#3a120c', 0.5), 0.55), capS = '#4a3430', capT = '#a4846a';
    const sandS = '#c07a40', sandT = '#f0be80';
    const parts = [];
    const ph = rg.range(0, 12), per = rg.range(10.5, 13.5);
    const bandPale = (z) => frac((z + ph) / per) < 0.13;
    const bandDeep = (z) => { const f = frac((z + ph) / per); return f > 0.5 && f < 0.64; };
    // sand drift, blown out toward +x (east)
    const apron = jag(13, R * 1.08, seed + 5, 0.22, rg.range(0, 1), R * 0.22, R * 0.06, 1.28, 0.86);
    parts.push({ z0: 0, z1: 1.8, side: sandS, top: sandT, ao: 0.25, bevel: false, shape: (c) => S.poly(c, apron),
      detail: (c) => {
        const r2 = rngOf(seed, 6);
        for (let i = 0; i < 5; i++) { const y = R * r2.range(-0.7, 0.8), x = R * r2.range(0.3, 1.1); S.lines(c, 'rgba(150,80,40,0.45)', 0.45, [x - 4, y, x, y - 0.8, x, y - 0.8, x + 4, y + 0.2]); }
      } });
    // fallen boulders
    const bould = [];
    for (let i = 0; i < 3; i++) { const a = rg.range(0.2, 2.8), d = R * rg.range(0.85, 1.15); bould.push([Math.cos(a) * d, Math.sin(a) * d * 0.9, rg.range(1.6, 3)]); }
    parts.push({ z0: 0, z1: 3.2, side: hexS(body, -0.1), top: bodyT, ao: 0.4, shape: (c, zt) => { for (const b of bould) S.blob(c, b[0], b[1], b[2] * (1 - zt * 0.35), seed + b[2] * 10, 7, 0.3); } });

    const capDetail = (st, z) => (c) => {
      const pts = st.at(z), ce = st.centre(z);
      clipTo(c, () => S.poly(c, pts));
      const g = c.createRadialGradient(ce[0] - R * 0.2, ce[1] - R * 0.2, 0, ce[0], ce[1], R * 0.7);
      g.addColorStop(0, 'rgba(255,230,190,0.35)'); g.addColorStop(1, 'rgba(255,230,190,0)');
      c.fillStyle = g; c.fill();
      const r2 = rngOf(seed, 7 + z | 0);
      for (let i = 0; i < 4; i++) { const a = r2.range(0, TAU), d = r2.range(0, R * 0.25); S.lines(c, 'rgba(40,20,14,0.45)', 0.4, [ce[0] + Math.cos(a) * d, ce[1] + Math.sin(a) * d, ce[0] + Math.cos(a) * (d + 3), ce[1] + Math.sin(a) * (d + 2)]); }
      c.restore();
    };

    if (rg.chance(0.32)) {
      // ---- mesa butte: two stepped tiers and a caprock, plus a small hoodoo beside it
      const Hm = H * rg.range(0.58, 0.68);
      const base = jag(14, R * 0.92, seed + 7, 0.26, rg.range(0, TAU));
      const st = stack(base, [
        { z0: 0, z1: Hm * 0.5, kf: (u) => 1.06 - 0.12 * u },
        { z0: Hm * 0.5, z1: Hm * 0.88, kf: (u) => 0.8 - 0.05 * u },
        { z0: Hm * 0.88, z1: Hm, kf: (u) => 0.8 + 0.02 * u },
      ]);
      // small hoodoo behind-left of the butte (drawn first: it sits to the north)
      const sx = -R * 0.55, sy = -R * 0.7, sh = H * rg.range(0.75, 1);
      const sb = jag(9, R * 0.4, seed + 8, 0.2, rg.range(0, TAU));
      const s2 = stack(sb, [
        { z0: 0, z1: sh * 0.88, kf: (u) => (1.15 - 0.4 * u) * (0.92 + 0.08 * Math.cos(u * 13)) * (1 - 0.3 * U.smoothstep(0.7, 1, u)) },
        { z0: sh * 0.88, z1: sh, kf: (u) => 1.05 + 0.05 * u },
      ], sx, sy, [rg.range(-2, 2), -1]);
      parts.push(s2.part(s2.tiers[0], body, bodyT, { ao: 0.45 }));
      parts.push(paint(s2, 1, sh * 0.85, pale, { band: bandPale }));
      parts.push(s2.part(s2.tiers[1], capS, capT, { detail: capDetail(s2, sh) }));
      parts.push(st.part(st.tiers[0], body, bodyT, { ao: 0.45 }));
      parts.push(st.part(st.tiers[1], hexS(body, 0.04), bodyT, { ao: 0.25 }));
      parts.push(paint(st, 2, Hm * 0.86, pale, { band: bandPale }));
      parts.push(paint(st, 2, Hm * 0.86, deep, { band: bandDeep }));
      parts.push(st.part(st.tiers[2], capS, capT, { ao: 0.2,
        detail: (c) => {
          capDetail(st, Hm)(c);
          const r2 = rngOf(seed, 11);
          for (let i = 0; i < 7; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.1, 0.55); S.dot(c, '#5a5a2e', Math.cos(a) * d, Math.sin(a) * d, r2.range(0.7, 1.4)); }
        } }));
      return { r: R * 1.45 + 2, h: Math.max(Hm, sh) + 2, parts, style: 'prop', bevel: 0.8 };
    }
    // ---- hoodoo cluster
    const n = 2 + rg.int(0, 1);
    const hs = [{ x: R * rg.range(-0.12, 0.12), y: R * rg.range(-0.12, 0.08), rr: R * 0.6, h: H * 0.9, i: 0 }];
    const a0 = rg.range(0, TAU);
    for (let i = 1; i < n; i++) { const a = a0 + i * 2.3, d = R * rg.range(0.58, 0.72); hs.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.85, rr: R * rg.range(0.36, 0.44), h: H * rg.range(0.4, 0.62), i }); }
    hs.sort((a, b) => a.y - b.y);
    for (const hd of hs) {
      const base = jag(10, hd.rr, seed + hd.i * 13, 0.2, rg.range(0, TAU));
      const Hh = hd.h, w = rg.range(0, 6), pinch = rg.range(0.3, 0.42);
      const st = stack(base, [
        { z0: 0, z1: Hh * 0.87, kf: (u) => (1.22 - 0.34 * u) * (0.9 + 0.1 * Math.cos(u * 9 + w)) * (1 - pinch * U.smoothstep(0.62, 1, u)) },
        { z0: Hh * 0.87, z1: Hh, kf: (u) => 0.98 + 0.06 * u },
      ], hd.x, hd.y, [rg.range(-0.05, 0.05) * Hh, rg.range(-0.04, 0.01) * Hh]);
      parts.push(st.part(st.tiers[0], body, bodyT, { ao: 0.45 }));
      parts.push(paint(st, 1.5, Hh * 0.84, pale, { band: bandPale }));
      parts.push(paint(st, 1.5, Hh * 0.84, deep, { band: bandDeep }));
      parts.push(st.part(st.tiers[1], capS, capT, { ao: 0.15, detail: capDetail(st, Hh) }));
    }
    return { r: R * 1.45 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W3 VERDANT HIVE — colossal canopy tree. From above the tree IS its crown:
   * three layers of lumpy leaf clusters (dark underside, mid, lit lime top)
   * spread ~2.4x the footprint; a pale ridged trunk on flared buttress roots
   * shows beneath, with hanging vines and glowing seed pods along the rim.
   * ================================================================== */
  M.obsCanopyTree = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#1e4a1a', b: '#3e7a2a', t: '#9ad04a', g: '#ffef7a' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 3);
    const CR = Math.max(R * rg.range(2.35, 2.75), H * rg.range(0.44, 0.5));
    const zc = H * rg.range(0.54, 0.6), D = H - zc;
    const bark = '#7a6650', barkT = '#a89070', barkD = '#3a2c22';
    const parts = [];
    // buttress roots: fins that taper from wide tips at the ground into the trunk
    const rt = Math.max(R * 0.4, H * 0.07), nR = 5 + rg.int(0, 2), roots = [];
    for (let i = 0; i < nR; i++) roots.push({ a: (i / nR) * TAU + rg.range(-0.25, 0.25), L: R * rg.range(0.95, 1.2) });
    const rootPoly = (k) => {
      const pts = [];
      for (const r of roots) {
        const L = rt + (r.L - rt) * k, w = 0.34;
        pts.push(Math.cos(r.a - w) * rt, Math.sin(r.a - w) * rt);
        pts.push(Math.cos(r.a - 0.07) * (rt + (L - rt) * 0.55), Math.sin(r.a - 0.07) * (rt + (L - rt) * 0.55));
        pts.push(Math.cos(r.a) * L, Math.sin(r.a) * L);
        pts.push(Math.cos(r.a + 0.07) * (rt + (L - rt) * 0.55), Math.sin(r.a + 0.07) * (rt + (L - rt) * 0.55));
        pts.push(Math.cos(r.a + w) * rt, Math.sin(r.a + w) * rt);
      }
      return pts;
    };
    parts.push({ z0: 0, z1: 1, side: '#2c3a1c', top: '#4a5a2a', bevel: false, ao: 0.2, shape: (c) => S.poly(c, xf(rootPoly(1), 1.06)) });
    parts.push({ z0: 0, z1: H * 0.13, side: bark, top: barkT, ao: 0.45, shape: (c, zt) => S.poly(c, rootPoly(Math.pow(1 - zt, 1.4))) });
    const lean = [rg.range(-2, 2), rg.range(-2, 0.5)];
    const trunk = stack(ngon(11, rt, rg.range(0, 1)), [{ z0: 0, z1: zc + 6, kf: (u) => 1 - 0.28 * u + 0.12 * Math.max(0, u - 0.85) / 0.15 }], 0, 0, lean);
    parts.push(trunk.part(trunk.tiers[0], bark, barkT, { ao: 0.5 }));
    // bark ridges: vertical dark grooves on the visible half of the trunk
    const grooves = [0.35, 0.95, 1.5, 2.1, 2.7];
    parts.push(streak(trunk, H * 0.06, zc + 4, barkD, 0.55, (pts, z) => {
      const ce = trunk.centre(z), rr = rt * (1 - 0.28 * z / (zc + 6)), q = [];
      for (const a of grooves) q.push(ce[0] + Math.cos(a) * rr * 1.01, ce[1] + Math.sin(a) * rr * 1.01);
      return q;
    }));
    // canopy clusters
    const layer = (n, dist, rp, jit, rot) => {
      const out = [];
      for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU + rg.range(-jit, jit), d = dist * rg.range(0.85, 1.1); out.push({ x: Math.cos(a) * d + lean[0], y: Math.sin(a) * d * 0.94 + lean[1], r: rp * rg.range(0.85, 1.12), s: rg.int(1, 999) }); }
      return out;
    };
    const L0 = [{ x: lean[0], y: lean[1], r: CR * 0.6, s: 3 }].concat(layer(7, CR * 0.58, CR * 0.42, 0.25, rg.range(0, TAU)));
    const L1 = [{ x: lean[0] - CR * 0.05, y: lean[1] - CR * 0.05, r: CR * 0.42, s: 5 }].concat(layer(5, CR * 0.42, CR * 0.36, 0.3, rg.range(0, TAU)));
    const L2 = layer(3, CR * 0.2, CR * 0.27, 0.4, rg.range(0, TAU)).map((q) => ({ x: q.x - CR * 0.08, y: q.y - CR * 0.08, r: q.r, s: q.s }));
    const puffs = (c, L, k) => { for (const q of L) S.blob(c, q.x, q.y, q.r * k, q.s, 10, 0.16); };
    // hanging vines + glowing pods on the south rim of the lower layer
    const rim = L0.slice(1).filter((q) => q.y > CR * 0.05).map((q) => [q.x + rg.range(-0.3, 0.3) * q.r, q.y + q.r * 0.86]);
    parts.push(streak(null, zc - 9, zc + 1, '#24401c', 0.55, (pts, z, zt) => { const q = []; rim.forEach((v, i) => { if (zt > (i % 3) * 0.22) q.push(v[0], v[1]); }); return q; }));
    parts.push({ z0: zc - 4, z1: zc - 1, side: hexS(p.g, -0.25), top: p.g, flat: true, bevel: false, shape: (c, zt) => { rim.forEach((v, i) => { if (i % 2 === 0) S.circ(c, v[0] + 1.2, v[1] - 0.4, 1.1 * (1 - Math.abs(zt - 0.5))); }); } });
    const leafDetail = (L, k, hi, lo) => (c) => {
      clipTo(c, () => puffs(c, L, k));
      for (const q of L) {
        const rr = q.r * k;
        const g = c.createRadialGradient(q.x - rr * 0.35, q.y - rr * 0.4, 0, q.x - rr * 0.2, q.y - rr * 0.2, rr * 1.1);
        g.addColorStop(0, C.str(hi, 0.55)); g.addColorStop(0.55, C.str(hi, 0)); g.addColorStop(1, C.str(lo, 0.35));
        c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, rr * 1.05, 0, TAU); c.fill();
        // leaf-clump crescents
        S.lines(c, C.str(lo, 0.45), 0.5, [q.x + rr * 0.1, q.y + rr * 0.5, q.x + rr * 0.55, q.y + rr * 0.15]);
      }
      c.restore();
    };
    const dome = (zt, flare) => (zt < flare ? lerp(0.8, 1, zt / flare) : Math.sqrt(Math.max(0.05, 1 - Math.pow((zt - flare) / (1 - flare) * 0.78, 2))));
    // deep emerald/teal crown (hue-shifted off the yellow-green jungle floor), lime only where the sun hits
    const c0s = mixS(p.a, '#0c2e2a', 0.7), c0t = mixS(p.b, '#1e5a48', 0.7);
    const c1s = mixS(p.b, '#1a4e40', 0.7), c1t = mixS(p.b, '#3a8a5e', 0.65);
    const c2s = mixS(p.b, '#2e7452', 0.6), c2t = mixS(p.t, '#b4e070', 0.35);
    parts.push({ z0: zc, z1: zc + D * 0.5, side: c0s, top: c0t, ao: 0.55, shape: (c, zt) => puffs(c, L0, dome(zt, 0.3)), detail: leafDetail(L0, dome(1, 0.3), c1t, c0s) });
    parts.push({ z0: zc + D * 0.32, z1: zc + D * 0.8, side: c1s, top: c1t, ao: 0.45, shape: (c, zt) => puffs(c, L1, dome(zt, 0.2)), detail: leafDetail(L1, dome(1, 0.2), c2t, c1s) });
    parts.push({ z0: zc + D * 0.62, z1: H, side: c2s, top: c2t, ao: 0.4, shape: (c, zt) => puffs(c, L2, dome(zt, 0.15)),
      detail: (c) => {
        leafDetail(L2, dome(1, 0.15), '#f4ffb0', c2s)(c);
        const r2 = rngOf(seed, 12);
        for (let i = 0; i < 4; i++) { const q = L1[1 + (i % (L1.length - 1))]; S.dot(c, C.str(p.g, 0.35), q.x + r2.range(-2, 2), q.y + r2.range(-2, 2), 1.8); S.dot(c, p.g, q.x + r2.range(-1, 1), q.y + r2.range(-1, 1), 0.8); }
      } });
    return { r: CR * 1.15 + 3, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W4 FROST REACH — serac / ice-blade cluster: 3-5 leaning blades of deep
   * blue glacier ice with lit cyan glint faces, dark blue shadow faces and a
   * crisp white edge highlight; some are sheared serac blocks with snow tops.
   * A wind-scoured snow apron grounds the cluster.
   * ================================================================== */
  M.obsSerac = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#6a9ac0', b: '#cfe8f8', t: '#ffffff', g: '#9ff' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 4);
    const iceS = mixS(p.a, '#1c5c98', 0.6), iceT = mixS(p.b, '#d8f2ff', 0.5), glint = '#9fdcff', deepC = '#173f72', snowS = '#9cb6cf', snow = '#f6fbff';
    const parts = [];
    const apron = jag(12, R * 1.12, seed + 3, 0.26, rg.range(0, 1), 0, R * 0.05, 1.05, 0.9);
    parts.push({ z0: 0, z1: 2.4, side: snowS, top: snow, ao: 0.3, bevel: false, shape: (c) => S.poly(c, apron),
      detail: (c) => { const r2 = rngOf(seed, 4); for (let i = 0; i < 6; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.6, 1.0); S.lines(c, 'rgba(120,160,200,0.45)', 0.5, [Math.cos(a) * d - 2.5, Math.sin(a) * d, Math.cos(a) * d + 2.5, Math.sin(a) * d + 0.6]); } } });
    const n = 3 + rg.int(0, 2), blades = [];
    for (let i = 0; i < n; i++) {
      const main = i === 0;
      const a = rg.range(0, TAU), d = main ? R * 0.1 : R * rg.range(0.4, 0.62);
      const L = main ? R * rg.range(0.5, 0.58) : R * rg.range(0.3, 0.42), W = L * rg.range(0.55, 0.78), ang = rg.range(0, Math.PI);
      const raw = [L, 0, 0.35 * L, W, -0.45 * L, W * 0.85, -L, 0, -0.3 * L, -W, 0.5 * L, -W * 0.8];
      const base = [];
      for (let k = 0; k < raw.length; k += 2) base.push(raw[k] * Math.cos(ang) - raw[k + 1] * Math.sin(ang), raw[k] * Math.sin(ang) + raw[k + 1] * Math.cos(ang));
      const bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.85;
      const h = main ? H * 0.88 : H * rg.range(0.32, 0.62);
      const block = !main && rg.chance(0.5);
      const out = Math.hypot(bx, by) || 1, lk = h * rg.range(0.08, 0.18);
      blades.push({ base, bx, by, h, block, lean: [bx / out * lk, by / out * lk - (main ? h * 0.04 : 0)] });
    }
    blades.sort((a, b) => a.by - b.by);
    for (const b of blades) {
      const st = stack(b.base, [b.block
        ? { z0: 0, z1: b.h * 0.7, kf: (u) => 1.05 - 0.25 * u }
        : { z0: 0, z1: b.h, kf: (u) => 0.18 + 0.86 * Math.pow(1 - u, 0.75) }], b.bx, b.by, b.lean, true);
      const top = st.topZ;
      parts.push(st.part(st.tiers[0], iceS, b.block ? snow : iceT, { ao: 0.35,
        detail: b.block ? (c) => { const pts = st.at(top), ce = st.centre(top); S.lines(c, 'rgba(90,140,190,0.55)', 0.45, [ce[0] - 2, ce[1] - 1, ce[0] + 1.5, ce[1] + 1.2, ce[0] + 1.5, ce[1] + 1.2, ce[0] + 3.5, ce[1] + 0.4]); } : null }));
      parts.push(paint(st, 0.5, top - 0.6, glint, { test: litFace, w: 0.95 }));
      parts.push(paint(st, 0.5, top - 0.6, deepC, { test: darkFace, w: 0.95 }));
      // crisp highlight down the front-left arris + translucent cyan base glow
      const vi = extremeVertex(b.base, -0.7, 0.7);
      parts.push(streak(st, 0.5, top - 0.4, '#f2fbff', 0.5, (pts) => [pts[vi], pts[vi + 1]], { flat: true }));
      if (b.block) parts.push({ z0: top - 1.2, z1: top + 0.6, side: snowS, top: snow, ao: 0.2, shape: (c) => S.poly(c, xf(st.at(top), 1.02, 0, 0, st.centre(top)[0], st.centre(top)[1])) });
    }
    return { r: R * 1.45 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W5 THE DROWNED WORLD — drowned skyscraper top breaking the surface:
   * chamfered concrete tower with a window grid, algae-stained waterline,
   * rust streaks and a foam ring on the water. By seed: an intact roof
   * (parapet, helipad or AC plant, water tank, mast) or a collapsed crown
   * (a broken corner block, exposed rebar and rubble on the lower roof).
   * ================================================================== */
  M.obsDrownedTower = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#3a5a5a', b: '#6a8a84', t: '#9ac0b8', g: '#5fffe0' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 5);
    const rot = rg.range(-0.22, 0.22);
    const conc = mixS(p.b, '#7c8a86', 0.45), concT = mixS(p.t, '#c4ccc4', 0.5), glass = '#16303c', algae = '#34462a', rust = '#6a4630';
    const rp = (pts) => { const o2 = []; for (let i = 0; i < pts.length; i += 2) o2.push(pts[i] * Math.cos(rot) - pts[i + 1] * Math.sin(rot), pts[i] * Math.sin(rot) + pts[i + 1] * Math.cos(rot)); return o2; };
    const hw = R * rg.range(0.66, 0.78), hd = R * rg.range(0.5, 0.62), ch = R * rg.range(0.12, 0.26);
    const foot = rp([hw, -hd, hw, hd - ch, hw - ch, hd, -hw + ch, hd, -hw, hd - ch, -hw, -hd]);
    const parts = [];
    // water + foam ring (semi-transparent so it carries no outline)
    parts.push({ z0: 0, z1: 0, side: conc, top: conc, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 0.2),
      detail: (c) => {
        c.save(); c.beginPath(); S.ell(c, 0, R * 0.08, R * 1.3, R * 1.08); c.fillStyle = 'rgba(30,96,110,0.36)'; c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.36)'; c.lineWidth = 1.4; c.beginPath(); S.poly(c, xf(foot, 1.18)); c.stroke();
        c.lineWidth = 0.7; c.beginPath(); S.ell(c, 0, R * 0.08, R * 1.15, R * 0.95); c.stroke(); c.restore();
      } });
    const broken = rg.chance(0.45), setback = !broken && rg.chance(0.5);
    const Hb = H * (broken ? rg.range(0.6, 0.72) : setback ? 0.6 : 0.9);
    const st = stack(foot, [{ z0: 0, z1: Hb, k0: 1, k1: 1 }]);
    const floorH = 4.4, wph = rg.range(0, 1);
    const winBand = (z) => { const f = frac(z / floorH + wph); return f > 0.3 && f < 0.82; };
    parts.push(st.part(st.tiers[0], conc, concT, { ao: 0.3 }));
    parts.push(paint(st, 5, Hb - 1.5, glass, { band: winBand, dash: [1.7, 1.15, 0.9], w: 0.95 }));
    parts.push(paint(st, 0, 5, algae, { w: 1, ao: 0.35 }));
    // rust streaks running down from a few window columns
    const sx = [rg.range(-0.6, -0.2), rg.range(0.1, 0.6)].map((t) => [t * hw, hd]);
    parts.push(streak(null, 4, Hb * rg.range(0.45, 0.7), rust, 0.45, () => { const q = []; for (const s of sx) { const v = rp([s[0], s[1] + 0.3]); q.push(v[0], v[1]); } return q; }, { ao: 0 }));
    let topZ = Hb, roof = foot;
    if (setback) {
      const up = xf(foot, 0.72, 0, -R * 0.05), st2 = stack(up, [{ z0: Hb, z1: H * 0.9, k0: 1, k1: 1 }]);
      parts.push({ z0: Hb, z1: Hb + 1.2, side: hexS(conc, 0.1), top: concT, stroke: 0.8, bevel: false, shape: (c) => S.poly(c, foot) });
      parts.push(st2.part(st2.tiers[0], conc, concT, { ao: 0.2 }));
      parts.push(paint(st2, Hb + 2, H * 0.9 - 1.5, glass, { band: winBand, dash: [1.7, 1.15, 0.9], w: 0.95 }));
      topZ = H * 0.9;
      roof = up;
    }
    const rk = roof === foot ? 1 : 0.65;
    if (!broken) {
      const helipad = rg.chance(0.5);
      parts.push({ z0: topZ, z1: topZ + 1.4, side: hexS(conc, 0.1), top: hexS(concT, 0.1), stroke: 0.8, bevel: false, shape: (c) => S.poly(c, roof),
        detail: (c) => {
          if (helipad) {
            c.save(); c.translate(0, -R * 0.02); c.rotate(rot);
            c.beginPath(); c.arc(0, 0, R * 0.4, 0, TAU); c.fillStyle = 'rgba(40,50,52,0.55)'; c.fill();
            c.strokeStyle = '#e8d070'; c.lineWidth = 0.7; c.beginPath(); c.arc(0, 0, R * 0.34, 0, TAU); c.stroke();
            const k = R * 0.14; S.lines(c, '#f2f0e0', 0.9, [-k, -k, -k, k, k, -k, k, k, -k, 0, k, 0]); c.restore();
          }
        } });
      if (!helipad) {
        parts.push({ z0: topZ, z1: topZ + 2.6, side: '#5a6664', top: '#a4b0ac', shape: (c) => { c.save(); c.rotate(rot); S.rect(c, -hw * 0.55 * rk, -hd * 0.45 * rk, 6, 4.5); S.rect(c, hw * 0.1 * rk, -hd * 0.5 * rk, 5, 5); c.restore(); },
          detail: (c) => { c.save(); c.rotate(rot); S.dot(c, '#2a3232', hw * 0.1 * rk + 2.5, -hd * 0.5 * rk + 2.5, 1.6); S.lines(c, 'rgba(30,40,40,0.6)', 0.4, [-hw * 0.55 * rk + 1, -hd * 0.45 * rk + 1.5, -hw * 0.55 * rk + 5, -hd * 0.45 * rk + 1.5, -hw * 0.55 * rk + 1, -hd * 0.45 * rk + 3, -hw * 0.55 * rk + 5, -hd * 0.45 * rk + 3]); c.restore(); } });
      }
      const tk = [hw * 0.5 * rk, hd * 0.4 * rk], mk = [-hw * 0.55 * rk, hd * 0.35 * rk];
      parts.push({ z0: topZ, z1: topZ + 4.5, side: '#4c5a5a', top: '#8a9a96', shape: (c) => S.circ(c, tk[0], tk[1], 2.2), detail: (c) => S.dot(c, '#3a4646', tk[0], tk[1], 1.2) });
      parts.push({ z0: topZ, z1: topZ + 13, side: '#7a8482', top: '#c8d0cc', shape: (c) => S.circ(c, mk[0], mk[1], 0.45) });
      parts.push({ z0: topZ + 13, z1: topZ + 13.8, side: '#802020', top: '#ff5a4a', flat: true, bevel: false, shape: (c) => S.circ(c, mk[0], mk[1], 0.9) });
      return { r: R * 1.4 + 2, h: topZ + 16, parts, style: 'prop', bevel: 0.8 };
    }
    // collapsed crown: a broken corner block rises from the lower roof
    const cx0 = -hw, cx1 = hw * rg.range(-0.1, 0.35), cy0 = -hd, cy1 = hd * rg.range(-0.05, 0.3);
    const chunk = rp([cx1, cy0, cx1 - 1.5, (cy0 + cy1) / 2, cx1, cy1, cx0 + 2, cy1, cx0, cy1 - 2, cx0, cy0]);
    const Hc = H * rg.range(0.9, 1);
    const st3 = stack(chunk, [{ z0: Hb, z1: Hc, k0: 1, k1: 1 }]);
    // rubble on the lower roof
    const rub = []; for (let i = 0; i < 6; i++) rub.push(rp([rg.range(-hw * 0.2, hw * 0.75), rg.range(-hd * 0.1, hd * 0.75)]).concat([rg.range(1, 2.4)]));
    parts.push({ z0: Hb, z1: Hb + 2, side: hexS(conc, -0.1), top: concT, ao: 0.3, shape: (c, zt) => { for (const q of rub) S.blob(c, q[0], q[1], q[2] * (1 - zt * 0.4), seed + q[2] * 7, 6, 0.35); } });
    // rebar sticking up along the break line
    const bars = []; for (let i = 0; i < 5; i++) { const t = rg.range(0, 1); bars.push(rp([lerp(cx1, hw * 0.9, t), cy1 + rg.range(0, 1) * (hd - cy1)]).concat([rg.range(-1.5, 1.5), rg.range(3, 6)])); }
    parts.push({ z0: Hb, z1: Hb + 6, side: rust, top: '#a06a44', stroke: 0.4, bevel: false, ao: 0, shape: (c, zt) => { for (const b of bars) if (zt * 6 <= b[3]) { c.moveTo(b[0] + b[2] * zt, b[1]); c.lineTo(b[0] + b[2] * zt + 0.01, b[1]); } } });
    parts.push(st3.part(st3.tiers[0], conc, concT, { ao: 0.15,
      detail: (c) => { S.lines(c, 'rgba(30,40,40,0.5)', 0.45, chunk.slice(0, 6)); } }));
    parts.push(paint(st3, Hb + 1, Hc - 1.2, glass, { band: winBand, dash: [1.7, 1.15, 0.9], w: 0.95 }));
    return { r: R * 1.4 + 2, h: Hc + 2, parts, style: 'prop', bevel: 0.8 };
  };

  // Index (into a flat point array) of the edge whose outward normal points most toward +y.
  function southEdge(pts) {
    const n = pts.length, sg = area(pts) > 0 ? 1 : -1;
    let best = 0, bv = -2;
    for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; const ex = pts[j] - pts[i], ey = pts[j + 1] - pts[i + 1], L = Math.hypot(ex, ey) || 1; const ny = -sg * ex / L; if (ny > bv) { bv = ny; best = i; } }
    return best;
  }
  // Point at parameter t along edge i of a polygon.
  const onEdge = (pts, i, t) => { const j = (i + 2) % pts.length; return [lerp(pts[i], pts[j], t), lerp(pts[i + 1], pts[j + 1], t)]; };

  /* ==================================================================
   * W6 OBSIDIAN FORGE — faceted volcanic-glass spires: 3-5 sharp shards
   * with cool specular light faces, near-black shadow faces and a white
   * arris glint; glowing magma veins zig-zag up the camera-facing faces and
   * a cracked glassy scree apron glows orange at the base (opt.glowVein).
   * ================================================================== */
  M.obsObsidian = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#141012', b: '#2a2226', t: '#3a3034', g: '#ff6a1a' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 6);
    const veins = o.glowVein !== false;
    const glassS = '#2a2434', glassT = '#6a6684', spec = '#a2aad2', darkF = '#0a080c', vein = p.g, hot = '#ffcf6a';
    const parts = [];
    const apron = jag(12, R * 1.1, seed + 2, 0.3, rg.range(0, 1), 0, R * 0.06, 1.05, 0.9);
    parts.push({ z0: 0, z1: 1.6, side: '#141016', top: '#3a3444', ao: 0.2, bevel: false, shape: (c) => S.poly(c, apron),
      detail: (c) => {
        clipTo(c, () => S.poly(c, apron));
        if (veins) {
          const g = c.createRadialGradient(0, R * 0.1, 0, 0, R * 0.1, R * 1.1);
          g.addColorStop(0, C.str(vein, 0.75)); g.addColorStop(0.5, C.str(vein, 0.3)); g.addColorStop(1, C.str(vein, 0));
          c.fillStyle = g; c.fill();
          const r2 = rngOf(seed, 13);
          for (let i = 0; i < 6; i++) { const a = r2.range(0, TAU), d0 = R * 0.3, d1 = R * r2.range(0.8, 1.1), m = a + r2.range(-0.3, 0.3); S.lines(c, hot, 0.55, [Math.cos(a) * d0, Math.sin(a) * d0, Math.cos(m) * (d0 + d1) / 2, Math.sin(m) * (d0 + d1) / 2, Math.cos(m) * (d0 + d1) / 2, Math.sin(m) * (d0 + d1) / 2, Math.cos(a) * d1, Math.sin(a) * d1]); }
        }
        const r3 = rngOf(seed, 14);
        for (let i = 0; i < 10; i++) { const a = r3.range(0, TAU), d = R * r3.range(0.5, 1.05); S.fillPoly(c, i % 3 ? '#4a4660' : '#b8c0e0', [Math.cos(a) * d, Math.sin(a) * d, Math.cos(a) * d + 1.6, Math.sin(a) * d - 0.6, Math.cos(a) * d + 0.8, Math.sin(a) * d + 1]); }
        c.restore();
      } });
    const n = 3 + rg.int(0, 2), sp = [];
    for (let i = 0; i < n; i++) {
      const main = i === 0, a = rg.range(0, TAU), d = main ? R * 0.08 : R * rg.range(0.42, 0.62);
      const rr = main ? R * 0.5 : R * rg.range(0.26, 0.36);
      const bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.85, h = main ? H : H * rg.range(0.35, 0.7);
      const out = Math.hypot(bx, by) || 1, lk = h * rg.range(0.06, 0.16);
      sp.push({ base: jag(5 + rg.int(0, 2), rr, seed + i * 17, 0.35, rg.range(0, TAU)), bx, by, h, i, lean: [bx / out * lk, by / out * lk], blunt: !main && rg.chance(0.35) });
    }
    sp.sort((a, b) => a.by - b.by);
    let nv = 0;
    for (const s of sp) {
      const st = stack(s.base, [{ z0: 0, z1: s.h, kf: (u) => (s.blunt ? 0.32 : 0.04) + (s.blunt ? 0.74 : 0.98) * Math.pow(1 - u, 0.8) }], s.bx, s.by, s.lean, true);
      parts.push(st.part(st.tiers[0], glassS, glassT, { ao: 0.5 }));
      parts.push(paint(st, 0.4, s.h - 0.5, spec, { test: litFace, w: 0.95 }));
      parts.push(paint(st, 0.4, s.h - 0.5, darkF, { test: darkFace, w: 0.95 }));
      const vi = extremeVertex(s.base, -0.7, 0.7);
      parts.push(streak(st, 0.4, s.h * 0.94, '#f4f6ff', 0.45, (pts) => [pts[vi], pts[vi + 1]], { flat: true }));
      if (veins && nv < 3 && s.h > H * 0.4) {
        nv++;
        const ei = southEdge(s.base), ph = rg.range(0, 6), top = s.h * rg.range(0.45, 0.7);
        parts.push({ z0: 0.5, z1: top, side: vein, top: hot, stroke: 0.85, flat: true, bevel: false,
          shape: (c, zt) => { const z = lerp(0.5, top, zt), pts = st.at(z); const t = 0.5 + 0.3 * Math.sin(z * 0.32 + ph) + 0.08 * Math.sin(z * 1.3); const q = onEdge(pts, ei, t); c.moveTo(q[0], q[1] + 0.2); c.lineTo(q[0] + 0.02, q[1] + 0.2); } });
      }
    }
    return { r: R * 1.4 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W7 THE SPORE MOON — giant mushroom cluster: one towering mushroom plus
   * 1-2 small ones, pale ribbed stems with a bulbous foot and a frilled
   * skirt, magenta caps with a cream gill rim, pale and glowing cyan spots
   * on dome and wall, on a mycelium mat.
   * ================================================================== */
  M.obsMushroom = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#6a3a7a', b: '#b06ac8', t: '#e0a0f0', g: '#9ffff0' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 7);
    const capS = mixS(p.a, '#7a1a52', 0.6), capT = mixS(p.b, '#e4508a', 0.6), stemS = '#b4a0c4', stemT = '#f2e8f4', gill = '#f6dcea', spotC = '#fff0f6', glow = p.g;
    const parts = [];
    parts.push({ z0: 0, z1: 0.8, side: '#3e3050', top: '#7a6a90', bevel: false, ao: 0.2, shape: (c) => S.blob(c, 0, R * 0.12, R * 1.15, seed, 12, 0.35),
      detail: (c) => {
        const r2 = rngOf(seed, 15);
        for (let i = 0; i < 9; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.3, 1.05); S.lines(c, 'rgba(240,220,250,0.45)', 0.35, [Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2, Math.cos(a + 0.3) * d, Math.sin(a + 0.3) * d]); }
        for (let i = 0; i < 6; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.5, 1.0); S.dot(c, C.str(glow, 0.5), Math.cos(a) * d, Math.sin(a) * d, 1.1); S.dot(c, glow, Math.cos(a) * d, Math.sin(a) * d, 0.5); }
      } });
    const ms = [{ x: 0, y: -R * 0.05, s: 1, h: H, main: true }];
    const nSm = 1 + rg.int(0, 1), a0 = rg.range(0, TAU);
    for (let i = 0; i < nSm; i++) { const a = a0 + i * 2.4, d = R * rg.range(0.75, 0.95); ms.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, s: rg.range(0.32, 0.46), h: H * rg.range(0.3, 0.42) }); }
    ms.sort((a, b) => a.y - b.y);
    for (const m of ms) {
      const stemR = R * (m.main ? 0.3 : 0.75 * m.s), Hs = m.h * 0.8, capR = R * (m.main ? rg.range(1.4, 1.6) : 1.45 * m.s), cT = Math.max(3, m.h * 0.12);
      const EX = 1.12, EY = 0.86;
      const lean = [rg.range(-0.1, 0.1) * Hs, rg.range(-0.1, 0.02) * Hs];
      const st = stack(ngon(12, stemR, 0.1), [{ z0: 0, z1: Hs + 1, kf: (u) => 1 + 0.6 * (1 - U.smoothstep(0, 0.22, u)) - 0.12 * u }], m.x, m.y, lean);
      const cc = st.centre(Hs);
      parts.push(st.part(st.tiers[0], stemS, stemT, { ao: 0.45 }));
      // stem ribs
      parts.push(streak(st, 2, Hs - 1, hexS(stemS, -0.18), 0.4, (pts, z) => { const ce = st.centre(z), k = 1 + 0.6 * (1 - U.smoothstep(0, 0.22, z / (Hs + 1))) - 0.12 * z / (Hs + 1), q = []; for (const a of [0.55, 1.2, 1.9, 2.55]) q.push(ce[0] + Math.cos(a) * stemR * k, ce[1] + Math.sin(a) * stemR * k); return q; }));
      // gill rim under the cap, then cap wall and dome
      parts.push({ z0: Hs - 2.2, z1: Hs - 0.4, side: gill, top: gill, ao: 0.15, shape: (c) => S.ell(c, cc[0], cc[1], capR * EX * 0.95, capR * EY * 0.95) });
      const rimZ = Hs + cT * 0.32;
      parts.push({ z0: Hs, z1: rimZ, side: capS, top: capT, ao: 0.3, shape: (c, zt) => S.ell(c, cc[0], cc[1], capR * EX * (0.97 + 0.03 * zt), capR * EY * (0.97 + 0.03 * zt)) });
      const domeK = (u) => Math.sqrt(Math.max(0.04, 1 - Math.pow(u * 0.8, 2)));
      const spots = [];
      for (let i = 0; i < (m.main ? 7 : 3); i++) spots.push({ a: rg.range(0.35, 2.8), u: rg.range(0.15, 0.6), r: capR * rg.range(0.05, 0.08), g: i % 3 === 0 });
      const topSpots = [];
      for (let i = 0; i < (m.main ? 7 : 3); i++) { const a = rg.range(0, TAU), d = rg.range(0.1, 0.5) * capR; topSpots.push([cc[0] + Math.cos(a) * d * EX, cc[1] + Math.sin(a) * d * EY, capR * rg.range(0.05, 0.1), i % 3 === 0]); }
      parts.push({ z0: rimZ, z1: Hs + cT, side: capS, top: capT, ao: 0.2, shape: (c, zt) => S.ell(c, cc[0], cc[1], capR * EX * domeK(zt), capR * EY * domeK(zt)),
        detail: (c) => {
          const rT = capR * domeK(1);
          clipTo(c, () => S.ell(c, cc[0], cc[1], rT * EX, rT * EY));
          const g = c.createRadialGradient(cc[0] - rT * 0.35, cc[1] - rT * 0.4, 0, cc[0], cc[1], rT);
          g.addColorStop(0, 'rgba(255,200,230,0.55)'); g.addColorStop(0.6, 'rgba(255,200,230,0)'); c.fillStyle = g; c.fill();
          for (const q of topSpots) { S.dot(c, q[3] ? C.str(glow, 0.5) : spotC, q[0], q[1], q[2] * (q[3] ? 1.5 : 1)); if (q[3]) S.dot(c, '#eafffb', q[0], q[1], q[2] * 0.6); }
          c.restore();
        } });
      parts.push({ z0: rimZ, z1: Hs + cT * 0.9, side: spotC, top: spotC, flat: true, bevel: false,
        shape: (c, zt) => {
          for (const q of spots) {
            const dz = 0.22, du = (zt - q.u) / dz;
            if (Math.abs(du) >= 1) continue;
            const rr = capR * domeK(zt) * 0.96, k = Math.sqrt(1 - du * du);
            S.circ(c, cc[0] + Math.cos(q.a) * rr * EX, cc[1] + Math.sin(q.a) * rr * EY, q.r * k);
          }
        } });
    }
    return { r: R * 1.95 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W8 STORM GIANT — sky-rock pillar: a weathered slate column that pinches
   * at the waist and flares under a grassy, wind-combed cap, crackling blue
   * storm veins on its face, and 2-3 small floating rock islets drifting
   * beside it (inverted cones, some with grass) — a piece of the floating
   * archipelago.
   * ================================================================== */
  M.obsSkyPillar = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#4a4048', b: '#6a6068', t: '#8a8088', g: '#9fdcff' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 8);
    const rock = mixS(p.b, '#5e5a74', 0.35), rockT = mixS(p.t, '#b0aac0', 0.4), rockD = mixS(p.a, '#1e1a26', 0.5), pale = mixS(rock, '#c8c0d0', 0.35);
    const grassS = '#36602e', grassT = '#94c860', glow = p.g;
    const parts = [];
    const apron = jag(11, R * 1.08, seed + 1, 0.3, rg.range(0, 1), 0, R * 0.06);
    parts.push({ z0: 0, z1: 2, side: rockD, top: rock, ao: 0.3, shape: (c) => S.poly(c, apron) });
    const Hp = H * 0.9, ph = rg.range(0, 6);
    const base = jag(11, R * 0.72, seed + 2, 0.3, rg.range(0, TAU));
    const pk = (u) => (1.15 - 0.6 * U.smoothstep(0, 0.55, u) + 0.75 * U.smoothstep(0.55, 1, u)) * (0.93 + 0.07 * Math.cos(u * 11 + ph));
    const st = stack(base, [{ z0: 0, z1: Hp, kf: pk }, { z0: Hp, z1: Hp + 3.5, kf: (u) => pk(1) * (1.04 - 0.04 * u) }], 0, 0, [rg.range(-3, 3), rg.range(-2, 0)]);
    // floating islets
    const isl = [];
    const ni = 2 + rg.int(0, 1), a0 = rg.range(0, TAU);
    for (let i = 0; i < ni; i++) {
      const a = a0 + i * (TAU / ni) + rg.range(-0.4, 0.4), d = R * rg.range(1.25, 1.5), rs = R * rg.range(0.32, 0.44);
      const zc = H * rg.range(0.3, 0.7), hh = rs * 1.5;
      const ib = jag(8, rs, seed + 30 + i, 0.3, rg.range(0, TAU));
      isl.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, st: null, ib, z0: zc - hh * 0.6, z1: zc + hh * 0.4, grass: rg.chance(0.6), rs });
    }
    const isletParts = (q) => {
      const s2 = stack(q.ib, [{ z0: q.z0, z1: q.z1, kf: (u) => 0.12 + 0.88 * Math.pow(u, 0.55) }], q.x, q.y);
      const out = [s2.part(s2.tiers[0], rock, q.grass ? grassT : rockT, { ao: 0.5 }), paint(s2, q.z0 + 0.5, q.z1 - 0.5, rockD, { test: darkFace, w: 0.8 })];
      if (q.grass) out.push(paint(s2, q.z1 - 1.4, q.z1 - 0.2, grassS, { w: 0.9 }));
      return out;
    };
    for (const q of isl) if (q.y < 0) parts.push(...isletParts(q));
    parts.push(st.part(st.tiers[0], rock, rockT, { ao: 0.5 }));
    parts.push(paint(st, 3, Hp - 2, pale, { band: (z) => frac((z + ph * 3) / 13) < 0.1, w: 0.8 }));
    parts.push(paint(st, 1, Hp - 1, rockD, { test: darkFace, w: 0.9 }));
    // erosion grooves
    parts.push(streak(st, 2, Hp * 0.8, rockD, 0.5, (pts) => { const q = [], k = pts.length / 2; for (const i of [Math.floor(k * 0.2), Math.floor(k * 0.4)]) q.push(pts[i * 2], pts[i * 2 + 1]); return q; }));
    // storm veins
    const ei = southEdge(base), vph = rg.range(0, 6);
    parts.push({ z0: H * 0.12, z1: H * 0.62, side: glow, top: '#ffffff', stroke: 0.7, flat: true, bevel: false,
      shape: (c, zt) => { const z = lerp(H * 0.12, H * 0.62, zt), pts = st.at(z); const t = 0.5 + 0.32 * Math.sin(z * 0.5 + vph) * Math.sign(Math.sin(z * 0.21)); const q = onEdge(pts, ei, t); c.moveTo(q[0], q[1] + 0.2); c.lineTo(q[0] + 0.02, q[1] + 0.2); } });
    // grass cap with overhanging turf lip
    const capTop = st.at(Hp + 3.5), ce = st.centre(Hp + 3.5);
    parts.push(st.part(st.tiers[1], grassS, grassT, { ao: 0.25,
      detail: (c) => {
        clipTo(c, () => S.poly(c, capTop));
        const g = c.createRadialGradient(ce[0] - R * 0.3, ce[1] - R * 0.3, 0, ce[0], ce[1], R);
        g.addColorStop(0, 'rgba(230,255,180,0.4)'); g.addColorStop(1, 'rgba(230,255,180,0)'); c.fillStyle = g; c.fill();
        const r2 = rngOf(seed, 16);
        for (let i = 0; i < 9; i++) { const a = r2.range(0, TAU), d = R * r2.range(0.1, 0.6); const x = ce[0] + Math.cos(a) * d, y = ce[1] + Math.sin(a) * d; S.lines(c, 'rgba(40,80,30,0.6)', 0.45, [x, y, x + 2.2, y - 0.6]); }
        c.restore();
      } }));
    // wind-combed shrubs on the summit
    const bush = []; for (let i = 0; i < 3; i++) { const a = rg.range(0, TAU), d = R * rg.range(0.2, 0.5); bush.push([ce[0] + Math.cos(a) * d, ce[1] + Math.sin(a) * d * 0.8, R * rg.range(0.16, 0.24)]); }
    parts.push({ z0: Hp + 3.5, z1: Hp + 7, side: '#2a5228', top: '#6aa448', ao: 0.4, shape: (c, zt) => { for (const b of bush) S.blob(c, b[0], b[1], b[2] * (1 - zt * zt * 0.5), seed + b[2] * 9, 8, 0.25); } });
    // storm crystal on the summit (lightning rod)
    if (rg.chance(0.6)) {
      const cx = ce[0] + R * 0.2, cy = ce[1] - R * 0.1;
      parts.push({ z0: Hp + 3.5, z1: Hp + 12, side: hexS(glow, -0.3), top: '#eaf8ff', flat: true, shape: (c, zt) => { const k = 1 - zt * 0.85; S.poly(c, [cx - 1.6 * k, cy, cx, cy - 1.2 * k, cx + 1.6 * k, cy, cx, cy + 1.2 * k]); S.poly(c, [cx + 2.2 - 1 * k, cy + 1.5, cx + 2.2, cy + 1.5 - 0.8 * k, cx + 2.2 + 1 * k, cy + 1.5, cx + 2.2, cy + 1.5 + 0.8 * k]); } });
    }
    for (const q of isl) if (q.y >= 0) parts.push(...isletParts(q));
    return { r: R * 2.0 + 2, h: H + 14, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W9 THE DEAD MACHINE — gear tower: a riveted dark-iron octagonal tower on
   * a hazard-striped plinth, 2-3 brass gears turning at different heights
   * (4 anim frames loop one tooth), glowing furnace vents, piston rods, a
   * lit control housing and a smokestack with a blinking beacon.
   * ================================================================== */
  M.obsGearTower = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#4a4e56', b: '#7a808a', t: '#9aa0aa', g: '#ff9a3a', d: '#1a1c20' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 9);
    const iron = '#3e3a36', ironT = '#7a7064', steel = mixS(p.a, '#34363c', 0.4), steelT = mixS(p.b, '#9a9aa0', 0.3), brass = '#c49a4a', brassS = '#7a5a28', glow = p.g, trim = '#e8a83a';
    const parts = [];
    const rot8 = Math.PI / 8;
    const plinth = ngon(8, R * 0.98, rot8), shaft = ngon(8, R * 0.56, rot8), house = ngon(8, R * 0.74, rot8);
    const zP = H * 0.1, zS = H * 0.74, zH = H * 0.85;
    parts.push({ z0: 0, z1: zP, side: iron, top: ironT, ao: 0.4, shape: (c) => S.poly(c, plinth),
      detail: (c) => {
        // hazard ring + bolts
        for (let i = 0; i < 16; i++) { const a0 = (i / 16) * TAU, a1 = a0 + TAU / 32; const r1 = R * 0.9, r2 = R * 0.76; S.fillPoly(c, i % 2 ? '#24221f' : trim, [Math.cos(a0) * r1, Math.sin(a0) * r1, Math.cos(a1) * r1, Math.sin(a1) * r1, Math.cos(a1) * r2, Math.sin(a1) * r2, Math.cos(a0) * r2, Math.sin(a0) * r2]); }
      } });
    const stP = stack(plinth, [{ z0: 0, z1: zP, k0: 1, k1: 1 }]);
    parts.push(paint(stP, zP * 0.3, zP * 0.6, '#24221f', { dash: [1.6, 1.4, 0.6], w: 0.9 }));
    // gears: centres off-axis so most of each gear stands proud of the shaft
    const ng = 2 + rg.int(0, 1), ga = rg.range(0, TAU), gears = [];
    for (let i = 0; i < ng; i++) {
      const a = ga + i * 2.2, zr = H * (0.26 + i * 0.22) + rg.range(-2, 2), gr = R * rg.range(0.55, 0.72), n = 10 + rg.int(0, 4);
      gears.push({ x: Math.cos(a) * R * 0.48, y: Math.sin(a) * R * 0.42, z: zr, r: gr, n, dir: i % 2 ? -1 : 1, ph: rg.range(0, 1) });
    }
    const gearPts = (g, anim) => {
      const pts = [], rot = g.ph + g.dir * anim * TAU / g.n;
      for (let i = 0; i < g.n; i++) {
        const a = rot + (i / g.n) * TAU, w = TAU / g.n;
        const ro = g.r, ri = g.r * 0.8;
        pts.push(g.x + Math.cos(a - w * 0.5) * ri, g.y + Math.sin(a - w * 0.5) * ri, g.x + Math.cos(a - w * 0.2) * ro, g.y + Math.sin(a - w * 0.2) * ro, g.x + Math.cos(a + w * 0.2) * ro, g.y + Math.sin(a + w * 0.2) * ro);
      }
      return pts;
    };
    const gearParts = (g) => [
      { z0: g.z, z1: g.z + 2.6, side: brassS, top: brass, ao: 0.25, shape: (c, zt, an) => S.poly(c, gearPts(g, an)),
        detail: (c, an) => {
          const rot = g.ph + g.dir * an * TAU / g.n;
          for (let k = 0; k < 5; k++) { const a = rot + (k / 5) * TAU; S.dot(c, '#3a2a14', g.x + Math.cos(a) * g.r * 0.5, g.y + Math.sin(a) * g.r * 0.5, g.r * 0.14); }
          S.lines(c, 'rgba(255,240,200,0.4)', 0.4, [g.x - g.r * 0.7, g.y - g.r * 0.3, g.x - g.r * 0.3, g.y - g.r * 0.7]);
        } },
      { z0: g.z + 2.6, z1: g.z + 3.6, side: '#4a4440', top: '#a09484', shape: (c) => S.circ(c, g.x, g.y, g.r * 0.22), detail: (c) => S.dot(c, '#2a2622', g.x, g.y, g.r * 0.09) },
    ];
    const stS = stack(shaft, [{ z0: zP, z1: zS, k0: 1, k1: 0.94 }]);
    for (const g of gears) if (g.y < -R * 0.1) parts.push(...gearParts(g));
    // piston rods
    const rods = [[-R * 0.62, R * 0.2], [R * 0.3, R * 0.6]];
    parts.push({ z0: zP, z1: H * 0.52, side: '#8a5a3a', top: '#d09a6a', ao: 0.3, shape: (c) => { for (const q of rods) S.circ(c, q[0], q[1], 1.2); } });
    parts.push(stS.part(stS.tiers[0], steel, steelT, { ao: 0.45 }));
    parts.push(paint(stS, zP + 2, zS - 1, hexS(steel, -0.45), { band: (z) => frac(z / 9) < 0.08, w: 0.9 }));
    parts.push(paint(stS, zP + 1, zS - 1, hexS(steel, -0.35), { test: darkFace, w: 0.9 }));
    // furnace vents (flicker between frames)
    const ventBand = (z) => { const f = (z - zP) / (zS - zP); return (f > 0.18 && f < 0.27) || (f > 0.56 && f < 0.63); };
    parts.push(paint(stS, zP, zS, glow, { band: ventBand, dash: [1.1, 1.0, 1.4], w: 0.9, extra: { flat: true, when: (an) => an < 0.5 } }));
    parts.push(paint(stS, zP, zS, '#ffd27a', { band: ventBand, dash: [1.1, 1.0, 1.4], w: 0.9, extra: { flat: true, when: (an) => an >= 0.5 } }));
    for (const g of gears) if (g.y >= -R * 0.1) parts.push(...gearParts(g));
    // control housing with lit window band
    const stH = stack(house, [{ z0: zS, z1: zH, k0: 0.92, k1: 1 }]);
    parts.push(stH.part(stH.tiers[0], iron, ironT, { ao: 0.3,
      detail: (c) => { S.lines(c, 'rgba(20,18,16,0.55)', 0.45, [-R * 0.5, 0, R * 0.5, 0, 0, -R * 0.5, 0, R * 0.5]); S.dot(c, '#2a2622', R * 0.3, -R * 0.25, 2.4); S.dot(c, '#5a524a', R * 0.3, -R * 0.25, 1.2); } }));
    parts.push(paint(stH, zS + (zH - zS) * 0.45, zS + (zH - zS) * 0.75, glow, { dash: [1.6, 0.9, 0.8], w: 0.9, extra: { flat: true } }));
    // smokestack + beacon
    const sx = -R * 0.25, sy = R * 0.1;
    parts.push({ z0: zH, z1: H, side: '#2e2b28', top: '#5a524a', ao: 0.3, shape: (c, zt) => S.circ(c, sx, sy, R * 0.2 * (1 - zt * 0.15)), detail: (c) => { S.dot(c, '#141210', sx, sy, R * 0.13); S.dot(c, C.str(glow, 0.5), sx, sy, R * 0.07); } });
    parts.push(paint(stack(ngon(10, R * 0.2, 0), [{ z0: zH, z1: H, k0: 1, k1: 0.85 }], sx, sy), H - 6, H - 3, trim, { w: 0.9 }));
    parts.push({ z0: zH, z1: zH + 2.5, side: '#7a1a10', top: '#ff4a2a', flat: true, bevel: false, when: (an) => an < 0.25 || (an >= 0.5 && an < 0.75), shape: (c) => S.circ(c, R * 0.5, R * 0.4, 1) });
    return { r: R * 1.35 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * W10 THE FIRST WORLD — Choir carved column: stepped plinth, an octagonal
   * bone-stone shaft in carved drums separated by dark recessed collars, violet
   * glyph channels on the faces, a flared capital crowned by a floating
   * crystal inside a halo ring and two floating fins. By seed a broken column:
   * jagged stump leaking violet light, the capital fallen at its foot.
   * ================================================================== */
  M.obsChoirColumn = function (pal, o) {
    o = o || {};
    const p = pickPal(pal, o, { a: '#9a907c', b: '#d0c6b0', t: '#f0e6d0', g: '#9a7aff' });
    const H = o.h || 90, R = o.r || 16, seed = o.seed || 1, rg = rngOf(seed, 10);
    const stoneS = mixS(p.a, '#5e5648', 0.5), stoneT = mixS(p.t, '#f4ead4', 0.3), recess = '#3a2e4c', glyph = mixS(p.g, '#c8b0ff', 0.3), glowC = p.g;
    const parts = [];
    const broken = rg.chance(0.35);
    const r8 = Math.PI / 8 + rg.range(-0.15, 0.15);
    // plinth steps
    const step1 = ngon(8, R * 1.0, r8), step2 = ngon(8, R * 0.8, r8);
    parts.push({ z0: 0, z1: 3, side: stoneS, top: hexS(stoneT, -0.06), ao: 0.4, shape: (c) => S.poly(c, step1) });
    parts.push({ z0: 3, z1: 6.5, side: stoneS, top: stoneT, ao: 0.3, shape: (c) => S.poly(c, step2),
      detail: (c) => { c.save(); c.strokeStyle = C.str(glowC, 0.8); c.lineWidth = 0.6; c.beginPath(); S.poly(c, ngon(8, R * 0.68, r8)); c.stroke(); c.restore(); } });
    const shaft = ngon(8, R * 0.5, r8);
    const Hs = broken ? H * rg.range(0.45, 0.62) : H * 0.68;
    // drums separated by recessed collars
    const nd = broken ? 2 : 3, dh = (Hs - 6.5) / nd;
    const tiers = [];
    for (let i = 0; i < nd; i++) {
      const z0 = 6.5 + i * dh;
      tiers.push({ z0, z1: z0 + 1.6, k0: 0.82, k1: 0.82, collar: true });
      tiers.push({ z0: z0 + 1.6, z1: z0 + dh, k0: 1, k1: 0.97 });
    }
    const st = stack(shaft, tiers);
    for (const T of tiers) {
      if (T.collar) { parts.push(st.part(T, recess, recess, { ao: 0.2, bevel: false })); parts.push(paint(st, T.z0 + 0.3, T.z1 - 0.2, glowC, { w: 0.6, extra: { flat: true } })); }
      else parts.push(st.part(T, stoneS, stoneT, { ao: 0.35 }));
    }
    // glyph channels: dashed violet ticks in a rhythm up every drum face
    const gph = rg.range(0, 1);
    const onDrum = (z) => { const T = st.tierAt(z); return !T.collar && z > T.z0 + 1.5 && z < T.z1 - 1.5; };
    parts.push(paint(st, 8, Hs - 1, recess, { band: onDrum, dash: [1.5, 40, 0], w: 0.9 }));
    parts.push(paint(st, 8, Hs - 1, glyph, { band: onDrum, dash: [0.6, 40, 0], w: 0.7, extra: { flat: true } }));
    parts.push(paint(st, 8, Hs - 1, glyph, { band: (z) => onDrum(z) && frac(z / 6 + gph) < 0.1, dash: [2.6, 40, 0], w: 0.6, extra: { flat: true } }));
    parts.push(paint(st, 7, Hs - 1, hexS(stoneS, -0.3), { test: darkFace, w: 0.8, extra: { ao: 0 } }));
    if (broken) {
      // jagged break at the top + violet light leaking, fallen capital at the foot
      const jagTop = jag(9, R * 0.46, seed + 4, 0.35, r8);
      parts.push({ z0: Hs, z1: Hs + 4, side: stoneS, top: stoneT, ao: 0.1, shape: (c, zt) => { const pts = []; for (let i = 0; i < jagTop.length; i += 2) { const keep = U.hash2(i, seed, 5) > zt * 0.9; const k = keep ? 1 : 0.4; pts.push(jagTop[i] * k, jagTop[i + 1] * k); } S.poly(c, pts); },
        detail: (c) => { S.dot(c, C.str(glowC, 0.45), 0, 0, R * 0.3); S.dot(c, glyph, 0, 0, R * 0.12); } });
      parts.push({ z0: Hs + 1, z1: Hs + 9, side: hexS(glowC, -0.2), top: '#f0e8ff', flat: true, shape: (c, zt) => { const k = 1 - zt; S.poly(c, [-1.5 * k - 1, 0, -1, -1.2 * k, -1 + 1.5 * k, 0, -1, 1.2 * k]); if (zt < 0.6) S.poly(c, [2 - 1.2 * k, 1, 2, 1 - k, 2 + 1.2 * k, 1, 2, 1 + k]); } });
      const fa = rg.range(-0.6, 0.9), fx = Math.cos(fa) * R * 1.05, fy = Math.sin(fa) * R * 0.8;
      parts.push({ z0: 0, z1: R * 0.55, side: stoneS, top: stoneT, ao: 0.45, shape: (c) => { c.save(); c.translate(fx, fy); c.rotate(fa + 1.2); S.poly(c, [-R * 0.55, -R * 0.36, R * 0.55, -R * 0.36, R * 0.62, 0, R * 0.55, R * 0.36, -R * 0.55, R * 0.36, -R * 0.62, 0]); c.restore(); },
        detail: (c) => { c.save(); c.translate(fx, fy); c.rotate(fa + 1.2); S.lines(c, C.str(glyph, 0.9), 0.6, [-R * 0.4, 0, R * 0.4, 0, -R * 0.2, -R * 0.2, -R * 0.2, R * 0.2, R * 0.2, -R * 0.2, R * 0.2, R * 0.2]); c.restore(); } });
      return { r: R * 1.6 + 2, h: Hs + 10, parts, style: 'prop', bevel: 0.8 };
    }
    // flared capital
    const cap = ngon(8, R * 0.72, r8);
    parts.push({ z0: Hs, z1: Hs + 5, side: stoneS, top: stoneT, ao: 0.25, shape: (c, zt) => S.poly(c, xf(cap, 0.72 + 0.28 * Math.sqrt(zt))),
      detail: (c) => {
        c.save(); c.strokeStyle = C.str(glowC, 0.9); c.lineWidth = 0.6; c.beginPath(); S.poly(c, ngon(8, R * 0.5, r8)); c.stroke(); c.restore();
        S.dot(c, C.str(glowC, 0.4), 0, 0, R * 0.32); S.dot(c, glyph, 0, 0, R * 0.14);
      } });
    parts.push(paint(stack(cap, [{ z0: Hs, z1: Hs + 5, kf: (u) => 0.72 + 0.28 * Math.sqrt(u) }]), Hs + 2.6, Hs + 3.6, glowC, { w: 0.6, extra: { flat: true } }));
    // floating crystal in a halo ring, flanked by floating fins
    const zr = Hs + 5 + (H - Hs - 5) * 0.4, hr = R * 0.55, zc0 = Hs + 8, zc1 = H;
    parts.push({ z0: zr, z1: zr + 0.8, side: glowC, top: '#d8ccff', stroke: 0.9, flat: true, bevel: false, shape: (c) => { c.moveTo(-hr, 0); c.arc(0, 0, hr, Math.PI, TAU); } });
    const fz = Hs + 7, fins = [[-R * 0.95, 1], [R * 0.95, -1]];
    parts.push({ z0: fz, z1: fz + (H - Hs) * 0.55, side: stoneS, top: stoneT, ao: 0.2, shape: (c, zt) => { const k = 1 - zt * 0.6; for (const f of fins) S.poly(c, [f[0] - 1.6 * k, -R * 0.3 * k, f[0] + 1.6 * k, -R * 0.1 * k, f[0] + 1.2 * k, R * 0.3 * k, f[0] - 1.4 * k, R * 0.15 * k]); },
      detail: (c) => { for (const f of fins) S.dot(c, glyph, f[0], 0, 0.7); } });
    parts.push({ z0: zc0, z1: zc1, side: hexS(glowC, -0.15), top: '#f4f0ff', flat: true, shape: (c, zt) => { const k = zt < 0.4 ? zt / 0.4 : 1 - (zt - 0.4) / 0.6; const w = 0.4 + R * 0.2 * k; S.poly(c, [-w, 0, 0, -w * 0.7, w, 0, 0, w * 0.7]); },
      detail: (c) => S.dot(c, '#ffffff', 0, 0, 0.5) });
    parts.push({ z0: zr, z1: zr + 0.8, side: glowC, top: '#d8ccff', stroke: 0.9, flat: true, bevel: false, shape: (c) => { c.moveTo(hr, 0); c.arc(0, 0, hr, 0, Math.PI); } });
    return { r: R * 1.3 + 2, h: H + 2, parts, style: 'prop', bevel: 0.8 };
  };

  /* ==================================================================
   * LZ DROPSHIP — FRC heavy carrier "Halcyon": wide boxy hull, open rear ramp
   * onto the ground, four landing struts, four engine pods on stub wings,
   * raised cockpit, dorsal spine and nav lights. Parked, nose +x.
   * ================================================================== */
  M.dropship = function (pal, o) {
    const p = PAL(pal, { a: '#4c5664', b: '#c4ccd4', t: '#de9c3a', g: '#5fe6ff', d: '#20252c' });
    o = o || {};
    const hullS = p.a, hullT = p.b, panel = hexS(p.b, -0.2), dark = p.d, metal = '#3a414b';
    const seam = 'rgba(24,28,34,0.5)', seamL = 'rgba(255,255,255,0.25)', trim = p.t, glow = p.g;
    const HZ = 9;                // hull floor height (struts below)
    const parts = [];
    const strutPts = [[24, 15], [24, -15], [-26, 17], [-26, -17]];
    // ground: crates + fuel drums by the ramp
    parts.push({ z0: 0, z1: 4.5, side: '#6a5532', top: '#b08a4e', shape: (c) => { S.rect(c, -60, 13, 6, 6); S.rect(c, -54, 15, 5, 5); S.rect(c, -58, -21, 7, 6); },
      detail: (c) => { S.lines(c, 'rgba(50,34,16,0.6)', 0.4, [-60, 13, -54, 19, -60, 19, -54, 13, -58, -21, -51, -15, -58, -15, -51, -21]); S.fillPoly(c, trim, [-54, 15, -49, 15, -49, 16, -54, 16]); } });
    parts.push({ z0: 0, z1: 6, side: '#3a5a6a', top: '#6a96a8', shape: (c) => { S.circ(c, -49, -21.5, 2); S.circ(c, -45.5, -22.5, 2); }, detail: (c) => { S.dot(c, '#1d2a30', -49, -21.5, 0.6); S.dot(c, '#1d2a30', -45.5, -22.5, 0.6); } });
    // landing struts + foot pads
    parts.push({ z0: 0, z1: 1, side: dark, top: metal, bevel: false, shape: (c) => { for (const s of strutPts) S.ell(c, s[0], s[1], 3, 2.4); } });
    parts.push({ z0: 0.5, z1: HZ, side: '#2c323a', top: '#59626d', stroke: 1.8, bevel: false, shape: (c) => { for (const s of strutPts) S.circ(c, s[0], s[1], 0.15); } });
    parts.push({ z0: 3, z1: HZ, side: '#3f4752', top: '#6b7480', stroke: 0.9, bevel: false, shape: (c, zt) => { for (const s of strutPts) { const k = 1 - zt; S.seg(c, s[0], s[1], s[0] * (1 - 0.18 * (1 - k)) , s[1] * (0.55 + 0.45 * k)); } } });
    // rear ramp sloping from the bay floor to the ground (hazard chevrons)
    const rx0 = -40, rlen = 20, rw = 9;
    parts.push({ z0: 0, z1: HZ - 0.5, side: '#5a626c', top: '#8b939c', ao: 0.25, bevel: false,
      shape: (c, zt) => { const x = rx0 - rlen * (1 - zt); S.rect(c, x - 1.6, -rw, 3.2, rw * 2); } });
    parts.push({ z0: 0, z1: HZ - 0.5, side: trim, top: trim, flat: true, bevel: false, when: () => true,
      shape: (c, zt) => { const x = rx0 - rlen * (1 - zt); const ph = Math.floor(zt * 6) % 2; if (!ph) { S.rect(c, x - 1.6, -rw, 3.2, 1.6); S.rect(c, x - 1.6, rw - 1.6, 3.2, 1.6); } } });
    // ventral belly
    const belly = S.sym([42, 0, 38, 8, 28, 15, -34, 16.5, -40, 14, -41, 0]);
    parts.push({ z0: HZ - 2, z1: HZ, side: dark, top: metal, bevel: false, shape: (c) => S.poly(c, belly) });
    // stub wings + engine pods
    const wingF = [12, 14, 4, 30, -4, 30, -2, 14], wingR = [-18, 15, -24, 31, -32, 31, -32, 15];
    const mir = (a) => a.map((v, i) => (i % 2 ? -v : v));
    parts.push({ z0: HZ + 3, z1: HZ + 5.5, side: hullS, top: panel, shape: (c) => { S.poly(c, wingF); S.poly(c, mir(wingF)); S.poly(c, wingR); S.poly(c, mir(wingR)); },
      detail: (c) => { for (const sg of [1, -1]) { S.fillPoly(c, trim, [4, 29.4 * sg, -4, 29.4 * sg, -3.6, 27.8 * sg, 4.6, 27.8 * sg]); S.fillPoly(c, trim, [-24, 30.4 * sg, -32, 30.4 * sg, -32, 28.8 * sg, -24.6, 28.8 * sg]); } } });
    const pods = [[1, 27], [1, -27], [-27, 28], [-27, -28]];
    parts.push({ z0: HZ + 1, z1: HZ + 9, side: metal, top: '#8a94a0', shape: (c) => { for (const q of pods) S.rrect(c, q[0] - 9, q[1] - 4, 17, 8, 3.6); },
      detail: (c) => {
        for (const q of pods) {
          S.lines(c, seam, 0.4, [q[0] - 2, q[1] - 3.8, q[0] - 2, q[1] + 3.8, q[0] + 3, q[1] - 3.9, q[0] + 3, q[1] + 3.9]);
          S.dot(c, '#14181d', q[0] + 6.6, q[1], 2.6); S.dot(c, '#3c4550', q[0] + 6.6, q[1], 1.4);
          S.lines(c, seamL, 0.5, [q[0] - 6, q[1] - 2.8, q[0] + 4, q[1] - 2.8]);
        }
      } });
    // pod exhaust glows
    parts.push({ z0: HZ + 3, z1: HZ + 7, side: hexS(glow, -0.35), top: glow, flat: true, bevel: false, shape: (c) => { for (const q of pods) S.ell(c, q[0] - 9.2, q[1], 1.4, 3); } });
    // main hull with the open bay notch at the rear
    const hull = [44, 0, 40.5, 6, 33, 12, 22, 15.5, -30, 16.5, -40, 14.5, -40, 8.5, -16, 8.5, -16, -8.5, -40, -8.5, -40, -14.5, -30, -16.5, 22, -15.5, 33, -12, 40.5, -6];
    parts.push({ z0: HZ, z1: HZ + 10, side: hullS, top: hullT, ao: 0.35, shape: (c) => S.poly(c, hull),
      detail: (c) => {
        S.lines(c, seam, 0.45, [30, -12.5, 30, 12.5, 14, -15.4, 14, 15.4, -4, -16, -4, 16, -22, -16.4, -22, -8.5, -22, 8.5, -22, 16.4, 14, 0, -4, 0]);
        S.lines(c, seamL, 0.5, [43, 0.6, 33, 11.4, 22, 15, -30, 16]);
        // hazard stripes along the bay lips
        for (let i = 0; i < 6; i++) { const x = -39 + i * 4; S.fillPoly(c, i % 2 ? '#1f2328' : trim, [x, 8.6, x + 3.4, 8.6, x + 2.4, 11, x - 1, 11]); S.fillPoly(c, i % 2 ? '#1f2328' : trim, [x, -8.6, x + 3.4, -8.6, x + 2.4, -11, x - 1, -11]); }
        // amber trim chevrons on the nose shoulders + FRC roundel
        S.fillPoly(c, trim, [36, 9.6, 26, 13.8, 25, 12.6, 35, 8.5]); S.fillPoly(c, trim, [36, -9.6, 26, -13.8, 25, -12.6, 35, -8.5]);
        S.dot(c, '#2a3038', 4, 11.5, 2.4); S.dot(c, glow, 4, 11.5, 1.5); S.dot(c, '#2a3038', 4, 11.5, 0.7);
        // vents
        for (let i = 0; i < 4; i++) S.lines(c, 'rgba(14,16,20,0.7)', 0.5, [-8 - i * 1.6, -13.5, -8 - i * 1.6, -10.5]);
      } });
    // cargo bay floor (recessed) with interior light strips
    parts.push({ z0: HZ, z1: HZ + 1, side: '#2a3038', top: '#3e4651', flat: true, bevel: false, shape: (c) => S.rect(c, -40, -8.5, 24, 17),
      detail: (c) => {
        const g = c.createLinearGradient(-40, 0, -16, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        c.fillStyle = g; c.beginPath(); c.rect(-40, -8.5, 24, 17); c.fill();
        S.lines(c, C.str(glow, 0.9), 0.6, [-38, -7.6, -18, -7.6, -38, 7.6, -18, 7.6]);
        S.lines(c, 'rgba(255,255,255,0.12)', 0.4, [-36, -4, -36, 4, -31, -4, -31, 4, -26, -4, -26, 4, -21, -4, -21, 4]);
      } });
    // inner wall of the bay (north side faces the camera): darker panel
    parts.push({ z0: HZ + 1, z1: HZ + 10, side: '#3a424c', top: '#3a424c', stroke: 0.6, ao: 0.3, bevel: false, shape: (c) => S.seg(c, -40, -8.5, -16, -8.5) });
    // dorsal superstructure + spine
    const spine = S.sym([30, 0, 26, 7, -10, 8, -14, 6, -14, 0]);
    parts.push({ z0: HZ + 10, z1: HZ + 14, side: hexS(hullS, 0.05), top: hexS(hullT, 0.06), shape: (c) => S.poly(c, spine),
      detail: (c) => {
        S.lines(c, seam, 0.4, [12, -7.6, 12, 7.6, -2, -8, -2, 8]);
        for (let i = 0; i < 3; i++) S.rrect(c, -11 + i * 0.01, -2, 0.1, 0.1, 0.05);
        c.fillStyle = '#2a3038'; c.beginPath(); S.rrect(c, -10, -4.5, 7, 9, 1.4); c.fill();
        for (let i = 0; i < 4; i++) S.lines(c, '#14181d', 0.5, [-9 + i * 1.7, -3.6, -9 + i * 1.7, 3.6]);
      } });
    // cockpit block + glass
    parts.push({ z0: HZ + 10, z1: HZ + 13, side: '#262c34', top: '#353d47', shape: (c) => S.poly(c, S.sym([41, 0, 38.5, 5.4, 30, 7.4, 30, 0])) });
    parts.push({ z0: HZ + 13, z1: HZ + 14, side: '#123040', top: '#123040', flat: true, shape: (c) => S.poly(c, S.sym([40, 0, 37.8, 4.6, 31, 6.4, 31, 0])),
      detail: (c) => {
        const g = c.createLinearGradient(31, -6, 40, 6); g.addColorStop(0, '#7fe6ff'); g.addColorStop(0.45, '#1d5468'); g.addColorStop(1, '#0c1c26');
        c.fillStyle = g; c.beginPath(); S.poly(c, S.sym([40, 0, 37.8, 4.6, 31, 6.4, 31, 0])); c.fill();
        S.lines(c, 'rgba(10,14,18,0.7)', 0.45, [35, -5.6, 35, 5.6, 31, 0, 40, 0]);
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); S.ell(c, 37, -2.6, 2, 0.5, 0.5); c.fill();
      } });
    // antenna mast + dish + beacon
    parts.push({ z0: HZ + 14, z1: HZ + 21, side: '#8b939c', top: '#d6dde3', shape: (c) => S.circ(c, -6, 5, 0.5) });
    parts.push({ z0: HZ + 14, z1: HZ + 16, side: '#4b5560', top: '#9fb0bf', shape: (c) => S.ell(c, 6, -4, 2.6, 2.2) });
    // nav lights: port red, starboard green, tail white, cyan hull lights
    parts.push({ z0: HZ + 9, z1: HZ + 10, side: '#3a0a0a', top: '#ff4a4a', flat: true, bevel: false, shape: (c) => { S.circ(c, -28, -33, 1.1); S.circ(c, 0, -31.5, 0.9); } });
    parts.push({ z0: HZ + 9, z1: HZ + 10, side: '#0a3a14', top: '#5aff7a', flat: true, bevel: false, shape: (c) => { S.circ(c, -28, 33, 1.1); S.circ(c, 0, 31.5, 0.9); } });
    parts.push({ z0: HZ + 21, z1: HZ + 22, side: '#888', top: '#ffffff', flat: true, bevel: false, shape: (c) => S.circ(c, -6, 5, 1) });
    parts.push({ z0: HZ + 10, z1: HZ + 10.5, side: glow, top: glow, flat: true, bevel: false, shape: (c) => { S.circ(c, 42.5, 2.6, 0.7); S.circ(c, 42.5, -2.6, 0.7); S.circ(c, -39, 15, 0.7); S.circ(c, -39, -15, 0.7); } });
    return {
      r: 64, h: HZ + 23, parts, style: 'unit', bevel: 0.8,
      lights: [{ x: -28, y: -33, z: HZ + 10, col: '#ff4a4a' }, { x: -28, y: 33, z: HZ + 10, col: '#5aff7a' }, { x: -6, y: 5, z: HZ + 22, col: '#ffffff', strobe: true }],
      exhaust: pods.map((q) => [q[0] - 9.5, q[1], HZ + 5]), rampPt: [-58, 0],
    };
  };
})(window.AS);
