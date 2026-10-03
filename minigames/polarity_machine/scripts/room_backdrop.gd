extends Node2D
## The study around the machine: night window, astral wallpaper, banners,
## the great crescent sigil, shelves of books and jars, ivy, tiled floor and
## the star rug. Static — drawn once, then lit and tinted by the Atmosphere.
## All coordinates are in the 1920×1080 design space.

const U := preload("res://minigames/polarity_machine/scripts/pm_util.gd")

const WALL_TOP := Color(0.10, 0.13, 0.25)
const WALL_BOTTOM := Color(0.06, 0.08, 0.16)
const GOLD := Color(0.86, 0.68, 0.36)
const GOLD_DIM := Color(0.62, 0.48, 0.26, 0.55)
const WOOD := Color(0.20, 0.12, 0.08)
const WOOD_LIGHT := Color(0.33, 0.21, 0.12)
const FLOOR_Y := 795.0

var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	queue_redraw()


func _draw() -> void:
	_rng.seed = 4242
	U.vgrad_rect(self, Rect2(0, 0, 1920, FLOOR_Y), WALL_TOP, WALL_BOTTOM)
	_wallpaper()
	_window()
	_sigil(Vector2(1060, 245), 168.0)
	_banner(Rect2(352, 0, 86, 238), "moon")
	_banner(Rect2(1832, 0, 88, 250), "star")
	_prints()
	_top_shelf()
	_bookcase(Rect2(300, 392, 300, 210))
	_bookcase(Rect2(905, 400, 320, 202))
	_counter()
	_floor()
	_rug()
	_hanging_ornaments()
	_orrery(Vector2(36, 150))
	_foreground()


# --- Wall -----------------------------------------------------------------------------------

func _wallpaper() -> void:
	# Faint gold diamond lattice with small four-point stars at the crossings.
	var col := Color(GOLD.r, GOLD.g, GOLD.b, 0.06)
	var step := 64.0
	for i in range(-20, 40):
		var x0 := i * step
		draw_line(Vector2(x0, 0), Vector2(x0 + FLOOR_Y, FLOOR_Y), col, 1.0)
		draw_line(Vector2(x0, 0), Vector2(x0 - FLOOR_Y, FLOOR_Y), col, 1.0)
	for y in range(32, int(FLOOR_Y), 64):
		for x in range(0, 1920, 64):
			var p := Vector2(x + (32 if (y / 64) % 2 == 0 else 0), y)
			_star4(p, 4.0, Color(GOLD.r, GOLD.g, GOLD.b, 0.14))
	# Picture rail.
	draw_rect(Rect2(0, 372, 1920, 6), Color(0.05, 0.05, 0.1, 0.8))
	draw_line(Vector2(0, 372), Vector2(1920, 372), GOLD_DIM, 1.5)


func _star4(p: Vector2, r: float, c: Color) -> void:
	var pts := PackedVector2Array([p + Vector2(0, -r), p + Vector2(r * 0.25, -r * 0.25), p + Vector2(r, 0),
			p + Vector2(r * 0.25, r * 0.25), p + Vector2(0, r), p + Vector2(-r * 0.25, r * 0.25),
			p + Vector2(-r, 0), p + Vector2(-r * 0.25, -r * 0.25)])
	draw_colored_polygon(pts, c)


func _star8(p: Vector2, r: float, c: Color) -> void:
	_star4(p, r, c)
	var d := r * 0.62
	var pts := PackedVector2Array([p + Vector2(d, -d), p + Vector2(r * 0.12, 0), p + Vector2(d, d),
			p + Vector2(0, r * 0.12), p + Vector2(-d, d), p + Vector2(-r * 0.12, 0), p + Vector2(-d, -d), p + Vector2(0, -r * 0.12)])
	draw_colored_polygon(pts, c)


