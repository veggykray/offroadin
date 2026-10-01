extends Node2D
## Base for one physical machine control that sets a five-step continuum (0..4).
##
## Handles mouse drag, mouse wheel, detent snapping and the springy handle animation.
## Subclasses only describe their shape: _hit_test(), _value_from_point() and _draw().
## Values are never shown as numbers; the handle position is the readout.

signal value_changed(new_value: int, old_value: int)
signal detent_crossed(value: int)
signal grabbed()
signal released()

const MAX_VALUE := 4

## Current detent (0..4).
var value: int = 2
## Visual position of the handle in [0, 4]. Follows the hand while dragging, springs to detents.
var display: float = 2.0:
	set(v):
		display = v
		queue_redraw()
var dragging := false
var hovered := false
var input_enabled := true

## Room state fed in by the machine body, so each control can frost, glow, tarnish and darken.
var ambient := 1.0  # brightness multiplier from room light
var heat := 2.0  # smoothed temperature level 0..4
var wear := 2.0  # smoothed age level 0..4

var _jolt := 0.0  # 1 → 0 after each detent click; used for a little mechanical kick
var _time := 0.0
var _tween: Tween


func _ready() -> void:
	display = float(value)


func _process(delta: float) -> void:
	_time += delta
	_jolt = maxf(0.0, _jolt - delta * 3.5)
	# Mouse released outside the window: make sure we let go.
	if dragging and not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		_release()
	queue_redraw()


## Sets the detent. animate = spring the handle there; emit = fire value_changed / detent_crossed.
func set_value(v: int, animate := true, emit := true) -> void:
	v = clampi(v, 0, MAX_VALUE)
	var old := value
	value = v
	if animate:
		_spring_to_value()
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


func _spring_to_value() -> void:
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "display", float(value), 0.34) \
			.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or not is_visible_in_tree():
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		var p := get_local_mouse_position()
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and _hit_test(p):
				dragging = true
				if _tween:
					_tween.kill()
				grabbed.emit()
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
		var p2 := get_local_mouse_position()
		hovered = dragging or _hit_test(p2)
		if dragging:
			_drag_to(p2)
			get_viewport().set_input_as_handled()


func _release() -> void:
	dragging = false
	_spring_to_value()
	released.emit()


func _drag_to(p: Vector2) -> void:
	var f := clampf(_value_from_point(p), 0.0, float(MAX_VALUE))
	var n := roundi(f)
	# Notchy feel: the handle is pulled toward the nearest detent while you drag.
	display = lerpf(f, float(n), 0.5)
	if n != value:
		var old := value
		value = n
		_jolt = 1.0
		detent_crossed.emit(n)
		value_changed.emit(n, old)


# --- Overridden by each control -----------------------------------------------------------

func _hit_test(_p: Vector2) -> bool:
	return false


func _value_from_point(_p: Vector2) -> float:
	return display


# --- Helpers for subclasses -----------------------------------------------------------------

## Ambient-shaded colour (machine darkens with the room, but never below readability).
func sh(c: Color) -> Color:
	return Color(c.r * ambient, c.g * ambient, c.b * ambient, c.a)


## Unit vector for an angle measured clockwise from straight up.
static func dir_from_up(a: float) -> Vector2:
	return Vector2(sin(a), -cos(a))


## Angle of p measured clockwise from straight up.
static func angle_from_up(p: Vector2) -> float:
	return atan2(p.x, -p.y)


## Brass that tarnishes with age: bright → brown → verdigris.
func brass(k := 1.0) -> Color:
	var c := Color(0.86, 0.66, 0.30).lerp(Color(0.62, 0.48, 0.26), smoothstep(1.5, 3.2, wear))
	c = c.lerp(Color(0.40, 0.46, 0.34), smoothstep(3.0, 4.0, wear) * 0.6)
	return sh(c * Color(k, k, k, 1.0))


func iron(k := 1.0) -> Color:
	return sh(Color(0.17, 0.14, 0.16) * Color(k, k, k, 1.0))
