extends Node2D
## The machine cabinet (drawn in design space) and its read-outs:
##   moisture porthole  the soil's moisture as a water level behind glass
##   indicator lamps    orange = the plant is ailing (blinks as a warning
##                      while harsh conditions build up), green = healthy
##                      (pulses while recovering), cyan = pump running /
##                      reservoir refilling
##   gears, pipes, glass tube  move and bubble whenever something happens
## The four controls are child nodes positioned over this body.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const BRASS := Color(0.84, 0.64, 0.30)
var BODY := PackedVector2Array([Vector2(1205, 205), Vector2(1302, 104), Vector2(1698, 104), Vector2(1795, 205),
		Vector2(1795, 965), Vector2(1205, 965)])
const GEAR_FRAC := [0.0, 0.18, 0.5, 0.68]
const PORTHOLE := Vector2(1622, 560)
const PORTHOLE_R := 86.0
const BUTTON := Vector2(1748, 668)
const LAMPS := [Vector2(1752, 728), Vector2(1752, 766), Vector2(1752, 804)]

var rules
var pump := 0.0          # seconds left of the pump-running light
var _moist := 0.0        # eased moisture 0..4
var _gear := 0.0
var _gear_speed := 0.0
var _pulse := 0.0
var _pulse_color := Color(1, 0.85, 0.45)
var _steam := 0.0
var _time := 0.0


func snap() -> void:
	if rules:
		_moist = rules.water


## A mechanical shudder: gears jump forward.
func jolt(amount := 1.0) -> void:
	_gear_speed = maxf(_gear_speed, 2.5 * amount)


## Glow pulse over the cabinet (success, flowering…).
func pulse(strength: float, color: Color) -> void:
	_pulse = maxf(_pulse, strength)
	_pulse_color = color
	_steam = maxf(_steam, strength)
	jolt(strength * 2.0)


func core_position() -> Vector2:
	return Vector2(1492, 295)


func _process(dt: float) -> void:
	_time += dt
	pump = maxf(0.0, pump - dt)
	_pulse = maxf(0.0, _pulse - dt * 0.45)
	_steam = maxf(0.0, _steam - dt * 0.35)
	_gear_speed = move_toward(_gear_speed, 0.12, dt * 2.0)
	_gear += _gear_speed * dt
	if rules:
		_moist = U.approach(_moist, rules.water, 2.5, dt)
	queue_redraw()


func _draw() -> void:
	_pipes_above()
	_side_gears()
	# Body.
	var sh := BODY.duplicate()
	for i in sh.size():
		sh[i] += Vector2(10, 12)
	draw_colored_polygon(sh, Color(0, 0, 0, 0.5))
	draw_colored_polygon(BODY, Color(0.13, 0.09, 0.07))
	# Wood grain panels.
	for x in range(1215, 1790, 12):
		draw_line(Vector2(x, 210), Vector2(x + 3, 960), Color(0.2, 0.13, 0.09, 0.5), 1.0)
	var inner := PackedVector2Array()
	for p in BODY:
		inner.append(p + (Vector2(1500, 560) - p).normalized() * 16.0)
	inner.append(inner[0])
	var outline := BODY.duplicate()
	outline.append(outline[0])
	draw_polyline(outline, BRASS, 6.0, true)
	draw_polyline(inner, BRASS.darkened(0.25), 2.0, true)
	for i in BODY.size():
		var a := BODY[i]
		var b := BODY[(i + 1) % BODY.size()]
		var n := int(a.distance_to(b) / 60.0)
		for k in n:
			U.rivet(self, a.lerp(b, (k + 0.5) / float(n)) + (Vector2(1500, 560) - a.lerp(b, (k + 0.5) / float(n))).normalized() * 8.0, 3.0, BRASS)
	_engravings()
	_porthole()
	# Blue conduit from the button to the porthole.
	var flow := clampf(pump * 2.0, 0.0, 1.0)
	draw_line(BUTTON + Vector2(-26, 0), PORTHOLE + Vector2(PORTHOLE_R * 0.7, PORTHOLE_R * 0.7), Color(0.3, 0.6, 1.0).lerp(Color(0.8, 0.95, 1.0), flow), 3.0, true)
	_lamps()
	_vent()
	_side_tube()
	if _pulse > 0.0:
		var pc := _pulse_color
		pc.a = _pulse * 0.8
		draw_polyline(outline, pc, 10.0 * _pulse, true)


