/* WYRMCROWN — Map 9: Highmarch.
 * A highland march of ridge and vale. Three long ridges cross the middle of
 * the realm from west to east — the North Wall, the Midrib and the South Wall —
 * and between them lie two high vales, the Greyvale and the Ravenvale. Each
 * vale has its watershed at the centre, where an old castle stands: Greyhelm
 * in the Greyvale, Ravenscar in the Ravenvale. From tarns beside them the
 * Greyrun flows east to the sea of the moor and the Ravenrun west past the
 * woods. One trunk road climbs from the southern lowlands through the South
 * Pass, crosses both vales by the Midgap and the Heartvein mine, and runs out
 * by the North Pass to the heights. Great massifs fill the four corners.
 * Aldermere farms the lowlands in the south, Sylvara keeps the western woods
 * at the vales' west mouth, Hrimgard holds the heights in the north and
 * Morgrave the eastern moor at the vales' east mouth.
 * Strategy: a war of strongpoints. Forts hold both passes and all four vale
 * mouths, watchtowers line the outer roads, and the two castles sit where the
 * roads meet. Every route between realms runs past a fort, so whoever holds
 * the forts decides where armies and carts may go. */
'use strict';
(function (AS) {
  AS.Maps.add({
    id: 'highmarch', name: 'Highmarch', index: 9, w: 10400, h: 10400, seed: 909,
    blurb: 'Ridge and vale. Forts hold every pass and vale mouth, and two old castles stand on the watershed: a war of strongpoints.',
    difficulty: 'Very hard',
    regions: [
      { biome: 'human', x: 5200, y: 8800, r: 2700 },
      { biome: 'elf', x: 1500, y: 5150, r: 2600 },
      { biome: 'ice', x: 5200, y: 1500, r: 2800 },
      { biome: 'undead', x: 8900, y: 5250, r: 2600 },
      { biome: 'neutral', x: 5200, y: 5200, r: 2300 },
      { biome: 'neutral', x: 1900, y: 1900, r: 1300 },
      { biome: 'neutral', x: 8500, y: 1900, r: 1300 },
      { biome: 'neutral', x: 1900, y: 8500, r: 1300 },
      { biome: 'neutral', x: 8500, y: 8500, r: 1300 },
    ],
    factions: {
      human: { town: { x: 5200, y: 8750 }, gate: -Math.PI / 2 },
      elf: { town: { x: 1650, y: 5150 }, gate: 0 },
      ice: { town: { x: 5200, y: 1650 }, gate: Math.PI / 2 },
      undead: { town: { x: 8750, y: 5250 }, gate: Math.PI },
    },
    rivers: [
      // the Greyrun: from Greytarn east down the Greyvale and out across the moor
      { w: 60, pts: [[5900, 3800, 60], [6700, 3800, 80], [7500, 3700, 95], [8000, 3800, 105], [8500, 3950, 115], [9300, 3700, 130], [10000, 3600, 145], [10460, 3550, 155]] },
      // the Ravenrun: from Raventarn west down the Ravenvale and out past the woods
      { w: 60, pts: [[4500, 6600, 60], [3700, 6600, 80], [2900, 6700, 95], [2400, 6600, 105], [1900, 6450, 115], [1100, 6700, 130], [400, 6800, 145], [-60, 6850, 155]] },
    ],
    lakes: [
      { x: 5900, y: 3750, r: 220 }, // Greytarn
      { x: 4500, y: 6650, r: 220 }, // Raventarn
      { x: 4300, y: 600, r: 300 }, // Glassmere (frozen)
      { x: 6100, y: 9800, r: 300 }, // Stillwater
      { x: 400, y: 5550, r: 250 }, // Mirrorpool
      { x: 10000, y: 4850, r: 250 }, // the Gallow Fen
    ],
    mountains: [
      // the North Wall, broken by the North Pass
      { w: 330, h: 1.1, pts: [[3250, 3250], [3900, 3050], [4600, 3150]] },
      { w: 330, h: 1.1, pts: [[5800, 3150], [6700, 3000], [7300, 3250]] },
      // the Midrib between the vales, broken by the Midgap
      { w: 300, h: 0.9, pts: [[3200, 5150], [4000, 5250], [4600, 5150]] },
      { w: 300, h: 0.9, pts: [[5800, 5250], [6400, 5150], [7200, 5250]] },
      // the South Wall, broken by the South Pass
      { w: 330, h: 1.0, pts: [[3100, 7150], [3700, 7400], [4600, 7250]] },
      { w: 330, h: 1.0, pts: [[5800, 7250], [6500, 7350], [7150, 7150]] },
      // the corner massifs
      { w: 360, h: 1.15, pts: [[350, 3400], [1200, 2400], [2100, 1300], [2800, 350]] },
      { w: 360, h: 1.2, pts: [[7400, 350], [8300, 1100], [9100, 1800]] },
      { w: 360, h: 0.95, pts: [[10050, 7000], [9200, 8000], [8300, 9100], [7600, 10050]] },
      { w: 300, h: 0.75, pts: [[3000, 10050], [2100, 9300], [1300, 8600]] },
      // the Crown of Rime above Hrimgard, the Gallow Hills on the moor, the Harrow Downs
      { w: 280, h: 1.1, pts: [[4900, 350], [5500, 300], [6000, 500]] },
      { w: 260, h: 0.7, pts: [[9300, 3000], [9900, 2800]] },
      { w: 380, h: 0.45, pts: [[3000, 8950], [3700, 9050]] },
      // the high ground of the vales themselves: broad terraces round the Midrib
      { w: 1000, h: 0.34, pts: [[3500, 5200], [4500, 5200]] },
      { w: 1000, h: 0.34, pts: [[5900, 5220], [6900, 5220]] },
    ],
    forests: [
      { x: 1500, y: 4900, r: 1900, d: 1 },
      { x: 3000, y: 1700, r: 600, d: 0.8 },
      { x: 7600, y: 8800, r: 600, d: 0.9 },
      { x: 6600, y: 1350, r: 450, d: 0.8 },
      { x: 4300, y: 9200, r: 450, d: 0.7 },
      { x: 3400, y: 6900, r: 380, d: 0.75 },
      { x: 7000, y: 3500, r: 380, d: 0.75 },
      { x: 9300, y: 6200, r: 450, d: 0.85 },
      { x: 1200, y: 7600, r: 450, d: 0.85 },
      { x: 9300, y: 2700, r: 420, d: 0.75 },
    ],
    roads: [
      // the outer roads between neighbouring realms
      { pts: [[1650, 5150], [1850, 4450], [2000, 3900], [2800, 2950], [4000, 2200], [4700, 1800], [5200, 1650]] },
      { pts: [[5200, 1650], [6300, 2000], [7600, 2650], [8500, 3950], [8750, 5250]] },
      { pts: [[8750, 5250], [8550, 5950], [8400, 6500], [7600, 7450], [6400, 8200], [5700, 8600], [5200, 8750]] },
      { pts: [[5200, 8750], [4100, 8400], [2800, 7750], [1900, 6450], [1650, 5150]] },
      // the trunk road: South Pass, Midgap, North Pass
      { pts: [[5200, 1650], [5050, 2400], [5250, 3150], [5050, 3800], [5150, 4500], [5450, 5200], [5250, 5900], [5350, 6600], [5150, 7250], [5300, 7950], [5200, 8750]] },
      // the vale roads from the woods to the moor
      { pts: [[1650, 5150], [2600, 5150]] },
      { pts: [[8750, 5250], [7800, 5250]] },
      { pts: [[2600, 5150], [3000, 4600], [4100, 4700], [5150, 4500], [6300, 4550], [7400, 4700], [7800, 5250]] },
      { pts: [[7800, 5250], [7400, 5800], [6300, 5700], [5250, 5900], [4100, 5850], [3000, 5700], [2600, 5150]] },
    ],
    bridges: [
      { site: 'greyford', x: 8500, y: 3950, a: Math.atan2(2600, 1150) },
      { site: 'ravenford', x: 1900, y: 6450, a: Math.atan2(-2600, -1150) },
    ],
    sites: [
      // ---- the castles on the watershed ----
      { id: 'greyhelm', k: 'castle', name: 'Greyhelm', x: 4300, y: 4300, guard: [['giant', 2], ['ogre', 2]] },
      { id: 'ravenscar', k: 'castle', name: 'Ravenscar', x: 6100, y: 6100, guard: [['giant', 2], ['ogre', 2]] },
      { id: 'heartvein', k: 'goldmine', name: 'Heartvein Mine', x: 5200, y: 5200, rich: true, guard: [['giant', 1], ['troll', 2]] },
      { id: 'midgapwatch', k: 'watchtower', name: 'Midgap Watch', x: 4850, y: 4950, guard: [['ogre', 2]] },
      // ---- the strongpoints: pass forts and vale-mouth forts ----
      { id: 'northpass', k: 'fort', name: 'Northpass Fort', x: 5700, y: 2700, guard: [['troll', 2], ['bandit', 4]] },
      { id: 'southpass', k: 'fort', name: 'Southpass Fort', x: 4700, y: 7700, guard: [['troll', 2], ['bandit', 4]] },
      { id: 'wolfgate', k: 'fort', name: 'Wolfgate', x: 3500, y: 4000, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'greyrunfort', k: 'fort', name: 'Greyrun Keep', x: 7300, y: 4250, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'ravenrunfort', k: 'fort', name: 'Ravenrun Keep', x: 3100, y: 6150, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'moorgate', k: 'fort', name: 'Moorgate', x: 6900, y: 6400, guard: [['ogre', 2], ['troll', 1]] },
      // ---- the vales ----
      { id: 'highmarket', k: 'tradepost', name: 'Greyvale Market', x: 6400, y: 4250, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'lowmarket', k: 'tradepost', name: 'Ravenvale Market', x: 4000, y: 6150, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'stormcrag', k: 'wizardtower', name: 'Stormcrag Tower', x: 4200, y: 3650, guard: [['troll', 2]] },
      { id: 'duskcrag', k: 'wizardtower', name: 'Duskcrag Tower', x: 6200, y: 6750, guard: [['troll', 2]] },
      { id: 'marchspring', k: 'magicwell', name: 'Marchspring', x: 4700, y: 6250, guard: [['ogre', 2]] },
      { id: 'highwinds', k: 'shrine', name: 'Shrine of the High Winds', x: 5700, y: 4150, guard: [['ogre', 2]] },
      { id: 'highcrag', k: 'nest', name: 'Highcrag Eyrie', x: 3500, y: 2700, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'lowcrag', k: 'nest', name: 'Lowcrag Eyrie', x: 6900, y: 7700, guard: [['troll', 1], ['ogre', 1]] },
      // ---- the outer roads ----
      { id: 'wolfwatch', k: 'watchtower', name: 'Wolfwatch', x: 3000, y: 3500, guard: [['wolf', 4]] },
      { id: 'eaglewatch', k: 'watchtower', name: 'Eaglewatch', x: 7000, y: 2050, guard: [['bandit', 4]] },
      { id: 'moorwatch', k: 'watchtower', name: 'Moorwatch', x: 7400, y: 6900, guard: [['wolf', 4]] },
      { id: 'downwatch', k: 'watchtower', name: 'Downwatch', x: 3400, y: 8350, guard: [['bandit', 4]] },
      { id: 'pinegate', k: 'waygate', name: 'Pinewood Waygate', x: 2400, y: 2500, guard: [['troll', 1], ['wolf', 3]] },
      { id: 'rimegate', k: 'waygate', name: 'Rime Waygate', x: 8100, y: 2900, guard: [['troll', 1], ['wolf', 3]] },
      { id: 'barrowgate', k: 'waygate', name: 'Barrow Waygate', x: 8000, y: 7900, guard: [['troll', 1], ['wolf', 3]] },
      { id: 'downsgate', k: 'waygate', name: 'Downs Waygate', x: 2300, y: 7500, guard: [['troll', 1], ['wolf', 3]] },
      { id: 'greyford', k: 'bridge', name: 'Greyford', x: 8500, y: 3950 },
      { id: 'ravenford', k: 'bridge', name: 'Ravenford', x: 1900, y: 6450 },
      { id: 'ironmoor', k: 'goldmine', name: 'Ironmoor Mine', x: 7900, y: 2300, guard: [['ogre', 2], ['bandit', 3]] },
      { id: 'copperkettle', k: 'goldmine', name: 'Copperkettle Mine', x: 2500, y: 8100, guard: [['ogre', 2], ['bandit', 3]] },
      { id: 'highkeep', k: 'ruins', name: 'Fallen Highkeep', x: 2300, y: 1900, guard: [['ogre', 1], ['bandit', 4]] },
      { id: 'barrowhall', k: 'ruins', name: 'Barrowhall Ruins', x: 8100, y: 8500, guard: [['ogre', 1], ['bandit', 4]] },
      { id: 'rimewalleyrie', k: 'nest', name: 'Rimewall Eyrie', x: 8900, y: 1300, guard: [['troll', 1]] },
      { id: 'greendowneyrie', k: 'nest', name: 'Greendown Eyrie', x: 1500, y: 9100, guard: [['troll', 1]] },
      // ---- Hrimgard on the heights ----
      { id: 'frostvein', k: 'goldmine', name: 'Frostvein Mine', x: 4100, y: 2700, guard: [['wolf', 4]] },
      { id: 'rimeholt', k: 'village', name: 'Rimeholt', x: 6500, y: 950 },
      { id: 'coldhearth', k: 'village', name: 'Coldhearth', x: 3900, y: 1500, guard: [['wolf', 3]] },
      { id: 'rimefang', k: 'crystal', name: 'Rimefang Crystal', x: 8000, y: 1600, guard: [['troll', 1], ['wolf', 2]] },
      // ---- Aldermere in the lowlands ----
      { id: 'goldfurrow', k: 'goldmine', name: 'Goldfurrow Mine', x: 6300, y: 7700, guard: [['bandit', 4]] },
      { id: 'meadowbrook', k: 'village', name: 'Meadowbrook', x: 3900, y: 9450 },
      { id: 'barleyhithe', k: 'village', name: 'Barleyhithe', x: 6500, y: 8900, guard: [['wolf', 3]] },
      { id: 'dawnstone', k: 'shrine', name: 'Dawnstone Circle', x: 2400, y: 8800, guard: [['bandit', 3]] },
      // ---- Sylvara in the western woods ----
      { id: 'leafgold', k: 'goldmine', name: 'Leafgold Mine', x: 1300, y: 3700, guard: [['wolf', 4]] },
      { id: 'willowmere', k: 'village', name: 'Willowmere', x: 600, y: 6200 },
      { id: 'briarwood', k: 'village', name: 'Briarwood', x: 550, y: 4500, guard: [['wolf', 3]] },
      { id: 'elderglade', k: 'grove', name: 'Elderglade', x: 2550, y: 3700, guard: [['wolf', 3]] },
      // ---- Morgrave on the eastern moor ----
      { id: 'bonevein', k: 'goldmine', name: 'Bonevein Mine', x: 9100, y: 6700, guard: [['bandit', 4]] },
      { id: 'gallowmoor', k: 'village', name: 'Gallowmoor', x: 9800, y: 4200 },
      { id: 'cryptholm', k: 'village', name: 'Cryptholm', x: 9850, y: 5900, guard: [['wolf', 3]] },
      { id: 'thornbarrow', k: 'relic', name: 'Barrow of Thorns', x: 7850, y: 6700, guard: [['troll', 1]] },
    ],
    wild: [
      { k: 'deer', x: 1000, y: 3000, n: 5 }, { k: 'deer', x: 2700, y: 4500, n: 5 }, { k: 'deer', x: 900, y: 7100, n: 4 },
      { k: 'deer', x: 3300, y: 1100, n: 4 }, { k: 'deer', x: 4300, y: 4300, n: 4 },
      { k: 'goat', x: 6000, y: 2300, n: 6 }, { k: 'goat', x: 7800, y: 1100, n: 5 }, { k: 'goat', x: 3300, y: 2500, n: 5 },
      { k: 'goat', x: 6900, y: 4900, n: 4 }, { k: 'goat', x: 9600, y: 7600, n: 4 }, { k: 'goat', x: 4000, y: 7700, n: 4 },
      { k: 'horse', x: 4000, y: 8700, n: 5 }, { k: 'horse', x: 6900, y: 9400, n: 5 }, { k: 'horse', x: 2900, y: 9500, n: 4 },
      { k: 'horse', x: 5800, y: 5800, n: 4 },
      { k: 'boar', x: 9400, y: 3300, n: 4 }, { k: 'boar', x: 7700, y: 6200, n: 4 }, { k: 'boar', x: 9000, y: 9300, n: 3 },
      { k: 'boar', x: 7000, y: 3550, n: 3 }, { k: 'deer', x: 3500, y: 6950, n: 4 },
    ],
    runes: [[5200, 3700], [5200, 6650], [4300, 4700], [6100, 5700], [3600, 5500], [6800, 4900], [2700, 6300], [7700, 4100],
      [4600, 2500], [5800, 7900], [2600, 3000], [7800, 7400], [1200, 8200], [9300, 2200], [6000, 1400], [4400, 9000]],
  });
})(window.AS);
