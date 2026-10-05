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
  const DOT = 0, CIRCLE = 1, GLOW = 2, STREAK = 3, RING = 4, SHARD = 5, SMOKE = 6;

  const Particles = {
    DOT, CIRCLE, GLOW, STREAK, RING, SHARD, SMOKE,
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
      p.glowImg = p.shape === GLOW ? AS.Forge.glow(o.col || '#ffffff', 64) : null;
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
            case CIRCLE: case SMOKE:
              ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
              ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), Math.max(0.5, s), 0, TAU); ctx.fill();
              break;
            case GLOW:
              ctx.drawImage(p.glowImg, sx - s, sy - s, s * 2, s * 2);
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
    explosion(x, y, z, size, opts) {
      opts = opts || {};
      const P = Particles, n = Math.round(10 + size * 0.9);
      const hot = opts.col || '#ffd27a', mid = opts.col2 || '#ff6a1a';
      P.spawn({ x, y, z: z + 2, shape: GLOW, col: hot, size: size * 0.6, size2: size * 1.8, life: 0.35, add: true, keep: true });
      P.spawn({ x, y, z: z + 2, shape: GLOW, col: mid, size: size * 1.2, size2: size * 2.4, life: 0.6, add: true, alpha: 0.6, keep: true });
      P.spawn({ x, y, z: z, shape: RING, col: '#fff2c8', size: size * 0.3, size2: size * 1.6, life: 0.32, add: true, keep: true });
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = (0.4 + Math.random()) * size * 4;
        P.spawn({ x, y, z: z + 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, vz: Math.random() * size * 3, shape: CIRCLE, col: hot, col2: mid, size: 1.5 + Math.random() * size * 0.18, size2: 0.5, life: 0.25 + Math.random() * 0.35, add: true, drag: 4 });
      }
      for (let i = 0; i < n * 0.6; i++) {
        const a = Math.random() * TAU, sp = Math.random() * size * 1.6;
        P.spawn({ x: x + Math.cos(a) * size * 0.2, y: y + Math.sin(a) * size * 0.2, z: z + 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: 8 + Math.random() * 16, shape: SMOKE, col: '#5a4e48', col2: '#2a2624', size: size * 0.18 + 2, size2: size * 0.5 + 4, life: 0.9 + Math.random() * 1.1, alpha: 0.75, drag: 1.5 });
      }
      for (let i = 0; i < n * 0.5; i++) {
        const a = Math.random() * TAU, sp = (0.5 + Math.random()) * size * 5;
        P.spawn({ x, y, z: z + 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 40 + Math.random() * 120, grav: 320, shape: STREAK, col: '#ffe9a8', col2: '#ff7a2a', size: 1, life: 0.4 + Math.random() * 0.5, add: true, len: 0.03 });
      }
      if (opts.debris !== false) {
        const dc = opts.debrisCol || '#3a3430';
        for (let i = 0; i < n * 0.4; i++) {
          const a = Math.random() * TAU, sp = (0.3 + Math.random()) * size * 3;
          P.spawn({ x, y, z: z + 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + Math.random() * 110, grav: 300, bounce: 0.35, shape: SHARD, col: dc, size: 2 + Math.random() * 3, life: 1.2 + Math.random(), vr: (Math.random() - 0.5) * 20 });
        }
      }
      AS.Renderer && AS.Renderer.light(x, y - z, size * 5, opts.lightCol || '#ffb060', 0.4);
    },
    smallBoom(x, y, z, col) {
      const P = Particles;
      P.spawn({ x, y, z, shape: GLOW, col: col || '#ffc070', size: 6, size2: 16, life: 0.22, add: true });
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * TAU, sp = 40 + Math.random() * 80;
        P.spawn({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: Math.random() * 40, shape: CIRCLE, col: '#ffe0a0', col2: col || '#ff7a2a', size: 1.6, size2: 0.4, life: 0.25, add: true, drag: 5 });
      }
      P.spawn({ x, y, z, shape: SMOKE, col: '#4a4440', col2: '#2a2624', size: 3, size2: 8, life: 0.7, vz: 14, alpha: 0.6 });
    },
    impact(x, y, z, col, dirA) {
      const P = Particles;
      P.spawn({ x, y, z, shape: GLOW, col, size: 3, size2: 8, life: 0.12, add: true });
      for (let i = 0; i < 4; i++) {
        const a = (dirA !== undefined ? dirA + Math.PI : Math.random() * TAU) + (Math.random() - 0.5) * 1.8, sp = 60 + Math.random() * 120;
        P.spawn({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 20 + Math.random() * 40, grav: 200, shape: STREAK, col: '#ffffff', col2: col, size: 1, life: 0.18 + Math.random() * 0.12, add: true, len: 0.025 });
      }
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
    text(x, y, z, txt, col) { AS.Renderer && AS.Renderer.floatText(x, y - z, txt, col); },
  };

  AS.Particles = Particles;
  AS.FX = FX;
})(window.AS);
