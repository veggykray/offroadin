extends BodyRegion
## THE FUR PATCH — thick tangled fur with things caught in it. Loves a good
## scratch. Every hair is a little spring that reacts to the hand.

const STRAND_COUNT := 640

var strands: Array = []   # Dictionary per hair
var ripples: Array = []   # {pos, t0, strength}
var trinkets: Array = []
var critter := {"active": false, "t": 0.0, "dur": 2.4, "from": Vector2.ZERO, "to": Vector2.ZERO, "pos": Vector2.ZERO}
var critter_timer := 9.0
var flatten := 0.0  ## 0..1 hairs lying down (annoyed)
var rise := 0.0     ## 0..1 hairs standing up (interested)
var thrum := 0.0    ## rhythmic wave when very excited
var undercoat: Array = []


func _setup() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4401
	for i in range(STRAND_COUNT):
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf())
		var root := Vector2(cos(a) * hit_radii.x * 0.95 * r, sin(a) * hit_radii.y * 0.85 * r)
		var edge := r  # hairs near the rim are shorter and lean outward
		var lean := (root.x / hit_radii.x) * 0.6
		var hue := rng.randf()
		var col: Color
		var tip: Color
		if hue < 0.5:
			col = Color(0.18, 0.09, 0.05).lerp(Color(0.28, 0.14, 0.07), rng.randf())
			tip = Color(0.5, 0.27, 0.13).lerp(Color(0.64, 0.38, 0.2), rng.randf())
		elif hue < 0.85:
			col = Color(0.14, 0.09, 0.06).lerp(Color(0.22, 0.15, 0.09), rng.randf())
			tip = Color(0.4, 0.3, 0.2).lerp(Color(0.52, 0.42, 0.3), rng.randf())
		else:
			col = Color(0.3, 0.2, 0.14)
			tip = Color(0.82, 0.7, 0.55).lerp(Color(0.92, 0.82, 0.68), rng.randf())
		strands.append({
			"root": root,
			"len": lerpf(120.0, 60.0, edge * edge) * rng.randf_range(0.8, 1.25),
			"base": -PI * 0.5 + lean + 0.75 * sin(root.x * 0.013 + root.y * 0.021) + rng.randf_range(-0.18, 0.18),
			"curl": 0.8 * sin(root.x * 0.009 - root.y * 0.017 + 1.0) + rng.randf_range(-0.2, 0.2),
			"a": 0.0, "v": 0.0,
			"w": rng.randf_range(3.5, 6.5),
			"col": col,
			"tip": tip,
			"phase": rng.randf() * TAU,
		})
	strands.sort_custom(func(p, q): return p.root.y < q.root.y)
	for i in range(70):
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * 0.85
		undercoat.append({"p": Vector2(cos(a) * hit_radii.x * r, sin(a) * hit_radii.y * r - 15.0),
			"r": rng.randf_range(40, 80), "ph": rng.randf() * TAU,
			"c": Color(0.36, 0.18, 0.08).lerp(Color(0.5, 0.3, 0.14), rng.randf()) * Color(1, 1, 1, 0.55)})
	trinkets = [
		{"kind": "bone", "pos": Vector2(-150, -10), "rot": 0.4, "bob": 0.0, "v": 0.0},
		{"kind": "button", "pos": Vector2(90, 40), "rot": 0.0, "bob": 0.0, "v": 0.0},
		{"kind": "key", "pos": Vector2(210, -20), "rot": -0.7, "bob": 0.0, "v": 0.0},
		{"kind": "boot", "pos": Vector2(-40, 70), "rot": 0.2, "bob": 0.0, "v": 0.0},
		{"kind": "pod", "pos": Vector2(-230, 40), "rot": 0.0, "bob": 0.0, "v": 0.0},
		{"kind": "feather", "pos": Vector2(40, -60), "rot": -1.1, "bob": 0.0, "v": 0.0},
	]


