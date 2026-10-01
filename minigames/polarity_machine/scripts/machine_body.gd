extends Node2D
## The alchemical machine cabinet: housing, chimneys, gears, the core globe and indicator jewels.
## Its three controls are children. Draws in Stage coordinates (node sits at the origin).
##
## Reacts to the room (frost on pipes, glowing metal, tarnish) and to puzzle events via
## pulse(), jolt() and settle().

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const BODY := [Vector2(1262, 1080), Vector2(1244, 610), Vector2(1288, 505), Vector2(1310, 190),
		Vector2(1398, 98), Vector2(1722, 98), Vector2(1816, 172), Vector2(1856, 430), Vector2(1890, 1080)]
const CORE := Vector2(1734, 622)
const CORE_R := 86.0
const GEAR_A := Vector2(1252, 470)
const GEAR_B := Vector2(1868, 318)
const CHIMNEYS := [Vector2(1470, 98), Vector2(1655, 98)]
const JEWELS := [Vector2(1838, 752), Vector2(1842, 790), Vector2(1846, 828)]

var temperature_level := 2.0
var light_level := 2.0
var age_level := 2.0

var _time := 0.0
var _gear_rot := 0.0
var _gear_vel := 0.0
var _pulse := 0.0
var _pulse_col := Color(1.0, 0.8, 0.4)
var _settle := 0.0
var _waves: Array[Dictionary] = []
var _puffs: Array[Dictionary] = []

@onready var controls: Array[Node] = [$TemperatureLever, $LightIris, $AgeDial]


func set_levels(t: float, l: float, a: float) -> void:
	temperature_level = t
	light_level = l
	age_level = a
	var amb := ambient()
	for c in controls:
		c.set("heat", t)
		c.set("wear", a)
		c.set("ambient", amb)


## Brightness of the machine in the current room light. Never so dark it can't be used.
func ambient() -> float:
	return U.key5(light_level, [0.52, 0.68, 0.88, 1.0, 1.08])


func core_position() -> Vector2:
	return CORE


## A wave of light through the machine. strength 0..1.
func pulse(strength := 0.5, col := Color(1.0, 0.8, 0.4)) -> void:
	_pulse = maxf(_pulse, strength)
	_pulse_col = col
	_waves.append({"t": 0.0, "s": strength, "c": col})


## A mechanical kick: the gears spin a little.
func jolt(amount := 1.0) -> void:
	_gear_vel += 2.5 * amount


## The machine exhales: vent steam, gears coast down.
func settle() -> void:
	_settle = 1.0
	for i in 10:
		_puffs.append({"p": CHIMNEYS[i % 2] + Vector2(randf_range(-8, 8), -10), "v": Vector2(randf_range(-20, 20), randf_range(-90, -50)),
				"t": -float(i) * 0.08, "r": randf_range(10, 18)})


func reset() -> void:
	_pulse = 0.0
	_settle = 0.0
	_waves.clear()
	_puffs.clear()


func _process(delta: float) -> void:
	_time += delta
	_gear_vel = lerpf(_gear_vel, 0.0, 1.0 - exp(-delta * 1.8))
	_gear_rot += delta * (0.12 + _gear_vel)
	_pulse = maxf(0.0, _pulse - delta * 0.8)
	_settle = maxf(0.0, _settle - delta * 0.5)
	for w in _waves:
		w["t"] = float(w["t"]) + delta
	_waves.assign(_waves.filter(func(w: Dictionary) -> bool: return float(w["t"]) < 1.6))
	for p in _puffs:
		p["t"] = float(p["t"]) + delta
		if float(p["t"]) > 0.0:
			p["p"] = (p["p"] as Vector2) + (p["v"] as Vector2) * delta
	_puffs.assign(_puffs.filter(func(p: Dictionary) -> bool: return float(p["t"]) < 2.0))
	queue_redraw()


