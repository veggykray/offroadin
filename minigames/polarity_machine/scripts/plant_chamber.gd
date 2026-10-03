extends Node2D
## The plant chamber: hanging brass lamp, the egg-shaped cage, the brass bowl
## with its soil, and the procedural plant.
##
## Everything the player needs to read is on the plant itself:
##   soil       pale & cracked (dry) … dark (moist) … glistening puddles (waterlogged)
##   posture    wilts when dry, slumps when waterlogged, stands up when well watered
##   light      leaves fold shut in the dark, plant grows pale and stretched in low light,
##              lush and open in bright light
##   heat       frost and a blue cast when cold, curled brown leaf tips when hot
##   ailments   lasting marks of a bad upbringing (crisp, yellow, pale, frost-bitten,
##              scorched) that fade as the plant is nursed back
##   bloom      a small bud when it is getting close, a violet flower, and the fruit
## All values are eased so that every change is visibly animated.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const ROOT := Vector2(740, 668)
const BULB := Vector2(740, 172)
const CAGE_CX := 740.0
const CAGE_TOP := 216.0
const CAGE_MID_Y := 452.0
const CAGE_R := 192.0
const RIM_Y := 668.0
const BRASS := Color(0.84, 0.64, 0.30)

var rules

# Eased display values.
var g := 0.0          # stage 0..4
var m := 0.0          # moisture 0..4
var l := 0.0          # light 0..3
var t := 0.0          # temperature 0..3
var bud_v := 0.0
var flower_v := 0.0   # 0 closed / absent .. 1 fully open
var fruit_v := 0.0
var near_v := 0.0     # "two of three" heart glow
var ail := {"dry": 0.0, "drowned": 0.0, "dark": 0.0, "leggy": 0.0, "frost": 0.0, "scorch": 0.0}
var solved_v := 0.0
var _time := 0.0
## Pulse used when the plant grows, to make the change feel physical.
var _grow_kick := 0.0


func _ready() -> void:
	snap()


## Jump all eased values to the rules state (start / reset).
func snap() -> void:
	if rules == null:
		return
	g = rules.stage
	m = rules.water
	l = rules.light
	t = rules.temp
	bud_v = rules.bud
	flower_v = 1.0 if rules.flowered else 0.0
	fruit_v = rules.fruit
	solved_v = 1.0 if rules.is_solved else 0.0
	for k in ail.keys():
		ail[k] = 1.0 if rules.ailment == k else 0.0
	queue_redraw()


func kick() -> void:
	_grow_kick = 1.0


## Where the flower / fruit sits (design space), for flashes and sparkles.
func bloom_point() -> Vector2:
	return _tip()


func hit_plant(p: Vector2) -> bool:
	var top := ROOT.y - _height() - 40.0
	return p.x > CAGE_CX - 150 and p.x < CAGE_CX + 150 and p.y > top and p.y < RIM_Y + 10


func _process(dt: float) -> void:
	_time += dt
	_grow_kick = maxf(0.0, _grow_kick - dt * 1.5)
	if rules:
		g = U.approach(g, rules.stage, 1.1, dt)
		m = U.approach(m, rules.water, 2.0, dt)
		l = U.approach(l, rules.light, 3.0, dt)
		t = U.approach(t, rules.temp, 2.0, dt)
		bud_v = U.approach(bud_v, rules.bud if rules.stage >= 3 else 0.0, 0.6, dt)
		var open_target := 0.0
		if rules.flowered and rules.stage >= 3:
			open_target = 1.0 if rules.light >= 2 else 0.55
		flower_v = U.approach(flower_v, open_target, 0.8, dt)
		fruit_v = U.approach(fruit_v, rules.fruit, 0.5, dt)
		var near: bool = rules.flowered and rules.stage == 3 and rules.is_healthy() and rules.fruit_matches() >= 2
		near_v = U.approach(near_v, 1.0 if near else 0.0, 1.2, dt)
		solved_v = U.approach(solved_v, 1.0 if rules.is_solved else 0.0, 0.7, dt)
		for k in ail.keys():
			var target: float = (1.0 - rules.recovery) if rules.ailment == k else 0.0
			ail[k] = U.approach(ail[k], target, 0.8, dt)
	queue_redraw()


# --- Derived appearance --------------------------------------------------------------------

