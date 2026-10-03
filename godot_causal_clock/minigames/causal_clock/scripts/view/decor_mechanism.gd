class_name CausalClockDecorMechanism
extends Node2D
## The living machinery behind the clock: large, dim gears turning slowly
## behind the case, an escape wheel that ticks once a second and a balance
## wheel swinging back and forth. Pure ambience — it reacts to puzzle moves
## by briefly spinning faster (`kick`).

class DecorGear extends Node2D:
	var radius: float = 100.0
	var teeth: int = 24
	var speed: float = 0.1
	var tint: Color = Color(0.3, 0.22, 0.12)
	var ticking: bool = false
	var _tick_phase: float = 0.0

	func _draw() -> void:
		var body := CausalClockDraw.gear_points(radius * 0.88, radius, teeth)
		var sh := body.duplicate()
		for i in sh.size():
			sh[i] += Vector2(8, 12)
		draw_colored_polygon(sh, Color(0, 0, 0, 0.35))
		draw_colored_polygon(body, tint)
		body.append(body[0])
		draw_polyline(body, tint.lightened(0.45), 1.5, true)
		draw_arc(Vector2.ZERO, radius * 0.95, -2.7, -0.9, 24, tint.lightened(0.6) * Color(1, 1, 1, 0.6), 2.0, true)
		draw_circle(Vector2.ZERO, radius * 0.78, tint.darkened(0.35))
		var spokes := 5 if teeth > 20 else 4
		for s in spokes:
			var d := Vector2.from_angle(TAU * s / spokes)
			draw_line(d * radius * 0.15, d * radius * 0.8, tint, radius * 0.12, true)
		draw_arc(Vector2.ZERO, radius * 0.78, 0, TAU, 64, tint.lightened(0.15), 2.0, true)
		draw_circle(Vector2.ZERO, radius * 0.17, tint.lightened(0.1))
		draw_circle(Vector2.ZERO, radius * 0.07, tint.darkened(0.6))


class Balance extends Node2D:
	var radius: float = 60.0
	var tint: Color = Color(0.62, 0.47, 0.24)

	## An orrery: brass meridian rings, orbits and little planets round a sun.
	func _draw() -> void:
		draw_circle(Vector2(6, 9), radius + 4, Color(0, 0, 0, 0.35))
		draw_arc(Vector2.ZERO, radius, 0, TAU, 64, tint, 6.0, true)
		draw_arc(Vector2.ZERO, radius - 3, 0, TAU, 64, tint.lightened(0.4), 1.0, true)
		for k in 4:
			var d := Vector2.from_angle(TAU * k / 4.0)
			draw_line(d * radius * 0.9, d * (radius + 10), tint, 4.0, true)
			draw_circle(d * (radius + 12), 5.0, tint.lightened(0.3))
		for k in 4:
			var rr := radius * (0.25 + 0.17 * k)
			draw_arc(Vector2.ZERO, rr, 0, TAU, 48, tint.lightened(0.2) * Color(1, 1, 1, 0.5), 1.0, true)
			draw_circle(Vector2.from_angle(1.3 + k * 2.1) * rr, 3.5 + k * 0.6, tint.lightened(0.5))
		draw_circle(Vector2.ZERO, 8.0, Color(1.0, 0.75, 0.35))
		draw_circle(Vector2.ZERO, 14.0, Color(1.0, 0.75, 0.35, 0.25))


var _gears: Array[DecorGear] = []
var _balance: Balance
var _escape: DecorGear
var _time: float = 0.0
var _kick: float = 0.0
## Emitted on each escapement tick so the audio layer can follow it.
signal ticked


