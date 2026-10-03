class_name TalkingDoor
extends Node2D
## A door with a living face in it.
##
## Drop TalkingDoor.tscn into any 2D scene, put the player in the "player" group
## (or set Player Path), give it a DoorCharacterData in "Character", done.
##
## The door decides WHEN things happen (proximity, interaction, opening);
## the DoorCharacterData decides WHAT it says and how it feels about it;
## TalkingDoorFace makes it look alive.

signal door_noticed_player(player: Node2D)
signal door_lost_player(player: Node2D)
signal player_entered_interaction_range(player: Node2D)
signal player_exited_interaction_range(player: Node2D)
## Interact was pressed on this door.
signal door_selected(door: TalkingDoor)
signal dialogue_started(line: DialogueLine, subtitle: String)
signal dialogue_finished(line: DialogueLine)
signal sequence_finished(sequence_name: StringName)
signal expression_changed(expression_name: StringName)
signal door_opened
signal door_closed

enum Zone { FAR, NEAR, INTERACT }
enum Mood { IDLE, NOTICING, WATCHING, WATCHING_LEAVE, ASLEEP }

## Personality, habits and dialogue. Swap this to make a different door.
@export var character: DoorCharacterData

@export_group("Player Detection")
## Optional. If empty, the first node in `player_group` is used.
@export var player_path: NodePath
@export var player_group: StringName = &"player"
## Beyond this the door mostly ignores the player (FAR).
@export var detection_distance := 560.0
## Within this the door talks and the player can interact (INTERACTION RANGE).
@export var interaction_distance := 170.0
## Only measure left/right distance (good for side-on scenes).
@export var horizontal_distance_only := true
## Extra distance needed to leave a range (stops flickering at the edge).
@export var range_hysteresis := 25.0
## Start the greeting automatically when the player comes into interaction range.
@export var auto_greet := true
@export var interact_action: StringName = &"interact"
@export var show_interact_prompt := true
@export var interact_prompt_text := "E  Talk"
## Used when the player has no get_look_target_position() method.
@export var player_look_offset := Vector2(0, -250)

@export_group("Face Tuning")
## How far the eyes turn towards the player (1 = natural).
@export_range(0.0, 2.0) var eye_tracking_strength := 1.0
## How quickly the eyes follow the player.
@export_range(0.5, 30.0) var eye_tracking_speed := 7.0
## How far the pupils can move inside the eyes.
@export_range(0.0, 1.5) var pupil_movement_amount := 1.0
## Idle glances to new spots per second.
@export_range(0.0, 2.0) var idle_look_frequency := 0.35
@export var blink_interval_min := 1.6
@export var blink_interval_max := 5.5
## Seconds to blend between expressions.
@export_range(0.05, 3.0) var expression_transition_time := 0.45
## Mouth opening per loudness.
@export_range(0.1, 3.0) var speech_mouth_sensitivity := 1.0
## Mouth laziness (seconds).
@export_range(0.0, 0.3) var speech_mouth_smoothing := 0.07
## Brows/eyes/head acting while talking.
@export_range(0.0, 2.0) var speech_gesture_amount := 1.0
## Breathing / drift / micro-movements.
@export_range(0.0, 2.0) var idle_animation_strength := 1.0

@export_group("Door")
## Small sign above the door ("" hides it).
@export var plaque_text := ""
@export var open_duration := 1.3
## How narrow the door looks when fully open (fake perspective).
@export_range(0.05, 1.0) var open_amount := 0.16
@export var show_subtitles := true
@export var subtitle_color := Color(0.93, 0.88, 0.78)

@export_group("Debug")
@export var debug_draw_ranges := false:
	set(v):
		debug_draw_ranges = v
		queue_redraw()

@onready var face: TalkingDoorFace = $Panel/Face
@onready var _panel: Node2D = $Panel
@onready var _panel_edge: Polygon2D = $PanelEdge
@onready var _voice: AudioStreamPlayer2D = $VoicePlayer
@onready var _subtitle: Label = $Subtitle
@onready var _prompt: Label = $Prompt
@onready var _plaque: Label = $Plaque

var runner: DoorDialogueRunner
var zone: Zone = Zone.FAR
var mood: Mood = Mood.IDLE

