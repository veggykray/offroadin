/* ALIEN STRIKE — layered procedural music.
 * Each world has its own key, mode, tempo, progression and instrument palette.
 * Layers fade in with combat intensity:
 *   0 explore  — pad, drone bass, sparse bell motif
 *   1 combat   — + rhythmic bass, arpeggio, light percussion
 *   2 battle   — + full drums, lead melody
 *   3 boss     — dedicated darker progression, heavier drums, distorted bass
 * Material re-generates every 8 bars (new arps / melodies, occasional breakdowns)
 * so it never loops one track. Victory / failure stingers on mission end.
 * AUDIO HOOK: place recorded stems in audio/music/ and point a world's music.files
 * at them to replace the generator (see README). */
'use strict';
(function (AS) {
  const SCALES = {
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], wholetone: [0, 2, 4, 6, 8, 10, 12],
  };
  const PROGS = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 4], [0, 2, 3, 4], [0, 5, 6, 4], [0, 3, 1, 4]];
  const BOSS_PROG = [0, 1, 0, 6];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const Music = {
    A: null, ctx: null, out: null, layers: [], world: null, playing: false,
    intensity: 0, target: 0, holdT: 0, step: 0, nextTime: 0, bar: 0, section: 0, rng: null, noise: null,
    attach(audio) {
      this.A = audio; this.ctx = audio.ctx;
      this.out = this.ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(audio.musicDuck);
      this.layers = [0, 1, 2, 3].map(() => { const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.out); return g; });
      this.stingBus = this.ctx.createGain(); this.stingBus.gain.value = 0.9; this.stingBus.connect(audio.musicBus);
      const nb = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = nb;
      // a gentle shared echo for space
      this.delay = this.ctx.createDelay(1); this.delay.delayTime.value = 0.36;
      this.fb = this.ctx.createGain(); this.fb.gain.value = 0.28;
      this.wet = this.ctx.createGain(); this.wet.gain.value = 0.22;
      this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.wet); this.wet.connect(this.out);
      if (this.pendingWorld) { const w = this.pendingWorld; this.pendingWorld = null; this.play(w); }
    },
    play(world, opts) {
      if (!this.ctx) { this.pendingWorld = world; return; }
      this.world = world;
      const m = world.music;
      this.cfg = m;
      this.scale = SCALES[m.scale] || SCALES.aeolian;
      this.root = m.root;
      this.tempo = m.tempo;
      this.rng = new AS.U.RNG(world.id * 1337 + Date.now() % 1000);
      this.prog = PROGS[(world.id * 7) % PROGS.length];
      this.step = 0; this.bar = 0; this.section = 0;
      this.nextTime = this.ctx.currentTime + 0.15;
      this.playing = true; this.intensity = 0; this.target = 0; this.holdT = 0;
      this.newSection();
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(0, t); this.out.gain.linearRampToValueAtTime(0.9, t + 3);
      this.layers.forEach((g, i) => g.gain.setTargetAtTime(i === 0 ? 1 : 0, t, 0.5));
    },
    stop() {
      if (!this.ctx) { this.pendingWorld = null; return; }
      this.playing = false;
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t); this.out.gain.setTargetAtTime(0, t, 0.6);
    },
    setIntensity(level) {
      if (level > this.target) { this.target = level; this.holdT = 9; }
      else if (level < this.target) { if (this.holdT <= 0) this.target = level; }
      else this.holdT = Math.max(this.holdT, 2);
    },
    newSection() {
      const r = this.rng;
      this.arpPat = [];
      const shapes = [[0, 1, 2, 1], [0, 2, 1, 2], [0, 1, 2, 3], [2, 1, 0, 1], [0, 2, 3, 1]];
      const sh = r.pick(shapes);
      for (let i = 0; i < 16; i++) this.arpPat.push(r.next() < 0.12 ? -1 : sh[i % sh.length] + (i >= 8 && r.next() < 0.3 ? 4 : 0));
      // lead melody: one bar motif, varied per bar
      this.melody = [];
      let deg = r.int(0, 4);
      for (let i = 0; i < 16; i++) {
        const on = i % 4 === 0 ? r.next() < 0.85 : i % 2 === 0 ? r.next() < 0.45 : r.next() < 0.18;
        if (on) { deg += r.pick([-2, -1, -1, 0, 1, 1, 2, 3]); deg = Math.max(-2, Math.min(9, deg)); this.melody.push({ i, deg, len: r.pick([1, 2, 2, 3, 4]) }); }
      }
      this.bellPat = [r.int(0, 15), r.int(0, 15)];
      this.bassPat = r.pick([[1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0], [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1], [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0]]);
      this.breakdown = this.section > 0 && this.section % 4 === 3 && r.next() < 0.6;
      if (r.next() < 0.25) this.prog = r.pick(PROGS);
    },
    deg(d, octave) {
      const s = this.scale, n = s.length;
      const o = Math.floor(d / n), i = ((d % n) + n) % n;
      return this.root + (octave || 0) * 12 + o * 12 + s[i];
    },
    chord(bar) {
      const p = this.target >= 3 ? BOSS_PROG : this.prog;
      const d = p[bar % p.length];
      return [d, d + 2, d + 4, d + 6];
    },

    update(dt) {
      if (!this.ctx || !this.playing) return;
      this.holdT -= dt;
      // smooth layer gains
      const t = this.ctx.currentTime;
      const lvl = this.target;
      if (lvl !== this.intensity) {
        this.intensity = lvl;
        const gains = lvl === 3 ? [0.6, 0, 0, 1] : [1, lvl >= 1 ? 1 : 0, lvl >= 2 ? 1 : 0, 0];
        this.layers.forEach((g, i) => g.gain.setTargetAtTime(gains[i], t, lvl > 0 ? 0.6 : 2.2));
      }
      // schedule ahead
      const tempo = this.tempo * (this.intensity === 3 ? 1.12 : 1);
      const sixteenth = 60 / tempo / 4;
      while (this.nextTime < t + 0.12) {
        this.schedule(this.step, this.nextTime, sixteenth);
        this.nextTime += sixteenth;
        this.step++;
        if (this.step % 16 === 0) { this.bar++; if (this.bar % 8 === 0) { this.section++; this.newSection(); } }
      }
    },

    schedule(step, time, six) {
      const i = step % 16, bar = this.bar;
      const ch = this.chord(bar);
      const L = this.layers, m = this.cfg;
      const boss = this.intensity === 3;
      const bd = this.breakdown && this.intensity < 2;
      // ---- layer 0: pad + drone + bells
      if (i === 0 && bar % 2 === 0) for (let k = 0; k < 3; k++) this.inst(m.pad, time, this.deg(ch[k], 0), six * 32, L[0], 0.09);
      if (i === 0) this.inst('drone', time, this.deg(ch[0], -2), six * 16, L[0], 0.16);
      if (!boss && (i === this.bellPat[0] || i === this.bellPat[1]) && (bar % 2 === 1) && !bd) this.inst('bell', time, this.deg(ch[(i % 3)] + 7, 0), six * 6, L[0], 0.06, true);
      // ---- layer 1: bass rhythm, arp, light perc
      if (!bd) {
        if (this.bassPat[i]) this.inst('bass', time, this.deg(ch[0], -1) + (i === 14 ? 7 : 0), six * 1.6, L[1], 0.2);
        const a = this.arpPat[i];
        if (a >= 0 && (i % 2 === 0 || this.cfg.tempo > 95)) this.inst(m.lead === 'pluck' || m.pad === 'organic' ? 'pluck' : 'arp', time, this.deg(ch[a % 4] + (a >= 4 ? 7 : 0), 1), six * 1.5, L[1], 0.06, true);
        this.perc(m.perc, i, time, L[1], 1);
      }
      // ---- layer 2: full drums + lead
      if (!bd) {
        this.drums(i, time, L[2], false);
        if (bar % 2 === 1) for (const n of this.melody) if (n.i === i) this.inst(m.lead, time, this.deg(n.deg + (bar % 4 === 3 ? 2 : 0), 1), six * n.len, L[2], 0.07, true);
      }
      // ---- layer 3: boss
      if (L[3].gain.value > 0.01 || boss) {
        if (i % 2 === 0) this.inst('bassdist', time, this.deg(ch[0], -1) + ((i === 6 || i === 14) ? 1 : 0), six * 1.8, L[3], 0.18);
        this.drums(i, time, L[3], true);
        if (i === 0 && bar % 2 === 0) for (let k = 0; k < 3; k++) this.inst('pad', time, this.deg(ch[k], 0), six * 32, L[3], 0.08);
        for (const n of this.melody) if (n.i === i && bar % 2 === 0) this.inst('saw', time, this.deg(n.deg, 1), six * n.len, L[3], 0.07, true);
        if (i === 0 && bar % 4 === 0) this.hit(time, L[3]);
      }
    },

    /* ---------- instruments ---------- */
    inst(kind, t, midi, dur, bus, vel, send) {
      const c = this.ctx;
      const f = mtof(midi);
      const g = c.createGain(); g.gain.value = 0; g.connect(bus);
      if (send) { const s = c.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.delay); }
      const env = (a, d, s, r) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.setTargetAtTime(vel * s, t + a, d); g.gain.setTargetAtTime(0, t + Math.max(a, dur), r); };
      const o = (type, freq, det) => { const x = c.createOscillator(); x.type = type; x.frequency.value = freq; if (det) x.detune.value = det; x.start(t); x.stop(t + dur + 2); return x; };
      const lp = (fc, q) => { const x = c.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = fc; x.Q.value = q || 0.7; x.connect(g); return x; };
      switch (kind) {
        case 'warm': case 'pad': case 'dark': case 'dry': {
          const fl = lp(kind === 'dark' ? 500 : kind === 'dry' ? 1400 : 900, 1);
          const tp = kind === 'dry' ? 'square' : 'sawtooth';
          o(tp, f, -8).connect(fl); o(tp, f, 8).connect(fl);
          if (kind === 'warm') o('triangle', f * 2, 0).connect(fl);
          env(0.6, 0.8, 0.8, 0.9);
          break;
        }
        case 'organic': { const fl = lp(1200, 2); o('triangle', f).connect(fl); o('sine', f * 2.005).connect(fl); env(0.4, 0.5, 0.7, 0.8); break; }
        case 'glass': { const car = o('sine', f); const mod = o('sine', f * 3.5); const mg = c.createGain(); mg.gain.value = f * 0.8; mod.connect(mg); mg.connect(car.frequency); car.connect(g); env(0.3, 1.5, 0.5, 1.2); break; }
        case 'tide': { const fl = lp(700, 0.7); o('sine', f).connect(fl); o('triangle', f * 1.002).connect(fl); env(1.2, 1, 0.9, 1.2); break; }
        case 'eerie': { const x = o('sine', f); const lfo = o('sine', 5.3); const lg = c.createGain(); lg.gain.value = f * 0.012; lfo.connect(lg); lg.connect(x.frequency); x.connect(g); o('sine', f * 1.5, 12).connect(g); env(0.9, 1, 0.8, 1.2); break; }
        case 'airy': { const fl = lp(2500, 0.5); o('triangle', f).connect(fl); o('triangle', f * 2, 6).connect(fl); env(0.5, 0.8, 0.7, 0.9); break; }
        case 'choir': {
          const src = o('sawtooth', f, -5); const src2 = o('sawtooth', f, 5);
          for (const fm of [700, 1150, 2600]) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm; bp.Q.value = 6; src.connect(bp); src2.connect(bp); bp.connect(g); }
          env(0.7, 1, 0.8, 1); g.gain.value = 0; vel *= 2.2; env(0.7, 1, 0.8, 1);
          break;
        }
        case 'drone': { const fl = lp(260, 1); o('sawtooth', f).connect(fl); o('sine', f / 2).connect(g); env(1.5, 2, 0.8, 1.5); break; }
        case 'bell': { const car = o('sine', f); const mod = o('sine', f * 2.76); const mg = c.createGain(); mg.gain.value = f * 1.2; mg.gain.setTargetAtTime(0, t, 0.4); mod.connect(mg); mg.connect(car.frequency); car.connect(g); env(0.005, 0.5, 0.2, 0.8); break; }
        case 'bass': { const fl = lp(420, 4); o('triangle', f).connect(fl); o('square', f / 2).connect(fl); env(0.005, 0.12, 0.5, 0.08); break; }
        case 'bassdist': {
          const ws = c.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); } ws.curve = curve;
          const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 3;
          o('sawtooth', f).connect(ws); ws.connect(fl); fl.connect(g);
          fl.frequency.setValueAtTime(1800, t); fl.frequency.setTargetAtTime(300, t, 0.08);
          env(0.005, 0.1, 0.6, 0.08); break;
        }
        case 'arp': case 'square': {
          const fl = lp(2200, 3); o(kind === 'arp' ? 'sawtooth' : 'square', f).connect(fl);
          fl.frequency.setValueAtTime(3000, t); fl.frequency.setTargetAtTime(700, t, 0.08);
          env(0.004, 0.1, 0.3, 0.1); break;
        }
        case 'pluck': { const fl = lp(3000, 2); o('triangle', f).connect(fl); o('sawtooth', f, 4).connect(fl); fl.frequency.setValueAtTime(4000, t); fl.frequency.setTargetAtTime(500, t, 0.05); env(0.003, 0.08, 0.2, 0.15); break; }
        case 'saw': { const fl = lp(1800, 1.5); o('sawtooth', f, -6).connect(fl); o('sawtooth', f, 6).connect(fl); env(0.02, 0.3, 0.7, 0.2); break; }
        case 'sine': { const x = o('sine', f); const lfo = o('sine', 6); const lg = c.createGain(); lg.gain.value = f * 0.008; lfo.connect(lg); lg.connect(x.frequency); x.connect(g); env(0.04, 0.3, 0.8, 0.3); break; }
        default: { o('triangle', f).connect(g); env(0.01, 0.2, 0.5, 0.2); }
      }
    },
    noiseSrc(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; },
    kick(t, bus, v) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4);
    },
    snare(t, bus, v) {
      const c = this.ctx, n = this.noiseSrc(t, 0.25), hp = c.createBiquadFilter(), g = c.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1200; n.connect(hp); hp.connect(g); g.connect(bus);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      const o = c.createOscillator(), og = c.createGain(); o.frequency.value = 190; o.connect(og); og.connect(bus);
      og.gain.setValueAtTime(v * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.start(t); o.stop(t + 0.12);
    },
    hat(t, bus, v, open) {
      const c = this.ctx, n = this.noiseSrc(t, open ? 0.3 : 0.06), hp = c.createBiquadFilter(), g = c.createGain();
      hp.type = 'highpass'; hp.frequency.value = 7000; n.connect(hp); hp.connect(g); g.connect(bus);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.05));
    },
    tom(t, bus, v, f) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.25);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
    },
    clank(t, bus, v) {
      const c = this.ctx, o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), bp = c.createBiquadFilter(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 420; m.frequency.value = 1130; mg.gain.value = 600; m.connect(mg); mg.connect(o.frequency);
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 3; o.connect(bp); bp.connect(g); g.connect(bus);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); m.start(t); o.stop(t + 0.15); m.stop(t + 0.15);
    },
    wood(t, bus, v) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.value = 820; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.07); },
    perc(style, i, t, bus, k) {
      switch (style) {
        case 'tribal': if (i % 4 === 2) this.tom(t, bus, 0.25 * k, 160); if (i === 7 || i === 15) this.tom(t, bus, 0.18 * k, 110); if (i % 2 === 1) this.hat(t, bus, 0.04 * k); break;
        case 'industrial': if (i % 4 === 2) this.clank(t, bus, 0.12 * k); if (i % 2 === 0) this.hat(t, bus, 0.05 * k); break;
        case 'wood': if (i % 3 === 0) this.wood(t, bus, 0.12 * k); if (i % 4 === 2) this.hat(t, bus, 0.04 * k, true); break;
        case 'soft': if (i % 4 === 2) this.hat(t, bus, 0.05 * k, true); if (i === 12) this.wood(t, bus, 0.06 * k); break;
        case 'driving': default: if (i % 2 === 0) this.hat(t, bus, 0.06 * k); if (i % 4 === 2) this.hat(t, bus, 0.04 * k, true); break;
      }
    },
    drums(i, t, bus, heavy) {
      if (heavy) { if (i % 4 === 0 || i === 10) this.kick(t, bus, 0.5); if (i % 8 === 4) this.snare(t, bus, 0.3); if (i % 2 === 0) this.hat(t, bus, 0.06); if (i === 14) this.tom(t, bus, 0.25, 120); return; }
      if (i === 0 || i === 8 || i === 10) this.kick(t, bus, 0.42);
      if (i === 4 || i === 12) this.snare(t, bus, 0.24);
      if (i % 2 === 0) this.hat(t, bus, 0.05);
    },
    hit(t, bus) {
      const c = this.ctx, n = this.noiseSrc(t, 1.6), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 1.2);
      n.connect(lp); lp.connect(g); g.connect(bus); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      this.kick(t, bus, 0.6);
    },

    /* ---------- stingers ---------- */
    stinger(kind) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05;
      const bus = this.stingBus;
      const root = this.root || 50;
      this.playing = false;
      this.out.gain.setTargetAtTime(0, t, 0.3);
      if (kind === 'victory') {
        const notes = [0, 4, 7, 12, 16];
        notes.forEach((n, i) => this.inst('saw', t + i * 0.11, root + 12 + n, 0.5, bus, 0.09, true));
        [0, 4, 7, 12].forEach((n) => this.inst('warm', t + 0.6, root + n, 2.6, bus, 0.08));
        this.inst('bell', t + 0.6, root + 24, 2, bus, 0.08, true);
        this.hit(t + 0.6, bus); this.hat(t + 0.6, bus, 0.15, true);
      } else if (kind === 'fail') {
        [0, -1, -3, -5].forEach((n, i) => this.inst('saw', t + i * 0.32, root + 12 + n, 0.5, bus, 0.08));
        [0, 3, 7].forEach((n) => this.inst('dark', t + 1.3, root - 12 + n, 3, bus, 0.1));
        this.hit(t + 1.3, bus);
      } else if (kind === 'boss') {
        this.hit(t, bus);
      }
    },
  };
  AS.Music = Music;
})(window.AS);
