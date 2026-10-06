/* WYRMCROWN — sound effect manifest (data only).
 * Synthesised at start-up by the shared synth (alien-strike/src/audio/synth.js).
 * AUDIO HOOK: to use a recorded asset instead, set file: 'audio/sfx/<name>.ogg'
 * on an entry — it loads when served over http(s), with the recipe as fallback.
 * vol = playback gain, poly = max simultaneous voices, loop = looping sound. */
'use strict';
(function (AS) {
  AS.Data = AS.Data || {};
  const N = (o) => Object.assign({ type: 'noise' }, o);
  const S = (type, o) => Object.assign({ type }, o);
  const ON = [0.001, 0, 1, 0.001];
  AS.Data.sfx = {
    // ---------------- the dragon ----------------
    wing_beat: { vol: 0.42, poly: 6, dur: 0.5, layers: [N({ bp: [240, 640], bpT: 0.25, q: 0.45, env: [0.04, 0.18, 0.35, 0.22], gain: 1 }), S('sine', { f: 72, f1: 46, env: [0.03, 0.12, 0.2, 0.2], gain: 0.55 }), N({ lp: 380, env: [0.06, 0.2, 0.2, 0.2], gain: 0.4 })] },
    dragon_roar: { vol: 0.75, poly: 2, dur: 1.9, drive: 2.2, layers: [S('saw', { f: 150, f1: 92, sweep: 1.6, vib: 9, vibAmt: 0.05, fm: 0.5, fmAmt: 0.6, env: [0.12, 0.5, 0.75, 0.7], bp: [500, 900], bpT: 1.2, q: 0.8, gain: 1 }), N({ bp: [700, 1600], bpT: 1.4, q: 0.5, env: [0.08, 0.5, 0.6, 0.7], gain: 0.6 }), S('sine', { f: 62, f1: 44, env: [0.15, 0.6, 0.6, 0.6], gain: 0.7 })] },
    dragon_roar_pain: { vol: 0.7, poly: 2, dur: 1.4, drive: 2, layers: [S('saw', { f: 340, f1: 130, sweep: 1.1, vib: 12, vibAmt: 0.06, env: [0.03, 0.4, 0.5, 0.6], bp: [1400, 600], bpT: 1, q: 0.9, gain: 1 }), N({ bp: [1800, 700], bpT: 1, q: 0.5, env: [0.02, 0.4, 0.4, 0.5], gain: 0.5 })] },
    dragon_hurt: { vol: 0.45, poly: 3, dur: 0.42, drive: 2, layers: [S('saw', { f: 210, f1: 120, decay: 7, bp: 700, q: 0.8, gain: 1 }), N({ lp: 1600, decay: 12, gain: 0.6 })] },
    crash_heavy: { vol: 0.9, poly: 2, dur: 2.0, drive: 1.8, layers: [N({ lp: [2400, 120], lpT: 1.4, decay: 2.2, gain: 1 }), S('sine', { f: 64, f1: 24, decay: 2.2, gain: 1.4 }), S('crackle', { density: 0.06, decay: 2, hp: 1400, gain: 0.5 })] },
    thud: { vol: 0.5, poly: 3, dur: 0.4, layers: [S('sine', { f: 110, f1: 45, decay: 10, gain: 1 }), N({ lp: 900, decay: 14, gain: 0.6 })] },
    eat_crunch: { vol: 0.55, poly: 2, dur: 0.75, layers: [0, 0.18, 0.36, 0.52].map((at, i) => S('crackle', { at, dur: 0.16, density: 0.4, decay: 22, lp: 2600 - i * 200, gain: 1 })).concat([S('sine', { f: 140, f1: 70, decay: 10, gain: 0.5 }), S('sine', { at: 0.36, f: 120, f1: 60, decay: 10, gain: 0.4 })]) },
    // eating: a bony crunch, a wet squelch, then a big swallow
    bone_crunch: { vol: 0.8, poly: 3, dur: 0.5, drive: 1.6, layers: [S('crackle', { dur: 0.2, density: 0.7, decay: 18, lp: 3400, gain: 1.1 }), N({ bp: [2000, 600], bpT: 0.14, q: 0.8, env: [0.005, 0.05, 0.3, 0.12], gain: 0.8 }), S('crackle', { at: 0.11, dur: 0.16, density: 0.55, decay: 20, lp: 2600, gain: 0.9 }), S('sine', { f: 130, f1: 52, decay: 14, gain: 0.7 })] },
    squelch: { vol: 0.65, poly: 3, dur: 0.42, layers: [N({ bp: [1500, 240], bpT: 0.26, q: 2.4, env: [0.01, 0.06, 0.55, 0.22], gain: 1 }), S('sine', { f: 280, f1: 85, vib: 26, vibAmt: 0.3, env: [0.01, 0.05, 0.5, 0.2], gain: 0.55 })] },
    swallow: { vol: 0.8, poly: 2, dur: 0.65, layers: [S('sine', { f: 230, f1: 68, sweep: 0.22, env: [0.02, 0.08, 0.6, 0.16], gain: 1 }), N({ lp: [800, 180], lpT: 0.3, env: [0.02, 0.1, 0.45, 0.2], gain: 0.5 }), S('sine', { at: 0.32, f: 160, f1: 58, decay: 9, gain: 0.55 })] },
    // under a dragon's words: a throaty rumble
    dragon_growl: { vol: 0.55, poly: 2, dur: 1.5, drive: 2, layers: [S('saw', { f: 68, f1: 50, vib: 7, vibAmt: 0.14, env: [0.12, 0.4, 0.75, 0.6], lp: 520, gain: 1 }), N({ lp: [520, 180], lpT: 1.3, env: [0.12, 0.4, 0.6, 0.6], gain: 0.6 })] },
    // stand-in voices when the browser has no speech voices: syllable burbles
    babble_hi: { vol: 0.32, poly: 4, dur: 0.12, layers: [S('tri', { f: 520, f1: 430, vib: 30, vibAmt: 0.08, env: [0.01, 0.03, 0.6, 0.05], gain: 1 }), S('sine', { f: 1040, f1: 860, env: [0.01, 0.03, 0.4, 0.05], gain: 0.35 })] },
    babble_lo: { vol: 0.5, poly: 4, dur: 0.2, drive: 1.8, layers: [S('saw', { f: 92, f1: 70, vib: 9, vibAmt: 0.12, env: [0.02, 0.06, 0.7, 0.08], lp: 700, gain: 1 }), N({ lp: 400, env: [0.02, 0.06, 0.4, 0.08], gain: 0.4 })] },
    gulp: { vol: 0.45, poly: 2, dur: 0.35, layers: [S('sine', { f: 320, f1: 110, sweep: 0.2, decay: 9, gain: 0.8 }), N({ lp: 500, decay: 12, gain: 0.3 })] },
    snatch: { vol: 0.5, poly: 2, dur: 0.4, layers: [N({ bp: [500, 2400], bpT: 0.2, q: 0.6, env: [0.01, 0.12, 0.3, 0.2], gain: 0.8 }), S('sine', { f: 160, f1: 90, decay: 10, gain: 0.6 })] },
    air_rush: { vol: 0.42, loop: true, dur: 1.6, layers: [N({ bp: 650, q: 0.35, env: ON, trem: 0.7, gain: 1 }), N({ hp: 2400, env: ON, gain: 0.25 })] },
    // ---------------- breaths (loops while held) ----------------
    breath_fire: { vol: 0.5, loop: true, dur: 1.2, layers: [N({ lp: 1500, env: ON, gain: 1 }), S('crackle', { density: 0.09, env: ON, hp: 900, gain: 0.7 }), N({ bp: 260, q: 0.6, env: ON, trem: 7, gain: 0.5 })] },
    breath_magic: { vol: 0.45, loop: true, dur: 1.0, layers: [N({ lp: 2200, env: ON, gain: 0.8 }), S('sine', { f: 880, fm: 1.5, fmAmt: 0.4, env: ON, trem: 9, gain: 0.25 }), S('sine', { f: 1320, env: ON, trem: 13, gain: 0.15 })] },
    breath_frost: { vol: 0.45, loop: true, dur: 1.0, layers: [N({ hp: 1800, env: ON, gain: 0.9 }), N({ bp: 5200, q: 0.6, env: ON, trem: 11, gain: 0.4 }), S('sine', { f: 2400, fm: 2.7, fmAmt: 0.5, env: ON, trem: 17, gain: 0.08 })] },
    breath_necro: { vol: 0.5, loop: true, dur: 1.2, layers: [N({ lp: 900, env: ON, gain: 0.9 }), S('saw', { f: 82, fm: 0.5, fmAmt: 1.2, env: ON, lp: 600, gain: 0.4 }), N({ bp: 1400, q: 1.2, env: ON, trem: 5, gain: 0.35 })] },
    breath_start: { vol: 0.55, poly: 2, dur: 0.55, layers: [N({ bp: [300, 1800], bpT: 0.3, q: 0.5, env: [0.02, 0.2, 0.4, 0.25], gain: 1 }), S('sine', { f: 90, f1: 55, decay: 6, gain: 0.6 })] },
    // ---------------- the wizard ----------------
    bolt_cast: { vol: 0.26, poly: 6, dur: 0.24, layers: [S('sine', { f: 520, f1: 1500, sweep: 0.08, decay: 18, fm: 2.01, fmAmt: 0.6, gain: 0.7 }), N({ hp: 3500, decay: 40, gain: 0.25 }), S('tri', { f: 1040, f1: 2400, sweep: 0.06, decay: 26, gain: 0.25 })] },
    bolt_hit: { vol: 0.3, poly: 6, dur: 0.3, layers: [S('sine', { f: 2200, f1: 700, decay: 16, fm: 1.4, fmAmt: 0.8, gain: 0.5 }), S('crackle', { density: 0.2, decay: 18, hp: 2500, gain: 0.5 })] },
    spell_lightning: { vol: 0.8, poly: 2, dur: 1.8, drive: 2, layers: [S('crackle', { density: 0.35, decay: 9, hp: 1200, gain: 1 }), N({ at: 0.06, dur: 1.7, lp: [3000, 120], lpT: 1.2, decay: 2.2, gain: 0.9 }), S('sine', { at: 0.06, f: 60, f1: 30, decay: 2.5, gain: 1 })] },
    frost_nova: { vol: 0.6, poly: 2, dur: 1.2, layers: [N({ hp: 2500, decay: 4, gain: 0.8 }), S('sine', { f: 2600, fm: 2.4, fmAmt: 1, decay: 4, gain: 0.3 }), S('sine', { at: 0.05, f: 3400, decay: 5, gain: 0.2 })] },
    summon: { vol: 0.55, poly: 2, dur: 1.4, layers: [S('sine', { f: 220, f1: 660, curve: 'lin', env: [0.3, 0.3, 0.6, 0.5], gain: 0.5 }), S('sine', { f: 330, f1: 990, curve: 'lin', env: [0.3, 0.3, 0.6, 0.5], gain: 0.3 }), N({ bp: [600, 3000], bpT: 1, q: 0.5, env: [0.3, 0.3, 0.5, 0.5], gain: 0.4 })] },
    // ---------------- impacts / destruction ----------------
    impact_fire: { vol: 0.35, poly: 6, dur: 0.4, layers: [N({ lp: [3000, 400], lpT: 0.3, decay: 9, gain: 1 }), S('crackle', { density: 0.12, decay: 8, hp: 1500, gain: 0.5 })] },
    explode_small: { vol: 0.5, poly: 6, dur: 0.6, drive: 1.5, layers: [N({ lp: [4500, 280], lpT: 0.4, decay: 7, gain: 1 }), S('sine', { f: 130, f1: 40, decay: 9, gain: 0.9 })] },
    explode_med: { vol: 0.7, poly: 5, dur: 1.15, drive: 1.6, layers: [N({ lp: [3200, 180], lpT: 0.8, decay: 4, gain: 1 }), S('sine', { f: 95, f1: 30, decay: 4.5, gain: 1.1 }), S('crackle', { density: 0.05, decay: 3, hp: 2000, gain: 0.35 })] },
    explode_big: { vol: 0.9, poly: 3, dur: 2.3, drive: 1.8, layers: [N({ lp: [2600, 110], lpT: 1.6, decay: 2, gain: 1 }), S('sine', { f: 72, f1: 22, decay: 2.3, gain: 1.3 }), S('crackle', { density: 0.05, decay: 1.8, hp: 1600, gain: 0.4 }), N({ at: 0.22, dur: 1.8, lp: 700, decay: 2.5, gain: 0.5 })] },
    // thunder: a sharp crack that rolls away into a long low rumble
    thunder: { vol: 0.9, poly: 2, dur: 3.6, drive: 1.4, layers: [N({ lp: [5000, 900], lpT: 0.12, decay: 0.25, gain: 0.8 }), N({ at: 0.05, lp: [900, 90], lpT: 2.6, env: [0.08, 0.5, 0.7, 2.6], gain: 1.2 }), S('crackle', { density: 0.05, decay: 1.4, lp: 1200, gain: 0.5 }), S('sine', { f: 48, f1: 26, decay: 2.8, gain: 0.9 })] },
    collapse: { vol: 0.85, poly: 2, dur: 2.4, drive: 1.5, layers: [N({ lp: [1800, 140], lpT: 2, env: [0.05, 0.6, 0.6, 1.4], gain: 1 }), S('crackle', { density: 0.18, decay: 1.6, lp: 3000, gain: 0.8 }), S('sine', { f: 58, f1: 30, decay: 1.8, gain: 1 })] },
    stone_hit: { vol: 0.6, poly: 4, dur: 0.9, drive: 1.6, layers: [S('sine', { f: 90, f1: 36, decay: 6, gain: 1.2 }), N({ lp: [2400, 200], lpT: 0.5, decay: 5, gain: 0.9 }), S('crackle', { at: 0.04, density: 0.15, decay: 5, lp: 3500, gain: 0.6 })] },
    burning: { vol: 0.25, loop: true, dur: 1.4, layers: [S('crackle', { density: 0.05, env: ON, hp: 700, gain: 1 }), N({ lp: 500, env: ON, gain: 0.4 })] },
    freeze: { vol: 0.4, poly: 4, dur: 0.6, layers: [N({ hp: 4000, decay: 7, gain: 0.7 }), S('sine', { f: 3000, fm: 2.7, fmAmt: 0.6, decay: 8, gain: 0.25 })] },
    shatter: { vol: 0.45, poly: 4, dur: 0.6, layers: [S('crackle', { density: 0.4, decay: 9, hp: 3000, gain: 1 }), S('sine', { f: 2600, decay: 10, gain: 0.25 }), S('sine', { f: 3700, decay: 12, gain: 0.2 })] },
    // ---------------- weapons of the realm ----------------
    arrow: { vol: 0.28, poly: 8, dur: 0.32, layers: [S('tri', { f: 330, f1: 260, decay: 30, gain: 0.6 }), N({ at: 0.02, dur: 0.28, bp: [2400, 4200], bpT: 0.25, q: 0.8, decay: 9, gain: 0.5 })] },
    arrow_hit: { vol: 0.3, poly: 8, dur: 0.12, layers: [N({ lp: 2200, decay: 45, gain: 1 }), S('sine', { f: 600, f1: 300, decay: 40, gain: 0.3 })] },
    ballista: { vol: 0.6, poly: 3, dur: 0.7, drive: 1.6, layers: [S('tri', { f: 140, f1: 90, decay: 9, gain: 1 }), S('square', { f: 70, decay: 14, lp: 500, gain: 0.5 }), N({ at: 0.03, dur: 0.6, bp: [900, 2600], bpT: 0.5, q: 0.6, decay: 4, gain: 0.6 })] },
    catapult: { vol: 0.6, poly: 2, dur: 1.0, layers: [N({ bp: [300, 800], q: 0.9, env: [0.05, 0.2, 0.4, 0.3], gain: 0.7 }), S('sine', { at: 0.25, f: 90, f1: 50, decay: 9, gain: 1 }), N({ at: 0.25, dur: 0.6, lp: 1200, decay: 10, gain: 0.7 })] },
    sword_clash: { vol: 0.28, poly: 6, dur: 0.35, layers: [S('sine', { f: 1850, fm: 2.41, fmAmt: 1.2, decay: 12, gain: 0.6 }), N({ hp: 2500, decay: 30, gain: 0.5 })] },
    troop_die: { vol: 0.3, poly: 5, dur: 0.4, layers: [S('saw', { f: 260, f1: 140, decay: 9, bp: 900, q: 1, gain: 0.8 }), N({ lp: 1200, decay: 14, gain: 0.4 })] },
    bones: { vol: 0.35, poly: 5, dur: 0.45, layers: [S('crackle', { density: 0.35, decay: 9, bp: 2200, q: 0.6, gain: 1 }), N({ hp: 3000, decay: 20, gain: 0.3 })] },
    monster_roar: { vol: 0.6, poly: 2, dur: 1.2, drive: 2.4, layers: [S('saw', { f: 95, f1: 70, vib: 7, vibAmt: 0.08, env: [0.08, 0.4, 0.7, 0.4], lp: 800, gain: 1 }), N({ bp: 500, q: 0.6, env: [0.08, 0.4, 0.5, 0.4], gain: 0.5 })] },
    giant_stomp: { vol: 0.65, poly: 3, dur: 0.6, layers: [S('sine', { f: 70, f1: 30, decay: 7, gain: 1.3 }), N({ lp: 600, decay: 9, gain: 0.6 })] },
    // ---------------- animals and villagers ----------------
    cow: { vol: 0.32, poly: 2, dur: 1.1, layers: [S('saw', { f: 138, f1: 112, sweep: 0.9, vib: 4, vibAmt: 0.02, env: [0.12, 0.4, 0.8, 0.35], lp: [500, 1100], lpT: 0.5, gain: 1 }), S('saw', { f: 276, f1: 224, sweep: 0.9, env: [0.15, 0.4, 0.6, 0.35], bp: 900, q: 1.5, gain: 0.3 })] },
    sheep: { vol: 0.3, poly: 3, dur: 0.7, layers: [S('saw', { f: 390, f1: 350, trem: 17, env: [0.05, 0.2, 0.7, 0.25], bp: 1300, q: 1.2, gain: 1 }), S('saw', { f: 780, trem: 17, env: [0.05, 0.2, 0.5, 0.25], bp: 2600, q: 1.5, gain: 0.35 })] },
    goat: { vol: 0.3, poly: 3, dur: 0.6, layers: [S('saw', { f: 540, f1: 480, trem: 23, env: [0.03, 0.2, 0.6, 0.2], bp: 1700, q: 1.2, gain: 1 })] },
    horse: { vol: 0.32, poly: 2, dur: 1.1, layers: [S('saw', { f: 640, f1: 420, sweep: 1, vib: 9, vibAmt: 0.09, env: [0.04, 0.5, 0.6, 0.4], bp: 1600, q: 1, gain: 1 }), N({ bp: 2000, q: 1, env: [0.04, 0.3, 0.3, 0.3], gain: 0.2 })] },
    boar: { vol: 0.32, poly: 3, dur: 0.5, layers: [N({ bp: 420, q: 1.2, trem: 32, env: [0.02, 0.2, 0.6, 0.15], gain: 1 }), S('saw', { f: 92, trem: 32, env: [0.02, 0.2, 0.6, 0.15], lp: 600, gain: 0.5 })] },
    wolf_howl: { vol: 0.35, poly: 2, dur: 2.2, layers: [S('sine', { f: 420, f1: 690, sweep: 0.8, vib: 5, vibAmt: 0.015, env: [0.3, 0.6, 0.8, 0.9], gain: 0.8 }), S('sine', { f: 840, f1: 1380, sweep: 0.8, env: [0.3, 0.6, 0.6, 0.9], gain: 0.12 })] },
    bird_chirp: { vol: 0.16, poly: 4, dur: 0.42, layers: [0, 0.11, 0.24].map((at, i) => S('sine', { at, dur: 0.08, f: 3300 + i * 300, f1: 4300 + i * 200, sweep: 0.06, env: [0.005, 0.03, 0.4, 0.03], gain: 0.8 })) },
    crow: { vol: 0.25, poly: 2, dur: 0.5, layers: [S('saw', { f: 560, f1: 420, env: [0.01, 0.15, 0.5, 0.2], bp: 1400, q: 2, gain: 1 }), N({ bp: 1500, q: 2, env: [0.01, 0.1, 0.4, 0.2], gain: 0.4 })] },
    villager_cry: { vol: 0.22, poly: 3, dur: 0.6, layers: [S('saw', { f: 520, f1: 760, sweep: 0.3, vib: 6, vibAmt: 0.04, env: [0.03, 0.3, 0.6, 0.2], bp: 1500, q: 1.5, gain: 1 })] },
    hammer: { vol: 0.3, poly: 3, dur: 0.9, layers: [0, 0.28, 0.56].map((at) => N({ at, dur: 0.12, bp: 1800, q: 2, decay: 40, gain: 1 })).concat([0, 0.28, 0.56].map((at) => S('sine', { at, dur: 0.12, f: 330, decay: 30, gain: 0.4 }))) },
    // ---------------- economy, capture, ui ----------------
    coin: { vol: 0.3, poly: 6, dur: 0.35, layers: [S('sine', { f: 2350, fm: 2.4, fmAmt: 0.25, decay: 14, gain: 0.6 }), S('sine', { at: 0.06, f: 3140, decay: 14, gain: 0.45 })] },
    gold_big: { vol: 0.4, poly: 2, dur: 0.9, layers: [0, 0.07, 0.14, 0.21, 0.28].map((at, i) => S('sine', { at, dur: 0.35, f: 1760 + i * 260, fm: 2.4, fmAmt: 0.2, decay: 10, gain: 0.45 })) },
    herald: { vol: 0.32, poly: 1, dur: 1.4, layers: [S('saw', { f: 311, env: [0.06, 0.3, 0.8, 0.2], dur: 0.45, lp: [600, 2200], lpT: 0.15, gain: 0.7 }), S('saw', { at: 0.42, f: 415, env: [0.06, 0.3, 0.8, 0.5], dur: 0.9, lp: [600, 2200], lpT: 0.15, gain: 0.7 })] },
    capture: { vol: 0.42, poly: 1, dur: 1.6, layers: [S('saw', { f: 262, dur: 0.3, env: [0.04, 0.1, 0.8, 0.1], lp: [700, 2400], lpT: 0.1, gain: 0.55 }), S('saw', { at: 0.28, f: 330, dur: 0.3, env: [0.04, 0.1, 0.8, 0.1], lp: [700, 2400], lpT: 0.1, gain: 0.55 }), S('saw', { at: 0.56, f: 392, dur: 1, env: [0.04, 0.3, 0.8, 0.6], lp: [700, 2600], lpT: 0.2, gain: 0.6 }), S('sine', { at: 0.56, f: 784, dur: 1, env: [0.05, 0.4, 0.5, 0.6], gain: 0.2 })] },
    capture_lost: { vol: 0.42, poly: 1, dur: 1.4, layers: [S('saw', { f: 392, dur: 0.35, env: [0.04, 0.1, 0.8, 0.1], lp: 1600, gain: 0.55 }), S('saw', { at: 0.32, f: 311, dur: 0.35, env: [0.04, 0.1, 0.8, 0.1], lp: 1400, gain: 0.55 }), S('saw', { at: 0.64, f: 233, dur: 0.8, env: [0.04, 0.3, 0.8, 0.5], lp: 1200, gain: 0.6 })] },
    capture_tick: { vol: 0.15, poly: 2, dur: 0.1, layers: [S('sine', { f: 1500, decay: 40, gain: 0.6 })] },
    powerup: { vol: 0.45, poly: 2, dur: 1.0, layers: [0, 0.06, 0.12, 0.18, 0.24, 0.3].map((at, i) => S('sine', { at, dur: 0.5, f: 880 * Math.pow(1.26, i), decay: 7, gain: 0.35 })).concat([N({ hp: 5000, env: [0.02, 0.4, 0.3, 0.4], gain: 0.15 })]) },
    buy: { vol: 0.4, poly: 2, dur: 0.6, layers: [S('sine', { f: 1320, fm: 2.4, fmAmt: 0.3, decay: 9, gain: 0.5 }), S('sine', { at: 0.08, f: 1760, decay: 9, gain: 0.45 }), N({ at: 0.0, dur: 0.2, bp: 3000, q: 1, decay: 30, gain: 0.3 })] },
    denied: { vol: 0.3, poly: 1, dur: 0.25, layers: [S('tri', { f: 150, env: [0.005, 0, 1, 0.04], lp: 900, gain: 0.8 }), N({ lp: 500, decay: 20, gain: 0.3 })] },
    ui_click: { vol: 0.22, poly: 3, dur: 0.08, layers: [N({ bp: 2200, q: 2, decay: 70, gain: 1 }), S('sine', { f: 900, decay: 60, gain: 0.3 })] },
    ui_hover: { vol: 0.08, poly: 3, dur: 0.05, layers: [S('sine', { f: 1800, decay: 90, gain: 0.6 })] },
    victory: { vol: 0.55, poly: 1, dur: 3.2, layers: [[0, 262], [0.3, 330], [0.6, 392], [0.9, 523], [1.2, 659]].map(([at, f]) => S('saw', { at, f, dur: 2, env: [0.05, 0.5, 0.7, 1], lp: [800, 2600], lpT: 0.3, gain: 0.35 })) },
    defeat: { vol: 0.55, poly: 1, dur: 3.0, layers: [[0, 392], [0.45, 349], [0.9, 311], [1.35, 262]].map(([at, f]) => S('saw', { at, f, dur: 1.6, env: [0.05, 0.5, 0.7, 1], lp: 1200, gain: 0.35 })) },
  };
})(window.AS);
