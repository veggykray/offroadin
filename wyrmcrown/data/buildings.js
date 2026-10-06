/* WYRMCROWN — town buildings, defences, recruits and upgrades (data only).
 * Every faction builds from the same catalogue; the look comes from the
 * faction's model set (<faction>_<gen>, see wyrmcrown/tools/ART_GUIDE.md).
 * cost in gold · max = how many a town can hold · req = needs these first ·
 * slot = which ring of the town plan it occupies. Upgrades with levels list one
 * cost per level. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  AS.Data.buildings = {
    keep: { name: 'Stronghold', gen: 'keep', hp: [2600, 3800, 5400], r: 58, tall: 90, solid: true, slot: 'center', shoots: { kind: 'arrow', range: 380, rate: 1.4, minLevel: 2, volley: 3 },
      desc: 'The heart of your realm. If it falls, your realm falls. Its ward barrier holds while your wardstones stand or your dragon flies.' },
    roost: { name: 'Dragon Roost', gen: 'roost', hp: 900, r: 34, flat: false, slot: 'roost', desc: 'Your dragon heals and feeds here.' },
    house: { name: 'Houses', gen: 'house', hp: 240, r: 15, slot: 'house', burnable: true },
    farm: { name: 'Farmstead', gen: 'farm', hp: 360, r: 24, cost: 120, max: 4, slot: 'farm', livestock: 6, desc: 'Fields and pasture. Breeds livestock (+6 herd size), which is food for your dragon and earns gold at market.' },
    barracks: { name: 'Barracks', gen: 'barracks', hp: 700, r: 28, cost: 200, max: 1, slot: 'inner', troopCap: 8, desc: 'Trains soldiers and archers. +8 troop capacity.' },
    stable: { name: 'Stables', gen: 'stable', hp: 520, r: 26, cost: 160, max: 1, slot: 'inner', req: ['barracks'], livestock: 3, desc: 'Horses for knights and swifter gold carts.' },
    magetower: { name: 'Mage Tower', gen: 'magetower', hp: 760, r: 18, tall: 80, cost: 320, max: 1, slot: 'inner', shoots: { kind: 'magic', range: 540, rate: 0.55, airOnly: true }, desc: 'Arcane defences that seek enemy dragons, and the study of greater wizardry.' },
    temple: { name: 'Healers\' Temple', gen: 'temple', hp: 560, r: 22, cost: 220, max: 1, slot: 'inner', desc: 'Heals your dragon and troops in town and slowly repairs damaged buildings.' },
    market: { name: 'Market', gen: 'market', hp: 480, r: 24, cost: 180, max: 1, slot: 'inner', desc: '+20% gold from every source and twice the market price for livestock.' },
    workshop: { name: 'Siege Workshop', gen: 'workshop', hp: 560, r: 26, cost: 220, max: 1, slot: 'inner', req: ['barracks'], desc: 'Builds catapults for the walls and siege engines for your warband.' },
    tower: { name: 'Archer Tower', gen: 'tower', hp: 560, r: 14, tall: 60, cost: 110, max: 6, slot: 'tower', shoots: { kind: 'arrow', range: 380, rate: 1.1, volley: 2 }, desc: 'Archers who shoot at raiding troops and dragons.' },
    ballista: { name: 'Ballista', gen: 'ballista', hp: 420, r: 12, cost: 200, max: 4, slot: 'engine', dirs: 24, shoots: { kind: 'ballista', range: 660, rate: 0.3, airOnly: true }, desc: 'Anti-dragon bolts that pierce scales. Slow to reload, deadly at range.' },
    catapult: { name: 'Catapult', gen: 'catapult', hp: 460, r: 14, cost: 240, max: 2, slot: 'engine', dirs: 24, anims: 3, req: ['workshop'], shoots: { kind: 'stone', range: 760, rate: 0.22, groundPref: true }, desc: 'Hurls stones at warbands, siege engines and low-flying dragons.' },
    wall: { name: 'Walls', gen: 'wall', hp: [420, 950, 1600], r: 20, dirs: 16, cost: [200, 450, 900], levels: 3, slot: 'wall', desc: 'A ring of walls with a gatehouse. Stops raiding troops at the gate. Upgrade: palisade → stone → enchanted.' },
    gate: { name: 'Gatehouse', gen: 'gate', hp: [700, 1500, 2400], r: 22, dirs: 16, slot: 'wall' },
    watchtower: { name: 'Watchtower', gen: 'watchtower', hp: 320, r: 9, tall: 60, cost: 90, max: 2, slot: 'watch', reveal: 1500, desc: 'Watches the approaches: reveals the land around it on the war map and warns of raids.' },
    wardstone: { name: 'Wardstone', gen: 'wardstone', hp: 900, r: 13, cost: 160, max: 3, slot: 'ward', desc: 'Powers the stronghold\'s ward barrier. Rebuild fallen wardstones to restore it.' },
  };

  // what the court sells, by tab (items refer to buildings above, or special actions)
  AS.Data.court = {
    defence: ['wall', 'tower', 'ballista', 'catapult', 'magetower', 'watchtower', 'wardstone', 'keepUp'],
    army: ['recruitSoldiers', 'recruitArchers', 'recruitKnights', 'recruitSiege', 'barracks', 'stable', 'workshop'],
    economy: ['farm', 'market', 'temple', 'buyLivestock'],
    dragon: ['scales', 'wings', 'lungs', 'stomach', 'dragonSize'],
    wizard: ['staffPower', 'staffRate', 'staffMana'],
  };

  AS.Data.actions = {
    keepUp: { name: 'Raise the Stronghold', cost: [550, 1200], levels: 2, desc: 'A greater keep: more strength, archers on its walls, more troops and a grander town.' },
    recruitSoldiers: { name: 'Muster Soldiers', cost: 60, n: 4, unit: 'soldier', req: ['barracks'], desc: 'Four soldiers to garrison the town or march with your warband.' },
    recruitArchers: { name: 'Muster Archers', cost: 80, n: 4, unit: 'archer', req: ['barracks'], desc: 'Four archers who shoot at dragons and troops.' },
    recruitKnights: { name: 'Muster Knights', cost: 140, n: 2, unit: 'elite', req: ['stable'], desc: 'Two heavily armoured elite warriors.' },
    recruitSiege: { name: 'Build Siege Engine', cost: 180, n: 1, unit: 'siege', req: ['workshop'], desc: 'A rolling catapult for your warband — it batters walls and towers.' },
    buyLivestock: { name: 'Buy Livestock', cost: 70, n: 4, req: ['farm'], desc: 'Four animals for your pastures (dragon food and market income).' },
  };

  AS.Data.upgrades = {
    scales: { name: 'Hardened Scales', cost: [200, 420, 750], desc: '+22% dragon health and thicker armour per level.' },
    wings: { name: 'Mighty Wings', cost: [200, 420, 750], desc: '+7% flight speed and sharper turns per level.' },
    lungs: { name: 'Furnace Lungs', cost: [180, 380, 680], desc: '+25% breath capacity and +20% breath damage per level.' },
    stomach: { name: 'Iron Stomach', cost: [150, 320, 560], desc: '+25% energy reserve and 15% slower hunger per level.' },
    dragonSize: { name: 'Elder Growth', cost: [450, 950], desc: 'Your dragon grows larger and stronger: wider breath, more health.' },
    staffPower: { name: 'Staff of Power', cost: [180, 380, 680], desc: '+20% bolt damage per level; at level 3 the staff casts twin bolts.' },
    staffRate: { name: 'Quickening Runes', cost: [160, 340, 600], desc: '+18% casting speed per level.' },
    staffMana: { name: 'Deep Wellspring', cost: [140, 300, 520], desc: '+25% mana per level.' },
  };

  // troop types (generic roles; the look comes from the faction's troop models)
  AS.Data.troops = {
    soldier: { name: 'Soldier', hp: 46, r: 6, speed: 46, armor: 1, melee: { dmg: 7, rate: 1, range: 14 }, throwSpear: { range: 200, rate: 0.25, maxZ: 34 }, hc: 6, gold: 4 },
    archer: { name: 'Archer', hp: 30, r: 6, speed: 44, armor: 0, ranged: { kind: 'arrow', range: 330, rate: 0.6 }, melee: { dmg: 4, rate: 1, range: 14 }, hc: 6, gold: 4 },
    elite: { name: 'Knight', hp: 140, r: 7, speed: 50, armor: 4, melee: { dmg: 16, rate: 1, range: 15 }, throwSpear: { range: 200, rate: 0.3, maxZ: 34 }, hc: 7, gold: 10 },
    siege: { name: 'Siege Engine', hp: 260, r: 12, speed: 30, armor: 3, ranged: { kind: 'stone', range: 520, rate: 0.2, groundOnly: true, buildingPref: true }, hc: 8, gold: 15, gen: 'sg_catapult_cart', dirs: 24 },
    // neutral guardians (team 'wild')
    bandit: { name: 'Bandit', hp: 40, r: 6, speed: 50, armor: 0, ranged: { kind: 'crossbow', range: 320, rate: 0.5 }, melee: { dmg: 6, rate: 1, range: 14 }, hc: 6, gold: 8, gen: 'mon_bandit' },
    wolf: { name: 'Wolf', hp: 34, r: 6, speed: 90, armor: 0, melee: { dmg: 6, rate: 1.4, range: 13 }, hc: 4, gold: 3, gen: 'ani_wolf', animal: true },
    ogre: { name: 'Ogre', hp: 300, r: 11, speed: 40, armor: 2, melee: { dmg: 26, rate: 0.7, range: 20, splash: 18 }, throwRock: { range: 260, rate: 0.18 }, hc: 12, gold: 40, gen: 'mon_ogre' },
    troll: { name: 'Troll', hp: 380, r: 12, speed: 44, armor: 2, regen: 6, melee: { dmg: 30, rate: 0.7, range: 22, splash: 18 }, throwRock: { range: 280, rate: 0.2 }, hc: 14, gold: 55, gen: 'mon_troll' },
    giant: { name: 'Giant', hp: 900, r: 18, speed: 34, armor: 3, melee: { dmg: 52, rate: 0.45, range: 30, splash: 30 }, throwRock: { range: 380, rate: 0.28 }, hc: 22, gold: 120, gen: 'mon_giant', big: true },
    skeleton: { name: 'Risen', hp: 28, r: 6, speed: 46, armor: 0, melee: { dmg: 6, rate: 1, range: 14 }, hc: 6, gold: 2, gen: 'trp_undead_skeleton' },
  };

  AS.Data.difficulty = {
    easy: { name: 'Squire', ai: 0.75, aiHp: 0.85, income: 1.15, aiIncome: 0.85 },
    normal: { name: 'Knight', ai: 1, aiHp: 1, income: 1, aiIncome: 1 },
    hard: { name: 'Dragonlord', ai: 1.25, aiHp: 1.15, income: 0.95, aiIncome: 1.2 },
  };
})(window.AS);
