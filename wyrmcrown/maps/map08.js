/* WYRMCROWN — Map 8: The Dragon's Spine.
 * At the heart of the realm a dead volcano has collapsed into a caldera: a
 * ring of high peaks, the Dragon's Spine, coils round a sheltered valley where
 * the old wyrms nested. Drakenhold, the castle of the dragon-kings, stands in
 * the middle of the valley among eyries, the Heartfire crystal, a hot spring
 * and the Wyrmhoard, the richest seam in the land. Three passes cut the ring:
 * the Ember Gate faces Aldermere in the south-west, the Fern Gate faces Sylvara
 * in the north-west, and the Dawn Gate opens east, between Hrimgard and
 * Morgrave, who must share it; the crests between them cannot be crossed on
 * foot (peaksBlock), so armies and carts must use the passes. Bare stone ribs run out from the ring like the
 * bones of a coiled dragon. Two meltwater rivers spill from tarns at the foot
 * of the Spine to the north and south edges, so the outer circuit road crosses
 * water only at Tearsbridge and Sorrowbridge.
 * Strategy: the realms sit in the four corners, each with a quiet home march,
 * and meet on the borders between them. Whoever holds the three gate forts
 * holds the caldera — but its giants are the strongest on the map, and a
 * realm that empties its town to storm the Spine invites a raid at home. */