func _pipes_above() -> void:
	for x in [1350.0, 1440.0, 1560.0, 1650.0]:
		U.pipe(self, Vector2(x, 0), Vector2(x, 110), 26, BRASS.darkened(0.1))
		U.flange(self, Vector2(x, 60), Vector2.DOWN, 26, BRASS)
		if _steam > 0.0:
			for k in 4:
				var s := fmod(_time * 0.8 + k * 0.25, 1.0)
				draw_circle(Vector2(x + sin(_time * 3.0 + k) * 10.0, 40 - s * 60.0), 10 + s * 18, Color(0.9, 0.9, 0.95, 0.3 * _steam * (1.0 - s)))


func _side_gears() -> void:
	_gear_at(Vector2(1210, 420), 62, 16, _gear)
	_gear_at(Vector2(1800, 270), 56, 14, -_gear * 1.1)
	_gear_at(Vector2(1806, 620), 42, 12, _gear * 1.4)


func _gear_at(c: Vector2, r: float, teeth: int, rot: float) -> void:
	var body := PackedVector2Array()
	for i in teeth * 4:
		var tk := i / 4
		var a: float = rot + TAU * (float(tk) + GEAR_FRAC[i % 4]) / float(teeth)
		var rr := r if (i % 4 == 1 or i % 4 == 2) else r * 0.84
		body.append(c + Vector2(cos(a), sin(a)) * rr)
	draw_colored_polygon(body, BRASS.darkened(0.15))
	draw_circle(c, r * 0.62, BRASS.darkened(0.4))
	for k in 5:
		var d := Vector2.from_angle(rot + TAU * k / 5.0)
		draw_line(c + d * r * 0.15, c + d * r * 0.62, BRASS.darkened(0.1), r * 0.12)
	draw_circle(c, r * 0.18, BRASS.lightened(0.2))


func _engravings() -> void:
	var col := Color(BRASS.r, BRASS.g, BRASS.b, 0.35)
	for p in [Vector2(1265, 880), Vector2(1250, 690), Vector2(1700, 245), Vector2(1310, 200), Vector2(1740, 890)]:
		for k in 8:
			var d := Vector2.from_angle(TAU * k / 8.0)
			draw_line(p, p + d * (14.0 if k % 2 == 0 else 7.0), col, 1.2)
		draw_arc(p, 9, 0, TAU, 16, col, 1.0)


func _porthole() -> void:
	var c := PORTHOLE
	var r := PORTHOLE_R
	draw_circle(c + Vector2(4, 6), r + 12, Color(0, 0, 0, 0.45))
	draw_circle(c, r + 12, BRASS.darkened(0.4))
	draw_circle(c, r + 6, BRASS)
	for k in 12:
		U.rivet(self, c + Vector2.from_angle(TAU * k / 12.0) * (r + 6), 2.5, BRASS)
	draw_circle(c, r, Color(0.05, 0.09, 0.16))
	# Water level = soil moisture (0..4 fills the glass from the bottom).
	var level := clampf(_moist / 4.0, 0.0, 1.0) * 0.9 + 0.05
	var sy := c.y + r - level * 2.0 * r
	var top := PackedVector2Array()
	var bottom := PackedVector2Array()
	for i in 25:
		var x := lerpf(-r, r, float(i) / 24.0) * 0.999
		var lim := sqrt(maxf(0.0, r * r - x * x))
		var y := sy + sin(_time * 2.4 + x * 0.08) * (2.0 + pump * 5.0)
		top.append(Vector2(c.x + x, clampf(y, c.y - lim, c.y + lim)))
		bottom.append(Vector2(c.x + x, c.y + lim))
	var water := Color(0.2, 0.5, 0.95).lerp(Color(0.5, 0.8, 1.0), clampf(pump, 0.0, 0.6))
	U.strip(self, top, bottom, water)
	draw_polyline(top, Color(0.8, 0.95, 1.0, 0.8), 2.0, true)
	# Five level marks on the rim of the glass.
	for k in 5:
		var y2 := c.y + r - (float(k) / 4.0 * 0.9 + 0.05) * 2.0 * r
		var x3 := sqrt(maxf(0.0, r * r - (y2 - c.y) * (y2 - c.y)))
		draw_line(Vector2(c.x - x3, y2), Vector2(c.x - x3 + 12, y2), Color(0.9, 0.8, 0.55, 0.8), 2.0)
	# Drop and wave emblem etched in the glass, as on the reference machine.
	var dc := c + Vector2(0, -24)
	var drop := U.drop(dc, 10.0)
	draw_colored_polygon(drop, Color(0.85, 0.95, 1.0, 0.35))
	for k in 2:
		var wave := PackedVector2Array()
		for i in 13:
			var x4 := lerpf(-36, 36, float(i) / 12.0)
			wave.append(c + Vector2(x4, 18 + k * 12 + sin(x4 * 0.15 + _time) * 4.0))
		draw_polyline(wave, Color(0.85, 0.95, 1.0, 0.3), 2.0, true)
	# Glass sheen.
	draw_arc(c, r - 8, -2.6, -1.4, 16, Color(1, 1, 1, 0.3), 5.0, true)


