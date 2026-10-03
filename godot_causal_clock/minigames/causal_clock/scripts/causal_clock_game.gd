class_name CausalClockGame
extends Node
## Root of the playable mini-game (scenes/causal_clock_game.tscn).
##
## Wires the four separated layers together:
##   logic    – CausalClockLayout / CausalClockPuzzle / CausalClockMechanism
##   visuals  – CausalClockView (+ ambient layer)
##   content  – CausalClockMemoryLibrary (memories JSON)
##   reveal   – HUD shelf / toasts / CausalClockMemoryReveal card
## and exposes integration signals for a host game.
##
## Embedding: instance the scene, set `layout_path` / `memories_path`,
## set `standalone = false`, connect `puzzle_completed` and `exit_requested`.

## Emitted the moment the chain reaches the heart. result_id comes from the
## layout ("causal_clock_complete" for the default puzzle).
signal puzzle_completed(result_id: String)
## Emitted when a milestone in the layout is reached for the first time.
signal milestone_reached(milestone_id: String, memory_id: String)
## Emitted when a memory card is opened (by milestone or from the shelf).
signal memory_revealed(memory_id: String)
## The player chose to leave (pause menu / completion panel).
signal exit_requested

@export_file("*.json") var layout_path: String = "res://minigames/causal_clock/data/layouts/default_layout.json"
@export_file("*.json") var memories_path: String = "res://minigames/causal_clock/data/memories/placeholder_memories.json"
## Standalone: leaving returns to `exit_scene`. Embedded: only emits exit_requested.
@export var standalone: bool = true
@export_file("*.tscn") var exit_scene: String = "res://minigames/causal_clock/scenes/causal_clock_title.tscn"
## Max states the hint search may expand (it runs on a worker thread).
@export var hint_budget: int = 250000
## Seconds to let the completion animation play before the final card.
@export var final_reveal_delay: float = 2.6

const HUD_SCENE := preload("res://minigames/causal_clock/ui/clock_hud.tscn")
const REVEAL_SCENE := preload("res://minigames/causal_clock/ui/memory_reveal_panel.tscn")
const MENUS_SCENE := preload("res://minigames/causal_clock/ui/clock_menus.tscn")

## Set by the title screen before switching scenes to pick a layout.
static var pending_layout_path: String = ""

var layout: CausalClockLayout
var memories: CausalClockMemoryLibrary
var puzzle: CausalClockPuzzle
var view: CausalClockView
var hud: CausalClockHUD
var reveal: CausalClockMemoryReveal
var menus: CausalClockMenus
var audio: CausalClockAudio
var ambient: CausalClockAmbient
var world: Node2D
var hints_used: int = 0

var _selected: int = 0
var _hover: int = -1
var _paused: bool = false
var _reveal_queue: Array[String] = []
var _done_pending: bool = false
var _best: int = -1
# Hint search state.
var _hint_task: int = -1
var _hint_solver: CausalClockSolver
var _hint_result: Variant = null
var _plan: PackedInt32Array = PackedInt32Array()
var _plan_keys: PackedInt64Array = PackedInt64Array()


func _ready() -> void:
	if pending_layout_path != "":
		layout_path = pending_layout_path
		pending_layout_path = ""
	layout = CausalClockLayout.load_from_file(layout_path)
	for w in layout.warnings:
		print_verbose("Causal Clock layout note: " + w)
	if not layout.is_valid():
		for e in layout.errors:
			push_error("Causal Clock layout: " + e)
		_show_fatal("This clock's layout could not be read:\n" + "\n".join(layout.errors))
		return
	memories = CausalClockMemoryLibrary.load_from_file(memories_path)
	for e in memories.errors:
		push_warning("Causal Clock memories: " + e)
	_best = layout.reference_solution.size()

	ambient = CausalClockAmbient.new()
	add_child(ambient)
	world = Node2D.new()
	add_child(world)
	view = CausalClockView.new()
	world.add_child(view)
	view.setup(layout)
	audio = CausalClockAudio.new()
	add_child(audio)
	var ui := CanvasLayer.new()
	ui.layer = 10
	add_child(ui)
	hud = HUD_SCENE.instantiate()
	ui.add_child(hud)
	hud.build(layout, memories)
	reveal = REVEAL_SCENE.instantiate()
	ui.add_child(reveal)
	menus = MENUS_SCENE.instantiate()
	ui.add_child(menus)

	puzzle = CausalClockPuzzle.new(layout)
	puzzle.chain_changed.connect(_on_chain_changed)
	puzzle.milestone_reached.connect(_on_milestone)
	puzzle.solved.connect(_on_solved)

	_dress_view()
	view.rotate_requested.connect(request_turn)
	view.pin_toggle_requested.connect(request_pin)
	view.select_requested.connect(_select)
	view.hover_changed.connect(_on_hover)
	view.grab_refused.connect(func(el, _r): _refuse_message(el, "fixed"))

	hud.undo_pressed.connect(undo)
	hud.reset_pressed.connect(reset)
	hud.hint_pressed.connect(request_hint)
	hud.notes_pressed.connect(func(): _open_menu("notes"))
	hud.menu_pressed.connect(func(): _open_menu("pause"))
	hud.memory_pressed.connect(_open_memory_from_milestone)
	reveal.closed.connect(_on_reveal_closed)
	menus.resume_pressed.connect(_close_menus)
	menus.restart_pressed.connect(restart)
	menus.exit_pressed.connect(_exit)
	menus.play_again_pressed.connect(func():
		_close_menus()
		restart())

	_select(_first_manual())
	hud.update_state(puzzle)
	get_viewport().size_changed.connect(_fit)
	_fit()
	audio.start_ambient.call_deferred()


