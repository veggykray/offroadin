extends RefCounted
## Synthesises small placeholder sound effects at runtime so the slice is audible without assets.
## Any AudioStreamPlayer that already has a stream assigned in the scene keeps it — drop real
## sounds onto the nodes under Audio/ and these are simply not used.

const RATE := 22050


static func make(sound_name: String) -> AudioStreamWAV:
	match sound_name:
		"LeverClick":
			return _click()
		"MachineHum":
			return _hum()
		"TemperatureShift":
			return _whoosh()
		"LightShift":
			return _chime([880.0, 1320.0], 0.45)
		"AgeShift":
			return _ticks()
		"PlantGrow":
			return _sweep(220.0, 440.0, 0.9)
		"FruitAppear":
			return _chime([523.25, 659.25, 783.99], 1.4)
		"WaterSpray":
			return _spray()
		"ButtonPress":
			return _click()
		"Sputter":
			return _crack()
		"Drip":
			return _chime([1568.0, 2093.0], 0.25)
		"PlantSick":
			return _sweep(330.0, 170.0, 0.8)
		"PlantRecover":
			return _sweep(300.0, 560.0, 0.7)
		"BudForm":
			return _chime([783.99, 987.77], 0.7)
		"FlowerOpen":
			return _chime([659.25, 830.61, 987.77, 1318.5], 1.8)
		"Warning":
			return _thud()
		"PuzzleSuccess":
			return _arpeggio()
	return null


static func _to_stream(samples: PackedFloat32Array, loop := false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = bytes
	if loop:
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = samples.size()
	return s


static func _env(t: float, attack: float, length: float) -> float:
	if t < attack:
		return t / attack
	return maxf(0.0, 1.0 - (t - attack) / maxf(0.001, length - attack))


static func _click() -> AudioStreamWAV:
	var n := int(RATE * 0.09)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 1
	for i in n:
		var t := float(i) / RATE
		var e := exp(-t * 60.0)
		out[i] = (rng.randf_range(-1, 1) * 0.5 + sin(TAU * 1800.0 * t) * 0.4 + sin(TAU * 140.0 * t) * 0.6) * e * 0.7
	return _to_stream(out)


static func _hum() -> AudioStreamWAV:
	# Exactly 1 s so 55 Hz and its harmonics loop seamlessly.
	var n := RATE
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		out[i] = (sin(TAU * 55.0 * t) * 0.5 + sin(TAU * 110.0 * t) * 0.25 + sin(TAU * 165.0 * t) * 0.1) * (0.85 + 0.15 * sin(TAU * 2.0 * t)) * 0.5
	return _to_stream(out, true)


static func _whoosh() -> AudioStreamWAV:
	var n := int(RATE * 0.6)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 2
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var cutoff := 0.04 + 0.2 * sin(PI * t / 0.6)
		lp += (rng.randf_range(-1, 1) - lp) * cutoff
		out[i] = lp * _env(t, 0.1, 0.6) * 1.6
	return _to_stream(out)


static func _chime(freqs: Array, length: float) -> AudioStreamWAV:
	var n := int(RATE * length)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for f in freqs:
			v += sin(TAU * float(f) * t) + 0.3 * sin(TAU * float(f) * 2.01 * t)
		out[i] = v / float(freqs.size()) * exp(-t * 4.0 / length) * minf(1.0, t * 200.0) * 0.5
	return _to_stream(out)


static func _ticks() -> AudioStreamWAV:
	var n := int(RATE * 0.9)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for k in 4:
			var tk := t - float(k) * 0.14
			if tk > 0.0:
				v += sin(TAU * (2200.0 if k % 2 == 0 else 1700.0) * tk) * exp(-tk * 90.0) * 0.5
		var tb := t - 0.5
		if tb > 0.0:
			v += sin(TAU * 196.0 * tb) * exp(-tb * 6.0) * 0.4
		out[i] = v
	return _to_stream(out)


static func _sweep(f0: float, f1: float, length: float) -> AudioStreamWAV:
	var n := int(RATE * length)
	var out := PackedFloat32Array()
	out.resize(n)
	var phase := 0.0
	for i in n:
		var t := float(i) / RATE
		var f := lerpf(f0, f1, t / length)
		phase += TAU * f / RATE
		out[i] = (sin(phase) + 0.3 * sin(phase * 1.5)) * _env(t, 0.2, length) * 0.35
	return _to_stream(out)


static func _thud() -> AudioStreamWAV:
	var n := int(RATE * 0.35)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		out[i] = sin(TAU * lerpf(160.0, 60.0, t / 0.35) * t) * exp(-t * 14.0) * 0.9
	return _to_stream(out)


static func _crack() -> AudioStreamWAV:
	var n := int(RATE * 0.5)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	for i in n:
		var t := float(i) / RATE
		var v := rng.randf_range(-1, 1) * exp(-t * 25.0) * 0.6
		v += sin(TAU * 1046.5 * t) * exp(-t * 5.0) * 0.25 * minf(1.0, t * 50.0)
		out[i] = v
	return _to_stream(out)


static func _arpeggio() -> AudioStreamWAV:
	var notes := [392.0, 523.25, 659.25, 783.99, 1046.5]
	var n := int(RATE * 2.4)
	var out := PackedFloat32Array()
	out.resize(n)
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for k in notes.size():
			var tk := t - float(k) * 0.12
			if tk > 0.0:
				var f := float(notes[k])
				v += (sin(TAU * f * tk) + 0.25 * sin(TAU * f * 3.0 * tk)) * exp(-tk * 1.6) * minf(1.0, tk * 300.0)
		out[i] = v * 0.18
	return _to_stream(out)


## A hissing burst of water through a nozzle, with a gurgle at the start.
static func _spray() -> AudioStreamWAV:
	var n := int(RATE * 0.75)
	var out := PackedFloat32Array()
	out.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var lp := 0.0
	var hp_prev := 0.0
	for i in n:
		var t := float(i) / RATE
		var white := rng.randf_range(-1.0, 1.0)
		lp += (white - lp) * 0.35
		var hiss := white - hp_prev
		hp_prev = white
		var gurgle := sin(TAU * (90.0 + 40.0 * sin(t * 30.0)) * t) * maxf(0.0, 1.0 - t * 6.0)
		out[i] = (hiss * 0.25 + lp * 0.35 + gurgle * 0.3) * _env(t, 0.03, 0.75)
	return _to_stream(out)