func _old() -> float:
	return smoothstep(3.0, 4.0, g)


func _leggy() -> float:
	return clampf(2.0 - l, 0.0, 1.0) * 0.6 + ail["leggy"] * 0.8 + ail["dark"] * 0.5


func _wilt() -> float:
	var w := U.key5(m, [1.0, 0.4, 0.0, 0.08, 0.6])
	w += ail["dry"] * 0.45 + ail["drowned"] * 0.35 + _old() * 0.35
	w += clampf(1.0 - t, 0.0, 1.0) * 0.25 + clampf(t - 2.0, 0.0, 1.0) * 0.3
	return clampf(w, 0.0, 1.3)


func _frost() -> float:
	return clampf(1.0 - t, 0.0, 1.0)


func _heat() -> float:
	return clampf(t - 2.0, 0.0, 1.0)


func _fold() -> float:
	return clampf(1.0 - l, 0.0, 1.0)


func _lush() -> float:
	return clampf(l - 2.0, 0.0, 1.0) * (1.0 - _old())


func _height() -> float:
	return U.key5(g, [58.0, 150.0, 245.0, 285.0, 262.0]) * (1.0 + 0.3 * _leggy()) * (1.0 + 0.04 * _grow_kick)


func _stem_pts() -> PackedVector2Array:
	var h := _height()
	var sway := sin(_time * 1.3) * 3.0 * (1.0 - _frost() * 0.8)
	var bend := _wilt() * h * 0.32 + sway
	var p1 := ROOT + Vector2(0, -h * 0.55)
	var p2 := ROOT + Vector2(bend, -h + _wilt() * h * 0.18)
	var pts := PackedVector2Array()
	for i in 17:
		var s := float(i) / 16.0
		var a := ROOT.lerp(p1, s)
		var b := p1.lerp(p2, s)
		pts.append(a.lerp(b, s))
	return pts


func _tip() -> Vector2:
	var pts := _stem_pts()
	return pts[pts.size() - 1]


func _leaf_color() -> Color:
	var c := Color(0.25, 0.53, 0.2).lerp(Color(0.33, 0.68, 0.25), _lush())
	c = c.lerp(Color(0.66, 0.76, 0.48), clampf(_leggy() * 0.65, 0.0, 0.8))
	c = c.lerp(Color(0.74, 0.68, 0.25), clampf(ail["drowned"] * 0.75 + _old() * 0.7 + smoothstep(3.3, 4.0, m) * 0.25, 0.0, 0.9))
	c = c.lerp(Color(0.55, 0.42, 0.22), clampf(ail["dry"] * 0.55 + smoothstep(1.0, 0.0, m) * 0.25, 0.0, 0.8))
	c = c.lerp(Color(0.72, 0.86, 0.95), _frost() * 0.5)
	c = c.lerp(Color(0.25, 0.32, 0.3), ail["frost"] * 0.45)
	return c


# --- Drawing --------------------------------------------------------------------------------

func _draw() -> void:
	_lamp()
	_cage(false)
	_bowl_back()
	_soil()
	_plant()
	_bowl_front()
	_cage(true)


func _lamp() -> void:
	draw_line(Vector2(BULB.x, 0), Vector2(BULB.x, 82), BRASS.darkened(0.35), 6.0)
	for y in [20.0, 46.0]:
		draw_rect(Rect2(BULB.x - 7, y, 14, 8), BRASS)
	var c := Vector2(BULB.x, 156)
	# Dome shade.
	var dome := PackedVector2Array()
	for i in 25:
		var a := PI + PI * float(i) / 24.0
		dome.append(c + Vector2(cos(a) * 104, sin(a) * 70))
	draw_colored_polygon(dome, BRASS.darkened(0.25))
	var hi := PackedVector2Array()
	for i in 13:
		var a := PI * 1.15 + PI * 0.45 * float(i) / 12.0
		hi.append(c + Vector2(cos(a) * 90, sin(a) * 60))
	draw_polyline(hi, BRASS.lightened(0.45), 4.0, true)
	draw_circle(Vector2(BULB.x, 86), 12, BRASS)
	# Sun emblem on the shade.
	var e := c + Vector2(0, -36)
	draw_circle(e, 13, BRASS.lightened(0.2))
	for k in 12:
		var d := Vector2.from_angle(TAU * k / 12.0)
		draw_line(e + d * 14, e + d * 20, BRASS.lightened(0.2), 2.0)
	# Rim and bulb.
	draw_set_transform(c, 0.0, Vector2(1.0, 0.18))
	draw_circle(Vector2.ZERO, 108, BRASS.darkened(0.45))
	draw_circle(Vector2.ZERO, 98, Color(0.12, 0.08, 0.05))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var bulb := Color(0.25, 0.22, 0.2).lerp(Color(1.0, 0.82, 0.5), clampf(l / 1.5, 0.0, 1.0)).lerp(Color(1.0, 0.97, 0.85), clampf(l - 2.0, 0.0, 1.0))
	draw_circle(BULB, 17, bulb)
	draw_circle(BULB - Vector2(5, 5), 5, Color(1, 1, 1, 0.3 + 0.2 * l))


