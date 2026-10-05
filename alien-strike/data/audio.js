/* ALIEN STRIKE — sound effect manifest (data only).
 * Each id is synthesised from its recipe at start-up (src/audio/synth.js).
 * AUDIO HOOK: to use a recorded asset instead, set file: 'audio/sfx/<name>.ogg'
 * (or .mp3/.wav) — the engine loads it when served over http(s) and falls back to
 * the recipe if loading fails. vol = playback gain, poly = max simultaneous voices. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  const N = (o) => Object.assign({ type: 'noise' }, o);
  const S = (type, o) => Object.assign({ type }, o);
  AS.Data.sfx = {
    // ---------------- player weapons ----------------
    pulse: { vol: 0.32, poly: 6, dur: 0.16, layers: [S('square', { f: 1500, f1: 280, sweep: 0.09, decay: 30, lp: 4200, gain: 0.55 }), N({ decay: 70, hp: 3000, gain: 0.35 }), S('sine', { f: 240, f1: 110, decay: 24, gain: 0.5 })] },
    cannon: { vol: 0.45, poly: 5, dur: 0.32, drive: 1.6, layers: [N({ decay: 14, lp: 1300 }), S('sine', { f: 170, f1: 50, decay: 12, gain: 1 }), S('square', { f: 95, decay: 22, lp: 600, gain: 0.3 })] },
    beam_loop: { vol: 0.3, loop: true, dur: 1.0, layers: [S('saw', { f: 110, fm: 2.0, fmAmt: 0.35, env: [0.001, 0, 1, 0.001], gain: 0.5, lp: 2600 }), N({ env: [0.001, 0, 1, 0.001], bp: 2400, q: 0.7, gain: 0.25 }), S('sine', { f: 220, env: [0.001, 0, 1, 0.001], trem: 30, gain: 0.3 })] },
    rail: { vol: 0.6, poly: 3, dur: 0.7, drive: 2, layers: [S('saw', { f: 2600, f1: 180, sweep: 0.12, decay: 8, gain: 0.5 }), N({ decay: 9, lp: [9000, 400], gain: 0.8 }), S('sine', { f: 75, f1: 38, decay: 6, gain: 0.9 })] },
    arc: { vol: 0.45, poly: 4, dur: 0.3, layers: [S('crackle', { density: 0.28, decay: 11, hp: 1400, gain: 1 }), S('saw', { f: 620, fm: 7, fmAmt: 3, decay: 16, gain: 0.45 })] },
    missile: { vol: 0.45, poly: 6, dur: 0.85, layers: [N({ bp: [700, 3200], bpT: 0.5, q: 0.5, env: [0.02, 0.3, 0.5, 0.45], gain: 1 }), S('sine', { f: 300, f1: 950, decay: 4, gain: 0.15 })] },
    swarm: { vol: 0.5, poly: 2, dur: 1.0, layers: [0, 0.07, 0.14, 0.21, 0.28, 0.35].map((at, i) => N({ at, dur: 0.5, bp: [900 + i * 150, 3200], bpT: 0.3, q: 0.5, env: [0.01, 0.15, 0.4, 0.3], gain: 0.7 })) },
    emp_fire: { vol: 0.5, poly: 2, dur: 0.5, layers: [S('sine', { f: 950, f1: 200, decay: 6, gain: 0.7 }), N({ bp: 1200, q: 0.4, decay: 10, gain: 0.4 })] },
    emp: { vol: 0.7, poly: 2, dur: 1.3, layers: [S('sine', { f: 130, f1: 38, decay: 3, gain: 1 }), S('saw', { f: 62, fm: 0.5, fmAmt: 2, decay: 4, lp: 450, gain: 0.5 }), N({ lp: 700, decay: 3, gain: 0.4 }), S('crackle', { density: 0.08, decay: 4, hp: 2000, gain: 0.4 })] },
    launch_special: { vol: 0.5, poly: 2, dur: 0.5, layers: [S('sine', { f: 180, f1: 620, env: [0.01, 0.2, 0.4, 0.25], gain: 0.7 }), N({ bp: [600, 2000], q: 0.5, env: [0.01, 0.2, 0.3, 0.2], gain: 0.5 })] },
    plasma: { vol: 0.5, poly: 2, dur: 0.5, layers: [S('sine', { f: 180, f1: 620, env: [0.01, 0.2, 0.4, 0.25], gain: 0.7 })] },
    plasma_boom: { vol: 0.95, poly: 2, dur: 2.2, drive: 1.8, layers: [N({ lp: [3200, 160], lpT: 1.6, decay: 2.4, gain: 1 }), S('sine', { f: 95, f1: 28, decay: 2.6, gain: 1.3 }), S('saw', { f: 55, fm: 1.5, fmAmt: 1.5, decay: 3.5, lp: 520, gain: 0.45 }), S('sine', { f: 900, f1: 120, sweep: 0.6, decay: 4, fm: 3.1, fmAmt: 1, gain: 0.25 })] },
    gravitic: { vol: 0.7, poly: 2, dur: 1.7, layers: [S('sine', { f: 60, f1: 220, curve: 'lin', env: [0.8, 0.1, 0.8, 0.6], gain: 0.9 }), N({ bp: [300, 1600], bpT: 1.2, q: 0.6, env: [0.6, 0.2, 0.6, 0.6], gain: 0.5 })] },
    beacon: { vol: 0.4, poly: 2, dur: 0.6, layers: [S('square', { f: 1250, trem: 8, env: [0.005, 0, 1, 0.05], lp: 3200, gain: 0.5 })] },
    orbital: { vol: 1.0, poly: 1, dur: 2.8, drive: 2, layers: [N({ decay: 1.5, lp: [9000, 260], lpT: 1.2, gain: 1 }), S('sine', { f: 55, f1: 24, decay: 1.8, gain: 1.3 }), S('saw', { f: 2200, f1: 90, sweep: 0.3, decay: 5, gain: 0.35 })] },
    mine: { vol: 0.4, poly: 2, dur: 0.2, layers: [S('square', { f: 700, decay: 20, lp: 2000, gain: 0.6 })] },
    mine_arm: { vol: 0.3, poly: 3, dur: 0.22, layers: [S('square', { f: 1800, dur: 0.05, env: [0.002, 0, 1, 0.01], lp: 4000, gain: 0.5 }), S('square', { at: 0.1, f: 2400, dur: 0.05, env: [0.002, 0, 1, 0.01], lp: 4000, gain: 0.5 })] },
    drones: { vol: 0.45, poly: 2, dur: 0.7, layers: [S('saw', { f: 280, f1: 560, curve: 'lin', env: [0.02, 0.3, 0.6, 0.2], lp: 1800, gain: 0.5 }), N({ bp: 3000, q: 0.5, env: [0.02, 0.3, 0.4, 0.3], gain: 0.3 })] },
    disruptor: { vol: 0.7, poly: 1, dur: 1.0, layers: [S('sine', { f: 2400, f1: 90, sweep: 0.5, decay: 3, fm: 1.7, fmAmt: 1.2, gain: 0.8 }), N({ bp: [4000, 300], bpT: 0.6, q: 0.5, decay: 3, gain: 0.5 })] },
    bloom: { vol: 0.5, poly: 2, dur: 1.1, layers: [N({ bp: 900, q: 0.4, env: [0.05, 0.4, 0.5, 0.5], gain: 0.8 }), S('crackle', { density: 0.05, decay: 2, hp: 2500, gain: 0.5 })] },
    dry: { vol: 0.3, poly: 2, dur: 0.05, layers: [N({ decay: 90, hp: 2000 })] },
    overheat: { vol: 0.45, poly: 1, dur: 0.8, layers: [N({ hp: 3000, env: [0.01, 0.2, 0.4, 0.45], gain: 0.8 }), S('sine', { f: 420, f1: 180, decay: 4, gain: 0.4 })] },
    // ---------------- explosions ----------------
    explode_small: { vol: 0.5, poly: 6, dur: 0.6, drive: 1.5, layers: [N({ lp: [4500, 280], lpT: 0.4, decay: 7, gain: 1 }), S('sine', { f: 130, f1: 40, decay: 9, gain: 0.9 })] },
    explode_med: { vol: 0.7, poly: 5, dur: 1.15, drive: 1.6, layers: [N({ lp: [3200, 180], lpT: 0.8, decay: 4, gain: 1 }), S('sine', { f: 95, f1: 30, decay: 4.5, gain: 1.1 }), S('crackle', { density: 0.05, decay: 3, hp: 2000, gain: 0.35 })] },
    explode_big: { vol: 0.9, poly: 3, dur: 2.3, drive: 1.8, layers: [N({ lp: [2600, 110], lpT: 1.6, decay: 2, gain: 1 }), S('sine', { f: 72, f1: 22, decay: 2.3, gain: 1.3 }), S('crackle', { density: 0.05, decay: 1.8, hp: 1600, gain: 0.4 }), N({ at: 0.22, dur: 1.8, lp: 700, decay: 2.5, gain: 0.5 })] },
    eruption: { vol: 0.8, poly: 2, dur: 2.0, drive: 1.6, layers: [N({ lp: [2000, 150], decay: 2, gain: 1 }), S('sine', { f: 60, f1: 25, decay: 2, gain: 1.2 }), S('crackle', { density: 0.12, decay: 1.2, hp: 1200, gain: 0.6 })] },
    // ---------------- craft systems ----------------
    shield_hit: { vol: 0.35, poly: 4, dur: 0.28, layers: [S('sine', { f: 1900, f1: 900, decay: 16, fm: 1.41, fmAmt: 0.8, gain: 0.6 }), N({ hp: 4000, decay: 30, gain: 0.3 })] },
    shield_down: { vol: 0.55, poly: 1, dur: 0.9, layers: [S('saw', { f: 820, f1: 90, decay: 3, lp: 2000, gain: 0.6 }), S('sine', { f: 420, f1: 70, decay: 3, gain: 0.6 })] },
    shield_up: { vol: 0.4, poly: 1, dur: 0.7, layers: [S('sine', { f: 300, f1: 1250, curve: 'lin', env: [0.05, 0.2, 0.6, 0.3], gain: 0.5 }), S('sine', { f: 600, f1: 2500, curve: 'lin', env: [0.05, 0.2, 0.6, 0.3], gain: 0.25 })] },
    hull_hit: { vol: 0.55, poly: 4, dur: 0.38, drive: 2, layers: [N({ lp: 2600, decay: 14, gain: 1 }), S('square', { f: 190, f1: 90, decay: 18, lp: 1000, gain: 0.6 }), S('sine', { f: 2650, decay: 26, gain: 0.18 })] },
    scrape: { vol: 0.5, poly: 2, dur: 0.5, layers: [N({ bp: 1800, q: 0.2, env: [0.01, 0.1, 0.6, 0.3], gain: 1 }), S('sine', { f: 900, fm: 3.3, fmAmt: 2, decay: 6, gain: 0.3 })] },
    alarm: { vol: 0.35, poly: 1, dur: 0.95, layers: [S('square', { f: 880, dur: 0.2, env: [0.005, 0, 1, 0.01], lp: 3000, gain: 0.5 }), S('square', { at: 0.25, f: 660, dur: 0.2, env: [0.005, 0, 1, 0.01], lp: 3000, gain: 0.5 }), S('square', { at: 0.5, f: 880, dur: 0.2, env: [0.005, 0, 1, 0.01], lp: 3000, gain: 0.5 }), S('square', { at: 0.75, f: 660, dur: 0.2, env: [0.005, 0, 1, 0.01], lp: 3000, gain: 0.5 })] },
    warning: { vol: 0.3, poly: 1, dur: 0.4, layers: [S('square', { f: 1000, dur: 0.1, env: [0.005, 0, 1, 0.01], lp: 3500, gain: 0.5 }), S('square', { at: 0.18, f: 1000, dur: 0.1, env: [0.005, 0, 1, 0.01], lp: 3500, gain: 0.5 })] },
    lock_tick: { vol: 0.18, poly: 2, dur: 0.04, layers: [S('square', { f: 2200, decay: 60, lp: 5000 })] },
    lock: { vol: 0.35, poly: 2, dur: 0.25, layers: [S('square', { f: 1800, dur: 0.07, env: [0.002, 0, 1, 0.01], lp: 4500, gain: 0.5 }), S('square', { at: 0.09, f: 2600, dur: 0.1, env: [0.002, 0, 1, 0.02], lp: 4500, gain: 0.5 })] },
    lock_warn: { vol: 0.25, poly: 1, dur: 0.09, layers: [S('square', { f: 1300, decay: 20, lp: 3000 })] },
    denied: { vol: 0.3, poly: 1, dur: 0.18, layers: [S('square', { f: 160, env: [0.005, 0, 1, 0.02], lp: 1200 })] },
    repair: { vol: 0.4, poly: 1, dur: 1.2, layers: [S('saw', { f: 200, f1: 420, curve: 'lin', trem: 20, env: [0.05, 0.2, 0.7, 0.3], lp: 1600, gain: 0.6 }), N({ bp: 5000, q: 0.5, env: [0.05, 0.3, 0.5, 0.3], gain: 0.25 })] },
    thruster: { vol: 0.18, poly: 3, dur: 0.2, layers: [N({ bp: 2200, q: 0.5, decay: 16 })] },
    // ---------------- pickups / interaction ----------------
    pickup: { vol: 0.4, poly: 3, dur: 0.42, layers: [S('sine', { f: 880, dur: 0.18, decay: 12, gain: 0.5 }), S('sine', { at: 0.07, f: 1320, dur: 0.18, decay: 12, gain: 0.5 }), S('sine', { at: 0.14, f: 1760, dur: 0.25, decay: 10, gain: 0.5 }), S('tri', { at: 0.14, f: 880, dur: 0.25, decay: 10, gain: 0.3 })] },
    pickup_salvage: { vol: 0.35, poly: 3, dur: 0.3, layers: [S('sine', { f: 2400, fm: 2.7, fmAmt: 0.6, decay: 14, gain: 0.6 }), S('sine', { at: 0.05, f: 3200, decay: 16, gain: 0.4 })] },
    objective: { vol: 0.45, poly: 1, dur: 1.3, layers: [S('tri', { f: 523, env: [0.01, 0.3, 0.5, 0.6], gain: 0.4 }), S('tri', { at: 0.09, f: 659, env: [0.01, 0.3, 0.5, 0.6], gain: 0.4 }), S('tri', { at: 0.18, f: 784, env: [0.01, 0.3, 0.5, 0.6], gain: 0.4 }), S('sine', { at: 0.27, f: 1046, env: [0.01, 0.3, 0.5, 0.6], gain: 0.35 })] },
    objective_new: { vol: 0.4, poly: 1, dur: 0.6, layers: [S('sine', { f: 660, dur: 0.25, decay: 8, gain: 0.5 }), S('sine', { at: 0.12, f: 990, dur: 0.4, decay: 7, gain: 0.5 })] },
    fail_cue: { vol: 0.45, poly: 1, dur: 1.0, layers: [S('saw', { f: 300, f1: 140, decay: 2.5, lp: 1200, gain: 0.6 }), S('saw', { f: 356, f1: 168, decay: 2.5, lp: 1200, gain: 0.4 })] },
    confirm: { vol: 0.3, poly: 1, dur: 0.2, layers: [S('sine', { f: 1200, dur: 0.08, decay: 20, gain: 0.5 }), S('sine', { at: 0.07, f: 1600, dur: 0.1, decay: 20, gain: 0.5 })] },
    console: { vol: 0.35, poly: 1, dur: 0.6, layers: [900, 1400, 1100, 1800, 2200].map((f, i) => S('square', { at: i * 0.09, f, dur: 0.06, env: [0.002, 0, 1, 0.01], lp: 4000, gain: 0.4 })) },
    scan_done: { vol: 0.4, poly: 1, dur: 0.6, layers: [S('sine', { f: 1000, f1: 2200, curve: 'lin', dur: 0.3, env: [0.01, 0.1, 0.8, 0.1], gain: 0.4 }), S('sine', { at: 0.3, f: 2200, decay: 9, gain: 0.4 })] },
    beam_up: { vol: 0.35, poly: 3, dur: 0.6, layers: [S('sine', { f: 400, f1: 1700, curve: 'lin', env: [0.02, 0.2, 0.6, 0.3], fm: 3, fmAmt: 0.3, gain: 0.5 }), N({ hp: 6000, env: [0.02, 0.2, 0.4, 0.3], gain: 0.15 })] },
    cargo_up: { vol: 0.4, poly: 2, dur: 0.7, layers: [S('saw', { f: 150, f1: 320, curve: 'lin', env: [0.02, 0.3, 0.6, 0.3], lp: 900, gain: 0.6 }), S('sine', { f: 600, f1: 1200, curve: 'lin', env: [0.02, 0.3, 0.5, 0.3], gain: 0.3 })] },
    dropoff: { vol: 0.35, poly: 2, dur: 0.4, layers: [S('sine', { f: 1200, f1: 600, decay: 8, gain: 0.5 }), N({ hp: 4000, decay: 12, gain: 0.2 })] },
    // ---------------- enemy weapons ----------------
    enemy_shot: { vol: 0.25, poly: 8, dur: 0.14, layers: [S('square', { f: 950, f1: 220, sweep: 0.08, decay: 28, lp: 2800, gain: 0.6 }), N({ decay: 50, lp: 3000, gain: 0.3 })] },
    enemy_plasma: { vol: 0.28, poly: 6, dur: 0.25, layers: [S('sine', { f: 620, f1: 150, decay: 13, fm: 1.5, fmAmt: 1.2, gain: 0.7 })] },
    enemy_missile: { vol: 0.4, poly: 4, dur: 0.8, layers: [N({ bp: [500, 1800], q: 0.5, env: [0.02, 0.3, 0.5, 0.4], gain: 1 }), S('saw', { f: 300, f1: 600, decay: 3, lp: 1500, gain: 0.2 })] },
    artillery: { vol: 0.45, poly: 3, dur: 0.9, layers: [S('sine', { f: 70, f1: 32, decay: 6, gain: 1 }), N({ lp: 600, decay: 5, gain: 0.6 })] },
    flak: { vol: 0.3, poly: 5, dur: 0.35, layers: [N({ lp: 1800, decay: 12, gain: 1 }), S('sine', { f: 200, f1: 60, decay: 12, gain: 0.6 })] },
    beam_charge: { vol: 0.35, poly: 3, dur: 0.95, layers: [S('sine', { f: 200, f1: 1500, curve: 'lin', env: [0.05, 0.1, 0.9, 0.05], gain: 0.5 }), S('saw', { f: 100, f1: 750, curve: 'lin', env: [0.05, 0.1, 0.9, 0.05], lp: 1600, gain: 0.25 })] },
    beam_fire: { vol: 0.5, poly: 3, dur: 0.55, layers: [S('saw', { f: 120, fm: 3, fmAmt: 1.5, env: [0.005, 0.1, 0.8, 0.2], lp: 2400, gain: 0.7 }), N({ bp: 2000, q: 0.5, env: [0.005, 0.1, 0.6, 0.2], gain: 0.4 })] },
    zap: { vol: 0.4, poly: 4, dur: 0.25, layers: [S('crackle', { density: 0.3, decay: 12, hp: 1500 }), S('saw', { f: 1500, fm: 5, fmAmt: 2, decay: 18, gain: 0.3 })] },
    spit: { vol: 0.3, poly: 5, dur: 0.25, layers: [N({ bp: [2200, 700], q: 0.5, decay: 12, gain: 1 }), S('sine', { f: 420, f1: 180, fm: 2.2, fmAmt: 1, decay: 14, gain: 0.4 })] },
    bomb_drop: { vol: 0.35, poly: 3, dur: 0.6, layers: [S('sine', { f: 1600, f1: 400, curve: 'lin', env: [0.02, 0.1, 0.7, 0.1], gain: 0.4 })] },
    spore_launch: { vol: 0.35, poly: 3, dur: 0.4, layers: [N({ lp: 650, decay: 8, gain: 1 }), S('sine', { f: 160, f1: 80, fm: 1.3, fmAmt: 1.5, decay: 8, gain: 0.6 })] },
    // ---------------- creatures / units ----------------
    squelch: { vol: 0.35, poly: 5, dur: 0.35, layers: [N({ lp: 900, decay: 10, gain: 1 }), S('sine', { f: 320, f1: 80, fm: 1.3, fmAmt: 2, decay: 9, gain: 0.6 })] },
    splash: { vol: 0.35, poly: 4, dur: 0.6, layers: [N({ lp: [5000, 700], decay: 6, gain: 1 }), S('crackle', { density: 0.1, decay: 6, hp: 3000, gain: 0.4 })] },
    bite: { vol: 0.35, poly: 5, dur: 0.15, layers: [N({ hp: 1000, decay: 26, gain: 1 }), S('square', { f: 120, decay: 30, lp: 800, gain: 0.5 })] },
    screech: { vol: 0.28, poly: 4, dur: 0.38, layers: [S('saw', { f: 1250, f1: 2100, vib: 30, vibAmt: 0.08, env: [0.02, 0.1, 0.6, 0.15], bp: 1900, q: 0.4, gain: 1 })] },
    roar: { vol: 0.6, poly: 2, dur: 1.0, drive: 2, layers: [S('saw', { f: 92, f1: 58, fm: 1.5, fmAmt: 2, env: [0.05, 0.2, 0.7, 0.4], lp: 900, gain: 1 }), N({ lp: 600, env: [0.05, 0.2, 0.6, 0.4], gain: 0.5 })] },
    creature_die: { vol: 0.35, poly: 5, dur: 0.6, layers: [S('saw', { f: 720, f1: 140, vib: 20, vibAmt: 0.1, decay: 5, bp: 1300, q: 0.5, gain: 1 }), N({ lp: 1500, decay: 10, gain: 0.5 })] },
    creature_die_big: { vol: 0.6, poly: 3, dur: 1.2, drive: 1.5, layers: [S('saw', { f: 300, f1: 55, fm: 1.4, fmAmt: 1.5, decay: 2.5, lp: 900, gain: 1 }), N({ lp: 1000, decay: 4, gain: 0.6 })] },
    bug_die: { vol: 0.3, poly: 6, dur: 0.3, layers: [S('square', { f: 2100, f1: 600, decay: 22, lp: 4000, gain: 0.6 }), S('crackle', { density: 0.2, decay: 14, hp: 2000, gain: 0.6 })] },
    glass_die: { vol: 0.45, poly: 4, dur: 0.8, layers: [S('sine', { f: 3100, decay: 6, gain: 0.4 }), S('sine', { f: 4300, decay: 7, gain: 0.3 }), S('sine', { f: 5200, decay: 8, gain: 0.25 }), N({ hp: 4000, decay: 8, gain: 0.5 }), S('crackle', { density: 0.2, decay: 6, hp: 3000, gain: 0.6 })] },
    mech_die_small: { vol: 0.45, poly: 5, dur: 0.6, drive: 1.5, layers: [N({ lp: [4000, 300], decay: 7, gain: 1 }), S('sine', { f: 140, f1: 40, decay: 9, gain: 0.8 }), S('sine', { f: 2400, decay: 18, gain: 0.15 })] },
    burrow: { vol: 0.5, poly: 3, dur: 0.9, layers: [N({ lp: 320, env: [0.05, 0.3, 0.5, 0.4], gain: 1 }), S('sine', { f: 55, f1: 40, env: [0.05, 0.3, 0.5, 0.4], gain: 0.8 })] },
    crate_break: { vol: 0.35, poly: 4, dur: 0.3, layers: [N({ lp: 2200, decay: 18, gain: 1 }), S('square', { f: 300, decay: 28, lp: 1200, gain: 0.4 })] },
    // ---------------- environment ----------------
    rumble: { vol: 0.5, poly: 2, dur: 1.6, layers: [N({ lp: 160, env: [0.3, 0.4, 0.7, 0.6], gain: 1 })] },
    ice_crack: { vol: 0.55, poly: 3, dur: 0.7, layers: [S('crackle', { density: 0.4, decay: 9, hp: 2000, gain: 1 }), S('sine', { f: 3000, f1: 900, decay: 18, gain: 0.4 }), N({ lp: 400, decay: 5, gain: 0.5 })] },
    ice_creak: { vol: 0.4, poly: 2, dur: 0.7, layers: [S('saw', { f: 210, f1: 150, vib: 8, vibAmt: 0.05, bp: 900, q: 0.4, env: [0.05, 0.2, 0.6, 0.3], gain: 1 })] },
    thunder: { vol: 0.8, poly: 2, dur: 2.6, drive: 1.6, layers: [S('crackle', { density: 0.3, decay: 8, hp: 1000, gain: 1 }), N({ lp: [3200, 90], lpT: 2, decay: 1.2, gain: 1 })] },
    thunder_far: { vol: 0.45, poly: 2, dur: 2.2, layers: [N({ lp: 280, env: [0.2, 0.5, 0.6, 1.2], gain: 1 })] },
    thump: { vol: 0.7, poly: 2, dur: 0.8, drive: 1.5, layers: [S('sine', { f: 72, f1: 34, decay: 6, gain: 1.2 }), N({ lp: 320, decay: 6, gain: 0.6 })] },
    // ---------------- UI / radio ----------------
    ui_click: { vol: 0.3, poly: 3, dur: 0.05, layers: [S('square', { f: 1250, decay: 60, lp: 4200 })] },
    ui_hover: { vol: 0.12, poly: 3, dur: 0.04, layers: [S('sine', { f: 1900, decay: 70 })] },
    ui_buy: { vol: 0.45, poly: 2, dur: 0.6, layers: [S('tri', { f: 660, dur: 0.3, decay: 8, gain: 0.5 }), S('tri', { at: 0.08, f: 880, dur: 0.3, decay: 8, gain: 0.5 }), S('sine', { at: 0.16, f: 1320, dur: 0.4, decay: 7, gain: 0.5 }), S('sine', { f: 2400, fm: 2.7, fmAmt: 0.6, decay: 14, gain: 0.3 })] },
    ui_back: { vol: 0.25, poly: 2, dur: 0.12, layers: [S('square', { f: 900, f1: 500, decay: 30, lp: 3000 })] },
    radio_on: { vol: 0.22, poly: 2, dur: 0.12, layers: [N({ bp: 2500, q: 0.4, decay: 25, gain: 1 }), S('square', { f: 1500, dur: 0.04, env: [0.002, 0, 1, 0.01], lp: 4000, gain: 0.4 })] },
    radio_off: { vol: 0.2, poly: 2, dur: 0.15, layers: [N({ bp: 2500, q: 0.4, decay: 18, gain: 1 })] },
  };
})(window.AS);
