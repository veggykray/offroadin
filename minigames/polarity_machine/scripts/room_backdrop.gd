extends Node2D
## The room: wall, painted sigil, wainscot, floor and the pipes that join machine, lamp,
## water vessel and planter.
##
## AGE weathers it continuously: glossy fresh paint → worn → peeling and tarnished → cracked,
## stained, cobwebbed and dusty. Each blemish is generated once with a fixed seed and has an
## age threshold at which it fades (or, for cracks, grows) in. TEMPERATURE adds condensation,
## frost and icicles. LIGHT is handled by the atmosphere overlay above.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const W := 1920.0
const H := 1080.0
const WALL_BOTTOM := 800.0
const RAIL_Y := 560.0
const VANISH := Vector2(960, 250)
const SIGIL := Vector2(1060, 300)
const CEILING_PIPE_Y := 62.0
const FLOOR_PIPE_Y := 880.0
const LAMP_X := 600.0
const VESSEL_X := 260.0

var temperature_level := 2.0
var light_level := 2.0
var age_level := 2.0

var _peels: Array[Dictionary] = []
var _stains: Array[Dictionary] = []
var _cracks: Array[Dictionary] = []
var _scratches: Array[Dictionary] = []
var _spots: Array[Dictionary] = []
var _frost_blobs: Array[Dictionary] = []
var _drops: Array[Dictionary] = []
var _time := 0.0


func set_levels(t: float, l: float, a: float) -> void:
	temperature_level = t
	light_level = l
	age_level = a


func _ready() -> void:
	_generate()


func _process(delta: float) -> void:
	_time += delta
	queue_redraw()


func _generate() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7071
	# Peeling paint patches on the upper wall.
	for i in 16:
		var c := Vector2(rng.randf_range(40, 1220), rng.randf_range(90, 520))
		var poly := PackedVector2Array()
		var r := rng.randf_range(14, 42)
		for k in 11:
			var a := TAU * float(k) / 11.0
			poly.append(c + Vector2(cos(a), sin(a) * 0.8) * r * rng.randf_range(0.55, 1.15))
		_peels.append({"poly": poly, "at": rng.randf_range(2.4, 3.7)})
	# Water stains running down from the ceiling.
	for i in 9:
		var x := rng.randf_range(60, 1220)
		_stains.append({"x": x, "w": rng.randf_range(30, 90), "h": rng.randf_range(80, 260), "at": rng.randf_range(2.2, 3.6)})
	# Cracks: random walks that grow segment by segment as age passes their threshold.
	var starts := [Vector2(20, 60), Vector2(1240, 50), Vector2(SIGIL.x - 120, SIGIL.y + 40), Vector2(430, 560),
			Vector2(860, 120), Vector2(140, 400), Vector2(1180, 700)]
	for s in starts:
		var pts := PackedVector2Array([s])
		var dirv := Vector2(rng.randf_range(-1, 1), rng.randf_range(0.2, 1)).normalized()
		var p: Vector2 = s
		for k in rng.randi_range(8, 14):
			dirv = dirv.rotated(rng.randf_range(-0.7, 0.7)).normalized()
			p += dirv * rng.randf_range(14, 34)
			p = p.clamp(Vector2(4, 40), Vector2(1240, WALL_BOTTOM - 4))
			pts.append(p)
		_cracks.append({"pts": pts, "at": rng.randf_range(3.0, 3.6)})
	# Scuffs on the wainscot and floor.
	for i in 40:
		var p0 := Vector2(rng.randf_range(20, 1240), rng.randf_range(RAIL_Y + 20, H - 20))
		_scratches.append({"a": p0, "b": p0 + Vector2(rng.randf_range(-40, 40), rng.randf_range(-6, 6)), "at": rng.randf_range(1.0, 3.6)})
	# Corrosion spots along pipes.
	for i in 22:
		var on_ceiling := i % 2 == 0
		var x2 := rng.randf_range(LAMP_X + 20, 1440) if on_ceiling else rng.randf_range(820, 1230)
		var y2 := CEILING_PIPE_Y if on_ceiling else FLOOR_PIPE_Y
		_spots.append({"p": Vector2(x2, y2 + rng.randf_range(-8, 8)), "r": rng.randf_range(4, 11), "at": rng.randf_range(2.6, 3.8)})
	# Frost blooms on the wall near the floor and in corners.
	for i in 26:
		var p3 := Vector2(rng.randf_range(0, 1250), WALL_BOTTOM - rng.randf_range(0, 140))
		if i % 4 == 0:
			p3 = Vector2(rng.randf_range(0, 160), rng.randf_range(40, 700))
		_frost_blobs.append({"p": p3, "r": rng.randf_range(16, 54), "at": rng.randf_range(0.0, 1.0)})
	# Condensation droplets.
	for i in 60:
		_drops.append({"p": Vector2(rng.randf_range(20, 1240), rng.randf_range(80, 760)), "r": rng.randf_range(1.5, 3.5),
				"ph": rng.randf_range(0, 10)})


