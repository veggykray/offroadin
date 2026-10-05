/* ALIEN STRIKE — player weapon definitions (data only).
 * kind selects the behaviour in src/game/weapons.js. Slot upgrades (primary /
 * secondary / special) scale whichever weapon is equipped in that slot. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  AS.Data.weapons = {
    /* ---------------- PRIMARY ---------------- */
    pulse: {
      slot: 'primary', name: 'PULSE CANNON', short: 'PULSE', kind: 'bolt',
      desc: 'Fast, accurate kinetic pulses from twin articulated pods. Builds heat under sustained fire.',
      ammo: 600, rate: 9, dmg: 6, speed: 760, range: 470, heat: 4.0, cool: 34, spread: 0.025,
      dtype: 'kinetic', col: '#9fe8ff', size: 2, sfx: 'pulse', fab: null,
    },
    apc: {
      slot: 'primary', name: 'BREACHER AUTOCANNON', short: 'BREACHER', kind: 'bolt',
      desc: 'Armour-piercing shells with a small burst. Ignores most vehicle armour; slower cycle.',
      ammo: 240, rate: 4.5, dmg: 15, speed: 640, range: 480, heat: 7, cool: 30, spread: 0.035, splash: 16,
      dtype: 'ap', col: '#ffb07a', size: 3, sfx: 'cannon', fab: { salvage: 700, tech: 1 },
    },
    beam: {
      slot: 'primary', name: 'LUMEN BEAM', short: 'BEAM', kind: 'beam',
      desc: 'A continuous Choir-derived beam. Melts anything it touches while the trigger is held. Drains cells quickly.',
      ammo: 300, drain: 16, dps: 50, range: 320, heat: 22, cool: 30,
      dtype: 'energy', col: '#ffd36b', sfx: 'beam', fab: { salvage: 900, tech: 2 },
    },
    rail: {
      slot: 'primary', name: 'RAIL DRIVER', short: 'RAIL', kind: 'rail',
      desc: 'Magnetic slugs that pierce through several targets in a line. Slow to cycle, devastating on hit.',
      ammo: 50, rate: 1.1, dmg: 80, range: 760, pierce: 6, heat: 28, cool: 30,
      dtype: 'ap', col: '#b4a7ff', sfx: 'rail', fab: { salvage: 1400, tech: 3 },
    },
    arc: {
      slot: 'primary', name: 'ARC PROJECTOR', short: 'ARC', kind: 'arc',
      desc: 'Short-range lightning that chains between nearby targets and briefly scrambles machines.',
      ammo: 260, rate: 3.6, dmg: 14, range: 240, chains: 3, chainRange: 110, heat: 8, cool: 30, stun: 0.4,
      dtype: 'energy', col: '#9fffcf', sfx: 'arc', fab: { salvage: 1200, tech: 3 },
    },
    /* ---------------- SECONDARY ---------------- */
    missile: {
      slot: 'secondary', name: 'MICRO-MISSILES', short: 'MISSILES', kind: 'missile',
      desc: 'Hold the secondary trigger over targets to paint locks, release to fire. Tap to dumb-fire. Strong against vehicles and structures.',
      ammo: 16, dmg: 44, splash: 38, speed: 520, turn: 6.5, range: 700, lockTime: 0.55, multi: 1,
      dtype: 'explosive', col: '#ff9a5a', sfx: 'missile', fab: null,
    },
    swarm: {
      slot: 'secondary', name: 'SWARM POD', short: 'SWARM', kind: 'swarm',
      desc: 'Each salvo releases six seeker rockets that split between the nearest hostiles.',
      ammo: 10, count: 6, dmg: 15, splash: 20, speed: 430, turn: 5, range: 560,
      dtype: 'explosive', col: '#ffcf5a', sfx: 'swarm', fab: { salvage: 800, tech: 2 },
    },
    emp: {
      slot: 'secondary', name: 'EMP LANCE', short: 'EMP', kind: 'emp',
      desc: 'An ionic charge that stalls machines, drones and turrets and strips energy shields in its blast.',
      ammo: 6, dmg: 20, radius: 120, stun: 5, speed: 600, range: 520,
      dtype: 'energy', col: '#7ab8ff', sfx: 'emp', fab: { salvage: 900, tech: 2 },
    },
    /* ---------------- SPECIAL ---------------- */
    plasma: {
      slot: 'special', name: 'PLASMA BOMB', short: 'PLASMA', kind: 'bomb',
      desc: 'A lobbed plasma core that detonates at the aim point. Massive area damage.',
      ammo: 3, dmg: 160, radius: 105, range: 380, flight: 0.75, cooldown: 1.2,
      dtype: 'energy', col: '#c58aff', sfx: 'plasma', fab: null,
    },
    gravitic: {
      slot: 'special', name: 'GRAVITIC CHARGE', short: 'GRAVITIC', kind: 'gravitic',
      desc: 'Opens a gravity well that drags enemies and their projectiles inward, then implodes.',
      ammo: 3, dmg: 120, radius: 170, pull: 2.4, range: 380, cooldown: 2,
      dtype: 'energy', col: '#8affd8', sfx: 'gravitic', fab: { salvage: 700, tech: 1 },
    },
    mines: {
      slot: 'special', name: 'GRAVITY MINES', short: 'MINES', kind: 'mine',
      desc: 'Drops proximity mines behind the craft. Perfect for pursuers and convoy routes.',
      ammo: 6, dmg: 95, radius: 70, cooldown: 0.4,
      dtype: 'explosive', col: '#ff6a6a', sfx: 'mine', fab: { salvage: 600, tech: 1 },
    },
    drones: {
      slot: 'special', name: 'HORNET DRONES', short: 'DRONES', kind: 'drones',
      desc: 'Deploys two autonomous gun-drones that escort the craft and engage hostiles for 25 seconds.',
      ammo: 2, count: 2, life: 25, dmg: 5, rate: 4, cooldown: 3,
      dtype: 'kinetic', col: '#9fe8ff', sfx: 'drones', fab: { salvage: 1000, tech: 2 },
    },
    orbital: {
      slot: 'special', name: 'ORBITAL LANCE', short: 'ORBITAL', kind: 'orbital',
      desc: 'Throw a beacon; three seconds later the fleet answers with a lance from orbit.',
      ammo: 1, dmg: 420, radius: 160, delay: 3, range: 420, cooldown: 3,
      dtype: 'energy', col: '#ffffff', sfx: 'orbital', fab: { salvage: 1600, tech: 4 },
    },
    disruptor: {
      slot: 'special', name: 'SHIELD DISRUPTOR', short: 'DISRUPTOR', kind: 'disruptor',
      desc: 'A pulse that strips shields, collapses shield domes temporarily and stuns machines around the craft.',
      ammo: 3, radius: 260, stun: 4, cooldown: 2,
      dtype: 'energy', col: '#7af0ff', sfx: 'disruptor', fab: { salvage: 1100, tech: 3 },
    },
    bloom: {
      slot: 'special', name: 'XENO BLOOM', short: 'BLOOM', kind: 'bloom',
      desc: 'A cultured alien spore payload. The cloud eats organics alive and corrodes machinery.',
      ammo: 2, radius: 140, dps: 32, life: 9, range: 380, cooldown: 2,
      dtype: 'bio', col: '#9cff6a', sfx: 'bloom', fab: { salvage: 1300, tech: 3 },
    },
  };
  AS.Data.weaponOrder = {
    primary: ['pulse', 'apc', 'beam', 'rail', 'arc'],
    secondary: ['missile', 'swarm', 'emp'],
    special: ['plasma', 'gravitic', 'mines', 'drones', 'orbital', 'disruptor', 'bloom'],
  };
})(window.AS);
