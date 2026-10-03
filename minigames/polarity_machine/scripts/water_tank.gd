extends Node2D
## The tall glass reservoir, its riser pipe, the valve and the brass spout
## that points into the plant chamber, plus the floor pipe that runs to the
## machine. The water level shows how many sprays are left; each spray
## lowers it and the pipework lights up while the pump runs. The tank refills
## slowly through the inlet at the top (a visible trickle).

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

## Where the spray leaves the nozzle, and the direction it points (design space).
const NOZZLE := Vector2(528, 350)
const NOZZLE_DIR := Vector2(0.82, 0.57)

const TANK_X0 := 168.0
const TANK_X1 := 288.0
const GLASS_TOP := 302.0
const GLASS_BOTTOM := 688.0
const BRASS := Color(0.82, 0.62, 0.28)
const WATER := Color(0.30, 0.62, 0.95)

## Wired by the root.
var rules
## 0..1 visible fill, eased toward the rules' tank level.
var level: float = 1.0
## Seconds left of the "pump running" glow.
var pumping: float = 0.0
var _time: float = 0.0
var _bubbles: Array = []  # [x, y, r, speed]
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 9
	for i in 18:
		_bubbles.append([_rng.randf_range(TANK_X0 + 10, TANK_X1 - 10), _rng.randf_range(GLASS_TOP, GLASS_BOTTOM),
				_rng.randf_range(1.5, 4.0), _rng.randf_range(20, 60)])


func pump() -> void:
	pumping = 0.9


func _process(dt: float) -> void:
	_time += dt
	pumping = maxf(0.0, pumping - dt)
	if rules:
		var target := float(rules.tank) / float(rules.TANK_CAPACITY)
		level = U.approach(level, target, 0.25, dt)
	var surface := _surface_y()
	for b in _bubbles:
		b[1] -= b[3] * dt * (2.5 if pumping > 0.0 else 1.0)
		if b[1] < surface + 4:
			b[1] = GLASS_BOTTOM - 4
			b[0] = _rng.randf_range(TANK_X0 + 10, TANK_X1 - 10)
	queue_redraw()


func _surface_y() -> float:
	return lerpf(GLASS_BOTTOM - 6, GLASS_TOP + 18, level)


func refilling() -> bool:
	return rules != null and rules.tank < rules.TANK_CAPACITY


func _draw() -> void:
	_floor_pipe()
	_riser_and_spout()
	_tank()


func _floor_pipe() -> void:
	var y := 772.0
	U.pipe(self, Vector2(TANK_X1 - 4, y), Vector2(1215, y), 18, BRASS.darkened(0.15))
	# Blue glass sections that light while the pump runs.
	for x in [380.0, 560.0, 960.0, 1120.0]:
		var glow := 0.25 + 0.75 * clampf(pumping * 2.0, 0.0, 1.0) * (0.6 + 0.4 * sin(_time * 18.0 - x * 0.05))
		draw_rect(Rect2(x, y - 7, 70, 14), Color(0.25, 0.55, 0.9).lerp(Color(0.6, 0.9, 1.0), glow * 0.6))
		draw_rect(Rect2(x, y - 7, 70, 4), Color(1, 1, 1, 0.25))
		U.flange(self, Vector2(x, y), Vector2.RIGHT, 18, BRASS)
		U.flange(self, Vector2(x + 70, y), Vector2.RIGHT, 18, BRASS)
	# Valve wheel, as on the reference.
	var vc := Vector2(338, y)
	draw_line(vc, vc + Vector2(0, -30), BRASS.darkened(0.3), 5.0)
	draw_arc(vc + Vector2(0, -42), 13, 0, TAU, 20, BRASS, 3.0, true)
	for k in 4:
		var d := Vector2.from_angle(k * PI / 2 + _time * (6.0 if pumping > 0.0 else 0.0))
		draw_line(vc + Vector2(0, -42), vc + Vector2(0, -42) + d * 13, BRASS, 2.0)


func _riser_and_spout() -> void:
	var cx := (TANK_X0 + TANK_X1) * 0.5
	var top := Vector2(cx, 250)
	var corner := Vector2(cx, 222)
	var over := Vector2(420, 222)
	var valve := Vector2(440, 300)
	var flow := clampf(pumping * 2.0, 0.0, 1.0)
	var tint := BRASS.lerp(Color(0.55, 0.8, 1.0), flow * 0.35)
	U.pipe(self, top, corner, 20, tint)
	U.pipe(self, corner + Vector2(-10, 0), over, 20, tint)
	draw_circle(corner, 13, tint.darkened(0.2))
	draw_circle(over, 13, tint.darkened(0.2))
	U.pipe(self, over, valve, 20, tint)
	# Valve body with a water-drop badge.
	draw_circle(valve, 26, BRASS.darkened(0.25))
	draw_circle(valve, 21, BRASS)
	draw_circle(valve, 15, Color(0.12, 0.14, 0.2))
	var drop := U.drop(valve + Vector2(0, 1), 7.0)
	draw_colored_polygon(drop, Color(0.55, 0.8, 1.0).lerp(Color(0.85, 0.97, 1.0), flow))
	# Spout: a tapered brass nozzle aimed into the cage.
	var a0 := valve + NOZZLE_DIR * 18
	var n := NOZZLE_DIR.orthogonal()
	var poly := PackedVector2Array([a0 + n * 11, NOZZLE + n * 6, NOZZLE - n * 6, a0 - n * 11])
	draw_colored_polygon(poly, BRASS.darkened(0.1))
	draw_line(a0 + n * 7, NOZZLE + n * 3, BRASS.lightened(0.4), 2.0)
	draw_circle(NOZZLE, 7, BRASS.darkened(0.35))
	draw_circle(NOZZLE, 4, Color(0.08, 0.1, 0.14))
	if flow > 0.0:
		U.radial(self, NOZZLE, 26, Color(0.6, 0.85, 1.0, 0.5 * flow), Color(0.6, 0.85, 1.0, 0.0))