func _first_manual() -> int:
	for e in layout.elements:
		if e.manual:
			return e.index
	return -1


func _fit() -> void:
	var s := get_viewport().get_visible_rect().size
	var r := view.visual_radius()
	var sc := minf(s.y * 0.97 / (2.0 * r), (s.x - 600.0) / (2.0 * r))
	world.scale = Vector2.ONE * maxf(0.3, sc)
	world.position = s * 0.5


# ---------------------------------------------------------------------------
# Player actions (also usable by a host project or scripted tests)
# ---------------------------------------------------------------------------

func is_input_blocked() -> bool:
	return _paused or reveal.is_open() or menus.is_open()


func request_turn(element: int, dir: int) -> void:
	if is_input_blocked():
		return
	if puzzle.is_solved:
		return
	var r := puzzle.turn(element, dir)
	if not r.ok:
		view.play_refusal(r)
		view.cancel_drag()
		audio.play("invalid")
		_refuse_message(element, r.reason, r)
		return
	_select(element)
	view.play_turn(r)
	var mass := layout.elements[element].mass
	audio.play("ring_rotate", clampf(1.3 - mass * 0.22, 0.6, 1.5))
	for ci in r.transmitted:
		var c := layout.couplings[ci]
		var w := maxi(r.wave[c.a], r.wave[c.b])
		audio.play("gear_engage", randf_range(0.9, 1.15), -4.0, 0.07 * w)
	if not r.slipped.is_empty():
		audio.play("gear_slip", 1.0, -3.0, 0.05)
	if puzzle.move_count >= 3:
		hud.fade_intro()
	_after_change()


func request_pin(element: int) -> void:
	if is_input_blocked() or puzzle.is_solved:
		return
	var was := puzzle.state.is_pinned(element)
	var err := puzzle.toggle_pin(element)
	if err != "":
		view.play_pin_refusal(element)
		audio.play("invalid")
		if err == "no_pins_left":
			hud.flash_pins()
		_refuse_message(element, err)
		return
	audio.play("pin_remove" if was else "pin_place", 1.0, 0.0, 0.0 if was else 0.22)
	hud.set_status("%s %s." % [layout.elements[element].label, "released" if was else "pinned"], false, 2.0)
	_after_change()


func undo() -> void:
	if is_input_blocked():
		return
	if puzzle.undo():
		view.play_settle(puzzle.state)
		audio.play("ring_rotate", 0.8, -3.0)
		_after_change()


func reset() -> void:
	if is_input_blocked():
		return
	if puzzle.reset():
		view.play_settle(puzzle.state)
		audio.play("ring_rotate", 0.6)
		hud.set_status("The rings return to where they began. (Undo brings you back.)", false, 3.0)
		_after_change()


## Start the puzzle over from scratch (keeps memories already recovered).
func restart() -> void:
	_close_menus()
	_done_pending = false
	_reveal_queue.clear()
	puzzle.restart(false)
	view.setup(layout)
	_dress_view()
	_select(_first_manual())
	_after_change()


## Content and ambience that live on the (re)built view children.
func _dress_view() -> void:
	var icons := {}
	for id in memories.ids():
		icons[id] = memories.get_memory(id).load_icon()
	view.set_marker_content(icons)
	for m in layout.milestones:
		if puzzle.reached.has(m.id):
			view.set_marker_lit(m.memory_id)
	view.show_state(puzzle.state, puzzle.trace)
	view.decor.ticked.connect(func(): audio.play("tick", randf_range(0.97, 1.03)))


## Apply a step in reference notation ("A+", "pin:B") through the normal
## player path. Handy for host-side scripted demos and tests.
func apply_step(step: String) -> void:
	var s := step.strip_edges()
	if s.begins_with("pin:") or s.begins_with("unpin:"):
		request_pin(layout.index_of(s.get_slice(":", 1)))
	else:
		request_turn(layout.index_of(s.substr(0, s.length() - 1)), 1 if s.ends_with("+") else -1)


