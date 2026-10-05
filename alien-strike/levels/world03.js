/* ALIEN STRIKE — World 3: VERDANT HIVE (shield-eating spore clouds, ambush predators). */
'use strict';
(function (AS) {
  const L = AS.L;

  AS.Levels.add({
    id: 'w3m1', world: 3, index: 1, name: 'BURN THE GARDEN', region: 'Thorn Basin',
    map: { w: 6000, h: 6000, seed: 71 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Burn out the hive growths choking the Thorn Basin.',
      danger: 3,
      situation: 'The hive is spreading through the Thorn Basin through six pulsing growth clusters. Each one is a nursery; left alone they will seed the whole continent. Burn them all. Hive mounds pump out drone swarms the moment you get close, and the jungle hides lurkers that wait with their mouths open. Pale-green clouds hanging over the canopy are caustic spores: they strip shields in seconds. Two exploration teams went missing out here last week.',
      narration: 'Vesper, six hive growths are spreading through the Thorn Basin. They are nurseries. Burn every one. The mounds will throw drone swarms at you, and the jungle is full of lurkers waiting to bite. Stay out of the green spore clouds. They eat shields alive. We also lost two exploration teams out there last week.',
      threats: ['Hive drone swarms from the mounds', 'Thorn lurkers — hidden ambush predators', 'Spitters and hive warriors', 'Caustic spore clouds — drain shields, corrode hull'],
      intel: ['The Xeno Bloom and plasma ordnance are especially effective on organic targets.', 'Forward pad Echo is in the western clearing.'],
      marks: [{ x: 1500, y: 3800, label: 'G', col: '#ff9a5a' }, { x: 2200, y: 1800, label: 'G', col: '#ff9a5a' }, { x: 3600, y: 900, label: 'G', col: '#ff9a5a' }, { x: 4700, y: 2200, label: 'G', col: '#ff9a5a' }, { x: 4300, y: 4000, label: 'G', col: '#ff9a5a' }, { x: 3000, y: 3000, label: 'G', col: '#ff9a5a' }],
    },
    rewards: { salvage: 700, tech: 1 },
    reinforcements: { comms: [], squads: [['hivedrone', 'hivedrone', 'hivedrone', 'hivedrone', 'hivedrone'], ['warrior', 'spitter', 'spitter']], from: [{ x: 3000, y: 300 }, { x: 5700, y: 3000 }], delay: 8, cooldown: 40, max: 5 },
    lines: {
      w3m1_intro: { t: "Six growths. The canopy hides a lot, so trust your scanner. And stay clear of the green fog.", s: 'command' },
      w3m1_growth: { t: 'Growth destroyed. The hive is screaming.', s: 'intel' },
      w3m1_team: { t: "Exploration team Rho! We're pinned down in the roots!", s: 'survivor', name: 'TEAM RHO' },
      w3m1_flower: { t: 'Look at the size of that bloom. It is broadcasting on the same frequency as the Choir.', s: 'intel' },
    },
    entities: [
      ...L.fob('fob', 900, 2600),
      { t: 'struct', k: 'growth', id: 'g1', x: 1500, y: 3800 }, { t: 'struct', k: 'growth', id: 'g2', x: 2200, y: 1800 }, { t: 'struct', k: 'growth', id: 'g3', x: 3600, y: 900 },
      { t: 'struct', k: 'growth', id: 'g4', x: 4700, y: 2200 }, { t: 'struct', k: 'growth', id: 'g5', x: 4300, y: 4000 }, { t: 'struct', k: 'growth', id: 'g6', x: 3000, y: 3000 },
      { t: 'struct', k: 'hive', id: 'h1', x: 2300, y: 1550 }, { t: 'struct', k: 'hive', id: 'h2', x: 4500, y: 2000 }, { t: 'struct', k: 'hive', id: 'h3', x: 3150, y: 2800 },
      { t: 'struct', k: 'turret_organic', x: 1600, y: 3650 }, { t: 'struct', k: 'turret_organic', x: 3500, y: 1050 }, { t: 'struct', k: 'turret_organic', x: 4450, y: 4150 },
      { t: 'unit', k: 'lurker', x: 1700, y: 4200, hidden: true }, { t: 'unit', k: 'lurker', x: 2600, y: 2300, hidden: true }, { t: 'unit', k: 'lurker', x: 4100, y: 1500, hidden: true }, { t: 'unit', k: 'lurker', x: 3800, y: 3600, hidden: true },
      { t: 'survivors', id: 'rho', x: 5300, y: 4700, n: 3, kind: 'explorer', label: 'TEAM RHO', voice: false }, { t: 'zone', id: 'rhozone', x: 5300, y: 4700, r: 400 },
      { t: 'survivors', id: 'sigma', x: 700, y: 900, n: 2, kind: 'explorer', label: 'TEAM SIGMA' },
      { t: 'unit', k: 'warrior', x: 5100, y: 4500, n: 2 }, { t: 'unit', k: 'spitter', x: 900, y: 1100, n: 3, spread: 60 },
      { t: 'zone', id: 'flower', x: 5500, y: 600, r: 220 },
      { t: 'struct', k: 'specimen', x: 5500, y: 600 },
      ...L.cache(5580, 650, ['tech', 'special', 'repair'], { hidden: true }),
      ...L.fill(71, { units: [['hivedrone', 6, [3, 5]], ['spitter', 5, [2, 3]], ['warrior', 3, [1, 2]], ['lurker', 4, [1, 1], { hidden: true }], ['hivebomber', 2, [1, 1]]], obstacles: 40, oh: [70, 120] }),
    ],
    objectives: [
      { id: 'growths', type: 'destroy', targets: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'], text: 'Burn the hive growths', short: 'Destroy all six hive growths' },
      { id: 'mounds', type: 'destroy', targets: ['h1', 'h2', 'h3'], text: 'Collapse the hive mounds', short: 'Destroy the hive mounds', cat: 'secondary', reward: 180 },
      { id: 'rho', type: 'rescue', groups: ['rho', 'sigma'], required: 4, text: 'Recover the missing exploration teams', short: 'Rescue the exploration teams', cat: 'secondary', reward: 220 },
      { id: 'flower', type: 'discover', zone: 'flower', text: 'Find the singing bloom', short: 'Find the singing bloom', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w3m1_intro' }] },
      { when: { destroyed: 'g1' }, do: [{ say: 'w3m1_growth' }] },
      { when: { enter: 'rhozone' }, do: [{ say: 'w3m1_team' }] },
      { when: { enter: 'flower' }, do: [{ say: 'w3m1_flower' }] },
    ],
  });

  AS.Levels.add({
    id: 'w3m2', world: 3, index: 2, name: 'LOST EXPEDITION', region: 'Mirelight Swamps',
    map: { w: 6400, h: 6000, seed: 79 },
    start: { x: 600, y: 5400, angle: -Math.PI / 4 }, extraction: { x: 500, y: 5560, r: 70 },
    briefing: {
      tagline: 'Find the Okafor expedition and catalogue the swamp organisms.',
      danger: 3,
      situation: "Dr. Okafor's expedition walked into the Mirelight Swamps to study the hive's living architecture and never walked out. Their last transmission named three camps. One of them has been overgrown: the hive cocoons living prey. Bring them home. While you are there, the xenology team wants close scans of three organisms the expedition was studying. Your passenger bay will not hold everyone; use the forward pad to ferry.",
      narration: "Vesper, the Okafor expedition went into the Mirelight Swamps and never came out. Three camps. The hive cocoons living prey, so check every growth before you open fire. We count eight survivors at most. Your bay will not hold them all. Use the forward pad. Science also wants scans of three swamp organisms. Hover close and hold your scanner on them.",
      threats: ['Hive warriors and spitters', 'Bloat bombers', 'Thorn lurkers in the reeds', 'Spore clouds over the swamp'],
      intel: ['Camp One: the old pumping station, north-west.', 'Camp Two: the eastern island.', 'Camp Three: last seen in the cocoon fields, north.', 'Scanning is done by holding E near the organism.'],
      marks: [{ x: 1400, y: 1600, label: 'C1', col: '#7fe8ff' }, { x: 5200, y: 3200, label: 'C2', col: '#7fe8ff' }, { x: 3600, y: 900, label: 'C3', col: '#7fe8ff' }, { x: 3200, y: 4300, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 750, tech: 2, unlock: ['emp'] },
    reinforcements: { comms: [], squads: [['warrior', 'spitter', 'spitter'], ['hivebomber', 'hivedrone', 'hivedrone', 'hivedrone']], from: [{ x: 6200, y: 300 }], delay: 8, cooldown: 45, max: 4 },
    lines: {
      w3m2_intro: { t: 'Three camps. Check your scanner for life signs, and take the specimen scans when you can.', s: 'command' },
      w3m2_cocoon: { t: "Life signs inside those cocoons. They're alive. Cut them out.", s: 'ship' },
      w3m2_okafor: { t: "This is Okafor. Whatever you do, don't let the hive take the samples we left at the pump station.", s: 'survivor', name: 'DR. OKAFOR' },
      w3m2_scans: { t: 'All three organisms catalogued. Science is very happy with you.', s: 'intel' },
    },
    entities: [
      ...L.fob('fob', 3200, 4300),
      { t: 'struct', k: 'station', x: 1400, y: 1600, invuln: true }, { t: 'survivors', id: 'camp1', x: 1460, y: 1700, n: 3, kind: 'explorer', label: 'CAMP ONE' },
      { t: 'cargo', k: 'sample', id: 'samples', x: 1340, y: 1700, label: 'EXPEDITION SAMPLES' },
      { t: 'survivors', id: 'camp2', x: 5200, y: 3200, n: 2, kind: 'explorer', label: 'CAMP TWO' }, { t: 'prop', k: 'crate', x: 5250, y: 3150, n: 3 },
      { t: 'struct', k: 'cocoon', id: 'coc1', x: 3500, y: 900 }, { t: 'survivors', id: 'camp3a', x: 3500, y: 900, n: 2, kind: 'scientist', label: 'COCOONED', caged: 'coc1', voice: false },
      { t: 'struct', k: 'cocoon', id: 'coc2', x: 3800, y: 1050 }, { t: 'survivors', id: 'camp3b', x: 3800, y: 1050, n: 1, kind: 'scientist', label: 'DR. OKAFOR', caged: 'coc2', voice: false },
      { t: 'zone', id: 'cocoonzone', x: 3650, y: 1000, r: 450 },
      { t: 'struct', k: 'hive', x: 3300, y: 650 }, { t: 'struct', k: 'turret_organic', x: 3900, y: 800 }, { t: 'struct', k: 'turret_organic', x: 3400, y: 1250 },
      { t: 'struct', k: 'specimen', id: 'sp1', x: 2400, y: 2800, scan: true, label: 'Walking Root', time: 2.5 },
      { t: 'struct', k: 'specimen', id: 'sp2', x: 4600, y: 1900, scan: true, label: 'Glass Fern', time: 2.5 },
      { t: 'struct', k: 'specimen', id: 'sp3', x: 1300, y: 3600, scan: true, label: 'Mire Lantern', time: 2.5 },
      { t: 'unit', k: 'warrior', x: 1600, y: 1500, n: 2 }, { t: 'unit', k: 'spitter', x: 5000, y: 3000, n: 3 }, { t: 'unit', k: 'lurker', x: 2500, y: 2600, hidden: true }, { t: 'unit', k: 'lurker', x: 4700, y: 2100, hidden: true },
      ...L.fill(79, { w: 6400, units: [['hivedrone', 5, [3, 5]], ['spitter', 5, [2, 3]], ['warrior', 3, [1, 2]], ['hivebomber', 3, [1, 1]], ['lurker', 4, [1, 1], { hidden: true }]], obstacles: 34 }),
    ],
    objectives: [
      { id: 'rescue', type: 'rescue', groups: ['camp1', 'camp2', 'camp3a', 'camp3b'], required: 6, text: 'Rescue the Okafor expedition', short: 'Rescue at least 6 expedition members' },
      { id: 'scan', type: 'scan', targets: ['sp1', 'sp2', 'sp3'], text: 'Scan the swamp organisms', short: 'Scan three organisms' },
      { id: 'samples', type: 'collect', items: ['samples'], text: 'Recover the expedition samples', short: 'Recover the expedition samples', cat: 'secondary', reward: 200 },
      { id: 'okafor', type: 'rescue', groups: ['camp3b'], required: 1, text: 'Rescue Dr. Okafor', short: 'Rescue Dr. Okafor', cat: 'secondary', reward: 150 },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w3m2_intro' }] },
      { when: { enter: 'cocoonzone' }, do: [{ say: 'w3m2_cocoon' }] },
      { when: { boarded: 'camp3b' }, delay: 1, do: [{ say: 'w3m2_okafor' }] },
      { when: { objective: 'scan' }, do: [{ say: 'w3m2_scans' }] },
    ],
  });

  AS.Levels.add({
    id: 'w3m3', world: 3, index: 3, name: 'CROWN OF THORNS', region: 'The Queen\'s Chamber', boss: true,
    map: { w: 6000, h: 6000, seed: 83 },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Kill the Hive Queen in her chamber.',
      danger: 4,
      situation: 'Every drone, every warrior, every growth on Verdant answers to a single mind: the Hive Queen, coiled in a crown of thorn-trees at the heart of the basin. Three pheromone nodes amplify her voice; while they live, her carapace hardens into an impenetrable shell. Burn the nodes, then kill the Queen. She will not come quietly — expect swarms, acid rain and diving attacks.',
      narration: 'Vesper, everything on this world answers to the Hive Queen. She is in the crown of thorns at the centre of the basin. Three pheromone nodes harden her shell. While they live you cannot hurt her. Burn the nodes, then kill the Queen. Expect swarms, acid rain, and dive attacks. End this.',
      threats: ['THE HIVE QUEEN — flying matriarch, acid rain, dive attacks', 'Pheromone nodes — make her invulnerable', 'Endless drone swarms', 'Spore clouds'],
      intel: ['Pad Foxtrot in the southern clearing.', 'The nodes ring the chamber: west, north-east, south-east.'],
      marks: [{ x: 3000, y: 2400, label: 'QUEEN', col: '#ff5a3a' }, { x: 1900, y: 2300, label: 'N', col: '#ffc35a' }, { x: 3900, y: 1700, label: 'N', col: '#ffc35a' }, { x: 3800, y: 3200, label: 'N', col: '#ffc35a' }],
    },
    rewards: { salvage: 950, tech: 3, unlock: ['bloom'] },
    reinforcements: { comms: [], squads: [['hivedrone', 'hivedrone', 'hivedrone', 'hivedrone', 'hivedrone', 'hivedrone']], from: [{ x: 3000, y: 300 }], delay: 6, cooldown: 35, max: 6 },
    lines: {
      w3m3_intro: { t: 'The chamber is dead ahead. Nodes first. Do not waste ordnance on her shell.', s: 'command' },
      w3m3_node: { t: 'Node down. Her shell is cracking.', s: 'intel' },
      w3m3_open: { t: 'All nodes destroyed! She is exposed!', s: 'command' },
      w3m3_dead: { t: "The Queen is dead. Listen — the whole jungle's gone quiet.", s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 4600),
      { t: 'struct', k: 'pheromone', id: 'n1', x: 1900, y: 2300 }, { t: 'struct', k: 'pheromone', id: 'n2', x: 3900, y: 1700 }, { t: 'struct', k: 'pheromone', id: 'n3', x: 3800, y: 3200 },
      { t: 'boss', k: 'queen', id: 'queen', x: 3000, y: 2400, shieldedBy: ['n1', 'n2', 'n3'], wake: 700, deathLine: 'w3m3_dead' },
      { t: 'struct', k: 'hive', x: 2000, y: 2100 }, { t: 'struct', k: 'hive', x: 4100, y: 1600 }, { t: 'struct', k: 'hive', x: 3900, y: 3400 },
      { t: 'struct', k: 'turret_organic', x: 2100, y: 2400 }, { t: 'struct', k: 'turret_organic', x: 3700, y: 1800 }, { t: 'struct', k: 'turret_organic', x: 3650, y: 3100 },
      ...L.ring('growth', 6, 3000, 2400, 420),
      ...L.fill(83, { units: [['hivedrone', 6, [3, 5]], ['warrior', 4, [1, 2]], ['spitter', 4, [2, 3]], ['hivebomber', 3, [1, 1]], ['lurker', 4, [1, 1], { hidden: true }]], obstacles: 40 }),
    ],
    objectives: [
      { id: 'nodes', type: 'destroy', targets: ['n1', 'n2', 'n3'], text: 'Burn the pheromone nodes', short: 'Destroy the three pheromone nodes' },
      { id: 'queen', type: 'boss', targets: ['queen'], text: 'Kill the Hive Queen', short: 'Kill the Hive Queen', marker: 'QUEEN' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w3m3_intro' }] },
      { when: { destroyedAny: ['n1', 'n2', 'n3'] }, do: [{ say: 'w3m3_node' }] },
      { when: { objective: 'nodes' }, do: [{ say: 'w3m3_open' }, { boss: 'queen', act: 'activate' }] },
    ],
  });
})(window.AS);
