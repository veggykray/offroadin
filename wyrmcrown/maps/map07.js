/* WYRMCROWN — Map 7: Twin Rivers.
 * Two great rivers, the Kingswater and the Queenswater, run side by side from
 * the northern hills to the southern sea and cut the realm into three bands.
 * In the west band Sylvara's woods (north) and Aldermere's fields (south)
 * share one bank; in the east band Hrimgard (north) and Morgrave (south) share
 * the other. Between the rivers lies the Middle Reach, the richest land in the
 * realm: the great keep of Twinkeep with its two flanking forts, the
 * Kingsvein lode, the Twinwell, two river markets and four fat villages.
 * Each river can be crossed at only four places, and the four inner bridges
 * are toll-bridges with towers of their own — the war is about holding the
 * bridges and the Middle Reach between them. The realm is laid out in mirror:
 * every crossing, prize and town has its twin on the far bank. */
'use strict';
(function (AS) {
  AS.Maps.add({
    id: 'twinrivers', name: 'Twin Rivers', index: 7, w: 12000, h: 8400, seed: 7272,
    blurb: 'Two great rivers split the realm in three. Hold the bridges and the rich Middle Reach between them, or be cut off on your own bank.',
    difficulty: 'Hard',
    regions: [
      { biome: 'elf', x: 1500, y: 1900, r: 1800 },
      { biome: 'human', x: 1500, y: 6500, r: 1800 },
      { biome: 'ice', x: 10500, y: 1900, r: 1800 },
      { biome: 'undead', x: 10500, y: 6500, r: 1800 },
      { biome: 'neutral', x: 6000, y: 4200, r: 3000 },
      { biome: 'neutral', x: 6000, y: 800, r: 1600 },
      { biome: 'neutral', x: 6000, y: 7600, r: 1600 },
    ],
    factions: {
      human: { town: { x: 2000, y: 6300 }, gate: -1.5 },
      elf: { town: { x: 2000, y: 2100 }, gate: 1.5 },
      ice: { town: { x: 10000, y: 2100 }, gate: 1.6 },
      undead: { town: { x: 10000, y: 6300 }, gate: -1.6 },
    },
    rivers: [
      // the Kingswater (narrower at the four crossings)
      { w: 250, pts: [[4000, -60, 250], [3850, 700, 250], [4150, 1500, 200], [3900, 2400, 260], [4200, 3300, 200], [3950, 4200, 260], [4200, 5100, 200], [3900, 6000, 260], [4150, 6900, 200], [3850, 7700, 250], [4000, 8460, 250]] },
      // the Queenswater
      { w: 250, pts: [[8000, -60, 250], [8150, 700, 250], [7850, 1500, 200], [8100, 2400, 260], [7800, 3300, 200], [8050, 4200, 260], [7800, 5100, 200], [8100, 6000, 260], [7850, 6900, 200], [8150, 7700, 250], [8000, 8460, 250]] },
    ],
    lakes: [
      { x: 1500, y: 4200, r: 260, sy: 1.3 },  // Stillmere
      { x: 10500, y: 4200, r: 260, sy: 1.3 }, // Greymere
    ],
    mountains: [
      { w: 260, h: 0.65, pts: [[200, 1500], [500, 500], [1500, 200]] },
      { w: 260, h: 0.65, pts: [[200, 6900], [500, 7900], [1500, 8200]] },
      { w: 300, h: 1.0, pts: [[11800, 1500], [11500, 500], [10500, 200]] },
      { w: 260, h: 0.75, pts: [[11800, 6900], [11500, 7900], [10500, 8200]] },
    ],
    forests: [
      // Sylvara's woods
      { x: 1800, y: 1800, r: 1800, d: 1 }, { x: 600, y: 3200, r: 900, d: 0.9 }, { x: 3000, y: 1000, r: 900, d: 0.9 },
      // copses in Aldermere's fields
      { x: 700, y: 7800, r: 700, d: 0.8 }, { x: 3300, y: 6000, r: 600, d: 0.7 },
      // Hrimgard's snow pines
      { x: 10400, y: 1400, r: 1200, d: 0.9 }, { x: 11300, y: 3200, r: 800, d: 0.8 },
      // Morgrave's dead wood
      { x: 10500, y: 7200, r: 1200, d: 0.95 }, { x: 9000, y: 6000, r: 800, d: 0.85 },
      // river woods of the Middle Reach
      { x: 5000, y: 1700, r: 700, d: 0.8 }, { x: 7000, y: 6700, r: 700, d: 0.8 }, { x: 5000, y: 6700, r: 600, d: 0.75 },
      { x: 7000, y: 1700, r: 600, d: 0.75 }, { x: 5300, y: 3300, r: 400, d: 0.6 }, { x: 6700, y: 5100, r: 400, d: 0.6 },
      { x: 5500, y: 3950, r: 380, d: 0.7 }, { x: 6500, y: 4450, r: 380, d: 0.7 }, { x: 4600, y: 4600, r: 350, d: 0.7 },
      { x: 7400, y: 3800, r: 350, d: 0.7 }, { x: 5600, y: 6700, r: 350, d: 0.65 }, { x: 6400, y: 1700, r: 350, d: 0.65 },
    ],
    roads: [
      // the west bank: Sylvara ↔ Aldermere
      { pts: [[2000, 2100], [1800, 3200], [2100, 4200], [1800, 5200], [2000, 6300]] },
      // the east bank: Hrimgard ↔ Morgrave
      { pts: [[10000, 2100], [10200, 3200], [9900, 4200], [10200, 5200], [10000, 6300]] },
      // the north highway: Sylvara ↔ Hrimgard over Elmbridge and Frostbridge
      { pts: [[2000, 2100], [3000, 1600], [3700, 1500], [4150, 1500], [4700, 1450], [6000, 1300], [7300, 1450], [7850, 1500], [8300, 1500], [9000, 1600], [10000, 2100]] },
      // the south highway: Aldermere ↔ Morgrave over Millbridge and Bonebridge
      { pts: [[2000, 6300], [3000, 6800], [3700, 6900], [4150, 6900], [4700, 6950], [6000, 7100], [7300, 6950], [7850, 6900], [8300, 6900], [9000, 6800], [10000, 6300]] },
      // the crown roads over the toll-bridges, round Twinkeep
      { pts: [[1800, 3200], [3000, 3300], [3700, 3300], [4200, 3300], [4800, 3300], [5500, 3500], [6500, 3500], [7200, 3300], [7800, 3300], [8300, 3300], [9000, 3300], [10200, 3200]] },
      { pts: [[1800, 5200], [3000, 5100], [3700, 5100], [4200, 5100], [4800, 5100], [5500, 4900], [6500, 4900], [7200, 5100], [7800, 5100], [8300, 5100], [9000, 5100], [10200, 5200]] },
      // bank roads of the Middle Reach
      { pts: [[4700, 1450], [4950, 2000], [4700, 2700], [4800, 3300]] },
      { pts: [[7300, 1450], [7050, 2000], [7300, 2700], [7200, 3300]] },
      { pts: [[4800, 5100], [4700, 5700], [4950, 6400], [4700, 6950]] },
      { pts: [[7200, 5100], [7300, 5700], [7050, 6400], [7300, 6950]] },
    ],
    // each river is crossed only here; the inner four are toll-bridges
    bridges: [
      { x: 4150, y: 1500, a: 0 },                          // Elmbridge
      { site: 'crownbridge', x: 4200, y: 3300, a: 0 },
      { site: 'kingsbridge', x: 4200, y: 5100, a: 0 },
      { x: 4150, y: 6900, a: 0 },                          // Millbridge
      { x: 7850, y: 1500, a: 0 },                          // Frostbridge
      { site: 'queensbridge', x: 7800, y: 3300, a: 0 },
      { site: 'ravenbridge', x: 7800, y: 5100, a: 0 },
      { x: 7850, y: 6900, a: 0 },                          // Bonebridge
    ],
    sites: [
      // the Middle Reach
      { id: 'twinkeep', k: 'castle', name: 'Twinkeep', x: 6000, y: 4200, guard: [['giant', 1], ['ogre', 2], ['troll', 1]] },
      { id: 'westward', k: 'fort', name: 'Westward Fort', x: 5000, y: 4200, guard: [['ogre', 2], ['bandit', 4]] },
      { id: 'eastward', k: 'fort', name: 'Eastward Fort', x: 7000, y: 4200, guard: [['ogre', 2], ['bandit', 4]] },
      { id: 'kingsvein', k: 'goldmine', name: 'Kingsvein', x: 6000, y: 6100, rich: true, guard: [['giant', 1], ['ogre', 2]] },
      { id: 'twinwell', k: 'magicwell', name: 'The Twinwell', x: 6000, y: 2300, guard: [['giant', 1], ['troll', 1]] },
      { id: 'highmarket', k: 'tradepost', name: "Ferryman's Fair", x: 6000, y: 1050, guard: [['bandit', 5], ['ogre', 1]] },
      { id: 'lowmarket', k: 'tradepost', name: "Bargeman's Market", x: 6000, y: 7350, guard: [['bandit', 5], ['ogre', 1]] },
      { id: 'twinford', k: 'village', name: 'Twinford', x: 5100, y: 2600, guard: [['ogre', 2]] },
      { id: 'reedholm', k: 'village', name: 'Reedholm', x: 6900, y: 2600, guard: [['ogre', 2]] },
      { id: 'millwater', k: 'village', name: 'Millwater', x: 5100, y: 5800, guard: [['ogre', 2]] },
      { id: 'ashwick', k: 'village', name: 'Ashwick', x: 6900, y: 5800, guard: [['ogre', 2]] },
      { id: 'northford', k: 'goldmine', name: 'Northford Mine', x: 5000, y: 800, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'highwater', k: 'goldmine', name: 'Highwater Mine', x: 7000, y: 800, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'lowford', k: 'goldmine', name: 'Lowford Mine', x: 5000, y: 7600, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'reedbank', k: 'goldmine', name: 'Reedbank Mine', x: 7000, y: 7600, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'heartgate', k: 'waygate', name: 'Heartgate', x: 6000, y: 3150 },
      { id: 'midwatch', k: 'watchtower', name: 'Midwatch', x: 6000, y: 5250 },
      { id: 'drownedabbey', k: 'ruins', name: 'Drowned Abbey', x: 6000, y: 350, guard: [['ogre', 2]] },
      { id: 'sunkenchapel', k: 'ruins', name: 'Sunken Chapel', x: 6000, y: 8050, guard: [['ogre', 2]] },
      // toll-bridges
      { id: 'crownbridge', k: 'bridge', name: 'Crownbridge', x: 4200, y: 3300 },
      { id: 'kingsbridge', k: 'bridge', name: 'Kingsbridge', x: 4200, y: 5100 },
      { id: 'queensbridge', k: 'bridge', name: 'Queensbridge', x: 7800, y: 3300 },
      { id: 'ravenbridge', k: 'bridge', name: 'Ravenbridge', x: 7800, y: 5100 },
      // the west band: Sylvara
      { id: 'leafholm', k: 'village', name: 'Leafholm', x: 800, y: 3300, guard: [['wolf', 4]] },
      { id: 'mosswell', k: 'goldmine', name: 'Mosswell Mine', x: 3100, y: 700, guard: [['wolf', 4]] },
      { id: 'silverleaf', k: 'grove', name: 'Silverleaf Grove', x: 3200, y: 2700, guard: [['wolf', 3]] },
      { id: 'elmshrine', k: 'shrine', name: 'Shrine of the Elms', x: 700, y: 1800 },
      { id: 'greycrown', k: 'nest', name: 'Greycrown Eyrie', x: 1100, y: 900, guard: [['troll', 1], ['ogre', 1]] },
      // the west band: Aldermere
      { id: 'barrowby', k: 'village', name: 'Barrowby', x: 800, y: 5100, guard: [['bandit', 4]] },
      { id: 'copperhill', k: 'goldmine', name: 'Copperhill Mine', x: 3100, y: 7700, guard: [['bandit', 4]] },
      { id: 'dawnshrine', k: 'shrine', name: 'Dawn Shrine', x: 3200, y: 5700 },
      { id: 'stormspire', k: 'wizardtower', name: 'Stormspire', x: 700, y: 6600, guard: [['ogre', 1]] },
      { id: 'hobshollow', k: 'cave', name: "Hob's Hollow", x: 1100, y: 7500, guard: [['troll', 2]] },
      // the west band between
      { id: 'westgate', k: 'waygate', name: 'Westgate', x: 800, y: 4200 },
      { id: 'westwatch', k: 'watchtower', name: 'Westwatch Tower', x: 2900, y: 4200 },
      // the east band: Hrimgard
      { id: 'rimeby', k: 'village', name: 'Rimeby', x: 11200, y: 3300, guard: [['wolf', 4]] },
      { id: 'frostvein', k: 'goldmine', name: 'Frostvein Mine', x: 8900, y: 700, guard: [['wolf', 4]] },
      { id: 'frostheart', k: 'crystal', name: 'Frostheart Crystal', x: 8800, y: 2700, guard: [['troll', 1]] },
      { id: 'wintershrine', k: 'shrine', name: 'Shrine of Winter', x: 11300, y: 1800 },
      { id: 'frostcrown', k: 'nest', name: 'Frostcrown Eyrie', x: 10900, y: 900, guard: [['troll', 1], ['ogre', 1]] },
      // the east band: Morgrave
      { id: 'gravesend', k: 'village', name: 'Gravesend', x: 11200, y: 5100, guard: [['skeleton', 5]] },
      { id: 'bonedig', k: 'goldmine', name: 'Bonedig Mine', x: 8900, y: 7700, guard: [['skeleton', 5]] },
      { id: 'drownedking', k: 'relic', name: 'Barrow of the Drowned King', x: 8800, y: 5700, guard: [['troll', 1]] },
      { id: 'gloomspire', k: 'wizardtower', name: 'Gloomspire', x: 11300, y: 6600, guard: [['ogre', 1]] },
      { id: 'ghoulpit', k: 'cave', name: 'The Ghoul Pit', x: 10900, y: 7500, guard: [['troll', 2]] },
      // the east band between
      { id: 'eastgate', k: 'waygate', name: 'Eastgate', x: 11200, y: 4200 },
      { id: 'eastwatch', k: 'watchtower', name: 'Eastwatch Tower', x: 9100, y: 4200 },
    ],
    wild: [
      { k: 'deer', x: 1500, y: 1200, n: 6 }, { k: 'deer', x: 2800, y: 2300, n: 5 }, { k: 'boar', x: 600, y: 2600, n: 4 },
      { k: 'horse', x: 1300, y: 5700, n: 5 }, { k: 'horse', x: 2900, y: 6100, n: 4 }, { k: 'boar', x: 1900, y: 7600, n: 4 },
      { k: 'goat', x: 10500, y: 900, n: 5 }, { k: 'deer', x: 9200, y: 2300, n: 5 }, { k: 'goat', x: 11400, y: 2600, n: 4 },
      { k: 'boar', x: 11400, y: 5700, n: 4 }, { k: 'deer', x: 9100, y: 6200, n: 4 }, { k: 'boar', x: 10100, y: 7600, n: 4 },
      { k: 'horse', x: 5500, y: 1900, n: 5 }, { k: 'horse', x: 6500, y: 6500, n: 5 }, { k: 'deer', x: 5500, y: 5300, n: 4 },
      { k: 'deer', x: 6500, y: 3000, n: 4 }, { k: 'boar', x: 5400, y: 7000, n: 3 }, { k: 'boar', x: 6600, y: 1400, n: 3 },
    ],
    runes: [[5500, 3000], [6500, 3000], [5500, 5400], [6500, 5400], [6000, 1800], [6000, 6600], [4700, 4200], [7300, 4200],
      [2600, 3600], [2600, 4800], [9400, 3600], [9400, 4800], [1300, 1300], [1300, 7100], [10700, 1300], [10700, 7100]],
  });
})(window.AS);
