extends "res://minigames/polarity_machine/scripts/control_base.gd"
## LIGHT — the brass sun wheel. Turning its knob through four detents
## (Dark, Low, Medium, Bright) rotates the spoked wheel; the sun at its hub
## and the lamp over the plant brighten together. Glyphs on the bezel: new
## moon, crescent, half sun, full sun.

const R := 118.0
const DETENTS := [-160.0, -120.0, -80.0, -40.0]


func _ready() -> void:
	max_value = 3


func _angle(v: float) -> float:
	var i := clampi(int(floor(v)), 0, 2)
	return deg_to_rad(lerpf(DETENTS[i], DETENTS[i + 1], v - float(i)))


func _hit_test(p: Vector2) -> bool:
	return p.length() < R + 26.0


func _value_from_point(p: Vector2) -> float:
	var a := rad_to_deg(angle_from_up(p))
	if a > 60.0:
		a -= 360.0  # below the wheel on the right still counts as "dark side"
	return clampf((a - DETENTS[0]) / 40.0, 0.0, 3.0)


func _draw() -> void:
	draw_circle(Vector2(5, 7), R + 8, Color(0, 0, 0, 0.45))
	draw_circle(Vector2.ZERO, R + 8, BRASS.darkened(0.5))
	draw_circle(Vector2.ZERO, R, BRASS.darkened(0.05))
	draw_circle(Vector2.ZERO, R - 10, Color(0.16, 0.11, 0.07))
	# Glyphs at each detent, on the bezel.
	for i in 4:
		var p := dir_from_up(deg_to_rad(DETENTS[i])) * (R - 26)
		var on := absf(display - float(i)) < 0.5
		var c := Color(1.0, 0.86, 0.5) if on else Color(0.62, 0.5, 0.3)
		_glyph(i, p, c)
	# Spoked wheel that turns with the setting.
	var rot := display * 0.7 + sin(_jolt * 18.0) * _jolt * 0.05
	draw_arc(Vector2.ZERO, R - 44, 0, TAU, 48, BRASS, 9.0, true)
	draw_arc(Vector2.ZERO, R - 44, 0, TAU, 48, BRASS.lightened(0.3), 2.0, true)
	for k in 8:
		var d := Vector2.from_angle(rot + TAU * k / 8.0)
		draw_line(d * 30, d * (R - 46), BRASS.darkened(0.15), 6.0, true)
		draw_line(d * 30, d * (R - 46), BRASS.lightened(0.2), 1.5, true)
	# Sun at the hub; its glow tracks the setting.
	var glow := display / 3.0
	if glow > 0.02:
		for k in 3:
			draw_circle(Vector2.ZERO, 34 + k * 10, Color(1.0, 0.8, 0.4, 0.12 * glow))
	var sun := BRASS.lerp(Color(1.0, 0.86, 0.45), glow)
	draw_circle(Vector2.ZERO, 30, BRASS.darkened(0.4))
	for k in 12:
		var d2 := Vector2.from_angle(rot * -0.5 + TAU * k / 12.0)
		var tip := d2 * (28 + 6 * glow)
		draw_colored_polygon(PackedVector2Array([d2.orthogonal() * 4 + d2 * 16, tip, -d2.orthogonal() * 4 + d2 * 16]), sun)
	draw_circle(Vector2.ZERO, 16, sun)
	draw_circle(Vector2(-4, -4), 5, Color(1, 1, 1, 0.35))
	# Handle arm and knob.
	var a := _angle(display) + sin(_jolt * 20.0) * _jolt * 0.03
	var d3 := dir_from_up(a)
	draw_line(d3 * (R - 12), d3 * (R + 10), BRASS.darkened(0.3), 7.0, true)
	knob(d3 * (R + 14), 15.0)
	hover_ring(Vector2.ZERO, R + 12)


func _glyph(i: int, p: Vector2, c: Color) -> void:
	match i:
		0:
			draw_arc(p, 8, 0, TAU, 16, c, 2.0, true)
		1:
			draw_circle(p, 8, c)
			draw_circle(p + Vector2(4, -2), 7, Color(0.16, 0.11, 0.07))
		2:
			draw_arc(p, 7, 0, TAU, 16, c, 2.0, true)
			draw_colored_polygon(PackedVector2Array([p + Vector2(0, -7), p + Vector2(7, 0), p + Vector2(0, 7)]), c)
			for k in 4:
				var d := Vector2.from_angle(-PI * 0.5 + k * PI / 3)
				draw_line(p + d * 9, p + d * 12, c, 1.5)
		3:
			draw_circle(p, 7, c)
			for k in 8:
				var d2 := Vector2.from_angle(TAU * k / 8.0)
				draw_line(p + d2 * 9, p + d2 * 13, c, 2.0)