func _update(delta: float) -> void:
	var e := Game.escalation()
	flatten = Game.damp(flatten, tension, 3.0, delta)
	rise = Game.damp(rise, clampf(excitement * 0.8 + attention * 0.6 + hover * 0.15, 0.0, 1.0), 2.0, delta)
	thrum = Game.damp(thrum, clampf((e - 0.55) * 2.2, 0.0, 1.0), 1.0, delta)
	var breath: float = Game.body.breath if Game.body else 0.0

	# Ripples spread outward through the hair.
	for rp in ripples:
		rp.age += delta
	ripples = ripples.filter(func(rp): return rp.age < 1.6)

	if not onscreen:
		return
	var wiggle := attention * 0.5
	for s in strands:
		var target := 0.0
		target += sin(t * 1.3 + s.phase) * 0.05 + breath * 0.04
		target += sin(t * 7.0 + s.phase * 3.0) * wiggle * 0.35
		target += sin(t * 9.0 - s.root.x * 0.03) * thrum * 0.22
		var to_side := 1.0 if s.root.x >= 0.0 else -1.0
		target += flatten * to_side * 1.0
		for rp in ripples:
			var d: float = s.root.distance_to(rp.pos)
			var front: float = rp.age * 520.0
			var k: float = exp(-pow((d - front) / 40.0, 2.0)) * rp.strength * (1.0 - rp.age / 1.6)
			if k > 0.01:
				s.v += signf(s.root.x - rp.pos.x + 0.01) * k * 28.0 * delta * 60.0 * 0.05
		var stiff := lerpf(28.0, 18.0, rise)
		s.v += (-(s.a - target) * stiff - s.v * 4.5) * delta
		s.a += s.v * delta
		s.a = clampf(s.a, -1.6, 1.6)

	for tk in trinkets:
		tk.v += (-tk.bob * 60.0 - tk.v * 6.0) * delta
		tk.bob += tk.v * delta

	_update_critter(delta)


func _update_critter(delta: float) -> void:
	if critter.active:
		critter.t += delta
		var k: float = critter.t / critter.dur
		if k >= 1.0:
			critter.active = false
		else:
			var p: Vector2 = critter.from.lerp(critter.to, k)
			p.y += sin(k * PI * 3.0) * 30.0
			critter.pos = p
			_push_hairs(p, Vector2(critter.to - critter.from).normalized() * 600.0, 34.0, 0.9)
	else:
		critter_timer -= delta
		if critter_timer <= 0.0:
			_start_critter()


func _start_critter() -> void:
	critter_timer = randf_range(11.0, 22.0)
	var left := randf() < 0.5
	critter.active = true
	critter.t = 0.0
	critter.dur = randf_range(1.6, 2.8)
	critter.from = Vector2(-hit_radii.x * (1.0 if left else -1.0), randf_range(-60, 60))
	critter.to = Vector2(hit_radii.x * (1.0 if left else -1.0), randf_range(-60, 60))
	if Game.voice:
		Game.voice.play_at(&"squeak", to_global(critter.from), -8.0, randf_range(0.9, 1.3))


func _push_hairs(p: Vector2, vel: Vector2, radius: float, strength: float) -> void:
	for s in strands:
		var mid: Vector2 = s.root + Vector2.from_angle(s.base + s.a) * s.len * 0.5
		var d := mid.distance_to(p)
		if d < radius:
			var k := (1.0 - d / radius) * strength
			s.v += clampf(vel.x * 0.012, -6.0, 6.0) * k
			s.v += signf(mid.x - p.x) * k * 1.4


func _on_pointer(prev: Vector2, lp: Vector2, pressed: bool, vel: Vector2) -> void:
	if _ellipse_dist(lp) > 1.4:
		return
	if pressed:
		_push_hairs(lp, vel, 70.0, 1.0)
	else:
		_push_hairs(lp, vel, 40.0, 0.25)


