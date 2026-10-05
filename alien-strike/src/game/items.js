/* ALIEN STRIKE — pickups, survivors, cargo, destructible props and obstacles. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  const PICKUP_INFO = {
    fuel: { label: 'FUEL CELL', col: '#ffb04a' }, ammo: { label: 'AMMO CRATE', col: '#b8e86a' },
    missiles: { label: 'MISSILE PACK', col: '#ff8a6a' }, repair: { label: 'REPAIR KIT', col: '#ffffff' },
    shield: { label: 'SHIELD CELL', col: '#6ab8ff' }, special: { label: 'SPECIAL CHARGE', col: '#c58aff' },
    tech: { label: 'ALIEN TECH', col: '#b07cff' }, salvage: { label: 'SALVAGE', col: '#e8c24a' }, intel: { label: 'MISSION INTEL', col: '#5fffe0' },
  };

  /* ---------------- Pickup ---------------- */
  class Pickup {
    constructor(g, kind, x, y, o) {
      o = o || {};
      this.g = g; this.kind = kind; this.x = x; this.y = y; this.z = 0; this.id = o.id || null;
      this.life = o.life || Infinity; this.t = Math.random() * 10; this.alive = true;
      this.value = o.value || (kind === 'salvage' ? U.irange(25, 55) : 1);
      this.sheet = AS.Art.pickup(kind); this.info = PICKUP_INFO[kind] || PICKUP_INFO.salvage;
      this.hidden = !!o.hidden; this.reveals = o.reveals || null; this.dropped = !!o.dropped;
      this.vx = o.vx || 0; this.vy = o.vy || 0; this.r = 8;
    }
    get sortY() { return this.y; }
    update(dt) {
      const g = this.g, p = g.player;
      this.t += dt;
      if (this.life !== Infinity) { this.life -= dt; if (this.life <= 0) { this.alive = false; return; } }
      if (this.vx || this.vy) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= Math.exp(-4 * dt); this.vy *= Math.exp(-4 * dt); if (Math.abs(this.vx) + Math.abs(this.vy) < 2) this.vx = this.vy = 0; }
      if (!p || !p.alive || p.dying > 0) return;
      const d = U.dist(this.x, this.y, p.x, p.y);
      if (d < 54) { const k = (1 - d / 54) * 260 * dt; this.x += (p.x - this.x) / (d || 1) * k; this.y += (p.y - this.y) / (d || 1) * k; this.z = U.lerp(this.z, p.z * 0.6, 0.1); }
      if (d < 20) this.collect(p);
    }
    collect(p) {
      const g = this.g, s = p.s;
      let txt = this.info.label;
      switch (this.kind) {
        case 'fuel': p.fuel = Math.min(s.fuelMax, p.fuel + s.fuelMax * 0.35); if (p.fuel / s.fuelMax > 0.5) p.fuelWarned = {}; else if (p.fuel / s.fuelMax > 0.25) { delete p.fuelWarned[25]; delete p.fuelWarned[10]; } else delete p.fuelWarned[10]; if (p.emergency >= 0) { p.emergency = -1; g.say('fuel_restored'); } txt = '+FUEL'; break;
        case 'ammo': p.ammo.primary = Math.min(s.primary.ammoMax, p.ammo.primary + s.primary.ammoMax * 0.4); p.ammo.secondary = Math.min(s.secondary.ammoMax, p.ammo.secondary + Math.max(2, Math.round(s.secondary.ammoMax * 0.2))); txt = '+AMMO'; break;
        case 'missiles': p.ammo.secondary = Math.min(s.secondary.ammoMax, p.ammo.secondary + Math.max(4, Math.round(s.secondary.ammoMax * 0.5))); txt = '+MISSILES'; break;
        case 'repair': if (p.kits < s.kitCap) { p.kits++; txt = '+REPAIR KIT'; } else { p.heal(s.hullMax * 0.25); txt = '+HULL'; } break;
        case 'shield': p.shield = s.shieldMax * 1.3; txt = 'SHIELD OVERCHARGE'; AS.Audio.sfx('shield_up'); break;
        case 'special': p.ammo.special = Math.min(s.special.ammoMax, p.ammo.special + 1); txt = '+SPECIAL'; break;
        case 'tech': g.stats.tech += 1; txt = '+ALIEN TECH'; g.say('tech_recovered'); break;
        case 'salvage': g.stats.salvage += this.value; txt = '+' + this.value + ' SALVAGE'; break;
        case 'intel': g.stats.intel++; txt = 'INTEL ACQUIRED'; g.say('intel_acquired'); break;
      }
      AS.Audio.sfx(this.kind === 'salvage' ? 'pickup_salvage' : 'pickup', { rate: U.range(0.95, 1.05) });
      AS.FX.text(this.x, this.y, 18, txt, this.info.col);
      AS.Particles.spawn({ x: this.x, y: this.y, z: 6, shape: AS.Particles.RING, col: this.info.col, size: 3, size2: 18, life: 0.3, add: true });
      this.alive = false;
      g.stats.pickups++;
      g.emit('pickup', this);
    }
    drawShadow(ctx, ox, oy) { if (!this.hidden || this.g.revealHidden) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(this.x - ox), Math.round(this.y - oy + 1), 6, 3, 0, 0, TAU); ctx.fill(); } }
    draw(ctx, ox, oy, R) {
      const bob = 3 + Math.sin(this.t * 3) * 2 + this.z;
      if (this.life < 5 && Math.sin(this.t * 20) > 0) return;
      R.sprite(ctx, this.sheet, 0, 0, this.x, this.y, bob, ox, oy);
      R.light(this.x, this.y - bob - 4, 14 + Math.sin(this.t * 4) * 3, this.info.col, 0.35);
    }
  }
  Pickup.INFO = PICKUP_INFO;

  /* ---------------- Survivors ---------------- */
  const SUIT = { crew: '#e8742a', scientist: '#e8e8e0', colonist: '#5a8ad8', prisoner: '#9a9a8a', explorer: '#6aa04a', researcher: '#e8e8e0', engineer: '#e8c24a' };
  class Person {
    constructor(group, x, y, i) {
      this.group = group; this.x = x; this.y = y; this.z = 0; this.r = 4; this.hc = 4; this.alive = true; this.aboard = false;
      this.vx = 0; this.vy = 0; this.anim = Math.random() * 4; this.i = i; this.wave = Math.random() * 6; this.face = 1;
      this.homeX = x; this.homeY = y; this.beam = 0; this.team = 'player'; this.hp = 22; this.hurtT = 0;
    }
    get py() { return this.y - this.hc; }
    get sortY() { return this.y; }
    takeDamage(d) {
      if (!this.alive || this.aboard) return 0;
      this.hp -= (d === undefined ? 100 : d); this.hurtT = 0.3;
      const g = this.group.g;
      if (g.player && g.player.warnOnce) g.player.warnOnce('survattack_' + this.group.id, 'survivors_attacked', 25);
      if (this.hp > 0) { AS.FX.splat(this.x, this.y, 3, '#8a1a1a', 2); return d; }
      this.alive = false;
      AS.FX.splat(this.x, this.y, 3, '#8a1a1a', 6);
      this.group.g.onSurvivorLost(this);
      return 1;
    }
    hazard(x, y, r) { if (U.dist(this.x, this.y, x, y) < r) this.takeDamage(8); }
  }
  class SurvivorGroup {
    constructor(g, o) {
      this.g = g; this.id = o.id; this.kind = 'survivors'; this.type = o.kind || 'crew';
      this.x = o.x; this.y = o.y; this.label = o.label || 'SURVIVORS';
      this.caged = o.caged || null; // id of pen / ice block holding them
      this.people = [];
      for (let i = 0; i < (o.n || 3); i++) {
        const a = (i / (o.n || 3)) * TAU, r = 8 + Math.random() * 10;
        const p = new Person(this, o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.7, i);
        this.people.push(p); g.survivors.push(p);
      }
      this.called = false; this.seen = false; this.voice = o.voice || null;
      this.interactTime = 0;
    }
    get alive() { return this.people.some((p) => p.alive && !p.aboard); }
    get remaining() { return this.people.filter((p) => p.alive && !p.aboard).length; }
    canInteract(pl) {
      if (this.caged) { const c = this.g.byId.get(this.caged); if (c && c.alive) return false; this.caged = null; }
      return this.remaining > 0;
    }
    get interactRange() { return 120; }
    interactLabel(pl) {
      const free = pl.s.rescueCap - pl.passengers.length;
      if (free <= 0) return 'PASSENGER BAY FULL — DROP OFF AT A PAD';
      return this.called ? 'SURVIVORS BOARDING… HOLD POSITION' : 'PRESS E — RESCUE ' + this.label + ' (' + this.remaining + ')';
    }
    call(pl) {
      if (pl.passengers.length >= pl.s.rescueCap) { pl.warnOnce('bayfull', 'rescue_full', 6); AS.Audio.sfx('denied'); return; }
      if (!this.called) { this.called = true; AS.Audio.sfx('confirm'); if (this.voice !== false) this.g.say(U.pick(['survivor_thanks1', 'survivor_thanks2', 'survivor_thanks3'])); }
    }
    update(dt) {
      const g = this.g, pl = g.player;
      if (!this.seen && pl && U.dist(pl.x, pl.y, this.x, this.y) < 420 && this.remaining > 0 && !this.caged) { this.seen = true; g.say('survivors_located'); g.emit('survivorsSeen', this); }
      const cagedNow = this.caged && (() => { const c = g.byId.get(this.caged); return c && c.alive; })();
      for (const p of this.people) {
        if (!p.alive || p.aboard) { if (p.beam > 0) p.beam -= dt; continue; }
        p.anim += dt * 6;
        const near = pl && pl.alive && U.dist(pl.x, pl.y, this.x, this.y) < 160;
        if (this.called && pl && pl.alive && !cagedNow) {
          const d = U.dist(p.x, p.y, pl.x, pl.y);
          const far = U.dist(pl.x, pl.y, this.x, this.y) > 200;
          if (far) { this.called = false; continue; }
          if (pl.passengers.length >= pl.s.rescueCap) { p.vx = p.vy = 0; continue; }
          if (d < 14 && pl.speed < 160) { this.board(p, pl); continue; }
          const a = Math.atan2(pl.y - p.y, pl.x - p.x);
          p.vx = Math.cos(a) * 46; p.vy = Math.sin(a) * 46; p.face = Math.cos(a) < 0 ? -1 : 1;
          p.x += p.vx * dt; p.y += p.vy * dt;
        } else {
          p.vx = p.vy = 0;
          p.wave += dt * (near ? 8 : 2);
        }
      }
      if (this.called && this.remaining === 0) this.called = false;
    }
    board(p, pl) {
      p.aboard = true; p.beam = 0.5;
      pl.passengers.push({ group: this.id, type: this.type });
      AS.Audio.sfx('beam_up');
      for (let i = 0; i < 8; i++) AS.FX.beamUp(p.x, p.y, 0, pl.z, '#9ff6ff');
      this.g.emit('boarded', this);
      if (pl.passengers.length >= pl.s.rescueCap) { pl.warnOnce('bayfull', 'rescue_full', 6); this.called = false; }
      this.g.stats.boarded++;
    }
    collectDraw(list, x0, y0, x1, y1) {
      for (const p of this.people) if (p.alive && (!p.aboard || p.beam > 0) && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) list.push(personDrawable(p, this));
    }
  }
  const PD = {
    sortY: 0, p: null, gp: null,
    draw(ctx, ox, oy) {
      const p = this.p, gp = this.gp;
      const x = Math.round(p.x - ox), y = Math.round(p.y - oy);
      const col = SUIT[gp.type] || '#e8742a';
      if (p.aboard) { ctx.globalAlpha = Math.max(0, p.beam * 2); }
      const moving = Math.abs(p.vx) + Math.abs(p.vy) > 1;
      const legA = moving ? Math.sin(p.anim * 2) * 1.5 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 1 + Math.round(legA * 0.5), y - 3, 1, 3); ctx.fillRect(x + 1 - Math.round(legA * 0.5), y - 3, 1, 3);
      ctx.fillStyle = col; ctx.fillRect(x - 1, y - 7, 3, 4);
      ctx.fillStyle = '#e8c8a8'; ctx.fillRect(x - 1, y - 9, 3, 2);
      // waving arm when the craft is near
      if (!moving && Math.sin(p.wave) > 0) { ctx.fillStyle = col; ctx.fillRect(x + 2, y - 10, 1, 3); }
      else { ctx.fillStyle = col; ctx.fillRect(x + 2, y - 6, 1, 2); }
      if (gp.caged) { /* drawn inside pen */ }
      ctx.globalAlpha = 1;
    },
  };
  function personDrawable(p, gp) { const o = Object.create(PD); o.p = p; o.gp = gp; o.sortY = p.y; return o; }

  /* ---------------- Cargo ---------------- */
  const CARGO_LABEL = { blackbox: 'FLIGHT RECORDER', datacore: 'DATA CORE', artifact: 'ALIEN ARTEFACT', fuelcore: 'FUEL CORE', sample: 'BIO SAMPLE', charge: 'SEISMIC CHARGE', powercell: 'POWER CELL' };
  class Cargo {
    constructor(g, o) {
      this.g = g; this.kind = 'cargo'; this.type = o.k; this.id = o.id; this.x = o.x; this.y = o.y; this.z = 0;
      this.label = o.label || CARGO_LABEL[o.k] || 'CARGO'; this.deliver = o.deliver || 'pad';
      this.sheet = AS.Art.cargo(o.k); this.alive = true; this.aboard = false; this.delivered = false; this.t = Math.random() * 5;
      this.interactTime = o.time || 1.1; this.locked = o.locked || null; this.hidden = !!o.hidden; this.r = 10;
      this.respawn = o.respawn || 0; this.ox = o.x; this.oy = o.y; this.baseId = (o.id || '').replace(/_r\d+$/, '');
    }
    get sortY() { return this.y; }
    canInteract(pl) {
      if (this.aboard || this.delivered) return false;
      if (this.locked) { const b = this.g.byId.get(this.locked); if (b && b.locked) return false; }
      return true;
    }
    get interactRange() { return 70; }
    interactLabel(pl) {
      if (pl.cargo.length >= pl.s.cargoCap) return 'CARGO HOLD FULL — DELIVER FIRST';
      return 'HOLD E — RECOVER ' + this.label;
    }
    onInteractStart(pl) { if (pl.cargo.length >= pl.s.cargoCap) { pl.warnOnce('cargofull', 'cargo_full', 6); AS.Audio.sfx('denied'); } }
    complete(pl) {
      if (pl.cargo.length >= pl.s.cargoCap) { pl.warnOnce('cargofull', 'cargo_full', 6); return; }
      this.aboard = true; pl.cargo.push(this);
      AS.Audio.sfx('cargo_up');
      this.g.msg(this.label + ' SECURED', '#9ff6ff');
      this.g.emit('cargoPicked', this);
      if (pl.cargo.length >= pl.s.cargoCap) pl.warnOnce('cargofull', 'cargo_full', 6);
    }
    update(dt) { this.t += dt; }
    drawShadow(ctx, ox, oy) { if (this.aboard) return; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(this.x - ox), Math.round(this.y - oy + 1), 6, 3, 0, 0, TAU); ctx.fill(); }
    draw(ctx, ox, oy, R) {
      if (this.aboard || this.delivered) return;
      R.sprite(ctx, this.sheet, 0, 0, this.x, this.y, 0, ox, oy);
      R.light(this.x, this.y - 6, 14, '#9ff6ff', 0.3 + Math.sin(this.t * 3) * 0.1);
    }
  }

  /* ---------------- Destructible props ---------------- */
  const PROP_HP = { crate: 12, barrel: 8, container: 40, fence: 14, mast: 18, pipe: 30, wreck: 50, lamp: 8, plant: 10, crystals: 16, shroom: 10, gearbit: 30, coral: 12 };
  class Prop extends AS.Entity {
    constructor(g, kind, x, y, o) {
      super(g, { hp: PROP_HP[kind] || 15, r: kind === 'container' || kind === 'pipe' || kind === 'fence' ? 10 : 6, hc: 3 }, x, y);
      this.kind = kind; this.isProp = true; this.team = 'enemy';
      this.angle = (o && o.angle !== undefined) ? o.angle : Math.random() * TAU;
      this.sheet = AS.Art.prop(kind, g.world, (x * 7 + y * 3) | 0);
      this.organic = kind === 'plant' || kind === 'shroom' || kind === 'coral';
    }
    get py() { return this.y - 3; }
    die() {
      const g = this.g;
      this.removed = true;
      if (this.kind === 'barrel') {
        g.damageArea(this.x, this.y, 46, 22, 'explosive', 'neutral', null, { hitsAll: true });
        AS.FX.explosion(this.x, this.y, 2, 16); AS.Audio.sfx('explode_small', { x: this.x, y: this.y });
        g.terrain.addDecal('scorch', this.x, this.y, 18);
      } else {
        const col = this.organic ? g.world.propPal.b : '#6a5e54';
        for (let i = 0; i < 8; i++) AS.Particles.spawn({ x: this.x, y: this.y, z: 3, vx: U.range(-60, 60), vy: U.range(-60, 60), vz: U.range(40, 100), grav: 260, bounce: 0.3, shape: AS.Particles.SHARD, col, size: 2 + Math.random() * 2, life: 0.9, vr: 10 });
        AS.FX.dust(this.x, this.y, 3, '#8a7a6a', 30);
        AS.Audio.sfx(this.organic ? 'squelch' : 'crate_break', { x: this.x, y: this.y, vol: 0.5 });
      }
      if (Math.random() < 0.18) g.spawnPickup(Math.random() < 0.6 ? 'salvage' : U.pick(['ammo', 'fuel', 'missiles']), this.x, this.y, { dropped: true, life: 40 });
      g.stats.props++;
    }
    drawShadow(ctx, ox, oy) { AS.Renderer.shadow(ctx, this.sheet, this.angle, this.x, this.y, 0, ox, oy); }
    draw(ctx, ox, oy, R) {
      R.sprite(ctx, this.sheet, this.angle, 0, this.x, this.y, 0, ox, oy);
      if (this.flash > 0) { this.flash -= 0.016; }
      if (this.kind === 'lamp') R.light(this.x, this.y - 16, 30, '#ffe08a', 0.4);
      if (this.kind === 'crystals') R.light(this.x, this.y - 6, 18, this.g.world.propPal.g, 0.25);
    }
  }

  /* ---------------- Static obstacles (major terrain features) ---------------- */
  class Obstacle {
    constructor(g, kind, x, y, o) {
      o = o || {};
      this.g = g; this.kind = kind; this.x = x; this.y = y;
      const h = o.h || U.irange(60, 110), r = o.r || U.irange(12, 20);
      this.r = Math.round(r * 0.8); this.h = h; this.isObstacle = true; this.alive = true;
      this.sheet = AS.Art.obstacle(kind, g.world, { h, r, seed: o.seed || ((x * 13 + y * 7) % 97) });
      this.t = Math.random() * 4;
    }
    get sortY() { return this.y; }
    drawShadow(ctx, ox, oy) {
      // long cast shadow down-right
      ctx.save(); ctx.globalAlpha *= 0.8;
      ctx.translate(Math.round(this.x - ox), Math.round(this.y - oy));
      ctx.transform(1, 0, 0.55, 0.35, 0, 0);
      ctx.drawImage(this.sheet.shadows[0], -this.sheet.ax, -this.sheet.ay);
      ctx.restore();
    }
    draw(ctx, ox, oy, R) {
      const sh = this.sheet;
      const ai = sh.anims > 1 ? Math.floor(this.g.time * 2) % sh.anims : 0;
      // fade when the craft is behind it
      const p = this.g.player;
      let a = 1;
      if (p && p.alive && p.y < this.y && p.y > this.y - this.h - 30 && Math.abs(p.x - this.x) < this.r + 26) a = 0.45;
      ctx.globalAlpha = a;
      ctx.drawImage(sh.frames[ai][0], Math.round(this.x - ox - sh.ax), Math.round(this.y - oy - sh.ay));
      ctx.globalAlpha = 1;
      if (this.g.world.obstacle.glowVein || this.kind === 'bigShroom') R.light(this.x, this.y - this.h * 0.6, 26, this.g.world.obstacle.pal.g, 0.18);
    }
  }

  AS.Pickup = Pickup; AS.SurvivorGroup = SurvivorGroup; AS.Cargo = Cargo; AS.Prop = Prop; AS.Obstacle = Obstacle;
})(window.AS);
