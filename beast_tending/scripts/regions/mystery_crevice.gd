extends BodyRegion
## THE MYSTERY CREVICE — a whorled recess ringed with plates and iridescent
## feathers, holding what looks like a small night sky. Poking it produces a
## spectacular reaction. That is not the same thing as a good one.

const OPEN_R := Vector2(150, 118)
const BLADES := 12

var close_amount := 0.0   ## 0 open .. 1 shuttered
var close_target := 0.0
var flare := 0.0          ## feather puff after a poke
var shudder := 0.0
var swirl := 0.0
var feathers: Array = []
var stars: Array = []
var plates: Array = []
var poke_count := 0
var sealed := false


func _setup() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 6
	for i in range(34):
		var a := TAU * i / 34.0 + rng.randf_range(-0.05, 0.05)
		feathers.append({"a": a, "l": rng.randf_range(90, 170), "w": rng.randf_range(16, 28), "ph": rng.randf() * TAU, "hue": rng.randf()})
	for i in range(60):
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 0.9
		stars.append({"p": Vector2(cos(a) * OPEN_R.x * r, sin(a) * OPEN_R.y * r), "s": rng.randf_range(0.8, 2.6), "ph": rng.randf() * TAU})
	for i in range(18):
		var a := TAU * i / 18.0
		plates.append({"a": a, "ph": rng.randf() * TAU})


func _update(delta: float) -> void:
	close_amount = Game.damp(close_amount, close_target, 2.2, delta)
	flare = Game.damp(flare, 0.0, 1.1, delta)
	shudder = Game.damp(shudder, 0.0, 2.0, delta)
	swirl = Game.damp(swirl, excitement * 0.5, 0.8, delta)


## Third poke: the beast moves this out of reach for good.
func seal() -> void:
	sealed = true
	accessible = false
	close_target = 1.0
	shudder = 1.0


func reset_state() -> void:
	sealed = false
	accessible = true
	close_target = 0.0
	poke_count = 0


func _on_reaction(level: int, _lp: Vector2, g: Gesture) -> void:
	if level == Game.Level.HERRING:
		flare = 1.0
		shudder = 1.0
		close_target = 0.0 if poke_count < 2 else 0.35
		return
	if g == null:
		return
	match g.type:
		Gesture.Type.HOLD:
			swirl = minf(swirl + 0.1, 1.0)
		Gesture.Type.STROKE, Gesture.Type.RUB, Gesture.Type.SCRATCH:
			flare = maxf(flare, 0.3)


func body_jolt(strength: float) -> void:
	shudder = maxf(shudder, 0.4 * strength)


func _draw() -> void:
	var sh := Vector2(sin(t * 60.0), cos(t * 53.0)) * shudder * 4.0
	draw_set_transform(sh, 0.0, Vector2.ONE)
	Paint.soft_ellipse(self, Vector2(0, 20), Vector2(380, 300), Color(0.02, 0.01, 0.03, 0.8))
	# Feathers fanning out behind the rim.
	for f in feathers:
		var spread := 1.0 + flare * 0.45 - close_amount * 0.35
		var a: float = f.a + sin(t * 1.5 + f.ph) * 0.04 + sin(t * 20.0 + f.ph) * flare * 0.05
		var dir := Vector2.from_angle(a)
		var base := Vector2(dir.x * OPEN_R.x * 1.35, dir.y * OPEN_R.y * 1.45)
		var tip: Vector2 = base + dir * f.l * spread
		var nrm: Vector2 = dir.orthogonal() * f.w * 0.5
		var col := Paint.iridescent(t + f.hue * 10.0, f.hue).darkened(0.35 + close_amount * 0.3)
		var poly := PackedVector2Array([base - nrm * 0.4, base.lerp(tip, 0.4) - nrm, tip, base.lerp(tip, 0.4) + nrm, base + nrm * 0.4])
		draw_colored_polygon(poly, col)
		draw_line(base, tip, col.darkened(0.5), 2.0, true)
	# Rim plates.
	for i in range(plates.size()):
		var pl: Dictionary = plates[i]
		var a: float = pl.a + sin(t * 0.5 + pl.ph) * 0.01
		var dir := Vector2.from_angle(a)
		var c := Vector2(dir.x * OPEN_R.x * 1.22, dir.y * OPEN_R.y * 1.25)
		var pts := Paint.ellipse_points(c, Vector2(52, 30), 14, a + PI * 0.5)
		Paint.gradient_poly(self, pts, Color(0.42, 0.36, 0.4), Color(0.16, 0.12, 0.16))
		draw_polyline(pts + PackedVector2Array([pts[0]]), Color(0.08, 0.05, 0.08), 2.0, true)
	# The hollow: a whorl of dark with stars inside.
	var hole := Paint.ellipse_points(Vector2.ZERO, OPEN_R, 40)
	draw_colored_polygon(hole, Color(0.02, 0.015, 0.05))
	Paint.soft_ellipse(self, Vector2(0, 0), OPEN_R * 0.9, Color(0.12, 0.05, 0.25, 0.8))
	for k in range(3):
		var spiral := PackedVector2Array()
		for i in range(40):
			var s := i / 39.0
			var ang := s * TAU * 1.4 + t * (0.3 + swirl) + k * TAU / 3.0
			spiral.append(Vector2(cos(ang) * OPEN_R.x, sin(ang) * OPEN_R.y) * s * 0.9)
		draw_polyline(spiral, Color(0.35, 0.2, 0.6, 0.35), 3.0, true)
	for s in stars:
		var tw := 0.5 + 0.5 * sin(t * 2.0 + s.ph)
		draw_circle(s.p.rotated(t * 0.05 + swirl * 0.2), s.s * (0.6 + tw * 0.6), Color(0.9, 0.9, 1.0, 0.4 + tw * 0.6))
	# Inner rim lip.
	draw_polyline(hole + PackedVector2Array([hole[0]]), Color(0.3, 0.2, 0.35), 8.0, true)
	# Iris shutters.
	if close_amount > 0.06:
		for i in range(BLADES):
			var a := TAU * i / BLADES + close_amount * 0.9
			var outer := Vector2(cos(a) * OPEN_R.x * 1.1, sin(a) * OPEN_R.y * 1.1)
			var outer2 := Vector2(cos(a + 0.9) * OPEN_R.x * 1.1, sin(a + 0.9) * OPEN_R.y * 1.1)
			var inner := outer.lerp(Vector2.ZERO, close_amount)
			var inner2 := outer2.lerp(Vector2.ZERO, close_amount * 0.7)
			var blade := PackedVector2Array([outer, outer2, inner2, inner])
			var col := Color(0.38, 0.32, 0.36).darkened(float(i % 3) * 0.1)
			draw_colored_polygon(blade, col)
			draw_line(outer, inner, Color(0.12, 0.08, 0.1), 2.5, true)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_glow(layer: GlowLayer) -> void:
	var open := 1.0 - close_amount
	layer.blob(Vector2.ZERO, OPEN_R.x * 1.2, Color(0.45, 0.3, 0.9, (0.12 + flare * 0.6 + swirl * 0.2 + attention * 0.2) * open))
	if flare > 0.05:
		layer.ring(Vector2.ZERO, OPEN_R.x * (1.5 + (1.0 - flare) * 2.0), Color(0.8, 0.6, 1.0, flare * 0.5))
