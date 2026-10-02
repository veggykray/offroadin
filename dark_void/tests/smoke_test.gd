extends SceneTree
## Headless end-to-end check of the Dark Void loop.
## Run: godot --headless --fixed-fps 60 --path dark_void -s tests/smoke_test.gd

var game: DarkVoid
var failures := 0
var completed_reward := ""


func _initialize() -> void:
	_run.call_deferred()


func check(cond: bool, msg: String) -> void:
	if cond:
		print("  ok   ", msg)
	else:
		failures += 1
		print("  FAIL ", msg)


func wait(seconds: float) -> void:
	var frames := int(seconds * 60.0)
	for i in frames:
		await process_frame


func _run() -> void:
	var scene: PackedScene = load("res://scenes/dark_void.tscn")
	game = scene.instantiate()
	root.add_child(game)
	current_scene = game
	game.dark_void_completed.connect(func(id: String) -> void: completed_reward = id)
	await wait(0.5)

	var bill := game.get_node("Bill") as BillController
	var hand := game.get_node("Bill/Hand/HandLight") as HandLight
	var creature := game.get_node("Creature") as DarkCreature
	var env := game.get_node("VoidEnvironment") as VoidEnvironment
	var mems: Array[MemoryObject] = []
	for n in game.get_node("Memories").get_children():
		mems.append(n as MemoryObject)

	print("[setup]")
	check(game.memories_total == 3, "three memories found")
	check(creature.get_state_name() == "DORMANT", "creature starts dormant")
	var d0 := bill.global_position.distance_to(creature.global_position)
	check(d0 > 20.0, "creature starts far away (%.1f m)" % d0)
	check(env.environment.ambient_light_energy == 0.0, "zero ambient light")
	check(not hand.is_emitting(), "light off until held")
	check(creature.get_detector().get_samples().size() > 30, "creature has %d illumination samples" % creature.get_detector().get_samples().size())

	print("[movement]")
	Input.action_press(DVInput.MOVE_RIGHT)
	await wait(1.5)
	Input.action_release(DVInput.MOVE_RIGHT)
	var vx := bill.velocity.x
	check(vx > 0.5 and vx <= bill.max_speed + 0.01, "floats right with capped speed (%.2f)" % vx)
	await wait(1.5)
	check(bill.velocity.x < vx and bill.velocity.x > 0.0, "inertia then damping (%.2f)" % bill.velocity.x)
	check(is_equal_approx(bill.global_position.z, 0.0), "depth locked")

	print("[light + energy]")
	Input.action_press(DVInput.ILLUMINATE)
	await wait(1.0)
	check(hand.is_emitting(), "hold to illuminate")
	var e1 := hand.energy.get_ratio()
	check(e1 < 1.0, "energy drains while lit (%.2f)" % e1)
	Input.action_release(DVInput.ILLUMINATE)
	await wait(0.6)
	check(not hand.is_emitting(), "release = darkness")
	await wait(1.5)
	check(hand.energy.get_ratio() > e1, "energy recharges in the dark")
	hand.energy.energy = 0.0
	hand.energy.exhausted = true
	Input.action_press(DVInput.ILLUMINATE)
	await wait(0.3)
	check(not hand.is_emitting(), "no light when exhausted")
	Input.action_release(DVInput.ILLUMINATE)
	hand.energy.refill()

	print("[illumination: creature]")
	# Stage the eye right in front of the hand while dark (the close-encounter path).
	creature._dormant_left = 0.0
	await wait(0.1)
	var director := game.get_node("ScareDirector") as ScareDirector
	check(director.force_trigger("close_encounter"), "close-encounter scare stages the creature")
	var eye := creature.get_anchor("EyeAnchor")
	var eye_d := eye.global_position.distance_to(hand.global_position)
	check(eye_d < hand.light_range, "eye is within the light radius (%.2f m)" % eye_d)
	await wait(2.0)
	check(creature.get_state_name() == "STALKING", "staged creature holds still in the dark")
	check(eye.global_position.distance_to(hand.global_position) < hand.light_range + 0.5, "it did not relocate while held")
	Input.action_press(DVInput.ILLUMINATE)
	await wait(0.5)
	check(creature.is_illuminated(), "lighting it is detected")
	check(creature.get_state_name() == "FROZEN", "lit creature freezes")
	var pos_frozen := creature.global_position
	await wait(1.0)
	check(creature.global_position.is_equal_approx(pos_frozen), "frozen = no movement")
	await wait(2.5)
	check(creature.get_state_name() == "RECOILING", "keeps lit -> recoils")
	await wait(2.0)
	var moved := creature.global_position.distance_to(pos_frozen)
	check(moved > 0.5, "recoiled away from the light (%.2f m)" % moved)
	Input.action_release(DVInput.ILLUMINATE)
	await wait(3.0)
	check(creature.get_state_name() == "STALKING", "returns to stalking in the dark")

	print("[relocation rules]")
	var ok := true
	for i in 25:
		creature.force_reposition()
		for n in creature.get_detector().get_samples():
			var r := IlluminatedObject.sample_radius_of(n, 0.4)
			if n.global_position.distance_to(bill.global_position) - r < creature.player_clearance - 0.01:
				ok = false
			if hand.get_illumination_at(n.global_position, r, true) > 0.0:
				ok = false
	check(ok, "relocations never land on Bill or inside light reach")

	print("[memories + reveal]")
	var m0 := mems[0]
	m0.global_position = hand.global_position + Vector3(0.6, 0, 0)
	Input.action_press(DVInput.ILLUMINATE)
	await wait(0.6)
	check(not m0.is_activated and m0.progress > 0.2, "memory charging while lit (%.2f)" % m0.progress)
	Input.action_release(DVInput.ILLUMINATE)
	await wait(0.6)
	check(m0.progress == 0.0, "progress resets when light breaks")
	Input.action_press(DVInput.ILLUMINATE)
	await wait(2.0)
	Input.action_release(DVInput.ILLUMINATE)
	check(m0.is_activated, "continuous light activates memory")
	check(game.memories_collected == 1, "counter incremented")
	await wait(6.0)
	var a1 := env.environment.ambient_light_energy
	check(a1 > 0.0 and a1 < 0.05, "memory 1: barely any ambient (%.3f)" % a1)
	mems[1].activate()
	await wait(6.0)
	var a2 := env.environment.ambient_light_energy
	check(a2 > a1, "memory 2: slightly more (%.3f)" % a2)
	mems[2].activate()
	await wait(1.0)
	check(game.phase == DarkVoid.Phase.EXPLORE, "objective changes after a short pause")
	await wait(3.0)
	check(env.environment.ambient_light_energy > a2, "memory 3: more again (%.3f)" % env.environment.ambient_light_energy)

	print("[final reversal]")
	check(game.phase == DarkVoid.Phase.FINAL, "final phase entered")
	check(creature.get_state_name() == "FINAL_WAITING", "creature stops approaching")
	var beacon := creature.get_node("Beacon") as AudioStreamPlayer3D
	check(beacon.playing, "creature beacon sound playing")
	var tp := creature.get_touch_point()
	var cpos := creature.global_position
	await wait(15.0)
	check(creature.global_position.is_equal_approx(cpos), "no relocation in final phase")
	check(beacon.global_position.distance_to(tp) < 0.01, "beacon sits at the touch point")
	# Approach in the dark.
	bill.global_position = tp + Vector3(-1.5, 0, 0)
	bill.global_position.z = 0.0
	bill.velocity = Vector3.ZERO
	await wait(0.5)
	check(game._touch_available, "TOUCH available when close and dark")
	check((game.get_node("HUD") as DarkVoidHUD).is_touch_visible(), "TOUCH prompt shown")
	# Shine at it: it recoils, prompt goes.
	Input.action_press(DVInput.ILLUMINATE)
	await wait(1.0)
	check(creature.get_state_name() == "FINAL_RECOIL", "direct light makes it recoil")
	check(not game._touch_available, "no TOUCH while lighting it")
	Input.action_release(DVInput.ILLUMINATE)
	await wait(3.0)
	check(creature.get_state_name() == "FINAL_WAITING", "settles again in the dark")
	tp = creature.get_touch_point()
	bill.global_position = Vector3(tp.x - 1.0, tp.y, 0.0)
	bill.velocity = Vector3.ZERO
	await wait(0.5)
	check(game._touch_available, "TOUCH available again")
	var ev := InputEventAction.new()
	ev.action = DVInput.INTERACT
	ev.pressed = true
	Input.parse_input_event(ev)
	await wait(0.2)
	check(game.phase == DarkVoid.Phase.COMPLETING, "interact triggers completion")
	check(hand.forced_on, "hand light swells")
	await wait(2.0)
	check(creature.get_state_name() == "REVEALED", "creature partially revealed")
	await wait(6.0)
	check(completed_reward == "dark_creature_memory", "dark_void_completed(\"%s\") emitted" % completed_reward)

	print("")
	print("RESULT: %s (%d failure(s))" % ["PASS" if failures == 0 else "FAIL", failures])
	quit(1 if failures > 0 else 0)
