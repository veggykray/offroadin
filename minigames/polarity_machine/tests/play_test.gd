extends SceneTree
## Plays the real PolarityMachine scene through its controls (synthetic mouse
## input on the button, lever and dials), makes deliberate mistakes, recovers,
## solves it, and checks the completion signal fires exactly once.
##
##   godot --path <project> --script res://minigames/polarity_machine/tests/play_test.gd [-- --capture=<dir>]
## Run with a window (e.g. under xvfb-run) so mouse input and screenshots work.

const SCENE := "res://minigames/polarity_machine/PolarityMachine.tscn"
const Rules := preload("res://minigames/polarity_machine/scripts/plant_rules.gd")

var pm
var _fails := 0
var _capture := ""
var _completed: Array[String] = []


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--capture="):
			_capture = a.get_slice("=", 1)
	_run.call_deferred()


func check(c: bool, what: String) -> void:
	if c:
		print("  ok: ", what)
	else:
		_fails += 1
		printerr("  FAIL: ", what, "   [", pm.rules.describe(), "]")


func wait(seconds: float) -> void:
	await create_timer(seconds).timeout


func shot(name: String) -> void:
	if _capture == "":
		return
	await process_frame
	root.get_viewport().get_texture().get_image().save_png(_capture.path_join(name + ".png"))


## Design-space point → window coordinates.
func screen(p: Vector2) -> Vector2:
	return pm.get_node("Stage").get_global_transform_with_canvas() * p


