/* WYRMCROWN — Map 4: The Riven Isles.
 * Long ago the sea broke the old kingdom into islands. Each realm now rules
 * its own great isle — Aldermere in the south-west, the Sylvaran isle in the
 * north-west, Hrimgard's ice-bound isle in the north-east and Morgrave's
 * blighted isle in the south-east — with its harbour market on the shore.
 * Only two land links survive: in the west, Wardholm, a fortified stepping
 * stone with a bridge to each side, joins Aldermere and Sylvara; in the east,
 * Eastholm does the same for Hrimgard and Morgrave. Everything else is reached
 * by wing: the Crown Isle in the middle with its ruined castle and the rich
 * Crowndeep mine, the North and South Isles with their mines and fishing
 * villages, four small isles with a wizard tower, a well, a crystal and a
 * relic, and the wave-beaten rocks with eyries, caves and watchtowers.
 * Strategy: an air war. Warbands only march between the linked pairs
 * (Aldermere–Sylvara, Hrimgard–Morgrave), so a realm's fleet of carts is safe
 * at home, but its rich prizes pay by courier and must be held by dragon. */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  AS.Maps.add({
    id: 'riven', name: 'The Riven Isles', index: 4, w: 11400, h: 9000, seed: 41,
    blurb: 'An archipelago. Each realm holds its own isle; the richest prizes can only be reached by dragon.',
    difficulty: 'Hard',
    regions: [
      { biome: 'elf', x: 2400, y: 2350, r: 2300 },
      { biome: 'ice', x: 9050, y: 2250, r: 1800 },
      { biome: 'human', x: 2400, y: 6650, r: 2300 },
      { biome: 'undead', x: 9000, y: 6650, r: 2300 },
      { biome: 'neutral', x: 5700, y: 4500, r: 2600 },
      { biome: 'neutral', x: 5700, y: 900, r: 1500 },
      { biome: 'neutral', x: 5700, y: 8100, r: 1500 },
      { biome: 'neutral', x: 9800, y: 4500, r: 1100 },
      { biome: 'neutral', x: 1600, y: 4500, r: 1100 },
      { biome: 'neutral', x: 7000, y: 600, r: 1000 },
      { biome: 'neutral', x: 7100, y: 3500, r: 1000 },
      { biome: 'neutral', x: 11000, y: 200, r: 800 },
      { biome: 'neutral', x: 11200, y: 3600, r: 900 },
    ],
    factions: {
      human: { town: { x: 2350, y: 6650 }, gate: -Math.PI / 2 },
      elf: { town: { x: 2350, y: 2350 }, gate: Math.PI / 2 },
      ice: { town: { x: 9050, y: 2350 }, gate: Math.PI / 2 },
      undead: { town: { x: 9050, y: 6650 }, gate: -Math.PI / 2 },
    },
    rivers: [],
    // the sea: one great water that covers the whole map; the islands rise out of it
    lakes: [
      { x: 5700, y: 4500, r: 6500, sx: 1.5, sy: 1.2 },
    ],
    islands: [
      // Aldermere Isle
      { x: 2450, y: 6650, r: 1550 }, { x: 3650, y: 6750, r: 600 }, { x: 1400, y: 7550, r: 600 },
      { x: 2750, y: 7900, r: 550 }, { x: 1100, y: 6350, r: 500 },
      // Sylvan Isle
      { x: 2450, y: 2350, r: 1550 }, { x: 3650, y: 2250, r: 600 }, { x: 1400, y: 1450, r: 600 },
      { x: 2750, y: 1100, r: 550 }, { x: 1100, y: 2650, r: 500 },
      // Hrimgard Isle
      { x: 8950, y: 2350, r: 1550 }, { x: 7750, y: 2250, r: 600 }, { x: 10000, y: 1450, r: 600 },
      { x: 8650, y: 1100, r: 550 }, { x: 10300, y: 2650, r: 500 },
      // Morgrave Isle
      { x: 8950, y: 6650, r: 1550 }, { x: 7750, y: 6750, r: 600 }, { x: 10000, y: 7550, r: 600 },
      { x: 8650, y: 7900, r: 550 }, { x: 10300, y: 6350, r: 500 },
      // the stepping stones
      { x: 1600, y: 4560, r: 450, sy: 1.8 },    // Wardholm
      { x: 9800, y: 4510, r: 450, sy: 1.26 },   // Eastholm
      // the Crown Isle and the North and South Isles
      { x: 5700, y: 4500, r: 750, sx: 1.35 },
      { x: 5700, y: 1050, r: 700, sx: 1.25 },
      { x: 5700, y: 7950, r: 700, sx: 1.25 },
      // the four small isles
      { x: 4550, y: 3150, r: 300 }, { x: 6850, y: 3150, r: 300 },
      { x: 4550, y: 5850, r: 300 }, { x: 6850, y: 5850, r: 300 },
      // rocks
      { x: 450, y: 4500, r: 260 }, { x: 10950, y: 4500, r: 260 },
      { x: 5700, y: 2700, r: 250 }, { x: 5700, y: 6300, r: 250 },
      { x: 4250, y: 650, r: 270 }, { x: 7150, y: 650, r: 270 },
      { x: 4250, y: 8350, r: 270 }, { x: 7150, y: 8350, r: 270 },
    ],
    mountains: [
      { w: 260, h: 0.75, pts: [[9600, 900], [10300, 1100]] },
    ],
    forests: [
      { x: 2300, y: 2300, r: 1500, d: 1 },
      { x: 1300, y: 1500, r: 450, d: 0.9 },
      { x: 9300, y: 1500, r: 500, d: 0.8 },
      { x: 9400, y: 7300, r: 600, d: 0.9 },
      { x: 1500, y: 7300, r: 400, d: 0.7 },
      { x: 5700, y: 4700, r: 400, d: 0.6 },
      { x: 5600, y: 7800, r: 300, d: 0.6 },
      { x: 5800, y: 1200, r: 300, d: 0.6 },
    ],
    roads: [
      // the western link: Aldermere → Wardholm → Sylvara
      { pts: [[2350, 6650], [1900, 6100], [1620, 5750], [1600, 5468], [1700, 5000], [1700, 4150], [1600, 3676], [1700, 3200], [2000, 2800], [2350, 2350]] },
      // the eastern link: Hrimgard → Eastholm → Morgrave
      { pts: [[9050, 2350], [9400, 2850], [9750, 3300], [9800, 3840], [9700, 4200], [9700, 4800], [9800, 5184], [9750, 5600], [9450, 6100], [9050, 6650]] },
      // harbour roads and village lanes
      { pts: [[2350, 6650], [3100, 6700], [3800, 6750]] },
      { pts: [[2350, 2350], [3100, 2300], [3800, 2250]] },
      { pts: [[9050, 2350], [8300, 2300], [7600, 2250]] },
      { pts: [[9050, 6650], [8300, 6700], [7600, 6750]] },
      { pts: [[2350, 6650], [1800, 7150], [1300, 7600]] },
      { pts: [[2350, 2350], [1800, 1850], [1300, 1400]] },
      { pts: [[9050, 2350], [9600, 1850], [10100, 1400]] },
      { pts: [[9050, 6650], [9600, 7150], [10100, 7600]] },
    ],
    bridges: [
      { site: 'wardbridge_s', x: 1600, y: 5468, a: Math.PI / 2 },
      { site: 'wardbridge_n', x: 1600, y: 3676, a: Math.PI / 2 },
      { site: 'eastbridge_n', x: 9800, y: 3840, a: Math.PI / 2 },
      { site: 'eastbridge_s', x: 9800, y: 5184, a: Math.PI / 2 },
    ],
    sites: [
      // Aldermere Isle
      { id: 'kelpwick', k: 'village', name: 'Kelpwick', x: 1300, y: 7600 },
      { id: 'tidecopper', k: 'goldmine', name: 'Tidecopper Mine', x: 2800, y: 8050, guard: [['wolf', 3]] },
      { id: 'harbourmarket', k: 'tradepost', name: 'Gullhaven Market', x: 3800, y: 6750, guard: [['bandit', 2]] },
      { id: 'seashrine', k: 'shrine', name: "Seafarer's Shrine", x: 950, y: 6350 },
      // Sylvan Isle
      { id: 'mossholm', k: 'village', name: 'Mossholm', x: 1300, y: 1400 },
      { id: 'fernhollow', k: 'goldmine', name: 'Fernhollow Mine', x: 2800, y: 950, guard: [['wolf', 3]] },
      { id: 'leafquay', k: 'tradepost', name: 'Leafquay', x: 3800, y: 2250, guard: [['bandit', 2]] },
      { id: 'moonfern', k: 'grove', name: 'Moonfern Grove', x: 950, y: 2650 },
      // Hrimgard Isle
      { id: 'rimeport', k: 'village', name: 'Rimeport', x: 10100, y: 1400 },
      { id: 'frostvein', k: 'goldmine', name: 'Frostvein Mine', x: 8600, y: 950, guard: [['wolf', 3]] },
      { id: 'icewharf', k: 'tradepost', name: 'Icewharf', x: 7600, y: 2250, guard: [['bandit', 2]] },
      { id: 'icecliff', k: 'nest', name: 'Icecliff Eyrie', x: 10450, y: 2650 },
      // Morgrave Isle
      { id: 'wrackmoor', k: 'village', name: 'Wrackmoor', x: 10100, y: 7600 },
      { id: 'gravelgrim', k: 'goldmine', name: 'Gravelgrim Mine', x: 8600, y: 8050, guard: [['wolf', 3]] },
      { id: 'blackwharf', k: 'tradepost', name: 'Blackwharf', x: 7600, y: 6750, guard: [['bandit', 2]] },
      { id: 'wreckaltar', k: 'shrine', name: "Wreckers' Altar", x: 10450, y: 6350 },
      // the land links
      { id: 'wardbridge_s', k: 'bridge', name: 'Wardholm South Bridge', x: 1600, y: 5468 },
      { id: 'wardbridge_n', k: 'bridge', name: 'Wardholm North Bridge', x: 1600, y: 3676 },
      { id: 'eastbridge_n', k: 'bridge', name: 'Eastholm North Bridge', x: 9800, y: 3840 },
      { id: 'eastbridge_s', k: 'bridge', name: 'Eastholm South Bridge', x: 9800, y: 5184 },
      { id: 'wardholm', k: 'fort', name: 'Wardholm', x: 1450, y: 4500, guard: [['ogre', 2], ['bandit', 4]] },
      { id: 'eastholm', k: 'fort', name: 'Eastholm', x: 9950, y: 4500, guard: [['ogre', 2], ['bandit', 4]] },
      // the Crown Isle
      { id: 'tidecrown', k: 'castle', name: 'Tidecrown', x: 5250, y: 4520, guard: [['giant', 2], ['ogre', 2]] },
      { id: 'crowndeep', k: 'goldmine', name: 'Crowndeep Mine', x: 6150, y: 4600, rich: true, guard: [['giant', 1], ['troll', 2]] },
      { id: 'gate_c', k: 'waygate', name: 'Crown Waygate', x: 5700, y: 4050 },
      // the North and South Isles
      { id: 'northdeep', k: 'goldmine', name: 'Northdeep Mine', x: 5300, y: 1050, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'gullholm', k: 'village', name: 'Gullholm', x: 6050, y: 1000, guard: [['bandit', 4]] },
      { id: 'southdeep', k: 'goldmine', name: 'Southdeep Mine', x: 6100, y: 7950, guard: [['ogre', 2], ['troll', 1]] },
      { id: 'seawick', k: 'village', name: 'Seawick', x: 5250, y: 7900, guard: [['bandit', 4]] },
      { id: 'gate_n', k: 'waygate', name: 'North Isle Waygate', x: 5700, y: 1450 },
      { id: 'gate_s', k: 'waygate', name: 'South Isle Waygate', x: 5700, y: 7550 },
      // the four small isles
      { id: 'silverspring', k: 'magicwell', name: 'Silverspring Isle', x: 4550, y: 3150, guard: [['troll', 1], ['wolf', 2]] },
      { id: 'frostshard', k: 'crystal', name: 'Frostshard', x: 6850, y: 3150, guard: [['troll', 2]] },
      { id: 'tempest', k: 'wizardtower', name: 'Tempest Tower', x: 4550, y: 5850, guard: [['troll', 1], ['ogre', 1]] },
      { id: 'seatomb', k: 'relic', name: 'Tomb of the Sea-King', x: 6850, y: 5850, guard: [['skeleton', 6], ['troll', 1]] },
      // the rocks
      { id: 'westmost', k: 'watchtower', name: 'Westmost Light', x: 450, y: 4500, guard: [['bandit', 2]] },
      { id: 'eastmost', k: 'watchtower', name: 'Eastmost Light', x: 10950, y: 4500, guard: [['bandit', 2]] },
      { id: 'stormeyrie', k: 'nest', name: 'Storm Eyrie', x: 5700, y: 2700, guard: [['troll', 2]] },
      { id: 'tideeyrie', k: 'nest', name: 'Tide Eyrie', x: 5700, y: 6300, guard: [['troll', 2]] },
      { id: 'drownedabbey', k: 'ruins', name: 'Drowned Abbey', x: 4250, y: 650, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'saltspire', k: 'ruins', name: 'Saltspire Ruins', x: 7150, y: 650, guard: [['ogre', 1], ['bandit', 3]] },
      { id: 'kelpcave', k: 'cave', name: 'Kelp Grotto', x: 4250, y: 8350, guard: [['giant', 1]] },
      { id: 'krakenhole', k: 'cave', name: 'Kraken Hole', x: 7150, y: 8350, guard: [['giant', 1]] },
    ],
    wild: [
      { k: 'deer', x: 2000, y: 1900, n: 6 }, { k: 'deer', x: 3200, y: 2900, n: 5 }, { k: 'deer', x: 1700, y: 3000, n: 4 },
      { k: 'horse', x: 3000, y: 6100, n: 5 }, { k: 'horse', x: 1800, y: 7600, n: 4 }, { k: 'boar', x: 3300, y: 7500, n: 4 },
      { k: 'goat', x: 9500, y: 1600, n: 5 }, { k: 'goat', x: 8400, y: 2900, n: 4 }, { k: 'deer', x: 9900, y: 2200, n: 4 },
      { k: 'boar', x: 9400, y: 7300, n: 4 }, { k: 'boar', x: 8300, y: 6100, n: 4 }, { k: 'goat', x: 9800, y: 6000, n: 4 },
      { k: 'deer', x: 5900, y: 4900, n: 4 }, { k: 'goat', x: 5500, y: 1400, n: 4 }, { k: 'boar', x: 5900, y: 7600, n: 3 },
      { k: 'goat', x: 1500, y: 4650, n: 3 }, { k: 'goat', x: 9850, y: 4400, n: 3 }, { k: 'horse', x: 2900, y: 7700, n: 3 },
    ],
    runes: [[5700, 4800], [5200, 4200], [6200, 4250], [5300, 1400], [6100, 7600], [4650, 3350], [6750, 5650], [3200, 6200],
      [3200, 2800], [8200, 2800], [8200, 6200], [1450, 5000], [9500, 4500], [5500, 900], [5900, 8100]],
  });
})(window.AS);
