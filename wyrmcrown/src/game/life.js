/* WYRMCROWN — world life: animals, villagers and birds.
 * Hundreds of lightweight NPCs that make the realm feel inhabited without the
 * cost of full combat entities. They live in their own spatial grid, update at
 * full rate only near the camera (a slow coarse tick elsewhere) and draw only
 * when on screen.
 *  - Animals: wild herds (deer, boar, goats, horses) and livestock owned by a
 *    town or village (cattle, sheep, goats). They graze, drift, bolt from
 *    dragons and fire, and are the dragon's food: fly low, snatch one, eat it.
 *    Stolen livestock carried home joins your herds.
 *  - Villagers: farmers working the fields, townsfolk walking between houses,
 *    the square and the well; they scatter and hide when an enemy dragon comes.
 *  - Birds: flocks wheeling over the land (crows in the blight, gulls over the
 *    water, songbirds in the meadows); they scatter as the dragon passes. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU, C = U.C;

  const ANIMALS = {
    cow: { gen: 'ani_cow', food: 34, hp: 30, speed: 34, run: 95, r: 7, col: '#8a5a3a', col2: '#f0e8dc', len: 13, sfx: 'cow', gold: 1 },
    sheep: { gen: 'ani_sheep', food: 20, hp: 16, speed: 28, run: 90, r: 5, col: '#f2ede2', col2: '#2a2422', len: 9, sfx: 'sheep', gold: 0.7 },
    goat: { gen: 'ani_goat', food: 18, hp: 16, speed: 34, run: 110, r: 5, col: '#e6dccb', col2: '#6a5a4a', len: 9, sfx: 'goat', gold: 0.6 },
    deer: { gen: 'ani_deer', food: 26, hp: 20, speed: 40, run: 175, r: 6, col: '#b07a46', col2: '#f2e2c8', len: 12, sfx: null, wild: true },
    boar: { gen: 'ani_boar', food: 28, hp: 28, speed: 36, run: 140, r: 6, col: '#4a3428', col2: '#2a1e18', len: 11, sfx: 'boar', wild: true },
    horse: { gen: 'ani_horse', food: 30, hp: 30, speed: 44, run: 190, r: 7, col: '#7a4a2a', col2: '#2a1a12', len: 15, sfx: 'horse', wild: true },
  };
  // the stranger wildlife of each realm (models_beasts*.js); the biggest are
  // too large to snatch, but they burn and they fall
  Object.assign(ANIMALS, {
    greatstag: { gen: 'bst_greatstag', food: 40, hp: 42, speed: 40, run: 185, r: 9, col: '#7a4a28', col2: '#e8dcc0', len: 16, sfx: null, wild: true, v: 3 },
    aurochs: { gen: 'bst_aurochs', food: 46, hp: 54, speed: 30, run: 100, r: 10, col: '#2a2420', col2: '#d8c8a0', len: 16, sfx: 'cow', wild: true, v: 3 },
    glimmerdeer: { gen: 'bst_glimmerdeer', food: 30, hp: 22, speed: 40, run: 180, r: 6, col: '#d8e8d0', col2: '#a0ffd0', len: 12, sfx: null, wild: true, v: 3, light: { col: '#a0ffd0', r: 14, a: 0.3 } },
    marshcroaker: { gen: 'bst_marshcroaker', food: 24, hp: 26, speed: 24, run: 90, r: 7, col: '#4a6a3a', col2: '#c8e070', len: 11, sfx: null, wild: true, v: 3, light: { col: '#d8ff80', r: 10, a: 0.25 } },
    elderhorn: { gen: 'bst_elderhorn', food: 0, hp: 220, speed: 20, run: 60, r: 16, col: '#4a5a3a', col2: '#8aa860', len: 28, sfx: null, wild: true, v: 3, nosnatch: true, light: { col: '#9aff9a', r: 18, a: 0.15 } },
    rimeelk: { gen: 'bst_rimeelk', food: 44, hp: 46, speed: 36, run: 175, r: 9, col: '#3a3a40', col2: '#d8e8f0', len: 16, sfx: null, wild: true, v: 3 },
    frosthulk: { gen: 'bst_frosthulk', food: 0, hp: 260, speed: 18, run: 70, r: 15, col: '#8a8070', col2: '#e8e4dc', len: 26, sfx: null, wild: true, v: 3, nosnatch: true },
    woollytusker: { gen: 'bst_woollytusker', food: 0, hp: 240, speed: 20, run: 80, r: 14, col: '#5a3a28', col2: '#e8dcc0', len: 24, sfx: null, wild: true, v: 3, nosnatch: true },
    bloatling: { gen: 'bst_bloatling', food: 0, hp: 180, speed: 14, run: 40, r: 12, col: '#5a4a60', col2: '#c8ff60', len: 18, sfx: null, wild: true, v: 3, nosnatch: true, light: { col: '#c8ff60', r: 14, a: 0.25 } },
    stiltstrider: { gen: 'bst_stiltstrider', food: 0, hp: 160, speed: 26, run: 110, r: 10, col: '#4a4440', col2: '#8a8470', len: 20, sfx: null, wild: true, v: 3, nosnatch: true, light: { col: '#93ff6a', r: 12, a: 0.28 } },
  });
  // tiny wildlife: hares, foxes, rats; not food, just life in the grass
  const CRITTERS = {
    hare: { gen: 'crt_hare', speed: 26, run: 150, hp: 3, r: 2.5, food: 0 },
    fox: { gen: 'crt_fox', speed: 30, run: 130, hp: 4, r: 3.5, food: 0 },
    rat: { gen: 'crt_rat', speed: 22, run: 90, hp: 2, r: 2, food: 0 },
    snowhare: { gen: 'crt_snowhare', speed: 26, run: 150, hp: 3, r: 2.5, food: 0 },
  };
  const SNATCH_SLOW = 235; // below this speed the dragon can snatch from higher up and further away
  const PEOPLE = { peasant: { gen: 'ppl_peasant' }, villager: { gen: 'ppl_villager' } };

  /* fallback look for a missing animal model: a lit oval body with a head */
  function fallbackAnimal(k) {
    const A = ANIMALS[k], S = AS.Shapes;
    return () => ({ r: A.len, h: 8, style: 'unit', parts: [
      { z0: 0, z1: 3, side: '#3a2a20', top: '#4a3a2a', shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 1.5; for (const [x, y] of [[A.len * 0.3, 2], [A.len * 0.3, -2], [-A.len * 0.3, 2], [-A.len * 0.3, -2]]) S.circ(c, x + (y > 0 ? sw : -sw) * Math.sign(x), y, 0.9); } },
      { z0: 3, z1: 6.5, side: C.shade(A.col, -0.25), top: A.col, shape: (c) => S.ell(c, 0, 0, A.len * 0.45, A.len * 0.24) },
      { z0: 5, z1: 7.5, side: C.shade(A.col, -0.2), top: A.col2 === '#2a2422' ? '#3a3230' : A.col, shape: (c) => S.ell(c, A.len * 0.5, 0, A.len * 0.18, A.len * 0.13) },
    ] });
  }
  function fallbackPerson(pal) {
    const S = AS.Shapes;
    return () => ({ r: 6, h: 11, style: 'unit', parts: [
      { z0: 0, z1: 4, side: '#3a2a1a', top: '#4a3a2a', shape: (c, zt, an) => { const sw = Math.sin(an * TAU) * 1.4; S.circ(c, sw, 1, 0.9); S.circ(c, -sw, -1, 0.9); } },
      { z0: 4, z1: 8.5, side: C.shade(pal.a || '#6a5a3a', -0.2), top: pal.b || '#9a8a5a', shape: (c, zt) => S.ell(c, 0, 0, 1.8 - zt * 0.3, 2.4 - zt * 0.4) },
      { z0: 8.5, z1: 10.2, side: '#c89a74', top: pal.skin || '#e8c4a0', shape: (c) => S.circ(c, 0.3, 0, 1.2) },
    ] });
  }

  const Life = {
    ANIMALS, CRITTERS,
    init(g) {
      const L = g.life = { animals: [], people: [], critters: [], flocks: [], grid: new U.Grid(96), t: 0, coarse: 0 };
      // a streamed map fills its wilds area by area as the dragon comes (loadCell, from src/game/stream.js)
      if (g.map.stream) return;
      // wild herds from the map
      for (const h of g.map.wild || []) if (ANIMALS[h.k]) this.herd(g, h.k, h.x, h.y, h.n || 4, null, h.r || 220);
      // each realm's own wildlife, and the small creatures of the grass
      this.wildByRegion(g);
      // livestock and villagers come from towns and villages (they call addHerd/addPeople)
      // bird flocks: spread over the map, kind by region
      const rng = new U.RNG(g.map.seed * 17 + 3);
      const nF = Math.round(g.map.w * g.map.h / 2.4e6);
      for (let i = 0; i < nF; i++) {
        const x = rng.range(300, g.map.w - 300), y = rng.range(300, g.map.h - 300);
        this.flock(g, x, y, rng);
      }
    },
    /* one area of a streamed map: its herds from the map, the realm's own beasts, the
     * small creatures and a flock or two — all tagged with the area, so they can go again */
    loadCell(g, C) {
      const L = g.life, rng = new U.RNG(((g.map.seed || 1) * 613 + C.cx * 7919 + C.cy * 104729) >>> 0);
      const a0 = L.animals.length, c0 = L.critters.length, f0 = L.flocks.length;
      for (const h of g.map.wild || []) if (ANIMALS[h.k] && h.x >= C.x0 && h.x < C.x1 && h.y >= C.y0 && h.y < C.y1) this.herd(g, h.k, h.x, h.y, h.n || 4, null, h.r || 220);
      this.wildByRegion(g, rng, C);
      const nF = (C.x1 - C.x0) * (C.y1 - C.y0) / 2.4e6;
      for (let i = Math.floor(nF + rng.next()); i > 0; i--) this.flock(g, rng.range(C.x0, C.x1), rng.range(C.y0, C.y1), rng);
      C.animals = L.animals.slice(a0); C.critters = L.critters.slice(c0); C.flocks = L.flocks.slice(f0);
    },
    unloadCell(g, C) {
      const L = g.life;
      for (const o of C.animals || []) if (!o.carried && !o.owner) o.alive = false;
      for (const o of C.critters || []) if (!o.carried) o.alive = false;
      if (C.flocks && C.flocks.length) { const gone = new Set(C.flocks); L.flocks = L.flocks.filter((f) => !gone.has(f)); }
      C.animals = C.critters = C.flocks = null;
    },
    herd(g, k, x, y, n, owner, r) {
      const L = g.life, A = ANIMALS[k];
      const herd = { x, y, r: r || 140, owner: owner || null, k };
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * herd.r * 0.6;
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (!g.terrain.groundPassable(px, py)) continue;
        L.animals.push({ kind: k, A, x: px, y: py, a: Math.random() * TAU, vx: 0, vy: 0, hp: A.hp, alive: true, dead: 0, owner: herd.owner, herd, state: 'graze', t: Math.random() * 4, anim: Math.random() * 4, scare: 0, tx: px, ty: py, roast: false, carried: false, burn: 0, v: A.v ? (Math.random() * A.v) | 0 : 0 });
      }
      return herd;
    },
    /* herds of the realm's own beasts in open country, and critters near woods and fields */
    wildByRegion(g, rngIn, C) {
      const T = g.terrain, rng = rngIn || new U.RNG((g.map.seed || 1) * 613 + 7);
      // (C: one area of a streamed map; otherwise the whole map)
      const X0 = C ? C.x0 : 300, Y0 = C ? C.y0 : 300, X1 = C ? C.x1 : g.map.w - 300, Y1 = C ? C.y1 : g.map.h - 300;
      const area = (C ? (X1 - X0) * (Y1 - Y0) : g.map.w * g.map.h) / 1e8;
      const WILD = {
        human: [['greatstag', 2, 3], ['aurochs', 2, 4]], neutral: [['greatstag', 1, 2], ['aurochs', 1, 3]],
        elf: [['glimmerdeer', 3, 4], ['marshcroaker', 2, 3], ['elderhorn', 2, 1]],
        ice: [['rimeelk', 3, 4], ['frosthulk', 2, 2], ['woollytusker', 2, 2]],
        undead: [['bloatling', 2, 1], ['stiltstrider', 2, 1]],
      };
      const CR = { human: ['hare', 'fox'], neutral: ['hare', 'fox'], elf: ['hare', 'fox'], ice: ['snowhare'], undead: ['rat'] };
      const towns = g.factionList.map((F) => F.townPos), sites = C ? (g.sites || []).filter((q) => q.x > X0 - 600 && q.x < X1 + 600 && q.y > Y0 - 600 && q.y < Y1 + 600) : g.sites || [];
      const open = (x, y, water) => {
        if (x < 300 || y < 300 || x > g.map.w - 300 || y > g.map.h - 300) return false;
        if (!T.groundPassable(x, y) || T.kindFast(x, y) !== 0) return false;
        const wd = T.gs(T.gWater, x, y);
        if (wd < 40 || (water && wd > 200)) return false;
        if (T.gs(T.gRoad, x, y) < 70 || T.gs(T.gMount, x, y) > 0.4) return false;
        for (const t of towns) if (Math.hypot(t.x - x, t.y - y) < 950) return false;
        for (const s of sites) if (Math.hypot(s.x - x, s.y - y) < (s.def.r || 40) + 180) return false;
        return true;
      };
      for (const bk in WILD) for (const [k, per, n] of WILD[bk]) {
        const A = ANIMALS[k];
        if (!A || !AS.Models[A.gen]) continue;
        const want = C ? Math.floor(per * area + rng.next()) : Math.max(1, Math.round(per * area));
        let made = 0, tries = 0;
        while (made < want && tries < (C ? 24 : 120)) {
          tries++;
          const x = rng.range(X0, X1), y = rng.range(Y0, Y1);
          if (T.biomeKey(x, y) !== bk || !open(x, y, k === 'marshcroaker' || k === 'bloatling')) continue;
          if (T.gs(T.gForest, x, y) > (bk === 'elf' ? 0.75 : 0.45)) continue;
          this.herd(g, k, x, y, n, null, 200);
          made++;
        }
      }
      for (const bk in CR) {
        const want = C ? Math.floor(4 * area + rng.next()) : Math.round(4 * area);
        let made = 0, tries = 0;
        while (made < want && tries < (C ? 20 : 80)) {
          tries++;
          const x = rng.range(X0, X1), y = rng.range(Y0, Y1);
          if (T.biomeKey(x, y) !== bk || !T.groundPassable(x, y) || T.kindFast(x, y) !== 0) continue;
          const kinds = CR[bk].filter((c) => AS.Models[CRITTERS[c].gen]);
          if (!kinds.length) break;
          const k = kinds[(rng.next() * kinds.length) | 0];
          this.critters(g, k, x, y, 2 + (rng.next() * 3 | 0));
          made++;
        }
      }
    },
    critters(g, k, x, y, n) {
      const L = g.life, A = CRITTERS[k];
      const herd = { x, y, r: 120, owner: null, k };
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = Math.random() * 60, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (!g.terrain.groundPassable(px, py)) continue;
        L.critters.push({ kind: k, A, critter: true, x: px, y: py, a: Math.random() * TAU, vx: 0, vy: 0, hp: A.hp, alive: true, dead: 0, owner: null, herd, state: 'graze', t: Math.random() * 3, anim: Math.random() * 4, scare: 0, tx: px, ty: py, roast: false, carried: false, burn: 0, v: (Math.random() * 3) | 0 });
      }
    },
    // a settlement's people: n villagers wandering between the given spots
    addPeople(g, team, x, y, r, n, opts) {
      const L = g.life;
      opts = opts || {};
      const pal = opts.pal || AS.Data.pal.neutral;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r * 0.7;
        const farmer = opts.fields && i < n * 0.4;
        const kind = farmer ? 'peasant' : 'villager';
        L.people.push({ kind, v: i % 4, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, a: Math.random() * TAU, vx: 0, vy: 0, team, pal, home: { x, y, r }, fields: opts.fields || null, spots: opts.spots || null,
          state: 'idle', t: Math.random() * 3, anim: Math.random() * 4, tx: x, ty: y, alive: true, hidden: 0, scare: 0, hp: 6, work: farmer });
      }
    },
    flock(g, x, y, rng) {
      const b = g.terrain.biomeKey(x, y);
      const water = g.terrain.gs(g.terrain.gWater, x, y) < 200;
      const kind = b === 'undead' ? 'crow' : water ? 'gull' : b === 'ice' ? 'raven' : 'song';
      const n = kind === 'song' ? 5 + (rng.next() * 6 | 0) : 3 + (rng.next() * 5 | 0);
      const birds = [];
      for (let i = 0; i < n; i++) birds.push({ ox: rng.range(-30, 30), oy: rng.range(-20, 20), oz: rng.range(-8, 8), ph: rng.next(), sp: 0.85 + rng.next() * 0.3 });
      g.life.flocks.push({ x, y, z: 60 + rng.next() * 60, cx: x, cy: y, a: rng.next() * TAU, r: 120 + rng.next() * 200, w: (rng.next() < 0.5 ? -1 : 1) * (0.25 + rng.next() * 0.25), kind, birds, scatter: 0, vx: 0, vy: 0 });
    },
    count(g) { return g.life ? g.life.animals.length + g.life.people.length : 0; },
    livestockOf(g, fk) { let n = 0; for (const a of g.life.animals) if (a.alive && !a.dead && a.owner === fk) n++; return n; },

    /* the recipe for a creature's sheet (key, model function, layout), so the
     * realm's warm-up can forge it a frame at a time */
    sheetSpec(o) {
      if (o.kind in ANIMALS) { const A = ANIMALS[o.kind], v = o.v || 0; return { key: 'ani:' + o.kind + ':' + v + (AS.Models[A.gen] ? '' : ':fb'), fn: AS.Models[A.gen] ? AS.Forge.recipe(A.gen, {}, { v }) : fallbackAnimal(o.kind), dirs: 16, anims: 4 }; }
      if (o.critter) { const A = CRITTERS[o.kind], v = o.v || 0; return { key: 'crt:' + o.kind + ':' + v, fn: AS.Forge.recipe(A.gen, {}, { v }), dirs: 16, anims: 4 }; }
      if (PEOPLE[o.kind]) { const gen = PEOPLE[o.kind].gen, key = 'ppl:' + o.kind + ':' + o.v + ':' + (o.team || 'n'); return { key: key + (AS.Models[gen] ? '' : ':fb'), fn: AS.Models[gen] ? AS.Forge.recipe(gen, o.pal, { v: o.v }) : fallbackPerson(o.pal), dirs: 16, anims: 4 }; }
      return null;
    },
    sheetFor(o) {
      if (o.kind in ANIMALS) {
        const A = ANIMALS[o.kind], v = o.v || 0;
        A.sheets = A.sheets || [];
        if (!A.sheets[v]) { const sp = this.sheetSpec(o); A.sheets[v] = AS.Forge.sheet(sp.key, sp.fn, sp.dirs, sp.anims); }
        return A.sheets[v];
      }
      if (o.critter) {
        const A = CRITTERS[o.kind], v = o.v || 0;
        A.sheets = A.sheets || [];
        if (!A.sheets[v]) { const sp = this.sheetSpec(o); A.sheets[v] = AS.Forge.sheet(sp.key, sp.fn, sp.dirs, sp.anims); }
        return A.sheets[v];
      }
      const key = 'ppl:' + o.kind + ':' + o.v + ':' + (o.team || 'n');
      this.pplSheets = this.pplSheets || {};
      let sh = this.pplSheets[key];
      if (!sh) { const sp = this.sheetSpec(o); sh = this.pplSheets[key] = AS.Forge.sheet(sp.key, sp.fn, sp.dirs, sp.anims); }
      return sh;
    },

    /* ---------------- update ---------------- */
    update(g, dt) {
      const L = g.life, p = g.player, cam = g.camera;
      L.t += dt;
      L.grid.clear();
      const near = (o) => Math.abs(o.x - (cam.x + cam.w / 2)) < cam.w * 0.9 + 300 && Math.abs(o.y - (cam.y + cam.h / 2)) < cam.h * 0.9 + 400;
      L.coarse -= dt;
      const coarseTick = L.coarse <= 0;
      if (coarseTick) L.coarse = 0.5;
      // threats: dragons flying low and recent fire
      const threats = this._thr || (this._thr = []);
      threats.length = 0;
      for (const d of g.dragons) if (d.targetable && d.z < 95) threats.push(d);
      // a large map (map.simR) lets life far from the dragon (and any campaign army) sleep
      const simR = g.map.simR ? g.map.simR * (g.highFlight ? 1.5 : 1) : 0, sr2 = simR * simR;
      const asleep = simR ? (o) => { const dx = o.x - p.x, dy = o.y - p.y; return dx * dx + dy * dy > sr2 && !(g.nearWake && g.nearWake(o, 1600)); } : null;
      for (let i = L.animals.length - 1; i >= 0; i--) {
        const o = L.animals[i];
        if (!o.alive) { L.animals.splice(i, 1); continue; }
        if (o.carried) continue;
        if (o.dead) { o.dead += dt; if (o.dead > 30) o.alive = false; L.grid.insert(o); continue; }
        if (asleep && coarseTick && asleep(o)) { o.sleep = true; continue; }
        if (o.sleep) { if (coarseTick) o.sleep = false; else continue; }
        const full = near(o);
        if (full) this.updateAnimal(g, o, dt, threats);
        else if (coarseTick) this.updateAnimal(g, o, 0.5, threats, true);
        L.grid.insert(o);
      }
      for (let i = L.critters.length - 1; i >= 0; i--) {
        const o = L.critters[i];
        if (!o.alive) { L.critters.splice(i, 1); continue; }
        if (o.dead) { o.dead += dt; if (o.dead > 12) o.alive = false; continue; }
        if (asleep && coarseTick && asleep(o)) { o.sleep = true; continue; }
        if (o.sleep) { if (coarseTick) o.sleep = false; else continue; }
        if (near(o)) this.updateAnimal(g, o, dt, threats);
        else if (coarseTick) this.updateAnimal(g, o, 0.5, threats, true);
        L.grid.insert(o);
      }
      for (let i = L.people.length - 1; i >= 0; i--) {
        const o = L.people[i];
        if (!o.alive) { L.people.splice(i, 1); continue; }
        if (asleep && coarseTick && asleep(o)) { o.sleep = true; continue; }
        if (o.sleep) { if (coarseTick) o.sleep = false; else continue; }
        if (near(o)) this.updatePerson(g, o, dt, threats);
        else if (coarseTick) this.updatePerson(g, o, 0.5, threats, true);
        if (!o.hidden) L.grid.insert(o);
      }
      for (const f of L.flocks) { if (asleep && asleep(f)) continue; this.updateFlock(g, f, dt, near(f)); }
    },
    updateAnimal(g, o, dt, threats, coarse) {
      const A = o.A;
      o.t -= dt;
      if (o.burn > 0) { o.burn -= dt; o.hp -= 6 * dt; if (!coarse && Math.random() < 0.4) AS.FX.fire(o.x, o.y, 4, 4); if (o.hp <= 0) return this.kill(g, o, true); }
      // fear
      let fx = 0, fy = 0, afraid = false;
      if (!coarse) for (const d of threats) {
        const dx = o.x - d.x, dy = o.y - d.y, dd = dx * dx + dy * dy, R = 150 + (90 - d.z);
        if (dd < R * R) { const k = 1 / Math.max(20, Math.sqrt(dd)); fx += dx * k; fy += dy * k; afraid = true; }
      }
      if (afraid) { o.scare = 2.5; o.fa = Math.atan2(fy, fx); if (o.state !== 'flee' && A.sfx && Math.random() < 0.08) AS.Audio.sfx(A.sfx, { x: o.x, y: o.y, vol: 0.5 }); o.state = 'flee'; }
      if (o.scare > 0) { o.scare -= dt; if (o.scare <= 0) { o.state = 'graze'; o.t = 1 + Math.random() * 3; } }
      let sp = 0, want = o.a;
      if (o.state === 'flee') {
        want = o.fa + Math.sin(g.time * 2 + o.x) * 0.3; sp = A.run * (o.slow > 0 ? 0.4 : 1);
      } else {
        if (o.t <= 0) {
          // pick a new grazing spot inside the herd's range (owners' pastures drift with the farm)
          const h = o.herd, a = Math.random() * TAU, d = Math.sqrt(Math.random()) * h.r;
          o.tx = h.x + Math.cos(a) * d; o.ty = h.y + Math.sin(a) * d;
          o.state = Math.random() < 0.55 ? 'walk' : 'graze';
          o.t = o.state === 'walk' ? 3 + Math.random() * 4 : 2 + Math.random() * 5;
        }
        if (o.state === 'walk') {
          const dx = o.tx - o.x, dy = o.ty - o.y, dd = Math.hypot(dx, dy);
          if (dd < 6) { o.state = 'graze'; o.t = 2 + Math.random() * 4; } else { want = Math.atan2(dy, dx); sp = A.speed; }
        }
      }
      if (o.slow > 0) o.slow -= dt;
      if (o.root > 0) { o.root -= dt; sp = 0; }
      o.a = U.turnToward(o.a, want, 4 * dt);
      const nx = o.x + Math.cos(o.a) * sp * dt, ny = o.y + Math.sin(o.a) * sp * dt;
      if (sp > 0) {
        if (g.terrain.groundPassable(nx, ny)) { o.x = nx; o.y = ny; }
        else { o.a += Math.PI * (0.5 + Math.random()); o.t = 0; }
      }
      o.x = U.clamp(o.x, 20, g.map.w - 20); o.y = U.clamp(o.y, 20, g.map.h - 20);
      o.anim += dt * (sp > 0 ? 2 + sp * 0.05 : 0);
      o.moving = sp > 0;
      if (!coarse && o.state === 'graze' && A.sfx && Math.random() < 0.0015) AS.Audio.sfx(A.sfx, { x: o.x, y: o.y, vol: 0.35 });
    },
    updatePerson(g, o, dt, threats, coarse) {
      o.t -= dt;
      if (o.hidden > 0) { o.hidden -= dt; return; }
      let afraid = null;
      if (!coarse) for (const d of threats) {
        if (!g.hostile(d.team, o.team) && o.team !== 'neutral') continue;
        if (d.team === o.team) continue;
        const dx = o.x - d.x, dy = o.y - d.y;
        if (dx * dx + dy * dy < 200 * 200) { afraid = d; break; }
      }
      if (afraid && o.state !== 'flee') {
        o.state = 'flee'; o.t = 2.5 + Math.random() * 2; o.fa = Math.atan2(o.y - afraid.y, o.x - afraid.x) + U.range(-0.6, 0.6);
        if (Math.random() < 0.15) AS.Audio.sfx('villager_cry', { x: o.x, y: o.y, vol: 0.5, rate: U.range(0.85, 1.25) });
      }
      let sp = 0, want = o.a;
      if (o.state === 'flee') {
        sp = 62; want = o.fa;
        if (o.t <= 0) { o.state = 'idle'; o.hidden = 6 + Math.random() * 8; o.t = 0; }
      } else {
        if (o.t <= 0) {
          // next errand: a field to work, a spot in the settlement, or a short stroll
          const h = o.home;
          if (o.work && o.fields && o.fields.length) { const f = o.fields[(Math.random() * o.fields.length) | 0]; o.tx = f.x + U.range(-f.w * 0.4, f.w * 0.4); o.ty = f.y + U.range(-f.h * 0.4, f.h * 0.4); }
          else if (o.spots && o.spots.length && Math.random() < 0.7) { const s = o.spots[(Math.random() * o.spots.length) | 0]; o.tx = s.x + U.range(-14, 14); o.ty = s.y + U.range(-10, 10); }
          else { const a = Math.random() * TAU, d = Math.random() * h.r * 0.75; o.tx = h.x + Math.cos(a) * d; o.ty = h.y + Math.sin(a) * d; }
          o.state = 'walk'; o.t = 12;
        }
        if (o.state === 'walk') {
          const dx = o.tx - o.x, dy = o.ty - o.y, dd = Math.hypot(dx, dy);
          if (dd < 4) { o.state = 'idle'; o.t = (o.work ? 5 : 2) + Math.random() * 6; }
          else { want = Math.atan2(dy, dx); sp = 22; }
        }
      }
      o.a = U.turnToward(o.a, want, 5 * dt);
      const nx = o.x + Math.cos(o.a) * sp * dt, ny = o.y + Math.sin(o.a) * sp * dt;
      if (sp > 0) { if (g.terrain.groundPassable(nx, ny)) { o.x = nx; o.y = ny; } else { o.state = 'idle'; o.t = 1; } }
      o.anim += dt * (sp > 0 ? 3 + sp * 0.08 : (o.work && o.state === 'idle' ? 1.2 : 0));
      o.moving = sp > 0;
    },
    updateFlock(g, f, dt, near) {
      f.a += f.w * dt;
      // the flock's centre wanders slowly over the land
      f.cx += Math.cos(g.time * 0.05 + f.r) * 6 * dt; f.cy += Math.sin(g.time * 0.04 + f.r) * 5 * dt;
      let tx = f.cx + Math.cos(f.a) * f.r, ty = f.cy + Math.sin(f.a) * f.r * 0.8;
      const p = g.player;
      if (near && p && !p.hidden) {
        const dx = f.x - p.x, dy = f.y - p.y;
        if (f.scatter <= 0 && dx * dx + dy * dy < 160 * 160 && Math.abs(f.z - p.z) < 60) {
          f.scatter = 3; f.sa = Math.atan2(dy, dx);
          AS.Audio.sfx(f.kind === 'crow' || f.kind === 'raven' ? 'crow' : 'bird_chirp', { x: f.x, y: f.y, vol: 0.6 });
        }
      }
      if (f.scatter > 0) {
        f.scatter -= dt;
        tx = f.x + Math.cos(f.sa) * 300; ty = f.y + Math.sin(f.sa) * 300;
        if (f.scatter <= 0) { f.cx = f.x; f.cy = f.y; }
      }
      const sp = f.scatter > 0 ? 160 : 70;
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
      f.vx = U.damp(f.vx, dx / d * sp, 2, dt); f.vy = U.damp(f.vy, dy / d * sp, 2, dt);
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.x = U.clamp(f.x, 50, g.map.w - 50); f.y = U.clamp(f.y, 50, g.map.h - 50); f.cx = U.clamp(f.cx, 300, g.map.w - 300); f.cy = U.clamp(f.cy, 300, g.map.h - 300);
      f.z = U.damp(f.z, f.scatter > 0 ? 130 : 70 + Math.sin(g.time * 0.3 + f.r) * 25, 1, dt);
      if (near && !f.scatter && Math.random() < 0.002) AS.Audio.sfx(f.kind === 'crow' || f.kind === 'raven' ? 'crow' : f.kind === 'gull' ? 'bird_chirp' : 'bird_chirp', { x: f.x, y: f.y, vol: 0.35, rate: f.kind === 'gull' ? 0.6 : 1 });
    },

    kill(g, o, roast) {
      if (o.dead) return;
      o.dead = 0.001; o.roast = !!roast; o.moving = false;
      if (o.kind in ANIMALS || o.critter) {
        AS.FX.splat(o.x, o.y, 4, roast ? '#5a3a2a' : '#8a2a1a', o.critter ? 2 : 6);
        if (o.owner && g.factions[o.owner] && g.factions[o.owner].onLivestockLost) g.factions[o.owner].onLivestockLost(o);
      }
    },

    /* ---------------- the dragon eats ----------------
     * Snatching is easy when the dragon is slow: it reaches further and from
     * higher up. Tap E to snatch and eat at once (crunch, squelch, swallow);
     * hold E to keep the animal in its claws and carry it home instead. */
    snatchReach(d) {
      const slow = d.speed < SNATCH_SLOW;
      return { z: slow ? 56 : 36, r: (slow ? 88 : 46) * d.scale, slow };
    },
    // the animal under a point on the ground (a click), if any
    preyAt(g, x, y, r) {
      let best = null, bd = r * r;
      for (const o of g.life.grid.query(x, y, r + 8, [])) {
        if (!(o.kind in ANIMALS) || o.carried || !o.alive || o.A.nosnatch) continue;
        const dd = (o.x - x) * (o.x - x) + (o.y - 4 - y) * (o.y - 4 - y);
        if (dd < bd) { bd = dd; best = o; }
      }
      return best;
    },
    preyInReach(g, d) {
      const R = this.snatchReach(d);
      if (d.z > R.z) return null;
      // the head reaches a little ahead of the body
      const qx = d.x + Math.cos(d.angle) * 16 * d.scale, qy = d.y + Math.sin(d.angle) * 16 * d.scale;
      // the animal the dragon is hunting comes first when it is in reach
      const w = d.preyWant;
      if (w && w.alive && !w.carried && (w.x - qx) * (w.x - qx) + (w.y - qy) * (w.y - qy) < R.r * R.r) return w;
      let best = null, bd = R.r * R.r;
      for (const o of g.life.grid.query(qx, qy, R.r + 8, [])) {
        if (!(o.kind in ANIMALS) || o.carried || !o.alive || o.A.nosnatch) continue;
        const dd = (o.x - qx) * (o.x - qx) + (o.y - qy) * (o.y - qy);
        if (dd < bd) { bd = dd; best = o; }
      }
      return best;
    },
    dragonFeeding(d, dt) {
      const g = d.g, I = d.input;
      d.grabCd -= dt;
      if (d.eatT > 0) {
        d.eatT -= dt;
        if (Math.random() < 0.35) AS.FX.splat(d.nodes[0].x, d.nodes[0].y, d.nodes[0].z, '#8a2a1a', 1);
        // the swallow comes quickly after the crunch
        if (!d.swallowed && d.eatT < 0.42) {
          d.swallowed = true;
          const o = d.eating, A = o.A;
          const gain = A.food * (o.roast ? 1.3 : 1) * (d.buffs.feast ? 1.5 : 1);
          d.energy = Math.min(d.maxEnergy, d.energy + gain);
          d.heal(d.maxHp * 0.04);
          d.stats.eaten++;
          if (d.isPlayer) { g.stats.eaten++; AS.FX.text(d.x, d.y - d.z, 20, '+' + Math.round(gain) + ' ENERGY', '#ffd27a'); }
          if (!d.recordedEating) AS.Audio.sfx('swallow', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.45 });
        }
        if (d.eatT <= 0) { d.eatT = 0; d.eating = null; }
        return;
      }
      if (d.carry) {
        const o = d.carry;
        d.carryT += dt;
        o.x = d.carryPos ? d.carryPos.x : d.x; o.y = d.carryPos ? d.carryPos.y : d.y;
        // stolen livestock flown home joins your herds
        const F = d.faction;
        if (o.owner !== F.key && F.pastureAt && F.pastureAt(d.x, d.y) && d.z < 70) { this.deposit(g, d, o, F); return; }
        if (d.isPlayer) {
          // a tap eats at once; holding E keeps it in the claws to carry home
          if (!d.carryKeep) {
            if (I.eat && d.carryT > 0.3) { d.carryKeep = true; g.msg('CARRYING ' + o.kind.toUpperCase() + ' — FLY IT HOME TO YOUR PASTURES, OR PRESS E TO EAT', '#ffd27a', 3); }
            else if (!I.eat) this.eat(d, o);
          } else if (I.eatHit) this.eat(d, o);
        } else if (I.eatHit || (d.carryT > 1.5 && !(d.ai && d.ai.wantDeposit))) this.eat(d, o);
        return;
      }
      if (!I.eatHit || d.grabCd > 0) return;
      const R = this.snatchReach(d);
      if (d.z > R.z) { if (d.isPlayer) g.msg(R.slow ? 'TOO HIGH — HOLD SPACE TO DROP LOW' : 'TOO FAST AND HIGH — SLOW DOWN (S) OR DROP LOW (SPACE)', '#ffe7a8', 1.6); return; }
      const best = this.preyInReach(g, d);
      if (!best) { if (d.isPlayer) g.msg(R.slow ? 'NO PREY IN REACH' : 'NO PREY IN REACH — SLOW DOWN TO REACH FURTHER', '#ffe7a8', 1.2); return; }
      d.grabCd = 0.5;
      best.carried = true; best.state = 'carried';
      d.carry = best; d.carryT = 0; d.carryKeep = false;
      AS.Audio.sfx('snatch', { x: d.x, y: d.y, vol: d.isPlayer ? 1 : 0.6 });
      if (best.A.sfx) AS.Audio.sfx(best.A.sfx, { x: d.x, y: d.y, vol: 0.7, rate: 1.2 });
      AS.FX.dust(best.x, best.y, 6, g.groundDust(best.x, best.y), 50);
      if (best.owner && best.owner !== d.team && g.factions[best.owner]) {
        g.factions[best.owner].onLivestockLost && g.factions[best.owner].onLivestockLost(best, d);
        if (d.isPlayer) g.msg('LIVESTOCK STOLEN — EAT IT (E) OR CARRY IT HOME', '#ffd27a', 2.5);
      }
    },
    eat(d, o) {
      const g = d.g;
      d.carry = null; d.carryKeep = false;
      o.carried = false; o.alive = false;
      d.eating = o; d.eatT = 0.9; d.swallowed = false;
      // crunch, a wet squelch, then the swallow (in dragonFeeding)
      const vol = d.isPlayer ? 1 : 0.5;
      const prey = o.kind === 'sheep' ? 'sheep' : o.kind === 'cow' || o.kind === 'cattle' ? 'cattle' : o.kind === 'goat' || o.kind === 'deer' ? 'goat_deer' : 'large';
      const eatSound = 'eat_' + prey;
      d.recordedEating = AS.RecordedAudio && AS.RecordedAudio.has(eatSound);
      AS.Audio.sfx(d.recordedEating ? eatSound : 'bone_crunch', { x: d.x, y: d.y, vol, rate: d.recordedEating ? 1 : U.range(0.92, 1.08) });
      const later = g.later ? g.later.bind(g) : (t, fn) => setTimeout(fn, t * 1000);
      if (!d.recordedEating) later(0.16, () => AS.Audio.sfx('squelch', { x: d.x, y: d.y, vol, rate: U.range(0.9, 1.1) }));
      if (Math.random() < 0.15) later(0.95, () => { if (!g.ended && d.down <= 0) AS.Audio.sfx(U.pick(['dragon_satisfied', 'dragon_burp', 'dragon_snort']), { x: d.x, y: d.y, vol: vol * 0.7 }); });
      if (AS.Voices && AS.Voices.g === g) AS.Voices.onEat(d);
      AS.FX.splat(d.nodes[0].x, d.nodes[0].y, d.nodes[0].z, '#8a2a1a', 4);
    },
    deposit(g, d, o, F) {
      d.carry = null;
      o.carried = false; o.owner = F.key; o.state = 'graze'; o.t = 1;
      const P = F.pasture || { x: d.x, y: d.y, r: 120 };
      o.herd = F.herdFor ? F.herdFor(o.kind) : { x: P.x, y: P.y, r: P.r, owner: F.key, k: o.kind };
      o.x = d.x; o.y = d.y;
      AS.Audio.sfx('coin', { x: d.x, y: d.y });
      if (d.isPlayer) { g.msg(o.kind.toUpperCase() + ' ADDED TO YOUR HERDS', '#9fe8a0', 2.2); g.stats.raided++; }
      if (F.onLivestockGained) F.onLivestockGained(o);
    },
    dropCarry(d) { if (d.carry) { d.carry.carried = false; d.carry.state = 'flee'; d.carry.scare = 2; d.carry = null; } },
    drawCarried(o, ctx, x, y, z, ox, oy, R, ang) {
      const sh = this.sheetFor(o);
      R.sprite(ctx, sh, ang + Math.PI / 2, (AS.game ? AS.game.time * 8 : 0), x, y, z, ox, oy);
    },

    /* ---------------- damage ---------------- */
    breathHit(g, d, bi, dmg, B) {
      for (const o of g.life.grid.query(bi.mx + Math.cos(bi.a) * bi.L * 0.5, bi.my + Math.sin(bi.a) * bi.L * 0.5, bi.L, [])) {
        if (o.dead || o.carried || o.hidden > 0) continue;
        if (!AS.Combat.inCone(bi, o.x, o.y, 0, 5)) continue;
        if (o.kind in ANIMALS || o.critter) {
          if (B.effect === 'freeze') { o.slow = 3; o.hp -= dmg * 0.8; }
          else { o.hp -= dmg; if (B.effect === 'burn') o.burn = 3; }
          if (o.hp <= 0) this.kill(g, o, B.effect === 'burn');
          else { o.state = 'flee'; o.scare = 3; o.fa = Math.atan2(o.y - d.y, o.x - d.x); }
        } else if (o.team !== d.team) {
          o.hp -= dmg;
          if (o.hp <= 0) { o.alive = false; AS.FX.splat(o.x, o.y, 4, '#6a2a1a', 4); g.terrain.addDecal('scorch', o.x, o.y, 6); }
          else { o.state = 'flee'; o.t = 3; o.fa = Math.atan2(o.y - d.y, o.x - d.x); }
        }
      }
    },
    projHit(g, p) {
      if (!(p.owner && p.owner.isDragon)) return false;
      for (const o of g.life.grid.query(p.x, p.y + 10, 24, [])) {
        if (o.dead || o.carried || !(o.kind in ANIMALS)) continue;
        if (o.owner === p.team) continue;
        if (U.segDist(o.x, o.y - 5, p.px, p.py, p.x, p.y) < 6 + p.r) {
          o.hp -= p.dmg;
          AS.FX.impact(p.x, p.y, 0, p.col);
          if (o.hp <= 0) this.kill(g, o, false);
          else { o.state = 'flee'; o.scare = 3; o.fa = Math.atan2(p.vy, p.vx); }
          return true;
        }
      }
      return false;
    },
    damageArea(g, x, y, R, dmg, dtype, team, src, opts) {
      for (const o of g.life.grid.query(x, y, R, [])) {
        if (o.dead || o.carried || o.hidden > 0) continue;
        if (Math.hypot(o.x - x, o.y - y) > R) continue;
        o.hp -= dmg * 0.6;
        if (o.hp <= 0) { if (o.kind in ANIMALS || o.critter) this.kill(g, o, dtype === 'fire'); else o.alive = false; }
      }
    },
    fieldTouch(g, f) {
      if (f.type !== 'burn') return;
      for (const o of g.life.grid.query(f.x, f.y, f.r, [])) if (!o.dead && (o.kind in ANIMALS) && !o.carried) { o.state = 'flee'; o.scare = 2; o.fa = Math.atan2(o.y - f.y, o.x - f.x); }
    },
    gridInsert() {},

    /* ---------------- drawing ---------------- */
    collect(g, list, x0, y0, x1, y1) {
      const L = g.life;
      for (const o of L.animals) if (!o.carried && o.x > x0 - 20 && o.x < x1 + 20 && o.y > y0 - 20 && o.y < y1 + 40) list.push(o.drawable || (o.drawable = makeDrawable(o)));
      for (const o of L.critters) if (o.x > x0 - 20 && o.x < x1 + 20 && o.y > y0 - 20 && o.y < y1 + 40) list.push(o.drawable || (o.drawable = makeDrawable(o)));
      for (const o of L.people) if (!o.hidden && o.x > x0 - 20 && o.x < x1 + 20 && o.y > y0 - 20 && o.y < y1 + 40) list.push(o.drawable || (o.drawable = makeDrawable(o)));
    },
    drawSky(ctx, ox, oy, g, R) {
      const L = g.life, cam = g.camera;
      ctx.save();
      for (const f of L.flocks) {
        if (f.x < cam.x - 200 || f.x > cam.x + cam.w + 200 || f.y < cam.y - 100 || f.y > cam.y + cam.h + 300) continue;
        const col = f.kind === 'gull' ? '#f4f4ee' : f.kind === 'crow' ? '#14121a' : f.kind === 'raven' ? '#1a1c24' : '#5a4430';
        const s = f.kind === 'gull' ? 4.2 : f.kind === 'song' ? 2.6 : 3.6;
        const ha = Math.atan2(f.vy, f.vx);
        for (const b of f.birds) {
          const bx = f.x + b.ox, by = f.y + b.oy, bz = f.z + b.oz;
          const flap = Math.sin((g.time * (f.scatter > 0 ? 14 : 8) + b.ph * 6.28) * b.sp);
          // shadow on the ground
          ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(bx - ox + 2 + bz * 0.27, by - oy + 1 + bz * 0.06, s * 0.8, s * 0.4, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          const sx = bx - ox, sy = by - bz - oy;
          const ca = Math.cos(ha), sa = Math.sin(ha), nx = -sa, ny = ca, wz = flap * s * 0.6;
          ctx.strokeStyle = col; ctx.lineWidth = s > 3 ? 1.4 : 1.1; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx + nx * s - ca * s * 0.3, sy + ny * s - sa * s * 0.3 - wz);
          ctx.quadraticCurveTo(sx + nx * s * 0.4, sy + ny * s * 0.4 - wz * 0.5, sx + ca * 0.8, sy + sa * 0.8);
          ctx.quadraticCurveTo(sx - nx * s * 0.4, sy - ny * s * 0.4 - wz * 0.5, sx - nx * s - ca * s * 0.3, sy - ny * s - sa * s * 0.3 - wz);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };

  function makeDrawable(o) {
    return {
      o, get x() { return o.x; }, get y() { return o.y; }, get sortY() { return o.y; },
      drawShadow(ctx, ox, oy) {
        const sh = Life.sheetFor(o);
        AS.Renderer.shadow(ctx, sh, o.a, o.x, o.y, 0, ox, oy);
      },
      draw(ctx, ox, oy, R) {
        const sh = Life.sheetFor(o);
        if (o.dead) {
          // a carcass lies on its side; roasted ones smoulder
          ctx.save(); ctx.globalAlpha = Math.max(0, 1 - o.dead / 30) * 0.9;
          ctx.translate(o.x - ox, o.y - oy); ctx.scale(1, 0.6);
          ctx.drawImage(sh.frames[0][AS.Forge.frameIndex(sh, o.a)], -sh.ax, -sh.ay, sh.w, sh.h);
          ctx.restore();
          if (o.roast && Math.random() < 0.05) AS.FX.smoke(o.x, o.y, 4, 3, true);
          return;
        }
        const anim = o.moving || (o.work && o.state === 'idle') ? o.anim : 0;
        R.sprite(ctx, sh, o.a, anim, o.x, o.y, 0, ox, oy);
        if (o.burn > 0) AS.Renderer.light(o.x, o.y - 4, 14, '#ff8a3a', 0.3);
        const L = o.A && o.A.light;
        if (L) R.light(o.x, o.y - 6, L.r, L.col, L.a * (0.85 + 0.15 * Math.sin(o.anim * 2 + o.x)));
      },
    };
  }

  AS.Life = Life;
})(window.AS);