func _window() -> void:
	var r := Rect2(0, 0, 150, 560)
	# Night sky.
	U.vgrad_rect(self, r, Color(0.05, 0.08, 0.25), Color(0.16, 0.22, 0.48))
	for i in 40:
		var p := Vector2(_rng.randf_range(4, 146), _rng.randf_range(4, 440))
		draw_circle(p, _rng.randf_range(0.6, 1.6), Color(0.9, 0.92, 1.0, _rng.randf_range(0.4, 1.0)))
	# Crescent moon.
	draw_circle(Vector2(78, 262), 30, Color(0.95, 0.94, 0.82))
	draw_circle(Vector2(92, 252), 27, Color(0.09, 0.13, 0.33))
	U.radial(self, Vector2(70, 268), 70, Color(0.7, 0.75, 1.0, 0.18), Color(0.7, 0.75, 1.0, 0.0))
	# Mountains.
	var m := PackedVector2Array([Vector2(0, 470), Vector2(30, 430), Vector2(62, 452), Vector2(100, 405),
			Vector2(150, 445), Vector2(150, 560), Vector2(0, 560)])
	draw_colored_polygon(m, Color(0.08, 0.1, 0.22))
	var m2 := PackedVector2Array([Vector2(0, 500), Vector2(55, 478), Vector2(110, 492), Vector2(150, 480),
			Vector2(150, 560), Vector2(0, 560)])
	draw_colored_polygon(m2, Color(0.05, 0.07, 0.15))
	# Frame and mullions.
	var frame := Color(0.13, 0.09, 0.06)
	draw_rect(Rect2(150, 0, 18, 580), frame)
	draw_rect(Rect2(0, 556, 168, 26), frame)
	draw_line(Vector2(168, 0), Vector2(168, 580), GOLD_DIM, 2.0)
	for x in [50.0, 100.0]:
		draw_line(Vector2(x, 0), Vector2(x, 556), Color(0.25, 0.2, 0.14), 4.0)
	for y in [140.0, 300.0, 440.0]:
		draw_line(Vector2(0, y), Vector2(150, y), Color(0.25, 0.2, 0.14), 4.0)
	# Arch top.
	draw_arc(Vector2(75, 40), 75, PI, TAU, 24, frame, 16.0)


func _sigil(c: Vector2, r: float) -> void:
	var col := Color(GOLD.r, GOLD.g, GOLD.b, 0.42)
	var faint := Color(GOLD.r, GOLD.g, GOLD.b, 0.22)
	draw_arc(c, r, 0, TAU, 96, col, 2.5, true)
	draw_arc(c, r - 12, 0, TAU, 96, faint, 1.2, true)
	draw_arc(c, r * 0.62, 0, TAU, 72, col, 1.6, true)
	draw_arc(c, r * 0.36, 0, TAU, 64, faint, 1.2, true)
	for i in 72:
		var a := TAU * i / 72.0
		var d := Vector2(cos(a), sin(a))
		draw_line(c + d * (r - 12), c + d * (r - (20.0 if i % 6 == 0 else 15.0)), col, 1.0)
	# Star of eight points and orbit dots.
	for i in 8:
		var a := TAU * i / 8.0 - PI / 2
		var tip := c + Vector2(cos(a), sin(a)) * r * 0.95
		var l := c + Vector2(cos(a - 0.28), sin(a - 0.28)) * r * 0.36
		var rr := c + Vector2(cos(a + 0.28), sin(a + 0.28)) * r * 0.36
		draw_polyline(PackedVector2Array([l, tip, rr]), faint, 1.2, true)
		draw_circle(c + Vector2(cos(a + 0.39), sin(a + 0.39)) * r * 0.62, 4.0, col)
	# Crescent.
	draw_circle(c, r * 0.28, Color(GOLD.r, GOLD.g, GOLD.b, 0.75))
	draw_circle(c + Vector2(r * 0.11, -r * 0.07), r * 0.25, WALL_TOP.lerp(WALL_BOTTOM, 0.3))
	_star8(c + Vector2(r * 0.42, -r * 0.42), 10, col)


