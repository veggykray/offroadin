/* WYRMCROWN — LARGE WORLD TEST: one big continuous island and a smaller one
 * across the sea, for testing the real game in a much larger world.
 *
 * Scale: buildings set it — a house is ~30 units wide (≈ 7 m), the stronghold
 * keep ~120 units (≈ 30 m), so 1 unit ≈ 0.25 m. The main island is ~19,000
 * units across (≈ 4.75 km); the map with its sea is 28,000 units (≈ 7 km).
 * At cruise speed (185 units/s) the dragon needs ~1½ minutes to cross it.
 *
 * Geography: Aldermere farmland in the south-west (the player's castle), the
 * Sylvaran forest in the north-west, the Frostspine mountains and Blackcrag
 * Castle in the north-east, the Morgrave blight in the south-east, the
 * heartland with Fort Greyhelm in the middle, two rivers crossed by bridges,
 * and the Isle of Ravens (a ruined castle and a dragon eyrie) to the east.
 *
 * Enemy forces (`encounters`) are streamed by src/game/largeworld.js: they
 * exist as data until the dragon comes near, then take the field.
 * Registered by id only (AS.Maps.byId.largeworld), not in the battle atlas. */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  const road = (pts, seed) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const r = H.road(pts[i], pts[i + 1], 140, seed + i).pts; out.push(...(i ? r.slice(1) : r)); } return { pts: out }; };
  const CASTLE = [6400, 18200], ASHFORD = [9300, 16000], CROSS = [11300, 15000], FORT = [14200, 13600], B1 = [15050, 13000], FROST = [17200, 10800], CRAG = [18800, 8200];
  const ELM = [8200, 10200], B3 = [8300, 12900], KINGS = [12200, 17800], B2 = [15340, 19000], GLOOM = [16300, 19700], MILL = [4800, 15600], SALT = [11800, 22400], F1 = [7800, 19900], F2 = [10500, 19300];
  const m = {
    id: 'largeworld', name: 'The Wide Realm (Large World Test)', w: 28000, h: 28000, seed: 77, index: 1,
    largeWorld: true, sandbox: true,
    highFlight: true,  // H zooms far out (terrain far layer)
    prefetchAll: true, // terrain prepared all round the view, not only ahead
    simR: 3400,        // troops beyond this distance from the dragon sleep (no combat AI)
    tacScale: 56,      // war-map resolution (units per pixel)
    blurb: 'A continuous island several kilometres across, with a smaller isle beyond the sea. A technical test of the game in a much larger world.',
    difficulty: 'Test',
    regions: [
      { biome: 'human', x: 6800, y: 17600, r: 5600 },
      { biome: 'elf', x: 8400, y: 8400, r: 5200 },
      { biome: 'ice', x: 17400, y: 9000, r: 4600 },
      { biome: 'undead', x: 17200, y: 19600, r: 4600 },
      { biome: 'neutral', x: 12600, y: 14200, r: 5200 },
      { biome: 'neutral', x: 12000, y: 22000, r: 3000 },
      { biome: 'undead', x: 25200, y: 6600, r: 2200 },
      // the open sea belongs to no realm: it stays liquid (frozen water would let armies walk to the isle)
      { biome: 'neutral', x: 22600, y: 3200, r: 2600 }, { biome: 'neutral', x: 23800, y: 11200, r: 2400 }, { biome: 'neutral', x: 14800, y: 2400, r: 2600 },
      { biome: 'neutral', x: 24600, y: 18000, r: 2800 }, { biome: 'neutral', x: 21800, y: 24600, r: 2800 }, { biome: 'neutral', x: 3000, y: 4000, r: 2800 },
      { biome: 'neutral', x: 2400, y: 24400, r: 2800 }, { biome: 'neutral', x: 13600, y: 26400, r: 2800 }, { biome: 'neutral', x: 27000, y: 1400, r: 2000 },
    ],
    factions: { human: { town: { x: CASTLE[0], y: CASTLE[1] }, gate: -0.6 } },
    // the sea over the whole map, and the land rising out of it (the terrain's lake + island shapes)
    lakes: [
      { x: 14000, y: 14000, r: 26000 },
      { x: 11000, y: 16600, r: 620, after: true }, { x: 19200, y: 13600, r: 460, after: true }, { x: 6200, y: 8000, r: 380, after: true },
    ],
    islands: [
      { x: 12600, y: 14200, r: 7400, sx: 1.12, sy: 0.95 },
      { x: 6900, y: 17600, r: 4300 }, { x: 4600, y: 14800, r: 2600 },
      { x: 8800, y: 8400, r: 4100 }, { x: 11800, y: 6400, r: 2600 },
      { x: 17800, y: 9000, r: 4500 }, { x: 20600, y: 11800, r: 2500 },
      { x: 17000, y: 19300, r: 3800 }, { x: 12200, y: 21600, r: 2900 }, { x: 8600, y: 21000, r: 2300 },
      // the Isle of Ravens
      { x: 25100, y: 6500, r: 2100 }, { x: 25900, y: 7900, r: 1400 },
    ],
    rivers: [
      { w: 110, pts: [[16200, 8600], [15300, 11400], [15000, 13000], [14800, 14600], [15600, 17400], [15340, 19000], [15000, 21000], [14600, 24600]] },
      { w: 84, pts: [[10600, 10400], [9100, 12300], [8300, 12900], [7500, 13300], [5200, 13000], [2600, 13600]] },
    ],
    mountains: [
      { w: 640, h: 1.25, pts: [[14800, 6400], [16900, 7600], [19400, 7300], [21200, 8900], [22000, 11000]] },
      { w: 460, h: 0.85, pts: [[11400, 10900], [12800, 12300], [13300, 14200]] },
      { w: 380, h: 0.65, pts: [[4400, 14000], [6100, 13700]] },
      { w: 420, h: 0.9, pts: [[18200, 21400], [19800, 19600], [20400, 17800]] },
      { w: 420, h: 1.05, pts: [[24400, 5400], [25600, 6100]] },
    ],
    forests: [
      { x: 8600, y: 8200, r: 3200, d: 1 }, { x: 6000, y: 10600, r: 1500, d: 0.9 }, { x: 11600, y: 7200, r: 1300, d: 0.85 },
      { x: 5600, y: 19900, r: 900, d: 0.8 }, { x: 9600, y: 18200, r: 700, d: 0.7 }, { x: 13200, y: 16200, r: 800, d: 0.75 },
      { x: 18600, y: 6800, r: 1500, d: 0.9 }, { x: 20500, y: 13600, r: 900, d: 0.8 },
      { x: 18100, y: 20600, r: 1500, d: 0.95 }, { x: 13800, y: 21400, r: 900, d: 0.8 }, { x: 25200, y: 7000, r: 900, d: 0.85 },
      { x: 3800, y: 16800, r: 700, d: 0.7 }, { x: 16800, y: 15800, r: 700, d: 0.7 },
    ],
    roads: [
      road([CASTLE, [7800, 17300], ASHFORD, CROSS, FORT, B1, FROST, CRAG], 11),
      road([ASHFORD, [8800, 14300], B3, ELM], 31),
      road([CROSS, KINGS, B2, GLOOM], 41),
      road([CASTLE, MILL], 51),
      road([KINGS, SALT], 61),
      road([CASTLE, F1, F2, KINGS], 71),
    ],
    bridges: [
      { site: 'greybridge', x: B1[0], y: B1[1], a: -0.6 },
      { site: 'mournbridge', x: B2[0], y: B2[1], a: 0.4 },
      { site: 'elmbridge', x: B3[0], y: B3[1], a: -Math.PI / 2 },
    ],
    sites: [
      // villages and farms
      { id: 'ashford', k: 'village', name: 'Ashford', x: ASHFORD[0], y: ASHFORD[1] },
      { id: 'millbrook', k: 'village', name: 'Millbrook Farms', x: MILL[0], y: MILL[1] },
      { id: 'eastfield', k: 'village', name: 'Eastfield Farm', x: F1[0], y: F1[1] },
      { id: 'brackenfold', k: 'village', name: 'Brackenfold Farm', x: F2[0], y: F2[1] },
      { id: 'elmshade', k: 'village', name: 'Elmshade', x: ELM[0], y: ELM[1], guard: [['wolf', 4]] },
      { id: 'kingsmead', k: 'village', name: 'Kingsmead', x: KINGS[0], y: KINGS[1], guard: [['bandit', 4]] },
      { id: 'frosthollow', k: 'village', name: 'Frosthollow', x: FROST[0], y: FROST[1], guard: [['snowstalker', 3]] },
      { id: 'gloomwick', k: 'village', name: 'Gloomwick', x: GLOOM[0], y: GLOOM[1], guard: [['skeleton', 6]] },
      { id: 'saltmere', k: 'village', name: 'Saltmere', x: SALT[0], y: SALT[1] },
      // strongholds
      { id: 'greyhelm', k: 'fort', name: 'Fort Greyhelm', x: FORT[0], y: FORT[1], guard: [['bandit', 5], ['ogre', 1]] },
      { id: 'blackcrag', k: 'castle', name: 'Blackcrag Castle', x: CRAG[0], y: CRAG[1], guard: [['troll', 2], ['ogre', 2], ['giant', 1]] },
      { id: 'ravenhold', k: 'castle', name: 'Ravenhold (ruined)', x: 25100, y: 7100, guard: [['troll', 2], ['giant', 1]] },
      // crossings
      { id: 'greybridge', k: 'bridge', name: 'Grey Bridge', x: B1[0], y: B1[1] },
      { id: 'mournbridge', k: 'bridge', name: 'Mourn Bridge', x: B2[0], y: B2[1] },
      { id: 'elmbridge', k: 'bridge', name: 'Elm Bridge', x: B3[0], y: B3[1] },
      // riches, magic and lookouts
      { id: 'copperhill', k: 'goldmine', name: 'Copperhill Mine', x: 10800, y: 12400, guard: [['wolf', 4]] },
      { id: 'rimeshaft', k: 'goldmine', name: 'Rimeshaft Mine', x: 19600, y: 14400, guard: [['ogre', 2]] },
      { id: 'saltpit', k: 'goldmine', name: 'Saltpit Mine', x: 15400, y: 22200, guard: [['bandit', 4]] },
      { id: 'westwatch', k: 'watchtower', name: 'West Watch', x: 4200, y: 18600 },
      { id: 'heartwatch', k: 'watchtower', name: 'Heart Watch', x: 15600, y: 16000 },
      { id: 'frostwatch', k: 'watchtower', name: 'Frost Watch', x: 20600, y: 11400 },
      { id: 'oldshrine', k: 'shrine', name: 'Wayside Shrine', x: 9900, y: 14200 },
      { id: 'mirrorwell', k: 'magicwell', name: 'Mirror Well', x: 16800, y: 15200 },
      { id: 'mossgrove', k: 'grove', name: 'Moss Grove', x: 7400, y: 7900 },
      { id: 'starspire', k: 'wizardtower', name: 'Starspire', x: 13600, y: 20200, guard: [['bandit', 3]] },
      { id: 'fallenhall', k: 'ruins', name: 'Fallen Hall', x: 13400, y: 9700, guard: [['wolf', 3]] },
      { id: 'bearcave', k: 'cave', name: 'Bear Cave', x: 6000, y: 12100, guard: [['bear', 2]] },
      { id: 'ravenrest', k: 'nest', name: 'Raven Eyrie', x: 24700, y: 5500 },
    ],
    // the enemy forces, streamed in as the dragon approaches (src/game/largeworld.js)
    encounters: [
      { id: 'e_bandits', name: 'Bandit warband', x: CROSS[0], y: CROSS[1] - 300, troops: [['bandit', 8], ['wolf', 4]] },
      { id: 'e_ogres', name: 'Ogre war party', x: 13000, y: 11200, troops: [['ogre', 3], ['bandit', 6]] },
      { id: 'e_roam', name: 'Roaming outlaws', x: 10200, y: 17200, troops: [['bandit', 10]], patrol: [[10200, 17200], [12400, 14600], [9600, 13800]] },
      { id: 'e_undead', name: 'The Grave Host', x: 17600, y: 17800, troops: [['skeleton', 18], ['gravehound', 6]], patrol: [[17600, 17800], [16400, 19400], [18600, 20400]] },
      { id: 'e_frost', name: 'Frost giants', x: 19900, y: 9900, troops: [['giant', 1], ['troll', 2], ['snowstalker', 5]] },
      { id: 'e_isle', name: 'Isle garrison', x: 24600, y: 7700, troops: [['troll', 3], ['ogre', 2], ['skeleton', 10]] },
    ],
    wild: [
      { k: 'deer', x: 8600, y: 15000, n: 6 }, { k: 'deer', x: 7600, y: 11200, n: 5 }, { k: 'deer', x: 11600, y: 9000, n: 5 },
      { k: 'boar', x: 12800, y: 16600, n: 4 }, { k: 'boar', x: 10600, y: 20600, n: 4 }, { k: 'horse', x: 13800, y: 18400, n: 5 },
      { k: 'goat', x: 17600, y: 7400, n: 6 }, { k: 'goat', x: 20600, y: 10200, n: 5 }, { k: 'deer', x: 18400, y: 15000, n: 5 },
      { k: 'boar', x: 17200, y: 21200, n: 4 }, { k: 'goat', x: 25000, y: 6200, n: 4 }, { k: 'deer', x: 5200, y: 16600, n: 5 },
      { k: 'horse', x: 11200, y: 18200, n: 4 }, { k: 'deer', x: 14200, y: 11800, n: 4 },
    ],
    runes: [[8400, 17000], [11000, 14000], [13800, 15600], [9000, 11400], [16400, 11800], [18200, 16800], [13200, 19200], [7000, 20200], [25200, 7600], [12000, 21600]],
  };
  AS.Maps.byId[m.id] = m; // not in the battle atlas
})(window.AS);
