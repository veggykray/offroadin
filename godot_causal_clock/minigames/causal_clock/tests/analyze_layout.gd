extends SceneTree
## Layout analyzer for puzzle authors.
##
##   godot --headless --path . --script res://minigames/causal_clock/tests/analyze_layout.gd -- res://minigames/causal_clock/data/layouts/default_layout.json
##
## Reports: validation problems, whether the reference solution works, the
## hint-by-hint route (what a methodical player following hints would do,
## stage by stage), the optimal solution length (bounded search), and how
## often random turns jam. Use it after every edit to a layout.

func _initialize() -> void:
	var path := "res://minigames/causal_clock/data/layouts/default_layout.json"
	var budget := 3000000
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--budget="):
			budget = int(a.get_slice("=", 1))
		elif a.ends_with(".json"):
			path = a
	var l := CausalClockLayout.load_from_file(path)
	print("Layout: %s  (%s)" % [l.title, path])
	for e in l.errors:
		print("  ERROR: ", e)
	for w in l.warnings:
		print("  note: ", w)
	if not l.is_valid():
		quit(1)
		return
	print("  rings: %d  pins: %d  couplings: %d  milestones: %d" % [l.ring_count, l.pin_count, l.couplings.size(), l.milestones.size()])
	for c in l.couplings:
		print("    %-12s %s -> %s  ratio %+d  %s%s" % [c.id, l.elements[c.a].id, l.elements[c.b].id, c.ratio,
			"one-way" if c.one_way else "two-way", ("  cam on %s sectors %s" % [l.elements[c.cam_element].id, str(c.cam_teeth)]) if c.has_cam() else ""])

	var start := CausalClockState.create(l.start_positions())
	var t0 := CausalClockMechanism.trace_chain(l, start.positions)
	print("  start: %s  chain depth %d%s" % [str(start.positions), t0.depth, "  (ALREADY SOLVED!)" if t0.solved else ""])

	if not l.reference_solution.is_empty():
		var p := CausalClockPuzzle.new(l)
		var ok := true
		for s in l.reference_solution:
			if not p.apply_step(s):
				ok = false
				print("  reference step '%s' is illegal at %s" % [s, p.state.describe()])
				break
		print("  reference solution: %d moves -> %s" % [l.reference_solution.size(), "SOLVES" if ok and p.is_solved else "DOES NOT SOLVE"])

	var solver := CausalClockSolver.new(l)
	var s := start.copy()
	var stages: Array[int] = []
	var all := PackedStringArray()
	var t := Time.get_ticks_msec()
	while solver.depth_of(solver.encode(s)) <= l.ring_count:
		var part: Variant = solver.hint(s, 1000000)
		if part == null:
			print("  hint route: STUCK at depth %d (no route within budget)" % solver.depth_of(solver.encode(s)))
			break
		stages.append(part.size())
		for mv in part:
			all.append(CausalClockSolver.move_to_string(l, mv))
			s = solver.decode(solver.successor(solver.encode(s), mv))
	print("  hint route: %d moves, per ring %s  (%d ms)" % [all.size(), str(stages), Time.get_ticks_msec() - t])
	print("    ", " ".join(all))

	t = Time.get_ticks_msec()
	var opt: Variant = solver.search(start, l.ring_count + 1, budget)
	if opt == null:
		print("  optimal: more than the search budget (%d states) — likely long; raise --budget= to measure" % budget)
	else:
		var names := PackedStringArray()
		for mv in opt:
			names.append(CausalClockSolver.move_to_string(l, mv))
		print("  optimal: %d moves  (%d states, %d ms)" % [opt.size(), solver.nodes_expanded, Time.get_ticks_msec() - t])
		print("    ", " ".join(names))

	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var jams := 0
	var tries := 4000
	for i in tries:
		var st := CausalClockState.new()
		for e in l.elements:
			st.positions.append(rng.randi_range(0, e.positions - 1))
		var el := rng.randi_range(0, l.ring_count - 1)
		var r := CausalClockMechanism.simulate_turn(l, st, el, 1 if rng.randf() < 0.5 else -1)
		if r.reason == "jam":
			jams += 1
	print("  jam rate (random unpinned turns): %.1f%%" % (100.0 * jams / tries))
	quit(0)