var _player: Node2D
var _bus_name: StringName
var _mood_timer := 0.0
var _settle_timer := -1.0
var _alone_time := 0.0
var _greeted := false
var _visit := 0
var _visit_greeted := false
var _visit_talked := false
var _interactions := 0
var _open_presses := 0
var _open := false
var _open_t := 0.0
var _open_tween: Tween
var _subtitle_alpha := 0.0
var _prompt_alpha := 0.0
var _rng := RandomNumberGenerator.new()

static var _focused_door: TalkingDoor


func _ready() -> void:
	add_to_group(&"talking_doors")
	_rng.randomize()
	if character == null:
		character = DoorCharacterData.new()
	_ensure_input_action()
	_setup_audio_bus()
	runner = DoorDialogueRunner.new()
	runner.name = "DialogueRunner"
	add_child(runner)
	runner.face = face
	runner.voice_player = _voice
	runner.analyzer_bus = _bus_name
	runner.mouth_sensitivity = character.mouth_sensitivity
	runner.line_started.connect(_on_line_started)
	runner.line_finished.connect(_on_line_finished)
	runner.sequence_finished.connect(_on_sequence_finished)
	runner.action_requested.connect(_perform_tag)
	face.expression_changed.connect(func(n): expression_changed.emit(n))
	apply_tuning()
	_apply_character()
	_plaque.text = plaque_text
	_plaque.visible = plaque_text != ""
	var plaque_back := get_node_or_null("PlaqueBack") as CanvasItem
	if plaque_back:
		plaque_back.visible = _plaque.visible
	_prompt.text = interact_prompt_text
	_subtitle.modulate.a = 0.0
	_prompt.modulate.a = 0.0
	_apply_open(0.0)


func _exit_tree() -> void:
	var idx := AudioServer.get_bus_index(_bus_name)
	if idx > 0:
		AudioServer.remove_bus(idx)
	if _focused_door == self:
		_focused_door = null


## Push the Face Tuning values to the face (call again after changing them at runtime).
func apply_tuning() -> void:
	face.eye_tracking_strength = eye_tracking_strength
	face.eye_tracking_speed = eye_tracking_speed
	face.pupil_movement_amount = pupil_movement_amount
	face.idle_look_frequency = idle_look_frequency
	face.blink_interval_min = blink_interval_min
	face.blink_interval_max = blink_interval_max
	face.expression_transition_time = expression_transition_time
	face.mouth_sensitivity = speech_mouth_sensitivity
	face.mouth_smoothing = speech_mouth_smoothing
	face.speech_gesture_amount = speech_gesture_amount
	face.idle_animation_strength = idle_animation_strength


func _apply_character() -> void:
	var c := character
	face.personality_blink = c.blink_rate
	face.personality_shiftiness = c.shiftiness
	face.personality_eye_speed = c.eye_speed
	face.personality_expressiveness = c.expressiveness
	face.personality_fidget = c.fidget
	if c.expression_set_override:
		face.expression_set = c.expression_set_override
	_voice.volume_db = c.voice_volume_db
	_voice.pitch_scale = c.voice_pitch
	face.set_expression(c.idle_expression, 1.0, 0.0)


## Swap personality at runtime.
func set_character(data: DoorCharacterData) -> void:
	runner.stop()
	character = data
	runner.mouth_sensitivity = data.mouth_sensitivity
	_apply_character()
	reset_conversation()


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

## Same as the player pressing Interact while in range.
func interact() -> void:
	door_selected.emit(self)
	_settle_timer = -1.0
	if runner.is_playing():
		return  # it's busy talking; it doesn't take interruptions well
	if not _greeted and not character.greeting.is_empty():
		_greeted = true
		_visit_greeted = true
		_say(character.greeting, &"greeting")
		return
	if _open:
		if not character.while_open.is_empty():
			var line: DialogueLine = character.while_open[_open_presses % character.while_open.size()]
			_open_presses += 1
			_say([line], &"while_open")
		return
	_interactions += 1
	if character.open_after_interactions > 0 and _interactions >= character.open_after_interactions:
		if character.before_opening.is_empty():
			open_door()
		else:
			_say(character.before_opening, &"before_opening")
		return
	if character.interact_responses.is_empty():
		face.brow_raise()
		return
	var idx := mini(_interactions - 1, character.interact_responses.size() - 1)
	_say([character.interact_responses[idx]], &"interact_%d" % _interactions)


