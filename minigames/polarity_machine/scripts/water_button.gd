extends Node2D
## WATER — the blue illuminated button. Each press depresses it, lights it,
## and asks the machine to spray the plant once.

signal pressed

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const R := 26.0

var input_enabled := true
var hovered := false
## Set by the root: false when the reservoir is empty (button glows weakly).
var has_water := true
var _press := 0.0   # 1 → 0 after a press (button depressed + bright)
var _fail := 0.0    # 1 → 0 after pressing with an empty tank
var _time := 0.0


func press(ok: bool) -> void:
	if ok:
		_press = 1.0
	else:
		_fail = 1.0
		_press = 0.6


func _process(dt: float) -> void:
	_time += dt
	_press = maxf(0.0, _press - dt * 2.2)
	_fail = maxf(0.0, _fail - dt * 1.8)
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or not is_visible_in_tree():
		return
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		var p := (make_input_local(event) as InputEventMouse).position
		if mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed and p.length() < R + 8:
			pressed.emit()
			get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion:
		hovered = (make_input_local(event) as InputEventMouse).position.length() < R + 8


func _draw() -> void:
	var brass := Color(0.84, 0.64, 0.30)
	draw_circle(Vector2(3, 4), R + 6, Color(0, 0, 0, 0.45))
	draw_circle(Vector2.ZERO, R + 6, brass.darkened(0.4))
	draw_circle(Vector2.ZERO, R + 2, brass)
	draw_circle(Vector2.ZERO, R - 3, Color(0.05, 0.06, 0.1))
	var depth := smoothstep(0.0, 0.35, _press) * 3.0
	var on := 0.35 + 0.15 * sin(_time * 2.0) + 0.65 * _press
	if not has_water:
		on *= 0.45
	var base := Color(0.15, 0.45, 0.95).lerp(Color(0.95, 0.4, 0.2), _fail)
	var lit := base.lerp(Color(0.75, 0.92, 1.0), clampf(on - 0.3, 0.0, 1.0))
	for k in 3:
		draw_circle(Vector2.ZERO, R + 6 + k * 8, Color(lit.r, lit.g, lit.b, 0.12 * on))
	var c := Vector2(0, depth)
	draw_circle(c, R - 5, base.darkened(0.3))
	draw_circle(c, R - 8, lit)
	# Water-drop glyph.
	var drop := U.drop(c, 7.0)
	draw_colored_polygon(drop, Color(1, 1, 1, 0.9))
	draw_arc(c, R - 9, -2.6, -1.2, 10, Color(1, 1, 1, 0.5), 2.0, true)
	if hovered:
		draw_arc(Vector2.ZERO, R + 9, 0, TAU, 32, Color(0.7, 0.9, 1.0, 0.5 + 0.2 * sin(_time * 5.0)), 2.0, true)