func _banner(r: Rect2, emblem: String) -> void:
	var cloth := Color(0.09, 0.12, 0.30)
	var tip := Vector2(r.position.x + r.size.x * 0.5, r.end.y)
	var poly := PackedVector2Array([r.position, Vector2(r.end.x, r.position.y), Vector2(r.end.x, r.end.y - 34), tip,
			Vector2(r.position.x, r.end.y - 34)])
	var sh := poly.duplicate()
	for i in sh.size():
		sh[i] += Vector2(6, 6)
	draw_colored_polygon(sh, Color(0, 0, 0, 0.35))
	draw_colored_polygon(poly, cloth)
	poly.append(poly[0])
	draw_polyline(poly, GOLD, 2.0, true)
	var inner := r.grow(-8)
	draw_rect(Rect2(inner.position, Vector2(inner.size.x, inner.size.y - 40)), Color(GOLD.r, GOLD.g, GOLD.b, 0.35), false, 1.0)
	var c := r.position + Vector2(r.size.x * 0.5, r.size.y * 0.42)
	if emblem == "moon":
		draw_circle(c, 22, GOLD)
		draw_circle(c + Vector2(9, -6), 20, cloth)
		_star4(c + Vector2(0, 56), 8, GOLD)
	else:
		_star8(c, 22, GOLD)
		draw_arc(c, 30, 0, TAU, 32, GOLD, 1.5, true)
	draw_rect(Rect2(r.position.x - 6, r.position.y, r.size.x + 12, 8), Color(0.35, 0.25, 0.12))


func _prints() -> void:
	for spec in [[Rect2(505, 222, 82, 104), 0], [Rect2(950, 385, 74, 92), 1], [Rect2(1032, 392, 70, 90), 2]]:
		var r: Rect2 = spec[0]
		draw_rect(Rect2(r.position + Vector2(4, 5), r.size), Color(0, 0, 0, 0.35))
		draw_rect(r, Color(0.78, 0.72, 0.58))
		draw_rect(r.grow(-4), Color(0.55, 0.45, 0.3), false, 1.0)
		var base := r.position + Vector2(r.size.x * 0.5, r.size.y * 0.82)
		var ink := Color(0.33, 0.42, 0.22)
		draw_line(base, base - Vector2(0, r.size.y * 0.6), ink, 1.5)
		for k in 3:
			var y := base.y - r.size.y * (0.2 + k * 0.17)
			for s in [-1.0, 1.0]:
				var leaf := U.circle_pts(Vector2(base.x + s * 10, y), 9, 10, 0.0, 0.45)
				draw_colored_polygon(leaf, Color(0.38, 0.5, 0.26, 0.85))
		if spec[1] == 1:
			draw_circle(base - Vector2(0, r.size.y * 0.62), 6, Color(0.55, 0.35, 0.5))


func _top_shelf() -> void:
	draw_rect(Rect2(480, 36, 740, 14), WOOD)
	draw_line(Vector2(480, 36), Vector2(1220, 36), WOOD_LIGHT, 2.0)
	var x := 500.0
	while x < 1200.0:
		var kind := _rng.randi_range(0, 3)
		if kind == 0:
			_pot_plant(Vector2(x + 20, 36), 0.8, true)
			x += 60
		elif kind == 1:
			_books(Vector2(x, 36), _rng.randi_range(3, 6))
			x += 70
		else:
			_jar(Vector2(x + 14, 36), 14, 30)
			x += 40
	# Ivy trailing from the shelf.
	for vx in [560.0, 760.0, 980.0, 1150.0]:
		_ivy(Vector2(vx, 50), _rng.randf_range(110, 220))


