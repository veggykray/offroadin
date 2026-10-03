extends Node2D
## Everything else living on the hide: eyes, tendrils, mushrooms, plants,
## iridescent scales, scars, wiry hairs and loose objects that bounce when the
## beast thumps. Placement is seeded so the beast looks the same every time.

const EYE_XS := [1700.0, 2960.0, 4220.0, 5480.0, 6680.0]

var tendrils: Array = []
var mushrooms: Array = []
var plants: Array = []
var scales: Array = []
var scars: Array = []
var hairs: Array = []
var loose: Array = []
var eyes: Array = []
var t := 0.0
var point_target := Vector2.INF
var point_strength := 0.0
var glow: GlowLayer
var _avoid: Array = []  # [center, radii]


func _ready() -> void:
	Game.decor = self
	z_index = -2
	for c in get_parent().get_children():
		if c is BodyRegion:
			_avoid.append([c.position + c.hit_offset, c.hit_radii * 1.15 + Vector2(60, 40)])
	var rng := RandomNumberGenerator.new()
	rng.seed = 2024
	for x in EYE_XS:
		var eye := BeastEye.new()
		eye.radius = rng.randf_range(38, 56)
		eye.position = Vector2(x, Game.surface_y(x) + rng.randf_range(95, 140))
		add_child(eye)
		eyes.append(eye)
		_avoid.append([eye.position, Vector2(140, 110)])
	for i in range(34):
		var p := _place(rng, 40.0, 520.0)
		tendrils.append({"base": p, "len": rng.randf_range(70, 150), "ph": rng.randf() * TAU,
			"curl": 0.0, "recoil": 0.0, "dir": rng.randf_range(-0.4, 0.4), "pts": PackedVector2Array()})
	for i in range(18):
		var p := _place(rng, 30.0, 560.0)
		var caps: Array = []
		for k in range(rng.randi_range(3, 6)):
			caps.append({"o": Vector2(rng.randf_range(-40, 40), rng.randf_range(-6, 10)), "h": rng.randf_range(16, 52),
				"r": rng.randf_range(9, 22), "lean": rng.randf_range(-0.3, 0.3), "hue": rng.randf_range(0.42, 0.58)})
		mushrooms.append({"p": p, "caps": caps, "wob": 0.0, "wv": 0.0})
	for i in range(16):
		var p := _place(rng, 25.0, 600.0)
		plants.append({"p": p, "fronds": rng.randi_range(3, 6), "l": rng.randf_range(30, 70), "ph": rng.randf() * TAU})
	for i in range(11):
		var p := _place(rng, 80.0, 560.0)
		scales.append({"p": p, "rows": rng.randi_range(3, 5), "cols": rng.randi_range(5, 9), "s": rng.randf_range(16, 26), "shift": rng.randf()})
	for i in range(7):
		var p := _place(rng, 120.0, 650.0)
		var pts := PackedVector2Array()
		var q := p
		var a := rng.randf_range(-0.4, 0.4)
		for k in range(9):
			pts.append(q)
			a += rng.randf_range(-0.3, 0.3)
			q += Vector2.from_angle(a) * rng.randf_range(18, 30)
		scars.append(pts)
	for i in range(120):
		var p := _place(rng, 20.0, 700.0)
		hairs.append({"p": p, "l": rng.randf_range(30, 90), "a": rng.randf_range(-0.7, 0.7) - PI * 0.5, "kink": rng.randf_range(-0.8, 0.8), "ph": rng.randf() * TAU})
	var kinds := ["pebble", "pebble", "pebble", "pod", "pebble", "cup", "stone", "pebble", "pod", "stone", "pebble", "spoon", "pebble", "stone", "pod", "pebble"]
	for i in range(kinds.size()):
		var p := _place(rng, 20.0, 420.0)
		loose.append({"kind": kinds[i], "p": p, "y": 0.0, "vy": 0.0, "rot": rng.randf_range(-0.6, 0.6), "vr": 0.0, "s": rng.randf_range(0.8, 1.4)})
	glow = GlowLayer.new(_draw_glow, 1)
	add_child(glow)


