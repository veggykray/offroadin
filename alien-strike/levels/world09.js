/* ALIEN STRIKE — World 9: THE DEAD MACHINE (reroute power networks to disable sectors). */
'use strict';
(function (AS) {
  const L = AS.L;

  AS.Levels.add({
    id: 'w9m1', world: 9, index: 1, name: 'CIRCUIT BREAKER', region: 'Gearwell Sector 7',
    map: { w: 6000, h: 6000, seed: 191 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Reroute the machine-world power grid and recover the scout black box.',
      danger: 4,
      situation: "This world is a machine, and Sector 7 is wired like a fortress: three defence grids, each powered through a junction. Hit a junction console and you reroute its power into the ground — every turret in that grid goes dark. Our scout ship Wren went down in grid three; its black box holds the only map of the Warden's lair. Recover it. Ancient sentinels still patrol the conduits.",
      narration: 'Vesper, Sector 7 runs on three defence grids. Each grid has a junction console. Reroute it and the whole grid goes dark. Our scout Wren went down inside grid three. Her black box has the only map of the Warden. Get it.',
      threats: ['Ancient sentinels — shielded beam machines', 'Gear crawlers and machine mites', 'Three powered turret grids', 'Arc pylons'],
      intel: ['Junction consoles sit at the edge of each grid.', 'A grid without power cannot shoot back.'],
      marks: [{ x: 1500, y: 3000, label: 'J1', col: '#7fe8ff' }, { x: 3000, y: 1700, label: 'J2', col: '#7fe8ff' }, { x: 4600, y: 2900, label: 'J3', col: '#7fe8ff' }, { x: 4600, y: 1500, label: 'WREN', col: '#ffc35a' }],
    },
    rewards: { salvage: 1150, tech: 3 },
    reinforcements: { comms: [], squads: [['mite', 'mite', 'mite', 'mite'], ['gearcrawler', 'sentinel']], from: [{ x: 300, y: 300 }, { x: 5700, y: 300 }], delay: 8, cooldown: 40, max: 4 },
    lines: {
      w9m1_intro: { t: 'Three grids. Junctions first, then you can walk right through them.', s: 'command' },
      power_rerouted: { t: 'Power rerouted. Grid offline.', s: 'ship' },
      w9m1_wren: { t: "Wren's black box is intact. That's our map to the Warden.", s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 4300),
      ...L.outpost('g1', 1400, 2400, { turrets: 4, radius: 220, turret: 'turret_heavy', props: false }),
      { t: 'struct', k: 'switch', id: 'j1', x: 1600, y: 3000, label: 'Grid 1 Junction', verb: 'REROUTE', time: 2.5 },
      ...L.outpost('g2', 3000, 1100, { turrets: 4, radius: 220, turret: 'pylon', props: false }),
      { t: 'struct', k: 'switch', id: 'j2', x: 3000, y: 1700, label: 'Grid 2 Junction', verb: 'REROUTE', time: 2.5 },
      ...L.outpost('g3', 4600, 1500, { turrets: 5, radius: 240, turret: 'turret_heavy', props: false, sam: 1 }),
      { t: 'struct', k: 'switch', id: 'j3', x: 4600, y: 2200, label: 'Grid 3 Junction', verb: 'REROUTE', time: 2.5 },
      { t: 'struct', k: 'wreckship', x: 4600, y: 1500 }, { t: 'cargo', k: 'blackbox', id: 'wren', x: 4680, y: 1560, label: 'WREN BLACK BOX' },
      { t: 'unit', k: 'sentinel', x: 2200, y: 2200, n: 2 }, { t: 'unit', k: 'gearcrawler', x: 3800, y: 2400, patrol: [[3800, 2400], [3000, 3000], [2200, 2600]] },
      { t: 'zone', id: 'core', x: 600, y: 600, r: 200 }, ...L.cache(600, 600, ['tech', 'tech', 'special', 'repair'], { hidden: true }),
      ...L.fill(191, { units: [['mite', 5, [3, 4]], ['sentinel', 3, [1, 1]], ['gearcrawler', 3, [1, 1]]], obstacles: 30 }),
    ],
    objectives: [
      { id: 'grids', type: 'interact', targets: ['j1', 'j2', 'j3'], text: 'Reroute the three grid junctions', short: 'Reroute the three junctions' },
      { id: 'wren', type: 'collect', items: ['wren'], text: 'Recover the Wren black box', short: 'Recover the Wren black box' },
      { id: 'core', type: 'discover', zone: 'core', text: 'Find the dormant core', short: 'Find the dormant core', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w9m1_intro' }] },
      { when: { interacted: 'j1' }, do: [{ destroy: 'g1_pw' }, { say: 'power_rerouted' }] },
      { when: { interacted: 'j2' }, do: [{ destroy: 'g2_pw' }, { say: 'power_rerouted' }] },
      { when: { interacted: 'j3' }, do: [{ destroy: 'g3_pw' }, { say: 'power_rerouted' }] },
      { when: { cargoPicked: 'wren' }, do: [{ say: 'w9m1_wren' }] },
    ],
  });

  AS.Levels.add({
    id: 'w9m2', world: 9, index: 2, name: 'THE GEARWORKS', region: 'Deep Gearwell',
    map: { w: 6400, h: 6000, seed: 197 },
    start: { x: 600, y: 5400, angle: -Math.PI / 4 }, extraction: { x: 480, y: 5550, r: 70 },
    briefing: {
      tagline: 'Locate the hidden reactor facility and sabotage it.',
      danger: 4,
      situation: "Somewhere in the Gearworks is the reactor that feeds the Warden. It is hidden — the machine moves its own plates to bury it. Our best lead is the intel cached in three Choir data spikes scattered across the sector: recover them and the tactical map will fill in the facility's position. Once you find it, its reactor sits behind a shield generator fed by two power junctions. Reroute them, or smash them, then destroy the reactor.",
      narration: 'Vesper, the Warden is fed by a hidden reactor somewhere in the Gearworks. Find the three data spikes. Their intel will reveal the facility. Then drop the reactor shield and destroy the reactor.',
      threats: ['Ancient sentinels', 'Gear crawlers and mites', 'Shielded reactor facility'],
      intel: ['Data spikes appear as intel pickups on your scanner when you are close.'],
      marks: [],
    },
    rewards: { salvage: 1200, tech: 3 },
    reinforcements: { comms: [], squads: [['mite', 'mite', 'mite', 'mite', 'mite'], ['sentinel', 'sentinel']], from: [{ x: 6100, y: 300 }], delay: 8, cooldown: 40, max: 4 },
    lines: {
      w9m2_intro: { t: 'Find the three data spikes. The facility will show up once we have the pieces.', s: 'command' },
      w9m2_found: { t: "There it is! The machine was hiding it under a moving plate. Marked on your map.", s: 'command' },
      w9m2_shield: { t: 'Reactor shield is down. Hit it.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 2400, 3800),
      { t: 'pickup', k: 'intel', id: 'd1', x: 1600, y: 1500 }, { t: 'pickup', k: 'intel', id: 'd2', x: 5200, y: 1200 }, { t: 'pickup', k: 'intel', id: 'd3', x: 3900, y: 4700 },
      { t: 'unit', k: 'sentinel', x: 1700, y: 1600 }, { t: 'unit', k: 'sentinel', x: 5100, y: 1300 }, { t: 'unit', k: 'sentinel', x: 3800, y: 4600 },
      { t: 'zone', id: 'facility', x: 4600, y: 3000, r: 380 },
      { t: 'struct', k: 'reactor', id: 'reactor', x: 4600, y: 3000, shieldedBy: ['rsg'] },
      { t: 'struct', k: 'shieldgen', id: 'rsg', x: 4350, y: 3150, poweredBy: ['pj1', 'pj2'] },
      { t: 'struct', k: 'power', id: 'pj1', x: 4200, y: 2700 }, { t: 'struct', k: 'power', id: 'pj2', x: 5000, y: 3300 },
      { t: 'struct', k: 'switch', id: 'sw1', x: 4100, y: 2850, label: 'Junction A', verb: 'REROUTE', time: 2.5 }, { t: 'struct', k: 'switch', id: 'sw2', x: 5100, y: 3150, label: 'Junction B', verb: 'REROUTE', time: 2.5 },
      { t: 'struct', k: 'turret_heavy', x: 4400, y: 2800 }, { t: 'struct', k: 'turret_heavy', x: 4800, y: 2800 }, { t: 'struct', k: 'turret_heavy', x: 4800, y: 3200 }, { t: 'struct', k: 'pylon', x: 4600, y: 3300 },
      { t: 'unit', k: 'gearcrawler', x: 4600, y: 3400, n: 2 },
      { t: 'zone', id: 'shrine', x: 6000, y: 5600, r: 200 }, ...L.cache(6000, 5600, ['tech', 'tech', 'special'], { hidden: true }),
      ...L.fill(197, { w: 6400, units: [['mite', 6, [3, 4]], ['sentinel', 2, [1, 1]], ['gearcrawler', 3, [1, 1]]], obstacles: 30 }),
    ],
    objectives: [
      { id: 'intel', type: 'flag', flag: 'intel3', text: 'Recover the three data spikes', short: 'Recover three data spikes', points: [{ x: 1600, y: 1500 }, { x: 5200, y: 1200 }, { x: 3900, y: 4700 }] },
      { id: 'find', type: 'reach', zone: 'facility', text: 'Locate the hidden facility', short: 'Locate the hidden facility', locked: true },
      { id: 'reactor', type: 'destroy', targets: ['reactor'], text: 'Destroy the Warden reactor', short: 'Destroy the reactor', locked: true },
      { id: 'shrine', type: 'discover', zone: 'shrine', text: 'Find the gear shrine', short: 'Find the gear shrine', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w9m2_intro' }] },
      { when: { all: [{ pickup: 'd1' }, { pickup: 'd2' }, { pickup: 'd3' }] }, do: [{ flag: 'intel3' }, { say: 'w9m2_found' }, { markMap: { x: 4600, y: 3000, label: 'FACILITY', col: '#ffc35a' } }, { revealArea: { x: 4600, y: 3000, r: 500 } }, { activate: 'find' }] },
      { when: { objective: 'find' }, do: [{ activate: 'reactor' }] },
      { when: { interacted: 'sw1' }, do: [{ destroy: 'pj1' }, { say: 'power_rerouted' }] },
      { when: { interacted: 'sw2' }, do: [{ destroy: 'pj2' }, { say: 'power_rerouted' }] },
      { when: { destroyedAll: ['pj1', 'pj2'] }, do: [{ say: 'w9m2_shield' }] },
      { when: { destroyed: 'rsg' }, do: [{ say: 'w9m2_shield' }] },
    ],
  });

  AS.Levels.add({
    id: 'w9m3', world: 9, index: 3, name: 'WARDEN PROTOCOL', region: 'The Warden\'s Cradle', boss: true,
    map: { w: 6400, h: 6400, seed: 203 },
    start: { x: 3200, y: 5900, angle: -Math.PI / 2 }, extraction: { x: 3200, y: 6060, r: 75 },
    briefing: {
      tagline: 'Bring down the Warden, ancient guardian of the machine world.',
      danger: 5,
      situation: "The Warden is the oldest Choir machine still moving: a walking fortress that has guarded the road to the First World for a hundred thousand years. Its grid shield draws from four power couplings planted around the Cradle. Each coupling can be destroyed outright, or cut from its grid junction. With the couplings dead, the Warden is just a very large, very angry machine. Expect sweeping lances, artillery and sentinel launches.",
      narration: 'Vesper, the Warden. A hundred thousand years old and still guarding the road to the First World. Four power couplings feed its shield. Cut them, by junction or by force. Then bring it down. Watch for its lances.',
      threats: ['THE WARDEN — lance beams, artillery, sentinel launches', 'Power couplings — feed its grid shield', 'Sentinels, gear crawlers, mites'],
      intel: ['Junction switches beside each coupling cut it instantly.', 'Pad Papa south of the Cradle.'],
      marks: [{ x: 3200, y: 2800, label: 'WARDEN', col: '#ff5a3a' }],
    },
    rewards: { salvage: 1450, tech: 4 },
    reinforcements: { comms: [], squads: [['mite', 'mite', 'mite', 'mite'], ['sentinel', 'gearcrawler']], from: [{ x: 300, y: 300 }, { x: 6100, y: 300 }], delay: 8, cooldown: 35, max: 5 },
    lines: {
      w9m3_intro: { t: 'Four couplings. The switches are faster than your guns.', s: 'command' },
      w9m3_open: { t: 'Grid shield collapsed! Take it apart!', s: 'command' },
      w9m3_dead: { t: 'The Warden has fallen. The road to the First World is open.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3200, 4800),
      { t: 'struct', k: 'coupling', id: 'c1', x: 2000, y: 1800 }, { t: 'struct', k: 'switch', id: 'cs1', x: 2100, y: 2000, label: 'Coupling Junction', verb: 'CUT', time: 2.5 },
      { t: 'struct', k: 'coupling', id: 'c2', x: 4400, y: 1800 }, { t: 'struct', k: 'switch', id: 'cs2', x: 4300, y: 2000, label: 'Coupling Junction', verb: 'CUT', time: 2.5 },
      { t: 'struct', k: 'coupling', id: 'c3', x: 4400, y: 3800 }, { t: 'struct', k: 'switch', id: 'cs3', x: 4300, y: 3600, label: 'Coupling Junction', verb: 'CUT', time: 2.5 },
      { t: 'struct', k: 'coupling', id: 'c4', x: 2000, y: 3800 }, { t: 'struct', k: 'switch', id: 'cs4', x: 2100, y: 3600, label: 'Coupling Junction', verb: 'CUT', time: 2.5 },
      { t: 'boss', k: 'warden', id: 'warden', x: 3200, y: 2800, shieldedBy: ['c1', 'c2', 'c3', 'c4'], wake: 900, deathLine: 'w9m3_dead' },
      { t: 'struct', k: 'pylon', x: 2200, y: 1700 }, { t: 'struct', k: 'pylon', x: 4200, y: 1700 }, { t: 'struct', k: 'pylon', x: 4200, y: 3900 }, { t: 'struct', k: 'pylon', x: 2200, y: 3900 },
      ...L.fill(203, { w: 6400, h: 6400, units: [['mite', 5, [3, 4]], ['sentinel', 2, [1, 1]], ['gearcrawler', 3, [1, 1]]], obstacles: 30 }),
    ],
    objectives: [
      { id: 'couplings', type: 'destroy', targets: ['c1', 'c2', 'c3', 'c4'], text: 'Cut the four power couplings', short: 'Cut the four power couplings' },
      { id: 'warden', type: 'boss', targets: ['warden'], text: 'Destroy the Warden', short: 'Destroy the Warden', marker: 'WARDEN' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w9m3_intro' }] },
      { when: { interacted: 'cs1' }, do: [{ destroy: 'c1' }, { say: 'power_rerouted' }] },
      { when: { interacted: 'cs2' }, do: [{ destroy: 'c2' }, { say: 'power_rerouted' }] },
      { when: { interacted: 'cs3' }, do: [{ destroy: 'c3' }, { say: 'power_rerouted' }] },
      { when: { interacted: 'cs4' }, do: [{ destroy: 'c4' }, { say: 'power_rerouted' }] },
      { when: { objective: 'couplings' }, do: [{ say: 'w9m3_open' }, { boss: 'warden', act: 'activate' }] },
    ],
  });
})(window.AS);