func _ivy(top: Vector2, length: float) -> void:
	var stem := Color(0.12, 0.25, 0.14)
	var pts := PackedVector2Array()
	for i in 20:
		var t := float(i) / 19.0
		pts.append(top + Vector2(sin(t * 5.0 + top.x) * 9.0, t * length))
	draw_polyline(pts, stem, 2.0, true)
	for i in range(1, 20, 2):
		var p := pts[i]
		var s := -1.0 if i % 4 == 1 else 1.0
		var leaf := U.circle_pts(p + Vector2(s * 9, 2), 8, 8, 0.0, 0.8)
		draw_colored_polygon(leaf, Color(0.16, 0.36, 0.2).lerp(Color(0.25, 0.5, 0.28), _rng.randf()))


func _books(base: Vector2, n: int) -> void:
	var x := base.x
	var palette := [Color(0.18, 0.2, 0.38), Color(0.32, 0.12, 0.1), Color(0.12, 0.22, 0.2), Color(0.35, 0.28, 0.15), Color(0.1, 0.12, 0.25)]
	for i in n:
		var w := _rng.randf_range(10, 17)
		var h := _rng.randf_range(32, 52)
		var c: Color = palette[_rng.randi_range(0, palette.size() - 1)]
		draw_rect(Rect2(x, base.y - h, w, h), c)
		draw_line(Vector2(x + 2, base.y - h + 6), Vector2(x + w - 2, base.y - h + 6), GOLD_DIM, 1.5)
		draw_line(Vector2(x + 2, base.y - 8), Vector2(x + w - 2, base.y - 8), GOLD_DIM, 1.5)
		x += w + 1.5


func _jar(base: Vector2, r: float, h: float) -> void:
	var glass := Color(0.5, 0.65, 0.7, 0.35)
	draw_rect(Rect2(base.x - r, base.y - h, r * 2, h), glass)
	draw_rect(Rect2(base.x - r * 0.9, base.y - h * 0.55, r * 1.8, h * 0.55), Color(0.35, 0.5, 0.3, 0.5))
	draw_rect(Rect2(base.x - r * 0.7, base.y - h - 5, r * 1.4, 5), Color(0.45, 0.32, 0.18))
	draw_line(Vector2(base.x - r + 3, base.y - h + 3), Vector2(base.x - r + 3, base.y - 3), Color(1, 1, 1, 0.3), 2.0)


func _pot_plant(base: Vector2, s: float, trailing: bool) -> void:
	var pot := PackedVector2Array([base + Vector2(-16, -24) * s, base + Vector2(16, -24) * s, base + Vector2(12, 0) * s, base + Vector2(-12, 0) * s])
	draw_colored_polygon(pot, Color(0.45, 0.25, 0.15))
	for k in 7:
		var a := -PI * 0.5 + (k - 3) * 0.42
		var tip := base + Vector2(0, -24 * s) + Vector2(cos(a), sin(a)) * 30 * s
		var leaf := U.circle_pts((base + Vector2(0, -24 * s) + tip) * 0.5, 15 * s, 10, a, 0.4)
		draw_colored_polygon(leaf, Color(0.16, 0.36, 0.18).lerp(Color(0.28, 0.5, 0.25), float(k) / 7.0))
	if trailing:
		_ivy(base + Vector2(10, -20 * s), 60)


func _bookcase(r: Rect2) -> void:
	draw_rect(r, Color(0.09, 0.06, 0.05))
	for k in 2:
		var y := r.position.y + (k + 1) * r.size.y / 2.0
		draw_rect(Rect2(r.position.x, y - 8, r.size.x, 8), WOOD)
		var x := r.position.x + 8
		while x < r.end.x - 40:
			if _rng.randf() < 0.7:
				var n := _rng.randi_range(3, 7)
				_books(Vector2(x, y - 8), n)
				x += n * 15.0 + 10
			else:
				_jar(Vector2(x + 16, y - 8), 12, 30)
				x += 40
	draw_rect(r, WOOD_LIGHT, false, 3.0)