## Egg-shaped cage of brass meridians. front=false draws the far half.
func _cage(front: bool) -> void:
	var frost := _frost()
	var col := BRASS if front else BRASS.darkened(0.45)
	col.a = 1.0 if front else 0.8
	for k in 16:
		var phi := TAU * float(k) / 16.0 + 0.1
		var z := sin(phi)
		if (z > 0.0) != front:
			continue
		var pts := PackedVector2Array()
		for i in 25:
			var y := lerpf(CAGE_TOP, RIM_Y, float(i) / 24.0)
			pts.append(Vector2(CAGE_CX + _cage_r(y) * cos(phi), y))
		draw_polyline(pts, col, 3.0 if front else 2.0, true)
		if front:
			draw_polyline(pts, Color(1, 0.9, 0.65, 0.35), 1.0, true)
			if frost > 0.05:
				for i in range(2, 24, 3):
					draw_circle(pts[i] + Vector2(1, 0), 2.0, Color(0.9, 0.97, 1.0, 0.7 * frost))
	for y in [300.0, CAGE_MID_Y, 580.0]:
		var r := _cage_r(y)
		var a0 := 0.0 if front else PI
		draw_set_transform(Vector2(CAGE_CX, y), 0.0, Vector2(1.0, 0.13))
		draw_arc(Vector2.ZERO, r, a0, a0 + PI, 40, col, 3.0 if front else 2.0, true)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if front:
		draw_circle(Vector2(CAGE_CX, CAGE_TOP - 4), 9, BRASS)
		draw_circle(Vector2(CAGE_CX, CAGE_TOP - 4), 4, BRASS.lightened(0.4))
		draw_arc(Vector2(CAGE_CX, CAGE_TOP - 18), 8, 0, TAU, 12, BRASS, 2.0)


func _cage_r(y: float) -> float:
	if y >= CAGE_MID_Y:
		return CAGE_R + (y - CAGE_MID_Y) * 0.04
	var k := (CAGE_MID_Y - y) / (CAGE_MID_Y - CAGE_TOP)
	return CAGE_R * sqrt(maxf(0.0, 1.0 - k * k))