## Faint sepia draughtsman's sketches behind everything: gear outlines,
## compass roses, dimension lines.
class Sketches extends Node2D:
	var r: float = 400.0

	func _draw() -> void:
		var ink := Color(0.78, 0.64, 0.42, 0.10)
		var rng := RandomNumberGenerator.new()
		rng.seed = 11
		for spec in [[200.0, 1.55, 0.55], [340.0, 1.6, 0.4], [20.0, 1.7, 0.35], [140.0, 1.5, 0.3]]:
			var c := CausalClockGeometry.point(spec[0], r * spec[1])
			var rr: float = r * spec[2]
			draw_arc(c, rr, 0, TAU, 64, ink, 1.2, true)
			draw_arc(c, rr * 0.8, 0, TAU, 64, ink, 1.0, true)
			draw_arc(c, rr * 0.25, 0, TAU, 32, ink, 1.0, true)
			for k in 8:
				var d := Vector2.from_angle(TAU * k / 8.0)
				draw_line(c + d * rr * 0.25, c + d * rr * 0.8, ink, 1.0, true)
			draw_line(c - Vector2(rr * 1.2, 0), c + Vector2(rr * 1.2, 0), ink, 0.8, true)
			draw_line(c - Vector2(0, rr * 1.2), c + Vector2(0, rr * 1.2), ink, 0.8, true)
		# Compass roses.
		for spec2 in [[300.0, 1.45], [65.0, 1.45]]:
			var c2 := CausalClockGeometry.point(spec2[0], r * spec2[1])
			for k in 16:
				var d2 := Vector2.from_angle(TAU * k / 16.0)
				var l := 70.0 if k % 4 == 0 else (42.0 if k % 2 == 0 else 26.0)
				draw_line(c2, c2 + d2 * l, ink, 1.0, true)
			draw_arc(c2, 34, 0, TAU, 32, ink, 1.0, true)
		# Scattered dimension ticks and stars.
		for i in 40:
			var p := Vector2(rng.randf_range(-r * 2.4, r * 2.4), rng.randf_range(-r * 1.4, r * 1.4))
			if p.length() > r * 1.25:
				draw_line(p, p + Vector2(rng.randf_range(20, 60), 0), ink, 0.8)
				draw_line(p, p + Vector2(0, -6), ink, 0.8)


func build(outer_radius: float) -> void:
	for ch in get_children():
		ch.queue_free()
	_gears.clear()
	var r := outer_radius
	var sketches := Sketches.new()
	sketches.r = r
	add_child(sketches)
	# [angle_deg, distance factor, radius, teeth, speed]
	var specs := [
		[300.0, 1.02, r * 0.42, 36, 0.05],
		[322.0, 1.32, r * 0.22, 20, -0.095],
		[55.0, 1.05, r * 0.36, 30, -0.06],
		[118.0, 1.08, r * 0.30, 26, 0.07],
		[150.0, 1.28, r * 0.17, 16, -0.12],
		[215.0, 1.04, r * 0.46, 40, 0.045],
		[245.0, 1.36, r * 0.2, 18, -0.1],
	]
	for s in specs:
		var g := DecorGear.new()
		g.radius = s[2]
		g.teeth = s[3]
		g.speed = s[4]
		g.position = CausalClockGeometry.point(s[0], r * s[1])
		g.tint = Color(0.24, 0.17, 0.09).lerp(Color(0.36, 0.26, 0.13), randf_range(0, 1))
		add_child(g)
		_gears.append(g)
	_escape = DecorGear.new()
	_escape.radius = r * 0.13
	_escape.teeth = 15
	_escape.speed = 0.0
	_escape.ticking = true
	_escape.tint = Color(0.26, 0.2, 0.12)
	_escape.position = CausalClockGeometry.point(284.0, r * 1.22)
	add_child(_escape)
	_balance = Balance.new()
	_balance.radius = r * 0.16
	_balance.position = CausalClockGeometry.point(262.0, r * 1.3)
	add_child(_balance)


func kick(amount: float = 1.0) -> void:
	_kick = minf(_kick + amount, 3.0)


func _process(dt: float) -> void:
	_time += dt
	_kick = move_toward(_kick, 0.0, dt * 1.5)
	var boost := 1.0 + _kick * 4.0
	for g in _gears:
		g.rotation += g.speed * dt * boost
	if _balance:
		_balance.rotation = sin(_time * PI) * 1.6
	if _escape:
		# Step once per second with a little recoil.
		var sec := floorf(_time)
		var frac := _time - sec
		var stepped := sec + (1.0 - pow(1.0 - minf(frac * 6.0, 1.0), 3.0))
		_escape.rotation = stepped * TAU / 15.0 - sin(minf(frac * 6.0, 1.0) * PI) * 0.04
		if int(_time) != int(_time - dt):
			ticked.emit()
