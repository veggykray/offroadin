/* WYRMCROWN — buildings: town structures, defences and site structures.
 * Extends the shared engine Entity (alien-strike/src/game/entity.js) for
 * damage and armour. Looks come from the faction's model set
 * (AS.Models['<faction>_<gen>']) or a site model, with a lit procedural
 * fallback so a missing model never breaks the game. Buildings rise from
 * scaffolding when bought, burn when breathed on, collapse into rubble, and
 * defences pick targets and fire through AS.Combat.shoot. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C, S = () => AS.Shapes;

  /* ---------------- fallback models ---------------- */
  function fallback(gen, pal, opt) {
    const Sh = S();
    const a = pal.a || '#8a7f74', b = pal.b || '#d2c7b4', t = pal.t || '#b0482c', g = pal.g || '#ffcf6a', d = pal.d || '#3e3028', k = pal.k || '#b8262a';
    const lv = (opt && opt.level) || 1;
    const box = (w, h, z0, z1, side, top) => ({ z0, z1, side, top, shape: (c) => Sh.rect(c, -w / 2, -h / 2, w, h) });
    const roof = (w, h, z0, z1, col) => ({ z0, z1, side: C.shade(col, -0.3), top: col, shape: (c, zt) => Sh.rect(c, -w / 2 * (1 - zt * 0.15), -h / 2 * (1 - zt * 0.92), w * (1 - zt * 0.15), Math.max(0.5, h * (1 - zt * 0.92))),
      detail: (c) => Sh.lines(c, 'rgba(0,0,0,0.3)', 0.5, [-w / 2, 0, w / 2, 0]) });
    const round = (r, z0, z1, side, top) => ({ z0, z1, side, top, shape: (c) => Sh.circ(c, 0, 0, r) });
    const cone = (r, z0, z1, col) => ({ z0, z1, side: C.shade(col, -0.3), top: col, shape: (c, zt) => Sh.circ(c, 0, 0, r * (1 - zt * 0.95) + 0.2) });
    switch (gen) {
      case 'keep': { const s = 34 + lv * 8; return { r: s + 18, h: 60 + lv * 10, style: 'prop', parts: [box(s * 1.5, s * 1.3, 0, 2, d, a), box(s, s * 0.9, 2, 30 + lv * 6, a, b), round(9, 2, 40 + lv * 6, a, b), roof(s * 0.9, s * 0.8, 30 + lv * 6, 44 + lv * 6, t), cone(10, 40 + lv * 6, 56 + lv * 8, t)] }; }
      case 'house': return { r: 18, h: 22, style: 'prop', parts: [box(22, 16, 0, 10, a, b), roof(24, 18, 10, 20, t)] };
      case 'tower': case 'watchtower': return { r: 14, h: 60, style: 'prop', parts: [round(gen === 'tower' ? 9 : 6, 0, 40, a, b), round(gen === 'tower' ? 11 : 7, 40, 44, d, b), cone(gen === 'tower' ? 11 : 7, 44, 58, t)] };
      case 'magetower': return { r: 18, h: 80, style: 'prop', parts: [round(10, 0, 56, a, b), cone(12, 56, 78, k), { z0: 60, z1: 62, side: g, top: g, flat: true, shape: (c) => Sh.circ(c, 0, 0, 3) }] };
      case 'wall': return { r: 24, h: 18, style: 'prop', parts: [box(40, 7, 0, 14 + lv * 2, a, b)] };
      case 'gate': return { r: 26, h: 26, style: 'prop', parts: [box(10, 12, 0, 22, a, b), { z0: 0, z1: 22, side: a, top: b, shape: (c) => { Sh.rect(c, -20, -6, 10, 12); Sh.rect(c, 10, -6, 10, 12); } }] };
      case 'ballista': case 'catapult': return { r: 14, h: 10, style: 'prop', parts: [round(9, 0, 3, d, a), box(18, 4, 3, 7, pal.w || '#5a3a24', '#8a6a44'), box(4, 14, 5, 8, pal.w || '#5a3a24', '#8a6a44')] };
      case 'wardstone': return { r: 14, h: 30, style: 'prop', parts: [round(9, 0, 3, d, a), { z0: 3, z1: 28, side: a, top: b, shape: (c, zt) => Sh.rect(c, -4 + zt * 2, -3 + zt * 1.5, 8 - zt * 4, 6 - zt * 3) }, { z0: 18, z1: 20, side: g, top: g, flat: true, shape: (c) => Sh.circ(c, 0, -3.5, 1.6) }] };
      case 'roost': return { r: 36, h: 8, style: 'prop', parts: [round(30, 0, 6, d, a), round(22, 6, 7, a, C.shade(b, -0.1))] };
      default: return { r: 30, h: 26, style: 'prop', parts: [box(40, 30, 0, 14, a, b), roof(42, 32, 14, 26, t)] };
    }
  }

  /* sheet layout of each registered model (dirs / anims), read from the gallery
   * entries every art file pushes (see wyrmcrown/tools/gallery.html) */
  let META = null;
  function meta(gen) {
    if (!META) { META = {}; for (const grp of AS.Gallery || []) for (const it of grp.items) if (!META[it.gen]) META[it.gen] = { dirs: it.dirs || 1, anims: it.anims || 1 }; }
    return META[gen];
  }
  /* resolve a sheet for faction fk building gen (+opt), or a site model */
  function sheetFor(genFull, pal, opt, dirs, anims) {
    const has = !!AS.Models[genFull];
    const m = has && meta(genFull);
    if (m) { dirs = m.dirs; anims = m.anims; }
    const key = 'bld:' + genFull + (has ? '' : ':fb') + JSON.stringify(opt || {}) + JSON.stringify(pal);
    const base = genFull.replace(/^(human|elf|ice|undead)_/, '');
    return AS.Forge.sheet(key, () => (has ? AS.Models[genFull](pal, opt || {}) : fallback(base, pal, opt)), dirs || 1, anims || 1);
  }

  class Building extends AS.Entity {
    constructor(g, kind, owner, x, y, o) {
      const def = AS.Data.buildings[kind] || { name: kind, hp: 300, r: 20 };
      super(g, { hp: 1, r: def.r }, x, y);
      o = o || {};
      if (o.team === 'neutral' && !owner) this._noTarget = !!o.site;
      this.kind = kind; this.bdef = def;
      this.isBuilding = true;
      this.faction = owner ? g.factions[owner] : null;
      this.team = owner || o.team || 'neutral';
      this.level = o.level || 1;
      this.angle = o.angle || 0; this.aim = this.angle + (o.aim || 0);
      this.v = o.v || 0;
      this.site = o.site || null;
      this.gen = o.gen || null;
      this.flat = !!def.flat;
      this.tall = def.tall || 0;
      this.burnable = def.burnable !== false;
      this.slot = o.slot || null;
      this.built = o.instant ? 1 : 0; this.buildT = o.instant ? 0 : (o.buildTime || 5);
      this.burn = 0; this.burnSrc = null; this.cd = Math.random() * 2; this.anim = Math.random() * 4; this.hpBarT = 0;
      this.setLevel(this.level, true);
      this.viewR = Math.max(80, this.sheet ? this.sheet.w * 0.6 : 80);
      this.solid = def.solid || this.tall > 30;
      if (this.tall) g.solids.push(this);
      this.hc = Math.min(30, (this.sheet ? this.sheet.ay * 0.4 : 10));
      if (o.shoots === false) this.shoots = null;
    }
    setLevel(lv, init) {
      this.level = lv;
      const def = this.bdef;
      const hpL = Array.isArray(def.hp) ? def.hp[Math.min(lv, def.hp.length) - 1] : def.hp;
      const frac = init ? 1 : this.hp / this.maxHp;
      this.maxHp = hpL * (this.faction && this.faction.ai ? (this.g.diff.aiHp || 1) : 1);
      this.hp = this.maxHp * frac;
      this.armor = this.kind === 'keep' ? 4 : this.kind === 'wall' || this.kind === 'gate' ? 3 + lv : 2;
      this.shoots = def.shoots && (!def.shoots.minLevel || lv >= def.shoots.minLevel) ? def.shoots : null;
      this.resolveSheet();
    }
    resolveSheet() {
      const def = this.bdef;
      const fk = this.faction ? this.faction.key : null;
      const pal = this.faction ? this.faction.def.pal : (this.palOverride || AS.Data.pal.neutral);
      const opt = { level: this.level, v: this.v };
      const gen = this.gen || (fk ? fk + '_' + def.gen : def.gen);
      this.sheet = sheetFor(gen, pal, opt, def.dirs || 1, def.anims || (this.kind === 'magetower' || this.kind === 'wardstone' ? 4 : 1));
      this.dirs = this.sheet.dirs;
    }
    get py() { return this.y - this.hc; }
    get sortY() { return this.y + (this.kind === 'wall' || this.kind === 'gate' ? 0 : 2); }
    get hitR() { return this.r * 1.1; }
    get targetable() { return this.alive && this.built > 0.3 && !this._noTarget; }
    set targetable(v) { this._noTarget = !v; }

    ignite(t, src) { if (!this.burnable || !this.alive) return; this.burn = Math.max(this.burn, t * 1.6); this.burnSrc = src; }
    takeDamage(amount, dtype, src, opts) {
      if (!this.alive) return 0;
      let a = amount;
      // the stronghold's ward barrier turns most harm aside while it stands
      if (this.kind === 'keep' && this.faction && this.faction.wardUp()) {
        a *= this.faction.wardMul();
        this.wardHit = 0.4;
        if (Math.random() < 0.2) AS.FX.impact(this.x + U.range(-30, 30), this.y - 30 - Math.random() * 30, 0, this.faction.def.color);
      }
      if (this.built < 1) a *= 1.5;
      if (this.brittle > 0) a *= 1.35; // frost-bitten stone cracks under blows
      const dealt = super.takeDamage(a, dtype, src, opts);
      this.hpBarT = 3;
      if (this.faction && this.faction.onAttacked) this.faction.onAttacked(this, src);
      if (this.onDamaged) this.onDamaged(dealt, src);
      return dealt;
    }
    die(src) {
      const g = this.g;
      this.alive = false;
      const big = this.r > 24;
      AS.FX.explosion(this.x, this.y, this.hc * 0.5, this.r * 0.6, { col: '#fff0d0', col2: '#c86030', debris: true, debrisCol: this.faction ? this.faction.def.pal.a : '#6a5a4a', dustCol: '#9a8a70' });
      for (let i = 0; i < (big ? 10 : 5); i++) AS.FX.dust(this.x + U.range(-this.r, this.r), this.y + U.range(-this.r * 0.6, this.r * 0.6), 2, '#8a7a64', 70);
      g.terrain.addDecal(big ? 'craterbig' : 'scorch', this.x, this.y + 2, this.r * (big ? 0.6 : 1));
      AS.Audio.sfx(big ? 'collapse' : 'explode_med', { x: this.x, y: this.y });
      g.shakeNear(this.x, this.y, big ? 0.5 : 0.2);
      this.ruinT = 0;
      const i = g.solids.indexOf(this); if (i >= 0) g.solids.splice(i, 1);
      if (this.faction && this.faction.onBuildingLost) this.faction.onBuildingLost(this, src);
      if (this.site && this.site.onStructureLost) this.site.onStructureLost(this, src);
      if (g.onBuildingDestroyed) g.onBuildingDestroyed(this, src);
    }

    update(dt) {
      const g = this.g;
      this.anim += dt * 4;
      if (this.flash > 0) this.flash -= dt;
      if (this.hpBarT > 0) this.hpBarT -= dt;
      if (this.wardHit > 0) this.wardHit -= dt;
      if (!this.alive) {
        // rubble lingers, then clears
        this.ruinT += dt;
        if (this.ruinT < 3 && Math.random() < 0.3) AS.FX.smoke(this.x + U.range(-this.r * 0.6, this.r * 0.6), this.y, 4, this.r * 0.4, true);
        if (this.ruinT > 4) this.removed = true;
        return;
      }
      if (this.built < 1) {
        this.built = Math.min(1, this.built + dt / this.buildT);
        if (Math.random() < 0.08) AS.FX.dust(this.x + U.range(-this.r, this.r), this.y + U.range(-this.r * 0.5, this.r * 0.5), 1, '#a89878', 20);
        if (this.built >= 1) {
          AS.FX.dust(this.x, this.y, 8, '#a89878', 50);
          if (this.faction && this.faction.onBuilt) this.faction.onBuilt(this);
        }
        return;
      }
      if (this.burn > 0) {
        this.burn -= dt;
        super.takeDamage(this.maxHp * 0.012 * dt + 3 * dt, 'fire', this.burnSrc);
        if (Math.random() < 0.6 * AS.Particles.density) AS.FX.fire(this.x + U.range(-this.r * 0.6, this.r * 0.6), this.y + U.range(-4, 4), this.hc + U.range(0, this.hc), this.r * 0.4);
        if (Math.random() < 0.18) AS.FX.smoke(this.x, this.y, this.hc * 1.5, this.r * 0.5, true);
        AS.Renderer.light(this.x, this.y - this.hc, this.r * 2.4, '#ff8a3a', 0.35);
      } else if (this.hp < this.maxHp * 0.4 && Math.random() < 0.06) AS.FX.smoke(this.x, this.y, this.hc * 1.4, this.r * 0.35, this.hp < this.maxHp * 0.2);
      // necrotic rot eats at timber and stone; frost leaves it brittle
      if (this.wither > 0) {
        this.wither -= dt;
        super.takeDamage(this.maxHp * 0.01 * dt + 2.5 * dt, 'necrotic', this.witherSrc);
        if (Math.random() < 0.3 * AS.Particles.density) AS.Particles.spawn({ x: this.x + U.range(-this.r * 0.6, this.r * 0.6), y: this.y + U.range(-4, 4), z: this.hc * Math.random(), vz: 14, shape: AS.Particles.SMOKE, col: '#6a3a8a', col2: '#2a1a3a', size: 3, size2: 9, life: 0.9, alpha: 0.5 });
        if (!this.alive) return;
      }
      if (this.brittle > 0) {
        this.brittle -= dt;
        if (Math.random() < 0.15 * AS.Particles.density) AS.Particles.spawn({ x: this.x + U.range(-this.r * 0.6, this.r * 0.6), y: this.y + U.range(-4, 4), z: this.hc * Math.random() * 1.5, vz: 6, shape: AS.Particles.GLOW, col: '#dff6ff', col2: '#8ac8ff', size: 2, size2: 4, life: 0.6, add: true });
      }
      if (this.shoots && (!this.faction || !this.faction.eliminated)) this.defend(dt);
      if (this.tick) this.tick(dt);
    }
    // defences: acquire a target in range and fire
    defend(dt) {
      const g = this.g, w = this.shoots;
      this.cd -= dt;
      if (this.target && (!this.target.alive || this.target.targetable === false || U.dist(this.x, this.y, this.target.x, this.target.y) > w.range * 1.05)) this.target = null;
      this.scanT = (this.scanT || 0) - dt;
      if (this.scanT <= 0 || !this.target) {
        this.scanT = 0.5 + Math.random() * 0.3;
        this.target = g.nearestFoe(this.team, this.x, this.y, w.range, { airOnly: w.airOnly, prefer: w.groundPref ? (e) => !e.isDragon && !e.isBuilding : (e) => e.isDragon });
        if (this.target && this.target.isBuilding && !w.groundPref) this.target = null; // towers don't shoot buildings
      }
      const t = this.target;
      if (!t) return;
      if (this.dirs > 1) {
        const want = Math.atan2(t.y - this.y, t.x - this.x);
        this.aim = U.turnToward(this.aim, want, 2.2 * dt);
        if (Math.abs(U.wrapAngle(want - this.aim)) > 0.15) return;
      }
      if (this.cd > 0) return;
      const rate = w.rate * (this.faction && this.faction.ai ? g.diff.ai : 1);
      this.cd = 1 / rate * U.range(0.85, 1.15);
      const n = w.volley || 1;
      const sz = this.tall ? this.tall * 0.85 : 12;
      for (let i = 0; i < n; i++) {
        const ang = i / n * TAU;
        const fire = () => { if (this.alive && t.alive) AS.Combat.shoot(this, t, w.kind, { x: this.x + Math.cos(ang) * this.r * 0.5, y: this.y + Math.sin(ang) * this.r * 0.3, z: sz, dmgMul: this.faction && this.faction.ai ? g.diff.ai : 1 }); };
        if (i === 0) fire(); else g.later(i * 0.12, fire);
      }
      if (this.kind === 'catapult') this.fireAnim = 1;
    }

    /* ---------------- drawing ---------------- */
    drawShadow(ctx, ox, oy) {
      if (!this.alive || this.built < 0.15) return;
      const sh = this.sheet, di = AS.Forge.frameIndex(sh, this.dirs > 1 ? (this.kind === 'wall' || this.kind === 'gate' ? this.angle : this.aim) : 0);
      ctx.drawImage(sh.shadows[di], this.x - ox - sh.ax + 3, this.y - oy - sh.ay + 1.6, sh.w, sh.h);
    }
    draw(ctx, ox, oy, R) {
      const sh = this.sheet;
      if (this.hidden) return;
      if (!this.alive) {
        // smouldering rubble
        if (this.ruinT < 4) {
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - this.ruinT / 4);
          const di = AS.Forge.frameIndex(sh, this.dirs > 1 ? this.aim : 0);
          const k = Math.min(1, this.ruinT * 1.5);
          ctx.drawImage(sh.frames[0][di], 0, 0, sh.frames[0][di].width, sh.frames[0][di].height * (1 - k * 0.6), this.x - ox - sh.ax, this.y - oy - sh.ay + sh.h * k * 0.6, sh.w, sh.h * (1 - k * 0.6));
          ctx.restore();
        }
        return;
      }
      const ang = this.dirs > 1 ? (this.kind === 'wall' || this.kind === 'gate' ? this.angle : this.aim) : 0;
      const di = AS.Forge.frameIndex(sh, ang);
      let ai = sh.anims > 1 ? Math.floor(this.anim) % sh.anims : 0;
      if (this.kind === 'catapult') { ai = this.fireAnim > 0 ? (this.fireAnim > 0.6 ? 2 : 1) : 0; this.fireAnim = Math.max(0, (this.fireAnim || 0) - 0.02); }
      const img = sh.frames[ai][di];
      if (this.built < 1) {
        // rising from scaffolding: reveal the model bottom-up over a timber frame
        const k = this.built;
        const hh = sh.h * (0.25 + k * 0.75);
        ctx.save(); ctx.globalAlpha = 0.5 + k * 0.5;
        ctx.drawImage(img, 0, img.height * (1 - hh / sh.h), img.width, img.height * hh / sh.h, this.x - ox - sh.ax, this.y - oy - sh.ay + sh.h - hh, sh.w, hh);
        ctx.restore();
        ctx.strokeStyle = 'rgba(110,80,50,0.9)'; ctx.lineWidth = 1;
        const w = this.r * 1.6, top = this.y - oy - Math.min(sh.ay, 40) * (1.05 - k * 0.5);
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) { const x = this.x - ox - w / 2 + w * i / 3; ctx.moveTo(x, this.y - oy + 2); ctx.lineTo(x, top); }
        ctx.moveTo(this.x - ox - w / 2, top + 6); ctx.lineTo(this.x - ox + w / 2, top + 6);
        ctx.moveTo(this.x - ox - w / 2, this.y - oy - 4); ctx.lineTo(this.x - ox + w / 2, top + 6);
        ctx.stroke();
        return;
      }
      ctx.drawImage(img, this.x - ox - sh.ax, this.y - oy - sh.ay, sh.w, sh.h);
      if (this.flash > 0) R.flashSprite(ctx, sh, ang, ai, this.x, this.y, 0, ox, oy);
      if (this.kind === 'keep' && this.faction && this.faction.wardUp()) this.drawWard(ctx, ox, oy);
      if (this.hpBarT > 0 && this.hp < this.maxHp) {
        const w = Math.max(24, this.r * 1.4), x = Math.round(this.x - ox - w / 2), y = Math.round(this.y - oy - sh.ay - 6);
        ctx.globalAlpha = Math.min(1, this.hpBarT);
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
        ctx.fillStyle = this.faction ? this.faction.def.color : '#d8c8a0'; ctx.fillRect(x, y, Math.max(0, w * this.hp / this.maxHp), 2);
        ctx.globalAlpha = 1;
      }
      if (this.kind === 'magetower' || this.kind === 'wardstone') R.light(this.x, this.y - this.sheet.ay * 0.8, 40, this.faction ? this.faction.def.color : '#c08aff', 0.35 + Math.sin(this.anim) * 0.1);
    }
    drawWard(ctx, ox, oy) {
      const F = this.faction, col = F.def.color, R = this.r * 1.9;
      const x = this.x - ox, y = this.y - oy - 20;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const k = F.wardStrength() / 4;
      ctx.globalAlpha = 0.1 + k * 0.1 + (this.wardHit > 0 ? this.wardHit : 0) + Math.sin(this.anim * 0.7) * 0.03;
      const gr = ctx.createRadialGradient(x, y, R * 0.5, x, y, R);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, C.str(col, 0.25)); gr.addColorStop(1, C.str(col, 0.6));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.85, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha *= 1.5; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.85, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.restore();
    }
  }

  Building.sheetFor = sheetFor;
  Building.meta = meta;
  Building.fallback = fallback;
  AS.Building = Building;
})(window.AS);
