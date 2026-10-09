/* WYRMCROWN — application bootstrap, state machine and main loop.
 * Same shape as ALIEN STRIKE's main.js: the shared renderer draws the realm,
 * the HUD paints over it at native resolution and DOM screens (menus, court,
 * results) sit on top. URL options for testing:
 *   ?map=sundered      start that map straight away (skips the menu)
 *   &faction=elf       play another realm (testing; the campaign plays Aldermere)
 *   &god=1             invulnerable dragon      &fps=1  frame-time readout
 *   &perf=1            developer performance overlay open (F3 toggles it)
 *   ?mode=conquest     open the Conquest campaign screen (&cqdebug=1: its debug tools)
 *   &demo=1            all four dragons flown by the AI (attract mode)
 *   &gold=5000         starting gold for every realm (testing) */
'use strict';
(function (AS) {
  const U = AS.U;
  const App = {
    state: 'boot', game: null, last: 0, overlay: null, fps: 60, frameMs: 0, updMs: 0, renMs: 0,
    params: new URLSearchParams(location.search),
    init() {
      AS.Settings = AS.Save.loadSettings();
      AS.Input.setBindings(AS.Settings.bindings);
      const canvas = document.getElementById('game');
      AS.Input.init(canvas);
      AS.Perf && AS.Perf.init();
      AS.Renderer.viewHeights = { near: 520, normal: 600, far: 700 };
      AS.Renderer.init(canvas);
      // creature sprites are forged in the background (served over http; file:// forges on the page)
      if (location.protocol !== 'file:') AS.Forge.useWorkers(new URL('src/gfx/forge_worker.js', location.href).href, (navigator.hardwareConcurrency || 4) >= 6 ? 2 : 1);
      AS.Particles.init(3200);
      AS.Particles.density = AS.Settings.quality === 'low' ? 0.5 : AS.Settings.quality === 'medium' ? 0.8 : 1;
      AS.Proj.init();
      AS.Save.loadProfile();
      const unlockAudio = () => { AS.Audio.init(); AS.Audio.resume(); };
      window.addEventListener('pointerdown', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
      requestAnimationFrame((t) => this.loop(t));
      // ?world=large starts the Large World Test (&bench=A…H or all, &pop=N for the crowd test)
      const m = this.params.get('world') === 'large' ? 'largeworld' : this.params.get('world') === 'huge' ? 'hugeworld' : this.params.get('map');
      const direct = m && AS.Maps.byId[m];
      if (AS.UI) AS.UI.boot(!direct);
      if (direct) {
        if (!AS.Save.profile) AS.Save.newProfile();
        this.startMatch(m, { god: this.params.get('god') === '1', faction: this.params.get('faction') || 'human', demo: this.params.get('demo') === '1', gold: +(this.params.get('gold') || 0) || undefined });
      }
      const boot = document.getElementById('boot'); if (boot) boot.remove();
      // ?mode=conquest opens the Conquest campaign screen
      if (!direct && this.params.get('mode') === 'conquest' && AS.Conquest && AS.Conquest.UI) AS.Conquest.UI.open();
      // say so on screen if this copy cannot find its recordings (or sound is turned off)
      if (AS.AudioCheck) setTimeout(() => AS.AudioCheck.run(), 1500);
    },

    startMatch(id, opts) {
      opts = opts || {};
      // a map id, or (Conquest) a generated map record
      const map = id && typeof id === 'object' ? id : AS.Maps.byId[id];
      if (!map) return;
      this.state = 'loading';
      this.demo = null; // the attract-mode realm makes way for the real one
      AS.Particles.clear(); AS.Proj.clear();
      AS.UI && AS.UI.showLoading && AS.UI.showLoading(map);
      AS.Music.stop && AS.Music.stop();
      setTimeout(() => {
        try {
          opts.difficulty = opts.difficulty || AS.Settings.difficulty || 'normal';
          this.game = new AS.Realm(map, opts);
          AS.game = this.game;
          this.game.load();
          this.game.onEnd = (res) => this.onMatchEnd(res);
          this.lastMap = id; this.lastOpts = opts;
          AS.UI && AS.UI.hideAll && AS.UI.hideAll();
          this.state = 'play'; this.overlay = null;
          AS.Perf && AS.Perf.reset(); // (the loading pause is not a frame)
          if (this.smooth) this.smooth.hold = performance.now() + 8000;
          AS.HUD && AS.HUD.reset && AS.HUD.reset(this.game);
          AS.Audio.startWorld && AS.Audio.startWorld(this.game.world);
          AS.RealmAudio && AS.RealmAudio.start(this.game);
          AS.Voices && AS.Voices.start(this.game);
          this.game.msg(map.name.toUpperCase(), '#ffe7a8', 4);
          AS.Tutorial && AS.Tutorial.start(this.game);
        } catch (e) {
          console.error(e);
          AS.UI && AS.UI.error ? AS.UI.error('The realm failed to load: ' + e.message) : alert(e.message);
          this.state = 'menu';
        }
      }, 60);
    },
    restart() { if (this.lastMap && !(this.lastOpts && (this.lastOpts.conquest || this.lastOpts.campaign))) this.startMatch(this.lastMap, this.lastOpts); },
    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused';
      AS.Audio.duck && AS.Audio.duck(true, 0); // paused: music only
      AS.Voices && AS.Voices.stop();
      AS.UI && AS.UI.showPause && AS.UI.showPause();
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play';
      AS.Audio.duck && AS.Audio.duck(false);
      AS.UI && AS.UI.hideAll && AS.UI.hideAll();
    },
    abandon() { this.endGame(); AS.UI && AS.UI.showMenu && AS.UI.showMenu(); },
    endGame() {
      this.game = null; AS.game = null;
      this.state = 'menu';
      AS.Audio.stopWorld && AS.Audio.stopWorld();
      AS.RealmAudio && AS.RealmAudio.stop();
      AS.Voices && AS.Voices.stop(); if (AS.Voices) AS.Voices.g = null;
      AS.Music.stop && AS.Music.stop();
      AS.Particles.clear(); AS.Proj.clear();
    },
    onMatchEnd(res) {
      this.state = 'results';
      AS.RealmAudio && AS.RealmAudio.stop();
      AS.Voices && AS.Voices.stop();
      // a Conquest battle reports back to its campaign, not to the battle-mode atlas
      if (res && res.conquest && AS.Conquest && AS.Conquest.Battle) { AS.Conquest.Battle.onEnd(res); return; }
      if (AS.Campaign && !(res && res.bigCampaign)) AS.Campaign.applyResult(res);
      AS.UI && AS.UI.showResults && AS.UI.showResults(res);
    },
    /* A machine that cannot keep up (a large high-resolution screen on a modest
     * graphics chip, or a browser with slow canvas drawing) gets a lower internal
     * drawing resolution, a step at a time, until play is smooth again. */
    keepSmooth(ts, g) {
      const K = this.smooth || (this.smooth = { t0: ts, n: 0, sum: 0, hold: ts + 8000 });
      if (ts < K.hold) { K.t0 = ts; K.n = 0; K.sum = 0; K.last = ts; return; } // settling after a load or a change
      if (K.last) { K.sum += ts - K.last; K.n++; }
      K.last = ts;
      if (ts - K.t0 < 3000) return;
      const avg = K.sum / Math.max(1, K.n), R = AS.Renderer;
      K.t0 = ts; K.n = 0; K.sum = 0;
      if (avg > 40 && !R.pixelated && R.res > 1.3) {
        R.resCap = Math.max(1.25, Math.round(R.res * 0.8 * 32) / 32);
        R.resize();
        K.hold = ts + 6000;
        g.msg('DETAIL LOWERED TO KEEP THE GAME SMOOTH', '#ffe7a8', 2.5);
      }
    },
    // court / town menu and other in-game overlays that pause the action
    openOverlay(name) { AS.Voices && AS.Voices.stop(); this.overlay = name; if (this.game) this.game.uiBlocking = true; if (name === 'map' && AS.Audio.duck) AS.Audio.duck(true, 0); }, // the war map: music only
    closeOverlay() { if (this.overlay === 'map' && AS.Audio.duck) AS.Audio.duck(false); this.overlay = null; if (this.game) this.game.uiBlocking = false; },

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
      const PF = AS.Prof; // developer profiler: on while the F3 panel is shown
      if (PF) { PF.on = !!(AS.Perf && AS.Perf.on) || !!(AS.game && AS.game.lw && AS.game.lw.bench); PF.begin(); } // (also during a Large World benchmark)
      const mark = (n) => { if (PF && PF.on) PF.mark(n); };
      const g = this.game;
      if (g && (this.state === 'play' || this.state === 'paused' || this.state === 'results')) {
        if (this.state === 'play') {
          if (I.hit('pause')) {
            if (this.overlay === 'court') AS.Court && AS.Court.close(); else if (this.overlay === 'hire') AS.HirePanel.close(); else if (this.overlay) this.closeOverlay(); else this.pause();
          } else if (I.hit('map') && this.overlay !== 'court') { if (this.overlay === 'map') this.closeOverlay(); else this.openOverlay('map'); }
          else if (I.hit('town') && AS.Court && !g.opts.conquest) AS.Court.toggle(g);
          else if (I.hit('highFlight') && g.map.highFlight) { g.highFlight = !g.highFlight; g.msg(g.highFlight ? 'HIGH FLIGHT — H TO DESCEND' : 'BACK DOWN TO THE FIGHT', '#cfe8ff', 2); }
          else if (g.bc && I.hit('hire') && AS.HirePanel && this.overlay !== 'court' && this.overlay !== 'map') AS.HirePanel.toggle(g);
          else if (g.bc && (I.hit('army') || I.hit('warband')) && !this.overlay) AS.BigCampaign.toggleMode(g); // (the campaign's army follows the dragon: G holds or follows too)
          else if (I.hit('warband') && AS.WarMap && this.overlay !== 'court' && !g.bc) { if (this.overlay === 'map') this.closeOverlay(); else AS.WarMap.openOrders(g); }
          if (I.hit('controlMode')) {
            AS.Settings.controlMode = AS.Settings.controlMode === 'mouse' ? 'keys' : 'mouse'; AS.Save.saveSettings();
            g.msg(AS.Settings.controlMode === 'mouse' ? 'FLIGHT: FOLLOW THE CURSOR' : 'FLIGHT: KEYS STEER, MOUSE AIMS', '#ffe7a8', 2.2);
          }
          AS.HUD && AS.HUD.tabTick && AS.HUD.tabTick(I.down('objectives'), dt);
          // the war map and the court pause the realm
          mark('input');
          if (!this.overlay) { const u0 = performance.now(); g.update(dt); this.updMs = performance.now() - u0; mark('update'); AS.Voices && AS.Voices.update(dt, g); mark('voices'); }
          else { AS.Particles.update(0); }
        } else if (this.state === 'results') AS.Particles.update(dt * 0.5);
        const r0 = performance.now();
        AS.Renderer.renderWorld(g, this.state === 'play' && !this.overlay ? dt : 0);
        AS.Renderer.present();
        mark('present (to screen)');
        const ctx = AS.Renderer.ctx;
        if (this.state === 'play') {
          AS.HUD && AS.HUD.draw(ctx, g, dt);
          if (this.overlay === 'map' && AS.WarMap) AS.WarMap.draw(ctx, g, dt);
        }
        mark('HUD');
        this.renMs = performance.now() - r0;
        AS.Perf && AS.Perf.draw(ctx, g);
        mark('F3 panel');
        AS.Audio.update && AS.Audio.update(dt, g);
        mark('audio');
      } else if (this.demo && this.state !== 'loading' && !this.demoHold) { // (held while the Conquest map is open)
        // attract mode: an all-AI war plays behind the title and menus
        const d = this.demo;
        AS.game = d;
        d.update(dt);
        AS.Renderer.renderWorld(d, dt);
        AS.Renderer.present();
        AS.Perf && AS.Perf.draw(AS.Renderer.ctx, d);
        AS.game = null;
        AS.UI && AS.UI.tick && AS.UI.tick(dt);
        AS.Audio.update && AS.Audio.update(dt, null);
      } else {
        AS.UI && AS.UI.tick && AS.UI.tick(dt);
        AS.Audio.update && AS.Audio.update(dt, null);
      }
      AS.Music.update && AS.Music.update(dt);
      if (this.state === 'play' && !this.overlay && g && this.params.get('fixedres') !== '1') this.keepSmooth(ts, g);
      const work = performance.now() - t0;
      if (PF && PF.on) { mark('music+other'); PF.end(work); }
      this.frameMs = U.lerp(this.frameMs, work, 0.05);
      if (AS.Perf) { AS.Perf.frame(ts, work, this.updMs, this.renMs); this.updMs = this.renMs = 0; }
      if (this.params.get('fps') === '1') {
        const c = AS.Renderer.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0f0'; c.font = '14px monospace';
        c.fillText(Math.round(this.fps) + ' fps  ' + this.frameMs.toFixed(1) + 'ms  p:' + AS.Particles.pool.active.length + ' pr:' + AS.Proj.pool.active.length + (g ? ' t:' + g.troops.length + ' b:' + g.buildings.length + (AS.Life ? ' life:' + AS.Life.count(g) : '') : ''), 10, AS.Renderer.canvas.height - 10);
      }
      I.endFrame();
    },
  };
  AS.App = App;
  window.addEventListener('load', () => App.init());
})(window.AS);
