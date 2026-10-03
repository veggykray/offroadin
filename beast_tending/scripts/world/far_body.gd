extends ParallaxBodyLayer
## The rest of the beast, far away and hazy: an endless flank, a ridge of
## spines, rows of glowing pores like distant lights, and a colossal tail-or-
## something rising into the sky.

var lights: Array = []
var glow: GlowLayer
var tail_sway := 0.0


func _ready() -> void:
	z_index = -20
	var rng := RandomNumberGenerator.new()
	rng.seed = 31
	for i in range(140):
		var x := rng.randf_range(-1400, 2600)
		lights.append({"x": x, "d": rng.randf_range(20, 160), "ph": rng.randf() * TAU, "s": rng.randf_range(1.5, 4.0)})
	glow = GlowLayer.new(_draw_glow, 1)
	add_child(glow)


func _layer_update(delta: float) -> void:
	var e := Game.escalation()
	tail_sway = Game.damp(tail_sway, e, 0.5, delta)
	glow.queue_redraw()


func ridge(x: float) -> float:
	return 205.0 + 55.0 * sin(x * 0.0021 + 1.0) + 22.0 * sin(x * 0.0063 + 0.4)


func _draw() -> void:
	var r := visible_range(300.0)
	var top := PackedVector2Array()
	var x := r.x
	while x <= r.y:
		top.append(Vector2(x, ridge(x)))
		x += 40.0
	var poly := top.duplicate()
	poly.append(Vector2(r.y, 900))
	poly.append(Vector2(r.x, 900))
	Paint.gradient_poly(self, poly, Color(0.55, 0.3, 0.33), Color(0.22, 0.1, 0.17))
	# Haze toward the silhouette.
	draw_polyline(top, Color(1.0, 0.65, 0.45, 0.35), 6.0, true)
	# Spines along the ridge.
	var sx := floorf(r.x / 90.0) * 90.0
	while sx <= r.y:
		var h := 30.0 + 28.0 * absf(sin(sx * 0.013))
		var y := ridge(sx)
		var lean := sin(sx * 0.003 + t * 0.2) * 6.0
		draw_colored_polygon(PackedVector2Array([Vector2(sx - 14, y + 6), Vector2(sx + lean, y - h), Vector2(sx + 14, y + 6)]), Color(0.38, 0.2, 0.27))
		sx += 90.0
	# The colossal tail-thing, impossibly far, swaying.
	_draw_tail(Vector2(1650, ridge(1650)))
	_draw_tail(Vector2(-900, ridge(-900)), 0.7)


func _draw_tail(base: Vector2, s: float = 1.0) -> void:
	var pts := PackedVector2Array()
	var p := base
	var ang := -PI * 0.5 - 0.2
	for i in range(26):
		pts.append(p)
		var k := float(i) / 25.0
		ang += 0.07 + sin(t * 0.35 + k * 3.0) * (0.02 + tail_sway * 0.03)
		p += Vector2.from_angle(ang) * 26.0 * s
	Paint.strand(self, pts, 90.0 * s, 14.0 * s, Color(0.4, 0.22, 0.28), Color(0.62, 0.38, 0.38, 0.9))


func _draw_glow(layer: GlowLayer) -> void:
	var r := visible_range(100.0)
	var e := Game.escalation()
	for l in lights:
		if l.x < r.x or l.x > r.y:
			continue
		var k := 0.4 + 0.6 * sin(t * 0.8 + l.ph)
		k = k * (0.4 + e * 0.8)
		layer.blob(Vector2(l.x, ridge(l.x) + l.d), l.s * 4.0, Color(0.5, 1.0, 0.8, 0.35 * k))
