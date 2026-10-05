/* ALIEN STRIKE — mobile units (enemies and allied units).
 * Behaviour lives in AS.AI archetypes; this class owns movement, weapons,
 * perception, alerting, status effects, drawing and death. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  class Unit extends AS.Entity {
    constructor(g, kind, def, x, y, o) {
      super(g, def, x, y);
      o = o || {};
      this.kind = kind;
      this.id = o.id || null;
      this.team = o.team || def.team || 'enemy';
      this.air = def.cls === 'air';
      this.baseZ = this.air ? (def.alt || 30) : 0;
      this.z = this.baseZ;
      this.angle = o.angle !== undefined ? o.angle : Math.random() * TAU;
      this.gunAngle = this.angle;
      this.home = { x, y };
      this.leash = o.leash || 700;
      this.patrol = o.patrol || null; this.pi = 0;
      this.path = o.path || null;
      this.state = o.state || 'idle';
      this.alerted = false; this.alertT = 0; this.awareT = 0;
      this.cd = U.range(0.6, 1.8); this.cd2 = U.range(1, 3); this.burst = 0; this.burstT = 0;
      this.anim = Math.random() * 4; this.t = Math.random() * 10;
      this.target = null; this.tTimer = 0;
      this.lx = x; this.ly = y; // last known target position
      this.leapT = 0; this.leapZ = 0; this.leapHit = false;
      this.burrowed = false; this.hidden = false;
      this.dormant = true; this.alwaysActive = !!o.active;
      this.group = o.group || null; this.tags = o.tags || null;
      this.lastHurt = -10; this.hpBarT = 0; this.shieldHit = 0;
      this.isUnit = true;
      this.boss = !!def.boss;
      this.speedMul = o.speedMul || 1;
      this.sheet = AS.Art.sheet('unit', def, g.world);
      this.gunSheet = AS.Art.gun(def, g.world);
      this.gunZ = (def.model && def.model.gen === 'tracked') ? 7 : (def.model && def.model.gen === 'boat') ? 6 : 7;
      if (def.model && def.model.opt && def.model.opt.size) this.gunZ *= def.model.opt.size;
      this.ai = AS.AI[def.ai] || AS.AI.tank;
      this.mem = {};
      if (this.ai.init) this.ai.init(this, g, o);
      if (o.hidden) this.hidden = true;
      if (o.burrowed) this.burrowed = true;
      this.targetable = !this.burrowed;
      this.submerged = false;
    }

    get py() { return this.y - this.z - this.leapZ - this.hc; }

    /* ---------- perception ---------- */
    pickTarget() {
      const g = this.g;
      const foes = this.team === 'enemy' ? g.playerTeam() : g.hostilesNear(this.x, this.y, this.def.sight || 400);
      let best = null, bd = 1e9;
      const sight = (this.def.sight || 400) * g.visibility(this) * (this.alerted ? 1.5 : 1);
      for (const f of foes) {
        if (!f.alive || f.dying > 0 || f.hidden) continue;
        let d = U.dist(this.x, this.y, f.x, f.y);
        if (d > sight && !(this.alerted && f === g.player && d < sight * 1.6)) continue;
        if (f !== g.player) d *= this.def.cls === 'creature' ? 0.8 : 1.25; // creatures love easy prey
        if (d < bd) { bd = d; best = f; }
      }
      // survivors are prey for creatures — but only once the hunt is on and the prey is close
      if (this.team === 'enemy' && this.def.cls === 'creature' && !this.air && (this.alerted || g.time > 25)) {
        for (const s of g.survivors) {
          if (!s.alive || s.aboard || (s.group && s.group.caged)) continue;
          const d = U.dist(this.x, this.y, s.x, s.y) * 1.1;
          if (d < Math.min(bd, 240)) { bd = d; best = s; }
        }
      }
      return best;
    }

    alert(src) {
      if (this.team !== 'enemy') return;
      const was = this.alerted;
      this.alerted = true; this.alertT = 12;
      if (!was) {
        this.g.onAlert(this);
        // shout to nearby allies
        for (const o of this.g.enemyUnitsNear(this.x, this.y, 280)) {
          if (o !== this && !o.alerted && o.team === 'enemy') { o.alerted = true; o.alertT = 10; o.lx = this.lx; o.ly = this.ly; o.mem.heard = { x: this.lx, y: this.ly }; }
        }
      }
    }
    hear(x, y) {
      if (this.alerted || this.team !== 'enemy') return;
      this.mem.heard = { x: x + U.range(-60, 60), y: y + U.range(-60, 60) };
      this.state = 'investigate';
    }
    onHurt(dmg, dtype, src) {
      this.lastHurt = this.g.time; this.hpBarT = 3;
      if (src && src.alive !== false) { this.lx = src.x; this.ly = src.y; if (!this.target || this.target !== src) this.target = src.isUnit || src === this.g.player ? src : this.target; }
      this.alert(src);
      if (this.burrowed && this.ai.forceSurface) this.ai.forceSurface(this);
    }

    /* ---------- movement ---------- */
    moveToward(tx, ty, frac, dt) {
      const g = this.g;
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      let sp = (this.def.speed || 0) * (frac === undefined ? 1 : frac) * this.speedMul * (this.slow > 0 ? 0.45 : 1);
      if (d < 3) sp = 0;
      let a = Math.atan2(dy, dx);
      if (!this.air && sp > 0 && !this.convoy) a = this.passableDir(a);
      const k = 1 - Math.exp(-5 * dt);
      const want = Math.min(sp, d * 3);
      this.vx += (Math.cos(a) * want - this.vx) * k;
      this.vy += (Math.sin(a) * want - this.vy) * k;
      return d;
    }
    brake(dt) { const k = Math.exp(-5 * dt); this.vx *= k; this.vy *= k; }
    passableDir(a) {
      const g = this.g, L = this.r + 22;
      const amph = !!this.def.amphibious, waterOnly = !!this.def.waterOnly;
      const ok = (ang) => {
        const px = this.x + Math.cos(ang) * L, py = this.y + Math.sin(ang) * L;
        if (waterOnly) { const k = g.terrain.kindFast(px, py); if (k !== 1) return false; }
        else if (!g.terrain.groundPassable(px, py, amph)) return false;
        for (const s of g.solids) { if (s === this || (s.alive === false)) continue; const rr = s.r + this.r; if (U.dist2(px, py, s.x, s.y) < rr * rr) return false; }
        return true;
      };
      if (ok(a)) { this.avoid = 0; return a; }
      const side = this.avoidSide || (Math.random() < 0.5 ? 1 : -1);
      for (const off of [0.6, 1.1, 1.6, 2.2]) {
        if (ok(a + off * side)) { this.avoidSide = side; return a + off * side; }
        if (ok(a - off * side)) { this.avoidSide = -side; return a - off * side; }
      }
      return a + Math.PI; // dead end: back off
    }
    faceMove(dt) {
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 8) this.angle = U.turnToward(this.angle, Math.atan2(this.vy, this.vx), (this.def.turn || 3) * dt);
    }
    faceTo(x, y, dt, rateMul) { this.angle = U.turnToward(this.angle, Math.atan2(y - this.y, x - this.x), (this.def.turn || 3) * (rateMul || 1) * dt); }
    aimGun(t, dt) {
      if (!t) return;
      const ta = Math.atan2((t.py !== undefined ? t.py : t.y) - this.py, t.x - this.x);
      this.gunAngle = U.turnToward(this.gunAngle, ta, 3.5 * dt);
      return Math.abs(U.wrapAngle(ta - this.gunAngle));
    }

    /* ---------- weapons ---------- */
    fire(w, t, opts) {
      if (!t) return;
      const g = this.g;
      opts = opts || {};
      const tpy = t.py !== undefined ? t.py : t.y;
      const sx = this.x + Math.cos(this.gunAngle) * (this.r * 0.6), sy = this.py + Math.sin(this.gunAngle) * (this.r * 0.5);
      const d = U.dist(sx, sy, t.x, tpy);
      // lead the target
      const travel = d / (w.speed || 400);
      const tvx = t.vx || 0, tvy = t.vy || 0;
      const px = t.x + tvx * travel * 0.7, py = tpy + tvy * travel * 0.7;
      const a = Math.atan2(py - sy, px - sx);
      const team = this.team;
      const col = w.col || '#ffd0a0';
      const dmgMul = g.diffMul || 1;
      switch (w.k) {
        case 'bullet': case 'plasma':
          AS.Proj.bolt({ team, x: sx, y: sy, a: a + U.range(-(w.spread || 0.03), w.spread || 0.03), speed: w.speed || 420, range: (w.range || 350) * 1.25, dmg: w.dmg * dmgMul, dtype: w.dtype || (w.k === 'plasma' ? 'energy' : 'kinetic'), col, size: w.size || (w.k === 'plasma' ? 3 : 2), r: w.k === 'plasma' ? 4 : 3, owner: this });
          AS.Audio.sfx(w.k === 'plasma' ? 'enemy_plasma' : 'enemy_shot', { x: this.x, y: this.y, vol: 0.5, rate: U.range(0.9, 1.1) });
          break;
        case 'acid':
          AS.Proj.bolt({ team, x: sx, y: sy, a: a + U.range(-0.06, 0.06), speed: w.speed || 260, range: (w.range || 300) * 1.2, dmg: w.dmg * dmgMul, dtype: w.dtype || 'bio', col, size: w.big ? 4 : 3, r: w.big ? 5 : 4, owner: this, arc: Math.min(30, d * 0.08) });
          AS.Audio.sfx('spit', { x: this.x, y: this.y, vol: 0.5 });
          break;
        case 'flak': {
          const fl = Math.max(0.2, d / (w.speed || 330));
          AS.Proj.bolt({ team, x: sx, y: sy, a: a + U.range(-0.08, 0.08), speed: w.speed || 330, range: Math.min(w.range * 1.2, d + 30), dmg: w.dmg * dmgMul, dtype: 'explosive', col, size: 2, r: 3, owner: this, prox: 22, splash: w.radius || 30 });
          AS.Audio.sfx('flak', { x: this.x, y: this.y, vol: 0.5 });
          break;
        }
        case 'shell': {
          const gx = t.x + tvx * (w.flight || 1.6) * 0.8 + U.range(-30, 30), gy = t.y + tvy * (w.flight || 1.6) * 0.8 + U.range(-30, 30);
          AS.Proj.lob({ team, sx: this.x, sy: this.y, sz: this.z + 12, gx, gy, T: w.flight || 1.6, arc: 160, land: 'explode', dmg: w.dmg * dmgMul, dtype: 'explosive', radius: w.radius || 50, col, size: 3, owner: this, warn: true, burn: w.burn });
          AS.Audio.sfx('artillery', { x: this.x, y: this.y, vol: 0.7 });
          break;
        }
        case 'spore': {
          const fl = U.clamp(d / (w.speed || 220), 0.6, 2.2);
          AS.Proj.lob({ team, sx: this.x, sy: this.y, sz: this.z + this.hc, gx: t.x + U.range(-20, 20), gy: t.y + U.range(-20, 20), T: fl, arc: w.lob ? 120 : 40, land: 'spore', dmg: w.dmg * dmgMul, dtype: 'bio', radius: w.radius || 50, col, size: 3, owner: this, warn: !!w.lob, warnCol: col });
          AS.Audio.sfx('spit', { x: this.x, y: this.y, vol: 0.4, rate: 0.7 });
          break;
        }
        case 'missile':
          AS.Proj.missile({ team, x: sx, y: sy - 4, a: this.gunAngle - Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1) * 0.5, speed0: 90, speed: w.speed || 260, turn: w.turn || 2.4, life: 6.5, dmg: w.dmg * dmgMul, splash: 26, target: t, col, r: 5, hp: 6, owner: this });
          AS.Audio.sfx('enemy_missile', { x: this.x, y: this.y });
          if (t === g.player) { g.player.warnOnce('missile', 'missile_incoming', 9); g.missileWarn = 1.2; }
          break;
        case 'beam': {
          const L = w.range || 420;
          const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
          AS.Proj.beam({ x1: sx, y1: sy, x2: ex, y2: ey, charge: w.charge || 0.9, dur: 0.45, dmg: w.dmg * dmgMul, col, owner: this });
          AS.Audio.sfx('beam_charge', { x: this.x, y: this.y, vol: 0.6 });
          break;
        }
        case 'lightning': {
          if (d > (w.range || 200)) return;
          AS.Proj.zap(sx, sy, t.x, tpy, col, 1.2);
          if (t.takeDamage) t.takeDamage(w.dmg * dmgMul, 'energy', this, Math.atan2(sy - tpy, sx - t.x));
          AS.Audio.sfx('zap', { x: this.x, y: this.y });
          break;
        }
        case 'bomb':
          AS.Proj.lob({ team, sx: this.x, sy: this.y, sz: this.z, gx: this.x + this.vx * 0.5, gy: this.y + this.vy * 0.5, T: 0.7, arc: 0, land: w.dtype === 'bio' ? 'acid' : 'explode', dmg: w.dmg * dmgMul, dtype: w.dtype || 'explosive', radius: w.radius || 50, col, size: 3, owner: this });
          AS.Audio.sfx('bomb_drop', { x: this.x, y: this.y, vol: 0.5 });
          break;
        case 'melee':
          if (t.takeDamage) t.takeDamage(w.dmg * dmgMul, w.dtype || 'kinetic', this, Math.atan2(this.y - t.y, this.x - t.x));
          AS.Audio.sfx('bite', { x: this.x, y: this.y, vol: 0.6 });
          break;
        case 'leap':
          this.leapT = 0.55; this.leapDur = 0.55; this.leapHit = false;
          const la = Math.atan2(t.y - this.y, t.x - this.x);
          const ld = Math.min(U.dist(this.x, this.y, t.x, t.y) + 10, (w.range || 80) + 20);
          this.vx = Math.cos(la) * ld / 0.55; this.vy = Math.sin(la) * ld / 0.55;
          this.leapTarget = t; this.leapW = w;
          AS.Audio.sfx(this.def.sfx && this.def.sfx.attack || 'screech', { x: this.x, y: this.y, vol: 0.5, rate: U.range(0.9, 1.15) });
          break;
        case 'burst':
          this.g.damageArea(this.x, this.y, w.radius || 60, w.dmg * dmgMul, w.dtype || 'bio', this.team, this, {});
          AS.FX.explosion(this.x, this.y, this.z, (w.radius || 60) * 0.4, { col: '#fff0ff', col2: col, debris: false });
          if (g.hazards) AS.Proj.field({ type: 'spore', x: this.x, y: this.y, r: (w.radius || 60) * 0.8, life: 4, dps: 3, team: this.team, col });
          this.hp = 0; this.alive = false; this.die(null, { silent: true });
          break;
      }
    }
    /* cooldown/burst helper: returns true when a shot is released */
    tryFire(w, t, dt, slot) {
      if (!w || !t || this.stun > 0) return false;
      const key = slot === 2 ? 'cd2' : 'cd';
      const bk = slot === 2 ? 'burst2' : 'burst';
      this[key] -= dt;
      if (this[bk] > 0) {
        this[bk + 'T'] = (this[bk + 'T'] || 0) - dt;
        if (this[bk + 'T'] <= 0) { this[bk]--; this[bk + 'T'] = 0.12; this.fire(w, t); return true; }
        return false;
      }
      if (this[key] > 0) return false;
      const d = U.dist(this.x, this.y, t.x, t.y);
      if (d > (w.range || 300)) return false;
      this[key] = (1 / (w.rate || 1)) * U.range(0.85, 1.2) * (this.g.diffRate || 1);
      this.fire(w, t);
      if (w.burst > 1) { this[bk] = w.burst - 1; this[bk + 'T'] = 0.12; }
      return true;
    }

    /* ---------- update ---------- */
    update(dt) {
      const g = this.g;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hpBarT > 0) this.hpBarT -= dt;
      if (this.shieldHit > 0) this.shieldHit -= dt;
      if (this.slow > 0) this.slow -= dt;
      if (this.alertT > 0) { this.alertT -= dt; if (this.alertT <= 0 && this.team === 'enemy') this.alerted = false; }
      if (this.stun > 0) {
        this.stun -= dt; this.brake(dt);
        if (Math.random() < 0.3) AS.FX.sparks(this.x + U.range(-6, 6), this.y, this.z + this.hc, 1, '#9fd0ff');
        if (this.air) this.z = U.damp(this.z, this.baseZ * 0.6, 2, dt);
      } else {
        // re-target periodically
        this.tTimer -= dt;
        if (this.tTimer <= 0) { this.tTimer = 0.4 + Math.random() * 0.3; const t = this.pickTarget(); if (t) { this.target = t; this.lx = t.x; this.ly = t.y; this.awareT = 2; if (this.team === 'enemy' && t === g.player) this.alert(); } else if (this.target && (!this.target.alive || this.awareT <= 0)) this.target = null; }
        if (this.awareT > 0) this.awareT -= dt;
        if (this.target && (this.target.alive === false || this.target.aboard || this.target.dying > 0)) this.target = null;
        this.ai.update(this, dt, g);
      }
      // shields regenerate slowly on elites
      if (this.maxShield > 0 && this.g.time - this.lastHurt > 6 && this.shield < this.maxShield) this.shield = Math.min(this.maxShield, this.shield + this.maxShield * 0.08 * dt);
      // leap arc
      if (this.leapT > 0) {
        this.leapT -= dt;
        const k = 1 - this.leapT / this.leapDur;
        this.leapZ = Math.sin(k * Math.PI) * 22;
        const t = this.leapTarget;
        if (t && !this.leapHit && t.alive !== false) {
          const tz = t.z || 0;
          if (U.dist(this.x, this.y, t.x, t.y) < this.r + (t.r || 8) + 6 && this.leapZ + 8 >= tz * 0.6) {
            this.leapHit = true;
            if (t.takeDamage) t.takeDamage(this.leapW.dmg * (g.diffMul || 1), this.leapW.dtype || 'bio', this, Math.atan2(this.y - t.y, this.x - t.x));
            AS.Audio.sfx('bite', { x: this.x, y: this.y, vol: 0.6 });
            this.vx *= -0.4; this.vy *= -0.4;
          }
        }
        if (this.leapT <= 0) { this.leapZ = 0; this.vx *= 0.3; this.vy *= 0.3; }
      }
      // integrate
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (!this.air && this.leapT <= 0) this.collideSolids();
      if (!this.air && this.def.waterOnly === undefined && !this.def.amphibious && !this.convoy) {
        // keep ground units on passable terrain
        if (!g.terrain.groundPassable(this.x, this.y, false)) { this.x -= this.vx * dt * 1.5; this.y -= this.vy * dt * 1.5; this.vx *= -0.3; this.vy *= -0.3; }
      }
      this.x = U.clamp(this.x, 10, g.map.w - 10); this.y = U.clamp(this.y, 10, g.map.h - 10);
      const sp = Math.hypot(this.vx, this.vy);
      this.anim += dt * (this.def.cls === 'creature' || this.def.model.anims > 1 ? (2 + sp * 0.06) : 0);
      if (this.air) this.z = U.damp(this.z, this.baseZ + Math.sin(this.t * 2 + this.uid) * 2, 2, dt);
      if (this.burn > 0) { this.burn -= dt; if (Math.random() < 0.4) AS.FX.fire(this.x, this.y, this.z + this.hc, this.r); }
      // damage smoke
      if (this.mech && this.hp < this.maxHp * 0.4 && Math.random() < 0.08) AS.FX.smoke(this.x, this.y, this.z + this.hc, this.r * 0.4, true);
      // engine glow lights
      if (this.def.cls === 'vehicle' && !this.burrowed) AS.Renderer.light(this.x, this.y - this.z - 2, this.r * 1.2, this.def.team === 'player' ? '#7fe8ff' : '#b07cff', 0.12);
    }

    collideSolids() {
      const g = this.g;
      for (const s of g.solids) {
        if (s === this || s.alive === false) continue;
        const dx = this.x - s.x, dy = this.y - s.y, rr = this.r + s.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2); this.x = s.x + dx / d * rr; this.y = s.y + dy / d * rr; }
      }
    }

    /* ---------- death ---------- */
    die(src, opts) {
      const g = this.g;
      this.removed = true;
      opts = opts || {};
      const big = this.r >= 18;
      if (this.organic && !this.mech) {
        AS.FX.splat(this.x, this.y, this.z + this.hc, this.def.splat || '#9a8a40', big ? 30 : 14);
        AS.FX.explosion(this.x, this.y, this.z + this.hc * 0.5, this.r * 0.5, { col: '#fff0c0', col2: this.def.splat || '#9a8a40', debris: false, lightCol: this.def.splat });
        if (!this.air) g.terrain.addDecal('splat', this.x, this.y, this.r * 1.2, this.def.splat || '#6a5a2a');
      } else {
        AS.FX.explosion(this.x, this.y, this.z + this.hc * 0.5, this.r * (big ? 1.1 : 0.85));
        if (!this.air) g.terrain.addDecal(big ? 'crater' : 'scorch', this.x, this.y, this.r * 1.3);
        else { // falling wreck
          for (let i = 0; i < 3; i++) AS.Particles.spawn({ x: this.x, y: this.y, z: this.z, vx: this.vx * 0.5 + U.range(-30, 30), vy: this.vy * 0.5 + U.range(-30, 30), vz: 20, grav: 200, shape: AS.Particles.SHARD, col: '#3a3436', size: 4, life: 1.2, vr: 8 });
          g.terrain.addDecal('scorch', this.x + this.vx * 0.3, this.y + this.vy * 0.3, this.r);
        }
      }
      if (!opts.silent) AS.Audio.sfx((this.def.sfx && this.def.sfx.die) || (this.organic ? 'creature_die' : 'explode_med'), { x: this.x, y: this.y, rate: U.range(0.9, 1.1) });
      g.shakeNear(this.x, this.y, big ? 0.5 : 0.15);
      g.onUnitKilled(this, src);
    }

    /* ---------- drawing ---------- */
    drawShadow(ctx, ox, oy) {
      if (this.burrowed || this.submerged || !this.sheet) return;
      if (this.hidden) return;
      AS.Renderer.shadow(ctx, this.sheet, this.angle, this.x, this.y, this.z + this.leapZ, ox, oy);
    }
    draw(ctx, ox, oy, R) {
      const g = this.g;
      if (this.burrowed || this.submerged) {
        if (this.ai.drawHidden) this.ai.drawHidden(this, ctx, ox, oy);
        return;
      }
      let alpha = 1;
      if (this.hidden) alpha = this.ai.hiddenAlpha ? this.ai.hiddenAlpha(this) : 0.25;
      if (this.def.camo && g.hazards && g.hazards.whiteout > 0.3) alpha = Math.min(alpha, 1 - g.hazards.whiteout * 0.6);
      const z = this.z + this.leapZ;
      R.sprite(ctx, this.sheet, this.angle, this.anim, this.x, this.y, z, ox, oy, alpha);
      if (this.gunSheet && !this.hidden) R.sprite(ctx, this.gunSheet, this.gunAngle, 0, this.x, this.y, z + this.gunZ, ox, oy, alpha);
      if (this.flash > 0) R.flashSprite(ctx, this.sheet, this.angle, this.anim, this.x, this.y, z, ox, oy);
      if (this.shield > 0 && (this.shieldHit > 0 || this.def.elite)) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.shieldHit > 0 ? 0.6 : 0.18 + Math.sin(this.t * 4) * 0.06;
        ctx.strokeStyle = '#c8a0ff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(this.x - ox, this.py - oy, this.r + 4, (this.r + 4) * 0.8, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (this.hpBarT > 0 && this.team === 'enemy' && !this.boss) {
        const w = Math.max(14, this.r * 1.6), x = Math.round(this.x - ox - w / 2), y = Math.round(this.py - oy - this.r - 8);
        ctx.globalAlpha = Math.min(1, this.hpBarT);
        ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
        ctx.fillStyle = '#ff5a3a'; ctx.fillRect(x, y, Math.max(0, w * this.hp / this.maxHp), 2);
        if (this.maxShield) { ctx.fillStyle = '#b08aff'; ctx.fillRect(x, y + 2, Math.max(0, w * this.shield / this.maxShield), 1); }
        ctx.globalAlpha = 1;
      }
      if (this.team === 'player' && this.def.cls !== 'air') {
        ctx.fillStyle = '#7fe8ff'; ctx.fillRect(Math.round(this.x - ox) - 1, Math.round(this.py - oy - this.r - 6), 3, 3);
      }
    }
  }
  AS.Unit = Unit;
})(window.AS);
