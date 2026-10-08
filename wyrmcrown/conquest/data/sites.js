/* WYRMCROWN — CONQUEST data: places on the campaign map.
 *
 * Recruitment sites offer troop types (data/troops.js lists which). Territories
 * are holdings that can be captured and pay income. Objectives are what the
 * campaign is won by. The progression template is the order every generated
 * archipelago guarantees, whatever its seed.
 *
 * @typedef {Object} SiteKind      a recruitment site
 * @property {string} id
 * @property {string} name
 * @property {string|null} owner   allegiance it belongs to by default ('any' = takes the holder's)
 * @property {number} restock      campaign days for its recruits to replenish
 *
 * @typedef {Object} TerritoryKind a capturable holding
 * @property {string} id
 * @property {string} name
 * @property {number} income       gold per campaign day while held
 * @property {number} tier         earliest progression step it appears in (index into progression)
 * @property {string=} battleSite  the battle-mode site kind (AS.Data.sites) whose model and capture
 *                                 rules it can reuse, if any
 */
'use strict';
(function (AS) {
  const D = AS.Conquest.Data;
  D.recruitSites = {
    village: { id: 'village', name: 'Village', owner: 'any', restock: 2 },
    barracks: { id: 'barracks', name: 'Barracks', owner: 'any', restock: 2 },
    archery_range: { id: 'archery_range', name: 'Archery Range', owner: 'any', restock: 3 },
    knight_barracks: { id: 'knight_barracks', name: 'Knight Barracks', owner: 'any', restock: 4 },
    stables: { id: 'stables', name: 'Stables', owner: 'any', restock: 4 },
    workshop: { id: 'workshop', name: 'Siege Workshop', owner: 'any', restock: 5 },
    bandit_camp: { id: 'bandit_camp', name: 'Bandit Camp', owner: 'neutral', restock: 3 },
    wolf_den: { id: 'wolf_den', name: 'Wolf Den', owner: 'neutral', restock: 2 },
    ogre_den: { id: 'ogre_den', name: 'Ogre Den', owner: 'neutral', restock: 5 },
    troll_hole: { id: 'troll_hole', name: 'Troll Hole', owner: 'neutral', restock: 6 },
    giant_lair: { id: 'giant_lair', name: 'Giant Lair', owner: 'neutral', restock: 8 },
    wyvern_nest: { id: 'wyvern_nest', name: 'Wyvern Nest', owner: 'neutral', restock: 6 },
    enchanted_grove: { id: 'enchanted_grove', name: 'Enchanted Grove', owner: 'neutral', restock: 5 },
    barrow: { id: 'barrow', name: 'Barrow', owner: 'neutral', restock: 5 },
  };
  D.territories = {
    farm: { id: 'farm', name: 'Farmstead', income: 6, tier: 0 },
    tower: { id: 'tower', name: 'Watchtower', income: 4, tier: 0, battleSite: 'watchtower' },
    village: { id: 'village', name: 'Village', income: 12, tier: 0, battleSite: 'village' },
    bridge: { id: 'bridge', name: 'Bridge', income: 0, tier: 1, battleSite: 'bridge' },
    mine: { id: 'mine', name: 'Gold Mine', income: 30, tier: 2, battleSite: 'goldmine' },
    fort: { id: 'fort', name: 'Fort', income: 10, tier: 2, battleSite: 'fort' },
    castle: { id: 'castle', name: 'Castle', income: 45, tier: 3, battleSite: 'castle' },
    harbour: { id: 'harbour', name: 'Harbour', income: 15, tier: 4 },
    stronghold: { id: 'stronghold', name: 'Stronghold', income: 60, tier: 5 },
  };
  // the guaranteed shape of every campaign (procedural generation fills in the details)
  D.progression = [
    { id: 'start', name: 'Starting region', note: 'farms and towers, light guards, a village to recruit from' },
    { id: 'bridges', name: 'Bridges', note: 'guarded crossings into the wider island' },
    { id: 'frontier', name: 'Stronger territories', note: 'mines, forts, monster lairs' },
    { id: 'first_castle', name: 'First castle', note: 'the first major capture; pays for a ship' },
    { id: 'harbour', name: 'Harbour and ship', note: 'buy a ship to carry the army across the sea' },
    { id: 'outer_islands', name: 'Outer islands', note: 'independent strongholds and richer, deadlier lands' },
    { id: 'final', name: 'Dragon Lord strongholds', note: 'reachable only by sea; taking every one wins the campaign' },
  ];
  // objective kinds: only Dragon Lord strongholds are required
  D.objectiveKinds = {
    lord_stronghold: { id: 'lord_stronghold', name: 'Dragon Lord stronghold', required: true },
    minor_stronghold: { id: 'minor_stronghold', name: 'Independent stronghold', required: false },
    territory: { id: 'territory', name: 'Holding', required: false },
  };
  // how many Dragon Lords a campaign has: usually one, sometimes two, rarely three
  D.lordCountOdds = [[1, 0.65], [2, 0.28], [3, 0.07]];
})(window.AS);
