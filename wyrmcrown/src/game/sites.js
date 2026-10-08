/* WYRMCROWN — neutral objective sites and the contest for them.
 * Each site is a cluster of structures (village cottages, a mine, a castle…)
 * with optional guardians (team 'wild'). Capture rules:
 *  - guardians must be dead (or driven off) first;
 *  - a faction claims a site by being there: its dragon circling low (under
 *    the capture height) or its troops standing in the capture ring;
 *  - progress first wears down the current holder's control, then builds the
 *    new owner's; two factions present at once contest it and nothing moves.
 * Owned sites pay out, buff, defend, reveal, store spells or open waygates
 * (see data/sites.js). Treasure sites (caves, ruins) pay once, then their
 * guardians and hoard return after a while. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;
  const CAP_Z = 46;
  // site models whose banners and flags show the owner's colours
  const COLOURED = { prop_banner: 1, site_goldmine: 1, site_villagehall: 1, site_fort: 1, site_tradepost: 1, site_oldwatch: 1, site_castle: 1 };

  class Site {
    constructor(g, s) {
      this.g = g; this.spec = s; this.id = s.id; this.kind = s.k; this.def = AS.Data.sites[s.k];
      this.name = s.name || this.def.name;
      this.x = s.x; this.y = s.y;
      this.owner = null; this.controller = null; this.control = 0; this.contested = false;
      this.stock = 0; this.cartT = 10 + Math.random() * 10; this.spellT = this.def.spellT || 0; this.cd = 0;
      this.guards = []; this.structures = []; this.garrison = [];
      this.rich = !!s.rich;
      this.capR = this.def.capR;
      this.t = Math.random() * 10;
      this.looted = false; this.respawnT = 0;
      this.build();
      this.spawnGuards();
    }
    get isSite() { return true; }

    /* ---------------- layout ---------------- */
    struct(gen, x, y, o) {
      const B = new AS.Building(this.g, o && o.kind || 'site', null, x, y, Object.assign({ gen, team: 'neutral', instant: true, site: this, shoots: false }, o));
      B.invuln = true; B.targetable = false; B.burnable = false; B.palOverride = AS.Data.pal.neutral;
      if (o && o.dirs) { B.dirs = o.dirs; B.sheet = AS.Building.sheetFor(gen, AS.Data.pal.neutral, { v: o.v || 0 }, o.dirs, 1); }
      if (o && o.anims) B.sheet = AS.Building.sheetFor(gen, AS.Data.pal.neutral, { v: o.v || 0 }, 1, o.anims);
      if (o && o.solid === false) { const i = this.g.solids.indexOf(B); if (i >= 0) this.g.solids.splice(i, 1); B.solid = false; }
      B.sopt = { v: o && o.v || 0 }; B.sdirs = o && o.dirs || 1; B.sanims = o && o.anims || 1;
      if (this.g.terrain.frozenAt && this.g.terrain.frozenAt(x, y) && B.r > 10 && !(o && o.dirs)) this.g.terrain.addDecal('drift', x, y + B.r * 0.35, B.r * 1.15, null, { static: true, seed: (x * 3 + y) | 0 });
      this.g.buildings.push(B); this.structures.push(B);
      return B;
    }
    build() {
      const g = this.g, x = this.x, y = this.y, k = this.kind, rng = new U.RNG((x * 7 + y * 13) | 0);
      const anim4 = { wizardtower: 1, magicwell: 1, crystal: 1, relic: 1, waygate: 1 };
      if (k === 'village') {
        const n = 6 + (rng.next() * 3 | 0), spots = [];
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rng.range(-0.2, 0.2), r = 70 + rng.range(0, 55);
          const hx = x + Math.cos(a) * r, hy = y + Math.sin(a) * r * 0.82;
          this.struct('site_cottage', hx, hy, { v: i % 4 }); spots.push({ x: hx, y: hy + 14 });
        }
        this.struct('site_villagehall', x, y - 6, {});
        this.struct('site_well', x + 34, y + 30, { solid: false });
        const wa = rng.next() * TAU;
        this.struct('site_windmill', x + Math.cos(wa) * 175, y + Math.sin(wa) * 150, { anims: 4 });
        // fields, pasture and the village herd
        this.fields = [];
        for (let i = 0; i < 6; i++) {
          const a = wa + 0.9 + i * 0.75 + rng.range(-0.15, 0.15), r = 205 + (i % 2) * 55;
          const fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r * 0.86;
          if (g.terrain.kindFast(fx, fy) !== 0 || g.terrain.roadDist(fx, fy) < 36) continue;
          const f = { x: fx, y: fy, w: 64 + rng.range(-8, 24), h: 40 + rng.range(-4, 12), rot: a + Math.PI / 2 + rng.range(-0.3, 0.3), crop: ['wheat', 'barley', 'green', 'plough', 'flax'][(rng.next() * 5) | 0] };
          this.fields.push(f);
          g.terrain.addDecal('field', fx, fy, Math.max(f.w, f.h) * 0.6, null, { static: true, fw: f.w, fh: f.h, rot: f.rot, crop: f.crop, seed: (fx + fy * 7) | 0 });
        }
        const pa = wa + Math.PI;
        const px = x + Math.cos(pa) * 190, py = y + Math.sin(pa) * 160;
        g.terrain.addDecal('pasture', px, py, 80, null, { static: true, seed: px | 0, fk: g.terrain.biomeKey(px, py) });
        this.herd = AS.Life.herd(g, rng.next() < 0.5 ? 'sheep' : 'cow', px, py, 5, null, 75);
        AS.Life.addPeople(g, 'neutral', x, y, 170, 10, { pal: AS.Data.pal.neutral, spots, fields: this.fields });
        this.people = true;
        g.terrain.addDecal('plaza', x, y + 6, 70, null, { static: true, fk: 'neutral', seed: x | 0 });
      } else if (k === 'bridge') {
        const b = (g.map.bridges || []).find((q) => q.site === this.id) || { a: 0 };
        this.structures.push(Sites.bridge(g, b, this));
      } else if (k === 'tradepost') {
        this.struct('site_tradepost', x, y, {});
        this.struct('prop_tent', x - 70, y + 34, { solid: false }); this.struct('prop_stall', x + 66, y + 30, { solid: false });
        AS.Life.addPeople(g, 'neutral', x, y, 90, 5, { pal: AS.Data.pal.neutral });
      } else if (k === 'goldmine') {
        this.struct('site_goldmine', x, y, {});
        this.struct('prop_crates', x + 52, y + 26, { solid: false }); this.struct('prop_logs', x - 54, y + 30, { solid: false });
      } else {
        this.struct(this.def.gen, x, y, anim4[k] ? { anims: 4 } : {});
      }
      // a banner pole shows who holds the site (cream and grey while unclaimed)
      this.bannerPos = k === 'bridge' ? { x: x + 20, y: y + 26 } : { x: x + (this.def.r || 40) * 0.55 + 10, y: y + (this.def.r || 40) * 0.35 + 8 };
      if (k === 'bridge' && this.structures[0]) { const B = this.structures[0], a = B.angle; this.bannerPos = { x: x + Math.cos(a) * (B.len + 16) + 14, y: y + Math.sin(a) * (B.len + 16) + 14 }; }
      if (AS.Models.prop_banner && !this.def.treasure) this.banner = this.struct('prop_banner', this.bannerPos.x, this.bannerPos.y, { solid: false, anims: 4 });
      // a hoard waits in front of caves and ruins until it is looted
      if (this.def.treasure && AS.Models.site_chest) this.chest = this.struct('site_chest', x + 18, y + (this.def.r || 40) * 0.5 + 6, { solid: false });
    }
    spawnGuards() {
      const g = this.g;
      for (const [kind, n] of this.spec.guard || []) {
        for (let i = 0; i < n; i++) {
          const a = i / Math.max(1, n) * TAU + Math.random(), r = 30 + Math.random() * 60;
          const u = new AS.Troop(g, kind, 'wild', this.x + Math.cos(a) * r, this.y + Math.sin(a) * r * 0.8, { site: this, state: 'guard' });
          u.home = { x: this.x, y: this.y, r: 110 };
          g.troops.push(u); this.guards.push(u);
        }
      }
    }
    guarded() { for (const u of this.guards) if (u.alive) return true; return false; }
    onGuardKilled(u, src) {
      if (!this.guarded() && src && src.team && src.team !== 'wild') {
        const F = this.g.factions[src.team];
        if (F && F.key === this.g.playerKey) this.g.msg(this.name.toUpperCase() + ' IS UNGUARDED — CIRCLE LOW TO CLAIM IT', '#ffe7a8', 3);
      }
    }

    /* ---------------- ownership ---------------- */
    setOwner(fk, silent) {
      const g = this.g, prev = this.owner;
      if (prev === fk) return;
      if (prev && g.factions[prev]) g.factions[prev].sitesOwned--;
      this.owner = fk; this.controller = fk; this.control = fk ? 1 : 0;
      if ((fk || prev) && !silent && AS.Voices && AS.Voices.g === g) AS.Voices.onCapture(this, fk, prev);
      if (fk) g.factions[fk].sitesOwned++;
      this.recolour = true;
      if (this.herd) { this.herd.owner = fk; for (const o of g.life.animals) if (o.herd === this.herd) o.owner = fk; }
      if (this.people) for (const o of g.life.people) if (Math.hypot(o.x - this.x, o.y - this.y) < 260) o.team = fk || 'neutral';
      // garrisons for forts and castles
      for (const u of this.garrison) if (u.alive) u.takeDamage(1e6, 'disband', null);
      this.garrison = [];
      if (fk && this.def.garrison) {
        const F = g.factions[fk];
        for (let i = 0; i < this.def.garrison; i++) {
          const a = i / this.def.garrison * TAU, role = i % 2 ? 'archer' : 'soldier';
          const u = new AS.Troop(g, role, fk, this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 45, { gen: F.def.troops[role].gen, state: 'guard' });
          u.home = { x: this.x, y: this.y, r: 120 };
          g.troops.push(u); F.troops.push(u); this.garrison.push(u);
        }
      }
      this.stock = 0;
      if (silent) return;
      const F = fk && g.factions[fk];
      if (F) {
        const player = fk === g.playerKey, lost = prev === g.playerKey;
        g.news(F.def.short + ' captured ' + this.name + (prev ? ' from ' + g.factions[prev].def.short : ''), fk, player || lost);
        if (player) { g.msg(this.name.toUpperCase() + ' CAPTURED', '#ffe08a', 3); AS.Audio.sfx('capture'); g.stats.captured++; g.player.stats.captures++; }
        else if (lost) { g.msg(this.name.toUpperCase() + ' LOST TO ' + F.def.short.toUpperCase(), '#ff7a5a', 3); AS.Audio.sfx('capture_lost'); }
        AS.Particles.spawn({ x: this.x, y: this.y, z: 2, shape: AS.Particles.RING, col: F.def.color, size: 10, size2: this.capR * 1.2, life: 0.9, add: true, layer: 0, keep: true });
        if (F.lord) F.lord.onSiteCaptured && F.lord.onSiteCaptured(this);
      }
    }
    // who is present to claim the site right now: { faction: weight }
    presence() {
      const g = this.g, P = this._p || (this._p = {});
      for (const k in P) delete P[k];
      for (const d of g.dragons) {
        if (!d.targetable || d.z > CAP_Z) continue;
        if (Math.hypot(d.x - this.x, d.y - this.y) < this.capR) P[d.team] = (P[d.team] || 0) + 1 / 5.5;
      }
      for (const u of g.near(this.x, this.y, this.capR)) {
        if (!u.isTroop || !u.alive || u.role === 'cart' || !u.faction) continue;
        if (Math.hypot(u.x - this.x, u.y - this.y) < this.capR) P[u.team] = Math.min((P[u.team] || 0) + 1 / 16, 0.3);
      }
      return P;
    }

    // flags and banners take the holder's colours (sheets are rebuilt lazily,
    // once the site is near the camera, so distant captures cost nothing)
    applyColours() {
      const owner = this.owner || undefined;
      for (const B of this.structures) {
        if (!B.sopt || !COLOURED[B.gen]) continue;
        B.sheet = AS.Building.sheetFor(B.gen, AS.Data.pal.neutral, Object.assign({}, B.sopt, owner ? { owner } : {}), B.sdirs, B.sanims);
      }
      this.recolour = false;
    }
    update(dt) {
      const g = this.g;
      this.t += dt;
      if (this.recolour) { const c = g.camera; if (Math.abs(this.x - (c.x + c.w / 2)) < c.w + 400 && Math.abs(this.y - (c.y + c.h / 2)) < c.h + 400) this.applyColours(); }
      // treasure sites reset after a while
      if (this.def.treasure && this.looted) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) { this.looted = false; this.spawnGuards(); if (this.chest) this.chest.hidden = false; }
        return;
      }
      // ---- the contest
      this.contested = false;
      if (!this.guarded()) {
        const P = this.presence();
        // an ally (or a realm under truce) does not contest the owner's ground
        if (this.owner && g.pact) for (const k of Object.keys(P)) if (k !== this.owner && g.pact(k, this.owner)) delete P[k];
        const keys = Object.keys(P);
        if (keys.length > 1) this.contested = true;
        else if (keys.length === 1) {
          const k = keys[0], rate = P[k];
          if (this.def.treasure) { this.loot(k); return; }
          if (this.controller !== k) {
            this.control -= rate * dt * 1.4;
            if (this.control <= 0) { this.control = 0; if (this.owner && this.owner !== k) { const prev = this.owner; this.setOwnerNeutral(prev); } this.controller = k; }
          } else if (this.owner !== k) {
            this.control += rate * dt;
            this.tick = (this.tick || 0) - dt;
            if (this.tick <= 0 && g.factions[k] && k === g.playerKey) { this.tick = 0.5; AS.Audio.sfx('capture_tick', { vol: 0.6, rate: 0.8 + this.control }); }
            if (this.control >= 1) this.setOwner(k);
          }
        } else if (this.owner && this.control < 1) this.control = Math.min(1, this.control + dt * 0.05);
        else if (!this.owner && this.control > 0) { this.control = Math.max(0, this.control - dt * 0.04); if (this.control <= 0) this.controller = null; }
      }
      if (!this.owner) return;
      const F = g.factions[this.owner];
      if (!F || F.eliminated) { this.setOwner(null, true); return; }
      // ---- income by cart
      if (this.def.income) {
        this.stock += this.def.income * (this.rich ? 1.8 : 1) * dt;
        this.cartT -= dt;
        if (this.cartT <= 0 && this.stock >= 45) {
          this.cartT = 26;
          // no road home (an island, a cut-off valley): the gold is sent by courier raven
          if (!AS.Nav.reachable(g, this.x + 30, this.y + 40, F.townPos.x, F.townPos.y)) F.addGold(this.stock, this.x, this.y, 'courier');
          else {
            const cart = new AS.Troop(g, 'cart', this.owner, this.x + 30, this.y + 40, { cargo: Math.round(this.stock), site: this });
            cart.haulTo(F.townPos.x, F.townPos.y);
            g.troops.push(cart); F.troops.push(cart);
          }
          this.stock = 0;
        }
      }
      // ---- spells for the owner's rider
      if (this.def.spell) {
        this.spellT -= dt;
        if (this.spellT <= 0) {
          this.spellT = this.def.spellT;
          const d = F.dragon;
          if (d && (!d.spell || d.spell === this.def.spell)) { d.spell = this.def.spell; d.spellCharges = Math.min(3, (d.spellCharges || 0) + 1); if (d.isPlayer) g.msg(this.name.toUpperCase() + ' GRANTS ' + AS.Powerups.POWER[this.def.spell].name.toUpperCase() + ' (Q)', AS.Powerups.POWER[this.def.spell].col, 3); }
        }
      }
      // ---- auras for the owner's dragon
      const d = F.dragon;
      if (d && d.targetable) {
        const dd = Math.hypot(d.x - this.x, d.y - this.y);
        if (dd < 320) {
          if (this.def.well) { d.heal(d.maxHp * 0.03 * dt); d.mana = Math.min(d.maxMana, d.mana + 25 * dt); }
          if (this.def.grove) d.energy = Math.min(d.maxEnergy, d.energy + 3 * dt);
          if (this.def.blessing) d.heal(d.maxHp * 0.02 * dt);
          if ((this.def.well || this.def.grove || this.def.blessing) && Math.random() < 0.2) AS.Particles.spawn({ x: d.x + U.range(-20, 20), y: d.y + d.z, z: d.z, vz: 20, shape: AS.Particles.GLOW, col: this.def.grove ? '#9aff8a' : '#9fe8ff', size: 3, size2: 0.4, life: 0.6, add: true });
        }
      }
      // ---- defences
      if (this.def.shoots) {
        this.cd -= dt;
        if (this.cd <= 0) {
          const w = this.def.shoots;
          const t = g.nearestFoe(this.owner, this.x, this.y, w.range, { prefer: (e) => e.isDragon });
          if (t) {
            this.cd = 1 / w.rate * U.range(0.85, 1.2);
            const src = { x: this.x, y: this.y, team: this.owner, faction: F, g, hc: 30, shotZ: this.kind === 'wizardtower' ? 80 : 40, isSiteGun: true };
            for (let i = 0; i < (w.volley || 1); i++) g.later(i * 0.15, () => t.alive && AS.Combat.shoot(src, t, w.kind, { z: src.shotZ }));
            if (w.ballista && t.isDragon && Math.random() < 0.4) AS.Combat.shoot(src, t, 'ballista', { z: 50 });
          } else this.cd = 0.6;
        }
      }
    }
    setOwnerNeutral(prev) {
      const g = this.g;
      if (prev === g.playerKey) { g.msg(this.name.toUpperCase() + ' IS BEING TAKEN!', '#ff8a5a', 2.5); }
      this.setOwner(null, true);
      if (prev === g.playerKey && AS.Voices && AS.Voices.g === g) AS.Voices.onCapture(this, null, prev);
      if (prev === g.playerKey) AS.Audio.sfx('capture_lost');
    }
    loot(fk) {
      const g = this.g, F = g.factions[fk];
      this.looted = true; this.respawnT = this.def.respawn;
      if (this.chest) this.chest.hidden = true;
      const v = this.def.treasure;
      AS.Pickups.coins(g, this.x, this.y + 20, v);
      if (AS.Voices && AS.Voices.g === g) AS.Voices.onObjectiveReward(this, fk);
      AS.Audio.sfx('gold_big', { x: this.x, y: this.y });
      g.news(F.def.short + ' plundered the hoard of ' + this.name, fk, fk === g.playerKey);
      if (fk === g.playerKey) g.msg('TREASURE! SCOOP UP THE GOLD', '#ffd24a', 2.5);
      // ruins sometimes hide a power-up
      if (this.kind === 'ruins' && Math.random() < 0.6) { const kinds = ['power', 'inferno', 'storm', 'shield']; g.pickups.push(new AS.Pickup(g, kinds[(Math.random() * kinds.length) | 0], this.x + 30, this.y - 10)); }
    }

    /* ---------------- drawing ---------------- */
    drawGround(ctx, ox, oy, R) {
      const g = this.g, x = this.x - ox, y = this.y - oy;
      if (x < -300 || y < -300 || x > g.camera.w + 300 || y > g.camera.h + 300) return;
      const showRing = this.control > 0 && this.control < 1 || this.contested || (!this.owner && !this.guarded() && !this.looted);
      if (!showRing && !this.owner) return;
      const col = this.controller && g.factions[this.controller] ? g.factions[this.controller].def.color : '#f0e0b0';
      ctx.save();
      ctx.globalAlpha = 0.28; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.ellipse(x, y, this.capR, this.capR * 0.74, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (this.control > 0 && this.control < 1) {
        ctx.globalAlpha = 0.85; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.ellipse(x, y, this.capR, this.capR * 0.74, 0, -Math.PI / 2, -Math.PI / 2 + TAU * this.control); ctx.stroke();
      }
      if (this.contested && Math.sin(g.time * 10) > 0) { ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, this.capR + 4, (this.capR + 4) * 0.74, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    drawOverlay(ctx, ox, oy, R) {
      // ownership banner (drawn by hand only when the banner model is missing)
      if (!this.owner || this.banner) return;
      const g = this.g, F = g.factions[this.owner], b = this.bannerPos;
      const x = b.x - ox, y = b.y - oy;
      if (x < -60 || y < -100 || x > g.camera.w + 60 || y > g.camera.h + 60) return;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 0.8, y - 34, 1.6, 34);
      const wave = Math.sin(g.time * 4 + this.x) * 1.5;
      ctx.fillStyle = F.def.color;
      ctx.beginPath(); ctx.moveTo(x + 0.8, y - 34); ctx.quadraticCurveTo(x + 8, y - 34 + wave, x + 15, y - 32 + wave * 1.5); ctx.lineTo(x + 15, y - 22 + wave * 1.5); ctx.quadraticCurveTo(x + 8, y - 24 + wave, x + 0.8, y - 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F.def.color2; ctx.fillRect(x + 4, y - 31 + wave * 0.6, 5, 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
  }

  const Sites = {
    create(g, s) { return AS.Data.sites[s.k] ? new Site(g, s) : null; },
    /* a stone bridge long enough to span the river where the map puts it */
    bridge(g, b, site) {
      const T = g.terrain, a = b.a || 0, c = Math.cos(a), s = Math.sin(a);
      let reach = 0;
      for (const dir of [1, -1]) for (let t = 0; t < 280; t += 6) { if (T.gs(T.gWater, b.x + c * t * dir, b.y + s * t * dir) < 6) reach = Math.max(reach, t); }
      const len = U.clamp(Math.round((reach + 30) / 8) * 8, 60, 176);
      const B = new AS.Building(g, 'site', null, b.x, b.y, { gen: 'site_bridge', team: 'neutral', instant: true, site, shoots: false, angle: a });
      B.invuln = true; B.targetable = false; B.burnable = false; B.solid = false; B.flat = true;
      B.sheet = AS.Building.sheetFor('site_bridge', AS.Data.pal.neutral, { len }, 16, 1); B.dirs = 16; B.angle = a;
      B.viewR = len * 1.4; B.len = len;
      const i = g.solids.indexOf(B); if (i >= 0) g.solids.splice(i, 1);
      g.buildings.push(B);
      // the walkable corridor matches the visible deck
      const tb = (T.bridges || []).find((q) => Math.abs((q.x0 + q.x1) / 2 - b.x) < 1 && Math.abs((q.y0 + q.y1) / 2 - b.y) < 1);
      if (tb) { tb.x0 = b.x - c * (len + 10); tb.y0 = b.y - s * (len + 10); tb.x1 = b.x + c * (len + 10); tb.y1 = b.y + s * (len + 10); }
      return B;
    },
    // rival carts pay a toll crossing a bridge someone else owns
    cartToll(g, cart) {
      if (cart.tolled) return;
      for (const s of g.sites) {
        if (s.kind !== 'bridge' || !s.owner || s.owner === cart.team) continue;
        if (Math.hypot(cart.x - s.x, cart.y - s.y) < 110) {
          const toll = Math.round(cart.cargo * s.def.toll);
          cart.cargo -= toll; cart.tolled = true;
          g.factions[s.owner].addGold(toll, s.x, s.y, 'toll');
          return;
        }
      }
    },
    bonus(g, F, key) {
      let v = 0;
      for (const s of g.sites) if (s.owner === F.key && s.def[key]) v += s.def[key];
      return v;
    },
    // waygates the faction owns (fast-travel network)
    gatesOf(g, fk) { return g.sites.filter((s) => s.def.travel && s.owner === fk); },
    gateAt(g, d) {
      for (const s of g.sites) if (s.def.travel && s.owner === d.team && Math.hypot(d.x - s.x, d.y - s.y) < s.capR && d.z < 60) return s;
      return null;
    },
    travel(g, d, s) {
      AS.Particles.spawn({ x: d.x, y: d.y, z: d.z, shape: AS.Particles.GLOW, col: '#8affff', size: 20, size2: 80, life: 0.4, add: true, keep: true });
      d.x = s.x; d.y = s.y + 30; d.z = 40; d.speed = 120; d.landed = false; d.landing = false;
      for (const n of d.nodes) { n.x = d.x; n.y = d.y; n.z = d.z; }
      d.layoutRig(0, true);
      AS.Particles.spawn({ x: d.x, y: d.y, z: 20, shape: AS.Particles.RING, col: '#8affff', size: 10, size2: 120, life: 0.6, add: true, layer: 0, keep: true });
      AS.Audio.sfx('summon', { x: d.x, y: d.y });
      if (d.isPlayer && AS.Voices && AS.Voices.g === g) AS.Voices.event('waygate', { cooldown: 45 });
      if (d.isPlayer) { g.camera.snap(d.x, d.y - d.z); g.camera.flash(0.4, '#c8ffff'); g.msg('THROUGH THE WAYGATE TO ' + s.name.toUpperCase(), '#8affff', 2.5); }
    },
  };

  AS.Site = Site;
  AS.Sites = Sites;
})(window.AS);
