class_name BeastVoice
extends Node
## All of the beast's sound. One-shots are synthesised at start-up on a
## background thread (see Synth); a live "bed" generator plays continuous
## breathing, a low drone and a heartbeat that all follow escalation.
##
## To use recorded audio instead, drop res://audio/<name>.wav/.ogg into the
## project; it replaces the synthesised version automatically.

signal sounds_ready

const NAMES := Synth.NAMES
const BED_RATE := 22050.0

@export var master_db := 0.0
@export var bed_db := -4.0
@export var pool_size := 14

var loaded := false
var streams := {}
var _pool_2d: Array[AudioStreamPlayer2D] = []
var _pool: Array[AudioStreamPlayer] = []
var _next_2d := 0
var _next := 0
var _thread: Thread
var _bed: AudioStreamPlayer
var _bed_pb: AudioStreamGeneratorPlayback
var _bed_t := 0.0
var _lp_air := 0.0
var _lp_drone := 0.0
var _heart_t := 0.0
var _rng := RandomNumberGenerator.new()
var _bed_lp_a := 0.0


func _ready() -> void:
	Game.voice = self
	for i in range(pool_size):
		var p := AudioStreamPlayer2D.new()
		p.max_distance = 5200.0
		p.attenuation = 0.6
		p.panning_strength = 1.4
		add_child(p)
		_pool_2d.append(p)
		var q := AudioStreamPlayer.new()
		add_child(q)
		_pool.append(q)
	_bed = AudioStreamPlayer.new()
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = BED_RATE
	gen.buffer_length = 0.2
	_bed.stream = gen
	_bed.volume_db = bed_db + master_db
	add_child(_bed)
	_bed.play()
	_bed_pb = _bed.get_stream_playback() as AudioStreamGeneratorPlayback
	_thread = Thread.new()
	_thread.start(_build_all)


func _build_all() -> Dictionary:
	var out := {}
	for n in NAMES:
		var custom := _load_custom(n)
		out[n] = custom if custom else Synth.build(n)
	return out


func _load_custom(n: StringName) -> AudioStream:
	for ext in ["wav", "ogg"]:
		var path := "res://audio/%s.%s" % [n, ext]
		if ResourceLoader.exists(path):
			return load(path)
	return null


func _exit_tree() -> void:
	if _thread and _thread.is_started():
		_thread.wait_to_finish()


func _process(delta: float) -> void:
	if not loaded and _thread and _thread.is_started() and not _thread.is_alive():
		streams = _thread.wait_to_finish()
		loaded = true
		sounds_ready.emit()
	_fill_bed()


## Non-positional one-shot.
func play(n: StringName, vol_db: float = 0.0, pitch: float = 1.0) -> void:
	if not loaded or not streams.has(n):
		return
	var p := _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = streams[n]
	p.volume_db = vol_db + master_db
	p.pitch_scale = pitch
	p.play()


## One-shot from a place on the beast (panned and attenuated).
func play_at(n: StringName, world_pos: Vector2, vol_db: float = 0.0, pitch: float = 1.0) -> void:
	if not loaded or not streams.has(n):
		return
	var p := _pool_2d[_next_2d]
	_next_2d = (_next_2d + 1) % _pool_2d.size()
	p.stream = streams[n]
	p.global_position = world_pos
	p.volume_db = vol_db + master_db
	p.pitch_scale = pitch
	p.play()


## Somewhere out of frame to the left (-1) or right (+1).
func play_offscreen(n: StringName, side: float, vol_db: float = 0.0, pitch: float = 1.0) -> void:
	play_at(n, Vector2(Game.camera_x() + side * 1500.0, 200.0), vol_db, pitch)


func play_offscreen_delayed(n: StringName, side: float, delay: float, vol_db: float = 0.0, pitch: float = 1.0) -> void:
	get_tree().create_timer(delay).timeout.connect(func(): play_offscreen(n, side, vol_db, pitch))


# --- Continuous bed: breath, drone, heartbeat ------------------------------------

func _fill_bed() -> void:
	if _bed_pb == null:
		return
	var frames := _bed_pb.get_frames_available()
	if frames <= 0:
		return
	var e := Game.escalation()
	var body := Game.body
	var breath_phase: float = body.breath_phase if body else 0.0
	var depth: float = body.breath_depth if body else 1.0
	var rate: float = lerpf(0.15, 0.7, e)
	var pleasure: float = Game.mind.pleasure if Game.mind else 0.0
	var spent: bool = Game.mind != null and Game.mind.mood == BeastMind.Mood.SPENT
	var bpm := lerpf(44.0, 150.0, e * e)
	if spent:
		bpm = 40.0
	var beat_len := 60.0 / bpm
	var heart_amp := 0.12 + e * 0.5
	var drone_amp := 0.05 + e * 0.12 + pleasure * 0.06
	var dt := 1.0 / BED_RATE
	var a_air := 1.0 - exp(-TAU * 500.0 / BED_RATE)
	var a_dr := 1.0 - exp(-TAU * 120.0 / BED_RATE)
	var ph := breath_phase
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_bed_t += dt
		ph += TAU * rate * dt
		# Air: loud on the moving parts of the breath, a bit louder exhaling.
		var air := absf(cos(ph))
		air *= 1.3 if cos(ph) < 0.0 else 0.8
		var nz := _rng.randf_range(-1.0, 1.0)
		_lp_air += (nz - _lp_air) * a_air
		var s := _lp_air * air * (0.18 + depth * 0.1)
		# Drone with a purring flutter when pleased.
		var flutter := 1.0 - pleasure * 0.5 * (0.5 + 0.5 * sin(_bed_t * TAU * 24.0))
		var dr := sin(_bed_t * TAU * 38.0) + sin(_bed_t * TAU * 57.3) * 0.35
		_lp_drone += (dr - _lp_drone) * a_dr
		s += _lp_drone * drone_amp * flutter
		# Heartbeat: lub-dub.
		_heart_t += dt
		if _heart_t > beat_len:
			_heart_t -= beat_len
		var h := 0.0
		if _heart_t < 0.12:
			h = sin(_heart_t * TAU * 52.0) * exp(-_heart_t * 30.0)
		elif _heart_t > 0.22 and _heart_t < 0.32:
			var u := _heart_t - 0.22
			h = sin(u * TAU * 44.0) * exp(-u * 36.0) * 0.7
		s += h * heart_amp
		buf[i] = Vector2(s, s)
	_bed_pb.push_buffer(buf)
