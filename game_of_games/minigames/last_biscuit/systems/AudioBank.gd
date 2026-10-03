class_name LBAudio
extends Node
## All sound is synthesised at start-up (no asset files needed): porcelain
## clinks, cutlery clatter, slaps, crunches, a ticking clock in the silence,
## a low tension drone and the final triumphant sting. Swap any entry in
## `streams` for recorded audio later.

const RATE := 22050

@export var master_db := 0.0
@export var ambience_db := -20.0
@export var tension_max_db := -9.0

var streams := {}                 # name -> Array[AudioStreamWAV]
var _pool: Array[AudioStreamPlayer3D] = []
var _flat_pool: Array[AudioStreamPlayer] = []
var tension_player: AudioStreamPlayer
var clock_player: AudioStreamPlayer
var room_player: AudioStreamPlayer
var buzz_player: AudioStreamPlayer3D
var snore_player: AudioStreamPlayer3D
var _rng := RandomNumberGenerator.new()
var _tension_level := 0.0
var _duck := 1.0                  # 0..1 multiplier applied to ambience during "silence" beats


func _ready() -> void:
	_rng.seed = 1234
	_build_all()
	for i in 14:
		var p := AudioStreamPlayer3D.new()
		p.unit_size = 4.0
		p.max_distance = 40.0
		p.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
		p.panning_strength = 0.8
		add_child(p)
		_pool.append(p)
	for i in 6:
		var f := AudioStreamPlayer.new()
		add_child(f)
		_flat_pool.append(f)
	tension_player = _loop_player("tension", -60.0)
	clock_player = _loop_player("clock", ambience_db)
	room_player = _loop_player("room", ambience_db - 4.0)
	buzz_player = AudioStreamPlayer3D.new()
	buzz_player.stream = streams["buzz"][0]
	buzz_player.unit_size = 1.5
	buzz_player.volume_db = -8.0
	add_child(buzz_player)
	snore_player = AudioStreamPlayer3D.new()
	snore_player.stream = streams["snore"][0]
	snore_player.unit_size = 2.5
	snore_player.volume_db = -14.0
	add_child(snore_player)


func _loop_player(key: String, db: float) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.stream = streams[key][0]
	p.volume_db = db
	p.autoplay = false
	add_child(p)
	p.play()
	return p


func _process(dt: float) -> void:
	var target_db := -60.0
	if _tension_level > 0.05:
		target_db = lerpf(tension_max_db - 22.0, tension_max_db, _tension_level)
	tension_player.volume_db = lerpf(tension_player.volume_db, target_db + linear_to_db(maxf(_duck, 0.001)), LBConst.damp(4.0, dt))
	tension_player.pitch_scale = 1.0 + _tension_level * 0.06
	clock_player.volume_db = ambience_db + linear_to_db(clampf(0.35 + _duck * 0.65, 0.01, 1.0)) + (6.0 * (1.0 - _duck))
	room_player.volume_db = ambience_db - 4.0 + linear_to_db(maxf(_duck, 0.05))


func set_tension(level: float) -> void:
	_tension_level = clampf(level, 0.0, 1.0)


## 1 = normal, 0 = everything but the clock fades (awkward silence).
func set_duck(v: float) -> void:
	_duck = clampf(v, 0.0, 1.0)


func play_noise(kind: String, at: Vector3, loudness: float) -> void:
	var key := kind
	var pitch := _rng.randf_range(0.92, 1.08)
	match kind:
		"clink":
			if loudness > 0.8:
				key = "clatter"
		"glass":
			if loudness > 0.9:
				key = "smash"
		"swish":
			key = "clink"
			pitch *= 1.5
			loudness *= 0.35
		"clatter":
			if loudness < 0.3:
				key = "clink"
				pitch *= 0.8
	if not streams.has(key):
		key = "clink"
	var vol := clampf(0.12 + loudness * 0.75, 0.02, 1.3)
	play_at(key, at, linear_to_db(vol), pitch)


func play_at(key: String, at: Vector3, db := 0.0, pitch := 1.0) -> void:
	if not streams.has(key):
		return
	var p := _free_player()
	var arr: Array = streams[key]
	p.stream = arr[_rng.randi() % arr.size()]
	p.global_position = at
	p.volume_db = db + master_db
	p.pitch_scale = pitch
	p.play()


