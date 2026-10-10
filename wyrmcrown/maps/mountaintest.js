/* WYRMCROWN — MOUNTAIN TEST: one region (3 × 3.5 km) with real elevation.
 *
 * A prototype, kept apart from every other map. Everything here is authored in
 * GROUND coordinates (x east, y south, as on a flat map); the relief generator
 * (src/gfx/mountain_terrain.js) turns the `relief` description below into a
 * heightfield, and the game then works in projected screen-plane coordinates
 * (src/game/mountain.js converts the sites, towns and troops on load).
 *
 * North to south:
 *   y 0–2600      the High Moors: rolling upland behind the mountains
 *   y ~3300       the GREAT RANGE: snow, rock and ice, crest 560–700, far above the
 *                 dragon's ceiling, with the GREAT PEAK (Mount Hrothgar, ~900) near
 *                 x 4100. Two ways through: the HIGH PASS (saddle ~400, road, human
 *                 outpost, raiders) and the WINDGAP (~470: a notch only a dragon fits)
 *   y 3500–4150   the Shelf: a bench under the range, ending at THE WALL — a cliff
 *                 along the valley's north side. The HIDDEN BASIN sits on the shelf
 *                 behind its own rim; its stream falls over the Wall as the
 *                 WATERFALL. The DWARVEN HOLD is cut into the Wall further east.
 *   y 4200–5700   the DEEP VALLEY: river, bridge, hamlet, forest
 *   y ~6300       the FRONT RANGE: crest 340–420 (a dragon flies over it, an army
 *                 cannot), cut by the winding GORGE that carries river and road
 *                 south; a natural CAVE in its south face
 *   y 6900–9000   forested foothills
 *   y 9000+       lowlands: the player's castle, a village, the lake
 *
 * Heights are in game units (1 unit ≈ 0.25 m, as everywhere in the game). */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  // the river: from the hidden basin's tarn, over the Wall, along the valley, down the gorge to the lake
  const RIVER = [
    [2230, 3610, 26], [2275, 3900, 28], [2300, 4120, 30], [2310, 4215, 34], [2480, 4420, 44], [2950, 4700, 50], [3600, 4850, 54],
    [4200, 4900, 56], [4900, 4880, 56], [5500, 4935, 56], [6000, 4965, 52],
    // the gorge
    [6075, 5300, 46], [5955, 5650, 46], [6075, 6000, 46], [5965, 6300, 46], [6065, 6650, 46], [5990, 7000, 48], [6095, 7350, 50],
    [6250, 7700, 56], [6500, 8300, 60], [6360, 9100, 62], [6600, 9900, 64], [6450, 10700, 66], [6500, 11250, 70],
  ];
  const GORGE = RIVER.slice(10, 19).map((p) => [p[0], p[1]]);
  // the main road: castle → foothills → gorge (east bank) → valley → switchbacks → High Pass → the moors
  const ROAD_MAIN = [
    [3720, 10420], [4300, 9950], [5050, 9300], [5750, 8650], [6150, 8050], [6330, 7680],
    [6152, 7350], [6046, 7000], [6118, 6650], [6020, 6300], [6128, 6000], [6012, 5650], [6128, 5300], [6110, 5080],
    [6380, 4820], [6950, 4640], [7480, 4470], [7800, 4260], [8330, 4080], [7820, 3880], [8280, 3640], [8050, 3420], [7990, 3200],
    [8070, 2900], [8180, 2450], [8300, 1950], [8380, 1500],
  ];
  // the hold road: along the valley, in through the yard's gatehouse, up the stair to the great gate
  const ROAD_HOLD = [[6380, 4820], [5800, 4700], [5250, 4670], [4930, 4672], [4740, 4668], [4700, 4630], [4700, 4420], [4700, 4310]];
  const ROAD_BRIDGE = [[4700, 4660], [4560, 4750], [4420, 4895], [4280, 5100], [3980, 5260], [3700, 5330]];
  const ROAD_WEST = [[3720, 10420], [2900, 10820], [2100, 11150], [1700, 11300]];
  const ROAD_LAKE = [[3720, 10600], [4700, 11050], [5600, 11400], [6000, 11500]];
  const BRIDGE = [4420, 4895];
  const HOLD = [4700, 4490], GATE = [4700, 4300], FACE = 4290;
  const CASTLE = [3600, 10600], HAMLET = [3700, 5330], OUTPOST = [8060, 3330], CAVE = [3250, 6905], VILLAGE = [1700, 11320], MOOR = [8420, 1420];

  const m = {
    id: 'mountaintest', name: 'Mountain Test', w: 12000, h: 14000, seed: 31, index: 1,
    sandbox: true, mountain: true, riversCut: true,
    highFlight: true, prefetchAll: true, tacScale: 24,
    blurb: 'One mountain region with real elevation: a flight ceiling, passes, a gorge, a waterfall, a dwarf hold. A prototype.',
    difficulty: 'Test',
    regions: [
      { biome: 'human', x: 3800, y: 11000, r: 3600 },
      { biome: 'human', x: 9000, y: 10400, r: 3000 },
      { biome: 'neutral', x: 4200, y: 5200, r: 2600 },
      { biome: 'neutral', x: 9200, y: 5600, r: 2400 },
      { biome: 'neutral', x: 6200, y: 7600, r: 2000 },
      { biome: 'ice', x: 5000, y: 1400, r: 2600 },
      { biome: 'ice', x: 9800, y: 1300, r: 2300 },
    ],
    factions: { human: { town: { x: CASTLE[0], y: CASTLE[1] }, gate: -1.1 } },
    lakes: [
      { x: 6500, y: 11680, r: 430, sx: 1.25 },
      { x: 2200, y: 3560, r: 150, sx: 1.3 },
      { x: 9200, y: 1650, r: 140 },
    ],
    islands: [],
    rivers: [{ w: 50, pts: RIVER }],
    roads: [{ pts: ROAD_MAIN }, { pts: ROAD_HOLD }, { pts: ROAD_BRIDGE }, { pts: ROAD_WEST }, { pts: ROAD_LAKE }],
    bridges: [{ x: BRIDGE[0], y: BRIDGE[1], a: Math.atan2(BRIDGE[1] - 4650, BRIDGE[0] - 4560) }],
    forests: [
      { x: 5000, y: 8100, r: 1300, sx: 1.6, d: 0.95 }, { x: 8600, y: 7900, r: 1200, sx: 1.7, d: 0.9 }, { x: 2200, y: 8000, r: 1100, sx: 1.5, d: 0.9 },
      { x: 3000, y: 5500, r: 600, sx: 1.6, d: 0.85 }, { x: 8800, y: 5100, r: 700, sx: 1.5, d: 0.8 }, { x: 1200, y: 4900, r: 500, d: 0.8 },
      { x: 7300, y: 9600, r: 600, d: 0.7 }, { x: 10500, y: 9000, r: 900, d: 0.8 },
      { x: 3600, y: 1800, r: 700, sx: 1.6, d: 0.6 }, { x: 10400, y: 2200, r: 600, d: 0.6 }, { x: 2350, y: 3700, r: 260, d: 0.7 },
    ],
    fields: [{ x: 1700, y: 11400, r: 420 }, { x: 4400, y: 11500, r: 500 }],
    // ---- the relief (heights in units; read by AS.MountainGen) ----
    relief: {
      HG: 10, ceiling: 500,
      // the land's base height, north to south (before ranges and carving)
      base: [[0, 130], [800, 200], [1800, 235], [2600, 250], [3300, 280], [3900, 240], [4300, 190], [4900, 165], [5600, 185], [6300, 250], [7000, 205], [7800, 140], [8600, 80], [9300, 38], [10500, 18], [14000, 8]],
      ranges: [
        { name: 'Great Range', hwN: 1000, hwS: 900,
          spine: [[0, 3250], [1500, 3180], [3000, 3330], [4100, 3250], [5500, 3340], [7000, 3260], [8000, 3290], [9000, 3200], [10500, 3250], [12000, 3300]],
          crest: [[0, 600], [1200, 650], [2300, 610], [3200, 700], [4100, 860], [5000, 720], [6200, 660], [7100, 630], [7600, 540], [8000, 402], [8400, 540], [8900, 650], [9900, 630], [10340, 590], [10500, 468], [10660, 590], [11400, 670], [12000, 630]] },
        { name: 'Front Range', hwN: 650, hwS: 760,
          spine: [[0, 6250], [2000, 6340], [4000, 6200], [6000, 6300], [8000, 6250], [10000, 6350], [12000, 6300]],
          crest: [[0, 360], [1800, 425], [3300, 405], [4800, 375], [5600, 345], [6400, 345], [8000, 425], [9600, 405], [12000, 370]] },
      ],
      // extra mass on the great peak (radial arêtes) and the lesser summits
      peaks: [{ x: 4100, y: 3250, r: 1050, h: 120, arms: 5 }, { x: 1250, y: 3170, r: 600, h: 60, arms: 4 }, { x: 6400, y: 3320, r: 650, h: 70, arms: 4 }, { x: 9150, y: 3180, r: 600, h: 60, arms: 3 }, { x: 11400, y: 3300, r: 600, h: 50, arms: 4 }, { x: 1800, y: 6330, r: 500, h: 30, arms: 3 }, { x: 8100, y: 6260, r: 500, h: 30, arms: 3 },
        // lesser hills: spurs in the foothills and tors on the moors
        { x: 2600, y: 7750, r: 520, h: 60, arms: 3 }, { x: 4250, y: 7450, r: 430, h: 48, arms: 3 }, { x: 8900, y: 7650, r: 560, h: 64, arms: 4 }, { x: 10600, y: 7350, r: 480, h: 55, arms: 3 },
        { x: 3200, y: 1500, r: 500, h: 55, arms: 3 }, { x: 10150, y: 1950, r: 430, h: 45, arms: 3 }],
      // THE WALL: a cliff along the valley's north side; north of it the land stands at least `top`
      wall: { x0: 1250, x1: 5650, y: 4180, wob: 60, wobL: 700, depth: 42, top: [[1250, 260], [1700, 455], [2900, 455], [3500, 415], [4300, 420], [5100, 420], [5650, 270]], reach: 900 },
      basin: { x: 2250, y: 3640, r: 470, floor: 452, rim: 60, notch: [2300, 4110] },
      gorge: { pts: GORGE, floorW: 82, wallW: 128 },
      // site pads (levelled ground): h fixed, else the mean of the ground there
      pads: [
        { x: HOLD[0], y: HOLD[1], r: 230, h: 200 }, { x: HOLD[0], y: 4600, r: 120, h: 200 }, { x: OUTPOST[0], y: OUTPOST[1], r: 130 }, { x: HAMLET[0], y: HAMLET[1], r: 200 },
        { x: CASTLE[0], y: CASTLE[1], r: 430 }, { x: VILLAGE[0], y: VILLAGE[1], r: 260 }, { x: MOOR[0], y: MOOR[1], r: 200 }, { x: CAVE[0], y: CAVE[1] + 40, r: 70 },
      ],
      // small sheer faces (the cave in the Front Range)
      cliffs: [{ x: CAVE[0], y: CAVE[1] - 20, w: 120, depth: 34, rise: 95 }],
      grade: 0.14,
      // painted on the faces: the hold's carved front and the cave mouth
      marks: [{ k: 'facade', x: GATE[0], y: FACE, w: 200 }, { k: 'cave', x: CAVE[0], y: CAVE[1] - 22, w: 34 }],
      // the front of Khaz Durn, cut into the Wall: a dressed face 200 high with its great gate,
      // two towers standing out of the rock, a stepped gable over the cliff's edge, a raised
      // forecourt and a stair down to the yard (see AS.MountainGen, step 7)
      hold: { x: GATE[0], face: FACE, w: 200, tw: 56, td: 44, floor: 216, yard: 200, faceH: 204, towerH: 312, court: 86, stair: 40, sw: 46, gw: 124, gd: 46, gableH: 272, gstep: 42, gdrop: 22 },
      snow: 530, treeLine: 350,
    },
    // places (ground coordinates; converted on load)
    sites: [
      { id: 'khazdurn', k: 'dwarfhold', name: 'Khaz Durn', x: HOLD[0], y: HOLD[1], culture: 'dwarf', mountain: { underground: true, gate: GATE } },
      { id: 'passwatch', k: 'fort', name: 'Pass Watch (held by raiders)', x: OUTPOST[0], y: OUTPOST[1], guard: [['bandit', 6], ['ogre', 1]] },
      { id: 'tarnford', k: 'village', name: 'Tarnford', x: HAMLET[0], y: HAMLET[1], guard: [['wolf', 3]] },
      { id: 'lowmead', k: 'village', name: 'Lowmead', x: VILLAGE[0], y: VILLAGE[1] },
      { id: 'highmoor', k: 'village', name: 'Highmoor', x: MOOR[0], y: MOOR[1], guard: [['snowstalker', 2]] },
      { id: 'gorgewatch', k: 'watchtower', name: 'Gorge Watch', x: 6420, y: 7820 },
      { id: 'trollcave', k: 'cave', name: 'Troll Cave', x: CAVE[0], y: CAVE[1] + 40, guard: [['troll', 1]] },
      { id: 'basinruin', k: 'ruins', name: 'Hidden Basin Shrine', x: 2420, y: 3720 },
    ],
    // the raiders on the switchbacks below the pass (spawned by src/game/mountain.js)
    encounters: [
      { id: 'e_pass', name: 'Pass raiders', x: 7900, y: 3880, troops: [['bandit', 7], ['ogre', 1]] },
      { id: 'e_moor', name: 'Moor wolves', x: 7600, y: 2300, troops: [['wolf', 5]] },
    ],
    wild: [
      { k: 'deer', x: 4700, y: 8600, n: 5 }, { k: 'deer', x: 8600, y: 8900, n: 5 }, { k: 'boar', x: 2600, y: 9400, n: 4 },
      { k: 'goat', x: 9300, y: 5200, n: 5 }, { k: 'goat', x: 2900, y: 5000, n: 4 }, { k: 'deer', x: 7400, y: 1500, n: 4 },
    ],
    runes: [[2250, 3700], [10500, 3250], [6000, 6300], [4100, 5400]],
    // where each test scenario starts (ground x, y and absolute altitude): see src/game/mountain.js
    tests: {
      A: { name: 'Lowland approach', x: 4300, y: 10200, alt: 120, a: -1.4 },
      B: { name: 'Mountain climb', x: 4600, y: 5000, alt: 260, a: -1.57 },
      C: { name: 'Impassable peak', x: 4100, y: 4700, alt: 470, a: -1.57 },
      D: { name: 'Gorge flight', x: 6080, y: 7500, alt: 230, a: -1.57 },
      E: { name: 'High pass', x: 7900, y: 4700, alt: 420, a: -1.45 },
      F: { name: 'Dwarven gate', x: 4700, y: 4750, alt: 260, a: -1.57 },
      G: { name: 'Army crossing', x: 6900, y: 4900, alt: 330, a: -1.2 },
      H: { name: 'Mountain combat', x: 8000, y: 4300, alt: 470, a: -1.57 },
      I: { name: 'Streaming stress', x: 1000, y: 9500, alt: 480, a: -0.6 },
      J: { name: 'Altitude descent', x: 2700, y: 3900, alt: 495, a: 1.57 },
    },
    // the army route for test G (ground points: valley → switchbacks → pass → moors)
    armyRoute: { from: [6700, 4950], to: [8320, 1700] },
  };
  AS.Maps.byId[m.id] = m; // not in the battle atlas
})(window.AS);