func _place(rng: RandomNumberGenerator, min_depth: float, max_depth: float) -> Vector2:
	for attempt in range(40):
		var x := rng.randf_range(150.0, Game.WORLD_WIDTH - 150.0)
		var y := Game.surface_y(x) + rng.randf_range(min_depth, max_depth)
		var ok := true
		for av in _avoid:
			if ((Vector2(x, y) - av[0]) / av[1]).length() < 1.0:
				ok = false
				break
		if ok:
			return Vector2(x, y)
	var x2 := rng.randf_range(150.0, Game.WORLD_WIDTH - 150.0)
	return Vector2(x2, Game.surface_y(x2) + min_depth)


# --- Beast-driven behaviour ----------------------------------------------------

## Tendrils near a point curl with pleasure (or recoil if negative).
func react_near(world_pos: Vector2, amount: float, radius: float = 650.0) -> void:
	var lp := to_local(world_pos)
	for td in tendrils:
		var d: float = td.base.distance_to(lp)
		if d < radius:
			var k := (1.0 - d / radius) * amount
			if amount > 0.0:
				td.curl = clampf(td.curl + k, 0.0, 1.0)
			else:
				td.recoil = clampf(td.recoil - k, 0.0, 1.0)


## Every tendril within reach points at `world_pos` for a while.
func point_at(world_pos: Vector2, strength: float) -> void:
	point_target = to_local(world_pos)
	point_strength = maxf(point_strength, strength)


func glance_eyes(world_pos: Vector2, duration: float) -> void:
	for e in eyes:
		e.glance_at(world_pos, duration)


func bounce(power: float, around: Vector2 = Vector2.INF, radius: float = 1e9) -> void:
	var lp := to_local(around) if around != Vector2.INF else Vector2.INF
	for o in loose:
		if lp != Vector2.INF and o.p.distance_to(lp) > radius:
			continue
		if o.y > -2.0:
			o.vy -= power * randf_range(0.6, 1.2)
			o.vr += randf_range(-4.0, 4.0) * power / 400.0
	for m in mushrooms:
		m.wv += randf_range(-1.0, 1.0) * power / 60.0


func _process(delta: float) -> void:
	t += delta
	var e := Game.escalation()
	point_strength = Game.damp(point_strength, 0.0, 0.35, delta)
	var cx := Game.camera_x()
	for td in tendrils:
		td.curl = Game.damp(td.curl, 0.0, 0.25, delta)
		td.recoil = Game.damp(td.recoil, 0.0, 1.0, delta)
		if absf(td.base.x - cx) > 1500.0:
			continue
		var pts := PackedVector2Array()
		var p: Vector2 = td.base
		var ang: float = -PI * 0.5 + td.dir + sin(t * 0.9 + td.ph) * 0.15
		var len: float = td.len * (1.0 - td.recoil * 0.55)
		var want := ang
		if point_strength > 0.02 and point_target != Vector2.INF:
			want = (point_target - td.base).angle()
		var n := 12
		var ps := clampf(point_strength * 1.1, 0.0, 0.7)
		for i in range(n + 1):
			pts.append(p)
			var k := float(i) / n
			ang += sin(t * 1.7 + td.ph + k * 3.0) * 0.06 * (1.0 + e) + td.curl * 0.42 * k
			var a := lerp_angle(ang, want, ps * (0.35 + 0.65 * k))
			p += Vector2.from_angle(a) * len / n
		td.pts = pts
	for o in loose:
		o.vy += 1800.0 * delta
		o.y += o.vy * delta
		if o.y > 0.0:
			o.y = 0.0
			o.vy = -o.vy * 0.3 if absf(o.vy) > 80.0 else 0.0
			o.vr *= 0.6
		o.rot += o.vr * delta
		# Rhythmic shaking at high escalation.
		if e > 0.55 and randf() < delta * (e - 0.5) * 6.0:
			o.vy -= randf_range(40, 140) * e
	for m in mushrooms:
		m.wv += (-m.wob * 50.0 - m.wv * 4.0) * delta
		m.wob += m.wv * delta
	queue_redraw()
	glow.queue_redraw()


# --- Drawing -------------------------------------------------------------------

