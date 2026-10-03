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
	_test_red_herrings()
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
	check(l2.couplings.size() == 4, "main layout has 4 couplings")
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


func _test_red_herrings() -> void:
	print("- red herrings")
	for f in ["default_layout.json", "prelude_layout.json"]:
		var l := CausalClockLayout.load_from_file(DIR + "data/layouts/" + f)
		check(not Array(l.warnings).any(func(w): return w.contains("decoy")), "%s: every decoy is a real red herring" % f)
		var decoys := 0
		for e in l.elements:
			for s in e.segments:
				check(s.is_through(), "%s: no chain fragment dead-ends inside a ring" % f)
				decoys += int(s.decoy)
		check(decoys >= 2, "%s has decoy chains" % f)
	var l2 := _main()
	# Some routes through decoys reach the heart, but only ever at a sealed lock.
	var herring := _find_herring(l2)
	var t := CausalClockMechanism.trace_chain(l2, herring)
	check(herring.size() > 0 and t.depth == 5 and not t.solved and t.sealed_lock >= 0, "a herring route ends in a sealed lock: %s" % str(herring))
	check(t.true_depth < 5, "herring progress is not counted (true depth %d)" % t.true_depth)
	var t2 := CausalClockMechanism.trace_chain(l2, PackedInt32Array([0, 3, 1, 2, 7, 0]))
	check(t2.solved and t2.true_depth == 5, "the genuine route opens the heart")
	# A layout whose decoy could finish is flagged.
	var bad := CausalClockLayout.from_dict({"pin_count": 0,
		"rings": [{"id": "A", "segments": [{"out": 0, "in": 0}, {"out": 4, "in": 4, "decoy": true}]}],
		"hub": {"sockets": [0]}})
	check(Array(bad.warnings).any(func(w): return w.contains("decoy")), "a decoy that can finish is reported")
	# No turn is ever refused for conflicting drives any more.
	var s := CausalClockState.create(l2.start_positions())
	for el in l2.ring_count:
		for d in [1, -1]:
			var r := CausalClockMechanism.simulate_turn(l2, s, el, d)
			check(r.ok, "turn %s%d allowed" % [l2.elements[el].id, d])


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


## First position (heart at rest) where the chain crosses every ring but
## stops in a sealed lock.
static func _find_herring(l: CausalClockLayout) -> PackedInt32Array:
	var n := l.elements[0].positions
	var total := int(pow(n, l.ring_count))
	for code in total:
		var pos := PackedInt32Array()
		var c := code
		for i in l.ring_count:
			pos.append(c % n)
			c /= n
		pos.append(l.elements[l.hub_index()].start)
		if CausalClockMechanism.trace_chain(l, pos).sealed_lock >= 0:
			return pos
	return PackedInt32Array()
