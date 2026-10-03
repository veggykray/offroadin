extends Node2D
## Cheap atmospheric backdrop for the test scene. Not part of the door system.

@export var size := Vector2(1920, 1080)
@export var floor_y := 990.0
@export var door_x := 960.0

var _t := 0.0
var _flicker := 1.0


func _process(delta: float) -> void:
	_t += delta
	# An old fluorescent-ish lamp: steady, with the occasional stutter.
	var target := 1.0
	if fmod(_t, 7.3) < 0.18 or fmod(_t + 2.1, 11.7) < 0.09:
		target = 0.72 + 0.2 * sin(_t * 60.0)
	_flicker = lerpf(_flicker, target, delta * 25.0)
	queue_redraw()


func _draw() -> void:
	var w := size.x
	# Wall
	_vgrad(Rect2(0, 0, w, floor_y), Color(0.09, 0.1, 0.085), Color(0.16, 0.165, 0.13))
	# Wallpaper stripes
	var x := 0.0
	var i := 0
	while x < w:
		draw_rect(Rect2(x, 0, 18, floor_y - 250), Color(0, 0, 0, 0.09 if i % 2 == 0 else 0.03))
		x += 46.0
		i += 1
	# Picture rail
	draw_rect(Rect2(0, 118, w, 8), Color(0.07, 0.055, 0.04))
	# Wainscot
	_vgrad(Rect2(0, floor_y - 250, w, 250), Color(0.12, 0.08, 0.055), Color(0.07, 0.045, 0.03))
	draw_rect(Rect2(0, floor_y - 256, w, 12), Color(0.18, 0.12, 0.08))
	x = 30.0
	while x < w:
		draw_rect(Rect2(x, floor_y - 220, 150, 180), Color(0, 0, 0, 0.18), false, 3.0)
		x += 190.0
	draw_rect(Rect2(0, floor_y - 22, w, 22), Color(0.05, 0.035, 0.025))
	# Floor
	_vgrad(Rect2(0, floor_y, w, size.y - floor_y), Color(0.13, 0.11, 0.09), Color(0.05, 0.04, 0.035))
	for k in 25:
		var fx := -300.0 + k * 110.0
		draw_line(Vector2(fx, floor_y), Vector2(door_x + (fx - door_x) * 1.6, size.y), Color(0, 0, 0, 0.25), 2.0)
	draw_line(Vector2(0, floor_y + 34), Vector2(w, floor_y + 34), Color(0, 0, 0, 0.22), 2.0)
	# Waiting chairs
	for cx in [230.0, 330.0, 430.0, 1490.0, 1590.0, 1690.0]:
		_chair(Vector2(cx, floor_y))
	# Clock with no hands
	var c := Vector2(1500, 300)
	draw_circle(c, 46, Color(0.75, 0.72, 0.6))
	draw_arc(c, 46, 0, TAU, 48, Color(0.12, 0.08, 0.05), 6.0, true)
	for h in 12:
		var a := h * TAU / 12.0
		draw_line(c + Vector2(cos(a), sin(a)) * 34, c + Vector2(cos(a), sin(a)) * 41, Color(0.15, 0.12, 0.1), 3.0)
	# Lamp + light cone over the door
	var lamp := Vector2(door_x, 14)
	draw_line(Vector2(door_x, 0), lamp, Color(0.05, 0.05, 0.05), 3.0)
	draw_colored_polygon(PackedVector2Array([lamp + Vector2(-26, 0), lamp + Vector2(26, 0), lamp + Vector2(44, 30), lamp + Vector2(-44, 30)]), Color(0.12, 0.13, 0.1))
	draw_circle(lamp + Vector2(0, 31), 12, Color(1.0, 0.92, 0.7, _flicker))
	var a := 0.15 * _flicker
	draw_polygon(PackedVector2Array([lamp + Vector2(-40, 30), lamp + Vector2(40, 30), Vector2(door_x + 420, floor_y + 40), Vector2(door_x - 420, floor_y + 40)]),
		PackedColorArray([Color(1, 0.9, 0.65, a), Color(1, 0.9, 0.65, a), Color(1, 0.9, 0.65, 0.0), Color(1, 0.9, 0.65, 0.0)]))


func _chair(base: Vector2) -> void:
	var col := Color(0.06, 0.05, 0.045)
	draw_rect(Rect2(base + Vector2(-34, -92), Vector2(68, 12)), col)
	draw_rect(Rect2(base + Vector2(-34, -170), Vector2(10, 90)), col)
	draw_rect(Rect2(base + Vector2(-34, -170), Vector2(60, 10)), col)
	draw_line(base + Vector2(-30, -82), base + Vector2(-34, 0), col, 5.0)
	draw_line(base + Vector2(30, -82), base + Vector2(34, 0), col, 5.0)


func _vgrad(r: Rect2, top: Color, bottom: Color) -> void:
	draw_polygon(PackedVector2Array([r.position, r.position + Vector2(r.size.x, 0), r.end, r.position + Vector2(0, r.size.y)]),
		PackedColorArray([top, top, bottom, bottom]))