func set_paused(p: bool) -> void:
	_paused = p
	view.interactive = not p


# ---------------------------------------------------------------------------

func _after_change() -> void:
	view.refresh(puzzle.state, puzzle.trace)
	hud.update_state(puzzle)
	view.clear_hint()
	_update_preview()


func _select(element: int) -> void:
	_selected = element
	view.set_selected(element)
	_update_preview()


func _on_hover(element: int) -> void:
	_hover = element
	_update_preview()


func _update_preview() -> void:
	var target := _hover if _hover >= 0 else _selected
	if target < 0 or puzzle.is_solved or not layout.elements[target].manual or puzzle.state.is_pinned(target):
		view.set_preview(null)
		return
	view.set_preview(puzzle.preview(target, 1))


func _refuse_message(element: int, reason: String, r: CausalClockMechanism.MoveResult = null) -> void:
	var ring_name := layout.elements[element].label if element >= 0 else "That"
	match reason:
		"pinned":
			hud.set_status("%s is pinned. Remove its pin to turn it." % ring_name, true)
		"fixed":
			hud.set_status("%s cannot be turned by hand — something else must drive it." % ring_name, true)
		"no_pins_left":
			hud.set_status("All %d pins are in use. Remove one first." % layout.pin_count, true)
		"not_pinnable":
			hud.set_status("%s has no pin socket." % ring_name, true)


func _on_chain_changed(old_depth: int, new_depth: int, trace: CausalClockMechanism.ChainTrace) -> void:
	if trace.sealed_lock >= 0:
		audio.play("chain_break", 0.8, -2.0, 0.3)
		hud.set_status("The chain reaches the heart — but that lock is sealed.", true, 4.0)
		view.play_chain_growth(old_depth, trace)
		return
	if new_depth > old_depth or trace.solved:
		view.play_chain_growth(old_depth, trace)
		# Rising chime: each ring deeper sounds a step higher.
		var semis := [0, 2, 4, 7, 9, 12, 14, 16, 19]
		var s: int = semis[mini(new_depth, semis.size() - 1)]
		audio.play("align_chime", pow(2.0, s / 12.0), -2.0, 0.25)
		if not trace.solved:
			var at := layout.elements[new_depth].label if new_depth < layout.element_count() else "the heart"
			hud.set_status("The chain reaches %s." % at, false, 2.5)
	elif new_depth < old_depth:
		audio.play("chain_break", 1.0, -4.0, 0.2)
		hud.set_status("The chain slips loose at %s." % layout.elements[new_depth].label, false, 2.5)


func _on_milestone(m: CausalClockLayout.MilestoneDef) -> void:
	milestone_reached.emit(m.id, m.memory_id)
	hud.unlock_memory(m.id)
	view.set_marker_lit(m.memory_id)
	match m.presentation:
		"toast":
			audio.play("milestone", 1.0, -2.0, 0.5)
			hud.show_toast(m.id)
		"card":
			_reveal_queue.append(m.id)
			if not puzzle.trace.solved:
				audio.play("milestone", 1.0, -2.0, 0.5)
				_pump_reveals()


func _on_solved(result_id: String) -> void:
	view.set_preview(null)
	view.play_solved()
	ambient.flare_up()
	audio.play("complete", 1.0, 0.0, 0.3)
	hud.set_status("The chain is whole.", false, 0.0)
	hud.hide_toast()
	puzzle_completed.emit(result_id)
	_done_pending = true
	get_tree().create_timer(final_reveal_delay).timeout.connect(func():
		if _reveal_queue.is_empty():
			_show_done()
		else:
			_pump_reveals())


func _pump_reveals() -> void:
	if reveal.is_open() or _reveal_queue.is_empty():
		return
	_open_memory_from_milestone(_reveal_queue.pop_front())


func _open_memory_from_milestone(milestone_id: String) -> void:
	for m in layout.milestones:
		if m.id == milestone_id:
			hud.hide_toast()
			reveal.open(memories.get_memory(m.memory_id))
			memory_revealed.emit(m.memory_id)
			audio.play("ui_click")
			return


func _on_reveal_closed(_memory_id: String) -> void:
	if not _reveal_queue.is_empty():
		_pump_reveals()
	elif _done_pending and puzzle.is_solved:
		_show_done()


func _show_done() -> void:
	if not _done_pending:
		return
	_done_pending = false
	menus.show_done(puzzle.move_count, _best, hints_used)


func _open_menu(which: String) -> void:
	if reveal.is_open():
		return
	audio.play("ui_click")
	if which == "notes":
		menus.show_notes()
	else:
		menus.show_pause()
	view.interactive = false


