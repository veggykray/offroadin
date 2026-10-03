extends "res://minigames/polarity_machine/scripts/control_base.gd"
## TEMPERATURE — the big lever over the curved gauge at the bottom of the
## machine. Four detents: Cold, Cool, Warm, Hot. The band runs from frosty
## blue (snowflake) to glowing red (sun); the end you're near frosts over or
## glows.

const R_IN := 162.0
const R_OUT := 240.0
const HALF_SPAN := 68.0
const DETENTS := [-51.0, -17.0, 17.0, 51.0]
const ARM := 150.0


func _ready() -> void:
	max_value = 3


func _angle(v: float) -> float:
	var i := clampi(int(floor(v)), 0, 2)
	return deg_to_rad(lerpf(DETENTS[i], DETENTS[i + 1], v - float(i)))


func _hit_test(p: Vector2) -> bool:
	var a := rad_to_deg(angle_from_up(p))
	return p.y < 30.0 and p.length() < R_OUT + 10.0 and absf(a) < HALF_SPAN + 10.0 and p.length() > 30.0 or p.distance_to(dir_from_up(_angle(display)) * (ARM + 8)) < 26.0


func _value_from_point(p: Vector2) -> float:
	var a := rad_to_deg(angle_from_up(p))
	return clampf((a - DETENTS[0]) / 34.0, 0.0, 3.0)


func _band_color(s: float) -> Color:
	# s 0 (left, cold) .. 1 (right, hot)
	var stops := [Color(0.35, 0.6, 1.0), Color(0.55, 0.85, 0.95), Color(0.95, 0.85, 0.5), Color(1.0, 0.55, 0.2), Color(0.95, 0.2, 0.12)]
	var x := s * 4.0
	var i := clampi(int(floor(x)), 0, 3)
	return (stops[i] as Color).lerp(stops[i + 1], x - float(i))


