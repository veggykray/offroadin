/* WYRMCROWN — Map 10: The Wyrmcrown.
 * The heart of the world. In the middle of the realm lies the Crownmere, a
 * round lake, and on the island at its heart stands the Wyrmcrown itself, the
 * castle of the first dragon-king, which no army can reach: only a rider can
 * take it, and its gold must go home by courier raven. Four rivers run from
 * the Crownmere to the four edges of the world and cut the land into four
 * quarters, one realm in each, as far from one another as the realm allows:
 * Morgrave's blight in the north-west, Hrimgard's glaciers under the
 * Frostcrown in the north-east, Sylvara's forest in the south-east and
 * Aldermere's farmland in the south-west.
 * A road rings the lake, crossing the four rivers on four bridges, with the
 * richest shrines, wells, eyries and waygates of the world along its shore.
 * Where the outer roads cross the northern and southern rivers, the rivers
 * part around river-islands: Goldholm in the north carries the Crownheart, the
 * richest mine in the land, shared by Morgrave and Hrimgard; Kingsholm in the
 * south carries the old castle of the same name, shared by Aldermere and
 * Sylvara. Forts and mines guard the eastern and western rivers.
 * Strategy: everything at once. Each realm has a quiet home quarter, two
 * contested river borders and a stake in the lake shore, where pairs of giants
 * guard the greatest prizes. The Wyrmcrown is the crown of the campaign. */
