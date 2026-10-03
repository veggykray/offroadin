extends SceneTree
## End-to-end smoke test: boots the real game scene, plays the reference
## solution through the same entry points the player uses, and checks the
## presentation reacts (milestones, reveal card, completion signal, panel).
##
##   godot --headless --path . --script res://minigames/causal_clock/tests/smoke_test.gd
## Optional: -- --capture=<dir> (with a display) saves screenshots along the way.

const GAME := "res://minigames/causal_clock/scenes/causal_clock_game.tscn"
const TITLE := "res://minigames/causal_clock/scenes/causal_clock_title.tscn"

var _fail := 0
var _capture_dir := ""
var _completed: Array[String] = []
var _milestones: Array[String] = []
var _revealed: Array[String] = []


func _initialize() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--capture="):
			_capture_dir = a.get_slice("=", 1)
	_run.call_deferred()


func check(cond: bool, what: String) -> void:
	if not cond:
		_fail += 1
		printerr("  FAIL: ", what)
	else:
		print("  ok: ", what)


func _frames(n: int) -> void:
	for i in n:
		await process_frame


func _shot(name: String) -> void:
	if _capture_dir == "":
		return
	await _frames(2)
	var img := root.get_viewport().get_texture().get_image()
	img.save_png(_capture_dir.path_join(name + ".png"))
	print("  captured ", name)


## Screen position of a point given in clock-local polar coordinates.
func _screen(game: CausalClockGame, angle_deg: float, radius: float) -> Vector2:
	return game.view.get_global_transform_with_canvas() * CausalClockGeometry.point(angle_deg, radius)


func _mouse_button(_game: CausalClockGame, at: Vector2, button: MouseButton, pressed: bool) -> void:
	var e := InputEventMouseButton.new()
	e.position = at
	e.global_position = at
	e.button_index = button
	e.pressed = pressed
	root.get_viewport().push_input(e, true)


func _mouse_motion(_game: CausalClockGame, at: Vector2) -> void:
	var e := InputEventMouseMotion.new()
	e.position = at
	e.global_position = at
	root.get_viewport().push_input(e, true)


