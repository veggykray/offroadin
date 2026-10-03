class_name TalkingDoorFace
extends Node2D
## The living face: eyes that track, natural blinking, blended expressions,
## lip sync and the small acting choices made while speaking.
##
## This script has no idea what door it is in or what it will say. Drive it
## from code:
##     face.set_expression("suspicious")
##     face.set_look_target(player)
##     face.start_speech(AmplitudeLipSync.new(audio_player, stream, bus))
##     face.brow_raise()   face.glance_away(0.8)   face.blink("slow")
##
## Rig layout (see TalkingDoorFace.tscn): Skin (breathes) > Features (moves with
## the gaze) > LeftEye/RightEye (FaceEye), LeftBrow/RightBrow (FaceBrow), Nose,
## Jaw, Mouth (any MouthRig). Replace the Sprite2D textures to re-skin the face.

signal expression_changed(expression_name: StringName)
signal blinked
signal speech_started
signal speech_finished

## The library of expressions this face can make.
@export var expression_set: FaceExpressionSet
@export var start_expression: StringName = &"idle"

@export_group("Eye Tracking")
## How far the eyes turn towards whoever they're watching (1 = natural).
@export_range(0.0, 2.0) var eye_tracking_strength := 1.0
## Scales how far the pupils can travel inside the eye.
@export_range(0.0, 1.5) var pupil_movement_amount := 1.0
## How quickly the eyes follow a moving target.
@export_range(0.5, 30.0) var eye_tracking_speed := 7.0
## How fast the eyes jump to a new point of interest (a "saccade").
@export_range(5.0, 80.0) var saccade_speed := 32.0
## Imagined distance (px) between the wall and whoever is being watched.
## Smaller = eyes swing harder as the player walks past.
@export var gaze_depth := 360.0
## When nobody is being watched: average glances to new spots per second.
@export_range(0.0, 2.0) var idle_look_frequency := 0.35
## While watching someone: chance per second of briefly looking away.
@export_range(0.0, 1.0) var glance_away_frequency := 0.05
## Pixels the features shift towards where the eyes look (head turning).
@export var head_follow := Vector2(7, 4)

@export_group("Blinking")
@export var blink_interval_min := 1.6
@export var blink_interval_max := 5.5
@export_range(0.0, 1.0) var double_blink_chance := 0.14
@export_range(0.0, 1.0) var slow_blink_chance := 0.08
## Chance of blinking when the eyes make a big jump (people do this a lot).
@export_range(0.0, 1.0) var blink_on_eye_jump_chance := 0.3

@export_group("Expressions")
## Seconds to blend from one expression to another.
@export_range(0.05, 3.0) var expression_transition_time := 0.45

@export_group("Speech")
## How wide the mouth opens for a given loudness.
@export_range(0.1, 3.0) var mouth_sensitivity := 1.0
## Seconds; higher = lazier, smoother mouth.
@export_range(0.0, 0.3) var mouth_smoothing := 0.07
## How much the brows/eyes/head act while talking (0 = mouth only).
@export_range(0.0, 2.0) var speech_gesture_amount := 1.0
## Pixels the jaw/chin drops when the mouth is fully open.
@export var jaw_drop := 12.0

@export_group("Idle")
## Breathing, drift and micro eye movements. 0 = statue.
@export_range(0.0, 2.0) var idle_animation_strength := 1.0

# Personality multipliers, set by TalkingDoor from DoorCharacterData.
var personality_blink := 1.0
var personality_shiftiness := 1.0
var personality_eye_speed := 1.0
var personality_expressiveness := 1.0
var personality_fidget := 0.0

@onready var _skin: Node2D = get_node_or_null("Skin")
@onready var _features: Node2D = get_node_or_null("Skin/Features")
@onready var _left_eye: FaceEye = find_child("LeftEye", true, false) as FaceEye
@onready var _right_eye: FaceEye = find_child("RightEye", true, false) as FaceEye
@onready var _left_brow: FaceBrow = find_child("LeftBrow", true, false) as FaceBrow
@onready var _right_brow: FaceBrow = find_child("RightBrow", true, false) as FaceBrow
@onready var _mouth: MouthRig = find_child("Mouth", true, false) as MouthRig
@onready var _jaw: Node2D = find_child("Jaw", true, false) as Node2D
@onready var _nose: Node2D = find_child("Nose", true, false) as Node2D

