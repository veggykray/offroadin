extends Node2D
## Cheap atmospheric backdrop for the test scene: a marble lobby with wall
## lanterns and a polished checkered floor. Not part of the door system.

@export var size := Vector2(1920, 1080)
@export var floor_y := 990.0
@export var door_x := 960.0
## Half-width of the marble surround around the door.
@export var surround := 330.0

var _t := 0.0
var _flicker := [1.0, 1.0]
var _veins: Array[PackedVector2Array] = []
var _glow: GradientTexture2D


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	for i in 46:
		var p := Vector2(rng.randf_range(0, size.x), rng.randf_range(0, floor_y))
		var line := PackedVector2Array([p])
		var a := rng.randf_range(0, TAU)
		for k in rng.randi_range(4, 9):
			a += rng.randf_range(-0.9, 0.9)
			p += Vector2(cos(a), sin(a)) * rng.randf_range(14, 40)
			line.append(p)
		_veins.append(line)
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 0.78, 0.4, 0.55), Color(1, 0.7, 0.3, 0.0)])
	_glow = GradientTexture2D.new()
	_glow.gradient = g
	_glow.fill = GradientTexture2D.FILL_RADIAL
	_glow.fill_from = Vector2(0.5, 0.5)
	_glow.fill_to = Vector2(1.0, 0.5)
	_glow.width = 128
	_glow.height = 128


func _process(delta: float) -> void:
	_t += delta
	for i in 2:
		var target := 0.9 + 0.1 * sin(_t * (7.0 + i * 3.1)) * sin(_t * (2.3 + i))
		_flicker[i] = lerpf(_flicker[i], target, delta * 12.0)
	queue_redraw()


func _draw() -> void:
	var w := size.x
	# Marble wall
	_vgrad(Rect2(0, 0, w, floor_y), Color(0.36, 0.32, 0.27), Color(0.24, 0.21, 0.18))
	for v in _veins:
		draw_polyline(v, Color(0.12, 0.1, 0.08, 0.35), 1.6, true)
		draw_polyline(v, Color(0.8, 0.66, 0.4, 0.12), 0.8, true)
	# Darker recessed bays away from the door
	for side: float in [-1.0, 1.0]:
		var x0 := door_x + side * (surround + 70.0)
		var r := Rect2(minf(x0, x0 + side * 900.0), 60, 900, floor_y - 60)
		draw_rect(r, Color(0.05, 0.04, 0.03, 0.35))
	# Pilasters either side of the door
	for side: float in [-1.0, 1.0]:
		var px := door_x + side * surround
		var r := Rect2(px - 46, 60, 92, floor_y - 60)
		_hgrad(r, Color(0.3, 0.27, 0.23), Color(0.48, 0.43, 0.36), Color(0.22, 0.19, 0.16))
		draw_rect(Rect2(px - 58, 150, 116, 26), Color(0.42, 0.37, 0.3))   # capital
		draw_rect(Rect2(px - 58, 150, 116, 4), Color(0.85, 0.66, 0.32, 0.8))
		draw_rect(Rect2(px - 54, floor_y - 60, 108, 60), Color(0.3, 0.26, 0.22))  # base
		draw_line(Vector2(px - 46, 176), Vector2(px - 46, floor_y - 60), Color(0.82, 0.62, 0.3, 0.5), 2.0)
		draw_line(Vector2(px + 46, 176), Vector2(px + 46, floor_y - 60), Color(0.82, 0.62, 0.3, 0.5), 2.0)
	# Cornice
	_vgrad(Rect2(0, 0, w, 60), Color(0.18, 0.15, 0.12), Color(0.34, 0.3, 0.25))
	draw_rect(Rect2(0, 56, w, 4), Color(0.85, 0.66, 0.32, 0.7))
	# Lanterns
	for i in 2:
		var lx := door_x + (-1.0 if i == 0 else 1.0) * (surround + 170.0)
		_lantern(Vector2(lx, 470), _flicker[i])
	# Furniture silhouettes
	_armchair(Vector2(170, floor_y))
	_trunk(Vector2(1720, floor_y))
	_palm(Vector2(330, floor_y))
	_palm(Vector2(1590, floor_y))
	# Polished checkered floor
	_vgrad(Rect2(0, floor_y, w, size.y - floor_y), Color(0.13, 0.13, 0.16), Color(0.05, 0.05, 0.07))
	var rows := 4
	for r in rows:
		var y0 := floor_y + pow(float(r) / rows, 1.4) * (size.y - floor_y)
		var y1 := floor_y + pow(float(r + 1) / rows, 1.4) * (size.y - floor_y)
		var s0 := 1.0 + r * 0.35
		var s1 := 1.0 + (r + 1) * 0.35
		var tile := 120.0
		for c in range(-12, 13):
			if (c + r) % 2 != 0:
				continue
			var a := door_x + c * tile * s0
			var b := door_x + (c + 1) * tile * s0
			var d := door_x + (c + 1) * tile * s1
			var e := door_x + c * tile * s1
			draw_colored_polygon(PackedVector2Array([Vector2(a, y0), Vector2(b, y0), Vector2(d, y1), Vector2(e, y1)]), Color(0.72, 0.66, 0.55, 0.22))
	# Reflections of the lanterns and the door's blue light
	for i in 2:
		var lx := door_x + (-1.0 if i == 0 else 1.0) * (surround + 170.0)
		draw_texture_rect(_glow, Rect2(lx - 40, floor_y + 4, 80, 80), false, Color(1, 1, 1, 0.5 * _flicker[i]))
	draw_colored_polygon(PackedVector2Array([Vector2(door_x - 240, floor_y), Vector2(door_x + 240, floor_y), Vector2(door_x + 300, size.y), Vector2(door_x - 300, size.y)]), Color(0.25, 0.35, 0.75, 0.12))
	# Cool spotlight over the door
	draw_circle(Vector2(door_x, 84), 18, Color(0.85, 0.92, 1.0, 0.9))
	draw_polygon(PackedVector2Array([Vector2(door_x - 30, 90), Vector2(door_x + 30, 90), Vector2(door_x + 330, floor_y), Vector2(door_x - 330, floor_y)]),
		PackedColorArray([Color(0.7, 0.8, 1, 0.16), Color(0.7, 0.8, 1, 0.16), Color(0.7, 0.8, 1, 0), Color(0.7, 0.8, 1, 0)]))


