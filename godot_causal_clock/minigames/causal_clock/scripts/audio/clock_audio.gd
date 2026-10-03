class_name CausalClockAudio
extends Node
## Sound hooks for the mini-game.
##
## Every event has a synthesized placeholder generated at startup, so the
## game makes sound with no audio assets at all. To use real sounds, set a
## path for the event in data/audio_events.json (or call set_override()).
##
## Events: ring_rotate, gear_engage, gear_slip, pin_place, pin_remove,
## invalid, align_chime, chain_break, milestone, complete, ui_click, tick,
## ambient (looping).

const RATE := 22050
const EVENTS := ["ring_rotate", "gear_engage", "gear_slip", "pin_place", "pin_remove", "invalid",
	"align_chime", "chain_break", "milestone", "complete", "ui_click", "tick", "ambient"]

@export var bus: StringName = &"Master"
@export var master_db: float = -4.0
@export var config_path: String = "res://minigames/causal_clock/data/audio_events.json"

var _streams: Dictionary = {}
var _volume: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _ambient: AudioStreamPlayer
var _next: int = 0
var _synth_task: int = -1
var _synth_result: Dictionary = {}
var _want_ambient: bool = false
var muted: bool = false


func _ready() -> void:
	for e in EVENTS:
		_volume[e] = 0.0
	# Rendering the placeholders takes ~0.5 s, so it happens on a worker
	# thread; events fired before it finishes are simply silent.
	_synth_task = WorkerThreadPool.add_task(func(): _synth_result = _render_placeholders(), false, "causal_clock_audio")
	for i in 14:
		var p := AudioStreamPlayer.new()
		p.bus = bus
		add_child(p)
		_pool.append(p)
	_ambient = AudioStreamPlayer.new()
	_ambient.bus = bus
	add_child(_ambient)


func _process(_dt: float) -> void:
	if _synth_task >= 0 and WorkerThreadPool.is_task_completed(_synth_task):
		WorkerThreadPool.wait_for_task_completion(_synth_task)
		_synth_task = -1
		for k in _synth_result.keys():
			if not _streams.has(k):
				_streams[k] = _synth_result[k]
		_synth_result = {}
		_load_config()
		if _want_ambient:
			start_ambient()


func _exit_tree() -> void:
	for p in _pool:
		p.stop()
	if _ambient:
		_ambient.stop()
	if _synth_task >= 0:
		WorkerThreadPool.wait_for_task_completion(_synth_task)
		_synth_task = -1


func set_override(event: String, stream: AudioStream, volume_db: float = 0.0) -> void:
	_streams[event] = stream
	_volume[event] = volume_db


## Play a one-shot. `pitch` scales playback speed; `delay` in seconds.
func play(event: String, pitch: float = 1.0, volume_db: float = 0.0, delay: float = 0.0) -> void:
	if muted or not _streams.has(event) or not is_inside_tree():
		return
	if delay > 0.0:
		get_tree().create_timer(delay).timeout.connect(play.bind(event, pitch, volume_db, 0.0))
		return
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = _streams[event]
	p.pitch_scale = clampf(pitch, 0.25, 4.0)
	p.volume_db = master_db + _volume.get(event, 0.0) + volume_db
	p.play()


func start_ambient() -> void:
	_want_ambient = true
	if muted or not _streams.has("ambient"):
		return
	_ambient.stream = _streams["ambient"]
	_ambient.volume_db = master_db + _volume.get("ambient", 0.0) - 6.0
	_ambient.play()


func stop_ambient() -> void:
	_want_ambient = false
	_ambient.stop()


func set_muted(v: bool) -> void:
	muted = v
	if v:
		_ambient.stop()
	else:
		start_ambient()


func _load_config() -> void:
	if not FileAccess.file_exists(config_path):
		return
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(config_path)) != OK or typeof(json.data) != TYPE_DICTIONARY:
		push_warning("Causal Clock: could not parse %s" % config_path)
		return
	var events: Dictionary = json.data.get("events", {})
	for e in events.keys():
		var cfg: Dictionary = events[e]
		_volume[e] = float(cfg.get("volume_db", 0.0))
		var path := str(cfg.get("path", ""))
		if path != "":
			if ResourceLoader.exists(path):
				var s := load(path) as AudioStream
				if s:
					_streams[e] = s
			else:
				push_warning("Causal Clock: audio override for '%s' not found: %s" % [e, path])


# ---------------------------------------------------------------------------
# Placeholder synthesis. Small additive/noise recipes, rendered once to
# 16-bit PCM. Nothing fancy — they only need to read as "metal", "wood",
# "bell" and "machine" until real audio replaces them.
# ---------------------------------------------------------------------------

