/* WYRMCROWN — terrain decor: trees, undergrowth, rocks, ice, cursed props and wheat.
 * Every generator is AS.Models.<gen>(pal, opt) -> { r, h, style: 'decor', parts },
 * rendered as a 1-direction, 1-frame sheet and baked into terrain chunks by the
 * hundreds, so the forms are chunky and the seeded variety is wide.
 *
 * opt.seed   integer variant (any integer works; 0..7 are tuned and distinct)
 * opt.scale  optional size multiplier (default 1)
 * opt.tint   foliage preset for leafy trees and bushes:
 *            'summer' | 'emerald' | 'autumn' | 'dark' | 'spring' (each seed picks a hue)
 * pal        mostly ignored (natural colours). Optional overrides, read when present:
 *            pal.leafA (foliage dark), pal.leafB (foliage light), pal.bark, pal.tint.
 *            The same keys are accepted on opt. Faction palettes (no leaf keys) fall
 *            back to the natural defaults.
 *
 * Extra per-gen options: tree_oak opt.form 0-4 (round, broad, twin-lobed, tall,
 * lopsided); tree_fruit opt.fruit 'apple'|'pear'|'plum'|'orange'|'bloom';
 * tree_birch opt.trunks 1-3; tree_dead opt.form 0-3 (claw, gnarled, snag, leaning);
 * tree_elder opt.glow (colour); bush_berry opt.berry 'red'|'blue'|'purple'|'orange'|
 * 'white'; flowers opt.col (name, hex or 'mix'); stump opt.kind 'cut'|'broken'|
 * 'mossy'|'old'; rocks opt.size (5-16); rock_dark opt.glow (true or colour);
 * mushrooms_glow opt.col; wheat opt.n (sheaves).
 *
 * Crown technique: a crown is 3-5 tiers of scalloped leaf clumps on a foreshortened
 * footprint (y × 0.8, so crowns read round instead of as tall columns). Each tier is
 * one part whose clumps are short domes with staggered start heights, so every clump
 * shows a lit top over a darker wall crescent without the tiers lining up into
 * terraces. The lowest tier is a wide dark underside ring; higher tiers shrink, drift
 * toward the light (top-left) and brighten. Each tier's top face gets a crown-wide
 * light gradient, a per-clump lit cap / shade crescent and dappled leaf dabs.
 * Wall paint (strokes on the camera-facing edges, swept up as the forge stacks
 * slices) gives pines their lit/shaded needle flanks, snow its blue shade and rocks
 * their facets. Stroked 3-D polylines (limbPart) draw branches, roots and blades. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models = AS.Models || {};
  const clamp = U.clamp, lerp = U.lerp;

  /* ================================================================ helpers */
  const rngOf = (seed, salt) => new U.RNG(((seed | 0) * 7919 + (salt | 0) * 104729 + 1013) >>> 0);
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const mix = (a, b, t) => hx(C.mix(a, b, t));
  const shade = (c, f) => hx(C.shade(c, f));
  const rgba = (c, a) => C.str(c, a);
  const lum = (c) => { const v = C.hex(c); return (v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11) / 255; };

  // Radius factor up a dome: b0 at the base, full width at f, easing to e at the top.
  const dome = (b0, f, e) => (zt) => (zt < f ? lerp(b0, 1, Math.sin((zt / f) * Math.PI / 2))
    : lerp(e, 1, Math.sqrt(Math.max(0, 1 - Math.pow((zt - f) / (1 - f), 2)))));

  /* Scalloped leaf clump: a ring of outward bulging arcs (clockwise, so many
   * clumps in one path union under the nonzero rule). */
  function puff(c, x, y, r, seed, n) {
    if (r < 0.12) return;
    n = n || 7;
    const a0 = U.hash2(seed, 1, 5) * TAU;
    let pa = 0, pr = 0;
    for (let i = 0; i <= n; i++) {
      const ii = i % n;
      const a = a0 + ((i + (U.hash2(ii, seed, 6) - 0.5) * 0.45) / n) * TAU;
      const rr = r * (0.8 + U.hash2(ii, seed, 7) * 0.2);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) c.moveTo(px, py);
      else { const am = (pa + a) / 2, rm = ((pr + rr) / 2) * 1.24; c.quadraticCurveTo(x + Math.cos(am) * rm, y + Math.sin(am) * rm, px, py); }
      pa = a; pr = rr;
    }
    c.closePath();
  }

  // Irregular polygon (rocks), deterministic by seed; counter-clockwise in math terms.
  function jag(n, r, seed, rough, rot, cx, cy, sx, sy) {
    const a = [];
    for (let i = 0; i < n; i++) {
      const t = (rot || 0) + ((i + (U.hash2(i, seed, 33) - 0.5) * 0.35) / n) * TAU;
      const rr = r * (1 - rough / 2 + U.hash2(i, seed, 31) * rough);
      a.push((cx || 0) + Math.cos(t) * rr * (sx || 1), (cy || 0) + Math.sin(t) * rr * (sy || 1));
    }
    return a;
  }
  function xf(pts, k, dx, dy, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    const o = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { o[i] = ox + (pts[i] - ox) * k + (dx || 0); o[i + 1] = oy + (pts[i + 1] - oy) * k + (dy || 0); }
    return o;
  }
  function centroid(p) { let x = 0, y = 0; for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; } return [x / (p.length / 2), y / (p.length / 2)]; }
  function area(p) { let a = 0; const n = p.length; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return a / 2; }
  // Rounded closed outline through the edge midpoints (pebbles, snow, moss).
  function smoothPoly(c, p) {
    const n = p.length;
    c.moveTo((p[n - 2] + p[0]) / 2, (p[n - 1] + p[1]) / 2);
    for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; c.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[j]) / 2, (p[i + 1] + p[j + 1]) / 2); }
    c.closePath();
  }
  const litFace = (nx) => nx < -0.3;
  const darkFace = (nx) => nx > 0.3;
  // Straight camera-facing edges that pass test(nx, ny) as open segments (wall paint).
  function edges(c, p, test) {
    const n = p.length, sg = area(p) > 0 ? 1 : -1;
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n, ex = p[j] - p[i], ey = p[j + 1] - p[i + 1], L = Math.hypot(ex, ey) || 1;
      const nx = (sg * ey) / L, ny = (-sg * ex) / L;
      if (ny <= 0.06 || !test(nx, ny)) continue;
      c.moveTo(p[i], p[i + 1]); c.lineTo(p[j], p[j + 1]);
    }
  }
  // The same for a smoothPoly outline: one curved run per vertex, judged by its mean normal.
  function smoothEdges(c, p, test) {
    const n = p.length, sg = area(p) > 0 ? 1 : -1;
    for (let i = 0; i < n; i += 2) {
      const h = (i - 2 + n) % n, j = (i + 2) % n;
      const e1x = p[i] - p[h], e1y = p[i + 1] - p[h + 1], e2x = p[j] - p[i], e2y = p[j + 1] - p[i + 1];
      const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
      let nx = sg * (e1y / l1 + e2y / l2), ny = -sg * (e1x / l1 + e2x / l2);
      const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      if (ny <= 0.06 || !test(nx, ny)) continue;
      c.moveTo((p[h] + p[i]) / 2, (p[h + 1] + p[i + 1]) / 2);
      c.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[j]) / 2, (p[i + 1] + p[j + 1]) / 2);
    }
  }
  // Tapered root / fin with a round tip, wound clockwise like S.circ.
  function taper(c, x0, y0, x1, y1, w0, w1) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
    c.moveTo(x0 - nx * w0, y0 - ny * w0);
    c.lineTo(x1 - nx * w1, y1 - ny * w1);
    c.arc(x1, y1, Math.max(0.05, w1), an + Math.PI, an + TAU, false);
    c.lineTo(x0 + nx * w0, y0 + ny * w0);
    c.closePath();
  }
  // Point on a 3-D polyline [[x, y, z], ...] (z ascending) at height z.
  function polyAt(L, z) {
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i], b = L[i + 1];
      if (z <= b[2] || i === L.length - 2) { const u = clamp((z - a[2]) / Math.max(1e-4, b[2] - a[2]), 0, 1); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; }
    }
    return [L[0][0], L[0][1]];
  }
  /* Stroked 3-D lines (branches, twigs, blades, roots, strands): each slice strokes
   * the short run of every line between z - 0.8 and z, so sloped and nearly flat
   * limbs sweep out without gaps. */
  function limbPart(lines, w, side, top, extra) {
    if (!lines.length) return null;
    let z0 = Infinity, z1 = -Infinity;
    for (const L of lines) { z0 = Math.min(z0, L[0][2]); z1 = Math.max(z1, L[L.length - 1][2]); }
    if (z1 - z0 < 0.2) z1 = z0 + 0.2;
    return Object.assign({ z0, z1, side, top, stroke: w, bevel: false, ao: 0.2,
      shape: (c, zt) => {
        const z = lerp(z0, z1, zt);
        for (const L of lines) {
          const lz0 = L[0][2], lz1 = L[L.length - 1][2];
          if (z < lz0 - 1e-3 || z > lz1 + 1e-3) continue;
          const p = polyAt(L, z), q = polyAt(L, Math.max(lz0, z - 0.8));
          c.moveTo(q[0], q[1]);
          c.lineTo(p[0] + (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < 0.01 ? 0.01 : 0), p[1]);
        }
      } }, extra || {});
  }
  // Soft ground shadow / glow pool painted at z 0 (alpha stays under the forge's solid threshold).
  function pool(rx, ry, dx, dy, col, a, extra) {
    return { z0: 0, z1: 0, side: '#000', top: '#000', flat: true, bevel: false, shape: () => {},
      detail: (c) => {
        c.save(); c.translate(dx, dy); c.scale(1, ry / rx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, rgba(col, a)); g.addColorStop(0.55, rgba(col, a * 0.7)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
        if (extra) extra(c);
      } };
  }
  const contact = (rx, ry, dx, dy, a, extra) => pool(rx, ry, dx, dy, '#0c1408', a === undefined ? 0.3 : a, extra);

  /* ================================================================ colour */
  const TINTS = {
    summer: [['#1f3b1b', '#7cab45'], ['#1b3a21', '#6ea74b'], ['#24421a', '#8ab44c'], ['#1a3524', '#64a252']],
    emerald: [['#0f3a2c', '#5cc58a'], ['#113d27', '#72cf7c'], ['#0d3534', '#52c2a2']],
    autumn: [['#5c2a10', '#ea942e'], ['#521a12', '#d8522c'], ['#5a4210', '#eac748'], ['#3c3c16', '#acab40'], ['#5e3612', '#df7e2c']],
    dark: [['#141a14', '#4a5a3e'], ['#17151b', '#544c5e'], ['#121a17', '#43584a']],
    spring: [['#2a4a1c', '#a8d25c'], ['#25461e', '#9acd62']],
    pine: [['#0f2a1d', '#4f9150'], ['#0e2722', '#46905e'], ['#132f1b', '#5c984a'], ['#0d2520', '#418566']],
    snowpine: [['#0b2a1c', '#3f8452'], ['#0d281c', '#4a8a4c'], ['#0a2622', '#38805e']],
    birch: [['#466a26', '#d2e472'], ['#4a6c24', '#dce678'], ['#3f6628', '#c4e076']],
    willow: [['#2c4a18', '#b4d05e'], ['#284420', '#a6ca66'], ['#324e1a', '#c0d264']],
    elder: [['#125446', '#b6f6cc'], ['#13504e', '#c0f4de'], ['#1a5a3a', '#cff6b4']],
    orchard: [['#2e5622', '#9ccc56'], ['#31581f', '#a8d05c'], ['#2b5324', '#94c85e']],
    bloom: [['#8c5c6a', '#fde2ec'], ['#806468', '#fff0f4'], ['#8c5672', '#fad2e6']],
    bush: [['#1f3d1a', '#74a846'], ['#213f1e', '#82ae4c'], ['#1d3a21', '#68a854'], ['#2b3e16', '#94a846']],
  };
  function foliage(pal, opt, rg, def) {
    const t = opt.tint || (pal && pal.tint) || def;
    const list = TINTS[t] || TINTS[def] || TINTS.summer;
    const ab = list[((((opt.seed | 0) * 7 + (rg.next() < 0.5 ? 0 : 3)) % list.length) + list.length) % list.length];
    let a = (pal && pal.leafA) || ab[0], b = (pal && pal.leafB) || ab[1];
    if (opt.leafA) a = opt.leafA;
    if (opt.leafB) b = opt.leafB;
    // per-seed drift so neighbouring trees never match exactly
    const green = t !== 'autumn' && t !== 'bloom';
    const drift = rg.pick(green ? ['#d8c848', '#2a9a8a', '#0a120a', '#9ac040', '#5a7a2a'] : ['#d8b048', '#8a3a20', '#0a0a0a']);
    const k = rg.range(0.03, green ? 0.15 : 0.1);
    a = mix(a, drift, k); b = mix(b, drift, k * 0.8);
    // keep a readable value step between the shade and the light
    if (lum(b) - lum(a) < 0.2) b = mix(b, '#e8f0c8', clamp((0.2 - (lum(b) - lum(a))) * 1.6, 0, 0.5));
    return { a, b };
  }
  // n tier colours from the dark underside to the sunlit top.
  function ramp(f, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 1 : k / (n - 1);
      out.push({
        s: mix(mix(f.a, f.b, 0.04), mix(f.a, f.b, 0.56), u),
        t: mix(mix(f.a, f.b, 0.34), mix(f.b, '#f4f0b0', 0.12), u),
        hi: mix(mix(f.a, f.b, 0.62), mix(f.b, '#fbf6c0', 0.45), u),
        lo: shade(f.a, -0.5),
      });
    }
    return out;
  }
  function barkOf(pal, opt, side, top) {
    const b = opt.bark || (pal && pal.bark);
    return b ? { s: b, t: shade(b, 0.3), g: shade(b, -0.45) } : { s: side, t: top, g: shade(side, -0.45) };
  }

  /* ================================================================ crowns */
  // Per-clump light: lit cap toward the top-left, shade crescent bottom-right, leaf notches.
  function leafDetail(clumps, k, col, o, fleck, extra) {
    return (c) => {
      c.save();
      c.beginPath(); for (const q of clumps) puff(c, q.x, q.y, q.r * k, q.s, q.n); c.clip();
      // crown-wide light: the sunlit upper-left of the whole mass, shade toward the lower right
      if (o) {
        const CR = o.CR, gx = (o.x || 0) - CR * 0.5, gy = (o.y || 0) - CR * 0.5;
        const G = c.createRadialGradient(gx, gy, CR * 0.05, gx + CR * 0.3, gy + CR * 0.3, CR * 1.6);
        G.addColorStop(0, rgba(col.hi, 0.42)); G.addColorStop(0.42, rgba(col.hi, 0)); G.addColorStop(0.66, rgba(col.lo, 0)); G.addColorStop(1, rgba(col.lo, 0.4));
        c.fillStyle = G; c.fillRect(gx - CR * 2, gy - CR * 2, CR * 5, CR * 5);
      }
      for (const q of clumps) {
        const rr = q.r * k;
        const g = c.createRadialGradient(q.x - rr * 0.38, q.y - rr * 0.42, rr * 0.05, q.x - rr * 0.1, q.y - rr * 0.1, rr * 1.15);
        g.addColorStop(0, rgba(col.hi, 0.5)); g.addColorStop(0.4, rgba(col.hi, 0)); g.addColorStop(0.7, rgba(col.lo, 0)); g.addColorStop(1, rgba(col.lo, 0.55));
        c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, rr * 1.2, 0, TAU); c.fill();
        // leaf texture: dappled leaf dabs, lit toward the top-left of the clump, shaded toward the bottom-right
        const r2 = rngOf(q.s, 9);
        const nd = clamp(Math.round(rr * rr * 0.9), 3, 16);
        for (let i = 0; i < nd; i++) {
          const a = r2.range(0, TAU), d = rr * Math.sqrt(r2.next()) * 0.92, px = q.x + Math.cos(a) * d, py = q.y + Math.sin(a) * d;
          const t = (-(Math.cos(a) + Math.sin(a)) * 0.707) * (d / rr) + r2.range(-0.35, 0.35);
          const lr = r2.range(0.32, 0.62) * Math.min(1, rr / 2);
          c.fillStyle = t > 0 ? rgba(col.hi, Math.min(0.7, 0.25 + t * 0.5)) : rgba(col.lo, Math.min(0.42, 0.1 - t * 0.34));
          c.beginPath(); c.ellipse(px, py, lr, lr * 0.62, r2.range(0, Math.PI), 0, TAU); c.fill();
        }
        if (fleck) for (let i = 0; i < 2; i++) { const a = r2.range(3.4, 4.6), d = rr * r2.range(0.15, 0.55); S.dot(c, rgba(fleck, 0.85), q.x + Math.cos(a) * d, q.y + Math.sin(a) * d, r2.range(0.28, 0.48)); }
      }
      c.restore();
      if (extra) extra(c);
    };
  }
  // Tier layout: ring count n, ring distance d, clump radius r, centre clump c (all × CR),
  // drift toward the light, z range (× D), dome base b0 and top e.
  const BROAD = [
    { n: 8, d: 0.64, r: 0.38, c: 0.55, off: -0.06, z0: 0, z1: 0.45, b0: 0.62, e: 0.74 },
    { n: 7, d: 0.47, r: 0.35, c: 0.45, off: 0.05, z0: 0.22, z1: 0.66, b0: 0.72, e: 0.68 },
    { n: 5, d: 0.3, r: 0.31, c: 0.28, off: 0.14, z0: 0.45, z1: 0.86, b0: 0.76, e: 0.64 },
    { n: 3, d: 0.14, r: 0.24, c: 0, off: 0.22, z0: 0.66, z1: 1, b0: 0.8, e: 0.6, fleck: true },
  ];
  /* The footprint is foreshortened (y × 0.8 by default) so a crown reads round in the
   * oblique stack instead of as a tall column. */
  function crown(o) {
    const rg = rngOf(o.seed, 41);
    const T = o.tiers || BROAD, CR = o.CR, D = o.D, zc = o.zc;
    const col = o.col || ramp(o.fol, T.length);
    const sx = o.sx || 1, sy = (o.sy || 1) * (o.squash === undefined ? 0.8 : o.squash), cs = o.centres || [[0, 0]];
    const lk = cs.length > 1 ? (o.lobeK || 0.68) : 1;
    const parts = [];
    T.forEach((t, ti) => {
      const clumps = [];
      const ox = (o.x || 0) - t.off * CR, oy = (o.y || 0) - t.off * CR * 0.7;
      for (const ce of cs) {
        const bx = ox + ce[0], by = oy + ce[1];
        const ck = ce[2] || lk;
        if (t.c) { const r = t.c * CR * ck * rg.range(0.92, 1.08); clumps.push({ x: bx + rg.range(-0.05, 0.05) * CR, y: by + rg.range(-0.05, 0.05) * CR, r, s: rg.int(1, 1e6), n: clamp(Math.round(r * 1.4), 7, 13) }); }
        const n = Math.max(2, Math.round(t.n * (cs.length > 1 ? 0.8 : 1)) + rg.int(-1, o.sparse ? 0 : 1));
        const a0 = rg.range(0, TAU);
        for (let i = 0; i < n; i++) {
          if (o.sparse && rg.chance(o.sparse)) continue;
          const a = a0 + ((i + rg.range(-0.25, 0.25)) / n) * TAU, d = t.d * CR * ck * rg.range(0.82, 1.12);
          const r = t.r * CR * ck * rg.range(0.8, 1.18);
          clumps.push({ x: bx + Math.cos(a) * d * sx, y: by + Math.sin(a) * d * sy, r, s: rg.int(1, 1e6), n: clamp(Math.round(r * 1.5), 6, 12) + rg.int(0, 1) });
        }
      }
      if (!clumps.length) return;
      clumps.sort((a, b) => a.y - b.y);
      const prof = dome(t.b0, 0.34, t.e), kTop = prof(1), cc = col[Math.min(col.length - 1, ti)];
      // stagger where each clump begins so their shaded bases don't line up into terraces
      for (const q of clumps) q.z = ti === 0 ? rg.range(0, 0.2) : rg.range(0, 0.38);
      parts.push({ z0: zc + t.z0 * D, z1: zc + t.z1 * D, side: cc.s, top: cc.t, ao: t.ao !== undefined ? t.ao : (ti === 0 ? 0.5 : 0.4),
        shape: (c, zt) => { for (const q of clumps) { if (zt < q.z) continue; puff(c, q.x, q.y, q.r * prof((zt - q.z) / (1 - q.z)), q.s, q.n); } },
        detail: leafDetail(clumps, kTop, cc, o, t.fleck ? (o.fleck || cc.hi) : null, o.decorate ? (c) => o.decorate(c, clumps, kTop, ti) : null) });
    });
    return parts;
  }

  /* ================================================================ trunks */
  function trunk(o) {
    const off = (z) => { const u = clamp(z / o.zl, 0, 1); return [o.lean[0] * u * u, o.lean[1] * u * u]; };
    const rad = (z) => { const f = Math.max(0, 1 - z / (o.r * (o.flareH || 1.8))); return o.r * (1 - 0.3 * clamp(z / o.z1, 0, 1)) + o.r * (o.flare === undefined ? 0.7 : o.flare) * f * f; };
    const part = { z0: 0, z1: o.z1, side: o.side, top: o.top, ao: 0.5, shape: (c, zt) => { const z = zt * o.z1, p = off(z); S.blob(c, p[0], p[1], rad(z), o.seed, 9, 0.16); } };
    const gz = Math.min(o.z1, o.gz || o.z1);
    const ng = o.ng || 4;
    const grooves = { z0: 0.3, z1: gz, side: o.groove, top: o.groove, stroke: o.gw || 0.42, ao: 0.1, bevel: false,
      shape: (c, zt) => {
        const z = lerp(0.3, gz, zt), p = off(z), rr = rad(z) * 0.93;
        for (let i = 0; i < ng; i++) {
          const a = 0.4 + (i * 2.3) / Math.max(1, ng - 1) + Math.sin(z * 0.55 + i * 2.1 + o.seed) * 0.13;
          const x = p[0] + Math.cos(a) * rr, y = p[1] + Math.sin(a) * rr;
          c.moveTo(x, y); c.lineTo(x + 0.01, y);
        }
      } };
    return { part, grooves, off, rad };
  }
  function roots(o) {
    const rg = rngOf(o.seed, 77), rs = [], a0 = rg.range(0, TAU);
    for (let i = 0; i < o.n; i++) rs.push({ a: a0 + ((i + rg.range(-0.3, 0.3)) / o.n) * TAU, L: o.L * rg.range(0.7, 1.15) });
    return { z0: 0, z1: o.h || 1.3, side: o.side, top: o.top, ao: 0.35,
      shape: (c, zt) => {
        for (const q of rs) { const L = q.L * (1 - zt * 0.55), w = o.r * 0.55 * (1 - zt * 0.4); taper(c, Math.cos(q.a) * o.r * 0.3, Math.sin(q.a) * o.r * 0.25, Math.cos(q.a) * L, Math.sin(q.a) * L * 0.8, w, w * 0.5); }
        S.circ(c, 0, 0, o.r * (1.15 - zt * 0.2));
      } };
  }

  /* ================================================================ broadleaf trees */
  M.tree_oak = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 11), sc = opt.scale || 1;
    const fol = foliage(pal, opt, rg, 'summer');
    const bk = barkOf(pal, opt, '#5c4e3e', '#9a8a72');
    // 0 round, 1 broad spreading, 2 twin-lobed, 3 tall oval, 4 lopsided
    const form = opt.form !== undefined ? opt.form : [0, 1, 2, 3, 4, 0, 1, 4][seed & 7];
    let CR = rg.range(10, 13), dk = rg.range(0.72, 0.86), sx = 1, sy = 1, cs = null;
    if (form === 1) { CR = rg.range(12.5, 15.5); dk = rg.range(0.58, 0.68); sx = 1.1; }
    else if (form === 2) { CR = rg.range(11.5, 14); dk = rg.range(0.66, 0.78); const a = rg.range(-0.5, 0.5); cs = [[-Math.cos(a) * CR * 0.36, -Math.sin(a) * CR * 0.26], [Math.cos(a) * CR * 0.36, Math.sin(a) * CR * 0.26]]; }
    else if (form === 3) { CR = rg.range(8.5, 10.5); dk = rg.range(1.0, 1.15); sx = 0.92; sy = 1.12; }
    else if (form === 4) { CR = rg.range(10, 12.5); dk = rg.range(0.7, 0.82); const s = rg.chance(0.5) ? 1 : -1; cs = [[-s * CR * 0.12, 0, 0.92], [s * CR * 0.5, CR * 0.14, 0.56]]; }
    CR *= sc;
    const D = CR * dk, zc = CR * 0.7 + rg.range(3, 4.5) * sc, H = zc + D;
    const lean = [rg.range(-1.4, 1.4) * sc, rg.range(-1, 0.6) * sc];
    const tr = (1.3 + CR * 0.075) * rg.range(0.92, 1.1);
    const T = trunk({ z1: zc + D * 0.3, r: tr, lean, zl: zc, seed, side: bk.s, top: bk.t, groove: bk.g, gz: zc });
    const parts = [contact(CR * 0.95, CR * 0.6, CR * 0.16 + lean[0], CR * 0.1 + lean[1], 0.3)];
    parts.push(roots({ r: tr, n: rg.int(3, 4), L: tr * 2.3, seed, side: bk.s, top: bk.t }));
    parts.push(T.part, T.grooves);
    const lines = [], nl = rg.int(2, 3), la = rg.range(0, TAU);
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + rg.range(-0.4, 0.4), d = CR * rg.range(0.3, 0.45), zs = zc - rg.range(2, 4), p = T.off(zs);
      lines.push([[p[0], p[1], zs], [p[0] + Math.cos(a) * d * 0.5, p[1] + Math.sin(a) * d * 0.5, zc + 0.5], [lean[0] + Math.cos(a) * d, lean[1] + Math.sin(a) * d, zc + 3]]);
    }
    parts.push(limbPart(lines, tr * 0.7, bk.s, bk.t));
    parts.push(...crown({ x: lean[0], y: lean[1], zc, CR, D, seed: seed * 31 + 7, fol, sx, sy, centres: cs }));
    return { r: Math.ceil(CR * 1.32 + 3 + Math.abs(lean[0])), h: Math.ceil(H + 1), style: 'decor', bevel: 0.45, parts };
  };

  M.tree_fruit = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 71), sc = opt.scale || 1;
    const fruit = opt.fruit || ['apple', 'pear', 'bloom', 'plum', 'apple', 'orange', 'bloom', 'apple'][seed & 7];
    const fol = foliage(pal, opt, rg, fruit === 'bloom' ? 'bloom' : 'orchard');
    const bk = barkOf(pal, opt, '#4e3c2e', '#86705a');
    const FR = { apple: ['#cf2a24', '#ff9a7a'], pear: ['#d8c03a', '#fff2a0'], plum: ['#5e2a6e', '#c08ad8'], orange: ['#ef8420', '#ffd08a'] }[fruit];
    const CR = rg.range(6.8, 9) * sc, D = CR * rg.range(0.75, 0.88), zc = CR * 0.66 + rg.range(2.6, 3.4) * sc, H = zc + D;
    const lean = [rg.range(-0.8, 0.8) * sc, rg.range(-0.6, 0.4) * sc];
    const tr = (1 + CR * 0.06) * rg.range(0.92, 1.08);
    const T = trunk({ z1: zc + D * 0.3, r: tr, lean, zl: zc, seed, side: bk.s, top: bk.t, groove: bk.g, gz: zc, ng: 3 });
    const fallen = (c) => {
      if (!FR) return;
      const r2 = rngOf(seed, 72);
      for (let i = 0; i < 3; i++) { const a = r2.range(0, TAU), d = CR * r2.range(0.4, 0.8), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.6 + 1; S.dot(c, shade(FR[0], -0.2), x, y, 0.55); S.dot(c, FR[1], x - 0.18, y - 0.2, 0.18); }
    };
    const bloomFallen = (c) => { const r2 = rngOf(seed, 73); for (let i = 0; i < 9; i++) { const a = r2.range(0, TAU), d = CR * r2.range(0.3, 0.95); S.dot(c, rgba(fol.b, 0.85), Math.cos(a) * d, Math.sin(a) * d * 0.6 + 1, 0.3); } };
    const parts = [contact(CR * 0.95, CR * 0.6, CR * 0.15 + lean[0], CR * 0.1 + lean[1], 0.28, fruit === 'bloom' ? bloomFallen : fallen)];
    parts.push(roots({ r: tr, n: 3, L: tr * 2.2, seed, side: bk.s, top: bk.t, h: 1 }));
    parts.push(T.part, T.grooves);
    const lines = [], la = rg.range(0, TAU);
    for (let i = 0; i < 3; i++) { const a = la + (i / 3) * TAU + rg.range(-0.3, 0.3), d = CR * 0.42, zs = zc - 2.2, p = T.off(zs); lines.push([[p[0], p[1], zs], [p[0] + Math.cos(a) * d * 0.55, p[1] + Math.sin(a) * d * 0.55, zc + 0.3], [lean[0] + Math.cos(a) * d, lean[1] + Math.sin(a) * d, zc + 2.4]]); }
    parts.push(limbPart(lines, tr * 0.62, bk.s, bk.t));
    const decorate = (c, clumps, k, ti) => {
      if (ti === 0) return;
      const r2 = rngOf(seed * 13 + ti, 74);
      for (const q of clumps) {
        const rr = q.r * k;
        if (fruit === 'bloom') {
          for (let i = 0; i < 4; i++) { const a = r2.range(0, TAU), d = rr * r2.range(0.1, 0.8), x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d; S.dot(c, i % 2 ? '#fff8fa' : '#f4a8c4', x, y, r2.range(0.3, 0.5)); }
        } else if (r2.chance(0.85)) {
          const nf = r2.int(1, 2);
          for (let i = 0; i < nf; i++) { const a = r2.range(-0.6, 2.4), d = rr * r2.range(0.2, 0.75), x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d; S.dot(c, shade(FR[0], -0.35), x + 0.12, y + 0.15, 0.62); S.dot(c, FR[0], x, y, 0.55); S.dot(c, FR[1], x - 0.18, y - 0.2, 0.2); }
        }
      }
    };
    parts.push(...crown({ x: lean[0], y: lean[1], zc, CR, D, seed: seed * 37 + 5, fol, decorate }));
    return { r: Math.ceil(CR * 1.32 + 3), h: Math.ceil(H + 1), style: 'decor', bevel: 0.45, parts };
  };

  const AIRY = [
    { n: 6, d: 0.62, r: 0.33, c: 0.4, off: -0.04, z0: 0, z1: 0.4, b0: 0.68, e: 0.7 },
    { n: 5, d: 0.5, r: 0.31, c: 0.34, off: 0.06, z0: 0.22, z1: 0.64, b0: 0.72, e: 0.66 },
    { n: 4, d: 0.34, r: 0.27, c: 0.2, off: 0.14, z0: 0.45, z1: 0.86, b0: 0.75, e: 0.62 },
    { n: 2, d: 0.16, r: 0.2, c: 0, off: 0.22, z0: 0.66, z1: 1, b0: 0.78, e: 0.58, fleck: true },
  ];
  M.tree_birch = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 31), sc = opt.scale || 1;
    const fol = foliage(pal, opt, rg, 'birch');
    const bs = opt.bark || (pal && pal.bark) ? barkOf(pal, opt).s : '#bdb6aa', bt = shade(bs, 0.55), mark = '#2a2420';
    const nTr = opt.trunks || [1, 2, 1, 3, 2, 1, 2, 3][seed & 7];
    const H = rg.range(19, 26) * sc, CR = rg.range(6.8, 9) * sc * (nTr > 1 ? 1.12 : 1), D = CR * rg.range(0.95, 1.1), zc = H - D;
    const zt = zc + D * 0.45, trs = [], cs = [];
    const a0 = rg.range(0, TAU);
    for (let j = 0; j < nTr; j++) {
      const a = a0 + (j / nTr) * TAU + rg.range(-0.3, 0.3), spread = nTr > 1 ? rg.range(2.2, 3.8) * sc : 0;
      const b = [Math.cos(a) * (nTr > 1 ? 0.8 : 0), Math.sin(a) * (nTr > 1 ? 0.6 : 0)];
      const tp = [b[0] + Math.cos(a) * spread + rg.range(-0.8, 0.8), b[1] + Math.sin(a) * spread * 0.8 + rg.range(-0.8, 0.3)];
      trs.push({ b, t: tp, r: (0.85 + rg.range(0, 0.25)) * sc * (nTr > 1 ? 0.9 : 1.1), z1: zt - rg.range(0, 3) });
      cs.push([tp[0] * 1.15, tp[1] * 1.15, nTr > 1 ? 0.62 : 1]);
    }
    const at = (q, z) => { const u = clamp(z / q.z1, 0, 1), e = u * (2 - u); return [lerp(q.b[0], q.t[0], e), lerp(q.b[1], q.t[1], e)]; };
    const rad = (q, z) => q.r * (1 - 0.35 * clamp(z / q.z1, 0, 1)) + q.r * 0.5 * Math.max(0, 1 - z / 1.6);
    const zmax = Math.max(...trs.map((q) => q.z1));
    const parts = [contact(CR * 1.0, CR * 0.62, CR * 0.15, CR * 0.1, 0.26)];
    parts.push({ z0: 0, z1: zmax, side: bs, top: bt, ao: 0.32, shape: (c, u) => { const z = u * zmax; for (const q of trs) if (z <= q.z1) { const p = at(q, z); S.circ(c, p[0], p[1], rad(q, z)); } } });
    // the papery black bands and lenticels of birch bark, on the camera-facing half
    parts.push({ z0: 0.4, z1: zmax, side: mark, top: mark, stroke: 0.42, ao: 0, bevel: false,
      shape: (c, u) => {
        const z = lerp(0.4, zmax, u);
        trs.forEach((q, j) => {
          if (z > q.z1) return;
          const band = Math.floor(z * 1.7);
          const h = U.hash2(band, j, seed + 9);
          if (h > 0.34) return;
          const p = at(q, z), rr = rad(q, z) * 0.98, a1 = 0.2 + U.hash2(band, j, seed + 10) * 1.6, a2 = a1 + 0.5 + h * 2;
          c.moveTo(p[0] + Math.cos(a1) * rr, p[1] + Math.sin(a1) * rr); c.arc(p[0], p[1], rr, a1, Math.min(2.95, a2));
        });
      } });
    // a couple of slim limbs splaying into the crown
    const lines = [];
    for (const q of trs) { const z = q.z1 - 2.5, p = at(q, z), a = Math.atan2(q.t[1] - q.b[1] + 0.01, q.t[0] - q.b[0] + 0.01) + rg.range(-0.9, 0.9); lines.push([[p[0], p[1], z], [p[0] + Math.cos(a) * 2.5, p[1] + Math.sin(a) * 2, z + 3]]); }
    parts.push(limbPart(lines, 0.5, bs, bt));
    parts.push(...crown({ x: 0, y: 0, zc, CR, D, seed: seed * 41 + 3, fol, tiers: AIRY, sparse: 0.15, sx: 0.92, squash: 0.86, centres: cs }));
    return { r: Math.ceil(CR * 1.5 + 4), h: Math.ceil(H + 1), style: 'decor', bevel: 0.45, parts };
  };

  const WILLOW_TOP = [
    { n: 7, d: 0.58, r: 0.4, c: 0.5, off: -0.02, z0: 0, z1: 0.5, b0: 0.85, e: 0.72 },
    { n: 5, d: 0.4, r: 0.34, c: 0.36, off: 0.08, z0: 0.3, z1: 0.78, b0: 0.8, e: 0.66 },
    { n: 3, d: 0.18, r: 0.26, c: 0, off: 0.18, z0: 0.56, z1: 1, b0: 0.8, e: 0.6, fleck: true },
  ];
  M.tree_willow = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 41), sc = opt.scale || 1;
    const fol = foliage(pal, opt, rg, 'willow');
    const bk = barkOf(pal, opt, '#4a3a28', '#6f5a40');
    const CR = rg.range(10, 13.5) * sc, D = CR * rg.range(0.55, 0.68);
    const zc = rg.range(10, 13) * sc + CR * 0.25, H = zc + D;
    const lean = [rg.range(-1.5, 1.5) * sc, rg.range(-1, 0.5) * sc];
    const tr = (1.8 + CR * 0.04) * rg.range(0.9, 1.1);
    const T = trunk({ z1: zc + 2, r: tr, lean, zl: zc, seed, side: bk.s, top: bk.t, groove: bk.g, gz: zc, flare: 0.9 });
    const col = ramp(fol, 5);
    const parts = [contact(CR * 1.05, CR * 0.66, CR * 0.14 + lean[0], CR * 0.1 + lean[1], 0.3)];
    parts.push(roots({ r: tr, n: 4, L: tr * 2.4, seed, side: bk.s, top: bk.t }));
    parts.push(T.part, T.grooves);
    // dark hollow inside the curtain so the gaps between strands read as depth
    const hz0 = 1.5, hz1 = zc + 2.5;
    parts.push({ z0: hz0 + 1, z1: hz1 - 1, side: shade(fol.a, -0.55), top: shade(fol.a, -0.4), ao: 0.3, bevel: false, shape: (c) => S.ell(c, lean[0], lean[1], CR * 0.7, CR * 0.56) });
    // hanging curtain: radial frond strands that end at ragged heights
    const nF = Math.round(22 + CR * 0.9), fr = [];
    const fa0 = rg.range(0, TAU);
    for (let i = 0; i < nF; i++) {
      const a = fa0 + ((i + rg.range(-0.3, 0.3)) / nF) * TAU;
      fr.push({ a, d: CR * rg.range(0.8, 0.95), w: ((CR * TAU) / nF) * rg.range(0.38, 0.55), tip: rg.range(0, 0.5) * (Math.sin(a) > 0 ? 1 : 0.5) });
    }
    // strands hang from the crown rim and swing outward toward their tips (a flared skirt)
    const sq = 0.82;
    const frond = (c, zt, k) => {
      for (const f of fr) {
        if (zt < f.tip) continue;
        const d = f.d * (1 + (1 - zt) * 0.2), cx = lean[0] + Math.cos(f.a) * d, cy = lean[1] + Math.sin(f.a) * d * sq;
        S.ell(c, cx, cy, 1.25 * k, f.w * k, Math.atan2(Math.sin(f.a) * sq, Math.cos(f.a)));
      }
    };
    parts.push({ z0: hz0, z1: hz1, side: col[1].s, top: col[1].t, ao: 0.55, shape: (c, zt) => frond(c, zt, 1) });
    // lit strands: a fine light streak down the front of each camera-facing frond
    parts.push({ z0: hz0, z1: hz1 - 0.5, side: col[3].t, top: col[3].t, stroke: 0.4, ao: 0.35, bevel: false,
      shape: (c, zt) => {
        for (const f of fr) {
          if (zt < f.tip + 0.04 || Math.sin(f.a) < 0.15) continue;
          const d = f.d * (1 + (1 - zt) * 0.2) + 1.05, x = lean[0] + Math.cos(f.a) * d - Math.sin(f.a) * f.w * 0.35, y = lean[1] + Math.sin(f.a) * d * sq;
          c.moveTo(x, y); c.lineTo(x + 0.01, y);
        }
      } });
    parts.push(...crown({ x: lean[0], y: lean[1], zc, CR: CR * 0.98, D, seed: seed * 43 + 1, col: col.slice(2), tiers: WILLOW_TOP }));
    return { r: Math.ceil(CR * 1.32 + 3), h: Math.ceil(H + 1), style: 'decor', bevel: 0.45, parts };
  };

  const ELDER = [
    { n: 10, d: 0.68, r: 0.36, c: 0.55, off: -0.05, z0: 0, z1: 0.4, b0: 0.6, e: 0.74 },
    { n: 8, d: 0.53, r: 0.33, c: 0.46, off: 0.04, z0: 0.18, z1: 0.58, b0: 0.7, e: 0.7 },
    { n: 7, d: 0.38, r: 0.3, c: 0.34, off: 0.11, z0: 0.38, z1: 0.76, b0: 0.74, e: 0.66 },
    { n: 5, d: 0.22, r: 0.25, c: 0.16, off: 0.18, z0: 0.56, z1: 0.9, b0: 0.76, e: 0.62 },
    { n: 3, d: 0.1, r: 0.19, c: 0, off: 0.25, z0: 0.72, z1: 1, b0: 0.78, e: 0.58, fleck: true },
  ];
  M.tree_elder = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 51), sc = opt.scale || 1;
    const fol = foliage(pal, opt, rg, 'elder');
    const bk = barkOf(pal, opt, '#848e94', '#e6ecee');
    const glow = typeof opt.glow === 'string' ? opt.glow : '#d8fff2', glow2 = '#fff0a8';
    const CR = rg.range(19, 22.5) * sc, D = CR * rg.range(0.74, 0.84), H = rg.range(50, 58) * sc, zc = H - D;
    const lean = [rg.range(-2, 2) * sc, rg.range(-1.5, 0.5) * sc];
    const tr = rg.range(4.3, 5.1) * sc;
    // luminous leaves: the whole ramp is lifted toward the glow
    const col = ramp(fol, ELDER.length).map((t, i) => ({ s: mix(t.s, glow, 0.06 + i * 0.03), t: mix(t.t, glow, 0.1 + i * 0.05), hi: mix(t.hi, '#fffbe0', 0.3), lo: mix(t.lo, '#0c3a40', 0.4) }));
    const parts = [contact(CR * 0.95, CR * 0.6, CR * 0.15 + lean[0], CR * 0.1 + lean[1], 0.3, (c) => {
      // luminous flowers and mushrooms among the roots
      const r2 = rngOf(seed, 52);
      for (let i = 0; i < 14; i++) { const a = r2.range(0, TAU), d = tr * r2.range(1.5, 3.2), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.72; S.dot(c, rgba(glow, 0.3), x, y, 1.1); S.dot(c, i % 3 ? glow : glow2, x, y, 0.42); }
    })];
    // buttress roots: rounded fins that sweep down from the trunk and spread over the ground
    const nR = 5 + rg.int(0, 1), fins = [];
    for (let i = 0; i < nR; i++) fins.push({ a: (i / nR) * TAU + rg.range(-0.3, 0.3), L: tr * rg.range(1.6, 2.1) });
    const finH = H * 0.16;
    parts.push({ z0: 0, z1: finH, side: bk.s, top: bk.t, ao: 0.4,
      shape: (c, zt) => {
        const k = Math.pow(1 - zt, 1.25);
        for (const f of fins) { const L = tr + (f.L - tr) * k; taper(c, Math.cos(f.a) * tr * 0.4, Math.sin(f.a) * tr * 0.32, Math.cos(f.a) * L, Math.sin(f.a) * L * 0.8, tr * 0.62 * (1 - zt * 0.25), tr * (0.3 + 0.12 * (1 - zt))); }
        S.circ(c, 0, 0, tr * 0.86);
      } });
    // root crevices: dark seams on the camera-facing fins
    parts.push({ z0: 0.3, z1: finH * 0.8, side: bk.g, top: bk.g, stroke: 0.45, ao: 0, bevel: false,
      shape: (c, zt) => { const k = Math.pow(1 - zt / 0.8, 1.25); for (const f of fins) { if (Math.sin(f.a) < 0.2) continue; const L = tr * 0.95 + (f.L - tr) * k * 0.6; const x = Math.cos(f.a + 0.22) * L, y = Math.sin(f.a + 0.22) * L * 0.8; c.moveTo(x, y); c.lineTo(x + 0.01, y); } } });
    const T = trunk({ z1: zc + 7, r: tr, lean, zl: zc, seed, side: bk.s, top: bk.t, groove: bk.g, gz: zc + 2, flare: 0.2, ng: 6, gw: 0.5 });
    parts.push(T.part, T.grooves);
    // pale sap-light running in the bark grooves
    parts.push({ z0: finH, z1: zc - 1, side: glow, top: glow, stroke: 0.32, ao: 0, bevel: false, flat: true,
      shape: (c, u) => {
        const z = lerp(finH, zc - 1, u), p = T.off(z), rr = T.rad(z) * 0.94;
        for (let i = 0; i < 2; i++) { const a = 0.9 + i * 1.3 + Math.sin(z * 0.16 + i * 2 + seed) * 0.35; if (Math.sin(z * 0.45 + i * 1.7 + seed) < -0.2) continue; c.moveTo(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr); c.lineTo(p[0] + Math.cos(a) * rr + 0.01, p[1] + Math.sin(a) * rr); }
      } });
    // great limbs into the crown
    const lines = [], nl = 4 + rg.int(0, 1), la = rg.range(0, TAU);
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + rg.range(-0.3, 0.3), d = CR * rg.range(0.4, 0.55), zs = zc - rg.range(5, 8), p = T.off(zs);
      lines.push([[p[0], p[1], zs], [p[0] + Math.cos(a) * d * 0.45, p[1] + Math.sin(a) * d * 0.35, zc - 1], [lean[0] + Math.cos(a) * d, lean[1] + Math.sin(a) * d * 0.72, zc + 3]]);
    }
    parts.push(limbPart(lines, tr * 0.5, bk.s, bk.t));
    // glowing seed-lanterns hanging on silk under the south rim of the crown
    const hang = [];
    for (let i = 0; i < 8; i++) { const a = 0.2 + (i / 7) * 2.7 + rg.range(-0.12, 0.12), d = CR * rg.range(0.6, 0.86); hang.push([lean[0] + Math.cos(a) * d, lean[1] + Math.sin(a) * d * 0.72, zc - rg.range(2.5, 6.5)]); }
    parts.push(limbPart(hang.map((h) => [[h[0], h[1], h[2]], [h[0], h[1], zc + 2]]), 0.22, shade(glow, -0.35), glow, { flat: true }));
    const decorate = (c, clumps, k, ti) => {
      if (ti === 0) return;
      const r2 = rngOf(seed * 7 + ti, 53);
      // inner light: soft luminous swells across the canopy
      for (const q of clumps) {
        if (!r2.chance(0.35)) continue;
        const rr = q.r * k, g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr * 1.1);
        g.addColorStop(0, rgba(glow, 0.32)); g.addColorStop(1, rgba(glow, 0));
        c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, rr * 1.1, 0, TAU); c.fill();
      }
      for (const q of clumps) {
        const nd = ti >= 3 ? 3 : 2;
        for (let j = 0; j < nd; j++) {
          if (!r2.chance(0.75)) continue;
          const rr = q.r * k, a = r2.range(0, TAU), d = rr * r2.range(0.1, 0.8), x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d;
          const gc = r2.chance(0.3) ? glow2 : glow;
          S.dot(c, rgba(gc, 0.25), x, y, 1.4); S.dot(c, rgba(gc, 0.55), x, y, 0.75); S.dot(c, '#ffffff', x, y, 0.32);
        }
      }
    };
    parts.push(...crown({ x: lean[0], y: lean[1], zc, CR, D, seed: seed * 53 + 11, col, tiers: ELDER, decorate, fleck: '#f4fff8' }));
    parts.push({ z0: zc - 7, z1: zc - 2, side: glow2, top: '#fffbe8', flat: true, bevel: false,
      shape: (c, zt) => { const z = lerp(zc - 7, zc - 2, zt); for (const h of hang) if (Math.abs(z - h[2]) <= 0.7) S.circ(c, h[0], h[1], 0.85 * Math.sqrt(1 - Math.pow((z - h[2]) / 0.75, 2))); } });
    return { r: Math.ceil(CR * 1.3 + 4), h: Math.ceil(H + 1), style: 'decor', bevel: 0.45, parts };
  };

  /* ================================================================ conifers */
  function starPts(cx, cy, R, n, inner, rot, seed, jit) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU, ro = R * (1 - jit / 2 + U.hash2(i, seed, 3) * jit);
      pts.push(cx + Math.cos(a) * ro, cy + Math.sin(a) * ro);
      const am = a + TAU / n / 2, ri = R * inner * (0.9 + U.hash2(i, seed, 4) * 0.2);
      pts.push(cx + Math.cos(am) * ri, cy + Math.sin(am) * ri);
    }
    return pts;
  }
  function conifer(pal, opt, snow) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, snow ? 23 : 21), sc = opt.scale || 1;
    const fol = foliage(pal, opt, rg, snow ? 'snowpine' : 'pine');
    const bk = barkOf(pal, opt, '#3e2c20', '#6a4e38');
    const H = rg.range(21, 34) * sc, R = H * rg.range(0.27, 0.34) * (snow ? 1.06 : 1);
    const nT = clamp(Math.round(H / 6.5) + rg.int(0, 1), 3, 6);
    const zb = R * 0.62 + rg.range(1.2, 2.6) * sc;
    const lean = [rg.range(-1.6, 1.6) * sc, rg.range(-1.2, 0.5) * sc];
    const cen = (z) => { const u = clamp(z / H, 0, 1); return [lean[0] * u * u, lean[1] * u * u]; };
    const col = ramp(fol, nT).map((t) => ({ s: mix(t.s, t.t, 0.3), t: t.t, hi: t.hi, lo: t.lo }));
    const tr = (0.9 + H * 0.025) * sc;
    const load = rg.range(0.5, 1); // snow load: a light dusting .. heavily laden
    const parts = [contact(R * 1.0, R * 0.62, R * 0.18 + lean[0], R * 0.1 + lean[1], 0.32)];
    parts.push(roots({ r: tr, n: 3, L: tr * 2.2, seed, side: bk.s, top: bk.t, h: 1 }));
    parts.push({ z0: 0, z1: zb + 4, side: bk.s, top: bk.t, ao: 0.45, shape: (c, zt) => { const z = zt * (zb + 4), p = cen(z); S.circ(c, p[0], p[1], tr * (1 - zt * 0.3) + tr * 0.5 * Math.max(0, 1 - z / 1.5)); } });
    const step = ((H - zb) * 0.86) / nT;
    for (let i = 0; i < nT; i++) {
      const u = i / nT, last = i === nT - 1;
      const z0 = zb + (H - zb) * u * 0.86, z1 = last ? H : z0 + step * 1.9;
      const tR = R * (1 - u * 0.74) * rg.range(0.92, 1.06), n = Math.round(11 + tR * 0.8), rot = rg.range(0, TAU), ts = rg.int(1, 1e5);
      const inner = rg.range(0.68, 0.76);
      // drooping skirt: tips hang slightly below the widest ring, then the cone narrows
      const kf = (zt) => (zt < 0.1 ? lerp(0.86, 1, zt / 0.1) : 1 - (last ? 0.96 : 0.8) * Math.pow((zt - 0.1) / 0.9, last ? 0.8 : 0.9));
      const ptsAt = (zt, k) => { const z = lerp(z0, z1, zt), p = cen(z); return starPts(p[0], p[1], tR * kf(zt) * (k || 1), n, inner, rot, ts, 0.24); };
      const cc = col[i];
      parts.push({ z0, z1, side: cc.s, top: cc.t, ao: 0.55, shape: (c, zt) => S.poly(c, ptsAt(zt)),
        detail: last ? (c) => { const p = cen(H); S.dot(c, rgba(cc.hi, 0.8), p[0] - 0.3, p[1] - 0.3, 0.5); } : null });
      // needle ridges: lit flank on the left of every spike, shaded flank on the right
      const pz1 = last ? 0.8 : 0.5;
      parts.push({ z0, z1: lerp(z0, z1, pz1), side: mix(cc.hi, cc.s, 0.3), top: cc.hi, stroke: 0.5, ao: 0.45, bevel: false, shape: (c, zt) => edges(c, ptsAt(zt * pz1), litFace) });
      if (!snow) parts.push({ z0, z1: lerp(z0, z1, pz1), side: cc.lo, top: cc.lo, stroke: 0.5, ao: 0.1, bevel: false, shape: (c, zt) => edges(c, ptsAt(zt * pz1), darkFace) });
      if (snow) {
        // a crisp white load on each tier: flat white with blue shade on the far flanks,
        // starting above the green drooping tips so every tier keeps a dark needle rim
        const s0 = last ? lerp(0.4, 0.2, load) : lerp(0.3, 0.15, load), s1 = last ? 1 : 0.55, nl = Math.round(8 + tR * 0.5), ss = rg.int(1, 1e5), srot = rg.range(0, TAU);
        const sk = (last ? 0.9 : lerp(0.7, 0.84, load)) * rg.range(0.94, 1.04);
        const snowAt = (zt) => { const t = lerp(s0, s1, zt), z = lerp(z0, z1, t), p = cen(z); return jag(nl, tR * kf(t) * sk, ss, 0.34, srot, p[0] - 0.15, p[1] - 0.25); };
        const sz0 = lerp(z0, z1, s0), sz1 = lerp(z0, z1, s1) + (last ? 0.3 : 0);
        parts.push({ z0: sz0, z1: sz1, side: '#eef4fb', top: '#ffffff', flat: true, ao: 0.08, shape: (c, zt) => smoothPoly(c, snowAt(zt)) });
        parts.push({ z0: sz0, z1: lerp(sz0, sz1, last ? 0.85 : 0.75), side: '#a9c2e2', top: '#a9c2e2', flat: true, stroke: 0.8, ao: 0.15, bevel: false, shape: (c, zt) => smoothEdges(c, snowAt(zt * (last ? 0.85 : 0.75)), darkFace) });
      }
    }
    return { r: Math.ceil(R * 1.3 + 3 + Math.abs(lean[0])), h: Math.ceil(H + 1), style: 'decor', bevel: 0.6, parts };
  }
  M.tree_pine = function (pal, opt) { return conifer(pal, opt, false); };
  M.tree_snowpine = function (pal, opt) { return conifer(pal, opt, true); };

  /* ================================================================ dead tree */
  M.tree_dead = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 61), sc = opt.scale || 1;
    const bk = barkOf(pal, opt, '#2a2426', '#5a5054');
    const form = opt.form !== undefined ? opt.form : [0, 1, 2, 3, 1, 0, 3, 2][seed & 7];
    const snag = form === 2;
    const H = (snag ? rg.range(12, 16) : form === 1 ? rg.range(24, 30) : rg.range(18, 26)) * sc;
    const zT = snag ? H : H * rg.range(0.55, 0.66);
    const tr = (snag ? rg.range(2.4, 3) : rg.range(1.9, 2.5)) * sc;
    const lean = form === 3 ? [rg.range(3, 5) * (rg.chance(0.5) ? 1 : -1), rg.range(-2, 1)] : [rg.range(-1, 1), rg.range(-1, 0.5)];
    const ph = rg.range(0, TAU);
    const cen = (z) => { const u = z / zT; return [Math.sin(z * 0.24 + ph) * 0.9 * u + lean[0] * u * u, Math.cos(z * 0.19 + ph) * 0.5 * u + lean[1] * u * u]; };
    const rad = (z) => tr * (1 - 0.45 * clamp(z / zT, 0, 1)) + tr * 0.7 * Math.pow(Math.max(0, 1 - z / 2.4), 2);
    const W = [tr * 1.05, tr * 0.68, 0.78 * sc, 0.46 * sc];
    const cls = [[], [], [], []];
    function branch(p, a, el, L, depth) {
      const pts = [p.slice()];
      let x = p[0], y = p[1], z = p[2];
      const nseg = 3;
      for (let s = 0; s < nseg; s++) {
        a += rg.range(-0.55, 0.55); el = clamp(el + rg.range(-0.25, 0.2), 0.25, 1.25);
        const h = L / nseg;
        x += Math.cos(a) * Math.cos(el) * h; y += Math.sin(a) * Math.cos(el) * h * 0.9; z += Math.max(0.5, Math.sin(el) * h);
        pts.push([x, y, z]);
      }
      cls[Math.min(3, depth)].push(pts);
      if (depth < 2) {
        const nk = depth === 0 ? rg.int(1, 2) : rg.int(0, 2);
        for (let k = 0; k < nk; k++) { const q = pts[rg.int(1, 2)]; branch(q, a + rg.range(0.5, 1.1) * (rg.chance(0.5) ? 1 : -1), el + rg.range(-0.1, 0.3), L * rg.range(0.45, 0.65), depth + 1); }
      }
      const tip = pts[pts.length - 1];
      const nt = rg.int(1, 3);
      for (let k = 0; k < nt; k++) { const ta = a + rg.range(-0.9, 0.9), tl = L * rg.range(0.18, 0.3); cls[3].push([tip.slice(), [tip[0] + Math.cos(ta) * tl, tip[1] + Math.sin(ta) * tl * 0.9, tip[2] + tl * rg.range(0.4, 0.9)]]); }
    }
    const nMain = snag ? rg.int(1, 2) : form === 0 ? rg.int(4, 5) : rg.int(3, 4), ba = rg.range(0, TAU);
    const elev = form === 0 ? [0.22, 0.5] : form === 1 ? [0.6, 1.0] : [0.3, 0.7];
    for (let i = 0; i < nMain; i++) {
      const z = snag ? zT * rg.range(0.45, 0.8) : zT * rg.range(0.5, 1), p = cen(z);
      const a = ba + (i / nMain) * TAU + rg.range(-0.4, 0.4);
      branch([p[0], p[1], z], a, rg.range(elev[0], elev[1]), (snag ? rg.range(4, 7) : form === 0 ? rg.range(11, 16) : rg.range(9, 14)) * sc, snag ? 1 : 0);
    }
    if (!snag) { const p = cen(zT); branch([p[0], p[1], zT - 0.5], rg.range(0, TAU), 1.2, (H - zT) * 0.9, 1); }
    // splintered top on the snapped snag
    if (snag) { const p = cen(zT); for (let i = 0; i < 4; i++) { const a = rg.range(0, TAU), d = tr * 0.4; cls[2].push([[p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, zT - 0.6], [p[0] + Math.cos(a) * d * 1.3, p[1] + Math.sin(a) * d * 1.3, zT + rg.range(0.8, 2.4)]]); } }
    const hiC0 = mix(bk.t, bk.s, 0.15);
    const parts = [contact(tr * 3.2, tr * 2, tr * 0.8 + lean[0] * 0.5, tr * 0.5, 0.3)];
    // grasping roots
    const rl = [], nr = rg.int(4, 5), ra = rg.range(0, TAU);
    for (let i = 0; i < nr; i++) { const a = ra + (i / nr) * TAU + rg.range(-0.3, 0.3), L = tr * rg.range(2.2, 3.4); rl.push([[Math.cos(a) * L, Math.sin(a) * L * 0.9, 0], [Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.5, 0.5], [Math.cos(a) * tr * 0.4, Math.sin(a) * tr * 0.4, 1.6]]); }
    parts.push(limbPart(rl, tr * 0.55, bk.s, bk.t));
    parts.push({ z0: 0, z1: zT, side: bk.s, top: snag ? shade(bk.t, 0.1) : bk.t, ao: 0.4, shape: (c, zt) => { const z = zt * zT, p = cen(z); S.blob(c, p[0], p[1], rad(z), seed + Math.floor(z * 0.7), 7, snag && zt > 0.9 ? 0.6 : 0.28); } });
    // sunlit flank of the trunk, then the bark fissures
    parts.push({ z0: 0.6, z1: zT - 0.6, side: hiC0, top: bk.t, stroke: 0.6, ao: 0.4, bevel: false,
      shape: (c, u) => { const z = lerp(0.6, zT - 0.6, u), p = cen(z), rr = rad(z) * 0.78; c.moveTo(p[0] - rr * 0.8, p[1] + rr * 0.55); c.lineTo(p[0] - rr * 0.8 + 0.01, p[1] + rr * 0.55); } });
    parts.push({ z0: 0.4, z1: zT - 0.5, side: bk.g, top: bk.g, stroke: 0.4, ao: 0, bevel: false,
      shape: (c, u) => { const z = lerp(0.4, zT - 0.5, u), p = cen(z), rr = rad(z) * 0.9; for (let i = 0; i < 3; i++) { const a = 0.6 + i * 0.9 + Math.sin(z * 0.8 + i) * 0.25; c.moveTo(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr); c.lineTo(p[0] + Math.cos(a) * rr + 0.01, p[1] + Math.sin(a) * rr); } } });
    // limbs, each class followed by a thin sunlit edge offset toward the light
    const hiC = mix(bk.t, bk.s, 0.15);
    for (let k = 0; k < 4; k++) {
      const lp = limbPart(cls[k], W[k], k < 2 ? bk.s : shade(bk.s, 0.08), k < 2 ? bk.t : shade(bk.t, -0.1));
      if (!lp) continue;
      parts.push(lp);
      if (k < 3) {
        const o = W[k] * 0.3;
        parts.push(limbPart(cls[k].map((L) => L.map((q) => [q[0] - o, q[1] - o, q[2]])), W[k] * 0.28, hiC, hiC, { ao: 0.35 }));
      }
    }
    // a hollow knot on the trunk front
    const kz = zT * rg.range(0.3, 0.55);
    parts.push({ z0: kz, z1: kz + 1.2, side: '#0a0809', top: '#0a0809', flat: true, bevel: false, shape: (c) => { const p = cen(kz), rr = rad(kz); S.ell(c, p[0] + 0.2, p[1] + rr * 0.85, rr * 0.35, 0.35); } });
    let ext = 0;
    for (const L of cls.flat()) for (const q of L) ext = Math.max(ext, Math.abs(q[0]), Math.abs(q[1]));
    return { r: Math.ceil(Math.max(ext, tr * 4) + 3), h: Math.ceil(H + 4), style: 'decor', parts };
  };

  /* ================================================================ bushes */
  const BUSH = [
    { n: 6, d: 0.55, r: 0.45, c: 0.55, off: -0.04, z0: 0, z1: 0.55, b0: 0.85, e: 0.7 },
    { n: 5, d: 0.38, r: 0.38, c: 0.38, off: 0.08, z0: 0.3, z1: 0.8, b0: 0.8, e: 0.65 },
    { n: 2, d: 0.16, r: 0.28, c: 0, off: 0.18, z0: 0.58, z1: 1, b0: 0.8, e: 0.6, fleck: true },
  ];
  function bushModel(pal, opt, berry) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, berry ? 83 : 81), sc = opt.scale || 1;
    const fol = foliage(pal, opt, rg, 'bush');
    const form = [0, 1, 2, 3, 0, 2, 1, 3][seed & 7];
    let CR = rg.range(4.8, 7.2) * sc, sx = 1, sy = 1, cs = null, dk = rg.range(0.68, 0.85);
    if (form === 1) { sx = 1.3; sy = 0.9; }
    else if (form === 2) { CR *= 1.12; cs = [[-CR * 0.32, -CR * 0.05], [CR * 0.34, CR * 0.08, 0.6]]; }
    else if (form === 3) { CR *= 1.1; dk = rg.range(0.5, 0.62); sx = 1.15; }
    const D = CR * dk;
    const BC = { red: ['#c81e36', '#ff8a9a'], blue: ['#3e4ec8', '#a8b4ff'], purple: ['#7a2490', '#e0a0f0'], orange: ['#e6581e', '#ffc08a'], white: ['#e8e4f0', '#ffffff'] };
    const bc = berry ? BC[opt.berry || ['red', 'blue', 'purple', 'red', 'orange', 'blue', 'white', 'red'][seed & 7]] || BC.red : null;
    const decorate = berry ? (c, clumps, k, ti) => {
      if (ti === 0 && clumps.length > 3) return;
      const r2 = rngOf(seed * 11 + ti, 84);
      for (const q of clumps) {
        if (!r2.chance(0.9)) continue;
        const rr = q.r * k, nb = r2.int(1, 2);
        for (let j = 0; j < nb; j++) {
          const a = r2.range(-0.6, 2.6), d = rr * r2.range(0.2, 0.7), x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d;
          for (let b = 0; b < 3; b++) { const bx = x + (b - 1) * 0.5, by = y + (b === 1 ? -0.4 : 0); S.dot(c, shade(bc[0], -0.4), bx + 0.1, by + 0.12, 0.42); S.dot(c, bc[0], bx, by, 0.38); S.dot(c, bc[1], bx - 0.12, by - 0.14, 0.13); }
        }
      }
    } : null;
    const parts = [contact(CR * 1.1 * sx, CR * 0.72, CR * 0.12, CR * 0.08, 0.3)];
    parts.push(...crown({ x: 0, y: 0, zc: 0, CR, D, seed: seed * 29 + (berry ? 7 : 3), fol, tiers: BUSH, sx, sy, centres: cs, decorate }));
    return { r: Math.ceil(CR * 1.45 * Math.max(sx, 1) + 2), h: Math.ceil(D + 1), style: 'decor', bevel: 0.45, parts };
  }
  M.bush = function (pal, opt) { return bushModel(pal, opt, false); };
  M.bush_berry = function (pal, opt) { return bushModel(pal, opt, true); };

  /* ================================================================ flowers / reeds / wheat */
  const FLOWER = { red: '#e0353a', yellow: '#f2d040', white: '#f4f0ea', blue: '#5a7ae8', purple: '#a45ad8', pink: '#f088b8', orange: '#f08a30' };
  const FLOWER_KEYS = ['red', 'yellow', 'white', 'blue', 'purple', 'pink', 'orange'];
  M.flowers = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 91), sc = opt.scale || 1;
    const pick = (k) => FLOWER[k] || k;
    const mixed = opt.col === 'mix';
    const base = opt.col && !mixed ? pick(opt.col) : FLOWER[FLOWER_KEYS[((seed % FLOWER_KEYS.length) + FLOWER_KEYS.length) % FLOWER_KEYS.length]];
    const gS = '#2c5520', gT = '#62a03c';
    const nt = rg.int(3, 5), tufts = [];
    for (let i = 0; i < nt; i++) { const a = rg.range(0, TAU), d = i === 0 ? 0 : rg.range(1.8, 4.2); tufts.push({ x: Math.cos(a) * d * sc, y: Math.sin(a) * d * 0.75 * sc, R: rg.range(1.5, 2.4) * sc, h: rg.range(1.2, 2.1), n: rg.int(6, 8), rot: rg.range(0, TAU), s: rg.int(1, 1e5) }); }
    tufts.sort((a, b) => a.y - b.y);
    const fl = [];
    for (const t of tufts) { const nf = rg.int(2, 4); for (let j = 0; j < nf; j++) { const a = rg.range(0, TAU), d = rg.range(0.3, 1.4) * t.R; fl.push({ x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d * 0.8, r: rg.range(0.62, 0.9) * sc, c: mixed ? FLOWER[rg.pick(FLOWER_KEYS)] : mix(base, rg.pick(['#ffffff', '#000000', base]), 0.14) }); } }
    const parts = [contact(5.5 * sc, 3.5 * sc, 0.6, 0.4, 0.2)];
    parts.push({ z0: 0, z1: 2.1, side: gS, top: gT, ao: 0.5, bevel: false,
      shape: (c, zt) => { for (const t of tufts) { if (zt * 2.1 > t.h) continue; const k = 1 - (zt * 2.1 / t.h) * 0.55; S.poly(c, starPts(t.x, t.y, t.R * k, t.n, 0.42, t.rot + zt * 0.3, t.s, 0.35)); } },
      detail: (c) => { for (const t of tufts) S.lines(c, 'rgba(180,230,120,0.45)', 0.3, [t.x - t.R * 0.4, t.y - t.R * 0.1, t.x - t.R * 0.1, t.y - t.R * 0.45]); } });
    const groups = {};
    for (const f of fl) { const k = hx(f.c); (groups[k] = groups[k] || []).push(f); }
    for (const k in groups) {
      const g = groups[k];
      parts.push({ z0: 2.2, z1: 2.7, side: shade(k, -0.35), top: k, ao: 0.3, bevel: false, shape: (c) => { for (const f of g) S.circ(c, f.x, f.y, f.r); },
        detail: (c) => { for (const f of g) { for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU + f.x; S.dot(c, rgba(shade(k, -0.3), 0.55), f.x + Math.cos(a) * f.r * 0.72, f.y + Math.sin(a) * f.r * 0.72, 0.12); } S.dot(c, rgba('#ffffff', 0.5), f.x - f.r * 0.35, f.y - f.r * 0.35, f.r * 0.3); S.dot(c, lum(k) > 0.7 ? '#c08a1a' : '#ffe060', f.x, f.y, f.r * 0.32); } } });
    }
    return { r: Math.ceil(7.5 * sc), h: 4, style: 'decor', parts };
  };

  M.reeds = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 101), sc = opt.scale || 1;
    const nb = rg.int(15, 21), A = [], B = [], heads = [];
    for (let i = 0; i < nb; i++) {
      const a = rg.range(0, TAU), d = rg.range(0, 2.6) * sc, bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.8;
      const la = a + rg.range(-0.6, 0.6), lk = rg.range(1, 3.6) * sc, h = rg.range(6, 11) * sc;
      const tx = bx + Math.cos(la) * lk, ty = by + Math.sin(la) * lk * 0.8;
      const L = [];
      for (let k = 0; k <= 4; k++) { const u = k / 4, e = u * u; L.push([lerp(bx, tx, e), lerp(by, ty, e), h * u]); }
      (rg.chance(0.5) ? A : B).push(L);
      if (heads.length < 4 && rg.chance(0.35) && h > 7) heads.push({ L, h });
    }
    const parts = [contact(5 * sc, 3.2 * sc, 0.8, 0.5, 0.22)];
    parts.push({ z0: 0, z1: 1.6, side: '#2c4a1e', top: '#4f7a2e', ao: 0.4, bevel: false, shape: (c, zt) => S.poly(c, starPts(0, 0, (3 - zt * 1.4) * sc, 9, 0.5, zt * 0.4, seed, 0.35)) });
    parts.push(limbPart(A, 0.7, '#46682a', '#a6c05e'));
    parts.push(limbPart(B, 0.55, '#6e7c34', '#c8d070'));
    for (const hd of heads) {
      const z0 = hd.h * 0.62, z1 = hd.h * 0.86;
      parts.push({ z0, z1, side: '#4a2c16', top: '#8a5a30', ao: 0.3, shape: (c, zt) => { const p = polyAt(hd.L, lerp(z0, z1, zt)); S.circ(c, p[0], p[1], 0.72 * sc); } });
    }
    return { r: Math.ceil(9 * sc), h: Math.ceil(12 * sc), style: 'decor', parts };
  };

  M.wheat = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 161), sc = opt.scale || 1;
    const n = opt.n || [3, 2, 4, 1, 3, 2, 4, 3][seed & 7];
    const straw = '#b08a32', strawT = '#e8c75e', band = '#7a5224', grainS = '#c4942e', grainT = '#f8df80';
    const sh = [];
    const a0 = rg.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + rg.range(-0.3, 0.3), d = n === 1 ? 0 : rg.range(1.6, 2.4) * sc;
      const bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.8;
      const lk = n > 2 ? 0.7 : 0.25;
      sh.push({ bx, by, lx: -bx * lk + rg.range(-0.4, 0.4), ly: -by * lk + rg.range(-0.4, 0.2), h: rg.range(6, 8.5) * sc, s: rg.int(1, 1e5) });
    }
    sh.sort((a, b) => a.by - b.by);
    const parts = [contact(5.2 * sc, 3.4 * sc, 0.8, 0.5, 0.26, (c) => {
      const r2 = rngOf(seed, 162);
      c.strokeStyle = 'rgba(214,180,90,0.75)'; c.lineWidth = 0.3; c.beginPath();
      for (let i = 0; i < 9; i++) { const a = r2.range(0, TAU), d = r2.range(2.5, 5.5) * sc, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.7, b = r2.range(0, TAU); c.moveTo(x, y); c.lineTo(x + Math.cos(b) * 1.4, y + Math.sin(b) * 1.4); }
      c.stroke();
    })];
    for (const s of sh) {
      const ctr = (z) => { const u = z / s.h; return [s.bx + s.lx * u, s.by + s.ly * u]; };
      const rad = (u) => (u < 0.44 ? lerp(1.5, 0.78, Math.pow(u / 0.44, 0.8)) : lerp(0.78, 2.0, Math.pow((u - 0.44) / 0.56, 0.9))) * sc;
      parts.push({ z0: 0, z1: s.h - 1, side: straw, top: strawT, ao: 0.45, shape: (c, zt) => { const z = zt * (s.h - 1), p = ctr(z); S.blob(c, p[0], p[1], rad(z / s.h), s.s, 11, 0.22); } });
      parts.push({ z0: 0.3, z1: s.h - 1.5, side: shade(straw, -0.3), top: shade(straw, -0.3), stroke: 0.3, ao: 0, bevel: false,
        shape: (c, zt) => { const z = lerp(0.3, s.h - 1.5, zt), p = ctr(z), rr = rad(z / s.h) * 0.9; for (let i = 0; i < 4; i++) { const a = 0.35 + i * 0.8; c.moveTo(p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr); c.lineTo(p[0] + Math.cos(a) * rr + 0.01, p[1] + Math.sin(a) * rr); } } });
      const bz = s.h * 0.42;
      parts.push({ z0: bz, z1: bz + 0.8, side: band, top: shade(band, 0.2), ao: 0.1, bevel: false, shape: (c) => { const p = ctr(bz + 0.4); S.circ(c, p[0], p[1], rad(0.44) + 0.25); } });
      // drooping ears: a spiky crown of grain heads, wider than the bundle
      parts.push({ z0: s.h - 1.8, z1: s.h + 0.7, side: grainS, top: grainT, ao: 0.5,
        shape: (c, zt) => { const p = ctr(s.h - 1.8 + zt * 2.5); S.poly(c, starPts(p[0], p[1], rad(1) * (1.25 - zt * 0.4), 13, 0.55, s.s, s.s, 0.32)); },
        detail: (c) => { const p = ctr(s.h + 0.6), r2 = rngOf(s.s, 5); for (let i = 0; i < 9; i++) { const a = r2.range(0, TAU), d = r2.range(0, 1.3) * sc; S.dot(c, i % 3 ? 'rgba(255,240,170,0.8)' : 'rgba(140,96,30,0.6)', p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, 0.3); } } });
    }
    return { r: Math.ceil(7 * sc), h: Math.ceil(10 * sc), style: 'decor', parts };
  };

  /* ================================================================ stump */
  M.stump = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 151), sc = opt.scale || 1;
    const kind = opt.kind || ['cut', 'broken', 'mossy', 'old', 'cut', 'mossy', 'broken', 'old'][seed & 7];
    const bk = barkOf(pal, opt, '#4a3624', '#7a5c3c');
    const R = rg.range(2.6, 4.2) * sc, h = rg.range(2.4, 4.2) * sc;
    const wood = kind === 'old' ? '#8a7a64' : '#cfa56e', ring = kind === 'old' ? 'rgba(50,40,30,0.45)' : 'rgba(120,80,40,0.55)';
    const parts = [contact(R * 2, R * 1.3, R * 0.4, R * 0.25, 0.3)];
    parts.push(roots({ r: R * 1.1, n: rg.int(4, 5), L: R * 1.65, seed, side: bk.s, top: bk.t, h: 1.3 }));
    const rad = (z) => R * (1 + 0.35 * Math.pow(Math.max(0, 1 - z / 1.6), 2));
    parts.push({ z0: 0, z1: h, side: bk.s, top: wood, ao: 0.5,
      shape: (c, zt) => S.blob(c, 0, 0, rad(zt * h), seed, 10, 0.12),
      detail: (c) => {
        c.save(); c.lineWidth = 0.3; c.strokeStyle = ring;
        for (let i = 1; i <= 4; i++) { c.beginPath(); c.arc(0.15 * i - 0.4, 0.1 * i - 0.3, R * (0.2 * i), 0, TAU); c.stroke(); }
        c.lineWidth = 0.65; c.strokeStyle = shade(bk.s, -0.2); c.beginPath(); S.blob(c, 0, 0, R * 0.97, seed, 10, 0.12); c.stroke();
        c.lineWidth = 0.35; c.strokeStyle = 'rgba(40,24,12,0.6)'; c.beginPath(); c.moveTo(-0.3, -0.2); c.lineTo(R * 0.5, R * 0.55); c.lineTo(R * 0.75, R * 0.5); c.stroke();
        if (kind === 'old') { S.dot(c, '#1e1712', -0.2, -0.1, R * 0.45); S.dot(c, '#3a2c20', -0.35, -0.3, R * 0.28); }
        else S.dot(c, 'rgba(90,56,26,0.8)', -0.35, -0.25, 0.35);
        c.restore();
      } });
    parts.push({ z0: 0.4, z1: h - 0.3, side: bk.g, top: bk.g, stroke: 0.4, ao: 0, bevel: false,
      shape: (c, zt) => { const z = lerp(0.4, h - 0.3, zt), rr = rad(z) * 0.95; for (let i = 0; i < 4; i++) { const a = 0.4 + i * 0.75 + Math.sin(z + i) * 0.1; c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); c.lineTo(Math.cos(a) * rr + 0.01, Math.sin(a) * rr); } } });
    if (kind === 'broken') {
      const sp = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rg.range(-0.3, 0.3), d = R * rg.range(0.55, 0.85); sp.push([Math.cos(a) * d, Math.sin(a) * d, rg.range(1, 3.2) * sc, R * rg.range(0.28, 0.42), a]); }
      parts.push({ z0: h, z1: h + 3.2 * sc, side: bk.s, top: wood, ao: 0.2,
        shape: (c, zt) => { const z = zt * 3.2 * sc; for (const s of sp) if (z <= s[2]) { const k = 1 - z / s[2]; S.ell(c, s[0], s[1], s[3] * (0.25 + k * 0.75), s[3] * 0.6 * (0.25 + k * 0.75), s[4] + Math.PI / 2); } } });
    }
    if (kind === 'mossy') {
      parts.push({ z0: h - 0.6, z1: h + 0.5, side: '#3e5a22', top: '#7a9e3a', ao: 0.2, shape: (c) => puff(c, -R * 0.2, -R * 0.15, R * 0.75, seed + 2, 7),
        detail: (c) => { const r2 = rngOf(seed, 152); for (let i = 0; i < 6; i++) S.dot(c, i % 2 ? 'rgba(170,210,90,0.7)' : 'rgba(30,50,20,0.5)', -R * 0.2 + r2.range(-1, 1) * R * 0.5, -R * 0.15 + r2.range(-1, 1) * R * 0.5, 0.3); } });
      const sh = [[R * 1.05, R * 0.6], [R * 0.7, R * 1.0]];
      parts.push({ z0: 0, z1: 1.4, side: '#c8b8a0', top: '#e8dcc8', ao: 0.3, bevel: false, shape: (c) => { for (const s of sh) S.circ(c, s[0], s[1], 0.32); } });
      parts.push({ z0: 1.2, z1: 1.9, side: '#8a4a26', top: '#d07a40', ao: 0.4, shape: (c, zt) => { for (const s of sh) S.circ(c, s[0], s[1], 0.95 - zt * 0.4); } });
    }
    return { r: Math.ceil(R * 2.6 + 2), h: Math.ceil(h + 4), style: 'decor', parts };
  };

  /* ================================================================ rocks */
  function rockParts(o) {
    const base = jag(o.n, o.R, o.seed, o.rough, o.rot, 0, 0, o.sx, o.sy);
    const kf = (u) => (1 - o.taper * Math.pow(u, 1.6)) * (u < 0.18 ? lerp(0.9, 1, Math.sin((u / 0.18) * Math.PI / 2)) : 1);
    const at = (z) => { const u = clamp(z / o.h, 0, 1); return xf(base, kf(u), o.x + o.lean[0] * u, o.y + o.lean[1] * u); };
    const outline = o.smooth ? smoothPoly : S.poly, edgeFn = o.smooth ? smoothEdges : edges;
    const parts = [];
    parts.push({ z0: 0, z1: o.h, side: o.side, top: o.top, ao: 0.5, shape: (c, zt) => outline(c, at(zt * o.h)), detail: o.detail ? (c) => o.detail(c, at(o.h), o) : null });
    const pTop = o.capZ !== undefined ? o.capZ : o.h - 0.5;
    parts.push({ z0: 0.3, z1: pTop, side: o.lit, top: o.lit, stroke: 0.9, ao: 0.25, bevel: false, shape: (c, zt) => edgeFn(c, at(lerp(0.3, pTop, zt)), litFace) });
    parts.push({ z0: 0.3, z1: pTop, side: o.dark, top: o.dark, stroke: 0.9, ao: 0.1, bevel: false, shape: (c, zt) => edgeFn(c, at(lerp(0.3, pTop, zt)), darkFace) });
    if (o.cap) {
      const z0 = o.capZ, z1 = o.h + o.cap.lift;
      const sh = o.cap.shift || [0, 0];
      const capAt = (zt) => {
        const z = lerp(z0, o.h, zt), p = at(z), ce = centroid(p);
        if (!o.cap.patch) return xf(p, o.cap.k * (1 - zt * (o.cap.kz || 0.05)), sh[0] * (1 - zt), sh[1] * (1 - zt) - zt * 0.2, ce[0], ce[1]);
        // moss patch: full cover (slightly overhanging) on the lit top-left, receding on the far side
        const q = new Array(p.length);
        for (let i = 0; i < p.length; i += 2) {
          const dx = p[i] - ce[0], dy = p[i + 1] - ce[1], L = Math.hypot(dx, dy) || 1;
          const f = clamp(0.6 + 0.48 * (-(dx + dy) * 0.707) / L + (U.hash2(i, o.seed, 61) - 0.5) * 0.3, 0.42, 1.05) * (1 - zt * 0.06);
          q[i] = ce[0] + dx * f; q[i + 1] = ce[1] + dy * f - zt * 0.15;
        }
        return q;
      };
      parts.push({ z0, z1, side: o.cap.side, top: o.cap.top, ao: o.cap.flat ? 0.08 : 0.25, flat: !!o.cap.flat,
        shape: (c, zt) => smoothPoly(c, capAt(zt)),
        detail: o.cap.detail ? (c) => o.cap.detail(c, at(o.h)) : null });
      if (o.cap.flat) parts.push({ z0, z1: lerp(z0, z1, 0.7), side: o.cap.shadeC || '#a9c2e2', top: o.cap.shadeC || '#a9c2e2', flat: true, stroke: 0.8, ao: 0.1, bevel: false, shape: (c, zt) => smoothEdges(c, capAt(zt * 0.7), darkFace) });
    }
    return parts;
  }
  const crack = (col) => (c, p, o) => {
    const ce = centroid(p), r2 = rngOf(o.seed, 3), R = o.R * (1 - o.taper);
    c.save(); c.strokeStyle = col; c.lineWidth = 0.4; c.beginPath();
    const a = r2.range(0, TAU);
    c.moveTo(ce[0] + Math.cos(a) * R * 0.6, ce[1] + Math.sin(a) * R * 0.6); c.lineTo(ce[0] + r2.range(-0.2, 0.2) * R, ce[1] + r2.range(-0.2, 0.2) * R); c.lineTo(ce[0] + Math.cos(a + 2.4) * R * 0.5, ce[1] + Math.sin(a + 2.4) * R * 0.5);
    c.stroke(); c.restore();
  };
  function rockModel(pal, opt, kind) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, kind === 'snow' ? 113 : kind === 'dark' ? 117 : 111), sc = opt.scale || 1;
    const SIZES = [6, 10, 14, 8, 12, 16, 7, 11];
    const R = (opt.size || SIZES[seed & 7]) * rg.range(0.92, 1.08) * sc;
    const COL = {
      mossy: { side: '#5d5e57', top: '#a5a496', lit: '#8f8f84', dark: '#3a3b36' },
      snow: { side: '#4e5c70', top: '#909eb0', lit: '#7d8da2', dark: '#2c3849' },
      dark: { side: '#26232b', top: '#58525f', lit: '#4c4655', dark: '#121016' },
    }[kind];
    const glow = opt.glow ? (typeof opt.glow === 'string' ? opt.glow : '#93ff6a') : null;
    const smooth = kind === 'mossy';
    const stones = [];
    const mainR = R * 0.64, mainH = mainR * (kind === 'dark' ? rg.range(0.8, 1.05) : rg.range(0.62, 0.85));
    stones.push({ x: 0, y: 0, R: mainR, h: mainH });
    const ns = R > 9 ? rg.int(1, 2) : rg.int(0, 1);
    for (let i = 0; i < ns; i++) { const a = rg.range(0, TAU), d = R * rg.range(0.55, 0.75), rr = R * rg.range(0.26, 0.38); stones.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, R: rr, h: rr * rg.range(0.6, 0.9) }); }
    stones.sort((a, b) => a.y - b.y);
    const parts = [contact(R * 1.0, R * 0.65, R * 0.14, R * 0.08, 0.3)];
    for (const st of stones) {
      const o = Object.assign({}, COL, {
        x: st.x, y: st.y, R: st.R, h: st.h, seed: rg.int(1, 1e5), n: kind === 'dark' ? rg.int(6, 7) : rg.int(7, 9), rough: kind === 'dark' ? 0.42 : 0.3,
        rot: rg.range(0, TAU), sx: rg.range(1, 1.25), sy: rg.range(0.85, 1), taper: kind === 'dark' ? rg.range(0.35, 0.55) : kind === 'mossy' ? rg.range(0.5, 0.62) : rg.range(0.3, 0.45),
        lean: [rg.range(-0.1, 0.1) * st.R, rg.range(-0.15, 0.05) * st.R], smooth,
      });
      if (kind === 'mossy') {
        o.capZ = st.h * rg.range(0.62, 0.74);
        o.cap = { side: '#4a6a26', top: '#7fa23e', lift: 0.3, patch: true,
          detail: (c, p) => { const ce = centroid(p), r2 = rngOf(o.seed, 7); for (let i = 0; i < 7; i++) S.dot(c, i % 2 ? 'rgba(178,214,96,0.75)' : 'rgba(26,44,16,0.45)', ce[0] + r2.range(-0.6, 0.6) * st.R * 0.6, ce[1] + r2.range(-0.6, 0.6) * st.R * 0.5, r2.range(0.25, 0.5)); } };
        o.detail = crack('rgba(40,40,36,0.5)');
      } else if (kind === 'snow') {
        o.capZ = st.h * rg.range(0.66, 0.76);
        o.cap = { side: '#dce8f5', top: '#ffffff', k: 1.06, lift: 0.6, flat: true,
          detail: (c, p) => { const ce = centroid(p); S.lines(c, 'rgba(130,160,200,0.45)', 0.45, [ce[0] - st.R * 0.1, ce[1] + st.R * 0.35, ce[0] + st.R * 0.45, ce[1] + st.R * 0.1]); S.dot(c, 'rgba(255,255,255,0.9)', ce[0] - st.R * 0.25, ce[1] - st.R * 0.2, 0.45); } };
        o.detail = crack('rgba(30,40,56,0.5)');
      } else {
        o.detail = (c, p) => {
          crack('rgba(8,6,10,0.7)')(c, p, o);
          if (glow) { const ce = centroid(p), r2 = rngOf(o.seed, 4); c.save(); c.strokeStyle = glow; c.lineWidth = 0.4; c.shadowColor = glow; c.beginPath(); const a = r2.range(0, TAU); c.moveTo(ce[0] + Math.cos(a) * st.R * 0.4, ce[1] + Math.sin(a) * st.R * 0.4); c.lineTo(ce[0], ce[1]); c.lineTo(ce[0] + Math.cos(a + 2) * st.R * 0.35, ce[1] + Math.sin(a + 2) * st.R * 0.35); c.stroke(); c.restore(); }
          const ce = centroid(p); S.dot(c, 'rgba(200,190,220,0.35)', ce[0] - st.R * 0.2, ce[1] - st.R * 0.25, 0.4);
        };
      }
      parts.push(...rockParts(o));
    }
    return { r: Math.ceil(R * 1.4 + 3), h: Math.ceil(mainH + 2), style: 'decor', parts };
  }
  M.rock_mossy = function (pal, opt) { return rockModel(pal, opt, 'mossy'); };
  M.rock_snow = function (pal, opt) { return rockModel(pal, opt, 'snow'); };
  M.rock_dark = function (pal, opt) { return rockModel(pal, opt, 'dark'); };

  /* ================================================================ ice shards */
  M.ice_shard = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 121), sc = opt.scale || 1;
    const iceS = '#3f7cbc', iceT = '#d6f2ff', glint = '#a6e2ff', deep = '#1c4a86', edge = '#f2fbff';
    const n = rg.int(4, 6), sh = [];
    const Hm = rg.range(11, 17) * sc;
    const a0 = rg.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const main = i === 0, a = a0 + (i / n) * TAU + rg.range(-0.4, 0.4), d = main ? 0.4 : rg.range(2.4, 4.4) * sc;
      const L = (main ? rg.range(2.6, 3.2) : rg.range(1.6, 2.6)) * sc, W = L * rg.range(0.5, 0.72), ang = rg.range(0, Math.PI);
      const raw = [L, 0, 0.3 * L, W, -0.5 * L, W * 0.8, -L, 0, -0.35 * L, -W, 0.45 * L, -W * 0.85];
      const base = [];
      for (let k = 0; k < raw.length; k += 2) base.push(raw[k] * Math.cos(ang) - raw[k + 1] * Math.sin(ang), raw[k] * Math.sin(ang) + raw[k + 1] * Math.cos(ang));
      const bx = Math.cos(a) * d, by = Math.sin(a) * d * 0.8, h = main ? Hm : Hm * rg.range(0.32, 0.72);
      const out = Math.hypot(bx, by) || 1, lk = h * rg.range(0.15, 0.32);
      sh.push({ base, bx, by, h, lean: [(bx / out) * lk, (by / out) * lk - (main ? h * 0.05 : 0)] });
    }
    sh.sort((a, b) => a.by - b.by);
    const parts = [contact(7 * sc, 4.5 * sc, 1, 0.6, 0.22)];
    parts.push({ z0: 0, z1: 0.7, side: '#c4d6e8', top: '#f2f8fd', flat: true, ao: 0.15, bevel: false, shape: (c) => smoothPoly(c, jag(11, 5.4 * sc, seed, 0.55, 0, 0, 0.2, 1.1, 0.8)) });
    for (const s of sh) {
      const kf = (u) => 0.12 + 0.88 * Math.pow(1 - u, 0.8);
      const at = (z) => { const u = clamp(z / s.h, 0, 1); return xf(s.base, kf(u), s.bx + s.lean[0] * u, s.by + s.lean[1] * u); };
      parts.push({ z0: 0, z1: s.h, side: iceS, top: iceT, ao: 0.35, shape: (c, zt) => S.poly(c, at(zt * s.h)) });
      parts.push({ z0: 0.4, z1: s.h - 0.6, side: glint, top: glint, stroke: 0.85, ao: 0.3, bevel: false, shape: (c, zt) => edges(c, at(lerp(0.4, s.h - 0.6, zt)), litFace) });
      parts.push({ z0: 0.4, z1: s.h - 0.6, side: deep, top: deep, stroke: 0.85, ao: 0.1, bevel: false, shape: (c, zt) => edges(c, at(lerp(0.4, s.h - 0.6, zt)), darkFace) });
      // crisp highlight down the front-left arris (the vertex most toward the viewer's left-front)
      let vi = 0, best = -1e9;
      for (let k = 0; k < s.base.length; k += 2) { const v = -s.base[k] * 0.7 + s.base[k + 1] * 0.7; if (v > best) { best = v; vi = k; } }
      parts.push({ z0: 0.5, z1: s.h - 0.4, side: edge, top: edge, stroke: 0.45, ao: 0, bevel: false, flat: true, shape: (c, zt) => { const p = at(lerp(0.5, s.h - 0.4, zt)); c.moveTo(p[vi], p[vi + 1]); c.lineTo(p[vi] + 0.01, p[vi + 1]); } });
    }
    return { r: Math.ceil(9 * sc + 3), h: Math.ceil(Hm + 2), style: 'decor', parts };
  };

  /* ================================================================ cursed mushrooms */
  M.mushrooms_glow = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 131), sc = opt.scale || 1;
    const glow = opt.col || (pal && pal.glow) || ['#8dff5c', '#c47bff', '#5cffd2', '#8dff5c'][seed & 3];
    const n = rg.int(5, 8), ms = [], a0 = rg.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const big = i === 0, a = a0 + (i / n) * TAU + rg.range(-0.4, 0.4), d = big ? 0 : rg.range(2, 4.8) * sc;
      ms.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, h: (big ? rg.range(5, 6.5) : rg.range(1.8, 4.2)) * sc, cr: (big ? rg.range(2.5, 3.1) : rg.range(1.1, 2)) * sc, lx: rg.range(-0.8, 0.8), ly: rg.range(-0.6, 0.3), s: rg.int(1, 1e5) });
    }
    ms.sort((a, b) => a.y - b.y);
    const parts = [pool(6.5 * sc, 4.2 * sc, 0, 0.3, glow, 0.3)];
    for (const m of ms) {
      const ctr = (z) => { const u = z / m.h; return [m.x + m.lx * u * u, m.y + m.ly * u * u]; };
      parts.push({ z0: 0, z1: m.h, side: '#8e889a', top: '#d6d0e0', ao: 0.45, bevel: false, shape: (c, zt) => { const p = ctr(zt * m.h); S.circ(c, p[0], p[1], m.cr * 0.28 * (1.25 - zt * 0.3)); } });
      const capH = m.cr * 0.9, z0 = m.h - capH * 0.35, top = ctr(m.h);
      parts.push({ z0, z1: m.h + capH * 0.65, side: shade(glow, -0.45), top: mix(glow, '#ffffff', 0.35), flat: true, ao: 0.6, bevel: false,
        shape: (c, zt) => { const k = zt < 0.2 ? lerp(0.82, 1, zt / 0.2) : Math.sqrt(Math.max(0.04, 1 - Math.pow((zt - 0.2) / 0.8, 2) * 0.92)); S.circ(c, top[0], top[1], m.cr * k); },
        detail: (c) => {
          const r2 = rngOf(m.s, 2), rr = m.cr * 0.28;
          for (let i = 0; i < 3; i++) { const a = r2.range(0, TAU), d = rr * r2.range(0, 0.8); S.dot(c, rgba('#ffffff', 0.55), top[0] + Math.cos(a) * d, top[1] + Math.sin(a) * d, 0.22); }
          S.dot(c, rgba('#ffffff', 0.7), top[0] - rr * 0.3, top[1] - rr * 0.3, rr * 0.35);
        } });
    }
    return { r: Math.ceil(8 * sc), h: Math.ceil(9 * sc), style: 'decor', parts };
  };

  /* ================================================================ bones */
  M.bones_pile = function (pal, opt) {
    opt = opt || {};
    const seed = opt.seed | 0, rg = rngOf(seed, 141), sc = opt.scale || 1;
    const boneS = '#9c917a', boneT = '#ebe2ca', hole = '#1a1512';
    const parts = [contact(6.5 * sc, 4.2 * sc, 0.5, 0.3, 0.32)];
    // scattered long bones with knuckled ends
    const nb = rg.int(3, 5), bones = [];
    for (let i = 0; i < nb; i++) { const a = rg.range(0, TAU), d = rg.range(1, 4.6) * sc, ang = rg.range(0, Math.PI), L = rg.range(2, 3.4) * sc; bones.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, c: Math.cos(ang) * L, s: Math.sin(ang) * L }); }
    parts.push({ z0: 0, z1: 0.9, side: boneS, top: boneT, ao: 0.4, bevel: false,
      shape: (c) => { for (const b of bones) { taper(c, b.x - b.c, b.y - b.s, b.x + b.c, b.y + b.s, 0.38, 0.38); S.circ(c, b.x - b.c, b.y - b.s, 0.62); S.circ(c, b.x + b.c, b.y + b.s, 0.62); } } });
    // a fallen ribcage arching off its spine
    if (seed % 3 !== 2) {
      const rx = rg.range(-2.5, 0.5) * sc, ry = rg.range(-2.2, -0.8) * sc, ribs = [];
      for (let i = 0; i < 5; i++) {
        const x = rx + (i - 2) * 1.05 * sc, w = (2.3 - Math.abs(i - 2) * 0.35) * sc;
        ribs.push([[x - 0.2, ry + w, 0.2], [x, ry + w * 0.7, 1.7 * sc], [x + 0.15, ry + 0.15, 2.5 * sc]]);
        ribs.push([[x - 0.2, ry - w, 0.2], [x, ry - w * 0.7, 1.7 * sc], [x + 0.15, ry - 0.15, 2.5 * sc]]);
      }
      parts.push(limbPart(ribs, 0.55, boneS, boneT));
      parts.push({ z0: 2.1 * sc, z1: 2.8 * sc, side: boneS, top: boneT, ao: 0.2, bevel: false, shape: (c) => taper(c, rx - 3.2 * sc, ry, rx + 3.2 * sc, ry + 0.2, 0.45, 0.35) });
    }
    // skull (sometimes a horned beast skull), face turned to the camera
    const kx = rg.range(-0.5, 2.5) * sc, ky = rg.range(0.8, 2.2) * sc, kr = rg.range(1.6, 2.1) * sc, horned = seed % 3 === 1;
    if (horned) {
      const hl = [];
      for (const sg of [-1, 1]) hl.push([[kx + sg * kr * 0.6, ky - 0.3, 1.8 * sc], [kx + sg * kr * 1.5, ky - 0.6, 2.6 * sc], [kx + sg * kr * 2.0, ky - 1.6, 3.8 * sc], [kx + sg * kr * 1.7, ky - 2.4, 4.6 * sc]]);
      parts.push(limbPart(hl, 0.75, '#6e6452', '#d6cbb0'));
    }
    parts.push({ z0: 0, z1: kr * 1.5, side: boneS, top: boneT, ao: 0.35,
      shape: (c, zt) => { const k = zt < 0.25 ? lerp(0.85, 1, zt / 0.25) : Math.sqrt(Math.max(0.05, 1 - Math.pow((zt - 0.25) / 0.75, 2) * 0.85)); S.ell(c, kx, ky - zt * 0.3, kr * k, kr * 0.9 * k); } });
    // sockets, nose and teeth painted onto the front of the skull
    parts.push({ z0: kr * 0.25, z1: kr * 0.95, side: hole, top: hole, ao: 0, bevel: false, flat: true,
      shape: (c, zt) => {
        const z = lerp(kr * 0.25, kr * 0.95, zt), front = ky - (z / (kr * 1.5)) * 0.3 + kr * 0.8;
        if (zt > 0.5) { S.circ(c, kx - kr * 0.38, front - 0.15, kr * 0.22); S.circ(c, kx + kr * 0.38, front - 0.15, kr * 0.22); }
        else if (zt > 0.25) S.circ(c, kx, front, kr * 0.1);
        else for (let t = -2; t <= 2; t++) S.circ(c, kx + t * kr * 0.17, front + 0.05, 0.12);
      } });
    return { r: Math.ceil(8.5 * sc), h: Math.ceil(6 * sc), style: 'decor', parts };
  };

  /* ================================================================ gallery */
  const seeds = (gen, label, list, extra) => list.map((s) => Object.assign({ name: label + ' s' + s, gen, opt: Object.assign({ seed: s }, extra || {}) }));
  (AS.Gallery = AS.Gallery || []).push(
    { group: 'Trees — oak', bg: 'human', items: seeds('tree_oak', 'oak', [0, 1, 2, 3, 4, 5, 6, 7]) },
    { group: 'Trees — pine / birch', bg: 'human', items: seeds('tree_pine', 'pine', [0, 1, 2, 3, 4]).concat(seeds('tree_birch', 'birch', [0, 1, 2, 3])) },
    { group: 'Trees — willow / orchard', bg: 'human', items: seeds('tree_willow', 'willow', [0, 1, 2]).concat(seeds('tree_fruit', 'fruit', [0, 1, 2, 3, 5])) },
    { group: 'Trees — autumn tint (human lands)', bg: 'human', items: seeds('tree_oak', 'oak autumn', [0, 1, 2, 3], { tint: 'autumn' }).concat(seeds('tree_birch', 'birch autumn', [0, 1], { tint: 'autumn' })) },
    { group: 'Elven forest', bg: 'elf', items: seeds('tree_elder', 'elder', [0, 1, 2]).concat(
      [{ name: 'elf oak (terrain pal)', gen: 'tree_oak', pal: { leafA: '#1f5a2e', leafB: '#4aa25a', bark: '#5a4a3a' }, opt: { seed: 1 } },
        { name: 'elf birch (terrain pal)', gen: 'tree_birch', pal: { leafA: '#2a7a4a', leafB: '#8ad89a' }, opt: { seed: 3 } }],
      seeds('tree_oak', 'oak emerald', [2, 4], { tint: 'emerald' })) },
    { group: 'Snow', bg: 'ice', items: seeds('tree_snowpine', 'snowpine', [0, 1, 2, 3, 4]).concat(seeds('rock_snow', 'rock_snow', [0, 1, 2, 5]), seeds('ice_shard', 'ice_shard', [0, 1, 2])) },
    { group: 'Cursed lands', bg: 'undead', items: seeds('tree_dead', 'dead', [0, 1, 2, 3, 4]).concat(
      [{ name: 'dark pine (terrain pal)', gen: 'tree_pine', pal: { leafA: '#1c2a24', leafB: '#36483c', bark: '#2a2420' }, opt: { seed: 2 } }],
      seeds('mushrooms_glow', 'mushrooms', [0, 1, 2]), seeds('rock_dark', 'rock_dark', [0, 1, 2]), [{ name: 'rock_dark glow', gen: 'rock_dark', opt: { seed: 5, glow: true } }],
      seeds('bones_pile', 'bones', [0, 1, 2]), seeds('tree_oak', 'oak dark', [0], { tint: 'dark' })) },
    { group: 'Undergrowth', bg: 'human', items: seeds('bush', 'bush', [0, 1, 2, 3]).concat(seeds('bush_berry', 'berry', [0, 1, 2]),
      [{ name: 'flowers red', gen: 'flowers', opt: { seed: 0, col: 'red' } }, { name: 'flowers yellow', gen: 'flowers', opt: { seed: 1, col: 'yellow' } }, { name: 'flowers mix', gen: 'flowers', opt: { seed: 2, col: 'mix' } }, { name: 'flowers s3', gen: 'flowers', opt: { seed: 3 } }],
      seeds('reeds', 'reeds', [0, 1, 2]), seeds('wheat', 'wheat', [0, 1, 2]), seeds('stump', 'stump', [0, 1, 2, 3]), seeds('rock_mossy', 'rock_mossy', [0, 1, 2, 5])) },
  );
})(window.AS);
