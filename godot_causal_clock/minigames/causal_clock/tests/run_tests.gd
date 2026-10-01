extends SceneTree
## Headless logic tests for The Causal Clock.
##
## Run from the project folder:
##   godot --headless --path . --script res://minigames/causal_clock/tests/run_tests.gd
## Exit code 0 = all passed.

const DIR := "res://minigames/causal_clock/"

var _failures := 0
var _checks := 0


func _init() -> void:
	print("== Causal Clock logic tests ==")
	_test_layouts_valid()
	_test_coupling_rules()
	_test_pins_slip_and_block()
	_test_cam_engagement()
	_test_jam()
	_test_undo_reset()
	_test_reference_solutions()
	_test_milestones()
	_test_hint_solver()
	_test_memory_library()
	print("== %d checks, %d failures ==" % [_checks, _failures])
	quit(1 if _failures > 0 else 0)


func check(cond: bool, what: String) -> void:
	_checks += 1
	if not cond:
		_failures += 1
		printerr("  FAIL: ", what)


func _main() -> CausalClockLayout:
	return CausalClockLayout.load_from_file(DIR + "data/layouts/default_layout.json")


func _test_layouts_valid() -> void:
	print("- layouts parse and validate")
	for f in ["default_layout.json", "prelude_layout.json"]:
		var l := CausalClockLayout.load_from_file(DIR + "data/layouts/" + f)
		check(l.is_valid(), "%s valid: %s" % [f, str(l.errors)])
		for w in l.warnings:
			print("    (warning) %s: %s" % [f, w])
	var l2 := _main()
	check(l2.ring_count == 5, "main layout has 5 rings")
	check(l2.element_count() == 6, "main layout has 5 rings + hub")
	check(l2.couplings.size() == 6, "main layout has 6 couplings")
	# Broken JSON is reported, not crashed on.
	var bad := CausalClockLayout.from_dict({"rings": [{"id": "A", "segments": [{"out": 9, "in": 0}]}], "hub": {"sockets": []}})
	check(not bad.is_valid(), "invalid layout is rejected")


func _test_coupling_rules() -> void:
	print("- gears and ratchets")
	var l := _main()
	var p := CausalClockPuzzle.new(l)
	var before := p.state.positions.duplicate()
	# Turning A: gear A-B (-1) moves B backwards; B -> C ratchet (+1) carries C.
	var r := p.turn(l.index_of("A"), 1)
	check(r.ok, "turn A ok")
	check(r.deltas[0] == 1 and r.deltas[1] == -1, "A+ drives B backwards: %s" % str(r.deltas))
	check(r.deltas[2] == -1, "B drives C through the ratchet")
	check(p.state.positions[0] == posmod(before[0] + 1, 8), "A advanced one slot")
	check(r.wave[0] == 0 and r.wave[1] == 1 and r.wave[2] == 2, "propagation wave order")
	# Turning C does not drive B back through the one-way ratchet.
	p.restart()
	var r2 := p.turn(l.index_of("C"), 1)
	check(r2.ok and r2.deltas[1] == 0, "ratchet does not back-drive B")
	# Hub is not turnable by hand.
	var r3 := p.turn(l.hub_index(), 1)
	check(not r3.ok and r3.reason == "fixed", "hub refuses manual turns")


func _test_pins_slip_and_block() -> void:
	print("- pins")
	var l := _main()
	var p := CausalClockPuzzle.new(l)
	var a := l.index_of("A")
	var b := l.index_of("B")
	check(p.toggle_pin(b) == "", "pin B")
	var r := p.turn(a, 1)
	check(r.ok and r.deltas[b] == 0, "pinned B holds while A turns")
	check(r.slipped.has(0), "gear A-B reported as slipping")
	check(r.deltas[2] == 0, "motion does not pass through pinned B")
	var r2 := p.turn(b, 1)
	check(not r2.ok and r2.reason == "pinned", "pinned ring cannot be turned")
	check(p.toggle_pin(a) == "", "second pin")
	check(p.toggle_pin(l.index_of("C")) == "no_pins_left", "only two pins")
	check(p.toggle_pin(l.hub_index()) == "not_pinnable", "hub not pinnable")
	check(p.toggle_pin(a) == "", "remove pin")
	check(not p.state.is_pinned(a), "pin removed")


func _test_cam_engagement() -> void:
	print("- cams")
	var l := _main()
	var c_idx := l.index_of("C")
	var cam := l.couplings[2]  # cam_cd, teeth on C sectors 0..3, gear at 337.5 (slot 7.5)
	var s := CausalClockState.create(l.start_positions())
	for pos in 8:
		s.positions[c_idx] = pos
		var sector := posmod(7 - pos, 8)
		check(CausalClockMechanism.coupling_engaged(l, s.positions, cam) == (sector <= 3), "cam at C=%d" % pos)
	# When disengaged, turning C leaves D alone.
	s.positions[c_idx] = 0  # sector 7 under the gear: no tooth
	var r := CausalClockMechanism.simulate_turn(l, s, c_idx, 1)
	check(r.ok and r.deltas[3] == 0 and r.idle_cams.has(2), "disengaged cam leaves D")
	s.positions[c_idx] = 5  # sector 2: tooth
	var r2 := CausalClockMechanism.simulate_turn(l, s, c_idx, 1)
	check(r2.ok and r2.deltas[3] == -1, "engaged cam drives D backwards")


