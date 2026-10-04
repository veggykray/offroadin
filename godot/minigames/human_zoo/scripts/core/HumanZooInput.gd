class_name HumanZooInput
extends RefCounted
## Registers the module's input actions at runtime if the host project hasn't
## defined them, so the module works without touching project settings.
## Define these actions in the real project's Input Map to rebind them.

const ACTIONS := {
	"hz_left": [KEY_A, KEY_LEFT],
	"hz_right": [KEY_D, KEY_RIGHT],
	"hz_up": [KEY_W, KEY_UP],
	"hz_down": [KEY_S, KEY_DOWN],
	"hz_interact": [KEY_E, KEY_SPACE, KEY_ENTER],
	"hz_cancel": [KEY_ESCAPE, KEY_BACKSPACE],
	"hz_board": [KEY_TAB, KEY_Q],
	"hz_nudge": [KEY_H],
}

const PADS := {
	"hz_left": [JOY_BUTTON_DPAD_LEFT],
	"hz_right": [JOY_BUTTON_DPAD_RIGHT],
	"hz_up": [JOY_BUTTON_DPAD_UP],
	"hz_down": [JOY_BUTTON_DPAD_DOWN],
	"hz_interact": [JOY_BUTTON_A],
	"hz_cancel": [JOY_BUTTON_B],
	"hz_board": [JOY_BUTTON_BACK],
	"hz_nudge": [JOY_BUTTON_Y],
}


static func ensure_actions() -> void:
	for action in ACTIONS.keys():
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action, 0.4)
		for key in ACTIONS[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			InputMap.action_add_event(action, ev)
		for b in PADS.get(action, []):
			var jb := InputEventJoypadButton.new()
			jb.button_index = b
			InputMap.action_add_event(action, jb)
	if InputMap.has_action("hz_left") and not _has_axis("hz_left"):
		var l := InputEventJoypadMotion.new()
		l.axis = JOY_AXIS_LEFT_X
		l.axis_value = -1.0
		InputMap.action_add_event("hz_left", l)
		var r := InputEventJoypadMotion.new()
		r.axis = JOY_AXIS_LEFT_X
		r.axis_value = 1.0
		InputMap.action_add_event("hz_right", r)


static func _has_axis(action: String) -> bool:
	for ev in InputMap.action_get_events(action):
		if ev is InputEventJoypadMotion:
			return true
	return false
