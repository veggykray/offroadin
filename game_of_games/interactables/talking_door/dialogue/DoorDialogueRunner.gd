class_name DoorDialogueRunner
extends Node
## Plays a list of DialogueLines on a TalkingDoorFace: expression changes,
## pauses, audio + lip sync, and the [tags] inside the text.
##
## Tags are not interpreted here; they are passed out through `action_requested`
## so the owner (TalkingDoor) can decide what "[look_up_down]" or "[open_door]"
## means in its world.

signal line_started(line: DialogueLine, subtitle: String)
signal line_finished(line: DialogueLine)
signal sequence_finished(sequence_name: StringName, completed: bool)
signal action_requested(tag: String, args: PackedStringArray)

var face: TalkingDoorFace
## AudioStreamPlayer / AudioStreamPlayer2D used for voice lines.
var voice_player: Node
## Bus with an AudioEffectSpectrumAnalyzer in slot 0 (for non-WAV audio).
var analyzer_bus: StringName = &""
## Extra mouth sensitivity (per character voice).
var mouth_sensitivity := 1.0

var _token := 0
var _playing := false
var _sequence: StringName = &""
var _stop_after_line := false
var _current_line: DialogueLine


func is_playing() -> bool:
	return _playing


func current_sequence() -> StringName:
	return _sequence if _playing else &""


## Play lines in order. Interrupts anything already playing.
func play(lines: Array, sequence_name: StringName = &"") -> void:
	if _playing:
		stop()
	if lines.is_empty():
		return
	_token += 1
	_playing = true
	_sequence = sequence_name
	_stop_after_line = false
	_run(lines.duplicate(), _token)


## Stop immediately (cuts the audio).
func stop() -> void:
	if not _playing:
		return
	_token += 1
	_playing = false
	if face and face.is_speaking():
		face.stop_speech()
	if _current_line:
		line_finished.emit(_current_line)
		_current_line = null
	sequence_finished.emit(_sequence, false)


## Let the current line finish, then stop the sequence.
func stop_after_current_line() -> void:
	_stop_after_line = true


func _run(lines: Array, token: int) -> void:
	for line in lines:
		if token != _token:
			return
		if _stop_after_line:
			break
		if line == null:
			continue
		await _play_line(line, token)
	if token != _token:
		return
	_playing = false
	sequence_finished.emit(_sequence, not _stop_after_line)


func _play_line(line: DialogueLine, token: int) -> void:
	if line.delay_before > 0.0:
		await get_tree().create_timer(line.delay_before).timeout
		if token != _token:
			return
	if line.expression != &"":
		face.set_expression(line.expression, line.expression_intensity)
	var parsed := line.parse()
	var subtitle: String = parsed.text
	var tags: Array = parsed.tags
	if subtitle.is_empty():
		for t in tags:
			action_requested.emit(t.tag, t.args)
		if line.hold_after > 0.0:
			await get_tree().create_timer(line.hold_after).timeout
	else:
		var driver := _make_driver(line, subtitle)
		var duration := driver.get_duration()
		if duration <= 0.0:
			duration = 2.0
		_current_line = line
		line_started.emit(line, subtitle if line.show_subtitle else "")
		face.start_speech(driver)
		var elapsed := 0.0
		var pending := tags.duplicate()
		while token == _token and face.is_speaking():
			# Fire tags at roughly the moment their words are spoken.
			while not pending.is_empty() and float(pending[0].pos) * duration * 0.92 <= elapsed:
				var t: Dictionary = pending.pop_front()
				action_requested.emit(t.tag, t.args)
			await get_tree().process_frame
			elapsed += get_process_delta_time()
		if token != _token:
			return
		for t in pending:
			action_requested.emit(t.tag, t.args)
		_current_line = null
		line_finished.emit(line)
		if line.hold_after > 0.0:
			await get_tree().create_timer(line.hold_after).timeout
	if token != _token:
		return
	if line.end_expression != &"":
		face.set_expression(line.end_expression)


func _make_driver(line: DialogueLine, subtitle: String) -> LipSyncDriver:
	var driver: LipSyncDriver
	if line.audio and voice_player:
		if line.lip_sync_cues != "":
			driver = VisemeTrackLipSync.from_rhubarb(line.lip_sync_cues, voice_player, line.audio)
		else:
			driver = AmplitudeLipSync.new(voice_player, line.audio, analyzer_bus)
	else:
		driver = VisemeTrackLipSync.from_text(subtitle, line.text_speed)
	driver.sensitivity = mouth_sensitivity
	driver.variation_seed = hash(subtitle)
	return driver