func _test_jam() -> void:
	print("- jams")
	var l := _main()
	# B drives the heart two ways: directly by the shaft (+1) and via
	# C -> D -> E -> heart (which reverses twice and nets -1 when C's cam bites).
	var s := CausalClockState.create(l.start_positions())
	s.positions[l.index_of("B")] = 2  # shaft cam sector (3 - 2) = 1: engaged
	s.positions[l.index_of("C")] = 5  # C cam engaged
	var r := CausalClockMechanism.simulate_turn(l, s, l.index_of("B"), 1)
	check(not r.ok and r.reason == "jam", "conflicting drives jam: %s" % r.reason)
	check(r.jam_element == l.hub_index(), "the heart is the jammed element")
	# Pinning E breaks the second path, so the same turn is allowed.
	s.pin_mask = 1 << l.index_of("E")
	var r2 := CausalClockMechanism.simulate_turn(l, s, l.index_of("B"), 1)
	check(r2.ok, "pin resolves the jam")


func _test_undo_reset() -> void:
	print("- undo / reset")
	var l := _main()
	var p := CausalClockPuzzle.new(l)
	var start := p.state.copy()
	p.turn(0, 1)
	p.toggle_pin(1)
	p.turn(2, -1)
	check(p.move_count == 3, "three moves counted")
	check(p.undo() and p.undo() and p.undo(), "undo three times")
	check(p.state.equals(start), "back at start after undo")
	check(not p.undo(), "nothing left to undo")
	p.turn(0, 1)
	check(p.reset(), "reset")
	check(p.state.equals(start), "reset restores start")
	check(p.undo() and not p.state.equals(start), "reset is undoable")


func _test_reference_solutions() -> void:
	print("- reference solutions solve their layouts")
	for f in ["default_layout.json", "prelude_layout.json"]:
		var l := CausalClockLayout.load_from_file(DIR + "data/layouts/" + f)
		var p := CausalClockPuzzle.new(l)
		var emitted := []
		p.solved.connect(func(rid): emitted.append(rid))
		check(not p.trace.solved, "%s does not start solved" % f)
		var ok := true
		for step in l.reference_solution:
			if not p.apply_step(step):
				ok = false
				printerr("    step failed: ", step, " at ", p.state.describe())
				break
		check(ok, "%s: every reference step legal" % f)
		check(p.is_solved and p.trace.solved, "%s: solved after reference solution (%s)" % [f, p.state.describe()])
		check(emitted == [l.result_id], "%s: solved signal carries result id" % f)
		check(p.trace.depth == l.ring_count, "%s: chain crosses every ring" % f)
		var r := p.turn(0, 1)
		check(not r.ok and r.reason == "solved", "%s: locked after solve" % f)


func _test_milestones() -> void:
	print("- milestones")
	var l := _main()
	var p := CausalClockPuzzle.new(l)
	var got: Array[String] = []
	p.milestone_reached.connect(func(m): got.append(m.id))
	for step in l.reference_solution:
		p.apply_step(step)
	check(got.has("m_complete"), "completion milestone fired")
	check(got.size() == l.milestones.size(), "every milestone fired exactly once: %s" % str(got))
	check(got[-1] == "m_complete", "complete fires last")


func _test_hint_solver() -> void:
	print("- solver / hint")
	for f in ["prelude_layout.json", "default_layout.json"]:
		var l := CausalClockLayout.load_from_file(DIR + "data/layouts/" + f)
		var solver := CausalClockSolver.new(l)
		var start := CausalClockState.create(l.start_positions())
		var t0 := Time.get_ticks_msec()
		var plan: Variant = solver.solve_by_stages(start)
		var ms := Time.get_ticks_msec() - t0
		check(plan != null, "%s: hint-by-hint solve succeeds" % f)
		if plan == null:
			continue
		var p := CausalClockPuzzle.new(l)
		for mv in plan:
			p.apply_step(CausalClockSolver.move_to_string(l, mv))
		check(p.is_solved, "%s: following the hints solves the puzzle" % f)
		print("    %s: hint path %d moves (reference %d) in %d ms" % [f, plan.size(), l.reference_solution.size(), ms])
	# Prelude is small enough to prove optimality of the reference solution.
	var lp := CausalClockLayout.load_from_file(DIR + "data/layouts/prelude_layout.json")
	var sp := CausalClockSolver.new(lp)
	var best: Variant = sp.search(CausalClockState.create(lp.start_positions()), lp.ring_count + 1, 500000)
	check(best != null and best.size() == lp.reference_solution.size(), "prelude optimal = %d" % (best.size() if best != null else -1))


func _test_memory_library() -> void:
	print("- memory library")
	var lib := CausalClockMemoryLibrary.load_from_file(DIR + "data/memories/placeholder_memories.json")
	check(lib.errors.is_empty(), "memories load: %s" % str(lib.errors))
	for f in ["default_layout.json", "prelude_layout.json"]:
		var l := CausalClockLayout.load_from_file(DIR + "data/layouts/" + f)
		for m in l.milestones:
			check(lib.has(m.memory_id), "%s milestone %s has memory %s" % [f, m.id, m.memory_id])
	var missing := lib.get_memory("does_not_exist")
	check(missing != null and missing.label != "", "unknown memory id yields a placeholder")
