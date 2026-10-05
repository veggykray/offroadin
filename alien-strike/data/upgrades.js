/* ALIEN STRIKE — hangar upgrades (data only).
 * cost[i] / tech[i] = price of buying level i+1. Effects are applied in
 * AS.Stats.compute() (src/game/stats.js). */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  const U = (id, cat, name, desc, cost, tech, effect) => ({ id, cat, name, desc, max: cost.length, cost, tech, effect });
  AS.Data.upgrades = [
    // ---- CRAFT: armour & shields
    U('armor', 'hull', 'ABLATIVE ARMOUR', 'Layered hull plating. +20 hull per level. Visible plates on wings and nose.', [220, 380, 600, 880, 1200], [0, 0, 1, 1, 2], '+20 HULL'),
    U('shield', 'hull', 'SHIELD LATTICE', 'Stronger emitter lattice. +15 shield capacity per level.', [200, 350, 560, 820], [0, 0, 1, 2], '+15 SHIELD'),
    U('shieldRegen', 'hull', 'FIELD CAPACITORS', 'Shields recover faster and sooner after damage.', [180, 320, 520, 760], [0, 1, 1, 2], '+25% RECHARGE'),
    U('kits', 'hull', 'REPAIR KIT RACK', 'Carry one more repair kit (R) into the field.', [300, 600], [0, 1], '+1 KIT SLOT'),
    // ---- CRAFT: propulsion & fuel
    U('fuelCap', 'drive', 'FUEL BLADDERS', 'Saddle tanks. +20% fuel capacity per level.', [160, 300, 480, 700], [0, 0, 1, 1], '+20% FUEL'),
    U('fuelEff', 'drive', 'DRIVE TUNING', 'Cleaner burn cycle. −10% fuel consumption per level.', [200, 360, 560, 800], [0, 1, 1, 2], '−10% BURN'),
    U('speed', 'drive', 'THRUSTER RINGS', 'Larger anti-grav rings. +7% speed and acceleration per level.', [220, 400, 640, 900], [0, 1, 1, 2], '+7% SPEED'),
    U('turning', 'drive', 'VECTOR VANES', 'Lateral thrusters. +15% turn rate and strafe authority.', [160, 300, 500], [0, 0, 1], '+15% TURN'),
    // ---- CRAFT: systems
    U('cargo', 'systems', 'CARGO CLAMPS', 'One more cargo slot for artefacts, cores and samples.', [260, 480, 760], [0, 1, 2], '+1 CARGO'),
    U('rescue', 'systems', 'PASSENGER BAY', 'Two more passenger seats per level.', [240, 440, 700], [0, 1, 2], '+2 SEATS'),
    U('scanner', 'systems', 'DEEP SCANNER', 'Radar range +25%. L2 reveals supply caches on the tactical map. L3 detects hidden structures and burrowed contacts.', [260, 520, 900], [0, 1, 2], '+25% RANGE'),
    // ---- PRIMARY HARDPOINT
    U('pDamage', 'primary', 'PRIMARY: DAMAGE', '+15% damage for the equipped primary weapon.', [200, 360, 560, 800, 1100], [0, 0, 1, 1, 2], '+15% DMG'),
    U('pRate', 'primary', 'PRIMARY: CYCLE RATE', '+12% fire rate.', [220, 400, 640, 900], [0, 1, 1, 2], '+12% RATE'),
    U('pHeat', 'primary', 'PRIMARY: HEAT SINKS', '+25% cooling and −15% heat per shot.', [160, 300, 480, 700], [0, 0, 1, 1], '+25% COOLING'),
    U('pSpread', 'primary', 'PRIMARY: MULTI-BARREL', 'Adds barrels to the pods: twin, then triple fire.', [600, 1100], [1, 2], '+1 BARREL'),
    U('pAmmo', 'primary', 'PRIMARY: MAGAZINES', '+25% primary ammunition capacity.', [160, 300, 460, 660], [0, 0, 1, 1], '+25% AMMO'),
    // ---- SECONDARY HARDPOINT
    U('sDamage', 'secondary', 'SECONDARY: WARHEADS', '+18% secondary damage.', [220, 400, 640, 900], [0, 1, 1, 2], '+18% DMG'),
    U('sLock', 'secondary', 'SECONDARY: LOCK SPEED', '−20% lock-on time.', [200, 360, 560], [0, 1, 1], '−20% LOCK'),
    U('sSplash', 'secondary', 'SECONDARY: BLAST RADIUS', '+20% splash radius.', [180, 340, 540], [0, 0, 1], '+20% SPLASH'),
    U('sAmmo', 'secondary', 'SECONDARY: RACKS', '+4 missiles (or equivalent) per level.', [200, 360, 560, 800], [0, 0, 1, 1], '+25% AMMO'),
    U('sMulti', 'secondary', 'SECONDARY: MULTI-LOCK', 'Paint one more target per salvo.', [500, 900, 1400], [1, 2, 3], '+1 LOCK'),
    // ---- SPECIAL HARDPOINT
    U('xCharges', 'special', 'SPECIAL: CHARGES', '+1 special charge.', [400, 750, 1150], [1, 1, 2], '+1 CHARGE'),
    U('xRadius', 'special', 'SPECIAL: EFFECT RADIUS', '+15% special radius.', [260, 480, 760], [0, 1, 1], '+15% RADIUS'),
    U('xDamage', 'special', 'SPECIAL: YIELD', '+20% special damage.', [280, 520, 820], [0, 1, 2], '+20% DMG'),
    U('xCooldown', 'special', 'SPECIAL: CYCLING', '−15% special cooldown.', [200, 380, 600], [0, 1, 1], '−15% COOLDOWN'),
  ];
  AS.Data.upgradeCats = [
    { id: 'hull', name: 'ARMOUR & SHIELDS' },
    { id: 'drive', name: 'PROPULSION & FUEL' },
    { id: 'systems', name: 'CARGO & SCANNER' },
    { id: 'primary', name: 'PRIMARY HARDPOINT' },
    { id: 'secondary', name: 'SECONDARY HARDPOINT' },
    { id: 'special', name: 'SPECIAL HARDPOINT' },
  ];
  AS.Data.repairKitCost = 120;
})(window.AS);
