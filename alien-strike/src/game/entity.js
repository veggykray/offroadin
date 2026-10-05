/* ALIEN STRIKE — entity base class and art resolution.
 * Every damageable thing (enemy unit, structure, prop, friendly) derives from
 * Entity. Positions are ground-plane (x, y) plus altitude z; hc is the visual
 * centre height used for projected hit tests (what you see is what you hit). */
'use strict';
(function (AS) {
  const U = AS.U;

  /* ---------- Art: resolve model descriptors into cached sprite sheets ---------- */
  const Art = {
    pal(p, world) {
      if (!p) return world.choir;
      if (typeof p === 'string') return world[p] || world.choir;
      return p;
    },
    sheet(kind, def, world) {
      const m = def.model;
      if (!m) return null;
      const pal = this.pal(m.pal, world);
      const key = kind + ':' + m.gen + ':' + JSON.stringify(pal) + ':' + JSON.stringify(m.opt || {});
      const dirs = m.dirs || (kind === 'struct' ? 1 : (def.cls === 'creature' ? 16 : 24));
      const anims = m.anims || 1;
      return AS.Forge.sheet(key, () => AS.Models[m.gen](pal, m.opt || {}), dirs, anims);
    },
    gun(def, world, palKey) {
      if (!def.gun) return null;
      const pal = this.pal(palKey || (def.model && def.model.pal), world);
      const key = 'gun:' + JSON.stringify(def.gun) + JSON.stringify(pal);
      return AS.Forge.sheet(key, () => AS.Models.gun(pal, def.gun), 24, 1);
    },
    prop(kind, world, seed) {
      const pal = world.propPal;
      return AS.Forge.sheet('prop:' + world.key + ':' + kind + ':' + (seed % 3), () => AS.Models.prop(kind, pal, { seed: seed % 3 + 1 }), kind === 'fence' || kind === 'pipe' || kind === 'container' || kind === 'wreck' ? 8 : 1, 1);
    },
    obstacle(kind, world, o) {
      const ob = world.obstacle;
      const pal = ob.pal;
      const opt = Object.assign({ glowVein: ob.glowVein }, o || {});
      return AS.Forge.sheet('obs:' + world.key + ':' + kind + ':' + JSON.stringify(opt), () => AS.Models[kind](pal, opt), 1, kind === 'gearTower' ? 4 : 1);
    },
    pickup(kind) { return AS.Forge.sheet('pickup:' + kind, () => AS.Models.pickup(kind), 1, 1); },
    cargo(kind) { return AS.Forge.sheet('cargo:' + kind, () => AS.Models.cargo(kind), 1, 1); },
    rubble(world, r, seed) {
      const rr = Math.round(r / 6) * 6;
      return AS.Forge.sheet('rubble:' + world.key + ':' + rr + ':' + (seed % 3), () => AS.Models.rubble(world.choir, { r: rr, seed: seed % 3 + 1 }), 1, 1);
    },
  };
  AS.Art = Art;

  let NEXT_ID = 1;
  class Entity {
    constructor(g, def, x, y) {
      this.g = g; this.def = def || {};
      this.uid = NEXT_ID++;
      this.id = null;
      this.x = x; this.y = y; this.z = 0;
      this.vx = 0; this.vy = 0; this.angle = 0;
      this.r = this.def.r || 10; this.hc = this.def.hc || 6;
      this.hp = this.maxHp = this.def.hp || 1;
      this.armor = this.def.armor || 0;
      this.shield = this.maxShield = this.def.shield || 0;
      this.alive = true; this.removed = false;
      this.team = this.def.team || 'enemy';
      this.flash = 0; this.stun = 0; this.burn = 0; this.slow = 0;
      this.invuln = !!this.def.invuln;
      this.targetable = !this.invuln;
      this.organic = !!this.def.organic; this.mech = !!this.def.mech;
      this.air = false;
      this.lastHitBy = null;
    }
    get py() { return this.y - this.z - this.hc; }
    get sortY() { return this.y; }
    isShielded() { return false; }
    takeDamage(amount, dtype, src, opts) {
      if (!this.alive || this.invuln) return 0;
      opts = opts || {};
      if (this.isShielded()) {
        AS.FX.impact(this.x, this.y, this.z + this.hc, '#c8a0ff');
        if (this.g && Math.random() < 0.2) AS.Audio && AS.Audio.sfx('shield_hit', { x: this.x, y: this.y, vol: 0.4 });
        return 0;
      }
      let dmg = amount;
      if (dtype === 'bio' && this.mech && !this.organic) dmg *= 0.7;
      if (dtype === 'bio' && this.organic) dmg *= 1.2;
      if (this.shield > 0) {
        const mult = dtype === 'energy' ? 1.5 : dtype === 'emp' ? 4 : 1;
        const absorbed = Math.min(this.shield, dmg * mult);
        this.shield -= absorbed;
        dmg -= absorbed / mult;
        this.shieldHit = 0.25;
        if (this.shield <= 0) AS.FX.sparks(this.x, this.y, this.z + this.hc, 8, '#a0c8ff');
        if (dmg <= 0.01) { this.flash = 0.06; return amount; }
      }
      if (this.armor > 0 && dtype !== 'ap') {
        const a = dtype === 'explosive' ? this.armor * 0.5 : dtype === 'energy' ? this.armor * 0.6 : this.armor;
        dmg = Math.max(dmg * 0.4, dmg - a);
      }
      this.hp -= dmg;
      this.flash = 0.08;
      this.lastHitBy = src;
      if (this.onHurt) this.onHurt(dmg, dtype, src);
      if (this.hp <= 0) { this.hp = 0; this.alive = false; this.die(src, opts); }
      return dmg;
    }
    die() { this.removed = true; }
    drawShadow() {}
    draw() {}
  }
  AS.Entity = Entity;
})(window.AS);