func _close_menus() -> void:
	menus.hide_menus()
	view.interactive = not _paused


func _exit() -> void:
	menus.hide_menus()
	exit_requested.emit()
	if standalone and exit_scene != "":
		get_tree().change_scene_to_file(exit_scene)


# ---------------------------------------------------------------------------
# Hint: shortest route to extend the chain by one ring, searched off-thread.
# ---------------------------------------------------------------------------

func request_hint() -> void:
	if is_input_blocked() or puzzle.is_solved or _hint_task >= 0:
		return
	hints_used += 1
	if _hint_solver != null and not _plan.is_empty():
		var key := _hint_solver.encode(puzzle.state)
		var at := _plan_keys.find(key)
		if at >= 0 and at < _plan.size():
			_show_hint_move(_plan[at])
			return
	_hint_solver = CausalClockSolver.new(layout)
	var start := puzzle.state.copy()
	var solver := _hint_solver
	var budget := hint_budget
	hud.set_status("The clock considers…", false, 0.0)
	_hint_task = WorkerThreadPool.add_task(func(): _hint_result = solver.hint(start, budget), false, "causal_clock_hint")


func _process(_dt: float) -> void:
	if _hint_task >= 0 and WorkerThreadPool.is_task_completed(_hint_task):
		WorkerThreadPool.wait_for_task_completion(_hint_task)
		_hint_task = -1
		_on_hint_ready(_hint_result)


func _on_hint_ready(result: Variant) -> void:
	if result == null or (result as PackedInt32Array).is_empty():
		hud.set_status("The mechanism keeps its secret this time. Try pinning a different ring.", false)
		_plan = PackedInt32Array()
		return
	_plan = result
	_plan_keys = PackedInt64Array()
	var k := _hint_solver.encode(puzzle.state)
	for mv in _plan:
		_plan_keys.append(k)
		k = _hint_solver.successor(k, mv)
	_show_hint_move(_plan[0])


func _show_hint_move(mv: int) -> void:
	if mv >= CausalClockSolver.PIN_BASE:
		var el := mv - CausalClockSolver.PIN_BASE
		var pinned := puzzle.state.is_pinned(el)
		view.set_hint(el, 0, true)
		hud.set_status("Hint: %s %s." % ["remove the pin from" if pinned else "pin", layout.elements[el].label], false, 6.0)
	else:
		var el2 := mv / 2
		var dir := 1 if mv % 2 == 0 else -1
		view.set_hint(el2, dir, false)
		_select(el2)
		hud.set_status("Hint: turn %s %s." % [layout.elements[el2].label, "clockwise" if dir > 0 else "anticlockwise"], false, 6.0)


# ---------------------------------------------------------------------------
# Keyboard
# ---------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed:
		return
	var k := event as InputEventKey
	if reveal != null and reveal.is_open():
		return
	if menus != null and menus.is_open():
		if k.keycode == KEY_ESCAPE:
			_close_menus()
			get_viewport().set_input_as_handled()
		return
	if puzzle == null:
		return
	var handled := true
	match k.keycode:
		KEY_ESCAPE, KEY_P:
			_open_menu("pause")
		KEY_LEFT, KEY_A, KEY_Q:
			request_turn(_selected, -1)
		KEY_RIGHT, KEY_D, KEY_E:
			request_turn(_selected, 1)
		KEY_UP, KEY_W:
			_cycle_selection(-1)
		KEY_DOWN, KEY_S:
			_cycle_selection(1)
		KEY_SPACE, KEY_L:
			if not k.echo:
				request_pin(_selected)
		KEY_Z, KEY_BACKSPACE:
			undo()
		KEY_R:
			if not k.echo:
				reset()
		KEY_H:
			if not k.echo:
				request_hint()
		KEY_N, KEY_F1:
			_open_menu("notes")
		KEY_M:
			audio.set_muted(not audio.muted)
			hud.set_status("Sound off." if audio.muted else "Sound on.", false, 1.5)
		_:
			if k.keycode >= KEY_1 and k.keycode <= KEY_9:
				var idx := k.keycode - KEY_1
				if idx < layout.element_count() and layout.elements[idx].manual:
					_select(idx)
			else:
				handled = false
	if handled:
		get_viewport().set_input_as_handled()


func _cycle_selection(step: int) -> void:
	var n := layout.element_count()
	var i := _selected
	for _k in n:
		i = posmod(i + step, n)
		if layout.elements[i].manual:
			_select(i)
			audio.play("ui_click", 1.0, -8.0)
			return


func _show_fatal(msg: String) -> void:
	var l := Label.new()
	l.text = msg
	l.position = Vector2(40, 40)
	add_child(l)