var _rng := RandomNumberGenerator.new()
var _clock := 0.0

# expressions
var _expr_name: StringName = &""
var _expr_from := {}
var _expr_to := {}
var _expr_cur := {}
var _expr_t := 1.0
var _expr_dur := 0.4
var _idle_params := {}

# additive "pulses" (brow flashes, squints, nods...)
var _pulses: Array[Dictionary] = []

# gaze
var _track_node: Node2D
var _peek_node: Node2D
var _focus := Vector2.ZERO          # smoothed world point the eyes look at
var _focus_target := Vector2.ZERO
var _focus_ready := false
var _saccading := false
var _idle_point := Vector2.ZERO
var _idle_timer := 0.0
var _glance_point := Vector2.ZERO
var _glance_timer := 0.0
var _glance_node_offset := Vector2.ZERO
var _look_away_hold := false
var _gaze_path: Array = []          # [{"offset": Vector2, "time": float}] relative to _track_node
var _gaze_path_t := 0.0
var _micro := Vector2.ZERO
var _micro_timer := 0.0
var _gaze_l := Vector2.ZERO
var _gaze_r := Vector2.ZERO

# blinking
var _blink_queue: Array[Dictionary] = []
var _blink_t := 0.0
var _blink_amount := 0.0
var _next_blink := 2.0

# speech
var _driver: LipSyncDriver
var _speech_w := 0.0
var _gesture_cooldown := 0.0
var _rest_pose := MouthPose.new()


func _ready() -> void:
	_rng.randomize()
	if expression_set == null:
		expression_set = load("res://interactables/talking_door/face/default_expressions.tres")
	_idle_params = _params_for(&"idle")
	if _idle_params.is_empty():
		_idle_params = FaceExpression.default_params()
	_expr_cur = _idle_params.duplicate()
	_expr_from = _expr_cur.duplicate()
	_expr_to = _expr_cur.duplicate()
	set_expression(start_expression, 1.0, 0.0)
	_schedule_blink()
	_idle_timer = _rng.randf_range(0.5, 2.0)
	_clock = _rng.randf() * 100.0


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

## Change expression. Names come from the expression set ("idle", "curious",
## "happy", "annoyed", "suspicious", "sad", "surprised", "asleep" by default).
## intensity < 1 blends from idle. duration < 0 uses expression_transition_time.
func set_expression(expression_name: StringName, intensity := 1.0, duration := -1.0) -> void:
	var key := StringName(String(expression_name).to_lower())
	var target := _params_for(key)
	if target.is_empty():
		push_warning("TalkingDoorFace: unknown expression '%s'" % expression_name)
		return
	if intensity < 0.999:
		target = FaceExpression.lerp_params(_idle_params, target, clampf(intensity, 0.0, 1.0))
	_expr_from = _expr_cur.duplicate()
	_expr_to = target
	_expr_t = 0.0
	_expr_dur = expression_transition_time if duration < 0.0 else duration
	var changed := key != _expr_name
	_expr_name = key
	if changed:
		# People often blink as their expression shifts.
		if is_inside_tree() and _clock > 0.5 and _rng.randf() < 0.25:
			blink()
		expression_changed.emit(key)


func get_expression() -> StringName:
	return _expr_name


func get_expression_names() -> PackedStringArray:
	return expression_set.get_names() if expression_set else PackedStringArray()


## Watch this node (uses node.get_look_target_position() if it has one).
func set_look_target(node: Node2D) -> void:
	if node != _track_node:
		_track_node = node
		_look_away_hold = false
		_saccading = true


func clear_look_target() -> void:
	_track_node = null
	_gaze_path.clear()
	_idle_timer = _rng.randf_range(0.3, 1.0)


func get_look_target() -> Node2D:
	return _track_node


## Something the idle eyes occasionally sneak a look at (e.g. a far-off player).
func set_peek_target(node: Node2D) -> void:
	_peek_node = node