func _bowl_back() -> void:
	draw_set_transform(ROOT, 0.0, Vector2(1.0, 0.15))
	draw_circle(Vector2.ZERO, 214, BRASS.darkened(0.5))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _soil() -> void:
	var dry := Color(0.6, 0.47, 0.32)
	var col := U.key5c(m, [dry, Color(0.40, 0.27, 0.16), Color(0.22, 0.13, 0.07), Color(0.13, 0.08, 0.05), Color(0.11, 0.09, 0.09)])
	col = col.lerp(Color(0.8, 0.85, 0.9), _frost() * 0.25)
	draw_set_transform(ROOT + Vector2(0, 2), 0.0, Vector2(1.0, 0.13))
	draw_circle(Vector2.ZERO, 200, col)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var rng := RandomNumberGenerator.new()
	rng.seed = 31
	# Cracks in dry soil.
	var crack := smoothstep(1.2, 0.0, m)
	if crack > 0.01:
		for i in 9:
			var p := ROOT + Vector2(rng.randf_range(-170, 170), rng.randf_range(-14, 18))
			var q := p + Vector2(rng.randf_range(-30, 30), rng.randf_range(-5, 5))
			draw_line(p, q, Color(0.32, 0.22, 0.14, crack), 1.5)
			draw_line(q, q + Vector2(rng.randf_range(-15, 15), rng.randf_range(-4, 4)), Color(0.32, 0.22, 0.14, crack), 1.0)
	# Crumbs and pebbles.
	for i in 26:
		var p2 := ROOT + Vector2(rng.randf_range(-185, 185), rng.randf_range(-16, 20))
		draw_circle(p2, rng.randf_range(1.0, 2.6), col.lightened(0.18) if i % 2 == 0 else col.darkened(0.3))
	# Glints when wet, puddles when waterlogged.
	var wet := smoothstep(2.4, 3.2, m)
	for i in 10:
		var p3 := ROOT + Vector2(rng.randf_range(-170, 170), rng.randf_range(-12, 16))
		draw_line(p3, p3 + Vector2(5, 0), Color(0.8, 0.9, 1.0, 0.55 * wet), 1.5)
	var pud := smoothstep(3.2, 4.0, m)
	if pud > 0.01:
		for spec in [[Vector2(-110, 6), 52.0], [Vector2(70, -2), 64.0], [Vector2(150, 10), 28.0]]:
			var c: Vector2 = ROOT + spec[0]
			draw_set_transform(c, 0.0, Vector2(1.0, 0.16))
			draw_circle(Vector2.ZERO, spec[1] * pud, Color(0.35, 0.5, 0.7, 0.75))
			draw_arc(Vector2.ZERO, spec[1] * pud * (0.5 + 0.5 * fmod(_time * 0.5, 1.0)), 0, TAU, 24, Color(0.8, 0.9, 1.0, 0.4 * (1.0 - fmod(_time * 0.5, 1.0))), 3.0)
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if _frost() > 0.05:
		for i in 40:
			var p4 := ROOT + Vector2(rng.randf_range(-190, 190), rng.randf_range(-16, 20))
			draw_circle(p4, 1.2, Color(0.95, 0.98, 1.0, 0.8 * _frost()))
	# Fallen leaves once old.
	var old := _old()
	if old > 0.3:
		for i in 3:
			var p5 := ROOT + Vector2(-120 + i * 95, 8 - i * 3)
			draw_colored_polygon(U.circle_pts(p5, 14, 10, 0.4 * i, 0.35), Color(0.55, 0.4, 0.18, old))


func _plant() -> void:
	var pts := _stem_pts()
	var old := _old()
	var leggy := _leggy()
	var base_w := U.key5(g, [4.0, 7.0, 10.0, 11.5, 12.0]) * (1.0 - 0.35 * leggy)
	var widths := PackedFloat32Array()
	for i in pts.size():
		widths.append(lerpf(base_w, 1.8, float(i) / float(pts.size() - 1)))
	var stem_col := Color(0.28, 0.5, 0.2).lerp(Color(0.6, 0.7, 0.45), clampf(leggy * 0.6, 0, 0.8))
	stem_col = stem_col.lerp(Color(0.42, 0.32, 0.2), old * 0.85)
	U.ribbon(self, pts, widths, stem_col)
	if old > 0.2:
		for i in range(3, pts.size() - 2, 3):
			draw_line(pts[i] + Vector2(-2, 0), pts[i + 1] + Vector2(2, 0), stem_col.darkened(0.4), 1.5)
	# Cotyledons on a seedling.
	var coty := 1.0 - smoothstep(0.7, 1.5, g)
	if coty > 0.02:
		for s in [-1.0, 1.0]:
			_leaf(pts[pts.size() - 1], Vector2(s * 0.85, -0.5).normalized(), 32.0 * coty, 19.0 * coty, 0.6)
	# True leaves.
	var count := U.key5(g, [0.0, 4.0, 8.0, 10.0, 8.5])
	var leaf_len := U.key5(g, [0.0, 44.0, 62.0, 66.0, 56.0]) * (1.0 + 0.15 * _lush()) * (1.0 - 0.25 * leggy)
	for i in 10:
		var vis := clampf(count - float(i), 0.0, 1.0)
		if vis <= 0.0:
			continue
		var s := 0.18 + 0.075 * i
		var idx := clampi(int(s * (pts.size() - 1)), 1, pts.size() - 2)
		var p := pts[idx]
		var tangent := (pts[idx + 1] - pts[idx - 1]).normalized()
		var side := -1.0 if i % 2 == 0 else 1.0
		var up_angle := deg_to_rad(68.0 - 10.0 * _lush() + 6.0 * float(i % 3)) * (1.0 - 0.65 * _fold())
		var dir := tangent.rotated(side * (up_angle + PI * 0.0))
		dir = dir.rotated(side * _wilt() * 1.1)
		var size_k := (0.8 + 0.35 * (1.0 - float(i) / 10.0)) * vis
		_leaf(p, dir, leaf_len * size_k, leaf_len * size_k * 0.42 * (1.0 - 0.7 * _fold()) * (1.0 - 0.25 * _heat()), side)
	_bloom()


