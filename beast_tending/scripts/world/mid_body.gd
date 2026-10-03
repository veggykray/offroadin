extends ParallaxBodyLayer
## The nearer ridge of the beast: armour plates, long wiry hairs, translucent
## membrane sails that twitch, and vents that steam on every exhale.

var plates: Array = []
var hairs: Array = []
var sails: Array = []
var vents: Array = []
var twitch := 0.0
var glow: GlowLayer


func _ready() -> void:
	z_index = -12
	var rng := RandomNumberGenerator.new()
	rng.seed = 909
	var x := -900.0
	while x < 4800.0:
		plates.append({"x": x, "w": rng.randf_range(70, 130), "h": rng.randf_range(40, 80), "tilt": rng.randf_range(-0.3, 0.3)})
		x += rng.randf_range(80, 170)
	for i in range(90):
		hairs.append({"x": rng.randf_range(-900, 4800), "l": rng.randf_range(80, 260), "ph": rng.randf() * TAU, "lean": rng.randf_range(-0.5, 0.5)})
	x = -600.0
	while x < 4600.0:
		sails.append({"x": x, "w": rng.randf_range(220, 380), "h": rng.randf_range(160, 280), "ph": rng.randf() * TAU})
		x += rng.randf_range(700, 1100)
	for i in range(7):
		var vx := lerpf(-400.0, 4300.0, i / 6.0) + rng.randf_range(-150, 150)
		vents.append(_make_vent(Vector2(vx, ridge(vx) + 20.0)))
	glow = GlowLayer.new(_draw_glow, 1)
	add_child(glow)


func _make_vent(p: Vector2) -> CPUParticles2D:
	var ps := CPUParticles2D.new()
	ps.position = p
	ps.amount = 26
	ps.lifetime = 3.5
	ps.texture = Game.soft_texture
	ps.emitting = false
	ps.direction = Vector2(0.2, -1)
	ps.spread = 18.0
	ps.gravity = Vector2(14, -10)
	ps.initial_velocity_min = 30.0
	ps.initial_velocity_max = 70.0
	ps.scale_amount_min = 0.5
	ps.scale_amount_max = 1.2
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.3))
	curve.add_point(Vector2(1, 1.6))
	ps.scale_amount_curve = curve
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.2, 1.0])
	grad.colors = PackedColorArray([Color(1, 0.85, 0.8, 0.0), Color(1, 0.85, 0.8, 0.18), Color(1, 0.8, 0.75, 0.0)])
	ps.color_ramp = grad
	add_child(ps)
	return ps


func ridge(x: float) -> float:
	return 250.0 + 48.0 * sin(x * 0.0037 + 1.0) + 24.0 * sin(x * 0.011 + 2.0)


func _layer_update(delta: float) -> void:
	var exhaling: bool = Game.body.exhaling if Game.body else false
	var e := Game.escalation()
	for v in vents:
		v.emitting = exhaling or e > 0.85
	twitch = Game.damp(twitch, 0.0, 2.0, delta)
	if randf() < delta * (0.3 + e * 2.0):
		twitch = 1.0
	glow.queue_redraw()


