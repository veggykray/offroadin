/* WYRMCROWN — the four dragon realms (data only).
 * Each faction is symmetric in structure — a town, a treasury, a dragon rider,
 * troops and a strategic AI personality — so any of them can be driven by a
 * human pilot or an AI lord (the later four-player mode only swaps pilots).
 * Dragon stats are multipliers on the shared flight model (src/game/dragon.js). */
'use strict';
(function (AS) {
  const P = AS.Data.pal;
  AS.Data.factions = {
    human: {
      key: 'human', motto: 'Fire and Freedom', name: 'Kingdom of Aldermere', short: 'Aldermere', people: 'Aldermen', adj: 'Aldermere',
      color: '#e0483a', color2: '#f0c050', pal: P.human, biome: 'human',
      blurb: 'Fertile farmland, stone towns and knightly orders. Balanced, organised and hard to break behind its walls.',
      dragon: { name: 'Pyrrhax', title: 'the Ember Wyrm', hp: 440, armor: 2, speed: 1, turn: 1, scale: 1, breath: 'fire', breathDmg: 1, boltDmg: 1, recover: 24,
        style: 'All-rounder', play: 'Sturdy and steady: golden spheres at a steady pace and a roaring stream of fire that sets buildings alight. The baseline everything else is measured against.' },
      rider: { name: 'Magister Aldric', robe: '#2b4a9e', trim: '#e8c050', hat: '#22408a', cloth: '#b8262a', skin: '#e8c4a0', orb: '#ffd24a', bolt: 'arcane' },
      troops: { soldier: { gen: 'ppl_soldier' }, archer: { gen: 'ppl_archer' }, elite: { gen: 'ppl_knight' }, mage: { gen: 'ppl_mage' } },
      ai: { style: 'balanced', aggression: 0.5, defence: 0.65, economy: 0.6, raidLivestock: 0.4, preferred: ['walls', 'tower', 'barracks', 'farm'] },
      music: { root: 50, scale: 'mixolydian', tempo: 96, pad: 'strings', lead: 'horn', arp: 'lute', bell: 'harp', perc: 'march', drums: 'war', bossLead: 'horn', bossBass: 'bass', name: 'Banners of Aldermere' },
      ambience: ['wind', 'forest', 'village', 'birds', 'cattle'],
      hint: 'Your realm — the fields and stone towns of the south-west.',
    },
    elf: {
      key: 'elf', motto: 'Beauty and Superiority', name: 'Sylvaran Realm', short: 'Sylvara', people: 'Sylvari', adj: 'Sylvaran',
      color: '#3fcf7a', color2: '#e8f0b0', pal: P.elf, biome: 'elf',
      blurb: 'Ancient forests, elegant spires and the oldest magic. Fast, evasive and fond of ambush.',
      dragon: { name: 'Verdanthe', title: 'the Glade Serpent', hp: 390, armor: 1.5, speed: 1.12, turn: 1.18, scale: 0.92, breath: 'verdant', breathDmg: 1, boltDmg: 1, recover: 22,
        style: 'Swift skirmisher', play: 'The fastest and nimblest, but the most fragile. Swift white arrows and the longest-reaching emerald flame, whose roots pin troops in place: strike from afar and slip away.' },
      rider: { name: 'Archmage Ilythiel', robe: '#e8ecd8', trim: '#3a9a5a', hat: '#e8ecd8', cloth: '#23794a', skin: '#f2dcc4', orb: '#9fffd8', bolt: 'verdant' },
      troops: { soldier: { gen: 'trp_elf_warden' }, archer: { gen: 'ppl_archer' }, elite: { gen: 'trp_elf_warden' }, mage: { gen: 'ppl_mage' } },
      ai: { style: 'evasive', aggression: 0.55, defence: 0.45, economy: 0.65, raidLivestock: 0.3, preferred: ['magetower', 'tower', 'market', 'farm'] },
      music: { root: 52, scale: 'lydian', tempo: 84, pad: 'airy', lead: 'flute', arp: 'harp', bell: 'bell', perc: 'soft', drums: 'war', bossLead: 'flute', bossBass: 'bass', name: 'Song of the Silver Boughs' },
      ambience: ['forest', 'birds', 'wind'],
      hint: 'The deep forests of the north-west.',
    },
    ice: {
      key: 'ice', motto: 'Cold Endures', name: 'Hrimgard', short: 'Hrimgard', people: 'Hrimfolk', adj: 'Hrimgard',
      color: '#6ab8ff', color2: '#e8f6ff', pal: P.ice, biome: 'ice',
      blurb: 'Frozen mountains, glacier fortresses and frost-hardened warbands. Slow to anger, terrible in defence.',
      dragon: { name: 'Skaldfrost', title: 'the Winter Tyrant', hp: 480, armor: 2.5, speed: 0.9, turn: 0.86, scale: 1.12, breath: 'frost', breathDmg: 1, boltDmg: 1, recover: 26,
        style: 'Armoured tank', play: 'Slow and wide-turning, but it shrugs off the most punishment. Heavy ice shards and a short, crushing freezing breath that slows foes and leaves walls brittle.' },
      rider: { name: 'Frost-Seer Ymra', robe: '#dfe8f2', trim: '#5a8ad0', hat: '#b8c8da', cloth: '#3567b4', skin: '#efd8c8', orb: '#c8f4ff', bolt: 'frost' },
      troops: { soldier: { gen: 'trp_ice_berserker' }, archer: { gen: 'ppl_archer' }, elite: { gen: 'trp_ice_berserker' }, mage: { gen: 'ppl_mage' } },
      ai: { style: 'fortress', aggression: 0.35, defence: 0.85, economy: 0.55, raidLivestock: 0.25, preferred: ['walls', 'ballista', 'tower', 'barracks'] },
      music: { root: 45, scale: 'aeolian', tempo: 78, pad: 'choir', lead: 'horn', arp: 'harp', bell: 'glass', perc: 'frame', drums: 'war', bossLead: 'horn', bossBass: 'bass', name: 'Hymn of the Long Night' },
      ambience: ['blizzard', 'wind', 'icecrack'],
      hint: 'The glaciers and peaks of the north-east.',
    },
    undead: {
      key: 'undead', motto: 'Death Finds a Way', name: 'Dominion of Morgrave', short: 'Morgrave', people: 'the Risen', adj: 'Morgrave',
      color: '#9a5adf', color2: '#a8ff8a', pal: P.undead, biome: 'undead',
      blurb: 'Dead forests, black fortresses and endless skeleton legions. Relentless, aggressive and hard to keep down.',
      dragon: { name: 'Vorthrax', title: 'the Unburied', hp: 430, armor: 1.5, speed: 1.02, turn: 0.98, scale: 1.05, breath: 'necrotic', breathDmg: 1, boltDmg: 1, recover: 15,
        style: 'Relentless raider', play: 'Back in the sky soonest after being driven off. Slow poison orbs and a plague breath whose venom keeps eating after it passes; the troops it kills rise again as skeletons.' },
      rider: { name: 'Lich-Lord Malkhar', robe: '#2a2030', trim: '#93ff6a', hat: '#1a1420', cloth: '#5c2a6c', skin: '#b8c4a8', orb: '#c47aff', bolt: 'necrotic' },
      troops: { soldier: { gen: 'trp_undead_skeleton' }, archer: { gen: 'trp_undead_skeleton' }, elite: { gen: 'trp_undead_ghoul' }, mage: { gen: 'ppl_mage' } },
      ai: { style: 'aggressive', aggression: 0.8, defence: 0.4, economy: 0.5, raidLivestock: 0.65, preferred: ['barracks', 'tower', 'workshop', 'magetower'] },
      music: { root: 46, scale: 'phrygian', tempo: 88, pad: 'dark', lead: 'choir', arp: 'harp', bell: 'bell', drone: 'deepdrone', perc: 'frame', drums: 'war', bossLead: 'choir', bossBass: 'bassdist', name: 'March of the Unburied' },
      ambience: ['cursed', 'wind', 'creatures'],
      hint: 'The cursed lands of the south-east.',
    },
  };
  AS.Data.factionOrder = ['human', 'elf', 'ice', 'undead'];
  // breath types: look, reach and weight. All four are balanced on damage per full charge
  // (Pyrrhax is the baseline): range and dps scale the stream's reach and its damage per tick,
  // half is the cone's half-angle, drain the breath charge spent per second, armorK how much
  // armour blunts each tick (in proportion to the tick's size), poison a lingering damage per
  // second refreshed while the stream touches (src/game/combat.js: Poison).
  AS.Data.breaths = {
    fire: { name: 'Fire Breath', style: 'fire', cols: ['#fff6c8', '#ffb030', '#ff4a10', '#6a1a08'], smoke: '#3a3028', effect: 'burn', dmg: 1, light: '#ff9a40', sfx: 'breath_fire',
      range: 1, dps: 1, half: 0.34, drain: 32, armorK: 1 },
    verdant: { name: 'Emerald Flame', style: 'verdant', cols: ['#f0fff4', '#6affa8', '#12c060', '#04502a'], smoke: '#2a4a3a', effect: 'entangle', dmg: 1, light: '#5aff9a', sfx: 'breath_magic',
      range: 1.45, dps: 0.78, half: 0.22, drain: 24, armorK: 0.78 },
    frost: { name: 'Freezing Breath', style: 'frost', cols: ['#ffffff', '#dff6ff', '#8ccfff', '#3a6aa8'], smoke: '#c8e0f0', effect: 'freeze', dmg: 1, light: '#a8e4ff', sfx: 'breath_frost',
      range: 0.78, dps: 1.4, half: 0.44, drain: 45, armorK: 1.4 },
    necrotic: { name: 'Plague Breath', style: 'necrotic', cols: ['#f4e4ff', '#c46aff', '#6a1aa0', '#1c0830'], smoke: '#2a1a38', effect: 'wither', dmg: 1, light: '#b46aff', sfx: 'breath_necro',
      range: 1, dps: 0.72, half: 0.32, drain: 32, armorK: 0.72, poison: 16 },
  };

})(window.AS);