func _render_placeholders() -> Dictionary:
	var out := {}
	var rng := RandomNumberGenerator.new()
	rng.seed = 1234
	out["ring_rotate"] = _wav(_ratchet(rng, 0.42, 5, 0.9))
	out["gear_engage"] = _wav(_bell(0.32, 1180.0, [1.0, 2.71, 4.1], 18.0, 0.45, rng, 0.25))
	out["gear_slip"] = _wav(_ratchet(rng, 0.3, 9, 0.45))
	out["pin_place"] = _wav(_mix(_thump(0.35, 95.0, 0.9), _bell(0.35, 820.0, [1.0, 2.4, 3.9], 14.0, 0.5, rng, 0.35)))
	out["pin_remove"] = _wav(_bell(0.28, 1320.0, [1.0, 2.2], 22.0, 0.42, rng, 0.2))
	out["invalid"] = _wav(_mix(_thump(0.3, 70.0, 0.9), _buzz(0.22, 110.0, 0.25)))
	out["align_chime"] = _wav(_bell(1.4, 660.0, [1.0, 2.0, 3.01, 4.2], 3.2, 0.55, rng, 0.0))
	out["chain_break"] = _wav(_bell(0.6, 196.0, [1.0, 1.5, 2.9], 6.0, 0.35, rng, 0.05))
	out["milestone"] = _wav(_arpeggio([523.25, 659.25, 783.99, 1046.5], 0.14, 1.8))
	out["complete"] = _wav(_chord([130.81, 196.0, 261.63, 329.63, 392.0, 523.25], 4.5))
	out["ui_click"] = _wav(_bell(0.08, 2400.0, [1.0, 1.7], 60.0, 0.25, rng, 0.4))
	out["tick"] = _wav(_bell(0.06, 3100.0, [1.0, 1.9], 80.0, 0.18, rng, 0.5))
	var amb := _wav(_ambient_loop(rng, 8.0))
	amb.loop_mode = AudioStreamWAV.LOOP_FORWARD
	amb.loop_begin = 0
	amb.loop_end = int(8.0 * RATE)
	out["ambient"] = amb
	return out


func _wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	return w


func _buf(seconds: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(seconds * RATE))
	b.fill(0.0)
	return b


func _mix(a: PackedFloat32Array, b: PackedFloat32Array) -> PackedFloat32Array:
	var out := a if a.size() >= b.size() else b
	var other := b if out == a else a
	out = out.duplicate()
	for i in other.size():
		out[i] += other[i]
	return out


func _bell(seconds: float, f0: float, partials: Array, decay: float, amp: float, rng: RandomNumberGenerator, noise: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	for i in b.size():
		var t := float(i) / RATE
		var v := 0.0
		for k in partials.size():
			var p: float = partials[k]
			v += sin(TAU * f0 * p * t) * exp(-t * decay * (1.0 + k * 0.6)) / (k + 1.0)
		v += rng.randf_range(-1, 1) * noise * exp(-t * 90.0)
		b[i] = v * amp * minf(1.0, t * 800.0)
	return b


func _thump(seconds: float, f0: float, amp: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	var phase := 0.0
	for i in b.size():
		var t := float(i) / RATE
		var f := f0 * (1.0 + 1.5 * exp(-t * 30.0))
		phase += TAU * f / RATE
		b[i] = sin(phase) * exp(-t * 12.0) * amp
	return b


func _buzz(seconds: float, f0: float, amp: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	for i in b.size():
		var t := float(i) / RATE
		var saw := fmod(t * f0, 1.0) * 2.0 - 1.0
		b[i] = saw * amp * exp(-t * 9.0) * minf(1.0, t * 300.0)
	return b


## Several sharp clicks (pawl over teeth) on top of a woody rumble.
func _ratchet(rng: RandomNumberGenerator, seconds: float, clicks: int, amp: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	for c in clicks:
		var start := int((float(c) / clicks) * seconds * 0.8 * RATE)
		var f := rng.randf_range(1800.0, 2600.0)
		for i in int(0.03 * RATE):
			var t := float(i) / RATE
			if start + i < b.size():
				b[start + i] += (sin(TAU * f * t) * 0.6 + rng.randf_range(-1, 1) * 0.5) * exp(-t * 180.0) * amp * 0.6
	var ph := 0.0
	for i in b.size():
		var t := float(i) / RATE
		ph += TAU * (70.0 + 20.0 * sin(t * 9.0)) / RATE
		b[i] += (sin(ph) * 0.35 + rng.randf_range(-1, 1) * 0.08) * sin(PI * t / seconds) * amp * 0.5
	return b


func _arpeggio(freqs: Array, gap: float, seconds: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	for n in freqs.size():
		var start := int(n * gap * RATE)
		var f: float = freqs[n]
		for i in range(start, b.size()):
			var t := float(i - start) / RATE
			b[i] += (sin(TAU * f * t) + 0.4 * sin(TAU * f * 2.0 * t) + 0.15 * sin(TAU * f * 3.01 * t)) * exp(-t * 2.6) * 0.16 * minf(1.0, t * 400.0)
	return b


func _chord(freqs: Array, seconds: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	for i in b.size():
		var t := float(i) / RATE
		var env := minf(1.0, t * 1.6) * exp(-maxf(0.0, t - 1.2) * 1.1)
		var v := 0.0
		for k in freqs.size():
			var f: float = freqs[k]
			v += sin(TAU * f * t + sin(t * 3.0 + k) * 0.6) * (0.9 - k * 0.08)
			v += 0.3 * sin(TAU * f * 2.0 * t) * exp(-t * 0.8)
		b[i] = v * env * 0.075
	return b


## A soft machine-room bed: low beating drones, a far-off whirr and air.
func _ambient_loop(rng: RandomNumberGenerator, seconds: float) -> PackedFloat32Array:
	var b := _buf(seconds)
	var lp := 0.0
	for i in b.size():
		var t := float(i) / RATE
		# Frequencies chosen to complete whole cycles over the loop length.
		var v := sin(TAU * 55.0 * t) * 0.22 + sin(TAU * 55.5 * t) * 0.2 + sin(TAU * 82.5 * t) * 0.08
		v *= 0.75 + 0.25 * sin(TAU * t / seconds * 2.0)
		lp += (rng.randf_range(-1, 1) - lp) * 0.02
		v += lp * 0.5
		v += sin(TAU * 220.0 * t) * 0.02 * (0.5 + 0.5 * sin(TAU * t / seconds * 4.0))
		b[i] = v * 0.5
	return b
