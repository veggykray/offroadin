/* ALIEN STRIKE — art integration map.
 * Points data entries at the redesigned model generators (src/gfx/models_*.js).
 * Each entry only applies when its generator exists, so a missing or broken
 * models file degrades to the original art instead of breaking a mission.
 *   enemies / structures / bosses: key -> { gen, opt, pal, anims, dirs, gunZ }
 *   obstacle: world key -> { gen, opt }   (replaces that world's default obstacle)
 *   landmark: landmark key -> { gen, opt } (overrides data/landmarks.js)
 *   other: gun / pickup / cargo / prop / dropship / kharad_seg / tempest_seg / refcore
 * apply() runs once, before the first mission builds any sheets. */
'use strict';
(function (AS) {
  const has = (g) => !!(g && AS.Models[g]);

  const ArtMap = {
    enemies: {},
    structures: {},
    bosses: {},
    obstacle: {},
    landmark: {},
    other: {},
    applied: false,

    patchModel(def, m) {
      if (!def || !m || !has(m.gen)) return false;
      const cur = def.model || {};
      def.model = {
        gen: m.gen,
        pal: m.pal !== undefined ? m.pal : cur.pal,
        opt: m.opt !== undefined ? m.opt : {},
        anims: m.anims !== undefined ? m.anims : cur.anims,
        dirs: m.dirs !== undefined ? m.dirs : cur.dirs,
      };
      if (m.gunZ !== undefined) def.gunZ = m.gunZ;
      // visual-only turret overrides (generator, barrel style)
      if (m.gun && def.gun) def.gun = Object.assign({}, def.gun, m.gun);
      return true;
    },

    apply() {
      if (this.applied) return;
      this.applied = true;
      const D = AS.Data;
      let n = 0;
      for (const k in this.enemies) if (this.patchModel(D.enemies[k], this.enemies[k])) n++;
      for (const k in this.structures) if (this.patchModel(D.structures[k], this.structures[k])) n++;
      if (AS.Bosses && AS.Bosses.DEFS) for (const k in this.bosses) if (this.patchModel(AS.Bosses.DEFS[k], this.bosses[k])) n++;
      for (const k in this.landmark) {
        const m = this.landmark[k], d = D.landmarks && D.landmarks[k];
        if (d && has(m.gen)) { d.gen = m.gen; if (m.opt) d.opt = Object.assign({}, d.opt || {}, m.opt); n++; }
      }
      for (const w of D.worlds) {
        const m = this.obstacle[w.key];
        if (m && has(m.gen) && w.obstacle) { w.obstacle.kind0 = w.obstacle.kind; w.obstacle.gen = m.gen; w.obstacle.genOpt = m.opt || {}; n++; }
      }
      this.count = n;
    },

    /* generator for an "other" slot, or null to keep the original */
    gen(slot) { const m = this.other[slot]; return m && has(m.gen) ? m : null; },
  };

  /* ---- integrated packages: creatures, Choir units, alien structures, landmarks ---- */
  Object.assign(ArtMap.enemies, {
    thrall: {"gen": "chThrall", "opt": {}, "pal": "choir", "anims": 4, "dirs": 24, "gunZ": 0, "gun": {"gen": "chGun"}},
    sentry: {"gen": "chSentry", "opt": {}, "pal": "choir", "anims": 4, "dirs": 24, "gun": {"gen": "chGun"}},
    shardback: {"gen": "chShardback", "opt": {}, "pal": "choir", "anims": 1, "dirs": 24, "gunZ": 7.8, "gun": {"gen": "chGun", "kind": "long"}},
    needler: {"gen": "chNeedler", "opt": {}, "pal": "choir", "anims": 1, "dirs": 24, "gunZ": 6.8, "gun": {"gen": "chGun"}},
    overseer: {"gen": "chOverseer", "opt": {}, "pal": "choir", "anims": 4, "dirs": 24, "gunZ": 9, "gun": {"gen": "chGun"}},
    stormint: {"gen": "chStormInt", "opt": {}, "pal": "choir", "anims": 1, "dirs": 24, "gun": {"gen": "chGun"}},
    gunship: {"gen": "chGunship", "opt": {}, "pal": "choir", "anims": 4, "dirs": 24, "gun": {"gen": "chGun"}},
    choirlancer: {"gen": "chLancer", "opt": {}, "pal": "choir", "anims": 1, "dirs": 24, "gunZ": 7.4, "gun": {"gen": "chGun"}},
    titan: {"gen": "chTitan", "opt": {}, "pal": "choir", "anims": 4, "dirs": 24, "gun": {"gen": "chGun"}},
    seraph: {"gen": "chSeraph", "opt": {}, "pal": {"a": "#b8ae9a", "b": "#e6dcc6", "t": "#5a4f7a", "g": "#c09aff", "d": "#3a3446"}, "anims": 1, "dirs": 24, "gun": {"gen": "chGun"}},
    skitter: {"gen": "crSkitter", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    tunneler: {"gen": "crTunneler", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    sandwyrm: {"gen": "crSandwyrm", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    hivedrone: {"gen": "crHiveDrone", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    spitter: {"gen": "crSpitter", "opt": {}, "anims": 4, "dirs": 16},
    lurker: {"gen": "crLurker", "opt": {}, "anims": 4, "dirs": 1},
    warrior: {"gen": "crWarrior", "opt": {}, "anims": 4, "dirs": 16},
    hivebomber: {"gen": "crBomber", "opt": {}, "anims": 4, "dirs": 16},
    stalker: {"gen": "crStalker", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    lancer: {"gen": "crLancer", "opt": {}, "pal": "native", "anims": 1, "dirs": 1, "gunZ": 7},
    lurcher: {"gen": "crLurcher", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    golem: {"gen": "crGolem", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    sporeling: {"gen": "crSporeling", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    puffball: {"gen": "crPuffball", "opt": {}, "anims": 4, "dirs": 1},
    sporemortar: {"gen": "crSporeMortar", "opt": {}, "anims": 4, "dirs": 1},
    skyray: {"gen": "crSkyRay", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    sentinel: {"gen": "crSentinel", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
    mite: {"gen": "crMite", "opt": {}, "anims": 4, "dirs": 16},
    behemoth: {"gen": "crBehemoth", "opt": {}, "pal": "native", "anims": 4, "dirs": 16},
  });
  Object.assign(ArtMap.structures, {
    turret: {"gen": "saTurret", "opt": {"style": "needle"}, "pal": "choir", "gunZ": 15},
    turret_heavy: {"gen": "saTurret", "opt": {"style": "ancient"}, "pal": "choir", "gunZ": 12.5},
    sam: {"gen": "saTurret", "opt": {"style": "rack"}, "pal": "choir", "gunZ": 7.5},
    flak: {"gen": "saTurret", "opt": {"style": "flak"}, "pal": "choir", "gunZ": 8},
    aagun: {"gen": "saTurret", "opt": {"style": "ancient", "size": 1.3}, "pal": "choir", "gunZ": 16},
    turret_organic: {"gen": "saTurret", "opt": {"style": "organic"}, "pal": {"a": "#5e2440", "b": "#b04a74", "t": "#f09a3a", "g": "#ffcf4a", "d": "#2a0e1c"}, "gunZ": 8.5},
    pylon: {"gen": "saSpire", "opt": {"style": "arc"}, "pal": "choir"},
    rod: {"gen": "saSpire", "opt": {"style": "rod"}, "pal": "colony"},
    lancertower: {"gen": "saSpire", "opt": {"style": "lancer", "h": 34}, "pal": {"a": "#2e4a7a", "b": "#9cc4ec", "t": "#dff4ff", "g": "#7ff8ff", "d": "#16203a"}},
    resonator: {"gen": "saSpire", "opt": {"style": "resonator", "h": 44}, "pal": {"a": "#3e2f6e", "b": "#b6a4ee", "t": "#efe6ff", "g": "#c890ff", "d": "#1c1634"}, "anims": 2},
    obelisk: {"gen": "saSpire", "opt": {"style": "ruin", "h": 46}, "pal": "choir"},
    radar: {"gen": "saRadar", "pal": "choir", "anims": 8},
    comms: {"gen": "saComms", "pal": "choir", "anims": 2},
    shieldpylon: {"gen": "saComms", "opt": {"h": 76, "sanctum": true}, "pal": "choir", "anims": 2},
    power: {"gen": "saWell", "pal": "choir"},
    reactor: {"gen": "saWell", "opt": {"style": "reactor"}, "pal": "choir"},
    shieldgen: {"gen": "saShieldGen", "pal": "choir", "anims": 4},
    factory: {"gen": "saFoundry", "pal": "choir"},
    barracks: {"gen": "saBarracks", "pal": "choir"},
    nest: {"gen": "saHive", "opt": {"style": "burrow", "r": 20, "seed": 3}, "pal": "native"},
    hive: {"gen": "saHive", "opt": {"style": "hive", "seed": 9}, "pal": {"a": "#8a5a2a", "b": "#d39a4c", "t": "#6a2a62", "g": "#ff9a3a", "d": "#2a1424"}},
    sporeroot: {"gen": "saHive", "opt": {"style": "root", "r": 18, "seed": 11}, "pal": {"a": "#6a3a7a", "b": "#a060b8", "t": "#d0a0e0", "g": "#9ffff0", "d": "#22142a"}},
    sporetower: {"gen": "saFungus", "opt": {"style": "spore"}, "pal": {"a": "#5a3a5a", "b": "#8a5a7a", "t": "#c08ab0", "g": "#d0ff6a", "d": "#2a1a2a"}},
    specimen: {"gen": "saFungus", "opt": {"style": "specimen", "h": 24}, "pal": {"a": "#245a66", "b": "#5ab4bc", "t": "#d8f4e0", "g": "#9ffff0", "d": "#10262c"}},
    pheromone: {"gen": "saFungus", "opt": {"style": "resin", "h": 30}, "pal": {"a": "#a0581a", "b": "#e8a040", "t": "#ffe0a0", "g": "#fff07a", "d": "#3a1c08"}, "anims": 2},
    growth: {"gen": "saPods", "opt": {"style": "eggs"}, "pal": {"a": "#7a1a4a", "b": "#d0508a", "t": "#ffb04a", "g": "#ffd04a", "d": "#2a0a1a"}, "anims": 2},
    cocoon: {"gen": "saPods", "opt": {"style": "cocoon", "n": 3, "seed": 5}, "pal": {"a": "#b8b09a", "b": "#efe9d6", "t": "#6a5a4a", "g": "#c0e040", "d": "#3a3026"}},
    coupling: {"gen": "saEmitter", "opt": {"style": "coupling", "h": 20}, "pal": "choir"},
    sonar: {"gen": "saEmitter", "opt": {"style": "sonar", "h": 8}, "pal": "choir"},
    weaponcore: {"gen": "saLanceCore", "pal": "choir", "anims": 4},
    wreckship: {"gen": "crashShip", "opt": {"variant": "colony"}, "pal": "colony", "anims": 1, "dirs": 1},
    choirwreck: {"gen": "crashShip", "opt": {"variant": "choir"}, "pal": "choir", "anims": 1, "dirs": 1},
    crashedship: {"gen": "crashShip", "opt": {"variant": "colony"}, "pal": {"a": "#5a6470", "b": "#9aa6b4", "t": "#e8a02a", "g": "#7fe8ff", "d": "#262c34"}, "anims": 1, "dirs": 1},
  });
  Object.assign(ArtMap.landmark, {
    crashColony: {"gen": "crashShip", "opt": {"variant": "colony"}},
    crashChoir: {"gen": "crashShip", "opt": {"variant": "choir"}},
    skeletonBeast: {"gen": "skeleton", "opt": {"kind": "beast"}},
    skeletonWorm: {"gen": "skeleton", "opt": {"kind": "worm"}},
    colonyRuins: {"gen": "colonyRuins", "opt": {}},
    convoyHulk: {"gen": "convoyHulk", "opt": {}},
    industrialStacks: {"gen": "industrialStacks", "opt": {}},
    drownedTower: {"gen": "drownedTower", "opt": {}},
    giantGear: {"gen": "giantGear", "opt": {}},
    monolith: {"gen": "monolith", "opt": {}},
    choirTower: {"gen": "choirTower", "opt": {}},
    crystalCluster: {"gen": "crystalCluster", "opt": {}},
    giantShrooms: {"gen": "giantShrooms", "opt": {}},
  });
  Object.assign(ArtMap.other, {
    gun: {"gen": "gun2"},
  });

  AS.ArtMap = ArtMap;
})(window.AS);
