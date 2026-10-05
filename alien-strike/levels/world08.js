/* ALIEN STRIKE — World 8: STORM GIANT (wind currents, lightning, floating islands). */
'use strict';
(function (AS) {
  const L = AS.L;
  const isle = (x, y, r) => ({ x, y, r: r || 180 });

  AS.Levels.add({
    id: 'w8m1', world: 8, index: 1, name: 'SKYHOOK', region: 'Upper Tempest Belt',
    map: { w: 6000, h: 6000, seed: 171, zones: [isle(3000, 3000, 320), isle(1300, 1400, 220), isle(4700, 1500, 240), isle(1600, 4300, 200), isle(4600, 4400, 200), isle(3000, 1200, 160)] },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Protect the downed frigate Meridian while its crew restarts the lifters.',
      danger: 4,
      situation: "The frigate Meridian lost its lifters and fell onto a floating island in the cloud deck. Its crew needs two minutes to restart the anti-grav lifters before the island drifts into the storm wall. The Choir have a carrier nest on the north-east island launching storm interceptors, and the sky rays that live in the clouds are attracted to the frigate's dying reactor. Keep the Meridian alive. The wind up here will push you around; watch for the current lines.",
      narration: 'Vesper, the frigate Meridian is down on a floating island. Her crew needs two minutes to restart the lifters. Keep her alive. The Choir have an interceptor nest on the north-east island, and the sky rays are drawn to her reactor. The wind will push you off course. Fight it.',
      threats: ['Sky rays — flying predators with lightning', 'Storm interceptors from the carrier nest', 'Violent wind currents and gusts', 'Lightning strikes'],
      intel: ['Destroying the carrier nest stops the interceptor launches.', 'The Meridian has a working landing pad.'],
      marks: [{ x: 3000, y: 3000, label: 'MERIDIAN', col: '#7dff9a' }, { x: 4700, y: 1500, label: 'NEST', col: '#ff9a5a' }],
    },
    rewards: { salvage: 1050, tech: 2 },
    reinforcements: { comms: [], squads: [['skyray', 'skyray', 'skyray']], from: [{ x: 300, y: 300 }], delay: 6, cooldown: 30, max: 4 },
    lines: {
      w8m1_intro: { t: 'Meridian is on the big island. Two minutes. Every second counts.', s: 'command' },
      w8m1_lifters: { t: 'Lifters are online! Meridian is airborne! Outstanding!', s: 'command' },
      w8m1_nest: { t: 'Carrier nest destroyed. No more interceptors.', s: 'command' },
      w8m1_meridian: { t: "This is Meridian. We're taking hits — please hurry!", s: 'survivor', name: 'FRIGATE MERIDIAN' },
    },
    entities: [
      { t: 'struct', k: 'crashedship', id: 'meridian', x: 3000, y: 3000, hp: 900 },
      { t: 'struct', k: 'pad', id: 'mpad', x: 3250, y: 3150, pad: { repair: true, refuel: true, rearm: true, dropoff: true } },
      { t: 'struct', k: 'factory', id: 'nest', x: 4700, y: 1500, types: ['stormint'], max: 3, interval: 14 },
      { t: 'struct', k: 'flak', x: 4550, y: 1650 }, { t: 'struct', k: 'flak', x: 4850, y: 1650 }, { t: 'struct', k: 'pylon', x: 4700, y: 1300 },
      { t: 'zone', id: 'eyrie', x: 1300, y: 1400, r: 200 }, ...L.cache(1300, 1400, ['tech', 'special', 'repair'], { hidden: true }),
      ...L.fill(171, { units: [['skyray', 4, [2, 3]], ['stormint', 2, [1, 2]]], obstacles: 18, props: 14 }),
    ],
    objectives: [
      { id: 'hold', type: 'defend', target: 'meridian', duration: 120, text: 'Protect the Meridian while it restarts', short: 'Protect the Meridian (2:00)' },
      { id: 'nest', type: 'destroy', targets: ['nest'], text: 'Destroy the interceptor carrier nest', short: 'Destroy the carrier nest', cat: 'secondary', reward: 250 },
      { id: 'eyrie', type: 'discover', zone: 'eyrie', text: 'Find the storm eyrie', short: 'Find the storm eyrie', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w8m1_intro' }, { music: 'combat' }] },
      { when: { time: 12 }, do: [{ wave: { k: 'skyray', n: 4, x: 600, y: 2600, target: 'meridian', tx: 3000, ty: 3000 } }] },
      { when: { time: 40 }, do: [{ say: 'w8m1_meridian' }, { wave: { k: 'skyray', n: 4, x: 5400, y: 3400, target: 'meridian', tx: 3000, ty: 3000, say: false } }, { wave: { k: 'stormint', n: 2, x: 4700, y: 1500, tx: 3000, ty: 3000, say: false } }] },
      { when: { time: 75 }, do: [{ wave: { k: 'skyray', n: 5, x: 3000, y: 600, target: 'meridian', tx: 3000, ty: 3000 } }, { wave: { k: 'gunship', n: 1, x: 5500, y: 500, tx: 3000, ty: 3000, say: false } }] },
      { when: { time: 100 }, do: [{ wave: { k: 'stormint', n: 3, x: 600, y: 600, target: 'meridian', tx: 3000, ty: 3000 } }] },
      { when: { objective: 'hold' }, do: [{ say: 'w8m1_lifters' }, { music: 'none' }] },
      { when: { destroyed: 'nest' }, do: [{ say: 'w8m1_nest' }] },
    ],
  });

  AS.Levels.add({
    id: 'w8m2', world: 8, index: 2, name: 'EYE OF THE STORM', region: 'The Eyewall',
    map: { w: 6400, h: 6400, seed: 179, zones: [isle(1300, 1300, 240), isle(5100, 1200, 240), isle(5200, 5000, 240), isle(1200, 5100, 240), isle(3200, 3200, 300)] },
    start: { x: 3200, y: 5900, angle: -Math.PI / 2 }, extraction: { x: 3200, y: 6060, r: 75 },
    briefing: {
      tagline: 'Cut the Choir storm-relay network and hunt down its command gunships.',
      danger: 4,
      situation: "Four Choir relay towers on the islands of the Eyewall steer the storm itself, hurling lightning at our fleet in orbit. Destroy all four. Two heavy Choir gunships coordinate the network from the air — knock them out of the sky and the storm loses its brain. The central island has an old FRC weather station that can still refuel you.",
      narration: 'Vesper, four Choir relay towers are steering this storm into our fleet. Destroy all four. Two command gunships coordinate them. Knock them out of the sky. The old weather station on the central island can still refuel you.',
      threats: ['Choir command gunships — shielded, heavy weapons', 'Storm interceptors and sky rays', 'Arc pylons', 'Lightning, wind currents'],
      intel: ['Each relay island has a power node feeding its defences.', 'The gunships patrol between the relays.'],
      marks: [{ x: 1300, y: 1300, label: 'T', col: '#ff9a5a' }, { x: 5100, y: 1200, label: 'T', col: '#ff9a5a' }, { x: 5200, y: 5000, label: 'T', col: '#ff9a5a' }, { x: 1200, y: 5100, label: 'T', col: '#ff9a5a' }, { x: 3200, y: 3200, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 1100, tech: 3 },
    reinforcements: { comms: ['t1', 't2', 't3', 't4'], squads: [['stormint', 'stormint'], ['skyray', 'skyray', 'skyray']], from: [{ x: 300, y: 3200 }, { x: 6100, y: 3200 }], delay: 8, cooldown: 40, max: 5 },
    lines: {
      w8m2_intro: { t: 'Four towers, two gunships. The gunships are the real threat — watch their missiles.', s: 'command' },
      w8m2_tower: { t: 'Relay tower down. The storm is weakening.', s: 'command' },
      w8m2_gunship: { t: 'Command gunship destroyed!', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3200, 3200),
      { t: 'struct', k: 'comms', id: 't1', x: 1300, y: 1300, hp: 220 }, ...L.outpost('i1', 1300, 1300, { turrets: 2, radius: 140, turret: 'pylon', props: false }),
      { t: 'struct', k: 'comms', id: 't2', x: 5100, y: 1200, hp: 220 }, ...L.outpost('i2', 5100, 1200, { turrets: 2, radius: 140, turret: 'flak', props: false }),
      { t: 'struct', k: 'comms', id: 't3', x: 5200, y: 5000, hp: 220 }, ...L.outpost('i3', 5200, 5000, { turrets: 2, radius: 140, turret: 'pylon', props: false }),
      { t: 'struct', k: 'comms', id: 't4', x: 1200, y: 5100, hp: 220 }, ...L.outpost('i4', 1200, 5100, { turrets: 2, radius: 140, turret: 'flak', props: false }),
      { t: 'unit', k: 'gunship', id: 'gs1', x: 2000, y: 2000, patrol: [[1300, 1300], [5100, 1200], [3200, 3200]], leash: 6000 },
      { t: 'unit', k: 'gunship', id: 'gs2', x: 4400, y: 4400, patrol: [[5200, 5000], [1200, 5100], [3200, 3200]], leash: 6000 },
      { t: 'zone', id: 'calm', x: 6000, y: 3200, r: 200 }, ...L.cache(6000, 3200, ['tech', 'tech', 'special'], { hidden: true }),
      ...L.fill(179, { w: 6400, h: 6400, units: [['skyray', 4, [2, 3]], ['stormint', 3, [1, 2]]], obstacles: 18, props: 14 }),
    ],
    objectives: [
      { id: 'towers', type: 'destroy', targets: ['t1', 't2', 't3', 't4'], text: 'Destroy the storm relay towers', short: 'Destroy the four relay towers' },
      { id: 'gunships', type: 'kill', targets: ['gs1', 'gs2'], text: 'Destroy the command gunships', short: 'Destroy both command gunships' },
      { id: 'calm', type: 'discover', zone: 'calm', text: 'Find the calm pocket', short: 'Find the calm pocket', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w8m2_intro' }] },
      { when: { destroyedAny: ['t1', 't2', 't3', 't4'] }, do: [{ say: 'w8m2_tower' }] },
      { when: { destroyedAny: ['gs1', 'gs2'] }, do: [{ say: 'w8m2_gunship' }] },
    ],
  });

  AS.Levels.add({
    id: 'w8m3', world: 8, index: 3, name: 'TEMPEST', region: 'The Stormheart', boss: true,
    map: { w: 6400, h: 6400, seed: 187, zones: [isle(3200, 3200, 260), isle(1800, 1900, 180), isle(4600, 1900, 180), isle(3200, 4600, 180)] },
    start: { x: 3200, y: 5900, angle: -Math.PI / 2 }, extraction: { x: 3200, y: 6060, r: 75 },
    briefing: {
      tagline: 'Kill the Tempest Leviathan using its own lightning.',
      danger: 5,
      situation: "The Tempest Leviathan is the largest living thing ever recorded: a sky-serpent that swims through the cloud decks, breathing lightning. Its storm-hide shrugs off almost everything. But it is an electrical animal, and the Choir built lightning rods on three islands to herd it. Charge a rod, lure the Leviathan through it, and the discharge will stun it long enough for you to do real damage. Repeat until it falls.",
      narration: 'Vesper, the Tempest Leviathan. The biggest living thing we have ever seen. Its hide shrugs off almost everything. Three lightning rods stand on the islands. Charge a rod, then lure the Leviathan close to it. The discharge will stun it. Then hit it with everything. Repeat until it falls.',
      threats: ['THE TEMPEST LEVIATHAN — lightning breath, enormous', 'Sky rays', 'Storm interceptors', 'Wind and lightning'],
      intel: ['Hold E at a rod to charge it. A charge lasts fourteen seconds.', 'The Leviathan follows you. Fly past a charged rod with it on your tail.'],
      marks: [{ x: 1800, y: 1900, label: 'ROD', col: '#7fe8ff' }, { x: 4600, y: 1900, label: 'ROD', col: '#7fe8ff' }, { x: 3200, y: 4600, label: 'ROD', col: '#7fe8ff' }],
    },
    rewards: { salvage: 1350, tech: 4 },
    reinforcements: { comms: [], squads: [['skyray', 'skyray', 'skyray']], from: [{ x: 300, y: 300 }, { x: 6100, y: 300 }], delay: 8, cooldown: 40, max: 4 },
    lines: {
      w8m3_intro: { t: 'Rods are on the three outer islands. Charge one, then bring it the Leviathan.', s: 'command' },
      tempest_shocked: { t: "It's stunned! Everything you have, now!", s: 'command' },
      w8m3_dead: { t: 'The Leviathan is falling into the deep clouds. Vesper, that was magnificent.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3200, 3200),
      { t: 'struct', k: 'rod', id: 'rod1', x: 1800, y: 1900, label: 'Lightning Rod', verb: 'CHARGE', time: 1.5 },
      { t: 'struct', k: 'rod', id: 'rod2', x: 4600, y: 1900, label: 'Lightning Rod', verb: 'CHARGE', time: 1.5 },
      { t: 'struct', k: 'rod', id: 'rod3', x: 3200, y: 4600, label: 'Lightning Rod', verb: 'CHARGE', time: 1.5 },
      { t: 'boss', k: 'tempest', id: 'tempest', x: 3200, y: 1400, wake: 1400, deathLine: 'w8m3_dead' },
      ...L.fill(187, { w: 6400, h: 6400, units: [['skyray', 3, [2, 3]], ['stormint', 2, [1, 2]]], obstacles: 16, props: 12 }),
    ],
    objectives: [
      { id: 'tempest', type: 'boss', targets: ['tempest'], text: 'Kill the Tempest Leviathan', short: 'Kill the Tempest Leviathan', marker: 'LEVIATHAN' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w8m3_intro' }] },
      { when: { interacted: 'rod1' }, once: false, every: 1, do: [{ call: 'chargeRod', rod: 'rod1' }, { call: 'rearmConsole', id: 'rod1', t: 15 }] },
      { when: { interacted: 'rod2' }, once: false, every: 1, do: [{ call: 'chargeRod', rod: 'rod2' }, { call: 'rearmConsole', id: 'rod2', t: 15 }] },
      { when: { interacted: 'rod3' }, once: false, every: 1, do: [{ call: 'chargeRod', rod: 'rod3' }, { call: 'rearmConsole', id: 'rod3', t: 15 }] },
    ],
  });
})(window.AS);