## A quick, startled lock-on: eyes snap to the node, brows lift, pupils widen.
func notice(node: Node2D) -> void:
	set_look_target(node)
	_saccading = true
	add_pulse(&"brow_height", 6.0, 0.08, 0.35, 0.7)
	add_pulse(&"upper_lid", 0.16, 0.08, 0.3, 0.8)
	add_pulse(&"pupil_size", 0.18, 0.1, 0.8, 1.0)
	if _rng.randf() < 0.5:
		blink()


## Look somewhere else for a moment. dir: -1..1 vector, or ZERO for "anywhere".
func glance_away(duration := 0.8, dir := Vector2.ZERO) -> void:
	if dir == Vector2.ZERO:
		var away := 1.0
		if _track_node:
			away = -signf(_look_point(_track_node).x - global_position.x)
			if away == 0.0:
				away = 1.0 if _rng.randf() < 0.5 else -1.0
		dir = Vector2(away * _rng.randf_range(0.6, 1.0), _rng.randf_range(-0.5, 0.6))
	_glance_point = global_position + Vector2(dir.x * gaze_depth * 1.3, dir.y * gaze_depth * 0.9) * _global_scale()
	_glance_timer = duration
	_saccading = true
	_maybe_blink_on_jump(0.5)


## Look at a point in the world for a moment.
func glance_at(world_point: Vector2, duration := 0.8) -> void:
	_glance_point = world_point
	_glance_timer = duration
	_saccading = true


## Keep looking away until look_back() / set_look_target() is called.
func look_away() -> void:
	glance_away(9999.0)
	_look_away_hold = true


func look_back() -> void:
	_glance_timer = 0.0
	_look_away_hold = false
	_saccading = true


## Run the eyes along a path of offsets relative to the watched node.
## e.g. look the player up and down.
func play_gaze_path(offsets: Array, step_time := 0.4) -> void:
	_gaze_path.clear()
	for o in offsets:
		_gaze_path.append({"offset": o, "time": step_time})
	_gaze_path_t = 0.0
	_saccading = true


func look_up_down(top_offset := Vector2(0, -40), bottom_offset := Vector2(0, 200)) -> void:
	if _track_node == null:
		return
	play_gaze_path([top_offset, bottom_offset * 0.5, bottom_offset, bottom_offset * 0.6, top_offset, Vector2.ZERO], 0.32)
	add_pulse(&"upper_lid", -0.12, 0.25, 1.4, 0.5)
	add_pulse(&"brow_height", -2.0, 0.25, 1.4, 0.5)


## kind: "normal", "slow", "double", "half"
func blink(kind := "normal") -> void:
	match kind:
		"slow":
			_blink_queue.append({"close": 0.22, "hold": 0.16, "open": 0.34, "depth": 1.0})
		"double":
			_blink_queue.append({"close": 0.055, "hold": 0.03, "open": 0.1, "depth": 1.0})
			_blink_queue.append({"close": 0.055, "hold": 0.03, "open": 0.13, "depth": 1.0, "gap": 0.07})
		"half":
			_blink_queue.append({"close": 0.08, "hold": 0.02, "open": 0.12, "depth": 0.55})
		_:
			_blink_queue.append({"close": 0.06, "hold": 0.035, "open": 0.13, "depth": 1.0})
	_schedule_blink()


func brow_raise(amount := 7.0, hold := 0.35) -> void:
	add_pulse(&"brow_height", amount, 0.1, hold, 0.45)


func brow_furrow(amount := 1.0, hold := 0.6) -> void:
	add_pulse(&"brow_angle", -9.0 * amount, 0.12, hold, 0.5)
	add_pulse(&"brow_squeeze", 4.0 * amount, 0.12, hold, 0.5)
	add_pulse(&"brow_height", -3.0 * amount, 0.12, hold, 0.5)


func squint(amount := 0.22, hold := 0.8) -> void:
	add_pulse(&"upper_lid", -amount, 0.15, hold, 0.4)
	add_pulse(&"lower_lid", amount * 1.2, 0.15, hold, 0.4)