func _lamps() -> void:
	var blink := 0.5 + 0.5 * sin(_time * 9.0)
	var orange := 0.12
	var green := 0.12
	var cyan := 0.12
	if rules:
		if rules.ailment != "":
			orange = 1.0
			green = 0.12 + 0.6 * rules.recovery * (0.5 + 0.5 * sin(_time * 6.0))
		else:
			green = 1.0
			if rules.harm > 0.05:
				orange = 0.15 + 0.85 * blink * clampf(rules.harm * 1.6, 0.0, 1.0)
		if pump > 0.0:
			cyan = 1.0
		elif rules.tank < rules.TANK_CAPACITY:
			cyan = 0.25 + 0.2 * sin(_time * 3.0)
	var cols := [Color(1.0, 0.55, 0.15), Color(0.35, 1.0, 0.4), Color(0.4, 0.9, 1.0)]
	var on := [orange, green, cyan]
	for i in 3:
		var p: Vector2 = LAMPS[i]
		var c: Color = cols[i]
		var k: float = on[i]
		draw_circle(p, 15, BRASS.darkened(0.4))
		draw_circle(p, 12, BRASS)
		if k > 0.3:
			for j in 3:
				draw_circle(p, 12 + j * 6, Color(c.r, c.g, c.b, 0.12 * k))
		draw_circle(p, 9, c.darkened(0.8 - 0.8 * k))
		draw_circle(p - Vector2(3, 3), 3, Color(1, 1, 1, 0.25 + 0.4 * k))


func _vent() -> void:
	var r := Rect2(1712, 880, 64, 56)
	draw_rect(r, Color(0.05, 0.04, 0.04))
	for k in 7:
		draw_line(Vector2(r.position.x + 4, r.position.y + 6 + k * 7), Vector2(r.end.x - 4, r.position.y + 6 + k * 7), Color(0.25, 0.18, 0.12), 3.0)
	draw_rect(r, BRASS.darkened(0.3), false, 2.0)


func _side_tube() -> void:
	var r := Rect2(1800, 330, 22, 220)
	draw_rect(r, Color(0.15, 0.35, 0.6, 0.6))
	for k in 6:
		var y := r.end.y - fmod(_time * (30.0 + 80.0 * pump) + k * 37.0, r.size.y)
		draw_circle(Vector2(r.position.x + 11 + sin(y * 0.1) * 4, y), 2.5, Color(0.8, 0.95, 1.0, 0.7))
	draw_rect(r, BRASS, false, 2.0)
	draw_rect(Rect2(r.position.x - 4, r.position.y - 10, 30, 10), BRASS)
	draw_rect(Rect2(r.position.x - 4, r.end.y, 30, 10), BRASS)