func _draw() -> void:
	var a0 := deg_to_rad(-HALF_SPAN)
	var a1 := deg_to_rad(HALF_SPAN)
	# Gauge plate.
	var plate := PackedVector2Array()
	for i in 41:
		var a := lerpf(a0 - 0.12, a1 + 0.12, float(i) / 40.0)
		plate.append(dir_from_up(a) * (R_OUT + 22))
	for i in 41:
		var a := lerpf(a1 + 0.12, a0 - 0.12, float(i) / 40.0)
		plate.append(dir_from_up(a) * (R_IN - 30))
	var sh := plate.duplicate()
	for i in sh.size():
		sh[i] += Vector2(5, 7)
	draw_colored_polygon(sh, Color(0, 0, 0, 0.4))
	draw_colored_polygon(plate, Color(0.12, 0.09, 0.07))
	plate.append(plate[0])
	draw_polyline(plate, BRASS, 3.0, true)
	# Colour band.
	var n := 36
	for i in n:
		var s0 := float(i) / n
		var s1 := float(i + 1) / n
		var b0 := lerpf(a0, a1, s0)
		var b1 := lerpf(a0, a1, s1)
		var c0 := _band_color(s0)
		var c1 := _band_color(s1)
		var d0 := dir_from_up(b0)
		var d1 := dir_from_up(b1)
		draw_primitive(PackedVector2Array([d0 * R_IN, d0 * (R_IN + 26), d1 * (R_IN + 26), d1 * R_IN]),
				PackedColorArray([c0.darkened(0.25), c0, c1, c1.darkened(0.25)]), PackedVector2Array())
	draw_arc(Vector2.ZERO, R_IN, a0 - PI * 0.5, a1 - PI * 0.5, 48, BRASS.darkened(0.2), 2.0, true)
	draw_arc(Vector2.ZERO, R_IN + 26, a0 - PI * 0.5, a1 - PI * 0.5, 48, BRASS.darkened(0.2), 2.0, true)
	# Detent ticks and outer scale.
	for i in 4:
		var d := dir_from_up(deg_to_rad(DETENTS[i]))
		var on := absf(display - float(i)) < 0.5
		draw_line(d * (R_IN + 30), d * (R_OUT - 6), Color(1.0, 0.9, 0.6) if on else BRASS.darkened(0.1), 3.0 if on else 2.0, true)
		if on:
			draw_circle(d * (R_OUT + 6), 5, _band_color(float(i) / 3.0))
	for k in 17:
		var d2 := dir_from_up(lerpf(a0, a1, float(k) / 16.0))
		draw_line(d2 * (R_OUT - 4), d2 * (R_OUT + 4), BRASS.darkened(0.3), 1.0)
	# End icons: snowflake (cold) and sun (hot).
	var cold_p := dir_from_up(a0 - 0.02) * (R_IN - 10) + Vector2(-34, -2)
	var hot_p := dir_from_up(a1 + 0.02) * (R_IN - 10) + Vector2(34, -2)
	var cold_glow := clampf(1.0 - display, 0.0, 1.0)
	var hot_glow := clampf(display - 2.0, 0.0, 1.0)
	if cold_glow > 0.0:
		draw_circle(cold_p, 22, Color(0.6, 0.85, 1.0, 0.3 * cold_glow))
	if hot_glow > 0.0:
		draw_circle(hot_p, 24, Color(1.0, 0.5, 0.15, 0.35 * hot_glow))
	for k in 6:
		var d3 := Vector2.from_angle(TAU * k / 6.0)
		draw_line(cold_p, cold_p + d3 * 13, Color(0.75, 0.9, 1.0), 2.0)
		draw_line(cold_p + d3 * 8, cold_p + d3 * 8 + d3.rotated(0.8) * 4, Color(0.75, 0.9, 1.0), 1.5)
	draw_circle(hot_p, 8, Color(1.0, 0.6, 0.2))
	for k in 10:
		var d4 := Vector2.from_angle(TAU * k / 10.0)
		draw_line(hot_p + d4 * 10, hot_p + d4 * 15, Color(1.0, 0.55, 0.15), 2.0)
	# Lever.
	var a := _angle(display) + sin(_jolt * 20.0) * _jolt * 0.03
	var d5 := dir_from_up(a)
	draw_line(Vector2(4, 6), d5 * ARM + Vector2(4, 6), Color(0, 0, 0, 0.4), 12.0, true)
	draw_line(Vector2.ZERO, d5 * ARM, BRASS.darkened(0.4), 11.0, true)
	draw_line(Vector2.ZERO, d5 * ARM, BRASS.lightened(0.1), 5.0, true)
	for k in 2:
		var q := d5 * (60 + k * 40)
		draw_line(q - d5.orthogonal() * 8, q + d5.orthogonal() * 8, BRASS.darkened(0.5), 4.0)
	var kp := d5 * (ARM + 8)
	if cold_glow > 0.3:
		draw_circle(kp, 24, Color(0.8, 0.95, 1.0, 0.3 * cold_glow))
	if hot_glow > 0.3:
		draw_circle(kp, 26, Color(1.0, 0.45, 0.15, 0.35 * hot_glow))
	knob(kp, 18.0)
	# Pivot housing.
	var dome := PackedVector2Array()
	for i in 21:
		var aa := PI + PI * float(i) / 20.0
		dome.append(Vector2(cos(aa) * 40, sin(aa) * 40))
	draw_colored_polygon(dome, BRASS.darkened(0.15))
	draw_rect(Rect2(-46, 0, 92, 18), BRASS.darkened(0.35))
	draw_circle(Vector2.ZERO, 13, BRASS.lightened(0.2))
	draw_circle(Vector2.ZERO, 6, BRASS.darkened(0.4))
	if hovered or dragging:
		draw_arc(Vector2.ZERO, R_OUT + 26, a0 - PI * 0.5 - 0.1, a1 - PI * 0.5 + 0.1, 48, Color(1.0, 0.9, 0.6, 0.35 + 0.15 * sin(_time * 5.0)), 2.5, true)
