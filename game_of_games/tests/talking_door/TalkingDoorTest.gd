extends Node2D
## Test scene for the talking door.
##
## Keys:  A/D or arrows move Bill · E/Space interact · 1-8 force expressions
##        O open/close · T test line · R reset · G toggle range markers · F1 debug panel
##
## Command line (for automated checks):  godot --path . -- --autotest [--shots=DIR]

@onready var door: TalkingDoor = $TalkingDoor
@onready var bill: Node2D = $Bill

var _status: Label
var _panel: Control
var _log: Array[String] = []
var _test_line := 0
var _autotest := false
var _shots_dir := ""

const EXPRESSIONS := ["idle", "curious", "happy", "annoyed", "suspicious", "sad", "surprised", "asleep"]


func _ready() -> void:
	_build_ui()
	for sig in ["door_noticed_player", "door_lost_player", "player_entered_interaction_range", "player_exited_interaction_range"]:
		door.connect(sig, func(_p): _on_event(null, sig))
	for sig in ["door_opened", "door_closed"]:
		door.connect(sig, func(): _on_event(null, sig))
	door.door_selected.connect(func(_d): _on_event(null, "door_selected"))
	door.dialogue_started.connect(func(_l, s): _on_event(s, "dialogue_started"))
	door.dialogue_finished.connect(func(_l): _on_event(null, "dialogue_finished"))
	door.expression_changed.connect(func(n): _on_event(n, "expression_changed"))
	door.sequence_finished.connect(func(n): _on_event(n, "sequence_finished"))
	for a in OS.get_cmdline_user_args():
		if a == "--autotest":
			_autotest = true
		elif a.begins_with("--shots="):
			_shots_dir = a.trim_prefix("--shots=")
	if _autotest:
		_run_autotest()


func _on_event(arg, sig: String) -> void:
	var msg := "%6.2fs  %s%s" % [Time.get_ticks_msec() / 1000.0, sig, ("  " + str(arg)) if arg != null and not (arg is Object) else ""]
	_log.append(msg)
	if _log.size() > 7:
		_log.pop_front()
	print(msg)


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed and not event.echo):
		return
	var k: int = event.physical_keycode
	if k >= KEY_1 and k <= KEY_8:
		_force_expression(EXPRESSIONS[k - KEY_1])
	match k:
		KEY_O: _toggle_door()
		KEY_T: _play_test_line()
		KEY_R: _reset()
		KEY_G: door.debug_draw_ranges = not door.debug_draw_ranges
		KEY_F1: _panel.visible = not _panel.visible


func _process(_delta: float) -> void:
	if _status:
		var zones := ["FAR", "NEAR", "INTERACTION RANGE"]
		var moods := ["idle", "noticing", "watching", "watching Bill leave", "asleep"]
		_status.text = "Zone: %s   Mood: %s   Expression: %s\nDistance: %d px   Talking: %s   Door open: %s\n\n%s" % [
			zones[door.zone], moods[door.mood], door.face.get_expression(),
			int(absf(bill.global_position.x - door.global_position.x)),
			"yes" if door.face.is_speaking() else "no", "yes" if door.is_open() else "no",
			"\n".join(_log)]


func _force_expression(n: String) -> void:
	door.set_expression(n)
	door._settle_timer = -1.0


func _toggle_door() -> void:
	if door.is_open():
		door.close_door()
	else:
		door.open_door()


func _play_test_line() -> void:
	var lines: Array = []
	var c := door.character
	for group in [c.greeting, c.interact_responses, c.before_opening, c.while_open, c.return_greeting, c.farewell]:
		for l in group:
			if l and l.text.strip_edges() != "" and not "[open_door]" in l.text:
				lines.append(l)
	if lines.is_empty():
		return
	door.say([lines[_test_line % lines.size()]], &"test_line")
	_test_line += 1


func _reset() -> void:
	door.reset_conversation()
	if door.is_open():
		door.close_door()
	door.set_expression(door.character.idle_expression)


# --------------------------------------------------------------------------
# UI
# --------------------------------------------------------------------------

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 10
	add_child(layer)

	var help := Label.new()
	help.text = "A / D  move Bill      E / Space  interact      1-8  expressions      O  open/close door      T  test line      R  reset      G  ranges      F1  debug panel"
	help.add_theme_color_override("font_color", Color(0.8, 0.75, 0.62, 0.75))
	help.add_theme_font_size_override("font_size", 17)
	help.anchor_top = 1.0
	help.anchor_bottom = 1.0
	help.anchor_right = 1.0
	help.offset_top = -34
	help.offset_bottom = -8
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	layer.add_child(help)

	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.03, 0.03, 0.62)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(10)
	panel.add_theme_stylebox_override("panel", sb)
	panel.position = Vector2(16, 16)
	layer.add_child(panel)
	_panel = panel
	var v := VBoxContainer.new()
	panel.add_child(v)
	var title := Label.new()
	title.text = "TALKING DOOR  ·  debug (F1 hides)"
	title.add_theme_color_override("font_color", Color(0.95, 0.82, 0.5))
	title.add_theme_font_size_override("font_size", 15)
	v.add_child(title)

	var grid := GridContainer.new()
	grid.columns = 4
	v.add_child(grid)
	for i in EXPRESSIONS.size():
		var b := Button.new()
		b.text = "%d %s" % [i + 1, EXPRESSIONS[i]]
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 14)
		b.pressed.connect(_force_expression.bind(EXPRESSIONS[i]))
		grid.add_child(b)

	var row := HBoxContainer.new()
	v.add_child(row)
	for spec in [["Interact", door.interact], ["Test line", _play_test_line], ["Open/Close", _toggle_door], ["Reset", _reset],
			["Blink", func(): door.face.blink()], ["Look up/down", func(): door._perform_tag("look_up_down", PackedStringArray())]]:
		var b := Button.new()
		b.text = spec[0]
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", 14)
		b.pressed.connect(spec[1])
		row.add_child(b)

	var ranges := CheckBox.new()
	ranges.text = "Show detection / interaction ranges"
	ranges.focus_mode = Control.FOCUS_NONE
	ranges.add_theme_font_size_override("font_size", 14)
	ranges.toggled.connect(func(on): door.debug_draw_ranges = on)
	v.add_child(ranges)

	_status = Label.new()
	_status.add_theme_font_size_override("font_size", 13)
	_status.add_theme_color_override("font_color", Color(0.78, 0.8, 0.72))
	_status.custom_minimum_size = Vector2(470, 0)
	v.add_child(_status)


