/* WYRMCROWN — ground decals baked into terrain chunks (extends the shared
 * painter set in alien-strike/src/gfx/decals.js): town squares, crop fields,
 * pastures, graveyards and the realm's roads. Painters draw in chunk-local
 * world units and follow the top-left key light like every other decal. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;
  const P = AS.Decals.painters;
  const STONE = { human: ['#b4a892', '#8a7e6c'], elf: ['#b8b8a0', '#8a907a'], ice: ['#b8c4d2', '#8a9aae'], undead: ['#5a5460', '#3a3640'], neutral: ['#aca088', '#857a66'] };

  /* cobbled town square with a ring pattern and worn edges */
  P.plaza = (ctx, d, x, y, rng) => {
    const S = STONE[d.fk] || STONE.neutral, R = d.r;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.82);
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, C.str(S[0], 0.85)); g.addColorStop(0.72, C.str(S[0], 0.72)); g.addColorStop(1, C.str(S[1], 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    // cobbles in concentric courses
    ctx.strokeStyle = C.str(S[1], 0.55); ctx.lineWidth = 0.6;
    for (let r = 10; r < R * 0.85; r += 7) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      const n = Math.round(r * TAU / 8);
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = (i + (r % 14 ? 0.5 : 0)) / n * TAU; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 7), Math.sin(a) * (r + 7)); }
      ctx.stroke();
    }
    // lit and shaded speckle
    for (let i = 0; i < R * 3; i++) { const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * R * 0.85; ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,248,230,0.18)' : 'rgba(20,16,12,0.16)'; ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.5, 1.5); }
    ctx.restore();
  };

  /* the town's lanes: trampled ground between the house rows, the four
   * radial streets and a ring road inside the walls (d.lanes = angles) */
  const LANE = { human: ['#9a7a52', '#6a5034'], elf: ['#7e8a5a', '#56603a'], ice: ['#d4dce6', '#9aa8bc'], undead: ['#4c4450', '#2c2630'], neutral: ['#9a7a52', '#6a5034'] };
  P.lanes = (ctx, d, x, y, rng) => {
    const L = LANE[d.fk] || LANE.neutral;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.86);
    // worn ground under the houses
    const g = ctx.createRadialGradient(0, 0, 150, 0, 0, 350);
    g.addColorStop(0, C.str(L[0], 0)); g.addColorStop(0.25, C.str(L[0], 0.16)); g.addColorStop(0.8, C.str(L[0], 0.12)); g.addColorStop(1, C.str(L[0], 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 350, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    const ring = (r, w, a) => {
      ctx.strokeStyle = C.str(L[1], a * 0.6); ctx.lineWidth = w + 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = C.str(L[0], a); ctx.lineWidth = w; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    };
    ring(338, 14, d.fk === 'undead' ? 0.22 : 0.3);
    (d.lanes || []).forEach((a, li) => {
      const c = Math.cos(a), s = Math.sin(a), R = li === 0 ? 400 : 338;
      const al = d.fk === 'undead' ? 0.6 : 1;
      ctx.strokeStyle = C.str(L[1], 0.3 * al); ctx.lineWidth = 24;
      ctx.beginPath(); ctx.moveTo(c * 150, s * 150); ctx.lineTo(c * R, s * R); ctx.stroke();
      ctx.strokeStyle = C.str(L[0], 0.45 * al); ctx.lineWidth = 19;
      ctx.beginPath(); ctx.moveTo(c * 150, s * 150); ctx.lineTo(c * R, s * R); ctx.stroke();
      // cart ruts
      ctx.strokeStyle = C.str(L[1], 0.3 * al); ctx.lineWidth = 1.3;
      for (const o of [-5, 5]) { ctx.beginPath(); ctx.moveTo(c * 160 - s * o, s * 160 + c * o); ctx.lineTo(c * (R - 6) - s * o, s * (R - 6) + c * o); ctx.stroke(); }
    });
    // pebbles and tufts
    for (let i = 0; i < 260; i++) {
      const a = rng.next() * TAU, r = 160 + rng.next() * 190;
      ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,245,220,0.16)' : 'rgba(30,20,10,0.14)';
      ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.6, 1.6);
    }
    ctx.restore();
  };

  /* the town's streets: worn earth along each lane (d.streets = polylines
   * relative to the centre), cart ruts on the main street, cobbled patches at
   * the junctions and a faint trodden disc inside the walls */
  P.streets = (ctx, d, x, y, rng) => {
    const L = LANE[d.fk] || LANE.neutral, S = STONE[d.fk] || STONE.neutral, R = d.R || 392;
    ctx.save(); ctx.translate(x, y);
    const al = d.fk === 'undead' ? 0.7 : 1;
    // trodden ground inside the walls
    ctx.save(); ctx.scale(1, 0.86);
    const g = ctx.createRadialGradient(0, 0, 120, 0, 0, R);
    g.addColorStop(0, C.str(L[0], 0.14 * al)); g.addColorStop(0.75, C.str(L[0], 0.1 * al)); g.addColorStop(1, C.str(L[0], 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = (ln) => { ctx.beginPath(); ln.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); };
    (d.streets || []).forEach((ln, i) => {
      const main = i === 0, w = main ? 22 : 15;
      line(ln); ctx.strokeStyle = C.str(L[1], 0.32 * al); ctx.lineWidth = w + 4; ctx.stroke();
      line(ln); ctx.strokeStyle = C.str(L[0], 0.5 * al); ctx.lineWidth = w; ctx.stroke();
      if (main) {
        for (const o of [-5.5, 5.5]) {
          ctx.beginPath();
          for (let k = 0; k < ln.length; k++) { const a = ln[k], b = ln[Math.min(ln.length - 1, k + 1)], p = ln[Math.max(0, k - 1)]; const dx = b[0] - p[0], dy = b[1] - p[1], dl = Math.hypot(dx, dy) || 1; const px = a[0] - dy / dl * o, py = a[1] + dx / dl * o; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.strokeStyle = C.str(L[1], 0.35 * al); ctx.lineWidth = 1.4; ctx.stroke();
        }
      }
    });
    // cobbled patches where the lanes meet the ring, and at the gate
    const ring = (d.streets || [])[1];
    if (ring) for (let i = 2; i < (d.streets || []).length; i++) {
      const ln = d.streets[i], q = ln[0];
      ctx.fillStyle = C.str(S[0], 0.45 * al); ctx.beginPath(); ctx.ellipse(q[0], q[1], 16, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.str(S[1], 0.5 * al); ctx.lineWidth = 0.6;
      for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.ellipse(q[0] + rng.range(-10, 10), q[1] + rng.range(-7, 7), 2.2, 1.6, rng.next() * 3, 0, TAU); ctx.stroke(); }
    }
    const ga = d.gateA || 0, gr = d.gateR || 372, gx = Math.cos(ga) * gr, gy = Math.sin(ga) * gr * 0.86;
    ctx.fillStyle = C.str(S[0], 0.5 * al); ctx.beginPath(); ctx.ellipse(gx, gy, 24, 15, 0, 0, TAU); ctx.fill();
    // pebbles and tufts
    for (let i = 0; i < 220; i++) {
      const a = rng.next() * TAU, r = 160 + rng.next() * 220;
      ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,245,220,0.15)' : 'rgba(30,20,10,0.14)';
      ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r * 0.86, 1.6, 1.6);
    }
    ctx.restore();
  };

  /* what is left of a building: an ash-dark footprint, stubs of wall in the
   * faction's stone, charred beams and a heap of broken masonry */
  P.rubble = (ctx, d, x, y, rng) => {
    const R = d.r, pal = d.pal || {}, A = pal.a || '#7c6c5a', B = pal.b || '#bcac8c', D = pal.d || '#3a2b1f', W = pal.w || '#4a3020';
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.15);
    g.addColorStop(0, 'rgba(24,18,14,0.55)'); g.addColorStop(0.7, 'rgba(24,18,14,0.3)'); g.addColorStop(1, 'rgba(24,18,14,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.15, R * 0.85, 0, 0, TAU); ctx.fill();
    // wall stubs along the old footprint
    const n = 3 + (rng.next() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const a = rng.next() * TAU, r = R * (0.55 + rng.next() * 0.3), L = 8 + rng.next() * R * 0.5, h = 2.5 + rng.next() * 3;
      const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8, q = a + Math.PI / 2 + rng.range(-0.3, 0.3);
      ctx.save(); ctx.translate(px, py); ctx.rotate(q);
      ctx.fillStyle = C.str(C.shade(A, -0.35)); ctx.fillRect(-L / 2, -1.2, L, h + 1.2);
      ctx.fillStyle = C.str(A); ctx.fillRect(-L / 2, -h, L, h);
      ctx.fillStyle = C.str(B, 0.9); ctx.fillRect(-L / 2, -h, L, 1.2);
      ctx.restore();
    }
    // charred beams
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = rng.next() * TAU, r = rng.next() * R * 0.6, q = rng.next() * TAU, L = 6 + rng.next() * R * 0.6;
      const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8;
      ctx.strokeStyle = 'rgba(16,10,8,0.9)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(q) * L, py + Math.sin(q) * L * 0.8); ctx.stroke();
      ctx.strokeStyle = C.str(C.shade(W, 0.1), 0.8); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(q) * L * 0.7, py + Math.sin(q) * L * 0.56); ctx.stroke();
    }
    // broken masonry
    for (let i = 0; i < R * 1.3; i++) {
      const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * R * 0.95, px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8, s = 1.4 + rng.next() * 2.2;
      ctx.fillStyle = C.str(C.shade(A, -0.4), 0.8); ctx.fillRect(px + 0.6, py + 0.8, s, s * 0.8);
      ctx.fillStyle = C.str(rng.next() < 0.4 ? B : A); ctx.fillRect(px, py, s, s * 0.8);
      ctx.fillStyle = 'rgba(255,245,225,0.35)'; ctx.fillRect(px, py, s, s * 0.25);
    }
    // soot and a last few glowing coals
    for (let i = 0; i < 5; i++) { const a = rng.next() * TAU, r = rng.next() * R * 0.5; ctx.fillStyle = 'rgba(10,6,4,0.5)'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.8, 4 + rng.next() * 6, 2.5 + rng.next() * 4, a, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  const CROPS = {
    wheat: ['#d8b452', '#b8902e'], barley: ['#c8b46a', '#9a8a44'], green: ['#6a9a3a', '#4a7a2a'], plough: ['#7a5a3a', '#5a4028'], flax: ['#8aa0c8', '#6a8a58'],
    frost: ['#b8c8b0', '#8a9a88'], bone: ['#6a5e50', '#4a4038'],
  };
  /* a rectangular field of crop rows, rotated, with a darker furrowed border */
  P.field = (ctx, d, x, y, rng) => {
    const w = d.fw || 70, h = d.fh || 44, c = CROPS[d.crop] || CROPS.wheat;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, 0.86); ctx.rotate(d.rot || 0);
    ctx.fillStyle = C.str(C.shade(c[1], -0.25), 0.55); ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
    ctx.fillStyle = c[0]; ctx.fillRect(-w / 2, -h / 2, w, h);
    // rows
    ctx.strokeStyle = C.str(c[1], 0.85); ctx.lineWidth = 1.4;
    ctx.beginPath(); for (let i = -h / 2 + 3; i < h / 2; i += 4.5) { ctx.moveTo(-w / 2 + 1, i); ctx.lineTo(w / 2 - 1, i); } ctx.stroke();
    ctx.strokeStyle = C.str(C.shade(c[0], 0.25), 0.5); ctx.lineWidth = 0.8;
    ctx.beginPath(); for (let i = -h / 2 + 5; i < h / 2; i += 4.5) { ctx.moveTo(-w / 2 + 1, i); ctx.lineTo(w / 2 - 1, i); } ctx.stroke();
    // patchy growth
    for (let i = 0; i < 10; i++) { ctx.fillStyle = C.str(rng.next() < 0.5 ? C.shade(c[0], 0.15) : C.shade(c[1], -0.1), 0.35); ctx.beginPath(); ctx.ellipse((rng.next() - 0.5) * w, (rng.next() - 0.5) * h, 4 + rng.next() * 8, 3 + rng.next() * 4, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  /* fenced pasture: lusher grass inside a ring of fence posts */
  P.pasture = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y);
    const snow = d.fk === 'ice', dead = d.fk === 'undead';
    ctx.fillStyle = snow ? 'rgba(200,215,200,0.35)' : dead ? 'rgba(80,72,60,0.35)' : 'rgba(120,170,70,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.72, 0, 0, TAU); ctx.fill();
    // trampled earth near the trough
    ctx.fillStyle = 'rgba(90,70,45,0.35)'; ctx.beginPath(); ctx.ellipse(R * 0.3, R * 0.1, R * 0.25, R * 0.15, 0, 0, TAU); ctx.fill();
    // fence: rails and posts with a lit top-left side
    const n = Math.round(R * 0.45);
    ctx.strokeStyle = dead ? '#3a3028' : '#6a4a2a'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.72, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = dead ? '#5a4a3a' : '#a07848'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(0, -1, R, R * 0.72, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU; if (Math.abs(U.wrapAngle(a - 0.4)) < 0.2) continue;
      const px = Math.cos(a) * R, py = Math.sin(a) * R * 0.72;
      ctx.fillStyle = dead ? '#2a2018' : '#4a3018'; ctx.fillRect(px - 0.8, py - 3, 1.6, 4);
      ctx.fillStyle = dead ? '#6a5a48' : '#b08a58'; ctx.fillRect(px - 0.8, py - 3, 0.8, 1);
    }
    ctx.restore();
  };

  /* a graveyard patch for the blight towns */
  P.graveyard = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(40,36,44,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.7, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < R * 0.5; i++) {
      const px = (rng.next() - 0.5) * R * 1.6, py = (rng.next() - 0.5) * R * 1.1;
      if (px * px / (R * R) + py * py / (R * R * 0.49) > 0.85) continue;
      ctx.fillStyle = '#6a6470'; ctx.fillRect(px - 1.5, py - 4, 3, 4);
      ctx.fillStyle = '#9a94a0'; ctx.fillRect(px - 1.5, py - 4, 3, 1);
      ctx.fillStyle = 'rgba(20,16,24,0.5)'; ctx.fillRect(px - 2, py, 4, 2);
    }
    ctx.restore();
  };

  /* a snowdrift banked against a building or rock in the north: a soft white
   * mound on the windward (north-west) side and a blue shadow hollow in the lee */
  P.drift = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(248,252,255,0.55)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-R * 0.25 + rng.range(-R * 0.2, R * 0.2), -R * 0.1 + rng.range(-R * 0.15, R * 0.15), R * (0.6 + rng.next() * 0.3), R * (0.25 + rng.next() * 0.12), rng.range(-0.3, 0.3), 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(110,140,190,0.2)';
    ctx.beginPath(); ctx.ellipse(R * 0.4, R * 0.25, R * 0.7, R * 0.3, 0.2, 0, TAU); ctx.fill();
    // wind-scoured ridges
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { const yy = -R * 0.3 + i * R * 0.14; ctx.beginPath(); ctx.moveTo(-R * 0.9, yy + rng.range(-2, 2)); ctx.quadraticCurveTo(-R * 0.3, yy - 3, R * 0.3, yy + rng.range(-2, 2)); ctx.stroke(); }
    ctx.restore();
  };

  /* trampled ground around a hamlet or a camp: worn earth with a few paths */
  P.trample = (ctx, d, x, y, rng) => {
    const L = LANE[d.fk] || LANE.neutral, R = d.r;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.84);
    const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, C.str(L[0], 0.3)); g.addColorStop(0.6, C.str(L[0], 0.18)); g.addColorStop(1, C.str(L[0], 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.str(L[1], 0.22); ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = rng.next() * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a + 0.4) * R * 0.5, Math.sin(a + 0.4) * R * 0.5, Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95); ctx.stroke(); }
    for (let i = 0; i < R * 1.2; i++) { const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * R * 0.9; ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,245,220,0.14)' : 'rgba(30,20,10,0.14)'; ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.5, 1.5); }
    ctx.restore();
  };

  /* an old battlefield: churned dark ground, scorched patches, arrows and broken shields in the grass */
  P.battlefield = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.8);
    const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, 'rgba(70,52,34,0.5)'); g.addColorStop(0.7, 'rgba(70,52,34,0.28)'); g.addColorStop(1, 'rgba(70,52,34,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) { const a = rng.next() * TAU, r = rng.next() * R * 0.8, rr = 8 + rng.next() * 14; const sg = ctx.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, rr); sg.addColorStop(0, 'rgba(20,14,10,0.55)'); sg.addColorStop(1, 'rgba(20,14,10,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, rr, 0, TAU); ctx.fill(); }
    // arrows stuck in the ground, dropped weapons, a few shields
    ctx.lineCap = 'round';
    for (let i = 0; i < R * 0.5; i++) {
      const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * R * 0.95, px = Math.cos(a) * r, py = Math.sin(a) * r, q = rng.next() * TAU;
      ctx.strokeStyle = 'rgba(60,40,24,0.85)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(q) * 5, py + Math.sin(q) * 5); ctx.stroke();
      if (rng.next() < 0.25) { ctx.fillStyle = rng.next() < 0.5 ? 'rgba(170,40,40,0.8)' : 'rgba(120,130,140,0.85)'; ctx.beginPath(); ctx.ellipse(px + 4, py - 3, 3.2, 2.4, q, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(30,20,10,0.7)'; ctx.lineWidth = 0.5; ctx.stroke(); }
      else if (rng.next() < 0.3) { ctx.strokeStyle = 'rgba(200,205,210,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(px - 2, py + 2); ctx.lineTo(px + 4, py - 4); ctx.stroke(); }
    }
    ctx.restore();
  };

  /* bones scattered on the ground around a great skeleton or a skull */
  P.bonefield = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.82);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(150,140,110,0.25)'); g.addColorStop(1, 'rgba(150,140,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < R * 0.9; i++) {
      const a = rng.next() * TAU, r = Math.sqrt(rng.next()) * R, px = Math.cos(a) * r, py = Math.sin(a) * r, q = rng.next() * TAU, L = 2 + rng.next() * 5;
      ctx.strokeStyle = 'rgba(60,50,36,0.5)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(px + 0.6, py + 0.6); ctx.lineTo(px + Math.cos(q) * L + 0.6, py + Math.sin(q) * L + 0.6); ctx.stroke();
      ctx.strokeStyle = 'rgba(236,228,200,0.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(q) * L, py + Math.sin(q) * L); ctx.stroke();
    }
    ctx.restore();
  };

  /* a fairy ring: a circle of small mushrooms in darker, richer grass */
  P.fairyring = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.8);
    const g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R);
    g.addColorStop(0, 'rgba(40,90,50,0.0)'); g.addColorStop(0.8, 'rgba(40,90,50,0.35)'); g.addColorStop(1, 'rgba(40,90,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    const n = Math.round(R * 0.55);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rng.range(-0.1, 0.1), r = R * 0.82 + rng.range(-3, 3), px = Math.cos(a) * r, py = Math.sin(a) * r, s = 1.2 + rng.next() * 1.2;
      ctx.fillStyle = 'rgba(20,30,16,0.45)'; ctx.beginPath(); ctx.ellipse(px + 0.8, py + 1, s * 1.1, s * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rng.next() < 0.3 ? '#d8c8f0' : '#f0e6d0'; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(px - s * 0.3, py - s * 0.3, s * 0.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* a pool of standing water: a forest pool (clear) or a bog pool (scummed and dark) */
  P.swamppool = (ctx, d, x, y, rng) => {
    const R = d.r, clear = !!d.clear;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.72);
    const rim = (k, col, a) => { ctx.fillStyle = C.str(col, a); ctx.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20 * TAU, rr = R * k * (1 + 0.12 * Math.sin(t * 3 + d.seed) + 0.06 * Math.sin(t * 7 + 1)); i ? ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr); } ctx.closePath(); ctx.fill(); };
    rim(1.28, clear ? '#3a5a2a' : '#2a2a1e', 0.5); // the muddy bank
    rim(1.0, clear ? '#1e4a52' : '#1a2420', 0.95);
    rim(0.72, clear ? '#2a6a70' : '#26322a', 0.85);
    if (!clear) { ctx.fillStyle = 'rgba(90,120,60,0.45)'; for (let i = 0; i < 8; i++) { const a = rng.next() * TAU, r = rng.next() * R * 0.8; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 3 + rng.next() * 6, 2 + rng.next() * 3, a, 0, TAU); ctx.fill(); } }
    // the sky in the water
    ctx.fillStyle = clear ? 'rgba(200,236,240,0.35)' : 'rgba(170,190,180,0.18)';
    ctx.beginPath(); ctx.ellipse(-R * 0.25, -R * 0.2, R * 0.35, R * 0.16, -0.4, 0, TAU); ctx.fill();
    if (clear) { ctx.fillStyle = '#3f8a3a'; for (let i = 0; i < 5; i++) { const a = rng.next() * TAU, r = rng.next() * R * 0.7; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.6, 0.3, TAU - 0.3); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.fill(); } }
    ctx.restore();
  };

  /* roads: lay every map road as a static decal (dirt, cobbles or snowy track by region) */
  AS.Roads = {
    lay(g) {
      const T = g.terrain;
      for (const pts of T.roadLines) {
        // split into runs by region so each stretch gets its own surface
        let run = [pts[0]], cur = this.surface(T, pts[0]);
        const flush = (col) => { if (run.length > 1) T.addDecal('road', run[0][0], run[0][1], 28, col, { static: true, pts: run.slice(), w: 28, seed: 7 }); };
        for (let i = 1; i < pts.length; i++) {
          const s = this.surface(T, pts[i]);
          run.push(pts[i]);
          if (s !== cur) { flush(cur); run = [pts[i]]; cur = s; }
        }
        flush(cur);
      }
    },
    surface(T, p) {
      const b = T.biomeKey(p[0], p[1]);
      return b === 'ice' ? '#d8dee6' : b === 'undead' ? '#5e5650' : b === 'elf' ? '#a8987a' : b === 'human' ? '#b09a74' : '#a8946c';
    },
  };
})(window.AS);
