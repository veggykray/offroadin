/* WYRMCROWN — CONQUEST data: the campaign world's tuning.
 * Everything the world generator, the campaign clock and the economy use that
 * is a number worth balancing lives here, so balancing never means editing code.
 *
 * Strength is measured in leadership points (data/troops.js): an army of 60
 * points is six footmen; a Hill Giant alone is 130.
 */
'use strict';
(function (AS) {
  const D = AS.Conquest.Data;
  D.world = {
    GEN_VERSION: 1,          // bump when the generator changes what a seed produces
    size: { w: 2000, h: 1400 },
    // garrison strength (leadership points) by tier: [min, max]
    budget: {
      0: [16, 50], 1: [60, 110], 2: [110, 200], 3: [260, 380], 4: [180, 280],
      5: [320, 620], 6: [620, 980], 7: [1200, 1600],
    },
    maxUnits: 36,            // a garrison never fields more units than this (stronger types instead)
    // what taking a site pays once (gold) and how much leadership it adds (renown)
    reward: {
      gold: { 0: [30, 70], 1: [70, 130], 2: [130, 240], 3: [450, 600], 4: [220, 320], 5: [300, 480], 6: [500, 700], 7: [1500, 1500] },
      leadership: { 0: 10, 1: 20, 2: 30, 3: 90, 4: 40, 5: 70, 6: 100, 7: 0 },
      stronghold: 150,       // extra leadership for an independent stronghold or a Dragon Lord fortress
    },
    // the campaign clock: hours each action takes (a day ends at midnight: income, wages, restock)
    hours: { road: 6, bridge: 6, sea: 24, battle: 6, recruit: 1, claim: 2 },
    dayStart: 8,             // a new campaign begins at 08:00 on day 1
    // the ship: bought at a harbour the player holds
    ship: { cost: 900, needs: ['harbour'] },
    // a defeated army falls back to the nearest holding and loses this share of each stack it had left
    retreatLoss: 0.25,
    // in a local battle, losing the dragon loses the battle (the army withdraws)
    battleLives: 1,
    log: 30,                 // campaign events kept in the save
  };
  // the extra kinds of place the campaign map has (beyond data/sites.js territories)
  Object.assign(D.territories, {
    lair: { id: 'lair', name: 'Lair', income: 0, tier: 0, battleSite: 'cave' },
    ruins: { id: 'ruins', name: 'Ruins', income: 0, tier: 1, battleSite: 'ruins' },
    landing: { id: 'landing', name: 'Landing', income: 4, tier: 5, battleSite: 'tradepost', art: 'harbour (pending)' },
    lordhold: { id: 'lordhold', name: 'Dragon Lord Fortress', income: 90, tier: 7 },
  });
  // battle-mode stand-ins for places without art of their own yet
  D.territories.farm.battleSite = 'village'; D.territories.farm.art = 'farmstead (pending)';
  D.territories.harbour.battleSite = 'tradepost'; D.territories.harbour.art = 'harbour (pending)';
  D.territories.stronghold.battleSite = 'castle';
  // the monster lairs that recruit (lair → recruitment site kind) and who lives there
  D.lairs = {
    wolf_den: { name: 'Wolf Den', tier: 0, troops: ['n_wolf', 'n_bear'] },
    bandit_camp: { name: 'Bandit Camp', tier: 0, troops: ['n_bandit'] },
    ogre_den: { name: 'Ogre Den', tier: 2, troops: ['n_ogre'] },
    troll_hole: { name: 'Troll Hole', tier: 5, troops: ['n_troll', 'n_frosttroll', 'n_blighttroll'] },
    giant_lair: { name: 'Giant Lair', tier: 5, troops: ['n_hillgiant', 'n_frostgiant', 'n_corpsegiant'] },
    enchanted_grove: { name: 'Enchanted Grove', tier: 5, troops: ['n_shambler', 'n_mosstroll'] },
    barrow: { name: 'Barrow', tier: 5, troops: ['n_blighttroll', 'n_corpsegiant'] },
    wyvern_nest: { name: 'Wyvern Nest', tier: 6, troops: ['n_wyvern'] },
  };
})(window.AS);
