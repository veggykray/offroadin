extends Node2D
## The mechanical lamp hanging from the ceiling pipe. Its iris mirrors the LIGHT wheel:
## closed (DARK) → pinhole (DIM) → half (SOFT) → wide (BRIGHT) → fully open with flare (BLAZING).
## The beam itself is drawn by the atmosphere layer (additive, above the darkness).

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const HOOD := Vector2(0, 205)  # hood centre, local
const TILT := -0.32  # aims the hood down-right at the plant
const MOUTH := 58.0  # distance from hood centre to the aperture

var temperature_level := 2.0
var light_level := 2.0
var age_level := 2.0
var _time := 0.0


func set_levels(t: float, l: float, a: float) -> void:
	temperature_level = t
	light_level = l
	age_level = a


func aperture_open() -> float:
	return U.key5(light_level, [0.0, 0.22, 0.5, 0.8, 1.0])


func light_color() -> Color:
	return U.key5c(light_level, [Color(0.6, 0.25, 0.1), Color(1.0, 0.62, 0.32), Color(1.0, 0.84, 0.6),
			Color(1.0, 0.95, 0.82), Color(1.0, 1.0, 1.0)])


## Aperture centre in Stage coordinates (the Environment node sits at the origin).
func aperture_point() -> Vector2:
	return position + HOOD + Vector2(0, MOUTH).rotated(TILT)


func beam_direction() -> Vector2:
	return Vector2(0, 1).rotated(TILT)


func pilot_point() -> Vector2:
	return position + HOOD + Vector2(46, -10).rotated(TILT)


func _process(delta: float) -> void:
	_time += delta
	queue_redraw()


func _draw() -> void:
	var tarnish := smoothstep(1.5, 4.0, age_level)
	var brass := Color(0.84, 0.64, 0.3).lerp(Color(0.5, 0.42, 0.26), tarnish)
	var dark := brass.darkened(0.55)
	var hot := U.key5(temperature_level, [0.0, 0.0, 0.0, 0.1, 0.6])
	var frost := U.key5(temperature_level, [1.0, 0.4, 0.0, 0.0, 0.0])
	var sway := sin(_time * 0.7) * 0.015

	# Chain from the ceiling pipe.
	for k in 7:
		var y := 72.0 + float(k) * 12.0
		if k % 2 == 0:
			U.ellipse(self, Vector2(0, y), 4.0, 7.0, dark, 10)
			U.ellipse(self, Vector2(0, y), 2.0, 5.0, Color(0.05, 0.03, 0.02), 8)
		else:
			draw_line(Vector2(0, y - 6), Vector2(0, y + 6), brass, 3.0)

	draw_set_transform(HOOD, TILT + sway)
	# Cap, gear and coil above the hood.
	U.quad(self, Vector2(-14, -64), Vector2(14, -64), Vector2(18, -44), Vector2(-18, -44), dark)
	draw_circle(Vector2(0, -50), 12.0, brass)
	for k in 8:
		var a := float(k) * TAU / 8.0 + _time * 0.2 * light_level
		draw_line(Vector2(0, -50) + Vector2(cos(a), sin(a)) * 10.0, Vector2(0, -50) + Vector2(cos(a), sin(a)) * 15.0, brass, 3.0)
	# Faceted conical hood.
	var top_w := 34.0
	var bot_w := 82.0
	var facets := 6
	for k in facets:
		var u0 := float(k) / float(facets)
		var u1 := float(k + 1) / float(facets)
		var shade := lerpf(0.55, 1.15, sin(u0 * PI))
		U.quad(self, Vector2(lerpf(-top_w, top_w, u0), -40), Vector2(lerpf(-top_w, top_w, u1), -40),
				Vector2(lerpf(-bot_w, bot_w, u1), MOUTH - 6.0), Vector2(lerpf(-bot_w, bot_w, u0), MOUTH - 6.0), U.shade(brass, shade))
	draw_polyline(PackedVector2Array([Vector2(-top_w, -40), Vector2(top_w, -40), Vector2(bot_w, MOUTH - 6.0),
			Vector2(-bot_w, MOUTH - 6.0), Vector2(-top_w, -40)]), dark, 3.0, true)
	draw_line(Vector2(-60, 20), Vector2(60, 20), dark, 2.0)
	# Hot metal glows a little; frost rimes the upper hood.
	if hot > 0.01:
		U.quad(self, Vector2(-bot_w, MOUTH - 14.0), Vector2(bot_w, MOUTH - 14.0), Vector2(bot_w, MOUTH - 6.0),
				Vector2(-bot_w, MOUTH - 6.0), Color(1.0, 0.4, 0.12, hot))
	if frost > 0.01:
		U.quad(self, Vector2(-top_w, -40), Vector2(top_w, -40), Vector2(top_w + 10, -26), Vector2(-top_w - 10, -26),
				Color(0.9, 0.96, 1.0, 0.75 * frost))
	# Bottom rim and the iris seen at an angle.
	var mouth := Vector2(0, MOUTH)
	U.ellipse(self, mouth, bot_w + 6.0, 16.0, dark, 32)
	U.ellipse(self, mouth, bot_w, 12.0, Color(0.05, 0.03, 0.03), 32)
	var open := aperture_open()
	var lc := light_color()
	if open > 0.01:
		U.ellipse(self, mouth, (bot_w - 6.0) * open, 10.0 * open, lc, 28)
		U.ellipse(self, mouth, (bot_w - 6.0) * open * 0.6, 6.0 * open, Color(1, 1, 1, 0.9), 20)
	# Iris blade seams across the aperture.
	for k in 7:
		var a2 := float(k) * TAU / 7.0
		var inner := Vector2(cos(a2) * (bot_w - 6.0) * open, sin(a2) * 10.0 * open)
		var outer := Vector2(cos(a2 + 0.5) * (bot_w - 2.0), sin(a2 + 0.5) * 12.0)
		draw_line(mouth + inner, mouth + outer, brass.darkened(0.3), 1.5)
	# Pilot light (its glow is added by the atmosphere so it shows in the dark).
	draw_circle(Vector2(46, -10), 5.0, Color(0.9, 0.2, 0.1))
	draw_set_transform(Vector2.ZERO)