## One leaf from base b along dir. side = which way it droops (+1 right, -1 left).
func _leaf(b: Vector2, dir: Vector2, length: float, width: float, side: float) -> void:
	if length < 2.0:
		return
	var heat := _heat()
	var curl: float = heat * 0.35 + ail["scorch"] * 0.3
	length *= 1.0 - curl * 0.35
	var droop := _wilt()
	var down := Vector2(0, 1)
	var d2 := dir.lerp(down, clampf(droop * 0.55, 0.0, 0.9)).normalized()
	var mid := PackedVector2Array()
	for i in 9:
		var s := float(i) / 8.0
		var a := b + dir * length * 0.5 * s
		var c := b + dir * length * 0.5 + d2 * length * 0.5 * s
		mid.append(a.lerp(c, s))
	var left := PackedVector2Array()
	var right := PackedVector2Array()
	for i in mid.size():
		var s := float(i) / float(mid.size() - 1)
		var tg := (mid[mini(i + 1, mid.size() - 1)] - mid[maxi(i - 1, 0)]).normalized()
		var n := tg.orthogonal()
		var w := width * 0.5 * pow(sin(PI * clampf(s * 0.92 + 0.04, 0.0, 1.0)), 0.7)
		left.append(mid[i] + n * w)
		right.append(mid[i] - n * w)
	var poly := left.duplicate()
	for i in range(right.size() - 1, -1, -1):
		poly.append(right[i])
	var col := _leaf_color()
	U.strip(self, left, right, col)
	# Scorched / dry tips.
	var tip_burn: float = clampf(heat * 0.7 + ail["scorch"] + ail["dry"] * 0.6 + smoothstep(1.0, 0.0, m) * 0.4, 0.0, 1.0)
	if tip_burn > 0.05:
		var k := mid.size() - 3
		U.strip(self, left.slice(k), right.slice(k), Color(0.42, 0.26, 0.12, tip_burn))
	# Midrib and outline.
	draw_polyline(mid, col.darkened(0.35), 1.2, true)
	poly.append(poly[0])
	draw_polyline(poly, col.darkened(0.3), 1.0, true)
	# Frost crystals, frost-bite blotches, wet gloss.
	var frost := _frost()
	if frost > 0.2:
		for i in range(1, mid.size() - 1, 2):
			var p := mid[i]
			draw_line(p - Vector2(3, 0), p + Vector2(3, 0), Color(0.95, 0.98, 1.0, frost), 1.0)
			draw_line(p - Vector2(0, 3), p + Vector2(0, 3), Color(0.95, 0.98, 1.0, frost), 1.0)
	if ail["frost"] > 0.05:
		draw_circle(mid[3] + (left[3] - mid[3]) * 0.4, width * 0.15, Color(0.12, 0.14, 0.12, ail["frost"] * 0.8))
		draw_circle(mid[5] + (right[5] - mid[5]) * 0.3, width * 0.12, Color(0.12, 0.14, 0.12, ail["frost"] * 0.8))
	if ail["drowned"] > 0.1:
		draw_circle(mid[4], width * 0.12, Color(0.55, 0.45, 0.1, ail["drowned"] * 0.7))
	var gloss := smoothstep(2.4, 3.4, m)
	if gloss > 0.05:
		draw_line(left[2].lerp(mid[2], 0.4), left[5].lerp(mid[5], 0.4), Color(1, 1, 1, 0.35 * gloss), 1.5, true)
		if m > 3.4:
			draw_circle(mid[mid.size() - 1] + Vector2(0, 3), 2.5, Color(0.7, 0.88, 1.0, 0.8))


