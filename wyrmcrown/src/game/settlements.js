/* WYRMCROWN — SETTLEMENTS: places made of many buildings (the Huge World's
 * towns, castles, abbeys and the homes of other peoples).
 *
 * A place whose site data names a layout (AS.Data.sites[k].compose) is built
 * here instead of from one model. Each layout lays out real streets, rings of
 * walls with towers and a gatehouse, courtyards, gardens, quays… from the
 * kingdoms' own building sets (houses, manors, sheds, granaries, markets,
 * temples, keeps, walls, gates, towers — data/buildings.js, gfx/models_*.js) and
 * the wider world's architecture (gfx/models_world.js), in the colours of the
 * culture that lives there:
 *
 *   town         a market town: a cobbled square with its market and church,
 *                streets out to the fields, 30-50 houses, sheds and granaries
 *   walledtown   a larger town inside a ring of stone walls, towers and a gatehouse
 *   stronghold   a castle: great keep, square curtain walls with corner and
 *                flanking towers, a gatehouse, barracks and stables in the bailey,
 *                a village outside the gate
 *   abbey        an abbey church with its cloister walls, graveyard, gardens, granary
 *   elfvillage   houses and a temple among the trees round a great tree and a pool
 *   dwarfhold    a gate carved into the mountain, stone halls, a forge, the mine
 *   shire        hill-folk burrows along winding lanes, hedges, gardens, a mill
 *   harbour      jetties out over the water with boats, warehouses and a market
 *   banditcamp   a stockade of stakes round tents and a campfire, and the loot
 *   farmstead    a farmhouse, barn and sheds, fenced fields, haystacks and cattle
 *   inn          a roadside inn with its stable, well and signpost
 *   dungeon      a carved portal over stairs into the dark (and its hoard)
 *
 * Everything is placed from the place's own random sequence, so a place built
 * again (a streamed map, src/game/stream.js) is the same as before. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  // which building set and colours a culture uses
  const SET = { human: 'human', neutral: 'human', elf: 'elf', ice: 'ice', undead: 'undead' };
  const DWARF = { a: '#6a6660', b: '#b8b0a0', t: '#4a4e56', g: '#ffb050', d: '#2a2622', k: '#9a3a2a', k2: '#e0b050', w: '#5a4030', s: '#a49c8c', skin: '#e0b898' };

  const Settlements = {
    // the culture of a place: chosen by the map, else the realm whose land it stands in
    culture(site) { return site.spec.culture || (site.g.terrain.biomeKey(site.x, site.y)); },
    pal(cul) { return cul === 'dwarf' ? DWARF : AS.Data.pal[cul] || AS.Data.pal.neutral; },
    /* one building of a place */
    put(site, gen, x, y, o) {
      o = o || {};
      if (!AS.Models[gen]) return null;
      const g = site.g, pal = o.pal || site._pal;
      const B = new AS.Building(g, 'site', null, x, y, { gen, team: 'neutral', instant: true, site, shoots: false, angle: o.angle || 0, v: o.v || 0, level: o.level || 1 });
      B.invuln = true; B.targetable = false; B.burnable = false; B.palOverride = pal;
      const m = AS.Building.meta(gen) || { dirs: 1, anims: 1 };
      const opt = Object.assign({ v: o.v || 0 }, o.level ? { level: o.level } : null, o.opt || null);
      B.sheet = AS.Building.sheetFor(gen, pal, opt, m.dirs, m.anims);
      B.dirs = m.dirs; B.angle = o.angle || 0; B.sopt = opt; B.sdirs = m.dirs; B.sanims = m.anims;
      if (o.solid === false || m.dirs > 1) { const i = g.solids.indexOf(B); if (i >= 0) g.solids.splice(i, 1); B.solid = false; }
      g.buildings.push(B); site.structures.push(B);
      // trees keep off the building (laid once: a place built again keeps them)
      if (!site.marked && o.clear !== false) g.terrain.clearAreas.push({ x, y, r: o.r || 22 });
      return B;
    },
    // a run of 16-direction pieces (walls, fences, hedges) from a to b
    run(site, gen, a, b, step, o) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step)), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; this.put(site, gen, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Object.assign({ angle: ang, r: step * 0.6 }, o)); }
    },
    decal(site, kind, x, y, r, o) { site.g.terrain.addDecal(kind, x, y, r, null, Object.assign({ static: true, seed: (x * 3 + y * 7) | 0 }, o)); },
    // is the ground at (x, y) dry and not too steep for a building?
    dry(site, x, y) { const T = site.g.terrain; return T.groundPassable(x, y) && T.kindFast(x, y) === 0 && T.gs(T.gWater, x, y) > 30; },

    build(site, rng) {
      const cul = this.culture(site);
      site.culture = cul;
      site._pal = this.pal(cul);
      const k = site.def.compose, f = this[k];
      if (f) f.call(this, site, rng, cul);
      site._pal = null;
    },

    /* ---------------- the houses of a town round its square ---------------- */
    houses(site, rng, cul, R, o) {
      o = o || {};
      const x = site.x, y = site.y, set = SET[cul] || 'human', gate = site.spec.gate !== undefined ? site.spec.gate : rng.range(0, TAU);
      const spokes = o.spokes || 4, ringR = R * 0.55, placed = [], streets = [];
      const free = (px, py, d) => { for (const q of placed) if (Math.hypot(q[0] - px, q[1] - py) < d) return false; for (const q of o.keep || []) if (Math.hypot(q[0] - px, q[1] - py) < q[2]) return false; return true; };
      const house = (px, py, a, far) => {
        if (!free(px, py, 27) || !this.dry(site, px, py)) return;
        placed.push([px, py]);
        const roll = rng.next();
        let gen, v;
        if (far && roll < 0.22) { gen = set + (rng.next() < 0.5 ? '_shed' : '_granary'); v = rng.int(0, 3); }
        else if (roll < (far ? 0.55 : 0.4)) { gen = set + '_house'; v = rng.int(0, 3); }
        else { gen = set + '_house2'; v = rng.int(0, 3); }
        this.put(site, gen, px, py, { v, r: 18 });
      };
      const angles = [];
      for (let i = 0; i < spokes; i++) angles.push(gate + i / spokes * TAU + (i ? rng.range(-0.25, 0.25) : 0));
      for (const a of angles) {
        const ln = [];
        for (let r = R * 0.18; r <= R * 1.08; r += 30) {
          const aa = a + Math.sin(r / R * 3 + a) * 0.05;
          ln.push([Math.cos(aa) * r, Math.sin(aa) * r * 0.86]);
          if (r < R * 0.26) continue;
          for (const side of [-1, 1]) { const off = side * (22 + rng.range(0, 4)); house(x + Math.cos(aa) * r - Math.sin(aa) * off, y + (Math.sin(aa) * r + Math.cos(aa) * off) * 0.86, aa, r > R * 0.72); }
        }
        streets.push(ln);
      }
      const ring = [];
      for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; ring.push([Math.cos(a) * ringR, Math.sin(a) * ringR * 0.86]); }
      streets.splice(1, 0, ring);
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * TAU;
        if (angles.some((s) => Math.abs(U.wrapAngle(a - s)) < 0.18)) continue;
        for (const side of [-1, 1]) { const r = ringR + side * (24 + rng.range(0, 4)); house(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.86, a, false); }
      }
      this.decal(site, 'streets', x, y, R * 1.15, { fk: cul === 'dwarf' ? 'neutral' : cul, streets, R: R * 1.1, gateA: gate, gateR: R * 1.05 });
      return { gate, placed };
    },
    // fields, a windmill and a pasture with its herd round a settlement
    farmland(site, rng, R, n, herdKind) {
      const x = site.x, y = site.y, T = site.g.terrain, fields = [];
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, TAU), r = R + rng.range(40, 160), fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r * 0.86;
        if (!this.dry(site, fx, fy) || T.roadDist(fx, fy) < 36) continue;
        const f = { x: fx, y: fy, w: 64 + rng.range(-8, 30), h: 40 + rng.range(-4, 16), rot: a + Math.PI / 2 + rng.range(-0.3, 0.3), crop: ['wheat', 'barley', 'green', 'plough', 'flax'][rng.int(0, 4)] };
        fields.push(f);
        this.decal(site, 'field', fx, fy, Math.max(f.w, f.h) * 0.6, { fw: f.w, fh: f.h, rot: f.rot, crop: f.crop });
      }
      const wa = rng.range(0, TAU), wx = x + Math.cos(wa) * (R + 70), wy = y + Math.sin(wa) * (R + 60);
      if (this.dry(site, wx, wy)) this.put(site, 'site_windmill', wx, wy, { r: 30 });
      if (herdKind) {
        const pa = wa + Math.PI, px = x + Math.cos(pa) * (R + 90), py = y + Math.sin(pa) * (R + 80);
        if (this.dry(site, px, py)) { this.decal(site, 'pasture', px, py, 90, { fk: 'human' }); site.herd = AS.Life.herd(site.g, herdKind, px, py, 6, null, 80); }
      }
      return fields;
    },
    people(site, n, r, fields) { AS.Life.addPeople(site.g, 'neutral', site.x, site.y, r, n, { pal: AS.Data.pal.neutral, fields: fields || null }); site.people = true; },

    /* ---------------- the layouts ---------------- */
    town(site, rng, cul) {
      const x = site.x, y = site.y, set = SET[cul] || 'human';
      this.decal(site, 'plaza', x, y + 4, 62, { fk: cul });
      this.put(site, set + '_market', x, y - 10, { r: 34 });
      const ca = rng.range(0, TAU), cx = x + Math.cos(ca) * 90, cy = y + Math.sin(ca) * 70;
      this.put(site, set + '_temple', cx, cy, { r: 32 });
      this.put(site, 'site_well', x + 36, y + 30, { solid: false, r: 10 });
      this.put(site, 'prop_stall', x - 40, y + 24, { v: 0, solid: false }); this.put(site, 'prop_stall', x + 2, y + 40, { v: 1, solid: false });
      this.houses(site, rng, cul, 230, { spokes: 4, keep: [[x, y, 74], [cx, cy, 52]] });
      const fields = this.farmland(site, rng, 280, 7, rng.next() < 0.5 ? 'cow' : 'sheep');
      this.people(site, 14, 220, fields);
    },
    walledtown(site, rng, cul) {
      const x = site.x, y = site.y, set = SET[cul] || 'human', R = 300;
      this.decal(site, 'plaza', x, y + 4, 70, { fk: cul });
      this.put(site, set + '_market', x, y - 10, { r: 34 });
      const ca = rng.range(0, TAU), cx = x + Math.cos(ca) * 100, cy = y + Math.sin(ca) * 80;
      this.put(site, set + '_temple', cx, cy, { r: 32 });
      this.put(site, set + '_magetower', x + Math.cos(ca + 2.4) * 110, y + Math.sin(ca + 2.4) * 90, { r: 20, opt: { level: 1 } });
      this.put(site, 'site_well', x + 40, y + 34, { solid: false, r: 10 });
      const h = this.houses(site, rng, cul, R - 40, { spokes: 5, keep: [[x, y, 80], [cx, cy, 52]] });
      this.walls(site, R, h.gate, set, 2);
      const fields = this.farmland(site, rng, R + 60, 9, 'cow');
      this.people(site, 18, R * 0.8, fields);
    },
    // a ring of walls (radius R, squashed as the view is) with towers and a gatehouse facing angle `gate`
    walls(site, R, gate, set, level) {
      const x = site.x, y = site.y, n = Math.round(TAU * R / 32);
      for (let i = 0; i < n; i++) {
        const a = gate + i / n * TAU, px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * 0.86, ang = Math.atan2(Math.cos(a) * 0.86, -Math.sin(a));
        if (i === 0) this.put(site, set + '_gate', px, py, { angle: ang, level, r: 26, clear: false });
        else this.put(site, set + '_wall', px, py, { angle: ang, level, r: 20, clear: false });
        if (i % 7 === 3) this.put(site, set + '_tower', x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4) * 0.86, { r: 18, level: 1 });
      }
    },
    stronghold(site, rng, cul) {
      const x = site.x, y = site.y, set = SET[cul] || 'human', H = 150;
      this.decal(site, 'plaza', x, y + 10, 128, { fk: cul });
      this.put(site, set + '_keep', x, y - 16, { level: 3, r: 70 });
      // the curtain: a square of walls, corner towers, flanking towers and a gatehouse in the south wall
      const c = [[-H, -H * 0.86], [H, -H * 0.86], [H, H * 0.86], [-H, H * 0.86]];
      for (let s = 0; s < 4; s++) {
        const a = c[s], b = c[(s + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 40), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, px = x + a[0] + (b[0] - a[0]) * t, py = y + a[1] + (b[1] - a[1]) * t;
          const gate = s === 2 && i === Math.floor(n / 2);
          this.put(site, set + (gate ? '_gate' : '_wall'), px, py, { angle: ang, level: 2, r: 22, clear: false });
          if (!gate && i === Math.floor(n / 2) && s !== 2) this.put(site, set + '_tower', px + Math.cos(ang - Math.PI / 2) * 6, py + Math.sin(ang - Math.PI / 2) * 6, { r: 18 });
        }
        this.put(site, set + '_tower', x + a[0], y + a[1], { r: 20 });
      }
      // the bailey
      this.put(site, set + '_barracks', x - 92, y + 40, { r: 30 });
      this.put(site, set + '_stable', x + 92, y + 44, { r: 30 });
      this.put(site, set + '_temple', x + 86, y - 70, { r: 28 });
      this.put(site, set + '_workshop', x - 90, y - 68, { r: 28 });
      this.put(site, 'prop_banner', x - 24, y + 70, { r: 6, solid: false }); this.put(site, 'prop_banner', x + 24, y + 70, { r: 6, solid: false });
      // a village outside the gate, along the road
      const ga = Math.PI / 2;
      for (let i = 0; i < 10; i++) {
        const r = 220 + (i >> 1) * 34, side = i % 2 ? -1 : 1, px = x + Math.cos(ga) * r + side * 32, py = y + Math.sin(ga) * r * 0.86;
        if (this.dry(site, px, py)) this.put(site, set + (rng.next() < 0.5 ? '_house' : '_house2'), px, py, { v: rng.int(0, 3), r: 18 });
      }
      const fields = this.farmland(site, rng, 300, 8, 'cow');
      this.people(site, 10, 240, fields);
    },
    abbey(site, rng, cul) {
      const x = site.x, y = site.y;
      this.put(site, 'ab_abbey', x, y, { r: 70 });
      // the cloister to the north: a walled garth with a well, and the monks' range
      const cx = x + 10, cy = y - 96, w = 70, h = 48;
      const sq = [[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h]];
      for (let s = 0; s < 4; s++) if (s !== 2) this.run(site, 'lm_stonewall', sq[s], sq[(s + 1) % 4], 26);
      this.decal(site, 'plaza', cx, cy, 44, { fk: 'neutral' });
      this.put(site, 'site_well', cx, cy, { solid: false, r: 10 });
      this.put(site, (SET[cul] || 'human') + '_house2', cx - w - 30, cy, { v: 0, r: 20 });
      this.put(site, (SET[cul] || 'human') + '_granary', cx + w + 30, cy + 10, { v: 1, r: 20 });
      // the graveyard south-east of the church
      for (let i = 0; i < 14; i++) this.put(site, 'prop_gravestone', x + 50 + (i % 5) * 12 + rng.range(-3, 3), y + 54 + Math.floor(i / 5) * 12 + rng.range(-2, 2), { v: i % 4, solid: false, r: 6, clear: false });
      this.run(site, 'lm_stonewall', [x + 36, y + 42], [x + 120, y + 42], 26); this.run(site, 'lm_stonewall', [x + 120, y + 42], [x + 120, y + 100], 26);
      // gardens and orchards
      for (let i = 0; i < 4; i++) this.decal(site, 'field', x - 90 + i * 34, y + 80, 22, { fw: 28, fh: 40, rot: 0, crop: ['green', 'flax', 'barley', 'green'][i] });
      for (let i = 0; i < 6; i++) this.put(site, 'tree_fruit', x - 140 + (i % 3) * 22, y - 30 + Math.floor(i / 3) * 24, { v: i, r: 10, solid: false });
      this.people(site, 6, 150, null);
    },
    elfvillage(site, rng, cul) {
      const x = site.x, y = site.y, set = 'elf';
      site._pal = AS.Data.pal.elf;
      this.put(site, 'lm_great_tree', x, y - 20, { r: 60 });
      this.put(site, 'lm_forest_pool', x + 70, y + 60, { r: 30, solid: false });
      this.put(site, set + '_temple', x - 110, y + 30, { r: 32 });
      this.put(site, set + '_magetower', x + 120, y - 60, { r: 20, opt: { level: 1 } });
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + rng.range(-0.2, 0.2), r = 150 + rng.range(-20, 70), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.86;
        if (this.dry(site, px, py)) this.put(site, set + (rng.next() < 0.5 ? '_house' : '_house2'), px, py, { v: rng.int(0, 3), r: 18 });
      }
      for (let i = 0; i < 10; i++) { const a = rng.range(0, TAU), r = rng.range(40, 230); this.put(site, 'mushrooms_glow', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.86, { v: i, solid: false, r: 4, clear: false }); }
      this.decal(site, 'trample', x, y, 200, { fk: 'elf' });
      this.people(site, 8, 200, null);
    },
    dwarfhold(site, rng, cul) {
      const x = site.x, y = site.y;
      site._pal = DWARF;
      // the gate faces the open ground (spec.face: angle away from the mountain; default south)
      this.put(site, 'dw_gate', x, y - 110, { r: 90 });
      this.decal(site, 'plaza', x, y + 10, 90, { fk: 'ice' });
      this.put(site, 'dw_hall', x - 120, y + 40, { v: 0, r: 30 });
      this.put(site, 'dw_hall', x + 120, y + 30, { v: 0, r: 30 });
      this.put(site, 'dw_hall', x - 30, y + 140, { v: 1, r: 24 });
      this.put(site, 'dw_hall', x + 80, y + 150, { v: 0, r: 30 });
      this.put(site, 'site_goldmine', x + 200, y - 30, { r: 40 });
      this.put(site, 'lm_brazier_huge', x - 50, y + 40, { r: 10 }); this.put(site, 'lm_brazier_huge', x + 50, y + 40, { r: 10 });
      this.put(site, 'prop_crates', x + 160, y + 20, { solid: false }); this.put(site, 'prop_barrels', x + 175, y + 50, { solid: false });
      this.put(site, 'prop_cart', x + 150, y - 10, { angle: 0.3, solid: false });
      this.put(site, 'prop_statue', x, y + 60, { v: 1, r: 10 });
      this.people(site, 8, 170, null);
    },
    shire(site, rng, cul) {
      const x = site.x, y = site.y;
      site._pal = AS.Data.pal.neutral;
      // a winding lane with burrows dug into the banks either side
      const lane = [], a0 = rng.range(0, TAU);
      for (let i = 0; i <= 10; i++) { const t = i / 10 - 0.5, a = a0 + Math.sin(t * 3) * 0.5; lane.push([x + Math.cos(a0) * t * 520 + Math.cos(a0 + Math.PI / 2) * Math.sin(t * 5) * 60, y + (Math.sin(a0) * t * 520 + Math.sin(a0 + Math.PI / 2) * Math.sin(t * 5) * 60) * 0.86]); }
      site.g.terrain.addDecal('road', lane[0][0], lane[0][1], 20, '#a8946c', { static: true, pts: lane, w: 16, seed: 11 });
      const placed = [];
      for (let i = 1; i < lane.length - 1; i++) for (const side of [-1, 1]) {
        if (rng.next() < 0.2) continue;
        const a = Math.atan2(lane[i + 1][1] - lane[i - 1][1], lane[i + 1][0] - lane[i - 1][0]), off = side * rng.range(42, 62);
        const px = lane[i][0] - Math.sin(a) * off, py = lane[i][1] + Math.cos(a) * off;
        if (!this.dry(site, px, py) || placed.some((q) => Math.hypot(q[0] - px, q[1] - py) < 40)) continue;
        placed.push([px, py]);
        this.put(site, 'hb_burrow', px, py, { v: rng.int(0, 3), r: 26 });
      }
      // hedgerows along the lane, an orchard, a mill and the fields
      for (let i = 1; i < lane.length - 2; i += 2) for (const side of [-1, 1]) {
        const a = lane[i], b = lane[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        this.run(site, 'lm_hedgerow', [a[0] - Math.sin(ang) * side * 22, a[1] + Math.cos(ang) * side * 22], [b[0] - Math.sin(ang) * side * 22, b[1] + Math.cos(ang) * side * 22], 30, { clear: false });
      }
      for (let i = 0; i < 9; i++) { const ox = x + Math.cos(a0 + Math.PI / 2) * 200 + (i % 3) * 24, oy = y + Math.sin(a0 + Math.PI / 2) * 170 + Math.floor(i / 3) * 22; if (this.dry(site, ox, oy)) this.put(site, 'tree_fruit', ox, oy, { v: i, r: 10, solid: false }); }
      const fields = this.farmland(site, rng, 280, 8, 'sheep');
      this.people(site, 12, 260, fields);
    },
    harbour(site, rng, cul) {
      const x = site.x, y = site.y, T = site.g.terrain, set = SET[cul] || 'human';
      // which way is the water? (the direction where it is deepest within a few hundred units)
      let best = 0, bw = 1e9;
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; let w = 0; for (const r of [200, 300, 400]) w += T.gs(T.gWater, x + Math.cos(a) * r, y + Math.sin(a) * r); if (w < bw) { bw = w; best = a; } }
      site.waterA = best;
      // the shore: walk out until the water starts
      let shore = 60;
      for (let r = 40; r < 420; r += 10) { if (T.gs(T.gWater, x + Math.cos(best) * r, y + Math.sin(best) * r) < 8) { shore = r; break; } }
      const sx = x + Math.cos(best) * (shore - 20), sy = y + Math.sin(best) * (shore - 20);
      for (const off of [-70, 30]) {
        const px = sx - Math.sin(best) * off, py = sy + Math.cos(best) * off;
        this.put(site, 'hr_pier', px, py, { angle: best, r: 10, clear: false });
        const bx = px + Math.cos(best) * 40 - Math.sin(best) * 22, by = py + Math.sin(best) * 40 + Math.cos(best) * 22;
        this.put(site, 'hr_boat', bx, by, { angle: best + Math.PI / 2 + rng.range(-0.2, 0.2), v: rng.int(0, 2), clear: false, solid: false });
      }
      this.put(site, 'hr_boat', sx + Math.cos(best) * 150, sy + Math.sin(best) * 150, { angle: best + 1.2, v: 1, clear: false, solid: false });
      // the town crowds down to the water: warehouses along the quay, the market behind them, houses round it
      const back = best + Math.PI, qx = sx + Math.cos(back) * 80, qy = sy + Math.sin(back) * 80;
      this.decal(site, 'plaza', qx, qy, 70, { fk: cul });
      for (let i = 0; i < 4; i++) { const off = (i - 1.5) * 62 + (i > 1 ? 40 : -40), px = qx - Math.sin(best) * off, py = qy + Math.cos(best) * off; if (this.dry(site, px, py)) this.put(site, set + '_granary', px, py, { v: i, r: 20 }); }
      for (let i = 0; i < 4; i++) this.put(site, i % 2 ? 'prop_crates' : 'prop_barrels', sx + Math.cos(back) * 30 - Math.sin(best) * (i * 26 - 40), sy + Math.sin(back) * 30 + Math.cos(best) * (i * 26 - 40), { solid: false, clear: false });
      const mx = qx + Math.cos(back) * 110, my = qy + Math.sin(back) * 95;
      this.put(site, set + '_market', mx, my, { r: 32 });
      for (let i = 0; i < 14; i++) {
        const a = back + rng.range(-1.3, 1.3), r = rng.range(90, 230), px = mx + Math.cos(a) * r, py = my + Math.sin(a) * r * 0.86;
        if (this.dry(site, px, py) && Math.hypot(px - mx, py - my) > 60) this.put(site, set + (rng.next() < 0.5 ? '_house' : '_house2'), px, py, { v: rng.int(0, 3), r: 18 });
      }
      this.people(site, 10, 220, null);
    },
    banditcamp(site, rng) {
      const x = site.x, y = site.y;
      site._pal = AS.Data.pal.neutral;
      this.put(site, 'bd_stockade', x, y, { r: 10, clear: false });
      this.put(site, 'prop_campfire', x, y + 6, { solid: false, r: 8 });
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; this.put(site, 'prop_tent', x + Math.cos(a) * 34, y + Math.sin(a) * 26, { solid: false, r: 14 }); }
      this.put(site, 'prop_crates', x - 20, y - 30, { solid: false }); this.put(site, 'prop_barrels', x + 24, y - 28, { solid: false });
      this.decal(site, 'trample', x, y, 80, { fk: 'neutral' });
      this.decal(site, 'bonefield', x + 50, y + 40, 26);
    },
    farmstead(site, rng, cul) {
      const x = site.x, y = site.y, set = SET[cul] || 'human';
      this.put(site, 'site_cottage', x, y, { v: 2, r: 26 });
      this.put(site, set + '_granary', x + 60, y - 20, { v: rng.int(0, 3), r: 22 });
      this.put(site, set + '_shed', x - 52, y - 24, { v: rng.int(0, 3), r: 16 });
      this.put(site, 'prop_haystack', x + 40, y + 40, { solid: false }); this.put(site, 'prop_haystack', x + 62, y + 30, { solid: false });
      this.put(site, 'site_well', x - 30, y + 30, { solid: false, r: 8 });
      this.run(site, 'prop_fence', [x - 90, y + 60], [x + 90, y + 60], 24, { clear: false });
      const fields = this.farmland(site, rng, 120, 5, 'cow');
      this.people(site, 3, 100, fields);
    },
    inn(site, rng, cul) {
      const x = site.x, y = site.y, set = SET[cul] || 'human';
      this.put(site, set + '_house2', x, y, { v: 3, r: 22 });
      this.put(site, set + '_stable', x + 60, y + 10, { r: 26 });
      this.put(site, 'site_well', x - 34, y + 24, { solid: false, r: 8 });
      this.put(site, 'prop_signpost', x - 10, y + 40, { solid: false, r: 4 });
      this.put(site, 'prop_cart', x + 30, y + 46, { angle: 0.2, solid: false });
      this.decal(site, 'trample', x, y, 70, { fk: cul });
      this.people(site, 4, 80, null);
    },
    dungeon(site, rng) {
      site._pal = AS.Data.pal.neutral;
      this.put(site, 'dg_dungeon', site.x, site.y, { r: 40 });
      this.decal(site, 'bonefield', site.x - 40, site.y + 30, 26);
    },
  };
  AS.Settlements = Settlements;
})(window.AS);
