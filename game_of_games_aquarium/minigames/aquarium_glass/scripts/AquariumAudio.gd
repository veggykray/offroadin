extends Node
## Replaceable sound slots. Missing sounds are silently ignored, so the game
## never breaks because an audio file is absent.
##
## HOW TO REPLACE A SOUND
##   Option A: overwrite the file in minigames/aquarium_glass/audio/ with the
##             same name (e.g. glass_tap.wav). Any format Godot imports works
##             if you keep the name and change `extension_order`.
##   Option B: drag an AudioStream onto the slot in the `overrides` dictionary
##             in the Inspector (key = slot name, value = AudioStream).
##
## SLOTS (one-shots): glass_tap, glass_double_tap, hard_knock, glass_stress,
##   glass_crack, bubbles, blimp_move, blimp_impact, bastard_swarm, bastard_bite,
##   coward_startle, coward_dash, coward_impact, sucker_attach, idiot_noise,
##   shell_move, shell_crack, rope_snap, memory_release, memory_shimmer,
##   chute_suck, deep_rumble, deep_approach, final_tap, completion
## SLOTS (loops): ambience, glass_rub, glass_scratch, bastard_swarm_loop, chase_music

const LOOP_SLOTS := ["ambience", "glass_rub", "glass_scratch", "bastard_swarm_loop", "chase_music"]

## Folder containing <slot>.wav / .ogg / .mp3 files.
@export_dir var audio_folder := "res://minigames/aquarium_glass/audio"
@export var extension_order := PackedStringArray(["ogg", "wav", "mp3"])
## slot name -> AudioStream. Takes priority over files in audio_folder.
@export var overrides: Dictionary = {}
## Audio bus to play on (falls back to Master if it does not exist).
@export var bus := "Master"
@export_range(-40.0, 12.0) var master_volume_db := 0.0
@export var muted := false
@export var one_shot_voices := 16

var activity: Node
var _streams := {}
var _pool: Array = []
var _next := 0
var _loops := {}       # slot -> {player, target_db, active, base_db}


func setup(p_activity: Node) -> void:
	activity = p_activity
	var use_bus := bus if AudioServer.get_bus_index(bus) >= 0 else "Master"
	for i in one_shot_voices:
		var p := AudioStreamPlayer.new()
		p.bus = use_bus
		add_child(p)
		_pool.append(p)
	for slot in LOOP_SLOTS:
		var lp := AudioStreamPlayer.new()
		lp.bus = use_bus
		add_child(lp)
		_loops[slot] = {"player": lp, "target_db": -80.0, "active": false, "rate": 40.0}


func get_stream(slot: String) -> AudioStream:
	if _streams.has(slot):
		return _streams[slot]
	var s: AudioStream = null
	if overrides.has(slot) and overrides[slot] is AudioStream:
		s = overrides[slot]
	else:
		for ext in extension_order:
			var path := "%s/%s.%s" % [audio_folder, slot, ext]
			if ResourceLoader.exists(path):
				s = load(path)
				break
	if s and slot in LOOP_SLOTS:
		_make_looping(s)
	_streams[slot] = s
	return s


func _make_looping(s: AudioStream) -> void:
	if s is AudioStreamWAV:
		var w := s as AudioStreamWAV
		if w.loop_mode == AudioStreamWAV.LOOP_DISABLED:
			w.loop_mode = AudioStreamWAV.LOOP_FORWARD
			w.loop_begin = 0
			var bytes_per_sample := (2 if w.format == AudioStreamWAV.FORMAT_16_BITS else 1) * (2 if w.stereo else 1)
			w.loop_end = w.data.size() / bytes_per_sample
	elif s.get("loop") != null:
		s.set("loop", true)


## Play a one-shot. pitch_random adds +-random variation.
func play(slot: String, volume_db := 0.0, pitch := 1.0, pitch_random := 0.05) -> void:
	if muted:
		return
	var s := get_stream(slot)
	if s == null:
		return
	var p: AudioStreamPlayer = _pool[_next]
	_next = (_next + 1) % _pool.size()
	p.stream = s
	p.volume_db = volume_db + master_volume_db
	p.pitch_scale = maxf(0.05, pitch * (1.0 + randf_range(-pitch_random, pitch_random)))
	p.play()


## Turn a looping slot on/off (smoothly).
func loop(slot: String, active: bool, volume_db := 0.0) -> void:
	if not _loops.has(slot):
		return
	var l: Dictionary = _loops[slot]
	l.active = active and not muted
	if active and l.rate >= 40.0:
		l.target_db = volume_db
	var p: AudioStreamPlayer = l.player
	if l.active and not p.playing:
		var s := get_stream(slot)
		if s == null:
			return
		p.stream = s
		p.volume_db = -40.0
		p.play()


## Slowly fade a loop to volume_db over `seconds` (used for the finale hush).
func fade_loop(slot: String, volume_db: float, seconds: float) -> void:
	if _loops.has(slot):
		var l: Dictionary = _loops[slot]
		l.rate = maxf(1.0, absf(l.target_db - volume_db) / maxf(seconds, 0.05))
		l.target_db = volume_db


func set_loop_pitch(slot: String, pitch: float) -> void:
	if _loops.has(slot):
		(_loops[slot].player as AudioStreamPlayer).pitch_scale = pitch


func stop_all_loops() -> void:
	for slot in _loops:
		_loops[slot].active = false
		(_loops[slot].player as AudioStreamPlayer).stop()


func _process(delta: float) -> void:
	for slot in _loops:
		var l: Dictionary = _loops[slot]
		var p: AudioStreamPlayer = l.player
		if not p.playing:
			continue
		var target: float = (l.target_db + master_volume_db) if l.active else -60.0
		var rate: float = l.rate if l.active else 40.0
		p.volume_db = move_toward(p.volume_db, target, rate * delta)
		if absf(p.volume_db - target) < 0.1:
			l.rate = 40.0
		if not l.active and p.volume_db <= -59.0:
			p.stop()
