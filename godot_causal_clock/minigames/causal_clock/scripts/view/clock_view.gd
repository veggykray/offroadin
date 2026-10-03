class_name CausalClockView
extends Node2D
## The whole artifact on screen: builds every visual part for a layout,
## turns player pointer input into requests, and plays back logic results
## as animation. It never changes puzzle state itself — the game controller
## owns the CausalClockPuzzle and calls into this view.

signal rotate_requested(element: int, dir: int)
signal pin_toggle_requested(element: int)
signal select_requested(element: int)
signal hover_changed(element: int)
## The player tried to grab something that cannot move (e.g. the heart).
signal grab_refused(element: int, reason: String)

var layout: CausalClockLayout
var geo: CausalClockGeometry
var interactive: bool = true
## Title-screen mode: rings drift on their own, no input.
var attract: bool = false

var rings: Array[CausalClockElementView] = []
var couplings: Array[CausalClockCouplingView] = []
var hub: CausalClockHubView
var rail: CausalClockPinRailView
var overlay: CausalClockOverlay
var backdrop: CausalClockBackdrop
var decor: CausalClockDecorMechanism

var _hover: int = -1
var _drag_el: int = -1
var _drag_last: float = 0.0
var _drag_acc: float = 0.0
var _dragged: bool = false
var _parallax: Vector2 = Vector2.ZERO
var _attract_t: float = 0.0
var _solved_t: float = -1.0


func setup(p_layout: CausalClockLayout) -> void:
	for ch in get_children():
		ch.queue_free()
	rings.clear()
	couplings.clear()
	layout = p_layout
	geo = CausalClockGeometry.new(layout)

	decor = CausalClockDecorMechanism.new()
	add_child(decor)
	decor.build(geo.bezel_outer)
	backdrop = CausalClockBackdrop.new()
	add_child(backdrop)
	backdrop.setup(layout, geo)
	for i in layout.ring_count:
		var rv := CausalClockRingView.new()
		add_child(rv)
		rv.setup(layout, i, geo)
		rings.append(rv)
	hub = CausalClockHubView.new()
	add_child(hub)
	hub.setup(layout, layout.hub_index(), geo)
	rings.append(hub)
	for c in layout.couplings:
		var cv := CausalClockCouplingView.new()
		add_child(cv)
		cv.setup(layout, c, geo)
		couplings.append(cv)
	rail = CausalClockPinRailView.new()
	add_child(rail)
	rail.setup(layout, geo)
	overlay = CausalClockOverlay.new()
	add_child(overlay)
	overlay.setup(layout, geo)


## Total radius the artifact needs on screen (for fitting to the viewport).
func visual_radius() -> float:
	return geo.bezel_outer + 20.0


func set_marker_content(icons: Dictionary) -> void:
	for i in layout.ring_count:
		(rings[i] as CausalClockRingView).marker_icons = icons
		rings[i].queue_redraw()


func set_marker_lit(memory_id: String) -> void:
	for i in layout.ring_count:
		var rv := rings[i] as CausalClockRingView
		rv.marker_lit[memory_id] = true
		rv.queue_redraw()


# ---------------------------------------------------------------------------
# State -> visuals
# ---------------------------------------------------------------------------

## Show a state without animation (start, restart).
func show_state(state: CausalClockState, trace: CausalClockMechanism.ChainTrace) -> void:
	for i in rings.size():
		rings[i].snap_to(state.positions[i])
	var angles := display_angles()
	for cv in couplings:
		cv.reset_follow(angles)
	for i in layout.element_count():
		rail.set_pinned(i, state.is_pinned(i), true)
		rings[i].pinned = state.is_pinned(i)
	refresh(state, trace)


## Animate the result of a successful turn: the turned ring first, then each
## driven ring a beat later, so cause visibly precedes effect.
func play_turn(result: CausalClockMechanism.MoveResult) -> void:
	for i in result.deltas.size():
		if result.deltas[i] != 0:
			rings[i].queue_turn(result.deltas[i], maxf(0.0, result.wave[i]) * 0.07)
	for ci in result.transmitted:
		couplings[ci].flash = 1.0
	for ci in result.slipped:
		couplings[ci].slip = 1.0
	decor.kick(0.6)


