extends Node2D
## A tall glass reservoir that feeds the planter — the clearest TEMPERATURE gauge in the room.
## FREEZING: solid ice · COLD: ice floes on a thawing column · TEMPERATE: still liquid ·
## WARM: gentle rising bubbles · SCORCHING: rolling boil, falling level, steam.
## Node origin is the bottom-centre of the vessel, standing on the floor.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const HALF_W := 70.0
const TOP := -400.0
const INNER_BOTTOM := -44.0
const FULL_LEVEL := -330.0

var temperature_level := 2.0
var light_level := 2.0
var age_level := 2.0
var _time := 0.0
var _bubbles: Array[Vector3] = []  # x offset, phase, size
var _trapped: Array[Vector3] = []


func set_levels(t: float, l: float, a: float) -> void:
	temperature_level = t
	light_level = l
	age_level = a


func _ready() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	for i in 46:
		_bubbles.append(Vector3(rng.randf_range(-HALF_W + 12, HALF_W - 12), rng.randf(), rng.randf_range(2.0, 6.0)))
	for i in 18:
		_trapped.append(Vector3(rng.randf_range(-HALF_W + 10, HALF_W - 10), rng.randf_range(FULL_LEVEL + 10, INNER_BOTTOM - 10), rng.randf_range(1.5, 4.0)))


func _process(delta: float) -> void:
	_time += delta
	queue_redraw()


