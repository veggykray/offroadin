/* WYRMCROWN — Elven faction architecture (Sylvaran Realm).
 * Ivory stone in flowing curves (leaf-shaped and crescent plans), slender spires and
 * bud domes in copper-teal (pal.t) with silver filigree ribs, veined leaf roofs, living
 * trees growing through and beside the buildings, cyan-green crystal glows (pal.g, flat).
 * Single-direction buildings: the +y walls face the camera (doors and windows sit there).
 * Generators (AS.Models, signature (pal, opt), opt optional, missing palette keys tolerated):
 *   elf_keep (opt.level 1-3, anims 4)  elf_house (opt.v 0-3)  elf_barracks (anims 4)
 *   elf_farm  elf_stable  elf_magetower (anims 4)  elf_tower (anims 4)
 *   elf_ballista (24 dirs, +x = aim)  elf_catapult (24 dirs, anims 3: cocked / swinging / released)
 *   elf_wall (16 dirs, along x, opt.level 1-3)  elf_gate (16 dirs, along x, opt.level 1-3)
 *   elf_watchtower (anims 4)  elf_temple (anims 4)  elf_market  elf_workshop
 *   elf_wardstone (anims 4)  elf_roost (anims 4) */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = (AS.Models = AS.Models || {});
  const PI = Math.PI;

  /* ================================================================ palette */
  const DEF = { a: '#97a690', b: '#efe9d6', t: '#2f8a6a', g: '#7affd8', d: '#2e3d30', k: '#23794a', k2: '#e3eaa8', w: '#6a5236', s: '#cfe0c0' };
  const P = (p) => { const o = Object.assign({}, DEF); if (p) for (const k in DEF) if (typeof p[k] === 'string' && p[k]) o[k] = p[k]; return o; };
  const hx = (c) => '#' + C.hex(c).map((v) => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const rgba = (c, a) => C.str(c, a);
  /* derived material colours for one palette */
  function kit(p) {
    return {
      p,
      stS: mx(p.b, p.a, 0.2), stT: mx(p.b, '#ffffff', 0.18),            // ivory walls
      st2S: mx(p.s, p.a, 0.35), st2T: mx(p.s, p.b, 0.45),               // pale sage stone
      plS: mx(p.a, p.d, 0.4), plT: mx(p.a, p.b, 0.4),                   // plinth / terrace
      pave: mx(p.s, p.b, 0.25),
      rfF: mx(p.t, '#bfeee0', 0.08), rfB: mx(p.t, '#e2fff4', 0.56), rfT: mx(p.t, '#f0fff8', 0.66), rfM: mx(p.t, '#d0f5e6', 0.22),
      rib: mx(p.k2, '#ffffff', 0.4), silver: '#eef5f1', silS: '#a3b6b0',
      gl: p.g, glS: mx(p.g, p.t, 0.35), glHi: mx(p.g, '#ffffff', 0.65), win: mx(p.g, '#fffbe6', 0.3),
      wd: p.w, wdS: mx(p.w, p.d, 0.25), wdT: mx(p.w, p.k2, 0.35), bark: mx(p.w, p.a, 0.5), barkT: mx(p.w, p.s, 0.6),
      silverBark: mx(mx(p.w, p.a, 0.55), '#e8eee6', 0.35), silverBarkS: mx(p.w, p.d, 0.4),
      lfD: mx(p.d, '#4f8a3a', 0.6), lfM: mx(p.k, '#8fcf58', 0.62), lfL: mx('#d2ec7a', p.k2, 0.3), lfG: mx(p.k2, '#f0c850', 0.55),
      bn: p.k, bn2: p.k2, dark: mx(p.d, '#000000', 0.45), door: mx(p.w, p.d, 0.3),
      fil: rgba(mx('#ffffff', p.k2, 0.25), 0.75), seam: rgba(p.d, 0.35), seamL: 'rgba(255,255,255,0.3)',
      water: mx(p.t, p.d, 0.35), hay: '#d9b95a', hayS: '#a8873a',
      yard: mx(p.d, '#c9b47a', 0.55), yardS: mx(p.d, '#8a7650', 0.4),
    };
  }

  /* ================================================================ geometry */
  const res = () => (AS.Forge && AS.Forge.res) || 2;
  const dzOf = (z0, z1) => (z1 - z0) / Math.max(1, Math.round((z1 - z0) * res()));
  const headingOf = (c) => { const m = c.getTransform(); return Math.atan2(m.b, m.a); };
  /* does an object-space normal (nx, ny) face the camera (screen down) at this heading? */
  const facing = (c, nx, ny, k) => { const a = headingOf(c); return nx * Math.sin(a) + ny * Math.cos(a) > (k || 0); };
  const ngon = (n, r, rot, cx, cy, sy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r * (sy || 1)); } return a; };
  function tf(pts, ox, oy, a) {
    const ca = Math.cos(a || 0), sa = Math.sin(a || 0), out = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) { out[i] = ox + pts[i] * ca - pts[i + 1] * sa; out[i + 1] = oy + pts[i] * sa + pts[i + 1] * ca; }
    return out;
  }
  /* leaf outline point: u 0..TAU, tip at +x (sharpness sf), stem end at -x (sb); 1 = pointed, 0 = round */
  function leafXY(u, L, W, sf, sb) {
    const cu = Math.cos(u), su = Math.sin(u);
    const e = 1 + (sb + (sf - sb) * (0.5 + 0.5 * cu));
    return [L * cu, W * Math.sign(su) * Math.pow(Math.abs(su), e)];
  }
  function leafPts(cx, cy, L, W, rot, sf, sb, n) {
    n = n || 32; sf = sf === undefined ? 1 : sf; sb = sb === undefined ? 0.35 : sb;
    const a = [];
    for (let i = 0; i < n; i++) { const q = leafXY(i / n * TAU, L, W, sf, sb); a.push(q[0], q[1]); }
    return tf(a, cx, cy, rot);
  }
  /* half a leaf (side s = +1 → local +y) closed along the midrib */
  function halfLeaf(cx, cy, L, W, rot, s, sf, sb, n) {
    n = n || 16; const a = [];
    for (let i = 0; i <= n; i++) { const q = leafXY(i / n * PI * s, L, W, sf, sb); a.push(q[0], q[1]); }
    return tf(a, cx, cy, rot);
  }
  /* point + outward normal on a leaf outline at parameter u */
  function leafNorm(cx, cy, L, W, rot, u, sf, sb) {
    const q0 = leafXY(u - 0.01, L, W, sf, sb), q1 = leafXY(u + 0.01, L, W, sf, sb), q = leafXY(u, L, W, sf, sb);
    let nx = q1[1] - q0[1], ny = -(q1[0] - q0[0]);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * q[0] + ny * q[1] < 0) { nx = -nx; ny = -ny; }
    const ca = Math.cos(rot || 0), sa = Math.sin(rot || 0);
    return [cx + q[0] * ca - q[1] * sa, cy + q[0] * sa + q[1] * ca, nx * ca - ny * sa, nx * sa + ny * ca];
  }
  /* tapered crescent band along an arc (centre cx,cy, mid radius R, half width w) */
  function crescentPts(cx, cy, R, w, a0, a1, n, pw) {
    n = n || 24; pw = pw === undefined ? 0.6 : pw; const o = [], inn = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u, hw = w * Math.pow(Math.max(0, Math.sin(PI * u)), pw) + 0.15;
      o.push(cx + Math.cos(a) * (R + hw), cy + Math.sin(a) * (R + hw));
      inn.unshift(cy + Math.sin(a) * (R - hw)); inn.unshift(cx + Math.cos(a) * (R - hw));
    }
    return o.concat(inn);
  }
  /* one half of a crescent roof: from the ridge arc (radius R) out (s=+1) or in (s=-1) by ww */
  function halfCres(cx, cy, R, ww, a0, a1, s, pw, n) {
    n = n || 32; const o = [], e = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = a0 + (a1 - a0) * u, t = Math.pow(Math.max(0, Math.sin(PI * u)), pw) * 0.85 + 0.15;
      o.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      e.unshift(cy + Math.sin(a) * (R + s * ww * t)); e.unshift(cx + Math.cos(a) * (R + s * ww * t));
    }
    return o.concat(e);
  }
  function sector(c, cx, cy, r0, r1, a0, a1) { c.moveTo(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1); c.arc(cx, cy, r1, a0, a1); c.arc(cx, cy, r0, a1, a0, true); c.closePath(); }
  function annulus(c, x, y, r1, r2) { c.moveTo(x + r1, y); c.arc(x, y, r1, 0, TAU); c.moveTo(x + r2, y); c.arc(x, y, r2, TAU, 0, true); }
  /* thin quad on a wall at (x,y) with outward normal (nx,ny), half width hw along the wall */
  function wallQuad(c, x, y, nx, ny, hw, out, inn) {
    const tx = -ny, ty = nx, o = out === undefined ? 0.35 : out, i = inn === undefined ? 0.7 : inn;
    c.moveTo(x + tx * hw + nx * o, y + ty * hw + ny * o); c.lineTo(x - tx * hw + nx * o, y - ty * hw + ny * o);
    c.lineTo(x - tx * hw - nx * i, y - ty * hw - ny * i); c.lineTo(x + tx * hw - nx * i, y + ty * hw - ny * i); c.closePath();
  }
  /* pointed (elven) arch profile: 1 up to the springline, tapering to 0 at the apex */
  const archW = (zt, spring) => { const s = spring === undefined ? 0.55 : spring; return zt < s ? 1 : Math.max(0.05, 1 - Math.pow((zt - s) / (1 - s), 1.7)); };
  /* radius profiles (zt 0..1 → factor) */
  const PROF = {
    dome: (z) => Math.sqrt(Math.max(0.0025, 1 - z * z)),
    bud: (z) => (z < 0.38 ? 1 + 0.16 * Math.sin(z / 0.38 * PI / 2) : 1.16 * Math.pow(Math.cos((z - 0.38) / 0.62 * PI / 2), 1.35)) + 0.02,
    spire: (z) => Math.pow(1 - z, 1.55) + 0.02,
    cone: (z) => 1 - z * 0.97,
    flare: (z) => Math.pow(1 - z, 2.2) * 0.75 + (1 - z) * 0.25 + 0.02,
  };
  /* slice-wise stroked curves: f(z) -> [x, y] or null. Consecutive slices are joined so
   * near-horizontal members (arms, boughs) stay continuous. */
  function curvePart(curves, z0, z1, stroke, side, top, extra) {
    const dz = dzOf(z0, z1);
    return Object.assign({ z0, z1, side, top, stroke, bevel: false, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0);
      for (const f of curves) {
        const a = f(z), b = f(Math.min(z1, z + dz * 1.05));
        if (!a || !b) continue;
        c.moveTo(a[0], a[1]); c.lineTo(b[0] + (a[0] === b[0] && a[1] === b[1] ? 0.01 : 0), b[1]);
      }
    } }, extra || {});
  }

  /* ================================================================ depth sorter */
  /* first part of a model: re-orders the rest by layer then back-to-front by the screen depth
   * of each part's anchor `at` for the heading being rendered (shared anchors keep their order) */
  function sorted(parts) {
    const all = [null].concat(parts.filter(Boolean));
    all[0] = { z0: 0, z1: 0, flat: true, bevel: false, side: '#000000', top: '#000000', shape: (c) => {
      const a = headingOf(c), ca = Math.cos(a), sa = Math.sin(a);
      const rest = all.slice(1).map((p, i) => ({ p, i, l: p.layer || 0, d: p.at ? p.at[0] * sa + p.at[1] * ca : 0 }));
      rest.sort((A, B) => (A.l - B.l) || (A.d - B.d) || (A.i - B.i));
      for (let i = 0; i < rest.length; i++) all[i + 1] = rest[i].p;
    } };
    return all;
  }
  const anchor = (at, list) => { for (const q of list) if (q && !q.at && at) q.at = at; return list; };

  /* ================================================================ detail painters */
  function glowDot(c, col, x, y, r, a) {
    const A = a === undefined ? 0.95 : a;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(mx(col, '#ffffff', 0.5), A)); g.addColorStop(0.4, rgba(col, A * 0.6)); g.addColorStop(1, rgba(col, 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function ring(c, col, x, y, r, w, a0, a1) { c.save(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(x, y, r, a0 || 0, a1 === undefined ? TAU : a1); c.stroke(); c.restore(); }
  /* silver filigree curl: a vine stroke ending in a spiral, at (x,y) heading rot, size s */
  function curl(c, col, x, y, s, rot, w, flip) {
    const f = flip ? -1 : 1;
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s * f);
    c.strokeStyle = col; c.lineWidth = (w || 0.4) / s; c.beginPath();
    c.moveTo(-1, 0); c.bezierCurveTo(-0.4, -0.6, 0.4, 0.5, 0.9, -0.1);
    c.arc(0.65, -0.1, 0.25, 0, -PI * 1.6, true);
    c.stroke(); c.restore();
  }
  /* ring of filigree curls */
  function curlRing(c, col, x, y, r, n, s, w) { for (let i = 0; i < n; i++) { const a = i / n * TAU; curl(c, col, x + Math.cos(a) * r, y + Math.sin(a) * r, s, a + PI / 2, w, i % 2); } }
  /* leaf-texture speckle over a crown top */
  function leafSpeckle(c, x, y, r, seed, cols, n) {
    c.save();
    for (let i = 0; i < (n || 14); i++) {
      const a = U.hash2(i, seed, 3) * TAU, d = Math.sqrt(U.hash2(i, seed, 5)) * r * 0.85;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      c.fillStyle = cols[i % cols.length]; c.beginPath(); S.ell(c, px, py, 0.9 + U.hash2(i, seed, 9) * 0.9, 0.55, a); c.fill();
    }
    c.restore();
  }
  /* claw scratches: three parallel raking gouges */
  function scratches(c, x, y, s, rot, col, hi) {
    c.save(); c.translate(x, y); c.rotate(rot); c.lineCap = 'round';
    for (const [cc, w, dy] of [[hi || 'rgba(255,255,255,0.25)', 0.35, 0.3], [col, 0.5, 0]]) {
      c.strokeStyle = cc; c.lineWidth = w; c.beginPath();
      for (let i = -1; i <= 1; i++) { c.moveTo(-s, i * s * 0.3 + dy); c.quadraticCurveTo(0, i * s * 0.34 + s * 0.12 + dy, s * (0.9 - Math.abs(i) * 0.15), i * s * 0.26 - s * 0.1 + dy); }
      c.stroke();
    }
    c.restore();
  }
  /* mosaic of leaf shapes (paving) inside radius r */
  function leafMosaic(c, x, y, r, n, col) {
    c.save(); c.fillStyle = col;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; c.beginPath(); S.poly(c, leafPts(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.3, r * 0.1, a, 1, 0.6, 14)); c.fill(); }
    c.restore();
  }

  /* ================================================================ part builders */
  /* stone foundation (darker, slightly wider) */
  const plinth = (k, shp, z1, extra) => Object.assign({ z0: 0, z1: z1 || 1.5, side: k.plS, top: k.plT, ao: 0.25, shape: shp }, extra || {});
  /* ivory wall body */
  const wallP = (k, shp, z0, z1, extra) => Object.assign({ z0, z1, side: k.stS, top: k.stT, ao: 0.42, shape: shp }, extra || {});
  /* band on the camera-facing half of round walls (heading aware) */
  function frontBand(k, pts, r, z0, z1, side, top, w) {
    w = w || 0.9;
    return { z0, z1, side: side || k.silS, top: top || k.rib, bevel: false, ao: 0.1, shape: (c) => {
      const a0 = -headingOf(c);
      for (const q of pts) {
        c.moveTo(q[0] + Math.cos(a0) * (r + w * 0.4), q[1] + Math.sin(a0) * (r + w * 0.4)); c.arc(q[0], q[1], r + w * 0.4, a0, a0 + PI);
        c.arc(q[0], q[1], r - w * 0.6, a0 + PI, a0, true); c.closePath();
      }
    } };
  }
  /* railing on the camera-facing half of a round platform: posts + top rail */
  function rail(k, x, y, r, z0, h, n) {
    return { z0, z1: z0 + h, side: k.silS, top: k.silver, bevel: false, ao: 0.1, shape: (c, zt) => {
      const a0 = -headingOf(c);
      if (zt > 0.78) { c.moveTo(x + Math.cos(a0 - 0.1) * (r + 0.25), y + Math.sin(a0 - 0.1) * (r + 0.25)); c.arc(x, y, r + 0.25, a0 - 0.1, a0 + PI + 0.1); c.arc(x, y, r - 0.35, a0 + PI + 0.1, a0 - 0.1, true); c.closePath(); return; }
      const m = n || 12; for (let i = 0; i <= m; i++) { const a = a0 + i / m * PI; S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.22); }
    } };
  }

  /* leaf roof: two planes meeting at a ridge along the leaf axis, silver leaf veins on the
   * visible planes, a pale ridge cap and upswept tips. Lit plane = the half facing the sun. */
  function leafRoof(k, o) {
    const { x, y, L, W, rot = 0, z0, H } = o;
    const sf = o.sf === undefined ? 1 : o.sf, sb = o.sb === undefined ? 0.55 : o.sb;
    const prof = o.prof || ((z) => Math.pow(1 - z, 1.2));
    const lk = o.lk === undefined ? 0.18 : o.lk;
    const parts = [];
    for (const s of [-1, 1]) {
      const nx = -s * Math.sin(rot), ny = s * Math.cos(rot);
      const lit = o.even ? 0.45 : U.clamp(0.5 - (nx * 0.55 + ny * 0.83) * 0.7, 0, 1);
      const side = mx(o.dark || k.rfF, o.light || k.rfB, lit);
      parts.push({ z0, z1: z0 + H, side, top: mx(side, '#ffffff', 0.2), ao: 0.22, bevel: false,
        shape: (c, zt) => S.poly(c, halfLeaf(x, y, L * (1 - lk * zt), W * prof(zt) + 0.15, rot, s, sf, sb, 18)) });
    }
    const nv = o.veins === undefined ? 4 : o.veins;
    if (nv) {
      const halfAt = (xl, zt) => { const Lz = L * (1 - lk * zt), q = U.clamp(xl / Lz, -1, 1), u = Math.acos(q); return leafXY(u, Lz, W * prof(zt) + 0.15, sf, sb)[1]; };
      const ca = Math.cos(rot), sa = Math.sin(rot);
      parts.push({ z0: z0 + 0.3, z1: z0 + H - 0.2, side: o.veinS || k.silS, top: o.vein || k.rib, bevel: false, ao: 0.05,
        shape: (c, zt) => {
          for (const s2 of [-1, 1]) {
            const nwx = -s2 * sa, nwy = s2 * ca;
            if (!facing(c, nwx, nwy, -0.25)) { const d = (W / H) * (prof(Math.max(0, zt - 0.05)) - prof(Math.min(1, zt + 0.05))) / 0.1; if (d < 1.25) continue; }
            for (let i = 0; i < nv; i++) {
              const xr = L * (1 - lk) * (0.75 - 1.5 * (i + 0.5) / nv) * 0.9, xe = xr - L * 0.32;
              const xl = xe + (xr - xe) * zt, yl = s2 * halfAt(xl, zt);
              if (Math.abs(xl) > L * (1 - lk * zt) * 0.92) continue;
              S.circ(c, x + xl * ca - yl * sa, y + xl * sa + yl * ca, 0.3);
            }
          }
        } });
    }
    const L1 = L * (1 - lk) * 0.98;
    const tip = tf([L1, 0, -L1 * 0.94, 0], x, y, rot);
    parts.push({ z0: z0 + H - 0.4, z1: z0 + H + 0.4, side: k.silS, top: o.ridge || k.rib, stroke: 0.75, bevel: false, shape: (c) => S.seg(c, tip[0], tip[1], tip[2], tip[3]) });
    if (o.horns !== false) {
      const hz = o.hornH || 4;
      parts.push({ z0: z0 + H - 0.5, z1: z0 + H + hz, side: k.silS, top: k.rib, bevel: false, shape: (c, zt) => {
        const r = 0.7 * (1 - zt) + 0.12, out = zt * zt * 2.2;
        const a = tf([L1 + out, 0, -(L1 * 0.94 + out), 0], x, y, rot);
        S.circ(c, a[0], a[1], r); if (o.horns !== 'front') S.circ(c, a[2], a[3], r);
      } });
    }
    return parts;
  }

  /* crescent roof over a curved hall: outer (back, lit) and inner (front, shaded) planes,
   * radial silver veins on the inner plane and a ridge cap along the arc */
  function crescentRoof(k, o) {
    const { x, y, R, w, a0, a1, z0, H } = o;
    const pw = o.pw === undefined ? 0.12 : o.pw;
    const prof = o.prof || ((z) => Math.pow(1 - z, 1.15));
    const parts = [];
    parts.push({ z0, z1: z0 + H, side: o.light || k.rfB, top: k.rfT, ao: 0.15, bevel: false, shape: (c, zt) => S.poly(c, halfCres(x, y, R, w * prof(zt) + 0.12, a0, a1, 1, pw)) });
    parts.push({ z0, z1: z0 + H, side: o.dark || k.rfF, top: k.rfT, ao: 0.25, bevel: false, shape: (c, zt) => S.poly(c, halfCres(x, y, R, w * prof(zt) + 0.12, a0, a1, -1, pw)) });
    const nv = o.veins === undefined ? Math.round((a1 - a0) * R / 7) : o.veins;
    parts.push({ z0: z0 + 0.3, z1: z0 + H - 0.2, side: k.silS, top: k.rib, bevel: false, ao: 0.05, shape: (c, zt) => {
      const hd = -headingOf(c);
      for (let i = 0; i < nv; i++) {
        const u = (i + 0.5) / nv, a = a0 + (a1 - a0) * u + (1 - zt) * 0.04, t = Math.pow(Math.max(0, Math.sin(PI * u)), pw) * 0.85 + 0.15;
        if (Math.sin(a - hd) > -0.15) continue;
        const r = R - (w * prof(zt) + 0.12) * t;
        S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.3);
      }
    } });
    parts.push({ z0: z0 + H - 0.4, z1: z0 + H + 0.4, side: k.silS, top: k.rib, stroke: 0.75, bevel: false, shape: (c) => { c.moveTo(x + Math.cos(a0 + 0.04) * R, y + Math.sin(a0 + 0.04) * R); c.arc(x, y, R, a0 + 0.04, a1 - 0.04); } });
    return parts;
  }

  /* round tower bodies (optionally flared at the base); pts = [[x,y],...] */
  function towerBody(k, pts, r, z0, z1, flare, extra) {
    const f = flare || 0;
    return Object.assign({ z0, z1, side: k.stS, top: k.stT, ao: 0.45, shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], r * (1 + f * Math.pow(1 - zt, 3))); } }, extra || {});
  }
  /* bud dome / spire roof: lit stripe, filigree ribs on the camera side, needle finial */
  function capRoof(k, o) {
    const pts = o.pts, R = o.R, z0 = o.z0, H = o.H;
    const prof = PROF[o.prof || 'bud'];
    const parts = [];
    if (o.band) parts.push({ z0: z0 - 0.5, z1: z0 + 0.6, side: k.silS, top: k.rib, bevel: false, shape: (c) => { for (const q of pts) S.circ(c, q[0], q[1], R * prof(0) + 0.5); } });
    parts.push({ z0, z1: z0 + H, side: o.side || k.rfM, top: o.top || k.rfT, ao: o.ao === undefined ? 0.35 : o.ao,
      shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], R * prof(zt)); } });
    if (o.hi !== false) parts.push({ z0: z0 + 0.4, z1: z0 + H * 0.8, side: mx(k.rfB, '#ffffff', 0.12), top: k.rfT, bevel: false, ao: 0.25,
      shape: (c, zt) => { const a0 = -headingOf(c), r = R * prof(zt * 0.8) + 0.08, w = Math.min(1.3, r * 0.38); for (const q of pts) { c.moveTo(q[0] + Math.cos(a0 + PI * 0.6) * r, q[1] + Math.sin(a0 + PI * 0.6) * r); c.arc(q[0], q[1], r, a0 + PI * 0.6, a0 + PI * 0.92); c.arc(q[0], q[1], r - w, a0 + PI * 0.92, a0 + PI * 0.6, true); c.closePath(); } } });
    const nr = o.ribs === undefined ? 5 : o.ribs;
    if (nr) parts.push({ z0: z0 + 0.3, z1: z0 + H * 0.88, side: k.silS, top: k.rib, bevel: false, ao: 0.1,
      shape: (c, zt) => { const hd = -headingOf(c), r = R * prof(zt * 0.88) + 0.1, rr = Math.max(0.16, 0.4 * (1 - zt * 0.6)); for (const q of pts) for (let i = 0; i < nr; i++) { const a = hd + PI * (i + 0.5) / nr; S.circ(c, q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r, rr); } } });
    const fh = o.finial === undefined ? H * 0.55 : o.finial;
    if (fh > 0) parts.push({ z0: z0 + H - 1, z1: z0 + H + fh, side: k.silS, top: k.silver, bevel: false, ao: 0,
      shape: (c, zt) => { const r = 0.55 * (1 - zt) + 0.1 + (Math.abs(zt - 0.3) < 0.07 ? 0.5 : 0); for (const q of pts) S.circ(c, q[0], q[1], r); } });
    return parts;
  }
  /* pointed-arch windows on round walls. angs: angles (0 = +x, PI/2 = front); rel → measured
   * from the screen-facing side (rotating sheets); inner → the wall faces the centre */
  function arcWins(k, pts, r, z0, z1, angs, hwA, col, extra, rel, inner) {
    const o1 = inner ? -0.35 : 0.3, o2 = inner ? 0.75 : -0.7;
    return Object.assign({ z0, z1, side: sh(col || k.win, -0.2), top: col || k.win, flat: true, bevel: false, ao: 0,
      shape: (c, zt) => { const w = hwA * archW(zt), off = rel ? -headingOf(c) : 0; for (const q of pts) for (const a0 of angs) { const a = a0 + off; c.moveTo(q[0] + Math.cos(a - w) * (r + o1), q[1] + Math.sin(a - w) * (r + o1)); c.arc(q[0], q[1], r + o1, a - w, a + w); c.arc(q[0], q[1], r + o2, a + w, a - w, true); c.closePath(); } } }, extra || {});
  }
  /* pointed-arch windows / doors on a leaf-shaped wall at outline parameters us */
  function leafWins(k, o, us, z0, z1, hw, col, extra) {
    return Object.assign({ z0, z1, side: sh(col || k.win, -0.2), top: col || k.win, flat: true, bevel: false, ao: 0,
      shape: (c, zt) => { for (const u of us) { const q = leafNorm(o.x, o.y, o.L, o.W, o.rot || 0, u, o.sf === undefined ? 1 : o.sf, o.sb === undefined ? 0.35 : o.sb); wallQuad(c, q[0], q[1], q[2], q[3], hw * archW(zt)); } } }, extra || {});
  }
  /* arched silver frames around those windows (drawn before the glass) */
  function leafFrames(k, o, us, z0, z1, hw, extra) { return leafWins(k, o, us, z0, z1 + 0.6, hw + 0.45, k.rib, Object.assign({ flat: false, side: k.silS, top: k.silver }, extra || {})); }

  /* climbing vine: a helix of leaf dots around a round shaft (front half only) */
  function vine(k, x, y, rAt, z0, z1, turns, a0) {
    return { z0, z1, side: k.lfM, top: k.lfL, bevel: false, ao: 0.2, shape: (c, zt) => {
      const z = z0 + zt * (z1 - z0), hd = -headingOf(c);
      for (const off of [0, PI * 0.9]) {
        const a = a0 + off + zt * turns * TAU, r = rAt(z) + 0.25;
        if (Math.sin(a - hd) < 0.08) continue;
        const lf = (Math.sin(zt * 70 + off) > 0.55) ? 0.75 : 0.42;
        S.circ(c, x + Math.cos(a) * r, y + Math.sin(a) * r, lf);
      }
    } };
  }
  /* scalloped cloud outline (union of circles): painted-tree crowns */
  function cloud(c, x, y, r, seed, n) {
    n = n || 8; S.circ(c, x, y, r * 0.7);
    for (let i = 0; i < n; i++) {
      const a = (i + U.hash2(i, seed, 41) * 0.5) / n * TAU + seed, rr = r * (0.3 + 0.12 * U.hash2(i, seed, 43));
      S.circ(c, x + Math.cos(a) * (r - rr), y + Math.sin(a) * (r - rr) * 0.94, rr);
    }
  }
  /* leaf clumps scattered over the camera-facing surface of a crown (slice-wise dots) */
  function leafTex(cx, cy, cz, cr, ch, prof, seed, col, n, a0, a1, zr) {
    const dots = [];
    for (let i = 0; i < n; i++) dots.push([zr[0] + (zr[1] - zr[0]) * U.hash2(i, seed, 51), a0 + (a1 - a0) * U.hash2(i, seed, 53), 0.55 + 0.6 * U.hash2(i, seed, 57)]);
    return { z0: cz, z1: cz + ch, side: col, top: col, bevel: false, ao: 0.05, shape: (c, zt) => {
      const hd = -headingOf(c);
      for (const d of dots) {
        const dz = (zt - d[0]) * ch; if (Math.abs(dz) >= d[2]) continue;
        const rr = Math.sqrt(d[2] * d[2] - dz * dz), r = cr * prof(zt) + 0.1, a = d[1] + hd;
        S.ell(c, cx + Math.cos(a) * (r - rr * 0.3), cy + Math.sin(a) * (r - rr * 0.3), rr * 1.3, rr * 0.8, a + PI / 2);
      }
    } };
  }
  /* leafy crown only (cloud body + lit cluster + leaf clumps) — branches, crowns on trunks */
  function crown(k, o) {
    const cx = o.x, cy = o.y, cz = o.z0, cr = o.cr, ch = o.ch || cr * 1.1, seed = o.seed || 1;
    const prof = (zt) => (zt < 0.4 ? 0.72 + 0.28 * Math.sin(zt / 0.4 * PI / 2) : Math.sqrt(Math.max(0.02, 1 - Math.pow((zt - 0.4) / 0.6, 2))));
    const lm = o.leafM || k.lfM, ll = o.leafL || k.lfL;
    const parts = [{ z0: cz, z1: cz + ch, side: lm, top: ll, ao: 0.6, shape: (c, zt) => cloud(c, cx, cy, cr * prof(zt) + 0.2, seed, 9) }];
    parts.push(leafTex(cx, cy, cz, cr, ch, (zt) => prof(zt) * 1.02, seed, mx(lm, k.lfD, 0.45), Math.round(cr * 0.9), PI * 0.05, PI * 0.95, [0.12, 0.5]));
    const hq = (zt) => { const q = zt * 1.6 - 0.6; return 0.52 * Math.sqrt(Math.max(0.02, 1 - q * q)); };
    const hx0 = cx - cr * 0.25, hy0 = cy - cr * 0.28;
    parts.push({ z0: cz + ch * 0.45, z1: cz + ch * 1.08, side: mx(lm, ll, 0.45), top: ll, ao: 0.25,
      shape: (c, zt) => cloud(c, hx0, hy0, cr * hq(zt), seed + 5, 6) });
    parts.push(leafTex(hx0, hy0, cz + ch * 0.45, cr, ch * 0.63, hq, seed + 9, o.gold ? k.lfG : mx(ll, '#ffffff', 0.25), Math.round(cr * (o.gold ? 0.9 : 0.6)), PI * 0.1, PI * 1.1, [0.25, 0.8]));
    return parts;
  }
  /* living tree: flared trunk with roots, cloud crown with dark underside and lit top-left cluster */
  function tree(k, o) {
    const { x, y } = o, z0 = o.z0 || 0, th = o.th || 10, cr = o.cr || 10, ch = o.ch || cr * 1.1, seed = o.seed || 1;
    const tr = o.tr || Math.max(0.9, cr * 0.13);
    const lean = o.lean || [0, 0];
    const cz = z0 + th;
    const parts = [{ z0, z1: cz + ch * 0.3, side: o.bark || k.bark, top: o.barkT || k.barkT, ao: 0.35,
      shape: (c, zt) => {
        const r = tr * (1 + 1.3 * Math.pow(1 - zt, 6)), lx = x + lean[0] * zt, ly = y + lean[1] * zt;
        S.circ(c, lx, ly, r);
        if (zt < 0.16 && !o.noRoots) for (let i = 0; i < 4; i++) { const a = i * 1.7 + seed, d = tr * (1.4 + (0.16 - zt) * 9); S.circ(c, lx + Math.cos(a) * d, ly + Math.sin(a) * d * 0.8, tr * 0.5 * (1 - zt * 4)); }
      } }];
    return parts.concat(crown(k, { x: x + lean[0], y: y + lean[1], z0: cz, cr, ch, seed, gold: o.gold, leafM: o.leafM, leafL: o.leafL }));
  }

  /* crystals: hexagonal prism with a pointed top (flat glow) and a lit facet sliver */
  function crystal(k, pts, z0, r, h, o) {
    o = o || {};
    const col = o.col || k.gl;
    const prof = (zt) => (zt < 0.62 ? 0.75 + 0.25 * Math.sin(zt / 0.62 * PI / 2) : (1 - zt) / 0.38) + 0.03;
    const rot = o.rot === undefined ? 0.3 : o.rot;
    const pul = (an) => (o.pulse ? 1 + 0.1 * Math.sin(an * TAU) : 1);
    return [
      { z0, z1: z0 + h, side: mx(col, k.p.t, 0.3), top: mx(col, '#ffffff', 0.55), flat: true, bevel: false, ao: -0.2,
        shape: (c, zt, an) => { for (const q of pts) S.poly(c, ngon(6, r * prof(zt) * pul(an), rot, q[0], q[1])); },
        detail: o.halo ? (c, an) => { for (const q of pts) glowDot(c, col, q[0], q[1], r * 2.2 * pul(an), 0.5); } : undefined },
      { z0, z1: z0 + h, side: mx(col, '#ffffff', 0.55), top: '#ffffff', flat: true, bevel: false, ao: 0,
        shape: (c, zt, an) => { for (const q of pts) { const rr = r * prof(zt) * pul(an) + 0.05; const a = ngon(6, rr, rot, q[0], q[1]), b = ngon(6, rr * 0.5, rot, q[0], q[1]); S.poly(c, [a[6], a[7], a[8], a[9], b[8], b[9], b[6], b[7]]); } } },
    ];
  }

  /* banners: silver pole with a knob and a swallow-tailed pennant that flutters with anim.
   * pts = [[x, y, dir]] (dir ±1 = side the cloth flies to) */
  function banner(k, pts, z0, h, o) {
    o = o || {};
    const fl = o.len || 4.6, fh = o.fh || h * 0.5, top = z0 + h;
    const cloth = (c, q, zt, an, u0, u1, inset, wid) => {
      const n = 6, w = fl * (0.55 + 0.45 * zt), dir = q[2] || 1, a = [], b = [];
      for (let i = 0; i <= n; i++) {
        const u = u0 + (u1 - u0) * i / n, xx = q[0] + dir * (0.3 + u * w);
        const wy = Math.sin(u * 4.2 - an * TAU + zt * 0.8) * 0.6 * u;
        a.push(xx, q[1] + wy - wid + inset); b.unshift(q[1] + wy + wid + inset); b.unshift(xx);
      }
      S.poly(c, a.concat(b));
    };
    return [
      { z0, z1: top + 1.6, side: k.silS, top: k.rib, bevel: false, ao: 0.2, shape: (c, zt) => { const r = zt > 0.93 ? 0.65 : 0.36; for (const q of pts) S.circ(c, q[0], q[1], r); } },
      { z0: top - fh, z1: top, side: mx(o.col || k.bn, '#ffffff', 0.12), top: mx(o.col || k.bn, '#ffffff', 0.3), bevel: false, ao: 0.05,
        shape: (c, zt, an) => { for (const q of pts) { if (zt < 0.22) { const cut = (0.22 - zt) / 0.22; cloth(c, q, zt, an, 0, 0.5 - cut * 0.3, 0, 0.25); cloth(c, q, zt, an, 0.5 + cut * 0.3, 1, 0, 0.25); } else cloth(c, q, zt, an, 0, 1, 0, 0.25); } } },
      // pale trim in one part: bottom hem tips, emblem band, top hem
      { z0: top - fh, z1: top + 0.3, side: o.col2 || k.bn2, top: o.col2 || k.bn2, bevel: false, ao: 0, flat: true,
        shape: (c, zt, an) => {
          const z = top - fh + zt * (fh + 0.3);
          for (const q of pts) {
            if (z < top - fh + 0.7) { cloth(c, q, 0, an, 0, 0.2, 0.12, 0.3); cloth(c, q, 0, an, 0.8, 1, 0.12, 0.3); }
            else if (z > top - fh * 0.66 && z < top - fh * 0.4) cloth(c, q, 0.5, an, 0.15, 0.6, 0.18, 0.2);
            else if (z > top - 0.3) cloth(c, q, 1, an, 0, 1, 0.1, 0.32);
          }
        } },
    ];
  }
  /* crystal lanterns on slender silver posts */
  function lantern(k, pts, h, z0) {
    z0 = z0 || 0;
    return [
      { z0, z1: z0 + h, side: k.silS, top: k.silver, bevel: false, ao: 0.3, shape: (c, zt) => { for (const q of pts) S.circ(c, q[0], q[1], 0.35 + (zt < 0.08 ? 0.5 : 0)); } },
      { z0: z0 + h, z1: z0 + h + 2.2, side: k.glS, top: k.glHi, flat: true, bevel: false, ao: -0.2,
        shape: (c, zt) => { for (const q of pts) S.poly(c, ngon(4, 0.95 * (zt < 0.5 ? 0.6 + zt * 0.8 : (1 - zt) * 2) + 0.08, PI / 4, q[0], q[1])); },
        detail: (c) => { for (const q of pts) glowDot(c, k.gl, q[0], q[1], 2.6, 0.55); } },
    ];
  }
  /* steps descending toward +y: from yTop (height z) to yBot (ground), with lit nosings */
  function stairs(k, x, yTop, yBot, w, z, n, cols) {
    n = n || Math.max(2, Math.round(z / 0.9));
    const dy = (yBot - yTop) / n;
    const cs = cols || [k.plS, k.pave];
    return [
      { z0: 0, z1: z, side: cs[0], top: cs[1], ao: 0.2, shape: (c, zt) => { const m = Math.min(n, Math.ceil((1 - zt) * n + 1e-6)); S.rect(c, x - w / 2, yTop, w, dy * Math.max(1, m)); } },
      { z0: 0, z1: z, side: k.stT, top: k.stT, flat: true, bevel: false, shape: (c, zt) => { const f = (1 - zt) * n, m = Math.ceil(f - 1e-6); if (m < 1 || m - f > 0.34) return; S.rect(c, x - w / 2, yTop + dy * m - 0.35, w, 0.35); } },
    ];
  }
  /* a recurve limb lying flat along +x from (x0, y0) */
  function limbFlat(x0, y0) { const a = []; for (let i = 0; i <= 10; i++) { const u = i / 10; a.push(x0 + u * 10, y0 + 1.6 * u * u + 0.7 * Math.sin(u * PI)); } for (let i = 10; i >= 0; i--) { const u = i / 10; a.push(x0 + u * 10, y0 + 1.6 * u * u - 0.7 * Math.sin(u * PI) - 0.3); } return a; }
  /* lying cylinder profile (logs, bales, bolts of cloth) */
  const cylW = (zt) => Math.sqrt(Math.max(0.04, 1 - (2 * zt - 1) * (2 * zt - 1)));

  /* floating segmented halo ring (back or front half), bobbing with anim */
  function halo(k, x, y, z, r, front) {
    const out = [];
    for (let f = 0; f < 4; f++) {
      const dz = Math.sin(f / 4 * TAU) * 0.8;
      out.push({ z0: z + dz, z1: z + dz + 1, side: k.glS, top: k.glHi, flat: true, stroke: 0.8, bevel: false, when: (an) => Math.floor(an * 4 + 1e-6) % 4 === f,
        shape: (c) => { const hd = -headingOf(c), t0 = front ? hd : hd + PI; for (let i = 0; i < 3; i++) { const a0 = t0 + i * PI / 3 + 0.08 + f * 0.2, a1 = a0 + PI / 3 - 0.3; c.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r); c.arc(x, y, r, a0, a1); } } });
    }
    return out;
  }

  /* ==================================================================
   * KEEP — the Sylvaran citadel. A leaf-shaped terrace, a crescent hall embracing
   * a tiered round keep with a veined bud dome, a great tree behind. L2 adds spired
   * towers at the crescent tips and front corners; L3 is a grand citadel with a
   * crystal crown and halo (anims 4: banners flutter, crystals pulse).
   * ================================================================== */
  M.elf_keep = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal)), L = U.clamp((opt.level | 0) || 1, 1, 3), s = [1, 1.14, 1.28][L - 1];
    const parts = [];
    const TL = 44 * s, TW = 41 * s, TY = 4, TZ = L === 1 ? 3 : 5;
    const terr = (f) => leafPts(0, TY, TL * f, TW * f, PI / 2, 0.55, 0, 44);
    const KY = -3, kr = [12, 13, 14.5][L - 1];
    // ---- terrace
    if (L > 1) parts.push(plinth(k, (c) => S.poly(c, terr(1.07)), 2.5, { at: [0, -99], layer: -1 }));
    parts.push({ z0: L > 1 ? 2.5 : 0, z1: TZ, side: k.plS, top: mx(k.pave, k.p.a, 0.12), ao: 0.3, at: [0, -99], layer: -1, shape: (c) => S.poly(c, terr(1)),
      detail: (c) => {
        c.save(); c.fillStyle = rgba(k.stT, 0.75); c.beginPath(); S.rect(c, -5, KY + kr, 10, TL + TY - KY - kr); c.fill(); c.restore();
        S.lines(c, k.seam, 0.35, [-5, KY + kr, -5, TY + TL * 0.9, 5, KY + kr, 5, TY + TL * 0.9]);
        for (let yy = KY + kr + 3; yy < TY + TL * 0.85; yy += 3.2) S.lines(c, rgba(k.p.d, 0.2), 0.3, [-5, yy, 5, yy]);
        ring(c, k.fil, 0, KY, kr + 4.5, 0.45);
        ring(c, rgba(k.p.d, 0.18), 0, KY, kr + 9, 0.4);
        for (const sx of [-1, 1]) {
          const gx = sx * TW * 0.47, gy = TY + TL * 0.14;
          c.fillStyle = mx(k.lfM, k.lfD, 0.35); c.beginPath(); S.poly(c, leafPts(gx, gy, 8 * s, 3.8 * s, PI / 2 - sx * 0.7, 1, 0.3, 24)); c.fill();
          for (let i = 0; i < 7; i++) S.dot(c, i % 3 ? '#f6e9f2' : k.lfG, gx + Math.sin(i * 2.3) * 2.6 * s, gy + Math.cos(i * 1.7) * 5 * s, 0.55);
          curl(c, k.fil, sx * TW * 0.3, TY + TL * 0.62, 2.4, sx > 0 ? -0.6 : PI + 0.6, 0.45, sx < 0);
        }
        curlRing(c, k.fil, 0, TY, TW * 0.9, 14, 2.2, 0.4);
        // leaf veins: the path is the midrib, veins sweep out toward the tip
        c.save(); c.beginPath(); S.poly(c, terr(0.97)); c.clip(); c.lineCap = 'round';
        for (const [col, w, o] of [[rgba(k.p.d, 0.16), 0.7, 0], [rgba('#ffffff', 0.35), 0.35, -0.45]]) {
          c.strokeStyle = col; c.lineWidth = w; c.beginPath();
          for (let i = 0; i < 5; i++) { const y0 = TY - TL * 0.62 + i * TL * 0.3; for (const sx of [-1, 1]) { if (y0 > KY - kr - 3 && y0 < KY + kr + 3) continue; c.moveTo(sx * 5.5, y0 + o); c.quadraticCurveTo(sx * TW * 0.45, y0 + 4 * s + o, sx * TW * 0.82, y0 + 15 * s + o); } }
          c.stroke();
        }
        c.restore();
      } });
    parts.push(...anchor([0, 99], stairs(k, 0, TY + TL * 0.76, TY + TL + 2.5, 11, TZ)));
    // ---- great tree(s) behind
    parts.push(...anchor([0, -90], tree(k, { x: -TW * 0.74, y: KY - 24 * s, z0: TZ, th: 18 + 4 * L, cr: 13 + 2.5 * L, ch: 15 + 2 * L, seed: 5, tr: 2.6, gold: true })));
    if (L === 3) parts.push(...anchor([0, -89], tree(k, { x: TW * 0.8, y: KY - 20 * s, z0: TZ, th: 16, cr: 12, ch: 13, seed: 9, tr: 2.1 })));
    // ---- crescent hall
    const HR = 27 * s, HW = 6.2, HA0 = PI * 0.9, HA1 = PI * 2.1, HZ = TZ + 12 + 2 * (L - 1);
    parts.push(...anchor([0, -40], [
      wallP(k, (c) => S.poly(c, crescentPts(0, KY, HR, HW, HA0, HA1, 36, 0.08)), TZ, HZ),
      arcWins(k, [[0, KY]], HR - HW, TZ + 5, HZ - 2, [1.18, 1.34, 1.66, 1.82].map((q) => q * PI), 0.035, undefined, undefined, false, true),
      ...crescentRoof(k, { x: 0, y: KY, R: HR, w: HW + 1.6, a0: HA0 - 0.02, a1: HA1 + 0.02, z0: HZ, H: 7 + L }),
    ]));
    // ---- pavilions / towers at the crescent tips
    const tipP = [HA0, HA1].map((a) => [Math.cos(a) * HR, KY + Math.sin(a) * HR]);
    const tR = L === 1 ? 5.6 : 6.2, tZ = L === 1 ? TZ + 16 : TZ + 24 + 6 * (L - 2);
    parts.push(...anchor([0, KY + Math.sin(HA0) * HR], [
      towerBody(k, tipP, tR, TZ, tZ, 0.18),
      arcWins(k, tipP, tR, tZ - 7, tZ - 2.5, [PI * 0.5], 0.17),
      frontBand(k, tipP, tR, tZ - 1, tZ),
      ...capRoof(k, { pts: tipP, R: tR + 0.9, z0: tZ, H: L === 1 ? 9 : 15 + 2 * L, prof: L === 1 ? 'bud' : 'spire', ribs: 4, finial: L === 1 ? 4 : 6 }),
    ]));
    // ---- front corner towers (L2+)
    if (L > 1) {
      const fp = [[-TW * 0.6, TY + TL * 0.5], [TW * 0.6, TY + TL * 0.5]], fr = 4.8, fz = TZ + 20 + 6 * (L - 2);
      parts.push(...anchor([0, fp[0][1]], [
        towerBody(k, fp, fr, TZ, fz, 0.3),
        arcWins(k, fp, fr, fz - 8, fz - 3, [PI * 0.5], 0.2, k.dark),
        frontBand(k, fp, fr, fz - 1, fz),
        ...capRoof(k, { pts: fp, R: fr + 1.2, z0: fz, H: 13 + 2 * L, prof: 'flare', ribs: 4, finial: 5 }),
        ...banner(k, fp.map((q, i) => [q[0] + (i ? 5.4 : -5.4), q[1] + 1, i ? 1 : -1]), fz - 6, 10, { len: 4 }),
      ]));
    }
    // ---- the keep: lower drum, balcony, upper drum, bud dome
    const z1 = TZ + 18 + 4 * (L - 1), ur = kr * 0.72, z2 = z1 + 1.4 + 18 + 5 * (L - 1);
    const kp = [[0, KY]];
    parts.push(...anchor([0, KY], [
      towerBody(k, kp, kr, TZ, z1, 0.08, { detail: (c) => ring(c, k.seam, 0, KY, ur + 0.5, 0.5) }),
      arcWins(k, kp, kr, TZ, TZ + 10 + L, [PI * 0.5], 0.2, k.silver, { flat: false, side: k.silS }),
      arcWins(k, kp, kr, TZ, TZ + 9.4 + L, [PI * 0.5], 0.16, k.door),
      arcWins(k, kp, kr, TZ + 8, z1 - 3, [PI * 0.2, PI * 0.8], 0.07),
      { z0: z1, z1: z1 + 1.4, side: k.st2S, top: k.st2T, shape: (c) => S.circ(c, 0, KY, kr + 2.2), detail: (c) => curlRing(c, k.fil, 0, KY, kr + 0.4, 12, 1.4, 0.35) },
      towerBody(k, kp, ur, z1 + 1.4, z2, 0),
      arcWins(k, kp, ur, z1 + 6, z2 - 3, [PI * 0.28, PI * 0.5, PI * 0.72], 0.085),
      rail(k, 0, KY, kr + 1.8, z1 + 1.4, 2.4, 16),
      frontBand(k, kp, ur, z2 - 1.2, z2),
      ...capRoof(k, { pts: kp, R: ur + 1.5, z0: z2, H: 14 + 2 * L, prof: 'bud', ribs: 6, finial: L === 3 ? 0 : 6 + 2 * L, band: true }),
    ]));
    const topZ = z2 + 14 + 2 * L;
    if (L === 3) {
      const cz = topZ - 1;
      parts.push(...anchor([0, KY + 0.1], [
        ...halo(k, 0, KY, cz + 5, 5.2, false),
        ...crystal(k, kp, cz, 2.4, 11, { pulse: true }),
        ...halo(k, 0, KY, cz + 5, 5.2, true),
      ]));
    }
    // ---- L3 outer curtain: a low carved wall along the terrace's front edge, leaf merlons
    if (L === 3) {
      const edge = terr(0.955).reduce((acc, v, i, a) => { if (i % 2 === 0) acc.push([a[i], a[i + 1]]); return acc; }, []);
      const runs = [[], []];
      for (const q of edge) if (q[1] > TY + TL * 0.32 && Math.abs(q[0]) > 7.5) runs[q[0] < 0 ? 0 : 1].push(q);
      runs[0].sort((A, B) => A[1] - B[1]); runs[1].sort((A, B) => A[1] - B[1]);
      const path = (c) => { for (const r of runs) { r.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); } };
      parts.push(...anchor([0, TY + TL * 0.8], [
        { z0: TZ, z1: TZ + 6.5, side: k.stS, top: k.stT, stroke: 2.6, ao: 0.4, shape: path },
        { z0: TZ + 5.6, z1: TZ + 6.6, side: k.rfM, top: k.rfB, stroke: 3.1, bevel: false, shape: path },
        { z0: TZ + 6.6, z1: TZ + 9.4, side: k.stS, top: k.silver, ao: 0.2, shape: (c, zt) => { const w = 1 - Math.pow(zt, 1.4); for (const r of runs) for (let i = 1; i < r.length - 1; i += 1) S.poly(c, leafPts(r[i][0], r[i][1], 1.1 * w + 0.12, 0.7 * w + 0.1, Math.atan2(r[i + 1][1] - r[i - 1][1], r[i + 1][0] - r[i - 1][0]), 1, 1, 10)); } },
        ...crystal(k, [[-8.6, TY + TL * 0.96], [8.6, TY + TL * 0.96]], TZ + 6.5, 1.1, 4.5, { pulse: true }),
      ]));
    }
    // ---- crystals flanking the stair, banners
    const cp = [[-9.5, TY + TL * 0.7], [9.5, TY + TL * 0.7]];
    parts.push(...anchor([0, TY + TL * 0.7], [
      { z0: TZ, z1: TZ + 1.6, side: k.st2S, top: k.st2T, shape: (c) => { for (const q of cp) S.poly(c, ngon(6, 2.4, 0, q[0], q[1])); } },
      ...crystal(k, cp, TZ + 1.6, 1.5, 6 + L, { pulse: true }),
      ...banner(k, [[-15, TY + TL * 0.6, -1], [15, TY + TL * 0.6, 1]], TZ, 15 + 2 * L, { len: 4.6 }),
    ]));
    const R = Math.ceil(Math.max(TW * 1.07, TL * 1.07 + TY + 3, HR + HW + 3) + 2);
    return { r: R, h: Math.ceil((L === 3 ? topZ + 11 : topZ + 6 + 2 * L) + 2), parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * HOUSE — four distinct dwellings (opt.v 0-3), 22-34 footprint.
   *   v0 leaf cottage + turret   v1 tree house (tree grows through the roof)
   *   v2 crescent house around a moon garden   v3 domed pavilion + leaf annex
   * ================================================================== */
  M.elf_house = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal)), v = (((opt.v | 0) % 4) + 4) % 4;
    const parts = [];
    let R = 24, H = 30;
    if (v === 0) {
      const B = { x: 1, y: 3, L: 12.5, W: 7, rot: -0.42, sf: 1, sb: 0.35 };
      parts.push(...anchor([0, -30], tree(k, { x: 10, y: -9, th: 7, cr: 7.5, ch: 8, seed: 3 })));
      const tp = [[-7, -3.5]];
      parts.push(...anchor([0, -5], [
        towerBody(k, tp, 3.7, 1.2, 14, 0.25),
        arcWins(k, tp, 3.7, 9, 12.5, [PI * 0.62, PI * 0.95], 0.26),
        ...capRoof(k, { pts: tp, R: 4.4, z0: 14, H: 8, finial: 4 }),
      ]));
      parts.push(...anchor([0, 3], [
        plinth(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L + 2, B.W + 2, B.rot, 1, 0.35))),
        wallP(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L, B.W, B.rot, 1, 0.35)), 1.5, 9.5),
        leafFrames(k, B, [PI * 0.28, PI * 0.78, PI * 0.96], 4.5, 8, 0.75),
        leafWins(k, B, [PI * 0.28, PI * 0.78, PI * 0.96], 4.5, 8, 0.75),
        leafFrames(k, B, [PI * 0.54], 1.5, 7.4, 1.35),
        leafWins(k, B, [PI * 0.54], 1.5, 7.4, 1.35, k.door),
        ...leafRoof(k, { x: B.x, y: B.y, L: B.L + 1.8, W: B.W + 1.5, rot: B.rot, z0: 9.5, H: 6.5, sb: 0.35 }),
      ]));
      parts.push(...anchor([0, 14], lantern(k, [[-9, 9]], 5)));
      R = 22; H = 28;
    } else if (v === 1) {
      const cx = 0, cy = 1, cp = [[cx, cy]];
      parts.push(...anchor([0, 1], [
        plinth(k, (c) => S.circ(c, cx, cy, 11.5)),
        towerBody(k, cp, 9.5, 1.5, 9.5, 0.06),
        arcWins(k, cp, 9.5, 4.5, 8, [PI * 0.25, PI * 0.75], 0.09),
        arcWins(k, cp, 9.5, 1.5, 7.4, [PI * 0.5], 0.14, k.silver, { flat: false, side: k.silS }),
        arcWins(k, cp, 9.5, 1.5, 7, [PI * 0.5], 0.11, k.door),
        { z0: 9.5, z1: 15.5, side: k.rfM, top: k.rfT, ao: 0.3, shape: (c, zt) => S.circ(c, cx, cy, 12 * (1 - zt * 0.62)) },
        { z0: 9.5, z1: 15.1, side: k.silS, top: k.rib, bevel: false, ao: 0.1, shape: (c, zt) => { const r = 12 * (1 - zt * 0.62) + 0.1; for (let i = 0; i < 6; i++) { const a = PI * (i + 0.5) / 6; S.circ(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.3); } } },
        ...tree(k, { x: cx + 0.5, y: cy - 1, z0: 12, th: 8, cr: 9.5, ch: 9, seed: 7, tr: 1.8, gold: true, noRoots: true }),
      ]));
      parts.push(...anchor([0, 14], lantern(k, [[-8, 11]], 4.5)));
      R = 20; H = 34;
    } else if (v === 2) {
      const a0 = PI * 0.95, a1 = PI * 2.05, cy = 3;
      parts.push(...anchor([0, -6], [
        plinth(k, (c) => S.poly(c, crescentPts(0, cy, 11, 6.5, a0 - 0.1, a1 + 0.1, 28, 0.3))),
        wallP(k, (c) => S.poly(c, crescentPts(0, cy, 11, 4.6, a0, a1, 28, 0.35)), 1.5, 8.5),
        arcWins(k, [[0, cy]], 6.6, 4, 7.2, [PI * 1.3, PI * 1.5, PI * 1.7], 0.075, undefined, undefined, false, true),
        ...crescentRoof(k, { x: 0, y: cy, R: 11, w: 5.6, a0: a0 + 0.05, a1: a1 - 0.05, z0: 8.5, H: 5, pw: 0.3, veins: 7 }),
      ]));
      const tp = [[Math.cos(a0) * 11, cy + Math.sin(a0) * 11], [Math.cos(a1) * 11, cy + Math.sin(a1) * 11]];
      parts.push(...anchor([0, 2], [
        towerBody(k, tp, 3.2, 1.2, 11, 0.2),
        ...capRoof(k, { pts: tp, R: 3.9, z0: 11, H: 7, prof: 'bud', ribs: 3, finial: 3, hi: false }),
      ]));
      parts.push(...anchor([0, 5], [
        { z0: 0, z1: 0.8, side: k.plS, top: mx(k.lfM, k.lfD, 0.3), shape: (c) => S.circ(c, 0, cy + 2, 6.2), detail: (c) => { ring(c, k.fil, 0, cy + 2, 4.8, 0.4); for (let i = 0; i < 8; i++) { const a = i * 0.8; S.dot(c, i % 2 ? k.lfG : '#f6e8f2', Math.cos(a) * 4.8, cy + 2 + Math.sin(a) * 4.8, 0.6); } } },
        ...crystal(k, [[0, cy + 2]], 0.8, 1.6, 7, { halo: true }),
      ]));
      R = 20; H = 22;
    } else {
      parts.push(...anchor([0, -3], [
        plinth(k, (c) => { S.circ(c, -3, 0, 10); S.poly(c, leafPts(8, 3, 9, 5.5, 0.25, 1, 0.6)); }),
      ]));
      const A = { x: 8, y: 3.5, L: 7.5, W: 4.2, rot: 0.25, sf: 1, sb: 0.6 };
      parts.push(...anchor([0, 3], [
        wallP(k, (c) => S.poly(c, leafPts(A.x, A.y, A.L, A.W, A.rot, 1, 0.6)), 1.5, 7),
        leafWins(k, A, [PI * 0.45], 1.5, 6.2, 1, k.door),
        ...leafRoof(k, { x: A.x, y: A.y, L: A.L + 1.4, W: A.W + 1.4, rot: A.rot, z0: 7, H: 4, veins: 3, hornH: 3, sb: 0.6 }),
      ]));
      const dp = [[-3, 0]];
      parts.push(...anchor([0, 0], [
        towerBody(k, dp, 7.5, 1.5, 12, 0.08),
        arcWins(k, dp, 7.5, 6, 10, [PI * 0.32, PI * 0.58, PI * 0.84], 0.1),
        { z0: 12, z1: 13.2, side: k.st2S, top: k.st2T, shape: (c) => S.circ(c, -3, 0, 8.3) },
        ...capRoof(k, { pts: dp, R: 7.4, z0: 13.2, H: 10, prof: 'bud', ribs: 6, finial: 6 }),
      ]));
      parts.push(...anchor([0, 12], lantern(k, [[-9.5, 9], [3, 10.5]], 4)));
      R = 21; H = 31;
    }
    return { r: R, h: H, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * BARRACKS — long veined leaf hall with a spired corner tower, an archery
   * yard in front (targets on easels, glaive and bow racks), banners. anims 4.
   * ================================================================== */
  M.elf_barracks = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const B = { x: 3, y: -8, L: 22, W: 9, rot: 0, sf: 1, sb: 0.5 };
    parts.push({ z0: 0, z1: 0.5, side: k.yardS, top: k.yard, layer: -1, ao: 0.1, bevel: false, shape: (c) => S.ell(c, 2, 13, 25, 9.5),
      detail: (c) => { ring(c, rgba(k.p.d, 0.15), 2, 13, 7, 0.4); S.lines(c, rgba(k.p.d, 0.18), 0.4, [-14, 16, -4, 18, 8, 17, 18, 14]); } });
    parts.push(...anchor([0, -30], tree(k, { x: -24, y: -14, th: 9, cr: 8.5, ch: 9, seed: 21 })));
    parts.push(...anchor([0, -8], [
      plinth(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L + 2.2, B.W + 2.2, 0, 1, 0.5))),
      wallP(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L, B.W, 0, 1, 0.5)), 1.5, 11),
      leafFrames(k, B, [0.25, 0.37, 0.63, 0.75].map((q) => q * PI), 5, 9, 0.8),
      leafWins(k, B, [0.25, 0.37, 0.63, 0.75].map((q) => q * PI), 5, 9, 0.8),
      ...leafRoof(k, { x: B.x, y: B.y, L: B.L + 2, W: B.W + 1.8, rot: 0, z0: 11, H: 7.5, sb: 0.5, veins: 6, hornH: 5 }),
    ]));
    // transept wing pointing at the yard: gable roof with the ridge toward the camera
    const T = { x: 3, y: -2.5, L: 8.5, W: 5.6, rot: PI / 2, sf: 0.45, sb: 0.5 };
    parts.push(...anchor([0, -2], [
      wallP(k, (c) => S.poly(c, leafPts(T.x, T.y, T.L, T.W, T.rot, T.sf, T.sb)), 1.5, 11),
      leafFrames(k, T, [0], 1.5, 8.6, 1.8),
      leafWins(k, T, [0], 1.5, 8.6, 1.8, k.door),
      leafWins(k, T, [PI * 0.3, -PI * 0.3], 5, 9, 0.6),
      ...leafRoof(k, { x: T.x, y: T.y + 0.6, L: T.L + 1.8, W: T.W + 1.4, rot: T.rot, z0: 11, H: 8.6, sf: 0.45, sb: 0.5, veins: 3, hornH: 4, horns: 'front', lk: 0.1 }),
    ]));
    const tp = [[-19, -6]];
    parts.push(...anchor([0, -5], [
      towerBody(k, tp, 5, 1.5, 22, 0.25),
      arcWins(k, tp, 5, 14, 19, [PI * 0.45], 0.2, k.dark),
      frontBand(k, tp, 5, 21, 22),
      ...capRoof(k, { pts: tp, R: 6, z0: 22, H: 14, prof: 'spire', ribs: 4, finial: 5 }),
    ]));
    const tg = [[-13, 13], [-4, 15], [9, 15]];
    parts.push(...anchor([0, 13], [
      { z0: 0, z1: 6.5, side: k.wdS, top: k.wdT, bevel: false, shape: (c, zt) => { for (const q of tg) { const lean = (1 - zt) * 1.3; S.circ(c, q[0] - 1.8, q[1] + lean, 0.35); S.circ(c, q[0] + 1.8, q[1] + lean, 0.35); S.circ(c, q[0], q[1] - lean - 0.6, 0.35); } } },
      { z0: 2, z1: 8, side: '#c9b26a', top: '#e8d690', bevel: false, ao: 0.2, shape: (c, zt) => { for (const q of tg) S.rect(c, q[0] - 3 * cylW(zt), q[1] + 0.4, 6 * cylW(zt), 0.9); } },
      { z0: 3.3, z1: 6.7, side: k.p.t, top: k.p.t, flat: true, bevel: false, shape: (c, zt) => { for (const q of tg) S.rect(c, q[0] - 1.7 * cylW(zt), q[1] + 1.25, 3.4 * cylW(zt), 0.3); } },
      { z0: 4.3, z1: 5.7, side: '#c83a2a', top: '#f05a40', flat: true, bevel: false, shape: (c, zt) => { for (const q of tg) S.rect(c, q[0] - 0.7 * cylW(zt), q[1] + 1.5, 1.4 * cylW(zt), 0.3); } },
    ]));
    parts.push(...anchor([0, 4], [
      { z0: 0, z1: 4, side: k.wdS, top: k.wdT, shape: (c) => { S.rect(c, 13, 3, 8, 1.2); S.rect(c, -24, 4, 6, 1.2); } },
      { z0: 1, z1: 11, side: k.silS, top: k.silver, bevel: false, shape: (c, zt) => { for (let i = 0; i < 4; i++) S.circ(c, 14 + i * 2, 3.6, zt > 0.75 ? 0.55 * (1 - zt) / 0.25 + 0.1 : 0.22); } },
      { z0: 3.5, z1: 9, side: k.wdS, top: k.wdT, bevel: false, shape: (c, zt) => { const w = Math.sin(zt * PI) * 1.3; for (let i = 0; i < 3; i++) S.circ(c, -23 + i * 2 + w * 0.5, 4.6, 0.25); } },
    ]));
    parts.push(...anchor([0, 20], banner(k, [[-24, 16, -1], [27, 12, 1]], 0, 15, { len: 4.6 })));
    return { r: 34, h: 42, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * FARM — leaf farmhouse, a domed granary tower, an open hay shelter with a
   * leaf roof, an orchard tree, bee skeps and produce baskets. ~56 across.
   * ================================================================== */
  M.elf_farm = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    parts.push({ z0: 0, z1: 0.4, side: k.yardS, top: mx(k.yard, k.lfD, 0.15), layer: -1, bevel: false, ao: 0.1, shape: (c) => S.poly(c, leafPts(0, 3, 28, 19, 0.12, 0.45, 0.2, 40)),
      detail: (c) => { S.lines(c, rgba(k.p.d, 0.15), 0.5, [-20, 10, 0, 6, 0, 6, 20, 12]); } });
    const gp = [[14, -10]];
    parts.push(...anchor([0, -12], [
      plinth(k, (c) => S.circ(c, 14, -10, 8.2)),
      towerBody(k, gp, 6.8, 1.5, 19, 0.06),
      frontBand(k, gp, 6.8, 6, 7.2, k.wdS, k.wdT),
      frontBand(k, gp, 6.8, 13, 14.2, k.wdS, k.wdT),
      arcWins(k, gp, 6.8, 1.5, 6, [PI * 0.42], 0.16, k.door),
      arcWins(k, gp, 6.8, 15, 18, [PI * 0.62], 0.09),
      ...capRoof(k, { pts: gp, R: 7.6, z0: 19, H: 11, prof: 'bud', ribs: 5, finial: 4, band: true }),
    ]));
    parts.push(...anchor([0, -20], tree(k, { x: -18, y: -12, th: 7, cr: 8, ch: 8, seed: 31 })));
    parts.push({ z0: 13, z1: 15.5, side: '#c8402c', top: '#f07050', bevel: false, at: [0, -19.9], ao: 0.2, shape: (c, zt) => { for (let i = 0; i < 9; i++) { const a = i * 2.39, d = 3 + (i % 3) * 1.8; S.circ(c, -18 + Math.cos(a) * d, -12 + Math.sin(a) * d * 0.9 + 1, 0.55 * cylW(zt)); } } });
    const B = { x: -6, y: -2, L: 10.5, W: 6, rot: -0.3, sf: 1, sb: 0.4 };
    parts.push(...anchor([0, -2], [
      plinth(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L + 1.8, B.W + 1.8, B.rot, 1, 0.4))),
      wallP(k, (c) => S.poly(c, leafPts(B.x, B.y, B.L, B.W, B.rot, 1, 0.4)), 1.5, 8.5),
      leafWins(k, B, [PI * 0.3, PI * 0.85], 4.5, 7.2, 0.7),
      leafWins(k, B, [PI * 0.56], 1.5, 6.8, 1.2, k.door),
      ...leafRoof(k, { x: B.x, y: B.y, L: B.L + 1.6, W: B.W + 1.4, rot: B.rot, z0: 8.5, H: 5.5, sb: 0.4, veins: 3, hornH: 3 }),
    ]));
    const S0 = { x: 15, y: 8, L: 9, W: 5.5, rot: 0.15 };
    parts.push(...anchor([0, 8], [
      { z0: 0, z1: 4.2, side: k.hayS, top: k.hay, ao: 0.35, shape: (c, zt) => S.blob(c, 15, 8.5, 6.5 * Math.sqrt(1 - zt * zt * 0.8), 3, 10, 0.18) },
      { z0: 0, z1: 7, side: k.wdS, top: k.wdT, bevel: false, shape: (c) => { for (const q of [[-7, -3.6], [7, -3.6], [-7, 3.6], [7, 3.6]]) { const p = tf(q, S0.x, S0.y, S0.rot); S.circ(c, p[0], p[1], 0.5); } } },
      ...leafRoof(k, { x: S0.x, y: S0.y, L: S0.L + 1.5, W: S0.W + 1.5, rot: S0.rot, z0: 7, H: 3.5, veins: 3, hornH: 2.5, sb: 0.6 }),
    ]));
    parts.push(...anchor([0, 14], [
      { z0: 0, z1: 3.6, side: k.hayS, top: k.hay, ao: 0.3, shape: (c, zt) => { const r = 1.6 * Math.sqrt(Math.max(0.05, 1 - zt * zt)); for (const q of [[-22, 6], [-19, 8], [-22.5, 10]]) S.circ(c, q[0], q[1], r); },
        detail: (c) => { for (const q of [[-22, 6], [-19, 8], [-22.5, 10]]) S.dot(c, '#3a2a18', q[0], q[1] + 0.8, 0.35); } },
      { z0: 0, z1: 2.2, side: k.wdS, top: k.wd, shape: (c) => { for (const q of [[2, 11], [5, 12.5], [-2, 13]]) S.circ(c, q[0], q[1], 1.4); },
        detail: (c) => { const fr = ['#e8b84a', '#c8402c', '#9cd04a', '#7a4ac0']; let i = 0; for (const q of [[2, 11], [5, 12.5], [-2, 13]]) for (let j = 0; j < 4; j++) S.dot(c, fr[(i++) % 4], q[0] + Math.cos(j * 1.6) * 0.7, q[1] + Math.sin(j * 1.6) * 0.7, 0.5); } },
    ]));
    parts.push(...anchor([0, 9], lantern(k, [[-12, 8]], 4)));
    return { r: 32, h: 43, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * STABLE — long low horseshoe-crescent stable with arched stall doors on the
   * inner (front) wall, veined crescent roof, a curved paddock fence, hay and a
   * stone water trough. ~56 across.
   * ================================================================== */
  M.elf_stable = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const cx = 0, cy = 10, RR = 22, a0 = PI * 1.08, a1 = PI * 1.92;
    parts.push({ z0: 0, z1: 0.4, side: k.yardS, top: k.yard, layer: -1, bevel: false, ao: 0.1, shape: (c) => S.ell(c, 0, 9, 22, 11),
      detail: (c) => { for (let i = 0; i < 9; i++) S.dot(c, 'rgba(60,44,24,0.25)', -14 + i * 3.4, 9 + Math.sin(i * 1.9) * 4, 0.6); } });
    parts.push(...anchor([0, -30], tree(k, { x: 25, y: -12, th: 8, cr: 8, ch: 9, seed: 41 })));
    const stallA = [1.2, 1.32, 1.44, 1.56, 1.68, 1.8].map((q) => q * PI);
    parts.push(...anchor([0, -10], [
      plinth(k, (c) => S.poly(c, crescentPts(cx, cy, RR, 7.5, a0 - 0.08, a1 + 0.08, 32, 0.15))),
      wallP(k, (c) => S.poly(c, crescentPts(cx, cy, RR, 5.8, a0, a1, 32, 0.15)), 1.5, 8),
      arcWins(k, [[cx, cy]], RR - 5.8, 1.5, 7.2, stallA, 0.04, k.silver, { flat: false, side: k.silS }, false, true),
      arcWins(k, [[cx, cy]], RR - 5.8, 1.5, 6.8, stallA, 0.032, k.dark, undefined, false, true),
      arcWins(k, [[cx, cy]], RR - 6, 1.5, 4, stallA, 0.032, k.wd, { flat: false, side: k.wdS }, false, true),
      ...crescentRoof(k, { x: cx, y: cy, R: RR, w: 7.4, a0: a0 - 0.03, a1: a1 + 0.03, z0: 8, H: 5.5, pw: 0.15 }),
    ]));
    const ep = [a0, a1].map((a) => [cx + Math.cos(a) * RR, cy + Math.sin(a) * RR]);
    parts.push(...anchor([0, 3], [
      towerBody(k, ep, 4.2, 1.2, 11, 0.15),
      ...capRoof(k, { pts: ep, R: 4.9, z0: 11, H: 7, prof: 'bud', ribs: 3, finial: 3, hi: false }),
    ]));
    parts.push(...anchor([0, 8], [
      { z0: 0, z1: 4, side: k.hayS, top: k.hay, ao: 0.35, shape: (c, zt) => S.blob(c, -12, 6, 4.4 * Math.sqrt(1 - zt * zt * 0.85), 5, 9, 0.2), detail: (c) => S.lines(c, 'rgba(120,90,30,0.4)', 0.3, [-14, 5, -11, 7, -12, 4, -10, 6]) },
      { z0: 0, z1: 2.6, side: k.hayS, top: k.hay, shape: (c, zt) => { for (const q of [[-5, 9.5], [-6.5, 12.5]]) S.rrect(c, q[0] - 2, q[1] - 1.2 * cylW(zt), 4, 2.4 * cylW(zt), 0.6); }, detail: (c) => S.lines(c, 'rgba(120,90,30,0.5)', 0.3, [-6, 8.4, -6, 10.6, -4, 8.4, -4, 10.6]) },
      { z0: 0, z1: 2.6, side: k.st2S, top: k.st2T, shape: (c) => S.rrect(c, 4, 6, 9, 3, 1.4) },
      { z0: 2.2, z1: 2.3, side: k.water, top: k.water, flat: true, bevel: false, shape: (c) => S.rrect(c, 4.7, 6.6, 7.6, 1.8, 0.9), detail: (c) => S.lines(c, 'rgba(255,255,255,0.5)', 0.3, [5.5, 7.1, 8, 7.1]) },
    ]));
    const fA0 = PI * 0.12, fA1 = PI * 0.88, fR = 21, fy = 3;
    parts.push(...anchor([0, 22], [
      { z0: 0, z1: 4.6, side: k.wdS, top: k.wdT, bevel: false, shape: (c, zt) => { for (let i = 0; i <= 8; i++) { const a = fA0 + (fA1 - fA0) * i / 8; if (i === 4) continue; S.circ(c, cx + Math.cos(a) * fR, fy + Math.sin(a) * fR * 0.6, zt > 0.9 ? 0.6 : 0.42); } } },
      { z0: 0, z1: 4.2, side: k.wdS, top: k.wdT, stroke: 0.55, bevel: false, shape: (c, zt) => { if (!(Math.abs(zt - 0.5) < 0.09 || zt > 0.9)) return; for (const [b0, b1] of [[fA0, PI * 0.46], [PI * 0.54, fA1]]) { for (let i = 0; i <= 12; i++) { const a = b0 + (b1 - b0) * i / 12, px = cx + Math.cos(a) * fR, py = fy + Math.sin(a) * fR * 0.6; if (i) c.lineTo(px, py); else c.moveTo(px, py); } } } },
    ]));
    parts.push(...anchor([0, -2], banner(k, [[ep[0][0] - 5, ep[0][1] + 1, -1]], 0, 14, { len: 4.4 })));
    return { r: 33, h: 26, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * MAGE TOWER — a twisting trefoil shaft with glowing spiral seams on a lotus
   * base, an opening crown of curved leaf-blades holding a floating, pulsing
   * crystal inside a segmented halo. ~26 base, ~92 tall. anims 4.
   * ================================================================== */
  M.elf_magetower = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const Z0 = 2, ZT = 62, tw = 1.25 * TAU;
    const rAt = (zt) => 6.6 - 2.2 * zt + 1.6 * Math.pow(1 - zt, 6);
    const lobeR = (r, th, rot) => r * (1 + 0.17 * Math.cos(3 * (th - rot)));
    const sect = (r, rot) => { const a = []; for (let i = 0; i < 24; i++) { const th = i / 24 * TAU; a.push(Math.cos(th) * lobeR(r, th, rot), Math.sin(th) * lobeR(r, th, rot)); } return a; };
    parts.push(plinth(k, (c) => S.poly(c, ngon(14, 13, 0.1, 0, 0)), 1.2, { detail: (c) => { ring(c, k.fil, 0, 0, 11.2, 0.45); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; S.dot(c, k.glHi, Math.cos(a) * 11.2, Math.sin(a) * 11.2, 0.5); } } }));
    parts.push({ z0: 1.2, z1: 5.5, side: k.stS, top: k.stT, ao: 0.4, shape: (c, zt) => { for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + PI / 6; S.poly(c, leafPts(Math.cos(a) * 6, Math.sin(a) * 6, 6 * (1 - zt * 0.35), 3.4 * Math.sqrt(1 - zt * zt * 0.9) + 0.1, a, 1, 0.2, 18)); } },
      detail: (c) => { for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + PI / 6; S.lines(c, rgba(k.gl, 0.85), 0.4, [Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * 9.5, Math.sin(a) * 9.5]); } } });
    parts.push({ z0: Z0, z1: ZT, side: k.stS, top: k.stT, ao: 0.45, shape: (c, zt) => S.poly(c, sect(rAt(zt), zt * tw)) });
    parts.push({ z0: Z0 + 4, z1: ZT - 1, side: k.gl, top: k.glHi, flat: true, bevel: false, ao: 0, shape: (c, zt0) => {
      const zt = (Z0 + 4 + zt0 * (ZT - 1 - Z0 - 4) - Z0) / (ZT - Z0), rot = zt * tw, r = rAt(zt), hd = -headingOf(c);
      for (let j = 0; j < 3; j++) {
        const th = rot + PI / 3 + j * TAU / 3;
        if (Math.sin(th - hd) < 0.15) continue;
        const rr = lobeR(r, th, rot), nx = Math.cos(th), ny = Math.sin(th);
        wallQuad(c, nx * rr, ny * rr, nx, ny, 0.45, 0.3, 0.5);
      }
    } });
    parts.push(arcWins(k, [[0, 0]], rAt(0.8) * 0.9, Z0 + 0.74 * (ZT - Z0), Z0 + 0.84 * (ZT - Z0), [PI * 0.5], 0.22, k.glHi));
    // crown collar + four curved leaf-blades cradling a big floating crystal
    parts.push({ z0: ZT, z1: ZT + 3.5, side: k.st2S, top: k.st2T, ao: 0.3, shape: (c, zt) => S.circ(c, 0, 0, 4.4 + 4.4 * Math.pow(zt, 0.8)),
      detail: (c) => { ring(c, k.fil, 0, 0, 7.4, 0.45); S.dot(c, k.dark, 0, 0, 3.6); glowDot(c, k.gl, 0, 0, 5.5, 0.85); } });
    const BZ0 = ZT + 2.5, BZ1 = ZT + 24;
    const bladeA = [0.25, 0.75, 1.25, 1.75].map((q) => q * PI);
    const bladeR = (q) => 7.4 + 3.6 * Math.sin(q * PI * 0.85) - q * q * 3.2;
    const bladeW = (q) => 2.1 * Math.sin(Math.min(1, q * 1.4 + 0.12) * PI * 0.92) + 0.35;
    const blades = (sel) => ({ z0: BZ0, z1: BZ1, side: k.stS, top: k.silver, ao: 0.25, bevel: false, shape: (c, zt) => {
      const hd = -headingOf(c), q = zt;
      for (const a0 of bladeA) { const a = a0 + q * 0.6, fr = Math.sin(a - hd) > 0; if (fr !== sel) continue; const r = bladeR(q); S.poly(c, leafPts(Math.cos(a) * r, Math.sin(a) * r, bladeW(q), 0.75, a + PI / 2, 0.6, 0.6, 12)); }
    } });
    const bladeGlow = (sel) => ({ z0: BZ0 + 3, z1: BZ1 - 2, side: k.gl, top: k.glHi, flat: true, bevel: false, ao: 0, shape: (c, zt0) => {
      const hd = -headingOf(c), q = (3 + zt0 * (BZ1 - BZ0 - 5)) / (BZ1 - BZ0);
      for (const a0 of bladeA) { const a = a0 + q * 0.6, fr = Math.sin(a - hd) > 0; if (fr !== sel || !fr) continue; const r = bladeR(q) + 0.65; S.circ(c, Math.cos(a) * r, Math.sin(a) * r, 0.32); }
    } });
    parts.push(blades(false));
    const CZ = ZT + 7, CH = 17;
    parts.push(...halo(k, 0, 0, CZ + 8, 9.6, false));
    parts.push({ z0: CZ - 1.5, z1: CZ + CH + 2, side: mx(k.gl, k.p.t, 0.2), top: k.glHi, flat: true, bevel: false, ao: -0.35,
      shape: (c, zt, an) => { const z = CZ - 1.5 + zt * (CH + 3.5), b = CZ - 0.5 + Math.sin(an * TAU) * 1.3, q = (z - b) / CH; if (q < 0 || q > 1) return; const r = 5.2 * (q < 0.4 ? q / 0.4 : (1 - q) / 0.6) * (1 + 0.07 * Math.sin(an * TAU * 2)) + 0.25; S.poly(c, ngon(4, r, 0.4)); },
      detail: (c, an) => glowDot(c, k.gl, 0, 0, 7 + Math.sin(an * TAU) * 1.8, 0.5) });
    parts.push({ z0: CZ - 1.5, z1: CZ + CH + 2, side: mx(k.gl, '#ffffff', 0.65), top: '#ffffff', flat: true, bevel: false, ao: 0,
      shape: (c, zt, an) => { const z = CZ - 1.5 + zt * (CH + 3.5), b = CZ - 0.5 + Math.sin(an * TAU) * 1.3, q = (z - b) / CH; if (q < 0 || q > 1) return; const r = 5.2 * (q < 0.4 ? q / 0.4 : (1 - q) / 0.6) + 0.25, a = ngon(4, r, 0.4), m = ngon(4, r * 0.35, 0.4); S.poly(c, [a[2], a[3], a[4], a[5], m[4], m[5], m[2], m[3]]); } });
    parts.push(...halo(k, 0, 0, CZ + 8, 9.6, true));
    parts.push(blades(true));
    parts.push(bladeGlow(true));
    // orbiting motes
    parts.push({ z0: ZT + 4, z1: ZT + 28, side: k.glHi, top: '#ffffff', flat: true, bevel: false, ao: 0, shape: (c, zt, an) => {
      for (let i = 0; i < 6; i++) { const zz = (i * 0.17 + an * 0.25) % 1; if (Math.abs(zt - zz) > 0.022) continue; const a = i * 2.4 + an * TAU * 0.5; S.circ(c, Math.cos(a) * 12.5, Math.sin(a) * 12.5, 0.55); }
    } });
    return { r: 17, h: ZT + 30, parts, style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * ARCHER TOWER — slender flared shaft on a lotus base with a climbing vine,
   * corbelled gallery with leaf-blade merlons, canopy spire on slim posts. ~60 tall.
   * ================================================================== */
  M.elf_tower = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const GZ = 40, gR = 9.5, sr = (z) => 5.4 * (1 + 0.3 * Math.pow(1 - (z - 1.6) / (GZ - 1.6), 3));
    parts.push(plinth(k, (c) => S.poly(c, ngon(12, 11.5, 0.13, 0, 0)), 1.6, { detail: (c) => curlRing(c, k.fil, 0, 0, 9.6, 6, 1.6, 0.4) }));
    parts.push({ z0: 1.6, z1: 6.5, side: k.stS, top: k.stT, ao: 0.4, shape: (c, zt) => { for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - PI / 2 + PI / 5; S.poly(c, leafPts(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 5.6 * (1 - zt * 0.35), 3.2 * Math.sqrt(1 - zt * zt * 0.9) + 0.1, a, 1, 0.2, 18)); } },
      detail: (c) => { for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - PI / 2 + PI / 5; S.lines(c, k.fil, 0.35, [Math.cos(a) * 3, Math.sin(a) * 3, Math.cos(a) * 8.6, Math.sin(a) * 8.6]); } } });
    parts.push(towerBody(k, [[0, 0]], 5.4, 1.6, GZ, 0.3));
    parts.push(arcWins(k, [[0, 0]], 5.4, 20, 25, [PI * 0.5], 0.12, k.dark));
    parts.push(arcWins(k, [[0, 0]], 5.4, 30, 34, [PI * 0.3, PI * 0.72], 0.1, k.dark));
    parts.push(vine(k, 0, 0, sr, 4, 34, 1.6, 0.4));
    parts.push(frontBand(k, [[0, 0]], sr(14), 14, 15));
    parts.push({ z0: GZ - 5, z1: GZ, side: k.stS, top: k.stT, ao: 0.5, shape: (c, zt) => S.circ(c, 0, 0, 5.4 + (gR - 5.4) * Math.pow(zt, 1.8)) });
    parts.push({ z0: GZ, z1: GZ + 1.2, side: k.st2S, top: k.st2T, shape: (c) => S.circ(c, 0, 0, gR + 0.6), detail: (c) => ring(c, k.fil, 0, 0, gR - 1.4, 0.4) });
    parts.push({ z0: GZ + 1.2, z1: GZ + 3.6, side: k.stS, top: k.stT, ao: 0.3, shape: (c) => annulus(c, 0, 0, gR + 0.3, gR - 1.2) });
    parts.push({ z0: GZ + 3.6, z1: GZ + 7, side: k.stS, top: k.stT, ao: 0.2, shape: (c, zt) => { const n = 10; for (let i = 0; i < n; i++) { const a = i * TAU / n + 0.15, w = 0.22 * (1 - Math.pow(zt, 1.4)) + 0.02; sector(c, 0, 0, gR - 1.2, gR + 0.3, a - w, a + w); } } });
    parts.push(arcWins(k, [[0, 0]], gR + 0.3, GZ + 1.6, GZ + 3, [PI * 0.25, PI * 0.5, PI * 0.75], 0.07, k.dark));
    parts.push({ z0: GZ + 1.2, z1: GZ + 10, side: k.silS, top: k.silver, bevel: false, shape: (c) => { for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + PI / 4; S.circ(c, Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.45); } } });
    parts.push(...capRoof(k, { pts: [[0, 0]], R: 6.8, z0: GZ + 10, H: 12, prof: 'flare', ribs: 4, finial: 6 }));
    parts.push(...banner(k, [[7.6, 3.8, 1]], GZ + 3.6, 9, { len: 3.4 }));
    return { r: 14, h: GZ + 30, parts, style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * BALLISTA — anti-dragon recurve ballista on a round stone platform. 24 dirs,
   * +x = aim. Leaf-shaped recurve limbs, silver fittings, a crystal-tipped bolt.
   * ================================================================== */
  M.elf_ballista = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    parts.push({ z0: 0, z1: 2.4, side: k.plS, top: k.st2T, ao: 0.3, at: [0, 0], layer: -2, shape: (c) => S.circ(c, 0, 0, 9.5), detail: (c) => { ring(c, k.fil, 0, 0, 8.3, 0.4); curlRing(c, k.fil, 0, 0, 7.4, 8, 1, 0.3); } });
    parts.push({ z0: 2.4, z1: 3.4, side: k.stS, top: k.stT, at: [0, 0], layer: -1, shape: (c) => S.circ(c, 0, 0, 5.6), detail: (c) => { ring(c, k.seam, 0, 0, 3.6, 0.4); } });
    parts.push({ z0: 3.4, z1: 6, side: k.silS, top: k.silver, at: [0, 0], layer: -1, shape: (c, zt) => S.circ(c, 0, 0, 1.6 + (1 - zt) * 0.8) });
    parts.push({ z0: 5.6, z1: 7.4, side: k.wdS, top: k.wdT, at: [0, 0], shape: (c) => S.poly(c, [8, -0.8, 8.8, 0, 8, 0.8, -7.5, 1.2, -8.2, 0, -7.5, -1.2]),
      detail: (c) => { S.lines(c, k.fil, 0.35, [-6, 0, 6.5, 0]); S.lines(c, k.seam, 0.3, [-7, -0.9, 7.5, -0.6]); } });
    parts.push({ z0: 5, z1: 8, side: k.silS, top: k.silver, at: [-6, 0], shape: (c, zt) => { const w = 0.9 * cylW(zt); S.rect(c, -6.5 - w, -2.6, w * 2, 1.4); S.rect(c, -6.5 - w, 1.2, w * 2, 1.4); } });
    const limb = (s) => { const a = []; const n = 10; for (let i = 0; i <= n; i++) { const u = i / n, yy = s * (1.2 + u * 8.2), xx = 4.2 - 3.6 * u * u + (u > 0.85 ? (u - 0.85) * 8 : 0); a.push(xx + 0.55 * Math.sin(u * PI)); a.push(yy); } for (let i = n; i >= 0; i--) { const u = i / n, yy = s * (1.2 + u * 8.2), xx = 4.2 - 3.6 * u * u + (u > 0.85 ? (u - 0.85) * 8 : 0); a.push(xx - 0.55 * Math.sin(u * PI) - 0.3); a.push(yy); } return a; };
    for (const s of [-1, 1]) {
      parts.push({ z0: 6.2, z1: 7.6, side: k.stS, top: k.stT, ao: 0.2, at: [2, s * 5], shape: (c) => S.poly(c, limb(s)),
        detail: (c) => { S.lines(c, rgba(k.p.t, 0.8), 0.4, [3.9, s * 2, 3.2, s * 5.5, 3.2, s * 5.5, 1.4, s * 8.4]); } });
      parts.push({ z0: 6, z1: 7.9, side: k.silS, top: k.silver, at: [2, s * 9.4], shape: (c) => S.circ(c, 1.2, s * 9.4, 0.55) });
    }
    parts.push({ z0: 7.2, z1: 7.5, side: '#d8e0d8', top: '#ffffff', stroke: 0.3, bevel: false, at: [0, 0.01], shape: (c) => { c.moveTo(1.2, -9.4); c.lineTo(-4.2, 0); c.lineTo(1.2, 9.4); } });
    parts.push({ z0: 7.4, z1: 8.4, side: k.wdS, top: k.wdT, at: [0, 0.02], shape: (c) => S.rect(c, -4.4, -0.35, 15, 0.7),
      detail: (c) => { S.fillPoly(c, k.bn, [-4.4, -0.35, -2.2, -0.35, -1.8, -1.2, -4, -1.2]); S.fillPoly(c, k.bn, [-4.4, 0.35, -2.2, 0.35, -1.8, 1.2, -4, 1.2]); } });
    parts.push({ z0: 7.1, z1: 8.9, side: k.glS, top: k.glHi, flat: true, bevel: false, at: [12, 0], shape: (c, zt) => S.poly(c, leafPts(12.2, 0, 2, 0.95 * cylW(zt) + 0.1, 0, 1, 0.5, 16)), detail: (c) => glowDot(c, k.gl, 12.4, 0, 2.6, 0.5) });
    return { r: 14, h: 11, parts: sorted(parts), style: 'unit', bevel: 0.7 };
  };

  /* ==================================================================
   * CATAPULT — elven mangonel on a round platform: curled living-wood side
   * beams, silver-shod uprights, a torsion skein, a leaf-shaped throwing arm with
   * a glowing crystal payload. 24 dirs (+x = throw), anims 3:
   *   frame 0 cocked (arm back and low), 1 swinging up, 2 released (payload gone).
   * ================================================================== */
  M.elf_catapult = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    parts.push({ z0: 0, z1: 2.4, side: k.plS, top: k.st2T, ao: 0.3, at: [0, 0], layer: -2, shape: (c) => S.circ(c, 0, 0, 11), detail: (c) => { ring(c, k.fil, 0, 0, 9.8, 0.4); curlRing(c, k.fil, 0, 0, 8.6, 10, 1.1, 0.3); } });
    for (const s of [-1, 1]) {
      parts.push({ z0: 2.4, z1: 4.6, side: k.wdS, top: k.wdT, ao: 0.3, at: [0, s * 3.6], shape: (c) => { S.rrect(c, -8, s * 3.6 - 0.9, 15, 1.8, 0.8); S.circ(c, 7.4, s * 3.6, 1.4); S.circ(c, -8.2, s * 3.6, 1.4); },
        detail: (c) => { curl(c, k.fil, 6.6, s * 3.6, 1.2, 0, 0.35, s < 0); S.lines(c, k.seam, 0.3, [-6, s * 3.6, 5, s * 3.6]); } });
      parts.push({ z0: 4.6, z1: 14, side: k.wdS, top: k.wdT, ao: 0.3, at: [0.5, s * 3.6], shape: (c, zt) => { S.circ(c, -2 + zt * 3.6, s * 3.6, 0.85 - zt * 0.25); S.circ(c, 4.2 - zt * 2.6, s * 3.6, 0.8 - zt * 0.25); } });
      parts.push({ z0: 13.4, z1: 14.6, side: k.silS, top: k.silver, at: [0.5, s * 3.61], shape: (c) => S.circ(c, 1.6, s * 3.6, 1) });
    }
    parts.push({ z0: 12.6, z1: 14, side: k.wdS, top: k.wdT, at: [1.6, 0], shape: (c) => S.rrect(c, 1, -3.6, 1.2, 7.2, 0.5), detail: (c) => S.lines(c, k.bn, 0.5, [1.6, -1.5, 1.6, 1.5]) });
    parts.push({ z0: 4.2, z1: 6.8, side: mx(k.hayS, k.p.d, 0.2), top: k.hay, at: [-0.5, 0], shape: (c, zt) => { const w = 1.3 * cylW(zt); S.rect(c, -0.5 - w, -3.2, w * 2, 6.4); },
      detail: (c) => S.lines(c, 'rgba(90,70,30,0.5)', 0.3, [-1.2, -2, 0.2, -2, -1.2, 0, 0.2, 0, -1.2, 2, 0.2, 2]) });
    const PZ = 5.5, PX = -0.5, AL = 12.5;
    [168, 118, 76].forEach((deg, f) => {
      const th = deg * PI / 180, ca = Math.cos(th), sa = Math.sin(th);
      const tipX = PX + ca * AL, tipZ = PZ + sa * AL;
      const zLo = Math.min(PZ, tipZ) - 0.6, zHi = Math.max(PZ, tipZ) + 0.6;
      const on = (an) => Math.min(2, Math.floor(an * 3 + 1e-6)) === f;
      const armAt = (z) => { if (Math.abs(sa) < 0.05) return null; const t = (z - PZ) / sa; if (t < -1 || t > AL - 1) return null; return [PX + ca * t, 0]; };
      parts.push(Object.assign(curvePart([armAt], zLo, zHi, 1.4, k.wdS, k.wdT, { ao: 0.2 }), { at: [PX, 0.01], when: on }));
      parts.push({ z0: tipZ - 0.9, z1: tipZ + 0.6, side: k.silS, top: k.silver, at: [tipX, 0.02], when: on, shape: (c) => S.poly(c, leafPts(tipX, 0, 1.9, 1.5, th > PI / 2 ? PI : 0, 0.8, 0.2, 16)) });
      if (f < 2) parts.push({ z0: tipZ + 0.2, z1: tipZ + 2.6, side: k.glS, top: k.glHi, flat: true, bevel: false, at: [tipX, 0.03], when: on, shape: (c, zt) => S.circ(c, tipX, 0, 1.25 * cylW(zt) + 0.1), detail: (c) => glowDot(c, k.gl, tipX, 0, 2.4, 0.6) });
      else parts.push({ z0: tipZ + 1, z1: tipZ + 2, side: k.glHi, top: '#ffffff', flat: true, bevel: false, at: [tipX, 0.03], when: on, shape: (c) => { for (let i = 0; i < 4; i++) S.circ(c, tipX + 2 + i * 1.6, 0, 0.6 - i * 0.12); } });
    });
    return { r: 16, h: 22, parts: sorted(parts), style: 'unit', bevel: 0.7 };
  };

  /* ==================================================================
   * WALL — 40 long along x, ~7 thick. 16 dirs.
   *   L1 living hedge woven between pointed living-wood stakes
   *   L2 carved ivory stone, teal coping, leaf-blade merlons, end piers with caps
   *   L3 enchanted: taller, glowing rune band, silver tips, crystal-crowned piers
   * ================================================================== */
  M.elf_wall = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal)), L = U.clamp((opt.level | 0) || 1, 1, 3);
    const parts = [];
    if (L === 1) {
      parts.push({ z0: 0, z1: 1.4, side: mx(k.p.d, k.p.w, 0.4), top: mx(k.p.w, k.p.a, 0.4), at: [0, 0], ao: 0.2, shape: (c) => S.rrect(c, -20.5, -3.6, 41, 7.2, 3) });
      const sx = [-17.5, -11.7, -5.8, 0, 5.8, 11.7, 17.5];
      parts.push({ z0: 1, z1: 17.5, side: k.wdS, top: k.wdT, ao: 0.3, at: [0, 0], shape: (c, zt) => { const r = zt < 0.66 ? 1.15 : zt < 0.72 ? 1.45 : 1.15 * (1 - zt) / 0.28 + 0.08; for (const x of sx) S.circ(c, x, 0, r); } });
      parts.push({ z0: 11.4, z1: 12.2, side: k.silS, top: k.silver, bevel: false, at: [0, 0], shape: (c) => { for (const x of sx) S.circ(c, x, 0, 1.4); } });
      parts.push({ z0: 1, z1: 10.5, side: k.lfM, top: k.lfL, ao: 0.55, at: [0, 0], shape: (c, zt) => {
        const q = zt < 0.3 ? 0.85 + zt * 0.5 : Math.sqrt(Math.max(0.02, 1 - Math.pow((zt - 0.3) / 0.7, 2)));
        for (let i = 0; i < 9; i++) { const x = -18 + i * 4.5, r = 3.3 * q * (1 + 0.1 * Math.sin(i * 2.1)); S.circ(c, x, Math.sin(i * 1.7) * 0.4, r + 0.15); if (zt < 0.8) S.circ(c, x + 2.25, 0, r * 0.85); }
      }, detail: (c) => { for (let i = 0; i < 12; i++) S.dot(c, i % 3 ? '#f4e6f0' : k.lfG, -19 + i * 3.4, Math.sin(i * 2.7) * 1.4, 0.45); } });
      parts.push({ z0: 6, z1: 11, side: mx(k.lfM, k.lfL, 0.45), top: k.lfL, ao: 0.2, at: [0, 0], shape: (c, zt) => { const r = 2.4 * Math.sqrt(Math.max(0.02, 1 - zt * zt)); for (let i = 0; i < 8; i++) S.circ(c, -16.5 + i * 4.7, -0.8 + Math.sin(i * 2.3) * 0.3, r); } });
      parts.push({ z0: 4, z1: 10, side: k.gl, top: k.glHi, flat: true, bevel: false, at: [0, 0], shape: (c, zt) => { const hd = headingOf(c); const ny = Math.cos(hd) >= 0 ? 1 : -1; for (let i = 0; i < 6; i++) { const zz = 0.2 + (i * 0.37) % 0.7; if (Math.abs(zt - zz) > 0.06) continue; S.circ(c, -15 + i * 6.1, ny * 3.1, 0.45); } } });
      return { r: 24, h: 18, parts: sorted(parts), style: 'unit', bevel: 0.8 };
    }
    const HZ = L === 2 ? 13 : 15, half = 3;
    const bw = (zt) => half * (1 + 0.14 * (1 - zt));
    parts.push({ z0: 0, z1: 2, side: k.plS, top: k.plT, ao: 0.25, at: [0, 0], shape: (c) => S.rrect(c, -20, -4, 40, 8, 1.2) });
    parts.push({ z0: 2, z1: HZ, side: k.stS, top: k.stT, ao: 0.45, at: [0, 0], shape: (c, zt) => S.rect(c, -20, -bw(zt), 40, bw(zt) * 2),
      detail: (c) => { S.lines(c, k.seam, 0.35, [-20, 0, 20, 0]); for (let x = -16; x <= 16; x += 4) S.lines(c, rgba(k.p.d, 0.2), 0.3, [x, -half, x, half]); } });
    parts.push({ z0: 2.5, z1: HZ - 3, side: k.st2S, top: k.st2T, bevel: false, ao: 0.3, at: [0, 0], shape: (c, zt) => {
      for (const ny of [-1, 1]) { if (!facing(c, 0, ny, 0.05)) continue; for (let x = -14; x <= 14; x += 7) wallQuad(c, x, ny * bw(zt * (HZ - 5.5) / (HZ - 2) + 0.04), 0, ny, 2.2 * archW(zt, 0.5), 0.2, 0.6); }
    } });
    if (L === 3) parts.push({ z0: 6.4, z1: 7.6, side: k.gl, top: k.glHi, flat: true, bevel: false, at: [0, 0], shape: (c) => {
      for (const ny of [-1, 1]) { if (!facing(c, 0, ny, 0.05)) continue; for (let x = -14; x <= 14; x += 7) wallQuad(c, x, ny * bw(0.4), 0, ny, 0.5, 0.35, 0.3); }
    } });
    parts.push({ z0: HZ - 1, z1: HZ, side: k.rfM, top: k.rfB, ao: 0.1, at: [0, 0], shape: (c) => S.rect(c, -20, -half - 0.45, 40, half * 2 + 0.9) });
    parts.push({ z0: HZ, z1: HZ + 4, side: k.stS, top: L === 3 ? k.silver : k.stT, ao: 0.25, at: [0, 0], shape: (c, zt) => {
      const w = 1 - Math.pow(zt, 1.5);
      for (const yy of [-2.3, 2.3]) for (let x = -15; x <= 15.1; x += 5) S.poly(c, leafPts(x, yy, 1.7 * w + 0.15, 0.7 * w + 0.1, 0, 1, 1, 12));
    } });
    const pz = HZ + 3;
    for (const q of [[-20, 0], [20, 0]]) {
      parts.push({ z0: 0, z1: pz, side: k.stS, top: k.stT, ao: 0.45, at: q, shape: (c, zt) => { const r = 4.4 * (1 + 0.1 * (1 - zt)); S.rrect(c, q[0] - r, -r, r * 2, r * 2, 1.6); },
        detail: (c) => { S.lines(c, k.fil, 0.35, [q[0] - 2.5, 0, q[0] + 2.5, 0, q[0], -2.5, q[0], 2.5]); } });
      parts.push({ z0: pz - 1.4, z1: pz - 0.4, side: k.silS, top: k.rib, bevel: false, at: q, shape: (c) => S.rrect(c, q[0] - 4.9, -4.9, 9.8, 9.8, 1.8) });
      if (L === 2) parts.push({ z0: pz, z1: pz + 6, side: k.rfM, top: k.rfT, ao: 0.3, at: q, shape: (c, zt) => { const r = 4.6 * PROF.flare(zt); S.rrect(c, q[0] - r, -r, r * 2, r * 2, r * 0.45); } });
      else parts.push(...anchor(q, crystal(k, [q], pz, 2.2, 8, { pulse: true })));
    }
    return { r: 26, h: L === 2 ? 23 : 27, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * GATE — 40 wide along x, two gate towers. 16 dirs.
   *   L1 two living tree pylons whose boughs meet in an arch, woven gate
   *   L2 ivory towers with bud domes, pointed stone arch, crenellated walk, filigree doors
   *   L3 taller spired towers with crystal crowns, glowing enchanted leaf-doors
   * ================================================================== */
  M.elf_gate = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal)), L = U.clamp((opt.level | 0) || 1, 1, 3);
    const parts = [];
    const TX = 15;
    if (L === 1) {
      parts.push({ z0: 0, z1: 0.9, side: mx(k.lfD, k.p.d, 0.3), top: mx(k.lfD, k.p.a, 0.45), at: [0, 0], layer: -1, ao: 0.2, shape: (c) => { S.rrect(c, -18, -3.4, 36, 6.8, 3.4); S.circ(c, -TX + 1, 0, 5); S.circ(c, TX - 1, 0, 5); } });
      // woven gate doors (closed) with a vine lattice on both faces
      parts.push({ z0: 0.6, z1: 11.5, side: k.wdS, top: k.wdT, ao: 0.35, at: [0, 0], shape: (c, zt) => { const hw = 9 * archW(zt, 0.62); S.rect(c, -hw, -0.6, hw * 2, 1.2); } });
      parts.push({ z0: 1, z1: 10.6, side: k.lfM, top: k.lfL, bevel: false, ao: 0.2, at: [0, 0.01], shape: (c, zt) => { const hw = 8.8 * archW(zt, 0.62); for (const ny of [-1, 1]) { if (!facing(c, 0, ny, 0.05)) continue; for (let x = -7; x <= 7; x += 3.5) if (Math.abs(x) < hw - 0.4) wallQuad(c, x + Math.sin(zt * 9 + x) * 0.6, ny * 0.6, 0, ny, 0.32, 0.25, 0.1); wallQuad(c, 0, ny * 0.6, 0, ny, 0.25, 0.3, 0.1); } } });
      // two living trunks as pylons
      for (const sx of [-1, 1]) parts.push(...anchor([sx * TX, 0], tree(k, { x: sx * (TX - 1), y: 0, th: 17, cr: 5.8, ch: 7, seed: 50 + sx, tr: 2.3, lean: [-sx * 0.6, 0], noRoots: true })));
      // boughs grown into a pointed arch, leafy, with a lantern at the apex
      const bough = (sx) => (z) => { if (z < 7 || z > 19.5) return null; const q = (z - 7) / 12.5; return [sx * (TX - 1.6) * (1 - Math.pow(q, 1.6)), 0]; };
      parts.push(Object.assign(curvePart([bough(-1), bough(1)], 7, 19.5, 2, k.bark, k.barkT, { ao: 0.2 }), { at: [0, 0.02] }));
      parts.push({ z0: 9, z1: 20.5, side: k.lfM, top: k.lfL, bevel: false, ao: 0.15, at: [0, 0.03], shape: (c, zt) => {
        const z = 9 + zt * 11.5, q = (z - 7) / 12.5; if ((z % 1.7) > 0.9) return;
        const x = (TX - 1.6) * (1 - Math.pow(q, 1.6)); for (const sx of [-1, 1]) { S.circ(c, sx * x + Math.sin(z * 3) * 0.6, 1.1, 0.8); S.circ(c, sx * x - Math.sin(z * 2) * 0.6, -1.1, 0.8); }
      } });
      parts.push(...anchor([0, 0.04], lantern(k, [[0, 0]], 2.4, 16.5)));
      return { r: 26, h: 33, parts: sorted(parts), style: 'unit', bevel: 0.8 };
    }
    const TR = L === 2 ? 5.6 : 6, TZ = L === 2 ? 24 : 30, AZ = L === 2 ? 18 : 22;
    const tp = [[-TX, 0], [TX, 0]];
    parts.push({ z0: 0, z1: 1.5, side: k.plS, top: k.plT, at: [0, 0], layer: -1, shape: (c) => { S.rrect(c, -22, -5, 44, 10, 3); } });
    const ow = 6.2, spring = AZ - 6;
    const owAt = (z) => (z < spring ? ow : ow * archW(z / (AZ - 1.5), spring / (AZ - 1.5)));
    parts.push({ z0: 1.5, z1: AZ - 1.5, side: L === 3 ? k.glS : k.door, top: L === 3 ? k.glHi : k.wdT, flat: L === 3, ao: 0.3, at: [0, 0], shape: (c, zt) => { const z = 1.5 + zt * (AZ - 3); const w = owAt(z); S.rect(c, -w, -0.7, w * 2, 1.4); } });
    parts.push({ z0: 2, z1: AZ - 2, side: L === 3 ? k.glHi : k.silS, top: L === 3 ? '#ffffff' : k.silver, flat: L === 3, bevel: false, ao: 0.1, at: [0, 0.01], shape: (c, zt) => {
      const z = 2 + zt * (AZ - 4), w = owAt(z) - 0.6;
      for (const ny of [-1, 1]) { if (!facing(c, 0, ny, 0.05)) continue; wallQuad(c, 0, ny * 0.7, 0, ny, 0.22, 0.3, 0.1); for (const sx of [-1, 1]) { const xx = sx * (w * 0.5 + Math.sin(zt * PI * 2) * w * 0.25); if (w > 1) wallQuad(c, xx, ny * 0.7, 0, ny, 0.2, 0.3, 0.1); } }
    } });
    parts.push({ z0: 1.5, z1: AZ + 2, side: k.stS, top: k.stT, ao: 0.45, at: [0, 0.02], shape: (c, zt) => {
      const z = 1.5 + zt * (AZ + 0.5), w = z >= AZ - 1.5 ? 0 : owAt(z) + 0.01, hw = 3.6;
      if (w <= 0) { S.rect(c, -TX, -hw, TX * 2, hw * 2); return; }
      S.rect(c, -TX, -hw, TX - w, hw * 2); S.rect(c, w, -hw, TX - w, hw * 2);
    }, detail: (c) => { S.lines(c, k.seam, 0.35, [-TX, 0, TX, 0]); } });
    parts.push({ z0: 1.5, z1: AZ - 0.6, side: k.silS, top: k.rib, bevel: false, ao: 0.1, at: [0, 0.03], shape: (c, zt) => {
      const z = 1.5 + zt * (AZ - 2.1), w = owAt(Math.min(z, AZ - 1.6)) + 0.55;
      for (const ny of [-1, 1]) { if (!facing(c, 0, ny, 0.05)) continue; for (const sx of [-1, 1]) wallQuad(c, sx * w, ny * 3.6, 0, ny, 0.5, 0.3, 0.2); }
    } });
    parts.push({ z0: AZ + 1, z1: AZ + 2, side: k.rfM, top: k.rfB, at: [0, 0.04], shape: (c) => S.rect(c, -TX + 2, -4.05, TX * 2 - 4, 8.1) });
    parts.push({ z0: AZ + 2, z1: AZ + 5.5, side: k.stS, top: L === 3 ? k.silver : k.stT, ao: 0.25, at: [0, 0.05], shape: (c, zt) => { const w = 1 - Math.pow(zt, 1.5); for (const yy of [-2.9, 2.9]) for (let x = -7.5; x <= 7.6; x += 5) S.poly(c, leafPts(x, yy, 1.7 * w + 0.15, 0.7 * w + 0.1, 0, 1, 1, 12)); } });
    if (L === 3) parts.push(...anchor([0, 0.06], crystal(k, [[0, 3.9]], AZ - 3.5, 1.1, 4.5, { pulse: true })));
    for (const q of tp) {
      const qa = [q];
      parts.push(...anchor(q, [
        towerBody(k, qa, TR, 1.5, TZ, 0.15),
        arcWins(k, qa, TR, TZ - 9, TZ - 4, [PI * 0.5], 0.2, L === 3 ? k.glHi : k.dark, undefined, true),
        arcWins(k, qa, TR, 6, 10, [PI * 0.5], 0.14, k.dark, undefined, true),
        frontBand(k, qa, TR, TZ - 1.2, TZ),
        ...capRoof(k, { pts: qa, R: TR + 1, z0: TZ, H: L === 2 ? 11 : 15, prof: L === 2 ? 'bud' : 'spire', ribs: 4, finial: L === 2 ? 5 : 0, band: true }),
      ]));
      if (L === 3) parts.push(...anchor([q[0], 0.01], crystal(k, qa, TZ + 14, 1.5, 7, { pulse: true, halo: true })));
    }
    parts.push(...anchor([0, 0.07], banner(k, [[-TX + TR + 0.6, 0, 1], [TX - TR - 0.6, 0, -1]], AZ + 2, 12, { len: 3.6 })));
    return { r: 26, h: L === 2 ? TZ + 18 : TZ + 23, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * WATCHTOWER — a living silver-barked tree grown into a lookout: spiral stair,
   * leafy boughs, a round flet platform with silver rail, a leaf-petal canopy and
   * a crystal beacon brazier on top (anims 4 flicker). ~16 base, ~66 tall.
   * ================================================================== */
  M.elf_watchtower = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const FZ = 38;
    const trR = (z) => 3.3 * (1 + 1.3 * Math.pow(Math.max(0, 1 - z / 10), 2.5)) * (1 - z / 320);
    const sw = (z) => Math.sin(z * 0.09) * 0.7;
    // mossy root mound with flowers
    parts.push({ z0: 0, z1: 1.6, side: mx(k.lfD, k.p.d, 0.2), top: mx(k.lfD, k.lfM, 0.5), ao: 0.3, shape: (c, zt) => cloud(c, 0, 0.5, 8 * (1 - zt * 0.3), 4, 9),
      detail: (c) => { for (let i = 0; i < 8; i++) S.dot(c, i % 2 ? '#f4e6f0' : k.lfG, Math.cos(i * 0.8 + 0.3) * 5.6, 0.5 + Math.sin(i * 0.8 + 0.3) * 4.8, 0.45); } });
    // boughs behind the trunk
    parts.push(...crown(k, { x: 0.5, y: -6.5, z0: FZ - 6, cr: 8.5, ch: 15, seed: 64 }));
    parts.push(...crown(k, { x: -8, y: -2.5, z0: FZ - 12, cr: 7.2, ch: 10, seed: 61 }));
    parts.push(...crown(k, { x: 8.2, y: -2, z0: FZ - 14, cr: 6.6, ch: 9.5, seed: 62 }));
    // silver-barked trunk with buttress roots
    parts.push({ z0: 0.5, z1: FZ + 2, side: k.silverBark, top: k.barkT, ao: 0.35, shape: (c, zt) => {
      const z = 0.5 + zt * (FZ + 1.5), r = trR(z), x = sw(z);
      S.circ(c, x, 0, r);
      if (z < 6) for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.5, d = r * 0.75 + (6 - z) * 0.35; S.circ(c, x + Math.cos(a) * d, Math.sin(a) * d * 0.9, (6 - z) * 0.22 + 0.5); }
    } });
    parts.push({ z0: 3, z1: FZ - 2, side: k.silverBarkS, top: k.silverBarkS, bevel: false, ao: 0.1, shape: (c, zt) => { const z = 3 + zt * (FZ - 5), r = trR(z) + 0.05, hd = -headingOf(c); for (const a0 of [0.35, 0.8, 1.25, 1.75, 2.45]) { const a = hd + a0 + Math.sin(z * 0.15 + a0) * 0.12; S.circ(c, sw(z) + Math.cos(a) * r, Math.sin(a) * r, 0.24); } } });
    parts.push(vine(k, 0, 0, (z) => trR(z) + 0.1, 5, FZ - 4, 1.8, 0.6));
    // a bough in front, low
    parts.push(...crown(k, { x: 6, y: 4.5, z0: FZ - 10, cr: 5, ch: 7, seed: 63, gold: true }));
    parts.push(...crown(k, { x: -6.5, y: 4, z0: FZ - 7, cr: 3.8, ch: 5, seed: 65 }));
    // flet: corbel, deck, posts, rail, petal canopy
    parts.push({ z0: FZ - 2.5, z1: FZ, side: k.wdS, top: k.wdT, ao: 0.35, shape: (c, zt) => S.circ(c, 0, 0, 4.5 + 5 * Math.pow(zt, 0.8)) });
    parts.push({ z0: FZ, z1: FZ + 1.2, side: k.st2S, top: k.pave, shape: (c) => S.circ(c, 0, 0, 10), detail: (c) => { ring(c, k.fil, 0, 0, 8.4, 0.4); leafMosaic(c, 0, 0, 6, 6, rgba(k.p.a, 0.35)); } });
    parts.push({ z0: FZ + 1.2, z1: FZ + 9, side: k.silS, top: k.silver, bevel: false, shape: (c) => { for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + PI / 2; S.circ(c, Math.cos(a) * 6.8, Math.sin(a) * 6.8, 0.5); } } });
    parts.push(rail(k, 0, 0, 9.5, FZ + 1.2, 2.6, 18));
    parts.push(...capRoof(k, { pts: [[0, 0]], R: 9.4, z0: FZ + 9, H: 7.5, prof: 'flare', ribs: 6, finial: 0, band: true }));
    // beacon brazier: silver bowl + crystal flame
    parts.push({ z0: FZ + 15.5, z1: FZ + 18, side: k.silS, top: k.silver, ao: 0.2, shape: (c, zt) => S.circ(c, 0, 0, 1.2 + zt * 1.8), detail: (c) => S.dot(c, k.dark, 0, 0, 2.4) });
    parts.push({ z0: FZ + 17, z1: FZ + 25, side: k.gl, top: k.glHi, flat: true, bevel: false, ao: -0.3, shape: (c, zt, an) => {
      const w = Math.sin(an * TAU) * 0.6; const r = 2.6 * Math.pow(1 - zt, 0.75) * (1 + 0.18 * Math.sin(an * TAU * 2 + zt * 6)) + 0.15; S.circ(c, w * zt, Math.sin(zt * 4 + an * TAU) * 0.3, r); },
      detail: (c, an) => glowDot(c, k.gl, 0, 0, 5.5 + Math.sin(an * TAU) * 1.4, 0.55) });
    parts.push({ z0: FZ + 17, z1: FZ + 21.5, side: k.glHi, top: '#ffffff', flat: true, bevel: false, ao: 0, shape: (c, zt, an) => S.circ(c, 0, 0, 1.3 * (1 - zt) + 0.15 + 0.1 * Math.sin(an * TAU)) });
    return { r: 18, h: FZ + 27, parts, style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * TEMPLE — healers' rotunda: three-step round plinth, a ring of slender
   * columns around a softly glowing healing heart, a ribbed teal dome with a
   * crystal lantern, a crescent reflecting pool and two silver trees. anims 4.
   * ================================================================== */
  M.elf_temple = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const CY = -4, CR = 13, NZ = 4.5, CZ = 16;
    parts.push({ z0: 0, z1: 1.5, side: k.plS, top: k.plT, at: [0, -99], layer: -1, shape: (c) => S.circ(c, 0, CY + 2, 22) });
    parts.push({ z0: 1.5, z1: 3, side: k.st2S, top: k.st2T, at: [0, -99], layer: -1, shape: (c) => S.circ(c, 0, CY + 1, 19), detail: (c) => curlRing(c, k.fil, 0, CY + 1, 17, 14, 1.6, 0.4) });
    parts.push({ z0: 3, z1: NZ, side: k.stS, top: k.stT, at: [0, -99], layer: -1, shape: (c) => S.circ(c, 0, CY, 16), detail: (c) => { ring(c, k.fil, 0, CY, 14.6, 0.4); glowDot(c, k.gl, 0, CY, 15, 0.35); } });
    parts.push({ z0: 0, z1: 0.9, side: k.st2S, top: k.st2T, at: [0, 30], layer: -1, shape: (c) => S.poly(c, crescentPts(0, CY + 6, 25, 3.6, PI * 0.2, PI * 0.8, 24, 0.5)) });
    parts.push({ z0: 0.6, z1: 0.75, side: k.water, top: k.water, flat: true, bevel: false, at: [0, 30], layer: -1, shape: (c) => S.poly(c, crescentPts(0, CY + 6, 25, 2.4, PI * 0.22, PI * 0.78, 24, 0.5)),
      detail: (c, an) => { for (let i = 0; i < 5; i++) { const a = PI * (0.3 + i * 0.1) + an * 0.05; S.lines(c, 'rgba(255,255,255,0.5)', 0.3, [Math.cos(a) * 25 - 1, CY + 6 + Math.sin(a) * 25, Math.cos(a) * 25 + 1, CY + 6 + Math.sin(a) * 25]); } } });
    parts.push(...anchor([0, 30], stairs(k, 0, CY + 14.5, CY + 21.5, 9, NZ, 4, [k.stS, k.stT])));
    for (const s of [-1, 1]) parts.push(...anchor([0, -40], tree(k, { x: s * 21, y: CY - 10, th: 10, cr: 7.5, ch: 8, seed: 70 + s, bark: k.silverBark, barkT: k.silver, gold: s > 0 })));
    const colAt = (i) => { const a = i / 10 * TAU + PI / 10; return [Math.cos(a) * CR, CY + Math.sin(a) * CR, Math.sin(a)]; };
    const col = (front) => ({ z0: NZ, z1: CZ, side: k.stS, top: k.stT, ao: 0.3, shape: (c, zt) => { for (let i = 0; i < 10; i++) { const q = colAt(i); if ((q[2] > -0.05) !== front) continue; S.circ(c, q[0], q[1], (zt < 0.06 || zt > 0.93) ? 1.4 : 0.95); } } });
    parts.push(...anchor([0, CY], [
      col(false),
      { z0: NZ, z1: CZ - 0.5, side: mx(k.gl, '#ffffff', 0.35), top: k.glHi, flat: true, ao: -0.1, bevel: false, shape: (c) => S.circ(c, 0, CY, CR - 2.2),
        detail: (c, an) => glowDot(c, '#ffffff', 0, CY, 6 + an * 2, 0.4) },
      { z0: NZ, z1: CZ - 2, side: mx(k.gl, '#ffffff', 0.55), top: '#ffffff', flat: true, bevel: false, ao: 0, shape: (c) => { const a0 = PI * 0.6, r = CR - 2.1; c.moveTo(Math.cos(a0) * r, CY + Math.sin(a0) * r); c.arc(0, CY, r, a0, a0 + 0.35); c.arc(0, CY, r - 0.8, a0 + 0.35, a0, true); c.closePath(); } },
      col(true),
      { z0: CZ, z1: CZ + 2, side: k.stS, top: k.stT, ao: 0.25, shape: (c) => S.circ(c, 0, CY, CR + 1.8) },
      frontBand(k, [[0, CY]], CR + 1.8, CZ + 0.5, CZ + 1.3, k.silS, k.rib),
      ...capRoof(k, { pts: [[0, CY]], R: CR + 0.8, z0: CZ + 2, H: 11, prof: 'dome', ribs: 8, finial: 0, band: true }),
    ]));
    parts.push(...anchor([0, CY + 0.1], [
      { z0: CZ + 12.5, z1: CZ + 15, side: k.silS, top: k.silver, shape: (c, zt) => S.circ(c, 0, CY, 1.8 - zt * 0.6) },
      ...crystal(k, [[0, CY]], CZ + 15, 1.5, 7, { pulse: true, halo: true }),
    ]));
    parts.push(...anchor([0, 20], lantern(k, [[-8, CY + 20], [8, CY + 20]], 4.5)));
    return { r: 32, h: CZ + 24, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * MARKET — a crescent of stalls under striped leaf awnings around a crystal
   * fountain on a leaf-mosaic plaza; crates, baskets, cloth bolts, a tree.
   * ================================================================== */
  M.elf_market = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    parts.push({ z0: 0, z1: 1, side: k.plS, top: mx(k.pave, k.p.a, 0.15), layer: -1, ao: 0.2, shape: (c) => S.circ(c, 0, 1, 26),
      detail: (c) => { ring(c, k.fil, 0, 0, 24.5, 0.45); leafMosaic(c, 0, 0, 13, 10, rgba(k.p.a, 0.3)); ring(c, rgba(k.p.d, 0.2), 0, 0, 9.5, 0.4); } });
    parts.push(...anchor([0, -40], tree(k, { x: -22, y: -16, th: 9, cr: 8, ch: 9, seed: 81, gold: true })));
    const SR = 17;
    const sp = [0.3, 0.98, 1.24, 1.5, 1.76, 2.02, 0.7].map((q) => { const a = q * PI; return [Math.cos(a) * SR, Math.sin(a) * SR + 2, a]; });
    const awn = [['#c8902a', '#fff0c8'], [k.p.t, k.bn2], [k.bn, k.bn2], ['#b24a7a', '#f2e0ea'], [k.p.t, '#ffffff'], [k.bn, '#fff0c8'], ['#5a6ab8', '#e8ecff']];
    const gd = ['#e05a3a', '#e8b84a', '#9cd04a', '#7a4ac0', '#f4f0e0', '#4ab0d0'];
    for (const grp of [sp.filter((q) => q[1] < 8), sp.filter((q) => q[1] >= 8)]) {
      parts.push(...anchor([0, grp[0][1]], [
        { z0: 0.5, z1: 4.4, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c) => { for (const q of grp) S.poly(c, tf([-4.2, -1.6, 4.2, -1.6, 4.2, 1.6, -4.2, 1.6], q[0], q[1], q[2] + PI / 2)); },
          detail: (c) => { grp.forEach((q, i) => { for (let j = 0; j < 5; j++) { const p = tf([-3 + j * 1.5, 0], q[0], q[1], q[2] + PI / 2); S.dot(c, gd[(Math.round(q[2] * 3) + j) % gd.length], p[0], p[1], 0.65); } }); } },
        { z0: 0.5, z1: 9.5, side: k.silS, top: k.silver, bevel: false, shape: (c) => { for (const q of grp) for (const d of [[-4, -2.2], [4, -2.2], [-4, 2.2], [4, 2.2]]) { const p = tf(d, q[0], q[1], q[2] + PI / 2); S.circ(c, p[0], p[1], 0.32); } } },
      ]));
    }
    sp.forEach((q, i) => {
      parts.push({ z0: 9.3, z1: 11.4, side: sh(awn[i][0], -0.15), top: awn[i][0], ao: 0.25, at: [0, q[1] + 0.5], shape: (c, zt) => S.poly(c, leafPts(q[0], q[1], 6.8 * (1 - zt * 0.15), 4.2 * (1 - zt * 0.75) + 0.2, q[2] + PI / 2, 1, 0.8, 22)),
        detail: (c) => { c.save(); c.beginPath(); S.poly(c, leafPts(q[0], q[1], 6.4, 4, q[2] + PI / 2, 1, 0.8, 22)); c.clip(); c.strokeStyle = awn[i][1]; c.lineWidth = 1; c.beginPath(); for (let j = -4; j <= 4; j += 2) { const a = tf([j, -4, j, 4], q[0], q[1], q[2] + PI / 2); c.moveTo(a[0], a[1]); c.lineTo(a[2], a[3]); } c.stroke(); c.restore(); S.lines(c, k.rib, 0.5, tf([6.4, 0, -6.4, 0], q[0], q[1], q[2] + PI / 2)); } });
    });
    parts.push(...anchor([0, 2], [
      { z0: 1, z1: 3.2, side: k.stS, top: k.stT, ao: 0.35, shape: (c) => annulus(c, 0, 2, 6.8, 5.4) },
      { z0: 2.4, z1: 2.5, side: k.water, top: k.water, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 2, 5.5), detail: (c) => { glowDot(c, k.gl, 0, 2, 5, 0.45); ring(c, 'rgba(255,255,255,0.45)', 0, 2, 3.4, 0.3); } },
      { z0: 2.4, z1: 5.5, side: k.stS, top: k.stT, shape: (c, zt) => S.circ(c, 0, 2, 1.6 - zt * 0.5) },
      ...crystal(k, [[0, 2]], 5.5, 1.4, 7),
    ]));
    parts.push(...anchor([0, 12], [
      { z0: 1, z1: 4.2, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c) => { S.rect(c, 16, 9.5, 4, 4); S.rect(c, 20.2, 11.6, 3.4, 3.4); S.rect(c, -22, 8.5, 3.6, 3.6); },
        detail: (c) => { S.lines(c, k.seam, 0.3, [16, 9.5, 20, 13.5, 20, 9.5, 16, 13.5, 20.2, 11.6, 23.6, 15, -22, 8.5, -18.4, 12.1]); } },
      { z0: 4.2, z1: 6.6, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c) => S.rect(c, 16.5, 10, 3, 3) },
      { z0: 1, z1: 3.4, side: mx(k.hayS, k.p.d, 0.2), top: k.hay, ao: 0.3, shape: (c) => { S.circ(c, -16.5, 13.5, 1.7); S.circ(c, -14, 15.8, 1.5); S.circ(c, 6, 11.5, 1.6); },
        detail: (c) => { const fr = ['#e05a3a', '#e8b84a', '#9cd04a', '#7a4ac0']; [[-16.5, 13.5], [-14, 15.8], [6, 11.5]].forEach((q, i) => { for (let j = 0; j < 4; j++) S.dot(c, fr[(i + j) % 4], q[0] + Math.cos(j * 1.6) * 0.7, q[1] + Math.sin(j * 1.6) * 0.7, 0.5); }); } },
      { z0: 1, z1: 2.6, side: '#6a3a8a', top: '#a070c8', shape: (c, zt) => { const w = 0.8 * cylW(zt); S.rect(c, -7.5, 11.5 - w, 5, w * 2); }, detail: (c) => S.lines(c, 'rgba(255,255,255,0.4)', 0.3, [-7.1, 11.2, -2.9, 11.2]) },
      { z0: 2.6, z1: 4, side: sh(k.p.t, -0.1), top: k.rfB, shape: (c, zt) => { const w = 0.7 * cylW(zt); S.rect(c, -7, 11.5 - w, 4.2, w * 2); } },
    ]));
    parts.push(...anchor([0, 24], lantern(k, [[-6.5, 24], [6.5, 24]], 5)));
    return { r: 30, h: 22, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * WORKSHOP — siege workshop: an open veined-leaf hall on slim columns, a
   * curved timber crane with a hanging beam, a half-built recurve ballista on a
   * cradle, a log pile and a workbench with a glowing crystal. ~58 across.
   * ================================================================== */
  M.elf_workshop = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    parts.push({ z0: 0, z1: 0.8, side: k.yardS, top: mx(k.yard, k.pave, 0.25), layer: -1, ao: 0.15, shape: (c) => S.poly(c, leafPts(0, 2, 28, 18, 0.08, 0.7, 0.2, 40)),
      detail: (c) => { for (let i = 0; i < 14; i++) S.lines(c, 'rgba(120,90,50,0.35)', 0.35, [-12 + i * 2.1, 10 + Math.sin(i) * 3, -11 + i * 2.1, 10.8 + Math.sin(i) * 3]); ring(c, rgba(k.p.d, 0.15), 6, 10, 6, 0.4); } });
    const H0 = { x: -7, y: -9, L: 17, W: 8.5 };
    parts.push(...anchor([0, -9], [
      plinth(k, (c) => S.poly(c, leafPts(H0.x, H0.y, H0.L + 1, H0.W + 1, 0, 1, 0.5)), 1.4),
      { z0: 1.4, z1: 6, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c) => { S.rect(c, -16, -12, 14, 2.6); S.rect(c, 0, -14, 6, 3); } },
      { z0: 1.4, z1: 11.5, side: k.stS, top: k.stT, ao: 0.3, shape: (c, zt) => { const r = (zt < 0.06 || zt > 0.92) ? 1.15 : 0.75; for (const q of [[-19, -9], [-11, -15], [-11, -3], [-1, -15], [-1, -3], [6, -9]]) S.circ(c, q[0], q[1], r); } },
      ...leafRoof(k, { x: H0.x, y: H0.y, L: H0.L + 2.5, W: H0.W + 2.2, rot: 0, z0: 11.5, H: 8, veins: 5, hornH: 4.5 }),
    ]));
    const mx0 = 18, my0 = -6, MZ = 30;
    parts.push(...anchor([0, -6], [
      { z0: 0.8, z1: 3, side: k.st2S, top: k.st2T, shape: (c) => S.circ(c, mx0, my0, 3.2) },
      { z0: 3, z1: MZ, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c, zt) => S.circ(c, mx0, my0, 1.3 - zt * 0.4) },
      curvePart([(z) => (z < 3 || z > 16 ? null : [mx0 + 7 - (z - 3) / 13 * 6.2, my0 + 2 - (z - 3) / 13 * 1.8])], 3, 16, 0.8, k.wdS, k.wdT),
      { z0: MZ - 1, z1: MZ + 1, side: k.silS, top: k.silver, shape: (c) => S.circ(c, mx0, my0, 1.4) },
      curvePart([(z) => { if (z < 18 || z > MZ) return null; const q = (MZ - z) / (MZ - 18); return [mx0 - q * 17 - Math.sin(q * PI) * 1.5, my0 + q * 13]; }], 18, MZ, 1.1, k.wdS, k.wdT),
    ]));
    const tipX = mx0 - 17, tipY = my0 + 13;
    parts.push({ z0: 9, z1: 18.2, side: '#c8bc98', top: '#efe6c8', bevel: false, at: [0, tipY], shape: (c) => S.circ(c, tipX, tipY, 0.22) });
    parts.push({ z0: 7.4, z1: 9, side: k.wdS, top: k.wdT, at: [0, tipY + 0.01], shape: (c) => S.rect(c, tipX - 5, tipY - 0.5, 10, 1), detail: (c) => S.lines(c, k.silver, 0.4, [tipX - 0.4, tipY - 0.5, tipX - 0.4, tipY + 0.5, tipX + 0.4, tipY - 0.5, tipX + 0.4, tipY + 0.5]) });
    // half-built recurve ballista on trestles: one limb fitted, the other lying in front
    const bx = -5, by = 11;
    const limbPts = (x0, y0, sx, sy, len, w) => { const a = []; for (let i = 0; i <= 10; i++) { const u = i / 10; a.push(x0 + sx * (len * 0.5 * u * u) + w * Math.sin(u * PI) * 0.6, y0 + sy * u * len); } for (let i = 10; i >= 0; i--) { const u = i / 10; a.push(x0 + sx * (len * 0.5 * u * u) - w * Math.sin(u * PI) * 0.6 - 0.4, y0 + sy * u * len); } return a; };
    parts.push(...anchor([0, 11], [
      { z0: 0.8, z1: 4, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c, zt) => { for (const x of [bx - 8, bx + 7]) { const sp = 1.6 * (1 - zt * 0.5); S.rect(c, x - 0.5, by - sp - 0.4, 1, 0.8); S.rect(c, x - 0.5, by + sp - 0.4, 1, 0.8); } } },
      { z0: 4, z1: 5.8, side: k.wdS, top: k.wdT, ao: 0.25, shape: (c) => S.poly(c, [bx + 11, by - 0.9, bx + 12, by, bx + 11, by + 0.9, bx - 10, by + 1.2, bx - 11, by, bx - 10, by - 1.2]),
        detail: (c) => { S.lines(c, k.fil, 0.4, [bx - 8, by, bx + 9, by]); S.lines(c, k.seam, 0.3, [bx - 3, by - 1.1, bx - 3, by + 1.1, bx + 4, by - 1, bx + 4, by + 1]); } },
      { z0: 5, z1: 6.6, side: k.stS, top: k.stT, ao: 0.2, shape: (c) => S.poly(c, limbPts(bx + 6, by - 1, -1, -1, 9.5, 1.3)), detail: (c) => S.lines(c, rgba(k.p.t, 0.8), 0.4, [bx + 6, by - 2, bx + 4.6, by - 7, bx + 4.6, by - 7, bx + 1.6, by - 10]) },
      { z0: 5, z1: 6.9, side: k.silS, top: k.silver, shape: (c) => S.circ(c, bx + 1.4, by - 10.4, 0.6) },
      { z0: 0.8, z1: 2.2, side: k.stS, top: k.stT, ao: 0.25, shape: (c) => S.poly(c, limbFlat(bx - 3, by + 5)) },
      ...crystal(k, [[bx + 12.2, by]], 4.4, 0.9, 3),
    ]));
    parts.push(...anchor([0, 9], [
      { z0: 0.8, z1: 3.6, side: k.bark, top: k.barkT, ao: 0.3, shape: (c, zt) => { const w = 1.4 * cylW(zt); for (const q of [[18, 6], [18, 9], [18, 12]]) S.rrect(c, q[0] - 6, q[1] - w, 12, w * 2, w); }, detail: (c) => { for (const q of [[18, 6], [18, 9], [18, 12]]) { S.dot(c, k.wdT, q[0] + 6, q[1], 1.2); ring(c, k.wdS, q[0] + 6, q[1], 0.6, 0.25); } } },
      { z0: 3.4, z1: 6.2, side: k.bark, top: k.barkT, ao: 0.3, shape: (c, zt) => { const w = 1.4 * cylW(zt); for (const q of [[18.5, 7.5], [18.5, 10.5]]) S.rrect(c, q[0] - 5.5, q[1] - w, 11, w * 2, w); }, detail: (c) => { for (const q of [[18.5, 7.5], [18.5, 10.5]]) S.dot(c, k.wdT, q[0] + 5.5, q[1], 1.2); } },
    ]));
    parts.push(...anchor([0, 4], [
      { z0: 0.8, z1: 4.4, side: k.wdS, top: k.wdT, ao: 0.3, shape: (c) => S.rect(c, -24, 2, 8, 3.2), detail: (c) => { S.lines(c, k.silver, 0.4, [-22, 3, -20, 4.4]); S.dot(c, k.silS, -18, 3.2, 0.6); } },
      ...crystal(k, [[-21, 3.6]], 4.4, 0.8, 3.4),
    ]));
    parts.push(...anchor([0, 14], lantern(k, [[8, 17]], 4.5)));
    return { r: 32, h: 34, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * WARDSTONE — a leaf-shaped ivory monolith on mossy root stones with a
   * glowing rune channel, a floating crystal shard above its tip and three
   * orbiting motes (anims 4 pulse). ~14 base, ~30 tall.
   * ================================================================== */
  M.elf_wardstone = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const H = 24, ROT = 0.12;
    parts.push({ z0: 0, z1: 0.8, side: mx(k.p.d, k.p.a, 0.3), top: mx(k.lfD, k.p.a, 0.3), ao: 0.2, shape: (c) => S.blob(c, 0, 0.5, 8.5, 9, 13, 0.16),
      detail: (c, an) => { ring(c, rgba(k.gl, 0.5 + 0.3 * Math.sin(an * TAU)), 0, 0.5, 6.8, 0.55); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.3; S.dot(c, k.glHi, Math.cos(a) * 6.8, 0.5 + Math.sin(a) * 6.8, 0.45); } } });
    parts.push({ z0: 0.5, z1: 3.2, side: k.st2S, top: mx(k.st2T, k.lfM, 0.4), ao: 0.4, shape: (c, zt) => { for (const q of [[-4.6, 1.2, 2.2], [4.4, 1.6, 1.9], [0.6, -2.4, 2.1], [-1.5, 2.8, 1.4]]) S.blob(c, q[0], q[1], q[2] * (1 - zt * 0.4), q[0] * 7 + 3, 7, 0.3); } });
    const secL = (zt) => 4.4 * (zt < 0.5 ? 1 + 0.1 * Math.sin(zt / 0.5 * PI) : Math.pow((1 - zt) / 0.5, 0.75)) + 0.15;
    const secW = (zt) => 2 * (zt < 0.5 ? 1 : Math.pow((1 - zt) / 0.5, 0.6)) + 0.12;
    const leanX = (zt) => Math.pow(zt, 2.2) * 1.6;
    parts.push({ z0: 1.5, z1: 1.5 + H, side: k.stS, top: k.stT, ao: 0.45, shape: (c, zt) => S.poly(c, leafPts(leanX(zt), 0, secL(zt), secW(zt), ROT, 0.9, 0.9, 22)),
      detail: (c) => S.dot(c, k.glHi, leanX(1), 0, 0.3) });
    // silver edge inlay + glowing rune channel on the camera face
    parts.push({ z0: 2.5, z1: 1.5 + H * 0.86, side: k.silS, top: k.silver, bevel: false, ao: 0.1, shape: (c, zt) => {
      const q = (2.5 + zt * (H * 0.86 - 1) - 1.5) / H; for (const u of [0.2, 0.8]) { const p = leafNorm(leanX(q), 0, secL(q), secW(q), ROT, u * PI, 0.9, 0.9); wallQuad(c, p[0], p[1], p[2], p[3], 0.18, 0.3, 0.2); }
    } });
    parts.push({ z0: 3, z1: 1.5 + H * 0.8, side: k.gl, top: k.glHi, flat: true, bevel: false, ao: 0, shape: (c, zt, an) => {
      const z = 3 + zt * (H * 0.8 - 1.5), q = (z - 1.5) / H;
      const p = leafNorm(leanX(q), 0, secL(q), secW(q), ROT, PI * 0.5, 0.9, 0.9), pw = 0.3 + 0.12 * Math.sin(an * TAU);
      wallQuad(c, p[0], p[1], p[2], p[3], pw, 0.3, 0.3);
      const m = (z - 3) % 4.2;
      if (m < 2) { const d = 0.6 + m * 0.55; for (const sx of [-1, 1]) { const p2 = leafNorm(leanX(q), 0, secL(q), secW(q), ROT, PI * (0.5 - sx * d / 9), 0.9, 0.9); wallQuad(c, p2[0], p2[1], p2[2], p2[3], 0.24, 0.3, 0.3); } }
    } });
    // floating shard over the tip + motes
    parts.push({ z0: H + 3, z1: H + 11, side: mx(k.gl, k.p.t, 0.2), top: k.glHi, flat: true, bevel: false, ao: -0.25,
      shape: (c, zt, an) => { const b = Math.sin(an * TAU) * 0.9, z = zt * 8 - 0.9 - b, q = z / 6.2; if (q < 0 || q > 1) return; const r = 1.7 * (1 - Math.abs(q * 2 - 1)) + 0.12; S.poly(c, ngon(4, r, 0.4, leanX(1), 0)); },
      detail: (c, an) => glowDot(c, k.gl, leanX(1), 0, 3.6 + Math.sin(an * TAU) * 0.9, 0.6) });
    parts.push({ z0: 4, z1: 22, side: k.glHi, top: '#ffffff', flat: true, bevel: false, ao: 0, shape: (c, zt, an) => {
      for (let i = 0; i < 3; i++) { const zz = 0.2 + i * 0.28 + Math.sin(an * TAU + i) * 0.04; if (Math.abs(zt - zz) > 0.03) continue; const a = i * 2.1 + an * TAU; S.circ(c, Math.cos(a) * 6, Math.sin(a) * 4.6, 0.55); }
    } });
    return { r: 11, h: H + 12, parts, style: 'unit', bevel: 0.8 };
  };

  /* ==================================================================
   * ROOST — dragon roost: a raised round perch-deck on an arcaded drum, a
   * crescent grip-rim at the back, two great crescent horns curving toward each
   * other with faction banners, claw-scratched and scorched deck, a glowing rune
   * ring, a broad stair. ~70 across. anims 4 (banners, rune pulse).
   * ================================================================== */
  M.elf_roost = function (pal, opt) {
    opt = opt || {};
    const k = kit(P(pal));
    const parts = [];
    const DR = 27, DZ = 12, DY = -2;
    const deck = mx(k.st2T, k.p.a, 0.3), deckS = mx(k.st2S, k.p.d, 0.15);
    parts.push(plinth(k, (c) => S.circ(c, 0, DY, DR + 3), 1.5, { at: [0, -99], layer: -1 }));
    parts.push(...anchor([0, -60], tree(k, { x: -29, y: DY - 17, th: 15, cr: 10, ch: 11, seed: 91, gold: true })));
    parts.push(...anchor([0, -59], tree(k, { x: 30, y: DY - 20, th: 12, cr: 8, ch: 9, seed: 93 })));
    // arcaded drum + deck
    parts.push(...anchor([0, DY], [
      towerBody(k, [[0, DY]], DR, 1.5, DZ, 0.05),
      arcWins(k, [[0, DY]], DR, 1.5, DZ - 2.4, [0.07, 0.2, 0.33, 0.46, 0.59, 0.72, 0.85, 0.98].map((q) => q * PI), 0.055, k.dark),
      arcWins(k, [[0, DY]], DR, DZ - 4.5, DZ - 2.4, [0.135, 0.265, 0.395, 0.525, 0.655, 0.785, 0.915].map((q) => q * PI), 0.02, k.gl),
      frontBand(k, [[0, DY]], DR, DZ - 1.7, DZ - 0.9),
      { z0: DZ, z1: DZ + 1.4, side: deckS, top: deck, ao: 0.2, shape: (c) => S.circ(c, 0, DY, DR + 1.2),
        detail: (c, an) => {
          for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; S.lines(c, rgba(k.p.d, 0.2), 0.35, [Math.cos(a) * 12.5, DY + Math.sin(a) * 12.5, Math.cos(a) * 26, DY + Math.sin(a) * 26]); }
          ring(c, rgba(k.p.d, 0.2), 0, DY, 19.5, 0.4);
          ring(c, k.fil, 0, DY, 25.4, 0.5);
          c.save(); c.fillStyle = rgba(k.pave, 0.85); c.beginPath(); c.arc(0, DY, 12.5, 0, TAU); c.fill(); c.restore();
          leafMosaic(c, 0, DY, 10, 8, rgba(k.p.t, 0.45));
          ring(c, rgba(k.gl, 0.55 + 0.35 * Math.sin(an * TAU)), 0, DY, 12.5, 0.9);
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8; S.dot(c, k.glHi, Math.cos(a) * 12.5, DY + Math.sin(a) * 12.5, 0.65); }
          S.dot(c, k.glHi, 0, DY, 1.2);
          const g = c.createRadialGradient(9, DY + 9, 0, 9, DY + 9, 7.5); g.addColorStop(0, 'rgba(36,28,22,0.5)'); g.addColorStop(1, 'rgba(36,28,22,0)'); c.fillStyle = g; c.beginPath(); c.arc(9, DY + 9, 7.5, 0, TAU); c.fill();
          for (const q of [[-12, DY + 11, 3.4, 0.5], [14, DY - 5, 3.2, -0.7], [-3, DY - 16, 3, 0.2], [17, DY + 11, 2.8, 1.1], [-19, DY - 1, 3, -1.3], [4, DY + 19, 2.6, 0.1]]) scratches(c, q[0], q[1], q[2], q[3], 'rgba(50,40,32,0.7)');
        } },
      // low parapet round the front of the deck with leaf merlons
      { z0: DZ + 1.4, z1: DZ + 3, side: k.stS, top: k.stT, ao: 0.3, shape: (c) => sector(c, 0, DY, DR - 0.8, DR + 0.9, PI * 0.02, PI * 0.98) },
      { z0: DZ + 3, z1: DZ + 5.4, side: k.stS, top: k.stT, ao: 0.2, shape: (c, zt) => { const w = 0.055 * (1 - Math.pow(zt, 1.5)) + 0.006; for (let i = 0; i <= 8; i++) { const a = PI * (0.04 + 0.92 * i / 8); sector(c, 0, DY, DR - 0.8, DR + 0.9, a - w, a + w); } } },
    ]));
    // crescent grip-rim along the back with claw marks
    parts.push(...anchor([0, DY - 20], [
      { z0: DZ + 1.4, z1: DZ + 5.5, side: k.stS, top: k.stT, ao: 0.35, shape: (c, zt) => S.poly(c, crescentPts(0, DY, DR - 1.2, 2.6 * (1 - zt * 0.4), PI * 1.02, PI * 1.98, 32, 0.4)),
        detail: (c) => { for (const a of [1.25, 1.42, 1.58, 1.75]) scratches(c, Math.cos(a * PI) * (DR - 1.2), DY + Math.sin(a * PI) * (DR - 1.2), 1.7, a * PI + PI / 2, 'rgba(50,40,32,0.75)'); } },
    ]));
    // great crescent horns, a silver-wood perch bar slung between them, banners, crystals
    const horn = (s) => (z) => { const q = (z - DZ) / 38; if (q < 0 || q > 1) return null; const a = PI * 1.5 + s * (0.44 - q * 0.3), r = (DR - 2) * (1 - q * 0.18); return [Math.cos(a) * r + s * Math.sin(q * PI) * 4.5, DY + Math.sin(a) * r + q * 3]; };
    const hornW = (z) => 3.8 * Math.pow(1 - (z - DZ) / 40, 1.3) + 0.45;
    const PB = DZ + 7;
    parts.push(...anchor([0, DY - 24], [
      { z0: DZ, z1: DZ + 38, side: k.stS, top: k.silver, ao: 0.3, shape: (c, zt) => { const z = DZ + zt * 38; for (const s of [-1, 1]) { const p = horn(s)(z); if (p) S.circ(c, p[0], p[1], hornW(z)); } } },
      { z0: DZ + 3, z1: DZ + 36, side: k.rfM, top: k.rfB, bevel: false, ao: 0.1, shape: (c, zt) => { const z = DZ + 3 + zt * 33; if ((z % 6.5) > 1.3) return; for (const s of [-1, 1]) { const p = horn(s)(z); if (p) S.circ(c, p[0], p[1], hornW(z) + 0.3); } } },
      { z0: PB, z1: PB + 2.2, side: k.silverBarkS, top: k.silverBark, ao: 0.3, shape: (c, zt) => { const p0 = horn(-1)(PB + 1), p1 = horn(1)(PB + 1), w = 1.2 * cylW(zt); S.poly(c, [p0[0], p0[1] - w + 1.5, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - w + 3.2, p1[0], p1[1] - w + 1.5, p1[0], p1[1] + w + 1.5, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + w + 3.2, p0[0], p0[1] + w + 1.5]); },
        detail: (c) => { const p0 = horn(-1)(PB + 1), p1 = horn(1)(PB + 1); for (let i = 1; i < 6; i++) { const t = i / 6, x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + 1.5 + Math.sin(t * PI) * 1.7; S.lines(c, 'rgba(50,40,32,0.6)', 0.35, [x - 0.4, y - 1, x + 0.4, y + 1]); } } },
      ...banner(k, [-1, 1].map((s) => { const p = horn(s)(DZ + 27); return [p[0] + s * 0.6, p[1] + 2, -s]; }), DZ + 9, 18, { len: 5.6, fh: 10 }),
      ...crystal(k, [-1, 1].map((s) => horn(s)(DZ + 38)), DZ + 38, 1.4, 6, { pulse: true, halo: true }),
    ]));
    // broad stair down the front-right
    parts.push(...anchor([0, 28], stairs(k, 17, DY + 19, DY + 35, 9, DZ, 10, [k.stS, k.stT])));
    parts.push(...anchor([0, 25], lantern(k, [[11.5, DY + 32], [22.5, DY + 32]], 4)));
    return { r: 40, h: DZ + 48, parts: sorted(parts), style: 'unit', bevel: 0.8 };
  };

  /* ================================================================ gallery */
  (AS.Gallery = AS.Gallery || []).push({ group: 'Elf buildings', bg: 'elf', items: [
    { name: 'keep L1', gen: 'elf_keep', pal: 'elf', opt: { level: 1 }, anims: 4 },
    { name: 'keep L2', gen: 'elf_keep', pal: 'elf', opt: { level: 2 }, anims: 4 },
    { name: 'keep L3', gen: 'elf_keep', pal: 'elf', opt: { level: 3 }, anims: 4 },
    { name: 'house v0', gen: 'elf_house', pal: 'elf', opt: { v: 0 } },
    { name: 'house v1', gen: 'elf_house', pal: 'elf', opt: { v: 1 } },
    { name: 'house v2', gen: 'elf_house', pal: 'elf', opt: { v: 2 } },
    { name: 'house v3', gen: 'elf_house', pal: 'elf', opt: { v: 3 } },
    { name: 'barracks', gen: 'elf_barracks', pal: 'elf', anims: 4 },
    { name: 'farm', gen: 'elf_farm', pal: 'elf' },
    { name: 'stable', gen: 'elf_stable', pal: 'elf', anims: 4 },
    { name: 'magetower', gen: 'elf_magetower', pal: 'elf', anims: 4 },
    { name: 'archer tower', gen: 'elf_tower', pal: 'elf', anims: 4 },
    { name: 'watchtower', gen: 'elf_watchtower', pal: 'elf', anims: 4 },
    { name: 'temple', gen: 'elf_temple', pal: 'elf', anims: 4 },
    { name: 'market', gen: 'elf_market', pal: 'elf' },
    { name: 'workshop', gen: 'elf_workshop', pal: 'elf' },
    { name: 'wardstone', gen: 'elf_wardstone', pal: 'elf', anims: 4 },
    { name: 'roost', gen: 'elf_roost', pal: 'elf', anims: 4 },
  ] });
  (AS.Gallery = AS.Gallery || []).push({ group: 'Elf siege & walls', bg: 'elf', items: [
    { name: 'ballista', gen: 'elf_ballista', pal: 'elf', dirs: 24 },
    { name: 'catapult', gen: 'elf_catapult', pal: 'elf', dirs: 24, anims: 3 },
    { name: 'wall L1', gen: 'elf_wall', pal: 'elf', opt: { level: 1 }, dirs: 16 },
    { name: 'wall L2', gen: 'elf_wall', pal: 'elf', opt: { level: 2 }, dirs: 16 },
    { name: 'wall L3', gen: 'elf_wall', pal: 'elf', opt: { level: 3 }, dirs: 16 },
    { name: 'gate L1', gen: 'elf_gate', pal: 'elf', opt: { level: 1 }, dirs: 16 },
    { name: 'gate L2', gen: 'elf_gate', pal: 'elf', opt: { level: 2 }, dirs: 16 },
    { name: 'gate L3', gen: 'elf_gate', pal: 'elf', opt: { level: 3 }, dirs: 16 },
  ] });
})(window.AS);