func _fade(at: float, span := 0.5) -> float:
	return clampf((age_level - at) / span, 0.0, 1.0)


func _draw() -> void:
	var a := age_level
	var fresh := U.key5(a, [1.0, 0.45, 0.0, 0.0, 0.0])
	var frost := U.key5(temperature_level, [1.0, 0.4, 0.0, 0.0, 0.0])
	var damp := U.key5(temperature_level, [0.3, 1.0, 0.1, 0.0, 0.0])

	# --- Wall ---
	var wall_top := U.key5c(a, [Color(0.09, 0.38, 0.42), Color(0.1, 0.34, 0.37), Color(0.11, 0.29, 0.31),
			Color(0.17, 0.26, 0.25), Color(0.21, 0.22, 0.19)])
	var wall_bot := wall_top.darkened(0.35)
	U.vgrad_rect(self, Rect2(0, 0, W, WALL_BOTTOM), wall_top, wall_bot)
	# Fresh-paint sheen.
	if fresh > 0.01:
		for k in 7:
			var x := 80.0 + float(k) * 180.0
			U.hgrad_rect(self, Rect2(x, 40, 70, RAIL_Y - 40), Color(1, 1, 1, 0.0), Color(1, 1, 1, 0.05 * fresh))
	# Gilded diamond lattice.
	var gold := Color(0.86, 0.68, 0.34, U.key5(a, [0.5, 0.42, 0.34, 0.24, 0.13]))
	for j in 6:
		for i in 24:
			var c := Vector2(40.0 + float(i) * 80.0, 82.0 + float(j) * 80.0)
			draw_polyline(PackedVector2Array([c + Vector2(0, -40), c + Vector2(40, 0), c + Vector2(0, 40), c + Vector2(-40, 0),
					c + Vector2(0, -40)]), gold, 1.5)
			draw_circle(c, 3.0, gold)
	# Painted Hermetic sigil: circle, triangle up and down, two opposed half-circles.
	var paint := Color(0.92, 0.84, 0.64, U.key5(a, [0.75, 0.66, 0.55, 0.38, 0.22]))
	draw_arc(SIGIL, 128.0, 0.0, TAU, 64, paint, 5.0, true)
	draw_arc(SIGIL, 112.0, 0.0, TAU, 64, paint, 2.0, true)
	var tri_up := PackedVector2Array()
	var tri_dn := PackedVector2Array()
	for k in 4:
		var ang := -PI * 0.5 + TAU * float(k) / 3.0
		tri_up.append(SIGIL + Vector2(cos(ang), sin(ang)) * 112.0)
		tri_dn.append(SIGIL + Vector2(cos(ang + PI), sin(ang + PI)) * 112.0)
	draw_polyline(tri_up, paint, 2.5, true)
	draw_polyline(tri_dn, paint, 2.5, true)
	draw_arc(SIGIL + Vector2(0, -28), 28.0, -PI * 0.5, PI * 0.5, 20, paint, 3.0, true)
	draw_arc(SIGIL + Vector2(0, 28), 28.0, PI * 0.5, PI * 1.5, 20, paint, 3.0, true)
	draw_arc(SIGIL, 56.0, 0.0, TAU, 40, paint, 2.0, true)
	draw_circle(SIGIL + Vector2(0, -28), 6.0, paint)
	draw_circle(SIGIL + Vector2(0, 28), 6.0, U.with_alpha(wall_top.darkened(0.5), paint.a * 1.3))

	# Ageing blemishes on the plaster.
	for st in _stains:
		var f := _fade(float(st["at"]), 0.6)
		if f <= 0.0:
			continue
		var x2 := float(st["x"])
		var sw := float(st["w"])
		var sh2 := float(st["h"]) * f
		U.vgrad_rect(self, Rect2(x2 - sw * 0.5, 36, sw, sh2), Color(0.25, 0.2, 0.1, 0.3 * f), Color(0.25, 0.2, 0.1, 0.0))
	for pe in _peels:
		var f2 := _fade(float(pe["at"]))
		if f2 < 0.08:
			continue
		var poly: PackedVector2Array = pe["poly"]
		var c2 := Vector2.ZERO
		for p in poly:
			c2 += p
		c2 /= float(poly.size())
		var scaled := PackedVector2Array()
		for p in poly:
			scaled.append(c2 + (p - c2) * f2)
		draw_colored_polygon(scaled, Color(0.42, 0.4, 0.33, 0.8))
		var edge := scaled.duplicate()
		edge.append(scaled[0])
		draw_polyline(edge, Color(0.08, 0.1, 0.1, 0.7), 2.0, true)
		draw_polyline(edge, Color(0.9, 0.86, 0.75, 0.4), 1.0, true)

	# --- Wainscot ---
	var wood := U.key5c(a, [Color(0.44, 0.16, 0.09), Color(0.41, 0.18, 0.1), Color(0.36, 0.2, 0.13),
			Color(0.33, 0.25, 0.19), Color(0.31, 0.29, 0.26)])
	U.vgrad_rect(self, Rect2(0, RAIL_Y, W, WALL_BOTTOM - RAIL_Y), wood, wood.darkened(0.3))
	for k in 12:
		var px := 20.0 + float(k) * 160.0
		var r := Rect2(px, RAIL_Y + 34, 130, WALL_BOTTOM - RAIL_Y - 64)
		draw_rect(r, wood.darkened(0.25))
		draw_rect(r.grow(-6), wood.lightened(0.04))
		draw_line(r.position, r.position + Vector2(r.size.x, 0), wood.darkened(0.5), 2.0)
		draw_line(r.position + Vector2(0, r.size.y), r.end, wood.lightened(0.2), 1.5)
		if fresh > 0.01:
			draw_line(r.position + Vector2(10, 10), r.position + Vector2(40, r.size.y - 10), Color(1, 1, 1, 0.08 * fresh), 6.0)
	# Brass chair rail and skirting.
	var brass := Color(0.84, 0.64, 0.3).lerp(Color(0.5, 0.42, 0.26), smoothstep(1.5, 4.0, a))
	U.vgrad_rect(self, Rect2(0, RAIL_Y - 8, W, 18), brass.lightened(0.2), brass.darkened(0.4))
	U.vgrad_rect(self, Rect2(0, WALL_BOTTOM - 22, W, 26), wood.darkened(0.45), wood.darkened(0.6))
	# Crown moulding.
	U.vgrad_rect(self, Rect2(0, 0, W, 38), Color(0.06, 0.05, 0.07), Color(0.12, 0.1, 0.12))
	draw_line(Vector2(0, 38), Vector2(W, 38), brass, 3.0)

	# --- Floor ---
	var floor_c := U.key5c(a, [Color(0.3, 0.14, 0.09), Color(0.28, 0.15, 0.1), Color(0.25, 0.16, 0.11),
			Color(0.25, 0.2, 0.16), Color(0.27, 0.25, 0.22)])
	U.vgrad_rect(self, Rect2(0, WALL_BOTTOM, W, H - WALL_BOTTOM), floor_c.darkened(0.35), floor_c)
	var t_top := (WALL_BOTTOM - VANISH.y) / (H - VANISH.y)
	for k in range(-14, 15):
		var xb := VANISH.x + float(k) * 150.0
		var xt := VANISH.x + (xb - VANISH.x) * t_top
		var xb2 := VANISH.x + float(k + 1) * 150.0
		var xt2 := VANISH.x + (xb2 - VANISH.x) * t_top
		var tone := 0.04 * sin(float(k) * 2.7)
		U.quad(self, Vector2(xt, WALL_BOTTOM), Vector2(xt2, WALL_BOTTOM), Vector2(xb2, H), Vector2(xb, H),
				Color(1, 1, 1, maxf(0.0, 0.025 + tone)))
		draw_line(Vector2(xt, WALL_BOTTOM), Vector2(xb, H), floor_c.darkened(0.55), 2.0)
	for row in [860.0, 950.0, 1040.0]:
		draw_line(Vector2(0, row), Vector2(W, row), U.with_alpha(floor_c.darkened(0.5), 0.6), 1.5)
	if fresh > 0.01:
		U.radial(self, Vector2(720, 960), 380.0, Color(1, 1, 1, 0.08 * fresh), U.CLEAR, 28, 0.25)
	for sc in _scratches:
		var f3 := _fade(float(sc["at"]), 0.8)
		if f3 > 0.0:
			draw_line(sc["a"], sc["b"], Color(0.85, 0.75, 0.6, 0.18 * f3), 1.5)
	# Dust settles on the floor.
	var dust := U.key5(a, [0.0, 0.0, 0.02, 0.1, 0.24])
	if dust > 0.001:
		U.vgrad_rect(self, Rect2(0, WALL_BOTTOM, W, H - WALL_BOTTOM), Color(0.62, 0.6, 0.55, dust * 0.5), Color(0.62, 0.6, 0.55, dust))

	# --- Pipes ---
	var pipe_c := brass.darkened(0.1)
	# Ceiling pipe: chimney → lamp.
	U.pipe(self, Vector2(LAMP_X - 30, CEILING_PIPE_Y), Vector2(1480, CEILING_PIPE_Y), 26.0, pipe_c)
	U.pipe(self, Vector2(LAMP_X, CEILING_PIPE_Y), Vector2(LAMP_X, 78), 16.0, pipe_c)
	for x in range(int(LAMP_X) + 80, 1440, 210):
		U.flange(self, Vector2(x, CEILING_PIPE_Y), Vector2(1, 0), 26.0, brass)
		draw_line(Vector2(x, CEILING_PIPE_Y - 13), Vector2(x, 38), brass.darkened(0.4), 3.0)
	draw_circle(Vector2(LAMP_X - 30, CEILING_PIPE_Y), 15.0, brass.darkened(0.3))
	# Floor pipe: machine → planter pedestal.
	U.pipe(self, Vector2(1250, FLOOR_PIPE_Y), Vector2(745, FLOOR_PIPE_Y), 30.0, pipe_c)
	for x in [1180.0, 980.0, 820.0]:
		U.flange(self, Vector2(x, FLOOR_PIPE_Y), Vector2(1, 0), 30.0, brass)
	# Water pipe: vessel → planter pedestal.
	U.pipe(self, Vector2(VESSEL_X + 60, 790), Vector2(430, 790), 20.0, pipe_c)
	U.pipe(self, Vector2(430, 780), Vector2(430, FLOOR_PIPE_Y), 20.0, pipe_c)
	U.pipe(self, Vector2(420, FLOOR_PIPE_Y), Vector2(695, FLOOR_PIPE_Y), 20.0, pipe_c)
	draw_circle(Vector2(430, 790), 13.0, brass.darkened(0.25))
	draw_circle(Vector2(430, FLOOR_PIPE_Y), 13.0, brass.darkened(0.25))
	# A valve wheel on the water pipe.
	draw_arc(Vector2(560, FLOOR_PIPE_Y - 26), 16.0, 0.0, TAU, 20, brass, 4.0, true)
	draw_line(Vector2(560, FLOOR_PIPE_Y - 10), Vector2(560, FLOOR_PIPE_Y), brass, 4.0)
	# Corrosion on pipes.
	for sp in _spots:
		var f4 := _fade(float(sp["at"]))
		if f4 > 0.0:
			U.ellipse(self, sp["p"], float(sp["r"]) * f4, float(sp["r"]) * 0.7 * f4, Color(0.32, 0.56, 0.46, 0.75), 10)
			draw_circle((sp["p"] as Vector2) + Vector2(2, 3), float(sp["r"]) * 0.4 * f4, Color(0.45, 0.25, 0.12, 0.6))

	# --- Cracks (grow in) ---
	for cr in _cracks:
		var f5 := _fade(float(cr["at"]), 0.7)
		if f5 <= 0.0:
			continue
		var pts: PackedVector2Array = cr["pts"]
		var n := int(ceil(float(pts.size() - 1) * f5)) + 1
		var sub := pts.slice(0, n)
		draw_polyline(sub, Color(0.04, 0.03, 0.03, 0.85), 2.5, true)
		var hl := PackedVector2Array()
		for p in sub:
			hl.append(p + Vector2(1.5, 1.5))
		draw_polyline(hl, Color(0.8, 0.75, 0.65, 0.25), 1.0, true)

	# --- Cobwebs in the corners (ancient) ---
	var web := _fade(3.5, 0.5)
	if web > 0.0:
		var wc := Color(0.85, 0.85, 0.8, 0.35 * web)
		for corner in [Vector2(0, 38), Vector2(1244, 38)]:
			var sgn := 1.0 if corner.x < 10.0 else -1.0
			for k in 5:
				var ang := float(k) / 4.0 * PI * 0.5
				draw_line(corner, corner + Vector2(sgn * cos(ang), sin(ang)) * 130.0, wc, 1.0)
			for r in [40.0, 75.0, 110.0]:
				var arc := PackedVector2Array()
				for k in 9:
					var ang2 := float(k) / 8.0 * PI * 0.5
					arc.append(corner + Vector2(sgn * cos(ang2), sin(ang2)) * r * (1.0 - 0.08 * sin(ang2 * 4.0)))
				draw_polyline(arc, wc, 1.0, true)

	# --- Temperature on surfaces ---
	if damp > 0.01:
		for d in _drops:
			var dp: Vector2 = d["p"]
			var slide := fmod(_time * 6.0 + float(d["ph"]) * 10.0, 30.0)
			draw_circle(dp + Vector2(0, slide), float(d["r"]), Color(0.75, 0.9, 1.0, 0.45 * damp))
	if frost > 0.01:
		for fb in _frost_blobs:
			var k2 := clampf((frost - float(fb["at"]) * 0.6) / 0.4, 0.0, 1.0)
			if k2 <= 0.0:
				continue
			U.radial(self, fb["p"], float(fb["r"]) * (0.6 + 0.4 * k2), Color(0.88, 0.95, 1.0, 0.55 * k2), Color(0.88, 0.95, 1.0, 0.0), 16)
		# Rime along pipes and rail, icicles from the ceiling pipe.
		draw_line(Vector2(LAMP_X - 30, CEILING_PIPE_Y + 11), Vector2(1480, CEILING_PIPE_Y + 11), Color(0.92, 0.97, 1.0, 0.8 * frost), 5.0)
		draw_line(Vector2(745, FLOOR_PIPE_Y - 14), Vector2(1250, FLOOR_PIPE_Y - 14), Color(0.92, 0.97, 1.0, 0.8 * frost), 5.0)
		draw_line(Vector2(0, RAIL_Y - 9), Vector2(1250, RAIL_Y - 9), Color(0.92, 0.97, 1.0, 0.6 * frost), 4.0)
		for k in 34:
			var x3 := LAMP_X + 20.0 + float(k) * 25.0
			var ln := (10.0 + 28.0 * absf(sin(float(k) * 2.1))) * frost
			U.tri(self, Vector2(x3 - 4, CEILING_PIPE_Y + 12), Vector2(x3 + 4, CEILING_PIPE_Y + 12),
					Vector2(x3, CEILING_PIPE_Y + 12 + ln), Color(0.85, 0.94, 1.0, 0.85))
