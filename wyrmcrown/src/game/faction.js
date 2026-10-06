/* WYRMCROWN — a faction: one of the four dragon realms.
 * Symmetric for player and AI: a treasury, a town that grows with what is
 * bought, garrisons and warbands, herds, the dragon rider and the ward that
 * protects the stronghold. A human or an AI lord makes the decisions; this
 * class carries them out (buy, recruit, upgrade) and runs the economy.
 *
 * The town plan is generated around the stronghold: an inner ring of major
 * buildings, rings of houses that fill in as the town prospers, a wall ring
 * with a gatehouse facing the main road, tower and siege-engine slots on and
 * behind the walls, farmsteads with pastures outside, three wardstones and two
 * outlying watchtower sites. Bought buildings rise from scaffolding into their
 * slots, so the town visibly grows and fortifies over the match.
 *
 * Victory: a stronghold's ward barrier is fed by its wardstones and its dragon.
 * Each standing wardstone and a flying dragon turn harm aside; with them gone
 * the keep can be broken, and when it falls the realm is eliminated. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const LIVESTOCK = { human: ['cow', 'sheep'], elf: ['sheep', 'goat'], ice: ['goat', 'sheep'], undead: ['boar', 'cow'] };
  const WARD_MUL = [1, 0.5, 0.26, 0.13, 0.08];

  class Faction {
    constructor(g, key, mdef) {
      this.g = g; this.key = key; this.def = AS.Data.factions[key]; this.mdef = mdef;
      this.ai = key !== (g.opts.faction || 'human') || !!g.opts.demo;
      this.gold = g.opts.gold || 260;
      this.upgrades = {};
      this.buildings = []; this.troops = []; this.carts = [];
      this.counts = {}; this.keepLevel = 1;
      this.townPos = { x: mdef.town.x, y: mdef.town.y };
      this.gateA = mdef.gate || 0;
      this.income = 0; this.incomeAcc = 0; this.incomeLog = [];
      this.eliminated = false; this.prosperT = 30; this.breedT = 20; this.attackedT = -99; this.lastAttacker = null;
      this.sitesOwned = 0;
      this.herds = {};
      this.plan();
    }

    /* ================= the town plan ================= */
    plan() {
      const c = this.townPos, ga = this.gateA;
      const P = this.slots = { inner: [], house: [], tower: [], engine: [], farm: [], ward: [], watch: [], wall: [] };
      const at = (a, r) => ({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.86, a, used: null });
      const near = (a, b, w) => Math.abs(U.wrapAngle(a - b)) < w;
      const roostA = ga + Math.PI;
      this.roost = at(roostA, 132); this.roost.y += 8;
      for (let i = 0; i < 8; i++) { const a = ga + Math.PI / 8 + i * Math.PI / 4; if (near(a, roostA, 0.45) || near(a, ga, 0.3)) continue; P.inner.push(at(a, 182)); }
      for (let i = 0; i < 6; i++) { const a = ga + Math.PI / 6 + i * Math.PI / 3; P.tower.push(at(a, 392)); }
      for (let i = 0; i < 6; i++) { const a = ga + i * Math.PI / 3 + (i === 0 ? 0.35 : 0); P.engine.push(at(a, 352)); }
      // houses stand in four quarters between the lanes (the gate road, the
      // roost lane and the two cross lanes), packed in three rows along the
      // arcs so that even a small town reads as streets of houses
      this.lanes = [ga, ga + Math.PI / 2, ga + Math.PI, ga - Math.PI / 2];
      for (const [r, gap] of [[232, 0.2], [270, 0.17], [308, 0.15]]) {
        for (let q = 0; q < 4; q++) {
          const a0 = this.lanes[q] + gap, a1 = this.lanes[q] + Math.PI / 2 - gap;
          const n = Math.max(1, Math.floor((a1 - a0) * r / 40));
          for (let i = 0; i <= n; i++) {
            const a = a0 + (a1 - a0) * i / n, s = at(a, r + ((i * 7) % 3 - 1) * 3);
            if (P.engine.some((e) => Math.hypot(e.x - s.x, e.y - s.y) < 44)) continue;
            s.gateD = Math.abs(U.wrapAngle(a - ga));
            P.house.push(s);
          }
        }
      }
      for (const a of [ga + 0.95, ga - 0.95, ga + 2.25, ga - 2.25]) P.farm.push(at(a, 610));
      for (const a of [ga + Math.PI * 0.62, ga + Math.PI, ga - Math.PI * 0.62]) P.ward.push(at(a, 488));
      for (const a of [ga + 0.42, ga - 0.42]) P.watch.push(at(a, 830));
      // wall ring: segments 40 long around r = 392, with the gatehouse facing the road
      const R = 392, n = Math.round(TAU * R / 40);
      for (let i = 0; i < n; i++) {
        const a = ga + i / n * TAU;
        const p = at(a, R);
        p.angle = Math.atan2(Math.cos(a) * 0.86, -Math.sin(a)); // tangent of the squashed ring
        p.gate = i === 0;
        P.wall.push(p);
      }
      this.pasture = { x: P.farm[0].x, y: P.farm[0].y, r: 150 };
    }

    buildTown() {
      const g = this.g, c = this.townPos;
      this.keep = this.place('keep', { x: c.x, y: c.y }, { instant: true });
      this.roostB = this.place('roost', this.roost, { instant: true });
      for (let i = 0; i < 12; i++) this.addHouse(true);
      this.buy('farm', { free: true, instant: true });
      this.buy('barracks', { free: true, instant: true });
      this.buy('tower', { free: true, instant: true });
      for (let i = 0; i < 3; i++) this.buy('wardstone', { free: true, instant: true });
      // the town square
      g.terrain.addDecal('lanes', c.x, c.y, 400, null, { static: true, fk: this.key, lanes: this.lanes, seed: c.y | 0 });
      g.terrain.addDecal('plaza', c.x, c.y + 6, 150, null, { static: true, fk: this.key, seed: c.x | 0 });
      // townsfolk going about their business
      const fields = this.fieldList || [];
      AS.Life.addPeople(g, this.key, c.x, c.y, 330, 16, { pal: this.def.pal, spots: this.slots.house.concat(this.slots.inner), fields });
      AS.Life.addPeople(g, this.key, this.slots.farm[0].x, this.slots.farm[0].y, 220, 6, { pal: this.def.pal, fields });
      // the opening garrison
      this.recruit('soldier', 4, true); this.recruit('archer', 2, true);
    }
    place(kind, slot, o) {
      const B = new AS.Building(this.g, kind, this.key, slot.x, slot.y, Object.assign({ slot, angle: slot.angle || 0, v: o && o.v !== undefined ? o.v : (Math.random() * 4) | 0, aim: slot.a || 0 }, o));
      slot.used = B;
      if (kind !== 'wall' && kind !== 'gate') this.g.terrain.clearAreas.push({ x: slot.x, y: slot.y, r: B.r * 1.25 + 6 });
      this.g.buildings.push(B);
      this.buildings.push(B);
      this.counts[kind] = (this.counts[kind] || 0) + 1;
      if (kind === 'farm') this.onFarm(B);
      return B;
    }
    addHouse(instant) {
      const free = this.slots.house.filter((s) => !s.used || !s.used.alive);
      if (!free.length) return null;
      const c = this.townPos;
      // houses line the road in from the gate first, then wrap round the town
      const score = (s) => Math.hypot(s.x - c.x, s.y - c.y) + s.gateD * 70 - (this.slots.house.some((o) => o !== s && o.used && o.used.alive && Math.hypot(o.x - s.x, o.y - s.y) < 50) ? 25 : 0) + Math.random() * 15;
      let s = null, best = Infinity;
      for (const f of free) { const v = score(f); if (v < best) { best = v; s = f; } }
      if (s.used && !s.used.alive) this.counts.house--;
      return this.place('house', s, { instant, buildTime: 6 });
    }
    onFarm(B) {
      // fields around the farmstead and a pasture with the first animals
      const g = this.g, rng = new U.RNG((B.x * 13 + B.y) | 0);
      this.fieldList = this.fieldList || [];
      const ang0 = Math.atan2(B.y - this.townPos.y, B.x - this.townPos.x);
      for (let i = 0; i < 6; i++) {
        const a = ang0 + (i - 2.5) * 0.36 + rng.range(-0.08, 0.08), r = 90 + (i % 2) * 70 + rng.range(-10, 20);
        const fx = B.x + Math.cos(a) * r, fy = B.y + Math.sin(a) * r * 0.86;
        if (g.terrain.kindFast(fx, fy) !== 0 || g.terrain.roadDist(fx, fy) < 40) continue;
        const f = { x: fx, y: fy, w: 70 + rng.range(-10, 30), h: 44 + rng.range(-6, 14), rot: a + Math.PI / 2 + rng.range(-0.25, 0.25), crop: this.key === 'undead' ? 'bone' : this.key === 'ice' ? 'frost' : ['wheat', 'barley', 'green', 'plough', 'flax'][(rng.next() * 5) | 0] };
        this.fieldList.push(f);
        g.terrain.addDecal('field', fx, fy, Math.max(f.w, f.h) * 0.6, null, { static: true, fw: f.w, fh: f.h, rot: f.rot, crop: f.crop, seed: (fx + fy * 7) | 0 });
      }
      const pa = ang0 + Math.PI * 0.5;
      const px = B.x + Math.cos(pa) * 110, py = B.y + Math.sin(pa) * 95;
      g.terrain.addDecal('pasture', px, py, 90, null, { static: true, seed: (px | 0), fk: this.key });
      const kinds = LIVESTOCK[this.key];
      const herd = AS.Life.herd(g, kinds[this.counts.farm % 2], px, py, B.built >= 1 || !this.g.time ? 4 : 2, this.key, 85);
      herd.farm = B;
      this.herds[herd.k] = herd;
      this.pastures = this.pastures || [];
      this.pastures.push(herd);
      this.pasture = { x: px, y: py, r: 110 };
    }
    herdFor(kind) { return this.herds[kind] || (this.pastures && this.pastures[0]) || { x: this.pasture.x, y: this.pasture.y, r: 100, owner: this.key, k: kind }; }
    pastureAt(x, y) {
      if (Math.hypot(x - this.townPos.x, y - this.townPos.y) < 420) return true;
      if (this.pastures) for (const h of this.pastures) if (Math.hypot(x - h.x, y - h.y) < h.r + 60) return true;
      return false;
    }
    livestockCap() { return (this.counts.farm || 0) * 6 + (this.counts.stable ? 3 : 0); }
    livestock() { return AS.Life.livestockOf(this.g, this.key); }

    /* ================= buying ================= */
    // what an item costs right now (null = not available)
    price(id) {
      const B = AS.Data.buildings[id], A = AS.Data.actions[id], Up = AS.Data.upgrades[id];
      if (Up) { const lv = this.upgrades[id] || 0; return lv >= Up.cost.length ? null : Up.cost[lv]; }
      if (A) { if (A.levels) { const lv = this.keepLevel - 1; return lv >= A.levels ? null : A.cost[lv]; } return A.cost; }
      if (B) {
        if (B.levels) { const lv = this.wallLevel || 0; return lv >= B.levels ? null : B.cost[lv]; }
        return B.cost;
      }
      return null;
    }
    // why an item can't be bought (or '' if it can)
    blocker(id) {
      const B = AS.Data.buildings[id], A = AS.Data.actions[id];
      const def = B || A || AS.Data.upgrades[id];
      if (!def) return 'Unknown';
      const cost = this.price(id);
      if (cost === null) return 'Fully upgraded';
      for (const r of def.req || []) if (!this.has(r)) return 'Needs ' + AS.Data.buildings[r].name;
      if (B && B.max && this.alive(id) >= B.max + (id === 'tower' || id === 'ballista' ? (this.keepLevel - 1) : 0)) return 'Town is at its limit';
      if (B && B.slot && !B.levels && !this.freeSlot(B.slot)) return 'No room left';
      if (A && A.unit) { if (this.troopCount() + A.n > this.troopCap()) return 'Barracks full (' + this.troopCap() + ' troops)'; }
      if (id === 'buyLivestock' && this.livestock() + 4 > this.livestockCap()) return 'Pastures full';
      if (id === 'keepUp' && this.keepLevel >= 3) return 'Fully upgraded';
      if (cost > this.gold) return 'Not enough gold';
      return '';
    }
    has(kind) { return this.buildings.some((b) => b.kind === kind && b.alive && b.built >= 1); }
    alive(kind) { let n = 0; for (const b of this.buildings) if (b.kind === kind && b.alive) n++; return n; }
    freeSlot(type) { return (this.slots[type] || []).find((s) => !s.used || !s.used.alive) || null; }
    buy(id, o) {
      o = o || {};
      const g = this.g;
      if (!o.free) {
        const why = this.blocker(id);
        if (why) return why;
        const cost = this.price(id);
        this.gold -= cost; g.stats.goldSpent += this.key === g.playerKey ? cost : 0;
      }
      const B = AS.Data.buildings[id], A = AS.Data.actions[id], Up = AS.Data.upgrades[id];
      if (Up) {
        this.upgrades[id] = (this.upgrades[id] || 0) + 1;
        if (this.dragon) { const hpF = this.dragon.hp / this.dragon.maxHp; this.dragon.recompute(); this.dragon.hp = this.dragon.maxHp * hpF; }
      } else if (id === 'keepUp') {
        this.keepLevel++;
        this.keep.setLevel(this.keepLevel);
        this.keep.built = 0.4; this.keep.buildT = 6;
        for (let i = 0; i < 3; i++) this.addHouse(false);
      } else if (id === 'wall') {
        this.wallLevel = (this.wallLevel || 0) + 1;
        this.buildWalls(o.instant);
      } else if (A && A.unit) {
        this.recruit(A.unit, A.n);
      } else if (id === 'buyLivestock') {
        const h = this.pastures && this.pastures[0];
        if (h) { const added = AS.Life.herd(g, LIVESTOCK[this.key][0], h.x, h.y, 4, this.key, h.r); added.x = h.x; }
      } else if (B) {
        const slot = this.freeSlot(B.slot);
        if (!slot) return 'No room left';
        this.place(id, slot, { instant: o.instant, buildTime: id === 'wardstone' ? 8 : 5 });
      }
      if (!o.free) {
        if (this.key === g.playerKey) AS.Audio.sfx('buy');
        const name = (B || A || Up).name;
        if (!o.silent && (this.key !== g.playerKey) && (B || id === 'keepUp')) g.news(this.def.short + ' builds ' + (id === 'keepUp' ? 'a greater stronghold' : name.toLowerCase()), this.key);
        if (this.onBought) this.onBought(id);
      }
      return '';
    }
    buildWalls(instant) {
      const lv = this.wallLevel;
      for (const s of this.slots.wall) {
        if (s.used && s.used.alive) { s.used.setLevel(lv); s.used.built = Math.min(s.used.built, 0.5); s.used.buildT = 5; continue; }
        // leave the road through the gate open
        this.place(s.gate ? 'gate' : 'wall', s, { instant, level: lv, buildTime: 4 + Math.random() * 3, angle: s.angle });
      }
    }
    recruit(role, n, instant) {
      const g = this.g, t = this.def.troops[role] || this.def.troops.soldier;
      const from = this.buildings.find((b) => b.kind === 'barracks' && b.alive) || this.keep;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const u = new AS.Troop(g, role, this.key, from.x + Math.cos(a) * 30, from.y + Math.sin(a) * 24, { gen: t.gen });
        u.home = { x: this.townPos.x, y: this.townPos.y, r: 300 };
        g.troops.push(u); this.troops.push(u);
      }
    }
    troopCount() { let n = 0; for (const t of this.troops) if (t.alive && t.role !== 'cart') n++; return n; }
    troopCap() { return 6 + (this.has('barracks') ? 8 : 0) + (this.keepLevel - 1) * 4 + this.siteTroopCap(); }
    siteTroopCap() { let n = 0; for (const s of this.g.sites) if (s.owner === this.key && s.def.troopCap) n += s.def.troopCap; return n; }

    /* ================= economy ================= */
    addGold(v, x, y, why) {
      const g = this.g;
      v *= this.has('market') ? 1.2 : 1;
      v *= this.ai ? g.diff.aiIncome || 1 : g.diff.income || 1;
      this.gold += v;
      this.incomeAcc += v;
      if (this.key === g.playerKey) {
        g.stats.goldEarned += v;
        if (x !== undefined && v >= 2) { AS.FX.text(x, y, 30, '+' + Math.round(v) + ' GOLD', '#ffd24a'); AS.Audio.sfx(v >= 60 ? 'gold_big' : 'coin', { x, y, vol: 0.8 }); }
      }
    }
    update(dt) {
      if (this.eliminated) return;
      const g = this.g;
      // taxes from houses and market sales of livestock (a steady trickle; real wealth comes from the land)
      this.taxT = (this.taxT || 0) - dt;
      if (this.taxT <= 0) {
        this.taxT = 5;
        const houses = this.alive('house');
        const stock = this.livestock();
        this.addGold(houses * 0.34 + stock * 0.22 * (this.has('market') ? 2 : 1));
      }
      // income rate over the last minute (per-second buckets, for the HUD)
      this.rateT = (this.rateT || 0) - dt;
      if (this.rateT <= 0) {
        this.rateT = 1;
        this.incomeLog.push(this.incomeAcc); this.incomeAcc = 0;
        if (this.incomeLog.length > 60) this.incomeLog.shift();
        let s = 0; for (const v of this.incomeLog) s += v;
        this.income = s * 60 / Math.max(20, this.incomeLog.length);
      }
      // prosperity: the town grows new houses while it is safe
      this.prosperT -= dt;
      if (this.prosperT <= 0) {
        this.prosperT = 35;
        const cap = 14 + (this.keepLevel - 1) * 8 + Math.min(6, this.sitesOwned);
        if (this.alive('house') < cap && g.time - this.attackedT > 30) this.addHouse(false);
      }
      // breeding
      this.breedT -= dt;
      if (this.breedT <= 0) {
        this.breedT = 22;
        if (this.pastures && this.livestock() < this.livestockCap()) {
          const live = this.pastures.filter((h) => h.farm && h.farm.alive);
          if (live.length) { const h = live[(Math.random() * live.length) | 0]; AS.Life.herd(g, h.k, h.x, h.y, 1, this.key, h.r); }
        }
      }
      // the healers' temple mends the town
      if (this.has('temple')) for (const b of this.buildings) if (b.alive && b.built >= 1 && b.hp < b.maxHp && b.burn <= 0) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.006 * dt);
      if (this.has('temple') && this.dragon && Math.hypot(this.dragon.x - this.townPos.x, this.dragon.y - this.townPos.y) < 450) this.dragon.heal(this.dragon.maxHp * 0.02 * dt);
      for (let i = this.troops.length - 1; i >= 0; i--) if (this.troops[i].removed) this.troops.splice(i, 1);
      for (let i = this.buildings.length - 1; i >= 0; i--) if (this.buildings[i].removed) this.buildings.splice(i, 1);
      if (this.ai && this.lord) this.lord.update(dt);
    }

    /* ================= ward & elimination ================= */
    wardStrength() {
      let n = 0;
      for (const b of this.buildings) if (b.kind === 'wardstone' && b.alive && b.built >= 1) n++;
      if (this.dragon && this.dragon.down <= 0) n++;
      return n;
    }
    wardUp() { return this.wardStrength() > 0; }
    wardMul() { return WARD_MUL[Math.min(4, this.wardStrength())]; }
    onAttacked(b, src) {
      const g = this.g;
      if (src && src.team && src.team !== this.key) this.lastAttacker = src.faction || g.factions[src.team] || null;
      if (g.time - this.attackedT > 25) {
        if (this.key === g.playerKey) { g.msg('YOUR TOWN IS UNDER ATTACK!', '#ff6a4a', 4); g.news(this.def.short + ' is under attack' + (this.lastAttacker ? ' by ' + this.lastAttacker.def.short : '') + '!', this.key, true); }
        else if (src && src.team === g.playerKey) g.news(this.def.short + ' sounds the alarm!', this.key);
      }
      this.attackedT = g.time;
      if (this.lord) this.lord.onAttacked(b, src);
    }
    onBuildingLost(b, src) {
      const g = this.g;
      const attacker = src && (src.faction || g.factions[src.team]);
      if (attacker && attacker.addGold && b.kind !== 'wall') attacker.addGold(b.kind === 'house' ? 12 : 40, b.x, b.y, 'raid');
      if (b.kind === 'wardstone') g.news('A wardstone of ' + this.def.short + ' has fallen' + (attacker ? ' to ' + attacker.def.short : '') + '!', this.key, this.key === g.playerKey || (attacker && attacker.key === g.playerKey));
      if (b.kind === 'keep') this.eliminate(attacker);
      if (b.kind === 'house') g.later(70, () => { if (!this.eliminated && b.slot && (!b.slot.used || !b.slot.used.alive)) this.place('house', b.slot, { buildTime: 8 }); });
    }
    onLivestockLost(o, thief) {
      if (thief && thief.faction && this.key === this.g.playerKey && this.g.time - (this.stockWarnT || -99) > 20) { this.stockWarnT = this.g.time; this.g.msg(thief.faction.def.short.toUpperCase() + ' IS STEALING YOUR LIVESTOCK!', '#ff8a5a', 3); }
    }
    eliminate(by) {
      if (this.eliminated) return;
      const g = this.g;
      this.eliminated = true;
      g.news(this.def.name + ' has fallen' + (by ? ' to ' + by.def.name : '') + '!', this.key, true);
      if (by) { by.addGold(Math.round(this.gold * 0.5) + 400, this.townPos.x, this.townPos.y, 'conquest'); }
      this.gold = 0;
      // the town crumbles, the troops scatter, the dragon flees the realm
      let i = 0;
      for (const b of this.buildings) if (b.alive && b.kind !== 'keep') { const bb = b; g.later(0.5 + (i++) * 0.15, () => { if (bb.alive) bb.takeDamage(1e6, 'collapse', null); }); }
      for (const t of this.troops) if (t.alive) g.later(Math.random() * 3, () => t.alive && t.takeDamage(1e6, 'collapse', null));
      for (const s of g.sites) if (s.owner === this.key) s.setOwner(null, true);
      if (this.dragon) { this.dragon.down = 1e9; this.dragon.hidden = true; this.dragon.alive = false; }
      for (const o of g.life.animals) if (o.owner === this.key) { o.owner = null; }
      if (AS.Factions && AS.Factions.onEliminated) AS.Factions.onEliminated(g, this, by);
    }
  }

  /* realm-wide faction helpers */
  const Factions = {
    // reveal the war map around the player's watchtowers and sites
    reveal(g) {
      const F = g.playerFaction;
      for (const b of F.buildings) if (b.alive && b.kind === 'watchtower') g.revealArea(b.x, b.y, AS.Data.buildings.watchtower.reveal);
      for (const s of g.sites) if (s.owner === F.key) g.revealArea(s.x, s.y, s.def.reveal || 500);
      g.revealArea(F.townPos.x, F.townPos.y, 1100);
    },
    onEliminated(g, F, by) {
      if (F.key === g.playerKey) Factions.endMatch(g, false, (by ? by.def.name : 'Your enemies') + ' broke your stronghold. ' + F.def.name + ' has fallen.');
    },
    checkVictory(g) {
      if (g.state !== 'play') return;
      const rivals = g.factionList.filter((f) => f.key !== g.playerKey && !f.eliminated);
      if (!rivals.length) Factions.endMatch(g, true, 'Every rival realm has fallen. The Wyrmcrown is yours.');
    },
    endMatch(g, won, text) {
      if (g.state !== 'play') return;
      g.state = 'ending'; g.endT = 4;
      g.result = { won, text, time: g.time, stats: Object.assign({}, g.stats), map: g.map, faction: g.playerKey,
        standings: g.factionList.map((f) => ({ key: f.key, name: f.def.name, eliminated: f.eliminated, gold: Math.round(f.gold), sites: f.sitesOwned, buildings: f.buildings.filter((b) => b.alive).length })) };
      AS.Audio.sfx(won ? 'victory' : 'defeat');
      if (AS.Music && AS.Music.stinger) AS.Music.stinger(won ? 'victory' : 'fail');
      g.msg(won ? 'VICTORY' : 'DEFEAT', won ? '#ffe08a' : '#ff6a4a', 5);
    },
    onDragonDown(g, d, src) {},
  };

  Faction.LIVESTOCK = LIVESTOCK;
  AS.Faction = Faction;
  AS.Factions = Factions;
})(window.AS);
