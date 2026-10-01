class_name CausalClockPuzzle
extends RefCounted
## One play session of a layout: current state, undo history, move count,
## chain progress and milestone bookkeeping. No rendering, no audio — the game
## controller listens to the signals and drives the presentation.

## Any change to the state (turn, pin, undo, reset). `kind` is one of
## "turn", "pin", "unpin", "undo", "reset". `move` is the MoveResult for turns.
signal changed(kind: String, move: CausalClockMechanism.MoveResult)
## The chain grew or shrank. Depth counts rings crossed (0..ring_count).
signal chain_changed(old_depth: int, new_depth: int, trace: CausalClockMechanism.ChainTrace)
signal milestone_reached(milestone: CausalClockLayout.MilestoneDef)
signal solved(result_id: String)

var layout: CausalClockLayout
var state: CausalClockState
var trace: CausalClockMechanism.ChainTrace
var history: Array[CausalClockState] = []
var move_count: int = 0
var is_solved: bool = false
## milestone id -> true, for milestones already revealed (they stay revealed
## even if the chain later breaks again: a recovered memory is kept).
var reached: Dictionary = {}
## Upper bound on undo depth; plenty for any sane session.
var max_history: int = 512


func _init(p_layout: CausalClockLayout) -> void:
	layout = p_layout
	state = CausalClockState.create(layout.start_positions())
	trace = CausalClockMechanism.trace_chain(layout, state.positions)


## Turn a ring. Returns the MoveResult (check .ok / .reason).
func turn(element: int, dir: int) -> CausalClockMechanism.MoveResult:
	if is_solved:
		var r := CausalClockMechanism.MoveResult.new()
		r.element = element
		r.dir = dir
		r.reason = "solved"
		return r
	var result := CausalClockMechanism.simulate_turn(layout, state, element, dir)
	if not result.ok:
		return result
	_push_history()
	CausalClockMechanism.apply(layout, state, result)
	move_count += 1
	changed.emit("turn", result)
	_refresh_chain()
	return result


## Preview a turn without applying it (used for hover readouts and hints).
func preview(element: int, dir: int) -> CausalClockMechanism.MoveResult:
	return CausalClockMechanism.simulate_turn(layout, state, element, dir)


## Add or remove a pin. Returns "" on success or an error code.
func toggle_pin(element: int) -> String:
	if is_solved:
		return "solved"
	var err := CausalClockMechanism.pin_toggle_error(layout, state, element)
	if err != "":
		return err
	_push_history()
	var was_pinned := state.is_pinned(element)
	state.pin_mask ^= 1 << element
	move_count += 1
	changed.emit("unpin" if was_pinned else "pin", null)
	return ""


func can_undo() -> bool:
	return not history.is_empty() and not is_solved


func undo() -> bool:
	if not can_undo():
		return false
	state = history.pop_back()
	move_count = maxi(0, move_count - 1)
	changed.emit("undo", null)
	_refresh_chain()
	return true


## Return every ring to its authored start. Undoable (it is pushed on history).
func reset() -> bool:
	if is_solved:
		return false
	var start := CausalClockState.create(layout.start_positions())
	if start.equals(state):
		return false
	_push_history()
	state = start
	move_count += 1
	changed.emit("reset", null)
	_refresh_chain()
	return true


## Full restart: clears history, move count and solved flag (milestones kept
## unless `forget_memories`).
func restart(forget_memories: bool = false) -> void:
	state = CausalClockState.create(layout.start_positions())
	history.clear()
	move_count = 0
	is_solved = false
	if forget_memories:
		reached.clear()
	var old := trace.depth
	trace = CausalClockMechanism.trace_chain(layout, state.positions)
	changed.emit("reset", null)
	chain_changed.emit(old, trace.depth, trace)


## Apply a step written in reference-solution notation: "A+", "C-", "pin:B".
func apply_step(step: String) -> bool:
	var s := step.strip_edges()
	if s.begins_with("pin:") or s.begins_with("unpin:"):
		var idx := layout.index_of(s.get_slice(":", 1))
		return toggle_pin(idx) == ""
	var dir := 1 if s.ends_with("+") else (-1 if s.ends_with("-") else 0)
	var idx2 := layout.index_of(s.substr(0, s.length() - 1))
	return turn(idx2, dir).ok


func _push_history() -> void:
	history.append(state.copy())
	if history.size() > max_history:
		history.pop_front()


func _refresh_chain() -> void:
	var old_depth := trace.depth
	var was_solved := trace.solved
	trace = CausalClockMechanism.trace_chain(layout, state.positions)
	if trace.depth != old_depth or trace.solved != was_solved:
		chain_changed.emit(old_depth, trace.depth, trace)
	_check_milestones()
	if trace.solved and not is_solved:
		is_solved = true
		solved.emit(layout.result_id)


func _check_milestones() -> void:
	for m in layout.milestones:
		if reached.has(m.id):
			continue
		var hit := false
		match m.trigger_type:
			"chain_depth":
				hit = trace.depth >= m.value
			"segment_linked":
				hit = trace.contains(m.element, m.segment) and (trace.depth > m.element or trace.solved)
			"complete":
				hit = trace.solved
		if hit:
			reached[m.id] = true
			milestone_reached.emit(m)