func _bloom() -> void:
	var tip := _tip()
	var old := _old()
	if bud_v > 0.01 and flower_v < 0.05 and fruit_v < 0.05:
		var r := 6.0 + 12.0 * bud_v
		U.radial(self, tip + Vector2(0, -r), r * 2.6, Color(0.85, 0.65, 1.0, 0.25 * bud_v), Color(0.85, 0.65, 1.0, 0.0))
		var bud := PackedVector2Array()
		for i in 14:
			var a := TAU * float(i) / 14.0
			var p := Vector2(cos(a) * r * 0.7, sin(a) * r)
			if p.y < 0.0:
				p.x *= 1.0 + p.y / (r * 1.6)
			bud.append(tip + Vector2(0, -r) + p)
		draw_colored_polygon(bud, Color(0.3, 0.55, 0.22).lerp(Color(0.6, 0.38, 0.75), bud_v * 0.7))
		draw_line(tip + Vector2(0, -r * 2), tip + Vector2(0, -r * 0.4), Color(0.75, 0.55, 0.9, bud_v), 1.5)
	if flower_v > 0.01 or (rules and rules.flowered):
		var open := flower_v * (1.0 - old * 0.6)
		var petal_alpha := 1.0 - smoothstep(0.2, 0.75, fruit_v)
		var petal := Color(0.58, 0.36, 0.88).lerp(Color(0.45, 0.32, 0.2), old)
		var plen := 32.0 * (1.0 - old * 0.3)
		if petal_alpha > 0.02:
			for k in 6:
				var a := -PI * 0.5 + (k - 2.5) * (0.22 + 0.36 * open)
				a += old * 0.9 * (1.0 if k >= 3 else -1.0)
				var d := Vector2.from_angle(a)
				var c := tip + d * plen * 0.5 + Vector2(0, -6)
				var pts := U.circle_pts(c, plen * 0.5, 12, a, 0.38 + 0.12 * open)
				var pc := petal
				pc.a = petal_alpha
				draw_colored_polygon(pts, pc)
				draw_line(tip + Vector2(0, -6), c + d * plen * 0.3, Color(0.9, 0.75, 1.0, 0.5 * petal_alpha), 1.0)
		# Glowing heart: brighter when two of three conditions are right.
		var heart := Color(1.0, 0.82, 0.35).lerp(Color(1.0, 0.95, 0.7), near_v)
		draw_circle(tip + Vector2(0, -6), 8.0, heart.darkened(0.3 * (1.0 - near_v)))
		if near_v > 0.01:
			var pulse := 0.5 + 0.5 * sin(_time * 4.0)
			U.radial(self, tip + Vector2(0, -6), 22 + 10 * pulse, Color(1.0, 0.9, 0.5, 0.45 * near_v), Color(1.0, 0.9, 0.5, 0.0))
	if fruit_v > 0.01:
		# The fruit swells on a short stalk that bends out to the side under its weight.
		var hang := tip + Vector2(14.0 + 30.0 * fruit_v, 4.0 + 26.0 * fruit_v)
		draw_line(tip, hang + Vector2(0, -5.0 - 30.0 * fruit_v), Color(0.3, 0.42, 0.2), 3.0, true)
		_fruit(hang, 6.0 + 30.0 * fruit_v)


