/* ALIEN STRIKE — area effects: landing ordnance, gravity wells, spore clouds,
 * mines, orbital strikes and telegraphed hazards (eruptions, fractures, lightning). */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const Fields = {
    land(g, p) {
      const x = p.gx, y = p.gy, R = p.radius;
      const F = AS.Proj;
      switch (p.land) {
        case 'explode':
          g.damageArea(x, y, R, p.dmg, p.dtype, p.team, p.owner, { burn: p.burn });
          AS.FX.explosion(x, y, 2, R * 0.5, { col: p.col === '#ff7a2a' ? '#ffe08a' : undefined });
          g.terrain.addDecal('scorch', x, y, R * 0.6);
          AS.Audio.sfx('explode_med', { x, y });
          g.shakeNear(x, y, 0.25);
          if (p.burn) F.field({ type: 'fire', x, y, r: R * 0.6, life: 4, team: p.team, dmg: 6 });
          break;
        case 'plasma':
          g.damageArea(x, y, R, p.dmg, 'energy', p.team, p.owner, { push: 160 });
          AS.FX.explosion(x, y, 2, R * 0.55, { col: '#f0d8ff', col2: '#a05aff', lightCol: '#c58aff' });
          AS.Particles.spawn({ x, y, z: 0, shape: AS.Particles.RING, col: '#e0c0ff', size: 10, size2: R * 1.3, life: 0.5, add: true, layer: 0, keep: true });
          g.terrain.addDecal('crater', x, y, R * 0.55);
          g.camera.shake(0.55); g.camera.flash(0.25, '#e8d0ff'); g.camera.pulseZoom(-0.04, 0.6);
          AS.Audio.sfx('plasma_boom', { x, y });
          break;
        case 'gravitic':
          F.field({ type: 'gravwell', x, y, r: R, life: p.extra.pull + 0.4, pull: p.extra.pull, dmg: p.dmg, active: true, team: p.team });
          AS.Audio.sfx('gravitic', { x, y });
          break;
        case 'beacon':
          F.field({ type: 'orbital', x, y, r: R, life: p.extra.delay + 0.8, delay: p.extra.delay, dmg: p.dmg, team: p.team });
          AS.Audio.sfx('beacon', { x, y });
          break;
        case 'bloom':
          F.field({ type: 'bloom', x, y, r: R, life: p.extra.life, dps: p.dmg, team: p.team });
          AS.Audio.sfx('bloom', { x, y });
          break;
        case 'mine':
          F.field({ type: 'mine', x, y, r: R, life: 90, dmg: p.dmg, team: p.team, armed: 0.6 });
          AS.Audio.sfx('mine_arm', { x, y });
          break;
        case 'spore':
          F.field({ type: 'spore', x, y, r: R, life: 5, dps: p.dmg, team: p.team, col: p.col });
          AS.FX.dust(x, y, 6, p.col, 60);
          AS.Audio.sfx('squelch', { x, y, vol: 0.5 });
          break;
        case 'acid':
          g.damageArea(x, y, R, p.dmg, 'bio', p.team, p.owner, {});
          AS.FX.splat(x, y, 2, p.col, 8);
          g.terrain.addDecal('splat', x, y, R * 0.4, p.col);
          AS.Audio.sfx('splash', { x, y, vol: 0.5 });
          break;
        case 'burst':
        default:
          g.damageArea(x, y, R, p.dmg, p.dtype, p.team, p.owner, {});
          AS.FX.smallBoom(x, y, 4, p.col);
          AS.Audio.sfx('explode_small', { x, y });
      }
    },

    update(g, f, dt) {
      const pl = g.player;
      switch (f.type) {
        case 'gravwell': {
          if (f.t < f.pull) {
            const list = g.queryEnemies(f.x, f.y - 10, f.r + 30);
            for (const e of list) {
              if (!e.alive || e.isStructure || e.def.big || e.boss) continue;
              const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy);
              if (d < f.r && d > 4) { e.x += dx / d * 120 * dt; e.y += dy / d * 120 * dt; e.slow = 0.5; }
            }
            if (Math.random() < 0.8) {
              const a = Math.random() * TAU, r = f.r * (0.6 + Math.random() * 0.4);
              AS.Particles.spawn({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.75, z: 4, vx: -Math.cos(a) * r * 1.6, vy: -Math.sin(a) * r * 1.2, shape: AS.Particles.STREAK, col: '#8affd8', size: 1, life: 0.5, add: true, len: 0.05, layer: 0 });
            }
            AS.Renderer.light(f.x, f.y, 50, '#8affd8', 0.4);
          } else if (f.active) {
            f.active = false;
            g.damageArea(f.x, f.y, f.r * 0.7, f.dmg, 'energy', f.team, pl, {});
            AS.FX.explosion(f.x, f.y, 4, f.r * 0.35, { col: '#e0fff4', col2: '#3affb0', lightCol: '#8affd8' });
            g.camera.shake(0.4); AS.Audio.sfx('plasma_boom', { x: f.x, y: f.y });
          }
          break;
        }
        case 'orbital': {
          if (f.t > f.delay && !f.fired) {
            f.fired = true;
            g.damageArea(f.x, f.y, f.r, f.dmg, 'energy', f.team, pl, { push: 200 });
            AS.FX.explosion(f.x, f.y, 2, f.r * 0.5, { col: '#ffffff', col2: '#7fd8ff', lightCol: '#cfeeff' });
            g.terrain.addDecal('crater', f.x, f.y, f.r * 0.5);
            g.camera.shake(0.9); g.camera.flash(0.5, '#e8f6ff'); g.camera.pulseZoom(-0.06, 0.9);
            AS.Audio.sfx('orbital', { x: f.x, y: f.y });
          }
          break;
        }
        case 'bloom': case 'spore': {
          if (Math.random() < 0.6) {
            const a = Math.random() * TAU, r = Math.random() * f.r;
            AS.Particles.spawn({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.75, z: 2 + Math.random() * 20, vz: 4, vx: U.range(-6, 6), shape: AS.Particles.SMOKE, col: f.type === 'bloom' ? '#9cff6a' : (f.col || '#c58aff'), col2: '#2a3a1a', size: 4, size2: 12, life: 1.6, alpha: 0.35 });
          }
          f.tick = (f.tick || 0) - dt;
          if (f.tick <= 0) {
            f.tick = 0.25;
            if (f.type === 'bloom') {
              for (const e of g.queryEnemies(f.x, f.y - 10, f.r + 30)) if (e.alive && U.dist(e.x, e.y, f.x, f.y) < f.r) e.takeDamage(f.dps * 0.25 * (e.organic ? 1.5 : 0.8), 'bio', pl);
            } else if (pl && pl.alive && U.dist(pl.x, pl.y, f.x, f.y) < f.r) {
              pl.takeDamage(f.dps * 0.25, 'bio', null);
              if (g.hazards) g.hazards.sporeHit(1.6);
            }
          }
          break;
        }
        case 'fire': {
          if (Math.random() < 0.5) AS.FX.fire(f.x + U.range(-f.r, f.r) * 0.7, f.y + U.range(-f.r, f.r) * 0.5, 1, 6);
          AS.Renderer.light(f.x, f.y, f.r * 1.5, '#ff7a2a', 0.35);
          f.tick = (f.tick || 0) - dt;
          if (f.tick <= 0) { f.tick = 0.4; for (const fr of g.friendlies) if (fr.alive && !fr.air && U.dist(fr.x, fr.y, f.x, f.y) < f.r) fr.takeDamage(f.dmg * 0.4, 'energy', null); for (const s of g.survivors) s.hazard(f.x, f.y, f.r); }
          break;
        }
        case 'mine': {
          f.armed -= dt;
          if (f.armed > 0) break;
          if (Math.random() < 0.03) AS.Renderer.light(f.x, f.y, 10, '#ff4a4a', 0.6);
          const list = g.queryEnemies(f.x, f.y, 60);
          for (const e of list) {
            if (e.alive && !e.isStructure && (e.z < 30) && U.dist(e.x, e.y, f.x, f.y) < 34) {
              g.damageArea(f.x, f.y, f.r, f.dmg, 'explosive', 'player', pl, {});
              AS.FX.explosion(f.x, f.y, 2, 20); AS.Audio.sfx('explode_med', { x: f.x, y: f.y });
              g.terrain.addDecal('scorch', f.x, f.y, 18);
              f.t = f.life; break;
            }
          }
          break;
        }
        case 'hazard': {
          // telegraphed environmental strike (eruption / fracture / lightning / thump)
          if (f.t >= f.delay && !f.fired) {
            f.fired = true;
            const pl2 = g.player;
            if (pl2 && pl2.alive && U.dist(pl2.x, pl2.y, f.x, f.y) < f.r + 6) pl2.takeDamage(f.dmg, f.dtype || 'explosive', null, Math.atan2(f.y - pl2.y, f.x - pl2.x));
            g.damageArea(f.x, f.y, f.r, f.dmg * 0.8, f.dtype || 'explosive', 'neutral', null, { hitsAll: true, skipPlayer: true });
            AS.Fields.hazardFx(g, f);
          }
          break;
        }
      }
    },

    hazardFx(g, f) {
      const k = f.kind;
      if (k === 'eruption') {
        AS.FX.explosion(f.x, f.y, 2, f.r * 0.5, { col: '#ffe26a', col2: '#ff5a1a', debrisCol: '#1a1414' });
        for (let i = 0; i < 18; i++) AS.Particles.spawn({ x: f.x, y: f.y, z: 4, vx: U.range(-60, 60), vy: U.range(-60, 60), vz: U.range(120, 260), grav: 260, shape: AS.Particles.CIRCLE, col: '#ffd06a', col2: '#ff3a0a', size: 2.5, size2: 1, life: 1.2, add: true });
        g.terrain.addDecal('scorch', f.x, f.y, f.r * 0.6);
        AS.Audio.sfx('eruption', { x: f.x, y: f.y });
      } else if (k === 'fracture') {
        AS.FX.explosion(f.x, f.y, 2, f.r * 0.4, { col: '#ffffff', col2: '#9fd8ff', debrisCol: '#cfe8f8', lightCol: '#cfeeff' });
        g.terrain.addDecal('crater', f.x, f.y, f.r * 0.5);
        AS.Audio.sfx('ice_crack', { x: f.x, y: f.y });
      } else if (k === 'lightning') {
        AS.Proj.zap(f.x + U.range(-30, 30), f.y - 420, f.x, f.y, '#cfe8ff', 2.5);
        AS.FX.explosion(f.x, f.y, 2, f.r * 0.3, { col: '#ffffff', col2: '#9fd0ff', lightCol: '#cfe8ff', debris: false });
        g.camera.flash(0.18, '#dfe8ff');
        AS.Audio.sfx('thunder', { x: f.x, y: f.y });
      } else {
        AS.FX.shockwave(f.x, f.y, f.r * 1.4); AS.FX.dust(f.x, f.y, 14, g.world.terrain.ramp[2], 120);
        AS.Audio.sfx('thump', { x: f.x, y: f.y });
      }
      g.shakeNear(f.x, f.y, 0.4);
    },

    drawGround(ctx, ox, oy, g) {
      const fs = AS.Proj.fields;
      for (const f of fs) {
        const x = f.x - ox, y = f.y - oy;
        if (x < -200 || y < -200 || x > g.camera.w + 200 || y > g.camera.h + 200) continue;
        if (f.type === 'warn' || (f.type === 'hazard' && !f.fired)) {
          const k = f.type === 'warn' ? f.t / f.life : f.t / f.delay;
          const col = f.col || '#ff4a3a';
          ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(f.t * (6 + k * 14)));
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.75, 0, 0, TAU); ctx.stroke();
          ctx.globalAlpha *= 0.5; ctx.fillStyle = col;
          ctx.beginPath(); ctx.ellipse(x, y, f.r * k, f.r * 0.75 * k, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (f.type === 'mine') {
          ctx.fillStyle = f.armed > 0 ? '#7a7a7a' : (Math.sin(f.t * 8) > 0 ? '#ff4a4a' : '#7a2020');
          ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
          ctx.fillStyle = '#222'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        } else if (f.type === 'orbital' && !f.fired) {
          const k = f.t / f.delay;
          ctx.globalAlpha = 0.6; ctx.strokeStyle = '#cfeeff'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, y, f.r * (1 - k * 0.8), f.r * 0.75 * (1 - k * 0.8), 0, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.75, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = Math.sin(f.t * 20) > 0 ? '#ffffff' : '#ff4a4a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 3, 3);
          ctx.globalAlpha = 1;
        } else if (f.type === 'gravwell' && f.active) {
          ctx.globalAlpha = 0.5; ctx.strokeStyle = '#8affd8';
          for (let i = 0; i < 3; i++) { const rr = f.r * (((f.t * 0.8 + i / 3) % 1)); ctx.beginPath(); ctx.ellipse(x, y, f.r - rr, (f.r - rr) * 0.75, 0, 0, TAU); ctx.stroke(); }
          ctx.globalAlpha = 1;
        }
      }
    },
    drawOverlay(ctx, ox, oy, g) {
      for (const f of AS.Proj.fields) {
        if (f.type === 'orbital' && f.fired && f.t - f.delay < 0.6) {
          const k = 1 - (f.t - f.delay) / 0.6;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
          const x = f.x - ox, y = f.y - oy;
          const grd = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
          grd.addColorStop(0, 'rgba(160,220,255,0)'); grd.addColorStop(0.5, 'rgba(240,250,255,1)'); grd.addColorStop(1, 'rgba(160,220,255,0)');
          ctx.fillStyle = grd; ctx.fillRect(x - 20 * k - 4, -50, 40 * k + 8, y + 50);
          ctx.restore();
        }
        if (f.type === 'orbital' && !f.fired) {
          ctx.save(); ctx.globalAlpha = 0.25 + (f.t / f.delay) * 0.4; ctx.strokeStyle = '#cfeeff';
          ctx.beginPath(); ctx.moveTo(f.x - ox, -20); ctx.lineTo(f.x - ox, f.y - oy); ctx.stroke(); ctx.restore();
        }
      }
    },
  };
  AS.Fields = Fields;
})(window.AS);
