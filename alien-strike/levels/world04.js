/* ALIEN STRIKE — World 4: FROST REACH (whiteouts, ice fractures). */
'use strict';
(function (AS) {
  const L = AS.L;

  AS.Levels.add({
    id: 'w4m1', world: 4, index: 1, name: 'HEARTHFIRE', region: 'Calloway Shelf',
    map: { w: 6000, h: 6000, seed: 91 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Restart the thermal station before the colony freezes.',
      danger: 3,
      situation: 'The Calloway thermal station keeps nine hundred colonists alive through the polar night. Crystal stalkers wrecked its feed lines and the core has gone cold. Open the three thermal valves on the shelf — in sequence: north, east, then west — then hold the station while the core reignites. The crystal organisms are drawn to heat. When the core lights, they will come.',
      narration: 'Vesper, the Calloway thermal station is cold, and nine hundred colonists are freezing. Open the three thermal valves, in order: north, east, then west. Then defend the station while the core restarts. Ninety seconds. The crystal things are drawn to heat. They will come for it.',
      threats: ['Shard stalkers — crystal pack predators, near-invisible in whiteouts', 'Crystal lancers — rooted beam organisms', 'Ice striders and rime drones', 'Whiteouts and ice fractures'],
      intel: ['Valve North sits on the glacier lip.', 'Valve East is on the frozen sea.', 'Valve West is in the crevasse field.'],
      marks: [{ x: 3000, y: 3000, label: 'STATION', col: '#7dff9a' }, { x: 2900, y: 1100, label: 'V-N', col: '#ffc35a' }, { x: 5000, y: 2800, label: 'V-E', col: '#ffc35a' }, { x: 1000, y: 2700, label: 'V-W', col: '#ffc35a' }],
    },
    rewards: { salvage: 750, tech: 2, unlock: ['drones'] },
    reinforcements: { comms: [], squads: [['stalker', 'stalker', 'stalker', 'stalker'], ['strider', 'frostdrone', 'frostdrone']], from: [{ x: 300, y: 300 }, { x: 5700, y: 300 }], delay: 8, cooldown: 40, max: 4 },
    lines: {
      w4m1_intro: { t: 'Valves in order: north, east, west. The station will guide the restart.', s: 'command' },
      w4m1_valve: { t: 'Valve open. Pressure rising.', s: 'ship' },
      w4m1_ignite: { t: "Core ignition sequence started! Ninety seconds! They're coming, Vesper — hold the station!", s: 'command' },
      w4m1_done: { t: 'Core is stable. Heat is flowing to the colony. You did it.', s: 'command' },
    },
    entities: [
      { t: 'struct', k: 'heatstation', id: 'station', x: 3000, y: 3000, invuln: false, team: 'player', hp: 900 },
      { t: 'struct', k: 'pad', id: 'spad', x: 3200, y: 3150, pad: { repair: true, refuel: true, rearm: true, dropoff: true } },
      { t: 'struct', k: 'valve', id: 'vN', x: 2900, y: 1100, label: 'Valve North', verb: 'OPEN', time: 2.5 },
      { t: 'struct', k: 'valve', id: 'vE', x: 5000, y: 2800, label: 'Valve East', verb: 'OPEN', time: 2.5, locked: true },
      { t: 'struct', k: 'valve', id: 'vW', x: 1000, y: 2700, label: 'Valve West', verb: 'OPEN', time: 2.5, locked: true },
      { t: 'unit', k: 'lancer', x: 2700, y: 1200 }, { t: 'unit', k: 'lancer', x: 5150, y: 2600 }, { t: 'unit', k: 'lancer', x: 1150, y: 2900 },
      { t: 'unit', k: 'stalker', x: 3100, y: 1300, n: 4 }, { t: 'unit', k: 'strider', x: 4800, y: 3000 }, { t: 'unit', k: 'stalker', x: 900, y: 2500, n: 4 },
      { t: 'struct', k: 'lancertower', x: 1900, y: 1900 }, { t: 'struct', k: 'lancertower', x: 4200, y: 1800 },
      { t: 'zone', id: 'cave', x: 5300, y: 800, r: 200 }, ...L.cache(5300, 820, ['tech', 'repair', 'special'], { hidden: true }),
      ...L.fill(91, { units: [['stalker', 5, [3, 4]], ['frostdrone', 4, [2, 2]], ['strider', 2, [1, 1]], ['lancer', 2, [1, 1]]], obstacles: 28 }),
    ],
    objectives: [
      { id: 'valves', type: 'interact', targets: ['vN', 'vE', 'vW'], ordered: true, text: 'Open the thermal valves in sequence', short: 'Open the three valves (N, E, W)' },
      { id: 'defend', type: 'defend', target: 'station', duration: 90, startOn: { objective: 'valves' }, text: 'Defend the thermal station', short: 'Defend the station during ignition', locked: true },
      { id: 'cave', type: 'discover', zone: 'cave', text: 'Find the crystal cave', short: 'Find the crystal cave', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w4m1_intro' }] },
      { when: { interacted: 'vN' }, do: [{ say: 'w4m1_valve' }] },
      { when: { interacted: 'vE' }, do: [{ say: 'w4m1_valve' }] },
      { when: { objective: 'valves' }, do: [{ activate: 'defend' }, { say: 'w4m1_ignite' }, { music: 'combat' }] },
      { when: { objective: 'valves' }, delay: 6, do: [{ wave: { k: 'stalker', n: 5, x: 3000, y: 900, target: 'station', tx: 3000, ty: 3000, say: false } }] },
      { when: { objective: 'valves' }, delay: 24, do: [{ wave: { k: 'stalker', n: 5, x: 5600, y: 3000, target: 'station', tx: 3000, ty: 3000 } }, { wave: { k: 'frostdrone', n: 3, x: 5600, y: 2800, tx: 3000, ty: 3000, say: false } }] },
      { when: { objective: 'valves' }, delay: 45, do: [{ wave: { k: 'strider', n: 2, x: 600, y: 3000, target: 'station', tx: 3000, ty: 3000 } }, { wave: { k: 'stalker', n: 4, x: 700, y: 3300, tx: 3000, ty: 3000, say: false } }] },
      { when: { objective: 'valves' }, delay: 66, do: [{ wave: { k: 'stalker', n: 6, x: 3000, y: 800, target: 'station', tx: 3000, ty: 3000 } }, { weather: { whiteout: true } }] },
      { when: { objective: 'defend' }, do: [{ say: 'w4m1_done' }, { music: 'none' }] },
    ],
  });

  AS.Levels.add({
    id: 'w4m2', world: 4, index: 2, name: 'COLD SLEEP', region: 'Varkeld Glacier',
    map: { w: 6400, h: 6000, seed: 97 },
    start: { x: 600, y: 3000, angle: 0 }, extraction: { x: 480, y: 3150, r: 70 },
    briefing: {
      tagline: 'Cut trapped researchers out of the ice.',
      danger: 3,
      situation: "The Varkeld research team was caught in a flash-freeze when the crystal organisms flooded their camp with supercooled brine. Their suits are holding them in stasis inside the ice — for now. Shoot the ice prisons open carefully, then fly the researchers out before the cold gets them. Crystal lancer spires guard the glacier, and the ice itself is fracturing under the weight of what is moving beneath it.",
      narration: 'Vesper, the Varkeld team is frozen in the ice. Their suits are keeping them alive, for now. Shoot the ice prisons open, then fly them out. Lancer spires guard the glacier, and the ice is cracking under something big. Watch your footing. Watch the sky.',
      threats: ['Crystal lancer spires — charged beams', 'Shard stalker packs', 'Ice fractures erupting beneath you', 'Whiteouts'],
      intel: ['Four ice prisons are scattered across the glacier.', 'Forward pad Golf on the frozen lake.'],
      marks: [{ x: 2200, y: 1400, label: 'ICE', col: '#7fe8ff' }, { x: 4400, y: 1200, label: 'ICE', col: '#7fe8ff' }, { x: 5300, y: 3600, label: 'ICE', col: '#7fe8ff' }, { x: 3000, y: 4600, label: 'ICE', col: '#7fe8ff' }],
    },
    rewards: { salvage: 800, tech: 2 },
    reinforcements: { comms: [], squads: [['stalker', 'stalker', 'stalker', 'stalker']], from: [{ x: 6200, y: 300 }], delay: 8, cooldown: 45, max: 4 },
    lines: {
      w4m2_intro: { t: 'Four ice prisons. Shoot the ice, not the people inside. Their suits will keep them alive for a while.', s: 'command' },
      w4m2_free: { t: "We're out! It's so cold — please hurry!", s: 'survivor', name: 'VARKELD RESEARCHER' },
      w4m2_ship: { t: "Vesper... there's a Choir ship frozen into that glacier. An entire ship.", s: 'intel' },
    },
    entities: [
      ...L.fob('fob', 3200, 3000),
      { t: 'struct', k: 'iceblock', id: 'ice1', x: 2200, y: 1400 }, { t: 'survivors', id: 'r1', x: 2200, y: 1400, n: 2, kind: 'researcher', caged: 'ice1', label: 'FROZEN RESEARCHERS', voice: false },
      { t: 'struct', k: 'iceblock', id: 'ice2', x: 4400, y: 1200 }, { t: 'survivors', id: 'r2', x: 4400, y: 1200, n: 2, kind: 'researcher', caged: 'ice2', label: 'FROZEN RESEARCHERS', voice: false },
      { t: 'struct', k: 'iceblock', id: 'ice3', x: 5300, y: 3600 }, { t: 'survivors', id: 'r3', x: 5300, y: 3600, n: 2, kind: 'researcher', caged: 'ice3', label: 'FROZEN RESEARCHERS', voice: false },
      { t: 'struct', k: 'iceblock', id: 'ice4', x: 3000, y: 4600 }, { t: 'survivors', id: 'r4', x: 3000, y: 4600, n: 2, kind: 'researcher', caged: 'ice4', label: 'FROZEN RESEARCHERS', voice: false },
      { t: 'struct', k: 'lancertower', id: 'lt1', x: 2400, y: 1300 }, { t: 'struct', k: 'lancertower', id: 'lt2', x: 4250, y: 1350 }, { t: 'struct', k: 'lancertower', id: 'lt3', x: 5100, y: 3500 }, { t: 'struct', k: 'lancertower', id: 'lt4', x: 3200, y: 4500 },
      { t: 'unit', k: 'stalker', x: 2300, y: 1600, n: 3 }, { t: 'unit', k: 'stalker', x: 5200, y: 3800, n: 3 }, { t: 'unit', k: 'strider', x: 4500, y: 1500 },
      { t: 'zone', id: 'ship', x: 5800, y: 600, r: 260 },
      { t: 'struct', k: 'wreckship', x: 5800, y: 600 }, ...L.cache(5700, 680, ['tech', 'tech', 'special'], { hidden: true }),
      ...L.fill(97, { w: 6400, units: [['stalker', 5, [3, 4]], ['frostdrone', 4, [2, 2]], ['strider', 2, [1, 1]], ['lancer', 3, [1, 1]]], obstacles: 30 }),
    ],
    objectives: [
      { id: 'rescue', type: 'rescue', groups: ['r1', 'r2', 'r3', 'r4'], required: 6, text: 'Rescue the frozen researchers', short: 'Rescue at least 6 researchers' },
      { id: 'spires', type: 'destroy', targets: ['lt1', 'lt2', 'lt3', 'lt4'], text: 'Shatter the lancer spires', short: 'Destroy the lancer spires', cat: 'secondary', reward: 200 },
      { id: 'ship', type: 'discover', zone: 'ship', text: 'Find the frozen Choir ship', short: 'Find the frozen Choir ship', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w4m2_intro' }] },
      { when: { destroyedAny: ['ice1', 'ice2', 'ice3', 'ice4'] }, delay: 1, do: [{ say: 'w4m2_free' }] },
      { when: { enter: 'ship' }, do: [{ say: 'w4m2_ship' }] },
      { when: { time: 60 }, do: [{ weather: { whiteout: true } }] },
    ],
  });

  AS.Levels.add({
    id: 'w4m3', world: 4, index: 3, name: 'PRISM', region: 'The Shattered Crown', boss: true,
    map: { w: 6000, h: 6000, seed: 103 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Destroy the Prism Colossus — a living crystal weapon.',
      danger: 4,
      situation: "The crystalline life of Frost Reach has grown a weapon: a colossal organism of living crystal that focuses the planet's magnetic field into beams. It has already cut a supply carrier in half in orbit. Four resonator spires feed its lattice shield. Shatter them, then shatter the Colossus. It sweeps the sky with beams — watch the targeting lines and move.",
      narration: 'Vesper, the crystals have grown a weapon. The Prism Colossus. It already cut a carrier in half in orbit. Four resonator spires feed its shield. Destroy them, then destroy it. When you see a targeting line, move.',
      threats: ['THE PRISM COLOSSUS — sweeping beams, shard volleys', 'Resonator spires — power its lattice shield', 'Shard stalker packs'],
      intel: ['Pad Hotel south of the crown.', 'Resonators are at the four compass points around the Colossus.'],
      marks: [{ x: 3000, y: 2600, label: 'PRISM', col: '#ff5a3a' }, { x: 3000, y: 1500, label: 'R', col: '#ffc35a' }, { x: 4200, y: 2600, label: 'R', col: '#ffc35a' }, { x: 3000, y: 3700, label: 'R', col: '#ffc35a' }, { x: 1800, y: 2600, label: 'R', col: '#ffc35a' }],
    },
    rewards: { salvage: 1000, tech: 3, unlock: ['rail'] },
    reinforcements: { comms: [], squads: [['stalker', 'stalker', 'stalker', 'stalker', 'stalker']], from: [{ x: 300, y: 300 }, { x: 5700, y: 300 }], delay: 6, cooldown: 35, max: 5 },
    lines: {
      w4m3_intro: { t: 'Resonators first. Its shield is drawing from all four.', s: 'command' },
      w4m3_res: { t: 'Resonator shattered. The lattice is weakening.', s: 'intel' },
      w4m3_open: { t: 'Shield is down! Hit it with everything!', s: 'command' },
      w4m3_dead: { t: 'The Colossus is shattered. Frost Reach is ours.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 4700),
      { t: 'struct', k: 'resonator', id: 'rs1', x: 3000, y: 1500 }, { t: 'struct', k: 'resonator', id: 'rs2', x: 4200, y: 2600 }, { t: 'struct', k: 'resonator', id: 'rs3', x: 3000, y: 3700 }, { t: 'struct', k: 'resonator', id: 'rs4', x: 1800, y: 2600 },
      { t: 'boss', k: 'prism', id: 'prism', x: 3000, y: 2600, shieldedBy: ['rs1', 'rs2', 'rs3', 'rs4'], wake: 800, deathLine: 'w4m3_dead' },
      { t: 'unit', k: 'lancer', x: 3200, y: 1500 }, { t: 'unit', k: 'lancer', x: 4200, y: 2800 }, { t: 'unit', k: 'lancer', x: 2800, y: 3700 }, { t: 'unit', k: 'lancer', x: 1800, y: 2400 },
      ...L.fill(103, { units: [['stalker', 5, [3, 4]], ['frostdrone', 4, [2, 2]], ['strider', 3, [1, 1]]], obstacles: 30 }),
    ],
    objectives: [
      { id: 'res', type: 'destroy', targets: ['rs1', 'rs2', 'rs3', 'rs4'], text: 'Shatter the resonator spires', short: 'Destroy the four resonators' },
      { id: 'prism', type: 'boss', targets: ['prism'], text: 'Destroy the Prism Colossus', short: 'Destroy the Prism Colossus', marker: 'PRISM' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w4m3_intro' }] },
      { when: { destroyedAny: ['rs1', 'rs2', 'rs3', 'rs4'] }, do: [{ say: 'w4m3_res' }] },
      { when: { objective: 'res' }, do: [{ say: 'w4m3_open' }, { boss: 'prism', act: 'activate' }] },
      { when: { time: 80 }, do: [{ weather: { whiteout: true } }] },
    ],
  });
})(window.AS);
