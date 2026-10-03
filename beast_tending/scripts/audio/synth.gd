class_name Synth
extends RefCounted
## Offline procedural synthesis of every creature noise. Nothing is sampled;
## each sound is built from oscillators, noise and filters at start-up and
## stored as an AudioStreamWAV. Swap any of them for recorded audio by putting
## a file in res://audio/<name>.wav or .ogg (see BeastVoice).

const RATE := 22050
const NAMES := [&"grunt", &"huff", &"creak", &"rumble", &"purr", &"moan", &"groan", &"bellow",
	&"whine", &"yelp", &"sigh", &"exhale", &"thump", &"crash", &"rustle", &"chime", &"twang",
	&"squeak", &"hoot", &"roar"]


class Biquad:
	var b0 := 0.0
	var b1 := 0.0
	var b2 := 0.0
	var a1 := 0.0
	var a2 := 0.0
	var x1 := 0.0
	var x2 := 0.0
	var y1 := 0.0
	var y2 := 0.0

	func bandpass(freq: float, q: float) -> Biquad:
		var w := TAU * clampf(freq, 20.0, RATE * 0.45) / RATE
		var alpha := sin(w) / (2.0 * q)
		var a0 := 1.0 + alpha
		b0 = alpha / a0
		b1 = 0.0
		b2 = -alpha / a0
		a1 = -2.0 * cos(w) / a0
		a2 = (1.0 - alpha) / a0
		return self

	func lowpass(freq: float, q: float = 0.707) -> Biquad:
		var w := TAU * clampf(freq, 20.0, RATE * 0.45) / RATE
		var alpha := sin(w) / (2.0 * q)
		var c := cos(w)
		var a0 := 1.0 + alpha
		b0 = (1.0 - c) * 0.5 / a0
		b1 = (1.0 - c) / a0
		b2 = b0
		a1 = -2.0 * c / a0
		a2 = (1.0 - alpha) / a0
		return self

	func process(x: float) -> float:
		var y := b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1
		x1 = x
		y2 = y1
		y1 = y
		return y


