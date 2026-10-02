class_name PlaceholderAudio
extends RefCounted
## Procedurally generated placeholder sounds so the prototype needs no audio files.
## Every consumer exposes an AudioStream export; assign real assets there and these are skipped.
##
## Ids: scrape, breath, move, impact, chime, beacon (looping), exhale.

const RATE := 22050

static var _cache: Dictionary = {}


static func get_sound(id: StringName) -> AudioStream:
	if _cache.has(id):
		return _cache[id]
	var s: AudioStreamWAV
	match id:
		&"scrape": s = _scrape()
		&"breath": s = _breath()
		&"move": s = _move()
		&"impact": s = _impact()
		&"chime": s = _chime()
		&"beacon": s = _beacon()
		&"exhale": s = _exhale()
		_:
			push_warning("PlaceholderAudio: unknown sound '%s'" % id)
			return null
	_cache[id] = s
	return s


static func _lp(fc: float) -> float:
	return 1.0 - exp(-TAU * fc / RATE)


static func _buffer(seconds: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(RATE * seconds))
	return b


static func _normalize(buf: PackedFloat32Array, peak: float) -> void:
	var m := 0.0
	for v in buf:
		m = maxf(m, absf(v))
	if m <= 0.0:
		return
	var k := peak / m
	for i in buf.size():
		buf[i] *= k


