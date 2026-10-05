/* ALIEN STRIKE — landmark definitions (data only).
 * A landmark is a large scenery set piece (see src/game/landmarks.js).
 *   gen      AS.Models generator (omit for decal-only sites such as old craters)
 *   pal      palette name on the world ('colony' | 'choir' | 'native') or inline
 *   opt      generator options
 *   r        footprint radius used for placement spacing and decor clearing
 *   solids   [dx, dy, r, groundOnly?] collision circles in object space (+x = model front);
 *            groundOnly circles stop ground units but the hovering craft passes over
 *   decals   baked ground decals in object space ({ kind, dx, dy, r, ... })
 *   fx       ambient effects ({ t: smoke|fire|light|beacon|sparks|motes, dx, dy, z, ... })
 *   pieces   compound landmarks: child landmarks placed around the centre
 *   water    placed on open water instead of ground
 *   turn     false keeps the authored heading (0)
 * landmarkSets[worldId] lists what may be scattered on that world's maps (weight w);
 * landmarkPins[missionId] places authored set pieces at fixed spots. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  const BONE = { a: '#a89c80', b: '#d8ccb0', t: '#8a7a60', g: '#ffe0a0', d: '#4a4234' };

  const ring = (k, n, rad, opt) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + 0.3;
    return { k, dx: Math.cos(a) * rad, dy: Math.sin(a) * rad * 0.8, opt: Object.assign({ h: 34 + (i * 37 % 26), broken: i % 3 === 2, lean: ((i * 53) % 7 - 3) * 0.04, seed: i * 11 + 3 }, opt || {}) };
  });

  AS.Data.landmarks = {
    /* ---- crashed ships ---- */
    crashColony: {
      gen: 'crashShip', pal: 'colony', opt: { variant: 'colony' }, r: 120,
      solids: [[0, 0, 34, true], [55, 4, 22, true], [-60, -4, 24, true]],
      decals: [{ kind: 'trench', dx: -95, dy: 0, len: 260, w: 44, ang: 0 }, { kind: 'scorch', dx: 10, dy: 6, r: 70 }],
      fx: [{ t: 'smoke', dx: -8, dy: 2, z: 18, rate: 3, size: 8 }, { t: 'fire', dx: -36, dy: 2, z: 6 }, { t: 'smoke', dx: -40, dy: 2, z: 10, rate: 2 }, { t: 'beacon', dx: 54, dy: -4.5, z: 23, col: '#ff5a3a' }, { t: 'light', dx: -108, dy: 7, z: 6, r: 40, col: '#ff8a3a', a: 0.3 }],
    },
    crashChoir: {
      gen: 'crashShip', pal: 'choir', opt: { variant: 'choir' }, r: 120,
      solids: [[0, 0, 34, true], [55, 4, 22, true], [-60, -4, 24, true]],
      decals: [{ kind: 'trench', dx: -95, dy: 0, len: 240, w: 44, ang: 0 }],
      fx: [{ t: 'light', dx: 0, dy: 0, z: 14, r: 70, col: '#b07cff', a: 0.25, pulse: 1.3 }, { t: 'motes', dx: -20, dy: 0, z: 10, col: '#c09aff', rate: 3, spread: 50 }],
    },
    /* ---- fossils ---- */
    skeletonBeast: {
      gen: 'skeleton', pal: BONE, opt: { kind: 'beast' }, r: 115,
      solids: [[0, 10, 28, true], [84, -4, 16, true], [-60, -6, 14, true]],
    },
    skeletonWorm: {
      gen: 'skeleton', pal: BONE, opt: { kind: 'worm' }, r: 125,
      solids: [[0, 0, 22, true], [-70, -23, 20, true], [70, 23, 20, true], [106, 28, 16, true]],
    },
    /* ---- human frontier ---- */
    colonyRuins: {
      gen: 'colonyRuins', pal: 'colony', r: 80,
      solids: [[0, 0, 30, true]],
      decals: [{ kind: 'foundation', dx: 0, dy: 0, r: 70, slab: '#8a8478' }],
      fx: [{ t: 'smoke', dx: 27, dy: -10, z: 4, rate: 0.8, size: 5 }],
    },
    convoyHulk: {
      gen: 'convoyHulk', pal: 'colony', r: 36,
      solids: [[0, 0, 16, true]],
      decals: [{ kind: 'scorch', dx: 0, dy: 0, r: 34 }, { kind: 'trench', dx: -30, dy: 0, len: 70, w: 18, ang: 0 }],
      fx: [{ t: 'smoke', dx: 16, dy: 0, z: 12, rate: 1.6, size: 5 }],
    },
    industrialStacks: {
      gen: 'industrialStacks', pal: 'colony', r: 70,
      solids: [[0, 0, 40]],
      decals: [{ kind: 'foundation', dx: 0, dy: 0, r: 64, slab: '#6a6660' }],
      fx: [{ t: 'smoke', dx: -18, dy: -10, z: 80, rate: 4, size: 9, col: '#4a4440', col2: '#8a8278' }, { t: 'smoke', dx: 18, dy: 8, z: 66, rate: 3, size: 8, col: '#4a4440', col2: '#8a8278' }, { t: 'light', dx: 0, dy: 20, z: 10, r: 50, col: '#ffa040', a: 0.25 }, { t: 'beacon', dx: -13, dy: -10, z: 81, col: '#ff3a2a', rate: 0.6 }, { t: 'smoke', dx: -27, dy: 25, z: 52, rate: 2.5, size: 10, col: '#cfcac2', col2: '#f0ede8' }],
    },
    drownedTower: {
      gen: 'drownedTower', pal: 'colony', r: 50, water: true,
      solids: [[0, 0, 30]],
      fx: [{ t: 'beacon', dx: 0, dy: 0, z: 50, col: '#ff4a3a', rate: 0.5 }],
    },
    giantGear: {
      gen: 'giantGear', pal: 'colony', r: 70,
      solids: [[0, 0, 36, true]],
      decals: [{ kind: 'crater', dx: 0, dy: 6, r: 60 }],
      fx: [{ t: 'sparks', dx: 41, dy: -25, z: 26, rate: 0.5 }],
    },
    /* ---- Choir ---- */
    monolith: { gen: 'monolith', pal: 'choir', r: 16, solids: [[0, 0, 10]] },
    monolithRing: {
      r: 110, turn: false,
      pieces: ring('monolith', 6, 82),
      decals: [{ kind: 'plaza', dx: 0, dy: 0, r: 66, col: '#b8ae98' }],
      fx: [{ t: 'light', dx: 0, dy: 0, z: 2, r: 90, col: '#b07cff', a: 0.22, pulse: 1.1 }, { t: 'motes', dx: 0, dy: 0, z: 4, col: '#c09aff', rate: 5, spread: 60 }],
    },
    choirTower: {
      gen: 'choirTower', pal: 'choir', r: 50,
      solids: [[0, 0, 20]],
      decals: [{ kind: 'creep', dx: 0, dy: 4, r: 70, col: '#3a2a5a', glow: '#b07cff' }],
      fx: [{ t: 'light', dx: 0, dy: 0, z: 90, r: 60, col: '#b07cff', a: 0.3, pulse: 2 }, { t: 'motes', dx: 0, dy: 0, z: 40, col: '#c09aff', rate: 3, spread: 24 }],
    },
    /* ---- natural wonders ---- */
    crystalCluster: {
      gen: 'crystalCluster', pal: 'native', r: 55,
      solids: [[0, 0, 26]],
      fx: [{ t: 'light', dx: 0, dy: 0, z: 30, r: 70, col: '#9ff0ff', a: 0.2, pulse: 0.9 }],
    },
    giantShrooms: {
      gen: 'giantShrooms', pal: 'native', r: 60,
      solids: [[0, 0, 18]],
      fx: [{ t: 'light', dx: -8, dy: -13, z: 66, r: 80, col: '#7fffd0', a: 0.18, pulse: 0.7 }, { t: 'motes', dx: -8, dy: -13, z: 40, col: '#9ffff0', rate: 3, spread: 40 }],
    },
    impactCrater: {
      r: 120,
      decals: [{ kind: 'craterbig', dx: 0, dy: 0, r: 92 }],
    },
    /* ---- authored sites (decals + effects around mission structures) ---- */
    compassSite: {
      r: 160, turn: false,
      decals: [{ kind: 'trench', dx: -110, dy: 8, len: 340, w: 52, ang: 0.12 }, { kind: 'scorch', dx: 0, dy: 0, r: 90 }, { kind: 'scorch', dx: -150, dy: -10, r: 40 }],
      fx: [{ t: 'smoke', dx: -20, dy: 0, z: 20, rate: 4, size: 9 }, { t: 'fire', dx: -44, dy: 14, z: 8 }, { t: 'fire', dx: 30, dy: -8, z: 10 }, { t: 'smoke', dx: 40, dy: -6, z: 14, rate: 2 }],
    },
    reliquarySite: {
      r: 180, turn: false,
      decals: [{ kind: 'plaza', dx: 0, dy: 0, r: 150, col: '#b8ae98' }],
      fx: [{ t: 'light', dx: 0, dy: 0, z: 2, r: 130, col: '#b07cff', a: 0.2, pulse: 0.9 }, { t: 'motes', dx: 0, dy: 0, z: 4, col: '#c09aff', rate: 5, spread: 120 }],
    },
  };

  AS.Data.landmarkSets = {
    1: [{ k: 'skeletonBeast', w: 2 }, { k: 'colonyRuins', w: 2 }, { k: 'impactCrater', w: 2 }, { k: 'convoyHulk', w: 1 }, { k: 'monolithRing', w: 1 }],
    2: [{ k: 'skeletonWorm', w: 3 }, { k: 'convoyHulk', w: 2 }, { k: 'industrialStacks', w: 1 }, { k: 'colonyRuins', w: 1 }, { k: 'impactCrater', w: 1 }],
    3: [{ k: 'giantShrooms', w: 2 }, { k: 'crystalCluster', w: 1 }, { k: 'skeletonBeast', w: 1 }, { k: 'colonyRuins', w: 1 }, { k: 'monolithRing', w: 1 }],
    4: [{ k: 'crashChoir', w: 2 }, { k: 'skeletonBeast', w: 1 }, { k: 'crystalCluster', w: 2 }, { k: 'impactCrater', w: 1 }],
    5: [{ k: 'drownedTower', w: 4 }],
    6: [{ k: 'industrialStacks', w: 2 }, { k: 'choirTower', w: 1 }, { k: 'giantGear', w: 1 }, { k: 'impactCrater', w: 1 }],
    7: [{ k: 'giantShrooms', w: 3 }, { k: 'crystalCluster', w: 2 }, { k: 'monolithRing', w: 1 }, { k: 'impactCrater', w: 1 }],
    8: [{ k: 'choirTower', w: 1 }, { k: 'crystalCluster', w: 1 }],
    9: [{ k: 'giantGear', w: 3 }, { k: 'industrialStacks', w: 2 }, { k: 'choirTower', w: 1 }],
    10: [{ k: 'choirTower', w: 3 }, { k: 'monolithRing', w: 2 }, { k: 'crystalCluster', w: 1 }, { k: 'skeletonBeast', w: 1 }],
  };

  AS.Data.landmarkPins = {
    w1m1: [{ k: 'compassSite', x: 3800, y: 2400 }, { k: 'reliquarySite', x: 5300, y: 3710, flatten: 210 }],
  };
})(window.AS);