## Make the door say any lines right now.
func say(lines: Array, sequence_name: StringName = &"custom") -> void:
	_say(lines, sequence_name)


func set_expression(expression_name: StringName, intensity := 1.0) -> void:
	face.set_expression(expression_name, intensity)


func is_open() -> bool:
	return _open


func open_door() -> void:
	if _open:
		return
	_open = true
	face.recoil()
	_tween_open(1.0)
	_open_tween.finished.connect(func(): door_opened.emit(), CONNECT_ONE_SHOT)


func close_door() -> void:
	if not _open:
		return
	_open = false
	_tween_open(0.0)
	_open_tween.finished.connect(func(): door_closed.emit(), CONNECT_ONE_SHOT)


## Forget everything said (greeting will play again).
func reset_conversation() -> void:
	runner.stop()
	_greeted = false
	_visit_greeted = false
	_visit_talked = false
	_interactions = 0
	_open_presses = 0


func get_player() -> Node2D:
	return _player


# --------------------------------------------------------------------------
# Behaviour
# --------------------------------------------------------------------------

func _process(delta: float) -> void:
	_find_player()
	_update_zone()
	_update_mood(delta)
	_update_focus()
	_update_labels(delta)
	if _panel_edge.visible:
		_update_edge()


func _unhandled_input(event: InputEvent) -> void:
	if zone != Zone.INTERACT or _focused_door != self:
		return
	if event.is_action_pressed(interact_action) and not event.is_echo():
		get_viewport().set_input_as_handled()
		interact()


func _find_player() -> void:
	if is_instance_valid(_player) and _player.is_inside_tree():
		return
	_player = null
	if not player_path.is_empty():
		_player = get_node_or_null(player_path) as Node2D
	if _player == null and player_group != &"":
		_player = get_tree().get_first_node_in_group(player_group) as Node2D


func _player_distance() -> float:
	if _player == null:
		return INF
	var d := _player.global_position - global_position
	return absf(d.x) if horizontal_distance_only else d.length()


func _update_zone() -> void:
	var d := _player_distance()
	var new_zone := zone
	match zone:
		Zone.FAR:
			if d < detection_distance:
				new_zone = Zone.INTERACT if d < interaction_distance else Zone.NEAR
		Zone.NEAR:
			if d < interaction_distance:
				new_zone = Zone.INTERACT
			elif d > detection_distance + range_hysteresis:
				new_zone = Zone.FAR
		Zone.INTERACT:
			if d > detection_distance + range_hysteresis:
				new_zone = Zone.FAR
			elif d > interaction_distance + range_hysteresis:
				new_zone = Zone.NEAR
	if new_zone == zone:
		return
	var old := zone
	zone = new_zone
	if old == Zone.INTERACT:
		_on_exit_interaction()
	if old == Zone.FAR:
		_on_enter_near()
	if zone == Zone.INTERACT:
		_on_enter_interaction()
	if zone == Zone.FAR:
		_on_exit_near()


func _on_enter_near() -> void:
	face.set_peek_target(null)
	_alone_time = 0.0
	if mood == Mood.WATCHING_LEAVE:
		mood = Mood.WATCHING  # came back before it lost interest
		return
	_visit += 1
	_visit_greeted = false
	_visit_talked = false
	if mood == Mood.ASLEEP:
		# Startled awake.
		face.set_expression(&"surprised", 1.0, 0.12)
		face.notice(_player)
		door_noticed_player.emit(_player)
		mood = Mood.WATCHING
		_settle_timer = 1.2
		return
	mood = Mood.NOTICING
	_mood_timer = character.notice_delay


func _on_exit_near() -> void:
	if runner.is_playing():
		runner.stop_after_current_line()
	elif _visit_talked and not character.farewell.is_empty():
		_say(character.farewell, &"farewell")
	if mood == Mood.NOTICING:
		mood = Mood.IDLE  # never really noticed
		return
	mood = Mood.WATCHING_LEAVE
	_mood_timer = character.watch_leave_time


