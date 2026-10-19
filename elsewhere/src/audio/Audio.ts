/**
 * Small synthesized sound set (no files): footsteps, valve creak, channel flow, the louder lift,
 * a rejection sag and a soft chime. Starts only after a user gesture; mute and pause supported.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private flowGain!: GainNode; private liftGain!: GainNode; private liftOsc!: OscillatorNode;
  muted = false; private paused = false;
  private stepT = 0;

  get ready(): boolean { return !!this.ctx; }

  /** Call from a user gesture. */
  start(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume(); return; }
    const C = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!C) return;
    const ctx = new C(); this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    // flow loop: filtered noise
    const noise = this.noiseSource(ctx); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    this.flowGain = ctx.createGain(); this.flowGain.gain.value = 0; noise.connect(bp).connect(this.flowGain).connect(this.master);
    // lift loop: low rumble (noise lowpass + sub oscillator with slow wobble)
    const n2 = this.noiseSource(ctx); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    this.liftGain = ctx.createGain(); this.liftGain.gain.value = 0; n2.connect(lp).connect(this.liftGain);
    this.liftOsc = ctx.createOscillator(); this.liftOsc.type = 'sine'; this.liftOsc.frequency.value = 52;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 1.7; const lfoG = ctx.createGain(); lfoG.gain.value = 6; lfo.connect(lfoG).connect(this.liftOsc.frequency); lfo.start();
    const og = ctx.createGain(); og.gain.value = 0.5; this.liftOsc.connect(og).connect(this.liftGain); this.liftOsc.start();
    this.liftGain.connect(this.master);
  }
  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s;
  }
  setMuted(m: boolean): void { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx!.currentTime, 0.05); }
  setPaused(p: boolean): void { this.paused = p; if (!this.ctx) return; if (p) void this.ctx.suspend(); else void this.ctx.resume(); }

  /** Per-frame levels: cyan flow activity 0..1, lift intensity 0..1.25, lift moving. */
  update(flow: number, lift: number, liftBusy: boolean, dt: number): void {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.flowGain.gain.setTargetAtTime(Math.min(1, flow) * 0.22, t, 0.2);
    const target = (0.05 + lift * 0.18) * (liftBusy ? 1.6 : 0.6);
    this.liftGain.gain.setTargetAtTime(Math.min(0.42, target), t, liftBusy ? 0.15 : 0.6);
    this.liftOsc.frequency.setTargetAtTime(liftBusy ? 58 + lift * 10 : 48, t, 0.3);
    this.stepT += dt;
  }
  step(heavy: boolean): void {
    if (!this.ctx || this.paused) return; const ctx = this.ctx; const t = ctx.currentTime;
    const src = this.noiseBurst(ctx, 0.07); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = heavy ? 240 : 1100; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(heavy ? 0.5 : 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.12 : 0.06));
    src.connect(f).connect(g).connect(this.master);
    if (heavy) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.1); const og = ctx.createGain(); og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.14); }
  }
  valve(): void {
    if (!this.ctx) return; const ctx = this.ctx; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(70, t + 0.55);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 0.65);
    const click = this.noiseBurst(ctx, 0.03); const cg = ctx.createGain(); cg.gain.setValueAtTime(0.3, t + 0.5); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.56); click.connect(cg).connect(this.master);
  }
  scrape(): void {
    if (!this.ctx) return; const ctx = this.ctx; const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) { const s = this.noiseBurst(ctx, 0.12, t + i * 0.28); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700 + i * 90; f.Q.value = 0.8; const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t + i * 0.28); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.28 + 0.14); s.connect(f).connect(g).connect(this.master); }
  }
  reject(): void {
    if (!this.ctx) return; const ctx = this.ctx; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.9);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0); o.connect(g).connect(this.master); o.start(t); o.stop(t + 1.05);
  }
  chime(high = false): void {
    if (!this.ctx) return; const ctx = this.ctx; const t = ctx.currentTime;
    for (const [i, fr] of (high ? [660, 880, 1320] : [523, 784]).entries()) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.12 + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.7); o.connect(g).connect(this.master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.75); }
  }
  bridgeForm(): void {
    if (!this.ctx) return; const ctx = this.ctx; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6); o.connect(g).connect(this.master); o.start(t); o.stop(t + 1.7);
  }
  private noiseBurst(ctx: AudioContext, secs: number, at = ctx.currentTime): AudioBufferSourceNode {
    const len = Math.floor(ctx.sampleRate * secs); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf; s.start(at); return s;
  }
}
