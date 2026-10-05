/* ALIEN STRIKE — ground decals baked into terrain chunks.
 * Every painter draws in chunk-local world units (the caller sets up the
 * transform) and follows the terrain's top-left key light: walls facing the
 * light get a warm highlight, walls facing away get the shadow. Decals are
 * deterministic from their seed, so a chunk that is evicted and regenerated
 * repaints identically. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;
  const LX = -0.7071, LY = -0.7071; // light direction (from the top-left)

  const dark = (a) => 'rgba(16,11,9,' + a + ')';
  const lite = (a) => 'rgba(255,238,210,' + a + ')';

  function soft(ctx, x, y, rx, ry, col, a0, a1) {
    // soft-edged ellipse (radial gradient squashed by the 3/4 view)
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, C.str(col, a0)); g.addColorStop(0.55, C.str(col, (a0 + a1) / 2)); g.addColorStop(1, C.str(col, a1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* lumpy closed outline around (x, y) */
  function blobPath(ctx, x, y, rx, ry, rng, n, k) {
    n = n || 14; k = k === undefined ? 0.22 : k;
    const off = [];
    for (let i = 0; i < n; i++) off.push(1 - k / 2 + rng.next() * k);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, o = off[i % n];
      const px = x + Math.cos(a) * rx * o, py = y + Math.sin(a) * ry * o;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /* bowl: shadowed inner wall on the light side, lit inner wall opposite, raised rim */
  function bowl(ctx, x, y, R, rng, depth, rim) {
    const ry = R * 0.78, sh = R * 0.22;
    ctx.save();
    ctx.beginPath(); blobPath(ctx, x, y, R, ry, rng, 16, 0.12);
    ctx.clip();
    ctx.fillStyle = dark(0.18 * depth); ctx.fill();
    // inner shadow crescent (top-left inner wall faces away from the light)
    ctx.beginPath(); ctx.ellipse(x, y, R * 1.05, ry * 1.05, 0, 0, TAU); ctx.ellipse(x + sh, y + sh * 0.8, R, ry, 0, 0, TAU);
    ctx.fillStyle = dark(0.42 * depth); ctx.fill('evenodd');
    // lit crescent (bottom-right inner wall faces the light)
    ctx.beginPath(); ctx.ellipse(x, y, R * 1.05, ry * 1.05, 0, 0, TAU); ctx.ellipse(x - sh * 0.8, y - sh * 0.6, R, ry, 0, 0, TAU);
    ctx.fillStyle = lite(0.2 * depth); ctx.fill('evenodd');
    ctx.restore();
    if (rim) {
      // outer rim: lit toward the light, dark away from it
      ctx.lineWidth = Math.max(1, R * 0.09);
      ctx.strokeStyle = lite(0.22 * rim);
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.06, ry * 1.06, 0, Math.PI * 0.95, Math.PI * 1.75); ctx.stroke();
      ctx.strokeStyle = dark(0.3 * rim);
      ctx.beginPath(); ctx.ellipse(x, y, R * 1.08, ry * 1.08, 0, -0.1, Math.PI * 0.75); ctx.stroke();
    }
  }

  function rays(ctx, x, y, r0, r1, n, rng, col, a) {
    for (let i = 0; i < n; i++) {
      const ang = rng.next() * TAU, len = r0 + (r1 - r0) * (0.4 + rng.next() * 0.6), w = r0 * (0.08 + rng.next() * 0.1);
      const c = Math.cos(ang), s = Math.sin(ang) * 0.78;
      const g = ctx.createLinearGradient(x + c * r0 * 0.6, y + s * r0 * 0.6, x + c * len, y + s * len);
      g.addColorStop(0, C.str(col, a)); g.addColorStop(1, C.str(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + c * r0 * 0.6 - s * w, y + s * r0 * 0.6 + c * w * 0.78);
      ctx.lineTo(x + c * len, y + s * len);
      ctx.lineTo(x + c * r0 * 0.6 + s * w, y + s * r0 * 0.6 - c * w * 0.78);
      ctx.closePath(); ctx.fill();
    }
  }

  function flecks(ctx, x, y, r0, r1, n, rng, cols) {
    for (let i = 0; i < n; i++) {
      const a = rng.next() * TAU, rr = r0 + rng.next() * (r1 - r0), s = 0.6 + rng.next() * 1.4;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.78;
      ctx.fillStyle = dark(0.35); ctx.fillRect(px + 0.4, py + 0.4, s, s * 0.8);
      ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(px, py, s, s * 0.8);
    }
  }

  const P = {};

  P.scorch = (ctx, d, x, y, rng) => {
    const R = d.r;
    soft(ctx, x, y, R * 1.1, R * 0.86, [18, 12, 10], 0.34, 0);
    for (let i = 0; i < 7; i++) {
      const a = rng.next() * TAU, rr = R * (0.2 + rng.next() * 0.55);
      soft(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78, R * (0.3 + rng.next() * 0.35), R * (0.22 + rng.next() * 0.25), [14, 10, 8], 0.22, 0);
    }
    rays(ctx, x, y, R * 0.45, R * 1.3, 12, rng, [14, 10, 8], 0.12);
    soft(ctx, x, y, R * 0.4, R * 0.32, [8, 6, 6], 0.36, 0);
    flecks(ctx, x, y, R * 0.3, R * 1.2, Math.round(R * 0.5), rng, ['rgba(30,24,20,0.8)', 'rgba(110,96,80,0.6)']);
  };

  P.crater = (ctx, d, x, y, rng) => {
    const R = d.r;
    soft(ctx, x, y, R * 1.2, R * 0.95, [18, 12, 10], 0.36, 0);
    for (let i = 0; i < 6; i++) {
      const a = rng.next() * TAU, rr = R * (0.3 + rng.next() * 0.5);
      soft(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78, R * (0.3 + rng.next() * 0.3), R * (0.22 + rng.next() * 0.2), [14, 10, 8], 0.2, 0);
    }
    rays(ctx, x, y, R * 0.5, R * 1.35, 12, rng, [14, 10, 8], 0.12);
    bowl(ctx, x, y, R * 0.5, rng, 1, 1);
    flecks(ctx, x, y, R * 0.5, R * 1.25, Math.round(R * 0.7), rng, ['rgba(30,24,20,0.85)', 'rgba(120,104,88,0.7)', 'rgba(70,60,52,0.8)']);
  };
  /* old impact crater: pale ejecta, broad bowl, central mound, rocks on the rim */
  P.craterbig = (ctx, d, x, y, rng) => {
    const R = d.r;
    soft(ctx, x, y, R * 1.7, R * 1.35, [255, 236, 200], 0.14, 0);
    rays(ctx, x, y, R * 1.05, R * 2.1, 12, rng, [255, 236, 200], 0.1);
    bowl(ctx, x, y, R, rng, 1.25, 1.4);
    soft(ctx, x - R * 0.06, y - R * 0.05, R * 0.24, R * 0.18, [255, 238, 210], 0.14, 0);
    soft(ctx, x + R * 0.05, y + R * 0.05, R * 0.24, R * 0.18, [16, 11, 9], 0.16, 0);
    // fracture arcs on the floor
    ctx.strokeStyle = dark(0.2); ctx.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) {
      const a = rng.next() * TAU, rr = R * (0.3 + rng.next() * 0.45);
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.78, 0, a, a + 0.5 + rng.next() * 0.8); ctx.stroke();
    }
    flecks(ctx, x, y, R * 0.95, R * 1.45, Math.round(R * 0.6), rng, ['rgba(60,50,44,0.85)', 'rgba(150,132,112,0.8)']);
  };

  /* skid furrow ploughed by a crash: d.len along d.ang, width d.w, ends in a heap */
  P.trench = (ctx, d, x, y, rng) => {
    const len = d.len || d.r * 3, w = d.w || 24, ang = d.ang || 0;
    ctx.save(); ctx.translate(x, y);
    // project the 3/4 view: rotate in ground space, squash y
    ctx.scale(1, 0.78); ctx.rotate(ang);
    // furrow from x = -len (start, thin) to 0 (end, wide)
    const N = 18, ph = (d.seed % 997) * 0.01;
    const half = (t) => w * (0.25 + 0.75 * t) * (0.9 + 0.2 * Math.sin(t * 9 + ph));
    const edge = (side) => { const pts = []; for (let i = 0; i <= N; i++) { const t = i / N; pts.push([-len + t * len, side * half(t) + Math.sin(t * 13 + ph * 3) * w * 0.08]); } return pts; };
    const top = edge(-1), bot = edge(1);
    // berms of thrown soil (lighter) either side
    ctx.fillStyle = lite(0.09);
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - w * 0.18) : ctx.moveTo(p[0], p[1] - w * 0.18))); for (let i = N; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1] + w * 0.18); ctx.closePath(); ctx.fill();
    // the gouge
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); for (let i = N; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]); ctx.closePath();
    ctx.fillStyle = dark(0.34); ctx.fill();
    // wall lighting depends on which side faces the light in world space
    const nx = -Math.sin(ang), ny = Math.cos(ang); // +y side normal in world space
    const litPlus = (nx * LX + ny * LY) < 0; // the +y inner wall faces back toward the light
    ctx.save(); ctx.clip();
    ctx.lineWidth = w * 0.35;
    ctx.strokeStyle = litPlus ? lite(0.18) : dark(0.3);
    ctx.beginPath(); bot.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    ctx.strokeStyle = litPlus ? dark(0.3) : lite(0.18);
    ctx.beginPath(); top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    // drag scratches along the floor
    ctx.lineWidth = 0.6; ctx.strokeStyle = dark(0.35);
    for (let i = 0; i < 6; i++) { const o = (rng.next() - 0.5) * w * 0.9; ctx.beginPath(); ctx.moveTo(-len * (0.2 + rng.next() * 0.6), o * 0.4); ctx.lineTo(-rng.next() * len * 0.15, o); ctx.stroke(); }
    ctx.restore();
    // scorching along the trail, heaviest at the end
    for (let i = 0; i < 9; i++) { const t = 0.35 + rng.next() * 0.65; soft(ctx, -len + t * len, (rng.next() - 0.5) * w, w * (0.4 + t * 0.6), w * (0.4 + t * 0.6), [14, 10, 8], 0.18 * t, 0); }
    // ploughed soil heaped at the end of the furrow: lumps lit on the light side
    for (let i = 0; i < 14; i++) {
      const lx = w * (0.1 + rng.next() * 0.5), ly = (rng.next() - 0.5) * w * 1.6, lr = w * (0.08 + rng.next() * 0.12);
      ctx.fillStyle = dark(0.22); ctx.beginPath(); ctx.ellipse(lx + lr * 0.3, ly + lr * 0.3, lr, lr * 0.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = lite(0.12); ctx.beginPath(); ctx.ellipse(lx - lr * 0.2, ly - lr * 0.2, lr * 0.7, lr * 0.55, 0, 0, TAU); ctx.fill();
    }
    // thrown debris
    for (let i = 0; i < 28; i++) {
      const t = rng.next(), side = rng.next() < 0.5 ? -1 : 1, o = side * (half(t) + rng.next() * w * 0.9);
      const s = 0.6 + rng.next() * 1.6;
      ctx.fillStyle = rng.next() < 0.5 ? 'rgba(40,34,30,0.8)' : 'rgba(150,136,120,0.7)';
      ctx.fillRect(-len + t * len, o, s, s);
    }
    ctx.restore();
  };

  /* worn paved plaza of stone slabs (ruins, old colony squares): concentric
   * courses, many slabs missing or buried, sand drifted across, lit edges */
  P.plaza = (ctx, d, x, y, rng) => {
    const R = d.r, col = C.hex(d.col || '#9a8c78');
    soft(ctx, x, y, R * 1.1, R * 0.88, [16, 11, 9], 0.14, 0);
    const rings = Math.max(2, Math.round(R / 26));
    for (let k = 0; k < rings; k++) {
      const r0 = (k / rings) * R, r1 = ((k + 1) / rings) * R;
      const n = k === 0 ? 1 : Math.round(5 + k * 4);
      const rotK = rng.next() * TAU;
      // outer courses are more broken
      const lose = 0.1 + Math.pow(k / rings, 1.5) * 0.75;
      for (let i = 0; i < n; i++) {
        if (rng.next() < lose) continue;
        const a0 = (i / n) * TAU + rotK, a1 = ((i + 1) / n) * TAU + rotK - 0.07;
        const tone = 0.78 + rng.next() * 0.3, dx = (rng.next() - 0.5) * 1.6, dy = (rng.next() - 0.5) * 1.2;
        const g0 = r0 + 1.1, g1 = r1 - 1.1 - rng.next() * 2;
        const path = () => {
          ctx.beginPath();
          if (k === 0) ctx.ellipse(x + dx, y + dy, g1, g1 * 0.78, 0, 0, TAU);
          else { ctx.ellipse(x + dx, y + dy, g1, g1 * 0.78, 0, a0, a1); ctx.ellipse(x + dx, y + dy, g0, g0 * 0.78, 0, a1, a0, true); ctx.closePath(); }
        };
        // slab thickness: a dark sliver below, the stone face, a lit top-left lip
        ctx.save(); ctx.translate(0.7, 0.9); path(); ctx.fillStyle = dark(0.3); ctx.fill(); ctx.restore();
        const dust0 = d.dust || [168, 120, 80], m = 0.15 + rng.next() * 0.35;
        path(); ctx.fillStyle = C.str([(col[0] * (1 - m) + dust0[0] * m) * tone, (col[1] * (1 - m) + dust0[1] * m) * tone, (col[2] * (1 - m) + dust0[2] * m) * tone], 0.45 + rng.next() * 0.3); ctx.fill();
        ctx.save(); ctx.translate(-0.4, -0.4); path(); ctx.strokeStyle = lite(0.14); ctx.lineWidth = 0.5; ctx.stroke(); ctx.restore();
      }
    }
    // inlaid glyph ring
    if (d.glyph !== false) {
      ctx.strokeStyle = C.str(d.glyphCol || [176, 124, 255], 0.35); ctx.lineWidth = 1;
      ctx.setLineDash([6, 4, 2, 4]);
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.42, R * 0.42 * 0.78, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    // sand drifted over the paving
    const dust = d.dust || [168, 120, 80];
    for (let i = 0; i < 14; i++) { const a = rng.next() * TAU, rr = R * (0.35 + rng.next() * 0.75); soft(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78, R * (0.22 + rng.next() * 0.3), R * (0.14 + rng.next() * 0.18), C.shade(dust, 0.06), 0.85, 0); }
    // cracks
    ctx.strokeStyle = dark(0.4); ctx.lineWidth = 0.5;
    for (let i = 0; i < 7; i++) { let px = x + (rng.next() - 0.5) * R * 1.2, py = y + (rng.next() - 0.5) * R * 0.9; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (rng.next() - 0.5) * 14; py += (rng.next() - 0.5) * 10; ctx.lineTo(px, py); } ctx.stroke(); }
  };

  /* concrete or packed-earth pad under a structure, with ambient occlusion */
  P.foundation = (ctx, d, x, y, rng) => {
    const R = d.r;
    soft(ctx, x, y + R * 0.06, R * 1.25, R * 0.95, [12, 9, 8], 0.4, 0);
    if (d.slab) {
      const col = C.hex(d.slab), w = R * 1.6, h = R * 1.15;
      ctx.fillStyle = C.str(col, 0.55);
      ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
      ctx.strokeStyle = dark(0.35); ctx.lineWidth = 0.7;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - w / 2 + (w * i) / 4, y - h / 2); ctx.lineTo(x - w / 2 + (w * i) / 4, y + h / 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
      ctx.strokeStyle = lite(0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y - h / 2); ctx.lineTo(x + w / 2, y - h / 2); ctx.stroke();
      ctx.strokeStyle = dark(0.4); ctx.beginPath(); ctx.moveTo(x + w / 2, y - h / 2); ctx.lineTo(x + w / 2, y + h / 2); ctx.lineTo(x - w / 2, y + h / 2); ctx.stroke();
      for (let i = 0; i < 4; i++) soft(ctx, x + (rng.next() - 0.5) * w * 0.8, y + (rng.next() - 0.5) * h * 0.8, R * 0.25, R * 0.18, [20, 16, 12], 0.25, 0);
    }
  };

  /* organic creep / contamination spreading from a source */
  P.creep = (ctx, d, x, y, rng) => {
    const R = d.r, col = C.hex(d.col || '#5a2a6a'), glow = C.hex(d.glow || '#e05aff');
    for (let i = 0; i < 6; i++) {
      const a = rng.next() * TAU, rr = R * rng.next() * 0.55;
      ctx.beginPath(); blobPath(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78, R * (0.35 + rng.next() * 0.4), R * (0.3 + rng.next() * 0.3), rng, 12, 0.5);
      ctx.fillStyle = C.str(col, 0.32); ctx.fill();
    }
    // veins radiating outward
    ctx.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
      let a = rng.next() * TAU, px = x, py = y, w = 2.4;
      ctx.beginPath(); ctx.moveTo(px, py);
      const steps = 6 + (rng.next() * 5 | 0);
      for (let j = 0; j < steps; j++) { a += (rng.next() - 0.5) * 0.8; const st = R * (0.12 + rng.next() * 0.1); px += Math.cos(a) * st; py += Math.sin(a) * st * 0.78; ctx.lineTo(px, py); }
      ctx.strokeStyle = C.str(C.shade(col, -0.3), 0.6); ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = C.str(glow, 0.22); ctx.lineWidth = w * 0.35; ctx.stroke();
    }
    for (let i = 0; i < R * 0.25; i++) {
      const a = rng.next() * TAU, rr = R * rng.next() * 0.9, s = 0.8 + rng.next() * 1.4;
      ctx.fillStyle = C.str(glow, 0.5); ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78, s, 0, TAU); ctx.fill();
    }
  };

  /* compacted haul road along a polyline (d.pts, world coords), width d.w */
  P.road = (ctx, d, x, y, rng, ox, oy) => {
    const pts = d.pts, w = d.w || 30, col = C.hex(d.col || '#a08a6c');
    if (!pts || pts.length < 2) return;
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0] - ox, pts[0][1] - oy); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] - ox, pts[i][1] - oy); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path();
    ctx.strokeStyle = dark(0.12); ctx.lineWidth = w * 1.35; ctx.stroke();
    ctx.strokeStyle = C.str(col, 0.42); ctx.lineWidth = w; ctx.stroke();
    ctx.strokeStyle = C.str(C.shade(col, 0.18), 0.3); ctx.lineWidth = w * 0.55; ctx.stroke();
    // wheel ruts: offset copies of the centre line
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        const px = pts[i][0] - ox - (dy / L) * side * w * 0.24, py = pts[i][1] - oy + (dx / L) * side * w * 0.24;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = dark(0.24); ctx.lineWidth = w * 0.12; ctx.stroke();
    }
  };

  P.splat = (ctx, d, x, y, rng) => {
    const c = C.hex(d.col || '#6a8a2a'), R = d.r;
    soft(ctx, x, y, R * 0.9, R * 0.7, c, 0.35, 0);
    for (let i = 0; i < 12; i++) {
      const a = rng.next() * TAU, rr = rng.next() * R;
      ctx.fillStyle = C.str(C.shade(c, -0.15), 0.4 + rng.next() * 0.3);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.78, 0.8 + rng.next() * R * 0.22, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = C.str(C.shade(c, 0.4), 0.35);
    for (let i = 0; i < 4; i++) { const a = rng.next() * TAU, rr = rng.next() * R * 0.6; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr - 0.5, y + Math.sin(a) * rr * 0.78 - 0.5, 0.7, 0, TAU); ctx.fill(); }
  };

  P.wreck = (ctx, d, x, y, rng) => { soft(ctx, x, y, d.r, d.r * 0.7, [10, 8, 8], 0.4, 0); };

  /* bounds of a decal in world units (for chunk registration) */
  function bounds(d) {
    if (d.kind === 'road' && d.pts) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of d.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const m = (d.w || 30);
      return [x0 - m, y0 - m, x1 + m, y1 + m];
    }
    let r = d.r;
    if (d.kind === 'craterbig') r *= 2.2;
    else if (d.kind === 'trench') r = (d.len || d.r * 3) + (d.w || 24) * 2;
    else r *= 1.45;
    return [d.x - r, d.y - r, d.x + r, d.y + r];
  }

  AS.Decals = {
    painters: P, bounds,
    /* paint d onto a chunk context already scaled to world units; (ox, oy) = chunk origin */
    paint(ctx, d, ox, oy) {
      const f = P[d.kind];
      if (!f) return;
      const rng = new U.RNG(d.seed >>> 0 || 1);
      ctx.save();
      f(ctx, d, d.x - ox, d.y - oy, rng, ox, oy);
      ctx.restore();
    },
  };
})(window.AS);