func _counter() -> void:
	# Long low cabinet behind the bowl.
	var r := Rect2(260, 600, 1000, FLOOR_Y - 600)
	draw_rect(r, Color(0.13, 0.08, 0.06))
	draw_rect(Rect2(250, 594, 1020, 12), WOOD_LIGHT)
	for i in 6:
		var p := Rect2(r.position.x + 20 + i * 163, r.position.y + 28, 140, r.size.y - 48)
		draw_rect(p, Color(0.10, 0.06, 0.05))
		draw_rect(p, Color(0.28, 0.18, 0.1), false, 2.0)
		_star8(p.get_center(), 12, Color(GOLD.r, GOLD.g, GOLD.b, 0.35))
	# Bits on the counter top.
	_lantern(Vector2(410, 594))
	_books(Vector2(470, 594), 4)
	_globe(Vector2(1000, 594))
	_lantern(Vector2(1110, 594))
	_pot_plant(Vector2(1180, 594), 1.0, false)


func _lantern(base: Vector2) -> void:
	var brass := Color(0.6, 0.45, 0.22)
	draw_rect(Rect2(base.x - 14, base.y - 46, 28, 40), Color(0.95, 0.7, 0.35, 0.35))
	draw_circle(base + Vector2(0, -26), 6, Color(1.0, 0.85, 0.5))
	U.radial(self, base + Vector2(0, -26), 46, Color(1.0, 0.7, 0.35, 0.25), Color(1.0, 0.7, 0.35, 0.0))
	draw_rect(Rect2(base.x - 16, base.y - 8, 32, 8), brass)
	draw_rect(Rect2(base.x - 16, base.y - 52, 32, 7), brass)
	draw_line(base + Vector2(-14, -46), base + Vector2(-14, -8), brass, 2.0)
	draw_line(base + Vector2(14, -46), base + Vector2(14, -8), brass, 2.0)
	draw_arc(base + Vector2(0, -58), 8, PI, TAU, 10, brass, 2.0)


func _globe(base: Vector2) -> void:
	var brass := Color(0.7, 0.53, 0.26)
	draw_line(base, base + Vector2(0, -16), brass, 4.0)
	draw_circle(base + Vector2(0, -42), 24, Color(0.15, 0.25, 0.32))
	draw_arc(base + Vector2(0, -42), 28, -PI * 0.9, PI * 0.9, 24, brass, 2.5)
	draw_arc(base + Vector2(0, -42), 24, 0, TAU, 24, Color(0.4, 0.55, 0.45, 0.6), 1.0)


# --- Floor ----------------------------------------------------------------------------------

func _floor() -> void:
	U.vgrad_rect(self, Rect2(0, FLOOR_Y, 1920, 1080 - FLOOR_Y), Color(0.13, 0.09, 0.07), Color(0.06, 0.04, 0.04))
	draw_line(Vector2(0, FLOOR_Y), Vector2(1920, FLOOR_Y), Color(0.3, 0.2, 0.12), 3.0)
	# Perspective tile joints.
	var vp := Vector2(960, 300)
	for i in range(-14, 15):
		var x := 960.0 + i * 150.0
		var top := vp.lerp(Vector2(x, 1080), (FLOOR_Y - vp.y) / (1080.0 - vp.y))
		draw_line(top, Vector2(x, 1080), Color(0.0, 0.0, 0.0, 0.35), 1.5)
	var y := FLOOR_Y
	var gap := 14.0
	while y < 1080:
		draw_line(Vector2(0, y), Vector2(1920, y), Color(0.0, 0.0, 0.0, 0.3), 1.5)
		draw_line(Vector2(0, y + 2), Vector2(1920, y + 2), Color(0.4, 0.3, 0.2, 0.08), 1.0)
		y += gap
		gap *= 1.35


