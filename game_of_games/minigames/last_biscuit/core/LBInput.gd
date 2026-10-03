class_name LBInput
extends RefCounted
## Registers the mini-game's input actions with sensible defaults if the host
## project hasn't defined them. Rebind them in Project Settings > Input Map.

const DEFAULTS := {
	"lb_up": [KEY_W, KEY_UP],
	"lb_down": [KEY_S, KEY_DOWN],
	"lb_left": [KEY_A, KEY_LEFT],
	"lb_right": [KEY_D, KEY_RIGHT],
	"lb_grab": [KEY_SPACE, "mouse_left"],
	"lb_retract": [KEY_E, "mouse_right"],
	"lb_creep": [KEY_SHIFT, KEY_CTRL],
	"lb_debug": [KEY_F1, KEY_QUOTELEFT],
	"lb_restart": [KEY_F5],
}


static func ensure_actions() -> void:
	for action in DEFAULTS:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action, 0.2)
		for k in DEFAULTS[action]:
			if k is String:
				var mb := InputEventMouseButton.new()
				mb.button_index = MOUSE_BUTTON_LEFT if k == "mouse_left" else MOUSE_BUTTON_RIGHT
				InputMap.action_add_event(action, mb)
			else:
				var ev := InputEventKey.new()
				ev.physical_keycode = k
				InputMap.action_add_event(action, ev)
