class_name VisemeTrackLipSync
extends LipSyncDriver
## Plays a list of timed mouth shapes ("visemes").
##
## This is the path towards proper phoneme lip sync. Sources of keys:
##   * from_text()     - rough shapes generated from the subtitle text, used when
##                       a line has no audio file yet.
##   * from_rhubarb()  - the output of Rhubarb Lip Sync (free tool) for a WAV,
##                       played in time with the audio.
##   * build your own  - any Array of {"time": float, "shape": MouthPose.Shape, "open": float}

## Optional audio player used as the clock (keeps shapes in sync with audio).
var _player: Node
var _stream: AudioStream
var _keys: Array = []
var _duration := 0.0
var _played := false

## Seconds over which one shape blends into the next (co-articulation).
var blend_time := 0.07


func _init(keys: Array, player: Node = null, stream: AudioStream = null) -> void:
	_keys = keys
	_player = player
	_stream = stream
	if not _keys.is_empty():
		_duration = float(_keys[-1].time)
	if _stream:
		_duration = maxf(_duration, _stream.get_length())


func start() -> void:
	super.start()
	if _player and _stream:
		_player.set("stream", _stream)
		_player.call("play")
		_played = true


func stop() -> void:
	super.stop()
	if _played and is_instance_valid(_player) and _player.get("playing"):
		_player.call("stop")


func get_duration() -> float:
	return _duration


func _sample(_delta: float) -> Dictionary:
	var t := _time
	if _played and is_instance_valid(_player):
		if not _player.get("playing") and _time > 0.05:
			_finish()
			return {"pose": MouthPose.new(), "energy": 0.0}
		t = _player.call("get_playback_position") + AudioServer.get_time_since_last_mix()
	elif t >= _duration:
		_finish()
		return {"pose": MouthPose.new(), "energy": 0.0}
	if _keys.is_empty():
		return {"pose": MouthPose.new(), "energy": 0.0}
	# Find the active key.
	var i := 0
	while i + 1 < _keys.size() and float(_keys[i + 1].time) <= t:
		i += 1
	var cur: Dictionary = _keys[i]
	var pose := _key_pose(cur)
	if i + 1 < _keys.size():
		var nxt: Dictionary = _keys[i + 1]
		var until := float(nxt.time) - t
		if until < blend_time:
			pose = pose.lerp_to(_key_pose(nxt), 1.0 - until / blend_time)
	pose.open = clampf(pose.open * sensitivity, 0.0, 1.0)
	return {"pose": pose, "energy": clampf(pose.open * 1.4, 0.0, 1.0)}


func _key_pose(key: Dictionary) -> MouthPose:
	var p := MouthPose.from_shape(int(key.get("shape", MouthPose.Shape.REST)))
	if key.has("open"):
		p.open = float(key.open)
	return p


## Very rough text -> viseme conversion, so lines without audio still move the
## mouth believably. `rate` > 1 speaks faster.
static func from_text(text: String, rate := 1.0) -> VisemeTrackLipSync:
	return VisemeTrackLipSync.new(text_to_keys(text, rate))


static func text_to_keys(text: String, rate := 1.0) -> Array:
	var keys: Array = []
	var t := 0.12
	var s := text.to_lower()
	var i := 0
	var last_shape := -1
	while i < s.length():
		var c := s[i]
		var dur := 0.07
		var shape := MouthPose.Shape.SMALL_OPEN
		var open := 0.25
		if s.substr(i, 3) == "...":
			shape = MouthPose.Shape.REST; open = 0.0; dur = 0.55; i += 2
		elif c in ".!?":
			shape = MouthPose.Shape.REST; open = 0.0; dur = 0.4
		elif c in ",;:-":
			shape = MouthPose.Shape.REST; open = 0.0; dur = 0.22
		elif c == " ":
			shape = MouthPose.Shape.REST; open = 0.05; dur = 0.04
		elif c == "a":
			shape = MouthPose.Shape.WIDE_OPEN; open = 0.8; dur = 0.1
		elif c == "e":
			shape = MouthPose.Shape.SMILE_OPEN; open = 0.45; dur = 0.09
		elif c in "iy":
			shape = MouthPose.Shape.NARROW; open = 0.3; dur = 0.08
		elif c == "o":
			shape = MouthPose.Shape.ROUND; open = 0.6; dur = 0.1
		elif c in "uw":
			shape = MouthPose.Shape.ROUND; open = 0.35; dur = 0.08
		elif c in "mbp":
			shape = MouthPose.Shape.PRESSED; open = 0.0; dur = 0.07
		elif c in "fv":
			shape = MouthPose.Shape.NARROW; open = 0.1; dur = 0.07
		elif c in "sz":
			shape = MouthPose.Shape.NARROW; open = 0.14; dur = 0.07
		elif c in "'\"":
			i += 1
			continue
		elif not (c >= "a" and c <= "z"):
			i += 1
			continue
		if shape != last_shape or shape == MouthPose.Shape.REST:
			keys.append({"time": t, "shape": shape, "open": open})
			last_shape = shape
		t += dur / maxf(rate, 0.1)
		i += 1
	keys.append({"time": t + 0.05, "shape": MouthPose.Shape.REST, "open": 0.0})
	return keys


## Builds a track from a Rhubarb Lip Sync TSV/TXT export ("0.00<TAB>X" lines).
## https://github.com/DanielSWolf/rhubarb-lip-sync
static func from_rhubarb(path: String, player: Node, stream: AudioStream) -> VisemeTrackLipSync:
	var keys: Array = []
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_warning("TalkingDoor: can't open lip sync cues %s" % path)
		return VisemeTrackLipSync.new(keys, player, stream)
	# Rhubarb mouth shapes -> ours.
	var map := {
		"A": [MouthPose.Shape.PRESSED, 0.0],    # M B P
		"B": [MouthPose.Shape.NARROW, 0.18],    # K S T EE
		"C": [MouthPose.Shape.SMILE_OPEN, 0.45],# EH AE
		"D": [MouthPose.Shape.WIDE_OPEN, 0.9],  # AA
		"E": [MouthPose.Shape.ROUND, 0.5],      # AO ER
		"F": [MouthPose.Shape.ROUND, 0.3],      # UW OW W
		"G": [MouthPose.Shape.NARROW, 0.1],     # F V
		"H": [MouthPose.Shape.SMALL_OPEN, 0.35],# L
		"X": [MouthPose.Shape.REST, 0.0],       # idle
	}
	while not f.eof_reached():
		var line := f.get_line().strip_edges()
		var parts := line.split("\t") if "\t" in line else line.split(" ", false)
		if parts.size() < 2 or not parts[0].is_valid_float():
			continue
		var m: Array = map.get(parts[1].strip_edges().to_upper(), map["X"])
		keys.append({"time": parts[0].to_float(), "shape": m[0], "open": m[1]})
	return VisemeTrackLipSync.new(keys, player, stream)
