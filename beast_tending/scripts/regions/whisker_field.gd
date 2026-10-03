extends BodyRegion
## THE WHISKER FIELD — huge flexible sensory hairs. Each one twangs when the
## hand passes through it; long strokes across the field send waves rolling
## through them. It does not like having a whisker held.

const COUNT := 13
const SEGS := 16

var whiskers: Array = []
var bristle := 0.0


func _setup() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 13
	for i in range(COUNT):
		var x := lerpf(-430.0, 430.0, float(i) / (COUNT - 1)) + rng.randf_range(-18, 18)
		var root := Vector2(x, 30.0 * sin(i * 1.7) + 10.0)
		var length := rng.randf_range(620.0, 980.0)
		whiskers.append({
			"root": root,
			"len": length,
			"base": -PI * 0.5 + x / 430.0 * 0.42 + rng.randf_range(-0.08, 0.08),
			"curve": rng.randf_range(-0.03, 0.03),
			"a": [], "v": [],
			"pts": PackedVector2Array(),
			"w": rng.randf_range(10.0, 17.0),
			"cool": 0.0, "glint": 0.0,
			"pitch": remap(length, 620.0, 980.0, 1.5, 0.8),
		})
		whiskers[i].a.resize(SEGS)
		whiskers[i].a.fill(0.0)
		whiskers[i].v.resize(SEGS)
		whiskers[i].v.fill(0.0)
		whiskers[i].pts.resize(SEGS + 1)


func _update(delta: float) -> void:
	var e := Game.escalation()
	bristle = Game.damp(bristle, clampf(excitement * 0.8 + attention * 0.5 - tension * 0.6, -0.6, 1.0), 2.0, delta)
	var breath: float = Game.body.breath if Game.body else 0.0
	if not onscreen:
		return
	var steps := 2
	var h := delta / steps
	for _s in range(steps):
		for w in whiskers:
			var a: Array = w.a
			var v: Array = w.v
			for i in range(SEGS):
				var left: float = a[i - 1] if i > 0 else 0.0
				var right: float = a[i + 1] if i < SEGS - 1 else a[i]
				var force: float = -a[i] * 40.0 + (left + right - 2.0 * a[i]) * 260.0 - v[i] * 3.2
				v[i] += force * h
			for i in range(SEGS):
				a[i] += v[i] * h
				a[i] = clampf(a[i], -0.6, 0.6)
	for wi in range(whiskers.size()):
		var w: Dictionary = whiskers[wi]
		w.cool = maxf(w.cool - delta, 0.0)
		w.glint = Game.damp(w.glint, 0.0, 2.5, delta)
		var pts: PackedVector2Array = w.pts
		var p: Vector2 = w.root
		var ang: float = w.base - bristle * 0.06 * signf(w.root.x) * -1.0
		ang += sin(t * 0.8 + wi) * 0.015 + breath * 0.01
		ang += sin(t * 12.0 + wi * 1.3) * attention * 0.02
		ang += sin(t * 6.0 + wi * 0.7) * maxf(e - 0.6, 0.0) * 0.05
		var seg: float = w.len / SEGS * (1.0 + bristle * 0.04)
		pts[0] = p
		for i in range(SEGS):
			ang += w.curve + w.a[i] / SEGS * 4.0
			# Gravity-ish droop toward the tip.
			ang += (0.012 if w.root.x > 0 else -0.012) * (1.0 - bristle * 0.5)
			p += Vector2.from_angle(ang) * seg
			pts[i + 1] = p
		w.pts = pts


func _on_pointer(prev: Vector2, lp: Vector2, pressed: bool, vel: Vector2) -> void:
	if prev.x > 90000.0 or prev.distance_to(lp) < 0.5:
		return
	for wi in range(whiskers.size()):
		var w: Dictionary = whiskers[wi]
		var pts: PackedVector2Array = w.pts
		for i in range(SEGS):
			var hit = Geometry2D.segment_intersects_segment(prev, lp, pts[i], pts[i + 1])
			if hit != null:
				var tangent := (pts[i + 1] - pts[i]).normalized()
				var side := signf(tangent.cross(lp - prev))
				var strength := clampf(vel.length() / 900.0, 0.2, 1.4) * (1.0 if pressed else 0.35)
				for k in range(maxi(i - 1, 0), mini(i + 2, SEGS)):
					w.v[k] += side * strength * 6.0
				w.glint = 1.0
				if w.cool <= 0.0 and Game.voice:
					w.cool = 0.12
					var vol := lerpf(-16.0, -3.0, clampf(strength, 0.0, 1.0))
					Game.voice.play_at(&"twang", to_global(pts[i]), vol, w.pitch * randf_range(0.97, 1.03))
				break


func _on_reaction(level: int, lp: Vector2, g: Gesture) -> void:
	if g != null and g.type == Gesture.Type.HOLD:
		# Tug the grabbed whisker away.
		var wi := _nearest_whisker(lp)
		if wi >= 0:
			for k in range(SEGS):
				whiskers[wi].v[k] += 1.5 * (1.0 if lp.x < whiskers[wi].root.x else -1.0)
	if level >= Game.Level.VERY_GOOD:
		for w in whiskers:
			w.v[SEGS / 2] += randf_range(-1.0, 1.0)


func _nearest_whisker(lp: Vector2) -> int:
	var best := -1
	var bd := 70.0
	for wi in range(whiskers.size()):
		var pts: PackedVector2Array = whiskers[wi].pts
		for i in range(0, SEGS + 1, 2):
			var d := lp.distance_to(pts[i])
			if d < bd:
				bd = d
				best = wi
	return best


func body_jolt(strength: float) -> void:
	for w in whiskers:
		w.v[2] += randf_range(-2.0, 2.0) * strength


func _draw() -> void:
	# Follicle mounds.
	Paint.soft_ellipse(self, Vector2(0, 50), Vector2(560, 210), Color(0.03, 0.02, 0.03, 0.7))
	for w in whiskers:
		var r: Vector2 = w.root
		Paint.ellipse(self, r + Vector2(0, 14), Vector2(46, 28), Color(0.2, 0.13, 0.15), 20)
		Paint.ellipse(self, r + Vector2(0, 6), Vector2(38, 20), Color(0.36, 0.25, 0.25), 20)
		Paint.ellipse(self, r + Vector2(0, 2), Vector2(16, 9), Color(0.06, 0.02, 0.03), 14)
	# Whiskers, back to front.
	for w in whiskers:
		var shade := Color(0.16, 0.11, 0.1)
		var tip := Color(0.78, 0.74, 0.66, 0.55)
		Paint.strand(self, w.pts, w.w, 2.0, shade, tip)
		# Highlight down one side.
		var hl := PackedVector2Array()
		for i in range(0, SEGS + 1):
			hl.append(w.pts[i] + Vector2(-w.w * 0.18 * (1.0 - float(i) / SEGS), 0))
		draw_polyline(hl, Color(0.9, 0.85, 0.75, 0.22), 2.0, true)


func _draw_glow(layer: GlowLayer) -> void:
	for w in whiskers:
		if w.glint > 0.03:
			for i in range(2, SEGS + 1, 3):
				layer.blob(w.pts[i], 26.0, Color(1.0, 0.9, 0.7, 0.22 * w.glint))
	if attention > 0.02 or excitement > 0.02:
		var k := attention * 0.3 + excitement * 0.2
		for w in whiskers:
			layer.blob(w.root, 60.0, Color(1, 0.7, 0.45, k * 0.4))
