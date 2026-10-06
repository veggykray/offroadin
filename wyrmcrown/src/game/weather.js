/* WYRMCROWN — weather.
 *  - Rain fronts drift across the realm with the wind every few minutes; some
 *    are thunderstorms. Lightning strikes inside a storm, and a dragon flying
 *    high in one draws the bolt, so in a storm you fly low.
 *  - Each land has its own air: snow drifts over Hrimgard (a front over the
 *    ice becomes a blizzard), ash falls over the Morgrave blight, motes of
 *    light hang in the Sylvaran forest.
 *  - Rain darkens the light, lightning flashes the screen, thunder rolls in
 *    late with distance, and the rain bed and wind swell in the audio mix.
 * Drawn through the renderer's weather hook (g.hazards.drawWeather) in the
 * same view-local space ALIEN STRIKE's weather uses. */
'use strict';
(function (AS) {
  const U = AS.U;
  const N = 360;

  class Weather {
    constructor(g) {
      this.g = g;
      this.fronts = [];
      this.nextT = 70 + Math.random() * 80;
      this.rain = 0; this.storm = 0; this.snow = 0; this.ash = 0; this.motes = 0;
      this.flash = 0; this.bolts = [];
      this.parts = [];
      for (let i = 0; i < N; i++) this.parts.push({ x: Math.random() * 2400, y: Math.random() * 1600, z: 0.6 + Math.random() * 0.8, p: Math.random() * 10 });
      this.lastCX = null; this.lastCY = null;
      this.bw = new Float32Array(5);
    }

    spawnFront() {
      const g = this.g, m = g.map, wind = (g.world.atm && g.world.atm.wind) || [14, 5];
      const a = Math.atan2(wind[1], wind[0]) + U.range(-0.6, 0.6), sp = U.range(30, 55);
      // somewhere upwind of the middle, drifting across
      const along = U.range(0.15, 0.45), side = U.range(-0.35, 0.35);
      const x = m.w / 2 - Math.cos(a) * m.w * along - Math.sin(a) * m.w * side;
      const y = m.h / 2 - Math.sin(a) * m.h * along + Math.cos(a) * m.h * side;
      const f = { x, y, r: U.range(1500, 2400), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: U.range(150, 230), age: 0, storm: Math.random() < 0.45 };
      this.fronts.push(f);
      const p = g.player;
      if (p && Math.hypot(p.x - x, p.y - y) < f.r + 3000 && g.news) g.news(f.storm ? 'Thunderheads gather on the wind…' : 'Rain clouds roll in.', null, false);
    }

    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      this.nextT -= dt;
      if (this.nextT <= 0) { this.nextT = 150 + Math.random() * 170; if (this.fronts.length < 2) this.spawnFront(); }
      let rain = 0, storm = 0;
      for (const f of this.fronts) {
        f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt;
        const fade = Math.max(0, Math.min(1, f.age / 25, (f.life - f.age) / 25));
        const k = U.clamp(1.25 - Math.hypot(p.x - f.x, p.y - f.y) / f.r, 0, 1) * fade;
        rain = Math.max(rain, k);
        if (f.storm) {
          storm = Math.max(storm, k);
          if (fade > 0.5 && Math.random() < dt * 0.22) this.strike(f);
        }
      }
      for (let i = this.fronts.length - 1; i >= 0; i--) if (this.fronts[i].age >= this.fronts[i].life) this.fronts.splice(i, 1);
      // the land's own air
      const bw = g.terrain.biomeAt ? g.terrain.biomeAt(p.x, p.y, this.bw) : this.bw;
      const ice = bw[2] || 0, dead = bw[3] || 0, elf = bw[1] || 0;
      const forest = g.terrain.gs ? g.terrain.gs(g.terrain.gForest, p.x, p.y) : 0;
      const k = 1 - Math.exp(-dt * 0.6);
      this.rain += (rain * (1 - ice * 0.9) - this.rain) * k;
      this.storm += (storm - this.storm) * k;
      this.snow += (U.clamp((ice - 0.35) * 1.2, 0, 0.7) + rain * ice - this.snow) * k;
      this.ash += (U.clamp((dead - 0.4) * 1.1, 0, 0.6) - this.ash) * k;
      this.motes += (U.clamp(elf * forest * 1.2, 0, 0.6) - this.motes) * k;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.8);
      for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].t -= dt; if (this.bolts[i].t <= 0) this.bolts.splice(i, 1); }
    }

    // a lightning strike inside a storm front; high-flying dragons draw it
    strike(f) {
      const g = this.g, p = g.player;
      let tgt = null;
      for (const d of g.dragons) if (d.targetable && d.z > 72 && Math.hypot(d.x - f.x, d.y - f.y) < f.r && Math.random() < 0.4) { tgt = d; break; }
      const x = tgt ? tgt.x : f.x + U.range(-0.8, 0.8) * f.r, y = tgt ? tgt.y : f.y + U.range(-0.8, 0.8) * f.r;
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < 1500) {
        this.bolts.push({ x, y, z: tgt ? tgt.z : 0, t: 0.28, seed: (Math.random() * 1e4) | 0 });
        this.flash = Math.max(this.flash, 0.9 - dist / 1700);
        if (!tgt) g.terrain.addDecal('scorch', x, y, 14);
      }
      if (tgt) {
        tgt.takeDamage(tgt.maxHp * 0.08, 'magic', null);
        if (tgt.isPlayer) g.msg('STRUCK BY LIGHTNING — FLY LOWER IN A STORM', '#bfe0ff', 2.5);
      }
      const later = g.later ? g.later.bind(g) : (t, fn) => setTimeout(fn, t * 1000);
      later(Math.min(3, dist / 1100), () => AS.Audio.sfx('thunder', { vol: U.clamp(1.15 - dist / 3200, 0.15, 1), rate: U.range(0.85, 1.1) }));
    }

    draw(ctx, ox, oy, vw, vh, R) {
      const g = this.g, cam = g.camera, t = g.time;
      // lightning bolts, in world space: a jagged stroke from the clouds
      for (const b of this.bolts) {
        const rng = new U.RNG(b.seed + ((b.t * 30) | 0));
        const x = b.x - ox, y = b.y - oy - b.z, top = y - 700;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, b.t * 5);
        for (const [w, col] of [[7, 'rgba(140,170,255,0.35)'], [2.2, '#f4f8ff']]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
          let px = x + rng.range(-60, 60), py = top; ctx.moveTo(px, py);
          for (let i = 1; i <= 12; i++) { py = top + (y - top) * i / 12; px = U.lerp(px, x, 0.25) + rng.range(-26, 26) * (1 - i / 13); ctx.lineTo(px, py); }
          ctx.stroke();
        }
        ctx.drawImage(AS.Forge.glow('#c8d8ff', 64), x - 70, y - 50, 140, 100);
        ctx.restore();
        R.light(b.x, b.y - b.z, 260, '#c8d8ff', 0.8);
      }
      // precipitation and motes, in view-local space
      const nRain = Math.round(N * this.rain), nSnow = Math.round(N * this.snow * 0.8), nAsh = Math.round(N * this.ash * 0.45), nMote = Math.round(N * this.motes * 0.18);
      if (nRain + nSnow + nAsh + nMote > 0) {
        if (this.lastCX === null) { this.lastCX = cam.x; this.lastCY = cam.y; }
        const dx = cam.x - this.lastCX, dy = cam.y - this.lastCY;
        this.lastCX = cam.x; this.lastCY = cam.y;
        const W = vw / cam.zoom, H = vh / cam.zoom;
        const wind = (g.world.atm && g.world.atm.wind) || [14, 5];
        ctx.save();
        let i = 0;
        for (const p of this.parts) {
          const kind = i < nRain ? 0 : i < nRain + nSnow ? 1 : i < nRain + nSnow + nAsh ? 2 : i < nRain + nSnow + nAsh + nMote ? 3 : -1;
          i++;
          p.x -= dx * p.z; p.y -= dy * p.z;
          if (kind < 0) continue;
          let vx, vy, len = 0, col, a, size = 1;
          if (kind === 0) { vx = wind[0] * 1.5 * p.z - 25; vy = (270 + this.storm * 90) * p.z; len = (8 + this.storm * 4) * p.z; col = '#c4dcf0'; a = 0.4 + this.storm * 0.12; }
          else if (kind === 1) { vx = wind[0] * 1.4 * p.z + Math.sin(t * 2 + p.p) * 10; vy = (34 + this.rain * 60) * p.z; col = '#ffffff'; a = 0.65; size = p.z > 1.1 ? 2 : 1.4; }
          else if (kind === 2) { vx = wind[0] * 0.8 + Math.sin(t * 0.8 + p.p) * 9; vy = 16 * p.z; col = p.p > 7 ? '#d8a070' : '#4a4450'; a = 0.5; size = p.z > 1.1 ? 2 : 1.4; }
          else { vx = Math.sin(t * 0.4 + p.p) * 7; vy = -5 + Math.cos(t * 0.6 + p.p) * 3; col = '#e8ffc0'; a = 0.35 + 0.3 * Math.sin(t * 3 + p.p * 2); size = 2; }
          p.x += vx / 60; p.y += vy / 60;
          if (p.x < -20) p.x += W + 40; if (p.x > W + 20) p.x -= W + 40;
          if (p.y < -20) p.y += H + 40; if (p.y > H + 20) p.y -= H + 40;
          ctx.globalAlpha = Math.max(0, a);
          if (len > 0) {
            const sp = Math.hypot(vx, vy) || 1;
            ctx.strokeStyle = col; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - vx / sp * len, p.y - vy / sp * len); ctx.stroke();
          } else if (kind === 3) { ctx.drawImage(AS.Forge.glow(col, 32), p.x - 3, p.y - 3, 6, 6); }
          else {
            // flakes and ash carry a faint shadow so they read even over snow
            if (kind === 1) { ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#5a6a84'; ctx.fillRect(p.x + 1, p.y + 1, size, size); ctx.globalAlpha = a; }
            ctx.fillStyle = col; ctx.fillRect(p.x, p.y, size, size);
          }
        }
        ctx.restore();
      }
      // rain-cloud gloom and lightning flashes over the whole buffer
      const gloom = this.rain * 0.12 + this.storm * 0.12 + this.snow * 0.04;
      if (gloom > 0.005 || this.flash > 0.01) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (gloom > 0.005) { ctx.globalAlpha = gloom; ctx.fillStyle = '#1a2230'; ctx.fillRect(0, 0, R.bufW, R.bufH); }
        if (this.flash > 0.01) { ctx.globalAlpha = this.flash * 0.45 * (AS.Settings && AS.Settings.flash === false ? 0.2 : 1); ctx.fillStyle = '#eef4ff'; ctx.fillRect(0, 0, R.bufW, R.bufH); }
        ctx.restore();
      }
    }
  }
  AS.Weather = Weather;
})(window.AS);
