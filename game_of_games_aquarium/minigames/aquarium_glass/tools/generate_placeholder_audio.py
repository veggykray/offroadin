#!/usr/bin/env python3
"""Generates the placeholder sound effects in ../audio/ (mono, 16-bit WAV).

Everything is synthesised, so the module ships with working audio and no
licensing questions. Replace any file with a real recording of the same name
(see README -> "How to replace placeholder audio").

    pip install numpy
    python3 generate_placeholder_audio.py
"""
import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio")
rng = np.random.default_rng(1234)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_exp(dur, decay):
    return np.exp(-t_axis(dur) * decay)


def sine(freq, dur, phase=0.0):
    t = t_axis(dur)
    if callable(freq):
        f = freq(t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)
    return np.sin(2 * np.pi * freq * t + phase)


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def bandpass(x, lo, hi):
    return lowpass(highpass(x, lo), hi)


def pad(x, dur):
    n = int(dur * SR)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(pad(p, n / SR) for p in parts)


def place(buf, x, at):
    i = int(at * SR)
    end = min(len(buf), i + len(x))
    buf[i:end] += x[: end - i]
    return buf


def fade(x, fin=0.005, fout=0.02):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        x[:a] *= np.linspace(0, 1, a)
    if b > 0:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def save(name, x, peak=0.85, loop=False):
    x = np.asarray(x, dtype=np.float64)
    if not loop:
        x = fade(x)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    data = (x * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print("wrote", name)


# ---------------------------------------------------------------- glass

def tok(pitch=1.0, dur=0.18):
    body = mix(
        sine(1850 * pitch, dur) * env_exp(dur, 55) * 0.6,
        sine(2950 * pitch, dur) * env_exp(dur, 70) * 0.35,
        sine(4400 * pitch, dur) * env_exp(dur, 90) * 0.2,
        sine(240 * pitch, dur) * env_exp(dur, 40) * 0.9,
        highpass(noise(0.006), 2000) * 0.8,
    )
    return body


save("glass_tap", tok())
save("glass_double_tap", mix(tok(1.06, 0.3) * 0.5, sine(2600, 0.4) * env_exp(0.4, 9) * 0.15), peak=0.6)

knock = mix(
    sine(lambda t: 95 - 30 * t, 0.7) * env_exp(0.7, 9) * 1.0,
    sine(170, 0.5) * env_exp(0.5, 14) * 0.6,
    lowpass(noise(0.05), 1200) * env_exp(0.05, 60) * 1.2,
    sine(1250, 0.9) * env_exp(0.9, 6) * 0.18,
    sine(2120, 0.9) * env_exp(0.9, 8) * 0.12,
)
save("hard_knock", knock, peak=0.95)


def rub_loop(dur=1.0):
    t = t_axis(dur)
    f = 1050 + 180 * np.sin(2 * np.pi * 2 * t) + 60 * np.sin(2 * np.pi * 7 * t)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    stick = (np.sin(2 * np.pi * 22 * t) > 0.2).astype(float)
    stick = lowpass(stick, 200)
    n = bandpass(noise(dur), 700, 2500) * 0.4
    return (tone * 0.5 + n) * (0.3 + 0.7 * stick)


save("glass_rub", rub_loop(), peak=0.5, loop=True)


def scratch_loop(dur=0.5):
    t = t_axis(dur)
    bursts = np.clip(np.sin(2 * np.pi * 16 * t), 0, 1) ** 3
    return highpass(noise(dur), 1800) * bursts


save("glass_scratch", scratch_loop(), peak=0.55, loop=True)


def creak(dur=1.6):
    buf = np.zeros(int(dur * SR))
    tt = 0.0
    while tt < dur - 0.05:
        rate = 30 + 60 * (tt / dur)
        pulse = bandpass(noise(0.02), 250, 900) * env_exp(0.02, 150)
        place(buf, pulse, tt)
        tt += 1.0 / rate * rng.uniform(0.8, 1.2)
    return buf * np.sin(np.pi * t_axis(dur) / dur)


save("glass_stress", mix(creak(), sine(lambda t: 140 + 30 * t, 1.6) * env_exp(1.6, 1.5) * 0.15), peak=0.7)
crack = np.zeros(int(0.45 * SR))
for k in range(7):
    place(crack, highpass(noise(0.01), 2500) * env_exp(0.01, 300), k * 0.03 + rng.uniform(0, 0.02))
crack = mix(crack, sine(3200, 0.45) * env_exp(0.45, 12) * 0.2)
save("glass_crack", crack, peak=0.8)

# ---------------------------------------------------------------- water


def ambience(dur=8.0):
    n = noise(dur)
    brown = np.cumsum(n)
    brown = highpass(brown - np.mean(brown), 15)
    brown = lowpass(brown, 300)
    brown /= np.max(np.abs(brown))
    t = t_axis(dur)
    lfo = 0.7 + 0.3 * np.sin(2 * np.pi * t / dur * 2)
    drone = sine(55, dur) * 0.08 + sine(82.5, dur) * 0.04
    buf = brown * lfo + drone
    for i in range(10):
        at = rng.uniform(0.2, dur - 0.3)
        place(buf, bubble_blip(rng.uniform(500, 1100)) * 0.12, at)
    # Make it loop seamlessly: crossfade the tail into the head.
    x = int(0.5 * SR)
    head = buf[:x].copy()
    buf[:x] = head * np.linspace(0, 1, x) + buf[-x:] * np.linspace(1, 0, x)
    return buf[:-x]


def bubble_blip(f0):
    d = 0.05
    return sine(lambda t: f0 + 9000 * t, d) * env_exp(d, 60)


save("ambience", ambience(), peak=0.45, loop=True)
bub = np.zeros(int(0.7 * SR))
for i in range(6):
    place(bub, bubble_blip(rng.uniform(400, 900)), rng.uniform(0, 0.6))
save("bubbles", bub, peak=0.6)
save("chute_suck", mix(sine(lambda t: 500 - 380 * t, 0.9) * env_exp(0.9, 3) * 0.5, lowpass(noise(0.9), 600) * env_exp(0.9, 4) * 0.6), peak=0.7)

# ---------------------------------------------------------------- creatures

save("blimp_move", mix(sine(lambda t: 80 + 10 * np.sin(2 * np.pi * 6 * t), 0.8) * np.sin(np.pi * t_axis(0.8) / 0.8) * 0.8, bub[: int(0.8 * SR)] * 0.3), peak=0.6)
save("blimp_impact", mix(sine(lambda t: 90 - 50 * t, 0.45) * env_exp(0.45, 8), lowpass(noise(0.1), 400) * env_exp(0.1, 30) * 0.8, sine(lambda t: 220 + 80 * np.sin(2 * np.pi * 9 * t), 0.4) * env_exp(0.4, 9) * 0.25), peak=0.9)


def chitter(dur=1.0, density=40):
    buf = np.zeros(int(dur * SR))
    for i in range(int(dur * density)):
        f = rng.uniform(1800, 4200)
        d = rng.uniform(0.015, 0.04)
        place(buf, sine(lambda t: f + rng.uniform(-3000, 3000) * t, d) * env_exp(d, 90), rng.uniform(0, dur - d))
    return buf


save("bastard_swarm", chitter(1.0, 45), peak=0.5)
save("bastard_swarm_loop", chitter(1.0, 30), peak=0.4, loop=True)
save("bastard_bite", mix(highpass(noise(0.004), 3000), sine(3100, 0.05) * env_exp(0.05, 80) * 0.6, sine(900, 0.04) * env_exp(0.04, 100) * 0.5), peak=0.7)
save("coward_startle", mix(sine(lambda t: 650 + 7000 * t + 60 * np.sin(2 * np.pi * 30 * t), 0.18) * env_exp(0.18, 10), highpass(noise(0.12), 1500) * env_exp(0.12, 25) * 0.3), peak=0.7)
dash_t = t_axis(0.55)
dash = bandpass(noise(0.55), 300, 3000) * np.sin(np.pi * dash_t / 0.55) ** 2
save("coward_dash", dash, peak=0.6)
save("coward_impact", mix(sine(lambda t: 140 - 70 * t, 0.35) * env_exp(0.35, 11), bandpass(noise(0.2), 200, 2500) * env_exp(0.2, 18) * 0.9), peak=0.95)
save("sucker_attach", mix(sine(lambda t: 420 - 600 * t, 0.28) * env_exp(0.28, 10), lowpass(noise(0.25), 900) * env_exp(0.25, 14) * 0.7), peak=0.7)
idiot = mix(
    sine(lambda t: 950 + 250 * np.sin(2 * np.pi * 14 * t), 0.12) * env_exp(0.12, 8),
    pad(np.zeros(int(0.1 * SR)), 0.1),
)
idiot = np.concatenate([idiot, sine(lambda t: 1250 + 300 * t + 150 * np.sin(2 * np.pi * 18 * t), 0.18) * env_exp(0.18, 9)])
save("idiot_noise", idiot, peak=0.6)

# ---------------------------------------------------------------- shell & memory

save("shell_move", lowpass(noise(0.4), 500) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 11 * t_axis(0.4)))) * env_exp(0.4, 5), peak=0.5)
sc = np.zeros(int(0.6 * SR))
for k in range(5):
    place(sc, highpass(noise(0.015), 1200) * env_exp(0.015, 200), k * 0.05 + rng.uniform(0, 0.02))
