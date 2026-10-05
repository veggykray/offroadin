/* ALIEN STRIKE — World 1: ASHEN VALE. Three fully authored operations. */
'use strict';
(function (AS) {
  const L = AS.L;

  /* =====================================================================
   * W1-M1  BROKEN COMPASS — rescue the crashed survey crew
   * ===================================================================== */
  AS.Levels.add({
    id: 'w1m1', world: 1, index: 1, name: 'BROKEN COMPASS', region: 'Kessler Basin',
    map: { w: 6000, h: 6000, seed: 11 },
    start: { x: 3000, y: 5480, angle: -Math.PI / 2 },
    extraction: { x: 3000, y: 5620, r: 70 },
    briefing: {
      tagline: 'Rescue the crew of the downed survey ship Compass.',
      danger: 1,
      situation: 'Thirty hours ago the survey ship Compass went down in the Kessler Basin with seven crew aboard. Their beacon is still pinging from the north valley. Something in the basin is hunting them — and the colony relay picked up Choir signal traffic for the first time in a century. Find the crew, ferry them back to the dropship, and get out. Your passenger bay seats four: plan your trips.',
      narration: 'Vesper, Halcyon Actual. The survey ship Compass went down in the Kessler Basin. Seven crew, scattered. Your bay seats four, so you will need to make runs back to the dropship. Watch your fuel. The basin is crawling with pack hunters, and we are reading Choir machines for the first time in a century. Bring our people home.',
      threats: ['Skitter packs — fast pack hunters, attack in groups', 'Tunnelers — burrowing creatures that surface to spit acid', 'Choir sentry drones and Shardback hover tanks', 'Needle turrets around a Choir holding pen'],
      intel: ['The Compass came down north-east of the landing zone.', 'Two crew fled west into the dry canyons.', 'A Choir relay pylon is broadcasting from the north-east ridge.', 'The old colony forward pad west of the LZ is dormant — it might still work.'],
      marks: [{ x: 3800, y: 2400, label: 'COMPASS', col: '#ffc35a' }, { x: 2350, y: 2250, label: '?', col: '#7fe8ff' }, { x: 1500, y: 3900, label: 'PAD', col: '#7dff9a' }],
    },
    rewards: { salvage: 450, tech: 1 },
    reinforcements: { comms: ['relay'], squads: [['skitter', 'skitter', 'skitter', 'skitter'], ['sentry', 'sentry', 'skitter', 'skitter'], ['shardback', 'sentry']], from: [{ x: 4800, y: 900 }, { x: 5600, y: 2600 }, { x: 600, y: 1200 }], delay: 9, cooldown: 50, max: 4 },
    lines: {
      w1m1_intro: { t: 'Beacon is weak but steady. The Compass is north-east of you. Fuel caches from the colony days should still be scattered around the basin.', s: 'command' },
      w1m1_wreck: { t: "That's the Compass. Flight recorder signal is strong. Grab it if you can.", s: 'command' },
      w1m1_engineer: { t: "This is Vasquez, survey engineer. There's a sealed colony bunker in the west canyon. Code is on my wrist pad — I'm sending it to you now.", s: 'survivor', name: 'ENGINEER VASQUEZ' },
      w1m1_pen: { t: "They've caged our people in a pen. Breach it, but watch your fire.", s: 'command' },
      w1m1_pad: { t: 'Colony pad responding. You can repair, refuel and rearm there.', s: 'ship' },
      w1m1_bunker: { t: 'Bunker seal released. Supplies inside.', s: 'ship' },
      w1m1_ruins: { t: 'Unidentified structures ahead. Choir architecture. Readings are off the charts.', s: 'intel' },
    },
    entities: [
      // ---- landing zone area & colony
      ...L.cache(3150, 5300, ['fuel', 'ammo']),
      { t: 'prop', k: 'container', x: 2860, y: 5350, n: 3, spread: 50 },
      // ---- dormant colony forward pad (activate it)
      { t: 'struct', k: 'pad', id: 'fob', x: 1500, y: 3900, pad: { dropoff: true } },
      { t: 'struct', k: 'relay', id: 'fob_console', x: 1580, y: 3840, label: 'Pad Power Console', verb: 'RESTORE', time: 2.5, doneMsg: 'Pad power restored' },
      { t: 'prop', k: 'lamp', x: 1440, y: 3940 }, { t: 'prop', k: 'lamp', x: 1560, y: 3960 }, { t: 'prop', k: 'container', x: 1420, y: 3840 },
      // ---- the crash site
      { t: 'struct', k: 'wreckship', id: 'wreck', x: 3800, y: 2400 },
      { t: 'survivors', id: 'crewA', x: 3700, y: 2490, n: 3, kind: 'crew', label: 'COMPASS CREW' },
      { t: 'cargo', k: 'blackbox', id: 'bb', x: 3880, y: 2320 },
      { t: 'zone', id: 'wreckzone', x: 3800, y: 2400, r: 300 },
      { t: 'prop', k: 'wreck', x: 3650, y: 2330, n: 3, spread: 70 }, { t: 'prop', k: 'barrel', x: 3920, y: 2470, n: 4, spread: 40 }, { t: 'prop', k: 'crate', x: 3700, y: 2300, n: 4, spread: 50 },
      ...L.cache(3560, 2560, ['fuel', 'missiles', 'salvage']),
      { t: 'unit', k: 'tunneler', x: 3600, y: 2150, burrowed: true },
      { t: 'unit', k: 'tunneler', x: 4100, y: 2600, burrowed: true },
      { t: 'unit', k: 'skitter', x: 4000, y: 2150, n: 4, spread: 60 },
      // ---- engineer and companion in the west canyon
      { t: 'survivors', id: 'crewB', x: 2350, y: 2250, n: 2, kind: 'engineer', label: 'ENGINEER VASQUEZ', voice: false },
      { t: 'unit', k: 'skitter', x: 2100, y: 2000, n: 5, spread: 70 },
      { t: 'unit', k: 'tunneler', x: 2600, y: 2500, burrowed: true },
      // ---- sealed colony bunker (code from the engineer)
      { t: 'struct', k: 'bunker', id: 'bunker', x: 900, y: 2700 },
      { t: 'struct', k: 'relay', id: 'bunker_door', x: 980, y: 2760, label: 'Bunker Door', verb: 'UNSEAL', time: 2, locked: true },
      // ---- Choir holding pen in the north, guarded
      { t: 'struct', k: 'pen', id: 'pen', x: 3200, y: 1100, hp: 70 },
      { t: 'survivors', id: 'crewC', x: 3200, y: 1100, n: 2, kind: 'crew', label: 'CAGED CREW', caged: 'pen' },
      { t: 'zone', id: 'penzone', x: 3200, y: 1100, r: 420 },
      ...L.outpost('pen', 3200, 1180, { turrets: 3, radius: 170, powerAt: [0, -230], props: false, garrison: [['thrall', 4, 0, 80]] }),
      { t: 'unit', k: 'sentry', x: 3000, y: 900, n: 2, spread: 50, patrol: [[3000, 900], [3500, 900], [3500, 1400], [3000, 1400]] },
      // ---- Choir relay pylon (reinforcements)
      { t: 'struct', k: 'comms', id: 'relay', x: 4700, y: 1500 },
      { t: 'struct', k: 'turret', id: 'relay_t1', x: 4600, y: 1600 }, { t: 'struct', k: 'turret', id: 'relay_t2', x: 4820, y: 1620 },
      // ---- patrols
      { t: 'unit', k: 'shardback', x: 3000, y: 3300, patrol: [[2600, 3300], [3600, 3100], [4200, 3500], [3200, 3800]] },
      { t: 'unit', k: 'shardback', x: 4600, y: 2900, patrol: [[4600, 2900], [5000, 2000], [4300, 1800]] },
      { t: 'unit', k: 'sentry', x: 2200, y: 3600, n: 2, spread: 40, patrol: [[2200, 3600], [1600, 3200], [2600, 2900]] },
      // ---- hidden: Kessler Reliquary (alien ruins in the east)
      { t: 'zone', id: 'ruins', x: 5300, y: 3700, r: 240 },
      { t: 'struct', k: 'obelisk', x: 5200, y: 3620 }, { t: 'struct', k: 'obelisk', x: 5420, y: 3760 }, { t: 'struct', k: 'obelisk', x: 5180, y: 3860 }, { t: 'struct', k: 'obelisk', x: 5380, y: 3560 },
      { t: 'cargo', k: 'artifact', id: 'relic', x: 5300, y: 3710, label: 'CHOIR RELIC' },
      { t: 'unit', k: 'skitter', x: 5300, y: 3400, n: 4, spread: 60 },
      // ---- scattered packs, supplies, scenery
      { t: 'scatter', what: 'unit', k: 'skitter', n: 6, size: [3, 5], area: [400, 400, 5600, 4800], seed: 3 },
      { t: 'scatter', what: 'unit', k: 'tunneler', n: 3, burrowed: true, area: [600, 600, 5400, 4600], seed: 4 },
      { t: 'scatter', what: 'pickup', k: 'fuel', n: 9, area: [300, 300, 5700, 5200], seed: 5 },
      { t: 'scatter', what: 'pickup', ks: ['ammo', 'missiles', 'salvage', 'salvage', 'repair', 'shield'], n: 12, area: [300, 300, 5700, 5200], seed: 6 },
      { t: 'scatter', what: 'obstacle', n: 34, h: [70, 130], seed: 7 },
      { t: 'scatter', what: 'prop', n: 40, cluster: 2, seed: 8 },
    ],
    objectives: [
      { id: 'rescue', type: 'rescue', groups: ['crewA', 'crewB', 'crewC'], required: 5, text: 'Rescue the Compass crew', short: 'Rescue at least 5 of 7 survivors', desc: 'Bring survivors to the dropship at the LZ or a working pad. Bay holds 4.', marker: 'CREW' },
      { id: 'pen', type: 'destroy', targets: ['pen'], text: 'Breach the Choir holding pen', short: 'Breach the holding pen', cat: 'secondary', reward: 120 },
      { id: 'bb', type: 'collect', items: ['bb'], text: 'Recover the Compass flight recorder', short: 'Recover the flight recorder', cat: 'secondary', reward: 150 },
      { id: 'fob', type: 'interact', targets: ['fob_console'], text: 'Restore power to the colony pad', short: 'Reactivate the forward pad', cat: 'secondary', reward: 100 },
      { id: 'relay', type: 'destroy', targets: ['relay'], text: 'Destroy the Choir relay pylon', short: 'Destroy the relay pylon', cat: 'secondary', reward: 150 },
      { id: 'bunker', type: 'interact', targets: ['bunker_door'], text: 'Unseal the colony bunker', short: 'Raid the sealed bunker', cat: 'hidden', locked: false },
      { id: 'reliquary', type: 'discover', zone: 'ruins', text: 'Discover the Kessler Reliquary', short: 'Discover the Kessler Reliquary', cat: 'hidden' },
      { id: 'relic', type: 'collect', items: ['relic'], text: 'Recover the Choir relic', short: 'Recover the Choir relic', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w1m1_intro' }] },
      { when: { enter: 'wreckzone' }, do: [{ say: 'w1m1_wreck' }] },
      { when: { enter: 'penzone' }, do: [{ say: 'w1m1_pen' }] },
      { when: { boarded: 'crewB' }, delay: 1.5, do: [{ say: 'w1m1_engineer' }, { unlock: 'bunker_door' }, { reveal: 'bunker' }, { markMap: { x: 940, y: 2720, label: 'BUNKER', col: '#ffd36b' } }] },
      { when: { interacted: 'fob_console' }, do: [{ padOn: 'fob' }, { say: 'w1m1_pad' }] },
      { when: { interacted: 'bunker_door' }, do: [{ say: 'w1m1_bunker' }, { pickup: { k: 'tech', x: 930, y: 2800 } }, { pickup: { k: 'repair', x: 960, y: 2810 } }, { pickup: { k: 'fuel', x: 990, y: 2800 } }, { pickup: { k: 'special', x: 1020, y: 2800 } }, { give: { salvage: 150 } }] },
      { when: { enter: 'ruins' }, do: [{ say: 'w1m1_ruins' }, { reveal: 'relic' }] },
    ],
  });

  /* =====================================================================
   * W1-M2  SEEDFALL — destroy the alien spore towers
   * ===================================================================== */
  AS.Levels.add({
    id: 'w1m2', world: 1, index: 2, name: 'SEEDFALL', region: 'Varga Steppe',
    map: { w: 6400, h: 6000, seed: 23 },
    start: { x: 800, y: 5300, angle: -Math.PI / 4 },
    extraction: { x: 700, y: 5450, r: 70 },
    briefing: {
      tagline: 'Burn out the spore towers seeding the steppe.',
      danger: 2,
      situation: 'The Choir have grown four spore towers across the Varga Steppe. Each one fires seed pods that hatch into skitter packs — the basin colonies will be overrun within days. Two of the towers sit under a Choir shield dome fed by a Lumen Well: you can crack the dome directly, or starve it of power. A radar spire in the north guides a missile battery; take the radar down and the battery goes half-blind. Colonists are holding out in the Varga research station.',
      narration: 'Vesper, the Choir have planted four spore towers across the Varga Steppe. Every pod they fire is another skitter pack. Destroy all four. Two towers sit under a shield dome. Hit the generator, or cut the Lumen Well that powers it. There is a missile battery in the north guided by a radar spire. Kill the radar and the battery loses its long-range lock. And Vesper, colonists are still holding the research station. Get them out if you can.',
      threats: ['Spore towers — launch pods that hatch skitters', 'Choir shield dome over the northern towers', 'Needler missile battery + radar spire', 'Shardback tanks, sentry drones, tunnelers'],
      intel: ['Forward pad Bravo is online in the middle of the steppe: repair, refuel, rearm.', 'Thrall barracks next to the Lumen Well.', 'Tower Alpha (south-east) is unprotected — a good first strike.'],
      marks: [{ x: 4600, y: 4300, label: 'T-A', col: '#ff9a5a' }, { x: 5400, y: 2200, label: 'T-B', col: '#ff9a5a' }, { x: 3300, y: 1100, label: 'T-C', col: '#ff9a5a' }, { x: 1900, y: 1400, label: 'T-D', col: '#ff9a5a' }, { x: 2700, y: 3500, label: 'FOB', col: '#7dff9a' }, { x: 1300, y: 3000, label: 'STATION', col: '#7fe8ff' }],
    },
    rewards: { salvage: 550, tech: 1, unlock: ['gravitic'] },
    reinforcements: { comms: ['b_comms'], squads: [['skitter', 'skitter', 'skitter', 'skitter', 'skitter'], ['shardback', 'sentry', 'sentry'], ['thrall', 'thrall', 'thrall', 'thrall']], from: [{ x: 6200, y: 400 }, { x: 3200, y: 200 }], delay: 10, cooldown: 45, max: 5 },
    lines: {
      w1m2_intro: { t: 'Four towers. Tower Alpha is closest and unshielded. Pad Bravo is online mid-steppe if you need it.', s: 'command' },
      w1m2_dome: { t: "Dome's up over the northern towers. The generator draws from the Lumen Well — follow the conduit.", s: 'command' },
      w1m2_station: { t: 'Varga station to any craft! We have four people and the doors will not hold!', s: 'survivor', name: 'VARGA STATION' },
      w1m2_tower: { t: 'Tower down. The seed pods are dying in the air.', s: 'command' },
      w1m2_well: { t: 'The Lumen Well is a Choir power source. Fascinating. Also, very explosive.', s: 'intel' },
      w1m2_reliquary: { t: 'Another Choir site, half buried. There is something still humming down there.', s: 'intel' },
    },
    entities: [
      ...L.fob('fob', 2700, 3500),
      ...L.cache(1000, 5150, ['fuel', 'ammo']),
      // ---- spore towers
      { t: 'struct', k: 'sporetower', id: 'towerA', x: 4600, y: 4300 },
      { t: 'struct', k: 'sporetower', id: 'towerB', x: 5400, y: 2200 },
      { t: 'struct', k: 'sporetower', id: 'towerC', x: 3300, y: 1100, shieldedBy: ['dome'] },
      { t: 'struct', k: 'sporetower', id: 'towerD', x: 1900, y: 1400, shieldedBy: ['dome'] },
      { t: 'unit', k: 'skitter', x: 4500, y: 4100, n: 5, spread: 70 },
      { t: 'unit', k: 'tunneler', x: 5200, y: 2400, burrowed: true }, { t: 'unit', k: 'skitter', x: 5300, y: 2000, n: 4 },
      // ---- shield dome + Lumen Well + barracks
      { t: 'struct', k: 'shieldgen', id: 'dome', x: 2600, y: 800, poweredBy: ['well'] },
      { t: 'struct', k: 'power', id: 'well', x: 2700, y: 500, label: 'Lumen Well' },
      { t: 'struct', k: 'barracks', id: 'barracks', x: 2350, y: 560, poweredBy: ['well'] },
      { t: 'struct', k: 'turret', id: 'well_t1', x: 2500, y: 700, poweredBy: ['well'] }, { t: 'struct', k: 'turret', id: 'well_t2', x: 2900, y: 700, poweredBy: ['well'] }, { t: 'struct', k: 'turret_heavy', id: 'well_t3', x: 2700, y: 260, poweredBy: ['well'] },
      { t: 'struct', k: 'comms', id: 'b_comms', x: 3000, y: 380 },
      { t: 'zone', id: 'domezone', x: 2600, y: 1000, r: 600 },
      // ---- radar + missile battery in the north
      { t: 'struct', k: 'radar', id: 'radar', x: 4300, y: 700 },
      { t: 'struct', k: 'sam', id: 'sam1', x: 4000, y: 1300 }, { t: 'struct', k: 'sam', id: 'sam2', x: 4700, y: 1500 },
      { t: 'unit', k: 'needler', x: 3600, y: 1800 },
      // ---- research station & colonists
      { t: 'struct', k: 'station', id: 'station', x: 1300, y: 3000 },
      { t: 'survivors', id: 'colonists', x: 1360, y: 3080, n: 4, kind: 'colonist', label: 'VARGA COLONISTS' },
      { t: 'zone', id: 'stationzone', x: 1300, y: 3000, r: 500 },
      { t: 'unit', k: 'skitter', x: 1000, y: 2700, n: 5, spread: 80 }, { t: 'unit', k: 'skitter', x: 1700, y: 3300, n: 4, spread: 60 },
      { t: 'prop', k: 'fence', x: 1300, y: 3150, n: 4, spread: 90 }, { t: 'prop', k: 'container', x: 1150, y: 2950, n: 2 },
      // ---- tank patrol (secondary)
      { t: 'unit', k: 'shardback', id: 'tankA', x: 3500, y: 2600, patrol: [[3000, 2600], [4200, 2400], [4400, 3200], [3200, 3200]] },
      { t: 'unit', k: 'shardback', id: 'tankB', x: 3600, y: 2650, patrol: [[3000, 2600], [4200, 2400], [4400, 3200], [3200, 3200]] },
      { t: 'unit', k: 'sentry', x: 3800, y: 2500, n: 2, patrol: [[3000, 2600], [4200, 2400], [4400, 3200], [3200, 3200]] },
      // ---- hidden: sunken reliquary
      { t: 'zone', id: 'reliquary', x: 6000, y: 5200, r: 220 },
      { t: 'struct', k: 'obelisk', x: 5950, y: 5120 }, { t: 'struct', k: 'obelisk', x: 6100, y: 5260 },
      ...L.cache(6000, 5230, ['tech', 'special', 'salvage'], { hidden: true }),
      { t: 'unit', k: 'tunneler', x: 5900, y: 5000, burrowed: true }, { t: 'unit', k: 'tunneler', x: 5700, y: 5300, burrowed: true },
      // ---- scatter
      { t: 'scatter', what: 'unit', k: 'skitter', n: 7, size: [3, 5], area: [400, 400, 6000, 5000], seed: 13 },
      { t: 'scatter', what: 'unit', k: 'sentry', n: 3, size: [2, 2], area: [1000, 600, 6000, 4000], seed: 14 },
      { t: 'scatter', what: 'unit', k: 'tunneler', n: 3, burrowed: true, area: [600, 600, 6000, 5000], seed: 15 },
      { t: 'scatter', what: 'pickup', k: 'fuel', n: 9, area: [300, 300, 6100, 5600], seed: 16 },
      { t: 'scatter', what: 'pickup', ks: ['ammo', 'missiles', 'salvage', 'repair', 'shield', 'special'], n: 12, area: [300, 300, 6100, 5600], seed: 17 },
      { t: 'scatter', what: 'obstacle', n: 30, h: [70, 130], seed: 18 },
      { t: 'scatter', what: 'prop', n: 35, cluster: 2, seed: 19 },
    ],
    objectives: [
      { id: 'towers', type: 'destroy', targets: ['towerA', 'towerB', 'towerC', 'towerD'], text: 'Destroy the spore towers', short: 'Destroy all four spore towers', desc: 'Two northern towers are protected by a shield dome.' },
      { id: 'colonists', type: 'rescue', groups: ['colonists'], required: 3, text: 'Evacuate the Varga colonists', short: 'Rescue the Varga colonists', cat: 'secondary', reward: 200 },
      { id: 'radar', type: 'destroy', targets: ['radar'], text: 'Destroy the radar spire', short: 'Blind the missile battery', cat: 'secondary', reward: 120 },
      { id: 'tanks', type: 'kill', targets: ['tankA', 'tankB'], text: 'Destroy the Shardback patrol', short: 'Destroy the tank patrol', cat: 'secondary', reward: 150 },
      { id: 'well', type: 'destroy', targets: ['well'], text: 'Destroy the Lumen Well', short: 'Destroy the Lumen Well', cat: 'secondary', reward: 150 },
      { id: 'reliquary', type: 'discover', zone: 'reliquary', text: 'Find the sunken reliquary', short: 'Find the sunken reliquary', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w1m2_intro' }] },
      { when: { enter: 'domezone' }, do: [{ say: 'w1m2_dome' }] },
      { when: { enter: 'stationzone' }, do: [{ say: 'w1m2_station' }] },
      { when: { destroyed: 'towerA' }, do: [{ say: 'w1m2_tower' }] },
      { when: { seen: 'well' }, do: [{ say: 'w1m2_well' }] },
      { when: { enter: 'reliquary' }, do: [{ say: 'w1m2_reliquary' }, { reveal_structs: [] }] },
    ],
  });

  /* =====================================================================
   * W1-M3  SILENT ARCHIVE — recover the research data, face the Basalt Maw
   * ===================================================================== */
  AS.Levels.add({
    id: 'w1m3', world: 1, index: 3, name: 'SILENT ARCHIVE', region: 'Thessaly Rift', boss: true,
    map: { w: 6400, h: 6400, seed: 37 },
    start: { x: 3200, y: 5900, angle: -Math.PI / 2 },
    extraction: { x: 3200, y: 6060, r: 75 },
    briefing: {
      tagline: 'Recover three research cores from the overrun archive.',
      danger: 3,
      situation: 'Thessaly Rift outpost studied the Choir ruins for two years before it went silent. Its research archive survives as three data cores. One lies in the outpost wreckage. One is locked in the archive vault — hack the data relay to open it. The third was taken by a Choir commander the colonists named Ka-Thel, an elite hover tank that hunts this rift. Your cargo clamps hold two cores at a time. Deep seismic readings under the rift are ... unusual. Seismic thumpers left by the miners still work.',
      narration: 'Vesper, Thessaly outpost spent two years studying the ruins before it went dark. Its archive is on three data cores. One in the outpost ruins. One in the vault: hack the relay to open it. The third is in the hands of a Choir commander the miners called Ka-Thel. Kill it and take the core. You can carry two at a time. And Vesper, our seismographs are picking up something very large under that rift. The old mining thumpers still work. Keep them in mind.',
      threats: ['Overseer Ka-Thel — shielded elite commander tank', 'Choir defences around the vault', 'Tunnelers and skitter packs', 'Unknown seismic contact — very large'],
      intel: ['Forward pad Charlie in the west canyon: repair, refuel, rearm.', 'Three seismic thumpers ring the landing zone.', 'Researchers may still be hiding in the east caves.'],
      marks: [{ x: 3300, y: 3300, label: 'OUTPOST', col: '#ffc35a' }, { x: 4700, y: 1500, label: 'VAULT', col: '#ffc35a' }, { x: 1200, y: 3800, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 700, tech: 2, unlock: ['beam', 'mines'] },
    reinforcements: { comms: ['v_comms'], squads: [['shardback', 'sentry', 'sentry'], ['thrall', 'thrall', 'thrall', 'thrall', 'thrall'], ['needler', 'sentry']], from: [{ x: 5800, y: 400 }, { x: 600, y: 600 }], delay: 9, cooldown: 45, max: 5 },
    lines: {
      w1m3_intro: { t: 'Outpost ruins dead ahead. The first core should still be in the main lab.', s: 'command' },
      w1m3_vault: { t: 'Vault is sealed. The data relay next to it can override the lock.', s: 'ship' },
      w1m3_hacked: { t: 'Relay compromised. Vault doors opening.', s: 'ship' },
      w1m3_overseer: { t: "That's Ka-Thel. It's carrying the third core. It is shielded: keep pressure on it, or hit it with EMP.", s: 'command' },
      w1m3_overseer_dead: { t: 'Ka-Thel is down. The core is on the ground. Pick it up.', s: 'command' },
      w1m3_maw: { t: 'Seismic spike! Something is coming up under the landing zone!', s: 'command' },
      w1m3_maw2: { t: 'Its hide is basalt-plated. The thumpers! Activate a thumper and it will surface stunned.', s: 'intel' },
      maw_stunned: { t: "It's stunned! Hit it now!", s: 'command' },
      w1m3_maw_dead: { t: 'The Maw is dead. Extraction is clear. Outstanding, Vesper.', s: 'command' },
      w1m3_researchers: { t: "We're in the caves! Three of us! Please!", s: 'survivor', name: 'THESSALY RESEARCHER' },
    },
    entities: [
      ...L.fob('fob', 1200, 3800),
      ...L.cache(3400, 5700, ['fuel', 'missiles']),
      // ---- outpost ruins (core A)
      { t: 'struct', k: 'station', id: 'outpost', x: 3300, y: 3300, invuln: true },
      { t: 'cargo', k: 'datacore', id: 'coreA', x: 3380, y: 3400, label: 'DATA CORE A' },
      { t: 'prop', k: 'wreck', x: 3150, y: 3420, n: 3, spread: 60 }, { t: 'prop', k: 'barrel', x: 3450, y: 3250, n: 5, spread: 50 }, { t: 'prop', k: 'container', x: 3200, y: 3180, n: 2 },
      { t: 'unit', k: 'skitter', x: 3500, y: 3500, n: 5, spread: 70 }, { t: 'unit', k: 'tunneler', x: 3100, y: 3600, burrowed: true }, { t: 'unit', k: 'tunneler', x: 3600, y: 3100, burrowed: true },
      { t: 'zone', id: 'outpostzone', x: 3300, y: 3300, r: 450 },
      // ---- the vault (core B) behind a hackable relay
      { t: 'struct', k: 'bunker', id: 'vault', x: 4700, y: 1500, locked: true, label: 'Archive Vault' },
      { t: 'cargo', k: 'datacore', id: 'coreB', x: 4700, y: 1560, label: 'DATA CORE B', locked: 'vault' },
      { t: 'struct', k: 'relay', id: 'datarelay', x: 4450, y: 1650, label: 'Data Relay', verb: 'HACK', time: 4, doneMsg: 'Relay hacked' },
      ...L.outpost('v', 4700, 1450, { turrets: 4, radius: 200, turret: 'turret', shield: true, shieldAt: [-260, -60], powerAt: [240, -200], props: false, garrison: [['thrall', 5, 0, 120]] }),
      { t: 'struct', k: 'comms', id: 'v_comms', x: 5150, y: 1100 },
      { t: 'zone', id: 'vaultzone', x: 4700, y: 1500, r: 520 },
      // ---- Overseer Ka-Thel (core C)
      { t: 'unit', k: 'overseer', id: 'overseer', x: 1800, y: 1500, patrol: [[1800, 1500], [2800, 1200], [2400, 2200], [1400, 2300]], leash: 1600 },
      { t: 'unit', k: 'shardback', x: 1900, y: 1600, n: 2, spread: 60, patrol: [[1800, 1500], [2800, 1200], [2400, 2200], [1400, 2300]] },
      { t: 'unit', k: 'sentry', x: 1700, y: 1400, n: 2, patrol: [[1800, 1500], [2800, 1200], [2400, 2200], [1400, 2300]] },
      // ---- the Basalt Maw (dormant until the cores are secured)
      { t: 'struct', k: 'thumper', id: 'th1', x: 2650, y: 5300, label: 'Seismic Thumper', verb: 'FIRE', time: 1.5, locked: true },
      { t: 'struct', k: 'thumper', id: 'th2', x: 3800, y: 5250, label: 'Seismic Thumper', verb: 'FIRE', time: 1.5, locked: true },
      { t: 'struct', k: 'thumper', id: 'th3', x: 3200, y: 4650, label: 'Seismic Thumper', verb: 'FIRE', time: 1.5, locked: true },
      // ---- researchers in the east caves (secondary)
      { t: 'survivors', id: 'researchers', x: 5600, y: 3600, n: 3, kind: 'scientist', label: 'RESEARCHERS', voice: false },
      { t: 'zone', id: 'caves', x: 5600, y: 3600, r: 380 },
      { t: 'unit', k: 'tunneler', x: 5400, y: 3800, burrowed: true }, { t: 'unit', k: 'skitter', x: 5700, y: 3300, n: 5, spread: 60 },
      // ---- hidden: the echo chamber
      { t: 'zone', id: 'echo', x: 600, y: 5600, r: 220 },
      { t: 'struct', k: 'obelisk', x: 520, y: 5520 }, { t: 'struct', k: 'obelisk', x: 690, y: 5650 }, { t: 'struct', k: 'obelisk', x: 560, y: 5700 },
      ...L.cache(610, 5600, ['tech', 'tech', 'special'], { hidden: true }),
      // ---- scatter
      { t: 'scatter', what: 'unit', k: 'skitter', n: 7, size: [3, 5], area: [400, 400, 6000, 5200], seed: 31 },
      { t: 'scatter', what: 'unit', k: 'sentry', n: 3, size: [2, 2], area: [600, 600, 6000, 4500], seed: 32 },
      { t: 'scatter', what: 'unit', k: 'tunneler', n: 3, burrowed: true, area: [600, 600, 6000, 5000], seed: 33 },
      { t: 'scatter', what: 'pickup', k: 'fuel', n: 10, area: [300, 300, 6100, 6000], seed: 34 },
      { t: 'scatter', what: 'pickup', ks: ['ammo', 'missiles', 'salvage', 'repair', 'shield', 'special', 'salvage'], n: 14, area: [300, 300, 6100, 6000], seed: 35 },
      { t: 'scatter', what: 'obstacle', n: 36, h: [80, 140], seed: 36 },
      { t: 'scatter', what: 'prop', n: 35, cluster: 2, seed: 37 },
    ],
    objectives: [
      { id: 'cores', type: 'collect', items: ['coreA', 'coreB', 'coreC'], required: 3, text: 'Deliver the archive data cores', short: 'Recover all three data cores', desc: 'Deliver cores at the LZ or forward pad. Cargo holds two.', marker: 'CORE' },
      { id: 'hack', type: 'interact', targets: ['datarelay'], text: 'Hack the data relay to open the vault', short: 'Hack the vault relay' },
      { id: 'overseer', type: 'kill', targets: ['overseer'], text: 'Destroy Overseer Ka-Thel', short: 'Destroy Overseer Ka-Thel' },
      { id: 'maw', type: 'boss', targets: ['maw'], text: 'Kill the Basalt Maw — lure it up with the thumpers', short: 'Kill the Basalt Maw', locked: true },
      { id: 'researchers', type: 'rescue', groups: ['researchers'], required: 2, text: 'Rescue the Thessaly researchers', short: 'Rescue the researchers', cat: 'secondary', reward: 200 },
      { id: 'comms', type: 'destroy', targets: ['v_comms'], text: 'Destroy the vault comm relay', short: 'Destroy the comm relay', cat: 'secondary', reward: 120 },
      { id: 'echo', type: 'discover', zone: 'echo', text: 'Find the echo chamber', short: 'Find the echo chamber', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w1m3_intro' }] },
      { when: { enter: 'vaultzone' }, do: [{ say: 'w1m3_vault' }] },
      { when: { interacted: 'datarelay' }, do: [{ say: 'w1m3_hacked' }, { unlock: 'vault' }] },
      { when: { near: { x: 1900, y: 1700, r: 700 } }, do: [{ say: 'w1m3_overseer' }] },
      { when: { killed: 'overseer' }, do: [{ say: 'w1m3_overseer_dead' }, { cargo: { k: 'datacore', id: 'coreC', x: 0, y: 0, label: 'DATA CORE C', at: 'overseer' } }] },
      { when: { enter: 'caves' }, do: [{ say: 'w1m3_researchers' }] },
      { when: { objective: 'cores' }, delay: 2, do: [{ say: 'w1m3_maw' }, { shake: 0.8 }, { spawn: [{ t: 'boss', k: 'maw', id: 'maw', x: 3200, y: 5000, active: true, manual: true }] }, { activate: 'maw' }, { unlock: ['th1', 'th2', 'th3'] }, { boss: 'maw', act: 'activate' }] },
      { when: { objective: 'cores' }, delay: 9, do: [{ say: 'w1m3_maw2' }] },
      { when: { interacted: 'th1' }, once: false, every: 1, do: [{ call: 'lureBoss', boss: 'maw', x: 2650, y: 5300 }, { call: 'rearmConsole', id: 'th1', t: 12 }] },
      { when: { interacted: 'th2' }, once: false, every: 1, do: [{ call: 'lureBoss', boss: 'maw', x: 3800, y: 5250 }, { call: 'rearmConsole', id: 'th2', t: 12 }] },
      { when: { interacted: 'th3' }, once: false, every: 1, do: [{ call: 'lureBoss', boss: 'maw', x: 3200, y: 4650 }, { call: 'rearmConsole', id: 'th3', t: 12 }] },
      { when: { objective: 'maw' }, do: [{ say: 'w1m3_maw_dead' }] },
    ],
  });
})(window.AS);
