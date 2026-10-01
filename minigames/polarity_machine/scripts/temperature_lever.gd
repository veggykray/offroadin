extends "res://minigames/polarity_machine/scripts/continuum_control.gd"
## TEMPERATURE — a heavy industrial lever swinging along an arced slot.
## Node origin is the pivot. The left end of the slot is crusted with frost, the right end glows red-hot.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const SWEEP := 0.8029  # handle angle (radians, ~46°) at the end detents
const ARM := 238.0
const SLOT_IN := 212.0
const SLOT_OUT := 262.0

const COLD_COL := Color(0.55, 0.85, 1.0)
const HOT_COL := Color(1.0, 0.36, 0.12)


func _hit_test(p: Vector2) -> bool:
	var grip := dir_from_up(_angle_for(display)) * ARM
	if p.distance_to(grip) < 52.0:
		return true
	var d := p.length()
	return d > SLOT_IN - 34.0 and d < SLOT_OUT + 40.0 and absf(angle_from_up(p)) < SWEEP + 0.22


func _value_from_point(p: Vector2) -> float:
	return remap(angle_from_up(p), -SWEEP, SWEEP, 0.0, float(MAX_VALUE))


func _angle_for(v: float) -> float:
	return remap(v, 0.0, float(MAX_VALUE), -SWEEP, SWEEP)


func _temp_color(t: float) -> Color:
	return U.key5c(t, [COLD_COL, Color(0.6, 0.75, 0.95), Color(0.85, 0.82, 0.7), Color(1.0, 0.68, 0.3), HOT_COL])


func _draw() -> void:
	var kick := sin(_time * 60.0) * _jolt * 2.0
	draw_set_transform(Vector2(kick, 0))

	# Housing plate behind the slot.
	var plate := PackedVector2Array()
	for i in 25:
		var a := lerpf(-SWEEP - 0.3, SWEEP + 0.3, float(i) / 24.0)
		plate.append(dir_from_up(a) * (SLOT_OUT + 52.0))
	for i in 25:
		var a := lerpf(SWEEP + 0.3, -SWEEP - 0.3, float(i) / 24.0)
		plate.append(dir_from_up(a) * (SLOT_IN - 50.0))
	draw_colored_polygon(plate, iron(1.25))
	draw_polyline(plate, brass(0.8), 3.0, true)

	# The slot: a cold-to-hot band, lit from within only at its ends.
	var n := 40
	for i in n:
		var t0 := float(i) / float(n)
		var t1 := float(i + 1) / float(n)
		var a0 := lerpf(-SWEEP - 0.12, SWEEP + 0.12, t0) - PI * 0.5
		var a1 := lerpf(-SWEEP - 0.12, SWEEP + 0.12, t1) - PI * 0.5
		var tint := _temp_color(t0 * 4.0)
		var inner := Color(0.05, 0.04, 0.05).lerp(tint, 0.18)
		U.ring(self, Vector2.ZERO, SLOT_IN, SLOT_OUT, a0, a1, sh(inner), 1)
	U.ring(self, Vector2.ZERO, SLOT_IN + 16.0, SLOT_OUT - 16.0, -SWEEP - 0.12 - PI * 0.5, SWEEP + 0.12 - PI * 0.5,
			Color(0, 0, 0, 0.6), 40)
	draw_arc(Vector2.ZERO, SLOT_OUT + 2.0, -SWEEP - 0.14 - PI * 0.5, SWEEP + 0.14 - PI * 0.5, 40, brass(), 4.0, true)
	draw_arc(Vector2.ZERO, SLOT_IN - 2.0, -SWEEP - 0.14 - PI * 0.5, SWEEP + 0.14 - PI * 0.5, 40, brass(0.7), 4.0, true)

	# Frost crust on the left end (always a little, thick when the room is cold).
	var frost_amt := 0.35 + 0.65 * U.key5(heat, [1.0, 0.6, 0.15, 0.0, 0.0])
	var base_a := -SWEEP - 0.12
	for k in 9:
		var a := base_a + float(k) * 0.03
		var r := lerpf(SLOT_IN, SLOT_OUT, fmod(float(k) * 0.37, 1.0))
		var p := dir_from_up(a) * r
		var spike := (6.0 + float(k % 3) * 5.0) * frost_amt
		for s in 3:
			var sa := float(s) * PI / 3.0 + float(k)
			draw_line(p - Vector2(cos(sa), sin(sa)) * spike, p + Vector2(cos(sa), sin(sa)) * spike,
					Color(0.85, 0.95, 1.0, 0.85 * frost_amt), 2.0)
	U.radial(self, dir_from_up(base_a - 0.08) * (SLOT_OUT + 18.0), 34.0, Color(0.6, 0.85, 1.0, 0.35 * frost_amt), U.CLEAR, 16)

	# Red-hot right end; pulses with heat.
	var hot_amt := 0.35 + 0.65 * U.key5(heat, [0.0, 0.0, 0.1, 0.45, 1.0])
	var hot_a := SWEEP + 0.12
	var flick := 0.85 + 0.15 * sin(_time * 7.0)
	U.ring(self, Vector2.ZERO, SLOT_IN, SLOT_OUT, hot_a - PI * 0.5 - 0.1, hot_a - PI * 0.5, Color(1.0, 0.35, 0.1, 0.9 * hot_amt * flick), 4)
	U.radial(self, dir_from_up(hot_a + 0.08) * (SLOT_OUT + 18.0), 40.0 * hot_amt, Color(1.0, 0.45, 0.15, 0.45 * hot_amt * flick), U.CLEAR, 16)

	# Detent notches and engraved glyphs.
	for i in MAX_VALUE + 1:
		var a := _angle_for(float(i))
		var d := dir_from_up(a)
		draw_line(d * (SLOT_IN - 10.0), d * (SLOT_IN + 6.0), brass(1.1), 4.0)
		draw_line(d * (SLOT_OUT - 6.0), d * (SLOT_OUT + 10.0), brass(1.1), 4.0)
		_draw_glyph(i, d * (SLOT_OUT + 32.0), a)

	# The arm.
	var ang := _angle_for(display)
	var dirv := dir_from_up(ang)
	var grip := dirv * ARM
	var tip_heat := _temp_color(display)
	var arm_col := iron(1.6).lerp(sh(tip_heat), 0.25)
	var side := dirv.orthogonal()
	U.quad(self, side * 18.0, grip + side * 9.0, grip - side * 9.0, -side * 18.0, sh(Color(0.05, 0.04, 0.05)))
	U.quad(self, side * 14.0, grip + side * 6.5, grip - side * 6.5, -side * 14.0, arm_col)
	draw_line(side * 8.0, grip + side * 3.0, sh(Color(1, 1, 1, 0.25)), 2.0)
	# Collar rings on the arm.
	for k in [0.45, 0.62]:
		var cp: Vector2 = dirv * ARM * float(k)
		U.quad(self, cp + side * 15.0 - dirv * 5.0, cp + side * 15.0 + dirv * 5.0, cp - side * 15.0 + dirv * 5.0,
				cp - side * 15.0 - dirv * 5.0, brass())

	# Grip: a heavy knob whose colour shows the setting (frosted ↔ glowing).
	var knob_r := 30.0 + _jolt * 3.0
	if hovered or dragging:
		U.radial(self, grip, knob_r * 2.0, Color(1.0, 0.9, 0.6, 0.3), U.CLEAR, 20)
	draw_circle(grip, knob_r + 4.0, sh(Color(0.05, 0.03, 0.04)))
	draw_circle(grip, knob_r, sh(Color(0.35, 0.2, 0.18).lerp(tip_heat, 0.55)))
	draw_circle(grip + Vector2(-8, -9), knob_r * 0.45, sh(Color(1, 1, 1, 0.22)))
	var glow_k := maxf(U.key5(display, [0.6, 0.15, 0.0, 0.2, 0.8]), 0.0)
	if glow_k > 0.01:
		U.radial(self, grip, knob_r * 2.2, U.with_alpha(tip_heat, 0.4 * glow_k), U.CLEAR, 20)
	if display < 1.0:
		var fa := 1.0 - display
		for k in 6:
			var a2 := float(k) * TAU / 6.0 + 0.3
			draw_line(grip + Vector2(cos(a2), sin(a2)) * knob_r * 0.4, grip + Vector2(cos(a2), sin(a2)) * (knob_r + 6.0),
					Color(0.9, 0.97, 1.0, 0.7 * fa), 2.0)

	# Pivot hub with an indicator jewel (stays visible in the dark).
	draw_circle(Vector2.ZERO, 74.0, sh(Color(0.05, 0.04, 0.05)))
	draw_circle(Vector2.ZERO, 68.0, brass(0.9))
	draw_circle(Vector2.ZERO, 54.0, iron(1.4))
	for k in 8:
		var a3 := float(k) * TAU / 8.0
		U.rivet(self, Vector2(cos(a3), sin(a3)) * 61.0, 4.0, brass())
	var jewel := _temp_color(display)
	U.radial(self, Vector2(0, -18), 30.0, U.with_alpha(jewel, 0.6), U.CLEAR, 18)
	draw_circle(Vector2(0, -18), 11.0, jewel.darkened(0.3))
	draw_circle(Vector2(-3, -21), 4.0, jewel.lightened(0.5))
	draw_set_transform(Vector2.ZERO)