save("shell_crack", mix(sc, sine(lambda t: 180 - 60 * t, 0.6) * env_exp(0.6, 8) * 0.6), peak=0.9)
save("rope_snap", mix(highpass(noise(0.01), 1500) * 2, sine(220, 0.7) * env_exp(0.7, 6) * 0.6, sine(330, 0.5) * env_exp(0.5, 9) * 0.3), peak=0.9)


def chime(notes, dur=1.6, spacing=0.09):
    buf = np.zeros(int(dur * SR))
    for i, f in enumerate(notes):
        d = dur - i * spacing
        place(buf, (sine(f, d) + 0.3 * sine(f * 2.01, d)) * env_exp(d, 3.5), i * spacing)
    return buf


save("memory_release", chime([880, 1108.7, 1318.5, 1760, 2217], 1.8), peak=0.6)
save("memory_shimmer", chime([1318.5, 1760], 0.9, 0.12), peak=0.4)
save("completion", chime([523.25, 659.25, 783.99, 1046.5], 2.2, 0.16), peak=0.55)

# ---------------------------------------------------------------- the deep

rt = t_axis(3.0)
rumble = lowpass(noise(3.0), 90) * 3.0 + sine(lambda t: 38 + 4 * np.sin(2 * np.pi * 0.7 * t), 3.0) * 0.5
save("deep_rumble", rumble * np.sin(np.pi * rt / 3.0), peak=0.85)
at = t_axis(6.0)
approach = (sine(lambda t: 30 + 15 * t / 6.0, 6.0) * 0.7 + lowpass(noise(6.0), 120) * 2.0 * (at / 6.0)) * np.minimum(1, at / 4.0) * np.minimum(1, (6.0 - at) / 0.8)
save("deep_approach", approach, peak=0.9)
boom = mix(
    sine(lambda t: 32 + 45 * np.exp(-t * 4), 3.5) * env_exp(3.5, 1.3) * 1.0,
    lowpass(noise(0.4), 300) * env_exp(0.4, 9) * 1.5,
    sine(620, 2.5) * env_exp(2.5, 2.2) * 0.12,
    sine(910, 2.0) * env_exp(2.0, 3.0) * 0.08,
)
save("final_tap", boom, peak=1.0)

# ---------------------------------------------------------------- chase music (placeholder loop, 120 bpm, 4 s)

bpm = 120
beat = 60 / bpm
music = np.zeros(int(16 * beat / 2 * SR))
bass = [110, 110, 130.8, 110, 146.8, 130.8, 110, 98]
for i in range(16):
    f = bass[i % 8]
    d = beat / 2
    note = (sine(f, d) + 0.5 * sine(f * 2, d) + 0.25 * sine(f * 3, d)) * env_exp(d, 9)
    place(music, note * 0.6, i * d)
    place(music, highpass(noise(0.02), 6000) * env_exp(0.02, 150) * 0.25, i * d)
    if i % 4 == 2:
        place(music, (sine(f * 4, d) * env_exp(d, 12)) * 0.25, i * d)
save("chase_music", music, peak=0.5, loop=True)
