/* WYRMCROWN — Hrimgard (ice faction) architecture.
 * Blue-grey battered stone, thick-walled nordic longhouses under heavy snow roofs
 * (lit back plane / blue-shaded front plane), carved timber gables with crossed
 * dragon-head bargeboards, translucent ice-crystal spires and frost-blue braziers.
 * Buildings are 1-direction sheets: +y walls face the camera, so doors, windows and
 * banners sit on the +y faces. Walls / gates are 16-dir sheets modelled along x,
 * siege engines are 24-dir sheets aiming +x. Palette keys: a b t g d k k2 w s. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models = AS.Models || {};

  /* ------------------------------------------------------------ palette */
  const DEF = { a: '#71849a', b: '#dbe6f2', t: '#eef5fb', g: '#8ad8ff', d: '#253650', k: '#3567b4', k2: '#e2f1ff', w: '#5a4a3e', s: '#a9dcf3' };
  function P(p) { const o = Object.assign({}, DEF); if (p && typeof p === 'object') for (const q in p) if (p[q]) o[q] = p[q]; return o; }
  const hx = (c) => '#' + C.hex(c).map((v) => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => hx(C.mix(a, b, t));
  const sh = (c, f) => hx(C.shade(c, f));
  const rgba = (c, a) => C.str(c, a);
  function K(pal) {
    const p = P(pal);
    return {
      p,
      st: mix(p.a, p.d, 0.2), stT: mix(p.a, p.b, 0.32), stD: mix(p.a, p.d, 0.5), stL: mix(p.a, p.b, 0.5),
      pl: mix(p.d, p.a, 0.3), plT: mix(mix(p.a, p.b, 0.22), p.d, 0.08),
      sn: p.t, snS: mix(p.t, p.a, 0.3), snD: mix(p.t, p.d, 0.45), snL: mix(p.t, '#ffffff', 0.5),
      wd: p.w, wdD: sh(p.w, -0.4), wdL: mix(p.w, p.b, 0.3),
      ice: p.s, iceD: mix(p.s, p.d, 0.42), iceL: mix(p.s, '#ffffff', 0.55),
      gl: p.g, glH: mix(p.g, '#ffffff', 0.65), glD: mix(p.g, p.d, 0.45),
      win: mix(p.d, '#000000', 0.3), iron: mix(p.d, '#15161a', 0.55), ironT: mix(p.a, p.d, 0.45),
      k: p.k, kD: sh(p.k, -0.3), k2: p.k2,
    };
  }

  /* ------------------------------------------------------------ geometry helpers */
  const ngon = (x, y, r, n, rot) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push(x + Math.cos(t) * r, y + Math.sin(t) * r); } return a; };
  const tf = (pts, ox, oy, a) => { const ca = Math.cos(a || 0), sa = Math.sin(a || 0), out = []; for (let i = 0; i < pts.length; i += 2) out.push(ox + pts[i] * ca - pts[i + 1] * sa, oy + pts[i] * sa + pts[i + 1] * ca); return out; };
  // thin vertical sliver just proud of a +y (camera-facing) wall at y
  const fsl = (c, x0, x1, y, inn, out) => { inn = inn === undefined ? 0.6 : inn; out = out === undefined ? 0.32 : out; c.moveTo(x0, y - inn); c.lineTo(x1, y - inn); c.lineTo(x1, y + out); c.lineTo(x0, y + out); c.closePath(); };
  // sliver on the face of a cylinder between angles a0..a1 (front = PI/2)
  function arcSeg(c, x, y, r, w, a0, a1) { c.moveTo(x + Math.cos(a0) * (r + w * 0.35), y + Math.sin(a0) * (r + w * 0.35)); c.arc(x, y, r + w * 0.35, a0, a1); c.arc(x, y, r - w * 0.65, a1, a0, true); c.closePath(); }
  // faint ground halo (alpha below the forge's solid cut → no outline)
  function halo(c, col, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, C.str(col, a || 0.3)); g.addColorStop(1, C.str(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function snowPatch(c, x, y, r, seed, col) { c.save(); c.fillStyle = col; c.beginPath(); S.blob(c, x, y, r, seed, 9, 0.45); c.fill(); c.restore(); }
  // screen-down component of an object-space normal for the frame being rendered (> 0: faces the camera)
  const facing = (c, nx, ny) => { const t = c.getTransform(); const n = Math.hypot(t.a, t.b) || 1; return (t.b / n) * nx + (t.a / n) * ny; };
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  /* depth sorter for rotating sheets (put first): re-orders the remaining parts back to
   * front by the screen depth of each part's anchor `at: [x, y]` (then authored order) */
  function sorter(parts) {
    return { z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: (c) => {
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
      const rest = parts.slice(1).map((p, i) => ({ p, i: p.ord !== undefined ? p.ord : i, d: p.at ? p.at[0] * sa + p.at[1] * ca : 0 }));
      rest.forEach((r) => { if (r.p.ord === undefined) r.p.ord = r.i; });
      rest.sort((A, B) => (A.d - B.d) || (A.i - B.i));
      for (let i = 0; i < rest.length; i++) parts[i + 1] = rest[i].p;
    } };
  }
  const withSorter = (parts) => { const all = [null].concat(parts); all[0] = sorter(all); return all; };

  /* Facade decoration: one part that adds geometry only at the heights each item
   * covers. Items are [za, zb, fn(c, z)]. Lets one part paint many windows, mortar
   * lines, doors, shields or banners on the camera-facing walls. */
  function deco(col, items, ex) {
    let z0 = Infinity, z1 = -Infinity;
    for (const it of items) { z0 = Math.min(z0, it[0]); z1 = Math.max(z1, it[1]); }
    if (!items.length) { z0 = 0; z1 = 0; }
    return Object.assign({ z0, z1, side: col, top: col, ao: 0, flat: true, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0);
      for (let i = 0; i < items.length; i++) { const it = items[i]; if (z >= it[0] - 1e-6 && z <= it[1] + 1e-6) it[2](c, z); }
    } }, ex || {});
  }
  const It = {
    rect: (x, y, w, za, zb, inn, out) => [za, zb, (c) => fsl(c, x - w / 2, x + w / 2, y, inn, out)],
    arch: (x, y, w, za, zb, inn, out) => [za, zb, (c, z) => { const r = w / 2, zc = zb - r; const h = z > zc ? Math.sqrt(Math.max(0, r * r - (z - zc) * (z - zc))) : r; if (h > 0.15) fsl(c, x - h, x + h, y, inn, out); }],
    // pointed nordic arch
    peak: (x, y, w, za, zb, inn, out) => [za, zb, (c, z) => { const r = w / 2, zc = zb - w * 0.75; const h = z > zc ? r * (1 - (z - zc) / (zb - zc)) : r; if (h > 0.15) fsl(c, x - h, x + h, y, inn, out); }],
    disc: (x, y, r, zc, half, out) => [zc - r, zc + r, (c, z) => { const h = Math.sqrt(Math.max(0, r * r - (z - zc) * (z - zc))); if (h < 0.12) return; if (half < 0) fsl(c, x - h, x, y, 0.3, out || 0.55); else if (half > 0) fsl(c, x, x + h, y, 0.3, out || 0.55); else fsl(c, x - h, x + h, y, 0.3, out || 0.55); }],
    hl: (xa, xb, y, z, t, inn, out) => [z, z + (t || 0.5), (c) => fsl(c, xa, xb, y, inn, out)],
    vl: (x, y, za, zb, w, inn, out) => [za, zb, (c) => fsl(c, x - (w || 0.5) / 2, x + (w || 0.5) / 2, y, inn, out)],
    arc: (cx, cy, r, a0, a1, za, zb, w) => [za, zb, (c) => arcSeg(c, cx, cy, r, w || 1, a0, a1)],
    fn: (za, zb, f) => [za, zb, f],
    // hanging banner with a swallowtail
    banner: (x, y, w, za, zb, notch) => [za, zb, (c, z) => { const n = notch === undefined ? w * 0.6 : notch; const h = w / 2; if (z < za + n) { const g = h * (1 - (z - za) / n); fsl(c, x - h, x - g, y, 0.3, 0.5); fsl(c, x + g, x + h, y, 0.3, 0.5); } else fsl(c, x - h, x + h, y, 0.3, 0.5); }],
  };
  // ashlar coursing (mortar lines + staggered joints) on a flat +y face
  function masonry(xa, xb, y, za, zb, ch, jw, seed) {
    const its = []; ch = ch || 3; jw = jw || 5; seed = seed || 1;
    let i = 0;
    for (let z = za; z < zb - 0.7; z += ch, i++) {
      if (z > za) its.push(It.hl(xa, xb, y, z, 0.45));
      const off = (U.hash2(i, seed, 3) * 0.6 + (i % 2) * 0.5) * jw;
      for (let x = xa + off; x < xb - 0.8; x += jw * (0.8 + U.hash2(i, Math.round(x * 3), seed) * 0.5)) if (x > xa + 0.8) its.push(It.vl(x, y, z + 0.45, Math.min(zb, z + ch), 0.42));
    }
    return its;
  }
  // coursing on the front half of a round tower
  function masonryR(cx, cy, r, za, zb, ch, n, seed) {
    const its = []; ch = ch || 3; n = n || 5; seed = seed || 1;
    let i = 0;
    for (let z = za; z < zb - 0.7; z += ch, i++) {
      if (z > za) its.push(It.arc(cx, cy, r, 0.05, Math.PI - 0.05, z, z + 0.45, 0.9));
      const off = (i % 2) * 0.5 + U.hash2(i, seed, 9) * 0.3;
      for (let q = 0; q < n; q++) { const a = 0.25 + (q + off) / n * (Math.PI - 0.5); its.push(It.arc(cx, cy, r, a, a + 0.05, z + 0.45, Math.min(zb, z + ch), 0.9)); }
    }
    return its;
  }

  /* Facade accumulator: collects deco items per material and flushes them as one part
   * per material in a fixed layering order (mortar → trims → wood → windows → glow →
   * banners → iron). */
  const FAC_ORDER = ['mas', 'quoin', 'frame', 'wood', 'woodD', 'win', 'gl', 'k', 'k2', 'iron', 'ice'];
  function Fac(k) {
    const L = {};
    const col = { mas: k.stD, quoin: k.stL, frame: k.stL, wood: k.wd, woodD: k.wdD, win: k.win, gl: k.gl, k: k.k, k2: k.k2, iron: k.iron, ice: k.iceL };
    const ex = { quoin: { flat: false }, frame: { flat: false }, wood: { flat: false, ao: 0.15 }, woodD: { flat: false, ao: 0.2 }, k: { flat: false, ao: 0.2 }, k2: { flat: false }, gl: { ao: -0.25 } };
    const F = {
      add(key, it) { (L[key] = L[key] || []).push(it); return F; },
      addAll(key, its) { for (const it of its) F.add(key, it); return F; },
      mas(its) { return F.addAll('mas', its); },
      // lit window: dark recess + inset frost glow
      win(x, y, w, za, zb, kind) { const f = It[kind || 'rect']; F.add('win', f(x, y, w, za, zb, 0.6, 0.3)); F.add('gl', f(x, y + 0.04, Math.max(0.6, w - 0.9), za + 0.45, zb - 0.3, 0.6, 0.36)); return F; },
      // arrow slit
      slit(x, y, za, zb) { return F.add('win', It.rect(x, y, 0.8, za, zb, 0.6, 0.3)); },
      // door: dressed-stone surround + plank leaf (+ iron straps)
      door(x, y, w, za, zb, kind, straps) { const f = It[kind || 'arch']; F.add('frame', f(x, y, w + 1.4, za, zb + 0.7, 0.6, 0.32)); F.add('woodD', f(x, y + 0.04, w, za, zb, 0.6, 0.4)); if (straps === false) return F; F.add('iron', It.hl(x - w / 2 + 0.3, x + w / 2 - 0.3, y + 0.08, za + (zb - za) * 0.3, 0.45, 0.6, 0.45)); F.add('iron', It.hl(x - w / 2 + 0.3, x + w / 2 - 0.3, y + 0.08, za + (zb - za) * 0.62, 0.45, 0.6, 0.45)); return F; },
      // round shields: k field, k2 half, iron boss
      shields(xs, y, zc, r) { r = r || 1.5; xs.forEach((x, i) => { F.add('k', It.disc(x, y, r, zc)); F.add('k2', It.disc(x, y + 0.04, r - 0.1, zc, i % 2 ? 1 : -1, 0.6)); F.add('iron', It.disc(x, y + 0.08, r * 0.3, zc, 0, 0.7)); }); return F; },
      // hanging banner: k swallowtail with a k2 band and stripe
      banner(x, y, w, za, zb) { F.add('k', It.banner(x, y, w, za, zb)); F.add('k2', It.rect(x, y + 0.04, w, zb - (zb - za) * 0.2, zb - (zb - za) * 0.13, 0.3, 0.56)); F.add('k2', It.rect(x, y + 0.04, w * 0.22, za + w * 0.7, zb - (zb - za) * 0.28, 0.3, 0.56)); return F; },
      quoins(x, y, za, zb, w) { w = w || 1.8; let i = 0; for (let z = za; z < zb - 0.6; z += 1.6, i++) F.add('frame', It.rect(x + (i % 2 ? w * 0.18 : -w * 0.18), y, w, z, Math.min(zb, z + 1.15), 0.6, 0.34)); return F; },
      flush(parts) { for (const key of FAC_ORDER) if (L[key] && L[key].length) { parts.push(deco(col[key], L[key], ex[key])); L[key] = []; } return F; },
    };
    return F;
  }

  /* ------------------------------------------------------------ building blocks */
  const box = (x0, y0, x1, y1, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => c.rect(x0, y0, x1 - x0, y1 - y0) }, ex || {});
  // battered (inward-leaning) box: thick Hrimgard walls
  const bbox = (x0, y0, x1, y1, z0, z1, bat, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c, zt) => { const b = bat * zt; c.rect(x0 + b, y0 + b, x1 - x0 - b * 2, y1 - y0 - b * 2); } }, ex || {});
  const cyl = (x, y, r, z0, z1, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c) => S.circ(c, x, y, r) }, ex || {});
  // battered round tower body (radius shrinks by bat toward the top)
  const tcyl = (x, y, r, z0, z1, bat, side, top, ex) => Object.assign({ z0, z1, side, top, shape: (c, zt) => S.circ(c, x, y, r - bat * zt) }, ex || {});

  /* Gabled (o.hip > 0: hipped) roof with its ridge along x. The back plane faces the
   * light, the front plane faces the camera: two parts with their own tones meet at
   * the ridge. Adds a dark eave fascia, a scalloped snow lip, icicles, a ridge beam
   * and dragon-head finials (each can be switched off). */
  function roofX(parts, k, o) {
    const x0 = o.x0, x1 = o.x1, yc = o.yc || 0, d = o.d, z0 = o.z0, z1 = o.z1, hip = o.hip || 0, seed = o.seed || 3;
    const lit = o.lit || k.snL, shd = o.shade || k.snS;
    const hw = (zt) => d * (1 - zt) + 0.05;
    const ax = (zt) => x0 + hip * zt, bx = (zt) => x1 - hip * zt;
    parts.push({ z0, z1, side: lit, top: lit, ao: 0.04, bevel: false, shape: (c, zt) => c.rect(ax(zt), yc - hw(zt), bx(zt) - ax(zt), hw(zt)) });
    parts.push({ z0, z1, side: shd, top: lit, ao: o.ao === undefined ? 0.16 : o.ao, bevel: false, shape: (c, zt) => c.rect(ax(zt), yc, bx(zt) - ax(zt), hw(zt)) });
    // wavy drift lines across the front plane: blue shadow band under a lit crest
    const rows = o.rows === undefined ? 2 : o.rows;
    if (rows) {
      const zs = []; for (let i = 1; i <= rows; i++) zs.push(z0 + (z1 - z0) * (i / (rows + 1)) * 0.92);
      const drift = (dz, w) => (c, zt) => {
        const z = z0 + zt * (z1 - z0);
        zs.forEach((q, j) => { if (Math.abs(z - q - dz) < 0.26) { const t = (z - z0) / (z1 - z0), xa = ax(t) + 1.2, xb = bx(t) - 1.2, y = yc + hw(t); c.moveTo(xa, y - 0.2); for (let x = xa; x <= xb; x += 1) c.lineTo(x, y + w + Math.sin(x * 0.55 + j * 2 + seed) * 0.6); c.lineTo(xb, y - 0.7); c.lineTo(xa, y - 0.7); c.closePath(); } });
      };
      parts.push({ z0, z1, side: mix(shd, k.p.a, 0.2), top: shd, flat: true, ao: 0, bevel: false, shape: drift(0, 0.9) });
      parts.push({ z0, z1, side: k.snL, top: k.snL, flat: true, ao: 0, bevel: false, shape: drift(0.5, 0.15) });
    }
    // one timber part: verge boards (gabled ends), eave fascia, ridge beam, dragon-head finials
    const verge = o.verge === undefined ? !hip : o.verge, fas = o.fascia !== false, rid = o.ridge !== false, hor = o.horns !== false, HH = o.hornH || 4.5;
    const tz0 = fas ? z0 - 1.5 : z0, tz1 = hor ? z1 + HH : z1 + 0.7;
    parts.push({ z0: tz0, z1: tz1, side: k.wdD, top: k.wd, ao: 0.08, bevel: false, shape: (c, zt) => {
      const z = tz0 + zt * (tz1 - tz0);
      if (fas && z <= z0 + 1e-6) c.rect(x0 + 0.3, yc + d - 1.1, x1 - x0 - 0.6, 1.05);
      if (verge && z >= z0 && z <= z1 + 0.3) { const t = Math.min(1, (z - z0) / (z1 - z0)), h = hw(t) + 0.35; c.rect(ax(t) - 0.5, yc - h, 1.1, h * 2); c.rect(bx(t) - 0.6, yc - h, 1.1, h * 2); }
      if (rid && z >= z1 - 0.8 && z <= z1 + 0.7) c.rect(ax(1) - 0.5, yc - 0.7, bx(1) - ax(1) + 1, 1.4);
      if (hor && z >= z1 - 0.4) { const ht = (z - z1 + 0.4) / (HH + 0.4); for (const sg of [-1, 1]) { const x = (sg < 0 ? ax(1) : bx(1)) + sg * ht * ht * 2.4; if (ht > 0.82) { const L = (ht - 0.7) * 6; c.rect(Math.min(x, x + sg * L), yc - 0.52, Math.abs(L), 1.04); } else S.circ(c, x, yc, 0.52); } }
    } });
    // one snow part: scalloped eave lip + icicles hanging below it
    const lip = o.lip !== false, icy = o.icicles !== false;
    const bl = []; for (let x = x0 + 0.6; x <= x1 - 0.4; x += 2.1) bl.push([x + (U.hash2(Math.round(x), seed, 4) - 0.5) * 0.6, 1.05 + U.hash2(Math.round(x), seed, 6) * 0.55]);
    const xs = []; for (let x = x0 + 1.2; x <= x1 - 1.2; x += 2.2 * (0.7 + U.hash2(Math.round(x * 5), seed, 1) * 0.6)) xs.push(x);
    const IL = xs.map((x, i) => 1 + U.hash2(i, seed, 5) * 2.4);
    if (lip || icy) {
      const lz0 = icy ? z0 - 4.1 : z0 - 0.8, lz1 = lip ? z0 + 0.9 : z0 - 0.7;
      parts.push({ z0: lz0, z1: lz1, side: mix(k.sn, k.p.a, 0.12), top: lit, ao: 0.1, bevel: false, shape: (c, zt) => {
        const z = lz0 + zt * (lz1 - lz0);
        if (lip && z >= z0 - 0.8) { const lt = (z - z0 + 0.8) / 1.7; c.rect(x0, yc + d - 1.4, x1 - x0, 1.4); for (const q of bl) S.circ(c, q[0], yc + d - 0.3, q[1] * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - lt)))); }
        if (icy && z <= z0 - 0.7) { const dep = z0 - 0.7 - z; for (let i = 0; i < xs.length; i++) if (dep < IL[i]) S.circ(c, xs[i], yc + d + 0.35, 0.06 + 0.4 * (1 - dep / IL[i])); }
      } });
    }
  }
  // carved dragon-head finials rising from both ends of an x ridge
  function hornsX(k, xa, xb, yc, z, H) {
    return { z0: z - 0.4, z1: z + H, side: k.wdD, top: k.wd, stroke: 1.05, bevel: false, ao: 0.1, shape: (c, zt) => {
      for (const sg of [-1, 1]) {
        const xe = sg < 0 ? xa : xb, x = xe + sg * (zt * zt * 2.4);
        if (zt > 0.82) S.seg(c, x, yc, x + sg * (zt - 0.7) * 6, yc); else S.seg(c, x, yc, x + sg * 0.01, yc);
      }
    } };
  }
  function icicles(k, xa, xb, y, z, seed, step) {
    const xs = []; step = step || 2.2;
    for (let x = xa; x <= xb; x += step * (0.7 + U.hash2(Math.round(x * 5), seed, 1) * 0.6)) xs.push(x);
    const L = xs.map((x, i) => 1 + U.hash2(i, seed, 5) * 2.4);
    return { z0: z - 3.4, z1: z, side: k.iceL, top: k.iceL, flat: true, ao: 0.3, bevel: false, shape: (c, zt) => {
      const dep = (1 - zt) * 3.4;
      for (let i = 0; i < xs.length; i++) if (dep < L[i]) S.circ(c, xs[i], y, 0.06 + 0.4 * (1 - dep / L[i]));
    } };
  }

  /* Gable-front roof (ridge along y): the carved gable faces the camera. Left plane
   * lit, right plane shaded, course lines, a timber gable wall with a round frost window,
   * and bargeboards crossing above the apex into dragon-head horns.
   * o.cut(z) → min y (for a valley into a roof behind). */
  function roofY(parts, k, o) {
    const xc = o.xc || 0, y0 = o.y0, y1 = o.y1, hw = o.hw, z0 = o.z0, z1 = o.z1;
    const lit = o.lit || k.snL, shd = o.shade || k.snS;
    const cut = o.cut || (() => y0);
    const wz = (z) => hw * (1 - (z - z0) / (z1 - z0));
    parts.push({ z0, z1, side: lit, top: lit, ao: 0.08, bevel: false, shape: (c, zt) => { const z = z0 + zt * (z1 - z0), w = wz(z) + 0.05, ya = Math.max(y0, cut(z)); if (ya < y1) c.rect(xc - w, ya, w, y1 - ya); } });
    parts.push({ z0, z1, side: shd, top: lit, ao: 0.18, bevel: false, shape: (c, zt) => { const z = z0 + zt * (z1 - z0), w = wz(z) + 0.05, ya = Math.max(y0, cut(z)); if (ya < y1) c.rect(xc, ya, w, y1 - ya); } });
    const rows = o.rows === undefined ? 2 : o.rows;
    if (rows) {
      const zs = []; for (let i = 1; i <= rows; i++) zs.push(z0 + (z1 - z0) * i / (rows + 1));
      parts.push({ z0, z1, side: mix(shd, k.p.a, 0.2), top: shd, flat: true, ao: 0, bevel: false, shape: (c, zt) => {
        const z = z0 + zt * (z1 - z0);
        for (const q of zs) if (Math.abs(z - q) < 0.26) { const w = wz(z), ya = Math.max(y0, cut(z)) + 0.4; c.rect(xc - w, ya, 0.7, y1 - ya - 0.4); c.rect(xc + w - 0.7, ya, 0.7, y1 - ya - 0.4); }
      } });
    }
    const bt = o.bt || 1.5;
    const zg = z1 - bt * (z1 - z0) / hw, zh = z1 + (o.horn === undefined ? 4 : o.horn);
    const gc = o.gable || k.wd, gab = o.gable !== false;
    if (gab) parts.push({ z0: z0 + 0.01, z1: zg, side: gc, top: gc, ao: 0.25, bevel: false, shape: (c, zt) => { const z = z0 + zt * (zg - z0), w = wz(z) - bt + 0.3; if (w > 0.1) c.rect(xc - w, y1 - 1.3, w * 2, 1.1); } });
    // one dark-timber part: plank seams + window ring on the gable, then the bargeboards
    // crossing above the apex into dragon-head horns
    const gr = Math.min(1.8, hw * 0.15), gz = z0 + (zg - z0) * 0.36, gw = gab && o.gwin !== false;
    parts.push({ z0, z1: zh, side: o.board || k.wdD, top: o.board || k.wd, ao: 0.05, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (zh - z0);
      if (gab && z < zg) {
        for (let x = -hw + bt + 1.6; x < hw - bt - 1; x += 1.7) if (Math.abs(x) < wz(z) - bt - 0.2) fsl(c, xc + x - 0.18, xc + x + 0.18, y1 - 0.2, 0.3, 0.12);
        if (gw && Math.abs(z - gz) < gr + 0.5) { const h = Math.sqrt(Math.max(0, (gr + 0.5) ** 2 - (z - gz) ** 2)); fsl(c, xc - h, xc + h, y1 - 0.1, 0.3, 0.3); }
      }
      let w = wz(z);
      if (z > z1) w *= 1 + 0.9 * Math.pow((z - z1) / (zh - z1), 1.5);
      for (const sg of [-1, 1]) { const xa = xc + sg * w; c.rect(xa - 0.85, y1 - 0.6, 1.7, 1.2); }
    } });
    if (gw) parts.push(deco(k.gl, [It.disc(xc, y1 + 0.05, gr, gz, 0, 0.3)], { ao: -0.3 }));
  }

  // crenellated parapet merlons along a rectangle (front + optional back / sides)
  function merlons(x0, y0, x1, y1, z0, z1, side, top, o) {
    o = o || {}; const m = o.m || 2.2, g = o.g || 1.6, t = o.t || 1.6;
    return { z0, z1, side, top, ao: 0.15, shape: (c) => {
      const run = (xa, ya, xb, yb) => { const L = Math.hypot(xb - xa, yb - ya), n = Math.max(1, Math.round((L + g) / (m + g))), st = L / n, ux = (xb - xa) / L, uy = (yb - ya) / L;
        for (let i = 0; i < n; i++) { const s0 = i * st + g / 2, s1 = s0 + st - g; const px = -uy * t / 2, py = ux * t / 2; const ax = xa + ux * s0, ay = ya + uy * s0, bx = xa + ux * s1, by = ya + uy * s1; S.poly(c, [ax - px, ay - py, bx - px, by - py, bx + px, by + py, ax + px, ay + py]); } };
      if (o.runs) { for (const r of o.runs) run(r[0], r[1], r[2], r[3]); return; }
      if (o.back !== false) run(x0, y0 + t / 2, x1, y0 + t / 2);
      if (o.front !== false) run(x0, y1 - t / 2, x1, y1 - t / 2);
      if (o.sides !== false) { run(x0 + t / 2, y0 + t, x0 + t / 2, y1 - t); run(x1 - t / 2, y0 + t, x1 - t / 2, y1 - t); }
    } };
  }
  function merlonsR(x, y, r, n, z0, z1, side, top, t) {
    t = t || 1.6;
    return { z0, z1, side, top, ao: 0.15, shape: (c) => { for (let i = 0; i < n; i++) { const a0 = (i + 0.2) / n * TAU, a1 = (i + 0.8) / n * TAU; c.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.arc(x, y, r, a0, a1); c.arc(x, y, r - t, a1, a0, true); c.closePath(); } } };
  }

  /* Ice crystals: faceted shards as a lit (left) and a shaded (right) half, flat and
   * translucent. list: [x, y, r, h, lx, ly, z0] (lean lx, ly over the height). */
  function crystals(parts, k, list, o) {
    o = o || {};
    let zmin = Infinity, zmax = -Infinity;
    for (const q of list) { zmin = Math.min(zmin, q[6] || 0); zmax = Math.max(zmax, (q[6] || 0) + q[3]); }
    const half = (sg) => (c, zt) => {
      const zz = zmin + zt * (zmax - zmin);
      for (const q of list) {
        const t = (zz - (q[6] || 0)) / q[3]; if (t < -1e-6 || t > 1) continue;
        const r = q[2] * (t < 0.68 ? 1 - t * 0.22 : 0.85 * (1 - (t - 0.68) / 0.32)) + 0.05;
        const cx = q[0] + (q[4] || 0) * t, cy = q[1] + (q[5] || 0) * t;
        S.poly(c, [cx, cy - r * 0.9, cx + sg * r * 0.86, cy - r * 0.45, cx + sg * r * 0.86, cy + r * 0.45, cx, cy + r * 0.9]);
      }
    };
    const lt = o.lit || mix(k.ice, '#ffffff', 0.4), dk = o.dark || mix(k.ice, k.p.d, 0.18);
    parts.push({ z0: zmin, z1: zmax, side: lt, top: k.iceL, flat: true, ao: -0.2, bevel: false, shape: half(-1), at: o.at });
    parts.push({ z0: zmin, z1: zmax, side: dk, top: lt, flat: true, ao: -0.3, bevel: false, shape: half(1), at: o.at });
  }

  /* frost brazier: stone pedestal, iron bowl, pale-blue flame (anim flicker) */
  function braziers(parts, k, pts, z, s) {
    s = s || 1;
    parts.push({ z0: z, z1: z + 2.6 * s, side: k.st, top: k.stT, shape: (c, zt) => { for (const q of pts) S.rrect(c, q[0] - 1.3 * s + zt * 0.3 * s, q[1] - 1.3 * s + zt * 0.3 * s, 2.6 * s - zt * 0.6 * s, 2.6 * s - zt * 0.6 * s, 0.5); } });
    parts.push({ z0: z + 2.6 * s, z1: z + 3.8 * s, side: k.iron, top: k.ironT, shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], (1.3 + zt * 0.7) * s); } });
    parts.push({ z0: z + 3.6 * s, z1: z + 8.4 * s, side: k.gl, top: k.glH, flat: true, ao: -0.5, bevel: false, shape: (c, zt, an) => {
      pts.forEach((q, i) => { const ph = an * TAU + i * 1.7; const r = 1.5 * s * Math.pow(1 - zt, 0.75) * (1 + 0.16 * Math.sin(ph * 2 + zt * 6)) + 0.1; S.circ(c, q[0] + Math.sin(ph + zt * 3) * zt * 0.8 * s, q[1], r); });
    }, detail: (c) => { for (const q of pts) S.dot(c, '#ffffff', q[0], q[1], 0.25 * s); } });
  }

  /* irregular stone yard / rock plinth with snow drifting onto its rim */
  function plinth(parts, k, x, y, r, sy, seed, z1, ex) {
    if (ex && ex.detail) { const d = ex.detail; ex = Object.assign({}, ex, { detail: (c, an) => { c.save(); c.clip(); d(c, an); c.restore(); } }); }
    parts.push(Object.assign({ z0: 0, z1: z1 || 2.4, side: k.pl, top: k.plT, ao: 0.3, shape: (c, zt) => { c.save(); c.translate(x, y); c.scale(1, sy); S.blob(c, 0, 0, r - zt * 1.2, seed, 18, 0.12); c.restore(); },
      detail: (c) => {
        c.save(); c.clip(); c.strokeStyle = rgba(k.p.d, 0.3); c.lineWidth = 0.4; c.beginPath();
        for (let i = 0; i < 12; i++) { const a = U.hash2(i, seed, 7) * TAU, r0 = r * 0.25 + U.hash2(i, seed, 8) * r * 0.55; c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * sy); c.lineTo(x + Math.cos(a + 0.22) * (r0 + 3), y + Math.sin(a + 0.22) * (r0 + 3) * sy); }
        c.stroke();
        for (let i = 0; i < 7; i++) { const a = Math.PI * (1.05 + U.hash2(i, seed, 1) * 0.9), rr = r * (0.84 + U.hash2(i, seed, 2) * 0.1); snowPatch(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr * sy, 1.2 + U.hash2(i, seed, 3) * 1.8, seed + i, rgba(k.sn, 0.6)); }
        c.restore();
      } }, ex || {}));
  }

  /* ------------------------------------------------------------ multi-instance parts
   * One part drawing several same-material objects with their own height ranges:
   * list items q, zr(q) → [za, zb], fn(c, q, lt, anim, z) with lt the local 0..1. */
  function multi(list, zr, fn, ex) {
    const rs = list.map(zr); let z0 = Infinity, z1 = -Infinity;
    rs.forEach((r) => { z0 = Math.min(z0, r[0]); z1 = Math.max(z1, r[1]); });
    return Object.assign({ z0, z1, shape: (c, zt, an) => {
      const z = z0 + zt * (z1 - z0);
      for (let i = 0; i < list.length; i++) { const r = rs[i]; if (z >= r[0] - 1e-6 && z <= r[1] + 1e-6) fn(c, list[i], (z - r[0]) / Math.max(1e-6, r[1] - r[0]), an, z); }
    } }, ex || {});
  }
  /* several poles with fluttering pennants: [x, y, z0, z1, L, dir] */
  function flags(parts, k, list) {
    const fh = (q) => Math.min(5, (q[3] - q[2]) * 0.45);
    const wave = (c, q, zt, an) => { const x = q[0], y = q[1], L = q[4] || 7, dir = q[5] || 1, n = 7; c.moveTo(x, y); for (let i = 1; i <= n; i++) { const u = i / n, tail = zt < 0.35 ? 1 - (0.35 - zt) * 1.2 * u : 1; c.lineTo(x + dir * L * u * tail, y + Math.sin(u * 3.2 - an * TAU + x) * 0.9 * u); } };
    parts.push(multi(list, (q) => [q[2], q[3] + 1.6], (c, q, lt, an, z) => { if (z > q[3] + 0.6) S.circ(c, q[0], q[1], 0.32); else S.seg(c, q[0], q[1], q[0] + 0.01, q[1]); }, { side: k.wdD, top: k.wd, stroke: 0.7, bevel: false }));
    parts.push(multi(list, (q) => [q[3] - fh(q), q[3]], (c, q, lt, an) => wave(c, q, lt, an), { side: k.k, top: sh(k.k, 0.2), stroke: 0.55, flat: true, ao: 0.25, bevel: false }));
    parts.push(multi(list, (q) => [q[3] - fh(q) * 0.62, q[3] - fh(q) * 0.42], (c, q, lt, an) => wave(c, q, 0.6, an), { side: k.k2, top: k.k2, stroke: 0.6, flat: true, ao: 0, bevel: false }));
  }
  /* several battered round towers: [x, y, r, z0, z1] */
  const towersR = (list, k, bat, ex) => multi(list, (q) => [q[3], q[4]], (c, q, lt) => S.circ(c, q[0], q[1], q[2] - (bat === undefined ? 0.6 : bat) * lt), Object.assign({ side: k.st, top: k.stT }, ex || {}));
  /* several conical snow roofs: [x, y, r, z0, z1] (cone, front rings, lip, icicles, finial) */
  function coneRoofs(parts, k, list, o) {
    o = o || {};
    const pw = o.pw || 1.45, rr = (q, lt) => Math.max(0.12, q[2] * Math.pow(1 - lt, pw));
    const icy = o.icicles !== false;
    parts.push(multi(list, (q) => [q[3] - (icy ? 3.2 : 0.7), q[3] + 0.6], (c, q, lt, an, z) => {
      if (z >= q[3] - 0.7) { c.moveTo(q[0] + q[2] + 0.5, q[1]); c.arc(q[0], q[1], q[2] + 0.5, 0, TAU); return; }
      const dep = q[3] - 0.4 - z, n = Math.max(4, Math.round(q[2] * 0.8));
      for (let i = 0; i < n; i++) { const L = 1 + U.hash2(i, Math.round(q[2] * 7 + q[0]), 5) * 2.2; if (dep > 0 && dep < L) { const a = 0.3 + (i + 0.5) / n * (Math.PI - 0.6); S.circ(c, q[0] + Math.cos(a) * (q[2] + 0.4), q[1] + Math.sin(a) * (q[2] + 0.4), 0.06 + 0.38 * (1 - dep / L)); } }
    }, { side: mix(k.sn, k.p.a, 0.12), top: k.snL, ao: 0.2, bevel: false }));
    parts.push(multi(list, (q) => [q[3], q[4]], (c, q, lt) => S.circ(c, q[0], q[1], rr(q, lt)), { side: o.side || mix(k.sn, k.p.a, 0.18), top: k.snL, ao: 0.14, bevel: false }));
    parts.push(multi(list, (q) => [q[3] + 0.2, q[4] - 0.6], (c, q, lt, an, z) => { const r = rr(q, (z - q[3]) / (q[4] - q[3])) - 0.12; for (const a of [0.3, 0.5, 0.7, 0.9]) S.circ(c, q[0] + Math.cos(a * Math.PI) * r, q[1] + Math.sin(a * Math.PI) * r, 0.26); }, { side: mix(k.sn, k.p.a, 0.42), top: k.snS, flat: true, ao: 0, bevel: false }));
    if (o.finial) parts.push(multi(list, (q) => [q[4] - 1, q[4] + (o.finH || 3.5)], (c, q) => S.seg(c, q[0], q[1], q[0] + 0.01, q[1]), { side: k.iron, top: k.ironT, stroke: 0.6, bevel: false }));
  }
  /* several square merlon rings around round tower tops: [x, y, r, z0, z1, n] */
  const merlonsRs = (list, k) => multi(list, (q) => [q[3], q[4]], (c, q) => { const n = q[5] || 8; for (let i = 0; i < n; i++) { const a0 = (i + 0.2) / n * TAU, a1 = (i + 0.8) / n * TAU; c.moveTo(q[0] + Math.cos(a0) * q[2], q[1] + Math.sin(a0) * q[2]); c.arc(q[0], q[1], q[2], a0, a1); c.arc(q[0], q[1], q[2] - 1.5, a1, a0, true); c.closePath(); } }, { side: k.st, top: k.sn, ao: 0.15 });

  /* oblique timber beam from A to B (any orientation): the slice at height z is the
   * piece of the beam whose axis lies within its vertical half-thickness of z.
   * q = [xa, ya, za, xb, yb, zb, w (width), t (thickness)] */
  function beamRange(q) { const ce = Math.hypot(q[3] - q[0], q[4] - q[1]) / Math.max(1e-6, Math.hypot(q[3] - q[0], q[4] - q[1], q[5] - q[2])), tv = (q[7] || q[6]) / Math.max(0.2, ce) * 0.5; return [Math.min(q[2], q[5]) - tv, Math.max(q[2], q[5]) + tv]; }
  function beamShape(c, q, z) {
    const xa = q[0], ya = q[1], za = q[2], dx = q[3] - xa, dy = q[4] - ya, dz = q[5] - za, w = q[6], t = q[7] || w;
    const hl = Math.hypot(dx, dy), L = Math.hypot(dx, dy, dz), tv = t / Math.max(0.2, hl / Math.max(1e-6, L)) * 0.5;
    let s0, s1;
    if (Math.abs(dz) < 1e-4) { if (Math.abs(z - za) > tv + 1e-6) return; s0 = 0; s1 = 1; }
    else { s0 = (z - tv - za) / dz; s1 = (z + tv - za) / dz; if (s0 > s1) { const tt = s0; s0 = s1; s1 = tt; } s0 = Math.max(0, s0); s1 = Math.min(1, s1); if (s0 > s1) return; }
    const x0 = xa + dx * s0, y0 = ya + dy * s0, x1 = xa + dx * s1, y1 = ya + dy * s1;
    if (hl < 1e-3) { c.rect(x0 - w / 2, y0 - w / 2, w, w); return; }
    const px = -dy / hl * w / 2, py = dx / hl * w / 2, ex = dx / hl * 0.15, ey = dy / hl * 0.15;
    S.poly(c, [x0 + px - ex, y0 + py - ey, x1 + px + ex, y1 + py + ey, x1 - px + ex, y1 - py + ey, x0 - px - ex, y0 - py - ey]);
  }
  const beams = (list, side, top, ex) => multi(list, beamRange, (c, q, lt, an, z) => beamShape(c, q, z), Object.assign({ side, top, bevel: false }, ex || {}));
  /* timber fence along a polyline: posts + two rails (2 parts) */
  function fence(parts, k, lines, z0, h, step) {
    step = step || 3.2; h = h || 5;
    if (!Array.isArray(lines[0])) lines = [lines];
    const posts = [];
    for (const pts of lines) {
      for (let i = 0; i < pts.length - 2; i += 2) { const L = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]), n = Math.max(1, Math.round(L / step)); for (let j = 0; j < n; j++) posts.push([pts[i] + (pts[i + 2] - pts[i]) * j / n, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * j / n]); }
      posts.push([pts[pts.length - 2], pts[pts.length - 1]]);
    }
    parts.push({ z0, z1: z0 + h, side: k.wdD, top: k.sn, ao: 0.2, bevel: false, shape: (c) => { for (const p of posts) S.circ(c, p[0], p[1], 0.55); } });
    parts.push({ z0: z0 + h * 0.38, z1: z0 + h * 0.86, side: k.wd, top: k.wdL, stroke: 0.55, bevel: false, ao: 0, shape: (c, zt) => { if (zt > 0.18 && zt < 0.82) return; for (const pts of lines) for (let i = 0; i < pts.length - 2; i += 2) S.seg(c, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]); } });
  }
  /* snow-capped haystacks [x, y, r, h] (2 parts) */
  const HAY = '#c9a35a';
  function hay(parts, k, list, z0) {
    z0 = z0 || 0;
    parts.push(multi(list, (q) => [z0, z0 + q[3]], (c, q, lt) => S.blob(c, q[0], q[1], q[2] * Math.sqrt(Math.max(0.03, 1 - lt * lt)) + 0.2, 5 + q[0], 10, 0.12), { side: sh(HAY, -0.2), top: HAY, ao: 0.35 }));
    parts.push(multi(list, (q) => [z0 + q[3] * 0.55, z0 + q[3] + 0.4], (c, q, lt) => { const t = 0.55 + lt * 0.45; S.blob(c, q[0] - 0.3, q[1] - 0.3, q[2] * Math.sqrt(Math.max(0.03, 1 - t * t)) + 0.5, 9 + q[0], 9, 0.2); }, { side: mix(k.sn, k.p.a, 0.15), top: k.snL, ao: 0.1, bevel: false }));
  }
  /* crates [x, y, s, h, rot] and barrels [x, y, r, h] */
  const crates = (list, k, z0) => multi(list, (q) => [z0 || 0, (z0 || 0) + q[3]], (c, q) => S.poly(c, tf([-q[2] / 2, -q[2] / 2, q[2] / 2, -q[2] / 2, q[2] / 2, q[2] / 2, -q[2] / 2, q[2] / 2], q[0], q[1], q[4] || 0)),
    { side: k.wd, top: k.wdL, ao: 0.25, detail: (c) => { for (const q of list) { const p = tf([-q[2] / 2, 0, q[2] / 2, 0, 0, -q[2] / 2, 0, q[2] / 2], q[0], q[1], q[4] || 0); S.lines(c, rgba(k.wdD, 0.8), 0.4, p); } } });
  const barrels = (list, k, z0) => multi(list, (q) => [z0 || 0, (z0 || 0) + q[3]], (c, q, lt) => S.circ(c, q[0], q[1], q[2] * (1 + 0.12 * Math.sin(lt * Math.PI))),
    { side: k.wd, top: k.wdL, ao: 0.3, detail: (c) => { for (const q of list) { c.save(); c.strokeStyle = k.iron; c.lineWidth = 0.35; c.beginPath(); c.arc(q[0], q[1], q[2] * 0.85, 0, TAU); c.stroke(); c.restore(); } } });
  /* heading-aware crystal halves for rotating sheets: the lit half always faces screen-left */
  function crystalsR(parts, k, list, at) {
    let zmin = Infinity, zmax = -Infinity;
    for (const q of list) { zmin = Math.min(zmin, q[6] || 0); zmax = Math.max(zmax, (q[6] || 0) + q[3]); }
    const half = (sg) => (c, zt) => {
      const a = headingOf(c), lx = -Math.cos(a), ly = Math.sin(a), px = Math.sin(a), py = Math.cos(a);
      const zz = zmin + zt * (zmax - zmin);
      for (const q of list) {
        const t = (zz - (q[6] || 0)) / q[3]; if (t < -1e-6 || t > 1) continue;
        const r = q[2] * (t < 0.68 ? 1 - t * 0.22 : 0.85 * (1 - (t - 0.68) / 0.32)) + 0.05;
        const cx = q[0] + (q[4] || 0) * t, cy = q[1] + (q[5] || 0) * t, L = sg * r * 0.86;
        S.poly(c, [cx + px * r * 0.9, cy + py * r * 0.9, cx + lx * L + px * r * 0.45, cy + ly * L + py * r * 0.45, cx + lx * L - px * r * 0.45, cy + ly * L - py * r * 0.45, cx - px * r * 0.9, cy - py * r * 0.9]);
      }
    };
    parts.push({ z0: zmin, z1: zmax, side: mix(k.ice, '#ffffff', 0.4), top: k.iceL, flat: true, ao: -0.2, bevel: false, shape: half(1), at });
    parts.push({ z0: zmin, z1: zmax, side: mix(k.ice, k.p.d, 0.18), top: mix(k.ice, '#ffffff', 0.4), flat: true, ao: -0.3, bevel: false, shape: half(-1), at });
  }
  /* two-faced wall decoration for rotating wall/gate sheets: items drawn on the +y face
   * at yf(z) and mirrored on the -y face, each only when that face turns to the camera */
  const fsl2 = (c, x0, x1, y, sg, inn, out) => { inn = inn === undefined ? 0.6 : inn; out = out === undefined ? 0.32 : out; if (sg > 0) { c.moveTo(x0, y - inn); c.lineTo(x1, y - inn); c.lineTo(x1, y + out); c.lineTo(x0, y + out); } else { c.moveTo(x0, -y + inn); c.lineTo(x1, -y + inn); c.lineTo(x1, -y - out); c.lineTo(x0, -y - out); } c.closePath(); };
  function face2(col, items, yf, ex) {
    // items: [za, zb, (draw(x0, x1, inn, out), z)] painting on whichever faces are visible
    return deco(col, items.map((it) => [it[0], it[1], (c, z) => {
      const y = yf(z);
      for (const sg of [1, -1]) if (facing(c, 0, sg) > 0.02) it[2]((x0, x1, inn, out) => fsl2(c, x0, x1, y, sg, inn, out), z);
    }]), ex);
  }
  function masonry2(xa, xb, za, zb, ch, jw, seed) {
    const its = []; let i = 0;
    for (let z = za; z < zb - 0.7; z += ch, i++) {
      if (z > za) its.push([z, z + 0.45, (d) => d(xa, xb)]);
      const off = (U.hash2(i, seed, 3) * 0.6 + (i % 2) * 0.5) * jw;
      for (let x = xa + off; x < xb - 0.8; x += jw * (0.8 + U.hash2(i, Math.round(x * 3), seed) * 0.5)) if (x > xa + 0.8) { const xx = x; its.push([z + 0.45, Math.min(zb, z + ch), (d) => d(xx - 0.21, xx + 0.21)]); }
    }
    return its;
  }

  /* ====================================================================
   * HOUSE — opt.v 0..3
   *  0 snow-roofed longhouse (ridge along x, horned ridge, chimney, shields)
   *  1 gable-front cottage with carved timber gable and crossed bargeboards
   *  2 ice-block dome dwelling with an entrance tunnel, fire pit and totem
   *  3 cross-gabled stone house: hipped longhouse + gable-front wing + woodshed
   * r 19-22, h 21-24, 1 dir.
   * ==================================================================== */
  M.ice_house = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), v = ((opt.v | 0) % 4 + 4) % 4;
    const parts = [], F = Fac(k);
    if (v === 0) {
      plinth(parts, k, 0, 1, 18.5, 0.62, 11, 1.2);
      parts.push(box(6.5, -4.6, 10, -1.2, 9.5, 18.5, k.stD, k.stT, { detail: (c) => { c.fillStyle = k.win; c.fillRect(7.2, -3.9, 2.1, 2); } }));
      parts.push(bbox(-14, -7, 14, 7.5, 1.2, 9.5, 0.4, k.st, k.stT));
      F.mas(masonry(-13.6, 13.6, 7.5, 1.2, 9.5, 2.4, 4.4, 2));
      F.add('wood', It.vl(-13.3, 7.5, 1.2, 9.5, 1.2)).add('wood', It.vl(13.3, 7.5, 1.2, 9.5, 1.2));
      F.door(-5, 7.5, 3.4, 1.2, 6.8);
      F.win(2.5, 7.5, 2.2, 4, 6.6).win(10, 7.5, 2.2, 4, 6.6);
      F.shields([-10, 6.3], 7.5, 5.4, 1.35);
      F.flush(parts);
      roofX(parts, k, { x0: -15.5, x1: 15.5, yc: 0.2, d: 8.6, z0: 9.5, z1: 14.8, hip: 3.4, seed: 4 });
      parts.push(box(6.2, -4.9, 10.3, -0.9, 18.5, 19.4, k.snS, k.sn, { bevel: false }));
      // woodpile against the right end
      parts.push({ z0: 1.2, z1: 4.4, side: k.wdD, top: k.wdL, shape: (c) => { for (let i = 0; i < 4; i++) S.circ(c, 16 + (i % 2) * 0.4, 1 + i * 1.6, 1); }, detail: (c) => { for (let i = 0; i < 4; i++) S.dot(c, k.wdD, 16 + (i % 2) * 0.4, 1 + i * 1.6, 0.45); } });
      return { r: 21, h: 22, parts, style: 'unit', bevel: 0.7 };
    }
    if (v === 1) {
      plinth(parts, k, 0, 1.5, 16, 0.8, 21, 1.2);
      parts.push(bbox(-9.5, -7, 9.5, 9, 1.2, 8, 0.4, k.st, k.stT));
      F.mas(masonry(-9.2, 9.2, 9, 1.2, 8, 2.4, 4, 5));
      F.quoins(-8.9, 9, 1.2, 8).quoins(8.9, 9, 1.2, 8);
      F.door(0, 9, 3.6, 1.2, 6.6);
      F.win(-5.6, 9, 2, 3.6, 6).win(5.6, 9, 2, 3.6, 6);
      F.flush(parts);
      roofY(parts, k, { xc: 0, y0: -8.6, y1: 9.4, hw: 12.2, z0: 8, z1: 16.5, horn: 4.5 });
      // log stack + chopping block beside the door
      parts.push({ z0: 1.2, z1: 4, side: k.wdD, top: k.wdL, shape: (c) => { for (let i = 0; i < 3; i++) S.rrect(c, 10.6, 6 + i * 1.6, 4.6, 1.5, 0.75); }, detail: (c) => S.dot(c, k.wdD, 15, 9.8, 0.4) });
      parts.push({ z0: 1.2, z1: 3, side: k.wd, top: k.wdL, shape: (c) => S.circ(c, -11.8, 10, 1.4), detail: (c) => S.lines(c, k.iron, 0.45, [-12.6, 9.4, -11, 10.6]) });
      return { r: 18, h: 22, parts, style: 'unit', bevel: 0.7 };
    }
    if (v === 2) {
      plinth(parts, k, 0, 1, 17, 0.8, 31, 1.2);
      parts.push(cyl(-1, -1, 12.4, 1.2, 3, k.st, k.stT));
      const R = 11.6, H = 12, cx = -1, cy = -1;
      const dr = (zt) => R * Math.sqrt(Math.max(0.02, 1 - zt * zt)) + 0.1;
      parts.push({ z0: 3, z1: 3 + H, side: mix(k.ice, k.p.b, 0.25), top: k.iceL, ao: 0.32, shape: (c, zt) => S.circ(c, cx, cy, dr(zt)) });
      const its = [];
      for (let i = 1; i < 5; i++) { const zt = i / 5.3, z = 3 + zt * H; its.push(It.arc(cx, cy, dr(zt), 0.12, Math.PI - 0.12, z, z + 0.5, 0.9)); for (let j = 0; j < 7 - i; j++) { const a = 0.3 + (j + (i % 2) * 0.5) / (7 - i) * (Math.PI - 0.6); its.push(It.arc(cx, cy, dr(zt - 0.09), a, a + 0.06, z - H / 5.3 + 0.5, z, 0.9)); } }
      parts.push(deco(mix(k.iceD, k.p.a, 0.3), its));
      // entrance tunnel toward the camera, glowing doorway
      parts.push({ z0: 3, z1: 9, side: mix(k.ice, k.p.b, 0.2), top: k.iceL, ao: 0.35, shape: (c, zt) => { const w = 3.6 * Math.sqrt(Math.max(0.05, 1 - zt * zt)) + 0.2; c.rect(cx - w, 6, w * 2, 8); } });
      parts.push(deco(mix(k.iceD, k.p.a, 0.3), [It.arch(cx, 14, 4.6, 3, 8.3, 0.4, 0.3)]));
      parts.push(deco(k.gl, [It.arch(cx, 14.05, 3.2, 3, 7.4, 0.4, 0.35)], { ao: -0.4 }));
      parts.push(cyl(cx, cy, 1.5, 3 + H - 0.6, 3 + H + 1.4, mix(k.iceD, k.p.a, 0.3), k.stD, { detail: (c) => S.dot(c, k.win, cx, cy, 0.8) }));
      // fire pit with frost flame (front left) + fish drying rack (right)
      parts.push(cyl(-12, 9, 2.2, 1.2, 2.2, k.stD, k.iron));
      parts.push({ z0: 2.2, z1: 6, side: k.gl, top: k.glH, flat: true, ao: -0.5, bevel: false, shape: (c, zt, an) => S.circ(c, -12 + Math.sin(an * TAU + zt * 3) * zt * 0.6, 9, 1.3 * Math.pow(1 - zt, 0.8) + 0.1), detail: (c) => halo(c, k.gl, -12, 9, 5, 0.25) });
      parts.push({ z0: 1.2, z1: 8, side: k.wdD, top: k.wd, stroke: 0.6, bevel: false, shape: (c) => { S.seg(c, 10, 2, 10.01, 2); S.seg(c, 15, 2, 15.01, 2); } });
      parts.push({ z0: 8, z1: 8.6, side: k.wdD, top: k.wd, bevel: false, shape: (c) => c.rect(9.6, 1.6, 5.8, 0.8) });
      parts.push({ z0: 4.6, z1: 7.8, side: mix(k.p.a, k.p.b, 0.25), top: k.stL, bevel: false, shape: (c, zt) => { for (let i = 0; i < 4; i++) S.ell(c, 11 + i * 1.1, 2, 0.35 + 0.25 * Math.sin(zt * Math.PI), 0.5); } });
      // carved totem post with banner
      parts.push(cyl(13, 9, 1.2, 1.2, 14, k.wd, k.wdL));
      parts.push(deco(k.wdD, [It.hl(11.8, 14.2, 10.1, 5, 0.6), It.hl(11.8, 14.2, 10.1, 9, 0.6), It.rect(13, 10.15, 0.8, 10.6, 12.2)]));
      parts.push(cyl(13, 9, 1.7, 14, 15.4, k.wdD, k.wd));
      flags(parts, k, [[13, 9, 12, 19, 5.5, -1]]);
      return { r: 19, h: 21, parts, style: 'unit', bevel: 0.7 };
    }
    // v3: cross-gabled stone house
    plinth(parts, k, 0, 0, 20.5, 0.8, 41, 1.2);
    parts.push(bbox(-15, -10, 11, 2, 1.2, 9, 0.5, k.st, k.stT));
    F.mas(masonry(-14.6, 0.6, 2, 1.2, 9, 2.4, 4.4, 9));
    F.win(-10, 2, 2.2, 4.4, 7).win(-4.4, 2, 2.2, 4.4, 7);
    F.flush(parts);
    roofX(parts, k, { x0: -16.5, x1: 12.5, yc: -4, d: 7.6, z0: 9, z1: 15, hip: 3, seed: 7, rows: 1, icicles: false });
    parts.push(bbox(1, -2, 13, 14, 1.2, 8, 0.4, k.st, k.stT));
    F.mas(masonry(1.3, 12.7, 14, 1.2, 8, 2.4, 4, 13));
    F.quoins(1.6, 14, 1.2, 8).quoins(12.4, 14, 1.2, 8);
    F.door(7, 14, 3, 1.2, 6.4);
    F.flush(parts);
    roofY(parts, k, { xc: 7, y0: -4, y1: 14.4, hw: 7.8, z0: 8, z1: 14.5, horn: 3.6, cut: (z) => -4 + 7.6 * (1 - (z - 9) / 6), rows: 1 });
    // lean-to woodshed on the left with a stacked log face
    parts.push(box(-20.5, -3, -15, 6, 1.2, 5, k.wdD, k.wd));
    parts.push({ z0: 1.6, z1: 4.6, side: k.wdL, top: k.wdL, flat: true, bevel: false, shape: (c) => { for (let i = 0; i < 4; i++) S.circ(c, -19.6 + i * 1.25, 6.2, 0.6); } });
    parts.push({ z0: 4.6, z1: 5.2, side: k.wdD, top: k.wdD, bevel: false, shape: (c) => c.rect(-21.2, -3.6, 6.8, 10.4) });
    parts.push({ z0: 5.2, z1: 6.6, side: mix(k.snS, k.p.a, 0.25), top: k.snL, ao: 0.12, bevel: false, shape: (c, zt) => c.rect(-21.2, -3.6, 6.8, 10.2 - zt * 4) });
    return { r: 22, h: 20, parts, style: 'unit', bevel: 0.7 };
  };

  /* ====================================================================
   * KEEP — opt.level 1..3 (footprint ~100 / 115 / 130).
   *  L1 jarl's hold: square donjon under a hipped snow roof, great hall, armoury,
   *     low crenellated ring wall with a timber gate between stone posts.
   *  L2 bigger donjon with corner turrets, round corner towers with snow cones,
   *     round gate towers, taller curtain.
   *  L3 citadel: crenellated donjon crowned by a giant glowing ice-crystal spire,
   *     four crenellated towers sprouting crystal spires, crystal-buttressed curtain,
   *     square gatehouse with a frost-lit arch.
   * r 52 / 60 / 68, h 64 / 72 / 96, 1 dir, anims 4 (flags + braziers).
   * ==================================================================== */
  M.ice_keep = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), L = U.clamp((opt.level | 0) || 1, 1, 3);
    const C3 = [null,
      { R: 50, WX: 42, WY0: -32, WY1: 30, WH: 12, WT: 4, dj: [-14, -28, 14, -6, 36], hall: [-37, -4, -6, 13, 12.5], arm: [4, 0, 23, 17, 11] },
      { R: 57, WX: 48, WY0: -36, WY1: 34, WH: 15, WT: 5, dj: [-16, -32, 16, -8, 44], hall: [-41, -6, -7, 14, 13.5], arm: [5, -1, 27, 18, 12] },
      { R: 64, WX: 54, WY0: -40, WY1: 38, WH: 17, WT: 5.5, dj: [-18, -36, 18, -9, 50], hall: [-46, -8, -8, 16, 14], arm: [6, -2, 31, 20, 13] },
    ][L];
    const { WX, WY0, WY1, WH, WT } = C3;
    const parts = [], F = Fac(k);
    // courtyard: flagstone path from the gate, a few snow patches, brazier glow
    plinth(parts, k, 0, 2, C3.R, 0.84, 17 + L, 3, { detail: (c) => {
      c.fillStyle = rgba(k.stT, 0.35); c.beginPath(); c.rect(-5, C3.hall[3] - 1, 10, WY1 - C3.hall[3] + 1); c.fill();
      c.strokeStyle = rgba(k.p.d, 0.35); c.lineWidth = 0.4; c.beginPath(); for (let y = C3.hall[3]; y < WY1; y += 2.6) { c.moveTo(-5, y); c.lineTo(5, y); } c.stroke();
      for (let i = 0; i < 5; i++) snowPatch(c, -WX * 0.7 + U.hash2(i, L, 5) * WX * 1.4, C3.hall[3] + 3 + U.hash2(i, L, 6) * (WY1 - C3.hall[3] - 8), 1.2 + U.hash2(i, L, 7) * 1.4, i + 9, rgba(k.sn, 0.4));
      for (const g of [-1, 1]) halo(c, k.gl, g * (L === 1 ? 8.5 : 11), WY1 + 4, 9, 0.18);
    } });
    // ---------------- ring wall: back + sides
    parts.push({ z0: 3, z1: WH, side: k.st, top: k.sn, shape: (c) => { c.rect(-WX, WY0, WX * 2, WT); c.rect(-WX, WY0, WT, WY1 - WY0); c.rect(WX - WT, WY0, WT, WY1 - WY0); } });
    parts.push(merlons(-WX, WY0, WX, WY1, WH, WH + 2.2, k.st, k.sn, { t: 1.4, front: false }));
    // ---------------- back corner towers
    if (L >= 2) {
      const bt = [[-WX, WY0 + 2, L === 2 ? 6.5 : 7.5, 3, L === 2 ? 21 : 26], [WX, WY0 + 2, L === 2 ? 6.5 : 7.5, 3, L === 2 ? 21 : 26]];
      parts.push(towersR(bt, k, 0.6));
      if (L === 2) coneRoofs(parts, k, bt.map((q) => [q[0], q[1], q[2] + 1, q[4], q[4] + 19]), { icicles: false });
      else parts.push(merlonsRs(bt.map((q) => [q[0], q[1], q[2] - 0.2, q[4], q[4] + 2.4, 8]), k));
    }
    // ---------------- donjon
    const [dx0, dy0, dx1, dy1, dH] = C3.dj, bat = 1 + L * 0.15, fy = dy1 - bat;
    parts.push(bbox(dx0, dy0, dx1, dy1, 3, dH, bat, k.st, k.stT));
    F.mas(masonry(dx0 + 1.2, dx1 - 1.2, fy + 0.2, 3, dH, 3.2, 5.4, 3 + L));
    F.quoins(dx0 + 1.6, fy + 0.2, 10, dH).quoins(dx1 - 1.6, fy + 0.2, 10, dH);
    const wz = dH - 14;
    F.win(-dx1 * 0.5, fy, 2.6, wz, wz + 5, 'peak').win(dx1 * 0.5, fy, 2.6, wz, wz + 5, 'peak').win(0, fy, 3, wz + 6, wz + 12, 'peak');
    F.banner(-dx1 * 0.5, fy + 0.1, 3.6, wz - 13, wz - 1.5).banner(dx1 * 0.5, fy + 0.1, 3.6, wz - 13, wz - 1.5);
    if (L === 3) F.win(-dx1 * 0.5, fy, 2.2, wz + 7, wz + 11, 'peak').win(dx1 * 0.5, fy, 2.2, wz + 7, wz + 11, 'peak');
    F.flush(parts);
    const djx = (dx0 + dx1) / 2, djy = (dy0 + dy1) / 2, djw = (dx1 - dx0) / 2, djd = (dy1 - dy0) / 2;
    if (L < 3) {
      // corbelled wall-walk band, then the hipped snow roof
      parts.push(box(dx0 + bat - 0.8, dy0 + bat - 0.8, dx1 - bat + 0.8, dy1 - bat + 0.8, dH - 0.5, dH + 2.2, k.stD, k.stT, { detail: (c) => { c.fillStyle = rgba(k.p.d, 0.4); for (let x = dx0 + 2; x < dx1 - 1; x += 2.4) c.fillRect(x, dy1 - bat + 0.2, 1, 0.5); } }));
      roofX(parts, k, { x0: dx0 + bat - 1.6, x1: dx1 - bat + 1.6, yc: djy, d: djd - bat + 1.6, z0: dH + 2.2, z1: dH + 14 + L * 2, hip: djw * 0.55, rows: 2, seed: 9, hornH: 5 });
      if (L === 2) {
        const tu = [[dx0 + 1.5, dy1 - 1.5, 3.8, 26, dH + 10], [dx1 - 1.5, dy1 - 1.5, 3.8, 26, dH + 10]];
        parts.push(multi(tu, (q) => [q[3], q[4]], (c, q, lt) => S.circ(c, q[0], q[1], q[2] * (lt < 0.12 ? 0.4 + lt * 5 : 1)), { side: k.st, top: k.stT }));
        parts.push(deco(k.win, [It.arc(tu[0][0], tu[0][1], 3.8, 1.2, 1.9, dH + 3, dH + 6.5), It.arc(tu[1][0], tu[1][1], 3.8, 1.2, 1.9, dH + 3, dH + 6.5)]));
        coneRoofs(parts, k, tu.map((q) => [q[0], q[1], q[2] + 1.2, q[4], q[4] + 10]), { icicles: false });
      }
    } else {
      parts.push(merlons(dx0 + bat, dy0 + bat, dx1 - bat, dy1 - bat, dH, dH + 3, k.st, k.sn, { t: 1.6, m: 2.6 }));
      const tu = [[dx0 + 2.6, dy0 + 2.6], [dx1 - 2.6, dy0 + 2.6], [dx0 + 2.6, dy1 - 2.6], [dx1 - 2.6, dy1 - 2.6]].map((q) => [q[0], q[1], 4.2, dH, dH + 9]);
      parts.push(towersR(tu, k, 0.2));
      parts.push(merlonsRs(tu.map((q) => [q[0], q[1], 4.6, q[4], q[4] + 2.2, 6]), k));
      crystals(parts, k, [
        [djx, djy, 7, 40, 0, 0, dH], [djx - 6, djy + 3, 4.2, 24, -3, 1, dH], [djx + 6.5, djy + 2, 4.6, 28, 3.5, 1, dH], [djx - 2, djy - 5, 3.6, 20, -1, -2, dH],
        [tu[0][0], tu[0][1], 2.2, 9, 0, 0, dH + 9], [tu[1][0], tu[1][1], 2.2, 9, 0, 0, dH + 9], [tu[2][0], tu[2][1], 2.4, 10, 0, 0, dH + 9], [tu[3][0], tu[3][1], 2.4, 10, 0, 0, dH + 9],
      ], { glow: true });
      parts.push(deco(k.gl, [It.fn(dH + 6, dH + 30, (c, z) => { const t = (z - dH - 6) / 24; if (Math.abs(t - 0.35) < 0.02 || Math.abs(t - 0.62) < 0.02) return; fsl(c, djx - 0.5 * (1 - t), djx + 0.5 * (1 - t), djy + 6.4 * (1 - (z - dH) / 40 * 0.22), 0.2, 0.6); })], { ao: -0.4 }));
    }
    // ---------------- great hall + armoury
    const [hx0, hy0, hx1, hy1, hH] = C3.hall, [ax0, ay0, ax1, ay1, aH] = C3.arm;
    parts.push({ z0: 3, z1: hH, side: k.st, top: k.stT, shape: (c, zt) => { const z = 3 + zt * (hH - 3); let b = 0.5 * (z - 3) / (hH - 3); c.rect(hx0 + b, hy0 + b, hx1 - hx0 - b * 2, hy1 - hy0 - b * 2); if (z <= aH + 1e-6) { b = 0.5 * (z - 3) / (aH - 3); c.rect(ax0 + b, ay0 + b, ax1 - ax0 - b * 2, ay1 - ay0 - b * 2); } } });
    const hcx = (hx0 + hx1) / 2, acx = (ax0 + ax1) / 2;
    F.mas(masonry(hx0 + 0.5, hx1 - 0.5, hy1, 3, hH, 2.6, 4.6, 6)).mas(masonry(ax0 + 0.5, ax1 - 0.5, ay1, 3, aH, 2.6, 4.4, 8));
    F.door(hcx, hy1, 4.6, 3, 10.4, 'arch', false);
    for (const dxw of [-12, -7, 7, 12]) F.win(hcx + dxw * (hx1 - hx0) / 32, hy1, 2.2, 6.4, 9.6);
    F.shields([hcx - (hx1 - hx0) * 0.29, hcx + (hx1 - hx0) * 0.29], hy1, 8, 1.4);
    F.door(acx, ay1, 5, 3, 9.6, 'rect', false);
    F.win(acx - (ax1 - ax0) * 0.32, ay1, 2, 5.6, 8.4).win(acx + (ax1 - ax0) * 0.32, ay1, 2, 5.6, 8.4);
    F.flush(parts);
    roofX(parts, k, { x0: hx0 - 1.6, x1: hx1 + 1.6, yc: (hy0 + hy1) / 2, d: (hy1 - hy0) / 2 + 1.4, z0: hH, z1: hH + 6.5 + L * 0.8, hip: 4, seed: 5 + L, rows: 1 });
    roofY(parts, k, { xc: acx, y0: ay0 - 1.6, y1: ay1 + 0.4, hw: (ax1 - ax0) / 2 + 1.8, z0: aH, z1: aH + 9 + L * 0.5, horn: 4, rows: 2 });
    // ---------------- front wall, gate and front towers
    const gw = L === 1 ? 6 : L === 2 ? 7 : 8.5;
    parts.push({ z0: 3, z1: WH, side: k.st, top: k.sn, shape: (c) => { c.rect(-WX, WY1 - WT, WX - gw, WT); c.rect(gw, WY1 - WT, WX - gw, WT); } });
    const ftr = L === 2 ? 7.5 : 8.5, ftH = L === 2 ? 24 : 30;
    if (L >= 2) F.mas(masonryR(-WX, WY1 - 2, ftr - 0.4, 3, ftH, 3, 5, 31)).mas(masonryR(WX, WY1 - 2, ftr - 0.4, 3, ftH, 3, 5, 32));
    F.mas(masonry(-WX + (L >= 2 ? ftr : 0.4), -gw - (L >= 2 ? 5 : 3), WY1, 3, WH, 3, 5, 21)).mas(masonry(gw + (L >= 2 ? 5 : 3), WX - (L >= 2 ? ftr : 0.4), WY1, 3, WH, 3, 5, 22));
    parts.push(merlons(0, 0, 0, 0, WH, WH + 2.2, k.st, k.sn, { t: 1.4, runs: [[-WX, WY1 - 0.7, -gw, WY1 - 0.7], [gw, WY1 - 0.7, WX, WY1 - 0.7]] }));
    if (L === 3) crystals(parts, k, [[-WX * 0.62, WY1 + 1.2, 2.6, 12, -0.6, 0.8, 3], [-WX * 0.62 + 3.2, WY1 + 1.6, 1.7, 8, 0.8, 0.6, 3], [WX * 0.62, WY1 + 1.2, 2.6, 12, 0.6, 0.8, 3], [WX * 0.62 - 3.2, WY1 + 1.6, 1.7, 8, -0.8, 0.6, 3], [-WX * 0.3, WY1 + 1.2, 2, 10, 0, 0.8, 3], [WX * 0.3, WY1 + 1.2, 2, 10, 0, 0.8, 3]]);
    // gate leaves (closed) between the gate towers / posts
    const gy = WY1 - WT / 2;
    parts.push(box(-gw, gy - 0.8, gw, gy + 0.8, 3, 3 + (L === 3 ? 11 : 9), k.wdD, k.wd));
    F.add('iron', It.hl(-gw, gw, gy + 0.8, 5, 0.6, 0.3, 0.5)).add('iron', It.hl(-gw, gw, gy + 0.8, 8.5, 0.6, 0.3, 0.5)).add('woodD', It.vl(0, gy + 0.8, 3, 3 + (L === 3 ? 11 : 9), 0.5, 0.3, 0.5));
    if (L === 3) F.add('gl', It.arch(0, gy + 0.85, gw * 2 - 1, 3 + 11, 3 + 15.5, 0.2, 0.6));
    // gate towers
    if (L === 1) {
      parts.push(box(-gw - 5, WY1 - WT - 1, -gw, WY1 + 1, 3, 16, k.st, k.stT));
      parts.push(box(gw, WY1 - WT - 1, gw + 5, WY1 + 1, 3, 16, k.st, k.stT));
      F.mas(masonry(-gw - 4.6, -gw - 0.4, WY1 + 1, 3, 16, 2.6, 2.4, 41)).mas(masonry(gw + 0.4, gw + 4.6, WY1 + 1, 3, 16, 2.6, 2.4, 42));
      F.add('wood', It.hl(-gw - 0.4, gw + 0.4, WY1 + 1.2, 12, 1.3, 0.6, 0.5));
      F.flush(parts);
      parts.push({ z0: 16, z1: 22, side: mix(k.sn, k.p.a, 0.2), top: k.snL, ao: 0.15, bevel: false, shape: (c, zt) => { const e = 3.4 * Math.pow(1 - zt, 1.1) + 0.15, cy = WY1 - WT / 2; for (const cx of [-gw - 2.5, gw + 2.5]) c.rect(cx - e, cy - e - 0.6, e * 2, e * 2 + 1.2); } });
    } else if (L === 2) {
      const gt = [[-gw - 4, WY1 - 1.5, 5, 3, 21], [gw + 4, WY1 - 1.5, 5, 3, 21]];
      const ft = [[-WX, WY1 - 2, ftr, 3, ftH], [WX, WY1 - 2, ftr, 3, ftH]];
      parts.push(towersR(gt.concat(ft), k, 0.6));
      F.mas(masonryR(gt[0][0], gt[0][1], 4.8, 3, 21, 3, 3, 51)).mas(masonryR(gt[1][0], gt[1][1], 4.8, 3, 21, 3, 3, 52));
      F.add('win', It.arc(gt[0][0], gt[0][1], 4.6, 1.3, 1.85, 13, 16.5)).add('win', It.arc(gt[1][0], gt[1][1], 4.6, 1.3, 1.85, 13, 16.5));
      F.add('win', It.arc(-WX, WY1 - 2, ftr - 0.6, 0.9, 1.25, 14, 18)).add('win', It.arc(WX, WY1 - 2, ftr - 0.6, 1.9, 2.25, 14, 18));
      F.add('frame', It.arch(0, gy + 0.9, gw * 2 + 1.4, 3 + 9, 3 + 13, 0.4, 0.5));
      F.flush(parts);
      coneRoofs(parts, k, gt.map((q) => [q[0], q[1], q[2] + 1, q[4], q[4] + 15]).concat(ft.map((q) => [q[0], q[1], q[2] + 1, q[4], q[4] + 21])));
    } else {
      const gt = [[-gw - 5, gy, 5.2], [gw + 5, gy, 5.2]];
      parts.push(multi(gt, () => [3, 26], (c, q, lt) => { const b = lt * 0.8; c.rect(q[0] - q[2] + b, q[1] - q[2] + b, q[2] * 2 - b * 2, q[2] * 2 - b * 2); }, { side: k.st, top: k.stT }));
      const ft = [[-WX, WY1 - 2, ftr, 3, ftH], [WX, WY1 - 2, ftr, 3, ftH]];
      parts.push(towersR(ft, k, 0.6));
      F.mas(masonry(gt[0][0] - 4.6, gt[0][0] + 4.6, gy + 4.4, 3, 26, 3, 3, 61)).mas(masonry(gt[1][0] - 4.6, gt[1][0] + 4.6, gy + 4.4, 3, 26, 3, 3, 62));
      F.slit(gt[0][0], gy + 4.4, 15, 19).slit(gt[1][0], gy + 4.4, 15, 19).slit(gt[0][0], gy + 4.4, 7, 10).slit(gt[1][0], gy + 4.4, 7, 10);
      F.add('win', It.arc(-WX, WY1 - 2, ftr - 0.6, 0.9, 1.22, 16, 21)).add('win', It.arc(WX, WY1 - 2, ftr - 0.6, 1.92, 2.24, 16, 21));
      F.add('frame', It.hl(-gw, gw, gy + 0.9, 3 + 15.5, 3, 0.4, 0.5));
      F.flush(parts);
      parts.push(merlonsRs(ft.map((q) => [q[0], q[1], q[2] - 0.4, q[4], q[4] + 2.6, 9]), k));
      parts.push(merlons(gt[0][0] - 5, gy - 5, gt[0][0] + 5, gy + 5, 26, 28.6, k.st, k.sn, { t: 1.5, m: 1.8 }));
      parts.push(merlons(gt[1][0] - 5, gy - 5, gt[1][0] + 5, gy + 5, 26, 28.6, k.st, k.sn, { t: 1.5, m: 1.8 }));
      crystals(parts, k, [
        [-WX, WY1 - 2, 3.6, 20, 0, 0, ftH], [-WX - 3, WY1 - 1, 2, 11, -1.6, 0.5, ftH], [-WX + 3, WY1 - 3, 2.2, 13, 1.4, -0.6, ftH],
        [WX, WY1 - 2, 3.6, 20, 0, 0, ftH], [WX + 3, WY1 - 1, 2, 11, 1.6, 0.5, ftH], [WX - 3, WY1 - 3, 2.2, 13, -1.4, -0.6, ftH],
        [gt[0][0], gy, 2.6, 13, 0, 0, 26], [gt[1][0], gy, 2.6, 13, 0, 0, 26],
      ], { glow: true });
    }
    F.flush(parts);
    braziers(parts, k, [[-gw - (L === 1 ? 2.5 : 4), WY1 + (L === 1 ? 3 : 5)], [gw + (L === 1 ? 2.5 : 4), WY1 + (L === 1 ? 3 : 5)]], 3, 1 + L * 0.1);
    const fl = [[djx, djy, L < 3 ? dH + 12 + L * 2 : dH + 2, L < 3 ? dH + 24 + L * 2 : dH + 14, 8, 1]];
    if (L === 1) fl[0] = [djx, djy, dH + 16, dH + 26, 8, 1];
    if (L === 2) fl.push([-WX, WY0 + 2, 40, 48, 6, 1], [WX, WY0 + 2, 40, 48, 6, 1]);
    if (L === 3) fl[0] = [dx0 + 2.6, dy1 - 2.6, dH + 11, dH + 21, 7, -1], fl.push([dx1 - 2.6, dy1 - 2.6, dH + 11, dH + 21, 7, 1]);
    flags(parts, k, fl);
    const H = L === 1 ? 64 : L === 2 ? 74 : 96;
    return { r: C3.R + 3 + (L === 3 ? 2 : 0), h: H, parts, style: 'unit', bevel: 0.8, spots: { gate: [0, WY1 + 2, 3], top: L < 3 ? [djx, djy, dH + 14] : [djx, djy, dH + 36], archers: [djx, dy1, dH] } };
  };

  // diagonal sliver on a +y face (braces, rune strokes)
  const diag = (xa, za, xb, zb, y, w, inn, out) => [Math.min(za, zb), Math.max(za, zb), (c, z) => { const t = (z - za) / ((zb - za) || 1e-6), x = xa + (xb - xa) * t, sp = Math.abs((xb - xa) / ((zb - za) || 1e-6)) * 0.28 + w / 2; fsl(c, x - sp, x + sp, y, inn, out); }];
  // masonry on a battered +y face: the face recedes by bat over za..zt and narrows
  function masonryB(xa, xb, y, za, zb, zt, bat, ch, jw, seed) {
    const ins = (z) => bat * (z - za) / (zt - za), its = []; let i = 0;
    for (let z = za; z < zb - 0.7; z += ch, i++) {
      if (z > za) { const n = ins(z); its.push(It.hl(xa + n, xb - n, y - n, z, 0.45)); }
      const off = (U.hash2(i, seed, 3) * 0.6 + (i % 2) * 0.5) * jw;
      for (let x = xa + off; x < xb - 0.8; x += jw * (0.8 + U.hash2(i, Math.round(x * 3), seed) * 0.5)) { const xx = x; if (xx > xa + 0.8) its.push([z + 0.45, Math.min(zb, z + ch), (c, zz) => { const n = ins(zz); if (xx > xa + n + 0.4 && xx < xb - n - 0.4) fsl(c, xx - 0.21, xx + 0.21, y - n); }]); }
    }
    return its;
  }
  // a vertical wheel facing the camera (in the x-z plane at y): rim + 4 spokes
  function wheelXZ(c, cx, y, zc, R, z, w) {
    const dz = z - zc, rim = 0.8; w = w || 0.8;
    if (Math.abs(dz) > R) return;
    const ho = Math.sqrt(R * R - dz * dz), ri = R - rim;
    const iv = (a, b) => c.rect(a, y - w / 2, b - a, w);
    if (Math.abs(dz) < ri) { const hi = Math.sqrt(ri * ri - dz * dz); iv(cx - ho, cx - hi); iv(cx + hi, cx + ho); iv(cx - 0.3, cx + 0.3); iv(cx + dz * 0.98 - 0.3, cx + dz * 0.98 + 0.3); iv(cx - dz * 0.98 - 0.3, cx - dz * 0.98 + 0.3); if (Math.abs(dz) < 0.3) iv(cx - hi, cx + hi); }
    else iv(cx - ho, cx + ho);
  }

  /* ====================================================================
   * BARRACKS — snow-roofed troop hall with a shield wall, training yard with
   * straw dummies, weapon rack, archery butt, frost braziers and a war banner.
   * r 34, h 26, 1 dir (anims 4: braziers + flag).
   * ==================================================================== */
  M.ice_barracks = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 2, 33, 0.8, 20, 1.4);
    parts.push(bbox(-29, -21, 8, -5, 1.4, 11.5, 0.5, k.st, k.stT));
    F.mas(masonry(-28.5, 7.5, -5, 1.4, 11.5, 2.6, 4.6, 14));
    F.door(-10.5, -5, 4.4, 1.4, 9);
    F.win(-24, -5, 2.2, 5.4, 8.4).win(-17, -5, 2.2, 5.4, 8.4).win(-3.5, -5, 2.2, 5.4, 8.4).win(3.2, -5, 2.2, 5.4, 8.4);
    F.shields([-27, -20.5, -13.7, -7.2, -0.2, 6.2], -5, 7, 1.25);
    F.flush(parts);
    roofX(parts, k, { x0: -30.6, x1: 9.6, yc: -13, d: 9.6, z0: 11.5, z1: 17.6, hip: 4, seed: 12, rows: 1 });
    braziers(parts, k, [[-15.2, -2.6], [-5.8, -2.6]], 1.4, 0.9);
    fence(parts, k, [[0, 5, 0, 19, 9, 19], [15, 19, 25, 19, 25, 5]], 1.4, 5, 4.6);
    // timber: dummy posts + arms, archery butt legs, weapon rack frame
    const dum = [[6, 9], [13, 7.5], [19.5, 11.5]];
    const bm = [];
    for (const d of dum) { bm.push([d[0], d[1], 1.4, d[0], d[1], 9.4, 0.7]); bm.push([d[0] - 2.6, d[1], 7.4, d[0] + 2.6, d[1], 7.4, 0.6, 0.6]); }
    bm.push([-17.5, 14.6, 1.4, -16.6, 13.4, 7.8, 0.5], [-14.5, 14.6, 1.4, -15.4, 13.4, 7.8, 0.5], [-16, 12, 1.4, -16, 13.2, 7.4, 0.5]);
    bm.push([14, 4, 1.4, 14, 4, 7.6, 0.6], [23, 4, 1.4, 23, 4, 7.6, 0.6], [13.6, 4, 7, 23.4, 4, 7, 0.6, 0.7], [13.6, 4, 3.6, 23.4, 4, 3.6, 0.5, 0.5]);
    parts.push(beams(bm, k.wd, k.wdL));
    parts.push(multi(dum.map((d) => [d[0], d[1], 1.4, 4, 8]).concat(dum.map((d) => [d[0], d[1], 0.9, 9, 10.6])), (q) => [q[3], q[4]], (c, q, lt) => S.ell(c, q[0], q[1], q[2] * (0.75 + 0.25 * Math.sin(lt * Math.PI)) + 0.15, q[2] * 0.8 * (0.75 + 0.25 * Math.sin(lt * Math.PI)) + 0.1), { side: sh(HAY, -0.15), top: HAY, ao: 0.3 }));
    // spears leaning on the rack
    const sp = []; for (let x = 15; x < 22.6; x += 1.5) sp.push([x, 4.8, 1.4, x + 0.4, 3.4, 11.5, 0.32]);
    parts.push(beams(sp, k.wdD, k.ironT));
    // archery butt: straw face with k rings
    parts.push(deco(HAY, [It.disc(-16, 14.2, 2.7, 6)], { flat: false }));
    parts.push(deco(k.k, [It.disc(-16, 14.3, 1.8, 6, 0, 0.6)], { flat: false }));
    parts.push(deco(k.k2, [It.disc(-16, 14.4, 0.8, 6, 0, 0.7)]));
    parts.push(barrels([[-26, 7, 1.5, 3.4], [-23.4, 9.4, 1.5, 3.4], [-26.5, 10.6, 1.4, 3]], k, 1.4));
    flags(parts, k, [[25, 5, 1.4, 19, 7, -1]]);
    return { r: 36, h: 26, parts, style: 'unit', bevel: 0.7 };
  };

  /* ====================================================================
   * FARM — stone farmhouse (longhouse), round granary with a snow cone, plank
   * barn with a gable front and braced doors, snow-capped haystacks in a fenced
   * paddock. r 34, h 28, 1 dir.
   * ==================================================================== */
  M.ice_farm = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 2, 33, 0.78, 33, 1.2);
    // granary (back)
    const gx = 1, gy = -15;
    parts.push(tcyl(gx, gy, 5.6, 1.2, 11, 0.4, k.st, k.stT));
    F.mas(masonryR(gx, gy, 5.3, 1.2, 11, 2.4, 3, 34)); F.add('woodD', It.arch(gx, gy + 5.3, 2, 1.2, 5.6, 0.6, 0.45)); F.flush(parts);
    coneRoofs(parts, k, [[gx, gy, 6.8, 11, 27]], { icicles: false, finial: true });
    // farmhouse (back left)
    parts.push(box(-21, -18.5, -18, -15.4, 9, 17, k.stD, k.stT));
    parts.push(bbox(-30, -20, -6, -8, 1.2, 9, 0.4, k.st, k.stT));
    F.mas(masonry(-29.6, -6.4, -8, 1.2, 9, 2.4, 4.4, 35));
    F.add('frame', It.arch(-15, -8, 4.2, 1.2, 7, 0.6, 0.32)).add('woodD', It.arch(-15, -7.96, 2.9, 1.2, 6.4, 0.6, 0.4));
    F.win(-25, -8, 2, 4, 6.4).win(-10, -8, 2, 4, 6.4);
    F.flush(parts);
    roofX(parts, k, { x0: -31.5, x1: -4.5, yc: -14, d: 7.4, z0: 9, z1: 13.6, hip: 3, seed: 33, rows: 0, hornH: 4 });
    parts.push(box(-21.3, -18.8, -17.7, -15.1, 17, 17.8, k.snS, k.sn, { bevel: false }));
    // plank barn (right)
    parts.push(bbox(8, -8, 28, 16, 1.2, 10, 0.25, sh(k.wd, -0.1), k.wdL));
    const pl = []; for (let x = 9.2; x < 27.5; x += 1.5) if (Math.abs(x - 18) > 3.6) pl.push(It.vl(x, 16, 1.2, 10, 0.32, 0.6, 0.2));
    F.addAll('woodD', pl);
    F.add('woodD', It.rect(18, 16, 7, 1.2, 8, 0.6, 0.35)).add('win', It.rect(18, 16, 3, 8.4, 9.8, 0.6, 0.3));
    F.add('wood', diag(15, 1.6, 17.8, 7.6, 16.1, 0.6, 0.6, 0.5)).add('wood', diag(21, 1.6, 18.2, 7.6, 16.1, 0.6, 0.6, 0.5)).add('wood', It.hl(14.6, 21.4, 16.1, 4.4, 0.6, 0.6, 0.5)).add('wood', It.vl(18, 16.1, 1.2, 8, 0.4, 0.6, 0.5));
    F.flush(parts);
    roofY(parts, k, { xc: 18, y0: -9.6, y1: 16.4, hw: 12, z0: 10, z1: 19.5, horn: 4, rows: 1, gwin: false, icicles: false, gable: sh(k.wd, -0.1) });
    // paddock with haystacks
    fence(parts, k, [-31, 3, -31, 20, -3, 20, -3, 10], 1.2, 4.6);
    hay(parts, k, [[-22, 9, 4.4, 6.5], [-12.5, 12.5, 3.8, 5.6], [-25, 15.5, 3, 4.4]], 1.2);
    return { r: 37, h: 28, parts, style: 'unit', bevel: 0.7 };
  };

  /* ====================================================================
   * STABLE — long low timber stable on a stone sill, open stalls with half-doors
   * and horses looking out, snow roof with dragon heads, a fenced paddock with a
   * frozen trough and hay. r 35, h 22, 1 dir (anims 4: flag).
   * ==================================================================== */
  M.ice_stable = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 3, 34, 0.72, 42, 1.2);
    parts.push(bbox(-29, -12, 12, 2, 1.2, 3.6, 0.2, k.stD, k.stT));
    parts.push(box(-28.6, -11.6, 11.6, 1.6, 3.6, 11, sh(k.wd, -0.08), k.wdL));
    const st = [-23.5, -15.5, -7.5, 0.5];
    for (const x of st) { F.add('win', It.rect(x, 1.6, 5.4, 3.6, 8.8, 0.6, 0.3)); F.add('wood', It.rect(x, 1.66, 5, 3.6, 6, 0.6, 0.38)); F.add('woodD', It.hl(x - 2.5, x + 2.5, 1.7, 4.6, 0.4, 0.6, 0.42)); F.add('woodD', diag(x - 2.2, 3.9, x + 2.2, 5.7, 1.72, 0.45, 0.6, 0.44)); }
    for (const x of [-27.8, -19.5, -11.5, -3.5, 4.5, 10.8]) F.add('woodD', It.vl(x, 1.6, 3.6, 11, 1, 0.6, 0.4));
    F.add('woodD', It.hl(-28.6, 11.6, 1.7, 9.2, 0.7, 0.6, 0.4));
    F.add('win', It.rect(7.6, 1.6, 2.4, 9.8, 10.8, 0.6, 0.3));
    F.flush(parts);
    // horses looking out of two stalls
    const hz = [[-15.5, '#6e4c34'], [0.5, '#a7a39c']];
    for (const q of hz) parts.push({ z0: 5.8, z1: 8.2, side: q[1], top: sh(q[1], 0.15), ao: 0.2, shape: (c, zt) => { c.rect(q[0] - 0.9, 1.2, 1.8, 2.2); if (zt < 0.6) c.rect(q[0] - 0.7, 3.2, 1.4, 1.4); }, detail: (c) => { S.dot(c, '#2a2420', q[0], 2.6, 0.5); S.lines(c, sh(q[1], -0.4), 0.4, [q[0] - 0.6, 1.4, q[0] + 0.6, 1.4]); } });
    roofX(parts, k, { x0: -30.5, x1: 13.5, yc: -5, d: 8.2, z0: 11, z1: 16.2, hip: 3.6, seed: 21, rows: 1, hornH: 4.2 });
    // paddock
    fence(parts, k, [12, 5, 12, 18, 26, 18, 26, 5, 16, 5], 1.2, 4.6);
    parts.push(box(15, 8, 21, 10.6, 1.2, 3.4, k.wd, k.wdL));
    parts.push(box(15.6, 8.5, 20.4, 10.1, 3.4, 3.6, k.iceL, k.iceL, { flat: true, bevel: false, detail: (c) => S.lines(c, 'rgba(255,255,255,0.8)', 0.3, [16, 9, 18, 9.6]) }));
    hay(parts, k, [[22, 14.5, 2.6, 3.6], [-31, -4, 2.4, 3.4]], 1.2);
    parts.push(beams([[-26, 9.6, 1.6, -15, 9.6, 1.6, 0.6, 0.8], [-26, 13.4, 1.6, -15, 13.4, 1.6, 0.6, 0.8], [-25, 9.4, 2.4, -25, 13.6, 2.4, 0.8, 0.8], [-16, 9.4, 2.4, -16, 13.6, 2.4, 0.8, 0.8]], k.wdD, k.wd));
    parts.push(box(-25, 9.6, -16, 13.4, 2.6, 3.4, k.wd, k.wdL));
    parts.push(multi([[-23.2, 11.5, 1.5], [-20.4, 11, 1.4], [-17.8, 11.8, 1.3], [-21.6, 11.4, 1.2, 1]], (q) => [3.4, q[3] ? 6.6 : 5.6], (c, q, lt) => S.blob(c, q[0], q[1], q[2] * (1 - lt * lt * 0.45), q[0] * 3, 8, 0.2), { side: sh(HAY, -0.32), top: sh(HAY, -0.12), ao: 0.3 }));
    parts.push(barrels([[-8, 8.6, 1.5, 3.4], [-5.3, 9.6, 1.5, 3.4], [-31, 6, 1.4, 3]], k, 1.2));
    flags(parts, k, [[12, 18, 1.2, 15, 6, -1]]);
    return { r: 37, h: 22, parts, style: 'unit', bevel: 0.7 };
  };

  /* ====================================================================
   * MAGE TOWER — battered round stone tower on an octagonal base, ice-tinted
   * upper tier with a glowing rune band, a crenellated top platform whose curved
   * horns cradle a floating ice crystal that bobs and pulses; three shards orbit
   * it. r 18, h 94, 1 dir, anims 4 (pulse, orbit, braziers).
   * ==================================================================== */
  M.ice_magetower = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    const iceSt = mix(k.st, k.ice, 0.32), iceStT = mix(k.stT, k.iceL, 0.4);
    parts.push({ z0: 0, z1: 1.6, side: k.pl, top: k.plT, shape: (c) => S.poly(c, ngon(0, 1.5, 16.5, 8, TAU / 16)), detail: (c) => { halo(c, k.gl, 0, 13, 9, 0.18); } });
    parts.push({ z0: 1.6, z1: 4, side: k.stD, top: k.stT, shape: (c, zt) => S.poly(c, ngon(0, 0.8, 13.6 - zt * 0.5, 8, TAU / 16)) });
    parts.push(tcyl(0, 0, 10.5, 4, 40, 1.6, k.st, k.stT));
    F.mas(masonryR(0, 0, 9.9, 4, 40, 3.2, 5, 71));
    F.door(0, 10.2, 3.6, 4, 11.5, 'peak');
    F.add('win', It.arc(0, 0, 9.8, 0.95, 1.2, 17, 22)).add('gl', It.arc(0, 0, 9.85, 0.99, 1.16, 17.4, 21.4));
    F.add('win', It.arc(0, 0, 9.8, 1.94, 2.19, 17, 22)).add('gl', It.arc(0, 0, 9.85, 1.98, 2.15, 17.4, 21.4));
    F.add('win', It.arc(0, 0, 9.4, 1.44, 1.7, 27, 34)).add('gl', It.arc(0, 0, 9.45, 1.48, 1.66, 27.5, 33.4));
    F.banner(-5.2, Math.sqrt(9.6 * 9.6 - 27), 3, 24, 34).banner(5.2, Math.sqrt(9.6 * 9.6 - 27), 3, 24, 34);
    F.flush(parts);
    parts.push({ z0: 39.5, z1: 42.5, side: k.stD, top: k.stT, shape: (c, zt) => S.circ(c, 0, 0, 9 + zt * 1.6) });
    parts.push(tcyl(0, 0, 8, 42.5, 60, 0.8, iceSt, iceStT));
    parts.push(deco(mix(iceSt, k.p.d, 0.4), [It.arc(0, 0, 7.6, 0.1, Math.PI - 0.1, 49, 52.4, 1.1)]));
    parts.push(deco(k.gl, [It.arc(0, 0, 7.7, 0.15, Math.PI - 0.15, 50, 51.4, 1.1), It.arc(0, 0, 7.6, 1.3, 1.84, 53.5, 58), It.arc(0, 0, 7.6, 0.55, 0.85, 44, 47.5), It.arc(0, 0, 7.6, 2.29, 2.59, 44, 47.5)], { ao: -0.3 }));
    parts.push({ z0: 59.5, z1: 62, side: k.stD, top: mix(k.stT, k.sn, 0.4), shape: (c, zt) => S.circ(c, 0, 0, 7.4 + zt * 2) });
    parts.push(merlonsR(0, 0, 9.4, 10, 62, 64.4, k.st, k.sn, 1.5));
    // curved horns cradling the crystal
    const horns = [0.25, 1.83, 3.4, 4.97].map((a) => a + 0.4);
    parts.push({ z0: 62, z1: 74, side: iceSt, top: k.iceL, bevel: false, shape: (c, zt) => { for (const a of horns) { const r = 7.6 - zt * zt * 3.6 + Math.sin(zt * Math.PI) * 1.2; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 1.1 * (1 - zt * 0.65)); } } });
    // pulsing aura (soft, no outline)
    parts.push({ z0: 76, z1: 76, side: k.gl, top: k.gl, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 0.1), detail: (c, an) => { const p = 0.5 + 0.5 * Math.sin(an * TAU); halo(c, k.gl, 0, 0, 12 + p * 3, 0.16 + p * 0.14); } });
    // orbiting shards behind the crystal
    const shard = (c, an, front, zt) => { for (let i = 0; i < 3; i++) { const a = an * TAU / 3 + i * TAU / 3, sx = Math.cos(a) * 9.5, sy = Math.sin(a) * 9.5 * 0.8; if ((sy > 0) !== front) continue; const t = Math.abs(zt * 2 - 1); const r = 1.2 * (1 - t) + 0.08; S.poly(c, [sx, sy - r, sx + r * 0.8, sy, sx, sy + r, sx - r * 0.8, sy]); } };
    parts.push({ z0: 71, z1: 77, side: mix(k.ice, '#ffffff', 0.3), top: k.iceL, flat: true, bevel: false, shape: (c, zt, an) => shard(c, an, false, zt) });
    // floating crystal: bobbing, pulsing bipyramid (lit + shaded halves)
    const cr = (sg) => (c, zt, an) => { const bob = Math.sin(an * TAU) * 1.2, z = 68 + zt * 26 - bob, t = (z - 70) / 22; if (t < 0 || t > 1) return; const pu = 1 + 0.06 * Math.sin(an * TAU + 1), w = 6.4 * pu * (t < 0.35 ? t / 0.35 : (1 - t) / 0.65) + 0.1; S.poly(c, [0, -w * 0.8, sg * w, -w * 0.3, sg * w * 0.8, w * 0.5, 0, w * 0.9]); };
    parts.push({ z0: 68, z1: 94, side: mix(k.ice, '#ffffff', 0.5), top: '#ffffff', flat: true, ao: -0.3, bevel: false, shape: cr(-1) });
    parts.push({ z0: 68, z1: 94, side: mix(k.ice, k.gl, 0.4), top: k.iceL, flat: true, ao: -0.4, bevel: false, shape: cr(1) });
    parts.push({ z0: 71, z1: 77, side: mix(k.ice, '#ffffff', 0.3), top: k.iceL, flat: true, bevel: false, shape: (c, zt, an) => shard(c, an, true, zt) });
    braziers(parts, k, [[-6.2, 12.2], [6.2, 12.2]], 1.6, 0.9);
    return { r: 18, h: 96, parts, style: 'unit', bevel: 0.75, spots: { orb: [0, 0, 81] } };
  };

  /* ====================================================================
   * ARCHER TOWER — squat battered square stone tower, arrow slits, war banner,
   * corbelled crenellated archer platform with two archers, frost brazier, pennant.
   * r 17, h 60, 1 dir (anims 4).
   * ==================================================================== */
  M.ice_tower = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 1.5, 16, 0.86, 51, 1.4);
    parts.push(bbox(-11, -11, 11, 11, 1.4, 40, 2, k.st, k.stT));
    F.mas(masonryB(-10.6, 10.6, 11, 1.4, 40, 40, 2, 3, 4.4, 52));
    F.door(0, 10.7, 3.4, 1.4, 8.2);
    F.slit(-5.2, 10.3, 14, 18.5).slit(5.2, 10.3, 14, 18.5).slit(-5.2, 9.7, 30, 34.5).slit(5.2, 9.7, 30, 34.5);
    F.banner(0, 9.9, 3.8, 18, 29);
    F.flush(parts);
    parts.push(box(-12, -12, 12, 12, 38.4, 41.4, k.stD, mix(k.stT, k.sn, 0.35)));
    parts.push(deco(k.win, [0, 1, 2, 3, 4, 5, 6].map((i) => It.rect(-9.6 + i * 3.2, 12, 1.1, 38.4, 39.6, 0.3, 0.2))));
    // two archers on the platform
    const ar = [[-4.5, 4.8], [4.8, 3.6]];
    parts.push(multi(ar, () => [41.4, 44.6], (c, q, lt) => S.circ(c, q[0], q[1], 1 - lt * 0.2), { side: k.kD, top: k.k, ao: 0.2 }));
    parts.push(multi(ar, () => [44.6, 46], (c, q) => S.circ(c, q[0], q[1], 0.65), { side: sh(k.p.skin || '#efd8c8', -0.15), top: k.p.skin || '#efd8c8', ao: 0.1, bevel: false }));
    parts.push(multi(ar, () => [42.6, 46.6], (c, q, lt) => { const a = -0.9 + lt * 1.8; S.circ(c, q[0] + 1.3 + Math.cos(a) * 0.4, q[1] + Math.sin(a) * 1.4, 0.22); }, { side: k.wdD, top: k.wd, bevel: false }));
    parts.push(merlons(-12, -12, 12, 12, 41.4, 44.8, k.st, k.sn, { t: 1.7, m: 2.6, g: 1.6 }));
    braziers(parts, k, [[0, -6]], 41.4, 0.9);
    flags(parts, k, [[-10, -10, 41.4, 56, 7, 1]]);
    return { r: 18, h: 60, parts, style: 'unit', bevel: 0.75, spots: { archers: [0, 4, 45] } };
  };

  /* ====================================================================
   * WATCHTOWER — slim log tower on a stone footing, X-braced bays, a ladder,
   * planked lookout platform with railing and a big frost-fire beacon.
   * r 13, h 66, 1 dir, anims 4 (beacon flicker, pennant).
   * ==================================================================== */
  M.ice_watchtower = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 1, 12, 0.86, 61, 1.2);
    parts.push(bbox(-7.5, -7.5, 7.5, 7.5, 1.2, 10, 0.8, k.st, k.stT));
    F.mas(masonryB(-7.2, 7.2, 7.5, 1.2, 10, 10, 0.8, 2.4, 3, 62)).door(0, 7.3, 2.6, 1.2, 6.2).flush(parts);
    const P4 = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const br = [];
    for (const [za, zb] of [[10, 22.6], [22.6, 35.2], [35.2, 47.8]]) for (const y of [-5.3, 5.3]) { br.push([-5.6 + (za - 10) / 38, y, za, 5.6 - (zb - 10) / 38, y, zb, 0.6, 0.6], [5.6 - (za - 10) / 38, y, za, -5.6 + (zb - 10) / 38, y, zb, 0.6, 0.6]); }
    parts.push(beams(br.filter((q) => q[1] < 0), sh(k.wd, -0.2), k.wd));
    parts.push(beams(P4.map((p) => [p[0] * 6, p[1] * 6, 10, p[0] * 5, p[1] * 5, 48, 1.6]), k.wd, k.wdL));
    parts.push(beams(br.filter((q) => q[1] > 0).concat([[-5.6, 5.6, 22.6, 5.6, 5.6, 22.6, 0.6, 0.8], [-5.4, 5.4, 35.2, 5.4, 5.4, 35.2, 0.6, 0.8]]), k.wd, k.wdL));
    // ladder
    parts.push(deco(k.wdD, [It.vl(-1.3, 6.4, 10, 48, 0.45, 0.3, 0.4), It.vl(1.3, 6.4, 10, 48, 0.45, 0.3, 0.4)].concat(Array.from({ length: 18 }, (v, i) => It.hl(-1.3, 1.3, 6.45, 11 + i * 2.1, 0.45, 0.3, 0.38))), { flat: false }));
    parts.push(box(-8.6, -8.6, 8.6, 8.6, 48.4, 50, k.wd, mix(k.wdL, k.sn, 0.45), { detail: (c) => S.lines(c, rgba(k.wdD, 0.6), 0.35, [-8.6, -3, 8.6, -3, -8.6, 3, 8.6, 3]) }));
    parts.push(icicles(k, -7.8, 7.8, 8.9, 47.8, 61, 1.8));
    // railing
    parts.push({ z0: 50, z1: 53.6, side: k.wdD, top: k.wd, bevel: false, shape: (c) => { for (const x of [-8, 0, 8]) for (const y of [-8, 8]) S.circ(c, x, y, 0.5); S.circ(c, -8, 0, 0.5); S.circ(c, 8, 0, 0.5); } });
    parts.push({ z0: 52.8, z1: 53.6, side: k.wd, top: k.wdL, stroke: 0.55, bevel: false, shape: (c) => S.poly(c, [-8, -8, 8, -8, 8, 8, -8, 8]) });
    // beacon
    parts.push(box(-2, -2, 2, 2, 50, 51.8, k.stD, k.stT));
    parts.push({ z0: 51.8, z1: 54.6, side: k.iron, top: k.ironT, shape: (c, zt) => S.poly(c, ngon(0, 0, 2.2 + zt * 1.2, 8, 0.2)) });
    parts.push({ z0: 54.2, z1: 63.5, side: k.gl, top: k.glH, flat: true, ao: -0.55, bevel: false, shape: (c, zt, an) => { const ph = an * TAU; for (let i = 0; i < 3; i++) { const a = i * 2.1 + ph; const r = (2.4 - i * 0.4) * Math.pow(1 - zt, 0.7) * (1 + 0.18 * Math.sin(ph * 2 + zt * 7 + i)) + 0.1; S.circ(c, Math.cos(a) * 0.9 * (1 - zt) + Math.sin(ph + zt * 4) * zt, Math.sin(a) * 0.7 * (1 - zt), r); } }, detail: (c, an) => halo(c, k.gl, 0, 0, 7 + Math.sin(an * TAU) * 1.5, 0.2) });
    parts.push({ z0: 54.4, z1: 59, side: k.glH, top: '#ffffff', flat: true, ao: -0.2, bevel: false, shape: (c, zt, an) => S.circ(c, Math.sin(an * TAU + zt * 4) * 0.4, 0, 1.3 * Math.pow(1 - zt, 0.8) + 0.08) });
    flags(parts, k, [[-8, -8, 53.6, 63, 6, 1]]);
    return { r: 13, h: 66, parts, style: 'unit', bevel: 0.75, spots: { beacon: [0, 0, 57] } };
  };

  /* ====================================================================
   * TEMPLE — healers' stave church: dark staved timber nave on a stone stair
   * platform, carved gable with crossed dragon heads, a glowing portal, tiered
   * belfry with its own horned roof and a crystal-tipped spire; a steaming
   * healing spring and a glowing crystal font. r 32, h 52, 1 dir (anims 4).
   * ==================================================================== */
  M.ice_temple = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 2, 31, 0.8, 71, 1.4, { detail: (c) => { halo(c, k.gl, -18, 15, 10, 0.25); halo(c, k.gl, 18, 13, 8, 0.22); halo(c, k.gl, 0, 16, 7, 0.2); } });
    parts.push(bbox(-12.5, -17.5, 12.5, 14, 1.4, 3.2, 0.3, k.stD, k.stT));
    parts.push(deco(k.stT, [It.hl(-5, 5, 14.3, 1.6, 0.5, 0.6, 0.5), It.hl(-5, 5, 14.3, 2.5, 0.4, 0.6, 0.5)], { flat: false }));
    const wd2 = sh(k.wd, -0.12);
    parts.push(bbox(-10, -15, 10, 11, 3.2, 12, 0.3, wd2, k.wdL));
    const sv = []; for (let x = -9.2; x < 9.6; x += 1.35) if (Math.abs(x) > 3.6) sv.push(It.vl(x, 11, 3.2, 12, 0.3, 0.6, 0.2));
    F.addAll('woodD', sv);
    F.add('wood', It.arch(0, 11, 6.6, 3.2, 11.2, 0.6, 0.3)).add('woodD', It.arch(0, 11.03, 5.4, 3.2, 10.4, 0.6, 0.36)).add('gl', It.arch(0, 11.06, 3.8, 3.2, 9.6, 0.6, 0.42));
    F.add('win', It.disc(-6.4, 11, 1.2, 8.4, 0, 0.32)).add('win', It.disc(6.4, 11, 1.2, 8.4, 0, 0.32)).add('gl', It.disc(-6.4, 11.05, 0.75, 8.4, 0, 0.4)).add('gl', It.disc(6.4, 11.05, 0.75, 8.4, 0, 0.4));
    F.flush(parts);
    roofY(parts, k, { xc: 0, y0: -16.6, y1: 11.4, hw: 12.8, z0: 12, z1: 22, horn: 5, rows: 2, gable: wd2 });
    // belfry tier + horned roof + spire
    parts.push(box(-4.6, -10.2, 4.6, -1, 18, 27.6, wd2, k.wdL));
    parts.push(deco(k.wdD, [It.arch(-2.6, -1, 1.5, 21.8, 26.4), It.arch(0, -1, 1.5, 21.8, 26.4), It.arch(2.6, -1, 1.5, 21.8, 26.4), It.hl(-4.6, 4.6, -0.95, 26.8, 0.6, 0.6, 0.4)]));
    parts.push(deco(k.wdL, [0, 1, 2].flatMap((i) => [It.hl(-3.3 + i * 2.6, -1.9 + i * 2.6, -0.92, 22.6, 0.4, 0.5, 0.45), It.hl(-3.3 + i * 2.6, -1.9 + i * 2.6, -0.92, 24, 0.4, 0.5, 0.45)]), { flat: false }));
    roofX(parts, k, { x0: -6.6, x1: 6.6, yc: -5.6, d: 6.6, z0: 27.6, z1: 32.6, hip: 3.6, rows: 0, fascia: false, icicles: false, hornH: 3.4 });
    parts.push({ z0: 32, z1: 46.5, side: k.snS, top: k.snL, ao: 0.15, bevel: false, shape: (c, zt) => { const w = 3.2 * Math.pow(1 - zt, 1.1) + 0.1; c.rect(-w, -5.6 - w, w * 2, w * 2); } });
    parts.push(deco(mix(k.snS, k.p.a, 0.3), [It.fn(32.4, 45, (c, z) => { const zt = (z - 32) / 14.5, w = 3.2 * Math.pow(1 - zt, 1.1) + 0.1; fsl(c, -0.2, 0.2, -5.6 + w, 0.4, 0.15); })]));
    crystals(parts, k, [[0, -5.6, 1.3, 6, 0, 0, 45.8], [-8.6, 15.5, 1.2, 4, -0.5, 0.3, 1.4]]);
    // healing spring (front left)
    parts.push({ z0: 1.4, z1: 3, side: k.st, top: k.stT, shape: (c) => { S.circ(c, -18, 15, 6); c.moveTo(-18 + 4.4, 15); c.arc(-18, 15, 4.4, 0, TAU, true); } });
    parts.push({ z0: 1.4, z1: 2.2, side: k.glD, top: mix(k.gl, k.ice, 0.5), flat: true, bevel: false, shape: (c) => S.circ(c, -18, 15, 4.6), detail: (c, an) => { c.save(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.3; c.beginPath(); c.arc(-18, 15, 1.6 + an * 2, 0, TAU); c.moveTo(-18 + 3, 15); c.arc(-18, 15, 3 + an * 1, 0, TAU); c.stroke(); c.restore(); S.dot(c, '#ffffff', -19.4, 13.8, 0.5); } });
    // steam wisps over the spring
    parts.push({ z0: 3, z1: 11, side: '#eef6fc', top: '#ffffff', flat: true, bevel: false, shape: (c, zt, an) => { for (let i = 0; i < 2; i++) { const ph = an * TAU + i * 3; const r = (0.5 + zt * 0.6) * (1 - zt) * (zt < 0.15 ? zt / 0.15 : 1); S.circ(c, -19 + i * 2.4 + Math.sin(zt * 5 + ph) * 0.9, 15 + i * 0.6, r); } } });
    // glowing crystal font (front right)
    parts.push(cyl(18, 13, 3, 1.4, 3.2, k.stD, k.stT));
    crystals(parts, k, [[18, 13, 2.4, 11, 0, 0, 3.2], [16.2, 13.8, 1.4, 6.5, -1, 0.4, 3.2], [19.8, 14, 1.3, 6, 1, 0.4, 3.2]]);
    return { r: 33, h: 52, parts, style: 'unit', bevel: 0.75, spots: { spring: [-18, 15, 2], portal: [0, 12, 5] } };
  };

  /* ====================================================================
   * MARKET — flagstone square: a gable-front trading hut, three stalls with
   * striped k/k2 awnings under snow, goods (fish, furs, pots), a fish drying
   * rack, barrels, crates, fur bales, a frost brazier and a banner.
   * r 33, h 24, 1 dir (anims 4).
   * ==================================================================== */
  M.ice_market = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 2, 32, 0.78, 81, 1.2, { detail: (c) => {
      c.save(); c.strokeStyle = rgba(k.p.d, 0.28); c.lineWidth = 0.35; c.beginPath();
      for (let y = -20; y < 26; y += 3.4) { c.moveTo(-30, y); c.lineTo(30, y); }
      for (let y = -20, i = 0; y < 26; y += 3.4, i++) for (let x = -30 + (i % 2) * 2.2; x < 30; x += 4.4) { c.moveTo(x, y); c.lineTo(x, y + 3.4); }
      c.stroke(); c.restore();
      halo(c, k.gl, 1, 8, 8, 0.2);
    } });
    // trading hut (back left)
    parts.push(bbox(-27, -24, -11, -11, 1.2, 8, 0.35, k.st, k.stT));
    F.mas(masonry(-26.6, -11.4, -11, 1.2, 8, 2.4, 4, 82)).door(-19, -11, 3, 1.2, 6.2).win(-24, -11, 1.8, 3.6, 5.8).win(-14, -11, 1.8, 3.6, 5.8).flush(parts);
    roofY(parts, k, { xc: -19, y0: -25.4, y1: -10.6, hw: 10, z0: 8, z1: 15, horn: 3.6, rows: 1, icicles: false });
    // fish drying rack (back right)
    parts.push(beams([[7, -19, 1.2, 7, -19, 10, 0.8], [22, -19, 1.2, 22, -19, 10, 0.8], [6.6, -19, 9.6, 22.4, -19, 9.6, 0.6, 0.6], [6.6, -19, 5.6, 22.4, -19, 5.6, 0.5, 0.5]], k.wd, k.wdL));
    parts.push({ z0: 2.6, z1: 9.2, side: mix(k.p.b, k.p.a, 0.35), top: k.p.b, flat: false, ao: 0.1, bevel: false, shape: (c, zt) => { const z = 2.6 + zt * 6.6; const row = z > 5.6 ? 9.2 : 5.2; const d = row - z; if (d < 0 || d > 2.5) return; const w = 0.45 * Math.sin(Math.min(1, d / 2.5) * Math.PI) + 0.12; for (let x = 8.2; x < 21.4; x += 1.25) S.ell(c, x + (row > 7 ? 0.6 : 0), -18.9, w, 0.3); } });
    // stalls: [x, y, w, d]
    const ST = [[-17, 3, 12, 6], [16, 1, 12, 6], [-1, -10, 12, 6]];
    parts.push(multi(ST, () => [1.2, 4.4], (c, q) => c.rect(q[0] - q[2] / 2 + 0.4, q[1] + q[3] / 2 - 2.6, q[2] - 0.8, 2.6), { side: k.wd, top: k.wdL, ao: 0.25, detail: (c) => {
      // goods on the counters: fish, furs, pots
      for (const q of ST) { const x0 = q[0] - q[2] / 2 + 1.4, y = q[1] + q[3] / 2 - 1.3; for (let i = 0; i < 4; i++) { const x = x0 + i * 2.5; if ((i + q[0]) % 3 === 0) { c.fillStyle = mix(k.p.b, k.p.a, 0.2); c.beginPath(); S.ell(c, x, y, 1, 0.4, 0.2); c.fill(); } else if ((i + q[0]) % 3 === 1) { c.fillStyle = '#7a5838'; c.beginPath(); S.blob(c, x, y, 1, i + 3, 7, 0.4); c.fill(); } else { S.dot(c, k.k, x, y, 0.7); S.dot(c, sh(k.k, 0.4), x - 0.2, y - 0.2, 0.25); } } }
    } }));
    parts.push(multi(ST, () => [1.2, 8.8], (c, q) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.circ(c, q[0] + sx * (q[2] / 2 - 0.3), q[1] + sy * (q[3] / 2 - 0.3), 0.4); }, { side: k.wdD, top: k.wd, bevel: false }));
    parts.push(multi(ST, () => [8.6, 9.4], (c, q) => c.rect(q[0] - q[2] / 2 - 0.7, q[1] - q[3] / 2 - 0.6, q[2] + 1.4, q[3] + 1.9), { side: k.kD, top: k.k2, ao: 0, bevel: false, detail: (c) => {
      for (const q of ST) { const x0 = q[0] - q[2] / 2 - 0.7, y0 = q[1] - q[3] / 2 - 0.6, W = q[2] + 1.4, D = q[3] + 1.9; c.fillStyle = k.k; for (let x = x0; x < x0 + W - 0.2; x += 2.4) c.fillRect(x, y0, Math.min(1.2, x0 + W - x), D); c.fillStyle = rgba(k.sn, 0.92); c.beginPath(); c.save(); c.translate(q[0] - 0.5, y0 + D * 0.32); c.scale(1, 0.42); S.blob(c, 0, 0, W * 0.44, q[0] + 5, 11, 0.32); c.restore(); c.fill(); }
    } }));
    parts.push(multi(ST, () => [7.6, 8.7], (c, q, lt) => { const y = q[1] + q[3] / 2 + 1.25; for (let x = q[0] - q[2] / 2 - 0.4; x < q[0] + q[2] / 2 + 0.5; x += 1.6) { const h = lt < 0.5 ? 0.75 * Math.sqrt(Math.max(0, 1 - Math.pow(1 - lt * 2, 2))) : 0.8; fsl(c, x - h, x + h, y, 0.2, 0.3); } }, { side: k.k, top: k.k, flat: false, ao: 0.1, bevel: false }));
    // fur bales and sacks beside stalls, barrels, crates
    parts.push(multi([[-25, 6, 1.8], [-24, 9, 1.6], [24.5, 4.5, 1.8], [8.6, -9, 1.6]], () => [1.2, 3.4], (c, q, lt) => S.blob(c, q[0], q[1], q[2] * (1 - lt * lt * 0.5), q[0] + 7, 8, 0.25), { side: '#6a4c34', top: '#8a6a4a', ao: 0.3 }));
    parts.push(barrels([[-8, -18, 1.5, 3.4], [-5.2, -19, 1.5, 3.4], [25, -8, 1.4, 3.2], [6, 15, 1.5, 3.4]], k, 1.2));
    parts.push(crates([[26, -3, 2.8, 2.6, 0.2], [8.8, 17.4, 2.6, 2.4, -0.25], [-27, 15, 2.8, 2.6, 0.1], [-24.4, 16.6, 2.4, 2.2, 0.5]], k, 1.2));
    braziers(parts, k, [[1, 8]], 1.2, 1);
    flags(parts, k, [[24, 12, 1.2, 17, 6, -1]]);
    return { r: 35, h: 24, parts, style: 'unit', bevel: 0.7 };
  };

  /* ====================================================================
   * WORKSHOP — siege workshop: open-fronted timber shed under a snow roof with
   * a workbench and a half-built ballista, a treadwheel crane hoisting a log,
   * a half-built catapult frame, a log pile and barrels.
   * r 34, h 34, 1 dir (anims 4: pennant).
   * ==================================================================== */
  M.ice_workshop = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    plinth(parts, k, 0, 2, 31, 0.8, 91, 1.2, { detail: (c) => {
      c.fillStyle = rgba(k.p.d, 0.35); c.fillRect(-23, -19, 25, 18);
      c.fillStyle = rgba(k.wdL, 0.55); for (let i = 0; i < 16; i++) { const x = -6 + U.hash2(i, 1, 1) * 24, y = 3 + U.hash2(i, 2, 1) * 14; c.fillRect(x, y, 0.9, 0.35); }
      halo(c, k.gl, -17, 8, 7, 0.22);
    } });
    // open-fronted gable shed (left): back + side walls, front posts and lintel
    const sw = sh(k.wd, -0.1);
    parts.push({ z0: 1.2, z1: 11.6, side: sw, top: k.wdL, shape: (c) => { c.rect(-24, -20, 26, 1.6); c.rect(-24, -20, 1.6, 18.5); c.rect(0.4, -20, 1.6, 18.5); } });
    // half-built ballista on trestles just inside the open front
    parts.push(beams([[-17, -6, 1.2, -17, -6, 4, 0.8], [-6, -6, 1.2, -6, -6, 4, 0.8], [-19, -6, 4.2, -4, -6, 4.2, 1.2, 1.2], [-8, -9.5, 5.4, -7.6, -3, 5.4, 1, 1]], k.wdL, sh(k.wdL, 0.2)));
    parts.push(beams([[-8.3, -9.5, 5.4, -10.8, -6, 6, 0.7], [-8.3, -2.8, 5.4, -10.8, -6, 6, 0.7], [-15, -6, 4.6, -15, -6, 7.6, 0.6]], k.wd, k.wdL));
    parts.push(beams([[-23.2, -1.6, 1.2, -23.2, -1.6, 11.6, 1.4], [1.2, -1.6, 1.2, 1.2, -1.6, 11.6, 1.4], [-24, -1.6, 11, 2, -1.6, 11, 1.4, 1.4], [-23.2, -1.6, 8, -19.5, -1.6, 11, 0.8], [1.2, -1.6, 8, -2.5, -1.6, 11, 0.8]], k.wd, k.wdL));
    roofY(parts, k, { xc: -11, y0: -21.6, y1: -1, hw: 14.6, z0: 11.6, z1: 20.5, horn: 4.5, rows: 2, gable: sw });
    // frost forge: stone hearth with frost fire, anvil, quench tub
    parts.push(box(-21, 5.5, -13.5, 10, 1.2, 4.4, k.stD, k.stT, { detail: (c) => { c.fillStyle = k.iron; c.fillRect(-20, 6.4, 5.5, 2.6); } }));
    parts.push(box(-20.6, 5.2, -18.4, 7.2, 4.4, 7.4, k.st, k.stT, { detail: (c) => S.dot(c, k.win, -19.5, 6.2, 0.6) }));
    parts.push({ z0: 4.2, z1: 8.4, side: k.gl, top: k.glH, flat: true, ao: -0.5, bevel: false, shape: (c, zt, an) => { for (let i = 0; i < 3; i++) { const ph = an * TAU + i * 2; S.circ(c, -19 + i * 1.8 + Math.sin(ph + zt * 4) * 0.4 * zt, 7.9, 0.95 * Math.pow(1 - zt, 0.8) * (1 + 0.2 * Math.sin(ph * 2)) + 0.08); } } });
    parts.push({ z0: 1.2, z1: 4, side: k.iron, top: k.ironT, shape: (c, zt) => { if (zt < 0.55) c.rect(-10.4, 8.2, 1.6, 1.6); else S.poly(c, [-12.2, 8.4, -8.4, 8.4, -7, 9, -8.4, 9.6, -12.2, 9.6]); } });
    parts.push(barrels([[-23.4, 10.6, 1.5, 3], [24, 10, 1.5, 3.4], [26, 6.8, 1.4, 3.2]], k, 1.2));
    parts.push({ z0: 4, z1: 4.2, side: k.glD, top: mix(k.gl, k.ice, 0.5), flat: true, bevel: false, shape: (c) => S.circ(c, -23.4, 10.6, 1.2) });
    // plank stack (front middle)
    parts.push({ z0: 1.2, z1: 3.6, side: k.wd, top: k.wdL, shape: (c, zt) => { const n = Math.floor(zt * 4); c.rect(-5 + n * 0.3, 12 - n * 0.2, 10, 2.6); }, detail: (c) => S.lines(c, rgba(k.wdD, 0.7), 0.3, [-4.1, 12.4, 5.6, 12.4, -4.1, 13.5, 5.6, 13.5]) });
    // half-built catapult frame (right front) under the crane
    parts.push(beams([[8, 4.5, 1.2, 20, 4.5, 1.2, 1.1, 1.1], [8, 10.5, 1.2, 20, 10.5, 1.2, 1.1, 1.1], [9, 4, 1.6, 9, 11, 1.6, 0.9, 0.9], [19, 4, 1.6, 19, 11, 1.6, 0.9, 0.9], [10.5, 4.5, 2, 13.5, 4.5, 10, 0.9], [16.5, 4.5, 2, 13.5, 4.5, 10, 0.9], [10.5, 10.5, 2, 13.5, 10.5, 10, 0.9], [16.5, 10.5, 2, 13.5, 10.5, 10, 0.9], [13.5, 4, 10, 13.5, 11, 10, 0.9, 0.9], [6, 14.5, 1.6, 21, 12.6, 1.6, 1.1, 1.1]], k.wdL, sh(k.wdL, 0.2)));
    // treadwheel crane (right back)
    const mx = 22, my = -9;
    parts.push({ z0: 1.2, z1: 13, side: k.wd, top: k.wdL, bevel: false, shape: (c, zt) => wheelXZ(c, mx, my + 2.4, 7, 5.6, 1.2 + zt * 11.8, 1.6) });
    parts.push(beams([[mx - 4.4, my, 1.2, mx, my, 21, 1.1], [mx + 4.4, my, 1.2, mx, my, 21, 1.1], [mx, my, 1.2, mx, my, 31, 1.4], [mx + 0.6, my, 29.5, 13, 7.5, 26, 1.1, 1.1], [mx, my, 22, 17, -1, 27.6, 0.7]], k.wd, k.wdL));
    parts.push(beams([[13, 7.5, 26, 13, 7.5, 12.6, 0.3]], k.iron, k.ironT));
    parts.push(beams([[8.6, 7.5, 11.8, 17.4, 7.5, 11.8, 1.7, 1.7]], k.wd, k.wdL));
    parts.push(deco(k.wdL, [It.disc(17.4, 7.5, 0.7, 11.8, 0, 0.5)], { flat: false }));
    flags(parts, k, [[mx, my, 31, 37, 5.5, -1]]);
    return { r: 34, h: 42, parts, style: 'unit', bevel: 0.7 };
  };

  /* ====================================================================
   * WARDSTONE — a carved Hrimgard runestone on a stepped round base: glowing
   * runes and aura pulse, an ice crystal grown into its crown, crystals at its
   * foot. r 11, h 34, 1 dir, anims 4.
   * ==================================================================== */
  M.ice_wardstone = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [];
    parts.push({ z0: 0, z1: 1.3, side: k.pl, top: k.plT, shape: (c) => S.blob(c, 0, 0.6, 9.4, 7, 12, 0.12), detail: (c, an) => { halo(c, k.gl, 0, 2, 9 + Math.sin(an * TAU) * 1.2, 0.18 + 0.1 * Math.sin(an * TAU)); snowPatch(c, -5, -6, 3.4, 3, rgba(k.sn, 0.8)); snowPatch(c, 5.5, -5.6, 2.6, 5, rgba(k.sn, 0.7)); } });
    parts.push({ z0: 1.3, z1: 2.8, side: k.stD, top: k.stT, shape: (c) => S.poly(c, ngon(0, 0.4, 6.4, 8, 0.2)), detail: (c) => { c.save(); c.strokeStyle = rgba(k.gl, 0.7); c.lineWidth = 0.35; c.beginPath(); c.arc(0, 0.4, 4.8, 0, TAU); c.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.lines(c, rgba(k.gl, 0.7), 0.35, [Math.cos(a) * 4.2, 0.4 + Math.sin(a) * 4.2, Math.cos(a) * 5.4, 0.4 + Math.sin(a) * 5.4]); } c.restore(); } });
    const H0 = 2.8, H1 = 28;
    const wx = (t) => 3.7 * (1 - 0.2 * t) * (t > 0.86 ? Math.sqrt(Math.max(0.05, 1 - Math.pow((t - 0.86) / 0.14, 2) * 0.75)) : 1), wy = (t) => 2.3 * (1 - 0.15 * t);
    const fy = (z) => wy((z - H0) / (H1 - H0));
    parts.push({ z0: H0, z1: H1, side: mix(k.st, k.stT, 0.15), top: k.stT, ao: 0.35, shape: (c, zt) => { const a = wx(zt), b = wy(zt), l = zt * 0.5; S.poly(c, [l - a, -b * 0.6, l - a * 0.7, -b, l + a * 0.75, -b, l + a, -b * 0.45, l + a * 0.9, b * 0.7, l + a * 0.55, b, l - a * 0.6, b, l - a, b * 0.5]); },
      detail: (c) => { S.lines(c, rgba(k.p.d, 0.35), 0.4, [-1.5, -0.5, 1, 0.8]); } });
    // runes: strokes in (x, z) on the front face
    const R = [];
    const glyph = (x, z, kind) => {
      const s = 1.6;
      R.push([x, z - s, x, z + s]);
      if (kind === 0) R.push([x, z + 0.2, x + 1, z + 1.1], [x, z - 0.8, x + 1, z + 0.1]);
      if (kind === 1) R.push([x, z + 0.5, x - 1, z + s], [x, z + 0.5, x + 1, z + s]);
      if (kind === 2) R.push([x, z + s, x + 1, z + 0.6], [x + 1, z + 0.6, x, z - 0.2], [x, z - 0.2, x + 1, z - s]);
      if (kind === 3) R.push([x, z + s, x - 1, z + 0.6], [x, z + s, x + 1, z + 0.6]);
    };
    glyph(-0.4, 8, 0); glyph(0, 13, 3); glyph(-0.3, 18, 2); glyph(0.2, 22.6, 1);
    const runeIts = R.map((s) => [Math.min(s[1], s[3]) - 0.25, Math.max(s[1], s[3]) + 0.25, (c, z) => { const dz = s[3] - s[1]; let t = Math.abs(dz) < 1e-4 ? 0.5 : (z - s[1]) / dz; t = U.clamp(t, 0, 1); const x = s[0] + (s[2] - s[0]) * t, sp = Math.abs(dz) < 1e-4 ? Math.abs(s[2] - s[0]) / 2 : Math.abs((s[2] - s[0]) / dz) * 0.28; const y = fy(z) + (z - H0) / (H1 - H0) * 0; fsl(c, x - sp - 0.28, x + sp + 0.28, y, 0.3, 0.42); }]);
    parts.push(deco(mix(k.st, k.p.d, 0.45), R.map((s) => [Math.min(s[1], s[3]) - 0.5, Math.max(s[1], s[3]) + 0.5, (c, z) => { const dz = s[3] - s[1]; let t = Math.abs(dz) < 1e-4 ? 0.5 : (z - s[1]) / dz; t = U.clamp(t, 0, 1); const x = s[0] + (s[2] - s[0]) * t, sp = Math.abs(dz) < 1e-4 ? Math.abs(s[2] - s[0]) / 2 : Math.abs((s[2] - s[0]) / dz) * 0.28; fsl(c, x - sp - 0.5, x + sp + 0.5, fy(z), 0.3, 0.36); }])));
    const pulse = [k.gl, mix(k.gl, '#ffffff', 0.35), mix(k.gl, '#ffffff', 0.7), mix(k.gl, '#ffffff', 0.35)];
    for (let i = 0; i < 4; i++) parts.push(deco(pulse[i], runeIts, { when: (an) => Math.round(an * 4) % 4 === i, ao: -0.2 }));
    const SS = [[-7.2, -3.4, 1.3, 7], [7.4, -2.6, 1.2, 6.2], [-6.6, 4.6, 1.1, 5], [6.8, 5, 1.2, 5.6]];
    parts.push(multi(SS, (q) => [1.3, 1.3 + q[3]], (c, q, lt) => { const w = q[2] * (lt > 0.8 ? 1 - (lt - 0.8) * 2.5 : 1) + 0.1; S.poly(c, [q[0] - w, q[1] - w * 0.6, q[0] + w * 0.8, q[1] - w * 0.7, q[0] + w, q[1] + w * 0.5, q[0] - w * 0.7, q[1] + w * 0.7]); }, { side: k.st, top: k.stT, ao: 0.3 }));
    parts.push(deco(k.gl, SS.map((q) => It.rect(q[0], q[1] + q[2] * 0.6, 0.45, 2.6, 1.3 + q[3] * 0.7, 0.3, 0.4)), { ao: -0.3 }));
    crystals(parts, k, [[0.5, 0, 1.8, 7, 0.3, 0, H1 - 1.6], [-1.3, 0.3, 1, 4, -1, 0.2, H1 - 1.2], [2, -0.2, 0.9, 3.4, 1, 0, H1 - 1.4],
      [-5.6, 3.6, 1.5, 5.4, -0.9, 0.5, 1.6], [-4, 5.2, 0.9, 3, -0.3, 0.6, 1.6], [5.4, 4.4, 1.3, 4.4, 0.7, 0.5, 1.6], [6, -2.6, 1.2, 4, 0.6, -0.3, 1.6]]);
    return { r: 11, h: 34, parts, style: 'unit', bevel: 0.75, spots: { rune: [0, 2.4, 16], crown: [0.5, 0, 31] } };
  };

  /* ====================================================================
   * ROOST — a raised round stone landing platform for the dragon: battered
   * coursed drum, claw-scarred paving with a rune ring, a front stair between
   * cheek walls, a stone perch pillar with an iron-shod timber crossbar ending in
   * dragon heads, banners round the rim, crystals and braziers.
   * r 36, h 42, 1 dir (anims 4).
   * ==================================================================== */
  M.ice_roost = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [], F = Fac(k);
    const cx = 0, cy = -3, R = 25, PH = 11;
    plinth(parts, k, 0, 1, 34, 0.8, 101, 1.6);
    parts.push({ z0: 1.6, z1: PH, side: k.st, top: mix(k.stT, k.p.a, 0.15), shape: (c, zt) => S.circ(c, cx, cy, R - zt * 1.4),
      detail: (c) => {
        c.save();
        c.strokeStyle = rgba(k.p.d, 0.32); c.lineWidth = 0.4; c.beginPath();
        for (const r of [7, 13.5, 19.5]) { c.moveTo(cx + r, cy); c.arc(cx, cy, r, 0, TAU); }
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; c.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7); c.lineTo(cx + Math.cos(a) * 23, cy + Math.sin(a) * 23); }
        c.stroke();
        c.strokeStyle = rgba(k.k2, 0.55); c.lineWidth = 0.6; c.beginPath(); c.arc(cx, cy, 16.5, 0, TAU); c.stroke();
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; S.lines(c, rgba(k.k2, 0.55), 0.45, [cx + Math.cos(a) * 15.6, cy + Math.sin(a) * 15.6, cx + Math.cos(a + 0.12) * 17.4, cy + Math.sin(a + 0.12) * 17.4]); }
        // claw scratches: sets of 3-4 gouges
        for (const g of [[-8, 4, 0.5], [9, 6, -0.4], [2, -9, 0.2], [-12, -6, 1.1], [12, -4, 2.2], [-3, 12, -0.9]]) for (let j = 0; j < 4; j++) { const ox = Math.cos(g[2] + 1.57) * j * 0.9, oy = Math.sin(g[2] + 1.57) * j * 0.9; S.lines(c, 'rgba(14,20,32,0.55)', 0.5, [g[0] + ox, g[1] + oy, g[0] + ox + Math.cos(g[2]) * 5, g[1] + oy + Math.sin(g[2]) * 5]); S.lines(c, 'rgba(255,255,255,0.25)', 0.3, [g[0] + ox + 0.25, g[1] + oy + 0.3, g[0] + ox + Math.cos(g[2]) * 5 + 0.25, g[1] + oy + Math.sin(g[2]) * 5 + 0.3]); }
        c.restore();
        for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.2); snowPatch(c, cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 2 + (i % 2), 40 + i, rgba(k.sn, 0.7)); }
      } });
    F.mas(masonryR(cx, cy, R - 0.6, 1.6, PH, 2.4, 9, 102));
    F.banner(-12.5, cy + Math.sqrt((R - 0.9) ** 2 - 156), 3.4, 3, 10).banner(12.5, cy + Math.sqrt((R - 0.9) ** 2 - 156), 3.4, 3, 10);
    F.flush(parts);
    // front stair between cheek walls
    const sy0 = cy + R - 3.5, n = 5, sd = 1.9, shh = (PH - 1.6) / n;
    parts.push({ z0: 1.6, z1: PH, side: k.stD, top: k.stT, shape: (c, zt) => { const z = 1.6 + zt * (PH - 1.6); const m = Math.min(n, Math.floor((PH - z) / shh + 1e-6) + 1); c.rect(-5, sy0, 10, m * sd); } });
    parts.push({ z0: 1.6, z1: PH + 1.2, side: k.st, top: k.sn, shape: (c, zt) => { const z = 1.6 + zt * (PH + 1.2 - 1.6); const L = Math.max(0.6, (PH + 1.2 - z) / (PH - 0.4) * n * sd); c.rect(-6.6, sy0 - 0.5, 1.6, L + 0.5); c.rect(5, sy0 - 0.5, 1.6, L + 0.5); } });
    // perch: stone pillar + timber crossbar with dragon-head ends
    const py = cy - 11;
    parts.push({ z0: PH, z1: PH + 2, side: k.stD, top: k.stT, shape: (c) => S.poly(c, ngon(0, py, 5, 8, 0.2)) });
    parts.push({ z0: PH + 2, z1: 31, side: k.st, top: k.stT, shape: (c, zt) => S.poly(c, ngon(0, py, 3.4 - zt * 0.7, 8, 0.2)) });
    parts.push(deco(k.stD, masonryR(0, py, 3, PH + 2, 31, 3, 3, 103)));
    parts.push(beams([[-10, py, 31.6, 10, py, 31.6, 2.2, 2.2]], k.wd, k.wdL, { detail: (c) => { for (let i = 0; i < 4; i++) S.lines(c, 'rgba(20,16,12,0.6)', 0.35, [-6 + i * 0.8, py - 1, -5 + i * 0.8, py + 1]); } }));
    parts.push(deco(k.iron, [It.rect(-9, py + 1.1, 1, 30.5, 32.7), It.rect(9, py + 1.1, 1, 30.5, 32.7), It.rect(-3, py + 1.1, 0.8, 30.5, 32.7), It.rect(3, py + 1.1, 0.8, 30.5, 32.7)]));
    parts.push(hornsX(k, -10, 10, py, 32.6, 4.5));
    crystalsR(parts, k, [[-25.5, 3, 2.4, 10, -1, 0.3, 1.6], [-23.4, 7.4, 1.4, 6, -0.6, 0.6, 1.6], [25.5, 1, 2.6, 11, 1, 0.3, 1.6], [23.6, 6, 1.5, 6.5, 0.6, 0.6, 1.6]]);
    braziers(parts, k, [[-9, sy0 + n * sd + 2.4], [9, sy0 + n * sd + 2.4]], 1.6, 1);
    flags(parts, k, [[-17, cy - 16, PH, PH + 13, 7, -1], [17, cy - 16, PH, PH + 13, 7, 1], [-21, cy + 9, PH, PH + 11, 6, -1], [21, cy + 9, PH, PH + 11, 6, 1]]);
    return { r: 36, h: 42, parts, style: 'unit', bevel: 0.75, spots: { land: [cx, cy + 4, PH], perch: [0, py, 33] } };
  };

  /* ====================================================================
   * WALL — 16-direction segment, 40 long along x, ~7 thick.
   *  L1 timber palisade: sharpened logs with snow caps, lashing bands, stone footing
   *  L2 battered blue-grey stone with snow-capped merlons on both edges
   *  L3 thicker stone reinforced with ice-crystal buttresses on both faces, a frost
   *     rune band and crystal spikes on the parapet.
   * r 22, h 16 / 19 / 24.
   * ==================================================================== */
  M.ice_wall = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), L = U.clamp((opt.level | 0) || 1, 1, 3);
    const parts = [];
    const drift = (h, w) => ({ z0: 0, z1: h, side: mix(k.sn, k.p.a, 0.14), top: k.snL, ao: 0.18, bevel: false, at: [0, 0], shape: (c, zt) => { const e = w * (1 - zt * 0.7); S.rrect(c, -20.4, -e, 40.8, e * 2, e * 0.9); } });
    if (L === 1) {
      parts.push({ z0: 0, z1: 1.4, side: k.pl, top: k.plT, at: [0, 0], shape: (c) => S.rrect(c, -20.4, -3, 40.8, 6, 2) });
      parts.push(drift(2.2, 3.4));
      const logs = []; for (let i = 0; i < 19; i++) logs.push([-19 + i * 2.11, (U.hash2(i, 5, 1) - 0.5) * 0.5, 12.4 + U.hash2(i, 7, 1) * 2.2, 1.02 + U.hash2(i, 9, 1) * 0.12]);
      parts.push({ z0: 1, z1: 15, side: k.wd, top: k.snL, ao: 0.32, at: [0, 0], shape: (c, zt) => { const z = 1 + zt * 14; for (const q of logs) { if (z > q[2]) continue; const t = q[2] - z, r = t < 2 ? q[3] * (t / 2) * 0.9 + 0.08 : q[3]; S.circ(c, q[0], q[1], r); } } });
      // snow caps on the tips
      parts.push({ z0: 11.6, z1: 15, side: k.snL, top: k.snL, flat: true, ao: 0.1, bevel: false, at: [0, 0], shape: (c, zt) => { const z = 11.6 + zt * 3.4; for (const q of logs) { const t = q[2] - z; if (t < 0 || t > 1.1) continue; S.circ(c, q[0] - 0.15, q[1] - 0.1, q[3] * (t / 2) * 0.95 + 0.2); } } });
      parts.push({ z0: 4, z1: 10.6, side: k.wdD, top: k.wdD, ao: 0, bevel: false, at: [0, 0], shape: (c, zt) => { if (zt > 0.12 && zt < 0.88) return; c.rect(-20, -1.35, 40, 2.7); } });
      // back props (struts) on the -y side
      parts.push(beams([[-12, -5.2, 1, -12, -1, 9, 0.9], [0, -5.2, 1, 0, -1, 9, 0.9], [12, -5.2, 1, 12, -1, 9, 0.9]], sh(k.wd, -0.15), k.wdL, { at: [0, -3] }));
      return { r: 22, h: 16, parts: withSorter(parts), style: 'unit', bevel: 0.7 };
    }
    const T = L === 2 ? 3.4 : 4, H = L === 2 ? 15 : 17, bat = 0.6;
    parts.push({ z0: 0, z1: 1.4, side: k.pl, top: k.plT, at: [0, 0], shape: (c) => c.rect(-20.4, -T - 1.2, 40.8, (T + 1.2) * 2) });
    parts.push(drift(1.8, T + 1.6));
    parts.push({ z0: 1.4, z1: H, side: k.st, top: k.sn, at: [0, 0], shape: (c, zt) => { const b = bat * zt; c.rect(-20, -T + b, 40, (T - b) * 2); } });
    const yf = (z) => T - bat * (z - 1.4) / (H - 1.4);
    parts.push(face2(k.stD, masonry2(-19.6, 19.6, 1.4, H, 2.8, 4.8, 13 + L), yf, { at: [0, 0] }));
    if (L === 3) parts.push(face2(k.gl, [[7.6, 8.6, (d) => { for (let x = -18; x < 18; x += 4) d(x, x + 2.4, 0.3, 0.45); }], [7, 9.2, (d) => { for (let x = -16.2; x < 18; x += 4) d(x - 0.3, x + 0.3, 0.3, 0.45); }]], yf, { at: [0, 0], ao: -0.3 }));
    parts.push({ z0: H, z1: H + 2.6, side: k.st, top: k.sn, ao: 0.15, at: [0, 0], shape: (c) => { const tt = T - bat - 0.1; for (let x = -19.5; x < 19; x += 3.9) { c.rect(x, -tt, 2.3, 1.5); c.rect(x, tt - 1.5, 2.3, 1.5); } } });
    if (L === 3) {
      crystalsR(parts, k, [[-12, T + 1.2, 2.2, 11, 0, 0.6, 1.4], [-10, T + 1.6, 1.3, 6, 0.4, 0.7, 1.4], [3, T + 1.2, 2.4, 12, 0, 0.6, 1.4], [14, T + 1.3, 2, 10, 0.3, 0.6, 1.4]], [0, T + 1.4]);
      crystalsR(parts, k, [[-14, -T - 1.2, 2, 10, 0, -0.6, 1.4], [-3, -T - 1.2, 2.4, 12, 0, -0.6, 1.4], [11, -T - 1.2, 2.2, 11, 0, -0.6, 1.4], [13, -T - 1.6, 1.3, 6, 0.4, -0.7, 1.4]], [0, -T - 1.4]);
      crystalsR(parts, k, [[-17.6, 0, 1.2, 5.5, 0, 0, H], [-6, 0, 1.4, 6.5, 0, 0, H], [6, 0, 1.4, 6.5, 0, 0, H], [17.6, 0, 1.2, 5.5, 0, 0, H]], [0, 0.01]);
    }
    return { r: 22, h: L === 2 ? 19 : 24, parts: withSorter(parts), style: 'unit', bevel: 0.75 };
  };

  /* ====================================================================
   * GATE — 16-direction town gate, 40 wide along x, two gate towers.
   *  L1 log-cabin gate towers under snow pyramids, log gate leaves, walkway beam
   *  L2 battered stone towers with merlons, stone bridge over iron-strapped doors
   *  L3 taller towers sprouting ice-crystal spires, a glowing ice gate (frost portcullis)
   * r 23, h 30 / 30 / 44.
   * ==================================================================== */
  M.ice_gate = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), L = U.clamp((opt.level | 0) || 1, 1, 3);
    const parts = [];
    const TX = 14.5, TW = L === 1 ? 4.8 : 5.4, TH = L === 1 ? 17 : L === 2 ? 22 : 26, GW = TX - TW;
    parts.push({ z0: 0, z1: 1.4, side: k.pl, top: k.plT, at: [0, 0], shape: (c) => S.rrect(c, -20.6, -6.4, 41.2, 12.8, 2.4) });
    for (const sg of [-1, 1]) {
      const x = sg * TX, at = [x, 0];
      if (L === 1) {
        parts.push({ z0: 1.4, z1: TH, side: k.wd, top: k.wdL, at, shape: (c) => c.rect(x - TW, -TW, TW * 2, TW * 2) });
        // horizontal log courses on every visible face
        parts.push({ z0: 1.4, z1: TH, side: k.wdD, top: k.wdD, flat: true, bevel: false, at, shape: (c, zt) => { const z = 1.4 + zt * (TH - 1.4); if ((z % 1.9) > 0.5) return; for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (facing(c, nx, ny) > 0.05) { if (nx) c.rect(x + nx * TW - 0.3 * nx - 0.3, -TW, 0.6, TW * 2); else c.rect(x - TW, ny * TW - 0.3, TW * 2, 0.6); } } });
        parts.push({ z0: TH - 0.6, z1: TH + 0.6, side: mix(k.sn, k.p.a, 0.12), top: k.snL, bevel: false, at, shape: (c) => S.rrect(c, x - TW - 1.9, -TW - 1.9, TW * 2 + 3.8, TW * 2 + 3.8, 1) });
        parts.push({ z0: TH, z1: TH + 9, side: mix(k.sn, k.p.a, 0.22), top: k.snL, ao: 0.18, bevel: false, at, shape: (c, zt) => { const w = (TW + 1.6) * Math.pow(1 - zt, 1.1) + 0.1; c.rect(x - w, -w, w * 2, w * 2); } });
        parts.push({ z0: TH + 0.2, z1: TH + 6.6, side: mix(k.sn, k.p.a, 0.45), top: k.snS, flat: true, bevel: false, at: [x, 0.01], shape: (c, zt) => { const pz = (0.2 + zt * 6.4) / 9, w = (TW + 1.6) * Math.pow(1 - pz, 1.1) - 0.15; for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.circ(c, x + px * w, py * w, 0.32); } });
      } else {
        parts.push({ z0: 1.4, z1: TH, side: k.st, top: k.stT, at, shape: (c, zt) => { const b = zt * 0.9; c.rect(x - TW + b, -TW + b, (TW - b) * 2, (TW - b) * 2); } });
        parts.push(face2(k.stD, masonry2(x - TW + 0.6, x + TW - 0.6, 1.4, TH, 2.8, 3.4, 20 + sg), (z) => TW - 0.9 * (z - 1.4) / (TH - 1.4), { at }));
        parts.push(face2(k.win, [[TH - 9, TH - 4.5, (d) => d(x - 0.45, x + 0.45)], [7, 10.5, (d) => d(x - 0.45, x + 0.45)]], (z) => TW - 0.9 * (z - 1.4) / (TH - 1.4), { at }));
        parts.push({ z0: TH, z1: TH + 2.6, side: k.st, top: k.sn, ao: 0.15, at, shape: (c) => { const e = TW - 0.9 + 0.4; for (const [px, py, w, h] of [[-e, -e, 2.2, 1.5], [e - 2.2, -e, 2.2, 1.5], [-e, e - 1.5, 2.2, 1.5], [e - 2.2, e - 1.5, 2.2, 1.5], [-1.1, -e, 2.2, 1.5], [-1.1, e - 1.5, 2.2, 1.5], [-e, -1.1, 1.5, 2.2], [e - 1.5, -1.1, 1.5, 2.2]]) c.rect(x + px, py, w, h); } });
        parts.push({ z0: TH - 0.4, z1: TH + 0.2, side: k.stD, top: mix(k.stT, k.sn, 0.4), bevel: false, at, shape: (c) => c.rect(x - TW + 1.4, -TW + 1.4, (TW - 1.4) * 2, (TW - 1.4) * 2) });
        if (L === 3) crystalsR(parts, k, [[x, 0, 2.6, 16, 0, 0, TH], [x - sg * 2.2, 1.6, 1.4, 8, -sg * 1.2, 0.8, TH], [x + sg * 1.4, -2, 1.5, 9, sg * 0.8, -1, TH], [x + sg * (TW + 1), 3, 1.6, 8, sg * 0.8, 0.6, 1.4], [x + sg * (TW + 1), -3, 1.6, 8, sg * 0.8, -0.6, 1.4]], at);
      }
    }
    // gate leaves between the towers + bridge / walkway
    const DH = L === 1 ? 11 : L === 2 ? 13 : 15;
    if (L === 3) {
      parts.push({ z0: 1.4, z1: DH, side: mix(k.ice, k.gl, 0.25), top: k.iceL, flat: true, ao: -0.3, at: [0, 0], shape: (c) => c.rect(-GW, -0.8, GW * 2, 1.6) });
      parts.push(face2(k.glH, [[1.4, DH, (d, z) => { for (let x = -GW + 1.6; x < GW; x += 2.6) d(x - 0.3, x + 0.3, 0.3, 0.4); }], [5, 5.6, (d) => d(-GW, GW, 0.3, 0.4)], [10, 10.6, (d) => d(-GW, GW, 0.3, 0.4)]], () => 0.8, { at: [0, 0], ao: -0.2 }));
    } else {
      parts.push({ z0: 1.4, z1: DH + (L === 1 ? 2 : 0), side: k.wd, top: k.wdL, at: [0, 0], shape: (c, zt) => { if (L === 1) { const z = 1.4 + zt * (DH + 2 - 1.4); for (let x = -GW + 0.9; x < GW; x += 1.8) { const t = DH + 2 - z - ((x * 7) % 1.2 + 1.2); const r = t < 1.6 ? Math.max(0.1, 0.9 * t / 1.6) : 0.9; if (t > -0.2) S.circ(c, x, 0, r); } } else c.rect(-GW, -0.8, GW * 2, 1.6); } });
      parts.push(face2(k.iron, [[3.6, 4.2, (d) => d(-GW, GW, 0.3, 0.4)], [DH - 3.4, DH - 2.8, (d) => d(-GW, GW, 0.3, 0.4)], [1.4, DH, (d) => d(-0.25, 0.25, 0.3, 0.45)]], () => (L === 1 ? 1 : 0.8), { at: [0, 0] }));
    }
    if (L === 1) {
      parts.push({ z0: DH + 1.4, z1: DH + 3.2, side: k.wd, top: k.snL, at: [0, 0.01], shape: (c) => c.rect(-GW - 0.5, -2.6, GW * 2 + 1, 5.2) });
      parts.push({ z0: DH + 3.2, z1: DH + 6, side: k.wdD, top: k.wd, bevel: false, at: [0, 0.01], shape: (c, zt) => { for (let x = -GW + 0.4; x < GW; x += 2.4) { c.rect(x, 2.1, 0.5, 0.5); c.rect(x, -2.6, 0.5, 0.5); } if (zt > 0.75) { c.rect(-GW, 2.1, GW * 2, 0.5); c.rect(-GW, -2.6, GW * 2, 0.5); } } });
    } else {
      const BT = TW - 1.2, BZ = DH + (L === 3 ? 1.5 : 0);
      parts.push({ z0: BZ, z1: TH - 3, side: k.st, top: k.sn, at: [0, 0.01], shape: (c) => c.rect(-GW - 0.2, -BT, GW * 2 + 0.4, BT * 2) });
      parts.push(face2(k.stL, [[BZ - 0.01, BZ + 1.2, (d) => d(-GW, GW, 0.6, 0.5)]], () => BT, { at: [0, 0.01], flat: false }));
      if (L === 3) parts.push(face2(k.gl, [[DH + 0.3, BZ - 0.2, (d) => d(-GW + 0.6, GW - 0.6, 0.3, 0.3)]], () => BT - 0.4, { at: [0, 0.01], ao: -0.3 }));
      parts.push({ z0: TH - 3, z1: TH - 0.6, side: k.st, top: k.sn, ao: 0.15, at: [0, 0.02], shape: (c) => { for (let x = -GW + 0.4; x < GW - 1; x += 3.4) { c.rect(x, -BT, 2, 1.4); c.rect(x, BT - 1.4, 2, 1.4); } } });
    }
    // braziers on the outer faces of the towers (both sides of the wall)
    return { r: 24, h: L === 3 ? 44 : L === 2 ? 30 : 26, parts: withSorter(parts), style: 'unit', bevel: 0.75 };
  };

  /* ====================================================================
   * BALLISTA — 24-direction anti-dragon ballista on a round stone platform:
   * timber turntable, long stock, recurved bow with ice-crystal tips, taut string,
   * winch, and a loaded ice-headed bolt; a small k pennant. +x = aim. r 14, h 13.
   * ==================================================================== */
  M.ice_ballista = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [];
    parts.push({ z0: 0, z1: 2.6, side: k.st, top: k.stT, at: [0, 0], shape: (c, zt) => S.circ(c, 0, 0, 10 - zt * 0.6),
      detail: (c) => { c.save(); c.strokeStyle = rgba(k.p.d, 0.4); c.lineWidth = 0.4; c.beginPath(); c.arc(0, 0, 7.2, 0, TAU); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.moveTo(Math.cos(a) * 7.2, Math.sin(a) * 7.2); c.lineTo(Math.cos(a) * 9.3, Math.sin(a) * 9.3); } c.stroke(); c.restore(); snowPatch(c, -6, -5, 2, 3, rgba(k.sn, 0.7)); snowPatch(c, 5, 6, 1.6, 5, rgba(k.sn, 0.6)); } });
    parts.push({ z0: 2.6, z1: 3.6, side: k.wdD, top: k.wdL, at: [0, 0], shape: (c) => S.circ(c, 0, 0, 6.2), detail: (c) => { S.lines(c, rgba(k.wdD, 0.6), 0.35, [-6, -2, 6, -2, -6, 2, 6, 2]); c.save(); c.strokeStyle = k.iron; c.lineWidth = 0.45; c.beginPath(); c.arc(0, 0, 5.7, 0, TAU); c.stroke(); c.restore(); } });
    parts.push({ z0: 3.6, z1: 6.4, side: k.wd, top: k.wdL, at: [0, 0], shape: (c) => { c.rect(-2.6, -2, 5, 4); } });
    parts.push(beams([[-2, -1.8, 3.6, 2.5, -0.8, 6.6, 0.7], [-2, 1.8, 3.6, 2.5, 0.8, 6.6, 0.7]], k.wdD, k.wd, { at: [0, 0] }));
    // stock
    parts.push({ z0: 6.4, z1: 7.8, side: k.wd, top: k.wdL, at: [0, 0], shape: (c) => S.poly(c, [-8, -1, 8.5, -0.8, 9.2, 0, 8.5, 0.8, -8, 1]), detail: (c) => { S.lines(c, rgba(k.wdD, 0.8), 0.35, [-7.6, 0, 8, 0]); S.lines(c, k.iron, 0.5, [5.5, -0.9, 5.5, 0.9, -2, -0.95, -2, 0.95]); } });
    // winch at the back
    parts.push({ z0: 6, z1: 9, side: k.wdD, top: k.wd, at: [-6.6, 0], shape: (c, zt) => { const w = 1.5 * Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 2 - 1, 2))); c.rect(-6.6 - w, -2.8, w * 2, 5.6); c.rect(-7.2, -3.4, 1.2, 0.6); c.rect(-7.2, 2.8, 1.2, 0.6); } });
    parts.push(beams([[-6.6, -3.1, 7.5, -8.4, -3.1, 9.8, 0.45], [-6.6, 3.1, 7.5, -4.8, 3.1, 9.8, 0.45]], k.iron, k.ironT, { at: [-6.6, 0] }));
    // recurved bow
    const bowPts = []; for (let i = 0; i <= 12; i++) { const y = -8 + i * (16 / 12), u = y / 8; bowPts.push([5.2 - u * u * 2.4 + (Math.abs(u) > 0.8 ? (Math.abs(u) - 0.8) * 4 : 0), y]); }
    parts.push({ z0: 7, z1: 8.8, side: k.wd, top: k.wdL, stroke: 1.5, bevel: false, at: [5, 0], shape: (c) => { c.moveTo(bowPts[0][0], bowPts[0][1]); for (const p of bowPts) c.lineTo(p[0], p[1]); } });
    parts.push({ z0: 7, z1: 8.8, side: k.iron, top: k.ironT, at: [5, 0.01], shape: (c) => { c.rect(4.4, -1.4, 1.8, 2.8); } });
    // string to the nock
    parts.push({ z0: 7.7, z1: 8.1, side: k.p.b, top: '#ffffff', stroke: 0.3, bevel: false, flat: true, at: [0, 0], shape: (c) => { const a = bowPts[1], b = bowPts[11]; c.moveTo(a[0], a[1]); c.lineTo(-3.4, 0); c.lineTo(b[0], b[1]); } });
    // bolt with an ice head + fletching
    parts.push({ z0: 8, z1: 9, side: k.wdL, top: mix(k.wdL, '#ffffff', 0.3), stroke: 0.65, bevel: false, at: [2, 0], shape: (c) => S.seg(c, -3.6, 0, 10.4, 0) });
    parts.push({ z0: 7.9, z1: 9, side: k.k, top: k.k2, bevel: false, at: [2, 0], shape: (c) => { S.poly(c, [-3.8, 0, -2, 0.2, -1.6, 1, -3.4, 0.9]); S.poly(c, [-3.8, 0, -2, -0.2, -1.6, -1, -3.4, -0.9]); } });
    parts.push({ z0: 7.6, z1: 9.3, side: mix(k.ice, k.gl, 0.3), top: k.iceL, flat: true, bevel: false, at: [11, 0], shape: (c, zt) => { const r = 0.95 * Math.sin(Math.max(0.15, zt) * Math.PI) + 0.1; S.poly(c, [10.2, -r, 12.9, 0, 10.2, r, 9.8, 0]); } });
    // ice tips on the bow ends
    parts.push({ z0: 7, z1: 9.6, side: mix(k.ice, '#ffffff', 0.3), top: k.iceL, flat: true, bevel: false, at: [5, 0.02], shape: (c, zt) => { const r = 0.7 * (1 - zt) + 0.1; for (const p of [bowPts[0], bowPts[12]]) S.circ(c, p[0] + 0.4, p[1] * 1.04, r); } });
    // pennant on the winch frame
    parts.push({ z0: 9, z1: 14, side: k.wdD, top: k.wd, stroke: 0.45, bevel: false, at: [-8, -3], shape: (c) => S.seg(c, -8.2, -3.2, -8.19, -3.2) });
    parts.push({ z0: 11.6, z1: 13.8, side: k.k, top: k.k2, stroke: 0.4, flat: true, ao: 0.2, bevel: false, at: [-8, -3], shape: (c, zt) => { c.moveTo(-8.2, -3.2); c.lineTo(-10.2, -3.6 + (1 - zt) * 0.3); c.lineTo(-12, -3.4); } });
    return { r: 14, h: 15, parts: withSorter(parts), style: 'unit', bevel: 0.7, spots: { muzzle: [12.9, 0, 8.5] } };
  };

  /* ====================================================================
   * CATAPULT — 24-direction torsion catapult on a timber sled base: A-frames,
   * a twisted-rope torsion bundle, a padded crossbar stop and a throwing arm with
   * a bucket holding a glowing ice boulder. +x = throw direction.
   * anims 3: 0 cocked (arm down at the back) → 1 swinging up → 2 released.
   * r 17, h 26.
   * ==================================================================== */
  M.ice_catapult = function (pal, opt) {
    opt = opt || {};
    const k = K(pal), parts = [];
    const PZ = 9.6, PX = -1;
    parts.push({ z0: 0, z1: 1.2, side: k.pl, top: k.plT, at: [0, 0], shape: (c) => S.rrect(c, -12, -6.6, 24, 13.2, 2.4), detail: (c) => { snowPatch(c, -9, -5, 1.8, 2, rgba(k.sn, 0.7)); snowPatch(c, 9, 5, 1.6, 4, rgba(k.sn, 0.6)); } });
    // sled base: side rails, cross beams, stone weights
    parts.push(beams([[-11, -4.6, 1.8, 11, -4.6, 1.8, 1.4, 1.4], [-11, 4.6, 1.8, 11, 4.6, 1.8, 1.4, 1.4]], k.wd, k.wdL, { at: [0, 0] }));
    parts.push(beams([[-9, -5.2, 2.9, -9, 5.2, 2.9, 1.2, 1], [8.6, -5.2, 2.9, 8.6, 5.2, 2.9, 1.2, 1], [PX, -5.2, 2.9, PX, 5.2, 2.9, 1.2, 1]], k.wdD, k.wd, { at: [0, 0] }));
    parts.push({ z0: 3.4, z1: 6, side: k.stD, top: k.stT, at: [-9, 0], shape: (c) => { S.blob(c, -9.6, -1.6, 1.6, 3, 7, 0.2); S.blob(c, -9.4, 1.8, 1.5, 6, 7, 0.2); } });
    // A-frames on both sides
    for (const sg of [-1, 1]) {
      const y = sg * 4.6;
      parts.push(beams([[PX - 5.5, y, 2.4, PX, y, PZ + 0.6, 1.1], [PX + 5.5, y, 2.4, PX, y, PZ + 0.6, 1.1], [PX + 5.2, y, 2.4, PX + 4.6, y, 15.5, 1], [PX - 4, y, 5.4, PX + 4, y, 5.4, 0.8, 0.8]], k.wd, k.wdL, { at: [0, y] }));
      parts.push({ z0: PZ - 1.6, z1: PZ + 1.6, side: k.iron, top: k.ironT, at: [0, y * 1.01], shape: (c) => c.rect(PX - 1.2, y - 0.9, 2.4, 1.8) });
    }
    // torsion bundle (twisted rope across the frame)
    parts.push({ z0: PZ - 1.5, z1: PZ + 1.5, side: '#7a6a52', top: '#a8967a', at: [0, 0], shape: (c, zt) => { const w = 1.5 * Math.sqrt(Math.max(0.05, 1 - Math.pow(zt * 2 - 1, 2))); c.rect(PX - w, -4, w * 2, 8); }, detail: (c) => S.lines(c, 'rgba(60,46,30,0.7)', 0.3, [PX - 1, -3, PX + 1, -2, PX - 1, -1, PX + 1, 0, PX - 1, 1, PX + 1, 2, PX - 1, 3, PX + 1, 4]) });
    // padded crossbar stop
    parts.push(beams([[PX + 4.6, -5, 15.2, PX + 4.6, 5, 15.2, 1.4, 1.4]], k.wd, k.wdL, { at: [PX + 4.6, 0] }));
    parts.push({ z0: 14.2, z1: 16.4, side: k.kD, top: k.k, at: [PX + 4.7, 0.01], shape: (c, zt) => c.rect(PX + 3.6, -2, 2, 4) });
    // throwing arm per pose: tip position in x-z
    const POSE = [[-11.5, 3.6], [-4.4, 21.5], [6.2, 19.6]];
    const pose = (an) => POSE[Math.round(an * 3) % 3];
    const armShape = (c, zt, an, w, z0, z1) => { const [tx, tz] = pose(an), z = z0 + zt * (z1 - z0); beamShape(c, [PX + (PX - tx) * 0.18, 0, PZ + (PZ - tz) * 0.18, tx, 0, tz, w, 1.2], z); };
    parts.push({ z0: 2, z1: 24, side: k.wdL, top: mix(k.wdL, '#ffffff', 0.25), bevel: false, at: [0, 0.02], shape: (c, zt, an) => armShape(c, zt, an, 1.6, 2, 24) });
    // bucket + ice boulder
    const bucket = (an) => { const [tx, tz] = pose(an), dx = tx - PX, dz = tz - PZ, l = Math.hypot(dx, dz); return [tx + dx / l * 0.6, tz + dz / l * 0.6]; };
    parts.push({ z0: 1.5, z1: 26, side: k.wdD, top: k.wd, bevel: false, at: [0, 0.03], shape: (c, zt, an) => { const [bx, bz] = bucket(an), z = 1.5 + zt * 24.5; if (Math.abs(z - bz) < 1.1) S.circ(c, bx, 0, 1.9 - Math.abs(z - bz) * 0.4); } });
    parts.push({ z0: 2, z1: 28, side: mix(k.ice, k.gl, 0.25), top: k.iceL, flat: true, ao: -0.3, bevel: false, at: [0, 0.04], shape: (c, zt, an) => { if (Math.round(an * 3) % 3 === 2) return; const [bx, bz] = bucket(an), z = 2 + zt * 26, d = z - (bz + 1.2); if (Math.abs(d) > 2.2) return; const r = Math.sqrt(2.2 * 2.2 - d * d) + 0.1; S.poly(c, [bx - r, 0, bx - r * 0.3, -r * 0.9, bx + r * 0.7, -r * 0.6, bx + r, r * 0.2, bx + r * 0.2, r * 0.9, bx - r * 0.7, r * 0.6]); } });
    return { r: 17, h: 28, parts: withSorter(parts), style: 'unit', bevel: 0.7, spots: { release: [6.8, 0, 21.5] } };
  };

  (AS.Gallery = AS.Gallery || []).push({ group: 'Ice buildings', bg: 'ice', items: [
    { name: 'keep L1', gen: 'ice_keep', pal: 'ice', opt: { level: 1 }, anims: 4 },
    { name: 'keep L2', gen: 'ice_keep', pal: 'ice', opt: { level: 2 }, anims: 4 },
    { name: 'keep L3', gen: 'ice_keep', pal: 'ice', opt: { level: 3 }, anims: 4 },
    { name: 'house v0', gen: 'ice_house', pal: 'ice', opt: { v: 0 } },
    { name: 'house v1', gen: 'ice_house', pal: 'ice', opt: { v: 1 } },
    { name: 'house v2', gen: 'ice_house', pal: 'ice', opt: { v: 2 } },
    { name: 'house v3', gen: 'ice_house', pal: 'ice', opt: { v: 3 } },
    { name: 'barracks', gen: 'ice_barracks', pal: 'ice', anims: 4 },
    { name: 'farm', gen: 'ice_farm', pal: 'ice' },
    { name: 'stable', gen: 'ice_stable', pal: 'ice', anims: 4 },
    { name: 'mage tower', gen: 'ice_magetower', pal: 'ice', anims: 4 },
    { name: 'archer tower', gen: 'ice_tower', pal: 'ice', anims: 4 },
    { name: 'watchtower', gen: 'ice_watchtower', pal: 'ice', anims: 4 },
    { name: 'temple', gen: 'ice_temple', pal: 'ice', anims: 4 },
    { name: 'market', gen: 'ice_market', pal: 'ice', anims: 4 },
    { name: 'workshop', gen: 'ice_workshop', pal: 'ice', anims: 4 },
    { name: 'wardstone', gen: 'ice_wardstone', pal: 'ice', anims: 4 },
    { name: 'roost', gen: 'ice_roost', pal: 'ice', anims: 4 },
    { name: 'wall L1', gen: 'ice_wall', pal: 'ice', opt: { level: 1 }, dirs: 16 },
    { name: 'wall L2', gen: 'ice_wall', pal: 'ice', opt: { level: 2 }, dirs: 16 },
    { name: 'wall L3', gen: 'ice_wall', pal: 'ice', opt: { level: 3 }, dirs: 16 },
    { name: 'gate L1', gen: 'ice_gate', pal: 'ice', opt: { level: 1 }, dirs: 16 },
    { name: 'gate L2', gen: 'ice_gate', pal: 'ice', opt: { level: 2 }, dirs: 16 },
    { name: 'gate L3', gen: 'ice_gate', pal: 'ice', opt: { level: 3 }, dirs: 16 },
    { name: 'ballista', gen: 'ice_ballista', pal: 'ice', dirs: 24 },
    { name: 'catapult', gen: 'ice_catapult', pal: 'ice', dirs: 24, anims: 3 },
  ] });
})(window.AS);