## The polarity fruit: one half deep night-indigo, one half sun-gold, joined by
## an S-shaped glowing seam, with a little brass-green crown.
func _fruit(c: Vector2, r: float) -> void:
	var pulse := 0.5 + 0.5 * sin(_time * 3.0)
	U.radial(self, c, r * (2.2 + solved_v), Color(1.0, 0.85, 0.5, 0.25 + 0.25 * solved_v * pulse), Color(1.0, 0.85, 0.5, 0.0))
	draw_line(c + Vector2(0, -r), c + Vector2(0, -r - 16), Color(0.3, 0.42, 0.2), 3.0)
	var body := U.circle_pts(c, r, 40, 0.0, 1.06)
	draw_colored_polygon(body, Color(0.95, 0.72, 0.28))
	# Dark half bounded by the S seam.
	var dark := PackedVector2Array()
	for i in 21:
		var a := -PI * 0.5 - PI * float(i) / 20.0
		dark.append(c + Vector2(cos(a) * r, sin(a) * r * 1.06))
	for i in 21:
		var s := float(i) / 20.0
		var y := lerpf(r, -r, s) * 1.06
		dark.append(c + Vector2(sin(s * TAU) * r * 0.35, y))
	draw_colored_polygon(dark, Color(0.16, 0.12, 0.42))
	var seam := PackedVector2Array()
	for i in 21:
		var s2 := float(i) / 20.0
		seam.append(c + Vector2(sin(s2 * TAU) * r * 0.35, lerpf(r, -r, s2) * 1.06))
	draw_polyline(seam, Color(1.0, 0.95, 0.8, 0.8), 2.0, true)
	draw_circle(c + Vector2(-r * 0.4, -r * 0.2), r * 0.08, Color(1.0, 0.95, 0.75, 0.6 + 0.4 * pulse))
	draw_circle(c + Vector2(r * 0.42, r * 0.3), r * 0.08, Color(0.2, 0.15, 0.45))
	draw_arc(c, r, -PI * 0.85, -PI * 0.55, 10, Color(1, 1, 1, 0.45), 2.0, true)
	for k in 5:
		var d := Vector2.from_angle(-PI * 0.5 + (k - 2) * 0.45)
		draw_line(c + Vector2(0, -r * 0.95), c + Vector2(0, -r * 0.95) + d * r * 0.35, Color(0.35, 0.55, 0.25), 2.5)


func _bowl_front() -> void:
	var lip_pts := PackedVector2Array()
	var base_pts := PackedVector2Array()
	for i in 33:
		var s := float(i) / 32.0
		var x := lerpf(-214.0, 214.0, s)
		var k := sqrt(maxf(0.0, 1.0 - pow(x / 214.0, 2)))
		lip_pts.append(ROOT + Vector2(x, k * 32.0))
		base_pts.append(ROOT + Vector2(x * (1.0 - 0.06 * k), k * 112.0 + 4.0))
	U.strip(self, lip_pts, base_pts, BRASS.darkened(0.2))
	# Shading bands.
	draw_set_transform(ROOT + Vector2(-70, 50), -0.12, Vector2(1.0, 0.3))
	draw_circle(Vector2.ZERO, 90, Color(1.0, 0.88, 0.6, 0.18))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# Medallion band.
	for k in 5:
		var x := -150.0 + k * 75.0
		var y := 30.0 + sqrt(maxf(0.0, 1.0 - pow(x / 214.0, 2))) * 40.0
		var p := ROOT + Vector2(x, y)
		draw_circle(p, 19, BRASS.darkened(0.45))
		draw_arc(p, 16, 0, TAU, 20, BRASS.lightened(0.25), 1.5, true)
		if k == 2:
			for j in 12:
				var d := Vector2.from_angle(TAU * j / 12.0)
				draw_line(p + d * 5, p + d * 12, BRASS.lightened(0.3), 1.5)
			draw_circle(p, 4, BRASS.lightened(0.4))
		elif k % 2 == 1:
			draw_circle(p, 8, BRASS.lightened(0.3))
			draw_circle(p + Vector2(3, -2), 7, BRASS.darkened(0.45))
		else:
			for j in 4:
				var d2 := Vector2.from_angle(PI * 0.5 * j)
				draw_line(p - d2 * 9, p + d2 * 9, BRASS.lightened(0.3), 1.5)
	# Rim lip.
	draw_set_transform(ROOT, 0.0, Vector2(1.0, 0.15))
	draw_arc(Vector2.ZERO, 214, 0.0, PI, 48, BRASS.lightened(0.35), 7.0)
	draw_arc(Vector2.ZERO, 214, PI, TAU, 48, BRASS.lightened(0.1), 5.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# Pedestal.
	var neck := Rect2(ROOT.x - 34, ROOT.y + 112, 68, 70)
	U.hgrad_rect(self, neck, BRASS.darkened(0.45), BRASS.lightened(0.05))
	draw_rect(Rect2(ROOT.x - 48, ROOT.y + 112, 96, 12), BRASS.darkened(0.1))
	draw_set_transform(ROOT + Vector2(0, 196), 0.0, Vector2(1.0, 0.2))
	draw_circle(Vector2.ZERO, 130, BRASS.darkened(0.4))
	draw_circle(Vector2(0, -20), 120, BRASS.darkened(0.1))
	draw_arc(Vector2(0, -20), 120, 0.2, PI - 0.2, 32, BRASS.lightened(0.3), 4.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
