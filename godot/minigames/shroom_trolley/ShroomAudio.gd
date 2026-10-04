extends Node
## Every sound in the mini-game goes through here, by SLOT NAME.
##
## To use real sounds: select the ShroomTrolleyActivity's "Audio" child node and
## drag .wav/.ogg files onto the slots in the Inspector. Any slot left empty
## uses a tiny synthesised placeholder (if `use_placeholder_sounds` is on) or is
## silent. A missing sound can never crash the game.
##
## Other code calls:  audio.play(&"catch")   /   audio.set_rolling(speed01, rattle01)

@export var use_placeholder_sounds := true
@export var bus := &"Master"
@export_range(-40.0, 12.0) var master_volume_db := -4.0

@export_group("Trolley")
@export var trolley_wheels: AudioStream   ## looping rolling sound
@export var rattle: AudioStream           ## looping high-speed rattle
@export var bash: AudioStream
@export var skid: AudioStream
@export var crash: AudioStream
@export_group("Mushrooms")
@export var catch: AudioStream
@export var golden_catch: AudioStream
@export var rotten_splat: AudioStream
@export var bounce: AudioStream
@export var spill: AudioStream
@export var launch: AudioStream
@export_group("Checkout")
@export var scanner_beep: AudioStream
@export var scanner_golden: AudioStream
@export var scanner_error: AudioStream
@export var checkout_open: AudioStream
@export var checkout_success: AudioStream
@export var completion: AudioStream

const SLOTS := [&"trolley_wheels", &"rattle", &"bash", &"skid", &"crash", &"catch", &"golden_catch",
	&"rotten_splat", &"bounce", &"spill", &"launch", &"scanner_beep", &"scanner_golden",
	&"scanner_error", &"checkout_open", &"checkout_success", &"completion"]
const MIN_INTERVAL := {&"bounce": 0.05, &"catch": 0.03, &"spill": 0.06, &"scanner_beep": 0.05, &"launch": 0.08}
const RATE := 22050

var _streams := {}
var _players: Array[AudioStreamPlayer] = []
var _next := 0
var _last_played := {}
var _wheels: AudioStreamPlayer
var _rattle: AudioStreamPlayer
var muted := false


func _ready() -> void:
	for s in SLOTS:
		var custom: AudioStream = get(s)
		if custom != null:
			_streams[s] = custom
		elif use_placeholder_sounds:
			_streams[s] = _synth(s)
	for i in 12:
		var p := AudioStreamPlayer.new()
		p.bus = bus
		add_child(p)
		_players.append(p)
	_wheels = _make_loop(&"trolley_wheels")
	_rattle = _make_loop(&"rattle")


func _make_loop(slot: StringName) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	p.volume_db = -80.0
	add_child(p)
	if _streams.has(slot):
		p.stream = _streams[slot]
		p.play()
	return p


func play(slot: StringName, volume_db := 0.0, pitch := 1.0) -> void:
	if muted or not _streams.has(slot) or _players.is_empty():
		return
	var now := Time.get_ticks_msec() / 1000.0
	if MIN_INTERVAL.has(slot) and now - float(_last_played.get(slot, -10.0)) < MIN_INTERVAL[slot]:
		return
	_last_played[slot] = now
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = _streams[slot]
	p.volume_db = master_volume_db + volume_db
	p.pitch_scale = clampf(pitch, 0.3, 3.0)
	p.play()


## Continuous trolley sounds. speed01 and rattle01 are 0..1.
func set_rolling(speed01: float, rattle01: float) -> void:
	if _wheels:
		_wheels.volume_db = -80.0 if muted or speed01 < 0.02 else master_volume_db - 16.0 + 12.0 * speed01
		_wheels.pitch_scale = 0.7 + speed01 * 0.8
	if _rattle:
		_rattle.volume_db = -80.0 if muted or rattle01 < 0.02 else master_volume_db - 20.0 + 14.0 * rattle01
		_rattle.pitch_scale = 0.9 + rattle01 * 0.3


func stop_all() -> void:
	set_rolling(0.0, 0.0)
	for p in _players:
		p.stop()


# --- Placeholder synthesis (so the prototype has sound with zero assets) -------

