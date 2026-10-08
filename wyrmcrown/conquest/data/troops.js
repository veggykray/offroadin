/* WYRMCROWN — CONQUEST data: troop types.
 * Fixed statistics (troops never level up). Combat stats are NOT duplicated:
 * each type names a battle-mode troop record (AS.Data.troops[base]) whose hp,
 * speed, weapons and so on it uses, optionally scaled by `mul`, and a model
 * generator (`gen`, an AS.Models key) for its look. That way a Conquest army can
 * later be spawned through the existing AS.Troop class unchanged.
 *
 * @typedef {Object} TroopType
 * @property {string}  id
 * @property {string}  name
 * @property {string}  allegiance  realm key, or 'neutral'
 * @property {string=} tag         for neutral types: beast | brute | giant | fey | dead (see allegiances.neutralCost)
 * @property {string}  base        AS.Data.troops key supplying the combat statistics
 * @property {Object=} mul         multipliers on base stats, e.g. { hp: 1.2, dmg: 0.9 }
 * @property {string|null} gen     AS.Models generator for the look (null = art still to be made)
 * @property {boolean=} flying
 * @property {number}  leadership  leadership points each one occupies
 * @property {number}  cost        gold to recruit one
 * @property {number}  wage        gold per campaign day for each one
 * @property {string[]} sites      recruitment site kinds (data/sites.js) that offer it
 */
