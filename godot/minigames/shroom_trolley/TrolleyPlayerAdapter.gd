extends Node
## TrolleyPlayerAdapter: the ONLY script that knows anything about the player.
##
## When the real Bill is connected, change THIS file (or just add the optional
## hook functions to Bill's script). The rest of the mini-game never touches
## the player node directly.
##
## ----------------------------------------------------------------------------
## WHAT THE PLAYER NODE MUST PROVIDE
##   * It must be a Node2D (anything with global_position).  That's all.
##
## OPTIONAL HOOKS (add any of these functions to Bill's script and they'll be
## called; if they're missing the adapter falls back to something sensible):
##   set_trolley_mode(active: bool, trolley: Node2D)
##       Called on grab (true) and release (false). Best place to stop Bill's
##       own walking/jumping code, swap to a "pushing" animation set, etc.
##       If Bill does NOT have this, the adapter pauses his _physics_process,
##       _process and input handling instead (and restores them afterwards).
##   update_trolley_pose(info: Dictionary)
##       Called every physics frame while pushing. info keys:
##         velocity (float px/s, +right), speed01 (0..1), facing (-1/1),
##         pushing (bool), braking (bool), skidding (bool), bashing (bool),
##         dumping (bool), lean (float radians), load (int mushrooms)
##   get_scan_id() -> StringName   (return &"bill" so the scanner can scan him)
##
## WHAT THE MINI-GAME TAKES OVER WHILE ACTIVE
##   * Bill's position: glued to the trolley handle every physics frame.
##   * Bill's collision layer/mask: set to 0 (so he doesn't fight the trolley)
##     when `disable_player_collision` is on. Restored on release.
##   * The input actions below (left / right / bash / dump / cancel).
##
## INPUT: the actions are created automatically at runtime if your project
## doesn't define them, with default keys (A/D/arrows, Space, S/Down/E, Esc)
## and gamepad. Define actions with the same names in Project Settings > Input
## Map if you want different keys, or change the names below to your own
## existing actions (e.g. "move_left").
## ----------------------------------------------------------------------------

@export var action_left := &"shroom_trolley_left"
@export var action_right := &"shroom_trolley_right"
@export var action_bash := &"shroom_trolley_bash"
@export var action_dump := &"shroom_trolley_dump"
@export var action_cancel := &"shroom_trolley_cancel"
## Create the actions above with default keys if they don't exist yet.
@export var create_default_actions := true
## Turn the player's collision off while glued to the trolley.
@export var disable_player_collision := true
## Hide the player node (e.g. if the trolley art will include its own Bill).
@export var hide_player := false
## Where Bill's origin is placed while pushing.
##   x = pixels from the trolley handle grip (negative = behind it)
##   y = pixels from the FLOOR (0 = origin on the floor, right for most
##       characters whose origin is at their feet; if Bill's origin is at his
##       centre, use minus half his height, e.g. -60)
@export var player_offset := Vector2(-14, 0)

## For AI / cutscenes / automated tests: when true, input comes from the
## virtual_* fields instead of the keyboard.
var use_virtual_input := false
var virtual_axis := 0.0
var virtual_bash := false
var virtual_dump := false

var player: Node2D
var _saved := {}


func _ready() -> void:
	if create_default_actions:
		_ensure_actions()


func is_attached() -> bool:
	return player != null and is_instance_valid(player)


func attach(p: Node2D, trolley: Node2D) -> void:
	if is_attached():
		detach(trolley)
	player = p
	_saved.clear()
	if p.has_method("set_trolley_mode"):
		p.set_trolley_mode(true, trolley)
	else:
		_saved.physics = p.is_physics_processing()
		_saved.process = p.is_processing()
		_saved.input = p.is_processing_input()
		_saved.unhandled = p.is_processing_unhandled_input()
		p.set_physics_process(false)
		p.set_process(false)
		p.set_process_input(false)
		p.set_process_unhandled_input(false)
	if disable_player_collision and p is CollisionObject2D:
		_saved.layer = p.collision_layer
		_saved.mask = p.collision_mask
		p.collision_layer = 0
		p.collision_mask = 0
	if hide_player:
		_saved.visible = p.visible
		p.visible = false


func detach(trolley: Node2D = null) -> void:
	if not is_attached():
		player = null
		return
	var p := player
	if p.has_method("set_trolley_mode"):
		p.set_trolley_mode(false, trolley)
	else:
		p.set_physics_process(_saved.get("physics", true))
		p.set_process(_saved.get("process", true))
		p.set_process_input(_saved.get("input", true))
		p.set_process_unhandled_input(_saved.get("unhandled", true))
	if _saved.has("layer") and p is CollisionObject2D:
		p.collision_layer = _saved.layer
		p.collision_mask = _saved.mask
	if _saved.has("visible"):
		p.visible = _saved.visible
	player = null


## Called every physics frame by the activity while the player is pushing.
func update_player(trolley: Node2D, info: Dictionary) -> void:
	if not is_attached():
		return
	# x: just behind the handle grip. y: feet on the floor (the handle bobs
	# with the suspension, Bill's feet shouldn't).
	var grip: Vector2 = trolley.get_handle_global_position()
	player.global_position = Vector2(grip.x + player_offset.x, trolley.global_position.y + player_offset.y)
	if player.has_method("update_trolley_pose"):
		player.update_trolley_pose(info)


# --- Input ------------------------------------------------------------------

func get_move_axis() -> float:
	if use_virtual_input:
		return clampf(virtual_axis, -1.0, 1.0)
	return Input.get_axis(action_left, action_right)


func is_bash_just_pressed() -> bool:
	if use_virtual_input:
		var b := virtual_bash
		virtual_bash = false
		return b
	return Input.is_action_just_pressed(action_bash)


func is_dump_just_pressed() -> bool:
	if use_virtual_input:
		var d := virtual_dump
		virtual_dump = false
		return d
	return Input.is_action_just_pressed(action_dump)


func is_cancel_just_pressed() -> bool:
	if use_virtual_input:
		return false
	return InputMap.has_action(action_cancel) and Input.is_action_just_pressed(action_cancel)


func _ensure_actions() -> void:
	_add_action(action_left, [KEY_A, KEY_LEFT], [JOY_BUTTON_DPAD_LEFT], [JOY_AXIS_LEFT_X, -1.0])
	_add_action(action_right, [KEY_D, KEY_RIGHT], [JOY_BUTTON_DPAD_RIGHT], [JOY_AXIS_LEFT_X, 1.0])
	_add_action(action_bash, [KEY_SPACE], [JOY_BUTTON_A], [])
	_add_action(action_dump, [KEY_S, KEY_DOWN, KEY_E], [JOY_BUTTON_X, JOY_BUTTON_DPAD_DOWN], [])
	_add_action(action_cancel, [KEY_ESCAPE], [JOY_BUTTON_BACK], [])


func _add_action(action: StringName, keys: Array, buttons: Array, axis: Array) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action, 0.25)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action, ev)
	for b in buttons:
		var jb := InputEventJoypadButton.new()
		jb.button_index = b
		InputMap.action_add_event(action, jb)
	if axis.size() == 2:
		var jm := InputEventJoypadMotion.new()
		jm.axis = axis[0]
		jm.axis_value = axis[1]
		InputMap.action_add_event(action, jm)