func _run() -> void:
	print("== smoke: title scene ==")
	var title: Node = load(TITLE).instantiate()
	root.add_child(title)
	await _frames(90)
	await _shot("00_title")
	check(title.is_inside_tree(), "title scene runs")
	title.queue_free()
	await _frames(2)

	print("== smoke: game scene ==")
	var game: CausalClockGame = load(GAME).instantiate()
	root.add_child(game)
	game.puzzle_completed.connect(func(r): _completed.append(r))
	game.milestone_reached.connect(func(id, _mem): _milestones.append(id))
	game.memory_revealed.connect(func(id): _revealed.append(id))
	await _frames(60)
	check(game.puzzle != null and not game.puzzle.is_solved, "game boots unsolved")
	check(game.view.rings.size() == game.layout.element_count(), "one view per ring + hub")
	await _shot("01_start")

	# A refused move: the heart cannot be turned by hand.
	game.request_turn(game.layout.hub_index(), 1)
	check(game.puzzle.move_count == 0, "heart refuses manual turn")

	# Real pointer input: drag Ring B a quarter turn clockwise, wheel, right-click.
	var b_idx := game.layout.index_of("B")
	var r_mid := game.view.geo.mid(b_idx)
	var moves_before := game.puzzle.move_count
	_mouse_button(game, _screen(game, 300.0, r_mid), MOUSE_BUTTON_LEFT, true)
	for k in 12:
		_mouse_motion(game, _screen(game, 300.0 + k * 4.0, r_mid))
		await process_frame
	_mouse_button(game, _screen(game, 348.0, r_mid), MOUSE_BUTTON_LEFT, false)
	await _frames(5)
	check(game.puzzle.move_count == moves_before + 1, "dragging Ring B by ~48 deg commits one 45 deg step (moves %d)" % (game.puzzle.move_count - moves_before))
	_mouse_button(game, _screen(game, 300.0, r_mid), MOUSE_BUTTON_WHEEL_UP, true)
	await _frames(3)
	check(game.puzzle.move_count == moves_before + 2, "mouse wheel turns the ring under the pointer")
	_mouse_button(game, _screen(game, 300.0, r_mid), MOUSE_BUTTON_RIGHT, true)
	await _frames(3)
	check(game.puzzle.state.is_pinned(b_idx), "right-click pins the ring under the pointer")
	game.request_turn(b_idx, 1)
	check(game.puzzle.move_count == moves_before + 3, "pinned ring refuses to turn")
	_mouse_button(game, _screen(game, 300.0, r_mid), MOUSE_BUTTON_RIGHT, true)
	await _frames(3)
	check(not game.puzzle.state.is_pinned(b_idx), "right-click again removes the pin")
	for k in 4:
		game.undo()
	await create_timer(1.0).timeout
	check(game.puzzle.move_count == 0 and game.puzzle.state.equals(CausalClockState.create(game.layout.start_positions())), "undo winds back to the start")

	# Hover preview on ring A.
	game._on_hover(0)
	await _frames(10)
	await _shot("02_preview_A")
	game._on_hover(-1)

	# Hint runs on a worker thread.
	game.request_hint()
	for i in 300:
		await process_frame
		if game._hint_task < 0:
			break
	check(game._hint_task < 0 and not game._plan.is_empty(), "hint search finished with a plan (%d moves)" % game._plan.size())
	await _frames(20)
	await _shot("03_hint")

	var steps := game.layout.reference_solution
	for i in steps.size():
		game.apply_step(steps[i])
		await _frames(14)
		# Toasts never block; any card that opens mid-run gets dismissed.
		if game.reveal.is_open():
			await _shot("04_card_%d" % i)
			game.reveal.close()
			await create_timer(0.5).timeout
		if i == 6:
			await _frames(30)
			await _shot("05_midway_pins")
		if i == 12:
			await _frames(30)
			await _shot("06_late")
	check(game.puzzle.is_solved, "reference solution solves the real scene")
	check(_completed == ["causal_clock_complete"], "puzzle_completed(\"causal_clock_complete\") emitted once: %s" % str(_completed))
	check(_milestones.size() == game.layout.milestones.size(), "all milestone signals: %s" % str(_milestones))
	await _frames(40)
	await _shot("07_solved_bloom")
	await create_timer(game.final_reveal_delay + 0.6).timeout
	check(game.reveal.is_open(), "final memory card opens after the bloom")
	await _frames(40)
	await _shot("08_final_card")
	game.reveal.close()
	await create_timer(0.8).timeout
	check(game.menus.is_open(), "completion panel shown after the card")
	await _shot("09_done_panel")
	check(_revealed.size() >= 1, "memory_revealed emitted: %s" % str(_revealed))

	# Undo is locked after solving; restart works.
	game.restart()
	await _frames(30)
	check(not game.puzzle.is_solved and game.puzzle.move_count == 0, "restart returns to an unsolved clock")
	game.request_turn(0, 1)
	game.request_pin(1)
	game.undo()
	await _frames(30)
	check(game.puzzle.move_count == 1, "undo after restart")

	# Red herring: decoy chains lead all the way to the heart, into a sealed lock.
	var herring: PackedInt32Array = load("res://minigames/causal_clock/tests/run_tests.gd")._find_herring(game.layout)
	for i in game.layout.element_count():
		game.puzzle.state.positions[i] = herring[i]
	game.puzzle._refresh_chain()
	game.view.show_state(game.puzzle.state, game.puzzle.trace)
	check(game.puzzle.trace.sealed_lock >= 0 and not game.puzzle.is_solved, "herring route reaches a sealed lock")
	await _frames(6)
	await _shot("12_herring")
	# Slip: pin B, turn A — the A/B gear slips against the pin.
	game.request_pin(game.layout.index_of("B"))
	game.request_turn(0, 1)
	await _frames(4)
	await _shot("13_slip")
	check(game.puzzle.state.positions[1] == herring[1], "pinned B held while A turned")

	# Pause menu and notes.
	game._open_menu("notes")
	await _frames(30)
	await _shot("10_notes")
	check(game.menus.is_open(), "notes panel opens")
	game._close_menus()
	game.queue_free()
	await _frames(5)

	print("== smoke: prelude ==")
	CausalClockGame.pending_layout_path = "res://minigames/causal_clock/data/layouts/prelude_layout.json"
	var pre: CausalClockGame = load(GAME).instantiate()
	root.add_child(pre)
	await _frames(30)
	await _shot("11_prelude")
	for s in pre.layout.reference_solution:
		pre.apply_step(s)
		await _frames(6)
	check(pre.puzzle.is_solved, "prelude solvable in scene")
	await _frames(20)
	pre.queue_free()
	await create_timer(0.5).timeout
	print("== smoke: %s ==" % ("PASSED" if _fail == 0 else "%d FAILURES" % _fail))
	quit(1 if _fail > 0 else 0)
