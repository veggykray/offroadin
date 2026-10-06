/* WYRMCROWN — combat: the wizard's staff, the dragon's breath, ranged weapons
 * of the realm and multi-faction hit resolution.
 * Projectiles use the shared pool (alien-strike/src/game/projectiles.js); this
 * module supplies the projHit / projExpire / projBurst hooks and custom
 * projectile styles, and replaces the engine's area-effect module (AS.Fields)
 * with the realm's: burning ground, frost, entangling roots, necrotic mist and
 * catapult impacts.
 * Direct fire travels in projected screen space like ALIEN STRIKE's, so what you
 * see is what you hit: a bolt at a dragon high above hits the dragon, a bolt
 * at a soldier hits the soldier. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;
  const P = () => AS.Particles;

  const BOLT = {
    arcane: { col: '#9fd8ff', core: '#ffffff', speed: 640, dmg: 10, r: 4 },
    verdant: { col: '#8affc0', core: '#f0fff0', speed: 700, dmg: 9.5, r: 4 },
    frost: { col: '#bfefff', core: '#ffffff', speed: 600, dmg: 10, r: 4, slow: 0.8 },
    necrotic: { col: '#a8ff6a', core: '#f0ffe0', speed: 620, dmg: 10, r: 4, drain: 0.15 },
  };

  const Combat = {
    BOLT,
    /* ---------------- the dragon rider's weapons ---------------- */
    dragonWeapons(d, dt) {
      const g = d.g, I = d.input;
      // wizard bolts
      d.fireCd -= dt;
      const bk = BOLT[d.fdef.rider.bolt] || BOLT.arcane;
      const cost = 4 * (d.buffs.rapid ? 0.4 : 1);
      if (I.fire && d.fireCd <= 0 && d.mana >= cost && !d.eatT) {
        d.fireCd = 1 / (d.boltRate * (d.buffs.rapid ? 1.9 : 1));
        d.mana -= cost;
        this.castBolt(d, bk);
      }
      // breath
      const want = I.breath && d.fireCharge > 4 && d.energy > 0 && !d.carry && d.eatT <= 0;
      if (want) {
        if (!d.breathing) {
          d.breathing = true; d.breathT = 0;
          AS.Audio.sfx('breath_start', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.7 });
          if (d.isPlayer) g.camera.pulseZoom(0.025, 0.5);
        }
        d.breathT += dt;
        d.fireCharge = Math.max(0, d.fireCharge - 32 * dt * (d.buffs.inferno ? 0.4 : 1));
        if (d.fireCharge <= 0) { d.breathing = false; d.fireDelay = 1.4; }
        this.breath(d, dt);
      } else if (d.breathing) { d.breathing = false; d.fireDelay = 0.7; }
      this.breathSound(d);
    },
    castBolt(d, bk) {
      const g = d.g, I = d.input;
      const st = d.drawState;
      const sx = st.staffX !== undefined ? st.staffX : d.x, sy = st.staffY !== undefined ? st.staffY : d.y - d.z - 16;
      const a = Math.atan2(I.aimY - sy, I.aimX - sx);
      // gentle aim assist: home on the hostile nearest the aim point
      let target = null, bd = 70 * 70;
      const cands = g.grid.query(I.aimX, I.aimY + 40, 120, this._q || (this._q = []));
      for (const e of cands) {
        if (!e.alive || e.targetable === false || !g.hostile(d.team, e.team)) continue;
        const ex = e.x, ey = e.py !== undefined ? e.py : e.y;
        const dd = (ex - I.aimX) * (ex - I.aimX) + (ey - I.aimY) * (ey - I.aimY);
        if (dd < bd) { bd = dd; target = e; }
      }
      cands.length = 0;
      const n = d.boltMulti + (d.buffs.power ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const spread = n > 1 ? (i - (n - 1) / 2) * 0.12 : 0;
        AS.Proj.missile({ team: d.team, x: sx, y: sy, a: a + spread, speed0: bk.speed * 0.85, speed: bk.speed, turn: target ? 3.2 : 0, life: 560 / bk.speed + 0.1,
          dmg: bk.dmg * d.boltDmg * (d.buffs.power ? 1.6 : 1), dtype: 'magic', r: bk.r, col: bk.col, size: 2.2, target: i === 0 ? target : null, tx: I.aimX, ty: I.aimY,
          owner: d, style: 'bolt', extra: { bk, splash: d.buffs.power ? 26 : 0 } });
      }
      d.cast = 1;
      AS.Audio.sfx('bolt_cast', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.6, rate: U.range(0.95, 1.08) * (d.fk === 'ice' ? 0.9 : d.fk === 'elf' ? 1.1 : 1) });
      P().spawn({ x: sx, y: sy + 30, z: 30, shape: P().GLOW, col: bk.col, size: 4, size2: 12, life: 0.12, add: true });
      AS.Renderer.flare(sx, sy, 34, bk.col, 0.5, 0.1);
    },

    /* the breath: a stream of flame from the jaws that falls onto the ground ahead */
    breathInfo(d) {
      const hd = d.nodes[0], s = d.scale;
      const a = hd.a;
      const mx = hd.x + Math.cos(a) * 14 * s, my = hd.y + Math.sin(a) * 14 * s, mz = hd.z + 2;
      const hi = U.clamp((mz - 24) / 60, 0, 1); // high breath lands further ahead and weaker
      const L = (150 + hi * 40) * s * (d.buffs.inferno ? 1.25 : 1);
      return { a, mx, my, mz, L, start: (10 + hi * 50) * s, half: 0.34, power: U.lerp(1, 0.55, hi) };
    },
    breath(d, dt) {
      const g = d.g, B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire;
      const bi = this.breathInfo(d), Pp = P();
      const ca = Math.cos(bi.a), sa = Math.sin(bi.a);
      d.breathInfoCache = bi;
      // particles: hot core, rolling flame, embers, smoke
      const rate = AS.Particles.density;
      const n = Math.round((d.isPlayer ? 9 : 6) * rate);
      for (let i = 0; i < n; i++) {
        const spr = (Math.random() - 0.5) * bi.half * 1.6, sp = 300 + Math.random() * 180;
        const a = bi.a + spr, life = 0.28 + Math.random() * 0.22;
        const vz = -(bi.mz) / (life * 1.3) * (0.6 + Math.random() * 0.5);
        Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: Math.cos(a) * sp + d.vx * 0.7, vy: Math.sin(a) * sp + d.vy * 0.7, vz, shape: Pp.SMOKE, col: B.cols[1], col2: B.cols[3], size: 2.5 * d.scale, size2: (11 + Math.random() * 8) * d.scale, life, alpha: 0.95, drag: 1.6, keep: d.isPlayer });
        if (Math.random() < 0.6) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: Math.cos(a) * sp * 1.05 + d.vx * 0.7, vy: Math.sin(a) * sp * 1.05 + d.vy * 0.7, vz: vz * 0.9, shape: Pp.GLOW, col: B.cols[0], col2: B.cols[2], size: 4 * d.scale, size2: 14 * d.scale, life: life * 0.8, add: true, drag: 1.4 });
      }
      if (Math.random() < 0.5) Pp.spawn({ x: bi.mx, y: bi.my, z: bi.mz, vx: ca * 420 + d.vx, vy: sa * 420 + d.vy, vz: -60, grav: 240, shape: Pp.STREAK, col: '#ffffff', col2: B.cols[2], size: 1, life: 0.4, add: true, len: 0.03 });
      // light from the jaws and the landing zone
      AS.Renderer.light(bi.mx, bi.my - bi.mz, 70 * d.scale, B.light, 0.55);
      AS.Renderer.light(bi.mx + ca * bi.L * 0.6, bi.my + sa * bi.L * 0.6, 90 * d.scale, B.light, 0.4);
      if (d.isPlayer && Math.random() < 0.3) g.camera.shake(0.04);
      // damage ticks (10 Hz)
      d.breathTick -= dt;
      if (d.breathTick > 0) return;
      d.breathTick = 0.1;
      const base = 11 * d.fireDmg * bi.power * (d.buffs.inferno ? 1.6 : 1);
      const R = bi.L + 40;
      const cx = bi.mx + ca * bi.L * 0.5, cy = bi.my + sa * bi.L * 0.5;
      const list = g.grid.query(cx, cy, R, []);
      for (const e of list) {
        if (!e.alive || e === d || e.targetable === false) continue;
        if (e.team === d.team) continue;
        if (!g.hostile(d.team, e.team) && !(e.team === 'neutral' && e.burnable)) continue;
        if (!this.inCone(bi, e.x, e.y, e.z || 0, e.r || 8)) continue;
        let dmg = base * (e.isBuilding ? 1.5 : 1) * (e.breathMul || 1);
        e.takeDamage(dmg, B.effect === 'freeze' ? 'frost' : B.effect === 'wither' ? 'necrotic' : 'fire', d);
        this.applyEffect(e, B.effect, d);
      }
      if (AS.Life) AS.Life.breathHit(g, d, bi, base, B);
      // the ground catches: scorch, frost, roots or mist
      if (Math.random() < 0.45 && bi.mz < 90) {
        const t = 0.45 + Math.random() * 0.55, off = (Math.random() - 0.5) * bi.half * 1.4;
        const gx = bi.mx + Math.cos(bi.a + off) * bi.L * t, gy = bi.my + Math.sin(bi.a + off) * bi.L * t;
        if (g.terrain.kindFast(gx, gy) === 0) {
          Fields.spawnPatch(g, B.effect, gx, gy, d);
          if (Math.random() < 0.5) g.terrain.addDecal(B.effect === 'freeze' ? 'frostmark' : 'scorch', gx, gy, 10 + Math.random() * 8);
        }
      }
    },
    inCone(bi, x, y, z, r) {
      const dx = x - bi.mx, dy = y - bi.my, dist = Math.hypot(dx, dy);
      if (dist > bi.L + r || dist < bi.start * 0.3 - r) return false;
      const ang = Math.abs(U.wrapAngle(Math.atan2(dy, dx) - bi.a));
      const half = bi.half + Math.atan2(r, Math.max(10, dist));
      if (ang > half) return false;
      // air targets must be near the stream's height at that distance
      const t = U.clamp(dist / bi.L, 0, 1), sz = bi.mz * (1 - t);
      return z < 30 ? sz < 70 || t > 0.4 : Math.abs(z - sz) < 55;
    },
    applyEffect(e, eff, src) {
      if (eff === 'burn') { if (e.ignite) e.ignite(3.5, src); }
      else if (eff === 'freeze') { e.slow = Math.max(e.slow || 0, 2.5); if (e.chill !== undefined) e.chill = Math.min(1, (e.chill || 0) + 0.12); if (e.isBuilding) e.brittle = Math.max(e.brittle || 0, 3); }
      else if (eff === 'entangle') { if (!e.isBuilding && !e.isDragon) e.root = Math.max(e.root || 0, 1.6); else if (e.ignite) e.ignite(2, src); }
      else if (eff === 'wither') { e.wither = Math.max(e.wither || 0, 4); e.witherSrc = src; }
    },
    breathSound(d) {
      const key = 'breath:' + d.fk;
      const B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire;
      const p = d.g.player;
      if (d.breathing) {
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        const vol = d.isPlayer ? 1 : U.clamp(1 - dist / 900, 0, 1) * 0.8;
        if (vol <= 0.02) { AS.Audio.stopLoop(key); return; }
        if (!AS.Audio.loops[key]) AS.Audio.startLoop(key, B.sfx, vol);
        else AS.Audio.loopParam(key, 1 + Math.sin(d.t * 3) * 0.04, vol);
      } else if (AS.Audio.loops && AS.Audio.loops[key]) AS.Audio.stopLoop(key);
    },

    /* ---------------- realm weapons: towers, archers, siege ---------------- */
    // kind: arrow | ballista | magic | spear | rock (giant) | stone (catapult)
    shoot(src, target, kind, o) {
      o = o || {};
      const g = src.g, team = src.team;
      const sx = o.x !== undefined ? o.x : src.x, sz = o.z !== undefined ? o.z : (src.shotZ || src.hc || 10);
      const sy = (o.y !== undefined ? o.y : src.y) - sz;
      const tpy = target.py !== undefined ? target.py : target.y;
      const d = Math.hypot(target.x - sx, tpy - sy);
      const dmgMul = o.dmgMul || 1;
      if (kind === 'stone' || kind === 'rock') {
        // lobbed: lead the target's ground position
        const T = kind === 'rock' ? 1.0 : U.clamp(d / 260, 1.1, 2.4);
        const lead = target.isDragon ? 0.6 : 0.85;
        const gx = target.x + (target.vx || 0) * T * lead + U.range(-14, 14), gy = target.y + (target.vy || 0) * T * lead + U.range(-14, 14);
        AS.Proj.lob({ team, sx: src.x, sy: src.y, sz, gx, gy, T, arc: kind === 'rock' ? 60 : 150, land: kind, dmg: (kind === 'rock' ? 34 : 46) * dmgMul, dtype: 'impact', radius: kind === 'rock' ? 26 : 44, col: '#8a7a6a', size: kind === 'rock' ? 4 : 5, owner: src, style: 'stone', warn: kind === 'stone', warnCol: '#ffb04a', extra: { airZ: target.isDragon ? target.z : 0, air: !!target.isDragon } });
        AS.Audio.sfx(kind === 'rock' ? 'monster_roar' : 'catapult', { x: src.x, y: src.y, vol: 0.6 });
        return;
      }
      const W = {
        arrow: { speed: 520, dmg: 4.5, r: 3, style: 'arrow', dtype: 'pierce_light', sfx: 'arrow', spread: 0.05, range: 380 },
        spear: { speed: 420, dmg: 7, r: 3, style: 'arrow', dtype: 'pierce_light', sfx: 'arrow', spread: 0.06, range: 260 },
        ballista: { speed: 820, dmg: 42, r: 5, style: 'ballista', dtype: 'pierce', sfx: 'ballista', spread: 0.015, range: 640 },
        magic: { speed: 380, dmg: 14, r: 5, style: 'magic', dtype: 'magic', sfx: 'bolt_cast', spread: 0, range: 520, homing: 2.2 },
        crossbow: { speed: 600, dmg: 7, r: 3, style: 'arrow', dtype: 'pierce_light', sfx: 'arrow', spread: 0.04, range: 360 },
      }[kind] || {};
      // lead the target
      const travel = d / W.speed;
      const lk = target.isDragon ? (kind === 'ballista' ? 0.95 : 0.6) : 0.7;
      const px = target.x + (target.vx || 0) * travel * lk, py = tpy + (target.vy || 0) * travel * lk;
      const a = Math.atan2(py - sy, px - sx) + U.range(-W.spread, W.spread) * (o.inacc || 1);
      const col = o.col || (kind === 'magic' ? (AS.Data.factions[team] ? AS.Data.factions[team].color : '#c08aff') : '#d8c8a0');
      if (W.homing) AS.Proj.missile({ team, x: sx, y: sy, a, speed0: W.speed * 0.6, speed: W.speed, turn: W.homing, life: W.range / W.speed + 0.4, dmg: W.dmg * dmgMul, dtype: W.dtype, r: W.r, col, target, owner: src, style: W.style });
      else AS.Proj.bolt({ team, x: sx, y: sy, a, speed: W.speed, range: Math.min(W.range, d + 80) * 1.15, dmg: W.dmg * dmgMul, dtype: W.dtype, r: W.r, col, owner: src, style: W.style, extra: { kind } });
      AS.Audio.sfx(W.sfx, { x: src.x, y: src.y, vol: kind === 'ballista' ? 0.9 : 0.4, rate: U.range(0.92, 1.1) });
      if (kind === 'ballista') AS.FX.muzzle(sx, sy + sz, sz, a, '#ffe8c0', 0.6);
    },

    /* ---------------- hit resolution (engine hooks) ---------------- */
    projHit(g, p) {
      if (p.type === 'lob') return false;
      const team = p.team;
      const cands = g.grid.query(p.x, p.y + 40, 120, this._hq || (this._hq = []));
      for (const e of cands) {
        if (!e.alive || e.targetable === false || e === p.owner) continue;
        if (!g.hostile(team, e.team)) continue;
        if (p.hits && p.hits.has(e)) continue;
        const ey = e.py !== undefined ? e.py : e.y;
        const rr = (e.hitR || e.r || 8) * 0.75 + p.r;
        if (U.segDist(e.x, ey, p.px, p.py, p.x, p.y) < rr) {
          cands.length = 0;
          this.hit(g, p, e);
          return true;
        }
      }
      cands.length = 0;
      if (AS.Life && p.team && AS.Life.projHit(g, p)) return true;
      return false;
    },
    hit(g, p, e) {
      let dmg = p.dmg;
      if (e.isDragon && p.dtype === 'pierce_light') dmg *= 0.8;
      if (e.isBuilding && p.dtype === 'pierce_light') dmg *= 0.25;
      if (e.isBuilding && p.dtype === 'magic') dmg *= 0.7;
      const dealt = e.takeDamage(dmg, p.dtype, p.owner);
      const bk = p.extra && p.extra.bk;
      if (p.style === 'bolt') {
        AS.FX.impact(p.x, p.y, 0, p.col, Math.atan2(p.vy, p.vx));
        AS.Audio.sfx('bolt_hit', { x: p.x, y: p.y + 40, vol: 0.6 });
        if (bk && bk.slow) e.slow = Math.max(e.slow || 0, bk.slow);
        if (bk && bk.drain && p.owner && p.owner.heal) p.owner.heal(dealt * bk.drain);
        if (p.extra.splash) g.damageArea(e.x, e.y, p.extra.splash, p.dmg * 0.5, 'magic', p.team, p.owner, { exclude: e });
      } else if (p.style === 'ballista') {
        AS.FX.impact(p.x, p.y, 0, '#ffe8c0', Math.atan2(p.vy, p.vx));
        AS.FX.sparks(p.x, p.y + 40, 40, 6, '#ffe0a0');
        AS.Audio.sfx('stone_hit', { x: p.x, y: p.y, vol: 0.5 });
        if (e.isDragon && e.isPlayer) { g.camera.shake(0.4); g.msg('BALLISTA HIT!', '#ff8a5a', 1.2); }
      } else if (p.style === 'magic') {
        AS.FX.impact(p.x, p.y, 0, p.col);
        AS.Audio.sfx('bolt_hit', { x: p.x, y: p.y, vol: 0.4, rate: 0.8 });
      } else {
        AS.Audio.sfx('arrow_hit', { x: p.x, y: p.y, vol: 0.4 });
        if (e.isDragon) AS.FX.sparks(p.x, p.y + 40, 40, 2, '#ffd27a');
      }
      if (p.owner && p.owner.isDragon && e.onHitBy) e.onHitBy(p.owner);
      if (p.owner && p.owner.isDragon && p.owner.isPlayer && e.isBuilding && e.hpBarT !== undefined) e.hpBarT = 3;
    },
    projExpire(g, p) {
      if (p.style === 'bolt') {
        // the bolt bursts on the ground beneath its end point
        AS.FX.groundHit(p.x, p.y + 20, p.col);
        P().spawn({ x: p.x, y: p.y + 20, z: 20, shape: P().GLOW, col: p.col, size: 3, size2: 10, life: 0.18, add: true });
        if (p.extra && p.extra.splash) g.damageArea(p.x, p.y + 30, p.extra.splash, p.dmg * 0.5, 'magic', p.team, p.owner, {});
      } else if (p.style === 'arrow') {
        if (Math.random() < 0.3) AS.FX.groundHit(p.x, p.y + 10, '#a89878');
      } else if (p.style === 'ballista') AS.FX.dust(p.x, p.y + 10, 3, '#a08a6a', 30);
    },
    projBurst(g, p) { this.projExpire(g, p); },

    /* glow under the breath stream so it reads as a cone of fire, not just puffs */
    drawBreaths(ctx, ox, oy, g, R) {
      for (const d of g.dragons) {
        if (!d.breathing || !d.breathInfoCache || d.hidden) continue;
        const bi = d.breathInfoCache, B = AS.Data.breaths[d.fdef.dragon.breath] || AS.Data.breaths.fire;
        const ca = Math.cos(bi.a), sa = Math.sin(bi.a);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // ground glow where the stream lands
        const gx = bi.mx + ca * bi.L * 0.62 - ox, gy = bi.my + sa * bi.L * 0.62 - oy;
        const gl = AS.Forge.glow(B.cols[2], 64);
        ctx.globalAlpha = 0.5 + Math.random() * 0.15;
        ctx.drawImage(gl, gx - bi.L * 0.55, gy - bi.L * 0.4, bi.L * 1.1, bi.L * 0.8);
        // the stream itself: a tapered wedge from the jaws
        const mx = bi.mx - ox, my = bi.my - bi.mz - oy;
        const ex = gx, ey = gy, w0 = 3 * d.scale, t = g.time + d.x * 0.01;
        const nx = -sa, ny = ca;
        // two flickering lobes: a wide soft plume and a hot narrow core
        for (const [wk, a0, a1, al] of [[0.3, 0.5, 0.3, 0.55], [0.13, 0.95, 0.6, 0.75]]) {
          const w1 = bi.L * wk * (0.88 + 0.12 * Math.sin(t * 23 + wk * 40)), bend = Math.sin(t * 9 + wk * 10) * w1 * 0.25;
          const grd = ctx.createLinearGradient(mx, my, ex, ey);
          grd.addColorStop(0, C.str(B.cols[0], a0)); grd.addColorStop(0.45, C.str(B.cols[1], a1)); grd.addColorStop(1, C.str(B.cols[2], 0));
          ctx.globalAlpha = al; ctx.fillStyle = grd;
          const cx = (mx + ex) / 2 + nx * bend, cy = (my + ey) / 2 + ny * bend;
          ctx.beginPath(); ctx.moveTo(mx + nx * w0, my + ny * w0); ctx.quadraticCurveTo(cx + nx * w1 * 0.7, cy + ny * w1 * 0.7, ex + nx * w1, ey + ny * w1);
          ctx.lineTo(ex - nx * w1, ey - ny * w1); ctx.quadraticCurveTo(cx - nx * w1 * 0.7, cy - ny * w1 * 0.7, mx - nx * w0, my - ny * w0); ctx.closePath(); ctx.fill();
        }
        // billows rolling out along the stream
        const W1 = bi.L * 0.3;
        for (let i = 0; i < 9; i++) {
          const f = (i / 9 + t * 2.4) % 1, wob = Math.sin(t * 13 + i * 2.1) * W1 * 0.4 * f;
          const px = mx + (ex - mx) * f + nx * wob, py = my + (ey - my) * f + ny * wob;
          const r = (w0 + (W1 * 1.15 - w0) * f) * (0.75 + 0.3 * Math.sin(t * 17 + i));
          ctx.globalAlpha = 0.42 * (1 - f * 0.75);
          ctx.drawImage(AS.Forge.glow(f < 0.3 ? B.cols[0] : B.cols[1], 64), px - r, py - r, r * 2, r * 2);
        }
        ctx.restore();
      }
    },
  };

  /* ---------------- projectile looks ---------------- */
  const S = AS.Proj.styles, TR = AS.Proj.trails;
  S.bolt = (ctx, p, sx, sy) => {
    const bk = (p.extra && p.extra.bk) || BOLT.arcane, a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a);
    const L = 14;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(sx, sy, sx - ca * L * 2, sy - sa * L * 2);
    gr.addColorStop(0, bk.col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = gr; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L * 2, sy - sa * L * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = bk.core; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L * 0.7, sy - sa * L * 0.7); ctx.stroke();
    const w = 7 + Math.sin(p.age * 40) * 1.5;
    ctx.drawImage(AS.Forge.glow(bk.col, 64), sx - w, sy - w, w * 2, w * 2);
    ctx.drawImage(AS.Forge.glow('#ffffff', 32), sx - 2.5, sy - 2.5, 5, 5);
    ctx.restore();
    AS.Renderer.light(p.x, p.y, 26, bk.col, 0.35);
  };
  TR.bolt = (p) => {
    p.trailT = 0.025;
    const bk = (p.extra && p.extra.bk) || BOLT.arcane;
    P().spawn({ x: p.x + U.range(-2, 2), y: p.y + 30 + U.range(-2, 2), z: 30, vx: U.range(-12, 12), vy: U.range(-12, 12), shape: P().GLOW, col: bk.col, size: 2.4, size2: 0.4, life: 0.3, add: true });
  };
  S.arrow = (ctx, p, sx, sy) => {
    const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), L = p.extra && p.extra.kind === 'spear' ? 9 : 7;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(sx + 0.6, sy + 0.8); ctx.lineTo(sx - ca * L + 0.6, sy - sa * L + 0.8); ctx.stroke();
    ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.strokeStyle = '#f4f0e8'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx - ca * (L - 1.5), sy - sa * (L - 1.5)); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.restore();
  };
  TR.arrow = (p) => { p.trailT = 1; };
  S.ballista = (ctx, p, sx, sy) => {
    const a = Math.atan2(p.vy, p.vx), ca = Math.cos(a), sa = Math.sin(a), L = 16;
    ctx.save(); ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff0d0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L * 3, sy - sa * L * 3); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ca * L, sy - sa * L); ctx.stroke();
    ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(sx + ca * 4, sy + sa * 4); ctx.lineTo(sx - sa * 2.2, sy + ca * 2.2); ctx.lineTo(sx + sa * 2.2, sy - ca * 2.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  TR.ballista = (p) => { p.trailT = 0.03; P().spawn({ x: p.x, y: p.y + 30, z: 30, shape: P().SMOKE, col: '#e8e0d0', size: 1.5, size2: 4, life: 0.35, alpha: 0.35 }); };
  S.magic = (ctx, p, sx, sy) => {
    const w = 6 + Math.sin(p.age * 30) * 1.2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(AS.Forge.glow(p.col, 64), sx - w * 1.6, sy - w * 1.6, w * 3.2, w * 3.2);
    ctx.drawImage(AS.Forge.glow('#ffffff', 32), sx - 2.4, sy - 2.4, 4.8, 4.8);
    ctx.restore();
    AS.Renderer.light(p.x, p.y, 24, p.col, 0.4);
  };
  TR.magic = (p) => { p.trailT = 0.03; P().spawn({ x: p.x, y: p.y + 20, z: 20, shape: P().GLOW, col: p.col, size: 3, size2: 0.5, life: 0.35, add: true }); };
  S.stone = (ctx, p, sx, sy, g, ox, oy) => {
    // ground shadow, then the tumbling boulder
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.gxNow - ox, p.gyNow - oy, p.size + 1.5, (p.size + 1.5) * 0.6, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.age * 7);
    ctx.fillStyle = '#4a4038'; ctx.beginPath(); ctx.arc(0, 0, p.size + 0.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9a8c7a'; ctx.beginPath(); ctx.moveTo(-p.size, -1); ctx.lineTo(-p.size * 0.3, -p.size); ctx.lineTo(p.size * 0.8, -p.size * 0.5); ctx.lineTo(p.size * 0.9, p.size * 0.4); ctx.lineTo(-p.size * 0.2, p.size * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8bca8'; ctx.beginPath(); ctx.arc(-p.size * 0.3, -p.size * 0.35, p.size * 0.32, 0, TAU); ctx.fill();
    ctx.restore();
  };
  TR.stone = (p) => { p.trailT = 0.05; };

  /* ---------------- area effects (replaces the engine's AS.Fields) ---------------- */
  const Fields = {
    spawnPatch(g, eff, x, y, src) {
      const list = AS.Proj.fields;
      if (list.length > 70) return;
      // merge with a nearby patch of the same kind instead of stacking
      for (const f of list) if (f.type === eff && Math.abs(f.x - x) < 16 && Math.abs(f.y - y) < 16) { f.t = Math.min(f.t, f.life * 0.3); return; }
      AS.Proj.field({ type: eff, x, y, r: 16 + Math.random() * 6, life: eff === 'burn' ? 4.5 : 3.5, team: src.team, src, seed: Math.random() * 100 });
    },
    land(g, p) {
      const x = p.gx, y = p.gy, R = p.radius;
      if (p.land === 'stone' || p.land === 'rock') {
        // a boulder can also strike a low-flying dragon over the landing point
        g.damageArea(x, y, R, p.dmg, 'impact', p.team, p.owner, { groundOnly: !p.extra || !p.extra.air });
        AS.FX.explosion(x, y, 2, R * 0.35, { col: '#fff0d0', col2: '#c8a070', debris: true, debrisCol: '#6a5a4a', dustCol: '#9a8a6a', lightCol: '#ffd0a0' });
        AS.FX.dust(x, y, 10, '#a0907a', 90);
        g.terrain.addDecal('crater', x, y, R * 0.5);
        AS.Audio.sfx('stone_hit', { x, y });
        g.shakeNear(x, y, 0.3);
      }
    },
    update(g, f, dt) {
      f.tick = (f.tick || 0) - dt;
      const k = 1 - f.t / f.life;
      if (Math.random() < 0.5 * AS.Particles.density) {
        const a = Math.random() * TAU, r = Math.random() * f.r * 0.8;
        const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.75;
        if (f.type === 'burn') { AS.FX.fire(x, y, 1, 6 * k + 2); if (Math.random() < 0.25) AS.FX.smoke(x, y, 6, 5, true); }
        else if (f.type === 'freeze') P().spawn({ x, y, z: 1, vz: 6, shape: P().GLOW, col: '#dff6ff', size: 2, size2: 0.4, life: 0.6, add: true });
        else if (f.type === 'entangle') P().spawn({ x, y, z: 1, vz: 10, shape: P().CIRCLE, col: '#8aff9a', col2: '#2a7a3a', size: 1.2, size2: 0.3, life: 0.5, add: true });
        else if (f.type === 'wither') P().spawn({ x, y, z: 2, vz: 8, shape: P().SMOKE, col: '#6a3a8a', col2: '#2a1a3a', size: 3, size2: 8, life: 1, alpha: 0.4 });
      }
      if (f.type === 'burn') AS.Renderer.light(f.x, f.y, 34, '#ff8a3a', 0.3 * k + 0.1);
      if (f.tick > 0) return;
      f.tick = 0.33;
      const list = g.grid.query(f.x, f.y, f.r + 20, []);
      for (const e of list) {
        if (!e.alive || e.isDragon || e.team === f.team || !g.hostile(f.team, e.team)) continue;
        if (Math.hypot(e.x - f.x, e.y - f.y) > f.r + (e.r || 6) * 0.5) continue;
        if (f.type === 'burn') { e.takeDamage(2.4, 'fire', f.src); if (e.ignite && Math.random() < 0.3) e.ignite(2, f.src); }
        else Combat.applyEffect(e, f.type, f.src);
      }
      if (AS.Life) AS.Life.fieldTouch(g, f);
    },
    end() {},
    drawGround(ctx, ox, oy, g) {
      for (const f of AS.Proj.fields) {
        const k = 1 - f.t / f.life, x = f.x - ox, y = f.y - oy;
        if (f.type === 'burn') {
          ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#1a0e08';
          ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * k;
          ctx.drawImage(AS.Forge.glow('#ff7a2a', 64), x - f.r * 1.2, y - f.r, f.r * 2.4, f.r * 2);
          ctx.globalCompositeOperation = 'source-over';
        } else if (f.type === 'freeze') {
          ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#e8f8ff';
          ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.7 * k;
          ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = f.seed + i * 1.3; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * f.r * 0.9, y + Math.sin(a) * f.r * 0.6); } ctx.stroke();
        } else if (f.type === 'entangle') {
          ctx.globalAlpha = 0.65 * k; ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 1.6;
          ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = f.seed + i * 1.05; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * f.r * 0.5, y + Math.sin(a + 0.6) * f.r * 0.4, x + Math.cos(a) * f.r, y + Math.sin(a) * f.r * 0.7); } ctx.stroke();
        } else if (f.type === 'wither') {
          ctx.globalAlpha = 0.4 * k; ctx.fillStyle = '#3a1a4a';
          ctx.beginPath(); ctx.ellipse(x, y, f.r * 1.1, f.r * 0.8, 0, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },
    drawOverlay(ctx, ox, oy, g) {
      // telegraph where catapult stones will land
      for (const f of AS.Proj.fields) {
        if (f.type !== 'warn') continue;
        const k = f.t / f.life;
        ctx.save(); ctx.globalAlpha = 0.3 + k * 0.4; ctx.strokeStyle = f.col || '#ffb04a'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy, f.r * (1 - k * 0.4), f.r * 0.7 * (1 - k * 0.4), 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    },
  };
  // 'warn' telegraph fields carry no gameplay
  const baseUpdate = Fields.update;
  Fields.update = function (g, f, dt) { if (f.type === 'warn') return; baseUpdate.call(Fields, g, f, dt); };

  /* frost decal: pale crystalline splash baked into the ground */
  AS.Decals.painters.frostmark = (ctx, d, x, y, rng) => {
    const R = d.r;
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#eaf6ff';
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.72, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7;
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = rng.next() * TAU; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R * 1.1, y + Math.sin(a) * R * 0.8); } ctx.stroke();
    ctx.globalAlpha = 1;
  };

  AS.Combat = Combat;
  AS.Fields = Fields;
})(window.AS);
