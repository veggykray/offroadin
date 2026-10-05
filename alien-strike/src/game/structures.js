/* ALIEN STRIKE — structures: turrets, missile batteries, radar, comm relays,
 * power nodes, shield generators, spawners, depots, pens, consoles, pads and
 * objective targets. Links between them (power → turrets, generator → shielded
 * targets, comms → reinforcements, radar → missile range) create the objective
 * interplay: knock out the right building and a whole defence network fails. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  class Structure extends AS.Entity {
    constructor(g, kind, def, x, y, o) {
      super(g, def, x, y);
      o = o || {};
      this.o = o;
      this.kind = kind; this.id = o.id || null;
      this.isStructure = true;
      this.team = o.team || def.team || 'enemy';
      this.role = def.role;
      if (o.hp) this.hp = this.maxHp = o.hp;
      this.sheet = AS.Art.sheet('struct', def, g.world);
      this.gunSheet = AS.Art.gun(def, g.world);
      this.anim = Math.random() * 8; this.t = Math.random() * 10;
      this.gunAngle = Math.random() * TAU; this.cd = U.range(0.5, 2); this.burst = 0; this.burstT = 0;
      this.solid = !!(def.solid || o.solid);
      this.invuln = o.invuln !== undefined ? !!o.invuln : !!def.invuln;
      this.targetable = !this.invuln;
      this.poweredBy = o.poweredBy || []; this.powered = true;
      this.shieldedBy = o.shieldedBy || []; this.domeDown = 0;
      this.spawnT = def.spawn ? U.range(2, def.spawn.interval) : 0; this.spawned = [];
      this.hpBarT = 0; this.collapse = 0; this.ruin = false; this.dead = false;
      this.submerged = !!(def.submerged || o.submerged); this.scanned = false;
      if (this.submerged) this.targetable = false;
      this.scanTarget = !!(o.scan || this.submerged);
      this.locked = !!o.locked;
      this.interactTime = o.time || def.time || 2.5;
      this.label = o.label || def.name;
      this.hidden = !!o.hidden; // revealed by scanner L3 / discovery
      this.gunZ = def.gunZ || 6;
      this.releases = o.releases || null;
      this.lockT = 0;
      this.pad = def.role === 'pad' ? Object.assign({ repair: false, refuel: false, rearm: false, dropoff: true }, o.pad || {}) : null;
      if (this.pad) this.def = Object.assign({}, def, this.pad);
      this.activated = false; // consoles
      this.sight = def.sight || 400;
    }
    get py() { return this.y - this.hc; }
    get sortY() { return this.def.flat ? this.y - 1000 : this.y; }

    isShielded() {
      if (!this.shieldedBy.length) return false;
      for (const id of this.shieldedBy) {
        const s = this.g.byId.get(id);
        if (s && s.alive && s.powered && !(s.domeDown > 0) && !(s.stun > 0)) return true;
      }
      return false;
    }

    update(dt) {
      const g = this.g;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hpBarT > 0) this.hpBarT -= dt;
      if (this.domeDown > 0) this.domeDown -= dt;
      if (!this.alive) {
        if (this.collapse > 0) {
          this.collapse -= dt;
          if (Math.random() < 0.5) AS.FX.dust(this.x + U.range(-this.r, this.r), this.y + U.range(-this.r, this.r) * 0.5, 1, '#6a5e54', 60);
        }
        if (this.burnT > 0) { this.burnT -= dt; if (Math.random() < 0.5) AS.FX.fire(this.x + U.range(-this.r, this.r) * 0.5, this.y, 2, this.r * 0.4); if (Math.random() < 0.2) AS.FX.smoke(this.x, this.y, 6, this.r * 0.5, true); }
        return;
      }
      // power
      if (this.poweredBy.length) {
        let any = false;
        for (const id of this.poweredBy) { const s = g.byId.get(id); if (s && s.alive) { any = true; break; } }
        if (this.powered && !any) { this.powered = false; AS.FX.sparks(this.x, this.y, this.hc, 12, '#9fd0ff'); }
        this.powered = any;
      }
      if (this.stun > 0) { this.stun -= dt; if (Math.random() < 0.2) AS.FX.sparks(this.x, this.y, this.hc, 1, '#9fd0ff'); return; }
      const anims = this.sheet ? this.sheet.anims : 1;
      if (anims > 1 && this.powered) this.anim += dt * (this.role === 'radar' ? 3 : 2);
      if (this.mech && this.hp < this.maxHp * 0.5 && Math.random() < 0.1) AS.FX.smoke(this.x + U.range(-this.r, this.r) * 0.4, this.y, this.hc, this.r * 0.4, this.hp < this.maxHp * 0.25);
      if (this.team !== 'enemy') return;
      switch (this.role) {
        case 'turret': case 'sam': this.turret(dt); break;
        case 'spawner': this.spawner(dt); break;
        case 'radar': if (this.powered) AS.Renderer.light(this.x, this.y - this.hc - 18, 12, '#ff5a5a', 0.4 * (Math.sin(this.t * 4) > 0 ? 1 : 0.2)); break;
        case 'comms': if (this.powered && Math.sin(this.t * 3) > 0.6) AS.Renderer.light(this.x, this.y - (this.def.model.opt && this.def.model.opt.h || 46) - 2, 16, this.g.world.choir.g, 0.6); break;
        case 'shieldgen': if (this.powered && !(this.domeDown > 0)) AS.Renderer.light(this.x, this.y - 22, 26, '#c8a0ff', 0.4); break;
        case 'power': if (this.powered) AS.Renderer.light(this.x - 6, this.y - 22, 30, this.g.world.choir.g, 0.45); break;
      }
    }

    pickTarget() {
      const g = this.g;
      const range = (this.def.weapon && this.def.weapon.range || 400) * (g.radarCovers(this.x, this.y) ? 1.1 : 1) * g.visibility(this);
      let best = null, bd = range;
      for (const f of g.playerTeam()) {
        if (!f.alive || f.dying > 0 || f.hidden) continue;
        const d = U.dist(this.x, this.y, f.x, f.y);
        const w = f === g.player ? d : d * 1.2;
        if (w < bd) { bd = w; best = f; }
      }
      return best;
    }

    // structures share the unit firing code (Unit.prototype.tryFire calls this.fire)
    fire(w, t, opts) { return AS.Unit.prototype.fire.call(this, w, t, opts); }

    turret(dt) {
      const g = this.g, w = this.def.weapon;
      if (!this.powered || !w) return;
      this.tT = (this.tT || 0) - dt;
      if (this.tT <= 0) { this.tT = 0.4; this.target = this.pickTarget(); if (this.target === g.player) g.alertAt(this.x, this.y, 300); }
      const t = this.target;
      if (!t || !t.alive) { this.gunAngle += dt * 0.3; return; }
      const ta = Math.atan2((t.py !== undefined ? t.py : t.y) - this.py, t.x - this.x);
      this.gunAngle = U.turnToward(this.gunAngle, ta, 2.6 * dt);
      if (Math.abs(U.wrapAngle(ta - this.gunAngle)) > 0.3) return;
      if (this.role === 'sam') {
        const covered = g.radarCovers(this.x, this.y);
        const range = covered ? w.range : w.range * 0.4;
        this.cd -= dt;
        if (U.dist(this.x, this.y, t.x, t.y) < range && this.cd <= 0) {
          this.lockT += dt;
          if (t === g.player) g.lockWarn = Math.max(g.lockWarn, 0.2);
          if (Math.floor(this.lockT * 4) !== Math.floor((this.lockT - dt) * 4) && t === g.player) AS.Audio.sfx('lock_warn', { vol: 0.35 });
          if (this.lockT > 1.4) { this.lockT = 0; this.cd = 1 / w.rate; AS.Unit.prototype.fire.call(this, w, t); }
        } else this.lockT = Math.max(0, this.lockT - dt);
        return;
      }
      AS.Unit.prototype.tryFire.call(this, w, t, dt);
    }

    spawner(dt) {
      const g = this.g, sp = this.def.spawn;
      if (!this.powered) return;
      this.spawned = this.spawned.filter((u) => u.alive);
      const pl = g.player;
      const near = pl && pl.alive && U.dist(this.x, this.y, pl.x, pl.y) < (this.o.trigger || 650);
      if (!near && !this.forced) return;
      this.spawnT -= dt;
      if (this.spawnT > 0 || this.spawned.length >= (this.o.max || sp.max)) return;
      this.spawnT = (this.o.interval || sp.interval) * U.range(0.8, 1.2);
      const types = this.o.types || sp.types;
      const kind = U.pick(types);
      if (sp.pods) {
        // spore tower: launch a pod that hatches where it lands
        const a = Math.random() * TAU, d = U.range(80, 200);
        const gx = this.x + Math.cos(a) * d, gy = this.y + Math.sin(a) * d;
        const p = AS.Proj.lob({ team: 'enemy', sx: this.x, sy: this.y, sz: this.hc + 20, gx, gy, T: 1.1, arc: 90, land: 'burst', dmg: 0, radius: 10, col: this.def.model.pal.g || '#d0ff6a', size: 3 });
        g.later(1.15, () => { if (!g.ended) { const u = g.spawnUnit(kind, gx, gy, { state: 'hunt' }); if (u) { u.alerted = true; u.alertT = 15; this.spawned.push(u); } } });
        AS.Audio.sfx('spore_launch', { x: this.x, y: this.y });
      } else {
        const a = Math.random() * TAU;
        const u = g.spawnUnit(kind, this.x + Math.cos(a) * (this.r + 14), this.y + Math.sin(a) * (this.r + 14), {});
        if (u) { u.alerted = true; u.alertT = 15; this.spawned.push(u); AS.FX.dust(u.x, u.y, 6, '#8a7a6a', 40); }
      }
    }

    takeDamage(amount, dtype, src, opts) {
      if (this.submerged && !this.scanned) return 0;
      const d = super.takeDamage(amount, dtype, src, opts);
      if (d > 0) { this.hpBarT = 3; if (this.team === 'enemy') this.g.alertAt(this.x, this.y, 350); }
      return d;
    }

    die(src) {
      const g = this.g;
      this.dead = true; this.ruin = true; this.targetable = false;
      const R = this.r;
      const big = R >= 22;
      AS.FX.explosion(this.x, this.y, this.hc * 0.6, R * (big ? 1.1 : 0.9), { debrisCol: this.organic ? '#3a2a1a' : '#4a4440', col2: this.organic ? (this.def.splat || '#9a8a40') : undefined });
      if (this.organic) AS.FX.splat(this.x, this.y, this.hc, this.def.splat || '#9a8a40', 24);
      AS.FX.shockwave(this.x, this.y, R * 2.2);
      g.terrain.addDecal(big ? 'crater' : 'scorch', this.x, this.y, R * 1.3, this.def.splat);
      AS.Audio.sfx(big ? 'explode_big' : 'explode_med', { x: this.x, y: this.y });
      g.shakeNear(this.x, this.y, big ? 0.7 : 0.35);
      if (big) g.camera.pulseZoom(-0.025, 0.5);
      // secondary explosions
      const n = big ? 5 : 2;
      for (let i = 0; i < n; i++) g.later(0.25 + i * 0.22 + Math.random() * 0.2, () => {
        const a = Math.random() * TAU, r = Math.random() * R;
        AS.FX.explosion(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * 0.6, this.hc * Math.random(), R * 0.35);
        AS.Audio.sfx('explode_small', { x: this.x, y: this.y, rate: U.range(0.8, 1.2) });
      });
      if (this.hc > 14) this.collapse = 0.9;
      this.burnT = big ? 8 : 4;
      this.rubble = AS.Art.rubble(g.world, Math.max(10, R * 0.9), this.uid);
      this.solid = false;
      g.onStructureDestroyed(this, src);
    }

    /* ---------- interaction (consoles, scan targets) ---------- */
    canInteract(p) {
      if (this.scanTarget && !this.scanned) return true;
      if (this.role === 'console' && !this.activated && !this.locked) return true;
      return false;
    }
    interactLabel() {
      if (this.scanTarget && !this.scanned) return 'HOLD E — SCAN ' + this.label.toUpperCase();
      return 'HOLD E — ' + (this.o.verb || 'ACTIVATE') + ' ' + this.label.toUpperCase();
    }
    get interactRange() { return this.r + 60; }
    complete(p) {
      const g = this.g;
      if (this.scanTarget && !this.scanned) {
        this.scanned = true;
        if (this.submerged) this.targetable = true;
        AS.Audio.sfx('scan_done');
        g.say('scan_complete');
        g.msg((this.label || 'TARGET').toUpperCase() + ' SCANNED', '#7fe8ff');
        g.emit('scanned', this);
        return;
      }
      this.activated = true;
      AS.Audio.sfx('console');
      g.msg((this.o.doneMsg || (this.label + ' ACTIVATED')).toUpperCase(), '#7dff9a');
      if (this.o.doneLine) g.say(this.o.doneLine);
      g.emit('interacted', this);
    }

    drawShadow() {}
    draw(ctx, ox, oy, R) {
      if (this.hidden && !this.g.revealHidden) { if (!this.alive) return; ctx.globalAlpha = 0.0; }
      const sh = this.sheet;
      const x = this.x, y = this.y;
      if (this.ruin) {
        if (this.collapse > 0) {
          const k = 1 - this.collapse / 0.9;
          const sink = k * k * (sh.h * 0.8);
          ctx.save();
          ctx.beginPath(); ctx.rect(Math.round(x - ox - sh.ax - 2), Math.round(y - oy - sh.ay - 4), sh.w + 4, sh.ay + 4 - (sh.ay - sh.h * 0) * 0); ctx.clip();
          ctx.drawImage(sh.frames[0][0], x - ox - sh.ax + Math.sin(k * 40) * 1.5, y - oy - sh.ay + sink, sh.w, sh.h);
          ctx.restore();
        }
        if (this.rubble) ctx.drawImage(this.rubble.frames[0][0], x - ox - this.rubble.ax, y - oy - this.rubble.ay, this.rubble.w, this.rubble.h);
        return;
      }
      if (this.submerged && !this.scanned) {
        // only a shimmer above the water
        ctx.globalAlpha = 0.25 + Math.sin(this.t * 2) * 0.1;
        ctx.drawImage(sh.frames[0][0], x - ox - sh.ax, y - oy - sh.ay, sh.w, sh.h);
        ctx.globalAlpha = 1;
        return;
      }
      if (this.submerged) ctx.globalAlpha = 0.7;
      const ai = sh.anims > 1 ? Math.floor(this.anim) % sh.anims : 0;
      ctx.drawImage(sh.frames[ai][0], x - ox - sh.ax, y - oy - sh.ay, sh.w, sh.h);
      if (this.flash > 0) R.flashSprite(ctx, sh, 0, ai, x, y, 0, ox, oy);
      if (this.gunSheet) R.sprite(ctx, this.gunSheet, this.gunAngle, 0, x, y, this.gunZ, ox, oy);
      ctx.globalAlpha = 1;
      if (!this.powered && this.mech && this.team === 'enemy') {
        if (Math.random() < 0.05) AS.FX.sparks(x, y, this.hc, 2, '#9fd0ff');
        ctx.fillStyle = 'rgba(20,24,40,0.35)'; ctx.fillRect(Math.round(x - ox - 3), Math.round(y - oy - this.hc - 10), 6, 6);
      }
      // shield dome
      if (this.isShielded()) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rr = this.r + 10;
        ctx.globalAlpha = 0.16 + Math.sin(this.t * 3) * 0.05 + (this.flash > 0 ? 0.3 : 0);
        ctx.fillStyle = '#9a6aff';
        ctx.beginPath(); ctx.ellipse(x - ox, y - oy - this.hc * 0.6, rr, rr * 0.9, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#d8c0ff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x - ox, y - oy - this.hc * 0.6, rr, rr * 0.9, 0, Math.PI + 0.3, TAU - 0.3); ctx.stroke();
        ctx.restore();
      }
      if (this.hpBarT > 0 && !this.invuln && this.team === 'enemy') {
        const w = Math.max(20, this.r * 1.4), bx = Math.round(x - ox - w / 2), by = Math.round(y - oy - this.hc - this.r * 0.6 - 14);
        ctx.globalAlpha = Math.min(1, this.hpBarT);
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, w + 2, 4);
        ctx.fillStyle = '#ffb04a'; ctx.fillRect(bx, by, Math.max(0, w * this.hp / this.maxHp), 2);
        ctx.globalAlpha = 1;
      }
      if (this.role === 'console' && !this.activated && !this.locked) {
        const k = 0.5 + Math.sin(this.t * 4) * 0.5;
        ctx.fillStyle = 'rgba(125,255,154,' + (0.4 + k * 0.5) + ')';
        ctx.fillRect(Math.round(x - ox) - 1, Math.round(y - oy - this.hc - 16 - k * 3), 3, 3);
      }
      if (this.scanTarget && !this.scanned && this.alive && this.g.player && U.dist(x, y, this.g.player.x, this.g.player.y) < 300) {
        ctx.strokeStyle = 'rgba(127,232,255,0.6)'; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.ellipse(x - ox, y - oy, this.r + 8, (this.r + 8) * 0.75, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  AS.Structure = Structure;
})(window.AS);
