extends "res://minigames/polarity_machine/scripts/control_base.gd"
## AGE / TIME — the large upper dial. Five stations around the face show the
## plant's life: seedling, young, mature, flowering (under a crescent moon —
## a quiet clue), old. The brass hand with its knob points at the current
## age; the hourglass at the centre runs whenever time is moved.

const R := 140.0
const STATIONS := [-120.0, -60.0, 0.0, 60.0, 120.0]

var _sand := 0.0  # 1 → 0 after each change: hourglass running


func _ready() -> void:
	max_value = 4
	detent_crossed.connect(func(_v): _sand = 1.0)


func _process(delta: float) -> void:
	super._process(delta)
	_sand = maxf(0.0, _sand - delta * 0.8)


func _angle(v: float) -> float:
	var i := clampi(int(floor(v)), 0, 3)
	return deg_to_rad(lerpf(STATIONS[i], STATIONS[i + 1], v - float(i)))


func _hit_test(p: Vector2) -> bool:
	return p.length() < R + 22.0


func _value_from_point(p: Vector2) -> float:
	var a := rad_to_deg(angle_from_up(p))
	return clampf((a - STATIONS[0]) / 60.0, 0.0, 4.0)


func _draw() -> void:
	draw_circle(Vector2(5, 7), R + 6, Color(0, 0, 0, 0.45))
	draw_circle(Vector2.ZERO, R + 6, BRASS.darkened(0.45))
	draw_circle(Vector2.ZERO, R, BRASS)
	draw_circle(Vector2.ZERO, R - 6, BRASS.darkened(0.25))
	draw_circle(Vector2.ZERO, R - 18, Color(0.93, 0.88, 0.76))
	U_ring_ticks()
	# Track between stations.
	draw_arc(Vector2.ZERO, 66, deg_to_rad(STATIONS[0] - 90), deg_to_rad(STATIONS[4] - 90), 48, Color(0.45, 0.35, 0.22, 0.6), 2.0, true)
	for i in 5:
		var a := deg_to_rad(STATIONS[i])
		var p := dir_from_up(a) * 92.0
		var active := absf(display - float(i)) < 0.5
		if active:
			draw_circle(p, 25, Color(1.0, 0.85, 0.5, 0.45 + 0.15 * sin(_time * 3.0)))
		draw_arc(p, 22, 0, TAU, 24, Color(0.45, 0.35, 0.22, 0.7), 1.5, true)
		_pictogram(i, p)
	_hourglass()
	# The hand.
	var a2 := _angle(display) + sin(_jolt * 18.0) * _jolt * 0.04
	var d := dir_from_up(a2)
	draw_line(-d * 26, d * (R - 28), BRASS.darkened(0.45), 7.0, true)
	draw_line(-d * 26, d * (R - 28), BRASS.lightened(0.15), 3.0, true)
	draw_line(d * (R - 28), d * (R + 14), BRASS.darkened(0.3), 6.0, true)
	knob(d * (R + 18), 15.0)
	draw_circle(Vector2.ZERO, 10, BRASS.darkened(0.3))
	draw_circle(Vector2.ZERO, 5, BRASS.lightened(0.4))
	hover_ring(Vector2.ZERO, R + 9)


