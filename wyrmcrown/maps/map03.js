/* WYRMCROWN — Map 3: Frostspine Pass.
 * The Frostspine, a wall of overlapping snow-capped ridges, runs west to east
 * across the whole realm and splits it in two. Only three passes cut through:
 * Wolfjaw in the west, the Keep Pass in the centre and Ravenmaw in the east.
 * North of the wall lie the Sylvaran forest (north-west) and Hrimgard's
 * frozen meres (north-east); south of it Aldermere's farmland (south-west)
 * and Morgrave's blight (south-east). Two meltwater rivers run off the range,
 * the Rimeflow north and the Blackrun south, each crossed by a single bridge.
 * Strategy: every army that wants to reach the other half has to march
 * through a pass, and every pass is held — forts in the west and east, and
 * Frostspine Keep, the old castle in the saddle of the central pass, between
 * two watchtowers. Holding the keep closes the shortest road between the
 * halves to your rivals. Dragons ignore the wall: eyries and troll caves are
 * hidden among the peaks, and a mana crystal and a relic flank the keep. */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  AS.Maps.add({
    id: 'frostspine', name: 'Frostspine Pass', index: 3, w: 9600, h: 10800, seed: 37,
    blurb: 'A mountain wall splits the realm. Three held passes are the only roads between north and south.',
    difficulty: 'Standard',
    regions: [
      { biome: 'elf', x: 1900, y: 2000, r: 2800 },
      { biome: 'ice', x: 7700, y: 2000, r: 2800 },
      { biome: 'human', x: 1900, y: 8800, r: 2800 },
      { biome: 'undead', x: 7700, y: 8800, r: 2800 },
      { biome: 'neutral', x: 4800, y: 5400, r: 2600 },
      { biome: 'neutral', x: 1000, y: 5400, r: 1500 },
      { biome: 'neutral', x: 8600, y: 5400, r: 1500 },
      { biome: 'neutral', x: 4800, y: 1300, r: 1400 },
      { biome: 'neutral', x: 4800, y: 9500, r: 1400 },
    ],
    factions: {
      human: { town: { x: 2000, y: 8700 }, gate: -Math.PI / 2 },
      elf: { town: { x: 2000, y: 2100 }, gate: Math.PI / 2 },
      ice: { town: { x: 7600, y: 2100 }, gate: Math.PI / 2 },
      undead: { town: { x: 7600, y: 8700 }, gate: -Math.PI / 2 },
    },
    rivers: [
      // Rimeflow: off the northern flank to the north edge
      { w: 80, pts: [[3550, 4500, 40], [3300, 3700, 70], [3600, 2900, 85], [3450, 2050, 100], [3700, 1100, 110], [3500, -60, 120]] },
      // Blackrun: off the southern flank to the south edge
      { w: 80, pts: [[6050, 6300, 40], [6300, 7100, 70], [6000, 7900, 85], [6150, 8750, 100], [5900, 9700, 110], [6100, 10860, 120]] },
    ],
    lakes: [
      { x: 6300, y: 3500, r: 480, sx: 1.35 },   // Glassmere (frozen)
      { x: 9100, y: 4250, r: 240 },             // frozen tarn
      { x: 3300, y: 7700, r: 300 },             // Aldermere millpond
      { x: 8400, y: 7150, r: 360 },             // Gloommere
    ],
    mountains: [
      // the Frostspine: main ridges between the passes
      { w: 480, h: 1.3, pts: [[-150, 5250], [500, 5400], [1300, 5470]] },
      { w: 480, h: 1.25, pts: [[2600, 5450], [3300, 5300], [3700, 5250], [4100, 5380]] },
      { w: 480, h: 1.25, pts: [[5500, 5420], [5900, 5550], [6300, 5550], [7000, 5350]] },
      { w: 480, h: 1.3, pts: [[8300, 5330], [9100, 5400], [9750, 5550]] },
      // northern and southern flanks
      { w: 400, h: 1.1, pts: [[-150, 4750], [500, 4820], [1000, 4920]] },
      { w: 400, h: 1.15, pts: [[-150, 5800], [500, 5950], [1000, 6000]] },
      { w: 400, h: 1.15, pts: [[2900, 4900], [3400, 4750], [3850, 4850]] },
      { w: 400, h: 1.1, pts: [[2900, 6000], [3400, 5880], [3850, 5950]] },
      { w: 400, h: 1.1, pts: [[5750, 4870], [6300, 4950], [6700, 4820]] },
      { w: 400, h: 1.15, pts: [[5750, 5950], [6300, 6080], [6700, 5900]] },
      { w: 400, h: 1.15, pts: [[8600, 4800], [9200, 4880], [9750, 5000]] },
      { w: 400, h: 1.1, pts: [[8600, 5880], [9200, 5980], [9750, 6150]] },
      // foothill spurs
      { w: 260, h: 0.85, pts: [[300, 4800], [100, 4300]] },
      { w: 260, h: 0.85, pts: [[700, 5950], [500, 6450]] },
      { w: 260, h: 0.85, pts: [[3600, 4780], [3800, 4300]] },
      { w: 260, h: 0.85, pts: [[3550, 5900], [3500, 6400]] },
      { w: 260, h: 0.85, pts: [[6050, 4900], [6100, 4400]] },
      { w: 260, h: 0.85, pts: [[6000, 6020], [5800, 6500]] },
      { w: 260, h: 0.85, pts: [[9300, 4900], [9450, 4500]] },
      { w: 260, h: 0.85, pts: [[9300, 6000], [9500, 6500]] },
      // Hrimgard's crags and the Morgrave tors
      { w: 300, h: 1.0, pts: [[8300, 250], [9300, 650], [9450, 1500]] },
      { w: 280, h: 0.8, pts: [[300, 10550], [1300, 10300]] },
      { w: 260, h: 0.7, pts: [[9300, 9300], [8800, 10500]] },
      { w: 240, h: 0.65, pts: [[200, 600], [700, 250]] },
    ],
    forests: [
      { x: 1900, y: 2000, r: 1900, d: 1 },
      { x: 4200, y: 2700, r: 600, d: 0.8 },
      { x: 7200, y: 1000, r: 700, d: 0.85 },
      { x: 8400, y: 3000, r: 500, d: 0.8 },
      { x: 1200, y: 4400, r: 500, d: 0.75 },
      { x: 8400, y: 6400, r: 500, d: 0.75 },
      { x: 1000, y: 8300, r: 500, d: 0.7 },
      { x: 3500, y: 6800, r: 450, d: 0.65 },
      { x: 8600, y: 8300, r: 650, d: 0.9 },
      { x: 7000, y: 9900, r: 500, d: 0.85 },
      { x: 5500, y: 8000, r: 420, d: 0.7 },
    ],
    roads: [
      // the northern road: Sylvara ↔ Hrimgard over the Rimeflow
      { pts: [[2000, 2100], [2700, 1950], [3450, 2050], [4300, 1900], [4800, 1850], [5300, 1800], [6300, 1900], [7600, 2100]] },
      // the southern road: Aldermere ↔ Morgrave over the Blackrun
      { pts: [[2000, 8700], [3300, 8900], [4300, 9000], [4800, 8950], [5300, 8900], [6150, 8750], [6900, 8850], [7600, 8700]] },
      // through Wolfjaw Pass (west)
      { pts: [[2000, 2100], [1800, 3200], [1850, 4300], [1900, 5450], [1900, 6500], [1800, 7600], [2000, 8700]] },
      // through Ravenmaw Pass (east)
      { pts: [[7600, 2100], [7800, 3200], [7700, 4300], [7700, 5350], [7750, 6500], [7800, 7600], [7600, 8700]] },
      // the Keep road through the central pass
      { pts: [[4800, 1850], [4750, 3000], [4600, 4000], [4550, 4700], [4550, 5400], [4550, 6100], [4750, 7200], [4800, 8950]] },
    ],
    bridges: [
      { site: 'rimebridge', x: 3450, y: 2050, a: 0.1 },
      { site: 'blackbridge', x: 6150, y: 8750, a: -0.1 },
    ],
    sites: [
      // the passes
      { id: 'frostkeep', k: 'castle', name: 'Frostspine Keep', x: 4850, y: 5400, guard: [['giant', 1], ['troll', 2], ['ogre', 1]] },
      { id: 'wolfjaw', k: 'fort', name: 'Wolfjaw Fort', x: 2200, y: 5450, guard: [['ogre', 2], ['bandit', 3]] },
      { id: 'ravenmaw', k: 'fort', name: 'Ravenmaw Fort', x: 7400, y: 5350, guard: [['ogre', 2], ['bandit', 3]] },
      { id: 'spinewatch_n', k: 'watchtower', name: 'North Spinewatch', x: 4850, y: 4600, guard: [['bandit', 3]] },
      { id: 'spinewatch_s', k: 'watchtower', name: 'South Spinewatch', x: 4750, y: 6200, guard: [['bandit', 3]] },
      { id: 'spineheart', k: 'crystal', name: 'Heart of the Spine', x: 5450, y: 5000, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'kingsbarrow', k: 'relic', name: 'Barrow of the Pass-Kings', x: 4150, y: 5800, guard: [['troll', 1], ['ogre', 1]] },
      // among the peaks
      { id: 'greyfang', k: 'nest', name: 'Greyfang Eyrie', x: 500, y: 5650, guard: [['troll', 1]] },
      { id: 'blackfang', k: 'nest', name: 'Blackfang Eyrie', x: 9100, y: 5150, guard: [['troll', 1]] },
      { id: 'trollhall', k: 'cave', name: 'Troll Hall', x: 3350, y: 5600, guard: [['troll', 2]] },
      { id: 'wyrmhole', k: 'cave', name: 'Wyrmhole', x: 6250, y: 5200, guard: [['troll', 2]] },
      // pass approaches
      { id: 'stormcairn', k: 'wizardtower', name: 'Stormcairn', x: 1200, y: 6700, guard: [['bandit', 3]] },
      { id: 'rimespire', k: 'wizardtower', name: 'Rimespire', x: 8400, y: 4100, guard: [['bandit', 3]] },
      { id: 'moonwell', k: 'magicwell', name: 'Moonwell', x: 1200, y: 4150, guard: [['wolf', 3]] },
      { id: 'gloomwell', k: 'magicwell', name: 'Gloomwell', x: 8350, y: 6450, guard: [['wolf', 3]] },
      { id: 'hawkwatch', k: 'watchtower', name: 'Hawkwatch', x: 2950, y: 4450 },
      { id: 'crowwatch', k: 'watchtower', name: 'Crowwatch', x: 6650, y: 6350 },
      { id: 'gate_nw', k: 'waygate', name: 'Wolfjaw Waygate', x: 2650, y: 4000 },
      { id: 'gate_ne', k: 'waygate', name: 'Glassmere Waygate', x: 6950, y: 4400 },
      { id: 'gate_sw', k: 'waygate', name: 'Millpond Waygate', x: 2650, y: 6400 },
      { id: 'gate_se', k: 'waygate', name: 'Ravenmaw Waygate', x: 6950, y: 6800 },
      // home lands
      { id: 'barleywick', k: 'village', name: 'Barleywick', x: 3200, y: 9400 },
      { id: 'copperhill', k: 'goldmine', name: 'Copperhill Mine', x: 850, y: 7550, guard: [['wolf', 3]] },
      { id: 'thornwick', k: 'village', name: 'Thornwick', x: 3000, y: 1300 },
      { id: 'leafdelve', k: 'goldmine', name: 'Leafdelve Mine', x: 850, y: 3250, guard: [['wolf', 3]] },
      { id: 'snowhearth', k: 'village', name: 'Snowhearth', x: 6400, y: 1400 },
      { id: 'icevein', k: 'goldmine', name: 'Icevein Mine', x: 8750, y: 3250, guard: [['wolf', 3]] },
      { id: 'ashcombe', k: 'village', name: 'Ashcombe', x: 6600, y: 9500 },
      { id: 'cinderpit', k: 'goldmine', name: 'Cinderpit Mine', x: 8850, y: 7750, guard: [['wolf', 3]] },
      // the contested middle of each half
      { id: 'frostfair', k: 'tradepost', name: 'Frostfair', x: 4800, y: 1450 },
      { id: 'harvestfair', k: 'tradepost', name: 'Harvest Fair', x: 4800, y: 9350 },
      { id: 'glasspit', k: 'goldmine', name: 'Glasspit Mine', x: 4300, y: 3500, guard: [['ogre', 2]] },
      { id: 'slagdeep', k: 'goldmine', name: 'Slagdeep Mine', x: 5300, y: 7300, guard: [['ogre', 2]] },
      { id: 'hoarfrost', k: 'village', name: 'Hoarfrost', x: 5300, y: 3300, guard: [['bandit', 3]] },
      { id: 'meadhall', k: 'village', name: 'Meadhollow', x: 4300, y: 8100, guard: [['bandit', 3]] },
      { id: 'rimebridge', k: 'bridge', name: 'Rimeflow Bridge', x: 3450, y: 2050 },
      { id: 'blackbridge', k: 'bridge', name: 'Blackbridge', x: 6150, y: 8750 },
      { id: 'icebarrow', k: 'ruins', name: 'Icebarrow', x: 4300, y: 600, guard: [['bandit', 3], ['wolf', 2]] },
      { id: 'saltruin', k: 'ruins', name: 'Ruined Tollhouse', x: 5300, y: 10200, guard: [['bandit', 3], ['wolf', 2]] },
      { id: 'bearden', k: 'cave', name: 'Bear Den', x: 2400, y: 500, guard: [['troll', 1], ['wolf', 2]] },
      { id: 'boarden', k: 'cave', name: 'Barrowdown Hole', x: 7200, y: 10300, guard: [['troll', 1], ['wolf', 2]] },
      // behind the towns
      { id: 'firstlight', k: 'shrine', name: 'Cairn of First Light', x: 750, y: 9700 },
      { id: 'hoarpeak', k: 'nest', name: 'Hoarpeak Eyrie', x: 8900, y: 1150, guard: [['troll', 1]] },
      { id: 'thornheart', k: 'grove', name: 'Thornheart Grove', x: 750, y: 1050, guard: [['wolf', 2]] },
      { id: 'ossuary', k: 'shrine', name: 'Ossuary of the Tors', x: 8700, y: 9600 },
    ],
    wild: [
      { k: 'deer', x: 1300, y: 2900, n: 6 }, { k: 'deer', x: 2900, y: 2700, n: 5 }, { k: 'deer', x: 4000, y: 2300, n: 4 },
      { k: 'deer', x: 1400, y: 7800, n: 4 }, { k: 'deer', x: 3800, y: 6900, n: 4 },
      { k: 'boar', x: 3600, y: 9800, n: 4 }, { k: 'boar', x: 8300, y: 8200, n: 4 }, { k: 'boar', x: 5500, y: 9800, n: 3 },
      { k: 'goat', x: 1600, y: 5100, n: 5 }, { k: 'goat', x: 2600, y: 5100, n: 4 }, { k: 'goat', x: 7000, y: 5700, n: 5 },
      { k: 'goat', x: 8000, y: 5700, n: 4 }, { k: 'goat', x: 9000, y: 2200, n: 5 }, { k: 'goat', x: 5300, y: 5900, n: 4 },
      { k: 'horse', x: 3000, y: 8200, n: 5 }, { k: 'horse', x: 1200, y: 9300, n: 4 }, { k: 'horse', x: 5900, y: 2300, n: 4 },
      { k: 'horse', x: 7300, y: 7600, n: 4 }, { k: 'deer', x: 7000, y: 2900, n: 4 }, { k: 'boar', x: 1500, y: 3700, n: 3 },
    ],
    runes: [[4400, 5000], [5200, 5800], [4300, 6500], [5300, 4300], [2350, 4950], [7250, 5850], [3800, 4300], [5800, 6500],
      [2500, 3300], [7100, 7500], [5500, 1100], [4100, 9700], [1600, 6100], [8000, 4700], [3500, 7300], [6100, 2600]],
  });
})(window.AS);
