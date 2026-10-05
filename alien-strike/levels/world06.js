/* ALIEN STRIKE — World 6: OBSIDIAN FORGE (sabotage; eruptions, heat zones). */
'use strict';
(function (AS) {
  const L = AS.L;

  AS.Levels.add({
    id: 'w6m1', world: 6, index: 1, name: 'SLAG RUN', region: 'Anvil Rift',
    map: { w: 6000, h: 6000, seed: 131 },
    start: { x: 600, y: 5400, angle: -Math.PI / 4 }, extraction: { x: 480, y: 5550, r: 70 },
    briefing: {
      tagline: 'Sabotage the three reactors powering the Anvil foundries.',
      danger: 4,
      situation: "Three reactor cores drive the foundries of the Anvil Rift. Their armour is thick enough to shrug off most of your ordnance — but every reactor has a maintenance port. Plant a demolition charge at each port and the reactor will tear itself apart in seconds. Or do it the hard way. The rift is volcanic: lava eruptions are telegraphed by red rings on the ground. Heat shimmer means heat zones that burn shields and fuel.",
      narration: 'Vesper, three reactors drive the Anvil foundries. They are heavily armoured, but each one has a maintenance port. Hover at the port, plant a charge, and get clear. The reactor will do the rest. Red rings on the ground mean an eruption is coming. Move.',
      threats: ['Slag golems — armoured hybrids', 'Magma mortars', 'Anvil tanks and forge drones', 'Lava eruptions and heat zones'],
      intel: ['The forge drone factory in the north keeps the sky full of drones.', 'Pad Kilo in the western caldera.'],
      marks: [{ x: 2400, y: 1800, label: 'R1', col: '#ff9a5a' }, { x: 4600, y: 1600, label: 'R2', col: '#ff9a5a' }, { x: 3800, y: 4000, label: 'R3', col: '#ff9a5a' }, { x: 1200, y: 3000, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 900, tech: 2 },
    reinforcements: { comms: ['comms'], squads: [['forgetank', 'forgedrone', 'forgedrone'], ['golem', 'golem']], from: [{ x: 5700, y: 300 }, { x: 3000, y: 200 }], delay: 8, cooldown: 40, max: 5 },
    hazards: { heatZones: 7 },
    lines: {
      w6m1_intro: { t: 'Three reactors. Charges at the ports will save you a lot of ammunition.', s: 'command' },
      w6m1_charge: { t: 'Charge set! Reactor overload in five seconds! Clear out!', s: 'ship' },
      w6m1_boom: { t: 'Reactor down! The foundry is losing power!', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 1200, 3000),
      { t: 'struct', k: 'reactor', id: 'rx1', x: 2400, y: 1800 }, { t: 'struct', k: 'charge_site', id: 'port1', x: 2500, y: 1960, label: 'Reactor 1 Port', verb: 'PLANT CHARGE AT', time: 2 },
      { t: 'struct', k: 'reactor', id: 'rx2', x: 4600, y: 1600 }, { t: 'struct', k: 'charge_site', id: 'port2', x: 4700, y: 1760, label: 'Reactor 2 Port', verb: 'PLANT CHARGE AT', time: 2 },
      { t: 'struct', k: 'reactor', id: 'rx3', x: 3800, y: 4000 }, { t: 'struct', k: 'charge_site', id: 'port3', x: 3900, y: 4160, label: 'Reactor 3 Port', verb: 'PLANT CHARGE AT', time: 2 },
      ...L.outpost('r1', 2400, 1800, { turrets: 3, radius: 200, turret: 'turret_heavy', power: false, props: false, garrison: [['golem', 1, 0, 200]] }),
      ...L.outpost('r2', 4600, 1600, { turrets: 3, radius: 200, turret: 'turret_heavy', power: false, props: false, garrison: [['forgetank', 1, 0, 200]] }),
      ...L.outpost('r3', 3800, 4000, { turrets: 3, radius: 200, turret: 'turret_heavy', power: false, props: false, garrison: [['golem', 1, 0, -200]] }),
      { t: 'struct', k: 'factory', id: 'dronefac', x: 3200, y: 700, types: ['forgedrone'], max: 4, interval: 10 },
      { t: 'struct', k: 'comms', id: 'comms', x: 3600, y: 600 },
      { t: 'struct', k: 'crusher', x: 2900, y: 2600 }, { t: 'struct', k: 'crusher', x: 4200, y: 2900 },
      { t: 'unit', k: 'magma', x: 3000, y: 3000 }, { t: 'unit', k: 'magma', x: 5200, y: 3200 },
      { t: 'zone', id: 'vault', x: 5600, y: 5400, r: 200 }, ...L.cache(5600, 5400, ['tech', 'tech', 'repair'], { hidden: true }),
      ...L.fill(131, { units: [['golem', 3, [1, 2]], ['forgedrone', 4, [2, 3]], ['forgetank', 3, [1, 2]], ['magma', 2, [1, 1]]], obstacles: 30, supplies: ['ammo', 'missiles', 'salvage', 'repair', 'shield', 'special', 'fuel'] }),
    ],
    objectives: [
      { id: 'reactors', type: 'destroy', targets: ['rx1', 'rx2', 'rx3'], text: 'Destroy the three reactors', short: 'Destroy the three reactors', desc: 'Plant charges at the maintenance ports (hold E).' },
      { id: 'factory', type: 'destroy', targets: ['dronefac'], text: 'Destroy the forge drone factory', short: 'Destroy the drone factory', cat: 'secondary', reward: 200 },
      { id: 'comms', type: 'destroy', targets: ['comms'], text: 'Destroy the comm relay', short: 'Destroy the comm relay', cat: 'secondary', reward: 120 },
      { id: 'vault', type: 'discover', zone: 'vault', text: 'Find the slag vault', short: 'Find the slag vault', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w6m1_intro' }] },
      { when: { interacted: 'port1' }, do: [{ say: 'w6m1_charge' }] }, { when: { interacted: 'port1' }, delay: 5, do: [{ destroy: 'rx1' }, { say: 'w6m1_boom' }] },
      { when: { interacted: 'port2' }, do: [{ say: 'w6m1_charge' }] }, { when: { interacted: 'port2' }, delay: 5, do: [{ destroy: 'rx2' }, { say: 'w6m1_boom' }] },
      { when: { interacted: 'port3' }, do: [{ say: 'w6m1_charge' }] }, { when: { interacted: 'port3' }, delay: 5, do: [{ destroy: 'rx3' }, { say: 'w6m1_boom' }] },
    ],
  });

  AS.Levels.add({
    id: 'w6m2', world: 6, index: 2, name: 'COLD IRON', region: 'The Crucibles',
    map: { w: 6400, h: 6000, seed: 139 },
    start: { x: 3200, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3200, y: 5650, r: 70 },
    briefing: {
      tagline: 'Steal three Choir power cores from the Crucible foundries.',
      danger: 4,
      situation: "Engineering wants Choir power cores — intact. Three are sitting in the Crucible foundries, each foundry ringed by heat vents that will cook your shields and burn fuel twice as fast. Fly in, clamp a core, fly out. Your cargo clamps will take two; plan the third run. A magma mortar battery covers the approach roads.",
      narration: 'Vesper, engineering wants three Choir power cores, intact. They are inside the Crucible foundries, surrounded by heat vents. The heat burns shields and doubles your fuel burn. In, clamp, out. A mortar battery covers the roads. Kill it if it slows you down.',
      threats: ['Heat zones around every foundry', 'Magma mortar battery', 'Slag golems, forge drones, Anvil tanks', 'Lava eruptions'],
      intel: ['Deliver cores at the LZ or pad Lima.', 'Each core you steal makes the foundry garrison scramble.'],
      marks: [{ x: 1500, y: 1500, label: 'F1', col: '#ffc35a' }, { x: 4900, y: 1300, label: 'F2', col: '#ffc35a' }, { x: 5200, y: 3800, label: 'F3', col: '#ffc35a' }, { x: 2400, y: 3600, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 950, tech: 2, unlock: ['arc'] },
    reinforcements: { comms: [], squads: [['golem', 'forgedrone', 'forgedrone'], ['forgetank', 'forgetank']], from: [{ x: 3200, y: 200 }], delay: 6, cooldown: 35, max: 6 },
    hazards: { zones: [{ type: 'heat', x: 1500, y: 1500, r: 260 }, { type: 'heat', x: 4900, y: 1300, r: 260 }, { type: 'heat', x: 5200, y: 3800, r: 260 }, { type: 'heat', x: 3200, y: 2600, r: 200 }] },
    lines: {
      w6m2_intro: { t: 'Three cores in three furnaces. Mind the heat and the fuel gauge.', s: 'command' },
      w6m2_core: { t: "Core secured. Now they're angry.", s: 'command' },
    },
    entities: [
      ...L.fob('fob', 2400, 3600),
      { t: 'struct', k: 'factory', id: 'f1', x: 1500, y: 1450, types: ['golem'], max: 2, interval: 18 }, { t: 'cargo', k: 'powercell', id: 'pc1', x: 1500, y: 1580, label: 'POWER CORE' },
      { t: 'struct', k: 'factory', id: 'f2', x: 4900, y: 1250, types: ['forgetank'], max: 2, interval: 18 }, { t: 'cargo', k: 'powercell', id: 'pc2', x: 4900, y: 1380, label: 'POWER CORE' },
      { t: 'struct', k: 'factory', id: 'f3', x: 5200, y: 3750, types: ['forgedrone'], max: 4, interval: 10 }, { t: 'cargo', k: 'powercell', id: 'pc3', x: 5200, y: 3880, label: 'POWER CORE' },
      { t: 'struct', k: 'turret_heavy', x: 1350, y: 1700 }, { t: 'struct', k: 'turret_heavy', x: 1700, y: 1700 }, { t: 'struct', k: 'turret_heavy', x: 4700, y: 1450 }, { t: 'struct', k: 'turret_heavy', x: 5100, y: 1450 }, { t: 'struct', k: 'turret_heavy', x: 5000, y: 4000 }, { t: 'struct', k: 'turret_heavy', x: 5400, y: 4000 },
      { t: 'unit', k: 'magma', id: 'm1', x: 3000, y: 1900 }, { t: 'unit', k: 'magma', id: 'm2', x: 3400, y: 1800 }, { t: 'unit', k: 'magma', id: 'm3', x: 3200, y: 2100 },
      { t: 'zone', id: 'shrine', x: 600, y: 600, r: 200 }, { t: 'struct', k: 'obelisk', x: 600, y: 560 }, ...L.cache(640, 640, ['tech', 'special', 'repair'], { hidden: true }),
      ...L.fill(139, { w: 6400, units: [['golem', 3, [1, 2]], ['forgedrone', 4, [2, 3]], ['forgetank', 2, [1, 2]]], obstacles: 28 }),
    ],
    objectives: [
      { id: 'cores', type: 'collect', items: ['pc1', 'pc2', 'pc3'], required: 3, text: 'Steal the Choir power cores', short: 'Deliver three power cores', marker: 'CORE' },
      { id: 'mortars', type: 'kill', targets: ['m1', 'm2', 'm3'], text: 'Silence the mortar battery', short: 'Destroy the mortar battery', cat: 'secondary', reward: 220 },
      { id: 'shrine', type: 'discover', zone: 'shrine', text: 'Find the cinder shrine', short: 'Find the cinder shrine', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w6m2_intro' }] },
      { when: { cargoPicked: 'pc1' }, do: [{ say: 'w6m2_core' }, { alertAll: true }] },
      { when: { cargoPicked: 'pc2' }, do: [{ say: 'w6m2_core' }] },
      { when: { cargoPicked: 'pc3' }, do: [{ say: 'w6m2_core' }] },
    ],
  });

  AS.Levels.add({
    id: 'w6m3', world: 6, index: 3, name: 'THE FOUNDRY ENGINE', region: 'Hephaest Plain', boss: true,
    map: { w: 6400, h: 6400, seed: 149 },
    start: { x: 1000, y: 5600, angle: -Math.PI / 2 }, extraction: { x: 900, y: 5800, r: 75 },
    briefing: {
      tagline: 'Stop the Foundry Engine before it reaches Hephaest colony.',
      danger: 5,
      situation: "The Choir have woken a factory that walks. The Foundry Engine is crossing the Hephaest Plain toward the colony shelter at the southern end, building golems in its belly as it goes and leaving rivers of fire behind it. Four coolant pumps on its flanks keep its core from melting down — destroy them and the core goes critical. If it reaches the shelter, eleven hundred people die. You have until it arrives.",
      narration: 'Vesper, the Foundry Engine is walking toward Hephaest colony. Eleven hundred people are in that shelter. Four coolant pumps on its flanks keep its core from melting down. Destroy the pumps, then destroy the core. If it reaches the colony, it is over. Move.',
      threats: ['THE FOUNDRY ENGINE — mobile factory, artillery, fire trails', 'Coolant pumps — protect the core', 'Slag golems built on the march', 'Eruptions, heat'],
      intel: ['The Engine walks from the north toward the colony in the south-east.', 'Pad Mike sits beside the colony.'],
      marks: [{ x: 3200, y: 1000, label: 'ENGINE', col: '#ff5a3a' }, { x: 4800, y: 5200, label: 'COLONY', col: '#7dff9a' }],
    },
    rewards: { salvage: 1200, tech: 3 },
    reinforcements: { comms: [], squads: [['forgedrone', 'forgedrone', 'forgedrone']], from: [{ x: 3200, y: 200 }], delay: 6, cooldown: 30, max: 6 },
    lines: {
      w6m3_intro: { t: 'There it is, on the horizon. Pumps first. And Vesper — clock is running.', s: 'command' },
      w6m3_open: { t: "All pumps down! The core is overheating — finish it!", s: 'command' },
      w6m3_half: { t: "It's halfway to the colony. Faster, Vesper!", s: 'command' },
      w6m3_dead: { t: 'The Foundry Engine is down. The colony is cheering on every channel.', s: 'command' },
      w6m3_lost: { t: "It reached the shelter. God help them.", s: 'command' },
    },
    entities: [
      { t: 'struct', k: 'dome', id: 'colony', x: 4800, y: 5200, team: 'player', hp: 1500 },
      { t: 'struct', k: 'pad', id: 'pad', x: 4500, y: 5400, pad: { repair: true, refuel: true, rearm: true, dropoff: true } },
      { t: 'boss', k: 'foundry', id: 'engine', x: 3200, y: 1000, wake: 1200, deathLine: 'w6m3_dead', path: [[3300, 1800], [3500, 2600], [3800, 3400], [4200, 4200], [4600, 4900], [4750, 5050]] },
      { t: 'zone', id: 'half', x: 3800, y: 3400, r: 120 },
      ...L.fill(149, { w: 6400, h: 6400, units: [['golem', 3, [1, 2]], ['forgedrone', 4, [2, 3]], ['magma', 2, [1, 1]]], obstacles: 26 }),
    ],
    objectives: [
      { id: 'pumps', type: 'destroy', targets: ['engine_cool0', 'engine_cool1', 'engine_cool2', 'engine_cool3'], text: 'Destroy the coolant pumps', short: 'Destroy the four coolant pumps' },
      { id: 'engine', type: 'boss', targets: ['engine'], text: 'Destroy the Foundry Engine before it reaches the colony', short: 'Destroy the Foundry Engine', marker: 'ENGINE', protect: ['colony'] },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w6m3_intro' }, { boss: 'engine', act: 'activate' }] },
      { when: { objective: 'pumps' }, do: [{ say: 'w6m3_open' }] },
      { when: { near: { x: 3800, y: 3400, r: 99999 } }, delay: 70, do: [{ say: 'w6m3_half' }] },
      { when: { event: 'foundryArrived' }, do: [{ say: 'w6m3_lost' }, { destroy: 'colony' }, { fail: 'engine' }] },
    ],
  });
})(window.AS);