func _draw() -> void:
	var amb := ambient()
	var frost := U.key5(temperature_level, [1.0, 0.45, 0.0, 0.0, 0.0])
	var hot := U.key5(temperature_level, [0.0, 0.0, 0.0, 0.15, 1.0])
	var tarnish := smoothstep(1.5, 4.0, age_level)
	var brass := U.shade(Color(0.86, 0.66, 0.30).lerp(Color(0.55, 0.45, 0.27), tarnish), amb)
	var iron := U.shade(Color(0.16, 0.13, 0.15), amb)
	var body_pts := PackedVector2Array(BODY)

	# Shadow cast on the wall.
	var shadow := PackedVector2Array()
	for p in BODY:
		shadow.append((p as Vector2) + Vector2(-40, 10))
	draw_colored_polygon(shadow, Color(0, 0, 0, 0.35))

	# Gears peeking out from behind the cabinet.
	_draw_gear(GEAR_A, 74.0, 14, _gear_rot, brass.darkened(0.2))
	_draw_gear(GEAR_B, 58.0, 11, -_gear_rot * 1.27, brass.darkened(0.25))

	# Chimneys up to the ceiling (the ceiling pipe to the lamp feeds into the left one).
	for i in CHIMNEYS.size():
		var c: Vector2 = CHIMNEYS[i]
		var w := 44.0 if i == 0 else 32.0
		var col := brass.darkened(0.1).lerp(Color(1.0, 0.4, 0.15), hot * 0.5)
		U.pipe(self, c, Vector2(c.x, -4), w, col)
		for k in 3:
			U.flange(self, Vector2(c.x, 24 + k * 26.0), Vector2(0, 1), w, brass)
		if frost > 0.01:
			draw_rect(Rect2(c.x - w * 0.5 - 2.0, 0, w + 4.0, 90), Color(0.88, 0.95, 1.0, 0.35 * frost))

	# Cabinet body.
	draw_colored_polygon(body_pts, iron)
	var inner := PackedVector2Array()
	var centroid := Vector2(1570, 600)
	for p in BODY:
		inner.append(centroid + ((p as Vector2) - centroid) * 0.965)
	draw_colored_polygon(inner, U.shade(Color(0.21, 0.17, 0.2), amb))
	# Vertical sheet seams and a vertical light falloff.
	for x in [1360.0, 1540.0, 1700.0]:
		draw_line(Vector2(x, 130), Vector2(x, 1080), U.shade(Color(0.1, 0.08, 0.1), amb), 2.0)
	U.vgrad_rect(self, Rect2(1250, 700, 640, 380), Color(0, 0, 0, 0), Color(0, 0, 0, 0.35))
	var outline := body_pts.duplicate()
	outline.append(BODY[0])
	draw_polyline(outline, brass, 7.0, true)
	draw_polyline(outline, U.shade(Color(1, 0.9, 0.6, 0.35), amb), 1.5, true)
	# Rivets along the trim.
	for i in BODY.size() - 1:
		var a: Vector2 = BODY[i]
		var b: Vector2 = BODY[i + 1]
		var steps := int(a.distance_to(b) / 48.0)
		for k in range(1, steps):
			var p := a.lerp(b, float(k) / float(steps))
			U.rivet(self, centroid + (p - centroid) * 0.985, 3.5, brass)
	# Verdigris creeping over the trim as the room ages.
	if tarnish > 0.4:
		var vk := (tarnish - 0.4) / 0.6
		for i in 14:
			var a2: Vector2 = BODY[i % (BODY.size() - 1)]
			var b2: Vector2 = BODY[i % (BODY.size() - 1) + 1]
			var p2 := a2.lerp(b2, fmod(float(i) * 0.37, 1.0))
			U.ellipse(self, p2, 9.0 + float(i % 4) * 3.0, 6.0, Color(0.3, 0.55, 0.45, 0.6 * vk), 12)

	# Bezel for the core globe and the vent grille.
	_draw_core(amb, frost, hot)
	for k in 6:
		var y := 965.0 + k * 14.0
		draw_line(Vector2(1330, y), Vector2(1440, y), U.shade(Color(0.05, 0.04, 0.05), amb), 5.0)
		draw_line(Vector2(1330, y + 2), Vector2(1440, y + 2), U.shade(Color(0.3, 0.25, 0.25), amb), 1.0)

	# Pipe stubs leaving the cabinet toward the planter.
	var pipe_col := brass.darkened(0.15).lerp(Color(1.0, 0.42, 0.15), hot * 0.55)
	U.pipe(self, Vector2(1236, 880), Vector2(1300, 880), 30.0, pipe_col)
	U.flange(self, Vector2(1262, 880), Vector2(1, 0), 30.0, brass)
	if frost > 0.01:
		draw_rect(Rect2(1236, 862, 64, 9), Color(0.9, 0.96, 1.0, 0.6 * frost))

	# Indicator jewels, one per continuum. Not shaded by ambient: they stay readable in the dark.
	var tj := U.key5c(temperature_level, [Color(0.5, 0.8, 1.0), Color(0.55, 0.7, 0.95), Color(0.8, 0.8, 0.7), Color(1.0, 0.65, 0.3), Color(1.0, 0.3, 0.1)])
	var lj := Color(1.0, 0.9, 0.6).lerp(Color(0.15, 0.1, 0.05), 1.0 - light_level / 4.0)
	lj = lj.lerp(Color(0.35, 0.12, 0.05), 0.0)
	var aj := U.key5c(age_level, [Color(0.75, 1.0, 0.55), Color(0.45, 0.9, 0.4), Color(0.3, 0.75, 0.45), Color(0.8, 0.65, 0.25), Color(0.6, 0.4, 0.3)])
	var jewel_cols := [tj, lj.lerp(Color(1, 0.75, 0.4), 0.25), aj]
	for i in 3:
		var jp: Vector2 = JEWELS[i]
		var jc: Color = jewel_cols[i]
		draw_circle(jp, 13.0, U.shade(Color(0.05, 0.04, 0.04), 1.0))
		draw_circle(jp, 10.0, brass)
		U.radial(self, jp, 26.0, U.with_alpha(jc, 0.45), U.CLEAR, 14)
		draw_circle(jp, 7.0, jc)
		draw_circle(jp + Vector2(-2, -2), 2.5, jc.lightened(0.6))

	# Pulse waves (success / growth responses) spreading over the cabinet.
	for w in _waves:
		var t := float(w["t"])
		var s := float(w["s"])
		var c: Color = w["c"]
		var r := 40.0 + t * 520.0
		var a := (1.0 - t / 1.6) * s
		draw_arc(CORE, r, 0.0, TAU, 72, Color(c.r, c.g, c.b, 0.55 * a), 6.0 + 10.0 * a, true)

	# Steam puffs from the chimneys when the machine settles.
	for p in _puffs:
		var pt := float(p["t"])
		if pt <= 0.0:
			continue
		var r2 := float(p["r"]) * (1.0 + pt * 1.4)
		draw_circle(p["p"], r2, Color(0.92, 0.9, 0.88, 0.35 * (1.0 - pt / 2.0)))


