/* ALIEN STRIKE — World 7: THE SPORE MOON (low gravity; spores scramble flight controls). */
'use strict';
(function (AS) {
  const L = AS.L;

  AS.Levels.add({
    id: 'w7m1', world: 7, index: 1, name: 'MYCELIUM', region: 'Lantern Fields',
    map: { w: 6000, h: 6000, seed: 151 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Collect fungal samples and purge the infected machines.',
      danger: 4,
      situation: "Something on the Spore Moon is eating Choir machines alive — and turning them. Xenology needs samples from three bloom groves to build a counter-agent, plus close scans of two specimen colonies. The fungus has also overgrown a Choir walker squadron; purge it before the infection spreads further. Gravity is low here — the Vesper will drift. Violet spore drifts scramble your flight computer on contact.",
      narration: 'Vesper, something on this moon is eating Choir machines and turning them. We need samples from three bloom groves and scans of two specimen colonies. And purge the infected walkers before it spreads. Gravity is low. You will drift. Stay out of the violet spore drifts. They scramble your flight computer.',
      threats: ['Sporelings — fungal walkers that lob spores', 'Infected walkers', 'Puffball mines — drift toward you and burst', 'Spore mortars', 'Control-scrambling spore drifts'],
      intel: ['Low gravity: the craft keeps its momentum longer. Brake early.', 'Pad November in the central crater.'],
      marks: [{ x: 1400, y: 1600, label: 'GROVE', col: '#7fe8ff' }, { x: 4600, y: 1200, label: 'GROVE', col: '#7fe8ff' }, { x: 4900, y: 4000, label: 'GROVE', col: '#7fe8ff' }, { x: 3000, y: 3000, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 950, tech: 2 },
    reinforcements: { comms: [], squads: [['sporeling', 'sporeling', 'sporeling', 'puffball', 'puffball'], ['infected']], from: [{ x: 300, y: 300 }, { x: 5700, y: 300 }], delay: 8, cooldown: 40, max: 5 },
    lines: {
      w7m1_intro: { t: 'Three groves, two specimens, one infected squadron. Mind your momentum.', s: 'command' },
      w7m1_sample: { t: 'Sample secured. It is... warm. And moving slightly.', s: 'intel' },
      w7m1_infected: { t: "Those walkers were Choir once. Now they're something else.", s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 3000),
      { t: 'cargo', k: 'sample', id: 's1', x: 1400, y: 1600, label: 'BLOOM SAMPLE' }, { t: 'cargo', k: 'sample', id: 's2', x: 4600, y: 1200, label: 'BLOOM SAMPLE' }, { t: 'cargo', k: 'sample', id: 's3', x: 4900, y: 4000, label: 'BLOOM SAMPLE' },
      { t: 'struct', k: 'specimen', id: 'sp1', x: 2000, y: 3400, scan: true, label: 'Lantern Colony', time: 2.5 }, { t: 'struct', k: 'specimen', id: 'sp2', x: 4000, y: 2400, scan: true, label: 'Choir Husk', time: 2.5 },
      { t: 'unit', k: 'infected', id: 'inf1', x: 3600, y: 1600, patrol: [[3600, 1600], [2600, 1200], [2400, 2200]] }, { t: 'unit', k: 'infected', id: 'inf2', x: 3700, y: 1700, patrol: [[3600, 1600], [2600, 1200], [2400, 2200]] }, { t: 'unit', k: 'infected', id: 'inf3', x: 3500, y: 1500, patrol: [[3600, 1600], [2600, 1200], [2400, 2200]] },
      { t: 'zone', id: 'infzone', x: 3200, y: 1600, r: 600 },
      { t: 'unit', k: 'sporemortar', x: 1600, y: 1300 }, { t: 'unit', k: 'sporemortar', x: 4800, y: 1000 }, { t: 'unit', k: 'sporemortar', x: 4700, y: 4200 },
      { t: 'zone', id: 'crater', x: 600, y: 600, r: 200 }, ...L.cache(600, 600, ['tech', 'tech', 'special'], { hidden: true }),
      ...L.fill(151, { units: [['sporeling', 6, [2, 4]], ['puffball', 5, [2, 3]], ['infected', 2, [1, 1]], ['sporemortar', 2, [1, 1]]], obstacles: 34 }),
    ],
    objectives: [
      { id: 'samples', type: 'collect', items: ['s1', 's2', 's3'], required: 3, text: 'Deliver bloom samples', short: 'Deliver three bloom samples' },
      { id: 'scans', type: 'scan', targets: ['sp1', 'sp2'], text: 'Scan the specimen colonies', short: 'Scan two specimen colonies' },
      { id: 'infected', type: 'kill', targets: ['inf1', 'inf2', 'inf3'], text: 'Purge the infected walkers', short: 'Destroy the infected walkers', cat: 'secondary', reward: 250 },
      { id: 'crater', type: 'discover', zone: 'crater', text: 'Find the glass crater', short: 'Find the glass crater', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w7m1_intro' }] },
      { when: { cargoPicked: 's1' }, do: [{ say: 'w7m1_sample' }] },
      { when: { enter: 'infzone' }, do: [{ say: 'w7m1_infected' }] },
    ],
  });

  AS.Levels.add({
    id: 'w7m2', world: 7, index: 2, name: 'QUIET COLONY', region: 'Mycel Ridge',
    map: { w: 6000, h: 6000, seed: 157 },
    start: { x: 3000, y: 5400, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5600, r: 70 },
    briefing: {
      tagline: 'Hold the colony shelter until the evacuation shuttle is fuelled.',
      danger: 4,
      situation: "Mycel Ridge colony has gone quiet — not dead. Sixty colonists are sealed in the shelter while the fungus pounds on the doors. Their evacuation shuttle needs three minutes to fuel. Hold the shelter until it launches. The last six colonists were caught outside in the greenhouse; once the shuttle is away, fly them out yourself.",
      narration: 'Vesper, sixty colonists are sealed in the Mycel Ridge shelter. Their shuttle needs three minutes to fuel. Hold the shelter until it launches. Then pick up the six who were caught outside in the greenhouse. They are waiting for you.',
      threats: ['Waves of sporelings and puffballs', 'Infected walkers', 'Spore mortars shelling the shelter'],
      intel: ['The shelter can take some punishment, but not much.', 'The colony pad repairs and refuels.'],
      marks: [{ x: 3000, y: 2800, label: 'SHELTER', col: '#7dff9a' }, { x: 4300, y: 2300, label: 'GREENHOUSE', col: '#7fe8ff' }],
    },
    rewards: { salvage: 1000, tech: 2 },
    reinforcements: { comms: [], squads: [['sporeling', 'sporeling', 'sporeling']], from: [{ x: 300, y: 300 }], delay: 8, cooldown: 40, max: 3 },
    lines: {
      w7m2_intro: { t: 'Shelter is holding. Shuttle fuelling now. Three minutes. Do not let them in.', s: 'command' },
      w7m2_wave: { t: 'Movement in the fog. Lots of it.', s: 'ship' },
      w7m2_launch: { t: 'Shuttle is away! Sixty souls saved. Now get the greenhouse crew.', s: 'command' },
      w7m2_green: { t: "We're in the greenhouse! The glass is cracking!", s: 'survivor', name: 'GREENHOUSE CREW' },
    },
    entities: [
      { t: 'struct', k: 'dome', id: 'shelter', x: 3000, y: 2800, team: 'player', hp: 1400 },
      { t: 'struct', k: 'pad', id: 'cpad', x: 2700, y: 3050, pad: { repair: true, refuel: true, rearm: true, dropoff: true } },
      { t: 'struct', k: 'station', id: 'greenhouse', x: 4300, y: 2300, invuln: true },
      { t: 'survivors', id: 'green', x: 4360, y: 2380, n: 6, kind: 'colonist', label: 'GREENHOUSE CREW', voice: false },
      { t: 'unit', k: 'sporemortar', x: 1800, y: 1600 }, { t: 'unit', k: 'sporemortar', x: 4400, y: 1500 },
      { t: 'zone', id: 'hollow', x: 5500, y: 5300, r: 200 }, ...L.cache(5500, 5300, ['tech', 'special', 'repair'], { hidden: true }),
      ...L.fill(157, { units: [['sporeling', 4, [2, 3]], ['puffball', 4, [2, 3]]], obstacles: 30 }),
    ],
    objectives: [
      { id: 'hold', type: 'defend', target: 'shelter', duration: 180, text: 'Defend the shelter until the shuttle launches', short: 'Defend the shelter (3:00)' },
      { id: 'green', type: 'rescue', groups: ['green'], required: 4, text: 'Rescue the greenhouse crew', short: 'Rescue the greenhouse crew', locked: true },
      { id: 'hollow', type: 'discover', zone: 'hollow', text: 'Find the hollow tree', short: 'Find the hollow tree', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w7m2_intro' }, { music: 'combat' }] },
      { when: { time: 15 }, do: [{ say: 'w7m2_wave' }, { wave: { k: 'sporeling', n: 6, x: 3000, y: 800, target: 'shelter', tx: 3000, ty: 2800, say: false } }] },
      { when: { time: 45 }, do: [{ wave: { k: 'puffball', n: 5, x: 800, y: 2800, target: 'shelter', tx: 3000, ty: 2800 } }, { wave: { k: 'sporeling', n: 4, x: 900, y: 3000, target: 'shelter', tx: 3000, ty: 2800, say: false } }] },
      { when: { time: 80 }, do: [{ wave: { k: 'infected', n: 2, x: 5200, y: 2800, target: 'shelter', tx: 3000, ty: 2800 } }, { wave: { k: 'sporeling', n: 5, x: 5200, y: 3000, target: 'shelter', tx: 3000, ty: 2800, say: false } }] },
      { when: { time: 120 }, do: [{ wave: { k: 'sporeling', n: 8, x: 3000, y: 700, target: 'shelter', tx: 3000, ty: 2800 } }, { wave: { k: 'puffball', n: 4, x: 3400, y: 700, tx: 3000, ty: 2800, say: false } }] },
      { when: { time: 155 }, do: [{ wave: { k: 'infected', n: 2, x: 800, y: 2600, target: 'shelter', tx: 3000, ty: 2800 } }, { wave: { k: 'sporeling', n: 6, x: 5200, y: 2600, tx: 3000, ty: 2800, say: false } }] },
      { when: { objective: 'hold' }, do: [{ say: 'w7m2_launch' }, { activate: 'green' }, { music: 'none' }] },
      { when: { objective: 'hold' }, delay: 6, do: [{ say: 'w7m2_green' }] },
    ],
  });

  AS.Levels.add({
    id: 'w7m3', world: 7, index: 3, name: 'THE BLOOM', region: 'The Mind Garden', boss: true,
    map: { w: 6000, h: 6000, seed: 163 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Destroy the Mycelial Mind at the heart of the Spore Moon.',
      danger: 5,
      situation: "The fungus on this moon is one organism, and it thinks. The Mycelial Mind is a mountain-sized fruiting body at the centre of the Mind Garden, fed by four spore roots that shield it from harm. It lobs spore clouds, raises sporelings from the ground and releases scrambling pulses that wreck flight computers. Burn the roots, then burn the Mind. The counter-agent you helped develop is loaded into your special ordnance bay.",
      narration: 'Vesper, the fungus on this moon is a single mind. It sits at the centre of the Mind Garden, shielded by four spore roots. Burn the roots, then burn the Mind. Stay away from its pulses. They will scramble your flight computer.',
      threats: ['THE MYCELIAL MIND — spore barrages, scrambling pulses', 'Spore roots — shield the Mind', 'Sporelings, puffballs, infected walkers'],
      intel: ['Roots: north, east, south, west of the Mind.', 'Pad Oscar south of the garden.'],
      marks: [{ x: 3000, y: 2600, label: 'MIND', col: '#ff5a3a' }],
    },
    rewards: { salvage: 1250, tech: 3, unlock: ['orbital'] },
    reinforcements: { comms: [], squads: [['sporeling', 'sporeling', 'puffball', 'puffball']], from: [{ x: 300, y: 300 }, { x: 5700, y: 300 }], delay: 6, cooldown: 35, max: 6 },
    lines: {
      w7m3_intro: { t: 'Roots first. It cannot be hurt while they feed it.', s: 'command' },
      w7m3_root: { t: 'Root severed. The Mind is weakening.', s: 'intel' },
      w7m3_open: { t: 'All roots down! Burn it!', s: 'command' },
      w7m3_dead: { t: 'The Mind is dead. The whole moon just exhaled.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 4600),
      { t: 'struct', k: 'sporeroot', id: 'rt1', x: 3000, y: 1700 }, { t: 'struct', k: 'sporeroot', id: 'rt2', x: 3900, y: 2600 }, { t: 'struct', k: 'sporeroot', id: 'rt3', x: 3000, y: 3500 }, { t: 'struct', k: 'sporeroot', id: 'rt4', x: 2100, y: 2600 },
      { t: 'boss', k: 'mind', id: 'mind', x: 3000, y: 2600, shieldedBy: ['rt1', 'rt2', 'rt3', 'rt4'], wake: 800, deathLine: 'w7m3_dead' },
      ...L.fill(163, { units: [['sporeling', 5, [2, 4]], ['puffball', 5, [2, 3]], ['infected', 2, [1, 1]], ['sporemortar', 2, [1, 1]]], obstacles: 36 }),
    ],
    objectives: [
      { id: 'roots', type: 'destroy', targets: ['rt1', 'rt2', 'rt3', 'rt4'], text: 'Burn the spore roots', short: 'Destroy the four spore roots' },
      { id: 'mind', type: 'boss', targets: ['mind'], text: 'Destroy the Mycelial Mind', short: 'Destroy the Mycelial Mind', marker: 'MIND' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w7m3_intro' }] },
      { when: { destroyedAny: ['rt1', 'rt2', 'rt3', 'rt4'] }, do: [{ say: 'w7m3_root' }] },
      { when: { objective: 'roots' }, do: [{ say: 'w7m3_open' }, { boss: 'mind', act: 'activate' }] },
    ],
  });
})(window.AS);