static func _wav(buf: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	for i in buf.size():
		bytes.encode_s16(i * 2, int(clampf(buf[i], -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = buf.size()
	return w


## Something heavy and rough dragged across something else.
static func _scrape() -> AudioStreamWAV:
	var dur := 1.8
	var buf := _buffer(dur)
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var lp1 := 0.0
	var lp2 := 0.0
	var grain := 0.0
	var grain_target := 0.0
	var a1 := _lp(2200.0)
	var a2 := _lp(260.0)
	for i in buf.size():
		var t := float(i) / RATE
		lp1 += a1 * (rng.randf_range(-1.0, 1.0) - lp1)
		lp2 += a2 * (lp1 - lp2)
		var band := lp1 - lp2
		if i % 260 == 0:
			grain_target = pow(rng.randf(), 2.0)
		grain += 0.004 * (grain_target - grain)
		var env := minf(t / 0.2, 1.0) * clampf((dur - t) / 0.7, 0.0, 1.0)
		var judder := 0.55 + 0.45 * sin(TAU * 6.0 * t + sin(TAU * 1.1 * t) * 3.0)
		buf[i] = band * (0.3 + grain * 2.0) * judder * env
	_normalize(buf, 0.8)
	return _wav(buf)


## Slow, very large inhale then exhale.
static func _breath() -> AudioStreamWAV:
	var dur := 3.2
	var buf := _buffer(dur)
	var rng := RandomNumberGenerator.new()
	rng.seed = 23
	var lp1 := 0.0
	var lp2 := 0.0
	var a1 := _lp(900.0)
	var a2 := _lp(220.0)
	for i in buf.size():
		var t := float(i) / RATE
		var x := rng.randf_range(-1.0, 1.0)
		lp1 += a1 * (x - lp1)
		lp2 += a2 * (x - lp2)
		var inhale := 0.0
		if t < 1.3:
			inhale = pow(sin(PI * t / 1.3), 2.0) * 0.55
		var exhale := 0.0
		if t > 1.5:
			exhale = pow(sin(PI * clampf((t - 1.5) / 1.7, 0.0, 1.0)), 1.5)
		var growl := sin(TAU * 52.0 * t) * (0.5 + 0.5 * sin(TAU * 9.0 * t))
		buf[i] = lp1 * inhale + (lp2 * 1.6 + growl * 0.08) * exhale
	_normalize(buf, 0.6)
	return _wav(buf)


## Low shifting rumble: mass moving somewhere.
static func _move() -> AudioStreamWAV:
	var dur := 2.4
	var buf := _buffer(dur)
	var rng := RandomNumberGenerator.new()
	rng.seed = 37
	var brown := 0.0
	var lp := 0.0
	var a := _lp(140.0)
	for i in buf.size():
		var t := float(i) / RATE
		brown = brown * 0.996 + rng.randf_range(-1.0, 1.0) * 0.04
		lp += a * (brown - lp)
		var env := pow(sin(PI * t / dur), 2.0)
		var creak := 0.0
		if t > 0.9 and t < 1.25:
			creak = sin(TAU * (90.0 + 40.0 * (t - 0.9)) * t) * sin(PI * (t - 0.9) / 0.35) * 0.12
		buf[i] = (lp * 3.0 + creak) * env
	_normalize(buf, 0.85)
	return _wav(buf)


## Deep distant thud with a long tail.
static func _impact() -> AudioStreamWAV:
	var dur := 3.2
	var buf := _buffer(dur)
	var rng := RandomNumberGenerator.new()
	rng.seed = 41
	var phase := 0.0
	var lp := 0.0
	var lp_r := 0.0
	var a := _lp(700.0)
	var ar := _lp(110.0)
	for i in buf.size():
		var t := float(i) / RATE
		var f := 36.0 + 55.0 * exp(-t * 7.0)
		phase += TAU * f / RATE
		var x := rng.randf_range(-1.0, 1.0)
		lp += a * (x - lp)
		lp_r += ar * (x - lp_r)
		var attack := minf(t / 0.006, 1.0)
		buf[i] = attack * (sin(phase) * exp(-t * 1.9) + lp * exp(-t * 14.0) * 0.7 + lp_r * exp(-t * 1.1) * 1.4)
	_normalize(buf, 0.9)
	return _wav(buf)


## Soft, slightly detuned bell for memory activation.
static func _chime() -> AudioStreamWAV:
	var dur := 3.5
	var buf := _buffer(dur)
	var freqs: Array[float] = [523.25, 784.0, 1046.5, 1571.0, 2093.0]
	var amps: Array[float] = [1.0, 0.45, 0.35, 0.18, 0.08]
	var decays: Array[float] = [1.2, 1.8, 2.6, 3.5, 5.0]
	for i in buf.size():
		var t := float(i) / RATE
		var attack := minf(t / 0.015, 1.0)
		var v := 0.0
		for k in freqs.size():
			v += sin(TAU * freqs[k] * t + sin(TAU * 4.0 * t) * 0.15) * amps[k] * exp(-t * decays[k])
		buf[i] = v * attack
	_normalize(buf, 0.5)
	return _wav(buf)


## Seamless 4 s loop: low drone with a slow double-pulse, the creature's "voice" in the
## final phase. All frequencies complete whole cycles in 4 s so the loop doesn't click.
static func _beacon() -> AudioStreamWAV:
	var dur := 4.0
	var buf := _buffer(dur)
	for i in buf.size():
		var t := float(i) / RATE
		var drone := sin(TAU * 55.0 * t) * 0.35 + sin(TAU * 110.0 * t) * 0.12 + sin(TAU * 82.5 * t) * 0.08
		drone *= 0.75 + 0.25 * sin(TAU * 0.25 * t)
		var tm := fmod(t, 2.0)
		var pulse := 0.0
		for start in [0.0, 0.32]:
			var tau: float = tm - start
			if tau >= 0.0:
				pulse += sin(TAU * 48.0 * tau) * exp(-tau * 11.0)
		buf[i] = drone + pulse * 0.9
	_normalize(buf, 0.7)
	return _wav(buf, true)


## Quiet close exhale (used when something very close is discovered).
static func _exhale() -> AudioStreamWAV:
	var dur := 2.0
	var buf := _buffer(dur)
	var rng := RandomNumberGenerator.new()
	rng.seed = 53
	var lp := 0.0
	var a := _lp(650.0)
	for i in buf.size():
		var t := float(i) / RATE
		lp += a * (rng.randf_range(-1.0, 1.0) - lp)
		var env := minf(t / 0.35, 1.0) * exp(-maxf(t - 0.35, 0.0) * 2.2)
		var growl := sin(TAU * 68.0 * t) * 0.15 * env
		buf[i] = lp * env + growl
	_normalize(buf, 0.5)
	return _wav(buf)