func play_flat(key: String, db := 0.0, pitch := 1.0) -> void:
	if not streams.has(key):
		return
	var p: AudioStreamPlayer = _flat_pool[0]
	for f in _flat_pool:
		if not f.playing:
			p = f
			break
	var arr: Array = streams[key]
	p.stream = arr[_rng.randi() % arr.size()]
	p.volume_db = db + master_db
	p.pitch_scale = pitch
	p.play()


func _free_player() -> AudioStreamPlayer3D:
	var oldest := _pool[0]
	var best := -1.0
	for p in _pool:
		if not p.playing:
			return p
		var pos := p.get_playback_position()
		if pos > best:
			best = pos
			oldest = p
	return oldest


func buzz(on: bool, at := Vector3.ZERO) -> void:
	buzz_player.global_position = at
	if on and not buzz_player.playing:
		buzz_player.play()
	elif not on and buzz_player.playing:
		buzz_player.stop()


func snore(on: bool, at := Vector3.ZERO) -> void:
	snore_player.global_position = at
	if on and not snore_player.playing:
		snore_player.play()
	elif not on and snore_player.playing:
		snore_player.stop()


# ---------------------------------------------------------------- synthesis

func _add(key: String, s: PackedFloat32Array, loop := false) -> void:
	if not streams.has(key):
		streams[key] = []
	streams[key].append(_wav(s, loop))


