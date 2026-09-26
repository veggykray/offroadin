/**
 * Tiny WebAudio synth — no audio files needed for the prototype.
 * Engine drone for the player, thumps for impacts/landings, whoosh for nitro,
 * splash, pickup chime, countdown beeps, and a comedy "boing" for falling off the world.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineOsc!: OscillatorNode;
  private engineOsc2!: OscillatorNode;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;
  muted = false;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 600;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  engine(speedFrac: number, throttle: number, nitro: boolean, airborne: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rev = Math.min(1.4, speedFrac * 0.9 + throttle * 0.25 + (airborne ? 0.25 : 0));
    const f = 42 + rev * 95 + (nitro ? 25 : 0);
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(350 + rev * 900 + (nitro ? 600 : 0), t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.07 + throttle * 0.05 + (nitro ? 0.05 : 0), t, 0.1);
  }

  silenceEngine(): void {
    if (this.ctx) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  private noise(duration: number, type: BiquadFilterType, freq: number, gain: number, sweepTo?: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + duration);
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, freqTo?: number, delay = 0): void {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  impact(strength: number): void {
    const g = Math.min(0.9, 0.15 + strength * 0.06);
    this.noise(0.25, 'lowpass', 500, g);
    this.tone(70, 0.2, 'sine', g * 0.8, 35);
  }

  landing(quality: 'clean' | 'rough' | 'hard'): void {
    this.noise(0.3, 'lowpass', quality === 'hard' ? 700 : 350, quality === 'hard' ? 0.8 : 0.35);
    this.tone(55, 0.25, 'sine', quality === 'hard' ? 0.7 : 0.3, 30);
  }

  nitro(): void {
    this.noise(1.2, 'bandpass', 300, 0.5, 2400);
    this.tone(110, 0.9, 'sawtooth', 0.12, 330);
  }

  splash(): void {
    this.noise(0.5, 'highpass', 900, 0.35, 300);
  }

  pickup(): void {
    this.tone(660, 0.12, 'triangle', 0.25);
    this.tone(990, 0.18, 'triangle', 0.25, undefined, 0.08);
  }

  beep(go: boolean): void {
    this.tone(go ? 880 : 440, go ? 0.5 : 0.18, 'square', 0.18);
  }

  boing(): void {
    this.tone(180, 0.6, 'sine', 0.5, 900);
    this.tone(900, 0.5, 'triangle', 0.25, 120, 0.25);
  }

  poof(): void {
    this.noise(0.35, 'bandpass', 1200, 0.25, 300);
  }

  lap(): void {
    this.tone(523, 0.12, 'triangle', 0.25);
    this.tone(784, 0.25, 'triangle', 0.25, undefined, 0.1);
  }
}