func U_ring_ticks() -> void:
	var roman := ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"]
	var font := ThemeDB.fallback_font
	for k in 60:
		var a := TAU * k / 60.0
		var d := dir_from_up(a)
		draw_line(d * (R - 18), d * (R - (26.0 if k % 5 == 0 else 22.0)), Color(0.3, 0.22, 0.12), 1.5 if k % 5 == 0 else 1.0)
	for h in 12:
		var a2 := TAU * h / 12.0
		var p := dir_from_up(a2) * (R - 10)
		var s: String = roman[h]
		var w := font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		draw_set_transform(p, a2, Vector2.ONE)
		draw_string(font, Vector2(-w * 0.5, 4), s, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.18, 0.12, 0.06))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _pictogram(i: int, p: Vector2) -> void:
	var ink := Color(0.22, 0.38, 0.18)
	var soil := Color(0.35, 0.24, 0.14)
	draw_line(p + Vector2(-10, 12), p + Vector2(10, 12), soil, 3.0)
	match i:
		0:
			draw_line(p + Vector2(0, 12), p + Vector2(0, 4), ink, 2.0)
			_pleaf(p + Vector2(0, 4), Vector2(-1, -0.6), 6, ink)
			_pleaf(p + Vector2(0, 4), Vector2(1, -0.6), 6, ink)
		1:
			draw_line(p + Vector2(0, 12), p + Vector2(0, -6), ink, 2.0)
			for k in 2:
				_pleaf(p + Vector2(0, 4 - k * 8), Vector2(-1 if k % 2 == 0 else 1, -0.5), 7, ink)
		2:
			draw_line(p + Vector2(0, 12), p + Vector2(0, -12), ink, 2.5)
			for k in 4:
				_pleaf(p + Vector2(0, 6 - k * 5), Vector2(-1 if k % 2 == 0 else 1, -0.4), 8, ink)
		3:
			draw_line(p + Vector2(0, 12), p + Vector2(0, -8), ink, 2.5)
			for k in 3:
				_pleaf(p + Vector2(0, 6 - k * 5), Vector2(-1 if k % 2 == 0 else 1, -0.4), 7, ink)
			for k in 5:
				var d := Vector2.from_angle(TAU * k / 5.0)
				draw_circle(p + Vector2(0, -10) + d * 3.5, 2.5, Color(0.5, 0.3, 0.7))
			draw_circle(p + Vector2(0, -10), 1.6, Color(0.9, 0.7, 0.2))
			# A small crescent moon above the flower.
			draw_circle(p + Vector2(11, -14), 5, Color(0.3, 0.32, 0.5))
			draw_circle(p + Vector2(13, -16), 4.5, Color(0.93, 0.88, 0.76))
		4:
			var stem := PackedVector2Array([p + Vector2(0, 12), p + Vector2(1, 0), p + Vector2(6, -6), p + Vector2(10, -2)])
			draw_polyline(stem, Color(0.4, 0.3, 0.18), 2.0, true)
			_pleaf(p + Vector2(1, 4), Vector2(-1, 0.6), 6, Color(0.55, 0.45, 0.2))
			_pleaf(p + Vector2(4, -4), Vector2(1, 0.8), 5, Color(0.55, 0.45, 0.2))


func _pleaf(b: Vector2, d: Vector2, s: float, c: Color) -> void:
	var dn := d.normalized()
	var n := dn.orthogonal()
	draw_colored_polygon(PackedVector2Array([b, b + dn * s * 0.5 + n * s * 0.3, b + dn * s, b + dn * s * 0.5 - n * s * 0.3]), c)


func _hourglass() -> void:
	var c := Vector2.ZERO
	var frame := BRASS.darkened(0.35)
	draw_circle(c, 30, Color(0.2, 0.14, 0.08))
	draw_circle(c, 27, BRASS.darkened(0.1))
	var top := PackedVector2Array([c + Vector2(-12, -18), c + Vector2(12, -18), c + Vector2(2, -2), c + Vector2(-2, -2)])
	var bot := PackedVector2Array([c + Vector2(-2, 2), c + Vector2(2, 2), c + Vector2(12, 18), c + Vector2(-12, 18)])
	draw_colored_polygon(top, Color(0.95, 0.92, 0.8))
	draw_colored_polygon(bot, Color(0.95, 0.92, 0.8))
	var sand := Color(0.85, 0.6, 0.25)
	var k := 0.5 + 0.5 * cos(_time * 0.7)
	# draw_primitive: these shapes collapse to a line as the sand runs out.
	var cols := PackedColorArray([sand, sand, sand, sand])
	draw_primitive(PackedVector2Array([c + Vector2(-8 * k, -2 - 12 * k), c + Vector2(8 * k, -2 - 12 * k), c + Vector2(2, -2), c + Vector2(-2, -2)]), cols, PackedVector2Array())
	draw_primitive(PackedVector2Array([c + Vector2(-12, 18), c + Vector2(12, 18), c + Vector2(6 * (1.0 - k) + 1, 18 - 12 * (1.0 - k)), c + Vector2(-6 * (1.0 - k) - 1, 18 - 12 * (1.0 - k))]), cols, PackedVector2Array())
	if _sand > 0.0:
		draw_line(c + Vector2(0, -2), c + Vector2(0, 16), Color(sand, _sand), 2.0)
	draw_line(c + Vector2(-14, -20), c + Vector2(14, -20), frame, 3.0)
	draw_line(c + Vector2(-14, 20), c + Vector2(14, 20), frame, 3.0)
