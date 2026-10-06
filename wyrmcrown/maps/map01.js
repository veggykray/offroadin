/* WYRMCROWN — Map 1: The Sundered Crown.
 * The classic four-corner realm. A great river, the Silverrun, runs north to
 * south through the heartland lake of Mirrormere and splits the realm in two;
 * four bridges and two fords are the only crossings for armies and carts.
 * Aldermere's farmland lies in the south-west, the Sylvaran forest in the
 * north-west, Hrimgard's glaciers behind the Frostspine in the north-east and
 * Morgrave's blight beyond the Ashen Crags in the south-east. The heartland is
 * rich and contested: the Heartstone mine, the ruined castle of Crownhold and
 * the Mirror Spring all lie within a few wingbeats of each other. */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  AS.Maps.add({
    id: 'sundered', name: 'The Sundered Crown', w: 9600, h: 9600, seed: 11,
    blurb: 'Four realms around one great river. The heartland lake and its ruined crown-castle are the prize every dragon will want.',
    difficulty: 'Standard',
    regions: [
      { biome: 'human', x: 2000, y: 7500, r: 3000 },
      { biome: 'elf', x: 1800, y: 1900, r: 3000 },
      { biome: 'ice', x: 7700, y: 1700, r: 2900 },
      { biome: 'undead', x: 7800, y: 7800, r: 2900 },
      { biome: 'neutral', x: 4800, y: 4800, r: 2350 },
      { biome: 'neutral', x: 4800, y: 900, r: 1300 },
      { biome: 'neutral', x: 4800, y: 8800, r: 1300 },
      { biome: 'neutral', x: 700, y: 4800, r: 1100 },
      { biome: 'neutral', x: 8900, y: 4800, r: 1100 },
    ],
    factions: {
      human: { town: { x: 2000, y: 7500 }, gate: 0 },
      elf: { town: { x: 1850, y: 1950 }, gate: 0.5 },
      ice: { town: { x: 7650, y: 1850 }, gate: Math.PI },
      undead: { town: { x: 7650, y: 7650 }, gate: Math.PI },
    },
    rivers: [
      { w: 96, pts: [[5200, -60], [5120, 900], [4720, 2100], [4960, 3300], [4720, 4300], [4850, 4900], [4600, 5600], [4860, 6700], [4560, 7900], [4760, 9660]] },
      { w: 62, pts: [[-60, 3720], [900, 3900], [2000, 4100], [3200, 4500], [4300, 4760]] },
      { w: 64, pts: [[9660, 3640], [8500, 3920], [7300, 4300], [6100, 4660], [5300, 4880]] },
    ],
    lakes: [
      { x: 4850, y: 4900, r: 540 },
      { x: 1200, y: 6050, r: 250 },
      { x: 2950, y: 1120, r: 330 },
      { x: 8600, y: 950, r: 300 },
      { x: 8250, y: 6250, r: 380 },
    ],
    mountains: [
      { w: 380, h: 1.0, pts: [[5800, 150], [6200, 1150], [6080, 2000]] },
      { w: 360, h: 0.95, pts: [[6450, 2950], [7400, 3330], [8400, 3220], [9550, 3420]] },
      { w: 330, h: 1.2, pts: [[8150, 500], [8900, 1450], [9350, 2350]] },
      { w: 330, h: 0.85, pts: [[6000, 9450], [6320, 8400], [6260, 7720]] },
      { w: 300, h: 0.8, pts: [[6560, 6300], [7500, 6020], [8600, 5900], [9550, 5620]] },
      { w: 280, h: 0.75, pts: [[250, 4650], [1350, 4480]] },
      { w: 260, h: 0.55, pts: [[3150, 9350], [3850, 8750]] },
      { w: 300, h: 0.6, pts: [[5600, 5420], [6400, 5100]] },
      { w: 220, h: 0.55, pts: [[350, 600], [1250, 320]] },
    ],
    forests: [
      { x: 1700, y: 2050, r: 1850, d: 1 },
      { x: 3200, y: 3000, r: 850, d: 0.8 },
      { x: 950, y: 8800, r: 600, d: 0.85 },
      { x: 3750, y: 6900, r: 520, d: 0.7 },
      { x: 6950, y: 1150, r: 720, d: 0.9 },
      { x: 8750, y: 2700, r: 480, d: 0.8 },
      { x: 6850, y: 8650, r: 820, d: 0.95 },
      { x: 8950, y: 8950, r: 520, d: 0.85 },
      { x: 4000, y: 5600, r: 520, d: 0.75 },
      { x: 5800, y: 3600, r: 480, d: 0.7 },
      { x: 600, y: 7200, r: 400, d: 0.7 },
    ],
    roads: [
      // Aldermere ↔ Morgrave through Kingsbridge
      { pts: [[2000, 7500], [3300, 7420], [4710, 7300], [5600, 7350], [6200, 7350], [7650, 7650]] },
      // Aldermere ↔ Sylvara through Mossbridge
      { pts: [[2000, 7500], [2250, 6000], [2500, 4800], [2510, 4270], [2250, 3200], [1850, 1950]] },
      // Sylvara ↔ Hrimgard through Elderbridge and the Frostspine pass
      { pts: [[1850, 1950], [3200, 1750], [4790, 2080], [5600, 2350], [6250, 2480], [7650, 1850]] },
      // Hrimgard ↔ Morgrave through Frostford and the Crags pass
      { pts: [[7650, 1850], [6900, 2700], [6400, 3200], [6650, 4440], [6850, 5600], [6380, 6800], [7650, 7650]] },
      // heartland roads round Mirrormere
      { pts: [[2500, 4800], [3500, 4950], [4200, 4300], [5450, 4300], [6650, 4440]] },
      { pts: [[3300, 7420], [3300, 6300], [4000, 5800], [4600, 5900], [5700, 5650], [6050, 5150], [6850, 5600]] },
      { pts: [[4200, 4300], [4300, 2300], [4790, 2080]] },
      { pts: [[5600, 7350], [5500, 6900], [4600, 5900]] },
      { pts: [[3500, 8300], [3300, 7420]] },
    ],
    // ground armies and carts cross the water only here
    bridges: [
      { site: 'kingsbridge', x: 4710, y: 7300, a: 0 },
      { site: 'mossbridge', x: 2510, y: 4270, a: Math.PI / 2 },
      { site: 'elderbridge', x: 4790, y: 2080, a: 0.12 },
      { site: 'frostford', x: 6650, y: 4440, a: Math.PI / 2 - 0.2 },
      { x: 4220, y: 4730, a: 0.4 },
      { x: 5470, y: 4870, a: 0 },
    ],
    sites: [
      // gold mines
      { id: 'copperdell', k: 'goldmine', name: 'Copperdell Mine', x: 3300, y: 6250, guard: [['bandit', 4]] },
      { id: 'elmshade', k: 'goldmine', name: 'Elmshade Mine', x: 3350, y: 2850, guard: [['wolf', 4]] },
      { id: 'rimehold', k: 'goldmine', name: 'Rimehold Mine', x: 6900, y: 3800, guard: [['troll', 1]] },
      { id: 'gravelpit', k: 'goldmine', name: 'Gravelpit Mine', x: 6750, y: 6200, guard: [['ogre', 2]] },
      { id: 'heartstone', k: 'goldmine', name: 'Heartstone Mine', x: 5750, y: 5750, rich: true, guard: [['giant', 1], ['ogre', 1]] },
      { id: 'northreach', k: 'goldmine', name: 'Northreach Mine', x: 4100, y: 950, guard: [['ogre', 2]] },
      { id: 'southmarch', k: 'goldmine', name: 'Southmarch Mine', x: 4200, y: 8850, guard: [['bandit', 5]] },
      // villages
      { id: 'millbrook', k: 'village', name: 'Millbrook', x: 3500, y: 8300 },
      { id: 'thistlewick', k: 'village', name: 'Thistlewick', x: 1150, y: 5500, guard: [['wolf', 3]] },
      { id: 'oakhollow', k: 'village', name: 'Oakhollow', x: 3000, y: 4800 },
      { id: 'fernvale', k: 'village', name: 'Fernvale', x: 3450, y: 1150 },
      { id: 'icemere', k: 'village', name: 'Icemere', x: 5900, y: 1500, guard: [['wolf', 3]] },
      { id: 'duskwater', k: 'village', name: 'Duskwater', x: 8400, y: 4650, guard: [['bandit', 3]] },
      { id: 'ashby', k: 'village', name: 'Ashby', x: 5550, y: 8350 },
      // trade
      { id: 'crossroads', k: 'tradepost', name: 'Crossroads Market', x: 4150, y: 4250 },
      { id: 'riverside', k: 'tradepost', name: 'Riverside Bazaar', x: 5450, y: 6900 },
      // magic
      { id: 'stormspire', k: 'wizardtower', name: 'Stormspire', x: 2250, y: 5950, guard: [['bandit', 2]] },
      { id: 'moonspire', k: 'wizardtower', name: 'Moonspire', x: 8350, y: 5150, guard: [['troll', 1]] },
      { id: 'mirrorspring', k: 'magicwell', name: 'Mirror Spring', x: 5480, y: 4450 },
      { id: 'starfall', k: 'grove', name: 'Starfall Grove', x: 3950, y: 5450, guard: [['wolf', 3]] },
      { id: 'rimecrystal', k: 'crystal', name: 'Rimecrystal', x: 8050, y: 3750, guard: [['troll', 1]] },
      { id: 'barrow', k: 'relic', name: 'Barrow of Kings', x: 7050, y: 8850, guard: [['giant', 1]] },
      // strongholds
      { id: 'greywatch', k: 'fort', name: 'Greywatch Fort', x: 4250, y: 2500, guard: [['bandit', 5]] },
      { id: 'bastion', k: 'fort', name: 'Ruined Bastion', x: 7100, y: 5150, guard: [['ogre', 2]] },
      { id: 'crownhold', k: 'castle', name: 'Crownhold', x: 6050, y: 5150, guard: [['giant', 1], ['ogre', 2]] },
      // crossings
      { id: 'kingsbridge', k: 'bridge', name: 'Kingsbridge', x: 4710, y: 7300 },
      { id: 'mossbridge', k: 'bridge', name: 'Mossbridge', x: 2510, y: 4270 },
      { id: 'elderbridge', k: 'bridge', name: 'Elderbridge', x: 4790, y: 2080 },
      { id: 'frostford', k: 'bridge', name: 'Frostford', x: 6650, y: 4440 },
      // shrines, caves, nests, watchtowers, waygates, ruins
      { id: 'dawncircle', k: 'shrine', name: 'Circle of Dawn', x: 1450, y: 6750 },
      { id: 'windshrine', k: 'shrine', name: 'Shrine of Winds', x: 6200, y: 3350 },
      { id: 'trollcave', k: 'cave', name: 'Troll Cave', x: 850, y: 4250, guard: [['troll', 2]] },
      { id: 'gianthollow', k: 'cave', name: "Giant's Hollow", x: 5250, y: 9200, guard: [['giant', 1]] },
      { id: 'frostnest', k: 'nest', name: 'Frostspine Eyrie', x: 9000, y: 1900, guard: [['troll', 1]] },
      { id: 'cragnest', k: 'nest', name: 'Crag Eyrie', x: 5350, y: 3150 },
      { id: 'downsnest', k: 'nest', name: 'Downs Eyrie', x: 3650, y: 9050 },
      { id: 'wt_north', k: 'watchtower', name: 'Hawk Tower', x: 3800, y: 3600 },
      { id: 'wt_south', k: 'watchtower', name: 'Ember Tower', x: 2950, y: 6900 },
      { id: 'wt_east', k: 'watchtower', name: 'Raven Tower', x: 6050, y: 6250 },
      { id: 'gate_sw', k: 'waygate', name: 'Southwest Waygate', x: 2750, y: 6750 },
      { id: 'gate_nw', k: 'waygate', name: 'Northwest Waygate', x: 2700, y: 2750 },
      { id: 'gate_ne', k: 'waygate', name: 'Northeast Waygate', x: 6900, y: 2650 },
      { id: 'gate_se', k: 'waygate', name: 'Southeast Waygate', x: 6900, y: 6950 },
      { id: 'gate_c', k: 'waygate', name: 'Heart Waygate', x: 4950, y: 5650 },
      { id: 'oldtemple', k: 'ruins', name: 'Fallen Temple', x: 1350, y: 3350, guard: [['wolf', 3]] },
      { id: 'blackruin', k: 'ruins', name: 'Blackstone Ruins', x: 8650, y: 6800, guard: [['ogre', 1]] },
    ],
    // wild herds (livestock lives with the towns and villages)
    wild: [
      { k: 'deer', x: 2400, y: 2500, n: 6 }, { k: 'deer', x: 1300, y: 1500, n: 5 }, { k: 'deer', x: 3100, y: 3300, n: 5 },
      { k: 'deer', x: 4000, y: 5900, n: 5 }, { k: 'deer', x: 5800, y: 3700, n: 4 }, { k: 'deer', x: 950, y: 8600, n: 4 },
      { k: 'boar', x: 3700, y: 7000, n: 4 }, { k: 'boar', x: 6700, y: 8400, n: 4 }, { k: 'boar', x: 2200, y: 3500, n: 4 },
      { k: 'boar', x: 6900, y: 1300, n: 3 },
      { k: 'goat', x: 6300, y: 1000, n: 6 }, { k: 'goat', x: 8700, y: 2200, n: 5 }, { k: 'goat', x: 7600, y: 3500, n: 5 },
      { k: 'goat', x: 6400, y: 8000, n: 4 }, { k: 'goat', x: 900, y: 4600, n: 4 }, { k: 'goat', x: 6000, y: 5300, n: 4 },
      { k: 'horse', x: 3900, y: 8000, n: 5 }, { k: 'horse', x: 5600, y: 2600, n: 5 }, { k: 'horse', x: 8200, y: 5200, n: 4 },
      { k: 'deer', x: 7300, y: 4800, n: 4 }, { k: 'deer', x: 5200, y: 8200, n: 4 },
    ],
    // rune circles where magical power-ups appear
    runes: [[3600, 5300], [5100, 3800], [6300, 4400], [5100, 6400], [2900, 3900], [3500, 7700], [6600, 7600], [7300, 2900],
      [1300, 3000], [8800, 4100], [4400, 1600], [4700, 8200], [2000, 6600], [8100, 6900], [6200, 2000], [1500, 5100]],
  });
})(window.AS);
