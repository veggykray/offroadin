/* ALIEN STRIKE — structure definitions (data only).
 * role drives behaviour in src/game/structures.js:
 *  turret | sam | radar | comms | power | shieldgen | spawner | target | depot |
 *  pad | console | bunker | pen | iceblock | friendly | scenery | pylon
 * Links (power → turrets, shieldgen → targets) are set per mission. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  const W = (k, o) => Object.assign({ k }, o);
  const S = {
    // ---------- defences ----------
    turret: { name: 'Needle Turret', role: 'turret', hp: 90, armor: 2, r: 13, hc: 8, mech: true, sight: 420, solid: false,
      weapon: W('bullet', { dmg: 7, range: 400, rate: 1.1, burst: 2, speed: 440, col: '#e0b0ff' }), model: { gen: 'turretBase', pal: 'choir', opt: { style: 'needle' } }, gun: { kind: 'cannon' }, salvage: 16, drop: 0.3 },
    turret_heavy: { name: 'Lance Battery', role: 'turret', hp: 160, armor: 3, r: 14, hc: 9, mech: true, sight: 460,
      weapon: W('plasma', { dmg: 12, range: 440, rate: 0.7, burst: 2, speed: 330, col: '#c58aff', dtype: 'energy' }), model: { gen: 'turretBase', pal: 'choir', opt: { style: 'ancient' } }, gun: { kind: 'heavy' }, salvage: 26, drop: 0.4 },
    turret_bunker: { name: 'Gun Emplacement', role: 'turret', hp: 120, armor: 3, r: 14, hc: 7, mech: true, sight: 400,
      weapon: W('bullet', { dmg: 6, range: 380, rate: 2.4, burst: 3, speed: 460, col: '#ffd27a', spread: 0.05 }), model: { gen: 'turretBase', pal: 'colony', opt: { style: 'bunker' } }, gun: { kind: 'twin' }, salvage: 18, drop: 0.3 },
    turret_organic: { name: 'Spine Mound', role: 'turret', hp: 110, armor: 1, r: 14, hc: 6, organic: true, sight: 380,
      weapon: W('acid', { dmg: 8, range: 340, rate: 1.0, burst: 2, speed: 260, col: '#d8ff4a', dtype: 'bio' }), model: { gen: 'turretBase', pal: 'native', opt: { style: 'organic' } }, gun: { kind: 'organic' }, salvage: 14, drop: 0.3, splat: '#c8e040' },
    flak: { name: 'Flak Emplacement', role: 'turret', hp: 130, armor: 3, r: 14, hc: 8, mech: true, sight: 480,
      weapon: W('flak', { dmg: 8, range: 470, rate: 0.9, radius: 34, speed: 340, col: '#ffe0a0' }), model: { gen: 'turretBase', pal: 'choir', opt: { style: 'needle' } }, gun: { kind: 'flak' }, salvage: 22, drop: 0.3 },
    sam: { name: 'Missile Battery', role: 'sam', hp: 140, armor: 3, r: 14, hc: 8, mech: true, sight: 660,
      weapon: W('missile', { dmg: 16, range: 660, rate: 0.22, speed: 250, turn: 2.4, col: '#ff8af0' }), model: { gen: 'turretBase', pal: 'choir', opt: { style: 'needle' } }, gun: { kind: 'missile' }, salvage: 26, drop: 0.4 },
    pylon: { name: 'Arc Pylon', role: 'turret', hp: 150, armor: 3, r: 13, hc: 30, mech: true, sight: 260,
      weapon: W('lightning', { dmg: 14, range: 240, rate: 0.7, col: '#9ff6ff', dtype: 'energy' }), model: { gen: 'rod', pal: 'choir' }, salvage: 22, drop: 0.3 },
    aagun: { name: 'Sky Denial Gun', role: 'turret', hp: 260, armor: 4, r: 18, hc: 10, mech: true, sight: 540,
      weapon: W('flak', { dmg: 10, range: 520, rate: 1.4, radius: 38, speed: 380, col: '#e0c8ff' }), model: { gen: 'turretBase', pal: 'choir', opt: { style: 'ancient' } }, gun: { kind: 'flak', size: 1.3 }, salvage: 40, drop: 0.5 },
    lancertower: { name: 'Crystal Spire', role: 'turret', hp: 180, armor: 3, r: 14, hc: 20, organic: true, sight: 480,
      weapon: W('beam', { dmg: 22, range: 460, rate: 0.3, charge: 1, col: '#7ff8ff', dtype: 'energy' }), model: { gen: 'obelisk', pal: 'native', opt: { h: 34 } }, salvage: 26, drop: 0.3 },
    // ---------- systems ----------
    radar: { name: 'Radar Spire', role: 'radar', hp: 130, armor: 2, r: 14, hc: 18, mech: true, coverage: 1000, model: { gen: 'radar', pal: 'choir', anims: 8 }, salvage: 24, drop: 0.4, solid: true },
    comms: { name: 'Comm Relay', role: 'comms', hp: 110, armor: 2, r: 12, hc: 30, mech: true, model: { gen: 'comms', pal: 'choir', anims: 2 }, salvage: 22, drop: 0.4, solid: true },
    power: { name: 'Power Node', role: 'power', hp: 220, armor: 3, r: 24, hc: 12, mech: true, model: { gen: 'power', pal: 'choir' }, salvage: 34, drop: 0.5, solid: true },
    shieldgen: { name: 'Shield Generator', role: 'shieldgen', hp: 170, armor: 3, r: 15, hc: 12, mech: true, model: { gen: 'shieldgen', pal: 'choir' }, salvage: 30, drop: 0.5 },
    factory: { name: 'War Foundry', role: 'spawner', hp: 420, armor: 4, r: 34, hc: 14, mech: true, solid: true, spawn: { types: ['shardback'], max: 3, interval: 16 }, model: { gen: 'factory', pal: 'choir' }, salvage: 60, drop: 0.8 },
    barracks: { name: 'Thrall Barracks', role: 'spawner', hp: 260, armor: 3, r: 26, hc: 8, mech: true, solid: true, spawn: { types: ['thrall'], max: 6, interval: 7 }, model: { gen: 'barracks', pal: 'choir' }, salvage: 40, drop: 0.6 },
    nest: { name: 'Burrow Nest', role: 'spawner', hp: 200, armor: 1, r: 24, hc: 8, organic: true, spawn: { types: ['skitter'], max: 6, interval: 6 }, model: { gen: 'nest', pal: 'native', opt: { r: 20, seed: 3 } }, salvage: 26, drop: 0.5, splat: '#c8a040' },
    hive: { name: 'Hive Mound', role: 'spawner', hp: 260, armor: 2, r: 26, hc: 10, organic: true, spawn: { types: ['hivedrone'], max: 8, interval: 4 }, model: { gen: 'nest', pal: 'native', opt: { r: 22, seed: 9 } }, salvage: 30, drop: 0.5, splat: '#c0e040' },
    sporetower: { name: 'Spore Tower', role: 'spawner', hp: 240, armor: 2, r: 18, hc: 26, organic: true, solid: true, spawn: { types: ['skitter'], max: 4, interval: 9, pods: true }, model: { gen: 'sporeTower', pal: { a: '#5a3a5a', b: '#8a5a7a', t: '#c08ab0', g: '#d0ff6a', d: '#2a1a2a' } }, salvage: 40, drop: 0.6, splat: '#d0ff6a' },
    // ---------- objective targets ----------
    growth: { name: 'Hive Growth', role: 'target', hp: 120, r: 20, hc: 6, organic: true, burnable: true, model: { gen: 'pods', pal: 'native' }, salvage: 12, drop: 0.3, splat: '#c0e040' },
    derrick: { name: 'Drill Rig', role: 'target', hp: 260, armor: 3, r: 16, hc: 20, mech: true, solid: true, model: { gen: 'derrick', pal: 'colony', anims: 4 }, salvage: 40, drop: 0.5 },
    refinery: { name: 'Refinery', role: 'target', hp: 480, armor: 4, r: 38, hc: 14, mech: true, solid: true, model: { gen: 'refinery', pal: 'colony' }, salvage: 70, drop: 0.8 },
    reactor: { name: 'Reactor Core', role: 'target', hp: 420, armor: 4, r: 26, hc: 14, mech: true, solid: true, model: { gen: 'power', pal: 'choir' }, salvage: 60, drop: 0.8 },
    fueldepot: { name: 'Fuel Depot', role: 'depot', hp: 120, armor: 1, r: 26, hc: 8, mech: true, gives: 'fuel', model: { gen: 'tanks', pal: 'colony' }, salvage: 10, drop: 0 },
    ammodepot: { name: 'Munitions Store', role: 'depot', hp: 120, armor: 1, r: 22, hc: 6, mech: true, gives: 'ammo', model: { gen: 'bunker', pal: 'colony' }, salvage: 10, drop: 0 },
    pen: { name: 'Prisoner Pen', role: 'pen', hp: 90, r: 26, hc: 6, mech: true, model: { gen: 'pen', pal: 'choir' }, salvage: 4, drop: 0 },
    cocoon: { name: 'Hive Cocoon', role: 'pen', hp: 80, r: 18, hc: 8, organic: true, model: { gen: 'pods', pal: 'native', opt: { n: 3, seed: 5 } }, salvage: 4, drop: 0, splat: '#c0e040' },
    specimen: { name: 'Alien Organism', role: 'scenery', team: 'neutral', hp: 1, r: 14, hc: 10, invuln: true, model: { gen: 'sporeTower', pal: 'native', opt: { h: 24 } } },
    iceblock: { name: 'Ice Prison', role: 'iceblock', hp: 60, r: 14, hc: 8, model: { gen: 'iceBlock', pal: {} }, salvage: 2, drop: 0, splat: '#e0f4ff' },
    sonar: { name: 'Submerged Emitter', role: 'target', hp: 160, armor: 2, r: 16, hc: 2, mech: true, submerged: true, model: { gen: 'node', pal: 'choir', opt: { h: 8 } }, salvage: 26, drop: 0.3 },
    resonator: { name: 'Resonator Spire', role: 'target', hp: 220, armor: 3, r: 14, hc: 20, organic: true, model: { gen: 'obelisk', pal: 'native', opt: { h: 40 } }, salvage: 30, drop: 0.4 },
    pheromone: { name: 'Pheromone Node', role: 'target', hp: 200, armor: 2, r: 18, hc: 14, organic: true, model: { gen: 'sporeTower', pal: { a: '#6a5a1a', b: '#a89a3a', t: '#e0d07a', g: '#ffef4a', d: '#24200a' }, opt: { h: 30 } }, salvage: 30, drop: 0.4, splat: '#ffef4a' },
    coolant: { name: 'Coolant Pump', role: 'target', hp: 240, armor: 4, r: 18, hc: 12, mech: true, model: { gen: 'heatStation', pal: { a: '#4a5a6a', b: '#8aa0b8', t: '#7fe8ff', g: '#7fe8ff', d: '#1a2028' } }, salvage: 30, drop: 0.4 },
    sporeroot: { name: 'Spore Root', role: 'target', hp: 260, armor: 2, r: 20, hc: 8, organic: true, model: { gen: 'nest', pal: { a: '#6a3a7a', b: '#a060b8', g: '#9ffff0', d: '#22142a' }, opt: { r: 18, seed: 11 } }, salvage: 30, drop: 0.4, splat: '#9ffff0' },
    coupling: { name: 'Power Coupling', role: 'target', hp: 260, armor: 4, r: 15, hc: 12, mech: true, model: { gen: 'node', pal: 'choir', opt: { h: 20 } }, salvage: 30, drop: 0.4 },
    shieldpylon: { name: 'Sanctum Pylon', role: 'target', hp: 360, armor: 4, r: 16, hc: 30, mech: true, model: { gen: 'comms', pal: 'choir', opt: { h: 60 }, anims: 2 }, salvage: 40, drop: 0.5, solid: true },
    weaponcore: { name: 'Planetary Lance Core', role: 'target', hp: 1400, armor: 5, r: 44, hc: 24, mech: true, boss: true, model: { gen: 'core', pal: 'choir', anims: 4 }, salvage: 300, drop: 1, solid: true },
    // ---------- friendly / neutral ----------
    pad: { name: 'Landing Pad', role: 'pad', team: 'neutral', hp: 1, r: 40, hc: 2, invuln: true, flat: true, model: { gen: 'pad', pal: {} } },
    station: { name: 'Research Station', role: 'friendly', team: 'player', hp: 400, r: 32, hc: 10, invuln: true, solid: true, model: { gen: 'station', pal: 'colony' } },
    dome: { name: 'Colony Shelter', role: 'friendly', team: 'player', hp: 600, r: 28, hc: 14, solid: true, model: { gen: 'dome', pal: 'colony' } },
    heatstation: { name: 'Thermal Station', role: 'friendly', team: 'player', hp: 500, r: 30, hc: 14, invuln: true, solid: true, model: { gen: 'heatStation', pal: 'colony' } },
    wreckship: { name: 'Crashed Survey Ship', role: 'scenery', team: 'neutral', hp: 1, r: 40, hc: 10, invuln: true, solid: true, model: { gen: 'wreckShip', pal: 'colony' } },
    choirwreck: { name: 'Frozen Choir Ship', role: 'scenery', team: 'neutral', hp: 1, r: 40, hc: 10, invuln: true, solid: true, model: { gen: 'wreckShip', pal: 'choir' } },
    crashedship: { name: 'Crashed Frigate', role: 'friendly', team: 'player', hp: 700, r: 40, hc: 10, solid: true, model: { gen: 'wreckShip', pal: { a: '#5a6470', b: '#9aa6b4', t: '#e8a02a', g: '#7fe8ff', d: '#262c34' } } },
    obelisk: { name: 'Choir Ruin', role: 'scenery', team: 'neutral', hp: 1, r: 14, hc: 20, invuln: true, solid: true, model: { gen: 'obelisk', pal: 'choir', opt: { h: 46 } } },
    platform: { name: 'Platform', role: 'scenery', team: 'neutral', hp: 1, r: 30, hc: 4, invuln: true, flat: true, model: { gen: 'platform', pal: 'colony' } },
    vent: { name: 'Tunnel Vent', role: 'scenery', team: 'neutral', hp: 1, r: 22, hc: 2, invuln: true, flat: true, model: { gen: 'vent', pal: 'native' } },
    crusher: { name: 'Industrial Crusher', role: 'scenery', team: 'neutral', hp: 1, r: 30, hc: 20, invuln: true, model: { gen: 'crusher', pal: 'choir' } },
    // ---------- interactables (consoles) ----------
    relay: { name: 'Data Relay', role: 'console', team: 'neutral', hp: 1, r: 12, hc: 10, invuln: true, model: { gen: 'relay', pal: 'colony', anims: 2 } },
    thumper: { name: 'Seismic Thumper', role: 'console', team: 'neutral', hp: 1, r: 12, hc: 10, invuln: true, model: { gen: 'thumper', pal: 'colony', anims: 2 } },
    valve: { name: 'Thermal Valve', role: 'console', team: 'neutral', hp: 1, r: 14, hc: 8, invuln: true, model: { gen: 'node', pal: { a: '#7a6a5a', b: '#b8a890', g: '#ff8a3a', d: '#2a2420' }, opt: { h: 12 } } },
    rod: { name: 'Lightning Rod', role: 'console', team: 'neutral', hp: 1, r: 12, hc: 26, invuln: true, model: { gen: 'rod', pal: 'colony' } },
    switch: { name: 'Power Junction', role: 'console', team: 'neutral', hp: 1, r: 14, hc: 8, invuln: true, model: { gen: 'node', pal: { a: '#5a5448', b: '#8a8270', g: '#ff9a3a', d: '#1e1c18' }, opt: { h: 10 } } },
    bunker: { name: 'Sealed Bunker', role: 'bunker', team: 'neutral', hp: 1, r: 24, hc: 8, invuln: true, solid: true, model: { gen: 'bunker', pal: 'colony' } },
    charge_site: { name: 'Demolition Point', role: 'console', team: 'neutral', hp: 1, r: 12, hc: 4, invuln: true, flat: true, model: { gen: 'node', pal: { a: '#6a3a3a', b: '#a86a5a', g: '#ff4a3a', d: '#2a1414' }, opt: { h: 6 } } },
  };
  AS.Data.structures = S;
})(window.AS);