func _on_reaction(level: int, lp: Vector2, _g: Gesture) -> void:
	match level:
		Game.Level.WRONG:
			if critter.active:
				critter.dur = minf(critter.dur, critter.t + 0.4)
		Game.Level.GOOD:
			if randf() < 0.25:
				ripples.append({"pos": lp, "age": 0.0, "strength": 0.6})
		Game.Level.VERY_GOOD, Game.Level.HERRING:
			if ripples.size() < 4 and randf() < 0.5:
				ripples.append({"pos": lp, "age": 0.0, "strength": 1.2})
			if randf() < 0.3:
				_bounce_trinkets(80.0)


func body_jolt(strength: float) -> void:
	ripples.append({"pos": Vector2(randf_range(-100, 100), 0), "age": 0.0, "strength": 0.6 * strength})
	_bounce_trinkets(160.0 * strength)


func _bounce_trinkets(power: float) -> void:
	for tk in trinkets:
		tk.v -= power * randf_range(0.5, 1.2)


# --- Drawing -------------------------------------------------------------------

func _draw() -> void:
	var rx := hit_radii.x
	var ry := hit_radii.y
	# Shadowed skin under the fur.
	Paint.soft_ellipse(self, Vector2(0, 20), Vector2(rx * 1.35, ry * 1.5), Color(0.05, 0.02, 0.03, 0.75))
	Paint.soft_ellipse(self, Vector2(0, 10), Vector2(rx * 1.05, ry * 1.0), Color(0.12, 0.05, 0.03, 0.95))
	Paint.soft_ellipse(self, Vector2(0, -10), Vector2(rx * 0.85, ry * 0.7), Color(0.3, 0.14, 0.07, 0.8))
	# Fluffy under-coat so the patch has volume.
	for u in undercoat:
		Paint.soft(self, u.p + Vector2(0, sin(t * 1.2 + u.ph) * 2.0), u.r, u.c)

	var half := strands.size() / 2
	# Back layer of hair.
	_draw_strands(0, half, 0.72)
	# Things caught in the fur.
	for tk in trinkets:
		_draw_trinket(tk)
	if critter.active:
		_draw_critter(critter.pos)
	_draw_strands(half, strands.size(), 1.0)


## All hairs in [from, to) as three batched segment lists (root, mid, tip).
func _draw_strands(from: int, to: int, shade: float) -> void:
	var seg := [PackedVector2Array(), PackedVector2Array(), PackedVector2Array()]
	var col := [PackedColorArray(), PackedColorArray(), PackedColorArray()]
	var lift := 1.0 + rise * 0.25 - flatten * 0.35
	var uncurl := 1.0 - rise * 0.6
	for i in range(from, to):
		var s: Dictionary = strands[i]
		var ang: float = s.base + s.a
		var l: float = s.len * lift
		var root: Vector2 = s.root
		var curl: float = s.curl * uncurl
		var p1 := root + Vector2.from_angle(ang) * l * 0.4
		var p2 := p1 + Vector2.from_angle(ang + curl * 0.6) * l * 0.35
		var p3 := p2 + Vector2.from_angle(ang + curl * 1.3) * l * 0.3
		var c: Color = s.col * shade
		var tc: Color = s.tip * shade
		c.a = 1.0
		tc.a = 1.0
		seg[0].append(root)
		seg[0].append(p1)
		col[0].append(c)
		seg[1].append(p1)
		seg[1].append(p2)
		col[1].append(c.lerp(tc, 0.5))
		seg[2].append(p2)
		seg[2].append(p3)
		col[2].append(tc)
	draw_multiline_colors(seg[0], col[0], 5.0)
	draw_multiline_colors(seg[1], col[1], 3.6)
	draw_multiline_colors(seg[2], col[2], 2.2)


