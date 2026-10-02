extends SceneTree
## Renders reference screenshots of key moments to user://screens (needs a display, e.g. xvfb-run).
## Run: xvfb-run godot --path dark_void --fixed-fps 60 -s tests/screenshots.gd

var game: DarkVoid
var out_dir := ""


func _initialize() -> void:
	_run.call_deferred()


func wait(seconds: float) -> void:
	for i in int(seconds * 60.0):
		await process_frame


func shot(name: String) -> void:
	await process_frame
	await process_frame
	var img := root.get_texture().get_image()
	img.save_png(out_dir.path_join(name + ".png"))
	print("saved ", name)


func _run() -> void:
	out_dir = OS.get_environment("DV_SHOT_DIR")
	if out_dir == "":
		out_dir = ProjectSettings.globalize_path("user://screens")
	DirAccess.make_dir_recursive_absolute(out_dir)
	root.size = Vector2i(1280, 720)
	game = (load("res://scenes/dark_void.tscn") as PackedScene).instantiate()
	root.add_child(game)
	current_scene = game
	await wait(0.5)
	var bill := game.get_node("Bill") as BillController
	var hand := game.get_node("Bill/Hand/HandLight") as HandLight
	var creature := game.get_node("Creature") as DarkCreature
	var env := game.get_node("VoidEnvironment") as VoidEnvironment
	var cam := game.get_node("Camera") as Camera3D
	var placeholder := game.get_node("Bill/Hand") as PlaceholderHand
	(game.get_node("DebugHUD") as CanvasLayer).visible = false
	bill.drift_strength = 0.0
	placeholder._using_stick = true  # keep scripted aim; ignore the (absent) mouse

	await shot("01_dark_light_off")

	# Near the sphere with light on.
	placeholder.aim_direction = Vector3(1, 0.3, 0).normalized()
	bill.global_position = Vector3(1.4, 0.6, 0)
	Input.action_press(DVInput.ILLUMINATE)
	await wait(1.0)
	await shot("02_light_near_sphere")

	# Near the chair.
	placeholder.aim_direction = Vector3(-1, -0.4, 0).normalized()
	bill.global_position = Vector3(-2.0, -0.6, 0)
	await wait(1.0)
	await shot("03_light_near_chair")
	Input.action_release(DVInput.ILLUMINATE)
	await wait(0.6)

	# Close encounter: dark, staged, then light.
	creature._dormant_left = 0.0
	bill.global_position = Vector3(0, 0, 0)
	placeholder.aim_direction = Vector3.RIGHT
	await wait(1.0)
	(game.get_node("ScareDirector") as ScareDirector).force_trigger("close_encounter")
	await wait(0.2)
	await shot("04_scare_before_light")
	Input.action_press(DVInput.ILLUMINATE)
	await wait(0.5)
	await shot("05_scare_eye_lit")
	Input.action_release(DVInput.ILLUMINATE)
	await wait(0.6)

	# Debug reveal of the whole layout (creature in view).
	env.toggle_debug_reveal()
	cam.set_process(false)
	cam.global_position = creature.global_position + Vector3(0, 0, 40)
	await wait(0.5)
	await shot("06_debug_reveal_creature")
	env.toggle_debug_reveal()
	cam.set_process(true)
	await wait(0.5)

	# Reveal level 3 with the creature nearby.
	for m in game.get_node("Memories").get_children():
		(m as MemoryObject).activate()
	await wait(8.0)
	creature.stage_anchor_at("EyeAnchor", bill.global_position + Vector3(6, 1, -1), 1.0)
	await wait(0.3)
	await shot("07_memory3_ambient")

	# Final: approach in dark, then complete.
	var tp := creature.get_touch_point()
	bill.global_position = Vector3(tp.x - 1.5, tp.y, 0)
	bill.velocity = Vector3.ZERO
	await wait(2.0)
	await shot("08_final_touch_prompt")
	game.complete()
	await wait(3.5)
	await shot("09_completion_reveal")
	quit()
