/* ALIEN STRIKE — persistence (localStorage).
 * Campaign profile and settings are stored separately so wiping a campaign keeps
 * the player's audio/graphics/controls choices. */
'use strict';
(function (AS) {
  let PROFILE_KEY = 'alienstrike.profile.v1';
  let SETTINGS_KEY = 'alienstrike.settings.v1';
  let NESTED = ['stats', 'loadout', 'upgrades', 'missions']; // object fields merged onto defaults

  let DEFAULT_SETTINGS = {
    master: 0.8, music: 0.55, sfx: 0.8, voice: 0.9,
    quality: 'high', // low | medium | high
    shake: true, flash: true, subtitles: true,
    controlMode: 'twinstick', // twinstick (WASD moves, mouse aims) | assault (thrust toward cursor) | tactical (A/D rotate)
    controlsV: 2,
    testMode: false, // testing: every mission unlocked, F9 skips the current mission
    bindings: null,
  };

  let newProfile = function () {
    return {
      version: 1,
      created: Date.now(),
      salvage: 250,
      tech: 0,
      upgrades: {},
      unlockedWeapons: ['pulse', 'missile', 'plasma'], // blueprints obtained
      ownedWeapons: ['pulse', 'missile', 'plasma'],    // fabricated & equippable
      loadout: { primary: 'pulse', secondary: 'missile', special: 'plasma' },
      repairKits: 1,
      missions: {},          // id -> { completed, best, objectives: {id:true}, optional: n }
      unlockedMissions: ['w1m1'],
      lastMission: null,
      stats: { kills: 0, rescued: 0, missions: 0, salvageEarned: 0, deaths: 0, playTime: 0 },
      seenIntro: false,
    };
  };

  function storageOK() {
    try { const k = '__as_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
  }

  const Save = {
    /* Another game built on this engine can reuse the persistence layer with its
     * own storage keys, profile shape and settings defaults:
     *   AS.Save.configure({ profileKey, settingsKey, newProfile, settings, nested, migrate }) */
    configure(o) {
      if (o.profileKey) PROFILE_KEY = o.profileKey;
      if (o.settingsKey) SETTINGS_KEY = o.settingsKey;
      if (o.newProfile) newProfile = o.newProfile;
      if (o.settings) this.DEFAULT_SETTINGS = DEFAULT_SETTINGS = Object.assign({}, o.settings);
      if (o.nested) NESTED = o.nested;
      this.migrate = o.migrate || null;
      this.profile = null;
    },
    available: storageOK(),
    profile: null,
    settings: null,
    hasProfile() { return !!(this.profile || this.loadProfile()); },
    loadProfile() {
      let p = null;
      if (this.available) {
        try { const raw = localStorage.getItem(PROFILE_KEY); if (raw) p = JSON.parse(raw); } catch (e) { p = null; }
      }
      if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
      // Merge onto defaults so older saves gain new fields. A damaged save is treated
      // as no save rather than stopping the game from starting.
      try {
        const d = newProfile();
        for (const k in d) if (p[k] === undefined || p[k] === null) p[k] = d[k];
        for (const k of NESTED) if (d[k] !== undefined && (typeof p[k] !== 'object' || Array.isArray(p[k]))) p[k] = d[k];
        if (d.stats) for (const k in d.stats) if (p.stats[k] === undefined) p.stats[k] = d.stats[k];
        if (d.loadout) for (const k in d.loadout) if (!p.loadout[k]) p.loadout[k] = d.loadout[k];
        if (this.migrate) this.migrate(p);
      } catch (e) { return null; }
      this.profile = p;
      return p;
    },
    newProfile() { this.profile = newProfile(); this.saveProfile(); return this.profile; },
    saveProfile() {
      if (!this.profile || !this.available) return false;
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); return true; } catch (e) { return false; }
    },
    deleteProfile() {
      this.profile = null;
      if (this.available) try { localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
    },
    loadSettings() {
      let s = null;
      if (this.available) {
        try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
      }
      this.settings = Object.assign({}, DEFAULT_SETTINGS, s || {});
      // v2 controls: twin-stick movement becomes the default once for older saves
      if (DEFAULT_SETTINGS.controlsV && (!this.settings.controlsV || this.settings.controlsV < 2)) { this.settings.controlMode = 'twinstick'; this.settings.controlsV = 2; }
      return this.settings;
    },
    saveSettings() {
      if (!this.available) return;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
    },
    DEFAULT_SETTINGS,
  };
  AS.Save = Save;
})(window.AS);