func _lantern(p: Vector2, f: float) -> void:
	draw_texture_rect(_glow, Rect2(p - Vector2(170, 170), Vector2(340, 340)), false, Color(1, 1, 1, 0.75 * f))
	var gold := Color(0.55, 0.4, 0.15)
	draw_line(p + Vector2(0, 70), p + Vector2(0, 100), gold, 4.0)          # bracket
	draw_line(p + Vector2(0, 100), p + Vector2(18, 112), gold, 3.0)
	draw_colored_polygon(PackedVector2Array([p + Vector2(-26, -50), p + Vector2(26, -50), p + Vector2(20, 50), p + Vector2(-20, 50)]), Color(1.0, 0.82, 0.45) * Color(f, f, f))
	draw_polyline(PackedVector2Array([p + Vector2(-26, -50), p + Vector2(26, -50), p + Vector2(20, 50), p + Vector2(-20, 50), p + Vector2(-26, -50)]), Color(0.12, 0.08, 0.04), 4.0)
	draw_line(p + Vector2(0, -50), p + Vector2(0, 50), Color(0.12, 0.08, 0.04), 2.0)
	draw_colored_polygon(PackedVector2Array([p + Vector2(-34, -50), p + Vector2(34, -50), p + Vector2(0, -82)]), Color(0.1, 0.07, 0.04))
	draw_rect(Rect2(p + Vector2(-24, 50), Vector2(48, 12)), Color(0.1, 0.07, 0.04))
	draw_circle(p + Vector2(0, -88), 6, Color(0.1, 0.07, 0.04))


func _armchair(b: Vector2) -> void:
	var c := Color(0.07, 0.04, 0.03)
	draw_rect(Rect2(b + Vector2(-70, -190), Vector2(140, 110)), Color(0.35, 0.08, 0.06))
	draw_rect(Rect2(b + Vector2(-80, -100), Vector2(160, 40)), Color(0.4, 0.1, 0.07))
	draw_rect(Rect2(b + Vector2(-90, -130), Vector2(24, 80)), c)
	draw_rect(Rect2(b + Vector2(66, -130), Vector2(24, 80)), c)
	draw_line(b + Vector2(-70, -60), b + Vector2(-74, 0), c, 8.0)
	draw_line(b + Vector2(70, -60), b + Vector2(74, 0), c, 8.0)


func _trunk(b: Vector2) -> void:
	draw_rect(Rect2(b + Vector2(-90, -150), Vector2(180, 150)), Color(0.28, 0.13, 0.07))
	draw_rect(Rect2(b + Vector2(-90, -150), Vector2(180, 150)), Color(0.08, 0.04, 0.02), false, 4.0)
	draw_line(b + Vector2(-90, -110), b + Vector2(90, -110), Color(0.55, 0.4, 0.15), 4.0)
	draw_rect(Rect2(b + Vector2(-10, -120), Vector2(20, 22)), Color(0.6, 0.45, 0.18))


func _palm(b: Vector2) -> void:
	var dark := Color(0.06, 0.1, 0.06)
	draw_colored_polygon(PackedVector2Array([b + Vector2(-34, -90), b + Vector2(34, -90), b + Vector2(24, 0), b + Vector2(-24, 0)]), Color(0.2, 0.12, 0.07))
	for i in 9:
		var a := -PI * 0.5 + (i - 4) * 0.33
		var tip := b + Vector2(0, -90) + Vector2(cos(a), sin(a)) * 150.0 + Vector2(0, absf(i - 4) * 12.0)
		var mid := (b + Vector2(0, -90) + tip) * 0.5 + Vector2(0, -26)
		draw_polyline(PackedVector2Array([b + Vector2(0, -90), mid, tip]), dark, 7.0, true)


func _vgrad(r: Rect2, top: Color, bottom: Color) -> void:
	draw_polygon(PackedVector2Array([r.position, r.position + Vector2(r.size.x, 0), r.end, r.position + Vector2(0, r.size.y)]),
		PackedColorArray([top, top, bottom, bottom]))


func _hgrad(r: Rect2, left: Color, mid: Color, right: Color) -> void:
	var m := r.position.x + r.size.x * 0.4
	draw_polygon(PackedVector2Array([r.position, Vector2(m, r.position.y), Vector2(m, r.end.y), Vector2(r.position.x, r.end.y)]), PackedColorArray([left, mid, mid, left]))
	draw_polygon(PackedVector2Array([Vector2(m, r.position.y), Vector2(r.end.x, r.position.y), r.end, Vector2(m, r.end.y)]), PackedColorArray([mid, right, right, mid]))