## Animate back to a state (undo / reset): every ring winds the short way.
func play_settle(state: CausalClockState) -> void:
	for i in rings.size():
		rings[i].settle_to(state.positions[i], 0.0)
	decor.kick(0.4)


func play_refusal(result: CausalClockMechanism.MoveResult) -> void:
	if result.element >= 0:
		rings[result.element].shake(0.06)
	match result.reason:
		"pinned":
			rail.flash(result.element)


func play_pin_refusal(element: int) -> void:
	rail.flash(element)
	if element >= 0:
		rings[element].shake(0.02)


## Update pins, cam lamps, chain highlighting from the logical state.
func refresh(state: CausalClockState, trace: CausalClockMechanism.ChainTrace) -> void:
	var engaged := CausalClockMechanism.engagement(layout, state.positions)
	for i in couplings.size():
		if couplings[i].engaged != engaged[i]:
			couplings[i].engaged = engaged[i]
			couplings[i].queue_redraw()
	for i in layout.element_count():
		var p := state.is_pinned(i)
		if rail.pinned[i] != int(p):
			rail.set_pinned(i, p)
		rings[i].pinned = p
		rings[i].modulate = Color(0.82, 0.82, 0.88) if p else Color.WHITE
	_apply_trace(trace)


func _apply_trace(trace: CausalClockMechanism.ChainTrace) -> void:
	var per_ring := {}
	var offsets := {}
	var dist := 0.0
	for link in trace.links:
		if not per_ring.has(link.x):
			per_ring[link.x] = []
			offsets[link.x] = {}
		per_ring[link.x].append(link.y)
		offsets[link.x][link.y] = dist
		dist += CausalClockDraw.polyline_length((rings[link.x] as CausalClockRingView).paths[link.y])
	for i in layout.ring_count:
		(rings[i] as CausalClockRingView).set_linked(per_ring.get(i, []), offsets.get(i, {}))
	hub.set_linked_socket(trace.socket if trace.solved else -1, trace.sealed_lock)
	backdrop.set_entry_lit(not trace.links.is_empty())
	overlay.break_element = trace.break_element
	overlay.break_angle = trace.break_angle


## Burst of light at every newly connected junction.
func play_chain_growth(old_depth: int, trace: CausalClockMechanism.ChainTrace) -> void:
	for k in range(old_depth + 1, trace.junction_angles.size()):
		var e := k  # junction k sits on the outer edge of element k
		var r := geo.r_out[e] if e < layout.ring_count else geo.hub_radius
		var at := CausalClockGeometry.point(trace.junction_angles[k], r + CausalClockGeometry.GAP * 0.5)
		overlay.spark(at, CausalClockPalette.GLOW, 4)


