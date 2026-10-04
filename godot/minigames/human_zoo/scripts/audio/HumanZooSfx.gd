class_name HumanZooSfx
extends Node
## Tiny procedural sound kit so the module needs no audio assets.
## Replace any stream with a real asset via set_stream(name, stream).

const RATE := 22050

var _streams: Dictionary = {}
var _players: Array = []
var _loops: Dictionary = {}
var muted := false
@export var master_db := -6.0


func _ready() -> void:
	for i in 10:
		var p := AudioStreamPlayer.new()
		p.volume_db = master_db
		add_child(p)
		_players.append(p)
	_streams["clunk"] = _make(0.55, _clunk)
	_streams["clank"] = _make(0.8, _clank)
	_streams["hiss"] = _make(1.1, _hiss)
	_streams["bell"] = _make(2.2, func(t): return _bell(t, 523.0))
	_streams["bell_low"] = _make(2.8, func(t): return _bell(t, 349.0))
	_streams["blip"] = _make(0.05, _blip)
	_streams["ratchet"] = _make(0.12, _ratchet)
	_streams["lever"] = _make(0.9, _lever)
	_streams["pop"] = _make(0.08, _pop)
	_streams["boing"] = _make(0.5, _boing)
	_streams["lamp"] = _make(0.15, _lamp)
	_streams["chord"] = _make(3.5, _chord)
	_streams["swell"] = _make(6.0, _swell)
	_streams["sting"] = _make(1.6, _sting)
	_streams["static"] = _make(2.0, _static, true)
	_streams["hum"] = _make(2.0, _hum, true)


func set_stream(sound_name: String, stream: AudioStream) -> void:
	_streams[sound_name] = stream


func play(sound_name: String, pitch := 1.0, volume := 0.0) -> void:
	if muted or not _streams.has(sound_name):
		return
	for p in _players:
		if not p.playing:
			p.stream = _streams[sound_name]
			p.pitch_scale = pitch
			p.volume_db = master_db + volume
			p.play()
			return


## Looping sounds (static, hum) with a controllable volume (0..1).
func set_loop(sound_name: String, amount: float, pitch := 1.0) -> void:
	if not _streams.has(sound_name):
		return
	var p: AudioStreamPlayer = _loops.get(sound_name)
	if p == null:
		p = AudioStreamPlayer.new()
		p.stream = _streams[sound_name]
		add_child(p)
		_loops[sound_name] = p
	if amount <= 0.001 or muted:
		if p.playing:
			p.stop()
		return
	p.volume_db = master_db + linear_to_db(clampf(amount, 0.0, 1.0))
	p.pitch_scale = pitch
	if not p.playing:
		p.play()


func _make(duration: float, fn: Callable, loop := false) -> AudioStreamWAV:
	var n := int(duration * RATE)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var v: float = clampf(fn.call(float(i) / RATE), -1.0, 1.0)
		data.encode_s16(i * 2, int(v * 32000.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = data
	if loop:
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = n
	return s


func _noise() -> float:
	return randf() * 2.0 - 1.0


func _clunk(t: float) -> float:
	var thump := sin(TAU * (70.0 - t * 40.0) * t) * exp(-t * 9.0)
	var metal := (sin(TAU * 410.0 * t) + 0.6 * sin(TAU * 1130.0 * t)) * exp(-t * 18.0) * 0.4
	return (thump + metal + _noise() * exp(-t * 40.0) * 0.5) * 0.9


func _clank(t: float) -> float:
	var hits := 0.0
	for k in [0.0, 0.18, 0.31]:
		var tt: float = t - k
		if tt > 0:
			hits += (sin(TAU * 620.0 * tt) * 0.5 + sin(TAU * 1720.0 * tt) * 0.4 + _noise() * 0.5) * exp(-tt * 14.0)
	return hits * 0.7


func _hiss(t: float) -> float:
	var env := minf(t * 8.0, 1.0) * exp(-t * 2.2)
	return _noise() * env * 0.45


func _bell(t: float, f: float) -> float:
	var env := exp(-t * 1.6)
	return (sin(TAU * f * t) + 0.5 * sin(TAU * f * 2.76 * t) * exp(-t * 3.0) + 0.3 * sin(TAU * f * 5.4 * t) * exp(-t * 6.0)) * env * 0.35


func _blip(t: float) -> float:
	return signf(sin(TAU * 330.0 * t)) * 0.18 * (1.0 - t / 0.05)


func _ratchet(t: float) -> float:
	return (_noise() * 0.6 + sin(TAU * 900.0 * t) * 0.4) * exp(-t * 45.0)


func _lever(t: float) -> float:
	var creak := sin(TAU * (180.0 + sin(t * 30.0) * 40.0) * t) * 0.25 * minf(t * 4.0, 1.0) * exp(-t * 2.0)
	return creak + _clunk(maxf(t - 0.55, 0.0)) * float(t > 0.55)


func _pop(t: float) -> float:
	return sin(TAU * (900.0 - t * 6000.0) * t) * exp(-t * 60.0) * 0.6


func _boing(t: float) -> float:
	return sin(TAU * (220.0 + 120.0 * sin(t * 40.0) * exp(-t * 5.0)) * t) * exp(-t * 5.0) * 0.5


func _lamp(t: float) -> float:
	return sin(TAU * 1500.0 * t) * exp(-t * 30.0) * 0.3


func _chord(t: float) -> float:
	var env := minf(t * 2.0, 1.0) * exp(-t * 0.6)
	var v := 0.0
	for f in [130.8, 196.0, 261.6, 329.6]:
		v += sin(TAU * f * t + sin(TAU * 5.0 * t) * 0.3)
	return v * env * 0.12


func _swell(t: float) -> float:
	var env := minf(t / 2.5, 1.0) * clampf((6.0 - t) / 1.5, 0.0, 1.0)
	var v := 0.0
	for f in [174.6, 261.6, 349.2, 440.0, 523.3, 659.3]:
		v += sin(TAU * f * t + 0.4 * sin(TAU * 0.3 * t * f / 100.0))
	return v * env * 0.07


func _sting(t: float) -> float:
	var env := exp(-t * 2.5)
	var v := sin(TAU * 98.0 * t) + sin(TAU * 103.8 * t) + 0.6 * sin(TAU * 415.3 * t) * exp(-t * 6.0)
	return v * env * 0.22


func _static(t: float) -> float:
	return _noise() * (0.35 + 0.15 * sin(TAU * 3.0 * t)) * 0.6


func _hum(t: float) -> float:
	return (sin(TAU * 55.0 * t) * 0.5 + sin(TAU * 110.0 * t) * 0.25 + sin(TAU * 165.5 * t) * 0.1) * 0.5
