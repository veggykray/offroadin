/* ALIEN STRIKE — enemy & friendly unit definitions (data only).
 * ai: behaviour archetype in src/game/ai.js. weapon.k: projectile/attack type in
 * src/game/projectiles.js. model.gen: generator in src/gfx/models*.js; model.pal is
 * a world palette key ('native' | 'choir' | 'colony') or an explicit palette. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  const E = {};
  const W = (k, o) => Object.assign({ k }, o);

  /* =============== WORLD 1 — ASHEN VALE =============== */
  E.skitter = { name: 'Skitter', world: 1, cls: 'creature', ai: 'pack', hp: 16, r: 8, hc: 5, speed: 170, turn: 9, organic: true, sight: 380,
    weapon: W('leap', { dmg: 6, range: 70, rate: 1.4, dtype: 'bio' }), model: { gen: 'quad', pal: 'native', opt: { len: 8, spikes: 1, jaws: 1, lift: 4 }, anims: 4 },
    salvage: 4, drop: 0.08, threat: 0.5, sfx: { die: 'creature_die', attack: 'screech' }, splat: '#c8a040' };
  E.tunneler = { name: 'Tunneler', world: 1, cls: 'creature', ai: 'burrower', hp: 60, armor: 1, r: 12, hc: 6, speed: 150, turn: 4, organic: true, sight: 420,
    weapon: W('acid', { dmg: 9, range: 300, rate: 0.9, burst: 2, speed: 260, col: '#b6ff4a', dtype: 'bio' }), model: { gen: 'worm', pal: 'native', opt: { segs: 3, rad: 6, plates: 1 }, anims: 4 },
    salvage: 12, drop: 0.25, threat: 1, sfx: { die: 'creature_die_big', attack: 'spit' }, splat: '#9ac040' };
  E.thrall = { name: 'Choir Thrall', world: 1, cls: 'infantry', ai: 'infantry', hp: 14, r: 7, hc: 7, speed: 70, turn: 6, mech: true, sight: 360,
    weapon: W('bullet', { dmg: 3, range: 300, rate: 1.4, burst: 3, speed: 380, col: '#d9a8ff', spread: 0.08 }), model: { gen: 'walker', pal: 'choir', opt: { legs: 2, lift: 6, size: 0.55, channels: 1 }, anims: 4 },
    salvage: 3, drop: 0.06, threat: 0.3, sfx: { die: 'mech_die_small' } };
  E.sentry = { name: 'Choir Sentry', world: 1, cls: 'air', ai: 'drone', hp: 24, r: 9, hc: 3, alt: 34, speed: 150, turn: 4, mech: true, sight: 460,
    weapon: W('plasma', { dmg: 5, range: 340, rate: 0.8, speed: 300, col: '#c58aff', dtype: 'energy' }), model: { gen: 'drone', pal: 'choir', opt: { fins: 3 } },
    salvage: 6, drop: 0.12, threat: 0.6, sfx: { die: 'mech_die_small' } };
  E.shardback = { name: 'Shardback Tank', world: 1, cls: 'vehicle', ai: 'tank', hp: 95, armor: 2, r: 14, hc: 6, speed: 85, turn: 2.2, mech: true, sight: 460,
    weapon: W('bullet', { dmg: 9, range: 340, rate: 0.75, speed: 430, col: '#ffd0ff', size: 3 }), model: { gen: 'hovertank', pal: 'choir', opt: { style: 'shard' } }, gun: { kind: 'cannon' },
    keepDist: 230, salvage: 20, drop: 0.35, threat: 1.4, sfx: { die: 'explode_med' } };
  E.needler = { name: 'Needler Battery', world: 1, cls: 'vehicle', ai: 'sam', hp: 80, armor: 2, r: 14, hc: 6, speed: 60, turn: 2, mech: true, sight: 600,
    weapon: W('missile', { dmg: 16, range: 640, rate: 0.22, speed: 250, turn: 2.4, col: '#ff8af0' }), model: { gen: 'tracked', pal: 'choir', opt: { len: 13, wid: 9 } }, gun: { kind: 'missile' },
    salvage: 22, drop: 0.4, threat: 1.5, sfx: { die: 'explode_med' } };
  E.overseer = { name: 'Overseer Ka-Thel', world: 1, cls: 'vehicle', ai: 'tank', elite: true, hp: 300, armor: 3, shield: 80, r: 18, hc: 8, speed: 95, turn: 2.4, mech: true, sight: 560,
    weapon: W('bullet', { dmg: 8, range: 380, rate: 1.6, burst: 2, speed: 460, col: '#ffb0ff', size: 3 }), weapon2: W('missile', { dmg: 14, range: 500, rate: 0.18, speed: 260, turn: 2.6, col: '#ff8af0' }),
    model: { gen: 'hovertank', pal: 'choir', opt: { style: 'shard', size: 1.35 } }, gun: { kind: 'twin', size: 1.3 },
    keepDist: 260, salvage: 120, drop: 1, threat: 3, sfx: { die: 'explode_big' } };

  /* =============== WORLD 2 — CRIMSON DUNES =============== */
  E.sandwyrm = { name: 'Sand Wyrm', world: 2, cls: 'creature', ai: 'burrower', hp: 150, armor: 3, r: 15, hc: 7, speed: 175, turn: 4, organic: true, sight: 460,
    weapon: W('acid', { dmg: 12, range: 320, rate: 0.8, burst: 3, speed: 280, col: '#ff9a4a', dtype: 'bio' }), model: { gen: 'worm', pal: 'native', opt: { segs: 4, rad: 7.5, plates: 1 }, anims: 4 },
    salvage: 24, drop: 0.35, threat: 1.6, sfx: { die: 'creature_die_big', attack: 'roar' }, splat: '#d07030' };
  E.raider = { name: 'Dune Raider', world: 2, cls: 'vehicle', ai: 'strafer', hp: 34, armor: 1, r: 9, hc: 5, speed: 230, turn: 4, mech: true, sight: 460,
    weapon: W('bullet', { dmg: 4, range: 260, rate: 2.2, burst: 3, speed: 440, col: '#ffd27a', spread: 0.06 }), model: { gen: 'bike', pal: { a: '#7a3a22', b: '#c0663a', t: '#e8c890', g: '#ffb04a', d: '#2a140c' }, opt: { rider: '#d8b088' } },
    salvage: 8, drop: 0.15, threat: 0.7, sfx: { die: 'explode_small' } };
  E.dragoon = { name: 'Dragoon Artillery', world: 2, cls: 'vehicle', ai: 'artillery', hp: 120, armor: 3, r: 16, hc: 6, speed: 50, turn: 1.5, mech: true, sight: 760,
    weapon: W('shell', { dmg: 22, range: 720, rate: 0.28, radius: 52, flight: 1.8, col: '#ffb04a' }), model: { gen: 'tracked', pal: { a: '#6a5a4a', b: '#a8907a', t: '#e8a02a', g: '#ffd36b', d: '#2a2420' }, opt: { len: 15, wid: 10 } }, gun: { kind: 'long' },
    salvage: 26, drop: 0.4, threat: 1.3, sfx: { die: 'explode_med' } };
  E.scarab = { name: 'Scarab Heavy', world: 2, cls: 'vehicle', ai: 'tank', hp: 170, armor: 4, r: 15, hc: 6, speed: 75, turn: 2, mech: true, sight: 460,
    weapon: W('bullet', { dmg: 13, range: 360, rate: 0.55, speed: 420, col: '#ffcf8a', size: 3 }), model: { gen: 'hovertank', pal: { a: '#7a5a3a', b: '#b8905a', t: '#e8c060', g: '#ffb04a', d: '#2a1e14' }, opt: { style: 'scarab' } }, gun: { kind: 'heavy' },
    keepDist: 240, salvage: 30, drop: 0.4, threat: 1.8, sfx: { die: 'explode_med' } };
  E.mender = { name: 'Mender Drone', world: 2, cls: 'vehicle', ai: 'repair', hp: 50, r: 10, hc: 6, speed: 120, turn: 4, mech: true, sight: 400, heal: 10,
    model: { gen: 'repairer', pal: 'colony' }, salvage: 14, drop: 0.5, threat: 0.3, sfx: { die: 'explode_small' } };
  E.crawler = { name: 'Mining Crawler', world: 2, cls: 'vehicle', ai: 'convoy', hp: 700, armor: 4, r: 40, hc: 14, speed: 30, turn: 0.6, mech: true, sight: 500, big: true,
    weapon: W('bullet', { dmg: 7, range: 320, rate: 1.4, burst: 3, speed: 420, col: '#ffd27a' }), model: { gen: 'crawler', pal: { a: '#8a6a3a', b: '#c4a060', t: '#e8a02a', g: '#ffd36b', d: '#2a2014' }, anims: 4, dirs: 32 },
    salvage: 90, drop: 1, threat: 2, sfx: { die: 'explode_big' } };

  /* =============== WORLD 3 — VERDANT HIVE =============== */
  E.hivedrone = { name: 'Hive Drone', world: 3, cls: 'air', ai: 'swarm', hp: 9, r: 6, hc: 2, alt: 26, speed: 190, turn: 6, organic: true, sight: 420,
    weapon: W('melee', { dmg: 3, range: 16, rate: 1.5, dtype: 'bio' }), model: { gen: 'insect', pal: 'native', opt: { len: 6, wings: 1, wingCol: '#d0f0c0' }, anims: 4 },
    salvage: 2, drop: 0.04, threat: 0.25, sfx: { die: 'bug_die' }, splat: '#c0e040' };
  E.spitter = { name: 'Spitter', world: 3, cls: 'creature', ai: 'skirmish', hp: 40, r: 9, hc: 5, speed: 110, turn: 5, organic: true, sight: 440,
    weapon: W('acid', { dmg: 8, range: 320, rate: 0.9, speed: 250, col: '#d8ff4a', dtype: 'bio' }), model: { gen: 'insect', pal: { a: '#5a6a2a', b: '#9aa83a', t: '#e0e07a', g: '#ffef3a', d: '#1e240e' }, opt: { len: 9, glowSac: 1 }, anims: 4 },
    keepDist: 220, salvage: 8, drop: 0.12, threat: 0.8, sfx: { die: 'bug_die', attack: 'spit' }, splat: '#d8ff4a' };
  E.lurker = { name: 'Thorn Lurker', world: 3, cls: 'creature', ai: 'ambush', hp: 80, armor: 1, r: 13, hc: 3, speed: 0, turn: 3, organic: true, sight: 150,
    weapon: W('leap', { dmg: 16, range: 110, rate: 0.8, dtype: 'bio' }), model: { gen: 'lurker', pal: { a: '#2a5a22', b: '#5a9a3a', t: '#e0a040', g: '#ff4a6a', d: '#2a1214' }, anims: 4, dirs: 1 },
    salvage: 14, drop: 0.3, threat: 1, sfx: { die: 'creature_die_big', attack: 'roar' }, splat: '#9a2a3a' };
  E.warrior = { name: 'Hive Warrior', world: 3, cls: 'creature', ai: 'pack', hp: 110, armor: 3, r: 13, hc: 6, speed: 140, turn: 5, organic: true, sight: 420,
    weapon: W('leap', { dmg: 14, range: 90, rate: 0.9, dtype: 'bio' }), model: { gen: 'insect', pal: { a: '#2a3a4a', b: '#4a6a7a', t: '#c0e0e0', g: '#7affd0', d: '#101820' }, opt: { len: 13 }, anims: 4 },
    salvage: 20, drop: 0.3, threat: 1.4, sfx: { die: 'creature_die_big', attack: 'screech' }, splat: '#7affd0' };
  E.hivebomber = { name: 'Bloat Bomber', world: 3, cls: 'air', ai: 'bomber', hp: 60, r: 13, hc: 3, alt: 48, speed: 110, turn: 1.6, organic: true, sight: 520,
    weapon: W('bomb', { dmg: 18, range: 30, rate: 0.6, radius: 50, col: '#c8ff4a', dtype: 'bio' }), model: { gen: 'ray', pal: { a: '#5a6a2a', b: '#9ab04a', t: '#e0ff9a', g: '#ffef4a', d: '#1e240e' }, opt: { span: 14 }, anims: 4 },
    salvage: 14, drop: 0.25, threat: 1, sfx: { die: 'creature_die_big' }, splat: '#c8ff4a' };

  /* =============== WORLD 4 — FROST REACH =============== */
  E.stalker = { name: 'Shard Stalker', world: 4, cls: 'creature', ai: 'pack', hp: 34, armor: 1, r: 9, hc: 6, speed: 190, turn: 8, organic: true, sight: 420, camo: true,
    weapon: W('leap', { dmg: 9, range: 80, rate: 1.2, dtype: 'kinetic' }), model: { gen: 'crystal', pal: 'native', opt: { len: 9 }, anims: 4 },
    salvage: 8, drop: 0.1, threat: 0.8, sfx: { die: 'glass_die', attack: 'screech' }, splat: '#bfe4ff' };
  E.lancer = { name: 'Crystal Lancer', world: 4, cls: 'creature', ai: 'turretcreature', hp: 130, armor: 3, r: 13, hc: 8, speed: 0, turn: 1.4, organic: true, sight: 520,
    weapon: W('beam', { dmg: 26, range: 460, rate: 0.3, charge: 1.0, col: '#7ff8ff', dtype: 'energy' }), model: { gen: 'turretBase', pal: 'native', opt: { style: 'ice' }, dirs: 1 }, gun: { kind: 'crystal' },
    salvage: 22, drop: 0.35, threat: 1.4, sfx: { die: 'glass_die' } };
  E.strider = { name: 'Ice Strider', world: 4, cls: 'vehicle', ai: 'walker', hp: 200, armor: 4, r: 15, hc: 18, speed: 60, turn: 1.6, mech: true, sight: 480,
    weapon: W('bullet', { dmg: 11, range: 360, rate: 0.9, burst: 2, speed: 420, col: '#ffcf8a', size: 3 }), weapon2: W('flak', { dmg: 8, range: 420, rate: 0.4, radius: 34, speed: 320, col: '#ffe0a0' }),
    model: { gen: 'walker', pal: { a: '#6a6a72', b: '#a8aab4', t: '#e8742a', g: '#ffb26a', d: '#2a2a32' }, opt: { legs: 4, lift: 13 }, anims: 4 },
    salvage: 32, drop: 0.45, threat: 1.8, sfx: { die: 'explode_med' } };
  E.frostdrone = { name: 'Rime Drone', world: 4, cls: 'air', ai: 'drone', hp: 30, r: 9, hc: 3, alt: 36, speed: 160, turn: 4, mech: true, sight: 460,
    weapon: W('plasma', { dmg: 6, range: 340, rate: 0.9, speed: 320, col: '#9ff6ff', dtype: 'energy' }), model: { gen: 'drone', pal: { a: '#8a9ab0', b: '#d0e0f0', g: '#7ff', d: '#2a3442' }, opt: { fins: 4 } },
    salvage: 7, drop: 0.12, threat: 0.6, sfx: { die: 'mech_die_small' } };

  /* =============== WORLD 5 — THE DROWNED WORLD =============== */
  E.lurcher = { name: 'Lurcher', world: 5, cls: 'creature', ai: 'submerger', hp: 60, armor: 1, r: 11, hc: 5, speed: 150, turn: 5, organic: true, amphibious: true, sight: 420,
    weapon: W('acid', { dmg: 9, range: 280, rate: 1, burst: 2, speed: 260, col: '#ffef6a', dtype: 'bio' }), model: { gen: 'amphibian', pal: 'native', anims: 4 },
    salvage: 10, drop: 0.2, threat: 0.9, sfx: { die: 'creature_die', attack: 'spit' }, splat: '#e0c040' };
  E.gull = { name: 'Gull Drone', world: 5, cls: 'air', ai: 'interceptor', hp: 26, r: 10, hc: 3, alt: 40, speed: 280, turn: 2.8, mech: true, sight: 600,
    weapon: W('bullet', { dmg: 4, range: 260, rate: 3, burst: 4, speed: 480, col: '#fff0a0', spread: 0.05 }), model: { gen: 'interceptor', pal: { a: '#8a9090', b: '#d0d8d0', t: '#e07a3a', g: '#ffd36b', d: '#2a3030' }, opt: { size: 0.75 } },
    salvage: 8, drop: 0.15, threat: 0.7, sfx: { die: 'explode_small' } };
  E.skimmer = { name: 'Skimmer Boat', world: 5, cls: 'vehicle', ai: 'tank', hp: 90, armor: 2, r: 14, hc: 5, speed: 140, turn: 2.4, mech: true, waterOnly: true, amphibious: true, sight: 480,
    weapon: W('bullet', { dmg: 6, range: 320, rate: 1.6, burst: 2, speed: 440, col: '#ffd27a' }), model: { gen: 'boat', pal: { a: '#4a5a5a', b: '#8aa0a0', t: '#e8a02a', g: '#ffd36b', d: '#1a2424' } }, gun: { kind: 'twin', size: 0.8 },
    keepDist: 220, salvage: 16, drop: 0.3, threat: 1, sfx: { die: 'explode_med' } };
  // convoy tanker: a skimmer's stats with a longer tank hull (art: src/gfx/art_map.js)
  E.tanker = Object.assign({}, E.skimmer, { name: 'Skimmer Tanker' });
  E.floatturret = { name: 'Buoy Turret', world: 5, cls: 'air', ai: 'floater', hp: 70, armor: 2, r: 12, hc: 4, alt: 16, speed: 20, turn: 2, mech: true, sight: 460,
    weapon: W('flak', { dmg: 7, range: 400, rate: 0.6, radius: 32, speed: 320, col: '#ffe0a0' }), model: { gen: 'sentinel', pal: { a: '#4a5a5a', b: '#8aa0a0', g: '#ffd36b', d: '#1a2424' } },
    salvage: 14, drop: 0.3, threat: 0.9, sfx: { die: 'explode_med' } };

  /* =============== WORLD 6 — OBSIDIAN FORGE =============== */
  E.golem = { name: 'Slag Golem', world: 6, cls: 'creature', ai: 'walker', hp: 240, armor: 4, r: 15, hc: 12, speed: 55, turn: 1.6, organic: true, mech: true, sight: 440,
    weapon: W('acid', { dmg: 16, range: 340, rate: 0.5, burst: 1, speed: 220, col: '#ff8a2a', dtype: 'energy', big: true }), weapon2: W('melee', { dmg: 20, range: 30, rate: 0.8 }),
    model: { gen: 'golem', pal: 'native', anims: 4 }, salvage: 34, drop: 0.45, threat: 1.8, sfx: { die: 'explode_med' }, splat: '#ff7a2a' };
  E.forgedrone = { name: 'Forge Drone', world: 6, cls: 'air', ai: 'drone', hp: 36, r: 9, hc: 3, alt: 34, speed: 170, turn: 4, mech: true, sight: 480,
    weapon: W('plasma', { dmg: 7, range: 340, rate: 1, speed: 320, col: '#ff9a3a', dtype: 'energy' }), model: { gen: 'drone', pal: { a: '#4a4040', b: '#8a7a6a', g: '#ff7a2a', d: '#1a1210' }, opt: { fins: 3 } },
    salvage: 8, drop: 0.12, threat: 0.7, sfx: { die: 'mech_die_small' } };
  E.magma = { name: 'Magma Mortar', world: 6, cls: 'vehicle', ai: 'artillery', hp: 140, armor: 3, r: 16, hc: 6, speed: 40, turn: 1.2, mech: true, sight: 760,
    weapon: W('shell', { dmg: 26, range: 720, rate: 0.3, radius: 58, flight: 1.9, col: '#ff7a2a', burn: true }), model: { gen: 'tracked', pal: { a: '#3a3230', b: '#6a5a50', t: '#ff7a2a', g: '#ff9a3a', d: '#120c0a' } }, gun: { kind: 'mortar' },
    salvage: 28, drop: 0.4, threat: 1.4, sfx: { die: 'explode_med' } };
  E.forgetank = { name: 'Anvil Tank', world: 6, cls: 'vehicle', ai: 'tank', hp: 190, armor: 5, r: 15, hc: 6, speed: 70, turn: 2, mech: true, sight: 460,
    weapon: W('bullet', { dmg: 12, range: 360, rate: 0.7, burst: 2, speed: 440, col: '#ffb06a', size: 3 }), model: { gen: 'hovertank', pal: { a: '#3a3230', b: '#6a5a50', t: '#ff7a2a', g: '#ff9a3a', d: '#120c0a' }, opt: { style: 'slab' } }, gun: { kind: 'heavy' },
    keepDist: 230, salvage: 30, drop: 0.4, threat: 1.8, sfx: { die: 'explode_med' } };

  /* =============== WORLD 7 — THE SPORE MOON =============== */
  E.sporeling = { name: 'Sporeling', world: 7, cls: 'creature', ai: 'pack', hp: 40, r: 9, hc: 9, speed: 120, turn: 6, organic: true, sight: 400,
    weapon: W('spore', { dmg: 4, range: 240, rate: 0.5, radius: 40, speed: 200, col: '#7fffd0', dtype: 'bio' }), model: { gen: 'fungal', pal: 'native', anims: 4 },
    salvage: 7, drop: 0.12, threat: 0.7, sfx: { die: 'squelch' }, splat: '#7fffd0', ranged: true };
  E.infected = { name: 'Infected Walker', world: 7, cls: 'vehicle', ai: 'walker', hp: 210, armor: 3, r: 15, hc: 16, speed: 55, turn: 1.6, mech: true, organic: true, sight: 460,
    weapon: W('bullet', { dmg: 10, range: 340, rate: 0.9, burst: 2, speed: 400, col: '#d8ff9a' }), weapon2: W('spore', { dmg: 5, range: 420, rate: 0.3, radius: 54, speed: 220, col: '#9fffcf', dtype: 'bio' }),
    model: { gen: 'walker', pal: { a: '#5a5a66', b: '#8a8a9a', t: '#c0306a', g: '#7fffd0', d: '#22202c' }, opt: { legs: 4, lift: 12, round: 1 }, anims: 4 },
    salvage: 30, drop: 0.45, threat: 1.6, sfx: { die: 'explode_med' } };
  E.puffball = { name: 'Puffball Mine', world: 7, cls: 'air', ai: 'mine', hp: 20, r: 9, hc: 4, alt: 22, speed: 60, turn: 2, organic: true, sight: 260,
    weapon: W('burst', { dmg: 22, range: 34, radius: 70, col: '#e0a0ff', dtype: 'bio' }), model: { gen: 'puff', pal: { a: '#8a5a9a', b: '#d0a0e0', t: '#fff', g: '#fff0a0' }, anims: 4, dirs: 1 },
    salvage: 3, drop: 0.05, threat: 0.5, sfx: { die: 'squelch' }, splat: '#e0a0ff' };
  E.sporemortar = { name: 'Spore Mortar', world: 7, cls: 'creature', ai: 'artillery', hp: 110, armor: 2, r: 14, hc: 8, speed: 0, turn: 1, organic: true, sight: 700,
    weapon: W('spore', { dmg: 6, range: 640, rate: 0.35, radius: 70, speed: 210, col: '#c58aff', dtype: 'bio', lob: true }), model: { gen: 'nest', pal: { a: '#5a3a6a', b: '#8a5aa0', g: '#c58aff', d: '#22142a' }, opt: { r: 13, seed: 7 }, dirs: 1 },
    salvage: 20, drop: 0.35, threat: 1.2, sfx: { die: 'squelch' }, splat: '#c58aff' };

  /* =============== WORLD 8 — STORM GIANT =============== */
  E.skyray = { name: 'Sky Ray', world: 8, cls: 'air', ai: 'interceptor', hp: 60, r: 14, hc: 3, alt: 46, speed: 230, turn: 2.2, organic: true, sight: 600,
    weapon: W('lightning', { dmg: 9, range: 160, rate: 0.8, col: '#9ff' , dtype: 'energy' }), model: { gen: 'ray', pal: 'native', opt: { span: 17 }, anims: 4 },
    salvage: 12, drop: 0.2, threat: 1, sfx: { die: 'creature_die_big' }, splat: '#9ff' };
  E.stormint = { name: 'Storm Interceptor', world: 8, cls: 'air', ai: 'interceptor', hp: 70, armor: 2, shield: 30, r: 13, hc: 3, alt: 44, speed: 300, turn: 2.6, mech: true, sight: 640,
    weapon: W('bullet', { dmg: 5, range: 300, rate: 3.2, burst: 4, speed: 520, col: '#c8b0ff', spread: 0.04 }), weapon2: W('missile', { dmg: 12, range: 500, rate: 0.15, speed: 280, turn: 2.8, col: '#ff8af0' }),
    model: { gen: 'interceptor', pal: 'choir' }, salvage: 18, drop: 0.3, threat: 1.3, sfx: { die: 'explode_med' } };
  E.gunship = { name: 'Choir Gunship', world: 8, cls: 'air', ai: 'gunship', hp: 260, armor: 3, shield: 60, r: 22, hc: 4, alt: 50, speed: 110, turn: 1.4, mech: true, sight: 600,
    weapon: W('plasma', { dmg: 9, range: 420, rate: 1.2, burst: 3, speed: 320, col: '#c58aff', dtype: 'energy' }), weapon2: W('missile', { dmg: 14, range: 520, rate: 0.2, speed: 260, turn: 2.6, col: '#ff8af0' }),
    model: { gen: 'gunship', pal: 'choir' }, salvage: 48, drop: 0.6, threat: 2.2, sfx: { die: 'explode_big' } };

  /* =============== WORLD 9 — THE DEAD MACHINE =============== */
  E.sentinel = { name: 'Ancient Sentinel', world: 9, cls: 'air', ai: 'floater', hp: 120, armor: 3, shield: 40, r: 14, hc: 4, alt: 30, speed: 70, turn: 2, mech: true, sight: 520,
    weapon: W('beam', { dmg: 22, range: 420, rate: 0.35, charge: 0.9, col: '#ff6a3a', dtype: 'energy' }), model: { gen: 'sentinel', pal: 'native', anims: 4 },
    salvage: 24, drop: 0.35, threat: 1.4, sfx: { die: 'explode_med' } };
  E.gearcrawler = { name: 'Gear Crawler', world: 9, cls: 'vehicle', ai: 'tank', hp: 210, armor: 5, r: 16, hc: 6, speed: 70, turn: 1.8, mech: true, sight: 460,
    weapon: W('bullet', { dmg: 11, range: 340, rate: 1.0, burst: 2, speed: 420, col: '#ffb06a', size: 3 }), model: { gen: 'tracked', pal: { a: '#5a5448', b: '#8a8270', t: '#ff6a3a', g: '#ff9a3a', d: '#1e1c18' }, opt: { len: 14, wid: 10 } }, gun: { kind: 'twin' },
    keepDist: 220, salvage: 30, drop: 0.4, threat: 1.7, sfx: { die: 'explode_med' } };
  E.mite = { name: 'Machine Mite', world: 9, cls: 'creature', ai: 'pack', hp: 22, armor: 2, r: 8, hc: 4, speed: 190, turn: 9, mech: true, sight: 380,
    weapon: W('leap', { dmg: 7, range: 70, rate: 1.4, dtype: 'kinetic' }), model: { gen: 'insect', pal: { a: '#5a5448', b: '#9a9078', t: '#ff6a3a', g: '#ff6a3a', d: '#1e1c18' }, opt: { len: 7 }, anims: 4 },
    salvage: 5, drop: 0.08, threat: 0.5, sfx: { die: 'mech_die_small' } };

  /* =============== WORLD 10 — THE FIRST WORLD =============== */
  E.choirlancer = { name: 'Choir Lancer', world: 10, cls: 'vehicle', ai: 'tank', elite: true, hp: 220, armor: 4, shield: 70, r: 15, hc: 7, speed: 100, turn: 2.4, mech: true, sight: 520,
    weapon: W('beam', { dmg: 24, range: 420, rate: 0.4, charge: 0.8, col: '#c09aff', dtype: 'energy' }), model: { gen: 'hovertank', pal: 'choir', opt: { style: 'shard', size: 1.15 } }, gun: { kind: 'beam' },
    keepDist: 260, salvage: 40, drop: 0.45, threat: 2, sfx: { die: 'explode_med' } };
  E.titan = { name: 'Choir Titan', world: 10, cls: 'vehicle', ai: 'walker', elite: true, hp: 520, armor: 6, shield: 120, r: 22, hc: 24, speed: 45, turn: 1.2, mech: true, sight: 560,
    weapon: W('plasma', { dmg: 12, range: 420, rate: 1.4, burst: 3, speed: 330, col: '#c09aff', dtype: 'energy' }), weapon2: W('missile', { dmg: 16, range: 560, rate: 0.25, speed: 260, turn: 2.6, col: '#ff8af0' }),
    model: { gen: 'walker', pal: 'choir', opt: { legs: 2, lift: 18, size: 1.5, channels: 1 }, anims: 4 },
    salvage: 90, drop: 1, threat: 3, sfx: { die: 'explode_big' } };
  E.seraph = { name: 'Seraph', world: 10, cls: 'air', ai: 'interceptor', hp: 90, armor: 2, shield: 50, r: 14, hc: 3, alt: 46, speed: 320, turn: 2.8, mech: true, sight: 660,
    weapon: W('plasma', { dmg: 7, range: 340, rate: 2.2, burst: 3, speed: 420, col: '#e0c8ff', dtype: 'energy' }), model: { gen: 'interceptor', pal: { a: '#b8ae9a', b: '#e6dcc6', t: '#5a4f7a', g: '#c09aff', d: '#3a3446' }, opt: { size: 1.1 } },
    salvage: 24, drop: 0.3, threat: 1.5, sfx: { die: 'explode_med' } };
  E.behemoth = { name: 'Living Engine', world: 10, cls: 'creature', ai: 'walker', hp: 420, armor: 5, r: 22, hc: 10, speed: 60, turn: 1.4, organic: true, mech: true, sight: 520,
    weapon: W('acid', { dmg: 14, range: 380, rate: 0.9, burst: 3, speed: 280, col: '#c09aff', dtype: 'energy' }), weapon2: W('leap', { dmg: 24, range: 90, rate: 0.5 }),
    model: { gen: 'quad', pal: 'native', opt: { len: 18, wid: 9, lift: 7, spikes: 1, jaws: 1, size: 1.2 }, anims: 4 },
    salvage: 60, drop: 0.8, threat: 2.4, sfx: { die: 'creature_die_big' }, splat: '#c09aff' };

  /* =============== FRIENDLIES =============== */
  E.hauler = { name: 'Ore Hauler', world: 0, team: 'player', cls: 'vehicle', ai: 'convoy', hp: 220, armor: 2, r: 18, hc: 8, speed: 70, turn: 1.6, mech: true, sight: 0,
    model: { gen: 'hauler', pal: 'colony', opt: { cargoSide: '#7a5a3a', cargoTop: '#a8825a' } }, salvage: 0, threat: 0 };
  E.ally_tank = { name: 'FRC Warden Tank', world: 0, team: 'player', cls: 'vehicle', ai: 'allytank', hp: 260, armor: 4, r: 15, hc: 6, speed: 80, turn: 2, mech: true, sight: 460,
    weapon: W('bullet', { dmg: 12, range: 360, rate: 0.8, speed: 460, col: '#9fe8ff', size: 3 }), model: { gen: 'hovertank', pal: { a: '#5a6470', b: '#9aa6b4', t: '#e8a02a', g: '#7fe8ff', d: '#262c34' }, opt: { style: 'slab' } }, gun: { kind: 'heavy' },
    keepDist: 240, salvage: 0, threat: 0 };
  E.ally_gunship = { name: 'FRC Lancer Gunship', world: 0, team: 'player', cls: 'air', ai: 'allyair', hp: 160, armor: 2, r: 16, hc: 3, alt: 52, speed: 200, turn: 2.2, mech: true, sight: 520,
    weapon: W('bullet', { dmg: 6, range: 340, rate: 2.5, burst: 3, speed: 520, col: '#9fe8ff' }), model: { gen: 'gunship', pal: { a: '#5a6470', b: '#9aa6b4', t: '#e8a02a', g: '#7fe8ff', d: '#262c34' } },
    salvage: 0, threat: 0 };

  AS.Data.enemies = E;
})(window.AS);
