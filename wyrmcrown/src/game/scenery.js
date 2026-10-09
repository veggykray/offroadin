/* WYRMCROWN — scenery: the places that make the realm worth exploring.
 * Hamlets, orchards, stone circles, battlefields, ruined towers, roadside
 * shrines and deserted camps in the farmland; glades of giant mushrooms,
 * moss-grown ruins, forest pools and an enormous ancient tree in the old
 * forest; rune stones, braziers, a ship frozen into the ice and the frozen
 * dead in the north; graveyards, gallows, dark obelisks, bone totems and bog
 * pools in the blight. Every place is composed (props placed with a reason,
 * plus ground decals), chosen deterministically from the map seed, and kept
 * clear of towns, objective sites, roads and water. Scenery is purely visual:
 * nothing here fights, blocks troops or pays gold — only the biggest
 * landmarks count as solid ground for a dragon trying to land.
 * Models come from models_sites.js, models_nature.js and
 * models_landmarks_realm.js; a missing model is simply skipped. */
'use strict';
(function (AS) {
  const U = AS.U, TAU = U.TAU;
  const BIOMES = ['human', 'elf', 'ice', 'undead', 'neutral'];

  /* ---------------- a prop ---------------- */
  class Prop {
    constructor(g, gen, x, y, o) {
      o = o || {};
      this.g = g; this.gen = gen; this.x = x; this.y = y;
      this.opt = o.opt || {}; this.pal = o.pal || AS.Data.pal.neutral;
      this.angle = o.angle || 0;
      this.scale = o.scale || 1;
      this.light = o.light || null; // { col, r, a, z, pulse }
      this.solid = !!o.solid;
      this.sortOff = o.sortOff || 0;
      this.alive = true;
      this.anim = Math.random() * 4;
      this.sheet = AS.Building.sheetFor(gen, this.pal, this.opt, o.dirs || 1, o.anims || 1);
      this.dirs = this.sheet.dirs;
      this.r = o.r || Math.max(6, this.sheet.w * 0.35);
      this.viewR = Math.max(60, this.sheet.w * 0.7 * this.scale);
      this.isScenery = true;
      this.decor = !!o.decor; // flat things that belong under everything else
    }
    get sortY() { return this.y + this.sortOff; }
    drawShadow(ctx, ox, oy) {
      if (this.decor) return;
      const sh = this.sheet, di = this.dirs > 1 ? AS.Forge.frameIndex(sh, this.angle) : 0, sc = this.scale;
      ctx.drawImage(sh.shadows[di], this.x - ox - sh.ax * sc + 3, this.y - oy - sh.ay * sc + 1.6, sh.w * sc, sh.h * sc);
    }
    draw(ctx, ox, oy, R) {
      const sh = this.sheet, di = this.dirs > 1 ? AS.Forge.frameIndex(sh, this.angle) : 0, sc = this.scale;
      this.anim += 0.06;
      const ai = sh.anims > 1 ? Math.floor(this.anim) % sh.anims : 0;
      ctx.drawImage(sh.frames[ai][di], this.x - ox - sh.ax * sc, this.y - oy - sh.ay * sc, sh.w * sc, sh.h * sc);
      const L = this.light;
      if (L) R.light(this.x, this.y - (L.z || sh.ay * 0.5), L.r, L.col, L.a * (L.pulse ? 0.8 + 0.2 * Math.sin(this.anim * 1.7) : 1));
    }
  }

  /* ---------------- placement helpers ---------------- */
  const ctxOf = (g, rng, bb) => {
    const T = g.terrain;
    // (bb: one area of a streamed map — only what is near it is checked)
    const near = (q) => !bb || (q.x > bb[0] - 1600 && q.x < bb[2] + 1600 && q.y > bb[1] - 1600 && q.y < bb[3] + 1600);
    const sites = g.sites.filter(near).map((s) => ({ x: s.x, y: s.y, r: (s.def.r || 40) + 230 }));
    const towns = g.factionList.map((F) => ({ x: F.townPos.x, y: F.townPos.y, r: 1250 })).filter(near);
    const runes = (g.runes || []).filter(near).map((q) => ({ x: q.x, y: q.y, r: 90 }));
    const placed = [];
    const far = (list, x, y, extra) => { for (const o of list) { const dx = o.x - x, dy = o.y - y, rr = o.r + (extra || 0); if (dx * dx + dy * dy < rr * rr) return false; } return true; };
    return {
      g, T, rng, placed,
      water: (x, y) => T.gs(T.gWater, x, y),
      mount: (x, y) => T.gs(T.gMount, x, y),
      forest: (x, y) => T.gs(T.gForest, x, y),
      road: (x, y) => T.gs(T.gRoad, x, y),
      biome: (x, y) => T.biomeKey(x, y),
      frozen: (x, y) => T.frozenAt(x, y),
      onMap: (x, y, m) => x > (m || 200) && y > (m || 200) && x < g.map.w - (m || 200) && y < g.map.h - (m || 200),
      clear: (x, y, r) => far(sites, x, y) && far(towns, x, y) && far(runes, x, y) && far(placed, x, y, r || 0),
      flat: (x, y, r) => {
        // level ground: the terrace level agrees around the spot
        const f = new Float32Array(4), lv = (xx, yy) => T.levelOf(T.field(xx, yy, f)[0]);
        const l = lv(x, y);
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6; if (lv(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8) !== l) return false; }
        return true;
      },
      has: (gen) => !!AS.Models[gen],
    };
  };

  /* ---------------- the places ----------------
   * Each: biome(s), how many per map (per 10k × 10k), a test for a spot and a
   * builder that places props and decals around it. */
  const PLACES = [
    /* ===== Aldermere and the heartland ===== */
    { id: 'hamlet', biomes: ['human', 'neutral'], n: 3, r: 150,
      ok: (c, x, y) => c.water(x, y) > 120 && c.mount(x, y) < 0.3 && c.road(x, y) > 70 && c.road(x, y) < 420 && c.flat(x, y, 120),
      build: (c, x, y, P) => {
        const rng = c.rng, n = 3 + (rng.next() * 2 | 0), a0 = rng.next() * TAU;
        for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU + rng.range(-0.25, 0.25), r = 50 + rng.range(0, 24); P('site_cottage', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82, { opt: { v: i % 4 }, solid: true }); }
        P('site_well', x + 8, y + 14, { r: 8 });
        P('prop_haystack', x + Math.cos(a0 + 1.1) * 95, y + Math.sin(a0 + 1.1) * 80, {});
        P('prop_logs', x + Math.cos(a0 - 1.4) * 90, y + Math.sin(a0 - 1.4) * 76, {});
        fence(c, P, x + Math.cos(a0 + 2.6) * 120, y + Math.sin(a0 + 2.6) * 100, 60, a0 + 2.6 + Math.PI / 2, 'prop_fence');
        c.T.addDecal('field', x + Math.cos(a0 + 2.6) * 150, y + Math.sin(a0 + 2.6) * 125, 50, null, { static: true, fw: 76, fh: 48, rot: a0 + 2.6 + Math.PI / 2, crop: ['wheat', 'barley', 'green'][(rng.next() * 3) | 0], seed: (x + y) | 0 });
        c.T.addDecal('trample', x, y, 120, null, { static: true, seed: (x * 3 + y) | 0, fk: 'human' });
        AS.Life.addPeople(c.g, 'neutral', x, y, 110, 4, { pal: AS.Data.pal.neutral });
      } },
    { id: 'orchard', biomes: ['human'], n: 3, r: 110,
      ok: (c, x, y) => c.water(x, y) > 90 && c.mount(x, y) < 0.25 && c.road(x, y) > 60 && c.forest(x, y) < 0.3 && c.flat(x, y, 90),
      build: (c, x, y, P) => {
        const rng = c.rng, a = rng.range(-0.4, 0.4), ca = Math.cos(a), sa = Math.sin(a);
        for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const ox = i * 34 + rng.range(-3, 3), oy = j * 36 + rng.range(-3, 3); P('tree_fruit', x + ox * ca - oy * sa, y + ox * sa + oy * ca, { opt: { seed: (i * 3 + j + 9) }, decor: false, sortOff: 0 }); }
        hedge(c, P, x, y, 190, 130, a);
        P('prop_crates', x + 100 * ca + 60 * sa, y + 100 * sa - 60 * ca, {});
      } },
    { id: 'stonecircle', biomes: ['human', 'neutral'], n: 2, r: 90,
      ok: (c, x, y) => c.water(x, y) > 120 && c.road(x, y) > 120 && c.forest(x, y) < 0.35 && c.flat(x, y, 70),
      build: (c, x, y, P) => {
        if (c.has('lm_stonecircle')) { P('lm_stonecircle', x, y, { solid: true }); }
        else for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; P('rock_mossy', x + Math.cos(a) * 46, y + Math.sin(a) * 38, { opt: { seed: i }, scale: 2.2 }); }
        c.T.addDecal('trample', x, y, 70, null, { static: true, seed: (x + y * 3) | 0, fk: 'neutral' });
      } },
    { id: 'ruinedtower', biomes: ['human', 'neutral'], n: 3, r: 80,
      ok: (c, x, y) => c.water(x, y) > 80 && c.road(x, y) > 90 && c.flat(x, y, 50),
      build: (c, x, y, P) => {
        const rng = c.rng;
        if (c.has('lm_ruined_tower')) P('lm_ruined_tower', x, y, { opt: { v: (rng.next() * 3) | 0 }, solid: true });
        else P('site_ruins', x, y, { solid: true });
        if (c.has('lm_ruined_wall')) { const a = rng.next() * TAU; P('lm_ruined_wall', x + Math.cos(a) * 46, y + Math.sin(a) * 40, { angle: a + Math.PI / 2, dirs: 16 }); }
        P('bush', x + 30, y + 24, { opt: { seed: 2 } }); P('rock_mossy', x - 34, y + 18, { opt: { seed: 5 } });
      } },
    { id: 'battlefield', biomes: ['human', 'neutral'], n: 2, r: 130,
      ok: (c, x, y) => c.water(x, y) > 100 && c.road(x, y) > 80 && c.forest(x, y) < 0.3 && c.flat(x, y, 100),
      build: (c, x, y, P) => {
        const rng = c.rng;
        c.T.addDecal('battlefield', x, y, 130, null, { static: true, seed: (x * 7 + y) | 0 });
        for (let i = 0; i < 5; i++) { const a = rng.next() * TAU, r = 30 + rng.next() * 80; P('bones_pile', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, { opt: { seed: i } }); }
        if (c.has('lm_wagon_wreck')) P('lm_wagon_wreck', x + 40, y - 30, {}); else P('prop_cart', x + 40, y - 30, { angle: 0.6, dirs: 16 });
        P('prop_banner', x - 50, y + 20, { anims: 4, pal: AS.Data.pal.neutral });
        P('prop_banner', x + 70, y + 60, { anims: 4, pal: AS.Data.pal.human });
        for (let i = 0; i < 3; i++) P('tree_dead', x + rng.range(-110, 110), y + rng.range(-70, 90), { opt: { seed: i + 3 } });
      } },
    { id: 'wayshrine', biomes: ['human', 'neutral'], n: 4, r: 30,
      ok: (c, x, y) => c.road(x, y) > 34 && c.road(x, y) < 48 && c.water(x, y) > 60,
      build: (c, x, y, P) => { if (c.has('lm_wayshrine')) P('lm_wayshrine', x, y, { light: { col: '#ffb060', r: 22, a: 0.3, z: 6, pulse: true } }); else P('prop_statue', x, y, {}); P('flowers', x + 12, y + 8, { opt: { seed: 1 } }); } },
    { id: 'camp', biomes: ['human', 'neutral', 'ice'], n: 3, r: 70,
      ok: (c, x, y) => c.water(x, y) > 70 && c.road(x, y) > 90 && c.road(x, y) < 500 && c.flat(x, y, 50),
      build: (c, x, y, P) => {
        if (c.has('lm_camp_deserted')) P('lm_camp_deserted', x, y, {});
        else { P('prop_tent', x - 26, y - 10, {}); P('prop_tent', x + 24, y + 12, {}); P('prop_campfire', x, y + 20, { anims: 4, light: { col: '#ff9a40', r: 40, a: 0.45, z: 4, pulse: true } }); }
        P('prop_logs', x + 44, y - 20, {}); P('prop_barrels', x - 44, y + 24, {});
        c.T.addDecal('trample', x, y + 6, 60, null, { static: true, seed: (x + y) | 0, fk: 'neutral' });
      } },
    { id: 'burnedfarm', biomes: ['human', 'neutral'], n: 1, r: 80,
      ok: (c, x, y) => c.water(x, y) > 90 && c.road(x, y) > 70 && c.road(x, y) < 400 && c.flat(x, y, 60),
      build: (c, x, y, P) => {
        if (c.has('lm_burned_farm')) P('lm_burned_farm', x, y, { solid: true, light: { col: '#ff7a30', r: 14, a: 0.22, z: 2, pulse: true } }); else P('site_ruins', x, y, { solid: true });
        c.T.addDecal('scorch', x, y + 4, 42, null, { static: true, seed: 3 });
        c.T.addDecal('field', x + 90, y + 40, 50, null, { static: true, fw: 70, fh: 44, rot: 0.3, crop: 'plough', seed: (x + y) | 0 });
        fence(c, P, x - 70, y + 30, 50, 1.2, 'prop_fence');
        P('bones_pile', x + 30, y + 30, { opt: { seed: 7 } });
      } },
    { id: 'colossus', biomes: ['human', 'neutral'], n: 1, r: 120,
      ok: (c, x, y) => c.has('lm_colossus_statue') && c.water(x, y) > 100 && c.road(x, y) > 100 && c.forest(x, y) < 0.3 && c.flat(x, y, 60),
      build: (c, x, y, P) => { P('lm_colossus_statue', x, y, { solid: true }); c.T.addDecal('plaza', x, y + 10, 60, null, { static: true, fk: 'neutral', seed: 9 }); for (let i = 0; i < 4; i++) P('flowers', x + Math.cos(i * 1.6) * 44, y + Math.sin(i * 1.6) * 36, { opt: { seed: i } }); } },
    { id: 'brokenstatue', biomes: ['human', 'neutral', 'elf'], n: 1, r: 90,
      ok: (c, x, y) => c.has('lm_broken_statue') && c.water(x, y) > 80 && c.road(x, y) > 90 && c.flat(x, y, 50),
      build: (c, x, y, P) => { P('lm_broken_statue', x, y, { solid: true }); P('bush', x + 40, y + 20, { opt: { seed: 4 } }); P('bush_berry', x - 46, y + 10, { opt: { seed: 2 } }); } },
    { id: 'dragonbones', biomes: ['human', 'neutral', 'ice', 'undead'], n: 1, r: 120,
      ok: (c, x, y) => c.has('lm_dragon_skeleton') && c.water(x, y) > 110 && c.road(x, y) > 110 && c.forest(x, y) < 0.3 && c.flat(x, y, 80),
      build: (c, x, y, P) => { P('lm_dragon_skeleton', x, y, { solid: true }); c.T.addDecal('bonefield', x, y, 110, null, { static: true, seed: (x + y) | 0 }); } },
    { id: 'foundation', biomes: ['human', 'neutral', 'elf'], n: 2, r: 60,
      ok: (c, x, y) => c.has('lm_old_foundation') && c.water(x, y) > 70 && c.road(x, y) > 70 && c.flat(x, y, 45),
      build: (c, x, y, P) => { P('lm_old_foundation', x, y, { decor: true }); P('rock_mossy', x + 30, y - 10, { opt: { seed: 3 } }); } },

    /* ===== Sylvara ===== */
    { id: 'greattree', biomes: ['elf'], n: 1, r: 160,
      ok: (c, x, y) => c.has('lm_great_tree') && c.water(x, y) > 120 && c.road(x, y) > 120 && c.mount(x, y) < 0.3 && c.flat(x, y, 70),
      build: (c, x, y, P) => { P('lm_great_tree', x, y, { solid: true, light: { col: '#9affd0', r: 120, a: 0.2, z: 70, pulse: true } }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; P('mushrooms_glow', x + Math.cos(a) * 70, y + Math.sin(a) * 58, { opt: { seed: i } }); } } },
    { id: 'mushroomglade', biomes: ['elf'], n: 4, r: 90,
      ok: (c, x, y) => c.water(x, y) > 60 && c.road(x, y) > 70 && c.flat(x, y, 50),
      build: (c, x, y, P) => {
        const rng = c.rng, n = 3 + (rng.next() * 3 | 0);
        for (let i = 0; i < n; i++) { const a = rng.next() * TAU, r = 14 + rng.next() * 52; const v = (rng.next() * 3) | 0; if (c.has('lm_giant_mushroom')) P('lm_giant_mushroom', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, { opt: { v }, light: { col: '#b0a0ff', r: 30 + v * 10, a: 0.25, z: 10 + v * 8, pulse: true } }); else P('mushrooms_glow', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, { opt: { seed: i }, scale: 1.8 }); }
        c.T.addDecal('fairyring', x, y, 60, null, { static: true, seed: (x + y) | 0 });
      } },
    { id: 'mossruin', biomes: ['elf'], n: 2, r: 100,
      ok: (c, x, y) => c.water(x, y) > 80 && c.road(x, y) > 90 && c.flat(x, y, 60),
      build: (c, x, y, P) => { if (c.has('lm_moss_ruin')) P('lm_moss_ruin', x, y, { solid: true }); else P('site_ruins', x, y, { solid: true }); if (c.has('lm_statue_forgotten')) P('lm_statue_forgotten', x + 60, y + 30, { light: { col: '#7affd8', r: 14, a: 0.3, z: 36 } }); P('mushrooms_glow', x - 40, y + 30, { opt: { seed: 2 } }); } },
    { id: 'foresttemple', biomes: ['elf'], n: 1, r: 110,
      ok: (c, x, y) => c.has('lm_forest_temple') && c.water(x, y) > 80 && c.road(x, y) > 90 && c.flat(x, y, 60),
      build: (c, x, y, P) => { P('lm_forest_temple', x, y, { solid: true, light: { col: '#7affd8', r: 60, a: 0.3, z: 18, pulse: true } }); for (let i = 0; i < 2; i++) if (c.has('lm_statue_forgotten')) P('lm_statue_forgotten', x + (i ? 70 : -70), y + 40, { light: { col: '#7affd8', r: 14, a: 0.3, z: 36 } }); } },
    { id: 'forestpool', biomes: ['elf'], n: 3, r: 70,
      ok: (c, x, y) => c.water(x, y) > 100 && c.road(x, y) > 70 && c.flat(x, y, 45),
      build: (c, x, y, P) => {
        if (c.has('lm_forest_pool')) P('lm_forest_pool', x, y, { decor: true }); else c.T.addDecal('swamppool', x, y, 36, null, { static: true, seed: (x + y) | 0, clear: true });
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.5; P('reeds', x + Math.cos(a) * 40, y + Math.sin(a) * 32, { opt: { seed: i } }); }
        P('flowers', x + 36, y - 22, { opt: { seed: 3 } }); P('rock_mossy', x - 38, y + 24, { opt: { seed: 6 } });
      } },
    { id: 'colossalstump', biomes: ['elf'], n: 1, r: 70,
      ok: (c, x, y) => c.has('lm_colossal_stump') && c.water(x, y) > 70 && c.road(x, y) > 70 && c.flat(x, y, 40),
      build: (c, x, y, P) => { P('lm_colossal_stump', x, y, { solid: true }); P('mushrooms_glow', x + 34, y + 20, { opt: { seed: 1 } }); } },

    /* ===== Hrimgard ===== */
    { id: 'runestone', biomes: ['ice'], n: 3, r: 60,
      ok: (c, x, y) => c.water(x, y) > 60 && c.road(x, y) > 60 && c.flat(x, y, 40),
      build: (c, x, y, P) => {
        if (c.has('lm_carved_stone')) P('lm_carved_stone', x, y, { solid: true, light: { col: '#8ad8ff', r: 16, a: 0.25, z: 20, pulse: true } }); else P('rock_snow', x, y, { opt: { seed: 1 }, scale: 2 });
        const br = c.has('lm_brazier_huge') ? 'lm_brazier_huge' : 'prop_campfire';
        P(br, x - 34, y + 24, { anims: 4, light: { col: '#8ad8ff', r: 44, a: 0.5, z: 12, pulse: true } });
        P(br, x + 34, y + 24, { anims: 4, light: { col: '#8ad8ff', r: 44, a: 0.5, z: 12, pulse: true } });
      } },
    { id: 'frozenship', biomes: ['ice'], n: 1, r: 110,
      ok: (c, x, y) => c.has('lm_frozen_ship') && c.water(x, y) < -40 && c.frozen(x, y),
      build: (c, x, y, P) => { P('lm_frozen_ship', x, y, { solid: true }); for (let i = 0; i < 3; i++) P('ice_shard', x + 50 + i * 18, y + 30 - i * 10, { opt: { seed: i } }); } },
    { id: 'iceformation', biomes: ['ice'], n: 3, r: 70,
      ok: (c, x, y) => c.water(x, y) > 40 && c.road(x, y) > 60,
      build: (c, x, y, P) => {
        const rng = c.rng;
        if (c.has('lm_ice_formation')) P('lm_ice_formation', x, y, { opt: { v: (rng.next() * 3) | 0 }, solid: true, light: { col: '#9fe8ff', r: 50, a: 0.22, z: 16, pulse: true } });
        for (let i = 0; i < 5; i++) { const a = rng.next() * TAU, r = 30 + rng.next() * 40; P('ice_shard', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, { opt: { seed: i } }); }
      } },
    { id: 'longhouseruin', biomes: ['ice'], n: 2, r: 80,
      ok: (c, x, y) => c.water(x, y) > 70 && c.road(x, y) > 70 && c.flat(x, y, 50),
      build: (c, x, y, P) => { if (c.has('lm_longhouse_ruin')) P('lm_longhouse_ruin', x, y, { solid: true }); else P('site_ruins', x, y, { solid: true }); if (c.has('lm_totem_ice')) P('lm_totem_ice', x + 50, y + 20, {}); P('prop_logs', x - 48, y + 26, {}); } },
    { id: 'frozentravellers', biomes: ['ice'], n: 2, r: 40,
      ok: (c, x, y) => c.water(x, y) > 50 && c.road(x, y) > 50 && c.road(x, y) < 260,
      build: (c, x, y, P) => { if (c.has('lm_frozen_travellers')) P('lm_frozen_travellers', x, y, {}); else { P('prop_cart', x, y, { angle: 1.1, dirs: 16 }); P('bones_pile', x + 20, y + 12, { opt: { seed: 2 } }); } } },
    { id: 'frozenfall', biomes: ['ice'], n: 1, r: 90,
      ok: (c, x, y) => c.has('lm_frozen_waterfall') && c.mount(x, y) > 0.35 && c.mount(x, y) < 0.8 && c.water(x, y) > 60,
      build: (c, x, y, P) => { P('lm_frozen_waterfall', x, y, { solid: true, light: { col: '#bfeeff', r: 60, a: 0.15, z: 20 } }); } },
    { id: 'passmarkers', biomes: ['ice'], n: 3, r: 40,
      ok: (c, x, y) => c.road(x, y) > 30 && c.road(x, y) < 44 && c.water(x, y) > 50,
      build: (c, x, y, P) => { const t = c.has('lm_totem_ice') ? 'lm_totem_ice' : 'prop_banner'; P(t, x, y, { anims: t === 'prop_banner' ? 4 : 1, pal: AS.Data.pal.ice }); } },

    /* ===== Morgrave ===== */
    { id: 'graveyard', biomes: ['undead'], n: 3, r: 110,
      ok: (c, x, y) => c.water(x, y) > 80 && c.road(x, y) > 70 && c.flat(x, y, 70),
      build: (c, x, y, P) => {
        const rng = c.rng;
        c.T.addDecal('graveyard', x, y, 90, null, { static: true, seed: (x + y) | 0 });
        if (c.has('lm_mausoleum')) P('lm_mausoleum', x, y - 30, { solid: true, light: { col: '#93ff6a', r: 40, a: 0.35, z: 10, pulse: true } });
        for (let i = 0; i < 7; i++) { const a = rng.next() * TAU, r = 30 + rng.next() * 60; P('prop_gravestone', x + Math.cos(a) * r, y + 10 + Math.sin(a) * r * 0.7, { opt: { v: i % 4 } }); }
        P('tree_dead', x + 80, y - 20, { opt: { seed: 2 } }); P('tree_dead', x - 84, y + 30, { opt: { seed: 5 } });
        if (c.has('lm_bone_totem')) P('lm_bone_totem', x + 50, y + 60, { light: { col: '#93ff6a', r: 24, a: 0.3, z: 20, pulse: true } });
      } },
    { id: 'gallows', biomes: ['undead'], n: 2, r: 40,
      ok: (c, x, y) => c.road(x, y) > 36 && c.road(x, y) < 70 && c.water(x, y) > 60,
      build: (c, x, y, P) => { if (c.has('lm_gallows')) P('lm_gallows', x, y, { light: { col: '#93ff6a', r: 12, a: 0.25, z: 14, pulse: true } }); else P('prop_signpost', x, y, {}); P('bones_pile', x + 16, y + 12, { opt: { seed: 4 } }); } },
    { id: 'obelisk', biomes: ['undead'], n: 2, r: 60,
      ok: (c, x, y) => c.water(x, y) > 70 && c.road(x, y) > 80 && c.flat(x, y, 40),
      build: (c, x, y, P) => { if (c.has('lm_obelisk_dark')) P('lm_obelisk_dark', x, y, { anims: 4, solid: true, light: { col: '#93ff6a', r: 70, a: 0.4, z: 30, pulse: true } }); else P('site_shrine', x, y, { solid: true }); c.T.addDecal('runecircle', x, y + 4, 36, null, { static: true, seed: (x + y) | 0 }); } },
    { id: 'ruinedchapel', biomes: ['undead'], n: 1, r: 90,
      ok: (c, x, y) => c.water(x, y) > 80 && c.road(x, y) > 80 && c.flat(x, y, 55),
      build: (c, x, y, P) => { if (c.has('lm_ruined_chapel')) P('lm_ruined_chapel', x, y, { solid: true }); else P('site_ruins', x, y, { solid: true }); for (let i = 0; i < 4; i++) P('prop_gravestone', x - 60 + i * 20, y + 50, { opt: { v: i } }); } },
    { id: 'deadtree', biomes: ['undead'], n: 2, r: 80,
      ok: (c, x, y) => c.has('lm_dead_colossal_tree') && c.water(x, y) > 60 && c.road(x, y) > 80,
      build: (c, x, y, P) => { P('lm_dead_colossal_tree', x, y, { solid: true, light: { col: '#93ff6a', r: 30, a: 0.3, z: 4, pulse: true } }); P('bones_pile', x + 24, y + 20, { opt: { seed: 1 } }); P('mushrooms_glow', x - 30, y + 16, { opt: { seed: 3 } }); } },
    { id: 'giantskull', biomes: ['undead', 'neutral'], n: 1, r: 80,
      ok: (c, x, y) => c.has('lm_giant_skull') && c.water(x, y) > 80 && c.road(x, y) > 90 && c.flat(x, y, 50),
      build: (c, x, y, P) => { P('lm_giant_skull', x, y, { solid: true, light: { col: '#93ff6a', r: 40, a: 0.35, z: 12, pulse: true } }); c.T.addDecal('bonefield', x, y, 70, null, { static: true, seed: (x * 5 + y) | 0 }); } },
    { id: 'sinkhole', biomes: ['undead'], n: 2, r: 70,
      ok: (c, x, y) => c.water(x, y) > 80 && c.road(x, y) > 90 && c.flat(x, y, 50),
      build: (c, x, y, P) => { if (c.has('lm_sinkhole')) P('lm_sinkhole', x, y, { decor: true }); else c.T.addDecal('crater', x, y, 30, null, { static: true, seed: 2 }); P('rock_dark', x + 40, y + 10, { opt: { seed: 2 } }); } },
    { id: 'bog', biomes: ['undead'], n: 4, r: 90,
      ok: (c, x, y) => c.water(x, y) > 30 && c.water(x, y) < 260 && c.road(x, y) > 80 && c.mount(x, y) < 0.2,
      build: (c, x, y, P) => {
        const rng = c.rng;
        for (let i = 0; i < 4; i++) { const a = rng.next() * TAU, r = rng.next() * 60; c.T.addDecal('swamppool', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 18 + rng.next() * 22, null, { static: true, seed: (x + y + i) | 0 }); }
        for (let i = 0; i < 6; i++) { const a = rng.next() * TAU, r = 30 + rng.next() * 70; P('reeds', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, { opt: { seed: i } }); }
        P('tree_dead', x + 50, y - 40, { opt: { seed: 1 } }); P('mushrooms_glow', x - 30, y + 30, { opt: { seed: 2 } });
      } },
    { id: 'plaguecart', biomes: ['undead'], n: 2, r: 40,
      ok: (c, x, y) => c.road(x, y) > 14 && c.road(x, y) < 34 && c.water(x, y) > 50,
      build: (c, x, y, P) => { if (c.has('lm_plague_cart')) P('lm_plague_cart', x, y, { light: { col: '#93ff6a', r: 24, a: 0.3, z: 8, pulse: true } }); else P('prop_cart', x, y, { angle: 0.4, dirs: 16 }); } },
  ];

  /* ---------------- beasts: lairs and the colossi ---------------- */
  const LAIRS = {
    human: [['moorhound', 3], ['bear', 1]], neutral: [['moorhound', 2], ['bear', 1]],
    elf: [['spindlelurker', 2], ['greatbeetle', 2], ['treeshambler', 1]],
    ice: [['snowstalker', 2], ['icecrawler', 2]],
    undead: [['gravehound', 3], ['carrioncrawler', 2], ['plagueboar', 2]],
  };
  const COLOSSI = { human: 'titan', neutral: 'titan', elf: 'spiderqueen', ice: 'icebehemoth', undead: 'greatworm' };
  function spawnWild(g, kind, x, y, n, homeR) {
    const def = AS.Data.troops[kind];
    if (!def || !AS.Models[def.gen] || !AS.Troop) return 0;
    let made = 0;
    for (let i = 0; i < n; i++) {
      const a = i / Math.max(1, n) * TAU + Math.random(), r = n > 1 ? 20 + Math.random() * 40 : 0;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8;
      if (!g.terrain.groundPassable(px, py)) continue;
      const u = new AS.Troop(g, kind, 'wild', px, py, { state: 'guard' });
      u.home = { x, y, r: homeR || 140 };
      g.troops.push(u); made++;
    }
    return made;
  }
  function beasts(g, c) {
    const rng = c.rng, area = g.map.w * g.map.h / 1e8;
    g.lairs = [];
    for (const bk in LAIRS) {
      const kinds = LAIRS[bk].filter(([k]) => AS.Data.troops[k] && AS.Models[AS.Data.troops[k].gen]);
      if (!kinds.length) continue;
      const want = Math.max(1, Math.round(2.2 * area));
      let made = 0, tries = 0;
      while (made < want && tries < 260) {
        tries++;
        const x = rng.range(300, g.map.w - 300), y = rng.range(300, g.map.h - 300);
        if (c.biome(x, y) !== bk || !c.clear(x, y, 360) || c.road(x, y) < 120 || c.water(x, y) < 50 || c.mount(x, y) > 0.5 || !c.T.groundPassable(x, y)) continue;
        if (g.factionList.some((F) => Math.hypot(F.townPos.x - x, F.townPos.y - y) < 1350)) continue;
        const [k, n] = kinds[(rng.next() * kinds.length) | 0];
        if (!spawnWild(g, k, x, y, n, 150)) continue;
        c.T.addDecal('bonefield', x, y, 50, null, { static: true, seed: (x + y) | 0 });
        c.T.addDecal('trample', x, y, 70, null, { static: true, seed: (x * 3 + y) | 0, fk: 'neutral' });
        c.placed.push({ x, y, r: 160, id: 'lair' });
        g.lairs.push({ k, x, y });
        made++;
      }
    }
    // one colossus for each land, out in the far wilds: seeing it is the event
    g.colossi = [];
    for (const bk in COLOSSI) {
      const k = COLOSSI[bk], def = AS.Data.troops[k];
      if (!def || !AS.Models[def.gen] || (bk === 'neutral' && g.colossi.some((q) => q.k === 'titan'))) continue;
      for (let tries = 0; tries < 160; tries++) {
        const x = rng.range(400, g.map.w - 400), y = rng.range(400, g.map.h - 400);
        if (c.biome(x, y) !== bk || !c.clear(x, y, 600) || c.road(x, y) < 240 || c.water(x, y) < 80 || c.mount(x, y) > 0.4 || !c.T.groundPassable(x, y)) continue;
        if (g.factionList.some((F) => Math.hypot(F.townPos.x - x, F.townPos.y - y) < 2000)) continue;
        if (!spawnWild(g, k, x, y, 1, 520)) continue;
        c.placed.push({ x, y, r: 400, id: 'colossus' });
        g.colossi.push({ k, x, y });
        break;
      }
    }
  }

  /* a run of fence segments */
  function fence(c, P, x, y, len, a, gen) {
    if (!c.has(gen)) return;
    const seg = gen === 'prop_fence' ? 24 : 30, n = Math.max(1, Math.round(len / seg));
    for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * seg; P(gen, x + Math.cos(a) * t, y + Math.sin(a) * t, { angle: a, dirs: 16 }); }
  }
  /* a hedged rectangle (hedgerows if the model exists, else bushes) */
  function hedge(c, P, x, y, w, h, a) {
    const gen = c.has('lm_hedgerow') ? 'lm_hedgerow' : null;
    const ca = Math.cos(a), sa = Math.sin(a);
    const edge = (x0, y0, x1, y1) => {
      const L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
      if (gen) { const n = Math.round(L / 30); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; P(gen, U.lerp(x0, x1, t), U.lerp(y0, y1, t), { angle: ang, dirs: 16 }); } }
      else { const n = Math.round(L / 14); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; P('bush', U.lerp(x0, x1, t), U.lerp(y0, y1, t), { opt: { seed: i }, scale: 0.8 }); } }
    };
    const cx = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    const A = cx(-w / 2, -h / 2), B = cx(w / 2, -h / 2), Cc = cx(w / 2, h / 2), D = cx(-w / 2, h / 2);
    edge(A[0], A[1], B[0], B[1]); edge(B[0], B[1], Cc[0], Cc[1]); edge(Cc[0], Cc[1], D[0], D[1]); edge(D[0], D[1], A[0], A[1]);
  }

  const Scenery = {
    PLACES,
    Prop,
    /* a prop placed by someone else (a town dressing its farms, say) */
    add(g, gen, x, y, o) {
      if (!AS.Models[gen] || !AS.Building || !AS.Building.sheetFor) return null;
      g.scenery = g.scenery || [];
      const pr = new Prop(g, gen, x, y, o || {});
      g.scenery.push(pr);
      if (pr.solid) g.solids.push(pr);
      if (!pr.decor) g.terrain.clearAreas.push({ x, y, r: pr.r * (pr.solid ? 1.2 : 0.9) + 2 });
      if (this.grid) this.gridAdd(pr);
      return pr;
    },
    gridAdd(pr) { const k = ((pr.x / 512) | 0) * 10000 + ((pr.y / 512) | 0); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(pr); },
    init(g) {
      const list = g.scenery = g.scenery || [];
      g.sceneryPlaces = [];
      this.grid = null;
      if (!AS.Building || !AS.Building.sheetFor) return;
      const rng = new U.RNG((g.map.seed || 1) * 7919 + 101);
      const c = ctxOf(g, rng);
      const area = g.map.w * g.map.h / 1e8;
      const P = (gen, x, y, o) => {
        if (!AS.Models[gen]) return null;
        if (!c.onMap(x, y, 40)) return null;
        o = o || {};
        const pr = new Prop(g, gen, x, y, o);
        list.push(pr);
        if (pr.solid) { g.solids.push(pr); g.terrain.clearAreas.push({ x, y, r: pr.r * 1.2 + 4 }); }
        else if (!o.decor) g.terrain.clearAreas.push({ x, y, r: pr.r * 0.9 + 2 });
        return pr;
      };
      for (const pl of PLACES) {
        const want = Math.max(1, Math.round(pl.n * area));
        let made = 0, tries = 0;
        while (made < want && tries < 140) {
          tries++;
          const x = rng.range(260, g.map.w - 260), y = rng.range(260, g.map.h - 260);
          if (!pl.biomes.includes(c.biome(x, y))) continue;
          if (!c.clear(x, y, pl.r + 260)) continue;
          if (!pl.ok(c, x, y)) continue;
          pl.build(c, x, y, P);
          c.placed.push({ x, y, r: pl.r, id: pl.id });
          g.sceneryPlaces.push({ id: pl.id, x, y, r: pl.r });
          made++;
        }
      }
      beasts(g, c);
      // a coarse grid for the view query
      this.grid = new Map();
      for (const pr of list) this.gridAdd(pr);
    },
    /* ---------- streamed maps: scenery comes and goes with the areas (src/game/stream.js) ----------
     * Each area places its own share of the places, lairs and (rarely) a colossus from a
     * random sequence of its own, inside a margin that keeps them clear of the next area,
     * so an area built again is the same as before. The ground marks are laid once;
     * lair survivors are remembered. */
    initStream(g) {
      g.scenery = g.scenery || []; g.sceneryPlaces = []; g.lairs = []; g.colossi = [];
      this.grid = new Map();
    },
    loadCell(g, C) {
      if (!AS.Building || !AS.Building.sheetFor) return;
      const rng = new U.RNG(((g.map.seed || 1) * 7919 + 101 + C.cx * 92821 + C.cy * 68917) >>> 0);
      const c = ctxOf(g, rng, [C.x0, C.y0, C.x1, C.y1]);
      const T = g.terrain, add = T.addDecal;
      if (C.marked) T.addDecal = function () { return {}; };
      const list = g.scenery, props = C.props = [], p0 = g.life.people.length, t0 = g.troops.length;
      const P = (gen, x, y, o) => {
        if (!AS.Models[gen]) return null;
        if (!c.onMap(x, y, 40)) return null;
        o = o || {};
        const pr = new Prop(g, gen, x, y, o);
        list.push(pr); props.push(pr); this.gridAdd(pr);
        if (pr.solid) { g.solids.push(pr); if (!C.marked) T.clearAreas.push({ x, y, r: pr.r * 1.2 + 4 }); }
        else if (!o.decor && !C.marked) T.clearAreas.push({ x, y, r: pr.r * 0.9 + 2 });
        return pr;
      };
      const area = (C.x1 - C.x0) * (C.y1 - C.y0) / 1e8;
      try {
        for (const pl of PLACES) {
          const want = Math.floor(pl.n * area + rng.next()), m = pl.r + 270;
          if (C.x1 - C.x0 < m * 2) continue;
          let made = 0, tries = 0;
          while (made < want && tries < 30) {
            tries++;
            const x = rng.range(C.x0 + m, C.x1 - m), y = rng.range(C.y0 + m, C.y1 - m);
            if (!pl.biomes.includes(c.biome(x, y))) continue;
            if (!c.clear(x, y, pl.r + 260)) continue;
            if (!pl.ok(c, x, y)) continue;
            pl.build(c, x, y, P);
            c.placed.push({ x, y, r: pl.r, id: pl.id });
            made++;
          }
        }
        // the lairs of the wild beasts, and now and then a colossus
        C.lairs = C.lairs || []; C.lairUnits = [];
        let li = 0;
        for (const bk in LAIRS) {
          const kinds = LAIRS[bk].filter(([k]) => AS.Data.troops[k] && AS.Models[AS.Data.troops[k].gen]);
          if (!kinds.length) continue;
          const want = Math.floor(2.2 * area + rng.next());
          for (let made = 0, tries = 0; made < want && tries < 30; tries++) {
            const x = rng.range(C.x0 + 420, C.x1 - 420), y = rng.range(C.y0 + 420, C.y1 - 420);
            if (c.biome(x, y) !== bk || !c.clear(x, y, 360) || c.road(x, y) < 120 || c.water(x, y) < 50 || c.mount(x, y) > 0.5 || !c.T.groundPassable(x, y)) continue;
            if (g.factionList.some((F) => Math.hypot(F.townPos.x - x, F.townPos.y - y) < 1350)) continue;
            const [k, n] = kinds[(rng.next() * kinds.length) | 0];
            const left = C.lairs[li] !== undefined ? C.lairs[li] : n, u0 = g.troops.length;
            if (left > 0) spawnWild(g, k, x, y, left, 150);
            C.lairUnits[li] = g.troops.slice(u0);
            T.addDecal('bonefield', x, y, 50, null, { static: true, seed: (x + y) | 0 });
            T.addDecal('trample', x, y, 70, null, { static: true, seed: (x * 3 + y) | 0, fk: 'neutral' });
            c.placed.push({ x, y, r: 160, id: 'lair' });
            li++; made++;
          }
        }
        if (rng.next() < 0.05) {
          for (let tries = 0; tries < 20; tries++) {
            const x = rng.range(C.x0 + 700, C.x1 - 700), y = rng.range(C.y0 + 700, C.y1 - 700), bk = c.biome(x, y), k = COLOSSI[bk], def = AS.Data.troops[k];
            if (!def || !AS.Models[def.gen] || !c.clear(x, y, 600) || c.road(x, y) < 240 || c.water(x, y) < 80 || c.mount(x, y) > 0.4 || !c.T.groundPassable(x, y)) continue;
            if (g.factionList.some((F) => Math.hypot(F.townPos.x - x, F.townPos.y - y) < 2000)) continue;
            const u0 = g.troops.length;
            if (C.colossus !== 0) spawnWild(g, k, x, y, 1, 520);
            C.colossusUnits = g.troops.slice(u0);
            break;
          }
        }
      } finally { T.addDecal = add; }
      C.marked = true;
      C.people = g.life.people.slice(p0);
      C.troops = g.troops.slice(t0).filter((u) => u.team === 'wild');
    },
    unloadCell(g, C) {
      if (C.props && C.props.length) {
        const gone = new Set(C.props);
        g.scenery = g.scenery.filter((q) => !gone.has(q));
        g.solids = g.solids.filter((q) => !gone.has(q));
        for (const [k, a] of this.grid) { const b = a.filter((q) => !gone.has(q)); if (b.length) this.grid.set(k, b); else this.grid.delete(k); }
      }
      for (const o of C.people || []) o.alive = false;
      // lair beasts: the survivors are remembered lair by lair (in the order the lairs are placed)
      const live = (list) => { let n = 0; for (const u of list || []) if (u.alive && !u.removed) n++; return n; };
      if (C.lairUnits) C.lairUnits.forEach((list, i) => { C.lairs[i] = live(list); });
      if (C.colossusUnits) C.colossus = live(C.colossusUnits);
      for (const u of C.troops || []) if (u.alive) { u.alive = false; u.removed = true; }
      C.props = C.people = C.troops = C.lairUnits = C.colossusUnits = null;
    },
    collect(g, list, x0, y0, x1, y1) {
      if (!this.grid) return;
      const cx0 = ((x0 - 200) / 512) | 0, cx1 = ((x1 + 200) / 512) | 0, cy0 = ((y0 - 200) / 512) | 0, cy1 = ((y1 + 260) / 512) | 0;
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
        const a = this.grid.get(cx * 10000 + cy);
        if (!a) continue;
        for (const pr of a) if (pr.x > x0 - pr.viewR && pr.x < x1 + pr.viewR && pr.y > y0 - pr.viewR && pr.y < y1 + pr.viewR + 160) list.push(pr);
      }
    },
    // decor-style props (flat ground pieces) are drawn under everything
    drawGround(ctx, ox, oy, R, g) {
      if (!this.grid || !g.scenery) return;
      for (const pr of g.scenery) if (pr.decor && Math.abs(pr.x - ox - g.camera.w / 2) < g.camera.w && Math.abs(pr.y - oy - g.camera.h / 2) < g.camera.h) pr.draw(ctx, ox, oy, R);
    },
  };
  AS.Scenery = Scenery;
})(window.AS);
