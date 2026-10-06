/* WYRMCROWN — engine configuration: storage keys, profile, settings defaults,
 * key bindings and the gamepad map. Loaded right after the shared engine core
 * so every later module sees WYRMCROWN's settings rather than ALIEN STRIKE's. */
'use strict';
(function (AS) {
  AS.GAME = 'wyrmcrown';
  AS.Save.configure({
    profileKey: 'wyrmcrown.profile.v1',
    settingsKey: 'wyrmcrown.settings.v1',
    nested: ['stats', 'maps'],
    settings: {
      master: 0.8, music: 0.55, sfx: 0.8, voice: 0.9,
      quality: 'high', shake: true, flash: true, subtitles: true,
      controlMode: 'keys', // keys: A/D steer, mouse aims the staff · mouse: the dragon flies toward the cursor
      view: 'normal', difficulty: 'normal', testMode: false, bindings: null,
      taunts: true, // wizards and dragons trading insults (voices + subtitles)
    },
    newProfile() {
      return {
        version: 1, created: Date.now(),
        faction: 'human',
        maps: {},              // id -> { won, best, plays }
        unlockedMaps: ['sundered'],
        stats: { wins: 0, losses: 0, played: 0, dragonsDowned: 0, goldEarned: 0, eaten: 0, playTime: 0 },
        seenIntro: false,
      };
    },
  });

  AS.Input.configure({
    bindings: {
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      dive: ['Space'],
      sprint: ['ShiftLeft', 'ShiftRight'],
      eat: ['KeyE'],
      spell: ['KeyQ'],
      town: ['KeyT'],
      warband: ['KeyG'],
      map: ['KeyM'],
      objectives: ['Tab'],
      pause: ['Escape', 'KeyP'],
      controlMode: ['KeyC'],
      breath: ['KeyF'],
    },
    labels: {
      forward: 'Beat wings (accelerate)', back: 'Flare wings (brake / hover)', left: 'Bank left', right: 'Bank right',
      dive: 'Dive (hold) — release to pull up', sprint: 'Sprint (costs energy)', eat: 'Snatch / eat / drop prey',
      spell: 'Cast stored spell', town: 'Hold court in your town', warband: 'Order your warband', map: 'War map',
      objectives: 'Realm overview', pause: 'Pause', controlMode: 'Toggle flight control mode', breath: 'Breathe fire (also right mouse)',
    },
    preventKeys: ['KeyQ'],
    // standard gamepad: left stick flies, right stick aims, triggers cast and breathe
    pad(s, axes, b) {
      const lx = s.moveX, ly = s.moveY;
      s.left = lx < -0.3; s.right = lx > 0.3; s.forward = ly < -0.35; s.back = ly > 0.35;
      s.firePrimary = b(7) > 0.3; s.breath = b(6) > 0.3;
      s.dive = b(0) > 0.5; s.eat = b(1) > 0.5; s.town = b(2) > 0.5; s.spell = b(3) > 0.5;
      s.sprint = b(4) > 0.5 || b(10) > 0.5; s.warband = b(5) > 0.5;
      s.map = b(8) > 0.5; s.pause = b(9) > 0.5; s.objectives = b(12) > 0.5;
    },
  });
})(window.AS);