func _draw() -> void:
	var cx := Game.camera_x()
	var lo := cx - 1300.0
	var hi := cx + 1300.0
	var e := Game.escalation()
	for sc in scars:
		if sc[0].x < lo - 300 or sc[0].x > hi:
			continue
		draw_polyline(sc, Color(0.06, 0.02, 0.03, 0.8), 9.0, true)
		draw_polyline(sc, Color(0.62, 0.45, 0.42, 0.55), 3.5, true)
		for i in range(1, sc.size() - 1, 2):
			var d: Vector2 = (sc[i + 1] - sc[i - 1]).normalized().orthogonal() * 6.0
			draw_line(sc[i] - d, sc[i] + d, Color(0.5, 0.35, 0.33, 0.6), 2.0, true)
	for s in scales:
		if s.p.x < lo or s.p.x > hi:
			continue
		_draw_scales(s)
	for h in hairs:
		if h.p.x < lo or h.p.x > hi:
			continue
		var sway := sin(t * 1.2 + h.ph) * 0.12 + sin(t * 8.0 + h.ph) * maxf(e - 0.6, 0.0) * 0.1
		var a: float = h.a + sway
		var p1: Vector2 = h.p + Vector2.from_angle(a) * h.l * 0.45
		var p2: Vector2 = p1 + Vector2.from_angle(a + h.kink) * h.l * 0.3
		var p3: Vector2 = p2 + Vector2.from_angle(a - h.kink * 0.5) * h.l * 0.3
		draw_polyline(PackedVector2Array([h.p, p1, p2, p3]), Color(0.1, 0.06, 0.06), 2.0, true)
	for pl in plants:
		if pl.p.x < lo or pl.p.x > hi:
			continue
		for f in range(pl.fronds):
			var a: float = -PI * 0.5 + (f - pl.fronds * 0.5) * 0.35 + sin(t * 1.1 + pl.ph + f) * 0.1
			var pts := PackedVector2Array()
			var q: Vector2 = pl.p
			for k in range(6):
				pts.append(q)
				a += 0.12 * (1.0 if f % 2 == 0 else -1.0)
				q += Vector2.from_angle(a) * pl.l / 5.0
			draw_polyline(pts, Color(0.25, 0.38, 0.22), 3.0, true)
			for k in range(1, 5):
				var d := (pts[k + 1] - pts[k]).normalized().orthogonal() * (8.0 - k)
				draw_line(pts[k], pts[k] + d, Color(0.32, 0.5, 0.28), 2.0, true)
				draw_line(pts[k], pts[k] - d, Color(0.32, 0.5, 0.28), 2.0, true)
	for td in tendrils:
		if td.base.x < lo or td.base.x > hi or td.pts.size() < 2:
			continue
		Paint.soft(self, td.base + Vector2(0, 6), 22.0, Color(0, 0, 0, 0.5))
		Paint.strand(self, td.pts, 12.0, 2.0, Color(0.36, 0.16, 0.26), Color(0.75, 0.45, 0.55))
	for m in mushrooms:
		if m.p.x < lo or m.p.x > hi:
			continue
		Paint.soft_ellipse(self, m.p + Vector2(0, 6), Vector2(70, 24), Color(0, 0, 0, 0.45))
		for c in m.caps:
			var lean: float = c.lean + m.wob * 0.4
			var base: Vector2 = m.p + c.o
			var top: Vector2 = base + Vector2.from_angle(-PI * 0.5 + lean) * c.h
			draw_line(base, top, Color(0.55, 0.5, 0.44), maxf(c.r * 0.35, 3.0), true)
			var cap := PackedVector2Array()
			for k in range(13):
				var a := PI + PI * k / 12.0
				cap.append(top + Vector2(cos(a) * c.r, sin(a) * c.r * 0.75).rotated(lean))
			draw_colored_polygon(cap, Color.from_hsv(c.hue, 0.45, 0.45))
			draw_line(top + Vector2(-c.r, 0).rotated(lean), top + Vector2(c.r, 0).rotated(lean), Color(0.2, 0.15, 0.15), 2.0, true)
	for o in loose:
		if o.p.x < lo or o.p.x > hi:
			continue
		_draw_loose(o)