func widen(amount := 0.2, hold := 0.5) -> void:
	add_pulse(&"upper_lid", amount, 0.08, hold, 0.5)
	add_pulse(&"brow_height", amount * 25.0, 0.08, hold, 0.5)


func nod(amount := 3.0) -> void:
	add_pulse(&"face_y", amount, 0.12, 0.02, 0.28)
	add_pulse(&"face_y", amount * 0.5, 0.1, 0.0, 0.2, 0.32)


func shake(amount := 3.0) -> void:
	add_pulse(&"face_x", amount, 0.05, 0.5, 0.25, 0.0, 9.0)


func recoil() -> void:
	add_pulse(&"face_y", -4.0, 0.06, 0.15, 0.6)
	add_pulse(&"face_scale", -0.015, 0.06, 0.15, 0.6)
	widen(0.25, 0.4)


## Additive, self-expiring adjustment of one parameter.
## freq > 0 makes it oscillate (for head shakes).
func add_pulse(param: StringName, amount: float, attack := 0.1, hold := 0.2, release := 0.4, delay := 0.0, freq := 0.0) -> void:
	_pulses.append({"param": param, "amount": amount, "attack": maxf(attack, 0.001), "hold": hold,
		"release": maxf(release, 0.001), "t": -delay, "freq": freq})


## Start moving the mouth with a lip-sync driver (it also plays its audio).
func start_speech(driver: LipSyncDriver) -> void:
	if _driver:
		_driver.stop()
	_driver = driver
	_driver.sensitivity *= mouth_sensitivity
	_driver.smoothing = mouth_smoothing
	_driver.start()
	speech_started.emit()


func stop_speech() -> void:
	if _driver:
		_driver.stop()
		_driver = null
		speech_finished.emit()


func is_speaking() -> bool:
	return _driver != null


# --------------------------------------------------------------------------
# Frame update
# --------------------------------------------------------------------------

func _process(delta: float) -> void:
	_clock += delta
	_update_expression(delta)
	var add := _update_pulses(delta)
	var p := _expr_cur
	_update_speech(delta, p)
	_update_gaze(delta, p)
	_update_blink(delta, p)
	_apply(p, add)


func _update_expression(delta: float) -> void:
	if _expr_t < 1.0:
		_expr_t = minf(_expr_t + delta / maxf(_expr_dur, 0.001), 1.0)
		_expr_cur = FaceExpression.lerp_params(_expr_from, _expr_to, smoothstep(0.0, 1.0, _expr_t))


func _update_pulses(delta: float) -> Dictionary:
	var out := {}
	var i := _pulses.size() - 1
	while i >= 0:
		var pl: Dictionary = _pulses[i]
		pl.t += delta
		var t: float = pl.t
		var a: float = pl.attack
		var h: float = pl.hold
		var r: float = pl.release
		if t >= a + h + r:
			_pulses.remove_at(i)
			i -= 1
			continue
		if t >= 0.0:
			var env := 1.0
			if t < a:
				env = smoothstep(0.0, 1.0, t / a)
			elif t > a + h:
				env = 1.0 - smoothstep(0.0, 1.0, (t - a - h) / r)
			var v: float = pl.amount * env
			if pl.freq > 0.0:
				v *= sin(t * TAU * pl.freq)
			out[pl.param] = out.get(pl.param, 0.0) + v
		i -= 1
	return out


func _update_speech(delta: float, p: Dictionary) -> void:
	_gesture_cooldown -= delta
	if _driver:
		_driver.update(delta)
		for ev in _driver.pop_events():
			_on_speech_event(ev, p)
		if _driver.is_finished():
			_driver = null
			speech_finished.emit()
	_speech_w = move_toward(_speech_w, 1.0 if _driver else 0.0, delta * 6.0)


