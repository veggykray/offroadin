/* WYRMCROWN — Map 2: The Drowned Vale.
 * A whole valley lies under the Drownmere, a vast still lake fed from four
 * sides: the Rimewater from the northern fells, the Mirewater from the west,
 * the Ashbrook from the eastern blight and the Sedgerun from the southern
 * downs. The four realms sit on its four shores — Aldermere's farmland in the
 * south-west, the Sylvaran forest in the north-west, Hrimgard's snowy hills in
 * the north-east and Morgrave's blight in the south-east — joined by one shore
 * road that rings the lake and crosses each feeder river on a toll bridge.
 * Strategy: every river mouth is a border, and the marsh villages, mines and
 * trade posts beside them change hands all game. The real prize sits out on
 * the water: the Isle of Kings carries the drowned castle of Sunkenhold and the
 * rich Kingsdeep mine, which no army can march to. Only dragons reach it, its
 * gold comes home by courier, and the smaller isles hold a relic, a crystal,
 * a magic well and an eyrie for whoever rules the air over the lake. */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  AS.Maps.add({
    id: 'drowned', name: 'The Drowned Vale', index: 2, w: 10000, h: 10000, seed: 23,
    blurb: 'Four realms on the shores of one vast lake. Its island castle can only be taken from the air.',
    difficulty: 'Standard',
    regions: [
      { biome: 'human', x: 1900, y: 8100, r: 2700 },
      { biome: 'elf', x: 1800, y: 1900, r: 2700 },
      { biome: 'ice', x: 8200, y: 1800, r: 2300 },
      { biome: 'undead', x: 8100, y: 8100, r: 2500 },
      { biome: 'neutral', x: 5000, y: 5000, r: 3100 },
      { biome: 'neutral', x: 5000, y: 500, r: 1300 },
      { biome: 'neutral', x: 5000, y: 9500, r: 1300 },
      { biome: 'neutral', x: 500, y: 5000, r: 1100 },
      { biome: 'neutral', x: 9500, y: 5000, r: 1100 },
    ],
    factions: {
      human: { town: { x: 2050, y: 7950 }, gate: -Math.PI / 4 },
      elf: { town: { x: 1950, y: 2050 }, gate: Math.PI / 4 },
      ice: { town: { x: 7950, y: 2050 }, gate: Math.PI * 0.75 },
      undead: { town: { x: 7950, y: 7950 }, gate: -Math.PI * 0.75 },
    },
    rivers: [
      // Mirewater (west)
      { w: 90, pts: [[-60, 4750, 70], [800, 4900, 85], [1650, 4950, 100], [2250, 5050, 120], [2800, 5000, 140]] },
      // Rimewater (north)
      { w: 90, pts: [[5450, -60, 70], [5250, 800, 85], [5150, 1750, 100], [5300, 2400, 120], [5100, 3000, 140], [5050, 3250, 150]] },
      // Ashbrook (east)
      { w: 90, pts: [[10060, 5250, 70], [9200, 5100, 85], [8350, 5050, 100], [7750, 4950, 120], [7200, 5000, 140]] },
      // Sedgerun (south)
      { w: 90, pts: [[4550, 10060, 70], [4750, 9200, 85], [4850, 8250, 100], [4700, 7600, 120], [4900, 7000, 140], [4950, 6750, 150]] },
    ],
    lakes: [
      { x: 5000, y: 5000, r: 2100, sx: 1.12, sy: 1.0 },
      { x: 3500, y: 3800, r: 750 },
      { x: 6600, y: 6250, r: 800 },
      { x: 6550, y: 3700, r: 600 },
      { x: 3550, y: 6300, r: 600 },
    ],
    islands: [
      { x: 5000, y: 5000, r: 760, sx: 1.35, sy: 1.0 },  // Isle of Kings
      { x: 3450, y: 4900, r: 300 },                    // Barrow Isle (relic)
      { x: 6600, y: 4850, r: 300 },                    // Glimmer Isle (crystal)
      { x: 5000, y: 3500, r: 260 },                    // Well Isle
      { x: 4950, y: 6500, r: 270 },                    // Heron Isle (eyrie)
      // reedy islets
      { x: 4000, y: 6050, r: 140 }, { x: 6150, y: 3950, r: 130 }, { x: 5950, y: 6050, r: 160 },
      { x: 3950, y: 4050, r: 120 }, { x: 4200, y: 3500, r: 100 }, { x: 6900, y: 5700, r: 110 },
    ],
    mountains: [
      { w: 330, h: 1.1, pts: [[8400, 300], [9300, 900], [9700, 1900]] },
      { w: 320, h: 0.9, pts: [[9700, 8150], [9200, 9100], [8200, 9700]] },
      { w: 260, h: 0.7, pts: [[3300, 250], [4250, 420]] },
      { w: 260, h: 0.7, pts: [[6200, 380], [7100, 200]] },
      { w: 240, h: 0.6, pts: [[250, 3100], [500, 3700]] },
      { w: 240, h: 0.6, pts: [[9750, 6300], [9500, 6900]] },
      { w: 240, h: 0.55, pts: [[2700, 9750], [3600, 9600]] },
      { w: 260, h: 0.75, pts: [[300, 250], [1200, 300]] },
    ],
    forests: [
      { x: 1800, y: 2100, r: 1800, d: 1 },
      { x: 2200, y: 3600, r: 650, d: 0.75 },
      { x: 3600, y: 1150, r: 600, d: 0.8 },
      { x: 1000, y: 6800, r: 600, d: 0.7 },
      { x: 3300, y: 9150, r: 550, d: 0.7 },
      { x: 7050, y: 1100, r: 700, d: 0.85 },
      { x: 9000, y: 3100, r: 550, d: 0.8 },
      { x: 8950, y: 6900, r: 650, d: 0.9 },
      { x: 6700, y: 8950, r: 650, d: 0.85 },
      { x: 4600, y: 4800, r: 300, d: 0.6 },
      { x: 5450, y: 5200, r: 280, d: 0.6 },
    ],
    roads: [
      // the shore road: Aldermere → Sylvara over the Mirewater
      { pts: [[2050, 7950], [1750, 7000], [1600, 6000], [1650, 4950], [1700, 3950], [1750, 3000], [1950, 2050]] },
      // Sylvara → Hrimgard over the Rimewater
      { pts: [[1950, 2050], [3000, 1800], [4100, 1700], [5150, 1750], [6200, 1700], [7100, 1750], [7950, 2050]] },
      // Hrimgard → Morgrave over the Ashbrook
      { pts: [[7950, 2050], [8250, 3000], [8300, 4000], [8350, 5050], [8350, 6050], [8200, 7000], [7950, 7950]] },
      // Morgrave → Aldermere over the Sedgerun
      { pts: [[7950, 7950], [7000, 8250], [5900, 8250], [4850, 8250], [3800, 8300], [2900, 8250], [2050, 7950]] },
      // lakeside lanes from each town down to its marsh village
      { pts: [[2050, 7950], [2500, 7450], [2900, 7050]] },
      { pts: [[1950, 2050], [2400, 2550], [2850, 2950]] },
      { pts: [[7950, 2050], [7450, 2400], [6950, 2780]] },
      { pts: [[7950, 7950], [7600, 7650], [7250, 7350]] },
      // river-mouth tracks to the trade posts
      { pts: [[5900, 1700], [5750, 2300], [5750, 2750]] },
      { pts: [[4100, 8300], [4200, 7750], [4250, 7300]] },
    ],
    bridges: [
      { site: 'mirebridge', x: 1650, y: 4950, a: Math.PI / 2 },
      { site: 'rimebridge', x: 5150, y: 1750, a: 0 },
      { site: 'ashbridge', x: 8350, y: 5050, a: Math.PI / 2 },
      { site: 'sedgebridge', x: 4850, y: 8250, a: 0 },
    ],
    sites: [
      // out on the water: reachable only by dragon
      { id: 'sunkenhold', k: 'castle', name: 'Sunkenhold', x: 4700, y: 4980, guard: [['giant', 1], ['ogre', 2], ['troll', 1]] },
      { id: 'kingsdeep', k: 'goldmine', name: 'Kingsdeep Mine', x: 5600, y: 5080, rich: true, guard: [['giant', 1], ['ogre', 2]] },
      { id: 'barrowisle', k: 'relic', name: 'Barrow of the Drowned', x: 3450, y: 4900, guard: [['troll', 1]] },
      { id: 'glimmer', k: 'crystal', name: 'Glimmerstone', x: 6600, y: 4850, guard: [['troll', 1]] },
      { id: 'wellisle', k: 'magicwell', name: 'Stillwater Spring', x: 5000, y: 3500, guard: [['troll', 1]] },
      { id: 'heronnest', k: 'nest', name: 'Heron Isle Eyrie', x: 4950, y: 6500, guard: [['ogre', 2]] },
      // marsh villages on each realm's shore
      { id: 'reedwick', k: 'village', name: 'Reedwick', x: 2900, y: 7050 },
      { id: 'mossfen', k: 'village', name: 'Mossfen', x: 2850, y: 2950 },
      { id: 'rimeholm', k: 'village', name: 'Rimeholm', x: 6950, y: 2780 },
      { id: 'gloomwater', k: 'village', name: 'Gloomwater', x: 7250, y: 7350 },
      // lookouts over the lake
      { id: 'heronwatch', k: 'watchtower', name: 'Heronwatch', x: 2550, y: 6250 },
      { id: 'mistwatch', k: 'watchtower', name: 'Mistwatch', x: 3550, y: 2600 },
      { id: 'frostwatch', k: 'watchtower', name: 'Frostwatch', x: 7450, y: 3700 },
      { id: 'gravewatch', k: 'watchtower', name: 'Gravewatch', x: 6450, y: 7400 },
      // the western mouth (Aldermere / Sylvara)
      { id: 'mirebridge', k: 'bridge', name: 'Mirebridge', x: 1650, y: 4950 },
      { id: 'brackmoor', k: 'goldmine', name: 'Brackmoor Mine', x: 900, y: 6150, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'fenwick', k: 'village', name: 'Fenwick', x: 2250, y: 4100, guard: [['wolf', 3]] },
      { id: 'reedspire', k: 'wizardtower', name: 'Reedspire', x: 2450, y: 4650, guard: [['bandit', 3]] },
      { id: 'gate_w', k: 'waygate', name: 'Mirewater Waygate', x: 650, y: 5450 },
      { id: 'otterden', k: 'cave', name: 'Otter Hollow', x: 750, y: 3900, guard: [['troll', 2]] },
      // the northern mouth (Sylvara / Hrimgard)
      { id: 'rimebridge', k: 'bridge', name: 'Rimebridge', x: 5150, y: 1750 },
      { id: 'tinmoss', k: 'goldmine', name: 'Tinmoss Mine', x: 4150, y: 850, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'coldharbour', k: 'village', name: 'Coldharbour', x: 6150, y: 2450, guard: [['wolf', 3]] },
      { id: 'northmarket', k: 'tradepost', name: 'Fishgate Market', x: 5750, y: 2800 },
      { id: 'greywater', k: 'fort', name: 'Greywater Fort', x: 4250, y: 2550, guard: [['bandit', 4], ['ogre', 1]] },
      { id: 'gate_n', k: 'waygate', name: 'Rimewater Waygate', x: 6350, y: 850 },
      { id: 'fellruin', k: 'ruins', name: 'Fellstone Ruins', x: 2850, y: 700, guard: [['bandit', 3], ['wolf', 2]] },
      // the eastern mouth (Hrimgard / Morgrave)
      { id: 'ashbridge', k: 'bridge', name: 'Ashbridge', x: 8350, y: 5050 },
      { id: 'saltcrag', k: 'goldmine', name: 'Saltcrag Mine', x: 9100, y: 3850, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'blackmere', k: 'village', name: 'Blackmere', x: 7750, y: 5900, guard: [['wolf', 3]] },
      { id: 'duskspire', k: 'wizardtower', name: 'Duskspire', x: 7600, y: 5500, guard: [['bandit', 3]] },
      { id: 'gate_e', k: 'waygate', name: 'Ashbrook Waygate', x: 9350, y: 4550 },
      { id: 'eeldeep', k: 'cave', name: 'Eel Deep', x: 9250, y: 6100, guard: [['troll', 2]] },
      // the southern mouth (Morgrave / Aldermere)
      { id: 'sedgebridge', k: 'bridge', name: 'Sedgebridge', x: 4850, y: 8250 },
      { id: 'cinderfold', k: 'goldmine', name: 'Cinderfold Mine', x: 5850, y: 9150, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'sedgeford', k: 'village', name: 'Sedgeford', x: 3850, y: 7550, guard: [['wolf', 3]] },
      { id: 'southmarket', k: 'tradepost', name: 'Eelmarket', x: 4250, y: 7300 },
      { id: 'drownedfort', k: 'fort', name: 'Mirefast', x: 5800, y: 7550, guard: [['bandit', 4], ['ogre', 1]] },
      { id: 'gate_s', k: 'waygate', name: 'Sedgerun Waygate', x: 3650, y: 9150 },
      { id: 'downsruin', k: 'ruins', name: 'Sunken Chapel', x: 7150, y: 9300, guard: [['bandit', 3], ['wolf', 2]] },
      // behind the towns
      { id: 'dawnstone', k: 'shrine', name: 'Dawnstone', x: 850, y: 8950 },
      { id: 'elderglade', k: 'grove', name: 'Elderglade', x: 850, y: 1150 },
      { id: 'rimeeyrie', k: 'nest', name: 'Rimecrag Eyrie', x: 9050, y: 1150, guard: [['troll', 1]] },
      { id: 'bonealtar', k: 'shrine', name: 'Altar of Bones', x: 8850, y: 8700 },
    ],
    wild: [
      { k: 'deer', x: 1300, y: 2900, n: 6 }, { k: 'deer', x: 2900, y: 1500, n: 5 }, { k: 'deer', x: 2600, y: 3500, n: 4 },
      { k: 'deer', x: 4500, y: 5150, n: 4 }, { k: 'deer', x: 6900, y: 1500, n: 4 }, { k: 'deer', x: 1200, y: 7200, n: 4 },
      { k: 'boar', x: 3200, y: 8900, n: 4 }, { k: 'boar', x: 6600, y: 8600, n: 4 }, { k: 'boar', x: 8800, y: 6500, n: 4 },
      { k: 'boar', x: 1100, y: 4300, n: 3 },
      { k: 'goat', x: 8700, y: 1700, n: 5 }, { k: 'goat', x: 8800, y: 9300, n: 5 }, { k: 'goat', x: 3800, y: 500, n: 4 },
      { k: 'goat', x: 6700, y: 500, n: 4 }, { k: 'goat', x: 9300, y: 2700, n: 4 },
      { k: 'horse', x: 3000, y: 7800, n: 5 }, { k: 'horse', x: 600, y: 7400, n: 4 }, { k: 'horse', x: 5600, y: 8800, n: 5 },
      { k: 'horse', x: 9200, y: 5500, n: 4 }, { k: 'deer', x: 5900, y: 2000, n: 4 },
    ],
    runes: [[5200, 4650], [4400, 5250], [2200, 5500], [7800, 4550], [4650, 2250], [5400, 7750], [3300, 2200], [6750, 7900],
      [1200, 5600], [8800, 4300], [2600, 8800], [7600, 1300], [2350, 5750], [7900, 3900], [6000, 2300], [3950, 7900]],
  });
})(window.AS);
