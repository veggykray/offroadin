/* WYRMCROWN — Map 5: Elderwood.
 * An ancient forest older than the crowns covers nearly the whole realm. Two
 * slow, winding rivers cut it into three: the Elderflow comes down from the
 * north between the elf and ice realms and bends west to the sea of trees,
 * walling Sylvara's heartland into the north-west; the Mirkwater rises in the
 * south between the farmers and the dead and bends east, walling Morgrave's
 * dead wood into the south-east. Between the two rivers runs the long green
 * band of the Heartwood, from Aldermere's farmed clearing in the south-west to
 * Hrimgard's pine hills in the north-east, and at its waist the rivers draw so
 * close that the band narrows to a single great clearing: the Heart, with the
 * ruined keep of Heartkeep, the Wellspring and the Heartstone lode. Elves and
 * dead hold safe corners but must cross bridges to reach the Heart; humans and
 * ice walk there by land. Clearings in the deep wood hold villages, groves,
 * shrines and towers, linked by forest roads, and under the canopy warbands
 * move unseen — the realm is rich in magic and in game. */
'use strict';
(function (AS) {
  AS.Maps.add({
    id: 'elderwood', name: 'Elderwood', index: 5, w: 10000, h: 10000, seed: 5151,
    blurb: 'An ancient forest cut by two winding rivers. Warbands move unseen under the canopy; the Heart clearing between the rivers holds the keep, the well and the richest lode.',
    difficulty: 'Standard',
    regions: [
      { biome: 'human', x: 2300, y: 7600, r: 2700 },
      { biome: 'elf', x: 3500, y: 2100, r: 3100 },
      { biome: 'ice', x: 8700, y: 2400, r: 2200 },
      { biome: 'undead', x: 7800, y: 7800, r: 2700 },
      { biome: 'neutral', x: 5200, y: 5100, r: 1700 },
      { biome: 'neutral', x: 6200, y: 700, r: 1000 },
      { biome: 'neutral', x: 6300, y: 2700, r: 1000 },
      { biome: 'neutral', x: 4700, y: 9500, r: 1000 },
      { biome: 'neutral', x: 9600, y: 5500, r: 900 },
      { biome: 'neutral', x: 400, y: 4800, r: 900 },
    ],
    factions: {
      human: { town: { x: 2400, y: 7400 }, gate: -1.65 },
      elf: { town: { x: 3800, y: 2200 }, gate: -0.2 },
      ice: { town: { x: 8100, y: 2900 }, gate: 1.5 },
      undead: { town: { x: 7600, y: 7500 }, gate: -2.4 },
    },
    rivers: [
      // the Elderflow: from the north edge down between elves and ice, then west
      { w: 120, pts: [[6400, -60], [6100, 800], [6300, 1600], [6050, 2400], [6300, 3200], [5800, 3900], [5000, 4250], [4200, 4300], [3400, 4550], [2700, 4400], [1900, 4700], [1100, 4500], [400, 4750], [-60, 4700]] },
      // the Mirkwater: from the south edge up between farmers and dead, then east
      { w: 120, pts: [[4700, 10060], [4950, 9200], [4650, 8400], [5000, 7600], [4800, 6900], [5400, 6300], [6200, 5900], [7000, 6000], [7800, 5600], [8600, 5800], [9400, 5500], [10060, 5600]] },
    ],
    lakes: [
      { x: 2000, y: 3000, r: 300 },          // Moonmere, in the elf wood
      { x: 9100, y: 4500, r: 280 },          // Rimepool (frozen)
      { x: 9000, y: 6700, r: 300, sx: 1.2 }, // Gloomwater, a black tarn in the dead wood
      { x: 900, y: 6700, r: 240 },           // the Millpond
    ],
    mountains: [
      { w: 300, h: 0.8, pts: [[400, 1800], [900, 900], [1800, 450]] },       // Elder Downs
      { w: 360, h: 1.1, pts: [[7500, 350], [8500, 900], [9600, 700]] },      // Frostspine
      { w: 320, h: 0.95, pts: [[9650, 1900], [9400, 3000], [9650, 3900]] },  // Rimeback
      { w: 300, h: 0.75, pts: [[8400, 9550], [9300, 8800], [9650, 7900]] },  // Barrow Downs
      { w: 260, h: 0.6, pts: [[250, 8500], [700, 9600]] },                   // Hollow Hills
    ],
    // the ancient wood: everything but Aldermere's clearing and the Heart lies under the canopy
    forests: [
      // the elf heartland
      { x: 800, y: 700, r: 1100, d: 0.9 }, { x: 2200, y: 800, r: 1200, d: 0.95 }, { x: 3600, y: 900, r: 1100, d: 0.95 },
      { x: 5000, y: 800, r: 1200, d: 1 }, { x: 1000, y: 2200, r: 1300, d: 0.95 }, { x: 2600, y: 2000, r: 1100, d: 1 },
      { x: 4900, y: 2300, r: 1200, d: 1 }, { x: 1200, y: 3700, r: 1300, d: 0.95 }, { x: 3000, y: 3500, r: 1300, d: 1 },
      { x: 4800, y: 3500, r: 1100, d: 1 }, { x: 5600, y: 1500, r: 800, d: 0.9 },
      // Hrimgard's pine hills
      { x: 6900, y: 1700, r: 1200, d: 0.95 }, { x: 8900, y: 1400, r: 1000, d: 0.85 }, { x: 7000, y: 3300, r: 1100, d: 0.95 },
      { x: 9200, y: 3000, r: 1200, d: 0.9 }, { x: 7700, y: 4400, r: 1300, d: 0.95 }, { x: 8800, y: 4600, r: 1000, d: 0.9 },
      // the Heartwood band (the Heart itself and Aldermere's fields stay open)
      { x: 6700, y: 4900, r: 1200, d: 0.95 }, { x: 3600, y: 5900, r: 1500, d: 0.95 }, { x: 3200, y: 4900, r: 900, d: 0.95 },
      { x: 700, y: 5600, r: 1500, d: 0.95 }, { x: 1800, y: 4700, r: 1100, d: 0.9 }, { x: 300, y: 7000, r: 900, d: 0.9 },
      { x: 4200, y: 7600, r: 1200, d: 0.95 }, { x: 4100, y: 9000, r: 1400, d: 0.95 }, { x: 2400, y: 9500, r: 1200, d: 0.9 },
      { x: 700, y: 8800, r: 1300, d: 0.9 }, { x: 3300, y: 7000, r: 800, d: 0.9 }, { x: 1600, y: 8600, r: 900, d: 0.9 },
      { x: 1300, y: 6400, r: 700, d: 0.85 }, { x: 3400, y: 8200, r: 800, d: 0.95 },
      // Morgrave's dead wood
      { x: 6000, y: 8600, r: 1400, d: 1 }, { x: 6400, y: 7100, r: 1100, d: 1 }, { x: 7600, y: 9200, r: 1300, d: 0.95 },
      { x: 8900, y: 7700, r: 1500, d: 1 }, { x: 8400, y: 6300, r: 1000, d: 0.95 }, { x: 9400, y: 9300, r: 900, d: 0.9 },
      { x: 5800, y: 6500, r: 800, d: 0.9 }, { x: 7300, y: 6400, r: 900, d: 0.95 },
    ],
    roads: [
      // Aldermere ↔ Sylvara over Fernbridge
      { pts: [[2400, 7400], [2300, 6400], [2500, 5400], [2560, 4800], [2580, 4100], [2900, 3700], [3300, 3000], [3800, 2200]] },
      // Sylvara ↔ Hrimgard over Silverbridge
      { pts: [[3800, 2200], [4800, 2000], [6100, 2100], [7100, 2300], [8100, 2900]] },
      // Hrimgard ↔ Morgrave over Frostbridge
      { pts: [[8100, 2900], [8200, 3900], [8300, 4800], [8350, 5700], [8200, 6500], [7600, 7500]] },
      // Aldermere ↔ Morgrave over Mirkbridge
      { pts: [[2400, 7400], [3400, 7700], [4900, 7650], [6000, 7700], [7600, 7500]] },
      // the Heartwood road: Aldermere's road to Hrimgard's through the Heart
      { pts: [[2500, 5400], [3600, 5450], [4300, 5650], [5100, 5500], [6200, 5150], [6900, 4500], [7600, 3950], [8200, 3900]] },
      // Sylvara down to the Heart over Elderbridge
      { pts: [[4800, 2000], [4900, 3200], [4650, 4280], [4400, 4900], [4300, 5650]] },
      // Morgrave up to the Heart over Duskbridge
      { pts: [[7600, 7500], [6900, 6800], [5850, 6100], [5100, 5500]] },
    ],
    bridges: [
      { site: 'fernbridge', x: 2554, y: 4437, a: -1.6 },
      { site: 'silverbridge', x: 6126, y: 2103, a: 0.13 },
      { site: 'frostbridge', x: 8347, y: 5753, a: 1.63 },
      { site: 'mirkbridge', x: 4991, y: 7651, a: 0.03 },
      { site: 'elderbridge', x: 4649, y: 4282, a: 1.88 },
      { site: 'duskbridge', x: 5789, y: 6056, a: -2.51 },
    ],
    sites: [
      // gold mines
      { id: 'mossgold', k: 'goldmine', name: 'Mossgold Mine', x: 2700, y: 900, guard: [['wolf', 4]] },
      { id: 'copperroot', k: 'goldmine', name: 'Copperroot Mine', x: 3700, y: 6300, guard: [['bandit', 4]] },
      { id: 'southmarch', k: 'goldmine', name: 'Southmarch Mine', x: 1700, y: 9200, guard: [['ogre', 1], ['bandit', 2]] },
      { id: 'rimevein', k: 'goldmine', name: 'Rimevein Mine', x: 6700, y: 3900, guard: [['troll', 1]] },
      { id: 'gravemoss', k: 'goldmine', name: 'Gravemoss Mine', x: 6200, y: 8800, guard: [['ogre', 2]] },
      { id: 'heartstone', k: 'goldmine', name: 'Heartstone Lode', x: 5900, y: 5600, rich: true, guard: [['giant', 1], ['ogre', 1], ['troll', 1]] },
      // villages
      { id: 'fernhallow', k: 'village', name: 'Fernhallow', x: 1500, y: 2300, guard: [['wolf', 3]] },
      { id: 'lindenmoor', k: 'village', name: 'Lindenmoor', x: 5100, y: 3300 },
      { id: 'barleyhurst', k: 'village', name: 'Barleyhurst', x: 1200, y: 6000 },
      { id: 'hollinsend', k: 'village', name: "Hollin's End", x: 3600, y: 8800, guard: [['wolf', 3]] },
      { id: 'pinecrest', k: 'village', name: 'Pinecrest', x: 7000, y: 1300, guard: [['wolf', 3]] },
      { id: 'rimeholt', k: 'village', name: 'Rimeholt', x: 9200, y: 3700 },
      { id: 'ashhollow', k: 'village', name: 'Ash Hollow', x: 6000, y: 7100, guard: [['skeleton', 4]] },
      { id: 'grimsby', k: 'village', name: 'Grimsby', x: 8300, y: 8800 },
      // trade
      { id: 'amberway', k: 'tradepost', name: 'Amberway Market', x: 3700, y: 5650, guard: [['bandit', 3]] },
      { id: 'pinetrade', k: 'tradepost', name: 'Resin Road Market', x: 7400, y: 4300, guard: [['bandit', 3]] },
      // magic
      { id: 'thornspire', k: 'wizardtower', name: 'Thornspire', x: 1100, y: 3900, guard: [['ogre', 1]] },
      { id: 'oakenspire', k: 'wizardtower', name: 'Oakenspire', x: 6800, y: 5400, guard: [['troll', 1], ['wolf', 2]] },
      { id: 'wellspring', k: 'magicwell', name: 'The Wellspring', x: 5900, y: 4800, guard: [['troll', 1], ['wolf', 3]] },
      { id: 'starbloom', k: 'grove', name: 'Starbloom Grove', x: 2600, y: 3500, guard: [['wolf', 3]] },
      { id: 'hazelgrove', k: 'grove', name: 'Hazel Grove', x: 1900, y: 5300, guard: [['wolf', 3]] },
      { id: 'frostheart', k: 'crystal', name: 'Frostheart Crystal', x: 9100, y: 1800, guard: [['troll', 1]] },
      { id: 'barrow', k: 'relic', name: 'Barrow of the Nameless', x: 9200, y: 7500, guard: [['giant', 1]] },
      // strongholds
      { id: 'heartkeep', k: 'castle', name: 'Heartkeep', x: 5000, y: 4950, guard: [['giant', 1], ['ogre', 2]] },
      // crossings
      { id: 'fernbridge', k: 'bridge', name: 'Fernbridge', x: 2554, y: 4437 },
      { id: 'silverbridge', k: 'bridge', name: 'Silverbridge', x: 6126, y: 2103 },
      { id: 'frostbridge', k: 'bridge', name: 'Frostbridge', x: 8347, y: 5753 },
      { id: 'mirkbridge', k: 'bridge', name: 'Mirkbridge', x: 4991, y: 7651 },
      { id: 'elderbridge', k: 'bridge', name: 'Elderbridge', x: 4649, y: 4282 },
      { id: 'duskbridge', k: 'bridge', name: 'Duskbridge', x: 5789, y: 6056 },
      // shrines, caves, nests, watchtowers, waygates, ruins
      { id: 'silvermoon', k: 'shrine', name: 'Shrine of the Silver Moon', x: 5000, y: 1000 },
      { id: 'dawnstone', k: 'shrine', name: 'Dawnstone Circle', x: 700, y: 7900 },
      { id: 'hollowcave', k: 'cave', name: 'Hollow Hill Cave', x: 1000, y: 9000, guard: [['troll', 2]] },
      { id: 'bonepit', k: 'cave', name: 'The Bonepit', x: 9200, y: 8400, guard: [['giant', 1]] },
      { id: 'eldereyrie', k: 'nest', name: 'Elder Eyrie', x: 1150, y: 1450, guard: [['troll', 1]] },
      { id: 'frosteyrie', k: 'nest', name: 'Frostspine Eyrie', x: 8200, y: 1400, guard: [['troll', 1]] },
      { id: 'embertower', k: 'watchtower', name: 'Ember Tower', x: 3800, y: 7000 },
      { id: 'hoarfrost', k: 'watchtower', name: 'Hoarfrost Tower', x: 6900, y: 3000 },
      { id: 'gallows', k: 'watchtower', name: 'Gallows Tower', x: 5600, y: 8300 },
      { id: 'leafgate', k: 'waygate', name: 'Leafgate', x: 3300, y: 4000 },
      { id: 'fieldgate', k: 'waygate', name: 'Fieldgate', x: 2900, y: 5900 },
      { id: 'frostgate', k: 'waygate', name: 'Frostgate', x: 7800, y: 4700 },
      { id: 'duskgate', k: 'waygate', name: 'Duskgate', x: 6700, y: 6300 },
      { id: 'heartgate', k: 'waygate', name: 'Heartgate', x: 4450, y: 5300 },
      { id: 'elderhall', k: 'ruins', name: 'Fallen Elderhall', x: 4200, y: 3500, guard: [['ogre', 1]] },
      { id: 'rimehall', k: 'ruins', name: 'Old Rimehall', x: 9150, y: 2450, guard: [['ogre', 1]] },
      { id: 'blackroot', k: 'ruins', name: 'Blackroot Ruins', x: 8500, y: 6200, guard: [['ogre', 2]] },
    ],
    // plenty of game under the canopy
    wild: [
      { k: 'deer', x: 1800, y: 1500, n: 6 }, { k: 'deer', x: 4300, y: 1300, n: 5 }, { k: 'deer', x: 3200, y: 2800, n: 5 },
      { k: 'deer', x: 5300, y: 2600, n: 5 }, { k: 'boar', x: 1600, y: 3600, n: 4 }, { k: 'boar', x: 4000, y: 4000, n: 4 },
      { k: 'goat', x: 8800, y: 1500, n: 5 }, { k: 'deer', x: 7400, y: 2000, n: 5 }, { k: 'goat', x: 9000, y: 3300, n: 4 },
      { k: 'deer', x: 7600, y: 3500, n: 4 },
      { k: 'deer', x: 900, y: 5200, n: 5 }, { k: 'boar', x: 3300, y: 5100, n: 4 }, { k: 'horse', x: 1500, y: 8300, n: 5 },
      { k: 'boar', x: 4200, y: 6500, n: 4 }, { k: 'deer', x: 3200, y: 9300, n: 4 },
      { k: 'deer', x: 6300, y: 4500, n: 5 }, { k: 'boar', x: 5300, y: 5300, n: 4 }, { k: 'horse', x: 7200, y: 5200, n: 4 },
      { k: 'boar', x: 6700, y: 8200, n: 4 }, { k: 'deer', x: 8800, y: 8000, n: 3 }, { k: 'boar', x: 7400, y: 6700, n: 3 },
      { k: 'deer', x: 5300, y: 9300, n: 4 },
    ],
    // rune circles, thickest round the Heart
    runes: [[4700, 5600], [5500, 4500], [6300, 5600], [5200, 6100], [3900, 4800], [6200, 4100], [3100, 6600], [7200, 4800],
      [2000, 4000], [4400, 2800], [7700, 2000], [8800, 5000], [6700, 7600], [3000, 8300], [1500, 7000], [8600, 7200]],
  });
})(window.AS);