func _draw_trinket(tk: Dictionary) -> void:
	var p: Vector2 = tk.pos + Vector2(0, tk.bob)
	draw_set_transform(p, tk.rot, Vector2.ONE)
	match tk.kind:
		"bone":
			draw_line(Vector2(-28, 0), Vector2(28, 0), Color(0.85, 0.8, 0.68), 9.0)
			for x in [-28.0, 28.0]:
				draw_circle(Vector2(x, -5), 7.0, Color(0.88, 0.83, 0.7))
				draw_circle(Vector2(x, 5), 7.0, Color(0.8, 0.75, 0.62))
		"button":
			draw_circle(Vector2.ZERO, 15.0, Color(0.55, 0.12, 0.14))
			draw_circle(Vector2.ZERO, 11.0, Color(0.7, 0.2, 0.2))
			for o in [Vector2(-4, -4), Vector2(4, -4), Vector2(-4, 4), Vector2(4, 4)]:
				draw_circle(o, 2.2, Color(0.25, 0.05, 0.05))
		"key":
			draw_arc(Vector2(-16, 0), 9.0, 0, TAU, 16, Color(0.8, 0.66, 0.3), 4.0)
			draw_line(Vector2(-7, 0), Vector2(26, 0), Color(0.8, 0.66, 0.3), 4.0)
			draw_line(Vector2(18, 0), Vector2(18, 8), Color(0.8, 0.66, 0.3), 4.0)
			draw_line(Vector2(24, 0), Vector2(24, 6), Color(0.8, 0.66, 0.3), 4.0)
		"boot":
			var boot := PackedVector2Array([Vector2(-10, -26), Vector2(6, -26), Vector2(7, 2), Vector2(24, 6), Vector2(24, 14), Vector2(-12, 14)])
			draw_colored_polygon(boot, Color(0.22, 0.14, 0.1))
			draw_line(Vector2(-12, 14), Vector2(24, 14), Color(0.1, 0.06, 0.05), 3.0)
		"pod":
			Paint.ellipse(self, Vector2.ZERO, Vector2(14, 22), Color(0.36, 0.42, 0.18), 18)
			draw_line(Vector2(0, -20), Vector2(0, 20), Color(0.22, 0.28, 0.1), 2.0)
		"feather":
			draw_line(Vector2(-34, 0), Vector2(34, 0), Color(0.9, 0.9, 0.85), 2.0)
			for k in range(-6, 7):
				var x := k * 5.0
				var w := 10.0 * (1.0 - absf(k) / 7.0)
				draw_line(Vector2(x, 0), Vector2(x + 6, -w), Paint.iridescent(t + k * 0.3, 0.2), 2.0)
				draw_line(Vector2(x, 0), Vector2(x + 6, w), Paint.iridescent(t + k * 0.3, 0.5), 2.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_critter(p: Vector2) -> void:
	var dir: float = signf(critter.to.x - critter.from.x)
	var leg_phase := t * 40.0
	for i in range(3):
		var x := (i - 1) * 6.0
		var s1 := sin(leg_phase + i * 2.0) * 4.0
		draw_line(p + Vector2(x, 0), p + Vector2(x + s1, 9), Color(0.08, 0.05, 0.05), 1.5)
		draw_line(p + Vector2(x, 0), p + Vector2(x - s1, -9), Color(0.08, 0.05, 0.05), 1.5)
	Paint.ellipse(self, p, Vector2(11, 6), Color(0.12, 0.08, 0.1), 14)
	draw_circle(p + Vector2(8 * dir, -2), 1.8, Color(1, 0.9, 0.6))
	draw_circle(p + Vector2(9 * dir, 2), 1.4, Color(1, 0.9, 0.6))


func _draw_glow(layer: GlowLayer) -> void:
	var e := Game.escalation()
	var k := excitement * 0.25 + attention * 0.3 + e * 0.15
	if k > 0.01:
		layer.blob(Vector2(0, -20), hit_radii.x * 1.1, Color(0.9, 0.5, 0.2, k * 0.35))
	if critter.active:
		layer.blob(critter.pos, 14.0, Color(1, 0.8, 0.4, 0.5))
