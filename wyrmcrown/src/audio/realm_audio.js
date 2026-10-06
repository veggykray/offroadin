/* WYRMCROWN — the realm's audio director, on top of the shared audio engine
 * (alien-strike/src/audio/audio.js, synth.js, music.js):
 *  - ambience beds are mixed by where you are: forest rustle under trees,
 *    babbling water near rivers and lakes, wind everywhere, a blizzard in the
 *    north, village bustle near towns, a cursed drone in the blight;
 *  - ambient events: birdsong in the meadows, cattle and sheep near farms,
 *    crows in the blight, wolves in the wilds, the odd creak of ice;
 *  - the player's dragon: rushing air that rises with speed and a whistle in
 *    the dive (wing beats are one-shots fired by the flight model);
 *  - music: each realm has its own theme (data/factions.js music blocks) and
 *    the heartland its own; crossing a border changes the score. */
'use strict';
(function (AS) {
  const U = AS.U;
  const NEUTRAL_MUSIC = { root: 48, scale: 'dorian', tempo: 90, pad: 'warm', lead: 'flute', arp: 'harp', bell: 'harp', perc: 'frame', drums: 'war', bossLead: 'horn', bossBass: 'bass', name: 'The Heartland' };
  const RA = {
    g: null, regionKey: null, musicKey: null, regionT: 0,
    start(g) {
      this.g = g; this.regionKey = g.region; this.musicKey = null; this.regionT = 99;
      const A = AS.Audio;
      if (!A.ctx) { this.pending = true; return; }
      A.eventHook = (k) => this.event(k);
      A.updateHook = (dt, gg) => this.update(dt, gg);
      A.startLoop('air', 'air_rush', 0.01);
      this.playMusic(g.region);
    },
    stop() {
      const A = AS.Audio;
      A.stopLoop && A.stopLoop('air');
      for (const fk of AS.Data.factionOrder) A.stopLoop && A.stopLoop('breath:' + fk);
      A.updateHook = null; A.eventHook = null;
      this.g = null;
    },
    region(g, key) { this.regionKey = key; this.regionT = 0; },
    playMusic(key) {
      if (this.musicKey === key || !AS.Music) return;
      this.musicKey = key;
      const cfg = key === 'neutral' ? NEUTRAL_MUSIC : AS.Data.factions[key].music;
      AS.Music.play({ id: 200 + AS.Data.factionOrder.indexOf(key), music: cfg, key: 'music:' + key });
    },
    update(dt, g) {
      if (!g || g !== this.g) return;
      const A = AS.Audio, p = g.player, T = g.terrain;
      // settle on a region for a few seconds before changing the score
      this.regionT += dt;
      if (this.regionT > 4 && this.musicKey !== this.regionKey) this.playMusic(this.regionKey);
      // mix the beds
      const w = g.regionW, water = T.gs(T.gWater, p.x, p.y), forest = T.gs(T.gForest, p.x, p.y);
      let town = 0;
      for (const F of g.factionList) { const d = Math.hypot(p.x - F.townPos.x, p.y - F.townPos.y); town = Math.max(town, U.clamp(1 - d / 900, 0, 1)); }
      for (const s of g.sites) if (s.kind === 'village') { const d = Math.hypot(p.x - s.x, p.y - s.y); town = Math.max(town, U.clamp(1 - d / 600, 0, 1) * 0.8); }
      const hi = U.clamp((p.z - 20) / 70, 0, 1);
      const target = {
        wind: 0.12 + hi * 0.12 + w[2] * 0.08,
        forest: U.clamp(forest * 1.3, 0, 1) * 0.2 * (1 - hi * 0.5) * (1 - w[2]),
        river: U.clamp(1 - Math.max(0, water) / 380, 0, 1) * 0.24 * (w[2] > 0.55 ? 0.15 : 1),
        blizzard: w[2] * 0.22,
        village: town * 0.13 * (1 - hi * 0.4),
        cursed: w[3] * 0.18,
      };
      const t = A.ctx.currentTime;
      for (const a of A.amb) if (target[a.k] !== undefined) a.gn.gain.setTargetAtTime(target[a.k], t, 0.8);
      // rushing air with speed, a whistle in the dive
      const alive = p.down <= 0 && AS.App.state === 'play' && !AS.App.overlay;
      const sp = alive ? p.speed / 480 : 0;
      A.loopParam('air', 0.8 + sp * 0.7 + (p.diving ? 0.25 : 0), alive ? U.clamp(sp * sp * 1.6 + (p.diving ? 0.25 : 0), 0, 1.1) : 0);
      // which ambient events fit here
      const ev = this.events = this.events || [];
      ev.length = 0;
      if (w[0] + w[1] + w[4] > 0.4 && forest < 0.8) ev.push('birds', 'birds');
      if (forest > 0.4 && w[3] < 0.5) ev.push('birds');
      if (town > 0.2 || this.nearHerd(g, p)) ev.push('cattle');
      if (w[3] > 0.4) ev.push('crows', 'creatures');
      if (w[2] > 0.5) ev.push('icecrack', 'wolves');
      if (forest > 0.6 && w[1] < 0.5) ev.push('wolves');
      A.ambEvents = ev.length ? ev : ['birds'];
    },
    nearHerd(g, p) {
      for (const o of g.life.grid.query(p.x, p.y, 300, [])) if (o.A && o.owner) return true;
      return false;
    },
    event(kind) {
      const A = AS.Audio, g = this.g, p = g && g.player;
      if (!p) return false;
      const at = () => ({ x: p.x + U.range(-500, 500), y: p.y + U.range(-400, 400) });
      if (kind === 'birds') { A.sfx('bird_chirp', Object.assign(at(), { vol: 0.5, rate: U.range(0.8, 1.3) })); return true; }
      if (kind === 'cattle') { const k = U.pick(['cow', 'sheep', 'sheep', 'goat']); A.sfx(k, Object.assign(at(), { vol: 0.45, rate: U.range(0.9, 1.1) })); return true; }
      if (kind === 'crows') { A.sfx('crow', Object.assign(at(), { vol: 0.5 })); return true; }
      if (kind === 'wolves') { if (Math.random() < 0.3) A.sfx('wolf_howl', Object.assign(at(), { vol: 0.4, rate: U.range(0.9, 1.1) })); return true; }
      return false; // icecrack, creatures: the engine's own voices
    },
  };
  // the audio context only exists after the first click/key: start late if needed
  const tryLate = () => { if (RA.pending && RA.g && AS.Audio.ctx) { RA.pending = false; RA.start(RA.g); } };
  window.addEventListener('pointerdown', () => setTimeout(tryLate, 50));
  window.addEventListener('keydown', () => setTimeout(tryLate, 50));
  // the realm's extra ambience beds (synthesised in alien-strike/src/audio/synth.js)
  AS.Audio.bedVolumes = { forest: 0.05, river: 0.05, blizzard: 0.05, village: 0.05, cursed: 0.05, birds: 0, cattle: 0 };
  AS.Audio.eventKinds = ['birds', 'cattle', 'crows', 'wolves'];
  AS.RealmAudio = RA;
})(window.AS);
