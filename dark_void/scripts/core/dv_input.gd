class_name DVInput
extends RefCounted
## Input actions used by Dark Void. Registered at runtime ONLY if the host project hasn't
## already defined them, so a larger game can remap everything in its own InputMap.

const MOVE_LEFT := &"dv_move_left"
const MOVE_RIGHT := &"dv_move_right"
const MOVE_UP := &"dv_move_up"
const MOVE_DOWN := &"dv_move_down"
const AIM_LEFT := &"dv_aim_left"
const AIM_RIGHT := &"dv_aim_right"
const AIM_UP := &"dv_aim_up"
const AIM_DOWN := &"dv_aim_down"
const ILLUMINATE := &"dv_illuminate"
const INTERACT := &"dv_interact"
const TOGGLE_DEBUG := &"dv_toggle_debug"
const DEBUG_REVEAL := &"dv_debug_reveal"
const DEBUG_SCARE := &"dv_debug_scare"
const DEBUG_MEMORY := &"dv_debug_memory"
const RESTART := &"dv_restart"

static var _done := false


static func ensure_actions() -> void:
	if _done:
		return
	_done = true
	if _create(MOVE_LEFT):
		_keys(MOVE_LEFT, [KEY_A, KEY_LEFT])
		_axis(MOVE_LEFT, JOY_AXIS_LEFT_X, -1.0)
		_button(MOVE_LEFT, JOY_BUTTON_DPAD_LEFT)
	if _create(MOVE_RIGHT):
		_keys(MOVE_RIGHT, [KEY_D, KEY_RIGHT])
		_axis(MOVE_RIGHT, JOY_AXIS_LEFT_X, 1.0)
		_button(MOVE_RIGHT, JOY_BUTTON_DPAD_RIGHT)
	if _create(MOVE_UP):
		_keys(MOVE_UP, [KEY_W, KEY_UP])
		_axis(MOVE_UP, JOY_AXIS_LEFT_Y, -1.0)
		_button(MOVE_UP, JOY_BUTTON_DPAD_UP)
	if _create(MOVE_DOWN):
		_keys(MOVE_DOWN, [KEY_S, KEY_DOWN])
		_axis(MOVE_DOWN, JOY_AXIS_LEFT_Y, 1.0)
		_button(MOVE_DOWN, JOY_BUTTON_DPAD_DOWN)
	if _create(AIM_LEFT):
		_axis(AIM_LEFT, JOY_AXIS_RIGHT_X, -1.0)
	if _create(AIM_RIGHT):
		_axis(AIM_RIGHT, JOY_AXIS_RIGHT_X, 1.0)
	if _create(AIM_UP):
		_axis(AIM_UP, JOY_AXIS_RIGHT_Y, -1.0)
	if _create(AIM_DOWN):
		_axis(AIM_DOWN, JOY_AXIS_RIGHT_Y, 1.0)
	if _create(ILLUMINATE):
		var mb := InputEventMouseButton.new()
		mb.button_index = MOUSE_BUTTON_LEFT
		InputMap.action_add_event(ILLUMINATE, mb)
		_axis(ILLUMINATE, JOY_AXIS_TRIGGER_RIGHT, 1.0)
		_keys(ILLUMINATE, [KEY_SPACE])
	if _create(INTERACT):
		_keys(INTERACT, [KEY_E])
		_button(INTERACT, JOY_BUTTON_A)
	if _create(TOGGLE_DEBUG):
		_keys(TOGGLE_DEBUG, [KEY_F1])
	if _create(DEBUG_REVEAL):
		_keys(DEBUG_REVEAL, [KEY_F2])
	if _create(DEBUG_SCARE):
		_keys(DEBUG_SCARE, [KEY_F3])
	if _create(DEBUG_MEMORY):
		_keys(DEBUG_MEMORY, [KEY_F4])
	if _create(RESTART):
		_keys(RESTART, [KEY_R])
		_button(RESTART, JOY_BUTTON_START)


static func _create(action: StringName) -> bool:
	if InputMap.has_action(action):
		return false
	InputMap.add_action(action, 0.2)
	return true


static func _keys(action: StringName, keys: Array) -> void:
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action, ev)


static func _axis(action: StringName, axis: JoyAxis, dir: float) -> void:
	var ev := InputEventJoypadMotion.new()
	ev.axis = axis
	ev.axis_value = dir
	InputMap.action_add_event(action, ev)


static func _button(action: StringName, button: JoyButton) -> void:
	var ev := InputEventJoypadButton.new()
	ev.button_index = button
	InputMap.action_add_event(action, ev)
