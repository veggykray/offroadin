/* ALIEN STRIKE — World 5: THE DROWNED WORLD (submerged targets must be scanned). */
'use strict';
(function (AS) {
  const L = AS.L;
  const isle = (x, y, r) => ({ x, y, r: r || 120 });

  AS.Levels.add({
    id: 'w5m1', world: 5, index: 1, name: 'LOW TIDE', region: 'Sunken Meridian',
    map: { w: 6000, h: 6000, seed: 111, zones: [isle(1500, 1500, 140), isle(4600, 1300, 120), isle(3000, 3200, 160), isle(5000, 4300, 120), isle(1200, 4200, 120)] },
    start: { x: 3000, y: 5500, angle: -Math.PI / 2 }, extraction: { x: 3000, y: 5650, r: 70 },
    briefing: {
      tagline: 'Silence the drowned sonar emitters and rescue the stranded.',
      danger: 3,
      situation: "Beneath the Sunken Meridian's shallows, four Choir sonar emitters hum in the ruins of a drowned city. Their pulses drive the amphibious lurchers into frenzies and blind our orbital surveys. You cannot see them from the air: fly over the shimmer, hold your scanner on the contact to designate it, then destroy it. Survivors from the floating colony are stranded on rooftops across the bay.",
      narration: 'Vesper, four Choir sonar emitters are buried in the drowned city. You cannot target them from the air until they are designated. Hover over the shimmer and hold your scanner on them. Then kill them. Colony survivors are stranded on the rooftops. Pick them up when you can.',
      threats: ['Lurchers — amphibious, submerge and resurface', 'Gull drones — fast attack runs', 'Skimmer gunboats', 'Buoy turrets'],
      intel: ['Hold E over a submerged contact to scan it.', 'Forward pad India is on the central island.'],
      marks: [{ x: 1900, y: 2200, label: 'S', col: '#ffc35a' }, { x: 4100, y: 2200, label: 'S', col: '#ffc35a' }, { x: 2200, y: 4400, label: 'S', col: '#ffc35a' }, { x: 4300, y: 3700, label: 'S', col: '#ffc35a' }, { x: 3000, y: 3200, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 800, tech: 2 },
    reinforcements: { comms: [], squads: [['gull', 'gull', 'gull'], ['skimmer', 'skimmer']], from: [{ x: 5700, y: 300 }, { x: 300, y: 300 }], delay: 8, cooldown: 40, max: 5 },
    lines: {
      w5m1_intro: { t: 'Four sonar contacts in the shallows. Scan, then kill. Rooftop survivors on the islands.', s: 'command' },
      w5m1_scan: { t: 'Contact designated. Weapons free on the emitter.', s: 'ship' },
      w5m1_roof: { t: 'Over here! The water is full of those things!', s: 'survivor', name: 'STRANDED COLONIST' },
      w5m1_done: { t: 'Sonar net is down. The lurchers are scattering.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 3200),
      { t: 'struct', k: 'sonar', id: 'so1', x: 1900, y: 2200, noFlat: true, label: 'Sonar Emitter' }, { t: 'struct', k: 'sonar', id: 'so2', x: 4100, y: 2200, noFlat: true, label: 'Sonar Emitter' },
      { t: 'struct', k: 'sonar', id: 'so3', x: 2200, y: 4400, noFlat: true, label: 'Sonar Emitter' }, { t: 'struct', k: 'sonar', id: 'so4', x: 4300, y: 3700, noFlat: true, label: 'Sonar Emitter' },
      { t: 'survivors', id: 'roof1', x: 1500, y: 1500, n: 2, kind: 'colonist', label: 'ROOFTOP SURVIVORS' }, { t: 'survivors', id: 'roof2', x: 4600, y: 1300, n: 2, kind: 'colonist', label: 'ROOFTOP SURVIVORS' },
      { t: 'survivors', id: 'roof3', x: 5000, y: 4300, n: 2, kind: 'colonist', label: 'ROOFTOP SURVIVORS' }, { t: 'survivors', id: 'roof4', x: 1200, y: 4200, n: 2, kind: 'colonist', label: 'ROOFTOP SURVIVORS' },
      { t: 'zone', id: 'roofzone', x: 1500, y: 1500, r: 400 },
      { t: 'unit', k: 'floatturret', x: 1950, y: 2000 }, { t: 'unit', k: 'floatturret', x: 4200, y: 2400 }, { t: 'unit', k: 'floatturret', x: 4400, y: 3500 },
      { t: 'unit', k: 'skimmer', x: 3400, y: 1800, n: 2, patrol: [[3400, 1800], [2400, 2600], [3600, 4200], [4400, 2800]] },
      { t: 'zone', id: 'vault', x: 600, y: 600, r: 200 }, ...L.cache(600, 600, ['tech', 'special', 'repair', 'fuel'], { hidden: true }),
      ...L.fill(111, { units: [['lurcher', 7, [2, 3], { water: true }], ['gull', 4, [2, 3]], ['skimmer', 3, [1, 2], { water: true }], ['floatturret', 3, [1, 1], { water: true }]], obstacles: 30, props: 16 }),
    ],
    objectives: [
      { id: 'scan', type: 'scan', targets: ['so1', 'so2', 'so3', 'so4'], text: 'Scan the submerged emitters', short: 'Designate the four emitters' },
      { id: 'kill', type: 'destroy', targets: ['so1', 'so2', 'so3', 'so4'], text: 'Destroy the sonar emitters', short: 'Destroy the four emitters' },
      { id: 'roofs', type: 'rescue', groups: ['roof1', 'roof2', 'roof3', 'roof4'], required: 6, text: 'Rescue the rooftop survivors', short: 'Rescue rooftop survivors', cat: 'secondary', reward: 250 },
      { id: 'vault', type: 'discover', zone: 'vault', text: 'Find the drowned vault', short: 'Find the drowned vault', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w5m1_intro' }] },
      { when: { scanned: 'so1' }, do: [{ say: 'w5m1_scan' }] },
      { when: { enter: 'roofzone' }, do: [{ say: 'w5m1_roof' }] },
      { when: { objective: 'kill' }, do: [{ say: 'w5m1_done' }] },
    ],
  });

  AS.Levels.add({
    id: 'w5m2', world: 5, index: 2, name: 'FLOATING FIRE', region: 'Refinery Shoals',
    map: { w: 6400, h: 6000, seed: 119, zones: [isle(1200, 1200, 150), isle(5200, 1500, 130), isle(3000, 3400, 150)] },
    start: { x: 600, y: 5300, angle: -Math.PI / 4 }, extraction: { x: 500, y: 5450, r: 70 },
    briefing: {
      tagline: 'Burn the floating refineries and intercept the tanker convoy.',
      danger: 4,
      situation: 'The Choir are refining something from the drowned city — a dense violet fuel that powers their war-machines across three worlds. Three floating refineries anchor in the shoals. Sink them. A tanker convoy of armoured skimmers is about to run the refined fuel out to the deep water. Intercept it: if more than one tanker escapes, the Choir front gets a month of fuel.',
      narration: 'Vesper, the Choir are refining fuel out here. Three floating refineries. Sink them. A tanker convoy is about to run for deep water. Do not let more than one tanker escape.',
      threats: ['Floating refineries with flak defences', 'Skimmer tanker convoy with gunboat escort', 'Gull drone squadrons', 'Lurchers'],
      intel: ['The convoy leaves the eastern refinery at T+40s and runs north-west.', 'Forward pad Juliet on the central island.'],
      marks: [{ x: 2000, y: 2000, label: 'REF', col: '#ff9a5a' }, { x: 4400, y: 2600, label: 'REF', col: '#ff9a5a' }, { x: 3800, y: 4600, label: 'REF', col: '#ff9a5a' }, { x: 3000, y: 3400, label: 'FOB', col: '#7dff9a' }],
    },
    rewards: { salvage: 900, tech: 2, unlock: ['disruptor'] },
    reinforcements: { comms: [], squads: [['gull', 'gull', 'gull', 'gull']], from: [{ x: 6200, y: 300 }], delay: 8, cooldown: 40, max: 4 },
    lines: {
      w5m2_intro: { t: "Three refineries. The tankers sail at forty seconds — be in position.", s: 'command' },
      w5m2_convoy: { t: 'Tanker convoy is moving! Intercept!', s: 'command' },
      w5m2_tanker: { t: 'Tanker destroyed!', s: 'command' },
      w5m2_escaped: { t: 'A tanker made deep water. Do not let another one through.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 3000, 3400),
      { t: 'struct', k: 'refinery', id: 'rf1', x: 2000, y: 2000, noFlat: true }, { t: 'struct', k: 'refinery', id: 'rf2', x: 4400, y: 2600, noFlat: true }, { t: 'struct', k: 'refinery', id: 'rf3', x: 3800, y: 4600, noFlat: true },
      { t: 'struct', k: 'flak', x: 2200, y: 1850, noFlat: true }, { t: 'struct', k: 'flak', x: 1800, y: 2200, noFlat: true }, { t: 'struct', k: 'flak', x: 4600, y: 2450, noFlat: true }, { t: 'struct', k: 'flak', x: 4250, y: 2800, noFlat: true }, { t: 'struct', k: 'flak', x: 3950, y: 4800, noFlat: true },
      { t: 'convoy', id: 'tankers', units: ['skimmer', 'skimmer', 'skimmer', 'skimmer'], team: 'enemy', x: 4700, y: 2900, spacing: 70, start: false, speedMul: 0.65,
        path: [[4400, 3300], [3700, 3900], [2700, 4100], [1700, 3600], [1100, 2600], [700, 1600], [300, 700]] },
      { t: 'unit', k: 'gull', x: 4600, y: 3000, n: 3, active: true },
      { t: 'zone', id: 'wreck', x: 5800, y: 5400, r: 220 }, ...L.cache(5800, 5400, ['tech', 'tech', 'special'], { hidden: true }),
      ...L.fill(119, { w: 6400, units: [['lurcher', 6, [2, 3], { water: true }], ['gull', 4, [2, 3]], ['skimmer', 3, [1, 2], { water: true }], ['floatturret', 4, [1, 1], { water: true }]], obstacles: 30, props: 14 }),
    ],
    objectives: [
      { id: 'refineries', type: 'destroy', targets: ['rf1', 'rf2', 'rf3'], text: 'Sink the floating refineries', short: 'Destroy the three refineries' },
      { id: 'tankers', type: 'intercept', convoy: 'tankers', required: 3, allowArrive: 1, text: 'Intercept the tanker convoy', short: 'Destroy at least 3 of 4 tankers', marker: 'TANKER' },
      { id: 'wreck', type: 'discover', zone: 'wreck', text: 'Find the scuttled carrier', short: 'Find the scuttled carrier', cat: 'hidden' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w5m2_intro' }] },
      { when: { time: 40 }, do: [{ convoy: 'tankers', act: 'start' }, { say: 'w5m2_convoy' }] },
      { when: { destroyedAny: ['tankers_0', 'tankers_1', 'tankers_2', 'tankers_3'] }, do: [{ say: 'w5m2_tanker' }] },
      { when: { convoyArrived: 'tankers' }, do: [{ say: 'w5m2_escaped' }] },
    ],
  });

  AS.Levels.add({
    id: 'w5m3', world: 5, index: 3, name: 'LEVIATHAN', region: 'The Abyssal Bay', boss: true,
    map: { w: 6400, h: 6400, seed: 127, zones: [isle(1000, 1000, 140), isle(5400, 1200, 130), isle(1200, 5000, 120)] },
    start: { x: 3200, y: 5900, angle: -Math.PI / 2 }, extraction: { x: 3200, y: 6060, r: 75 },
    briefing: {
      tagline: 'Destroy the Abyssal Refinery, the mobile heart of the Choir fuel trade.',
      danger: 4,
      situation: "The refinery you burned last week was a satellite. Its mother is the Abyssal Refinery: a mobile platform the size of a city block, crawling around the bay on lifting fans, guarded by four armoured pump turrets that also cool its core. Kill the pumps and the core vents open. Then sink it. It fires heavy missiles and flak; there is nowhere to hide on open water.",
      narration: 'Vesper, the Abyssal Refinery is a mobile platform the size of a city block. Four pump turrets cool its core and seal it. Destroy the pumps, and the core opens. Then sink the whole thing. Expect heavy missiles and flak. There is no cover out there.',
      threats: ['THE ABYSSAL REFINERY — mobile fortress, missiles, flak', 'Pump turrets — seal the core', 'Gull drones and skimmers'],
      intel: ['The platform circles the bay slowly.', 'Shoot down incoming missiles with your primary weapon.'],
      marks: [{ x: 3200, y: 3000, label: 'TARGET', col: '#ff5a3a' }],
    },
    rewards: { salvage: 1100, tech: 3 },
    reinforcements: { comms: [], squads: [['gull', 'gull', 'gull'], ['skimmer', 'skimmer']], from: [{ x: 6200, y: 300 }, { x: 300, y: 300 }], delay: 8, cooldown: 40, max: 5 },
    lines: {
      w5m3_intro: { t: 'There it is. Pumps first. The core is sealed until they are gone.', s: 'command' },
      w5m3_open: { t: 'All pumps down! The core is venting — hit it!', s: 'command' },
      w5m3_dead: { t: 'The Abyssal Refinery is going down. The Choir just lost their fuel supply.', s: 'command' },
    },
    entities: [
      ...L.fob('fob', 1000, 1100),
      { t: 'boss', k: 'refinery', id: 'abyss', x: 3200, y: 3000, wake: 900, deathLine: 'w5m3_dead', path: [[4400, 2400], [4600, 3800], [3200, 4400], [1900, 3600], [2000, 2200], [3200, 1800]] },
      ...L.fill(127, { w: 6400, h: 6400, units: [['lurcher', 5, [2, 3], { water: true }], ['gull', 5, [2, 3]], ['skimmer', 3, [1, 2], { water: true }]], obstacles: 26, props: 12 }),
    ],
    objectives: [
      { id: 'pumps', type: 'destroy', targets: ['abyss_pump0', 'abyss_pump1', 'abyss_pump2', 'abyss_pump3'], text: 'Destroy the pump turrets', short: 'Destroy the four pump turrets' },
      { id: 'abyss', type: 'boss', targets: ['abyss'], text: 'Sink the Abyssal Refinery', short: 'Sink the Abyssal Refinery', marker: 'TARGET' },
    ],
    triggers: [
      { when: { time: 3 }, do: [{ say: 'w5m3_intro' }] },
      { when: { objective: 'pumps' }, do: [{ say: 'w5m3_open' }] },
    ],
  });
})(window.AS);
