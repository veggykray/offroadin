/* WYRMCROWN — ground troops: garrisons, warbands, siege engines, gold carts
 * and the neutral guardians (bandits, wolves, ogres, trolls, giants).
 * Extends the shared engine Entity. One class covers every role; behaviour is
 * a small state machine:
 *   garrison — mill about the town, rush to meet raiders
 *   guard    — stay by a site, attack anyone who comes close (leashed)
 *   march    — follow a route (AS.Nav) to a destination, fighting on the way
 *   haul     — gold carts: drive to the owner's town and deliver
 * Ranged troops shoot at dragons; soldiers hurl spears at dragons flying low;
 * ogres, trolls and giants throw boulders. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;

  function fallbackModel(role, pal, big) {
    const S = AS.Shapes, k = big || 1;
    return () => ({ r: 8 * k, h: 12 * k, style: 'unit', scale: k, parts: [
      { z0: 0, z1: 4, side: '#3a2a1a', top: '#4a3a2a', shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 1.4; S.circ(c, sw, 1.2, 1); S.circ(c, -sw, -1.2, 1); } },
      { z0: 4, z1: 8.6, side: C.shade(pal.k || '#8a3a2a', -0.2), top: pal.k || '#b84a3a', shape: (c, zt) => S.ell(c, 0, 0, 2 - zt * 0.3, 2.6 - zt * 0.4) },
      { z0: 8.6, z1: 10.6, side: '#8a8a8a', top: role === 'archer' ? '#5a7a3a' : '#c8c8c8', shape: (c) => S.circ(c, 0.3, 0, 1.4) },
      { z0: 6, z1: 7, side: '#6a5a4a', top: '#a89878', stroke: 0.7, bevel: false, shape: (c) => { c.moveTo(-2, 3); c.lineTo(6, 3); } },
    ] });
  }
  function cartModel(pal) {
    const S = AS.Shapes;
    return () => ({ r: 14, h: 10, style: 'unit', parts: [
      { z0: 0, z1: 4, side: '#2a2018', top: '#4a3a2a', shape: (c) => { S.circ(c, -3, 5, 2.4); S.circ(c, -3, -5, 2.4); } },
      { z0: 3, z1: 6.5, side: '#5a3a24', top: '#8a6040', shape: (c) => S.rect(c, -8, -4.5, 13, 9) },
      { z0: 6.5, z1: 9, side: '#b08a3a', top: '#e8c050', shape: (c) => { S.circ(c, -5, -1.5, 2); S.circ(c, -1.5, 1.6, 2.2); S.circ(c, 1.5, -1.2, 1.8); } },
      { z0: 2, z1: 7, side: C.shade(pal.k || '#6a4a2a', -0.2), top: pal.k || '#8a6a4a', shape: (c) => S.ell(c, 10, 0, 4.5, 2.2) },
    ] });
  }

  class Troop extends AS.Entity {
    constructor(g, role, team, x, y, o) {
      o = o || {};
      const def = role === 'cart' ? { name: 'Gold Cart', hp: 90, r: 9, speed: 58, armor: 2, hc: 6 } : AS.Data.troops[role] || AS.Data.troops.soldier;
      super(g, { hp: def.hp, r: def.r, hc: def.hc }, x, y);
      this.role = role; this.tdef = def; this.team = team;
      this.isTroop = true;
      this.faction = g.factions[team] || null;
      const big = def.big ? 1 : 0;
      this.hp = this.maxHp = def.hp * (this.faction && this.faction.ai ? g.diff.aiHp || 1 : 1) * (o.hpMul || 1);
      this.armor = def.armor || 0;
      this.state = o.state || (role === 'cart' ? 'haul' : this.faction ? 'garrison' : 'guard');
      this.home = o.home || { x, y, r: 160 };
      this.angle = Math.random() * TAU; this.anim = Math.random() * 4;
      this.cd = Math.random(); this.cd2 = Math.random() * 2; this.t = Math.random() * 3;
      this.path = null; this.pi = 0; this.dest = null;
      this.cargo = o.cargo || 0; this.site = o.site || null;
      this.burn = 0; this.slow = 0; this.root = 0; this.wither = 0;
      this.hpBarT = 0;
      this.burnable = true;
      const pal = this.faction ? this.faction.def.pal : (o.pal || AS.Data.pal.neutral);
      const gen = o.gen || def.gen || 'ppl_soldier';
      const dirs = def.dirs || 16;
      if (role === 'cart') this.sheet = AS.Forge.sheet('cart:' + (AS.Models.prop_cart ? 'm' : 'fb') + team, AS.Models.prop_cart ? () => AS.Models.prop_cart(pal, {}) : cartModel(pal), 16, 1);
      else this.sheet = AS.Forge.sheet('trp:' + gen + ':' + team + (AS.Models[gen] ? '' : ':fb'), AS.Models[gen] ? () => AS.Models[gen](pal, {}) : fallbackModel(role, pal, def.big ? 2.6 : def.hp > 250 ? 1.8 : 1), dirs, role === 'cart' ? 1 : 4);
      this.horse = role === 'cart' ? AS.Life.sheetFor({ kind: 'horse' }) : null;
      this.r = def.r;
      if (def.big || def.hp > 250) this.hitR = def.r * 1.4;
    }
    get py() { return this.y - this.hc; }
    get sortY() { return this.y; }
    ignite(t, src) { this.burn = Math.max(this.burn, t); this.burnSrc = src; }
    onHurt(dmg, dtype, src) {
      this.hpBarT = 3;
      if (src && src.alive !== false && src.team !== this.team && !this.target) this.target = src;
      if (this.state === 'guard' || this.state === 'garrison') this.provoked = 6;
    }
    die(src) {
      const g = this.g;
      this.alive = false; this.removed = true;
      const skel = this.role === 'skeleton' || (this.tdef.gen || '').includes('skeleton') || (this.faction && this.faction.key === 'undead' && this.role !== 'cart');
      if (this.role === 'cart') {
        AS.FX.explosion(this.x, this.y, 4, 10, { debris: true, debrisCol: '#6a4a2a' });
        // the gold spills: whoever broke the cart can grab it
        if (this.cargo > 0 && AS.Pickups) AS.Pickups.coins(g, this.x, this.y, Math.round(this.cargo * 0.6));
        AS.Audio.sfx('explode_small', { x: this.x, y: this.y });
        if (this.faction && this.faction.key === g.playerKey) g.msg('A GOLD CART WAS DESTROYED', '#ff8a5a', 2.5);
      } else if (skel) { AS.FX.sparks(this.x, this.y, 6, 8, '#e8e0c8'); AS.Audio.sfx('bones', { x: this.x, y: this.y, vol: 0.6 }); }
      else { AS.FX.splat(this.x, this.y, this.hc, this.tdef.animal ? '#7a2a1a' : '#8a2a1a', this.tdef.big ? 20 : 6); AS.Audio.sfx(this.tdef.hp > 250 ? 'monster_roar' : 'troop_die', { x: this.x, y: this.y, vol: 0.5, rate: this.tdef.big ? 0.6 : U.range(0.9, 1.2) }); }
      if (this.tdef.big) { AS.FX.dust(this.x, this.y, 12, '#8a7a5a', 80); g.shakeNear(this.x, this.y, 0.4); }
      // gold for the victor
      const killer = src && (src.faction || g.factions[src.team]);
      if (killer && killer.addGold && this.tdef.gold) killer.addGold(this.tdef.gold, this.x, this.y, 'kill');
      if (src && src.team === g.playerKey) g.stats.kills++;
      // necrotic breath raises the slain as skeletons for Morgrave
      if (this.wither > 0 && this.witherSrc && this.witherSrc.team === 'undead' && this.role !== 'cart' && !this.tdef.big && Math.random() < 0.6 && g.factions.undead && !g.factions.undead.eliminated) {
        g.later(1.2, () => {
          const u = new Troop(g, 'skeleton', 'undead', this.x, this.y, { gen: 'trp_undead_skeleton', hpMul: 0.8 });
          u.home = g.factions.undead.townPos; u.state = 'garrison'; u.raised = true;
          u.home = { x: this.x, y: this.y, r: 250 }; u.state = 'guard';
          g.troops.push(u); g.factions.undead.troops.push(u);
          AS.Particles.spawn({ x: this.x, y: this.y, z: 2, shape: AS.Particles.RING, col: '#a8ff6a', size: 4, size2: 20, life: 0.6, add: true, layer: 0 });
          AS.Audio.sfx('bones', { x: this.x, y: this.y });
        });
      }
      if (this.site && this.site.onGuardKilled) this.site.onGuardKilled(this, src);
      if (this.onDeath) this.onDeath(src);
    }

    /* ---------------- orders ---------------- */
    marchTo(x, y, o) {
      o = o || {};
      this.state = 'march'; this.dest = { x, y, r: o.r || 120, siege: !!o.siege, target: o.target || null };
      this.path = AS.Nav.path(this.g, this.x, this.y, x, y); this.pi = 1;
    }
    haulTo(x, y) { this.state = 'haul'; this.dest = { x, y, r: 60 }; this.path = AS.Nav.path(this.g, this.x, this.y, x, y); this.pi = 1; }

    /* ---------------- update ---------------- */
    update(dt) {
      const g = this.g;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.hpBarT > 0) this.hpBarT -= dt;
      if (this.provoked > 0) this.provoked -= dt;
      // conditions
      if (this.burn > 0) { this.burn -= dt; super.takeDamage(7 * dt, 'fire', this.burnSrc); if (Math.random() < 0.5) AS.FX.fire(this.x, this.y, this.hc, this.r); if (!this.alive) return; }
      if (this.wither > 0) { this.wither -= dt; super.takeDamage(4 * dt, 'necrotic', this.witherSrc); if (Math.random() < 0.2) AS.Particles.spawn({ x: this.x, y: this.y, z: this.hc, vz: 12, shape: AS.Particles.SMOKE, col: '#6a3a8a', size: 2, size2: 6, life: 0.7, alpha: 0.5 }); if (!this.alive) return; }
      if (this.slow > 0) this.slow -= dt;
      if (this.root > 0) this.root -= dt;
      if (this.tdef.regen && this.hp < this.maxHp && g.time - (this.lastHurtT || 0) > 3) this.hp = Math.min(this.maxHp, this.hp + this.tdef.regen * dt);
      if (this.role === 'cart') return this.updateCart(dt);
      // perception
      this.scanT = (this.scanT || 0) - dt;
      if (this.target && (!this.target.alive || this.target.targetable === false)) this.target = null;
      if (this.scanT <= 0) {
        this.scanT = 0.45 + Math.random() * 0.3;
        const sight = this.tdef.ranged ? this.tdef.ranged.range + 60 : this.tdef.throwRock ? this.tdef.throwRock.range : 240;
        const t = g.nearestFoe(this.team, this.x, this.y, this.state === 'guard' && !this.provoked ? Math.min(sight, 280) : sight, { prefer: this.tdef.ranged && this.tdef.ranged.buildingPref ? (e) => e.isBuilding : (e) => !e.isBuilding && !e.isDragon });
        if (t && (!this.target || this.target.isBuilding || U.dist(this.x, this.y, t.x, t.y) < U.dist(this.x, this.y, this.target.x, this.target.y) * 0.7)) this.target = t;
      }
      // leash for guards and garrisons
      const lx = this.home.x, ly = this.home.y;
      const leash = this.state === 'guard' ? 420 : this.state === 'garrison' ? 600 : this.state === 'patrol' ? 380 : 1e9;
      if ((this.state === 'guard' || this.state === 'garrison') && U.dist(this.x, this.y, lx, ly) > leash) this.target = null;
      // patrols leave a fight that drags them too far off their round
      if (this.state === 'patrol' && this.target && this.route) { const wp = this.route[this.ri % this.route.length]; if (U.dist(this.x, this.y, wp[0], wp[1]) > 520) this.target = null; }
      let mx = null, my = null, sp = this.tdef.speed;
      const t = this.target;
      if (t) {
        const d = U.dist(this.x, this.y, t.x, t.y);
        this.attack(t, d, dt);
        const keep = t.isDragon ? (t.z > 40 ? 120 : 30) : this.tdef.ranged ? this.tdef.ranged.range * 0.7 : (this.tdef.melee ? this.tdef.melee.range * 0.8 : 12) + (t.r || 6) * 0.6;
        if (d > keep) { mx = t.x; my = t.y; }
        else if (t.isDragon) { mx = null; }
      } else if (this.state === 'patrol' && this.route) {
        // walk the round of the town's outskirts, waypoint to waypoint
        const wp = this.route[this.ri % this.route.length];
        mx = wp[0] + (this.pOff || 0); my = wp[1];
        if (U.dist(this.x, this.y, mx, my) < 36) this.ri++;
        sp *= 0.62;
        this.unstick(dt);
      } else if (this.state === 'march') {
        if (this.path && this.pi < this.path.length) this.unstick(dt);
        const wp = this.path && this.path[this.pi];
        if (wp) {
          mx = wp[0]; my = wp[1];
          if (U.dist(this.x, this.y, wp[0], wp[1]) < 30) this.pi++;
        } else if (this.recall) {
          this.recall = false; this.state = 'garrison'; this.path = null;
        } else {
          // arrived: hold the ground (siege targets the town)
          if (this.dest && this.dest.siege) { const foe = g.nearestFoe(this.team, this.x, this.y, 900); if (foe) this.target = foe; }
          if (U.dist(this.x, this.y, this.dest.x, this.dest.y) > this.dest.r) { mx = this.dest.x; my = this.dest.y; }
          else if (this.t > 2) { this.t = 0; this.wanderX = this.dest.x + U.range(-60, 60); this.wanderY = this.dest.y + U.range(-60, 60); }
          if (this.wanderX !== undefined && mx === null) { mx = this.wanderX; my = this.wanderY; sp *= 0.4; }
        }
      } else {
        // idle: mill about home
        if (this.t > 3) { this.t = Math.random() * 2; const a = Math.random() * TAU, r = Math.random() * this.home.r * 0.8; this.wanderX = lx + Math.cos(a) * r; this.wanderY = ly + Math.sin(a) * r * 0.86; }
        if (this.wanderX !== undefined && U.dist(this.x, this.y, this.wanderX, this.wanderY) > 8) { mx = this.wanderX; my = this.wanderY; sp *= 0.45; }
      }
      if (this.root > 0) mx = null;
      this.move(mx, my, sp * (this.slow > 0 ? 0.45 : 1), dt);
    }
    attack(t, d, dt) {
      const g = this.g, T = this.tdef;
      this.cd -= dt; this.cd2 -= dt;
      const ai = this.faction && this.faction.ai ? g.diff.ai : 1;
      if (t.isDragon) {
        // only missiles reach a dragon in the air
        if (T.ranged && d < T.ranged.range && this.cd <= 0 && !T.ranged.groundOnly) { this.cd = 1 / (T.ranged.rate * ai) * U.range(0.8, 1.2); AS.Combat.shoot(this, t, T.ranged.kind, { z: this.hc + 4 }); this.face(t); }
        else if (T.throwSpear && d < T.throwSpear.range && t.z < T.throwSpear.maxZ && this.cd2 <= 0) { this.cd2 = 1 / T.throwSpear.rate * U.range(0.8, 1.2); AS.Combat.shoot(this, t, 'spear', { z: this.hc + 4 }); this.face(t); }
        else if (T.throwRock && d < T.throwRock.range && this.cd2 <= 0) { this.cd2 = 1 / T.throwRock.rate * U.range(0.8, 1.2); AS.Combat.shoot(this, t, 'rock', { z: this.hc + 8 }); this.face(t); }
        else if (T.melee && d < T.melee.range + t.r && t.z < 26 && this.cd <= 0) { this.cd = 1 / T.melee.rate; t.takeDamage(T.melee.dmg * ai, 'melee', this); this.face(t); }
        return;
      }
      if (T.ranged && d < T.ranged.range && d > 30 && this.cd <= 0) {
        this.cd = 1 / (T.ranged.rate * ai) * U.range(0.8, 1.2);
        AS.Combat.shoot(this, t, T.ranged.kind, { z: this.hc + 4, dmgMul: T.ranged.kind === 'stone' ? 2 : 1 });
        this.face(t);
      } else if (T.melee && d < T.melee.range + (t.r || 6) * 0.7 && this.cd <= 0) {
        this.cd = 1 / T.melee.rate * U.range(0.85, 1.15);
        this.face(t);
        if (T.melee.splash) {
          g.damageArea(t.x, t.y, T.melee.splash, T.melee.dmg * ai, 'melee', this.team, this, { groundOnly: true, noLife: false });
          AS.FX.dust(t.x, t.y, 4, '#8a7a5a', 50); AS.Audio.sfx('giant_stomp', { x: this.x, y: this.y, vol: 0.6 });
        } else {
          t.takeDamage(T.melee.dmg * ai * (t.isBuilding ? 0.5 : 1), 'melee', this);
          if (Math.random() < 0.4) AS.Audio.sfx('sword_clash', { x: this.x, y: this.y, vol: 0.4, rate: U.range(0.85, 1.2) });
          if (Math.random() < 0.3) AS.FX.sparks(t.x, t.y, t.hc || 6, 2, '#ffe8b0');
        }
        this.lunge = 0.15;
      } else if (T.throwRock && d < T.throwRock.range && d > 60 && this.cd2 <= 0) {
        this.cd2 = 1 / T.throwRock.rate; AS.Combat.shoot(this, t, 'rock', { z: this.hc + 8 }); this.face(t);
      }
    }
    face(t) { this.angle = Math.atan2(t.y - this.y, t.x - this.x); }
    move(mx, my, sp, dt) {
      const g = this.g;
      if (mx !== null && mx !== undefined) {
        let a = Math.atan2(my - this.y, mx - this.x);
        a = this.passableDir(a);
        const k = 1 - Math.exp(-6 * dt);
        this.vx += (Math.cos(a) * sp - this.vx) * k; this.vy += (Math.sin(a) * sp - this.vy) * k;
        this.angle = U.turnToward(this.angle, Math.atan2(this.vy, this.vx), 6 * dt);
      } else { const k = Math.exp(-8 * dt); this.vx *= k; this.vy *= k; }
      // separation from neighbours keeps crowds from stacking
      this.sepT = (this.sepT || 0) - dt;
      if (this.sepT <= 0) {
        this.sepT = 0.2; this.sx = 0; this.sy = 0;
        for (const o of g.grid.query(this.x, this.y, 24, [])) if (o !== this && o.isTroop && o.alive) { const dx = this.x - o.x, dy = this.y - o.y, dd = dx * dx + dy * dy; if (dd < 196 && dd > 0.01) { this.sx += dx / dd * 14; this.sy += dy / dd * 14; } }
      }
      const nx = this.x + (this.vx + (this.sx || 0) * 8) * dt, ny = this.y + (this.vy + (this.sy || 0) * 8) * dt;
      if (g.terrain.groundPassable(nx, ny) && !this.blocked(nx, ny)) { this.x = nx; this.y = ny; }
      else { this.vx *= -0.3; this.vy *= -0.3; }
      this.x = U.clamp(this.x, 10, g.map.w - 10); this.y = U.clamp(this.y, 10, g.map.h - 10);
      const s = Math.hypot(this.vx, this.vy);
      this.anim += dt * (s > 4 ? 2 + s * 0.07 : 0);
      if (this.lunge > 0) this.lunge -= dt;
    }
    passableDir(a) {
      const g = this.g, L = this.r + 16;
      const ok = (ang) => { const px = this.x + Math.cos(ang) * L, py = this.y + Math.sin(ang) * L; return g.terrain.groundPassable(px, py) && !this.blocked(px, py); };
      if (ok(a)) return a;
      const side = this.avoidSide || (Math.random() < 0.5 ? 1 : -1);
      for (const off of [0.5, 1, 1.5, 2.1, 2.7]) {
        if (ok(a + off * side)) { this.avoidSide = side; return a + off * side; }
        if (ok(a - off * side)) { this.avoidSide = -side; return a - off * side; }
      }
      return a + Math.PI;
    }
    // walls stop everyone but their own side; other solid buildings stop everyone
    blocked(x, y) {
      for (const b of this.g.solidsNear(x, y)) {
        if (!b.alive || b.built < 0.5) continue;
        const isWall = b.kind === 'wall' || b.kind === 'gate';
        if (isWall && b.team === this.team) continue;
        if (!isWall && !b.solid) continue;
        const dx = x - b.x, dy = y - b.y, rr = (isWall ? 17 : b.r * 0.8) + this.r * 0.5;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
      return false;
    }
    updateCart(dt) {
      const g = this.g;
      // delivered once it reaches the town square (the keep itself is in the way of the exact spot)
      if (this.dest && U.dist(this.x, this.y, this.dest.x, this.dest.y) < Math.max(this.dest.r, 120)) {
        if (this.faction && !this.faction.eliminated) this.faction.addGold(this.cargo, this.x, this.y, 'cart');
        if (this.onDeliver) this.onDeliver();
        this.alive = false; this.removed = true;
        return;
      }
      this.unstick(dt);
      const wp = this.path && this.path[this.pi];
      let mx = null, my = null;
      if (wp) { mx = wp[0]; my = wp[1]; if (U.dist(this.x, this.y, wp[0], wp[1]) < 28) this.pi++; }
      else if (this.dest) { mx = this.dest.x; my = this.dest.y; }
      const fast = this.faction && this.faction.has('stable') ? 1.25 : 1;
      this.move(mx, my, this.tdef.speed * fast * (this.slow > 0 ? 0.45 : 1), dt);
      // tolls at bridges owned by another faction
      if (AS.Sites && Math.random() < dt * 2) AS.Sites.cartToll(g, this);
    }

    /* hauling or marching units that stop making progress replan from where
     * they stand, and, if still wedged, hop to their next waypoint */
    unstick(dt) {
      this.stuckT = (this.stuckT || 0) + dt;
      if (this.stuckT < 2.5) return;
      const moved = this.lastX === undefined ? 99 : Math.hypot(this.x - this.lastX, this.y - this.lastY);
      this.lastX = this.x; this.lastY = this.y; this.stuckT = 0;
      if (moved > 10 || !this.dest) { this.wedged = 0; return; }
      this.wedged = (this.wedged || 0) + 1;
      if (this.wedged === 1) { this.path = AS.Nav.path(this.g, this.x, this.y, this.dest.x, this.dest.y); this.pi = 1; }
      else {
        const wp = this.path && this.path[this.pi];
        if (wp) {
          // a short hop along the route, never a long teleport
          const dd = Math.hypot(wp[0] - this.x, wp[1] - this.y), k = Math.min(1, 70 / Math.max(1, dd));
          const nx = this.x + (wp[0] - this.x) * k, ny = this.y + (wp[1] - this.y) * k;
          if (this.g.terrain.groundPassable(nx, ny)) { this.x = nx; this.y = ny; if (k >= 1) this.pi++; }
        }
        this.wedged = 0;
      }
    }

    /* ---------------- drawing ---------------- */
    drawShadow(ctx, ox, oy) { AS.Renderer.shadow(ctx, this.sheet, this.angle, this.x, this.y, 0, ox, oy); }
    draw(ctx, ox, oy, R) {
      const lunge = this.lunge > 0 ? 3 : 0;
      const x = this.x + Math.cos(this.angle) * lunge, y = this.y + Math.sin(this.angle) * lunge;
      if (this.horse) R.sprite(ctx, this.horse, this.angle, this.anim, x + Math.cos(this.angle) * 14, y + Math.sin(this.angle) * 14, 0, ox, oy);
      R.sprite(ctx, this.sheet, this.angle, this.anim, x, y, 0, ox, oy);
      if (this.flash > 0) R.flashSprite(ctx, this.sheet, this.angle, this.anim, x, y, 0, ox, oy);
      if (this.root > 0) { ctx.strokeStyle = 'rgba(80,180,90,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x - ox, y - oy, this.r + 2, (this.r + 2) * 0.6, 0, 0, TAU); ctx.stroke(); }
      if (this.slow > 0 && this.g.time % 0.5 < 0.25) { ctx.fillStyle = 'rgba(200,240,255,0.5)'; ctx.beginPath(); ctx.arc(x - ox, y - oy - this.hc, 2, 0, TAU); ctx.fill(); }
      // faction pennant dot and a health bar when hurt
      const top = y - oy - this.hc * 2 - 6;
      if (this.faction) { ctx.fillStyle = this.faction.def.color; ctx.fillRect(Math.round(x - ox) - 1, Math.round(top), 3, 3); }
      if (this.hpBarT > 0 && this.hp < this.maxHp) {
        const w = Math.max(12, this.r * 2), bx = Math.round(x - ox - w / 2), by = Math.round(top - 4);
        ctx.globalAlpha = Math.min(1, this.hpBarT);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 1, by - 1, w + 2, 3);
        ctx.fillStyle = this.team === 'wild' ? '#e85a3a' : this.faction ? this.faction.def.color : '#ddd'; ctx.fillRect(bx, by, Math.max(0, w * this.hp / this.maxHp), 1.5);
        ctx.globalAlpha = 1;
      }
    }
  }
  AS.Troop = Troop;
})(window.AS);
