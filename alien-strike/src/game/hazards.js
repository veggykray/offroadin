/* ALIEN STRIKE — world mechanics and weather.
 * Each world's `mechanics` list switches on systemic hazards: sandstorms that blind
 * the scanner, shield-eating spore clouds, whiteouts and ice fractures, lava
 * eruptions and heat zones, low gravity and control-scrambling spores, wind
 * currents and lightning. Weather is drawn as in-world parallax particles. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  class Hazards {
    constructor(g, m) {
      this.g = g;
      const w = g.world;
      this.mech = new Set(w.mechanics.concat((m.hazards && m.hazards.extra) || []));
      if (m.hazards && m.hazards.disable) for (const k of m.hazards.disable) this.mech.delete(k);
      this.opts = m.hazards || {};
      this.weather = w.weather;
      this.scramble = 0; this.lowGrav = this.mech.has('lowgrav'); this.heat = 0;
      this.windX = 0; this.windY = 0; this.windA = Math.random() * TAU; this.windMag = 0;
      this.sand = 0; this.whiteout = 0; this.stormT = U.range(40, 70); this.storming = false;
      this.eventT = U.range(6, 10);
      this.zones = []; // persistent hazard zones: spore clouds, heat zones, wind currents
      const rng = new U.RNG((g.map.seed || 1) * 97 + w.id);
      const zs = this.opts.zones || [];
      for (const z of zs) this.zones.push(Object.assign({ t: 0 }, z));
      if (this.mech.has('spores') && !zs.length) for (let i = 0; i < (this.opts.sporeClouds || 10); i++) this.zones.push({ type: 'sporecloud', x: rng.range(400, g.map.w - 400), y: rng.range(400, g.map.h - 400), r: rng.range(90, 160), t: rng.range(0, 10) });
      if (this.mech.has('wind') && !zs.length) for (let i = 0; i < (this.opts.currents || 7); i++) this.zones.push({ type: 'current', x: rng.range(400, g.map.w - 400), y: rng.range(400, g.map.h - 400), r: rng.range(160, 260), a: rng.range(0, TAU), f: rng.range(180, 260), t: 0 });
      if (this.mech.has('heat') && !zs.length) for (let i = 0; i < (this.opts.heatZones || 6); i++) this.zones.push({ type: 'heat', x: rng.range(400, g.map.w - 400), y: rng.range(400, g.map.h - 400), r: rng.range(120, 200), t: 0 });
      if (this.mech.has('sporecontrol') && !zs.length) for (let i = 0; i < (this.opts.sporeClouds || 8); i++) this.zones.push({ type: 'sporecloud', x: rng.range(400, g.map.w - 400), y: rng.range(400, g.map.h - 400), r: rng.range(80, 140), t: 0, scramble: true });
      // avoid spawning hazard zones on top of the start / LZ
      this.zones = this.zones.filter((z) => U.dist(z.x, z.y, m.start.x, m.start.y) > z.r + 150 && U.dist(z.x, z.y, m.extraction.x, m.extraction.y) > z.r + 120);
      this.parts = []; this.lastCX = null; this.lastCY = null;
      this.flashT = 0;
      this.initWeather();
    }

    initWeather() {
      const q = AS.Settings.quality;
      const n = { dust: 40, sand: 140, fireflies: 0, snow: 160, rain: 160, embers: 60, spores: 70, storm: 200, sparks: 0, motes: 50 }[this.weather] || 40;
      const cnt = Math.round(n * (q === 'low' ? 0.35 : q === 'medium' ? 0.7 : 1));
      this.parts = [];
      for (let i = 0; i < cnt; i++) this.parts.push({ x: Math.random() * 1400, y: Math.random() * 800, z: 0.6 + Math.random() * 0.8, s: Math.random(), p: Math.random() * TAU });
    }

    visibility() { return 1 - 0.45 * Math.max(this.sand, this.whiteout); }
    scanMul() { return Math.max(0.3, 1 - 0.65 * this.sand - 0.5 * this.whiteout); }
    sporeHit(t) { if (this.mech.has('sporecontrol') || this.mech.has('spores')) { if (this.scramble <= 0) this.g.player.warnOnce('scramble', 'controls_interference', 20); this.scramble = Math.max(this.scramble, t); } }
    force(w) {
      if (w.sandstorm !== undefined) { this.storming = w.sandstorm; this.stormT = w.sandstorm ? 40 : 60; if (w.sandstorm) this.g.say('sandstorm'); }
      if (w.whiteout !== undefined) { this.storming = w.whiteout; this.stormT = w.whiteout ? 30 : 60; if (w.whiteout) this.g.say('whiteout'); }
    }
    set(h) { if (h.add) this.mech.add(h.add); if (h.remove) this.mech.delete(h.remove); }

    update(dt) {
      const g = this.g, p = g.player;
      this.scramble = Math.max(0, this.scramble - dt);
      this.heat = 0;
      // ---- storm cycles (sand / whiteout)
      const cyc = this.mech.has('sandstorm') ? 'sand' : this.mech.has('whiteout') ? 'white' : null;
      if (cyc) {
        this.stormT -= dt;
        if (this.stormT <= 0) {
          this.storming = !this.storming;
          this.stormT = this.storming ? U.range(28, 42) : U.range(55, 85);
          if (this.storming) { g.say(cyc === 'sand' ? 'sandstorm' : 'whiteout'); g.msg(cyc === 'sand' ? 'SANDSTORM — SCANNER RANGE REDUCED' : 'WHITEOUT — VISIBILITY CRITICAL', '#ffb04a', 4); AS.Audio.ambStorm && AS.Audio.ambStorm(true); }
          else AS.Audio.ambStorm && AS.Audio.ambStorm(false);
        }
        const target = this.storming ? 1 : 0;
        if (cyc === 'sand') this.sand = U.approach(this.sand, target, dt * 0.15);
        else this.whiteout = U.approach(this.whiteout, target, dt * 0.15);
        if (cyc === 'sand' && this.sand > 0.2) { this.windX = Math.cos(1.1) * 60 * this.sand; this.windY = Math.sin(1.1) * 30 * this.sand; }
        else if (!this.mech.has('wind')) { this.windX = 0; this.windY = 0; }
      }
      // ---- wind (Storm Giant)
      if (this.mech.has('wind')) {
        this.windA += dt * 0.05 + Math.sin(g.time * 0.13) * dt * 0.1;
        const gust = 0.5 + 0.5 * Math.max(0, Math.sin(g.time * 0.37) * Math.sin(g.time * 0.11 + 1));
        this.windMag = 50 + gust * 110;
        if (gust > 0.85 && p) p.warnOnce('wind', 'wind_shear', 30);
        this.windX = Math.cos(this.windA) * this.windMag; this.windY = Math.sin(this.windA) * this.windMag;
      }
      // ---- persistent zones
      if (p && p.alive) for (const z of this.zones) {
        z.t += dt;
        const d = U.dist(p.x, p.y, z.x, z.y);
        if (d > z.r) continue;
        const k = 1 - d / z.r;
        if (z.type === 'sporecloud') {
          if (z.scramble) this.sporeHit(1.2);
          else { if (p.shield > 0) p.shield = Math.max(0, p.shield - 14 * dt); else { p.hull -= 2.2 * dt; p.dmgTaken += 2.2 * dt; if (p.hull <= 0) p.startDying('Spore corrosion breached the hull.'); } p.shieldT = Math.max(p.shieldT, 1); p.warnOnce('spore', 'spore_warning', 25); }
        } else if (z.type === 'heat') {
          this.heat = Math.max(this.heat, k);
          if (p.shield > 0) p.shield = Math.max(0, p.shield - 8 * k * dt);
          p.warnOnce('heat', 'heat_warning', 25);
        } else if (z.type === 'current') {
          if (!g.padAt(p.x, p.y)) { p.vx += Math.cos(z.a) * z.f * k * dt * 2; p.vy += Math.sin(z.a) * z.f * k * dt * 2; }
        }
      }
      // ---- timed strikes near the player
      this.eventT -= dt;
      if (this.eventT <= 0 && p && p.alive) {
        this.eventT = U.range(6, 11);
        const spot = () => { const a = Math.random() * TAU, r = U.range(60, 260); return { x: p.x + Math.cos(a) * r + p.vx * 1.2, y: p.y + Math.sin(a) * r + p.vy * 1.2 }; };
        if (this.mech.has('fractures')) { const s = spot(); if (g.terrain.kindFast(s.x, s.y) !== 5) AS.Proj.field({ type: 'hazard', kind: 'fracture', x: s.x, y: s.y, r: 55, delay: 1.6, life: 1.8, dmg: 18, col: '#bfe8ff' }); AS.Audio.sfx('ice_creak', { x: s.x, y: s.y }); }
        if (this.mech.has('eruptions')) { const s = this.findLava(p) || spot(); AS.Proj.field({ type: 'hazard', kind: 'eruption', x: s.x, y: s.y, r: 62, delay: 1.8, life: 2, dmg: 22, col: '#ff6a1a' }); AS.Audio.sfx('rumble', { x: s.x, y: s.y }); }
        if (this.mech.has('lightning')) { const s = spot(); AS.Proj.field({ type: 'hazard', kind: 'lightning', x: s.x, y: s.y, r: 46, delay: 1.3, life: 1.5, dmg: 20, dtype: 'energy', col: '#cfe8ff' }); }
      }
      if (this.mech.has('lightning') && Math.random() < dt * 0.25) { this.flashT = 0.15; AS.Audio.sfx('thunder_far', { vol: 0.4 }); }
      this.flashT = Math.max(0, this.flashT - dt);
      // ---- ambient world particles
      this.ambient(dt);
    }

    findLava(p) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * TAU, r = U.range(80, 300);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (this.g.terrain.kindFast(x, y) === 2) return { x, y };
      }
      return null;
    }

    ambient(dt) {
      const g = this.g, cam = g.camera, P = AS.Particles;
      const q = AS.Settings.quality === 'low' ? 0.4 : 1;
      const rx = () => cam.x + Math.random() * cam.w, ry = () => cam.y + Math.random() * cam.h;
      switch (this.weather) {
        case 'fireflies': if (Math.random() < 6 * dt * q) P.spawn({ x: rx(), y: ry(), z: U.range(4, 30), vx: U.range(-10, 10), vy: U.range(-8, 8), vz: U.range(-3, 3), shape: P.GLOW, col: Math.random() < 0.5 ? '#e0ff6a' : '#9fffcf', size: 2, size2: 2, life: U.range(2, 4), add: true }); break;
        case 'embers': if (Math.random() < 10 * dt * q) P.spawn({ x: rx(), y: ry() + 60, z: 2, vx: U.range(-10, 20), vy: U.range(-10, 0), vz: U.range(20, 40), shape: P.DOT, col: '#ffd06a', col2: '#ff3a0a', size: 1, life: U.range(1.5, 3), add: true }); break;
        case 'spores': if (Math.random() < 8 * dt * q) P.spawn({ x: rx(), y: ry(), z: U.range(4, 40), vx: U.range(-6, 6), vy: U.range(-6, 6), vz: U.range(2, 6), shape: P.GLOW, col: Math.random() < 0.5 ? '#9ffff0' : '#e0a0ff', size: 2.5, size2: 1, life: U.range(3, 5), add: true }); break;
        case 'motes': if (Math.random() < 5 * dt * q) P.spawn({ x: rx(), y: ry(), z: U.range(4, 40), vx: U.range(-4, 4), vz: U.range(4, 10), shape: P.GLOW, col: Math.random() < 0.6 ? '#c09aff' : '#ffd27a', size: 2, size2: 1, life: U.range(2, 4), add: true }); break;
        case 'sparks': if (Math.random() < 3 * dt * q) { const x = rx(), y = ry(); AS.FX.sparks(x, y, 2, 4, Math.random() < 0.5 ? '#ff9a3a' : '#5af0ff'); AS.Renderer.light(x, y, 20, '#ff9a3a', 0.4); } break;
      }
      // lava glow + water glint near the camera
      if (g.world.terrain.lava && Math.random() < 12 * dt * q) { const x = rx(), y = ry(); if (g.terrain.kindFast(x, y) === 2) { P.spawn({ x, y, z: 1, vz: U.range(10, 30), shape: P.CIRCLE, col: '#ffe08a', col2: '#ff4a0a', size: 1.5, size2: 0.3, life: 0.8, add: true }); } }
      if (g.world.terrain.water && !g.world.terrain.water.frozen && Math.random() < 14 * dt * q) { const x = rx(), y = ry(); if (g.terrain.kindFast(x, y) === 1) P.spawn({ x, y, z: 0, shape: P.DOT, col: '#e8fffa', size: 1, life: 0.5, add: true, layer: 0 }); }
    }

    /* screen-space weather drawn over the world (parallaxed with camera motion) */
    drawWeather(ctx, ox, oy, vw, vh, R) {
      const g = this.g, cam = g.camera;
      if (this.lastCX === null) { this.lastCX = cam.x; this.lastCY = cam.y; }
      const dx = cam.x - this.lastCX, dy = cam.y - this.lastCY;
      this.lastCX = cam.x; this.lastCY = cam.y;
      const t = g.time;
      const W = vw / cam.zoom, H = vh / cam.zoom;
      const intensity = this.weather === 'sand' ? 0.25 + this.sand * 0.75 : this.weather === 'snow' ? 0.4 + this.whiteout * 0.6 : 1;
      const wind = this.windX * 0.02;
      ctx.save();
      for (const p of this.parts) {
        p.x -= dx * p.z; p.y -= dy * p.z;
        let vx = 0, vy = 0, len = 0, col = '#fff', a = 0.5, size = 1;
        switch (this.weather) {
          case 'dust': vx = 6 + Math.sin(t + p.p) * 4; vy = 2; col = '#e8c890'; a = 0.25; break;
          case 'sand': vx = 120 * p.z * intensity + 40; vy = 30 * p.z; len = 6 * intensity; col = '#f0a070'; a = 0.25 + 0.4 * intensity; break;
          case 'snow': vx = 20 * p.z + wind * 40 + Math.sin(t * 2 + p.p) * 10; vy = 35 * p.z; col = '#ffffff'; a = 0.6; size = p.z > 1.1 ? 2 : 1; break;
          case 'rain': vx = -20 + wind * 20; vy = 260 * p.z; len = 5 * p.z; col = '#a8d8f0'; a = 0.35; break;
          case 'storm': vx = this.windX * 0.8 * p.z; vy = 240 * p.z + this.windY * 0.5; len = 6 * p.z; col = '#b8c8f0'; a = 0.35; break;
          case 'embers': vx = 10; vy = -20 * p.z; col = '#ff9a3a'; a = 0.5; break;
          case 'spores': vx = Math.sin(t * 0.5 + p.p) * 8; vy = -6; col = '#c8a0ff'; a = 0.4; size = 2; break;
          case 'motes': vx = Math.sin(t * 0.3 + p.p) * 6; vy = -4; col = '#e0d0ff'; a = 0.35; break;
          default: vx = 4; vy = 2; col = '#ffffff'; a = 0.2;
        }
        p.x += vx * (1 / 60); p.y += vy * (1 / 60);
        if (p.x < -20) p.x += W + 40; if (p.x > W + 20) p.x -= W + 40;
        if (p.y < -20) p.y += H + 40; if (p.y > H + 20) p.y -= H + 40;
        ctx.globalAlpha = a * (this.weather === 'sand' ? intensity : 1);
        if (len > 0) {
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          const sp = Math.hypot(vx, vy) || 1;
          ctx.beginPath(); ctx.moveTo(Math.round(p.x), Math.round(p.y)); ctx.lineTo(Math.round(p.x - vx / sp * len), Math.round(p.y - vy / sp * len)); ctx.stroke();
        } else { ctx.fillStyle = col; ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size); }
      }
      ctx.restore();
      // haze layers
      // these layers fill the whole device-pixel buffer
      const BW = R.bufW, BH = R.bufH;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.sand > 0.01) { ctx.globalAlpha = this.sand * 0.55; ctx.fillStyle = '#c0582a'; ctx.fillRect(0, 0, BW, BH); }
      if (this.whiteout > 0.01) { ctx.globalAlpha = this.whiteout * 0.6; ctx.fillStyle = '#e8f0f8'; ctx.fillRect(0, 0, BW, BH); }
      if (this.weather === 'spores') { ctx.globalAlpha = 0.08 + Math.sin(t * 0.3) * 0.03; ctx.fillStyle = '#7a5ac8'; ctx.fillRect(0, 0, BW, BH); }
      if (this.flashT > 0) { ctx.globalAlpha = this.flashT * 1.5; ctx.fillStyle = '#e8f0ff'; ctx.fillRect(0, 0, BW, BH); }
      if (this.scramble > 0) {
        ctx.globalAlpha = Math.min(0.4, this.scramble * 0.25);
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#9ffff0' : '#e0a0ff'; ctx.fillRect(0, Math.random() * BH, BW, 1 + Math.random() * 2); }
      }
      ctx.restore();
    }

    drawOverlay(ctx, ox, oy) {
      const g = this.g;
      for (const z of this.zones) {
        const x = z.x - ox, y = z.y - oy;
        if (x < -z.r - 40 || y < -z.r - 40 || x > g.camera.w + z.r + 40 || y > g.camera.h + z.r + 40) continue;
        if (z.type === 'sporecloud') {
          ctx.save();
          const col = z.scramble ? '#b07cff' : '#9ac040';
          for (let i = 0; i < 7; i++) {
            const a = i / 7 * TAU + z.t * 0.15, r = z.r * 0.5;
            const gl = AS.Forge.glow(col, 64);
            ctx.globalAlpha = 0.22;
            const s = z.r * (0.7 + Math.sin(z.t * 0.7 + i) * 0.1);
            ctx.drawImage(gl, x + Math.cos(a) * r - s, y + Math.sin(a) * r * 0.7 - s * 0.8 - 10, s * 2, s * 1.6);
          }
          ctx.restore();
          if (Math.random() < 0.3) AS.Particles.spawn({ x: z.x + U.range(-z.r, z.r) * 0.8, y: z.y + U.range(-z.r, z.r) * 0.6, z: U.range(2, 30), vz: 4, shape: AS.Particles.DOT, col: z.scramble ? '#e0a0ff' : '#d8ff6a', size: 1, life: 1.5, add: true });
        } else if (z.type === 'heat') {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12 + Math.sin(z.t * 2) * 0.04;
          ctx.drawImage(AS.Forge.glow('#ff5a1a', 64), x - z.r, y - z.r * 0.8, z.r * 2, z.r * 1.6); ctx.restore();
          if (Math.random() < 0.2) AS.FX.fire(z.x + U.range(-z.r, z.r) * 0.6, z.y + U.range(-z.r, z.r) * 0.5, 1, 4);
        } else if (z.type === 'current') {
          ctx.save(); ctx.strokeStyle = '#d8e4ff'; ctx.lineWidth = 1;
          for (let i = 0; i < 9; i++) {
            const k = ((z.t * 0.8 + i / 9) % 1);
            const px = x + Math.cos(z.a) * (k - 0.5) * z.r * 1.6 + Math.cos(z.a + 1.57) * ((i % 3) - 1) * z.r * 0.4;
            const py = y + Math.sin(z.a) * (k - 0.5) * z.r * 1.6 + Math.sin(z.a + 1.57) * ((i % 3) - 1) * z.r * 0.4;
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.5;
            ctx.beginPath(); ctx.moveTo(px - 20, py - 30); ctx.lineTo(px - 20 - Math.cos(z.a) * 18, py - 30 - Math.sin(z.a) * 18); ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  }
  AS.Hazards = Hazards;
})(window.AS);
