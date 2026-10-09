/* WYRMCROWN — architecture of the wider world (the Huge World's peoples and places).
 * Built on the site helpers (AS.ModelKit, models_sites.js), in the same style:
 *   ab_abbey      a great stone abbey church: nave, transept, apse, west tower and spire
 *   dw_gate       a dwarf hold's gate carved into a mountain: bronze doors, rune bands,
 *                 two giant guardian statues, braziers
 *   dw_hall       v0 a squat dwarf stone hall under heavy slate · v1 a forge with a hearth glow
 *   hb_burrow     a hill-folk burrow: a grassy mound with a round door, round windows,
 *                 a chimney and a garden (v 0-3: door colours and shapes)
 *   hr_pier       a harbour jetty on posts with crates and a crane (16 directions)
 *   hr_boat       a moored sailing boat (16 directions)
 *   bd_stockade   an outlaws' stockade: a ring of sharpened stakes with a gate
 *   dg_dungeon    a dungeon entrance: a carved portal over stairs into the dark, torches */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU, S = AS.Shapes;
  const M = AS.Models, K = AS.ModelKit;
  if (!K) return;
  const { P, mats, sh, mx, al, rng, pulse, jag, stain, box, cyl, beams, xzPart, rockPart, rockFacets, paintMoss, layer, archRect, win, door, stones, roof, paintShingles, paintGable, flagPole, paintFlag } = K;

  /* ======================================================== ab_abbey */
  M.ab_abbey = function (pal, opt) {
    const p = P(pal, opt), m = mats(p);
    const stone = mx(p.b, '#d8d0bc', 0.5), stoneS = mx(p.a, '#a49c8c', 0.4), slate = '#5a6470';
    const slateCols = { N: sh(slate, 0.3), W: sh(slate, 0.16), S: sh(slate, -0.02), E: sh(slate, -0.28) };
    const parts = [stain(70, 36, 0.3, '#2a2216', 4, 6)];
    // plinth and the nave (west-east), the transept (north-south), the apse
    parts.push(box(4, 0, 78, 26, 0, 1.4, m.stoneD, stoneS, { ao: 0.3 }));
    parts.push(box(2, 0, 62, 22, 1.4, 19, stoneS, stone, { ao: 0.35 }));
    parts.push(box(12, 0, 18, 50, 1.4, 17, stoneS, stone, { ao: 0.35 }));
    parts.push(cyl(34, 0, 10.5, 1.4, 16, stoneS, stone, { ao: 0.35 }));
    // buttresses down the south wall
    for (const x of [-22, -12, -2, 24]) parts.push(box(x, 12.2, 2.6, 2.6, 1.4, 14, sh(stoneS, -0.06), stone, { ao: 0.25, shape: (c, zt) => c.rect(x - 1.3, 11 - 0, 2.6, 2.6 - zt * 1.4) }));
    // roofs: the nave ridge along x, the transept ridge along y, a cone on the apse
    const Rn = roof({ x: 2, y: 0, L: 32, W: 12.6, z: 19, H: 15, cols: slateCols, fascia: 1 });
    parts.push(...Rn.parts);
    const Rt = roof({ x: 12, y: 0, L: 26, W: 10.4, z: 17, H: 13, ax: 'y', cols: slateCols, fascia: 1 });
    parts.push(...Rt.parts);
    parts.push({ z0: 16, z1: 27, side: slateCols.E, top: slateCols.S, ao: 0.2, bevel: false, shape: (c, zt) => S.circ(c, 34, 0, Math.max(0.3, 11.5 * (1 - zt))) });
    // the west tower and its spire
    parts.push(box(-34, 0, 17, 17, 0, 40, stoneS, stone, { ao: 0.4 }));
    parts.push(box(-34, 0, 19, 19, 38, 41, m.stoneD, stone, { ao: 0.2 }));
    for (const q of [[-42, -8], [-26, -8], [-42, 8], [-26, 8]]) parts.push(cyl(q[0], q[1], 1.6, 41, 46, stoneS, stone, { bevel: false }));
    parts.push({ z0: 41, z1: 68, side: slateCols.E, top: slateCols.W, ao: 0.15, bevel: false, shape: (c, zt) => { const w = Math.max(0.25, 7.6 * (1 - zt)); c.rect(-34 - w, -w, w * 2, w * 2); } });
    parts.push(cyl(-34, 0, 0.35, 68, 72, '#a8823a', '#f2d47a', { bevel: false }));
    parts.push(box(-34, 0, 3, 0.6, 70.2, 70.9, '#a8823a', '#f2d47a', { bevel: false }));
    // paint: stonework, lancet windows of coloured glass, the west door, a rose window on the transept
    const glass = { g1: '#9fd0ff', g2: '#4a7ac8', g3: '#b0324a', frame: '#3a3430', sill: false };
    parts.push(layer((pe) => {
      const y = 11.02;
      stones(pe, -29, 33, y, 1.4, 19, 41, { row: 2, w: 1.6, joint: 'rgba(60,52,40,0.28)' });
      for (const x of [-17, -7, 3, 19, 29]) win(pe, x, y, 7, 3.2, 8.5, Object.assign({ arch: true }, glass));
      const yt = 25.02;
      stones(pe, 3, 21, yt, 1.4, 17, 43, { row: 2, w: 1.6, joint: 'rgba(60,52,40,0.28)' });
      win(pe, 7.5, yt, 4, 2.6, 7, Object.assign({ arch: true }, glass)); win(pe, 16.5, yt, 4, 2.6, 7, Object.assign({ arch: true }, glass));
      // rose window in the transept gable
      const c = pe.c, cx = 12, cz = 22;
      c.beginPath(); c.arc(cx, yt - cz, 4.2, 0, TAU); c.fillStyle = '#3a3430'; c.fill();
      const g = c.createRadialGradient(cx, yt - cz, 0, cx, yt - cz, 3.6); g.addColorStop(0, '#ffe6a0'); g.addColorStop(0.5, '#5a8ad0'); g.addColorStop(1, '#a03048'); c.beginPath(); c.arc(cx, yt - cz, 3.6, 0, TAU); c.fillStyle = g; c.fill();
      const sp = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; sp.push(cx, yt, cz, cx + Math.cos(a) * 3.6, yt, cz + Math.sin(a) * 3.6); }
      pe.lines('#3a3430', 0.35, sp);
      // tower: stones, the great west door, belfry openings, a clock-face
      const yw = 8.52;
      stones(pe, -42.5, -25.5, yw, 0, 40, 47, { row: 2.2, w: 1.6, joint: 'rgba(60,52,40,0.3)' });
      door(pe, -34, yw, 6, 10, m.woodD, { arch: true, frame: '#5a5048' });
      for (const x of [-38, -30]) archRect(pe, '#1a1612', x - 1.4, x + 1.4, yw, 30, 36.5, true);
      win(pe, -34, yw, 17, 2.4, 6, Object.assign({ arch: true }, glass));
      pe.dot('#e8dcc0', -34, yw, 26, 2.2); pe.dot('#3a3430', -34, yw, 26, 0.3); pe.lines('#3a3430', 0.3, [-34, yw, 26, -34, yw, 27.6, -34, yw, 26, -32.9, yw, 26.4]);
    }));
    parts.push(layer((pe) => { paintShingles(pe, Rn, 51, { col: slate, row: 1.3 }); paintShingles(pe, Rt, 52, { col: slate, row: 1.3 }); }));
    return { r: 52, h: 72, parts, style: 'prop', bevel: 0.7, spots: {} };
  };

  /* ======================================================== dw_gate */
  M.dw_gate = function (pal, opt) {
    const p = P(pal, opt);
    const rkS = mx(p.a, '#6a6660', 0.55), rkT = mx(p.s, '#9e9a90', 0.5), carved = mx(p.b, '#b8b0a0', 0.45), bronze = '#a8723a', bronzeL = '#e0a85a';
    const parts = [stain(86, 46, 0.34, '#1e1810', 0, 4)];
    // the mountain behind: heaped crags rising to the back
    const back = [
      { x: -60, y: -40, r: 22, h: 40, seed: 301 }, { x: -28, y: -52, r: 26, h: 66, seed: 302, n: 13 }, { x: 8, y: -56, r: 30, h: 78, seed: 303, n: 14, sx: 1.2 },
      { x: 44, y: -48, r: 26, h: 62, seed: 304, n: 13 }, { x: 72, y: -32, r: 18, h: 34, seed: 305 }, { x: -78, y: -14, r: 12, h: 18, seed: 306 }, { x: 80, y: -10, r: 11, h: 16, seed: 307 },
      { x: -50, y: -18, r: 15, h: 40, seed: 308 }, { x: 50, y: -18, r: 15, h: 38, seed: 309 },
    ];
    parts.push(rockPart(back, rkS, rkT));
    parts.push(...rockFacets(back, rkT, sh(rkS, -0.35)));
    parts.push(layer((pe) => paintMoss(pe, back, 31, { amt: 0.4 })));
    // the carved face: a sheer wall dressed into a great portal
    const yF = -14;
    parts.push(box(0, yF - 5, 76, 10, 0, 50, sh(carved, -0.2), carved, { ao: 0.4 }));
    parts.push(box(0, yF - 2, 84, 4, 46, 52, sh(carved, -0.3), sh(carved, 0.1), { ao: 0.2 }));
    // steps up to the doors
    for (let i = 0; i < 3; i++) parts.push(box(0, yF + 3 + i * 3, 40 - i * 2, 3, 0, 3 - i, sh(carved, -0.25), sh(carved, 0.05), { ao: 0.3, bevel: false }));
    // two guardian statues
    const statue = (x) => [
      box(x, yF + 4, 12, 10, 0, 6, sh(carved, -0.3), carved, { ao: 0.3 }),
      box(x, yF + 4, 8, 6, 6, 18, sh(carved, -0.25), carved, { ao: 0.3, shape: (c, zt) => { const w = 4 + zt * 1.2; c.rect(x - w, yF + 1, w * 2, 6); } }),
      cyl(x, yF + 4, 6.2, 18, 32, sh(carved, -0.22), carved, { ao: 0.3 }),
      cyl(x, yF + 4, 3.6, 32, 38, sh(carved, -0.2), carved, { ao: 0.25 }),
      cyl(x, yF + 4, 4.3, 37, 40, sh(carved, -0.35), sh(carved, 0.12), { ao: 0.2 }),
      beams([[x + 7, yF + 6, 4, x + 7, yF + 6, 34]], 1.4, sh(carved, -0.3), carved),
      { z0: 30, z1: 37, side: sh(carved, -0.3), top: carved, ao: 0.2, bevel: false, shape: (c) => { c.moveTo(x + 4, yF + 4); c.lineTo(x + 11, yF + 2); c.lineTo(x + 11, yF + 8); c.closePath(); } },
    ];
    parts.push(...statue(-30), ...statue(30));
    // braziers
    for (const x of [-15, 15]) { parts.push(cyl(x, yF + 13, 1, 0, 6, '#3a3430', '#6a6460', { bevel: false })); parts.push(cyl(x, yF + 13, 2.6, 6, 8, '#4a4440', '#2a1a10', { bevel: false })); }
    parts.push(layer((pe, a) => {
      const y = yF + 0.02, c = pe.c;
      stones(pe, -38, 38, y, 0, 46, 61, { row: 3.2, w: 2.4, joint: 'rgba(40,34,28,0.35)' });
      // the doorway: a stepped frame, bronze doors with rune bands
      archRect(pe, sh(carved, -0.35), -14, 14, y, 0, 34, false);
      archRect(pe, '#120e0a', -12.5, 12.5, y, 0, 32.5, false);
      pe.wall(bronze, -11.5, -0.25, y, 0, 31.5); pe.wall(bronze, 0.25, 11.5, y, 0, 31.5);
      for (const z of [6, 15, 24]) { pe.wall(bronzeL, -11.5, 11.5, y, z, z + 1.2); }
      const gp = 0.55 + 0.45 * pulse(a);
      for (const z of [10.5, 19.5, 28.5]) for (let i = -10; i <= 9; i += 2.4) { pe.glow('#7ad8ff', i + 1.1, y, z, 1.4, 0.25 * gp); pe.lines('rgba(140,230,255,' + (0.5 + 0.4 * gp).toFixed(2) + ')', 0.35, [i, y, z - 1, i + 1.2, y, z + 1, i + 1.2, y, z + 1, i + 2.2, y, z - 1]); }
      for (const x of [-4, 4]) pe.dot('#f2c060', x, y, 15, 1.2);
      // lintel runes and a carved crown of mountains
      pe.wall(sh(carved, -0.15), -18, 18, y, 34, 38);
      for (let i = -15; i <= 14; i += 3) pe.lines('rgba(60,50,40,0.6)', 0.4, [i, y, 34.6, i + 1.5, y, 37.4, i + 1.5, y, 37.4, i + 3, y, 34.6]);
      pe.poly(sh(carved, -0.1), [-10, y, 38, -5, y, 44, 0, y, 39, 5, y, 46, 10, y, 38]);
      // brazier flames
      for (const x of [-15, 15]) { const f = 0.7 + 0.3 * Math.sin(a * TAU * 2 + x); pe.glow('#ffa040', x, yF + 13, 10, 7 * f, 0.55); pe.poly('#ff8a20', [x - 2, yF + 13, 8, x + 2, yF + 13, 8, x + 0.3, yF + 13, 8 + 5 * f]); pe.poly('#ffe080', [x - 1, yF + 13, 8, x + 1, yF + 13, 8, x, yF + 13, 8 + 3 * f]); }
      // beards and visors on the statues
      for (const x of [-30, 30]) { pe.poly(sh(carved, -0.18), [x - 3.4, yF + 10.3, 32, x + 3.4, yF + 10.3, 32, x, yF + 10.3, 22]); pe.wall('rgba(20,16,12,0.6)', x - 2.2, x + 2.2, yF + 7.7, 35, 35.8); }
    }));
    return { r: 80, h: 80, parts, style: 'prop', bevel: 0.7, spots: {} };
  };

  /* ======================================================== dw_hall */
  M.dw_hall = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), v = (opt.v | 0) % 2;
    const stone = mx(p.a, '#8a847a', 0.5), stoneT = mx(p.s, '#b4ae9e', 0.45), slate = '#4a4e56';
    const cols = { N: sh(slate, 0.28), W: sh(slate, 0.14), S: sh(slate, -0.04), E: sh(slate, -0.3) };
    const parts = [stain(30, 18, 0.32, '#1e1810', 0, 4)];
    if (v === 0) {
      parts.push(box(0, 0, 48, 24, 0, 2, sh(stone, -0.3), stoneT, { ao: 0.3 }));
      parts.push(box(0, 0, 44, 20, 2, 11, sh(stone, -0.12), stoneT, { ao: 0.35 }));
      const R = roof({ x: 0, y: 0, L: 24, W: 12, z: 11, H: 9, cols, fascia: 1.4 });
      parts.push(...R.parts);
      parts.push(box(14, -4, 5, 5, 14, 26, sh(stone, -0.15), stoneT, { ao: 0.2 }));
      parts.push(layer((pe) => {
        const y = 10.02;
        stones(pe, -22, 22, y, 2, 11, 71, { row: 2.4, w: 2.2, joint: 'rgba(30,26,22,0.4)' });
        door(pe, 0, y, 6, 8.4, '#5a3a24', { arch: true, frame: '#3a3430' });
        pe.wall('#c89a4a', -3.6, 3.6, y, 9.4, 10);
        for (const x of [-14, -7, 7, 14]) win(pe, x, y, 4, 2.2, 3, { g1: '#ffd890', g2: '#ff9a40', g3: '#c05020', frame: '#2a2420' });
        paintShingles(pe, R, 72, { col: slate, row: 1.4 });
        pe.glow('#ff9a40', 14, -4, 27, 5, 0.35);
      }));
      return { r: 28, h: 26, parts, style: 'prop', bevel: 0.6, spots: { smoke: [14, -4, 27] } };
    }
    // v1: the forge — a stone house open to the front on two great posts, a hearth inside
    parts.push(box(0, -3, 34, 18, 0, 10, sh(stone, -0.12), stoneT, { ao: 0.35, shape: (c) => { c.rect(-17, -12, 34, 4); c.rect(-17, -12, 4, 18); c.rect(13, -12, 4, 18); } }));
    parts.push(box(0, -2, 32, 16, 0, 0.6, '#2a2420', '#3a3430', { bevel: false }));
    for (const x of [-15, 15]) parts.push(cyl(x, 6, 1.6, 0, 10, '#4a3a2a', '#6a5440'));
    const R = roof({ x: 0, y: -3, L: 19, W: 11.5, z: 10, H: 7, cols, fascia: 1.2 });
    parts.push(...R.parts);
    parts.push(box(-9, -8, 7, 7, 0, 22, sh(stone, -0.15), stoneT, { ao: 0.3 }));
    parts.push(box(4, 0, 4, 2, 0, 3.2, '#2a2a2c', '#5a5a5e', { bevel: false }));
    parts.push(box(4, 0, 6, 2.4, 3.2, 4.4, '#3a3a3e', '#7a7a80', { bevel: false }));
    parts.push(layer((pe, a) => {
      const f = 0.75 + 0.25 * Math.sin(a * TAU * 3);
      pe.glow('#ff8a30', -9, -4.5, 3, 9 * f, 0.7); pe.ell('#ffcf6a', -9, -4.5, 2, 2.6 * f, 1.2);
      pe.glow('#ffa040', -9, -8, 23, 4, 0.4);
      paintShingles(pe, R, 73, { col: slate, row: 1.4 });
    }));
    return { r: 22, h: 22, parts, style: 'prop', bevel: 0.6, spots: { smoke: [-9, -8, 23] } };
  };

  /* ======================================================== hb_burrow */
  M.hb_burrow = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), v = (((opt.v | 0) % 4) + 4) % 4;
    const DOOR = ['#3a8a4a', '#e0b030', '#b03a2a', '#3a6ab0'][v];
    // a low, broad hill of pale turf (not a tree: flatter and lighter than any canopy), its front dug
    // away into a stone-faced cutting with the door
    const grass = ['#9cc25a', '#94ba52', '#a4c862', '#98be56'][v], grassT = sh(grass, 0.18);
    const R0 = 21 + v, H = 8 + (v % 2);
    const parts = [stain(R0 + 6, R0 * 0.6, 0.22, '#2a3018', 0, 3)];
    parts.push({ z0: 0, z1: H, side: sh(grass, -0.2), top: grassT, ao: 0.35, shape: (c, zt) => { const k = Math.pow(Math.max(0.02, 1 - zt * zt), 0.7); c.ellipse(0, -3, R0 * k, (R0 - 5) * k, 0, 0, TAU); } });
    parts.push(box(0, R0 - 7.5, 16, 5, 0, 8.5, '#8a8070', '#b8ae98', { ao: 0.3, bevel: false }));
    parts.push(cyl(R0 * 0.35, -6, 1.5, H - 3, H + 4, '#7a7060', '#a89c84', { ao: 0.2 }));
    parts.push(layer((pe) => {
      const y = R0 - 4.98, c = pe.c;
      stones(pe, -8, 8, y, 0, 8.5, 21 + v, { row: 1.6, w: 1.2 });
      // round door, brass knob, round windows with little shutters, a path and flowers
      c.beginPath(); c.arc(0, y - 4.2, 4.3, 0, TAU); c.fillStyle = '#5a5040'; c.fill();
      c.beginPath(); c.arc(0, y - 4.2, 3.6, 0, TAU); c.fillStyle = DOOR; c.fill();
      pe.lines('rgba(0,0,0,0.25)', 0.25, [-1.2, y, 1, -1.2, y, 7.4, 1.2, y, 1, 1.2, y, 7.4]);
      pe.dot('#f2d070', 0, y, 4.2, 0.55);
      for (const x of [-6, 6]) { const yy = y, zz = 5; c.beginPath(); c.arc(x, yy - zz, 1.7, 0, TAU); c.fillStyle = '#5a5040'; c.fill(); const g = c.createRadialGradient(x, yy - zz, 0, x, yy - zz, 1.4); g.addColorStop(0, '#fff2b8'); g.addColorStop(1, '#e09040'); c.beginPath(); c.arc(x, yy - zz, 1.35, 0, TAU); c.fillStyle = g; c.fill(); pe.lines('#4a3a2a', 0.25, [x - 1.35, yy, zz, x + 1.35, yy, zz, x, yy, zz - 1.35, x, yy, zz + 1.35]); }
      const r = rng(v + 11, 3);
      // turf ripples over the hill, a few flowers by the door
      for (let i = 1; i <= 3; i++) { const k = Math.pow(1 - Math.pow(i / 4, 2), 0.7); c.beginPath(); c.ellipse(0, -3 - (i / 4) * H, R0 * k, (R0 - 5) * k, 0, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = 'rgba(60,80,30,0.35)'; c.lineWidth = 0.5; c.stroke(); }
      for (let i = 0; i < 14; i++) pe.dot(['#e85a6a', '#f2d24a', '#f8f0f0', '#d06ad8', '#7ab0f0'][i % 5], r.range(-11, 11), R0 - 4.5 + r.range(0, 4), 0.4, 0.5);
      pe.poly('#b8a884', [-2.4, R0 - 5, 0, 2.4, R0 - 5, 0, 3.4, R0 + 6, 0, -3.4, R0 + 6, 0]);
    }));
    // a little garden: a fence and vegetable rows
    const gx = v % 2 ? -R0 - 4 : R0 + 4;
    parts.push(beams([[gx - 5, 2, 1.6, gx + 5, 2, 1.6], [gx - 5, 12, 1.6, gx + 5, 12, 1.6], [gx - 5, 2, 1.6, gx - 5, 12, 1.6], [gx + 5, 2, 1.6, gx + 5, 12, 1.6]], 0.45, '#6a5038', '#8a6a48'));
    parts.push({ z0: 0, z1: 1, side: '#3a6a2a', top: '#7ab04a', ao: 0.2, bevel: false, shape: (c) => { for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) S.circ(c, gx - 3 + k * 3, 4 + i * 2.4, 0.9); } });
    return { r: R0 + 6, h: H + 4, parts, style: 'prop', bevel: 0.6, spots: { smoke: [R0 * 0.35, -6, H + 4] } };
  };

  /* ======================================================== hr_pier (16 directions, along +x) */
  M.hr_pier = function (pal, opt) {
    const p = P(pal, opt), wood = mx(p.w, '#8a6a48', 0.4), woodT = sh(wood, 0.25), woodD = sh(wood, -0.35);
    const parts = [];
    const posts = [];
    for (let x = 4; x <= 70; x += 8) for (const y of [-5.5, 5.5]) posts.push([x, y, -3, x, y, 3.2]);
    parts.push(beams(posts, 1.2, woodD, wood));
    parts.push({ z0: 2.4, z1: 3.2, side: woodD, top: woodT, ao: 0.2, bevel: false, shape: (c) => c.rect(0, -6.5, 72, 13) });
    parts.push({ z0: 2.4, z1: 3.2, side: woodD, top: woodT, ao: 0.2, bevel: false, shape: (c) => c.rect(56, -6.5, 14, 26) });
    // bollards, crates, a little crane at the end
    for (const q of [[20, -6], [40, -6], [60, 18], [68, -6]]) parts.push(cyl(q[0], q[1], 0.9, 3.2, 5.4, '#3a3028', '#6a5a48', { bevel: false }));
    parts.push(box(10, 2, 5, 5, 3.2, 7.4, '#7a5a3a', '#a8845a', { ao: 0.3 }));
    parts.push(box(15, 3, 4, 4, 3.2, 6.4, '#6a4e32', '#9a7650', { ao: 0.3 }));
    parts.push(cyl(13, -3, 2, 3.2, 7, '#5a4430', '#8a6a48', { ao: 0.3 }));
    parts.push(beams([[64, 12, 3.2, 64, 12, 18], [64, 12, 18, 74, 12, 15]], 1, woodD, wood));
    parts.push(beams([[74, 12, 15, 74, 12, 8]], 0.25, '#2a2420', '#4a4440'));
    return { r: 40, h: 18, parts, style: 'prop', bevel: 0.4 };
  };

  /* ======================================================== hr_boat (16 directions, bow to +x) */
  M.hr_boat = function (pal, opt) {
    opt = opt || {};
    const p = P(pal, opt), v = (opt.v | 0) % 3;
    const hull = ['#6a4a30', '#3a4a5a', '#7a3a2a'][v], hullT = sh(hull, 0.3), sail = ['#e8dcc0', '#d8c8a0', '#c8b890'][v], stripe = ['#b8262a', '#3567b4', '#2f8a6a'][v];
    const L = 16 + v * 3, W = 5 + v;
    const hullShape = (c, zt) => { const k = 0.65 + 0.35 * zt; c.moveTo(L * k, 0); c.quadraticCurveTo(L * 0.4, -W * k, -L * 0.8 * k, -W * 0.8 * k); c.lineTo(-L * 0.9 * k, 0); c.lineTo(-L * 0.8 * k, W * 0.8 * k); c.quadraticCurveTo(L * 0.4, W * k, L * k, 0); c.closePath(); };
    const parts = [
      { z0: -1, z1: 3.6, side: sh(hull, -0.2), top: '#3a2a1c', ao: 0.3, shape: hullShape },
      { z0: 3.6, z1: 4.2, side: hullT, top: hullT, ao: 0.1, bevel: false, shape: (c) => { c.save(); c.lineWidth = 0.9; c.restore(); hullShape(c, 1); } },
      box(-L * 0.3, 0, 4, W * 1.2, 1, 3, '#4a3424', '#7a5a3a', { bevel: false }),
      cyl(L * 0.1, 0, 0.5, 3, 24, '#4a3a2a', '#6a5440', { bevel: false }),
      xzPart([[L * 0.1 - 0.5, 7, L * 0.1 - 0.5, 22, L * 0.1 - 10, 8]], 7, 22, sh(sail, -0.15), sail, { ox: 0, oy: 0, a: 0, v0: -0.3, v1: 0.3 }),
      xzPart([[L * 0.1 - 0.6, 13, L * 0.1 - 0.6, 15, L * 0.1 - 8.4, 9.6, L * 0.1 - 9, 8.4]], 8.4, 15, stripe, stripe, { ox: 0, oy: 0, a: 0, v0: -0.35, v1: 0.35 }),
    ];
    return { r: L, h: 24, parts, style: 'prop', bevel: 0.4 };
  };

  /* ======================================================== bd_stockade */
  M.bd_stockade = function (pal, opt) {
    const p = P(pal, opt), wood = mx(p.w, '#6a4a30', 0.4), woodT = sh(wood, 0.28), woodD = sh(wood, -0.35);
    const parts = [stain(70, 50, 0.28, '#2a2014', 0, 4)];
    const R = 62, stakes = [];
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TAU;
      if (Math.abs(U.wrapAngle(a - Math.PI / 2)) < 0.2) continue; // the gate faces south
      stakes.push([Math.cos(a) * R, Math.sin(a) * R * 0.82, U.hash2(i, 3, 9)]);
    }
    parts.push({ z0: 0, z1: 13, side: woodD, top: woodT, ao: 0.35, shape: (c, zt) => {
      for (const [x, y, h] of stakes) { const top = 10 + h * 2.5, z = zt * 13; if (z > top + 2) continue; const w = z > top ? 1.6 * (1 - (z - top) / 2) : 1.6; if (w > 0.15) S.circ(c, x, y, w); }
    } });
    parts.push(beams([[-9, R * 0.82 - 1, 0, -9, R * 0.82 - 1, 15], [9, R * 0.82 - 1, 0, 9, R * 0.82 - 1, 15], [-10, R * 0.82 - 1, 14, 10, R * 0.82 - 1, 14]], 1.8, woodD, wood));
    parts.push(layer((pe) => { const y = R * 0.82; for (const x of [-6, -2, 2, 6]) pe.dot('#e4dac0', x, y, 15.6, 1.1); pe.lines('rgba(30,20,10,0.6)', 0.3, [-7, y, 14.6, 7, y, 14.6]); }));
    return { r: R + 6, h: 15, parts, style: 'prop', bevel: 0.5 };
  };

  /* ======================================================== dg_dungeon */
  M.dg_dungeon = function (pal, opt) {
    const p = P(pal, opt);
    const rkS = mx(p.a, '#5e5a54', 0.5), rkT = mx(p.s, '#908a80', 0.5), carved = '#8a8478';
    const parts = [stain(46, 30, 0.38, '#14100c', 0, 4)];
    const rocks = [
      { x: -26, y: -14, r: 12, h: 18, seed: 401 }, { x: 24, y: -16, r: 13, h: 20, seed: 402 }, { x: 0, y: -26, r: 16, h: 24, seed: 403, n: 12, sx: 1.3 },
      { x: -34, y: 4, r: 6, h: 7, seed: 404 }, { x: 34, y: 2, r: 6, h: 6, seed: 405 },
    ];
    parts.push(rockPart(rocks, rkS, rkT));
    parts.push(...rockFacets(rocks, rkT, sh(rkS, -0.35)));
    parts.push(layer((pe) => paintMoss(pe, rocks, 41)));
    // the sunken stair: a dark pit edged in worn stone
    parts.push({ z0: -0.2, z1: 0.6, side: '#3a3630', top: '#7a746a', ao: 0.3, bevel: false, shape: (c) => c.rect(-10, -6, 20, 18) });
    parts.push(layer((pe) => {
      const c = pe.c, g = c.createLinearGradient(0, -6, 0, 10); g.addColorStop(0, '#040302'); g.addColorStop(1, '#2a2620');
      c.fillStyle = g; c.fillRect(-8, -5, 16, 14);
      for (let i = 0; i < 6; i++) { const y = 8 - i * 2.2; pe.wall('rgba(140,130,115,' + (0.55 - i * 0.08).toFixed(2) + ')', -8 + i * 0.4, 8 - i * 0.4, y, 0, 0.6); }
    }));
    // the portal: two pillars and a lintel with a skull keystone
    for (const x of [-11, 11]) parts.push(box(x, -6, 4, 4, 0, 16, sh(carved, -0.25), carved, { ao: 0.3 }));
    parts.push(box(0, -6, 28, 5, 16, 20, sh(carved, -0.25), sh(carved, 0.1), { ao: 0.2 }));
    for (const x of [-15.5, 15.5]) parts.push(cyl(x, -3, 0.5, 0, 10, '#3a3028', '#5a4a3a', { bevel: false }));
    parts.push(layer((pe, a) => {
      const y = -3.48;
      stones(pe, -13, 13, y, 16, 20, 43, { row: 2, w: 1.8 });
      pe.dot('#e8dcc0', 0, y, 18, 1.8); pe.dot('#1a1410', -0.7, y, 18.3, 0.45); pe.dot('#1a1410', 0.7, y, 18.3, 0.45); pe.wall('#e8dcc0', -0.9, 0.9, y, 16.2, 16.9);
      for (const x of [-15.5, 15.5]) { const f = 0.7 + 0.3 * Math.sin(a * TAU * 2 + x); pe.glow('#ff9a40', x, -3, 11, 6 * f, 0.6); pe.poly('#ff8a20', [x - 1.2, -3, 10, x + 1.2, -3, 10, x, -3, 10 + 3.4 * f]); }
      // a half-open iron gate
      pe.lines('#2a2826', 0.5, [-8, -5.9, 0, -8, -5.9, 14, -5, -5.9, 0, -5, -5.9, 14, -2, -5.9, 0, -2, -5.9, 14, -8.5, -5.9, 13, -1.5, -5.9, 13, -8.5, -5.9, 6, -1.5, -5.9, 6]);
    }));
    parts.push(layer((pe) => K.paintBones(pe, [[-18, 12, 'skull', 0, 1.1], [16, 14, 'bone', 0.5, 1.2], [21, 11, 'rib', 0.3, 1]], '#e4dac0')));
    return { r: 40, h: 26, parts, style: 'prop', bevel: 0.6, spots: {} };
  };

  (AS.Gallery = AS.Gallery || []).push({ group: 'The wider world', bg: 'neutral', items: [
    { name: 'abbey church', gen: 'ab_abbey', pal: 'neutral' },
    { name: 'dwarf gate', gen: 'dw_gate', pal: 'neutral', anims: 4 },
    { name: 'dwarf hall', gen: 'dw_hall', pal: 'neutral', opt: { v: 0 }, anims: 4 },
    { name: 'dwarf forge', gen: 'dw_hall', pal: 'neutral', opt: { v: 1 }, anims: 4 },
    { name: 'burrow v0', gen: 'hb_burrow', pal: 'neutral', opt: { v: 0 } },
    { name: 'burrow v1', gen: 'hb_burrow', pal: 'neutral', opt: { v: 1 } },
    { name: 'burrow v2', gen: 'hb_burrow', pal: 'neutral', opt: { v: 2 } },
    { name: 'burrow v3', gen: 'hb_burrow', pal: 'neutral', opt: { v: 3 } },
    { name: 'pier', gen: 'hr_pier', pal: 'neutral', dirs: 16 },
    { name: 'boat', gen: 'hr_boat', pal: 'neutral', dirs: 16 },
    { name: 'stockade', gen: 'bd_stockade', pal: 'neutral' },
    { name: 'dungeon', gen: 'dg_dungeon', pal: 'neutral', anims: 4 },
  ] });
})(window.AS);