static func to_wav(s: PackedFloat32Array) -> AudioStreamWAV:
	# Normalise and convert to 16-bit PCM.
	var peak := 0.0001
	for v in s:
		peak = maxf(peak, absf(v))
	var g := 0.92 / peak
	var data := PackedByteArray()
	data.resize(s.size() * 2)
	for i in range(s.size()):
		data.encode_s16(i * 2, int(clampf(s[i] * g, -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = data
	return w


static func env_ad(t: float, attack: float, dur: float, curve: float = 2.0) -> float:
	if t < attack:
		return t / attack
	return pow(clampf(1.0 - (t - attack) / maxf(dur - attack, 0.001), 0.0, 1.0), curve)


static func env_swell(t: float, dur: float, attack: float, release: float) -> float:
	var a := clampf(t / attack, 0.0, 1.0)
	var r := clampf((dur - t) / release, 0.0, 1.0)
	return a * a * (3.0 - 2.0 * a) * r * r * (3.0 - 2.0 * r)


## A voiced creature sound: glottal-ish saw through vowel formants.
## `f0` is a Curve-like Array of [time_fraction, hz] points.
static func voiced(dur: float, f0: Array, formants: Array, opts: Dictionary = {}) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var filters: Array = []
	for f in formants:
		filters.append(Biquad.new().bandpass(f[0], f[1]))
	var lp := Biquad.new().lowpass(opts.get("lp", 2400.0))
	var phase := 0.0
	var phase2 := 0.0
	var vib_rate: float = opts.get("vib_rate", 5.0)
	var vib_depth: float = opts.get("vib", 0.02)
	var vib_grow: float = opts.get("vib_grow", 0.0)
	var growl: float = opts.get("growl", 0.0)
	var noise: float = opts.get("noise", 0.08)
	var drive: float = opts.get("drive", 1.5)
	var attack: float = opts.get("attack", 0.08)
	var release: float = opts.get("release", 0.4)
	var sub: float = opts.get("sub", 0.3)
	var rng := RandomNumberGenerator.new()
	rng.seed = int(dur * 1000.0) + formants.size()
	for i in range(n):
		var t := float(i) / RATE
		var k := t / dur
		var hz := _curve(f0, k)
		var vib := 1.0 + sin(t * TAU * vib_rate) * (vib_depth + vib_grow * k)
		phase = fposmod(phase + hz * vib / RATE, 1.0)
		phase2 = fposmod(phase2 + hz * 0.5 * vib / RATE, 1.0)
		var src := (2.0 * phase - 1.0) * 0.7 + sin(phase2 * TAU) * sub
		src += rng.randf_range(-1.0, 1.0) * noise
		if growl > 0.0:
			src *= 1.0 - growl * (0.5 + 0.5 * sin(t * TAU * 31.0))
		var y := 0.0
		for fi in range(filters.size()):
			y += filters[fi].process(src) * formants[fi][2]
		y = lp.process(y + src * 0.05)
		y = tanh(y * drive)
		out[i] = y * env_swell(t, dur, attack, release)
	return out


static func _curve(pts: Array, k: float) -> float:
	if k <= pts[0][0]:
		return pts[0][1]
	for i in range(1, pts.size()):
		if k <= pts[i][0]:
			var a: Array = pts[i - 1]
			var b: Array = pts[i]
			var f: float = (k - a[0]) / maxf(b[0] - a[0], 0.0001)
			f = f * f * (3.0 - 2.0 * f)
			return lerpf(a[1], b[1], f)
	return pts[pts.size() - 1][1]


static func noise_sweep(dur: float, f_from: float, f_to: float, q: float, attack: float, release: float, tone_hz: float = 0.0, tone_amt: float = 0.0, seed: int = 1) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var bp := Biquad.new()
	var lp := Biquad.new().lowpass(1800.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var ph := 0.0
	for i in range(n):
		var t := float(i) / RATE
		var k := t / dur
		if i % 64 == 0:
			bp.bandpass(lerpf(f_from, f_to, k), q)
		var x := rng.randf_range(-1.0, 1.0)
		var y := bp.process(x) * 2.0
		y = lp.process(y)
		if tone_amt > 0.0:
			ph = fposmod(ph + tone_hz * (1.0 - k * 0.2) / RATE, 1.0)
			y += sin(ph * TAU) * tone_amt
		out[i] = y * env_swell(t, dur, attack, release)
	return out


# --- The catalogue ------------------------------------------------------------------

static func build(name: StringName) -> AudioStreamWAV:
	match name:
		&"grunt":
			return to_wav(voiced(0.5, [[0.0, 92.0], [0.3, 80.0], [1.0, 58.0]], [[420.0, 3.0, 1.0], [900.0, 4.0, 0.5]],
				{"attack": 0.015, "release": 0.3, "drive": 3.0, "noise": 0.25, "growl": 0.3}))
		&"huff":
			var s := noise_sweep(0.6, 900.0, 300.0, 1.4, 0.01, 0.5, 70.0, 0.4, 3)
			return to_wav(s)
		&"creak":
			return to_wav(_creak(0.75))
		&"rumble":
			return to_wav(voiced(2.2, [[0.0, 40.0], [0.5, 44.0], [1.0, 38.0]], [[180.0, 2.0, 1.0], [380.0, 3.0, 0.4]],
				{"attack": 0.6, "release": 0.9, "lp": 500.0, "noise": 0.3, "growl": 0.5, "sub": 0.6, "drive": 1.2}))
		&"purr":
			return to_wav(_purr(2.6))
		&"moan":
			return to_wav(voiced(2.6, [[0.0, 64.0], [0.35, 74.0], [0.7, 70.0], [1.0, 60.0]], [[260.0, 4.0, 1.0], [520.0, 5.0, 0.35], [2200.0, 8.0, 0.08]],
				{"attack": 0.35, "release": 0.9, "lp": 1200.0, "vib": 0.015, "vib_rate": 4.5, "drive": 1.6, "noise": 0.05}))
		&"groan":
			return to_wav(voiced(3.2, [[0.0, 72.0], [0.4, 96.0], [0.75, 88.0], [1.0, 66.0]], [[460.0, 4.0, 1.0], [820.0, 5.0, 0.6], [2400.0, 8.0, 0.1]],
				{"attack": 0.25, "release": 1.0, "lp": 1800.0, "vib": 0.01, "vib_grow": 0.03, "vib_rate": 5.0, "drive": 2.2, "growl": 0.2}))
		&"bellow":
			return to_wav(voiced(2.8, [[0.0, 110.0], [0.25, 172.0], [0.7, 150.0], [1.0, 96.0]], [[700.0, 3.0, 1.0], [1150.0, 4.0, 0.7], [2600.0, 6.0, 0.3]],
				{"attack": 0.06, "release": 0.9, "lp": 3200.0, "vib": 0.02, "vib_grow": 0.02, "drive": 4.0, "noise": 0.2, "growl": 0.25}))
		&"whine":
			return to_wav(voiced(1.3, [[0.0, 200.0], [0.6, 290.0], [1.0, 250.0]], [[1000.0, 5.0, 1.0], [2500.0, 6.0, 0.4]],
				{"attack": 0.1, "release": 0.4, "lp": 3000.0, "vib": 0.03, "vib_rate": 6.5, "drive": 1.4, "noise": 0.04}))
		&"yelp":
			return to_wav(voiced(0.45, [[0.0, 330.0], [0.3, 540.0], [1.0, 300.0]], [[1100.0, 4.0, 1.0], [2600.0, 6.0, 0.4]],
				{"attack": 0.01, "release": 0.25, "lp": 3800.0, "drive": 2.5, "noise": 0.1}))
		&"sigh":
			return to_wav(noise_sweep(3.0, 1100.0, 280.0, 1.6, 0.6, 1.8, 58.0, 0.25, 11))
		&"exhale":
			return to_wav(noise_sweep(4.5, 2000.0, 200.0, 0.9, 0.08, 3.2, 48.0, 0.5, 12))
		&"thump":
			return to_wav(_thump(0.9))
		&"crash":
			return to_wav(_crash(2.0))
		&"rustle":
			return to_wav(_rustle(0.7))
		&"chime":
			return to_wav(_chime(1.7, 523.25))
		&"twang":
			return to_wav(_twang(1.3, 98.0))
		&"squeak":
			return to_wav(voiced(0.22, [[0.0, 1800.0], [0.4, 2600.0], [1.0, 2000.0]], [[2400.0, 3.0, 1.0]],
				{"attack": 0.01, "release": 0.1, "lp": 6000.0, "noise": 0.0, "sub": 0.0, "drive": 1.0}))
		&"hoot":
			return to_wav(_hoot(1.3))
		&"roar":
			return to_wav(voiced(4.4, [[0.0, 82.0], [0.6, 150.0], [0.9, 230.0], [1.0, 210.0]], [[480.0, 3.0, 1.0], [900.0, 4.0, 0.7], [2500.0, 6.0, 0.25]],
				{"attack": 0.5, "release": 0.5, "lp": 3000.0, "vib": 0.01, "vib_grow": 0.05, "vib_rate": 5.5, "drive": 3.5, "growl": 0.35, "noise": 0.15}))
	return null


static func _creak(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var r1 := Biquad.new().bandpass(820.0, 9.0)
	var r2 := Biquad.new().bandpass(1650.0, 12.0)
	var r3 := Biquad.new().bandpass(310.0, 6.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var next := 0.0
	for i in range(n):
		var t := float(i) / RATE
		var x := 0.0
		if t >= next:
			x = rng.randf_range(0.6, 1.0)
			next = t + 1.0 / lerpf(28.0, 70.0, t / dur) * rng.randf_range(0.7, 1.3)
		var y := r1.process(x) + r2.process(x) * 0.6 + r3.process(x) * 0.8
		out[i] = tanh(y * 3.0) * env_swell(t, dur, 0.05, 0.25)
	return out


static func _purr(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := Biquad.new().lowpass(420.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 9
	var ph := 0.0
	for i in range(n):
		var t := float(i) / RATE
		var pulse := pow(0.5 + 0.5 * sin(t * TAU * 25.0), 3.0)
		ph = fposmod(ph + 50.0 / RATE, 1.0)
		var x := rng.randf_range(-1.0, 1.0) * pulse + sin(ph * TAU) * 0.5 * pulse
		# Inhale/exhale halves of a purr.
		var half := 0.75 + 0.25 * sin(t / dur * TAU * 2.0)
		out[i] = lp.process(x) * half * env_swell(t, dur, 0.4, 0.8)
	return out


static func _thump(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := Biquad.new().lowpass(260.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 2
	var ph := 0.0
	for i in range(n):
		var t := float(i) / RATE
		var hz := 32.0 + 34.0 * exp(-t * 14.0)
		ph = fposmod(ph + hz / RATE, 1.0)
		var body := sin(ph * TAU) * exp(-t * 5.0)
		var click := lp.process(rng.randf_range(-1.0, 1.0)) * exp(-t * 30.0) * 2.0
		out[i] = tanh((body + click) * 2.2) * clampf(t / 0.003, 0.0, 1.0)
	return out


static func _crash(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var hits: Array = [0.0]
	for k in range(6):
		hits.append(rng.randf_range(0.08, 1.3))
	var lp := Biquad.new().lowpass(2500.0)
	var partials := [[410.0, 0.5], [1130.0, 0.35], [1870.0, 0.25], [2690.0, 0.2], [3320.0, 0.12]]
	for i in range(n):
		var t := float(i) / RATE
		var x := 0.0
		for h in hits:
			var dt: float = t - h
			if dt >= 0.0:
				x += rng.randf_range(-1.0, 1.0) * exp(-dt * (18.0 if h > 0.0 else 7.0)) * (1.0 if h == 0.0 else 0.55)
		var y := lp.process(x)
		var metal := 0.0
		for p in partials:
			metal += sin(t * TAU * p[0]) * p[1] * exp(-t * 2.6)
		# Rattle tail.
		if t > 0.3 and rng.randf() < 0.004 * exp(-(t - 0.3) * 2.0):
			y += rng.randf_range(-0.8, 0.8)
		out[i] = tanh((y + metal * 0.5) * 1.8)
	return out


static func _rustle(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := Biquad.new().lowpass(900.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 21
	var amp := 0.0
	for i in range(n):
		var t := float(i) / RATE
		if rng.randf() < 0.004:
			amp = rng.randf_range(0.5, 1.0)
		amp *= 0.9993
		var x := rng.randf_range(-1.0, 1.0)
		var hp := x - lp.process(x)
		out[i] = hp * amp * env_swell(t, dur, 0.05, 0.3)
	return out


static func _chime(dur: float, hz: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in range(n):
		var t := float(i) / RATE
		var y := sin(t * TAU * hz) * exp(-t * 2.4)
		y += sin(t * TAU * hz * 1.003) * exp(-t * 2.4) * 0.6
		y += sin(t * TAU * hz * 2.76) * exp(-t * 5.0) * 0.3
		y += sin(t * TAU * hz * 5.4) * exp(-t * 9.0) * 0.12
		out[i] = y * clampf(t / 0.004, 0.0, 1.0)
	return out


static func _twang(dur: float, hz: float) -> PackedFloat32Array:
	# Karplus-Strong plucked string with a slight downward bend.
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var period := int(RATE / hz)
	var buf := PackedFloat32Array()
	buf.resize(period + 2)
	var rng := RandomNumberGenerator.new()
	rng.seed = 4
	for i in range(buf.size()):
		buf[i] = rng.randf_range(-1.0, 1.0)
	var idx := 0
	var prev := 0.0
	for i in range(n):
		var cur := buf[idx]
		var nxt := buf[(idx + 1) % period]
		var v := (cur + nxt) * 0.5 * 0.996
		buf[idx] = v
		idx = (idx + 1) % period
		var y := cur + (cur - prev) * 0.3
		prev = cur
		out[i] = tanh(y * 1.4) * env_swell(float(i) / RATE, dur, 0.002, 0.5)
	return out


static func _hoot(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var bp := Biquad.new().bandpass(420.0, 2.0)
	var rng := RandomNumberGenerator.new()
	rng.seed = 8
	var ph := 0.0
	for i in range(n):
		var t := float(i) / RATE
		var hz := 175.0 * (1.0 + sin(t * TAU * 5.0) * 0.03) * (1.0 + t / dur * 0.15)
		ph = fposmod(ph + hz / RATE, 1.0)
		var y := sin(ph * TAU) * 0.8 + sin(ph * TAU * 2.0) * 0.15 + bp.process(rng.randf_range(-1.0, 1.0)) * 0.6
		out[i] = y * env_swell(t, dur, 0.25, 0.5)
	return out
