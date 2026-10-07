/* ALIEN STRIKE — audio engine: buses, synthesized SFX bank with spatial panning and
 * polyphony limits, looping sounds, craft engine hum (propulsion, thrust changes,
 * lateral thrusters, damage alarm), and per-world ambience beds with random events. */
'use strict';
(function (AS) {
  const U = AS.U;
  const Audio = {
    ctx: null, ready: false, buffers: {}, voices: {}, loops: {}, sr: 32000,
    master: null, sfxBus: null, musicBus: null, ambBus: null, duckGain: null,
    engine: null, amb: [], ambEvents: [], world: null, beds: {},
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.master = c.createGain(); this.master.connect(this.comp); this.comp.connect(c.destination);
      this.duckGain = c.createGain(); this.duckGain.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.duckGain);
      this.ambBus = c.createGain(); this.ambBus.connect(this.duckGain);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.musicDuck = c.createGain(); this.musicDuck.connect(this.musicBus);
      this.setVolumes();
      this.buildBank();
      AS.Music.attach && AS.Music.attach(this);
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVolumes() {
      if (!this.ctx) return;
      const S = AS.Settings;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(S.master, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(S.sfx, t, 0.05);
      this.ambBus.gain.setTargetAtTime(S.sfx * 0.8, t, 0.05);
      this.musicBus.gain.setTargetAtTime(S.music * 0.7, t, 0.05);
    },
    buildBank() {
      const data = AS.Data.sfx;
      const ids = Object.keys(data);
      // render in small batches so start-up never blocks for long
      let i = 0;
      const step = () => {
        const t0 = performance.now();
        while (i < ids.length && performance.now() - t0 < 12) {
          const id = ids[i++];
          const d = data[id];
          if (d.file && location.protocol.startsWith('http')) this.loadFile(id, d);
          try {
            const arr = AS.Synth.render(this.sr, d);
            const b = this.ctx.createBuffer(1, arr.length, this.sr);
            b.copyToChannel ? b.copyToChannel(arr, 0) : b.getChannelData(0).set(arr);
            if (!this.buffers[id]) this.buffers[id] = b;
          } catch (e) { console.warn('sfx render failed', id, e); }
        }
        if (i < ids.length) setTimeout(step, 0); else this.ready = true;
      };
      step();
    },
    loadFile(id, d) {
      fetch(d.file).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((ab) => this.ctx.decodeAudioData(ab)).then((b) => { this.buffers[id] = b; }).catch(() => { /* keep synthesized fallback */ });
    },

    /* Play a one-shot. o: { x, y (world, for distance/pan), vol, rate } */
    sfx(id, o) {
      if (!this.ctx || !this.ready) return null;
      const b = this.buffers[id];
      const d = AS.Data.sfx[id];
      if (!b || !d) return null;
      o = o || {};
      let gain = (d.vol || 0.5) * (o.vol === undefined ? 1 : o.vol);
      let pan = 0;
      const g = AS.game;
      if (o.x !== undefined && g && g.player) {
        const p = g.player;
        const dist = Math.hypot(o.x - p.x, o.y - p.y);
        const att = U.clamp(1 - dist / 1000, 0, 1);
        if (att <= 0.02) return null;
        gain *= att * att * 0.85 + 0.15 * att;
        pan = U.clamp((o.x - p.x) / 450, -0.85, 0.85);
      }
      // polyphony
      const list = this.voices[id] || (this.voices[id] = []);
      const now = this.ctx.currentTime;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].end < now) list.splice(i, 1);
      if (list.length >= (d.poly || 4)) { const old = list.shift(); try { old.src.stop(); } catch (e) { /* already stopped */ } }
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      const rate = (o.rate || 1) * (o.fixedRate ? 1 : 1 + (Math.random() - 0.5) * 0.06);
      src.playbackRate.value = rate;
      const gn = this.ctx.createGain(); gn.gain.value = gain;
      let node = gn;
      if (pan && this.ctx.createStereoPanner) { const pn = this.ctx.createStereoPanner(); pn.pan.value = pan; gn.connect(pn); node = pn; }
      src.connect(gn); node.connect(o.bus || this.sfxBus);
      src.start();
      list.push({ src, end: now + b.duration / rate });
      return src;
    },
    startLoop(key, id, vol) {
      if (!this.ctx || !this.ready || this.loops[key]) return;
      const b = this.buffers[id]; if (!b) return;
      const src = this.ctx.createBufferSource(); src.buffer = b; src.loop = true;
      const gn = this.ctx.createGain(); gn.gain.value = 0; gn.gain.setTargetAtTime((AS.Data.sfx[id].vol || 0.4) * (vol || 1), this.ctx.currentTime, 0.03);
      src.connect(gn); gn.connect(this.sfxBus); src.start();
      this.loops[key] = { src, gn, id };
    },
    // retune a running loop: playback rate (pitch) and volume multiplier
    loopParam(key, rate, vol) {
      const l = this.loops[key]; if (!l || !this.ctx) return;
      const t = this.ctx.currentTime;
      if (rate !== undefined) l.src.playbackRate.setTargetAtTime(rate, t, 0.05);
      if (vol !== undefined) { const id = l.id; const base = id && AS.Data.sfx[id] ? AS.Data.sfx[id].vol || 0.4 : 0.4; l.gn.gain.setTargetAtTime(base * vol, t, 0.06); }
    },
    stopLoop(key) {
      const l = this.loops[key]; if (!l) return;
      l.gn.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      try { l.src.stop(this.ctx.currentTime + 0.3); } catch (e) { /* noop */ }
      delete this.loops[key];
    },
    duck(on) {
      if (!this.ctx) return;
      this.duckGain.gain.setTargetAtTime(on ? 0.25 : 1, this.ctx.currentTime, 0.15);
    },
    voiceDuck(on) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.musicDuck.gain.setTargetAtTime(on ? 0.45 : 1, t, on ? 0.08 : 0.4);
      this.sfxBus.gain.setTargetAtTime(AS.Settings.sfx * (on ? 0.7 : 1), t, on ? 0.08 : 0.4);
    },

    /* ---------- craft engine ---------- */
    startEngine() {
      if (!this.ctx || this.engine) return;
      const c = this.ctx, e = {};
      e.out = c.createGain(); e.out.gain.value = 0; e.out.connect(this.sfxBus);
      e.lp = c.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.frequency.value = 400; e.lp.Q.value = 2; e.lp.connect(e.out);
      e.o1 = c.createOscillator(); e.o1.type = 'sawtooth'; e.o1.frequency.value = 52;
      e.o2 = c.createOscillator(); e.o2.type = 'triangle'; e.o2.frequency.value = 104.5;
      e.g1 = c.createGain(); e.g1.gain.value = 0.35; e.o1.connect(e.g1); e.g1.connect(e.lp);
      e.g2 = c.createGain(); e.g2.gain.value = 0.25; e.o2.connect(e.g2); e.g2.connect(e.lp);
      // anti-grav whine
      e.w = c.createOscillator(); e.w.type = 'sine'; e.w.frequency.value = 760;
      e.wg = c.createGain(); e.wg.gain.value = 0.02; e.w.connect(e.wg); e.wg.connect(e.out);
      // air rush
      const nb = c.createBuffer(1, this.sr * 2, this.sr); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      e.n = c.createBufferSource(); e.n.buffer = nb; e.n.loop = true;
      e.bp = c.createBiquadFilter(); e.bp.type = 'bandpass'; e.bp.frequency.value = 900; e.bp.Q.value = 0.7;
      e.ng = c.createGain(); e.ng.gain.value = 0; e.n.connect(e.bp); e.bp.connect(e.ng); e.ng.connect(e.out);
      e.o1.start(); e.o2.start(); e.w.start(); e.n.start();
      e.out.gain.setTargetAtTime(0.32, c.currentTime, 0.5);
      e.lastTurn = 0;
      this.engine = e;
    },
    stopEngine() {
      const e = this.engine; if (!e) return;
      const t = this.ctx.currentTime;
      e.out.gain.setTargetAtTime(0, t, 0.2);
      setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.w.stop(); e.n.stop(); e.out.disconnect(); } catch (er) { /* noop */ } }, 800);
      this.engine = null;
    },

    /* ---------- world ambience ---------- */
    startWorld(world) {
      this.init();
      if (!this.ctx) return;
      this.stopWorld();
      this.world = world;
      // worlds without a craft (world.engine === false) drive their own loops
      if (world.engine !== false) this.startEngine();
      const c = this.ctx;
      const beds = Object.assign({ wind: 0.25, insects: 0, creatures: 0, sandhiss: 0.1, machinery: 0.12, jungle: 0.14, icecrack: 0, waves: 0.22, lava: 0.25, hum: 0.12, storm: 0.22 }, this.bedVolumes || {});
      for (const k of world.ambience) {
        const vol = beds[k];
        if (!vol) continue;
        if (!this.beds[k]) {
          const arr = AS.Synth.bed(this.sr, k, 8);
          const b = c.createBuffer(1, arr.length, this.sr); b.getChannelData(0).set(arr);
          this.beds[k] = b;
        }
        const src = c.createBufferSource(); src.buffer = this.beds[k]; src.loop = true;
        const gn = c.createGain(); gn.gain.value = 0; gn.gain.setTargetAtTime(vol, c.currentTime, 1.5);
        src.connect(gn); gn.connect(this.ambBus); src.start();
        this.amb.push({ k, src, gn, vol });
      }
      this.ambEvents = world.ambience.filter((k) => ['insects', 'creatures', 'icecrack', 'jungle', 'machinery', 'lava', 'storm'].concat(this.eventKinds || []).includes(k));
      this.ambT = 2;
    },
    ambStorm(on) {
      for (const a of this.amb) if (a.k === 'wind' || a.k === 'sandhiss') a.gn.gain.setTargetAtTime(on ? a.vol * 2.4 : a.vol, this.ctx.currentTime, 2);
    },
    stopWorld() {
      const c = this.ctx; if (!c) return;
      for (const a of this.amb) { a.gn.gain.setTargetAtTime(0, c.currentTime, 0.4); const s = a.src; setTimeout(() => { try { s.stop(); } catch (e) { /* noop */ } }, 1500); }
      this.amb = [];
      for (const k in this.loops) this.stopLoop(k);
      this.stopEngine();
    },
    ambientEvent(kind) {
      // another game may voice its own ambient events (birdsong, villagers…)
      if (this.eventHook && this.eventHook(kind)) return;
      const c = this.ctx, t = c.currentTime;
      const pan = (Math.random() - 0.5) * 1.6;
      const out = c.createGain(); out.gain.value = 0;
      let p = out;
      if (c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = pan; out.connect(pn); p = pn; }
      p.connect(this.ambBus);
      const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; };
      if (kind === 'insects' || kind === 'jungle') {
        // chirp trains
        const f = 2800 + Math.random() * 2500, n = 3 + (Math.random() * 6 | 0);
        const o = osc('sine', f); o.connect(out); o.start(t);
        for (let i = 0; i < n; i++) { out.gain.setValueAtTime(0, t + i * 0.09); out.gain.linearRampToValueAtTime(0.05, t + i * 0.09 + 0.01); out.gain.linearRampToValueAtTime(0, t + i * 0.09 + 0.05); }
        o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.2, t + n * 0.09);
        o.stop(t + n * 0.09 + 0.1);
      } else if (kind === 'creatures') {
        // distant alien call: formant-ish glide
        const f = 160 + Math.random() * 260;
        const o = osc('sawtooth', f); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 600; bp.Q.value = 4;
        o.connect(bp); bp.connect(out);
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.6 : 0.6), t + 1.2);
        out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.06, t + 0.3); out.gain.linearRampToValueAtTime(0, t + 1.4);
        o.start(t); o.stop(t + 1.5);
      } else if (kind === 'icecrack') {
        this.sfx('ice_creak', { vol: 0.3 }); if (Math.random() < 0.4) setTimeout(() => this.sfx('ice_crack', { vol: 0.25 }), 400);
      } else if (kind === 'machinery') {
        const o = osc('square', 90 + Math.random() * 60); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
        o.connect(lp); lp.connect(out);
        out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.06, t + 0.02); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.start(t); o.stop(t + 0.45);
      } else if (kind === 'lava') { this.sfx('rumble', { vol: 0.25 }); }
      else if (kind === 'storm') { this.sfx('thunder_far', { vol: 0.5 }); }
    },

    update(dt, g) {
      if (!this.ctx || !this.ready) return;
      const e = this.engine;
      const t = this.ctx.currentTime;
      if (e && g && g.player) {
        const p = g.player;
        const alive = p.alive && p.dying <= 0 && AS.App.state === 'play';
        const thr = Math.abs(p.thrust) + Math.abs(p.strafeIn) * 0.6;
        const sp = p.speed / p.s.maxSpeed;
        const noFuel = p.fuel <= 0;
        const base = noFuel ? 38 + Math.random() * 6 : 52 + sp * 22 + (p.boosting ? 14 : 0);
        e.o1.frequency.setTargetAtTime(base, t, 0.12);
        e.o2.frequency.setTargetAtTime(base * 2.01, t, 0.12);
        e.lp.frequency.setTargetAtTime(300 + thr * 900 + (p.boosting ? 900 : 0), t, 0.1);
        e.w.frequency.setTargetAtTime(700 + sp * 500 + (p.boosting ? 400 : 0), t, 0.2);
        e.wg.gain.setTargetAtTime(alive ? 0.012 + sp * 0.02 : 0, t, 0.2);
        e.ng.gain.setTargetAtTime(alive ? sp * 0.18 + (p.boosting ? 0.1 : 0) : 0, t, 0.15);
        e.bp.frequency.setTargetAtTime(600 + sp * 1400, t, 0.2);
        e.out.gain.setTargetAtTime(alive ? (AS.App.state === 'play' ? 0.3 : 0.08) : 0, t, 0.3);
        // lateral thruster puffs
        const turn = Math.abs(p.turnIn) + Math.abs(p.strafeIn);
        if (turn > 0.5 && e.lastTurn <= 0.5 && alive) this.sfx('thruster');
        e.lastTurn = turn;
        // damage alarm loop when hull is critical
        if (alive && p.hull / p.s.hullMax < 0.2) { this.alarmT = (this.alarmT || 0) - dt; if (this.alarmT <= 0) { this.alarmT = 2.2; this.sfx('warning', { vol: 0.5 }); } }
      }
      // ambience events
      if (this.ambEvents.length && g && AS.App.state === 'play') {
        this.ambT -= dt;
        if (this.ambT <= 0) { this.ambT = 1.5 + Math.random() * 5; this.ambientEvent(U.pick(this.ambEvents)); }
      }
      if (this.updateHook) this.updateHook(dt, g);
    },
  };
  AS.Audio = Audio;
})(window.AS);