func _draw() -> void:
	var r := visible_range(250.0)
	var e := Game.escalation()
	# Sails behind the ridge: translucent membranes on curved ribs.
	for s in sails:
		if s.x + s.w < r.x or s.x > r.y:
			continue
		var base_y := ridge(s.x + s.w * 0.5) + 20.0
		var n := 16
		var pts := PackedVector2Array()
		var cols := PackedColorArray()
		var tips: Array[Vector2] = []
		for i in range(n + 1):
			var k := float(i) / n
			var px: float = s.x + k * s.w
			var flutter := sin(t * 3.0 + k * 9.0 + s.ph) * (3.0 + twitch * 12.0 + e * 6.0)
			var p := Vector2(px, base_y - pow(sin(k * PI), 0.8) * s.h - flutter * sin(k * PI))
			pts.append(p)
			tips.append(p)
			cols.append(Color(0.85, 0.42, 0.38, 0.55))
		pts.append(Vector2(s.x + s.w, base_y + 30))
		cols.append(Color(0.3, 0.1, 0.15, 0.9))
		pts.append(Vector2(s.x, base_y + 30))
		cols.append(Color(0.3, 0.1, 0.15, 0.9))
		draw_polygon(pts, cols)
		var root := Vector2(s.x + s.w * 0.5, base_y + 30)
		for i in range(1, n, 2):
			var tip: Vector2 = tips[i]
			var mid := root.lerp(tip, 0.55) + Vector2((tip.x - root.x) * 0.15, 0)
			draw_polyline(PackedVector2Array([root, mid, tip]), Color(0.28, 0.08, 0.13, 0.75), 3.0, true)
		var edge := PackedVector2Array()
		for p in tips:
			edge.append(p)
		draw_polyline(edge, Color(1.0, 0.68, 0.5, 0.55), 2.5, true)
	# Ridge mass.
	var top := PackedVector2Array()
	var x := r.x
	while x <= r.y:
		top.append(Vector2(x, ridge(x)))
		x += 30.0
	var poly := top.duplicate()
	poly.append(Vector2(r.y, 900))
	poly.append(Vector2(r.x, 900))
	Paint.gradient_poly(self, poly, Color(0.33, 0.16, 0.21), Color(0.08, 0.03, 0.07))
	draw_polyline(top, Color(1.0, 0.6, 0.42, 0.55), 4.0, true)
	# Hairs.
	for h in hairs:
		if h.x < r.x or h.x > r.y:
			continue
		var b := Vector2(h.x, ridge(h.x) + 4)
		var sway := sin(t * 0.9 + h.ph) * 0.12 + sin(t * 7.0 + h.ph) * twitch * 0.05
		var a: float = -PI * 0.5 + h.lean + sway
		var p1: Vector2 = b + Vector2.from_angle(a) * h.l * 0.5
		var p2: Vector2 = p1 + Vector2.from_angle(a + sway * 1.5 + h.lean * 0.4) * h.l * 0.5
		draw_polyline(PackedVector2Array([b, p1, p2]), Color(0.2, 0.09, 0.12, 0.85), 1.8, true)
	# Armour plates along the ridge.
	for p in plates:
		if p.x < r.x or p.x > r.y:
			continue
		var c := Vector2(p.x, ridge(p.x) + 14)
		var w: float = p.w * 0.5
		var h: float = p.h * 1.1
		var pts := PackedVector2Array()
		for k in range(13):
			var u := float(k) / 12.0
			var px := lerpf(-w, w, u)
			var py := -h * pow(sin(u * PI), 1.4) * (1.0 - 0.25 * absf(u - 0.5))
			pts.append(c + Vector2(px, py).rotated(p.tilt))
		Paint.gradient_poly(self, pts, Color(0.46, 0.27, 0.29), Color(0.13, 0.05, 0.09))
		draw_polyline(pts.slice(0, 7), Color(1.0, 0.66, 0.5, 0.45), 2.0, true)
		for k in range(1, 3):
			var ridge_pts := PackedVector2Array()
			for j in range(2, 11):
				var u := float(j) / 12.0
				var px := lerpf(-w, w, u) * (1.0 - k * 0.25)
				var py := -h * pow(sin(u * PI), 1.4) * (1.0 - k * 0.3) * (1.0 - 0.25 * absf(u - 0.5))
				ridge_pts.append(c + Vector2(px, py).rotated(p.tilt))
			draw_polyline(ridge_pts, Color(0.1, 0.04, 0.07, 0.5), 1.5, true)


func _draw_glow(layer: GlowLayer) -> void:
	var r := visible_range(100.0)
	for s in sails:
		if s.x + s.w < r.x or s.x > r.y:
			continue
		layer.blob(Vector2(s.x + s.w * 0.5, ridge(s.x) - s.h * 0.45), s.w * 0.6, Color(1.0, 0.45, 0.3, 0.12 + twitch * 0.06))