func _synth(slot: StringName) -> AudioStreamWAV:
	var s := PackedFloat32Array()
	var loop := false
	match slot:
		&"trolley_wheels":
			loop = true
			s = _noise(0.5, 0.25, 0.08)
			for i in s.size():
				var tt := float(i) / RATE
				s[i] += 0.35 * sin(TAU * 55.0 * tt) * (0.6 + 0.4 * sin(TAU * 8.0 * tt))
				if fmod(tt, 0.125) < 0.004:
					s[i] += 0.5
		&"rattle":
			loop = true
			s = _empty(0.4)
			for k in 14:
				var at := int(randf() * (s.size() - 400))
				for j in 300:
					s[at + j] += (randf() * 2.0 - 1.0) * 0.5 * (1.0 - j / 300.0)
		&"bash":
			s = _tones([180.0, 523.0, 1187.0, 1840.0], [0.7, 0.4, 0.3, 0.2], 0.35, 9.0)
			_add(s, _noise(0.08, 0.8, 1.0), 0)
		&"skid":
			s = _empty(0.35)
			for i in s.size():
				var tt := float(i) / RATE
				s[i] = sin(TAU * (880.0 + 60.0 * sin(TAU * 25.0 * tt)) * tt) * 0.3 * (1.0 - tt / 0.35) + (randf() - 0.5) * 0.15
		&"crash":
			s = _noise(0.4, 0.9, 0.2)
			_add(s, _sweep(120.0, 40.0, 0.35, 0.9, 6.0), 0)
			_add(s, _tones([300.0, 731.0], [0.3, 0.2], 0.35, 8.0), 0)
		&"catch":
			s = _sweep(170.0, 55.0, 0.16, 1.0, 14.0)
			_add(s, _noise(0.03, 0.5, 1.0), 0)
		&"golden_catch":
			s = _tones([1318.5, 1975.5, 2637.0], [0.5, 0.35, 0.2], 0.9, 3.5)
			_add(s, _tones([1567.98, 2349.3], [0.35, 0.2], 0.7, 4.0), int(0.09 * RATE))
		&"rotten_splat":
			s = _noise(0.32, 0.9, 0.08)
			_add(s, _sweep(220.0, 70.0, 0.4, 0.6, 5.0), 0)
			_add(s, _sweep(330.0, 260.0, 0.25, 0.3, 3.0), int(0.22 * RATE))
		&"bounce":
			s = _sweep(260.0, 700.0, 0.12, 0.6, 12.0)
		&"spill":
			s = _sweep(800.0, 180.0, 0.3, 0.5, 4.0)
			_add(s, _noise(0.1, 0.3, 0.6), 0)
		&"launch":
			s = _sweep(120.0, 420.0, 0.14, 0.45, 8.0)
			_add(s, _noise(0.12, 0.35, 0.4), 0)
		&"scanner_beep":
			s = _square(1760.0, 0.09, 0.35)
		&"scanner_golden":
			s = _square(1760.0, 0.07, 0.3)
			_add(s, _tones([2093.0, 3136.0, 4186.0], [0.5, 0.3, 0.2], 0.8, 3.0), int(0.06 * RATE))
		&"scanner_error":
			s = _empty(0.5)
			for i in s.size():
				var tt := float(i) / RATE
				s[i] = (fmod(tt * 110.0, 1.0) - 0.5) * 0.45 + (fmod(tt * 117.0, 1.0) - 0.5) * 0.35
		&"checkout_open":
			s = _arp([784.0, 1046.5], 0.11, 0.35)
		&"checkout_success":
			s = _arp([523.25, 659.25, 783.99, 1046.5], 0.09, 0.4)
		&"completion":
			s = _arp([523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5], 0.12, 0.45)
		_:
			s = _square(440.0, 0.05, 0.2)
	return _to_wav(s, loop)


func _empty(sec: float) -> PackedFloat32Array:
	var a := PackedFloat32Array()
	a.resize(int(sec * RATE))
	return a


func _add(dst: PackedFloat32Array, src: PackedFloat32Array, offset: int) -> void:
	for i in src.size():
		if i + offset < dst.size():
			dst[i + offset] += src[i]


func _noise(sec: float, amp: float, decay_per_sec: float) -> PackedFloat32Array:
	var a := _empty(sec)
	var lp := 0.0
	for i in a.size():
		var tt := float(i) / RATE
		lp = lerpf(lp, randf() * 2.0 - 1.0, 0.35)
		a[i] = lp * amp * exp(-tt / maxf(decay_per_sec, 0.001) * 0.2) * (1.0 - tt / sec)
	return a


func _sweep(f0: float, f1: float, sec: float, amp: float, decay: float) -> PackedFloat32Array:
	var a := _empty(sec)
	var ph := 0.0
	for i in a.size():
		var tt := float(i) / RATE
		ph += TAU * lerpf(f0, f1, tt / sec) / RATE
		a[i] = sin(ph) * amp * exp(-tt * decay)
	return a


func _tones(freqs: Array, amps: Array, sec: float, decay: float) -> PackedFloat32Array:
	var a := _empty(sec)
	for i in a.size():
		var tt := float(i) / RATE
		var v := 0.0
		for k in freqs.size():
			v += sin(TAU * freqs[k] * tt) * amps[k]
		a[i] = v * exp(-tt * decay) * minf(1.0, tt * 400.0)
	return a


func _square(f: float, sec: float, amp: float) -> PackedFloat32Array:
	var a := _empty(sec)
	for i in a.size():
		var tt := float(i) / RATE
		a[i] = (amp if fmod(tt * f, 1.0) < 0.5 else -amp) * (1.0 - tt / sec * 0.3)
	return a


func _arp(freqs: Array, step: float, amp: float) -> PackedFloat32Array:
	var a := _empty(step * freqs.size() + 0.35)
	for k in freqs.size():
		_add(a, _tones([freqs[k], freqs[k] * 2.0], [amp, amp * 0.3], 0.4, 6.0), int(k * step * RATE))
	return a


func _to_wav(s: PackedFloat32Array, loop: bool) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(s.size() * 2)
	for i in s.size():
		bytes.encode_s16(i * 2, int(clampf(s[i], -1.0, 1.0) * 30000.0))
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
