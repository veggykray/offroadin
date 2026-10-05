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

  /* ---- integrated packages: bosses, vehicles ---- */
  Object.assign(ArtMap.enemies, {
    raider: {"gen": "veRaider", "opt": {}, "pal": {"a": "#1c1a1c", "b": "#ebe1cb", "t": "#d8322a", "g": "#ff8a2a", "d": "#121012"}, "anims": 1, "dirs": 24},
    dragoon: {"gen": "veDragoon", "opt": {"len": 15, "wid": 10}, "pal": {"a": "#3a3532", "b": "#d6c8aa", "t": "#e8a02a", "g": "#ff7a2a", "d": "#1c1918"}, "anims": 2, "dirs": 24, "gunZ": 7},
    scarab: {"gen": "veScarab", "opt": {}, "pal": {"a": "#2e2a28", "b": "#cfc0a0", "t": "#f0b020", "g": "#ff6a2a", "d": "#161312"}, "anims": 2, "dirs": 24, "gunZ": 7.6},
    mender: {"gen": "veMender", "opt": {}, "pal": {"a": "#2a2628", "b": "#e6dcc4", "t": "#e8a02a", "g": "#7dff8a", "d": "#141214"}, "anims": 1, "dirs": 24},
    crawler: {"gen": "veCrawler", "opt": {}, "pal": {"a": "#46403a", "b": "#d9a83a", "t": "#e8742a", "g": "#ffd36b", "d": "#1e1a16"}, "anims": 4, "dirs": 32},
    strider: {"gen": "veStrider", "opt": {}, "pal": {"a": "#2c3442", "b": "#56637a", "t": "#e8742a", "g": "#ff8a2a", "d": "#161b24"}, "anims": 4, "dirs": 24},
    frostdrone: {"gen": "veRimeDrone", "opt": {}, "pal": {"a": "#34445e", "b": "#6a7e9c", "t": "#e6f4ff", "g": "#6ff2ff", "d": "#1a2232"}, "anims": 1, "dirs": 24},
    gull: {"gen": "veGull", "opt": {}, "pal": {"a": "#8a9494", "b": "#eef0ea", "t": "#ff8a2a", "g": "#ffb84a", "d": "#2a3030"}, "anims": 1, "dirs": 24},
    skimmer: {"gen": "veSkimmer", "opt": {}, "pal": {"a": "#5e6a6c", "b": "#e4e6e0", "t": "#ff7a2a", "g": "#ffb04a", "d": "#232a2c"}, "anims": 1, "dirs": 24, "gunZ": 5.6},
    floatturret: {"gen": "veBuoy", "opt": {}, "pal": {"a": "#2e383a", "b": "#9aa4a4", "t": "#e0302a", "g": "#ffb84a", "d": "#1a2224"}, "anims": 2, "dirs": 24},
    forgedrone: {"gen": "veForgeDrone", "opt": {}, "pal": {"a": "#4a4440", "b": "#a0968c", "t": "#ff7a2a", "g": "#ff8a2a", "d": "#1a1210"}, "anims": 1, "dirs": 24},
    magma: {"gen": "veMagma", "opt": {}, "pal": {"a": "#3a3230", "b": "#9a8c80", "t": "#ff7a2a", "g": "#ff9a3a", "d": "#120c0a"}, "anims": 2, "dirs": 24, "gunZ": 7.2},
    forgetank: {"gen": "veAnvil", "opt": {}, "pal": {"a": "#3a3230", "b": "#9a8c80", "t": "#ff7a2a", "g": "#ff9a3a", "d": "#120c0a"}, "anims": 1, "dirs": 24, "gunZ": 7.6},
    infected: {"gen": "veInfected", "opt": {}, "pal": {"a": "#6a6e76", "b": "#c4c8cc", "t": "#c0306a", "g": "#7fffd0", "d": "#22202c"}, "anims": 4, "dirs": 24},
    gearcrawler: {"gen": "veGearCrawler", "opt": {"len": 14, "wid": 10}, "pal": {"a": "#5a4c3e", "b": "#a89a80", "t": "#ff6a3a", "g": "#ff9a3a", "d": "#1e1c18"}, "anims": 4, "dirs": 24, "gunZ": 7.2},
    hauler: {"gen": "veHauler", "opt": {"cargoSide": "#7a5a3a", "cargoTop": "#a8825a"}, "anims": 1, "dirs": 24},
    ally_tank: {"gen": "veWarden", "opt": {}, "pal": {"a": "#5a6470", "b": "#9aa6b4", "t": "#e8a02a", "g": "#7fe8ff", "d": "#262c34"}, "anims": 1, "dirs": 24, "gunZ": 7},
    ally_gunship: {"gen": "veLancer", "opt": {}, "pal": {"a": "#5a6470", "b": "#9aa6b4", "t": "#e8a02a", "g": "#7fe8ff", "d": "#262c34"}, "anims": 1, "dirs": 24},
    tanker: {"gen": "veSkimmer", "opt": {"tanker": 1}, "pal": {"a": "#5e6a6c", "b": "#e4e6e0", "t": "#ff7a2a", "g": "#ffb04a", "d": "#232a2c"}, "anims": 1, "dirs": 24, "gunZ": 5.6},
  });
  Object.assign(ArtMap.bosses, {
    maw: {"gen": "boMaw", "opt": {}, "anims": 4, "dirs": 16},
    kharad: {"gen": "boKharad", "opt": {}, "pal": {"a": "#2e2a33", "b": "#5c5462", "t": "#eadcbc", "g": "#ffcc44", "d": "#140f14"}, "anims": 4, "dirs": 16},
    queen: {"gen": "boQueen", "opt": {}, "anims": 4, "dirs": 16},
    prism: {"gen": "boPrism", "opt": {}, "pal": {"a": "#2a3c7c", "b": "#6a8ee0", "t": "#e4fbff", "g": "#7ff6ff", "d": "#141c3a"}, "anims": 4, "dirs": 16},
    refinery: {"gen": "boRefinery", "opt": {}, "pal": {"a": "#3e3848", "b": "#c8bca4", "t": "#e89a3a", "g": "#c07aff", "d": "#1a1620"}, "anims": 1, "dirs": 1},
    foundry: {"gen": "boFoundry", "opt": {}, "pal": {"a": "#5a4632", "b": "#a8865a", "t": "#ffb03a", "g": "#ff7a1a", "d": "#1a1210"}, "anims": 2, "dirs": 16},
    mind: {"gen": "boMind", "opt": {}, "pal": {"a": "#8a4a5a", "b": "#e8b8b0", "t": "#fff0e0", "g": "#7affd0", "d": "#3a1a26"}, "anims": 4, "dirs": 1},
    tempest: {"gen": "boTempest", "opt": {}, "pal": {"a": "#1c2246", "b": "#3e4c8c", "t": "#d8ecff", "g": "#7ff8ff", "d": "#0c1024"}, "anims": 4, "dirs": 16},
    warden: {"gen": "boWarden", "opt": {}, "pal": {"a": "#34323e", "b": "#7c7a8c", "t": "#e0b050", "g": "#ff3a24", "d": "#16141c"}, "anims": 4, "dirs": 16},
    heart: {"gen": "boHeart", "opt": {}, "pal": {"a": "#3a3346", "b": "#6c6286", "t": "#e6d6b0", "g": "#c09aff", "d": "#1e1a28"}, "anims": 4, "dirs": 1},
  });
  Object.assign(ArtMap.other, {
    kharad_seg: {"gen": "boKharadSeg", "opt": {}},
    tempest_seg: {"gen": "boTempestSeg", "opt": {}},
    refcore: {"gen": "boRefCore", "opt": {}},
  });

  AS.ArtMap = ArtMap;
})(window.AS);