func _on_speech_event(ev: StringName, p: Dictionary) -> void:
	var amt := speech_gesture_amount * personality_expressiveness
	if amt <= 0.0:
		return
	match ev:
		LipSyncDriver.EVENT_PHRASE_START:
			if _rng.randf() < 0.3 * amt:
				blink()
			elif _gesture_cooldown <= 0.0 and _rng.randf() < 0.25 * amt:
				brow_raise(_rng.randf_range(3.0, 5.0), 0.2)
				_gesture_cooldown = 0.8
		LipSyncDriver.EVENT_EMPHASIS:
			if _gesture_cooldown > 0.0 or _rng.randf() > 0.7 * amt:
				return
			var r := _rng.randf()
			var cross: bool = p.brow_angle < -5.0 or p.brow_squeeze > 2.0
			if r < 0.55:
				if cross:
					brow_furrow(0.6, 0.25)  # angry people stress words with a frown
				else:
					brow_raise(_rng.randf_range(5.0, 9.0), _rng.randf_range(0.15, 0.4))
			elif r < 0.8:
				nod(_rng.randf_range(2.0, 3.5))
			else:
				widen(0.12, 0.3)
			_gesture_cooldown = _rng.randf_range(1.0, 2.2) / maxf(amt, 0.2)
		LipSyncDriver.EVENT_PAUSE:
			if _glance_timer > 0.0 or not _gaze_path.is_empty():
				return
			var r := _rng.randf()
			if r < 0.35 * amt * personality_shiftiness:
				# Thinking: look off to the side, come back when speech resumes.
				glance_away(_rng.randf_range(0.45, 0.9), Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-0.6, 0.4)))
			elif r < 0.55 * amt:
				squint(0.1, 0.4)


func _update_gaze(delta: float, p: Dictionary) -> void:
	if not _focus_ready:
		_focus = global_position + Vector2(0, gaze_depth * 0.3)
		_idle_point = _focus
		_focus_target = _focus
		_focus_ready = true
	var shift := personality_shiftiness * float(p.glance_rate)
	var target: Vector2
	var tracking := clampf(float(p.tracking), 0.0, 1.0)
	var have_track := is_instance_valid(_track_node) and _track_node.is_inside_tree()
	if not have_track:
		_track_node = null

	# Idle wandering point (also used when tracking is weak).
	_idle_timer -= delta
	if _idle_timer <= 0.0:
		_pick_idle_point(shift)

	if not _gaze_path.is_empty() and have_track:
		var step: Dictionary = _gaze_path[0]
		target = _look_point(_track_node) + Vector2(step.offset) * _global_scale()
		_gaze_path_t += delta
		if _gaze_path_t >= float(step.time):
			_gaze_path_t = 0.0
			_gaze_path.pop_front()
			_saccading = true
	elif _glance_timer > 0.0:
		_glance_timer -= delta
		target = _glance_point
		if _glance_timer <= 0.0:
			_saccading = true
			_look_away_hold = false
	elif have_track and tracking > 0.01:
		target = _idle_point.lerp(_look_point(_track_node), tracking)
		# Occasionally break eye contact.
		if _rng.randf() < glance_away_frequency * shift * delta:
			glance_away(_rng.randf_range(0.35, 0.9))
	else:
		target = _idle_point

	# Saccade vs smooth pursuit.
	if target.distance_to(_focus_target) > 70.0 * _global_scale().x:
		_saccading = true
	_focus_target = target
	if _focus.distance_to(target) > 160.0 * _global_scale().x:
		_saccading = true  # fell too far behind a moving target: catch up
	var speed := saccade_speed if _saccading else eye_tracking_speed * personality_eye_speed
	_focus = _focus.lerp(target, 1.0 - exp(-speed * delta))
	if _saccading and _focus.distance_to(target) < 6.0:
		_saccading = false

	# Microsaccades: tiny involuntary jitters that make eyes look alive.
	_micro_timer -= delta
	if _micro_timer <= 0.0:
		_micro_timer = _rng.randf_range(0.25, 1.1)
		_micro = Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1)) * 0.035 * idle_animation_strength

	var bias: Vector2 = p.gaze_bias
	_gaze_l = _eye_gaze(_left_eye, bias)
	_gaze_r = _eye_gaze(_right_eye, bias)


func _eye_gaze(eye: Node2D, bias: Vector2) -> Vector2:
	var origin := eye.global_position if eye else global_position
	var s := _global_scale()
	var d := (_focus - origin) / Vector2(maxf(s.x, 0.05), maxf(s.y, 0.05))
	var depth := gaze_depth
	var g := d / sqrt(d.length_squared() + depth * depth) * 1.5 * eye_tracking_strength
	g += bias + _micro
	return g.limit_length(1.0) * pupil_movement_amount