func mouse_move(p: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.position = screen(p)
	e.global_position = e.position
	Input.parse_input_event(e)
	Input.flush_buffered_events()


func mouse_button(p: Vector2, button: MouseButton, pressed: bool) -> void:
	mouse_move(p)
	var e := InputEventMouseButton.new()
	e.position = screen(p)
	e.global_position = e.position
	e.button_index = button
	e.pressed = pressed
	if pressed and button == MOUSE_BUTTON_LEFT:
		e.button_mask = MOUSE_BUTTON_MASK_LEFT
	Input.parse_input_event(e)
	Input.flush_buffered_events()


func click(p: Vector2) -> void:
	mouse_button(p, MOUSE_BUTTON_LEFT, true)
	await process_frame
	mouse_button(p, MOUSE_BUTTON_LEFT, false)
	await process_frame


func wheel(p: Vector2, up: bool) -> void:
	mouse_button(p, MOUSE_BUTTON_WHEEL_UP if up else MOUSE_BUTTON_WHEEL_DOWN, true)
	await process_frame


## Drag a control's handle from a to b in design space.
func drag(a: Vector2, b: Vector2) -> void:
	mouse_button(a, MOUSE_BUTTON_LEFT, true)
	for i in 10:
		var e := InputEventMouseMotion.new()
		e.position = screen(a.lerp(b, float(i + 1) / 10.0))
		e.global_position = e.position
		e.button_mask = MOUSE_BUTTON_MASK_LEFT
		Input.parse_input_event(e)
		Input.flush_buffered_events()
		await process_frame
	mouse_button(b, MOUSE_BUTTON_LEFT, false)
	await process_frame


func water() -> void:
	await click(pm.water_button.position)
	await wait(0.35)


## Point on the temperature gauge for a detent.
func temp_point(v: int) -> Vector2:
	var lever = pm.temperature_control
	var a := deg_to_rad(lever.DETENTS[v])
	return lever.position + Vector2(sin(a), -cos(a)) * (lever.ARM + 8)


func light_point(v: int) -> Vector2:
	var dial = pm.light_control
	var a := deg_to_rad(dial.DETENTS[v])
	return dial.position + Vector2(sin(a), -cos(a)) * (dial.R + 14)


func age_point(v: int) -> Vector2:
	var dial = pm.age_control
	var a := deg_to_rad(dial.STATIONS[v])
	return dial.position + Vector2(sin(a), -cos(a)) * 92.0


func set_temp(v: int) -> void:
	await drag(temp_point(pm.rules.temp), temp_point(v))
	await wait(0.2)


func set_light(v: int) -> void:
	await drag(light_point(pm.rules.light), light_point(v))
	await wait(0.2)


func _run() -> void:
	pm = load(SCENE).instantiate()
	root.add_child(pm)
	pm.puzzle_completed.connect(func(id): _completed.append(id))
	pm.nudge_delay = 0.0
	await wait(1.5)
	var r = pm.rules
	print("== start ==")
	check(r.stage == Rules.Stage.SEEDLING and r.water == Rules.Water.DRY, "starts as a dry seedling")
	await shot("01_start")

	print("== every control responds ==")
	var tank0: int = r.tank
	await water()
	check(r.water == Rules.Water.DAMP and r.tank == tank0 - 1, "blue button: one spray, tank lowered")
	await shot("02_spray")
	await set_light(Rules.Light.MEDIUM)
	check(r.light == Rules.Light.MEDIUM, "light dial dragged to Medium")
	await wheel(pm.light_control.position, true)
	check(r.light == Rules.Light.BRIGHT, "mouse wheel on the light dial")
	await wheel(pm.light_control.position, false)
	await set_temp(Rules.Temp.WARM)
	check(r.temp == Rules.Temp.WARM, "temperature lever dragged to Warm")
	await click(temp_point(Rules.Temp.COOL))
	check(r.temp == Rules.Temp.COOL, "clicking the gauge moves the lever")

	print("== mistake: grow it while the soil is only damp ==")
	await click(age_point(Rules.Stage.YOUNG))
	await wait(1.2)
	check(r.stage == Rules.Stage.YOUNG and r.ailment == "dry", "grown thirsty: young and ailing (dry)")
	await shot("03_grown_thirsty")
	print("== recovery by nursing ==")
	await water()
	await water()  # MOIST
	await wait(Rules.RECOVER_TIME + 0.6)
	check(r.is_healthy(), "nursed back to health in good conditions")
	await shot("04_recovered")

	print("== mistake: overwater ==")
	await water()
	await water()
	check(r.water == Rules.Water.WATERLOGGED, "waterlogged")
	await wait(1.0)
	await shot("05_waterlogged")
	print("== recovery: heat dries the soil ==")
	await set_temp(Rules.Temp.HOT)
	await wait(1.2)
	await shot("06_hot")
	await wait(Rules.HOT_DRY_TIME * 2.0 - 1.0)
	check(r.water <= Rules.Water.MOIST, "heat dried the soil (%s)" % Rules.WATER_NAMES[r.water])
	await set_temp(Rules.Temp.COOL)
	for i in 6:
		if r.water >= Rules.Water.MOIST:
			break
		await water()
	await wait(Rules.RECOVER_TIME + 0.5)
	check(r.is_healthy(), "healthy again after the heat")

	print("== mistake: darkness ==")
	await set_light(Rules.Light.DARK)
	await wait(1.5)
	await shot("07_dark")
	await set_light(Rules.Light.MEDIUM)
	await wait(Rules.RECOVER_TIME + 0.5)
	check(r.is_healthy(), "fine after a short spell of darkness")

	print("== grow on properly ==")
	await click(age_point(Rules.Stage.MATURE))
	await wait(1.0)
	check(r.stage == Rules.Stage.MATURE and r.is_healthy(), "healthy mature plant")
	await water()
	await click(age_point(Rules.Stage.FLOWERING))
	await wait(2.0)
	check(r.stage == Rules.Stage.FLOWERING and r.is_healthy(), "healthy at flowering age")
	check(r.bud > 0.0 and not r.flowered, "cool air alone: a small bud, no flower")
	await shot("08_bud_hint")
	print("== four 'good' settings do not set fruit ==")
	await water()  # back to moist
	await set_light(Rules.Light.BRIGHT)
	await set_temp(Rules.Temp.WARM)
	await wait(5.0)
	check(not r.flowered and r.fruit == 0.0 and not r.is_solved, "bright + warm + moist + flowering age: still no flower")
	await shot("09_lush_no_flower")
	print("== a cool night ==")
	await set_light(Rules.Light.LOW)
	await set_temp(Rules.Temp.COOL)
	await wait(Rules.BUD_TIME + 1.5)
	check(r.flowered, "the flower opened at night")
	await shot("10_night_flower")
	print("== near miss ==")
	await set_light(Rules.Light.BRIGHT)
	await wait(3.0)
	check(r.fruit == 0.0, "bright but cool: no fruit yet")
	await shot("11_near_miss")
	print("== the day returns ==")
	for i in 6:
		if r.water == Rules.Water.MOIST:
			break
		if r.water > Rules.Water.MOIST:
			await wait(1.0)
		else:
			await water()
	await set_temp(Rules.Temp.WARM)
	await wait(Rules.FRUIT_TIME * 0.5)
	await shot("12_fruit_swelling")
	await wait(Rules.FRUIT_TIME * 0.6 + 1.0)
	check(r.is_solved, "fruit set: solved")
	check(_completed == ["polarity_fruit_key"], "puzzle_completed(\"polarity_fruit_key\") emitted once: %s" % str(_completed))
	await wait(2.0)
	await shot("13_solved")

	print("== locked after success ==")
	var state: String = r.describe()
	await water()
	await click(age_point(Rules.Stage.OLD))
	await set_temp(Rules.Temp.COLD)
	await wheel(pm.light_control.position, false)
	await wait(1.0)
	check(r.describe() == state, "further input ignored")
	check(_completed.size() == 1, "still emitted only once")

	print("== reset ==")
	pm.reset_puzzle()
	await wait(0.5)
	check(not r.is_solved and r.stage == Rules.Stage.SEEDLING, "reset_puzzle() restores the start")
	await water()
	check(r.water == Rules.Water.DAMP, "controls work again after reset")
	pm.queue_free()
	await wait(0.3)
	print("== %s ==" % ("PASSED" if _fails == 0 else "%d FAILURES" % _fails))
	quit(1 if _fails > 0 else 0)