'use strict';
(function (AS) {
  AS.Maps.add({
    id: 'dragonspine', name: "The Dragon's Spine", index: 8, w: 10400, h: 10400, seed: 808,
    blurb: 'A ring of peaks coils round the caldera where the dragon-kings nested. Three passes lead in; giants guard the castle and its eyries.',
    difficulty: 'Very hard',
    peaksBlock: 0.95, // the high Spine is a wall: armies and carts must use the three passes
    regions: [
      { biome: 'human', x: 1950, y: 8450, r: 2900 },
      { biome: 'elf', x: 1900, y: 1950, r: 2900 },
      { biome: 'ice', x: 8500, y: 1900, r: 2900 },
      { biome: 'undead', x: 8450, y: 8400, r: 2900 },
      { biome: 'neutral', x: 5200, y: 5200, r: 2700 },
      { biome: 'neutral', x: 5200, y: 700, r: 1200 },
      { biome: 'neutral', x: 5200, y: 9700, r: 1200 },
      { biome: 'neutral', x: 700, y: 5200, r: 1200 },
      { biome: 'neutral', x: 9700, y: 5200, r: 1200 },
    ],
    factions: {
      human: { town: { x: 1950, y: 8450 }, gate: -0.5 },
      elf: { town: { x: 1900, y: 1950 }, gate: 0.5 },
      ice: { town: { x: 8500, y: 1900 }, gate: 1.85 },
      undead: { town: { x: 8450, y: 8400 }, gate: -1.75 },
    },
    rivers: [
      // the Tearwater, from the Weeping Tarn north to the edge
      { w: 70, pts: [[5250, 2450, 70], [5150, 2000, 90], [5080, 1500, 110], [5180, 900, 130], [5100, 350, 150], [5060, -60, 160]] },
      // the Sorrowrun, from the Ashen Tarn south to the edge
      { w: 70, pts: [[5250, 7950, 70], [5300, 8400, 90], [5180, 8850, 110], [5300, 9500, 130], [5240, 10000, 150], [5260, 10460, 160]] },
    ],
    lakes: [
      { x: 5250, y: 2620, r: 210 }, // Weeping Tarn
      { x: 5250, y: 7800, r: 210 }, // Ashen Tarn
      { x: 3500, y: 950, r: 300 }, // Moonmere
      { x: 9450, y: 3650, r: 320 }, // Rimemere (frozen)
      { x: 6500, y: 9600, r: 320 }, // the Black Fen
      { x: 700, y: 6200, r: 260 }, // Millpond
    ],
    mountains: [
      // the Dragon's Spine: three great arcs round the caldera, broken by three passes
      { w: 420, h: 1.25, pts: [[6930, 5696], [6666, 6345], [6080, 6724], [5457, 7032], [4765, 6947]] },
      { w: 420, h: 1.25, pts: [[3905, 6450], [3475, 5897], [3440, 5200], [3485, 4507], [3905, 3950]] },
      { w: 440, h: 1.3, pts: [[4765, 3453], [5459, 3358], [6080, 3676], [6658, 4061], [6930, 4704]] },
      // the ribs: bare spurs running out from the ring
      { w: 280, h: 1.0, pts: [[6250, 7019], [6420, 7330], [6575, 7582]] },
      { w: 280, h: 1.0, pts: [[3100, 5200], [2850, 5230], [2650, 5180]] },
      { w: 280, h: 1.0, pts: [[6250, 3381], [6420, 3080], [6575, 2818]] },
      // the Frostfangs along Hrimgard's northern edge
      { w: 320, h: 1.05, pts: [[6900, 450], [7900, 700], [9300, 420]] },
      // the Ashen Crags east of Morgrave
      { w: 300, h: 0.85, pts: [[9900, 6500], [9350, 6760], [8950, 6650]] },
      // the Greenback Hills in Sylvara's south
      { w: 240, h: 0.6, pts: [[150, 3600], [900, 3360], [1300, 3480]] },
    ],
    forests: [
      { x: 1800, y: 2000, r: 2000, d: 1 },
      { x: 3500, y: 3800, r: 600, d: 0.8 },
      { x: 900, y: 4700, r: 650, d: 0.85 },
      { x: 2800, y: 9650, r: 550, d: 0.8 },
      { x: 3250, y: 6250, r: 380, d: 0.75 },
      { x: 7400, y: 9400, r: 600, d: 0.9 },
      { x: 9300, y: 5000, r: 520, d: 0.8 },
      { x: 6200, y: 1000, r: 520, d: 0.8 },
      { x: 9600, y: 2300, r: 420, d: 0.75 },
      { x: 7100, y: 6300, r: 380, d: 0.7 },
      { x: 4500, y: 9300, r: 420, d: 0.7 },
    ],
    roads: [
      // the outer circuit: Aldermere → Sylvara → Hrimgard → Morgrave → Aldermere
      { pts: [[1950, 8450], [2100, 6800], [1650, 5200], [2050, 3600], [1900, 1950]] },
      { pts: [[1900, 1950], [3300, 1650], [5080, 1500], [6800, 1700], [8500, 1900]] },
      { pts: [[8500, 1900], [8150, 3400], [7900, 4600], [7900, 5200], [7950, 6000], [8150, 7000], [8450, 8400]] },
      { pts: [[8450, 8400], [7000, 8700], [5180, 8850], [3400, 8800], [1950, 8450]] },
      // the three gate roads into the caldera
      { pts: [[1950, 8450], [2900, 7900], [3850, 7538], [4050, 7192], [4300, 6759], [4550, 6326], [4940, 5650]] },
      { pts: [[1900, 1950], [2900, 2500], [3850, 2862], [4050, 3208], [4300, 3641], [4550, 4074], [4940, 4750]] },
      { pts: [[7900, 5200], [7500, 5200], [7000, 5200], [6500, 5200], [5720, 5200]] },
      // the processional ring round Drakenhold
      { pts: [[5720, 5200], [5460, 5650], [4940, 5650], [4680, 5200], [4940, 4750], [5460, 4750], [5720, 5200]] },
    ],
    bridges: [
      { site: 'tearsbridge', x: 5080, y: 1500, a: 0.01 },
      { site: 'sorrowbridge', x: 5180, y: 8850, a: Math.PI - 0.01 },
    ],
    sites: [
      // ---- the caldera ----
      { id: 'drakenhold', k: 'castle', name: 'Drakenhold', x: 5200, y: 5200, guard: [['giant', 2], ['troll', 2]] },
      { id: 'wyrmhoard', k: 'goldmine', name: 'Wyrmhoard Mine', x: 5675, y: 4377, rich: true, guard: [['giant', 1], ['ogre', 2]] },
      { id: 'heartfire', k: 'crystal', name: 'Heartfire Crystal', x: 5675, y: 6023, guard: [['troll', 2], ['ogre', 1]] },
      { id: 'calderaspring', k: 'magicwell', name: 'Caldera Spring', x: 4250, y: 5200, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'vharageyrie', k: 'nest', name: 'Eyrie of Vharag', x: 6369, y: 5875, guard: [['giant', 1]] },
      { id: 'ashwingeyrie', k: 'nest', name: 'Ashwing Eyrie', x: 4031, y: 5875, guard: [['troll', 2]] },
      { id: 'skyfangeyrie', k: 'nest', name: 'Skyfang Eyrie', x: 5200, y: 3850, guard: [['giant', 1]] },
      { id: 'firstbones', k: 'relic', name: 'Bones of the First Wyrm', x: 4074, y: 4550, guard: [['giant', 1], ['ogre', 1]] },
      { id: 'spinegate', k: 'waygate', name: 'Spine Waygate', x: 5200, y: 6450, guard: [['ogre', 2]] },
      { id: 'coiledflame', k: 'shrine', name: 'Shrine of the Coiled Flame', x: 6326, y: 4550, guard: [['troll', 2]] },
      // ---- the gate forts and the outer eyries ----
      { id: 'embergate', k: 'fort', name: 'The Ember Gate', x: 3568, y: 7288, guard: [['troll', 2], ['ogre', 1]] },
      { id: 'ferngate', k: 'fort', name: 'The Fern Gate', x: 3568, y: 3112, guard: [['troll', 2], ['ogre', 1]] },
      { id: 'dawngate', k: 'fort', name: 'The Dawn Gate', x: 7564, y: 5617, guard: [['troll', 2], ['ogre', 1]] },
      { id: 'southribeyrie', k: 'nest', name: 'Southrib Eyrie', x: 6055, y: 7549, guard: [['troll', 1]] },
      { id: 'westribeyrie', k: 'nest', name: 'Westrib Eyrie', x: 2787, y: 4775, guard: [['troll', 1]] },
      { id: 'northribeyrie', k: 'nest', name: 'Northrib Eyrie', x: 6807, y: 3285, guard: [['troll', 1]] },
      // ---- Aldermere's march (south-west) ----
      { id: 'brightvein', k: 'goldmine', name: 'Brightvein Mine', x: 3350, y: 9450, guard: [['bandit', 4]] },
      { id: 'wheatwold', k: 'village', name: 'Wheatwold', x: 800, y: 7300 },
      { id: 'haywardcross', k: 'village', name: "Hayward's Cross", x: 2850, y: 6950, guard: [['wolf', 3]] },
      { id: 'amberspire', k: 'wizardtower', name: 'Amberspire', x: 650, y: 9500, guard: [['bandit', 3]] },
      // ---- Sylvara's march (north-west) ----
      { id: 'mossgold', k: 'goldmine', name: 'Lichengold Mine', x: 3300, y: 2150, guard: [['wolf', 4]] },
      { id: 'thornwick', k: 'village', name: 'Bramblewick', x: 750, y: 1100 },
      { id: 'fernhollow', k: 'village', name: 'Fernhollow', x: 2500, y: 520, guard: [['wolf', 3]] },
      { id: 'starbloom', k: 'grove', name: 'Glimmerbough Grove', x: 650, y: 2700, guard: [['wolf', 3]] },
      // ---- Hrimgard's march (north-east) ----
      { id: 'rimegold', k: 'goldmine', name: 'Rimegold Mine', x: 7300, y: 3000, guard: [['wolf', 4]] },
      { id: 'snowmantle', k: 'village', name: 'Snowmantle', x: 9650, y: 1150 },
      { id: 'hearthfrost', k: 'village', name: 'Hearthfrost', x: 7250, y: 1100, guard: [['wolf', 3]] },
      { id: 'rimeheart', k: 'crystal', name: 'Rimeheart Crystal', x: 9600, y: 3000, guard: [['troll', 1]] },
      // ---- Morgrave's march (south-east) ----
      { id: 'gravegold', k: 'goldmine', name: 'Gravegold Mine', x: 7300, y: 7400, guard: [['bandit', 4]] },
      { id: 'ashwick', k: 'village', name: 'Cindermoor', x: 9600, y: 9500 },
      { id: 'mournhollow', k: 'village', name: 'Mournhollow', x: 7350, y: 9750, guard: [['wolf', 3]] },
      { id: 'boneking', k: 'relic', name: 'Barrow of the Bone King', x: 9700, y: 7600, guard: [['troll', 1]] },
      // ---- the western border (Aldermere / Sylvara) ----
      { id: 'greystone', k: 'goldmine', name: 'Greystone Mine', x: 850, y: 5300, guard: [['ogre', 2]] },
      { id: 'sunsetgate', k: 'waygate', name: 'Sunset Waygate', x: 2550, y: 6150, guard: [['ogre', 1], ['wolf', 3]] },
      { id: 'westwind', k: 'shrine', name: 'Shrine of the West Wind', x: 2650, y: 4150 },
      { id: 'hollowmere', k: 'ruins', name: 'Hollowmere Ruins', x: 650, y: 4300, guard: [['ogre', 1], ['bandit', 3]] },
      // ---- the northern border (Sylvara / Hrimgard) ----
      { id: 'tearsbridge', k: 'bridge', name: 'Tearsbridge', x: 5080, y: 1500 },
      { id: 'riverfork', k: 'tradepost', name: 'Riverfork Market', x: 4550, y: 1200 },
      { id: 'tarnwatch', k: 'watchtower', name: 'Tarnwatch', x: 4400, y: 2450 },
      { id: 'northgate', k: 'waygate', name: 'Frostfall Waygate', x: 5900, y: 2350, guard: [['ogre', 1], ['wolf', 3]] },
      { id: 'wyrmlingden', k: 'cave', name: 'Wyrmling Den', x: 5900, y: 650, guard: [['troll', 2]] },
      // ---- the eastern border (Hrimgard / Morgrave) ----
      { id: 'embervein', k: 'goldmine', name: 'Embervein Mine', x: 9050, y: 5600, guard: [['ogre', 2]] },
      { id: 'duskgate', k: 'waygate', name: 'Dusk Waygate', x: 8600, y: 3900, guard: [['ogre', 1], ['wolf', 3]] },
      { id: 'cindershrine', k: 'shrine', name: 'Shrine of Cinders', x: 8700, y: 6250 },
      { id: 'cinderfall', k: 'ruins', name: 'Cinderfall Ruins', x: 9750, y: 4900, guard: [['ogre', 1], ['bandit', 3]] },
      // ---- the southern border (Aldermere / Morgrave) ----
      { id: 'sorrowbridge', k: 'bridge', name: 'Sorrowbridge', x: 5180, y: 8850 },
      { id: 'cairnmarket', k: 'tradepost', name: 'Cairn Market', x: 4400, y: 9150 },
      { id: 'sorrowwatch', k: 'watchtower', name: 'Sorrow Watch', x: 6050, y: 8150 },
      { id: 'giantslarder', k: 'cave', name: "Giant's Larder", x: 5850, y: 9850, guard: [['giant', 1]] },
    ],
    wild: [
      { k: 'deer', x: 2900, y: 3000, n: 6 }, { k: 'deer', x: 1100, y: 2300, n: 5 }, { k: 'deer', x: 3300, y: 600, n: 4 },
      { k: 'deer', x: 1200, y: 4500, n: 5 }, { k: 'deer', x: 3200, y: 9800, n: 4 }, { k: 'deer', x: 4500, y: 5650, n: 4 },
      { k: 'boar', x: 7500, y: 9100, n: 4 }, { k: 'boar', x: 9200, y: 8900, n: 4 }, { k: 'boar', x: 3300, y: 6400, n: 4 },
      { k: 'boar', x: 9300, y: 5200, n: 3 }, { k: 'boar', x: 6400, y: 1200, n: 3 },
      { k: 'goat', x: 7900, y: 1100, n: 6 }, { k: 'goat', x: 9900, y: 3600, n: 5 }, { k: 'goat', x: 6700, y: 2400, n: 5 },
      { k: 'goat', x: 9400, y: 7100, n: 4 }, { k: 'goat', x: 5800, y: 4500, n: 4 },
      { k: 'horse', x: 1000, y: 8300, n: 5 }, { k: 'horse', x: 3900, y: 8300, n: 5 }, { k: 'horse', x: 1500, y: 6100, n: 4 },
      { k: 'horse', x: 7200, y: 4900, n: 4 }, { k: 'deer', x: 6700, y: 8200, n: 4 },
    ],
    runes: [[5200, 4600], [4700, 5850], [5850, 5500], [3300, 5900], [6900, 5000], [4600, 3400], [6100, 7300], [2300, 4700],
      [7400, 6500], [4100, 8300], [6800, 2050], [3900, 1600], [1300, 6600], [9000, 4600], [8000, 8000], [2300, 2900]],
  });
})(window.AS);
