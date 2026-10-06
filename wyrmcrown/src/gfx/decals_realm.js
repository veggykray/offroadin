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