func _rug() -> void:
	var poly := PackedVector2Array([Vector2(330, 930), Vector2(1190, 930), Vector2(1330, 1080), Vector2(190, 1080)])
	draw_colored_polygon(poly, Color(0.08, 0.1, 0.26))
	var inner := PackedVector2Array([Vector2(350, 942), Vector2(1170, 942), Vector2(1300, 1080), Vector2(220, 1080)])
	poly.append(poly[0])
	draw_polyline(poly, GOLD, 3.0, true)
	inner.append(inner[0])
	draw_polyline(inner, Color(GOLD.r, GOLD.g, GOLD.b, 0.6), 1.5, true)
	# Compass star, squashed for perspective.
	var c := Vector2(760, 1035)
	draw_set_transform(c, 0.0, Vector2(1.0, 0.32))
	draw_arc(Vector2.ZERO, 170, 0, TAU, 64, Color(GOLD.r, GOLD.g, GOLD.b, 0.7), 4.0, true)
	draw_arc(Vector2.ZERO, 120, 0, TAU, 64, Color(GOLD.r, GOLD.g, GOLD.b, 0.45), 2.0, true)
	_star8(Vector2.ZERO, 150, Color(GOLD.r, GOLD.g, GOLD.b, 0.55))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	for i in 12:
		_star4(Vector2(380 + i * 70, 960), 5, Color(GOLD.r, GOLD.g, GOLD.b, 0.5))


# --- Ornaments and foreground -----------------------------------------------------------------

func _hanging_ornaments() -> void:
	for spec in [[Vector2(305, 95), 16.0], [Vector2(270, 170), 11.0], [Vector2(470, 150), 13.0], [Vector2(1250, 60), 12.0]]:
		var p: Vector2 = spec[0]
		draw_line(Vector2(p.x, 0), p - Vector2(0, spec[1]), Color(0.5, 0.4, 0.25), 1.0)
		_star8(p, spec[1], GOLD)
		draw_circle(p, spec[1] * 0.18, Color(1, 0.9, 0.6))


func _orrery(c: Vector2) -> void:
	var brass := Color(0.75, 0.57, 0.28)
	draw_line(Vector2(c.x, 0), c - Vector2(0, 50), brass, 1.5)
	draw_arc(c, 46, 0, TAU, 40, brass, 3.0, true)
	draw_set_transform(c, 0.5, Vector2(1.0, 0.35))
	draw_arc(Vector2.ZERO, 46, 0, TAU, 40, brass, 2.5, true)
	draw_set_transform(c, -0.7, Vector2(1.0, 0.3))
	draw_arc(Vector2.ZERO, 46, 0, TAU, 40, brass, 2.0, true)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	draw_circle(c, 13, Color(0.5, 0.55, 0.6))
	draw_circle(c - Vector2(4, 4), 5, Color(0.85, 0.88, 0.9))
	draw_line(c + Vector2(0, 46), c + Vector2(0, 66), brass, 2.0)
	draw_circle(c + Vector2(0, 70), 4, brass)


func _foreground() -> void:
	# Dark leafy silhouettes in the bottom corners frame the scene.
	for spec in [[Vector2(-10, 1080), 1.0], [Vector2(1930, 1090), -1.0]]:
		var base: Vector2 = spec[0]
		var s: float = spec[1]
		for k in 9:
			var a := -PI * 0.5 + s * (0.15 + k * 0.17)
			var len := 150.0 + 40.0 * sin(k * 1.7)
			var tip := base + Vector2(cos(a), sin(a)) * len
			var leaf := U.circle_pts((base + tip) * 0.5, len * 0.5, 14, a, 0.28)
			draw_colored_polygon(leaf, Color(0.04, 0.09, 0.06).lerp(Color(0.08, 0.16, 0.1), float(k % 3) / 3.0))
	# A stack of books, bottom right.
	var x := 1660.0
	for i in 3:
		var r := Rect2(x + i * 6, 1040 - i * 26, 200 - i * 20, 26)
		draw_rect(r, [Color(0.12, 0.13, 0.28), Color(0.25, 0.1, 0.08), Color(0.12, 0.2, 0.18)][i])
		draw_line(r.position + Vector2(6, 5), Vector2(r.end.x - 6, r.position.y + 5), GOLD_DIM, 1.5)