func _draw() -> void:
	var t := temperature_level
	var tarnish := smoothstep(1.5, 4.0, age_level)
	var brass := Color(0.84, 0.64, 0.3).lerp(Color(0.5, 0.42, 0.26), tarnish)
	var ice := U.key5(t, [1.0, 0.42, 0.0, 0.0, 0.0])
	var level := FULL_LEVEL + U.key5(t, [0.0, 0.0, 0.0, 6.0, 70.0])  # evaporation lowers the level
	var wave_amp := U.key5(t, [0.0, 0.4, 1.0, 2.5, 7.0]) * (1.0 - ice)
	var bubbles := U.key5(t, [0.0, 0.0, 1.0, 14.0, 46.0])
	var bubble_speed := U.key5(t, [0.0, 0.0, 30.0, 70.0, 240.0])
	var steam := U.key5(t, [0.0, 0.0, 0.0, 0.15, 1.0])
	var liquid := U.key5c(t, [Color(0.6, 0.85, 0.95), Color(0.3, 0.7, 0.85), Color(0.18, 0.62, 0.72),
			Color(0.22, 0.68, 0.66), Color(0.4, 0.72, 0.65)])
	liquid.a = 0.82
	liquid = liquid.lerp(Color(0.38, 0.42, 0.25, 0.85), smoothstep(2.5, 4.0, age_level) * 0.45)

	# Back of the glass.
	U.quad(self, Vector2(-HALF_W, TOP + 30), Vector2(HALF_W, TOP + 30), Vector2(HALF_W, -30), Vector2(-HALF_W, -30), Color(0.12, 0.2, 0.24, 0.55))

	# Liquid column with a wavy surface.
	var surface := PackedVector2Array()
	var n := 16
	for i in n + 1:
		var x := lerpf(-HALF_W + 6, HALF_W - 6, float(i) / float(n))
		var y := level + sin(_time * 3.0 + x * 0.08) * wave_amp + sin(_time * 5.3 - x * 0.13) * wave_amp * 0.5
		surface.append(Vector2(x, y))
	for i in n:
		U.quad4(self, surface[i], surface[i + 1], Vector2(surface[i + 1].x, INNER_BOTTOM), Vector2(surface[i].x, INNER_BOTTOM),
				liquid.lightened(0.15), liquid.lightened(0.15), liquid.darkened(0.35), liquid.darkened(0.35))
	draw_polyline(surface, Color(0.85, 1.0, 1.0, 0.6), 2.0, true)

	# Bubbles rise (warm) or roll (scorching).
	var count := int(bubbles)
	for i in mini(count, _bubbles.size()):
		var b := _bubbles[i]
		var span := INNER_BOTTOM - level
		var y2 := INNER_BOTTOM - fmod(b.y * span + _time * bubble_speed * (0.6 + b.z * 0.1), span)
		var x2 := b.x + sin(_time * 4.0 + b.y * 20.0) * 3.0
		draw_arc(Vector2(x2, y2), b.z, 0.0, TAU, 10, Color(0.9, 1.0, 1.0, 0.7), 1.5, true)

	# Ice: a solid block that thins to floes as the column thaws.
	if ice > 0.01:
		var ice_c := Color(0.86, 0.94, 1.0, 0.92)
		var depth := (INNER_BOTTOM - level) * ice
		if ice > 0.7:
			var bottom := level + depth
			U.quad4(self, Vector2(-HALF_W + 6, level), Vector2(HALF_W - 6, level), Vector2(HALF_W - 6, bottom), Vector2(-HALF_W + 6, bottom),
					ice_c, ice_c, U.with_alpha(ice_c.darkened(0.15), 0.95), U.with_alpha(ice_c.darkened(0.15), 0.95))
			for tb in _trapped:
				if tb.y > level and tb.y < bottom:
					draw_circle(Vector2(tb.x, tb.y), tb.z, Color(1, 1, 1, 0.7))
			# Fracture lines.
			var fr := Color(0.6, 0.75, 0.9, 0.9)
			draw_polyline(PackedVector2Array([Vector2(-50, level + 30), Vector2(-20, level + 80), Vector2(-30, level + 140), Vector2(10, level + 200)]), fr, 1.5, true)
			draw_polyline(PackedVector2Array([Vector2(40, level + 60), Vector2(18, level + 110), Vector2(45, level + 180)]), fr, 1.5, true)
		else:
			# Floes bobbing on the surface.
			for k in 4:
				var fx := -48.0 + float(k) * 32.0
				var fy := level + sin(_time * 1.5 + float(k)) * 2.0
				var fw := 13.0 + float(k % 2) * 6.0
				U.quad(self, Vector2(fx - fw, fy - 4), Vector2(fx + fw, fy - 6), Vector2(fx + fw - 3, fy + 12 * ice * 2.0), Vector2(fx - fw + 2, fy + 10 * ice * 2.0), ice_c)
	# Glass: rim, highlights, frost, condensation, grime and an ageing crack.
	draw_line(Vector2(-HALF_W, TOP + 30), Vector2(-HALF_W, -30), Color(0.7, 0.9, 1.0, 0.5), 3.0)
	draw_line(Vector2(HALF_W, TOP + 30), Vector2(HALF_W, -30), Color(0.7, 0.9, 1.0, 0.35), 3.0)
	U.quad(self, Vector2(-HALF_W + 10, TOP + 40), Vector2(-HALF_W + 22, TOP + 40), Vector2(-HALF_W + 22, -40), Vector2(-HALF_W + 10, -40), Color(1, 1, 1, 0.12))
	var glass_frost := U.key5(t, [0.85, 0.3, 0.0, 0.0, 0.0])
	if glass_frost > 0.01:
		U.hgrad_rect(self, Rect2(-HALF_W, TOP + 30, HALF_W * 2.0, -30 - TOP - 30), Color(0.92, 0.97, 1.0, 0.5 * glass_frost), Color(0.92, 0.97, 1.0, 0.15 * glass_frost))
	var cond := U.key5(t, [0.0, 1.0, 0.2, 0.0, 0.0])
	if cond > 0.01:
		for k in 16:
			var cp := Vector2(-HALF_W + 8 + fmod(float(k) * 37.0, HALF_W * 2.0 - 16), TOP + 50 + fmod(float(k) * 91.0, 300.0) + fmod(_time * 8.0 + float(k) * 3.0, 20.0))
			draw_circle(cp, 2.5, Color(0.85, 0.95, 1.0, 0.6 * cond))
	var grime := smoothstep(2.0, 4.0, age_level)
	if grime > 0.01:
		U.vgrad_rect(self, Rect2(-HALF_W, -120, HALF_W * 2.0, 90), Color(0.3, 0.25, 0.12, 0.0), Color(0.3, 0.25, 0.12, 0.45 * grime))
		for k in 4:
			draw_line(Vector2(-HALF_W, level + 20 + float(k) * 6.0), Vector2(HALF_W, level + 20 + float(k) * 6.0), Color(0.85, 0.82, 0.7, 0.25 * grime), 1.5)
	if age_level > 3.3:
		var ck := clampf((age_level - 3.3) / 0.7, 0.0, 1.0)
		draw_polyline(PackedVector2Array([Vector2(30, TOP + 60), Vector2(18, TOP + 110), Vector2(36, TOP + 150), Vector2(22, TOP + 200)]), Color(1, 1, 1, 0.6 * ck), 1.5, true)

	# Brass caps.
	U.quad(self, Vector2(-HALF_W - 18, -34), Vector2(HALF_W + 18, -34), Vector2(HALF_W + 26, 0), Vector2(-HALF_W - 26, 0), brass.darkened(0.3))
	U.quad(self, Vector2(-HALF_W - 14, -30), Vector2(HALF_W + 4, -30), Vector2(HALF_W + 10, -4), Vector2(-HALF_W - 20, -4), brass)
	U.quad(self, Vector2(-HALF_W - 14, TOP), Vector2(HALF_W + 14, TOP), Vector2(HALF_W + 8, TOP + 32), Vector2(-HALF_W - 8, TOP + 32), brass.darkened(0.3))
	U.quad(self, Vector2(-HALF_W - 10, TOP + 3), Vector2(HALF_W + 2, TOP + 3), Vector2(HALF_W - 2, TOP + 28), Vector2(-HALF_W - 4, TOP + 28), brass)
	U.quad(self, Vector2(-14, TOP - 30), Vector2(14, TOP - 30), Vector2(20, TOP), Vector2(-20, TOP), brass.darkened(0.2))
	for x in [-HALF_W + 4.0, HALF_W - 4.0]:
		draw_line(Vector2(x, TOP + 30), Vector2(x, -34), brass.darkened(0.2), 4.0)
	if tarnish > 0.4:
		for k in 5:
			U.ellipse(self, Vector2(-60 + float(k) * 30.0, -16), 8.0, 5.0, Color(0.3, 0.55, 0.45, 0.6 * (tarnish - 0.4)), 10)
	if ice > 0.6:
		draw_line(Vector2(-HALF_W - 14, TOP + 2), Vector2(HALF_W + 14, TOP + 2), Color(0.92, 0.97, 1.0, 0.85 * ice), 5.0)

	# Steam above the vent (scorching), drawn last so it sits over the cap.
	if steam > 0.01:
		var puffs := int(4 + steam * 12)
		for k in puffs:
			var life := fmod(_time * 0.6 + float(k) * 0.37, 1.0)
			var px := sin(float(k) * 3.1 + _time) * 14.0 + life * 30.0 * sin(float(k))
			var py := TOP - 30 - life * 220.0
			draw_circle(Vector2(px, py), 10.0 + life * 30.0, Color(0.95, 0.95, 0.95, 0.32 * steam * (1.0 - life)))
