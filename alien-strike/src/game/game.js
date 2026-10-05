/* ALIEN STRIKE — the mission world.
 * Builds a mission from level data, owns every entity list, runs the frame
 * update, answers spatial queries, routes events to the mission script, and
 * decides success (physical extraction) or failure. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;

  class Game {
    constructor(mission, profile, opts) {
      opts = opts || {};
      this.mission = mission;
      this.profile = profile;
      this.world = AS.Data.worldById(mission.world);
      this.map = mission.map;
      this.time = 0;
      this.units = []; this.structures = []; this.props = []; this.pickups = []; this.groups = []; this.survivors = [];
      this.cargo = []; this.obstacles = []; this.solids = []; this.friendlies = []; this.pads = [];
      this.landmarks = []; this.sites = [];
      this.zones = new Map(); this.byId = new Map(); this.markers = [];
      this.convoys = {}; this.convoyState = {}; this.groupSpawned = {}; this.boardedGroups = {}; this.pickedIds = {}; this.cargoPicked = {};
      this.laterQ = [];
      this.msgs = []; this.subtitle = null;
      this.state = 'play'; this.ended = false; this.endT = 0;
      this.lockWarn = 0; this.missileWarn = 0; this.alertedOnce = false;
      this.musicOverride = null;
      this.uiBlocking = false;
      this.revealHidden = false;
      this.diffMul = 0.82 + (this.world.id - 1) * 0.045 + (mission.index - 1) * 0.02;
      this.diffRate = 1;
      this.stats = { kills: 0, structures: 0, salvage: 0, bonusSalvage: 0, tech: 0, rescued: 0, boarded: 0, lost: 0, delivered: 0, cargo: 0, pickups: 0, props: 0, intel: 0, missilesDowned: 0, shots: 0 };
      this.events = new U.Events();
      this.gridE = new U.Grid(96); this.gridU = new U.Grid(128); this.gridH = new U.Grid(128);
      this.godMode = !!opts.god;
    }

    /* ================= loading ================= */
    load() {
      const m = this.mission;
      if (AS.ArtMap) AS.ArtMap.apply();
      // sprite sheets are cached for reuse; when the campaign moves to another world,
      // drop the previous world's sheets (bosses and big vehicles run to 25-35 MB each)
      if (AS.Forge.world !== this.world.key) {
        if (AS.Forge.world) for (const k of Array.from(AS.Forge.cache.keys())) if (!/^(craft|pod|glow|flat)/.test(k)) AS.Forge.cache.delete(k);
        AS.Forge.world = this.world.key;
      }
      AS.Proj.init(); AS.Proj.clear();
      AS.Particles.clear();
      AS.Renderer.flares.length = 0;
      AS.FX.groundCol = this.world.terrain.ramp[1] || '#a08060';
      this.terrain = new AS.Terrain(this.world, m.map);
      this.camera = new AS.Camera();
      this.camera.setView(AS.Renderer.vw, AS.Renderer.vh);
      this.camera.bounds = { x0: 0, y0: 0, x1: m.map.w, y1: m.map.h };
      const stats = AS.Stats.compute(this.profile);
      this.player = new AS.Player(this, stats, this.profile);
      this.player.x = m.start.x; this.player.y = m.start.y; this.player.angle = m.start.angle !== undefined ? m.start.angle : -Math.PI / 2;
      this.extraction = { x: m.extraction.x, y: m.extraction.y, r: m.extraction.r || 70, active: false, t: 0, hotWarned: false };
      // landing zone at extraction: always accepts survivors and cargo
      this.lz = this.spawnStructure('pad', m.extraction.x, m.extraction.y, { id: 'lz', pad: { dropoff: true, repair: !!m.extraction.repair, refuel: !!m.extraction.refuel, rearm: !!m.extraction.rearm, lz: true } });
      const dsPal = { a: '#5a6470', b: '#a0acba', t: '#e8a02a', g: '#7fe8ff', d: '#262c34' }, dsAlt = AS.ArtMap && AS.ArtMap.gen('dropship');
      this.dropshipGrounded = !!dsAlt;
      // the carrier parks on whichever side of the pad has flat open ground
      if (dsAlt) {
        const T = this.terrain, f = new Float32Array(4), ex0 = m.extraction.x, ey0 = m.extraction.y;
        T.field(ex0, ey0, f); const lz = T.levelOf(f[0]);
        const flat = (cx, cy) => { for (const [dx, dy] of [[0, 0], [-40, 0], [40, 0], [0, -26], [0, 26], [-30, 20], [30, -20], [-40, -60], [0, -70], [40, -60]]) { T.field(cx + dx, cy + dy, f); if (T.levelOf(f[0]) !== lz || T.kindOf(f[0], f[2]) !== 0) return false; } return true; };
        const opts = [[112, -44], [-112, -44], [112, 40], [-112, 40], [0, -118], [150, 0], [-150, 0]];
        this.dsOff = opts.find((o) => flat(ex0 + o[0], ey0 + o[1])) || opts[0];
      }
      this.dropship = dsAlt
        ? AS.Forge.sheet('dropship2', () => AS.Models[dsAlt.gen](dsAlt.pal || dsPal, dsAlt.opt || {}), 1, 1, { angle: -0.45 })
        : AS.Forge.sheet('dropship', () => AS.Models.gunship(dsPal, { size: 1.7 }), 1, 1);
      this.reinforce = Object.assign({ enabled: !!m.reinforcements, comms: [], squads: [], from: [], delay: 8, cooldown: 45, max: 4, sent: 0, cd: 0, announced: false }, m.reinforcements || {});
      this.script = new AS.Script(this, m);
      this.spawnSpecs(m.entities || []);
      this.hazards = new AS.Hazards(this, m);
      // scenery set pieces, haul roads and building footprints (before any chunk is rasterised)
      AS.Landmarks.place(this); AS.Landmarks.roads(this); AS.Landmarks.foundations(this);
      // explored fog grid
      this.fogCell = 64;
      this.fogW = Math.ceil(m.map.w / this.fogCell); this.fogH = Math.ceil(m.map.h / this.fogCell);
      this.explored = new Uint8Array(this.fogW * this.fogH);
      if (m.revealed) for (const r of m.revealed) this.revealArea(r.x, r.y, r.r);
      this.revealHidden = stats.scanLevel >= 3;
      this.camera.snap(this.player.x, this.player.y - this.player.z);
      // pre-generate nearby terrain
      const cam = this.camera, S = AS.Terrain.CH;
      for (let cy = Math.floor((cam.y - 128) / S); cy <= Math.floor((cam.y + cam.h + 128) / S); cy++)
        for (let cx = Math.floor((cam.x - 128) / S); cx <= Math.floor((cam.x + cam.w + 128) / S); cx++) this.terrain.getChunk(cx, cy);
      this.tacMap = this.terrain.buildMap(12);
      this.events.emit('loaded');
      return this;
    }

    spawnSpecs(list) { for (const s of list) this.spawnSpec(s); }
    spawnSpec(s) {
      const n = s.n || 1;
      switch (s.t) {
        case 'unit': {
          const out = [];
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + Math.random(), r = n > 1 ? (s.spread || 40) * Math.sqrt(Math.random()) : 0;
            const u = this.spawnUnit(s.k, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, Object.assign({}, s, { id: n > 1 && s.id ? s.id + '_' + i : s.id }));
            if (u) out.push(u);
          }
          if (s.group) this.groupSpawned[s.group] = true;
          if (s.alert) for (const u of out) { u.alerted = true; u.alertT = 30; u.alwaysActive = true; }
          return out;
        }
        case 'struct': return this.spawnStructure(s.k, s.x, s.y, s);
        case 'pickup': for (let i = 0; i < n; i++) this.spawnPickup(s.k, s.x + (n > 1 ? U.range(-1, 1) * (s.spread || 30) : 0), s.y + (n > 1 ? U.range(-1, 1) * (s.spread || 30) : 0), s); return;
        case 'survivors': { const gr = new AS.SurvivorGroup(this, s); this.groups.push(gr); if (s.id) this.byId.set(s.id, gr); return gr; }
        case 'cargo': { const c = new AS.Cargo(this, s); this.cargo.push(c); if (s.id) this.byId.set(s.id, c); return c; }
        case 'prop': for (let i = 0; i < n; i++) this.spawnProp(s.k, s.x + (n > 1 ? U.range(-1, 1) * (s.spread || 40) : 0), s.y + (n > 1 ? U.range(-1, 1) * (s.spread || 40) : 0), s); return;
        case 'obstacle': { const o = new AS.Obstacle(this, s.k || this.world.obstacle.kind, s.x, s.y, s); this.obstacles.push(o); this.solids.push(o); return o; }
        case 'zone': { const z = { id: s.id, x: s.x, y: s.y, r: s.r || 100, label: s.label, marker: s.marker, hidden: s.hidden, col: s.col, lure: s.lure }; this.zones.set(s.id, z); return z; }
        case 'convoy': return this.spawnConvoy(s);
        case 'boss': return AS.Bosses.spawn(this, s);
        case 'scatter': return this.scatter(s);
        case 'marker': this.addMarker(s); return;
      }
    }
    spawnUnit(kind, x, y, o) {
      const def = AS.Data.enemies[kind];
      if (!def) { console.warn('Unknown unit', kind); return null; }
      const u = new AS.Unit(this, kind, def, x, y, o || {});
      this.units.push(u);
      if (u.id) this.byId.set(u.id, u);
      if (u.team === 'player') this.friendlies.push(u);
      return u;
    }
    spawnStructure(kind, x, y, o) {
      const def = AS.Data.structures[kind];
      if (!def) { console.warn('Unknown structure', kind); return null; }
      const s = new AS.Structure(this, kind, def, x, y, o || {});
      this.structures.push(s);
      if (s.id) this.byId.set(s.id, s);
      if (s.solid) this.solids.push(s);
      if (s.role === 'pad') this.pads.push(s);
      if (s.team === 'player' && !s.invuln) this.friendlies.push(s);
      return s;
    }
    spawnPickup(kind, x, y, o) {
      const p = new AS.Pickup(this, kind, x, y, o || {});
      if (o && o.dropped) { const a = Math.random() * TAU; p.vx = Math.cos(a) * 60; p.vy = Math.sin(a) * 60; }
      this.pickups.push(p);
      if (p.id) this.byId.set(p.id, p);
      return p;
    }
    spawnProp(kind, x, y, o) {
      if (!this.terrain.groundPassable(x, y, false)) return null;
      const p = new AS.Prop(this, kind, x, y, o || {});
      this.props.push(p);
      return p;
    }
    spawnConvoy(s) {
      const list = [];
      const path = s.path;
      const a0 = Math.atan2(path[0][1] - s.y, path[0][0] - s.x);
      s.units.forEach((k, i) => {
        const x = s.x - Math.cos(a0) * i * (s.spacing || 60), y = s.y - Math.sin(a0) * i * (s.spacing || 60);
        const u = this.spawnUnit(k, x, y, { path: path.map((p) => [p[0], p[1]]), team: s.team, angle: a0, active: true, id: s.id + '_' + i });
        if (u) { u.convoy = s.id; u.speedMul = s.speedMul || 1; u.ai = AS.AI.convoy; u.mem = {}; list.push(u); }
      });
      this.convoys[s.id] = list;
      this.convoyState[s.id] = s.start !== false;
      return list;
    }
    convoyUnits(id) { return this.convoys[id] || []; }
    convoySize(id) { return (this.convoys[id] || []).length; }
    convoyGo(u) {
      if (!u.convoy) return true;
      if (!this.convoyState[u.convoy]) return false;
      // keep formation: wait for laggards; friendlies halt when hostiles block the road
      const list = this.convoys[u.convoy];
      const idx = list.indexOf(u);
      if (idx > 0) { const lead = list[idx - 1]; if (lead.alive && U.dist(u.x, u.y, lead.x, lead.y) < 50) return false; }
      if (u.team === 'player') {
        for (const e of this.enemyUnitsNear(u.x, u.y, 150)) if (!e.air && e.alive) { if (!u.mem.blockedSaid) { u.mem.blockedSaid = true; this.say('convoy_blocked'); } return false; }
      }
      return true;
    }
    scatter(s) {
      const rng = new U.RNG((this.map.seed || 1) * 31 + (s.seed || 7) + (s.n || 1) * 13);
      const area = s.area || [120, 120, this.map.w - 120, this.map.h - 120];
      let placed = 0, tries = 0;
      const n = s.n || 10;
      while (placed < n && tries < n * 30) {
        tries++;
        const x = rng.range(area[0], area[2]), y = rng.range(area[1], area[3]);
        const k = this.terrain.kindFast(x, y);
        if (s.what !== 'unit' || !AS.Data.enemies[s.k] || !AS.Data.enemies[s.k].air) {
          if (s.water ? k !== 1 : (k !== 0 && k !== 4 && !(k === 1 && this.world.terrain.water && this.world.terrain.water.frozen) && !(s.what === 'pickup' && (k === 3 || k === 1)))) continue;
        }
        if (U.dist(x, y, this.mission.start.x, this.mission.start.y) < (s.avoidStart || 350)) continue;
        if (U.dist(x, y, this.mission.extraction.x, this.mission.extraction.y) < 200) continue;
        let bad = false;
        for (const st of this.structures) if (U.dist(x, y, st.x, st.y) < st.r + (s.clear || 60)) { bad = true; break; }
        if (!bad && s.what === 'obstacle') for (const o of this.obstacles) if (U.dist(x, y, o.x, o.y) < 90) { bad = true; break; }
        if (bad) continue;
        placed++;
        const kind = s.ks ? rng.pick(s.ks) : s.k;
        if (s.what === 'pickup') this.spawnPickup(kind, x, y, { hidden: s.hidden });
        else if (s.what === 'prop') { const c = s.cluster || 1; for (let i = 0; i < c; i++) this.spawnProp(kind || rng.pick(this.world.props), x + rng.range(-30, 30) * (c > 1), y + rng.range(-24, 24) * (c > 1), {}); }
        else if (s.what === 'obstacle') { const o = new AS.Obstacle(this, kind || this.world.obstacle.kind, x, y, { h: rng.int(s.h ? s.h[0] : 60, s.h ? s.h[1] : 110), r: rng.int(12, 20), seed: rng.int(1, 90) }); this.obstacles.push(o); this.solids.push(o); }
        else if (s.what === 'unit') { const size = s.size ? rng.int(s.size[0], s.size[1]) : 1; this.spawnSpec({ t: 'unit', k: kind, x, y, n: size, spread: s.spread || 50, patrol: s.patrol ? [[x, y], [x + rng.range(-300, 300), y + rng.range(-300, 300)]] : null, burrowed: s.burrowed, hidden: s.hidden }); }
        else if (s.what === 'struct') this.spawnStructure(kind, x, y, {});
      }
    }
    spawnWave(w) {
      // reinforcement-style wave from a point toward a target location
      const list = this.spawnSpec({ t: 'unit', k: w.k, x: w.x, y: w.y, n: w.n || 3, spread: w.spread || 50, group: w.group }) || [];
      for (const u of list) { u.alerted = true; u.alertT = 40; u.alwaysActive = true; u.mem.heard = { x: w.tx !== undefined ? w.tx : this.player.x, y: w.ty !== undefined ? w.ty : this.player.y }; u.state = 'investigate'; if (w.target) u.target = this.byId.get(w.target) || null; }
      if (w.say !== false) this.say(w.say || 'hostiles_inbound');
      return list;
    }
    addMarker(m) { this.markers.push(Object.assign({ kind: 'intel' }, m)); }
    groupById(id) { return this.groups.find((g) => g.id === id); }

    /* ================= queries ================= */
    rebuildGrids() {
      this.gridE.clear(); this.gridU.clear(); this.gridH.clear();
      for (const u of this.units) {
        if (!u.alive) continue;
        if (u.team === 'enemy') {
          this.gridU.insert(u);
          if (u.targetable && !u.dormant) this.gridE.insertAt(u, u.x, u.py);
          this.gridH.insert(u);
        }
      }
      for (const s of this.structures) if (s.alive && s.team === 'enemy' && (s.targetable || s.submerged)) { this.gridE.insertAt(s, s.x, s.py); this.gridH.insert(s); }
      for (const p of this.props) if (p.alive) this.gridE.insertAt(p, p.x, p.py);
    }
    queryEnemies(x, y, r) { return this.gridE.query(x, y, r, []); }
    enemyUnitsNear(x, y, r) { return this.gridU.query(x, y, r, []).filter((u) => U.dist2(u.x, u.y, x, y) < r * r); }
    hostilesNear(x, y, r) { return this.gridH.query(x, y, r, []).filter((u) => u.alive && u.targetable && U.dist2(u.x, u.y, x, y) < r * r); }
    playerTeam() {
      const l = this._pt || (this._pt = []);
      l.length = 0;
      if (this.player && this.player.alive && this.player.dying <= 0) l.push(this.player);
      for (const f of this.friendlies) if (f.alive) l.push(f);
      return l;
    }
    nearestOfKind(x, y, kind, maxD) {
      let best = null, bd = maxD || 1e9;
      for (const u of this.units) if (u.alive && u.kind === kind) { const d = U.dist(x, y, u.x, u.y); if (d < bd) { bd = d; best = u; } }
      return best;
    }
    radarCovers(x, y) {
      for (const s of this.structures) if (s.role === 'radar' && s.alive && s.powered && U.dist(x, y, s.x, s.y) < (s.def.coverage || 1000)) return true;
      return false;
    }
    visibility(e) {
      let v = 1;
      if (this.hazards) v *= this.hazards.visibility();
      return v;
    }
    padAt(x, y) {
      for (const p of this.pads) if (p.alive !== false && U.dist(x, y, p.x, p.y) < p.r) return p;
      return null;
    }
    engagedCount() {
      let n = 0;
      const p = this.player;
      for (const u of this.units) if (u.alive && u.team === 'enemy' && u.target === p && !u.dormant && U.dist(u.x, u.y, p.x, p.y) < 700) n++;
      return n;
    }
    findInteractable(p) {
      let best = null, bd = 1e9;
      const consider = (e, range) => {
        const d = U.dist(p.x, p.y, e.x, e.y);
        if (d < range && d < bd) { bd = d; best = e; }
      };
      // survivors and cargo are lifted with the retrieval beam (src/game/retrieval.js)
      for (const s of this.structures) if ((s.alive || s.role === 'console') && s.canInteract(p)) consider(s, s.interactRange);
      return best;
    }

    /* ================= combat helpers ================= */
    damageArea(x, y, R, dmg, dtype, team, src, opts) {
      opts = opts || {};
      const hitEnemies = team === 'player' || opts.hitsAll;
      const hitPlayers = team === 'enemy' || opts.hitsAll;
      if (hitEnemies) {
        const list = this.gridE.query(x, y - 20, R + 60, []);
        for (const e of list) {
          if (!e.alive || e === opts.exclude) continue;
          const d = U.dist(x, y, e.x, e.y) + Math.max(0, e.z - 12) * 0.6;
          if (d > R + e.r * 0.5) continue;
          const k = 1 - 0.5 * U.clamp(d / R, 0, 1);
          const dealt = e.takeDamage(dmg * k, dtype, src, opts);
          if (team === 'player' && dealt > 0) this.onPlayerHit(e, dealt, null);
          if (opts.push && e.isUnit && !e.def.big && !e.boss) { const a = Math.atan2(e.y - y, e.x - x); e.vx += Math.cos(a) * opts.push; e.vy += Math.sin(a) * opts.push; }
          if (opts.burn && e.organic) e.burn = 3;
        }
        // enemy missiles caught in blasts
        for (const m of AS.Proj.pool.active) if (m.team === 'enemy' && m.type === 'missile' && U.dist(m.x, m.y + 20, x, y) < R) m.life = 0;
      }
      if (hitPlayers) {
        const p = this.player;
        if (p && p.alive && !opts.skipPlayer) {
          const d = U.dist(x, y, p.x, p.y) + p.z * 0.3;
          if (d < R) p.takeDamage(dmg * (1 - 0.5 * d / R), dtype, src, Math.atan2(y - p.y, x - p.x));
        }
        for (const f of this.friendlies) {
          if (!f.alive) continue;
          const d = U.dist(x, y, f.x, f.y);
          if (d < R + f.r * 0.5) f.takeDamage(dmg * (1 - 0.5 * d / R), dtype, src);
        }
        for (const s of this.survivors) if (s.alive && !s.aboard && U.dist(x, y, s.x, s.y) < R * 0.7) s.takeDamage(dmg * 0.6);
      }
    }
    onPlayerHit(e, dealt, proj) {
      if (e.team === 'enemy' && e.isUnit && !e.alerted) e.alert();
    }
    shakeNear(x, y, amt) {
      const p = this.player;
      if (!p) return;
      const d = U.dist(x, y, p.x, p.y);
      if (d < 600) this.camera.shake(amt * (1 - d / 600));
    }
    noise(x, y, r) {
      this.noiseT = (this.noiseT || 0);
      if (this.time - this.noiseT < 0.25) return;
      this.noiseT = this.time;
      for (const u of this.enemyUnitsNear(x, y, r)) if (!u.alerted && !u.target) u.hear(x, y);
    }
    alertAt(x, y, r) { for (const u of this.enemyUnitsNear(x, y, r)) if (!u.alerted) { u.alerted = true; u.alertT = 10; u.mem.heard = { x: this.player.x, y: this.player.y }; u.state = 'investigate'; } }
    onAlert(u) {
      if (!this.alertedOnce) { this.alertedOnce = true; this.emit('alert', u); }
      this.requestReinforcements(u.x, u.y);
    }
    requestReinforcements(x, y) {
      const R = this.reinforce;
      if (!R.enabled || R.sent >= R.max || R.cd > 0 || !R.squads.length) return;
      const commsAlive = R.comms.length === 0 || R.comms.some((id) => { const c = this.byId.get(id); return c && c.alive && c.powered; });
      if (!commsAlive) return;
      R.cd = R.cooldown; R.sent++;
      if (!R.announced) { R.announced = true; this.say(R.comms.length ? 'reinforcements_called' : 'hostiles_inbound'); }
      else this.say('hostiles_inbound');
      this.msg('ENEMY REINFORCEMENTS INBOUND', '#ff8a5a');
      const pl = this.player;
      let from = R.from.length ? R.from.slice().sort((a, b) => U.dist(a.x, a.y, x, y) - U.dist(b.x, b.y, x, y)).find((f) => U.dist(f.x, f.y, pl.x, pl.y) > 500) || R.from[0] : { x: x + 700, y: y - 700 };
      const squad = R.squads[(R.sent - 1) % R.squads.length];
      this.later(R.delay, () => {
        if (this.ended) return;
        for (const k of squad) {
          const u = this.spawnUnit(k, from.x + U.range(-60, 60), from.y + U.range(-60, 60), { active: true });
          if (u) { u.alerted = true; u.alertT = 40; u.mem.heard = { x: pl.x, y: pl.y }; u.state = 'investigate'; u.leash = 5000; }
        }
      });
    }

    /* ================= events ================= */
    emit(name, a, b) {
      if (name === 'pickup' && a.id) this.pickedIds[a.id] = true;
      if (name === 'cargoPicked' && a.id) this.cargoPicked[a.id] = true;
      if (name === 'boarded') this.boardedGroups[a.id] = true;
      this.events.emit(name, a, b);
      if (this.script) this.script.onEvent(name, a, b);
    }
    onUnitKilled(u, src) {
      if (u.team === 'enemy') {
        this.stats.kills++;
        const d = u.def;
        if (Math.random() < (d.drop || 0)) this.spawnPickup(Math.random() < 0.55 ? 'salvage' : U.pick(['fuel', 'ammo', 'missiles', 'fuel', 'repair', 'shield']), u.x, u.y, { dropped: true, life: 45 });
        this.stats.salvage += d.salvage || 0;
        if (d.elite) { this.spawnPickup('tech', u.x, u.y, { dropped: true }); this.spawnPickup('salvage', u.x, u.y, { dropped: true, value: 80 }); }
        if (d.salvage) AS.FX.text(u.x, u.y, u.z + 14, '+' + d.salvage, '#e8c24a');
      } else if (u.convoy) this.emit('convoyLost', u);
      if (u.team === 'player' && u.convoy) this.say('convoy_lost');
      this.emit('killed', u);
    }
    onStructureDestroyed(s, src) {
      if (s.team === 'enemy') { this.stats.structures++; this.stats.salvage += s.def.salvage || 0; }
      const d = s.def;
      if (d.salvage) AS.FX.text(s.x, s.y, s.hc + 16, '+' + d.salvage, '#e8c24a');
      if (Math.random() < (d.drop || 0)) this.spawnPickup(U.pick(['fuel', 'ammo', 'missiles', 'salvage', 'repair']), s.x, s.y, { dropped: true, life: 50 });
      switch (s.role) {
        case 'comms': {
          const R = this.reinforce;
          if (R.comms.includes(s.id) && !R.comms.some((id) => { const c = this.byId.get(id); return c && c.alive; })) { R.enabled = false; this.say('comms_down'); this.msg('ENEMY REINFORCEMENTS CUT OFF', '#7dff9a'); }
          break;
        }
        case 'radar': if (!this.radarCovers(this.player.x, this.player.y)) { this.say('radar_down'); this.msg('RADAR DOWN — MISSILE BATTERIES BLINDED', '#7dff9a'); } break;
        case 'power': {
          const dependents = this.structures.filter((o) => o.poweredBy.includes(s.id));
          if (dependents.length && dependents.some((o) => !o.poweredBy.some((id) => { const q = this.byId.get(id); return q && q.alive; }))) { this.say('power_down'); this.msg('POWER LOST — LINKED DEFENCES OFFLINE', '#7dff9a'); }
          break;
        }
        case 'shieldgen': if (this.structures.some((o) => o.shieldedBy.includes(s.id))) { this.say('shield_gen_down'); this.msg('SHIELD GENERATOR DOWN — TARGETS EXPOSED', '#7dff9a'); } break;
        case 'depot': for (let i = 0; i < 4; i++) this.spawnPickup(d.gives === 'ammo' ? (i % 2 ? 'missiles' : 'ammo') : 'fuel', s.x, s.y, { dropped: true }); break;
        case 'pen': case 'iceblock': {
          const gr = this.groups.find((q) => q.caged === s.id);
          if (gr) { gr.caged = null; this.msg(s.role === 'pen' ? 'PRISONERS FREED' : 'RESEARCHERS FREED', '#7fe8ff'); this.say('survivors_located'); }
          break;
        }
      }
      this.emit('destroyed', s);
    }
    onSurvivorLost(p) { this.stats.lost++; this.emit('survivorLost', p); if (Math.random() < 0.5) this.say('survivor_lost'); }
    onPrimariesDone() {
      if (this.extraction.active) return;
      this.extraction.active = true;
      this.say('extraction_available');
      this.msg('ALL PRIMARY OBJECTIVES COMPLETE — PROCEED TO EXTRACTION', '#7dff9a', 5);
      AS.Audio.sfx('objective_new');
    }

    dropOff(p, pad, dt) {
      this.dropT = (this.dropT || 0) - dt;
      if (this.dropT > 0) return;
      if (p.passengers.length) {
        const pas = p.passengers.shift();
        this.dropT = 0.35;
        this.stats.delivered++; this.stats.rescued++;
        p.heal(p.s.hullMax * 0.03);
        this.stats.bonusSalvage += 15;
        AS.Audio.sfx('dropoff');
        AS.FX.text(pad.x, pad.y, 30, 'SURVIVOR DELIVERED', '#7fe8ff');
        // a little figure walking to the dropship
        this.walkers = this.walkers || [];
        this.walkers.push({ x: p.x, y: p.y, tx: pad.x + 20, ty: pad.y - 6, t: 0, type: pas.type });
        this.emit('delivered', { kind: 'person', group: pas.group });
        if (!p.passengers.length) this.say('survivors_delivered');
        return;
      }
      if (p.cargo.length) {
        const idx = p.cargo.findIndex((c) => c.deliver === 'pad' || (pad.pad && pad.pad.lz));
        if (idx < 0) return;
        const c = p.cargo.splice(idx, 1)[0];
        this.dropT = 0.5;
        c.delivered = true; c.aboard = false; c.x = pad.x; c.y = pad.y;
        this.stats.cargo++;
        AS.Audio.sfx('dropoff');
        this.msg(c.label + ' DELIVERED', '#9ff6ff');
        this.emit('delivered', { kind: 'cargo', id: c.id }, 'pad');
      }
    }
    deliverToZones(p, dt) {
      if (!p.cargo.length) return;
      for (const c of p.cargo) {
        if (c.deliver === 'pad') continue;
        const z = this.zones.get(c.deliver) || this.byId.get(c.deliver);
        if (z && U.dist(p.x, p.y, z.x, z.y) < (z.r || 40) + 10 && p.speed < 120) {
          p.cargo.splice(p.cargo.indexOf(c), 1);
          c.delivered = true; c.x = z.x; c.y = z.y;
          AS.Audio.sfx('dropoff');
          this.msg(c.label + ' PLACED', '#9ff6ff');
          this.emit('delivered', { kind: 'cargo', id: c.id }, c.deliver);
          if (z.lure) this.later(3, () => { const b = this.byId.get(z.lure); if (b && b.alive) { b.bossAct('activate'); b.bossAct('lure', { x: z.x, y: z.y }); AS.FX.explosion(z.x, z.y, 2, 34); this.camera.shake(0.7); AS.Audio.sfx('explode_big', { x: z.x, y: z.y }); } });
          if (c.respawn) { const n = (c.respawnN || 0) + 1; this.later(c.respawn, () => { const nc = this.spawnSpec({ t: 'cargo', k: c.type, id: c.baseId + '_r' + n, x: c.ox, y: c.oy, deliver: c.deliver, label: c.label, respawn: c.respawn }); if (nc) { nc.respawnN = n; nc.baseId = c.baseId; } this.msg('NEW ' + c.label + ' READY AT THE DEPOT', '#9ff6ff'); }); }
          break;
        }
      }
    }

    say(id) { AS.Voice && AS.Voice.say(id, this); }
    msg(text, col, dur) {
      if (this.msgs.length && this.msgs[this.msgs.length - 1].text === text) { this.msgs[this.msgs.length - 1].t = dur || 3; return; }
      this.msgs.push({ text, col: col || '#7fe8ff', t: dur || 3, max: dur || 3 });
      if (this.msgs.length > 4) this.msgs.shift();
    }
    later(t, fn) { this.laterQ.push({ t, fn }); }
    revealArea(x, y, r) {
      const c = this.fogCell;
      for (let cy = Math.floor((y - r) / c); cy <= Math.floor((y + r) / c); cy++) for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) {
        if (cx < 0 || cy < 0 || cx >= this.fogW || cy >= this.fogH) continue;
        if (U.dist(cx * c + c / 2, cy * c + c / 2, x, y) < r) this.explored[cy * this.fogW + cx] = 1;
      }
    }
    isExplored(x, y) {
      const cx = Math.floor(x / this.fogCell), cy = Math.floor(y / this.fogCell);
      if (cx < 0 || cy < 0 || cx >= this.fogW || cy >= this.fogH) return false;
      return this.explored[cy * this.fogW + cx] === 1;
    }
    customCall(name, a) { if (AS.Bosses && AS.Bosses.calls && AS.Bosses.calls[name]) AS.Bosses.calls[name](this, a); }

    fail(reason, delay) {
      if (this.state !== 'play') return;
      this.state = 'failing'; this.failReason = reason; this.endT = delay || 2.5;
      this.msg('MISSION FAILED', '#ff4a3a', 5);
      AS.Music && AS.Music.stinger('fail');
    }

    /* ================= update ================= */
    update(dt) {
      if (this.ended) return;
      this.time += dt;
      const p = this.player;
      this.lockWarn = Math.max(0, this.lockWarn - dt); this.missileWarn = Math.max(0, this.missileWarn - dt);
      this.rebuildGrids();
      p.update(dt);
      // activation by distance
      for (let i = this.units.length - 1; i >= 0; i--) {
        const u = this.units[i];
        if (u.removed) { this.units.splice(i, 1); const fi = this.friendlies.indexOf(u); if (fi >= 0) this.friendlies.splice(fi, 1); continue; }
        const d = Math.abs(u.x - p.x) + Math.abs(u.y - p.y);
        u.dormant = !(u.alwaysActive || u.alerted || d < 1500 || u.team === 'player' || u.boss);
        if (!u.dormant) u.update(dt);
      }
      for (const s of this.structures) {
        const d = Math.abs(s.x - p.x) + Math.abs(s.y - p.y);
        if (d < 1600 || !s.alive) s.update(dt);
        if (!s.seen && d < p.s.scanRange * 0.8) s.seen = true;
      }
      for (let i = this.props.length - 1; i >= 0; i--) if (this.props[i].removed) this.props.splice(i, 1);
      for (let i = this.pickups.length - 1; i >= 0; i--) { const q = this.pickups[i]; if (!q.alive) { this.pickups.splice(i, 1); continue; } if (Math.abs(q.x - p.x) < 900 && Math.abs(q.y - p.y) < 700) q.update(dt); }
      for (const g of this.groups) g.update(dt);
      for (const c of this.cargo) c.update(dt);
      if (this.walkers) for (let i = this.walkers.length - 1; i >= 0; i--) { const w = this.walkers[i]; w.t += dt; const a = Math.atan2(w.ty - w.y, w.tx - w.x); w.x += Math.cos(a) * 40 * dt; w.y += Math.sin(a) * 40 * dt; if (U.dist(w.x, w.y, w.tx, w.ty) < 4 || w.t > 4) this.walkers.splice(i, 1); }
      AS.Proj.update(this, dt);
      AS.Particles.update(dt);
      if (this.hazards) this.hazards.update(dt);
      if (this.bossList) for (const b of this.bossList) b.bossUpdate && b.bossUpdate(dt);
      this.script.update(dt);
      this.deliverToZones(p, dt);
      if (this.reinforce.cd > 0) this.reinforce.cd -= dt;
      for (let i = this.laterQ.length - 1; i >= 0; i--) { const l = this.laterQ[i]; l.t -= dt; if (l.t <= 0) { this.laterQ.splice(i, 1); l.fn(); } }
      // extraction
      this.updateExtraction(dt);
      // camera
      this.camera.update(dt, p.x, p.y - p.z, p.vx, p.vy);
      // exploration
      this.exploreT = (this.exploreT || 0) - dt;
      if (this.exploreT <= 0) { this.exploreT = 0.25; this.revealArea(p.x, p.y, p.s.scanRange * 0.6 * (this.hazards ? this.hazards.scanMul() : 1)); }
      for (let i = this.msgs.length - 1; i >= 0; i--) { this.msgs[i].t -= dt; if (this.msgs[i].t <= 0) this.msgs.splice(i, 1); }
      this.updateMusic(dt);
      // end of mission
      if (this.state === 'failing' || this.state === 'extracting') {
        this.endT -= dt;
        if (this.endT <= 0) this.finish(this.state === 'extracting');
      }
    }

    updateExtraction(dt) {
      const e = this.extraction, p = this.player;
      e.t += dt;
      if (!e.active || this.state !== 'play') return;
      if (!e.hotWarned) {
        const hostiles = this.enemyUnitsNear(e.x, e.y, 450).filter((u) => u.alive && !u.burrowed).length;
        if (hostiles > 0 && U.dist(p.x, p.y, e.x, e.y) < 900) { e.hotWarned = true; this.say('extraction_hot'); }
      }
      if (U.dist(p.x, p.y, e.x, e.y) < e.r && p.speed < 130 && p.alive && p.dying <= 0) {
        e.hold = (e.hold || 0) + dt;
        if (p.passengers.length || p.cargo.some((c) => c.deliver === 'pad')) e.hold = Math.min(e.hold, 0.5);
        if (e.hold >= 3) {
          this.state = 'extracting'; this.endT = 2.6;
          this.say('mission_success');
          AS.Music && AS.Music.stinger('victory');
          this.camera.pulseZoom(0.08, 2.6);
          this.msg('EXTRACTION COMPLETE', '#7dff9a', 4);
        }
      } else e.hold = 0;
    }

    updateMusic(dt) {
      if (!AS.Music) return;
      if (this.state !== 'play') return;
      let level = 0;
      const n = this.engagedCount();
      if (n >= 1) level = 1;
      if (n >= 5) level = 2;
      if (this.bossActive) level = 3;
      if (this.musicOverride === 'boss') level = 3;
      else if (this.musicOverride === 'combat') level = Math.max(level, 2);
      AS.Music.setIntensity(level);
    }

    finish(success) {
      if (this.ended) return;
      this.ended = true;
      const p = this.player;
      const res = {
        success, reason: this.failReason || '',
        mission: this.mission, time: this.time,
        objectives: this.script.objs.map((o) => ({ id: o.id, text: o.short || o.text, cat: o.cat, state: o.state, revealed: o.revealed })),
        stats: Object.assign({}, this.stats),
        fuelPct: p.fuel / p.s.fuelMax, hullPct: p.hull / p.s.hullMax, damage: p.dmgTaken,
        kitsLeft: p.kits,
      };
      if (this.onEnd) this.onEnd(res);
    }

    /* ================= rendering hooks ================= */
    collectDrawables(list, x0, y0, x1, y1) {
      const inV = (o, m) => o.x > x0 - (m || 0) && o.x < x1 + (m || 0) && o.y > y0 - (m || 0) && o.y < y1 + (m || 0) + 120;
      const p = this.player;
      if (p && (p.alive || p.dying > 0)) list.push(p);
      for (const u of this.units) if (u.alive && inV(u, 40)) list.push(u);
      for (const s of this.structures) if (inV(s, 80) && !s.def.flat) list.push(s);
      for (const q of this.props) if (q.alive && inV(q)) list.push(q);
      for (const q of this.pickups) if (q.alive && inV(q)) list.push(q);
      for (const o of this.obstacles) if (inV(o, 40)) list.push(o);
      for (const l of this.landmarks) if (inV(l, Math.max(l.sheet.w * 0.5, l.sheet.ay))) list.push(l);
      for (const s of this.sites) if (inV(s, s.r)) s.tick(AS.Renderer);
      for (const c of this.cargo) if (!c.aboard && !c.delivered && inV(c)) list.push(c);
      for (const g of this.groups) g.collectDraw(list, x0, y0, x1, y1 + 60);
      if (this.bossList) for (const b of this.bossList) if (b.extraDrawables) b.extraDrawables(list);
    }
    drawGround(ctx, ox, oy, R) {
      // flat structures (pads, vents, platforms) under everything
      for (const s of this.structures) if (s.def.flat) s.draw(ctx, ox, oy, R);
      const e = this.extraction;
      // landing zone markings + dropship
      const ex = Math.round(e.x - ox), ey = Math.round(e.y - oy);
      ctx.save();
      ctx.globalAlpha = e.active ? 0.7 + Math.sin(e.t * 4) * 0.3 : 0.35;
      ctx.strokeStyle = e.active ? '#7dff9a' : '#7fe8ff'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.ellipse(ex, ey, e.r, e.r * 0.75, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      if (e.active && e.hold > 0) { ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(ex, ey, e.r, e.r * 0.75, 0, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, e.hold / 3)); ctx.stroke(); }
      ctx.restore();
      // zones with markers
      for (const [id, z] of this.zones) {
        if (!z.marker) continue;
        ctx.globalAlpha = 0.3 + Math.sin(this.time * 3) * 0.1; ctx.strokeStyle = z.col || '#ffd36b'; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.ellipse(z.x - ox, z.y - oy, z.r, z.r * 0.75, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      AS.Fields.drawGround(ctx, ox, oy, this);
      // dropship parked at the LZ
      const ds = this.dropship;
      const lift = this.state === 'extracting' ? (2.6 - this.endT) * 30 : 0;
      // parked beside the pad (the redesigned carrier is larger, so it sits further out)
      const dsx = this.dsOff ? this.dsOff[0] : 50, dsy = this.dsOff ? this.dsOff[1] : -34;
      ctx.globalAlpha = 0.3; ctx.drawImage(ds.shadows[0], ex + dsx - ds.ax + 4, ey + dsy - ds.ay + 2, ds.w, ds.h); ctx.globalAlpha = 1;
      // the redesigned dropship stands on its struts; the old gunship model hovered
      ctx.drawImage(ds.frames[0][0], ex + dsx - ds.ax, ey + dsy - (this.dropshipGrounded ? 0 : 16) - lift - ds.ay, ds.w, ds.h);
      R.light(e.x + dsx, e.y + dsy - 16 - lift, 30, e.active ? '#7dff9a' : '#7fe8ff', 0.35 + Math.sin(e.t * 5) * 0.15);
      if (this.walkers) for (const w of this.walkers) { ctx.fillStyle = '#e8742a'; ctx.fillRect(Math.round(w.x - ox) - 1, Math.round(w.y - oy) - 7, 3, 5); ctx.fillStyle = '#e8c8a8'; ctx.fillRect(Math.round(w.x - ox) - 1, Math.round(w.y - oy) - 9, 3, 2); }
    }
    drawProjectiles(ctx, ox, oy, R) {
      AS.Proj.draw(ctx, ox, oy, this);
      const p = this.player;
      if (p && p.beamOn && p.beam) {
        const b = p.beam, col = p.s.primary.col;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const w = 3 + Math.sin(this.time * 40) * 1;
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = w + 3;
        ctx.beginPath(); ctx.moveTo(b.x1 - ox, b.y1 - oy); ctx.lineTo(b.x2 - ox, b.y2 - oy); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(b.x1 - ox, b.y1 - oy); ctx.lineTo(b.x2 - ox, b.y2 - oy); ctx.stroke();
        ctx.restore();
      }
    }
    drawOverlay(ctx, ox, oy, R) {
      AS.Fields.drawOverlay(ctx, ox, oy, this);
      if (this.extraction.active) {
        const e = this.extraction;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const k = ((e.t * 0.6 + i / 3) % 1);
          ctx.globalAlpha = (1 - k) * 0.6; ctx.strokeStyle = '#7dff9a';
          ctx.beginPath(); ctx.ellipse(e.x - ox, e.y - oy - k * 60, e.r * (1 - k * 0.5), e.r * 0.75 * (1 - k * 0.5), 0, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
      if (this.hazards) this.hazards.drawOverlay(ctx, ox, oy);
    }
  }
  AS.Game = Game;
})(window.AS);