## Engraved marks beside each detent: snowflake, rime, balance, flame, blaze. No numbers.
func _draw_glyph(i: int, p: Vector2, _a: float) -> void:
	var c := brass(0.75)
	match i:
		0:
			for k in 3:
				var a := float(k) * PI / 3.0
				var d := Vector2(cos(a), sin(a)) * 11.0
				draw_line(p - d, p + d, c, 2.5)
		1:
			# Water triangle ▽ with a frost bar.
			draw_polyline(PackedVector2Array([p + Vector2(-10, -7), p + Vector2(10, -7), p + Vector2(0, 10), p + Vector2(-10, -7)]), c, 2.5)
			draw_line(p + Vector2(-5, 0), p + Vector2(5, 0), c, 2.0)
		2:
			draw_arc(p, 8.0, 0.0, TAU, 16, c, 2.5)
			draw_line(p + Vector2(-12, 0), p + Vector2(12, 0), c, 2.0)
		3:
			# Fire triangle △.
			draw_polyline(PackedVector2Array([p + Vector2(-10, 8), p + Vector2(10, 8), p + Vector2(0, -10), p + Vector2(-10, 8)]), c, 2.5)
		4:
			draw_polyline(PackedVector2Array([p + Vector2(-10, 8), p + Vector2(10, 8), p + Vector2(0, -10), p + Vector2(-10, 8)]), c, 2.5)
			for k in 3:
				var a := -PI * 0.5 + (float(k) - 1.0) * 0.6
				draw_line(p + Vector2(cos(a), sin(a)) * 13.0, p + Vector2(cos(a), sin(a)) * 19.0, c, 2.0)