'use strict';
(function (AS) {
  const T = (o) => o;
  const list = [
    // ---- Aldermere (human)
    T({ id: 'h_soldier', name: 'Aldermere Footman', allegiance: 'human', base: 'soldier', gen: 'ppl_soldier', leadership: 10, cost: 30, wage: 2, sites: ['village', 'barracks'] }),
    T({ id: 'h_archer', name: 'Aldermere Longbow', allegiance: 'human', base: 'archer', gen: 'ppl_archer', leadership: 12, cost: 40, wage: 3, sites: ['archery_range'] }),
    T({ id: 'h_knight', name: 'Knight of Aldermere', allegiance: 'human', base: 'elite', gen: 'ppl_knight', leadership: 35, cost: 160, wage: 9, sites: ['knight_barracks', 'stables'] }),
    T({ id: 'h_siege', name: 'Siege Catapult', allegiance: 'human', base: 'siege', gen: 'sg_catapult_cart', leadership: 50, cost: 260, wage: 12, sites: ['workshop'] }),
    // ---- Sylvara (elf)
    T({ id: 'e_warden', name: 'Sylvaran Warden', allegiance: 'elf', base: 'soldier', mul: { hp: 1.15 }, gen: 'trp_elf_warden', leadership: 12, cost: 36, wage: 2, sites: ['village', 'barracks'] }),
    T({ id: 'e_archer', name: 'Sylvaran Bow', allegiance: 'elf', base: 'archer', mul: { range: 1.1 }, gen: 'ppl_archer', leadership: 12, cost: 42, wage: 3, sites: ['archery_range'] }),
    // ---- Hrimgard (ice)
    T({ id: 'i_berserker', name: 'Hrimgard Berserker', allegiance: 'ice', base: 'soldier', mul: { hp: 1.2, dmg: 1.15 }, gen: 'trp_ice_berserker', leadership: 14, cost: 40, wage: 3, sites: ['village', 'barracks'] }),
    T({ id: 'i_archer', name: 'Hrimgard Bowman', allegiance: 'ice', base: 'archer', gen: 'ppl_archer', leadership: 12, cost: 40, wage: 3, sites: ['archery_range'] }),
    // ---- Morgrave (undead)
    T({ id: 'u_skeleton', name: 'Risen', allegiance: 'undead', base: 'skeleton', gen: 'trp_undead_skeleton', leadership: 6, cost: 14, wage: 0, sites: ['village', 'barracks'] }),
    T({ id: 'u_ghoul', name: 'Ghoul', allegiance: 'undead', base: 'elite', mul: { hp: 0.8 }, gen: 'trp_undead_ghoul', leadership: 28, cost: 120, wage: 4, sites: ['knight_barracks'] }),
    // ---- neutral creatures and folk (allegiance changes availability and cost)
    T({ id: 'n_bandit', name: 'Bandit Crossbow', allegiance: 'neutral', tag: 'brute', base: 'bandit', gen: 'mon_bandit', leadership: 10, cost: 34, wage: 4, sites: ['bandit_camp'] }),
    T({ id: 'n_wolf', name: 'Wolf', allegiance: 'neutral', tag: 'beast', base: 'wolf', gen: 'ani_wolf', leadership: 6, cost: 18, wage: 1, sites: ['wolf_den'] }),
    T({ id: 'n_bear', name: 'Cave Bear', allegiance: 'neutral', tag: 'beast', base: 'bear', gen: 'bst_bear', leadership: 22, cost: 70, wage: 3, sites: ['wolf_den'] }),
    T({ id: 'n_ogre', name: 'Hill Ogre', allegiance: 'neutral', tag: 'brute', base: 'ogre', gen: 'ogr_hill', leadership: 55, cost: 240, wage: 10, sites: ['ogre_den'] }),
    T({ id: 'n_troll', name: 'Cave Troll', allegiance: 'neutral', tag: 'brute', base: 'troll', gen: 'trl_cave', leadership: 75, cost: 340, wage: 14, sites: ['troll_hole'] }),
    T({ id: 'n_mosstroll', name: 'Moss Troll', allegiance: 'neutral', tag: 'fey', base: 'troll', mul: { hp: 0.9 }, gen: 'trl_moss', leadership: 70, cost: 320, wage: 13, sites: ['enchanted_grove'] }),
    T({ id: 'n_shambler', name: 'Tree Shambler', allegiance: 'neutral', tag: 'fey', base: 'treeshambler', gen: 'bst_treeshambler', leadership: 65, cost: 300, wage: 10, sites: ['enchanted_grove'] }),
    T({ id: 'n_hillgiant', name: 'Hill Giant', allegiance: 'neutral', tag: 'giant', base: 'giant', gen: 'gnt_hill', leadership: 130, cost: 700, wage: 28, sites: ['giant_lair'] }),
    T({ id: 'n_frostgiant', name: 'Frost Giant', allegiance: 'neutral', tag: 'giant', base: 'giant', mul: { hp: 1.05 }, gen: 'gnt_frost', leadership: 135, cost: 740, wage: 30, sites: ['giant_lair'] }),
    T({ id: 'n_frosttroll', name: 'Frost Troll', allegiance: 'neutral', tag: 'brute', base: 'troll', gen: 'trl_frost', leadership: 75, cost: 340, wage: 14, sites: ['troll_hole'] }),
    T({ id: 'n_corpsegiant', name: 'Corpse Giant', allegiance: 'neutral', tag: 'dead', base: 'giant', mul: { hp: 0.95 }, gen: 'gnt_corpse', leadership: 125, cost: 640, wage: 0, sites: ['giant_lair', 'barrow'] }),
    T({ id: 'n_blighttroll', name: 'Blight Troll', allegiance: 'neutral', tag: 'dead', base: 'troll', gen: 'trl_blight', leadership: 72, cost: 300, wage: 0, sites: ['troll_hole', 'barrow'] }),
    // no wyvern model exists yet: the type is defined so wyvern nests can be placed, art pending
    T({ id: 'n_wyvern', name: 'Wyvern', allegiance: 'neutral', tag: 'beast', base: 'ogre', mul: { hp: 0.7, speed: 2.4 }, gen: null, flying: true, leadership: 60, cost: 380, wage: 12, sites: ['wyvern_nest'] }),
  ];
  const byId = {};
  for (const t of list) byId[t.id] = t;
  AS.Conquest.Data.troops = byId;
  AS.Conquest.Data.troopList = list;
})(window.AS);