func _wav(s: PackedFloat32Array, loop: bool) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(s.size() * 2)
	for i in s.size():
		bytes.encode_s16(i * 2, int(clampf(s[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = s.size()
	return w


func _buf(sec: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(sec * RATE))
	b.fill(0.0)
	return b


func _mix(dst: PackedFloat32Array, src: PackedFloat32Array, offset_sec: float, gain := 1.0) -> void:
	var o := int(offset_sec * RATE)
	for i in src.size():
		if o + i >= dst.size():
			break
		dst[o + i] += src[i] * gain


func _normalize(b: PackedFloat32Array, peak := 0.9) -> PackedFloat32Array:
	var m := 0.0001
	for v in b:
		m = maxf(m, absf(v))
	for i in b.size():
		b[i] = b[i] / m * peak
	return b


func _clink(base: float, decay: float, bright := 1.0) -> PackedFloat32Array:
	var b := _buf(decay * 4.0)
	var ratios := [1.0, 2.76, 5.40, 8.93, 13.3]
	var amps := [1.0, 0.55, 0.32 * bright, 0.18 * bright, 0.08 * bright]
	var detune := _rng.randf_range(0.97, 1.03)
	for i in b.size():
		var t := float(i) / RATE
		var v := 0.0
		for k in ratios.size():
			var f: float = base * ratios[k] * detune
			v += amps[k] * sin(TAU * f * t) * exp(-t / (decay / (1.0 + k * 0.6)))
		# click transient
		if t < 0.003:
			v += _rng.randf_range(-1, 1) * (1.0 - t / 0.003) * 0.6
		b[i] = v
	return _normalize(b, 0.8)


func _noise_burst(sec: float, decay: float, hp := 0.0, lp := 1.0) -> PackedFloat32Array:
	var b := _buf(sec)
	var lo := 0.0
	var prev := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var n := _rng.randf_range(-1.0, 1.0)
		lo += (n - lo) * lp
		var v := lo
		if hp > 0.0:
			v = lo - prev * hp
			prev = lo
		b[i] = v * exp(-t / decay)
	return b


func _tone(f: float, sec: float, decay: float, attack := 0.002) -> PackedFloat32Array:
	var b := _buf(sec)
	for i in b.size():
		var t := float(i) / RATE
		b[i] = sin(TAU * f * t) * exp(-t / decay) * clampf(t / attack, 0.0, 1.0)
	return b


func _bandpass(src: PackedFloat32Array, f0: float, q: float) -> PackedFloat32Array:
	var w0 := TAU * f0 / RATE
	var alpha := sin(w0) / (2.0 * q)
	var b0 := alpha
	var a0 := 1.0 + alpha
	var a1 := -2.0 * cos(w0)
	var a2 := 1.0 - alpha
	var out := PackedFloat32Array()
	out.resize(src.size())
	var x1 := 0.0
	var x2 := 0.0
	var y1 := 0.0
	var y2 := 0.0
	for i in src.size():
		var x := src[i]
		var y := (b0 * x - b0 * x2 - a1 * y1 - a2 * y2) / a0
		x2 = x1
		x1 = x
		y2 = y1
		y1 = y
		out[i] = y
	return out


func _build_all() -> void:
	# porcelain clinks
	for i in 4:
		_add("clink", _clink(_rng.randf_range(1900.0, 2600.0), _rng.randf_range(0.05, 0.09)))
	for i in 3:
		_add("glass", _clink(_rng.randf_range(2800.0, 3400.0), 0.22, 0.4))
	# clatter: a flurry of cutlery and china
	for v in 2:
		var c := _buf(0.9)
		var t0 := 0.0
		for i in 9:
			_mix(c, _clink(_rng.randf_range(1400.0, 3800.0), _rng.randf_range(0.04, 0.1)), t0, _rng.randf_range(0.4, 1.0))
			t0 += _rng.randf_range(0.015, 0.09)
		_mix(c, _noise_burst(0.3, 0.08, 0.0, 0.6), 0.0, 0.5)
		_add("clatter", _normalize(c, 0.95))
	# smash (things falling off the table)
	var sm := _buf(1.2)
	_mix(sm, _tone(70.0, 0.4, 0.12), 0.0, 0.9)
	for i in 14:
		_mix(sm, _clink(_rng.randf_range(2000.0, 5000.0), _rng.randf_range(0.04, 0.12), 1.4), _rng.randf_range(0.0, 0.35), _rng.randf_range(0.3, 0.9))
	_mix(sm, _noise_burst(0.6, 0.15, 0.7, 0.9), 0.0, 0.8)
	_add("smash", _normalize(sm, 0.98))
	# thud
	var th := _tone(95.0, 0.35, 0.07)
	_mix(th, _noise_burst(0.2, 0.03, 0.0, 0.1), 0.0, 0.6)
	_add("thud", _normalize(th, 0.7))
	# napkin rustle
	for v in 2:
		var r := _buf(0.5)
		for i in r.size():
			var t := float(i) / RATE
			var env := sin(PI * t / 0.5)
			r[i] = _rng.randf_range(-1, 1) * env * (0.4 + 0.6 * float(_rng.randf() > 0.93))
		_add("rustle", _normalize(_bandpass(r, 3500.0, 0.7), 0.5))
	# SLAP: sharp crack + fleshy body
	for v in 3:
		var s := _buf(0.35)
		_mix(s, _noise_burst(0.08, 0.012, 0.95, 1.0), 0.0, 1.0)
		_mix(s, _noise_burst(0.05, 0.008, 0.9, 1.0), 0.009, 0.5)
		_mix(s, _tone(_rng.randf_range(150.0, 190.0), 0.2, 0.045), 0.0, 0.8)
		_mix(s, _bandpass(_noise_burst(0.2, 0.04), 900.0, 1.2), 0.002, 0.9)
		_add("slap", _normalize(s, 1.0))
	# whoosh
	var wh := _buf(0.3)
	for i in wh.size():
		var t := float(i) / RATE
		wh[i] = _rng.randf_range(-1, 1) * sin(PI * t / 0.3)
	_add("whoosh", _normalize(_bandpass(wh, 1200.0, 1.5), 0.5))
	# grab: soft tick + crumbs
	var g := _buf(0.25)
	_mix(g, _tone(1800.0, 0.05, 0.008), 0.0, 0.5)
	for i in 6:
		_mix(g, _noise_burst(0.02, 0.004, 0.8), _rng.randf_range(0.0, 0.15), 0.3)
	_add("grab", _normalize(g, 0.5))
	# crunch (biscuit breaking)
	var cr := _buf(0.5)
	for i in 22:
		_mix(cr, _bandpass(_noise_burst(0.03, 0.006), _rng.randf_range(1500.0, 4000.0), 2.0), _rng.randf_range(0.0, 0.3), _rng.randf_range(0.4, 1.0))
	_add("crunch", _normalize(cr, 0.95))
	# squeak (the fake biscuit is a rubber toy)
	var sq := _buf(0.35)
	var ph := 0.0
	for i in sq.size():
		var t := float(i) / RATE
		var f := 900.0 + 600.0 * sin(PI * t / 0.35) + 40.0 * sin(TAU * 18.0 * t)
		ph += TAU * f / RATE
		sq[i] = (sin(ph) + 0.3 * sin(ph * 2.0)) * sin(PI * t / 0.35)
	_add("squeak", _normalize(sq, 0.7))
	# CHOMP
	var ch := _buf(0.9)
	for i in int(0.35 * RATE):
		var t := float(i) / RATE
		ch[i] += _rng.randf_range(-1, 1) * (0.5 + 0.5 * sin(TAU * 48.0 * t)) * sin(PI * t / 0.35) * 0.5
	ch = _bandpass(ch, 400.0, 0.8)
	_mix(ch, _tone(110.0, 0.2, 0.03), 0.3, 1.2)
	_mix(ch, _noise_burst(0.05, 0.006, 0.9), 0.3, 1.0)
	for i in 12:
		_mix(ch, _bandpass(_noise_burst(0.03, 0.006), _rng.randf_range(1200.0, 3500.0), 2.0), 0.32 + _rng.randf_range(0.0, 0.3), 0.6)
	_add("chomp", _normalize(ch, 1.0))
	# triumphant sting: brassy C major swell with a flourish
	var st := _buf(2.0)
	var notes := [[261.6, 0.0], [329.6, 0.06], [392.0, 0.12], [523.3, 0.2]]
	for nt in notes:
		var f0: float = nt[0]
		var off: float = nt[1]
		var tone := _buf(1.8)
		for i in tone.size():
			var t := float(i) / RATE
			var v := 0.0
			for h in range(1, 8):
				v += sin(TAU * f0 * h * t * (1.0 + 0.002 * sin(TAU * 5.0 * t))) / h
			var env := clampf(t / 0.04, 0.0, 1.0) * exp(-t / 0.9)
			tone[i] = v * env
		_mix(st, tone, off, 0.4)
	_add("sting", _normalize(st, 0.85))
	# caught: a single low cello pluck and then nothing
	var pl := _buf(2.2)
	var period := int(RATE / 65.4)
	var ring := PackedFloat32Array()
	ring.resize(period)
	for i in period:
		ring[i] = _rng.randf_range(-1, 1)
	for i in pl.size():
		var idx := i % period
		var nxt := (i + 1) % period
		ring[idx] = 0.497 * (ring[idx] + ring[nxt])
		pl[i] = ring[idx]
	_add("pluck", _normalize(pl, 0.8))
	# subtle positive chime
	var ci := _tone(1568.0, 0.8, 0.25, 0.01)
	_mix(ci, _tone(2349.0, 0.8, 0.18, 0.01), 0.0, 0.5)
	_add("chime", _normalize(ci, 0.35))
	# near-detection tension sting (string harmonic swell)
	var tn := _buf(0.9)
	for i in tn.size():
		var t := float(i) / RATE
		tn[i] = (sin(TAU * 740.0 * t) + 0.4 * sin(TAU * 1110.0 * t)) * sin(PI * t / 0.9) * (0.8 + 0.2 * sin(TAU * 6.0 * t))
	_add("tense", _normalize(tn, 0.4))
	# tension drone loop (seamless, 4 s)
	var dr := _buf(4.0)
	for i in dr.size():
		var t := float(i) / RATE
		var vib := 0.004 * sin(TAU * 0.5 * t)
		var v := 0.0
		for h in range(1, 6):
			v += sin(TAU * 55.0 * h * t * (1.0 + vib)) / (h * h)
			v += 0.6 * sin(TAU * 82.5 * h * t * (1.0 - vib)) / (h * h)
		dr[i] = v * (0.7 + 0.3 * sin(TAU * 0.25 * t))
	_add("tension", _normalize(dr, 0.6), true)
	# grandfather clock tick-tock loop (2 s)
	var ck := _buf(2.0)
	_mix(ck, _tone(1900.0, 0.08, 0.01), 0.0, 0.7)
	_mix(ck, _noise_burst(0.01, 0.002, 0.9), 0.0, 0.5)
	_mix(ck, _tone(1450.0, 0.08, 0.012), 1.0, 0.6)
	_mix(ck, _noise_burst(0.01, 0.002, 0.9), 1.0, 0.4)
	_add("clock", _normalize(ck, 0.5), true)
	# room tone
	var rt := _buf(4.0)
	var lo := 0.0
	for i in rt.size():
		lo += (_rng.randf_range(-1, 1) - lo) * 0.02
		rt[i] = lo
		if _rng.randf() < 0.00025:
			for k in 40:
				if i + k < rt.size():
					rt[i + k] += _rng.randf_range(-1, 1) * 0.3 * (1.0 - k / 40.0)
	_add("room", _normalize(rt, 0.3), true)
	# fly buzz loop (1 s)
	var bz := _buf(1.0)
	for i in bz.size():
		var t := float(i) / RATE
		var saw := fmod(t * 210.0, 1.0) * 2.0 - 1.0
		bz[i] = saw * (0.6 + 0.4 * sin(TAU * 7.0 * t))
	_add("buzz", _normalize(_bandpass(bz, 600.0, 0.9), 0.5), true)
	# snore loop (3 s): rumbling inhale, whistling exhale
	var sn := _buf(3.0)
	for i in sn.size():
		var t := float(i) / RATE
		if t < 1.4:
			sn[i] = _rng.randf_range(-1, 1) * (0.5 + 0.5 * sin(TAU * 32.0 * t)) * sin(PI * t / 1.4)
		elif t < 2.4:
			var u := (t - 1.4) / 1.0
			sn[i] = sin(TAU * (700.0 + 200.0 * u) * t) * sin(PI * u) * 0.15 + _rng.randf_range(-1, 1) * 0.05 * sin(PI * u)
	_add("snore", _normalize(_bandpass(sn, 350.0, 0.6), 0.5), true)
	# sneeze: "ah... ah... CHOO"
	var sz := _buf(1.6)
	for part in [[0.0, 0.45, 190.0, 240.0], [0.55, 0.4, 230.0, 300.0]]:
		var start: float = part[0]
		var dur: float = part[1]
		var seg := _buf(dur)
		var p2 := 0.0
		for i in seg.size():
			var t := float(i) / RATE
			var f: float = lerpf(part[2], part[3], t / dur)
			p2 += TAU * f / RATE
			seg[i] = (fmod(p2 / TAU, 1.0) * 2.0 - 1.0) * sin(PI * t / dur)
		var vow := _bandpass(seg, 800.0, 3.0)
		var vow2 := _bandpass(seg, 1200.0, 3.0)
		for i in vow.size():
			vow[i] += vow2[i] * 0.7
		_mix(sz, vow, start, 0.5)
	_mix(sz, _bandpass(_noise_burst(0.35, 0.09), 3000.0, 0.8), 1.08, 2.5)
	_mix(sz, _tone(160.0, 0.2, 0.06), 1.08, 0.6)
	_add("sneeze", _normalize(sz, 0.95))
	# false teeth clack
	var tc := _buf(0.3)
	_mix(tc, _clink(3200.0, 0.015, 0.2), 0.0, 1.0)
	_mix(tc, _clink(2900.0, 0.015, 0.2), 0.07, 0.8)
	_mix(tc, _clink(3100.0, 0.015, 0.2), 0.12, 0.6)
	_add("clack", _normalize(tc, 0.7))
	# serving tongs: scrape + click
	var tg := _buf(0.6)
	var scrape := _bandpass(_noise_burst(0.4, 0.3), 4200.0, 4.0)
	_mix(tg, scrape, 0.0, 0.6)
	_mix(tg, _clink(2600.0, 0.03, 0.6), 0.42, 1.0)
	_add("tongs", _normalize(tg, 0.6))
	# soft footstep
	var fs := _tone(80.0, 0.15, 0.03)
	_mix(fs, _noise_burst(0.08, 0.02, 0.0, 0.2), 0.0, 0.4)
	_add("step", _normalize(fs, 0.4))
	# gulp (rival caught: diner swallows awkwardly)
	var gl := _buf(0.3)
	var gp := 0.0
	for i in gl.size():
		var t := float(i) / RATE
		gp += TAU * (300.0 - 200.0 * t / 0.3) / RATE
		gl[i] = sin(gp) * sin(PI * t / 0.3)
	_add("gulp", _normalize(_bandpass(gl, 400.0, 1.0), 0.5))
