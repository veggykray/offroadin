/* ALIEN STRIKE — application bootstrap, state machine and main loop. */
'use strict';
(function (AS) {
  const U = AS.U;
  const App = {
    state: 'boot', game: null, last: 0, overlay: null, fps: 60, frameMs: 0,
    params: new URLSearchParams(location.search),
    init() {
      AS.Settings = AS.Save.loadSettings();
      AS.Input.setBindings(AS.Settings.bindings);
      const canvas = document.getElementById('game');
      AS.Input.init(canvas);
      AS.Renderer.init(canvas);
      AS.Particles.init(2600);
      AS.Particles.density = AS.Settings.quality === 'low' ? 0.5 : AS.Settings.quality === 'medium' ? 0.8 : 1;
      AS.Proj.init();
      AS.Save.loadProfile();
      const unlockAudio = () => { AS.Audio.init(); AS.Audio.resume(); };
      window.addEventListener('pointerdown', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
      requestAnimationFrame((t) => this.loop(t));
      const m = this.params.get('mission');
      if (AS.UI) AS.UI.boot(!(m && AS.Levels.byId[m]));
      if (m && AS.Levels.byId[m]) {
        if (!AS.Save.profile) AS.Save.newProfile();
        this.startMission(m, { god: this.params.get('god') === '1', skipBriefing: true });
      }
      document.getElementById('boot') && document.getElementById('boot').remove();
    },

    startMission(id, opts) {
      opts = opts || {};
      const mission = AS.Levels.byId[id];
      if (!mission) return;
      this.state = 'loading';
      AS.UI && AS.UI.showLoading(mission);
      AS.Music.stop && AS.Music.stop();
      setTimeout(() => {
        try {
          const profile = AS.Save.profile || AS.Save.newProfile();
          this.game = new AS.Game(mission, profile, opts);
          AS.game = this.game;
          this.game.load();
          this.game.onEnd = (res) => this.onMissionEnd(res);
          this.lastMission = id; this.lastOpts = opts;
          AS.UI && AS.UI.hideAll();
          this.state = 'play'; this.overlay = null;
          AS.HUD && AS.HUD.resetMission && AS.HUD.resetMission();
          AS.Audio.startWorld && AS.Audio.startWorld(this.game.world);
          AS.Music.play && AS.Music.play(this.game.world);
          AS.Voice.reset && AS.Voice.reset();
          this.game.say(mission.openLine || 'mission_start');
          if (mission.startMsg) this.game.msg(mission.startMsg, '#7fe8ff', 5);
        } catch (e) {
          console.error(e);
          AS.UI && AS.UI.error('Mission failed to load: ' + e.message);
          this.state = 'menu';
        }
      }, 60);
    },
    restart() { if (this.lastMission) this.startMission(this.lastMission, this.lastOpts); },
    /* testing: finish the current mission as a success without playing it
       (primaries are marked done, rewards and unlocks apply as normal) */
    skipMission() {
      const g = this.game;
      if (!g || g.ended || (this.state !== 'play' && this.state !== 'paused')) return;
      this.state = 'play';
      AS.UI && AS.UI.hideAll();
      for (const o of g.script.objs) if (o.cat === 'primary' && o.state !== 'done') { if (o.state === 'locked') o.state = 'active'; g.script.setDone(o, true); }
      g.finish(true);
    },
    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused';
      AS.Audio.duck && AS.Audio.duck(true);
      AS.UI && AS.UI.showPause();
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play';
      AS.Audio.duck && AS.Audio.duck(false);
      AS.UI && AS.UI.hideAll();
    },
    abandon(toMenu) {
      this.endGame();
      if (toMenu) AS.UI.showMenu(); else AS.UI.showHangar();
    },
    endGame() {
      this.game = null; AS.game = null;
      this.state = 'menu';
      AS.Audio.stopWorld && AS.Audio.stopWorld();
      AS.Music.stop && AS.Music.stop();
      AS.Particles.clear(); AS.Proj.clear();
    },
    onMissionEnd(res) {
      const g = this.game;
      this.state = 'results';
      AS.Audio.stopWorld && AS.Audio.stopWorld();
      const rewards = AS.Campaign ? AS.Campaign.applyResult(res) : null;
      AS.UI && AS.UI.showResults(res, rewards);
      setTimeout(() => { if (this.state === 'results') { AS.Music.stop && AS.Music.stop(); } }, 4000);
    },

    loop(ts) {
      requestAnimationFrame((t) => this.loop(t));
      const now = ts / 1000;
      let dt = this.last ? now - this.last : 1 / 60;
      this.last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt <= 0) dt = 1 / 60;
      this.fps = U.lerp(this.fps, 1 / dt, 0.05);
      const I = AS.Input;
      I.pollPad();
      const t0 = performance.now();
      const g = this.game;
      if (g && (this.state === 'play' || this.state === 'paused' || this.state === 'results')) {
        if (this.state === 'play') {
          // overlay / pause keys
          if (I.hit('pause')) { if (this.overlay) this.overlay = null; else { this.pause(); } }
          else if (I.hit('map')) this.overlay = this.overlay === 'map' ? null : 'map';
          else if (I.hit('objectives')) AS.HUD.tabPress();
          if (AS.Settings.testMode && I.pressed.has('F9')) this.skipMission();
          AS.HUD.tabTick(I.down('objectives'), dt);
          if (I.hit('controlMode')) { const modes = ['twinstick', 'assault', 'tactical'], names = { twinstick: 'TWIN-STICK', assault: 'ASSAULT', tactical: 'CLASSIC' }; AS.Settings.controlMode = modes[(modes.indexOf(AS.Settings.controlMode) + 1) % modes.length]; AS.Save.saveSettings(); g.msg('CONTROL MODE: ' + names[AS.Settings.controlMode], '#7fe8ff', 2); }
          g.uiBlocking = !!this.overlay;
          if (!this.overlay) g.update(dt);
        } else if (this.state === 'results') {
          // let the world settle under the results screen
          AS.Particles.update(dt * 0.5);
        }
        AS.Renderer.renderWorld(g, this.state === 'play' && !this.overlay ? dt : 0);
        AS.Renderer.present();
        const ctx = AS.Renderer.ctx;
        if (this.state === 'play') {
          AS.HUD.draw(ctx, g, dt);
          if (this.overlay === 'map') AS.TacMap.draw(ctx, g);
        }
        AS.Voice.update && AS.Voice.update(dt, g);
        AS.Audio.update && AS.Audio.update(dt, g);
      } else {
        AS.UI && AS.UI.tick && AS.UI.tick(dt);
        AS.Voice.update && AS.Voice.update(dt, null);
        AS.Audio.update && AS.Audio.update(dt, null);
      }
      AS.Music.update && AS.Music.update(dt);
      this.frameMs = U.lerp(this.frameMs, performance.now() - t0, 0.05);
      if (this.params.get('fps') === '1') { const c = AS.Renderer.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0f0'; c.font = '14px monospace'; c.fillText(Math.round(this.fps) + ' fps  ' + this.frameMs.toFixed(1) + 'ms  p:' + AS.Particles.pool.active.length + ' pr:' + AS.Proj.pool.active.length + (g ? ' u:' + g.units.length : ''), 10, AS.Renderer.canvas.height - 10); }
      I.endFrame();
    },
  };
  AS.App = App;
  window.addEventListener('load', () => App.init());
})(window.AS);
