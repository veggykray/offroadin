extends "res://minigames/polarity_machine/scripts/continuum_control.gd"
## LIGHT — a knurled brass wheel that turns a mechanical iris.
## Turning it clockwise opens the aperture (mirrored by the hanging lamp in the room).

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const SWEEP := 2.0944  # ±120° of wheel travel
const PLATE_R := 150.0
const WHEEL_IN := 100.0
const WHEEL_OUT := 124.0
const APERTURE_R := 62.0
const BLADES := 7


func _hit_test(p: Vector2) -> bool:
	return p.length() < PLATE_R + 14.0


func _value_from_point(p: Vector2) -> float:
	var a := angle_from_up(p)
	if absf(a) > SWEEP + 0.5:
		return display  # ignore the dead zone at the bottom so the wheel never wraps around
	return remap(a, -SWEEP, SWEEP, 0.0, float(MAX_VALUE))


func _light_color(v: float) -> Color:
	return U.key5c(v, [Color(0.35, 0.12, 0.05), Color(0.95, 0.55, 0.25), Color(1.0, 0.82, 0.55),
			Color(1.0, 0.95, 0.8), Color(1.0, 1.0, 1.0)])


func _draw() -> void:
	var rot := remap(display, 0.0, float(MAX_VALUE), -SWEEP, SWEEP)
	var kick := Vector2(sin(_time * 55.0), cos(_time * 47.0)) * _jolt * 1.5
	draw_set_transform(kick)

	# Back plate with rivets.
	draw_circle(Vector2.ZERO, PLATE_R + 6.0, sh(Color(0.04, 0.03, 0.04)))
	draw_circle(Vector2.ZERO, PLATE_R, iron(1.3))
	draw_arc(Vector2.ZERO, PLATE_R - 3.0, 0.0, TAU, 64, brass(0.8), 3.0, true)
	for k in 16:
		var a := float(k) * TAU / 16.0 + 0.1
		U.rivet(self, Vector2(cos(a), sin(a)) * (PLATE_R - 12.0), 3.2, brass())

	# Detent glyphs: moon phases from new moon to blazing sun. They light up as you pass them.
	for i in MAX_VALUE + 1:
		var a := remap(float(i), 0.0, float(MAX_VALUE), -SWEEP, SWEEP)
		var gp := dir_from_up(a) * (PLATE_R - 30.0)
		var lit := clampf(1.0 - absf(display - float(i)) * 1.5, 0.0, 1.0)
		_draw_phase(i, gp, lit)

	# Wheel ring (knurled), rotated by the setting.
	U.ring(self, Vector2.ZERO, WHEEL_IN, WHEEL_OUT, 0.0, TAU, brass(0.9), 48)
	draw_arc(Vector2.ZERO, WHEEL_OUT, 0.0, TAU, 48, brass(0.55), 2.0, true)
	draw_arc(Vector2.ZERO, WHEEL_IN, 0.0, TAU, 48, brass(0.55), 2.0, true)
	for k in 36:
		var a := rot + float(k) * TAU / 36.0
		var d := Vector2(cos(a), sin(a))
		draw_line(d * (WHEEL_IN + 3.0), d * (WHEEL_OUT - 3.0), brass(0.6), 2.0)
	# Spokes.
	for k in 5:
		var a := rot + float(k) * TAU / 5.0 - PI * 0.5
		var d := Vector2(cos(a), sin(a))
		var s := d.orthogonal()
		U.quad(self, d * APERTURE_R + s * 6.0, d * WHEEL_IN + s * 9.0, d * WHEEL_IN - s * 9.0, d * APERTURE_R - s * 6.0, brass(0.75))
	# Handle knob on the rim, pointing at the current setting.
	var hd := dir_from_up(rot)
	var knob := hd * (WHEEL_OUT + 6.0)
	if hovered or dragging:
		U.radial(self, knob, 46.0, Color(1.0, 0.9, 0.6, 0.3), U.CLEAR, 18)
	draw_circle(knob, 20.0 + _jolt * 2.0, sh(Color(0.05, 0.03, 0.03)))
	draw_circle(knob, 16.0, sh(Color(0.45, 0.22, 0.14)))
	draw_circle(knob + Vector2(-4, -5), 6.0, sh(Color(1, 1, 1, 0.25)))

	# Aperture: the light behind it, then the iris blades over it.
	var open := display / float(MAX_VALUE)
	var r_open := lerpf(3.0, APERTURE_R - 6.0, open)
	var lc := _light_color(display)
	draw_circle(Vector2.ZERO, APERTURE_R + 4.0, sh(Color(0.03, 0.02, 0.02)))
	U.radial(self, Vector2.ZERO, APERTURE_R, lc, lc.darkened(0.6), 24)
	var blade_rot := rot * 0.6
	for k in BLADES:
		var a0 := blade_rot + float(k) * TAU / float(BLADES)
		var a1 := a0 + TAU / float(BLADES)
		var i0 := Vector2(cos(a0), sin(a0)) * r_open
		var i1 := Vector2(cos(a1), sin(a1)) * r_open
		var o0 := Vector2(cos(a0 - 0.5), sin(a0 - 0.5)) * APERTURE_R
		var o1 := Vector2(cos(a1 - 0.5), sin(a1 - 0.5)) * APERTURE_R
		var oc := Vector2(cos(a0 + 0.2), sin(a0 + 0.2)) * APERTURE_R
		var bc := brass(0.55 + 0.1 * float(k % 2))
		U.quad(self, i0, o0, oc, i1, bc)
		U.tri(self, i1, oc, o1, bc)
		draw_line(i0, o0, sh(Color(0.08, 0.05, 0.03)), 1.5)
	draw_arc(Vector2.ZERO, APERTURE_R, 0.0, TAU, 40, brass(1.1), 4.0, true)
	if display > 3.2:
		var flare := (display - 3.2) / 0.8
		U.radial(self, Vector2.ZERO, 90.0 * flare, Color(1, 1, 0.9, 0.5 * flare), U.CLEAR, 24)
	draw_set_transform(Vector2.ZERO)


func _draw_phase(i: int, p: Vector2, lit: float) -> void:
	var base := brass(0.7)
	var glow := Color(1.0, 0.85, 0.5, 0.9)
	var c := base.lerp(glow, lit)
	var r := 9.0
	if lit > 0.05:
		U.radial(self, p, 22.0, Color(1.0, 0.8, 0.4, 0.35 * lit), U.CLEAR, 14)
	match i:
		0:
			draw_arc(p, r, 0.0, TAU, 18, c, 2.0, true)
		1:
			draw_arc(p, r, 0.0, TAU, 18, c, 1.5, true)
			draw_arc(p, r - 2.0, -PI * 0.5, PI * 0.5, 10, c, 3.0, true)
		2:
			draw_arc(p, r, 0.0, TAU, 18, c, 1.5, true)
			var half := PackedVector2Array()
			for k in 9:
				var a := -PI * 0.5 + PI * float(k) / 8.0
				half.append(p + Vector2(cos(a), sin(a)) * r)
			draw_colored_polygon(half, c)
		3:
			draw_circle(p, r, c)
		4:
			draw_circle(p, r * 0.8, c)
			for k in 8:
				var a := float(k) * TAU / 8.0
				draw_line(p + Vector2(cos(a), sin(a)) * (r + 1.0), p + Vector2(cos(a), sin(a)) * (r + 6.0), c, 2.0)