func _on_enter_interaction() -> void:
	player_entered_interaction_range.emit(_player)
	if mood == Mood.NOTICING:
		_do_notice()
	if not auto_greet or runner.is_playing():
		return
	if not _greeted and not character.greeting.is_empty():
		_greeted = true
		_visit_greeted = true
		_say(character.greeting, &"greeting")
	elif _visit > 1 and not _visit_greeted and not character.return_greeting.is_empty():
		_visit_greeted = true
		_say(character.return_greeting, &"return_greeting")


func _on_exit_interaction() -> void:
	player_exited_interaction_range.emit(_player)


func _do_notice() -> void:
	mood = Mood.WATCHING
	face.notice(_player)
	door_noticed_player.emit(_player)
	if not runner.is_playing():
		face.set_expression(character.noticed_expression, 0.55)


func _update_mood(delta: float) -> void:
	match mood:
		Mood.NOTICING:
			_mood_timer -= delta
			if _mood_timer <= 0.0:
				_do_notice()
		Mood.WATCHING_LEAVE:
			if runner.is_playing():
				_mood_timer = maxf(_mood_timer, 0.8)
			_mood_timer -= delta
			if _mood_timer <= 0.0:
				_lose_player()
		Mood.IDLE:
			_alone_time += delta
			if character.falls_asleep and _alone_time > character.fall_asleep_after and not runner.is_playing():
				mood = Mood.ASLEEP
				face.set_expression(&"asleep", 1.0, 2.5)
	if _settle_timer > 0.0 and not runner.is_playing():
		_settle_timer -= delta
		if _settle_timer <= 0.0:
			_settle_expression()


func _lose_player() -> void:
	mood = Mood.IDLE
	_alone_time = 0.0
	face.clear_look_target()
	face.set_peek_target(_player)
	face.add_pulse(&"upper_lid", -0.12, 0.6, 0.5, 1.0)  # a little sigh
	face.set_expression(character.left_alone_expression, 1.0, 1.6)
	door_lost_player.emit(_player)


## After a line has had time to land, relax into the mood that suits where the player is.
func _settle_expression() -> void:
	match zone:
		Zone.INTERACT:
			face.set_expression(character.engaged_expression, 0.8, 1.2)
		Zone.NEAR:
			face.set_expression(character.noticed_expression, 0.55, 1.2)
		_:
			if mood != Mood.ASLEEP:
				face.set_expression(character.left_alone_expression, 1.0, 1.4)


func _update_focus() -> void:
	# Only the nearest door in range reacts to Interact.
	if zone == Zone.INTERACT:
		if _focused_door == null or not is_instance_valid(_focused_door) or _focused_door.zone != Zone.INTERACT \
				or _focused_door._player_distance() > _player_distance():
			_focused_door = self
	elif _focused_door == self:
		_focused_door = null


func _say(lines: Array, sequence_name: StringName) -> void:
	_settle_timer = -1.0
	_visit_talked = true
	if is_instance_valid(_player) and face.get_look_target() == null and zone != Zone.FAR:
		face.set_look_target(_player)
	runner.play(lines, sequence_name)


func _on_line_started(line: DialogueLine, subtitle: String) -> void:
	if show_subtitles and subtitle != "":
		_subtitle.text = subtitle
		_subtitle_alpha = 1.0
	dialogue_started.emit(line, subtitle)


func _on_line_finished(line: DialogueLine) -> void:
	_subtitle_alpha = 0.0
	dialogue_finished.emit(line)


func _on_sequence_finished(sequence_name: StringName, _completed: bool) -> void:
	_subtitle_alpha = 0.0
	if sequence_name == &"before_opening" and not _open:
		open_door()
	_settle_timer = 3.0
	sequence_finished.emit(sequence_name)