func _draw_core(amb: float, frost: float, hot: float) -> void:
	var brass := U.shade(Color(0.86, 0.66, 0.30).lerp(Color(0.55, 0.45, 0.27), smoothstep(1.5, 4.0, age_level)), amb)
	draw_circle(CORE, CORE_R + 18.0, U.shade(Color(0.04, 0.03, 0.04), amb))
	draw_circle(CORE, CORE_R + 12.0, brass)
	draw_circle(CORE, CORE_R + 4.0, brass.darkened(0.45))
	# Fluid inside: colour from temperature, brightness from light, swirl speed from age.
	var fc := U.key5c(temperature_level, [Color(0.6, 0.88, 1.0), Color(0.4, 0.68, 0.95), Color(0.42, 0.85, 0.7),
			Color(1.0, 0.72, 0.3), Color(1.0, 0.36, 0.14)])
	var bright := U.key5(light_level, [0.35, 0.5, 0.7, 0.9, 1.0]) + _pulse * 0.6
	draw_circle(CORE, CORE_R, Color(0.03, 0.03, 0.05))
	U.radial(self, CORE, CORE_R, U.shade(fc, 0.55 * bright), U.shade(fc, 0.12 * bright), 32)
	var spin := _time * (0.4 + age_level * 0.35)
	for k in 6:
		var r := CORE_R * (0.25 + 0.12 * float(k))
		var a0 := spin * (1.0 + float(k) * 0.15) * (1.0 if k % 2 == 0 else -1.0) + float(k)
		draw_arc(CORE, r, a0, a0 + 2.2, 18, U.shade(fc, bright * 1.2), 3.0, true)
	if _pulse > 0.01:
		U.radial(self, CORE, CORE_R * 1.6, U.with_alpha(_pulse_col, 0.5 * _pulse), U.CLEAR, 28)
	# The polarity sigil engraved over the glass: two opposed half-circles.
	var sc := Color(1, 0.95, 0.8, 0.35)
	draw_arc(CORE + Vector2(0, -CORE_R * 0.5), CORE_R * 0.5, -PI * 0.5, PI * 0.5, 16, sc, 2.0, true)
	draw_arc(CORE + Vector2(0, CORE_R * 0.5), CORE_R * 0.5, PI * 0.5, PI * 1.5, 16, sc, 2.0, true)
	draw_arc(CORE, CORE_R, 0.0, TAU, 48, sc, 1.5, true)
	# Glass highlight, frost and heat.
	U.ellipse(self, CORE + Vector2(-28, -36), 24.0, 14.0, Color(1, 1, 1, 0.22), 16)
	if frost > 0.01:
		U.radial(self, CORE, CORE_R, U.CLEAR, Color(0.9, 0.97, 1.0, 0.7 * frost), 32)
	if hot > 0.01:
		draw_arc(CORE, CORE_R + 12.0, 0.0, TAU, 64, Color(1.0, 0.45, 0.15, 0.7 * hot), 5.0, true)
	for k in 10:
		var a := float(k) * TAU / 10.0
		U.rivet(self, CORE + Vector2(cos(a), sin(a)) * (CORE_R + 8.0), 3.0, brass)


func _draw_gear(c: Vector2, r: float, teeth: int, rot: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in teeth * 4:
		var a := rot + TAU * float(i) / float(teeth * 4)
		var rr := r if (i % 4) < 2 else r * 0.84
		pts.append(c + Vector2(cos(a), sin(a)) * rr)
	draw_colored_polygon(pts, col.darkened(0.4))
	draw_circle(c, r * 0.78, col)
	draw_circle(c, r * 0.3, col.darkened(0.5))
	for k in 5:
		var a2 := rot + float(k) * TAU / 5.0
		draw_circle(c + Vector2(cos(a2), sin(a2)) * r * 0.55, r * 0.12, col.darkened(0.55))
