/* ALIEN STRIKE — pooled particle system and effect presets.
 * Particles live in world ground space (x, y) with a height z; they are drawn at
 * (x, y - z). Two layers: 'low' (dust, ground smoke — under units) and 'high'
 * (fire, sparks, debris, glows — over units). Additive particles use 'lighter'. */
'use strict';
(function (AS) {
  const U = AS.U, C = U.C, TAU = U.TAU;

  function makeP() {
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, size2: 1, col: '#fff', col2: null, rgb: null, rgb2: null,
      shape: 0, add: false, drag: 0, grav: 0, rot: 0, vr: 0, layer: 1, alpha: 1, bounce: 0, len: 0, glowImg: null };
  }
  // shapes
  const DOT = 0, CIRCLE = 1, GLOW = 2, STREAK = 3, RING = 4, SHARD = 5, SMOKE = 6, FLARE = 7;

  /* Soft billowing smoke puff, lit from the top-left like everything else.
   * Cached per quantised colour, three shapes per colour. */
  const puffs = new Map();
  function puff(r, g, b, v) {
    const qr = r >> 4, qg = g >> 4, qb = b >> 4, key = (qr << 10 | qg << 5 | qb) * 4 + v;
    let cv = puffs.get(key);
    if (cv) return cv;
    const S = 48, c = AS.Forge.canvas(S, S), x = c.getContext('2d');
    const R = (qr << 4) + 8, G = (qg << 4) + 8, B = (qb << 4) + 8;
    const rng = new U.RNG(v * 977 + 13);
    const lobe = (cx, cy, rad, k) => {
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, 'rgba(' + R + ',' + G + ',' + B + ',' + k + ')');
      gr.addColorStop(0.55, 'rgba(' + R + ',' + G + ',' + B + ',' + k * 0.55 + ')');
      gr.addColorStop(1, 'rgba(' + R + ',' + G + ',' + B + ',0)');
      x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fill();
    };
    lobe(S / 2, S / 2, S * 0.42, 0.7);
    for (let i = 0; i < 4; i++) { const a = rng.next() * TAU, d = S * 0.13; lobe(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * (0.2 + rng.next() * 0.1), 0.55); }
    // light from the top-left, shade toward the bottom-right
    x.globalCompositeOperation = 'source-atop';
    const lg = x.createLinearGradient(S * 0.15, S * 0.15, S * 0.85, S * 0.85);
    lg.addColorStop(0, 'rgba(255,245,230,0.22)'); lg.addColorStop(0.5, 'rgba(255,245,230,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.28)');
    x.fillStyle = lg; x.fillRect(0, 0, S, S);
    puffs.set(key, c);
    return c;
  }

  const Particles = {
    DOT, CIRCLE, GLOW, STREAK, RING, SHARD, SMOKE, FLARE,
    pool: null,
    density: 1,
    init(cap) { this.pool = new U.Pool(makeP, cap || 2600); },
    clear() { this.pool.clear(); },
    spawn(o) {
      if (this.density < 1 && Math.random() > this.density && !o.keep) return null;
      const p = this.pool.get();
      p.x = o.x; p.y = o.y; p.z = o.z || 0;
      p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
      p.life = p.max = o.life || 0.6;
      p.size = o.size !== undefined ? o.size : 2; p.size2 = o.size2 !== undefined ? o.size2 : p.size;
      p.rgb = C.hex(o.col || '#ffffff'); p.rgb2 = o.col2 ? C.hex(o.col2) : null;
      p.shape = o.shape || DOT; p.add = !!o.add; p.drag = o.drag || 0; p.grav = o.grav || 0;
      p.rot = o.rot || Math.random() * TAU; p.vr = o.vr || 0; p.layer = o.layer === 0 ? 0 : 1;
      p.alpha = o.alpha !== undefined ? o.alpha : 1; p.bounce = o.bounce || 0; p.len = o.len || 0;
      p.glowImg = p.shape === GLOW || p.shape === FLARE ? AS.Forge.glow(o.col || '#ffffff', 64) : null;
      p.asp = o.asp || 0.35;
      return p;
    },
    update(dt) {
      const a = this.pool.active;
      for (let i = a.length - 1; i >= 0; i--) {
        const p = a[i];
        p.life -= dt;
        if (p.life <= 0) { this.pool.release(p); continue; }
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= p.grav ? 1 : k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grav) {
          p.vz -= p.grav * dt; p.z += p.vz * dt;
          if (p.z < 0) { p.z = 0; if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6; if (Math.abs(p.vz) < 8) { p.vz = 0; p.grav = 0; } } else { p.vz = 0; p.vx *= 0.3; p.vy *= 0.3; } }
        } else p.z += p.vz * dt;
        p.rot += p.vr * dt;
      }
    },
    draw(ctx, camX, camY, layer, vw, vh) {
      const a = this.pool.active;
      let add = false;
      ctx.globalCompositeOperation = 'source-over';
      for (let pass = 0; pass < 2; pass++) {
        const wantAdd = pass === 1;
        if (wantAdd !== add) { ctx.globalCompositeOperation = wantAdd ? 'lighter' : 'source-over'; add = wantAdd; }
        for (let i = 0; i < a.length; i++) {
          const p = a[i];
          if (p.layer !== layer || p.add !== wantAdd) continue;
          const sx = p.x - camX, sy = p.y - p.z - camY;
          if (sx < -60 || sy < -60 || sx > vw + 60 || sy > vh + 60) continue;
          const t = 1 - p.life / p.max; // 0 → 1
          const s = p.size + (p.size2 - p.size) * t;
          let r = p.rgb[0], g = p.rgb[1], b = p.rgb[2];
          if (p.rgb2) { r += (p.rgb2[0] - r) * t; g += (p.rgb2[1] - g) * t; b += (p.rgb2[2] - b) * t; }
          const al = p.alpha * (p.shape === SMOKE ? Math.min(1, (1 - t) * 1.6) * Math.min(1, t * 6 + 0.3) : (1 - t * t));
          if (al <= 0.01) continue;
          ctx.globalAlpha = al > 1 ? 1 : al;
          switch (p.shape) {
            case DOT:
              ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
              ctx.fillRect(Math.round(sx - s / 2), Math.round(sy - s / 2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
              break;
            case CIRCLE:
              ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
              ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.5, s), 0, TAU); ctx.fill();
              break;
            case SMOKE: {
              const img = puff(r | 0, g | 0, b | 0, ((p.rot * 3) | 0) % 3 & 3), w = Math.max(1, s) * 2.6;
              ctx.drawImage(img, sx - w / 2, sy - w / 2, w, w);
              break;
            }
            case GLOW:
              ctx.drawImage(p.glowImg, sx - s, sy - s, s * 2, s * 2);
              break;
            case FLARE: // oriented glow: muzzle flashes, blast spikes
              ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot);
              ctx.drawImage(p.glowImg, -s * 0.25, -s * p.asp, s * 2, s * 2 * p.asp);
              ctx.restore();
              break;
            case STREAK: {
              const sp = Math.hypot(p.vx, p.vy - p.vz) || 1;
              const L = (p.len || 0.04) * sp;
              ctx.strokeStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
              ctx.lineWidth = Math.max(1, s);
              ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - (p.vx / sp) * L, sy - ((p.vy - p.vz) / sp) * L); ctx.stroke();
              break;
            }
            case RING:
              ctx.strokeStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
              ctx.lineWidth = Math.max(1, 3 * (1 - t));
              ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(1, s), Math.max(1, s * 0.75), 0, 0, TAU); ctx.stroke();
              break;
            case SHARD:
              ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(p.rot);
              ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
              ctx.fillRect(-s / 2, -s / 4, s, Math.max(1, s / 2));
              ctx.restore();
              break;
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
  };

  /* ---------------- Effect presets ---------------- */
  const FX = {
    groundCol: '#a08060',
    /* layered blast: white flash, fireball lobes, burning embers, a ground shock
     * ring with a dust skirt thrown outward, sparks, tumbling debris, a lingering
     * smoke column and a fading light that washes over the ground */
    explosion(x, y, z, size, opts) {
      opts = opts || {};
      const P = Particles, n = Math.round(8 + size * 0.7);
      const hot = opts.col || '#ffd27a', mid = opts.col2 || '#ff6a1a';
      P.spawn({ x, y, z: z + 2, shape: GLOW, col: '#ffffff', size: size * 0.9, size2: size * 2.2, life: 0.1, add: true, keep: true });
      P.spawn({ x, y, z: z + 2, shape: GLOW, col: hot, size: size * 0.7, size2: size * 1.9, life: 0.32, add: true, keep: true });
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * TAU, d = size * (0.2 + Math.random() * 0.4);
        P.spawn({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, z: z + 3 + Math.random() * size * 0.4, vz: 10 + Math.random() * 20, shape: GLOW, col: mid, size: size * (0.5 + Math.random() * 0.4), size2: size * (1.1 + Math.random() * 0.6), life: 0.4 + Math.random() * 0.25, add: true, alpha: 0.7, keep: true });
      }
      // solid fireball puffs: read on bright ground where additive glow washes out
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * TAU, d = size * Math.random() * 0.35;
        P.spawn({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, z: z + 2 + Math.random() * size * 0.3, vx: Math.cos(a) * size * 1.2, vy: Math.sin(a) * size * 0.8, vz: 12 + Math.random() * 18, shape: SMOKE, col: opts.fireCol || '#fff0b0', col2: opts.fireCol2 || '#b8401a', size: size * 0.3 + 1.5, size2: size * 0.65 + 3, life: 0.32 + Math.random() * 0.18, alpha: 1, drag: 2.5, keep: true });
      }
      // blast spikes
      for (let i = 0; i < 5; i++) P.spawn({ x, y, z: z + 3, shape: FLARE, col: hot, rot: Math.random() * TAU, size: size * 0.8, size2: size * 1.6, asp: 0.16, life: 0.14, add: true });
      // ground shock ring + dust skirt
      P.spawn({ x, y, z: 0, shape: RING, col: '#fff2c8', size: size * 0.3, size2: size * 2.1, life: 0.38, add: true, layer: 0, alpha: 0.6, keep: true });
      const dc = opts.dustCol || FX.groundCol;
      for (let i = 0; i < Math.round(6 + size * 0.35); i++) {
        const a = (i / (6 + size * 0.35)) * TAU + Math.random() * 0.4, sp = size * (3 + Math.random() * 2);
        P.spawn({ x: x + Math.cos(a) * size * 0.3, y: y + Math.sin(a) * size * 0.22, z: 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.72, vz: 4 + Math.random() * 6, shape: SMOKE, col: dc, col2: dc, size: size * 0.18 + 2, size2: size * 0.45 + 5, life: 0.7 + Math.random() * 0.5, alpha: 0.55, drag: 3.2, layer: 0 });
      }
      // embers
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = (0.4 + Math.random()) * size * 4;
        P.spawn({ x, y, z: z + 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, vz: Math.random() * size * 3, shape: CIRCLE, col: hot, col2: mid, size: 1.2 + Math.random() * size * 0.14, size2: 0.4, life: 0.25 + Math.random() * 0.35, add: true, drag: 4 });
      }
      // smoke: a dark rising core and a thin lingering column
      for (let i = 0; i < n * 0.5; i++) {
        const a = Math.random() * TAU, sp = Math.random() * size * 1.4;
        P.spawn({ x: x + Math.cos(a) * size * 0.2, y: y + Math.sin(a) * size * 0.2, z: z + 2, vx: Math.cos(a) * sp + 4, vy: Math.sin(a) * sp * 0.7, vz: 10 + Math.random() * 18, shape: SMOKE, col: '#4a403a', col2: '#2a2624', size: size * 0.2 + 2, size2: size * 0.6 + 5, life: 1 + Math.random() * 1.2, alpha: 0.7, drag: 1.4 });
      }
      if (size > 10) for (let i = 0; i < 3; i++) P.spawn({ x: x + (Math.random() - 0.5) * size * 0.3, y, z: z + size * 0.5, vx: 6 + Math.random() * 4, vz: 16 + Math.random() * 8, shape: SMOKE, col: '#3a3430', col2: '#6a625a', size: size * 0.3, size2: size * 0.9 + 6, life: 2.2 + Math.random(), alpha: 0.4, drag: 0.5 });
      // sparks
      for (let i = 0; i < n * 0.5; i++) {
        const a = Math.random() * TAU, sp = (0.5 + Math.random()) * size * 5;
        P.spawn({ x, y, z: z + 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 40 + Math.random() * 120, grav: 320, shape: STREAK, col: '#ffe9a8', col2: '#ff7a2a', size: 1, life: 0.4 + Math.random() * 0.5, add: true, len: 0.03 });
      }
      if (opts.debris !== false) {
        const dcol = opts.debrisCol || '#3a3430';
        for (let i = 0; i < n * 0.4; i++) {
          const a = Math.random() * TAU, sp = (0.3 + Math.random()) * size * 3;
          P.spawn({ x, y, z: z + 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + Math.random() * 110, grav: 300, bounce: 0.35, shape: SHARD, col: dcol, size: 2 + Math.random() * 3, life: 1.2 + Math.random(), vr: (Math.random() - 0.5) * 20 });
        }
      }
      if (AS.Renderer) {
        AS.Renderer.flare(x, y - z, size * 7, '#ffffff', 0.7, 0.12);
        AS.Renderer.flare(x, y - z, size * 6, opts.lightCol || '#ffa050', 0.6, 0.55);
      }
    },
    smallBoom(x, y, z, col) {
      const P = Particles;
      P.spawn({ x, y, z, shape: GLOW, col: '#ffffff', size: 4, size2: 10, life: 0.08, add: true });
      P.spawn({ x, y, z, shape: GLOW, col: col || '#ffc070', size: 6, size2: 16, life: 0.22, add: true });
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * TAU, sp = 40 + Math.random() * 80;
        P.spawn({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.random() * 40, shape: CIRCLE, col: '#ffe0a0', col2: col || '#ff7a2a', size: 1.6, size2: 0.4, life: 0.25, add: true, drag: 5 });
      }
      P.spawn({ x, y, z, shape: SMOKE, col: '#4a4440', col2: '#2a2624', size: 3, size2: 9, life: 0.8, vz: 14, alpha: 0.6 });
      if (AS.Renderer) AS.Renderer.flare(x, y - z, 40, col || '#ffb060', 0.5, 0.2);
    },
    impact(x, y, z, col, dirA) {
      const P = Particles;
      P.spawn({ x, y, z, shape: GLOW, col: '#ffffff', size: 2, size2: 5, life: 0.06, add: true });
      P.spawn({ x, y, z, shape: GLOW, col, size: 3, size2: 9, life: 0.14, add: true });
      for (let i = 0; i < 4; i++) {
        const a = (dirA !== undefined ? dirA + Math.PI : Math.random() * TAU) + (Math.random() - 0.5) * 1.8, sp = 60 + Math.random() * 120;
        P.spawn({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 20 + Math.random() * 40, grav: 200, shape: STREAK, col: '#ffffff', col2: col, size: 1, life: 0.18 + Math.random() * 0.12, add: true, len: 0.025 });
      }
      if (AS.Renderer) AS.Renderer.flare(x, y - z, 22, col, 0.45, 0.1);
    },
    /* projectile ran out of range over open ground: a puff of dust and a spark */
    groundHit(x, y, col) {
      const P = Particles;
      P.spawn({ x, y, z: 1, shape: SMOKE, col: FX.groundCol, size: 1.5, size2: 5, life: 0.5, vz: 6, alpha: 0.5, layer: 0 });
      P.spawn({ x, y, z: 1, shape: GLOW, col, size: 2, size2: 5, life: 0.08, add: true });
    },
    /* directional muzzle flash at a projected point */
    muzzle(x, y, z, a, col, k) {
      const P = Particles; k = k || 1;
      P.spawn({ x, y: y + z, z, shape: GLOW, col: '#ffffff', size: 2.5 * k, size2: 5 * k, life: 0.05, add: true });
      P.spawn({ x, y: y + z, z, shape: FLARE, col, rot: a, size: 9 * k, size2: 5 * k, asp: 0.3, life: 0.07, add: true });
      P.spawn({ x, y: y + z, z, shape: FLARE, col, rot: a + 1.9, size: 3 * k, size2: 1.5 * k, asp: 0.3, life: 0.05, add: true });
      P.spawn({ x, y: y + z, z, shape: FLARE, col, rot: a - 1.9, size: 3 * k, size2: 1.5 * k, asp: 0.3, life: 0.05, add: true });
      if (AS.Renderer) AS.Renderer.flare(x, y, 30 * k, col, 0.55, 0.08);
    },
    dust(x, y, n, col, spread) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = 10 + Math.random() * (spread || 40);
        Particles.spawn({ x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4, z: 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: 4 + Math.random() * 8, shape: SMOKE, col: col || '#a08060', size: 2 + Math.random() * 2, size2: 6 + Math.random() * 5, life: 0.6 + Math.random() * 0.6, alpha: 0.45, drag: 2.5, layer: 0 });
      }
    },
    smoke(x, y, z, size, dark) {
      Particles.spawn({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size, z, vx: (Math.random() - 0.5) * 8 + 6, vy: (Math.random() - 0.5) * 6, vz: 14 + Math.random() * 12, shape: SMOKE, col: dark ? '#2a2422' : '#6a625c', col2: dark ? '#141010' : '#3a3634', size: size * 0.3 + 1.5, size2: size * 0.8 + 4, life: 1.2 + Math.random() * 0.8, alpha: 0.55, drag: 0.6 });
    },
    fire(x, y, z, size) {
      Particles.spawn({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size * 0.6, z, vz: 18 + Math.random() * 18, vx: (Math.random() - 0.5) * 10, shape: CIRCLE, col: '#ffe08a', col2: '#ff4a1a', size: 1 + size * 0.15, size2: 0.4, life: 0.35 + Math.random() * 0.3, add: true });
    },
    sparks(x, y, z, n, col) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = 50 + Math.random() * 120;
        Particles.spawn({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 60, grav: 260, shape: STREAK, col: '#ffffff', col2: col || '#ffd27a', size: 1, life: 0.25 + Math.random() * 0.3, add: true, len: 0.02 });
      }
    },
    splat(x, y, z, col, n) {
      for (let i = 0; i < (n || 10); i++) {
        const a = Math.random() * TAU, sp = 30 + Math.random() * 90;
        Particles.spawn({ x, y, z: z + 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 70, grav: 280, shape: CIRCLE, col, size: 1 + Math.random() * 1.6, life: 0.6 + Math.random() * 0.4 });
      }
    },
    shockwave(x, y, r, col) {
      Particles.spawn({ x, y, z: 0, shape: RING, col: col || '#ffe6b0', size: 4, size2: r, life: 0.45, add: true, layer: 0, keep: true });
    },
    beamUp(x, y, z0, z1, col) {
      for (let i = 0; i < 3; i++) Particles.spawn({ x: x + (Math.random() - 0.5) * 8, y, z: z0 + Math.random() * (z1 - z0), vz: 40, shape: DOT, col: col || '#9ff6ff', size: 1, life: 0.4, add: true });
    },
    // retrieval complete: bright ring + sparkles at the emitter and a column flash
    retrieveBurst(x, y, z, col) {
      const P = Particles;
      col = col || '#9ff6ff';
      P.spawn({ x, y, z, shape: GLOW, col: '#ffffff', size: 6, size2: 22, life: 0.25, add: true, keep: true });
      P.spawn({ x, y, z: z - 2, shape: RING, col, size: 4, size2: 26, life: 0.4, add: true, keep: true });
      P.spawn({ x, y, z: 0, shape: RING, col, size: 6, size2: 30, life: 0.5, add: true, layer: 0, keep: true });
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * TAU, sp = 30 + Math.random() * 70;
        P.spawn({ x, y, z: z - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: Math.random() * 40, shape: GLOW, col: Math.random() < 0.5 ? '#ffffff' : col, size: 1.6, size2: 0.3, life: 0.4 + Math.random() * 0.3, add: true, drag: 3 });
      }
      AS.Renderer && AS.Renderer.light(x, y - z, 40, col, 0.6);
    },
    text(x, y, z, txt, col) { AS.Renderer && AS.Renderer.floatText(x, y - z, txt, col); },
  };

  AS.Particles = Particles;
  AS.FX = FX;
})(window.AS);