## Handles [tags] from dialogue text.
func _perform_tag(tag: String, args: PackedStringArray) -> void:
	var look_target := _player if is_instance_valid(_player) and zone != Zone.FAR else null
	match tag:
		"expr", "expression":
			if args.size() > 0:
				face.set_expression(StringName(args[0]), args[1].to_float() if args.size() > 1 else 1.0)
		"brow_raise": face.brow_raise()
		"brow_furrow", "frown": face.brow_furrow()
		"squint": face.squint()
		"widen": face.widen()
		"blink": face.blink()
		"slow_blink": face.blink("slow")
		"double_blink": face.blink("double")
		"nod": face.nod()
		"shake": face.shake()
		"recoil": face.recoil()
		"glance_away": face.glance_away(args[0].to_float() if args.size() > 0 else 0.8)
		"glance":
			var dirs := {"left": Vector2(-1, 0.1), "right": Vector2(1, 0.1), "up": Vector2(0.2, -1), "down": Vector2(0.1, 1)}
			face.glance_away(0.8, dirs.get(args[0] if args.size() > 0 else "", Vector2.ZERO))
		"look_away": face.look_away()
		"look_at_player":
			face.look_back()
			if look_target:
				face.set_look_target(look_target)
		"look_up_down":
			if look_target:
				face.set_look_target(look_target)
				var feet := look_target.global_position - face._look_point(look_target)
				face.look_up_down(Vector2(0, -30), feet)
		"open_door": open_door()
		"close_door": close_door()
		_:
			push_warning("TalkingDoor: unknown dialogue tag [%s]" % tag)


# --------------------------------------------------------------------------
# Door opening
# --------------------------------------------------------------------------

func _tween_open(to: float) -> void:
	if _open_tween:
		_open_tween.kill()
	_open_tween = create_tween()
	_open_tween.tween_method(_apply_open, _open_t, to, open_duration).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _apply_open(t: float) -> void:
	_open_t = t
	_panel.scale.x = lerpf(1.0, open_amount, t)
	var shade := lerpf(1.0, 0.55, t)
	_panel.modulate = Color(shade, shade, shade)
	_panel_edge.visible = t > 0.001
	_update_edge()


func _update_edge() -> void:
	# Fake door thickness visible on the swinging edge.
	var art := _panel.get_node_or_null("PanelArt") as Sprite2D
	var size := art.texture.get_size() if art and art.texture else Vector2(480, 660)
	var x := _panel.position.x + size.x * _panel.scale.x
	var w := 16.0 * _open_t
	_panel_edge.polygon = PackedVector2Array([
		Vector2(x, -size.y), Vector2(x + w, -size.y + 10), Vector2(x + w, -6), Vector2(x, 0)])


# --------------------------------------------------------------------------
# Labels / debug
# --------------------------------------------------------------------------

func _update_labels(delta: float) -> void:
	_subtitle.modulate.a = move_toward(_subtitle.modulate.a, _subtitle_alpha, delta * (6.0 if _subtitle_alpha > 0.0 else 2.0))
	var want_prompt := show_interact_prompt and zone == Zone.INTERACT and _focused_door == self and not runner.is_playing()
	_prompt_alpha = move_toward(_prompt_alpha, 1.0 if want_prompt else 0.0, delta * 4.0)
	_prompt.modulate.a = _prompt_alpha


func _draw() -> void:
	if not debug_draw_ranges:
		return
	for r in [[detection_distance, Color(0.9, 0.8, 0.3, 0.5)], [interaction_distance, Color(0.3, 0.9, 0.5, 0.7)]]:
		var dist: float = r[0]
		var col: Color = r[1]
		draw_line(Vector2(-dist, 6), Vector2(dist, 6), col, 2.0)
		draw_line(Vector2(-dist, -20), Vector2(-dist, 30), col, 2.0)
		draw_line(Vector2(dist, -20), Vector2(dist, 30), col, 2.0)


func _ensure_input_action() -> void:
	if InputMap.has_action(interact_action):
		return
	InputMap.add_action(interact_action)
	for key in [KEY_E, KEY_SPACE]:
		var ev := InputEventKey.new()
		ev.physical_keycode = key
		InputMap.action_add_event(interact_action, ev)


func _setup_audio_bus() -> void:
	# Each door gets its own bus with a spectrum analyser so OGG/MP3 voice lines
	# can still drive the mouth.
	_bus_name = StringName("TalkingDoorVoice_%d" % get_instance_id())
	var idx := AudioServer.bus_count
	AudioServer.add_bus(idx)
	AudioServer.set_bus_name(idx, _bus_name)
	AudioServer.set_bus_send(idx, &"Master")
	var analyzer := AudioEffectSpectrumAnalyzer.new()
	analyzer.buffer_length = 0.1
	AudioServer.add_bus_effect(idx, analyzer, 0)
	_voice.bus = _bus_name