func _pick_idle_point(shift: float) -> void:
	var freq := maxf(idle_look_frequency * maxf(shift, 0.05), 0.02)
	_idle_timer = _rng.randf_range(0.5, 1.6) / freq
	var s := _global_scale()
	var r := _rng.randf()
	var old := _idle_point
	if r < 0.3:
		# Stare straight out of the door. Unsettling, which is the point.
		_idle_point = global_position + Vector2(_rng.randf_range(-20, 20), _rng.randf_range(0, 40)) * s
	elif r < 0.45 and is_instance_valid(_peek_node) and _track_node == null:
		_idle_point = _look_point(_peek_node)
		_idle_timer *= 0.6
	else:
		_idle_point = global_position + Vector2(_rng.randf_range(-1.2, 1.2) * gaze_depth, _rng.randf_range(-0.35, 0.8) * gaze_depth) * s
	if old.distance_to(_idle_point) > 150.0 * s.x:
		_maybe_blink_on_jump(1.0)


func _maybe_blink_on_jump(weight: float) -> void:
	if _rng.randf() < blink_on_eye_jump_chance * weight:
		blink()


func _look_point(node: Node2D) -> Vector2:
	if node.has_method("get_look_target_position"):
		return node.call("get_look_target_position")
	return node.global_position


func _global_scale() -> Vector2:
	var s := global_transform.get_scale()
	return Vector2(absf(s.x), absf(s.y))


func _schedule_blink() -> void:
	_next_blink = _rng.randf_range(blink_interval_min, maxf(blink_interval_max, blink_interval_min))


func _update_blink(delta: float, p: Dictionary) -> void:
	var rate := float(p.blink_rate) * personality_blink
	if rate > 0.01 and _blink_queue.is_empty():
		_next_blink -= delta * rate
		if _next_blink <= 0.0:
			var r := _rng.randf()
			if r < slow_blink_chance:
				blink("slow")
			elif r < slow_blink_chance + double_blink_chance:
				blink("double")
			else:
				blink()
	if _blink_queue.is_empty():
		_blink_amount = move_toward(_blink_amount, 0.0, delta * 8.0)
		return
	var b: Dictionary = _blink_queue[0]
	var gap: float = b.get("gap", 0.0)
	_blink_t += delta
	var t := _blink_t - gap
	var c: float = b.close
	var h: float = b.hold
	var o: float = b.open
	var v := 0.0
	if t < 0.0:
		v = 0.0
	elif t < c:
		var x := t / c
		v = x * x  # accelerate shut
	elif t < c + h:
		v = 1.0
		if t - delta < c:
			blinked.emit()
	elif t < c + h + o:
		var x := (t - c - h) / o
		v = 1.0 - (1.0 - pow(1.0 - x, 2.0))  # decelerate open
	else:
		_blink_queue.pop_front()
		_blink_t = 0.0
	_blink_amount = v * float(b.depth)