# --------------------------------------------------------------------------
# Automated walkthrough (used to verify the prototype headlessly)
# --------------------------------------------------------------------------

func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout


func _walk_to(x: float, timeout := 10.0) -> void:
	bill.auto_target_x = x
	var t := 0.0
	while absf(bill.position.x - x) > 4.0 and t < timeout:
		await get_tree().process_frame
		t += get_process_delta_time()


func _shot(label: String) -> void:
	if _shots_dir == "":
		return
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png("%s/%s.png" % [_shots_dir, label])
	print("  [shot] ", label)


func _check(cond: bool, what: String) -> void:
	print(("  PASS  " if cond else "  FAIL  ") + what)
	if not cond:
		push_error("AUTOTEST FAIL: " + what)


func _run_autotest() -> void:
	print("=== TalkingDoor autotest ===")
	bill.position.x = 120
	await _wait(1.0)
	_check(door.zone == TalkingDoor.Zone.FAR, "starts FAR")
	await _shot("01_idle_far")
	# Approach into NEAR
	await _walk_to(560)
	await _wait(1.2)
	_check(door.zone == TalkingDoor.Zone.NEAR, "NEAR at 400px")
	_check(door.face.get_look_target() == bill, "face tracks Bill once noticed")
	await _shot("02_noticed_near_left")
	# Eyes follow to the other side
	await _walk_to(1300)
	await _wait(0.2)
	await _shot("03_tracking_right")
	await _walk_to(900)
	# Interaction range -> greeting
	await _wait(0.3)
	_check(door.zone == TalkingDoor.Zone.INTERACT, "INTERACT range in front of door")
	var t := 0.0
	var saw_mouth_open := false
	var max_open := 0.0
	var shapes := {}
	while door.runner.is_playing() and t < 25.0:
		await get_tree().process_frame
		t += get_process_delta_time()
		if door.face.is_speaking():
			var o: float = door.face._driver.get_pose().open
			max_open = maxf(max_open, o)
			var sn: String = MouthPose.SHAPE_NAMES[door.face._driver.get_pose().nearest_shape()]
			shapes[sn] = shapes.get(sn, 0) + 1
			if o > 0.25:
				saw_mouth_open = true
		if t > 3.6 and t < 3.7:
			await _shot("04_greeting_talking")
		if t > 5.4 and t < 5.5:
			await _shot("05_greeting_look_up_down")
	_check(saw_mouth_open, "mouth opened during greeting (max open %.2f)" % max_open)
	_check(shapes.size() >= 4, "mouth used several shapes while talking: %s" % str(shapes))
	await _shot("06_after_greeting")
	# Interact repeatedly
	for i in 3:
		door.interact()
		await _wait(0.9)
		await _shot("07_interact_%d" % (i + 1))
		while door.runner.is_playing():
			await get_tree().process_frame
		await _wait(0.4)
	_check(door.face.get_expression() in [&"suspicious", &"annoyed", &"curious"], "irritated expression after interactions")
	# Fourth press opens the door
	door.interact()
	while door.runner.is_playing():
		await get_tree().process_frame
	await _wait(1.5)
	_check(door.is_open(), "door opened after configured interactions")
	await _shot("08_door_open")
	door.close_door()
	await _wait(1.6)
	_check(not door.is_open(), "door closed")
	# Expressions gallery
	for e in EXPRESSIONS:
		_force_expression(e)
		await _wait(0.9)
		await _shot("09_expr_%s" % e)
	_force_expression("idle")
	# Walk away
	await _walk_to(150)
	await _wait(0.4)
	await _shot("10_watching_leave")
	await _wait(4.5)
	_check(door.mood == TalkingDoor.Mood.IDLE, "returns to idle after Bill leaves")
	_check(door.face.get_look_target() == null, "stops tracking after Bill leaves")
	# Text-only lip sync + a second character
	var nervous: DoorCharacterData = load("res://interactables/talking_door/characters/nervous_door.tres")
	door.set_character(nervous)
	await _walk_to(900)
	await _wait(2.0)
	_check(door.runner.is_playing() or door.face.is_speaking(), "second character greets with text-driven lip sync")
	await _shot("11_nervous_door")
	await _wait(5.0)
	print("=== autotest done ===")
	get_tree().quit()
