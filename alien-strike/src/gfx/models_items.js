/* ALIEN STRIKE — items package: pickups, cargo and destructible props.
 *   M.pickup2(kind)          fuel ammo missiles repair shield special tech salvage intel
 *   M.cargo2(kind)           blackbox datacore artifact fuelcore sample charge powercell
 *   M.prop2(kind, pal, o)    crate barrel container fence mast pipe wreck lamp plant
 *                            crystals shroom gearbit coral   (o.seed 1..3, pal = world propPal)
 * Same signatures as M.pickup / M.cargo / M.prop in models4.js.
 * Pickups share one collectible language: a white-rimmed hover token with a colour-coded
 * glow band and a bold extruded icon. Cargo sits on the ground on a steel skid with a
 * chrome lift ring for the retrieval beam and a cyan marker lamp. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models;

  /* ---------- helpers ---------- */
  const P = (p) => Object.assign({ a: '#6b6f78', b: '#a6abb3', t: '#c9963e', g: '#ffd36b', d: '#2a2b33' }, p || {});
  const hx = (c) => { c = C.hex(c); return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); };
  const sh = (c, k) => hx(C.shade(c, k));
  const mx = (a, b, t) => hx(C.mix(a, b, t));
  const desat = (c, k) => { const v = C.hex(c); const l = v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11; return hx(C.mix(v, [l, l, l], k)); };
  const rgba = (c, a) => C.str(c, a);
  const cylW = (zt) => Math.sqrt(Math.max(0.04, 1 - (2 * zt - 1) * (2 * zt - 1)));   // lying cylinder profile
  const domeW = (zt) => Math.sqrt(Math.max(0.04, 1 - zt * zt));                       // dome profile
  const ngon = (r, n, rot, cx, cy) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + (i / n) * TAU; a.push((cx || 0) + Math.cos(t) * r, (cy || 0) + Math.sin(t) * r); } return a; };
  const rot = (pts, a, ox, oy) => { const ca = Math.cos(a), sa = Math.sin(a), out = []; for (let i = 0; i < pts.length; i += 2) out.push((ox || 0) + pts[i] * ca - pts[i + 1] * sa, (oy || 0) + pts[i] * sa + pts[i + 1] * ca); return out; };
  const SEAM = 'rgba(16,14,12,0.45)', HI = 'rgba(255,255,255,0.4)';
  // screen-down component of an object-space wall normal for the frame being rendered
  // (> 0: the wall faces the camera). Lets 8-direction props skip wall details on walls
  // facing away, which would otherwise paint over the roof in the stacked projection.
  const facing = (c, nx, ny) => { const t = c.getTransform(); const n = Math.hypot(t.a, t.b) || 1; return (t.b / n) * nx + (t.a / n) * ny; };
  function radial(c, x, y, r, c0, c1, off) {
    const o = off === undefined ? 0.3 : off;
    const g = c.createRadialGradient(x - r * o, y - r * o, 0, x, y, r);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function spec(c, x, y, rx, ry, a, alpha) { c.save(); c.fillStyle = 'rgba(255,255,255,' + (alpha || 0.75) + ')'; c.beginPath(); S.ell(c, x, y, rx, ry, a || 0); c.fill(); c.restore(); }
  function spark(c, x, y, r, col) { c.save(); c.fillStyle = col || '#ffffff'; c.beginPath(); S.star(c, x, y, r, r * 0.22, 4, 0); c.fill(); c.restore(); }
  function stripes(c, x0, y0, x1, y1, n, colA, colB, w) {   // hazard stripes inside an axis-aligned rect
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
    c.fillStyle = colA; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = colB; const L = Math.max(x1 - x0, y1 - y0), st = (L / n);
    for (let i = -n; i < n * 2; i++) { const s = x0 + i * st; c.beginPath(); c.moveTo(s, y0); c.lineTo(s + st * 0.5, y0); c.lineTo(s + st * 0.5 + (y1 - y0), y1); c.lineTo(s + (y1 - y0), y1); c.closePath(); c.fill(); }
    c.restore();
  }
  // a cylinder lying along local +x (length L, radius r, centred at cx,cy, axis angle a), base at z0
  const lyingCyl = (c, zt, cx, cy, L, r, a) => { const w = r * cylW(zt); S.poly(c, rot([-L / 2, -w, L / 2, -w, L / 2, w, -L / 2, w], a || 0, cx, cy)); };

  /* =====================================================================
   * PICKUPS — hover token: dark emitter skirt, colour glow band, white rim,
   * tinted recessed lens and a bold extruded icon on top.
   * ===================================================================== */
  const PK = {
    fuel: '#ffa62a', ammo: '#8ee04e', missiles: '#ff4a3a', repair: '#4ae67e', shield: '#4ab4ff',
    special: '#d06aff', tech: '#9a72ff', salvage: '#ffc63a', intel: '#3affd8',
  };
  function pkPlate(parts, col) {
    const dark = sh(col, -0.55);
    parts.push({ z0: 0, z1: 0.9, side: '#1c2027', top: '#2a3038', bevel: false, shape: (c) => S.circ(c, 0, 0, 4.6) });
    parts.push({ z0: 0.9, z1: 1.6, side: col, top: col, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 5.7) });
    parts.push({ z0: 1.6, z1: 2.4, side: '#3a414b', top: '#e6ebef', shape: (c) => S.circ(c, 0, 0, 5.7),
      detail: (c) => { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; S.lines(c, 'rgba(40,46,54,0.6)', 0.5, [Math.cos(a) * 4.7, Math.sin(a) * 4.7, Math.cos(a) * 5.65, Math.sin(a) * 5.65]); } } });
    parts.push({ z0: 2.4, z1: 2.4, side: dark, top: dark, flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 4.6),
      detail: (c) => radial(c, 0, 0, 4.6, sh(col, -0.05), sh(col, -0.6), -0.2) });
  }
  const dropPath = (c, k, cx, cy) => {   // droplet, tip toward -y (screen up)
    c.moveTo(cx, cy - 5 * k);
    c.bezierCurveTo(cx + 1.3 * k, cy - 2.8 * k, cx + 3.4 * k, cy - 1.1 * k, cx + 3.4 * k, cy + 1.2 * k);
    c.arc(cx, cy + 1.2 * k, 3.4 * k, 0, Math.PI);
    c.bezierCurveTo(cx - 3.4 * k, cy - 1.1 * k, cx - 1.3 * k, cy - 2.8 * k, cx, cy - 5 * k);
    c.closePath();
  };
  const plus = (hw, hl) => [-hw, -hl, hw, -hl, hw, -hw, hl, -hw, hl, hw, hw, hw, hw, hl, -hw, hl, -hw, hw, -hl, hw, -hl, -hw, -hw, -hw];

  M.pickup2 = function (kind) {
    const col = PK[kind] || PK.salvage;
    const parts = [];
    pkPlate(parts, col);
    const Z = 2.4;
    let H = 10, R = 8;
    switch (kind) {
      case 'fuel': {
        // amber droplet canister with a screw cap
        parts.push({ z0: Z, z1: Z + 3.4, side: '#a44e16', top: '#ffb23a', shape: (c, zt) => dropPath(c, 1.2 * (1 - Math.max(0, zt - 0.55) * 0.3), 0, 0.3),
          detail: (c) => { c.save(); c.fillStyle = 'rgba(255,232,150,0.6)'; c.beginPath(); dropPath(c, 0.62, 0.3, 1.5); c.fill(); c.restore(); spec(c, -1.7, 0.2, 0.8, 1.9, 0.3, 0.85); S.dot(c, '#5a2a0a', 0.6, 2.2, 1.25); S.dot(c, '#e8e2d0', 0.6, 2.2, 0.75); } });
        H = Z + 5; break;
      }
      case 'ammo': {
        // green ammo crate with three standing rounds
        parts.push({ z0: Z, z1: Z + 2.2, side: '#2e4a1a', top: '#6c9c3a', shape: (c) => S.rrect(c, -5.2, -1.6, 10.4, 5.8, 1),
          detail: (c) => { S.lines(c, 'rgba(20,32,10,0.6)', 0.4, [-5, 1.4, 5, 1.4]); S.fillPoly(c, '#f0e8a8', [-4.2, 2.3, -1.6, 2.3, -1.6, 3.2, -4.2, 3.2]); S.fillPoly(c, '#f0e8a8', [1.6, 2.3, 4.2, 2.3, 4.2, 3.2, 1.6, 3.2]); } });
        const bx = [-3.3, 0, 3.3];
        parts.push({ z0: Z + 2.2, z1: Z + 5.4, side: '#94660e', top: '#f6c858', shape: (c) => { for (const x of bx) S.circ(c, x, -0.4, 1.55); } });
        parts.push({ z0: Z + 5.4, z1: Z + 8.2, side: '#a04a22', top: '#ffa870', shape: (c, zt) => { const r = 1.55 * Math.max(0.14, 1 - zt * zt * 0.88); for (const x of bx) S.circ(c, x, -0.4, r); },
          detail: (c) => { for (const x of bx) S.dot(c, 'rgba(255,240,220,0.8)', x - 0.1, -0.5, 0.25); } });
        H = Z + 9; break;
      }
      case 'missiles': {
        // twin rocket pod: red bodies, white warheads, dark fins
        const A = -Math.PI / 4, offs = [-2.15, 2.15];
        const at = (pts, o) => rot(pts, A, Math.cos(A + Math.PI / 2) * o, Math.sin(A + Math.PI / 2) * o);
        parts.push({ z0: Z + 1.0, z1: Z + 1.8, side: '#2a2e35', top: '#59616c', bevel: false, shape: (c) => { for (const o of offs) { S.poly(c, at([-6.4, -1.2, -3.6, -1.2, -5.6, -3.2, -6.8, -3.2], o)); S.poly(c, at([-6.4, 1.2, -3.6, 1.2, -5.6, 3.2, -6.8, 3.2], o)); } } });
        parts.push({ z0: Z, z1: Z + 3.2, side: '#b0241c', top: '#ff6650', shape: (c, zt) => { const w = 1.6 * cylW(zt); for (const o of offs) S.poly(c, at([-6.4, -w, 3.2, -w, 3.2, w, -6.4, w], o)); } });
        parts.push({ z0: Z, z1: Z + 3.2, side: '#b4bac2', top: '#ffffff', shape: (c, zt) => { const w = 1.6 * cylW(zt); for (const o of offs) S.poly(c, at([3.1, -w, 4.6, -w * 0.8, 6.8, 0, 4.6, w * 0.8, 3.1, w], o)); } });
        parts.push({ z0: Z, z1: Z + 3.2, side: '#2a2e35', top: '#59616c', bevel: false, shape: (c, zt) => { const w = 1.65 * cylW(zt); for (const o of offs) S.poly(c, at([-7.0, -w, -6.3, -w, -6.3, w, -7.0, w], o)); } });
        parts.push({ z0: Z + 1.0, z1: Z + 4.8, side: '#2a2e35', top: '#59616c', bevel: false, shape: (c) => { for (const o of offs) S.poly(c, at([-6.8, -0.3, -4.0, -0.3, -4.0, 0.3, -6.8, 0.3], o)); } });
        H = Z + 6; R = 9; break;
      }
      case 'repair': {
        // white med/repair cross with a green inlay
        parts.push({ z0: Z, z1: Z + 2.0, side: '#86909b', top: '#f6f8fa', shape: (c) => S.poly(c, plus(2.3, 5.9)),
          detail: (c) => spec(c, -1.1, -4.4, 0.5, 1.0, 0, 0.9) });
        parts.push({ z0: Z + 2.0, z1: Z + 2.7, side: '#168a3a', top: '#3ee070', bevel: false, shape: (c) => S.poly(c, plus(1.15, 4.6)) });
        H = Z + 4; break;
      }
      case 'shield': {
        // blue hexagon cell
        parts.push({ z0: Z, z1: Z + 2.6, side: '#184a96', top: '#70c0ff', shape: (c, zt) => S.poly(c, ngon(6.0 * (1 - Math.max(0, zt - 0.5) * 0.3), 6, Math.PI / 6)),
          detail: (c) => { c.save(); c.strokeStyle = '#e4f6ff'; c.lineWidth = 0.7; c.beginPath(); S.poly(c, ngon(3.7, 6, Math.PI / 6)); c.stroke(); c.restore(); radial(c, 0, 0, 2.6, '#ffffff', 'rgba(150,215,255,0.25)', 0.25); spec(c, -2.2, -2.6, 0.5, 1.3, 0.6, 0.8); } });
        H = Z + 4; break;
      }
      case 'special': {
        // violet star core
        parts.push({ z0: Z, z1: Z + 2.6, side: '#601ca8', top: '#dca8ff', shape: (c, zt) => { const k = 1 - Math.max(0, zt - 0.5) * 0.3; S.star(c, 0, 0.5, 6.8 * k, 2.9 * k, 5, -Math.PI / 2); },
          detail: (c) => { radial(c, 0, 0.5, 2.8, '#ffffff', 'rgba(230,170,255,0.15)', 0); spec(c, -1.4, -2.2, 0.4, 1.2, 0.4, 0.75); } });
        H = Z + 4; break;
      }
      case 'tech': {
        // alien chip: bone-ceramic die with silver pins, violet circuit glyph and core
        parts.push({ z0: Z + 0.3, z1: Z + 1.1, side: '#6e747c', top: '#c4cad0', bevel: false, shape: (c) => { for (let i = -1; i <= 1; i++) for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.PI / 4, t = i * 2.0; const px = Math.cos(a) * 4.2 + Math.cos(a + Math.PI / 2) * t, py = Math.sin(a) * 4.2 + Math.sin(a + Math.PI / 2) * t; S.poly(c, rot([-0.45, -1.1, 0.45, -1.1, 0.45, 1.1, -0.45, 1.1], a + Math.PI / 2, px + Math.cos(a) * 0.9, py + Math.sin(a) * 0.9)); } } });
        parts.push({ z0: Z, z1: Z + 1.8, side: '#766a54', top: '#e4dac2', shape: (c) => S.poly(c, ngon(5.9, 4, 0)),
          detail: (c) => { S.lines(c, '#8a52f0', 0.5, [-4.2, 0, -2.2, 0, 4.2, 0, 2.2, 0, 0, -4.2, 0, -2.2, 0, 4.2, 0, 2.2, -2.2, 0, -1.2, -1.2, 2.2, 0, 1.2, 1.2]); S.dot(c, '#8a52f0', -4.2, 0, 0.45); S.dot(c, '#8a52f0', 4.2, 0, 0.45); S.dot(c, '#8a52f0', 0, -4.2, 0.45); S.dot(c, '#8a52f0', 0, 4.2, 0.45); } });
        parts.push({ z0: Z + 1.8, z1: Z + 3.0, side: '#5a2ab8', top: '#cfb0ff', flat: true, shape: (c) => S.poly(c, ngon(2.1, 4, 0)), detail: (c) => { radial(c, 0, 0, 1.6, '#ffffff', '#a070ff', 0.3); } });
        H = Z + 4; break;
      }
      case 'salvage': {
        // glinting gold/bronze scrap cluster: gear, bent plate, bolt
        parts.push({ z0: Z, z1: Z + 3.2, side: '#76461a', top: '#d0904a', shape: (c, zt) => S.poly(c, [0.8 - zt, -5.4, 5.6 - zt, -3.8, 5.0, 0.8, 1.0, -0.2]),
          detail: (c) => { S.lines(c, 'rgba(60,30,8,0.6)', 0.4, [1.8, -4.2, 4.2, -3.4]); S.dot(c, '#3a2410', 3.2, -1.8, 0.5); } });
        parts.push({ z0: Z, z1: Z + 1.9, side: '#94640e', top: '#ffd04a', shape: (c) => S.star(c, -1.4, 1.4, 4.8, 3.8, 10, 0.2),
          detail: (c) => { S.dot(c, '#7a4e0e', -1.4, 1.4, 1.9); S.dot(c, '#fff0b0', -1.4, 1.4, 1.0); spec(c, -3.2, -0.2, 0.45, 1.2, 0.7, 0.8); } });
        parts.push({ z0: Z, z1: Z + 4.6, side: '#8a7a5a', top: '#f6e8b8', shape: (c) => S.poly(c, ngon(1.25, 6, 0, -3.8, -3.2)) });
        parts.push({ z0: Z + 4.8, z1: Z + 4.8, side: '#ffffff', top: '#ffffff', flat: true, bevel: false, shape: (c) => { S.star(c, 4.0, -6.2, 2.8, 0.5, 4, 0); S.star(c, -5.6, 3.0, 1.6, 0.35, 4, 0); } });
        H = Z + 7; R = 9; break;
      }
      case 'intel': {
        // teal data spike in a socket, ringed by a data halo
        parts.push({ z0: Z, z1: Z + 1.6, side: '#243238', top: '#5c727a', shape: (c) => S.poly(c, ngon(3.0, 6, 0)) });
        parts.push({ z0: Z + 1.6, z1: Z + 12.4, side: '#128a7a', top: '#b8fff4', shape: (c, zt) => { const r = 2.3 * (zt < 0.12 ? 0.7 + zt / 0.12 * 0.3 : Math.max(0.06, 1 - (zt - 0.12) / 0.88)); S.poly(c, ngon(r, 4, 0)); } });
        parts.push({ z0: Z + 4.6, z1: Z + 5.2, side: '#3affd8', top: '#d8fff8', flat: true, bevel: false, stroke: 0.6, shape: (c) => S.circ(c, 0, 0, 4.4) });
        H = Z + 14; break;
      }
      default: return M.pickup2('salvage');
    }
    return { r: R, h: Math.ceil(H), parts, style: 'unit', post: { rimStrength: 0.3 } };
  };

  /* =====================================================================
   * CARGO — heavy objects on the ground: steel skid with hazard corners,
   * chrome lift ring (retrieval hardpoint) and a cyan marker lamp.
   * ===================================================================== */
  const LAMP = '#6ff6ff';
  function cgSkid(parts, hl, hw, round) {
    parts.push({ z0: 0, z1: 1.2, side: '#23272d', top: '#4a525c', shape: (c) => round ? S.circ(c, 0, 0, hl) : S.rrect(c, -hl, -hw, hl * 2, hw * 2, 1.2),
      detail: (c) => {
        if (round) return;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.fillPoly(c, '#f0b030', [sx * hl, sy * (hw - 2.2), sx * hl, sy * hw, sx * (hl - 2.2), sy * hw]);
      } });
  }
  function cgLift(parts, x, y, z) {   // shackle post + lying ring
    parts.push({ z0: z, z1: z + 1.3, side: '#4a525c', top: '#8a949e', shape: (c) => S.circ(c, x, y, 0.75) });
    parts.push({ z0: z + 1.0, z1: z + 1.8, side: '#8e98a2', top: '#eef3f6', stroke: 0.6, bevel: false, shape: (c) => S.circ(c, x, y, 1.55) });
  }
  function cgLamp(parts, x, y, z0, z1) {
    parts.push({ z0: z0, z1: z1, side: '#2a3038', top: '#59626c', shape: (c) => S.circ(c, x, y, 0.6) });
    parts.push({ z0: z1, z1: z1 + 1.1, side: '#1fa8b8', top: LAMP, flat: true, shape: (c) => S.circ(c, x, y, 1.05), detail: (c) => S.dot(c, '#ffffff', x - 0.25, y - 0.25, 0.45) });
  }

  M.cargo2 = function (kind) {
    const parts = [];
    let r = 10, H = 12;
    switch (kind) {
      case 'blackbox': {
        // flight recorder: orange chassis carrying the crash-survivable memory drum (white reflective bands)
        cgSkid(parts, 6.8, 4.8);
        parts.push({ z0: 1.2, z1: 4.4, side: '#a8420e', top: '#ee7028', shape: (c) => S.rrect(c, -6.2, -4.2, 12.4, 8.4, 1.2),
          detail: (c) => { S.lines(c, 'rgba(255,240,220,0.75)', 0.45, [-5.2, 3.1, -1.4, 3.1, -5.2, 3.7, -2.6, 3.7]); for (let i = 0; i < 3; i++) S.dot(c, '#4a1c06', 5.3, 1.6 + i * 0.9, 0.3); } });
        parts.push({ z0: 3.0, z1: 9.0, side: '#c25016', top: '#ffa050', shape: (c, zt) => lyingCyl(c, zt, 0, -0.9, 9.6, 3.0, 0) });
        parts.push({ z0: 2.9, z1: 9.1, side: '#c4c8cc', top: '#ffffff', shape: (c, zt) => { const w = 3.08 * cylW(zt); S.rect(c, -3.4, -0.9 - w, 1.2, w * 2); S.rect(c, 2.2, -0.9 - w, 1.2, w * 2); } });
        parts.push({ z0: 2.9, z1: 9.1, side: '#2a2e34', top: '#59616c', shape: (c, zt) => { const w = 3.12 * cylW(zt); S.rect(c, -5.4, -0.9 - w, 0.7, w * 2); S.rect(c, 4.7, -0.9 - w, 0.7, w * 2); } });
        cgLift(parts, -4.2, 2.6, 4.4);
        cgLamp(parts, 4.8, 3.0, 4.4, 6.0);
        r = 10; H = 11; break;
      }
      case 'datacore': {
        // cyan data capsule standing in a cage frame
        cgSkid(parts, 5.6, 5.6);
        parts.push({ z0: 1.2, z1: 2.6, side: '#2a3038', top: '#59636e', shape: (c) => S.rrect(c, -4.8, -4.8, 9.6, 9.6, 1.4),
          detail: (c) => { c.save(); c.strokeStyle = 'rgba(111,246,255,0.6)'; c.lineWidth = 0.5; c.beginPath(); S.circ(c, 0, 0, 3.9); c.stroke(); c.restore(); } });
        parts.push({ z0: 2.6, z1: 3.6, side: '#3a414b', top: '#a8b2bc', shape: (c) => S.circ(c, 0, 0, 3.4) });
        parts.push({ z0: 3.6, z1: 10.0, side: '#22a6c8', top: '#c8fbff', flat: true, ao: 0.25, shape: (c) => S.circ(c, 0, 0, 3.0) });
        parts.push({ z0: 6.8, z1: 6.8, side: '#9ff4ff', top: '#9ff4ff', flat: true, bevel: false, shape: (c) => S.rrect(c, -1.0, -3.0, 2.0, 6.0, 1.0), detail: (c) => { radial(c, -0.1, 0, 2.6, '#ffffff', 'rgba(110,240,255,0.0)', 0.2); } });
        parts.push({ z0: 10.0, z1: 11.0, side: '#3a414b', top: '#a8b2bc', shape: (c) => S.circ(c, 0, 0, 3.4), detail: (c) => S.dot(c, '#2a3038', 0, 0, 1.2) });
        // cage: four corner posts + top frame
        parts.push({ z0: 2.6, z1: 11.4, side: '#343b44', top: '#8e98a3', shape: (c) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.rrect(c, sx * 4.2 - 0.55, sy * 4.2 - 0.55, 1.1, 1.1, 0.3); } });
        parts.push({ z0: 11.0, z1: 11.8, side: '#3a414b', top: '#b8c2cc', stroke: 0.8, shape: (c) => { S.rrect(c, -4.2, -4.2, 8.4, 8.4, 0.8); S.seg(c, -4.2, 0, 4.2, 0); } });
        cgLift(parts, 0, 0, 11.6);
        cgLamp(parts, 4.2, -4.2, 11.8, 12.2);
        r = 9; H = 15; break;
      }
      case 'artifact': {
        // Choir relic hovering over a bone-stone altar, clamped by an FRC lift collar
        const bone = '#d6ccb4', boneS = '#857a64';
        parts.push({ z0: 0, z1: 2.2, side: boneS, top: '#b8ad94', shape: (c) => S.poly(c, ngon(7.6, 6, Math.PI / 6)),
          detail: (c) => S.lines(c, 'rgba(50,40,30,0.4)', 0.4, [-6.4, 0, -4.6, 0, 6.4, 0, 4.6, 0]) });
        parts.push({ z0: 2.2, z1: 4.4, side: boneS, top: bone, shape: (c) => S.poly(c, ngon(5.6, 6, Math.PI / 6)),
          detail: (c) => { c.save(); c.strokeStyle = '#b07cff'; c.lineWidth = 0.5; c.beginPath(); S.poly(c, ngon(3.9, 6, Math.PI / 6)); c.stroke(); c.restore(); S.lines(c, '#b07cff', 0.45, [-3.9, 0, -2.4, 0, 3.9, 0, 2.4, 0, 0, -3.4, 0, -2.2, 0, 3.4, 0, 2.2]); } });
        // horn fins on the altar
        parts.push({ z0: 2.2, z1: 8.6, side: boneS, top: bone, shape: (c, zt) => { const k = 1 - zt * 0.75, o = 5.0 + zt * 1.2; S.poly(c, [-o, -1.0 * k, -o - 1.3 * k, 0, -o, 1.0 * k, -o + 1.1 * k, 0]); S.poly(c, [o, -1.0 * k, o + 1.3 * k, 0, o, 1.0 * k, o - 1.1 * k, 0]); } });
        // FRC lift collar
        parts.push({ z0: 4.4, z1: 5.4, side: '#5a636e', top: '#c8d0d8', stroke: 0.8, bevel: false, shape: (c) => S.circ(c, 0, 0, 3.4) });
        parts.push({ z0: 4.4, z1: 6.0, side: '#3a414b', top: '#8e98a3', shape: (c) => { S.rrect(c, -0.7, -4.1, 1.4, 1.4, 0.3); S.rrect(c, -0.7, 2.7, 1.4, 1.4, 0.3); } });
        // relic: violet bipyramid crystal
        parts.push({ z0: 5.4, z1: 13.4, side: '#6a30c8', top: '#efdcff', shape: (c, zt) => { const w = 2.9 * Math.max(0.06, 1 - Math.abs(zt - 0.38) / (zt < 0.38 ? 0.38 : 0.62)); S.poly(c, [0, -w * 1.15, w, 0, 0, w * 1.15, -w, 0]); } });
        parts.push({ z0: 8.4, z1: 8.4, side: '#d8b8ff', top: '#d8b8ff', flat: true, bevel: false, shape: (c) => S.poly(c, [0, -1.6, 1.3, 0, 0, 1.6, -1.3, 0]), detail: (c) => S.dot(c, '#ffffff', 0, 0, 0.6) });
        cgLamp(parts, 5.4, 3.1, 2.2, 5.2);
        r = 11; H = 15; break;
      }
      case 'fuelcore': {
        // amber fuel core: a lying tank with a glowing sight window, in a steel cradle
        cgSkid(parts, 7.2, 4.4);
        parts.push({ z0: 1.2, z1: 3.4, side: '#30353c', top: '#6a737e', shape: (c) => { S.rect(c, -5.2, -4.0, 1.8, 8.0); S.rect(c, 3.4, -4.0, 1.8, 8.0); } });
        parts.push({ z0: 1.8, z1: 8.6, side: '#a8661c', top: '#f2b04a', shape: (c, zt) => lyingCyl(c, zt, 0, 0, 12.4, 3.4, 0) });
        parts.push({ z0: 1.7, z1: 8.7, side: '#3a3f47', top: '#7a838e', shape: (c, zt) => { const w = 3.5 * cylW(zt); S.rect(c, -6.6, -w, 1.0, w * 2); S.rect(c, 5.6, -w, 1.0, w * 2); S.rect(c, -0.5, -w, 1.0, w * 2); } });
        parts.push({ z0: 8.6, z1: 8.6, side: '#ffd36b', top: '#ffd36b', flat: true, bevel: false, shape: (c) => { S.rrect(c, -4.8, -0.9, 3.8, 1.8, 0.8); S.rrect(c, 1.0, -0.9, 3.8, 1.8, 0.8); },
          detail: (c) => { S.dot(c, '#fff6d0', -2.9, -0.2, 0.5); S.dot(c, '#fff6d0', 2.9, -0.2, 0.5); } });
        cgLift(parts, 0, 0, 8.7);
        cgLamp(parts, 6.4, 3.4, 1.2, 4.4);
        r = 10; H = 12; break;
      }
      case 'sample': {
        // three bio canisters in a carry rack
        cgSkid(parts, 5.8, 5.8, true);
        parts.push({ z0: 1.2, z1: 2.6, side: '#30363e', top: '#7a848e', shape: (c) => S.circ(c, 0, 0, 5.3),
          detail: (c) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; S.fillPoly(c, i % 2 ? '#2a2e34' : '#f0b030', [Math.cos(a) * 5.25, Math.sin(a) * 5.25, Math.cos(a + 0.5) * 5.25, Math.sin(a + 0.5) * 5.25, Math.cos(a + 0.5) * 4.4, Math.sin(a + 0.5) * 4.4, Math.cos(a) * 4.4, Math.sin(a) * 4.4]); } } });
        const cs = [[-2.4, -1.5], [2.4, -1.5], [0, 2.4]];
        parts.push({ z0: 2.6, z1: 3.6, side: '#4a525c', top: '#9aa4ae', shape: (c) => { for (const p of cs) S.circ(c, p[0], p[1], 2.3); } });
        parts.push({ z0: 3.6, z1: 10.0, side: '#3cb02a', top: '#d8ffb0', flat: true, ao: 0.3, shape: (c) => { for (const p of cs) S.circ(c, p[0], p[1], 2.0); } });
        parts.push({ z0: 6.4, z1: 6.4, side: '#d8ffb0', top: '#d8ffb0', flat: true, bevel: false, shape: (c) => { for (const p of cs) S.rrect(c, p[0] - 0.7, p[1] - 1.9, 1.4, 3.8, 0.7); },
          detail: (c) => { for (const p of cs) { S.dot(c, 'rgba(255,255,255,0.85)', p[0] - 0.2, p[1] - 0.6, 0.45); S.dot(c, 'rgba(40,120,20,0.7)', p[0] + 0.3, p[1] + 0.9, 0.35); } } });
        parts.push({ z0: 10.0, z1: 10.8, side: '#4a525c', top: '#c4ccd4', shape: (c) => { for (const p of cs) S.circ(c, p[0], p[1], 2.25); },
          detail: (c) => { for (const p of cs) S.dot(c, '#3a4048', p[0], p[1], 0.8); } });
        parts.push({ z0: 10.8, z1: 11.4, side: '#5a636e', top: '#d8dee4', stroke: 0.7, bevel: false, shape: (c) => { S.seg(c, -2.4, -1.5, 2.4, -1.5); S.seg(c, 2.4, -1.5, 0, 2.4); S.seg(c, 0, 2.4, -2.4, -1.5); } });
        cgLift(parts, 0, -0.2, 11.2);
        cgLamp(parts, 4.7, 2.7, 2.6, 5.4);
        r = 9; H = 14; break;
      }
      case 'charge': {
        // heavy seismic charge: hazard-banded drum, detonator head, lift lugs, red arming lamp
        const R = 5.6;
        parts.push({ z0: 0, z1: 1.4, side: '#1c1f24', top: '#3a4048', shape: (c) => S.poly(c, ngon(R + 1.1, 8, Math.PI / 8)),
          detail: (c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; S.dot(c, '#14161a', Math.cos(a) * (R + 0.5), Math.sin(a) * (R + 0.5), 0.35); } } });
        parts.push({ z0: 1.4, z1: 7.6, side: '#1e2024', top: '#2a2c30', shape: (c) => S.circ(c, 0, 0, R) });
        parts.push({ z0: 2.0, z1: 7.0, side: '#f2b428', top: '#ffc840', bevel: false, shape: (c, zt) => { const n = 9; for (let i = 0; i < n; i++) { const a0 = i / n * TAU + zt * 1.0, a1 = a0 + TAU / n / 2; c.moveTo(0, 0); c.arc(0, 0, R + 0.03, a0, a1); c.closePath(); } } });
        parts.push({ z0: 7.6, z1: 8.6, side: '#3a3f47', top: '#7e8792', shape: (c) => S.circ(c, 0, 0, R - 0.2),
          detail: (c) => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; S.dot(c, '#2a2e34', Math.cos(a) * (R - 1.1), Math.sin(a) * (R - 1.1), 0.35); } S.lines(c, 'rgba(20,22,26,0.5)', 0.4, [-R + 0.6, 0, -2.6, 0, R - 0.6, 0, 2.6, 0]); } });
        // detonator housing
        parts.push({ z0: 8.6, z1: 10.6, side: '#2a2e34', top: '#5a636e', shape: (c) => S.rrect(c, -2.3, -2.3, 4.6, 4.6, 0.8),
          detail: (c) => { S.fillPoly(c, '#ffc840', [-1.9, 1.0, 1.9, 1.0, 1.9, 1.9, -1.9, 1.9]); S.lines(c, '#1a1a1a', 0.35, [-1.2, 1.0, -1.7, 1.9, 0, 1.0, -0.5, 1.9, 1.2, 1.0, 0.7, 1.9]); } });
        parts.push({ z0: 10.6, z1: 11.8, side: '#a01810', top: '#ff4a32', flat: true, shape: (c) => S.circ(c, 0.4, -0.7, 1.05), detail: (c) => S.dot(c, '#ffd8c8', 0.1, -1.0, 0.45) });
        // lift lugs
        parts.push({ z0: 8.6, z1: 9.4, side: '#8e98a2', top: '#eef3f6', stroke: 0.6, bevel: false, shape: (c) => { S.circ(c, -3.8, 0, 1.15); S.circ(c, 3.8, 0, 1.15); } });
        r = 9; H = 12; break;
      }
      case 'powercell': {
        // Choir power core: violet-white energy orb in a bone-stone claw cradle, FRC clamp band
        const bone = '#d8ccb2', boneS = '#7e725c';
        parts.push({ z0: 0, z1: 2.4, side: '#4a4038', top: '#8a7e6a', shape: (c) => S.poly(c, ngon(7.8, 6, 0)),
          detail: (c) => { S.lines(c, '#b07cff', 0.5, [-6.4, 0, -4.8, 0, 6.4, 0, 4.8, 0, -3.2, -5.5, -2.4, -4.2, 3.2, 5.5, 2.4, 4.2, 3.2, -5.5, 2.4, -4.2, -3.2, 5.5, -2.4, 4.2]); } });
        parts.push({ z0: 2.4, z1: 4.0, side: boneS, top: bone, shape: (c) => S.circ(c, 0, 0, 5.0), detail: (c) => S.dot(c, '#5a3aa0', 0, 0, 3.2) });
        parts.push({ z0: 3.4, z1: 4.4, side: '#4a525c', top: '#c8d0d8', stroke: 0.9, bevel: false, shape: (c) => S.circ(c, 0, 0, 5.4) });
        // back claw (drawn before the orb)
        const claw = (a) => (c, zt) => { const d = 5.0 + Math.sin(zt * Math.PI) * 0.9 - zt * zt * 2.6, w = 1.35 * (1 - zt * 0.55); S.poly(c, rot([-w * 0.8, -w, w * 0.8, -w, w * 0.6, w, -w * 0.6, w], a, Math.cos(a) * d, Math.sin(a) * d)); };
        parts.push({ z0: 3.6, z1: 13.0, side: boneS, top: bone, shape: claw(-Math.PI / 2) });
        // orb (spheroid squashed in z so it projects round)
        parts.push({ z0: 4.6, z1: 11.4, side: '#a070ff', top: '#ffffff', flat: true, ao: 0.35, shape: (c, zt) => S.circ(c, 0, 0, 4.3 * Math.sqrt(Math.max(0.05, 1 - (2 * zt - 1) * (2 * zt - 1)))) });
        parts.push({ z0: 8.0, z1: 8.0, side: '#e8d8ff', top: '#e8d8ff', flat: true, bevel: false, shape: (c) => S.circ(c, 0, 0, 3.0),
          detail: (c) => { radial(c, 0, 0, 3.0, '#ffffff', 'rgba(200,160,255,0.0)', 0.3); } });
        // front claws
        parts.push({ z0: 3.6, z1: 13.0, side: boneS, top: bone, shape: (c, zt) => { claw(Math.PI / 6)(c, zt); claw(Math.PI * 5 / 6)(c, zt); } });
        // orbiting motes
        parts.push({ z0: 10.6, z1: 11.2, side: '#c8a0ff', top: '#ffffff', flat: true, bevel: false, shape: (c) => { S.circ(c, 6.2, 1.6, 0.55); S.circ(c, -6.4, 0.6, 0.5); S.circ(c, 1.8, -5.6, 0.45); } });
        cgLamp(parts, 6.4, 3.6, 2.4, 4.6);
        r = 11; H = 15; break;
      }
      default: return M.cargo2('blackbox');
    }
    return { r, h: H, parts, style: 'unit', post: { rimStrength: 0.26 } };
  };

  /* =====================================================================
   * PROPS — filled in below; unfinished kinds fall back to the original.
   * ===================================================================== */
  const PROPS = {};
  const STEEL = '#3e444c', STEEL_T = '#8a929c', CONC = '#8e897e', CONC_T = '#bdb7a8', HAZ = '#f0b02a';
  const tri = (t) => { t = t - Math.floor(t); return t < 0.5 ? t * 2 : 2 - t * 2; };
  // thin quad from (x0,y0) to (x1,y1), half-width w (for lattice braces / branches)
  const bar = (c, x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w; c.moveTo(x0 + nx, y0 + ny); c.lineTo(x1 + nx, y1 + ny); c.lineTo(x1 - nx, y1 - ny); c.lineTo(x0 - nx, y0 - ny); c.closePath(); };
  const leafPath = (c, ang, r0, L, W) => {   // pointed leaf from radius r0 out to r0+L along ang
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u, v) => [ca * u - sa * v, sa * u + ca * v];
    const a = P(r0, 0), b = P(r0 + L * 0.45, W), t = P(r0 + L, 0), d = P(r0 + L * 0.45, -W);
    c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], t[0], t[1]); c.quadraticCurveTo(d[0], d[1], a[0], a[1]); c.closePath();
  };

  /* ---------- crate: banded supply crates (single, long military case, stack) ---------- */
  PROPS.crate = function (p, seed) {
    const parts = [];
    const box = (x, y, hx, hy, z0, h, a, wood) => {
      const woodT = sh(wood, 0.3), edge = rgba(sh(wood, -0.45), 0.85);
      parts.push({ z0, z1: z0 + h, side: wood, top: woodT, shape: (c) => S.poly(c, rot([-hx, -hy, hx, -hy, hx, hy, -hx, hy], a, x, y)),
        detail: (c) => {
          c.save(); c.translate(x, y); c.rotate(a);
          c.strokeStyle = edge; c.lineWidth = 0.65; c.beginPath(); c.rect(-hx + 0.55, -hy + 0.55, hx * 2 - 1.1, hy * 2 - 1.1); c.stroke();
          c.beginPath(); c.moveTo(-hx + 0.8, hy - 0.8); c.lineTo(hx - 0.8, -hy + 0.8); c.stroke();
          c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.35; c.beginPath(); for (let i = 1; i < 3; i++) { const yy = -hy + i * hy * 2 / 3; c.moveTo(-hx + 0.6, yy); c.lineTo(hx - 0.6, yy); } c.stroke();
          c.fillStyle = 'rgba(255,248,220,0.55)'; c.fillRect(hx * 0.15, hy * 0.25, hx * 0.5, 0.55); c.fillRect(hx * 0.15, hy * 0.25 + 0.9, hx * 0.32, 0.55);
          c.restore();
        } });
      parts.push({ z0, z1: z0 + h + 0.15, side: '#2a2d32', top: '#7a828c', bevel: false, shape: (c) => { const ca = Math.cos(a), sa = Math.sin(a); for (const sx of [-1, 1]) for (const sy of [-1, 1]) if (facing(c, sx * ca, sx * sa) > -0.05 || facing(c, -sy * sa, sy * ca) > -0.05) S.poly(c, rot([sx * hx - 0.55, sy * hy - 0.55, sx * hx + 0.15, sy * hy - 0.55, sx * hx + 0.15, sy * hy + 0.15, sx * hx - 0.55, sy * hy + 0.15], a, x, y)); } });
    };
    const wood = mx('#8c6236', p.a, 0.15), olive = desat(mx('#56643a', p.a, 0.2), 0.15);
    if (seed === 2) {
      box(0, 0, 7.0, 3.6, 0, 4.8, -0.15, olive);
      parts.push({ z0: 4.8, z1: 5.6, side: '#2a2d32', top: '#6a727c', bevel: false, shape: (c) => { S.poly(c, rot([-1.6, -0.5, 1.6, -0.5, 1.6, 0.5, -1.6, 0.5], -0.15, -3.6 * Math.cos(-0.15), -3.6 * Math.sin(-0.15))); S.poly(c, rot([-1.6, -0.5, 1.6, -0.5, 1.6, 0.5, -1.6, 0.5], -0.15, 3.6 * Math.cos(-0.15), 3.6 * Math.sin(-0.15))); } });
      return { r: 9, h: 7, parts };
    }
    if (seed === 3) {
      box(5.4, -2.8, 2.8, 2.8, 0, 4.2, -0.35, olive);
      box(-1.2, 1.0, 4.4, 4.4, 0, 6.4, 0.1, wood);
      box(-1.0, 0.6, 3.0, 3.0, 6.4, 4.4, 0.5, wood);
      return { r: 10, h: 12, parts };
    }
    box(0, 0, 4.8, 4.8, 0, 7.0, 0.12, wood);
    return { r: 8, h: 8, parts };
  };

  /* ---------- barrel: ribbed fuel drums (red, hazard yellow, upright + tipped pair) ---------- */
  PROPS.barrel = function (p, seed) {
    const parts = [];
    const drum = (x, y, col, hz) => {
      // interleave body segments with ribs/bands bottom-to-top so higher slices never hide lower ones
      const top = sh(col, 0.32), rib = sh(col, -0.22), ribT = sh(col, 0.12);
      const seg = (z0, z1, side, topC, R, extra) => parts.push(Object.assign({ z0, z1, side, top: topC, bevel: false, shape: (c) => S.circ(c, x, y, R) }, extra || {}));
      seg(0, 1.5, col, col, 3.4);
      seg(1.5, 2.0, rib, ribT, 3.62);
      seg(2.0, 3.3, col, col, 3.4);
      seg(3.3, 4.7, '#e8dcbc', '#fff4d8', 3.44);
      if (hz) parts.push({ z0: 3.5, z1: 4.5, side: '#1a1a1a', top: '#1a1a1a', flat: true, bevel: false, shape: (c) => { c.moveTo(x, y); c.arc(x, y, 3.48, 0.45, 0.95); c.closePath(); c.moveTo(x, y); c.arc(x, y, 3.48, 1.35, 1.85); c.closePath(); c.moveTo(x, y); c.arc(x, y, 3.48, 2.25, 2.75); c.closePath(); } });
      seg(4.7, 5.8, col, col, 3.4);
      seg(5.8, 6.3, rib, ribT, 3.62);
      parts.push({ z0: 6.3, z1: 8, side: col, top, shape: (c) => S.circ(c, x, y, 3.4),
        detail: (c) => { c.save(); c.strokeStyle = rgba(sh(col, -0.45), 0.85); c.lineWidth = 0.5; c.beginPath(); S.circ(c, x, y, 2.75); c.stroke(); c.restore(); S.dot(c, '#2a2a2a', x + 1.3, y - 0.9, 0.62); S.dot(c, '#a8a8a8', x + 1.3, y - 0.9, 0.32); S.dot(c, '#2a2a2a', x - 1.4, y + 1.0, 0.42); spec(c, x - 1.3, y - 1.4, 0.45, 0.9, 0.7, 0.35); } });
    };
    const red = mx('#a8301e', p.a, 0.1), yel = mx('#d0961c', p.a, 0.1);
    if (seed === 3) {
      // a tipped drum lying behind an upright one
      parts.push({ z0: 0, z1: 6.6, side: sh(red, -0.1), top: sh(red, 0.3), shape: (c, zt) => lyingCyl(c, zt, 1.0, -3.4, 8, 3.3, 0.35) });
      parts.push({ z0: 0, z1: 6.7, side: '#2a2a2a', top: '#5a5a5a', shape: (c, zt) => { const w = 3.35 * cylW(zt); S.poly(c, rot([3.6, -w, 4.1, -w, 4.1, w, 3.6, w], 0.35, 1.0, -3.4)); } });
      drum(-2.2, 2.4, yel, true);
      return { r: 9, h: 9, parts };
    }
    drum(0, 0, seed === 2 ? yel : red, seed === 2);
    return { r: 6, h: 9, parts };
  };

  /* ---------- container: weathered shipping container, corrugated walls, rust, stencil ---------- */
  PROPS.container = function (p, seed) {
    const tint = [mx(p.a, '#6a6660', 0.3), mx('#8e4a28', p.a, 0.2), mx('#3c4e5c', p.a, 0.25)][(seed - 1) % 3];
    const base = desat(tint, 0.35), top = sh(base, 0.3), rib = sh(base, 0.16), rust = '#6e3e22';
    const L = 12, W = 5, H = 10;
    const parts = [];
    parts.push({ z0: 0, z1: 0.8, side: '#24262a', top: '#3a3d42', bevel: false, shape: (c) => S.rect(c, -L - 0.15, -W - 0.15, L * 2 + 0.3, W * 2 + 0.3) });
    parts.push({ z0: 0, z1: H, side: base, top, ao: 0.28, shape: (c) => S.rect(c, -L, -W, L * 2, W * 2),
      detail: (c) => {
        const s = [], s2 = []; for (let x = -L + 4; x < L - 1; x += 4) { s.push(x, -W + 0.5, x, W - 0.5); s2.push(x + 0.4, -W + 0.5, x + 0.4, W - 0.5); } S.lines(c, 'rgba(0,0,0,0.16)', 0.3, s); S.lines(c, 'rgba(255,255,255,0.14)', 0.3, s2);
        const g = (x, y, r) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(rust, 0.55)); gr.addColorStop(1, rgba(rust, 0)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
        g(-6 + seed * 2, -2, 3.2); g(7 - seed, 2.6, 2.4); g(-10, 3.6, 1.8);
        // stencil block and hazard stripe at the door end
        c.fillStyle = 'rgba(240,236,224,0.7)'; c.fillRect(2, -1.6, 0.6, 3.2); c.fillRect(2, -1.6, 1.8, 0.6); c.fillRect(2, -0.3, 1.4, 0.55); c.fillRect(4.4, -1.6, 0.6, 3.2); c.fillRect(4.4, -1.6, 1.8, 0.6); c.fillRect(4.4, -0.3, 1.6, 0.55); c.fillRect(5.6, 0.2, 0.6, 1.4);
        stripes(c, -L + 0.4, -W + 0.4, -L + 2.2, W - 0.4, 6, '#1e1e1e', HAZ);
      } });
    // corrugation ribs on both long walls, rust streaks dripping from the roof line
    parts.push({ z0: 0.6, z1: H - 0.5, side: rib, top: rib, bevel: false, shape: (c) => { const fp = facing(c, 0, 1) > -0.05, fn = facing(c, 0, -1) > -0.05; for (let x = -L + 1.5; x < L - 1; x += 1.5) { if (fp) S.rect(c, x - 0.35, W - 0.05, 0.7, 0.3); if (fn) S.rect(c, x - 0.35, -W - 0.25, 0.7, 0.3); } } });
    parts.push({ z0: H * 0.35, z1: H - 0.5, side: rust, top: rust, bevel: false, shape: (c) => { const fp = facing(c, 0, 1) > -0.05, fn = facing(c, 0, -1) > -0.05; for (let i = 0; i < 5; i++) { const x = -L + 2 + Math.floor(U.hash2(i, seed, 71) * 13) * 1.5; if (fp) S.rect(c, x - 0.4, W - 0.05, 0.8, 0.36); if (fn) S.rect(c, -x - 0.4, -W - 0.3, 0.8, 0.36); } } });
    // rails, corner castings and door locking bars
    parts.push({ z0: 0, z1: H + 0.15, side: '#2a2c30', top: '#5a5e64', bevel: false, shape: (c) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) if (facing(c, sx, 0) > -0.05 || facing(c, 0, sy) > -0.05) S.rect(c, sx > 0 ? L - 0.95 : -L - 0.05, sy > 0 ? W - 0.95 : -W - 0.05, 1.0, 1.0); } });
    parts.push({ z0: 0.6, z1: H - 0.4, side: '#b8b8b0', top: '#d8d8d0', bevel: false, shape: (c) => { if (facing(c, -1, 0) < -0.05) return; for (const y of [-3.4, -1.2, 1.2, 3.4]) S.rect(c, -L - 0.35, y - 0.2, 0.4, 0.4); } });
    return { r: 15, h: H + 1, parts };
  };

  /* ---------- fence: concrete barrier segments with posts and wire ---------- */
  PROPS.fence = function (p, seed) {
    const conc = desat(mx(CONC, p.a, 0.2), 0.2), concT = desat(mx(CONC_T, p.b, 0.15), 0.2);
    const parts = [];
    const segs = seed === 2 ? [[-12.6, 12.6]] : [[-12.6, -0.7], [0.7, 12.6]];
    const prof = (zt) => 2.0 - zt * 1.05;
    parts.push({ z0: 0, z1: 5.4, side: conc, top: concT, shape: (c, zt) => { const w = prof(zt); for (const sg of segs) S.rect(c, sg[0], -w, sg[1] - sg[0], w * 2); },
      detail: (c) => { const s = []; for (const sg of segs) for (let x = sg[0] + 3; x < sg[1] - 1; x += 3) s.push(x, -0.9, x, 0.9); S.lines(c, 'rgba(0,0,0,0.25)', 0.3, s); } });
    // diagonal hazard bands painted on the barrier ends
    parts.push({ z0: 0.4, z1: 5.4, side: HAZ, top: '#ffc84a', bevel: false, shape: (c, zt) => { const w = prof(zt) + 0.04; for (const sg of segs) for (const e of [sg[0] + 0.3, sg[1] - 2.7]) for (let k = 0; k < 2; k++) { const x = e + k * 1.3 + zt * 0.9; S.rect(c, x, -w, 0.6, w * 2); } } });
    const posts = seed === 2 ? [-13.4, 13.4] : [-13.4, 0, 13.4];
    parts.push({ z0: 0, z1: 9.6, side: STEEL, top: STEEL_T, shape: (c) => { for (const x of posts) S.rect(c, x - 0.7, -0.7, 1.4, 1.4); } });
    parts.push({ z0: 9.6, z1: 10.2, side: '#2a2d32', top: HAZ, bevel: false, shape: (c) => { for (const x of posts) S.rect(c, x - 0.85, -0.85, 1.7, 1.7); } });
    parts.push({ z0: 7.6, z1: 7.9, side: '#5a6068', top: '#c8ccd0', stroke: 0.4, bevel: false, shape: (c) => S.seg(c, -13.4, 0, 13.4, 0) });
    parts.push({ z0: 8.9, z1: 9.2, side: '#5a6068', top: '#c8ccd0', stroke: 0.4, bevel: false, shape: (c) => S.seg(c, -13.4, 0, 13.4, 0) });
    // warning sign hung on the wire
    parts.push({ z0: 5.6, z1: 8.6, side: '#e8c030', top: '#ffe070', bevel: false, shape: (c) => S.rect(c, 4.6 + seed, -0.2, 2.6, 0.4) });
    return { r: 15, h: 11, parts };
  };

  /* ---------- mast: chunky lattice comm mast with platform, dish and beacon ---------- */
  PROPS.mast = function (p, seed) {
    const parts = [];
    const Z0 = 1.6, ZT = 26, B = 3.1, T = 1.5;
    const half = (zt) => B - (B - T) * zt;
    const steel = '#56606a', steelT = '#a8b2bc';
    parts.push({ z0: 0, z1: Z0, side: CONC, top: CONC_T, shape: (c) => S.rrect(c, -4.4, -4.4, 8.8, 8.8, 0.8),
      detail: (c) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.dot(c, '#4a4a48', sx * 3.1, sy * 3.1, 0.55); stripes(c, -4.2, 3.4, 4.2, 4.2, 8, '#1e1e1e', HAZ); } });
    // braces first (behind the legs): a zig-zag on each face
    parts.push({ z0: Z0, z1: ZT, side: steel, top: steelT, bevel: false, shape: (c, zt) => {
      const h = half(zt), u = tri(zt * 4), du = 1 / 52;
      const h2 = half(zt - du), u2 = tri((zt - du) * 4);
      const faces = [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]];
      for (const f of faces) { const x0 = f[0] * h + (f[2] - f[0]) * h * u, y0 = f[1] * h + (f[3] - f[1]) * h * u, x1 = f[0] * h2 + (f[2] - f[0]) * h2 * u2, y1 = f[1] * h2 + (f[3] - f[1]) * h2 * u2; bar(c, x1, y1, x0, y0, 0.22); }
    } });
    parts.push({ z0: Z0, z1: ZT, side: steel, top: steelT, shape: (c, zt) => { const h = half(zt); for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.circ(c, sx * h, sy * h, 0.5); } });
    // red/white aviation bands on the legs near the top
    parts.push({ z0: ZT - 5, z1: ZT - 2.5, side: '#c8382a', top: '#ff6a52', bevel: false, shape: (c, zt) => { const h = half((ZT - 5 - Z0 + zt * 2.5) / (ZT - Z0)); for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.circ(c, sx * h, sy * h, 0.55); } });
    // platform with railing
    parts.push({ z0: ZT - 0.8, z1: ZT, side: '#2e3238', top: '#7a838d', shape: (c) => S.rect(c, -T - 1.2, -T - 1.2, (T + 1.2) * 2, (T + 1.2) * 2),
      detail: (c) => { const s = []; for (let i = -2; i <= 2; i++) s.push(i, -T - 1.0, i, T + 1.0); S.lines(c, 'rgba(0,0,0,0.3)', 0.25, s); } });
    parts.push({ z0: ZT, z1: ZT + 1.6, side: '#8a929c', top: '#d0d6dc', stroke: 0.3, bevel: false, shape: (c) => S.rect(c, -T - 1.1, -T - 1.1, (T + 1.1) * 2, (T + 1.1) * 2) });
    // microwave drum dish on the +x side and a panel antenna on -y
    parts.push({ z0: ZT - 3.6, z1: ZT - 0.4, side: '#c8ccd0', top: '#f2f4f6', shape: (c, zt) => lyingCyl(c, zt, T + 1.6, 0.6, 1.6, 1.6, 0) });
    parts.push({ z0: ZT - 3.6, z1: ZT - 0.4, side: '#3a3f46', top: '#6a727c', shape: (c, zt) => { const w = 1.62 * cylW(zt); S.rect(c, T + 0.5, 0.6 - w, 0.5, w * 2); } });
    parts.push({ z0: ZT - 5.5, z1: ZT - 1.0, side: '#b8bcc0', top: '#e8eaec', shape: (c) => S.rect(c, -0.9, -T - 1.0, 1.8, 0.6) });
    // whip antenna + beacon
    parts.push({ z0: ZT, z1: ZT + 7, side: '#6a727c', top: '#c8ccd0', shape: (c) => S.circ(c, 0, 0, 0.3) });
    parts.push({ z0: ZT + 7, z1: ZT + 8.2, side: '#c01a10', top: '#ff5a3a', flat: true, shape: (c) => S.circ(c, 0, 0, 0.85), detail: (c) => S.dot(c, '#ffd8c8', -0.25, -0.25, 0.35) });
    return { r: 7, h: ZT + 9, parts };
  };

  /* ---------- pipe: pipeline section on saddles, flanges and a valve wheel ---------- */
  PROPS.pipe = function (p, seed) {
    const col = desat(mx(p.a, '#8a8274', 0.4), 0.25), top = sh(col, 0.35);
    const R = 2.5, Z0 = 1.4, L = 15;
    const parts = [];
    parts.push({ z0: 0, z1: 2.8, side: CONC, top: CONC_T, shape: (c) => { for (const x of [-8.5, 8.5]) S.rect(c, x - 1.3, -3.0, 2.6, 6.0); },
      detail: (c) => { for (const x of [-8.5, 8.5]) S.lines(c, 'rgba(0,0,0,0.3)', 0.3, [x - 1.1, -2.6, x + 1.1, -2.6]); } });
    // flanges (drawn before the body so only their rims show)
    const fl = [-L + 0.6, -4.2, 4.2, L - 0.6];
    parts.push({ z0: Z0 - 0.6, z1: Z0 + R * 2 + 0.6, side: '#3a3f46', top: '#8a929c', shape: (c, zt) => { const w = (R + 0.6) * cylW(zt); for (const x of fl) S.rect(c, x - 0.5, -w, 1.0, w * 2); } });
    parts.push({ z0: Z0 - 0.5, z1: Z0 + R * 2 + 0.5, side: '#c08a1c', top: HAZ, shape: (c, zt) => { const w = (R + 0.5) * cylW(zt); S.rect(c, seed === 2 ? -10 : 9.6, -w, 1.2, w * 2); } });
    parts.push({ z0: Z0, z1: Z0 + R * 2, side: col, top, shape: (c, zt) => lyingCyl(c, zt, 0, 0, L * 2, R, 0),
      detail: (c) => { S.lines(c, 'rgba(255,255,255,0.35)', 0.35, [-L + 1, -0.5, L - 1, -0.5]); } });
    // valve: stem + hand wheel
    const vx = seed === 3 ? -9 : 1.5;
    parts.push({ z0: Z0 + R * 2, z1: Z0 + R * 2 + 1.8, side: '#3a3f46', top: '#8a929c', shape: (c) => S.circ(c, vx, 0, 0.55) });
    parts.push({ z0: Z0 + R * 2 + 1.8, z1: Z0 + R * 2 + 2.3, side: '#a01e14', top: '#ff5a3a', stroke: 0.5, bevel: false, shape: (c) => { S.circ(c, vx, 0, 1.6); S.seg(c, vx - 1.6, 0, vx + 1.6, 0); S.seg(c, vx, -1.6, vx, 1.6); } });
    return { r: 17, h: 10, parts };
  };

  /* ---------- wreck: overturned rover (seeds 1, 3) or a crashed aircraft tail (seed 2) ---------- */
  function rover(parts, livery, flip) {
    const fy = flip ? -1 : 1;
    const soot = 'rgba(20,16,12,';
    // a detached door lying beside (ground level, drawn first)
    parts.push({ z0: 0, z1: 0.6, side: sh(livery, -0.2), top: sh(livery, 0.1), bevel: false, shape: (c) => S.poly(c, [-3.0, 6.4 * fy, 2.4, 6.0 * fy, 2.8, 8.8 * fy, -2.6, 9.4 * fy]),
      detail: (c) => S.lines(c, 'rgba(0,0,0,0.35)', 0.35, [-1.6, 7.2 * fy, 1.8, 6.9 * fy]) });
    // squashed cabin (roof on the ground)
    parts.push({ z0: 0, z1: 3.2, side: livery, top: sh(livery, 0.18), shape: (c) => S.poly(c, [-8.2, -4.9, 6.4, -5.1, 8.4, -3.4, 8.2, 3.6, 6.2, 5.1, -8.0, 4.9]),
      detail: (c) => { S.fillPoly(c, HAZ, [-8.0, 4.2, 6.0, 4.4, 6.2, 4.9, -8.0, 4.8]); S.fillPoly(c, '#1e2226', [7.0, -3.0, 8.0, -2.6, 7.9, 2.8, 6.9, 3.2]); } });
    // exposed underside (chassis plate) with axles and shaft
    parts.push({ z0: 3.2, z1: 4.6, side: '#3e3a36', top: '#5e5852', shape: (c) => S.rrect(c, -7.2, -3.8, 14.4, 7.6, 1.2),
      detail: (c) => {
        S.lines(c, '#2a2724', 0.9, [-5.4, -3.6, -5.4, 3.6, 5.4, -3.6, 5.4, 3.6]);
        S.lines(c, '#2a2724', 0.7, [-5.4, 0, 5.4, 0]);
        c.fillStyle = '#34302c'; c.beginPath(); S.rrect(c, -2.6, -2.2, 5.2, 4.4, 0.8); c.fill();
        S.lines(c, 'rgba(255,255,255,0.18)', 0.35, [-7, -3.5, 7, -3.5]);
        const g = c.createRadialGradient(2.4, 1.6 * fy, 0, 2.4, 1.6 * fy, 4.5); g.addColorStop(0, soot + '0.7)'); g.addColorStop(1, soot + '0)'); c.fillStyle = g; c.beginPath(); c.arc(2.4, 1.6 * fy, 4.5, 0, TAU); c.fill();
        S.dot(c, 'rgba(140,70,30,0.6)', -6.2, 2.6 * fy, 1.4);
      } });
    // the four wheels, pointing at the sky
    parts.push({ z0: 4.6, z1: 9.6, side: '#24221f', top: '#4e4a44', shape: (c, zt) => { const w = 2.5 * cylW(zt); for (const x of [-5.4, 5.4]) for (const y of [-1, 1]) S.rect(c, x - w, y * 4.4 - 0.95, w * 2, 1.9); },
      detail: (c) => { for (const x of [-5.4, 5.4]) for (const y of [-1, 1]) S.lines(c, 'rgba(0,0,0,0.5)', 0.3, [x, y * 4.4 - 0.9, x, y * 4.4 + 0.9]); } });
    // torn bumper
    parts.push({ z0: 0, z1: 3.0, side: '#2e2c2a', top: '#6a6460', shape: (c) => S.poly(c, [8.6, -3.6, 9.8, -3.0, 9.4, 2.2, 8.6, 3.0]) });
  }
  PROPS.wreck = function (p, seed) {
    const parts = [];
    if (seed === 2) {
      // crashed aircraft tail: tapered fuselage, fin with red tip, stabilisers, torn front
      const hull = desat(mx('#b8b2a2', p.b, 0.15), 0.3), hullT = sh(hull, 0.18);
      const rAt = (x) => 1.4 + (x + 10) / 16 * 2.4;   // radius along the fuselage, x -10..6
      parts.push({ z0: 0, z1: 0.6, side: '#24201c', top: '#3a342e', bevel: false, shape: (c) => { S.poly(c, [9.6, 3.0, 12.4, 4.4, 11.0, 6.0, 8.6, 5.0]); S.poly(c, [8.4, -5.6, 11.6, -6.6, 12.0, -4.4]); } });
      parts.push({ z0: 3.0, z1: 3.8, side: sh(hull, -0.2), top: hullT, shape: (c) => S.poly(c, [-6.6, 0, -9.6, 6.0, -10.8, 6.0, -10.0, 0, -10.8, -6.0, -9.6, -6.0]) });
      parts.push({ z0: 0, z1: 7.6, side: hull, top: hullT, shape: (c, zt) => { const z = zt * 7.6, zc = 3.8; const w = (x) => { const r = rAt(x); return Math.sqrt(Math.max(0, r * r - (z - zc) * (z - zc))); }; const w0 = w(-10), w1 = w(6); S.poly(c, [-10, -w0, 3.6, -w1, 5.2, -w1 * 0.6, 6.0, -w1 * 0.9, 6.6, 0, 6.0, w1 * 0.7, 5.0, w1, -10, w0]); },
        detail: (c) => { S.lines(c, 'rgba(0,0,0,0.35)', 0.35, [-4, -0.9, -4, 0.9, 1, -1.2, 1, 1.2]); S.lines(c, HAZ, 0.6, [-8.5, 0.0, -1, 0.0]); const g = c.createRadialGradient(4, 0, 0, 4, 0, 4.5); g.addColorStop(0, 'rgba(20,16,12,0.75)'); g.addColorStop(1, 'rgba(20,16,12,0)'); c.fillStyle = g; c.beginPath(); c.arc(4, 0, 4.5, 0, TAU); c.fill(); } });
      // torn break: dark interior with ribs
      parts.push({ z0: 0.4, z1: 7.4, side: '#1a1816', top: '#2a2622', bevel: false, shape: (c, zt) => { if (facing(c, 1, 0) < -0.05) return; const z = zt * 7.6, r = rAt(6) - 0.4; const w = Math.sqrt(Math.max(0, r * r - (z - 3.8) * (z - 3.8))); S.rect(c, 6.0, -w, 0.7, w * 2); } });
      parts.push({ z0: 7.0, z1: 12.4, side: hull, top: hullT, shape: (c, zt) => S.poly(c, [-6.6 - zt * 2.4, -0.4, -10.4 - zt * 1.2, -0.4, -10.4 - zt * 1.2, 0.4, -6.6 - zt * 2.4, 0.4]) });
      parts.push({ z0: 12.4, z1: 14.0, side: '#a8281c', top: '#ff5a40', shape: (c) => S.poly(c, [-9.0, -0.4, -11.6, -0.4, -11.6, 0.4, -9.0, 0.4]) });
      // exposed spars
      parts.push({ z0: 3.0, z1: 3.6, side: '#4a4a4a', top: '#9a9a9a', stroke: 0.4, bevel: false, shape: (c) => { S.seg(c, 6.4, -1.6, 9.0, -2.4); S.seg(c, 6.4, 1.2, 8.6, 2.6); } });
      return { r: 15, h: 15, parts };
    }
    rover(parts, seed === 3 ? desat(mx('#9a5a34', p.a, 0.15), 0.25) : desat(mx('#c8bfa8', p.b, 0.1), 0.35), seed === 3);
    return { r: 13, h: 10, parts };
  };

  /* ---------- lamp: floodlight mast with ballast block and twin lamp heads ---------- */
  PROPS.lamp = function (p, seed) {
    const parts = [];
    parts.push({ z0: 0, z1: 2.4, side: CONC, top: CONC_T, shape: (c) => S.rrect(c, -3.2, -3.2, 6.4, 6.4, 0.6),
      detail: (c) => { stripes(c, -3.0, 2.2, 3.0, 3.0, 6, '#1e1e1e', HAZ); S.dot(c, '#3a3a38', -2.2, -2.2, 0.4); S.dot(c, '#3a3a38', 2.2, -2.2, 0.4); } });
    parts.push({ z0: 2.4, z1: 3.4, side: '#2e3238', top: '#6a727c', shape: (c) => S.rect(c, -1.4, -1.4, 2.8, 2.8) });
    parts.push({ z0: 3.4, z1: 17.0, side: '#4e565e', top: '#a0a8b0', shape: (c) => S.rect(c, -0.7, -0.7, 1.4, 1.4) });
    parts.push({ z0: 6.0, z1: 8.4, side: '#3a4048', top: '#7a828c', shape: (c) => S.rect(c, -1.1, 0.4, 2.2, 1.3), detail: (c) => S.dot(c, '#7aff8a', 0.5, 1.0, 0.3) });
    parts.push({ z0: 17.0, z1: 17.8, side: '#2a2e34', top: '#6a727c', shape: (c) => S.rect(c, -4.4, -0.5, 8.8, 1.0) });
    // lamp heads face +y (toward the viewer) so their lenses read as bright panels
    const heads = [-2.6, 2.6];
    parts.push({ z0: 16.0, z1: 19.8, side: '#30353c', top: '#6e7680', shape: (c) => { for (const x of heads) S.rrect(c, x - 1.5, -1.6, 3.0, 2.6, 0.5); },
      detail: (c) => { for (const x of heads) S.lines(c, 'rgba(0,0,0,0.45)', 0.3, [x - 1.1, -1.0, x + 1.1, -1.0, x - 1.1, -0.3, x + 1.1, -0.3]); } });
    parts.push({ z0: 16.2, z1: 19.6, side: '#ffec98', top: '#fffbe0', flat: true, bevel: false, shape: (c) => { for (const x of heads) S.rect(c, x - 1.35, 0.9, 2.7, 0.5); } });
    return { r: 6, h: 21, parts };
  };

  /* ---------- plant: large broad-leaf foliage cluster (elephant-ear leaves, fern fronds, lantern pods) ---------- */
  PROPS.plant = function (p, seed) {
    const parts = [];
    const lum = (c) => { const v = C.hex(c); return (v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11) / 255; };
    // leaves must stand out from their ground: lift dark palettes toward a sunlit yellow-green / pink
    const lift = lum(p.b) < 0.5 ? 0.3 : 0.12;
    const leafS = mx(p.a, p.b, 0.35), leafT = sh(mx(p.b, '#e8f070', 0.25), lift), leafT2 = sh(mx(p.b, '#f6ff9a', 0.4), lift + 0.05), vein = rgba(sh(p.a, -0.4), 0.6);
    const off = seed * 0.9;
    // fern fronds: long, thin, notched, lying low
    const nf = 5 + seed % 2;
    parts.push({ z0: 0, z1: 1.6, side: sh(p.a, -0.05), top: mx(leafT, p.a, 0.35), bevel: false, shape: (c, zt) => { for (let i = 0; i < nf; i++) { const a = off + 0.3 + i / nf * TAU, L = (13 + U.hash2(i, seed, 8) * 3) * (1 - zt * 0.3); for (let k = 0; k < 6; k++) { const d = 3 + k * L / 7.5, w = 1.6 * (1 - k / 7); leafPath(c, a + 0.18 * (k % 2 ? 1 : -1), d - 0.6, 2.4, w); } leafPath(c, a, 1, L, 0.5); } } });
    // broad leaves, low tier
    const n1 = 5 + (seed % 2);
    parts.push({ z0: 0.6, z1: 4.0, side: leafS, top: leafT, shape: (c, zt) => { for (let i = 0; i < n1; i++) { const a = off + i / n1 * TAU, L = (10 + U.hash2(i, seed, 5) * 2.5) * (1 - zt * 0.45); leafPath(c, a, 0, L, 3.6 * (1 - zt * 0.25)); } },
      detail: (c) => { const s = []; for (let i = 0; i < n1; i++) { const a = off + i / n1 * TAU, L = (10 + U.hash2(i, seed, 5) * 2.5) * 0.55; s.push(Math.cos(a) * 0.8, Math.sin(a) * 0.8, Math.cos(a) * L * 0.92, Math.sin(a) * L * 0.92); for (const sg of [-1, 1]) s.push(Math.cos(a) * L * 0.45, Math.sin(a) * L * 0.45, Math.cos(a + sg * 0.35) * L * 0.75, Math.sin(a + sg * 0.35) * L * 0.75); } S.lines(c, vein, 0.32, s); } });
    // upper tier
    const n2 = 4;
    parts.push({ z0: 3.2, z1: 7.4, side: mx(p.a, p.b, 0.55), top: leafT2, shape: (c, zt) => { for (let i = 0; i < n2; i++) { const a = off + 0.7 + i / n2 * TAU, L = 7.4 * (1 - zt * 0.55); leafPath(c, a, 0, L, 2.8 * (1 - zt * 0.3)); } },
      detail: (c) => { const s = []; for (let i = 0; i < n2; i++) { const a = off + 0.7 + i / n2 * TAU; s.push(0, 0, Math.cos(a) * 3.0, Math.sin(a) * 3.0); } S.lines(c, rgba(sh(p.b, 0.55), 0.6), 0.3, s); } });
    // stalks carrying glowing lantern pods
    const buds = [[1.4, -1.6, 12.0], [-3.2, 1.0, 10.0], [3.0, 2.4, 9.0]].slice(0, 1 + seed);
    parts.push({ z0: 6.0, z1: 11.0, side: sh(p.a, -0.2), top: p.b, bevel: false, shape: (c, zt) => { const z = 6 + zt * 5; for (const b of buds) if (z < b[2] - 1.2) S.circ(c, b[0] * (z - 6) / (b[2] - 6), b[1] * (z - 6) / (b[2] - 6), 0.45); } });
    parts.push({ z0: 7.6, z1: 12.8, side: sh(p.g, -0.2), top: '#ffffff', flat: true, ao: 0.2, shape: (c, zt) => { const z = 7.6 + zt * 5.2; for (const b of buds) { const d = (z - (b[2] - 1.1)) / 1.3; if (Math.abs(d) <= 1) S.circ(c, b[0], b[1], 1.5 * Math.sqrt(Math.max(0.08, 1 - d * d))); } } });
    return { r: 16, h: 14, parts, style: 'prop' };
  };

  /* ---------- crystals: cluster of leaning hexagonal shards with lit facets and glowing cores ---------- */
  PROPS.crystals = function (p, seed) {
    const parts = [];
    const side = sh(p.a, -0.2), top = mx(p.a, p.b, 0.6), glow = p.g, facet = rgba(sh(p.b, 0.4), 0.9);
    parts.push({ z0: 0, z1: 1.4, side: sh(desat(p.a, 0.7), -0.6), top: sh(desat(p.a, 0.7), -0.38), shape: (c) => S.blob(c, 0, 0.6, 5.4, seed * 7, 9, 0.35) });
    const cr = [{ x: -0.4, y: -0.6, r: 2.0, h: 16, la: -Math.PI / 2 + 0.2, lk: 0.1 }];
    const n = 3 + (seed % 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed * 1.3 + U.hash2(i, seed, 11) * 0.6, d = 3.0 + U.hash2(i, seed, 12) * 1.6;
      cr.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, r: 1.1 + U.hash2(i, seed, 13) * 0.7, h: 6 + U.hash2(i, seed, 14) * 5.5, la: a, lk: 0.42 });
    }
    cr.sort((A, B) => A.y - B.y);
    for (const q of cr) {
      const tipZ = q.h * 0.62;
      const at = (z) => [q.x + Math.cos(q.la) * q.lk * z, q.y + Math.sin(q.la) * q.lk * z];
      parts.push({ z0: 0.6, z1: 0.6 + q.h, side, top, ao: 0.25, shape: (c, zt) => { const z = zt * q.h, k = z < tipZ ? 1 : Math.max(0.04, 1 - (z - tipZ) / (q.h - tipZ)); const o = at(z); S.poly(c, ngon(q.r * k, 6, Math.PI / 6, o[0], o[1])); },
        detail: (c) => { const o = at(q.h); S.dot(c, '#ffffff', o[0], o[1], 0.35); } });
      // lit facet edge (left-front) and glowing core streak (front face)
      parts.push({ z0: 1.0, z1: 0.6 + tipZ, side: facet, top: facet, flat: true, bevel: false, shape: (c, zt) => { const o = at(zt * tipZ); S.rect(c, o[0] - q.r * 0.86, o[1] + q.r * 0.2, 0.32, 0.3); } });
      parts.push({ z0: 1.2, z1: 0.6 + tipZ * 0.9, side: glow, top: glow, flat: true, bevel: false, shape: (c, zt) => { const o = at(zt * tipZ * 0.9); S.rect(c, o[0] - 0.35, o[1] + q.r * 0.78, 0.7, 0.25); } });
    }
    return { r: 12, h: 18, parts, style: 'prop', post: { rimStrength: 0.32 } };
  };

  /* ---------- shroom: glowing-spotted mushroom cluster ---------- */
  PROPS.shroom = function (p, seed) {
    const parts = [];
    const stem = '#d8d0e2', stemS = '#9a90aa';
    const list = [[0, -0.5, 5.6, 9.0], [-4.8, 2.4, 2.8, 5.0], [4.2, 3.2, 2.2, 3.8]];
    if (seed === 2) list.push([-1.6, 4.6, 1.6, 2.6]);
    if (seed === 3) { list[0][3] = 11; list[1][2] = 3.4; }
    list.sort((A, B) => A[1] - B[1]);
    for (const m of list) {
      const [x, y, R, Hs] = m, capH = R * 0.62;
      parts.push({ z0: 0, z1: Hs, side: stemS, top: stem, shape: (c, zt) => S.circ(c, x, y, R * 0.24 * (1.25 - zt * 0.35)) });
      parts.push({ z0: Hs - 0.4, z1: Hs - 0.4 + capH, side: sh(p.a, -0.2), top: p.b, shape: (c, zt) => S.circ(c, x, y, R * Math.sqrt(Math.max(0.12, 1 - Math.pow(zt * 0.92, 2)))),
        detail: (c) => { const rr = R * 0.36; S.dot(c, p.g, x - rr * 0.6, y - rr * 0.2, R * 0.12); S.dot(c, p.g, x + rr * 0.5, y + rr * 0.4, R * 0.09); spec(c, x - rr * 0.4, y - rr * 0.8, R * 0.08, R * 0.16, 0.6, 0.6); } });
      parts.push({ z0: Hs + capH * 0.2, z1: Hs + capH * 0.2, side: p.g, top: p.g, flat: true, bevel: false, shape: (c) => { S.circ(c, x + R * 0.55, y + R * 0.55, R * 0.12); S.circ(c, x - R * 0.7, y + R * 0.45, R * 0.1); S.circ(c, x + R * 0.05, y + R * 0.8, R * 0.11); } });
    }
    return { r: 11, h: 15, parts, style: 'prop' };
  };

  /* ---------- gearbit: half-buried standing gear, fallen broken gear, bent shaft, hot embers ---------- */
  PROPS.gearbit = function (p, seed) {
    const parts = [];
    const metal = desat(mx('#9a9ea4', p.b, 0.3), 0.25), metalS = sh(metal, -0.12), metalD = sh(metal, -0.45), glow = p.g;
    const GR = seed === 1 ? 6.4 : 5.4, gx = seed === 3 ? 1.6 : -1.2, gy = -2.2, nT = 14;
    // scorched debris patch
    parts.push({ z0: 0, z1: 0.8, side: sh(p.d, 0.08), top: sh(desat(p.a, 0.4), -0.3), bevel: false, shape: (c) => S.blob(c, 0.4, 0.8, 7.2, seed * 13, 11, 0.36) });
    // standing gear (disc in the xz plane facing the viewer) with radial teeth on its rim
    parts.push({ z0: 0.4, z1: 0.4 + GR + 0.9, side: metalS, top: sh(metal, 0.25), ao: 0.22, shape: (c, zt) => { const z = zt * (GR + 0.9); const w0 = Math.sqrt(Math.max(0, GR * GR - z * z)); const th = Math.atan2(z, Math.max(0.01, w0)); const tooth = Math.floor(th / (Math.PI / nT)) % 2 === 0 ? 0.95 : 0; const rr = GR + tooth; const w = Math.sqrt(Math.max(0, rr * rr - z * z)); if (w > 0.05) S.rect(c, gx - w, gy - 0.9, w * 2, 1.8); } });
    // lightening holes and hub boss on the gear face (drawn in front of it)
    const faceY = gy + 0.9;
    parts.push({ z0: 0.4 + GR * 0.5 - 1.0, z1: 0.4 + GR * 0.5 + 1.0, side: metalD, top: metalD, flat: true, bevel: false, shape: (c, zt) => { const w = 1.0 * cylW(zt); for (const dx of [-GR * 0.55, GR * 0.55]) S.rect(c, gx + dx - w, faceY, w * 2, 0.15); } });
    parts.push({ z0: 0.4 + GR * 0.32 - 1.7, z1: 0.4 + GR * 0.32 + 1.7, side: sh(metal, 0.08), top: sh(metal, 0.3), shape: (c, zt) => { const w = 1.7 * cylW(zt); S.rect(c, gx - w, faceY, w * 2, 1.0); } });
    parts.push({ z0: 0.4 + GR * 0.32 - 0.7, z1: 0.4 + GR * 0.32 + 0.7, side: '#1a1816', top: '#2a2622', flat: true, bevel: false, shape: (c, zt) => { const w = 0.7 * cylW(zt); S.rect(c, gx - w, faceY + 1.0, w * 2, 0.15); } });
    // fallen broken gear in front
    const fx = seed === 3 ? -3.0 : 3.2, fy = 3.0, FR = 4.0;
    parts.push({ z0: 0.4, z1: 1.9, side: metalS, top: sh(metal, 0.18), shape: (c) => { const n = 11, a0 = 0.9, a1 = TAU - 0.5; for (let i = 0; i <= n * 2; i++) { const a = a0 + (a1 - a0) * i / (n * 2); const r = i % 2 ? FR : FR + 0.9; const px = fx + Math.cos(a) * r, py = fy + Math.sin(a) * r; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.lineTo(fx + Math.cos(a1) * 1.6, fy + Math.sin(a1) * 1.6); c.lineTo(fx + 1.2, fy + 0.4); c.lineTo(fx + Math.cos(a0) * 1.8, fy + Math.sin(a0) * 1.8); c.closePath(); },
      detail: (c) => { S.dot(c, metalD, fx, fy, 1.3); S.dot(c, '#1a1816', fx, fy, 0.7); c.save(); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.35; c.beginPath(); c.arc(fx, fy, FR * 0.66, 0.9, TAU - 0.5); c.stroke(); c.restore(); spec(c, fx - 2.2, fy - 1.6, 0.4, 1.2, 0.8, 0.4); } });
    // bent shaft
    parts.push({ z0: 0.4, z1: 2.4, side: sh(metal, -0.25), top: sh(metal, 0.3), shape: (c, zt) => lyingCyl(c, zt, seed === 3 ? 4.2 : -4.0, 4.0, 5.6, 1.0, 0.5 + seed * 0.35) });
    // glowing embers / hot slag
    parts.push({ z0: 0.8, z1: 0.8, side: glow, top: glow, flat: true, bevel: false, shape: (c) => { S.blob(c, -5.4, -0.2, 1.0, seed, 6, 0.4); S.blob(c, 5.8, -1.6, 0.8, seed + 3, 6, 0.4); S.blob(c, 0.4, 6.0, 0.7, seed + 5, 6, 0.4); },
      detail: (c) => { S.dot(c, '#fff0c0', -5.4, -0.2, 0.4); S.dot(c, '#fff0c0', 5.8, -1.6, 0.3); } });
    return { r: 11, h: GR + 3, parts, style: 'prop' };
  };

  /* ---------- coral: reef cluster (branching coral, tube sponges, brain coral) ---------- */
  PROPS.coral = function (p, seed) {
    const parts = [];
    const pink = sh(mx(p.b, '#ff8aa8', 0.25), 0.12), pinkS = mx(mx(p.a, p.b, 0.45), '#e8507a', 0.2), orange = mx('#f8a048', p.a, 0.18), teal = '#38b8aa', violet = '#9a62d8';
    parts.push({ z0: 0, z1: 0.9, side: '#4a4240', top: '#6a5e58', bevel: false, shape: (c) => S.blob(c, 0, 0.8, 3.4, seed * 5, 8, 0.35) });
    // tube sponges at the back
    const tubes = seed === 2 ? [[3.6, -2.6, 1.3, 7.5], [5.4, -0.6, 1.0, 5.2]] : [[-3.8, -2.4, 1.3, 7.8], [-5.4, -0.2, 1.0, 5.0], [-2.0, -3.6, 0.9, 5.6]];
    tubes.sort((A, B) => A[1] - B[1]);
    parts.push({ z0: 0.6, z1: 8.6, side: sh(seed === 3 ? violet : teal, -0.1), top: sh(seed === 3 ? violet : teal, 0.35), shape: (c, zt) => { const z = 0.6 + zt * 8; for (const t of tubes) if (z <= t[3] + 0.6) S.circ(c, t[0], t[1], t[2] * (1 + zt * 0.25)); },
      detail: (c) => { for (const t of tubes) { S.dot(c, '#14302c', t[0], t[1], t[2] * 0.62); } } });
    // branching coral: forked arms with glowing tips
    const br = [];
    const n = 6 + (seed % 2);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55 + (U.hash2(i, seed, 3) - 0.5) * 0.35; br.push({ a, len: 4.6 + U.hash2(i, seed, 4) * 2.2, h: 7.5 + U.hash2(i, seed, 6) * 4 }); }
    const ox = seed === 2 ? -1.0 : 1.0, oy = 0.6;
    const pos = (b, k) => { const d = Math.pow(k, 1.25) * b.len; return [ox + Math.cos(b.a) * d * 0.9, oy + Math.sin(b.a) * d * 0.5 + d * 0.2]; };
    const tipPos = (b) => pos(b, 1);
    const forkPos = (b, kk) => { const f = pos(b, 0.5), a2 = b.a + (b.a < -Math.PI / 2 ? -0.9 : 0.9); return [f[0] + Math.cos(a2) * kk * b.len * 0.5, f[1] + Math.sin(a2) * kk * b.len * 0.35]; };
    parts.push({ z0: 0.6, z1: 12.0, side: pinkS, top: pink, shape: (c, zt) => { const z = zt * 11.4; for (const b of br) { if (z <= b.h) { const k = z / b.h, q = pos(b, k), q2 = pos(b, Math.max(0, k - 0.04)); bar(c, q2[0], q2[1], q[0], q[1], 1.2 * (1 - k * 0.3)); } const fz = b.h * 0.5, fh = b.h * 0.8; if (z > fz && z <= fh) { const kk = (z - fz) / (fh - fz), q = forkPos(b, kk); S.circ(c, q[0], q[1], 0.95 * (1 - kk * 0.3)); } } } });
    parts.push({ z0: 5.0, z1: 12.0, side: sh(p.g, -0.25), top: '#ffffff', flat: true, bevel: false, shape: (c, zt) => { const z = 5.0 + zt * 7.0; for (const b of br) { if (Math.abs(z - (b.h + 0.6)) < 0.75) { const q = tipPos(b); S.circ(c, q[0], q[1], 0.95); } if (Math.abs(z - (b.h * 0.8 + 0.6)) < 0.6) { const q = forkPos(b, 1); S.circ(c, q[0], q[1], 0.75); } } } });
    // brain coral dome in front
    const bx = seed === 2 ? 3.4 : -2.4, by = 3.0;
    parts.push({ z0: 0.6, z1: 3.8, side: sh(orange, -0.15), top: sh(orange, 0.22), shape: (c, zt) => S.circ(c, bx, by, 3.0 * Math.sqrt(Math.max(0.1, 1 - zt * zt * 0.85))),
      detail: (c) => { c.save(); c.strokeStyle = rgba(sh(orange, -0.45), 0.75); c.lineWidth = 0.32; c.beginPath(); c.moveTo(bx - 1.0, by - 0.3); c.quadraticCurveTo(bx, by - 1.0, bx + 0.9, by - 0.2); c.moveTo(bx - 0.8, by + 0.5); c.quadraticCurveTo(bx + 0.2, by + 0.9, bx + 0.9, by + 0.5); c.stroke(); c.restore(); } });
    return { r: 10, h: 14, parts, style: 'prop' };
  };

  M.prop2 = function (kind, pal, o) {
    o = o || {};
    const fn = PROPS[kind];
    if (!fn) return M.prop(kind, pal, o);
    const m = fn(P(pal), o.seed || 1, o);
    if (!m.style) m.style = 'prop';
    return m;
  };
  M._itemsProps = PROPS;
})(window.AS);