func _tank() -> void:
	var cx := (TANK_X0 + TANK_X1) * 0.5
	var w := TANK_X1 - TANK_X0
	# Back of the glass.
	draw_rect(Rect2(TANK_X0, GLASS_TOP, w, GLASS_BOTTOM - GLASS_TOP), Color(0.12, 0.2, 0.3, 0.55))
	# Water.
	var sy := _surface_y()
	var deep := WATER.darkened(0.35)
	var lit := WATER.lightened(0.15).lerp(Color(0.7, 0.92, 1.0), clampf(pumping, 0.0, 0.6))
	U.vgrad_rect(self, Rect2(TANK_X0 + 3, sy, w - 6, GLASS_BOTTOM - sy), lit, deep)
	var wave := PackedVector2Array()
	for i in 13:
		var x := TANK_X0 + 3 + (w - 6) * float(i) / 12.0
		wave.append(Vector2(x, sy + sin(_time * 3.0 + x * 0.12) * (1.5 + pumping * 4.0)))
	draw_polyline(wave, Color(0.85, 0.97, 1.0, 0.9), 2.0, true)
	for b in _bubbles:
		if b[1] > sy:
			draw_arc(Vector2(b[0] + sin(_time * 2.0 + b[1] * 0.1) * 2.0, b[1]), b[2], 0, TAU, 10, Color(0.85, 0.97, 1.0, 0.6), 1.0)
	# Inner glow of the luminous water.
	U.radial(self, Vector2(cx, (sy + GLASS_BOTTOM) * 0.5), w * 0.9, Color(0.4, 0.75, 1.0, 0.16), Color(0.4, 0.75, 1.0, 0.0), 24, 1.8)
	# Level ticks on the glass (one per two sprays).
	for k in 8:
		var y := lerpf(GLASS_BOTTOM - 6, GLASS_TOP + 18, float(k) / 7.0)
		draw_line(Vector2(TANK_X1 - 16, y), Vector2(TANK_X1 - 6, y), Color(0.9, 0.8, 0.55, 0.6), 1.5)
	# Glass highlights.
	draw_rect(Rect2(TANK_X0 + 10, GLASS_TOP + 6, 8, GLASS_BOTTOM - GLASS_TOP - 12), Color(1, 1, 1, 0.16))
	draw_rect(Rect2(TANK_X1 - 30, GLASS_TOP + 6, 4, GLASS_BOTTOM - GLASS_TOP - 12), Color(1, 1, 1, 0.1))
	draw_rect(Rect2(TANK_X0, GLASS_TOP, w, GLASS_BOTTOM - GLASS_TOP), Color(0.75, 0.9, 1.0, 0.35), false, 2.0)
	# Brass rods.
	for x in [TANK_X0 - 4, TANK_X1 + 4]:
		draw_line(Vector2(x, GLASS_TOP), Vector2(x, GLASS_BOTTOM), BRASS.darkened(0.2), 5.0)
	# Inlet trickle while refilling.
	if refilling():
		var tx := cx + 20
		var drip_y := GLASS_TOP + fmod(_time * 260.0, maxf(20.0, sy - GLASS_TOP))
		draw_line(Vector2(tx, GLASS_TOP), Vector2(tx, sy), Color(0.7, 0.9, 1.0, 0.35), 1.5)
		draw_circle(Vector2(tx, drip_y), 2.5, Color(0.8, 0.95, 1.0, 0.8))
	# Caps.
	_cap(Rect2(TANK_X0 - 18, GLASS_TOP - 46, w + 36, 46), true)
	_cap(Rect2(TANK_X0 - 22, GLASS_BOTTOM, w + 44, 70), false)
	draw_rect(Rect2(TANK_X0 - 34, GLASS_BOTTOM + 70, w + 68, 38), BRASS.darkened(0.35))
	draw_rect(Rect2(TANK_X0 - 34, GLASS_BOTTOM + 70, w + 68, 6), BRASS.lightened(0.1))
	# Emblem on the base.
	var e := Vector2(cx, GLASS_BOTTOM + 36)
	draw_circle(e, 22, BRASS.darkened(0.3))
	draw_arc(e, 18, 0, TAU, 24, BRASS.lightened(0.3), 1.5, true)
	for k in 8:
		var d := Vector2.from_angle(k * PI / 4)
		draw_line(e + d * 6, e + d * 15, BRASS.lightened(0.3), 1.5)
	draw_circle(e, 5, BRASS.lightened(0.4))


func _cap(r: Rect2, top: bool) -> void:
	U.vgrad_rect(self, r, BRASS.lightened(0.15) if top else BRASS.darkened(0.1), BRASS.darkened(0.35))
	draw_rect(Rect2(r.position.x, r.position.y + (0 if top else r.size.y - 6), r.size.x, 6), BRASS.lightened(0.3))
	for i in 5:
		U.rivet(self, Vector2(r.position.x + 12 + i * (r.size.x - 24) / 4.0, r.position.y + r.size.y * 0.5), 3.0, BRASS)
