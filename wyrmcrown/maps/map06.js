/* WYRMCROWN — Map 6: The Ashen Wastes.
 * A dead land. Morgrave's blight has eaten the centre and the east, leaving
 * grey ash plains, black ridges and the bones of older kingdoms — ruins,
 * barrows and plundered tombs lie everywhere, and trolls and giants den in the
 * caves. At the heart stands the Ashcrown, a ring of black peaks around a dead
 * caldera with the burnt castle of the Crown of Ash inside it; three passes
 * lead in. The living cling to the edges: Aldermere's Last Fields in the west,
 * Hrimgard in the cold north-east, and Sylvara in the last green forest of the
 * north-west, walled in by the Dwindle, a dying river that sinks into the
 * Mournmere and trickles out to the western sea; only two bridges cross it.
 * Morgrave squats in the middle-east, a short march from everyone.
 * The war here is about food: wild herds are scarce, so villages, pastures and
 * the lone oasis of Last Rain in the southern waste are worth more than gold. */
'use strict';
(function (AS) {
  AS.Maps.add({
    id: 'ashen', name: 'The Ashen Wastes', index: 6, w: 10000, h: 10000, seed: 6606,
    blurb: 'A blighted waste of ash, ruins and black ridges around the Ashcrown caldera. Game is scarce: every village and herd is worth fighting for.',
    difficulty: 'Hard',
    regions: [
      { biome: 'human', x: 1500, y: 6500, r: 2100 },
      { biome: 'elf', x: 2200, y: 1900, r: 2300 },
      { biome: 'ice', x: 8100, y: 1500, r: 2200 },
      { biome: 'undead', x: 6900, y: 6000, r: 3200 },
      { biome: 'undead', x: 8400, y: 8400, r: 2400 },
      { biome: 'undead', x: 4800, y: 4800, r: 1600 },
      { biome: 'undead', x: 9000, y: 4300, r: 1500 },
      { biome: 'undead', x: 3800, y: 8900, r: 1900 },
      { biome: 'neutral', x: 5100, y: 1600, r: 1300 },
      { biome: 'neutral', x: 3300, y: 4600, r: 900 },
      { biome: 'neutral', x: 5250, y: 8650, r: 950 }, // the oasis of Last Rain
    ],
    factions: {
      human: { town: { x: 1700, y: 6300 }, gate: -1.5 },
      elf: { town: { x: 2400, y: 1900 }, gate: -0.45 },
      ice: { town: { x: 7800, y: 1700 }, gate: 1.75 },
      undead: { town: { x: 7400, y: 5700 }, gate: Math.PI },
    },
    rivers: [
      // the Dwindle: down from the north edge, into the Mournmere, out to the west
      { w: 100, pts: [[4200, -60], [4000, 1000], [4100, 1500], [4300, 2100], [3900, 3100], [3600, 3800], [3000, 4100], [2100, 3900], [1200, 4200], [400, 4000], [-60, 4100]] },
    ],
    lakes: [
      { x: 3600, y: 3800, r: 420 },          // the Mournmere
      { x: 5300, y: 8700, r: 280 },          // Last Rain, the oasis of the southern waste
      { x: 9200, y: 7700, r: 320, sx: 1.2 }, // the Gravemere
    ],
    mountains: [
      // the Ashcrown: a broken ring of black peaks round the caldera
      { w: 280, h: 1.15, pts: [[3658, 4414], [4040, 3958], [4700, 3750], [5360, 3958], [5742, 4414]] },
      { w: 260, h: 1.0, pts: [[5742, 5386], [5513, 5713], [5186, 5942]] },
      { w: 260, h: 1.0, pts: [[4214, 5942], [3887, 5713], [3658, 5386]] },
      // the Cinderspine, broken by the pass between elves and ice
      { w: 340, h: 1.1, pts: [[5700, 200], [5400, 800], [5350, 1350]] },
      { w: 320, h: 0.95, pts: [[5450, 2450], [5700, 2900], [5800, 3300]] },
      { w: 320, h: 0.9, pts: [[8100, 3500], [9000, 3900], [9750, 3600]] },  // the Bonewall
      { w: 300, h: 0.8, pts: [[2300, 8200], [3300, 7800], [4300, 8300]] },  // the Blackteeth
      { w: 300, h: 0.85, pts: [[7600, 9300], [8700, 8700], [9600, 9100]] }, // Gallowsridge
      { w: 300, h: 1.1, pts: [[8500, 350], [9200, 500], [9750, 300]] },     // the Frostfangs
    ],
    forests: [
      // the last green forest
      { x: 2000, y: 1800, r: 2000, d: 1 }, { x: 1000, y: 3200, r: 1200, d: 0.95 }, { x: 3200, y: 2600, r: 1100, d: 0.95 },
      { x: 3000, y: 700, r: 1000, d: 0.9 }, { x: 900, y: 800, r: 1000, d: 0.9 },
      // a few copses in the Last Fields
      { x: 600, y: 7600, r: 700, d: 0.8 }, { x: 2600, y: 5600, r: 600, d: 0.7 },
      // snow pines
      { x: 8800, y: 2400, r: 900, d: 0.8 }, { x: 6800, y: 1200, r: 800, d: 0.8 },
      // dead woods
      { x: 8800, y: 6400, r: 1000, d: 0.9 }, { x: 6000, y: 7800, r: 900, d: 0.85 }, { x: 8000, y: 7800, r: 800, d: 0.85 },
      { x: 9300, y: 5300, r: 700, d: 0.8 }, { x: 6500, y: 3700, r: 600, d: 0.75 },
    ],
    roads: [
      // Aldermere ↔ Sylvara over Willowbridge
      { pts: [[1700, 6300], [1800, 5200], [2000, 4500], [2050, 3950], [2200, 2900], [2400, 1900]] },
      // Sylvara ↔ Hrimgard over Thornbridge and through the Cinder Pass
      { pts: [[2400, 1900], [3300, 1450], [4100, 1480], [4550, 1520], [4900, 1750], [5450, 1900], [6600, 1900], [7800, 1700]] },
      // Hrimgard ↔ Morgrave
      { pts: [[7800, 1700], [7500, 2800], [7300, 3800], [7200, 4800], [7400, 5700]] },
      // Aldermere ↔ Morgrave below the Ashcrown
      { pts: [[1700, 6300], [2800, 6600], [3900, 6800], [4700, 6700], [5700, 6500], [6600, 6100], [7400, 5700]] },
      // the Crown road: west pass → caldera → east pass
      { pts: [[1800, 5200], [2700, 5000], [3300, 4900], [3600, 4900], [4700, 5350], [5800, 4900], [6600, 5000], [7200, 4800]] },
      // south pass
      { pts: [[4700, 5350], [4700, 6050], [4700, 6700]] },
      // the north road from the Cinder Pass down to the east pass
      { pts: [[4900, 1750], [4700, 2600], [5100, 3500], [5900, 3800], [6050, 4500], [5800, 4900]] },
    ],
    // the Dwindle can be crossed only here
    bridges: [
      { site: 'willowbridge', x: 2056, y: 3905, a: -1.45 },
      { site: 'thornbridge', x: 4094, y: 1479, a: 0.08 },
    ],
    sites: [
      // gold mines
      { id: 'cinderdell', k: 'goldmine', name: 'Cinderdell Mine', x: 700, y: 4900, guard: [['bandit', 4]] },
      { id: 'elmroot', k: 'goldmine', name: 'Elmroot Mine', x: 800, y: 2000, guard: [['wolf', 4]] },
      { id: 'rimecut', k: 'goldmine', name: 'Rimecut Mine', x: 6700, y: 800, guard: [['wolf', 4]] },
      { id: 'deadman', k: 'goldmine', name: "Deadman's Mine", x: 8500, y: 7100, guard: [['skeleton', 5]] },
      { id: 'blackslag', k: 'goldmine', name: 'Blackslag Mine', x: 5600, y: 9300, guard: [['ogre', 2]] },
      { id: 'embervein', k: 'goldmine', name: 'Embervein', x: 5100, y: 7400, rich: true, guard: [['giant', 1], ['ogre', 2]] },
      // villages: precious in a land without game
      { id: 'wheatfold', k: 'village', name: 'Wheatfold', x: 1200, y: 8000, guard: [['bandit', 3]] },
      { id: 'emberford', k: 'village', name: 'Emberford', x: 3000, y: 5450, guard: [['bandit', 4]] },
      { id: 'greenhollow', k: 'village', name: 'Greenhollow', x: 1100, y: 3100, guard: [['wolf', 3]] },
      { id: 'frostholm', k: 'village', name: 'Frostholm', x: 9000, y: 2700, guard: [['wolf', 4]] },
      { id: 'mourncross', k: 'village', name: 'Mourncross', x: 9000, y: 5800, guard: [['skeleton', 4]] },
      { id: 'lastrain', k: 'village', name: 'Last Rain', x: 5900, y: 8200, guard: [['ogre', 1], ['bandit', 3]] },
      // trade
      { id: 'ashmarket', k: 'tradepost', name: 'Ash Market', x: 3000, y: 4500, guard: [['bandit', 4]] },
      { id: 'bonemarket', k: 'tradepost', name: 'Bone Market', x: 6400, y: 4300, guard: [['skeleton', 5]] },
      // magic
      { id: 'sylvanspire', k: 'wizardtower', name: 'Sylvan Spire', x: 1000, y: 900, guard: [['wolf', 3]] },
      { id: 'ashspire', k: 'wizardtower', name: 'Ashspire', x: 6000, y: 6700, guard: [['troll', 1], ['skeleton', 3]] },
      { id: 'emberwell', k: 'magicwell', name: 'Well of Embers', x: 4950, y: 2950, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'lastleaf', k: 'grove', name: 'Lastleaf Grove', x: 3400, y: 2700, guard: [['wolf', 3]] },
      { id: 'weeping', k: 'grove', name: 'Weeping Grove', x: 4700, y: 8900, guard: [['troll', 1]] },
      { id: 'shardfall', k: 'crystal', name: 'Shardfall Crystal', x: 9200, y: 900, guard: [['troll', 1]] },
      { id: 'blightheart', k: 'crystal', name: 'Blightheart Crystal', x: 8000, y: 6900, guard: [['troll', 1]] },
      { id: 'bonethrone', k: 'relic', name: 'The Bone Throne', x: 6300, y: 7400, guard: [['giant', 1], ['skeleton', 4]] },
      { id: 'ashenking', k: 'relic', name: 'Tomb of the Ashen King', x: 7000, y: 8800, guard: [['giant', 1]] },
      { id: 'lastelf', k: 'relic', name: 'Barrow of the Last Elf', x: 1800, y: 3600, guard: [['ogre', 1]] },
      // strongholds
      { id: 'crownofash', k: 'castle', name: 'The Crown of Ash', x: 4700, y: 4650, guard: [['giant', 1], ['ogre', 2], ['troll', 1]] },
      { id: 'frostwatch', k: 'fort', name: 'Frostwatch Keep', x: 8600, y: 4600, guard: [['ogre', 2], ['bandit', 3]] },
      // crossings
      { id: 'willowbridge', k: 'bridge', name: 'Willowbridge', x: 2056, y: 3905 },
      { id: 'thornbridge', k: 'bridge', name: 'Thornbridge', x: 4094, y: 1479 },
      // shrines, caves, nests, watchtowers, waygates, ruins
      { id: 'hearthstone', k: 'shrine', name: 'Hearthstone Shrine', x: 2900, y: 7300 },
      { id: 'moonbower', k: 'shrine', name: 'Moonbower', x: 3000, y: 600 },
      { id: 'cindercave', k: 'cave', name: 'Cinder Cave', x: 2800, y: 8600, guard: [['troll', 2]] },
      { id: 'ossuary', k: 'cave', name: 'The Ossuary', x: 8300, y: 8500, guard: [['giant', 1]] },
      { id: 'giantsmaw', k: 'cave', name: "Giant's Maw", x: 4000, y: 7500, guard: [['giant', 1]] },
      { id: 'trollhole', k: 'cave', name: 'Troll Hole', x: 8000, y: 3000, guard: [['troll', 2]] },
      { id: 'rimecrag', k: 'nest', name: 'Rimecrag Eyrie', x: 6100, y: 2700, guard: [['troll', 1]] },
      { id: 'gallowseyrie', k: 'nest', name: 'Gallows Eyrie', x: 9000, y: 8400, guard: [['troll', 1]] },
      { id: 'lastwatch', k: 'watchtower', name: 'Lastwatch', x: 500, y: 6600 },
      { id: 'charnelwatch', k: 'watchtower', name: 'Charnel Watch', x: 6700, y: 7900 },
      { id: 'ashpeak', k: 'watchtower', name: 'Ashpeak Watch', x: 6300, y: 3300 },
      { id: 'westgate', k: 'waygate', name: 'Westgate', x: 2300, y: 4700 },
      { id: 'duskgate', k: 'waygate', name: 'Duskgate', x: 6300, y: 5500 },
      { id: 'cindergate', k: 'waygate', name: 'Cindergate', x: 6100, y: 1200 },
      { id: 'ashgate', k: 'waygate', name: 'Ashgate', x: 3500, y: 6200 },
      { id: 'abbey', k: 'ruins', name: 'Shattered Abbey', x: 9200, y: 4300, guard: [['ogre', 1], ['skeleton', 3]] },
      { id: 'kingshall', k: 'ruins', name: 'Hall of Fallen Kings', x: 3300, y: 9300, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'sunken', k: 'ruins', name: 'Sunken Temple', x: 1700, y: 9300, guard: [['troll', 1]] },
      { id: 'cinderabbey', k: 'ruins', name: 'Cinder Priory', x: 4800, y: 600, guard: [['ogre', 1]] },
      { id: 'charredmill', k: 'ruins', name: 'The Charred Mill', x: 600, y: 5600, guard: [['bandit', 3]] },
      { id: 'ilmwatch', k: 'ruins', name: 'Ruined Watch of Ilm', x: 5150, y: 2250, guard: [['ogre', 1]] },
    ],
    // game is scarce in the wastes
    wild: [
      { k: 'deer', x: 1700, y: 1200, n: 5 }, { k: 'deer', x: 3500, y: 1900, n: 4 }, { k: 'boar', x: 1500, y: 2900, n: 4 },
      { k: 'goat', x: 8800, y: 1100, n: 5 }, { k: 'goat', x: 9300, y: 3200, n: 4 }, { k: 'horse', x: 800, y: 7100, n: 4 },
      { k: 'horse', x: 2400, y: 8000, n: 3 }, { k: 'goat', x: 5800, y: 2300, n: 3 }, { k: 'boar', x: 8800, y: 6300, n: 3 },
      { k: 'deer', x: 5000, y: 8300, n: 3 }, { k: 'boar', x: 6200, y: 8900, n: 3 },
    ],
    runes: [[4700, 5100], [4200, 6400], [5400, 6300], [3400, 5000], [6000, 5100], [4600, 2300], [4400, 3300], [6800, 4300],
      [2500, 6900], [7600, 7100], [3600, 8500], [6100, 9200], [8600, 5300], [1500, 4600], [7000, 2700]],
  });
})(window.AS);
