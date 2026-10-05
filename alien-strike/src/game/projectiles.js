/* ALIEN STRIKE — projectiles, area fields, beams and zaps.
 * Direct-fire projectiles travel in projected screen-plane coordinates so hits
 * match what the player sees. Lobbed ordnance (shells, bombs, spores, mines)
 * travels between ground points with a visual arc and resolves as area effects. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  function mk() {
    return { type: '', team: '', x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, dtype: 'kinetic', r: 2, col: '#fff', size: 2,
      splash: 0, pierce: 0, hits: null, owner: null, target: null, speed: 0, turn: 0, hp: 0, trailT: 0,
      sx: 0, sy: 0, sz: 0, gx: 0, gy: 0, t: 0, T: 1, arc: 0, land: '', radius: 0, stun: 0, extra: null, px: 0, py: 0, age: 0, prox: 0, burn: false };
  }

  const Proj = {
    pool: null, fields: [], beams: [], zaps: [],
    init() { this.pool = new U.Pool(mk, 900); this.fields = []; this.beams = []; this.zaps = []; },
    clear() { this.pool.clear(); this.fields.length = 0; this.beams.length = 0; this.zaps.length = 0; },

    /* ---------- spawners ---------- */
    bolt(o) {
      const p = this.pool.get();
      p.type = o.type || 'bolt'; p.team = o.team; p.x = o.x; p.y = o.y; p.px = o.x; p.py = o.y;
      const sp = o.speed || 500;
      p.vx = Math.cos(o.a) * sp; p.vy = Math.sin(o.a) * sp; p.speed = sp;
      p.life = (o.range || 400) / sp; p.dmg = o.dmg; p.dtype = o.dtype || 'kinetic'; p.r = o.r || 3;
      p.col = o.col || '#fff'; p.size = o.size || 2; p.splash = o.splash || 0; p.pierce = o.pierce || 0;
      p.hits = null; p.owner = o.owner || null; p.target = null; p.trailT = 0; p.stun = o.stun || 0; p.age = 0;
      p.arc = o.arc || 0; p.T = p.life; p.prox = o.prox || 0; p.radius = o.radius || 0; p.burn = !!o.burn; p.extra = o.extra || null;
      return p;
    },
    missile(o) {
      const p = this.pool.get();
      p.type = o.type || 'missile'; p.team = o.team; p.x = o.x; p.y = o.y; p.px = o.x; p.py = o.y;
      const a = o.a, sp = o.speed0 !== undefined ? o.speed0 : 140;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.speed = o.speed || 480; p.turn = o.turn || 5;
      p.life = o.life || 4; p.dmg = o.dmg; p.dtype = o.dtype || 'explosive'; p.r = o.r || 4; p.col = o.col || '#ff9a5a';
      p.size = o.size || 2; p.splash = o.splash || 30; p.target = o.target || null; p.gx = o.tx || 0; p.gy = o.ty || 0;
      p.hp = o.hp || 0; p.owner = o.owner || null; p.trailT = 0; p.age = 0; p.hits = null; p.pierce = 0; p.extra = o.extra || null;
      return p;
    },
    lob(o) {
      const p = this.pool.get();
      p.type = 'lob'; p.team = o.team; p.sx = o.sx; p.sy = o.sy; p.sz = o.sz || 20; p.gx = o.gx; p.gy = o.gy;
      p.T = o.T || 1; p.t = 0; p.arc = o.arc !== undefined ? o.arc : 60; p.land = o.land || 'explode';
      p.dmg = o.dmg || 0; p.dtype = o.dtype || 'explosive'; p.radius = o.radius || 40; p.col = o.col || '#ffb04a';
      p.size = o.size || 3; p.owner = o.owner || null; p.extra = o.extra || null; p.life = p.T + 0.1; p.age = 0; p.burn = !!o.burn;
      p.x = p.sx; p.y = p.sy - p.sz; p.trailT = 0; p.stun = o.stun || 0; p.hits = null;
      if (o.warn) this.field({ type: 'warn', x: o.gx, y: o.gy, r: p.radius, life: p.T, col: o.warnCol || '#ff4a3a' });
      return p;
    },
    field(o) { const f = Object.assign({ t: 0, life: 1 }, o); this.fields.push(f); return f; },
    beam(o) { this.beams.push(Object.assign({ t: 0, hitT: 0 }, o)); },
    zap(x1, y1, x2, y2, col, w) { this.zaps.push({ x1, y1, x2, y2, col: col || '#9ff6ff', t: 0.12, w: w || 1, seed: Math.random() * 1000 }); },

    /* ---------- update ---------- */
    update(g, dt) {
      const a = this.pool.active;
      for (let i = a.length - 1; i >= 0; i--) {
        const p = a[i];
        p.age += dt;
        if (p.type === 'lob') { this.updateLob(g, p, dt); continue; }
        p.life -= dt;
        if (p.type === 'missile' || p.type === 'swarmlet') this.steer(g, p, dt);
        p.px = p.x; p.py = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt;
        // gravity wells pull everything
        if (this.fields.length) for (const f of this.fields) if (f.type === 'gravwell' && f.active) {
          const dx = f.x - p.x, dy = (f.y - 10) - p.y, d = Math.hypot(dx, dy);
          if (d < f.r && d > 1 && p.team !== 'player') { p.vx += dx / d * 600 * dt; p.vy += dy / d * 600 * dt; }
        }
        if (p.type !== 'bolt' || p.trailT !== -1) this.trail(p, dt);
        let dead = false;
        if (p.team === 'player') dead = this.hitEnemies(g, p);
        else dead = this.hitPlayerTeam(g, p);
        if (!dead && p.prox && p.team !== 'player' && g.player && g.player.alive) {
          // flak proximity fuse
          if (U.dist(p.x, p.y, g.player.x, g.player.py) < p.prox) { this.burst(g, p); dead = true; }
        }
        if (!dead && p.life <= 0) {
          if (p.type === 'missile' || p.type === 'swarmlet' || p.splash > 0 || p.prox) this.burst(g, p);
          else if (p.type === 'emp') this.empBurst(g, p);
          else AS.FX.impact(p.x, p.y, 0, p.col);
          dead = true;
        }
        if (dead) this.pool.release(p);
      }
      // fields
      for (let i = this.fields.length - 1; i >= 0; i--) {
        const f = this.fields[i];
        f.t += dt;
        AS.Fields.update(g, f, dt);
        if (f.t >= f.life) { AS.Fields.end && AS.Fields.end(g, f); this.fields.splice(i, 1); }
      }
      // beams (enemy charged beams)
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const b = this.beams[i];
        b.t += dt;
        if (b.owner && (!b.owner.alive || b.owner.stun > 0)) { this.beams.splice(i, 1); continue; }
        if (b.owner && b.follow) { b.x1 = b.owner.x; b.y1 = b.owner.py - 4; }
        if (b.t > b.charge) {
          if (!b.fired) { b.fired = true; AS.Audio.sfx('beam_fire', { x: b.x1, y: b.y1 }); }
          const pl = g.player;
          if (pl && pl.alive && U.segDist(pl.x, pl.py, b.x1, b.y1, b.x2, b.y2) < pl.r + 4) {
            b.hitT -= dt;
            if (b.hitT <= 0) { b.hitT = 0.1; pl.takeDamage(b.dmg * 0.1 / b.dur * 3.5, 'energy', b.owner, Math.atan2(b.y1 - pl.py, b.x1 - pl.x)); }
          }
          for (const f of g.friendlies) if (f.alive && U.segDist(f.x, f.py, b.x1, b.y1, b.x2, b.y2) < f.r) f.takeDamage(b.dmg * dt, 'energy', b.owner);
          if (Math.random() < 0.6) AS.FX.impact(b.x2, b.y2, 0, b.col);
          AS.Renderer.light(b.x2, b.y2, 30, b.col, 0.5);
        }
        if (b.t > b.charge + b.dur) this.beams.splice(i, 1);
      }
      for (let i = this.zaps.length - 1; i >= 0; i--) { this.zaps[i].t -= dt; if (this.zaps[i].t <= 0) this.zaps.splice(i, 1); }
    },

    steer(g, p, dt) {
      let tx = p.gx, ty = p.gy;
      const t = p.target;
      if (t) {
        if (t.alive === false || (t.burrowed) || (t.removed)) { p.target = null; }
        else { tx = t.x; ty = t.py !== undefined ? t.py : t.y; }
      }
      // decoy: enemy missiles chase gravity wells if close
      const want = Math.atan2(ty - p.y, tx - p.x);
      const cur = Math.atan2(p.vy, p.vx);
      const na = U.turnToward(cur, want, p.turn * dt * (p.age < 0.25 ? 0.4 : 1));
      let sp = Math.hypot(p.vx, p.vy);
      sp = Math.min(p.speed, sp + p.speed * 2.2 * dt);
      p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      if (!t && U.dist(p.x, p.y, tx, ty) < 10 && p.age > 0.3) p.life = 0;
    },

    trail(p, dt) {
      p.trailT -= dt;
      if (p.trailT > 0) return;
      const P = AS.Particles;
      if (p.type === 'missile' || p.type === 'swarmlet') {
        p.trailT = 0.016;
        P.spawn({ x: p.x, y: p.y, z: 0, vx: U.range(-6, 6), vy: U.range(-6, 6), vz: 4, shape: P.SMOKE, col: '#b8b0a8', col2: '#4a4644', size: 1.5, size2: p.type === 'swarmlet' ? 3 : 5, life: 0.6, alpha: 0.5 });
        P.spawn({ x: p.x, y: p.y, z: 0, shape: P.GLOW, col: p.col, size: 3, size2: 1, life: 0.08, add: true });
      } else if (p.type === 'emp') {
        p.trailT = 0.02;
        P.spawn({ x: p.x, y: p.y, z: 0, shape: P.GLOW, col: p.col, size: 5, size2: 1, life: 0.2, add: true });
      } else if (p.dtype === 'bio' || p.type === 'acid') {
        p.trailT = 0.05;
        P.spawn({ x: p.x, y: p.y - (p.arc ? Math.sin(Math.min(1, p.age / p.T) * Math.PI) * p.arc : 0), z: 0, shape: P.CIRCLE, col: p.col, size: 1.2, size2: 0.2, life: 0.25, vz: -10 });
      } else if (p.size >= 3) {
        p.trailT = 0.03;
        P.spawn({ x: p.x, y: p.y, z: 0, shape: P.GLOW, col: p.col, size: p.size * 1.5, size2: 0.5, life: 0.12, add: true });
      } else p.trailT = 1;
    },

    hitEnemies(g, p) {
      const cands = g.queryEnemies(p.x, p.y, 40);
      for (let i = 0; i < cands.length; i++) {
        const e = cands[i];
        if (!e.alive || !e.targetable) continue;
        if (p.hits && p.hits.has(e.uid)) continue;
        const d = U.segDist(e.x, e.py, p.px, p.py, p.x, p.y);
        if (d < e.r + p.r) {
          if (p.type === 'missile' || p.type === 'swarmlet') { this.burst(g, p); return true; }
          if (p.type === 'emp') { this.empBurst(g, p); return true; }
          const dealt = e.takeDamage(p.dmg, p.dtype, g.player, { proj: p });
          g.onPlayerHit(e, dealt, p);
          AS.FX.impact(p.x, p.y, 0, e.isShielded && e.isShielded() ? '#c8a0ff' : (e.organic ? (e.def.splat || '#c8a040') : p.col), Math.atan2(p.vy, p.vx));
          if (e.organic && Math.random() < 0.5) AS.FX.splat(e.x, e.y, e.hc, e.def.splat || '#9a8a40', 3);
          if (p.stun && e.mech) e.stun = Math.max(e.stun, p.stun);
          if (p.splash) g.damageArea(p.x, p.y + e.z + e.hc, p.splash, p.dmg * 0.5, p.dtype, 'player', g.player, { exclude: e });
          if (p.pierce > 0) { p.pierce--; if (!p.hits) p.hits = new Set(); p.hits.add(e.uid); continue; }
          return true;
        }
      }
      // shoot down enemy missiles
      const ms = this.pool.active;
      for (let i = 0; i < ms.length; i++) {
        const m = ms[i];
        if (m.team === 'player' || m.hp <= 0 || m.type !== 'missile') continue;
        if (U.segDist(m.x, m.y, p.px, p.py, p.x, p.y) < 7) {
          m.hp -= p.dmg; if (m.hp <= 0) { m.life = 0; AS.FX.smallBoom(m.x, m.y + 20, 20); AS.Audio.sfx('explode_small', { x: m.x, y: m.y }); g.stats.missilesDowned++; }
          return true;
        }
      }
      return false;
    },

    hitPlayerTeam(g, p) {
      const pl = g.player;
      if (pl && pl.alive && pl.dying <= 0) {
        const vy = p.arc ? p.y - Math.sin(Math.min(1, p.age / p.T) * Math.PI) * p.arc : p.y;
        if (U.segDist(pl.x, pl.py, p.px, p.py, p.x, vy) < pl.r + p.r) {
          if (p.type === 'missile' || p.splash || p.prox) { this.burst(g, p); return true; }
          pl.takeDamage(p.dmg, p.dtype, p.owner, Math.atan2(p.y - pl.py, p.x - pl.x));
          AS.FX.impact(p.x, p.y, 0, pl.shield > 0 ? '#7fd8ff' : '#ffb060');
          return true;
        }
      }
      for (const f of g.friendlies) {
        if (!f.alive || !f.targetable) continue;
        if (U.segDist(f.x, f.py, p.px, p.py, p.x, p.y) < f.r + p.r) {
          if (p.splash || p.type === 'missile') { this.burst(g, p); return true; }
          f.takeDamage(p.dmg, p.dtype, p.owner);
          AS.FX.impact(p.x, p.y, 0, p.col);
          return true;
        }
      }
      // drones & decoys
      if (pl && pl.drones.length) for (const d of pl.drones) {
        if (U.dist(d.x, d.y - d.z, p.x, p.y) < 7) { d.hp -= p.dmg; AS.FX.impact(p.x, p.y, 0, '#9fe8ff'); return true; }
      }
      return false;
    },

    burst(g, p) {
      const R = p.splash || p.radius || 24;
      // projected point → approximate ground point (assume target height)
      const gy = p.y + (p.team === 'player' ? 12 : 26);
      g.damageArea(p.x, gy, R, p.dmg, p.dtype, p.team, p.owner || null, { proj: p });
      if (R > 30) AS.FX.explosion(p.x, gy, gy - p.y, R * 0.45, { col: p.team === 'player' ? '#ffd27a' : '#ffc8f0', col2: p.col });
      else AS.FX.smallBoom(p.x, gy, gy - p.y, p.col);
      AS.Audio.sfx(R > 30 ? 'explode_med' : 'explode_small', { x: p.x, y: gy });
      if (g.player && U.dist(p.x, p.y, g.player.x, g.player.py) < 220) g.camera.shake(0.08 + R * 0.003);
    },

    empBurst(g, p) {
      const R = p.radius || 120;
      AS.Particles.spawn({ x: p.x, y: p.y + 12, z: 12, shape: AS.Particles.RING, col: '#9fd0ff', size: 6, size2: R, life: 0.4, add: true, keep: true });
      AS.Particles.spawn({ x: p.x, y: p.y + 12, z: 12, shape: AS.Particles.GLOW, col: '#7ab8ff', size: 20, size2: R * 0.8, life: 0.35, add: true, keep: true });
      AS.Audio.sfx('emp', { x: p.x, y: p.y });
      const list = g.queryEnemies(p.x, p.y, R + 40);
      for (const e of list) {
        if (!e.alive || U.dist(e.x, e.py, p.x, p.y) > R + e.r) continue;
        if (e.mech) e.stun = Math.max(e.stun, p.stun || 5);
        if (e.shield > 0) e.shield = 0;
        if (e.def.role === 'shieldgen') e.domeDown = Math.max(e.domeDown || 0, 6);
        e.takeDamage(p.dmg, 'energy', g.player);
      }
      // fry enemy missiles in the blast
      for (const m of this.pool.active) if (m.team !== 'player' && m.type === 'missile' && U.dist(m.x, m.y, p.x, p.y) < R) m.life = 0;
    },

    updateLob(g, p, dt) {
      p.t += dt;
      const f = Math.min(1, p.t / p.T);
      const gx = U.lerp(p.sx, p.gx, f), gy = U.lerp(p.sy, p.gy, f);
      const z = U.lerp(p.sz, 0, f) + p.arc * 4 * f * (1 - f);
      p.x = gx; p.y = gy - z; p.extraZ = z; p.gxNow = gx; p.gyNow = gy;
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.03;
        if (p.land === 'spore' || p.dtype === 'bio') AS.Particles.spawn({ x: gx, y: gy, z, shape: AS.Particles.SMOKE, col: p.col, size: 2, size2: 5, life: 0.5, alpha: 0.4 });
        else AS.Particles.spawn({ x: gx, y: gy, z, shape: AS.Particles.GLOW, col: p.col, size: p.size * 1.6, size2: 1, life: 0.15, add: true });
      }
      if (f >= 1) { AS.Fields.land(g, p); this.pool.release(p); }
    },

    /* ---------- draw ---------- */
    draw(ctx, ox, oy, g) {
      const a = this.pool.active;
      const P = AS.Particles;
      ctx.save();
      for (let i = 0; i < a.length; i++) {
        const p = a[i];
        if (p.type === 'lob') {
          // shadow on ground
          ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(p.gxNow - ox, p.gyNow - oy, p.size + 1, (p.size + 1) * 0.6, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(Math.round(p.x - ox), Math.round(p.y - oy), p.size, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(p.x - ox) - 1, Math.round(p.y - oy) - 1, 1, 1);
          AS.Renderer.light(p.x, p.y, 16, p.col, 0.4);
          continue;
        }
        const sx = Math.round(p.x - ox);
        const sy = Math.round((p.arc ? p.y - Math.sin(Math.min(1, p.age / p.T) * Math.PI) * p.arc : p.y) - oy);
        if (p.type === 'missile' || p.type === 'swarmlet') {
          const ang = Math.atan2(p.vy, p.vx);
          ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = p.type === 'swarmlet' ? 1.5 : 2;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(ang) * 6, sy - Math.sin(ang) * 6); ctx.stroke();
          ctx.fillStyle = p.col; ctx.fillRect(sx - 1, sy - 1, 2, 2);
          AS.Renderer.light(p.x, p.y, 12, p.col, 0.5);
        } else {
          const ang = Math.atan2(p.vy, p.vx);
          const L = Math.max(3, p.speed * 0.012);
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.col; ctx.lineWidth = p.size + 1; ctx.globalAlpha = 0.45;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(ang) * L * 1.6, sy - Math.sin(ang) * L * 1.6); ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = Math.max(1, p.size - 0.5); ctx.strokeStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(ang) * L, sy - Math.sin(ang) * L); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          if (p.size >= 3 || p.dtype === 'energy') AS.Renderer.light(p.x, p.y, 10 + p.size * 3, p.col, 0.35);
        }
      }
      // beams
      for (const b of this.beams) {
        if (b.t < b.charge) {
          const k = b.t / b.charge;
          ctx.globalAlpha = 0.25 + k * 0.5; ctx.strokeStyle = b.col; ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(b.x1 - ox, b.y1 - oy); ctx.lineTo(b.x2 - ox, b.y2 - oy); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x1 - ox, b.y1 - oy, 1 + k * 4, 0, TAU); ctx.fill();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5; ctx.strokeStyle = b.col; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(b.x1 - ox, b.y1 - oy); ctx.lineTo(b.x2 - ox, b.y2 - oy); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(b.x1 - ox, b.y1 - oy); ctx.lineTo(b.x2 - ox, b.y2 - oy); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
      }
      // zaps (lightning)
      ctx.globalCompositeOperation = 'lighter';
      for (const z of this.zaps) {
        const rng = new U.RNG((z.seed + (g.time * 30 | 0)) | 0);
        const n = 7;
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? '#ffffff' : z.col; ctx.lineWidth = pass ? 1 : 3 * z.w; ctx.globalAlpha = pass ? 1 : 0.6;
          ctx.beginPath(); ctx.moveTo(z.x1 - ox, z.y1 - oy);
          for (let i = 1; i < n; i++) {
            const t = i / n;
            ctx.lineTo(U.lerp(z.x1, z.x2, t) - ox + (rng.next() - 0.5) * 10, U.lerp(z.y1, z.y2, t) - oy + (rng.next() - 0.5) * 10);
          }
          ctx.lineTo(z.x2 - ox, z.y2 - oy); ctx.stroke();
        }
        AS.Renderer.light((z.x1 + z.x2) / 2, (z.y1 + z.y2) / 2, 40, z.col, 0.5);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  };
  AS.Proj = Proj;
})(window.AS);
