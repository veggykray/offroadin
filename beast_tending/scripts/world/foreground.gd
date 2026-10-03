extends ParallaxBodyLayer
## Out-of-focus hairs right in front of the camera, and big blurred motes.
## Sells the scale: we are tiny, pressed up against the beast.

var strands: Array = []
var motes: Array = []


func _ready() -> void:
	z_index = 40
	var rng := RandomNumberGenerator.new()
	rng.seed = 5150
	var x := 300.0
	while x < Game.WORLD_WIDTH * motion_scale + 1500.0:
		strands.append({"x": x, "l": rng.randf_range(380, 720), "w": rng.randf_range(26, 60), "lean": rng.randf_range(-0.6, 0.6), "ph": rng.randf() * TAU, "curl": rng.randf_range(-0.4, 0.4)})
		x += rng.randf_range(650, 1300)
	for i in range(30):
		motes.append({"p": Vector2(rng.randf_range(0, Game.WORLD_WIDTH * motion_scale + 1500.0), rng.randf_range(100, 1000)), "r": rng.randf_range(12, 40), "ph": rng.randf() * TAU})


func _draw() -> void:
	var r := visible_range(400.0)
	var e := Game.escalation()
	for s in strands:
		if s.x < r.x or s.x > r.y:
			continue
		var b := Vector2(s.x, 1180)
		var pts := PackedVector2Array()
		var ang: float = -PI * 0.5 + s.lean + sin(t * 0.6 + s.ph) * 0.05 + sin(t * 5.0 + s.ph) * maxf(e - 0.6, 0.0) * 0.05
		var p := b
		for i in range(10):
			pts.append(p)
			ang += s.curl * 0.12
			p += Vector2.from_angle(ang) * s.l / 9.0
		# Fake depth of field: wide faint passes, then the core.
		for pass_i in range(3):
			var k := 1.0 + (2 - pass_i) * 0.5
			Paint.strand(self, pts, s.w * k, s.w * 0.3 * k, Color(0.03, 0.01, 0.02, 0.28), Color(0.08, 0.03, 0.04, 0.0))
		Paint.strand(self, pts, s.w * 0.8, s.w * 0.15, Color(0.02, 0.01, 0.015, 0.85), Color(0.1, 0.05, 0.05, 0.2))
	for m in motes:
		var mp: Vector2 = m.p + Vector2(sin(t * 0.2 + m.ph) * 40.0, sin(t * 0.13 + m.ph * 2.0) * 30.0)
		if mp.x < r.x or mp.x > r.y:
			continue
		Paint.soft(self, mp, m.r * 2.0, Color(1.0, 0.85, 0.7, 0.05))
		Paint.soft(self, mp, m.r, Color(1.0, 0.9, 0.8, 0.07))
