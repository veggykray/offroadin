/* WYRMCROWN — ARMY COMMAND TEST: a small, self-contained development scenario for
 * independent armies and commanders (src/game/armies.js, src/game/armytest.js).
 * Not part of any campaign geography; registered by id only.
 *
 *   south   your castle (Aldermere), the village of Hollowford across the Millrace
 *           river (one bridge), a sea inlet in the south-east with Gull Rock
 *   middle  the GREYSPINE: a mountain wall armies cannot cross (peaksBlock),
 *           broken only by the GREYSPINE PASS, held by raiders at the Gatewatch
 *   tunnel  DELVER'S DOOR at the foot of the range leads underground to the
 *           GLOOMVAULT (an enemy host waits there) and up the HOLLOW STAIR on the
 *           north side: ground only, no dragon
 *           (the Old King's Road, an older sealed way from the Gloomvault to a
 *           sally-port under Blackthorn Fort, opens only when its flag is set)
 *   north   BLACKTHORN FORT, a hostile stronghold; its raiders march on Hollowford
 *
 * map.routes is the route network (src/game/routes.js); map.armyTest the
 * scenario's armies, commanders and enemy groups (src/game/armytest.js). */
'use strict';
(function (AS) {
  const H = AS.Maps.H;
  const road = (pts, seed) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const r = H.road(pts[i], pts[i + 1], 60, seed + i).pts; out.push(...(i ? r.slice(1) : r)); } return { pts: out }; };
  const CASTLE = [2200, 6600], BRIDGE = [3700, 6380], HOLLOW = [6600, 6000], PASS = [4950, 3720], FORT = [6800, 1900];
  const DOOR = [2350, 4380], STAIR = [2050, 3020], SALLY = [7350, 2450], QUAY = [8000, 6450], GULL = [9050, 6950];
  const m = {
    id: 'armytest', name: 'Army Command Test', w: 9600, h: 8000, seed: 4242, index: 1,
    sandbox: true, armyTest: true, peaksBlock: 0.9, tacScale: 16,
    blurb: 'A small test region for independent armies and their commanders: a mountain wall with one guarded pass, a ground-only tunnel, a hostile fort.',
    difficulty: 'Test',
    regions: [
      { biome: 'human', x: 3000, y: 6500, r: 3400 },
      { biome: 'human', x: 7000, y: 6300, r: 2600 },
      { biome: 'neutral', x: 4800, y: 3600, r: 2400 },
      { biome: 'ice', x: 5200, y: 1500, r: 3200 },
    ],
    factions: { human: { town: { x: CASTLE[0], y: CASTLE[1] }, gate: -0.9 } },
    lakes: [{ x: 9200, y: 7000, r: 900, sx: 1.2 }],
    islands: [{ x: GULL[0], y: GULL[1], r: 240 }],
    rivers: [{ w: 60, pts: [[3820, 3500, 50], [3760, 4300, 55], [3700, 5200, 60], [3720, 6380, 64], [3650, 7300, 66], [3700, 8100, 70]] }],
    // the Greyspine: two arms of high peaks with the pass between them
    mountains: [
      { w: 520, h: 1.35, pts: [[-300, 3820], [900, 3700], [2100, 3760], [3300, 3690], [4300, 3720]] },
      { w: 520, h: 1.35, pts: [[5600, 3700], [6700, 3800], [7900, 3660], [9000, 3760], [9900, 3700]] },
    ],
    forests: [
      { x: 1200, y: 5200, r: 600, d: 0.8 }, { x: 5600, y: 7100, r: 700, d: 0.75 }, { x: 8200, y: 5000, r: 600, d: 0.8 },
      { x: 3200, y: 1600, r: 800, d: 0.75 }, { x: 8600, y: 1400, r: 700, d: 0.7 },
    ],
    roads: [
      road([CASTLE, BRIDGE, [5100, 6200], HOLLOW], 11),
      road([BRIDGE, [4500, 5400], [4950, 4600], [PASS[0], 4200], PASS, [PASS[0], 3200], [5900, 2500], FORT], 21),
      road([[2300, 6200], [2300, 5200], DOOR], 31),
      road([STAIR, [3400, 2700], [5900, 2500]], 41),
      road([HOLLOW, [7300, 6300], QUAY], 51),
    ],
    bridges: [{ x: BRIDGE[0], y: BRIDGE[1], a: -0.05 }],
    sites: [
      { id: 'hollowford', k: 'village', name: 'Hollowford', x: HOLLOW[0], y: HOLLOW[1] },
      { id: 'gatewatch', k: 'watchtower', name: 'The Gatewatch', x: PASS[0] + 70, y: PASS[1] - 40, guard: [['bandit', 4], ['ogre', 1]] },
      { id: 'blackthorn', k: 'fort', name: 'Blackthorn Fort', x: FORT[0], y: FORT[1], guard: [['bandit', 6], ['ogre', 1]] },
      { id: 'delversdoor', k: 'dungeon', name: 'Delver\'s Door', x: DOOR[0], y: DOOR[1] },
      { id: 'hollowstair', k: 'dungeon', name: 'The Hollow Stair', x: STAIR[0], y: STAIR[1] },
    ],
    wild: [{ k: 'deer', x: 3000, y: 5600, n: 5 }, { k: 'boar', x: 5600, y: 5400, n: 4 }, { k: 'deer', x: 4000, y: 2200, n: 4 }],
    runes: [[3000, 5000], [6000, 4800]],

    // ---- the route network (src/game/routes.js) ----
    routes: {
      nodes: [
        { id: 'castle', name: 'the castle', x: CASTLE[0], y: CASTLE[1] + 160 },
        { id: 'hollowford', name: 'Hollowford', x: HOLLOW[0], y: HOLLOW[1] + 60 },
        { id: 'bridge', name: 'Millrace Bridge', x: BRIDGE[0], y: BRIDGE[1] },
        { id: 'pass_s', name: 'the foot of the pass', x: PASS[0], y: 4250 },
        { id: 'pass_n', name: 'the north side of the pass', x: PASS[0], y: 3150 },
        { id: 'fort', name: 'Blackthorn Fort', x: FORT[0], y: FORT[1] + 160 },
        { id: 'door', name: 'Delver\'s Door', x: DOOR[0], y: DOOR[1] + 70 },
        { id: 'stair', name: 'the Hollow Stair', x: STAIR[0], y: STAIR[1] - 70 },
        { id: 'gloomvault', name: 'the Gloomvault', layer: 'under', terrain: 'tunnel', mx: 2200, my: 3700 },
        { id: 'kingsroad', name: 'the Old King\'s Road', layer: 'under', terrain: 'cavern', mx: 4700, my: 2900 },
        { id: 'sallyport', name: 'the Blackthorn sally-port', x: SALLY[0], y: SALLY[1] },
        { id: 'quay', name: 'Hollowford quay', x: QUAY[0], y: QUAY[1] },
        { id: 'gullrock', name: 'Gull Rock', x: GULL[0], y: GULL[1] },
      ],
      links: [
        // surface ways (walked on the ground; listed so the pass can be named and watched)
        { id: 'millrace_bridge', name: 'Millrace Bridge', a: 'castle', b: 'hollowford', type: 'bridge' },
        { id: 'greyspine_pass', name: 'the Greyspine Pass', a: 'pass_s', b: 'pass_n', type: 'pass', chokepoint: 'gatewatch' },
        // the tunnel under the Greyspine: armies only
        { id: 'door_in', name: 'Delver\'s Door', a: 'door', b: 'gloomvault', type: 'underground_entrance', travel: 6 },
        { id: 'stair_up', name: 'the Hollow Stair', a: 'gloomvault', b: 'stair', type: 'underground', travel: 8 },
        // a far underground road: ~5 km of the surface in 12 seconds, sealed until its flag is set
        { id: 'kings_road', name: 'the Old King\'s Road', a: 'gloomvault', b: 'kingsroad', type: 'underground', travel: 6, requires: [{ flag: 'kingsroad_open', why: 'the way is sealed with fallen stone' }] },
        { id: 'sally_up', name: 'the sally-port stair', a: 'kingsroad', b: 'sallyport', type: 'underground', travel: 6, requires: [{ flag: 'kingsroad_open', why: 'the way is sealed with fallen stone' }] },
        // by sea (data only: no ships yet)
        { id: 'gull_crossing', name: 'the crossing to Gull Rock', a: 'quay', b: 'gullrock', type: 'sea', travel: 20 },
      ],
      passages: [
        { id: 'delverway', name: 'the Delverway (Delver\'s Door to the Hollow Stair)', links: ['door_in', 'stair_up'] },
        { id: 'kingsway', name: 'the Old King\'s Road (to Blackthorn sally-port)', links: ['door_in', 'kings_road', 'sally_up'] },
      ],
    },

    // ---- the scenario (src/game/armytest.js) ----
    armyTest: {
      commanders: [
        { id: 'k_osric', at: 'hollowford' },          // the king leads the Hollowford Guard from the start
        { id: 'c_brannoc', x: CASTLE[0] + 120, y: CASTLE[1] + 230 }, // the champion waits at the castle
      ],
      armies: [
        { id: 'red', name: 'Red Company', x: CASTLE[0] + 40, y: CASTLE[1] + 260, stacks: { h_soldier: 8, h_archer: 4 } },
        { id: 'guard', name: 'Hollowford Guard', x: HOLLOW[0] - 80, y: HOLLOW[1] + 160, stacks: { h_soldier: 6, h_knight: 2, h_archer: 2 }, cmdr: 'k_osric', order: { type: 'defend', siteId: 'hollowford' } },
      ],
      groups: [
        { id: 'gloomhost', name: 'the Gloomvault Horde', node: 'gloomvault', team: 'wild', stacks: { skeleton: 14, gravehound: 3 }, morale: 75 },
      ],
      // raiders out of Blackthorn: sent at RAID seconds (or at once with the panel)
      raid: { at: 150, from: [FORT[0], FORT[1] + 260], to: [HOLLOW[0], HOLLOW[1] + 40], troops: [['bandit', 6], ['wolf', 3]] },
      destinations: [
        { id: 'castle', name: 'The castle', x: CASTLE[0] + 40, y: CASTLE[1] + 260 },
        { id: 'hollowford', name: 'Hollowford', x: HOLLOW[0], y: HOLLOW[1] + 120 },
        { id: 'bridge', name: 'Millrace Bridge (east end)', x: BRIDGE[0] + 260, y: BRIDGE[1] - 40 },
        { id: 'passfoot', name: 'Foot of the Greyspine Pass', x: PASS[0], y: 4400 },
        { id: 'northside', name: 'North of the pass', x: PASS[0] + 200, y: 2900 },
        { id: 'stair', name: 'The Hollow Stair (north)', x: STAIR[0] + 150, y: STAIR[1] - 160 },
        { id: 'fortgate', name: 'Before Blackthorn Fort', x: FORT[0] - 300, y: FORT[1] + 450 },
        { id: 'gullrock', name: 'Gull Rock (across the water)', x: GULL[0], y: GULL[1] },
      ],
    },
  };
  AS.Maps.byId[m.id] = m; // not in the battle atlas
})(window.AS);
