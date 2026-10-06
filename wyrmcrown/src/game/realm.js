/* WYRMCROWN — the realm: one match on one map.
 * The counterpart of ALIEN STRIKE's mission world (alien-strike/src/game/game.js):
 * it builds the map, owns every entity list, runs the frame, answers spatial
 * queries and plugs into the shared renderer through the same hooks
 * (drawGround, collectDrawables, drawProjectiles, drawOverlay).
 * The big difference is that the realm has four sides instead of two: every
 * damageable thing carries a team (a faction key, 'wild' for monsters or
 * 'neutral' for villagers), hostility is decided per pair, and projectile hits
 * are resolved through the engine's projHit hook. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  const SITE_ZONE = { castle: 230, fort: 170, goldmine: 120, village: 220, tradepost: 120, wizardtower: 80, magicwell: 90, grove: 90, crystal: 80, relic: 90, bridge: 0, shrine: 80, cave: 100, nest: 90, watchtower: 60, waygate: 70, ruins: 130 };

  function hostile(a, b) { return a !== b && a !== 'neutral' && b !== 'neutral'; }

  class Realm {
    constructor(map, opts) {
      opts = opts || {};
      this.map = map; this.opts = opts;
      this.playerKey = opts.faction || 'human';
      this.time = 0; this.ended = false; this.state = 'play';
      this.godMode = !!opts.god;
      this.diff = AS.Campaign ? AS.Campaign.difficultyFor(map, opts.difficulty) : AS.Data.difficulty[opts.difficulty || 'normal'];
      this.factions = {}; this.factionList = [];
      this.dragons = []; this.buildings = []; this.troops = []; this.sites = []; this.pickups = []; this.solids = [];
      this.byId = new Map();
      this.msgs = []; this.feed = []; this.laterQ = [];
      this.grid = new U.Grid(128);
      this.events = new U.Events();
      this.stats = { kills: 0, buildings: 0, goldEarned: 0, goldSpent: 0, eaten: 0, captured: 0, dragonsDowned: 0, raided: 0 };
      this.hostile = hostile;
      this.uiBlocking = false;
      this.region = 'neutral'; this.regionW = new Float32Array(5);
    }

    /* ================= loading ================= */
    load() {
      const m = this.map;
      this.world = AS.RealmWorld.make(m);
      AS.Proj.init(); AS.Proj.clear(); AS.Particles.clear();
      AS.Renderer.flares.length = 0;
      AS.Renderer.textFont = 'bold 9px "Cinzel", "Palatino Linotype", Georgia, serif';
      this.terrain = Realm.makeTerrain(this.world, m);
      this.camera = new AS.Camera();
      this.camera.setView(AS.Renderer.vw, AS.Renderer.vh);
      this.camera.bounds = { x0: 0, y0: 0, x1: m.w, y1: m.h };
      this.camera.leadK = [0.5, 0.42]; this.camera.leadMax = [240, 170]; this.camera.leadRate = 1.7; this.camera.follow = 5; this.camera.zoomRate = 1.6;
      // factions, their towns and dragons
      for (const fk of AS.Data.factionOrder) {
        if (!m.factions[fk]) continue;
        const F = AS.Faction ? new AS.Faction(this, fk, m.factions[fk]) : { key: fk, def: AS.Data.factions[fk], upgrades: {}, gold: 0 };
        this.factions[fk] = F; this.factionList.push(F);
      }
      this.player = null;
      for (const F of this.factionList) {
        const def = AS.Data.factions[F.key];
        const fdata = Object.assign({}, def, { upgrades: F.upgrades, ai: F.key !== this.playerKey });
        F.dragonDef = fdata;
        const home = this.roostOf(F);
        const human = F.key === this.playerKey && !this.opts.demo;
        const pilot = human ? new AS.HumanPilot() : (AS.AIPilot ? new AS.AIPilot(this, F) : null);
        const d = new AS.Dragon(this, Object.assign(fdata, { upgrades: F.upgrades }), { x: home.x, y: home.y + 40, angle: Math.atan2(m.h / 2 - home.y, m.w / 2 - home.x), pilot });
        d.faction = F; F.dragon = d;
        d.isPlayer = human;
        this.dragons.push(d);
        if (F.key === this.playerKey) this.player = d;
      }
      this.playerFaction = this.factions[this.playerKey];
      // navigation and wildlife first, then towns (which breed herds) and sites
      if (AS.Nav) AS.Nav.build(this);
      if (AS.Life) AS.Life.init(this);
      for (const F of this.factionList) if (F.buildTown) F.buildTown();
      if (AS.Sites) for (const s of m.sites) { const site = AS.Sites.create(this, s); if (site) { this.sites.push(site); this.byId.set(site.id, site); } }
      // bridges that are not objectives still need their stonework
      if (AS.Sites) for (const b of m.bridges || []) if (!b.site) AS.Sites.bridge(this, b, null);
      if (AS.Roads) AS.Roads.lay(this);
      if (AS.Powerups) AS.Powerups.init(this);
      // explored fog for the war map
      this.fogCell = 96;
      this.fogW = Math.ceil(m.w / this.fogCell); this.fogH = Math.ceil(m.h / this.fogCell);
      this.explored = new Uint8Array(this.fogW * this.fogH);
      const pt = this.playerFaction.townPos || this.roostOf(this.playerFaction);
      this.revealArea(pt.x, pt.y, 1500);
      const p = this.player;
      this.camera.snap(p.x, p.y - p.z);
      // pre-generate the chunks around the start
      const cam = this.camera, S = AS.Terrain.CH;
      for (let cy = Math.floor((cam.y - 128) / S); cy <= Math.floor((cam.y + cam.h + 128) / S); cy++)
        for (let cx = Math.floor((cam.x - 128) / S); cx <= Math.floor((cam.x + cam.w + 128) / S); cx++) this.terrain.getChunk(cx, cy);
      this.tacMap = this.terrain.buildMap(24);
      this.updateRegion(0, true);
      this.events.emit('loaded');
      return this;
    }
    roostOf(F) {
      if (F.roost) return F.roost;
      const t = this.map.factions[F.key].town;
      return { x: t.x + 90, y: t.y + 60 };
    }

    /* ================= queries ================= */
    rebuildGrid() {
      const G = this.grid; G.clear();
      for (const d of this.dragons) if (d.targetable) G.insertAt(d, d.x, d.y);
      for (const t of this.troops) if (t.alive) G.insert(t);
      for (const b of this.buildings) if (b.alive && b.targetable !== false) G.insert(b);
      if (AS.Life) AS.Life.gridInsert(this, G);
    }
    near(x, y, r, out) { return this.grid.query(x, y, r, out || []); }
    // solid buildings and walls near a point (static grid, refreshed each second)
    solidsNear(x, y) {
      if (!this.solidGrid || this.time - this.solidT > 1) {
        this.solidT = this.time;
        const G = this.solidGrid || (this.solidGrid = new U.Grid(96)); G.clear();
        for (const b of this.buildings) if (b.alive && (b.solid || b.kind === 'wall' || b.kind === 'gate')) G.insert(b);
      }
      return this.solidGrid.query(x, y, 60, this._sq || (this._sq = []), this._sq.length = 0);
    }
    // hostile, alive, targetable entities within r of (x, y) for team
    foesNear(team, x, y, r, opt) {
      const out = this._fn || (this._fn = []);
      out.length = 0;
      const list = this.grid.query(x, y, r + 40, this._fq || (this._fq = []));
      list.length = list.length; // reuse
      for (const e of list) {
        if (!e.alive || e.targetable === false || !hostile(team, e.team)) continue;
        if (opt && opt.noAir && e.isDragon) continue;
        if (opt && opt.airOnly && !e.isDragon) continue;
        const dx = e.x - x, dy = e.y - y, rr = r + (e.r || 0) * 0.5;
        if (dx * dx + dy * dy < rr * rr) out.push(e);
      }
      this._fq.length = 0;
      return out;
    }
    nearestFoe(team, x, y, r, opt) {
      let best = null, bd = 1e18;
      for (const e of this.foesNear(team, x, y, r, opt)) {
        let d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        if (opt && opt.prefer && opt.prefer(e)) d *= 0.35;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    /* ================= combat plumbing ================= */
    damageArea(x, y, R, dmg, dtype, team, src, opts) {
      opts = opts || {};
      const list = this.grid.query(x, y, R + 60, []);
      for (const e of list) {
        if (!e.alive || e === opts.exclude || e.targetable === false) continue;
        if (!opts.hitsAll && !hostile(team, e.team) && e.team !== 'neutral') continue;
        if (e.team === team) continue;
        const z = e.z || 0;
        if (opts.groundOnly && z > 40) continue;
        const d = Math.hypot(x - e.x, y - e.y) + Math.max(0, z - (opts.z || 0) - 20) * 0.7;
        if (d > R + (e.r || 0) * 0.5) continue;
        const k = 1 - 0.5 * U.clamp(d / R, 0, 1);
        e.takeDamage(dmg * k, dtype, src, opts);
        if (opts.burn && e.ignite) e.ignite(opts.burn, src);
      }
      if (AS.Life && !opts.noLife) AS.Life.damageArea(this, x, y, R, dmg, dtype, team, src, opts);
    }
    projHit(p) { return AS.Combat ? AS.Combat.projHit(this, p) : false; }
    projExpire(p) { if (AS.Combat) AS.Combat.projExpire(this, p); }
    projBurst(p) { if (AS.Combat) AS.Combat.projBurst(this, p); }
    shakeNear(x, y, amt) {
      const p = this.player; if (!p) return;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < 700) this.camera.shake(amt * (1 - d / 700));
    }
    groundDust(x, y) { const b = this.terrain.biomeKey(x, y); return b === 'ice' ? '#e8eef6' : b === 'undead' ? '#5a5450' : '#9a8a62'; }

    /* ================= events & messages ================= */
    msg(text, col, dur) {
      if (this.msgs.length && this.msgs[this.msgs.length - 1].text === text) { this.msgs[this.msgs.length - 1].t = dur || 3; return; }
      this.msgs.push({ text, col: col || '#f0e0b0', t: dur || 3, max: dur || 3 });
      if (this.msgs.length > 4) this.msgs.shift();
    }
    // the herald's feed: realm-wide news, coloured by faction
    news(text, fk, important) {
      this.feed.push({ text, fk: fk || null, t: important ? 9 : 6, max: important ? 9 : 6, important: !!important });
      if (this.feed.length > 5) this.feed.shift();
      if (important) AS.Audio.sfx('herald', { vol: 0.6 });
    }
    later(t, fn) { this.laterQ.push({ t, fn }); }
    emit(name, a, b) { this.events.emit(name, a, b); }
    revealArea(x, y, r) {
      const c = this.fogCell;
      for (let cy = Math.floor((y - r) / c); cy <= Math.floor((y + r) / c); cy++) for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) {
        if (cx < 0 || cy < 0 || cx >= this.fogW || cy >= this.fogH) continue;
        const dx = cx * c + c / 2 - x, dy = cy * c + c / 2 - y;
        if (dx * dx + dy * dy < r * r) this.explored[cy * this.fogW + cx] = 1;
      }
    }
    isExplored(x, y) {
      const cx = Math.floor(x / this.fogCell), cy = Math.floor(y / this.fogCell);
      if (cx < 0 || cy < 0 || cx >= this.fogW || cy >= this.fogH) return false;
      return this.explored[cy * this.fogW + cx] === 1;
    }
    atRoost(d) { const r = this.roostOf(d.faction); return Math.hypot(d.x - r.x, d.y - r.y) < 80 && d.speed < 110; }
    onDragonDown(d, src) {
      this.stats.dragonsDowned += src && src.team === this.playerKey ? 1 : 0;
      const killer = src && src.faction ? src.faction : null;
      if (d === this.player) { this.msg(d.name.toUpperCase() + ' IS DOWN — RECOVERING AT THE ROOST', '#ff7a5a', 5); this.news(d.name + ' has been driven from the sky!', d.fk, true); }
      else this.news(d.name + ' of ' + d.faction.def.short + ' was driven from the sky' + (killer ? ' by ' + killer.def.short : '') + '!', d.fk, true);
      if (killer && killer.addGold) killer.addGold(150, d.x, d.y, 'dragon');
      if (AS.Factions && AS.Factions.onDragonDown) AS.Factions.onDragonDown(this, d, src);
    }
    onDragonRespawn(d) { if (d === this.player) this.msg(d.name.toUpperCase() + ' TAKES WING AGAIN', '#ffe08a', 3); }

    /* ================= update ================= */
    update(dt) {
      if (this.ended) return;
      this.time += dt;
      this.rebuildGrid();
      for (const d of this.dragons) d.update(dt);
      for (let i = this.troops.length - 1; i >= 0; i--) { const t = this.troops[i]; if (t.removed) { this.troops.splice(i, 1); continue; } t.update(dt); }
      for (let i = this.buildings.length - 1; i >= 0; i--) { const b = this.buildings[i]; if (b.removed) { this.buildings.splice(i, 1); continue; } b.update(dt); }
      for (const s of this.sites) s.update(dt);
      for (let i = this.pickups.length - 1; i >= 0; i--) { const q = this.pickups[i]; if (!q.alive) { this.pickups.splice(i, 1); continue; } q.update(dt); }
      for (const F of this.factionList) F.update && F.update(dt);
      if (AS.Life) AS.Life.update(this, dt);
      if (AS.Powerups) AS.Powerups.update(this, dt);
      AS.Proj.update(this, dt);
      AS.Particles.update(dt);
      for (let i = this.laterQ.length - 1; i >= 0; i--) { const l = this.laterQ[i]; l.t -= dt; if (l.t <= 0) { this.laterQ.splice(i, 1); l.fn(); } }
      // camera: follows the dragon's body, leads its travel, pulls back with speed
      if (this.demo) this.demoCamera(dt);
      const p = this.demo ? this.focus : this.player;
      const sp = p.down > 0 ? 0 : p.speed;
      const zoomT = U.clamp((sp - 150) / 300, 0, 1);
      this.camera.baseZoom = U.lerp(1, 0.8, zoomT) - (p.diving ? 0.03 : 0);
      const tx = p.down > 0 && p.fall <= 0 ? this.roostOf(p.faction).x : p.x, ty = p.down > 0 && p.fall <= 0 ? this.roostOf(p.faction).y : p.y - p.z;
      this.camera.update(dt, tx, ty, p.down > 0 ? 0 : p.vx, p.down > 0 ? 0 : p.vy);
      if (this.demo) { this.updateRegion(dt); return; }
      this.exploreT = (this.exploreT || 0) - dt;
      if (this.exploreT <= 0) { this.exploreT = 0.3; this.revealArea(p.x, p.y, 900); if (AS.Factions) AS.Factions.reveal(this); }
      for (let i = this.msgs.length - 1; i >= 0; i--) { this.msgs[i].t -= dt; if (this.msgs[i].t <= 0) this.msgs.splice(i, 1); }
      for (let i = this.feed.length - 1; i >= 0; i--) { this.feed[i].t -= dt; if (this.feed[i].t <= 0) this.feed.splice(i, 1); }
      this.updateRegion(dt);
      this.updateMusic(dt);
      if (AS.Factions && AS.Factions.checkVictory) AS.Factions.checkVictory(this);
      if (this.state === 'ending') { this.endT -= dt; if (this.endT <= 0) this.finish(); }
    }

    // attract mode: follow a dragon, switching every so often to whoever is busiest
    demoCamera(dt) {
      this.focusT = (this.focusT || 0) - dt;
      if (!this.focus || this.focus.down > 0 || this.focusT <= 0) {
        this.focusT = 18;
        const live = this.dragons.filter((d) => d.down <= 0);
        live.sort((a, b) => (b.breathing ? 2 : 0) + (b.faction.lord && b.faction.lord.goal.type === 'duel' ? 3 : 0) - ((a.breathing ? 2 : 0) + (a.faction.lord && a.faction.lord.goal.type === 'duel' ? 3 : 0)) + Math.random() - 0.5);
        const was = this.focus; this.focus = live[0] || this.dragons[0];
        if (was !== this.focus) this.camera.snap(this.focus.x, this.focus.y - this.focus.z);
      }
    }
    /* blend the region look (air, light tint) and switch music/ambience where you fly */
    updateRegion(dt, snap) {
      const p = (this.demo && this.focus) || this.player, T = this.terrain, w = T.biomeAt(p.x, p.y, this._rw || (this._rw = new Float32Array(5)));
      const k = snap ? 1 : Math.min(1, dt * 0.8);
      for (let i = 0; i < 5; i++) this.regionW[i] += (w[i] - this.regionW[i]) * k;
      let best = 4, bv = 0;
      for (let i = 0; i < 5; i++) if (this.regionW[i] > bv) { bv = this.regionW[i]; best = i; }
      const key = AS.RealmTerrain.BIOMES[best];
      const A = this.world.atm, L = this.world.light;
      // atmosphere: weighted mix of each region's preset, re-keyed so the shared
      // atmosphere layer rebuilds its cached gradients when the mix shifts
      const R = AS.RealmWorld.REGION, B = AS.RealmTerrain.BIOMES;
      const mix = (f) => { let v = 0; for (let i = 0; i < 5; i++) v += R[B[i]].atm[f] * this.regionW[i]; return v; };
      for (const f of ['cloud', 'hazeA', 'sunA', 'shadeA']) A[f] = mix(f);
      const dom = R[key];
      A.haze = dom.atm.haze; A.sun = dom.atm.sun; A.shade = dom.atm.shade; A.cloudCol = dom.atm.cloudCol; A.wind = dom.atm.wind;
      let amb = 0; for (let i = 0; i < 5; i++) amb += R[B[i]].ambient * this.regionW[i];
      L.ambient = amb > 0.985 ? 1 : amb;
      const deadW = this.regionW[3], iceW = this.regionW[2], elfW = this.regionW[1], humW = this.regionW[0];
      L.tint = deadW > 0.15 ? 'rgba(80,40,110,' + (deadW * 0.055).toFixed(3) + ')' : iceW > 0.15 ? 'rgba(150,200,255,' + (iceW * 0.05).toFixed(3) + ')' : elfW > 0.2 ? 'rgba(80,200,140,' + (elfW * 0.035).toFixed(3) + ')' : humW > 0.3 ? 'rgba(255,200,120,' + (humW * 0.03).toFixed(3) + ')' : null;
      const qk = 'realm:' + this.map.id + ':' + key + ':' + Math.round(A.hazeA * 40) + ':' + Math.round(A.sunA * 40);
      this.world.key = qk;
      if (key !== this.region || snap) {
        const was = this.region;
        this.region = key;
        if (!snap && p.isPlayer !== false) {
          const owner = key === 'neutral' ? null : this.factions[key];
          this.msg((owner ? owner.def.name : 'The Heartland').toUpperCase(), owner ? owner.def.color : '#f0e0b0', 2.5);
        }
        if (AS.RealmAudio) AS.RealmAudio.region(this, key, was);
      }
    }
    updateMusic(dt) {
      if (!AS.Music) return;
      const p = this.player;
      let level = 0;
      const foes = this.foesNear(p.team, p.x, p.y, 650);
      let n = 0, dragon = false;
      for (const f of foes) { if (f.isDragon) dragon = true; else if (!f.isBuilding || f.shoots) n++; }
      if (n >= 1 || p.g.time - p.lastHurt < 4) level = 1;
      if (n >= 5) level = 2;
      if (dragon) level = Math.max(level, 2);
      if (this.siegeMusic) level = 3;
      AS.Music.setIntensity(level);
      this.combatLevel = level;
    }

    finish() {
      if (this.ended) return;
      this.ended = true;
      if (this.onEnd) this.onEnd(this.result || { won: false });
    }

    /* ================= rendering hooks ================= */
    collectDrawables(list, x0, y0, x1, y1) {
      const inV = (o, m) => o.x > x0 - (m || 0) && o.x < x1 + (m || 0) && o.y > y0 - (m || 0) && o.y < y1 + (m || 0) + 160;
      for (const d of this.dragons) if (!d.hidden && inV(d, 120)) list.push(d);
      for (const t of this.troops) if (t.alive && inV(t, 30)) list.push(t);
      for (const b of this.buildings) if (!b.flat && inV(b, b.viewR || 120)) list.push(b);
      for (const s of this.sites) if (s.collect && inV(s, s.viewR || 200)) s.collect(list, x0, y0, x1, y1);
      for (const q of this.pickups) if (q.alive && inV(q, 20)) list.push(q);
      if (AS.Life) AS.Life.collect(this, list, x0, y0, x1, y1);
    }
    drawGround(ctx, ox, oy, R) {
      for (const b of this.buildings) if (b.flat || b.drawGround) (b.drawGround || b.draw).call(b, ctx, ox, oy, R);
      for (const s of this.sites) if (s.drawGround) s.drawGround(ctx, ox, oy, R);
      if (AS.Fields && AS.Fields.drawGround) AS.Fields.drawGround(ctx, ox, oy, this);
      if (AS.Powerups) AS.Powerups.drawGround(ctx, ox, oy, this);
    }
    drawProjectiles(ctx, ox, oy, R) {
      AS.Proj.draw(ctx, ox, oy, this);
      if (AS.Combat) AS.Combat.drawBreaths(ctx, ox, oy, this, R);
    }
    drawOverlay(ctx, ox, oy, R) {
      if (AS.Fields && AS.Fields.drawOverlay) AS.Fields.drawOverlay(ctx, ox, oy, this);
      if (AS.Life) AS.Life.drawSky(ctx, ox, oy, this, R);
      for (const s of this.sites) if (s.drawOverlay) s.drawOverlay(ctx, ox, oy, R);
      for (const d of this.dragons) if (!d.hidden && d.drawOverlay) d.drawOverlay(ctx, ox, oy, R);
    }
  }

  /* terrain for a map: towns and sites flatten their ground and keep trees off,
   * farmland rings the towns and villages, bridges make water passable */
  Realm.makeTerrain = function (world, m) {
    const zones = [], fields = [], clearings = [];
    for (const fk in m.factions) {
      const t = m.factions[fk].town;
      // elves keep their trees among the buildings; the others clear farmland
      zones.push({ x: t.x, y: t.y, r: 470, soft: 1.6, treeR: fk === 'elf' ? 0.45 : 1.0 });
      if (fk !== 'elf') fields.push({ x: t.x, y: t.y, r: fk === 'undead' ? 640 : fk === 'ice' ? 560 : 900 });
    }
    for (const s of m.sites) {
      const r = SITE_ZONE[s.k];
      if (r) zones.push({ x: s.x, y: s.y, r, soft: 1.5 });
      if (s.k === 'village') fields.push({ x: s.x, y: s.y, r: 360 });
      else clearings.push({ x: s.x, y: s.y, r: (r || 60) * 1.15 });
    }
    for (const b of m.bridges || []) clearings.push({ x: b.x, y: b.y, r: 120 });
    const T = new AS.RealmTerrain(world, Object.assign({}, m, { zones, fields, clearings }));
    for (const b of m.bridges || []) {
      const a = b.a || 0, L = 150;
      T.bridges.push({ x0: b.x - Math.cos(a) * L, y0: b.y - Math.sin(a) * L, x1: b.x + Math.cos(a) * L, y1: b.y + Math.sin(a) * L, w: 24, a, site: b.site });
    }
    return T;
  };
  Realm.hostile = hostile;
  Realm.SITE_ZONE = SITE_ZONE;
  AS.Realm = Realm;
})(window.AS);
