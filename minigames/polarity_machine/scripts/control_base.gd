extends Node2D
## Base for a physical machine control with discrete detents 0..max_value.
## Handles mouse drag, click-to-jump, mouse wheel, notchy snapping and the
## springy settle. Subclasses describe their shape: _hit_test(),
## _value_from_point() and _draw(). Values are never shown as numbers; the
## handle's position is the readout.

signal value_changed(new_value: int, old_value: int)
signal detent_crossed(value: int)

var max_value: int = 3
var value: int = 0
## Visual handle position in [0, max_value]; follows the hand, springs to detents.
var display: float = 0.0:
	set(v):
		display = v
		queue_redraw()
var dragging := false
var hovered := false
var input_enabled := true
var _jolt := 0.0
var _time := 0.0
var _tween: Tween


func _process(delta: float) -> void:
	_time += delta
	_jolt = maxf(0.0, _jolt - delta * 3.5)
	if dragging and not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_release()
	queue_redraw()


## Sets the detent. animate = spring there; emit = fire the signals.
func set_value(v: int, animate := true, emit := true) -> void:
	v = clampi(v, 0, max_value)
	var old := value
	value = v
	if animate:
		_spring()
	else:
		if _tween:
			_tween.kill()
		display = float(v)
	if v != old:
		_jolt = 1.0
		if emit:
			detent_crossed.emit(v)
			value_changed.emit(v, old)


func step(direction: int) -> void:
	set_value(value + direction)


func _spring() -> void:
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "display", float(value), 0.34).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or not is_visible_in_tree():
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		var p := _local(event)
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and _hit_test(p):
				dragging = true
				if _tween:
					_tween.kill()
				_drag_to(p)
				get_viewport().set_input_as_handled()
			elif not mb.pressed and dragging:
				_release()
				get_viewport().set_input_as_handled()
		elif mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			if _hit_test(p):
				step(1 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else -1)
				get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion:
		var p2 := _local(event)
		hovered = dragging or _hit_test(p2)
		if dragging:
			_drag_to(p2)
			get_viewport().set_input_as_handled()


## Event position in this node's space (works with scaling and injected input).
func _local(event: InputEvent) -> Vector2:
	return (make_input_local(event) as InputEventMouse).position


func _release() -> void:
	dragging = false
	_spring()


func _drag_to(p: Vector2) -> void:
	var f := clampf(_value_from_point(p), 0.0, float(max_value))
	var n := roundi(f)
	display = lerpf(f, float(n), 0.55)
	if n != value:
		var old := value
		value = n
		_jolt = 1.0
		detent_crossed.emit(n)
		value_changed.emit(n, old)


func _hit_test(_p: Vector2) -> bool:
	return false


func _value_from_point(_p: Vector2) -> float:
	return display


# --- Shared drawing helpers -------------------------------------------------------------------

const BRASS := Color(0.84, 0.64, 0.30)
const KNOB := Color(0.42, 0.18, 0.1)


static func dir_from_up(a: float) -> Vector2:
	return Vector2(sin(a), -cos(a))


static func angle_from_up(p: Vector2) -> float:
	return atan2(p.x, -p.y)


func knob(p: Vector2, r: float) -> void:
	draw_circle(p + Vector2(2, 3), r, Color(0, 0, 0, 0.45))
	draw_circle(p, r, KNOB.darkened(0.3))
	draw_circle(p - Vector2(r, r) * 0.12, r * 0.85, KNOB.lightened(0.1 + 0.25 * float(hovered)))
	draw_circle(p - Vector2(r, r) * 0.35, r * 0.32, Color(1.0, 0.85, 0.7, 0.55))


func hover_ring(c: Vector2, r: float) -> void:
	if hovered or dragging:
		draw_arc(c, r, 0, TAU, 48, Color(1.0, 0.9, 0.6, 0.35 + 0.15 * sin(_time * 5.0)), 2.5, true)