func _apply(p: Dictionary, add: Dictionary) -> void:
	var idle := idle_animation_strength
	var breath_rate := 0.23 * float(p.breath_rate)
	var breath := sin(_clock * TAU * breath_rate)
	var breath_amt := float(p.breath_amount) * idle

	# --- whole face ---
	if _skin:
		var sc: float = float(p.face_scale) + add.get(&"face_scale", 0.0) + breath * 0.005 * breath_amt
		_skin.scale = Vector2(sc, sc)
	var gaze_avg := (_gaze_l + _gaze_r) * 0.5
	var tremble := float(p.tremble) + personality_fidget
	var drift := Vector2(sin(_clock * 0.37) + 0.5 * sin(_clock * 0.91 + 1.3), sin(_clock * 0.29 + 2.0) + 0.5 * sin(_clock * 0.77)) * 1.2 * idle
	var shake := Vector2(sin(_clock * 37.0) + sin(_clock * 23.0 + 1.0), sin(_clock * 31.0 + 0.5)) * 0.6 * tremble
	var face_off: Vector2 = p.face_offset + drift + shake + gaze_avg * head_follow
	face_off += Vector2(add.get(&"face_x", 0.0), add.get(&"face_y", 0.0) + breath * 1.1 * breath_amt)
	if _features:
		_features.position = face_off
		_features.rotation = deg_to_rad(float(p.face_tilt) + add.get(&"face_tilt", 0.0) + gaze_avg.x * 1.2 + sin(_clock * 0.21) * 0.4 * idle)
	if _nose:
		# Parallax: the nose sticks out, so it moves further when the head turns.
		_nose.position = _nose_rest() + gaze_avg * head_follow * 0.6

	# --- eyes ---
	var lid: float = p.upper_lid + add.get(&"upper_lid", 0.0)
	var lower: float = p.lower_lid + add.get(&"lower_lid", 0.0)
	# Lids follow the eyes vertically (looking down drops the upper lid).
	lid -= gaze_avg.y * 0.14
	lower -= gaze_avg.y * 0.06
	var blink_close := _blink_amount
	var tilt := float(p.lid_tilt)
	var pupil: float = float(p.pupil_size) + add.get(&"pupil_size", 0.0)
	var asym := float(p.lid_asymmetry)
	var open_l := maxf(lid, 0.0) * (1.0 - blink_close)
	var open_r := maxf(lid - asym, 0.0) * (1.0 - blink_close)
	var low_l := lower + blink_close * 0.2
	var low_r := lower + asym * 0.5 + blink_close * 0.2
	if _left_eye:
		_left_eye.apply(open_l, low_l, tilt, _gaze_l, pupil)
	if _right_eye:
		_right_eye.apply(open_r, low_r, tilt, _gaze_r, pupil)

	# --- brows ---
	var bh: float = p.brow_height + add.get(&"brow_height", 0.0) + breath * 0.4 * breath_amt
	var ba: float = p.brow_angle + add.get(&"brow_angle", 0.0)
	var bs: float = p.brow_squeeze + add.get(&"brow_squeeze", 0.0)
	var basym: float = p.brow_asymmetry + add.get(&"brow_asymmetry", 0.0)
	# Brows dip slightly in a blink and lift a touch when the eyes look up.
	bh += -blink_close * 1.5 - gaze_avg.y * 2.0
	if _left_brow:
		_left_brow.apply(bh + basym * 0.5, ba, bs)
	if _right_brow:
		_right_brow.apply(bh - basym * 0.5, ba, bs)

	# --- mouth ---
	var rest := MouthPose.make(
		float(p.mouth_open) * (1.0 + breath * 0.25 * breath_amt * float(p.mouth_open > 0.05)),
		p.mouth_width, clampf(p.mouth_smile + add.get(&"mouth_smile", 0.0), -1.0, 1.0),
		p.mouth_pucker, p.mouth_teeth, p.mouth_press, p.mouth_asymmetry)
	var final_pose := rest
	if _speech_w > 0.0:
		var sp := _driver.get_pose() if _driver else MouthPose.new()
		var talking := MouthPose.make(
			maxf(rest.open * 0.4, sp.open),
			rest.width * sp.width,
			clampf(rest.smile * 0.75 + sp.smile * 0.5, -1.0, 1.0),
			maxf(sp.pucker, rest.pucker * 0.3),
			maxf(sp.teeth, rest.teeth * 0.6),
			clampf(rest.press * (1.0 - sp.open * 2.0), 0.0, 1.0) + sp.press,
			rest.asym * 0.8)
		final_pose = rest.lerp_to(talking, _speech_w)
	if _mouth:
		_mouth.apply_pose(final_pose)
	if _jaw:
		_jaw.position = Vector2(0, final_pose.open * jaw_drop)


var _nose_rest_pos = null


func _nose_rest() -> Vector2:
	if _nose_rest_pos == null:
		_nose_rest_pos = _nose.position
	return _nose_rest_pos


func _params_for(expression_name: StringName) -> Dictionary:
	if expression_set == null:
		return {}
	var e := expression_set.get_expression(expression_name)
	return e.to_params() if e else {}
