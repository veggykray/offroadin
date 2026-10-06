/* ALIEN STRIKE — offline sound synthesis.
 * Every sound effect is rendered once at start-up into an AudioBuffer from a small
 * recipe (oscillators, noise, envelopes, filters, distortion). This keeps the game
 * self-contained; any recipe can be replaced by a recorded file through
 * data/audio.js (set `file:` for that sound id). */
'use strict';
(function (AS) {
  const TAU = Math.PI * 2;

  function rngFactory(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; }; }

  /* One-pole/biquad-ish helpers working on Float32Arrays */
  function lowpass(buf, sr, cutoffFn) {
    let y = 0;
    for (let i = 0; i < buf.length; i++) {
      const fc = typeof cutoffFn === 'function' ? cutoffFn(i / sr) : cutoffFn;
      const a = 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr);
      y += (buf[i] - y) * a; buf[i] = y;
    }
  }
  function highpass(buf, sr, fc) {
    let y = 0, px = 0;
    const a = Math.exp(-TAU * fc / sr);
    for (let i = 0; i < buf.length; i++) { const x = buf[i]; y = a * (y + x - px); px = x; buf[i] = y; }
  }
  // resonant state-variable bandpass
  function bandpass(buf, sr, fcFn, q) {
    let low = 0, band = 0;
    q = q || 0.5;
    for (let i = 0; i < buf.length; i++) {
      const fc = typeof fcFn === 'function' ? fcFn(i / sr) : fcFn;
      const f = 2 * Math.sin(Math.PI * Math.min(fc, sr * 0.2) / sr);
      low += f * band;
      const high = buf[i] - low - q * band;
      band += f * high;
      buf[i] = band;
    }
  }
  function drive(buf, k) { for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * k) / Math.tanh(k); }
  function normalize(buf, peak) {
    let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    if (m > 0) { const k = (peak || 0.9) / m; for (let i = 0; i < buf.length; i++) buf[i] *= k; }
  }
  function env(t, a, d, s, r, dur) {
    // ADSR with total duration
    if (t < a) return t / a;
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
    if (t < dur - r) return s;
    return Math.max(0, s * (dur - t) / r);
  }
  const expDecay = (t, k) => Math.exp(-t * k);

  /* Oscillator sample for a given phase (0..1) */
  function osc(type, ph) {
    ph -= Math.floor(ph);
    switch (type) {
      case 'sine': return Math.sin(ph * TAU);
      case 'square': return ph < 0.5 ? 1 : -1;
      case 'saw': return ph * 2 - 1;
      case 'tri': return ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
      default: return Math.sin(ph * TAU);
    }
  }

  /* ---- generic voice: tone with pitch envelope + noise layer ---- */
  function render(sr, spec) {
    const dur = spec.dur || 0.3;
    const n = Math.ceil(sr * dur);
    const out = new Float32Array(n);
    const rnd = rngFactory(spec.seed || 12345);
    for (const L of spec.layers) {
      const tmp = new Float32Array(n);
      let ph = 0, ph2 = 0;
      const start = Math.floor((L.at || 0) * sr);
      for (let i = start; i < n; i++) {
        const t = (i - start) / sr;
        const ldur = L.dur || dur;
        if (t > ldur) break;
        let a = L.env ? env(t, L.env[0], L.env[1], L.env[2], L.env[3], ldur) : expDecay(t, L.decay || 8);
        if (L.trem) a *= 0.5 + 0.5 * Math.sin(t * TAU * L.trem);
        let v;
        if (L.type === 'noise') v = rnd();
        else if (L.type === 'crackle') v = Math.random() < (L.density || 0.05) ? rnd() : 0;
        else {
          const f0 = L.f, f1 = L.f1 !== undefined ? L.f1 : L.f;
          const k = L.curve === 'lin' ? Math.min(1, t / (L.sweep || ldur)) : 1 - Math.exp(-t / ((L.sweep || ldur) * 0.35));
          let f = f0 + (f1 - f0) * k;
          if (L.vib) f *= 1 + Math.sin(t * TAU * L.vib) * (L.vibAmt || 0.03);
          ph += f / sr;
          v = osc(L.type, ph);
          if (L.fm) { ph2 += (f * L.fm) / sr; v = osc(L.type, ph + Math.sin(ph2 * TAU) * (L.fmAmt || 1)); }
        }
        tmp[i] = v * a * (L.gain === undefined ? 1 : L.gain);
      }
      if (L.lp) lowpass(tmp, sr, typeof L.lp === 'object' ? ((t) => L.lp[0] + (L.lp[1] - L.lp[0]) * Math.min(1, t / (L.lpT || dur))) : L.lp);
      if (L.hp) highpass(tmp, sr, L.hp);
      if (L.bp) bandpass(tmp, sr, typeof L.bp === 'object' ? ((t) => L.bp[0] + (L.bp[1] - L.bp[0]) * Math.min(1, t / (L.bpT || dur))) : L.bp, L.q);
      if (L.drive) drive(tmp, L.drive);
      for (let i = 0; i < n; i++) out[i] += tmp[i];
    }
    if (spec.drive) drive(out, spec.drive);
    // fade-out guard
    const fo = Math.min(n, Math.floor(sr * 0.01));
    for (let i = 0; i < fo; i++) out[n - 1 - i] *= i / fo;
    normalize(out, spec.peak || 0.85);
    return out;
  }

  /* ---- looping beds for ambience ---- */
  function bed(sr, kind, dur) {
    const n = Math.floor(sr * dur);
    const out = new Float32Array(n);
    const rnd = rngFactory(kind.length * 977 + 3);
    switch (kind) {
      case 'wind': {
        for (let i = 0; i < n; i++) out[i] = rnd();
        bandpass(out, sr, (t) => 380 + 260 * Math.sin(t * TAU / dur * 2) + 160 * Math.sin(t * TAU / dur * 5 + 1), 0.6);
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.6 + 0.4 * Math.sin(t * TAU / dur * 3 + 0.5); }
        break;
      }
      case 'sandhiss': { for (let i = 0; i < n; i++) out[i] = rnd(); highpass(out, sr, 2500); for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.4 + 0.6 * Math.abs(Math.sin(t * TAU / dur * 4)); } break; }
      case 'waves': {
        for (let i = 0; i < n; i++) out[i] = rnd();
        lowpass(out, sr, (t) => 500 + 900 * Math.pow(Math.max(0, Math.sin(t * TAU / dur * 4)), 3));
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * TAU / dur * 4)), 2); }
        break;
      }
      case 'hum': { let ph = 0, ph2 = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += 55 / sr; ph2 += 82.5 / sr; out[i] = Math.sin(ph * TAU) * 0.5 + Math.sin(ph2 * TAU) * 0.3 + Math.sin(ph * TAU * 3) * 0.08 * (1 + Math.sin(t * TAU / dur * 2)); } break; }
      case 'machinery': {
        let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / sr; ph += 48 / sr; out[i] = osc('saw', ph) * 0.3; const beat = (t * 2) % 1; if (beat < 0.05) out[i] += rnd() * (1 - beat / 0.05) * 0.8; }
        lowpass(out, sr, 900);
        break;
      }
      case 'lava': {
        for (let i = 0; i < n; i++) out[i] = rnd();
        lowpass(out, sr, 180);
        for (let i = 0; i < n; i++) if (Math.random() < 0.0004) { const len = Math.floor(sr * 0.06), f = 80 + Math.random() * 120; for (let k = 0; k < len && i + k < n; k++) out[i + k] += Math.sin(k / sr * TAU * f * (1 + k / len)) * (1 - k / len) * 2; }
        break;
      }
      case 'rain': {
        // steady rain: bright hiss with a soft low wash and scattered drips
        for (let i = 0; i < n; i++) out[i] = rnd();
        bandpass(out, sr, (t) => 4200 + 900 * Math.sin(t * TAU / dur * 2), 0.35);
        for (let i = 0; i < n; i++) if (Math.random() < 0.002) { const len = Math.floor(sr * 0.012), f = 1800 + Math.random() * 2400; for (let k = 0; k < len && i + k < n; k++) out[i + k] += Math.sin(k / sr * TAU * f) * (1 - k / len) * 0.9; }
        break;
      }
      case 'storm': { for (let i = 0; i < n; i++) out[i] = rnd(); lowpass(out, sr, (t) => 250 + 150 * Math.sin(t * TAU / dur * 3)); break; }
      case 'jungle': {
        for (let i = 0; i < n; i++) out[i] = rnd() * 0.3;
        bandpass(out, sr, 4500, 0.3);
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.5 + 0.5 * Math.sin(t * TAU * 11) * Math.sin(t * TAU * 0.5); }
        break;
      }
      case 'forest': {
        // leaves rustling in gusts: soft high band noise with slow swells
        for (let i = 0; i < n; i++) out[i] = rnd();
        bandpass(out, sr, (t) => 1800 + 700 * Math.sin(t * TAU / dur * 3), 0.4);
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * TAU / dur * 2 + Math.sin(t * TAU / dur * 5)), 2); }
        break;
      }
      case 'river': {
        // babbling water: dense filtered noise with bubbly amplitude flutter
        for (let i = 0; i < n; i++) out[i] = rnd();
        bandpass(out, sr, (t) => 900 + 500 * Math.sin(t * TAU * 0.7) + 300 * Math.sin(t * TAU * 2.3), 0.5);
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.6 + 0.4 * Math.sin(t * TAU * 6.1 + Math.sin(t * TAU * 1.3) * 3); }
        break;
      }
      case 'blizzard': {
        for (let i = 0; i < n; i++) out[i] = rnd();
        bandpass(out, sr, (t) => 600 + 500 * Math.sin(t * TAU / dur * 3) + 300 * Math.sin(t * TAU / dur * 7 + 2), 0.7);
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.45 + 0.55 * Math.abs(Math.sin(t * TAU / dur * 2.5)); }
        break;
      }
      case 'village': {
        // distant murmur of voices: formant-filtered noise bursts
        for (let i = 0; i < n; i++) out[i] = rnd() * 0.4;
        bandpass(out, sr, (t) => 500 + 300 * Math.sin(t * TAU * 1.7) + 200 * Math.sin(t * TAU * 3.1), 0.9);
        for (let i = 0; i < n; i++) { const t = i / sr; out[i] *= 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * TAU * 0.9) * Math.sin(t * TAU * 2.3)), 1); }
        break;
      }
      case 'cursed': {
        // low wavering drone with a breathy whisper on top
        let ph = 0, ph2 = 0;
        for (let i = 0; i < n; i++) { const t = i / sr; ph += (41 + Math.sin(t * TAU / dur * 2) * 2) / sr; ph2 += 61.5 / sr; out[i] = Math.sin(ph * TAU) * 0.5 + Math.sin(ph2 * TAU) * 0.25 + rnd() * 0.06; }
        lowpass(out, sr, 700);
        break;
      }
      default: for (let i = 0; i < n; i++) out[i] = rnd() * 0.1;
    }
    // seamless loop crossfade
    const xf = Math.floor(sr * 0.5);
    for (let i = 0; i < xf; i++) { const k = i / xf; out[i] = out[i] * k + out[n - xf + i] * (1 - k); }
    normalize(out, 0.7);
    return out.subarray(0, n - xf);
  }

  AS.Synth = { render, bed, lowpass, highpass, bandpass, drive, normalize, osc };
})(window.AS);