func play_solved() -> void:
	_solved_t = 0.0
	decor.kick(3.0)
	for i in layout.ring_count:
		var rv := rings[i] as CausalClockRingView
		var tw := create_tween()
		tw.tween_interval(0.12 * i)
		tw.tween_property(rv, "solved_glow", 1.0, 0.6).set_trans(Tween.TRANS_SINE)
	var tw2 := create_tween()
	tw2.tween_interval(0.12 * layout.ring_count)
	tw2.tween_property(hub, "bloom", 1.0, 1.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var tw3 := create_tween()
	tw3.tween_property(overlay, "solved", 1.0, 1.4)


func set_preview(result: CausalClockMechanism.MoveResult) -> void:
	overlay.preview = result
	var hot := {}
	if result != null and result.ok:
		for ci in result.transmitted:
			hot[ci] = true
	for i in couplings.size():
		couplings[i].highlight = 1.0 if hot.has(i) else 0.0
		couplings[i].queue_redraw()


func set_selected(element: int) -> void:
	overlay.selected = element
	for i in rings.size():
		rings[i].selected = i == element


func set_hint(element: int, dir: int, pin: bool) -> void:
	overlay.hint_element = element if not pin else -1
	overlay.hint_dir = dir
	rail.set_hint(element if pin else -1)


func clear_hint() -> void:
	set_hint(-1, 0, false)


func display_angles() -> PackedFloat32Array:
	var a := PackedFloat32Array()
	for r in rings:
		a.append(r.rotation)
	return a


func any_moving() -> bool:
	for r in rings:
		if r.is_moving():
			return true
	return false


# ---------------------------------------------------------------------------

func _process(dt: float) -> void:
	if layout == null:
		return
	var angles := display_angles()
	for cv in couplings:
		cv.follow(angles)
	# Gentle parallax: the background machinery drifts against the pointer.
	var vp := get_viewport_rect().size
	var m := get_viewport().get_mouse_position()
	var target := ((m - vp * 0.5) / vp) * -26.0
	_parallax = _parallax.lerp(target, clampf(dt * 2.0, 0, 1))
	decor.position = _parallax
	backdrop.position = _parallax * 0.12
	if attract:
		_attract_t += dt
		for i in layout.ring_count:
			var r := rings[i]
			r.give = sin(_attract_t * (0.13 + 0.04 * i) + i * 1.7) * 0.9
	if _solved_t >= 0.0:
		_solved_t += dt


func element_at_local(local: Vector2) -> int:
	return geo.element_at(local.length())


func _unhandled_input(event: InputEvent) -> void:
	if layout == null or attract or not interactive:
		return
	if event is InputEventMouseMotion:
		var local := (make_input_local(event) as InputEventMouse).position
		var el := element_at_local(local)
		var sock := rail.socket_at(local)
		var h := sock if sock >= 0 else el
		if h != _hover and _drag_el < 0:
			_hover = h
			overlay.hovered = h
			hover_changed.emit(h)
		if _drag_el >= 0:
			_update_drag(local)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		var local2 := (make_input_local(event) as InputEventMouse).position
		var el2 := element_at_local(local2)
		var sock2 := rail.socket_at(local2)
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				if sock2 >= 0:
					pin_toggle_requested.emit(sock2)
					get_viewport().set_input_as_handled()
				elif el2 >= 0:
					if not layout.elements[el2].manual:
						grab_refused.emit(el2, "fixed")
						rings[el2].shake(0.03)
					else:
						_drag_el = el2
						_drag_last = CausalClockGeometry.angle_of(local2)
						_drag_acc = 0.0
						_dragged = false
					get_viewport().set_input_as_handled()
			elif _drag_el >= 0:
				if not _dragged:
					select_requested.emit(_drag_el)
				rings[_drag_el].give = 0.0
				_drag_el = -1
				get_viewport().set_input_as_handled()
		elif mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
			var target := sock2 if sock2 >= 0 else el2
			if target >= 0:
				pin_toggle_requested.emit(target)
				get_viewport().set_input_as_handled()
		elif mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			if el2 >= 0:
				select_requested.emit(el2)
				rotate_requested.emit(el2, 1 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else -1)
				get_viewport().set_input_as_handled()


func _update_drag(local: Vector2) -> void:
	var a := CausalClockGeometry.angle_of(local)
	var d := wrapf(a - _drag_last, -180.0, 180.0)
	_drag_last = a
	_drag_acc += d
	var step := layout.elements[_drag_el].step_degrees()
	if absf(_drag_acc) > 3.0:
		_dragged = true
	if absf(_drag_acc) >= step * 0.5:
		var dir := 1 if _drag_acc > 0 else -1
		_drag_acc -= dir * step
		rotate_requested.emit(_drag_el, dir)
	# Visible "give" before a step commits, clamped so it never lies.
	rings[_drag_el].give = deg_to_rad(clampf(_drag_acc, -step * 0.35, step * 0.35))


## Called when the drag target refused to turn: drop the drag.
func cancel_drag() -> void:
	if _drag_el >= 0:
		rings[_drag_el].give = 0.0
		_drag_acc = 0.0