func _draw_scales(s: Dictionary) -> void:
	var hue: float = 0.5 + s.shift * 0.3
	for r in range(s.rows):
		for c in range(s.cols):
			var off := Vector2(c * s.s * 1.05 + (r % 2) * s.s * 0.52, r * s.s * 0.62)
			var p: Vector2 = s.p + off - Vector2(s.cols * s.s * 0.52, 0)
			# Fade and shrink toward the patch edge so it grows out of the hide.
			var cx: float = absf(c - (s.cols - 1) * 0.5) / (s.cols * 0.5)
			var ry: float = absf(r - (s.rows - 1) * 0.5) / (s.rows * 0.5 + 0.5)
			var edge := clampf(1.0 - maxf(cx, ry), 0.0, 1.0)
			var sz: float = s.s * lerpf(0.55, 1.0, edge)
			var shimmer := 0.5 + 0.5 * sin(t * 0.8 + p.x * 0.02 + r)
			var base := Color.from_hsv(fposmod(hue + r * 0.03, 1.0), 0.3, 0.32 + 0.1 * edge)
			base.a = lerpf(0.35, 1.0, edge)
			var pts := PackedVector2Array()
			for k in range(9):
				var a := PI * k / 8.0
				pts.append(p + Vector2(cos(a) * sz * 0.6, sin(a) * sz * 0.72))
			draw_colored_polygon(pts, base)
			var hl := Paint.iridescent(t * 0.5 + p.x * 0.003, s.shift + r * 0.05)
			hl.a = (0.25 + 0.45 * shimmer) * edge
			draw_arc(p + Vector2(0, sz * 0.12), sz * 0.42, PI * 0.2, PI * 0.8, 8, hl, 2.0, true)
			draw_polyline(pts, Color(0.05, 0.03, 0.05, 0.6 * base.a), 1.2, true)


func _draw_loose(o: Dictionary) -> void:
	var p: Vector2 = o.p + Vector2(0, o.y)
	var sh := clampf(1.0 + o.y / 200.0, 0.2, 1.0)
	Paint.soft_ellipse(self, o.p + Vector2(0, 6), Vector2(18, 6) * o.s * sh, Color(0, 0, 0, 0.5 * sh))
	draw_set_transform(p, o.rot, Vector2(o.s, o.s))
	match o.kind:
		"pebble":
			Paint.ellipse(self, Vector2(0, -5), Vector2(10, 7), Color(0.45, 0.42, 0.4), 12)
			Paint.ellipse(self, Vector2(-2, -7), Vector2(5, 3), Color(0.62, 0.6, 0.56), 8)
		"stone":
			Paint.ellipse(self, Vector2(0, -9), Vector2(17, 12), Color(0.36, 0.36, 0.33), 14)
			Paint.ellipse(self, Vector2(-4, -15), Vector2(10, 4), Color(0.3, 0.45, 0.25), 10)
		"pod":
			Paint.ellipse(self, Vector2(0, -10), Vector2(8, 13), Color(0.42, 0.3, 0.16), 12)
			draw_line(Vector2(0, -23), Vector2(2, -30), Color(0.3, 0.2, 0.1), 2.0)
		"cup":
			draw_colored_polygon(PackedVector2Array([Vector2(-11, -20), Vector2(11, -20), Vector2(8, -2), Vector2(-8, -2)]), Color(0.88, 0.86, 0.8))
			draw_arc(Vector2(12, -12), 5.0, -PI * 0.5, PI * 0.5, 8, Color(0.88, 0.86, 0.8), 2.5)
			draw_line(Vector2(-12, -1), Vector2(12, -1), Color(0.8, 0.78, 0.72), 3.0)
			draw_line(Vector2(-9, -15), Vector2(9, -15), Color(0.3, 0.45, 0.7), 2.0)
		"spoon":
			draw_line(Vector2(-16, -3), Vector2(8, -3), Color(0.75, 0.75, 0.78), 2.5)
			Paint.ellipse(self, Vector2(13, -3), Vector2(6, 4), Color(0.8, 0.8, 0.84), 10)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_glow(layer: GlowLayer) -> void:
	var cx := Game.camera_x()
	var g: float = Game.terrain.glow_amount if Game.terrain else 0.0
	for m in mushrooms:
		if absf(m.p.x - cx) > 1300.0:
			continue
		for c in m.caps:
			var top: Vector2 = m.p + c.o + Vector2.from_angle(-PI * 0.5 + c.lean + m.wob * 0.4) * c.h
			var k := 0.25 + 0.15 * sin(t * 1.3 + c.h) + g * 0.6
			layer.blob(top, c.r * 2.4, Color.from_hsv(c.hue, 0.6, 1.0, 0.35 * k))
	for td in tendrils:
		if absf(td.base.x - cx) > 1300.0 or td.pts.size() < 2:
			continue
		var k: float = 0.3 + td.curl * 0.6 + point_strength * 0.6 + g * 0.4
		layer.blob(td.pts[td.pts.size() - 1], 14.0, Color(1.0, 0.6, 0.8, 0.45 * k))