'use strict';
(function (AS) {
  AS.Maps.add({
    id: 'wyrmcrown', name: 'The Wyrmcrown', index: 10, w: 12000, h: 12000, seed: 1010,
    blurb: 'The castle of the first dragon-king rises from the Crownmere, reachable only on the wing. Four rivers, four realms, every prize at once.',
    difficulty: 'Legendary',
    regions: [
      { biome: 'undead', x: 2400, y: 2500, r: 3200 },
      { biome: 'ice', x: 9550, y: 2400, r: 3200 },
      { biome: 'elf', x: 9500, y: 9450, r: 3200 },
      { biome: 'human', x: 2450, y: 9550, r: 3200 },
      { biome: 'neutral', x: 6000, y: 6000, r: 3000 },
      { biome: 'neutral', x: 6000, y: 700, r: 1400 },
      { biome: 'neutral', x: 6000, y: 2700, r: 1100 },
      { biome: 'neutral', x: 6000, y: 9300, r: 1100 },
      { biome: 'neutral', x: 6000, y: 11300, r: 1400 },
      { biome: 'neutral', x: 700, y: 6000, r: 1400 },
      { biome: 'neutral', x: 11300, y: 6000, r: 1400 },
    ],
    factions: {
      human: { town: { x: 2450, y: 9550 }, gate: -Math.PI / 4 },
      elf: { town: { x: 9500, y: 9450 }, gate: -3 * Math.PI / 4 },
      ice: { town: { x: 9550, y: 2400 }, gate: 3 * Math.PI / 4 },
      undead: { town: { x: 2400, y: 2500 }, gate: Math.PI / 4 },
    },
    rivers: [
      // the Norrow: north from the Crownmere, parting round Goldholm
      { w: 100, pts: [[6000, 5100, 100], [6000, 4250, 110], [5950, 3700, 120], [6000, 3400, 120]] },
      { w: 90, pts: [[6000, 3400, 90], [5600, 3200, 90], [5450, 2850, 90], [5500, 2450, 90], [5700, 2100, 90], [6000, 1850, 90]] },
      { w: 90, pts: [[6000, 3400, 90], [6400, 3200, 90], [6550, 2850, 90], [6500, 2450, 90], [6300, 2100, 90], [6000, 1850, 90]] },
      { w: 130, pts: [[6000, 1850, 130], [6100, 1200, 140], [5950, 500, 150], [6000, -60, 160]] },
      // the Sudwater: south from the Crownmere, parting round Kingsholm
      { w: 100, pts: [[6000, 6900, 100], [6000, 7750, 110], [6050, 8300, 120], [6000, 8600, 120]] },
      { w: 90, pts: [[6000, 8600, 90], [5600, 8800, 90], [5450, 9150, 90], [5500, 9550, 90], [5700, 9900, 90], [6000, 10150, 90]] },
      { w: 90, pts: [[6000, 8600, 90], [6400, 8800, 90], [6550, 9150, 90], [6500, 9550, 90], [6300, 9900, 90], [6000, 10150, 90]] },
      { w: 130, pts: [[6000, 10150, 130], [5900, 10800, 140], [6050, 11500, 150], [6000, 12060, 160]] },
      // the Esk, east
      { w: 100, pts: [[6900, 6000, 100], [7750, 6000, 110], [8600, 5850, 120], [9500, 6050, 130], [10400, 5900, 140], [11300, 6050, 150], [12060, 6000, 160]] },
      // the Westway, west
      { w: 100, pts: [[5100, 6000, 100], [4250, 6000, 110], [3400, 6150, 120], [2500, 5950, 130], [1600, 6100, 140], [700, 5950, 150], [-60, 6000, 160]] },
    ],
    lakes: [
      { x: 6000, y: 6000, r: 1100 }, // the Crownmere
      { x: 3500, y: 1900, r: 300 }, // Blackmere
      { x: 10600, y: 4300, r: 300 }, // Glasswater (frozen)
      { x: 8700, y: 10500, r: 270 }, // Moonpool
      { x: 1400, y: 7700, r: 300 }, // Millmere
    ],
    islands: [
      { x: 6000, y: 6000, r: 480 }, // the isle of the Wyrmcrown
    ],
    mountains: [
      // the Tines: eight crags standing round the Crownmere like the points of a crown
      { w: 240, h: 1.1, pts: [[8402, 6995], [8725, 7129], [9049, 7263]] },
      { w: 240, h: 1.1, pts: [[6995, 8402], [7129, 8725], [7263, 9049]] },
      { w: 240, h: 1.1, pts: [[5005, 8402], [4871, 8725], [4737, 9049]] },
      { w: 240, h: 1.1, pts: [[3598, 6995], [3275, 7129], [2951, 7263]] },
      { w: 240, h: 1.1, pts: [[3598, 5005], [3275, 4871], [2951, 4737]] },
      { w: 240, h: 1.1, pts: [[5005, 3598], [4871, 3275], [4737, 2951]] },
      { w: 240, h: 1.1, pts: [[6995, 3598], [7129, 3275], [7263, 2951]] },
      { w: 240, h: 1.1, pts: [[8402, 5005], [8725, 4871], [9049, 4737]] },
      // the Frostcrown along Hrimgard's northern edge, and its eastern spur
      { w: 380, h: 1.25, pts: [[7600, 400], [8800, 800], [10200, 500], [11400, 900]] },
      { w: 300, h: 1.0, pts: [[11500, 3900], [11050, 5000]] },
      // Morgrave's crags: the Gravecrags, the northern teeth, the Ashen Teeth
      { w: 300, h: 1.0, pts: [[800, 700], [2000, 400]] },
      { w: 320, h: 1.05, pts: [[3800, 600], [4500, 1500]] },
      { w: 320, h: 0.95, pts: [[700, 4300], [1600, 4000], [1900, 4250]] },
      // the Thornback hills in Sylvara's forest and the southern ridges
      { w: 320, h: 0.85, pts: [[11300, 7700], [10400, 8000], [10100, 7750]] },
      { w: 320, h: 0.9, pts: [[8200, 11400], [7500, 10500]] },
      { w: 300, h: 0.85, pts: [[11200, 11300], [10000, 11600]] },
      // the Larkdowns and the Millhills of Aldermere
      { w: 300, h: 0.6, pts: [[4400, 11600], [3200, 11200], [1800, 11500], [600, 11100]] },
      { w: 260, h: 0.6, pts: [[500, 8100], [950, 7000]] },
    ],
    forests: [
      { x: 9400, y: 9300, r: 2300, d: 1 },
      { x: 1500, y: 2000, r: 700, d: 0.8 },
      { x: 4300, y: 2300, r: 450, d: 0.75 },
      { x: 10800, y: 2400, r: 600, d: 0.85 },
      { x: 8000, y: 3150, r: 420, d: 0.75 },
      { x: 1500, y: 9900, r: 450, d: 0.7 },
      { x: 4100, y: 9750, r: 420, d: 0.65 },
      { x: 4800, y: 3300, r: 420, d: 0.7 },
      { x: 7300, y: 8700, r: 450, d: 0.75 },
      { x: 3300, y: 7600, r: 450, d: 0.7 },
      { x: 8700, y: 4400, r: 450, d: 0.7 },
      { x: 3950, y: 7050, r: 380, d: 0.8 },
      { x: 1900, y: 5300, r: 450, d: 0.75 },
      { x: 10300, y: 6700, r: 420, d: 0.8 },
    ],
    roads: [
      // the outer roads between neighbouring realms
      { pts: [[2400, 2500], [3600, 2700], [4700, 2350], [5500, 2450], [6000, 2350], [6500, 2450], [7300, 2350], [8400, 2650], [9550, 2400]] },
      { pts: [[9550, 2400], [9750, 3600], [9800, 4900], [9500, 6050], [9550, 7300], [9450, 8300], [9500, 9450]] },
      { pts: [[9500, 9450], [8400, 9650], [7300, 9650], [6500, 9550], [6000, 9650], [5500, 9550], [4700, 9650], [3600, 9350], [2450, 9550]] },
      { pts: [[2450, 9550], [2250, 8400], [2450, 7000], [2500, 5950], [2300, 4700], [2450, 3600], [2400, 2500]] },
      // the four pilgrim roads to the lake
      { pts: [[2400, 2500], [3300, 3400], [4100, 4150], [4763, 4763]] },
      { pts: [[9550, 2400], [8650, 3350], [7850, 4150], [7237, 4763]] },
      { pts: [[9500, 9450], [8700, 8600], [7900, 7850], [7237, 7237]] },
      { pts: [[2450, 9550], [3350, 8650], [4150, 7850], [4763, 7237]] },
      // the lake road round the Crownmere
      { pts: [[7237, 7237], [6000, 7750], [4763, 7237], [4250, 6000], [4763, 4763], [6000, 4250], [7237, 4763], [7750, 6000], [7237, 7237]] },
    ],
    bridges: [
      { site: 'gildbridge', x: 5500, y: 2450, a: 0 },
      { site: 'orebridge', x: 6500, y: 2450, a: 0 },
      { site: 'holmbridge', x: 5500, y: 9550, a: Math.PI },
      { site: 'crownbridge', x: 6500, y: 9550, a: Math.PI },
      { site: 'eskbridge', x: 9500, y: 6050, a: Math.atan2(2400, -250) },
      { site: 'westwaybridge', x: 2500, y: 5950, a: Math.atan2(-2300, -150) },
      { x: 6000, y: 4250, a: 0 },
      { x: 7750, y: 6000, a: Math.PI / 2 },
      { x: 6000, y: 7750, a: Math.PI },
      { x: 4250, y: 6000, a: -Math.PI / 2 },
    ],
    sites: [
      // ---- the Crownmere ----
      { id: 'wyrmcrown', k: 'castle', name: 'The Wyrmcrown', x: 6000, y: 6000, guard: [['giant', 3], ['troll', 2]] },
      { id: 'spireofmere', k: 'wizardtower', name: 'Spire of the Mere', x: 7829, y: 6758, guard: [['giant', 1], ['troll', 2]] },
      { id: 'crownwell', k: 'magicwell', name: 'Crownwell', x: 6758, y: 7829, guard: [['giant', 2]] },
      { id: 'southmeregate', k: 'waygate', name: 'Southmere Waygate', x: 5242, y: 7829, guard: [['giant', 1], ['ogre', 2]] },
      { id: 'merewood', k: 'grove', name: 'Merewood Grove', x: 4171, y: 6758, guard: [['giant', 1], ['troll', 2]] },
      { id: 'drownedking', k: 'shrine', name: 'Shrine of the Drowned King', x: 4171, y: 5242, guard: [['giant', 2]] },
      { id: 'dragonbone', k: 'relic', name: 'Dragonbone Altar', x: 5242, y: 4171, guard: [['giant', 2]] },
      { id: 'northmeregate', k: 'waygate', name: 'Northmere Waygate', x: 6758, y: 4171, guard: [['giant', 1], ['ogre', 2]] },
      { id: 'stormcrown', k: 'crystal', name: 'Stormcrown Crystal', x: 7829, y: 5242, guard: [['giant', 2]] },
      // ---- the northern border: Goldholm on the Norrow (Morgrave / Hrimgard) ----
      { id: 'crownheart', k: 'goldmine', name: 'Crownheart Mine', x: 5950, y: 2900, rich: true, guard: [['giant', 2], ['ogre', 1]] },
      { id: 'gildbridge', k: 'bridge', name: 'Gildbridge', x: 5500, y: 2450 },
      { id: 'orebridge', k: 'bridge', name: 'Orebridge', x: 6500, y: 2450 },
      { id: 'norrowwatch', k: 'watchtower', name: 'Norrow Watch', x: 5300, y: 3700, guard: [['ogre', 2]] },
      { id: 'crageyrie', k: 'nest', name: 'Gravecrag Eyrie', x: 4400, y: 900, guard: [['troll', 2]] },
      { id: 'norrowgate', k: 'waygate', name: 'Norrow Waygate', x: 6700, y: 900, guard: [['troll', 1], ['ogre', 1]] },
      // ---- the southern border: Kingsholm on the Sudwater (Aldermere / Sylvara) ----
      { id: 'kingsholm', k: 'castle', name: 'Kingsholm', x: 6000, y: 9100, guard: [['giant', 2], ['ogre', 2]] },
      { id: 'holmbridge', k: 'bridge', name: 'Holmbridge', x: 5500, y: 9550 },
      { id: 'crownbridge', k: 'bridge', name: 'Sceptrebridge', x: 6500, y: 9550 },
      { id: 'sudwaterwatch', k: 'watchtower', name: 'Sudwater Watch', x: 6700, y: 8300, guard: [['ogre', 2]] },
      { id: 'trollfen', k: 'cave', name: 'Troll Fen Cave', x: 7600, y: 11100, guard: [['troll', 2]] },
      { id: 'sudwatergate', k: 'waygate', name: 'Sudwater Waygate', x: 5300, y: 11100, guard: [['troll', 1], ['ogre', 1]] },
      // ---- the eastern border: the Esk (Hrimgard / Sylvara) ----
      { id: 'eskbridge', k: 'bridge', name: 'Eskbridge', x: 9500, y: 6050 },
      { id: 'eskvein', k: 'goldmine', name: 'Eskvein Mine', x: 10700, y: 5350, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'eskhold', k: 'fort', name: 'Eskhold', x: 8850, y: 6850, guard: [['troll', 2], ['ogre', 2]] },
      { id: 'dawnway', k: 'waygate', name: 'Dawnway Gate', x: 11200, y: 6800, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'sunkenchapel', k: 'ruins', name: 'Fallen Chantry', x: 9100, y: 5250, guard: [['ogre', 2], ['bandit', 3]] },
      { id: 'eskwatch', k: 'watchtower', name: 'Eskwatch', x: 10300, y: 7300, guard: [['bandit', 4]] },
      // ---- the western border: the Westway (Morgrave / Aldermere) ----
      { id: 'westwaybridge', k: 'bridge', name: 'Westway Bridge', x: 2500, y: 5950 },
      { id: 'westvein', k: 'goldmine', name: 'Westvein Mine', x: 1300, y: 6650, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'westhold', k: 'fort', name: 'Westhold', x: 3150, y: 5150, guard: [['troll', 2], ['ogre', 2]] },
      { id: 'duskway', k: 'waygate', name: 'Duskway Gate', x: 800, y: 5200, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'barrowfield', k: 'ruins', name: 'Old Barrowfield', x: 2900, y: 6750, guard: [['ogre', 2], ['bandit', 3]] },
      { id: 'westwatch', k: 'watchtower', name: 'Westwatch', x: 1700, y: 4700, guard: [['bandit', 4]] },
      // ---- Morgrave's quarter (north-west) ----
      { id: 'gravewyrm', k: 'goldmine', name: 'Gravewyrm Mine', x: 1100, y: 3600, guard: [['bandit', 4]] },
      { id: 'hollowmere', k: 'village', name: 'Hollowmere', x: 3800, y: 1300 },
      { id: 'cinderby', k: 'village', name: 'Cinderby', x: 1000, y: 1500, guard: [['wolf', 3]] },
      { id: 'wightshollow', k: 'cave', name: "Wight's Hollow", x: 4000, y: 3300, guard: [['troll', 1], ['wolf', 3]] },
      { id: 'ashgrove', k: 'village', name: 'Ashgrove', x: 3200, y: 4300, guard: [['wolf', 3]] },
      // ---- Hrimgard's quarter (north-east) ----
      { id: 'rimewyrm', k: 'goldmine', name: 'Rimewyrm Mine', x: 10900, y: 3500, guard: [['wolf', 4]] },
      { id: 'frostholm', k: 'village', name: 'Winterhythe', x: 8200, y: 1300 },
      { id: 'snowfell', k: 'village', name: 'Snowfell', x: 11000, y: 1500, guard: [['wolf', 3]] },
      { id: 'frostcrowneyrie', k: 'nest', name: 'Hoarcrown Eyrie', x: 9500, y: 1000, guard: [['troll', 1], ['wolf', 2]] },
      { id: 'rimegatemarket', k: 'tradepost', name: 'Rimegate Market', x: 8150, y: 3550, guard: [['bandit', 3]] },
      // ---- Sylvara's quarter (south-east) ----
      { id: 'sylvanvein', k: 'goldmine', name: 'Sylvanvein Mine', x: 10900, y: 8400, guard: [['wolf', 4]] },
      { id: 'dewbrook', k: 'village', name: 'Dewbrook', x: 7700, y: 10200 },
      { id: 'thistledown', k: 'village', name: 'Thistledown', x: 11000, y: 10500, guard: [['wolf', 3]] },
      { id: 'heartwood', k: 'grove', name: 'Heartwood Grove', x: 8000, y: 8700, guard: [['wolf', 4]] },
      { id: 'moonhollow', k: 'village', name: 'Moonhollow', x: 8800, y: 7700, guard: [['wolf', 3]] },
      // ---- Aldermere's quarter (south-west) ----
      { id: 'wheatvein', k: 'goldmine', name: 'Wheatvein Mine', x: 1100, y: 8500, guard: [['bandit', 4]] },
      { id: 'brackenford', k: 'village', name: 'Brackenford', x: 3800, y: 10700 },
      { id: 'larkhill', k: 'village', name: 'Larkhill', x: 1000, y: 10500, guard: [['wolf', 3]] },
      { id: 'amberglass', k: 'wizardtower', name: 'Amberglass Tower', x: 2500, y: 11000, guard: [['bandit', 3]] },
      { id: 'kingsroadmarket', k: 'tradepost', name: 'Kingsroad Market', x: 3850, y: 8450, guard: [['bandit', 3]] },
    ],
    wild: [
      { k: 'deer', x: 9000, y: 8100, n: 6 }, { k: 'deer', x: 10600, y: 9700, n: 5 }, { k: 'deer', x: 7600, y: 9300, n: 4 },
      { k: 'deer', x: 3300, y: 7000, n: 4 }, { k: 'deer', x: 4700, y: 3000, n: 4 },
      { k: 'goat', x: 9000, y: 1700, n: 6 }, { k: 'goat', x: 11300, y: 2600, n: 5 }, { k: 'goat', x: 1400, y: 900, n: 4 },
      { k: 'goat', x: 4300, y: 1900, n: 4 }, { k: 'goat', x: 10400, y: 8700, n: 4 }, { k: 'goat', x: 7900, y: 11000, n: 4 },
      { k: 'horse', x: 1700, y: 9000, n: 6 }, { k: 'horse', x: 3200, y: 10300, n: 5 }, { k: 'horse', x: 7200, y: 5000, n: 4 },
      { k: 'horse', x: 4900, y: 7300, n: 4 }, { k: 'horse', x: 2000, y: 7300, n: 4 },
      { k: 'boar', x: 1800, y: 3100, n: 4 }, { k: 'boar', x: 3100, y: 3700, n: 4 }, { k: 'boar', x: 9200, y: 4800, n: 4 },
      { k: 'boar', x: 7000, y: 3300, n: 3 }, { k: 'boar', x: 10500, y: 6400, n: 3 }, { k: 'deer', x: 1300, y: 5500, n: 4 },
    ],
    runes: [[5500, 4650], [6500, 7350], [4650, 6500], [7350, 5500], [5000, 5000], [7000, 7000], [5000, 7000], [7000, 5000],
      [4400, 3700], [7600, 8300], [3600, 5800], [8400, 6200], [6450, 3700], [5550, 8300], [2700, 7900], [9300, 4100],
      [3300, 1500], [9100, 10950]],
  });
})(window.AS);
