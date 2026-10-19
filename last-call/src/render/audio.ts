/** Minimal synthesized sound: a click for shots, a filtered noise burst for blasts. Optional, mutable. */
export class Audio {
  private ctx: AudioContext | null = null;
  muted = false;
  private ensure(): AudioContext | null {
    if (this.muted) return null;
    try { if (!this.ctx) this.ctx = new AudioContext(); if (this.ctx.state === 'suspended') void this.ctx.resume(); return this.ctx; } catch { return null; }
  }
  shot(): void {
    const c = this.ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(420, c.currentTime); o.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.08);
    g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.11);
  }
  boom(size = 1): void {
    const c = this.ensure(); if (!c) return;
    const dur = 0.35 + 0.25 * size;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500 + 300 * size;
    const g = c.createGain(); g.gain.value = 0.18 * Math.min(1.4, size);
    src.connect(f).connect(g).connect(c.destination); src.start();
  }
  hit(): void {
    const c = this.ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, c.currentTime); o.frequency.exponentialRampToValueAtTime(110, c.currentTime + 0.12);
    g.gain.setValueAtTime(0.07, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.15);
  }
}
